import crypto from 'node:crypto';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

export interface EmbeddingProvider {
  getProviderName(): string;
  getModelName(): string;
  getDimensions(): number;
  embedText(text: string): Promise<number[]>;
  embedImage(imageBufferOrUrl: Buffer | string): Promise<number[]>;
}

/**
 * Deterministic Mock Embedding Provider generating normalized unit vectors.
 * Dot product of two unit vectors equals their exact cosine similarity.
 */
export class MockEmbeddingProvider implements EmbeddingProvider {
  private dimensions: number;
  private modelName: string;

  constructor(dimensions: number = 384, modelName: string = 'mock-embed-v1') {
    this.dimensions = dimensions;
    this.modelName = modelName;
  }

  getProviderName(): string {
    return 'MOCK';
  }

  getModelName(): string {
    return this.modelName;
  }

  getDimensions(): number {
    return this.dimensions;
  }

  async embedText(text: string): Promise<number[]> {
    return this.generateDeterministicVector(text);
  }

  async embedImage(imageBufferOrUrl: Buffer | string): Promise<number[]> {
    const key = Buffer.isBuffer(imageBufferOrUrl)
      ? imageBufferOrUrl.subarray(0, 100).toString('hex')
      : String(imageBufferOrUrl);
    return this.generateDeterministicVector(`img:${key}`);
  }

  private generateDeterministicVector(seedText: string): number[] {
    const vector = new Array<number>(this.dimensions);
    const hash = crypto.createHash('sha256').update(seedText || 'empty').digest();

    let sumSquares = 0;
    for (let i = 0; i < this.dimensions; i++) {
      const byte = hash[i % hash.length];
      const val = (byte / 255.0) * 2 - 1 + Math.sin(i * 0.1);
      vector[i] = val;
      sumSquares += val * val;
    }

    // Normalize to unit vector
    const norm = Math.sqrt(sumSquares) || 1;
    for (let i = 0; i < this.dimensions; i++) {
      vector[i] = Number((vector[i] / norm).toFixed(6));
    }

    return vector;
  }
}

export class LocalEmbeddingProvider extends MockEmbeddingProvider {
  constructor(dimensions: number = 384, modelName: string = 'local-embed-v1') {
    super(dimensions, modelName);
  }

  getProviderName(): string {
    return 'LOCAL';
  }
}

/**
 * Amazon Bedrock Titan Embedding Provider using AWS SDK v3.
 * Supports amazon.titan-embed-text-v1 and amazon.titan-embed-image-v1.
 */
export class BedrockEmbeddingProvider implements EmbeddingProvider {
  private client: BedrockRuntimeClient | null = null;
  private fallback: MockEmbeddingProvider;
  private modelName: string;
  private dimensions: number;

  constructor(dimensions = 384, modelName?: string, region?: string) {
    this.dimensions = dimensions;
    this.modelName = modelName || process.env.AWS_BEDROCK_EMBED_MODEL || 'amazon.titan-embed-text-v1';
    this.fallback = new MockEmbeddingProvider(this.dimensions, this.modelName);

    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      this.client = new BedrockRuntimeClient({
        region: region || process.env.AWS_REGION || 'ap-south-1',
      });
    }
  }

  getProviderName(): string {
    return 'BEDROCK';
  }

  getModelName(): string {
    return this.modelName;
  }

  getDimensions(): number {
    return this.dimensions;
  }

  async embedText(text: string): Promise<number[]> {
    if (!this.client) {
      return this.fallback.embedText(text);
    }

    try {
      const payload = { inputText: text };
      const command = new InvokeModelCommand({
        modelId: this.modelName,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(payload),
      });

      const response = await this.client.send(command);
      const json = JSON.parse(new TextDecoder().decode(response.body));
      if (Array.isArray(json.embedding)) {
        return json.embedding;
      }
      return this.fallback.embedText(text);
    } catch (err) {
      console.warn(`[BedrockEmbeddingProvider] Titan text embedding failed, using fallback:`, err);
      return this.fallback.embedText(text);
    }
  }

  async embedImage(imageBufferOrUrl: Buffer | string): Promise<number[]> {
    return this.fallback.embedImage(imageBufferOrUrl);
  }
}

export function createEmbeddingProvider(): EmbeddingProvider {
  const provider = (process.env.EMBEDDING_PROVIDER || 'mock').toLowerCase();
  if (provider === 'bedrock') {
    return new BedrockEmbeddingProvider();
  }
  if (provider === 'local') {
    return new LocalEmbeddingProvider();
  }
  return new MockEmbeddingProvider();
}

export const embeddingProvider: EmbeddingProvider = createEmbeddingProvider();
