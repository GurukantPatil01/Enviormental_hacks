import { colors, radius, spacing, typography } from '@ecopulse/design-system';
import type { HumanReview, ObservationSeverity, Report, ReportStatus } from '@ecopulse/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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

export default function IncidentsScreen() {
  const queryClient = useQueryClient();
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [activeReport, setActiveReport] = useState<Report | null>(null);
  const [reviewReason, setReviewReason] = useState<string>('');
  const [isTaskModalOpen, setIsTaskModalOpen] = useState<boolean>(false);
  const [taskTitle, setTaskTitle] = useState<string>('');

  const {
    data: reports,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['maintainer-incidents'],
    queryFn: () => api.reports.list(),
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: (reportId: string) =>
      api.reviews.approve(reportId, {
        reason: reviewReason || 'Verified by municipal maintainer',
      }),
    onSuccess: () => {
      Alert.alert('Report Approved', 'Report verified and citizen EcoPoints credited to immutable ledger.');
      queryClient.invalidateQueries({ queryKey: ['maintainer-incidents'] });
      queryClient.invalidateQueries({ queryKey: ['maintainer-operations'] });
      setActiveReport(null);
      setReviewReason('');
    },
    onError: (err: any) => {
      Alert.alert('Verification Failed', err.message || 'Could not verify report');
    },
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: (reportId: string) =>
      api.reviews.reject(reportId, {
        reason: reviewReason || 'Insufficient evidence or invalid hazard report',
      }),
    onSuccess: () => {
      Alert.alert('Report Rejected', 'Report marked rejected without point reward.');
      queryClient.invalidateQueries({ queryKey: ['maintainer-incidents'] });
      queryClient.invalidateQueries({ queryKey: ['maintainer-operations'] });
      setActiveReport(null);
      setReviewReason('');
    },
    onError: (err: any) => {
      Alert.alert('Rejection Failed', err.message || 'Could not reject report');
    },
  });

  // Request More Evidence mutation
  const requestEvidenceMutation = useMutation({
    mutationFn: (reportId: string) =>
      api.reviews.requestEvidence(reportId, {
        reason: reviewReason || 'Additional photographic evidence requested from resident',
      }),
    onSuccess: () => {
      Alert.alert('Evidence Requested', 'Resident requested to provide clearer/additional evidence.');
      queryClient.invalidateQueries({ queryKey: ['maintainer-incidents'] });
      queryClient.invalidateQueries({ queryKey: ['maintainer-operations'] });
      setActiveReport(null);
      setReviewReason('');
    },
    onError: (err: any) => {
      Alert.alert('Action Failed', err.message || 'Could not request evidence');
    },
  });

  // Create Task mutation
  const createTaskMutation = useMutation({
    mutationFn: (data: { communityId: string; reportId: string; title: string }) =>
      api.tasks.create({
        communityId: data.communityId,
        reportId: data.reportId,
        title: data.title,
        priority: 'HIGH',
      }),
    onSuccess: () => {
      Alert.alert('Field Task Created', 'Sanitation crew dispatch scheduled.');
      queryClient.invalidateQueries({ queryKey: ['maintainer-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['maintainer-operations'] });
      setIsTaskModalOpen(false);
      setTaskTitle('');
    },
  });

  const filteredReports = (reports || []).filter((r) => {
    if (selectedStatus === 'ALL') return true;
    return r.status === selectedStatus;
  });

  const activeReview: HumanReview | undefined =
    activeReport?.reviews?.find((r) => r.decision === 'PENDING') ||
    activeReport?.reviews?.[0];

  return (
    <SafeAreaView style={styles.container}>
      {/* Screen Title */}
      <View style={styles.header}>
        <Text style={styles.title}>Incident Queue</Text>
        <Text style={styles.subTitle}>Resident environmental reports requiring human verification</Text>
      </View>

      {/* Filter Chips */}
      <View style={styles.filterBar}>
        {['ALL', 'SUBMITTED', 'VERIFIED', 'RESOLVED', 'REJECTED'].map((st) => (
          <TouchableOpacity
            key={st}
            style={[styles.filterChip, selectedStatus === st && styles.filterChipActive]}
            onPress={() => setSelectedStatus(st)}
          >
            <Text
              style={[
                styles.filterChipText,
                selectedStatus === st && styles.filterChipTextActive,
              ]}
            >
              {st}
            </Text>
          </TouchableOpacity>
        ))}
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
          {filteredReports.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>✅</Text>
              <Text style={styles.emptyTitle}>Queue Cleared</Text>
              <Text style={styles.emptySub}>No incident reports matching status {selectedStatus}</Text>
            </View>
          ) : (
            filteredReports.map((report) => {
              const reportAiReview = report.reviews?.find((r) => r.aiProvider || r.detectedIssue);
              return (
                <TouchableOpacity
                  key={report.id}
                  style={styles.incidentCard}
                  onPress={() => setActiveReport(report)}
                >
                  <View style={styles.cardHeader}>
                    <View style={[styles.categoryBadge, getBadgeStyle(report.category)]}>
                      <Text style={styles.categoryBadgeText}>{formatCategory(report.category)}</Text>
                    </View>
                    <View style={[styles.statusBadge, getStatusStyle(report.status)]}>
                      <Text style={styles.statusBadgeText}>{report.status}</Text>
                    </View>
                  </View>

                  {/* AI Observation Pill on Card */}
                  {reportAiReview && (
                    <View style={styles.cardAiPill}>
                      <Text style={styles.cardAiPillText}>
                        🤖 {reportAiReview.aiProvider === 'mock' ? 'Demo AI Analysis' : 'AI Analysis'} (
                        {reportAiReview.aiConfidence ?? reportAiReview.confidence}%)
                      </Text>
                    </View>
                  )}

                  <Text style={styles.reportTitle}>{report.title}</Text>
                  <Text style={styles.reportDesc} numberOfLines={2}>
                    {report.description}
                  </Text>

                  {report.locationAddress && (
                    <Text style={styles.locationText}>📍 {report.locationAddress}</Text>
                  )}

                  <View style={styles.cardFooter}>
                    <Text style={styles.reporterInfo}>
                      Reported by {report.user?.fullName || 'Resident'}
                    </Text>
                    <Text style={styles.rewardPill}>+{report.pointsReward} pts</Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Detail / Review Modal */}
      {activeReport && (
        <Modal visible={!!activeReport} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Review Incident</Text>
                <TouchableOpacity onPress={() => setActiveReport(null)}>
                  <Text style={styles.closeBtn}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody}>
                <View style={[styles.statusBadge, getStatusStyle(activeReport.status), { alignSelf: 'flex-start' }]}>
                  <Text style={styles.statusBadgeText}>{activeReport.status}</Text>
                </View>

                <Text style={styles.modalReportTitle}>{activeReport.title}</Text>
                <Text style={styles.modalReportDesc}>{activeReport.description}</Text>

                {activeReport.locationAddress && (
                  <Text style={styles.modalLocation}>📍 {activeReport.locationAddress}</Text>
                )}

                {/* Evidence Image */}
                <Text style={styles.evidenceHeader}>Submitted Evidence:</Text>
                {activeReport.evidence && activeReport.evidence.length > 0 ? (
                  activeReport.evidence.map((ev) => (
                    <View key={ev.id} style={styles.evidenceBox}>
                      <Image
                        source={{ uri: ev.mediaUrl }}
                        style={styles.evidenceImage}
                        resizeMode="cover"
                      />
                      <Text style={styles.evidenceStatus}>
                        Status: {ev.verificationStatus}
                      </Text>
                    </View>
                  ))
                ) : (
                  <View style={styles.noEvidenceBox}>
                    <Text style={styles.noEvidenceText}>No media attached to this submission</Text>
                  </View>
                )}

                {/* AI OBSERVATION & RECOMMENDATION (ADVISORY ONLY) */}
                {activeReview && (activeReview.aiProvider || activeReview.detectedIssue || activeReview.recommendation) ? (
                  <View style={styles.aiContainer}>
                    <View style={styles.aiHeader}>
                      <Text style={styles.aiSectionTitle}>AI OBSERVATION</Text>
                      {activeReview.aiProvider === 'mock' ? (
                        <View style={styles.demoBadge}>
                          <Text style={styles.demoBadgeText}>Demo AI Analysis</Text>
                        </View>
                      ) : (
                        <View style={styles.prodBadge}>
                          <Text style={styles.prodBadgeText}>{activeReview.aiProvider?.toUpperCase() || 'BEDROCK'}</Text>
                        </View>
                      )}
                    </View>

                    {/* Issue, Severity, Confidence */}
                    <View style={styles.aiMetricsGrid}>
                      <View style={styles.aiMetricBox}>
                        <Text style={styles.aiMetricLabel}>Detected Issue:</Text>
                        <Text style={styles.aiMetricValue}>
                          {formatCategory(activeReview.detectedIssue || activeReport.category)}
                        </Text>
                      </View>

                      <View style={styles.aiMetricBox}>
                        <Text style={styles.aiMetricLabel}>Severity:</Text>
                        <View style={[styles.severityPill, getSeverityBadgeStyle(activeReview.severity)]}>
                          <Text style={styles.severityPillText}>{activeReview.severity || 'HIGH'}</Text>
                        </View>
                      </View>

                      <View style={styles.aiMetricBox}>
                        <Text style={styles.aiMetricLabel}>Confidence:</Text>
                        <Text style={styles.confidenceValue}>
                          {activeReview.aiConfidence ?? activeReview.confidence}%
                        </Text>
                        <Text style={styles.confidenceSub}>
                          {getConfidenceLabel(activeReview.aiConfidence ?? activeReview.confidence ?? 0)}
                        </Text>
                      </View>
                    </View>

                    {/* Detected objects */}
                    {activeReview.detectedObjects && activeReview.detectedObjects.length > 0 && (
                      <View style={styles.detectedSection}>
                        <Text style={styles.detectedSectionLabel}>Detected Objects:</Text>
                        {activeReview.detectedObjects.map((obj, idx) => (
                          <Text key={idx} style={styles.detectedItem}>
                            • {obj}
                          </Text>
                        ))}
                      </View>
                    )}

                    <View style={styles.aiDivider} />

                    {/* AI RECOMMENDATION */}
                    <Text style={styles.aiSectionTitle}>AI RECOMMENDATION</Text>
                    <Text style={styles.recActionHeader}>Recommended action:</Text>
                    <Text style={styles.recActionText}>
                      {formatRecommendation(activeReview.recommendation)}
                    </Text>

                    {activeReview.reason && (
                      <>
                        <Text style={styles.recReasonHeader}>Reason:</Text>
                        <Text style={styles.recReasonText}>{activeReview.reason}</Text>
                      </>
                    )}
                  </View>
                ) : (
                  <View style={styles.noAiBox}>
                    <Text style={styles.noAiText}>⏳ AI vision observation queued for analysis</Text>
                  </View>
                )}

                {/* HUMAN DECISION (AUTHORITATIVE) */}
                <View style={styles.humanSection}>
                  <View style={styles.humanHeader}>
                    <Text style={styles.humanTitle}>⚖️ HUMAN DECISION</Text>
                    <View style={styles.authoritativeTag}>
                      <Text style={styles.authoritativeTagText}>AUTHORITATIVE</Text>
                    </View>
                  </View>
                  <Text style={styles.humanNotice}>
                    AI observation is advisory only. Maintainers retain sole authority over point awards, task dispatches, and community records.
                  </Text>

                  {/* Verification notes input */}
                  <Text style={styles.inputLabel}>Maintainer Note / Decision Reason:</Text>
                  <TextInput
                    style={styles.reasonInput}
                    placeholder="Enter notes, resident feedback or rejection justification..."
                    value={reviewReason}
                    onChangeText={setReviewReason}
                    multiline
                  />

                  {/* Action Buttons: APPROVE, REJECT, REQUEST MORE EVIDENCE */}
                  <View style={styles.actionBtnRow}>
                    <TouchableOpacity
                      style={[styles.decisionBtn, styles.approveBtn]}
                      onPress={() => approveMutation.mutate(activeReport.id)}
                      disabled={approveMutation.isPending}
                    >
                      {approveMutation.isPending ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.btnText}>Approve & Credit</Text>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.decisionBtn, styles.rejectBtn]}
                      onPress={() => rejectMutation.mutate(activeReport.id)}
                      disabled={rejectMutation.isPending}
                    >
                      {rejectMutation.isPending ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.btnText}>Reject</Text>
                      )}
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    style={[styles.decisionBtn, styles.requestEvidenceBtn]}
                    onPress={() => requestEvidenceMutation.mutate(activeReport.id)}
                    disabled={requestEvidenceMutation.isPending}
                  >
                    {requestEvidenceMutation.isPending ? (
                      <ActivityIndicator color="#1E293B" />
                    ) : (
                      <Text style={styles.requestEvidenceBtnText}>📷 Request More Evidence</Text>
                    )}
                  </TouchableOpacity>
                </View>

                {/* Dispatch Field Task */}
                <TouchableOpacity
                  style={styles.taskBtn}
                  onPress={() => {
                    setTaskTitle(`Remediate: ${activeReport.title}`);
                    setIsTaskModalOpen(true);
                  }}
                >
                  <Text style={styles.taskBtnText}>🛠️ Convert to Field Task</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* Create Task Modal */}
      {isTaskModalOpen && activeReport && (
        <Modal visible={isTaskModalOpen} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { maxHeight: 350 }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Dispatch Field Task</Text>
                <TouchableOpacity onPress={() => setIsTaskModalOpen(false)}>
                  <Text style={styles.closeBtn}>✕</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>Task Description / Title:</Text>
              <TextInput
                style={styles.reasonInput}
                value={taskTitle}
                onChangeText={setTaskTitle}
              />

              <TouchableOpacity
                style={[styles.decisionBtn, styles.approveBtn, { marginTop: 16 }]}
                onPress={() =>
                  createTaskMutation.mutate({
                    communityId: activeReport.communityId,
                    reportId: activeReport.id,
                    title: taskTitle,
                  })
                }
              >
                <Text style={styles.btnText}>Schedule Sanitation Dispatch</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

function formatCategory(cat: string) {
  return cat.replace(/_/g, ' ');
}

function formatRecommendation(rec?: string | null) {
  if (!rec) return 'Review incident report';
  switch (rec) {
    case 'DISPATCH_FIELD_TASK':
      return 'Dispatch field inspection';
    case 'VERIFY_REPORT':
      return 'Verify report & credit citizen';
    case 'REQUEST_MORE_EVIDENCE':
      return 'Request additional evidence';
    case 'ESCALATE':
      return 'Escalate to sanitation supervisor';
    case 'NO_ACTION':
      return 'No municipal action needed';
    default:
      return rec.replace(/_/g, ' ');
  }
}

function getBadgeStyle(cat: string) {
  if (cat === 'ILLEGAL_DUMPING' || cat === 'WASTE_HOTSPOT') {
    return { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' };
  }
  return { backgroundColor: '#E0F2FE', borderColor: '#BAE6FD' };
}

function getStatusStyle(st: ReportStatus) {
  switch (st) {
    case 'VERIFIED':
    case 'RESOLVED':
      return { backgroundColor: colors.primary[100] };
    case 'REJECTED':
      return { backgroundColor: '#FEE2E2' };
    default:
      return { backgroundColor: '#FEF3C7' };
  }
}

function getSeverityBadgeStyle(sev?: ObservationSeverity | null) {
  switch (sev) {
    case 'CRITICAL':
      return { backgroundColor: '#FEE2E2', borderColor: '#EF4444' };
    case 'HIGH':
      return { backgroundColor: '#FFEDD5', borderColor: '#F97316' };
    case 'MEDIUM':
      return { backgroundColor: '#FEF3C7', borderColor: '#FBBF24' };
    case 'LOW':
    default:
      return { backgroundColor: '#ECFDF5', borderColor: '#10B981' };
  }
}

function getConfidenceLabel(confidence: number) {
  if (confidence >= 85) return 'High confidence';
  if (confidence >= 60) return 'Medium confidence';
  return 'Low confidence';
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
  filterBar: {
    flexDirection: 'row',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.surface.card,
    borderWidth: 1,
    borderColor: colors.surface.border,
  },
  filterChipActive: {
    backgroundColor: colors.primary[900],
    borderColor: colors.primary[900],
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.neutral[600],
  },
  filterChipTextActive: {
    color: colors.surface.white,
  },
  listContainer: {
    padding: spacing.base,
    gap: 12,
    paddingBottom: 40,
  },
  incidentCard: {
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
  cardAiPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: '#F59E0B',
    marginBottom: 8,
  },
  cardAiPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400E',
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.neutral[800],
    textTransform: 'uppercase',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.neutral[800],
  },
  reportTitle: {
    ...typography.bodyBold,
    color: colors.neutral[900],
    marginBottom: 4,
  },
  reportDesc: {
    fontSize: 13,
    color: colors.neutral[600],
    lineHeight: 18,
    marginBottom: 8,
  },
  locationText: {
    fontSize: 12,
    color: colors.neutral[500],
    marginBottom: 8,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
  },
  reporterInfo: {
    fontSize: 12,
    color: colors.neutral[500],
  },
  rewardPill: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent.points,
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
    maxHeight: '90%',
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
  modalBody: {
    marginBottom: spacing.lg,
  },
  modalReportTitle: {
    ...typography.h2,
    color: colors.neutral[900],
    marginTop: 8,
    marginBottom: 4,
  },
  modalReportDesc: {
    ...typography.body,
    color: colors.neutral[700],
    marginBottom: 8,
  },
  modalLocation: {
    fontSize: 13,
    color: colors.neutral[500],
    marginBottom: spacing.base,
  },
  evidenceHeader: {
    ...typography.bodyBold,
    color: colors.neutral[900],
    marginBottom: spacing.sm,
  },
  evidenceBox: {
    borderRadius: radius.md,
    overflow: 'hidden',
    marginBottom: spacing.base,
  },
  evidenceImage: {
    width: '100%',
    height: 200,
    borderRadius: radius.md,
  },
  evidenceStatus: {
    fontSize: 11,
    color: colors.neutral[500],
    marginTop: 4,
  },
  noEvidenceBox: {
    padding: spacing.base,
    backgroundColor: colors.neutral[100],
    borderRadius: radius.md,
    alignItems: 'center',
    marginBottom: spacing.base,
  },
  noEvidenceText: {
    fontSize: 12,
    color: colors.neutral[500],
  },
  // AI Observation & Recommendation styles
  aiContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    padding: spacing.base,
    marginBottom: spacing.base,
  },
  aiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  aiSectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.8,
  },
  demoBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  demoBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#92400E',
    textTransform: 'uppercase',
  },
  prodBadge: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: '#0284C7',
  },
  prodBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0369A1',
  },
  aiMetricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 6,
    marginBottom: 8,
  },
  aiMetricBox: {
    flex: 1,
    backgroundColor: colors.surface.white,
    padding: 8,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  aiMetricLabel: {
    fontSize: 10,
    color: colors.neutral[500],
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  aiMetricValue: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.neutral[800],
  },
  severityPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    marginTop: 2,
  },
  severityPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.neutral[900],
  },
  confidenceValue: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary[900],
  },
  confidenceSub: {
    fontSize: 9,
    color: colors.neutral[500],
    fontWeight: '500',
  },
  detectedSection: {
    marginTop: 6,
    backgroundColor: colors.surface.white,
    padding: 8,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  detectedSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.neutral[700],
    marginBottom: 4,
  },
  detectedItem: {
    fontSize: 12,
    color: colors.neutral[600],
    lineHeight: 16,
  },
  aiDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: spacing.sm,
  },
  recActionHeader: {
    fontSize: 11,
    color: colors.neutral[500],
    fontWeight: '600',
    textTransform: 'uppercase',
    marginTop: 4,
  },
  recActionText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.primary[900],
    marginTop: 2,
  },
  recReasonHeader: {
    fontSize: 11,
    color: colors.neutral[500],
    fontWeight: '600',
    textTransform: 'uppercase',
    marginTop: 6,
  },
  recReasonText: {
    fontSize: 12,
    color: colors.neutral[700],
    lineHeight: 16,
    marginTop: 2,
  },
  noAiBox: {
    backgroundColor: '#F1F5F9',
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.base,
    alignItems: 'center',
  },
  noAiText: {
    fontSize: 12,
    color: colors.neutral[600],
    fontWeight: '600',
  },
  // Human Decision section styles
  humanSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.primary[900],
    padding: spacing.base,
    marginBottom: spacing.base,
  },
  humanHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  humanTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.neutral[900],
    letterSpacing: 0.5,
  },
  authoritativeTag: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: '#22C55E',
  },
  authoritativeTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#15803D',
  },
  humanNotice: {
    fontSize: 11,
    color: colors.neutral[500],
    lineHeight: 15,
    marginBottom: spacing.sm,
  },
  inputLabel: {
    ...typography.caption,
    color: colors.neutral[700],
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  reasonInput: {
    borderWidth: 1,
    borderColor: colors.surface.border,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 13,
    color: colors.neutral[900],
    minHeight: 50,
    marginBottom: spacing.sm,
  },
  actionBtnRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  decisionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  approveBtn: {
    backgroundColor: colors.primary[700],
  },
  rejectBtn: {
    backgroundColor: colors.status.error,
  },
  requestEvidenceBtn: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingVertical: 10,
  },
  requestEvidenceBtnText: {
    color: '#1E293B',
    fontWeight: '700',
    fontSize: 13,
  },
  btnText: {
    color: colors.surface.white,
    fontWeight: '700',
    fontSize: 13,
  },
  taskBtn: {
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary[900],
    alignItems: 'center',
  },
  taskBtnText: {
    color: colors.primary[900],
    fontWeight: '700',
    fontSize: 14,
  },
});
