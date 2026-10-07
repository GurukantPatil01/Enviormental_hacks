import { colors, radius, spacing, typography } from '@ecopulse/design-system';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../../lib/api';

export default function MissionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [notes, setNotes] = useState('');
  // Generate clientEventId for idempotency test
  const [clientEventId, setClientEventId] = useState(
    () => `evt-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
  );

  const {
    data: mission,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['mission', id],
    queryFn: () => api.missions.get(id!),
    enabled: !!id,
  });

  const startMutation = useMutation({
    mutationFn: () => api.missions.start(id!),
    onSuccess: () => {
      Alert.alert('Mission Started', 'You are now actively participating in this mission.');
      refetch();
      queryClient.invalidateQueries({ queryKey: ['missions'] });
      queryClient.invalidateQueries({ queryKey: ['home-dashboard'] });
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || 'Failed to start mission.');
    },
  });

  const completeMutation = useMutation({
    mutationFn: () =>
      api.missions.complete(id!, {
        client_event_id: clientEventId,
        notes: notes || undefined,
      }),
    onSuccess: (data) => {
      if (data.status === 'ALREADY_COMPLETED') {
        Alert.alert(
          'Idempotent Result',
          `This mission was already processed.\n\nPoint Balance: ${data.pointBalance}\nStreak: ${data.currentStreak} days\n(Points were NOT duplicated).`
        );
      } else {
        Alert.alert(
          '🎉 Mission Completed!',
          `Server verified action!\n\n+${data.pointsAwarded} EcoPoints credited to ledger.\nNew balance: ${data.pointBalance}\nStreak: ${data.currentStreak} days.`
        );
      }
      refetch();
      queryClient.invalidateQueries({ queryKey: ['missions'] });
      queryClient.invalidateQueries({ queryKey: ['home-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['points-ledger'] });
      queryClient.invalidateQueries({ queryKey: ['activity-feed'] });
    },
    onError: (err: any) => {
      Alert.alert('Completion Failed', err.message || 'Failed to complete mission.');
    },
  });

  if (isLoading || !mission) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary[900]} />
        <Text style={styles.loadingText}>Loading Mission telemetry...</Text>
      </SafeAreaView>
    );
  }

  const isCompleted = mission.userParticipationStatus === 'COMPLETED';
  const isStarted = mission.userParticipationStatus === 'STARTED';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back to Missions</Text>
        </TouchableOpacity>

        {/* Header Badges */}
        <View style={styles.badgeRow}>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{mission.category.replace('_', ' ')}</Text>
          </View>
          <View style={styles.rewardBadge}>
            <Text style={styles.rewardText}>+{mission.pointsReward} pts</Text>
          </View>
        </View>

        <Text style={styles.title}>{mission.title}</Text>
        <Text style={styles.description}>{mission.description}</Text>

        {/* Verification Spec */}
        <View style={styles.specCard}>
          <Text style={styles.specLabel}>VERIFICATION METHOD</Text>
          <Text style={styles.specValue}>
            {mission.verificationType === 'AUTOMATIC'
              ? '⚡ Automatic Telemetry Verification'
              : '📷 Photographic Evidence Verification'}
          </Text>
          <Text style={styles.specDesc}>
            EcoPulse server verifies conditions before authorizing point ledger entries.
          </Text>
        </View>

        {/* Status Section */}
        <View style={styles.statusCard}>
          <Text style={styles.statusLabel}>PARTICIPATION STATUS</Text>
          <Text
            style={[
              styles.statusText,
              isCompleted && { color: colors.status.success },
              isStarted && { color: colors.status.warning },
            ]}
          >
            {mission.userParticipationStatus || 'NOT_STARTED'}
          </Text>
        </View>

        {/* Actions */}
        {!isCompleted && !isStarted && (
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => startMutation.mutate()}
            disabled={startMutation.isPending}
            activeOpacity={0.8}
          >
            {startMutation.isPending ? (
              <ActivityIndicator color={colors.surface.white} />
            ) : (
              <Text style={styles.primaryBtnText}>Start This Mission</Text>
            )}
          </TouchableOpacity>
        )}

        {isStarted && (
          <View style={styles.completionForm}>
            <Text style={styles.formTitle}>Mission Verification & Completion</Text>
            <Text style={styles.formSubtitle}>
              Idempotency Key: <Text style={{ fontFamily: 'monospace' }}>{clientEventId}</Text>
            </Text>

            <TextInput
              style={styles.notesInput}
              placeholder="Add completion notes (optional)..."
              placeholderTextColor={colors.neutral[400]}
              multiline
              numberOfLines={3}
              value={notes}
              onChangeText={setNotes}
            />

            <TouchableOpacity
              style={styles.completeBtn}
              onPress={() => completeMutation.mutate()}
              disabled={completeMutation.isPending}
              activeOpacity={0.8}
            >
              {completeMutation.isPending ? (
                <ActivityIndicator color={colors.surface.white} />
              ) : (
                <Text style={styles.completeBtnText}>Verify & Claim {mission.pointsReward} Points</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.idempotencyTestBtn}
              onPress={() => completeMutation.mutate()}
              disabled={completeMutation.isPending}
            >
              <Text style={styles.idempotencyTestText}>
                🧪 Resend Same Request (Test Idempotency)
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {isCompleted && (
          <View style={styles.completedBanner}>
            <Text style={styles.completedBannerText}>
              ✓ Mission has been successfully verified & completed! Points are credited in your ledger.
            </Text>
          </View>
        )}
      </ScrollView>
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
  scroll: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  backBtn: {
    marginBottom: spacing.xs,
  },
  backText: {
    ...typography.bodyBold,
    color: colors.primary[900],
  },
  badgeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  categoryBadge: {
    backgroundColor: colors.primary[50],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  categoryText: {
    ...typography.caption,
    color: colors.primary[800],
    fontWeight: '700',
  },
  rewardBadge: {
    backgroundColor: colors.accent.pointsBg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  rewardText: {
    ...typography.caption,
    color: colors.accent.points,
    fontWeight: '700',
  },
  title: {
    ...typography.h1,
    color: colors.neutral[900],
  },
  description: {
    ...typography.body,
    color: colors.neutral[700],
    lineHeight: 24,
  },
  specCard: {
    backgroundColor: colors.surface.white,
    borderColor: colors.neutral[200],
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.base,
  },
  specLabel: {
    ...typography.caption,
    color: colors.neutral[500],
    fontWeight: '700',
  },
  specValue: {
    ...typography.bodyBold,
    color: colors.neutral[900],
    marginTop: 2,
    marginBottom: 4,
  },
  specDesc: {
    ...typography.caption,
    color: colors.neutral[500],
  },
  statusCard: {
    backgroundColor: colors.surface.white,
    borderColor: colors.neutral[200],
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.base,
  },
  statusLabel: {
    ...typography.caption,
    color: colors.neutral[500],
    fontWeight: '700',
  },
  statusText: {
    ...typography.h3,
    color: colors.neutral[700],
    marginTop: 2,
  },
  primaryBtn: {
    backgroundColor: colors.primary[900],
    paddingVertical: spacing.base,
    borderRadius: radius.lg,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  primaryBtnText: {
    ...typography.bodyBold,
    color: colors.surface.white,
    fontSize: 16,
  },
  completionForm: {
    backgroundColor: colors.surface.white,
    borderColor: colors.neutral[200],
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.base,
    gap: spacing.md,
  },
  formTitle: {
    ...typography.h3,
    color: colors.neutral[900],
  },
  formSubtitle: {
    ...typography.caption,
    color: colors.neutral[500],
  },
  notesInput: {
    backgroundColor: colors.neutral[50],
    borderColor: colors.neutral[300],
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    ...typography.body,
    textAlignVertical: 'top',
  },
  completeBtn: {
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.base,
    borderRadius: radius.lg,
    alignItems: 'center',
  },
  completeBtnText: {
    ...typography.bodyBold,
    color: colors.surface.white,
    fontSize: 16,
  },
  idempotencyTestBtn: {
    borderColor: colors.neutral[300],
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  idempotencyTestText: {
    ...typography.caption,
    color: colors.neutral[700],
    fontWeight: '600',
  },
  completedBanner: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[300],
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.base,
  },
  completedBannerText: {
    ...typography.bodyBold,
    color: colors.primary[900],
    textAlign: 'center',
  },
});
