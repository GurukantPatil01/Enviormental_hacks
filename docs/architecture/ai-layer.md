# EcoPulse AI & Vision Architecture

## 1. Design Philosophy

EcoPulse decouples artificial intelligence algorithms from specific cloud providers or foundation model vendors. 

**Core Rules:**
1. **Never store unvalidated LLM output directly as domain state.** All model outputs must validate against Zod schemas (`environmentalObservationSchema`).
2. **Local development defaults to zero-cost mocks.** `MockVisionProvider` and `MockEmbeddingProvider` operate deterministically in CI and local setups.
3. **Foundation models are swappable.** Amazon Bedrock (Claude 3.5 Sonnet, Titan Embeddings) is an adapter behind a standard interface. Self-hosted models (ONNX, Ollama, HuggingFace MiniLM) are supported without code rewrites.

---

## 2. Vision AI Provider Abstraction

```typescript
export interface VisionAIProvider {
  getProviderName(): string;
  getModelName(): string;
  analyzeEnvironmentalEvidence(input: VisionAnalysisInput): Promise<EnvironmentalObservationResult>;
}
```

### Provider Implementations

1. **`MockVisionProvider` (Default Local Mode)**
   - Inspects image filename, hints, and heuristics to simulate classification.
   - Guaranteed deterministic results for fast automated test suites.
   - Zero API latency and $0.00 cloud cost.

2. **`LocalVisionProvider` (Self-Hosted / Hybrid Mode)**
   - Interfaces with local ONNX/TensorFlow runtime or lightweight multimodal edge model for offline inference.

3. **`BedrockVisionProvider` (AWS Production Mode)**
   - Utilizes `@aws-sdk/client-bedrock-runtime` using `InvokeModelCommand`.
   - Supports `anthropic.claude-3-5-sonnet-20241022-v2:0` or `anthropic.claude-3-haiku-20240307-v1:0`.
   - Formulates structured prompts with JSON schema constraints and validates the returned payload.

---

## 3. Validated Observation Schema

Every observation produced by any provider must parse successfully against `environmentalObservationSchema`:

```typescript
export const environmentalObservationSchema = z.object({
  wasteType: z.string().min(1),
  secondaryWasteTypes: z.array(z.string()).default([]),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  confidence: z.number().min(0).max(1),
  estimatedVolume: z.string().optional(),
  environmentalRisk: z.string().optional(),
  publicSafetyRisk: z.string().optional(),
  illegalDumpingLikelihood: z.number().min(0).max(1).optional(),
  description: z.string(),
  recommendedAction: z.string(),
  detectedObjects: z.array(z.string()).default([]),
  model: z.string(),
  provider: z.string(),
});
```

---

## 4. Embedding Provider & Vector Search Architecture

EcoPulse uses semantic vector search to find visually and textually related environmental events (e.g. repeated dumping patterns by the same vehicle or recurring chemical leaks along a riverbank).

### Provider Abstraction
```typescript
export interface EmbeddingProvider {
  getProviderName(): string;
  embedText(text: string): Promise<number[]>;
  embedImage?(buffer: Buffer): Promise<number[]>;
}
```

### PostgreSQL + pgvector Foundation
Instead of requiring expensive managed vector databases like Amazon OpenSearch Serverless, EcoPulse stores vector representations directly inside PostgreSQL using the `pgvector` extension:

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS environmental_embeddings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL,
  provider VARCHAR(50) DEFAULT 'mock' NOT NULL,
  model VARCHAR(100) DEFAULT 'mock-embed-v1' NOT NULL,
  modality VARCHAR(50) DEFAULT 'TEXT' NOT NULL,
  dimensions INTEGER DEFAULT 384 NOT NULL,
  vector JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
```

### Combined Semantic & Geographic Query
The `VectorRepository.searchSimilar` method pairs cosine similarity with Haversine spherical distance calculation to answer spatial-semantic questions like:
> *"Find visually or textually similar illegal dumping incidents within 2 km of coordinates (18.5204, 73.8567)."*
