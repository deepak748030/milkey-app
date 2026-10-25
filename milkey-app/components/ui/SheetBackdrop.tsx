import React, { createContext, useContext, useRef } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { BlurView, BlurTargetView } from 'expo-blur';

/**
 * Shared sheet backdrop: dark scrim + real blur, used behind EVERY bottom sheet.
 *
 * Android note (expo-blur SDK 57): a BlurView only blurs when it has an explicit
 * `blurMethod` and a `blurTarget` pointing at a <BlurTargetView>. Sheets that are
 * rendered inline (e.g. AppBottomSheet) get that ref through context; sheets that
 * live inside a <Modal> cannot sample another window, so there the blur simply
 * falls back and the dark scrim (which always works) keeps the screen dark.
 */
type BlurTargetRef = React.RefObject<any> | null;

const BlurTargetContext = createContext<BlurTargetRef>(null);

export function useBlurTarget(): BlurTargetRef {
  return useContext(BlurTargetContext);
}

/** Wrap the app (or a tab surface) once, so sheets rendered inside it can blur it. */
export function BlurTargetProvider({ children }: { children: React.ReactNode }) {
  const ref = useRef<any>(null);
  return (
    <BlurTargetContext.Provider value={ref}>
      <BlurTargetView ref={ref} style={{ flex: 1 }} collapsable={false}>
        {children}
      </BlurTargetView>
    </BlurTargetContext.Provider>
  );
}

type Props = {
  /** 0 → only blur, 1 → fully black. Defaults to a near-black dark scrim. */
  dim?: number;
  /** Adds the subtle green tint used by the app's own sheets. */
  tint?: boolean;
};

export function SheetBackdrop({ dim = 0.74, tint = true }: Props) {
  const blurTarget = useBlurTarget();
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <BlurView
        intensity={Platform.OS === 'ios' ? 60 : 70}
        tint="dark"
        style={StyleSheet.absoluteFill}
        {...(Platform.OS === 'android'
          ? {
              blurMethod: 'dimezisBlurViewSdk31Plus' as const,
              blurReductionFactor: 3,
              ...(blurTarget ? { blurTarget } : {}),
            }
          : {})}
      />
      {/* Strong scrim: every bottom sheet must make the screen behind read black-ish */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(0,0,0,${dim})` }]} />
      {tint ? <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(6,20,12,0.18)' }]} /> : null}
    </View>
  );
}

export default SheetBackdrop;
