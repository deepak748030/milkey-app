import React, { memo } from 'react';
import { View, StyleSheet, ViewProps } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

export const Card = memo(function Card({ style, ...p }: ViewProps) {
  const { colors } = useTheme();
  return <View style={[styles(c).base, style]} {...p} />;
});
const styles = (c: any) => StyleSheet.create({ base: { backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 12, padding: 12 } });

export const Section = memo(function Section({ title, children, style }: { title?: string; children: React.ReactNode; style?: any }) {
  const { colors } = useTheme();
  return <View style={[style]}>{children}</View>;
});
