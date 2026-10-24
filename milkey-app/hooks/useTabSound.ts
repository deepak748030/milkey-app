import { useCallback } from 'react';
import * as Haptics from 'expo-haptics';

/**
 * Vibration only — audio removed per user request.
 * All clicks now vibrate.
 */
export function useTabSound() {
  const play = useCallback(() => {
    try {
      // light vibrate on every tab/click
      Haptics.selectionAsync().catch(() => {});
      // also try impact for stronger feel — fallback to selection
      // Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    } catch {}
  }, []);
  return play;
}

// Generic vibrate for any press in app
export function vibrate() {
  try { Haptics.selectionAsync().catch(() => {}); } catch {}
}
export function vibrateLight() { vibrate(); }
export function vibrateHeavy() {
  try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); } catch {}
}
