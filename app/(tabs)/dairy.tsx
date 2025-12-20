import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, Platform } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { Calendar, FileText, Printer, X, Plus } from 'lucide-react-native';
import TopBar from '@/components/TopBar';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

const mockPurchaseHistory = [
    { id: '1', date: '2025-12-17', session: 'morning', fat: 5, snf: 6, qty: 300, rate: 50, amt: 15000 },
    { id: '2', date: '2025-12-17', session: 'morning', fat: 5, snf: 6, qty: 300, rate: 50, amt: 15000 },
    { id: '3', date: '2025-12-17', session: 'morning', fat: 5, snf: 6, qty: 300, rate: 50, amt: 15000 },
    { id: '4', date: '2025-12-17', session: 'morning', fat: 5, snf: 6, qty: 300, rate: 50, amt: 15000 },
    { id: '5', date: '2025-12-17', session: 'morning', fat: 5, snf: 6, qty: 300, rate: 50, amt: 15000 },
];

export default function DairyScreen() {
    const { colors, isDark } = useTheme();

    const [session, setSession] = useState<'Morning' | 'Evening'>('Morning');
    const [date, setDate] = useState('20-12-2025');
    const [fat, setFat] = useState('0.0');
    const [snf, setSnf] = useState('0.0');
    const [totalQty, setTotalQty] = useState('0.0');
    const [avgRate, setAvgRate] = useState('0.0');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [quickRanges, setQuickRanges] = useState(['1-10', '11-20']);

    const totalAmount = parseFloat(totalQty) * parseFloat(avgRate) || 0;

    const handleClear = () => {
        setFat('0.0');
        setSnf('0.0');
        setTotalQty('0.0');
        setAvgRate('0.0');
    };

    const removeQuickRange = (range: string) => {
        setQuickRanges(prev => prev.filter(r => r !== range));
    };

    const generateHTML = () => {
        const rows = mockPurchaseHistory.map(item => `
      <tr>
        <td>${item.date}</td>
        <td>${item.session}</td>
        <td>${item.fat}</td>
        <td>${item.snf}</td>
        <td>${item.qty}</td>
        <td>${item.rate}</td>
        <td>₹${item.amt.toFixed(2)}</td>
      </tr>
    `).join('');

        return `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { color: #22C55E; text-align: center; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: center; }
            th { background-color: #22C55E; color: white; }
            tr:nth-child(even) { background-color: #f2f2f2; }
          </style>
        </head>
        <body>
          <h1>Milk Purchase Report</h1>
          <p>Date: ${date} | Session: ${session}</p>
          <table>
            <tr>
              <th>Date</th>
              <th>Session</th>
              <th>FAT</th>
              <th>SNF</th>
              <th>Qty</th>
              <th>Rate</th>
              <th>Amount</th>
            </tr>
            ${rows}
          </table>
        </body>
      </html>
    `;
    };

    const handlePDF = async () => {
        try {
            const html = generateHTML();
            const { uri } = await Print.printToFileAsync({ html });
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri);
            } else {
                Alert.alert('PDF Generated', `Saved to: ${uri}`);
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to generate PDF');
        }
    };

    const handlePrint = async () => {
        try {
            const html = generateHTML();
            await Print.printAsync({ html });
        } catch (error) {
            Alert.alert('Error', 'Failed to print');
        }
    };

    const styles = createStyles(colors, isDark);

    return (
        <View style={styles.container}>
            <TopBar />
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                {/* Title */}
                <Text style={styles.pageTitle}>Milk Purchase Entry</Text>

                {/* Date and Session */}
                <View style={styles.row}>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Date</Text>
                        <View style={styles.dateInput}>
                            <TextInput
                                style={styles.textInput}
                                value={date}
                                onChangeText={setDate}
                                placeholderTextColor={colors.mutedForeground}
                            />
                            <Calendar size={16} color={colors.mutedForeground} />
                        </View>
                    </View>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Session</Text>
                        <View style={styles.sessionToggle}>
                            <Pressable
                                style={[styles.sessionBtn, session === 'Morning' && styles.sessionBtnActive]}
                                onPress={() => setSession('Morning')}
                            >
                                <Text style={[styles.sessionText, session === 'Morning' && styles.sessionTextActive]}>Morning</Text>
                            </Pressable>
                            <Pressable
                                style={[styles.sessionBtn, session === 'Evening' && styles.sessionBtnActive]}
                                onPress={() => setSession('Evening')}
                            >
                                <Text style={[styles.sessionText, session === 'Evening' && styles.sessionTextActive]}>Evening</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>

                {/* FAT and SNF */}
                <View style={styles.row}>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>FAT</Text>
                        <TextInput
                            style={styles.input}
                            value={fat}
                            onChangeText={setFat}
                            keyboardType="decimal-pad"
                            placeholderTextColor={colors.mutedForeground}
                        />
                    </View>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>SNF</Text>
                        <TextInput
                            style={styles.input}
                            value={snf}
                            onChangeText={setSnf}
                            keyboardType="decimal-pad"
                            placeholderTextColor={colors.mutedForeground}
                        />
                    </View>
                </View>

                {/* Total Qty and Avg Rate */}
                <View style={styles.row}>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Total Qty (L)</Text>
                        <TextInput
                            style={styles.input}
                            value={totalQty}
                            onChangeText={setTotalQty}
                            keyboardType="decimal-pad"
                            placeholderTextColor={colors.mutedForeground}
                        />
                    </View>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Avg Rate (₹/L)</Text>
                        <TextInput
                            style={styles.input}
                            value={avgRate}
                            onChangeText={setAvgRate}
                            keyboardType="decimal-pad"
                            placeholderTextColor={colors.mutedForeground}
                        />
                    </View>
                </View>

                {/* Total Amount */}
                <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Total Amount (₹)</Text>
                    <Text style={styles.totalValue}>{totalAmount.toFixed(2)}</Text>
                </View>

                {/* Buttons */}
                <View style={styles.buttonRow}>
                    <Pressable style={styles.saveBtn}>
                        <Text style={styles.saveBtnText}>Save</Text>
                    </Pressable>
                    <Pressable style={styles.clearBtn} onPress={handleClear}>
                        <Text style={styles.clearBtnText}>Clear</Text>
                    </Pressable>
                </View>

                {/* Purchase History */}
                <View style={styles.historyHeader}>
                    <Text style={styles.sectionTitle}>Purchase History</Text>
                    <View style={styles.exportBtns}>
                        <Pressable style={styles.pdfBtn} onPress={handlePDF}>
                            <FileText size={12} color={colors.white} />
                            <Text style={styles.exportText}>PDF</Text>
                        </Pressable>
                        <Pressable style={styles.printBtn} onPress={handlePrint}>
                            <Printer size={12} color={colors.white} />
                            <Text style={styles.exportText}>Print</Text>
                        </Pressable>
                    </View>
                </View>

                {/* Date Filters */}
                <View style={styles.row}>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>From Date</Text>
                        <View style={styles.dateInput}>
                            <TextInput
                                style={styles.textInput}
                                placeholder="dd-mm-yyyy"
                                value={fromDate}
                                onChangeText={setFromDate}
                                placeholderTextColor={colors.mutedForeground}
                            />
                            <Calendar size={16} color={colors.mutedForeground} />
                        </View>
                    </View>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>To Date</Text>
                        <View style={styles.dateInput}>
                            <TextInput
                                style={styles.textInput}
                                placeholder="dd-mm-yyyy"
                                value={toDate}
                                onChangeText={setToDate}
                                placeholderTextColor={colors.mutedForeground}
                            />
                            <Calendar size={16} color={colors.mutedForeground} />
                        </View>
                    </View>
                </View>

                {/* Quick Ranges */}
                <View style={styles.quickRangesRow}>
                    <Text style={styles.label}>Quick Ranges</Text>
                    <View style={styles.rangeChips}>
                        {quickRanges.map((range) => (
                            <View key={range} style={styles.rangeChip}>
                                <Text style={styles.rangeChipText}>{range}</Text>
                                <Pressable onPress={() => removeQuickRange(range)}>
                                    <X size={12} color={colors.destructive} />
                                </Pressable>
                            </View>
                        ))}
                    </View>
                </View>

                <View style={styles.rangeActions}>
                    <Pressable style={styles.clearRangeBtn}>
                        <X size={12} color={colors.destructive} />
                        <Text style={styles.clearRangeText}>Clear</Text>
                    </Pressable>
                    <Pressable style={styles.addRangeBtn}>
                        <Plus size={12} color={colors.primary} />
                        <Text style={styles.addRangeText}>Make Range</Text>
                    </Pressable>
                </View>

                <Pressable style={styles.showBtn}>
                    <Text style={styles.showBtnText}>Show</Text>
                </Pressable>

                {/* Table */}
                <View style={styles.table}>
                    <View style={styles.tableHeader}>
                        <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>Date</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Session</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 0.6 }]}>FAT</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 0.6 }]}>SNF</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 0.6 }]}>Qty</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 0.6 }]}>Rate</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Amt</Text>
                    </View>
                    {mockPurchaseHistory.map((item) => (
                        <View key={item.id} style={styles.tableRow}>
                            <Text style={[styles.tableCell, { flex: 1.5 }]}>{item.date}</Text>
                            <Text style={[styles.tableCell, { flex: 1, color: colors.primary }]}>{item.session}</Text>
                            <Text style={[styles.tableCell, { flex: 0.6, color: colors.primary }]}>{item.fat}</Text>
                            <Text style={[styles.tableCell, { flex: 0.6, color: colors.primary }]}>{item.snf}</Text>
                            <Text style={[styles.tableCell, { flex: 0.6 }]}>{item.qty}</Text>
                            <Text style={[styles.tableCell, { flex: 0.6 }]}>{item.rate}</Text>
                            <Text style={[styles.tableCell, { flex: 1, color: colors.warning }]}>₹{item.amt.toFixed(2)}</Text>
                        </View>
                    ))}
                </View>
            </ScrollView>
        </View>
    );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 6,
        paddingTop: 6,
        paddingBottom: 80,
    },
    pageTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.primary,
        marginBottom: 12,
    },
    row: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 10,
    },
    inputGroup: {
        flex: 1,
    },
    label: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.mutedForeground,
        marginBottom: 4,
    },
    input: {
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 6,
        paddingHorizontal: 10,
        paddingVertical: 8,
        fontSize: 14,
        color: colors.foreground,
    },
    dateInput: {
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 6,
        paddingHorizontal: 10,
        paddingVertical: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    textInput: {
        flex: 1,
        fontSize: 14,
        color: colors.foreground,
        padding: 0,
    },
    sessionToggle: {
        flexDirection: 'row',
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 6,
        overflow: 'hidden',
    },
    sessionBtn: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        backgroundColor: colors.card,
    },
    sessionBtnActive: {
        backgroundColor: colors.primary,
    },
    sessionText: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.foreground,
    },
    sessionTextActive: {
        color: colors.white,
    },
    totalRow: {
        marginBottom: 12,
    },
    totalLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.mutedForeground,
        marginBottom: 2,
    },
    totalValue: {
        fontSize: 22,
        fontWeight: '700',
        color: colors.primary,
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 16,
    },
    saveBtn: {
        flex: 1,
        backgroundColor: colors.primary,
        paddingVertical: 10,
        borderRadius: 6,
        alignItems: 'center',
    },
    saveBtnText: {
        color: colors.white,
        fontSize: 14,
        fontWeight: '600',
    },
    clearBtn: {
        flex: 1,
        backgroundColor: colors.muted,
        paddingVertical: 10,
        borderRadius: 6,
        alignItems: 'center',
    },
    clearBtnText: {
        color: colors.foreground,
        fontSize: 14,
        fontWeight: '600',
    },
    historyHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: colors.foreground,
    },
    exportBtns: {
        flexDirection: 'row',
        gap: 6,
    },
    pdfBtn: {
        backgroundColor: colors.primary,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 4,
    },
    printBtn: {
        backgroundColor: colors.destructive,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 4,
    },
    exportText: {
        color: colors.white,
        fontSize: 12,
        fontWeight: '600',
    },
    quickRangesRow: {
        marginBottom: 8,
    },
    rangeChips: {
        flexDirection: 'row',
        gap: 6,
        marginTop: 4,
    },
    rangeChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: colors.secondary,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: colors.primary,
    },
    rangeChipText: {
        fontSize: 12,
        color: colors.primary,
        fontWeight: '600',
    },
    rangeActions: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 10,
    },
    clearRangeBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    clearRangeText: {
        fontSize: 12,
        color: colors.destructive,
    },
    addRangeBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    addRangeText: {
        fontSize: 12,
        color: colors.primary,
    },
    showBtn: {
        backgroundColor: colors.warning,
        paddingVertical: 10,
        borderRadius: 6,
        alignItems: 'center',
        marginBottom: 12,
    },
    showBtnText: {
        color: colors.foreground,
        fontSize: 14,
        fontWeight: '600',
    },
    table: {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 6,
        overflow: 'hidden',
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: colors.muted,
        paddingVertical: 8,
        paddingHorizontal: 6,
    },
    tableHeaderCell: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.foreground,
        textAlign: 'center',
    },
    tableRow: {
        flexDirection: 'row',
        paddingVertical: 8,
        paddingHorizontal: 6,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    tableCell: {
        fontSize: 12,
        color: colors.foreground,
        textAlign: 'center',
    },
});