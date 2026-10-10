import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { db, pool } from '../src/db/index.js';
import { runMigrations } from '../src/db/migrate.js';
import { seed } from '../src/db/seed.js';
import { pointLedger } from '../src/db/schema.js';
import { leaderboardService } from '../src/services/leaderboard.service.js';

describe('EcoPulse Monthly Leaderboard System Tests', () => {
  let app: FastifyInstance;
  let residentToken: string;
  let residentUserId: string;

  beforeAll(async () => {
    await runMigrations();
    await seed();

    app = buildApp();
    await app.ready();

    // Login as resident Priya Sharma
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
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  it('1. should return the monthly leaderboard with month metadata and countdown', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/leaderboard',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toBeDefined();
    expect(body.data.period).toBe('monthly');
    expect(body.data.month).toMatch(/[A-Z][a-z]+ \d{4}/);
    expect(body.data.daysRemaining).toBeGreaterThanOrEqual(0);
    expect(body.data.nextResetDate).toBeDefined();
    expect(Array.isArray(body.data.entries)).toBe(true);
    expect(body.data.entries.length).toBeGreaterThan(0);

    // Verify first entry structure
    const topEntry = body.data.entries[0];
    expect(topEntry.rank).toBe(1);
    expect(topEntry.userId).toBeDefined();
    expect(topEntry.name).toBeDefined();
    expect(topEntry.avatarUrl).toContain('dicebear.com');
    expect(topEntry.monthlyPoints).toBeGreaterThanOrEqual(0);
    expect(topEntry.tier).toBeDefined();
    expect(['Eco Champion', 'Green Guardian', 'Civic Steward', 'Eco Pioneer', 'Active Resident']).toContain(topEntry.tier);

    // Also verify /api/leaderboard proxy endpoint
    const apiRes = await app.inject({
      method: 'GET',
      url: '/api/leaderboard',
    });
    expect(apiRes.statusCode).toBe(200);
    expect(apiRes.json().success).toBe(true);
    expect(apiRes.json().data.period).toBe('monthly');
  });

  it('2. should rank residents descending by monthly points', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/leaderboard?period=monthly',
    });

    expect(res.statusCode).toBe(200);
    const { entries } = res.json().data;

    for (let i = 0; i < entries.length - 1; i++) {
      expect(entries[i].monthlyPoints).toBeGreaterThanOrEqual(entries[i + 1].monthlyPoints);
      expect(entries[i].rank).toBe(i + 1);
    }
  });

  it('3. should identify current authenticated user and provide currentUserEntry', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/leaderboard',
      headers: {
        authorization: `Bearer ${residentToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const { entries, currentUserEntry } = res.json().data;

    expect(currentUserEntry).toBeDefined();
    expect(currentUserEntry.userId).toBe(residentUserId);
    expect(currentUserEntry.isCurrentUser).toBe(true);

    const matchInList = entries.find((e: any) => e.userId === residentUserId);
    if (matchInList) {
      expect(matchInList.isCurrentUser).toBe(true);
      expect(matchInList.rank).toBe(currentUserEntry.rank);
    }
  });

  it('4. should support all-time leaderboard period ranking', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/leaderboard?period=all_time',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json().data;
    expect(body.period).toBe('all_time');

    for (let i = 0; i < body.entries.length - 1; i++) {
      expect(body.entries[i].totalPoints).toBeGreaterThanOrEqual(body.entries[i + 1].totalPoints);
    }
  });

  it('5. should accurately isolate monthly points from previous months', async () => {
    // Insert a past month ledger entry (60 days ago)
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    const testReference = `old-test-${Date.now()}`;

    await db.insert(pointLedger).values({
      userId: residentUserId,
      source: 'MANUAL_ADJUSTMENT',
      referenceId: testReference,
      amount: 9999,
      type: 'CREDIT',
      createdAt: sixtyDaysAgo,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/leaderboard?period=monthly',
      headers: {
        authorization: `Bearer ${residentToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const { currentUserEntry } = res.json().data;

    // The past entry (60 days ago) MUST NOT inflate current monthly points!
    expect(currentUserEntry.monthlyPoints).toBeLessThan(9000);
    // But it MUST be included in total points
    expect(currentUserEntry.totalPoints).toBeGreaterThanOrEqual(9999);
  });

  it('6. should filter by communityId when specified', async () => {
    const communitiesRes = await app.inject({
      method: 'GET',
      url: '/communities',
    });
    const commList = communitiesRes.json().data;
    if (commList.length > 0) {
      const commId = commList[0].id;
      const res = await app.inject({
        method: 'GET',
        url: `/leaderboard?communityId=${commId}`,
      });
      expect(res.statusCode).toBe(200);
      const { entries } = res.json().data;
      for (const entry of entries) {
        expect(entry.communityId).toBe(commId);
      }
    }
  });
});
