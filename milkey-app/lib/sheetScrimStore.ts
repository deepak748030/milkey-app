import { create } from 'zustand';

/**
 * Global dark-scrim state.
 *
 * Any bottom sheet that wants a dark + blur backdrop behind it calls show() when
 * it opens and hide() when it closes. The scrim itself is rendered ONCE at the
 * ROOT of the app (app/_layout.tsx), which is the only place that is guaranteed
 * to be painted above every screen, the TopBar and the status bar area.
 *
 * A counter is used because sheets can stack (e.g. a confirm sheet over a date
 * sheet): the scrim stays until the last one closes.
 */
type State = {
  count: number;
  dim: number;
  bottom: number;
  show: (dim?: number, bottom?: number) => void;
  hide: () => void;
  reset: () => void;
};

export const useSheetScrimStore = create<State>((set) => ({
  count: 0,
  dim: 0.72,
  bottom: 0,
  show: (dim = 0.72, bottom = 0) =>
    set((s) => ({ count: s.count + 1, dim: Math.max(s.dim, dim), bottom })),
  hide: () => set((s) => ({ count: Math.max(0, s.count - 1) })),
  reset: () => set({ count: 0, dim: 0.72, bottom: 0 }),
}));

export default useSheetScrimStore;
