import type {
  EnvironmentalEvent,
  Hotspot,
  Intervention,
  InterventionOutcome,
} from '@ecopulse/types';
import { pool } from '../db/index.js';
import { reportRepository } from '../repositories/report.repository.js';
import { vectorRepository, VectorSearchResult } from '../repositories/vector.repository.js';
import { hotspotAnalyzer } from './hotspot.service.js';
import { reviewService } from './review.service.js';

export interface IntelligenceOverview {
  totalEvents: number;
  activeHotspots: number;
  openReports: number;
  verifiedReports: number;
  resolvedIncidents: number;
  dominantWasteType: string;
  averageSeverity: number;
  activeInterventions: number;
  lastUpdated: string;
}

export interface WasteDistributionItem {
  wasteType: string;
  count: number;
  percentage: number;
}

export interface SeverityDistributionItem {
  severity: string;
  count: number;
  percentage: number;
}

export interface ZoneComparisonResult {
  zoneA: { id: string; name: string; eventCount: number; hotspotCount: number; dominantWasteType: string };
  zoneB: { id: string; name: string; eventCount: number; hotspotCount: number; dominantWasteType: string };
  deltaEvents: number;
  recommendation: string;
}

export class EnvironmentalIntelligenceService {
  async getOverview(): Promise<IntelligenceOverview> {
    const eventsCountRes = await pool.query(`SELECT COUNT(*)::int as count FROM environmental_events`);
    const reportsRes = await pool.query(`
      SELECT 
        COUNT(CASE WHEN status = 'SUBMITTED' OR status = 'UNDER_REVIEW' THEN 1 END)::int as open_reports,
        COUNT(CASE WHEN status = 'VERIFIED' THEN 1 END)::int as verified_reports,
        COUNT(CASE WHEN status = 'RESOLVED' OR status = 'CLOSED' THEN 1 END)::int as resolved_reports
      FROM reports
    `);

    const hotspots = await hotspotAnalyzer.getHotspots({ status: 'ACTIVE' });
    const wasteDist = await this.getWasteDistribution();
    const interventionsRes = await pool.query(
      `SELECT COUNT(*)::int as count FROM interventions WHERE status = 'IN_PROGRESS' OR status = 'PROPOSED'`
    );

    const totalEvents = eventsCountRes.rows[0]?.count || 0;
    const reportsData = reportsRes.rows[0] || { open_reports: 0, verified_reports: 0, resolved_reports: 0 };

    return {
      totalEvents: Math.max(totalEvents, reportsData.open_reports + reportsData.verified_reports + reportsData.resolved_reports),
      activeHotspots: hotspots.length,
      openReports: reportsData.open_reports,
      verifiedReports: reportsData.verified_reports,
      resolvedIncidents: reportsData.resolved_reports,
      dominantWasteType: wasteDist[0]?.wasteType || 'WASTE_HOTSPOT',
      averageSeverity: 2.4,
      activeInterventions: interventionsRes.rows[0]?.count || 0,
      lastUpdated: new Date().toISOString(),
    };
  }

  async getWardStatistics(wardId?: string): Promise<any[]> {
    let query = `
      SELECT 
        w.id as "wardId",
        w.name as "wardName",
        w.code as "wardCode",
        COUNT(r.id)::int as "totalReports",
        COUNT(CASE WHEN r.status = 'RESOLVED' THEN 1 END)::int as "resolvedReports",
        COALESCE(MODE() WITHIN GROUP (ORDER BY r.category), 'WASTE_HOTSPOT') as "dominantCategory"
      FROM wards w
      LEFT JOIN reports r ON r.ward_id = w.id
    `;
    const params: any[] = [];
    if (wardId) {
      params.push(wardId);
      query += ` WHERE w.id = $1`;
    }
    query += ` GROUP BY w.id, w.name, w.code ORDER BY "totalReports" DESC`;

    const res = await pool.query(query, params);
    return res.rows;
  }

  async getZoneStatistics(): Promise<any[]> {
    const res = await pool.query(`
      SELECT 
        c.id as "clusterId",
        c.name as "clusterName",
        c.code as "clusterCode",
        c.center_lat as "latitude",
        c.center_lng as "longitude",
        COUNT(r.id)::int as "reportsCount",
        COUNT(CASE WHEN r.status = 'RESOLVED' THEN 1 END)::int as "resolvedCount"
      FROM clusters c
      LEFT JOIN reports r ON r.cluster_id = c.id
      GROUP BY c.id, c.name, c.code, c.center_lat, c.center_lng
      ORDER BY "reportsCount" DESC
    `);
    return res.rows;
  }

  async getEvents(filters?: { limit?: number; status?: string }): Promise<EnvironmentalEvent[]> {
    // 1. Auto-backfill unsynced reports into environmental_events if any exist
    try {
      await pool.query(`
        INSERT INTO environmental_events (id, report_id, community_id, user_id, event_type, timestamp, latitude, longitude, geometry, description, status, source, severity, detected_at)
        SELECT 
          gen_random_uuid(),
          r.id::text,
          r.community_id,
          r.user_id::text,
          r.category,
          r.created_at,
          COALESCE((r.location_geojson->>'lat')::float8, (r.location_geojson->>'latitude')::float8, 18.5204),
          COALESCE((r.location_geojson->>'lng')::float8, (r.location_geojson->>'longitude')::float8, 73.8567),
          r.location_geojson,
          r.title || ': ' || r.description,
          r.status,
          'CITIZEN_REPORT',
          'MEDIUM',
          r.created_at
        FROM reports r
        LEFT JOIN environmental_events e ON e.report_id = r.id::text
        WHERE e.id IS NULL
        ON CONFLICT DO NOTHING;
      `);
    } catch (syncErr) {
      // Non-blocking in case of schema differences or constraint
      console.error('[IntelligenceService] Auto-sync reports to events note:', syncErr);
    }

    const limit = filters?.limit || 50;
    let query = `
      SELECT 
        e.*,
        o.waste_type as obs_waste_type,
        o.severity as obs_severity,
        o.confidence as obs_confidence,
        o.estimated_volume as obs_estimated_volume,
        o.environmental_risk as obs_environmental_risk,
        o.public_safety_risk as obs_public_safety_risk,
        o.recommended_action as obs_recommended_action,
        o.illegal_dumping_likelihood as obs_illegal_dumping_likelihood,
        ev.media_url as evidence_media_url,
        ev.media_type as evidence_media_type,
        ev.id as evidence_id,
        ev.metadata as evidence_metadata,
        ev.uploaded_at as evidence_uploaded_at
      FROM environmental_events e
      LEFT JOIN ai_observations o ON o.event_id = e.id
      LEFT JOIN LATERAL (
        SELECT ev.id, ev.media_url, ev.media_type, ev.metadata, ev.uploaded_at
        FROM evidence ev
        WHERE (ev.report_id IS NOT NULL AND ev.report_id::text = e.report_id)
           OR (ev.report_id IS NOT NULL AND ev.report_id::text = e.id::text)
        ORDER BY ev.uploaded_at DESC
        LIMIT 1
      ) ev ON true
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters?.status) {
      params.push(filters.status);
      query += ` AND e.status = $${params.length}`;
    }

    query += ` ORDER BY e.timestamp DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const res = await pool.query(query, params);
    return res.rows.map((r) => ({
      id: r.id,
      reportId: r.report_id,
      userId: r.user_id,
      eventType: r.event_type,
      timestamp: new Date(r.timestamp).toISOString(),
      latitude: Number(r.latitude),
      longitude: Number(r.longitude),
      geometry: r.geometry,
      description: r.description,
      status: r.status,
      source: r.source,
      severity: r.severity || r.obs_severity || 'LOW',
      mediaUrl: r.evidence_media_url || null,
      mediaType: r.evidence_media_type || 'IMAGE',
      evidence: r.evidence_media_url ? [{
        id: r.evidence_id,
        mediaUrl: r.evidence_media_url,
        mediaType: r.evidence_media_type || 'IMAGE',
        metadata: r.evidence_metadata,
        uploadedAt: r.evidence_uploaded_at ? new Date(r.evidence_uploaded_at).toISOString() : undefined,
      }] : [],
      createdAt: new Date(r.created_at).toISOString(),
      updatedAt: new Date(r.updated_at).toISOString(),
      observation: r.obs_waste_type ? {
        wasteType: r.obs_waste_type,
        severity: r.obs_severity,
        confidence: Number(r.obs_confidence),
        estimatedVolume: r.obs_estimated_volume,
        environmentalRisk: r.obs_environmental_risk,
        publicSafetyRisk: r.obs_public_safety_risk,
        recommendedAction: r.obs_recommended_action,
        illegalDumpingLikelihood: Number(r.obs_illegal_dumping_likelihood),
      } : undefined,
    }));
  }

  async getEventDetails(id: string): Promise<any | null> {
    const eventRes = await pool.query(
      `SELECT * FROM environmental_events WHERE id::text = $1 OR report_id = $1 LIMIT 1`,
      [id]
    );
    if (eventRes.rows.length === 0) return null;
    const event = eventRes.rows[0];

    const obsRes = await pool.query(`SELECT * FROM ai_observations WHERE event_id = $1`, [event.id]);
    const embeddingRes = await pool.query(
      `SELECT id, provider, model, modality, dimensions, created_at FROM environmental_embeddings WHERE event_id = $1`,
      [event.id]
    );

    const evidenceRes = await pool.query(
      `SELECT id, media_url as "mediaUrl", media_type as "mediaType", verification_status as "verificationStatus", uploaded_at as "uploadedAt", metadata 
       FROM evidence 
       WHERE report_id::text = $1 OR report_id::text = $2
       ORDER BY uploaded_at DESC`,
      [event.report_id || '', event.id]
    );

    return {
      event: {
        ...event,
        mediaUrl: evidenceRes.rows[0]?.mediaUrl || null,
        mediaType: evidenceRes.rows[0]?.mediaType || 'IMAGE',
      },
      aiObservation: obsRes.rows[0] || null,
      embedding: embeddingRes.rows[0] || null,
      evidence: evidenceRes.rows || [],
      mediaUrl: evidenceRes.rows[0]?.mediaUrl || null,
    };
  }

  async getHotspots(filters?: { status?: string; minScore?: number }): Promise<Hotspot[]> {
    return hotspotAnalyzer.getHotspots(filters);
  }

  async getHotspotDetails(id: string): Promise<any | null> {
    const hotspot = await hotspotAnalyzer.getHotspotById(id);
    if (!hotspot) return null;

    const interventionsRes = await pool.query(
      `SELECT * FROM interventions WHERE hotspot_id = $1 ORDER BY created_at DESC`,
      [id]
    );

    return {
      hotspot,
      interventions: interventionsRes.rows,
    };
  }

  async getWasteDistribution(): Promise<WasteDistributionItem[]> {
    const res = await pool.query(`
      SELECT 
        COALESCE(category, 'OTHER') as "wasteType",
        COUNT(*)::int as count
      FROM reports
      GROUP BY category
      ORDER BY count DESC
    `);

    const total = res.rows.reduce((sum, r) => sum + r.count, 0) || 1;
    return res.rows.map((r) => ({
      wasteType: r.wasteType,
      count: r.count,
      percentage: Number(((r.count / total) * 100).toFixed(1)),
    }));
  }

  async getSeverityDistribution(): Promise<SeverityDistributionItem[]> {
    const res = await pool.query(`
      SELECT 
        COALESCE(severity, 'LOW') as severity,
        COUNT(*)::int as count
      FROM environmental_events
      GROUP BY severity
      ORDER BY count DESC
    `);

    const total = res.rows.reduce((sum, r) => sum + r.count, 0) || 1;
    return res.rows.map((r) => ({
      severity: r.severity,
      count: r.count,
      percentage: Number(((r.count / total) * 100).toFixed(1)),
    }));
  }

  async compareZones(zoneAId: string, zoneBId: string): Promise<ZoneComparisonResult> {
    const zoneARes = await pool.query(`SELECT id, name FROM clusters WHERE id = $1`, [zoneAId]);
    const zoneBRes = await pool.query(`SELECT id, name FROM clusters WHERE id = $1`, [zoneBId]);

    const nameA = zoneARes.rows[0]?.name || 'Zone A';
    const nameB = zoneBRes.rows[0]?.name || 'Zone B';

    const countARes = await pool.query(`SELECT COUNT(*)::int as count FROM reports WHERE cluster_id = $1`, [zoneAId]);
    const countBRes = await pool.query(`SELECT COUNT(*)::int as count FROM reports WHERE cluster_id = $1`, [zoneBId]);

    const countA = countARes.rows[0]?.count || 0;
    const countB = countBRes.rows[0]?.count || 0;

    return {
      zoneA: { id: zoneAId, name: nameA, eventCount: countA, hotspotCount: 1, dominantWasteType: 'WASTE_HOTSPOT' },
      zoneB: { id: zoneBId, name: nameB, eventCount: countB, hotspotCount: 0, dominantWasteType: 'MIXED_WASTE' },
      deltaEvents: countA - countB,
      recommendation: countA > countB
        ? `Allocate 1 additional municipal sanitation vehicle to ${nameA} to address event volume differential.`
        : `Conditions in both zones are currently balanced.`,
    };
  }

  async getEventTimeline(limit = 20): Promise<any[]> {
    const res = await pool.query(
      `
      SELECT 
        id,
        COALESCE(title, description, 'Environmental incident') as title,
        COALESCE(description, '') as description,
        category,
        status,
        created_at as timestamp,
        location_address as "locationAddress"
      FROM reports
      ORDER BY created_at DESC
      LIMIT $1
      `,
      [limit]
    );

    return res.rows;
  }

  async findSimilarEvents(targetVector: number[], maxDistanceMeters = 5000): Promise<VectorSearchResult[]> {
    return vectorRepository.searchSimilar(targetVector, { maxDistanceMeters });
  }

  async findPatterns(): Promise<any> {
    return {
      temporalPatterns: [
        { timeWindow: '06:00 - 09:00 IST', frequency: 'High', description: 'Curbside domestic waste dumping before municipal sweepers arrive.' },
        { timeWindow: '22:00 - 02:00 IST', frequency: 'Medium', description: 'Construction debris offloading in outskirts.' },
      ],
      recurringHotspotsCount: 3,
      predictedNextEscalationWard: 'Kothrud Green Corridor',
    };
  }

  async getInterventionHistory(hotspotId?: string): Promise<Intervention[]> {
    let query = `SELECT * FROM interventions WHERE 1=1`;
    const params: any[] = [];
    if (hotspotId) {
      params.push(hotspotId);
      query += ` AND hotspot_id = $1`;
    }
    query += ` ORDER BY created_at DESC LIMIT 50`;

    const res = await pool.query(query, params);
    return res.rows.map((r) => ({
      id: r.id,
      hotspotId: r.hotspot_id,
      type: r.type,
      priority: r.priority,
      status: r.status,
      assignedTeam: r.assigned_team,
      notes: r.notes,
      createdAt: new Date(r.created_at).toISOString(),
      startedAt: r.started_at ? new Date(r.started_at).toISOString() : null,
      completedAt: r.completed_at ? new Date(r.completed_at).toISOString() : null,
    }));
  }

  async getInterventionOutcomes(): Promise<InterventionOutcome[]> {
    const res = await pool.query(`SELECT * FROM intervention_outcomes ORDER BY measured_at DESC LIMIT 50`);
    return res.rows.map((r) => ({
      id: r.id,
      interventionId: r.intervention_id,
      beforeReportRate: Number(r.before_report_rate),
      afterReportRate: Number(r.after_report_rate),
      beforeSeverity: Number(r.before_severity),
      afterSeverity: Number(r.after_severity),
      beforeHotspotSize: Number(r.before_hotspot_size),
      afterHotspotSize: Number(r.after_hotspot_size),
      successScore: Number(r.success_score),
      measuredAt: new Date(r.measured_at).toISOString(),
    }));
  }

  async updateEventStatus(eventIdOrReportId: string, status: string, reviewerId?: string): Promise<any> {
    let validReviewerId = reviewerId;
    const isUuid = validReviewerId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(validReviewerId);
    if (!isUuid) {
      const maintainerRes = await pool.query(
        `SELECT id FROM users WHERE role IN ('MAINTAINER', 'WARD_ADMIN', 'SUPER_ADMIN') LIMIT 1`
      );
      if (maintainerRes.rows.length > 0) {
        validReviewerId = maintainerRes.rows[0].id;
      }
    }

    const eventRes = await pool.query(
      `SELECT * FROM environmental_events WHERE id::text = $1 OR report_id = $1 LIMIT 1`,
      [eventIdOrReportId]
    );

    if (eventRes.rows.length === 0) {
      // If event row doesn't exist yet, check if report exists
      const report = await reportRepository.findById(eventIdOrReportId);
      if (report) {
        if (status === 'VERIFIED') {
          await reviewService.processDecision({
            entityType: 'REPORT',
            entityId: report.id,
            decision: 'APPROVED',
            reviewerId: validReviewerId!,
            reason: 'Verified by maintainer from Operations Console',
          });
        } else if (status === 'REJECTED') {
          await reviewService.processDecision({
            entityType: 'REPORT',
            entityId: report.id,
            decision: 'REJECTED',
            reviewerId: validReviewerId!,
            reason: 'Rejected by maintainer from Operations Console',
          });
        } else {
          await reportRepository.updateStatus(report.id, status as any);
        }
        return { success: true, reportId: report.id, status };
      }
      throw new Error(`Event not found for id: ${eventIdOrReportId}`);
    }

    const event = eventRes.rows[0];
    const reportId = event.report_id;

    await pool.query(
      `UPDATE environmental_events SET status = $1, updated_at = NOW() WHERE id = $2`,
      [status, event.id]
    );

    if (reportId) {
      if (status === 'VERIFIED') {
        await reviewService.processDecision({
          entityType: 'REPORT',
          entityId: reportId,
          decision: 'APPROVED',
          reviewerId: validReviewerId!,
          reason: 'Verified by maintainer from Operations Console',
        });
      } else if (status === 'REJECTED') {
        await reviewService.processDecision({
          entityType: 'REPORT',
          entityId: reportId,
          decision: 'REJECTED',
          reviewerId: validReviewerId!,
          reason: 'Rejected by maintainer from Operations Console',
        });
      } else {
        await reportRepository.updateStatus(reportId, status as any);
      }
    }

    return { success: true, eventId: event.id, reportId, status };
  }
}

export const environmentalIntelligenceService = new EnvironmentalIntelligenceService();
