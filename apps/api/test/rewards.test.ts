import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { pool } from '../src/db/index.js';
import { runMigrations } from '../src/db/migrate.js';
import { seed } from '../src/db/seed.js';

describe('EcoPulse Government Ticket Discount Coupons & Rewards Tests', () => {
  let app: FastifyInstance;
  let residentToken: string;
  let residentUserId: string;
  let poorUserToken: string;
  let sampleRewardId: string;
  let sampleRewardCost: number;

  beforeAll(async () => {
    await runMigrations();
    await seed();

    app = buildApp();
    await app.ready();

    // 1. Login as seeded resident Priya Sharma (has 340 points)
    const loginRes = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        email: 'priya.sharma@example.com',
        password: 'password123',
      },
    });
    const loginData = loginRes.json();
    residentToken = loginData.data.token;
    residentUserId = loginData.data.user.id;

    // Reset previous test claims & debits for isolation
    await pool.query('DELETE FROM reward_claims WHERE user_id = $1', [residentUserId]);
    await pool.query("DELETE FROM point_ledger WHERE user_id = $1 AND source = 'REWARD_REDEMPTION'", [residentUserId]);

    // 2. Register a brand new user with 0 points
    const poorEmail = `poor.citizen.${Date.now()}@example.com`;
    const regRes = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        email: poorEmail,
        password: 'Password123!',
        fullName: 'Zero Points Citizen',
      },
    });
    poorUserToken = regRes.json().data.token;
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  // 1. List rewards
  it('1. should list all active government ticket discount coupons', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/rewards',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(5);

    const busReward = body.data.find((r: any) => r.category === 'TRANSIT_PASS');
    expect(busReward).toBeDefined();
    expect(busReward.title).toContain('PMPML');
    expect(busReward.partnerName).toBe('PMPML Public Transit');
    expect(busReward.inventoryRemaining).toBeGreaterThan(0);

    sampleRewardId = busReward.id;
    sampleRewardCost = busReward.costPoints;
  });

  // 2. Filter rewards by category
  it('2. should filter rewards by category', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/rewards?category=METRO_DISCOUNT',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.length).toBeGreaterThanOrEqual(1);
    for (const r of body.data) {
      expect(r.category).toBe('METRO_DISCOUNT');
    }
  });

  // 3. Get single reward detail
  it('3. should retrieve reward details by ID', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/rewards/${sampleRewardId}`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.id).toBe(sampleRewardId);
    expect(body.data.redemptionInstructions).toBeDefined();
  });

  // 4. Reject claim if user has insufficient points
  it('4. should reject claim when user has insufficient balance', async () => {
    const clientEventId = `evt_claim_poor_${Date.now()}`;
    const res = await app.inject({
      method: 'POST',
      url: `/rewards/${sampleRewardId}/claim`,
      headers: { authorization: `Bearer ${poorUserToken}` },
      payload: { clientEventId },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error.code).toBe('INSUFFICIENT_BALANCE');
  });

  // 5. Successfully claim coupon with atomic ledger debit
  it('5. should allow resident to claim government ticket coupon and debit points', async () => {
    // Check initial balance
    const pointsResBefore = await app.inject({
      method: 'GET',
      url: '/me/points',
      headers: { authorization: `Bearer ${residentToken}` },
    });
    const balanceBefore = pointsResBefore.json().data.balance.totalPoints;

    const clientEventId = `evt_claim_priya_${Date.now()}`;
    const res = await app.inject({
      method: 'POST',
      url: `/rewards/${sampleRewardId}/claim`,
      headers: { authorization: `Bearer ${residentToken}` },
      payload: { clientEventId },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.claim).toBeDefined();
    expect(body.data.claim.couponCode).toMatch(/^PMPML-BUS-[A-F0-9]+$/);
    expect(body.data.claim.status).toBe('CLAIMED');
    expect(body.data.newBalance).toBe(balanceBefore - sampleRewardCost);

    // Verify ledger balance afterwards
    const pointsResAfter = await app.inject({
      method: 'GET',
      url: '/me/points',
      headers: { authorization: `Bearer ${residentToken}` },
    });
    expect(pointsResAfter.json().data.balance.totalPoints).toBe(balanceBefore - sampleRewardCost);

    // Verify immutable ledger entry
    const ledger = pointsResAfter.json().data.ledger;
    const debitEntry = ledger.find((e: any) => e.source === 'REWARD_REDEMPTION' && e.referenceId === body.data.claim.id);
    expect(debitEntry).toBeDefined();
    expect(debitEntry.type).toBe('DEBIT');
    expect(debitEntry.amount).toBe(sampleRewardCost);
  });

  // 6. Idempotency test
  it('6. should be strictly idempotent when re-submitting the same clientEventId', async () => {
    const clientEventId = `evt_claim_idemp_${Date.now()}`;

    // First claim
    const res1 = await app.inject({
      method: 'POST',
      url: `/rewards/${sampleRewardId}/claim`,
      headers: { authorization: `Bearer ${residentToken}` },
      payload: { clientEventId },
    });
    expect(res1.statusCode).toBe(200);
    const couponCode1 = res1.json().data.claim.couponCode;
    const balance1 = res1.json().data.newBalance;

    // Replay with identical clientEventId
    const res2 = await app.inject({
      method: 'POST',
      url: `/rewards/${sampleRewardId}/claim`,
      headers: { authorization: `Bearer ${residentToken}` },
      payload: { clientEventId },
    });
    expect(res2.statusCode).toBe(200);
    const couponCode2 = res2.json().data.claim.couponCode;
    const balance2 = res2.json().data.newBalance;

    expect(couponCode2).toBe(couponCode1);
    expect(balance2).toBe(balance1); // No double-debit!
  });

  // 7. Get user's claimed tickets & vouchers
  it('7. should list user claimed coupons under /rewards/my-claims', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/rewards/my-claims',
      headers: { authorization: `Bearer ${residentToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(1);

    const latest = body.data[0];
    expect(latest.couponCode).toBeDefined();
    expect(latest.expiresAt).toBeDefined();
    expect(latest.rewardTitle).toBeDefined();
  });
});
