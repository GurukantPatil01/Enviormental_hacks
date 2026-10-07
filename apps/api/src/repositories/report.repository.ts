import type { Evidence, Report, ReportCategory, ReportStatus, VerificationStatus } from '@ecopulse/types';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { evidence, reports, users } from '../db/schema.js';
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
    return {
      ...this.mapToReport(row.report),
      evidence: reportEvidence,
      reviews: reportReviews,
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

    return rows.map((r) => ({
      ...this.mapToReport(r.report),
      user: r.user ?? undefined,
      evidence: evidenceByReportId.get(r.report.id) || [],
      reviews: reviewsByReportId.get(r.report.id) || [],
    }));
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
