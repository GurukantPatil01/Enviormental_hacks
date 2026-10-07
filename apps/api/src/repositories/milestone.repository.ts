import type { CommunityMilestone, MilestoneStatus } from '@ecopulse/types';
import { asc, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { communityMilestones } from '../db/schema.js';

export interface CreateMilestoneInput {
  communityId: string;
  title: string;
  description: string;
  targetProgress: number;
  rewardTitle: string;
  rewardDescription: string;
  status?: MilestoneStatus;
}

export class MilestoneRepository {
  async listByCommunity(communityId: string): Promise<CommunityMilestone[]> {
    const rows = await db
      .select()
      .from(communityMilestones)
      .where(eq(communityMilestones.communityId, communityId))
      .orderBy(asc(communityMilestones.targetProgress));

    return rows.map((r) => this.mapToMilestone(r));
  }

  async findById(id: string): Promise<CommunityMilestone | null> {
    const [row] = await db
      .select()
      .from(communityMilestones)
      .where(eq(communityMilestones.id, id));

    if (!row) return null;
    return this.mapToMilestone(row);
  }

  async create(data: CreateMilestoneInput): Promise<CommunityMilestone> {
    const [row] = await db
      .insert(communityMilestones)
      .values({
        communityId: data.communityId,
        title: data.title,
        description: data.description,
        targetProgress: data.targetProgress,
        rewardTitle: data.rewardTitle,
        rewardDescription: data.rewardDescription,
        status: data.status || 'LOCKED',
      })
      .returning();

    return this.mapToMilestone(row);
  }

  async updateStatus(id: string, status: MilestoneStatus, achievedAt?: Date | null): Promise<CommunityMilestone | null> {
    const [row] = await db
      .update(communityMilestones)
      .set({
        status,
        ...(achievedAt !== undefined ? { achievedAt } : {}),
      })
      .where(eq(communityMilestones.id, id))
      .returning();

    if (!row) return null;
    return this.mapToMilestone(row);
  }

  private mapToMilestone(row: typeof communityMilestones.$inferSelect): CommunityMilestone {
    return {
      id: row.id,
      communityId: row.communityId,
      title: row.title,
      description: row.description,
      targetProgress: row.targetProgress,
      rewardTitle: row.rewardTitle,
      rewardDescription: row.rewardDescription,
      status: row.status as MilestoneStatus,
      achievedAt: row.achievedAt ? row.achievedAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}

export const milestoneRepository = new MilestoneRepository();
