import crypto from 'crypto';
import type { Reward, RewardClaim } from '@ecopulse/types';
import { eventBus } from '../events/event-bus.js';
import { rewardRepository } from '../repositories/reward.repository.js';

export class RewardService {
  async getRewards(category?: string): Promise<Reward[]> {
    return rewardRepository.listRewards(category);
  }

  async getRewardById(id: string): Promise<Reward> {
    const reward = await rewardRepository.findRewardById(id);
    if (!reward) {
      throw Object.assign(new Error('Reward not found'), { statusCode: 404, code: 'REWARD_NOT_FOUND' });
    }
    return reward;
  }

  async claimReward(
    userId: string,
    rewardId: string,
    clientEventId: string
  ): Promise<{ claim: RewardClaim; newBalance: number }> {
    const reward = await this.getRewardById(rewardId);

    // Generate readable coupon code based on category or partner
    let prefix = 'GOV-ECO';
    if (reward.category === 'TRANSIT_PASS') prefix = 'PMPML-BUS';
    else if (reward.category === 'METRO_DISCOUNT') prefix = 'METRO-PN';
    else if (reward.category === 'MUNICIPAL_TICKET' || reward.category === 'PARKS_AND_RECREATION') prefix = 'PMC-PARK';

    const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
    const couponCode = `${prefix}-${randomSuffix}`;

    // Coupon valid for 30 days
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const result = await rewardRepository.claimRewardAtomic(
      userId,
      rewardId,
      clientEventId,
      couponCode,
      expiresAt
    );

    if (!result.isDuplicate) {
      await eventBus.publish(
        'REWARD_CLAIMED',
        result.claim.id,
        {
          rewardId,
          userId,
          couponCode: result.claim.couponCode,
          costPoints: result.claim.costPoints,
        },
        userId
      );
    }

    return {
      claim: result.claim,
      newBalance: result.newBalance,
    };
  }

  async getMyClaims(userId: string): Promise<RewardClaim[]> {
    return rewardRepository.getUserClaims(userId);
  }
}

export const rewardService = new RewardService();
