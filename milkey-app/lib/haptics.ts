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
 * A tiny throttle keeps a single tap from buzzing twice (press-in + focus).
 */
let lastAt = 0;
const MIN_GAP_MS = 45;

function run(fn: () => Promise<void>) {
  const now = Date.now();
  if (now - lastAt < MIN_GAP_MS) return;
  lastAt = now;
  try { fn().catch(() => { }); } catch { }
}

/**
 * Fires the haptic for a press, but on the NEXT tick.
 * Tab switching freezes the outgoing screen (freezeOnBlur), so buzzing inside the
 * press handler can be lost on some Android builds — deferring it keeps it 100%.
 */
export function hapticTapDeferred() {
  setTimeout(hapticTap, 0);
}

/** Light selection tick — used for every button / input / tab / sheet row. */
export function hapticTap() {
  if (Platform.OS === 'web') return;
  run(() => Haptics.selectionAsync());
}

/** Slightly stronger impact — kept for future use / explicit calls. */
export function hapticImpact() {
  if (Platform.OS === 'web') return;
  run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}
