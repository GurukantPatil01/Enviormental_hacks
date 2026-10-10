import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../../../constants/theme';
import { api } from '../../../lib/api';

export default function ReportDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [isFollowing, setIsFollowing] = useState(false);

  const {
    data: report,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['report-detail', id],
    queryFn: () => api.reports.get(id as string),
    enabled: !!id,
    refetchInterval: (query) => {
      // Auto-poll while report is processing or pending
      const status = query.state.data?.status;
      if (status === 'SUBMITTED' || status === 'PENDING') {
        return 3000;
      }
      return false;
    },
  });

  const handleShare = async () => {
    if (!report) return;
    try {
      await Share.share({
        title: report.title || 'EcoPulse Waste Report',
        message: `Check this environmental report on EcoPulse: ${report.title} (#ECO-${report.id.slice(0, 7).toUpperCase()}) at ${report.locationAddress || 'Unknown location'}`,
      });
    } catch (err: any) {
      console.warn('Share error:', err);
    }
  };

  const handleFollowUpdates = () => {
    setIsFollowing((prev) => !prev);
    Alert.alert(
      isFollowing ? 'Unfollowed' : 'Following Updates',
      isFollowing
        ? 'You will no longer receive push notifications for this report.'
        : 'You will receive immediate notifications when this report status changes or cleanup is scheduled.'
    );
  };

  const formatReportDate = (isoString?: string) => {
    if (!isoString) return 'Just now';
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
          icon: 'bar-chart' as const,
        };
      case 'FLAGGED_FOR_REVIEW':
      case 'REVIEW_REQUIRED':
        return {
          bg: theme.colors.status.reviewBg,
          text: theme.colors.status.reviewText,
          label: 'Needs Review',
          icon: 'search' as const,
        };
      case 'RESOLVED':
        return {
          bg: theme.colors.status.resolvedBg,
          text: theme.colors.status.resolvedText,
          label: 'Resolved',
          icon: 'checkmark-circle' as const,
        };
      case 'IN_PROGRESS':
      case 'PROCESSING':
        return {
          bg: theme.colors.status.processingBg,
          text: theme.colors.status.processingText,
          label: 'Processing',
          icon: 'time' as const,
        };
      default:
        return {
          bg: theme.colors.status.pendingBg,
          text: theme.colors.status.pendingText,
          label: 'Submitted',
          icon: 'hourglass' as const,
        };
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.forest} />
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>Report Details</Text>
          </View>
          <View style={{ width: 36 }} />
        </View>
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading report details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !report) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.forest} />
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>Report Details</Text>
          </View>
          <View style={{ width: 36 }} />
        </View>
        <View style={styles.centerBox}>
          <Ionicons name="alert-circle-outline" size={48} color={theme.colors.status.reviewText} />
          <Text style={styles.errorTitle}>Report Not Found</Text>
          <Text style={styles.errorSub}>The requested report could not be found or has been removed.</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
            <Text style={styles.retryBtnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const badge = getStatusBadge(report.status);
  const mediaUrl = report.evidence?.[0]?.mediaUrl;
  const shortId = `#ECO-${report.id.slice(0, 7).toUpperCase()}`;

  // AI findings from authoritative backend (aiFindings or aiObservation)
  const aiFindings = (report as any).aiFindings || (report as any).aiObservation?.findings;
  const isWasteDetected = aiFindings ? aiFindings.wasteDetected === true : report.status === 'ANALYZED';
  const aiConfidence = aiFindings?.confidenceScore ? `${Math.round(aiFindings.confidenceScore * 100)}%` : null;

  // Coordinates
  const coords = (report.locationGeoJson as any)?.coordinates;
  const longitude = coords ? coords[0] : null;
  const latitude = coords ? coords[1] : null;

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.forest} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Report Details</Text>
          <Text style={styles.headerSubId}>{shortId}</Text>
        </View>
        <TouchableOpacity
          style={styles.moreBtn}
          activeOpacity={0.7}
          onPress={() => {
            Alert.alert(shortId, `Status: ${report.status}\nCreated: ${formatReportDate(report.createdAt)}`);
          }}
        >
          <Ionicons name="ellipsis-horizontal" size={22} color={theme.colors.forest} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
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
        {/* Main Photo Card with Status Overlay */}
        <View style={styles.photoCard}>
          {mediaUrl ? (
            <Image source={{ uri: mediaUrl }} style={styles.photoImg} resizeMode="cover" />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Ionicons name="image-outline" size={48} color={theme.colors.textMuted} />
              <Text style={styles.photoPlaceholderText}>No photo evidence</Text>
            </View>
          )}

          {/* Status Badge Tag */}
          <View style={[styles.statusBadgeOverlay, { backgroundColor: badge.bg }]}>
            <Ionicons name={badge.icon} size={13} color={badge.text} style={{ marginRight: 5 }} />
            <Text style={[styles.statusBadgeText, { color: badge.text }]}>{badge.label}</Text>
          </View>
        </View>

        {/* Title & Metadata Card */}
        <View style={styles.metaCard}>
          <Text style={styles.reportTitle}>{report.title || 'Waste report'}</Text>

          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={16} color={theme.colors.primary} />
            <Text style={styles.metaText} numberOfLines={1}>
              {report.locationAddress || 'Pimpri Colony, Pune Division'}
            </Text>
          </View>

          <View style={styles.metaRow}>
            <Ionicons name="calendar-outline" size={16} color={theme.colors.textSecondary} />
            <Text style={styles.metaText}>{formatReportDate(report.createdAt)}</Text>
          </View>

          {report.description ? (
            <View style={styles.descWrap}>
              <Text style={styles.descText}>{report.description}</Text>
            </View>
          ) : null}
        </View>

        {/* AI Findings Card (Screenshot 3 & 5 style) */}
        <View style={styles.aiCard}>
          <View style={styles.aiCardIconBox}>
            <Ionicons
              name={isWasteDetected ? 'sparkles' : 'search'}
              size={22}
              color={isWasteDetected ? theme.colors.primary : theme.colors.forest}
            />
          </View>
          <View style={styles.aiCardContent}>
            <Text style={styles.aiCardTitle}>
              {isWasteDetected
                ? aiFindings?.secondaryWasteTypes?.length
                  ? `Waste detected: ${aiFindings.secondaryWasteTypes.join(', ')}`
                  : 'Waste detected'
                : 'No waste detected'}
            </Text>
            <Text style={styles.aiCardSub}>
              {isWasteDetected
                ? aiFindings?.explanation ||
                  'The AI detected environmental waste at this site. A verification task has been registered.'
                : aiFindings?.explanation ||
                  'The AI did not find waste in this photo. If this is a mistake, please send a new photo.'}
            </Text>

            {aiConfidence && (
              <View style={styles.aiScoreRow}>
                <Text style={styles.aiScoreLabel}>AI Confidence:</Text>
                <Text style={styles.aiScoreValue}>{aiConfidence}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Report Status Vertical Timeline (Screenshots 3 & 5) */}
        <View style={styles.timelineCard}>
          <View style={styles.timelineHeader}>
            <Ionicons name="shield-checkmark-outline" size={20} color={theme.colors.primary} />
            <Text style={styles.timelineTitle}>Report Status</Text>
          </View>

          {/* Step 1: Report submitted */}
          <View style={styles.stepRow}>
            <View style={styles.stepIndicatorCol}>
              <View style={[styles.stepCircle, styles.stepCircleCompleted]}>
                <Ionicons name="checkmark" size={12} color="#FFFFFF" />
              </View>
              <View style={[styles.stepLine, styles.stepLineActive]} />
            </View>
            <View style={styles.stepContentCol}>
              <Text style={styles.stepName}>Report submitted</Text>
              <Text style={styles.stepTime}>{formatReportDate(report.createdAt)}</Text>
              <Text style={styles.stepDesc}>Your report has been received.</Text>
            </View>
          </View>

          {/* Step 2: AI analysis completed */}
          <View style={styles.stepRow}>
            <View style={styles.stepIndicatorCol}>
              <View
                style={[
                  styles.stepCircle,
                  report.status !== 'SUBMITTED' ? styles.stepCircleCompleted : styles.stepCirclePending,
                ]}
              >
                {report.status !== 'SUBMITTED' ? (
                  <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                ) : (
                  <View style={styles.stepInnerDot} />
                )}
              </View>
              <View
                style={[
                  styles.stepLine,
                  report.status !== 'SUBMITTED' ? styles.stepLineActive : styles.stepLineInactive,
                ]}
              />
            </View>
            <View style={styles.stepContentCol}>
              <Text style={styles.stepName}>
                {report.status === 'SUBMITTED' ? 'AI analysis pending' : 'AI analysis completed'}
              </Text>
              <Text style={styles.stepTime}>{formatReportDate(report.createdAt)}</Text>
              <Text style={styles.stepDesc}>
                {isWasteDetected
                  ? 'Waste was verified by vision intelligence.'
                  : 'No waste was detected in this photo.'}
              </Text>
            </View>
          </View>

          {/* Step 3: Waiting for team review */}
          <View style={styles.stepRow}>
            <View style={styles.stepIndicatorCol}>
              <View
                style={[
                  styles.stepCircle,
                  report.status === 'RESOLVED' || report.status === 'IN_PROGRESS'
                    ? styles.stepCircleCompleted
                    : styles.stepCircleCurrent,
                ]}
              >
                {report.status === 'RESOLVED' || report.status === 'IN_PROGRESS' ? (
                  <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                ) : (
                  <View style={styles.stepCurrentRing} />
                )}
              </View>
              <View
                style={[
                  styles.stepLine,
                  report.status === 'RESOLVED' || report.status === 'IN_PROGRESS'
                    ? styles.stepLineActive
                    : styles.stepLineInactive,
                ]}
              />
            </View>
            <View style={styles.stepContentCol}>
              <Text style={styles.stepName}>
                {report.status === 'RESOLVED' ? 'Maintainer approved' : 'Waiting for team review'}
              </Text>
              <Text style={styles.stepDesc}>
                {isWasteDetected
                  ? 'A local officer is reviewing this report to dispatch a sanitation crew.'
                  : 'The AI could not verify this report on its own, so our team will check it:'}
              </Text>
              {!isWasteDetected && (
                <View style={styles.bulletList}>
                  <Text style={styles.bulletItem}>• No waste was found in the photo</Text>
                  <Text style={styles.bulletItem}>• It doesn’t look like a public place</Text>
                </View>
              )}
            </View>
          </View>

          {/* Step 4: Cleanup */}
          <View style={styles.stepRow}>
            <View style={styles.stepIndicatorCol}>
              <View
                style={[
                  styles.stepCircle,
                  report.status === 'RESOLVED' ? styles.stepCircleCompleted : styles.stepCirclePending,
                ]}
              >
                {report.status === 'RESOLVED' ? (
                  <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                ) : null}
              </View>
              <View
                style={[
                  styles.stepLine,
                  report.status === 'RESOLVED' ? styles.stepLineActive : styles.stepLineInactive,
                ]}
              />
            </View>
            <View style={styles.stepContentCol}>
              <Text style={styles.stepName}>Cleanup</Text>
              <Text style={styles.stepDesc}>
                {report.status === 'RESOLVED'
                  ? 'Cleanup action completed.'
                  : 'A municipality team will be assigned to clean it up.'}
              </Text>
            </View>
          </View>

          {/* Step 5: Resolved */}
          <View style={styles.stepRow}>
            <View style={styles.stepIndicatorCol}>
              <View
                style={[
                  styles.stepCircle,
                  report.status === 'RESOLVED' ? styles.stepCircleCompleted : styles.stepCirclePending,
                ]}
              >
                {report.status === 'RESOLVED' ? (
                  <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                ) : null}
              </View>
            </View>
            <View style={styles.stepContentCol}>
              <Text style={styles.stepName}>Resolved</Text>
              <Text style={styles.stepDesc}>
                {report.status === 'RESOLVED'
                  ? 'Report verified and resolved. Thank you for your contribution!'
                  : 'Not yet\nYou will be notified when the issue is resolved.'}
              </Text>
            </View>
          </View>
        </View>

        {/* Location Card with Map Preview */}
        <View style={styles.locationCard}>
          <View style={styles.locationInfoCol}>
            <View style={styles.locationHeaderRow}>
              <Ionicons name="location" size={18} color={theme.colors.primary} />
              <Text style={styles.locationTitle}>Location</Text>
            </View>
            <Text style={styles.locationAddressText}>
              {report.locationAddress || 'Pimpri Colony, Pune Division'}
            </Text>
            {latitude && longitude ? (
              <Text style={styles.locationCoordsText}>
                {latitude.toFixed(4)}, {longitude.toFixed(4)}
              </Text>
            ) : null}
            <Text style={styles.locationAccuracyText}>Accuracy ±22 m</Text>
          </View>

          {/* Mini map preview block */}
          <TouchableOpacity
            style={styles.miniMapPreview}
            onPress={() => router.push('/(resident)/map')}
            activeOpacity={0.8}
          >
            <View style={styles.miniMapPinCircle}>
              <Ionicons name="location-sharp" size={16} color="#FFFFFF" />
            </View>
            <View style={styles.viewOnMapPill}>
              <Ionicons name="map-outline" size={12} color={theme.colors.forest} style={{ marginRight: 3 }} />
              <Text style={styles.viewOnMapText}>View on Map</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Floating Bottom Actions (Share Report & Follow Updates) */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.shareBtn}
          onPress={handleShare}
          activeOpacity={0.8}
        >
          <Ionicons name="share-outline" size={18} color={theme.colors.forest} style={{ marginRight: 6 }} />
          <Text style={styles.shareBtnText}>Share Report</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.followBtn, isFollowing && styles.followBtnActive]}
          onPress={handleFollowUpdates}
          activeOpacity={0.8}
        >
          <Ionicons
            name={isFollowing ? 'notifications-off-outline' : 'notifications-outline'}
            size={18}
            color="#FFFFFF"
            style={{ marginRight: 6 }}
          />
          <Text style={styles.followBtnText}>
            {isFollowing ? 'Following' : 'Follow Updates'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background, // #F4F8F5
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: '#FFFFFF',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0FDF4',
  },
  headerTitleWrap: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: theme.colors.forest,
  },
  headerSubId: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: '600',
    marginTop: 1,
  },
  moreBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.forest,
    marginTop: 12,
  },
  errorSub: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 16,
  },
  retryBtn: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },

  // Photo Card
  photoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
    position: 'relative',
    height: 240,
    ...theme.shadows.card,
  },
  photoImg: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  photoPlaceholderText: {
    marginTop: 8,
    fontSize: 13,
    color: theme.colors.textMuted,
  },
  statusBadgeOverlay: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },

  // Meta Card
  metaCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.card,
  },
  reportTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.forest,
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  metaText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontWeight: '500',
    marginLeft: 8,
    flex: 1,
  },
  descWrap: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  descText: {
    fontSize: 13,
    color: theme.colors.textPrimary,
    lineHeight: 19,
  },

  // AI findings Card
  aiCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.card,
  },
  aiCardIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  aiCardContent: {
    flex: 1,
  },
  aiCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.forest,
    marginBottom: 4,
  },
  aiCardSub: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    lineHeight: 18,
  },
  aiScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  aiScoreLabel: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginRight: 6,
  },
  aiScoreValue: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.primary,
  },

  // Timeline Card
  timelineCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    marginTop: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.card,
  },
  timelineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  timelineTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.forest,
    marginLeft: 8,
  },
  stepRow: {
    flexDirection: 'row',
  },
  stepIndicatorCol: {
    alignItems: 'center',
    width: 28,
  },
  stepCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleCompleted: {
    backgroundColor: theme.colors.primary,
  },
  stepCircleCurrent: {
    borderWidth: 2,
    borderColor: theme.colors.primary,
    backgroundColor: '#FFFFFF',
  },
  stepCurrentRing: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.primary,
  },
  stepCirclePending: {
    backgroundColor: '#E2E8F0',
  },
  stepInnerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#94A3B8',
  },
  stepLine: {
    width: 2,
    flex: 1,
    minHeight: 38,
  },
  stepLineActive: {
    backgroundColor: theme.colors.primary,
  },
  stepLineInactive: {
    backgroundColor: '#E2E8F0',
  },
  stepContentCol: {
    flex: 1,
    marginLeft: 10,
    paddingBottom: 20,
  },
  stepName: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.forest,
  },
  stepTime: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  stepDesc: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 3,
    lineHeight: 17,
  },
  bulletList: {
    marginTop: 6,
    backgroundColor: '#F8FAFC',
    padding: 8,
    borderRadius: 8,
  },
  bulletItem: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    lineHeight: 18,
  },

  // Location Card
  locationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...theme.shadows.card,
  },
  locationInfoCol: {
    flex: 1,
    marginRight: 12,
  },
  locationHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  locationTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.forest,
    marginLeft: 6,
  },
  locationAddressText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    lineHeight: 18,
    marginBottom: 4,
  },
  locationCoordsText: {
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  locationAccuracyText: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  miniMapPreview: {
    width: 100,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#E6F4EA',
    borderWidth: 1,
    borderColor: '#C6E7D2',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  miniMapPinCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  viewOnMapPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  viewOnMapText: {
    fontSize: 9,
    fontWeight: '700',
    color: theme.colors.forest,
  },

  // Bottom Floating Bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    gap: 12,
    ...theme.shadows.card,
  },
  shareBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  shareBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.forest,
  },
  followBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: theme.colors.forest,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  followBtnActive: {
    backgroundColor: theme.colors.primary,
  },
  followBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
