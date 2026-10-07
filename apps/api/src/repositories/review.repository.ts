import type { HumanReview, ObservationSeverity, ReviewDecision, ReviewEntityType } from '@ecopulse/types';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { reviews, users } from '../db/schema.js';

export interface CreateReviewInput {
  entityType: ReviewEntityType;
  entityId: string;
  recommendation?: string | null;
  confidence?: number;
  reviewerId?: string | null;
  decision?: ReviewDecision;
  reason?: string | null;
  evidenceId?: string | null;
  aiProvider?: string | null;
  aiModel?: string | null;
  aiConfidence?: number | null;
  detectedIssue?: string | null;
  severity?: ObservationSeverity | null;
  detectedObjects?: string[] | null;
}

export class ReviewRepository {
  async create(data: CreateReviewInput): Promise<HumanReview> {
    const [row] = await db
      .insert(reviews)
      .values({
        entityType: data.entityType,
        entityId: data.entityId,
        evidenceId: data.evidenceId,
        recommendation: data.recommendation,
        confidence: data.confidence ?? 100,
        reviewerId: data.reviewerId,
        decision: data.decision || 'PENDING',
        reason: data.reason,
        aiProvider: data.aiProvider,
        aiModel: data.aiModel,
        aiConfidence: data.aiConfidence,
        detectedIssue: data.detectedIssue,
        severity: data.severity,
        detectedObjects: data.detectedObjects,
      })
      .returning();

    return this.mapToReview(row);
  }

  async findById(id: string): Promise<HumanReview | null> {
    const [row] = await db
      .select({
        review: reviews,
        reviewer: {
          id: users.id,
          fullName: users.fullName,
          role: users.role,
        },
      })
      .from(reviews)
      .leftJoin(users, eq(reviews.reviewerId, users.id))
      .where(eq(reviews.id, id));

    if (!row) return null;
    return {
      ...this.mapToReview(row.review),
      reviewer: row.reviewer ? (row.reviewer as any) : undefined,
    };
  }

  async findPendingByEntity(entityType: ReviewEntityType, entityId: string): Promise<HumanReview | null> {
    const [row] = await db
      .select({
        review: reviews,
        reviewer: {
          id: users.id,
          fullName: users.fullName,
          role: users.role,
        },
      })
      .from(reviews)
      .leftJoin(users, eq(reviews.reviewerId, users.id))
      .where(
        and(
          eq(reviews.entityType, entityType),
          eq(reviews.entityId, entityId),
          eq(reviews.decision, 'PENDING')
        )
      )
      .limit(1);

    if (!row) return null;
    return {
      ...this.mapToReview(row.review),
      reviewer: row.reviewer ? (row.reviewer as any) : undefined,
    };
  }

  async updateDecision(
    id: string,
    decision: ReviewDecision,
    reviewerId: string,
    reason?: string
  ): Promise<HumanReview | null> {
    const [row] = await db
      .update(reviews)
      .set({
        decision,
        reviewerId,
        ...(reason !== undefined ? { reason } : {}),
      })
      .where(eq(reviews.id, id))
      .returning();

    if (!row) return null;
    return this.findById(row.id);
  }

  async list(filters?: {
    entityType?: ReviewEntityType;
    entityId?: string;
    decision?: ReviewDecision;
  }): Promise<HumanReview[]> {
    const conditions = [];
    if (filters?.entityType) conditions.push(eq(reviews.entityType, filters.entityType));
    if (filters?.entityId) conditions.push(eq(reviews.entityId, filters.entityId));
    if (filters?.decision) conditions.push(eq(reviews.decision, filters.decision));

    const query = db
      .select({
        review: reviews,
        reviewer: {
          id: users.id,
          fullName: users.fullName,
          role: users.role,
        },
      })
      .from(reviews)
      .leftJoin(users, eq(reviews.reviewerId, users.id))
      .orderBy(desc(reviews.createdAt));

    const rows = await (conditions.length > 0 ? query.where(and(...conditions)) : query);

    return rows.map((r) => ({
      ...this.mapToReview(r.review),
      reviewer: r.reviewer ? (r.reviewer as any) : undefined,
    }));
  }

  private mapToReview(row: typeof reviews.$inferSelect): HumanReview {
    return {
      id: row.id,
      entityType: row.entityType as ReviewEntityType,
      entityId: row.entityId,
      evidenceId: row.evidenceId,
      recommendation: row.recommendation,
      confidence: row.confidence ?? 100,
      reviewerId: row.reviewerId,
      decision: row.decision as ReviewDecision,
      reason: row.reason,
      aiProvider: row.aiProvider,
      aiModel: row.aiModel,
      aiConfidence: row.aiConfidence ?? row.confidence,
      detectedIssue: row.detectedIssue,
      severity: row.severity as ObservationSeverity,
      detectedObjects: (row.detectedObjects as string[]) || null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}

export const reviewRepository = new ReviewRepository();
