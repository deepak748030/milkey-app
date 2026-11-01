import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Central haptic policy.
 *
 * Haptics fire ONLY for real interactions:
 *   • button / pressable taps  (wrap: @/components/ui/HapticPressable)
 *   • text inputs (focus)      (wrap: @/components/ui/HapticTextInput)
 *   • bottom tab bar taps      (rendered with the same HapticPressable)
 *   • AppBottomSheet rows / close (same HapticPressable)
 *
 * Nothing else vibes: plain screen taps, scrolling, cards without press
 * handlers etc. do NOT trigger a haptic.
 *
 * ONE buzz per tap. HapticPressable asks for it on press-in and only fills in on
 * release when press-in didn't buzz (see the `buzzedRef` guard there); the tiny
 * throttle below additionally absorbs press-in + focus landing on the same ms.
 */
let lastAt = 0;
const MIN_GAP_MS = 45;

/**
 * Runs the haptic unless one fired in the last MIN_GAP_MS.
 * Returns true only when the buzz was actually dispatched — callers use that to
 * know whether the current tap still needs its (single) buzz.
 */
function run(fn: () => Promise<void>): boolean {
  const now = Date.now();
  if (now - lastAt < MIN_GAP_MS) return false;
  lastAt = now;
  try { fn().catch(() => { }); } catch { return false; }
  return true;
}

/**
 * Fires the haptic for a press, but on the NEXT tick.
 * Fallback only (used by HapticPressable when press-in never buzzed): tab
 * switching freezes the outgoing screen (freezeOnBlur), so a buzz requested
 * inside the press handler can be lost on some Android builds — deferring it to
 * the next tick keeps that case at 100%.
 */
export function hapticTapDeferred() {
  setTimeout(hapticTap, 0);
}

/** Light selection tick — used for every button / input / tab / sheet row.
 *  Returns true when the buzz actually fired. */
export function hapticTap(): boolean {
  if (Platform.OS === 'web') return false;
  return run(() => Haptics.selectionAsync());
}

/** Slightly stronger impact — kept for future use / explicit calls. */
export function hapticImpact(): boolean {
  if (Platform.OS === 'web') return false;
  return run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}
