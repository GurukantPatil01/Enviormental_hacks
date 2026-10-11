import { Ionicons } from '@expo/vector-icons';
import type { Reward, RewardClaim } from '@ecopulse/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
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

const CATEGORIES = [
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

  // 1. Fetch Points Balance with instant cache fallback from home-dashboard
  const homeDashboard = queryClient.getQueryData<any>(['home-dashboard']);
  const cachedBalance =
    homeDashboard?.points?.totalPoints ?? homeDashboard?.user?.points ?? 0;

  const { data: pointsData, refetch: refetchPoints } = useQuery({
    queryKey: ['me-points'],
    queryFn: () => api.me.getPoints(),
    staleTime: 60 * 1000,
  });
  const balance = pointsData?.balance?.totalPoints ?? cachedBalance;

  // 2. Fetch All Available Rewards once & cache for 5 min (Fast 0ms in-memory filtering)
  const {
    data: allRewards = [],
    isLoading: isRewardsLoading,
    refetch: refetchRewards,
    isRefetching,
  } = useQuery({
    queryKey: ['rewards-all'],
    queryFn: () => api.rewards.getAll(),
    staleTime: 5 * 60 * 1000,
  });

  // Instant category filtering in memory without network spinner
  const rewards = useMemo(() => {
    if (selectedCategory === 'ALL') return allRewards;
    return allRewards.filter((r) => r.category === selectedCategory);
  }, [allRewards, selectedCategory]);

  // 3. Fetch My Claimed Tickets
  const {
    data: myClaims = [],
    isLoading: isClaimsLoading,
    refetch: refetchClaims,
  } = useQuery({
    queryKey: ['my-reward-claims'],
    queryFn: () => api.rewards.getMyClaims(),
    staleTime: 2 * 60 * 1000,
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
      queryClient.invalidateQueries({ queryKey: ['rewards-all'] });
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

  const getCategoryTheme = (cat: string) => {
    switch (cat) {
      case 'TRANSIT_PASS':
        return { tagBg: '#EFF6FF', tagText: '#1D4ED8', border: '#BFDBFE', label: 'PMPML City Bus' };
      case 'METRO_DISCOUNT':
        return { tagBg: '#FAF5FF', tagText: '#7E22CE', border: '#E9D5FF', label: 'Pune Metro' };
      case 'PARKS_AND_RECREATION':
        return { tagBg: '#F0FDF4', tagText: '#15803D', border: '#BBF7D0', label: 'Katraj Zoo / Park' };
      case 'MUNICIPAL_TICKET':
        return { tagBg: '#FFFBEB', tagText: '#B45309', border: '#FDE68A', label: 'PMC Heritage Pass' };
      default:
        return { tagBg: '#F8FAFC', tagText: '#475569', border: '#E2E8F0', label: 'Civic Voucher' };
    }
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
            <Ionicons name="arrow-back" size={20} color={theme.colors.forest} />
          </TouchableOpacity>

          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>Redeem EcoPoints</Text>
            <Text style={styles.headerSubtitle}>Civic Transit & Entry Vouchers</Text>
          </View>

          <View style={{ width: 38 }} />
        </View>

        {/* EcoPoints Balance Hero Card */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceHeader}>
            <View style={styles.balanceTitleRow}>
              <Ionicons name="star" size={16} color="#F59E0B" style={{ marginRight: 6 }} />
              <Text style={styles.balanceLabel}>Your Balance</Text>
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
              Explore Coupons ({allRewards.length})
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
              My Tickets ({myClaims.length})
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
            {/* Horizontal Category Filter Pills */}
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
            {isRewardsLoading && allRewards.length === 0 ? (
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
                  const catTheme = getCategoryTheme(reward.category);

                  return (
                    <View key={reward.id} style={styles.rewardCard}>
                      <View style={styles.rewardTopRow}>
                        <View style={[styles.partnerTag, { backgroundColor: catTheme.tagBg, borderColor: catTheme.border }]}>
                          <Text style={[styles.partnerTagText, { color: catTheme.tagText }]}>
                            {reward.partnerName || catTheme.label}
                          </Text>
                        </View>
                        <View style={styles.costBadge}>
                          <Ionicons name="star" size={13} color="#F59E0B" style={{ marginRight: 4 }} />
                          <Text style={styles.costBadgeText}>{reward.costPoints} pts</Text>
                        </View>
                      </View>

                      <Text style={styles.rewardTitle}>{reward.title}</Text>
                      <Text style={styles.rewardDesc} numberOfLines={2}>
                        {reward.description}
                      </Text>

                      <View style={styles.rewardDivider} />

                      <View style={styles.rewardBottomRow}>
                        <View style={styles.discountCol}>
                          <Text style={styles.discountValueText}>
                            {reward.discountPercent
                              ? `${reward.discountPercent}% OFF`
                              : reward.discountAmountInr
                              ? `₹${reward.discountAmountInr} OFF`
                              : 'Special Pass'}
                          </Text>
                          <Text style={styles.termsText} numberOfLines={1}>
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
            {isClaimsLoading && myClaims.length === 0 ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={styles.loadingText}>Fetching your vouchers...</Text>
              </View>
            ) : myClaims.length === 0 ? (
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
                      <View style={{ flex: 1 }}>
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
    backgroundColor: theme.colors.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    alignItems: 'center',
    flex: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: theme.colors.forest,
  },
  headerSubtitle: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    fontWeight: '600',
    marginTop: 1,
  },

  // Balance Hero Card
  balanceCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#C6E7D2',
    marginBottom: 12,
    ...theme.shadows.card,
  },
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  balanceTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.forest,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
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
    marginBottom: 4,
  },
  balanceValue: {
    fontSize: 26,
    fontWeight: '800',
    color: theme.colors.forest,
    marginRight: 6,
  },
  balanceUnit: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  balanceNote: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    lineHeight: 15,
  },

  // Tabs
  tabSelector: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 3,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: theme.colors.forest,
  },
  tabButtonText: {
    fontSize: 12,
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
    marginBottom: 14,
  },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
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
    paddingVertical: 36,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  emptyBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 22,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginTop: 6,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.forest,
    marginTop: 8,
  },
  emptySub: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 17,
  },
  exploreCtaBtn: {
    backgroundColor: theme.colors.forest,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 9,
    marginTop: 12,
  },
  exploreCtaBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },

  // Rewards List
  rewardsList: {
    gap: 12,
  },
  rewardCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
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
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  partnerTagText: {
    fontSize: 10,
    fontWeight: '700',
  },
  costBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  costBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#D97706',
  },
  rewardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.forest,
    marginBottom: 4,
  },
  rewardDesc: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    lineHeight: 17,
  },
  rewardDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 10,
  },
  rewardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  discountCol: {
    flex: 1,
    marginRight: 10,
  },
  discountValueText: {
    fontSize: 15,
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
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
  },
  redeemBtnDisabled: {
    backgroundColor: '#E2E8F0',
  },
  redeemBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  redeemBtnTextDisabled: {
    color: '#94A3B8',
  },

  // My Claims List
  claimsList: {
    gap: 12,
  },
  ticketCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.card,
  },
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  ticketPartnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ticketPartnerText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.forest,
    marginLeft: 6,
  },
  activePill: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  activePillText: {
    fontSize: 10,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  ticketTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.forest,
    marginBottom: 2,
  },
  ticketDate: {
    fontSize: 11,
    color: theme.colors.textTertiary,
    marginBottom: 10,
  },
  voucherBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    marginBottom: 8,
  },
  voucherLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  voucherCodeText: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.forest,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 2,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  copyBtnSuccess: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  copyBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.forest,
  },
  copyBtnTextSuccess: {
    color: '#FFFFFF',
  },
  ticketInstructions: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    lineHeight: 15,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 22,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    ...theme.shadows.card,
  },
  modalIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: theme.colors.forest,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 14,
  },
  modalDetailsBox: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  modalDetailLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  modalDetailCost: {
    fontSize: 12,
    fontWeight: '800',
    color: '#DC2626',
  },
  modalDetailVal: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.forest,
  },
  modalDetailRemaining: {
    fontSize: 12,
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
    backgroundColor: '#F1F5F9',
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalCancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  modalConfirmBtn: {
    flex: 1.4,
    backgroundColor: theme.colors.primary,
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalConfirmBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  // Success Modal
  voucherBoxModal: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#C6E7D2',
    borderStyle: 'dashed',
    alignItems: 'center',
    marginVertical: 12,
  },
  voucherCodeModal: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.forest,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 10,
  },
  doneBtn: {
    width: '100%',
    backgroundColor: theme.colors.forest,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
});
