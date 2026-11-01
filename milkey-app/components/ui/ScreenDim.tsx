import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLayoutStore } from '@/lib/layoutStore';
import { useSubTabStore } from '@/lib/subTabStore';

/**
 * In-screen dark backdrop for the Collection / Selling bottom sheet.
 *
 * WHY IT LIVES INSIDE THE SCREEN
 * A layer drawn by the navigator (or next to <Tabs>) is painted UNDER the native
 * screen container on Android — the sheet card showed up while its dark backdrop
 * stayed invisible. A View that is a child of the screen itself can never be
 * covered by that screen's own content, so this dark layer is guaranteed to paint
 * above the page, the cards and the green TopBar's body while leaving:
 *   • the green TopBar untouched (the layer starts exactly where the header ends),
 *   • the bottom tab bar bright and tappable (the tab bar is not part of the screen),
 *   • no Android elevation → no shadow is ever cast down onto the tab bar.
 *
 * The visibility flag is written by BOTH the tab layout (which owns the sheet state) and
 * the sheet component itself, so the dark layer can never miss it.
 */

const DIM = 0.62;
const TINT = 0.12;

export function ScreenDim({ which }: { which?: 'collection' | 'selling' }) {
  const insets = useSafeAreaInsets();
  const measuredHeader = useLayoutStore((st) => st.headerHeight);
  const collectionOpen = useSubTabStore((st) => st.collectionSheetOpen);
  const sellingOpen = useSubTabStore((st) => st.sellingSheetOpen);

  const ownSheetOpen =
    which === 'collection' ? collectionOpen : which === 'selling' ? sellingOpen : collectionOpen || sellingOpen;
  if (!ownSheetOpen) return null;

  // Start right below the measured green TopBar (fallback: status bar + its height).
  const top = Math.max(0, (measuredHeader > 0 ? measuredHeader : insets.top + 60) - 1);

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { top, zIndex: 999 }]}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(0,0,0,${DIM})` }]} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(6,20,12,${TINT})` }]} />
    </View>
  );
}

export default ScreenDim;
