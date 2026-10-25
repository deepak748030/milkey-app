import { create } from 'zustand';
export type PurchaseTab = 'Purchase' | 'Report' | 'Farmer' | 'Payment' | 'Advances' | 'RateSetting';
export type CollectionTab = PurchaseTab;
export type SellingTab = 'Entry' | 'Payment' | 'Reports' | 'Customer';
export type RegisterTab = 'Payments' | 'Advances' | 'Farmer';
// Legacy aliases for stored values migration
type LegacyPurchaseTab = PurchaseTab | 'C-Farmer' | 'RateChart';
type LegacyRegisterTab = RegisterTab | 'R-Farmer';
type LegacySellingTab = SellingTab | 'Member';
function normalizePurchaseTab(tab: LegacyPurchaseTab): PurchaseTab {
  if (tab === 'C-Farmer') return 'Farmer';
  if (tab === 'RateChart') return 'RateSetting';
  return tab as PurchaseTab;
}
function normalizeRegisterTab(tab: LegacyRegisterTab): RegisterTab {
  if (tab === 'R-Farmer') return 'Farmer';
  return tab as RegisterTab;
}
function normalizeSellingTab(tab: LegacySellingTab): SellingTab {
  if ((tab as string) === 'Member') return 'Customer';
  return tab as SellingTab;
}
interface SubTabState {
    purchaseTab: PurchaseTab;
    sellingTab: SellingTab;
    registerTab: RegisterTab;
    setPurchaseTab: (tab: PurchaseTab | LegacyPurchaseTab) => void;
    setSellingTab: (tab: SellingTab | LegacySellingTab) => void;
    setRegisterTab: (tab: RegisterTab | LegacyRegisterTab) => void;
    collectionTab: CollectionTab;
    setCollectionTab: (tab: CollectionTab | LegacyPurchaseTab) => void;
    suppressCollectionSheet: boolean;
    suppressSellingSheet: boolean;
    setSuppressCollectionSheet: (v: boolean) => void;
    setSuppressSellingSheet: (v: boolean) => void;
    /** Live visibility of the two floating sheets (Collection / Selling). The tab
     *  layout writes it, the screens read it to paint their own dark layer. */
    collectionSheetOpen: boolean;
    sellingSheetOpen: boolean;
    setCollectionSheetOpen: (v: boolean) => void;
    setSellingSheetOpen: (v: boolean) => void;
}
export const useSubTabStore = create<SubTabState>((set) => ({
    purchaseTab: 'Purchase',
    sellingTab: 'Entry',
    registerTab: 'Farmer',
    setPurchaseTab: (tab) => { const n = normalizePurchaseTab(tab as any); set({ purchaseTab: n, collectionTab: n }); },
    setSellingTab: (tab) => set({ sellingTab: normalizeSellingTab(tab as any) }),
    setRegisterTab: (tab) => set({ registerTab: normalizeRegisterTab(tab as any) }),
    collectionTab: 'Purchase',
    setCollectionTab: (tab) => { const n = normalizePurchaseTab(tab as any); set({ purchaseTab: n, collectionTab: n }); },
    suppressCollectionSheet: false,
    suppressSellingSheet: false,
    setSuppressCollectionSheet: (v) => set({ suppressCollectionSheet: v }),
    setSuppressSellingSheet: (v) => set({ suppressSellingSheet: v }),
    collectionSheetOpen: false,
    sellingSheetOpen: false,
    setCollectionSheetOpen: (v) => set({ collectionSheetOpen: v }),
    setSellingSheetOpen: (v) => set({ sellingSheetOpen: v }),
}));
