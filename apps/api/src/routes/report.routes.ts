import { addEvidenceSchema, createReportSchema } from '@ecopulse/validation';
import type { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth.middleware.js';
import { reportService } from '../services/report.service.js';

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
}
