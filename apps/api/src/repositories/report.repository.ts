import type { Evidence, Report, ReportAIFindings, ReportCategory, ReportStatus, VerificationStatus } from '@ecopulse/types';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { aiObservations, environmentalEvents, evidence, reports, users } from '../db/schema.js';
import { reviewRepository } from './review.repository.js';

export interface CreateReportInput {
  userId: string;
  communityId: string;
  category: ReportCategory;
  title: string;
  description: string;
  status?: ReportStatus;
  locationGeoJson?: Record<string, unknown> | null;
  locationAddress?: string | null;
  clientEventId?: string | null;
  pointsReward?: number;
}

export interface AddEvidenceInput {
  reportId?: string | null;
  missionId?: string | null;
  uploaderId?: string | null;
  mediaUrl: string;
  mediaType?: string;
  locationGeoJson?: Record<string, unknown> | null;
  verificationStatus?: VerificationStatus;
  metadata?: Record<string, unknown> | null;
}

export class ReportRepository {
  async create(data: CreateReportInput): Promise<Report> {
    const [row] = await db
      .insert(reports)
      .values({
        userId: data.userId,
        communityId: data.communityId,
        category: data.category,
        title: data.title,
        description: data.description,
        status: data.status || 'SUBMITTED',
        locationGeoJson: data.locationGeoJson,
        locationAddress: data.locationAddress,
        clientEventId: data.clientEventId,
        pointsReward: data.pointsReward ?? 15,
      })
      .returning();

    return this.mapToReport(row);
  }

  async findById(id: string): Promise<Report | null> {
    const [row] = await db
      .select({
        report: reports,
        user: {
          id: users.id,
          fullName: users.fullName,
          email: users.email,
        },
      })
      .from(reports)
      .leftJoin(users, eq(reports.userId, users.id))
      .where(eq(reports.id, id));

    if (!row) return null;

    const reportEvidence = await this.listEvidence(id);
    const reportReviews = await reviewRepository.list({ entityType: 'REPORT', entityId: id });

    // Fetch real environmental event and AI observation if available
    const [envEvent] = await db
      .select()
      .from(environmentalEvents)
      .where(eq(environmentalEvents.reportId, id))
      .limit(1);

    let aiObs: any = null;
    let aiFindings: ReportAIFindings | undefined;

    if (envEvent) {
      const [obs] = await db
        .select()
        .from(aiObservations)
        .where(eq(aiObservations.eventId, envEvent.id))
        .limit(1);
      aiObs = obs || null;

      if (aiObs) {
        const rawMeta = aiObs.rawMetadata as any;
        const visionData =
          rawMeta?.bedrockAnalysis ||
          rawMeta?.visionAnalysis ||
          rawMeta?.geminiAnalysis;
        const wasteDetected =
          visionData?.wasteDetected !== undefined
            ? Boolean(visionData.wasteDetected)
            : aiObs.wasteType !== 'NO_WASTE' && aiObs.wasteType !== 'NO_CLEAR_ISSUE';

        aiFindings = {
          wasteDetected,
          wasteType: aiObs.wasteType,
          secondaryWasteTypes: Array.isArray(aiObs.secondaryWasteTypes)
            ? (aiObs.secondaryWasteTypes as string[])
            : [],
          severity: aiObs.severity as any,
          confidence: aiObs.confidence,
          estimatedVolume: aiObs.estimatedVolume,
          environmentalRisk: aiObs.environmentalRisk,
          publicSafetyRisk: aiObs.publicSafetyRisk,
          recommendedAction: aiObs.recommendedAction,
          modelProvider: aiObs.modelProvider,
          modelName: aiObs.modelName,
          requiresHumanReview: Boolean(
            visionData?.requiresHumanReview || envEvent.status === 'REVIEW_REQUIRED'
          ),
          explanation:
            visionData?.reasoning ||
            visionData?.description ||
            visionData?.recommendedAction ||
            aiObs.environmentalRisk ||
            null,
        };
      }
    }

    if (!aiFindings && reportReviews.length > 0) {
      const aiReview = reportReviews.find((r) => r.aiProvider || r.detectedIssue);
      if (aiReview) {
        aiFindings = {
          wasteDetected: aiReview.detectedIssue !== 'NO_WASTE',
          wasteType: aiReview.detectedIssue,
          secondaryWasteTypes: aiReview.detectedObjects,
          severity: aiReview.severity,
          confidence: aiReview.aiConfidence ? aiReview.aiConfidence / 100 : undefined,
          recommendedAction: aiReview.recommendation,
          modelProvider: aiReview.aiProvider,
          modelName: aiReview.aiModel,
          explanation: aiReview.reason || aiReview.recommendation,
        };
      }
    }

    return {
      ...this.mapToReport(row.report),
      evidence: reportEvidence,
      reviews: reportReviews,
      aiObservation: aiObs,
      aiFindings,
      user: row.user ?? undefined,
    };
  }

  async findByClientEventId(clientEventId: string): Promise<Report | null> {
    const [row] = await db.select().from(reports).where(eq(reports.clientEventId, clientEventId));
    if (!row) return null;
    return this.mapToReport(row);
  }

  async list(filters: {
    communityId?: string;
    userId?: string;
    status?: ReportStatus | ReportStatus[];
    category?: ReportCategory;
    limit?: number;
  }): Promise<Report[]> {
    const conditions = [];

    if (filters.communityId) {
      conditions.push(eq(reports.communityId, filters.communityId));
    }
    if (filters.userId) {
      conditions.push(eq(reports.userId, filters.userId));
    }
    if (filters.status) {
      if (Array.isArray(filters.status)) {
        conditions.push(inArray(reports.status, filters.status));
      } else {
        conditions.push(eq(reports.status, filters.status));
      }
    }
    if (filters.category) {
      conditions.push(eq(reports.category, filters.category));
    }

    const query = db
      .select({
        report: reports,
        user: {
          id: users.id,
          fullName: users.fullName,
          email: users.email,
        },
      })
      .from(reports)
      .leftJoin(users, eq(reports.userId, users.id))
      .orderBy(desc(reports.createdAt));

    const rows = await (conditions.length > 0 ? query.where(and(...conditions)) : query);

    // Fetch evidence and reviews for all reports
    const reportIds = rows.map((r) => r.report.id);
    const allEvidence = reportIds.length > 0 ? await this.listEvidenceForReports(reportIds) : [];
    const allReviews = reportIds.length > 0 ? await reviewRepository.list({ entityType: 'REPORT' }) : [];

    const evidenceByReportId = new Map<string, Evidence[]>();
    for (const ev of allEvidence) {
      if (ev.reportId) {
        const list = evidenceByReportId.get(ev.reportId) || [];
        list.push(ev);
        evidenceByReportId.set(ev.reportId, list);
      }
    }

    const reviewsByReportId = new Map<string, any[]>();
    for (const rev of allReviews) {
      const list = reviewsByReportId.get(rev.entityId) || [];
      list.push(rev);
      reviewsByReportId.set(rev.entityId, list);
    }

    return rows.map((r) => {
      const revs = reviewsByReportId.get(r.report.id) || [];
      const aiRev = revs.find((rev) => rev.aiProvider || rev.detectedIssue);
      let aiFindings: ReportAIFindings | undefined;
      if (aiRev) {
        aiFindings = {
          wasteDetected: aiRev.detectedIssue !== 'NO_WASTE',
          wasteType: aiRev.detectedIssue,
          secondaryWasteTypes: aiRev.detectedObjects,
          severity: aiRev.severity,
          confidence: aiRev.aiConfidence ? aiRev.aiConfidence / 100 : undefined,
          recommendedAction: aiRev.recommendation,
          modelProvider: aiRev.aiProvider,
          modelName: aiRev.aiModel,
          explanation: aiRev.reason || aiRev.recommendation,
        };
      }
      return {
        ...this.mapToReport(r.report),
        user: r.user ?? undefined,
        evidence: evidenceByReportId.get(r.report.id) || [],
        reviews: revs,
        aiFindings,
      };
    });
  }

  async updateStatus(id: string, status: ReportStatus): Promise<Report | null> {
    const [row] = await db
      .update(reports)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(reports.id, id))
      .returning();

    if (!row) return null;
    return this.mapToReport(row);
  }

  async addEvidence(data: AddEvidenceInput): Promise<Evidence> {
    const [row] = await db
      .insert(evidence)
      .values({
        reportId: data.reportId,
        missionId: data.missionId,
        uploaderId: data.uploaderId,
        mediaUrl: data.mediaUrl,
        mediaType: data.mediaType || 'IMAGE',
        locationGeoJson: data.locationGeoJson,
        verificationStatus: data.verificationStatus || 'PENDING',
        metadata: data.metadata,
      })
      .returning();

    return this.mapToEvidence(row);
  }

  async listEvidence(reportId: string): Promise<Evidence[]> {
    const rows = await db
      .select()
      .from(evidence)
      .where(eq(evidence.reportId, reportId))
      .orderBy(desc(evidence.uploadedAt));

    return rows.map((r) => this.mapToEvidence(r));
  }

  private async listEvidenceForReports(reportIds: string[]): Promise<Evidence[]> {
    const rows = await db
      .select()
      .from(evidence)
      .where(inArray(evidence.reportId, reportIds))
      .orderBy(desc(evidence.uploadedAt));

    return rows.map((r) => this.mapToEvidence(r));
  }

  async updateEvidenceStatus(id: string, status: VerificationStatus): Promise<Evidence | null> {
    const [row] = await db
      .update(evidence)
      .set({
        verificationStatus: status,
      })
      .where(eq(evidence.id, id))
      .returning();

    if (!row) return null;
    return this.mapToEvidence(row);
  }

  private mapToReport(row: typeof reports.$inferSelect): Report {
    return {
      id: row.id,
      userId: row.userId,
      communityId: row.communityId,
      category: row.category as ReportCategory,
      title: row.title,
      description: row.description,
      status: row.status as ReportStatus,
      locationGeoJson: (row.locationGeoJson as Record<string, unknown>) || null,
      locationAddress: row.locationAddress,
      clientEventId: row.clientEventId,
      pointsReward: row.pointsReward,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private mapToEvidence(row: typeof evidence.$inferSelect): Evidence {
    return {
      id: row.id,
      reportId: row.reportId,
      missionId: row.missionId,
      uploaderId: row.uploaderId,
      mediaUrl: row.mediaUrl,
      mediaType: row.mediaType,
      locationGeoJson: (row.locationGeoJson as Record<string, unknown>) || null,
      verificationStatus: row.verificationStatus as VerificationStatus,
      metadata: (row.metadata as Record<string, unknown>) || null,
      uploadedAt: row.uploadedAt.toISOString(),
    };
  }
}

export const reportRepository = new ReportRepository();
