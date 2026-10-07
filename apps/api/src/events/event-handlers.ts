import { auditRepository } from '../repositories/audit.repository.js';
import { eventBus } from './event-bus.js';

export function registerEventHandlers() {
  // 1. Audit Log listeners for domain events
  eventBus.subscribe('USER_REGISTERED', async (event) => {
    await auditRepository.record({
      actorId: event.actorId,
      action: 'USER_REGISTERED',
      entityType: 'user',
      entityId: event.aggregateId,
      after: event.payload,
    });
  });

  eventBus.subscribe('COMMUNITY_JOINED', async (event) => {
    await auditRepository.record({
      actorId: event.actorId,
      action: 'COMMUNITY_JOINED',
      entityType: 'community',
      entityId: event.aggregateId,
      after: event.payload,
    });
  });

  eventBus.subscribe('MISSION_COMPLETED', async (event) => {
    await auditRepository.record({
      actorId: event.actorId,
      action: 'MISSION_COMPLETED',
      entityType: 'mission',
      entityId: event.aggregateId,
      after: event.payload,
    });
  });

  eventBus.subscribe('POINTS_AWARDED', async (event) => {
    await auditRepository.record({
      actorId: event.actorId,
      action: 'POINTS_AWARDED',
      entityType: 'point_ledger',
      entityId: event.aggregateId,
      after: event.payload,
    });
  });

  // Report events
  eventBus.subscribe('REPORT_CREATED', async (event) => {
    await auditRepository.record({
      actorId: event.actorId,
      action: 'REPORT_CREATED',
      entityType: 'report',
      entityId: event.aggregateId,
      after: event.payload,
    });
  });

  eventBus.subscribe('REPORT_SUBMITTED', async (event) => {
    await auditRepository.record({
      actorId: event.actorId,
      action: 'REPORT_SUBMITTED',
      entityType: 'report',
      entityId: event.aggregateId,
      after: event.payload,
    });
  });

  eventBus.subscribe('REPORT_VERIFIED', async (event) => {
    await auditRepository.record({
      actorId: event.actorId,
      action: 'REPORT_VERIFIED',
      entityType: 'report',
      entityId: event.aggregateId,
      after: event.payload,
    });
  });

  eventBus.subscribe('REPORT_REJECTED', async (event) => {
    await auditRepository.record({
      actorId: event.actorId,
      action: 'REPORT_REJECTED',
      entityType: 'report',
      entityId: event.aggregateId,
      after: event.payload,
    });
  });

  // Evidence & AI events
  eventBus.subscribe('EVIDENCE_ADDED', async (event) => {
    await auditRepository.record({
      actorId: event.actorId,
      action: 'EVIDENCE_ADDED',
      entityType: 'evidence',
      entityId: event.aggregateId,
      after: event.payload,
    });

    // Asynchronously trigger AI observation & recommendation pipeline
    const { reportId, uploaderId } = (event.payload as any) || {};
    const { evidenceProcessingService } = await import('../services/evidence-processing.service.js');
    await evidenceProcessingService.queueEvidence({
      evidenceId: event.aggregateId,
      reportId,
      uploaderId: event.actorId || uploaderId,
    });
  });

  eventBus.subscribe('EVIDENCE_PROCESSING_REQUESTED', async (event) => {
    await auditRepository.record({
      actorId: event.actorId,
      action: 'EVIDENCE_PROCESSING_REQUESTED',
      entityType: 'evidence',
      entityId: event.aggregateId,
      after: event.payload,
    });
  });

  eventBus.subscribe('EVIDENCE_PROCESSING_STARTED', async (event) => {
    await auditRepository.record({
      actorId: event.actorId,
      action: 'EVIDENCE_PROCESSING_STARTED',
      entityType: 'evidence',
      entityId: event.aggregateId,
      after: event.payload,
    });
  });

  eventBus.subscribe('EVIDENCE_ANALYZED', async (event) => {
    await auditRepository.record({
      actorId: event.actorId,
      action: 'EVIDENCE_ANALYZED',
      entityType: 'evidence',
      entityId: event.aggregateId,
      after: event.payload,
    });
  });

  eventBus.subscribe('AI_RECOMMENDATION_CREATED', async (event) => {
    await auditRepository.record({
      actorId: event.actorId,
      action: 'AI_RECOMMENDATION_CREATED',
      entityType: 'report',
      entityId: event.aggregateId,
      after: event.payload,
    });
  });

  eventBus.subscribe('AI_RECOMMENDATION_FAILED', async (event) => {
    await auditRepository.record({
      actorId: event.actorId,
      action: 'AI_RECOMMENDATION_FAILED',
      entityType: 'evidence',
      entityId: event.aggregateId,
      after: event.payload,
    });
  });

  // Review events
  eventBus.subscribe('REVIEW_CREATED', async (event) => {

    await auditRepository.record({
      actorId: event.actorId,
      action: 'REVIEW_CREATED',
      entityType: 'review',
      entityId: event.aggregateId,
      after: event.payload,
    });
  });

  eventBus.subscribe('REVIEW_APPROVED', async (event) => {
    await auditRepository.record({
      actorId: event.actorId,
      action: 'REVIEW_APPROVED',
      entityType: 'review',
      entityId: event.aggregateId,
      after: event.payload,
    });
  });

  eventBus.subscribe('REVIEW_REJECTED', async (event) => {
    await auditRepository.record({
      actorId: event.actorId,
      action: 'REVIEW_REJECTED',
      entityType: 'review',
      entityId: event.aggregateId,
      after: event.payload,
    });
  });

  // Task events
  eventBus.subscribe('TASK_CREATED', async (event) => {
    await auditRepository.record({
      actorId: event.actorId,
      action: 'TASK_CREATED',
      entityType: 'task',
      entityId: event.aggregateId,
      after: event.payload,
    });
  });

  eventBus.subscribe('TASK_ASSIGNED', async (event) => {
    await auditRepository.record({
      actorId: event.actorId,
      action: 'TASK_ASSIGNED',
      entityType: 'task',
      entityId: event.aggregateId,
      after: event.payload,
    });
  });

  eventBus.subscribe('TASK_COMPLETED', async (event) => {
    await auditRepository.record({
      actorId: event.actorId,
      action: 'TASK_COMPLETED',
      entityType: 'task',
      entityId: event.aggregateId,
      after: event.payload,
    });
  });

  eventBus.subscribe('TASK_VERIFIED', async (event) => {
    await auditRepository.record({
      actorId: event.actorId,
      action: 'TASK_VERIFIED',
      entityType: 'task',
      entityId: event.aggregateId,
      after: event.payload,
    });
  });

  // Milestone events
  eventBus.subscribe('MILESTONE_REACHED', async (event) => {
    await auditRepository.record({
      actorId: event.actorId,
      action: 'MILESTONE_REACHED',
      entityType: 'milestone',
      entityId: event.aggregateId,
      after: event.payload,
    });
  });

  console.log('📡 Domain event handlers registered.');
}

