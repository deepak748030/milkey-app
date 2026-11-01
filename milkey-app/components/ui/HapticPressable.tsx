import React, { forwardRef } from 'react';
import { Pressable as RNPressable, PressableProps } from 'react-native';
import { hapticTapDeferred } from '@/lib/haptics';

/**
 * Drop-in replacement for react-native's <Pressable> that fires ONE light haptic
 * per successful tap — every "button" in the app is a Pressable, so this gives
 * haptics to buttons without touching any layout or styling.
 *
 * Haptics run from `onPress`, not `onPressIn`: React Native may report a press-in
 * as soon as a finger lands, before it knows that the gesture will become a
 * scroll. `onPress` only runs once the touch is recognized as a tap. Deferring
 * the haptic by one tick also keeps it reliable when a tap immediately navigates
 * away from or freezes the current screen.
 */
export const Pressable = forwardRef<any, PressableProps>((props, ref) => {
  const { onPressIn, onPress, onPressOut, disabled, ...rest } = props as any;
  return (
    <RNPressable
      {...rest}
      ref={ref}
      disabled={disabled}
      onPressIn={onPressIn}
      onPress={(e: any) => {
        if (!disabled) hapticTapDeferred();
        onPress?.(e);
      }}
      onPressOut={onPressOut}
    />
  );
});

Pressable.displayName = 'HapticPressable';
export default Pressable;
