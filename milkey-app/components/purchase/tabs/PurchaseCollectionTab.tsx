import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { Pressable } from '@/components/ui/HapticPressable';
import { TextInput } from '@/components/ui/HapticTextInput';
import { Calendar as CalendarIcon, ChevronDown, Edit2, Search, X, Milk, Droplets, Sun, Moon, TableIcon, Ban, Printer, Check } from 'lucide-react-native';

// Ponytail reusable — single source, no duplication, no UI change
export function PurchaseCollectionTab(props:any){
  const ctx = (props as any).ctx || props;
  const { s, colors, t, entryDate, setShowDateModal, formatDate, entryShift, setEntryShift, isMorning, selectedCustomer, setSelectedCustomer: _setSelCust, setEditingCustomer, setShowAddCustomer, showInlineSearch, setShowInlineSearch, inlineSearchCode, setInlineSearchCode, inlineSearchResults, inlineSearchLoading, handleSelectCustomer, handleSaveEntry, milkType, setMilkType, milkQty, setMilkQty, fatValue, setFatValue, snfValue, setSnfValue, rateValue, setRateValue, computeAmount, computeBaseAmount, computeBonusAmount, bonusEnabled, bonusType, bonusApplied, setBonusApplied, isZero, setIsZero, noPrint, setNoPrint, saving, isPrinterConnected, historyTotals, todayRate, showCow, showBuffalo, isDark } = ctx;
  const setSelectedCustomer = _setSelCust ?? (() => {});
  const effectiveBasis: any = (selectedCustomer as any)?.priceBasis || 'rate';
  return (
        <View style={{ flex: 1 }}>
            {/* Top Controls: Date + Shift + Add */}
            <View style={s.topControls}>
                <Pressable style={s.dateBtn} onPress={() => setShowDateModal(true)}>
                    <CalendarIcon size={14} color={colors.primary} />
                    <Text style={s.dateText}>{formatDate(entryDate)}</Text>
                    <ChevronDown size={12} color={colors.mutedForeground} />
                </Pressable>
                <View style={s.shiftRow}>
                    <Pressable
                        onPress={() => setEntryShift('morning')}
                        style={[s.shiftBtn, isMorning && s.shiftBtnActive]}
                    >
                        <Sun size={13} color={isMorning ? '#fff' : colors.mutedForeground} />
                        <Text style={[s.shiftBtnText, isMorning && s.shiftBtnTextActive]}>{t.common.morning}</Text>
                    </Pressable>
                    <Pressable
                        onPress={() => setEntryShift('evening')}
                        style={[s.shiftBtn, !isMorning && s.shiftBtnActive]}
                    >
                        <Moon size={13} color={!isMorning ? '#fff' : colors.mutedForeground} />
                        <Text style={[s.shiftBtnText, !isMorning && s.shiftBtnTextActive]}>{t.common.evening}</Text>
                    </Pressable>
                </View>
                {selectedCustomer && (
                    <Pressable
                        style={s.addCustTopBtn}
                        onPress={() => { setEditingCustomer(selectedCustomer); setShowAddCustomer(true); }}
                    >
                        <Edit2 size={16} color="#fff" />
                    </Pressable>
                )}
            </View>

            {/* Summary Bar */}
            <View style={s.summaryBar}>
                <View style={s.summaryCell}>
                    <Droplets size={14} color={colors.primary} />
                    <View>
                        <Text style={s.summaryVal}>{historyTotals.quantity.toFixed(1)} L</Text>
                        <Text style={s.summaryLbl}>{t.common.quantity}</Text>
                    </View>
                </View>
                <View style={s.summaryDivider} />
                <View style={s.summaryCell}>
                    <Text style={{ fontSize: 14, color: colors.primary, fontWeight: '800' }}>₹</Text>
                    <View>
                        <Text style={s.summaryVal}>{historyTotals.quantity > 0 ? (historyTotals.amount / historyTotals.quantity).toFixed(1) : '0'}</Text>
                        <Text style={s.summaryLbl}>{t.purchase.avgRate}</Text>
                    </View>
                </View>
                <View style={s.summaryDivider} />
                <View style={s.summaryCell}>
                    <Text style={{ fontSize: 14, color: colors.primary, fontWeight: '800' }}>₹</Text>
                    <View>
                        <Text style={[s.summaryVal, { color: colors.primary }]}>{historyTotals.amount.toFixed(1)}</Text>
                        <Text style={s.summaryLbl}>{t.common.amount}</Text>
                    </View>
                </View>
                <View style={s.summaryDivider} />
                <View style={s.summaryCell}>
                    <TableIcon size={14} color={colors.primary} />
                    <View>
                        <Text style={[s.summaryVal, { color: colors.primary }]}>
                            ₹{Number(todayRate || 0).toFixed(2)}
                        </Text>
                        <Text style={s.summaryLbl}>Today Rate</Text>
                    </View>
                </View>
            </View>

            {/* Inline Farmer Search - replaces the old pressable box */}
            <View style={s.codeRow}>
                {showInlineSearch ? (
                    <View style={s.inlineSearchContainer}>
                        <Search size={16} color={colors.mutedForeground} />
                        <TextInput
                            style={s.inlineSearchInput}
                            value={inlineSearchCode}
                            onChangeText={setInlineSearchCode}
                            placeholder="Search by code..."
                            placeholderTextColor={colors.mutedForeground}
                            autoFocus
                            keyboardType="number-pad"
                        />
                        <Pressable
                            onPress={() => setInlineSearchCode('')}
                            hitSlop={8}
                            style={{ padding: 4 }}
                        >
                            <X size={18} color={colors.destructive} />
                        </Pressable>
                    </View>
                ) : selectedCustomer ? (
                    <View style={s.selectedFarmerBox}>
                        <Pressable onPress={() => setShowInlineSearch(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                            <View style={s.selectedFarmerBadge}>
                                <Text style={s.selectedFarmerBadgeText}>{selectedCustomer.code}</Text>
                            </View>
                            <Text style={s.selectedFarmerName} numberOfLines={1}>{selectedCustomer.name}</Text>
                        </Pressable>
                        <Pressable
                            onPress={() => {
                                setSelectedCustomer(null);
                                setShowInlineSearch(false);
                                setInlineSearchCode('');
                            }}
                            hitSlop={12}
                            style={{ padding: 4, marginLeft: 8 }}
                        >
                            <X size={16} color={colors.destructive} />
                        </Pressable>
                    </View>
                ) : (
                    <Pressable style={s.codeInputBox} onPress={() => setShowInlineSearch(true)}>
                        <Search size={14} color={colors.mutedForeground} />
                        <Text style={[s.codeInputText, { color: colors.mutedForeground }]}>{t.purchase.enterCode}</Text>
                    </Pressable>
                )}

                {selectedCustomer && showCow && (
                    <Pressable onPress={() => setMilkType('cow')} style={[s.milkToggleBtn, milkType === 'cow' && s.milkToggleBtnActive]}>
                        <Milk size={14} color={milkType === 'cow' ? '#fff' : colors.foreground} />
                        <Text style={[s.milkToggleBtnText, milkType === 'cow' && { color: '#fff' }]}>{t.purchase.cow}</Text>
                    </Pressable>
                )}
                {selectedCustomer && showBuffalo && (
                    <Pressable onPress={() => setMilkType('buffalo')} style={[s.milkToggleBtn, milkType === 'buffalo' && s.milkToggleBtnActive]}>
                        <Milk size={14} color={milkType === 'buffalo' ? '#fff' : colors.foreground} />
                        <Text style={[s.milkToggleBtnText, milkType === 'buffalo' && { color: '#fff' }]}>{t.purchase.buffalo}</Text>
                    </Pressable>
                )}
            </View>

            {/* Inline search results dropdown */}
            {showInlineSearch && inlineSearchCode.trim().length > 0 && (
                <View style={s.inlineDropdown}>
                    {inlineSearchLoading && inlineSearchResults.length === 0 ? (
                        <View style={[s.emptyBox, { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }]}>
                            <ActivityIndicator size="small" color={colors.primary} />
                            <Text style={s.emptyText}>Searching code {inlineSearchCode}…</Text>
                        </View>
                    ) : inlineSearchResults.length > 0 ? (
                        inlineSearchResults.map(item => (
                            <Pressable
                                key={item._id}
                                style={s.inlineDropdownItem}
                                onPress={() => handleSelectCustomer(item)}
                            >
                                <View style={s.inlineDropdownBadge}>
                                    <Text style={s.inlineDropdownBadgeText}>{item.code}</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={s.inlineDropdownName}>{item.name}</Text>
                                    {item.mobile ? <Text style={s.inlineDropdownSub}>{item.mobile}</Text> : null}
                                </View>
                            </Pressable>
                        ))
                    ) : (
                        <View style={s.emptyBox}>
                            <Text style={s.emptyText}>No farmer with code "{inlineSearchCode}"</Text>
                        </View>
                    )}
                </View>
            )}

            {/* Entry Fields — quantity → rate → amount, no helper text */}
            {selectedCustomer && (
                <View style={s.entryCard}>
                    <View style={s.fieldsRow}>
                        <View style={s.fieldBox}>
                            <Text style={[s.fieldLabel, { textAlign: 'left' }]}>Quantity (Litre)</Text>
                            <TextInput style={[s.fieldInput, { fontSize: 20 }]} value={milkQty} onChangeText={setMilkQty} keyboardType="decimal-pad" placeholder="0.0" placeholderTextColor={colors.mutedForeground} editable={!isZero} />
                        </View>
                        {effectiveBasis !== 'rate' && (
                            <View style={s.fieldBox}>
                                <Text style={s.fieldLabel}>Fat</Text>
                                <TextInput style={s.fieldInput} value={fatValue} onChangeText={setFatValue} keyboardType="decimal-pad" placeholder="0.0" placeholderTextColor={colors.mutedForeground} editable={!isZero} />
                            </View>
                        )}
                        {effectiveBasis === 'fat_snf' && (
                            <View style={s.fieldBox}>
                                <Text style={s.fieldLabel}>SNF</Text>
                                <TextInput style={s.fieldInput} value={snfValue} onChangeText={setSnfValue} keyboardType="decimal-pad" placeholder="0.0" placeholderTextColor={colors.mutedForeground} editable={!isZero} />
                            </View>
                        )}
                        <View style={s.fieldBox}>
                            <Text style={s.fieldLabel}>Rate</Text>
                            <TextInput style={[s.fieldInput, { backgroundColor: rateValue ? colors.card : colors.background }]} value={isZero ? '0' : rateValue} onChangeText={setRateValue} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={colors.mutedForeground} editable={!isZero} />
                        </View>
                    </View>

                    {/* Amount — Rate × Quantity (+ bonus when enabled) */}
                    <View style={[s.computedRow, { marginTop: 10, backgroundColor: colors.primary + '08', borderRadius: 10, paddingVertical: 8, borderWidth: 1, borderColor: colors.primary + '15' }]}>
                        <Text style={s.computedText}>Amount: <Text style={[s.computedValue, { color: computeAmount() === 0 ? colors.mutedForeground : colors.primary }]}>₹{computeAmount().toFixed(2)}</Text></Text>
                    </View>

                    {/* Bonus — shown only when Rate Setting > Bonus is ON */}
                    {!!bonusEnabled && (
                        <View style={{ marginTop: 8, gap: 6 }}>
                            <Pressable
                                onPress={() => setBonusApplied(!bonusApplied)}
                                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: bonusApplied ? colors.primary : colors.border, backgroundColor: bonusApplied ? colors.primary + '10' : colors.background }}
                            >
                                <Text style={{ fontSize: 12, fontWeight: '700', color: bonusApplied ? colors.primary : colors.mutedForeground }}>
                                    {bonusType === 'percent' ? 'Bonus (%)' : 'Bonus (₹/L)'}
                                </Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Text style={{ fontSize: 12, fontWeight: '700', color: bonusApplied ? colors.primary : colors.mutedForeground }}>
                                        {bonusApplied ? 'ON' : 'OFF'}
                                    </Text>
                                    <View style={{ width: 34, height: 18, borderRadius: 9, padding: 2, justifyContent: 'center', backgroundColor: bonusApplied ? colors.primary : colors.border }}>
                                        <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: '#fff', alignSelf: bonusApplied ? 'flex-end' : 'flex-start' }} />
                                    </View>
                                </View>
                            </Pressable>
                            {bonusApplied && (
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 }}>
                                    <Text style={{ fontSize: 11, color: colors.mutedForeground }}>Milk</Text>
                                    <Text style={{ fontSize: 11, fontWeight: '600', color: colors.foreground }}>₹{computeBaseAmount().toFixed(2)}</Text>
                                </View>
                            )}
                            {bonusApplied && (
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 }}>
                                    <Text style={{ fontSize: 11, color: colors.mutedForeground }}>Bonus</Text>
                                    <Text style={{ fontSize: 11, fontWeight: '600', color: colors.primary }}>+ ₹{computeBonusAmount().toFixed(2)}</Text>
                                </View>
                            )}
                        </View>
                    )}

                    {/* Actions */}
                    <View style={s.actionsRow}>
                        <Pressable style={[s.zeroToggle, isZero && { backgroundColor: colors.destructive, borderColor: colors.destructive }]} onPress={() => setIsZero(!isZero)}>
                            <Ban size={14} color={isZero ? '#fff' : colors.destructive} />
                            <Text style={[s.zeroText, isZero && { color: '#fff' }]}>{t.purchase.zeroEntry}</Text>
                        </Pressable>
                        {isPrinterConnected && (
                            <Pressable
                                style={[s.noPrintToggle, noPrint && { backgroundColor: colors.mutedForeground, borderColor: colors.mutedForeground }]}
                                onPress={() => setNoPrint(!noPrint)}
                            >
                                <Printer size={14} color={noPrint ? '#fff' : colors.mutedForeground} />
                                <Text style={[s.noPrintText, noPrint && { color: '#fff' }]}>No Print</Text>
                            </Pressable>
                        )}
                        <Pressable style={[s.saveEntryBtn, saving && { opacity: 0.5 }]} onPress={handleSaveEntry} disabled={saving}>
                            {saving ? <ActivityIndicator size="small" color="#fff" /> : (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Check size={18} color="#fff" strokeWidth={3} />
                                    <Text style={s.saveEntryText}>{t.common.save}</Text>
                                </View>
                            )}
                        </Pressable>
                    </View>
                </View>
            )}

        </View>
  );
}
