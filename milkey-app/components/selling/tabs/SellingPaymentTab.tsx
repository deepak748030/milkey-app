import React from 'react';
import { View, Text, Pressable, TextInput, ActivityIndicator, ScrollView, Modal } from 'react-native';
import { Calendar as CalendarIcon, Search, Trash2, FileText, Printer, Edit2, DollarSign, User, X, Zap, Check } from 'lucide-react-native';
import { SellingPaymentCalendar } from '@/components/SellingPaymentCalendar';

// Ponytail reusable — single source, no duplication, no UI change
export function SellingPaymentTab(props:any){
  const { s, styles, colors, t, isDark, entryDate, setShowBulkEntryModal, renderSuggestionDropdown, formatDate, openDatePicker, searchMember, setSearchMember, selectedMember, setSelectedMember, setShowSuggestions, showSuggestions, mornQty, setMornQty, eveQty, setEveQty, rate, setRate, amount, handleSaveEntry, savingEntry, groupedEntries, setEditingEntry, setShowEditModal, handleDeleteEntry, deletingId, recentEntriesStartDate, setRecentEntriesStartDate, recentEntriesEndDate, setRecentEntriesEndDate, formatDate, filteredRecentMembers, recentEntriesMemberFilter, setRecentEntriesMemberFilter, showRecentMemberDropdown, setShowRecentMemberDropdown, recentMemberSearch, setRecentMemberSearch, selectedRecentMemberName, handleEntriesPDF, handlePrintEntries, hasMoreEntries, handleLoadMore, loadingMore, previousBalance, currentMilkAmount, paidAmount, netPayable, closingBalance, paymentMemberSearch, setPaymentMemberSearch, selectedPaymentMember, setSelectedPaymentMember, memberSummary, setMemberSummary, showPaymentMemberSuggestions, setShowPaymentMemberSuggestions, filteredPaymentMembers, milkAmount, setMilkAmount, paymentAmount, setPaymentAmount, paymentMethod, setPaymentMethod, handleAddPayment, savingPayment, payments, handleDeletePayment, handleExportPaymentPdf, handlePrintPayment, filteredReportData, reportSummary, handlePrintReport, handleExportCsv, members, memberSearch, setMemberSearch, handleAddMember, handleEditMember, handleDeleteMember, setShowAddMemberModal, setEditingMember, setSelectedMemberForPayments, setShowMemberPaymentsModal } = (props as any).ctx || props;
  return (
        <View>
            {/* Member Search */}
            <View style={styles.inputGroup}>
                <Text style={styles.label}>Select Member</Text>
                <Pressable
                    style={styles.searchInput}
                    onPress={() => setShowPaymentMemberSuggestions(true)}
                >
                    <Search size={16} color={colors.mutedForeground} />
                    <TextInput
                        style={styles.searchTextInput}
                        placeholder="Search member by name..."
                        value={paymentMemberSearch}
                        onChangeText={(text) => {
                            setPaymentMemberSearch(text);
                            setShowPaymentMemberSuggestions(true);
                            if (selectedPaymentMember) {
                                setSelectedPaymentMember(null);
                                setMemberSummary(null);
                            }
                        }}
                        onFocus={() => setShowPaymentMemberSuggestions(true)}
                        onBlur={() => {
                            // Delay to allow selection to complete before hiding
                            setTimeout(() => setShowPaymentMemberSuggestions(false), 200);
                        }}
                        placeholderTextColor={colors.mutedForeground}
                    />
                    {selectedPaymentMember && (
                        <View style={styles.selectedBadge}>
                            <Check size={12} color={colors.white} />
                        </View>
                    )}
                    {selectedPaymentMember && (
                        <Pressable onPress={clearPaymentForm}>
                            <X size={16} color={colors.destructive} />
                        </Pressable>
                    )}
                </Pressable>

                {/* Member suggestions dropdown */}
                {showPaymentMemberSuggestions && !selectedPaymentMember && (
                    <View style={styles.suggestionDropdown}>
                        <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                            {filteredPaymentMembers.length === 0 ? (
                                <Text style={styles.emptyText}>No members found</Text>
                            ) : (
                                filteredPaymentMembers.map((member) => (
                                    <Pressable
                                        key={member._id}
                                        style={styles.suggestionItem}
                                        onPress={() => handleSelectPaymentMember(member)}
                                    >
                                        <View>
                                            <Text style={styles.suggestionName}>{member.name}</Text>
                                            <Text style={styles.suggestionCode}>{member.mobile}</Text>
                                        </View>
                                    </Pressable>
                                ))
                            )}
                        </ScrollView>
                    </View>
                )}
            </View>

            {paymentLoading && (
                <View style={{ padding: 20, alignItems: 'center' }}>
                    <ActivityIndicator size="small" color={colors.primary} />
                </View>
            )}

            {/* Member Info */}
            {selectedPaymentMember && !paymentLoading && (
                <>
                    <View style={styles.memberInfoRow}>
                        <View>
                            <Text style={styles.memberInfoName}>{selectedPaymentMember.name}</Text>
                            <Text style={styles.memberInfoMobile}>{selectedPaymentMember.mobile}</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                            <Text style={styles.balanceLabel}>Current Balance</Text>
                            <Text style={[styles.balanceValue, { color: previousBalance >= 0 ? colors.primary : colors.destructive }]}>
                                ₹{previousBalance.toFixed(2)}
                            </Text>
                        </View>
                    </View>

                    {/* Print Milk Slip + Full Detailed Entry buttons */}
                    <View style={{ flexDirection: 'row', gap: 6, marginBottom: 6 }}>
                        <Pressable
                            style={{
                                flex: 1,
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 6,
                                backgroundColor: colors.primary,
                                borderRadius: 6,
                                paddingVertical: 8,
                            }}
                            onPress={handlePrintMilkSlip}
                            disabled={milkSlipPrinting}
                        >
                            {milkSlipPrinting ? (
                                <ActivityIndicator size="small" color={colors.white} />
                            ) : (
                                <>
                                    <Printer size={14} color={colors.white} />
                                    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.white }}>Print Milk Slip</Text>
                                </>
                            )}
                        </Pressable>
                        <Pressable
                            style={{
                                flex: 1,
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 6,
                                backgroundColor: colors.card,
                                borderWidth: 1,
                                borderColor: colors.primary,
                                borderRadius: 6,
                                paddingVertical: 8,
                            }}
                            onPress={() => {
                                if (!selectedPaymentMember) {
                                    showAlert('Error', 'Please select a member first');
                                    return;
                                }
                                router.push({
                                    pathname: '/view-entries',
                                    params: {
                                        memberId: selectedPaymentMember._id,
                                        memberName: selectedPaymentMember.name,
                                        startDate: calcStartDate || '',
                                        endDate: calcEndDate || '',
                                        rate: String(selectedPaymentMember.ratePerLiter ?? ''),
                                    },
                                });
                            }}
                        >
                            <FileText size={14} color={colors.primary} />
                            <Text
                                numberOfLines={1}
                                adjustsFontSizeToFit
                                minimumFontScale={0.7}
                                style={{ fontSize: 11, fontWeight: '700', color: colors.primary, flexShrink: 1 }}
                            >
                                View Detailed Entry
                            </Text>
                        </Pressable>
                        <Pressable
                            style={{
                                flex: 1,
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 6,
                                backgroundColor: colors.card,
                                borderWidth: 1,
                                borderColor: colors.primary,
                                borderRadius: 6,
                                paddingVertical: 8,
                            }}
                            onPress={handlePrintPaymentMemberEntriesThermal}
                        >
                            <Printer size={14} color={colors.primary} />
                            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary }}>Print Entry</Text>
                        </Pressable>
                    </View>

                    {/* Calculation Period Section - End Date Only */}
                    <View style={styles.calcPeriodCard}>
                        <View style={styles.calcPeriodHeader}>
                            <Text style={styles.calcPeriodTitle}>Calculation Period</Text>
                        </View>

                        <Pressable
                            style={styles.calcDateChip}
                            onPress={() => {
                                setCalcDateTarget('end');
                                const date = calcEndDate ? new Date(calcEndDate) : new Date();
                                setTempCalendarDate(date);
                                setShowCalcDatePicker(true);
                            }}
                        >
                            <Text style={styles.calcDateChipLabel}>Till</Text>
                            <View style={styles.calcDateChipValueRow}>
                                <CalendarIcon size={12} color={colors.primary} />
                                <Text style={[styles.calcDateChipValue, { color: colors.primary }]}>
                                    {calcEndDate ? formatDateDDMMYYYY(calcEndDate) : 'Select Date'}
                                </Text>
                            </View>
                        </Pressable>
                    </View>

                    {/* Summary Card - read-only values shown as plain text (no box bg) */}
                    <View style={styles.paymentSummaryCard}>
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Milk Qty (L):</Text>
                            <Text style={[styles.summaryValueBoxText, { color: colors.foreground }]}>
                                {(memberSummary?.selling?.totalLiters || 0).toFixed(1)} L
                            </Text>
                        </View>
                        <View style={[styles.summaryRow, { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8, opacity: 0.7 }]}>
                            <Text style={styles.summaryLabel}>Milk Amount (₹):</Text>
                            <Text style={[styles.summaryValueBoxText, { color: colors.foreground }]}>
                                ₹ {milkAmount}
                            </Text>
                        </View>
                        <View style={[styles.summaryRow, { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 }]}>
                            <Text style={[styles.summaryLabel, { fontWeight: '700' }]}>Total Payable:</Text>
                            <Text style={[styles.summaryValueBoxText, { fontWeight: '700', color: netPayable >= 0 ? colors.primary : colors.destructive }]}>
                                ₹{netPayable.toFixed(2)}
                            </Text>
                        </View>
                    </View>

                    {/* Paid Amount Input - styled like Register/Payment box */}
                    <View style={styles.paymentSummaryCard}>
                        <View style={styles.summaryRow}>
                            <Text style={[styles.summaryLabel, { fontWeight: '700', color: colors.primary }]}>Paid Amount:</Text>
                            <View style={styles.summaryValueBox}>
                                <TextInput
                                    style={[styles.summaryValueBoxText, { color: colors.foreground, padding: 0, minWidth: 80, textAlign: 'right' }]}
                                    placeholder="0.00"
                                    value={paymentAmount}
                                    onChangeText={setPaymentAmount}
                                    onFocus={() => {
                                        if (paymentAmount === '0.00' || paymentAmount === '0') {
                                            setPaymentAmount('');
                                        }
                                    }}
                                    keyboardType="numeric"
                                    placeholderTextColor={colors.mutedForeground}
                                />
                            </View>
                        </View>
                    </View>

                    {/* Closing Balance - positive means customer owes, negative means overpaid */}
                    <View style={styles.closingRow}>
                        <Text style={styles.closingLabel}>Closing Balance:</Text>
                        <Text style={[styles.closingValue, { color: closingBalance > 0 ? colors.success : closingBalance < 0 ? colors.destructive : colors.mutedForeground }]}>
                            {closingBalance < 0 ? '-' : ''}₹{Math.abs(closingBalance).toFixed(2)}
                        </Text>
                    </View>

                    {/* Save & Clear buttons */}
                    <View style={styles.paymentButtonRow}>
                        <Pressable style={styles.saveSettlementBtn} onPress={handleProcessPayment} disabled={savingPayment}>
                            {savingPayment ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <Text style={styles.saveSettlementText}>SAVE PAYMENT & PRINT</Text>
                            )}
                        </Pressable>
                    </View>
                    <Pressable style={styles.clearPaymentBtn} onPress={clearPaymentForm}>
                        <Text style={styles.clearPaymentText}>Clear</Text>
                    </Pressable>
                </>
            )}

            {/* Payment History */}
            <Text style={[styles.sectionTitle, { marginTop: 16 }]}>
                Payment History {selectedPaymentMember ? `(${selectedPaymentMember.name})` : ''}
            </Text>
            {(() => {
                // Dedupe payments by _id (member-specific fetch + global fetch may overlap)
                const seenIds = new Set<string>();
                const uniquePayments = recentPayments.filter(p => {
                    if (!p?._id || seenIds.has(p._id)) return false;
                    seenIds.add(p._id);
                    return true;
                });
                // Filter payments by member if one is selected
                // When a member is selected, hide fully-settled payments (closingBalance <= 0)
                // so only records with outstanding/pending balance are shown.
                const filteredPayments = selectedPaymentMember
                    ? uniquePayments.filter(p =>
                        p.member?._id === selectedPaymentMember._id &&
                        Number(p.closingBalance ?? 0) > 0
                    )
                    : uniquePayments;

                if (filteredPayments.length === 0) {
                    return (
                        <Text style={styles.emptyText}>
                            {selectedPaymentMember ? `No payments for ${selectedPaymentMember.name}` : 'No payments yet'}
                        </Text>
  );
}
