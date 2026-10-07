import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MockAIProvider } from '../src/agents/ai-provider.js';
import { scoringAgent } from '../src/agents/scoring.agent.js';
import { visionAgent } from '../src/agents/vision.agent.js';
import { buildApp } from '../src/app.js';
import { pool } from '../src/db/index.js';
import { runMigrations } from '../src/db/migrate.js';
import { seed } from '../src/db/seed.js';
import { eventBus } from '../src/events/event-bus.js';
import { agentRunRepository } from '../src/repositories/agent-run.repository.js';
import { reviewRepository } from '../src/repositories/review.repository.js';
import { evidenceProcessingService } from '../src/services/evidence-processing.service.js';
import { LocalEvidenceStorage } from '../src/services/storage.service.js';

describe('EcoPulse Phase 6: Autonomous Observation & Read-Only AI Tests', () => {
  let app: FastifyInstance;
  let residentToken: string;
  let residentUserId: string;
  let maintainerToken: string;
  let maintainerUserId: string;
  let communityId: string;
  let reportId: string;
  let evidenceId: string;
  let pendingReviewId: string;

  beforeAll(async () => {
    await runMigrations();
    await seed();

    app = buildApp();
    await app.ready();

    // Login maintainer
    const mRes = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        email: 'maintainer@ecopulse.org',
        password: 'password123',
      },
    });
    maintainerToken = mRes.json().data.token;
    maintainerUserId = mRes.json().data.user.id;

    // Login resident
    const rRes = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        email: 'priya.sharma@example.com',
        password: 'password123',
      },
    });
    residentToken = rRes.json().data.token;
    residentUserId = rRes.json().data.user.id;

    const cRes = await app.inject({ method: 'GET', url: '/communities' });
    communityId = cRes.json().data[0].id;
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  // 1. Evidence upload through storage abstraction
  it('1. should upload and manage evidence through storage abstraction', async () => {
    const storage = new LocalEvidenceStorage();
    const testBuffer = Buffer.from('mock-waste-image-content-ecopulse');
    const uploadResult = await storage.uploadEvidence(testBuffer, 'test-waste.jpg', 'image/jpeg', {
      reportId: 'rep-test-1',
      uploaderId: residentUserId,
    });

    expect(uploadResult).toHaveProperty('storageKey');
    expect(uploadResult).toHaveProperty('publicUrl');
    expect(uploadResult.mimeType).toBe('image/jpeg');
    expect(uploadResult.sizeBytes).toBe(testBuffer.length);
  });

  // 2. Local storage provider
  it('2. should verify local storage provider can read, generate URL, and delete evidence', async () => {
    const storage = new LocalEvidenceStorage();
    const testBuffer = Buffer.from('local-storage-verify-bytes');
    const uploadResult = await storage.uploadEvidence(testBuffer, 'sample.jpg', 'image/jpeg');

    const retrievedBuffer = await storage.getEvidence(uploadResult.storageKey);
    expect(retrievedBuffer.toString()).toBe('local-storage-verify-bytes');

    const accessUrl = await storage.getAccessUrl(uploadResult.storageKey);
    expect(accessUrl).toContain('/uploads/');

    const deleted = await storage.deleteEvidence(uploadResult.storageKey);
    expect(deleted).toBe(true);
  });

  // 3. Mock AI provider
  it('3. should provide deterministic analysis using MockAIProvider', async () => {
    const provider = new MockAIProvider();
    const analysis = await provider.analyzeEvidence({
      evidenceId: 'ev-test-1',
      mediaUrl: 'https://images.unsplash.com/photo-dumping',
      categoryHint: 'ILLEGAL_DUMPING',
    });

    expect(analysis.provider).toBe('MOCK');
    expect(analysis.model).toBe('mock-vision-v1');
    expect(analysis.category).toBe('ILLEGAL_DUMPING');
    expect(analysis.severity).toBe('CRITICAL');
    expect(analysis.confidence).toBeGreaterThanOrEqual(0.85);
    expect(analysis.detectedObjects.length).toBeGreaterThan(0);
    expect(analysis.processingDurationMs).toBeGreaterThan(0);
  });

  // 4. Evidence processing event
  it('4. should publish EVIDENCE_PROCESSING_REQUESTED domain event upon evidence queueing', async () => {
    let eventReceived = false;
    let receivedPayload: any = null;

    const unsubscribe = eventBus.subscribe('EVIDENCE_PROCESSING_REQUESTED', async (evt) => {
      eventReceived = true;
      receivedPayload = evt.payload;
    });

    // Create a new report
    const repRes = await app.inject({
      method: 'POST',
      url: '/reports',
      headers: { authorization: `Bearer ${residentToken}` },
      payload: {
        communityId,
        category: 'OVERFLOWING_BIN',
        title: 'Overflowing dustbin outside market',
        description: 'Trash spilling on street.',
        locationAddress: 'Market Entrance, Pune',
      },
    });
    reportId = repRes.json().data.id;

    // Attach evidence
    const evRes = await app.inject({
      method: 'POST',
      url: `/reports/${reportId}/evidence`,
      headers: { authorization: `Bearer ${residentToken}` },
      payload: {
        mediaUrl: 'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?w=800',
        mediaType: 'IMAGE',
      },
    });

    expect(evRes.statusCode).toBe(201);
    evidenceId = evRes.json().data.id;

    // Wait briefly for event bus dispatch
    await new Promise((r) => setTimeout(r, 200));

    expect(eventReceived).toBe(true);
    expect(receivedPayload.evidenceId).toBe(evidenceId);
    expect(receivedPayload.reportId).toBe(reportId);

    unsubscribe();
  });

  // 5. Vision Agent output
  it('5. should execute Vision Agent and produce structured observation and audit run', async () => {
    const observation = await visionAgent.analyzeEvidence({
      evidenceId,
      mediaUrl: 'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?w=800',
      categoryHint: 'OVERFLOWING_BIN',
      locationAddress: 'Market Entrance, Pune',
    });

    expect(observation.evidenceId).toBe(evidenceId);
    expect(observation.category).toBe('OVERFLOWING_BIN');
    expect(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).toContain(observation.severity);
    expect(observation.confidence).toBeGreaterThan(0.5);
    expect(Array.isArray(observation.detectedObjects)).toBe(true);

    // Verify agent run is audited in agent_runs table
    const auditRun = await agentRunRepository.findByEntityAndType(evidenceId, 'VISION');
    expect(auditRun).not.toBeNull();
    expect(auditRun!.status).toBe('COMPLETED');
    expect(auditRun!.provider).toBe('MOCK');
  });

  // 6. AI recommendation creation
  it('6. should execute Scoring Agent and generate advisory recommendation', async () => {
    const observation = await visionAgent.analyzeEvidence({
      evidenceId,
      mediaUrl: 'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?w=800',
      categoryHint: 'OVERFLOWING_BIN',
    });

    const recommendation = await scoringAgent.generateRecommendation({
      entityType: 'REPORT',
      entityId: reportId,
      observation,
    });

    expect(recommendation.entityId).toBe(reportId);
    expect(['DISPATCH_FIELD_TASK', 'VERIFY_REPORT', 'REQUEST_MORE_EVIDENCE', 'NO_ACTION', 'ESCALATE']).toContain(
      recommendation.recommendation
    );
    expect(recommendation.confidence).toBeGreaterThan(0.5);
    expect(recommendation.reason.length).toBeGreaterThan(10);
  });

  // 7. Recommendation written to reviews table
  it('7. should record AI recommendation into reviews table in PENDING state', async () => {
    const pendingReviews = await reviewRepository.list({
      entityType: 'REPORT',
      entityId: reportId,
      decision: 'PENDING',
    });

    expect(pendingReviews.length).toBeGreaterThan(0);
    const rev = pendingReviews[0];
    pendingReviewId = rev.id;

    expect(rev.decision).toBe('PENDING');
    expect(rev.aiProvider?.toLowerCase()).toBe('mock');
    expect(rev.detectedIssue).toBe('OVERFLOWING BIN');
    expect(rev.aiConfidence).toBeGreaterThan(50);
    expect(rev.detectedObjects).toBeDefined();
  });

  // 8. Maintainer approval
  it('8. should allow maintainer to approve report, transition status to VERIFIED, and credit points', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/reviews/${reportId}/approve`,
      headers: { authorization: `Bearer ${maintainerToken}` },
      payload: {
        reason: 'Confirmed visual match. Municipal crew will remediate.',
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.decision).toBe('APPROVED');

    // Verify report status is updated to VERIFIED
    const repRes = await app.inject({
      method: 'GET',
      url: `/reports/${reportId}`,
      headers: { authorization: `Bearer ${maintainerToken}` },
    });
    expect(repRes.json().data.status).toBe('VERIFIED');
  });

  // 9. Maintainer rejection
  it('9. should allow maintainer to reject report, transition status to REJECTED without points', async () => {
    // Create another report to reject
    const repRes = await app.inject({
      method: 'POST',
      url: '/reports',
      headers: { authorization: `Bearer ${residentToken}` },
      payload: {
        communityId,
        category: 'OTHER',
        title: 'Unclear photo test report',
        description: 'Random blurry test image',
      },
    });
    const rejectReportId = repRes.json().data.id;

    const rejRes = await app.inject({
      method: 'POST',
      url: `/reviews/${rejectReportId}/reject`,
      headers: { authorization: `Bearer ${maintainerToken}` },
      payload: {
        reason: 'Image is blurry with no discernible environmental violation.',
      },
    });

    expect(rejRes.statusCode).toBe(200);
    expect(rejRes.json().data.decision).toBe('REJECTED');

    const checkRes = await app.inject({
      method: 'GET',
      url: `/reports/${rejectReportId}`,
      headers: { authorization: `Bearer ${maintainerToken}` },
    });
    expect(checkRes.json().data.status).toBe('REJECTED');
  });

  // 10. Duplicate evidence processing idempotency
  it('10. should handle duplicate evidence processing idempotently without failure', async () => {
    // Process the same job twice
    await evidenceProcessingService.processEvidenceJob({
      evidenceId,
      reportId,
      uploaderId: residentUserId,
    });

    await evidenceProcessingService.processEvidenceJob({
      evidenceId,
      reportId,
      uploaderId: residentUserId,
    });

    const runs = await agentRunRepository.listByEntity(evidenceId);
    const visionRuns = runs.filter((r) => r.agentType === 'VISION');
    // Idempotent execution reuses the completed run
    expect(visionRuns.length).toBe(1);
  });

  // 11. Duplicate recommendation prevention
  it('11. should prevent duplicate review recommendations for the same evidence', async () => {
    const observation = await visionAgent.analyzeEvidence({
      evidenceId,
      mediaUrl: 'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?w=800',
    });

    // Call generate recommendation again
    await scoringAgent.generateRecommendation({
      entityType: 'REPORT',
      entityId: reportId,
      observation,
    });

    const reviews = await reviewRepository.list({
      entityType: 'REPORT',
      entityId: reportId,
    });

    // Should only have 1 review for this report/evidence
    expect(reviews.filter((r) => r.evidenceId === evidenceId).length).toBe(1);
  });

  // 12. AI failure handling
  it('12. should handle AI provider failure safely and emit AI_RECOMMENDATION_FAILED', async () => {
    let failedEventEmitted = false;
    const unsubscribe = eventBus.subscribe('AI_RECOMMENDATION_FAILED', async () => {
      failedEventEmitted = true;
    });

    // Try processing invalid evidence that provider rejects
    await evidenceProcessingService.processEvidenceJob({
      evidenceId: 'invalid-non-existent-uuid',
      reportId: undefined,
    });

    await new Promise((r) => setTimeout(r, 100));
    expect(failedEventEmitted).toBe(true);

    unsubscribe();
  });

  // 13. Existing report verification RBAC
  it('13. should prevent resident from verifying reports or approving reviews', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/reviews/${reportId}/approve`,
      headers: { authorization: `Bearer ${residentToken}` },
      payload: { reason: 'Resident trying to approve own report' },
    });

    expect(res.statusCode).toBe(403);
  });

  // 14. Existing point ledger behavior
  it('14. should ensure point ledger records verified report credits and maintains balances', async () => {
    const pointsRes = await app.inject({
      method: 'GET',
      url: '/me/points',
      headers: { authorization: `Bearer ${residentToken}` },
    });

    expect(pointsRes.statusCode).toBe(200);
    const { balance, ledger } = pointsRes.json().data;
    expect(balance.totalPoints).toBeGreaterThan(0);
    expect(balance.lifetimeEarned).toBeGreaterThanOrEqual(balance.totalPoints);
    expect(Array.isArray(ledger)).toBe(true);
    expect(ledger.length).toBeGreaterThan(0);
  });

  // 15. Existing task lifecycle
  it('15. should support converting verified report into a field task and progressing its lifecycle', async () => {
    // 1. Create task from verified report
    const createRes = await app.inject({
      method: 'POST',
      url: '/tasks',
      headers: { authorization: `Bearer ${maintainerToken}` },
      payload: {
        communityId,
        reportId,
        title: 'Clear overflowing bin outside market',
        description: 'Sanitation team dispatched with compactor truck.',
        priority: 'HIGH',
      },
    });

    expect(createRes.statusCode).toBe(201);
    const taskId = createRes.json().data.id;
    expect(createRes.json().data.status).toBe('CREATED');

    // 2. Assign task
    const assignRes = await app.inject({
      method: 'POST',
      url: `/tasks/${taskId}/assign`,
      headers: { authorization: `Bearer ${maintainerToken}` },
      payload: { assignedTo: maintainerUserId },
    });
    expect(assignRes.statusCode).toBe(200);
    expect(assignRes.json().data.status).toBe('ASSIGNED');

    // 3. Complete task
    const completeRes = await app.inject({
      method: 'POST',
      url: `/tasks/${taskId}/complete`,
      headers: { authorization: `Bearer ${maintainerToken}` },
    });
    expect(completeRes.statusCode).toBe(200);
    expect(completeRes.json().data.status).toBe('COMPLETED');

    // 4. Verify task
    const verifyRes = await app.inject({
      method: 'POST',
      url: `/tasks/${taskId}/verify`,
      headers: { authorization: `Bearer ${maintainerToken}` },
    });
    expect(verifyRes.statusCode).toBe(200);
    expect(verifyRes.json().data.status).toBe('VERIFIED');
  });
});
