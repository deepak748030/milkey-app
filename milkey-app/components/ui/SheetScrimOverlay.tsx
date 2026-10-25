import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';

type Props = {
  visible: boolean;
  /** Height of the bottom tab bar — the scrim stops above it so the tab bar stays bright. */
  bottomOffset?: number;
  /** 0 = transparent, 1 = black. */
  dim?: number;
};

/**
 * Full-window dark layer for the Collection / Selling bottom sheet.
 *
 * Rendered as the LAST child of the tabs layout (a plain in-window View), so it is
 * painted above every screen, the TopBar and the header — nothing can cover it
 * (a <BlurTargetView> used to paint over it, that wrapper is gone now).
 * Only the bottom tab bar is left undimmed, exactly like the reference design.
 *
 * It uses no native view on Android (pure Views → 100% reliable); iOS additionally
 * blurs the screen behind it.
 */
export function SheetScrimOverlay({ visible, bottomOffset = 0, dim = 0.72 }: Props) {
  if (!visible) return null;
  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFillObject,
        { bottom: bottomOffset, zIndex: 9998, elevation: 40 },
      ]}
    >
      {Platform.OS === 'ios' ? (
        <BlurView intensity={45} tint="dark" style={StyleSheet.absoluteFill} />
      ) : null}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(0,0,0,${dim})` }]} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(6,20,12,0.18)' }]} />
    </View>
  );
}

export default SheetScrimOverlay;
