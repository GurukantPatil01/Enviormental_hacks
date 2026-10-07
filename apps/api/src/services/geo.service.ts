import type {
  City,
  ClusterDetail,
  ClusterSummary,
  MapOverview,
  ResolvedLocation,
  Ward,
} from '@ecopulse/types';
import { geoRepository, type BoundingBox } from '../repositories/geo.repository.js';
import { milestoneService } from './milestone.service.js';
import { timelineService } from './timeline.service.js';

export interface ClusterDetailOptions {
  includeHistory?: boolean;
}

export class GeoService {
  async listCities(): Promise<City[]> {
    return geoRepository.listCities();
  }

  async listWards(cityId: string): Promise<Ward[]> {
    return geoRepository.listWards(cityId);
  }

  async listClusters(communityId?: string): Promise<ClusterSummary[]> {
    return geoRepository.listClusters(communityId);
  }

  async resolveLocation(lat: number, lng: number): Promise<ResolvedLocation> {
    const resolved = await geoRepository.resolveLocation(lat, lng);
    if (!resolved.cluster && resolved.ward && resolved.city) {
      // Contained in a ward but no active cluster polygon: fall back to the
      // nearest cluster within a short walk so the UI always has an anchor.
      const nearest = await geoRepository.findNearestCluster(lat, lng, 1500);
      if (nearest) {
        resolved.cluster = nearest.cluster;
      }
    }
    return resolved;
  }

  async mapOverview(bbox: BoundingBox): Promise<MapOverview> {
    return geoRepository.getMapOverview(bbox);
  }

  async getClusterDetail(
    clusterId: string,
    options: ClusterDetailOptions = {}
  ): Promise<ClusterDetail> {
    const cluster = await geoRepository.findClusterById(clusterId);
    if (!cluster) {
      const err = new Error('Cluster not found');
      (err as any).statusCode = 404;
      (err as any).code = 'CLUSTER_NOT_FOUND';
      throw err;
    }

    const detail: ClusterDetail = { ...cluster };

    const [metrics, counts] = await Promise.all([
      geoRepository.getLatestClusterMetrics(cluster.id),
      (async () => {
        const { pool } = await import('../db/index.js');
        const [row] = (
          await pool.query<{ open_reports: string; active_missions: string }>(
            `SELECT
               (SELECT COUNT(*) FROM reports r WHERE r.cluster_id = $1 AND r.status IN ('SUBMITTED','UNDER_REVIEW','VERIFIED')) AS open_reports,
               (SELECT COUNT(*) FROM missions m WHERE m.cluster_id = $1 AND m.status = 'ACTIVE') AS active_missions`,
            [cluster.id]
          )
        ).rows;
        return row;
      })(),
    ]);

    detail.openReportsCount = Number(counts?.open_reports ?? 0);
    detail.activeMissionsCount = Number(counts?.active_missions ?? 0);
    if (Object.keys(metrics).length > 0) {
      detail.metrics = {
        environment: metrics.environment,
        participation: metrics.participation,
        service: metrics.service,
        incidentsOpen: metrics.incidents_open,
        progress: metrics.progress,
      };
    }

    if (options.includeHistory) {
      detail.metricsHistory = await geoRepository.getClusterMetricsHistory(cluster.id, 90);
    }

    // Community milestones are tracked at the community level; surface the
    // current in-progress one for this cluster's community.
    const communityId = cluster.communityId;
    const [milestones, timeline] = await Promise.all([
      milestoneService.getMilestones(communityId).catch(() => []),
      timelineService.getCommunityTimeline(communityId, 10).catch(() => []),
    ]);

    const currentMilestone = milestones.find((m) => m.status === 'IN_PROGRESS') || milestones.find((m) => m.status === 'LOCKED');
    if (currentMilestone) {
      detail.currentMilestone = {
        id: currentMilestone.id,
        title: currentMilestone.title,
        description: currentMilestone.description,
        targetProgress: currentMilestone.targetProgress,
        status: currentMilestone.status,
      };
    }

    detail.recentActivity = timeline.slice(0, 8).map((t) => {
      let itemType: 'REPORT' | 'MISSION' | 'MILESTONE' | 'POINTS' = 'REPORT';
      if (t.category === 'MILESTONE') {
        itemType = 'MILESTONE';
      } else if (t.category === 'VERIFICATION') {
        itemType = 'POINTS';
      } else if (t.category === 'TASK') {
        itemType = 'MISSION';
      }
      return {
        id: t.id,
        type: itemType,
        title: t.title,
        createdAt: t.timestamp,
      };
    });

    return detail;
  }

  /** Attach the caller to a cluster as their primary geographic community. */
  async joinCluster(clusterId: string, userId: string): Promise<ClusterSummary> {
    const cluster = await geoRepository.findClusterById(clusterId);
    if (!cluster) {
      const err = new Error('Cluster not found');
      (err as any).statusCode = 404;
      (err as any).code = 'CLUSTER_NOT_FOUND';
      throw err;
    }
    await geoRepository.joinCluster(clusterId, userId);
    return cluster;
  }

  async getUserPrimaryCluster(userId: string): Promise<ClusterSummary | null> {
    const clusterId = await geoRepository.findUserPrimaryClusterId(userId);
    if (!clusterId) return null;
    return geoRepository.findClusterById(clusterId);
  }
}

export const geoService = new GeoService();
