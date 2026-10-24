import React from 'react';
import { View, Text, Pressable, TextInput, FlatList, ActivityIndicator } from 'react-native';
import { Search, X, Plus, User, Edit2, Trash2, FileText, Printer } from 'lucide-react-native';

// Ponytail reusable — single source, no duplication, no UI change
export function SellingCustomerTab(props:any){
  const { s, styles, colors, t, isDark, entryDate, setShowBulkEntryModal, renderSuggestionDropdown, formatDate, openDatePicker, searchMember, setSearchMember, selectedMember, setSelectedMember, setShowSuggestions, showSuggestions, mornQty, setMornQty, eveQty, setEveQty, rate, setRate, amount, handleSaveEntry, savingEntry, groupedEntries, setEditingEntry, setShowEditModal, handleDeleteEntry, deletingId, recentEntriesStartDate, setRecentEntriesStartDate, recentEntriesEndDate, setRecentEntriesEndDate, formatDate, filteredRecentMembers, recentEntriesMemberFilter, setRecentEntriesMemberFilter, showRecentMemberDropdown, setShowRecentMemberDropdown, recentMemberSearch, setRecentMemberSearch, selectedRecentMemberName, handleEntriesPDF, handlePrintEntries, hasMoreEntries, handleLoadMore, loadingMore, previousBalance, currentMilkAmount, paidAmount, netPayable, closingBalance, paymentMemberSearch, setPaymentMemberSearch, selectedPaymentMember, setSelectedPaymentMember, memberSummary, setMemberSummary, showPaymentMemberSuggestions, setShowPaymentMemberSuggestions, filteredPaymentMembers, milkAmount, setMilkAmount, paymentAmount, setPaymentAmount, paymentMethod, setPaymentMethod, handleAddPayment, savingPayment, payments, handleDeletePayment, handleExportPaymentPdf, handlePrintPayment, filteredReportData, reportSummary, handlePrintReport, handleExportCsv, members, memberSearch, setMemberSearch, handleAddMember, handleEditMember, handleDeleteMember, setShowAddMemberModal, setEditingMember, setSelectedMemberForPayments, setShowMemberPaymentsModal } = (props as any).ctx || props;
  return (
        <View>
            <View style={styles.memberHeader}>
                <View style={styles.memberSearchContainer}>
                    <Search size={16} color={colors.mutedForeground} />
                    <TextInput
                        style={styles.memberTabSearchInput}
                        placeholder="Search members..."
                        placeholderTextColor={colors.mutedForeground}
                        value={memberTabSearch}
                        onChangeText={handleMemberTabSearch}
                    />
                    {memberSearchLoading && (
                        <ActivityIndicator size="small" color={colors.primary} />
                    )}
                </View>
                <View style={styles.memberHeaderBtns}>
                    <Pressable style={styles.printMemberBtn} onPress={downloadMembersPDF}>
                        <FileText size={14} color={colors.primary} />
                        <Text style={styles.printMemberText}>PDF</Text>
                    </Pressable>
                    <Pressable style={styles.printMemberBtn} onPress={handlePrintMembers}>
                        <Printer size={14} color={colors.primary} />
                        <Text style={styles.printMemberText}>Print</Text>
                    </Pressable>
                    <Pressable
                        style={styles.addMemberBtn}
                        onPress={() => {
                            clearMemberForm();
                            setShowMemberModal(true);
                        }}
                    >
                        <Plus size={14} color={colors.white} />
                        <Text style={styles.addMemberBtnText}>Add</Text>
                    </Pressable>
                </View>
            </View>

            <Text style={[styles.sectionTitle, { marginTop: 4, fontSize: 13 }]}>Members List ({members.filter(m => m.isActive !== false).length} active, {members.filter(m => m.isActive === false).length} inactive)</Text>

            {members.length === 0 ? (
                <Text style={styles.emptyText}>No members yet. Add your first member.</Text>
            ) : (
                <View style={styles.table}>
                    <View style={styles.tableHeader}>
                        <Text style={[styles.tableHeaderCell, { flex: 0.6 }]}>Rate</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>Name</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Mobile</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 0.65 }]}>Bulk Entry</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 0.6 }]}>Actions</Text>
                    </View>
                    {members.map((item) => {
                        const isInactive = item.isActive === false;
                        return (
                            <View key={item._id} style={[styles.tableRow, isInactive && { opacity: 0.45 }]}>
                                <Text style={[styles.tableCell, { flex: 0.6 }]}>₹{item.ratePerLiter}</Text>
                                <View style={{ flex: 1.2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                                    <Text style={[styles.tableCell]}>{item.name}</Text>
                                    {isInactive && (
                                        <View style={{ backgroundColor: colors.mutedForeground, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 }}>
                                            <Text style={{ fontSize: 8, color: colors.white, fontWeight: '700' }}>Off</Text>
                                        </View>
                                    )}
                                </View>
                                <Text style={[styles.tableCell, { flex: 1 }]}>{item.mobile}</Text>
                                <View style={{ flex: 0.65, alignItems: 'center', justifyContent: 'center' }}>
                                    {item.dailyAutoEntry ? (
                                        <Check size={14} color={colors.success} strokeWidth={3} />
                                    ) : null}
                                </View>
                                <View style={{ flex: 0.6, flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
                                    <Pressable style={styles.editBtn} onPress={() => handleEditMember(item)}>
                                        <Edit2 size={12} color={colors.primary} />
                                    </Pressable>
                                    {!isInactive && (
                                        <Pressable style={styles.deleteBtn} onPress={() => handleDeleteMember(item._id)}>
                                            <Trash2 size={12} color={colors.destructive} />
                                        </Pressable>
                                    )}
                                </View>
                            </View>
  );
}
