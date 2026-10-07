import type {
  AIRecommendation,
  AIRecommendationAction,
  ReviewEntityType,
  VisionObservation,
} from '@ecopulse/types';
import { eventBus } from '../events/event-bus.js';
import { agentRunRepository } from '../repositories/agent-run.repository.js';
import { reviewRepository } from '../repositories/review.repository.js';

export interface GenerateRecommendationParams {
  entityType: ReviewEntityType;
  entityId: string;
  observation: VisionObservation;
  metadata?: Record<string, unknown> | null;
}

export class ScoringAgent {
  async generateRecommendation(params: GenerateRecommendationParams): Promise<AIRecommendation> {
    const { observation, entityType, entityId } = params;

    // 1. Idempotency Check on Agent Run
    const existingRun = await agentRunRepository.findByEntityAndType(observation.evidenceId, 'SCORING');
    if (existingRun && existingRun.status === 'COMPLETED' && existingRun.outputReference) {
      console.log(`[ScoringAgent] Idempotent hit: Recommendation already generated for evidence ${observation.evidenceId}`);
      return existingRun.outputReference as unknown as AIRecommendation;
    }

    // 2. Determine Action & Rationale based on Observation
    let action: AIRecommendationAction = 'VERIFY_REPORT';
    let reason = 'Evidence matches reported environmental observation.';

    if (observation.category === 'ILLEGAL_DUMPING' || observation.severity === 'CRITICAL') {
      action = 'DISPATCH_FIELD_TASK';
      reason = 'Critical environmental hazard detected. Recommend immediate municipal sanitation dispatch.';
    } else if (observation.category === 'OVERFLOWING_BIN' || observation.category === 'WASTE_HOTSPOT') {
      action = 'DISPATCH_FIELD_TASK';
      reason = 'Evidence confirms substantial waste accumulation. Recommend dispatching local collection crew.';
    } else if (observation.category === 'NO_CLEAR_ISSUE' || observation.confidence < 0.6) {
      action = 'REQUEST_MORE_EVIDENCE';
      reason = 'Image quality or framing is inconclusive. Recommend requesting clearer photo evidence.';
    } else if (observation.category === 'MIXED_WASTE' || observation.category === 'MISSED_COLLECTION') {
      action = 'VERIFY_REPORT';
      reason = 'Source segregation or collection gap confirmed. Verified for citizen EcoPoints reward.';
    }

    const recommendationData: AIRecommendation = {
      id: crypto.randomUUID(),
      entityType,
      entityId,
      evidenceId: observation.evidenceId,
      recommendation: action,
      confidence: observation.confidence,
      reason,
      detectedIssue: observation.category.replace('_', ' '),
      severity: observation.severity,
      detectedObjects: observation.detectedObjects,
      provider: observation.provider,
      model: observation.model,
      createdAt: new Date().toISOString(),
    };

    // 3. Persist Agent Run Record
    const run = await agentRunRepository.create({
      agentType: 'SCORING',
      entityType,
      entityId: observation.evidenceId,
      provider: observation.provider,
      model: observation.model,
      status: 'COMPLETED',
      inputReference: observation.evidenceId,
      outputReference: recommendationData as any,
      metadata: params.metadata,
    });

    // 4. Save into Human Reviews queue with status PENDING
    // Check if a pending review already exists for this entity to prevent duplicates
    const existingPending = await reviewRepository.findPendingByEntity(entityType, entityId);
    if (!existingPending) {
      await reviewRepository.create({
        entityType,
        entityId,
        evidenceId: observation.evidenceId,
        recommendation: action,
        confidence: Math.round(observation.confidence * 100),
        decision: 'PENDING',
        reason,
        aiProvider: observation.provider,
        aiModel: observation.model,
        aiConfidence: Math.round(observation.confidence * 100),
        detectedIssue: observation.category.replace('_', ' '),
        severity: observation.severity,
        detectedObjects: observation.detectedObjects,
      });
    }

    // 5. Emit AI_RECOMMENDATION_CREATED Event
    await eventBus.publish(
      'AI_RECOMMENDATION_CREATED',
      entityId,
      {
        recommendationId: recommendationData.id,
        entityType,
        entityId,
        evidenceId: observation.evidenceId,
        recommendation: action,
        confidence: observation.confidence,
        reason,
        severity: observation.severity,
        provider: observation.provider,
      }
    );

    return recommendationData;
  }
}

export const scoringAgent = new ScoringAgent();
