import type { PointBalance, PointLedgerEntry, PointSource, PointType } from '@ecopulse/types';
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { pointLedger } from '../db/schema.js';

export interface CreateLedgerEntryParams {
  userId: string;
  communityId?: string | null;
  source: PointSource;
  referenceId: string;
  amount: number;
  type: PointType;
  approvedBy?: string | null;
  clientEventId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export class PointLedgerRepository {
  async findByClientEventId(clientEventId: string): Promise<PointLedgerEntry | null> {
    const [entry] = await db
      .select()
      .from(pointLedger)
      .where(eq(pointLedger.clientEventId, clientEventId));
    if (!entry) return null;
    return this.mapEntry(entry);
  }

  async findByUserAndReference(
    userId: string,
    source: PointSource,
    referenceId: string
  ): Promise<PointLedgerEntry | null> {
    const [entry] = await db
      .select()
      .from(pointLedger)
      .where(
        and(
          eq(pointLedger.userId, userId),
          eq(pointLedger.source, source),
          eq(pointLedger.referenceId, referenceId)
        )
      );
    if (!entry) return null;
    return this.mapEntry(entry);
  }

  async createEntry(params: CreateLedgerEntryParams): Promise<PointLedgerEntry> {
    const [entry] = await db
      .insert(pointLedger)
      .values({
        userId: params.userId,
        communityId: params.communityId || null,
        source: params.source,
        referenceId: params.referenceId,
        amount: params.amount,
        type: params.type,
        approvedBy: params.approvedBy || null,
        clientEventId: params.clientEventId || null,
        metadata: params.metadata || null,
      })
      .returning();

    return this.mapEntry(entry);
  }

  async getBalance(userId: string): Promise<PointBalance> {
    const [result] = await db
      .select({
        total: sql<number>`COALESCE(SUM(CASE WHEN ${pointLedger.type} = 'CREDIT' THEN ${pointLedger.amount} ELSE -${pointLedger.amount} END), 0)::integer`,
        lifetimeEarned: sql<number>`COALESCE(SUM(CASE WHEN ${pointLedger.type} = 'CREDIT' THEN ${pointLedger.amount} ELSE 0 END), 0)::integer`,
        lifetimeSpent: sql<number>`COALESCE(SUM(CASE WHEN ${pointLedger.type} = 'DEBIT' THEN ${pointLedger.amount} ELSE 0 END), 0)::integer`,
      })
      .from(pointLedger)
      .where(eq(pointLedger.userId, userId));

    const [latestTx] = await db
      .select({ createdAt: pointLedger.createdAt })
      .from(pointLedger)
      .where(eq(pointLedger.userId, userId))
      .orderBy(desc(pointLedger.createdAt))
      .limit(1);

    return {
      userId,
      totalPoints: Number(result?.total || 0),
      lifetimeEarned: Number(result?.lifetimeEarned || 0),
      lifetimeSpent: Number(result?.lifetimeSpent || 0),
      lastTransactionAt: latestTx?.createdAt ? latestTx.createdAt.toISOString() : null,
    };
  }

  async getHistory(userId: string, limit = 50): Promise<PointLedgerEntry[]> {
    const entries = await db
      .select()
      .from(pointLedger)
      .where(eq(pointLedger.userId, userId))
      .orderBy(desc(pointLedger.createdAt))
      .limit(limit);

    return entries.map(this.mapEntry);
  }

  private mapEntry(entry: typeof pointLedger.$inferSelect): PointLedgerEntry {
    return {
      id: entry.id,
      transactionId: entry.transactionId,
      userId: entry.userId,
      communityId: entry.communityId,
      source: entry.source as PointSource,
      referenceId: entry.referenceId,
      amount: entry.amount,
      type: entry.type as PointType,
      approvedBy: entry.approvedBy,
      metadata: entry.metadata as Record<string, unknown> | null,
      createdAt: entry.createdAt.toISOString(),
    };
  }
}

export const pointLedgerRepository = new PointLedgerRepository();
