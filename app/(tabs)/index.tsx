import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Dimensions, TextInput } from 'react-native';
import { ShoppingCart, Minus, Plus } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import TopBar from '@/components/TopBar';

const { width } = Dimensions.get('window');
const BANNER_WIDTH = width - 12;
const CARD_WIDTH = (width - 18) / 2;

// Mock Data for dairy app
const banners = [
  {
    id: '1',
    title: 'Farm Direct',
    image: '🐄🥛',
    gradient: ['#22C55E', '#16A34A'],
  },
  {
    id: '2',
    title: 'Fresh Delivery',
    image: '🚚',
    gradient: ['#3B82F6', '#1D4ED8'],
  },
  {
    id: '3',
    title: 'Quality Milk',
    image: '🌾',
    gradient: ['#F59E0B', '#D97706'],
  },
];

const quickOverview = {
  totalPurchase: 0,
  liters: 0,
  sales: '-',
  pending: '-',
  farmers: 5,
};

const products = [
  { id: '1', name: 'Fresh Milk', price: 60, icon: '🥛' },
  { id: '2', name: 'Curd (Dahi)', price: 80, icon: '🍶' },
  { id: '3', name: 'Butter', price: 500, icon: '🧈' },
  { id: '4', name: 'Paneer', price: 380, icon: '🧀' },
];

export default function HomeScreen() {
  const { colors, isDark } = useTheme();
  const [currentBanner, setCurrentBanner] = useState(0);
  const [quantities, setQuantities] = useState<{ [key: string]: number }>({
    '1': 1, '2': 1, '3': 1, '4': 1
  });
  const bannerScrollRef = useRef<ScrollView>(null);

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
            <View
              key={banner.id}
              style={[styles.banner, { backgroundColor: banner.gradient[0] }]}
            >
              <Text style={styles.bannerTitle}>{banner.title}</Text>
              <Text style={styles.bannerImage}>{banner.image}</Text>
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
              <Text style={styles.overviewSubLabel}>Total Purchase</Text>
              <Text style={styles.overviewValue}>₹{quickOverview.totalPurchase}</Text>
              <Text style={styles.overviewSmall}>{quickOverview.liters}L × 0</Text>
            </View>
            <View style={styles.overviewDivider} />
            <View style={styles.overviewStat}>
              <Text style={styles.overviewStatValue}>{quickOverview.sales}</Text>
              <Text style={styles.overviewStatLabel}>Sales</Text>
            </View>
            <View style={styles.overviewDivider} />
            <View style={styles.overviewStat}>
              <Text style={styles.overviewStatValue}>{quickOverview.pending}</Text>
              <Text style={styles.overviewStatLabel}>Pending</Text>
            </View>
            <View style={styles.overviewDivider} />
            <View style={styles.overviewStat}>
              <Text style={[styles.overviewStatValue, { color: colors.primary }]}>{quickOverview.farmers}</Text>
              <Text style={styles.overviewStatLabel}>Farmers</Text>
            </View>
          </View>
        </View>

        {/* Products */}
        <Text style={styles.sectionTitle}>Products</Text>
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
                <Text style={styles.quantityText}>{quantities[product.id]}</Text>
                <Pressable
                  style={styles.quantityBtn}
                  onPress={() => updateQuantity(product.id, 1)}
                >
                  <Text style={styles.quantityBtnText}>+</Text>
                </Pressable>
              </View>

              <Pressable style={styles.addToCartBtn}>
                <Text style={styles.addToCartText}>Add to Cart</Text>
              </Pressable>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
    borderRadius: 4,
    padding: 12,
    height: 100,
    marginRight: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bannerTitle: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '700',
  },
  bannerImage: {
    fontSize: 40,
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
  overviewSmall: {
    fontSize: 9,
    color: colors.mutedForeground,
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
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  productIcon: {
    fontSize: 24,
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
    gap: 12,
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
    paddingHorizontal: 20,
    borderRadius: 6,
    width: '100%',
    alignItems: 'center',
  },
  addToCartText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
});