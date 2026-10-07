import { completeMissionSchema } from '@ecopulse/validation';
import type { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth.middleware.js';
import { missionService } from '../services/mission.service.js';

export async function missionRoutes(app: FastifyInstance) {
  // List missions
  app.get<{ Querystring: { communityId?: string } }>(
    '/missions',
    async (request, reply) => {
      // If authorization token is present, we extract user for participation status
      let userId: string | undefined;
      const authHeader = request.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          const decoded = app.jwt.verify<{ id: string }>(authHeader.substring(7));
          userId = decoded.id;
        } catch {
          // ignore
        }
      }

      const list = await missionService.listMissions(request.query.communityId, userId);
      return reply.send({ data: list });
    }
  );

  // Get mission detail
  app.get<{ Params: { id: string } }>('/missions/:id', async (request, reply) => {
    let userId: string | undefined;
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const decoded = app.jwt.verify<{ id: string }>(authHeader.substring(7));
        userId = decoded.id;
      } catch {
        // ignore
      }
    }

    try {
      const mission = await missionService.getMission(request.params.id, userId);
      return reply.send({ data: mission });
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({
        error: {
          code: err.code || 'MISSION_ERROR',
          message: err.message,
        },
      });
    }
  });

  // Start mission
  app.post<{ Params: { id: string } }>(
    '/missions/:id/start',
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        const participant = await missionService.startMission(request.params.id, request.user!.id);
        return reply.status(200).send({ data: participant });
      } catch (err: any) {
        return reply.status(err.statusCode || 500).send({
          error: {
            code: err.code || 'MISSION_START_FAILED',
            message: err.message,
          },
        });
      }
    }
  );

  // Complete mission with idempotency key
  app.post<{ Params: { id: string }; Body: { client_event_id?: string; notes?: string; evidenceUrl?: string } }>(
    '/missions/:id/complete',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const payload = request.body || {};
      const validation = completeMissionSchema.safeParse({
        missionId: request.params.id,
        client_event_id: payload.client_event_id,
        notes: payload.notes,
        evidenceUrl: payload.evidenceUrl,
      });

      if (!validation.success) {
        return reply.status(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid mission completion payload. Note: client_event_id is required.',
            details: validation.error.flatten(),
          },
        });
      }

      try {
        const result = await missionService.completeMission(
          request.params.id,
          request.user!.id,
          validation.data.client_event_id,
          validation.data.notes,
          validation.data.evidenceUrl
        );

        return reply.status(200).send({ data: result });
      } catch (err: any) {
        return reply.status(err.statusCode || 500).send({
          error: {
            code: err.code || 'MISSION_COMPLETION_FAILED',
            message: err.message,
          },
        });
      }
    }
  );
}
