import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Dimensions, Image, ActivityIndicator, RefreshControl, Animated, Linking } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { router } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import TopBar from '@/components/TopBar';
import { useCartStore } from '@/lib/cartStore';
import { productsApi, reportsApi, milkCollectionsApi, sellingEntriesApi, Product, HomeStats } from '@/lib/milkeyApi';
import { useAuth } from '@/hooks/useAuth';
import { Plus, Wallet, ChevronRight, Package, ChevronDown, Milk, ShoppingCart, Users } from 'lucide-react-native';
import { SubscriptionModal } from '@/components/SubscriptionModal';
import { useTranslation } from '@/hooks/useTranslation';
import { QuickEntryModal } from '@/components/QuickEntryModal';
import { QuickAdvanceModal } from '@/components/QuickAdvanceModal';
import { BulkEntryModal } from '@/components/BulkEntryModal';
import { useSubscriptionStore, shouldShowSubscriptionModal, markSubscriptionModalShown } from '@/lib/subscriptionStore';
import { SuccessModal } from '@/components/SuccessModal';
import { OverviewRangeModal } from '@/components/OverviewRangeModal';
import { useSubTabStore } from '@/lib/subTabStore';
import { setSuppressCollection, setSuppressSelling } from '@/lib/sheetSuppress';
import { vibrate } from '@/hooks/useTabSound';
import BannerCarousel from '@/components/BannerCarousel';
import SubscriptionReminder from '@/components/SubscriptionReminder';
import HomeFaqSection from '@/components/HomeFaqSection';
import HomeVideoSection from '@/components/HomeVideoSection';
import TutorialOverlay from '@/components/TutorialOverlay';
import HomeCalculator from '@/components/HomeCalculator';
import { useAppRating } from '@/hooks/useAppRating';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 18) / 2;
const BANNER_WIDTH = width - 12;

export default function HomeScreen() {
  const { colors, isDark } = useTheme();
  const { isAuthenticated } = useAuth();
  const { t } = useTranslation();
  useAppRating();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [homeStats, setHomeStats] = useState<HomeStats | null>(null);
  const [quantities, setQuantities] = useState<{ [key: string]: number }>({});
  const { addToCart, loadCart, getItemCount } = useCartStore();

  // Cart success notification
  const [cartSuccessVisible, setCartSuccessVisible] = useState(false);
  const [cartSuccessMessage, setCartSuccessMessage] = useState('');

  // Subscription modal state
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [subscriptionModalChecked, setSubscriptionModalChecked] = useState(false);

  // Quick Entry modal state
  const [showQuickEntryModal, setShowQuickEntryModal] = useState(false);

  // Quick Advance modal state
  const [showQuickAdvanceModal, setShowQuickAdvanceModal] = useState(false);

  // Bulk (one session) entry modal state
  const [showBulkEntryModal, setShowBulkEntryModal] = useState(false);

  // Overview range modal state (collection / selling breakdown by date range)
  const [overviewRangeKind, setOverviewRangeKind] = useState<'collection' | 'selling' | null>(null);
  const [homeDateRange, setHomeDateRange] = useState<{ startDate: string; endDate: string } | null>(null);
  const [rangeStats, setRangeStats] = useState<{ collQty: number; collAmt: number; sellQty: number; sellAmt: number } | null>(null);

  // Get subscription store - must be before useEffects that use status
  const { fetchStatus, preloadAllTabs, status, initializeFromStorage } = useSubscriptionStore();
  const { setSellingTab, setPurchaseTab, setRegisterTab, setSuppressCollectionSheet, setSuppressSellingSheet } = useSubTabStore();

  useEffect(() => {
    loadCart();
  }, []);

  // Refetch products when subscription status changes
  useEffect(() => {
    fetchData();
  }, [status?.hasAnySubscription]);

  // banner now pure BannerCarousel (image-only, no text) — ponytail fast

  // Check if subscription modal should be shown and preload subscription data
  useEffect(() => {
    const checkAndPreloadSubscriptions = async () => {
      if (!isAuthenticated || subscriptionModalChecked) return;

      try {
        // Initialize from storage first
        await initializeFromStorage();

        const shouldShow = await shouldShowSubscriptionModal();
        if (shouldShow) {
          const statusData = await fetchStatus();
          if (statusData) {
            // Preload all tab subscription data in background
            preloadAllTabs();
            // Fix: show modal ONLY when user has zero active subscriptions.
            // Previously required all 3 tabs, causing popup even after 1 subscription was active.
            if (!statusData.hasAnySubscription) {
              setShowSubscriptionModal(true);
              await markSubscriptionModalShown();
            }
          }
          // If statusData is null (network error), do NOT show modal — avoid false popup for active users when offline
        } else {
          // Even if not showing modal, preload subscription data for faster navigation
          preloadAllTabs();
        }
      } catch (error) {
        // Silent error handling
      }
      setSubscriptionModalChecked(true);
    };

    checkAndPreloadSubscriptions();
  }, [isAuthenticated, subscriptionModalChecked, fetchStatus, preloadAllTabs, initializeFromStorage]);

  // Refresh data when tab comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchHomeStats();
    }, [])
  );

  const fetchHomeStats = async () => {
    try {
      const homeStatsRes = await reportsApi.getHomeStats().catch(() => null);
      if (homeStatsRes?.success && homeStatsRes.response) {
        setHomeStats(homeStatsRes.response);
      }
    } catch (error) {
      // Silent error handling
    }
  };

  const fetchRangeStats = async (range: { startDate: string; endDate: string }) => {
    try {
      const [collRes, sellRes] = await Promise.all([
        milkCollectionsApi.getAll({ startDate: range.startDate, endDate: range.endDate, limit: 1, tzOffsetMinutes: -new Date().getTimezoneOffset() }).catch(() => null),
        sellingEntriesApi.getAll({ startDate: range.startDate, endDate: range.endDate, limit: 100 }).catch(() => null),
      ]);
      let collQty = 0, collAmt = 0;
      if (collRes?.success && (collRes.response as any)?.totals) { const t = (collRes.response as any).totals; collQty = t.quantity || 0; collAmt = t.amount || 0; }
      let sellQty = 0, sellAmt = 0;
      if (sellRes?.success && (sellRes.response as any)?.data) { for (const e of (sellRes.response as any).data) { const q = (e.morningQuantity || 0) + (e.eveningQuantity || 0); sellQty += q; sellAmt += e.amount || q * (e.rate || 0); } }
      setRangeStats({ collQty, collAmt, sellQty, sellAmt });
    } catch { setRangeStats({ collQty: 0, collAmt: 0, sellQty: 0, sellAmt: 0 }); }
  };

  const handleHomeRangeSelect = (range: { startDate: string; endDate: string } | null) => {
    if (!range) { setHomeDateRange(null); setRangeStats(null); fetchHomeStats(); return; }
    setHomeDateRange(range); fetchRangeStats(range);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const hasSubscription = status?.hasAnySubscription || false;
      const [productsRes, homeStatsRes] = await Promise.all([
        productsApi.getAll({ subscribed: hasSubscription }).catch(() => null),
        reportsApi.getHomeStats().catch(() => null),
      ]);
      if (productsRes?.success && productsRes.response?.data) {
        setProducts(productsRes.response.data);
        const iq: Record<string,number> = {};
        productsRes.response.data.forEach((p:any) => { iq[p._id]=1; });
        setQuantities(iq);
      }
      if (homeStatsRes?.success && homeStatsRes.response) setHomeStats(homeStatsRes.response);
    } catch {} finally { setLoading(false); }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, []);

  // banner auto-scroll now inside BannerCarousel (ponytail)

  const updateQuantity = (id: string, delta: number) => {
    setQuantities(prev => ({
      ...prev,
      [id]: Math.max(1, (prev[id] || 1) + delta)
    }));
  };

  const handleAddToCart = (product: Product) => {
    const quantity = quantities[product._id] || 1;
    addToCart(
      { id: product._id, name: product.name, price: product.price, icon: product.icon, image: product.image },
      quantity
    );
    const totalItems = getItemCount() + quantity;
    setCartSuccessMessage(`Added ${quantity} ${product.name} to cart (${totalItems} items in cart)`);
    setCartSuccessVisible(true);
  };

  // banner press handled inside BannerCarousel

  const styles = createStyles(colors, isDark);

  return (
    <View style={styles.container}>
      {/* Subscription Modal */}
      <SubscriptionModal
        visible={showSubscriptionModal}
        onClose={() => setShowSubscriptionModal(false)}
        title={t.home.choosePlan}
      />
      <TopBar />
      {/* Subscription Reminder below header */}
      <SubscriptionReminder />

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        <BannerCarousel />
        {/* Quick Overview — new design matching screenshot, same space */}
        <View style={styles.overviewHeaderRow}>
          <Text style={styles.sectionTitleNoMargin}>{t.home.quickOverview}</Text>
          <Pressable onPress={() => setOverviewRangeKind('collection')} style={styles.todayPill}>
            <Text style={styles.todayPillText}>{homeDateRange ? `${homeDateRange.startDate.split('-').reverse().join('/')} - ${homeDateRange.endDate.split('-').reverse().join('/')}` : t.home.today}</Text>
            <ChevronDown size={12} color={colors.mutedForeground} />
          </Pressable>
        </View>
        {(() => {
          const useRange = !!homeDateRange && !!rangeStats;
          const collQty = useRange ? rangeStats!.collQty : (homeStats?.today.quantity || 0);
          const collAmt = useRange ? rangeStats!.collAmt : (homeStats?.today.amount || 0);
          const collRate = collQty > 0 ? collAmt / collQty : 0;
          const sellQty = useRange ? rangeStats!.sellQty : (homeStats?.todaySell.quantity || 0);
          const sellAmt = useRange ? rangeStats!.sellAmt : (homeStats?.todaySell.amount || 0);
          const sellRate = sellQty > 0 ? sellAmt / sellQty : 0;
          const customers = homeStats?.totalMembers || 0;
          // Fix double-count: Farmer & PurchaseFarmer share same collection (Farmer model).
          // Use collection count directly (now filtered isActive:true in server-clone) — matches Farmer Management (140).
          const farmers = homeStats?.totalCollectionFarmers ?? homeStats?.totalFarmers ?? 0;
          return (
            <View style={styles.overviewCardNew}>
              {/* Top: Collection | Selling */}
              <View style={styles.overviewTopRow}>
                <Pressable style={styles.overviewCol} onPress={() => setOverviewRangeKind('collection')}>
                  <View style={styles.overviewColHeader}>
                    <View style={[styles.overviewIcon, { backgroundColor: isDark ? '#0f2e1a' : '#DCFCE7' }]}>
                      <Milk size={14} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.overviewColTitle} numberOfLines={1}>{homeDateRange ? 'Collection' : 'Today Collection'}</Text>
                      <Text style={styles.overviewColSub}>(Purchase)</Text>
                    </View>
                  </View>
                  <View style={styles.overviewMetricsRow}>
                    <View style={styles.metricCol}><Text style={styles.metricLabel}>Qty</Text><Text style={styles.metricValue}>{collQty.toFixed(1)} L</Text></View>
                    <View style={styles.metricCol}><Text style={styles.metricLabel}>Avg Rate</Text><Text style={styles.metricValue}>₹{collRate.toFixed(2)}</Text></View>
                    <View style={styles.metricCol}><Text style={styles.metricLabel}>Amount</Text><Text style={[styles.metricValue, styles.metricValueAmount]}>₹{collAmt.toFixed(0)}</Text></View>
                  </View>
                </Pressable>
                <View style={styles.overviewVDivider} />
                <Pressable style={styles.overviewCol} onPress={() => setOverviewRangeKind('selling')}>
                  <View style={styles.overviewColHeader}>
                    <View style={[styles.overviewIcon, { backgroundColor: isDark ? '#1e293b' : '#DBEAFE' }]}>
                      <ShoppingCart size={14} color="#2563EB" />
                    </View>
                    <Text style={styles.overviewColTitle} numberOfLines={1}>{homeDateRange ? 'Selling' : 'Today Selling'}</Text>
                  </View>
                  <View style={styles.overviewMetricsRow}>
                    <View style={styles.metricCol}><Text style={styles.metricLabel}>Qty</Text><Text style={styles.metricValue}>{sellQty.toFixed(1)} L</Text></View>
                    <View style={styles.metricCol}><Text style={styles.metricLabel}>Avg Rate</Text><Text style={styles.metricValue}>₹{sellRate.toFixed(2)}</Text></View>
                    <View style={styles.metricCol}><Text style={styles.metricLabel}>Amount</Text><Text style={[styles.metricValue, { color: '#2563EB' }]}>₹{sellAmt.toFixed(0)}</Text></View>
                  </View>
                </Pressable>
              </View>
              <View style={styles.overviewHDivider} />
              {/* Bottom: Farmers | Customers — Farmers first with plant icon */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.overviewBottomContent} style={styles.overviewBottomScroll}>
                <Pressable style={styles.overviewBottomItem} onPress={() => { vibrate(); setSuppressCollection(true); setSuppressCollectionSheet(true); setPurchaseTab('Farmer'); router.push('/(tabs)/purchase' as any); }}>
                  <View style={[styles.overviewIconSmall, { backgroundColor: isDark ? '#0f2e1a' : '#E8F5E9', width: 36, height: 36, borderRadius: 10 }]}>
                    <Image source={require('@/assets/images/farmer-hat-icon.png')} style={{ width: 26, height: 26 }} resizeMode="contain" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.bottomLabel}>Farmers</Text>
                    <Text style={[styles.bottomValue, { color: colors.primary }]}>{farmers}</Text>
                  </View>
                  <ChevronRight size={16} color={colors.mutedForeground} />
                </Pressable>
                <View style={styles.overviewVDividerSmall} />
                <Pressable style={styles.overviewBottomItem} onPress={() => { vibrate(); setSuppressSelling(true); setSuppressSellingSheet(true); setSellingTab('Customer'); router.push('/(tabs)/selling?tab=Customer' as any); }}>
                  <View style={[styles.overviewIconSmall, { backgroundColor: isDark ? '#3a2a12' : '#FEF9C3' }]}>
                    <Users size={14} color="#CA8A04" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.bottomLabel}>Customers</Text>
                    <Text style={styles.bottomValue}>{customers}</Text>
                  </View>
                  <ChevronRight size={16} color={colors.mutedForeground} />
                </Pressable>
              </ScrollView>
            </View>
          );
        })()}

        <OverviewRangeModal
          visible={overviewRangeKind !== null}
          kind={overviewRangeKind || 'collection'}
          onClose={() => setOverviewRangeKind(null)}
          onRangeSelect={handleHomeRangeSelect}
          initialRange={homeDateRange}
        />


        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>{t.home.quickActions}</Text>
        <View style={styles.quickActionsRow}>
          <Pressable
            style={styles.quickActionCard}
            onPress={() => setShowQuickEntryModal(true)}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: colors.secondary }]}>
              <Plus size={20} color={colors.primary} />
            </View>
            <Text style={styles.quickActionText}>{t.home.entry}</Text>
          </Pressable>
          <Pressable
            style={styles.quickActionCard}
            onPress={() => setShowQuickAdvanceModal(true)}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: colors.secondary }]}>
              <Wallet size={20} color={colors.primary} />
            </View>
            <Text style={styles.quickActionText}>{t.home.advance}</Text>
          </Pressable>
        </View>

        <HomeCalculator />
        <HomeVideoSection />
        <HomeFaqSection />

        {/* Quick Entry Modal */}
        <QuickEntryModal
          isVisible={showQuickEntryModal}
          onClose={() => setShowQuickEntryModal(false)}
          onSuccess={() => fetchHomeStats()}
          onBulkEntryPress={() => setShowBulkEntryModal(true)}
        />

        {/* Quick Advance Modal */}
        <QuickAdvanceModal
          isVisible={showQuickAdvanceModal}
          onClose={() => setShowQuickAdvanceModal(false)}
          onSuccess={() => fetchHomeStats()}
        />

        {/* Bulk (one session) Entry Modal */}
        <BulkEntryModal
          isVisible={showBulkEntryModal}
          onClose={() => setShowBulkEntryModal(false)}
          onSuccess={() => fetchHomeStats()}
        />


      </ScrollView>

      {/* Cart Added Success Modal */}
      <SuccessModal
        isVisible={cartSuccessVisible}
        onClose={() => setCartSuccessVisible(false)}
        title="Added to Cart"
        message={cartSuccessMessage}
      />
      {/* Tutorials as new user */}
      <TutorialOverlay />
    </View>
  );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 6,
    paddingBottom: 80,
  },
  bannerScrollContainer: {
    paddingTop: 6,
  },
  bannerSkeletonWrap: {
    paddingTop: 6,
  },
  bannerSkeleton: {
    width: BANNER_WIDTH,
    height: 140,
    borderRadius: 10,
    backgroundColor: colors.muted,
    // bottom border removed - clean flat look
  },
  banner: {
    width: BANNER_WIDTH,
    height: 140,
    borderRadius: 10,
    marginRight: 6,
    overflow: 'hidden',
    position: 'relative',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  bannerOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  bannerTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  bannerDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 10,
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.mutedForeground,
  },
  activeDot: {
    backgroundColor: colors.primary,
    width: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.foreground,
    marginBottom: 8,
    marginTop: 6,
  },
  sectionTitleNoMargin: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.foreground,
  },
  overviewHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    marginBottom: 6,
  },
  todayPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  todayPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.mutedForeground,
  },
  overviewCardNew: {
    backgroundColor: colors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 6,
    overflow: 'hidden',
  },
  overviewTopRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  overviewCol: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  overviewColHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  overviewIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overviewColTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.foreground,
  },
  overviewColSub: {
    fontSize: 10,
    fontWeight: '500',
    color: colors.mutedForeground,
  },
  overviewMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricCol: {
    alignItems: 'center',
    flex: 1,
  },
  metricLabel: {
    fontSize: 9,
    color: colors.mutedForeground,
    fontWeight: '500',
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.foreground,
  },
  metricValueAmount: {
    color: colors.primary,
  },
  overviewVDivider: {
    width: 1,
    backgroundColor: colors.border,
  },
  overviewHDivider: {
    height: 1,
    backgroundColor: colors.border,
  },
  overviewBottomScroll: {
    flexGrow: 0,
  },
  overviewBottomContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flexGrow: 1,
  },
  overviewBottomItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    minWidth: (width - 12) / 2,
  },
  overviewIconSmall: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomLabel: {
    fontSize: 10,
    color: colors.mutedForeground,
    fontWeight: '500',
  },
  bottomValue: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.foreground,
    marginTop: 1,
  },
  overviewVDividerSmall: {
    width: 1,
    height: 32,
    backgroundColor: colors.border,
    alignSelf: 'center',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  viewProductsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.secondary,
    marginBottom: 8,
    marginTop: 6,
  },
  viewProductsBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  bannerLinkBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  bannerLinkBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  overviewCard: {
    backgroundColor: colors.card,
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 6,
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  quickActionCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  quickActionIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.foreground,
  },
  overviewMain: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  overviewLabel: {
    fontSize: 10,
    color: colors.destructive,
    fontWeight: '600',
  },
  overviewSubLabel: {
    fontSize: 10,
    color: colors.mutedForeground,
  },
  overviewValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary,
  },
  overviewCollectionCol: {
    justifyContent: 'center',
  },
  overviewFormula: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.mutedForeground,
    marginTop: 1,
  },
  overviewStatSubValue: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  overviewDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border,
    marginHorizontal: 6,
  },
  overviewStat: {
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  overviewStatValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.foreground,
  },
  overviewStatLabel: {
    fontSize: 10,
    color: colors.mutedForeground,
  },
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 6,
  },
  productCard: {
    width: CARD_WIDTH,
    backgroundColor: colors.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 6,
    overflow: 'hidden',
  },
  productIconContainer: {
    width: '100%',
    height: 100,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productImage: {
    width: '100%',
    height: 100,
  },
  productIcon: {
    fontSize: 32,
  },
  productContent: {
    padding: 10,
    alignItems: 'center',
  },
  // productIcon: {
  //   fontSize: 22,
  // },
  productName: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 2,
  },
  productPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 8,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  quantityBtn: {
    width: 24,
    height: 24,
    borderRadius: 4,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
  },
  quantityText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
    minWidth: 20,
    textAlign: 'center',
  },
  addToCartBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    width: '100%',
    alignItems: 'center',
  },
  addToCartText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '600',
  },
  productPageBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.secondary,
    marginTop: 2,
    marginBottom: 8,
  },
  productPageBoxText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
});
