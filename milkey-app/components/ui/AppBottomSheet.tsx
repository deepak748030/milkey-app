import React, { memo, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, Modal, TouchableOpacity, ScrollView, useWindowDimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/hooks/useTheme';
import { X, ChevronRight } from 'lucide-react-native';

export type SheetItem<T extends string> = { key: T; label: string; IconComp: any; iconBg: string; iconColor: string };

type Props<T extends string> = {
  visible: boolean;
  onClose: () => void;
  title: string;
  items: SheetItem<T>[];
  activeKey: T;
  onSelect: (k: T) => void;
  isActive?: (active: T, item: SheetItem<T>) => boolean;
  bottomOffset?: number;
  topOffset?: number;
};

/**
 * Floating action sheet.
 * Deliberately NOT edge-to-edge: it sits as a separate rounded card with a
 * gradient green border + shadow so it clearly looks "lifted" out of the phone
 * screen, and it is hard-capped to under half the screen height (46%) with an
 * internal scroll when the item list grows. Rows are compact (44px) so all six
 * Collection/Selling options fit without eating the whole screen.
 */
function AppBottomSheet<T extends string>({ visible, onClose, title, items, activeKey, onSelect, isActive, bottomOffset = 0, topOffset = 0 }: Props<T>) {
  const { colors, isDark } = useTheme();
  // Hard cap: the sheet must never take half of the phone screen.
  const { height: screenHeight } = useWindowDimensions();
  const maxSheetHeight = Math.round(screenHeight * 0.46);
  const handle = useCallback((k: T) => { onSelect(k); onClose(); }, [onSelect, onClose]);
  const s = styles(colors, isDark);
  if (!visible) return null;
  const insetStyle: any = {};
  if (bottomOffset) insetStyle.bottom = bottomOffset;
  if (topOffset) insetStyle.top = topOffset;
  const hasInset = bottomOffset || topOffset;
  const borderColors: [string, string, string] = isDark
    ? ['#22C55E', '#14532D', '#4ADE80']
    : ['#22C55E', '#86EFAC', '#15803D'];
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
          <LinearGradient
            colors={borderColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.borderGradient}
          >
            <View style={s.card}>
              <View style={s.handle} />
              <View style={s.header}>
                <Text style={s.title}>{title}</Text>
                <Pressable onPress={onClose} style={s.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <X size={15} color={colors.foreground} />
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
                  return (
                    <Pressable key={item.key} onPress={() => handle(item.key)} style={({ pressed }) => [s.row, pressed && s.pressed, active && s.rowActive]}>
                      <View style={[s.iconBox, { backgroundColor: item.iconBg }]}><Icon size={15} color={item.iconColor} /></View>
                      <Text numberOfLines={1} style={[s.label, active && s.labelActive]}>{item.label}</Text>
                      <ChevronRight size={15} color={active ? colors.primary : colors.mutedForeground} />
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
}
const styles = (c: any, dark: boolean) => StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'transparent' },
  // Floating card: inset from both sides, never taller than 46% of the screen.
  wrap: {
    marginHorizontal: 14,
    borderRadius: 24,
    shadowColor: '#052e16',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.26,
    shadowRadius: 18,
    elevation: 24,
  },
  // Gradient outline = the "mast border" that makes the sheet look separately lifted.
  borderGradient: { borderRadius: 24, padding: 1.5, flexShrink: 1 },
  card: {
    backgroundColor: c.card,
    borderRadius: 22.5,
    paddingTop: 6,
    paddingBottom: 10,
    paddingHorizontal: 8,
    flexShrink: 1,
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: c.primary, opacity: 0.45, alignSelf: 'center', marginBottom: 6 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, paddingHorizontal: 6 },
  title: { fontSize: 15, fontWeight: '800', color: c.foreground, letterSpacing: 0.2 },
  closeBtn: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: dark ? 'rgba(255,255,255,0.08)' : '#F1F5F1',
    alignItems: 'center', justifyContent: 'center',
  },
  scroll: { flexShrink: 1 },
  list: { gap: 6, paddingBottom: 2 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: dark ? 'rgba(255,255,255,0.06)' : '#FAFAFA',
    borderRadius: 12, paddingVertical: 7, paddingHorizontal: 10,
    borderWidth: 1, borderColor: dark ? 'rgba(255,255,255,0.08)' : '#EEF2EE',
  },
  pressed: { opacity: 0.7 },
  rowActive: {
    backgroundColor: dark ? 'rgba(34,197,94,0.12)' : '#E9F9EE',
    borderColor: '#22C55E',
    borderWidth: 1.5,
  },
  iconBox: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  label: { flex: 1, fontSize: 14, fontWeight: '600', color: c.foreground },
  labelActive: { color: c.primary, fontWeight: '700' },
});
export default memo(AppBottomSheet) as typeof AppBottomSheet;
