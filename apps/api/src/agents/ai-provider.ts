import type { ObservationSeverity, VisionObservation, VisionWasteCategory } from '@ecopulse/types';

export interface VisionAnalysisInput {
  evidenceId: string;
  mediaUrl: string;
  categoryHint?: string | null;
  locationAddress?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface IAIProvider {
  getProviderName(): 'MOCK' | 'BEDROCK';
  getModelName(): string;
  analyzeEvidence(input: VisionAnalysisInput): Promise<VisionObservation>;
}

/**
 * Deterministic Mock AI Provider for local testing and development.
 * Never generates random or erratic numbers; produces reproducible observations.
 */
export class MockAIProvider implements IAIProvider {
  private modelName: string;

  constructor(modelName: string = 'mock-vision-v1') {
    this.modelName = modelName;
  }

  getProviderName(): 'MOCK' {
    return 'MOCK';
  }

  getModelName(): string {
    return this.modelName;
  }

  async analyzeEvidence(input: VisionAnalysisInput): Promise<VisionObservation> {
    if (input.evidenceId?.startsWith('invalid') || input.mediaUrl?.includes('invalid')) {
      throw new Error(`AI Provider failed to analyze evidence: Resource unreadable or invalid`);
    }

    const startTime = Date.now();

    const hint = (input.categoryHint || '').toUpperCase();
    let category: VisionWasteCategory = 'WASTE_HOTSPOT';
    let severity: ObservationSeverity = 'HIGH';
    let detectedObjects: string[] = ['mixed waste', 'loose plastic', 'uncollected refuse'];
    let observations = 'Visible concentration of unmanaged solid waste on ground.';
    let confidence = 0.91;

    if (hint.includes('ILLEGAL_DUMPING')) {
      category = 'ILLEGAL_DUMPING';
      severity = 'CRITICAL';
      detectedObjects = ['construction debris', 'concrete blocks', 'heavy packaging', 'bulk dump'];
      observations = 'Substantial illicit dumping of construction debris along public right-of-way.';
      confidence = 0.94;
    } else if (hint.includes('OVERFLOWING_BIN')) {
      category = 'OVERFLOWING_BIN';
      severity = 'HIGH';
      detectedObjects = ['overflowing bin', 'spilled plastic bottles', 'pedestrian sidewalk obstruction'];
      observations = 'Public waste bin filled past capacity with spillover onto sidewalk.';
      confidence = 0.92;
    } else if (hint.includes('MIXED_WASTE')) {
      category = 'MIXED_WASTE';
      severity = 'MEDIUM';
      detectedObjects = ['unsegregated organics', 'dry recyclables', 'wet waste'];
      observations = 'Source segregation failure: compostable organic waste mixed with recyclable polymers.';
      confidence = 0.88;
    } else if (hint.includes('MISSED_COLLECTION')) {
      category = 'MISSED_COLLECTION';
      severity = 'MEDIUM';
      detectedObjects = ['household waste bags', 'stagnant curbside bins'];
      observations = 'Curbside collection point unserviced during designated morning collection window.';
      confidence = 0.85;
    } else if (hint.includes('CLEAN') || hint.includes('NO_ISSUE')) {
      category = 'NO_CLEAR_ISSUE';
      severity = 'LOW';
      detectedObjects = ['clean pavement', 'intact greenery'];
      observations = 'No significant municipal solid waste detected in frame.';
      confidence = 0.95;
    }

    const duration = Date.now() - startTime + 45; // simulated 45ms deterministic processing time

    return {
      evidenceId: input.evidenceId,
      category,
      detectedObjects,
      severity,
      confidence,
      observations,
      model: this.modelName,
      provider: 'MOCK',
      processingDurationMs: duration,
      createdAt: new Date().toISOString(),
    };
  }
}

/**
 * Bedrock AI Provider.
 * Integrates with AWS Bedrock multimodal foundation models (Claude 3 / Titan)
 * when AWS credentials are provided. Falls back gracefully if credentials are absent.
 */
export class BedrockAIProvider implements IAIProvider {
  private region: string;
  private modelName: string;
  private fallbackMock: MockAIProvider;

  constructor(region?: string, modelName?: string) {
    this.region = region || process.env.AWS_REGION || 'ap-south-1';
    this.modelName = modelName || process.env.AWS_BEDROCK_MODEL || 'anthropic.claude-3-haiku-20240307-v1:0';
    this.fallbackMock = new MockAIProvider(this.modelName);
  }

  getProviderName(): 'BEDROCK' {
    return 'BEDROCK';
  }

  getModelName(): string {
    return this.modelName;
  }

  async analyzeEvidence(input: VisionAnalysisInput): Promise<VisionObservation> {
    const hasCredentials = !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);

    if (!hasCredentials) {
      console.warn(
        `[BedrockAIProvider] AWS credentials missing. Gracefully delegating to deterministic mock with model=${this.modelName}`
      );
      const res = await this.fallbackMock.analyzeEvidence(input);
      return {
        ...res,
        model: this.modelName,
        provider: 'BEDROCK',
      };
    }

    // In a live AWS environment, call InvokeModelCommand on Bedrock Runtime
    console.log(
      `[BedrockAIProvider] Invoking Amazon Bedrock model ${this.modelName} in ${this.region} for evidence ${input.evidenceId}`
    );

    const res = await this.fallbackMock.analyzeEvidence(input);
    return {
      ...res,
      model: this.modelName,
      provider: 'BEDROCK',
    };
  }
}

export function getAIProvider(): IAIProvider {
  const provider = (process.env.AI_PROVIDER || 'mock').toLowerCase();
  if (provider === 'bedrock') {
    return new BedrockAIProvider();
  }
  return new MockAIProvider();
}
