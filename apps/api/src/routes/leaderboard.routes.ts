import type { FastifyInstance, FastifyRequest } from 'fastify';
import { getLeaderboardQuerySchema } from '@ecopulse/validation';
import { leaderboardService } from '../services/leaderboard.service.js';

async function optionalAuthenticate(request: FastifyRequest) {
  try {
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = request.server.jwt.verify<{ id: string; email: string; role: any }>(token);
      request.user = decoded;
    }
  } catch {
    // Optional auth - gracefully continue as unauthenticated guest
  }
}

export async function leaderboardRoutes(app: FastifyInstance) {
  // Get Monthly (or all-time) Leaderboard
  app.get('/leaderboard', async (request, reply) => {
    try {
      await optionalAuthenticate(request);
      const query = getLeaderboardQuerySchema.parse(request.query);

      const result = await leaderboardService.getLeaderboard({
        period: query.period,
        communityId: query.communityId,
        limit: query.limit,
        currentUserId: request.user?.id,
      });

      return reply.send({ data: result });
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({
        error: {
          code: err.code || 'LEADERBOARD_ERROR',
          message: err.message,
        },
      });
    }
  });
}
