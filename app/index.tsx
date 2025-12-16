import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Image, Dimensions } from 'react-native';
import { router } from 'expo-router';
import { getAuthUser } from '@/lib/mockData';
import { colors } from '@/lib/colors';
import { Calendar, Ticket, Star, Music, Heart, MapPin, Sparkles } from 'lucide-react-native';
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
  const icon5 = useRef(new Animated.Value(0)).current;
  const icon6 = useRef(new Animated.Value(0)).current;
  const fadeOut = useRef(new Animated.Value(1)).current;
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Shimmer animation loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();

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
        Animated.spring(icon5, { toValue: 1, tension: 80, friction: 8, useNativeDriver: true }),
        Animated.spring(icon6, { toValue: 1, tension: 80, friction: 8, useNativeDriver: true }),
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
        colors={['#FFF8E7', '#FFFAF0', '#FFF5E1', '#FFFFFF']}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Decorative Background Elements */}
      <View style={[styles.bgCircle, styles.bgCircle1]} />
      <View style={[styles.bgCircle, styles.bgCircle2]} />
      <View style={[styles.bgCircle, styles.bgCircle3]} />
      <View style={[styles.bgCircle, styles.bgCircle4]} />

      {/* Golden decorative lines */}
      <View style={styles.decorLine1} />
      <View style={styles.decorLine2} />

      {/* Floating Icons */}
      <FloatingIcon icon={Calendar} animValue={icon1} style={styles.icon1} color="#D4A853" size={26} />
      <FloatingIcon icon={Ticket} animValue={icon2} style={styles.icon2} color="#C9963C" size={24} />
      <FloatingIcon icon={Star} animValue={icon3} style={styles.icon3} color="#E6BE5A" size={20} />
      <FloatingIcon icon={Music} animValue={icon4} style={styles.icon4} color="#B8860B" size={22} />
      <FloatingIcon icon={Heart} animValue={icon5} style={styles.icon5} color="#DAA520" size={18} />
      <FloatingIcon icon={MapPin} animValue={icon6} style={styles.icon6} color="#CD9B1D" size={20} />

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
            source={require('@/assets/images/plenify-logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </Animated.View>

        {/* Subtitle */}
        <Animated.Text style={[styles.subtitle, { opacity: subtitleOpacity }]}>
          Plan Your Perfect Events
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
            <Sparkles size={16} color="#B8860B" style={styles.sparkleLeft} />
            <Text style={styles.tagline}>✨ Enjoy Your Event ✨</Text>
            <Sparkles size={16} color="#B8860B" style={styles.sparkleRight} />
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

      {/* Bottom decorative element */}
      <View style={styles.bottomDecor}>
        <View style={styles.decorDot} />
        <View style={styles.decorLineHorizontal} />
        <View style={styles.decorDot} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFAF0',
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
    width: 350,
    height: 350,
    top: '5%',
    left: -100,
    backgroundColor: 'rgba(218, 165, 32, 0.08)',
  },
  bgCircle2: {
    width: 450,
    height: 450,
    bottom: '5%',
    right: -150,
    backgroundColor: 'rgba(205, 155, 29, 0.06)',
  },
  bgCircle3: {
    width: 200,
    height: 200,
    top: '35%',
    right: -60,
    backgroundColor: 'rgba(184, 134, 11, 0.05)',
  },
  bgCircle4: {
    width: 150,
    height: 150,
    bottom: '30%',
    left: -50,
    backgroundColor: 'rgba(230, 190, 90, 0.07)',
  },
  decorLine1: {
    position: 'absolute',
    top: '18%',
    left: '20%',
    width: 60,
    height: 2,
    backgroundColor: 'rgba(218, 165, 32, 0.2)',
    transform: [{ rotate: '45deg' }],
  },
  decorLine2: {
    position: 'absolute',
    bottom: '18%',
    right: '20%',
    width: 60,
    height: 2,
    backgroundColor: 'rgba(218, 165, 32, 0.2)',
    transform: [{ rotate: '-45deg' }],
  },
  content: {
    alignItems: 'center',
    zIndex: 10,
  },
  logoContainer: {
    marginBottom: 16,
    shadowColor: '#DAA520',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  logo: {
    width: 220,
    height: 220,
  },
  subtitle: {
    fontSize: 17,
    color: '#8B7355',
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
    backgroundColor: 'rgba(218, 165, 32, 0.12)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 30,
    borderWidth: 1.5,
    borderColor: 'rgba(218, 165, 32, 0.3)',
  },
  tagline: {
    fontSize: 16,
    color: '#B8860B',
    fontWeight: '700',
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
    width: 48,
    height: 48,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(218, 165, 32, 0.25)',
    shadowColor: '#DAA520',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  icon1: {
    top: '12%',
    left: '8%',
  },
  icon2: {
    top: '10%',
    right: '10%',
  },
  icon3: {
    top: '32%',
    left: '3%',
  },
  icon4: {
    top: '38%',
    right: '5%',
  },
  icon5: {
    bottom: '22%',
    left: '12%',
  },
  icon6: {
    bottom: '18%',
    right: '12%',
  },
  loadingContainer: {
    position: 'absolute',
    bottom: 120,
  },
  loadingDots: {
    flexDirection: 'row',
    gap: 10,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#DAA520',
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
  bottomDecor: {
    position: 'absolute',
    bottom: 60,
    flexDirection: 'row',
    alignItems: 'center',
  },
  decorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(218, 165, 32, 0.4)',
  },
  decorLineHorizontal: {
    width: 40,
    height: 1.5,
    backgroundColor: 'rgba(218, 165, 32, 0.3)',
    marginHorizontal: 8,
  },
});
