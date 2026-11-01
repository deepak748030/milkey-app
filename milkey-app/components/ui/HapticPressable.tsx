import React, { forwardRef, useRef } from 'react';
import { Pressable as RNPressable, PressableProps } from 'react-native';
import { hapticTap, hapticTapDeferred } from '@/lib/haptics';

/**
 * Drop-in replacement for react-native's <Pressable> that fires ONE light haptic
 * per tap — every "button" in the app is a Pressable, so this gives haptics to
 * buttons (and nothing else) without touching any layout or styling.
 *
 * The buzz belongs to press-in (touch down) so it feels instant. Release only
 * fills in when press-in didn't buzz, because touch-down → touch-up is normally
 * 80–200ms apart and buzzing on BOTH ends made every tap feel like a double
 * click. `buzzedRef` is per-gesture, so quick repeat taps still buzz every time.
 */
export const Pressable = forwardRef<any, PressableProps>((props, ref) => {
  const { onPressIn, onPress, onPressOut, disabled, ...rest } = props as any;
  const buzzedRef = useRef(false);
  return (
    <RNPressable
      {...rest}
      ref={ref}
      disabled={disabled}
      onPressIn={(e: any) => {
        buzzedRef.current = !disabled && hapticTap();
        onPressIn?.(e);
      }}
      onPress={(e: any) => {
        // Fallback only: guarantees a buzz when the press-in one was skipped
        // (throttled / never dispatched) — e.g. the press switches screens/tabs
        // and the outgoing screen freezes immediately.
        if (!disabled && !buzzedRef.current) hapticTapDeferred();
        onPress?.(e);
      }}
      onPressOut={(e: any) => {
        buzzedRef.current = false;
        onPressOut?.(e);
      }}
    />
  );
});

Pressable.displayName = 'HapticPressable';
export default Pressable;
