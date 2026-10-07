import type { Streak } from '@ecopulse/types';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { streaks } from '../db/schema.js';

export class StreakRepository {
  async findByUserId(userId: string): Promise<Streak | null> {
    const [row] = await db.select().from(streaks).where(eq(streaks.userId, userId));
    if (!row) return null;
    return {
      id: row.id,
      userId: row.userId,
      currentStreak: row.currentStreak,
      longestStreak: row.longestStreak,
      lastActivityDate: row.lastActivityDate,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async upsert(userId: string, currentStreak: number, longestStreak: number, lastActivityDate: string): Promise<Streak> {
    const [row] = await db
      .insert(streaks)
      .values({
        userId,
        currentStreak,
        longestStreak,
        lastActivityDate,
      })
      .onConflictDoUpdate({
        target: streaks.userId,
        set: {
          currentStreak,
          longestStreak,
          lastActivityDate,
          updatedAt: new Date(),
        },
      })
      .returning();

    return {
      id: row.id,
      userId: row.userId,
      currentStreak: row.currentStreak,
      longestStreak: row.longestStreak,
      lastActivityDate: row.lastActivityDate,
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}

export const streakRepository = new StreakRepository();
