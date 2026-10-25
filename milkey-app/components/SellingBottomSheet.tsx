import React, { memo, useEffect } from 'react';
import { ClipboardEdit, IndianRupee, BarChart3, Users } from 'lucide-react-native';
import { SellingTab, useSubTabStore } from '@/lib/subTabStore';
import AppBottomSheet, { SheetItem } from '@/components/ui/AppBottomSheet';
type Props = { visible: boolean; onClose: () => void; activeTab: SellingTab; onSelectTab: (tab: SellingTab) => void; bottomOffset?: number; topOffset?: number; blurTarget?: React.RefObject<any> };
const ITEMS: SheetItem<SellingTab>[] = [
  { key: 'Entry', label: 'Entry', IconComp: ClipboardEdit, iconBg: '#DDF3E3', iconColor: '#2E7D32', tint: '#F1FAF4' },
  { key: 'Payment', label: 'Payment', IconComp: IndianRupee, iconBg: '#FFEFC9', iconColor: '#EF8A12', tint: '#FFFCF0' },
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
