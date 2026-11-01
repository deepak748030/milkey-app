import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Pressable } from '@/components/ui/HapticPressable';
import { useTheme } from '@/hooks/useTheme';

type Props = {
  sort: 'asc' | 'desc' | null;
  onToggle: () => void;
};

// Ascending / descending filter icon: 3 horizontal bars with varying lengths.
// none = 100% / 60% / 100% centred, asc = 60% / 80% / 100%, desc = 100% / 80% / 60%
// Active state is GREEN (app palette) and the whole control is smaller so it sits
// neatly next to the PDF / Print buttons.
export default function AmountFilterIcon({ sort, onToggle }: Props) {
  const { colors, isDark } = useTheme();
  const isActive = sort !== null;
  const activeColor = colors.primary;          // green
  const inactiveColor = colors.mutedForeground;
  const barColor = isActive ? activeColor : inactiveColor;
  // widths: 18 ≈ 100%, 14 ≈ 77%, 10 ≈ 55%
  const w1 = sort === 'asc' ? 10 : sort === 'desc' ? 18 : 18;
  const w2 = sort === null ? 11 : 14;
  const w3 = sort === 'asc' ? 18 : sort === 'desc' ? 10 : 18;
  return (
    <Pressable
      onPress={onToggle}
      hitSlop={6}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: isActive ? (isDark ? 'rgba(34,197,94,0.14)' : '#EAF8EF') : colors.card,
          borderColor: isActive ? activeColor : colors.border,
        },
        pressed && { opacity: 0.7 },
      ]}
    >
      <View style={styles.iconWrap}>
        <View style={[styles.bar, { width: w1, backgroundColor: barColor }]} />
        <View style={[styles.bar, { width: w2, backgroundColor: barColor }]} />
        <View style={[styles.bar, { width: w3, backgroundColor: barColor }]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 28,
    height: 28,
    borderRadius: 7,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    gap: 2.5,
    alignItems: 'flex-start',
  },
  bar: {
    height: 3,
    borderRadius: 1.5,
  },
});
