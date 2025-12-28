import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { ChevronLeft, FileText, Share2, Calendar } from 'lucide-react-native';
import { router } from 'expo-router';
import { reportsApi, FarmerStatement } from '@/lib/milkeyApi';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

function getDateString(daysOffset: number) {
    const d = new Date();
    d.setDate(d.getDate() + daysOffset);
    return d.toISOString().split('T')[0];
}

export default function FarmerStatementScreen() {
    const { colors, isDark } = useTheme();
    const [loading, setLoading] = useState(false);
    const [farmerCode, setFarmerCode] = useState('');
    const [dateRange, setDateRange] = useState({ start: getDateString(-30), end: getDateString(0) });
    const [statement, setStatement] = useState<FarmerStatement | null>(null);

    const styles = createStyles(colors, isDark);

    const handleFetchStatement = async () => {
        if (!farmerCode.trim()) {
            Alert.alert('Error', 'Please enter farmer code');
            return;
        }

        setLoading(true);
        const res = await reportsApi.getFarmerStatement(farmerCode.trim(), dateRange.start, dateRange.end);
        if (res.success && res.response) {
            setStatement(res.response);
        } else {
            Alert.alert('Error', res.message || 'Farmer not found');
            setStatement(null);
        }
        setLoading(false);
    };

    const generatePdfHtml = () => {
        if (!statement) return '';

        return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Farmer Statement</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #4A90D9; padding-bottom: 20px; }
          .header h1 { color: #4A90D9; margin: 0; font-size: 28px; }
          .header p { margin: 5px 0; color: #666; }
          .farmer-info { background: #f5f5f5; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
          .farmer-info h2 { margin: 0 0 10px 0; color: #333; }
          .info-row { display: flex; justify-content: space-between; margin: 5px 0; }
          .summary-grid { display: flex; gap: 10px; margin-bottom: 20px; }
          .summary-item { flex: 1; background: #e3f2fd; padding: 15px; border-radius: 8px; text-align: center; }
          .summary-item.credit { background: #e8f5e9; }
          .summary-item.debit { background: #fff3e0; }
          .summary-item.balance { background: #4A90D9; color: white; }
          .summary-label { font-size: 12px; color: #666; }
          .summary-value { font-size: 20px; font-weight: bold; margin-top: 5px; }
          .summary-item.balance .summary-label { color: rgba(255,255,255,0.8); }
          .summary-item.balance .summary-value { color: white; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 10px; text-align: left; font-size: 12px; }
          th { background-color: #4A90D9; color: white; }
          tr:nth-child(even) { background-color: #f9f9f9; }
          .credit-text { color: #22C55E; font-weight: bold; }
          .debit-text { color: #EF4444; font-weight: bold; }
          .footer { margin-top: 30px; text-align: center; font-size: 11px; color: #999; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🥛 Milkey Dairy</h1>
          <p>Farmer Statement Report</p>
        </div>

        <div class="farmer-info">
          <h2>${statement.farmer.name}</h2>
          <div class="info-row">
            <span>Code: ${statement.farmer.code}</span>
            <span>Mobile: ${statement.farmer.mobile || 'N/A'}</span>
          </div>
          <div class="info-row">
            <span>Period: ${new Date(statement.period.startDate).toLocaleDateString()} - ${new Date(statement.period.endDate).toLocaleDateString()}</span>
          </div>
        </div>

        <div class="summary-grid">
          <div class="summary-item credit">
            <div class="summary-label">Total Milk Amount</div>
            <div class="summary-value">₹${statement.summary.totalMilkAmount.toFixed(2)}</div>
          </div>
          <div class="summary-item debit">
            <div class="summary-label">Total Payments</div>
            <div class="summary-value">₹${statement.summary.totalPayments.toFixed(2)}</div>
          </div>
          <div class="summary-item balance">
            <div class="summary-label">Closing Balance</div>
            <div class="summary-value">₹${statement.summary.closingBalance.toFixed(2)}</div>
          </div>
        </div>

        <div class="summary-grid">
          <div class="summary-item">
            <div class="summary-label">Total Milk</div>
            <div class="summary-value">${statement.summary.totalMilk.toFixed(2)} L</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Collections</div>
            <div class="summary-value">${statement.summary.collectionsCount}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Payments Made</div>
            <div class="summary-value">${statement.summary.paymentsCount}</div>
          </div>
        </div>

        <h3>Transaction Details</h3>
        <table>
          <tr>
            <th>Date</th>
            <th>Description</th>
            <th>Credit</th>
            <th>Debit</th>
            <th>Balance</th>
          </tr>
          ${statement.statement.map(item => `
            <tr>
              <td>${new Date(item.date).toLocaleDateString()}</td>
              <td>${item.description}</td>
              <td class="credit-text">${item.credit > 0 ? '₹' + item.credit.toFixed(2) : '-'}</td>
              <td class="debit-text">${item.debit > 0 ? '₹' + item.debit.toFixed(2) : '-'}</td>
              <td>₹${item.balance.toFixed(2)}</td>
            </tr>
          `).join('')}
        </table>

        <div class="footer">
          <p>Generated on ${new Date().toLocaleString()} | Milkey Dairy Management System</p>
        </div>
      </body>
      </html>
    `;
    };

    const handleSharePdf = async () => {
        if (!statement) {
            Alert.alert('Error', 'Generate statement first');
            return;
        }

        const html = generatePdfHtml();
        try {
            const { uri } = await Print.printToFileAsync({ html });
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri, {
                    mimeType: 'application/pdf',
                    dialogTitle: `Statement - ${statement.farmer.name}`,
                });
            } else {
                Alert.alert('Success', 'PDF saved to: ' + uri);
            }
        } catch (e) {
            Alert.alert('Error', 'Failed to generate PDF');
        }
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.backBtn}>
                    <ChevronLeft size={24} color={colors.foreground} />
                </Pressable>
                <Text style={styles.headerTitle}>Farmer Statement</Text>
                {statement && (
                    <Pressable onPress={handleSharePdf} style={styles.shareBtn}>
                        <Share2 size={20} color={colors.primary} />
                    </Pressable>
                )}
            </View>

            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                {/* Search Card */}
                <View style={styles.searchCard}>
                    <Text style={styles.cardTitle}>Generate Statement</Text>

                    <Text style={styles.inputLabel}>Farmer Code</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Enter farmer code"
                        value={farmerCode}
                        onChangeText={setFarmerCode}
                        placeholderTextColor={colors.mutedForeground}
                    />

                    <View style={styles.dateRow}>
                        <View style={styles.dateField}>
                            <Text style={styles.inputLabel}>From Date</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="YYYY-MM-DD"
                                value={dateRange.start}
                                onChangeText={v => setDateRange(p => ({ ...p, start: v }))}
                                placeholderTextColor={colors.mutedForeground}
                            />
                        </View>
                        <View style={styles.dateField}>
                            <Text style={styles.inputLabel}>To Date</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="YYYY-MM-DD"
                                value={dateRange.end}
                                onChangeText={v => setDateRange(p => ({ ...p, end: v }))}
                                placeholderTextColor={colors.mutedForeground}
                            />
                        </View>
                    </View>

                    <Pressable style={styles.generateBtn} onPress={handleFetchStatement}>
                        <FileText size={18} color={colors.white} />
                        <Text style={styles.generateBtnText}>{loading ? 'Loading...' : 'Generate Statement'}</Text>
                    </Pressable>
                </View>

                {loading && (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={colors.primary} />
                    </View>
                )}

                {statement && !loading && (
                    <>
                        {/* Farmer Info */}
                        <View style={styles.farmerCard}>
                            <Text style={styles.farmerName}>{statement.farmer.name}</Text>
                            <Text style={styles.farmerCode}>Code: {statement.farmer.code} | Mobile: {statement.farmer.mobile || 'N/A'}</Text>
                            <Text style={styles.periodText}>
                                <Calendar size={12} color={colors.mutedForeground} /> {new Date(statement.period.startDate).toLocaleDateString()} - {new Date(statement.period.endDate).toLocaleDateString()}
                            </Text>
                        </View>

                        {/* Summary Cards */}
                        <View style={styles.summaryGrid}>
                            <View style={[styles.summaryCard, { backgroundColor: colors.success + '20' }]}>
                                <Text style={styles.summaryLabel}>Total Milk</Text>
                                <Text style={[styles.summaryValue, { color: colors.success }]}>{statement.summary.totalMilk.toFixed(1)} L</Text>
                            </View>
                            <View style={[styles.summaryCard, { backgroundColor: colors.primary + '20' }]}>
                                <Text style={styles.summaryLabel}>Milk Amount</Text>
                                <Text style={[styles.summaryValue, { color: colors.primary }]}>₹{statement.summary.totalMilkAmount.toFixed(0)}</Text>
                            </View>
                        </View>

                        <View style={styles.summaryGrid}>
                            <View style={[styles.summaryCard, { backgroundColor: colors.warning + '20' }]}>
                                <Text style={styles.summaryLabel}>Payments</Text>
                                <Text style={[styles.summaryValue, { color: colors.warning }]}>₹{statement.summary.totalPayments.toFixed(0)}</Text>
                            </View>
                            <View style={[styles.summaryCard, { backgroundColor: colors.destructive + '20' }]}>
                                <Text style={styles.summaryLabel}>Balance Due</Text>
                                <Text style={[styles.summaryValue, { color: colors.destructive }]}>₹{statement.summary.closingBalance.toFixed(0)}</Text>
                            </View>
                        </View>

                        {/* Statement Table */}
                        <View style={styles.tableCard}>
                            <Text style={styles.tableTitle}>Transactions ({statement.statement.length})</Text>

                            <View style={styles.tableHeader}>
                                <Text style={[styles.tableHeaderText, { flex: 0.8 }]}>Date</Text>
                                <Text style={[styles.tableHeaderText, { flex: 1.5 }]}>Description</Text>
                                <Text style={[styles.tableHeaderText, { flex: 0.6 }]}>Cr</Text>
                                <Text style={[styles.tableHeaderText, { flex: 0.6 }]}>Dr</Text>
                                <Text style={[styles.tableHeaderText, { flex: 0.6 }]}>Bal</Text>
                            </View>

                            {statement.statement.map((item, idx) => (
                                <View key={idx} style={[styles.tableRow, idx % 2 === 0 && { backgroundColor: colors.secondary }]}>
                                    <Text style={[styles.tableCell, { flex: 0.8 }]}>{new Date(item.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</Text>
                                    <Text style={[styles.tableCell, { flex: 1.5 }]} numberOfLines={1}>{item.description}</Text>
                                    <Text style={[styles.tableCell, { flex: 0.6, color: colors.success }]}>{item.credit > 0 ? item.credit.toFixed(0) : '-'}</Text>
                                    <Text style={[styles.tableCell, { flex: 0.6, color: colors.destructive }]}>{item.debit > 0 ? item.debit.toFixed(0) : '-'}</Text>
                                    <Text style={[styles.tableCell, { flex: 0.6, fontWeight: '600' }]}>{item.balance.toFixed(0)}</Text>
                                </View>
                            ))}
                        </View>

                        {/* Share Button */}
                        <Pressable style={styles.shareButton} onPress={handleSharePdf}>
                            <Share2 size={18} color={colors.white} />
                            <Text style={styles.shareButtonText}>Share PDF Statement</Text>
                        </Pressable>
                    </>
                )}
            </ScrollView>
        </View>
    );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12, paddingTop: 50, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
    backBtn: { marginRight: 12 },
    headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: colors.foreground },
    shareBtn: { padding: 8 },
    scrollView: { flex: 1 },
    scrollContent: { padding: 12, paddingBottom: 40 },
    searchCard: { backgroundColor: colors.card, borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: colors.border },
    cardTitle: { fontSize: 16, fontWeight: '700', color: colors.foreground, marginBottom: 12 },
    inputLabel: { fontSize: 12, fontWeight: '600', color: colors.mutedForeground, marginBottom: 6 },
    input: { backgroundColor: colors.secondary, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: colors.foreground, marginBottom: 12 },
    dateRow: { flexDirection: 'row', gap: 12 },
    dateField: { flex: 1 },
    generateBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 14, gap: 8, marginTop: 8 },
    generateBtnText: { color: colors.white, fontSize: 15, fontWeight: '600' },
    loadingContainer: { paddingVertical: 40, alignItems: 'center' },
    farmerCard: { backgroundColor: colors.card, borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
    farmerName: { fontSize: 20, fontWeight: '700', color: colors.foreground, marginBottom: 4 },
    farmerCode: { fontSize: 13, color: colors.mutedForeground, marginBottom: 8 },
    periodText: { fontSize: 12, color: colors.mutedForeground },
    summaryGrid: { flexDirection: 'row', gap: 10, marginBottom: 10 },
    summaryCard: { flex: 1, borderRadius: 10, padding: 14, alignItems: 'center' },
    summaryLabel: { fontSize: 11, color: colors.mutedForeground, marginBottom: 4 },
    summaryValue: { fontSize: 18, fontWeight: '700' },
    tableCard: { backgroundColor: colors.card, borderRadius: 12, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: colors.border },
    tableTitle: { fontSize: 14, fontWeight: '700', color: colors.foreground, marginBottom: 12 },
    tableHeader: { flexDirection: 'row', backgroundColor: colors.primary, borderRadius: 6, padding: 8 },
    tableHeaderText: { fontSize: 10, fontWeight: '600', color: colors.white },
    tableRow: { flexDirection: 'row', padding: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
    tableCell: { fontSize: 11, color: colors.foreground },
    shareButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.success, borderRadius: 10, paddingVertical: 14, gap: 8 },
    shareButtonText: { color: colors.white, fontSize: 15, fontWeight: '600' },
});
