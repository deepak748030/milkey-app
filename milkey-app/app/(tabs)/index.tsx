import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Dimensions, Image, ActivityIndicator, RefreshControl, Animated, Linking } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import TopBar from '@/components/TopBar';
import { useCartStore } from '@/lib/cartStore';
import { productsApi, reportsApi, bannersApi, Product, HomeStats, Banner } from '@/lib/milkeyApi';
import { useAuth } from '@/hooks/useAuth';
import { Plus, Wallet, ChevronRight, Package } from 'lucide-react-native';
import { SubscriptionModal } from '@/components/SubscriptionModal';
import { useTranslation } from '@/hooks/useTranslation';
import { QuickEntryModal } from '@/components/QuickEntryModal';
import { QuickAdvanceModal } from '@/components/QuickAdvanceModal';
import { BulkEntryModal } from '@/components/BulkEntryModal';
import { useSubscriptionStore, shouldShowSubscriptionModal, markSubscriptionModalShown } from '@/lib/subscriptionStore';
import { SuccessModal } from '@/components/SuccessModal';
import { OverviewRangeModal } from '@/components/OverviewRangeModal';
import { useSubTabStore } from '@/lib/subTabStore';

const { width } = Dimensions.get('window');
const BANNER_WIDTH = width - 12;
const CARD_WIDTH = (width - 18) / 2;

export default function HomeScreen() {
  const { colors, isDark } = useTheme();
  const { isAuthenticated } = useAuth();
  const { t } = useTranslation();
  const [currentBanner, setCurrentBanner] = useState(0);
  const [loading, setLoading] = useState(true);
  const [bannersLoading, setBannersLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [homeStats, setHomeStats] = useState<HomeStats | null>(null);
  const [quantities, setQuantities] = useState<{ [key: string]: number }>({});
  const bannerScrollRef = useRef<ScrollView>(null);
  const bannerSkeletonOpacity = useRef(new Animated.Value(0.4)).current;
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

  // Get subscription store - must be before useEffects that use status
  const { fetchStatus, preloadAllTabs, status, initializeFromStorage } = useSubscriptionStore();
  const { setSellingTab, setPurchaseTab, setRegisterTab } = useSubTabStore();

  useEffect(() => {
    loadCart();
  }, []);

  // Refetch products when subscription status changes
  useEffect(() => {
    fetchData();
  }, [status?.hasAnySubscription]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bannerSkeletonOpacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(bannerSkeletonOpacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );

    loop.start();
    return () => loop.stop();
  }, [bannerSkeletonOpacity]);

  // Check if subscription modal should be shown and preload subscription data
  useEffect(() => {
    const checkAndPreloadSubscriptions = async () => {
      if (!isAuthenticated || subscriptionModalChecked) return;

      try {
        // Initialize from storage first
        await initializeFromStorage();

        const shouldShow = await shouldShowSubscriptionModal();
        if (shouldShow) {
          // Fetch status and preload all tabs data
          const statusData = await fetchStatus();

          if (statusData) {
            const { hasPurchase, hasSelling, hasRegister, hasAnySubscription } = statusData;

            // Preload all tab subscription data in background
            preloadAllTabs();

            // Show modal if user doesn't have all subscriptions
            if (!hasAnySubscription || !hasPurchase || !hasSelling || !hasRegister) {
              setShowSubscriptionModal(true);
              await markSubscriptionModalShown();
            }
          } else {
            // No subscription data, show modal
            setShowSubscriptionModal(true);
            await markSubscriptionModalShown();
          }
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

  const fetchData = async () => {
    setLoading(true);
    setBannersLoading(true);
    try {
      // Check if user has any active subscription
      const hasSubscription = status?.hasAnySubscription || false;

      // Fetch banners, products and home stats in parallel
      const [bannersRes, productsRes, homeStatsRes] = await Promise.all([
        bannersApi.getAll().catch(() => null),
        productsApi.getAll({ subscribed: hasSubscription }).catch(() => null),
        reportsApi.getHomeStats().catch(() => null),
      ]);

      // Set banners from API only
      if (bannersRes?.success) {
        setBanners(bannersRes.response || []);
      } else {
        setBanners([]);
      }

      if (productsRes?.success && productsRes.response?.data) {
        setProducts(productsRes.response.data);

        // Initialize quantities
        const initialQuantities: { [key: string]: number } = {};
        productsRes.response.data.forEach(p => { initialQuantities[p._id] = 1; });
        setQuantities(initialQuantities);
      }

      if (homeStatsRes?.success && homeStatsRes.response) {
        setHomeStats(homeStatsRes.response);
      }
    } catch (error) {
      // Silent error handling
    } finally {
      setLoading(false);
      setBannersLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, []);

  // Auto-scroll banner
  useEffect(() => {
    if (banners.length === 0) return;
    const interval = setInterval(() => {
      const nextIndex = (currentBanner + 1) % banners.length;
      bannerScrollRef.current?.scrollTo({ x: nextIndex * BANNER_WIDTH, animated: true });
      setCurrentBanner(nextIndex);
    }, 3000);
    return () => clearInterval(interval);
  }, [currentBanner, banners.length]);

  const handleBannerScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / BANNER_WIDTH);
    setCurrentBanner(index);
  };

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

  // Open banner hyperlink (e.g. YouTube tutorial video / any URL)
  const handleBannerPress = async (banner: Banner) => {
    const url = (banner.linkValue || '').trim();
    if (!url) return;
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      }
    } catch (error) {
      // Silent — invalid or unsupported URL
    }
  };

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
        {/* Banner Carousel */}
        {bannersLoading ? (
          <View style={styles.bannerSkeletonWrap}>
            <Animated.View style={[styles.bannerSkeleton, { opacity: bannerSkeletonOpacity }]} />
          </View>
        ) : banners.length > 0 ? (
          <>
            <ScrollView
              ref={bannerScrollRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={handleBannerScroll}
              scrollEventThrottle={16}
              contentContainerStyle={styles.bannerScrollContainer}
            >
              {banners.map((banner) => (
                <Pressable
                  key={banner._id}
                  style={styles.banner}
                  onPress={() => handleBannerPress(banner)}
                >
                  <Image
                    source={{ uri: banner.image }}
                    style={styles.bannerImage}
                    resizeMode="cover"
                  />
                  {banner.title && (
                    <View style={styles.bannerOverlay}>
                      <Text style={styles.bannerTitle}>{banner.title}</Text>
                    </View>
                  )}
                  {!!banner.linkValue && (
                    <View style={styles.bannerLinkBadge}>
                      <Text style={styles.bannerLinkBadgeText}>🔗 Link</Text>
                    </View>
                  )}
                </Pressable>
              ))}
            </ScrollView>

            {/* Banner Dots */}
            <View style={styles.bannerDots}>
              {banners.map((_, index) => (
                <Pressable key={index} onPress={() => {
                  bannerScrollRef.current?.scrollTo({ x: index * BANNER_WIDTH, animated: true });
                  setCurrentBanner(index);
                }}>
                  <View style={[styles.dot, currentBanner === index && styles.activeDot]} />
                </Pressable>
              ))}
            </View>
          </>
        ) : null
        }
        {/* Quick Overview */}
        <Text style={styles.sectionTitle}>{t.home.quickOverview}</Text>
        <View style={styles.overviewCard}>
          <View style={styles.overviewMain}>
            <Pressable style={styles.overviewCollectionCol} onPress={() => setOverviewRangeKind('collection')}>
              <Text style={styles.overviewLabel}>{t.home.today}</Text>
              <Text style={styles.overviewSubLabel}>{t.home.milkCollection}</Text>
              {(() => {
                const qty = homeStats?.today.quantity || 0;
                const amt = homeStats?.today.amount || 0;
                const rate = qty > 0 ? amt / qty : 0;
                return (
                  <Text style={styles.overviewFormula}>
                    {qty.toFixed(1)} × {rate.toFixed(2)}
                  </Text>
                );
              })()}
              <Text style={styles.overviewValue}>₹{(homeStats?.today.amount || 0).toFixed(0)}</Text>
            </Pressable>
            <View style={styles.overviewDivider} />
            <Pressable style={styles.overviewStat} onPress={() => setOverviewRangeKind('selling')}>
              <Text style={styles.overviewStatValue}>{(homeStats?.todaySell.quantity || 0).toFixed(1)}L</Text>
              <Text style={styles.overviewStatLabel} numberOfLines={1}>{t.home.sellQty}</Text>
              <Text style={[styles.overviewStatSubValue, { color: colors.primary }]}>₹{(homeStats?.todaySell.amount || 0).toFixed(0)}</Text>
            </Pressable>
            <View style={styles.overviewDivider} />
            <Pressable style={styles.overviewStat} onPress={() => { setSellingTab('Member'); router.push('/(tabs)/selling?tab=Member'); }}>
              <Text style={[styles.overviewStatValue, { color: colors.warning }]}>{homeStats?.totalMembers || 0}</Text>
              <Text style={styles.overviewStatLabel} numberOfLines={1}>{t.home.members}</Text>
            </Pressable>
            <View style={styles.overviewDivider} />
            <Pressable style={styles.overviewStat} onPress={() => { setPurchaseTab('C-Farmer'); router.push('/(tabs)/purchase'); }}>
              <Text style={[styles.overviewStatValue, { color: colors.primary }]}>{homeStats?.totalCollectionFarmers || 0}</Text>
              <Text style={styles.overviewStatLabel} numberOfLines={1}>{t.home.cFarmer}</Text>
            </Pressable>
            <View style={styles.overviewDivider} />
            <Pressable style={styles.overviewStat} onPress={() => { setRegisterTab('R-Farmer'); router.push('/(tabs)/register'); }}>
              <Text style={[styles.overviewStatValue, { color: colors.destructive }]}>{homeStats?.totalFarmers || 0}</Text>
              <Text style={styles.overviewStatLabel} numberOfLines={1}>{t.home.rFarmer}</Text>
            </Pressable>
          </View>
        </View>

        <OverviewRangeModal
          visible={overviewRangeKind !== null}
          kind={overviewRangeKind || 'collection'}
          onClose={() => setOverviewRangeKind(null)}
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

        {/* Products */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>{t.home.products}</Text>
          <Pressable style={styles.viewProductsBtn} onPress={() => router.push('/products')}>
            <Package size={13} color={colors.primary} />
            <Text style={styles.viewProductsBtnText}>{t.home.product}</Text>
            <ChevronRight size={13} color={colors.primary} />
          </Pressable>
        </View>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <View style={styles.productsGrid}>
            {products.map((product) => (
              <View key={product._id} style={styles.productCard}>
                {product.image ? (
                  <Image
                    source={{ uri: product.image }}
                    style={styles.productImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.productIconContainer}>
                    <Text style={styles.productIcon}>{product.icon}</Text>
                  </View>
                )}
                <View style={styles.productContent}>
                  <Text style={styles.productName}>{product.name}</Text>
                  <Text style={styles.productPrice}>₹{product.price}</Text>

                  <View style={styles.quantityRow}>
                    <Pressable
                      style={styles.quantityBtn}
                      onPress={() => updateQuantity(product._id, -1)}
                    >
                      <Text style={styles.quantityBtnText}>-</Text>
                    </Pressable>
                    <Text style={styles.quantityText}>{quantities[product._id] || 1}</Text>
                    <Pressable
                      style={styles.quantityBtn}
                      onPress={() => updateQuantity(product._id, 1)}
                    >
                      <Text style={styles.quantityBtnText}>+</Text>
                    </Pressable>
                  </View>

                  <Pressable style={styles.addToCartBtn} onPress={() => handleAddToCart(product)}>
                    <Text style={styles.addToCartText}>{t.home.addToCart}</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Cart Added Success Modal */}
      <SuccessModal
        isVisible={cartSuccessVisible}
        onClose={() => setCartSuccessVisible(false)}
        title="Added to Cart"
        message={cartSuccessMessage}
      />
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
    borderWidth: 1,
    borderColor: colors.border,
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
});
