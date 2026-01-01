import React, { useRef, useEffect, useState } from 'react';
import { View, Image, Text, StyleSheet, Pressable, ScrollView, Dimensions, Animated } from 'react-native';
import { colors } from '@/lib/colors';

const { width: screenWidth } = Dimensions.get('window');

const API_BASE_URL = 'https://milkey-app-server.vercel.app/api';

interface Banner {
  _id: string;
  title: string;
  image: string;
  badge?: string;
}

export default function BannerCarousel() {
  const scrollViewRef = useRef<ScrollView>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const skeletonOpacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(skeletonOpacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(skeletonOpacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );

    loop.start();
    return () => loop.stop();
  }, [skeletonOpacity]);

  useEffect(() => {
    loadBanners();
  }, []);

  const loadBanners = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE_URL}/products/banners`);
      const data = await response.json();

      const list: Banner[] = data?.success
        ? Array.isArray(data?.response)
          ? data.response
          : Array.isArray(data?.response?.data)
            ? data.response.data
            : []
        : [];

      setBanners(list);
    } catch (error) {
      setBanners([]);
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

  if (isLoading) {
    return (
      <View style={styles.skeletonOuter}>
        <Animated.View style={[styles.skeletonCard, { opacity: skeletonOpacity }]} />
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
          <Pressable key={banner._id} style={styles.bannerContainer}>
            <Image source={{ uri: banner.image }} style={styles.bannerImage} />
            {banner.badge && (
              <View style={styles.badgeContainer}>
                <Text style={styles.badgeText}>{banner.badge}</Text>
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
  skeletonOuter: {
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.muted,
  },
  skeletonCard: {
    width: screenWidth,
    height: 160,
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
