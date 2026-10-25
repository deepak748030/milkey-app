import { create } from 'zustand';

/**
 * Real, measured layout metrics of the app chrome.
 *
 * The floating sheet needs two pixel-exact anchors:
 *   • `headerHeight` — where the green TopBar ends, so its dark backdrop starts exactly
 *     there (a computed guess left a ~4dp bright strip under the header),
 *   • (the tab bar height is an explicit style value — `65 + insets.bottom` — so it needs
 *     no measurement.)
 *
 * Both are reported with onLayout (real values, no inset guessing) and fall back to the
 * old computed values until the first measurement arrives.
 */
type LayoutState = {
  headerHeight: number;
  setHeaderHeight: (h: number) => void;
};

export const useLayoutStore = create<LayoutState>((set) => ({
  headerHeight: 0,
  setHeaderHeight: (h) => set((s) => (Math.abs(s.headerHeight - h) < 0.5 ? s : { headerHeight: h })),
}));

export default useLayoutStore;
