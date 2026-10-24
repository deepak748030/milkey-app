import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { Card } from '@/components/ui/Card';

export const FormCard = memo(function FormCard({ children, style }: { children: React.ReactNode; style?: any }) {
  const { colors } = useTheme();
  return <View style={[styles.wrap, { backgroundColor: colors.card, borderColor: colors.border }, style]}>{children}</View>;
});
const styles = StyleSheet.create({ wrap: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 12 } });

export const Row = memo(function Row({ children, gap = 8, style }: { children: React.ReactNode; gap?: number; style?: any }) {
  return <View style={[{ flexDirection: 'row', gap }, style]}>{children}</View>;
});
