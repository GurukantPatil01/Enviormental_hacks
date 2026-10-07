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

export default function MaintainerTimelineScreen() {
  const { data: communities } = useQuery({
    queryKey: ['communities'],
    queryFn: () => api.communities.list(),
  });

  const communityId = communities?.[0]?.id;

  const {
    data: timeline,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['community-timeline', communityId],
    queryFn: () => api.communities.getTimeline(communityId!),
    enabled: !!communityId,
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Audit & Event Timeline</Text>
        <Text style={styles.subTitle}>Live chronological record of community environmental operations</Text>
      </View>

      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary[900]} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContainer}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        >
          {(!timeline || timeline.length === 0) ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>📜</Text>
              <Text style={styles.emptyTitle}>No Timeline Events</Text>
              <Text style={styles.emptySub}>Events will be recorded as actions occur</Text>
            </View>
          ) : (
            timeline.map((entry) => (
              <View key={entry.id} style={styles.timelineItem}>
                <View style={styles.timelineLeft}>
                  <View style={[styles.categoryCircle, getCategoryBg(entry.category)]}>
                    <Text style={styles.categoryIcon}>{getCategoryIcon(entry.category)}</Text>
                  </View>
                  <View style={styles.verticalLine} />
                </View>

                <View style={styles.timelineContent}>
                  <View style={styles.metaRow}>
                    <Text style={styles.categoryBadgeText}>{entry.category}</Text>
                    <Text style={styles.timestampText}>{formatTime(entry.timestamp)}</Text>
                  </View>

                  <Text style={styles.entryTitle}>{entry.title}</Text>
                  <Text style={styles.entryDesc}>{entry.description}</Text>

                  {entry.actorName && (
                    <Text style={styles.actorText}>By: {entry.actorName}</Text>
                  )}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function getCategoryIcon(cat: string) {
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

function getCategoryBg(cat: string) {
  switch (cat) {
    case 'VERIFICATION':
    case 'OUTCOME':
      return { backgroundColor: colors.primary[100] };
    case 'REPORT':
      return { backgroundColor: '#FEE2E2' };
    case 'TASK':
      return { backgroundColor: '#E0F2FE' };
    case 'MILESTONE':
      return { backgroundColor: '#FEF3C7' };
    default:
      return { backgroundColor: colors.neutral[100] };
  }
}

function formatTime(iso: string) {
  try {
    const d = new Date(iso);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  } catch {
    return iso;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface.background,
  },
  header: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
    paddingBottom: spacing.sm,
  },
  title: {
    ...typography.h2,
    color: colors.neutral[900],
  },
  subTitle: {
    fontSize: 13,
    color: colors.neutral[500],
    marginTop: 2,
  },
  listContainer: {
    padding: spacing.base,
    paddingBottom: 40,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyCard: {
    alignItems: 'center',
    padding: spacing['2xl'],
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.neutral[900],
  },
  emptySub: {
    fontSize: 13,
    color: colors.neutral[500],
    marginTop: 4,
  },
  timelineItem: {
    flexDirection: 'row',
  },
  timelineLeft: {
    alignItems: 'center',
    width: 44,
  },
  categoryCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  categoryIcon: {
    fontSize: 16,
  },
  verticalLine: {
    width: 2,
    flex: 1,
    backgroundColor: colors.neutral[200],
    marginVertical: 4,
  },
  timelineContent: {
    flex: 1,
    backgroundColor: colors.surface.card,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.base,
    borderWidth: 1,
    borderColor: colors.surface.border,
    marginLeft: 8,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.neutral[500],
    letterSpacing: 0.5,
  },
  timestampText: {
    fontSize: 11,
    color: colors.neutral[400],
  },
  entryTitle: {
    ...typography.bodyBold,
    color: colors.neutral[900],
    marginBottom: 2,
  },
  entryDesc: {
    fontSize: 13,
    color: colors.neutral[600],
    lineHeight: 18,
  },
  actorText: {
    fontSize: 11,
    color: colors.primary[700],
    marginTop: 6,
    fontWeight: '600',
  },
});
