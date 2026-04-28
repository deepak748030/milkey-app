import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, ToastAndroid, Platform } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { useLocalSearchParams, router } from 'expo-router';
import { ChevronLeft, Download, Printer } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { memberPaymentsApi, printSettingsApi, PrintSettings, MemberPayment } from '@/lib/milkeyApi';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useBluetoothPrinter } from '@/hooks/useBluetoothPrinter';
import { brandedFooter, brandedHeader, twoCol, line as fmtLine, feed } from '@/lib/printFormat';

export default function SellingPaymentSlipScreen() {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const { paymentId, autoPrint } = useLocalSearchParams<{ paymentId: string; autoPrint?: string }>();
    const [loading, setLoading] = useState(true);
    const [payment, setPayment] = useState<MemberPayment | null>(null);
    const [printSettings, setPrintSettings] = useState<PrintSettings | null>(null);
    const [downloading, setDownloading] = useState(false);
    const autoPrintDoneRef = useRef(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [psRes] = await Promise.all([
                printSettingsApi.get(),
            ]);
            if (psRes.success && psRes.response) setPrintSettings(psRes.response);

            if (paymentId) {
                const res = await memberPaymentsApi.getAll({ limit: 100 });
                if (res.success && res.response?.data) {
                    const found = res.response.data.find((p: MemberPayment) => p._id === paymentId);
                    if (found) setPayment(found);
                }
            }
        } catch (e) {
            console.error('Error fetching payment slip data:', e);
        } finally {
            setLoading(false);
        }
    };

    const formatDateDDMMYYYY = (dateStr: string) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
    };

    const generateHtml = () => {
        if (!payment) return '';
        const p = payment;
        const dairyName = printSettings?.dairyName || 'Payment Slip';
        const showMobile = printSettings?.showMobileOnReceipt !== false;
        const mobile = printSettings?.mobileNumber || '';
        const address = printSettings?.address || '';
        const milkQty = (Number(p.totalQuantity) || 0).toFixed(1);
        const milkRate = (Number(p.milkRate) || 0).toFixed(2);

        return `
            <html>
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: 'Courier New', monospace; padding: 20px; max-width: 380px; margin: 0 auto; }
                    .center { text-align: center; }
                    .title { font-size: clamp(13px, 5vw, 18px); font-weight: bold; margin-bottom: 4px; white-space: nowrap; text-transform: uppercase; }
                    .subtitle { font-size: 12px; color: #666; margin-bottom: 2px; }
                    .info-row { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 13px; }
                    .info-row .value { color: #d32f2f; font-weight: 600; }
                    .info-row .value-black { color: #333; font-weight: 600; }
                    .separator { text-align: center; margin: 10px 0; color: #999; font-size: 11px; letter-spacing: 1px; }
                    .amount-row { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 14px; }
                    .amount-row .value { font-weight: 600; text-align: right; min-width: 100px; }
                    .amount-row .value-black { font-weight: 600; text-align: right; min-width: 100px; color: #333; }
                    .generated { text-align: center; font-size: 12px; color: #666; margin-top: 8px; }
                    .note { text-align: center; font-size: 11px; color: #888; margin-top: 6px; font-style: italic; }
                </style>
            </head>
            <body>
                <div class="center title">${dairyName}</div>
                ${address ? `<div class="center subtitle">${address}</div>` : ''}
                ${showMobile && mobile ? `<div class="center subtitle">📞 ${mobile}</div>` : ''}
                <div class="separator">${'*'.repeat(40)}</div>
                <div class="info-row"><span>From :</span><span class="value">${formatDateDDMMYYYY(p.periodStart || p.date)}</span></div>
                <div class="info-row"><span>Till :</span><span class="value">${formatDateDDMMYYYY(p.periodEnd || p.date)}</span></div>
                <div class="info-row"><span>Member :</span><span class="value">${p.member?.name || '—'}</span></div>
                <div class="separator">${'*'.repeat(40)}</div>
                <div class="amount-row"><span>Last Payment :</span><span class="value-black">${(p.previousBalance || 0).toFixed(0)}</span></div>
                <div class="amount-row"><span>Milk Quantity :</span><span class="value-black">${milkQty} L</span></div>
                <div class="amount-row"><span>Milk Rate :</span><span class="value-black">₹${milkRate}/L</span></div>
                <div class="amount-row"><span>Total Milk Amount :</span><span class="value-black">${(p.totalSellAmount || 0).toFixed(0)}</span></div>
                <div class="amount-row"><span>Total Payable :</span><span class="value-black">${(p.netPayable || 0).toFixed(0)}</span></div>
                <div class="amount-row"><span>Paid Amount :</span><span class="value-black">${(p.amount || 0).toFixed(0)}</span></div>
                <div class="separator">${'*'.repeat(40)}</div>
                <div class="amount-row"><span><b>Closing Balance :</b></span><span class="value-black" style="color: ${(p.closingBalance || 0) < 0 ? '#d32f2f' : '#333'}"><b>${(p.closingBalance || 0).toFixed(0)}</b></span></div>
                <div class="separator">${'*'.repeat(40)}</div>
                ${printSettings?.extraInfo?.trim() ? `<div class="note">${printSettings.extraInfo.trim()}</div>` : ''}
                <div class="generated">Generated Date: ${new Date().toLocaleDateString('en-IN')}</div>
                <div class="generated">Thank You!</div>
            </body>
            </html>
        `;
    };

    const handleDownloadPdf = async () => {
        if (!payment) return;
        setDownloading(true);
        try {
            const html = generateHtml();
            const { uri } = await Print.printToFileAsync({ html, width: 380 });
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Payment Slip' });
            }
        } catch (e) {
            console.error('PDF error:', e);
        } finally {
            setDownloading(false);
        }
    };

    const { printText, isConnected: isPrinterConnected, error: printerError } = useBluetoothPrinter();

    const formatDateDDMMYYYYLocal = (dateStr: string) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    };

    const generateThermalPayload = () => {
        if (!payment) return '';
        const p = payment;
        const milkQty = (Number(p.totalQuantity) || 0).toFixed(1);
        const milkRate = (Number(p.milkRate) || 0).toFixed(2);

        let payload = '';
        payload += brandedHeader({
            dairyName: printSettings?.dairyName || 'Payment Slip',
            address: printSettings?.address || '',
            mobileNumber: printSettings?.mobileNumber || '',
            showMobileOnReceipt: printSettings?.showMobileOnReceipt !== false,
        });
        payload += twoCol('From:', formatDateDDMMYYYYLocal(p.periodStart || p.date));
        payload += twoCol('Till:', formatDateDDMMYYYYLocal(p.periodEnd || p.date));
        payload += twoCol('Member:', p.member?.name || '-');
        payload += feed(1);
        payload += fmtLine();
        payload += twoCol('Last Payment:', (p.previousBalance || 0).toFixed(0));
        payload += twoCol('Milk Qty:', milkQty + ' L');
        payload += twoCol('Milk Rate:', 'Rs ' + milkRate + '/L');
        payload += twoCol('Milk Amount:', (p.totalSellAmount || 0).toFixed(0));
        payload += twoCol('Total Payable:', (p.netPayable || 0).toFixed(0));
        payload += twoCol('Paid Amount:', (p.amount || 0).toFixed(0));
        payload += fmtLine();
        payload += twoCol('Closing Bal:', (p.closingBalance || 0).toFixed(0), { bold: true });
        payload += brandedFooter(printSettings?.extraInfo?.trim());
        return payload;
    };

    const showToast = (msg: string) => {
        if (Platform.OS === 'android') ToastAndroid.show(msg, ToastAndroid.SHORT);
    };

    const handlePrint = async () => {
        if (!payment) return;
        if (!isPrinterConnected) {
            showToast('Printer not connected');
            return;
        }

        const success = await printText(generateThermalPayload());
        if (success) return;

        showToast(printerError || 'Print failed');
    };

    useEffect(() => {
        if (loading || !payment || !printSettings || autoPrint !== '1' || autoPrintDoneRef.current) return;
        autoPrintDoneRef.current = true;
        handlePrint();
    }, [loading, payment, printSettings, autoPrint]);

    const p = payment;

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={[styles.header, { paddingTop: insets.top + 6, backgroundColor: colors.card, borderBottomWidth: 1.5, borderBottomColor: colors.primary }]}>
                <Pressable onPress={() => router.back()} style={styles.backBtn}>
                    <ChevronLeft size={22} color={colors.foreground} />
                </Pressable>
                <Text style={[styles.headerTitle, { color: colors.foreground }]} numberOfLines={1}>
                    Payment Slip
                </Text>
                <View style={styles.headerActions}>
                    <Pressable onPress={handleDownloadPdf} style={[styles.headerActionBtn, { borderColor: colors.border }]}>
                        {downloading ? <ActivityIndicator size="small" color={colors.primary} /> : <Download size={18} color={colors.primary} />}
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
            ) : !p ? (
                <View style={styles.emptyContainer}>
                    <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Payment not found</Text>
                </View>
            ) : (
                <ScrollView style={styles.scrollView} contentContainerStyle={{ paddingHorizontal: 6, paddingTop: 6, paddingBottom: insets.bottom + 20 }}>
                    {/* Slip Card */}
                    <View style={[styles.slipCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Text style={[styles.slipTitle, { color: colors.primary }]}>{printSettings?.dairyName || 'Payment Slip'}</Text>
                        {printSettings?.address ? <Text style={[styles.slipSub, { color: colors.mutedForeground }]}>{printSettings.address}</Text> : null}

                        <View style={[styles.divider, { backgroundColor: colors.border }]} />

                        <View style={styles.slipRow}>
                            <Text style={[styles.slipLabel, { color: colors.mutedForeground }]}>From</Text>
                            <Text style={[styles.slipValue, { color: colors.destructive }]}>{formatDateDDMMYYYY(p.periodStart || p.date)}</Text>
                        </View>
                        <View style={styles.slipRow}>
                            <Text style={[styles.slipLabel, { color: colors.mutedForeground }]}>Till</Text>
                            <Text style={[styles.slipValue, { color: colors.destructive }]}>{formatDateDDMMYYYY(p.periodEnd || p.date)}</Text>
                        </View>
                        <View style={styles.slipRow}>
                            <Text style={[styles.slipLabel, { color: colors.mutedForeground }]}>Member</Text>
                            <Text style={[styles.slipValue, { color: colors.foreground, fontWeight: '700' }]}>{p.member?.name || '—'}</Text>
                        </View>

                        <View style={[styles.divider, { backgroundColor: colors.border }]} />

                        <View style={styles.slipRow}>
                            <Text style={[styles.slipLabel, { color: colors.mutedForeground }]}>Last Payment</Text>
                            <Text style={[styles.slipValue, { color: colors.foreground }]}>₹{(p.previousBalance || 0).toFixed(0)}</Text>
                        </View>
                        <View style={styles.slipRow}>
                            <Text style={[styles.slipLabel, { color: colors.mutedForeground }]}>Milk Quantity</Text>
                            <Text style={[styles.slipValue, { color: colors.foreground }]}>{(Number(p.totalQuantity) || 0).toFixed(1)} L</Text>
                        </View>
                        <View style={styles.slipRow}>
                            <Text style={[styles.slipLabel, { color: colors.mutedForeground }]}>Milk Rate</Text>
                            <Text style={[styles.slipValue, { color: colors.foreground }]}>₹{(Number(p.milkRate) || 0).toFixed(2)}/L</Text>
                        </View>
                        <View style={styles.slipRow}>
                            <Text style={[styles.slipLabel, { color: colors.mutedForeground }]}>Total Milk Amount</Text>
                            <Text style={[styles.slipValue, { color: colors.primary }]}>₹{(p.totalSellAmount || 0).toFixed(0)}</Text>
                        </View>
                        <View style={styles.slipRow}>
                            <Text style={[styles.slipLabel, { color: colors.mutedForeground }]}>Total Payable</Text>
                            <Text style={[styles.slipValue, { color: colors.foreground }]}>₹{(p.netPayable || 0).toFixed(0)}</Text>
                        </View>
                        <View style={styles.slipRow}>
                            <Text style={[styles.slipLabel, { color: colors.mutedForeground }]}>Paid Amount</Text>
                            <Text style={[styles.slipValue, { color: colors.success || colors.primary }]}>₹{(p.amount || 0).toFixed(0)}</Text>
                        </View>

                        <View style={[styles.divider, { backgroundColor: colors.border }]} />

                        <View style={[styles.slipRow, { paddingVertical: 8 }]}>
                            <Text style={[styles.slipLabel, { fontWeight: '700', color: colors.foreground }]}>Closing Balance</Text>
                            <Text style={[styles.slipValue, { fontWeight: '700', fontSize: 16, color: (p.closingBalance || 0) < 0 ? colors.destructive : colors.primary }]}>
                                {(p.closingBalance || 0) < 0 ? '-' : ''}₹{Math.abs(p.closingBalance || 0).toFixed(0)}
                            </Text>
                        </View>
                    </View>

                    {/* Bottom buttons */}
                    <View style={styles.bottomActions}>
                        <Pressable style={[styles.actionBtn, { backgroundColor: colors.primary }]} onPress={handleDownloadPdf}>
                            {downloading ? <ActivityIndicator size="small" color="#fff" /> : (
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
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingBottom: 10 },
    backBtn: { padding: 6, marginRight: 6 },
    headerTitle: { flex: 1, fontSize: 17, fontWeight: '700' },
    headerActions: { flexDirection: 'row', gap: 6 },
    headerActionBtn: { width: 36, height: 36, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyText: { fontSize: 14 },
    scrollView: { flex: 1 },
    slipCard: { borderRadius: 10, borderWidth: 1, padding: 14, marginBottom: 6 },
    slipTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 2 },
    slipSub: { fontSize: 12, textAlign: 'center', marginBottom: 2 },
    divider: { height: 1, marginVertical: 10 },
    slipRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
    slipLabel: { fontSize: 13 },
    slipValue: { fontSize: 13, fontWeight: '600' },
    bottomActions: { flexDirection: 'row', gap: 10, marginTop: 6 },
    actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 8, gap: 6 },
    actionBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },
});
