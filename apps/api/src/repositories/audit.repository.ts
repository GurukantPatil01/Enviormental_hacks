import { db } from '../db/index.js';
import { auditLogs } from '../db/schema.js';

export interface CreateAuditLogParams {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  reason?: string | null;
}

export class AuditRepository {
  async record(params: CreateAuditLogParams) {
    const [entry] = await db
      .insert(auditLogs)
      .values({
        actorId: params.actorId || null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        before: params.before || null,
        after: params.after || null,
        reason: params.reason || null,
      })
      .returning();
    return entry;
  }
}

export const auditRepository = new AuditRepository();
