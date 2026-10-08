import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { pool } from '../src/db/index.js';
import { runMigrations } from '../src/db/migrate.js';
import { seed } from '../src/db/seed.js';

describe('App & Web Operations Portal Bi-directional Communication', () => {
  let app: FastifyInstance;
  let residentToken: string;
  let residentUserId: string;
  let communityId: string;
  let createdReportId: string;

  beforeAll(async () => {
    await runMigrations();
    await seed();

    app = buildApp();
    await app.ready();

    // Login as demo resident (citizen app user)
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

  it('1. Citizen creates a report in mobile app and it immediately syncs to Operations portal telemetry', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/reports',
      headers: {
        authorization: `Bearer ${residentToken}`,
      },
      payload: {
        communityId,
        category: 'WASTE_HOTSPOT',
        title: 'Overflowing dumpster at Kothrud Depot',
        description: 'Large pile of non-segregated municipal refuse blocking pedestrian footpath.',
        locationAddress: 'Kothrud Bus Stand, Pune',
        locationGeoJson: {
          lat: 18.5074,
          lng: 73.8077,
        },
      },
    });

    expect(createRes.statusCode).toBe(201);
    const reportData = createRes.json().data;
    expect(reportData.id).toBeDefined();
    expect(reportData.status).toBe('SUBMITTED');
    createdReportId = reportData.id;

    // Verify it is immediately visible in the Operations Portal events query
    const eventsRes = await app.inject({
      method: 'GET',
      url: '/api/intelligence/events',
    });

    expect(eventsRes.statusCode).toBe(200);
    const events = eventsRes.json().data;
    const syncedEvent = events.find((e: any) => e.reportId === createdReportId);
    expect(syncedEvent).toBeDefined();
    expect(syncedEvent.latitude).toBeCloseTo(18.5074, 3);
    expect(syncedEvent.longitude).toBeCloseTo(73.8077, 3);
    expect(syncedEvent.status).toBe('SUBMITTED');
  });

  it('2. Operations maintainer verifies the event from the web portal, updating the citizen report & awarding points', async () => {
    // Operations portal calls event status update
    const verifyRes = await app.inject({
      method: 'POST',
      url: `/api/intelligence/events/${createdReportId}/status`,
      payload: {
        status: 'VERIFIED',
        reviewerId: 'operator-station-1',
      },
    });

    expect(verifyRes.statusCode).toBe(200);

    // Verify report in mobile app view is now VERIFIED
    const reportCheck = await app.inject({
      method: 'GET',
      url: `/reports/${createdReportId}`,
      headers: {
        authorization: `Bearer ${residentToken}`,
      },
    });

    expect(reportCheck.statusCode).toBe(200);
    expect(reportCheck.json().data.status).toBe('VERIFIED');

    // Verify citizen EcoPoints were authoritatively awarded into the ledger
    const ledgerCheck = await app.inject({
      method: 'GET',
      url: '/me/points',
      headers: {
        authorization: `Bearer ${residentToken}`,
      },
    });

    expect(ledgerCheck.statusCode).toBe(200);
    expect(ledgerCheck.json().data.balance.totalPoints).toBeGreaterThan(0);
  });
});
