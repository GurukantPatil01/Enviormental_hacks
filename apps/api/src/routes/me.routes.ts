import type { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth.middleware.js';
import { meService } from '../services/me.service.js';
import { pointsService } from '../services/points.service.js';
import { streakService } from '../services/streak.service.js';

export async function meRoutes(app: FastifyInstance) {
  // Home dashboard aggregation
  app.get('/me', { preHandler: [authenticate] }, async (request, reply) => {
    try {
      const data = await meService.getDashboard(request.user!.id);
      return reply.send({ data });
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({
        error: {
          code: err.code || 'ME_ERROR',
          message: err.message,
        },
      });
    }
  });

  // User activity feed
  app.get('/me/activity', { preHandler: [authenticate] }, async (request, reply) => {
    try {
      const activity = await meService.getActivity(request.user!.id);
      return reply.send({ data: activity });
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({
        error: {
          code: err.code || 'ACTIVITY_ERROR',
          message: err.message,
        },
      });
    }
  });

  // User point balance and ledger
  app.get('/me/points', { preHandler: [authenticate] }, async (request, reply) => {
    try {
      const balance = await pointsService.getBalance(request.user!.id);
      const ledger = await pointsService.getLedgerHistory(request.user!.id);
      return reply.send({ data: { balance, ledger } });
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({
        error: {
          code: err.code || 'POINTS_ERROR',
          message: err.message,
        },
      });
    }
  });

  // User streak
  app.get('/me/streak', { preHandler: [authenticate] }, async (request, reply) => {
    try {
      const streak = await streakService.getStreak(request.user!.id);
      return reply.send({ data: streak });
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({
        error: {
          code: err.code || 'STREAK_ERROR',
          message: err.message,
        },
      });
    }
  });
}
