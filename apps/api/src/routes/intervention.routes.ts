import type { FastifyPluginAsync } from "fastify";
import { db } from "../db/index.js";
import { InterventionService } from "../services/intervention.service.js";

export const interventionRoutes: FastifyPluginAsync = async (app) => {
  const interventionService = new InterventionService(db);

  app.get("/api/interventions", async (req, reply) => {
    const query = req.query as { status?: string };
    const items = await interventionService.listInterventions(query.status);
    return reply.send({ success: true, data: items });
  });

  app.get("/api/interventions/outcomes", async (_req, reply) => {
    const outcomes = await interventionService.listOutcomes();
    return reply.send({ success: true, data: outcomes });
  });

  app.get("/api/interventions/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const item = await interventionService.getIntervention(id);
    if (!item) {
      return reply.status(404).send({ success: false, error: "Intervention not found" });
    }
    return reply.send({ success: true, data: item });
  });

  app.post("/api/interventions", async (req, reply) => {
    const body = req.body as {
      hotspotId?: string;
      type: string;
      priority: "low" | "medium" | "high" | "critical";
      assignedTeam?: string;
      notes?: string;
    };

    if (!body?.type || !body?.priority) {
      return reply.status(400).send({ success: false, error: "Missing required fields: type, priority" });
    }

    const created = await interventionService.createIntervention({
      ...body,
      createdByAI: false,
    });

    return reply.status(201).send({ success: true, data: created });
  });

  app.post("/api/interventions/:id/approve", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as { approvedByUserId?: string; notes?: string };

    try {
      const approved = await interventionService.approveIntervention(
        id,
        body?.approvedByUserId ?? "supervisor-console",
        body?.notes,
      );
      return reply.send({ success: true, data: approved });
    } catch (err) {
      return reply.status(400).send({
        success: false,
        error: err instanceof Error ? err.message : "Approval failed",
      });
    }
  });

  app.post("/api/interventions/:id/start", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as { assignedTeam?: string };

    try {
      const started = await interventionService.startIntervention(id, body?.assignedTeam);
      return reply.send({ success: true, data: started });
    } catch (err) {
      return reply.status(400).send({
        success: false,
        error: err instanceof Error ? err.message : "Start failed",
      });
    }
  });

  app.post("/api/interventions/:id/complete", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as { notes?: string };

    try {
      const completed = await interventionService.completeIntervention(id, body?.notes);
      return reply.send({ success: true, data: completed });
    } catch (err) {
      return reply.status(400).send({
        success: false,
        error: err instanceof Error ? err.message : "Completion failed",
      });
    }
  });

  app.post("/api/interventions/:id/outcomes", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as {
      beforeReportRate: number;
      afterReportRate: number;
      beforeSeverity: number;
      afterSeverity: number;
      beforeHotspotSize: number;
      afterHotspotSize: number;
    };

    try {
      const outcome = await interventionService.measureOutcome({
        interventionId: id,
        beforeReportRate: body.beforeReportRate,
        afterReportRate: body.afterReportRate,
        beforeSeverity: body.beforeSeverity,
        afterSeverity: body.afterSeverity,
        beforeHotspotSize: body.beforeHotspotSize,
        afterHotspotSize: body.afterHotspotSize,
      });
      return reply.status(201).send({ success: true, data: outcome });
    } catch (err) {
      return reply.status(400).send({
        success: false,
        error: err instanceof Error ? err.message : "Outcome measurement failed",
      });
    }
  });
};
