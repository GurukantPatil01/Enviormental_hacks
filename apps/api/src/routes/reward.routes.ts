import type { FastifyInstance } from 'fastify';
import { claimRewardSchema, getRewardsQuerySchema } from '@ecopulse/validation';
import { authenticate } from '../middleware/auth.middleware.js';
import { rewardService } from '../services/reward.service.js';

export async function rewardRoutes(app: FastifyInstance) {
  // 1. List available rewards & coupons
  app.get('/rewards', async (request, reply) => {
    try {
      const query = getRewardsQuerySchema.parse(request.query);
      const rewards = await rewardService.getRewards(query.category);
      return reply.send({ data: rewards });
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({
        error: {
          code: err.code || 'REWARDS_LIST_ERROR',
          message: err.message,
        },
      });
    }
  });

  // 2. Get user's claimed coupons & tickets (Auth required)
  app.get('/rewards/my-claims', { preHandler: [authenticate] }, async (request, reply) => {
    try {
      const claims = await rewardService.getMyClaims(request.user!.id);
      return reply.send({ data: claims });
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({
        error: {
          code: err.code || 'CLAIMS_FETCH_ERROR',
          message: err.message,
        },
      });
    }
  });

  // 3. Get single reward details
  app.get<{ Params: { id: string } }>('/rewards/:id', async (request, reply) => {
    try {
      const reward = await rewardService.getRewardById(request.params.id);
      return reply.send({ data: reward });
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({
        error: {
          code: err.code || 'REWARD_FETCH_ERROR',
          message: err.message,
        },
      });
    }
  });

  // 4. Claim reward / discount coupon (Auth required)
  app.post<{ Params: { id: string } }>(
    '/rewards/:id/claim',
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        const body = claimRewardSchema.parse(request.body);
        const result = await rewardService.claimReward(
          request.user!.id,
          request.params.id,
          body.clientEventId
        );
        return reply.send({ data: result });
      } catch (err: any) {
        return reply.status(err.statusCode || 500).send({
          error: {
            code: err.code || 'REWARD_CLAIM_ERROR',
            message: err.message,
            details: err.details,
          },
        });
      }
    }
  );
}
