import { colors, radius, spacing, typography } from '@ecopulse/design-system';
import type { LeaderboardEntry, LeaderboardPeriod, LeaderboardTier } from '@ecopulse/types';
import { useQuery } from '@tanstack/react-query';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../lib/api';

function getTierColor(tier: LeaderboardTier): { bg: string; text: string; border: string } {
  switch (tier) {
    case 'Eco Champion':
      return { bg: '#ECFDF5', text: '#059669', border: '#10B981' };
    case 'Green Guardian':
      return { bg: '#FEF3C7', text: '#D97706', border: '#F59E0B' };
    case 'Civic Steward':
      return { bg: '#ECFEFF', text: '#0891B2', border: '#06B6D4' };
    case 'Eco Pioneer':
      return { bg: '#FFF7ED', text: '#EA580C', border: '#F97316' };
    default:
      return { bg: '#F3F4F6', text: '#4B5563', border: '#9CA3AF' };
  }
}

export default function LeaderboardScreen() {
  const [period, setPeriod] = useState<LeaderboardPeriod>('monthly');

  const {
    data,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ['leaderboard', period],
    queryFn: () => api.leaderboard.get({ period }),
  });

  const entries = data?.entries || [];
  const top1 = entries[0];
  const top2 = entries[1];
  const top3 = entries[2];
  const remainingEntries = entries.slice(3);
  const currentUserEntry = data?.currentUserEntry;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <View>
            <Text style={styles.headerTitle}>Civic Leaderboard</Text>
            <Text style={styles.headerSubtitle}>
              {period === 'monthly' ? `${data?.month || 'Current Month'} Cycle` : 'All-Time Lifetime'}
            </Text>
          </View>

          {data && period === 'monthly' && (
            <View style={styles.countdownBadge}>
              <Text style={styles.countdownText}>⏳ {data.daysRemaining}d to reset</Text>
            </View>
          )}
        </View>

        {/* Period Switcher Pills */}
        <View style={styles.periodSwitcher}>
          <TouchableOpacity
            style={[styles.periodTab, period === 'monthly' && styles.periodTabActive]}
            onPress={() => setPeriod('monthly')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.periodTabText,
                period === 'monthly' && styles.periodTabTextActive,
              ]}
            >
              📅 Monthly ({data?.month?.split(' ')[0] || 'Current'})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.periodTab, period === 'all_time' && styles.periodTabActive]}
            onPress={() => setPeriod('all_time')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.periodTabText,
                period === 'all_time' && styles.periodTabTextActive,
              ]}
            >
              ⭐ All-Time
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content Area */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary[600]} />
          <Text style={styles.loadingText}>Calculating monthly points & rankings...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              colors={[colors.primary[600]]}
            />
          }
        >
          {/* Top 3 Podium */}
          {entries.length > 0 && (
            <View style={styles.podiumContainer}>
              {/* #2 Rank */}
              <View style={[styles.podiumColumn, styles.podiumCol2]}>
                {top2 ? (
                  <>
                    <View style={styles.podiumAvatarWrap}>
                      <Image source={{ uri: top2.avatarUrl }} style={styles.podiumAvatar} />
                      <View style={[styles.rankMedalBadge, styles.medal2]}>
                        <Text style={styles.rankMedalText}>2</Text>
                      </View>
                    </View>
                    <Text style={styles.podiumName} numberOfLines={1}>
                      {top2.name}
                    </Text>
                    <Text style={styles.podiumPoints}>
                      {(period === 'monthly' ? top2.monthlyPoints : top2.totalPoints).toLocaleString()}{' '}
                      pts
                    </Text>
                    <View style={[styles.tierChip, { backgroundColor: getTierColor(top2.tier).bg }]}>
                      <Text style={[styles.tierChipText, { color: getTierColor(top2.tier).text }]}>
                        {top2.tier}
                      </Text>
                    </View>
                  </>
                ) : (
                  <View style={styles.podiumEmpty} />
                )}
                <View style={[styles.podiumBase, styles.podiumBase2]}>
                  <Text style={styles.podiumBaseRank}>🥈 2nd</Text>
                </View>
              </View>

              {/* #1 Rank (Center, Highest) */}
              <View style={[styles.podiumColumn, styles.podiumCol1]}>
                {top1 ? (
                  <>
                    <Text style={styles.crownIcon}>👑</Text>
                    <View style={[styles.podiumAvatarWrap, styles.podiumAvatarWrap1]}>
                      <Image
                        source={{ uri: top1.avatarUrl }}
                        style={[styles.podiumAvatar, styles.podiumAvatar1]}
                      />
                      <View style={[styles.rankMedalBadge, styles.medal1]}>
                        <Text style={styles.rankMedalText}>1</Text>
                      </View>
                    </View>
                    <Text style={[styles.podiumName, styles.podiumName1]} numberOfLines={1}>
                      {top1.name}
                    </Text>
                    <Text style={[styles.podiumPoints, styles.podiumPoints1]}>
                      {(period === 'monthly' ? top1.monthlyPoints : top1.totalPoints).toLocaleString()}{' '}
                      pts
                    </Text>
                    <View style={[styles.tierChip, { backgroundColor: getTierColor(top1.tier).bg }]}>
                      <Text style={[styles.tierChipText, { color: getTierColor(top1.tier).text }]}>
                        {top1.tier}
                      </Text>
                    </View>
                  </>
                ) : (
                  <View style={styles.podiumEmpty} />
                )}
                <View style={[styles.podiumBase, styles.podiumBase1]}>
                  <Text style={[styles.podiumBaseRank, styles.podiumBaseRank1]}>🥇 1st</Text>
                </View>
              </View>

              {/* #3 Rank */}
              <View style={[styles.podiumColumn, styles.podiumCol3]}>
                {top3 ? (
                  <>
                    <View style={styles.podiumAvatarWrap}>
                      <Image source={{ uri: top3.avatarUrl }} style={styles.podiumAvatar} />
                      <View style={[styles.rankMedalBadge, styles.medal3]}>
                        <Text style={styles.rankMedalText}>3</Text>
                      </View>
                    </View>
                    <Text style={styles.podiumName} numberOfLines={1}>
                      {top3.name}
                    </Text>
                    <Text style={styles.podiumPoints}>
                      {(period === 'monthly' ? top3.monthlyPoints : top3.totalPoints).toLocaleString()}{' '}
                      pts
                    </Text>
                    <View style={[styles.tierChip, { backgroundColor: getTierColor(top3.tier).bg }]}>
                      <Text style={[styles.tierChipText, { color: getTierColor(top3.tier).text }]}>
                        {top3.tier}
                      </Text>
                    </View>
                  </>
                ) : (
                  <View style={styles.podiumEmpty} />
                )}
                <View style={[styles.podiumBase, styles.podiumBase3]}>
                  <Text style={styles.podiumBaseRank}>🥉 3rd</Text>
                </View>
              </View>
            </View>
          )}

          {/* Leaderboard List Header */}
          <View style={styles.listSectionHeader}>
            <Text style={styles.listSectionTitle}>All Resident Standings</Text>
            <Text style={styles.listSectionSubtitle}>
              {period === 'monthly' ? 'Refreshes on 1st of every month' : 'Lifetime points balance'}
            </Text>
          </View>

          {/* Remaining Ranked Rows */}
          {remainingEntries.length > 0 ? (
            <View style={styles.rankingsList}>
              {remainingEntries.map((item) => {
                const tierColor = getTierColor(item.tier);
                const isCurrent = item.isCurrentUser;
                return (
                  <View
                    key={item.userId}
                    style={[styles.rankingCard, isCurrent && styles.rankingCardCurrent]}
                  >
                    <View style={styles.rankCol}>
                      <Text style={[styles.rankNumber, isCurrent && styles.rankNumberCurrent]}>
                        #{item.rank}
                      </Text>
                    </View>

                    <Image source={{ uri: item.avatarUrl }} style={styles.rowAvatar} />

                    <View style={styles.rowDetails}>
                      <View style={styles.rowNameWrap}>
                        <Text style={styles.rowName} numberOfLines={1}>
                          {item.name}
                        </Text>
                        {isCurrent && (
                          <View style={styles.youBadge}>
                            <Text style={styles.youBadgeText}>YOU</Text>
                          </View>
                        )}
                      </View>

                      <View style={styles.rowMetaRow}>
                        <View style={[styles.tierPill, { backgroundColor: tierColor.bg }]}>
                          <Text style={[styles.tierPillText, { color: tierColor.text }]}>
                            {item.tier}
                          </Text>
                        </View>

                        {item.streak > 0 && (
                          <Text style={styles.streakText}>🔥 {item.streak}d</Text>
                        )}
                      </View>
                    </View>

                    <View style={styles.pointsCol}>
                      <Text style={styles.rowPointsValue}>
                        {(period === 'monthly' ? item.monthlyPoints : item.totalPoints).toLocaleString()}
                      </Text>
                      <Text style={styles.rowPointsLabel}>pts</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : entries.length <= 3 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>Top 3 leaders listed above.</Text>
            </View>
          ) : null}

          {/* Bottom spacing so pinned user card doesn't obscure list */}
          <View style={{ height: 90 }} />
        </ScrollView>
      )}

      {/* Floating / Sticky "Your Rank" Bottom Bar */}
      {currentUserEntry && (
        <View style={styles.stickyUserCard}>
          <View style={styles.stickyUserLeft}>
            <View style={styles.stickyRankBadge}>
              <Text style={styles.stickyRankText}>#{currentUserEntry.rank}</Text>
            </View>
            <View>
              <Text style={styles.stickyUserName}>Your Current Standing</Text>
              <Text style={styles.stickyUserSub}>
                {currentUserEntry.tier} • {currentUserEntry.verifiedActionsCount} actions this cycle
              </Text>
            </View>
          </View>

          <View style={styles.stickyUserRight}>
            <Text style={styles.stickyPoints}>
              {(period === 'monthly'
                ? currentUserEntry.monthlyPoints
                : currentUserEntry.totalPoints
              ).toLocaleString()}
            </Text>
            <Text style={styles.stickyPointsLabel}>
              {period === 'monthly' ? 'monthly pts' : 'total pts'}
            </Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    backgroundColor: colors.surface.white,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 2,
  },
  countdownBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  countdownText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
  },
  periodSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 3,
  },
  periodTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  periodTabActive: {
    backgroundColor: colors.surface.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  periodTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  periodTabTextActive: {
    color: '#059669',
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  podiumContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginBottom: spacing.xl,
    paddingHorizontal: 4,
    gap: 10,
  },
  podiumColumn: {
    flex: 1,
    alignItems: 'center',
  },
  podiumCol1: {
    zIndex: 2,
  },
  podiumCol2: {},
  podiumCol3: {},
  crownIcon: {
    fontSize: 20,
    marginBottom: 2,
  },
  podiumAvatarWrap: {
    position: 'relative',
    marginBottom: 6,
  },
  podiumAvatarWrap1: {},
  podiumAvatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#E2E8F0',
    borderWidth: 2,
    borderColor: '#CBD5E1',
  },
  podiumAvatar1: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    borderColor: '#F59E0B',
  },
  rankMedalBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  medal1: {
    backgroundColor: '#F59E0B',
  },
  medal2: {
    backgroundColor: '#94A3B8',
  },
  medal3: {
    backgroundColor: '#D97706',
  },
  rankMedalText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  podiumName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'center',
    maxWidth: 90,
    marginBottom: 2,
  },
  podiumName1: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  podiumPoints: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
    marginBottom: 4,
  },
  podiumPoints1: {
    fontSize: 13,
    fontWeight: '800',
    color: '#059669',
  },
  tierChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginBottom: 8,
  },
  tierChipText: {
    fontSize: 9,
    fontWeight: '700',
  },
  podiumEmpty: {
    height: 100,
  },
  podiumBase: {
    width: '100%',
    backgroundColor: '#E2E8F0',
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  podiumBase1: {
    height: 90,
    backgroundColor: '#D1FAE5',
    borderTopWidth: 2,
    borderColor: '#10B981',
  },
  podiumBase2: {
    height: 70,
    backgroundColor: '#F1F5F9',
  },
  podiumBase3: {
    height: 55,
    backgroundColor: '#F1F5F9',
  },
  podiumBaseRank: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  podiumBaseRank1: {
    fontSize: 13,
    fontWeight: '800',
    color: '#065F46',
  },
  listSectionHeader: {
    marginBottom: spacing.md,
  },
  listSectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  listSectionSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  rankingsList: {
    gap: 8,
  },
  rankingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface.white,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  rankingCardCurrent: {
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
  },
  rankCol: {
    width: 32,
    alignItems: 'flex-start',
  },
  rankNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
  },
  rankNumberCurrent: {
    color: '#059669',
    fontWeight: '800',
  },
  rowAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E2E8F0',
    marginRight: 12,
  },
  rowDetails: {
    flex: 1,
  },
  rowNameWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  rowName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
    maxWidth: 160,
  },
  youBadge: {
    backgroundColor: '#059669',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  youBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  rowMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tierPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  tierPillText: {
    fontSize: 9,
    fontWeight: '700',
  },
  streakText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#D97706',
  },
  pointsCol: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  rowPointsValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#059669',
  },
  rowPointsLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
  },
  emptyCard: {
    backgroundColor: colors.surface.white,
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyText: {
    fontSize: 13,
    color: '#64748B',
  },
  stickyUserCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#0F172A',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderTopWidth: 2,
    borderTopColor: '#10B981',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 8,
  },
  stickyUserLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stickyRankBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
  },
  stickyRankText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  stickyUserName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  stickyUserSub: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
  },
  stickyUserRight: {
    alignItems: 'flex-end',
  },
  stickyPoints: {
    fontSize: 17,
    fontWeight: '800',
    color: '#34D399',
  },
  stickyPointsLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: '#94A3B8',
    textTransform: 'uppercase',
  },
});
