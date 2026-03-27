import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View, Text, StyleSheet, Pressable, TextInput, FlatList,
    ActivityIndicator, RefreshControl, Modal, ScrollView, Keyboard, KeyboardAvoidingView, Platform
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/hooks/useTranslation';
import {
    Plus, Edit2, Trash2, Calendar as CalendarIcon, Search, X,
    ChevronDown, FileText, User, Sun, Moon,
    Droplets, CircleDot, Download, Check, Printer
} from 'lucide-react-native';
import TopBar from '@/components/TopBar';
import {
    milkCollectionsApi, purchaseFarmersApi,
    MilkCollection, PurchaseFarmer
} from '@/lib/milkeyApi';
import * as ExpoPrint from 'expo-print';
import { useBluetoothPrinter } from '@/hooks/useBluetoothPrinter';
import { buildReceiptBytes, concatBytes, INIT, ALIGN_CENTER, BOLD_ON, DOUBLE_ON, NORMAL_SIZE, BOLD_OFF, ALIGN_LEFT, textToBytes, separator, doubleSeparator, twoColumnLine, threeColumnLine, FEED_3_LINES } from '@/lib/escpos';
import * as Sharing from 'expo-sharing';
import { SuccessModal } from '@/components/SuccessModal';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { Calendar } from '@/components/Calendar';
import { PaymentRangeCalendar } from '@/components/PaymentRangeCalendar';
import { DateRangePicker } from '@/components/DateRangePicker';
import { useDebounce } from '@/hooks/useDebounce';
import { useSubscriptionCheck } from '@/hooks/useSubscriptionCheck';
import { SubscriptionModal } from '@/components/SubscriptionModal';
import { AddCustomerSheet } from '@/components/purchase/AddCustomerSheet';
import { useSubTabStore, PurchaseTab } from '@/lib/subTabStore';

type TabType = PurchaseTab;
const TAB_ORDER: TabType[] = ['Purchase', 'Report', 'Farmer'];

export default function PurchaseScreen() {
    const { colors, isDark } = useTheme();
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const {
        hasAccess, loading: subscriptionLoading, showSubscriptionModal,
        handleModalClose, handleSubscriptionSuccess
    } = useSubscriptionCheck('purchase');
    const { isConnected, printData, isPrinting } = useBluetoothPrinter();

    const { purchaseTab: activeTab, setPurchaseTab: setActiveTab } = useSubTabStore();

    // Customer state
    const [customers, setCustomers] = useState<PurchaseFarmer[]>([]);
    const [selectedCustomer, setSelectedCustomer] = useState<PurchaseFarmer | null>(null);
    const [customerSearch, setCustomerSearch] = useState('');
    const debouncedSearch = useDebounce(customerSearch, 400);

    // Entry state
    const [entryDate, setEntryDate] = useState(new Date());
    const [entryShift, setEntryShift] = useState<'morning' | 'evening'>(new Date().getHours() < 12 ? 'morning' : 'evening');
    const [milkType, setMilkType] = useState<'cow' | 'buffalo'>('buffalo');
    const [milkQty, setMilkQty] = useState('');
    const [fatValue, setFatValue] = useState('');
    const [snfValue, setSnfValue] = useState('');
    const [rateValue, setRateValue] = useState('');
    const [isZero, setIsZero] = useState(false);
    const [saving, setSaving] = useState(false);

    // History state
    const [collections, setCollections] = useState<MilkCollection[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyPage, setHistoryPage] = useState(1);
    const [hasMoreHistory, setHasMoreHistory] = useState(true);
    const [historyTotals, setHistoryTotals] = useState({ quantity: 0, amount: 0 });

    // Report state
    const [reportStartDate, setReportStartDate] = useState('');
    const [reportEndDate, setReportEndDate] = useState('');
    const [reportDateSelectingType, setReportDateSelectingType] = useState<'start' | 'end'>('start');
    const [showReportCalendarModal, setShowReportCalendarModal] = useState(false);
    const [reportCollections, setReportCollections] = useState<MilkCollection[]>([]);
    const [reportLoading, setReportLoading] = useState(false);
    const [reportTotals, setReportTotals] = useState({ quantity: 0, amount: 0 });

    // Farmer tab state
    const [farmerTabSearch, setFarmerTabSearch] = useState('');
    const debouncedFarmerSearch = useDebounce(farmerTabSearch, 400);
    const [farmerSearchLoading, setFarmerSearchLoading] = useState(false);

    // Modals
    const [showDateModal, setShowDateModal] = useState(false);
    const [showCustomerModal, setShowCustomerModal] = useState(false);
    const [showAddCustomer, setShowAddCustomer] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState<PurchaseFarmer | null>(null);
    const [alertVisible, setAlertVisible] = useState(false);
    const [alertTitle, setAlertTitle] = useState('');
    const [alertMessage, setAlertMessage] = useState('');
    const [confirmVisible, setConfirmVisible] = useState(false);
    const [confirmData, setConfirmData] = useState({ title: '', message: '', onConfirm: () => { } });
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    const showAlert = useCallback((t: string, m: string) => { setAlertTitle(t); setAlertMessage(m); setAlertVisible(true); }, []);
    const showConfirm = useCallback((t: string, m: string, onConfirm: () => void) => { setConfirmData({ title: t, message: m, onConfirm }); setConfirmVisible(true); }, []);

    const s = createStyles(colors, isDark);




    // Data fetching
    const fetchCustomers = useCallback(async (search?: string) => {
        try {
            const res = await purchaseFarmersApi.getAll({ search, limit: 100 });
            if (res.success) setCustomers(res.response?.data || []);
        } catch { }
    }, []);

    const fetchCollections = useCallback(async (page = 1, append = false) => {
        setHistoryLoading(true);
        try {
            const dateStr = `${entryDate.getFullYear()}-${String(entryDate.getMonth() + 1).padStart(2, '0')}-${String(entryDate.getDate()).padStart(2, '0')}`;
            const res = await milkCollectionsApi.getAll({ date: dateStr, shift: entryShift, limit: 50, page });
            if (res.success) {
                const data = res.response?.data || [];
                setCollections(prev => append ? [...prev, ...data] : data);
                setHistoryTotals(res.response?.totals || { quantity: 0, amount: 0 });
                setHasMoreHistory(data.length === 50);
                setHistoryPage(page);
            }
        } catch { }
        setHistoryLoading(false);
    }, [entryDate, entryShift]);

    const fetchReportData = useCallback(async () => {
        if (!reportStartDate || !reportEndDate) return;
        setReportLoading(true);
        try {
            const res = await milkCollectionsApi.getAll({ startDate: reportStartDate, endDate: reportEndDate, limit: 500 });
            if (res.success) {
                const data = res.response?.data || [];
                setReportCollections(data);
                setReportTotals(res.response?.totals || { quantity: 0, amount: 0 });
            }
        } catch { }
        setReportLoading(false);
    }, [reportStartDate, reportEndDate]);

    useEffect(() => { fetchCustomers(); }, []);
    useEffect(() => { fetchCollections(1); }, [entryDate, entryShift]);
    useEffect(() => { if (debouncedSearch !== undefined) fetchCustomers(debouncedSearch); }, [debouncedSearch]);
    useEffect(() => { if (reportStartDate && reportEndDate) fetchReportData(); }, [reportStartDate, reportEndDate]);

    // Farmer tab search
    useEffect(() => {
        const searchFarmers = async () => {
            setFarmerSearchLoading(true);
            try {
                const res = await purchaseFarmersApi.getAll({ search: debouncedFarmerSearch.trim() || undefined, limit: 100 });
                if (res.success) setCustomers(res.response?.data || []);
            } catch { }
            setFarmerSearchLoading(false);
        };
        searchFarmers();
    }, [debouncedFarmerSearch]);

    useEffect(() => {
        if (selectedCustomer) {
            setMilkType(selectedCustomer.defaultMilk || 'buffalo');
            autoFillRate(selectedCustomer, selectedCustomer.defaultMilk || 'buffalo');
        }
    }, [selectedCustomer]);

    useEffect(() => {
        if (selectedCustomer) autoFillRate(selectedCustomer, milkType);
    }, [milkType]);

    const autoFillRate = (customer: PurchaseFarmer, type: 'cow' | 'buffalo') => {
        if (customer.priceBasis === 'rate') {
            setRateValue(type === 'cow' ? String(customer.cowRate || '') : String(customer.buffaloRate || ''));
            setFatValue('');
        } else {
            setFatValue(type === 'cow' ? String(customer.cowFat || '') : String(customer.buffaloFat || ''));
            setRateValue('');
        }
    };

    const computeAmount = (): number => {
        if (isZero) return 0;
        const qty = parseFloat(milkQty) || 0;
        const rate = parseFloat(rateValue) || 0;
        return parseFloat((qty * rate).toFixed(2));
    };

    const handleSaveEntry = useCallback(async () => {
        if (saving) return;
        if (!selectedCustomer) { showAlert('Error', 'Please select a customer'); return; }
        if (!milkQty && !isZero) { showAlert('Error', 'Enter milk quantity'); return; }
        const qty = isZero ? 0 : parseFloat(milkQty) || 0;
        const rate = parseFloat(rateValue) || 0;
        if (!isZero && (qty <= 0 || rate <= 0)) { showAlert('Error', 'Enter valid quantity and rate'); return; }

        setSaving(true);
        try {
            const dateStr = `${entryDate.getFullYear()}-${String(entryDate.getMonth() + 1).padStart(2, '0')}-${String(entryDate.getDate()).padStart(2, '0')}`;
            const res = await milkCollectionsApi.create({
                farmerCode: selectedCustomer.code,
                purchaseFarmerId: selectedCustomer._id,
                quantity: isZero ? 0.1 : qty,
                rate: isZero ? 0 : rate,
                date: dateStr,
                shift: entryShift,
                fat: parseFloat(fatValue) || 0,
                snf: parseFloat(snfValue) || 0,
                milkType,
            });
            if (res.success) {
                showAlert('Success', 'Entry saved');
                setMilkQty(''); setFatValue(''); setSnfValue('');
                if (selectedCustomer.priceBasis === 'rate') autoFillRate(selectedCustomer, milkType);
                setIsZero(false);
                fetchCollections(1);
            } else {
                showAlert('Error', res.message || 'Failed to save');
            }
        } catch { showAlert('Error', 'Failed to save entry'); }
        setSaving(false);
    }, [saving, selectedCustomer, milkQty, rateValue, fatValue, snfValue, entryDate, entryShift, milkType, isZero]);

    const handleDeleteCollection = useCallback((id: string) => {
        showConfirm('Delete Entry', 'Delete this milk entry?', async () => {
            setConfirmVisible(false);
            setDeletingId(id);
            try {
                const res = await milkCollectionsApi.delete(id);
                if (res.success) { showAlert('Success', 'Entry deleted'); fetchCollections(1); }
                else showAlert('Error', res.message || 'Failed');
            } catch { showAlert('Error', 'Failed to delete'); }
            setDeletingId(null);
        });
    }, []);

    const handleSelectCustomer = useCallback((c: PurchaseFarmer) => {
        setSelectedCustomer(c);
        setShowCustomerModal(false);
    }, []);

    const handleEditCustomer = useCallback((c: PurchaseFarmer) => {
        setEditingCustomer(c);
        setShowAddCustomer(true);
        setShowCustomerModal(false);
    }, []);

    const handleDeleteCustomer = useCallback((id: string) => {
        showConfirm('Delete Customer', 'Are you sure?', async () => {
            setConfirmVisible(false);
            try {
                const res = await purchaseFarmersApi.delete(id);
                if (res.success) {
                    showAlert('Success', 'Customer deleted');
                    fetchCustomers();
                    if (selectedCustomer?._id === id) setSelectedCustomer(null);
                } else showAlert('Error', res.message || 'Failed');
            } catch { showAlert('Error', 'Failed'); }
        });
    }, [selectedCustomer]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await Promise.all([fetchCustomers(), fetchCollections(1)]);
        setRefreshing(false);
    }, [fetchCustomers, fetchCollections]);

    const formatDate = (d: Date) => `${String(d.getDate()).padStart(2, '0')} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()]} ${d.getFullYear()}`;
    const formatDateStr = (dateStr: string) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
    };

    const showCow = selectedCustomer ? selectedCustomer.cowEnabled : true;
    const showBuffalo = selectedCustomer ? selectedCustomer.buffaloEnabled : true;
    const isMorning = entryShift === 'morning';

    // Report state for farmer filter
    const [reportFarmerFilter, setReportFarmerFilter] = useState<string>('');
    const [showReportFarmerModal, setShowReportFarmerModal] = useState(false);

    const filteredReportCollections = useMemo(() => {
        if (!reportFarmerFilter) return reportCollections;
        return reportCollections.filter(c => c.purchaseFarmer?._id === reportFarmerFilter || c.farmerCode === reportFarmerFilter);
    }, [reportCollections, reportFarmerFilter]);

    const filteredReportTotals = useMemo(() => {
        if (!reportFarmerFilter) return reportTotals;
        const filtered = filteredReportCollections;
        return {
            quantity: filtered.reduce((sum, c) => sum + c.quantity, 0),
            amount: filtered.reduce((sum, c) => sum + c.amount, 0),
        };
    }, [filteredReportCollections, reportFarmerFilter, reportTotals]);

    const selectedReportFarmer = useMemo(() => {
        if (!reportFarmerFilter) return null;
        return customers.find(c => c._id === reportFarmerFilter || c.code === reportFarmerFilter) || null;
    }, [reportFarmerFilter, customers]);

    // BLE print collection entries on thermal printer
    const handleBlePrintEntries = useCallback(async () => {
        const data = collections;
        const totals = historyTotals;
        if (data.length === 0) { showAlert('Info', 'No data to print'); return; }
        if (!isConnected) { showAlert('Info', 'Connect a Bluetooth printer first from TopBar'); return; }

        const dateLabel = `${formatDate(entryDate)} (${entryShift === 'morning' ? 'Morning' : 'Evening'})`;
        const parts: Uint8Array[] = [INIT, ALIGN_CENTER, BOLD_ON, DOUBLE_ON, textToBytes('COLLECTION\n'), NORMAL_SIZE, BOLD_OFF, textToBytes(dateLabel + '\n'), ALIGN_LEFT, doubleSeparator()];

        // Header
        parts.push(textToBytes(threeColumnLine('Code', 'Qty', 'Amt')));
        parts.push(separator());

        // Rows
        for (const c of data) {
            parts.push(textToBytes(threeColumnLine(
                c.farmerCode || '-',
                String(c.quantity),
                '₹' + c.amount.toFixed(0)
            )));
        }

        parts.push(doubleSeparator());
        parts.push(BOLD_ON);
        parts.push(textToBytes(twoColumnLine('Total Qty:', totals.quantity.toFixed(1))));
        parts.push(textToBytes(twoColumnLine('Total Amt:', '₹' + totals.amount.toFixed(2))));
        parts.push(BOLD_OFF, FEED_3_LINES);

        const bytes = concatBytes(...parts);
        const success = await printData(bytes);
        if (success) showAlert('Success', 'Printed successfully!');
    }, [collections, historyTotals, entryDate, entryShift, isConnected, printData]);

    // Print report via Bluetooth printer
    const handlePrintReport = useCallback(async () => {
        const data = filteredReportCollections.length > 0 ? filteredReportCollections : collections;
        const totals = filteredReportCollections.length > 0 ? filteredReportTotals : historyTotals;
        if (data.length === 0) { showAlert('Info', 'No data to print'); return; }
        if (!isConnected) { showAlert('Info', 'Connect a Bluetooth printer first from TopBar'); return; }

        const dateLabel = reportStartDate && reportEndDate
            ? `${formatDateStr(reportStartDate)} to ${formatDateStr(reportEndDate)}`
            : `${formatDate(entryDate)} (${entryShift === 'morning' ? 'AM' : 'PM'})`;
        const farmerLabel = selectedReportFarmer ? `Farmer: ${selectedReportFarmer.name}` : 'All Farmers';

        const parts: Uint8Array[] = [INIT, ALIGN_CENTER, BOLD_ON, DOUBLE_ON, textToBytes('COLLECTION REPORT\n'), NORMAL_SIZE, BOLD_OFF, textToBytes(dateLabel + '\n'), textToBytes(farmerLabel + '\n'), ALIGN_LEFT, doubleSeparator()];
        parts.push(textToBytes(threeColumnLine('Code', 'Qty', 'Amt')));
        parts.push(separator());

        for (const c of data) {
            parts.push(textToBytes(threeColumnLine(
                c.farmerCode || '-',
                String(c.quantity),
                '₹' + c.amount.toFixed(0)
            )));
        }

        parts.push(doubleSeparator());
        parts.push(BOLD_ON);
        parts.push(textToBytes(twoColumnLine('Total Qty:', totals.quantity.toFixed(1))));
        parts.push(textToBytes(twoColumnLine('Total Amt:', '₹' + totals.amount.toFixed(2))));
        parts.push(BOLD_OFF, FEED_3_LINES);

        const bytes = concatBytes(...parts);
        const success = await printData(bytes);
        if (success) showAlert('Success', 'Printed successfully!');
    }, [filteredReportCollections, collections, filteredReportTotals, historyTotals, entryDate, entryShift, reportStartDate, reportEndDate, isConnected, printData, selectedReportFarmer]);

    // Export PDF for report
    const handleExportReportPdf = useCallback(async () => {
        const data = filteredReportCollections.length > 0 ? filteredReportCollections : collections;
        const totals = filteredReportCollections.length > 0 ? filteredReportTotals : historyTotals;
        if (data.length === 0) { showAlert('Info', 'No data to export'); return; }
        const dateLabel = reportStartDate && reportEndDate
            ? `${formatDateStr(reportStartDate)} to ${formatDateStr(reportEndDate)}`
            : `${formatDate(entryDate)} (${entryShift === 'morning' ? 'AM' : 'PM'})`;
        const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
            body{font-family:sans-serif;padding:16px;font-size:12px}
            h2{color:#22c55e;text-align:center}
            table{width:100%;border-collapse:collapse;margin-top:12px}
            th{background:#22c55e;color:#fff;padding:6px 4px;font-size:10px}
            td{padding:5px 4px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:10px}
            .total{background:#f0fdf4;font-weight:bold}
        </style></head><body>
        <h2>Collection Report - ${dateLabel}</h2>
        <table><thead><tr><th>Code</th><th>Name</th><th>Milk(L)</th><th>Fat</th><th>SNF</th><th>Rate</th><th>Amount</th></tr></thead>
        <tbody>${data.map(c => `<tr><td>${c.farmerCode || '-'}</td><td>${c.purchaseFarmer?.name || '-'}</td><td>${c.quantity}</td><td>${c.fat || '-'}</td><td>${(c as any).snf || '-'}</td><td>₹${c.rate}</td><td>₹${c.amount.toFixed(2)}</td></tr>`).join('')}
        <tr class="total"><td colspan="2">Total (${data.length})</td><td>${totals.quantity.toFixed(1)}</td><td></td><td></td><td></td><td>₹${totals.amount.toFixed(2)}</td></tr>
        </tbody></table></body></html>`;
        try {
            const { uri } = await ExpoPrint.printToFileAsync({ html });
            if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
        } catch { showAlert('Error', 'Failed to export'); }
    }, [filteredReportCollections, collections, filteredReportTotals, historyTotals, entryDate, entryShift, reportStartDate, reportEndDate]);

    // Export farmers PDF
    const handleExportFarmersPdf = useCallback(async () => {
        if (customers.length === 0) { showAlert('Info', 'No farmers to export'); return; }
        const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
            body{font-family:sans-serif;padding:16px;font-size:12px}
            h2{color:#22c55e;text-align:center}
            .subtitle{text-align:center;color:#666;margin-bottom:20px;font-size:12px}
            table{width:100%;border-collapse:collapse;margin-top:12px}
            th{background:#22c55e;color:#fff;padding:6px 4px;font-size:10px}
            td{padding:5px 4px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:10px}
        </style></head><body>
        <h2>Farmers List</h2>
        <p class="subtitle">Total: ${customers.length}</p>
        <table><thead><tr><th>Code</th><th>Name</th><th>Mobile</th><th>Milk</th><th>Basis</th></tr></thead>
        <tbody>${customers.map(c => `<tr><td>${c.code}</td><td>${c.name}</td><td>${c.mobile || '-'}</td><td>${c.defaultMilk || '-'}</td><td>${c.priceBasis || '-'}</td></tr>`).join('')}
        </tbody></table></body></html>`;
        try {
            const { uri } = await ExpoPrint.printToFileAsync({ html });
            if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
        } catch { showAlert('Error', 'Failed to export'); }
    }, [customers]);

    // ── Collection Tab ──
    const renderCollectionTab = () => (
        <View>
            {/* Top Controls: Date + Shift + Add */}
            <View style={s.topControls}>
                <Pressable style={s.dateBtn} onPress={() => setShowDateModal(true)}>
                    <CalendarIcon size={14} color={colors.primary} />
                    <Text style={s.dateText}>{formatDate(entryDate)}</Text>
                    <ChevronDown size={12} color={colors.mutedForeground} />
                </Pressable>
                <View style={s.shiftRow}>
                    <Pressable
                        onPress={() => setEntryShift('morning')}
                        style={[s.shiftBtn, isMorning && s.shiftBtnActive]}
                    >
                        <Sun size={13} color={isMorning ? '#fff' : colors.mutedForeground} />
                        <Text style={[s.shiftBtnText, isMorning && s.shiftBtnTextActive]}>{t.common.morning}</Text>
                    </Pressable>
                    <Pressable
                        onPress={() => setEntryShift('evening')}
                        style={[s.shiftBtn, !isMorning && s.shiftBtnActive]}
                    >
                        <Moon size={13} color={!isMorning ? '#fff' : colors.mutedForeground} />
                        <Text style={[s.shiftBtnText, !isMorning && s.shiftBtnTextActive]}>{t.common.evening}</Text>
                    </Pressable>
                </View>
                <Pressable
                    style={s.addCustTopBtn}
                    onPress={() => { setEditingCustomer(null); setShowAddCustomer(true); }}
                >
                    <Edit2 size={16} color="#fff" />
                </Pressable>
            </View>

            {/* Summary Bar */}
            <View style={s.summaryBar}>
                <View style={s.summaryCell}>
                    <Droplets size={14} color={colors.primary} />
                    <View>
                        <Text style={s.summaryVal}>{historyTotals.quantity.toFixed(1)} L</Text>
                        <Text style={s.summaryLbl}>{t.common.quantity}</Text>
                    </View>
                </View>
                <View style={s.summaryDivider} />
                <View style={s.summaryCell}>
                    <Text style={{ fontSize: 14, color: colors.primary, fontWeight: '800' }}>₹</Text>
                    <View>
                        <Text style={s.summaryVal}>{historyTotals.quantity > 0 ? (historyTotals.amount / historyTotals.quantity).toFixed(1) : '0'}</Text>
                        <Text style={s.summaryLbl}>{t.purchase.avgRate}</Text>
                    </View>
                </View>
                <View style={s.summaryDivider} />
                <View style={s.summaryCell}>
                    <Text style={{ fontSize: 14, color: colors.primary, fontWeight: '800' }}>₹</Text>
                    <View>
                        <Text style={[s.summaryVal, { color: colors.primary }]}>{historyTotals.amount.toFixed(1)}</Text>
                        <Text style={s.summaryLbl}>{t.common.amount}</Text>
                    </View>
                </View>
            </View>

            {/* Customer Selector */}
            <Pressable style={s.customerBox} onPress={() => setShowCustomerModal(true)}>
                <View style={[s.customerBadge, selectedCustomer && { backgroundColor: colors.primary }]}>
                    {selectedCustomer ? (
                        <Text style={s.customerBadgeText}>{selectedCustomer.code}</Text>
                    ) : (
                        <User size={16} color={colors.mutedForeground} />
                    )}
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={[s.customerName, !selectedCustomer && { color: colors.mutedForeground }]}>
                        {selectedCustomer ? selectedCustomer.name : t.purchase.selectCustomer}
                    </Text>
                    {selectedCustomer && (
                        <Text style={s.customerMeta}>
                            {selectedCustomer.priceBasis === 'rate' ? `📊 ${t.purchase.rateBased}` : `📊 ${t.purchase.fatBased}`}
                            {selectedCustomer.mobile ? ` • ${selectedCustomer.mobile}` : ''}
                        </Text>
                    )}
                </View>
                <ChevronDown size={16} color={colors.mutedForeground} />
            </Pressable>

            {/* Milk Type + Cow/Buffalo */}
            <View style={s.entryCard}>
                <View style={s.milkRow}>
                    {showCow && (
                        <Pressable onPress={() => setMilkType('cow')} style={[s.milkBtn, milkType === 'cow' && s.milkBtnActive]}>
                            <Text style={{ fontSize: 16 }}>🐄</Text>
                            <Text style={[s.milkBtnText, milkType === 'cow' && { color: '#fff' }]}>{t.purchase.cow}</Text>
                            {milkType === 'cow' && <Check size={12} color="#fff" />}
                        </Pressable>
                    )}
                    {showBuffalo && (
                        <Pressable onPress={() => setMilkType('buffalo')} style={[s.milkBtn, milkType === 'buffalo' && s.milkBtnActive]}>
                            <Text style={{ fontSize: 16 }}>🐃</Text>
                            <Text style={[s.milkBtnText, milkType === 'buffalo' && { color: '#fff' }]}>{t.purchase.buffalo}</Text>
                            {milkType === 'buffalo' && <Check size={12} color="#fff" />}
                        </Pressable>
                    )}
                </View>

                {/* Input fields */}
                <View style={s.fieldsRow}>
                    <View style={s.fieldBox}>
                        <Text style={s.fieldLabel}>{t.purchase.milk} (L)</Text>
                        <TextInput style={s.fieldInput} value={milkQty} onChangeText={setMilkQty} keyboardType="decimal-pad" placeholder="0.0" placeholderTextColor={colors.mutedForeground} editable={!isZero} />
                    </View>
                    {selectedCustomer?.priceBasis !== 'rate' && (
                        <View style={s.fieldBox}>
                            <Text style={s.fieldLabel}>{t.purchase.fat}</Text>
                            <TextInput style={s.fieldInput} value={fatValue} onChangeText={setFatValue} keyboardType="decimal-pad" placeholder="0.0" placeholderTextColor={colors.mutedForeground} />
                        </View>
                    )}
                    {selectedCustomer?.priceBasis === 'fat_snf' && (
                        <View style={s.fieldBox}>
                            <Text style={s.fieldLabel}>SNF</Text>
                            <TextInput style={s.fieldInput} value={snfValue} onChangeText={setSnfValue} keyboardType="decimal-pad" placeholder="0.0" placeholderTextColor={colors.mutedForeground} />
                        </View>
                    )}
                    <View style={s.fieldBox}>
                        <Text style={s.fieldLabel}>{t.common.rate} ₹</Text>
                        <TextInput style={s.fieldInput} value={isZero ? '0' : rateValue} onChangeText={setRateValue} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={colors.mutedForeground} editable={!isZero} />
                    </View>
                </View>

                {/* Actions */}
                <View style={s.actionsRow}>
                    <Pressable style={[s.zeroToggle, isZero && { backgroundColor: colors.destructive, borderColor: colors.destructive }]} onPress={() => setIsZero(!isZero)}>
                        <CircleDot size={13} color={isZero ? '#fff' : colors.mutedForeground} />
                        <Text style={[s.zeroText, isZero && { color: '#fff' }]}>{t.purchase.zeroEntry}</Text>
                    </Pressable>
                    <Pressable style={[s.saveEntryBtn, saving && { opacity: 0.5 }]} onPress={handleSaveEntry} disabled={saving}>
                        {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.saveEntryText}>✓ {t.common.save}</Text>}
                    </Pressable>
                </View>
            </View>

            {/* Sale Entries Table */}
            <View style={s.tableWrap}>
                <View style={s.tableBar}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        <FileText size={13} color={colors.primary} />
                        <Text style={s.tableBarTitle}>{t.purchase.saleEntries}</Text>
                        <View style={s.badge}><Text style={s.badgeText}>{collections.length}</Text></View>
                    </View>
                    <Pressable style={[s.pdfBtn, isPrinting && { opacity: 0.5 }]} onPress={handleBlePrintEntries} disabled={isPrinting}>
                        {isPrinting ? <ActivityIndicator size={12} color="#fff" /> : <Printer size={12} color="#fff" />}
                    </Pressable>
                </View>

                <View style={s.tHead}>
                    <Text style={[s.tHeadText, s.entryCell1]}>{t.common.code}</Text>
                    <Text style={[s.tHeadText, s.entryCell2]}>{t.purchase.milk}</Text>
                    <Text style={[s.tHeadText, s.entryCell2]}>{t.purchase.fat}</Text>
                    <Text style={[s.tHeadText, s.entryCell2]}>SNF</Text>
                    <Text style={[s.tHeadText, s.entryCell2]}>{t.common.rate}</Text>
                    <Text style={[s.tHeadText, s.entryCell3]}>{t.purchase.amt}</Text>
                    <View style={{ width: 26 }} />
                </View>

                {historyLoading && collections.length === 0 ? (
                    <View style={s.emptyBox}><ActivityIndicator color={colors.primary} /></View>
                ) : collections.length === 0 ? (
                    <View style={s.emptyBox}>
                        <Droplets size={24} color={colors.border} />
                        <Text style={s.emptyText}>{t.purchase.noEntries}</Text>
                    </View>
                ) : (
                    <>
                        {collections.map((item, index) => (
                            <View key={item._id} style={[s.entryRow, index % 2 !== 0 && { backgroundColor: isDark ? colors.muted + '30' : '#f8fafc' }]}>
                                <View style={s.entryCell1}>
                                    <Text style={[s.entryCellText, { color: colors.primary, fontWeight: '700' }]}>{item.farmerCode || '-'}</Text>
                                    <Text style={s.entrySubText} numberOfLines={1}>{item.purchaseFarmer?.name || ''}</Text>
                                </View>
                                <Text style={[s.entryCellText, s.entryCell2]}>{item.quantity}</Text>
                                <Text style={[s.entryCellText, s.entryCell2]}>{item.fat || '-'}</Text>
                                <Text style={[s.entryCellText, s.entryCell2]}>{(item as any).snf || '-'}</Text>
                                <Text style={[s.entryCellText, s.entryCell2]}>{item.rate}</Text>
                                <Text style={[s.entryCellText, s.entryCell3, { color: colors.primary, fontWeight: '700' }]}>₹{item.amount.toFixed(0)}</Text>
                                <Pressable style={s.deleteBtn} onPress={() => handleDeleteCollection(item._id)} disabled={deletingId === item._id}>
                                    {deletingId === item._id ? <ActivityIndicator size="small" color="#ef4444" /> : <Trash2 size={12} color="#ef4444" />}
                                </Pressable>
                            </View>
                        ))}
                        <View style={s.tFootRow}>
                            <Text style={[s.tFootText, s.entryCell1]}>{t.common.total} ({collections.length})</Text>
                            <Text style={[s.tFootText, s.entryCell2]}>{historyTotals.quantity.toFixed(1)}</Text>
                            <Text style={[s.tFootText, s.entryCell2]}></Text>
                            <Text style={[s.tFootText, s.entryCell2]}></Text>
                            <Text style={[s.tFootText, s.entryCell2]}>{historyTotals.quantity > 0 ? (historyTotals.amount / historyTotals.quantity).toFixed(1) : '-'}</Text>
                            <Text style={[s.tFootText, s.entryCell3, { color: colors.primary }]}>₹{historyTotals.amount.toFixed(0)}</Text>
                            <View style={{ width: 26 }} />
                        </View>
                    </>
                )}
            </View>
        </View>
    );


    // ── Report Tab ──
    const renderReportTab = () => (
        <View>
            <Text style={s.sectionTitle}>Collection Report</Text>

            {/* Farmer Select */}
            <Pressable
                style={[s.customerBox, { marginBottom: 6 }]}
                onPress={() => setShowReportFarmerModal(true)}
            >
                <View style={[s.customerBadge, { backgroundColor: selectedReportFarmer ? colors.primary : colors.muted }]}>
                    <User size={16} color={selectedReportFarmer ? '#fff' : colors.mutedForeground} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={s.customerName}>{selectedReportFarmer ? selectedReportFarmer.name : 'All Farmers'}</Text>
                    <Text style={s.customerMeta}>{selectedReportFarmer ? `Code: ${selectedReportFarmer.code}` : 'Tap to select a specific farmer'}</Text>
                </View>
                {reportFarmerFilter ? (
                    <Pressable onPress={() => setReportFarmerFilter('')} hitSlop={8}>
                        <X size={16} color={colors.mutedForeground} />
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

            {/* Print Button */}
            <Pressable style={s.exportReportBtn} onPress={handlePrintReport}>
                <Printer size={16} color="#fff" />
                <Text style={s.exportReportBtnText}>Print Report</Text>
            </Pressable>

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
                        <Text style={[s.tHeadText, s.entryCell2]}>{t.purchase.milk}</Text>
                        <Text style={[s.tHeadText, s.entryCell2]}>{t.purchase.fat}</Text>
                        <Text style={[s.tHeadText, s.entryCell2]}>{t.purchase.snf}</Text>
                        <Text style={[s.tHeadText, s.entryCell2]}>{t.common.rate}</Text>
                        <Text style={[s.tHeadText, s.entryCell3]}>{t.purchase.amt}</Text>
                    </View>
                    {filteredReportCollections.map((item, index) => (
                        <View key={item._id} style={[s.entryRow, index % 2 !== 0 && { backgroundColor: isDark ? colors.muted + '30' : '#f8fafc' }]}>
                            <View style={s.entryCell1}>
                                <Text style={[s.entryCellText, { color: colors.primary, fontWeight: '700' }]}>{item.farmerCode || '-'}</Text>
                                <Text style={s.entrySubText} numberOfLines={1}>{item.purchaseFarmer?.name || ''}</Text>
                            </View>
                            <Text style={[s.entryCellText, s.entryCell2]}>{item.quantity}</Text>
                            <Text style={[s.entryCellText, s.entryCell2]}>{item.fat || '-'}</Text>
                            <Text style={[s.entryCellText, s.entryCell2]}>{(item as any).snf || '-'}</Text>
                            <Text style={[s.entryCellText, s.entryCell2]}>{item.rate}</Text>
                            <Text style={[s.entryCellText, s.entryCell3, { color: colors.primary, fontWeight: '700' }]}>₹{item.amount.toFixed(0)}</Text>
                        </View>
                    ))}
                    <View style={s.tFootRow}>
                        <Text style={[s.tFootText, s.entryCell1]}>{t.common.total} ({filteredReportCollections.length})</Text>
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
                <View style={s.modalOverlay}>
                    <Pressable style={{ flex: 1 }} onPress={() => setShowReportFarmerModal(false)} />
                    <View style={[s.modalSheet, { maxHeight: '70%' }]}>
                        <View style={s.modalHandle} />
                        <View style={s.modalHeader}>
                            <Text style={s.modalTitle}>Select Farmer for Report</Text>
                            <Pressable onPress={() => setShowReportFarmerModal(false)}><X size={18} color={colors.foreground} /></Pressable>
                        </View>
                        <Pressable
                            style={[s.custListItem, { paddingHorizontal: 12 }]}
                            onPress={() => { setReportFarmerFilter(''); setShowReportFarmerModal(false); }}
                        >
                            <View style={[s.custListAvatar, { backgroundColor: !reportFarmerFilter ? colors.primary : colors.muted }]}>
                                <User size={14} color={!reportFarmerFilter ? '#fff' : colors.mutedForeground} />
                            </View>
                            <Text style={[s.custListName, !reportFarmerFilter && { color: colors.primary }]}>All Farmers</Text>
                            {!reportFarmerFilter && <Check size={16} color={colors.primary} />}
                        </Pressable>
                        <FlatList
                            data={customers}
                            keyExtractor={item => item._id}
                            renderItem={({ item }) => (
                                <Pressable
                                    style={[s.custListItem, { paddingHorizontal: 12 }]}
                                    onPress={() => { setReportFarmerFilter(item._id); setShowReportFarmerModal(false); }}
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
                            contentContainerStyle={{ paddingHorizontal: 6, paddingBottom: 16 }}
                            showsVerticalScrollIndicator={false}
                        />
                    </View>
                </View>
            </Modal>
        </View>
    );

    // ── Farmer Tab ──
    const renderFarmerTab = () => (
        <View>
            {/* Search + Print + Add */}
            <View style={s.farmerTopRow}>
                <View style={s.farmerSearchBox}>
                    <Search size={16} color={colors.mutedForeground} />
                    <TextInput
                        style={s.farmerSearchInput}
                        value={farmerTabSearch}
                        onChangeText={setFarmerTabSearch}
                        placeholder="Search farmers..."
                        placeholderTextColor={colors.mutedForeground}
                    />
                    {farmerTabSearch.length > 0 && (
                        <Pressable onPress={() => setFarmerTabSearch('')}><X size={13} color={colors.mutedForeground} /></Pressable>
                    )}
                </View>
                <Pressable style={s.farmerActionBtn} onPress={handleExportFarmersPdf}>
                    <Printer size={14} color="#fff" />
                </Pressable>
                <Pressable style={s.farmerActionBtn} onPress={() => { setEditingCustomer(null); setShowAddCustomer(true); }}>
                    <Plus size={14} color="#fff" />
                    <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>Add</Text>
                </Pressable>
            </View>

            {/* Farmer Management Title */}
            <Text style={s.farmerSectionTitle}>Farmer Management</Text>
            <Text style={[s.farmerSubtitle, { color: colors.mutedForeground }]}>farmer list ({customers.length})</Text>

            {/* Farmer Table */}
            {farmerSearchLoading ? (
                <View style={s.emptyBox}><ActivityIndicator color={colors.primary} /></View>
            ) : customers.length === 0 ? (
                <View style={s.emptyBox}>
                    <User size={24} color={colors.border} />
                    <Text style={s.emptyText}>No farmers found</Text>
                </View>
            ) : (
                <View style={s.tableWrap}>
                    <View style={[s.tHead, { backgroundColor: colors.primary }]}>
                        <Text style={[s.tHeadText, { flex: 0.5, color: '#fff', textAlign: 'center' }]}>{t.common.code}</Text>
                        <Text style={[s.tHeadText, { flex: 1.2, color: '#fff', textAlign: 'center' }]}>{t.common.name}</Text>
                        <Text style={[s.tHeadText, { flex: 0.8, color: '#fff', textAlign: 'center' }]}>Based On</Text>
                        <Text style={[s.tHeadText, { flex: 0.8, color: '#fff', textAlign: 'center' }]}>Milk</Text>
                        <View style={{ flex: 0.6 }} />
                    </View>
                    {customers.map((item, index) => (
                        <View key={item._id} style={[s.entryRow, index % 2 !== 0 && { backgroundColor: isDark ? colors.muted + '30' : '#f8fafc' }]}>
                            <Text style={[s.entryCellText, { flex: 0.5, color: colors.primary, fontWeight: '700', textAlign: 'center' }]}>{item.code}</Text>
                            <Text style={[s.entryCellText, { flex: 1.2, textAlign: 'center' }]} numberOfLines={1}>{item.name}</Text>
                            <Text style={[s.entryCellText, { flex: 0.8, textAlign: 'center', fontSize: 10 }]}>{item.priceBasis || '-'}</Text>
                            <Text style={[s.entryCellText, { flex: 0.8, textAlign: 'center', fontSize: 10 }]}>{item.defaultMilk || '-'}</Text>
                            <View style={{ flex: 0.6, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                                <Pressable style={s.miniIconBtn} onPress={() => handleEditCustomer(item)}>
                                    <Edit2 size={12} color={colors.primary} />
                                </Pressable>
                                <Pressable style={s.miniIconBtn} onPress={() => handleDeleteCustomer(item._id)}>
                                    <Trash2 size={12} color="#ef4444" />
                                </Pressable>
                            </View>
                        </View>
                    ))}
                </View>
            )}
        </View>
    );

    return (
        <View style={s.container}>
            <SubscriptionModal visible={showSubscriptionModal} onClose={handleModalClose} onSubscribe={handleSubscriptionSuccess} filterTab="purchase" title="Subscribe to Access Collection" fullScreen />
            <TopBar />

            <ScrollView
                style={s.scroll}
                contentContainerStyle={s.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
                keyboardShouldPersistTaps="handled"
            >
                {activeTab === 'Purchase' && renderCollectionTab()}
                {activeTab === 'Report' && renderReportTab()}
                {activeTab === 'Farmer' && renderFarmerTab()}
            </ScrollView>


            {/* ── Modals ── */}
            <Modal visible={showDateModal} animationType="slide" transparent onRequestClose={() => setShowDateModal(false)}>
                <View style={s.modalOverlay}>
                    <Pressable style={{ flex: 1 }} onPress={() => setShowDateModal(false)} />
                    <View style={s.modalSheet}>
                        <View style={s.modalHandle} />
                        <View style={s.modalHeader}>
                            <Text style={s.modalTitle}>{t.common.date}</Text>
                            <Pressable onPress={() => setShowDateModal(false)}><X size={18} color={colors.foreground} /></Pressable>
                        </View>
                        <Calendar selectedDate={entryDate} onDateSelect={(d) => { if (d) { setEntryDate(d); setShowDateModal(false); } }} />
                    </View>
                </View>
            </Modal>

            <Modal visible={showCustomerModal} animationType="slide" transparent onRequestClose={() => setShowCustomerModal(false)}>
                <View style={s.modalOverlay}>
                    <Pressable style={{ flex: 1 }} onPress={() => setShowCustomerModal(false)} />
                    <View style={[s.modalSheet, { maxHeight: '80%' }]}>
                        <View style={s.modalHandle} />
                        <View style={s.modalHeader}>
                            <Text style={s.modalTitle}>{t.purchase.selectCustomer}</Text>
                            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                                <Pressable onPress={() => { setShowCustomerModal(false); setEditingCustomer(null); setShowAddCustomer(true); }} style={s.addCustBtn}>
                                    <Plus size={14} color="#fff" />
                                    <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>New</Text>
                                </Pressable>
                                <Pressable onPress={() => setShowCustomerModal(false)}><X size={18} color={colors.foreground} /></Pressable>
                            </View>
                        </View>

                        <View style={s.searchRow}>
                            <Search size={16} color={colors.mutedForeground} />
                            <TextInput
                                style={s.searchInput}
                                value={customerSearch}
                                onChangeText={setCustomerSearch}
                                placeholder={`${t.common.search}...`}
                                placeholderTextColor={colors.mutedForeground}
                            />
                            {customerSearch.length > 0 && (
                                <Pressable onPress={() => setCustomerSearch('')}><X size={13} color={colors.mutedForeground} /></Pressable>
                            )}
                        </View>

                        <FlatList
                            data={customers}
                            keyExtractor={item => item._id}
                            renderItem={({ item }) => (
                                <Pressable style={s.custListItem} onPress={() => handleSelectCustomer(item)}>
                                    <View style={s.custListAvatar}>
                                        <Text style={s.custListAvatarText}>{item.code}</Text>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={s.custListName}>{item.name}</Text>
                                        {item.mobile ? <Text style={s.custListSub}>{item.mobile}</Text> : null}
                                    </View>
                                    <View style={{ flexDirection: 'row', gap: 3 }}>
                                        <Pressable style={[s.miniIconBtn, { backgroundColor: colors.primary + '14' }]} onPress={() => handleEditCustomer(item)}>
                                            <Edit2 size={12} color={colors.primary} />
                                        </Pressable>
                                        <Pressable style={[s.miniIconBtn, { backgroundColor: '#ef444414' }]} onPress={() => handleDeleteCustomer(item._id)}>
                                            <Trash2 size={12} color="#ef4444" />
                                        </Pressable>
                                    </View>
                                </Pressable>
                            )}
                            ListEmptyComponent={
                                <View style={s.emptyBox}>
                                    <User size={24} color={colors.mutedForeground} />
                                    <Text style={s.emptyText}>No customers found</Text>
                                </View>
                            }
                            contentContainerStyle={{ paddingHorizontal: 6, paddingBottom: 16 }}
                            showsVerticalScrollIndicator={false}
                        />
                    </View>
                </View>
            </Modal>

            <AddCustomerSheet
                visible={showAddCustomer}
                onClose={() => { setShowAddCustomer(false); setEditingCustomer(null); }}
                onSuccess={() => { fetchCustomers(); }}
                editingFarmer={editingCustomer}
                colors={colors}
                isDark={isDark}
            />

            <SuccessModal isVisible={alertVisible} title={alertTitle} message={alertMessage} onClose={() => setAlertVisible(false)} autoClose={alertTitle === 'Success'} />
            <ConfirmationModal visible={confirmVisible} title={confirmData.title} message={confirmData.message} onConfirm={confirmData.onConfirm} onClose={() => setConfirmVisible(false)} />
        </View>
    );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: 6, gap: 3, paddingBottom: 150, paddingTop: 6 },




    // Top controls
    topControls: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4, gap: 4 },
    dateBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 10 },
    dateText: { fontSize: 12, fontWeight: '600', color: colors.foreground },
    addCustTopBtn: { width: 36, height: 36, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },

    // Shift
    shiftRow: { flexDirection: 'row', borderWidth: 1, borderColor: colors.border, overflow: 'hidden', flex: 1, borderRadius: 10 },
    shiftBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, paddingVertical: 6, backgroundColor: colors.card },
    shiftBtnActive: { backgroundColor: colors.primary },
    shiftBtnText: { fontSize: 11, fontWeight: '700', color: colors.foreground },
    shiftBtnTextActive: { color: '#fff' },

    // Summary
    summaryBar: { flexDirection: 'row', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, paddingVertical: 8, borderRadius: 10 },
    summaryCell: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
    summaryVal: { fontSize: 14, fontWeight: '800', color: colors.foreground },
    summaryLbl: { fontSize: 9, color: colors.mutedForeground, fontWeight: '500' },
    summaryDivider: { width: 1, backgroundColor: colors.border, marginVertical: 2 },

    // Customer
    customerBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, padding: 8, gap: 8, borderRadius: 10 },
    customerBadge: { width: 34, height: 34, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 8 },
    customerBadgeText: { fontSize: 12, fontWeight: '800', color: '#fff' },
    customerName: { fontSize: 13, fontWeight: '700', color: colors.foreground },
    customerMeta: { fontSize: 10, color: colors.mutedForeground, marginTop: 1 },

    // Entry card
    entryCard: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, padding: 8, borderRadius: 10 },
    milkRow: { flexDirection: 'row', gap: 4, marginBottom: 6 },
    milkBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 7, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, borderRadius: 8 },
    milkBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    milkBtnText: { fontSize: 12, fontWeight: '700', color: colors.foreground },

    fieldsRow: { flexDirection: 'row', gap: 5 },
    fieldBox: { flex: 1 },
    fieldLabel: { fontSize: 9, fontWeight: '600', color: colors.mutedForeground, marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
    fieldInput: { borderWidth: 1, borderColor: colors.border, paddingHorizontal: 6, paddingVertical: 5, fontSize: 15, fontWeight: '700', color: colors.foreground, backgroundColor: colors.background, textAlign: 'center', borderRadius: 8 },

    actionsRow: { flexDirection: 'row', gap: 5, marginTop: 6 },
    zeroToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, borderRadius: 8 },
    zeroText: { fontSize: 11, fontWeight: '600', color: colors.mutedForeground },
    saveEntryBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8, backgroundColor: colors.primary, borderRadius: 8 },
    saveEntryText: { fontSize: 13, fontWeight: '800', color: '#fff' },

    // Table
    tableWrap: { borderWidth: 1, borderColor: colors.border, overflow: 'hidden', borderRadius: 10 },
    tableBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 5, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
    tableBarTitle: { fontSize: 12, fontWeight: '700', color: colors.foreground },
    badge: { backgroundColor: colors.primary, paddingHorizontal: 5, paddingVertical: 0, borderRadius: 4 },
    badgeText: { fontSize: 9, fontWeight: '800', color: '#fff' },
    pdfBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.primary, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    pdfBtnText: { fontSize: 10, fontWeight: '700', color: '#fff' },

    tHead: { flexDirection: 'row', backgroundColor: isDark ? colors.muted : '#eef2f7', paddingVertical: 5, paddingHorizontal: 6, alignItems: 'center' },
    tHeadText: { fontSize: 9, fontWeight: '700', color: colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 0.3, textAlign: 'center' },

    entryRow: { flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 6, alignItems: 'center', borderBottomWidth: 0.5, borderBottomColor: colors.border },
    entryCell1: { flex: 1.1 },
    entryCell2: { flex: 0.6, textAlign: 'center' },
    entryCell3: { flex: 0.8, textAlign: 'right' },
    entryCellText: { fontSize: 10, color: colors.foreground },
    entrySubText: { fontSize: 8, color: colors.mutedForeground },

    tFootRow: { flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 6, alignItems: 'center', backgroundColor: isDark ? colors.secondary : '#ecfdf5', borderTopWidth: 1, borderTopColor: colors.primary + '30' },
    tFootText: { fontSize: 11, fontWeight: '800', color: colors.foreground, textAlign: 'center' },

    deleteBtn: { width: 26, alignItems: 'center' },

    // Empty
    emptyBox: { paddingVertical: 20, alignItems: 'center', gap: 4 },
    emptyText: { fontSize: 11, color: colors.mutedForeground },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalSheet: { backgroundColor: colors.background, borderTopLeftRadius: 14, borderTopRightRadius: 14, paddingBottom: 16 },
    modalHandle: { width: 32, height: 3, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginTop: 8 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 8 },
    modalTitle: { fontSize: 14, fontWeight: '700', color: colors.foreground },

    // Search
    searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background, paddingHorizontal: 10, marginHorizontal: 6, marginBottom: 4, gap: 6, borderWidth: 1, borderColor: colors.border, borderRadius: 10 },
    searchInput: { flex: 1, paddingVertical: 8, fontSize: 14, color: colors.foreground },

    // Customer list
    custListItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: colors.border },
    custListAvatar: { width: 30, height: 30, backgroundColor: colors.primary + '18', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.primary + '30', borderRadius: 8 },
    custListAvatarText: { fontSize: 11, fontWeight: '800', color: colors.primary },
    custListName: { fontSize: 12, fontWeight: '600', color: colors.foreground },
    custListSub: { fontSize: 10, color: colors.mutedForeground },

    miniIconBtn: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center', borderRadius: 6 },
    addCustBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.primary, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },

    // Report tab
    sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.foreground, marginBottom: 6 },
    dateRangeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
    dateInputWrapper: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 8 },
    dateInputText: { flex: 1, fontSize: 12, color: colors.foreground },
    dateSeparator: { fontSize: 14, color: colors.mutedForeground, fontWeight: '600' },
    reportSummaryCard: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, marginBottom: 6 },
    reportSummaryRow: { flexDirection: 'row', alignItems: 'center' },
    reportSummaryItem: { flex: 1, alignItems: 'center' },
    reportSummaryLabel: { fontSize: 10, color: colors.mutedForeground, fontWeight: '500' },
    reportSummaryValue: { fontSize: 15, fontWeight: '800', color: colors.foreground, marginTop: 2 },
    reportSummaryDivider: { width: 1, height: 30, backgroundColor: colors.border },
    exportReportBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.primary, paddingVertical: 10, borderRadius: 10, marginBottom: 6 },
    exportReportBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },

    // Farmer tab
    farmerTopRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
    farmerSearchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 10, gap: 6 },
    farmerSearchInput: { flex: 1, paddingVertical: 8, fontSize: 14, color: colors.foreground },
    farmerActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.primary, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10 },
    farmerSectionTitle: { fontSize: 15, fontWeight: '700', color: colors.foreground },
    farmerSubtitle: { fontSize: 11, marginBottom: 6 },
});
