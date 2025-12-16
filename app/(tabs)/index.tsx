import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Dimensions, Image } from 'react-native';
import { ShoppingCart, Wallet, Users, Star, RefreshCw, ArrowRight, Droplets, Package, Truck, Clock } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import TopBar from '@/components/TopBar';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');
const BANNER_WIDTH = width - 24;
const CARD_WIDTH = (width - 12 - 8) / 2;

// Mock Data
const categories = [
  { id: '1', name: 'Milk', icon: '🥛', color: '#DCFCE7' },
  { id: '2', name: 'Curd', icon: '🍶', color: '#FEE2E2' },
  { id: '3', name: 'Cheese', icon: '🧀', color: '#FEF3C7' },
  { id: '4', name: 'Butter', icon: '🧈', color: '#D1FAE5' },
  { id: '5', name: 'Paneer', icon: '🧊', color: '#E0E7FF' },
  { id: '6', name: 'Ghee', icon: '🫗', color: '#FED7AA' },
  { id: '7', name: 'Cream', icon: '🍦', color: '#FCE7F3' },
  { id: '8', name: 'Lassi', icon: '🥤', color: '#CFFAFE' },
];

const products = [
  { id: '1', name: 'Fresh Milk', price: '₹52/L', quantity: '1 Liter', icon: '🥛', badge: 'Best Seller' },
  { id: '2', name: 'Buffalo Milk', price: '₹68/L', quantity: '1 Liter', icon: '🥛', badge: 'Premium' },
  { id: '3', name: 'A2 Cow Milk', price: '₹85/L', quantity: '1 Liter', icon: '🥛', badge: 'Organic' },
  { id: '4', name: 'Toned Milk', price: '₹48/L', quantity: '1 Liter', icon: '🥛', badge: 'Low Fat' },
];

const quickActions = [
  { id: '1', name: 'My Orders', icon: Package, color: '#F59E0B' },
  { id: '2', name: 'Schedule', icon: Clock, color: '#8B5CF6' },
];

const banners = [
  {
    id: '1',
    title: 'Quality Assured',
    subtitle: 'Premium dairy products with guaranteed freshness',
    badge: 'New',
    image: '🥛',
    gradient: ['#22C55E', '#16A34A'],
  },
  {
    id: '2',
    title: 'Fresh Daily',
    subtitle: 'Get fresh milk delivered to your doorstep',
    badge: 'Hot',
    image: '🚚',
    gradient: ['#3B82F6', '#1D4ED8'],
  },
  {
    id: '3',
    title: 'Farm Fresh',
    subtitle: 'Direct from local farmers to your home',
    badge: 'Organic',
    image: '🌾',
    gradient: ['#F59E0B', '#D97706'],
  },
];

const stats = [
  { id: '1', icon: ShoppingCart, value: '125', label: 'Milk Collected (L)', badge: 'Today' },
  { id: '2', icon: Wallet, value: '₹45,680', label: 'Total Revenue', badge: 'Active' },
  { id: '3', icon: Users, value: '24', label: 'Registered Farmers', badge: 'Total' },
  { id: '4', icon: Star, value: '₹28/L', label: 'Average Rate', badge: 'Avg' },
];

export default function HomeScreen() {
  const { colors, isDark } = useTheme();
  const [currentBanner, setCurrentBanner] = useState(0);
  const bannerScrollRef = useRef<ScrollView>(null);

  const handleBannerScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / BANNER_WIDTH);
    setCurrentBanner(index);
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
        {/* Banner Carousel - Scrollable */}
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
            <LinearGradient
              key={banner.id}
              colors={isDark ? ['#1E3A2F', banner.gradient[1]] as const : [banner.gradient[0], banner.gradient[1]] as const}
              style={styles.banner}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.bannerBadge}>
                <Text style={styles.bannerBadgeText}>{banner.badge}</Text>
              </View>
              <View style={styles.bannerRow}>
                <View style={styles.bannerContent}>
                  <Text style={styles.bannerTitle}>{banner.title}</Text>
                  <Text style={styles.bannerSubtitle}>{banner.subtitle}</Text>
                </View>
                <View style={styles.bannerImageContainer}>
                  <Text style={styles.bannerImage}>{banner.image}</Text>
                </View>
              </View>
            </LinearGradient>
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
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Quick Overview</Text>
          <Pressable style={styles.refreshButton}>
            <RefreshCw size={14} color={colors.mutedForeground} />
            <Text style={styles.refreshText}>Refresh</Text>
          </Pressable>
        </View>

        {/* Stats Grid - 2x2 Centered */}
        <View style={styles.statsGrid}>
          {stats.map((stat, index) => {
            const IconComponent = stat.icon;
            return (
              <View key={stat.id} style={[styles.statCard, { backgroundColor: index % 2 === 0 ? colors.statCard1 : colors.statCard2 }]}>
                <View style={styles.statHeader}>
                  <View style={styles.statIconContainer}>
                    <IconComponent size={18} color={colors.primary} strokeWidth={2} />
                  </View>
                  <View style={styles.statBadge}>
                    <Text style={styles.statBadgeText}>{stat.badge}</Text>
                  </View>
                </View>
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
            );
          })}
        </View>

        {/* Milk Purchase Cards */}
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Buy Fresh Milk</Text>
            <Text style={styles.sectionSubtitle}>Farm fresh dairy delivered daily</Text>
          </View>
          <Pressable style={styles.viewAllButton}>
            <Text style={styles.viewAllText}>View All</Text>
            <ArrowRight size={14} color={colors.primary} />
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.productsContainer}
        >
          {products.map((product) => (
            <Pressable key={product.id} style={styles.productCard}>
              <View style={styles.productBadge}>
                <Text style={styles.productBadgeText}>{product.badge}</Text>
              </View>
              <View style={styles.productIconContainer}>
                <Text style={styles.productIcon}>{product.icon}</Text>
              </View>
              <Text style={styles.productName}>{product.name}</Text>
              <Text style={styles.productQuantity}>{product.quantity}</Text>
              <View style={styles.productPriceRow}>
                <Text style={styles.productPrice}>{product.price}</Text>
                <Pressable style={styles.addButton}>
                  <Text style={styles.addButtonText}>Add</Text>
                </Pressable>
              </View>
            </Pressable>
          ))}
        </ScrollView>

        {/* Product Categories */}
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Product Categories</Text>
            <Text style={styles.sectionSubtitle}>Explore our dairy products</Text>
          </View>
          <Pressable style={styles.viewAllButton}>
            <Text style={styles.viewAllText}>View All</Text>
            <ArrowRight size={14} color={colors.primary} />
          </Pressable>
        </View>

        {/* Categories Grid */}
        <View style={styles.categoriesGrid}>
          {categories.map((category) => (
            <Pressable key={category.id} style={styles.categoryCard}>
              <View style={[styles.categoryIconContainer, { backgroundColor: category.color }]}>
                <Text style={styles.categoryIcon}>{category.icon}</Text>
              </View>
              <Text style={styles.categoryName}>{category.name}</Text>
            </Pressable>
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
    paddingTop: 8,
    paddingHorizontal: 6,
  },
  banner: {
    width: BANNER_WIDTH,
    borderRadius: 12,
    padding: 16,
    minHeight: 130,
    marginRight: 12,
  },
  bannerBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: colors.white,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  bannerBadgeText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '600',
  },
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  bannerContent: {
    flex: 1,
  },
  bannerTitle: {
    color: colors.white,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 6,
  },
  bannerSubtitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    maxWidth: '90%',
  },
  bannerImageContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerImage: {
    fontSize: 36,
  },
  bannerDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: 12,
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.mutedForeground,
  },
  activeDot: {
    backgroundColor: colors.primary,
    width: 18,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.foreground,
  },
  sectionSubtitle: {
    fontSize: 11,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  refreshText: {
    fontSize: 12,
    color: colors.mutedForeground,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewAllText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  statCard: {
    width: CARD_WIDTH,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(34,197,94,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statBadgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '600',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: isDark ? colors.white : colors.foreground,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    color: colors.mutedForeground,
  },
  productsContainer: {
    paddingRight: 6,
    gap: 10,
    marginBottom: 16,
  },
  productCard: {
    width: 140,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  productBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  productBadgeText: {
    color: colors.white,
    fontSize: 8,
    fontWeight: '600',
  },
  productIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    alignSelf: 'center',
  },
  productIcon: {
    fontSize: 24,
  },
  productName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 2,
  },
  productQuantity: {
    fontSize: 11,
    color: colors.mutedForeground,
    marginBottom: 8,
  },
  productPriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  productPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  addButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  addButtonText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '600',
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 16,
  },
  categoryCard: {
    alignItems: 'center',
    width: (width - 12 - 40) / 4,
  },
  categoryIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  categoryIcon: {
    fontSize: 26,
  },
  categoryName: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.foreground,
  },
});
