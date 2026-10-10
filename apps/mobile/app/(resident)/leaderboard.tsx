import { Ionicons } from '@expo/vector-icons';
import type { LeaderboardPeriod, LeaderboardTier } from '@ecopulse/types';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
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
import { theme } from '../../constants/theme';
import { api } from '../../lib/api';

function getTierBadge(tier: LeaderboardTier): { bg: string; text: string; icon: string } {
  switch (tier) {
    case 'Eco Champion':
      return { bg: '#ECFDF5', text: '#059669', icon: 'trophy' };
    case 'Green Guardian':
      return { bg: '#FEF3C7', text: '#D97706', icon: 'shield-checkmark' };
    case 'Civic Steward':
      return { bg: '#EFF6FF', text: '#1D4ED8', icon: 'ribbon' };
    case 'Eco Pioneer':
      return { bg: '#FFF7ED', text: '#EA580C', icon: 'flame' };
    default:
      return { bg: '#F1F5F9', text: '#475569', icon: 'medal' };
  }
}

export default function LeaderboardScreen() {
  const router = useRouter();
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
      {/* Top Header with Back Navigation */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={22} color={theme.colors.forest} />
          </TouchableOpacity>

          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>Civic Leaderboard</Text>
            <Text style={styles.headerSubtitle}>
              {period === 'monthly' ? `${data?.month || 'Current Month'} Cycle` : 'Lifetime Points'}
            </Text>
          </View>

          {data && period === 'monthly' ? (
            <View style={styles.countdownBadge}>
              <Text style={styles.countdownText}>⏳ {data.daysRemaining}d left</Text>
            </View>
          ) : (
            <View style={{ width: 40 }} />
          )}
        </View>

        {/* Period Switcher Tabs */}
        <View style={styles.periodSwitcher}>
          <TouchableOpacity
            style={[styles.periodTab, period === 'monthly' && styles.periodTabActive]}
            onPress={() => setPeriod('monthly')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="calendar-outline"
              size={15}
              color={period === 'monthly' ? '#FFFFFF' : theme.colors.textSecondary}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.periodTabText,
                period === 'monthly' && styles.periodTabTextActive,
              ]}
            >
              Monthly Cycle
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.periodTab, period === 'all_time' && styles.periodTabActive]}
            onPress={() => setPeriod('all_time')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="star-outline"
              size={15}
              color={period === 'all_time' ? '#FFFFFF' : theme.colors.textSecondary}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.periodTabText,
                period === 'all_time' && styles.periodTabTextActive,
              ]}
            >
              All-Time
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content Area */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
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
              colors={[theme.colors.primary]}
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
                    <View style={[styles.tierChip, { backgroundColor: getTierBadge(top2.tier).bg }]}>
                      <Text style={[styles.tierChipText, { color: getTierBadge(top2.tier).text }]}>
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
                    <View style={[styles.tierChip, { backgroundColor: getTierBadge(top1.tier).bg }]}>
                      <Text style={[styles.tierChipText, { color: getTierBadge(top1.tier).text }]}>
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
                    <View style={[styles.tierChip, { backgroundColor: getTierBadge(top3.tier).bg }]}>
                      <Text style={[styles.tierChipText, { color: getTierBadge(top3.tier).text }]}>
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

          {/* Current User Highlight Banner if not in top 3 */}
          {currentUserEntry && currentUserEntry.rank > 3 && (
            <View style={styles.myRankCard}>
              <View style={styles.myRankLeft}>
                <View style={styles.myRankBadge}>
                  <Text style={styles.myRankNum}>#{currentUserEntry.rank}</Text>
                </View>
                <View style={styles.myRankTextWrap}>
                  <Text style={styles.myRankTitle}>Your Current Standing</Text>
                  <Text style={styles.myRankSub}>{currentUserEntry.tier}</Text>
                </View>
              </View>
              <View style={styles.myRankPointsCol}>
                <Text style={styles.myRankPoints}>
                  {(period === 'monthly'
                    ? currentUserEntry.monthlyPoints
                    : currentUserEntry.totalPoints
                  ).toLocaleString()}{' '}
                  pts
                </Text>
                <Text style={styles.myRankReports}>{currentUserEntry.verifiedActionsCount} verified reports</Text>
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
                const badge = getTierBadge(item.tier);
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

                    <View style={styles.rowInfoCol}>
                      <View style={styles.rowNameRow}>
                        <Text style={[styles.rowName, isCurrent && styles.rowNameCurrent]} numberOfLines={1}>
                          {item.name}
                        </Text>
                        {isCurrent && (
                          <View style={styles.youBadge}>
                            <Text style={styles.youBadgeText}>YOU</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.rowSubRow}>
                        <View style={[styles.rowTierTag, { backgroundColor: badge.bg }]}>
                          <Text style={[styles.rowTierText, { color: badge.text }]}>
                            {item.tier}
                          </Text>
                        </View>
                        <Text style={styles.rowReportsCount}>
                          • {item.verifiedActionsCount} reports
                        </Text>
                      </View>
                    </View>

                    <View style={styles.rowPointsCol}>
                      <Text style={styles.rowPointsVal}>
                        {(period === 'monthly' ? item.monthlyPoints : item.totalPoints).toLocaleString()}
                      </Text>
                      <Text style={styles.rowPointsLabel}>pts</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Ionicons name="trophy-outline" size={40} color={theme.colors.primary} />
              <Text style={styles.emptyTitle}>Leaderboard Warming Up</Text>
              <Text style={styles.emptySub}>
                Submit waste reports and complete verified cleanups to earn EcoPoints and climb the civic ladder!
              </Text>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background, // #F4F8F5
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    alignItems: 'center',
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.forest,
  },
  headerSubtitle: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: '600',
    marginTop: 1,
  },
  countdownBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  countdownText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D97706',
  },
  periodSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 3,
  },
  periodTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 9,
  },
  periodTabActive: {
    backgroundColor: theme.colors.forest,
  },
  periodTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  periodTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // Main scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },

  // Podium
  podiumContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginBottom: 20,
    paddingTop: 10,
  },
  podiumColumn: {
    flex: 1,
    alignItems: 'center',
  },
  podiumCol1: {
    zIndex: 3,
  },
  podiumCol2: {
    zIndex: 2,
  },
  podiumCol3: {
    zIndex: 1,
  },
  crownIcon: {
    fontSize: 22,
    marginBottom: 2,
  },
  podiumAvatarWrap: {
    position: 'relative',
    marginBottom: 6,
  },
  podiumAvatarWrap1: {
    marginBottom: 8,
  },
  podiumAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  podiumAvatar1: {
    width: 66,
    height: 66,
    borderRadius: 33,
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
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.forest,
    textAlign: 'center',
    maxWidth: 95,
  },
  podiumName1: {
    fontSize: 14,
    fontWeight: '800',
  },
  podiumPoints: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.primary,
    marginTop: 2,
  },
  podiumPoints1: {
    fontSize: 13,
    fontWeight: '800',
  },
  tierChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
    marginBottom: 8,
  },
  tierChipText: {
    fontSize: 9,
    fontWeight: '700',
  },
  podiumBase: {
    width: '92%',
    alignItems: 'center',
    justifyContent: 'center',
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    paddingVertical: 8,
  },
  podiumBase1: {
    height: 72,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  podiumBase2: {
    height: 52,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  podiumBase3: {
    height: 40,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FFEDD5',
  },
  podiumBaseRank: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.forest,
  },
  podiumBaseRank1: {
    fontSize: 13,
  },
  podiumEmpty: {
    height: 40,
  },

  // My Rank Highlight
  myRankCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0FDF4',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    marginBottom: 16,
    ...theme.shadows.card,
  },
  myRankLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  myRankBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  myRankNum: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  myRankTextWrap: {},
  myRankTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.forest,
  },
  myRankSub: {
    fontSize: 12,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  myRankPointsCol: {
    alignItems: 'flex-end',
  },
  myRankPoints: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.forest,
  },
  myRankReports: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },

  // List
  listSectionHeader: {
    marginBottom: 10,
  },
  listSectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.forest,
  },
  listSectionSubtitle: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  rankingsList: {
    gap: 10,
  },
  rankingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.card,
  },
  rankingCardCurrent: {
    borderColor: theme.colors.primary,
    backgroundColor: '#F0FDF4',
  },
  rankCol: {
    width: 32,
    alignItems: 'center',
  },
  rankNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  rankNumberCurrent: {
    color: theme.colors.primary,
    fontWeight: '800',
  },
  rowAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  rowInfoCol: {
    flex: 1,
  },
  rowNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowName: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.forest,
  },
  rowNameCurrent: {
    fontWeight: '800',
  },
  youBadge: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: 6,
  },
  youBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  rowSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  rowTierTag: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  rowTierText: {
    fontSize: 10,
    fontWeight: '700',
  },
  rowReportsCount: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginLeft: 6,
  },
  rowPointsCol: {
    alignItems: 'flex-end',
  },
  rowPointsVal: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.forest,
  },
  rowPointsLabel: {
    fontSize: 10,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },

  // Empty
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginTop: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.forest,
    marginTop: 10,
  },
  emptySub: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
});
