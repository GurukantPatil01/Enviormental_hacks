import { colors, radius, spacing, typography } from '@ecopulse/design-system';
import { useQuery } from '@tanstack/react-query';
import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../lib/api';

export default function ActivityScreen() {
  const {
    data: activities,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ['activity-feed'],
    queryFn: () => api.me.getActivity(),
  });

  if (isLoading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary[900]} />
        <Text style={styles.loadingText}>Fetching Activity Stream...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Civic Activity</Text>
        <Text style={styles.subtitle}>Audit trail of verified environmental milestones</Text>
      </View>

      <FlatList
        data={activities || []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.iconBox}>
              <Text style={styles.iconText}>🌱</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardDesc}>{item.description}</Text>
              <Text style={styles.cardDate}>
                {new Date(item.createdAt).toLocaleDateString()} •{' '}
                {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
            {item.points && (
              <View style={styles.pointsPill}>
                <Text style={styles.pointsText}>+{item.points}</Text>
              </View>
            )}
          </View>
        )}
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
    gap: spacing.md,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface.white,
    borderColor: colors.neutral[200],
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.md,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontSize: 16,
  },
  cardTitle: {
    ...typography.bodyBold,
    color: colors.neutral[900],
  },
  cardDesc: {
    ...typography.caption,
    color: colors.neutral[600],
    marginTop: 2,
  },
  cardDate: {
    ...typography.caption,
    color: colors.neutral[400],
    marginTop: 4,
    fontSize: 11,
  },
  pointsPill: {
    backgroundColor: colors.primary[50],
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  pointsText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.primary[700],
  },
});
