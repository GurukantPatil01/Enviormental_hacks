import { colors, radius, spacing, typography } from '@ecopulse/design-system';
import type { Report, ReportCategory } from '@ecopulse/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { useAuthStore } from '../../stores/auth.store';

const CATEGORIES: { label: string; value: ReportCategory; icon: string }[] = [
  { label: 'Waste Hotspot', value: 'WASTE_HOTSPOT', icon: '🗑️' },
  { label: 'Illegal Dumping', value: 'ILLEGAL_DUMPING', icon: '⚠️' },
  { label: 'Overflowing Bin', value: 'OVERFLOWING_BIN', icon: '📦' },
  { label: 'Missed Collection', value: 'MISSED_COLLECTION', icon: '🚛' },
  { label: 'Mixed Waste', value: 'MIXED_WASTE', icon: '♻️' },
  { label: 'Other Issue', value: 'OTHER', icon: '📍' },
];

const SAMPLE_EVIDENCE_URLS = [
  'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1563245372-f21724e3856d?auto=format&fit=crop&w=800&q=80',
];

export default function ReportScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [tab, setTab] = useState<'NEW' | 'TRACK'>('NEW');

  // Form state
  const [category, setCategory] = useState<ReportCategory>('WASTE_HOTSPOT');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [locationAddress, setLocationAddress] = useState('Kothrud Green Corridor, Pune');
  const [evidenceUrl, setEvidenceUrl] = useState(SAMPLE_EVIDENCE_URLS[0]);

  // Communities
  const { data: communities } = useQuery({
    queryKey: ['communities'],
    queryFn: () => api.communities.list(),
  });
  const communityId = communities?.[0]?.id;

  // Past reports for tracking
  const {
    data: myReports,
    isLoading: isReportsLoading,
    refetch: refetchReports,
    isRefetching,
  } = useQuery({
    queryKey: ['my-reports', user?.id],
    queryFn: () => api.reports.list({ userId: user?.id }),
    enabled: !!user?.id,
  });

  // Submit report mutation
  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!communityId) throw new Error('No active community joined');
      // 1. Create Report
      const report = await api.reports.create({
        communityId,
        category,
        title,
        description,
        locationAddress,
        clientEventId: `client-rep-${Date.now()}`,
      });

      // 2. Attach Evidence
      if (evidenceUrl) {
        await api.reports.attachEvidence(report.id, {
          mediaUrl: evidenceUrl,
          mediaType: 'IMAGE',
          locationGeoJson: {
            type: 'Point',
            coordinates: [73.818, 18.507],
          },
        });
      }

      return report;
    },
    onSuccess: (report) => {
      Alert.alert(
        'Report Submitted!',
        'Your environmental observation has been routed to the ward maintainers for verification. You will earn +20 EcoPoints upon approval.'
      );
      queryClient.invalidateQueries({ queryKey: ['my-reports'] });
      queryClient.invalidateQueries({ queryKey: ['home-dashboard'] });
      setTitle('');
      setDescription('');
      setTab('TRACK');
    },
    onError: (err: any) => {
      Alert.alert('Submission Failed', err.message || 'Could not file report');
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Environmental Action</Text>
        <View style={{ width: 50 }} />
      </View>

      {/* Mode Switcher */}
      <View style={styles.tabsRow}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'NEW' && styles.tabBtnActive]}
          onPress={() => setTab('NEW')}
        >
          <Text style={[styles.tabBtnText, tab === 'NEW' && styles.tabBtnTextActive]}>
            File Report
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, tab === 'TRACK' && styles.tabBtnActive]}
          onPress={() => setTab('TRACK')}
        >
          <Text style={[styles.tabBtnText, tab === 'TRACK' && styles.tabBtnTextActive]}>
            Track Status ({myReports?.length || 0})
          </Text>
        </TouchableOpacity>
      </View>

      {tab === 'NEW' ? (
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Step 1: Category */}
          <Text style={styles.sectionLabel}>1. Select Hazard Category</Text>
          <View style={styles.categoryGrid}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.value}
                style={[
                  styles.categoryCard,
                  category === cat.value && styles.categoryCardActive,
                ]}
                onPress={() => setCategory(cat.value)}
              >
                <Text style={styles.categoryIcon}>{cat.icon}</Text>
                <Text
                  style={[
                    styles.categoryText,
                    category === cat.value && styles.categoryTextActive,
                  ]}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Step 2: Evidence Photo */}
          <Text style={styles.sectionLabel}>2. Verified Photo Evidence</Text>
          <View style={styles.evidenceContainer}>
            <Image source={{ uri: evidenceUrl }} style={styles.evidencePreview} />
            <View style={styles.evidenceOverlay}>
              <Text style={styles.evidencePill}>📸 Geo-Tagged Photo</Text>
            </View>
          </View>

          <View style={styles.photoPickerRow}>
            {SAMPLE_EVIDENCE_URLS.map((url, idx) => (
              <TouchableOpacity
                key={idx}
                style={[
                  styles.thumbBtn,
                  evidenceUrl === url && styles.thumbBtnActive,
                ]}
                onPress={() => setEvidenceUrl(url)}
              >
                <Image source={{ uri: url }} style={styles.thumbImage} />
              </TouchableOpacity>
            ))}
          </View>

          {/* Step 3: Title & Description */}
          <Text style={styles.sectionLabel}>3. Report Details</Text>
          <Text style={styles.inputTitle}>Title</Text>
          <TextInput
            style={styles.textInput}
            placeholder="e.g. Broken bin spilling plastics onto sidewalk"
            value={title}
            onChangeText={setTitle}
          />

          <Text style={styles.inputTitle}>Description</Text>
          <TextInput
            style={[styles.textInput, { minHeight: 80 }]}
            placeholder="Describe the issue, estimated volume, and public hazard..."
            value={description}
            onChangeText={setDescription}
            multiline
          />

          {/* Step 4: Location */}
          <Text style={styles.sectionLabel}>4. Location</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Street address or landmark"
            value={locationAddress}
            onChangeText={setLocationAddress}
          />

          {/* Submit Action */}
          <TouchableOpacity
            style={[
              styles.submitBtn,
              (!title.trim() || !description.trim() || submitMutation.isPending) &&
                styles.submitBtnDisabled,
            ]}
            onPress={() => submitMutation.mutate()}
            disabled={!title.trim() || !description.trim() || submitMutation.isPending}
          >
            {submitMutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitBtnText}>Submit to Maintainers (+20 pts)</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      ) : (
        /* Status Tracker Tab */
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetchReports} />}
        >
          {isReportsLoading ? (
            <ActivityIndicator size="large" color={colors.primary[900]} style={{ marginTop: 40 }} />
          ) : (!myReports || myReports.length === 0) ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>🌱</Text>
              <Text style={styles.emptyTitle}>No Reports Filed</Text>
              <Text style={styles.emptySub}>
                Spot an environmental issue? File a report to earn EcoPoints and keep your ward clean!
              </Text>
            </View>
          ) : (
            myReports.map((rep) => (
              <View key={rep.id} style={styles.reportCard}>
                <View style={styles.reportHeader}>
                  <Text style={styles.catLabel}>{formatCategory(rep.category)}</Text>
                  <View style={[styles.statusPill, getStatusPill(rep.status)]}>
                    <Text style={styles.statusPillText}>{rep.status}</Text>
                  </View>
                </View>

                <Text style={styles.cardTitle}>{rep.title}</Text>
                <Text style={styles.cardDesc}>{rep.description}</Text>
                {rep.locationAddress && (
                  <Text style={styles.cardLoc}>📍 {rep.locationAddress}</Text>
                )}

                {/* Closed-loop lifecycle progress bar */}
                <View style={styles.lifecycleContainer}>
                  <View style={styles.lifecycleRow}>
                    {getLifecycleSteps(rep.status).map((step, idx) => (
                      <View key={step.name} style={styles.stepItem}>
                        <View
                          style={[
                            styles.stepCircle,
                            step.active && styles.stepCircleActive,
                            step.completed && styles.stepCircleCompleted,
                          ]}
                        >
                          <Text style={styles.stepIcon}>{step.completed ? '✓' : idx + 1}</Text>
                        </View>
                        <Text style={styles.stepName}>{step.name}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                {rep.status === 'VERIFIED' && (
                  <View style={styles.rewardBanner}>
                    <Text style={styles.rewardBannerText}>
                      🎉 Verified by Ward Maintainer! +{rep.pointsReward} EcoPoints credited.
                    </Text>
                  </View>
                )}

                {rep.status === 'RESOLVED' && (
                  <View style={[styles.rewardBanner, { backgroundColor: colors.primary[100] }]}>
                    <Text style={[styles.rewardBannerText, { color: colors.primary[900] }]}>
                      🌟 Field crew completed cleanup. Community hazard resolved!
                    </Text>
                  </View>
                )}
              </View>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function formatCategory(cat: string) {
  return cat.replace('_', ' ');
}

function getStatusPill(status: string) {
  switch (status) {
    case 'VERIFIED':
    case 'RESOLVED':
      return { backgroundColor: colors.primary[100] };
    case 'REJECTED':
      return { backgroundColor: '#FEE2E2' };
    default:
      return { backgroundColor: '#FEF3C7' };
  }
}

function getLifecycleSteps(status: string) {
  const isSubmitted = true;
  const isUnderReview = status !== 'DRAFT';
  const isVerified = status === 'VERIFIED' || status === 'RESOLVED' || status === 'CLOSED';
  const isResolved = status === 'RESOLVED' || status === 'CLOSED';

  return [
    { name: 'Submitted', completed: isUnderReview, active: status === 'SUBMITTED' },
    { name: 'Review', completed: isVerified, active: status === 'UNDER_REVIEW' },
    { name: 'Verified', completed: isVerified, active: status === 'VERIFIED' },
    { name: 'Resolved', completed: isResolved, active: status === 'RESOLVED' },
  ];
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
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface.border,
    backgroundColor: colors.surface.white,
  },
  backBtn: {
    padding: 6,
  },
  backBtnText: {
    color: colors.primary[900],
    fontWeight: '700',
    fontSize: 14,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.neutral[900],
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface.white,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface.border,
    gap: 12,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.neutral[100],
  },
  tabBtnActive: {
    backgroundColor: colors.primary[900],
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.neutral[600],
  },
  tabBtnTextActive: {
    color: colors.surface.white,
  },
  scroll: {
    padding: spacing.base,
    paddingBottom: 50,
  },
  sectionLabel: {
    ...typography.bodyBold,
    color: colors.neutral[900],
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: spacing.base,
  },
  categoryCard: {
    width: '31%',
    backgroundColor: colors.surface.card,
    borderRadius: radius.md,
    padding: spacing.sm,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.surface.border,
  },
  categoryCardActive: {
    borderColor: colors.primary[900],
    backgroundColor: colors.primary[50],
  },
  categoryIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.neutral[700],
    textAlign: 'center',
  },
  categoryTextActive: {
    color: colors.primary[900],
    fontWeight: '700',
  },
  evidenceContainer: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    position: 'relative',
    height: 180,
    marginBottom: 10,
  },
  evidencePreview: {
    width: '100%',
    height: '100%',
  },
  evidenceOverlay: {
    position: 'absolute',
    bottom: 10,
    left: 10,
  },
  evidencePill: {
    backgroundColor: 'rgba(0,0,0,0.65)',
    color: colors.surface.white,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    fontSize: 12,
    fontWeight: '600',
  },
  photoPickerRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: spacing.base,
  },
  thumbBtn: {
    width: 60,
    height: 60,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  thumbBtnActive: {
    borderColor: colors.primary[900],
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  inputTitle: {
    ...typography.caption,
    color: colors.neutral[700],
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  textInput: {
    backgroundColor: colors.surface.white,
    borderWidth: 1,
    borderColor: colors.surface.border,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 14,
    color: colors.neutral[900],
    marginBottom: spacing.base,
  },
  submitBtn: {
    backgroundColor: colors.primary[900],
    paddingVertical: 15,
    borderRadius: radius.lg,
    alignItems: 'center',
    marginTop: spacing.md,
    shadowColor: colors.primary[900],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    color: colors.surface.white,
    fontSize: 16,
    fontWeight: '700',
  },
  emptyCard: {
    alignItems: 'center',
    padding: spacing['2xl'],
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.neutral[900],
  },
  emptySub: {
    fontSize: 13,
    color: colors.neutral[500],
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  reportCard: {
    backgroundColor: colors.surface.card,
    borderRadius: radius.lg,
    padding: spacing.base,
    marginBottom: spacing.base,
    borderWidth: 1,
    borderColor: colors.surface.border,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  catLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary[700],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.neutral[800],
  },
  cardTitle: {
    ...typography.bodyBold,
    color: colors.neutral[900],
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 13,
    color: colors.neutral[600],
    lineHeight: 18,
    marginBottom: 6,
  },
  cardLoc: {
    fontSize: 12,
    color: colors.neutral[500],
    marginBottom: 10,
  },
  lifecycleContainer: {
    backgroundColor: colors.neutral[50],
    borderRadius: radius.md,
    padding: 10,
    marginTop: 6,
    marginBottom: 6,
  },
  lifecycleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stepItem: {
    alignItems: 'center',
    flex: 1,
  },
  stepCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.neutral[200],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  stepCircleActive: {
    backgroundColor: colors.accent.points,
  },
  stepCircleCompleted: {
    backgroundColor: colors.primary[700],
  },
  stepIcon: {
    color: colors.surface.white,
    fontSize: 11,
    fontWeight: '700',
  },
  stepName: {
    fontSize: 10,
    color: colors.neutral[600],
    fontWeight: '500',
  },
  rewardBanner: {
    backgroundColor: colors.accent.pointsBg,
    borderRadius: radius.md,
    padding: 10,
    marginTop: 8,
  },
  rewardBannerText: {
    color: colors.accent.points,
    fontSize: 12,
    fontWeight: '700',
  },
});
