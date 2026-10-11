import path from 'node:path';
import fs from 'node:fs';
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
      'gemini-3.5-flash-lite';
    this.timeoutMs = options?.timeoutMs || 20000;
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
    if (fs.existsSync(storageKey)) {
      const buffer = fs.readFileSync(storageKey);
      const ext = path.extname(storageKey).toLowerCase();
      const mimeType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
      return this.validateImage(buffer, mimeType);
    }

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
1. SOLID WASTE IDENTIFICATION: You MUST set wasteDetected to true whenever any solid waste, garbage, trash, litter, refuse, debris, or sanitation receptacles requiring attention are visible. This includes:
   - Municipal dustbins, dumpsters, wheelie bins, public trash cans, or collection points (whether overflowing, full, open, or surrounded by trash).
   - Garbage bags, shopping bags containing rubbish, bundled waste, or discarded sacks.
   - Scattered or loose litter: plastic bottles, food containers, wrappers, drink cups, paper, cardboard, cans, cartons, or discarded personal items on roads, sidewalks, gutters, floors, or ground.
   - Piles of waste, illegal dumping, construction debris, demolition rubble, scrap metal, or abandoned materials.
   - Blocked drainage grates, runoff ditches containing trash, or water bodies with floating refuse.
2. CLEAN ENVIRONMENT (NO WASTE): Set wasteDetected to false, wasteCategory to "NO_CLEAR_ISSUE", visibleSeverity to "LOW", and wastePresence to "NONE" ONLY if the scene is genuinely clean and completely devoid of trash, discarded refuse, and waste bins (e.g., a completely clean street with zero litter, an empty clean park lawn, an indoor room/desk with clean personal belongings and no trash, a portrait/selfie, or a clean screenshot).
3. UNCERTAIN / INCONCLUSIVE EVIDENCE: If the image is extremely dark, out-of-focus, completely blurry, or corrupt such that visual content cannot be determined, set evidenceQuality to "BLURRY_UNREADABLE", "POOR", or "INCONCLUSIVE", set wasteDetected to "uncertain", set requiresHumanReview to true, and explain the limitation.
4. OBJECTIVE SEVERITY & VOLUME:
   - LOW: Single/few scattered litter items or small closed trash bin.
   - MEDIUM: Moderate pile of waste, localized cluster of litter, or full trash receptacle.
   - HIGH: Large accumulation, overflowing bin with debris spilling onto walkway, or significant illegal dump.
   - CRITICAL: Massive illegal dumping, hazardous/medical waste, or waste completely blocking roads/storm drains.
5. NO FABRICATION: Strictly report only what is visibly present in the image. DO NOT fabricate coordinates, exact weight, responsible individuals, vehicle registrations, civic citations, or cleanup costs that cannot be directly proven from the photo.
6. Set potentialObstruction to "SIDEWALK", "STORM_DRAIN", "ROADWAY", "MULTIPLE", or "NONE" if waste is blocking public right-of-way.
7. Return your output strictly as a JSON object matching this structure:
{
  "wasteDetected": boolean or "uncertain",
  "wastePresence": "NONE" | "LOW" | "MODERATE" | "SIGNIFICANT" | "OVERWHELMING",
  "wasteCategory": "WASTE_HOTSPOT" | "ILLEGAL_DUMPING" | "OVERFLOWING_BIN" | "MISSED_COLLECTION" | "MIXED_WASTE" | "CONSTRUCTION_DEBRIS" | "NO_CLEAR_ISSUE" | "OTHER",
  "secondaryCategories": string[],
  "visibleSeverity": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "confidence": number,
  "estimatedVolume": string,
  "potentialObstruction": "NONE" | "SIDEWALK" | "STORM_DRAIN" | "ROADWAY" | "MULTIPLE",
  "environmentalRiskIndicators": string[],
  "evidenceQuality": "HIGH" | "MEDIUM" | "LOW" | "BLURRY_UNREADABLE" | "INCONCLUSIVE" | "POOR",
  "limitations": string,
  "requiresHumanReview": boolean,
  "description": string,
  "explanation": string,
  "recommendedAction": string,
  "detectedObjects": string[]
}
`;

    // 3. Execute with bounded retries and timeout
    const rawAnalysis = await this.callGeminiWithRetry(prompt, buffer, mimeType);

    // 4. Validate output with strict Zod schema
    const validated = geminiVisionAnalysisSchema.parse(rawAnalysis);

    // 5. Calculate non-fabricated confidence score
    let confidence = typeof validated.confidence === 'number'
      ? Math.max(0, Math.min(1, validated.confidence))
      : validated.evidenceQuality === 'HIGH'
      ? 0.94
      : validated.evidenceQuality === 'MEDIUM'
      ? 0.80
      : 0.55;

    const isUncertain =
      validated.wasteDetected === 'uncertain' ||
      validated.evidenceQuality === 'BLURRY_UNREADABLE' ||
      validated.evidenceQuality === 'INCONCLUSIVE' ||
      validated.evidenceQuality === 'POOR';

    const requiresHumanReview = Boolean(validated.requiresHumanReview || isUncertain);

    if (isUncertain) {
      confidence = Math.min(confidence, 0.65);
    }

    const explanation =
      validated.explanation ||
      validated.description ||
      'Environmental observation recorded.';

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
        validated.wasteCategory === 'ILLEGAL_DUMPING'
          ? 0.9
          : validated.wasteDetected === true
          ? 0.2
          : 0.0,
      description: validated.description,
      explanation,
      recommendedAction: validated.recommendedAction,
      detectedObjects: validated.detectedObjects,
      model: this.modelName,
      provider: 'GEMINI',
      wasteDetected: validated.wasteDetected,
      wasteCategory: validated.wasteCategory,
      visibleSeverity: validated.visibleSeverity,
      potentialObstruction: validated.potentialObstruction,
      requiresHumanReview,
      // Attach full raw metadata for inspector
      ...( {
        geminiAnalysis: {
          ...validated,
          explanation,
          requiresHumanReview,
        },
      } as any),
    };
  }

  private async callGeminiWithRetry(
    prompt: string,
    imageBuffer: Buffer,
    mimeType: string
  ): Promise<any> {
    const candidateModels = [
      this.modelName,
      'gemini-3.5-flash-lite',
      'gemini-3.5-flash',
    ].filter((m, idx, arr) => Boolean(m) && arr.indexOf(m) === idx);

    let lastError: any = null;

    for (const modelToUse of candidateModels) {
      let attempt = 0;
      while (attempt <= this.maxRetries) {
        try {
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error(`Gemini Vision request timed out after ${this.timeoutMs}ms`)),
              this.timeoutMs
            )
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
              model: modelToUse,
              contents,
              config: {
                responseMimeType: 'application/json',
                temperature: 0.1,
              },
            });

            const text = response.text || '';
            if (!text) {
              throw new Error('Gemini returned an empty response');
            }

            const cleanJson = text
              .replace(/^```json\s*/i, '')
              .replace(/^```\s*/i, '')
              .replace(/\s*```$/i, '')
              .trim();

            this.modelName = modelToUse;
            return JSON.parse(cleanJson);
          })();

          return await Promise.race([executionPromise, timeoutPromise]);
        } catch (err: any) {
          lastError = err;
          attempt++;

          const isQuotaExhausted =
            err.status === 429 ||
            err.status === 404 ||
            err.message?.includes('429') ||
            err.message?.includes('404') ||
            err.message?.includes('RESOURCE_EXHAUSTED') ||
            err.message?.includes('not found') ||
            err.message?.includes('no longer available');

          if (isQuotaExhausted && candidateModels.indexOf(modelToUse) < candidateModels.length - 1) {
            console.warn(
              `[GeminiVisionProvider] Model ${modelToUse} exhausted or unavailable (${err.message}). Trying fallback model...`
            );
            break;
          }

          const isTimeout = err.message?.includes('timed out');
          const isTransient =
            err.status === 503 ||
            err.status === 500 ||
            err.message?.includes('network') ||
            err.message?.includes('fetch failed');

          if ((isTimeout || isTransient) && attempt <= this.maxRetries) {
            const backoffMs = attempt * 800;
            console.warn(
              `[GeminiVisionProvider] Attempt ${attempt} failed (${err.message}). Retrying in ${backoffMs}ms...`
            );
            await new Promise((r) => setTimeout(r, backoffMs));
            continue;
          }

          break;
        }
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
      wasteDetected: res.wasteDetected,
      wasteCategory: res.wasteCategory,
      visibleSeverity: res.visibleSeverity,
      potentialObstruction: res.potentialObstruction,
      requiresHumanReview: res.requiresHumanReview,
      explanation: res.explanation,
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
