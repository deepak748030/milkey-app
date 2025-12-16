import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { LucideIcon } from 'lucide-react-native';
import { colors } from '@/lib/colors';

interface MenuItemProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  onPress: () => void;
}

export function MenuItem({ icon: Icon, title, subtitle, onPress }: MenuItemProps) {
  return (
    <Pressable style={styles.container} onPress={onPress}>
      <View style={styles.left}>
        <Icon size={20} color={colors.primary} />
        <View style={styles.textContainer}>
          <Text style={styles.title}>{title}</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
      </View>
      <Text style={styles.arrow}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    padding: 16,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.foreground,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 12,
    color: colors.mutedForeground,
  },
  arrow: {
    fontSize: 18,
    color: colors.mutedForeground,
  },
});
