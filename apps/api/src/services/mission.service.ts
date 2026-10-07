import type {
  Mission,
  MissionCompleteResponse,
  MissionParticipant,
} from '@ecopulse/types';
import { eventBus } from '../events/event-bus.js';
import { missionRepository } from '../repositories/mission.repository.js';
import { pointsService } from './points.service.js';
import { streakService } from './streak.service.js';

export class MissionService {
  async listMissions(communityId?: string, userId?: string): Promise<Mission[]> {
    return missionRepository.list(communityId, userId);
  }

  async getMission(missionId: string, userId?: string): Promise<Mission> {
    const mission = await missionRepository.findById(missionId, userId);
    if (!mission) {
      const err = new Error('Mission not found');
      (err as any).statusCode = 404;
      (err as any).code = 'MISSION_NOT_FOUND';
      throw err;
    }
    return mission;
  }

  async startMission(missionId: string, userId: string): Promise<MissionParticipant> {
    const mission = await this.getMission(missionId, userId);
    if (mission.status !== 'ACTIVE') {
      const err = new Error('Mission is not active');
      (err as any).statusCode = 400;
      (err as any).code = 'MISSION_NOT_ACTIVE';
      throw err;
    }

    const participant = await missionRepository.startMission(missionId, userId);
    await missionRepository.recordEvent({
      missionId,
      participantId: participant.id,
      userId,
      eventType: 'STARTED',
    });

    await eventBus.publish(
      'MISSION_STARTED',
      missionId,
      { missionId, userId, participantId: participant.id },
      userId
    );

    return participant;
  }

  async completeMission(
    missionId: string,
    userId: string,
    clientEventId: string,
    notes?: string,
    evidenceUrl?: string
  ): Promise<MissionCompleteResponse> {
    const mission = await this.getMission(missionId, userId);

    // 1. Idempotency Check by clientEventId
    const existingEvent = await missionRepository.findEventByClientEventId(clientEventId);
    const existingParticipation = await missionRepository.getParticipation(missionId, userId);

    if (existingEvent || (existingParticipation && existingParticipation.status === 'COMPLETED')) {
      // Idempotent replay: Fetch existing ledger entry and current balance without re-awarding!
      const currentBalance = await pointsService.getBalance(userId);
      const currentStreak = await streakService.getStreak(userId);
      const ledgerHistory = await pointsService.getLedgerHistory(userId, 10);
      const matchedLedger =
        ledgerHistory.find((entry) => entry.referenceId === missionId) ||
        ledgerHistory[0];

      return {
        status: 'ALREADY_COMPLETED',
        missionId,
        pointsAwarded: 0,
        pointBalance: currentBalance.totalPoints,
        currentStreak: currentStreak.currentStreak,
        streakExtended: false,
        ledgerEntry: matchedLedger,
      };
    }

    // 2. Ensure participation exists
    let participant = existingParticipation;
    if (!participant) {
      participant = await missionRepository.startMission(missionId, userId);
    }

    // 3. Mark completed
    participant = await missionRepository.completeMission(missionId, userId);

    // 4. Record mission event with idempotency clientEventId
    await missionRepository.recordEvent({
      missionId,
      participantId: participant.id,
      userId,
      eventType: 'COMPLETED',
      clientEventId,
      metadata: { notes, evidenceUrl },
    });

    // 5. Award Points into immutable ledger
    const { entry: ledgerEntry } = await pointsService.awardPoints({
      userId,
      communityId: mission.communityId,
      source: 'MISSION_COMPLETED',
      referenceId: mission.id,
      amount: mission.pointsReward,
      type: 'CREDIT',
      clientEventId,
      metadata: {
        missionTitle: mission.title,
        notes,
        evidenceUrl,
      },
    });

    // 6. Update streak
    const { streak, extended } = await streakService.recordActivity(userId);

    // 7. Publish domain event
    await eventBus.publish(
      'MISSION_COMPLETED',
      mission.id,
      {
        missionId: mission.id,
        missionTitle: mission.title,
        pointsAwarded: mission.pointsReward,
        userId,
        clientEventId,
      },
      userId
    );

    // 8. Fetch recalculated point balance
    const updatedBalance = await pointsService.getBalance(userId);

    return {
      status: 'COMPLETED',
      missionId: mission.id,
      pointsAwarded: mission.pointsReward,
      pointBalance: updatedBalance.totalPoints,
      currentStreak: streak.currentStreak,
      streakExtended: extended,
      ledgerEntry,
    };
  }
}

export const missionService = new MissionService();
