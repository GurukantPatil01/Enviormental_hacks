import { colors, radius, spacing, typography } from '@ecopulse/design-system';
import { useQuery } from '@tanstack/react-query';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../lib/api';

/**
 * Rewards preview surface. The full reward marketplace (catalog, claims,
 * fulfillment) lands in Phase 4 — this screen already shows the real
 * EcoPoints balance from the immutable ledger and will become the
 * storefront without changing the navigation.
 */
export default function RewardsScreen() {
  const { data } = useQuery({
    queryKey: ['me-points'],
    queryFn: () => api.me.getPoints(),
  });

  const balance = data?.balance.totalPoints ?? 0;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Rewards</Text>
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>EcoPoints balance</Text>
          <Text style={styles.balanceValue}>{balance.toLocaleString()}</Text>
          <Text style={styles.balanceNote}>
            Earned through verified environmental action — spend it on partner rewards.
          </Text>
        </View>

        <View style={styles.placeholderCard}>
          <Text style={styles.placeholderTitle}>Reward marketplace arriving soon</Text>
          <Text style={styles.placeholderBody}>
            Local store vouchers, cafe discounts, event passes and sustainability
            products — claimable with EcoPoints once maintainers publish the
            catalog in your community.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface.background },
  scroll: { padding: spacing.xl, gap: spacing.lg },
  title: { ...typography.h1, color: colors.neutral[900] },
  balanceCard: {
    backgroundColor: colors.primary[900],
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: 4,
  },
  balanceLabel: { ...typography.caption, color: colors.primary[200] },
  balanceValue: { ...typography.metric, color: colors.surface.white },
  balanceNote: { ...typography.caption, color: colors.primary[100], marginTop: 4 },
  placeholderCard: {
    backgroundColor: colors.surface.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    gap: spacing.sm,
  },
  placeholderTitle: { ...typography.h3, color: colors.neutral[900] },
  placeholderBody: { ...typography.body, color: colors.neutral[600] },
});
