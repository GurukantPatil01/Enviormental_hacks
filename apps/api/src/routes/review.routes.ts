import { reviewDecisionSchema } from '@ecopulse/validation';
import type { FastifyInstance } from 'fastify';
import { requireRole } from '../middleware/auth.middleware.js';
import { reviewService } from '../services/review.service.js';

export async function reviewRoutes(app: FastifyInstance) {
  // 1. List reviews (Maintainers and Admins only)
  app.get(
    '/reviews',
    { preHandler: [requireRole('MAINTAINER', 'WARD_ADMIN', 'SUPER_ADMIN')] },
    async (request, reply) => {
      const query = request.query as { entityType?: string; entityId?: string };
      const list = await reviewService.listReviews({
        entityType: query.entityType as any,
        entityId: query.entityId,
      });
      return reply.send({ data: list });
    }
  );

  // 2. Approve Review
  app.post<{
    Params: { id: string };
    Body: { entityType?: 'REPORT' | 'TASK' | 'MISSION'; reason?: string; recommendation?: string };
  }>(
    '/reviews/:id/approve',
    { preHandler: [requireRole('MAINTAINER', 'WARD_ADMIN', 'SUPER_ADMIN')] },
    async (request, reply) => {
      try {
        const body = request.body || {};
        const review = await reviewService.processDecision({
          entityType: body.entityType || 'REPORT',
          entityId: request.params.id,
          decision: 'APPROVED',
          reviewerId: request.user!.id,
          reason: body.reason || 'Verified by maintainer',
          recommendation: body.recommendation,
        });

        return reply.status(200).send({ data: review });
      } catch (err: any) {
        return reply.status(err.statusCode || 500).send({
          error: {
            code: err.code || 'REVIEW_ERROR',
            message: err.message,
          },
        });
      }
    }
  );

  // 3. Reject Review
  app.post<{
    Params: { id: string };
    Body: { entityType?: 'REPORT' | 'TASK' | 'MISSION'; reason?: string; recommendation?: string };
  }>(
    '/reviews/:id/reject',
    { preHandler: [requireRole('MAINTAINER', 'WARD_ADMIN', 'SUPER_ADMIN')] },
    async (request, reply) => {
      try {
        const body = request.body || {};
        const review = await reviewService.processDecision({
          entityType: body.entityType || 'REPORT',
          entityId: request.params.id,
          decision: 'REJECTED',
          reviewerId: request.user!.id,
          reason: body.reason || 'Insufficient or invalid evidence',
          recommendation: body.recommendation,
        });

        return reply.status(200).send({ data: review });
      } catch (err: any) {
        return reply.status(err.statusCode || 500).send({
          error: {
            code: err.code || 'REVIEW_ERROR',
            message: err.message,
          },
        });
      }
    }
  );

  // 4. Request More Evidence
  app.post<{
    Params: { id: string };
    Body: { entityType?: 'REPORT' | 'TASK' | 'MISSION'; reason?: string; recommendation?: string };
  }>(
    '/reviews/:id/request-evidence',
    { preHandler: [requireRole('MAINTAINER', 'WARD_ADMIN', 'SUPER_ADMIN')] },
    async (request, reply) => {
      try {
        const body = request.body || {};
        const review = await reviewService.processDecision({
          entityType: body.entityType || 'REPORT',
          entityId: request.params.id,
          decision: 'REQUEST_MORE_EVIDENCE',
          reviewerId: request.user!.id,
          reason: body.reason || 'Please provide clearer, closer photos of the waste location',
          recommendation: body.recommendation,
        });

        return reply.status(200).send({ data: review });
      } catch (err: any) {
        return reply.status(err.statusCode || 500).send({
          error: {
            code: err.code || 'REVIEW_ERROR',
            message: err.message,
          },
        });
      }
    }
  );
}

