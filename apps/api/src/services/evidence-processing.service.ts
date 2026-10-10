import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { aiObservations, environmentalEmbeddings, environmentalEvents } from '../db/schema.js';
import { MockEmbeddingProvider } from '../ai/embedding-provider.js';
import { scoringAgent } from '../agents/scoring.agent.js';
import { dumpingAnalysisAgent } from '../agents/adk-dumping.agent.js';
import { visionAgent } from '../agents/vision.agent.js';
import { eventBus } from '../events/event-bus.js';
import { evidenceProcessingQueue } from '../queue/job-queue.js';
import { reportRepository } from '../repositories/report.repository.js';
import { storageService } from './storage.service.js';
import { observability } from '../observability/observability.js';

export interface EvidenceJobPayload {
  evidenceId: string;
  reportId?: string | null;
  uploaderId?: string | null;
  correlationId?: string;
  attempt?: number;
  maxAttempts?: number;
  rethrow?: boolean;
}

export class EvidenceProcessingService {
  private isInitialized = false;

  public initialize(): void {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // Process asynchronous evidence queue
    evidenceProcessingQueue.process(async (job: EvidenceJobPayload, meta) => {
      await this.processEvidenceJob({
        ...job,
        correlationId: meta.correlationId || job.correlationId,
        attempt: meta.attempt || job.attempt || 1,
        maxAttempts: meta.maxAttempts || job.maxAttempts || 3,
        rethrow: true,
      });
    });

    console.log('🤖 Asynchronous Evidence Processing Pipeline initialized.');
  }

  public async queueEvidence(job: EvidenceJobPayload): Promise<void> {
    const correlationId = job.correlationId || `corr-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const enrichedJob = { ...job, correlationId };

    // 1. Publish domain event to EventBridge / EventBus
    await eventBus.publish(
      'EVIDENCE_PROCESSING_REQUESTED',
      enrichedJob.evidenceId,
      {
        evidenceId: enrichedJob.evidenceId,
        reportId: enrichedJob.reportId,
        correlationId,
      },
      enrichedJob.uploaderId,
      correlationId
    );

    // 2. Enqueue non-blocking job into SQS / in-memory queue
    await evidenceProcessingQueue.enqueue(enrichedJob, { correlationId });

    await observability.metric('Evidence.Queued', 1, 'Count', [
      { name: 'QueueProvider', value: evidenceProcessingQueue.isSQS() ? 'SQS' : 'IN_MEMORY' },
    ]);
  }

  public async processEvidenceJob(job: EvidenceJobPayload): Promise<void> {
    const { evidenceId, reportId } = job;
    const correlationId = job.correlationId || `corr-${Date.now()}`;
    const attempt = job.attempt || 1;
    const maxAttempts = job.maxAttempts || 3;

    observability.log('info', `[EvidencePipeline] Starting AI observation for evidence ${evidenceId}`, {
      evidenceId,
      reportId: reportId ?? undefined,
      correlationId,
      attempt,
      maxAttempts,
    });

    await observability.trace(
      'Evidence.Processing',
      async () => {
        try {
          // 1. Fetch report details for context
          let categoryHint = 'WASTE_HOTSPOT';
          let locationAddress = 'Community Area';
          let reportLat: number | undefined;
          let reportLng: number | undefined;

          if (reportId) {
            const report = await reportRepository.findById(reportId);
            if (report) {
              categoryHint = report.category;
              locationAddress = report.locationAddress || locationAddress;
              const coords = (report.locationGeoJson as any)?.coordinates;
              if (Array.isArray(coords)) {
                reportLng = coords[0];
                reportLat = coords[1];
              }

              // IDEMPOTENCY CHECK: If already analyzed and observation exists, skip duplicate inference
              if (report.status === 'ANALYZED' && report.aiObservation) {
                observability.log('info', `[EvidencePipeline] Idempotent hit: Report ${reportId} already analyzed`, {
                  reportId,
                  evidenceId,
                  correlationId,
                });
                await observability.metric('Evidence.DuplicateSkipped', 1, 'Count');
                return;
              }
            }

            // Mark event status as PROCESSING in DB
            await db
              .update(environmentalEvents)
              .set({ status: 'PROCESSING', updatedAt: new Date() })
              .where(eq(environmentalEvents.reportId, reportId));
          }

          // 2. Fetch evidence media URL & Verify S3 object storage
          let mediaUrl = 'https://storage.ecopulse.local/evidence/' + evidenceId;
          let storageKey: string | null = null;

          if (reportId) {
            const evList = await reportRepository.listEvidence(reportId);
            const match = evList.find((e) => e.id === evidenceId);
            if (match) {
              mediaUrl = match.mediaUrl;
              storageKey = (match as any).storageKey || null;
            }
          }

          // Verify image is actually in storage before model inference
          const lookupTarget = storageKey || mediaUrl;
          if (lookupTarget && !lookupTarget.startsWith('data:')) {
            try {
              const buffer = await storageService.getEvidence(lookupTarget);
              if (!buffer || buffer.length === 0) {
                throw new Error(`Evidence object "${lookupTarget}" is empty in S3 storage.`);
              }
              await observability.metric('S3.ObjectVerified', 1, 'Count', [
                { name: 'StorageProvider', value: storageService.getProviderName() },
              ]);
            } catch (storageErr: any) {
              // If external demo URL, continue, otherwise throw to trigger retry
              if (!lookupTarget.includes('http')) {
                throw new Error(`S3 storage retrieval failed for evidence ${evidenceId}: ${storageErr.message}`);
              }
            }
          }

          // 3. Vision Agent: generate observation (Gemini / Bedrock)
          const aiStart = Date.now();
          const observation = await visionAgent.analyze({
            evidenceId,
            mediaUrl,
            categoryHint,
            locationAddress,
          });
          const aiDuration = Date.now() - aiStart;

          await observability.metric('AI.InferenceDuration', aiDuration, 'Milliseconds', [
            { name: 'Provider', value: observation.provider || 'UNKNOWN' },
            { name: 'Model', value: observation.model || 'UNKNOWN' },
          ]);

          // 3b. Google ADK Dumping Analysis Agent
          const dumpingAnalysis = await dumpingAnalysisAgent.analyze({
            evidenceId,
            reportId,
            observation,
            latitude: reportLat,
            longitude: reportLng,
            locationAddress,
          });

          // 4. Scoring Agent: generate advisory recommendation for human review
          let recommendation;
          if (reportId) {
            recommendation = await scoringAgent.generateRecommendation({
              entityType: 'REPORT',
              entityId: reportId,
              observation,
              dumpingAnalysis,
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
                const visionData =
                  (observation as any).bedrockAnalysis ||
                  (observation as any).geminiAnalysis ||
                  (observation as any).visionAnalysis;
                const scoringAnalysis = (recommendation as any)?.scoringAnalysis;

                // Flag for human review if ambiguous or poor quality
                const needsHumanReview =
                  Boolean(visionData?.requiresHumanReview) ||
                  Boolean((observation as any)?.requiresHumanReview) ||
                  Boolean(scoringAnalysis?.requiresHumanReview);
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
                  estimatedVolume:
                    dumpingAnalysis?.estimatedVolumeCategory ||
                    visionData?.estimatedVolume ||
                    (observation as any).estimatedVolume ||
                    'Moderate visible volume',
                  environmentalRisk:
                    visionData?.environmentalRiskIndicators?.join(', ') ||
                    recommendation?.reason ||
                    observation.observations ||
                    'Environmental contamination risk',
                  publicSafetyRisk:
                    visionData?.potentialObstruction && visionData.potentialObstruction !== 'NONE'
                      ? `Obstruction risk: ${visionData.potentialObstruction}`
                      : eventSeverity === 'CRITICAL' || eventSeverity === 'HIGH'
                      ? 'High public safety hazard'
                      : 'Moderate public safety concern',
                  illegalDumpingLikelihood:
                    dumpingAnalysis?.dumpingLikelihood ?? (observation.category === 'ILLEGAL_DUMPING' ? 0.9 : 0.2),
                  recommendedAction:
                    dumpingAnalysis?.deterrenceStrategy ||
                    visionData?.recommendedAction ||
                    recommendation?.reason ||
                    'Schedule site inspection and cleanup',
                  rawMetadata: {
                    observation,
                    recommendation,
                    visionAnalysis: visionData,
                    bedrockAnalysis: (observation as any).bedrockAnalysis,
                    geminiAnalysis: (observation as any).geminiAnalysis || visionData,
                    dumpingAnalysis,
                    scoringAnalysis,
                    correlationId,
                  } as any,
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

          await observability.metric('Evidence.Processed', 1, 'Count', [
            { name: 'Provider', value: observation.provider || 'UNKNOWN' },
            { name: 'Category', value: observation.category || 'UNKNOWN' },
          ]);

          observability.log('info', `[EvidencePipeline] Completed AI recommendation for evidence ${evidenceId}`, {
            evidenceId,
            reportId: reportId ?? undefined,
            correlationId,
            category: observation.category,
            severity: observation.severity,
          });
        } catch (err: any) {
          observability.log('error', `[EvidencePipeline] Failure processing evidence ${evidenceId}: ${err.message}`, {
            evidenceId,
            reportId: reportId ?? undefined,
            correlationId,
            attempt,
            maxAttempts,
            error: err.message,
          });

          await observability.metric('Evidence.Failed', 1, 'Count', [
            { name: 'Reason', value: err.name || 'Error' },
          ]);

          // If direct invocation or retry attempts exhausted, transition to terminal FAILED state
          const isDirectInvocation = job.attempt === undefined;
          const isTerminal = isDirectInvocation || attempt >= maxAttempts;

          if (isTerminal) {
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

            await eventBus.publish(
              'AI_RECOMMENDATION_FAILED',
              evidenceId,
              {
                evidenceId,
                reportId: reportId ?? undefined,
                correlationId,
                error: err.message || 'Processing failure',
                terminal: true,
              },
              job.uploaderId ?? undefined,
              correlationId
            );
          }

          // Re-throw only if explicitly requested by queue worker runner
          if (job.rethrow) {
            throw err;
          }
        }
      },
      { evidenceId, reportId: reportId ?? undefined, correlationId }
    );
  }
}

export const evidenceProcessingService = new EvidenceProcessingService();
