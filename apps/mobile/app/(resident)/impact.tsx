import { colors, radius, spacing, typography } from '@ecopulse/design-system';
import { useQuery } from '@tanstack/react-query';
import React from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../lib/api';

export default function ImpactScreen() {
  const {
    data: pointsData,
    isLoading: isPointsLoading,
    refetch: refetchPoints,
    isRefetching,
  } = useQuery({
    queryKey: ['my-points'],
    queryFn: () => api.me.getPoints(),
  });

  const { data: dashboard } = useQuery({
    queryKey: ['home-dashboard'],
    queryFn: () => api.me.get(),
  });

  const balance = pointsData?.balance;
  const ledger = pointsData?.ledger || [];

  const verifiedActions = ledger.filter(
    (e) => e.source === 'MISSION_COMPLETED' || e.source === 'VERIFIED_REPORT'
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetchPoints} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.preTitle}>CITIZEN ECO-IMPACT</Text>
          <Text style={styles.title}>Your Contribution</Text>
          <Text style={styles.subTitle}>Measurable environmental progress verified on-chain & in ledger</Text>
        </View>

        {isPointsLoading ? (
          <ActivityIndicator size="large" color={colors.primary[900]} style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* Impact Metric Hero */}
            <View style={styles.heroCard}>
              <View style={styles.heroRow}>
                <View>
                  <Text style={styles.heroLabel}>Lifetime EcoPoints</Text>
                  <Text style={styles.heroVal}>{balance?.lifetimeEarned ?? 0}</Text>
                </View>
                <View style={styles.treeBadge}>
                  <Text style={styles.treeEmoji}>🌳</Text>
                  <Text style={styles.treeText}>
                    ~{Math.max(1, Math.floor((balance?.lifetimeEarned || 0) / 50))} Trees Planted Equiv.
                  </Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statVal}>{verifiedActions.length}</Text>
                  <Text style={styles.statLabel}>Verified Actions</Text>
                </View>

                <View style={styles.statBox}>
                  <Text style={styles.statVal}>{dashboard?.currentStreak ?? 1}</Text>
                  <Text style={styles.statLabel}>Day Streak</Text>
                </View>

                <View style={styles.statBox}>
                  <Text style={styles.statVal}>Top 5%</Text>
                  <Text style={styles.statLabel}>Ward Rank</Text>
                </View>
              </View>
            </View>

            {/* Community Progress Share */}
            <View style={styles.communityCard}>
              <Text style={styles.cardSectionTitle}>Ward Collective Progress</Text>
              <Text style={styles.communitySub}>
                Your efforts directly power the progress of {dashboard?.community?.name || 'Pune Green Community'}.
              </Text>

              <View style={styles.progressBarBg}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: `${dashboard?.community?.currentProgress || 68}%` },
                  ]}
                />
              </View>
              <View style={styles.progressInfoRow}>
                <Text style={styles.progressPct}>
                  {dashboard?.community?.currentProgress || 68}% Completed
                </Text>
                <Text style={styles.nextMilestoneText}>Target: 75% Community EcoLab</Text>
              </View>
            </View>

            {/* Verified Action History */}
            <Text style={styles.sectionHeader}>Verified Impact Ledger</Text>
            <View style={styles.ledgerList}>
              {ledger.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyText}>No verified transactions yet.</Text>
                </View>
              ) : (
                ledger.map((entry) => (
                  <View key={entry.id} style={styles.ledgerCard}>
                    <View style={styles.ledgerLeft}>
                      <View style={styles.sourceCircle}>
                        <Text style={styles.sourceIcon}>{getSourceIcon(entry.source)}</Text>
                      </View>
                      <View>
                        <Text style={styles.ledgerTitle}>{formatSource(entry.source)}</Text>
                        <Text style={styles.ledgerDate}>
                          {new Date(entry.createdAt).toLocaleDateString()}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.pointsEarned}>+{entry.amount} pts</Text>
                  </View>
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function getSourceIcon(source: string) {
  switch (source) {
    case 'MISSION_COMPLETED':
      return '🎯';
    case 'VERIFIED_REPORT':
      return '🚨';
    case 'COMMUNITY_MILESTONE':
      return '🏆';
    default:
      return '⭐';
  }
}

function formatSource(source: string) {
  switch (source) {
    case 'MISSION_COMPLETED':
      return 'Mission Completed';
    case 'VERIFIED_REPORT':
      return 'Verified Hazard Report';
    case 'COMMUNITY_MILESTONE':
      return 'Community Milestone';
    default:
      return 'EcoReward Grant';
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface.background,
  },
  scroll: {
    padding: spacing.base,
    paddingBottom: 40,
  },
  header: {
    marginBottom: spacing.base,
  },
  preTitle: {
    color: colors.primary[700],
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    ...typography.h2,
    color: colors.neutral[900],
    marginTop: 2,
  },
  subTitle: {
    fontSize: 13,
    color: colors.neutral[500],
    marginTop: 2,
  },
  heroCard: {
    backgroundColor: colors.primary[900],
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.base,
  },
  heroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroLabel: {
    color: colors.primary[200],
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  heroVal: {
    fontSize: 36,
    fontWeight: '900',
    color: colors.surface.white,
    letterSpacing: -1,
  },
  treeBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.lg,
    alignItems: 'center',
  },
  treeEmoji: {
    fontSize: 22,
  },
  treeText: {
    color: colors.primary[100],
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginVertical: spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statBox: {
    alignItems: 'center',
    flex: 1,
  },
  statVal: {
    color: colors.surface.white,
    fontSize: 18,
    fontWeight: '800',
  },
  statLabel: {
    color: colors.primary[200],
    fontSize: 11,
    marginTop: 2,
  },
  communityCard: {
    backgroundColor: colors.surface.card,
    borderRadius: radius.lg,
    padding: spacing.base,
    borderWidth: 1,
    borderColor: colors.surface.border,
    marginBottom: spacing.base,
  },
  cardSectionTitle: {
    ...typography.bodyBold,
    color: colors.neutral[900],
  },
  communitySub: {
    fontSize: 12,
    color: colors.neutral[500],
    marginTop: 2,
    marginBottom: spacing.md,
  },
  progressBarBg: {
    height: 10,
    backgroundColor: colors.neutral[100],
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary[600],
    borderRadius: 5,
  },
  progressInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  progressPct: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary[900],
  },
  nextMilestoneText: {
    fontSize: 11,
    color: colors.neutral[500],
  },
  sectionHeader: {
    ...typography.h3,
    color: colors.neutral[900],
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  ledgerList: {
    gap: 8,
  },
  ledgerCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface.card,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.surface.border,
  },
  ledgerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sourceCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceIcon: {
    fontSize: 18,
  },
  ledgerTitle: {
    ...typography.bodyBold,
    color: colors.neutral[900],
    fontSize: 14,
  },
  ledgerDate: {
    fontSize: 11,
    color: colors.neutral[400],
    marginTop: 2,
  },
  pointsEarned: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.primary[700],
  },
  emptyCard: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    color: colors.neutral[500],
    fontSize: 13,
  },
});
