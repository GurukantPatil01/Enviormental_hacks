import crypto from 'node:crypto';
import type { Hotspot } from '@ecopulse/types';
import { pool } from '../db/index.js';
import { haversineDistanceMeters } from '../repositories/vector.repository.js';

export interface HotspotConfig {
  radiusMeters: number;
  minReports: number;
  timeWindowDays: number;
  escalationThreshold: number;
}

export const DEFAULT_HOTSPOT_CONFIG: HotspotConfig = {
  radiusMeters: Number(process.env.HOTSPOT_RADIUS_METERS || 500),
  minReports: Number(process.env.HOTSPOT_MIN_REPORTS || 2),
  timeWindowDays: Number(process.env.HOTSPOT_TIME_WINDOW_DAYS || 14),
  escalationThreshold: Number(process.env.HOTSPOT_ESCALATION_THRESHOLD || 40.0),
};

export interface RawEventPoint {
  id: string;
  latitude: number;
  longitude: number;
  severity: string;
  wasteType: string;
  status: string;
  timestamp: Date | string;
}

/**
 * Deterministic Hotspot Analysis Engine for Indian Urban Environments.
 *
 * Algorithm Workflow:
 * 1. Filter events within sliding temporal window (default: 14 days).
 * 2. Spatial Neighborhood Detection: Cluster nearby events within radius R (default: 500m) using distance metrics.
 * 3. Centroid & Boundary Computation: Calculate geographic center (lat, lng) and actual convex bounding circle.
 * 4. Severity Weighting: Low=1, Medium=2, High=3, Critical=5.
 * 5. Temporal Trend Analysis: Measure event velocity (first half vs second half of window).
 * 6. Composite Threat Score:
 *    Score = (Count * 5) + (AvgSeverity * 12) + (Unresolved * 6) * RecencyMultiplier
 */
export class HotspotAnalyzer {
  private config: HotspotConfig;

  constructor(config: Partial<HotspotConfig> = {}) {
    this.config = { ...DEFAULT_HOTSPOT_CONFIG, ...config };
  }

  calculateHotspotScore(events: RawEventPoint[]): number {
    if (events.length === 0) return 0;

    let severitySum = 0;
    let unresolvedCount = 0;
    const now = Date.now();
    let recentCount = 0;

    for (const ev of events) {
      const sev = (ev.severity || 'LOW').toUpperCase();
      let weight = 1;
      if (sev === 'CRITICAL') weight = 5;
      else if (sev === 'HIGH') weight = 3;
      else if (sev === 'MEDIUM') weight = 2;

      severitySum += weight;

      const st = (ev.status || '').toUpperCase();
      if (st !== 'RESOLVED' && st !== 'CLOSED') {
        unresolvedCount++;
      }

      const eventTime = new Date(ev.timestamp).getTime();
      // Within last 3 days
      if (now - eventTime < 3 * 24 * 60 * 60 * 1000) {
        recentCount++;
      }
    }

    const avgSeverity = severitySum / events.length;
    const recencyMultiplier = recentCount > 0 ? 1.0 + (recentCount / events.length) * 0.5 : 1.0;

    const baseScore = events.length * 5 + avgSeverity * 12 + unresolvedCount * 6;
    return Number((baseScore * recencyMultiplier).toFixed(2));
  }

  getHotspotTrend(events: RawEventPoint[]): 'INCREASING' | 'STABLE' | 'DECREASING' {
    if (events.length < 3) return 'STABLE';

    const now = Date.now();
    const halfWindow = (this.config.timeWindowDays * 24 * 60 * 60 * 1000) / 2;

    let firstHalfCount = 0;
    let secondHalfCount = 0;

    for (const ev of events) {
      const time = new Date(ev.timestamp).getTime();
      const age = now - time;
      if (age <= halfWindow) {
        secondHalfCount++; // recent half
      } else {
        firstHalfCount++; // older half
      }
    }

    if (secondHalfCount >= firstHalfCount * 1.5) return 'INCREASING';
    if (secondHalfCount <= firstHalfCount * 0.6) return 'DECREASING';
    return 'STABLE';
  }

  async detectHotspots(overrideConfig?: Partial<HotspotConfig>): Promise<Hotspot[]> {
    const cfg = { ...this.config, ...overrideConfig };
    const cutoffDate = new Date(Date.now() - cfg.timeWindowDays * 24 * 60 * 60 * 1000).toISOString();

    // 1. Fetch active environmental events & reports
    const eventsRes = await pool.query<RawEventPoint>(
      `
      SELECT 
        id,
        latitude,
        longitude,
        COALESCE(severity, 'LOW') as severity,
        COALESCE(event_type, 'WASTE_HOTSPOT') as "wasteType",
        COALESCE(status, 'REPORTED') as status,
        COALESCE(timestamp, created_at) as timestamp
      FROM environmental_events
      WHERE COALESCE(timestamp, created_at) >= $1
      ORDER BY timestamp DESC
      `,
      [cutoffDate]
    );

    const points = eventsRes.rows.filter(
      (p) => p.latitude && p.longitude && !isNaN(Number(p.latitude)) && !isNaN(Number(p.longitude))
    );

    // 2. Spatial neighborhood clustering
    const clusters: RawEventPoint[][] = [];
    const visited = new Set<string>();

    for (const p of points) {
      if (visited.has(p.id)) continue;

      const cluster: RawEventPoint[] = [p];
      visited.add(p.id);

      for (const other of points) {
        if (visited.has(other.id)) continue;

        const dist = haversineDistanceMeters(
          Number(p.latitude),
          Number(p.longitude),
          Number(other.latitude),
          Number(other.longitude)
        );

        if (dist <= cfg.radiusMeters) {
          cluster.push(other);
          visited.add(other.id);
        }
      }

      if (cluster.length >= cfg.minReports) {
        clusters.push(cluster);
      }
    }

    // 3. Convert clusters into Hotspot domain entities and persist
    const detectedHotspots: Hotspot[] = [];

    for (const cluster of clusters) {
      let latSum = 0;
      let lngSum = 0;
      const wasteTypeCounts: Record<string, number> = {};
      let firstDetected = new Date().toISOString();
      let lastDetected = new Date(0).toISOString();

      for (const ev of cluster) {
        latSum += Number(ev.latitude);
        lngSum += Number(ev.longitude);
        wasteTypeCounts[ev.wasteType] = (wasteTypeCounts[ev.wasteType] || 0) + 1;

        const evTime = new Date(ev.timestamp).toISOString();
        if (evTime < firstDetected) firstDetected = evTime;
        if (evTime > lastDetected) lastDetected = evTime;
      }

      const centerLat = Number((latSum / cluster.length).toFixed(6));
      const centerLng = Number((lngSum / cluster.length).toFixed(6));

      let dominantWasteType = 'WASTE_HOTSPOT';
      let maxCount = 0;
      for (const [wt, c] of Object.entries(wasteTypeCounts)) {
        if (c > maxCount) {
          dominantWasteType = wt;
          maxCount = c;
        }
      }

      const score = this.calculateHotspotScore(cluster);
      const trend = this.getHotspotTrend(cluster);
      const status: 'ACTIVE' | 'INVESTIGATING' = score >= cfg.escalationThreshold ? 'ACTIVE' : 'INVESTIGATING';

      // Persist or update hotspot in DB
      const res = await pool.query(
        `
        INSERT INTO hotspots (
          center_latitude, center_longitude, radius, report_count,
          average_severity, dominant_waste_type, trend, score, status,
          first_detected_at, last_detected_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
        `,
        [
          centerLat,
          centerLng,
          cfg.radiusMeters,
          cluster.length,
          Number((score / cluster.length / 5).toFixed(2)),
          dominantWasteType,
          trend,
          score,
          status,
          firstDetected,
          lastDetected,
        ]
      );

      const row = res.rows[0];
      detectedHotspots.push({
        id: row.id,
        centerLatitude: Number(row.center_latitude),
        centerLongitude: Number(row.center_longitude),
        radius: Number(row.radius),
        reportCount: row.report_count,
        averageSeverity: Number(row.average_severity),
        dominantWasteType: row.dominant_waste_type,
        trend: row.trend,
        score: Number(row.score),
        status: row.status,
        firstDetectedAt: new Date(row.first_detected_at).toISOString(),
        lastDetectedAt: new Date(row.last_detected_at).toISOString(),
      });
    }

    return detectedHotspots;
  }

  async getHotspots(filters?: { status?: string; minScore?: number }): Promise<Hotspot[]> {
    let query = `SELECT * FROM hotspots WHERE 1=1`;
    const params: any[] = [];

    if (filters?.status) {
      params.push(filters.status);
      query += ` AND status = $${params.length}`;
    }

    if (filters?.minScore !== undefined) {
      params.push(filters.minScore);
      query += ` AND score >= $${params.length}`;
    }

    query += ` ORDER BY score DESC, last_detected_at DESC LIMIT 50`;

    const res = await pool.query(query, params);
    return res.rows.map((row) => ({
      id: row.id,
      centerLatitude: Number(row.center_latitude),
      centerLongitude: Number(row.center_longitude),
      radius: Number(row.radius),
      reportCount: row.report_count,
      averageSeverity: Number(row.average_severity),
      dominantWasteType: row.dominant_waste_type,
      trend: row.trend,
      score: Number(row.score),
      status: row.status,
      firstDetectedAt: new Date(row.first_detected_at).toISOString(),
      lastDetectedAt: new Date(row.last_detected_at).toISOString(),
    }));
  }

  async getHotspotById(id: string): Promise<Hotspot | null> {
    const res = await pool.query(`SELECT * FROM hotspots WHERE id = $1`, [id]);
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      id: row.id,
      centerLatitude: Number(row.center_latitude),
      centerLongitude: Number(row.center_longitude),
      radius: Number(row.radius),
      reportCount: row.report_count,
      averageSeverity: Number(row.average_severity),
      dominantWasteType: row.dominant_waste_type,
      trend: row.trend,
      score: Number(row.score),
      status: row.status,
      firstDetectedAt: new Date(row.first_detected_at).toISOString(),
      lastDetectedAt: new Date(row.last_detected_at).toISOString(),
    };
  }

  async updateHotspotStatus(hotspotId: string, status: string): Promise<Hotspot | null> {
    const res = await pool.query(
      `UPDATE hotspots SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, hotspotId]
    );
    if (res.rows.length === 0) return null;
    return this.getHotspotById(hotspotId);
  }
}

export const hotspotAnalyzer = new HotspotAnalyzer();
