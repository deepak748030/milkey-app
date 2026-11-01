import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Pressable } from '@/components/ui/HapticPressable';
import { useTheme } from '@/hooks/useTheme';
import { Calculator, Store, ChevronRight } from 'lucide-react-native';
import { router } from 'expo-router';

export default memo(function HomeCalculator() {
  const { colors, isDark } = useTheme();
  const styles = createStyles(colors, isDark);

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {/* Store Button */}
        <Pressable style={styles.card} onPress={() => router.push('/products')}>
          <View style={[styles.iconWrap, { backgroundColor: colors.secondary }]}>
            <Store size={20} color={colors.primary} strokeWidth={2} />
          </View>
          <View style={styles.textBox}>
            <Text style={styles.title}>Store</Text>
            <Text style={styles.sub} numberOfLines={1}>All products</Text>
          </View>
          <ChevronRight size={14} color={colors.mutedForeground} strokeWidth={2} />
        </Pressable>

        {/* Calculator Button */}
        <Pressable style={styles.card} onPress={() => router.push('/calculator')}>
          <View style={[styles.iconWrap, { backgroundColor: colors.secondary }]}>
            <Calculator size={20} color={colors.primary} strokeWidth={2} />
          </View>
          <View style={styles.textBox}>
            <Text style={styles.title}>Calculator</Text>
            <Text style={styles.sub} numberOfLines={1}>Quick calc</Text>
          </View>
          <ChevronRight size={14} color={colors.mutedForeground} strokeWidth={2} />
        </Pressable>
      </View>
    </View>
  );
});

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  wrap: { marginTop: 10, paddingHorizontal: 2 },
  row: { flexDirection: 'row', gap: 8 },
  card: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBox: { flex: 1, gap: 1 },
  title: { fontSize: 13, fontWeight: '700', color: colors.foreground },
  sub: { fontSize: 11, fontWeight: '500', color: colors.mutedForeground },
});
