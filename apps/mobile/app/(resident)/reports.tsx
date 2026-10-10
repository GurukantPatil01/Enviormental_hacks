import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../../constants/theme';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/auth.store';

type FilterType = 'ALL' | 'PROCESSING' | 'ANALYZED' | 'REVIEW' | 'RESOLVED';

export default function MyReportsScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [activeFilter, setActiveFilter] = useState<FilterType>('ALL');

  const {
    data: reports = [],
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ['my-reports', user?.id],
    queryFn: () => api.reports.list({ userId: user?.id }),
    enabled: !!user?.id,
  });

  // Calculate live filter counts
  const counts = useMemo(() => {
    let processing = 0;
    let analyzed = 0;
    let review = 0;
    let resolved = 0;

    for (const r of reports) {
      if (r.status === 'RESOLVED') {
        resolved++;
      } else if (r.status === 'FLAGGED_FOR_REVIEW' || r.status === 'REVIEW_REQUIRED') {
        review++;
      } else if (r.status === 'ANALYZED') {
        analyzed++;
      } else {
        processing++;
      }
    }

    return {
      all: reports.length,
      processing,
      analyzed,
      review,
      resolved,
    };
  }, [reports]);

  // Filtered reports
  const filteredReports = useMemo(() => {
    switch (activeFilter) {
      case 'PROCESSING':
        return reports.filter(
          (r) =>
            r.status === 'SUBMITTED' ||
            r.status === 'PENDING' ||
            r.status === 'PROCESSING' ||
            r.status === 'IN_PROGRESS'
        );
      case 'ANALYZED':
        return reports.filter((r) => r.status === 'ANALYZED');
      case 'REVIEW':
        return reports.filter(
          (r) => r.status === 'FLAGGED_FOR_REVIEW' || r.status === 'REVIEW_REQUIRED'
        );
      case 'RESOLVED':
        return reports.filter((r) => r.status === 'RESOLVED');
      default:
        return reports;
    }
  }, [reports, activeFilter]);

  const formatReportDate = (isoString?: string) => {
    if (!isoString) return 'Today';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return 'Recently';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ANALYZED':
        return {
          bg: theme.colors.status.analyzedBg,
          text: theme.colors.status.analyzedText,
          label: 'Analyzed',
          icon: 'bar-chart',
        };
      case 'FLAGGED_FOR_REVIEW':
      case 'REVIEW_REQUIRED':
        return {
          bg: theme.colors.status.reviewBg,
          text: theme.colors.status.reviewText,
          label: 'Needs Review',
          icon: 'search',
        };
      case 'RESOLVED':
        return {
          bg: theme.colors.status.resolvedBg,
          text: theme.colors.status.resolvedText,
          label: 'Resolved',
          icon: 'checkmark-circle',
        };
      case 'IN_PROGRESS':
      case 'PROCESSING':
        return {
          bg: theme.colors.status.processingBg,
          text: theme.colors.status.processingText,
          label: 'Processing',
          icon: 'time',
        };
      default:
        return {
          bg: theme.colors.status.pendingBg,
          text: theme.colors.status.pendingText,
          label: 'Processing',
          icon: 'time',
        };
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header matching Screenshot 2 */}
      <View style={styles.header}>
        <Text style={styles.pageTitle}>My Reports</Text>
        <Text style={styles.pageSubtitle}>Track the status of your reports</Text>

        {/* Filter Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
          style={styles.filterScrollView}
        >
          {/* All */}
          <TouchableOpacity
            style={[styles.filterChip, activeFilter === 'ALL' && styles.filterChipActive]}
            onPress={() => setActiveFilter('ALL')}
            activeOpacity={0.8}
          >
            <Text style={[styles.filterChipText, activeFilter === 'ALL' && styles.filterChipTextActive]}>
              All
            </Text>
            <View style={[styles.countBadge, activeFilter === 'ALL' && styles.countBadgeActive]}>
              <Text style={[styles.countBadgeText, activeFilter === 'ALL' && styles.countBadgeTextActive]}>
                {counts.all}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Processing */}
          <TouchableOpacity
            style={[styles.filterChip, activeFilter === 'PROCESSING' && styles.filterChipActive]}
            onPress={() => setActiveFilter('PROCESSING')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.filterChipText,
                activeFilter === 'PROCESSING' && styles.filterChipTextActive,
              ]}
            >
              Processing
            </Text>
            <View style={[styles.countBadge, activeFilter === 'PROCESSING' && styles.countBadgeActive]}>
              <Text
                style={[
                  styles.countBadgeText,
                  activeFilter === 'PROCESSING' && styles.countBadgeTextActive,
                ]}
              >
                {counts.processing}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Analyzed */}
          <TouchableOpacity
            style={[styles.filterChip, activeFilter === 'ANALYZED' && styles.filterChipActive]}
            onPress={() => setActiveFilter('ANALYZED')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.filterChipText,
                activeFilter === 'ANALYZED' && styles.filterChipTextActive,
              ]}
            >
              Analyzed
            </Text>
            <View style={[styles.countBadge, activeFilter === 'ANALYZED' && styles.countBadgeActive]}>
              <Text
                style={[
                  styles.countBadgeText,
                  activeFilter === 'ANALYZED' && styles.countBadgeTextActive,
                ]}
              >
                {counts.analyzed}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Needs Review */}
          <TouchableOpacity
            style={[styles.filterChip, activeFilter === 'REVIEW' && styles.filterChipActive]}
            onPress={() => setActiveFilter('REVIEW')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.filterChipText,
                activeFilter === 'REVIEW' && styles.filterChipTextActive,
              ]}
            >
              Needs Review
            </Text>
            <View style={[styles.countBadge, activeFilter === 'REVIEW' && styles.countBadgeActive]}>
              <Text
                style={[
                  styles.countBadgeText,
                  activeFilter === 'REVIEW' && styles.countBadgeTextActive,
                ]}
              >
                {counts.review}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Resolved */}
          <TouchableOpacity
            style={[styles.filterChip, activeFilter === 'RESOLVED' && styles.filterChipActive]}
            onPress={() => setActiveFilter('RESOLVED')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.filterChipText,
                activeFilter === 'RESOLVED' && styles.filterChipTextActive,
              ]}
            >
              Resolved
            </Text>
            <View style={[styles.countBadge, activeFilter === 'RESOLVED' && styles.countBadgeActive]}>
              <Text
                style={[
                  styles.countBadgeText,
                  activeFilter === 'RESOLVED' && styles.countBadgeTextActive,
                ]}
              >
                {counts.resolved}
              </Text>
            </View>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Main Content List */}
      {isLoading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Fetching your reports...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              colors={[theme.colors.primary]}
            />
          }
        >
          {filteredReports.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="folder-open-outline" size={36} color={theme.colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>No reports found</Text>
              <Text style={styles.emptySub}>
                {activeFilter === 'ALL'
                  ? 'You haven’t submitted any waste reports yet.'
                  : `No reports currently in ${activeFilter.toLowerCase()} status.`}
              </Text>
              <TouchableOpacity
                style={styles.newReportBtn}
                onPress={() => router.push('/(resident)/report')}
                activeOpacity={0.8}
              >
                <Ionicons name="camera" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.newReportBtnText}>Submit New Report</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.cardsList}>
              {filteredReports.map((report) => {
                const badge = getStatusBadge(report.status);
                const thumb = report.evidence?.[0]?.mediaUrl;

                return (
                  <TouchableOpacity
                    key={report.id}
                    style={styles.reportCard}
                    onPress={() => router.push(`/(resident)/report/${report.id}` as any)}
                    activeOpacity={0.85}
                  >
                    {/* Square Image Thumbnail */}
                    <View style={styles.thumbBox}>
                      {thumb ? (
                        <Image source={{ uri: thumb }} style={styles.thumbImg} />
                      ) : (
                        <View style={styles.thumbPlaceholder}>
                          <Ionicons name="image-outline" size={26} color={theme.colors.textTertiary} />
                        </View>
                      )}
                    </View>

                    {/* Details Column matching Screenshot 2 */}
                    <View style={styles.cardDetails}>
                      <Text style={styles.cardTitle} numberOfLines={1}>
                        {report.title || 'Waste report'}
                      </Text>

                      {/* Status Badge */}
                      <View style={[styles.badgePill, { backgroundColor: badge.bg }]}>
                        <Ionicons
                          name={badge.icon as any}
                          size={11}
                          color={badge.text}
                          style={{ marginRight: 4 }}
                        />
                        <Text style={[styles.badgeText, { color: badge.text }]}>
                          {badge.label}
                        </Text>
                      </View>

                      {/* Location with Pin */}
                      <View style={styles.metaRow}>
                        <Ionicons name="location-outline" size={13} color={theme.colors.textSecondary} />
                        <Text style={styles.metaText} numberOfLines={1}>
                          {report.locationAddress || 'Pimpri Colony, Pune Division'}
                        </Text>
                      </View>

                      {/* Date with Calendar */}
                      <View style={styles.metaRow}>
                        <Ionicons name="calendar-outline" size={13} color={theme.colors.textSecondary} />
                        <Text style={styles.metaText}>{formatReportDate(report.createdAt)}</Text>
                      </View>
                    </View>

                    {/* Right Chevron */}
                    <Ionicons name="chevron-forward" size={18} color={theme.colors.textTertiary} />
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    backgroundColor: theme.colors.background,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: theme.colors.forest,
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 2,
    marginBottom: theme.spacing.md,
  },
  filterScrollView: {
    marginHorizontal: -theme.spacing.lg,
  },
  filterScroll: {
    paddingHorizontal: theme.spacing.lg,
    gap: 8,
    flexDirection: 'row',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.radius.full,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  filterChipActive: {
    backgroundColor: theme.colors.forest,
    borderColor: theme.colors.forest,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  countBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  countBadgeActive: {
    backgroundColor: '#1C5242',
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  countBadgeTextActive: {
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
  },
  centerLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  cardsList: {
    gap: 12,
  },
  reportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: theme.radius.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.card,
  },
  thumbBox: {
    width: 72,
    height: 72,
    borderRadius: theme.radius.md,
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
    marginRight: 12,
  },
  thumbImg: {
    width: '100%',
    height: '100%',
  },
  thumbPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardDetails: {
    flex: 1,
    marginRight: 6,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.forest,
    marginBottom: 4,
  },
  badgePill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  metaText: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    flex: 1,
  },
  emptyContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: theme.radius.xl,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginTop: 20,
    ...theme.shadows.card,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.forest,
    marginBottom: 4,
  },
  emptySub: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 18,
  },
  newReportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: theme.radius.full,
  },
  newReportBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
