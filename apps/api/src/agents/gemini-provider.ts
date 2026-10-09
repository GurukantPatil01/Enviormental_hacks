import path from 'node:path';
import { GoogleGenAI } from '@google/genai';
import type { ObservationSeverity, VisionObservation, VisionWasteCategory } from '@ecopulse/types';
import { geminiVisionAnalysisSchema, type GeminiVisionAnalysis } from '@ecopulse/validation';
import { storageService } from '../services/storage.service.js';
import type {
  EnvironmentalObservationResult,
  VisionAIProvider,
  VisionAnalysisInput,
} from './ai-provider.js';

export interface GeminiVisionOptions {
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
  maxRetries?: number;
  mockClient?: any; // For unit test mocking
}

export class GeminiVisionProvider implements VisionAIProvider {
  private client: GoogleGenAI | null = null;
  private apiKey: string;
  private modelName: string;
  private timeoutMs: number;
  private maxRetries: number;
  private mockClient: any;

  constructor(options?: GeminiVisionOptions) {
    this.apiKey = options?.apiKey || process.env.GEMINI_API_KEY || '';
    this.modelName =
      options?.model ||
      process.env.GEMINI_MODEL ||
      'gemini-2.5-flash-lite';
    this.timeoutMs = options?.timeoutMs || 25000;
    this.maxRetries = options?.maxRetries ?? 2;
    this.mockClient = options?.mockClient || null;

    if (this.mockClient) {
      this.client = this.mockClient;
    } else if (this.apiKey) {
      this.client = new GoogleGenAI({ apiKey: this.apiKey });
    }
  }

  getProviderName(): string {
    return 'GEMINI';
  }

  getModelName(): string {
    return this.modelName;
  }

  hasCredentials(): boolean {
    return Boolean(this.apiKey || this.mockClient);
  }

  /**
   * Resolves private image bytes from S3 storage adapter, local path, or data URI.
   */
  async resolveImageBytes(mediaUrl: string): Promise<{ buffer: Buffer; mimeType: string }> {
    if (!mediaUrl) {
      throw new Error('Missing mediaUrl for vision analysis');
    }

    // 1. Data URI
    if (mediaUrl.startsWith('data:')) {
      const match = mediaUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        const mimeType = match[1] || 'image/jpeg';
        const buffer = Buffer.from(match[2], 'base64');
        return this.validateImage(buffer, mimeType);
      }
      const rawBase64 = mediaUrl.split(',')[1] || mediaUrl;
      return this.validateImage(Buffer.from(rawBase64, 'base64'), 'image/jpeg');
    }

    // 2. Extract S3 / Storage key
    let storageKey = mediaUrl;
    if (mediaUrl.startsWith('http://') || mediaUrl.startsWith('https://')) {
      try {
        const parsed = new URL(mediaUrl);
        // If it's an S3 URL, extract the path without leading slash
        const pathname = parsed.pathname.replace(/^\/+/, '');
        if (pathname.includes('reports/evidence/')) {
          storageKey = pathname.substring(pathname.indexOf('reports/evidence/'));
        } else if (pathname.includes('evidence/')) {
          storageKey = pathname.substring(pathname.indexOf('evidence/'));
        } else if (pathname.includes('/uploads/')) {
          storageKey = pathname.split('/uploads/')[1];
        } else if (parsed.hostname.includes('amazonaws.com') || parsed.hostname.includes('s3')) {
          storageKey = pathname.replace(/^[^/]+\//, '');
        } else {
          // External URL (e.g. Unsplash sample in demo seed)
          const resp = await fetch(mediaUrl, { signal: AbortSignal.timeout(10000) });
          if (!resp.ok) {
            throw new Error(`Failed to fetch external image from ${parsed.hostname}: HTTP ${resp.status}`);
          }
          const arrayBuf = await resp.arrayBuffer();
          const mimeType = resp.headers.get('content-type') || 'image/jpeg';
          return this.validateImage(Buffer.from(arrayBuf), mimeType);
        }
      } catch (urlErr: any) {
        if (!mediaUrl.includes('storage.ecopulse.local') && !urlErr.message.includes('fetch')) {
          throw urlErr;
        }
      }
    }

    // 3. Normalize path for storageService
    if (storageKey.startsWith('/uploads/')) {
      storageKey = storageKey.replace(/^\/uploads\//, '');
    } else if (storageKey.startsWith('uploads/')) {
      storageKey = storageKey.replace(/^uploads\//, '');
    }

    // 4. Retrieve private image buffer from S3/local storage adapter
    const buffer = await storageService.getObject(storageKey);
    const ext = path.extname(storageKey).toLowerCase();
    const mimeType =
      ext === '.png'
        ? 'image/png'
        : ext === '.webp'
        ? 'image/webp'
        : ext === '.gif'
        ? 'image/gif'
        : 'image/jpeg';

    return this.validateImage(buffer, mimeType);
  }

  private validateImage(buffer: Buffer, mimeType: string): { buffer: Buffer; mimeType: string } {
    if (!buffer || buffer.length === 0) {
      throw new Error('Image data is empty or corrupted');
    }

    const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB max
    if (buffer.length > MAX_SIZE_BYTES) {
      throw new Error(`Image size (${(buffer.length / 1024 / 1024).toFixed(1)}MB) exceeds 20MB limit`);
    }

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/jpg'];
    const normalizedMime = mimeType.toLowerCase();
    if (!allowed.includes(normalizedMime)) {
      throw new Error(`Unsupported image mime type: ${mimeType}. Expected JPEG, PNG, or WebP.`);
    }

    return {
      buffer,
      mimeType: normalizedMime === 'image/jpg' ? 'image/jpeg' : normalizedMime,
    };
  }

  async analyzeEnvironmentalEvidence(input: VisionAnalysisInput): Promise<EnvironmentalObservationResult> {
    if (!this.hasCredentials()) {
      throw new Error(
        'Gemini Vision API key is not configured. Set GEMINI_API_KEY in .env or switch to VISION_PROVIDER=mock'
      );
    }

    // 1. Resolve image bytes securely through storage adapter
    const { buffer, mimeType } = await this.resolveImageBytes(input.mediaUrl);

    // 2. Construct structured Gemini Prompt
    const prompt = `
You are an environmental vision analysis assistant for the EcoPulse municipal sanitation platform.
Analyze this citizen-submitted environmental evidence photo carefully and objectively.
Location context: ${input.locationAddress || 'Municipal public area'}.
Reported category hint: ${input.categoryHint || 'None provided'}.

CRITICAL RULES:
1. Strictly report only what is visibly present in the image.
2. DO NOT fabricate coordinates, exact weight, responsible individuals, civic citations, or cleanup costs that cannot be directly proven from the photo.
3. If the image is blurry, dark, unreadable, or ambiguous, you MUST set evidenceQuality to "LOW" or "BLURRY_UNREADABLE" and set requiresHumanReview to true.
4. If no solid waste is visible, set wasteDetected to false, wasteCategory to "NO_CLEAR_ISSUE", visibleSeverity to "LOW", and wastePresence to "NONE".
5. Return your output strictly as a JSON object matching this structure:
{
  "wasteDetected": boolean,
  "wastePresence": "NONE" | "LOW" | "MODERATE" | "SIGNIFICANT" | "OVERWHELMING",
  "wasteCategory": "WASTE_HOTSPOT" | "ILLEGAL_DUMPING" | "OVERFLOWING_BIN" | "MISSED_COLLECTION" | "MIXED_WASTE" | "CONSTRUCTION_DEBRIS" | "NO_CLEAR_ISSUE" | "OTHER",
  "secondaryCategories": string[],
  "visibleSeverity": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "estimatedVolume": string,
  "potentialObstruction": "NONE" | "SIDEWALK" | "STORM_DRAIN" | "ROADWAY" | "MULTIPLE",
  "environmentalRiskIndicators": string[],
  "evidenceQuality": "HIGH" | "MEDIUM" | "LOW" | "BLURRY_UNREADABLE",
  "limitations": string,
  "requiresHumanReview": boolean,
  "description": string,
  "recommendedAction": string,
  "detectedObjects": string[]
}
`;

    // 3. Execute with bounded retries and timeout
    const rawAnalysis = await this.callGeminiWithRetry(prompt, buffer, mimeType);

    // 4. Validate output with strict Zod schema
    const validated = geminiVisionAnalysisSchema.parse(rawAnalysis);

    // 5. Calculate non-calibrated heuristic confidence score (bounded 0.60 to 0.95)
    let confidence = 0.85;
    if (validated.evidenceQuality === 'HIGH') confidence = 0.94;
    else if (validated.evidenceQuality === 'MEDIUM') confidence = 0.82;
    else confidence = 0.65;

    if (validated.requiresHumanReview) {
      confidence = Math.min(confidence, 0.72);
    }

    return {
      wasteType: validated.wasteCategory,
      secondaryWasteTypes: validated.secondaryCategories,
      severity: validated.visibleSeverity,
      confidence,
      estimatedVolume: validated.estimatedVolume,
      environmentalRisk: validated.environmentalRiskIndicators.join(', ') || 'None identified',
      publicSafetyRisk:
        validated.potentialObstruction !== 'NONE'
          ? `Obstruction to ${validated.potentialObstruction.toLowerCase()}`
          : 'No immediate safety obstruction',
      illegalDumpingLikelihood:
        validated.wasteCategory === 'ILLEGAL_DUMPING' ? 0.9 : validated.wasteDetected ? 0.2 : 0.0,
      description: validated.description,
      recommendedAction: validated.recommendedAction,
      detectedObjects: validated.detectedObjects,
      model: this.modelName,
      provider: 'GEMINI',
      // Attach full raw metadata for inspector
      ...( {
        geminiAnalysis: validated,
      } as any),
    };
  }

  private async callGeminiWithRetry(
    prompt: string,
    imageBuffer: Buffer,
    mimeType: string
  ): Promise<any> {
    let attempt = 0;
    let lastError: any = null;

    while (attempt <= this.maxRetries) {
      try {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Gemini Vision request timed out after ${this.timeoutMs}ms`)), this.timeoutMs)
        );

        const executionPromise = (async () => {
          const contents = [
            {
              role: 'user',
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType,
                    data: imageBuffer.toString('base64'),
                  },
                },
              ],
            },
          ];

          const response = await this.client!.models.generateContent({
            model: this.modelName,
            contents,
            config: {
              responseMimeType: 'application/json',
            },
          });

          const text = response.text || '';
          if (!text) {
            throw new Error('Gemini returned an empty response');
          }

          // Strip markdown code fences if model enclosed JSON
          const cleanJson = text
            .replace(/^```json\s*/i, '')
            .replace(/^```\s*/i, '')
            .replace(/\s*```$/i, '')
            .trim();

          return JSON.parse(cleanJson);
        })();

        return await Promise.race([executionPromise, timeoutPromise]);
      } catch (err: any) {
        lastError = err;
        attempt++;

        // Don't retry client errors, schema errors, or image validation errors
        const isRateLimit =
          err.status === 429 ||
          err.message?.includes('429') ||
          err.message?.includes('RESOURCE_EXHAUSTED');
        const isTimeout = err.message?.includes('timed out');
        const isTransient =
          err.status === 503 ||
          err.status === 500 ||
          err.message?.includes('network') ||
          err.message?.includes('fetch failed');

        if ((isRateLimit || isTimeout || isTransient) && attempt <= this.maxRetries) {
          const backoffMs = attempt * 1000;
          console.warn(
            `[GeminiVisionProvider] Attempt ${attempt} failed (${err.message}). Retrying in ${backoffMs}ms...`
          );
          await new Promise((r) => setTimeout(r, backoffMs));
          continue;
        }

        break;
      }
    }

    throw new Error(`Gemini Vision analysis failed: ${lastError?.message || 'Unknown error'}`);
  }

  async analyzeEvidence(input: VisionAnalysisInput): Promise<VisionObservation> {
    const startTime = Date.now();
    const res = await this.analyzeEnvironmentalEvidence(input);
    const duration = Date.now() - startTime;

    return {
      evidenceId: input.evidenceId,
      category: res.wasteType as VisionWasteCategory,
      detectedObjects: res.detectedObjects,
      severity: res.severity,
      confidence: res.confidence,
      observations: res.description,
      model: this.modelName,
      provider: 'GEMINI' as any,
      processingDurationMs: duration,
      createdAt: new Date().toISOString(),
      ...({
        geminiAnalysis: (res as any).geminiAnalysis,
      } as any),
    };
  }

  async analyzeImage(
    mediaUrl: string,
    options?: { categoryHint?: string; locationAddress?: string }
  ): Promise<EnvironmentalObservationResult & { geminiAnalysis?: GeminiVisionAnalysis }> {
    return this.analyzeEnvironmentalEvidence({
      evidenceId: 'direct-analysis',
      mediaUrl,
      categoryHint: options?.categoryHint,
      locationAddress: options?.locationAddress,
    }) as any;
  }
}
