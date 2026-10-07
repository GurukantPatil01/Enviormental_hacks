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

export interface IVisionAgent {
  analyze(input: VisionAnalysisInput): Promise<VisionObservation>;
}
