import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React from 'react';
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

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuthStore();

  const {
    data: dashboardData,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ['home-dashboard'],
    queryFn: () => api.me.get(),
  });

  const { data: userReports = [], refetch: refetchReports } = useQuery({
    queryKey: ['my-reports', user?.id],
    queryFn: () => api.reports.list({ userId: user?.id }),
    enabled: !!user?.id,
  });

  const handleRefresh = async () => {
    await Promise.all([refetch(), refetchReports()]);
  };

  React.useEffect(() => {
    if (dashboardData?.user && dashboardData.user.id !== user?.id) {
      const token = useAuthStore.getState().token;
      if (token) {
        useAuthStore.getState().setAuth(token, dashboardData.user);
      }
    }
  }, [dashboardData?.user?.id, user?.id]);

  const impact = dashboardData?.impactStats || {
    reportsCount: userReports.length,
    verifiedCount: userReports.filter(
      (r) => r.status === 'VERIFIED' || r.status === 'RESOLVED' || r.status === 'ANALYZED'
    ).length,
    resolvedCount: userReports.filter((r) => r.status === 'RESOLVED').length,
    pointsBalance: dashboardData?.pointBalance ?? 0,
  };

  const recentReports = userReports.slice(0, 4);
  const userInitial = user?.fullName ? user.fullName.charAt(0).toUpperCase() : 'G';

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
          label: 'Submitted',
          icon: 'document-text',
        };
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* 1. Header Bar matching Screenshot 4 */}
      <View style={styles.topHeader}>
        <View style={styles.brandRow}>
          <View style={styles.logoBadge}>
            <Ionicons name="leaf" size={20} color={theme.colors.primary} />
          </View>
          <View>
            <Text style={styles.brandName}>EcoPulse</Text>
            <Text style={styles.brandSubtitle}>Guarding Pune's Environment</Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.iconCircle}
            onPress={() => router.push('/(resident)/activity')}
            activeOpacity={0.7}
          >
            <Ionicons name="notifications-outline" size={20} color={theme.colors.forest} />
            <View style={styles.notifDot} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.avatarCircle}
            onPress={() => router.push('/(resident)/profile')}
            activeOpacity={0.7}
          >
            <Text style={styles.avatarInitial}>{userInitial}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={handleRefresh}
            colors={[theme.colors.primary]}
          />
        }
      >
        {/* 2. Environmental Campaign Hero Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroOverlay}>
            <View style={styles.heroTagPill}>
              <Text style={styles.heroTagText}>KEEP PUNE CLEAN</Text>
            </View>
            <Text style={styles.heroTitle}>A cleaner future starts with you</Text>
            <Text style={styles.heroDescription}>
              Report waste, protect our environment, and help build a better community.
            </Text>
          </View>
        </View>

        {/* 3. Prominent "Report Waste" Card */}
        <TouchableOpacity
          style={styles.reportActionCard}
          onPress={() => router.push('/(resident)/report')}
          activeOpacity={0.9}
        >
          <View style={styles.reportCardLeft}>
            <View style={styles.phoneIconWrap}>
              <Ionicons name="camera" size={24} color={theme.colors.primary} />
            </View>
            <View style={styles.reportCardTextWrap}>
              <Text style={styles.reportCardTitle}>Report Waste</Text>
              <Text style={styles.reportCardDesc}>
                See waste? Take a photo and report it. It only takes a few seconds.
              </Text>
            </View>
          </View>

          <View style={styles.actionArrowBtn}>
            <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
          </View>
        </TouchableOpacity>

        {/* 4. "Your Impact" Section */}
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="leaf-outline" size={18} color={theme.colors.primary} />
            <Text style={styles.sectionTitle}>Your Impact</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/(resident)/impact')}
            activeOpacity={0.7}
          >
            <Text style={styles.viewMoreText}>View more ›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.impactGrid}>
          {/* Card 1: Reports */}
          <View style={[styles.impactCard, { backgroundColor: theme.colors.impact.reportsBg }]}>
            <Ionicons
              name="document-text-outline"
              size={20}
              color={theme.colors.impact.reportsIcon}
            />
            <Text style={[styles.impactValue, { color: theme.colors.impact.reportsText }]}>
              {impact.reportsCount}
            </Text>
            <Text style={[styles.impactLabel, { color: theme.colors.impact.reportsText }]}>
              Reports
            </Text>
          </View>

          {/* Card 2: Verified */}
          <View style={[styles.impactCard, { backgroundColor: theme.colors.impact.verifiedBg }]}>
            <Ionicons
              name="shield-checkmark-outline"
              size={20}
              color={theme.colors.impact.verifiedIcon}
            />
            <Text style={[styles.impactValue, { color: theme.colors.impact.verifiedText }]}>
              {impact.verifiedCount}
            </Text>
            <Text style={[styles.impactLabel, { color: theme.colors.impact.verifiedText }]}>
              Verified
            </Text>
          </View>

          {/* Card 3: Resolved */}
          <View style={[styles.impactCard, { backgroundColor: theme.colors.impact.resolvedBg }]}>
            <Ionicons
              name="leaf-outline"
              size={20}
              color={theme.colors.impact.resolvedIcon}
            />
            <Text style={[styles.impactValue, { color: theme.colors.impact.resolvedText }]}>
              {impact.resolvedCount}
            </Text>
            <Text style={[styles.impactLabel, { color: theme.colors.impact.resolvedText }]}>
              Resolved
            </Text>
          </View>

          {/* Card 4: Eco Points (Tappable shortcut to Redeem Rewards) */}
          <TouchableOpacity
            style={[styles.impactCard, { backgroundColor: theme.colors.impact.pointsBg }]}
            onPress={() => router.push('/(resident)/rewards')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="star-outline"
              size={20}
              color={theme.colors.impact.pointsIcon}
            />
            <Text style={[styles.impactValue, { color: theme.colors.impact.pointsText }]}>
              {impact.pointsBalance}
            </Text>
            <View style={styles.pointsLabelRow}>
              <Text style={[styles.impactLabel, { color: theme.colors.impact.pointsText }]}>
                Eco Points
              </Text>
              <Text style={styles.redeemHintText}>Redeem ›</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Quick Civic Actions: Leaderboard & Redeem Rewards */}
        <View style={styles.quickActionsRow}>
          {/* Action 1: Leaderboard */}
          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={() => router.push('/(resident)/leaderboard')}
            activeOpacity={0.85}
          >
            <View style={[styles.quickActionIconWrap, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="trophy" size={20} color="#D97706" />
            </View>
            <View style={styles.quickActionTextCol}>
              <Text style={styles.quickActionTitle}>Civic Leaderboard</Text>
              <Text style={styles.quickActionSub}>Ward rankings & top citizens</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.colors.forest} />
          </TouchableOpacity>

          {/* Action 2: Redeem Rewards */}
          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={() => router.push('/(resident)/rewards')}
            activeOpacity={0.85}
          >
            <View style={[styles.quickActionIconWrap, { backgroundColor: '#F0FDF4' }]}>
              <Ionicons name="gift" size={20} color={theme.colors.primary} />
            </View>
            <View style={styles.quickActionTextCol}>
              <Text style={styles.quickActionTitle}>Redeem Vouchers</Text>
              <Text style={styles.quickActionSub}>Bus, Metro & Zoo discounts</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.colors.forest} />
          </TouchableOpacity>
        </View>

        {/* 5. "Recent Reports" Section */}
        <View style={[styles.sectionHeaderRow, { marginTop: theme.spacing.lg }]}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="time-outline" size={18} color={theme.colors.primary} />
            <Text style={styles.sectionTitle}>Recent Reports</Text>
          </View>
          {recentReports.length > 0 && (
            <TouchableOpacity
              onPress={() => router.push('/(resident)/reports')}
              activeOpacity={0.7}
            >
              <Text style={styles.viewMoreText}>See all ›</Text>
            </TouchableOpacity>
          )}
        </View>

        {isLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <Text style={styles.loadingText}>Loading reports...</Text>
          </View>
        ) : recentReports.length === 0 ? (
          /* Empty state matching Screenshot 4 */
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="search-outline" size={32} color={theme.colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>No reports yet</Text>
            <Text style={styles.emptySubtitle}>
              See waste? Take a photo and help keep Pune clean.
            </Text>
            <TouchableOpacity
              style={styles.emptyReportBtn}
              onPress={() => router.push('/(resident)/report')}
              activeOpacity={0.8}
            >
              <Text style={styles.emptyReportBtnText}>Report Waste</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* List of recent reports */
          <View style={styles.reportsList}>
            {recentReports.map((report) => {
              const badge = getStatusBadge(report.status);
              const evidenceThumb = report.evidence?.[0]?.mediaUrl;

              return (
                <TouchableOpacity
                  key={report.id}
                  style={styles.reportRowCard}
                  onPress={() => router.push(`/(resident)/report/${report.id}` as any)}
                  activeOpacity={0.85}
                >
                  {/* Square thumbnail image */}
                  <View style={styles.thumbWrap}>
                    {evidenceThumb ? (
                      <Image source={{ uri: evidenceThumb }} style={styles.thumbImage} />
                    ) : (
                      <View style={styles.thumbPlaceholder}>
                        <Ionicons name="trash-bin-outline" size={24} color={theme.colors.textTertiary} />
                      </View>
                    )}
                  </View>

                  {/* Details column */}
                  <View style={styles.reportInfoCol}>
                    <View style={styles.titleStatusRow}>
                      <Text style={styles.reportRowTitle} numberOfLines={1}>
                        {report.title || 'Waste report'}
                      </Text>
                    </View>

                    {/* Status Pill Badge */}
                    <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                      <Ionicons name={badge.icon as any} size={11} color={badge.text} style={{ marginRight: 4 }} />
                      <Text style={[styles.statusBadgeText, { color: badge.text }]}>
                        {badge.label}
                      </Text>
                    </View>

                    {/* Location */}
                    <View style={styles.metaRow}>
                      <Ionicons name="location-outline" size={13} color={theme.colors.textSecondary} />
                      <Text style={styles.metaText} numberOfLines={1}>
                        {report.locationAddress || 'Pune Municipal Corporation'}
                      </Text>
                    </View>

                    {/* Date */}
                    <View style={styles.metaRow}>
                      <Ionicons name="calendar-outline" size={13} color={theme.colors.textSecondary} />
                      <Text style={styles.metaText}>{formatReportDate(report.createdAt)}</Text>
                    </View>
                  </View>

                  <Ionicons name="chevron-forward" size={18} color={theme.colors.textTertiary} />
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Bottom spacing */}
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.background,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: theme.colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#C6F6D5',
  },
  brandName: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.forest,
    letterSpacing: -0.3,
  },
  brandSubtitle: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notifDot: {
    position: 'absolute',
    top: 7,
    right: 8,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.primary,
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.primarySubtle,
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
  },
  heroCard: {
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.forest,
    marginBottom: theme.spacing.base,
    overflow: 'hidden',
    ...theme.shadows.card,
  },
  heroOverlay: {
    padding: theme.spacing.lg,
    backgroundColor: '#0F3E30',
  },
  heroTagPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  heroTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#86EFAC',
    letterSpacing: 0.8,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 6,
    letterSpacing: -0.3,
    lineHeight: 26,
  },
  heroDescription: {
    fontSize: 13,
    color: '#D1FAE5',
    lineHeight: 18,
  },
  reportActionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EDF7F2',
    borderRadius: theme.radius.xl,
    padding: theme.spacing.base,
    marginBottom: theme.spacing.lg,
    borderWidth: 1,
    borderColor: '#CDE5D8',
    ...theme.shadows.card,
  },
  reportCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 10,
  },
  phoneIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#C6F6D5',
  },
  reportCardTextWrap: {
    flex: 1,
  },
  reportCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.forest,
    marginBottom: 2,
  },
  reportCardDesc: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    lineHeight: 16,
  },
  actionArrowBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.forest,
    letterSpacing: -0.2,
  },
  viewMoreText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  impactGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: theme.spacing.base,
  },
  impactCard: {
    flex: 1,
    borderRadius: theme.radius.lg,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.03)',
  },
  impactValue: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 6,
    marginBottom: 2,
  },
  impactLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  pointsLabelRow: {
    alignItems: 'center',
  },
  redeemHintText: {
    fontSize: 9,
    fontWeight: '800',
    color: theme.colors.primary,
    marginTop: 2,
  },
  quickActionsRow: {
    flexDirection: 'column',
    gap: 10,
    marginBottom: theme.spacing.base,
  },
  quickActionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.card,
  },
  quickActionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  quickActionTextCol: {
    flex: 1,
  },
  quickActionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.forest,
  },
  quickActionSub: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 1,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.card,
  },
  emptyIconWrap: {
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
  emptySubtitle: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 18,
  },
  emptyReportBtn: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: theme.radius.full,
  },
  emptyReportBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  reportsList: {
    gap: 12,
  },
  reportRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: theme.radius.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.card,
  },
  thumbWrap: {
    width: 64,
    height: 64,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    backgroundColor: '#F1F5F9',
    marginRight: 12,
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  thumbPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportInfoCol: {
    flex: 1,
    marginRight: 8,
  },
  titleStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  reportRowTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.forest,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 6,
  },
  statusBadgeText: {
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
  loadingBox: {
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
});
