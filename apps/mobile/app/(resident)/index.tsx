import { colors, radius, spacing, typography } from '@ecopulse/design-system';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/auth.store';

export default function HomeScreen() {
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['home-dashboard'],
    queryFn: () => api.me.get(),
  });

  const handleLogout = () => {
    logout();
    router.replace('/(auth)/welcome');
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary[900]} />
        <Text style={styles.loadingText}>Fetching EcoPulse telemetry...</Text>
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <Text style={styles.errorTitle}>Connection Error</Text>
        <Text style={styles.errorSub}>
          {(error as Error)?.message || 'Failed to load community dashboard.'}
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.retryButton, { marginTop: 12, backgroundColor: colors.neutral[300] }]} onPress={handleLogout}>
          <Text style={[styles.retryButtonText, { color: colors.neutral[900] }]}>Log Out</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const {
    user,
    community,
    pointBalance,
    currentStreak,
    activeMission,
    recentActivity,
  } = data || {};

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
        {/* Header Bar */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.userName}>{user?.fullName || 'Resident'}</Text>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBadge}>
            <Text style={styles.logoutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        {/* Vital Metrics Grid (EcoPoints & Streak) */}
        <View style={styles.metricsGrid}>
          {/* EcoPoints Balance Card */}
          <TouchableOpacity
            style={styles.metricCard}
            onPress={() => router.push('/(resident)/points')}
            activeOpacity={0.8}
          >
            <View style={styles.metricLabelRow}>
              <Text style={styles.metricLabel}>EcoPoints</Text>
              <Text style={styles.metricIcon}>⭐</Text>
            </View>
            <Text style={styles.metricValue}>{pointBalance?.toLocaleString() ?? 0}</Text>
            <Text style={styles.metricSub}>Auditable balance</Text>
          </TouchableOpacity>

          {/* Streak Card */}
          <View style={styles.metricCard}>
            <View style={styles.metricLabelRow}>
              <Text style={styles.metricLabel}>Daily Streak</Text>
              <Text style={styles.metricIcon}>🔥</Text>
            </View>
            <Text style={styles.metricValue}>{currentStreak ?? 0} days</Text>
            <Text style={styles.metricSub}>Active habit</Text>
          </View>
        </View>

        {/* Quick Report Action Banner */}
        <TouchableOpacity
          style={styles.reportActionBanner}
          onPress={() => router.push('/(resident)/report' as any)}
          activeOpacity={0.85}
        >
          <View style={styles.reportActionLeft}>
            <Text style={styles.reportActionIcon}>🚨</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.reportActionTitle}>Report an Issue / Hotspot</Text>
              <Text style={styles.reportActionSub}>
                Upload geo-tagged evidence to earn +20 EcoPoints upon maintainer verification
              </Text>
            </View>
          </View>
          <Text style={styles.reportActionChevron}>→</Text>
        </TouchableOpacity>

        {/* Community Progress Card */}
        <View style={styles.sectionCard}>

          <View style={styles.sectionHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionSuper}>COMMUNITY</Text>
              <Text style={styles.communityName}>
                {community?.name || 'No Community Joined'}
              </Text>
            </View>
            {community ? (
              <TouchableOpacity
                onPress={() => router.push('/(resident)/community')}
                style={styles.viewBadge}
              >
                <Text style={styles.viewBadgeText}>Details →</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={() => router.push('/(resident)/community')}
                style={styles.joinBadge}
              >
                <Text style={styles.joinBadgeText}>Join Community</Text>
              </TouchableOpacity>
            )}
          </View>

          {community && (
            <View style={styles.progressContainer}>
              <View style={styles.progressLabelRow}>
                <Text style={styles.progressLabel}>Community Progress</Text>
                <Text style={styles.progressPercent}>{community.currentProgress}%</Text>
              </View>
              <View style={styles.progressBarTrack}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: `${Math.min(community.currentProgress, 100)}%` },
                  ]}
                />
              </View>
            </View>
          )}
        </View>


        {/* Recent Activity Feed */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionSuper}>RECENT ACTIVITY</Text>
            <TouchableOpacity onPress={() => router.push('/(resident)/activity')}>
              <Text style={styles.viewAllLink}>History →</Text>
            </TouchableOpacity>
          </View>

          {recentActivity && recentActivity.length > 0 ? (
            recentActivity.map((item) => (
              <View key={item.id} style={styles.activityItem}>
                <View style={styles.activityIconBox}>
                  <Text style={styles.activityItemIcon}>
                    {item.points && item.points > 0 ? '🌿' : '📋'}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.activityTitle}>{item.title}</Text>
                  <Text style={styles.activityDesc}>{item.description}</Text>
                </View>
                {item.points && (
                  <Text style={styles.activityPoints}>
                    {item.points > 0 ? `+${item.points}` : item.points}
                  </Text>
                )}
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No activity recorded yet.</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: spacing.xl,
  },
  loadingText: {
    ...typography.body,
    color: colors.neutral[600],
    marginTop: spacing.md,
  },
  errorTitle: {
    ...typography.h2,
    color: colors.status.error,
    marginBottom: spacing.xs,
  },
  errorSub: {
    ...typography.body,
    color: colors.neutral[600],
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  retryButton: {
    backgroundColor: colors.primary[900],
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  retryButtonText: {
    ...typography.bodyBold,
    color: colors.surface.white,
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  greeting: {
    ...typography.caption,
    color: colors.neutral[500],
  },
  userName: {
    ...typography.h1,
    fontSize: 24,
    color: colors.neutral[900],
  },
  logoutBadge: {
    backgroundColor: colors.neutral[200],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  logoutText: {
    ...typography.caption,
    color: colors.neutral[700],
    fontWeight: '600',
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  metricCard: {
    flex: 1,
    backgroundColor: colors.surface.white,
    borderColor: colors.neutral[200],
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.base,
  },
  metricLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  metricLabel: {
    ...typography.caption,
    color: colors.neutral[500],
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  metricIcon: {
    fontSize: 16,
  },
  metricValue: {
    ...typography.metric,
    color: colors.primary[900],
    marginBottom: 2,
  },
  metricSub: {
    ...typography.caption,
    color: colors.neutral[400],
  },
  sectionCard: {
    backgroundColor: colors.surface.white,
    borderColor: colors.neutral[200],
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.base,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionSuper: {
    ...typography.caption,
    color: colors.neutral[400],
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  communityName: {
    ...typography.h3,
    color: colors.neutral[900],
    marginTop: 2,
  },
  viewBadge: {
    backgroundColor: colors.primary[50],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  viewBadgeText: {
    ...typography.caption,
    color: colors.primary[800],
    fontWeight: '700',
  },
  joinBadge: {
    backgroundColor: colors.primary[900],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  joinBadgeText: {
    ...typography.caption,
    color: colors.surface.white,
    fontWeight: '700',
  },
  progressContainer: {
    marginTop: spacing.xs,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  progressLabel: {
    ...typography.caption,
    color: colors.neutral[600],
  },
  progressPercent: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.primary[800],
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: colors.neutral[100],
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary[500],
    borderRadius: radius.full,
  },
  viewAllLink: {
    ...typography.caption,
    color: colors.primary[700],
    fontWeight: '600',
  },
  activeMissionBox: {
    backgroundColor: colors.neutral[50],
    borderColor: colors.neutral[200],
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  missionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  missionTitle: {
    ...typography.bodyBold,
    color: colors.neutral[900],
    flex: 1,
  },
  rewardPill: {
    backgroundColor: colors.accent.pointsBg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    marginLeft: spacing.sm,
  },
  rewardPillText: {
    ...typography.caption,
    color: colors.accent.points,
    fontWeight: '700',
  },
  missionDesc: {
    ...typography.caption,
    color: colors.neutral[600],
    lineHeight: 18,
    marginBottom: spacing.sm,
  },
  missionStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopColor: colors.neutral[200],
    borderTopWidth: 1,
    paddingTop: spacing.xs,
  },
  missionStatus: {
    ...typography.caption,
    color: colors.neutral[500],
  },
  tapAction: {
    ...typography.caption,
    color: colors.primary[700],
    fontWeight: '600',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomColor: colors.neutral[100],
    borderBottomWidth: 1,
    gap: spacing.md,
  },
  activityIconBox: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityItemIcon: {
    fontSize: 16,
  },
  activityTitle: {
    ...typography.bodyBold,
    fontSize: 14,
    color: colors.neutral[900],
  },
  activityDesc: {
    ...typography.caption,
    color: colors.neutral[500],
  },
  activityPoints: {
    ...typography.bodyBold,
    color: colors.primary[600],
  },
  emptyText: {
    ...typography.caption,
    color: colors.neutral[500],
    fontStyle: 'italic',
  },
  reportActionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface.card,
    borderRadius: radius.lg,
    padding: spacing.base,
    marginBottom: spacing.base,
    borderWidth: 1.5,
    borderColor: colors.primary[600],
    shadowColor: colors.primary[900],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  reportActionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 8,
  },
  reportActionIcon: {
    fontSize: 26,
  },
  reportActionTitle: {
    ...typography.bodyBold,
    color: colors.neutral[900],
    fontSize: 14,
  },
  reportActionSub: {
    fontSize: 11,
    color: colors.neutral[600],
    marginTop: 2,
    lineHeight: 15,
  },
  reportActionChevron: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary[700],
  },
});

