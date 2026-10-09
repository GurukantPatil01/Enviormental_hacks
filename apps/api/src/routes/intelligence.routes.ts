import type { FastifyPluginAsync } from "fastify";
import { EnvironmentalIntelligenceService } from "../services/intelligence.service.js";
import { VectorRepository } from "../repositories/vector.repository.js";
import { MockEmbeddingProvider } from "../ai/embedding-provider.js";
import { requireRole } from "../middleware/auth.middleware.js";
import { evidenceProcessingService } from "../services/evidence-processing.service.js";

export const intelligenceRoutes: FastifyPluginAsync = async (app) => {
  const vectorRepo = new VectorRepository();
  const embeddingProvider = new MockEmbeddingProvider();
  const intelligenceService = new EnvironmentalIntelligenceService();

  app.get("/api/intelligence/overview", async (_req, reply) => {
    const overview = await intelligenceService.getOverview();
    return reply.send({ success: true, data: overview });
  });

  app.get("/api/intelligence/events", async (req, reply) => {
    const query = req.query as { limit?: string; status?: string };
    const limit = query.limit ? parseInt(query.limit, 10) : 50;
    const events = await intelligenceService.getEvents({ limit, status: query.status });
    return reply.send({ success: true, data: events });
  });

  app.get("/api/intelligence/events/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const event = await intelligenceService.getEventDetails(id);
    if (!event) {
      return reply.status(404).send({ success: false, error: "Event not found" });
    }
    return reply.send({ success: true, data: event });
  });

  app.post("/api/intelligence/events/:id/status", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as { status: string; reviewerId?: string };
    if (!body?.status) {
      return reply.status(400).send({ success: false, error: "Status is required" });
    }
    try {
      const res = await intelligenceService.updateEventStatus(id, body.status, body.reviewerId);
      return reply.send({ success: true, data: res });
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({ success: false, error: err.message });
    }
  });

  app.post(
    "/api/intelligence/events/:id/reprocess",
    { preHandler: [requireRole("MAINTAINER", "WARD_ADMIN", "SUPER_ADMIN")] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const eventDetails = await intelligenceService.getEventDetails(id);
      if (!eventDetails || !eventDetails.event) {
        return reply.status(404).send({ success: false, error: "Event not found" });
      }

      const reportId = eventDetails.event.report_id || eventDetails.event.reportId;
      const evidence = eventDetails.evidence || [];
      if (!evidence || evidence.length === 0) {
        return reply.status(400).send({ success: false, error: "No evidence found to reprocess" });
      }

      const targetEvidenceId = evidence[0].id;
      await intelligenceService.updateEventStatus(eventDetails.event.id, "PROCESSING", (req as any).user?.id);

      try {
        await evidenceProcessingService.processEvidenceJob({
          evidenceId: targetEvidenceId,
          reportId: reportId || eventDetails.event.id,
          uploaderId: (req as any).user?.id || "system-maintainer",
        });

        const updated = await intelligenceService.getEventDetails(eventDetails.event.id);
        return reply.send({ success: true, data: updated, message: "AI Analysis reprocessed successfully" });
      } catch (err: any) {
        return reply.status(500).send({ success: false, error: err.message || "Reprocessing failed" });
      }
    }
  );

  app.get("/api/intelligence/hotspots", async (req, reply) => {
    const query = req.query as { status?: string };
    const hotspots = await intelligenceService.getHotspots({ status: query.status });
    return reply.send({ success: true, data: hotspots });
  });

  app.get("/api/intelligence/hotspots/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const hotspot = await intelligenceService.getHotspotDetails(id);
    if (!hotspot) {
      return reply.status(404).send({ success: false, error: "Hotspot not found" });
    }
    return reply.send({ success: true, data: hotspot });
  });

  app.get("/api/intelligence/waste-distribution", async (_req, reply) => {
    const distribution = await intelligenceService.getWasteDistribution();
    return reply.send({ success: true, data: distribution });
  });

  app.get("/api/intelligence/severity-distribution", async (_req, reply) => {
    const distribution = await intelligenceService.getSeverityDistribution();
    return reply.send({ success: true, data: distribution });
  });

  app.get("/api/intelligence/timeline", async (req, reply) => {
    const query = req.query as { days?: string };
    const days = query.days ? parseInt(query.days, 10) : 30;
    const timeline = await intelligenceService.getEventTimeline(days);
    return reply.send({ success: true, data: timeline });
  });

  app.post("/api/intelligence/vector-search", async (req, reply) => {
    const body = req.body as {
      text?: string;
      vector?: number[];
      latitude?: number;
      longitude?: number;
      radiusKm?: number;
      limit?: number;
    };

    let queryVector = body.vector;
    if (!queryVector && body.text) {
      queryVector = await embeddingProvider.embedText(body.text);
    }

    if (!queryVector) {
      return reply.status(400).send({ success: false, error: "Either 'text' or 'vector' must be provided." });
    }

    const results = await vectorRepo.searchSimilar(queryVector, {
      limit: body.limit ?? 10,
      centerLat: body.latitude,
      centerLng: body.longitude,
      maxDistanceMeters: body.radiusKm ? body.radiusKm * 1000 : undefined,
    });

    return reply.send({ success: true, data: results });
  });

  app.post("/api/intelligence/pattern-search", async (_req, reply) => {
    const patterns = await intelligenceService.findPatterns();
    return reply.send({ success: true, data: patterns });
  });
};
