import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ShoppingCart, Bell, Sun, Moon } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';

export default function TopBar() {
  const insets = useSafeAreaInsets();
  const { colors, isDark, toggleTheme } = useTheme();

  return (
    <View style={[
      styles.container,
      {
        paddingTop: insets.top + 4,
        backgroundColor: colors.background,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }
    ]}>
      <View style={styles.leftSection}>
        <View style={[styles.logoContainer, { backgroundColor: colors.primary }]}>
          <Text style={styles.logoEmoji}>🥛</Text>
        </View>
        <View>
          <Text style={[styles.appName, { color: colors.foreground }]}>Milkey</Text>
          <Text style={[styles.tagline, { color: colors.mutedForeground }]}>Fresh dairy delivered</Text>
        </View>
      </View>

      <View style={styles.rightSection}>
        <Pressable
          style={[styles.iconButton, { backgroundColor: colors.secondary, borderColor: colors.border }]}
          onPress={toggleTheme}
        >
          {isDark ? (
            <Sun size={18} color={colors.primary} strokeWidth={2.5} />
          ) : (
            <Moon size={18} color={colors.primary} strokeWidth={2.5} />
          )}
        </Pressable>
        <Pressable
          style={[styles.iconButton, { backgroundColor: colors.secondary, borderColor: colors.border }]}
        >
          <Bell size={18} color={colors.foreground} strokeWidth={2} />
        </Pressable>
        <Pressable
          style={[styles.iconButton, { backgroundColor: colors.secondary, borderColor: colors.border }]}
        >
          <ShoppingCart size={18} color={colors.foreground} strokeWidth={2} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoEmoji: {
    fontSize: 22,
  },
  appName: {
    fontSize: 20,
    fontWeight: '700',
  },
  tagline: {
    fontSize: 11,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});
