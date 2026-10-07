import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { pool } from '../src/db/index.js';
import { runMigrations } from '../src/db/migrate.js';
import { seed } from '../src/db/seed.js';

describe('EcoPulse Product Phase 2-5 Closed Loop Tests', () => {
  let app: FastifyInstance;
  let residentToken: string;
  let residentUserId: string;
  let maintainerToken: string;
  let maintainerUserId: string;
  let communityId: string;
  let reportId: string;
  let evidenceId: string;
  let taskId: string;

  beforeAll(async () => {
    await runMigrations();
    await seed();

    app = buildApp();
    await app.ready();

    // Login as demo maintainer
    const mRes = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        email: 'maintainer@ecopulse.org',
        password: 'password123',
      },
    });
    expect(mRes.statusCode).toBe(200);
    maintainerToken = mRes.json().data.token;
    maintainerUserId = mRes.json().data.user.id;

    // Login as demo resident (Aarav)
    const rRes = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        email: 'aarav.patel@example.com',
        password: 'password123',
      },
    });

    expect(rRes.statusCode).toBe(200);
    residentToken = rRes.json().data.token;
    residentUserId = rRes.json().data.user.id;

    // Get community ID
    const cRes = await app.inject({
      method: 'GET',
      url: '/communities',
    });
    communityId = cRes.json().data[0].id;
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  // 1. Report creation
  it('1. should create a report with SUBMITTED status', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/reports',
      headers: { authorization: `Bearer ${residentToken}` },
      payload: {
        communityId,
        category: 'ILLEGAL_DUMPING',
        title: 'Discarded batteries behind market',
        description: 'Commercial dry cell and lead-acid batteries dumped near stormwater drain.',
        locationAddress: 'Market Yard Gate 3, Pune',
        clientEventId: `report-evt-${Date.now()}`,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data).toHaveProperty('id');
    expect(body.data.status).toBe('SUBMITTED');
    expect(body.data.category).toBe('ILLEGAL_DUMPING');
    expect(body.data.pointsReward).toBe(20);

    reportId = body.data.id;
  });

  // 2. Evidence attachment
  it('2. should attach photo evidence to the report', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/reports/${reportId}/evidence`,
      headers: { authorization: `Bearer ${residentToken}` },
      payload: {
        mediaUrl: 'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?w=800',
        mediaType: 'IMAGE',
        locationGeoJson: {
          type: 'Point',
          coordinates: [73.8567, 18.5204],
        },
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data).toHaveProperty('id');
    expect(body.data.reportId).toBe(reportId);
    expect(body.data.verificationStatus).toBe('PENDING');

    evidenceId = body.data.id;
  });

  // 3. Maintainer RBAC for verification
  it('3. should reject non-maintainer resident from approving a review', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/reviews/${reportId}/approve`,
      headers: { authorization: `Bearer ${residentToken}` },
      payload: {
        reason: 'Attempting unauthorized approval',
      },
    });

    expect(res.statusCode).toBe(403);
  });

  // 4. Report verification -> Point ledger credit
  it('4. should allow maintainer to approve report, verify evidence, and award immutable points', async () => {
    // Check resident balance before
    const beforeMe = await app.inject({
      method: 'GET',
      url: '/me/points',
      headers: { authorization: `Bearer ${residentToken}` },
    });
    const balanceBefore = beforeMe.json().data.balance.totalPoints;

    const res = await app.inject({
      method: 'POST',
      url: `/reviews/${reportId}/approve`,
      headers: { authorization: `Bearer ${maintainerToken}` },
      payload: {
        entityType: 'REPORT',
        reason: 'Confirmed toxic lead battery waste hazard. Field crew notified.',
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.decision).toBe('APPROVED');

    // Check report status is now VERIFIED
    const reportRes = await app.inject({
      method: 'GET',
      url: `/reports/${reportId}`,
    });
    expect(reportRes.json().data.status).toBe('VERIFIED');
    expect(reportRes.json().data.evidence[0].verificationStatus).toBe('VERIFIED');

    // Check points ledger awarded points
    const afterMe = await app.inject({
      method: 'GET',
      url: '/me/points',
      headers: { authorization: `Bearer ${residentToken}` },
    });
    const balanceAfter = afterMe.json().data.balance.totalPoints;
    expect(balanceAfter).toBe(balanceBefore + 20);

    const ledger = afterMe.json().data.ledger;
    const reportEntry = ledger.find((e: any) => e.referenceId === reportId);
    expect(reportEntry).toBeDefined();
    expect(reportEntry.source).toBe('VERIFIED_REPORT');
    expect(reportEntry.amount).toBe(20);
  });

  // 5. Duplicate verification -> no duplicate points
  it('5. should strictly prevent duplicate point rewards if approval is re-executed', async () => {
    const beforeMe = await app.inject({
      method: 'GET',
      url: '/me/points',
      headers: { authorization: `Bearer ${residentToken}` },
    });
    const balanceBefore = beforeMe.json().data.balance.totalPoints;

    // Call approve again on the same report
    const res = await app.inject({
      method: 'POST',
      url: `/reviews/${reportId}/approve`,
      headers: { authorization: `Bearer ${maintainerToken}` },
      payload: {
        entityType: 'REPORT',
        reason: 'Duplicate approval attempt',
      },
    });

    expect(res.statusCode).toBe(200);

    // Points balance must remain identical
    const afterMe = await app.inject({
      method: 'GET',
      url: '/me/points',
      headers: { authorization: `Bearer ${residentToken}` },
    });
    expect(afterMe.json().data.balance.totalPoints).toBe(balanceBefore);
  });

  // 6. Report rejection
  it('6. should allow maintainer to reject an invalid report without awarding points', async () => {
    // Create another report
    const repRes = await app.inject({
      method: 'POST',
      url: '/reports',
      headers: { authorization: `Bearer ${residentToken}` },
      payload: {
        communityId,
        category: 'OTHER',
        title: 'Frivolous report of normal tree leaves',
        description: 'Autumn leaves fallen naturally on ground.',
      },
    });
    const rejectedReportId = repRes.json().data.id;

    // Maintainer rejects
    const res = await app.inject({
      method: 'POST',
      url: `/reviews/${rejectedReportId}/reject`,
      headers: { authorization: `Bearer ${maintainerToken}` },
      payload: {
        entityType: 'REPORT',
        reason: 'Natural leaf fall does not constitute waste hazard.',
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.decision).toBe('REJECTED');

    const check = await app.inject({
      method: 'GET',
      url: `/reports/${rejectedReportId}`,
    });
    expect(check.json().data.status).toBe('REJECTED');
  });

  // 7. Field task lifecycle: Create, Assign, Complete, Verify
  it('7. should execute full task lifecycle: Create -> Assign -> Complete -> Verify and resolve incident', async () => {
    // Create task
    const createRes = await app.inject({
      method: 'POST',
      url: '/tasks',
      headers: { authorization: `Bearer ${maintainerToken}` },
      payload: {
        communityId,
        reportId,
        title: 'Dispatch Hazardous Material Recovery Crew',
        description: 'Safely box and transport dumped batteries to recycling facility.',
        priority: 'CRITICAL',
      },
    });

    expect(createRes.statusCode).toBe(201);
    taskId = createRes.json().data.id;
    expect(createRes.json().data.status).toBe('CREATED');

    // Assign task
    const assignRes = await app.inject({
      method: 'POST',
      url: `/tasks/${taskId}/assign`,
      headers: { authorization: `Bearer ${maintainerToken}` },
      payload: {
        assignedTo: maintainerUserId,
      },
    });

    expect(assignRes.statusCode).toBe(200);
    expect(assignRes.json().data.status).toBe('ASSIGNED');
    expect(assignRes.json().data.assignedTo).toBe(maintainerUserId);

    // Complete task
    const completeRes = await app.inject({
      method: 'POST',
      url: `/tasks/${taskId}/complete`,
      headers: { authorization: `Bearer ${maintainerToken}` },
      payload: {},
    });

    expect(completeRes.statusCode).toBe(200);
    expect(completeRes.json().data.status).toBe('COMPLETED');

    // Verify task (resolves the linked incident!)
    const verifyRes = await app.inject({
      method: 'POST',
      url: `/tasks/${taskId}/verify`,
      headers: { authorization: `Bearer ${maintainerToken}` },
      payload: {},
    });

    expect(verifyRes.statusCode).toBe(200);
    expect(verifyRes.json().data.status).toBe('VERIFIED');

    // Linked report should now be marked RESOLVED
    const reportCheck = await app.inject({
      method: 'GET',
      url: `/reports/${reportId}`,
    });
    expect(reportCheck.json().data.status).toBe('RESOLVED');
  });

  // 8. Community State calculation (4 dimensions)
  it('8. should calculate multidimensional community state (behaviour, participation, service, environmental)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/communities/${communityId}/state`,
    });

    expect(res.statusCode).toBe(200);
    const state = res.json().data;
    expect(state).toHaveProperty('behaviourScore');
    expect(state).toHaveProperty('participationScore');
    expect(state).toHaveProperty('serviceScore');
    expect(state).toHaveProperty('environmentalScore');
    expect(state).toHaveProperty('overallProgress');
    expect(state).toHaveProperty('trend');
    expect(state.weights).toEqual({
      behaviour: 0.25,
      participation: 0.25,
      service: 0.25,
      environmental: 0.25,
    });
    expect(state.overallProgress).toBeGreaterThanOrEqual(0);
    expect(state.overallProgress).toBeLessThanOrEqual(100);
  });

  // 9. Community Milestones and Timeline
  it('9. should return community milestones and dynamic event timeline', async () => {
    // Milestones
    const mRes = await app.inject({
      method: 'GET',
      url: `/communities/${communityId}/milestones`,
    });
    expect(mRes.statusCode).toBe(200);
    expect(mRes.json().data.length).toBeGreaterThanOrEqual(4);

    // Timeline
    const tRes = await app.inject({
      method: 'GET',
      url: `/communities/${communityId}/timeline`,
    });
    expect(tRes.statusCode).toBe(200);
    const timeline = tRes.json().data;
    expect(timeline.length).toBeGreaterThanOrEqual(1);
    expect(timeline[0]).toHaveProperty('title');
    expect(timeline[0]).toHaveProperty('category');
    expect(timeline[0]).toHaveProperty('timestamp');
  });

  // 10. Maintainer Operations Overview
  it('10. should return comprehensive maintainer operations summary', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/maintainer/operations?communityId=${communityId}`,
      headers: { authorization: `Bearer ${maintainerToken}` },
    });

    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    expect(data.status).toBe('ONLINE');
    expect(data).toHaveProperty('openIncidentsCount');
    expect(data).toHaveProperty('pendingReviewsCount');
    expect(data).toHaveProperty('activeTasksCount');
    expect(data).toHaveProperty('communityPulseScore');
  });
});
