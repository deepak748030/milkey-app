import React, { memo } from 'react';
import { ClipboardEdit, IndianRupee, BarChart3, Users } from 'lucide-react-native';
import { SellingTab } from '@/lib/subTabStore';
import AppBottomSheet, { SheetItem } from '@/components/ui/AppBottomSheet';
type Props = { visible: boolean; onClose: () => void; activeTab: SellingTab; onSelectTab: (tab: SellingTab) => void; bottomOffset?: number; topOffset?: number; blurTarget?: React.RefObject<any> };
const ITEMS: SheetItem<SellingTab>[] = [
  { key: 'Entry', label: 'Entry', IconComp: ClipboardEdit, iconBg: '#E8F5E9', iconColor: '#2E7D32', tint: '#F2FBF5' },
  { key: 'Payment', label: 'Payment', IconComp: IndianRupee, iconBg: '#FFF3E0', iconColor: '#EF6C00', tint: '#FFF9EF' },
  { key: 'Reports', label: 'Reports', IconComp: BarChart3, iconBg: '#E3F2FD', iconColor: '#1565C0', tint: '#F2F7FE' },
  { key: 'Customer', label: 'Customer', IconComp: Users, iconBg: '#F3E5F5', iconColor: '#7B1FA2', tint: '#FAF4FD' },
];
export default memo(function SellingBottomSheet({ visible, onClose, activeTab, onSelectTab, bottomOffset, topOffset, blurTarget }: Props){
  return <AppBottomSheet visible={visible} onClose={onClose} title="Selling" subtitle="Choose an option"
    items={ITEMS} activeKey={activeTab} onSelect={onSelectTab} bottomOffset={bottomOffset} topOffset={topOffset} blurTarget={blurTarget} />;
});
