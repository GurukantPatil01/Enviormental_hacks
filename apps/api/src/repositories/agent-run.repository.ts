import type { AgentRun, AgentRunStatus } from '@ecopulse/types';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { agentRuns } from '../db/schema.js';

export interface CreateAgentRunInput {
  agentType: string;
  entityType: string;
  entityId: string;
  provider: string;
  model: string;
  status?: AgentRunStatus;
  inputReference?: string | null;
  outputReference?: Record<string, unknown> | null;
  error?: string | null;
  metadata?: Record<string, unknown> | null;
}

export class AgentRunRepository {
  async create(data: CreateAgentRunInput): Promise<AgentRun> {
    const cleanInputRef = data.inputReference
      ? (data.inputReference.includes('?') ? data.inputReference.split('?')[0] : data.inputReference).substring(0, 250)
      : null;

    const [row] = await db
      .insert(agentRuns)
      .values({
        agentType: (data.agentType || 'VISION').substring(0, 50),
        entityType: (data.entityType || 'EVIDENCE').substring(0, 50),
        entityId: (data.entityId || 'unknown').substring(0, 255),
        provider: (data.provider || 'MOCK').substring(0, 50),
        model: (data.model || 'mock-vision-v1').substring(0, 100),
        status: data.status || 'RUNNING',
        inputReference: cleanInputRef,
        outputReference: data.outputReference,
        error: data.error,
        metadata: data.metadata,
      })
      .returning();

    return this.mapToAgentRun(row);
  }

  async findByEntityAndType(entityId: string, agentType: string): Promise<AgentRun | null> {
    const [row] = await db
      .select()
      .from(agentRuns)
      .where(and(eq(agentRuns.entityId, entityId), eq(agentRuns.agentType, agentType)))
      .orderBy(desc(agentRuns.startedAt))
      .limit(1);

    if (!row) return null;
    return this.mapToAgentRun(row);
  }

  async updateStatus(
    id: string,
    status: AgentRunStatus,
    outputReference?: Record<string, unknown> | null,
    error?: string | null
  ): Promise<AgentRun | null> {
    const [row] = await db
      .update(agentRuns)
      .set({
        status,
        completedAt: status === 'COMPLETED' || status === 'FAILED' ? new Date() : undefined,
        ...(outputReference !== undefined ? { outputReference } : {}),
        ...(error !== undefined ? { error } : {}),
      })
      .where(eq(agentRuns.id, id))
      .returning();

    if (!row) return null;
    return this.mapToAgentRun(row);
  }

  async list(filters?: { agentType?: string; entityId?: string; status?: AgentRunStatus }): Promise<AgentRun[]> {
    const conditions = [];
    if (filters?.agentType) conditions.push(eq(agentRuns.agentType, filters.agentType));
    if (filters?.entityId) conditions.push(eq(agentRuns.entityId, filters.entityId));
    if (filters?.status) conditions.push(eq(agentRuns.status, filters.status));

    const query = db.select().from(agentRuns).orderBy(desc(agentRuns.startedAt));
    const rows = await (conditions.length > 0 ? query.where(and(...conditions)) : query);

    return rows.map((r) => this.mapToAgentRun(r));
  }

  async listByEntity(entityId: string): Promise<AgentRun[]> {
    return this.list({ entityId });
  }

  private mapToAgentRun(row: typeof agentRuns.$inferSelect): AgentRun {
    return {
      id: row.id,
      agentId: row.agentId,
      agentType: row.agentType,
      entityType: row.entityType,
      entityId: row.entityId,
      conversationId: row.conversationId,
      userId: row.userId,
      status: row.status as AgentRunStatus,
      provider: row.provider,
      model: row.model,
      roundCount: row.roundCount,
      totalDuration: row.totalDuration,
      finalResponse: row.finalResponse,
      startedAt: row.startedAt.toISOString(),
      completedAt: row.completedAt ? row.completedAt.toISOString() : null,
      inputReference: row.inputReference,
      outputReference: (row.outputReference as Record<string, unknown>) || null,
      error: row.error,
      metadata: (row.metadata as Record<string, unknown>) || null,
    };
  }
}

export const agentRunRepository = new AgentRunRepository();
