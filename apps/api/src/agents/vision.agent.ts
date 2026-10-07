import type { VisionObservation } from '@ecopulse/types';
import { eventBus } from '../events/event-bus.js';
import { agentRunRepository } from '../repositories/agent-run.repository.js';
import { reportRepository } from '../repositories/report.repository.js';
import { getAIProvider, type IAIProvider, type VisionAnalysisInput } from './ai-provider.js';

export class VisionAgent {
  private aiProvider: IAIProvider;

  constructor(provider?: IAIProvider) {
    this.aiProvider = provider || getAIProvider();
  }

  setProvider(provider: IAIProvider): void {
    this.aiProvider = provider;
  }

  async analyzeEvidence(input: VisionAnalysisInput): Promise<VisionObservation> {
    return this.analyze(input);
  }

  async analyze(input: VisionAnalysisInput): Promise<VisionObservation> {
    // 1. Idempotency Check: if this evidence already has a completed run, return cached output
    const existingRun = await agentRunRepository.findByEntityAndType(input.evidenceId, 'VISION');
    if (existingRun && existingRun.status === 'COMPLETED' && existingRun.outputReference) {
      console.log(`[VisionAgent] Idempotent hit: Evidence ${input.evidenceId} already analyzed.`);
      return existingRun.outputReference as unknown as VisionObservation;
    }

    // 2. Publish Processing Started
    await eventBus.publish(
      'EVIDENCE_PROCESSING_STARTED',
      input.evidenceId,
      {
        evidenceId: input.evidenceId,
        provider: this.aiProvider.getProviderName(),
        model: this.aiProvider.getModelName(),
      }
    );

    // 3. Create Agent Run Record
    const run = await agentRunRepository.create({
      agentType: 'VISION',
      entityType: 'EVIDENCE',
      entityId: input.evidenceId,
      provider: this.aiProvider.getProviderName(),
      model: this.aiProvider.getModelName(),
      status: 'RUNNING',
      inputReference: input.mediaUrl,
      metadata: input.metadata,
    });

    try {
      // 4. Perform observation via AI Provider
      const observation = await this.aiProvider.analyzeEvidence(input);

      // 5. Update Agent Run to COMPLETED
      await agentRunRepository.updateStatus(run.id, 'COMPLETED', observation as any);

      // 6. Publish EVIDENCE_ANALYZED event
      await eventBus.publish(
        'EVIDENCE_ANALYZED',
        input.evidenceId,
        {
          evidenceId: input.evidenceId,
          category: observation.category,
          severity: observation.severity,
          confidence: observation.confidence,
          detectedObjects: observation.detectedObjects,
          provider: observation.provider,
          model: observation.model,
          processingDurationMs: observation.processingDurationMs,
        }
      );

      return observation;
    } catch (err: any) {
      console.error(`[VisionAgent] Error analyzing evidence ${input.evidenceId}:`, err);
      await agentRunRepository.updateStatus(run.id, 'FAILED', null, err.message || 'Analysis failed');

      await eventBus.publish(
        'AI_RECOMMENDATION_FAILED',
        input.evidenceId,
        {
          evidenceId: input.evidenceId,
          error: err.message || 'Vision analysis failed',
        }
      );

      throw err;
    }
  }
}

export const visionAgent = new VisionAgent();
