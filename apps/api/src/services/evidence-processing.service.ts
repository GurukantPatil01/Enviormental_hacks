import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { aiObservations, environmentalEmbeddings, environmentalEvents } from '../db/schema.js';
import { MockEmbeddingProvider } from '../ai/embedding-provider.js';
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
      let recommendation;
      if (reportId) {
        recommendation = await scoringAgent.generateRecommendation({
          entityType: 'REPORT',
          entityId: reportId,
          observation,
        });

        // 5. Sync to environmental_events, ai_observations, and environmental_embeddings
        try {
          const events = await db
            .select()
            .from(environmentalEvents)
            .where(eq(environmentalEvents.reportId, reportId))
            .limit(1);

          if (events.length > 0) {
            const event = events[0];
            const eventSeverity = observation.severity || 'MEDIUM';
            const geminiData = (observation as any).geminiAnalysis;

            // Flag for human review if ambiguous or poor quality
            const needsHumanReview = Boolean(geminiData?.requiresHumanReview);
            const eventStatus = needsHumanReview ? 'REVIEW_REQUIRED' : 'ANALYZED';

            // Update severity and status on event
            await db
              .update(environmentalEvents)
              .set({
                severity: eventSeverity,
                status: eventStatus,
                updatedAt: new Date(),
              })
              .where(eq(environmentalEvents.id, event.id));

            // Check for existing AI observation (Idempotency)
            const existingObs = await db
              .select()
              .from(aiObservations)
              .where(eq(aiObservations.eventId, event.id))
              .limit(1);

            const obsValues = {
              eventId: event.id,
              modelProvider: observation.provider || 'mock',
              modelName: observation.model || 'mock-vision-v1',
              wasteType: observation.category || categoryHint || 'WASTE_HOTSPOT',
              secondaryWasteTypes: observation.detectedObjects || [],
              severity: eventSeverity,
              confidence: observation.confidence ?? 0.85,
              estimatedVolume: geminiData?.estimatedVolume || (observation as any).estimatedVolume || 'Moderate visible volume',
              environmentalRisk:
                geminiData?.environmentalRiskIndicators?.join(', ') ||
                recommendation?.reason ||
                observation.observations ||
                'Environmental contamination risk',
              publicSafetyRisk:
                geminiData?.potentialObstruction && geminiData.potentialObstruction !== 'NONE'
                  ? `Obstruction risk: ${geminiData.potentialObstruction}`
                  : eventSeverity === 'CRITICAL' || eventSeverity === 'HIGH'
                  ? 'High public safety hazard'
                  : 'Moderate public safety concern',
              illegalDumpingLikelihood: observation.category === 'ILLEGAL_DUMPING' ? 0.9 : 0.2,
              recommendedAction:
                geminiData?.recommendedAction ||
                recommendation?.reason ||
                'Schedule site inspection and cleanup',
              rawMetadata: { observation, recommendation, geminiAnalysis: geminiData } as any,
            };

            if (existingObs.length > 0) {
              await db
                .update(aiObservations)
                .set(obsValues)
                .where(eq(aiObservations.id, existingObs[0].id));
            } else {
              await db.insert(aiObservations).values({
                id: randomUUID(),
                ...obsValues,
              });
            }

            // Insert or update vector embedding for semantic search
            const existingEmb = await db
              .select()
              .from(environmentalEmbeddings)
              .where(eq(environmentalEmbeddings.eventId, event.id))
              .limit(1);

            if (existingEmb.length === 0) {
              const embeddingProvider = new MockEmbeddingProvider(384);
              const textToEmbed = `${event.description || ''} ${observation.category} ${observation.observations || ''} ${recommendation?.reason || ''}`;
              const vector = await embeddingProvider.embedText(textToEmbed);

              await db.insert(environmentalEmbeddings).values({
                id: randomUUID(),
                eventId: event.id,
                provider: 'mock',
                model: 'mock-embed-v1',
                modality: 'TEXT',
                dimensions: 384,
                vector: vector as any,
              });
            }
          }
        } catch (dbErr) {
          console.error('[EvidencePipeline] Error updating environmental events and AI observations:', dbErr);
        }
      }

      console.log(`[EvidencePipeline] Completed AI recommendation for evidence ${evidenceId}`);
    } catch (err: any) {
      console.error(`[EvidencePipeline] Failure processing evidence ${evidenceId}:`, err);

      // Set event status to FAILED if event exists
      if (reportId) {
        try {
          await db
            .update(environmentalEvents)
            .set({ status: 'FAILED', updatedAt: new Date() })
            .where(eq(environmentalEvents.reportId, reportId));
        } catch {
          // non-blocking
        }
      }

      await eventBus.publish('AI_RECOMMENDATION_FAILED', evidenceId, {
        evidenceId,
        reportId,
        error: err.message || 'Processing failure',
      });
    }
  }
}

export const evidenceProcessingService = new EvidenceProcessingService();
