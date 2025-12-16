import React from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ShoppingCart } from 'lucide-react-native';
import { colors } from '@/lib/colors';
import { LinearGradient } from 'expo-linear-gradient';

export default function TopBar() {
  const insets = useSafeAreaInsets();

  const handleCartPress = () => {
    // Navigate to cart
  };

  return (
    <LinearGradient
      colors={[colors.background, colors.card]}
      style={[styles.container, { paddingTop: insets.top + 4 }]}
    >
      <View style={styles.leftSection}>
        <Image
          source={require('@/assets/images/milkey-logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <View>
          <Text style={styles.appName}>Milkey</Text>
          <Text style={styles.tagline}>Your complete dairy solution</Text>
        </View>
      </View>

      <Pressable style={styles.cartButton} onPress={handleCartPress}>
        <ShoppingCart size={20} color={colors.foreground} strokeWidth={2} />
      </Pressable>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logo: {
    width: 36,
    height: 36,
    borderRadius: 8,
  },
  appName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.foreground,
  },
  tagline: {
    fontSize: 11,
    color: colors.mutedForeground,
  },
  cartButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
