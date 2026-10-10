import type {
  LeaderboardEntry,
  LeaderboardPeriod,
  LeaderboardResponse,
  LeaderboardTier,
} from '@ecopulse/types';
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { communities, communityMembers, pointLedger, streaks, users } from '../db/schema.js';

export function calculateTier(monthlyPoints: number): LeaderboardTier {
  if (monthlyPoints >= 500) return 'Eco Champion';
  if (monthlyPoints >= 250) return 'Green Guardian';
  if (monthlyPoints >= 100) return 'Civic Steward';
  if (monthlyPoints >= 20) return 'Eco Pioneer';
  return 'Active Resident';
}

export interface GetLeaderboardOptions {
  period?: LeaderboardPeriod;
  communityId?: string;
  limit?: number;
  currentUserId?: string;
  now?: Date; // allow injecting for deterministic testing
}

export class LeaderboardService {
  async getLeaderboard(options: GetLeaderboardOptions = {}): Promise<LeaderboardResponse> {
    const period = options.period || 'monthly';
    const limit = Math.min(Math.max(options.limit || 50, 1), 100);
    const now = options.now || new Date();

    const currentYear = now.getUTCFullYear();
    const currentMonth = now.getUTCMonth(); // 0-indexed (0 = Jan, 9 = Oct)
    const startOfMonth = new Date(Date.UTC(currentYear, currentMonth, 1, 0, 0, 0, 0));
    const nextResetDate = new Date(Date.UTC(currentYear, currentMonth + 1, 1, 0, 0, 0, 0));

    const msPerDay = 1000 * 60 * 60 * 24;
    const daysRemaining = Math.max(0, Math.ceil((nextResetDate.getTime() - now.getTime()) / msPerDay));

    const monthNames = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];
    const monthLabel = `${monthNames[currentMonth]} ${currentYear}`;

    // Filter conditions
    const whereConditions = [eq(users.role, 'RESIDENT')];
    if (options.communityId) {
      whereConditions.push(eq(communityMembers.communityId, options.communityId));
    }

    // Build aggregation query
    // monthlyPoints: all CREDIT points created within this calendar month window
    const monthlyPointsSql = sql<number>`COALESCE(SUM(CASE WHEN ${pointLedger.createdAt} >= ${startOfMonth} AND ${pointLedger.createdAt} < ${nextResetDate} AND ${pointLedger.type} = 'CREDIT' THEN ${pointLedger.amount} ELSE 0 END), 0)::integer`;

    // totalPoints: lifetime net balance
    const totalPointsSql = sql<number>`COALESCE(SUM(CASE WHEN ${pointLedger.type} = 'CREDIT' THEN ${pointLedger.amount} ELSE -${pointLedger.amount} END), 0)::integer`;

    // verifiedActionsCount: distinct point-earning events in this calendar month
    const verifiedActionsSql = sql<number>`COALESCE(COUNT(DISTINCT CASE WHEN ${pointLedger.createdAt} >= ${startOfMonth} AND ${pointLedger.createdAt} < ${nextResetDate} THEN ${pointLedger.id} END), 0)::integer`;

    const rows = await db
      .select({
        userId: users.id,
        name: users.fullName,
        monthlyPoints: monthlyPointsSql,
        totalPoints: totalPointsSql,
        verifiedActionsCount: verifiedActionsSql,
        streak: sql<number>`COALESCE(MAX(${streaks.currentStreak}), 0)::integer`,
        communityName: sql<string | null>`MAX(${communities.name})`,
        communityId: sql<string | null>`MAX(${communities.id}::text)`,
      })
      .from(users)
      .leftJoin(pointLedger, eq(users.id, pointLedger.userId))
      .leftJoin(streaks, eq(users.id, streaks.userId))
      .leftJoin(communityMembers, eq(users.id, communityMembers.userId))
      .leftJoin(communities, eq(communityMembers.communityId, communities.id))
      .where(and(...whereConditions))
      .groupBy(users.id, users.fullName);

    // Sort according to requested period
    const sortedRows = [...rows].sort((a, b) => {
      if (period === 'monthly') {
        if (b.monthlyPoints !== a.monthlyPoints) {
          return b.monthlyPoints - a.monthlyPoints;
        }
        if (b.totalPoints !== a.totalPoints) {
          return b.totalPoints - a.totalPoints;
        }
        return a.name.localeCompare(b.name);
      } else {
        if (b.totalPoints !== a.totalPoints) {
          return b.totalPoints - a.totalPoints;
        }
        if (b.monthlyPoints !== a.monthlyPoints) {
          return b.monthlyPoints - a.monthlyPoints;
        }
        return a.name.localeCompare(b.name);
      }
    });

    const totalPointsAwardedThisMonth = rows.reduce(
      (sum, row) => sum + (row.monthlyPoints || 0),
      0
    );

    const totalParticipants = rows.filter((r) =>
      period === 'monthly' ? r.monthlyPoints > 0 : r.totalPoints > 0
    ).length || rows.length;

    // Map all ranked entries
    const allRankedEntries: LeaderboardEntry[] = sortedRows.map((row, index) => {
      const isCurrentUser = Boolean(options.currentUserId && row.userId === options.currentUserId);
      return {
        rank: index + 1,
        userId: row.userId,
        name: row.name,
        avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(row.userId || row.name)}`,
        communityName: row.communityName || null,
        communityId: row.communityId || null,
        monthlyPoints: Number(row.monthlyPoints || 0),
        totalPoints: Number(row.totalPoints || 0),
        verifiedActionsCount: Number(row.verifiedActionsCount || 0),
        streak: Number(row.streak || 0),
        tier: calculateTier(Number(row.monthlyPoints || 0)),
        isCurrentUser,
      };
    });

    const limitedEntries = allRankedEntries.slice(0, limit);

    // If current user is provided, find their entry across all ranked entries
    const currentUserEntry = options.currentUserId
      ? allRankedEntries.find((e) => e.userId === options.currentUserId) || null
      : null;

    return {
      period,
      month: monthLabel,
      year: currentYear,
      monthIndex: currentMonth,
      daysRemaining,
      nextResetDate: nextResetDate.toISOString(),
      totalParticipants,
      totalPointsAwardedThisMonth,
      entries: limitedEntries,
      currentUserEntry,
    };
  }
}

export const leaderboardService = new LeaderboardService();
