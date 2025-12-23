import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Dimensions, Image, Alert, ActivityIndicator } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { router } from 'expo-router';
import TopBar from '@/components/TopBar';
import { useCartStore } from '@/lib/cartStore';
import { productsApi, reportsApi, Product, DashboardStats } from '@/lib/milkeyApi';
import { useAuth } from '@/hooks/useAuth';

const { width } = Dimensions.get('window');
const BANNER_WIDTH = width - 12;
const CARD_WIDTH = (width - 18) / 2;

// Banner images - dairy farm themed
const banners = [
  {
    id: '1',
    image: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=800&h=300&fit=crop',
    gradient: '#22C55E',
  },
  {
    id: '2',
    image: 'https://images.unsplash.com/photo-1628088062854-d1870b4553da?w=800&h=300&fit=crop',
    gradient: '#3B82F6',
  },
  {
    id: '3',
    image: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=800&h=300&fit=crop',
    gradient: '#F59E0B',
  },
];

// Default products for fallback
const defaultProducts = [
  { id: '1', name: 'Fresh Milk', price: 60, icon: '🥛' },
  { id: '2', name: 'Curd (Dahi)', price: 80, icon: '🍶' },
  { id: '3', name: 'Butter', price: 500, icon: '🧈' },
  { id: '4', name: 'Paneer', price: 380, icon: '🧀' },
];

export default function HomeScreen() {
  const { colors, isDark } = useTheme();
  const { isAuthenticated } = useAuth();
  const [currentBanner, setCurrentBanner] = useState(0);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState(defaultProducts);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [quantities, setQuantities] = useState<{ [key: string]: number }>({});
  const bannerScrollRef = useRef<ScrollView>(null);
  const { addToCart, loadCart } = useCartStore();

  useEffect(() => {
    loadCart();
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch products and dashboard stats in parallel
      const [productsRes, dashboardRes] = await Promise.all([
        productsApi.getAll().catch(() => null),
        reportsApi.getDashboard().catch(() => null),
      ]);

      if (productsRes?.success && productsRes.response?.data) {
        const apiProducts = productsRes.response.data.map(p => ({
          id: p._id,
          name: p.name,
          price: p.price,
          icon: p.icon,
        }));
        setProducts(apiProducts.length > 0 ? apiProducts : defaultProducts);

        // Initialize quantities
        const initialQuantities: { [key: string]: number } = {};
        apiProducts.forEach(p => { initialQuantities[p.id] = 1; });
        setQuantities(initialQuantities);
      } else {
        // Use default products
        const initialQuantities: { [key: string]: number } = {};
        defaultProducts.forEach(p => { initialQuantities[p.id] = 1; });
        setQuantities(initialQuantities);
      }

      if (dashboardRes?.success && dashboardRes.response) {
        setDashboardStats(dashboardRes.response);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Auto-scroll banner
  useEffect(() => {
    const interval = setInterval(() => {
      const nextIndex = (currentBanner + 1) % banners.length;
      bannerScrollRef.current?.scrollTo({ x: nextIndex * BANNER_WIDTH, animated: true });
      setCurrentBanner(nextIndex);
    }, 3000);
    return () => clearInterval(interval);
  }, [currentBanner]);

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

  const handleAddToCart = (product: typeof products[0]) => {
    const quantity = quantities[product.id] || 1;
    addToCart(
      { id: product.id, name: product.name, price: product.price, icon: product.icon },
      quantity
    );
  };

  const styles = createStyles(colors, isDark);

  return (
    <View style={styles.container}>
      <TopBar />

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
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
            <View key={banner.id} style={styles.banner}>
              <Image
                source={{ uri: banner.image }}
                style={styles.bannerImage}
                resizeMode="cover"
              />
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
              <Text style={styles.overviewValue}>₹{dashboardStats?.today.amount.toFixed(0) || '0'}</Text>
            </View>
            <View style={styles.overviewDivider} />
            <View style={styles.overviewStat}>
              <Text style={styles.overviewStatValue}>{dashboardStats?.today.quantity.toFixed(1) || '0'}L</Text>
              <Text style={styles.overviewStatLabel}>Today Qty</Text>
            </View>
            <View style={styles.overviewDivider} />
            <View style={styles.overviewStat}>
              <Text style={[styles.overviewStatValue, { color: colors.success }]}>₹{dashboardStats?.thisMonth.amount.toFixed(0) || '0'}</Text>
              <Text style={styles.overviewStatLabel}>This Month</Text>
            </View>
            <View style={styles.overviewDivider} />
            <View style={styles.overviewStat}>
              <Text style={[styles.overviewStatValue, { color: colors.primary }]}>{dashboardStats?.totalFarmers || 0}</Text>
              <Text style={styles.overviewStatLabel}>Farmers</Text>
            </View>
          </View>
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
              <View key={product.id} style={styles.productCard}>
                <View style={styles.productIconContainer}>
                  <Text style={styles.productIcon}>{product.icon}</Text>
                </View>
                <Text style={styles.productName}>{product.name}</Text>
                <Text style={styles.productPrice}>₹{product.price}</Text>

                <View style={styles.quantityRow}>
                  <Pressable
                    style={styles.quantityBtn}
                    onPress={() => updateQuantity(product.id, -1)}
                  >
                    <Text style={styles.quantityBtnText}>-</Text>
                  </Pressable>
                  <Text style={styles.quantityText}>{quantities[product.id] || 1}</Text>
                  <Pressable
                    style={styles.quantityBtn}
                    onPress={() => updateQuantity(product.id, 1)}
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
  },
  bannerImage: {
    width: '100%',
    height: '100%',
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
    marginBottom: 10,
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
