import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions, FlatList, Image, StatusBar } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ArrowRight } from 'lucide-react-native';

const { width } = Dimensions.get('window');
const ONBOARDING_KEY = 'hasSeenOnboarding';

type Slide = {
  id: string;
  titleEn: string;
  descEn: string;
  image: any;
  bg: string;
  accent: string;
};

const slides: Slide[] = [
  {
    id: '1',
    titleEn: 'Smart Milk Collection',
    descEn: 'Record daily milk with QTY, FAT, CLR. Auto-calculate SNF, amount and avg rate in one tap.',
    image: require('@/assets/images/onboarding-1.png'),
    bg: '#eef7f0',
    accent: '#14804a',
  },
  {
    id: '2',
    titleEn: 'Manage Farmers & Payments',
    descEn: 'Add collection & selling farmers, track advances, generate slips and pay with one history.',
    image: require('@/assets/images/onboarding-2.png'),
    bg: '#e8f0fe',
    accent: '#2563eb',
  },
  {
    id: '3',
    titleEn: 'Grow with Reports & Store',
    descEn: 'Daily reports, milk calculator, dairy store and subscriptions — everything to scale your business.',
    image: require('@/assets/images/onboarding-3.png'),
    bg: '#fdf3e7',
    accent: '#d97706',
  },
];

export default function OnboardingScreen() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList>(null);

  const onViewable = useRef(({ viewableItems }: any) => {
    if (viewableItems[0]?.index != null) setIndex(viewableItems[0].index);
  }).current;

  const goNext = () => {
    if (index < slides.length - 1) listRef.current?.scrollToIndex({ index: index + 1, animated: true });
    else finish();
  };
  const finish = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    router.replace('/auth');
  };
  const skip = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    router.replace('/auth');
  };

  const styles = createStyles(colors, isDark, insets);

  const renderItem = ({ item }: { item: Slide }) => (
    <View style={[styles.slide, { width }]}>
      <View style={styles.artWrap}>
        <View style={[styles.artBg, { backgroundColor: item.bg }]} />
        <View style={[styles.ring1, { borderColor: item.accent + '1A' }]} />
        <View style={[styles.ring2, { borderColor: item.accent + '0D' }]} />
        <Image source={item.image} style={styles.heroImg} resizeMode="contain" />
      </View>

      <Text style={styles.title}>{item.titleEn}</Text>
      <Text style={styles.desc}>{item.descEn}</Text>

      <View style={styles.featureRow}>
        <View style={[styles.featureDot, { backgroundColor: item.accent }]} />
        <Text style={styles.featureText}>Trusted by 10k+ dairy owners</Text>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      <View style={styles.header}>
        <View style={styles.logoRow}>
          <Image source={require('@/assets/images/icon.png')} style={styles.logo} resizeMode="cover" />
          <Text style={[styles.brand, { color: colors.foreground }]}>Milkey</Text>
        </View>
        <Pressable onPress={skip} style={[styles.skipBtn, { borderColor: colors.border, backgroundColor: colors.card }]} hitSlop={8}>
          <Text style={[styles.skipText, { color: colors.mutedForeground }]}>Skip</Text>
        </Pressable>
      </View>

      <FlatList
        ref={listRef}
        data={slides}
        renderItem={renderItem}
        keyExtractor={(it) => it.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewable}
        viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
        bounces={false}
      />

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.dotsRow}>
          {slides.map((_, i) => (
            <View key={i} style={[styles.dot, i === index ? styles.dotActive : styles.dotIdle, { backgroundColor: i === index ? colors.primary : colors.border }]} />
          ))}
        </View>

        <Pressable onPress={goNext} style={[styles.primaryBtn, { backgroundColor: slides[index].accent }]}>
          <Text style={styles.primaryText}>{index === slides.length - 1 ? 'Get Started' : 'Next'}</Text>
          <ArrowRight size={16} color="#fff" strokeWidth={2.5} />
        </Pressable>

        <Text style={[styles.hint, { color: colors.mutedForeground }]}>Swipe to explore • {index + 1} / {slides.length}</Text>
      </View>
    </View>
  );
}

const createStyles = (colors: any, isDark: boolean, insets: any) =>
  StyleSheet.create({
    container: { flex: 1 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: insets.top + 8,
      paddingBottom: 8,
    },
    logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    logo: { width: 28, height: 28, borderRadius: 8 },
    brand: { fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },
    skipBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
    skipText: { fontSize: 12, fontWeight: '600' },

    slide: { flex: 1, alignItems: 'center', paddingHorizontal: 24, paddingTop: 12 },
    artWrap: { width: 220, height: 220, alignItems: 'center', justifyContent: 'center', marginTop: 6, marginBottom: 16 },
    artBg: { position: 'absolute', width: 170, height: 170, borderRadius: 85, opacity: 0.95 },
    ring1: { position: 'absolute', width: 210, height: 210, borderRadius: 105, borderWidth: 1.5 },
    ring2: { position: 'absolute', width: 240, height: 240, borderRadius: 120, borderWidth: 1 },
    heroImg: { width: 190, height: 190, zIndex: 2 },

    title: { fontSize: 20, fontWeight: '900', color: colors.foreground, textAlign: 'center', marginTop: 4, letterSpacing: -0.3 },
    desc: { fontSize: 13, color: colors.mutedForeground, textAlign: 'center', lineHeight: 20, marginTop: 8, paddingHorizontal: 8, fontWeight: '500' },
    featureRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
    featureDot: { width: 6, height: 6, borderRadius: 3 },
    featureText: { fontSize: 11, color: colors.mutedForeground, fontWeight: '600' },

    footer: { paddingHorizontal: 16, gap: 12, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background },
    dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingTop: 12 },
    dot: { height: 4, borderRadius: 2 },
    dotIdle: { width: 16, opacity: 0.5 },
    dotActive: { width: 28, opacity: 1 },
    primaryBtn: { height: 48, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    primaryText: { color: '#fff', fontSize: 14, fontWeight: '800' },
    hint: { fontSize: 11, textAlign: 'center', fontWeight: '500' },
  });
