import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, RefreshControl, Modal, Platform } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { X, FileText, Calendar as CalendarIcon, Printer } from 'lucide-react-native';
import TopBar from '@/components/TopBar';
import { milkCollectionsApi, farmersApi, MilkCollection, Farmer } from '@/lib/milkeyApi';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { SuccessModal } from '@/components/SuccessModal';
import { Calendar } from '@/components/Calendar';

// Quick range type
interface QuickRange {
    id: string;
    label: string;
    startDay: number;
    endDay: number;
}

export default function DairyScreen() {
    const { colors, isDark } = useTheme();
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [farmers, setFarmers] = useState<Farmer[]>([]);

    // Milk Purchase Entry state
    const [entryDate, setEntryDate] = useState<Date | null>(null);
    const [entryShift, setEntryShift] = useState<'morning' | 'evening'>('morning');
    const [entryFat, setEntryFat] = useState('');
    const [entrySnf, setEntrySnf] = useState('');
    const [entryQty, setEntryQty] = useState('');
    const [entryRate, setEntryRate] = useState('');
    const [showEntryDateModal, setShowEntryDateModal] = useState(false);

    // Purchase History state
    const [historyFromDate, setHistoryFromDate] = useState<Date | null>(null);
    const [historyToDate, setHistoryToDate] = useState<Date | null>(null);
    const [historyCollections, setHistoryCollections] = useState<MilkCollection[]>([]);
    const [historyTotals, setHistoryTotals] = useState({ quantity: 0, amount: 0 });
    const [selectedRanges, setSelectedRanges] = useState<string[]>([]);
    const [showHistoryDateModal, setShowHistoryDateModal] = useState(false);
    const [historyDateType, setHistoryDateType] = useState<'from' | 'to'>('from');
    const [tempCalendarDate, setTempCalendarDate] = useState<Date | null>(null);

    // Modal state
    const [alertVisible, setAlertVisible] = useState(false);
    const [alertTitle, setAlertTitle] = useState('');
    const [alertMessage, setAlertMessage] = useState('');

    const styles = createStyles(colors, isDark);

    // Quick ranges for date selection
    const quickRanges: QuickRange[] = [
        { id: '1-10', label: '1-10', startDay: 1, endDay: 10 },
        { id: '11-20', label: '11-20', startDay: 11, endDay: 20 },
        { id: '21-31', label: '21-31', startDay: 21, endDay: 31 },
    ];

    const showAlert = (title: string, message: string) => {
        setAlertTitle(title);
        setAlertMessage(message);
        setAlertVisible(true);
    };

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const farmersRes = await farmersApi.getAll().catch(() => null);
            if (farmersRes?.success) setFarmers(farmersRes.response?.data || []);
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    const onRefresh = useCallback(async () => { setRefreshing(true); await fetchData(); setRefreshing(false); }, []);

    // Calculate total amount
    const totalAmount = (parseFloat(entryQty || '0') * parseFloat(entryRate || '0')).toFixed(2);

    // Format date for display
    const formatDisplayDate = (date: Date | null) => {
        if (!date) return 'Select Date';
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}-${month}-${year}`;
    };

    // Format date for API (YYYY-MM-DD)
    const formatApiDate = (date: Date | null) => {
        if (!date) return '';
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${year}-${month}-${day}`;
    };

    // Entry date picker
    const openEntryDatePicker = () => {
        setTempCalendarDate(entryDate || new Date());
        setShowEntryDateModal(true);
    };

    const handleConfirmEntryDate = () => {
        if (tempCalendarDate) {
            setEntryDate(tempCalendarDate);
        }
        setShowEntryDateModal(false);
    };

    const handleClearEntry = () => {
        setEntryDate(null);
        setEntryFat('');
        setEntrySnf('');
        setEntryQty('');
        setEntryRate('');
        setEntryShift('morning');
    };

    const handleUpdateEntry = async () => {
        if (!entryQty || !entryRate) {
            showAlert('Error', 'Please enter quantity and rate');
            return;
        }

        setLoading(true);
        try {
            const res = await milkCollectionsApi.create({
                farmerCode: farmers[0]?.code || '', // Optional - use first farmer if available
                quantity: parseFloat(entryQty),
                rate: parseFloat(entryRate),
                date: entryDate ? formatApiDate(entryDate) : undefined,
                shift: entryShift,
                fat: entryFat ? parseFloat(entryFat) : undefined,
                snf: entrySnf ? parseFloat(entrySnf) : undefined,
            });

            if (res.success) {
                showAlert('Success', 'Milk collection recorded successfully');
                handleClearEntry();
            } else {
                showAlert('Error', res.message || 'Failed to save entry');
            }
        } catch (error) {
            console.error('Save entry error:', error);
            showAlert('Error', 'Failed to save entry');
        }
        setLoading(false);
    };

    // History functions
    const handleToggleRange = (rangeId: string) => {
        setSelectedRanges(prev =>
            prev.includes(rangeId) ? prev.filter(r => r !== rangeId) : [...prev, rangeId]
        );
    };

    const handleClearRanges = () => {
        setSelectedRanges([]);
        setHistoryFromDate(null);
        setHistoryToDate(null);
    };

    const openDatePicker = (type: 'from' | 'to') => {
        setHistoryDateType(type);
        const currentDate = type === 'from' ? historyFromDate : historyToDate;
        setTempCalendarDate(currentDate || new Date());
        setShowHistoryDateModal(true);
    };

    const handleConfirmHistoryDate = () => {
        if (tempCalendarDate) {
            if (historyDateType === 'from') {
                setHistoryFromDate(tempCalendarDate);
            } else {
                setHistoryToDate(tempCalendarDate);
            }
        }
        setShowHistoryDateModal(false);
    };

    const handleFetchHistory = async () => {
        setLoading(true);
        try {
            let startDate = formatApiDate(historyFromDate);
            let endDate = formatApiDate(historyToDate);

            // If quick ranges selected and no specific dates, calculate from ranges
            if (selectedRanges.length > 0 && !historyFromDate && !historyToDate) {
                const now = new Date();
                const year = now.getFullYear();
                const month = now.getMonth();

                let minDay = 31;
                let maxDay = 1;
                selectedRanges.forEach(rangeId => {
                    const range = quickRanges.find(r => r.id === rangeId);
                    if (range) {
                        if (range.startDay < minDay) minDay = range.startDay;
                        if (range.endDay > maxDay) maxDay = range.endDay;
                    }
                });

                const daysInMonth = new Date(year, month + 1, 0).getDate();
                startDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(minDay).padStart(2, '0')}`;
                endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(Math.min(maxDay, daysInMonth)).padStart(2, '0')}`;
            }

            const res = await milkCollectionsApi.getAll({
                startDate: startDate || undefined,
                endDate: endDate || undefined,
                limit: 100,
            });

            if (res.success) {
                setHistoryCollections(res.response?.data || []);
                setHistoryTotals(res.response?.totals || { quantity: 0, amount: 0 });
            } else {
                showAlert('Error', res.message || 'Failed to fetch history');
            }
        } catch (error) {
            console.error('Fetch history error:', error);
            showAlert('Error', 'Failed to fetch history');
        }
        setLoading(false);
    };

    const generateHistoryPdfHtml = () => {
        if (historyCollections.length === 0) return '';

        return `
        <html><head><style>
          body { font-family: Arial; padding: 20px; }
          h1 { color: #22c55e; text-align: center; font-size: 24px; }
          .date-range { text-align: center; color: #666; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 10px; text-align: center; }
          th { background-color: #22c55e; color: white; font-weight: bold; }
          tr:nth-child(even) { background-color: #f9f9f9; }
          .summary { background: #f0fdf4; padding: 15px; border-radius: 8px; margin-top: 20px; }
          .total-amount { color: #22c55e; font-weight: bold; }
        </style></head><body>
          <h1>Purchase History</h1>
          <table>
            <tr>
              <th>Date</th>
              <th>Session</th>
              <th>FAT</th>
              <th>SNF</th>
              <th>Qty</th>
              <th>Rate</th>
              <th>Amt</th>
            </tr>
            ${historyCollections.map(c => `
              <tr>
                <td>${new Date(c.date).toISOString().split('T')[0]}</td>
                <td style="color: ${c.shift === 'morning' ? '#f59e0b' : '#3b82f6'}">${c.shift}</td>
                <td>${c.fat || '-'}</td>
                <td>${c.snf || '-'}</td>
                <td>${c.quantity}</td>
                <td>${c.rate}</td>
                <td class="total-amount">₹${c.amount.toFixed(2)}</td>
              </tr>
            `).join('')}
          </table>
          <div class="summary">
            <p><strong>Total Quantity:</strong> ${historyTotals.quantity.toFixed(2)} L</p>
            <p><strong>Total Amount:</strong> ₹${historyTotals.amount.toFixed(2)}</p>
          </div>
        </body></html>
      `;
    };

    const handleHistoryPdf = async () => {
        const html = generateHistoryPdfHtml();
        if (!html) { showAlert('Error', 'No data to export. Please fetch history first.'); return; }

        try {
            const { uri } = await Print.printToFileAsync({ html });
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri);
            } else {
                showAlert('Info', 'PDF saved to: ' + uri);
            }
        } catch (e) {
            showAlert('Error', 'Failed to generate PDF');
        }
    };

    const handleHistoryPrint = async () => {
        const html = generateHistoryPdfHtml();
        if (!html) { showAlert('Error', 'No data to print. Please fetch history first.'); return; }

        try {
            await Print.printAsync({ html });
        } catch (e) {
            showAlert('Error', 'Failed to print');
        }
    };

    return (
        <View style={styles.container}>
            <TopBar />
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
            >
                {/* Milk Purchase Entry Section */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Milk Purchase Entry</Text>

                    {/* Date and Session Row */}
                    <View style={styles.row}>
                        <View style={styles.fieldHalf}>
                            <Text style={styles.fieldLabel}>Date</Text>
                            <Pressable style={styles.dateInput} onPress={openEntryDatePicker}>
                                <Text style={styles.dateInputText}>{formatDisplayDate(entryDate)}</Text>
                                <CalendarIcon size={16} color={colors.mutedForeground} />
                            </Pressable>
                        </View>
                        <View style={styles.fieldHalf}>
                            <Text style={styles.fieldLabel}>Session</Text>
                            <View style={styles.sessionRow}>
                                <Pressable
                                    style={[styles.sessionBtn, entryShift === 'morning' && styles.sessionBtnActive]}
                                    onPress={() => setEntryShift('morning')}
                                >
                                    <Text style={[styles.sessionBtnText, entryShift === 'morning' && styles.sessionBtnTextActive]}>Morning</Text>
                                </Pressable>
                                <Pressable
                                    style={[styles.sessionBtn, entryShift === 'evening' && styles.sessionBtnActiveEvening]}
                                    onPress={() => setEntryShift('evening')}
                                >
                                    <Text style={[styles.sessionBtnText, entryShift === 'evening' && styles.sessionBtnTextActive]}>Evening</Text>
                                </Pressable>
                            </View>
                        </View>
                    </View>

                    {/* FAT and SNF Row */}
                    <View style={styles.row}>
                        <View style={styles.fieldHalf}>
                            <Text style={styles.fieldLabel}>FAT</Text>
                            <TextInput
                                style={styles.textInput}
                                value={entryFat}
                                onChangeText={setEntryFat}
                                keyboardType="decimal-pad"
                                placeholder="5"
                                placeholderTextColor={colors.mutedForeground}
                            />
                        </View>
                        <View style={styles.fieldHalf}>
                            <Text style={styles.fieldLabel}>SNF</Text>
                            <TextInput
                                style={styles.textInput}
                                value={entrySnf}
                                onChangeText={setEntrySnf}
                                keyboardType="decimal-pad"
                                placeholder="6"
                                placeholderTextColor={colors.mutedForeground}
                            />
                        </View>
                    </View>

                    {/* Qty and Rate Row */}
                    <View style={styles.row}>
                        <View style={styles.fieldHalf}>
                            <Text style={styles.fieldLabel}>Total Qty (L)</Text>
                            <TextInput
                                style={styles.textInput}
                                value={entryQty}
                                onChangeText={setEntryQty}
                                keyboardType="decimal-pad"
                                placeholder="300"
                                placeholderTextColor={colors.mutedForeground}
                            />
                        </View>
                        <View style={styles.fieldHalf}>
                            <Text style={styles.fieldLabel}>Avg Rate (₹/L)</Text>
                            <TextInput
                                style={styles.textInput}
                                value={entryRate}
                                onChangeText={setEntryRate}
                                keyboardType="decimal-pad"
                                placeholder="50"
                                placeholderTextColor={colors.mutedForeground}
                            />
                        </View>
                    </View>

                    {/* Total Amount and Buttons */}
                    <View style={styles.totalRow}>
                        <View style={styles.totalSection}>
                            <Text style={styles.totalLabel}>Total Amount (₹)</Text>
                            <Text style={styles.totalAmount}>{totalAmount}</Text>
                        </View>
                        <View style={styles.buttonGroup}>
                            <Pressable style={styles.updateBtn} onPress={handleUpdateEntry}>
                                <Text style={styles.updateBtnText}>Update</Text>
                            </Pressable>
                            <Pressable style={styles.clearBtn} onPress={handleClearEntry}>
                                <Text style={styles.clearBtnText}>Clear</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>

                {/* Purchase History Section */}
                <View style={styles.card}>
                    {/* Header */}
                    <View style={styles.historyHeader}>
                        <Text style={styles.cardTitle}>Purchase History</Text>
                        <View style={styles.historyButtons}>
                            <Pressable style={styles.pdfBtn} onPress={handleHistoryPdf}>
                                <FileText size={14} color="#fff" />
                                <Text style={styles.pdfBtnText}>PDF</Text>
                            </Pressable>
                            <Pressable style={styles.printBtn} onPress={handleHistoryPrint}>
                                <Printer size={14} color="#fff" />
                                <Text style={styles.printBtnText}>Print</Text>
                            </Pressable>
                        </View>
                    </View>

                    {/* Date Range */}
                    <View style={styles.row}>
                        <View style={styles.fieldHalf}>
                            <Text style={styles.fieldLabelSmall}>From Date</Text>
                            <Pressable style={styles.dateInput} onPress={() => openDatePicker('from')}>
                                <Text style={styles.dateInputText}>{formatDisplayDate(historyFromDate)}</Text>
                                <CalendarIcon size={16} color={colors.mutedForeground} />
                            </Pressable>
                        </View>
                        <View style={styles.fieldHalf}>
                            <Text style={styles.fieldLabelSmall}>To Date</Text>
                            <Pressable style={styles.dateInput} onPress={() => openDatePicker('to')}>
                                <Text style={styles.dateInputText}>{formatDisplayDate(historyToDate)}</Text>
                                <CalendarIcon size={16} color={colors.mutedForeground} />
                            </Pressable>
                        </View>
                    </View>

                    {/* Quick Ranges */}
                    <View style={styles.quickRangesSection}>
                        <Text style={styles.quickRangesLabel}>Quick Ranges</Text>
                        <View style={styles.quickRangesRow}>
                            {quickRanges.map(range => (
                                <Pressable
                                    key={range.id}
                                    style={[
                                        styles.quickRangeChip,
                                        selectedRanges.includes(range.id) && styles.quickRangeChipActive
                                    ]}
                                    onPress={() => handleToggleRange(range.id)}
                                >
                                    <Text style={[
                                        styles.quickRangeText,
                                        selectedRanges.includes(range.id) && styles.quickRangeTextActive
                                    ]}>{range.label}</Text>
                                    {selectedRanges.includes(range.id) && (
                                        <X size={12} color={colors.destructive} />
                                    )}
                                </Pressable>
                            ))}
                        </View>
                        <View style={styles.rangeActions}>
                            <Pressable onPress={handleClearRanges}>
                                <Text style={styles.clearRangesText}>✕ Clear</Text>
                            </Pressable>
                            <Pressable>
                                <Text style={styles.makeRangeText}>+ Make Range</Text>
                            </Pressable>
                        </View>
                    </View>

                    {/* Show Button */}
                    <Pressable style={styles.showBtn} onPress={handleFetchHistory}>
                        <Text style={styles.showBtnText}>{loading ? 'Loading...' : 'Show'}</Text>
                    </Pressable>

                    {/* Results Table */}
                    {historyCollections.length > 0 && (
                        <View style={styles.tableContainer}>
                            <View style={styles.tableHeader}>
                                <Text style={[styles.tableHeaderCell, styles.tableCellDate]}>Date</Text>
                                <Text style={[styles.tableHeaderCell, styles.tableCellSession]}>Session</Text>
                                <Text style={[styles.tableHeaderCell, styles.tableCellSmall]}>FAT</Text>
                                <Text style={[styles.tableHeaderCell, styles.tableCellSmall]}>SNF</Text>
                                <Text style={[styles.tableHeaderCell, styles.tableCellSmall]}>Qty</Text>
                                <Text style={[styles.tableHeaderCell, styles.tableCellSmall]}>Rate</Text>
                                <Text style={[styles.tableHeaderCell, styles.tableCellAmount]}>Amt</Text>
                            </View>

                            {historyCollections.map((item, index) => (
                                <View key={item._id} style={[styles.tableRow, index % 2 === 0 && styles.tableRowEven]}>
                                    <Text style={[styles.tableCell, styles.tableCellDate]}>{new Date(item.date).toISOString().split('T')[0]}</Text>
                                    <Text style={[styles.tableCell, styles.tableCellSession, { color: item.shift === 'morning' ? '#f59e0b' : '#3b82f6' }]}>{item.shift}</Text>
                                    <Text style={[styles.tableCell, styles.tableCellSmall]}>{item.fat || '-'}</Text>
                                    <Text style={[styles.tableCell, styles.tableCellSmall]}>{item.snf || '-'}</Text>
                                    <Text style={[styles.tableCell, styles.tableCellSmall]}>{item.quantity}</Text>
                                    <Text style={[styles.tableCell, styles.tableCellSmall]}>{item.rate}</Text>
                                    <Text style={[styles.tableCell, styles.tableCellAmount, { color: colors.success }]}>₹{item.amount.toFixed(2)}</Text>
                                </View>
                            ))}
                        </View>
                    )}

                    {historyCollections.length === 0 && !loading && (
                        <Text style={styles.emptyText}>Select date range and click Show to view history</Text>
                    )}
                </View>
            </ScrollView>

            {/* Entry Date Picker Modal with Calendar */}
            <Modal visible={showEntryDateModal} animationType="fade" transparent onRequestClose={() => setShowEntryDateModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Select Date</Text>
                            <Pressable onPress={() => setShowEntryDateModal(false)}><X size={20} color={colors.foreground} /></Pressable>
                        </View>
                        <View style={styles.calendarBody}>
                            <Calendar
                                selectedDate={tempCalendarDate}
                                onDateSelect={(date) => setTempCalendarDate(date)}
                            />
                        </View>
                        <View style={styles.modalFooter}>
                            <Pressable style={styles.cancelModalBtn} onPress={() => setShowEntryDateModal(false)}>
                                <Text style={styles.cancelModalBtnText}>Cancel</Text>
                            </Pressable>
                            <Pressable style={styles.confirmModalBtn} onPress={handleConfirmEntryDate}>
                                <Text style={styles.confirmModalBtnText}>Confirm</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* History Date Picker Modal with Calendar */}
            <Modal visible={showHistoryDateModal} animationType="fade" transparent onRequestClose={() => setShowHistoryDateModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{historyDateType === 'from' ? 'From Date' : 'To Date'}</Text>
                            <Pressable onPress={() => setShowHistoryDateModal(false)}><X size={20} color={colors.foreground} /></Pressable>
                        </View>
                        <View style={styles.calendarBody}>
                            <Calendar
                                selectedDate={tempCalendarDate}
                                onDateSelect={(date) => setTempCalendarDate(date)}
                            />
                        </View>
                        <View style={styles.modalFooter}>
                            <Pressable style={styles.cancelModalBtn} onPress={() => setShowHistoryDateModal(false)}>
                                <Text style={styles.cancelModalBtnText}>Cancel</Text>
                            </Pressable>
                            <Pressable style={styles.confirmModalBtn} onPress={handleConfirmHistoryDate}>
                                <Text style={styles.confirmModalBtnText}>Confirm</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>

            <SuccessModal
                isVisible={alertVisible}
                onClose={() => setAlertVisible(false)}
                title={alertTitle}
                message={alertMessage}
                autoClose={alertTitle === 'Success'}
            />
        </View>
    );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scrollView: { flex: 1 },
    scrollContent: { padding: 6, paddingBottom: 100 },

    card: {
        backgroundColor: colors.card,
        borderRadius: 12,
        padding: 6,
        marginBottom: 12,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#22c55e',
        marginBottom: 12,
    },

    row: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 8,
    },
    fieldHalf: { flex: 1 },
    fieldLabel: {
        fontSize: 13,
        fontWeight: '500',
        color: colors.mutedForeground,
        marginBottom: 4,
    },
    fieldLabelSmall: {
        fontSize: 12,
        fontWeight: '500',
        color: '#f97316',
        marginBottom: 4,
    },

    dateInput: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.background,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 10,
    },
    dateInputText: {
        fontSize: 14,
        color: colors.foreground,
    },

    sessionRow: {
        flexDirection: 'row',
        gap: 6,
    },
    sessionBtn: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 8,
        alignItems: 'center',
        backgroundColor: colors.background,
    },
    sessionBtnActive: {
        backgroundColor: '#22c55e',
    },
    sessionBtnActiveEvening: {
        backgroundColor: '#6b7280',
    },
    sessionBtnText: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.foreground,
    },
    sessionBtnTextActive: {
        color: '#fff',
    },

    textInput: {
        backgroundColor: colors.background,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 10,
        fontSize: 14,
        color: colors.foreground,
    },

    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginTop: 6,
    },
    totalSection: { flex: 1 },
    totalLabel: {
        fontSize: 12,
        color: colors.mutedForeground,
        marginBottom: 4,
    },
    totalAmount: {
        fontSize: 28,
        fontWeight: '700',
        color: '#22c55e',
    },
    buttonGroup: {
        flexDirection: 'row',
        gap: 6,
    },
    updateBtn: {
        backgroundColor: '#22c55e',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 8,
    },
    updateBtnText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    clearBtn: {
        backgroundColor: colors.muted,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 8,
    },
    clearBtnText: {
        color: colors.foreground,
        fontSize: 14,
        fontWeight: '600',
    },

    // History Section
    historyHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    historyButtons: {
        flexDirection: 'row',
        gap: 6,
    },
    pdfBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#22c55e',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 6,
    },
    pdfBtnText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
    },
    printBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#3b82f6',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 6,
    },
    printBtnText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
    },

    quickRangesSection: { marginBottom: 8 },
    quickRangesLabel: {
        fontSize: 12,
        fontWeight: '500',
        color: colors.mutedForeground,
        marginBottom: 6,
    },
    quickRangesRow: {
        flexDirection: 'row',
        gap: 6,
        flexWrap: 'wrap',
    },
    quickRangeChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: colors.background,
    },
    quickRangeChipActive: {
        backgroundColor: '#dcfce7',
    },
    quickRangeText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#22c55e',
    },
    quickRangeTextActive: {
        color: '#22c55e',
    },
    rangeActions: {
        flexDirection: 'row',
        gap: 16,
        marginTop: 8,
    },
    clearRangesText: {
        fontSize: 13,
        color: '#ef4444',
        fontWeight: '500',
    },
    makeRangeText: {
        fontSize: 13,
        color: '#22c55e',
        fontWeight: '500',
    },

    showBtn: {
        backgroundColor: '#22c55e',
        borderRadius: 8,
        paddingVertical: 12,
        alignItems: 'center',
        marginBottom: 12,
    },
    showBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },

    tableContainer: {
        borderRadius: 8,
        overflow: 'hidden',
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: '#f3f4f6',
        paddingVertical: 8,
        paddingHorizontal: 6,
    },
    tableHeaderCell: {
        fontSize: 11,
        fontWeight: '700',
        color: colors.mutedForeground,
        textAlign: 'center',
    },
    tableRow: {
        flexDirection: 'row',
        paddingVertical: 8,
        paddingHorizontal: 6,
    },
    tableRowEven: {
        backgroundColor: colors.background,
    },
    tableCell: {
        fontSize: 12,
        color: colors.foreground,
        textAlign: 'center',
    },
    tableCellDate: { flex: 2 },
    tableCellSession: { flex: 1.5 },
    tableCellSmall: { flex: 1 },
    tableCellAmount: { flex: 1.5, fontWeight: '600' },

    emptyText: {
        fontSize: 13,
        color: colors.mutedForeground,
        textAlign: 'center',
        marginTop: 16,
    },

    // Modal styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    modalContent: {
        backgroundColor: colors.card,
        borderRadius: 16,
        width: '100%',
        maxWidth: 360,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    modalTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.foreground,
    },
    calendarBody: {
        padding: 8,
    },
    modalFooter: {
        flexDirection: 'row',
        padding: 12,
        gap: 8,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    cancelModalBtn: {
        flex: 1,
        backgroundColor: colors.muted,
        borderRadius: 8,
        paddingVertical: 10,
        alignItems: 'center',
    },
    cancelModalBtnText: {
        color: colors.foreground,
        fontSize: 14,
        fontWeight: '600',
    },
    confirmModalBtn: {
        flex: 1,
        backgroundColor: '#22c55e',
        borderRadius: 8,
        paddingVertical: 10,
        alignItems: 'center',
    },
    confirmModalBtnText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
});
