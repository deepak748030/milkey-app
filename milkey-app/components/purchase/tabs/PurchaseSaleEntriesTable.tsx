import React from 'react';
import { View, Text, Pressable, TextInput, ActivityIndicator } from 'react-native';
import { Search, X, Printer, FileText, Droplets, MoreVertical } from 'lucide-react-native';

// Ponytail reusable — single source, no duplication, no UI change
export function PurchaseSaleEntriesTable(props:any){
  const { s, colors, t, collections, historyLoading, saleEntrySearch, setSaleEntrySearch, selectedCustomer, isDark, isPrinting, handlePrintPress, setActionMenuEntry } = (props as any).ctx || props;
  const sorted = [...collections].sort((a: any, b: any) => {
    const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (at !== bt) return bt - at;
    return String(b._id).localeCompare(String(a._id));
  });
  const selectedCode = selectedCustomer?.code.toUpperCase();
  const q = selectedCode || saleEntrySearch.trim().toUpperCase();
  const visible = selectedCode
    ? sorted.filter(it => String(it.farmerCode || it.purchaseFarmer?.code || '').toUpperCase() === selectedCode)
    : q
      ? sorted.filter(it => String(it.farmerCode || it.purchaseFarmer?.code || '').toUpperCase().includes(q))
      : sorted;
  return (
            <View style={s.tableBottomWrap}>
                <View style={s.tableWrap}>
                    <View style={s.tableBar}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                            <FileText size={13} color={colors.primary} />
                            <Text style={s.tableBarTitle}>{t.purchase.saleEntries}</Text>
                            <View style={s.badge}><Text style={s.badgeText}>{visible.length}</Text></View>
                        </View>

                        {/* Code search bar */}
                        <View style={s.entrySearchBox}>
                            <Search size={12} color={colors.mutedForeground} />
                            <TextInput
                                style={s.entrySearchInput}
                                value={saleEntrySearch}
                                onChangeText={(v) => setSaleEntrySearch(v.replace(/\s/g, '').toUpperCase())}
                                placeholder="Search code"
                                placeholderTextColor={colors.mutedForeground}
                                autoCapitalize="characters"
                                returnKeyType="search"
                            />
                            {saleEntrySearch.length > 0 && (
                                <Pressable onPress={() => setSaleEntrySearch('')} hitSlop={8}>
                                    <X size={12} color={colors.mutedForeground} />
                                </Pressable>
                            )}
                        </View>

                        <Pressable style={[s.pdfBtn, isPrinting && { opacity: 0.5 }]} onPress={() => handlePrintPress('purchase')} disabled={isPrinting}>
                            {isPrinting ? <ActivityIndicator size={12} color="#fff" /> : <Printer size={12} color="#fff" />}
                        </Pressable>
                    </View>

                    <View style={s.tHead}>
                        <View style={s.entryCell1}><Text style={[s.tHeadText, { textAlign: 'center' }]}>{t.common.code}</Text></View>
                        <View style={s.entryCellFlex}><Text style={[s.tHeadText, { textAlign: 'center' }]}>{t.purchase.milk}</Text></View>
                        <View style={s.entryCellFlex}><Text style={[s.tHeadText, { textAlign: 'center' }]}>{t.purchase.fat}</Text></View>
                        <View style={s.entryCellFlex}><Text style={[s.tHeadText, { textAlign: 'center' }]}>SNF</Text></View>
                        <View style={s.entryCellFlex}><Text style={[s.tHeadText, { textAlign: 'center' }]}>{t.common.rate}</Text></View>
                        <View style={s.entryCellAmt}><Text style={[s.tHeadText, { textAlign: 'center' }]}>{t.purchase.amt}</Text></View>
                        <View style={{ width: 26 }} />
                    </View>

                    {historyLoading && collections.length === 0 ? (
                        <View style={s.emptyBox}><ActivityIndicator color={colors.primary} /></View>
                    ) : visible.length === 0 ? (
                        <View style={s.emptyBox}>
                            <Droplets size={24} color={colors.border} />
                            <Text style={s.emptyText}>
                                {q ? `No entries for code "${q}"` : t.purchase.noEntries}
                            </Text>
                        </View>
                    ) : (
                        <View>
                            {visible.map((item, index) => (
                                <View key={item._id} style={[s.entryRow, index % 2 !== 0 && { backgroundColor: isDark ? colors.muted + '30' : '#f8fafc' }]}>
                                    <View style={s.entryCell1}>
                                        <Text style={[s.entryCellText, { color: colors.primary, fontWeight: '700', textAlign: 'center' }]}>{item.farmerCode || '-'}</Text>
                                        <Text style={[s.entrySubText, { textAlign: 'center' }]} numberOfLines={1}>{item.purchaseFarmer?.name || ''}</Text>
                                    </View>
                                    <View style={s.entryCellFlex}><Text style={[s.entryCellText, { textAlign: 'center' }]}>{item.quantity}</Text></View>
                                    <View style={s.entryCellFlex}><Text style={[s.entryCellText, { textAlign: 'center' }]}>{item.fat || '-'}</Text></View>
                                    <View style={s.entryCellFlex}><Text style={[s.entryCellText, { textAlign: 'center' }]}>{(item as any).snf || '-'}</Text></View>
                                    <View style={s.entryCellFlex}><Text style={[s.entryCellText, { textAlign: 'center' }]}>{item.rate}</Text></View>
                                    <View style={s.entryCellAmt}><Text style={[s.entryCellText, { textAlign: 'center', color: colors.primary, fontWeight: '700' }]}>₹{item.amount.toFixed(0)}</Text></View>
                                    <Pressable
                                        style={s.deleteBtn}
                                        onPress={() => setActionMenuEntry(item)}
                                    >
                                        <MoreVertical size={14} color={colors.mutedForeground} />
                                    </Pressable>
                                </View>
                            ))}
                        </View>
                    )}
                </View>
            </View>
        );

}
