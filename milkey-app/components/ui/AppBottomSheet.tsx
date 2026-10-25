import React, { memo, useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, useWindowDimensions, Animated, Easing, BackHandler, Platform } from 'react-native';
import { Pressable } from '@/components/ui/HapticPressable';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/hooks/useTheme';
import { X, ChevronRight } from 'lucide-react-native';

export type SheetItem<T extends string> = {
  key: T;
  label: string;
  IconComp: any;
  iconBg: string;
  iconColor: string;
  /** Soft row tint (screenshot palette). Dark theme ignores it. */
  tint?: string;
};

type Props<T extends string> = {
  visible: boolean;
  onClose: () => void;
  title: string;
  /** Kept for API compatibility — the reference design has no subtitle. */
  subtitle?: string;
  items: SheetItem<T>[];
  activeKey: T;
  onSelect: (k: T) => void;
  isActive?: (active: T, item: SheetItem<T>) => boolean;
  bottomOffset?: number;
  topOffset?: number;
  /** Ref of the <BlurTargetView> that wraps the screen content (Android blur). */
  blurTarget?: React.RefObject<any>;
  /** Kept for API compatibility - the backdrop always covers the full screen now. */
  topOffset?: number;
};

/**
 * Collection / Selling sheet — matches the approved screenshot exactly.
 *
 *  • Floating card: full width, rounded on ALL four corners (top and bottom look
 *    identical), 10px gap above the tab bar.
 *  • Header: soft green gradient glow from the top edge fading into the card,
 *    big black "Collection" title, white circular close button.
 *  • Rows: tinted pills with their coloured icon boxes, chevron on the right;
 *    the active row gets a green tint + green outline + green label.
 *  • Background behind: expo-blur (Android: dimezisBlurViewSdk31Plus + blurTarget)
 *    plus a dark scrim, so the screen behind goes dark. Rendered inline (no Modal)
 *    because a Modal is a separate native window and cannot be blurred.
 *  • Height stays below half of the screen (capped) with internal scroll.
 */
function AppBottomSheet<T extends string>({
  visible, onClose, title, items, activeKey, onSelect, isActive,
  bottomOffset = 0, blurTarget,
}: Props<T>) {
  const { colors, isDark } = useTheme();
  const { height: screenHeight } = useWindowDimensions();
  const maxSheetHeight = Math.round(screenHeight * 0.5);

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

  const sheetTranslateY = anim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] });

  return (
    <View style={s.overlay} pointerEvents="box-none">
      {/* Dim + real blur behind the sheet.
          Covers the WHOLE screen (header + status bar included) except the bottom tab
          bar, and is NOT animated — so the background can never stay half-dimmed.
          Layers: blur (where the platform allows) -> strong black scrim -> green tint. */}
      <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, bottomOffset ? { bottom: bottomOffset } : null]}>
        <BlurView
          intensity={Platform.OS === 'ios' ? 55 : 60}
          tint="dark"
          style={StyleSheet.absoluteFillObject}
          // SDK 57: on Android the blur only works with an explicit blurMethod AND a
          // blurTarget; without them it silently falls back to "none" (no blur).
          {...(Platform.OS === 'android'
            ? { blurMethod: 'dimezisBlurViewSdk31Plus' as const, blurReductionFactor: 3, blurTarget }
            : {})}
        />
        {/* Strong scrim -> the screen behind reads black-ish, not washed grey */}
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.78)' }]} />
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(6,20,12,0.18)' }]} />
      </View>

      {/* Tap anywhere outside the sheet (header included) to dismiss */}
      <TouchableOpacity
        activeOpacity={1}
        onPress={onClose}
        style={[StyleSheet.absoluteFillObject, bottomOffset ? { bottom: bottomOffset } : null]}
      />

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
          {/* Gradient green glow from the top edge, fading into the card */}
          <LinearGradient
            pointerEvents="none"
            colors={
              isDark
                ? ['rgba(34,197,94,0.45)', 'rgba(34,197,94,0.10)', 'rgba(0,0,0,0)']
                : ['rgba(34,197,94,0.42)', 'rgba(34,197,94,0.14)', 'rgba(255,255,255,0)']
            }
            locations={[0, 0.45, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={s.topGlow}
          />

          <View style={s.handle} />

          <View style={s.header}>
            <Text numberOfLines={1} style={s.title}>{title}</Text>
            <Pressable onPress={onClose} style={s.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={19} color="#0A0A0A" strokeWidth={2.6} />
            </Pressable>
          </View>

          <ScrollView
            style={s.scroll}
            contentContainerStyle={s.list}
            showsVerticalScrollIndicator={false}
            bounces={false}
            nestedScrollEnabled
          >
            {items.map(item => {
              const active = isActive ? isActive(activeKey, item) : activeKey === item.key;
              const Icon = item.IconComp;
              const rowTint = isDark ? 'rgba(255,255,255,0.05)' : (item.tint || '#F5FAF6');
              return (
                <Pressable
                  key={item.key}
                  onPress={() => handle(item.key)}
                  style={({ pressed }) => [
                    s.row,
                    { backgroundColor: active ? (isDark ? 'rgba(34,197,94,0.16)' : '#E9F8EE') : rowTint },
                    active && s.rowActive,
                    pressed && s.pressed,
                  ]}
                >
                  <View style={[s.iconBox, { backgroundColor: item.iconBg }]}>
                    <Icon size={17} color={item.iconColor} strokeWidth={2.1} />
                  </View>
                  <Text numberOfLines={1} style={[s.label, active && s.labelActive]}>{item.label}</Text>
                  <ChevronRight size={17} color={active ? colors.primary : '#0F172A'} />
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
    borderRadius: 28,
    backgroundColor: c.card,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
    elevation: 26,
  },
  card: {
    backgroundColor: c.card,
    borderRadius: 28,
    paddingTop: 8,
    paddingBottom: 10,
    paddingHorizontal: 10,
    overflow: 'hidden',
  },
  // Green glow hugging the top edge (replaces the hard border line).
  topGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  handle: {
    width: 46, height: 5, borderRadius: 3,
    backgroundColor: dark ? 'rgba(255,255,255,0.30)' : '#FFFFFF',
    alignSelf: 'center', marginBottom: 8,
    shadowColor: '#0F172A', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.18, shadowRadius: 2, elevation: 2,
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingTop: 2, paddingBottom: 14,
  },
  title: { flex: 1, fontSize: 23, fontWeight: '900', color: dark ? '#FFFFFF' : '#0A0A0A', letterSpacing: -0.4 },
  closeBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.18, shadowRadius: 6, elevation: 4,
  },
  scroll: { flexShrink: 1 },
  list: { gap: 7, paddingBottom: 2 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    minHeight: 48, paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1, borderColor: 'transparent',
  },
  rowActive: { borderWidth: 1.5, borderColor: '#16A34A' },
  pressed: { opacity: 0.7 },
  iconBox: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  label: { flex: 1, fontSize: 15.5, fontWeight: '700', color: dark ? '#FFFFFF' : '#0A0A0A' },
  labelActive: { color: dark ? '#4ADE80' : '#15803D', fontWeight: '900' },
});

export default memo(AppBottomSheet) as typeof AppBottomSheet;
