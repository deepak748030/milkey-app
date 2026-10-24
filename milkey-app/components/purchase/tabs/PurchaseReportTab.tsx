import React from 'react';
import { View, Text, Pressable, TextInput, FlatList, ActivityIndicator, ScrollView, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { User, ChevronDown, X, FileText, Printer, Download, Calendar as CalendarIcon, Search, Check, Droplets } from 'lucide-react-native';
import { DateRangePicker } from '@/components/DateRangePicker';

// Ponytail reusable — single source, no duplication, no UI change
export function PurchaseReportTab(props:any){
  const { s, colors, t, isDark, selectedReportFarmer, reportFarmerFilter, setReportFarmerFilter, reportStartDate, reportEndDate, setReportStartDate, setReportEndDate, filteredReportTotals, filteredReportCollections, reportLoading, reportCollections, reportTotalCount, reportFarmerCodeSearch, setReportFarmerCodeSearch, customers, setShowReportFarmerModal, showReportFarmerModal, handleReportBatchPrint, handleFullSummaryPrint, handleShortSummaryPrint, handleExportReportPdf, setPrintSource, isPrinting, formatDateStr, formatDate } = (props as any).ctx || props;
  return (
        <View>
            {/* Farmer Picker */}
            <Pressable style={s.reportFarmerPicker} onPress={() => setShowReportFarmerModal(true)}>
                <User size={16} color={colors.primary} />
                <Text style={s.reportFarmerText} numberOfLines={1}>
                    {selectedReportFarmer ? `${selectedReportFarmer.code} - ${selectedReportFarmer.name}` : 'Enter farmer code'}
                </Text>
                {reportFarmerFilter ? (
                    <Pressable onPress={() => setReportFarmerFilter('')} hitSlop={6}>
                        <X size={14} color={colors.destructive} />
                    </Pressable>
                ) : (
                    <ChevronDown size={16} color={colors.mutedForeground} />
                )}
            </Pressable>

            {/* Date Range Selector */}
            <DateRangePicker
                startDate={reportStartDate || null}
                endDate={reportEndDate || null}
                onStartDateChange={setReportStartDate}
                onEndDateChange={setReportEndDate}
            />

            {/* Report Summary */}
            {reportStartDate && reportEndDate && (
                <View style={s.reportSummaryCard}>
                    <View style={s.reportSummaryRow}>
                        <View style={s.reportSummaryItem}>
                            <Text style={s.reportSummaryLabel}>Total Qty</Text>
                            <Text style={s.reportSummaryValue}>{filteredReportTotals.quantity.toFixed(1)} L</Text>
                        </View>
                        <View style={s.reportSummaryDivider} />
                        <View style={s.reportSummaryItem}>
                            <Text style={s.reportSummaryLabel}>Avg Rate</Text>
                            <Text style={s.reportSummaryValue}>₹{filteredReportTotals.quantity > 0 ? (filteredReportTotals.amount / filteredReportTotals.quantity).toFixed(1) : '0'}</Text>
                        </View>
                        <View style={s.reportSummaryDivider} />
                        <View style={s.reportSummaryItem}>
                            <Text style={s.reportSummaryLabel}>Total Amt</Text>
                            <Text style={[s.reportSummaryValue, { color: colors.primary }]}>₹{filteredReportTotals.amount.toFixed(0)}</Text>
                        </View>
                    </View>
                </View>
            )}

            {/* Print & Export Buttons */}
            <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable
                    style={[s.exportReportBtn, { flex: 1, backgroundColor: colors.primary }, isPrinting && { opacity: 0.6 }]}
                    onPress={() => {
                        setPrintSource('report');
                        if (!reportFarmerFilter) {
                            handleReportBatchPrint('full');
                        } else {
                            handleFullSummaryPrint('report');
                        }
                    }}
                    disabled={isPrinting}
                >
                    {isPrinting ? <ActivityIndicator size={16} color="#fff" /> : <FileText size={16} color="#fff" />}
                    <Text style={s.exportReportBtnText}>Full Summary</Text>
                </Pressable>
                <Pressable
                    style={[s.exportReportBtn, { flex: 1, backgroundColor: '#f59e0b' }, isPrinting && { opacity: 0.6 }]}
                    onPress={() => {
                        setPrintSource('report');
                        if (!reportFarmerFilter) {
                            handleReportBatchPrint('short');
                        } else {
                            handleShortSummaryPrint('report');
                        }
                    }}
                    disabled={isPrinting}
                >
                    {isPrinting ? <ActivityIndicator size={16} color="#fff" /> : <Printer size={16} color="#fff" />}
                    <Text style={s.exportReportBtnText}>Short Summary</Text>
                </Pressable>
            </View>
            <Pressable style={[s.exportReportBtn, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]} onPress={handleExportReportPdf}>
                <Download size={16} color={colors.primary} />
                <Text style={[s.exportReportBtnText, { color: colors.foreground }]}>Download PDF</Text>
            </Pressable>

            {/* Row-cap note: the totals above always cover the full range, the table
                below renders the newest rows (capped) — say so instead of staying silent */}
            {!reportLoading && reportStartDate && reportEndDate && reportTotalCount > reportCollections.length && (
                <Text style={s.reportCapNote}>
                    Showing latest {reportCollections.length} of {reportTotalCount} entries — select a smaller date range to see older entries.
                </Text>
            )}

            {/* Report Table */}
            {reportLoading ? (
                <View style={s.emptyBox}><ActivityIndicator color={colors.primary} /></View>
            ) : filteredReportCollections.length === 0 && reportStartDate && reportEndDate ? (
                <View style={s.emptyBox}>
                    <Droplets size={24} color={colors.border} />
                    <Text style={s.emptyText}>No data for selected period</Text>
                </View>
            ) : !reportStartDate || !reportEndDate ? (
                <View style={s.emptyBox}>
                    <CalendarIcon size={24} color={colors.border} />
                    <Text style={s.emptyText}>Select date range to view report</Text>
                </View>
            ) : (
                <View style={s.tableWrap}>
                    <View style={s.tHead}>
                        <Text style={[s.tHeadText, s.entryCell1]}>{t.common.code}</Text>
                        <Text style={[s.tHeadText, { flex: 0.7, textAlign: 'center' }]}>Date/S</Text>
                        <Text style={[s.tHeadText, s.entryCell2]}>{t.purchase.milk}</Text>
                        <Text style={[s.tHeadText, s.entryCell2]}>{t.purchase.fat}</Text>
                        <Text style={[s.tHeadText, s.entryCell2]}>{t.purchase.snf}</Text>
                        <Text style={[s.tHeadText, s.entryCell2]}>{t.common.rate}</Text>
                        <Text style={[s.tHeadText, s.entryCell3]}>{t.purchase.amt}</Text>
                    </View>
                    {filteredReportCollections.map((item, index) => {
                        const d = new Date(item.date);
                        const dateStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
                        const shiftLetter = item.shift === 'morning' ? 'M' : item.shift === 'evening' ? 'E' : '';
                        const dateLabel = shiftLetter ? `${dateStr}-${shiftLetter}` : dateStr;
                        return (
                            <View key={item._id} style={[s.entryRow, index % 2 !== 0 && { backgroundColor: isDark ? colors.muted + '30' : '#f8fafc' }]}>
                                <View style={[s.entryCell1, { alignItems: 'center' }]}>
                                    <Text style={[s.entryCellText, { color: colors.primary, fontWeight: '700', textAlign: 'center' }]}>{item.farmerCode || '-'}</Text>
                                    <Text style={[s.entrySubText, { textAlign: 'center' }]} numberOfLines={1}>{item.purchaseFarmer?.name || ''}</Text>
                                </View>
                                <Text style={[s.entryCellText, { flex: 0.7, textAlign: 'center', fontSize: 9 }]}>{dateLabel}</Text>
                                <Text style={[s.entryCellText, s.entryCell2, { textAlign: 'center' }]}>{item.quantity}</Text>
                                <Text style={[s.entryCellText, s.entryCell2, { textAlign: 'center' }]}>{item.fat || '-'}</Text>
                                <Text style={[s.entryCellText, s.entryCell2, { textAlign: 'center' }]}>{(item as any).snf || '-'}</Text>
                                <Text style={[s.entryCellText, s.entryCell2, { textAlign: 'center' }]}>{item.rate}</Text>
                                <Text style={[s.entryCellText, s.entryCell3, { color: colors.primary, fontWeight: '700', textAlign: 'center' }]}>₹{item.amount.toFixed(0)}</Text>
                            </View>
                        );
                    })}
                    <View style={s.tFootRow}>
                        <Text style={[s.tFootText, s.entryCell1]}>{t.common.total} ({filteredReportCollections.length})</Text>
                        <Text style={[s.tFootText, { flex: 0.7 }]}></Text>
                        <Text style={[s.tFootText, s.entryCell2]}>{filteredReportTotals.quantity.toFixed(1)}</Text>
                        <Text style={[s.tFootText, s.entryCell2]}></Text>
                        <Text style={[s.tFootText, s.entryCell2]}></Text>
                        <Text style={[s.tFootText, s.entryCell2]}></Text>
                        <Text style={[s.tFootText, s.entryCell3, { color: colors.primary }]}>₹{filteredReportTotals.amount.toFixed(0)}</Text>
                    </View>
                </View>
            )}

            {/* Report Farmer Select Modal */}
            <Modal visible={showReportFarmerModal} animationType="slide" transparent onRequestClose={() => setShowReportFarmerModal(false)}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                    <View style={s.modalOverlay}>
                        <Pressable style={{ flex: 1 }} onPress={() => setShowReportFarmerModal(false)} />
                        <View style={[s.modalSheet, { maxHeight: '85%' }]}>
                            <View style={s.modalHandle} />
                            <View style={s.modalHeader}>
                                <Text style={s.modalTitle}>Select Farmer for Report</Text>
                                <Pressable onPress={() => setShowReportFarmerModal(false)}><X size={18} color={colors.foreground} /></Pressable>
                            </View>

                            {/* Code-only search input */}
                            <View style={s.searchRow}>
                                <Search size={14} color={colors.mutedForeground} />
                                <TextInput
                                    style={s.searchInput}
                                    value={reportFarmerCodeSearch}
                                    onChangeText={(v) => setReportFarmerCodeSearch(v.replace(/\s/g, '').toUpperCase())}
                                    placeholder="Enter farmer code"
                                    placeholderTextColor={colors.mutedForeground}
                                    autoCapitalize="characters"
                                    keyboardType="default"
                                    returnKeyType="search"
                                    autoFocus
                                    onSubmitEditing={() => {
                                        const q = reportFarmerCodeSearch.trim();
                                        if (!q) return;
                                        const match = customers.find(c => String(c.code).toUpperCase() === q);
                                        if (match) {
                                            setReportFarmerFilter(match._id);
                                            setReportFarmerCodeSearch('');
                                            setShowReportFarmerModal(false);
                                        }
                                    }}
                                />
                                {reportFarmerCodeSearch.length > 0 && (
                                    <Pressable onPress={() => setReportFarmerCodeSearch('')} hitSlop={8}>
                                        <X size={14} color={colors.mutedForeground} />
                                    </Pressable>
                                )}
                            </View>

                            <FlatList
                                data={
                                    reportFarmerCodeSearch.trim()
                                        ? customers.filter(c => String(c.code).toUpperCase().includes(reportFarmerCodeSearch.trim()))
                                        : customers
                                }
                                keyExtractor={item => item._id}
                                keyboardShouldPersistTaps="handled"
                                renderItem={({ item }) => (
                                    <Pressable
                                        style={[s.custListItem, { paddingHorizontal: 12 }]}
                                        onPress={() => {
                                            setReportFarmerFilter(item._id);
                                            setReportFarmerCodeSearch('');
                                            setShowReportFarmerModal(false);
                                        }}
                                    >
                                        <View style={s.custListAvatar}>
                                            <Text style={s.custListAvatarText}>{item.code}</Text>
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={s.custListName}>{item.name}</Text>
                                            {item.mobile ? <Text style={s.custListSub}>{item.mobile}</Text> : null}
                                        </View>
                                        {(reportFarmerFilter === item._id || reportFarmerFilter === item.code) && <Check size={16} color={colors.primary} />}
                                    </Pressable>
                                )}
                                ListEmptyComponent={
                                    <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                                        <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                                            {reportFarmerCodeSearch ? 'No farmer with this code' : 'No farmers'}
                                        </Text>
                                    </View>
                                }
                                contentContainerStyle={{ paddingHorizontal: 6, paddingBottom: 24 }}
                                showsVerticalScrollIndicator={false}
                            />
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </View>
  );
}
