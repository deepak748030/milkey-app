import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LucideIcon } from 'lucide-react-native';
import { colors } from '@/lib/colors';

interface InfoRowProps {
  icon: LucideIcon;
  label: string;
  value: string;
}

export function InfoRow({ icon: Icon, label, value }: InfoRowProps) {
  return (
    <View style={styles.container}>
      <View style={styles.left}>
        <Icon size={18} color={colors.primary} />
        <Text style={styles.label}>{label}</Text>
      </View>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontSize: 14,
    color: colors.mutedForeground,
  },
  value: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.foreground,
  },
});
