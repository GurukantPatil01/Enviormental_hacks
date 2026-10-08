import type { HumanReview, ReviewDecision, ReviewEntityType } from '@ecopulse/types';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { environmentalEvents } from '../db/schema.js';
import { eventBus } from '../events/event-bus.js';
import { reportRepository } from '../repositories/report.repository.js';
import { reviewRepository } from '../repositories/review.repository.js';
import { pointsService } from './points.service.js';

export interface SubmitReviewDecisionParams {
  entityType: ReviewEntityType;
  entityId: string;
  decision: ReviewDecision;
  reviewerId: string;
  reason?: string;
  recommendation?: string;
  confidence?: number;
}

export class ReviewService {
  async processDecision(params: SubmitReviewDecisionParams): Promise<HumanReview> {
    // 1. If an advisory review is already pending for this entity, update it with human decision
    const existingPending = await reviewRepository.findPendingByEntity(params.entityType, params.entityId);
    let review: HumanReview;

    if (existingPending) {
      const updated = await reviewRepository.updateDecision(
        existingPending.id,
        params.decision,
        params.reviewerId,
        params.reason
      );
      review = updated || existingPending;
    } else {
      // Create new persistent Human Review record
      review = await reviewRepository.create({
        entityType: params.entityType,
        entityId: params.entityId,
        decision: params.decision,
        reviewerId: params.reviewerId,
        reason: params.reason,
        recommendation: params.recommendation,
        confidence: params.confidence ?? 100,
      });
    }

    await eventBus.publish(
      'REVIEW_CREATED',
      review.id,
      {
        reviewId: review.id,
        entityType: review.entityType,
        entityId: review.entityId,
        decision: review.decision,
      },
      params.reviewerId
    );

    // 2. Handle specific entity verification behavior
    if (params.entityType === 'REPORT') {
      await this.handleReportReview(params.entityId, params.decision, params.reviewerId, params.reason);
    }

    if (params.decision === 'APPROVED') {
      await eventBus.publish(
        'REVIEW_APPROVED',
        review.id,
        {
          reviewId: review.id,
          entityType: review.entityType,
          entityId: review.entityId,
        },
        params.reviewerId
      );
    } else if (params.decision === 'REJECTED') {
      await eventBus.publish(
        'REVIEW_REJECTED',
        review.id,
        {
          reviewId: review.id,
          entityType: review.entityType,
          entityId: review.entityId,
          reason: params.reason,
        },
        params.reviewerId
      );
    }

    return review;
  }

  private async handleReportReview(
    reportId: string,
    decision: ReviewDecision,
    reviewerId: string,
    reason?: string
  ): Promise<void> {
    const report = await reportRepository.findById(reportId);
    if (!report) {
      const err: any = new Error('Report not found for review');
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    if (decision === 'APPROVED') {
      // Transition report to VERIFIED
      await reportRepository.updateStatus(reportId, 'VERIFIED');
      try {
        await db.update(environmentalEvents)
          .set({ status: 'VERIFIED' })
          .where(eq(environmentalEvents.reportId, reportId));
      } catch (e) {
        console.error('[ReviewService] Failed to sync VERIFIED to environmental_events:', e);
      }

      // Update associated evidence items to VERIFIED
      if (report.evidence) {
        for (const ev of report.evidence) {
          await reportRepository.updateEvidenceStatus(ev.id, 'VERIFIED');
        }
      }

      // Authoritative points award into immutable ledger
      // Reference ID is the reportId to prevent duplicate awards
      await pointsService.awardPoints({
        userId: report.userId,
        communityId: report.communityId,
        source: 'VERIFIED_REPORT',
        referenceId: reportId,
        amount: report.pointsReward || 20,
        approvedBy: reviewerId,
        clientEventId: `verified-report-${reportId}`,
        metadata: {
          reportTitle: report.title,
          category: report.category,
          verifiedAt: new Date().toISOString(),
          reason,
        },
      });

      await eventBus.publish(
        'REPORT_VERIFIED',
        report.id,
        {
          reportId: report.id,
          communityId: report.communityId,
          userId: report.userId,
          pointsAwarded: report.pointsReward || 20,
        },
        reviewerId
      );
    } else if (decision === 'REQUEST_MORE_EVIDENCE') {
      // Mark report as UNDER_REVIEW requesting further documentation
      await reportRepository.updateStatus(reportId, 'UNDER_REVIEW');
      try {
        await db.update(environmentalEvents)
          .set({ status: 'UNDER_REVIEW' })
          .where(eq(environmentalEvents.reportId, reportId));
      } catch (e) {
        console.error('[ReviewService] Failed to sync UNDER_REVIEW to environmental_events:', e);
      }
    } else {
      // Transition report to REJECTED
      await reportRepository.updateStatus(reportId, 'REJECTED');
      try {
        await db.update(environmentalEvents)
          .set({ status: 'REJECTED' })
          .where(eq(environmentalEvents.reportId, reportId));
      } catch (e) {
        console.error('[ReviewService] Failed to sync REJECTED to environmental_events:', e);
      }

      if (report.evidence) {
        for (const ev of report.evidence) {
          await reportRepository.updateEvidenceStatus(ev.id, 'REJECTED');
        }
      }

      await eventBus.publish(
        'REPORT_REJECTED',
        report.id,
        {
          reportId: report.id,
          communityId: report.communityId,
          userId: report.userId,
          reason,
        },
        reviewerId
      );
    }
  }


  async listReviews(filters?: { entityType?: ReviewEntityType; entityId?: string }): Promise<HumanReview[]> {
    return reviewRepository.list(filters);
  }

  async getReview(id: string): Promise<HumanReview> {
    const review = await reviewRepository.findById(id);
    if (!review) {
      const err: any = new Error('Review not found');
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }
    return review;
  }
}

export const reviewService = new ReviewService();
