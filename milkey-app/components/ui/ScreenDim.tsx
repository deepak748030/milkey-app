import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSheetScrimStore } from '@/lib/sheetScrimStore';
import { useSubTabStore } from '@/lib/subTabStore';

type Which = 'collection' | 'selling';

/**
 * Dark layer for the Collection / Selling floating sheet.
 *
 * It is rendered INSIDE the screen that owns the sheet (as the last child of the
 * screen's root View), never as a sibling of <Tabs>. Reason: `react-native-screens`
 * renders every screen in its own native layer on Android, and anything living next
 * to <Tabs> (root scrim, tabs overlay, absolute stage, any elevation) is painted
 * BEHIND those screen layers — that is why the background kept staying bright.
 * As a child of the screen it is in the same view tree, so it is always painted above
 * the header (TopBar), the cards and the table — guaranteed, no Z-order games.
 *
 * Because it stops at the bottom of the screen, the bottom tab bar (which lives
 * outside the screen) stays fully bright, exactly like the reference design.
 *
 * IMPORTANT: this is only the SECOND net. The primary dark backdrop is painted by
 * AppBottomSheet itself (on the same View that holds the card, which is guaranteed to
 * be above the screen). This one adds extra depth when it renders.
 *
 * Two independent signals switch it on:
 *   1. `useSubTabStore.collectionSheetOpen / sellingSheetOpen` — written by the tab
 *      layout, the same store the screens already re-render from.
 *   2. `useSheetScrimStore.screenCount` — written by AppBottomSheet itself.
 *
 * pointerEvents="none" → it never blocks a tap (tab bar toggle, sheet rows, etc).
 */
export function ScreenDim({ dim = 0.5, which }: { dim?: number; which?: Which }) {
  const screenCount = useSheetScrimStore((s) => s.screenCount);
  const collectionOpen = useSubTabStore((s) => s.collectionSheetOpen);
  const sellingOpen = useSubTabStore((s) => s.sellingSheetOpen);

  const storeOpen =
    which === 'collection' ? collectionOpen :
    which === 'selling' ? sellingOpen :
    collectionOpen || sellingOpen;

  if (screenCount <= 0 && !storeOpen) return null;

  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFillObject, { zIndex: 999, elevation: 40 }]}
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
