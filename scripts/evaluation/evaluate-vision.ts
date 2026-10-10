import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

import { getAIProvider, type VisionAIProvider } from '../../apps/api/src/agents/ai-provider.js';
import { BedrockVisionProvider } from '../../apps/api/src/agents/bedrock-provider.js';
import { GeminiVisionProvider } from '../../apps/api/src/agents/gemini-provider.js';
import { MockVisionProvider } from '../../apps/api/src/agents/ai-provider.js';

export interface GroundTruthCase {
  id: string;
  name: string;
  description: string;
  mediaUrl: string; // URL, data URI, or path
  categoryHint?: string;
  groundTruth: {
    wasteDetected: boolean;
    wastePresence: 'NONE' | 'LOW' | 'MODERATE' | 'SIGNIFICANT' | 'OVERWHELMING';
    wasteCategory: string;
    expectedObstruction?: string;
    requiresHumanReview?: boolean;
    evidenceQuality?: string;
  };
}

export interface EvaluationResult {
  caseId: string;
  name: string;
  actualDetected: boolean;
  expectedDetected: boolean;
  actualCategory: string;
  expectedCategory: string;
  actualSeverity: string;
  actualQuality?: string;
  requiresReview: boolean;
  latencyMs: number;
  matched: boolean;
  error?: string;
}

export interface MaintainerCorrection {
  evidenceId: string;
  originalPrediction: Record<string, unknown>;
  maintainerLabel: {
    wasteDetected: boolean;
    wasteCategory: string;
    notes: string;
  };
  maintainerId: string;
  timestamp: string;
}

// 1x1 test pixels for synthetic base64 testing when offline
const BASE64_RED_PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const BASE64_GREEN_PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

/**
 * Curated Evaluation Dataset representing diverse municipal environmental conditions.
 */
export const EVALUATION_DATASET: GroundTruthCase[] = [
  {
    id: 'eval-01',
    name: 'Clear Outdoor Litter',
    description: 'Roadside pavement littered with mixed consumer food containers and discarded single-use plastics.',
    mediaUrl: 'https://images.unsplash.com/photo-1605600659908-0ef719419d41?auto=format&fit=crop&w=600&q=80',
    categoryHint: 'WASTE_HOTSPOT',
    groundTruth: {
      wasteDetected: true,
      wastePresence: 'SIGNIFICANT',
      wasteCategory: 'WASTE_HOTSPOT',
      requiresHumanReview: false,
    },
  },
  {
    id: 'eval-02',
    name: 'Large Illegal Dumping',
    description: 'Commercial debris and bulk demolition refuse discarded along a public roadway.',
    mediaUrl: 'https://images.unsplash.com/photo-1530587191325-3db32d826c18?auto=format&fit=crop&w=600&q=80',
    categoryHint: 'ILLEGAL_DUMPING',
    groundTruth: {
      wasteDetected: true,
      wastePresence: 'OVERWHELMING',
      wasteCategory: 'ILLEGAL_DUMPING',
      expectedObstruction: 'ROADWAY',
      requiresHumanReview: false,
    },
  },
  {
    id: 'eval-03',
    name: 'Overflowing Sanitation Bin',
    description: 'Sidewalk waste bin overflowing with domestic food packaging spilling onto pedestrian walkway.',
    mediaUrl: 'https://images.unsplash.com/photo-1528323273322-d81458248d40?auto=format&fit=crop&w=600&q=80',
    categoryHint: 'OVERFLOWING_BIN',
    groundTruth: {
      wasteDetected: true,
      wastePresence: 'SIGNIFICANT',
      wasteCategory: 'OVERFLOWING_BIN',
      expectedObstruction: 'SIDEWALK',
      requiresHumanReview: false,
    },
  },
  {
    id: 'eval-04',
    name: 'Clean Public Park',
    description: 'A clean municipal lawn and public greenery with zero visible solid waste.',
    mediaUrl: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=600&q=80',
    categoryHint: 'CLEAN_PARK',
    groundTruth: {
      wasteDetected: false,
      wastePresence: 'NONE',
      wasteCategory: 'NO_CLEAR_ISSUE',
      requiresHumanReview: false,
    },
  },
  {
    id: 'eval-05',
    name: 'Indoor Unrelated Scene',
    description: 'A residential indoor bedroom with furniture and no public municipal waste.',
    mediaUrl: 'https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?auto=format&fit=crop&w=600&q=80',
    categoryHint: 'OTHER',
    groundTruth: {
      wasteDetected: false,
      wastePresence: 'NONE',
      wasteCategory: 'NO_CLEAR_ISSUE',
      requiresHumanReview: false,
    },
  },
  {
    id: 'eval-06',
    name: 'Blurry / Unreadable Evidence',
    description: 'Completely unreadable blurry or night-dark photo where objects cannot be discerned.',
    mediaUrl: BASE64_RED_PIXEL,
    categoryHint: 'UNKNOWN',
    groundTruth: {
      wasteDetected: false,
      wastePresence: 'NONE',
      wasteCategory: 'NO_CLEAR_ISSUE',
      requiresHumanReview: true,
      evidenceQuality: 'BLURRY_UNREADABLE',
    },
  },
  {
    id: 'eval-07',
    name: 'Construction Demolition Debris',
    description: 'Crushed masonry and concrete rubble dumped in open drainage right-of-way.',
    mediaUrl: 'https://images.unsplash.com/photo-1503596476-1c12a8ba09a9?auto=format&fit=crop&w=600&q=80',
    categoryHint: 'CONSTRUCTION_DEBRIS',
    groundTruth: {
      wasteDetected: true,
      wastePresence: 'SIGNIFICANT',
      wasteCategory: 'CONSTRUCTION_DEBRIS',
      requiresHumanReview: false,
    },
  },
  {
    id: 'eval-08',
    name: 'Storm Drain Obstruction',
    description: 'Dense litter accumulation directly over a roadside storm drain opening.',
    mediaUrl: 'https://images.unsplash.com/photo-1618477461853-cf6ed80faba5?auto=format&fit=crop&w=600&q=80',
    categoryHint: 'ILLEGAL_DUMPING',
    groundTruth: {
      wasteDetected: true,
      wastePresence: 'MODERATE',
      wasteCategory: 'ILLEGAL_DUMPING',
      expectedObstruction: 'STORM_DRAIN',
      requiresHumanReview: false,
    },
  },
];

/**
 * Runs evaluation suite across all benchmark test cases.
 */
export async function runVisionEvaluation(provider?: VisionAIProvider): Promise<{
  results: EvaluationResult[];
  metrics: Record<string, number | string>;
}> {
  const ai = provider || getAIProvider();
  console.log(`\n================================================================`);
  console.log(`🔬 EcoPulse Vision Evaluation Harness`);
  console.log(`Provider: ${ai.getProviderName()} | Model: ${ai.getModelName()}`);
  console.log(`Test cases: ${EVALUATION_DATASET.length}`);
  console.log(`================================================================\n`);

  const results: EvaluationResult[] = [];
  let tp = 0; // True Positive
  let tn = 0; // True Negative
  let fp = 0; // False Positive
  let fn = 0; // False Negative
  let reviewCount = 0;
  let totalLatency = 0;

  for (const item of EVALUATION_DATASET) {
    const t0 = Date.now();
    try {
      const res = await ai.analyzeEnvironmentalEvidence({
        evidenceId: item.id,
        mediaUrl: item.mediaUrl,
        categoryHint: item.categoryHint,
      });
      const latencyMs = Date.now() - t0;
      totalLatency += latencyMs;

      const actualDetected = res.wasteType !== 'NO_CLEAR_ISSUE' && res.wasteType !== 'NO_WASTE';
      const expectedDetected = item.groundTruth.wasteDetected;

      if (expectedDetected && actualDetected) tp++;
      else if (!expectedDetected && !actualDetected) tn++;
      else if (!expectedDetected && actualDetected) fp++;
      else if (expectedDetected && !actualDetected) fn++;

      const isReviewRequired =
        (res as any).requiresHumanReview === true ||
        (res as any).evidenceQuality === 'BLURRY_UNREADABLE' ||
        (res as any).evidenceQuality === 'INCONCLUSIVE';
      if (isReviewRequired) reviewCount++;

      const matched = actualDetected === expectedDetected;

      results.push({
        caseId: item.id,
        name: item.name,
        actualDetected,
        expectedDetected,
        actualCategory: res.wasteType,
        expectedCategory: item.groundTruth.wasteCategory,
        actualSeverity: res.severity,
        actualQuality: (res as any).evidenceQuality,
        requiresReview: isReviewRequired,
        latencyMs,
        matched,
      });

      console.log(
        `[${matched ? '✅ PASS' : '❌ FAIL'}] ${item.id.padEnd(8)} ${item.name.padEnd(28)} | Expected: ${String(expectedDetected).padEnd(5)} | Actual: ${String(actualDetected).padEnd(5)} | Latency: ${latencyMs}ms`
      );
    } catch (err: any) {
      const latencyMs = Date.now() - t0;
      totalLatency += latencyMs;
      console.log(`[❌ ERR ] ${item.id.padEnd(8)} ${item.name.padEnd(28)} | Error: ${err.message}`);
      results.push({
        caseId: item.id,
        name: item.name,
        actualDetected: false,
        expectedDetected: item.groundTruth.wasteDetected,
        actualCategory: 'ERROR',
        expectedCategory: item.groundTruth.wasteCategory,
        actualSeverity: 'LOW',
        requiresReview: true,
        latencyMs,
        matched: false,
        error: err.message,
      });
    }
  }

  const total = EVALUATION_DATASET.length;
  const precision = tp + fp > 0 ? (tp / (tp + fp)) * 100 : 0;
  const recall = tp + fn > 0 ? (tp / (tp + fn)) * 100 : 0;
  const accuracy = total > 0 ? ((tp + tn) / total) * 100 : 0;
  const fpRate = fp + tn > 0 ? (fp / (fp + tn)) * 100 : 0;
  const fnRate = fn + tp > 0 ? (fn / (fn + tp)) * 100 : 0;
  const reviewRate = total > 0 ? (reviewCount / total) * 100 : 0;
  const avgLatency = total > 0 ? Math.round(totalLatency / total) : 0;

  // Real inference cost calculation based on model pricing (Claude 3.5 Sonnet / Nova / Gemini)
  let measuredCostPerAnalysis = '$0.00';
  if (ai.getProviderName() === 'BEDROCK') {
    // Standard Bedrock Claude 3.5 Sonnet: ~1600 input tokens ($0.0048) + 250 output tokens ($0.00375) = $0.00855 per image
    // For Nova Pro: ~1600 input ($0.00128) + 250 output ($0.0008) = $0.00208 per image
    const estInput = 1600;
    const estOutput = 250;
    const cost = (ai as any).calculateBedrockInferenceCost
      ? (ai as any).calculateBedrockInferenceCost(ai.getModelName(), estInput, estOutput)
      : (estInput * 0.000003) + (estOutput * 0.000015);
    measuredCostPerAnalysis = `$${cost.toFixed(6)} (${ai.getModelName()})`;
  } else if (ai.getProviderName() === 'GEMINI') {
    // Gemini 2.5 Flash: $0.075 / 1M input, $0.30 / 1M output -> ~$0.00020 / image
    measuredCostPerAnalysis = '$0.000195 (gemini-2.5-flash)';
  } else {
    measuredCostPerAnalysis = '$0.000000 (MOCK)';
  }

  const metrics = {
    totalCases: total,
    truePositives: tp,
    trueNegatives: tn,
    falsePositives: fp,
    falseNegatives: fn,
    precision: `${precision.toFixed(1)}%`,
    recall: `${recall.toFixed(1)}%`,
    accuracy: `${accuracy.toFixed(1)}%`,
    falsePositiveRate: `${fpRate.toFixed(1)}%`,
    falseNegativeRate: `${fnRate.toFixed(1)}%`,
    humanReviewRate: `${reviewRate.toFixed(1)}%`,
    avgLatencyMs: `${avgLatency} ms`,
    approxCostPerAnalysis: measuredCostPerAnalysis,
  };

  console.log(`\n================================================================`);
  console.log(`📊 Evaluation Metrics Summary:`);
  console.log(`Accuracy:             ${metrics.accuracy}`);
  console.log(`Precision:            ${metrics.precision}`);
  console.log(`Recall:               ${metrics.recall}`);
  console.log(`False Positive Rate:  ${metrics.falsePositiveRate}`);
  console.log(`False Negative Rate:  ${metrics.falseNegativeRate}`);
  console.log(`Human Review Rate:    ${metrics.humanReviewRate}`);
  console.log(`Average Latency:      ${metrics.avgLatencyMs}`);
  console.log(`Est. Cost / Analysis: ${metrics.approxCostPerAnalysis}`);
  console.log(`================================================================\n`);

  return { results, metrics };
}

/**
 * Records maintainer corrections for continuous offline evaluation tracking.
 */
export async function recordMaintainerCorrection(correction: MaintainerCorrection): Promise<void> {
  const correctionsDir = path.resolve(process.cwd(), 'data/corrections');
  if (!fs.existsSync(correctionsDir)) {
    fs.mkdirSync(correctionsDir, { recursive: true });
  }
  const file = path.join(correctionsDir, `${correction.evidenceId}-${Date.now()}.json`);
  fs.writeFileSync(file, JSON.stringify(correction, null, 2));
  console.log(`[Evaluation] Recorded maintainer correction to ${file}`);
}

// CLI Execution entrypoint
if (process.argv[1]?.endsWith('evaluate-vision.ts')) {
  runVisionEvaluation().catch(console.error);
}
