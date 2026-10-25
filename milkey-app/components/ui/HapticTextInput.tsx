import React, { forwardRef } from 'react';
import { TextInput as RNTextInput, TextInputProps } from 'react-native';
import { hapticTap } from '@/lib/haptics';

/**
 * Drop-in replacement for react-native's <TextInput> that fires ONE light haptic
 * when the user actually taps into the field (focus). `autoFocus` fields stay
 * silent so opening a form doesn't buzz on its own.
 */
export const TextInput = forwardRef<any, TextInputProps>((props, ref) => {
  const { onFocus, autoFocus, ...rest } = props as any;
  return (
    <RNTextInput
      {...rest}
      autoFocus={autoFocus}
      ref={ref}
      onFocus={(e: any) => {
        if (!autoFocus) hapticTap();
        onFocus?.(e);
      }}
    />
  );
});

TextInput.displayName = 'HapticTextInput';
export default TextInput;
