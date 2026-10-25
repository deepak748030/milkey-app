import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSheetScrimStore } from '@/lib/sheetScrimStore';

/**
 * Dark layer rendered INSIDE a screen (as its last child), so it is always painted
 * above that screen's own content — header, cards, table, everything. This is the
 * only variant that does not depend on Android's cross-sibling Z ordering (a plain
 * sibling overlay is drawn behind the navigator's screen views, which is why the
 * background used to stay bright).
 *
 * The bottom tab bar lives outside the screen, so it stays bright automatically.
 * pointerEvents="none" → it never blocks taps.
 *
 * NOTE: this is the SECOND layer. The primary dark layer lives inside the sheet's
 * <Modal> window (AppBottomSheet), because a Modal is the only place that is
 * guaranteed to paint above react-native-screens' native screen layers on Android.
 * Both layers together give the near-black backdrop of the approved design; the dim
 * here is kept lower (0.55) so the combination never crushes to pure black.
 */
export function ScreenDim({ dim = 0.55 }: { dim?: number }) {
  const screenCount = useSheetScrimStore((s) => s.screenCount);
  if (screenCount <= 0) return null;
  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFillObject,
        { zIndex: 998, elevation: 30 },
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

export default ScreenDim;
