import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Dimensions, Image, ActivityIndicator, RefreshControl } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import TopBar from '@/components/TopBar';
import { useCartStore } from '@/lib/cartStore';
import { productsApi, reportsApi, userSubscriptionsApi, bannersApi, Product, HomeStats, Banner } from '@/lib/milkeyApi';
import { useAuth } from '@/hooks/useAuth';
import { Plus, Wallet } from 'lucide-react-native';
import { SubscriptionModal } from '@/components/SubscriptionModal';
import { shouldShowSubscriptionModal, markSubscriptionModalShown, storeSubscriptionStatus } from '@/lib/subscriptionStore';

const { width } = Dimensions.get('window');
const BANNER_WIDTH = width - 12;
const CARD_WIDTH = (width - 18) / 2;

// Default fallback banners
const defaultBanners = [
  {
    _id: '1',
    title: 'Fresh Dairy',
    image: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=800&h=300&fit=crop',
  },
  {
    _id: '2',
    title: 'Farm Fresh',
    image: 'https://images.unsplash.com/photo-1628088062854-d1870b4553da?w=800&h=300&fit=crop',
  },
  {
    _id: '3',
    title: 'Quality Milk',
    image: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=800&h=300&fit=crop',
  },
];

export default function HomeScreen() {
  const { colors, isDark } = useTheme();
  const { isAuthenticated } = useAuth();
  const [currentBanner, setCurrentBanner] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [banners, setBanners] = useState<Banner[]>(defaultBanners);
  const [products, setProducts] = useState<Product[]>([]);
  const [homeStats, setHomeStats] = useState<HomeStats | null>(null);
  const [quantities, setQuantities] = useState<{ [key: string]: number }>({});
  const bannerScrollRef = useRef<ScrollView>(null);
  const { addToCart, loadCart } = useCartStore();

  // Subscription modal state
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [subscriptionModalChecked, setSubscriptionModalChecked] = useState(false);

  useEffect(() => {
    loadCart();
    fetchData();
  }, []);

  // Check if subscription modal should be shown
  useEffect(() => {
    const checkSubscriptionModal = async () => {
      if (!isAuthenticated || subscriptionModalChecked) return;

      try {
        const shouldShow = await shouldShowSubscriptionModal();
        if (shouldShow) {
          // Check if user has any active subscription
          const statusRes = await userSubscriptionsApi.getStatus();
          if (statusRes.success && statusRes.response) {
            const { hasPurchase, hasSelling, hasRegister, hasAnySubscription } = statusRes.response;

            // Store status for quick access
            await storeSubscriptionStatus({ hasPurchase, hasSelling, hasRegister });

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
        }
      } catch (error) {
        // Silent error handling
      }
      setSubscriptionModalChecked(true);
    };

    checkSubscriptionModal();
  }, [isAuthenticated, subscriptionModalChecked]);

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
    try {
      // Fetch banners, products and home stats in parallel
      const [bannersRes, productsRes, homeStatsRes] = await Promise.all([
        bannersApi.getAll().catch(() => null),
        productsApi.getAll().catch(() => null),
        reportsApi.getHomeStats().catch(() => null),
      ]);

      // Set banners from API or use defaults
      if (bannersRes?.success && bannersRes.response && Array.isArray(bannersRes.response) && bannersRes.response.length > 0) {
        setBanners(bannersRes.response);
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
  };

  const styles = createStyles(colors, isDark);

  return (
    <View style={styles.container}>
      {/* Subscription Modal */}
      <SubscriptionModal
        visible={showSubscriptionModal}
        onClose={() => setShowSubscriptionModal(false)}
        title="Choose Your Plan"
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
            <View key={banner._id} style={styles.banner}>
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
            </View>
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

        {/* Quick Overview */}
        <Text style={styles.sectionTitle}>Quick Overview</Text>
        <View style={styles.overviewCard}>
          <View style={styles.overviewMain}>
            <View>
              <Text style={styles.overviewLabel}>Today</Text>
              <Text style={styles.overviewSubLabel}>Milk Collection</Text>
              <Text style={styles.overviewValue}>₹{homeStats?.today.amount.toFixed(0) || '0'}</Text>
            </View>
            <View style={styles.overviewDivider} />
            <View style={styles.overviewStat}>
              <Text style={styles.overviewStatValue}>{homeStats?.todaySell.quantity.toFixed(1) || '0'}L</Text>
              <Text style={styles.overviewStatLabel}>Sell Qty</Text>
            </View>
            <View style={styles.overviewDivider} />
            <View style={styles.overviewStat}>
              <Text style={[styles.overviewStatValue, { color: colors.warning }]}>{homeStats?.totalMembers || 0}</Text>
              <Text style={styles.overviewStatLabel}>Members</Text>
            </View>
            <View style={styles.overviewDivider} />
            <View style={styles.overviewStat}>
              <Text style={[styles.overviewStatValue, { color: colors.primary }]}>{homeStats?.totalFarmers || 0}</Text>
              <Text style={styles.overviewStatLabel}>Farmers</Text>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActionsRow}>
          <Pressable
            style={styles.quickActionCard}
            onPress={() => router.push('/(tabs)/selling?tab=Entry')}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: colors.secondary }]}>
              <Plus size={20} color={colors.primary} />
            </View>
            <Text style={styles.quickActionText}>Entry</Text>
          </Pressable>
          <Pressable
            style={styles.quickActionCard}
            onPress={() => router.push('/(tabs)/register?tab=Advances')}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: colors.secondary }]}>
              <Wallet size={20} color={colors.primary} />
            </View>
            <Text style={styles.quickActionText}>Advance</Text>
          </Pressable>
        </View>

        {/* Products */}
        <Text style={styles.sectionTitle}>Products</Text>
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
                  <Text style={styles.addToCartText}>Add to Cart</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
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
  overviewDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border,
    marginHorizontal: 10,
  },
  overviewStat: {
    alignItems: 'center',
    flex: 1,
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
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    marginBottom: 6,
  },
  productIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  productImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginBottom: 6,
  },
  productIcon: {
    fontSize: 22,
  },
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
