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

export default function MaintainerOperationsScreen() {
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const {
    data: ops,
    isLoading: isOpsLoading,
    refetch: refetchOps,
    isRefetching: isOpsRefetching,
  } = useQuery({
    queryKey: ['maintainer-operations'],
    queryFn: () => api.maintainer.getOperations(),
  });

  const {
    data: communities,
    isLoading: isCommLoading,
  } = useQuery({
    queryKey: ['communities'],
    queryFn: () => api.communities.list(),
  });

  const primaryCommunity = communities?.[0];

  const {
    data: communityState,
    refetch: refetchState,
  } = useQuery({
    queryKey: ['community-state', primaryCommunity?.id],
    queryFn: () => api.communities.getState(primaryCommunity!.id),
    enabled: !!primaryCommunity?.id,
  });

  const handleLogout = () => {
    logout();
    router.replace('/(auth)/welcome');
  };

  const onRefresh = () => {
    refetchOps();
    if (primaryCommunity?.id) refetchState();
  };

  if (isOpsLoading && !ops) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary[900]} />
        <Text style={styles.loadingText}>Initializing Operations Telemetry...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={isOpsRefetching} onRefresh={onRefresh} />}
      >
        {/* Header Bar */}
        <View style={styles.header}>
          <View>
            <Text style={styles.subTitle}>OPERATIONS CENTER</Text>
            <Text style={styles.operatorName}>{user?.fullName || 'Maintainer'}</Text>
            <Text style={styles.roleTag}>PMC Environmental Division • Active</Text>
          </View>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Text style={styles.logoutText}>Exit</Text>
          </TouchableOpacity>
        </View>

        {/* Live System Status Pill */}
        <View style={styles.statusBanner}>
          <View style={styles.pulseDot} />
          <Text style={styles.statusBannerText}>System Telemetry: ALL NODES ONLINE</Text>
          <Text style={styles.communitySlug}>{primaryCommunity?.name || 'Pune Ward 4'}</Text>
        </View>

        {/* Core Operations Metrics Grid */}
        <Text style={styles.sectionHeader}>Operational Queue</Text>
        <View style={styles.metricsGrid}>
          <TouchableOpacity
            style={[styles.metricCard, { borderLeftColor: colors.status.error, borderLeftWidth: 4 }]}
            onPress={() => router.push('/(maintainer)/incidents')}
          >
            <Text style={styles.metricVal}>{ops?.openIncidentsCount ?? 0}</Text>
            <Text style={styles.metricLabel}>Open Incidents</Text>
            <Text style={styles.metricHint}>Action required</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.metricCard, { borderLeftColor: colors.accent.points, borderLeftWidth: 4 }]}
            onPress={() => router.push('/(maintainer)/incidents')}
          >
            <Text style={styles.metricVal}>{ops?.pendingReviewsCount ?? 0}</Text>
            <Text style={styles.metricLabel}>Evidence Queue</Text>
            <Text style={styles.metricHint}>Pending human review</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.metricCard, { borderLeftColor: colors.status.info, borderLeftWidth: 4 }]}
            onPress={() => router.push('/(maintainer)/tasks')}
          >
            <Text style={styles.metricVal}>{ops?.activeTasksCount ?? 0}</Text>
            <Text style={styles.metricLabel}>Field Tasks</Text>
            <Text style={styles.metricHint}>In progress / assigned</Text>
          </TouchableOpacity>

          <View style={[styles.metricCard, { borderLeftColor: colors.status.success, borderLeftWidth: 4 }]}>
            <Text style={styles.metricVal}>{ops?.resolvedTodayCount ?? 0}</Text>
            <Text style={styles.metricLabel}>Resolved Today</Text>
            <Text style={styles.metricHint}>Verified cleanups</Text>
          </View>
        </View>

        {/* Community Intelligence & Health State */}
        <Text style={styles.sectionHeader}>Community Health Dimensions</Text>
        <View style={styles.healthCard}>
          <View style={styles.healthTop}>
            <View>
              <Text style={styles.healthTitle}>Overall Pulse Score</Text>
              <Text style={styles.healthSub}>Weighted 4-dimension state index</Text>
            </View>
            <View style={styles.scoreBadge}>
              <Text style={styles.scoreBadgeText}>{communityState?.overallProgress ?? 75}%</Text>
            </View>
          </View>

          <View style={styles.dimensionList}>
            {/* Behaviour */}
            <View style={styles.dimensionRow}>
              <View style={styles.dimLabelRow}>
                <Text style={styles.dimName}>1. Citizen Behaviour</Text>
                <Text style={styles.dimVal}>{communityState?.behaviourScore ?? 80}%</Text>
              </View>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressBar,
                    { width: `${communityState?.behaviourScore ?? 80}%`, backgroundColor: colors.primary[600] },
                  ]}
                />
              </View>
            </View>

            {/* Participation */}
            <View style={styles.dimensionRow}>
              <View style={styles.dimLabelRow}>
                <Text style={styles.dimName}>2. Community Participation</Text>
                <Text style={styles.dimVal}>{communityState?.participationScore ?? 72}%</Text>
              </View>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressBar,
                    { width: `${communityState?.participationScore ?? 72}%`, backgroundColor: colors.accent.points },
                  ]}
                />
              </View>
            </View>

            {/* Service Quality */}
            <View style={styles.dimensionRow}>
              <View style={styles.dimLabelRow}>
                <Text style={styles.dimName}>3. Service Quality (Field Ops)</Text>
                <Text style={styles.dimVal}>{communityState?.serviceScore ?? 85}%</Text>
              </View>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressBar,
                    { width: `${communityState?.serviceScore ?? 85}%`, backgroundColor: colors.status.info },
                  ]}
                />
              </View>
            </View>

            {/* Environmental Outcome */}
            <View style={styles.dimensionRow}>
              <View style={styles.dimLabelRow}>
                <Text style={styles.dimName}>4. Environmental Outcome</Text>
                <Text style={styles.dimVal}>{communityState?.environmentalScore ?? 78}%</Text>
              </View>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressBar,
                    { width: `${communityState?.environmentalScore ?? 78}%`, backgroundColor: colors.eco.leaf },
                  ]}
                />
              </View>
            </View>
          </View>
        </View>

        {/* Fast Action Buttons */}
        <Text style={styles.sectionHeader}>Immediate Actions</Text>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => router.push('/(maintainer)/incidents')}
        >
          <Text style={styles.actionBtnIcon}>🚨</Text>
          <View style={styles.actionBtnTextCol}>
            <Text style={styles.actionBtnTitle}>Process Incident Queue</Text>
            <Text style={styles.actionBtnSub}>Review resident reports and verify submitted evidence</Text>
          </View>
          <Text style={styles.chevron}>→</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => router.push('/(maintainer)/tasks')}
        >
          <Text style={styles.actionBtnIcon}>🛠️</Text>
          <View style={styles.actionBtnTextCol}>
            <Text style={styles.actionBtnTitle}>Dispatch Field Task</Text>
            <Text style={styles.actionBtnSub}>Assign municipal sanitation crews to verified hotspots</Text>
          </View>
          <Text style={styles.chevron}>→</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => router.push('/(maintainer)/timeline')}
        >
          <Text style={styles.actionBtnIcon}>📜</Text>
          <View style={styles.actionBtnTextCol}>
            <Text style={styles.actionBtnTitle}>Audit & Activity Timeline</Text>
            <Text style={styles.actionBtnSub}>Inspect chronological log of domain events and verifications</Text>
          </View>
          <Text style={styles.chevron}>→</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
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
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface.background,
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.neutral[600],
    ...typography.body,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.base,
  },
  subTitle: {
    color: colors.primary[700],
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  operatorName: {
    ...typography.h2,
    color: colors.neutral[900],
    marginTop: 2,
  },
  roleTag: {
    color: colors.neutral[500],
    fontSize: 12,
    marginTop: 2,
  },
  logoutBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.neutral[200],
  },
  logoutText: {
    color: colors.neutral[700],
    fontSize: 12,
    fontWeight: '600',
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary[900],
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
  },
  pulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary[400],
    marginRight: spacing.sm,
  },
  statusBannerText: {
    color: colors.surface.white,
    fontWeight: '600',
    fontSize: 12,
    flex: 1,
  },
  communitySlug: {
    color: colors.primary[300],
    fontSize: 11,
  },
  sectionHeader: {
    ...typography.h3,
    color: colors.neutral[900],
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: spacing.base,
  },
  metricCard: {
    width: '48%',
    backgroundColor: colors.surface.card,
    borderRadius: radius.md,
    padding: spacing.base,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.surface.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  metricVal: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.neutral[900],
  },
  metricLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.neutral[700],
    marginTop: 2,
  },
  metricHint: {
    fontSize: 11,
    color: colors.neutral[400],
    marginTop: 4,
  },
  healthCard: {
    backgroundColor: colors.surface.card,
    borderRadius: radius.lg,
    padding: spacing.base,
    marginBottom: spacing.base,
    borderWidth: 1,
    borderColor: colors.surface.border,
  },
  healthTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.base,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  healthTitle: {
    ...typography.bodyBold,
    color: colors.neutral[900],
  },
  healthSub: {
    fontSize: 12,
    color: colors.neutral[500],
    marginTop: 2,
  },
  scoreBadge: {
    backgroundColor: colors.primary[50],
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  scoreBadgeText: {
    color: colors.primary[900],
    fontSize: 18,
    fontWeight: '800',
  },
  dimensionList: {
    gap: 12,
  },
  dimensionRow: {},
  dimLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  dimName: {
    fontSize: 13,
    color: colors.neutral[700],
    fontWeight: '500',
  },
  dimVal: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.neutral[900],
  },
  progressTrack: {
    height: 8,
    backgroundColor: colors.neutral[100],
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface.card,
    borderRadius: radius.md,
    padding: spacing.base,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.surface.border,
  },
  actionBtnIcon: {
    fontSize: 24,
    marginRight: spacing.md,
  },
  actionBtnTextCol: {
    flex: 1,
  },
  actionBtnTitle: {
    ...typography.bodyBold,
    color: colors.neutral[900],
  },
  actionBtnSub: {
    fontSize: 12,
    color: colors.neutral[500],
    marginTop: 2,
  },
  chevron: {
    fontSize: 18,
    color: colors.neutral[400],
    fontWeight: '700',
    marginLeft: 8,
  },
});
