import React, { memo, useEffect } from 'react';
import { User, Milk, FileText, IndianRupee, Calendar } from 'lucide-react-native';
import { useSubTabStore, PurchaseTab } from '@/lib/subTabStore';
import AppBottomSheet, { SheetItem } from '@/components/ui/AppBottomSheet';
type Props = { visible: boolean; onClose: () => void; activeTab: PurchaseTab; onSelectTab: (tab: PurchaseTab) => void; bottomOffset?: number; topOffset?: number; blurTarget?: React.RefObject<any> };
const ITEMS: SheetItem<PurchaseTab>[] = [
  { key: 'RateSetting' as PurchaseTab, label: 'Rate Setting', IconComp: FileText, iconBg: '#FFE9C7', iconColor: '#EF8A12', tint: '#FFF8EA' },
  { key: 'Farmer' as PurchaseTab, label: 'Farmer', IconComp: User, iconBg: '#DDF3E3', iconColor: '#2E7D32', tint: '#F1FAF4' },
  { key: 'Purchase' as PurchaseTab, label: 'Purchase', IconComp: Milk, iconBg: '#D9ECFB', iconColor: '#1565C0', tint: '#E9F8EE' },
  { key: 'Report' as PurchaseTab, label: 'Generate Report', IconComp: FileText, iconBg: '#E2F6E7', iconColor: '#2E7D32', tint: '#EFFAF3' },
  { key: 'Payment' as PurchaseTab, label: 'Payment', IconComp: IndianRupee, iconBg: '#FFEFC9', iconColor: '#EF8A12', tint: '#FFFCF0' },
  { key: 'Advances' as PurchaseTab, label: 'Advance', IconComp: Calendar, iconBg: '#FBDCE1', iconColor: '#D32F2F', tint: '#FDF1F3' },
];
const PREF: PurchaseTab[] = ['RateSetting','Farmer','Purchase','Report','Payment','Advances'];
function getDisplay(): SheetItem<PurchaseTab>[] {
  return PREF.map(k => ITEMS.find(i => i.key === k)! ).filter(Boolean);
}
export default memo(function CollectionBottomSheet({ visible, onClose, activeTab, onSelectTab, bottomOffset, topOffset, blurTarget }: Props){
  // Second writer of the flag the purchase screen reads for its dark backdrop.
  const setOpen = useSubTabStore((st) => st.setCollectionSheetOpen);
  useEffect(() => { setOpen(!!visible); }, [visible, setOpen]);
  return <AppBottomSheet visible={visible} onClose={onClose} title="Collection"
    items={getDisplay()} activeKey={activeTab} onSelect={onSelectTab} bottomOffset={bottomOffset} topOffset={topOffset} blurTarget={blurTarget}
    isActive={(a, it) => a===it.key } />;
});
