import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { Pressable } from '@/components/ui/HapticPressable';
import { TextInput } from '@/components/ui/HapticTextInput';
import { Calendar as CalendarIcon, ChevronDown, Edit2, Search, X, Milk, Droplets, Sun, Moon, TableIcon, Ban, Printer, Check } from 'lucide-react-native';

// Ponytail reusable — single source, no duplication, no UI change
export function PurchaseCollectionTab(props:any){
  const ctx = (props as any).ctx || props;
  const { s, colors, t, entryDate, setShowDateModal, formatDate, entryShift, setEntryShift, isMorning, selectedCustomer, setSelectedCustomer: _setSelCust, setEditingCustomer, setShowAddCustomer, showInlineSearch, setShowInlineSearch, inlineSearchCode, setInlineSearchCode, inlineSearchResults, inlineSearchLoading, handleSelectCustomer, handleSaveEntry, milkType, setMilkType, milkQty, setMilkQty, fatValue, setFatValue, snfValue, setSnfValue, rateValue, setRateValue, computeAmount, isZero, setIsZero, noPrint, setNoPrint, saving, isPrinterConnected, historyTotals, todayRate, showCow, showBuffalo, isDark } = ctx;
  const milkRateSettings = (ctx as any).milkRateSettings || null;
  const purchaseModeOverride = (ctx as any).purchaseModeOverride || null;
  const setPurchaseModeOverride = (ctx as any).setPurchaseModeOverride || (() => {});
  const setSelectedCustomer = _setSelCust ?? (() => {});
  const setShowRateSetting = ctx.setShowRateSetting || ctx.setShowRateChart;
  const setShowRateChart = setShowRateSetting;
  // Effective basis: if user picked via chooser (when Fixed not defined), use override, else farmer's basis
  const effectiveBasis: any = purchaseModeOverride || (selectedCustomer as any)?.priceBasis || 'rate';
  const globalFixedDefined = milkRateSettings ? ((milkRateSettings as any).fixedRate?.buffalo > 0 || (milkRateSettings as any).fixedRate?.cow > 0) : false;
  const currentFixedRate = milkRateSettings ? ((milkType === 'cow' ? (milkRateSettings as any).fixedRate?.cow : (milkRateSettings as any).fixedRate?.buffalo) || 0) : 0;
  const showMethodChooser = !!selectedCustomer && !globalFixedDefined;
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
                <Pressable
                    style={[s.addCustTopBtn, { backgroundColor: colors.secondary, marginLeft: selectedCustomer ? 6 : 0 }]}
                    onPress={() => setShowRateSetting(true)}
                    accessibilityLabel="Rate Setting"
                >
                    <TableIcon size={16} color={colors.primary} />
                </Pressable>
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

                {selectedCustomer && showCow && ((selectedCustomer as any).showRateSetting !== true && (selectedCustomer as any).showRateChart !== true) && (
                    <Pressable onPress={() => setMilkType('cow')} style={[s.milkToggleBtn, milkType === 'cow' && s.milkToggleBtnActive]}>
                        <Milk size={14} color={milkType === 'cow' ? '#fff' : colors.foreground} />
                        <Text style={[s.milkToggleBtnText, milkType === 'cow' && { color: '#fff' }]}>{t.purchase.cow}</Text>
                    </Pressable>
                )}
                {selectedCustomer && showBuffalo && ((selectedCustomer as any).showRateSetting !== true && (selectedCustomer as any).showRateChart !== true) && (
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

            {/* Entry Fields — Ordered: Quantity → Quality → Rate auto → Amount */}
            {selectedCustomer && (
                <View style={s.entryCard}>
                    {/* Method label + Chooser when Fixed not defined */}
                    <Text style={s.priceBasisLabel}>
                        {effectiveBasis === 'rate' ? 'Fixed Rate' : effectiveBasis === 'fat' ? 'Rate by Quantity/Quality' : 'Rate Chart'} {globalFixedDefined && currentFixedRate ? `— ₹\${currentFixedRate}/L fixed` : ''}
                    </Text>
                    {showMethodChooser && (
                        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                            {[
                                { value: 'rate', label: 'Fixed Rate' },
                                { value: 'fat', label: 'Qty/Quality' },
                                { value: 'fat_snf', label: 'Rate Chart' },
                            ].map(opt => (
                                <Pressable key={opt.value} onPress={() => setPurchaseModeOverride(opt.value as any)} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: effectiveBasis === opt.value ? colors.primary : colors.background }}>
                                    {effectiveBasis === opt.value && <Check size={12} color="#fff" style={{ marginRight: 4 }} />}
                                    <Text style={{ fontSize: 12, fontWeight: '600', color: effectiveBasis === opt.value ? '#fff' : colors.foreground }}>{opt.label}</Text>
                                </Pressable>
                            ))}
                        </View>
                    )}

                    {/* 1. Quantity — sabse pehle, bada input */}
                    <View style={s.fieldBox}>
                        <Text style={[s.fieldLabel, { textAlign: 'left' }]}>1. Quantity (Litre)</Text>
                        <TextInput style={[s.fieldInput, { fontSize: 20 }]} value={milkQty} onChangeText={setMilkQty} keyboardType="decimal-pad" placeholder="0.0" placeholderTextColor={colors.mutedForeground} editable={!isZero} />
                        {!milkQty && !isZero && <Text style={{ fontSize: 10, color: colors.mutedForeground, marginTop: 2 }}>Quantity bharo — amount auto ₹0 rahega</Text>}
                    </View>

                    {/* 2. Quality — Fat / SNF (visibility by method) */}
                    <View style={[s.fieldsRow, { marginTop: 8 }]}>
                        {(effectiveBasis === 'fat' || effectiveBasis === 'fat_snf') && (
                            <View style={s.fieldBox}>
                                <Text style={s.fieldLabel}>2. Quality — Fat</Text>
                                <TextInput style={s.fieldInput} value={fatValue} onChangeText={setFatValue} keyboardType="decimal-pad" placeholder={effectiveBasis === 'fat_snf' ? '6.5' : '4.0'} placeholderTextColor={colors.mutedForeground} editable={!isZero} />
                            </View>
                        )}
                        {effectiveBasis === 'fat_snf' && (
                            <View style={s.fieldBox}>
                                <Text style={s.fieldLabel}>SNF</Text>
                                <TextInput style={s.fieldInput} value={snfValue} onChangeText={setSnfValue} keyboardType="decimal-pad" placeholder="9.0" placeholderTextColor={colors.mutedForeground} editable={!isZero} />
                            </View>
                        )}
                        {/* Fixed Rate needs no quality — hide Fat/SNF for fixed */}
                        {effectiveBasis === 'rate' && (
                            <View style={s.fieldBox}>
                                <Text style={s.fieldLabel}>2. Quality</Text>
                                <Text style={{ fontSize: 11, color: colors.mutedForeground, paddingVertical: 10, textAlign: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.muted }}>Fixed rate — quality not needed</Text>
                            </View>
                        )}
                        {/* Rate — auto calculate, editable override */}
                        <View style={s.fieldBox}>
                            <Text style={s.fieldLabel}>3. Rate (auto)</Text>
                            <TextInput style={[s.fieldInput, { backgroundColor: rateValue ? colors.card : colors.background }]} value={isZero ? '0' : rateValue} onChangeText={setRateValue} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={colors.mutedForeground} editable={!isZero} />
                            {rateValue ? <Text style={{ fontSize: 10, color: colors.primary, marginTop: 2, textAlign: 'center' }}>Auto — edit kar sakte ho</Text> : null}
                        </View>
                    </View>

                    {/* 4. Amount — Rate × Quantity, qty khali → 0 */}
                    <View style={[s.computedRow, { marginTop: 10, backgroundColor: colors.primary + '08', borderRadius: 10, paddingVertical: 8, borderWidth: 1, borderColor: colors.primary + '15' }]}>
                        <Text style={s.computedText}>Amount: <Text style={[s.computedValue, { color: computeAmount() === 0 ? colors.mutedForeground : colors.primary }]}>₹{computeAmount().toFixed(2)}</Text></Text>
                        {computeAmount() === 0 && <Text style={{ fontSize: 10, color: colors.mutedForeground, marginTop: 2, textAlign: 'center' }}>Quantity ya Rate khali hai → Amount ₹0</Text>}
                    </View>

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
