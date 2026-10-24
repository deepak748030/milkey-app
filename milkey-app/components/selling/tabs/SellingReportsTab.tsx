import React from 'react';
import { View, Text, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { FileText, Download, Printer, Search, X } from 'lucide-react-native';
import { DateRangePicker } from '@/components/DateRangePicker';

// Ponytail reusable — single source, no duplication, no UI change
export function SellingReportsTab(props:any){
  const { s, styles, colors, t, isDark, entryDate, setShowBulkEntryModal, renderSuggestionDropdown, formatDate, openDatePicker, searchMember, setSearchMember, selectedMember, setSelectedMember, setShowSuggestions, showSuggestions, mornQty, setMornQty, eveQty, setEveQty, rate, setRate, amount, handleSaveEntry, savingEntry, groupedEntries, setEditingEntry, setShowEditModal, handleDeleteEntry, deletingId, recentEntriesStartDate, setRecentEntriesStartDate, recentEntriesEndDate, setRecentEntriesEndDate, formatDate, filteredRecentMembers, recentEntriesMemberFilter, setRecentEntriesMemberFilter, showRecentMemberDropdown, setShowRecentMemberDropdown, recentMemberSearch, setRecentMemberSearch, selectedRecentMemberName, handleEntriesPDF, handlePrintEntries, hasMoreEntries, handleLoadMore, loadingMore, previousBalance, currentMilkAmount, paidAmount, netPayable, closingBalance, paymentMemberSearch, setPaymentMemberSearch, selectedPaymentMember, setSelectedPaymentMember, memberSummary, setMemberSummary, showPaymentMemberSuggestions, setShowPaymentMemberSuggestions, filteredPaymentMembers, milkAmount, setMilkAmount, paymentAmount, setPaymentAmount, paymentMethod, setPaymentMethod, handleAddPayment, savingPayment, payments, handleDeletePayment, handleExportPaymentPdf, handlePrintPayment, filteredReportData, reportSummary, handlePrintReport, handleExportCsv, members, memberSearch, setMemberSearch, handleAddMember, handleEditMember, handleDeleteMember, setShowAddMemberModal, setEditingMember, setSelectedMemberForPayments, setShowMemberPaymentsModal } = (props as any).ctx || props;
  return (
        // Get selected member for report from balance report data (server data)
        const selectedReportMember = reportMemberFilter
            ? balanceReportData.find(m => m._id === reportMemberFilter)
            : null;

        // Use server-provided summary for totals
        const totalMembers = balanceReportSummary?.totalMembers || 0;
        const totalUnpaidQuantity = balanceReportSummary?.totalUnpaidQuantity || 0;
        const netBalance = balanceReportSummary?.netBalance || 0;
        const totalReceivable = balanceReportSummary?.totalReceivable || 0;
        const totalPayable = balanceReportSummary?.totalPayable || 0;

        // Data to display in table (filtered by selected member or all)
        const displayData = selectedReportMember ? [selectedReportMember] : balanceReportData;

        return (
            <View>
                <Text style={styles.sectionTitle}>Selling Report</Text>

                {/* Top Summary Cards - Only show when no member is selected */}
                {!selectedReportMember && (
                    <View style={styles.reportSummary}>
                        <View style={styles.reportCard}>
                            <Text style={styles.reportCardLabel}>Total Members</Text>
                            <Text style={styles.reportCardValue}>{totalMembers}</Text>
                        </View>
                        <View style={styles.reportCard}>
                            <Text style={styles.reportCardLabel}>Unpaid Qty</Text>
                            <Text style={styles.reportCardValue}>{totalUnpaidQuantity.toFixed(1)} L</Text>
                        </View>
                        <View style={styles.reportCard}>
                            <Text style={styles.reportCardLabel}>Net Balance</Text>
                            <Text style={[styles.reportCardValue, { color: netBalance >= 0 ? colors.success : colors.destructive }]}>
                                {netBalance < 0 ? '-' : ''}₹{Math.abs(netBalance).toFixed(0)}
                            </Text>
                        </View>
                    </View>
                )}


                {/* Export Buttons - Removed Download PDF & Print */}

                {/* Member Filter Only */}
                <View style={styles.filterCard}>
                    <View style={styles.memberFilterRow}>
                        <Text style={styles.memberFilterLabel}>Member:</Text>
                        {showReportMemberDropdown ? (
                            <View style={[styles.memberFilterBtn, { paddingVertical: 0 }]}>
                                <Search size={14} color={colors.primary} />
                                <TextInput
                                    style={[styles.memberSearchInput, { flex: 1, paddingVertical: 8 }]}
                                    placeholder="Search by name or mobile..."
                                    value={reportMemberSearch}
                                    onChangeText={setReportMemberSearch}
                                    placeholderTextColor={colors.mutedForeground}
                                    autoFocus
                                />
                                <Pressable
                                    onPress={() => {
                                        setReportMemberSearch('');
                                        setShowReportMemberDropdown(false);
                                    }}
                                >
                                    <X size={14} color={colors.destructive} />
                                </Pressable>
                            </View>
                        ) : (
                            <Pressable
                                style={styles.memberFilterBtn}
                                onPress={() => setShowReportMemberDropdown(true)}
                            >
                                <User size={14} color={colors.primary} />
                                <Text style={styles.memberFilterText} numberOfLines={1}>{selectedReportMemberName}</Text>
                                {reportMemberFilter && (
                                    <Pressable
                                        onPress={(e) => {
                                            e.stopPropagation?.();
                                            setReportMemberFilter('');
                                        }}
                                    >
                                        <X size={14} color={colors.destructive} />
                                    </Pressable>
                                )}
                            </Pressable>
                        )}
                    </View>
                    {showReportMemberDropdown && (
                        <View style={styles.memberFilterDropdown}>
                            <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                                <Pressable
                                    style={[styles.memberFilterItem, !reportMemberFilter && styles.memberFilterItemActive]}
                                    onPress={() => {
                                        setReportMemberFilter('');
                                        setReportMemberSearch('');
                                        setShowReportMemberDropdown(false);
                                    }}
                                >
                                    <Text style={styles.memberFilterItemText}>All Members</Text>
                                    {!reportMemberFilter && <Check size={14} color={colors.primary} />}
                                </Pressable>
                                {filteredReportMembers.map(member => (
                                    <Pressable
                                        key={member._id}
                                        style={[styles.memberFilterItem, reportMemberFilter === member._id && styles.memberFilterItemActive]}
                                        onPress={() => {
                                            setReportMemberFilter(member._id);
                                            setReportMemberSearch('');
                                            setShowReportMemberDropdown(false);
                                        }}
                                    >
                                        <Text style={styles.memberFilterItemText}>{member.name}</Text>
                                        {reportMemberFilter === member._id && <Check size={14} color={colors.primary} />}
                                    </Pressable>
                                ))}
                            </ScrollView>
                        </View>
                    )}
                </View>

                {/* All Members Balance Table */}
                <View style={styles.memberSummarySection}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 8 }}>
                        <Text style={[styles.memberSummaryTitle, { marginBottom: 0 }]} numberOfLines={1}>
                            {selectedReportMember ? 'Member Details' : 'All Members Balance'}
                        </Text>
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                            <Pressable
                                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.card, borderRadius: 6, borderWidth: 1, borderColor: colors.primary }}
                                onPress={handleReportPDF}
                                disabled={reportDownloading}
                            >
                                {reportDownloading ? <ActivityIndicator size="small" color={colors.primary} /> : <FileText size={14} color={colors.primary} />}
                                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.primary }}>PDF</Text>
                            </Pressable>
                            <Pressable
                                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.card, borderRadius: 6, borderWidth: 1, borderColor: colors.primary }}
                                onPress={handleReportPrint}
                            >
                                <Printer size={14} color={colors.primary} />
                                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.primary }}>Print</Text>
                            </Pressable>
                        </View>
                    </View>

                    {balanceReportLoading ? (
                        <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 20 }} />
                    ) : displayData.length === 0 ? (
                        <Text style={styles.emptyText}>No members found</Text>
                    ) : (
                        <View style={styles.table}>
                            <View style={styles.tableHeader}>
                                <Text style={[styles.tableHeaderCell, { flex: 0.4, textAlign: 'center' }]}>Sr</Text>
                                <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>Name</Text>
                                <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'center' }]}>Date</Text>
                                <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'center' }]}>Till</Text>
                                <Text style={[styles.tableHeaderCell, { flex: 0.9, textAlign: 'right', paddingRight: 4 }]}>Balance</Text>
                                <Text style={[styles.tableHeaderCell, { flex: 0.4, textAlign: 'center' }]}></Text>
                            </View>
                            {displayData.map((member, index) => {
                                const balance = member.totalBalance;

                                return (
                                    <View key={member._id} style={[styles.tableRow, index % 2 === 0 && { backgroundColor: colors.muted + '30' }]}>
                                        <Text style={[styles.tableCell, { flex: 0.4, textAlign: 'center', color: colors.mutedForeground }]}>{index + 1}</Text>
                                        <Text style={[styles.tableCell, { flex: 1.5, fontWeight: '500' }]} numberOfLines={1}>{member.name}</Text>
                                        <Text style={[styles.tableCell, { flex: 1, textAlign: 'center', fontSize: 10 }]}>{formatDateDDMMYYYY(member.date)}</Text>
                                        <Text style={[styles.tableCell, { flex: 1, textAlign: 'center', fontSize: 10, color: member.lastPeriodEnd ? colors.primary : colors.mutedForeground }]}>
                                            {member.lastPeriodEnd ? formatDateDDMMYYYY(member.lastPeriodEnd) : '-'}
                                        </Text>
                                        <Text style={[
                                            styles.tableCell,
                                            {
                                                flex: 0.9,
                                                textAlign: 'right',
                                                paddingRight: 4,
                                                fontWeight: '700',
                                                color: balance > 0
                                                    ? colors.success
                                                    : balance < 0
                                                        ? colors.destructive
                                                        : colors.foreground
                                            }
                                        ]}>
                                            {balance < 0 ? '-' : balance > 0 ? '+' : ''}₹{Math.abs(balance).toFixed(0)}
                                        </Text>
                                        <Pressable
                                            style={{ flex: 0.4, alignItems: 'center', justifyContent: 'center' }}
                                            onPress={async () => {
                                                if (!isPrinterConnected) {
                                                    notifyPrinterDisconnected();
                                                    return;
                                                }
                                                try {
                                                    const tRow = getThermalSlipLabels();
                                                    let payload = '';
                                                    payload += brandedHeader({
                                                        dairyName: topPrintSettings?.dairyName || tRow.memberBalanceReport,
                                                        address: topPrintSettings?.address || '',
                                                        mobileNumber: topPrintSettings?.mobileNumber || '',
                                                        showMobileOnReceipt: topPrintSettings?.showMobileOnReceipt !== false,
                                                    });
                                                    payload += fmtCenter(tRow.memberBalanceReport, { bold: true });
                                                    payload += fmtLine();
                                                    payload += fmtLeft(member.name);
                                                    payload += twoCol(`${tRow.date}:`, formatDateDDMMYYYY(member.date));
                                                    payload += twoCol(`${tRow.till}:`, member.lastPeriodEnd ? formatDateDDMMYYYY(member.lastPeriodEnd) : '-');
                                                    payload += twoCol(`${tRow.balance}:`, `${balance < 0 ? '-' : balance > 0 ? '+' : ''}Rs ${Math.abs(balance).toFixed(0)}`, { bold: true });
                                                    payload += brandedFooter(topPrintSettings?.extraInfo?.trim());
                                                    await printText(payload);
                                                } catch (error) {
                                                    showAlert('Error', 'Failed to print');
                                                }
                                            }}
                                        >
                                            <Printer size={13} color={colors.primary} />
                                        </Pressable>
                                    </View>
  );
}
