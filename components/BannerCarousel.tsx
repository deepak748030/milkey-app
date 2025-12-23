import React, { useRef, useEffect, useState } from 'react';
import { View, Image, Text, StyleSheet, Pressable, ScrollView, Dimensions, ActivityIndicator } from 'react-native';
import { colors } from '@/lib/colors';
import { bannersApi, ServerBanner, getImageUrl } from '@/lib/api';
import { router } from 'expo-router';

const { width: screenWidth } = Dimensions.get('window');

export default function BannerCarousel() {
  const scrollViewRef = useRef<ScrollView>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [banners, setBanners] = useState<ServerBanner[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load banners from API
  useEffect(() => {
    loadBanners();
  }, []);

  const loadBanners = async () => {
    try {
      setIsLoading(true);
      const response = await bannersApi.getAll();
      const data = (response as any).data || response.response;

      if (response.success && data && Array.isArray(data)) {
        setBanners(data);
      } else {
        // If no banners, try to seed them
        await bannersApi.seed();
        const retryResponse = await bannersApi.getAll();
        const retryData = (retryResponse as any).data || retryResponse.response;
        if (retryResponse.success && retryData && Array.isArray(retryData)) {
          setBanners(retryData);
        }
      }
    } catch (error) {
      console.error('Error loading banners:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (banners.length === 0) return;

    const interval = setInterval(() => {
      const nextIndex = (currentIndex + 1) % banners.length;
      scrollViewRef.current?.scrollTo({
        x: nextIndex * screenWidth,
        animated: true,
      });
      setCurrentIndex(nextIndex);
    }, 3000);

    return () => clearInterval(interval);
  }, [currentIndex, banners.length]);

  const handleScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / screenWidth);
    setCurrentIndex(index);
  };

  const handleBannerPress = (banner: ServerBanner) => {
    if (banner.type === 'event' && banner.eventId) {
      // Navigate to specific event
      router.push(`/event/${banner.eventId}` as any);
    } else if (banner.type === 'category' && banner.categorySlug) {
      // Navigate to search screen with category filter
      router.push({
        pathname: '/search' as any,
        params: { category: banner.categorySlug }
      });
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  if (banners.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {banners.map((banner) => (
          <Pressable
            key={banner._id}
            style={styles.bannerContainer}
            onPress={() => handleBannerPress(banner)}
          >
            <Image source={{ uri: getImageUrl(banner.image) }} style={styles.bannerImage} />
            {banner.badge && (
              <View style={styles.badgeContainer}>
                <Text style={styles.badgeText}>{banner.badge} - BOOK NOW!</Text>
              </View>
            )}
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.dotsContainer}>
        {banners.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              { opacity: currentIndex === index ? 1 : 0.5 }
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  loadingContainer: {
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.muted,
  },
  bannerContainer: {
    width: screenWidth,
    position: 'relative',
  },
  bannerImage: {
    width: screenWidth,
    height: 160,
    resizeMode: 'cover',
  },
  badgeContainer: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  badgeText: {
    color: colors.primaryForeground,
    fontSize: 14,
    fontWeight: 'bold',
  },
  dotsContainer: {
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.white,
  },
});
