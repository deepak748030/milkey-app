import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { Pressable } from '@/components/ui/HapticPressable';
import { TextInput } from '@/components/ui/HapticTextInput';
import { Calendar as CalendarIcon, ChevronDown, Edit2, Search, X, Milk, Droplets, Sun, Moon, TableIcon, Ban, Printer, Check } from 'lucide-react-native';

// Ponytail reusable — single source, no duplication, no UI change
export function PurchaseCollectionTab(props:any){
  const ctx = (props as any).ctx || props;
  const { s, colors, t, entryDate, setShowDateModal, formatDate, entryShift, setEntryShift, isMorning, selectedCustomer, setSelectedCustomer: _setSelCust, setEditingCustomer, setShowAddCustomer, showInlineSearch, setShowInlineSearch, inlineSearchCode, setInlineSearchCode, inlineSearchResults, handleSelectCustomer, handleSaveEntry, milkType, setMilkType, milkQty, setMilkQty, fatValue, setFatValue, snfValue, setSnfValue, rateValue, setRateValue, computeAmount, isZero, setIsZero, noPrint, setNoPrint, saving, isPrinterConnected, historyTotals, todayRate, showCow, showBuffalo, isDark } = ctx;
  const setSelectedCustomer = _setSelCust ?? (() => {});
  const setShowRateSetting = ctx.setShowRateSetting || ctx.setShowRateChart;
  const setShowRateChart = setShowRateSetting;
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
                    {inlineSearchResults.length > 0 ? (
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

            {/* Entry Fields */}
            {selectedCustomer && (
                <View style={s.entryCard}>
                    {/* Price Basis Label */}
                    <Text style={s.priceBasisLabel}>
                        {!selectedCustomer.priceBasis || selectedCustomer.priceBasis === 'rate'
                            ? t.purchase.rateBased
                            : selectedCustomer.priceBasis === 'fat_snf'
                                ? 'Fat + SNF based'
                                : t.purchase.fatBased}
                    </Text>

                    {/* Input Row */}
                    <View style={s.fieldsRow}>
                        <View style={s.fieldBox}>
                            <Text style={s.fieldLabel}>{t.purchase.qty}</Text>
                            <TextInput style={s.fieldInput} value={milkQty} onChangeText={setMilkQty} keyboardType="decimal-pad" placeholder={selectedCustomer.priceBasis === 'fat_snf' ? '00.00' : '0.0'} placeholderTextColor={colors.mutedForeground} editable={!isZero} />
                        </View>
                        {/* FAT and SNF are ALWAYS available, not only for fat / fat+SNF
                            pricing. A rate-based farmer's milk still has a FAT / SNF
                            reading, and without these two inputs the value was saved as 0
                            and the columns stayed empty in the sale entries table, the
                            payment slip, the reports and the PDF. Pricing itself is
                            untouched: for a rate-based farmer the amount is qty x rate. */}
                        <View style={s.fieldBox}>
                            <Text style={s.fieldLabel}>{t.purchase.fat}</Text>
                            <TextInput style={s.fieldInput} value={fatValue} onChangeText={setFatValue} keyboardType="decimal-pad" placeholder={selectedCustomer.priceBasis === 'fat_snf' ? '6.5' : '0.0'} placeholderTextColor={colors.mutedForeground} editable={!isZero} />
                        </View>
                        <View style={s.fieldBox}>
                            <Text style={s.fieldLabel}>SNF</Text>
                            <TextInput style={s.fieldInput} value={snfValue} onChangeText={setSnfValue} keyboardType="decimal-pad" placeholder={selectedCustomer.priceBasis === 'fat_snf' ? '9.0' : '0.0'} placeholderTextColor={colors.mutedForeground} editable={!isZero} />
                        </View>
                        {/* Rate box: shown whenever the rate is NOT auto-derived
                            (rate basis, no basis stored yet, or fat+SNF with no rate
                            chart). Without this a farmer missing `priceBasis` had no
                            way to enter a rate and the save failed validation. */}
                        {selectedCustomer.priceBasis !== 'fat'
                            && !(selectedCustomer.priceBasis === 'fat_snf' && todayRate > 0) && (
                            <View style={s.fieldBox}>
                                <Text style={s.fieldLabel}>{t.common.rate}</Text>
                                <TextInput style={s.fieldInput} value={isZero ? '0' : rateValue} onChangeText={setRateValue} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={colors.mutedForeground} editable={!isZero} />
                            </View>
                        )}
                    </View>

                    {/* Computed Values Display */}
                    <View style={s.computedRow}>
                        {(selectedCustomer.priceBasis === 'fat' || selectedCustomer.priceBasis === 'fat_snf') && (
                            <Text style={s.computedText}>{t.common.rate}: <Text style={s.computedValue}>{rateValue || '0'}</Text></Text>
                        )}
                        <Text style={s.computedText}>{t.common.amount}: <Text style={[s.computedValue, { color: colors.primary }]}>₹{computeAmount().toFixed(1)}</Text></Text>
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
