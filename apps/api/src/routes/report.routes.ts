import crypto from 'node:crypto';
import path from 'node:path';
import { addEvidenceSchema, createReportSchema } from '@ecopulse/validation';
import type { FastifyInstance } from 'fastify';
import { authenticate, requireRole } from '../middleware/auth.middleware.js';
import { reportService } from '../services/report.service.js';
import { storageService } from '../services/storage.service.js';
import { evidenceProcessingService } from '../services/evidence-processing.service.js';

export async function reportRoutes(app: FastifyInstance) {
  // 1. List reports
  app.get<{
    Querystring: {
      communityId?: string;
      userId?: string;
      status?: string;
      category?: string;
    };
  }>('/reports', async (request, reply) => {
    const { communityId, userId, status, category } = request.query;
    const reports = await reportService.listReports({
      communityId,
      userId,
      status: status as any,
      category: category as any,
    });
    return reply.send({ data: reports });
  });

  // 2. Create report
  app.post(
    '/reports',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const parsed = createReportSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid report data',
            details: parsed.error.format(),
          },
        });
      }

      const { report, isDuplicate } = await reportService.createReport({
        userId: request.user!.id,
        communityId: parsed.data.communityId,
        category: parsed.data.category,
        title: parsed.data.title,
        description: parsed.data.description,
        locationGeoJson: parsed.data.locationGeoJson,
        locationAddress: parsed.data.locationAddress,
        clientEventId: parsed.data.clientEventId,
      });

      return reply.status(isDuplicate ? 200 : 201).send({
        data: report,
        meta: { isDuplicate },
      });
    }
  );

  // 3. Get report by ID
  app.get<{ Params: { id: string } }>('/reports/:id', async (request, reply) => {
    try {
      const report = await reportService.getReport(request.params.id);
      return reply.send({ data: report });
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({
        error: {
          code: err.code || 'REPORT_ERROR',
          message: err.message,
        },
      });
    }
  });

  // 4. Submit draft report
  app.post<{ Params: { id: string } }>(
    '/reports/:id/submit',
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        const report = await reportService.submitDraft(request.params.id, request.user!.id);
        return reply.send({ data: report });
      } catch (err: any) {
        return reply.status(err.statusCode || 500).send({
          error: {
            code: err.code || 'SUBMIT_ERROR',
            message: err.message,
          },
        });
      }
    }
  );

  // 5. Attach evidence to report
  app.post<{ Params: { id: string } }>(
    '/reports/:id/evidence',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const parsed = addEvidenceSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid evidence payload',
            details: parsed.error.format(),
          },
        });
      }

      try {
        const evidence = await reportService.attachEvidence({
          reportId: request.params.id,
          uploaderId: request.user!.id,
          mediaUrl: parsed.data.mediaUrl,
          locationGeoJson: parsed.data.locationGeoJson,
          metadata: parsed.data.metadata,
        });

        return reply.status(201).send({ data: evidence });
      } catch (err: any) {
        return reply.status(err.statusCode || 500).send({
          error: {
            code: err.code || 'EVIDENCE_ERROR',
            message: err.message,
          },
        });
      }
    }
  );

  // 6. List evidence for a report
  app.get<{ Params: { id: string } }>('/reports/:id/evidence', async (request, reply) => {
    try {
      const evidenceList = await reportService.listEvidence(request.params.id);
      return reply.send({ data: evidenceList });
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({
        error: {
          code: err.code || 'EVIDENCE_ERROR',
          message: err.message,
        },
      });
    }
  });

  // 7. Upload real-time photo evidence from device camera
  app.post(
    '/reports/upload',
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        const body = request.body as {
          data?: string;
          filename?: string;
          mimeType?: string;
        };

        if (!body || !body.data) {
          return reply.status(400).send({
            error: {
              code: 'INVALID_PAYLOAD',
              message: 'Missing image data (base64 or data URI required)',
            },
          });
        }

        const filename = body.filename || `evidence-${Date.now()}.jpg`;
        const mimeType = body.mimeType || 'image/jpeg';

        const result = await storageService.uploadEvidence(body.data, filename, mimeType);
        return reply.send({ data: result });
      } catch (err: any) {
        return reply.status(500).send({
          error: {
            code: 'UPLOAD_FAILED',
            message: err.message || 'Failed to process evidence upload',
          },
        });
      }
    }
  );

  // 7b. Request presigned upload URL for direct AWS S3 client-side uploads
  app.post(
    '/reports/presigned-upload',
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        const body = (request.body || {}) as {
          filename?: string;
          mimeType?: string;
        };

        const ext = path.extname(body.filename || '') || '.jpg';
        const key = `reports/evidence/${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
        const mimeType = body.mimeType || 'image/jpeg';

        const uploadUrl = await storageService.getSignedUrl(key, 'putObject', 900); // 15 mins
        const accessUrl = await storageService.getSignedUrl(key, 'getObject', 7 * 24 * 3600); // 7 days

        return reply.send({
          data: {
            storageKey: key,
            uploadUrl,
            accessUrl,
            mimeType,
            provider: storageService.getProviderName(),
          },
        });
      } catch (err: any) {
        return reply.status(500).send({
          error: {
            code: 'PRESIGNED_UPLOAD_FAILED',
            message: err.message || 'Failed to generate presigned upload URL',
          },
        });
      }
    }
  );

  // 8. Serve evidence files or redirect to S3 presigned URL
  app.get<{ Params: { filename: string } }>('/uploads/:filename', async (request, reply) => {
    try {
      if (storageService.getProviderName() === 'S3') {
        const url = await storageService.getAccessUrl(request.params.filename);
        if (url && url.startsWith('http')) {
          return reply.redirect(url, 302);
        }
      }

      const buffer = await storageService.getEvidence(request.params.filename);
      reply.header('Content-Type', 'image/jpeg');
      return reply.send(buffer);
    } catch {
      return reply.status(404).send({
        error: {
          code: 'FILE_NOT_FOUND',
          message: 'Evidence image not found',
        },
      });
    }
  });

  // 9. Reprocess report AI analysis (Maintainers only)
  app.post<{ Params: { id: string } }>(
    '/reports/:id/reprocess',
    { preHandler: [requireRole('MAINTAINER', 'WARD_ADMIN', 'SUPER_ADMIN')] },
    async (request, reply) => {
      try {
        const report = await reportService.getReport(request.params.id);
        if (!report) {
          return reply.status(404).send({
            error: { code: 'NOT_FOUND', message: 'Report not found' },
          });
        }

        const evidenceList = await reportService.listEvidence(request.params.id);
        if (!evidenceList || evidenceList.length === 0) {
          return reply.status(400).send({
            error: { code: 'NO_EVIDENCE', message: 'No evidence attached to report for AI analysis' },
          });
        }

        await evidenceProcessingService.processEvidenceJob({
          evidenceId: evidenceList[0].id,
          reportId: request.params.id,
          uploaderId: request.user!.id,
        });

        return reply.send({ success: true, message: 'Report AI analysis reprocessed successfully' });
      } catch (err: any) {
        return reply.status(err.statusCode || 500).send({
          error: { code: 'REPROCESS_FAILED', message: err.message },
        });
      }
    }
  );
}

