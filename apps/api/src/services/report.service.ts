import type { Evidence, Report, ReportCategory, ReportStatus, VerificationStatus } from '@ecopulse/types';
import { eventBus } from '../events/event-bus.js';
import { reportRepository } from '../repositories/report.repository.js';
import { evidenceStorage } from './storage.service.js';

export interface CreateReportParams {
  userId: string;
  communityId: string;
  category: ReportCategory;
  title: string;
  description: string;
  locationGeoJson?: Record<string, unknown> | null;
  locationAddress?: string | null;
  clientEventId?: string | null;
  isDraft?: boolean;
}

export interface AddEvidenceParams {
  reportId?: string | null;
  missionId?: string | null;
  uploaderId: string;
  fileBuffer?: Buffer;
  fileName?: string;
  mimeType?: string;
  mediaUrl?: string;
  locationGeoJson?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}

export class ReportService {
  async createReport(params: CreateReportParams): Promise<{ report: Report; isDuplicate: boolean }> {
    // 1. Check idempotency if clientEventId provided
    if (params.clientEventId) {
      const existing = await reportRepository.findByClientEventId(params.clientEventId);
      if (existing) {
        return { report: existing, isDuplicate: true };
      }
    }

    const initialStatus: ReportStatus = params.isDraft ? 'DRAFT' : 'SUBMITTED';

    // 2. Persist report record
    const report = await reportRepository.create({
      userId: params.userId,
      communityId: params.communityId,
      category: params.category,
      title: params.title,
      description: params.description,
      status: initialStatus,
      locationGeoJson: params.locationGeoJson,
      locationAddress: params.locationAddress,
      clientEventId: params.clientEventId,
      pointsReward: 20, // default reward for verified report
    });

    // 3. Publish domain events
    await eventBus.publish(
      'REPORT_CREATED',
      report.id,
      {
        reportId: report.id,
        communityId: report.communityId,
        category: report.category,
        title: report.title,
        status: report.status,
      },
      params.userId
    );

    if (report.status === 'SUBMITTED') {
      await eventBus.publish(
        'REPORT_SUBMITTED',
        report.id,
        {
          reportId: report.id,
          communityId: report.communityId,
          category: report.category,
        },
        params.userId
      );
    }

    return { report, isDuplicate: false };
  }

  async submitDraft(reportId: string, userId: string): Promise<Report> {
    const report = await reportRepository.findById(reportId);
    if (!report) {
      const err: any = new Error('Report not found');
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    if (report.userId !== userId) {
      const err: any = new Error('You do not have permission to submit this report');
      err.statusCode = 403;
      err.code = 'FORBIDDEN';
      throw err;
    }

    if (report.status !== 'DRAFT') {
      const err: any = new Error(`Cannot submit report in status ${report.status}`);
      err.statusCode = 400;
      err.code = 'INVALID_STATE';
      throw err;
    }

    const updated = await reportRepository.updateStatus(reportId, 'SUBMITTED');
    if (!updated) {
      throw new Error('Failed to update report status');
    }

    await eventBus.publish(
      'REPORT_SUBMITTED',
      report.id,
      {
        reportId: report.id,
        communityId: report.communityId,
        category: report.category,
      },
      userId
    );

    return updated;
  }

  async attachEvidence(params: AddEvidenceParams): Promise<Evidence> {
    let finalMediaUrl = params.mediaUrl;

    // If fileBuffer is provided, save via EvidenceStorage abstraction
    if (params.fileBuffer && params.fileName && params.mimeType) {
      const stored = await evidenceStorage.upload({
        data: params.fileBuffer,
        filename: params.fileName,
        mimeType: params.mimeType,
        metadata: { uploaderId: params.uploaderId },
      });
      finalMediaUrl = stored.url;
    }


    if (!finalMediaUrl) {
      const err: any = new Error('Evidence requires either file data or mediaUrl');
      err.statusCode = 400;
      err.code = 'INVALID_EVIDENCE';
      throw err;
    }

    const evidence = await reportRepository.addEvidence({
      reportId: params.reportId,
      missionId: params.missionId,
      uploaderId: params.uploaderId,
      mediaUrl: finalMediaUrl,
      mediaType: 'IMAGE',
      locationGeoJson: params.locationGeoJson,
      verificationStatus: 'PENDING',
      metadata: params.metadata,
    });

    await eventBus.publish(
      'EVIDENCE_ADDED',
      evidence.id,
      {
        evidenceId: evidence.id,
        reportId: evidence.reportId,
        uploaderId: evidence.uploaderId,
        mediaUrl: evidence.mediaUrl,
      },
      params.uploaderId
    );

    return evidence;
  }

  async getReport(id: string): Promise<Report> {
    const report = await reportRepository.findById(id);
    if (!report) {
      const err: any = new Error('Report not found');
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }
    return report;
  }

  async listReports(filters: {
    communityId?: string;
    userId?: string;
    status?: ReportStatus | ReportStatus[];
    category?: ReportCategory;
    limit?: number;
  }): Promise<Report[]> {
    return reportRepository.list(filters);
  }

  async listEvidence(reportId: string): Promise<Evidence[]> {
    return reportRepository.listEvidence(reportId);
  }
}

export const reportService = new ReportService();
