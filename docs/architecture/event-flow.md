# Event-Driven Architecture & Report Pipeline

## 1. Overview

EcoPulse utilizes an asynchronous event-driven pipeline to process environmental incident reports, drone imagery, and citizen submissions. Heavy compute tasks (such as vision analysis, vector embedding computation, and geographic hotspot re-clustering) are completely decoupled from user-facing API request paths.

---

## 2. Event-Driven Lifecycle Pipeline

```mermaid
sequenceDiagram
    autonumber
    actor Citizen as Citizen / Mobile App
    participant API as EcoPulse API
    participant Bus as EventBus (Local / EventBridge)
    participant RP as reportProcessor (Lambda)
    participant AI as aiAnalysisProcessor (Lambda)
    participant EP as embeddingProcessor (Lambda)
    participant HP as hotspotProcessor (Lambda)
    participant DB as PostgreSQL + PostGIS

    Citizen->>API: POST /api/reports (Photo + Coordinates)
    API->>DB: Save Report Record
    API->>Bus: Publish REPORT_CREATED
    API-->>Citizen: 201 Created (Instant Response)

    Bus->>RP: Handle REPORT_CREATED
    RP->>DB: Ensure EnvironmentalEvent entity exists
    RP->>Bus: Publish AI_ANALYSIS_REQUESTED

    Bus->>AI: Handle AI_ANALYSIS_REQUESTED
    AI->>AI: Run VisionAIProvider (Analyze Hazard, Waste Type, Severity)
    AI->>DB: Persist AIObservation (Idempotent)
    AI->>Bus: Publish AI_ANALYSIS_COMPLETED
    AI->>Bus: Publish EMBEDDING_REQUESTED

    Bus->>EP: Handle EMBEDDING_REQUESTED
    EP->>EP: Run EmbeddingProvider (Generate 384d vector)
    EP->>DB: Store Embedding in environmental_embeddings (pgvector)
    EP->>Bus: Publish EMBEDDING_CREATED
    EP->>Bus: Publish HOTSPOT_ANALYSIS_REQUESTED

    Bus->>HP: Handle HOTSPOT_ANALYSIS_REQUESTED
    HP->>HP: Run HotspotAnalyzer (Cluster points within 150m, compute score)
    HP->>DB: Upsert Hotspots table
    HP->>Bus: Publish HOTSPOT_UPDATED
```

---

## 3. Standardized Event Envelope Contract

Every domain event emitted across EcoPulse adheres strictly to the `EcoPulseEvent` contract validated via `ecoPulseEventSchema`:

```typescript
export interface EcoPulseEvent<T = Record<string, unknown>> {
  eventId: string;        // Unique UUID for event instance
  eventType: DomainEventType; // Strongly typed enum (e.g. REPORT_CREATED, HOTSPOT_UPDATED)
  version: number;        // Schema version (currently 1)
  source: string;         // Originating subsystem (e.g. ecopulse.api, ecopulse.mobile)
  timestamp: string;      // ISO 8601 UTC timestamp
  correlationId: string;  // Trace correlation ID across multi-stage pipeline
  payload: T;             // Strongly typed payload
  actorId?: string | null;// Authenticated user or system actor ID
}
```

### Supported Domain Event Types

- `REPORT_CREATED`
- `EVIDENCE_UPLOADED`
- `AI_ANALYSIS_REQUESTED`
- `AI_ANALYSIS_COMPLETED`
- `EMBEDDING_REQUESTED`
- `EMBEDDING_CREATED`
- `HOTSPOT_ANALYSIS_REQUESTED`
- `HOTSPOT_UPDATED`
- `INTERVENTION_CREATED`
- `INTERVENTION_COMPLETED`
- `OUTCOME_MEASURED`

---

## 4. Dual-Mode EventBus Abstraction

The event backbone is abstracted behind the `IEventBus` interface:

```typescript
export interface IEventBus {
  publish<T>(eventOrType: DomainEventType | EcoPulseEvent<T>, aggregateId?: string, payload?: T): Promise<EcoPulseEvent<T>>;
  publishBatch<T>(events: EcoPulseEvent<T>[]): Promise<void>;
  subscribe<T>(type: DomainEventType, handler: EventHandler<T>): () => void;
}
```

### `LocalEventBus` (Development & Testing)
- Operates in-process using Node.js event dispatching.
- Requires zero AWS credentials.
- Synchronously tracks execution and handles exceptions without network overhead.

### `AWSEventBridgeBus` (Cloud Staging & Production)
- Routes events directly to Amazon EventBridge custom bus (`ecopulse-events-{env}`).
- Triggers AWS Lambda processors using IAM least-privilege policies.
- Includes automatic fallback to `LocalEventBus` if EventBridge is unreachable or credentials are unconfigured.

---

## 5. Idempotency & Fault Tolerance

In distributed event systems, at-least-once delivery semantics can cause duplicate event deliveries. EcoPulse guarantees idempotency at every stage:
- **`processReport`:** Checks for existing `environmental_events` record matching the `reportId` before inserting.
- **`processAIAnalysis`:** Queries `ai_observations` matching `eventId`; if already analyzed, skips LLM execution and immediately advances the pipeline.
- **`processEmbedding`:** Checks `environmental_embeddings` for existing embeddings on the target event.
- **`processHotspotAnalysis`:** Upserts existing hotspot clusters by matching geographic centroids rather than creating duplicate active hotspots.
