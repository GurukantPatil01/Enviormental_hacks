import { scoringAgent } from '../agents/scoring.agent.js';
import { visionAgent } from '../agents/vision.agent.js';
import { eventBus } from '../events/event-bus.js';
import { evidenceProcessingQueue } from '../queue/job-queue.js';
import { reportRepository } from '../repositories/report.repository.js';

export interface EvidenceJobPayload {
  evidenceId: string;
  reportId?: string | null;
  uploaderId?: string | null;
}

export class EvidenceProcessingService {
  private isInitialized = false;

  public initialize(): void {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // Process asynchronous evidence queue
    evidenceProcessingQueue.process(async (job: EvidenceJobPayload) => {
      await this.processEvidenceJob(job);
    });

    console.log('🤖 Asynchronous Evidence Processing Pipeline initialized.');
  }

  public async queueEvidence(job: EvidenceJobPayload): Promise<void> {
    await eventBus.publish(
      'EVIDENCE_PROCESSING_REQUESTED',
      job.evidenceId,
      {
        evidenceId: job.evidenceId,
        reportId: job.reportId,
      },
      job.uploaderId
    );

    // Enqueue non-blocking job
    await evidenceProcessingQueue.enqueue(job);
  }

  public async processEvidenceJob(job: EvidenceJobPayload): Promise<void> {
    const { evidenceId, reportId } = job;
    console.log(`[EvidencePipeline] Starting AI observation for evidence ${evidenceId}`);

    try {
      // 1. Fetch report details for context
      let categoryHint = 'WASTE_HOTSPOT';
      let locationAddress = 'Community Area';

      if (reportId) {
        const report = await reportRepository.findById(reportId);
        if (report) {
          categoryHint = report.category;
          locationAddress = report.locationAddress || locationAddress;
        }
      }

      // 2. Fetch evidence media URL
      let mediaUrl = 'https://storage.ecopulse.local/evidence/' + evidenceId;
      if (reportId) {
        const evList = await reportRepository.listEvidence(reportId);
        const match = evList.find((e) => e.id === evidenceId);
        if (match) {
          mediaUrl = match.mediaUrl;
        }
      }

      // 3. Vision Agent: generate observation
      const observation = await visionAgent.analyze({
        evidenceId,
        mediaUrl,
        categoryHint,
        locationAddress,
      });

      // 4. Scoring Agent: generate advisory recommendation for human review
      if (reportId) {
        await scoringAgent.generateRecommendation({
          entityType: 'REPORT',
          entityId: reportId,
          observation,
        });
      }

      console.log(`[EvidencePipeline] Completed AI recommendation for evidence ${evidenceId}`);
    } catch (err: any) {
      console.error(`[EvidencePipeline] Failure processing evidence ${evidenceId}:`, err);
      await eventBus.publish('AI_RECOMMENDATION_FAILED', evidenceId, {
        evidenceId,
        reportId,
        error: err.message || 'Processing failure',
      });
    }
  }
}

export const evidenceProcessingService = new EvidenceProcessingService();
