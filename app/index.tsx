import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Dimensions } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { Droplets, Leaf, Heart, Star, Sparkles } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

export default function SplashScreen() {
  const { colors } = useTheme();

  // Animation values
  const logoScale = useRef(new Animated.Value(0)).current;
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
    Animated.sequence([
      Animated.spring(logoScale, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
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
      Animated.timing(subtitleOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
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
      Animated.stagger(100, [
        Animated.spring(icon1, { toValue: 1, tension: 80, friction: 8, useNativeDriver: true }),
        Animated.spring(icon2, { toValue: 1, tension: 80, friction: 8, useNativeDriver: true }),
        Animated.spring(icon3, { toValue: 1, tension: 80, friction: 8, useNativeDriver: true }),
        Animated.spring(icon4, { toValue: 1, tension: 80, friction: 8, useNativeDriver: true }),
      ]),
    ]).start(() => {
      setTimeout(() => {
        Animated.timing(fadeOut, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          router.replace('/(tabs)');
        });
      }, 500);
    });
  }, []);

  const FloatingIcon = ({ icon: Icon, animValue, style, color, size = 24 }: any) => (
    <Animated.View
      style={[
        styles.floatingIcon,
        { backgroundColor: colors.card, borderColor: colors.border },
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
    <Animated.View style={[styles.container, { backgroundColor: colors.background, opacity: fadeOut }]}>
      <LinearGradient
        colors={[colors.background, colors.card, colors.background]}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <View style={[styles.bgCircle, styles.bgCircle1, { backgroundColor: colors.primary + '15' }]} />
      <View style={[styles.bgCircle, styles.bgCircle2, { backgroundColor: colors.primary + '10' }]} />

      <FloatingIcon icon={Droplets} animValue={icon1} style={styles.icon1} color={colors.primary} size={22} />
      <FloatingIcon icon={Leaf} animValue={icon2} style={styles.icon2} color={colors.success} size={20} />
      <FloatingIcon icon={Heart} animValue={icon3} style={styles.icon3} color="#FF6B6B" size={18} />
      <FloatingIcon icon={Star} animValue={icon4} style={styles.icon4} color={colors.warning} size={20} />

      <View style={styles.content}>
        <Animated.View style={[styles.logoContainer, { transform: [{ scale: logoScale }] }]}>
          <View style={[styles.logo, { backgroundColor: colors.primary }]}>
            <Text style={styles.logoEmoji}>🥛</Text>
          </View>
        </Animated.View>

        <Animated.Text
          style={[
            styles.appName,
            { color: colors.foreground, opacity: titleOpacity, transform: [{ translateY: titleTranslate }] },
          ]}
        >
          Milkey
        </Animated.Text>

        <Animated.Text style={[styles.subtitle, { color: colors.mutedForeground, opacity: subtitleOpacity }]}>
          Your Complete Dairy Solution
        </Animated.Text>

        <Animated.View
          style={[styles.taglineContainer, { opacity: taglineOpacity, transform: [{ scale: taglineScale }] }]}
        >
          <View style={[styles.taglineBackground, { backgroundColor: colors.primary + '20', borderColor: colors.primary + '40' }]}>
            <Sparkles size={14} color={colors.primary} style={styles.sparkleLeft} />
            <Text style={[styles.tagline, { color: colors.primary }]}>Fresh Milk, Fresh Start</Text>
            <Sparkles size={14} color={colors.primary} style={styles.sparkleRight} />
          </View>
        </Animated.View>
      </View>

      <Animated.View style={[styles.loadingContainer, { opacity: subtitleOpacity }]}>
        <View style={styles.loadingDots}>
          <View style={[styles.dot, styles.dot1, { backgroundColor: colors.primary }]} />
          <View style={[styles.dot, styles.dot2, { backgroundColor: colors.primary }]} />
          <View style={[styles.dot, styles.dot3, { backgroundColor: colors.primary }]} />
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  },
  bgCircle2: {
    width: 350,
    height: 350,
    bottom: '10%',
    right: -120,
  },
  content: {
    alignItems: 'center',
    zIndex: 10,
  },
  logoContainer: {
    marginBottom: 16,
  },
  logo: {
    width: 120,
    height: 120,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoEmoji: {
    fontSize: 60,
  },
  appName: {
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
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
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
  },
  tagline: {
    fontSize: 14,
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
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
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
