import crypto from 'node:crypto';
import { GoogleGenAI } from '@google/genai';
import type {
  AIRecommendation,
  AIRecommendationAction,
  DumpingAnalysis,
  ReviewEntityType,
  ScoringAnalysis,
  VisionObservation,
} from '@ecopulse/types';
import { scoringAnalysisSchema } from '@ecopulse/validation';
import { eventBus } from '../events/event-bus.js';
import { agentRunRepository } from '../repositories/agent-run.repository.js';
import { reviewRepository } from '../repositories/review.repository.js';
import {
  calculatePriorityScoreTool,
  evaluateSafetyGuardrailsTool,
} from './adk-tools.js';

export interface GenerateRecommendationParams {
  entityType: ReviewEntityType;
  entityId: string;
  observation: VisionObservation;
  dumpingAnalysis?: DumpingAnalysis;
  metadata?: Record<string, unknown> | null;
}

export interface EnrichedAIRecommendation extends AIRecommendation {
  scoringAnalysis?: ScoringAnalysis;
  dumpingAnalysis?: DumpingAnalysis;
  priorityScore?: number;
}

export class ScoringAgent {
  private client: GoogleGenAI | null = null;
  private apiKey: string;
  private modelName: string;

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || '';
    this.modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
    if (this.apiKey) {
      this.client = new GoogleGenAI({ apiKey: this.apiKey });
    }
  }

  async generateRecommendation(params: GenerateRecommendationParams): Promise<EnrichedAIRecommendation> {
    const { observation, entityType, entityId, dumpingAnalysis } = params;

    // 1. Idempotency Check on Agent Run
    const existingRun = await agentRunRepository.findByEntityAndType(observation.evidenceId, 'SCORING');
    if (existingRun && existingRun.status === 'COMPLETED' && existingRun.outputReference) {
      console.log(`[ScoringAgent] Idempotent hit: Recommendation already generated for evidence ${observation.evidenceId}`);
      return existingRun.outputReference as unknown as EnrichedAIRecommendation;
    }

    const geminiMeta = (observation as any).geminiAnalysis;

    // 2. ADK Tool: Calculate Multi-Factor Priority Score
    const calculatedScore = calculatePriorityScoreTool({
      severity: observation.severity,
      dumpingLikelihood: dumpingAnalysis?.dumpingLikelihood ?? (observation.category === 'ILLEGAL_DUMPING' ? 0.9 : 0.2),
      potentialObstruction: geminiMeta?.potentialObstruction,
      environmentalRiskIndicators: geminiMeta?.environmentalRiskIndicators,
      repeatLocationRisk: dumpingAnalysis?.repeatLocationRisk || 'LOW',
    });

    // 3. ADK Tool: Evaluate Safety Guardrails
    const safety = evaluateSafetyGuardrailsTool({
      evidenceQuality: geminiMeta?.evidenceQuality,
      confidence: observation.confidence,
      limitations: geminiMeta?.limitations,
      dumpingLikelihood: dumpingAnalysis?.dumpingLikelihood,
    });

    // 4. Generate structured scoring analysis (via Gemini if available, else deterministic ADK)
    let scoringAnalysis: ScoringAnalysis;
    if (this.client && process.env.AI_ENABLED !== 'false') {
      try {
        scoringAnalysis = await this.executeGeminiScoring(params, calculatedScore, safety);
      } catch (err: any) {
        console.warn(`[ScoringAgent] Gemini scoring failed (${err.message}), falling back to deterministic ADK.`);
        scoringAnalysis = this.executeDeterministicScoring(params, calculatedScore, safety);
      }
    } else {
      scoringAnalysis = this.executeDeterministicScoring(params, calculatedScore, safety);
    }

    // 5. Map to AIRecommendationAction
    let action: AIRecommendationAction = 'VERIFY_REPORT';
    if (scoringAnalysis.recommendedAction === 'DISPATCH_FIELD_TASK') {
      action = 'DISPATCH_FIELD_TASK';
    } else if (scoringAnalysis.recommendedAction === 'REQUEST_MORE_EVIDENCE') {
      action = 'REQUEST_MORE_EVIDENCE';
    } else if (scoringAnalysis.recommendedAction === 'SCHEDULE_INSPECTION') {
      action = 'DISPATCH_FIELD_TASK';
    }

    const recommendationData: EnrichedAIRecommendation = {
      id: crypto.randomUUID(),
      entityType,
      entityId,
      evidenceId: observation.evidenceId,
      recommendation: action,
      confidence: scoringAnalysis.confidence,
      reason: scoringAnalysis.reason,
      detectedIssue: observation.category.replace('_', ' '),
      severity: observation.severity,
      detectedObjects: observation.detectedObjects,
      provider: this.client ? 'GEMINI' : observation.provider || 'ADK_SCORING',
      model: this.client ? this.modelName : observation.model || 'adk-scoring-v1',
      createdAt: new Date().toISOString(),
      scoringAnalysis,
      dumpingAnalysis,
      priorityScore: scoringAnalysis.priorityScore,
    };

    // 6. Persist Agent Run Record
    await agentRunRepository.create({
      agentType: 'SCORING',
      entityType,
      entityId: observation.evidenceId,
      provider: recommendationData.provider,
      model: recommendationData.model,
      status: 'COMPLETED',
      inputReference: observation.evidenceId,
      outputReference: recommendationData as any,
      metadata: {
        ...params.metadata,
        scoringAnalysis,
        dumpingAnalysis,
      },
    });

    // 7. Save into Human Reviews queue with status PENDING
    const existingPending = await reviewRepository.findPendingByEntity(entityType, entityId);
    if (!existingPending) {
      await reviewRepository.create({
        entityType,
        entityId,
        evidenceId: observation.evidenceId,
        recommendation: action,
        confidence: Math.round(scoringAnalysis.confidence * 100),
        decision: 'PENDING',
        reason: scoringAnalysis.reason,
        aiProvider: recommendationData.provider,
        aiModel: recommendationData.model,
        aiConfidence: Math.round(scoringAnalysis.confidence * 100),
        detectedIssue: observation.category.replace('_', ' '),
        severity: observation.severity,
        detectedObjects: observation.detectedObjects,
      });
    }

    // 8. Emit AI_RECOMMENDATION_CREATED Event
    await eventBus.publish(
      'AI_RECOMMENDATION_CREATED',
      entityId,
      {
        recommendationId: recommendationData.id,
        entityType,
        entityId,
        evidenceId: observation.evidenceId,
        recommendation: action,
        confidence: scoringAnalysis.confidence,
        reason: scoringAnalysis.reason,
        severity: observation.severity,
        provider: recommendationData.provider,
        priorityScore: scoringAnalysis.priorityScore,
      }
    );

    return recommendationData;
  }

  private async executeGeminiScoring(
    params: GenerateRecommendationParams,
    calculatedScore: any,
    safety: any
  ): Promise<ScoringAnalysis> {
    const { observation, dumpingAnalysis } = params;

    const systemInstruction = `
You are the EcoPulse Municipal Scoring & Prioritization Agent.
Your responsibility is to synthesize environmental vision observations and illegal dumping risk into a calibrated priority score (0-100) and recommendation.

RESPONSIBLE AI RULES:
- Never assign individual blame or authorize punitive fines automatically.
- Observations must remain strictly advisory for municipal maintainers.
- Flag human review whenever evidence quality is low or observations are ambiguous.
`;

    const userPrompt = `
Synthesize the incident assessment:
- Waste Category: ${observation.category}
- Severity: ${observation.severity}
- Confidence: ${observation.confidence}
- Dumping Likelihood: ${dumpingAnalysis?.dumpingLikelihood ?? 0.3}
- Dumping Classification: ${dumpingAnalysis?.dumpingClassification ?? 'LITTERING'}
- Repeat Hotspot Risk: ${dumpingAnalysis?.repeatLocationRisk ?? 'LOW'}
- Calculated Baseline Score: ${calculatedScore.priorityScore} (${calculatedScore.priorityLevel})
- Urgency Timeframe: ${calculatedScore.urgencyTimeframe}
- Human Review Guardrail Triggers: ${safety.guardrailTriggers.join('; ') || 'None'}

Return structured scoring analysis JSON matching:
{
  "priorityScore": number (0 to 100),
  "priorityLevel": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "recommendedAction": "VERIFY_REPORT" | "DISPATCH_FIELD_TASK" | "REQUEST_MORE_EVIDENCE" | "SCHEDULE_INSPECTION" | "ESCALATE_HOTSPOT",
  "recommendedPointsReward": number (0 to 100),
  "urgencyTimeframe": "IMMEDIATE_4H" | "WITHIN_24H" | "SCHEDULED_48H" | "ROUTINE_7D",
  "requiresHumanReview": boolean,
  "reason": string,
  "confidence": number,
  "riskFactorBreakdown": {
    "severityWeight": number,
    "dumpingWeight": number,
    "publicSafetyWeight": number,
    "environmentalWeight": number
  }
}
`;

    const response = await this.client!.models.generateContent({
      model: this.modelName,
      contents: userPrompt,
      config: {
        systemInstruction,
        temperature: 0.1,
        responseMimeType: 'application/json',
      },
    });

    const text = response.text || '';
    const cleanJson = text
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    const parsed = JSON.parse(cleanJson);
    return scoringAnalysisSchema.parse(parsed);
  }

  private executeDeterministicScoring(
    params: GenerateRecommendationParams,
    calculatedScore: any,
    safety: any
  ): ScoringAnalysis {
    const { observation, dumpingAnalysis } = params;
    const cat = observation.category;
    const sev = observation.severity;

    let recommendedAction: ScoringAnalysis['recommendedAction'] = 'VERIFY_REPORT';
    let reason = 'Evidence matches reported environmental observation.';

    if (sev === 'CRITICAL' || (dumpingAnalysis && dumpingAnalysis.dumpingLikelihood >= 0.75)) {
      recommendedAction = 'DISPATCH_FIELD_TASK';
      reason = 'Critical environmental hazard / verified illegal dumping detected. Recommend immediate municipal sanitation dispatch.';
    } else if (cat === 'OVERFLOWING_BIN' || cat === 'WASTE_HOTSPOT') {
      recommendedAction = 'DISPATCH_FIELD_TASK';
      reason = 'Evidence confirms substantial waste accumulation. Recommend dispatching local collection crew.';
    } else if (cat === 'NO_CLEAR_ISSUE' || observation.confidence < 0.6) {
      recommendedAction = 'REQUEST_MORE_EVIDENCE';
      reason = 'Image quality or framing is inconclusive. Recommend requesting clearer photo evidence.';
    } else if (dumpingAnalysis?.repeatLocationRisk === 'CRITICAL_REPEAT_HOTSPOT') {
      recommendedAction = 'ESCALATE_HOTSPOT';
      reason = 'Recurring hotspot corridor detected with frequent dumping violations. Escalating for preventative surveillance.';
    }

    const requiresHumanReview = safety.requiresHumanReview || Boolean((observation as any).geminiAnalysis?.requiresHumanReview);

    return {
      priorityScore: calculatedScore.priorityScore,
      priorityLevel: calculatedScore.priorityLevel,
      recommendedAction,
      recommendedPointsReward: calculatedScore.recommendedPointsReward,
      urgencyTimeframe: calculatedScore.urgencyTimeframe,
      requiresHumanReview,
      reason,
      confidence: observation.confidence,
      riskFactorBreakdown: calculatedScore.riskFactorBreakdown,
    };
  }
}

export const scoringAgent = new ScoringAgent();
