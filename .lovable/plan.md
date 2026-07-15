## Goal

Add a **Rate Chart** feature inside the mobile Collection screen (milkey-app) so the user can:

1. Enter a base **Rate** (e.g. 55, 60, 65).
2. Automatically see a full FAT × SNF chart that regenerates when the rate changes.
3. View the same rate the app will use for a given FAT/SNF combo — matching the values shown in the physical chart image.

Only the mobile app (`milkey-app/`) is updated for the viewing UI. Backend and web admin are **not** touched (existing `RateChart` model stays as-is for admin use).

---

## Formula (locked)

```
FatRate = Rate × 0.08
SnfRate = Rate × 0.053333333
Cell(FAT, SNF) = (FAT × FatRate) + (SNF × SnfRate)
```

Ratio/standard stays constant — only the Rate input changes, and both FatRate & SnfRate + the full grid re-derive from it.

Example (Rate = 60): FatRate 4.80, SnfRate 3.20, Cell(1.0, 1.0) = 8.00, Cell(2.0, 2.0) = 16.00. Matches the reference table exactly.

---

## UX

Inside `milkey-app/app/(tabs)/purchase.tsx` (the Collection tab), add a new **"Rate Chart"** entry point (button/icon in the header area, next to existing tools).

Tapping it opens a full-screen modal (`RateChartModal`) with:

- **Rate input** at the top (numeric, default = last used rate, persisted in AsyncStorage).
- Two read-only chips showing derived **Fat Rate** and **SNF Rate** (2 decimals).
- FAT range and SNF range controls (min, max, step) with sensible defaults:
  - FAT: 1.0 → 15.0, step 0.1
  - SNF: 1.0 → 15.0, step 0.1
  - Presets: "Small (1–2)", "Standard (3–9)", "Full (1–15)".
- Scrollable 2D grid:
  - Sticky top row = SNF values.
  - Sticky left column = FAT values.
  - Cells = computed rate, 2 decimals.
  - Highlight the current cell if the collection screen has a live FAT/SNF entered.
- Footer actions: **Reset**, **Close**. (No save needed — chart is derived, not stored.)

Fully responsive; horizontal + vertical scroll for large ranges. Dark/light theme aware using existing `colors.ts` tokens.

---

## Technical plan

### New files

1. **`milkey-app/lib/rateChart.ts`** — pure helpers:
   - `deriveRates(rate: number) => { fatRate, snfRate }`
   - `computeCell(fat, snf, fatRate, snfRate) => number`
   - `buildChart({ rate, fatMin, fatMax, snfMin, snfMax, step })` → `{ fatValues, snfValues, rows }`

2. **`milkey-app/components/RateChartModal.tsx`** — full-screen modal with:
   - Rate `TextInput` (keyboardType `decimal-pad`), debounced.
   - Range preset chips + editable min/max/step inputs (collapsible "Advanced").
   - Nested `ScrollView` (horizontal wrapping a vertical `ScrollView`) for the grid, with sticky header row and sticky first column implemented via absolute positioning of two overlay layers (standard RN pattern).
   - Persist last-used rate + ranges under key `milkey.rateChart.settings` via AsyncStorage.

### Edits

3. **`milkey-app/app/(tabs)/purchase.tsx`**:
   - Import `RateChartModal`.
   - Add a small "Rate Chart" button in the Collection sub-tab header (icon + label, styled to match existing tools).
   - Local state `const [chartOpen, setChartOpen] = useState(false)`.
   - When the user has entered a FAT and SNF in the current collection entry, pass them as `highlightFat` / `highlightSnf` to the modal so that cell is highlighted.
   - Do **not** change any existing rate-calculation logic used to actually save collection entries — this modal is view-only reference.

### No backend / no admin changes

- Server `RateChart` model and `/rate-charts` routes remain untouched.
- Web admin (`src/pages/*`) is not modified.
- No new API calls; chart is 100% client-computed.

---

## Edge cases handled

- Rate = 0 or empty → show zeros, no crash.
- Non-numeric input → ignored, keeps last valid value.
- Very large ranges (e.g. 1–15 step 0.1 = 141×141) → virtualized rendering via `FlatList` for rows to keep scroll smooth.
- Floating-point drift → all displayed values rounded to 2 decimals with `toFixed(2)`; underlying calc keeps precision.
- Highlighted cell only applied when both FAT and SNF are valid and within displayed range.

---

## Out of scope (explicitly)

- Changing the actual rate stored on collection entries.
- Any change to server-side rate logic, admin rate chart page, or `RateChart` schema.
- Multi-language translations beyond adding the labels "Rate Chart", "Fat Rate", "SNF Rate", "Reset" to `en.ts`/`hi.ts`/`mr.ts` (short additive entries only).

---

## Acceptance criteria

- Opening the modal with Rate = 60 shows Cell(1.0, 1.0) = **8.00** and Cell(2.0, 2.0) = **16.00** (matches the reference table in the request).
- Changing Rate to 55 immediately updates the whole grid (Cell(1.0,1.0) ≈ **7.33**).
- Fat Rate and SNF Rate chips reflect `Rate × 0.08` and `Rate × 0.053333` respectively.
- Grid scrolls smoothly with sticky FAT column and sticky SNF row.
- Last-used Rate persists across app restarts.
- No changes to existing collection save/print behavior.
