import React, { memo, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { BlurView } from 'expo-blur';
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

function AppBottomSheet<T extends string>({ visible, onClose, title, items, activeKey, onSelect, isActive, bottomOffset = 0, topOffset = 0 }: Props<T>) {
  const { colors, isDark } = useTheme();
  const handle = useCallback((k: T) => { onSelect(k); onClose(); }, [onSelect, onClose]);
  const s = styles(colors, isDark);
  if (!visible) return null;
  const insetStyle: any = {};
  if (bottomOffset) insetStyle.bottom = bottomOffset;
  if (topOffset) insetStyle.top = topOffset;
  const hasInset = bottomOffset || topOffset;
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
        <View style={[s.sheet, bottomOffset ? { marginBottom: bottomOffset } : null]}>
          <View style={s.handle} />
          <View style={s.header}><Text style={s.title}>{title}</Text><Pressable onPress={onClose} style={s.closeBtn}><X size={18} color={colors.foreground} /></Pressable></View>
          <View style={s.list}>
            {items.map(item => {
              const active = isActive ? isActive(activeKey, item) : activeKey === item.key;
              const Icon = item.IconComp;
              return (
                <Pressable key={item.key} onPress={() => handle(item.key)} style={({ pressed }) => [s.row, pressed && s.pressed, active && s.rowActive]}>
                  <View style={[s.iconBox, { backgroundColor: item.iconBg }]}><Icon size={18} color={item.iconColor} /></View>
                  <Text style={[s.label, active && s.labelActive]}>{item.label}</Text>
                  <ChevronRight size={18} color={active ? colors.primary : colors.mutedForeground} />
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}
const styles = (c: any, dark: boolean) => StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'transparent' },
  sheet: {
    backgroundColor: c.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
    paddingBottom: 24,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderColor: c.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 20,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: c.border, alignSelf: 'center', marginBottom: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingHorizontal: 4 },
  title: { fontSize: 18, fontWeight: '800', color: c.foreground },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: dark ? 'rgba(255,255,255,0.08)' : '#F5F5F5', alignItems: 'center', justifyContent: 'center' },
  list: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: dark ? 'rgba(255,255,255,0.06)' : '#FAFAFA', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: dark ? 'rgba(255,255,255,0.08)' : '#F0F0F0' },
  pressed: { opacity: 0.7 },
  rowActive: { backgroundColor: dark ? 'rgba(34,197,94,0.12)' : '#E8F5E9', borderColor: '#22C55E' },
  iconBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  label: { flex: 1, fontSize: 15, fontWeight: '600', color: c.foreground },
  labelActive: { color: c.primary, fontWeight: '700' },
});
export default memo(AppBottomSheet) as typeof AppBottomSheet;
