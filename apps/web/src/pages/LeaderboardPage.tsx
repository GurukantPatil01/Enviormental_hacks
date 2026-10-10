import React, { useState } from 'react';
import {
  Trophy,
  Medal,
  Flame,
  Calendar,
  Sparkles,
  Users,
  Search,
  ArrowUpRight,
  ShieldCheck,
  Clock,
  RotateCw,
} from 'lucide-react';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { MetricCard } from '../components/common/MetricCard';
import type { LeaderboardPeriod, LeaderboardTier } from '@ecopulse/types';

function getTierBadgeClass(tier: LeaderboardTier): string {
  switch (tier) {
    case 'Eco Champion':
      return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-emerald-500/10 shadow-sm';
    case 'Green Guardian':
      return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    case 'Civic Steward':
      return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';
    case 'Eco Pioneer':
      return 'bg-orange-500/20 text-orange-300 border-orange-500/40';
    default:
      return 'bg-slate-700/40 text-slate-300 border-slate-600/40';
  }
}

export const LeaderboardPage: React.FC = () => {
  const [period, setPeriod] = useState<LeaderboardPeriod>('monthly');
  const [searchQuery, setSearchQuery] = useState('');

  const { data, isLoading, error, refetch, isFetching } = useLeaderboard({ period });

  const entries = data?.entries || [];
  const filteredEntries = entries.filter((e) =>
    e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (e.communityName && e.communityName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const top3 = entries.slice(0, 3);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-slate-900/80 border border-slate-800 rounded-xl relative overflow-hidden backdrop-blur-sm">
        <div className="absolute -top-12 -right-12 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono tracking-wider uppercase font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              Automated Monthly Refresh Cycle
            </span>
            {data && (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono tracking-wider font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Resets in {data.daysRemaining} days
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Trophy className="w-6 h-6 text-emerald-400" />
            Civic Impact Leaderboard
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            Points earned through verified civic cleanups, geo-tagged reports, and maintainer reviews. 
            Monthly standings reset automatically on the 1st of every calendar month.
          </p>
        </div>

        {/* Period Switcher & Actions */}
        <div className="flex items-center gap-3 self-start md:self-auto">
          <div className="flex items-center bg-slate-950/80 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setPeriod('monthly')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                period === 'monthly'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {data?.month || 'This Month'}
            </button>
            <button
              onClick={() => setPeriod('all_time')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                period === 'all_time'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All-Time Lifetime
            </button>
          </div>

          <button
            onClick={() => refetch()}
            disabled={isFetching}
            title="Refresh Leaderboard"
            className="p-2 rounded-lg bg-slate-950/80 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700 transition-colors disabled:opacity-50"
          >
            <RotateCw className={`w-4 h-4 ${isFetching ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Top Level Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Active Cycle"
          value={data?.month || 'Current Month'}
          subtext={`Next refresh: ${data?.nextResetDate ? new Date(data.nextResetDate).toLocaleDateString() : '—'}`}
          icon={<Calendar className="w-4 h-4 text-emerald-400" />}
        />
        <MetricCard
          label="Monthly Points Credited"
          value={data?.totalPointsAwardedThisMonth?.toLocaleString() || '0'}
          subtext="Earned across all verified reports"
          icon={<Sparkles className="w-4 h-4 text-amber-400" />}
        />
        <MetricCard
          label="Contributing Citizens"
          value={data?.totalParticipants || 0}
          subtext="Active community participants"
          icon={<Users className="w-4 h-4 text-cyan-400" />}
        />
        <MetricCard
          label="Cycle Status"
          value={data ? `${data.daysRemaining} Days Left` : 'Active'}
          subtext="Real-time ledger aggregation"
          icon={<ShieldCheck className="w-4 h-4 text-emerald-400" />}
        />
      </div>

      {/* Podium for Top 3 Contributors */}
      {top3.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          {/* #2 Rank Card */}
          {top3[1] && (
            <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 flex flex-col items-center text-center relative transition-all order-2 md:order-1">
              <div className="w-7 h-7 rounded-full bg-slate-400/20 text-slate-300 border border-slate-400/40 font-mono text-xs font-bold flex items-center justify-center mb-2">
                #2
              </div>
              <img
                src={top3[1].avatarUrl}
                alt={top3[1].name}
                className="w-16 h-16 rounded-full border-2 border-slate-400/50 bg-slate-800 mb-3 shadow-md"
              />
              <h3 className="font-semibold text-white text-base truncate max-w-full">{top3[1].name}</h3>
              <p className="text-xs text-slate-400 truncate max-w-full mb-2">{top3[1].communityName || 'Pune Ward'}</p>
              <div className={`px-2 py-0.5 rounded text-[10px] font-medium border mb-3 ${getTierBadgeClass(top3[1].tier)}`}>
                {top3[1].tier}
              </div>
              <div className="w-full bg-slate-950/60 rounded-lg p-2.5 border border-slate-800 flex justify-around text-center mt-auto">
                <div>
                  <div className="text-[10px] text-slate-400 font-mono uppercase">This Month</div>
                  <div className="text-sm font-bold text-slate-200">{(top3[1].monthlyPoints).toLocaleString()} pts</div>
                </div>
                <div className="border-r border-slate-800" />
                <div>
                  <div className="text-[10px] text-slate-400 font-mono uppercase">Streak</div>
                  <div className="text-sm font-bold text-amber-400 flex items-center justify-center gap-0.5">
                    <Flame className="w-3.5 h-3.5" />
                    {top3[1].streak}d
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* #1 Rank Card (Center Highlighted) */}
          {top3[0] && (
            <div className="p-6 rounded-xl bg-gradient-to-b from-emerald-500/10 via-slate-900/80 to-slate-900 border-2 border-emerald-500/40 hover:border-emerald-500/60 flex flex-col items-center text-center relative shadow-lg shadow-emerald-500/5 transition-all order-1 md:order-2 md:-translate-y-2">
              <div className="absolute top-3 right-3">
                <span className="flex h-3 w-3 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
              </div>
              <div className="w-8 h-8 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/50 font-mono text-sm font-bold flex items-center justify-center mb-2 shadow-sm">
                👑 #1
              </div>
              <img
                src={top3[0].avatarUrl}
                alt={top3[0].name}
                className="w-20 h-20 rounded-full border-2 border-amber-400 bg-slate-800 mb-3 shadow-lg shadow-amber-500/10"
              />
              <h3 className="font-bold text-white text-lg truncate max-w-full">{top3[0].name}</h3>
              <p className="text-xs text-emerald-400/90 font-medium truncate max-w-full mb-2">
                {top3[0].communityName || 'Pune Ward'}
              </p>
              <div className={`px-2.5 py-0.5 rounded text-xs font-semibold border mb-4 ${getTierBadgeClass(top3[0].tier)}`}>
                {top3[0].tier}
              </div>
              <div className="w-full bg-slate-950/80 rounded-lg p-3 border border-emerald-500/20 flex justify-around text-center mt-auto">
                <div>
                  <div className="text-[10px] text-slate-400 font-mono uppercase">This Month</div>
                  <div className="text-base font-extrabold text-emerald-400">{(top3[0].monthlyPoints).toLocaleString()} pts</div>
                </div>
                <div className="border-r border-slate-800" />
                <div>
                  <div className="text-[10px] text-slate-400 font-mono uppercase">Streak</div>
                  <div className="text-base font-extrabold text-amber-400 flex items-center justify-center gap-0.5">
                    <Flame className="w-4 h-4" />
                    {top3[0].streak}d
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* #3 Rank Card */}
          {top3[2] && (
            <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 flex flex-col items-center text-center relative transition-all order-3 md:order-3">
              <div className="w-7 h-7 rounded-full bg-amber-700/20 text-amber-500 border border-amber-700/40 font-mono text-xs font-bold flex items-center justify-center mb-2">
                #3
              </div>
              <img
                src={top3[2].avatarUrl}
                alt={top3[2].name}
                className="w-16 h-16 rounded-full border-2 border-amber-700/50 bg-slate-800 mb-3 shadow-md"
              />
              <h3 className="font-semibold text-white text-base truncate max-w-full">{top3[2].name}</h3>
              <p className="text-xs text-slate-400 truncate max-w-full mb-2">{top3[2].communityName || 'Pune Ward'}</p>
              <div className={`px-2 py-0.5 rounded text-[10px] font-medium border mb-3 ${getTierBadgeClass(top3[2].tier)}`}>
                {top3[2].tier}
              </div>
              <div className="w-full bg-slate-950/60 rounded-lg p-2.5 border border-slate-800 flex justify-around text-center mt-auto">
                <div>
                  <div className="text-[10px] text-slate-400 font-mono uppercase">This Month</div>
                  <div className="text-sm font-bold text-slate-200">{(top3[2].monthlyPoints).toLocaleString()} pts</div>
                </div>
                <div className="border-r border-slate-800" />
                <div>
                  <div className="text-[10px] text-slate-400 font-mono uppercase">Streak</div>
                  <div className="text-sm font-bold text-amber-400 flex items-center justify-center gap-0.5">
                    <Flame className="w-3.5 h-3.5" />
                    {top3[2].streak}d
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Leaderboard Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden backdrop-blur-sm">
        {/* Table Search & Filters */}
        <div className="p-4 border-b border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/40">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Medal className="w-4 h-4 text-emerald-400" />
              Full Resident Standings
            </h2>
            <span className="text-xs text-slate-400">({filteredEntries.length} ranked)</span>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by resident or ward..."
              className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
            />
          </div>
        </div>

        {/* Table Body */}
        {isLoading ? (
          <div className="p-12 text-center text-slate-400 font-mono text-xs flex flex-col items-center gap-2">
            <RotateCw className="w-5 h-5 animate-spin text-emerald-400" />
            Calculating real-time monthly ledger balances...
          </div>
        ) : error ? (
          <div className="p-12 text-center text-rose-400 text-xs">
            Failed to load leaderboard data: {(error as Error).message}
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs font-mono">
            No resident ranking records found for this cycle filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4 w-16 text-center">Rank</th>
                  <th className="py-3 px-4">Resident</th>
                  <th className="py-3 px-4">Community / Ward</th>
                  <th className="py-3 px-4 text-center">Tier</th>
                  <th className="py-3 px-4 text-right">
                    {period === 'monthly' ? 'Monthly Points' : 'Lifetime Points'}
                  </th>
                  <th className="py-3 px-4 text-right">Lifetime Total</th>
                  <th className="py-3 px-4 text-center">Streak</th>
                  <th className="py-3 px-4 text-center">Verified Reports</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredEntries.map((resident) => {
                  const isTopRank = resident.rank <= 3;
                  return (
                    <tr
                      key={resident.userId}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        resident.rank === 1
                          ? 'bg-emerald-500/5'
                          : resident.rank === 2
                          ? 'bg-slate-800/20'
                          : resident.rank === 3
                          ? 'bg-amber-900/10'
                          : ''
                      }`}
                    >
                      {/* Rank */}
                      <td className="py-3.5 px-4 text-center font-mono font-bold">
                        {resident.rank === 1 ? (
                          <span className="text-amber-300">🥇 1</span>
                        ) : resident.rank === 2 ? (
                          <span className="text-slate-300">🥈 2</span>
                        ) : resident.rank === 3 ? (
                          <span className="text-amber-500">🥉 3</span>
                        ) : (
                          <span className="text-slate-400 font-normal">#{resident.rank}</span>
                        )}
                      </td>

                      {/* Resident Info */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={resident.avatarUrl}
                            alt={resident.name}
                            className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 shrink-0"
                          />
                          <div>
                            <div className="font-medium text-white flex items-center gap-1.5">
                              {resident.name}
                              {isTopRank && (
                                <span className="text-[10px] text-amber-400 font-mono">★</span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              ID: {resident.userId.slice(0, 8)}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Community */}
                      <td className="py-3.5 px-4 text-slate-300">
                        {resident.communityName || (
                          <span className="text-slate-500 italic">Pune Civic Ward</span>
                        )}
                      </td>

                      {/* Tier Badge */}
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${getTierBadgeClass(
                            resident.tier
                          )}`}
                        >
                          {resident.tier}
                        </span>
                      </td>

                      {/* Primary Ranked Points */}
                      <td className="py-3.5 px-4 text-right font-mono font-bold">
                        <span className="text-emerald-400 text-sm">
                          {(period === 'monthly'
                            ? resident.monthlyPoints
                            : resident.totalPoints
                          ).toLocaleString()}
                        </span>
                        <span className="text-[10px] text-slate-400 ml-1">pts</span>
                      </td>

                      {/* Lifetime Total Points */}
                      <td className="py-3.5 px-4 text-right font-mono text-slate-300">
                        {resident.totalPoints.toLocaleString()} pts
                      </td>

                      {/* Daily Streak */}
                      <td className="py-3.5 px-4 text-center">
                        {resident.streak > 0 ? (
                          <span className="inline-flex items-center gap-1 text-amber-400 font-mono font-medium text-xs">
                            <Flame className="w-3.5 h-3.5" />
                            {resident.streak}d
                          </span>
                        ) : (
                          <span className="text-slate-500 font-mono text-[11px]">—</span>
                        )}
                      </td>

                      {/* Verified Reports Count */}
                      <td className="py-3.5 px-4 text-center font-mono text-slate-300">
                        {resident.verifiedActionsCount > 0 ? (
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-emerald-300 border border-slate-700 text-[11px]">
                            {resident.verifiedActionsCount}
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[11px]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
