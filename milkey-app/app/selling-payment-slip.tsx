import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, ToastAndroid, Platform } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { useLocalSearchParams, router } from 'expo-router';
import { ChevronLeft, Download, Printer, MessageCircle } from 'lucide-react-native';
import { shareViaWhatsapp, paymentSlipText } from '@/lib/whatsappShare';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { memberPaymentsApi, printSettingsApi, PrintSettings, MemberPayment } from '@/lib/milkeyApi';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useBluetoothPrinter } from '@/hooks/useBluetoothPrinter';
import { brandedFooter, brandedHeader, twoCol, labelValueWrap, line as fmtLine, feed } from '@/lib/printFormat';
import { getSlipLabels } from '@/lib/printTranslations';

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
                const res = await memberPaymentsApi.getAll({ limit: 10 });
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
        const t = getSlipLabels();
        const dairyName = printSettings?.dairyName || t.paymentSlip;
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
                    body { font-family: 'Noto Sans Devanagari', 'Mangal', 'Courier New', monospace; padding: 20px; max-width: 380px; margin: 0 auto; }
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
                <div class="info-row"><span>${t.from} :</span><span class="value">${formatDateDDMMYYYY(p.periodStart || p.date)}</span></div>
                <div class="info-row"><span>${t.till} :</span><span class="value">${formatDateDDMMYYYY(p.periodEnd || p.date)}</span></div>
                <div class="info-row"><span>${t.member} :</span><span class="value">${p.member?.name || '—'}</span></div>
                <div class="separator">${'*'.repeat(40)}</div>
                <div class="amount-row"><span>${t.lastPayment} :</span><span class="value-black">${(p.previousBalance || 0).toFixed(0)}</span></div>
                <div class="amount-row"><span>${t.milkQuantity} :</span><span class="value-black">${milkQty} L</span></div>
                <div class="amount-row"><span>${t.milkRate} :</span><span class="value-black">₹${milkRate}/L</span></div>
                <div class="amount-row"><span>${t.milkAmount} :</span><span class="value-black">${(p.totalSellAmount || 0).toFixed(0)}</span></div>
                <div class="amount-row"><span>${t.totalPayable} :</span><span class="value-black">${(p.netPayable || 0).toFixed(0)}</span></div>
                <div class="amount-row"><span>${t.paidAmount} :</span><span class="value-black">${(p.amount || 0).toFixed(0)}</span></div>
                <div class="separator">${'*'.repeat(40)}</div>
                <div class="amount-row"><span><b>${t.closingBalance} :</b></span><span class="value-black" style="color: ${(p.closingBalance || 0) < 0 ? '#d32f2f' : '#333'}"><b>${(p.closingBalance || 0).toFixed(0)}</b></span></div>
                <div class="separator">${'*'.repeat(40)}</div>
                ${printSettings?.extraInfo?.trim() ? `<div class="note">${printSettings.extraInfo.trim()}</div>` : ''}
                <div class="generated">${t.generatedDate}: ${new Date().toLocaleDateString('en-IN')}</div>
                <div class="generated">${t.thankYou}</div>
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
        const t = getSlipLabels();
        const milkQty = (Number(p.totalQuantity) || 0).toFixed(1);
        const milkRate = (Number(p.milkRate) || 0).toFixed(2);

        let payload = '';
        payload += brandedHeader({
            dairyName: printSettings?.dairyName || t.paymentSlip,
            address: printSettings?.address || '',
            mobileNumber: printSettings?.mobileNumber || '',
            showMobileOnReceipt: printSettings?.showMobileOnReceipt !== false,
        });
        payload += twoCol(`${t.from}:`, formatDateDDMMYYYYLocal(p.periodStart || p.date));
        payload += twoCol(`${t.till}:`, formatDateDDMMYYYYLocal(p.periodEnd || p.date));
        payload += labelValueWrap(`${t.member}:`, p.member?.name || '-');
        payload += feed(1);
        payload += fmtLine();
        payload += twoCol(`${t.lastPayment}:`, (p.previousBalance || 0).toFixed(0));
        payload += twoCol(`${t.qty}:`, milkQty + ' L');
        payload += twoCol(`${t.rate}:`, 'Rs ' + milkRate + '/L');
        payload += twoCol(`${t.milkAmount}:`, (p.totalSellAmount || 0).toFixed(0));
        payload += twoCol(`${t.totalPayable}:`, (p.netPayable || 0).toFixed(0));
        payload += twoCol(`${t.paidAmount}:`, (p.amount || 0).toFixed(0));
        payload += fmtLine();
        payload += twoCol(`${t.closingBal}:`, (p.closingBalance || 0).toFixed(0), { bold: true });
        payload += brandedFooter(printSettings?.extraInfo?.trim() || t.thankYou);
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
    const t = getSlipLabels();

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={[styles.header, { paddingTop: insets.top + 6, backgroundColor: colors.card, borderBottomWidth: 1.5, borderBottomColor: colors.primary }]}>
                <Pressable onPress={() => router.back()} style={styles.backBtn}>
                    <ChevronLeft size={22} color={colors.foreground} />
                </Pressable>
                <Text style={[styles.headerTitle, { color: colors.foreground }]} numberOfLines={1}>
                    {t.paymentSlip}
                </Text>
                <View style={styles.headerActions}>
                    <Pressable onPress={handleDownloadPdf} style={[styles.headerActionBtn, { borderColor: colors.border }]}>
                        {downloading ? <ActivityIndicator size="small" color={colors.primary} /> : <Download size={18} color={colors.primary} />}
                    </Pressable>
                    <Pressable onPress={handlePrint} style={[styles.headerActionBtn, { borderColor: colors.border }]}>
                        <Printer size={18} color={colors.primary} />
                    </Pressable>
                    <Pressable onPress={async()=>{ if(!p) return; const txt=paymentSlipText({code:(p as any).member?.name?.slice(0,4).toUpperCase()||'',name:(p as any).member?.name||''},{start:formatDateDDMMYYYY((p as any).periodStart),end:formatDateDDMMYYYY((p as any).periodEnd)}, (p as any).totalMilkAmount||0, (p as any).totalAdvanceDeduction||0, (p as any).netPayable||0, (p as any).amount||0, (p as any).closingBalance||0); await shareViaWhatsapp((p as any).member?.mobile||'', txt); }} style={[styles.headerActionBtn, { borderColor: colors.border, backgroundColor: '#25D36615' }]}>
                        <MessageCircle size={18} color="#25D366" />
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
                        <Text style={[styles.slipTitle, { color: colors.primary }]}>{printSettings?.dairyName || t.paymentSlip}</Text>
                        {printSettings?.address ? <Text style={[styles.slipSub, { color: colors.mutedForeground }]}>{printSettings.address}</Text> : null}

                        <View style={[styles.divider, { backgroundColor: colors.border }]} />

                        <View style={styles.slipRow}>
                            <Text style={[styles.slipLabel, { color: colors.mutedForeground }]}>{t.from}</Text>
                            <Text style={[styles.slipValue, { color: colors.destructive }]}>{formatDateDDMMYYYY(p.periodStart || p.date)}</Text>
                        </View>
                        <View style={styles.slipRow}>
                            <Text style={[styles.slipLabel, { color: colors.mutedForeground }]}>{t.till}</Text>
                            <Text style={[styles.slipValue, { color: colors.destructive }]}>{formatDateDDMMYYYY(p.periodEnd || p.date)}</Text>
                        </View>
                        <View style={styles.slipRow}>
                            <Text style={[styles.slipLabel, { color: colors.mutedForeground }]}>{t.member}</Text>
                            <Text style={[styles.slipValue, { color: colors.foreground, fontWeight: '700' }]}>{p.member?.name || '—'}</Text>
                        </View>

                        <View style={[styles.divider, { backgroundColor: colors.border }]} />

                        <View style={styles.slipRow}>
                            <Text style={[styles.slipLabel, { color: colors.mutedForeground }]}>{t.lastPayment}</Text>
                            <Text style={[styles.slipValue, { color: colors.foreground }]}>₹{(p.previousBalance || 0).toFixed(0)}</Text>
                        </View>
                        <View style={styles.slipRow}>
                            <Text style={[styles.slipLabel, { color: colors.mutedForeground }]}>{t.milkQuantity}</Text>
                            <Text style={[styles.slipValue, { color: colors.foreground }]}>{(Number(p.totalQuantity) || 0).toFixed(1)} L</Text>
                        </View>
                        <View style={styles.slipRow}>
                            <Text style={[styles.slipLabel, { color: colors.mutedForeground }]}>{t.milkRate}</Text>
                            <Text style={[styles.slipValue, { color: colors.foreground }]}>₹{(Number(p.milkRate) || 0).toFixed(2)}/L</Text>
                        </View>
                        <View style={styles.slipRow}>
                            <Text style={[styles.slipLabel, { color: colors.mutedForeground }]}>{t.milkAmount}</Text>
                            <Text style={[styles.slipValue, { color: colors.primary }]}>₹{(p.totalSellAmount || 0).toFixed(0)}</Text>
                        </View>
                        <View style={styles.slipRow}>
                            <Text style={[styles.slipLabel, { color: colors.mutedForeground }]}>{t.totalPayable}</Text>
                            <Text style={[styles.slipValue, { color: colors.foreground }]}>₹{(p.netPayable || 0).toFixed(0)}</Text>
                        </View>
                        <View style={styles.slipRow}>
                            <Text style={[styles.slipLabel, { color: colors.mutedForeground }]}>{t.paidAmount}</Text>
                            <Text style={[styles.slipValue, { color: colors.success || colors.primary }]}>₹{(p.amount || 0).toFixed(0)}</Text>
                        </View>

                        <View style={[styles.divider, { backgroundColor: colors.border }]} />

                        <View style={[styles.slipRow, { paddingVertical: 8 }]}>
                            <Text style={[styles.slipLabel, { fontWeight: '700', color: colors.foreground }]}>{t.closingBalance}</Text>
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
