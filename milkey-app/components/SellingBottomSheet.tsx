import React, { memo } from 'react';
import { ClipboardEdit, IndianRupee, BarChart3, Users } from 'lucide-react-native';
import { SellingTab } from '@/lib/subTabStore';
import AppBottomSheet, { SheetItem } from '@/components/ui/AppBottomSheet';
type Props = { visible: boolean; onClose: () => void; activeTab: SellingTab; onSelectTab: (tab: SellingTab) => void; bottomOffset?: number; topOffset?: number };
const ITEMS: SheetItem<SellingTab>[] = [
  { key: 'Entry', label: 'Entry', IconComp: ClipboardEdit, iconBg: '#E8F5E9', iconColor: '#2E7D32' },
  { key: 'Payment', label: 'Payment', IconComp: IndianRupee, iconBg: '#FFF3E0', iconColor: '#EF6C00' },
  { key: 'Reports', label: 'Reports', IconComp: BarChart3, iconBg: '#E3F2FD', iconColor: '#1565C0' },
  { key: 'Customer', label: 'Customer', IconComp: Users, iconBg: '#F3E5F5', iconColor: '#7B1FA2' },
];
export default memo(function SellingBottomSheet({ visible, onClose, activeTab, onSelectTab, bottomOffset, topOffset }: Props){
  return <AppBottomSheet visible={visible} onClose={onClose} title="Selling" items={ITEMS} activeKey={activeTab} onSelect={onSelectTab} bottomOffset={bottomOffset} topOffset={topOffset} />;
});
