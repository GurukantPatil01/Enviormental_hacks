import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { pool } from '../src/db/index.js';
import { runMigrations } from '../src/db/migrate.js';
import { seed } from '../src/db/seed.js';

describe('EcoPulse Foundation Vertical Slice End-to-End Tests', () => {
  let app: FastifyInstance;
  let residentToken: string;
  let residentUserId: string;
  let maintainerToken: string;
  let testCommunityId: string;
  let testMissionId: string;

  beforeAll(async () => {
    // 1. Run migrations and seeds
    await runMigrations();
    await seed();

    // 2. Build Fastify app instance
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  // 1. User Registration
  it('1. should register a new resident user with profile and return JWT', async () => {
    const uniqueEmail = `test.resident.${Date.now()}@example.com`;
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        email: uniqueEmail,
        password: 'Password123!',
        fullName: 'Test Citizen',
        role: 'RESIDENT',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data).toHaveProperty('token');
    expect(body.data.user.email).toBe(uniqueEmail.toLowerCase());
    expect(body.data.user.role).toBe('RESIDENT');

    residentToken = body.data.token;
    residentUserId = body.data.user.id;
  });

  // 2. User Login
  it('2. should login successfully with valid credentials and reject invalid credentials', async () => {
    // Demo account login
    const validRes = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        email: 'priya.sharma@example.com',
        password: 'password123',
      },
    });
    expect(validRes.statusCode).toBe(200);
    const validBody = validRes.json();
    expect(validBody.data.user.email).toBe('priya.sharma@example.com');
    expect(validBody.data).toHaveProperty('token');

    // Maintainer login
    const mtrRes = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        email: 'maintainer@ecopulse.org',
        password: 'password123',
      },
    });
    expect(mtrRes.statusCode).toBe(200);
    maintainerToken = mtrRes.json().data.token;

    // Invalid credentials
    const invalidRes = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        email: 'priya.sharma@example.com',
        password: 'wrong_password',
      },
    });
    expect(invalidRes.statusCode).toBe(401);
    expect(invalidRes.json().error.code).toBe('INVALID_CREDENTIALS');
  });

  // 3. Fetch Communities & Join Community
  it('3. should list communities and allow registered resident to join', async () => {
    const listRes = await app.inject({
      method: 'GET',
      url: '/communities',
    });
    expect(listRes.statusCode).toBe(200);
    const communities = listRes.json().data;
    expect(communities.length).toBeGreaterThan(0);

    const demoComm = communities.find((c: any) => c.slug === 'pune-green-community');
    expect(demoComm).toBeDefined();
    testCommunityId = demoComm.id;

    // Join community with resident token
    const joinRes = await app.inject({
      method: 'POST',
      url: `/communities/${testCommunityId}/join`,
      headers: {
        authorization: `Bearer ${residentToken}`,
      },
    });
    expect(joinRes.statusCode).toBe(200);
    expect(joinRes.json().data.success).toBe(true);

    // Verify community member list includes user
    const membersRes = await app.inject({
      method: 'GET',
      url: `/communities/${testCommunityId}/members`,
    });
    expect(membersRes.statusCode).toBe(200);
    const members = membersRes.json().data;
    expect(members.some((m: any) => m.userId === residentUserId)).toBe(true);
  });

  // 4. Mission Listing & Mission Start
  it('4. should list missions and allow user to start a mission', async () => {
    const missionsRes = await app.inject({
      method: 'GET',
      url: `/missions?communityId=${testCommunityId}`,
      headers: {
        authorization: `Bearer ${residentToken}`,
      },
    });
    expect(missionsRes.statusCode).toBe(200);
    const missions = missionsRes.json().data;
    expect(missions.length).toBeGreaterThanOrEqual(3);

    testMissionId = missions[0].id;

    // Start the mission
    const startRes = await app.inject({
      method: 'POST',
      url: `/missions/${testMissionId}/start`,
      headers: {
        authorization: `Bearer ${residentToken}`,
      },
    });
    expect(startRes.statusCode).toBe(200);
    expect(startRes.json().data.status).toBe('STARTED');
  });

  // 5. Mission Completion & Immutable Point Ledger Creation
  it('5. should complete mission, verify event, award points into immutable ledger, and update streak', async () => {
    const clientEventId = `client-evt-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    const completeRes = await app.inject({
      method: 'POST',
      url: `/missions/${testMissionId}/complete`,
      headers: {
        authorization: `Bearer ${residentToken}`,
      },
      payload: {
        client_event_id: clientEventId,
        notes: 'Walked the full clean corridor path',
      },
    });

    expect(completeRes.statusCode).toBe(200);
    const body = completeRes.json().data;
    expect(body.status).toBe('COMPLETED');
    expect(body.pointsAwarded).toBeGreaterThan(0);
    expect(body.pointBalance).toBe(body.pointsAwarded); // New user started with 0, now has pointsAwarded
    expect(body.currentStreak).toBe(1);
    expect(body.ledgerEntry).toBeDefined();
    expect(body.ledgerEntry.source).toBe('MISSION_COMPLETED');
    expect(body.ledgerEntry.type).toBe('CREDIT');
  });

  // 6. Duplicate Mission Completion (Critical Idempotency Check)
  it('6. should strictly prevent duplicate point awarding when retried with same client_event_id', async () => {
    const idempotentClientId = `idempotent-key-fixed-test-${Date.now()}`;

    // Get current balance before first run
    const pointsBeforeRes = await app.inject({
      method: 'GET',
      url: '/me/points',
      headers: { authorization: `Bearer ${residentToken}` },
    });
    const balanceBefore = pointsBeforeRes.json().data.balance.totalPoints;

    // List 2nd mission
    const missionsRes = await app.inject({
      method: 'GET',
      url: `/missions?communityId=${testCommunityId}`,
      headers: { authorization: `Bearer ${residentToken}` },
    });
    const secondMissionId = missionsRes.json().data[1].id;

    // First completion
    const run1 = await app.inject({
      method: 'POST',
      url: `/missions/${secondMissionId}/complete`,
      headers: { authorization: `Bearer ${residentToken}` },
      payload: {
        client_event_id: idempotentClientId,
        notes: 'Segregated wet and dry waste properly',
      },
    });
    expect(run1.statusCode).toBe(200);
    expect(run1.json().data.status).toBe('COMPLETED');
    const balanceAfterRun1 = run1.json().data.pointBalance;
    expect(balanceAfterRun1).toBeGreaterThan(balanceBefore);

    // Repeated request with exact same client_event_id
    const run2 = await app.inject({
      method: 'POST',
      url: `/missions/${secondMissionId}/complete`,
      headers: { authorization: `Bearer ${residentToken}` },
      payload: {
        client_event_id: idempotentClientId,
        notes: 'Segregated wet and dry waste properly',
      },
    });
    expect(run2.statusCode).toBe(200);
    expect(run2.json().data.status).toBe('ALREADY_COMPLETED');
    expect(run2.json().data.pointsAwarded).toBe(0);
    // Point balance must NOT have increased!
    expect(run2.json().data.pointBalance).toBe(balanceAfterRun1);
  });

  // 7. Point Balance Calculation from Immutable Ledger
  it('7. should compute point balance strictly from the immutable ledger projection', async () => {
    const pointsRes = await app.inject({
      method: 'GET',
      url: '/me/points',
      headers: { authorization: `Bearer ${residentToken}` },
    });

    expect(pointsRes.statusCode).toBe(200);
    const { balance, ledger } = pointsRes.json().data;

    // Calculate sum directly from returned ledger rows
    const calculatedSum = ledger.reduce((acc: number, entry: any) => {
      return entry.type === 'CREDIT' ? acc + entry.amount : acc - entry.amount;
    }, 0);

    expect(balance.totalPoints).toBe(calculatedSum);
    expect(balance.totalPoints).toBeGreaterThan(0);
  });

  // 8. Streak Status
  it('8. should return updated streak statistics', async () => {
    const streakRes = await app.inject({
      method: 'GET',
      url: '/me/streak',
      headers: { authorization: `Bearer ${residentToken}` },
    });

    expect(streakRes.statusCode).toBe(200);
    const streak = streakRes.json().data;
    expect(streak.currentStreak).toBeGreaterThanOrEqual(1);
    expect(streak.lastActivityDate).toBe(new Date().toISOString().split('T')[0]);
  });

  // 9. Home Dashboard Aggregation
  it('9. should return real aggregated data on GET /me', async () => {
    const meRes = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { authorization: `Bearer ${residentToken}` },
    });

    expect(meRes.statusCode).toBe(200);
    const data = meRes.json().data;
    expect(data.user.id).toBe(residentUserId);
    expect(data.community.id).toBe(testCommunityId);
    expect(data.pointBalance).toBeGreaterThan(0);
    expect(data.currentStreak).toBeGreaterThanOrEqual(1);
    expect(data.recentActivity.length).toBeGreaterThan(0);
  });

  // 10. Role-Based Access Control (RBAC) Enforcement
  it('10. should reject resident access to maintainer endpoint with 403, and allow maintainer with 200', async () => {
    // Resident attempt -> 403 Forbidden
    const residentAttempt = await app.inject({
      method: 'GET',
      url: '/maintainer/operations',
      headers: { authorization: `Bearer ${residentToken}` },
    });
    expect(residentAttempt.statusCode).toBe(403);
    expect(residentAttempt.json().error.code).toBe('FORBIDDEN');

    // Maintainer attempt -> 200 OK
    const maintainerAttempt = await app.inject({
      method: 'GET',
      url: '/maintainer/operations',
      headers: { authorization: `Bearer ${maintainerToken}` },
    });
    expect(maintainerAttempt.statusCode).toBe(200);
    expect(maintainerAttempt.json().data.status).toBe('ONLINE');
  });
});
