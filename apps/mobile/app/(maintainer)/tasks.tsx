import { colors, radius, spacing, typography } from '@ecopulse/design-system';
import type { Task, TaskPriority, TaskStatus } from '@ecopulse/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../lib/api';

export default function MaintainerTasksScreen() {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM');

  const {
    data: tasks,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['maintainer-tasks'],
    queryFn: () => api.tasks.list(),
  });

  const { data: communities } = useQuery({
    queryKey: ['communities'],
    queryFn: () => api.communities.list(),
  });

  const communityId = communities?.[0]?.id;

  // Complete mutation
  const completeMutation = useMutation({
    mutationFn: (taskId: string) => api.tasks.complete(taskId),
    onSuccess: () => {
      Alert.alert('Task Completed', 'Task submitted for final maintainer verification.');
      queryClient.invalidateQueries({ queryKey: ['maintainer-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['maintainer-operations'] });
    },
  });

  // Verify mutation
  const verifyMutation = useMutation({
    mutationFn: (taskId: string) => api.tasks.verify(taskId),
    onSuccess: () => {
      Alert.alert('Outcome Verified', 'Field task confirmed. Associated incident resolved & community health updated.');
      queryClient.invalidateQueries({ queryKey: ['maintainer-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['maintainer-operations'] });
      queryClient.invalidateQueries({ queryKey: ['community-state'] });
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: { title: string; description: string; priority: TaskPriority }) =>
      api.tasks.create({
        communityId: communityId!,
        title: data.title,
        description: data.description,
        priority: data.priority,
      }),
    onSuccess: () => {
      Alert.alert('Task Dispatched', 'Field task registered.');
      queryClient.invalidateQueries({ queryKey: ['maintainer-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['maintainer-operations'] });
      setIsCreateOpen(false);
      setTitle('');
      setDescription('');
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Field Tasks</Text>
          <Text style={styles.subTitle}>Sanitation crew dispatches & remediation status</Text>
        </View>
        <TouchableOpacity
          style={styles.newBtn}
          onPress={() => setIsCreateOpen(true)}
          disabled={!communityId}
        >
          <Text style={styles.newBtnText}>+ New Task</Text>
        </TouchableOpacity>
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
          {(!tasks || tasks.length === 0) ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>🛠️</Text>
              <Text style={styles.emptyTitle}>No Field Tasks</Text>
              <Text style={styles.emptySub}>All reported areas are currently in order</Text>
            </View>
          ) : (
            tasks.map((t) => (
              <View key={t.id} style={styles.taskCard}>
                <View style={styles.cardHeader}>
                  <View style={[styles.priorityBadge, getPriorityStyle(t.priority)]}>
                    <Text style={styles.priorityText}>{t.priority}</Text>
                  </View>
                  <View style={[styles.statusBadge, getTaskStatusStyle(t.status)]}>
                    <Text style={styles.statusText}>{t.status}</Text>
                  </View>
                </View>

                <Text style={styles.taskTitle}>{t.title}</Text>
                {t.description && <Text style={styles.taskDesc}>{t.description}</Text>}

                {t.report && (
                  <View style={styles.incidentLink}>
                    <Text style={styles.incidentLinkText}>
                      Linked Incident: {t.report.title} ({t.report.category})
                    </Text>
                  </View>
                )}

                <View style={styles.cardActions}>
                  {t.status === 'CREATED' || t.status === 'ASSIGNED' || t.status === 'IN_PROGRESS' ? (
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.completeBtn]}
                      onPress={() => completeMutation.mutate(t.id)}
                      disabled={completeMutation.isPending}
                    >
                      <Text style={styles.actionBtnText}>Mark Work Completed</Text>
                    </TouchableOpacity>
                  ) : null}

                  {t.status === 'COMPLETED' ? (
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.verifyBtn]}
                      onPress={() => verifyMutation.mutate(t.id)}
                      disabled={verifyMutation.isPending}
                    >
                      <Text style={styles.actionBtnText}>Verify Field Outcome</Text>
                    </TouchableOpacity>
                  ) : null}

                  {t.status === 'VERIFIED' ? (
                    <Text style={styles.verifiedLabel}>✅ Remediated & Confirmed</Text>
                  ) : null}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* Create Task Modal */}
      <Modal visible={isCreateOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Dispatch Field Task</Text>
              <TouchableOpacity onPress={() => setIsCreateOpen(false)}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Title</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Clear overflowing dry waste bin"
              value={title}
              onChangeText={setTitle}
            />

            <Text style={styles.inputLabel}>Description / Instructions</Text>
            <TextInput
              style={[styles.textInput, { minHeight: 70 }]}
              placeholder="Provide crew dispatch details..."
              value={description}
              onChangeText={setDescription}
              multiline
            />

            <Text style={styles.inputLabel}>Priority Level</Text>
            <View style={styles.priorityRow}>
              {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as TaskPriority[]).map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[styles.pChip, priority === p && styles.pChipActive]}
                  onPress={() => setPriority(p)}
                >
                  <Text style={[styles.pChipText, priority === p && styles.pChipTextActive]}>
                    {p}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={styles.submitBtn}
              onPress={() =>
                createMutation.mutate({
                  title,
                  description,
                  priority,
                })
              }
              disabled={createMutation.isPending || !title.trim()}
            >
              {createMutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>Dispatch Task</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function getPriorityStyle(p: TaskPriority) {
  switch (p) {
    case 'CRITICAL':
      return { backgroundColor: '#FEE2E2', borderColor: '#EF4444' };
    case 'HIGH':
      return { backgroundColor: '#FFEDD5', borderColor: '#F97316' };
    default:
      return { backgroundColor: '#F1F5F9', borderColor: '#CBD5E1' };
  }
}

function getTaskStatusStyle(s: TaskStatus) {
  switch (s) {
    case 'VERIFIED':
      return { backgroundColor: colors.primary[100] };
    case 'COMPLETED':
      return { backgroundColor: '#E0F2FE' };
    case 'IN_PROGRESS':
      return { backgroundColor: '#FEF3C7' };
    default:
      return { backgroundColor: colors.neutral[100] };
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  newBtn: {
    backgroundColor: colors.primary[900],
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md,
  },
  newBtnText: {
    color: colors.surface.white,
    fontWeight: '700',
    fontSize: 12,
  },
  listContainer: {
    padding: spacing.base,
    gap: 12,
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
  taskCard: {
    backgroundColor: colors.surface.card,
    borderRadius: radius.md,
    padding: spacing.base,
    borderWidth: 1,
    borderColor: colors.surface.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.neutral[800],
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.neutral[800],
  },
  taskTitle: {
    ...typography.bodyBold,
    color: colors.neutral[900],
    marginBottom: 4,
  },
  taskDesc: {
    fontSize: 13,
    color: colors.neutral[600],
    lineHeight: 18,
    marginBottom: 8,
  },
  incidentLink: {
    backgroundColor: colors.neutral[50],
    padding: 8,
    borderRadius: radius.sm,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  incidentLinkText: {
    fontSize: 12,
    color: colors.neutral[600],
    fontWeight: '500',
  },
  cardActions: {
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
    paddingTop: 8,
  },
  actionBtn: {
    paddingVertical: 10,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  completeBtn: {
    backgroundColor: colors.status.info,
  },
  verifyBtn: {
    backgroundColor: colors.primary[700],
  },
  actionBtnText: {
    color: colors.surface.white,
    fontWeight: '700',
    fontSize: 13,
  },
  verifiedLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary[700],
    textAlign: 'center',
    paddingVertical: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.base,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.base,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.neutral[900],
  },
  closeBtn: {
    fontSize: 20,
    color: colors.neutral[500],
    padding: 4,
  },
  inputLabel: {
    ...typography.caption,
    color: colors.neutral[700],
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  textInput: {
    borderWidth: 1,
    borderColor: colors.surface.border,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 14,
    color: colors.neutral[900],
    marginBottom: spacing.base,
  },
  priorityRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: spacing.lg,
  },
  pChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: radius.md,
    alignItems: 'center',
    backgroundColor: colors.neutral[100],
  },
  pChipActive: {
    backgroundColor: colors.primary[900],
  },
  pChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.neutral[700],
  },
  pChipTextActive: {
    color: colors.surface.white,
  },
  submitBtn: {
    backgroundColor: colors.primary[900],
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  submitBtnText: {
    color: colors.surface.white,
    fontWeight: '700',
    fontSize: 15,
  },
});
