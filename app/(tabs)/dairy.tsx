import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, RefreshControl, Modal, Platform } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { Droplets, Sun, Moon, Plus, X, Wallet, Check, FileText, Calculator, ChevronDown, Share2 } from 'lucide-react-native';
import TopBar from '@/components/TopBar';
import { milkCollectionsApi, paymentsApi, farmersApi, rateChartsApi, reportsApi, MilkCollection, TodaySummary, Farmer, FarmerPaymentSummary, RateChart, MilkReport, PaymentReport } from '@/lib/milkeyApi';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

type TabType = 'Collection' | 'Settlement' | 'Reports' | 'Rate Chart';

export default function DairyScreen() {
    const { colors, isDark } = useTheme();
    const [activeTab, setActiveTab] = useState<TabType>('Collection');
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [todaySummary, setTodaySummary] = useState<TodaySummary | null>(null);
    const [collections, setCollections] = useState<MilkCollection[]>([]);
    const [farmers, setFarmers] = useState<Farmer[]>([]);
    const [showAddModal, setShowAddModal] = useState(false);
    const [collectionForm, setCollectionForm] = useState({ farmerCode: '', farmerName: '', quantity: '', rate: '', fat: '', snf: '', shift: new Date().getHours() < 12 ? 'morning' : 'evening' });
    const [settlementCode, setSettlementCode] = useState('');
    const [farmerSummary, setFarmerSummary] = useState<FarmerPaymentSummary | null>(null);

    // Rate Chart state
    const [activeChart, setActiveChart] = useState<RateChart | null>(null);
    const [rateCalcFat, setRateCalcFat] = useState('3.5');
    const [rateCalcSnf, setRateCalcSnf] = useState('8.5');
    const [calculatedRate, setCalculatedRate] = useState<number | null>(null);
    const [showChartSettings, setShowChartSettings] = useState(false);
    const [chartSettings, setChartSettings] = useState({ baseRate: '50', baseFat: '3.5', baseSnf: '8.5', fatRate: '7.5', snfRate: '6.5' });

    // Reports state
    const [reportType, setReportType] = useState<'milk' | 'payment'>('milk');
    const [dateRange, setDateRange] = useState({ start: getDateString(-7), end: getDateString(0) });
    const [milkReport, setMilkReport] = useState<MilkReport | null>(null);
    const [paymentReport, setPaymentReport] = useState<PaymentReport | null>(null);

    const styles = createStyles(colors, isDark);

    useEffect(() => { fetchData(); }, []);

    function getDateString(daysOffset: number) {
        const d = new Date();
        d.setDate(d.getDate() + daysOffset);
        return d.toISOString().split('T')[0];
    }

    const fetchData = async () => {
        setLoading(true);
        try {
            const [summaryRes, collectionsRes, farmersRes, chartRes] = await Promise.all([
                milkCollectionsApi.getTodaySummary().catch(() => null),
                milkCollectionsApi.getAll({ limit: 20 }).catch(() => null),
                farmersApi.getAll().catch(() => null),
                rateChartsApi.getActive().catch(() => null),
            ]);
            if (summaryRes?.success) setTodaySummary(summaryRes.response || null);
            if (collectionsRes?.success) setCollections(collectionsRes.response?.data || []);
            if (farmersRes?.success) setFarmers(farmersRes.response?.data || []);
            if (chartRes?.success && chartRes.response) {
                setActiveChart(chartRes.response);
                setChartSettings({
                    baseRate: String(chartRes.response.baseRate),
                    baseFat: String(chartRes.response.baseFat),
                    baseSnf: String(chartRes.response.baseSnf),
                    fatRate: String(chartRes.response.fatRate),
                    snfRate: String(chartRes.response.snfRate),
                });
            }
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    const onRefresh = useCallback(async () => { setRefreshing(true); await fetchData(); setRefreshing(false); }, []);

    const handleFarmerCodeChange = (code: string) => {
        const farmer = farmers.find(f => f.code === code);
        setCollectionForm(prev => ({ ...prev, farmerCode: code, farmerName: farmer?.name || '' }));
    };

    const handleCalculateRate = async () => {
        if (!collectionForm.fat || !collectionForm.snf) return;
        const res = await rateChartsApi.calculate(parseFloat(collectionForm.fat), parseFloat(collectionForm.snf));
        if (res.success && res.response) {
            setCollectionForm(prev => ({ ...prev, rate: String(res.response!.rate) }));
        }
    };

    const handleAddCollection = async () => {
        if (!collectionForm.farmerCode || !collectionForm.quantity || !collectionForm.rate) {
            Alert.alert('Error', 'Please fill farmer code, quantity, and rate'); return;
        }
        setLoading(true);
        const res = await milkCollectionsApi.create({
            farmerCode: collectionForm.farmerCode,
            quantity: parseFloat(collectionForm.quantity),
            rate: parseFloat(collectionForm.rate),
            shift: collectionForm.shift as 'morning' | 'evening',
            fat: collectionForm.fat ? parseFloat(collectionForm.fat) : undefined,
            snf: collectionForm.snf ? parseFloat(collectionForm.snf) : undefined,
        });
        if (res.success) {
            Alert.alert('Success', 'Milk collection recorded');
            setShowAddModal(false);
            setCollectionForm({ farmerCode: '', farmerName: '', quantity: '', rate: '', fat: '', snf: '', shift: new Date().getHours() < 12 ? 'morning' : 'evening' });
            fetchData();
        } else Alert.alert('Error', res.message || 'Failed');
        setLoading(false);
    };

    const handleFetchSettlement = async () => {
        if (!settlementCode) { Alert.alert('Error', 'Enter farmer code'); return; }
        setLoading(true);
        const res = await paymentsApi.getFarmerSummary(settlementCode);
        if (res.success) setFarmerSummary(res.response || null);
        else { Alert.alert('Error', res.message || 'Not found'); setFarmerSummary(null); }
        setLoading(false);
    };

    const handleSettlePayment = async () => {
        if (!farmerSummary) return;
        Alert.alert('Confirm Payment', `Pay ₹${farmerSummary.netPayable} to ${farmerSummary.farmer.name}?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Pay', onPress: async () => {
                    setLoading(true);
                    const res = await paymentsApi.create({ farmerCode: farmerSummary.farmer.code, amount: farmerSummary.netPayable });
                    if (res.success) { Alert.alert('Success', 'Payment recorded'); setFarmerSummary(null); setSettlementCode(''); fetchData(); }
                    else Alert.alert('Error', res.message || 'Failed');
                    setLoading(false);
                }
            },
        ]);
    };

    // Rate Chart functions
    const handleRateCalculate = async () => {
        if (!rateCalcFat || !rateCalcSnf) return;
        const res = await rateChartsApi.calculate(parseFloat(rateCalcFat), parseFloat(rateCalcSnf));
        if (res.success && res.response) {
            setCalculatedRate(res.response.rate);
        }
    };

    const handleSaveChartSettings = async () => {
        setLoading(true);
        const data = {
            baseRate: parseFloat(chartSettings.baseRate),
            baseFat: parseFloat(chartSettings.baseFat),
            baseSnf: parseFloat(chartSettings.baseSnf),
            fatRate: parseFloat(chartSettings.fatRate),
            snfRate: parseFloat(chartSettings.snfRate),
            calculationType: 'fat_snf' as const,
        };

        const res = activeChart
            ? await rateChartsApi.update(activeChart._id, data)
            : await rateChartsApi.create({ name: 'My Rate Chart', ...data });

        if (res.success) {
            Alert.alert('Success', 'Rate chart saved');
            setShowChartSettings(false);
            fetchData();
        } else Alert.alert('Error', res.message || 'Failed');
        setLoading(false);
    };

    // Reports functions
    const handleFetchReport = async () => {
        setLoading(true);
        if (reportType === 'milk') {
            const res = await reportsApi.getMilkCollections({ startDate: dateRange.start, endDate: dateRange.end });
            if (res.success) setMilkReport(res.response || null);
            else Alert.alert('Error', res.message || 'Failed');
        } else {
            const res = await reportsApi.getPayments({ startDate: dateRange.start, endDate: dateRange.end });
            if (res.success) setPaymentReport(res.response || null);
            else Alert.alert('Error', res.message || 'Failed');
        }
        setLoading(false);
    };

    const generatePdfHtml = () => {
        if (reportType === 'milk' && milkReport) {
            return `
        <html><head><style>
          body { font-family: Arial; padding: 20px; }
          h1 { color: #333; text-align: center; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #4A90D9; color: white; }
          .summary { background: #f5f5f5; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
          .summary-item { display: flex; justify-content: space-between; margin: 5px 0; }
        </style></head><body>
          <h1>Milk Collection Report</h1>
          <p>Period: ${dateRange.start} to ${dateRange.end}</p>
          <div class="summary">
            <div class="summary-item"><span>Total Quantity:</span><strong>${milkReport.summary.totalQuantity.toFixed(2)} L</strong></div>
            <div class="summary-item"><span>Total Amount:</span><strong>₹${milkReport.summary.totalAmount.toFixed(2)}</strong></div>
            <div class="summary-item"><span>Farmers:</span><strong>${milkReport.summary.farmersCount}</strong></div>
            <div class="summary-item"><span>Avg Rate:</span><strong>₹${milkReport.summary.avgRate.toFixed(2)}</strong></div>
          </div>
          <table>
            <tr><th>Date</th><th>Shift</th><th>Farmer</th><th>Qty (L)</th><th>Rate</th><th>Amount</th></tr>
            ${milkReport.details.map(d => `
              <tr><td>${new Date(d.date).toLocaleDateString()}</td><td>${d.shift}</td><td>${d.farmer?.name || '-'}</td><td>${d.quantity}</td><td>₹${d.rate}</td><td>₹${d.amount}</td></tr>
            `).join('')}
          </table>
        </body></html>
      `;
        } else if (reportType === 'payment' && paymentReport) {
            return `
        <html><head><style>
          body { font-family: Arial; padding: 20px; }
          h1 { color: #333; text-align: center; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #4A90D9; color: white; }
          .summary { background: #f5f5f5; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
        </style></head><body>
          <h1>Payment Report</h1>
          <p>Period: ${dateRange.start} to ${dateRange.end}</p>
          <div class="summary">
            <p><strong>Total Payments:</strong> ${paymentReport.summary.totalPayments}</p>
            <p><strong>Total Amount:</strong> ₹${paymentReport.summary.totalAmount.toFixed(2)}</p>
            <p><strong>Farmers Paid:</strong> ${paymentReport.summary.farmersCount}</p>
          </div>
          <table>
            <tr><th>Date</th><th>Farmer</th><th>Method</th><th>Amount</th></tr>
            ${paymentReport.details.map(d => `
              <tr><td>${new Date(d.date).toLocaleDateString()}</td><td>${d.farmer?.name || '-'}</td><td>${d.paymentMethod}</td><td>₹${d.amount}</td></tr>
            `).join('')}
          </table>
        </body></html>
      `;
        }
        return '';
    };

    const handleSharePdf = async () => {
        const html = generatePdfHtml();
        if (!html) { Alert.alert('Error', 'Generate report first'); return; }

        try {
            const { uri } = await Print.printToFileAsync({ html });
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri);
            } else {
                Alert.alert('Info', 'PDF saved to: ' + uri);
            }
        } catch (e) {
            Alert.alert('Error', 'Failed to generate PDF');
        }
    };

    return (
        <View style={styles.container}>
            <TopBar />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScrollView} contentContainerStyle={styles.tabRow}>
                {(['Collection', 'Settlement', 'Reports', 'Rate Chart'] as TabType[]).map(tab => (
                    <Pressable key={tab} style={[styles.tab, activeTab === tab && styles.tabActive]} onPress={() => setActiveTab(tab)}>
                        {tab === 'Collection' && <Droplets size={14} color={activeTab === tab ? colors.white : colors.foreground} />}
                        {tab === 'Settlement' && <Wallet size={14} color={activeTab === tab ? colors.white : colors.foreground} />}
                        {tab === 'Reports' && <FileText size={14} color={activeTab === tab ? colors.white : colors.foreground} />}
                        {tab === 'Rate Chart' && <Calculator size={14} color={activeTab === tab ? colors.white : colors.foreground} />}
                        <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
                    </Pressable>
                ))}
            </ScrollView>

            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}>
                {activeTab === 'Collection' && (
                    <>
                        <View style={styles.summaryCard}>
                            <Text style={styles.summaryTitle}>Today's Collection</Text>
                            <View style={styles.shiftRow}>
                                <View style={styles.shiftCard}><Sun size={16} color={colors.warning} /><Text style={styles.shiftQty}>{todaySummary?.morning.quantity.toFixed(1) || '0'} L</Text><Text style={styles.shiftAmt}>₹{todaySummary?.morning.amount.toFixed(0) || '0'}</Text></View>
                                <View style={styles.shiftCard}><Moon size={16} color={colors.primary} /><Text style={styles.shiftQty}>{todaySummary?.evening.quantity.toFixed(1) || '0'} L</Text><Text style={styles.shiftAmt}>₹{todaySummary?.evening.amount.toFixed(0) || '0'}</Text></View>
                            </View>
                            <View style={styles.totalRow}><Text style={styles.totalLabel}>Total: {todaySummary?.total.quantity.toFixed(1) || '0'} L</Text><Text style={styles.totalAmt}>₹{todaySummary?.total.amount.toFixed(0) || '0'}</Text></View>
                        </View>
                        <Pressable style={styles.addBtn} onPress={() => setShowAddModal(true)}><Plus size={18} color={colors.white} /><Text style={styles.addBtnText}>Add Collection</Text></Pressable>
                        <Text style={styles.sectionTitle}>Recent Collections</Text>
                        {collections.length > 0 ? collections.slice(0, 10).map(item => (
                            <View key={item._id} style={styles.collectionRow}>
                                <Text style={[styles.collectionCode, { color: colors.primary }]}>{item.farmer?.code}</Text>
                                <Text style={styles.collectionShift}>{item.shift === 'morning' ? '☀️' : '🌙'}</Text>
                                <Text style={styles.collectionQty}>{item.quantity}L</Text>
                                <Text style={[styles.collectionAmt, { color: colors.success }]}>₹{item.amount.toFixed(0)}</Text>
                            </View>
                        )) : <Text style={styles.emptyText}>No collections yet</Text>}
                    </>
                )}

                {activeTab === 'Settlement' && (
                    <>
                        <View style={styles.searchCard}>
                            <Text style={styles.cardTitle}>Find Farmer</Text>
                            <View style={styles.searchRow}>
                                <TextInput style={styles.searchInput} placeholder="Farmer Code" value={settlementCode} onChangeText={setSettlementCode} placeholderTextColor={colors.mutedForeground} />
                                <Pressable style={styles.searchBtn} onPress={handleFetchSettlement}><Text style={styles.searchBtnText}>Go</Text></Pressable>
                            </View>
                        </View>
                        {farmerSummary && (
                            <View style={styles.settlementCard}>
                                <Text style={styles.farmerName}>{farmerSummary.farmer.name} (Code: {farmerSummary.farmer.code})</Text>
                                <View style={styles.summarySection}><Text style={styles.summaryLabel}>Milk Amount</Text><Text style={[styles.summaryValue, { color: colors.success }]}>₹{farmerSummary.milk.totalAmount.toFixed(0)}</Text></View>
                                {farmerSummary.advances.totalPending > 0 && <View style={styles.summarySection}><Text style={styles.summaryLabel}>Advance Deduction</Text><Text style={[styles.summaryValue, { color: colors.warning }]}>-₹{farmerSummary.advances.totalPending.toFixed(0)}</Text></View>}
                                <View style={styles.netRow}><Text style={styles.netLabel}>Net Payable:</Text><Text style={styles.netAmt}>₹{farmerSummary.netPayable.toFixed(0)}</Text></View>
                                {farmerSummary.netPayable > 0 ? <Pressable style={styles.payBtn} onPress={handleSettlePayment}><Wallet size={18} color={colors.white} /><Text style={styles.payBtnText}>Pay ₹{farmerSummary.netPayable.toFixed(0)}</Text></Pressable>
                                    : <View style={styles.clearedBadge}><Check size={18} color={colors.success} /><Text style={styles.clearedText}>All cleared!</Text></View>}
                            </View>
                        )}
                    </>
                )}

                {activeTab === 'Reports' && (
                    <>
                        <View style={styles.reportTypeRow}>
                            <Pressable style={[styles.reportTypeBtn, reportType === 'milk' && styles.reportTypeBtnActive]} onPress={() => setReportType('milk')}>
                                <Droplets size={14} color={reportType === 'milk' ? colors.white : colors.foreground} />
                                <Text style={[styles.reportTypeText, reportType === 'milk' && { color: colors.white }]}>Milk</Text>
                            </Pressable>
                            <Pressable style={[styles.reportTypeBtn, reportType === 'payment' && styles.reportTypeBtnActive]} onPress={() => setReportType('payment')}>
                                <Wallet size={14} color={reportType === 'payment' ? colors.white : colors.foreground} />
                                <Text style={[styles.reportTypeText, reportType === 'payment' && { color: colors.white }]}>Payment</Text>
                            </Pressable>
                        </View>

                        <View style={styles.dateRangeCard}>
                            <Text style={styles.cardTitle}>Date Range</Text>
                            <View style={styles.dateRow}>
                                <View style={styles.dateField}>
                                    <Text style={styles.dateLabel}>From</Text>
                                    <TextInput style={styles.dateInput} value={dateRange.start} onChangeText={v => setDateRange(p => ({ ...p, start: v }))} placeholder="YYYY-MM-DD" placeholderTextColor={colors.mutedForeground} />
                                </View>
                                <View style={styles.dateField}>
                                    <Text style={styles.dateLabel}>To</Text>
                                    <TextInput style={styles.dateInput} value={dateRange.end} onChangeText={v => setDateRange(p => ({ ...p, end: v }))} placeholder="YYYY-MM-DD" placeholderTextColor={colors.mutedForeground} />
                                </View>
                            </View>
                            <Pressable style={styles.generateBtn} onPress={handleFetchReport}>
                                <FileText size={16} color={colors.white} />
                                <Text style={styles.generateBtnText}>{loading ? 'Loading...' : 'Generate Report'}</Text>
                            </Pressable>
                        </View>

                        {reportType === 'milk' && milkReport && (
                            <View style={styles.reportCard}>
                                <View style={styles.reportHeader}>
                                    <Text style={styles.reportTitle}>Milk Collection Summary</Text>
                                    <Pressable onPress={handleSharePdf}><Share2 size={18} color={colors.primary} /></Pressable>
                                </View>
                                <View style={styles.reportGrid}>
                                    <View style={styles.reportItem}><Text style={styles.reportItemLabel}>Total Qty</Text><Text style={styles.reportItemValue}>{milkReport.summary.totalQuantity.toFixed(1)} L</Text></View>
                                    <View style={styles.reportItem}><Text style={styles.reportItemLabel}>Total Amt</Text><Text style={[styles.reportItemValue, { color: colors.success }]}>₹{milkReport.summary.totalAmount.toFixed(0)}</Text></View>
                                    <View style={styles.reportItem}><Text style={styles.reportItemLabel}>Morning</Text><Text style={styles.reportItemValue}>{milkReport.summary.morningQty.toFixed(1)} L</Text></View>
                                    <View style={styles.reportItem}><Text style={styles.reportItemLabel}>Evening</Text><Text style={styles.reportItemValue}>{milkReport.summary.eveningQty.toFixed(1)} L</Text></View>
                                    <View style={styles.reportItem}><Text style={styles.reportItemLabel}>Farmers</Text><Text style={styles.reportItemValue}>{milkReport.summary.farmersCount}</Text></View>
                                    <View style={styles.reportItem}><Text style={styles.reportItemLabel}>Avg Rate</Text><Text style={styles.reportItemValue}>₹{milkReport.summary.avgRate.toFixed(2)}</Text></View>
                                </View>
                            </View>
                        )}

                        {reportType === 'payment' && paymentReport && (
                            <View style={styles.reportCard}>
                                <View style={styles.reportHeader}>
                                    <Text style={styles.reportTitle}>Payment Summary</Text>
                                    <Pressable onPress={handleSharePdf}><Share2 size={18} color={colors.primary} /></Pressable>
                                </View>
                                <View style={styles.reportGrid}>
                                    <View style={styles.reportItem}><Text style={styles.reportItemLabel}>Total Paid</Text><Text style={[styles.reportItemValue, { color: colors.success }]}>₹{paymentReport.summary.totalAmount.toFixed(0)}</Text></View>
                                    <View style={styles.reportItem}><Text style={styles.reportItemLabel}>Payments</Text><Text style={styles.reportItemValue}>{paymentReport.summary.totalPayments}</Text></View>
                                    <View style={styles.reportItem}><Text style={styles.reportItemLabel}>Farmers</Text><Text style={styles.reportItemValue}>{paymentReport.summary.farmersCount}</Text></View>
                                    <View style={styles.reportItem}><Text style={styles.reportItemLabel}>Cash</Text><Text style={styles.reportItemValue}>₹{paymentReport.summary.byMethod.cash.toFixed(0)}</Text></View>
                                    <View style={styles.reportItem}><Text style={styles.reportItemLabel}>UPI</Text><Text style={styles.reportItemValue}>₹{paymentReport.summary.byMethod.upi.toFixed(0)}</Text></View>
                                    <View style={styles.reportItem}><Text style={styles.reportItemLabel}>Bank</Text><Text style={styles.reportItemValue}>₹{paymentReport.summary.byMethod.bank.toFixed(0)}</Text></View>
                                </View>
                            </View>
                        )}
                    </>
                )}

                {activeTab === 'Rate Chart' && (
                    <>
                        <View style={styles.rateCalcCard}>
                            <Text style={styles.cardTitle}>Calculate Rate</Text>
                            <View style={styles.rateInputRow}>
                                <View style={styles.rateInputField}>
                                    <Text style={styles.rateInputLabel}>FAT %</Text>
                                    <TextInput style={styles.rateInput} value={rateCalcFat} onChangeText={setRateCalcFat} keyboardType="decimal-pad" placeholderTextColor={colors.mutedForeground} />
                                </View>
                                <View style={styles.rateInputField}>
                                    <Text style={styles.rateInputLabel}>SNF %</Text>
                                    <TextInput style={styles.rateInput} value={rateCalcSnf} onChangeText={setRateCalcSnf} keyboardType="decimal-pad" placeholderTextColor={colors.mutedForeground} />
                                </View>
                            </View>
                            <Pressable style={styles.calcBtn} onPress={handleRateCalculate}>
                                <Calculator size={16} color={colors.white} />
                                <Text style={styles.calcBtnText}>Calculate</Text>
                            </Pressable>
                            {calculatedRate !== null && (
                                <View style={styles.rateResult}>
                                    <Text style={styles.rateResultLabel}>Rate per Liter</Text>
                                    <Text style={styles.rateResultValue}>₹{calculatedRate.toFixed(2)}</Text>
                                </View>
                            )}
                        </View>

                        <View style={styles.chartInfoCard}>
                            <Pressable style={styles.chartInfoHeader} onPress={() => setShowChartSettings(!showChartSettings)}>
                                <Text style={styles.cardTitle}>Rate Chart Settings</Text>
                                <ChevronDown size={18} color={colors.foreground} style={{ transform: [{ rotate: showChartSettings ? '180deg' : '0deg' }] }} />
                            </Pressable>

                            {showChartSettings && (
                                <View style={styles.chartSettingsBody}>
                                    <View style={styles.settingsRow}>
                                        <View style={styles.settingField}>
                                            <Text style={styles.settingLabel}>Base Rate</Text>
                                            <TextInput style={styles.settingInput} value={chartSettings.baseRate} onChangeText={v => setChartSettings(p => ({ ...p, baseRate: v }))} keyboardType="decimal-pad" placeholderTextColor={colors.mutedForeground} />
                                        </View>
                                        <View style={styles.settingField}>
                                            <Text style={styles.settingLabel}>Base FAT</Text>
                                            <TextInput style={styles.settingInput} value={chartSettings.baseFat} onChangeText={v => setChartSettings(p => ({ ...p, baseFat: v }))} keyboardType="decimal-pad" placeholderTextColor={colors.mutedForeground} />
                                        </View>
                                    </View>
                                    <View style={styles.settingsRow}>
                                        <View style={styles.settingField}>
                                            <Text style={styles.settingLabel}>Base SNF</Text>
                                            <TextInput style={styles.settingInput} value={chartSettings.baseSnf} onChangeText={v => setChartSettings(p => ({ ...p, baseSnf: v }))} keyboardType="decimal-pad" placeholderTextColor={colors.mutedForeground} />
                                        </View>
                                        <View style={styles.settingField}>
                                            <Text style={styles.settingLabel}>FAT Rate</Text>
                                            <TextInput style={styles.settingInput} value={chartSettings.fatRate} onChangeText={v => setChartSettings(p => ({ ...p, fatRate: v }))} keyboardType="decimal-pad" placeholderTextColor={colors.mutedForeground} />
                                        </View>
                                    </View>
                                    <View style={styles.settingsRow}>
                                        <View style={styles.settingField}>
                                            <Text style={styles.settingLabel}>SNF Rate</Text>
                                            <TextInput style={styles.settingInput} value={chartSettings.snfRate} onChangeText={v => setChartSettings(p => ({ ...p, snfRate: v }))} keyboardType="decimal-pad" placeholderTextColor={colors.mutedForeground} />
                                        </View>
                                    </View>
                                    <Pressable style={styles.saveChartBtn} onPress={handleSaveChartSettings}>
                                        <Text style={styles.saveChartBtnText}>{loading ? 'Saving...' : 'Save Settings'}</Text>
                                    </Pressable>
                                </View>
                            )}
                        </View>

                        <View style={styles.formulaCard}>
                            <Text style={styles.cardTitle}>Rate Formula</Text>
                            <Text style={styles.formulaText}>Rate = Base Rate + (FAT diff × FAT Rate) + (SNF diff × SNF Rate)</Text>
                            <Text style={styles.formulaExample}>Example: 50 + ((4.0-3.5)×10×7.5) + ((8.8-8.5)×10×6.5) = ₹76.50</Text>
                        </View>
                    </>
                )}
            </ScrollView>

            {/* Add Collection Modal */}
            <Modal visible={showAddModal} animationType="slide" transparent onRequestClose={() => setShowAddModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}><Text style={styles.modalTitle}>Add Collection</Text><Pressable onPress={() => setShowAddModal(false)}><X size={20} color={colors.foreground} /></Pressable></View>
                        <ScrollView style={styles.modalBody}>
                            <View style={styles.shiftSelector}>
                                <Pressable style={[styles.shiftOpt, collectionForm.shift === 'morning' && styles.shiftOptActive]} onPress={() => setCollectionForm(p => ({ ...p, shift: 'morning' }))}><Sun size={16} color={collectionForm.shift === 'morning' ? colors.white : colors.warning} /><Text style={[styles.shiftOptText, collectionForm.shift === 'morning' && { color: colors.white }]}>Morning</Text></Pressable>
                                <Pressable style={[styles.shiftOpt, collectionForm.shift === 'evening' && styles.shiftOptActive]} onPress={() => setCollectionForm(p => ({ ...p, shift: 'evening' }))}><Moon size={16} color={collectionForm.shift === 'evening' ? colors.white : colors.primary} /><Text style={[styles.shiftOptText, collectionForm.shift === 'evening' && { color: colors.white }]}>Evening</Text></Pressable>
                            </View>
                            <View style={styles.formRow}><TextInput style={[styles.input, { flex: 0.4 }]} placeholder="Code" value={collectionForm.farmerCode} onChangeText={handleFarmerCodeChange} placeholderTextColor={colors.mutedForeground} /><TextInput style={[styles.input, { flex: 1, backgroundColor: colors.muted }]} placeholder="Name" value={collectionForm.farmerName} editable={false} placeholderTextColor={colors.mutedForeground} /></View>
                            <View style={styles.formRow}>
                                <TextInput style={styles.input} placeholder="FAT %" value={collectionForm.fat} onChangeText={v => setCollectionForm(p => ({ ...p, fat: v }))} keyboardType="decimal-pad" placeholderTextColor={colors.mutedForeground} />
                                <TextInput style={styles.input} placeholder="SNF %" value={collectionForm.snf} onChangeText={v => setCollectionForm(p => ({ ...p, snf: v }))} keyboardType="decimal-pad" placeholderTextColor={colors.mutedForeground} />
                                <Pressable style={styles.calcRateBtn} onPress={handleCalculateRate}><Calculator size={16} color={colors.white} /></Pressable>
                            </View>
                            <View style={styles.formRow}><TextInput style={styles.input} placeholder="Qty (L)" value={collectionForm.quantity} onChangeText={v => setCollectionForm(p => ({ ...p, quantity: v }))} keyboardType="decimal-pad" placeholderTextColor={colors.mutedForeground} /><TextInput style={styles.input} placeholder="Rate" value={collectionForm.rate} onChangeText={v => setCollectionForm(p => ({ ...p, rate: v }))} keyboardType="decimal-pad" placeholderTextColor={colors.mutedForeground} /></View>
                            {collectionForm.quantity && collectionForm.rate && <View style={styles.amtPreview}><Text style={styles.amtPreviewText}>Amount: ₹{(parseFloat(collectionForm.quantity || '0') * parseFloat(collectionForm.rate || '0')).toFixed(0)}</Text></View>}
                        </ScrollView>
                        <View style={styles.modalFooter}><Pressable style={styles.cancelBtn} onPress={() => setShowAddModal(false)}><Text style={styles.cancelBtnText}>Cancel</Text></Pressable><Pressable style={styles.saveBtn} onPress={handleAddCollection}><Text style={styles.saveBtnText}>{loading ? '...' : 'Save'}</Text></Pressable></View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    tabScrollView: { flexGrow: 0, marginBottom: 8 },
    tabRow: { paddingHorizontal: 6, gap: 6, paddingTop: 4 },
    tab: { flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: 8, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
    tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    tabText: { fontSize: 12, fontWeight: '600', color: colors.foreground },
    tabTextActive: { color: colors.white },
    scrollView: { flex: 1 },
    scrollContent: { paddingHorizontal: 6, paddingBottom: 80 },
    summaryCard: { backgroundColor: colors.card, borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
    summaryTitle: { fontSize: 14, fontWeight: '700', color: colors.foreground, marginBottom: 10 },
    shiftRow: { flexDirection: 'row', gap: 10 },
    shiftCard: { flex: 1, backgroundColor: colors.secondary, borderRadius: 8, padding: 10, alignItems: 'center' },
    shiftQty: { fontSize: 18, fontWeight: '700', color: colors.foreground, marginTop: 4 },
    shiftAmt: { fontSize: 13, fontWeight: '600', color: colors.success },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border },
    totalLabel: { fontSize: 14, fontWeight: '600', color: colors.foreground },
    totalAmt: { fontSize: 16, fontWeight: '700', color: colors.success },
    addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, borderRadius: 8, paddingVertical: 12, gap: 6, marginBottom: 16 },
    addBtnText: { color: colors.white, fontSize: 14, fontWeight: '600' },
    sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.foreground, marginBottom: 8 },
    collectionRow: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: 8, padding: 10, marginBottom: 6, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
    collectionCode: { flex: 1, fontSize: 13, fontWeight: '600' },
    collectionShift: { fontSize: 14, marginHorizontal: 8 },
    collectionQty: { fontSize: 13, color: colors.foreground, marginRight: 10 },
    collectionAmt: { fontSize: 14, fontWeight: '700' },
    emptyText: { fontSize: 13, color: colors.mutedForeground, textAlign: 'center', marginTop: 30 },
    searchCard: { backgroundColor: colors.card, borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
    cardTitle: { fontSize: 14, fontWeight: '700', color: colors.foreground, marginBottom: 10 },
    searchRow: { flexDirection: 'row', gap: 8 },
    searchInput: { flex: 1, backgroundColor: colors.secondary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.foreground },
    searchBtn: { backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 20, justifyContent: 'center' },
    searchBtnText: { color: colors.white, fontSize: 14, fontWeight: '600' },
    settlementCard: { backgroundColor: colors.card, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: colors.border },
    farmerName: { fontSize: 16, fontWeight: '700', color: colors.foreground, marginBottom: 12 },
    summarySection: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
    summaryLabel: { fontSize: 13, color: colors.mutedForeground },
    summaryValue: { fontSize: 14, fontWeight: '600' },
    netRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.border, marginTop: 8 },
    netLabel: { fontSize: 15, fontWeight: '600', color: colors.foreground },
    netAmt: { fontSize: 22, fontWeight: '700', color: colors.primary },
    payBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.success, borderRadius: 8, paddingVertical: 12, gap: 8, marginTop: 8 },
    payBtnText: { color: colors.white, fontSize: 15, fontWeight: '700' },
    clearedBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.success + '15', borderRadius: 8, paddingVertical: 12, gap: 6, marginTop: 8 },
    clearedText: { color: colors.success, fontSize: 14, fontWeight: '600' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
    modalTitle: { fontSize: 16, fontWeight: '700', color: colors.foreground },
    modalBody: { padding: 16 },
    modalFooter: { flexDirection: 'row', padding: 16, gap: 10, borderTopWidth: 1, borderTopColor: colors.border },
    shiftSelector: { flexDirection: 'row', gap: 10, marginBottom: 16 },
    shiftOpt: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 8, backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border },
    shiftOptActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    shiftOptText: { fontSize: 13, fontWeight: '600', color: colors.foreground },
    formRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
    input: { flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.foreground },
    amtPreview: { backgroundColor: colors.success + '15', borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
    amtPreviewText: { fontSize: 16, fontWeight: '700', color: colors.success },
    cancelBtn: { flex: 1, backgroundColor: colors.muted, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
    cancelBtnText: { color: colors.foreground, fontSize: 14, fontWeight: '600' },
    saveBtn: { flex: 1, backgroundColor: colors.primary, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
    saveBtnText: { color: colors.white, fontSize: 14, fontWeight: '600' },
    calcRateBtn: { backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 14, justifyContent: 'center' },

    // Reports styles
    reportTypeRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
    reportTypeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 8, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
    reportTypeBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    reportTypeText: { fontSize: 13, fontWeight: '600', color: colors.foreground },
    dateRangeCard: { backgroundColor: colors.card, borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
    dateRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
    dateField: { flex: 1 },
    dateLabel: { fontSize: 11, color: colors.mutedForeground, marginBottom: 4 },
    dateInput: { backgroundColor: colors.secondary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: colors.foreground },
    generateBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, borderRadius: 8, paddingVertical: 12, gap: 6 },
    generateBtnText: { color: colors.white, fontSize: 14, fontWeight: '600' },
    reportCard: { backgroundColor: colors.card, borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
    reportHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    reportTitle: { fontSize: 14, fontWeight: '700', color: colors.foreground },
    reportGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    reportItem: { width: '48%', backgroundColor: colors.secondary, borderRadius: 8, padding: 10 },
    reportItemLabel: { fontSize: 11, color: colors.mutedForeground, marginBottom: 2 },
    reportItemValue: { fontSize: 15, fontWeight: '700', color: colors.foreground },

    // Rate Chart styles
    rateCalcCard: { backgroundColor: colors.card, borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
    rateInputRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
    rateInputField: { flex: 1 },
    rateInputLabel: { fontSize: 11, color: colors.mutedForeground, marginBottom: 4 },
    rateInput: { backgroundColor: colors.secondary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: colors.foreground, textAlign: 'center' },
    calcBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, borderRadius: 8, paddingVertical: 12, gap: 6 },
    calcBtnText: { color: colors.white, fontSize: 14, fontWeight: '600' },
    rateResult: { marginTop: 12, backgroundColor: colors.success + '15', borderRadius: 8, padding: 16, alignItems: 'center' },
    rateResultLabel: { fontSize: 12, color: colors.mutedForeground, marginBottom: 4 },
    rateResultValue: { fontSize: 28, fontWeight: '700', color: colors.success },
    chartInfoCard: { backgroundColor: colors.card, borderRadius: 10, marginBottom: 12, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
    chartInfoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12 },
    chartSettingsBody: { padding: 12, paddingTop: 0, borderTopWidth: 1, borderTopColor: colors.border },
    settingsRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
    settingField: { flex: 1 },
    settingLabel: { fontSize: 11, color: colors.mutedForeground, marginBottom: 4 },
    settingInput: { backgroundColor: colors.secondary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, color: colors.foreground },
    saveChartBtn: { backgroundColor: colors.primary, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
    saveChartBtnText: { color: colors.white, fontSize: 14, fontWeight: '600' },
    formulaCard: { backgroundColor: colors.card, borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
    formulaText: { fontSize: 12, color: colors.foreground, marginBottom: 8, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
    formulaExample: { fontSize: 11, color: colors.mutedForeground, fontStyle: 'italic' },
});
