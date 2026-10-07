import type { AIRecommendation, ReviewEntityType, VisionObservation } from '@ecopulse/types';

export interface ScoringRecommendationInput {
  entityType: ReviewEntityType;
  entityId: string;
  observation: VisionObservation;
  metadata?: Record<string, unknown> | null;
}

export interface IScoringRecommendationAgent {
  generateRecommendation(input: ScoringRecommendationInput): Promise<AIRecommendation>;
}
