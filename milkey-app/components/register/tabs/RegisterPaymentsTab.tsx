import React from 'react';
import { View, Text, FlatList, ActivityIndicator, ScrollView, Modal } from 'react-native';
import { Pressable } from '@/components/ui/HapticPressable';
import { TextInput } from '@/components/ui/HapticTextInput';
import { Search, X, Plus, Download, FileText, Trash2, Printer, User, ArrowRight, ClipboardList, Calendar as CalendarIcon } from 'lucide-react-native';
import { DateRangePicker } from '@/components/DateRangePicker';

// Ponytail reusable — single source, no duplication, no UI change
export function RegisterPaymentsTab(props:any){
  const { s, styles, colors, t, isDark, customers, setSelectedCustomer, customerSearch, setCustomerSearch, reportStartDate, reportEndDate, setReportStartDate, setReportEndDate, filteredReportCollections, reportSummary, handlePrintReport, handleExportCsv, farmerSearch, setFarmerSearch, setShowAddFarmerModal, setEditingFarmer, handleEditFarmer, handleDeleteFarmer, advances, setSelectedAdvance, advanceSearch, setAdvanceSearch, handleAddAdvance, handleEditAdvance, handleDeleteAdvance } = (props as any).ctx || props;
  return (
        <View>
            {/* Code input + Go button + Balance Report button */}
            <View style={styles.searchRow}>
                <TextInput
                    style={styles.searchInput}
                    placeholder="Enter Farmer Code"
                    value={paymentCode}
                    onChangeText={setPaymentCode}
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="numeric"
                    onSubmitEditing={() => {
                        Keyboard.dismiss();
                        handleFetchFarmerSummary();
                    }}
                    returnKeyType="go"
                />
                <Pressable
                    style={({ pressed }) => [styles.goBtnImproved, pressed && { opacity: 0.75 }]}
                    onPress={() => {
                        Keyboard.dismiss();
                        handleFetchFarmerSummary();
                    }}
                    disabled={paymentLoading}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                    {paymentLoading ? (
                        <ActivityIndicator size="small" color="#fff" />
                    ) : (
                        <>
                            <Text style={styles.goBtnTextImproved}>Go</Text>
                            <ArrowRight size={16} color="#fff" />
                        </>
                    )}
                </Pressable>
            </View>

            {/* Farmer info */}
            {paymentFarmer && (
                <>
                    <View style={styles.farmerInfoRow}>
                        <View>
                            <Text style={styles.farmerName}>{paymentFarmer.farmer.name}</Text>
                            <Text style={styles.farmerMobile}>{paymentFarmer.farmer.mobile}</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                            <Text style={styles.balanceLabel}>Current Balance</Text>
                            <Text style={[styles.balanceValue, { color: (paymentFarmer.farmer.currentBalance || 0) < 0 ? colors.destructive : colors.primary }]}>
                                ₹{(paymentFarmer.farmer.currentBalance || 0).toFixed(2)}
                            </Text>
                        </View>
                    </View>

                    {/* Calculation Period - Calendar opens as Modal */}
                    <Text style={styles.sectionLabel}>Calculation Period</Text>
                    <DateRangePicker
                        startDate={dateStart}
                        endDate={dateEnd}
                        onStartDateChange={(date) => setDateStart(date)}
                        onEndDateChange={(date) => {
                            setDateEnd(date);
                        }}
                        blockedPeriods={blockedPeriods}
                    />

                    {/* Summary card */}
                    <View style={styles.summaryCard}>
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Milk Amount:</Text>
                            <TextInput
                                style={styles.milkAmountInput}
                                value={milkAmount}
                                onChangeText={setMilkAmount}
                                onFocus={() => {
                                    // Clear if value is 0.00 or 0
                                    if (milkAmount === '0.00' || milkAmount === '0') {
                                        setMilkAmount('');
                                    }
                                }}
                                keyboardType="numeric"
                                placeholder="0.00"
                                placeholderTextColor={colors.mutedForeground}
                            />
                        </View>
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Advance/Prod:</Text>
                            <Text style={[styles.summaryValue, { color: colors.warning }]}>
                                ₹{advanceAmount.toFixed(2)}
                            </Text>
                        </View>
                        <View style={[styles.summaryRow, { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 }]}>
                            <Text style={[styles.summaryLabel, { fontWeight: '700' }]}>Total Payable:</Text>
                            <Text style={[styles.summaryValue, { fontWeight: '700', color: netPayable >= 0 ? colors.primary : colors.destructive }]}>
                                ₹{netPayable.toFixed(2)}
                            </Text>
                        </View>
                    </View>

                    {/* Payment helpers: View entries + Add amounts */}
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                        <Pressable
                            onPress={() => setShowPurchaseEntries(true)}
                            style={[styles.saveSettlementBtn, { flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }]}
                        >
                            <Text style={[styles.saveSettlementText, { color: colors.foreground }]}>View Entries</Text>
                        </Pressable>
                        <View style={{ flex: 1, flexDirection: 'row', gap: 6 }}>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.sectionLabel, { fontSize: 11, marginBottom: 4 }]}>Add More</Text>
                                <TextInput
                                    style={[styles.milkAmountInput, { textAlign: 'center' }]}
                                    value={addMoreAmount}
                                    onChangeText={setAddMoreAmount}
                                    keyboardType="numeric"
                                    placeholder="0.00"
                                    placeholderTextColor={colors.mutedForeground}
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.sectionLabel, { fontSize: 11, marginBottom: 4 }]}>External</Text>
                                <TextInput
                                    style={[styles.milkAmountInput, { textAlign: 'center' }]}
                                    value={addExternalAmount}
                                    onChangeText={setAddExternalAmount}
                                    keyboardType="numeric"
                                    placeholder="0.00"
                                    placeholderTextColor={colors.mutedForeground}
                                />
                            </View>
                        </View>
                    </View>
                    {(extraMore !== 0 || extraExternal !== 0) && (
                        <View style={[styles.summaryCard, { marginTop: 8, backgroundColor: colors.muted + '30' }]}>
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>Add More + External:</Text>
                                <Text style={[styles.summaryValue, { color: colors.primary }]}>₹{(extraMore + extraExternal).toFixed(2)}</Text>
                            </View>
                            <Text style={{ fontSize: 11, color: colors.mutedForeground, marginTop: 4 }}>Added to Total Payable automatically</Text>
                        </View>
                    )}

                    {/* Purchase Entries modal for this payment */}
                    <Modal visible={showPurchaseEntries} transparent animationType="slide" onRequestClose={() => setShowPurchaseEntries(false)}>
                        <View style={styles.dateModalOverlay}>
                            <Pressable style={{ flex: 1 }} onPress={() => setShowPurchaseEntries(false)} />
                            <View style={[styles.dateModalContent, { backgroundColor: colors.card, maxHeight: '70%' }]}>
                                <View style={styles.dateModalHeader}>
                                    <Text style={[styles.dateModalTitle, { color: colors.foreground }]}>Purchase Entries {paymentFarmer ? `(${paymentFarmer.farmer.code})` : ''}</Text>
                                    <Pressable onPress={() => setShowPurchaseEntries(false)} style={styles.dateModalClose}><X size={20} color={colors.foreground} /></Pressable>
                                </View>
                                <Text style={{ fontSize: 12, color: colors.mutedForeground, marginBottom: 8 }}>
                                    {formatDateDDMMYYYY(dateStart)} - {formatDateDDMMYYYY(dateEnd)} • Milk Amount auto from purchases
                                </Text>
                                <Text style={{ fontSize: 12, color: colors.mutedForeground, marginBottom: 12 }}>
                                    Entries are fetched from milk collections. Milk Amount field is auto-filled but editable. Add More/External are extra amounts added to payable.
                                </Text>
                                <Pressable style={styles.saveSettlementBtn} onPress={() => setShowPurchaseEntries(false)}>
                                    <Text style={styles.saveSettlementText}>Close</Text>
                                </Pressable>
                            </View>
                        </View>
                    </Modal>

                    {/* Pending Advances List */}
                    {paymentFarmer.advances.items && paymentFarmer.advances.items.length > 0 && (
                        <View style={styles.advanceListCard}>
                            <Text style={styles.advanceListTitle}>Pending Advances</Text>
                            {paymentFarmer.advances.items.map((adv) => (
                                <View key={adv._id} style={styles.advanceListItem}>
                                    <Text style={styles.advanceItemNote}>{adv.note || 'Advance'}</Text>
                                    <Text style={styles.advanceItemDate}>
                                        {formatDateDDMMYYYY(adv.date)}
                                    </Text>
                                    <Text style={[styles.advanceItemAmount, { color: colors.warning }]}>
                                        ₹{adv.remaining.toFixed(2)}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    )}

                    {/* Paid Amount Input - styled like Milk Amount box */}
                    <View style={styles.summaryCard}>
                        <View style={styles.summaryRow}>
                            <Text style={[styles.summaryLabel, { fontWeight: '700', color: colors.primary }]}>Paid Amount:</Text>
                            <TextInput
                                style={styles.milkAmountInput}
                                value={paidAmount}
                                onChangeText={setPaidAmount}
                                onFocus={() => {
                                    if (paidAmount === '0.00' || paidAmount === '0') {
                                        setPaidAmount('');
                                    }
                                }}
                                keyboardType="numeric"
                                placeholder="0.00"
                                placeholderTextColor={colors.mutedForeground}
                            />
                        </View>
                    </View>

                    {/* Closing Balance */}
                    <View style={styles.closingRow}>
                        <Text style={styles.closingLabel}>Closing Balance:</Text>
                        <Text style={[styles.closingValue, { color: closingBalance >= 0 ? colors.primary : colors.destructive }]}>
                            ₹{closingBalance.toFixed(2)}
                        </Text>
                    </View>

                    {/* Save & Clear buttons */}
                    <View style={styles.buttonRow}>
                        <Pressable style={styles.saveSettlementBtn} onPress={handleSaveSettlement} disabled={savingPayment}>
                            {savingPayment ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <Text style={styles.saveSettlementText}>SAVE SETTLEMENT & PRINT</Text>
                            )}
                        </Pressable>
                    </View>
                    <Pressable style={styles.clearPaymentBtn} onPress={clearPaymentForm}>
                        <Text style={styles.clearPaymentText}>Clear</Text>
                    </Pressable>
                </>
            )}

            {/* Settlement History - Show filtered by farmer code when searched */}
            <View style={styles.settlementHistoryHeader}>
                <Text style={styles.subTitle}>
                    Settlement History {paymentFarmer ? `(${paymentFarmer.farmer.code})` : ''}
                </Text>
                {!paymentFarmer && (
                    <View style={styles.settlementStatsRow}>
                        <View style={styles.settlementCombinedChip}>
                            <Pressable
                                style={styles.settlementDateBtnCombined}
                                onPress={() => setShowSettlementDatePicker(true)}
                            >
                                <CalendarIcon size={14} color={colors.primary} />
                                <Text style={styles.settlementDateText}>
                                    {formatDateDDMMYYYY(settlementSummaryDate)}
                                </Text>
                            </Pressable>
                            <View style={styles.settlementChipDivider} />
                            <View style={styles.settlementStatChipCombined}>
                                <Text style={styles.settlementStatLabel}>PAID</Text>
                                <Text style={styles.settlementStatValue}>₹{settlementPaidOnDate.toLocaleString('en-IN')}</Text>
                            </View>
                        </View>
                        <View style={[styles.settlementStatChip, styles.settlementCurrentChip, settlementTotalBalance < 0 && { borderColor: colors.destructive }]}>
                            <Text style={styles.settlementStatLabel}>CURRENT</Text>
                            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} ellipsizeMode="tail" style={[styles.settlementStatValue, styles.settlementCurrentValue, { color: settlementTotalBalance >= 0 ? colors.primary : colors.destructive }]}>
                                ₹{settlementTotalBalance.toLocaleString('en-IN')}
                            </Text>
                        </View>
                        <Pressable
                            style={styles.balanceReportBtn}
                            onPress={() => setShowBalancePrintModal(true)}
                        >
                            <ClipboardList size={18} color={colors.primary} />
                        </Pressable>
                    </View>
                )}
            </View>

            {/* Settlement Date Picker Modal */}
            <Modal
                visible={showSettlementDatePicker}
                transparent
                animationType="slide"
                onRequestClose={() => setShowSettlementDatePicker(false)}
            >
                <View style={styles.dateModalOverlay}>
                    <Pressable style={{ flex: 1 }} onPress={() => setShowSettlementDatePicker(false)} />
                    <View style={[styles.dateModalContent, { backgroundColor: colors.card }]}>
                        <View style={styles.dateModalHeader}>
                            <Text style={[styles.dateModalTitle, { color: colors.foreground }]}>Select Date</Text>
                            <Pressable onPress={() => setShowSettlementDatePicker(false)} style={styles.dateModalClose}>
                                <X size={20} color={colors.foreground} />
                            </Pressable>
                        </View>
                        <Calendar
                            onDateSelect={(date) => {
                                if (date) {
                                    const year = date.getFullYear();
                                    const month = String(date.getMonth() + 1).padStart(2, '0');
                                    const day = String(date.getDate()).padStart(2, '0');
                                    const newDate = `${year}-${month}-${day}`;
                                    setSettlementSummaryDate(newDate);
                                    fetchSettlementSummaryStats(newDate);
                                    setShowSettlementDatePicker(false);
                                }
                            }}
                            selectedDate={settlementSummaryDate ? new Date(settlementSummaryDate + 'T00:00:00') : new Date()}
                        />
                    </View>
                </View>
            </Modal>
            {(() => {
                // Use farmer-specific payments when a farmer is selected, otherwise use global payments
                const filteredPayments = paymentFarmer
                    ? farmerPayments
                    : payments;

                if (filteredPayments.length === 0) {
                    return (
                        <Text style={styles.infoTextMuted}>
                            {paymentFarmer ? `No settlements for ${paymentFarmer.farmer.name}` : 'No settlements yet'}
                        </Text>
  );
}
