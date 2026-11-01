import React, { memo } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Pressable } from '@/components/ui/HapticPressable';
import { useTheme } from '@/hooks/useTheme';
import { SearchInput } from '@/components/common/SearchInput';
import { Calendar } from 'lucide-react-native';

export const FilterBar = memo(function FilterBar({ search, onSearch, onDatePress, dateLabel, extra }: { search: string; onSearch: (v: string) => void; onDatePress?: () => void; dateLabel?: string; extra?: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      <View style={{ flex: 1 }}><SearchInput value={search} onChange={onSearch} placeholder="Search..." /></View>
      {onDatePress && <Pressable onPress={onDatePress} style={[styles.dateBtn, { backgroundColor: colors.card, borderColor: colors.border }]}><Calendar size={14} color={colors.primary} /><Text style={[styles.dateText, { color: colors.foreground }]}>{dateLabel || 'Date'}</Text></Pressable>}
      {extra}
    </View>
  );
});
const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 12 },
  dateBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  dateText: { fontSize: 12, fontWeight: '600' },
});
