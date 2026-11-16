import React, { memo, useEffect } from 'react';
import { ClipboardEdit, IndianRupee, BarChart3, Users, Wallet } from 'lucide-react-native';
import { SellingTab, useSubTabStore } from '@/lib/subTabStore';
import AppBottomSheet, { SheetItem } from '@/components/ui/AppBottomSheet';
type SellingSheetKey = SellingTab | 'Advance';
type Props = { visible: boolean; onClose: () => void; activeTab: SellingTab; onSelectTab: (tab: SellingSheetKey) => void; bottomOffset?: number; topOffset?: number; blurTarget?: React.RefObject<any> };
const ITEMS: SheetItem<SellingSheetKey>[] = [
  { key: 'Entry', label: 'Entry', IconComp: ClipboardEdit, iconBg: '#DDF3E3', iconColor: '#2E7D32', tint: '#F1FAF4' },
  { key: 'Payment', label: 'Payment', IconComp: IndianRupee, iconBg: '#FFEFC9', iconColor: '#EF8A12', tint: '#FFFCF0' },
  // Isolated selling advance ledger. This opens a separate screen and does not
  // become a SellingTab, so existing selling tabs/data stay untouched.
  { key: 'Advance', label: 'Advance', IconComp: Wallet, iconBg: '#FFE8D6', iconColor: '#C2410C', tint: '#FFF8F2' },
  { key: 'Reports', label: 'Reports', IconComp: BarChart3, iconBg: '#D9ECFB', iconColor: '#1565C0', tint: '#EFF7FE' },
  { key: 'Customer', label: 'Customer', IconComp: Users, iconBg: '#EEDCF8', iconColor: '#7B1FA2', tint: '#FAF2FE' },
];
export default memo(function SellingBottomSheet({ visible, onClose, activeTab, onSelectTab, bottomOffset, topOffset, blurTarget }: Props){
  // Second writer of the flag the selling screen reads for its dark backdrop.
  const setOpen = useSubTabStore((st) => st.setSellingSheetOpen);
  useEffect(() => { setOpen(!!visible); }, [visible, setOpen]);
  return <AppBottomSheet visible={visible} onClose={onClose} title="Selling"
    items={ITEMS} activeKey={activeTab} onSelect={onSelectTab} bottomOffset={bottomOffset} topOffset={topOffset} blurTarget={blurTarget} />;
});
