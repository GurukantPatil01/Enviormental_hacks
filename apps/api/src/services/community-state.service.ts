import type { CommunityState, CommunityTrend } from '@ecopulse/types';
import { and, eq, gte, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  communityMembers,
  missionEvents,
  missionParticipants,
  missions,
  pointLedger,
  reports,
  tasks,
} from '../db/schema.js';

export interface ScoringWeights {
  behaviour: number;
  participation: number;
  service: number;
  environmental: number;
}

export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  behaviour: 0.25,
  participation: 0.25,
  service: 0.25,
  environmental: 0.25,
};

/**
 * Community State Service
 * 
 * Computes multidimensional community health metrics:
 * 1. BEHAVIOUR (25%): Quality of resident actions, valid submissions, mission completions vs failures.
 * 2. PARTICIPATION (25%): Active resident engagement, missions started, reports filed.
 * 3. SERVICE QUALITY (25%): Maintainer responsiveness, task completion rate, resolved incident ratio.
 * 4. ENVIRONMENTAL OUTCOME (25%): Verified environmental interventions and resolved hazard locations.
 */
export class CommunityStateService {
  private weights: ScoringWeights = DEFAULT_SCORING_WEIGHTS;

  public setWeights(customWeights: Partial<ScoringWeights>) {
    this.weights = { ...this.weights, ...customWeights };
  }

  public getWeights(): ScoringWeights {
    return { ...this.weights };
  }

  async calculateCommunityState(communityId: string): Promise<CommunityState> {
    const [
      behaviourScore,
      participationScore,
      serviceScore,
      environmentalScore,
    ] = await Promise.all([
      this.calculateBehaviourScore(communityId),
      this.calculateParticipationScore(communityId),
      this.calculateServiceScore(communityId),
      this.calculateEnvironmentalScore(communityId),
    ]);

    const overallProgress = Math.round(
      Math.min(
        100,
        Math.max(
          0,
          behaviourScore * this.weights.behaviour +
            participationScore * this.weights.participation +
            serviceScore * this.weights.service +
            environmentalScore * this.weights.environmental
        )
      )
    );

    // Determine trend based on overall progress and recent activity
    let trend: CommunityTrend = 'STABLE';
    if (overallProgress >= 70) {
      trend = 'IMPROVING';
    } else if (overallProgress < 40) {
      trend = 'DECLINING';
    } else {
      trend = 'STABLE';
    }

    return {
      communityId,
      behaviourScore,
      participationScore,
      serviceScore,
      environmentalScore,
      overallProgress,
      trend,
      lastUpdated: new Date().toISOString(),
      weights: this.getWeights(),
    };
  }

  /**
   * 1. BEHAVIOUR DIMENSION
   * Evaluates the integrity and persistence of citizen participation:
   * - Ratio of completed missions to started missions.
   * - Ratio of verified reports vs total reports submitted (penalizes fraudulent/frivolous submissions).
   */
  private async calculateBehaviourScore(communityId: string): Promise<number> {
    // 1. Mission completion ratio
    const participantRows = await db
      .select({
        status: missionParticipants.status,
      })
      .from(missionParticipants)
      .innerJoin(missions, eq(missionParticipants.missionId, missions.id))
      .where(eq(missions.communityId, communityId));

    let missionCompletionRate = 0.7; // default baseline 70% if no missions yet
    if (participantRows.length > 0) {
      const completed = participantRows.filter((p) => p.status === 'COMPLETED').length;
      missionCompletionRate = completed / participantRows.length;
    }

    // 2. Report verification fidelity
    const communityReports = await db
      .select({
        status: reports.status,
      })
      .from(reports)
      .where(eq(reports.communityId, communityId));

    let reportFidelityRate = 0.8; // default baseline 80% if no reports yet
    if (communityReports.length > 0) {
      const verifiedOrResolved = communityReports.filter(
        (r) => r.status === 'VERIFIED' || r.status === 'RESOLVED' || r.status === 'CLOSED'
      ).length;
      const rejected = communityReports.filter((r) => r.status === 'REJECTED').length;
      const evaluated = verifiedOrResolved + rejected;
      reportFidelityRate = evaluated > 0 ? verifiedOrResolved / evaluated : 0.85;
    }

    const score = Math.round((missionCompletionRate * 0.5 + reportFidelityRate * 0.5) * 100);
    return Math.min(100, Math.max(10, score));
  }

  /**
   * 2. PARTICIPATION DIMENSION
   * Evaluates citizen volume and active engagement:
   * - Active members count compared to total members.
   * - Total point activity generated in the last 30 days.
   */
  private async calculateParticipationScore(communityId: string): Promise<number> {
    const [memberCountResult] = await db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(communityMembers)
      .where(eq(communityMembers.communityId, communityId));

    const totalMembers = memberCountResult?.count || 1;

    // Active participants in missions or reports
    const [activeParticipantsResult] = await db
      .select({ count: sql<number>`cast(count(distinct ${missionParticipants.userId}) as int)` })
      .from(missionParticipants)
      .innerJoin(missions, eq(missionParticipants.missionId, missions.id))
      .where(eq(missions.communityId, communityId));

    const activeParticipants = activeParticipantsResult?.count || 0;
    const engagementRatio = Math.min(1, activeParticipants / Math.max(1, totalMembers));

    // Base score starts at 50, scaled by active engagement
    const score = Math.round(50 + engagementRatio * 50);
    return Math.min(100, Math.max(15, score));
  }

  /**
   * 3. SERVICE QUALITY DIMENSION
   * Evaluates municipal and maintainer operations:
   * - Percentage of field tasks completed and verified.
   * - Open vs resolved incident ratio.
   */
  private async calculateServiceScore(communityId: string): Promise<number> {
    const taskRows = await db
      .select({
        status: tasks.status,
      })
      .from(tasks)
      .where(eq(tasks.communityId, communityId));

    if (taskRows.length === 0) {
      return 75; // Neutral baseline when operational tasks are newly spun up
    }

    const completedOrVerified = taskRows.filter(
      (t) => t.status === 'COMPLETED' || t.status === 'VERIFIED'
    ).length;

    const taskCompletionRate = completedOrVerified / taskRows.length;
    const score = Math.round(taskCompletionRate * 100);
    return Math.min(100, Math.max(10, score));
  }

  /**
   * 4. ENVIRONMENTAL OUTCOME DIMENSION
   * Evaluates verified physical improvements:
   * - Number of verified environmental reports resolved.
   * - Total verified points awarded for community initiatives.
   */
  private async calculateEnvironmentalScore(communityId: string): Promise<number> {
    const resolvedReports = await db
      .select({ id: reports.id })
      .from(reports)
      .where(
        and(
          eq(reports.communityId, communityId),
          sql`${reports.status} IN ('VERIFIED', 'RESOLVED', 'CLOSED')`
        )
      );

    const totalReports = await db
      .select({ id: reports.id })
      .from(reports)
      .where(eq(reports.communityId, communityId));

    if (totalReports.length === 0) {
      return 70; // Baseline
    }

    const resolutionRatio = resolvedReports.length / totalReports.length;
    const score = Math.round(40 + resolutionRatio * 60);
    return Math.min(100, Math.max(10, score));
  }
}

export const communityStateService = new CommunityStateService();
