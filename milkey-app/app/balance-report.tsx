import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { useLocalSearchParams, router } from 'expo-router';
import { ChevronLeft, Download, Printer } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { farmersApi, printSettingsApi, PrintSettings, Farmer } from '@/lib/milkeyApi';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

export default function BalanceReportScreen() {
    const { colors, isDark } = useTheme();
    const insets = useSafeAreaInsets();
    const { type } = useLocalSearchParams<{ type: 'positive' | 'negative' }>();
    const [loading, setLoading] = useState(true);
    const [farmers, setFarmers] = useState<Farmer[]>([]);
    const [printSettings, setPrintSettings] = useState<PrintSettings | null>(null);
    const [downloading, setDownloading] = useState(false);

    const balanceType = type || 'positive';

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [farmersRes, psRes] = await Promise.all([
                farmersApi.getAll(),
                printSettingsApi.get(),
            ]);

            if (farmersRes.success && farmersRes.response?.data) {
                const getBalance = (farmer: Farmer) => Number(farmer.currentBalance ?? farmer.pendingAmount ?? 0);
                const filtered = farmersRes.response.data.filter((farmer: Farmer) => {
                    const balance = getBalance(farmer);
                    if (balanceType === 'positive') return balance > 0;
                    return balance < 0;
                });
                const sorted = [...filtered].sort((a, b) => {
                    const cA = parseInt(a.code, 10) || 0;
                    const cB = parseInt(b.code, 10) || 0;
                    return cA - cB;
                });
                setFarmers(sorted);
            }

            if (psRes.success && psRes.response) {
                setPrintSettings(psRes.response);
            }
        } catch (e) {
            console.error('Error fetching balance report data:', e);
        } finally {
            setLoading(false);
        }
    };

    const getBalance = (farmer: Farmer) => Number(farmer.currentBalance ?? farmer.pendingAmount ?? 0);
    const totalBalance = farmers.reduce((sum, f) => sum + getBalance(f), 0);

    const generateHtml = () => {
        const dairyName = printSettings?.dairyName || 'Dairy';
        const showMobile = printSettings?.showMobileOnReceipt !== false;
        const mobileNumber = printSettings?.mobileNumber || '';
        const address = printSettings?.address || '';
        const extraInfo = printSettings?.extraInfo || '';

        const rows = farmers.map((farmer) => {
            const balance = getBalance(farmer);
            return `
            <tr>
                <td style="text-align:center;">${farmer.code}</td>
                <td>${farmer.name}</td>
                <td style="text-align:right; color: ${balance < 0 ? '#d32f2f' : '#333'}; font-weight:600;">₹${balance.toFixed(2)}</td>
            </tr>`;
        }).join('');

        return `
            <html>
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: Arial, sans-serif; padding: 16px; }
                    .header { text-align: center; margin-bottom: 12px; }
                    .header h1 { font-size: 18px; color: #22C55E; margin-bottom: 4px; }
                    .header p { font-size: 12px; color: #666; }
                    .type-badge { display: inline-block; padding: 4px 12px; border-radius: 4px; font-size: 13px; font-weight: 700; margin: 8px 0; }
                    .positive { background: #DCFCE7; color: #16A34A; }
                    .negative { background: #FEE2E2; color: #DC2626; }
                    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
                    th, td { border: 1px solid #ddd; padding: 6px 8px; font-size: 12px; }
                    th { background-color: #22C55E; color: white; }
                    tr:nth-child(even) { background-color: #f9f9f9; }
                    .total-row { font-weight: 700; background: #f0fdf4 !important; }
                    .footer { text-align: center; font-size: 11px; color: #999; margin-top: 12px; }
                    .note { text-align: center; font-size: 11px; color: #888; margin-top: 6px; font-style: italic; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>${dairyName}</h1>
                    ${address ? `<p>${address}</p>` : ''}
                    ${showMobile && mobileNumber ? `<p>📞 ${mobileNumber}</p>` : ''}
                </div>
                <div style="text-align:center;">
                    <span class="type-badge ${balanceType}">${balanceType === 'positive' ? 'Positive Balance' : 'Negative Balance'} Report</span>
                </div>
                <table>
                    <tr>
                        <th style="width:60px;">Code</th>
                        <th>Farmer Name</th>
                        <th style="width:110px; text-align:right;">Current Balance</th>
                    </tr>
                    ${rows}
                    <tr class="total-row">
                        <td colspan="2" style="text-align:right;">Total (${farmers.length} farmers):</td>
                        <td style="text-align:right; color: ${totalBalance < 0 ? '#d32f2f' : '#333'};">₹${totalBalance.toFixed(2)}</td>
                    </tr>
                </table>
                <div class="footer">Generated: ${new Date().toLocaleDateString('en-IN')}</div>
                ${extraInfo ? `<div class="note">${extraInfo}</div>` : ''}
            </body>
            </html>
        `;
    };

    const handleDownloadPdf = async () => {
        if (farmers.length === 0) return;
        setDownloading(true);
        try {
            const html = generateHtml();
            const { uri } = await Print.printToFileAsync({ html });
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri, {
                    mimeType: 'application/pdf',
                    dialogTitle: `${balanceType === 'positive' ? 'Positive' : 'Negative'} Balance Report`,
                });
            }
        } catch (e) {
            console.error('PDF error:', e);
        } finally {
            setDownloading(false);
        }
    };

    const handlePrint = async () => {
        if (farmers.length === 0) return;
        try {
            const html = generateHtml();
            await Print.printAsync({ html });
        } catch (e) {
            console.error('Print error:', e);
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={[styles.header, {
                paddingTop: insets.top + 6,
                backgroundColor: colors.card,
                borderBottomWidth: 1.5,
                borderBottomColor: colors.primary,
            }]}>
                <Pressable onPress={() => router.back()} style={styles.backBtn}>
                    <ChevronLeft size={22} color={colors.foreground} />
                </Pressable>
                <Text style={[styles.headerTitle, { color: colors.foreground }]} numberOfLines={1}>
                    {balanceType === 'positive' ? 'Positive' : 'Negative'} Balance Report
                </Text>
                <View style={styles.headerActions}>
                    <Pressable onPress={handleDownloadPdf} style={[styles.headerActionBtn, { borderColor: colors.border }]}>
                        {downloading ? (
                            <ActivityIndicator size="small" color={colors.primary} />
                        ) : (
                            <Download size={18} color={colors.primary} />
                        )}
                    </Pressable>
                    <Pressable onPress={handlePrint} style={[styles.headerActionBtn, { borderColor: colors.border }]}>
                        <Printer size={18} color={colors.primary} />
                    </Pressable>
                </View>
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : farmers.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                        No farmers with {balanceType} balance found
                    </Text>
                </View>
            ) : (
                <ScrollView style={styles.scrollView} contentContainerStyle={{ paddingHorizontal: 6, paddingTop: 6, paddingBottom: insets.bottom + 20 }}>
                    {/* Summary */}
                    <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <View style={styles.summaryRow}>
                            <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Total Farmers</Text>
                            <Text style={[styles.summaryValue, { color: colors.foreground }]}>{farmers.length}</Text>
                        </View>
                        <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
                        <View style={styles.summaryRow}>
                            <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Total Balance</Text>
                            <Text style={[styles.summaryValue, { color: totalBalance < 0 ? colors.destructive : colors.primary }]}>
                                ₹{totalBalance.toFixed(2)}
                            </Text>
                        </View>
                    </View>

                    {/* Table */}
                    <View style={[styles.tableCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <View style={[styles.tableHeader, { backgroundColor: colors.primary }]}>
                            <Text style={[styles.tableHeaderCell, { flex: 0.5 }]}>Code</Text>
                            <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>Farmer Name</Text>
                            <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'right' }]}>Balance</Text>
                        </View>
                        {farmers.map((farmer, idx) => {
                            const balance = getBalance(farmer);
                            return (
                                <View key={farmer._id || idx} style={[styles.tableRow, idx % 2 === 0 && { backgroundColor: colors.secondary }]}>
                                    <Text style={[styles.tableCell, { flex: 0.5, color: colors.primary, fontWeight: '600' }]}>{farmer.code}</Text>
                                    <Text style={[styles.tableCell, { flex: 1.5, color: colors.foreground }]}>{farmer.name}</Text>
                                    <Text style={[styles.tableCell, { flex: 1, textAlign: 'right', fontWeight: '600', color: balance < 0 ? colors.destructive : colors.primary }]}>
                                        ₹{balance.toFixed(2)}
                                    </Text>
                                </View>
                            );
                        })}
                        {/* Total row */}
                        <View style={[styles.tableRow, { backgroundColor: colors.primary + '10', borderTopWidth: 1, borderTopColor: colors.border }]}>
                            <Text style={[styles.tableCell, { flex: 0.5, fontWeight: '700', color: colors.foreground }]}></Text>
                            <Text style={[styles.tableCell, { flex: 1.5, fontWeight: '700', color: colors.foreground, textAlign: 'right' }]}>Total ({farmers.length}):</Text>
                            <Text style={[styles.tableCell, { flex: 1, textAlign: 'right', fontWeight: '700', color: totalBalance < 0 ? colors.destructive : colors.primary }]}>
                                ₹{totalBalance.toFixed(2)}
                            </Text>
                        </View>
                    </View>

                    {/* Bottom buttons */}
                    <View style={styles.bottomActions}>
                        <Pressable style={[styles.actionBtn, { backgroundColor: colors.primary }]} onPress={handleDownloadPdf}>
                            {downloading ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <>
                                    <Download size={18} color="#fff" />
                                    <Text style={styles.actionBtnText}>Download PDF</Text>
                                </>
                            )}
                        </Pressable>
                        <Pressable style={[styles.actionBtn, { backgroundColor: colors.foreground }]} onPress={handlePrint}>
                            <Printer size={18} color={colors.background} />
                            <Text style={[styles.actionBtnText, { color: colors.background }]}>Print</Text>
                        </Pressable>
                    </View>
                </ScrollView>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 6,
        paddingBottom: 10,
    },
    backBtn: { padding: 6, marginRight: 6 },
    headerTitle: { flex: 1, fontSize: 17, fontWeight: '700' },
    headerActions: { flexDirection: 'row', gap: 6 },
    headerActionBtn: {
        width: 36,
        height: 36,
        borderRadius: 8,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyText: { fontSize: 14 },
    scrollView: { flex: 1 },
    summaryCard: {
        flexDirection: 'row',
        borderRadius: 10,
        borderWidth: 1,
        padding: 12,
        marginBottom: 6,
    },
    summaryRow: { flex: 1, alignItems: 'center' },
    summaryLabel: { fontSize: 11, marginBottom: 2 },
    summaryValue: { fontSize: 18, fontWeight: '700' },
    summaryDivider: { width: 1, marginHorizontal: 10 },
    tableCard: {
        borderRadius: 10,
        borderWidth: 1,
        overflow: 'hidden',
        marginBottom: 6,
    },
    tableHeader: {
        flexDirection: 'row',
        paddingHorizontal: 10,
        paddingVertical: 8,
    },
    tableHeaderCell: { fontSize: 12, fontWeight: '600', color: '#fff' },
    tableRow: {
        flexDirection: 'row',
        paddingHorizontal: 10,
        paddingVertical: 7,
        borderBottomWidth: 0.5,
        borderBottomColor: '#e5e5e5',
    },
    tableCell: { fontSize: 12 },
    bottomActions: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 6,
    },
    actionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 8,
        gap: 6,
    },
    actionBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },
});
