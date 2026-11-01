import React, { forwardRef, useRef } from 'react';
import { TextInput as RNTextInput, TextInputProps } from 'react-native';
import { hapticTapDeferred } from '@/lib/haptics';

type TouchPoint = { x: number; y: number };
type TouchGesture = {
  start: TouchPoint | null;
  moved: boolean;
  cancelled: boolean;
  focused: boolean;
};

const SCROLL_SLOP = 8;

function getTouchPoint(event: any): TouchPoint | null {
  const nativeEvent = event?.nativeEvent;
  const touch = nativeEvent?.changedTouches?.[0] || nativeEvent?.touches?.[0] || nativeEvent;
  const x = Number(touch?.pageX ?? touch?.locationX);
  const y = Number(touch?.pageY ?? touch?.locationY);
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

function markGestureMovement(gesture: TouchGesture, event: any, isMove: boolean) {
  const point = getTouchPoint(event);
  if (!gesture.start || !point) {
    if (isMove) gesture.moved = true;
    return;
  }
  if (
    Math.abs(point.x - gesture.start.x) > SCROLL_SLOP ||
    Math.abs(point.y - gesture.start.y) > SCROLL_SLOP
  ) {
    gesture.moved = true;
  }
}

/**
 * Drop-in replacement for react-native's <TextInput> that fires ONE light haptic
 * when a tap focuses the field. The feedback waits for touch-up and is canceled
 * if the finger moves, so focusing an input while beginning a scroll stays silent.
 * `autoFocus` fields also stay silent when a form opens.
 */
export const TextInput = forwardRef<any, TextInputProps>((props, ref) => {
  const {
    onFocus,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onTouchCancel,
    autoFocus,
    ...rest
  } = props as any;
  const touchRef = useRef<TouchGesture | null>(null);

  return (
    <RNTextInput
      {...rest}
      autoFocus={autoFocus}
      ref={ref}
      onTouchStart={(e: any) => {
        touchRef.current = {
          start: getTouchPoint(e),
          moved: false,
          cancelled: false,
          focused: false,
        };
        onTouchStart?.(e);
      }}
      onTouchMove={(e: any) => {
        if (touchRef.current) markGestureMovement(touchRef.current, e, true);
        onTouchMove?.(e);
      }}
      onTouchEnd={(e: any) => {
        const gesture = touchRef.current;
        if (gesture) {
          markGestureMovement(gesture, e, false);
          setTimeout(() => {
            if (touchRef.current === gesture) touchRef.current = null;
            if (!autoFocus && gesture.focused && !gesture.moved && !gesture.cancelled) {
              hapticTapDeferred();
            }
          }, 0);
        }
        onTouchEnd?.(e);
      }}
      onTouchCancel={(e: any) => {
        if (touchRef.current) {
          touchRef.current.cancelled = true;
          touchRef.current = null;
        }
        onTouchCancel?.(e);
      }}
      onFocus={(e: any) => {
        if (!autoFocus && touchRef.current) touchRef.current.focused = true;
        onFocus?.(e);
      }}
    />
  );
});

TextInput.displayName = 'HapticTextInput';
export default TextInput;
