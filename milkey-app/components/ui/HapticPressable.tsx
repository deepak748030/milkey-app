import React, { forwardRef } from 'react';
import { Pressable as RNPressable, PressableProps } from 'react-native';
import { hapticTap, hapticTapDeferred } from '@/lib/haptics';

/**
 * Drop-in replacement for react-native's <Pressable> that fires ONE light haptic
 * on press-in — every "button" in the app is a Pressable, so this gives haptics
 * to buttons (and nothing else) without touching any layout or styling.
 */
export const Pressable = forwardRef<any, PressableProps>((props, ref) => {
  const { onPressIn, onPress, disabled, ...rest } = props as any;
  return (
    <RNPressable
      {...rest}
      ref={ref}
      disabled={disabled}
      onPressIn={(e: any) => {
        if (!disabled) hapticTap();
        onPressIn?.(e);
      }}
      onPress={(e: any) => {
        // Second, deferred tick: guarantees the buzz even when the press switches
        // screens/tabs (the outgoing screen may freeze immediately).
        if (!disabled) hapticTapDeferred();
        onPress?.(e);
      }}
    />
  );
});

Pressable.displayName = 'HapticPressable';
export default Pressable;
