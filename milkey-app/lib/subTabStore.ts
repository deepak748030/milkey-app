import { create } from 'zustand';

export type PurchaseTab = 'Purchase' | 'Report' | 'Farmer';
export type SellingTab = 'Entry' | 'Payment' | 'Reports' | 'Member';
export type RegisterTab = 'Payments' | 'Advances' | 'Farmers';

interface SubTabState {
    purchaseTab: PurchaseTab;
    sellingTab: SellingTab;
    registerTab: RegisterTab;
    setPurchaseTab: (tab: PurchaseTab) => void;
    setSellingTab: (tab: SellingTab) => void;
    setRegisterTab: (tab: RegisterTab) => void;
}

export const useSubTabStore = create<SubTabState>((set) => ({
    purchaseTab: 'Purchase',
    sellingTab: 'Entry',
    registerTab: 'Farmers',
    setPurchaseTab: (tab) => set({ purchaseTab: tab }),
    setSellingTab: (tab) => set({ sellingTab: tab }),
    setRegisterTab: (tab) => set({ registerTab: tab }),
}));
