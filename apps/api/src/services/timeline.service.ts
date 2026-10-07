import type { CommunityTimelineEntry, TimelineCategory } from '@ecopulse/types';
import { desc, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { auditLogs, communityMilestones, reports, tasks, users } from '../db/schema.js';

export class TimelineService {
  async getCommunityTimeline(communityId: string, limit: number = 30): Promise<CommunityTimelineEntry[]> {
    const entries: CommunityTimelineEntry[] = [];

    // 1. Fetch reports for this community
    const reportRows = await db
      .select({
        report: reports,
        user: {
          id: users.id,
          fullName: users.fullName,
        },
      })
      .from(reports)
      .leftJoin(users, eq(reports.userId, users.id))
      .where(eq(reports.communityId, communityId))
      .orderBy(desc(reports.createdAt))
      .limit(limit);

    for (const row of reportRows) {
      const rep = row.report;
      // Report submission entry
      entries.push({
        id: `report-${rep.id}`,
        communityId,
        timestamp: rep.createdAt.toISOString(),
        eventType: 'REPORT_SUBMITTED',
        title: `Report Submitted: ${rep.title}`,
        description: rep.description,
        category: 'REPORT',
        actorId: rep.userId,
        actorName: row.user?.fullName ?? 'Resident',
      });

      // If verified or resolved, add outcome entry
      if (rep.status === 'VERIFIED') {
        entries.push({
          id: `report-verified-${rep.id}`,
          communityId,
          timestamp: rep.updatedAt.toISOString(),
          eventType: 'REPORT_VERIFIED',
          title: `Report Verified: ${rep.title}`,
          description: `Citizen submission verified. +${rep.pointsReward} EcoPoints awarded.`,
          category: 'VERIFICATION',
        });
      } else if (rep.status === 'RESOLVED') {
        entries.push({
          id: `report-resolved-${rep.id}`,
          communityId,
          timestamp: rep.updatedAt.toISOString(),
          eventType: 'OUTCOME_VERIFIED',
          title: `Incident Resolved: ${rep.title}`,
          description: 'Field cleanup verified and community hazard remediated.',
          category: 'OUTCOME',
        });
      }
    }

    // 2. Fetch field tasks for this community
    const taskRows = await db
      .select({
        task: tasks,
        assignedUser: {
          id: users.id,
          fullName: users.fullName,
        },
      })
      .from(tasks)
      .leftJoin(users, eq(tasks.assignedTo, users.id))
      .where(eq(tasks.communityId, communityId))
      .orderBy(desc(tasks.createdAt))
      .limit(limit);

    for (const row of taskRows) {
      const t = row.task;
      entries.push({
        id: `task-${t.id}`,
        communityId,
        timestamp: t.createdAt.toISOString(),
        eventType: 'TASK_CREATED',
        title: `Field Task Created: ${t.title}`,
        description: t.description || 'Assigned to field operations crew.',
        category: 'TASK',
        actorId: t.assignedTo,
        actorName: row.assignedUser?.fullName ?? 'Field Operator',
      });

      if (t.status === 'COMPLETED' && t.completedAt) {
        entries.push({
          id: `task-completed-${t.id}`,
          communityId,
          timestamp: t.completedAt.toISOString(),
          eventType: 'TASK_COMPLETED',
          title: `Field Cleanup Completed: ${t.title}`,
          description: 'Awaiting final verification check.',
          category: 'TASK',
          actorId: t.assignedTo,
          actorName: row.assignedUser?.fullName ?? 'Field Operator',
        });
      }

      if (t.status === 'VERIFIED' && t.verifiedAt) {
        entries.push({
          id: `task-verified-${t.id}`,
          communityId,
          timestamp: t.verifiedAt.toISOString(),
          eventType: 'TASK_VERIFIED',
          title: `Outcome Verified: ${t.title}`,
          description: 'Field task work inspected and confirmed complete.',
          category: 'OUTCOME',
          actorId: t.verifiedBy,
        });
      }
    }

    // 3. Fetch community milestones achieved
    const milestoneRows = await db
      .select()
      .from(communityMilestones)
      .where(eq(communityMilestones.communityId, communityId))
      .limit(limit);

    for (const m of milestoneRows) {
      if (m.achievedAt) {
        entries.push({
          id: `milestone-${m.id}`,
          communityId,
          timestamp: m.achievedAt.toISOString(),
          eventType: 'MILESTONE_REACHED',
          title: `Milestone Unlocked: ${m.title}`,
          description: `Reward unlocked: ${m.rewardTitle} (${m.targetProgress}% community progress reached)`,
          category: 'MILESTONE',
        });
      }
    }

    // Sort chronologically descending
    entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return entries.slice(0, limit);
  }
}

export const timelineService = new TimelineService();
