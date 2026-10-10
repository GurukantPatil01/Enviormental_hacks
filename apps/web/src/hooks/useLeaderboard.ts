import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import type { LeaderboardResponse, LeaderboardPeriod } from '@ecopulse/types';

export interface UseLeaderboardOptions {
  period?: LeaderboardPeriod;
  communityId?: string;
  limit?: number;
}

export function useLeaderboard(options: UseLeaderboardOptions = {}) {
  const { period = 'monthly', communityId, limit = 50 } = options;

  return useQuery({
    queryKey: ['leaderboard', period, communityId, limit],
    queryFn: () => {
      const params = new URLSearchParams();
      if (period) params.set('period', period);
      if (communityId) params.set('communityId', communityId);
      if (limit) params.set('limit', limit.toString());

      return apiFetch<LeaderboardResponse>(`/leaderboard?${params.toString()}`);
    },
    refetchInterval: 30000,
  });
}
