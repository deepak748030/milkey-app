import React, { memo } from 'react';
import { User, Milk, FileText, IndianRupee, Calendar } from 'lucide-react-native';
import { useSubTabStore, PurchaseTab } from '@/lib/subTabStore';
import AppBottomSheet, { SheetItem } from '@/components/ui/AppBottomSheet';
type Props = { visible: boolean; onClose: () => void; activeTab: PurchaseTab; onSelectTab: (tab: PurchaseTab) => void; bottomOffset?: number; topOffset?: number };
const ITEMS: SheetItem<PurchaseTab>[] = [
  { key: 'RateSetting' as PurchaseTab, label: 'Rate Setting', IconComp: FileText, iconBg: '#FFF3E0', iconColor: '#EF6C00' },
  { key: 'Farmer' as PurchaseTab, label: 'Farmer', IconComp: User, iconBg: '#E8F5E9', iconColor: '#2E7D32' },
  { key: 'Purchase' as PurchaseTab, label: 'Purchase', IconComp: Milk, iconBg: '#E3F2FD', iconColor: '#1565C0' },
  { key: 'Report' as PurchaseTab, label: 'Generate Report', IconComp: FileText, iconBg: '#E8F5E9', iconColor: '#2E7D32' },
  { key: 'Payment' as PurchaseTab, label: 'Payment', IconComp: IndianRupee, iconBg: '#FFF3E0', iconColor: '#EF6C00' },
  { key: 'Advances' as PurchaseTab, label: 'Advance', IconComp: Calendar, iconBg: '#FFEBEE', iconColor: '#C62828' },
];
const PREF: PurchaseTab[] = ['RateSetting','Farmer','Purchase','Report','Payment','Advances'];
function getDisplay(): SheetItem<PurchaseTab>[] {
  return PREF.map(k => ITEMS.find(i => i.key === k)! ).filter(Boolean);
}
export default memo(function CollectionBottomSheet({ visible, onClose, activeTab, onSelectTab, bottomOffset, topOffset }: Props){
  return <AppBottomSheet visible={visible} onClose={onClose} title="Collection" items={getDisplay()} activeKey={activeTab} onSelect={onSelectTab} bottomOffset={bottomOffset} topOffset={topOffset}
    isActive={(a, it) => a===it.key } />;
});
