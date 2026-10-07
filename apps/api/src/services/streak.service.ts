import type { Streak } from '@ecopulse/types';
import { eventBus } from '../events/event-bus.js';
import { streakRepository } from '../repositories/streak.repository.js';

export class StreakService {
  async getStreak(userId: string): Promise<Streak> {
    const existing = await streakRepository.findByUserId(userId);
    if (existing) return existing;

    return {
      id: '',
      userId,
      currentStreak: 0,
      longestStreak: 0,
      lastActivityDate: null,
      updatedAt: new Date().toISOString(),
    };
  }

  async recordActivity(userId: string, targetDateStr?: string): Promise<{ streak: Streak; extended: boolean }> {
    const existing = await streakRepository.findByUserId(userId);
    const today = targetDateStr || new Date().toISOString().split('T')[0];

    if (!existing || !existing.lastActivityDate) {
      const newStreak = await streakRepository.upsert(userId, 1, 1, today);
      await eventBus.publish('STREAK_STARTED', newStreak.id, { userId, streak: 1 }, userId);
      return { streak: newStreak, extended: true };
    }

    if (existing.lastActivityDate === today) {
      // Activity already recorded for today; streak remains active
      return { streak: existing, extended: false };
    }

    // Check difference in days
    const lastDate = new Date(existing.lastActivityDate);
    const currDate = new Date(today);
    const diffTime = currDate.getTime() - lastDate.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    let nextCurrent = 1;
    if (diffDays === 1) {
      // Consecutive day!
      nextCurrent = existing.currentStreak + 1;
    } else {
      // Streak broken, reset to 1
      nextCurrent = 1;
    }

    const nextLongest = Math.max(existing.longestStreak, nextCurrent);
    const updated = await streakRepository.upsert(userId, nextCurrent, nextLongest, today);

    await eventBus.publish(
      'STREAK_EXTENDED',
      updated.id,
      {
        userId,
        currentStreak: updated.currentStreak,
        longestStreak: updated.longestStreak,
      },
      userId
    );

    return { streak: updated, extended: true };
  }
}

export const streakService = new StreakService();
