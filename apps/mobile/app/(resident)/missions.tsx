import { colors, radius, spacing, typography } from '@ecopulse/design-system';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../lib/api';

export default function MissionsScreen() {
  const router = useRouter();

  const {
    data: missions,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ['missions'],
    queryFn: () => api.missions.list(),
  });

  if (isLoading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary[900]} />
        <Text style={styles.loadingText}>Fetching active missions...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Civic Missions</Text>
        <Text style={styles.subtitle}>
          Complete verifiable environmental actions & earn EcoPoints
        </Text>
      </View>

      <FlatList
        data={missions || []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        renderItem={({ item }) => {
          const isCompleted = item.userParticipationStatus === 'COMPLETED';
          const isStarted = item.userParticipationStatus === 'STARTED';

          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/(resident)/mission/${item.id}` as any)}
              activeOpacity={0.8}
            >
              <View style={styles.cardHeader}>
                <View style={styles.categoryPill}>
                  <Text style={styles.categoryText}>{item.category.replace('_', ' ')}</Text>
                </View>
                <View style={styles.rewardPill}>
                  <Text style={styles.rewardText}>+{item.pointsReward} EcoPoints</Text>
                </View>
              </View>

              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardDesc} numberOfLines={2}>
                {item.description}
              </Text>

              <View style={styles.footerRow}>
                <View style={styles.statusBox}>
                  {isCompleted ? (
                    <Text style={styles.statusCompleted}>✓ Completed</Text>
                  ) : isStarted ? (
                    <Text style={styles.statusInProgress}>⏳ In Progress</Text>
                  ) : (
                    <Text style={styles.statusAvailable}>Available</Text>
                  )}
                </View>
                <Text style={styles.actionArrow}>View Details →</Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    ...typography.body,
    color: colors.neutral[600],
    marginTop: spacing.md,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.base,
    paddingBottom: spacing.sm,
  },
  title: {
    ...typography.h1,
    color: colors.neutral[900],
  },
  subtitle: {
    ...typography.body,
    color: colors.neutral[600],
    marginTop: 2,
  },
  list: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface.white,
    borderColor: colors.neutral[200],
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.base,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  categoryPill: {
    backgroundColor: colors.primary[50],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  categoryText: {
    ...typography.caption,
    color: colors.primary[800],
    fontWeight: '700',
    fontSize: 11,
  },
  rewardPill: {
    backgroundColor: colors.accent.pointsBg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  rewardText: {
    ...typography.caption,
    color: colors.accent.points,
    fontWeight: '700',
  },
  cardTitle: {
    ...typography.h3,
    color: colors.neutral[900],
    marginBottom: spacing.xs,
  },
  cardDesc: {
    ...typography.body,
    fontSize: 14,
    color: colors.neutral[600],
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopColor: colors.neutral[100],
    borderTopWidth: 1,
    paddingTop: spacing.sm,
  },
  statusBox: {},
  statusCompleted: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.status.success,
  },
  statusInProgress: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.status.warning,
  },
  statusAvailable: {
    ...typography.caption,
    color: colors.neutral[500],
  },
  actionArrow: {
    ...typography.caption,
    color: colors.primary[700],
    fontWeight: '600',
  },
});
