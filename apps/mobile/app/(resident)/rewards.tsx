import { colors, radius, spacing, typography } from '@ecopulse/design-system';
import type { Reward, RewardCategory, RewardClaim } from '@ecopulse/types';
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
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../lib/api';

const CATEGORIES: { label: string; value: string }[] = [
  { label: 'All Vouchers', value: 'ALL' },
  { label: 'Bus (PMPML)', value: 'TRANSIT_PASS' },
  { label: 'Pune Metro', value: 'METRO_DISCOUNT' },
  { label: 'Zoo & Parks', value: 'PARKS_AND_RECREATION' },
  { label: 'Heritage', value: 'MUNICIPAL_TICKET' },
];

export default function RewardsScreen() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'EXPLORE' | 'MY_TICKETS'>('EXPLORE');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedReward, setSelectedReward] = useState<Reward | null>(null);
  const [claimSuccessClaim, setClaimSuccessClaim] = useState<RewardClaim | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // 1. Fetch Points Balance
  const { data: pointsData, refetch: refetchPoints } = useQuery({
    queryKey: ['me-points'],
    queryFn: () => api.me.getPoints(),
  });
  const balance = pointsData?.balance.totalPoints ?? 0;

  // 2. Fetch Available Rewards
  const {
    data: rewards = [],
    isLoading: isRewardsLoading,
    refetch: refetchRewards,
    isRefetching,
  } = useQuery({
    queryKey: ['rewards', selectedCategory],
    queryFn: () => api.rewards.getAll(selectedCategory === 'ALL' ? undefined : selectedCategory),
  });

  // 3. Fetch My Claimed Tickets
  const { data: myClaims = [], refetch: refetchClaims } = useQuery({
    queryKey: ['my-reward-claims'],
    queryFn: () => api.rewards.getMyClaims(),
  });

  // 4. Claim Mutation
  const claimMutation = useMutation({
    mutationFn: async (reward: Reward) => {
      const clientEventId = `evt_claim_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      return api.rewards.claim(reward.id, clientEventId);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['me-points'] });
      queryClient.invalidateQueries({ queryKey: ['rewards'] });
      queryClient.invalidateQueries({ queryKey: ['my-reward-claims'] });
      setSelectedReward(null);
      setClaimSuccessClaim(result.claim);
    },
    onError: (err: any) => {
      Alert.alert('Unable to Claim Voucher', err.message || 'Please check your points balance.');
    },
  });

  const onRefresh = async () => {
    await Promise.all([refetchPoints(), refetchRewards(), refetchClaims()]);
  };

  const handleCopyCode = (code: string) => {
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header & Balance Hero */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Civic Rewards</Text>
          <View style={styles.verifiedTag}>
            <Text style={styles.verifiedTagText}>Government Tickets</Text>
          </View>
        </View>

        {/* EcoPoints Balance Card */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceHeader}>
            <Text style={styles.balanceLabel}>Available EcoPoints</Text>
            <View style={styles.liveIndicator}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>Immutable Ledger</Text>
            </View>
          </View>
          <Text style={styles.balanceValue}>{balance.toLocaleString()}</Text>
          <Text style={styles.balanceNote}>
            Earned via verified civic cleanup & recycling. Redeem directly for government transit & municipal tickets.
          </Text>
        </View>

        {/* Tab Selector */}
        <View style={styles.tabSelector}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'EXPLORE' && styles.tabButtonActive]}
            onPress={() => setActiveTab('EXPLORE')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabButtonText, activeTab === 'EXPLORE' && styles.tabButtonTextActive]}>
              Explore Coupons
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'MY_TICKETS' && styles.tabButtonActive]}
            onPress={() => setActiveTab('MY_TICKETS')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabButtonText, activeTab === 'MY_TICKETS' && styles.tabButtonTextActive]}>
              My Vouchers ({myClaims.length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} />}
      >
        {activeTab === 'EXPLORE' ? (
          <>
            {/* Category Filter Chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoriesRow}
            >
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.value}
                  style={[
                    styles.categoryChip,
                    selectedCategory === cat.value && styles.categoryChipActive,
                  ]}
                  onPress={() => setSelectedCategory(cat.value)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.categoryChipText,
                      selectedCategory === cat.value && styles.categoryChipTextActive,
                    ]}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Rewards List */}
            {isRewardsLoading ? (
              <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={colors.primary[600]} />
                <Text style={styles.loadingText}>Fetching available government coupons...</Text>
              </View>
            ) : rewards.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyTitle}>No Vouchers in this Category</Text>
                <Text style={styles.emptyText}>Check back soon or select another category above.</Text>
              </View>
            ) : (
              rewards.map((reward) => {
                const canAfford = balance >= reward.costPoints;
                return (
                  <View key={reward.id} style={styles.card}>
                    {/* Partner Header */}
                    <View style={styles.cardHeader}>
                      <View style={styles.partnerInfo}>
                        <Text style={styles.partnerName}>{reward.partnerName ?? 'Government Partner'}</Text>
                        <Text style={styles.rewardTitle}>{reward.title}</Text>
                      </View>
                      {reward.discountPercent ? (
                        <View style={styles.discountBadge}>
                          <Text style={styles.discountBadgeText}>
                            {reward.discountPercent === 100 ? 'FREE' : `${reward.discountPercent}% OFF`}
                          </Text>
                        </View>
                      ) : reward.discountAmountInr ? (
                        <View style={styles.discountBadge}>
                          <Text style={styles.discountBadgeText}>₹{reward.discountAmountInr} OFF</Text>
                        </View>
                      ) : null}
                    </View>

                    {/* Description */}
                    <Text style={styles.description}>{reward.description}</Text>

                    {/* How to Redeem preview */}
                    <View style={styles.instructionsPreview}>
                      <Text style={styles.instructionsPreviewTitle}>📍 How to use:</Text>
                      <Text style={styles.instructionsPreviewText}>{reward.redemptionInstructions}</Text>
                    </View>

                    {/* Footer with Cost & Action */}
                    <View style={styles.cardFooter}>
                      <View style={styles.costBadge}>
                        <Text style={styles.costPoints}>{reward.costPoints} EcoPoints</Text>
                        <Text style={styles.stockText}>{reward.inventoryRemaining} available</Text>
                      </View>

                      <TouchableOpacity
                        style={[styles.claimButton, !canAfford && styles.claimButtonDisabled]}
                        disabled={!canAfford}
                        onPress={() => setSelectedReward(reward)}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.claimButtonText, !canAfford && styles.claimButtonTextDisabled]}>
                          {canAfford ? 'Claim Voucher' : `Need ${reward.costPoints - balance} pts`}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </>
        ) : (
          /* My Claimed Vouchers Tab */
          <>
            {myClaims.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyTitle}>No Vouchers Claimed Yet</Text>
                <Text style={styles.emptyText}>
                  Explore the catalog to redeem your points for bus passes, metro tickets, and zoo entry vouchers!
                </Text>
              </View>
            ) : (
              myClaims.map((claim) => (
                <View key={claim.id} style={styles.claimedCard}>
                  <View style={styles.claimedHeader}>
                    <View>
                      <Text style={styles.claimedPartner}>{claim.partnerName ?? 'Government Partner'}</Text>
                      <Text style={styles.claimedTitle}>{claim.rewardTitle}</Text>
                    </View>
                    <View style={styles.statusPill}>
                      <Text style={styles.statusPillText}>{claim.status}</Text>
                    </View>
                  </View>

                  {/* Digital Coupon Code Box */}
                  <View style={styles.codeContainer}>
                    <Text style={styles.codeLabel}>VOUCHER CODE / PASS NUMBER</Text>
                    <Text style={styles.codeText}>{claim.couponCode}</Text>
                    <TouchableOpacity
                      style={styles.copyBtn}
                      onPress={() => handleCopyCode(claim.couponCode)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.copyBtnText}>
                        {copiedCode === claim.couponCode ? '✓ Copied' : 'Tap to Copy Code'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Instructions */}
                  {claim.redemptionInstructions && (
                    <Text style={styles.claimedInstructions}>
                      {claim.redemptionInstructions}
                    </Text>
                  )}

                  <View style={styles.claimedFooter}>
                    <Text style={styles.expiryText}>
                      Valid until: {new Date(claim.expiresAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                    </Text>
                    <Text style={styles.costDeducted}>-{claim.costPoints} pts</Text>
                  </View>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>

      {/* Confirmation Modal */}
      <Modal visible={!!selectedReward} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Confirm Redemption</Text>
            {selectedReward && (
              <>
                <Text style={styles.modalRewardTitle}>{selectedReward.title}</Text>
                <Text style={styles.modalDescription}>{selectedReward.description}</Text>

                <View style={styles.breakdownBox}>
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>Current Balance:</Text>
                    <Text style={styles.breakdownValue}>{balance} pts</Text>
                  </View>
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>Cost:</Text>
                    <Text style={styles.breakdownCost}>-{selectedReward.costPoints} pts</Text>
                  </View>
                  <View style={[styles.breakdownRow, styles.breakdownTotal]}>
                    <Text style={styles.breakdownTotalLabel}>Remaining Balance:</Text>
                    <Text style={styles.breakdownTotalValue}>
                      {balance - selectedReward.costPoints} pts
                    </Text>
                  </View>
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={() => setSelectedReward(null)}
                    disabled={claimMutation.isPending}
                  >
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.confirmBtn}
                    onPress={() => claimMutation.mutate(selectedReward)}
                    disabled={claimMutation.isPending}
                  >
                    {claimMutation.isPending ? (
                      <ActivityIndicator color={colors.surface.white} />
                    ) : (
                      <Text style={styles.confirmBtnText}>Confirm & Get Code</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Claim Success Dialog */}
      <Modal visible={!!claimSuccessClaim} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.successModalContent]}>
            <Text style={styles.successEmoji}>🎉</Text>
            <Text style={styles.modalTitle}>Ticket Voucher Issued!</Text>
            <Text style={styles.successSubtext}>
              Your points have been securely debited. Present this coupon voucher code when traveling or booking:
            </Text>

            {claimSuccessClaim && (
              <View style={styles.successCodeBox}>
                <Text style={styles.successCodeLabel}>COUPON CODE</Text>
                <Text style={styles.successCodeValue}>{claimSuccessClaim.couponCode}</Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.successDoneBtn}
              onPress={() => {
                setClaimSuccessClaim(null);
                setActiveTab('MY_TICKETS');
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.successDoneBtnText}>View in My Vouchers</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface.background },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    backgroundColor: colors.surface.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.neutral[900],
  },
  verifiedTag: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  verifiedTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2E7D32',
  },
  balanceCard: {
    backgroundColor: colors.primary[900],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.primary[200],
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4CAF50',
  },
  liveText: {
    fontSize: 10,
    color: colors.primary[100],
  },
  balanceValue: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.surface.white,
    marginVertical: 4,
  },
  balanceNote: {
    fontSize: 12,
    color: colors.primary[200],
    lineHeight: 16,
  },
  tabSelector: {
    flexDirection: 'row',
    backgroundColor: colors.neutral[100],
    borderRadius: radius.md,
    padding: 3,
    marginBottom: spacing.sm,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: radius.sm,
  },
  tabButtonActive: {
    backgroundColor: colors.surface.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.neutral[600],
  },
  tabButtonTextActive: {
    color: colors.primary[800],
  },
  scroll: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  categoriesRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingBottom: spacing.xs,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.full,
    backgroundColor: colors.surface.white,
    borderWidth: 1,
    borderColor: colors.neutral[300],
  },
  categoryChipActive: {
    backgroundColor: colors.primary[800],
    borderColor: colors.primary[800],
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.neutral[700],
  },
  categoryChipTextActive: {
    color: colors.surface.white,
  },
  card: {
    backgroundColor: colors.surface.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    gap: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  partnerInfo: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  partnerName: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary[700],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rewardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.neutral[900],
    marginTop: 2,
  },
  discountBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: '#A5D6A7',
  },
  discountBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1B5E20',
  },
  description: {
    fontSize: 13,
    color: colors.neutral[600],
    lineHeight: 18,
  },
  instructionsPreview: {
    backgroundColor: colors.neutral[50],
    padding: spacing.sm,
    borderRadius: radius.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary[500],
  },
  instructionsPreviewTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.neutral[800],
    marginBottom: 2,
  },
  instructionsPreviewText: {
    fontSize: 12,
    color: colors.neutral[600],
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
  },
  costBadge: {
    gap: 2,
  },
  costPoints: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary[800],
  },
  stockText: {
    fontSize: 11,
    color: colors.neutral[500],
  },
  claimButton: {
    backgroundColor: colors.primary[800],
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: radius.md,
  },
  claimButtonDisabled: {
    backgroundColor: colors.neutral[200],
  },
  claimButtonText: {
    color: colors.surface.white,
    fontSize: 13,
    fontWeight: '700',
  },
  claimButtonTextDisabled: {
    color: colors.neutral[500],
  },
  claimedCard: {
    backgroundColor: colors.surface.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    gap: spacing.sm,
  },
  claimedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  claimedPartner: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary[700],
    textTransform: 'uppercase',
  },
  claimedTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.neutral[900],
    marginTop: 2,
  },
  statusPill: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2E7D32',
  },
  codeContainer: {
    backgroundColor: '#F1F8E9',
    padding: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    marginVertical: spacing.xs,
    borderWidth: 1,
    borderColor: '#DCEDC8',
    borderStyle: 'dashed',
  },
  codeLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#558B2F',
    letterSpacing: 1,
  },
  codeText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1B5E20',
    letterSpacing: 2,
    marginVertical: 6,
  },
  copyBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: '#DCEDC8',
    borderRadius: radius.sm,
  },
  copyBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#33691E',
  },
  claimedInstructions: {
    fontSize: 12,
    color: colors.neutral[600],
    fontStyle: 'italic',
  },
  claimedFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
  },
  expiryText: {
    fontSize: 11,
    color: colors.neutral[500],
  },
  costDeducted: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.neutral[600],
  },
  centerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing['2xl'],
    gap: spacing.sm,
  },
  loadingText: {
    fontSize: 13,
    color: colors.neutral[600],
  },
  emptyContainer: {
    backgroundColor: colors.surface.white,
    padding: spacing.xl,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.neutral[800],
  },
  emptyText: {
    fontSize: 13,
    color: colors.neutral[600],
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.surface.white,
    borderRadius: radius.xl,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 400,
    gap: spacing.md,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.neutral[900],
    textAlign: 'center',
  },
  modalRewardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary[800],
    textAlign: 'center',
  },
  modalDescription: {
    fontSize: 13,
    color: colors.neutral[600],
    textAlign: 'center',
  },
  breakdownBox: {
    backgroundColor: colors.neutral[50],
    padding: spacing.md,
    borderRadius: radius.md,
    gap: spacing.xs,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  breakdownLabel: {
    fontSize: 13,
    color: colors.neutral[600],
  },
  breakdownValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.neutral[800],
  },
  breakdownCost: {
    fontSize: 13,
    fontWeight: '700',
    color: '#D32F2F',
  },
  breakdownTotal: {
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
    paddingTop: spacing.xs,
    marginTop: spacing.xs,
  },
  breakdownTotalLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.neutral[900],
  },
  breakdownTotalValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary[700],
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: colors.neutral[100],
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[700],
  },
  confirmBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: colors.primary[800],
    alignItems: 'center',
  },
  confirmBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.surface.white,
  },
  successModalContent: {
    alignItems: 'center',
    textAlign: 'center',
  },
  successEmoji: {
    fontSize: 40,
    marginBottom: -4,
  },
  successSubtext: {
    fontSize: 13,
    color: colors.neutral[600],
    textAlign: 'center',
    lineHeight: 18,
  },
  successCodeBox: {
    backgroundColor: '#E8F5E9',
    padding: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    width: '100%',
    borderWidth: 1,
    borderColor: '#A5D6A7',
    borderStyle: 'dashed',
  },
  successCodeLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2E7D32',
    letterSpacing: 1,
  },
  successCodeValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1B5E20',
    letterSpacing: 2,
    marginTop: 4,
  },
  successDoneBtn: {
    backgroundColor: colors.primary[800],
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: radius.md,
    width: '100%',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  successDoneBtnText: {
    color: colors.surface.white,
    fontSize: 14,
    fontWeight: '700',
  },
});
