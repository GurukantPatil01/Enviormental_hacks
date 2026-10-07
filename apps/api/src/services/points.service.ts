import type { PointBalance, PointLedgerEntry, PointSource, PointType } from '@ecopulse/types';
import { eventBus } from '../events/event-bus.js';
import { pointLedgerRepository } from '../repositories/point-ledger.repository.js';

export interface AwardPointsParams {
  userId: string;
  communityId?: string | null;
  source: PointSource;
  referenceId: string;
  amount: number;
  type?: PointType;
  approvedBy?: string | null;
  clientEventId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export class PointsService {
  async awardPoints(params: AwardPointsParams): Promise<{ entry: PointLedgerEntry; isDuplicate: boolean }> {
    // 1. Check idempotency by clientEventId if provided
    if (params.clientEventId) {
      const existingByClient = await pointLedgerRepository.findByClientEventId(params.clientEventId);
      if (existingByClient) {
        return { entry: existingByClient, isDuplicate: true };
      }
    }

    // 2. Check duplicate for same user, source, referenceId
    const existing = await pointLedgerRepository.findByUserAndReference(
      params.userId,
      params.source,
      params.referenceId
    );
    if (existing) {
      return { entry: existing, isDuplicate: true };
    }

    // 3. Create immutable ledger record
    const entry = await pointLedgerRepository.createEntry({
      userId: params.userId,
      communityId: params.communityId,
      source: params.source,
      referenceId: params.referenceId,
      amount: params.amount,
      type: params.type || 'CREDIT',
      approvedBy: params.approvedBy,
      clientEventId: params.clientEventId,
      metadata: params.metadata,
    });

    // 4. Publish domain event
    await eventBus.publish(
      'POINTS_AWARDED',
      entry.id,
      {
        transactionId: entry.transactionId,
        userId: entry.userId,
        amount: entry.amount,
        source: entry.source,
        referenceId: entry.referenceId,
      },
      params.userId
    );

    return { entry, isDuplicate: false };
  }

  async getBalance(userId: string): Promise<PointBalance> {
    return pointLedgerRepository.getBalance(userId);
  }

  async getLedgerHistory(userId: string, limit = 50): Promise<PointLedgerEntry[]> {
    return pointLedgerRepository.getHistory(userId, limit);
  }
}

export const pointsService = new PointsService();
