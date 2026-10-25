import React, { memo, useCallback, useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Modal, TouchableOpacity, ScrollView, useWindowDimensions, Animated, Easing } from 'react-native';
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
  /** Optional soft row tint (like the reference design). Dark theme ignores it. */
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
};

/**
 * Floating action sheet (reference design).
 * - Full screen width, floats 10px above the tab bar, rounded card + shadow.
 * - Thin BLACK border on the TOP edge only (no left / right / bottom border).
 * - Icon-free header: bold title + "Choose an option" + close, with soft green
 *   wave blobs behind it so it looks lifted out of the app.
 * - Icon-free rows: label + chevron only, soft per-item tints and a 1.5px green
 *   outline on the active row.
 * - Height is hard-capped below half the screen (46%): the exact same height as
 *   before, so the design change never eats more of the screen.
 */
function AppBottomSheet<T extends string>({
  visible, onClose, title, subtitle = 'Choose an option', items,
  activeKey, onSelect, isActive, bottomOffset = 0, topOffset = 0,
}: Props<T>) {
  const { colors, isDark } = useTheme();
  const { height: screenHeight } = useWindowDimensions();
  const maxSheetHeight = Math.round(screenHeight * 0.46);

  // Title fades in on mount, then keeps a static palette fade (text → card colour).
  const titleFade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!visible) { titleFade.setValue(0); return; }
    titleFade.setValue(0);
    Animated.timing(titleFade, {
      toValue: 1,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [visible, titleFade]);

  const handle = useCallback((k: T) => { onSelect(k); onClose(); }, [onSelect, onClose]);
  const s = styles(colors, isDark);
  if (!visible) return null;
  const insetStyle: any = {};
  if (bottomOffset) insetStyle.bottom = bottomOffset;
  if (topOffset) insetStyle.top = topOffset;
  const hasInset = bottomOffset || topOffset;
  // Thin black top border (kept light-on-dark so it stays visible in dark theme).
  const topBorderColor = isDark ? 'rgba(255,255,255,0.45)' : '#0B0B0B';
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={s.overlay}>
        {/* STRICT: blur+black ONLY on behind screen (upper content), sheet & header & tabBar stay 100% clear */}
        <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, hasInset ? insetStyle : null]}>
          <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFillObject} />
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.42)' }]} />
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(18,63,26,0.14)' }]} />
        </View>
        <TouchableOpacity style={[StyleSheet.absoluteFillObject, hasInset ? insetStyle : null]} activeOpacity={1} onPress={onClose} />
        <View style={[s.wrap, { marginBottom: bottomOffset + 10, maxHeight: maxSheetHeight }]}>
          <View style={s.card}>
            {/* Thin black border on the TOP edge only */}
            <View style={[s.topAccent, { backgroundColor: topBorderColor }]} pointerEvents="none" />
            {/* Soft green wave blobs behind the header (clipped by the card) */}
            <View pointerEvents="none" style={s.decorWrap}>
              <View style={[s.blob, { width: 260, height: 260, borderRadius: 130, right: -90, top: -140, backgroundColor: isDark ? 'rgba(34,197,94,0.10)' : '#E9F9EF' }]} />
              <View style={[s.blob, { width: 170, height: 170, borderRadius: 85, right: 26, top: -74, backgroundColor: isDark ? 'rgba(34,197,94,0.06)' : '#F3FCF7' }]} />
            </View>

            <View style={s.handle} />

            {/* Header: faded title + subtitle + close (no icons) */}
            <View style={s.header}>
              <View style={s.titleWrap}>
                <Animated.Text numberOfLines={1} style={[s.title, { opacity: titleFade }]}>{title}</Animated.Text>
                <LinearGradient
                  pointerEvents="none"
                  colors={['transparent', colors.card]}
                  locations={[0.5, 1]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFillObject}
                />
              </View>
              <Pressable onPress={onClose} style={s.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={16} color={colors.foreground} />
              </Pressable>
            </View>
            <Animated.Text numberOfLines={1} style={[s.subtitle, { opacity: titleFade }]}>{subtitle}</Animated.Text>

            <ScrollView
              style={s.scroll}
              contentContainerStyle={s.list}
              showsVerticalScrollIndicator={false}
              bounces={false}
              nestedScrollEnabled
            >
              {items.map(item => {
                const active = isActive ? isActive(activeKey, item) : activeKey === item.key;
                const rowTint = isDark
                  ? 'rgba(255,255,255,0.05)'
                  : (item.tint || '#F7FAF8');
                return (
                  <Pressable
                    key={item.key}
                    onPress={() => handle(item.key)}
                    style={({ pressed }) => [
                      s.row,
                      { backgroundColor: active ? (isDark ? 'rgba(34,197,94,0.14)' : '#EDF9F1') : rowTint },
                      active && s.rowActive,
                      pressed && s.pressed,
                    ]}
                  >
                    <Text numberOfLines={1} style={[s.label, active && s.labelActive]}>{item.label}</Text>
                    <ChevronRight size={15} color={active ? colors.primary : colors.mutedForeground} />
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = (c: any, dark: boolean) => StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'transparent' },
  // Full width, floating 10px above the tab bar, never taller than 46% of the screen.
  wrap: {
    marginHorizontal: 0,
    borderRadius: 26,
    backgroundColor: c.card,
    shadowColor: '#052e16',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.26,
    shadowRadius: 18,
    elevation: 24,
  },
  card: {
    backgroundColor: c.card,
    borderRadius: 26,
    paddingTop: 6,
    paddingBottom: 8,
    paddingHorizontal: 8,
    flexShrink: 1,
    overflow: 'hidden',
  },
  // Thin (1px) black border on the TOP edge only — no left / right / bottom border.
  topAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
  },
  decorWrap: { position: 'absolute', top: 0, left: 0, right: 0, height: 96, overflow: 'hidden' },
  blob: { position: 'absolute' },
  // Neutral grab handle — the green accent line above is the only green border.
  handle: { width: 44, height: 4, borderRadius: 2, backgroundColor: dark ? 'rgba(255,255,255,0.22)' : '#D8DEE3', alignSelf: 'center', marginBottom: 8 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 6 },
  titleWrap: { flex: 1, flexShrink: 1, overflow: 'hidden', paddingRight: 16 },
  title: { fontSize: 17, fontWeight: '800', color: c.foreground, letterSpacing: 0.1 },
  // Faded subtitle: muted grey, fading out to the card colour on the right.
  subtitle: { fontSize: 10.5, fontWeight: '600', color: c.mutedForeground, paddingLeft: 6, paddingRight: 40, marginTop: 1, marginBottom: 8 },
  closeBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: dark ? 'rgba(255,255,255,0.08)' : '#F1F5F3',
    alignItems: 'center', justifyContent: 'center', marginLeft: 'auto',
  },
  scroll: { flexShrink: 1 },
  // Rows stay compact (40px) so the sheet keeps exactly the same height as before.
  list: { gap: 5, paddingBottom: 2 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 14, paddingVertical: 6, paddingHorizontal: 10,
    borderWidth: 1, borderColor: 'transparent',
  },
  rowActive: { borderWidth: 1.5, borderColor: '#16A34A' },
  pressed: { opacity: 0.72 },
  label: { flex: 1, fontSize: 14, fontWeight: '700', color: c.foreground },
  labelActive: { color: c.primary, fontWeight: '800' },
});
export default memo(AppBottomSheet) as typeof AppBottomSheet;
