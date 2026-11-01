import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, ToastAndroid, Platform } from 'react-native';
import { Pressable } from '@/components/ui/HapticPressable';
import { useTheme } from '@/hooks/useTheme';
import { useLocalSearchParams, router } from 'expo-router';
import { ChevronLeft, Download, Printer, MessageCircle } from 'lucide-react-native';
import { shareViaWhatsapp, paymentSlipText } from '@/lib/whatsappShare';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { paymentsApi, printSettingsApi, PrintSettings, Payment, milkCollectionsApi, MilkCollection } from '@/lib/milkeyApi';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useBluetoothPrinter } from '@/hooks/useBluetoothPrinter';
import { brandedFooter, brandedHeader, twoCol, labelValueWrap, line as fmtLine, feed } from '@/lib/printFormat';
import { getSlipLabels } from '@/lib/printTranslations';
import { buildJointCollectionPaymentSlipPayload } from '@/lib/slipPrint';
import { TZ_OFFSET_MINUTES } from '@/lib/purchaseConstants';

/** Calendar day of an instant/payload in the DEVICE timezone (YYYY-MM-DD).
 *  The API stores period days as instants (e.g. 2026-10-01T06:30Z) — slicing the ISO
 *  string would return the previous UTC day and silently drop the last entries. */
const localDateKey = (value: any) => {
    if (!value) return '';
    const d = new Date(value);
    if (isNaN(d.getTime())) return typeof value === 'string' ? value.slice(0, 10) : '';
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
};

const formatDateDDMMYYYY = (dateStr?: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
};

export default function RegisterPaymentSlipScreen() {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const { paymentId, autoPrint } = useLocalSearchParams<{ paymentId: string; autoPrint?: string }>();
    const [loading, setLoading] = useState(true);
    const [payment, setPayment] = useState<Payment | null>(null);
    const [printSettings, setPrintSettings] = useState<PrintSettings | null>(null);
    const [collections, setCollections] = useState<MilkCollection[]>([]);
    // Server-aggregated totals for the whole query (not page limited) — the same numbers
    // the Payment screen uses for the auto "purchase amount" of the calculation period.
    const [periodTotals, setPeriodTotals] = useState<{ quantity: number; amount: number } | null>(null);
    const [downloading, setDownloading] = useState(false);
    const autoPrintDoneRef = useRef(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [paymentRes, psRes] = await Promise.all([
                paymentId ? paymentsApi.getById(paymentId) : Promise.resolve(null),
                printSettingsApi.get(),
            ]);

            if (paymentRes?.success && paymentRes.response) {
                setPayment(paymentRes.response);
                // Fetch the farmer's PURCHASE (milk collection) entries for the payment
                // period — the exact same query the "View Entries" screen uses, including
                // tzOffsetMinutes. Without the tz offset the server compares the range in
                // UTC and every row stored with a local time silently disappeared, which is
                // why the slip always printed "- No entries -".
                try {
                    const p = paymentRes.response as Payment;
                    const farmerCode = (p.farmer as any)?.code;
                    const start = p.periodStart || p.date;
                    const end = p.periodEnd || p.date;

                    // 1) The exact rows this settlement paid.
                    //    GET /payments/:id populates `settledCollections` with the real
                    //    MilkCollection documents, so this needs no farmer-code lookup and
                    //    no date window — it is exactly the purchase data of the payment.
                    const settledRaw = (p as any).settledCollections;
                    const settledRows: MilkCollection[] = Array.isArray(settledRaw)
                        ? settledRaw.filter((r: any) => r && typeof r === 'object' && r._id && r.date !== undefined)
                        : [];
                    if (settledRows.length > 0) {
                        // Keep the rows that fall inside the Calculation Period; if the
                        // stored period is unusable keep all settled rows.
                        const startKey = localDateKey(start);
                        const endKey = localDateKey(end);
                        const inPeriod = settledRows.filter((r: any) => {
                            const k = localDateKey(r.date);
                            return (!startKey || k >= startKey) && (!endKey || k <= endKey);
                        });
                        const rows = (inPeriod.length > 0 ? inPeriod : settledRows).slice();
                        rows.sort((a: any, b: any) => {
                            const da = new Date(a.date).getTime();
                            const db = new Date(b.date).getTime();
                            if (da !== db) return da - db;
                            const rank = (x: any) => (x?.shift === 'evening' ? 1 : 0);
                            return rank(a) - rank(b);
                        });
                        setCollections(rows);
                        setPeriodTotals({
                            quantity: rows.reduce((sum, r: any) => sum + (Number(r.quantity) || 0), 0),
                            amount: rows.reduce((sum, r: any) => sum + (Number(r.amount) || 0), 0),
                        });
                    } else if (farmerCode) {
                        // Same query as the Payment screen's "View Entries"
                        // (/view-collection-entries): farmer code + calculation period +
                        // tz offset. isPaid:false is what that screen sends; if the rows were
                        // already marked paid (normal right after a settlement) the same
                        // range is fetched again without that filter, so the slip never
                        // loses the purchase entries it was made from.
                        const base: any = {
                            farmerCode,
                            startDate: start ? String(start).slice(0, 10) : undefined,
                            endDate: end ? String(end).slice(0, 10) : undefined,
                            limit: 200,
                            tzOffsetMinutes: TZ_OFFSET_MINUTES,
                        };
                        let rows: MilkCollection[] = [];
                        let totals: any = null;
                        try {
                            const unpaid = await milkCollectionsApi.getAll({ ...base, isPaid: false });
                            if (unpaid.success) {
                                rows = ((unpaid.response as any)?.data || []) as MilkCollection[];
                                totals = (unpaid.response as any)?.totals || null;
                            }
                        } catch { /* fall through to the unfiltered query */ }
                        if (rows.length === 0) {
                            try {
                                const all = await milkCollectionsApi.getAll(base);
                                if (all.success) {
                                    rows = ((all.response as any)?.data || []) as MilkCollection[];
                                    totals = (all.response as any)?.totals || totals;
                                }
                            } catch { }
                        }
                        rows.sort((a: any, b: any) => {
                            const da = new Date(a.date).getTime();
                            const db = new Date(b.date).getTime();
                            if (da !== db) return da - db;
                            const rank = (x: any) => (x?.shift === 'evening' ? 1 : 0);
                            return rank(a) - rank(b);
                        });
                        setCollections(rows);
                        if (totals) {
                            setPeriodTotals({
                                quantity: Number(totals.quantity) || 0,
                                amount: Number(totals.amount) || 0,
                            });
                        }
                    }
                } catch { }
            }

            if (psRes.success && psRes.response) {
                setPrintSettings(psRes.response);
            }
        } catch (e) {
            console.error('Error fetching register payment slip data:', e);
        } finally {
            setLoading(false);
        }
    };

    // Helpers for dotted date like image: DD/MM/YY
    const formatDateYY = (dateStr?: string) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yy = String(d.getFullYear()).slice(-2);
        return `${dd}/${mm}/${yy}`;
    };
    const formatDateShift = (dateStr?: string, shift?: string) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const suf = shift === 'evening' ? 'E' : shift === 'morning' ? 'M' : 'M';
        return `${dd}/${mm}-${suf}`;
    };

    // ── Slip totals ───────────────────────────────────────────────────────────────
    // Quantity / rate / amount come from the real purchase entries of the calculation
    // period (server totals when present, else the sum of the rows).
    const rowsQty = collections.reduce((s, c) => s + ((c as any).quantity || 0), 0);
    const rowsAmount = collections.reduce((s, c) => s + ((c as any).amount || 0), 0);
    const slipQty = periodTotals ? periodTotals.quantity : rowsQty;
    const slipAmount = periodTotals ? periodTotals.amount : rowsAmount;
    const slipAvgRate = slipQty > 0 ? slipAmount / slipQty : 0;

    // Milk Amount is the same equation the Payment screen shows:
    //    <collection amount of the dates>  +  <amount typed by the user>  =  <total>
    // The typed part is not stored separately, so it is derived from the saved total:
    //   input = savedTotal - collectionAmount (never negative).
    const slipPurchaseAmount = slipAmount || rowsAmount;
    const slipSavedTotal = payment?.totalMilkAmount || 0;
    const slipInputAmount = Math.max(0, slipSavedTotal - slipPurchaseAmount);
    const slipMilkAmount = slipSavedTotal > 0 ? slipSavedTotal : slipPurchaseAmount;

    // Advance / Product and Total Payable come from the saved settlement, exactly like
    // the Payment screen shows them. When an older record has no stored advance value,
    // the settled advances of the payment are summed instead (never a bare 0).
    const slipSettledAdvances: any[] = Array.isArray((payment as any)?.settledAdvances) ? (payment as any).settledAdvances : [];
    const slipAdvanceFromRows = slipSettledAdvances.reduce((sum, a: any) => {
        const amt = Number(a?.settledAmount) || Number(a?.amount) || 0;
        return sum + amt;
    }, 0);
    const slipAdvance =
        (payment?.totalAdvanceDeduction || 0) > 0
            ? (payment?.totalAdvanceDeduction || 0)
            : slipAdvanceFromRows;
    const slipPreviousBalance = payment?.previousBalance || 0;
    const slipTotalPayable =
        (payment?.netPayable || 0) !== 0
            ? (payment?.netPayable || 0)
            : slipMilkAmount - slipAdvance + slipPreviousBalance;

    const generateHtml = () => {
        if (!payment) return '';
        const p = payment;
        const t = getSlipLabels();
        const dairyName = (printSettings?.dairyName || 'Your Dairy Name').trim();
        const showMobile = printSettings?.showMobileOnReceipt !== false;
        const mobile = printSettings?.mobileNumber || '9027599139';
        const address = printSettings?.address || '';
        const dairyAddrLine = address ? address : 'Aligarh (U.P)';
        const dateRange = `${formatDateYY(p.periodStart || p.date)} -${formatDateYY(p.periodEnd || p.date)}`;
        // totals from the real entries of the period (no made-up placeholders)
        const totalQty = slipQty;
        const totalAmt = slipAmount;
        const avgRate = slipAvgRate;

        const dots = '....................................................................................................';
        return `
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Courier New', monospace; padding: 16px 10px; max-width: 380px; margin: 0 auto; background: #fff; color: #000; }
          .center { text-align: center; }
          .title { font-size: 20px; font-weight: 900; margin-bottom: 2px; text-transform: none; letter-spacing: 0.2px; }
          .sub { font-size: 11px; color: #333; margin-bottom: 1px; }
          .sub-ph { font-size: 11px; color: #333; margin-bottom: 4px; }
          .dotted { text-align: center; margin: 7px 0; color: #000; font-size: 9px; letter-spacing: 1.2px; overflow: hidden; white-space: nowrap; }
          .info-row { display: flex; justify-content: space-between; margin-bottom: 2px; font-size: 12px; }
          .info-row .lab { color: #000; }
          .info-row .val { color: #d32f2f; font-weight: 700; }
          .info-row .val-black { color: #d32f2f; font-weight: 700; }
          .sec-title { text-align: center; font-size: 12px; font-weight: 700; margin: 6px 0 4px; }
          .tbl { width: 100%; border-collapse: collapse; margin-top: 4px; }
          .tbl th { font-size: 10px; font-weight: 600; color: #000; text-align: center; padding: 3px 2px; }
          .tbl td { font-size: 11px; color: #d32f2f; text-align: center; padding: 2px 2px; font-weight: 600; }
          .tot-row { display: flex; justify-content: space-between; margin: 3px 0 0; font-size: 12px; }
          .tot-row .lab { color: #000; }
          .tot-row .val { color: #d32f2f; font-weight: 700; }
          .amt-row { display: flex; justify-content: space-between; margin-bottom: 3px; font-size: 12px; }
          .amt-row .lab { color: #000; }
          .amt-row .val { color: #000; font-weight: 600; min-width: 70px; text-align: right; }
          .amt-row .val-red { color: #d32f2f; font-weight: 700; }
          .closing { display: flex; justify-content: space-between; margin: 4px 0; font-size: 12px; font-weight: 700; }
          .thanks { text-align: center; font-size: 11px; margin-top: 8px; }
          .red { color: #d32f2f; }
        </style>
      </head>
      <body>
        <div class="center title">${dairyName}</div>
        <div class="center sub">${dairyAddrLine}</div>
        ${mobile ? `<div class="center sub-ph">PH: ${mobile}</div>` : ''}
        <div class="dotted">${dots}</div>
        <div class="info-row"><span class="lab">Code :</span><span class="val">${p.farmer?.code || '-'}</span></div>
        <div class="info-row"><span class="lab">Name :</span><span class="val">${p.farmer?.name || '-'}</span></div>
        <div class="info-row"><span class="lab">Date :</span><span class="val">${dateRange}</span></div>
        <div class="info-row"><span class="lab">Address :</span><span class="val">${address ? address : 'Aligarh , Utter Predesh , India'}</span></div>
        <div class="dotted">${dots}</div>
        <div class="sec-title">: Collection Entries :</div>
        <table class="tbl">
          <thead><tr><th>Date/S</th><th>Qty</th><th>FAT</th><th>SNF</th><th>Rate</th><th>Amount</th></tr></thead>
          <tbody>
            ${collections.length === 0 ? `<tr><td colspan="6" style="color:#999;font-weight:400;">- No entries -</td></tr>` : collections.map(c => `
              <tr>
                <td>${formatDateShift(c.date, (c as any).shift)}</td>
                <td>${(c.quantity || 0).toFixed(1)}</td>
                <td>${(c.fat ?? 0).toFixed(1)}</td>
                <td>${(c.snf ?? 0).toFixed(1)}</td>
                <td>${(c.rate || 0).toFixed(1)}</td>
                <td>${(c.amount || 0).toFixed(1)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="dotted">${dots}</div>
        <div class="tot-row"><span class="lab">Total Qty :</span><span class="val">${totalQty.toFixed(2)}</span></div>
        <div class="tot-row"><span class="lab">Average Rate :</span><span class="val">${avgRate.toFixed(2)}</span></div>
        <div class="tot-row"><span class="lab">Total Amount :</span><span class="val">${totalAmt.toFixed(2)}</span></div>
        <div class="dotted">${dots}</div>
        <div class="sec-title">Payment Slip :</div>
        <div class="amt-row"><span class="lab">Last Payment :</span><span class="val">${(p.previousBalance || 0).toFixed(0)}</span></div>
        <div class="amt-row"><span class="lab">Milk Amount :</span><span class="val-red">${slipPurchaseAmount.toFixed(0)} + ${slipInputAmount.toFixed(0)} = ${slipMilkAmount.toFixed(0)}</span></div>
        <div class="amt-row"><span class="lab">Advance / Product :</span><span class="val">${slipAdvance.toFixed(0)}</span></div>
        <div class="amt-row"><span class="lab">Total Payable :</span><span class="val">${slipTotalPayable.toFixed(0)}</span></div>
        <div class="amt-row"><span class="lab">Paid Amount :</span><span class="val">${(p.amount || 0).toFixed(0)}</span></div>
        <div class="dotted">${dots}</div>
        <div class="closing"><span>Closingh Bal :</span><span style="color:${(p.closingBalance || 0) < 0 ? '#d32f2f' : '#000'}">${(p.closingBalance || 0).toFixed(0)}</span></div>
        <div class="dotted">${dots}</div>
        ${printSettings?.extraInfo?.trim() ? `<div class="thanks" style="font-style:italic;color:#555;">${printSettings.extraInfo.trim()}</div>` : ''}
        <div class="thanks">Thanks You !</div>
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

    const generateThermalPayload = () => {
        if (!payment) return '';
        // Use joint payload exactly like image if collections available, else fallback
        if (collections.length > 0) {
            return buildJointCollectionPaymentSlipPayload(payment, collections as any, printSettings);
        }
        const p = payment;
        const t = getSlipLabels();
        let payload = '';
        payload += brandedHeader({
            dairyName: printSettings?.dairyName || t.paymentSlip,
            address: printSettings?.address || '',
            mobileNumber: printSettings?.mobileNumber || '',
            showMobileOnReceipt: printSettings?.showMobileOnReceipt !== false,
        });
        payload += twoCol(`${t.from}:`, formatDateDDMMYYYY(p.periodStart || p.date));
        payload += twoCol(`${t.till}:`, formatDateDDMMYYYY(p.periodEnd || p.date));
        payload += twoCol(`${t.code}:`, p.farmer?.code || '-');
        payload += labelValueWrap(`${t.name}:`, p.farmer?.name || '-');
        payload += feed(1);
        payload += fmtLine();
        payload += twoCol(`${t.lastPayment}:`, (p.previousBalance || 0).toFixed(0));
        payload += twoCol(`${t.milkAmount}:`, `${slipPurchaseAmount.toFixed(0)} + ${slipInputAmount.toFixed(0)} = ${slipMilkAmount.toFixed(0)}`);
        payload += twoCol(`${t.advanceProduct}:`, slipAdvance.toFixed(0));
        payload += twoCol(`${t.totalPayable}:`, slipTotalPayable.toFixed(0));
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
                    <Pressable onPress={async()=>{ if(!p) return; const txt=paymentSlipText({code:(p as any).farmer?.code||'',name:(p as any).farmer?.name||''},{start:formatDateDDMMYYYY((p as any).periodStart),end:formatDateDDMMYYYY((p as any).periodEnd)}, slipMilkAmount, slipAdvance, slipTotalPayable, (p as any).amount||0, (p as any).closingBalance||0); await shareViaWhatsapp((p as any).farmer?.mobile||'', txt); }} style={[styles.headerActionBtn, { borderColor: colors.border, backgroundColor: '#25D36615' }]}>
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
                    <View style={[styles.slipCard, { backgroundColor: '#fff', borderColor: '#ddd' }]}>
                        {/* Dairy Header exactly like image */}
                        <Text style={styles.slipTitleJoint}>{printSettings?.dairyName || 'Your Dairy Name'}</Text>
                        <Text style={styles.slipSubJoint}>{printSettings?.address || 'Aligarh (U.P)'}</Text>
                        {(printSettings?.mobileNumber || '9027599139') ? <Text style={styles.slipSubJoint}>PH: {printSettings?.mobileNumber || '9027599139'}</Text> : null}
                        <View style={styles.dottedLine} />
                        <View style={styles.slipRow}><Text style={styles.labBlack}>Code :</Text><Text style={styles.valRed}>{p.farmer?.code || '01'}</Text></View>
                        <View style={styles.slipRow}><Text style={styles.labBlack}>Name :</Text><Text style={styles.valRed}>{p.farmer?.name || '-'}</Text></View>
                        <View style={styles.slipRow}><Text style={styles.labBlack}>Date :</Text><Text style={styles.valRed}>{formatDateYY(p.periodStart || p.date)} -{formatDateYY(p.periodEnd || p.date)}</Text></View>
                        <View style={styles.slipRow}><Text style={styles.labBlack}>Address :</Text><Text style={styles.valRed}>{printSettings?.address || 'Aligarh , Utter Predesh , India'}</Text></View>
                        <View style={styles.dottedLine} />
                        <Text style={styles.secTitle}>: Collection Entries :</Text>
                        {/* Table header */}
                        <View style={styles.tblHeader}>
                            <Text style={[styles.tblTh, { flex: 1.4 }]}>Date/S</Text>
                            <Text style={[styles.tblTh, { flex: 0.7 }]}>Qty</Text>
                            <Text style={[styles.tblTh, { flex: 0.7 }]}>FAT</Text>
                            <Text style={[styles.tblTh, { flex: 0.7 }]}>SNF</Text>
                            <Text style={[styles.tblTh, { flex: 0.8 }]}>Rate</Text>
                            <Text style={[styles.tblTh, { flex: 0.9 }]}>Amount</Text>
                        </View>
                        {collections.length === 0 ? (
                            <Text style={{ textAlign: 'center', color: '#999', fontSize: 11, paddingVertical: 6 }}>- No entries -</Text>
                        ) : collections.map((c: any) => (
                            <View key={c._id} style={styles.tblRow}>
                                <Text style={[styles.tblTd, { flex: 1.4 }]}>{formatDateShift(c.date, c.shift)}</Text>
                                <Text style={[styles.tblTd, { flex: 0.7 }]}>{(c.quantity || 0).toFixed(1)}</Text>
                                <Text style={[styles.tblTd, { flex: 0.7 }]}>{(c.fat ?? 0).toFixed(1)}</Text>
                                <Text style={[styles.tblTd, { flex: 0.7 }]}>{(c.snf ?? 0).toFixed(1)}</Text>
                                <Text style={[styles.tblTd, { flex: 0.8 }]}>{(c.rate || 0).toFixed(1)}</Text>
                                <Text style={[styles.tblTd, { flex: 0.9 }]}>{(c.amount || 0).toFixed(1)}</Text>
                            </View>
                        ))}
                        <View style={styles.dottedLine} />
                        <>
                            <View style={styles.slipRow}><Text style={styles.labBlack}>Total Qty :</Text><Text style={styles.valRed}>{slipQty.toFixed(2)}</Text></View>
                            <View style={styles.slipRow}><Text style={styles.labBlack}>Average Rate :</Text><Text style={styles.valRed}>{slipAvgRate.toFixed(2)}</Text></View>
                            <View style={styles.slipRow}><Text style={styles.labBlack}>Total Amount :</Text><Text style={styles.valRed}>{slipAmount.toFixed(2)}</Text></View>
                        </>
                        <View style={styles.dottedLine} />
                        <Text style={styles.secTitle}>Payment Slip :</Text>
                        <View style={styles.slipRow}><Text style={styles.labBlack}>Last Payment :</Text><Text style={styles.valBlack}>{(p.previousBalance || 0).toFixed(0)}</Text></View>
                        <View style={styles.slipRow}><Text style={[styles.labBlack, { color: '#d32f2f' }]}>Milk Amount :</Text><Text style={styles.valRed}>{slipPurchaseAmount.toFixed(0)} + {slipInputAmount.toFixed(0)} = {slipMilkAmount.toFixed(0)}</Text></View>
                        <View style={styles.slipRow}><Text style={styles.labBlack}>Advance / Product :</Text><Text style={styles.valBlack}>{slipAdvance.toFixed(0)}</Text></View>
                        <View style={styles.slipRow}><Text style={styles.labBlack}>Total Payable :</Text><Text style={styles.valBlack}>{slipTotalPayable.toFixed(0)}</Text></View>
                        <View style={styles.slipRow}><Text style={styles.labBlack}>Paid Amount :</Text><Text style={styles.valBlack}>{(p.amount || 0).toFixed(0)}</Text></View>
                        <View style={styles.dottedLine} />
                        <View style={styles.slipRow}><Text style={[styles.labBlack, { fontWeight: '700' }]}>Closingh Bal :</Text><Text style={[styles.valRed, { fontWeight: '800' }]}>{(p.closingBalance || 0).toFixed(0)}</Text></View>
                        <View style={styles.dottedLine} />
                        <Text style={{ textAlign: 'center', fontSize: 11, marginTop: 6 }}>Thanks You !</Text>
                    </View>

                    <View style={styles.bottomActions}>
                        <Pressable style={[styles.actionBtn, { backgroundColor: colors.primary }]} onPress={handleDownloadPdf}>
                            {downloading ? <ActivityIndicator size="small" color={colors.white} /> : (
                                <>
                                    <Download size={18} color={colors.white} />
                                    <Text style={[styles.actionBtnText, { color: colors.white }]}>Download PDF</Text>
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
    slipRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 3 },
    slipLabel: { fontSize: 13 },
    slipValue: { fontSize: 13, fontWeight: '600' },
    slipTitleJoint: { fontSize: 18, fontWeight: '900', textAlign: 'center', color: '#000', marginBottom: 2 },
    slipSubJoint: { fontSize: 11, textAlign: 'center', color: '#333', marginBottom: 1 },
    dottedLine: { borderTopWidth: 1, borderColor: '#000', borderStyle: 'dotted', marginVertical: 7, opacity: 0.8 },
    labBlack: { fontSize: 11, color: '#000' },
    valRed: { fontSize: 11, color: '#d32f2f', fontWeight: '700' as any },
    valBlack: { fontSize: 11, color: '#000', fontWeight: '600' as any },
    secTitle: { textAlign: 'center', fontSize: 12, fontWeight: '700' as any, marginVertical: 5, color: '#000' },
    tblHeader: { flexDirection: 'row', paddingVertical: 4, borderBottomWidth: 0.5, borderColor: '#ccc' },
    tblTh: { fontSize: 10, fontWeight: '600' as any, color: '#000', textAlign: 'center' as any },
    tblRow: { flexDirection: 'row', paddingVertical: 2 },
    tblTd: { fontSize: 11, color: '#d32f2f', textAlign: 'center' as any, fontWeight: '600' as any },
    bottomActions: { flexDirection: 'row', gap: 10, marginTop: 6 },
    actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 8, gap: 6 },
    actionBtnText: { fontSize: 14, fontWeight: '600' },
});