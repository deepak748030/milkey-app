import React from 'react';
import { View, Text, Pressable, TextInput, ActivityIndicator, FlatList } from 'react-native';
import { Search, X, Plus, Trash2 } from 'lucide-react-native';

// Ponytail reusable — single source, no duplication, no UI change
export function RegisterAdvancesTab(props:any){
  const { s, styles, colors, t, isDark, customers, setSelectedCustomer, customerSearch, setCustomerSearch, reportStartDate, reportEndDate, setReportStartDate, setReportEndDate, filteredReportCollections, reportSummary, handlePrintReport, handleExportCsv, farmerSearch, setFarmerSearch, setShowAddFarmerModal, setEditingFarmer, handleEditFarmer, handleDeleteFarmer, advances, setSelectedAdvance, advanceSearch, setAdvanceSearch, handleAddAdvance, handleEditAdvance, handleDeleteAdvance } = (props as any).ctx || props;
  return (
        <View>
            <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 0.4 }]}>
                    <Text style={styles.label}>Code</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Code"
                        value={advCode}
                        onChangeText={handleAdvCodeChange}
                        keyboardType="number-pad"
                        placeholderTextColor={colors.mutedForeground}
                    />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.label}>Name</Text>
                    <TextInput
                        style={[styles.input, { backgroundColor: colors.muted }]}
                        placeholder="Name (auto-filled)"
                        value={advName}
                        editable={false}
                        placeholderTextColor={colors.mutedForeground}
                    />
                </View>
            </View>

            <View style={styles.row}>
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Amount</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Amount"
                        value={advAmount}
                        onChangeText={setAdvAmount}
                        keyboardType="numeric"
                        placeholderTextColor={colors.mutedForeground}
                    />
                </View>
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Date</Text>
                    <Pressable
                        style={styles.dateInputWrapper}
                        onPress={() => {
                            setTempCalendarDate(advDate ? new Date(advDate + 'T00:00:00') : new Date());
                            setShowAdvDatePicker(true);
                        }}
                    >
                        <Text style={[styles.dateInputText, !advDate && { color: colors.mutedForeground }]}>
                            {advDate ? formatDateDDMMYYYY(advDate) : 'Select Date'}
                        </Text>
                        <CalendarIcon size={16} color={colors.mutedForeground} />
                    </Pressable>
                </View>
            </View>

            {/* Advance Date Picker Modal */}
            <Modal
                visible={showAdvDatePicker}
                transparent
                animationType="slide"
                onRequestClose={() => setShowAdvDatePicker(false)}
            >
                <View style={styles.dateModalOverlay}>
                    <Pressable style={{ flex: 1 }} onPress={() => setShowAdvDatePicker(false)} />
                    <View style={[styles.dateModalContent, { backgroundColor: colors.card }]}>
                        <View style={styles.dateModalHeader}>
                            <Text style={[styles.dateModalTitle, { color: colors.foreground }]}>Select Advance Date</Text>
                            <Pressable onPress={() => setShowAdvDatePicker(false)} style={styles.dateModalClose}>
                                <X size={20} color={colors.foreground} />
                            </Pressable>
                        </View>
                        <Calendar
                            onDateSelect={(date) => {
                                if (date) {
                                    const year = date.getFullYear();
                                    const month = String(date.getMonth() + 1).padStart(2, '0');
                                    const day = String(date.getDate()).padStart(2, '0');
                                    setAdvDate(`${year}-${month}-${day}`);
                                    setShowAdvDatePicker(false);
                                }
                            }}
                            selectedDate={tempCalendarDate}
                        />
                    </View>
                </View>
            </Modal>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>Note</Text>
                <TextInput
                    style={styles.input}
                    placeholder="Note (e.g. Ghee, Cash)"
                    value={advNote}
                    onChangeText={setAdvNote}
                    placeholderTextColor={colors.mutedForeground}
                />
            </View>

            <View style={styles.buttonRow}>
                <Pressable style={styles.saveBtn} onPress={handleAddAdvance} disabled={loading}>
                    <Text style={styles.saveBtnText}>{loading ? 'Saving...' : 'Save Advance'}</Text>
                </Pressable>
                <Pressable style={styles.clearBtn} onPress={clearAdvanceForm}>
                    <Text style={styles.clearBtnText}>Clear</Text>
                </Pressable>
            </View>

            {/* Search bar and PDF button */}
            <View style={styles.advanceSearchRow}>
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 6, paddingHorizontal: 10 }}>
                    <Search size={16} color={colors.mutedForeground} />
                    <TextInput
                        style={[styles.advanceSearchInput, { borderWidth: 0, backgroundColor: 'transparent', marginLeft: 8 }]}
                        placeholder="Search by exact code"
                        value={advanceSearch}
                        onChangeText={setAdvanceSearch}
                        keyboardType="numeric"
                        placeholderTextColor={colors.mutedForeground}
                    />
                </View>
                <Pressable style={styles.advancePdfBtn} onPress={generateAdvancesPDF}>
                    <FileText size={14} color={colors.white} />
                    <Text style={styles.advancePdfBtnText}>PDF</Text>
                </Pressable>
                <Pressable style={[styles.advancePdfBtn, { backgroundColor: colors.primary }]} onPress={printAdvancesThermal}>
                    <Printer size={14} color={colors.white} />
                    <Text style={styles.advancePdfBtnText}>Print</Text>
                </Pressable>
            </View>

            {/* Total Amount Header */}
            {advances.length > 0 && (
                <View style={styles.totalAmountHeader}>
                    <Text style={styles.totalAmountLabel}>Total Amount</Text>
                    <Text style={styles.totalAmountValue}>₹{totalPendingAmount.toLocaleString('en-IN')}</Text>
                </View>
            )}

            {/* Advances Table */}
            {advances.length > 0 ? (
                <View style={styles.table}>
                    <View style={styles.tableHeader}>
                        <Text style={[styles.tableHeaderCell, { flex: 0.5 }]}>Code</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 1.3 }]}>Name</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 0.9 }]}>Note</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 0.7 }]}>Amt</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 0.9 }]}>Date</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 0.5 }]}>Del</Text>
                    </View>
                    {advances.map((item) => {
                        // Only show cross-line for advances that are settled or partial (used in payments)
                        const isUsedInPayment = item.status === 'settled' || item.status === 'partial';
                        return (
                            <View key={item._id} style={[styles.tableRow, isUsedInPayment && styles.settledRow]}>
                                <Text style={[styles.tableCell, { flex: 0.5, color: colors.primary, textAlign: 'center' }]}>{item.farmer?.code}</Text>
                                <Text style={[styles.tableCell, { flex: 1.3, textAlign: 'center' }]}>{item.farmer?.name || '-'}</Text>
                                <Text style={[styles.tableCell, { flex: 0.9, textAlign: 'center' }]}>{item.note || '-'}</Text>
                                <Text style={[styles.tableCell, { flex: 0.7, textAlign: 'center' }, isUsedInPayment ? styles.settledAmountText : { color: colors.warning }]}>₹{item.amount}</Text>
                                <Text style={[styles.tableCell, { flex: 0.9, textAlign: 'center' }]}>
                                    {new Date(item.date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                                </Text>
                                <View style={{ flex: 0.5, alignItems: 'center', justifyContent: 'center' }}>
                                    <Pressable
                                        style={styles.deleteBtn}
                                        onPress={() => handleDeleteAdvance(item._id, item.farmer?.name || 'Unknown')}
                                    >
                                        <Trash2 size={14} color={colors.destructive} />
                                    </Pressable>
                                </View>
                            </View>
  );
}
