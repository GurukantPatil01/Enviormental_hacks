import type {
  City,
  ClusterDetail,
  ClusterMetricPoint,
  ClusterSummary,
  GeoPoint,
  MapOverview,
  ResolvedLocation,
  Ward,
} from '@ecopulse/types';
import { pool } from '../db/index.js';
import { haversineDistanceM, isPointInPolygon } from '../utils/geo.utils.js';

/**
 * Geographic repository using standard PostgreSQL (JSONB + bounding coordinates)
 * with TypeScript ray-casting point-in-polygon containment and Haversine distance calculations.
 */

interface ClusterRow {
  id: string;
  community_id: string;
  community_name?: string;
  ward_id: string | null;
  ward_name?: string | null;
  code: string;
  name: string;
  description: string | null;
  center_lat: number;
  center_lng: number;
  boundary_geojson: any;
  member_count?: string | number;
}

export interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

function toPoint(row: { center_lat: number; center_lng: number }): GeoPoint {
  return { lat: Number(row.center_lat), lng: Number(row.center_lng) };
}

function parseGeoJson(val: any): Record<string, unknown> {
  if (!val) return { type: 'Polygon', coordinates: [] };
  if (typeof val === 'string') {
    try {
      return JSON.parse(val);
    } catch {
      return { type: 'Polygon', coordinates: [] };
    }
  }
  return val;
}

function mapCluster(row: ClusterRow): ClusterSummary {
  return {
    id: row.id,
    communityId: row.community_id,
    communityName: row.community_name ?? undefined,
    wardId: row.ward_id,
    wardName: row.ward_name ?? null,
    code: row.code,
    name: row.name,
    description: row.description,
    center: toPoint(row),
    boundaryGeoJson: parseGeoJson(row.boundary_geojson),
    memberCount: Number(row.member_count ?? 0),
  };
}

const CLUSTER_SELECT = `
  SELECT
    c.id,
    c.community_id,
    comm.name AS community_name,
    c.ward_id,
    w.name AS ward_name,
    c.code,
    c.name,
    c.description,
    c.center_lat,
    c.center_lng,
    c.boundary_geojson,
    (SELECT COUNT(*)::int FROM cluster_members cm WHERE cm.cluster_id = c.id) AS member_count
  FROM clusters c
  JOIN communities comm ON comm.id = c.community_id
  LEFT JOIN wards w ON w.id = c.ward_id
`;

export class GeoRepository {
  // ------------------------------------------------------------------
  // Hierarchy reads
  // ------------------------------------------------------------------
  async listCities(): Promise<City[]> {
    const { rows } = await pool.query<{
      id: string;
      name: string;
      code: string;
      state: string | null;
      country: string | null;
      center_lat: number | null;
      center_lng: number | null;
    }>(
      `SELECT id, name, code, state, country, center_lat, center_lng
       FROM cities ORDER BY name`
    );
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      code: r.code,
      state: r.state,
      country: r.country,
      center:
        r.center_lat != null && r.center_lng != null
          ? { lat: Number(r.center_lat), lng: Number(r.center_lng) }
          : null,
    }));
  }

  async listWards(cityId: string): Promise<Ward[]> {
    const { rows } = await pool.query<{
      id: string;
      city_id: string;
      name: string;
      code: string;
      center_lat: number | null;
      center_lng: number | null;
    }>(
      `SELECT id, city_id, name, code, center_lat, center_lng
       FROM wards WHERE city_id = $1 ORDER BY name`,
      [cityId]
    );
    return rows.map((r) => ({
      id: r.id,
      cityId: r.city_id,
      name: r.name,
      code: r.code,
      center:
        r.center_lat != null && r.center_lng != null
          ? { lat: Number(r.center_lat), lng: Number(r.center_lng) }
          : null,
    }));
  }

  // ------------------------------------------------------------------
  // Cluster reads
  // ------------------------------------------------------------------
  async listClusters(communityId?: string): Promise<ClusterSummary[]> {
    const { rows } = await pool.query<ClusterRow>(
      `${CLUSTER_SELECT}
       ${communityId ? 'WHERE c.community_id = $1' : ''}
       ORDER BY c.code`,
      communityId ? [communityId] : []
    );
    return rows.map(mapCluster);
  }

  async findClusterById(clusterId: string): Promise<ClusterSummary | null> {
    const { rows } = await pool.query<ClusterRow>(`${CLUSTER_SELECT} WHERE c.id = $1`, [clusterId]);
    if (rows.length === 0) return null;
    return mapCluster(rows[0]);
  }

  async findClusterByCode(code: string): Promise<ClusterSummary | null> {
    const { rows } = await pool.query<ClusterRow>(`${CLUSTER_SELECT} WHERE c.code = $1`, [code]);
    if (rows.length === 0) return null;
    return mapCluster(rows[0]);
  }

  /** Latest recorded value per metric key for a cluster. */
  async getLatestClusterMetrics(
    clusterId: string
  ): Promise<Record<string, number>> {
    const { rows } = await pool.query<{ metric_key: string; metric_value: number }>(
      `SELECT DISTINCT ON (metric_key) metric_key, metric_value
       FROM cluster_metrics
       WHERE cluster_id = $1
       ORDER BY metric_key, recorded_at DESC`,
      [clusterId]
    );
    const out: Record<string, number> = {};
    for (const r of rows) out[r.metric_key] = Number(r.metric_value);
    return out;
  }

  async getClusterMetricsHistory(clusterId: string, limit = 90): Promise<ClusterMetricPoint[]> {
    const { rows } = await pool.query<{
      metric_key: string;
      metric_value: number;
      period_start: string | null;
      recorded_at: Date;
    }>(
      `SELECT metric_key, metric_value, period_start, recorded_at
       FROM cluster_metrics
       WHERE cluster_id = $1
       ORDER BY recorded_at DESC
       LIMIT $2`,
      [clusterId, limit]
    );
    return rows.map((r) => ({
      metricKey: r.metric_key,
      value: Number(r.metric_value),
      periodStart: r.period_start ?? null,
      recordedAt: r.recorded_at.toISOString(),
    }));
  }

  // ------------------------------------------------------------------
  // Spatial resolution
  // ------------------------------------------------------------------

  /** Point-in-polygon containment for a cluster. */
  async findClusterContainingPoint(lat: number, lng: number): Promise<ClusterSummary | null> {
    // 1. Candidate prefilter by bounding box (or all active if bounds not populated)
    const { rows } = await pool.query<ClusterRow>(
      `${CLUSTER_SELECT}
       WHERE c.status = 'ACTIVE'
         AND (
           (c.min_lat IS NULL OR (c.min_lat <= $1 AND c.max_lat >= $1 AND c.min_lng <= $2 AND c.max_lng >= $2))
         )`,
      [lat, lng]
    );

    for (const row of rows) {
      const geoJson = parseGeoJson(row.boundary_geojson);
      if (isPointInPolygon({ lat, lng }, geoJson)) {
        return mapCluster(row);
      }
    }

    return null;
  }

  async findWardContainingPoint(lat: number, lng: number): Promise<Ward | null> {
    const { rows } = await pool.query<{
      id: string;
      city_id: string;
      name: string;
      code: string;
      center_lat: number | null;
      center_lng: number | null;
      boundary_geojson: any;
    }>(
      `SELECT id, city_id, name, code, center_lat, center_lng, boundary_geojson
       FROM wards
       WHERE boundary_geojson IS NOT NULL`
    );

    for (const r of rows) {
      const geoJson = parseGeoJson(r.boundary_geojson);
      if (isPointInPolygon({ lat, lng }, geoJson)) {
        return {
          id: r.id,
          cityId: r.city_id,
          name: r.name,
          code: r.code,
          center:
            r.center_lat != null && r.center_lng != null
              ? { lat: Number(r.center_lat), lng: Number(r.center_lng) }
              : null,
        };
      }
    }
    return null;
  }

  async findCityContainingPoint(lat: number, lng: number): Promise<City | null> {
    const { rows } = await pool.query<{
      id: string;
      name: string;
      code: string;
      state: string | null;
      country: string | null;
      center_lat: number | null;
      center_lng: number | null;
      boundary_geojson: any;
    }>(
      `SELECT id, name, code, state, country, center_lat, center_lng, boundary_geojson
       FROM cities
       WHERE boundary_geojson IS NOT NULL`
    );

    for (const r of rows) {
      const geoJson = parseGeoJson(r.boundary_geojson);
      if (isPointInPolygon({ lat, lng }, geoJson)) {
        return {
          id: r.id,
          name: r.name,
          code: r.code,
          state: r.state,
          country: r.country,
          center:
            r.center_lat != null && r.center_lng != null
              ? { lat: Number(r.center_lat), lng: Number(r.center_lng) }
              : null,
        };
      }
    }
    return null;
  }

  /**
   * Fallback when the point falls between polygons: nearest active cluster
   * center within `maxDistanceMeters` using Haversine calculation.
   */
  async findNearestCluster(
    lat: number,
    lng: number,
    maxDistanceMeters = 2000
  ): Promise<{ cluster: ClusterSummary; distanceMeters: number } | null> {
    const { rows } = await pool.query<ClusterRow>(
      `${CLUSTER_SELECT}
       WHERE c.status = 'ACTIVE'`
    );

    let nearest: ClusterRow | null = null;
    let minDistance = Infinity;

    for (const row of rows) {
      const d = haversineDistanceM({ lat, lng }, { lat: Number(row.center_lat), lng: Number(row.center_lng) });
      if (d < minDistance) {
        minDistance = d;
        nearest = row;
      }
    }

    if (!nearest || minDistance > maxDistanceMeters) {
      return null;
    }

    return {
      cluster: mapCluster(nearest),
      distanceMeters: Math.round(minDistance),
    };
  }

  async resolveLocation(lat: number, lng: number): Promise<ResolvedLocation> {
    const [cluster, ward, city] = await Promise.all([
      this.findClusterContainingPoint(lat, lng),
      this.findWardContainingPoint(lat, lng),
      this.findCityContainingPoint(lat, lng),
    ]);
    return { cluster, ward, city };
  }

  // ------------------------------------------------------------------
  // Map viewport query
  // ------------------------------------------------------------------
  async getMapOverview(bbox: BoundingBox): Promise<MapOverview> {
    // Overlapping clusters: check bounding box intersection or center point
    const clusterRows = await pool.query<ClusterRow>(
      `${CLUSTER_SELECT}
       WHERE c.status = 'ACTIVE'
         AND (
           (c.min_lat <= $2 AND c.max_lat >= $1 AND c.min_lng <= $4 AND c.max_lng >= $3)
           OR (c.center_lat BETWEEN $1 AND $2 AND c.center_lng BETWEEN $3 AND $4)
         )`,
      [bbox.minLat, bbox.maxLat, bbox.minLng, bbox.maxLng]
    );

    // Reports carry a JSONB Point. Privacy: only category/status/title/time +
    // location are exposed — never the reporter identity or street address.
    const reportRows = await pool.query<{
      id: string;
      category: string;
      status: string;
      title: string;
      lat: number;
      lng: number;
      cluster_code: string | null;
      created_at: Date;
    }>(
      `SELECT r.id, r.category, r.status, r.title,
              (r.location_geojson->'coordinates'->>1)::float8 AS lat,
              (r.location_geojson->'coordinates'->>0)::float8 AS lng,
              c.code AS cluster_code,
              r.created_at
       FROM reports r
       LEFT JOIN clusters c ON c.id = r.cluster_id
       WHERE r.location_geojson IS NOT NULL
         AND (r.location_geojson->'coordinates'->>1)::float8 BETWEEN $1 AND $2
         AND (r.location_geojson->'coordinates'->>0)::float8 BETWEEN $3 AND $4
       ORDER BY r.created_at DESC
       LIMIT 200`,
      [bbox.minLat, bbox.maxLat, bbox.minLng, bbox.maxLng]
    );

    const clusters = clusterRows.rows.map(mapCluster);
    // Attach live counts + latest metrics to map clusters
    for (const cluster of clusters) {
      const [counts] = (await pool.query<{
        open_reports: string;
        active_missions: string;
      }>(
        `SELECT
           (SELECT COUNT(*) FROM reports r WHERE r.cluster_id = $1 AND r.status IN ('SUBMITTED','UNDER_REVIEW','VERIFIED')) AS open_reports,
           (SELECT COUNT(*) FROM missions m WHERE m.cluster_id = $1 AND m.status = 'ACTIVE') AS active_missions`,
        [cluster.id]
      )).rows;
      cluster.openReportsCount = Number(counts?.open_reports ?? 0);
      cluster.activeMissionsCount = Number(counts?.active_missions ?? 0);
      const metrics = await this.getLatestClusterMetrics(cluster.id);
      if (Object.keys(metrics).length > 0) {
        cluster.metrics = {
          environment: metrics.environment,
          participation: metrics.participation,
          service: metrics.service,
          incidentsOpen: metrics.incidents_open,
          progress: metrics.progress,
        };
      }
    }

    return {
      clusters,
      reports: reportRows.rows.map((r) => ({
        id: r.id,
        category: r.category,
        status: r.status,
        title: r.title,
        lat: Number(r.lat),
        lng: Number(r.lng),
        clusterCode: r.cluster_code,
        createdAt: r.created_at.toISOString(),
      })),
      viewport: bbox,
    };
  }

  // ------------------------------------------------------------------
  // Membership
  // ------------------------------------------------------------------
  async joinCluster(clusterId: string, userId: string): Promise<void> {
    await pool.query(
      `INSERT INTO cluster_members (cluster_id, user_id, is_primary)
       VALUES ($1, $2, TRUE)
       ON CONFLICT (cluster_id, user_id) DO NOTHING`,
      [clusterId, userId]
    );
  }

  async findUserPrimaryClusterId(userId: string): Promise<string | null> {
    const { rows } = await pool.query<{ cluster_id: string }>(
      `SELECT cluster_id FROM cluster_members WHERE user_id = $1 AND is_primary = TRUE LIMIT 1`,
      [userId]
    );
    return rows[0]?.cluster_id ?? null;
  }

  /**
   * Attach geographic anchors to a report based on its GeoJSON Point.
   * Returns resolved ids (best effort — null when location is unknown).
   */
  async resolveReportGeography(
    lat: number,
    lng: number
  ): Promise<{ wardId: string | null; clusterId: string | null }> {
    const resolved = await this.resolveLocation(lat, lng);
    return { wardId: resolved.ward?.id ?? null, clusterId: resolved.cluster?.id ?? null };
  }
}

export const geoRepository = new GeoRepository();
