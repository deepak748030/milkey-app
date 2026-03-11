import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Dimensions, Image } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { initializeAuth, isAuthenticated } from '@/lib/authStore';

const { width, height } = Dimensions.get('window');

export default function SplashScreen() {
  const { colors } = useTheme();

  // Animation values
  const logoScale = useRef(new Animated.Value(0.3)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoRotate = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslate = useRef(new Animated.Value(20)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const subtitleTranslate = useRef(new Animated.Value(15)).current;
  const shimmer = useRef(new Animated.Value(0)).current;
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const fadeOut = useRef(new Animated.Value(1)).current;
  const dotAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const checkAuth = initializeAuth();

    // Dot loading animation loop
    Animated.loop(
      Animated.timing(dotAnim, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // Main animation sequence
    Animated.sequence([
      // Ring pulse out
      Animated.parallel([
        Animated.timing(ring1, {
          toValue: 1,
          duration: 600,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(ring2, {
          toValue: 1,
          duration: 800,
          delay: 150,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      // Logo entrance with bounce
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1,
          tension: 60,
          friction: 6,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(logoRotate, {
          toValue: 1,
          duration: 500,
          easing: Easing.out(Easing.back(1.2)),
          useNativeDriver: true,
        }),
      ]),
      // Title slide up
      Animated.parallel([
        Animated.timing(titleOpacity, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }),
        Animated.spring(titleTranslate, {
          toValue: 0,
          tension: 80,
          friction: 10,
          useNativeDriver: true,
        }),
      ]),
      // Subtitle + shimmer
      Animated.parallel([
        Animated.timing(subtitleOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(subtitleTranslate, {
          toValue: 0,
          tension: 80,
          friction: 10,
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ]).start(async () => {
      await checkAuth;
      setTimeout(() => {
        Animated.timing(fadeOut, {
          toValue: 0,
          duration: 250,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }).start(() => {
          if (isAuthenticated()) {
            router.replace('/(tabs)');
          } else {
            router.replace('/auth');
          }
        });
      }, 200);
    });
  }, []);

  const spin = logoRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['-10deg', '0deg'],
  });

  return (
    <Animated.View style={[styles.container, { backgroundColor: colors.background, opacity: fadeOut }]}>
      {/* Background circles */}
      <View style={[styles.bgCircle, styles.bgCircle1, { backgroundColor: colors.primary + '10' }]} />
      <View style={[styles.bgCircle, styles.bgCircle2, { backgroundColor: colors.primary + '08' }]} />
      <View style={[styles.bgCircle, styles.bgCircle3, { backgroundColor: colors.success + '06' }]} />

      {/* Expanding rings */}
      <Animated.View
        style={[
          styles.ring,
          {
            borderColor: colors.primary + '20',
            opacity: ring1.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
            transform: [{ scale: ring1.interpolate({ inputRange: [0, 1], outputRange: [0.5, 2.5] }) }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.ring,
          {
            borderColor: colors.primary + '15',
            opacity: ring2.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0] }),
            transform: [{ scale: ring2.interpolate({ inputRange: [0, 1], outputRange: [0.5, 3] }) }],
          },
        ]}
      />

      {/* Main content */}
      <View style={styles.content}>
        {/* Logo with icon.png */}
        <Animated.View
          style={[
            styles.logoWrapper,
            {
              opacity: logoOpacity,
              transform: [{ scale: logoScale }, { rotate: spin }],
            },
          ]}
        >
          <View style={[styles.logoShadow, { shadowColor: colors.primary }]}>
            <View style={[styles.logoBg, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Image
                source={require('@/assets/images/icon.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
          </View>
        </Animated.View>

        {/* App name */}
        <Animated.View
          style={{
            opacity: titleOpacity,
            transform: [{ translateY: titleTranslate }],
          }}
        >
          <Text style={[styles.appName, { color: colors.foreground }]}>Milkey</Text>
        </Animated.View>

        {/* Tagline */}
        <Animated.View
          style={{
            opacity: subtitleOpacity,
            transform: [{ translateY: subtitleTranslate }],
          }}
        >
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Daily Milk Hisaab
          </Text>
        </Animated.View>

        {/* Shimmer line */}
        <Animated.View
          style={[
            styles.shimmerLine,
            {
              backgroundColor: colors.primary,
              opacity: shimmer.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 1, 0.6] }),
              transform: [
                {
                  scaleX: shimmer.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }),
                },
              ],
            },
          ]}
        />
      </View>

      {/* Loading dots */}
      <View style={styles.loadingContainer}>
        {[0, 1, 2].map((i) => (
          <Animated.View
            key={i}
            style={[
              styles.dot,
              { backgroundColor: colors.primary },
              {
                opacity: dotAnim.interpolate({
                  inputRange: [0, 0.33 * i, 0.33 * i + 0.17, 0.33 * i + 0.33, 1],
                  outputRange: [0.3, 0.3, 1, 0.3, 0.3],
                  extrapolate: 'clamp',
                }),
                transform: [
                  {
                    scale: dotAnim.interpolate({
                      inputRange: [0, 0.33 * i, 0.33 * i + 0.17, 0.33 * i + 0.33, 1],
                      outputRange: [0.8, 0.8, 1.3, 0.8, 0.8],
                      extrapolate: 'clamp',
                    }),
                  },
                ],
              },
            ]}
          />
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bgCircle: {
    position: 'absolute',
    borderRadius: 999,
  },
  bgCircle1: {
    width: 280,
    height: 280,
    top: '8%',
    left: -80,
  },
  bgCircle2: {
    width: 320,
    height: 320,
    bottom: '5%',
    right: -100,
  },
  bgCircle3: {
    width: 200,
    height: 200,
    top: '45%',
    right: -60,
  },
  ring: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
  },
  content: {
    alignItems: 'center',
    zIndex: 10,
  },
  logoWrapper: {
    marginBottom: 20,
  },
  logoShadow: {
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  logoBg: {
    width: 120,
    height: 120,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    overflow: 'hidden',
  },
  logoImage: {
    width: 110,
    height: 110,
  },
  appName: {
    fontSize: 44,
    fontWeight: '800',
    letterSpacing: 3,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  shimmerLine: {
    width: 60,
    height: 3,
    borderRadius: 2,
  },
  loadingContainer: {
    position: 'absolute',
    bottom: 80,
    flexDirection: 'row',
    gap: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
