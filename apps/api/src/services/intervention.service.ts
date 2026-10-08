import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { AppDatabase } from "../db/index.js";
import { interventions, interventionOutcomes, hotspots } from "../db/schema.js";
import type { Intervention, InterventionOutcome } from "@ecopulse/types";

export interface CreateInterventionInput {
  hotspotId?: string;
  type: string;
  priority: "low" | "medium" | "high" | "critical";
  assignedTeam?: string;
  notes?: string;
  createdByAI?: boolean;
}

export interface MeasureOutcomeInput {
  interventionId: string;
  beforeReportRate: number;
  afterReportRate: number;
  beforeSeverity: number;
  afterSeverity: number;
  beforeHotspotSize: number;
  afterHotspotSize: number;
}

export class InterventionService {
  constructor(private readonly db: AppDatabase) {}

  async listInterventions(status?: string): Promise<Intervention[]> {
    const query = this.db.select().from(interventions);
    const results = status ? await query.where(eq(interventions.status, status)) : await query;
    return results.map((r: any) => ({
      id: r.id,
      hotspotId: r.hotspotId ?? undefined,
      type: r.type,
      priority: r.priority as Intervention["priority"],
      status: r.status as Intervention["status"],
      assignedTeam: r.assignedTeam ?? undefined,
      createdAt: r.createdAt.toISOString(),
      startedAt: r.startedAt?.toISOString(),
      completedAt: r.completedAt?.toISOString(),
      notes: r.notes ?? undefined,
    }));
  }

  async getIntervention(id: string): Promise<Intervention | null> {
    const [row] = await this.db.select().from(interventions).where(eq(interventions.id, id)).limit(1);
    if (!row) return null;
    return {
      id: row.id,
      hotspotId: row.hotspotId ?? undefined,
      type: row.type,
      priority: row.priority as Intervention["priority"],
      status: row.status as Intervention["status"],
      assignedTeam: row.assignedTeam ?? undefined,
      createdAt: row.createdAt.toISOString(),
      startedAt: row.startedAt?.toISOString(),
      completedAt: row.completedAt?.toISOString(),
      notes: row.notes ?? undefined,
    };
  }

  async listOutcomes(): Promise<InterventionOutcome[]> {
    const results = await this.db.select().from(interventionOutcomes);
    return results.map((r: any) => ({
      id: r.id,
      interventionId: r.interventionId,
      beforeReportRate: Number(r.beforeReportRate),
      afterReportRate: Number(r.afterReportRate),
      beforeSeverity: Number(r.beforeSeverity),
      afterSeverity: Number(r.afterSeverity),
      beforeHotspotSize: Number(r.beforeHotspotSize),
      afterHotspotSize: Number(r.afterHotspotSize),
      successScore: Number(r.successScore),
      measuredAt: r.measuredAt.toISOString(),
    }));
  }

  /**
   * Creates an intervention proposal. If initiated by AI, the status is ALWAYS "draft"
   * and requires explicit human approval before execution can start.
   */
  async createIntervention(input: CreateInterventionInput): Promise<Intervention> {
    const id = randomUUID();
    const status: Intervention["status"] = "draft"; // Always start as draft for human review

    const [created] = await this.db
      .insert(interventions)
      .values({
        id,
        hotspotId: input.hotspotId ?? null,
        type: input.type,
        priority: input.priority,
        status,
        assignedTeam: input.assignedTeam ?? null,
        notes: input.notes ?? (input.createdByAI ? "Recommended by EcoPulse AI. Awaiting supervisor approval." : null),
        createdAt: new Date(),
      })
      .returning();

    return {
      id: created.id,
      hotspotId: created.hotspotId ?? undefined,
      type: created.type,
      priority: created.priority as Intervention["priority"],
      status: created.status as Intervention["status"],
      assignedTeam: created.assignedTeam ?? undefined,
      createdAt: created.createdAt.toISOString(),
      notes: created.notes ?? undefined,
    };
  }

  /**
   * Explicit human supervisor approval gate.
   * Consequential actions cannot proceed without this.
   */
  async approveIntervention(id: string, approvedByUserId: string, notes?: string): Promise<Intervention> {
    const existing = await this.getIntervention(id);
    if (!existing) {
      throw new Error(`Intervention ${id} not found.`);
    }

    if (existing.status !== "draft") {
      throw new Error(`Cannot approve intervention with status '${existing.status}'.`);
    }

    const updatedNotes = [existing.notes, notes ? `Approved by ${approvedByUserId}: ${notes}` : `Approved by ${approvedByUserId}`]
      .filter(Boolean)
      .join(" | ");

    const [updated] = await this.db
      .update(interventions)
      .set({
        status: "approved",
        notes: updatedNotes,
      })
      .where(eq(interventions.id, id))
      .returning();

    return {
      id: updated.id,
      hotspotId: updated.hotspotId ?? undefined,
      type: updated.type,
      priority: updated.priority as Intervention["priority"],
      status: updated.status as Intervention["status"],
      assignedTeam: updated.assignedTeam ?? undefined,
      createdAt: updated.createdAt.toISOString(),
      startedAt: updated.startedAt?.toISOString(),
      completedAt: updated.completedAt?.toISOString(),
      notes: updated.notes ?? undefined,
    };
  }

  async startIntervention(id: string, team?: string): Promise<Intervention> {
    const existing = await this.getIntervention(id);
    if (!existing) throw new Error(`Intervention ${id} not found.`);
    if (existing.status !== "approved") {
      throw new Error(`Cannot start intervention '${id}' because it has not been approved (current status: ${existing.status}). Human authorization required.`);
    }

    const [updated] = await this.db
      .update(interventions)
      .set({
        status: "in_progress",
        assignedTeam: team ?? existing.assignedTeam,
        startedAt: new Date(),
      })
      .where(eq(interventions.id, id))
      .returning();

    return {
      id: updated.id,
      hotspotId: updated.hotspotId ?? undefined,
      type: updated.type,
      priority: updated.priority as Intervention["priority"],
      status: updated.status as Intervention["status"],
      assignedTeam: updated.assignedTeam ?? undefined,
      createdAt: updated.createdAt.toISOString(),
      startedAt: updated.startedAt?.toISOString(),
      completedAt: updated.completedAt?.toISOString(),
      notes: updated.notes ?? undefined,
    };
  }

  async completeIntervention(id: string, notes?: string): Promise<Intervention> {
    const existing = await this.getIntervention(id);
    if (!existing) throw new Error(`Intervention ${id} not found.`);
    if (existing.status !== "in_progress") {
      throw new Error(`Cannot complete intervention with status '${existing.status}'. Must be 'in_progress'.`);
    }

    const updatedNotes = [existing.notes, notes].filter(Boolean).join(" | ");

    const [updated] = await this.db
      .update(interventions)
      .set({
        status: "completed",
        completedAt: new Date(),
        notes: updatedNotes,
      })
      .where(eq(interventions.id, id))
      .returning();

    return {
      id: updated.id,
      hotspotId: updated.hotspotId ?? undefined,
      type: updated.type,
      priority: updated.priority as Intervention["priority"],
      status: updated.status as Intervention["status"],
      assignedTeam: updated.assignedTeam ?? undefined,
      createdAt: updated.createdAt.toISOString(),
      startedAt: updated.startedAt?.toISOString(),
      completedAt: updated.completedAt?.toISOString(),
      notes: updated.notes ?? undefined,
    };
  }

  /**
   * Quantifies the ecological & operational outcome of an intervention.
   * Calculates a composite success score between 0.0 and 1.0.
   */
  async measureOutcome(input: MeasureOutcomeInput): Promise<InterventionOutcome> {
    const id = randomUUID();

    // Compute reduction factors (bounded between 0 and 1)
    const rateReduction = input.beforeReportRate > 0 
      ? Math.max(0, Math.min(1, (input.beforeReportRate - input.afterReportRate) / input.beforeReportRate))
      : 0;

    const severityReduction = input.beforeSeverity > 0
      ? Math.max(0, Math.min(1, (input.beforeSeverity - input.afterSeverity) / input.beforeSeverity))
      : 0;

    const sizeReduction = input.beforeHotspotSize > 0
      ? Math.max(0, Math.min(1, (input.beforeHotspotSize - input.afterHotspotSize) / input.beforeHotspotSize))
      : 0;

    // Weighted composite success score
    const successScore = Number((0.4 * rateReduction + 0.35 * severityReduction + 0.25 * sizeReduction).toFixed(4));

    const [created] = await this.db
      .insert(interventionOutcomes)
      .values({
        id,
        interventionId: input.interventionId,
        beforeReportRate: input.beforeReportRate,
        afterReportRate: input.afterReportRate,
        beforeSeverity: input.beforeSeverity,
        afterSeverity: input.afterSeverity,
        beforeHotspotSize: input.beforeHotspotSize,
        afterHotspotSize: input.afterHotspotSize,
        successScore,
        measuredAt: new Date(),
      })
      .returning();

    return {
      id: created.id,
      interventionId: created.interventionId,
      beforeReportRate: created.beforeReportRate,
      afterReportRate: created.afterReportRate,
      beforeSeverity: created.beforeSeverity,
      afterSeverity: created.afterSeverity,
      beforeHotspotSize: created.beforeHotspotSize,
      afterHotspotSize: created.afterHotspotSize,
      successScore: created.successScore,
      measuredAt: created.measuredAt.toISOString(),
    };
  }
}
