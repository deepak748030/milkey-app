import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Image, Dimensions } from 'react-native';
import { router } from 'expo-router';
import { getAuthUser } from '@/lib/mockData';
import { colors } from '@/lib/colors';
import { Droplets, Milk, Leaf, Heart, Star, Sparkles } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

export default function SplashScreen() {
  const [isChecking, setIsChecking] = useState(false);

  // Animation values
  const logoScale = useRef(new Animated.Value(0)).current;
  const logoRotate = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslate = useRef(new Animated.Value(30)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const taglineScale = useRef(new Animated.Value(0.8)).current;
  const icon1 = useRef(new Animated.Value(0)).current;
  const icon2 = useRef(new Animated.Value(0)).current;
  const icon3 = useRef(new Animated.Value(0)).current;
  const icon4 = useRef(new Animated.Value(0)).current;
  const fadeOut = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Start main animations
    Animated.sequence([
      // Logo entrance
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(logoRotate, {
          toValue: 1,
          duration: 800,
          easing: Easing.out(Easing.back(1.5)),
          useNativeDriver: true,
        }),
      ]),
      // Title entrance
      Animated.parallel([
        Animated.timing(titleOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(titleTranslate, {
          toValue: 0,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      // Subtitle
      Animated.timing(subtitleOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      // Tagline with scale
      Animated.parallel([
        Animated.timing(taglineOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(taglineScale, {
          toValue: 1,
          tension: 80,
          friction: 8,
          useNativeDriver: true,
        }),
      ]),
      // Floating icons staggered
      Animated.stagger(100, [
        Animated.spring(icon1, { toValue: 1, tension: 80, friction: 8, useNativeDriver: true }),
        Animated.spring(icon2, { toValue: 1, tension: 80, friction: 8, useNativeDriver: true }),
        Animated.spring(icon3, { toValue: 1, tension: 80, friction: 8, useNativeDriver: true }),
        Animated.spring(icon4, { toValue: 1, tension: 80, friction: 8, useNativeDriver: true }),
      ]),
    ]).start(() => {
      // After animations, check auth
      setTimeout(() => {
        setIsChecking(true);
        checkAuthAndNavigate();
      }, 500);
    });
  }, []);

  const checkAuthAndNavigate = async () => {
    try {
      const user = await getAuthUser();

      // Fade out animation
      Animated.timing(fadeOut, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        if (user) {
          router.replace('/(tabs)');
        } else {
          router.replace('/auth');
        }
      });
    } catch (error) {
      router.replace('/auth');
    }
  };

  const FloatingIcon = ({ icon: Icon, animValue, style, color, size = 24 }: any) => (
    <Animated.View
      style={[
        styles.floatingIcon,
        style,
        {
          opacity: animValue,
          transform: [
            { scale: animValue },
            {
              translateY: animValue.interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0],
              }),
            },
          ],
        },
      ]}
    >
      <Icon size={size} color={color} />
    </Animated.View>
  );

  return (
    <Animated.View style={[styles.container, { opacity: fadeOut }]}>
      {/* Gradient Background */}
      <LinearGradient
        colors={[colors.background, colors.card, colors.background]}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Decorative Background Elements */}
      <View style={[styles.bgCircle, styles.bgCircle1]} />
      <View style={[styles.bgCircle, styles.bgCircle2]} />

      {/* Floating Icons */}
      <FloatingIcon icon={Droplets} animValue={icon1} style={styles.icon1} color={colors.primary} size={22} />
      <FloatingIcon icon={Leaf} animValue={icon2} style={styles.icon2} color={colors.success} size={20} />
      <FloatingIcon icon={Heart} animValue={icon3} style={styles.icon3} color="#FF6B6B" size={18} />
      <FloatingIcon icon={Star} animValue={icon4} style={styles.icon4} color={colors.warning} size={20} />

      {/* Main Content */}
      <View style={styles.content}>
        {/* Logo */}
        <Animated.View
          style={[
            styles.logoContainer,
            {
              transform: [{ scale: logoScale }],
            },
          ]}
        >
          <Image
            source={require('@/assets/images/milkey-logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </Animated.View>

        {/* App Name */}
        <Animated.Text
          style={[
            styles.appName,
            {
              opacity: titleOpacity,
              transform: [{ translateY: titleTranslate }],
            },
          ]}
        >
          Milkey
        </Animated.Text>

        {/* Subtitle */}
        <Animated.Text style={[styles.subtitle, { opacity: subtitleOpacity }]}>
          Your Complete Dairy Solution
        </Animated.Text>

        {/* Highlighted Tagline */}
        <Animated.View
          style={[
            styles.taglineContainer,
            {
              opacity: taglineOpacity,
              transform: [{ scale: taglineScale }],
            },
          ]}
        >
          <View style={styles.taglineBackground}>
            <Sparkles size={14} color={colors.primary} style={styles.sparkleLeft} />
            <Text style={styles.tagline}>Fresh Milk, Fresh Start</Text>
            <Sparkles size={14} color={colors.primary} style={styles.sparkleRight} />
          </View>
        </Animated.View>
      </View>

      {/* Loading indicator */}
      {isChecking && (
        <Animated.View style={[styles.loadingContainer, { opacity: subtitleOpacity }]}>
          <View style={styles.loadingDots}>
            <View style={[styles.dot, styles.dot1]} />
            <View style={[styles.dot, styles.dot2]} />
            <View style={[styles.dot, styles.dot3]} />
          </View>
        </Animated.View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  bgCircle: {
    position: 'absolute',
    borderRadius: 500,
  },
  bgCircle1: {
    width: 300,
    height: 300,
    top: '10%',
    left: -100,
    backgroundColor: 'rgba(0, 180, 216, 0.1)',
  },
  bgCircle2: {
    width: 350,
    height: 350,
    bottom: '10%',
    right: -120,
    backgroundColor: 'rgba(0, 180, 216, 0.08)',
  },
  content: {
    alignItems: 'center',
    zIndex: 10,
  },
  logoContainer: {
    marginBottom: 16,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  logo: {
    width: 140,
    height: 140,
    borderRadius: 28,
  },
  appName: {
    fontSize: 42,
    fontWeight: '800',
    color: colors.foreground,
    letterSpacing: 2,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: colors.mutedForeground,
    letterSpacing: 1,
    fontWeight: '500',
    marginBottom: 20,
    textTransform: 'uppercase',
  },
  taglineContainer: {
    marginTop: 8,
  },
  taglineBackground: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 180, 216, 0.15)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(0, 180, 216, 0.3)',
  },
  tagline: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  sparkleLeft: {
    marginRight: 8,
  },
  sparkleRight: {
    marginLeft: 8,
  },
  floatingIcon: {
    position: 'absolute',
    width: 44,
    height: 44,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  icon1: {
    top: '15%',
    left: '10%',
  },
  icon2: {
    top: '12%',
    right: '12%',
  },
  icon3: {
    bottom: '25%',
    left: '15%',
  },
  icon4: {
    bottom: '22%',
    right: '15%',
  },
  loadingContainer: {
    position: 'absolute',
    bottom: 100,
  },
  loadingDots: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  dot1: {
    opacity: 0.3,
  },
  dot2: {
    opacity: 0.6,
  },
  dot3: {
    opacity: 1,
  },
});
