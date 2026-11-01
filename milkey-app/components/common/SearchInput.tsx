import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { TextInput } from '@/components/ui/HapticTextInput';
import { Pressable } from '@/components/ui/HapticPressable';
import { useTheme } from '@/hooks/useTheme';
import { Search, X } from 'lucide-react-native';

export const SearchInput = memo(function SearchInput({ value, onChange, placeholder = 'Search...', onClear }: { value: string; onChange: (v: string) => void; placeholder?: string; onClear?: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.wrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Search size={16} color={colors.mutedForeground} />
      <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground }]} />
      {value ? <Pressable onPress={() => (onClear ? onClear() : onChange(''))}><X size={16} color={colors.mutedForeground} /></Pressable> : null}
    </View>
  );
});
const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  input: { flex: 1, fontSize: 13, paddingVertical: 0 },
});
