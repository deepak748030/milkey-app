import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Search } from 'lucide-react-native';
import { colors } from '@/lib/colors';

interface SearchBarProps {
  placeholder?: string;
  onPress: () => void;
}

export function SearchBar({ placeholder = 'Search...', onPress }: SearchBarProps) {
  return (
    <Pressable style={styles.container} onPress={onPress}>
      <Search size={18} color={colors.mutedForeground} style={styles.icon} />
      <Text style={styles.placeholder}>{placeholder}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  icon: {
    marginRight: 8,
  },
  placeholder: {
    flex: 1,
    color: colors.mutedForeground,
    fontSize: 14,
  },
});
