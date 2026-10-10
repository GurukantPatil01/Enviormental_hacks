import {
  BedrockRuntimeClient,
  ConverseCommand,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';
import type { ObservationSeverity, VisionObservation, VisionWasteCategory } from '@ecopulse/types';
import {
  bedrockVisionAnalysisSchema,
  type BedrockVisionAnalysis,
} from '@ecopulse/validation';
import { storageService } from '../services/storage.service.js';
import type {
  EnvironmentalObservationResult,
  VisionAIProvider,
  VisionAnalysisInput,
} from './ai-provider.js';

export interface BedrockVisionOptions {
  region?: string;
  model?: string;
  timeoutMs?: number;
  maxRetries?: number;
  mockClient?: any;
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
  };
}

/**
 * Enterprise AWS Bedrock Multimodal Vision Provider.
 * Sends real image bytes to Amazon Bedrock foundation models (Anthropic Claude 3 / 3.5, Amazon Nova, etc.)
 * utilizing the AWS SDK for JavaScript v3 BedrockRuntimeClient.
 */
export class BedrockVisionProvider implements VisionAIProvider {
  private client: BedrockRuntimeClient | null = null;
  private region: string;
  private modelName: string;
  private timeoutMs: number;
  private maxRetries: number;
  private mockClient: any;
  private hasExplicitCredentials: boolean = false;

  constructor(options?: BedrockVisionOptions) {
    this.region =
      options?.region ||
      process.env.AWS_REGION ||
      'ap-south-1';

    this.modelName =
      options?.model ||
      process.env.BEDROCK_VISION_MODEL_ID ||
      process.env.AWS_BEDROCK_MODEL ||
      'anthropic.claude-3-5-sonnet-20241022-v2:0';

    this.timeoutMs = options?.timeoutMs || 30000;
    this.maxRetries = options?.maxRetries ?? 2;
    this.mockClient = options?.mockClient || null;

    if (this.mockClient) {
      this.client = this.mockClient;
      this.hasExplicitCredentials = true;
    } else {
      const clientConfig: any = { region: this.region };

      if (options?.credentials) {
        clientConfig.credentials = options.credentials;
        this.hasExplicitCredentials = true;
      } else if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
        clientConfig.credentials = {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          ...(process.env.AWS_SESSION_TOKEN ? { sessionToken: process.env.AWS_SESSION_TOKEN } : {}),
        };
        this.hasExplicitCredentials = true;
      }

      this.client = new BedrockRuntimeClient(clientConfig);
    }
  }

  getProviderName(): string {
    return 'BEDROCK';
  }

  getModelName(): string {
    return this.modelName;
  }

  hasCredentials(): boolean {
    return this.hasExplicitCredentials || Boolean(this.mockClient);
  }

  /**
   * Resolves raw image bytes from storage adapter, local disk, data URI, or URL.
   * Enforces format validation and 5MB payload boundary for Bedrock.
   */
  async resolveImageBytes(mediaUrl: string): Promise<{ buffer: Buffer; mimeType: string }> {
    if (!mediaUrl) {
      throw new Error('Missing mediaUrl for Bedrock vision analysis');
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
          // External URL
          const resp = await fetch(mediaUrl, { signal: AbortSignal.timeout(10000) });
          if (!resp.ok) {
            throw new Error(`Failed to fetch external image from ${parsed.hostname}: HTTP ${resp.status}`);
          }
          const arrayBuf = await resp.arrayBuffer();
          const mimeType = resp.headers.get('content-type') || 'image/jpeg';
          return this.validateImage(Buffer.from(arrayBuf), mimeType);
        }
      } catch (err: any) {
        if (!mediaUrl.includes('reports/evidence')) {
          throw err;
        }
      }
    }

    // 3. Fetch from object storage
    const buffer = await storageService.getEvidence(storageKey);
    if (!buffer || buffer.length === 0) {
      throw new Error(`Evidence storage returned empty buffer for key "${storageKey}"`);
    }

    const ext = storageKey.toLowerCase();
    let mimeType = 'image/jpeg';
    if (ext.endsWith('.png')) mimeType = 'image/png';
    else if (ext.endsWith('.webp')) mimeType = 'image/webp';
    else if (ext.endsWith('.gif')) mimeType = 'image/gif';

    return this.validateImage(buffer, mimeType);
  }

  private validateImage(buffer: Buffer, mimeType: string): { buffer: Buffer; mimeType: string } {
    const supportedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/jpg'];
    const normMime = mimeType.toLowerCase() === 'image/jpg' ? 'image/jpeg' : mimeType.toLowerCase();

    if (!supportedTypes.includes(normMime)) {
      throw new Error(`Unsupported image format: "${mimeType}". Bedrock supports JPEG, PNG, WebP, and GIF.`);
    }

    // Bedrock multimodal input maximum size boundary: 5MB
    const maxSizeBytes = 5 * 1024 * 1024;
    if (buffer.length > maxSizeBytes) {
      throw new Error(`Evidence image size (${(buffer.length / (1024 * 1024)).toFixed(2)} MB) exceeds 5MB Bedrock limit.`);
    }

    if (buffer.length < 10) {
      throw new Error('Evidence image buffer is corrupted or too small (< 10 bytes).');
    }

    return { buffer, mimeType: normMime };
  }

  private getFormatFromMime(mimeType: string): 'jpeg' | 'png' | 'webp' | 'gif' {
    if (mimeType.includes('png')) return 'png';
    if (mimeType.includes('webp')) return 'webp';
    if (mimeType.includes('gif')) return 'gif';
    return 'jpeg';
  }

  /**
   * Constructs the structured system prompt enforcing JSON schema outputs and conservative detection.
   */
  private buildSystemPrompt(): string {
    return `You are EcoPulse's AWS-native municipal vision AI analyst. Your role is to inspect citizen-submitted photographs to verify public environmental solid waste, illegal dumping, and civic hazards.

CORE OBJECTIVE & BOUNDARIES:
1. Examine the image carefully. Determine whether solid municipal waste, illegal dumping, overflowing bins, or public litter is clearly visible.
2. Distinguish:
   - Visible public waste (litter, commercial dump, overflow, construction refuse).
   - Clean public spaces (parks, sidewalks, roads with NO waste).
   - Indoor or unrelated scenes (bedrooms, offices, pets, random objects).
   - Blurry, dark, occluded or unreadable photos.
   - Ambiguous scenes requiring human review.
3. CONSERVATIVE PRINCIPLES:
   - If the photo shows a clean area or indoor scene, wasteDetected MUST be false. wastePresence MUST be "NONE". wasteCategory MUST be "NO_CLEAR_ISSUE".
   - If the photo is blurry, dark, unreadable, or ambiguous, wasteDetected MUST be false, evidenceQuality MUST be "BLURRY_UNREADABLE" or "POOR", and requiresHumanReview MUST be true.
   - Never fabricate waste that is not clearly visible.
   - Do NOT estimate weight, GPS, exact cleanup cost, or guess who created the waste.
   - Observations must be evidence-grounded and factual.

REQUIRED JSON OUTPUT FORMAT:
You MUST respond with a single, raw JSON object matching this exact schema:
{
  "wasteDetected": boolean,
  "wastePresence": "NONE" | "LOW" | "MODERATE" | "SIGNIFICANT" | "OVERWHELMING",
  "wasteCategory": "WASTE_HOTSPOT" | "ILLEGAL_DUMPING" | "OVERFLOWING_BIN" | "MISSED_COLLECTION" | "MIXED_WASTE" | "CONSTRUCTION_DEBRIS" | "NO_CLEAR_ISSUE" | "OTHER",
  "secondaryCategories": string[],
  "visibleSeverity": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "estimatedVolume": string,
  "potentialObstruction": "NONE" | "SIDEWALK" | "STORM_DRAIN" | "ROADWAY" | "MULTIPLE",
  "environmentalRiskIndicators": string[],
  "evidenceQuality": "HIGH" | "MEDIUM" | "LOW" | "BLURRY_UNREADABLE" | "USABLE" | "POOR" | "INCONCLUSIVE",
  "limitations": string,
  "requiresHumanReview": boolean,
  "description": string,
  "observations": string,
  "recommendedAction": string,
  "detectedObjects": string[]
}

Respond ONLY with valid JSON. No markdown code blocks, no preambles, no trailing text.`;
  }

  /**
   * Invokes Amazon Bedrock using ConverseCommand or InvokeModelCommand with exponential backoff.
   */
  async invokeBedrock(buffer: Buffer, mimeType: string, userPrompt: string): Promise<string> {
    if (!this.client) {
      throw new Error('Bedrock client is not initialized.');
    }

    const format = this.getFormatFromMime(mimeType);
    let lastError: any = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          console.log(`[BedrockVisionProvider] Retry attempt ${attempt}/${this.maxRetries} after ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }

        // Method 1: Try Bedrock Converse API (Standard for Claude 3/3.5, Nova, and multi-modal models)
        try {
          const command = new ConverseCommand({
            modelId: this.modelName,
            messages: [
              {
                role: 'user',
                content: [
                  {
                    image: {
                      format,
                      source: { bytes: new Uint8Array(buffer) },
                    },
                  },
                  { text: userPrompt },
                ],
              },
            ],
            system: [{ text: this.buildSystemPrompt() }],
            inferenceConfig: {
              maxTokens: 1024,
              temperature: 0.1,
            },
          });

          const response = await this.client.send(command, {
            abortSignal: AbortSignal.timeout(this.timeoutMs),
          });

          const content = response.output?.message?.content;
          if (Array.isArray(content) && content.length > 0) {
            const textBlock = content.find((b) => b.text);
            if (textBlock?.text) {
              return textBlock.text;
            }
          }
        } catch (converseErr: any) {
          // If Converse is not supported on this model ID, fallback to InvokeModel
          if (
            converseErr.name === 'ValidationException' ||
            converseErr.name === 'ModelNotReadyException' ||
            converseErr.message?.includes('Converse')
          ) {
            console.warn(`[BedrockVisionProvider] ConverseCommand fallback to InvokeModelCommand for ${this.modelName}:`, converseErr.message);
            const invokePayload = {
              anthropic_version: 'bedrock-2023-05-31',
              max_tokens: 1024,
              temperature: 0.1,
              system: this.buildSystemPrompt(),
              messages: [
                {
                  role: 'user',
                  content: [
                    {
                      type: 'image',
                      source: {
                        type: 'base64',
                        media_type: mimeType,
                        data: buffer.toString('base64'),
                      },
                    },
                    { type: 'text', text: userPrompt },
                  ],
                },
              ],
            };

            const invokeCommand = new InvokeModelCommand({
              modelId: this.modelName,
              contentType: 'application/json',
              accept: 'application/json',
              body: Buffer.from(JSON.stringify(invokePayload)),
            });

            const invokeResponse = await this.client.send(invokeCommand, {
              abortSignal: AbortSignal.timeout(this.timeoutMs),
            });

            const rawBody = Buffer.from(invokeResponse.body).toString('utf-8');
            const parsed = JSON.parse(rawBody);
            const text = parsed?.content?.[0]?.text;
            if (text) {
              return text;
            }
          }
          throw converseErr;
        }

        throw new Error('Bedrock returned an empty response content block');
      } catch (err: any) {
        lastError = err;
        console.warn(`[BedrockVisionProvider] Invocation error (attempt ${attempt}): ${err.name || 'Error'} - ${err.message}`);

        // Do not retry terminal client errors: AccessDenied, ResourceNotFound, ValidationException
        if (
          err.name === 'AccessDeniedException' ||
          err.name === 'ResourceNotFoundException' ||
          err.name === 'ValidationException' ||
          err.message?.includes('not authorized') ||
          err.message?.includes('end of its life')
        ) {
          break;
        }
      }
    }

    throw lastError || new Error('Bedrock inference failed after retries.');
  }

  /**
   * Cleans model output and parses JSON adhering to schema.
   */
  private parseAndValidate(rawText: string): BedrockVisionAnalysis {
    let cleaned = rawText.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    // Isolate first balanced JSON object
    const startIdx = cleaned.indexOf('{');
    const endIdx = cleaned.lastIndexOf('}');
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      cleaned = cleaned.substring(startIdx, endIdx + 1);
    }

    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      throw new Error(`Failed to parse Bedrock response as JSON: ${rawText.substring(0, 200)}...`);
    }

    return bedrockVisionAnalysisSchema.parse(parsed);
  }

  /**
   * Primary vision analysis method conforming to VisionAIProvider.
   */
  async analyzeEnvironmentalEvidence(input: VisionAnalysisInput): Promise<EnvironmentalObservationResult> {
    const startTime = Date.now();

    // 1. Resolve actual image bytes from S3 or storage
    const { buffer, mimeType } = await this.resolveImageBytes(input.mediaUrl);

    const userPrompt = `Analyze this citizen-submitted environmental report evidence.
Category Hint: ${input.categoryHint || 'None'}
Address Hint: ${input.locationAddress || 'Unknown location'}
Provide strict evidence-grounded JSON analysis distinguishing visible waste, clean zones, and inconclusive evidence.`;

    // 2. Perform Bedrock invocation
    let analysis: BedrockVisionAnalysis;
    try {
      const rawResponse = await this.invokeBedrock(buffer, mimeType, userPrompt);
      analysis = this.parseAndValidate(rawResponse);
    } catch (err: any) {
      console.error(`[BedrockVisionProvider] Failed inference on evidence ${input.evidenceId}:`, err.message);

      // Never fabricate fake positive results. If Bedrock is unavailable or unauthorized:
      throw new Error(`AWS Bedrock Vision Analysis Failed: ${err.message}`);
    }

    const durationMs = Date.now() - startTime;
    console.log(
      `[BedrockVisionProvider] Completed in ${durationMs}ms | Detected: ${analysis.wasteDetected} | Category: ${analysis.wasteCategory} | Severity: ${analysis.visibleSeverity}`
    );

    return {
      wasteType: analysis.wasteCategory,
      secondaryWasteTypes: analysis.secondaryCategories || [],
      severity: analysis.visibleSeverity as ObservationSeverity,
      confidence: analysis.wasteDetected ? 0.92 : 0.95,
      estimatedVolume: analysis.estimatedVolume,
      environmentalRisk: analysis.environmentalRiskIndicators?.join(', ') || 'No elevated environmental risk detected',
      publicSafetyRisk:
        analysis.potentialObstruction !== 'NONE'
          ? `Obstruction risk: ${analysis.potentialObstruction}`
          : 'No immediate public safety obstruction',
      illegalDumpingLikelihood: analysis.wasteCategory === 'ILLEGAL_DUMPING' ? 0.9 : 0.1,
      description: analysis.description || analysis.observations,
      recommendedAction: analysis.recommendedAction,
      detectedObjects: analysis.detectedObjects || [],
      model: this.modelName,
      provider: 'BEDROCK',
      bedrockAnalysis: analysis,
      requiresHumanReview: analysis.requiresHumanReview,
    } as any;
  }

  /**
   * Backward compatible VisionObservation output method.
   */
  async analyzeEvidence(input: VisionAnalysisInput): Promise<VisionObservation> {
    const startTime = Date.now();
    const envResult = await this.analyzeEnvironmentalEvidence(input);
    const durationMs = Date.now() - startTime;

    return {
      evidenceId: input.evidenceId,
      category: envResult.wasteType as VisionWasteCategory,
      detectedObjects: envResult.detectedObjects,
      severity: envResult.severity,
      confidence: envResult.confidence,
      observations: envResult.description,
      model: this.modelName,
      provider: 'BEDROCK' as any,
      processingDurationMs: durationMs,
      createdAt: new Date().toISOString(),
      bedrockAnalysis: (envResult as any).bedrockAnalysis,
      requiresHumanReview: (envResult as any).requiresHumanReview,
      ...(envResult as any),
    };
  }
}
