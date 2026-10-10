import { Ionicons } from '@expo/vector-icons';
import type { Reward, RewardClaim } from '@ecopulse/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
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
import { theme } from '../../constants/theme';
import { api } from '../../lib/api';

const CATEGORIES: { label: string; value: string; icon: string }[] = [
  { label: 'All Vouchers', value: 'ALL', icon: 'grid-outline' },
  { label: 'Bus (PMPML)', value: 'TRANSIT_PASS', icon: 'bus-outline' },
  { label: 'Pune Metro', value: 'METRO_DISCOUNT', icon: 'train-outline' },
  { label: 'Zoo & Parks', value: 'PARKS_AND_RECREATION', icon: 'leaf-outline' },
  { label: 'Heritage', value: 'MUNICIPAL_TICKET', icon: 'business-outline' },
];

export default function RewardsScreen() {
  const router = useRouter();
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
      queryClient.invalidateQueries({ queryKey: ['home-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['rewards'] });
      queryClient.invalidateQueries({ queryKey: ['my-reward-claims'] });
      setSelectedReward(null);
      setClaimSuccessClaim(result.claim);
    },
    onError: (err: any) => {
      Alert.alert('Unable to Redeem Voucher', err.message || 'Please check your points balance.');
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
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={22} color={theme.colors.forest} />
          </TouchableOpacity>

          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>Redeem EcoPoints</Text>
            <Text style={styles.headerSubtitle}>Government Tickets & Transit Vouchers</Text>
          </View>

          <View style={{ width: 38 }} />
        </View>

        {/* EcoPoints Balance Hero Card */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceHeader}>
            <View style={styles.balanceTitleRow}>
              <Ionicons name="star" size={16} color="#F59E0B" style={{ marginRight: 6 }} />
              <Text style={styles.balanceLabel}>Your Available Points</Text>
            </View>
            <View style={styles.liveIndicator}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>Verified Ledger</Text>
            </View>
          </View>

          <View style={styles.balanceValueRow}>
            <Text style={styles.balanceValue}>{balance.toLocaleString()}</Text>
            <Text style={styles.balanceUnit}>EcoPoints</Text>
          </View>

          <Text style={styles.balanceNote}>
            Earned via verified civic cleanup & recycling. Redeem directly for Pune municipal bus passes, metro rides & park tickets.
          </Text>
        </View>

        {/* Tab Selector */}
        <View style={styles.tabSelector}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'EXPLORE' && styles.tabButtonActive]}
            onPress={() => setActiveTab('EXPLORE')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="ticket-outline"
              size={15}
              color={activeTab === 'EXPLORE' ? '#FFFFFF' : theme.colors.textSecondary}
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.tabButtonText, activeTab === 'EXPLORE' && styles.tabButtonTextActive]}>
              Explore Coupons
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'MY_TICKETS' && styles.tabButtonActive]}
            onPress={() => setActiveTab('MY_TICKETS')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="wallet-outline"
              size={15}
              color={activeTab === 'MY_TICKETS' ? '#FFFFFF' : theme.colors.textSecondary}
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.tabButtonText, activeTab === 'MY_TICKETS' && styles.tabButtonTextActive]}>
              My Claimed Tickets ({myClaims.length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={onRefresh}
            colors={[theme.colors.primary]}
          />
        }
      >
        {activeTab === 'EXPLORE' ? (
          <>
            {/* Category Filter Pills */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoriesRow}
            >
              {CATEGORIES.map((cat) => {
                const isActive = selectedCategory === cat.value;
                return (
                  <TouchableOpacity
                    key={cat.value}
                    style={[styles.catChip, isActive && styles.catChipActive]}
                    onPress={() => setSelectedCategory(cat.value)}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={cat.icon as any}
                      size={14}
                      color={isActive ? '#FFFFFF' : theme.colors.forest}
                      style={{ marginRight: 5 }}
                    />
                    <Text style={[styles.catChipText, isActive && styles.catChipTextActive]}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Rewards Cards List */}
            {isRewardsLoading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={styles.loadingText}>Loading available vouchers...</Text>
              </View>
            ) : rewards.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="ticket-outline" size={44} color={theme.colors.textTertiary} />
                <Text style={styles.emptyTitle}>No Vouchers Available</Text>
                <Text style={styles.emptySub}>
                  No active discount tickets currently listed in this category.
                </Text>
              </View>
            ) : (
              <View style={styles.rewardsList}>
                {rewards.map((reward) => {
                  const canAfford = balance >= reward.costPoints;
                  const pointsNeeded = reward.costPoints - balance;

                  return (
                    <View key={reward.id} style={styles.rewardCard}>
                      <View style={styles.rewardTopRow}>
                        <View style={styles.partnerTag}>
                          <Text style={styles.partnerTagText}>
                            {reward.partnerName || 'Government of Maharashtra'}
                          </Text>
                        </View>
                        <View style={styles.costBadge}>
                          <Ionicons name="star" size={13} color="#F59E0B" style={{ marginRight: 4 }} />
                          <Text style={styles.costBadgeText}>{reward.costPoints} pts</Text>
                        </View>
                      </View>

                      <Text style={styles.rewardTitle}>{reward.title}</Text>
                      <Text style={styles.rewardDesc}>{reward.description}</Text>

                      <View style={styles.rewardDivider} />

                      <View style={styles.rewardBottomRow}>
                        <View>
                          <Text style={styles.discountValueText}>
                            {reward.discountPercent
                              ? `${reward.discountPercent}% OFF`
                              : reward.discountAmountInr
                              ? `₹${reward.discountAmountInr} OFF`
                              : 'Special Pass'}
                          </Text>
                          <Text style={styles.termsText}>
                            {reward.terms || 'Instant activation'}
                          </Text>
                        </View>

                        <TouchableOpacity
                          style={[
                            styles.redeemBtn,
                            !canAfford && styles.redeemBtnDisabled,
                          ]}
                          onPress={() => setSelectedReward(reward)}
                          disabled={!canAfford}
                          activeOpacity={0.85}
                        >
                          <Text
                            style={[
                              styles.redeemBtnText,
                              !canAfford && styles.redeemBtnTextDisabled,
                            ]}
                          >
                            {canAfford ? 'Redeem Voucher' : `Need ${pointsNeeded} pts`}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </>
        ) : (
          /* My Claimed Tickets Tab */
          <View style={styles.claimsList}>
            {myClaims.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="wallet-outline" size={44} color={theme.colors.textTertiary} />
                <Text style={styles.emptyTitle}>No Claimed Tickets Yet</Text>
                <Text style={styles.emptySub}>
                  You haven't redeemed any vouchers yet. Earn points by submitting reports to unlock transit discounts!
                </Text>
                <TouchableOpacity
                  style={styles.exploreCtaBtn}
                  onPress={() => setActiveTab('EXPLORE')}
                  activeOpacity={0.85}
                >
                  <Text style={styles.exploreCtaBtnText}>Explore Available Vouchers</Text>
                </TouchableOpacity>
              </View>
            ) : (
              myClaims.map((claim) => {
                const isCopied = copiedCode === claim.couponCode;
                const d = new Date(claim.claimedAt);
                const dateStr = d.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                });

                return (
                  <View key={claim.id} style={styles.ticketCard}>
                    <View style={styles.ticketHeader}>
                      <View style={styles.ticketPartnerRow}>
                        <Ionicons name="checkmark-circle" size={16} color={theme.colors.primary} />
                        <Text style={styles.ticketPartnerText}>
                          {claim.partnerName || 'Government Pass'}
                        </Text>
                      </View>
                      <View style={styles.activePill}>
                        <Text style={styles.activePillText}>{claim.status}</Text>
                      </View>
                    </View>

                    <Text style={styles.ticketTitle}>{claim.rewardTitle || 'Civic Ticket Coupon'}</Text>
                    <Text style={styles.ticketDate}>Claimed on {dateStr}</Text>

                    {/* Voucher Code Box */}
                    <View style={styles.voucherBox}>
                      <View>
                        <Text style={styles.voucherLabel}>VOUCHER CODE</Text>
                        <Text style={styles.voucherCodeText}>{claim.couponCode}</Text>
                      </View>
                      <TouchableOpacity
                        style={[styles.copyBtn, isCopied && styles.copyBtnSuccess]}
                        onPress={() => handleCopyCode(claim.couponCode)}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name={isCopied ? 'checkmark' : 'copy-outline'}
                          size={15}
                          color={isCopied ? '#FFFFFF' : theme.colors.forest}
                          style={{ marginRight: 4 }}
                        />
                        <Text style={[styles.copyBtnText, isCopied && styles.copyBtnTextSuccess]}>
                          {isCopied ? 'Copied' : 'Copy'}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <Text style={styles.ticketInstructions}>
                      {claim.redemptionInstructions ||
                        'Show this code at the ticket counter or paste in the transit app during booking.'}
                    </Text>
                  </View>
                );
              })
            )}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Confirmation Modal */}
      {selectedReward && (
        <Modal transparent animationType="fade" visible={!!selectedReward}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalIconWrap}>
                <Ionicons name="gift" size={32} color={theme.colors.primary} />
              </View>

              <Text style={styles.modalTitle}>Redeem This Voucher?</Text>
              <Text style={styles.modalSubtitle}>{selectedReward.title}</Text>

              <View style={styles.modalDetailsBox}>
                <View style={styles.modalDetailRow}>
                  <Text style={styles.modalDetailLabel}>Cost in EcoPoints:</Text>
                  <Text style={styles.modalDetailCost}>-{selectedReward.costPoints} pts</Text>
                </View>
                <View style={styles.modalDetailRow}>
                  <Text style={styles.modalDetailLabel}>Your Current Balance:</Text>
                  <Text style={styles.modalDetailVal}>{balance} pts</Text>
                </View>
                <View style={styles.modalDetailRow}>
                  <Text style={styles.modalDetailLabel}>Remaining After Claim:</Text>
                  <Text style={styles.modalDetailRemaining}>
                    {balance - selectedReward.costPoints} pts
                  </Text>
                </View>
              </View>

              <View style={styles.modalButtonsRow}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setSelectedReward(null)}
                  activeOpacity={0.7}
                  disabled={claimMutation.isPending}
                >
                  <Text style={styles.modalCancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalConfirmBtn}
                  onPress={() => claimMutation.mutate(selectedReward)}
                  activeOpacity={0.85}
                  disabled={claimMutation.isPending}
                >
                  {claimMutation.isPending ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.modalConfirmBtnText}>Confirm & Redeem</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Success Dialog Modal */}
      {claimSuccessClaim && (
        <Modal transparent animationType="fade" visible={!!claimSuccessClaim}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={[styles.modalIconWrap, { backgroundColor: '#ECFDF5' }]}>
                <Ionicons name="checkmark-circle" size={36} color={theme.colors.primary} />
              </View>

              <Text style={styles.modalTitle}>Voucher Unlocked!</Text>
              <Text style={styles.modalSubtitle}>
                Your discount ticket code has been generated.
              </Text>

              <View style={styles.voucherBoxModal}>
                <Text style={styles.voucherCodeModal}>{claimSuccessClaim.couponCode}</Text>
                <TouchableOpacity
                  style={[styles.copyBtn, copiedCode === claimSuccessClaim.couponCode && styles.copyBtnSuccess]}
                  onPress={() => handleCopyCode(claimSuccessClaim.couponCode)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={copiedCode === claimSuccessClaim.couponCode ? 'checkmark' : 'copy-outline'}
                    size={16}
                    color={copiedCode === claimSuccessClaim.couponCode ? '#FFFFFF' : theme.colors.forest}
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={[
                      styles.copyBtnText,
                      copiedCode === claimSuccessClaim.couponCode && styles.copyBtnTextSuccess,
                    ]}
                  >
                    {copiedCode === claimSuccessClaim.couponCode ? 'Copied!' : 'Copy Code'}
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.doneBtn}
                onPress={() => {
                  setClaimSuccessClaim(null);
                  setActiveTab('MY_TICKETS');
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.doneBtnText}>View in My Tickets</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background, // #F4F8F5
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    alignItems: 'center',
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.forest,
  },
  headerSubtitle: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: '600',
    marginTop: 1,
  },

  // Balance Hero Card
  balanceCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#C6E7D2',
    marginBottom: 14,
    ...theme.shadows.card,
  },
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  balanceTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.forest,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.primary,
    marginRight: 5,
  },
  liveText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.forest,
  },
  balanceValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 6,
  },
  balanceValue: {
    fontSize: 28,
    fontWeight: '800',
    color: theme.colors.forest,
    marginRight: 6,
  },
  balanceUnit: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  balanceNote: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    lineHeight: 16,
  },

  // Tabs
  tabSelector: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 3,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 9,
  },
  tabButtonActive: {
    backgroundColor: theme.colors.forest,
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  tabButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },

  // Categories
  categoriesRow: {
    gap: 8,
    marginBottom: 16,
  },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.card,
  },
  catChipActive: {
    backgroundColor: theme.colors.forest,
    borderColor: theme.colors.forest,
  },
  catChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.forest,
  },
  catChipTextActive: {
    color: '#FFFFFF',
  },

  // Loading & Empty
  loadingBox: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  emptyBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginTop: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.forest,
    marginTop: 10,
  },
  emptySub: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  exploreCtaBtn: {
    backgroundColor: theme.colors.forest,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 14,
  },
  exploreCtaBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },

  // Rewards List
  rewardsList: {
    gap: 14,
  },
  rewardCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.card,
  },
  rewardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  partnerTag: {
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  partnerTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  costBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  costBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#D97706',
  },
  rewardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.forest,
    marginBottom: 4,
  },
  rewardDesc: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    lineHeight: 18,
  },
  rewardDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 12,
  },
  rewardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  discountValueText: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  termsText: {
    fontSize: 11,
    color: theme.colors.textTertiary,
    marginTop: 1,
  },
  redeemBtn: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
  },
  redeemBtnDisabled: {
    backgroundColor: '#E2E8F0',
  },
  redeemBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  redeemBtnTextDisabled: {
    color: '#94A3B8',
  },

  // My Claims / Tickets
  claimsList: {
    gap: 14,
  },
  ticketCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.card,
  },
  ticketHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  ticketPartnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ticketPartnerText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.primary,
    marginLeft: 4,
  },
  activePill: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  activePillText: {
    fontSize: 9,
    fontWeight: '800',
    color: theme.colors.forest,
  },
  ticketTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.forest,
  },
  ticketDate: {
    fontSize: 11,
    color: theme.colors.textTertiary,
    marginTop: 2,
    marginBottom: 10,
  },
  voucherBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    marginBottom: 8,
  },
  voucherLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.textTertiary,
  },
  voucherCodeText: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.forest,
    letterSpacing: 1.5,
    marginTop: 2,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  copyBtnSuccess: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  copyBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.forest,
  },
  copyBtnTextSuccess: {
    color: '#FFFFFF',
  },
  ticketInstructions: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    lineHeight: 16,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  modalIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.forest,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  modalDetailsBox: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginBottom: 18,
    gap: 8,
  },
  modalDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalDetailLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  modalDetailCost: {
    fontSize: 13,
    fontWeight: '800',
    color: '#DC2626',
  },
  modalDetailVal: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.forest,
  },
  modalDetailRemaining: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  modalCancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  modalCancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  modalConfirmBtn: {
    flex: 1.4,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
  },
  modalConfirmBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  // Voucher Box Modal
  voucherBoxModal: {
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  voucherCodeModal: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.forest,
    letterSpacing: 2,
    marginBottom: 12,
  },
  doneBtn: {
    backgroundColor: theme.colors.forest,
    width: '100%',
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
