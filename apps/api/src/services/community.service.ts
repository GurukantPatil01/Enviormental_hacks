import type { Community, CommunityMember } from '@ecopulse/types';
import { eventBus } from '../events/event-bus.js';
import { communityRepository } from '../repositories/community.repository.js';

export class CommunityService {
  async listCommunities(): Promise<Community[]> {
    return communityRepository.listAll();
  }

  async getCommunity(id: string): Promise<Community> {
    const community = await communityRepository.findById(id);
    if (!community) {
      const err = new Error('Community not found');
      (err as any).statusCode = 404;
      (err as any).code = 'COMMUNITY_NOT_FOUND';
      throw err;
    }
    return community;
  }

  async joinCommunity(communityId: string, userId: string): Promise<CommunityMember> {
    const community = await this.getCommunity(communityId);
    const member = await communityRepository.join(community.id, userId);

    await eventBus.publish(
      'COMMUNITY_JOINED',
      community.id,
      { communityId: community.id, communityName: community.name, userId },
      userId
    );

    return member;
  }

  async getMembers(communityId: string): Promise<CommunityMember[]> {
    await this.getCommunity(communityId);
    return communityRepository.getMembers(communityId);
  }
}

export const communityService = new CommunityService();
