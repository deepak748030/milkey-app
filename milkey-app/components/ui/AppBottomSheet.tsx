import React, { memo, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, Pressable, StyleSheet, TouchableOpacity, ScrollView,
  useWindowDimensions, Animated, Easing, BackHandler, Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '@/hooks/useTheme';
import { X, ChevronRight } from 'lucide-react-native';

export type SheetItem<T extends string> = {
  key: T;
  label: string;
  /** Kept for backwards compatibility — icons are no longer rendered. */
  IconComp?: any;
  iconBg?: string;
  iconColor?: string;
  tint?: string;
};

type Props<T extends string> = {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  items: SheetItem<T>[];
  activeKey: T;
  onSelect: (k: T) => void;
  isActive?: (active: T, item: SheetItem<T>) => boolean;
  bottomOffset?: number;
  topOffset?: number;
  /** Ref of the <BlurTargetView> that wraps the screen content (Android blur). */
  blurTarget?: React.RefObject<any>;
};

/**
 * Collection / Selling sheet — v3 (clean redesign).
 *
 * Design rules (per product instruction):
 *  • Full screen width, floats 10px above the tab bar so it clearly looks
 *    "lifted out" of the phone screen.
 *  • Only ONE border: a thin (1px) black line on the TOP edge.
 *    Left / right / bottom stay borderless.
 *  • No icons anywhere — flat list rows (label + chevron), hairline separators,
 *    active row gets a soft green fill + 1px green border.
 *  • Height is hard-capped below half the screen (46%) with internal scroll.
 *
 * Background: real blur via expo-blur + a dark scrim, so the screen behind turns
 * black-ish exactly like the reference. IMPORTANT (SDK 57): on Android the blur
 * only works with `blurMethod="dimezisBlurViewSdk31Plus"` AND a `blurTarget`
 * pointing at a <BlurTargetView> that wraps the app content — that is also why
 * this overlay is rendered inline (no <Modal>): a Modal is a separate native
 * window, so nothing behind it can be sampled/blurred.
 */
function AppBottomSheet<T extends string>({
  visible, onClose, title, subtitle = 'Choose an option', items,
  activeKey, onSelect, isActive, bottomOffset = 0, topOffset = 0, blurTarget,
}: Props<T>) {
  const { colors, isDark } = useTheme();
  const { height: screenHeight } = useWindowDimensions();
  const maxSheetHeight = Math.round(screenHeight * 0.46);

  // Enter animation: scrim fades in, sheet slides up.
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!visible) { anim.setValue(0); return; }
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [visible, anim]);

  // Android hardware back closes the sheet (no Modal = no built-in handling).
  useEffect(() => {
    if (!visible || Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { onClose(); return true; });
    return () => sub.remove();
  }, [visible, onClose]);

  const handle = useCallback((k: T) => { onSelect(k); onClose(); }, [onSelect, onClose]);
  const s = styles(colors, isDark);
  if (!visible) return null;

  const insetStyle: any = {};
  if (bottomOffset) insetStyle.bottom = bottomOffset;
  if (topOffset) insetStyle.top = topOffset;
  const hasInset = bottomOffset || topOffset;

  // Thin black border on TOP only (light on dark so it stays visible).
  const topBorderColor = isDark ? 'rgba(255,255,255,0.55)' : '#0A0A0A';
  const sheetTranslateY = anim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] });
  const scrimOpacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  return (
    <View style={s.overlay} pointerEvents="box-none">
      {/* Dim + real blur behind the sheet. Header and tab bar stay clear (insets). */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFillObject, hasInset ? insetStyle : null, { opacity: scrimOpacity }]}>
        <BlurView
          intensity={Platform.OS === 'ios' ? 60 : 70}
          tint="dark"
          style={StyleSheet.absoluteFillObject}
          // SDK 57: on Android the blur only works with an explicit blurMethod AND a
          // blurTarget; without them it silently falls back to "none" (no blur).
          {...(Platform.OS === 'android'
            ? { blurMethod: 'dimezisBlurViewSdk31Plus' as const, blurReductionFactor: 3, blurTarget }
            : {})}
        />
        {/* Dark scrim on top of the blur → the background reads as near-black */}
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.62)' }]} />
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(9,26,15,0.22)' }]} />
      </Animated.View>

      {/* Tap outside to dismiss */}
      <TouchableOpacity activeOpacity={1} onPress={onClose} style={[StyleSheet.absoluteFillObject, hasInset ? insetStyle : null]} />

      <Animated.View
        style={[
          s.wrap,
          {
            marginBottom: bottomOffset + 10,
            maxHeight: maxSheetHeight,
            opacity: anim,
            transform: [{ translateY: sheetTranslateY }],
          },
        ]}
      >
        <View style={s.card}>
          {/* The only border: thin black line on the top edge */}
          <View style={[s.topBorder, { backgroundColor: topBorderColor }]} pointerEvents="none" />

          <View style={s.handle} />

          <View style={s.header}>
            <View style={s.headerText}>
              <Text numberOfLines={1} style={s.title}>{title}</Text>
              <Text numberOfLines={1} style={s.subtitle}>{subtitle}</Text>
            </View>
            <Pressable onPress={onClose} style={s.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={16} color={colors.foreground} />
            </Pressable>
          </View>

          <ScrollView
            style={s.scroll}
            contentContainerStyle={s.list}
            showsVerticalScrollIndicator={false}
            bounces={false}
            nestedScrollEnabled
          >
            {items.map((item, index) => {
              const active = isActive ? isActive(activeKey, item) : activeKey === item.key;
              const last = index === items.length - 1;
              return (
                <Pressable
                  key={item.key}
                  onPress={() => handle(item.key)}
                  style={({ pressed }) => [
                    s.row,
                    !last && !active && s.rowDivider,
                    active && s.rowActive,
                    pressed && s.pressed,
                  ]}
                >
                  <Text numberOfLines={1} style={[s.label, active && s.labelActive]}>{item.label}</Text>
                  <ChevronRight size={16} color={active ? colors.primary : colors.mutedForeground} />
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = (c: any, dark: boolean) => StyleSheet.create({
  // Sits above the tabs inside the same window (so Android blur can sample them).
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
    elevation: 30,
  },
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
    backgroundColor: c.card,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
    elevation: 26,
  },
  card: {
    backgroundColor: c.card,
    borderRadius: 26,
    paddingTop: 8,
    paddingBottom: 6,
    paddingHorizontal: 6,
    overflow: 'hidden',
  },
  // 1px black line, top edge only.
  topBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: dark ? 'rgba(255,255,255,0.20)' : '#D5DCD8',
    alignSelf: 'center', marginBottom: 10,
  },
  header: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: 14, paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: dark ? 'rgba(255,255,255,0.10)' : '#ECF1ED',
  },
  headerText: { flex: 1, paddingRight: 10 },
  title: { fontSize: 18, fontWeight: '800', color: c.foreground, letterSpacing: 0.1 },
  subtitle: { fontSize: 11.5, fontWeight: '500', color: c.mutedForeground, marginTop: 2 },
  closeBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: dark ? 'rgba(255,255,255,0.08)' : '#F2F5F3',
    alignItems: 'center', justifyContent: 'center',
  },
  scroll: { flexShrink: 1 },
  list: { paddingTop: 2, paddingBottom: 2 },
  // Flat list rows — no icons, no pills.
  row: {
    flexDirection: 'row', alignItems: 'center',
    minHeight: 42, paddingHorizontal: 14,
    backgroundColor: 'transparent',
    borderWidth: 1, borderColor: 'transparent', borderRadius: 12,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: dark ? 'rgba(255,255,255,0.09)' : '#EDF1EE',
    borderRadius: 0,
  },
  rowActive: {
    backgroundColor: dark ? 'rgba(34,197,94,0.16)' : '#EAF8EF',
    borderColor: '#16A34A',
    borderWidth: 1,
    marginVertical: 2,
  },
  pressed: { opacity: 0.6 },
  label: { flex: 1, fontSize: 14.5, fontWeight: '600', color: c.foreground },
  labelActive: { color: dark ? '#4ADE80' : '#15803D', fontWeight: '800' },
});

export default memo(AppBottomSheet) as typeof AppBottomSheet;
