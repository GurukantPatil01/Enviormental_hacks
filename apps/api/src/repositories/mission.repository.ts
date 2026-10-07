import type { Mission, MissionParticipant, ParticipantStatus } from '@ecopulse/types';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { missionEvents, missionParticipants, missions } from '../db/schema.js';

export class MissionRepository {
  async list(communityId?: string, userId?: string): Promise<Mission[]> {
    let query = db.select().from(missions);
    let rows = await (communityId ? query.where(eq(missions.communityId, communityId)) : query);

    const result: Mission[] = [];
    for (const m of rows) {
      let participationStatus: ParticipantStatus = 'NOT_STARTED';

      if (userId) {
        const [participant] = await db
          .select()
          .from(missionParticipants)
          .where(
            and(
              eq(missionParticipants.missionId, m.id),
              eq(missionParticipants.userId, userId)
            )
          );
        if (participant) {
          participationStatus = participant.status as ParticipantStatus;
        }
      }

      result.push({
        id: m.id,
        communityId: m.communityId,
        title: m.title,
        description: m.description,
        category: m.category as any,
        pointsReward: m.pointsReward,
        verificationType: m.verificationType as any,
        status: m.status as any,
        expiresAt: m.expiresAt ? m.expiresAt.toISOString() : null,
        createdAt: m.createdAt.toISOString(),
        userParticipationStatus: participationStatus,
      });
    }

    return result;
  }

  async findById(id: string, userId?: string): Promise<Mission | null> {
    const [m] = await db.select().from(missions).where(eq(missions.id, id));
    if (!m) return null;

    let participationStatus: ParticipantStatus = 'NOT_STARTED';
    if (userId) {
      const [participant] = await db
        .select()
        .from(missionParticipants)
        .where(
          and(
            eq(missionParticipants.missionId, m.id),
            eq(missionParticipants.userId, userId)
          )
        );
      if (participant) {
        participationStatus = participant.status as ParticipantStatus;
      }
    }

    return {
      id: m.id,
      communityId: m.communityId,
      title: m.title,
      description: m.description,
      category: m.category as any,
      pointsReward: m.pointsReward,
      verificationType: m.verificationType as any,
      status: m.status as any,
      expiresAt: m.expiresAt ? m.expiresAt.toISOString() : null,
      createdAt: m.createdAt.toISOString(),
      userParticipationStatus: participationStatus,
    };
  }

  async getParticipation(missionId: string, userId: string): Promise<MissionParticipant | null> {
    const [p] = await db
      .select()
      .from(missionParticipants)
      .where(
        and(
          eq(missionParticipants.missionId, missionId),
          eq(missionParticipants.userId, userId)
        )
      );
    if (!p) return null;
    return {
      id: p.id,
      missionId: p.missionId,
      userId: p.userId,
      status: p.status as ParticipantStatus,
      startedAt: p.startedAt.toISOString(),
      completedAt: p.completedAt ? p.completedAt.toISOString() : null,
    };
  }

  async startMission(missionId: string, userId: string): Promise<MissionParticipant> {
    const existing = await this.getParticipation(missionId, userId);
    if (existing) return existing;

    const [created] = await db
      .insert(missionParticipants)
      .values({
        missionId,
        userId,
        status: 'STARTED',
      })
      .returning();

    return {
      id: created.id,
      missionId: created.missionId,
      userId: created.userId,
      status: created.status as ParticipantStatus,
      startedAt: created.startedAt.toISOString(),
      completedAt: null,
    };
  }

  async completeMission(missionId: string, userId: string): Promise<MissionParticipant> {
    const [updated] = await db
      .update(missionParticipants)
      .set({
        status: 'COMPLETED',
        completedAt: new Date(),
      })
      .where(
        and(
          eq(missionParticipants.missionId, missionId),
          eq(missionParticipants.userId, userId)
        )
      )
      .returning();

    return {
      id: updated.id,
      missionId: updated.missionId,
      userId: updated.userId,
      status: updated.status as ParticipantStatus,
      startedAt: updated.startedAt.toISOString(),
      completedAt: updated.completedAt ? updated.completedAt.toISOString() : null,
    };
  }

  async recordEvent(params: {
    missionId: string;
    participantId?: string | null;
    userId: string;
    eventType: 'STARTED' | 'COMPLETED' | 'VERIFIED';
    clientEventId?: string | null;
    metadata?: Record<string, unknown> | null;
  }) {
    const [event] = await db
      .insert(missionEvents)
      .values({
        missionId: params.missionId,
        participantId: params.participantId || null,
        userId: params.userId,
        eventType: params.eventType,
        clientEventId: params.clientEventId || null,
        metadata: params.metadata || null,
      })
      .returning();
    return event;
  }

  async findEventByClientEventId(clientEventId: string) {
    const [event] = await db
      .select()
      .from(missionEvents)
      .where(eq(missionEvents.clientEventId, clientEventId));
    return event || null;
  }
}

export const missionRepository = new MissionRepository();
