import React, { memo, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal,
  useWindowDimensions, Animated, Easing, Platform,
} from 'react-native';
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
  /** Kept for API compatibility — the approved design has no subtitle. */
  subtitle?: string;
  items: SheetItem<T>[];
  activeKey: T;
  onSelect: (k: T) => void;
  isActive?: (active: T, item: SheetItem<T>) => boolean;
  /** Height of the bottom tab bar: the dark backdrop stops there so the tab bar stays bright. */
  bottomOffset?: number;
  /** Kept for API compatibility. */
  topOffset?: number;
  /** Kept for API compatibility (blur uses the Modal's own window). */
  blurTarget?: React.RefObject<any>;
};

/**
 * Collection / Selling bottom sheet.
 *
 * Backdrop (this is the important part):
 *   The sheet lives in a transparent <Modal>. A Modal is guaranteed to paint above
 *   the whole screen on both platforms, so the dark layer can never be "lost"
 *   behind another view (which is exactly what happened with the inline overlay).
 *   Inside the Modal we stack:
 *      1. expo-blur (real blur on iOS; Android falls back to a dark translucent tint)
 *      2. rgba(0,0,0,0.72) scrim  +  rgba(6,20,12,0.18) green tint
 *   Both stop `bottomOffset` pixels above the bottom edge, so the tab bar of the
 *   screen behind stays visible and bright — exactly like the reference.
 *
 * Sheet itself: full width, all four corners rounded, 10px above the tab bar,
 * gradient green glow under the top edge, big title, white round close button,
 * tinted icon rows, active row outlined in green.
 */
function AppBottomSheet<T extends string>({
  visible, onClose, title, items, activeKey, onSelect, isActive,
  bottomOffset = 0,
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

  const handle = useCallback((k: T) => { onSelect(k); onClose(); }, [onSelect, onClose]);
  const s = styles(colors, isDark);
  if (!visible) return null;

  const sheetTranslateY = anim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] });
  const stopAboveTabBar = bottomOffset ? { bottom: bottomOffset } : null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
      hardwareAccelerated
    >
      <View style={s.overlay}>
        {/* 1) Blur + 2) dark scrim. pointerEvents none so taps fall through to the closer.
            These are NOT animated, so the screen behind can never stay half-dimmed. */}
        <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, stopAboveTabBar]}>
          <BlurView
            intensity={Platform.OS === 'ios' ? 45 : 40}
            tint="dark"
            style={StyleSheet.absoluteFillObject}
          />
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.72)' }]} />
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(6,20,12,0.18)' }]} />
        </View>

        {/* Tap anywhere outside the sheet (header / status bar included) to dismiss */}
        <TouchableOpacity
          activeOpacity={1}
          onPress={onClose}
          style={[StyleSheet.absoluteFillObject, stopAboveTabBar]}
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
    </Modal>
  );
}

const styles = (c: any, dark: boolean) => StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'transparent' },
  wrap: {
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
  // Green glow hugging the top edge.
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
