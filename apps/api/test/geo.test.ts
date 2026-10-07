import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { pool } from '../src/db/index.js';
import { runMigrations } from '../src/db/migrate.js';
import { seed } from '../src/db/seed.js';

/**
 * Phase 1 — Geographic foundation + auth hardening tests.
 * Runs against real Postgres with PostGIS (migrations + seed).
 */
describe('EcoPulse Phase 1: Geographic Foundation & Auth Hardening', () => {
  let app: FastifyInstance;
  let residentToken: string;
  let residentUserId: string;
  let communityId: string;
  let clusterKTH01: string;

  // Coordinates inside KTH-01 (73.795-73.81, 18.495-18.51) and DEC-01
  const KTH01_POINT = { lat: 18.502, lng: 73.8 };
  const DEC01_POINT = { lat: 18.517, lng: 73.84 };
  const NOWHERE_POINT = { lat: 18.62, lng: 73.71 }; // outside all polygons

  beforeAll(async () => {
    await runMigrations();
    await seed();

    app = buildApp();
    await app.ready();

    const rRes = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'priya.sharma@example.com', password: 'password123' },
    });
    residentToken = rRes.json().data.token;
    residentUserId = rRes.json().data.user.id;

    const cRes = await app.inject({ method: 'GET', url: '/communities' });
    communityId = cRes.json().data[0].id;

    const clustersRes = await app.inject({ method: 'GET', url: '/geo/clusters' });
    const clusters = clustersRes.json().data;
    clusterKTH01 = clusters.find((c: any) => c.code === 'KTH-01').id;
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  // ---------------------------------------------------------------
  // AUTH HARDENING (Rule 1)
  // ---------------------------------------------------------------
  it('AUTH-1: public signup always creates a RESIDENT even when a privileged role is submitted', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        email: `attacker.${Date.now()}@evil.example.com`,
        password: 'Password123!',
        fullName: 'Role Escalation Attempt',
        role: 'SUPER_ADMIN',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json().data;
    expect(body.user.role).toBe('RESIDENT');

    // And the freshly created "admin" must NOT access maintainer endpoints
    const maintainerAttempt = await app.inject({
      method: 'GET',
      url: '/maintainer/operations',
      headers: { authorization: `Bearer ${body.token}` },
    });
    expect(maintainerAttempt.statusCode).toBe(403);
  });

  it('AUTH-2: MAINTAINER role submission is also neutralized', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        email: `wannabe.${Date.now()}@example.com`,
        password: 'Password123!',
        fullName: 'Self Assigned Maintainer',
        role: 'MAINTAINER',
      },
    });
    expect(res.json().data.user.role).toBe('RESIDENT');
  });

  // ---------------------------------------------------------------
  // GEO HIERARCHY
  // ---------------------------------------------------------------
  it('GEO-1: exposes the city → ward hierarchy', async () => {
    const citiesRes = await app.inject({ method: 'GET', url: '/geo/cities' });
    expect(citiesRes.statusCode).toBe(200);
    const cities = citiesRes.json().data;
    expect(cities.length).toBeGreaterThanOrEqual(1);

    const pune = cities.find((c: any) => c.code === 'PUNE');
    expect(pune).toBeDefined();
    expect(pune.center).toMatchObject({ lat: expect.any(Number), lng: expect.any(Number) });

    const wardsRes = await app.inject({ method: 'GET', url: `/geo/cities/${pune.id}/wards` });
    expect(wardsRes.statusCode).toBe(200);
    const wards = wardsRes.json().data;
    expect(wards.map((w: any) => w.code)).toEqual(expect.arrayContaining(['KTH', 'DEC']));
  });

  it('GEO-2: lists clusters with boundaries, centers and member counts', async () => {
    const res = await app.inject({ method: 'GET', url: `/geo/clusters?communityId=${communityId}` });
    expect(res.statusCode).toBe(200);
    const clusters = res.json().data;
    expect(clusters.length).toBeGreaterThanOrEqual(6);

    const kth01 = clusters.find((c: any) => c.code === 'KTH-01');
    clusterKTH01 = kth01.id;
    expect(kth01.name).toBe('Kothrud Green Corridor');
    expect(kth01.memberCount).toBeGreaterThan(0);
    expect(kth01.boundaryGeoJson.type).toBe('Polygon');
    expect(kth01.center).toMatchObject({ lat: expect.any(Number), lng: expect.any(Number) });
  });

  it('GEO-3: resolves a point inside KTH-01 to that cluster (point-in-polygon)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/geo/resolve-location',
      headers: { authorization: `Bearer ${residentToken}` },
      payload: KTH01_POINT,
    });
    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    expect(data.cluster?.code).toBe('KTH-01');
    expect(data.ward?.code).toBe('KTH');
    expect(data.city?.code).toBe('PUNE');
  });

  it('GEO-4: resolves a Deccan point to DEC-01, not Kothrud clusters', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/geo/resolve-location',
      headers: { authorization: `Bearer ${residentToken}` },
      payload: DEC01_POINT,
    });
    expect(res.json().data.cluster?.code).toBe('DEC-01');
  });

  it('GEO-5: point outside all polygons falls back to nearest cluster or null gracefully', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/geo/resolve-location',
      headers: { authorization: `Bearer ${residentToken}` },
      payload: NOWHERE_POINT,
    });
    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    // Either null or a nearest-cluster fallback — never a wrong containment
    if (data.cluster) {
      expect(['KTH-01', 'KTH-02', 'KTH-03', 'KTH-04', 'DEC-01', 'DEC-02']).toContain(data.cluster.code);
    } else {
      expect(data.cluster).toBeNull();
    }
  });

  it('GEO-6: rejects invalid coordinates', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/geo/resolve-location',
      headers: { authorization: `Bearer ${residentToken}` },
      payload: { lat: 999, lng: 'not-a-number' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('GEO-7: resolve-location requires authentication', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/geo/resolve-location',
      payload: KTH01_POINT,
    });
    expect(res.statusCode).toBe(401);
  });

  // ---------------------------------------------------------------
  // MAP
  // ---------------------------------------------------------------
  it('MAP-1: returns clusters and report signals within the default viewport', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/map/overview',
      headers: { authorization: `Bearer ${residentToken}` },
    });
    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    expect(data.clusters.length).toBeGreaterThanOrEqual(6);
    expect(Array.isArray(data.reports)).toBe(true);
    expect(data.viewport).toMatchObject({ minLat: expect.any(Number) });

    const kth01 = data.clusters.find((c: any) => c.code === 'KTH-01');
    expect(kth01).toBeDefined();
    expect(kth01.metrics).toBeDefined();
    expect(kth01.metrics.environment).toBeGreaterThan(0);
  });

  it('MAP-2: honors viewport filtering (bbox)', async () => {
    // Tiny viewport around DEC-02 only
    const res = await app.inject({
      method: 'GET',
      url: '/map/overview?minLat=18.513&maxLat=18.521&minLng=73.849&maxLng=73.859',
      headers: { authorization: `Bearer ${residentToken}` },
    });
    const data = res.json().data;
    const codes = data.clusters.map((c: any) => c.code);
    expect(codes).toContain('DEC-02');
    expect(codes).not.toContain('KTH-01');
  });

  it('MAP-3: map report signals never expose reporter identity or address', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/map/overview',
      headers: { authorization: `Bearer ${residentToken}` },
    });
    const reports = res.json().data.reports;
    for (const r of reports) {
      expect(Object.keys(r)).toEqual(
        expect.arrayContaining(['id', 'category', 'status', 'title', 'lat', 'lng'])
      );
      expect(Object.keys(r)).not.toContain('userId');
      expect(Object.keys(r)).not.toContain('locationAddress');
      expect(JSON.stringify(r)).not.toMatch(/user_id|uploader/i);
    }
  });

  it('MAP-4: map overview requires authentication', async () => {
    const res = await app.inject({ method: 'GET', url: '/map/overview' });
    expect(res.statusCode).toBe(401);
  });

  // ---------------------------------------------------------------
  // CLUSTER DETAIL & MEMBERSHIP
  // ---------------------------------------------------------------
  it('CLUSTER-1: returns detail with metrics, milestone and recent activity', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/clusters/${clusterKTH01}?history=true`,
    });
    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    expect(data.code).toBe('KTH-01');
    expect(data.metrics).toBeDefined();
    expect(data.metricsHistory.length).toBeGreaterThan(0);
    expect(data.memberCount).toBeGreaterThan(0);
  });

  it('CLUSTER-2: 404 for unknown cluster', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/clusters/00000000-0000-0000-0000-000000000000',
    });
    expect(res.statusCode).toBe(404);
  });

  it('CLUSTER-3: user can join a cluster and it becomes their primary', async () => {
    const joinRes = await app.inject({
      method: 'POST',
      url: `/clusters/${clusterKTH01}/join`,
      headers: { authorization: `Bearer ${residentToken}` },
    });
    expect(joinRes.statusCode).toBe(200);
    expect(joinRes.json().data.success).toBe(true);

    const meClusterRes = await app.inject({
      method: 'GET',
      url: '/me/cluster',
      headers: { authorization: `Bearer ${residentToken}` },
    });
    expect(meClusterRes.statusCode).toBe(200);
    expect(meClusterRes.json().data.code).toBe('KTH-01');
  });

  it('CLUSTER-4: cluster detail exposes no member PII', async () => {
    const res = await app.inject({ method: 'GET', url: `/clusters/${clusterKTH01}` });
    const text = JSON.stringify(res.json());
    expect(text).not.toMatch(/"email"|"full_name"|"fullName"/);
  });
});
