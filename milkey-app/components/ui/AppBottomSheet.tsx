import React, { memo, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  useWindowDimensions, Animated, Easing, Platform, Modal,
} from 'react-native';
import { Pressable } from '@/components/ui/HapticPressable';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useTheme } from '@/hooks/useTheme';
import { useSheetScrimStore } from '@/lib/sheetScrimStore';
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
  /** Bottom tab bar height: the dark layer stops here so the tab bar stays bright. */
  bottomOffset?: number;
  /** Kept for API compatibility. */
  topOffset?: number;
  /** Kept for API compatibility. */
  blurTarget?: React.RefObject<any>;
};

/** Scrim strength of this sheet's own (Modal-window) dark layer. */
const SCRIM_DIM = 0.72;

/**
 * Collection / Selling bottom sheet.
 *
 * ── Why the dark layer lives in a <Modal> ────────────────────────────────────
 * Darkening the screen behind a sheet needs the dark View to be painted ABOVE the
 * navigator's screens. On Android that is impossible from a sibling of <Tabs>:
 * react-native-screens renders each screen in its own native layer, so every
 * in-app overlay (root-level, tabs-level, absolute stage, elevation 40…70) ends up
 * BEHIND those screen layers — that is why the background stayed bright.
 *
 * A <Modal> is a separate Dialog window that sits above the whole activity, so a
 * scrim drawn inside it always darkens everything: status bar, green header, cards.
 * Every other sheet in this app already darkens correctly for exactly this reason.
 *
 * The old problem with a Modal (the tab bar could not be tapped, so tapping
 * "Collection" twice never closed the sheet) is solved here instead of by removing
 * the Modal: the tap-to-close layer covers the WHOLE window, tab bar strip included,
 * so a second tap on the tab closes the sheet again.
 *
 * The dark layer stops `bottomOffset` px above the bottom edge → only the bottom tab
 * bar stays fully bright, exactly like the reference design.
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

  // Belt and braces: also dim the screen this sheet belongs to (<ScreenDim /> lives
  // inside purchase.tsx / selling.tsx). If a device ever refuses the Modal window the
  // screen still goes dark; when both work the result is the near-black of the design.
  const showScreenDim = useSheetScrimStore((st) => st.showScreen);
  const hideScreenDim = useSheetScrimStore((st) => st.hideScreen);
  useEffect(() => {
    if (!visible) return;
    showScreenDim();
    return () => hideScreenDim();
  }, [visible, showScreenDim, hideScreenDim]);

  const handle = useCallback((k: T) => { onSelect(k); onClose(); }, [onSelect, onClose]);
  const s = styles(colors, isDark);

  const sheetTranslateY = anim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      // Edge-to-edge on Android (Expo SDK 57): both translucent flags make this Dialog
      // window cover exactly the same area as the app window, so `bottomOffset`
      // (tab bar height incl. the safe-area inset) lines up perfectly.
      {...(Platform.OS === 'android' ? { navigationBarTranslucent: true, hardwareAccelerated: true } : {})}
      onRequestClose={onClose}
    >
      <View style={[s.overlay, StyleSheet.absoluteFill]} pointerEvents="box-none">
        {/* ── Dark layer ────────────────────────────────────────────────────────
            Full window WIDTH and from the very top (status bar / green header) down
            to the top edge of the tab bar. Nothing of the app below stays bright. */}
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFillObject, { bottom: bottomOffset, zIndex: 1 }]}
        >
          {Platform.OS === 'ios' ? (
            <BlurView intensity={45} tint="dark" style={StyleSheet.absoluteFill} />
          ) : null}
          <View style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(0,0,0,${SCRIM_DIM})` }]} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(6,20,12,0.18)' }]} />
        </View>

        {/* ── Tap-to-close ──────────────────────────────────────────────────────
            Covers the whole window (tab bar strip too) → tapping the same tab again
            closes the sheet, exactly like the toggle the user asked for. */}
        <TouchableOpacity
          activeOpacity={1}
          onPress={onClose}
          style={[StyleSheet.absoluteFillObject, { zIndex: 2, elevation: 2 }]}
        />

        {/* ── Sheet card ────────────────────────────────────────────────────── */}
        <Animated.View
          style={[
            s.wrap,
            {
              marginBottom: bottomOffset + 10,
              maxHeight: maxSheetHeight,
              opacity: anim,
              transform: [{ translateY: sheetTranslateY }],
              zIndex: 3,
              elevation: 3,
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
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
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
