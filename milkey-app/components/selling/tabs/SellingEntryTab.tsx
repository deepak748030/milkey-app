import React, { useState, useMemo } from 'react';
import { View, Text, Pressable, TextInput, ActivityIndicator, ScrollView, Modal } from 'react-native';
import { Calendar as CalendarIcon, Search, Trash2, FileText, Printer, Edit2, DollarSign, User, X, Zap, Check } from 'lucide-react-native';
import { DateRangePicker } from '@/components/DateRangePicker';
import AmountFilterIcon from '@/components/AmountFilterIcon';

// Ponytail reusable — single source, no duplication, no UI change
export function SellingEntryTab(props:any){
  const { s, styles, colors, t, isDark, entryDate, setShowBulkEntryModal, renderSuggestionDropdown, formatDate, openDatePicker, searchMember, setSearchMember, selectedMember, setSelectedMember, setShowSuggestions, showSuggestions, mornQty, setMornQty, eveQty, setEveQty, rate, setRate, amount, handleSaveEntry, savingEntry, groupedEntries, setEditingEntry, setShowEditModal, handleDeleteEntry, deletingId, recentEntriesStartDate, setRecentEntriesStartDate, recentEntriesEndDate, setRecentEntriesEndDate, formatDate, filteredRecentMembers, recentEntriesMemberFilter, setRecentEntriesMemberFilter, showRecentMemberDropdown, setShowRecentMemberDropdown, recentMemberSearch, setRecentMemberSearch, selectedRecentMemberName, handleEntriesPDF, handlePrintEntries, hasMoreEntries, handleLoadMore, loadingMore, previousBalance, currentMilkAmount, paidAmount, netPayable, closingBalance, paymentMemberSearch, setPaymentMemberSearch, selectedPaymentMember, setSelectedPaymentMember, memberSummary, setMemberSummary, showPaymentMemberSuggestions, setShowPaymentMemberSuggestions, filteredPaymentMembers, milkAmount, setMilkAmount, paymentAmount, setPaymentAmount, paymentMethod, setPaymentMethod, handleAddPayment, savingPayment, payments, handleDeletePayment, handleExportPaymentPdf, handlePrintPayment, filteredReportData, reportSummary, handlePrintReport, handleExportCsv, members, memberSearch, setMemberSearch, handleAddMember, handleEditMember, handleDeleteMember, setShowAddMemberModal, setEditingMember, setSelectedMemberForPayments, setShowMemberPaymentsModal } = (props as any).ctx || props;
  const [amountSort, setAmountSort] = useState<'asc' | 'desc' | null>(null);
  const toggleSort = () => setAmountSort((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  const displayEntries = useMemo(() => {
    if (!amountSort) return groupedEntries;
    const arr = [...(groupedEntries || [])];
    arr.sort((a: any, b: any) => {
      const av = Number(a.totalAmount) || 0;
      const bv = Number(b.totalAmount) || 0;
      return amountSort === 'asc' ? av - bv : bv - av;
    });
    return arr;
  }, [groupedEntries, amountSort]);
  return (
        <View>
            <View style={styles.entryHeaderRow}>
                <Text style={styles.sectionTitle}>Milk Selling Entry</Text>
                <Pressable style={styles.bulkEntryBtn} onPress={() => setShowBulkEntryModal(true)}>
                    <Zap size={14} color={colors.white} />
                    <Text style={styles.bulkEntryBtnText}>Bulk Entry</Text>
                </Pressable>
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>Member (Customer)</Text>
                <Pressable
                    style={styles.searchInput}
                    onPress={() => setShowSuggestions(true)}
                >
                    <Search size={16} color={colors.mutedForeground} />
                    <TextInput
                        style={styles.searchTextInput}
                        placeholder="Search member by name..."
                        value={searchMember}
                        onChangeText={(text) => {
                            setSearchMember(text);
                            setShowSuggestions(true);
                            if (selectedMember) setSelectedMember(null);
                        }}
                        onFocus={() => setShowSuggestions(true)}
                        placeholderTextColor={colors.mutedForeground}
                    />
                    {selectedMember && (
                        <View style={styles.selectedBadge}>
                            <Check size={12} color={colors.white} />
                        </View>
                    )}
                    {(selectedMember || showSuggestions) && (
                        <Pressable onPress={() => {
                            setShowSuggestions(false);
                            if (selectedMember) {
                                setSelectedMember(null);
                                setSearchMember('');
                            }
                        }}>
                            <X size={16} color={colors.destructive} />
                        </Pressable>
                    )}
                </Pressable>
                {renderSuggestionDropdown()}
            </View>

            <View style={styles.row}>
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Date</Text>
                    <Pressable style={styles.dateInput} onPress={() => openDatePicker('entry')}>
                        <Text style={styles.dateText}>{formatDate(entryDate)}</Text>
                        <CalendarIcon size={16} color={colors.mutedForeground} />
                    </Pressable>
                </View>
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Morn (L)</Text>
                    <TextInput
                        style={styles.input}
                        value={mornQty}
                        onChangeText={setMornQty}
                        keyboardType="decimal-pad"
                        placeholder="0"
                        placeholderTextColor={colors.mutedForeground}
                    />
                </View>
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Eve (L)</Text>
                    <TextInput
                        style={styles.input}
                        value={eveQty}
                        onChangeText={setEveQty}
                        keyboardType="decimal-pad"
                        placeholder="0"
                        placeholderTextColor={colors.mutedForeground}
                    />
                </View>
            </View>

            {/* Rate row - shows member's default rate; tap to override for this entry only */}
            {selectedMember && (
                <View style={styles.rateRow}>
                    <Text style={styles.rateLabel}>Rate (₹/L)</Text>
                    <Pressable
                        style={styles.rateInputWrap}
                        onPress={() => setRate('')}
                    >
                        <TextInput
                            style={styles.rateInput}
                            value={rate}
                            onChangeText={setRate}
                            onFocus={() => setRate('')}
                            onBlur={() => {
                                if (!rate || parseFloat(rate) <= 0) {
                                    setRate(selectedMember.ratePerLiter?.toString() || '50');
                                }
                            }}
                            keyboardType="decimal-pad"
                            placeholder={(selectedMember.ratePerLiter ?? 50).toString()}
                            placeholderTextColor={colors.mutedForeground}
                            selectTextOnFocus
                        />
                        <Text style={styles.rateHint}>
                            Default ₹{selectedMember.ratePerLiter}/L · tap to change today only
                        </Text>
                    </Pressable>
                </View>
            )}

            <View style={styles.totalRow}>
                <View style={styles.totalBox}>
                    <Text style={styles.totalValue}>₹{totalAmount.toFixed(2)}</Text>
                </View>
                <View style={styles.buttonRow}>
                    <Pressable
                        style={[styles.saveBtn, savingEntry && styles.saveBtnDisabled]}
                        onPress={handleSaveEntry}
                        disabled={savingEntry}
                    >
                        {savingEntry ? (
                            <ActivityIndicator size="small" color={colors.white} />
                        ) : (
                            <Text style={styles.saveBtnText}>Save Entry</Text>
                        )}
                    </Pressable>
                    <Pressable style={styles.clearBtn} onPress={() => {
                        setMornQty('');
                        setEveQty('');
                        setSelectedMember(null);
                        setSearchMember('');
                    }} disabled={savingEntry}>
                        <Text style={styles.clearBtnText}>Clear</Text>
                    </Pressable>
                </View>
            </View>

            {/* Recent Entries Section */}
            <View style={styles.entriesHeader}>
                <Text style={styles.sectionTitle}>Recent Entries</Text>
            </View>

            {/* Recent Entries Filters */}
            <View style={styles.recentFiltersCard}>
                {/* Date Range - From/To selectors */}
                <DateRangePicker
                    startDate={recentEntriesStartDate || null}
                    endDate={recentEntriesEndDate || null}
                    onStartDateChange={setRecentEntriesStartDate}
                    onEndDateChange={setRecentEntriesEndDate}
                    formatDate={formatDate}
                />

                <View style={styles.recentFiltersRow}>
                    {/* Member Filter */}
                    <View style={{ flex: 1, position: 'relative' }}>
                        {showRecentMemberDropdown ? (
                            <View style={styles.recentMemberFilter}>
                                <Search size={14} color={colors.mutedForeground} />
                                <TextInput
                                    style={[styles.memberSearchInput, { flex: 1 }]}
                                    placeholder="Search member..."
                                    value={recentMemberSearch}
                                    onChangeText={setRecentMemberSearch}
                                    placeholderTextColor={colors.mutedForeground}
                                    autoFocus
                                />
                                <Pressable onPress={() => { setShowRecentMemberDropdown(false); setRecentMemberSearch(''); }}>
                                    <X size={14} color={colors.mutedForeground} />
                                </Pressable>
                            </View>
                        ) : (
                            <Pressable
                                style={styles.recentMemberFilter}
                                onPress={() => setShowRecentMemberDropdown(true)}
                            >
                                <User size={14} color={colors.mutedForeground} />
                                <Text style={styles.recentFilterText} numberOfLines={1}>
                                    {selectedRecentMemberName}
                                </Text>
                            </Pressable>
                        )}

                        {showRecentMemberDropdown && (
                            <View style={styles.recentMemberDropdown}>
                                <ScrollView style={{ maxHeight: 150 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                                    <Pressable
                                        style={[styles.memberDropdownItem, !recentEntriesMemberFilter && styles.memberDropdownItemActive]}
                                        onPress={() => {
                                            setRecentEntriesMemberFilter('');
                                            setShowRecentMemberDropdown(false);
                                            setRecentMemberSearch('');
                                        }}
                                    >
                                        <Text style={[styles.memberDropdownText, !recentEntriesMemberFilter && { color: colors.primary }]}>All Members</Text>
                                    </Pressable>
                                    {filteredRecentMembers.map(member => (
                                        <Pressable
                                            key={member._id}
                                            style={[styles.memberDropdownItem, recentEntriesMemberFilter === member._id && styles.memberDropdownItemActive]}
                                            onPress={() => {
                                                setRecentEntriesMemberFilter(member._id);
                                                setShowRecentMemberDropdown(false);
                                                setRecentMemberSearch('');
                                            }}
                                        >
                                            <Text style={[styles.memberDropdownText, recentEntriesMemberFilter === member._id && { color: colors.primary }]}>{member.name}</Text>
                                        </Pressable>
                                    ))}
                                </ScrollView>
                            </View>
                        )}
                    </View>

                    {/* Print Button */}
                    <Pressable
                        style={[styles.printEntriesBtn, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.primary }]}
                        onPress={handleEntriesPDF}
                    >
                        <FileText size={14} color={colors.primary} />
                        <Text style={[styles.printEntriesBtnText, { color: colors.primary }]}>PDF</Text>
                    </Pressable>
                    <Pressable
                        style={styles.printEntriesBtn}
                        onPress={handlePrintEntries}
                    >
                        <Printer size={14} color={colors.white} />
                        <Text style={styles.printEntriesBtnText}>Print</Text>
                    </Pressable>
                    <AmountFilterIcon sort={amountSort} onToggle={toggleSort} />

                    {/* Clear Filters Button */}
                    {(recentEntriesStartDate || recentEntriesEndDate || recentEntriesMemberFilter) && (
                        <Pressable
                            style={styles.clearFiltersBtn}
                            onPress={() => {
                                setRecentEntriesStartDate('');
                                setRecentEntriesEndDate('');
                                setRecentEntriesMemberFilter('');
                            }}
                        >
                            <X size={14} color={colors.destructive} />
                            <Text style={styles.clearFiltersBtnText}>Clear</Text>
                        </Pressable>
                    )}
                </View>
            </View>

            {displayEntries.length === 0 ? (
                <Text style={styles.emptyText}>No entries found</Text>
            ) : (
                <View style={styles.table}>
                    <View style={styles.tableHeader}>
                        <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Date</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>Name</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 0.5 }]}>Entry</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 1 }]}>M/E (L)</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 0.8 }]}>Amt</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 0.5 }]}>Act</Text>
                    </View>
                    {displayEntries.map((item, index) => (
                        <View key={`${item.date}-${item.memberId}-${index}`} style={styles.tableRow}>
                            <Text style={[styles.tableCell, { flex: 1 }]}>{formatDate(item.date)}</Text>
                            <Text style={[styles.tableCell, { flex: 1.2 }]} numberOfLines={1}>{item.memberName}</Text>
                            <Text style={[styles.tableCell, { flex: 0.5, textAlign: 'center', color: colors.primary, fontWeight: '600' }]}>{item.entryCount}</Text>
                            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                                <Text style={styles.meText}>
                                    {item.morningQty > 0 ? item.morningQty : '-'} + {item.eveningQty > 0 ? item.eveningQty : '-'}
                                </Text>
                            </View>
                            <Text style={[styles.tableCell, { flex: 0.8, color: colors.primary, fontWeight: '600' }]}>₹{item.totalAmount.toFixed(0)}</Text>
                            <View style={{ flex: 0.5, alignItems: 'center', justifyContent: 'center' }}>
                                <Pressable style={styles.deleteBtn} onPress={() => handleDeleteEntry(item.entryId)}>
                                    <Trash2 size={12} color={colors.destructive} />
                                </Pressable>
                            </View>
                        </View>
                    ))}

                    {hasMoreEntries && (
                        <Pressable
                            style={styles.loadMoreBtn}
                            onPress={handleLoadMore}
                            disabled={loadingMore}
                        >
                            {loadingMore ? (
                                <ActivityIndicator size="small" color={colors.primary} />
                            ) : (
                                <Text style={styles.loadMoreText}>Load More</Text>
                            )}
                        </Pressable>
                    )}
                </View>
            )}
        </View>
  );
}
