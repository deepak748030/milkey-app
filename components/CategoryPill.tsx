import React from 'react';
import { Text, Pressable, StyleSheet } from 'react-native';
import { colors } from '@/lib/colors';

interface CategoryPillProps {
  name: string;
  isActive: boolean;
  onPress: () => void;
}

export function CategoryPill({ name, isActive, onPress }: CategoryPillProps) {
  return (
    <Pressable
      style={[styles.pill, isActive && styles.activePill]}
      onPress={onPress}
    >
      <Text style={[styles.text, isActive && styles.activeText]}>
        {name}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  activePill: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  text: {
    fontSize: 12,
    color: colors.foreground,
    fontWeight: '500',
  },
  activeText: {
    color: colors.primaryForeground,
  },
});
