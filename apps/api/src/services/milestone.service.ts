import type { CommunityMilestone, MilestoneStatus } from '@ecopulse/types';
import { eventBus } from '../events/event-bus.js';
import { milestoneRepository } from '../repositories/milestone.repository.js';
import { communityStateService } from './community-state.service.js';

export class MilestoneService {
  async getMilestones(communityId: string): Promise<CommunityMilestone[]> {
    const list = await milestoneRepository.listByCommunity(communityId);
    return list;
  }

  async checkAndAdvanceMilestones(communityId: string): Promise<CommunityMilestone[]> {
    const state = await communityStateService.calculateCommunityState(communityId);
    const milestones = await milestoneRepository.listByCommunity(communityId);

    const updatedMilestones: CommunityMilestone[] = [];

    for (const m of milestones) {
      if (m.status === 'LOCKED' && state.overallProgress > 0) {
        // Unlock milestone into IN_PROGRESS if below target
        if (state.overallProgress < m.targetProgress) {
          const updated = await milestoneRepository.updateStatus(m.id, 'IN_PROGRESS');
          if (updated) updatedMilestones.push(updated);
        } else {
          // Immediately ACHIEVED
          const updated = await milestoneRepository.updateStatus(m.id, 'ACHIEVED', new Date());
          if (updated) {
            updatedMilestones.push(updated);
            await eventBus.publish(
              'MILESTONE_REACHED',
              m.id,
              {
                milestoneId: m.id,
                communityId,
                title: m.title,
                targetProgress: m.targetProgress,
                rewardTitle: m.rewardTitle,
              }
            );
          }
        }
      } else if (m.status === 'IN_PROGRESS' && state.overallProgress >= m.targetProgress) {
        const updated = await milestoneRepository.updateStatus(m.id, 'ACHIEVED', new Date());
        if (updated) {
          updatedMilestones.push(updated);
          await eventBus.publish(
            'MILESTONE_REACHED',
            m.id,
            {
              milestoneId: m.id,
              communityId,
              title: m.title,
              targetProgress: m.targetProgress,
              rewardTitle: m.rewardTitle,
            }
          );
        }
      }
    }

    return updatedMilestones;
  }
}

export const milestoneService = new MilestoneService();
