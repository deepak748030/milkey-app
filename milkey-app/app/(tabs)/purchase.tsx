import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View, Text, StyleSheet, Pressable, TextInput, FlatList,
    ActivityIndicator, RefreshControl, Modal, ScrollView, Keyboard, KeyboardAvoidingView, Linking
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/hooks/useTranslation';
import {
    Plus, Edit2, Trash2, Calendar as CalendarIcon, Search, X,
    ChevronDown, FileText, User, Sun, Moon,
    Droplets, CircleDot, Download, Check, Printer, Milk, Ban
} from 'lucide-react-native';
import TopBar from '@/components/TopBar';
import {
    milkCollectionsApi, purchaseFarmersApi, rateChartsApi,
    MilkCollection, PurchaseFarmer
} from '@/lib/milkeyApi';
import * as ExpoPrint from 'expo-print';
import { useBluetoothPrinter } from '@/hooks/useBluetoothPrinter';
import { concatBytes, INIT, ALIGN_CENTER, BOLD_ON, DOUBLE_ON, NORMAL_SIZE, BOLD_OFF, ALIGN_LEFT, textToBytes, separator, doubleSeparator, twoColumnLine, threeColumnLine, FEED_3_LINES } from '@/lib/escpos';
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
const TAB_ORDER: TabType[] = ['Purchase', 'Report', 'C-Farmer'];

export default function PurchaseScreen() {
    const { colors, isDark } = useTheme();
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const {
        hasAccess, loading: subscriptionLoading, showSubscriptionModal,
        handleModalClose, handleSubscriptionSuccess
    } = useSubscriptionCheck('purchase');
    const { printData, isPrinting } = useBluetoothPrinter();

    const { purchaseTab: activeTab, setPurchaseTab: setActiveTab } = useSubTabStore();

    // Customer state
    const [customers, setCustomers] = useState<PurchaseFarmer[]>([]);
    const [selectedCustomer, setSelectedCustomer] = useState<PurchaseFarmer | null>(null);
    const [customerSearch, setCustomerSearch] = useState('');
    const debouncedSearch = useDebounce(customerSearch, 400);

    // Inline farmer search state
    const [showInlineSearch, setShowInlineSearch] = useState(false);
    const [inlineSearchCode, setInlineSearchCode] = useState('');
    const [inlineSearchResults, setInlineSearchResults] = useState<PurchaseFarmer[]>([]);

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
    const [showPrintTypeModal, setShowPrintTypeModal] = useState(false);
    const [printSource, setPrintSource] = useState<'purchase' | 'report'>('purchase');

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

    // Fetch customers including inactive for farmer tab
    const fetchCustomersWithInactive = useCallback(async (search?: string) => {
        try {
            const res = await purchaseFarmersApi.getAll({ search, limit: 100, includeInactive: true });
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

    useEffect(() => {
        if (activeTab === 'C-Farmer') {
            fetchCustomersWithInactive();
        } else {
            fetchCustomers();
        }
    }, [activeTab]);
    useEffect(() => { fetchCollections(1); }, [entryDate, entryShift]);
    useEffect(() => { if (debouncedSearch !== undefined) fetchCustomers(debouncedSearch); }, [debouncedSearch]);
    useEffect(() => { if (reportStartDate && reportEndDate) fetchReportData(); }, [reportStartDate, reportEndDate]);

    // Farmer tab search - include inactive farmers
    useEffect(() => {
        const searchFarmers = async () => {
            setFarmerSearchLoading(true);
            try {
                const res = await purchaseFarmersApi.getAll({ search: debouncedFarmerSearch.trim() || undefined, limit: 100, includeInactive: true });
                if (res.success) setCustomers(res.response?.data || []);
            } catch { }
            setFarmerSearchLoading(false);
        };
        searchFarmers();
    }, [debouncedFarmerSearch]);

    // Inline search by code
    useEffect(() => {
        if (!inlineSearchCode.trim()) {
            setInlineSearchResults([]);
            return;
        }
        const filtered = customers.filter(c =>
            c.isActive !== false && c.code.toLowerCase().startsWith(inlineSearchCode.toLowerCase())
        );
        setInlineSearchResults(filtered.slice(0, 8));
    }, [inlineSearchCode, customers]);

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
            setSnfValue('');
        } else if (customer.priceBasis === 'fat') {
            // For fat-based, cowFat/buffaloFat is the fatRate (price per unit fat)
            setFatValue('');
            setRateValue('');
            setSnfValue('');
        } else {
            // fat_snf - clear all, user enters fat, snf, and rate manually
            setFatValue('');
            setSnfValue('');
            setRateValue('');
        }
    };

    // For fat-based pricing: rate = fat × farmer's fatRate (cowFat/buffaloFat)
    useEffect(() => {
        if (!selectedCustomer || selectedCustomer.priceBasis !== 'fat') return;
        const fat = parseFloat(fatValue) || 0;
        if (fat <= 0) { setRateValue(''); return; }
        const fatRate = milkType === 'cow' ? (selectedCustomer.cowFat || 0) : (selectedCustomer.buffaloFat || 0);
        const rate = fat * fatRate;
        setRateValue(rate > 0 ? rate.toFixed(2) : '');
    }, [fatValue, selectedCustomer, milkType]);

    const computeAmount = (): number => {
        if (isZero) return 0;
        const qty = parseFloat(milkQty) || 0;
        const rate = parseFloat(rateValue) || 0;
        return parseFloat((qty * rate).toFixed(2));
    };

    // Open SMS or WhatsApp with collection info
    const openAlertApp = useCallback((customer: PurchaseFarmer, qty: number, fat: number, snf: number, rate: number, amount: number) => {
        const alertMethod = (customer as any).alertMethod || 'none';
        if (alertMethod === 'none' || !customer.mobile) return;

        const dateObj = entryDate;
        const dateStr = `${String(dateObj.getDate()).padStart(2, '0')}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getFullYear()).slice(-2)}`;
        const shiftStr = entryShift === 'morning' ? 'Morning' : 'Evening';

        const message = `Digital Milk Slip\n\n----------------------------------------------------\n\nDairy - Amul\n\nCode - ${customer.code}\n\nName - ${customer.name}\n\nDate - ${dateStr}   shift - ${shiftStr}\n\n----------------------------------------------------\n\nFat - ${fat || '-'}                    SNF -  ${snf || '-'}\n\nRate(Rs.) - ${rate}      Qty -  ${qty}\n\nAmount - ${amount.toFixed(2)}`;

        const phone = customer.mobile.replace(/\D/g, '');

        if (alertMethod === 'sms') {
            const encoded = encodeURIComponent(message);
            Linking.openURL(`sms:${phone}?body=${encoded}`).catch(() => { });
        } else if (alertMethod === 'whatsapp') {
            const encoded = encodeURIComponent(message);
            const whatsappPhone = phone.startsWith('91') ? phone : `91${phone}`;
            Linking.openURL(`whatsapp://send?phone=${whatsappPhone}&text=${encoded}`).catch(() => {
                Linking.openURL(`https://wa.me/${whatsappPhone}?text=${encoded}`).catch(() => { });
            });
        }
    }, [entryDate, entryShift]);

    const handleSaveEntry = useCallback(async () => {
        if (saving) return;
        if (!selectedCustomer) { showAlert('Error', 'Please select a customer'); return; }
        if (!milkQty && !isZero) { showAlert('Error', 'Enter milk quantity'); return; }
        const qty = isZero ? 0 : parseFloat(milkQty) || 0;
        const rate = parseFloat(rateValue) || 0;
        if (!isZero && (qty <= 0 || rate <= 0)) { showAlert('Error', 'Enter valid quantity and rate'); return; }

        // Validate fat for fat-based pricing
        if (selectedCustomer.priceBasis === 'fat' && !isZero) {
            const fat = parseFloat(fatValue) || 0;
            if (fat <= 0) { showAlert('Error', 'Enter fat value'); return; }
        }
        if (selectedCustomer.priceBasis === 'fat_snf' && !isZero) {
            const fat = parseFloat(fatValue) || 0;
            const snf = parseFloat(snfValue) || 0;
            if (fat <= 0) { showAlert('Error', 'Enter fat value'); return; }
            if (snf <= 0) { showAlert('Error', 'Enter SNF value'); return; }
        }

        setSaving(true);
        try {
            const dateStr = `${entryDate.getFullYear()}-${String(entryDate.getMonth() + 1).padStart(2, '0')}-${String(entryDate.getDate()).padStart(2, '0')}`;
            const fat = parseFloat(fatValue) || 0;
            const snf = parseFloat(snfValue) || 0;
            const amount = computeAmount();

            const res = await milkCollectionsApi.create({
                farmerCode: selectedCustomer.code,
                purchaseFarmerId: selectedCustomer._id,
                quantity: isZero ? 0.1 : qty,
                rate: isZero ? 0 : rate,
                date: dateStr,
                shift: entryShift,
                fat,
                snf,
                milkType,
            });
            if (res.success) {
                showAlert('Success', 'Entry saved');

                // Open SMS/WhatsApp if configured
                openAlertApp(selectedCustomer, qty, fat, snf, rate, amount);

                setMilkQty(''); setFatValue(''); setSnfValue(''); setRateValue('');
                if (selectedCustomer.priceBasis === 'rate') autoFillRate(selectedCustomer, milkType);
                setIsZero(false);
                fetchCollections(1);
            } else {
                showAlert('Error', res.message || 'Failed to save');
            }
        } catch { showAlert('Error', 'Failed to save entry'); }
        setSaving(false);
    }, [saving, selectedCustomer, milkQty, rateValue, fatValue, snfValue, entryDate, entryShift, milkType, isZero, openAlertApp]);

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
        setShowInlineSearch(false);
        setInlineSearchCode('');
    }, []);

    const handleEditCustomer = useCallback((c: PurchaseFarmer) => {
        setEditingCustomer(c);
        setShowAddCustomer(true);
        setShowCustomerModal(false);
    }, []);

    // Soft delete customer (from app)
    const handleDeleteCustomer = useCallback((id: string) => {
        showConfirm('Deactivate Customer', 'This will deactivate the customer. Only admin can permanently delete.', async () => {
            setConfirmVisible(false);
            try {
                const res = await purchaseFarmersApi.delete(id);
                if (res.success) {
                    showAlert('Success', 'Customer deactivated');
                    if (activeTab === 'C-Farmer') {
                        fetchCustomersWithInactive();
                    } else {
                        fetchCustomers();
                    }
                    if (selectedCustomer?._id === id) setSelectedCustomer(null);
                } else showAlert('Error', res.message || 'Failed');
            } catch { showAlert('Error', 'Failed'); }
        });
    }, [selectedCustomer, activeTab]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        if (activeTab === 'C-Farmer') {
            await fetchCustomersWithInactive();
        } else {
            await Promise.all([fetchCustomers(), fetchCollections(1)]);
        }
        setRefreshing(false);
    }, [fetchCustomers, fetchCollections, activeTab]);

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

    // Handle print button press - show type selection popup
    const handlePrintPress = useCallback((source: 'purchase' | 'report') => {
        const data = source === 'report'
            ? (filteredReportCollections.length > 0 ? filteredReportCollections : collections)
            : collections;
        if (data.length === 0) { showAlert('Info', 'No data to print'); return; }
        setPrintSource(source);
        setShowPrintTypeModal(true);
    }, [filteredReportCollections, collections]);

    // Full Summary Print
    const handleFullSummaryPrint = useCallback(async (source?: 'purchase' | 'report') => {
        setShowPrintTypeModal(false);
        const resolvedSource = source ?? printSource;
        const isReport = resolvedSource === 'report';
        const data = isReport
            ? (filteredReportCollections.length > 0 ? filteredReportCollections : collections)
            : collections;
        const totals = isReport
            ? (filteredReportCollections.length > 0 ? filteredReportTotals : historyTotals)
            : historyTotals;

        const title = isReport ? 'COLLECTION REPORT' : 'COLLECTION';
        const dateLabel = isReport && reportStartDate && reportEndDate
            ? `${formatDateStr(reportStartDate)} to ${formatDateStr(reportEndDate)}`
            : `${formatDate(entryDate)} (${entryShift === 'morning' ? 'Morning' : 'Evening'})`;
        const farmerLabel = isReport && selectedReportFarmer ? `Farmer: ${selectedReportFarmer.name}` : '';

        const parts: Uint8Array[] = [INIT, ALIGN_CENTER, BOLD_ON, DOUBLE_ON, textToBytes(title + '\n'), NORMAL_SIZE, BOLD_OFF, textToBytes(dateLabel + '\n')];
        if (farmerLabel) parts.push(textToBytes(farmerLabel + '\n'));
        parts.push(ALIGN_LEFT, doubleSeparator());

        parts.push(textToBytes(threeColumnLine('Code', 'Qty', 'Amt')));
        parts.push(separator());

        for (const c of data) {
            const code = c.farmerCode || '-';
            const name = c.purchaseFarmer?.name || '';
            parts.push(textToBytes(twoColumnLine(code + (name ? ` ${name}` : ''), '')));
            parts.push(textToBytes(twoColumnLine('  Milk: ' + String(c.quantity), 'Fat: ' + (c.fat || '-'))));
            parts.push(textToBytes(twoColumnLine('  SNF: ' + ((c as any).snf || '-'), 'Rate: ' + String(c.rate))));
            parts.push(BOLD_ON);
            parts.push(textToBytes(twoColumnLine('  Amount:', '₹' + c.amount.toFixed(0))));
            parts.push(BOLD_OFF);
            parts.push(separator());
        }

        parts.push(doubleSeparator());
        parts.push(BOLD_ON);
        parts.push(textToBytes(twoColumnLine('Total Qty:', totals.quantity.toFixed(2) + ' L')));
        parts.push(textToBytes(twoColumnLine('Total Amt:', '₹' + totals.amount.toFixed(2))));
        const avgRate = totals.quantity > 0 ? (totals.amount / totals.quantity).toFixed(2) : '0';
        parts.push(textToBytes(twoColumnLine('Grand Avg Rate:', avgRate)));
        const uniqueFarmers = new Set(data.map(c => c.farmerCode || c.purchaseFarmer?._id)).size;
        parts.push(textToBytes(twoColumnLine('Total Farmers:', String(uniqueFarmers))));
        parts.push(textToBytes(twoColumnLine('Total Net Qty:', totals.quantity.toFixed(2))));
        parts.push(BOLD_OFF, FEED_3_LINES);

        const bytes = concatBytes(...parts);
        const success = await printData(bytes);
        if (success) {
            showAlert('Success', 'Full summary printed!');
            return;
        }

        showAlert('Printer Not Ready', 'Connect your Bluetooth thermal printer from the top bar, then try printing again.');
    }, [printSource, filteredReportCollections, collections, filteredReportTotals, historyTotals, entryDate, entryShift, reportStartDate, reportEndDate, printData, selectedReportFarmer]);

    const handleShortSummaryPrint = useCallback(async (source?: 'purchase' | 'report') => {
        setShowPrintTypeModal(false);
        const resolvedSource = source ?? printSource;
        const isReport = resolvedSource === 'report';
        const data = isReport
            ? (filteredReportCollections.length > 0 ? filteredReportCollections : collections)
            : collections;
        const totals = isReport
            ? (filteredReportCollections.length > 0 ? filteredReportTotals : historyTotals)
            : historyTotals;

        const title = 'Provisional Short Shift Summary';
        const dateLabel = isReport && reportStartDate && reportEndDate
            ? `${formatDateStr(reportStartDate)} to ${formatDateStr(reportEndDate)}`
            : `${formatDate(entryDate)} (${entryShift === 'morning' ? 'Morning' : 'Evening'})`;

        const avgRate = totals.quantity > 0 ? (totals.amount / totals.quantity).toFixed(2) : '0';
        const uniqueFarmers = new Set(data.map(c => c.farmerCode || c.purchaseFarmer?._id)).size;

        const parts: Uint8Array[] = [INIT, ALIGN_CENTER, BOLD_ON, DOUBLE_ON, textToBytes(title + '\n'), NORMAL_SIZE, BOLD_OFF, textToBytes(dateLabel + '\n')];
        parts.push(ALIGN_LEFT, doubleSeparator());
        parts.push(BOLD_ON);
        parts.push(textToBytes(twoColumnLine('Total Qty:', totals.quantity.toFixed(2) + ' L')));
        parts.push(textToBytes(twoColumnLine('Total Amt:', '₹' + totals.amount.toFixed(2))));
        parts.push(textToBytes(twoColumnLine('Average Rate:', avgRate)));
        parts.push(textToBytes(twoColumnLine('Number of Samples:', String(data.length))));
        parts.push(textToBytes(twoColumnLine('Number of Farmers:', String(uniqueFarmers))));
        parts.push(BOLD_OFF, doubleSeparator());
        parts.push(ALIGN_CENTER, textToBytes('--- Short Summary ---\n'));
        parts.push(FEED_3_LINES);

        const bytes = concatBytes(...parts);
        const success = await printData(bytes);
        if (success) {
            showAlert('Success', 'Short summary printed!');
            return;
        }

        showAlert('Printer Not Ready', 'Connect your Bluetooth thermal printer from the top bar, then try printing again.');
    }, [printSource, filteredReportCollections, collections, filteredReportTotals, historyTotals, entryDate, entryShift, reportStartDate, reportEndDate, printData]);

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
        <table><thead><tr><th>Code</th><th>Name</th><th>Mobile</th><th>Milk</th><th>Basis</th><th>Status</th></tr></thead>
        <tbody>${customers.map(c => `<tr><td>${c.code}</td><td>${c.name}</td><td>${c.mobile || '-'}</td><td>${c.defaultMilk || '-'}</td><td>${c.priceBasis || '-'}</td><td>${c.isActive !== false ? 'Active' : 'Inactive'}</td></tr>`).join('')}
        </tbody></table></body></html>`;
        try {
            const { uri } = await ExpoPrint.printToFileAsync({ html });
            if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
        } catch { showAlert('Error', 'Failed to export'); }
    }, [customers]);

    // ── Collection Tab ──
    const renderCollectionTab = () => (
        <View style={{ flex: 1 }}>
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
                {selectedCustomer && (
                    <Pressable
                        style={s.addCustTopBtn}
                        onPress={() => { setEditingCustomer(selectedCustomer); setShowAddCustomer(true); }}
                    >
                        <Edit2 size={16} color="#fff" />
                    </Pressable>
                )}
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

            {/* Inline Farmer Search - replaces the old pressable box */}
            <View style={s.codeRow}>
                {showInlineSearch ? (
                    <View style={s.inlineSearchContainer}>
                        <Search size={16} color={colors.mutedForeground} />
                        <TextInput
                            style={s.inlineSearchInput}
                            value={inlineSearchCode}
                            onChangeText={setInlineSearchCode}
                            placeholder="Search by code..."
                            placeholderTextColor={colors.mutedForeground}
                            autoFocus
                            keyboardType="number-pad"
                        />
                        <Pressable onPress={() => {
                            setShowInlineSearch(false);
                            setInlineSearchCode('');
                        }}>
                            <X size={18} color={colors.destructive} />
                        </Pressable>
                    </View>
                ) : selectedCustomer ? (
                    <Pressable style={s.selectedFarmerBox} onPress={() => setShowInlineSearch(true)}>
                        <View style={s.selectedFarmerBadge}>
                            <Text style={s.selectedFarmerBadgeText}>{selectedCustomer.code}</Text>
                        </View>
                        <Text style={s.selectedFarmerName} numberOfLines={1}>{selectedCustomer.name}</Text>
                        <Pressable onPress={() => {
                            setSelectedCustomer(null);
                            setShowInlineSearch(true);
                            setInlineSearchCode('');
                        }} hitSlop={8}>
                            <X size={16} color={colors.destructive} />
                        </Pressable>
                    </Pressable>
                ) : (
                    <Pressable style={s.codeInputBox} onPress={() => setShowInlineSearch(true)}>
                        <Search size={14} color={colors.mutedForeground} />
                        <Text style={[s.codeInputText, { color: colors.mutedForeground }]}>{t.purchase.enterCode}</Text>
                    </Pressable>
                )}

                {showCow && (
                    <Pressable onPress={() => setMilkType('cow')} style={[s.milkToggleBtn, milkType === 'cow' && s.milkToggleBtnActive]}>
                        <Milk size={14} color={milkType === 'cow' ? '#fff' : colors.foreground} />
                        <Text style={[s.milkToggleBtnText, milkType === 'cow' && { color: '#fff' }]}>{t.purchase.cow}</Text>
                    </Pressable>
                )}
                {showBuffalo && (
                    <Pressable onPress={() => setMilkType('buffalo')} style={[s.milkToggleBtn, milkType === 'buffalo' && s.milkToggleBtnActive]}>
                        <Milk size={14} color={milkType === 'buffalo' ? '#fff' : colors.foreground} />
                        <Text style={[s.milkToggleBtnText, milkType === 'buffalo' && { color: '#fff' }]}>{t.purchase.buffalo}</Text>
                    </Pressable>
                )}
            </View>

            {/* Inline search results dropdown */}
            {showInlineSearch && inlineSearchCode.trim().length > 0 && (
                <View style={s.inlineDropdown}>
                    {inlineSearchResults.length > 0 ? (
                        inlineSearchResults.map(item => (
                            <Pressable
                                key={item._id}
                                style={s.inlineDropdownItem}
                                onPress={() => handleSelectCustomer(item)}
                            >
                                <View style={s.inlineDropdownBadge}>
                                    <Text style={s.inlineDropdownBadgeText}>{item.code}</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={s.inlineDropdownName}>{item.name}</Text>
                                    {item.mobile ? <Text style={s.inlineDropdownSub}>{item.mobile}</Text> : null}
                                </View>
                            </Pressable>
                        ))
                    ) : (
                        <View style={s.emptyBox}>
                            <Text style={s.emptyText}>No farmer with code "{inlineSearchCode}"</Text>
                        </View>
                    )}
                </View>
            )}

            {/* Entry Fields */}
            {selectedCustomer && (
                <View style={s.entryCard}>
                    {/* Price Basis Label */}
                    <Text style={s.priceBasisLabel}>
                        {selectedCustomer.priceBasis === 'rate' ? t.purchase.rateBased : selectedCustomer.priceBasis === 'fat_snf' ? 'Fat + SNF based' : t.purchase.fatBased}
                    </Text>

                    {/* Input Row */}
                    <View style={s.fieldsRow}>
                        <View style={s.fieldBox}>
                            <Text style={s.fieldLabel}>{t.purchase.qty}</Text>
                            <TextInput style={s.fieldInput} value={milkQty} onChangeText={setMilkQty} keyboardType="decimal-pad" placeholder="0.0" placeholderTextColor={colors.mutedForeground} editable={!isZero} />
                        </View>
                        {selectedCustomer.priceBasis !== 'rate' && (
                            <View style={s.fieldBox}>
                                <Text style={s.fieldLabel}>{t.purchase.fat}</Text>
                                <TextInput style={s.fieldInput} value={fatValue} onChangeText={setFatValue} keyboardType="decimal-pad" placeholder="0.0" placeholderTextColor={colors.mutedForeground} />
                            </View>
                        )}
                        {selectedCustomer.priceBasis === 'fat_snf' && (
                            <View style={s.fieldBox}>
                                <Text style={s.fieldLabel}>SNF</Text>
                                <TextInput style={s.fieldInput} value={snfValue} onChangeText={setSnfValue} keyboardType="decimal-pad" placeholder="0.0" placeholderTextColor={colors.mutedForeground} />
                            </View>
                        )}
                        {(selectedCustomer.priceBasis === 'rate' || selectedCustomer.priceBasis === 'fat_snf') && (
                            <View style={s.fieldBox}>
                                <Text style={s.fieldLabel}>{t.common.rate}</Text>
                                <TextInput style={s.fieldInput} value={isZero ? '0' : rateValue} onChangeText={setRateValue} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={colors.mutedForeground} editable={!isZero} />
                            </View>
                        )}
                    </View>

                    {/* Computed Values Display */}
                    <View style={s.computedRow}>
                        {selectedCustomer.priceBasis === 'fat' && (
                            <Text style={s.computedText}>{t.common.rate}: <Text style={s.computedValue}>{rateValue || '0'}</Text></Text>
                        )}
                        <Text style={s.computedText}>{t.common.amount}: <Text style={[s.computedValue, { color: colors.primary }]}>₹{computeAmount().toFixed(1)}</Text></Text>
                    </View>

                    {/* Actions */}
                    <View style={s.actionsRow}>
                        <Pressable style={[s.zeroToggle, isZero && { backgroundColor: colors.destructive, borderColor: colors.destructive }]} onPress={() => setIsZero(!isZero)}>
                            <Ban size={14} color={isZero ? '#fff' : colors.destructive} />
                            <Text style={[s.zeroText, isZero && { color: '#fff' }]}>{t.purchase.zeroEntry}</Text>
                        </Pressable>
                        <Pressable style={[s.saveEntryBtn, saving && { opacity: 0.5 }]} onPress={handleSaveEntry} disabled={saving}>
                            {saving ? <ActivityIndicator size="small" color="#fff" /> : (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Check size={18} color="#fff" strokeWidth={3} />
                                    <Text style={s.saveEntryText}>{t.common.save}</Text>
                                </View>
                            )}
                        </Pressable>
                    </View>
                </View>
            )}

        </View>
    );

    // ── Sale Entries Table (fixed bottom) ──
    const renderSaleEntriesTable = () => (
        <View style={s.tableBottomWrap}>
            <View style={s.tableWrap}>
                <View style={s.tableBar}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        <FileText size={13} color={colors.primary} />
                        <Text style={s.tableBarTitle}>{t.purchase.saleEntries}</Text>
                        <View style={s.badge}><Text style={s.badgeText}>{collections.length}</Text></View>
                    </View>
                    <Pressable style={[s.pdfBtn, isPrinting && { opacity: 0.5 }]} onPress={() => handlePrintPress('purchase')} disabled={isPrinting}>
                        {isPrinting ? <ActivityIndicator size={12} color="#fff" /> : <Printer size={12} color="#fff" />}
                    </Pressable>
                </View>

                <View style={s.tHead}>
                    <View style={s.entryCell1}><Text style={[s.tHeadText, { textAlign: 'center' }]}>{t.common.code}</Text></View>
                    <View style={s.entryCellFlex}><Text style={[s.tHeadText, { textAlign: 'center' }]}>{t.purchase.milk}</Text></View>
                    <View style={s.entryCellFlex}><Text style={[s.tHeadText, { textAlign: 'center' }]}>{t.purchase.fat}</Text></View>
                    <View style={s.entryCellFlex}><Text style={[s.tHeadText, { textAlign: 'center' }]}>SNF</Text></View>
                    <View style={s.entryCellFlex}><Text style={[s.tHeadText, { textAlign: 'center' }]}>{t.common.rate}</Text></View>
                    <View style={s.entryCellAmt}><Text style={[s.tHeadText, { textAlign: 'center' }]}>{t.purchase.amt}</Text></View>
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
                        <ScrollView style={{ maxHeight: 90 }} nestedScrollEnabled showsVerticalScrollIndicator>
                            {collections.map((item, index) => (
                                <View key={item._id} style={[s.entryRow, index % 2 !== 0 && { backgroundColor: isDark ? colors.muted + '30' : '#f8fafc' }]}>
                                    <View style={s.entryCell1}>
                                        <Text style={[s.entryCellText, { color: colors.primary, fontWeight: '700', textAlign: 'center' }]}>{item.farmerCode || '-'}</Text>
                                        <Text style={[s.entrySubText, { textAlign: 'center' }]} numberOfLines={1}>{item.purchaseFarmer?.name || ''}</Text>
                                    </View>
                                    <View style={s.entryCellFlex}><Text style={[s.entryCellText, { textAlign: 'center' }]}>{item.quantity}</Text></View>
                                    <View style={s.entryCellFlex}><Text style={[s.entryCellText, { textAlign: 'center' }]}>{item.fat || '-'}</Text></View>
                                    <View style={s.entryCellFlex}><Text style={[s.entryCellText, { textAlign: 'center' }]}>{(item as any).snf || '-'}</Text></View>
                                    <View style={s.entryCellFlex}><Text style={[s.entryCellText, { textAlign: 'center' }]}>{item.rate}</Text></View>
                                    <View style={s.entryCellAmt}><Text style={[s.entryCellText, { textAlign: 'center', color: colors.primary, fontWeight: '700' }]}>₹{item.amount.toFixed(0)}</Text></View>
                                    <Pressable
                                        style={s.deleteBtn}
                                        onPress={() => handleDeleteCollection(item._id)}
                                        disabled={deletingId === item._id}
                                    >
                                        {deletingId === item._id ? <ActivityIndicator size={10} color={colors.destructive} /> : <Trash2 size={12} color={colors.destructive} />}
                                    </Pressable>
                                </View>
                            ))}
                        </ScrollView>

                    </>
                )}
            </View>
        </View>
    );

    // ── Report Tab ──
    const renderReportTab = () => (
        <View>
            {/* Farmer Picker */}
            <Pressable style={s.reportFarmerPicker} onPress={() => setShowReportFarmerModal(true)}>
                <User size={16} color={colors.primary} />
                <Text style={s.reportFarmerText} numberOfLines={1}>
                    {selectedReportFarmer ? `${selectedReportFarmer.code} - ${selectedReportFarmer.name}` : 'All Farmers'}
                </Text>
                {reportFarmerFilter ? (
                    <Pressable onPress={() => setReportFarmerFilter('')} hitSlop={6}>
                        <X size={14} color={colors.destructive} />
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

            {/* Print & Export Buttons */}
            <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable
                    style={[s.exportReportBtn, { flex: 1, backgroundColor: colors.primary }, isPrinting && { opacity: 0.6 }]}
                    onPress={() => {
                        setPrintSource('report');
                        handleFullSummaryPrint('report');
                    }}
                    disabled={isPrinting}
                >
                    {isPrinting ? <ActivityIndicator size={16} color="#fff" /> : <FileText size={16} color="#fff" />}
                    <Text style={s.exportReportBtnText}>Full Summary</Text>
                </Pressable>
                <Pressable
                    style={[s.exportReportBtn, { flex: 1, backgroundColor: '#f59e0b' }, isPrinting && { opacity: 0.6 }]}
                    onPress={() => {
                        setPrintSource('report');
                        handleShortSummaryPrint('report');
                    }}
                    disabled={isPrinting}
                >
                    {isPrinting ? <ActivityIndicator size={16} color="#fff" /> : <Printer size={16} color="#fff" />}
                    <Text style={s.exportReportBtnText}>Short Summary</Text>
                </Pressable>
            </View>
            <Pressable style={[s.exportReportBtn, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]} onPress={handleExportReportPdf}>
                <Download size={16} color={colors.primary} />
                <Text style={[s.exportReportBtnText, { color: colors.foreground }]}>Download PDF</Text>
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
                            <View style={[s.entryCell1, { alignItems: 'center' }]}>
                                <Text style={[s.entryCellText, { color: colors.primary, fontWeight: '700', textAlign: 'center' }]}>{item.farmerCode || '-'}</Text>
                                <Text style={[s.entrySubText, { textAlign: 'center' }]} numberOfLines={1}>{item.purchaseFarmer?.name || ''}</Text>
                            </View>
                            <Text style={[s.entryCellText, s.entryCell2, { textAlign: 'center' }]}>{item.quantity}</Text>
                            <Text style={[s.entryCellText, s.entryCell2, { textAlign: 'center' }]}>{item.fat || '-'}</Text>
                            <Text style={[s.entryCellText, s.entryCell2, { textAlign: 'center' }]}>{(item as any).snf || '-'}</Text>
                            <Text style={[s.entryCellText, s.entryCell2, { textAlign: 'center' }]}>{item.rate}</Text>
                            <Text style={[s.entryCellText, s.entryCell3, { color: colors.primary, fontWeight: '700', textAlign: 'center' }]}>₹{item.amount.toFixed(0)}</Text>
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
                        <Text style={[s.tHeadText, { flex: 0.6, color: '#fff', textAlign: 'center' }]}>Status</Text>
                        <View style={{ flex: 0.6 }} />
                    </View>
                    {customers.map((item, index) => {
                        const isInactive = item.isActive === false;
                        return (
                            <View key={item._id} style={[
                                s.entryRow,
                                index % 2 !== 0 && { backgroundColor: isDark ? colors.muted + '30' : '#f8fafc' },
                                isInactive && { opacity: 0.45 }
                            ]}>
                                <Text style={[s.entryCellText, { flex: 0.5, color: isInactive ? colors.mutedForeground : colors.primary, fontWeight: '700', textAlign: 'center' }]}>{item.code}</Text>
                                <Text style={[s.entryCellText, { flex: 1.2, textAlign: 'center', color: isInactive ? colors.mutedForeground : colors.foreground }]} numberOfLines={1}>{item.name}</Text>
                                <Text style={[s.entryCellText, { flex: 0.8, textAlign: 'center', fontSize: 10, color: isInactive ? colors.mutedForeground : colors.foreground }]}>{item.priceBasis || '-'}</Text>
                                <View style={{ flex: 0.6, alignItems: 'center' }}>
                                    <View style={[s.statusBadge, { backgroundColor: isInactive ? colors.destructive + '20' : colors.primary + '20' }]}>
                                        <Text style={[s.statusBadgeText, { color: isInactive ? colors.destructive : colors.primary }]}>
                                            {isInactive ? 'Off' : 'On'}
                                        </Text>
                                    </View>
                                </View>
                                <View style={{ flex: 0.6, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                                    <Pressable style={s.miniIconBtn} onPress={() => handleEditCustomer(item)}>
                                        <Edit2 size={12} color={colors.primary} />
                                    </Pressable>
                                    {!isInactive && (
                                        <Pressable style={s.miniIconBtn} onPress={() => handleDeleteCustomer(item._id)}>
                                            <Trash2 size={12} color={colors.destructive} />
                                        </Pressable>
                                    )}
                                </View>
                            </View>
                        );
                    })}
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
                {activeTab === 'C-Farmer' && renderFarmerTab()}
            </ScrollView>

            {activeTab === 'Purchase' && renderSaleEntriesTable()}


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
                onSuccess={() => {
                    if (activeTab === 'C-Farmer') {
                        fetchCustomersWithInactive();
                    } else {
                        fetchCustomers();
                    }
                }}
                editingFarmer={editingCustomer}
                colors={colors}
                isDark={isDark}
            />

            {/* Print Type Selection Modal */}
            <Modal visible={showPrintTypeModal} transparent animationType="fade" onRequestClose={() => setShowPrintTypeModal(false)}>
                <View style={s.modalOverlay}>
                    <Pressable style={{ flex: 1 }} onPress={() => setShowPrintTypeModal(false)} />
                    <View style={[s.modalSheet, { paddingBottom: 30 }]}>
                        <View style={s.modalHandle} />
                        <View style={s.modalHeader}>
                            <Text style={s.modalTitle}>Select Print Type</Text>
                            <Pressable onPress={() => setShowPrintTypeModal(false)}><X size={18} color={colors.foreground} /></Pressable>
                        </View>
                        <View style={{ paddingHorizontal: 16, gap: 10, marginTop: 8 }}>
                            <Pressable
                                style={[s.exportReportBtn, { backgroundColor: colors.primary }]}
                                onPress={handleFullSummaryPrint}
                            >
                                <Printer size={18} color="#fff" />
                                <Text style={s.exportReportBtnText}>Full Summary</Text>
                            </Pressable>
                            <Pressable
                                style={[s.exportReportBtn, { backgroundColor: '#f59e0b' }]}
                                onPress={handleShortSummaryPrint}
                            >
                                <Printer size={18} color="#fff" />
                                <Text style={s.exportReportBtnText}>Short Summary</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>

            <SuccessModal isVisible={alertVisible} title={alertTitle} message={alertMessage} onClose={() => setAlertVisible(false)} autoClose={alertTitle === 'Success'} />
            <ConfirmationModal visible={confirmVisible} title={confirmData.title} message={confirmData.message} onConfirm={confirmData.onConfirm} onClose={() => setConfirmVisible(false)} />
        </View>
    );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: 10, gap: 10, paddingBottom: 150, paddingTop: 10 },

    // Top controls
    topControls: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 6 },
    dateBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 10 },
    dateText: { fontSize: 12, fontWeight: '600', color: colors.foreground },
    addCustTopBtn: { width: 36, height: 36, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },

    // Shift
    shiftRow: { flexDirection: 'row', borderWidth: 1, borderColor: colors.border, overflow: 'hidden', flex: 1, borderRadius: 10 },
    shiftBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, paddingVertical: 8, backgroundColor: colors.card },
    shiftBtnActive: { backgroundColor: colors.primary },
    shiftBtnText: { fontSize: 11, fontWeight: '700', color: colors.foreground },
    shiftBtnTextActive: { color: '#fff' },

    // Summary
    summaryBar: { flexDirection: 'row', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, paddingVertical: 8, borderRadius: 10, marginTop: 6, },
    summaryCell: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
    summaryVal: { fontSize: 14, fontWeight: '800', color: colors.foreground },
    summaryLbl: { fontSize: 9, color: colors.mutedForeground, fontWeight: '500' },
    summaryDivider: { width: 1, backgroundColor: colors.border, marginVertical: 2 },

    // Inline farmer search
    inlineSearchContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderWidth: 1.5,
        borderColor: colors.primary,
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: 10,
        backgroundColor: colors.card,
    },
    inlineSearchInput: {
        flex: 1,
        fontSize: 14,
        fontWeight: '700',
        color: colors.foreground,
        padding: 0,
    },
    selectedFarmerBox: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderWidth: 1.5,
        borderColor: colors.primary,
        paddingHorizontal: 8,
        paddingVertical: 6,
        borderRadius: 10,
        backgroundColor: colors.primary + '08',
    },
    selectedFarmerBadge: {
        width: 32,
        height: 32,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 8,
    },
    selectedFarmerBadgeText: { fontSize: 11, fontWeight: '800', color: '#fff' },
    selectedFarmerName: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.foreground },
    inlineDropdown: {
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 10,
        marginTop: 0,
        overflow: 'hidden',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
    },
    inlineDropdownItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderBottomWidth: 0.5,
        borderBottomColor: colors.border,
    },
    inlineDropdownBadge: {
        width: 28,
        height: 28,
        backgroundColor: colors.primary + '18',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 7,
        borderWidth: 1,
        borderColor: colors.primary + '30',
    },
    inlineDropdownBadgeText: { fontSize: 10, fontWeight: '800', color: colors.primary },
    inlineDropdownName: { fontSize: 13, fontWeight: '600', color: colors.foreground },
    inlineDropdownSub: { fontSize: 10, color: colors.mutedForeground },

    // Code row (Enter code + Cow/Buffalo)
    codeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
    codeInputBox: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderWidth: 1.5,
        borderColor: colors.border,
        paddingHorizontal: 10,
        paddingVertical: 10,
        borderRadius: 10,
        backgroundColor: colors.card,
    },
    codeInputText: { fontSize: 14, fontWeight: '700', color: colors.foreground },
    milkToggleBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderWidth: 1.5,
        borderColor: colors.border,
        borderRadius: 10,
        backgroundColor: colors.card,
    },
    milkToggleBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    milkToggleBtnText: { fontSize: 12, fontWeight: '800', color: colors.foreground },

    // Entry card
    entryCard: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, padding: 12, borderRadius: 12 },
    priceBasisLabel: { fontSize: 14, fontWeight: '700', color: colors.foreground, marginBottom: 8 },
    milkRow: { flexDirection: 'row', gap: 4, marginBottom: 6 },
    milkBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 7, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, borderRadius: 8 },
    milkBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    milkBtnText: { fontSize: 12, fontWeight: '700', color: colors.foreground },

    fieldsRow: { flexDirection: 'row', gap: 8 },
    fieldBox: { flex: 1 },
    fieldLabel: { fontSize: 10, fontWeight: '700', color: colors.mutedForeground, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center' },
    fieldInput: { borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: 8, paddingVertical: 10, fontSize: 18, fontWeight: '800', color: colors.foreground, backgroundColor: colors.background, textAlign: 'center', borderRadius: 10 },

    computedRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 10, paddingVertical: 6 },
    computedText: { fontSize: 16, fontWeight: '600', color: colors.mutedForeground },
    computedValue: { fontSize: 18, fontWeight: '800', color: colors.foreground },

    actionsRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
    zeroToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderWidth: 1.5,
        borderColor: colors.destructive,
        backgroundColor: 'transparent',
        borderRadius: 10,
    },
    zeroText: { fontSize: 13, fontWeight: '800', color: colors.destructive },
    saveEntryBtn: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        backgroundColor: colors.primary,
        borderRadius: 10,
    },
    saveEntryText: { fontSize: 16, fontWeight: '900', color: '#fff' },

    // Table
    tableBottomWrap: { paddingHorizontal: 10, paddingBottom: 8, paddingTop: 2 },
    tableWrap: { borderWidth: 1, borderColor: colors.border, overflow: 'hidden', borderRadius: 12 },
    tableBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
    tableBarTitle: { fontSize: 12, fontWeight: '700', color: colors.foreground },
    badge: { backgroundColor: colors.primary, paddingHorizontal: 5, paddingVertical: 0, borderRadius: 4 },
    badgeText: { fontSize: 9, fontWeight: '800', color: '#fff' },
    pdfBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.primary, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    pdfBtnText: { fontSize: 10, fontWeight: '700', color: '#fff' },

    tHead: { flexDirection: 'row', backgroundColor: isDark ? colors.muted : '#eef2f7', paddingVertical: 6, paddingHorizontal: 8, alignItems: 'center' },
    tHeadText: { fontSize: 9, fontWeight: '700', color: colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 0.3, textAlign: 'center' },

    entryRow: { flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 8, alignItems: 'center', borderBottomWidth: 0.5, borderBottomColor: colors.border },
    entryCell1: { flex: 1.1, alignItems: 'center', justifyContent: 'center' },
    entryCell2: { flex: 0.8, alignItems: 'center', justifyContent: 'center' },
    entryCell3: { flex: 0.6, alignItems: 'center', justifyContent: 'center' },
    entryCellFlex: { flex: 0.6, alignItems: 'center', justifyContent: 'center' },
    entryCellAmt: { flex: 0.8, alignItems: 'center', justifyContent: 'center' },
    entryCellText: { fontSize: 10, color: colors.foreground },
    entrySubText: { fontSize: 8, color: colors.mutedForeground },

    tFootRow: { flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 8, alignItems: 'center', backgroundColor: isDark ? colors.secondary : '#ecfdf5', borderTopWidth: 1, borderTopColor: colors.primary + '30' },
    tFootText: { fontSize: 11, fontWeight: '800', color: colors.foreground, textAlign: 'center' },

    deleteBtn: { width: 26, alignItems: 'center' },

    // Empty
    emptyBox: { paddingVertical: 20, alignItems: 'center', gap: 4 },
    emptyText: { fontSize: 11, color: colors.mutedForeground },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalSheet: { backgroundColor: colors.background, borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: 16 },
    modalHandle: { width: 32, height: 3, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginTop: 8 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 10 },
    modalTitle: { fontSize: 15, fontWeight: '700', color: colors.foreground },

    // Search
    searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background, paddingHorizontal: 10, marginHorizontal: 8, marginBottom: 6, gap: 6, borderWidth: 1, borderColor: colors.border, borderRadius: 10 },
    searchInput: { flex: 1, paddingVertical: 8, fontSize: 14, color: colors.foreground },

    // Customer list
    custListItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: colors.border },
    custListAvatar: { width: 30, height: 30, backgroundColor: colors.primary + '18', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.primary + '30', borderRadius: 8 },
    custListAvatarText: { fontSize: 11, fontWeight: '800', color: colors.primary },
    custListName: { fontSize: 12, fontWeight: '600', color: colors.foreground },
    custListSub: { fontSize: 10, color: colors.mutedForeground },

    miniIconBtn: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center', borderRadius: 6 },
    addCustBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.primary, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },

    // Report tab
    sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.foreground, marginBottom: 8 },
    reportFarmerPicker: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 8,
    },
    reportFarmerText: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.foreground },
    dateRangeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
    dateInputWrapper: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 8 },
    dateInputText: { flex: 1, fontSize: 12, color: colors.foreground },
    dateSeparator: { fontSize: 14, color: colors.mutedForeground, fontWeight: '600' },
    reportSummaryCard: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, marginBottom: 8 },
    reportSummaryRow: { flexDirection: 'row', alignItems: 'center' },
    reportSummaryItem: { flex: 1, alignItems: 'center' },
    reportSummaryLabel: { fontSize: 10, color: colors.mutedForeground, fontWeight: '500' },
    reportSummaryValue: { fontSize: 15, fontWeight: '800', color: colors.foreground, marginTop: 2 },
    reportSummaryDivider: { width: 1, height: 30, backgroundColor: colors.border },
    exportReportBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.primary, paddingVertical: 12, borderRadius: 10, marginBottom: 8 },
    exportReportBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },

    // Farmer tab
    farmerTopRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
    farmerSearchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 10, gap: 6 },
    farmerSearchInput: { flex: 1, paddingVertical: 8, fontSize: 14, color: colors.foreground },
    farmerActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.primary, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10 },
    farmerSectionTitle: { fontSize: 16, fontWeight: '700', color: colors.foreground },
    farmerSubtitle: { fontSize: 11, marginBottom: 8 },

    // Status badge for farmer tab
    statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    statusBadgeText: { fontSize: 9, fontWeight: '700' },
});
