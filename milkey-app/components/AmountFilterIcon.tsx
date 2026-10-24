import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

type Props = {
  sort: 'asc' | 'desc' | null;
  onToggle: () => void;
};

// Red filter icon like image: 3 horizontal bars with varying lengths
// none = 100% / 60% / 100% centered (image top), asc = 60% / 80% / 100%, desc = 100% / 80% / 60%
// All red when active, muted gray when inactive
export default function AmountFilterIcon({ sort, onToggle }: Props) {
  const { colors } = useTheme();
  const isActive = sort !== null;
  // widths matching image: 22 ~ 100%, 17 ~ 77%, 12 ~ 55%
  const w1 = sort === 'asc' ? 12 : sort === 'desc' ? 22 : 22;
  const w2 = sort === null ? 13 : 17;
  const w3 = sort === 'asc' ? 22 : sort === 'desc' ? 12 : 22;
  return (
    <Pressable
      onPress={onToggle}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: colors.card, borderColor: isActive ? '#E30613' : colors.border },
        pressed && { opacity: 0.7 },
      ]}
    >
      <View style={styles.iconWrap}>
        <View
          style={[
            styles.bar,
            {
              width: w1,
              backgroundColor: isActive ? '#E30613' : colors.mutedForeground,
            },
          ]}
        />
        <View
          style={[
            styles.bar,
            {
              width: w2,
              backgroundColor: isActive ? '#E30613' : colors.mutedForeground,
            },
          ]}
        />
        <View
          style={[
            styles.bar,
            {
              width: w3,
              backgroundColor: isActive ? '#E30613' : colors.mutedForeground,
            },
          ]}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  iconWrap: {
    gap: 3,
    alignItems: 'flex-start',
  },
  bar: {
    height: 4,
    borderRadius: 2,
  },
});
