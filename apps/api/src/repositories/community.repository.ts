import type { Community, CommunityMember } from '@ecopulse/types';
import { and, count, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { communities, communityMembers, users } from '../db/schema.js';

export class CommunityRepository {
  async listAll(): Promise<Community[]> {
    const list = await db.select().from(communities);
    
    // Map with counts
    const results: Community[] = [];
    for (const c of list) {
      const [memberCountRes] = await db
        .select({ count: count() })
        .from(communityMembers)
        .where(eq(communityMembers.communityId, c.id));

      results.push({
        id: c.id,
        name: c.name,
        slug: c.slug,
        description: c.description,
        locationName: c.locationName,
        boundaryGeoJson: c.boundaryGeoJson as Record<string, unknown> | null,
        status: c.status as any,
        currentProgress: c.currentProgress,
        memberCount: Number(memberCountRes?.count || 0),
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      });
    }

    return results;
  }

  async findById(id: string): Promise<Community | null> {
    const [c] = await db.select().from(communities).where(eq(communities.id, id));
    if (!c) return null;

    const [memberCountRes] = await db
      .select({ count: count() })
      .from(communityMembers)
      .where(eq(communityMembers.communityId, c.id));

    return {
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      locationName: c.locationName,
      boundaryGeoJson: c.boundaryGeoJson as Record<string, unknown> | null,
      status: c.status as any,
      currentProgress: c.currentProgress,
      memberCount: Number(memberCountRes?.count || 0),
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    };
  }

  async findUserCommunity(userId: string): Promise<Community | null> {
    const [membership] = await db
      .select()
      .from(communityMembers)
      .where(eq(communityMembers.userId, userId))
      .limit(1);

    if (!membership) return null;
    return this.findById(membership.communityId);
  }

  async join(communityId: string, userId: string): Promise<CommunityMember> {
    const [existing] = await db
      .select()
      .from(communityMembers)
      .where(
        and(
          eq(communityMembers.communityId, communityId),
          eq(communityMembers.userId, userId)
        )
      );

    if (existing) {
      return {
        id: existing.id,
        communityId: existing.communityId,
        userId: existing.userId,
        role: existing.role as any,
        joinedAt: existing.joinedAt.toISOString(),
      };
    }

    const [member] = await db
      .insert(communityMembers)
      .values({
        communityId,
        userId,
        role: 'MEMBER',
      })
      .returning();

    return {
      id: member.id,
      communityId: member.communityId,
      userId: member.userId,
      role: member.role as any,
      joinedAt: member.joinedAt.toISOString(),
    };
  }

  async getMembers(communityId: string): Promise<CommunityMember[]> {
    const members = await db
      .select({
        id: communityMembers.id,
        communityId: communityMembers.communityId,
        userId: communityMembers.userId,
        role: communityMembers.role,
        joinedAt: communityMembers.joinedAt,
        userName: users.fullName,
        userEmail: users.email,
      })
      .from(communityMembers)
      .innerJoin(users, eq(communityMembers.userId, users.id))
      .where(eq(communityMembers.communityId, communityId));

    return members.map((m) => ({
      id: m.id,
      communityId: m.communityId,
      userId: m.userId,
      role: m.role as any,
      joinedAt: m.joinedAt.toISOString(),
      user: {
        id: m.userId,
        fullName: m.userName,
        email: m.userEmail,
      },
    }));
  }
}

export const communityRepository = new CommunityRepository();
