import { colors, radius, spacing, typography } from '@ecopulse/design-system';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../lib/api';

export default function CommunityScreen() {
  const queryClient = useQueryClient();

  const { data: homeData } = useQuery({
    queryKey: ['home-dashboard'],
    queryFn: () => api.me.get(),
  });

  const {
    data: communities,
    isLoading: isCommLoading,
    refetch: refetchComm,
    isRefetching,
  } = useQuery({
    queryKey: ['communities'],
    queryFn: () => api.communities.list(),
  });

  const activeCommunity = homeData?.community || communities?.[0];
  const activeCommunityId = activeCommunity?.id;

  // 4-Dimension Community State
  const { data: communityState } = useQuery({
    queryKey: ['community-state', activeCommunityId],
    queryFn: () => api.communities.getState(activeCommunityId!),
    enabled: !!activeCommunityId,
  });

  // Milestones
  const { data: milestones } = useQuery({
    queryKey: ['community-milestones', activeCommunityId],
    queryFn: () => api.communities.getMilestones(activeCommunityId!),
    enabled: !!activeCommunityId,
  });

  // Live Community Timeline
  const { data: timeline } = useQuery({
    queryKey: ['community-timeline', activeCommunityId],
    queryFn: () => api.communities.getTimeline(activeCommunityId!),
    enabled: !!activeCommunityId,
  });

  const joinMutation = useMutation({
    mutationFn: (communityId: string) => api.communities.join(communityId),
    onSuccess: (data) => {
      Alert.alert('Joined!', `You are now an active member of ${data.community.name}.`);
      queryClient.invalidateQueries({ queryKey: ['home-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['communities'] });
      queryClient.invalidateQueries({ queryKey: ['community-state'] });
      queryClient.invalidateQueries({ queryKey: ['community-milestones'] });
    },
    onError: (err: any) => {
      Alert.alert('Failed to Join', err.message || 'Error joining community.');
    },
  });

  if (isCommLoading && !communities) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary[900]} />
        <Text style={styles.loadingText}>Syncing Community Telemetry...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetchComm} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.preTitle}>NEIGHBORHOOD COLLECTIVE</Text>
          <Text style={styles.title}>{activeCommunity?.name || 'Green Community'}</Text>
          <Text style={styles.subtitle}>📍 {activeCommunity?.locationName}</Text>
        </View>

        {/* Community Pulse Card (4 Dimensions) */}
        <View style={styles.healthCard}>
          <View style={styles.healthTop}>
            <View>
              <Text style={styles.healthTitle}>Community Pulse</Text>
              <Text style={styles.healthSub}>Living ecological state index</Text>
            </View>
            <View style={styles.pulsePill}>
              <Text style={styles.pulsePillVal}>{communityState?.overallProgress ?? 68}%</Text>
              <Text style={styles.pulseTrend}>
                {communityState?.trend === 'IMPROVING' ? '▲ IMPROVING' : '● STABLE'}
              </Text>
            </View>
          </View>

          <View style={styles.dimensionGrid}>
            <View style={styles.dimBox}>
              <Text style={styles.dimLabel}>Behaviour</Text>
              <Text style={styles.dimVal}>{communityState?.behaviourScore ?? 80}%</Text>
              <Text style={styles.dimHint}>Verified actions</Text>
            </View>
            <View style={styles.dimBox}>
              <Text style={styles.dimLabel}>Participation</Text>
              <Text style={styles.dimVal}>{communityState?.participationScore ?? 72}%</Text>
              <Text style={styles.dimHint}>Active citizens</Text>
            </View>
            <View style={styles.dimBox}>
              <Text style={styles.dimLabel}>Service Quality</Text>
              <Text style={styles.dimVal}>{communityState?.serviceScore ?? 85}%</Text>
              <Text style={styles.dimHint}>Ward operations</Text>
            </View>
            <View style={styles.dimBox}>
              <Text style={styles.dimLabel}>Environment</Text>
              <Text style={styles.dimVal}>{communityState?.environmentalScore ?? 78}%</Text>
              <Text style={styles.dimHint}>Hazard resolution</Text>
            </View>
          </View>
        </View>

        {/* Community Milestones Roadmap */}
        <Text style={styles.sectionHeader}>Ward Milestones & Rewards</Text>
        <View style={styles.milestonesList}>
          {(!milestones || milestones.length === 0) ? (
            <Text style={styles.emptyNote}>Loading community milestones...</Text>
          ) : (
            milestones.map((m) => (
              <View
                key={m.id}
                style={[
                  styles.milestoneCard,
                  m.status === 'ACHIEVED' && styles.milestoneCardAchieved,
                  m.status === 'IN_PROGRESS' && styles.milestoneCardActive,
                ]}
              >
                <View style={styles.mLeft}>
                  <View style={[styles.mTargetCircle, m.status === 'ACHIEVED' && styles.mTargetAchieved]}>
                    <Text style={styles.mTargetText}>{m.targetProgress}%</Text>
                  </View>
                </View>

                <View style={styles.mContent}>
                  <View style={styles.mTitleRow}>
                    <Text style={styles.mTitle}>{m.title}</Text>
                    <View style={[styles.mStatusPill, getMStatusStyle(m.status)]}>
                      <Text style={styles.mStatusText}>{m.status}</Text>
                    </View>
                  </View>
                  <Text style={styles.mDesc}>{m.description}</Text>

                  {/* Unlocked Reward */}
                  <View style={styles.rewardBox}>
                    <Text style={styles.rewardIcon}>🎁</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rewardTitle}>{m.rewardTitle}</Text>
                      <Text style={styles.rewardDesc}>{m.rewardDescription}</Text>
                    </View>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Collective Activity Timeline */}
        <Text style={styles.sectionHeader}>Live Collective Activity</Text>
        <View style={styles.timelineCard}>
          {(!timeline || timeline.length === 0) ? (
            <Text style={styles.emptyNote}>No recent community activity.</Text>
          ) : (
            timeline.slice(0, 6).map((item) => (
              <View key={item.id} style={styles.tRow}>
                <Text style={styles.tIcon}>{getTimelineIcon(item.category)}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.tTitle}>{item.title}</Text>
                  <Text style={styles.tDesc}>{item.description}</Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function getMStatusStyle(status: string) {
  switch (status) {
    case 'ACHIEVED':
      return { backgroundColor: colors.primary[100] };
    case 'IN_PROGRESS':
      return { backgroundColor: colors.accent.pointsBg };
    default:
      return { backgroundColor: colors.neutral[100] };
  }
}

function getTimelineIcon(cat: string) {
  switch (cat) {
    case 'REPORT':
      return '🚨';
    case 'VERIFICATION':
      return '✅';
    case 'TASK':
      return '🛠️';
    case 'OUTCOME':
      return '🌟';
    case 'MILESTONE':
      return '🏆';
    default:
      return '📍';
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
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.neutral[600],
  },
  header: {
    marginBottom: spacing.base,
  },
  preTitle: {
    color: colors.primary[700],
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  title: {
    ...typography.h2,
    color: colors.neutral[900],
    marginTop: 2,
  },
  subtitle: {
    fontSize: 13,
    color: colors.neutral[500],
    marginTop: 2,
  },
  healthCard: {
    backgroundColor: colors.surface.card,
    borderRadius: radius.xl,
    padding: spacing.base,
    borderWidth: 1,
    borderColor: colors.surface.border,
    marginBottom: spacing.base,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
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
    ...typography.h3,
    color: colors.neutral[900],
  },
  healthSub: {
    fontSize: 12,
    color: colors.neutral[500],
    marginTop: 2,
  },
  pulsePill: {
    backgroundColor: colors.primary[900],
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  pulsePillVal: {
    color: colors.surface.white,
    fontSize: 18,
    fontWeight: '900',
  },
  pulseTrend: {
    color: colors.primary[300],
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  dimensionGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dimBox: {
    alignItems: 'center',
    flex: 1,
  },
  dimLabel: {
    fontSize: 11,
    color: colors.neutral[500],
    fontWeight: '600',
  },
  dimVal: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.neutral[900],
    marginVertical: 2,
  },
  dimHint: {
    fontSize: 10,
    color: colors.neutral[400],
  },
  sectionHeader: {
    ...typography.h3,
    color: colors.neutral[900],
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  milestonesList: {
    gap: 12,
    marginBottom: spacing.base,
  },
  milestoneCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface.card,
    borderRadius: radius.lg,
    padding: spacing.base,
    borderWidth: 1,
    borderColor: colors.surface.border,
  },
  milestoneCardAchieved: {
    borderColor: colors.primary[400],
    backgroundColor: colors.primary[50],
  },
  milestoneCardActive: {
    borderColor: colors.accent.points,
  },
  mLeft: {
    marginRight: spacing.md,
    alignItems: 'center',
  },
  mTargetCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.neutral[200],
    alignItems: 'center',
    justifyContent: 'center',
  },
  mTargetAchieved: {
    backgroundColor: colors.primary[700],
  },
  mTargetText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.surface.white,
  },
  mContent: {
    flex: 1,
  },
  mTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  mTitle: {
    ...typography.bodyBold,
    color: colors.neutral[900],
    fontSize: 14,
    flex: 1,
  },
  mStatusPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
    marginLeft: 6,
  },
  mStatusText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.neutral[800],
  },
  mDesc: {
    fontSize: 12,
    color: colors.neutral[600],
    lineHeight: 16,
    marginBottom: 8,
  },
  rewardBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface.white,
    padding: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    gap: 8,
  },
  rewardIcon: {
    fontSize: 18,
  },
  rewardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.neutral[900],
  },
  rewardDesc: {
    fontSize: 11,
    color: colors.neutral[500],
  },
  timelineCard: {
    backgroundColor: colors.surface.card,
    borderRadius: radius.lg,
    padding: spacing.base,
    borderWidth: 1,
    borderColor: colors.surface.border,
    gap: 12,
  },
  tRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  tIcon: {
    fontSize: 18,
  },
  tTitle: {
    ...typography.bodyBold,
    fontSize: 13,
    color: colors.neutral[900],
  },
  tDesc: {
    fontSize: 12,
    color: colors.neutral[500],
    marginTop: 2,
  },
  emptyNote: {
    fontSize: 13,
    color: colors.neutral[500],
    fontStyle: 'italic',
  },
});
