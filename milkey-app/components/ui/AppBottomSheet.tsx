import React, { memo, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  useWindowDimensions, Animated, Easing, Platform, BackHandler,
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
  /** Height of the bottom tab bar: the sheet floats exactly this far above the bottom. */
  bottomOffset?: number;
  /** Kept for API compatibility. */
  topOffset?: number;
  /** Kept for API compatibility. */
  blurTarget?: React.RefObject<any>;
};

/** Reserved height of the handle + title row + paddings inside the card. */
const CARD_CHROME = 96;
/** How dark the screen behind the sheet goes (this layer). */
const STAGE_DIM = 0.66;

/**
 * Collection / Selling floating sheet.
 *
 * ── The one rule that makes the dark backdrop work ───────────────────────────
 * The dark colour is painted ON THE VERY SAME VIEW THAT HOLDS THE SHEET CARD.
 * Not on a sibling of <Tabs>, not in a <Modal>, not in a screen — on the stage View
 * whose child (the white card) we can see above the screen content. If the card is
 * visible above the screen, then that View is above the screen, therefore its own
 * background IS above the screen too. No z-index / elevation / window guessing.
 *
 * That stage stops exactly at the top of the bottom tab bar (`bottom: bottomOffset`),
 * so:
 *   • status bar + green header + the whole screen behind the sheet go dark,
 *   • the bottom tab bar stays 100% bright and tappable.
 *
 * Layout notes:
 *   • The sheet is drawn inline (no <Modal>) so it shares the tab bar's coordinate
 *     space — it can never climb over the tab bar or sit too high.
 *   • The list gets `maxHeight = 50% screen - card chrome`, so oversized content can
 *     never spill out of the card and reach the tab bar.
 *   • Card elevation is kept small; a huge elevation made its shadow grey out the
 *     tab bar strip below it.
 */
function AppBottomSheet<T extends string>({
  visible, onClose, title, items, activeKey, onSelect, isActive,
  bottomOffset = 0,
}: Props<T>) {
  const { colors, isDark } = useTheme();
  const { height: screenHeight } = useWindowDimensions();
  const maxSheetHeight = Math.round(screenHeight * 0.5);
  const listMaxHeight = Math.max(140, maxSheetHeight - CARD_CHROME);

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

  // Inline overlay has no Modal → handle the Android back button ourselves.
  useEffect(() => {
    if (!visible || Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { onClose(); return true; });
    return () => sub.remove();
  }, [visible, onClose]);

  // Second, independent dark layer living inside the screens (<ScreenDim />).
  const showScreenDim = useSheetScrimStore((st) => st.showScreen);
  const hideScreenDim = useSheetScrimStore((st) => st.hideScreen);
  useEffect(() => {
    if (!visible) return;
    showScreenDim();
    return () => hideScreenDim();
  }, [visible, showScreenDim, hideScreenDim]);

  const handle = useCallback((k: T) => { onSelect(k); onClose(); }, [onSelect, onClose]);
  const s = styles(colors, isDark);
  if (!visible) return null;

  const cardTranslateY = anim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] });

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[s.stage, { bottom: bottomOffset, opacity: anim }]}
    >
      {/* iOS only: real blur on top of the dark colour. Android has no native blur
          outside a dev build, so the dark colour carries it there. */}
      {Platform.OS === 'ios' ? (
        <BlurView intensity={45} tint="dark" style={StyleSheet.absoluteFill} />
      ) : null}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(6,20,12,0.18)' }]} />

      {/* Tap anywhere above the tab bar to dismiss. The tab bar itself is outside this
          stage, so tapping the same tab again still closes the sheet. */}
      <TouchableOpacity activeOpacity={1} onPress={onClose} style={StyleSheet.absoluteFillObject} />

      <View pointerEvents="box-none" style={s.cardSlot}>
        <Animated.View
          style={[
            s.wrap,
            {
              marginBottom: 10,
              maxHeight: maxSheetHeight,
              transform: [{ translateY: cardTranslateY }],
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
              style={[s.scroll, { maxHeight: listMaxHeight }]}
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
    </Animated.View>
  );
}

const styles = (c: any, dark: boolean) => StyleSheet.create({
  /**
   * The stage: full width, from the very top (status bar) down to the top edge of the
   * bottom tab bar. Its own `backgroundColor` is the dark backdrop — the sheet card is
   * a child of this exact View, so wherever the card can be painted, this colour is
   * painted as well.
   */
  stage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    elevation: 50,
    backgroundColor: `rgba(0,0,0,${STAGE_DIM})`,
  },
  cardSlot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  wrap: {
    borderRadius: 28,
    backgroundColor: c.card,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 22,
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
