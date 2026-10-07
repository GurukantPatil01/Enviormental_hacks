import type { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth.middleware.js';
import { communityService } from '../services/community.service.js';

export async function communityRoutes(app: FastifyInstance) {
  // Public or auth: list communities
  app.get('/communities', async (_request, reply) => {
    const list = await communityService.listCommunities();
    return reply.send({ data: list });
  });

  // Get community details
  app.get<{ Params: { id: string } }>('/communities/:id', async (request, reply) => {
    try {
      const community = await communityService.getCommunity(request.params.id);
      return reply.send({ data: community });
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({
        error: {
          code: err.code || 'COMMUNITY_ERROR',
          message: err.message,
        },
      });
    }
  });

  // Join community
  app.post<{ Params: { id: string } }>(
    '/communities/:id/join',
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        const member = await communityService.joinCommunity(request.params.id, request.user!.id);
        const community = await communityService.getCommunity(request.params.id);
        return reply.status(200).send({
          data: {
            success: true,
            member,
            community,
          },
        });
      } catch (err: any) {
        return reply.status(err.statusCode || 500).send({
          error: {
            code: err.code || 'JOIN_FAILED',
            message: err.message,
          },
        });
      }
    }
  );

  // Get community members
  app.get<{ Params: { id: string } }>('/communities/:id/members', async (request, reply) => {
    try {
      const members = await communityService.getMembers(request.params.id);
      return reply.send({ data: members });
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({
        error: {
          code: err.code || 'MEMBERS_ERROR',
          message: err.message,
        },
      });
    }
  });

  // Get community state (multidimensional health)
  app.get<{ Params: { id: string } }>('/communities/:id/state', async (request, reply) => {
    try {
      const { communityStateService } = await import('../services/community-state.service.js');
      const state = await communityStateService.calculateCommunityState(request.params.id);
      return reply.send({ data: state });
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({
        error: {
          code: err.code || 'COMMUNITY_STATE_ERROR',
          message: err.message,
        },
      });
    }
  });

  // Get community timeline
  app.get<{ Params: { id: string }; Querystring: { limit?: string } }>(
    '/communities/:id/timeline',
    async (request, reply) => {
      try {
        const { timelineService } = await import('../services/timeline.service.js');
        const limit = request.query.limit ? parseInt(request.query.limit, 10) : 30;
        const timeline = await timelineService.getCommunityTimeline(request.params.id, limit);
        return reply.send({ data: timeline });
      } catch (err: any) {
        return reply.status(err.statusCode || 500).send({
          error: {
            code: err.code || 'TIMELINE_ERROR',
            message: err.message,
          },
        });
      }
    }
  );

  // Get community milestones
  app.get<{ Params: { id: string } }>('/communities/:id/milestones', async (request, reply) => {
    try {
      const { milestoneService } = await import('../services/milestone.service.js');
      const milestones = await milestoneService.getMilestones(request.params.id);
      return reply.send({ data: milestones });
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({
        error: {
          code: err.code || 'MILESTONES_ERROR',
          message: err.message,
        },
      });
    }
  });
}

