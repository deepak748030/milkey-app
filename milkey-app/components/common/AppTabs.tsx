import React, { memo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Pressable } from '@/components/ui/HapticPressable';
import { useTheme } from '@/hooks/useTheme';

// Ponytail reusable Tabs - single source for Purchase/Selling/Register TAB_ORDER
export const AppTabs = memo(function AppTabs<T extends string>({ tabs, active, onChange }: { tabs: readonly T[]; active: T; onChange: (t: T) => void }) {
  const { colors } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
      {tabs.map(tab => {
        const isActive = tab === active;
        return (
          <Pressable key={tab} onPress={() => onChange(tab)} style={[styles.tab, { borderColor: isActive ? colors.primary : colors.border, backgroundColor: isActive ? colors.primary : colors.card }]}>
            <Text style={[styles.label, { color: isActive ? colors.white : colors.foreground }]}>{tab}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
});
const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 12, gap: 8, paddingVertical: 8 },
  tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  label: { fontSize: 13, fontWeight: '600' },
});

export const TAB_ORDERS = {
  purchase: ['Purchase', 'Report', 'Farmer'] as const,
  selling: ['Entry', 'Payment', 'Reports', 'Customer'] as const,
  register: ['Payments', 'Advances', 'Farmer'] as const,
} as const;
