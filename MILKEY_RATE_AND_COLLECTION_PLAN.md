# Milkey App — Rate Setting + Collection Purchase — FINAL Plan (Strict Scope)
### Date: 2026-10-30 | Branch: arena/f5b2bcae-milkey-app
> **Aapka naya instruction:** Sirf 2 jagah change karna hai — **1) Rate Setting inside Collection** aur **2) Purchase inside Collection**. **Rate Chart screen me kuch bhi add/hataana nahi hai.** Apni taraf se koi extra feature nahi.
> Ye plan usi constraint ko lock karke banaya hai.

---

## 0) TL;DR — Kya Banega / Kya Nahi

| Banega ✅ | Nahi Banega ❌ |
|-----------|---------------|
| **Rate Setting (milk-rate-settings.tsx)** me **Advance Rate (Min/Max)** section — jaise 55 rate set karte ho waise hi | Rate Chart screen (RateSettingModal / RateChartModal) me **koi** change nahi — same as before |
| **Purchase entry (PurchaseCollectionTab.tsx + purchase.tsx + AddCustomerSheet.tsx)** me 3-method logic + Qty→Quality→Rate→Amount flow | User Panel, Notifications, Phone OTP, Inventory, Selling — kuch nahi |
| Backend me sirf **MilkRateSettings.advanceRate** field + **PurchaseFarmer.linkedRateChartId** (optional) | Naya screen, naya route, naya model nahi |

**One line:** Rate Setting me Advance Min/Max ayega, Purchase me 3 tarike se rate niklega — bas.

---

## 1) Floorplan — Strict Scope (Top View)

```
                    ┌─────────────────────┐
                    │   SETTINGS / RATE   │
                    │     SETTING HUB     │  ← milk-rate-settings.tsx (EDIT)
                    │  ┌───────────────┐  │
                    │  │ Fix Rate      │  │  existing
                    │  │ Fat Rate      │  │  existing
                    │  │ FatSNF 65/90  │  │  existing
                    │  │ Bonus         │  │  existing
                    │  │ ★ Advance Min │  │  NEW — sirf yahi add
                    │  │   Advance Max │  │
                    │  └───────────────┘  │
                    └─────────┬───────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │  ADD CUSTOMER SHEET │  ← AddCustomerSheet.tsx (EDIT)
                    │ Rate Based On:      │
                    │ ● Fixed Rate        │
                    │ ○ Qty/Quality      │  renamed label only
                    │ ○ Rate Chart       │  + existing chart dropdown
                    └─────────┬───────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │  PURCHASE ENTRY     │  ← PurchaseCollectionTab.tsx (EDIT)
                    │  1. Quantity (L)    │  pehle
                    │  2. Quality (F/S)   │  baad me
                    │  3. Rate (auto)     │  FAT×rate / chart / fixed
                    │  4. Amount= Q×R    │  Qty khali → 0
                    │  + 3-chip chooser   │  agar Fixed define nahi
                    └─────────────────────┘

  ┌───────────────────────────────────┐
  │  RATE CHART SCREEN (Modal)        │  ← NO TOUCH — bilkul waise hi
  │  RateSettingModal.tsx             │     jaise hai, koi add/remove nahi
  └───────────────────────────────────┘
```

---

## 2) Dimensional Drawing — Kya Change, Kaha, Kitna

### 2.1 ✅ Rate Setting (milk-rate-settings.tsx)
- **Add 1 new CollapsibleCard:** `Advance Rate`
  - Inside: 2 inputs side-by-side: `Advance Min (₹)` + `Advance Max (₹)`
  - Helper: “Min se kam / Max se zyada entry block hogi”
  - Banner: kitne members pe asar (optional, same as other cards)
  - Save: existing debounced `milkRateSettingsApi.update()` me 1 field aur
- **Backend:** `MilkRateSettings.advanceRate: {min, max}` — default 0,0 = no-limit
- **No touch:** FatSNF, Fix Rate, Fat Rate, Bonus cards — waise hi

### 2.2 ✅ Purchase — Customer Config (AddCustomerSheet.tsx)
- **Rename label:** `PRICE_BASIS_OPTIONS` → `Fixed Rate`, `Rate by Quantity/Quality`, `Rate Chart`
  - Value same: `rate`, `fat`, `fat_snf` (code change nahi, sirf label)
- **Add dropdown (only when `Rate Chart` selected):** `Select Existing Rate Chart ▼` — data from `GET /rate-charts`
  - Naya chart banana nahi — sirf select
  - Save: `linkedRateChartId` field (optional)
- **No touch:** Code, Name, Mobile, Address, Default Milk, Alert Method — waise hi

### 2.3 ✅ Purchase Entry (PurchaseCollectionTab.tsx + purchase.tsx)
- **Field order change (same components, reorder only):**
  1. **Quantity** — top, big, placeholder `0.0`
  2. **Quality** — Fat / SNF (visibility by method)
     - Fixed Rate → Quality hidden (Fixed ko quality nahi chahiye)
     - Qty/Quality → Fat only
     - Rate Chart → Fat + SNF
  3. **Rate** — auto-calculate, editable override allowed
     - Fixed → `fixedRate.buffalo/cow` (global → farmer)
     - Qty/Quality → `fat × fatRate`
     - Rate Chart → `fat×FatRate + snf×SnfRate` (FatRate=Rate×0.08, SnfRate=Rate×0.05333, using RateSettingModal’s todayRate)
  4. **Amount** — `Qty × Rate` live, `Qty=0 → Amount=₹0.00` grey, Save disable if Qty=0 & not ZeroEntry

- **Waterfall (if Fixed defined → no chooser):**
  ```
  globalFixed = milkRateSettings.fixedRate[buffalo/cow]
  if (globalFixed > 0 && farmer.priceBasis==='rate') → use Fixed directly
  else if (!globalFixed && !farmerPriceBasis) → show 3-chip chooser inline (Fixed | Qty/Quality | Rate Chart) → selection saves to farmer
  ```

- **Zero-safe:**
  ```ts
  computeAmount = () => isZero ? 0 : (parseFloat(qty)||0) * (parseFloat(rate)||0)
  // Qty empty → 0, helper: "Quantity bharo"
  ```

- **purchase.tsx logic:** Fetch global `milkRateSettings` once, pass to tab; todayRate already fetched (quick-settings) — reuse.

### 2.4 ❌ Rate Chart Screen — NO CHANGE
- `RateSettingModal.tsx`, `RateChartModal.tsx`, `lib/rateSetting.ts` — **bilkul nahi chedna**
- Na naya chip, na dropdown, na styling

---

## 3) File List — Strict (Beyond Iske Bahar Koi File Nahi)

| File | Edit Type | Kya Karenge |
|------|-----------|-------------|
| `milkey-app/app/milk-rate-settings.tsx` | Edit | + Advance Rate card (Min/Max), state + save |
| `milkey-app/lib/milkeyApi.ts` | Edit | `MilkRateSettingsDoc` me `advanceRate` type add |
| `server-clone/models/MilkRateSettings.js` + `server/models/MilkRateSettings.js` (copy) | Edit/Create | `advanceRate: {min,max}` schema |
| `server-clone/routes/milk-rate-settings.js` + `server/routes/milk-rate-settings.js` | Edit/Create | clamp + save advanceRate |
| `milkey-app/components/purchase/AddCustomerSheet.tsx` | Edit | Label rename + existing chart dropdown (if fat_snf) |
| `milkey-app/components/purchase/tabs/PurchaseCollectionTab.tsx` | Edit | Reorder Qty→Quality→Rate→Amt + chooser + zero-safe |
| `milkey-app/app/(tabs)/purchase.tsx` | Edit | Fetch milkRateSettings, pass fixedRate, todayRate wiring, waterfall |

**7 files max. Koi naya page, naya route, naya modal nahi.**

---

## 4) Feature Mapping — Aapne Jo Bola, Wahi (Word-to-Word)

| Aapki Line | Kaha Banega |
|------------|-------------|
| “Rate Setting ko Collection jaisa banana hai” | Rate Setting screen ke cards abhi Collection jaisa green-table UI hai — Advance card bhi same style |
| “3 tareeke: Fixed, Qty/Quality, Rate Chart” | AddCustomerSheet 3 chips + Purchase inline chooser |
| “Fixed define hai → Fixed se entry” | purchase.tsx waterfall: fixedRate>0 → fixed |
| “Fixed nahi → teeno options auto available, user select kare” | chooser chips dikhenge, tap → farmer.priceBasis update |
| “Rate Chart naya nahi, existing select” | AddCustomerSheet dropdown = GET /rate-charts list |
| “Purchase me Quantity pehle, Quality baad, rate auto, Q×R=Amt, Qty khali→0” | PurchaseCollectionTab reorder + computeAmount zero-safe |
| “Rate Chart Settings me jaise 55, waise Advance Rate Min/Max” | milk-rate-settings Advance card |
| “Purchase page Rate Chart window achhi hai — ek baar select → har baar manual nahi” | Rate Chart dropdown ki selection `linkedRateChartId` me save, next time auto |
| “Rate Chart screen me kuch add/hataana nahi” | RateSettingModal untouched — guarantee |
| “Only Rate Setting inside collection + Purchase inside collection” | Upar ke 7 files ke bahar zero change |

---

## 5) After Change — Example (Suresh)

**Setup:** Fixed Rate Buffalo=55 define hai → Fixed method  
1. Purchase → S-05 search → Quantity `10` → Rate auto `55` (buffalo fixed) → Amount `550` → Save

**Setup:** Fixed nahi define, farmer ka basis `Qty/Quality`, fatRate=7.5  
1. Quantity `12` → Quality Fat `4.0` → Rate auto `30.00` (4×7.5) → Amount `360`

**Setup:** Rate Chart, todayRate=60, Fat 6 SNF 9  
1. Quantity `12.5` → Fat `6` SNF `9` → Rate `57.6` → Amount `720`

**Qty khali:** Quantity `''` → Amount `₹0.00` grey → Save disable

---

## 6) Security / Data
- Advance Min/Max validation: `min>=0, max>=min, max=0 means no-limit`
- Existing farmers: no migration needed — defaults 0
- Amount pre-save hook `qty×rate` — qty=0 allowed (model min 0)

---

## 7) Testing (Only These)
- Fixed define → Fixed auto, no chooser
- Fixed not define → chooser visible → selection saves
- Qty→Quality→Rate→Amt live
- Qty empty → Amount 0 → Save block
- Rate Chart dropdown → existing chart select → remember

---

*Lock: No extra feature, no Rate Chart screen edit — strictly Purchase + Rate Setting only.*
