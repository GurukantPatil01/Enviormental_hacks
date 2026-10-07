import { colors, radius, spacing, typography } from '@ecopulse/design-system';
import type { ClusterDetail } from '@ecopulse/types';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../../lib/api';

function metricBar(label: string, value: number | undefined, tint: string) {
  const pct = Math.max(0, Math.min(100, value ?? 0));
  return (
    <View style={styles.metricBlock}>
      <View style={styles.metricHeader}>
        <Text style={styles.metricLabel}>{label}</Text>
        <Text style={styles.metricValue}>{value != null ? `${value}` : '—'}</Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: tint }]} />
      </View>
    </View>
  );
}

export default function ClusterDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ['cluster-detail', id],
    queryFn: () => api.geo.getCluster(id!, true),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary[900]} />
      </SafeAreaView>
    );
  }

  if (isError || !data) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <Text style={styles.errorTitle}>Cluster unavailable</Text>
        <Text style={styles.errorSub}>{(error as Error)?.message}</Text>
        <Pressable style={styles.retryButton} onPress={() => refetch()}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const m = data.metrics;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Map</Text>
        </Pressable>

        <Text style={styles.clusterCode}>{data.code}</Text>
        <Text style={styles.clusterName}>{data.name}</Text>
        {data.description ? <Text style={styles.clusterDesc}>{data.description}</Text> : null}
        <Text style={styles.communityLine}>
          {data.communityName ?? 'Community'}
          {data.wardName ? ` · ${data.wardName} ward` : ''}
          {` · ${data.memberCount.toLocaleString()} members`}
        </Text>

        {/* Environmental state */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Environmental state</Text>
          {metricBar('Environment', m?.environment, colors.status.success)}
          {metricBar('Service quality', m?.service, colors.status.info)}
          {metricBar('Community progress', m?.progress, colors.primary[700])}
          <View style={styles.inlineStats}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{data.openReportsCount ?? 0}</Text>
              <Text style={styles.statLabel}>Open incidents</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{data.activeMissionsCount ?? 0}</Text>
              <Text style={styles.statLabel}>Active missions</Text>
            </View>
          </View>
        </View>

        {/* Participation */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Participation</Text>
          {metricBar('Participation', m?.participation, colors.accent.points)}
          <Text style={styles.cardNote}>
            Community-level participation. Individual contributions stay private.
          </Text>
        </View>

        {/* Current milestone */}
        {data.currentMilestone ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Current milestone</Text>
            <Text style={styles.milestoneTitle}>{data.currentMilestone.title}</Text>
            <Text style={styles.milestoneDesc}>{data.currentMilestone.description}</Text>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  { width: `${Math.min(100, data.currentMilestone.targetProgress)}%`, backgroundColor: colors.primary[600] },
                ]}
              />
            </View>
          </View>
        ) : null}

        {/* Recent activity */}
        {data.recentActivity && data.recentActivity.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Recent activity</Text>
            {data.recentActivity.map((item) => (
              <View key={item.id} style={styles.activityRow}>
                <Text style={styles.activityDot}>•</Text>
                <View style={styles.activityBody}>
                  <Text style={styles.activityTitle}>{item.title}</Text>
                  <Text style={styles.activityDate}>
                    {new Date(item.createdAt).toLocaleDateString()}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface.background },
  centerContainer: {
    flex: 1,
    backgroundColor: colors.surface.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
  },
  scroll: { padding: spacing.xl, paddingTop: spacing.md, gap: spacing.lg },
  backButton: { marginBottom: spacing.xs },
  backText: { ...typography.bodyBold, color: colors.primary[900] },
  clusterCode: { ...typography.caption, color: colors.primary[700], fontWeight: '700' },
  clusterName: { ...typography.h1, color: colors.neutral[900], marginTop: 2 },
  clusterDesc: { ...typography.body, color: colors.neutral[600], marginTop: spacing.xs },
  communityLine: { ...typography.caption, color: colors.neutral[500], marginTop: spacing.xs },
  card: {
    backgroundColor: colors.surface.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  cardTitle: { ...typography.h3, color: colors.neutral[900] },
  cardNote: { ...typography.caption, color: colors.neutral[500] },
  metricBlock: { gap: 6 },
  metricHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  metricLabel: { ...typography.caption, color: colors.neutral[600], fontWeight: '600' },
  metricValue: { ...typography.bodyBold, color: colors.neutral[900] },
  barTrack: {
    height: 8,
    backgroundColor: colors.neutral[100],
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: radius.full },
  inlineStats: { flexDirection: 'row', gap: spacing.xl, marginTop: spacing.xs },
  stat: { alignItems: 'flex-start' },
  statValue: { ...typography.h2, color: colors.neutral[900] },
  statLabel: { ...typography.caption, color: colors.neutral[500] },
  milestoneTitle: { ...typography.bodyBold, color: colors.neutral[900] },
  milestoneDesc: { ...typography.caption, color: colors.neutral[600] },
  activityRow: { flexDirection: 'row', gap: spacing.sm },
  activityDot: { color: colors.primary[600], fontSize: 16 },
  activityBody: { flex: 1 },
  activityTitle: { ...typography.body, color: colors.neutral[800] },
  activityDate: { ...typography.caption, color: colors.neutral[400] },
  errorTitle: { ...typography.h2, color: colors.neutral[900] },
  errorSub: { ...typography.caption, color: colors.neutral[500], textAlign: 'center' },
  retryButton: {
    backgroundColor: colors.primary[900],
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    marginTop: spacing.md,
  },
  retryButtonText: { ...typography.bodyBold, color: colors.surface.white },
});
