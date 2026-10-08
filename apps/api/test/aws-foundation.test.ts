import { randomUUID } from "node:crypto";
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { ecoPulseEventSchema, environmentalObservationSchema } from "@ecopulse/validation";
import type { EcoPulseEvent } from "@ecopulse/types";
import { pool, db } from "../src/db/index.js";
import { runMigrations } from "../src/db/migrate.js";
import { LocalEventBus } from "../src/events/event-bus.js";
import { LocalObjectStorage, validateStorageKey } from "../src/services/storage.service.js";
import { MockVisionProvider } from "../src/agents/ai-provider.js";
import { MockEmbeddingProvider } from "../src/ai/embedding-provider.js";
import { VectorRepository, cosineSimilarity, haversineDistanceMeters } from "../src/repositories/vector.repository.js";
import { HotspotAnalyzer } from "../src/services/hotspot.service.js";
import { toolRegistry } from "../src/agent/tool-registry.js";
import { MockAgentProvider } from "../src/agent/reasoning-provider.js";
import { LocalAgentRuntime } from "../src/agent/runtime.js";
import { InterventionService } from "../src/services/intervention.service.js";
import { EnvironmentalIntelligenceService } from "../src/services/intelligence.service.js";
import { EnvironmentalPipelineService } from "../src/services/pipeline.service.js";
import { environmentalEvents, aiObservations, environmentalEmbeddings, hotspots, interventions } from "../src/db/schema.js";
import { eq } from "drizzle-orm";

describe("EcoPulse AWS-Ready Foundation & Intelligence Layer Tests", () => {
  beforeAll(async () => {
    await runMigrations();
  });

  // 1. Event Schema Validation
  describe("1. Event Schema Validation", () => {
    it("should validate conformant EcoPulseEvent successfully", () => {
      const validEvent: EcoPulseEvent = {
        eventId: randomUUID(),
        eventType: "REPORT_CREATED",
        version: 1,
        source: "ecopulse.test",
        timestamp: new Date().toISOString(),
        correlationId: `corr-${randomUUID()}`,
        payload: { reportId: "rep-101", latitude: 12.9716, longitude: 77.5946 },
      };

      const result = ecoPulseEventSchema.safeParse(validEvent);
      expect(result.success).toBe(true);
    });

    it("should reject event with invalid eventType or missing correlationId", () => {
      const invalidEvent = {
        eventId: randomUUID(),
        eventType: "UNKNOWN_BOGUS_TYPE",
        version: 1,
        source: "ecopulse.test",
        timestamp: new Date().toISOString(),
        payload: {},
      };

      const result = ecoPulseEventSchema.safeParse(invalidEvent);
      expect(result.success).toBe(false);
    });
  });

  // 2. Event Bus Abstraction (Local & Batch)
  describe("2. Event Bus Abstraction", () => {
    it("should publish and subscribe to domain events in-memory without AWS credentials", async () => {
      const eventBus = new LocalEventBus();
      const received: EcoPulseEvent[] = [];

      const unsubscribe = eventBus.subscribe("REPORT_CREATED", (event) => {
        received.push(event);
      });

      const published = await eventBus.publish({
        eventId: randomUUID(),
        eventType: "REPORT_CREATED",
        version: 1,
        source: "ecopulse.api",
        timestamp: new Date().toISOString(),
        correlationId: "corr-1",
        payload: { reportId: "rep-test-bus" },
      });

      expect(published.eventType).toBe("REPORT_CREATED");
      expect(received.length).toBe(1);
      expect(received[0].payload).toEqual({ reportId: "rep-test-bus" });

      unsubscribe();
      await eventBus.publish({
        eventId: randomUUID(),
        eventType: "REPORT_CREATED",
        version: 1,
        source: "ecopulse.api",
        timestamp: new Date().toISOString(),
        correlationId: "corr-2",
        payload: { reportId: "rep-unsubscribed" },
      });

      expect(received.length).toBe(1); // No new events after unsubscribe
    });

    it("should support batch publishing", async () => {
      const eventBus = new LocalEventBus();
      let count = 0;

      eventBus.subscribe("EMBEDDING_CREATED", () => {
        count++;
      });

      const batch: EcoPulseEvent[] = [
        {
          eventId: randomUUID(),
          eventType: "EMBEDDING_CREATED",
          version: 1,
          source: "ecopulse.api",
          timestamp: new Date().toISOString(),
          correlationId: "corr-b1",
          payload: { eventId: "ev-1" },
        },
        {
          eventId: randomUUID(),
          eventType: "EMBEDDING_CREATED",
          version: 1,
          source: "ecopulse.api",
          timestamp: new Date().toISOString(),
          correlationId: "corr-b2",
          payload: { eventId: "ev-2" },
        },
      ];

      await eventBus.publishBatch(batch);
      expect(count).toBe(2);
    });
  });

  // 3. Storage Abstraction (LocalObjectStorage)
  describe("3. Storage Abstraction & Path Sanitization", () => {
    it("should store, retrieve, check existence, generate signed URL, and delete object", async () => {
      const storage = new LocalObjectStorage();
      const key = `reports/test-${Date.now()}/original.jpg`;
      const data = Buffer.from("mock-binary-environmental-evidence-bytes");

      const putRes = await storage.putObject({
        key,
        data,
        contentType: "image/jpeg",
        metadata: { uploaderId: "user-123" },
      });

      expect(putRes.key).toBe(key);
      expect(putRes.bytes).toBe(data.length);

      const exists = await storage.exists(key);
      expect(exists).toBe(true);

      const retrieved = await storage.getObject(key);
      expect(retrieved.toString()).toBe("mock-binary-environmental-evidence-bytes");

      const signedUrl = await storage.getSignedUrl(key, "getObject", 300);
      expect(signedUrl).toContain("/uploads/");

      await storage.deleteObject(key);
      const existsAfter = await storage.exists(key);
      expect(existsAfter).toBe(false);
    });

    it("should reject directory traversal attempts in storage keys", () => {
      expect(() => validateStorageKey("../../etc/passwd")).toThrow();
    });
  });

  // 4. AI Provider Abstraction
  describe("4. AI Provider Abstraction (Zero Bedrock Mandatory Cost)", () => {
    it("should return validated structured EnvironmentalObservation from MockVisionProvider", async () => {
      const provider = new MockVisionProvider();
      expect(provider.getProviderName()).toBe("MOCK");

      const observation = await provider.analyzeEnvironmentalEvidence({
        evidenceId: "ev-mock-1",
        mediaUrl: "reports/rep-1/original.jpg",
      });

      // Validate schema conformance
      const parsed = environmentalObservationSchema.safeParse(observation);
      expect(parsed.success).toBe(true);
      expect(observation.wasteType).toBeDefined();
      expect(observation.severity).toBeDefined();
      expect(observation.confidence).toBeGreaterThan(0.5);
      expect(observation.recommendedAction).toBeDefined();
    });
  });

  // 5. Embedding Provider & Vector Search
  describe("5. Embedding Provider & Vector Repository", () => {
    it("should generate deterministic embeddings and compute cosine similarity", async () => {
      const embedder = new MockEmbeddingProvider();
      const vec1 = await embedder.embedText("severe open garbage dumping near drain");
      const vec2 = await embedder.embedText("severe open garbage dumping near storm drain");
      const vec3 = await embedder.embedText("pristine clean park with green trees");

      expect(vec1.length).toBe(384);
      expect(vec2.length).toBe(384);

      const sim12 = cosineSimilarity(vec1, vec2);
      const sim13 = cosineSimilarity(vec1, vec3);

      expect(sim12).toBeGreaterThan(sim13); // Semantically close texts should have higher similarity
    });

    it("should compute Haversine distance correctly for Indian coordinates", () => {
      // Bangalore MG Road to Indiranagar (~4.2 km)
      const lat1 = 12.9756, lon1 = 77.6066;
      const lat2 = 12.9784, lon2 = 77.6408;

      const distMeters = haversineDistanceMeters(lat1, lon1, lat2, lon2);
      expect(distMeters).toBeGreaterThan(3500);
      expect(distMeters).toBeLessThan(4500);
    });

    it("should store embedding in VectorRepository and perform radius search", async () => {
      const vectorRepo = new VectorRepository();
      const testEventId = randomUUID();
      const testReportId = randomUUID();

      // Seed an environmental event
      await db.insert(environmentalEvents).values({
        id: testEventId,
        reportId: testReportId,
        userId: "user-test",
        latitude: 18.5204,
        longitude: 73.8567,
        description: "Plastic dump along riverbed",
        status: "reported",
      });

      const embedder = new MockEmbeddingProvider();
      const vector = await embedder.embedText("Plastic dump along riverbed");

      await vectorRepo.insertEmbedding({
        eventId: testEventId,
        provider: "MOCK",
        model: "mock-embed-v1",
        dimensions: vector.length,
        vector,
      });

      // Search within 5 km of Pune center
      const results = await vectorRepo.searchSimilar(vector, {
        limit: 5,
        minSimilarity: 0.8,
        centerLat: 18.5204,
        centerLng: 73.8567,
        maxDistanceMeters: 5000,
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.eventId === testEventId)).toBe(true);
    });
  });

  // 6. Hotspot Engine
  describe("6. Hotspot Engine Spatial Clustering & Recurrence Weighting", () => {
    it("should cluster nearby environmental events into a hotspot", async () => {
      const analyzer = new HotspotAnalyzer();

      // Seed 3 clustered events around Shivajinagar, Pune
      const clusterBaseLat = 18.5300;
      const clusterBaseLng = 73.8500;

      for (let i = 0; i < 3; i++) {
        await db.insert(environmentalEvents).values({
          id: randomUUID(),
          reportId: randomUUID(),
          userId: "user-cluster",
          latitude: clusterBaseLat + i * 0.0005, // within ~60 meters
          longitude: clusterBaseLng + i * 0.0005,
          description: `Industrial chemical discharge event ${i}`,
          status: "reported",
          severity: "HIGH",
        });
      }

      const detected = await analyzer.detectHotspots();
      expect(Array.isArray(detected)).toBe(true);
      expect(detected.length).toBeGreaterThan(0);

      const cluster = detected.find((h) => 
        Math.abs(h.centerLatitude - clusterBaseLat) < 0.01 &&
        Math.abs(h.centerLongitude - clusterBaseLng) < 0.01
      );

      expect(cluster).toBeDefined();
      if (cluster) {
        expect(cluster.reportCount).toBeGreaterThanOrEqual(3);
        expect(cluster.score).toBeGreaterThan(0);
        expect(["ACTIVE", "CRITICAL", "EMERGING"]).toContain(cluster.status);
      }
    });
  });

  // 7. Typed Agent Tool Registry & Authorization
  describe("7. Agent Tool Registry", () => {
    it("should register and list all 19 typed tools", () => {
      const tools = toolRegistry.listTools();
      expect(tools.length).toBe(19);

      const overviewTool = toolRegistry.getTool("get_environmental_overview");
      expect(overviewTool).toBeDefined();
      expect(overviewTool?.name).toBe("get_environmental_overview");
    });

    it("should enforce authorization barriers on privileged tools", async () => {
      // recommend_intervention requires SUPERVISOR or ADMIN
      await expect(
        toolRegistry.execute(
          "recommend_intervention",
          { hotspotId: randomUUID(), reason: "Severe debris accumulation" },
          { runId: "r-1", conversationId: "c-1", role: "RESIDENT" }
        )
      ).rejects.toThrow(/Unauthorized/);
    });
  });

  // 8. Multi-Round Agent Execution Loop
  describe("8. Multi-Round Agent Execution Loop", () => {
    it("should execute multi-round reasoning loop, call tools, and record steps", async () => {
      const provider = new MockAgentProvider();
      const runtime = new LocalAgentRuntime(toolRegistry, provider, db);

      const result = await runtime.execute("What are the active hotspots and waste distribution?", {
        conversationId: `conv-${Date.now()}`,
        userId: "officer-42",
        role: "SUPERVISOR",
        maxRounds: 4,
      });

      expect(result.run.status).toBe("completed");
      expect(result.steps.length).toBeGreaterThan(0);
      expect(result.finalResponse).toBeDefined();
      expect(result.run.roundCount).toBe(result.steps.length);
      expect(result.run.totalDuration).toBeGreaterThanOrEqual(0);
    });

    it("should respect round budget limit without uncontrolled looping", async () => {
      // Mock provider that always calls a tool
      const infiniteToolProvider = {
        getProviderName: () => "MOCK",
        decideNextStep: async (_prompt: string, history: any[]) => ({
          thought: `Round ${history.length + 1} inspection`,
          toolCall: { toolName: "get_environmental_overview", input: {} },
        }),
      };

      const runtime = new LocalAgentRuntime(toolRegistry, infiniteToolProvider, db);
      const maxRounds = 3;

      const result = await runtime.execute("Loop test query", {
        conversationId: `conv-loop-${Date.now()}`,
        maxRounds,
      });

      expect(result.steps.length).toBe(maxRounds);
      expect(result.run.status).toBe("completed");
      expect(result.finalResponse).toContain("maximum round budget");
    });
  });

  // 9. Intervention Service & Human Approval Boundary
  describe("9. Intervention Service & Human Approval Gate", () => {
    it("should enforce explicit supervisor approval before execution can start", async () => {
      const service = new InterventionService(db);

      // AI recommends an intervention -> created in draft status
      const draft = await service.createIntervention({
        type: "MUNICIPAL_CLEANUP",
        priority: "high",
        notes: "Severe overflow blocked pedestrian pathway",
        createdByAI: true,
      });

      expect(draft.status).toBe("draft");

      // Starting without approval MUST fail
      await expect(service.startIntervention(draft.id)).rejects.toThrow(/Human authorization required/);

      // Supervisor approves
      const approved = await service.approveIntervention(draft.id, "supervisor-patil", "Approved for immediate morning dispatch");
      expect(approved.status).toBe("approved");

      // Now start can succeed
      const started = await service.startIntervention(draft.id, "Ward-5-Sanitation-Team");
      expect(started.status).toBe("in_progress");

      // Complete intervention
      const completed = await service.completeIntervention(draft.id, "Cleared 2 tons of debris successfully");
      expect(completed.status).toBe("completed");

      // Measure outcome
      const outcome = await service.measureOutcome({
        interventionId: draft.id,
        beforeReportRate: 10,
        afterReportRate: 2,
        beforeSeverity: 4.0,
        afterSeverity: 1.0,
        beforeHotspotSize: 500,
        afterHotspotSize: 50,
      });

      expect(outcome.successScore).toBeGreaterThan(0.7);
    });
  });

  // 10. End-to-End Pipeline & Idempotency
  describe("10. Asynchronous Event-Driven Pipeline & Idempotency", () => {
    it("should execute full event flow: REPORT_CREATED -> AI -> EMBEDDING -> HOTSPOT and maintain idempotency", async () => {
      const eventBus = new LocalEventBus();
      const visionProvider = new MockVisionProvider();
      const embeddingProvider = new MockEmbeddingProvider();
      const vectorRepo = new VectorRepository();
      const hotspotAnalyzer = new HotspotAnalyzer();

      const pipeline = new EnvironmentalPipelineService({
        db,
        eventBus,
        visionProvider,
        embeddingProvider,
        vectorRepo,
        hotspotAnalyzer,
      });

      pipeline.registerLocalSubscribers();

      const testReportId = randomUUID();
      const correlationId = `corr-${randomUUID()}`;

      // Trigger initial event
      await eventBus.publish({
        eventId: randomUUID(),
        eventType: "REPORT_CREATED",
        version: 1,
        source: "ecopulse.mobile",
        timestamp: new Date().toISOString(),
        correlationId,
        payload: {
          reportId: testReportId,
          latitude: 18.5204,
          longitude: 73.8567,
          description: "Major dump of e-waste and batteries into roadside canal",
        },
      });

      // Small grace period for synchronous in-memory dispatch to complete
      await new Promise((r) => setTimeout(r, 100));

      // Verify EnvironmentalEvent exists
      const [ev] = await db.select().from(environmentalEvents).where(eq(environmentalEvents.id, testReportId));
      expect(ev).toBeDefined();

      // Verify AIObservation created
      const [obs] = await db.select().from(aiObservations).where(eq(aiObservations.eventId, testReportId));
      expect(obs).toBeDefined();
      expect(obs.wasteType).toBeDefined();

      // Verify EnvironmentalEmbedding created
      const [emb] = await db.select().from(environmentalEmbeddings).where(eq(environmentalEmbeddings.eventId, testReportId));
      expect(emb).toBeDefined();

      // IDEMPOTENCY TEST: Process the same event again; it should not duplicate AIObservation
      const initialObsCount = (await db.select().from(aiObservations).where(eq(aiObservations.eventId, testReportId))).length;
      await pipeline.processAIAnalysis({
        eventId: randomUUID(),
        eventType: "AI_ANALYSIS_REQUESTED",
        version: 1,
        source: "ecopulse.test",
        timestamp: new Date().toISOString(),
        correlationId,
        payload: {
          eventId: testReportId,
          reportId: testReportId,
        },
      });

      const secondObsCount = (await db.select().from(aiObservations).where(eq(aiObservations.eventId, testReportId))).length;
      expect(secondObsCount).toBe(initialObsCount);
    });
  });
});
