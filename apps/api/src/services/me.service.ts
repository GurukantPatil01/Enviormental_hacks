import type { ActivityItem, HomeDashboardData } from '@ecopulse/types';
import { communityRepository } from '../repositories/community.repository.js';
import { missionRepository } from '../repositories/mission.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import { pointsService } from './points.service.js';
import { streakService } from './streak.service.js';

export class MeService {
  async getDashboard(userId: string): Promise<HomeDashboardData> {
    const user = await userRepository.findById(userId);
    if (!user) {
      const err = new Error('User not found');
      (err as any).statusCode = 404;
      (err as any).code = 'USER_NOT_FOUND';
      throw err;
    }

    const community = await communityRepository.findUserCommunity(userId);
    const balance = await pointsService.getBalance(userId);
    const streak = await streakService.getStreak(userId);
    const ledger = await pointsService.getLedgerHistory(userId, 10);

    // Find active mission or next available mission
    const missions = await missionRepository.list(community?.id, userId);
    const activeMission =
      missions.find((m) => m.userParticipationStatus === 'STARTED') ||
      missions.find((m) => m.userParticipationStatus === 'NOT_STARTED') ||
      missions[0] ||
      null;

    // Convert ledger and participation into recent activities
    const recentActivity: ActivityItem[] = ledger.slice(0, 5).map((entry) => ({
      id: entry.id,
      userId: entry.userId,
      type: entry.source === 'MISSION_COMPLETED' ? 'MISSION_COMPLETED' : 'POINTS_AWARDED',
      title:
        entry.source === 'MISSION_COMPLETED'
          ? (entry.metadata?.missionTitle as string) || 'Completed Mission'
          : 'EcoPoints Credited',
      description:
        entry.amount > 0 ? `Earned +${entry.amount} EcoPoints` : `${entry.amount} EcoPoints deducted`,
      points: entry.amount,
      createdAt: entry.createdAt,
    }));

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        role: user.role as any,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
      community,
      pointBalance: balance.totalPoints,
      currentStreak: streak.currentStreak,
      activeMission,
      recentActivity,
    };
  }

  async getActivity(userId: string): Promise<ActivityItem[]> {
    const ledger = await pointsService.getLedgerHistory(userId, 20);
    return ledger.map((entry) => ({
      id: entry.id,
      userId: entry.userId,
      type: entry.source === 'MISSION_COMPLETED' ? 'MISSION_COMPLETED' : 'POINTS_AWARDED',
      title:
        entry.source === 'MISSION_COMPLETED'
          ? (entry.metadata?.missionTitle as string) || 'Completed Mission'
          : 'EcoPoints Credited',
      description:
        entry.amount > 0 ? `Earned +${entry.amount} EcoPoints` : `${entry.amount} EcoPoints deducted`,
      points: entry.amount,
      createdAt: entry.createdAt,
    }));
  }
}

export const meService = new MeService();
