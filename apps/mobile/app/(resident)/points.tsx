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

export default function PointsLedgerScreen() {
  const {
    data,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ['points-ledger'],
    queryFn: () => api.me.getPoints(),
  });

  const { balance, ledger } = data || {};

  if (isLoading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary[900]} />
        <Text style={styles.loadingText}>Computing Point Ledger...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>EcoPoints Ledger</Text>
        <Text style={styles.subtitle}>
          Immutable, auditable ledger of all citizen ecological transactions
        </Text>
      </View>

      {/* Balance Summary Header */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>CURRENT BALANCE</Text>
        <Text style={styles.balanceValue}>{balance?.totalPoints.toLocaleString() ?? 0}</Text>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Lifetime Earned</Text>
            <Text style={styles.statEarned}>+{balance?.lifetimeEarned.toLocaleString() ?? 0}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Lifetime Spent</Text>
            <Text style={styles.statSpent}>-{balance?.lifetimeSpent.toLocaleString() ?? 0}</Text>
          </View>
        </View>
      </View>

      <View style={styles.ledgerSectionHeader}>
        <Text style={styles.ledgerSectionTitle}>TRANSACTION HISTORY</Text>
        <Text style={styles.ledgerCount}>{ledger?.length ?? 0} entries</Text>
      </View>

      <FlatList
        data={ledger || []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        renderItem={({ item }) => {
          const isCredit = item.type === 'CREDIT';
          return (
            <View style={styles.ledgerItem}>
              <View style={styles.txIconBox}>
                <Text style={styles.txIcon}>{isCredit ? '➕' : '➖'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.txSource}>{item.source.replace('_', ' ')}</Text>
                <Text style={styles.txRef}>
                  Ref: {item.referenceId.substring(0, 18)}...
                </Text>
                <Text style={styles.txDate}>
                  {new Date(item.createdAt).toLocaleDateString()} at{' '}
                  {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
              <Text style={[styles.txAmount, isCredit ? styles.amountCredit : styles.amountDebit]}>
                {isCredit ? `+${item.amount}` : `-${item.amount}`}
              </Text>
            </View>
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
  balanceCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    backgroundColor: colors.surface.white,
    borderColor: colors.neutral[200],
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
  },
  balanceLabel: {
    ...typography.caption,
    color: colors.neutral[500],
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  balanceValue: {
    ...typography.metric,
    fontSize: 42,
    color: colors.primary[900],
    marginVertical: spacing.xs,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginTop: spacing.md,
    borderTopColor: colors.neutral[100],
    borderTopWidth: 1,
    paddingTop: spacing.md,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  divider: {
    width: 1,
    height: 24,
    backgroundColor: colors.neutral[200],
  },
  statLabel: {
    ...typography.caption,
    color: colors.neutral[500],
  },
  statEarned: {
    ...typography.bodyBold,
    color: colors.primary[700],
    marginTop: 2,
  },
  statSpent: {
    ...typography.bodyBold,
    color: colors.accent.streak,
    marginTop: 2,
  },
  ledgerSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
    marginBottom: spacing.xs,
  },
  ledgerSectionTitle: {
    ...typography.caption,
    color: colors.neutral[500],
    fontWeight: '700',
  },
  ledgerCount: {
    ...typography.caption,
    color: colors.neutral[400],
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing['2xl'],
    gap: spacing.sm,
  },
  ledgerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface.white,
    borderColor: colors.neutral[200],
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.md,
  },
  txIconBox: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.neutral[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  txIcon: {
    fontSize: 14,
  },
  txSource: {
    ...typography.bodyBold,
    fontSize: 14,
    color: colors.neutral[900],
  },
  txRef: {
    ...typography.caption,
    color: colors.neutral[400],
    fontFamily: 'monospace',
    fontSize: 11,
  },
  txDate: {
    ...typography.caption,
    color: colors.neutral[500],
    marginTop: 2,
  },
  txAmount: {
    ...typography.bodyBold,
    fontSize: 16,
  },
  amountCredit: {
    color: colors.primary[600],
  },
  amountDebit: {
    color: colors.status.error,
  },
});
