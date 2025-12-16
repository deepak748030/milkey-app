import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ShoppingCart, Wallet, Users, Star, RefreshCw, ArrowRight } from 'lucide-react-native';
import { colors } from '@/lib/colors';
import TopBar from '@/components/TopBar';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 32 - 8) / 2;

const categories = [
  { id: '1', name: 'Milk', color: '#F3E8FF', icon: '🥛' },
  { id: '2', name: 'Curd', color: '#FEE2E2', icon: '🍶' },
  { id: '3', name: 'Cheese', color: '#FEF3C7', icon: '🧀' },
  { id: '4', name: 'Butter', color: '#DCFCE7', icon: '🧈' },
];

const banners = [
  {
    id: '1',
    title: 'Quality Assured',
    subtitle: 'Premium dairy products with guaranteed freshness',
    badge: 'New',
  },
  {
    id: '2',
    title: 'Fresh Daily',
    subtitle: 'Get fresh milk delivered to your doorstep',
    badge: 'Hot',
  },
];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [currentBanner, setCurrentBanner] = useState(0);

  const stats = [
    {
      icon: ShoppingCart,
      value: '125',
      label: 'Milk Collected (L)',
      badge: 'Today',
      bgColor: colors.statCard1
    },
    {
      icon: Wallet,
      value: '₹45,680',
      label: 'Total Revenue',
      badge: 'Active',
      bgColor: colors.statCard2
    },
    {
      icon: Users,
      value: '24',
      label: 'Registered Farmers',
      badge: 'Total',
      bgColor: colors.statCard1
    },
    {
      icon: Star,
      value: '₹28/L',
      label: 'Average Rate',
      badge: 'Avg',
      bgColor: colors.statCard2
    },
  ];

  return (
    <View style={styles.container}>
      <TopBar />

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Banner Carousel */}
        <View style={styles.bannerContainer}>
          <LinearGradient
            colors={['#1A5A7A', '#0D4A6B']}
            style={styles.banner}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.bannerBadge}>
              <Text style={styles.bannerBadgeText}>{banners[currentBanner].badge}</Text>
            </View>
            <View style={styles.bannerContent}>
              <Text style={styles.bannerTitle}>{banners[currentBanner].title}</Text>
              <Text style={styles.bannerSubtitle}>{banners[currentBanner].subtitle}</Text>
            </View>
            <View style={styles.bannerDots}>
              {banners.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.dot,
                    currentBanner === index && styles.activeDot
                  ]}
                />
              ))}
            </View>
          </LinearGradient>
        </View>

        {/* Quick Overview */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Quick Overview</Text>
          <Pressable style={styles.refreshButton}>
            <RefreshCw size={14} color={colors.mutedForeground} />
            <Text style={styles.refreshText}>Refresh</Text>
          </Pressable>
        </View>

        {/* Stats Grid - 2x2 */}
        <View style={styles.statsGrid}>
          {stats.map((stat, index) => (
            <View key={index} style={[styles.statCard, { backgroundColor: stat.bgColor }]}>
              <View style={styles.statHeader}>
                <View style={styles.statIconContainer}>
                  <stat.icon size={18} color={colors.primary} />
                </View>
                <View style={styles.statBadge}>
                  <Text style={styles.statBadgeText}>{stat.badge}</Text>
                </View>
              </View>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

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

        {/* Categories Horizontal Scroll */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesContainer}
        >
          {categories.map((category) => (
            <Pressable key={category.id} style={styles.categoryCard}>
              <View style={[styles.categoryIconContainer, { backgroundColor: category.color }]}>
                <Text style={styles.categoryIcon}>{category.icon}</Text>
              </View>
              <Text style={styles.categoryName}>{category.name}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingBottom: 80,
  },
  bannerContainer: {
    marginTop: 8,
    marginBottom: 12,
  },
  banner: {
    borderRadius: 12,
    padding: 16,
    minHeight: 120,
    position: 'relative',
  },
  bannerBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: colors.success,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  bannerBadgeText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '600',
  },
  bannerContent: {
    marginTop: 32,
  },
  bannerTitle: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  bannerSubtitle: {
    color: colors.mutedForeground,
    fontSize: 12,
  },
  bannerDots: {
    flexDirection: 'row',
    marginTop: 12,
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
    width: 16,
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
    gap: 8,
    marginBottom: 16,
  },
  statCard: {
    width: CARD_WIDTH,
    borderRadius: 12,
    padding: 12,
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
    backgroundColor: 'rgba(255,255,255,0.15)',
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
    color: colors.white,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    color: colors.mutedForeground,
  },
  categoriesContainer: {
    paddingRight: 12,
    gap: 10,
  },
  categoryCard: {
    alignItems: 'center',
    width: 72,
  },
  categoryIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  categoryIcon: {
    fontSize: 28,
  },
  categoryName: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.foreground,
  },
});
