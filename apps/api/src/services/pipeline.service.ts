import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { AppDatabase } from "../db/index.js";
import { environmentalEvents, aiObservations, hotspots } from "../db/schema.js";
import type { IEventBus } from "../events/event-bus.js";
import type { VisionAIProvider } from "../agents/ai-provider.js";
import type { EmbeddingProvider } from "../ai/embedding-provider.js";
import type { VectorRepository } from "../repositories/vector.repository.js";
import type { HotspotAnalyzer } from "./hotspot.service.js";
import type { EcoPulseEvent } from "@ecopulse/types";

export interface PipelineDependencies {
  db: AppDatabase;
  eventBus: IEventBus;
  visionProvider: VisionAIProvider;
  embeddingProvider: EmbeddingProvider;
  vectorRepo: VectorRepository;
  hotspotAnalyzer: HotspotAnalyzer;
}

export class EnvironmentalPipelineService {
  constructor(private readonly deps: PipelineDependencies) {}

  /**
   * Stage 1: Handles REPORT_CREATED and EVIDENCE_UPLOADED.
   * Ensures an EnvironmentalEvent domain entity exists (idempotently),
   * then transitions the pipeline by requesting AI analysis.
   */
  async processReport(event: EcoPulseEvent): Promise<void> {
    const payload = event.payload as {
      reportId: string;
      userId?: string;
      latitude?: number;
      longitude?: number;
      description?: string;
      imageKey?: string;
    };

    const eventId = payload.reportId;
    const existing = await this.deps.db
      .select()
      .from(environmentalEvents)
      .where(eq(environmentalEvents.id, eventId))
      .limit(1);

    if (existing.length === 0) {
      await this.deps.db.insert(environmentalEvents).values({
        id: eventId,
        reportId: payload.reportId,
        userId: payload.userId ?? "anonymous",
        timestamp: new Date(event.timestamp),
        latitude: payload.latitude ?? 12.9716,
        longitude: payload.longitude ?? 77.5946,
        description: payload.description ?? "Environmental report logged",
        status: "reported",
        source: event.source,
      });
    }

    // Publish next stage event
    await this.deps.eventBus.publish({
      eventId: randomUUID(),
      eventType: "AI_ANALYSIS_REQUESTED",
      version: 1,
      source: "ecopulse.pipeline.reportProcessor",
      timestamp: new Date().toISOString(),
      correlationId: event.correlationId,
      payload: {
        eventId,
        reportId: payload.reportId,
        imageKey: payload.imageKey ?? `reports/${payload.reportId}/original.jpg`,
      },
    });
  }

  /**
   * Stage 2: Handles AI_ANALYSIS_REQUESTED.
   * Idempotently runs vision analysis and stores AIObservation.
   * Then requests vector embedding.
   */
  async processAIAnalysis(event: EcoPulseEvent): Promise<void> {
    const payload = event.payload as {
      eventId: string;
      reportId: string;
      imageKey?: string;
    };

    // Idempotency check: don't analyze twice if already analyzed
    const [existing] = await this.deps.db
      .select()
      .from(aiObservations)
      .where(eq(aiObservations.eventId, payload.eventId))
      .limit(1);

    let observationId = existing?.id;

    if (!existing) {
      const observation = await this.deps.visionProvider.analyzeEnvironmentalEvidence({
        evidenceId: payload.reportId,
        mediaUrl: payload.imageKey ?? `reports/${payload.reportId}/original.jpg`,
      });

      observationId = randomUUID();
      await this.deps.db.insert(aiObservations).values({
        id: observationId,
        eventId: payload.eventId,
        modelProvider: this.deps.visionProvider.getProviderName(),
        modelName: "ecopulse-v1",
        wasteType: observation.wasteType,
        secondaryWasteTypes: JSON.stringify(observation.secondaryWasteTypes),
        severity: observation.severity,
        confidence: observation.confidence,
        estimatedVolume: observation.estimatedVolume,
        environmentalRisk: observation.environmentalRisk,
        publicSafetyRisk: observation.publicSafetyRisk,
        illegalDumpingLikelihood: observation.illegalDumpingLikelihood,
        recommendedAction: observation.recommendedAction,
        rawMetadata: JSON.stringify(observation),
      });

      // Update event status to verified/analyzed
      await this.deps.db
        .update(environmentalEvents)
        .set({ status: "analyzed", updatedAt: new Date() })
        .where(eq(environmentalEvents.id, payload.eventId));
    }

    await this.deps.eventBus.publish({
      eventId: randomUUID(),
      eventType: "AI_ANALYSIS_COMPLETED",
      version: 1,
      source: "ecopulse.pipeline.aiProcessor",
      timestamp: new Date().toISOString(),
      correlationId: event.correlationId,
      payload: {
        eventId: payload.eventId,
        observationId,
      },
    });

    await this.deps.eventBus.publish({
      eventId: randomUUID(),
      eventType: "EMBEDDING_REQUESTED",
      version: 1,
      source: "ecopulse.pipeline.aiProcessor",
      timestamp: new Date().toISOString(),
      correlationId: event.correlationId,
      payload: {
        eventId: payload.eventId,
      },
    });
  }

  /**
   * Stage 3: Handles EMBEDDING_REQUESTED.
   * Generates embedding vector and stores in pgvector repository.
   * Triggers hotspot analysis.
   */
  async processEmbedding(event: EcoPulseEvent): Promise<void> {
    const payload = event.payload as { eventId: string };

    // Fetch event details for text embedding
    const [eventRow] = await this.deps.db
      .select()
      .from(environmentalEvents)
      .where(eq(environmentalEvents.id, payload.eventId))
      .limit(1);

    if (!eventRow) return;

    // Fetch observation if available
    const [obs] = await this.deps.db
      .select()
      .from(aiObservations)
      .where(eq(aiObservations.eventId, payload.eventId))
      .limit(1);

    const descriptionToEmbed = [
      eventRow.description,
      obs?.wasteType ? `Waste Type: ${obs.wasteType}` : "",
      obs?.recommendedAction ? `Recommended Action: ${obs.recommendedAction}` : "",
    ]
      .filter(Boolean)
      .join(". ");

    const embeddingVector = await this.deps.embeddingProvider.embedText(descriptionToEmbed);

    await this.deps.vectorRepo.insertEmbedding({
      eventId: payload.eventId,
      provider: this.deps.embeddingProvider.getProviderName(),
      model: "ecopulse-embed-v1",
      modality: "text",
      dimensions: embeddingVector.length,
      vector: embeddingVector,
    });

    await this.deps.eventBus.publish({
      eventId: randomUUID(),
      eventType: "EMBEDDING_CREATED",
      version: 1,
      source: "ecopulse.pipeline.embeddingProcessor",
      timestamp: new Date().toISOString(),
      correlationId: event.correlationId,
      payload: {
        eventId: payload.eventId,
        dimensions: embeddingVector.length,
      },
    });

    await this.deps.eventBus.publish({
      eventId: randomUUID(),
      eventType: "HOTSPOT_ANALYSIS_REQUESTED",
      version: 1,
      source: "ecopulse.pipeline.embeddingProcessor",
      timestamp: new Date().toISOString(),
      correlationId: event.correlationId,
      payload: {
        eventId: payload.eventId,
        latitude: eventRow.latitude,
        longitude: eventRow.longitude,
      },
    });
  }

  /**
   * Stage 4: Handles HOTSPOT_ANALYSIS_REQUESTED.
   * Evaluates spatial/temporal clusters and updates hotspot state.
   */
  async processHotspotAnalysis(event: EcoPulseEvent): Promise<void> {
    // Run hotspot detection
    const detected = await this.deps.hotspotAnalyzer.detectHotspots();

    // Persist or update hotspots
    for (const h of detected) {
      const [existing] = await this.deps.db.select().from(hotspots).where(eq(hotspots.id, h.id)).limit(1);
      if (existing) {
        await this.deps.db
          .update(hotspots)
          .set({
            reportCount: h.reportCount,
            averageSeverity: h.averageSeverity,
            dominantWasteType: h.dominantWasteType,
            trend: h.trend,
            score: h.score,
            status: h.status,
            lastDetectedAt: new Date(h.lastDetectedAt),
          })
          .where(eq(hotspots.id, h.id));
      } else {
        await this.deps.db.insert(hotspots).values({
          id: h.id,
          centerLatitude: h.centerLatitude,
          centerLongitude: h.centerLongitude,
          radius: h.radius,
          reportCount: h.reportCount,
          averageSeverity: h.averageSeverity,
          dominantWasteType: h.dominantWasteType,
          trend: h.trend,
          score: h.score,
          status: h.status,
          firstDetectedAt: new Date(h.firstDetectedAt),
          lastDetectedAt: new Date(h.lastDetectedAt),
        });
      }
    }

    await this.deps.eventBus.publish({
      eventId: randomUUID(),
      eventType: "HOTSPOT_UPDATED",
      version: 1,
      source: "ecopulse.pipeline.hotspotProcessor",
      timestamp: new Date().toISOString(),
      correlationId: event.correlationId,
      payload: {
        totalHotspotsDetected: detected.length,
        hotspotIds: detected.map((h) => h.id),
      },
    });
  }

  /**
   * Wire up local event bus subscriptions to create a self-contained local event pipeline.
   */
  registerLocalSubscribers(): void {
    this.deps.eventBus.subscribe("REPORT_CREATED", async (e) => this.processReport(e));
    this.deps.eventBus.subscribe("EVIDENCE_UPLOADED", async (e) => this.processReport(e));
    this.deps.eventBus.subscribe("AI_ANALYSIS_REQUESTED", async (e) => this.processAIAnalysis(e));
    this.deps.eventBus.subscribe("EMBEDDING_REQUESTED", async (e) => this.processEmbedding(e));
    this.deps.eventBus.subscribe("HOTSPOT_ANALYSIS_REQUESTED", async (e) => this.processHotspotAnalysis(e));
  }
}
