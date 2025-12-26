import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, RefreshControl, Modal, ActivityIndicator } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { X, FileText, Calendar as CalendarIcon, Printer, Plus, Edit2, Trash2, Code, UserPlus, Phone, MapPin, Search, User, Milk } from 'lucide-react-native';
import TopBar from '@/components/TopBar';
import { milkCollectionsApi, purchaseFarmersApi, MilkCollection, PurchaseFarmer } from '@/lib/milkeyApi';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { SuccessModal } from '@/components/SuccessModal';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { Calendar } from '@/components/Calendar';
import { useDebounce } from '@/hooks/useDebounce';

interface CustomRange {
    id: string;
    label: string;
    startDay: number;
    endDay: number;
}

export default function PurchaseScreen() {
    const { colors, isDark } = useTheme();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [purchaseFarmers, setPurchaseFarmers] = useState<PurchaseFarmer[]>([]);
    const [farmerSearchQuery, setFarmerSearchQuery] = useState('');

    const [entryDate, setEntryDate] = useState<Date | null>(new Date());
    const [entryShift, setEntryShift] = useState<'morning' | 'evening'>('morning');
    const [entryFarmerCode, setEntryFarmerCode] = useState('');
    const [entryFarmerName, setEntryFarmerName] = useState('');
    const [entryFarmerId, setEntryFarmerId] = useState<string | null>(null);
    const [entryFat, setEntryFat] = useState('');
    const [entrySnf, setEntrySnf] = useState('');
    const [entryQty, setEntryQty] = useState('');
    const [entryRate, setEntryRate] = useState('');
    const [showEntryDateModal, setShowEntryDateModal] = useState(false);

    // Initialize with null to show all data by default
    const [historyFromDate, setHistoryFromDate] = useState<Date | null>(null);
    const [historyToDate, setHistoryToDate] = useState<Date | null>(null);
    const [historyCollections, setHistoryCollections] = useState<MilkCollection[]>([]);
    const [historyTotals, setHistoryTotals] = useState({ quantity: 0, amount: 0 });
    const [selectedRanges, setSelectedRanges] = useState<string[]>([]);
    const [showHistoryDateModal, setShowHistoryDateModal] = useState(false);
    const [historyDateType, setHistoryDateType] = useState<'from' | 'to'>('from');
    const [tempCalendarDate, setTempCalendarDate] = useState<Date | null>(null);
    const [historyFilterCode, setHistoryFilterCode] = useState('');
    const debouncedFilterCode = useDebounce(historyFilterCode, 500);

    const [customRanges, setCustomRanges] = useState<CustomRange[]>([
        { id: '1-10', label: '1-10', startDay: 1, endDay: 10 },
        { id: '11-20', label: '11-20', startDay: 11, endDay: 20 },
        { id: '21-31', label: '21-31', startDay: 21, endDay: 31 },
    ]);
    const [showCreateRangeModal, setShowCreateRangeModal] = useState(false);
    const [newRangeStart, setNewRangeStart] = useState('');
    const [newRangeEnd, setNewRangeEnd] = useState('');

    const [showCodeModal, setShowCodeModal] = useState(false);
    const [codeModalTab, setCodeModalTab] = useState<'list' | 'create'>('list');
    const [savingFarmer, setSavingFarmer] = useState(false);
    const [newFarmerCode, setNewFarmerCode] = useState('');
    const [newFarmerName, setNewFarmerName] = useState('');
    const [newFarmerMobile, setNewFarmerMobile] = useState('');
    const [newFarmerAddress, setNewFarmerAddress] = useState('');
    const [editingFarmer, setEditingFarmer] = useState<PurchaseFarmer | null>(null);

    const [alertVisible, setAlertVisible] = useState(false);
    const [alertTitle, setAlertTitle] = useState('');
    const [alertMessage, setAlertMessage] = useState('');
    const [confirmVisible, setConfirmVisible] = useState(false);
    const [confirmData, setConfirmData] = useState<{ title: string; message: string; onConfirm: () => void }>({ title: '', message: '', onConfirm: () => { } });

    const styles = createStyles(colors, isDark);

    const showAlert = (title: string, message: string) => { setAlertTitle(title); setAlertMessage(message); setAlertVisible(true); };
    const showConfirm = (title: string, message: string, onConfirm: () => void) => { setConfirmData({ title, message, onConfirm }); setConfirmVisible(true); };

    useEffect(() => { fetchData(); }, []);

    // Auto-fetch history on mount and when dates or filter code changes
    useEffect(() => {
        handleFetchHistory();
    }, [historyFromDate, historyToDate, debouncedFilterCode]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const farmersRes = await purchaseFarmersApi.getAll().catch(() => null);
            if (farmersRes?.success) setPurchaseFarmers(farmersRes.response?.data || []);
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    const onRefresh = useCallback(async () => { setRefreshing(true); await fetchData(); setRefreshing(false); }, []);

    const clearFarmerForm = () => { setNewFarmerCode(''); setNewFarmerName(''); setNewFarmerMobile(''); setNewFarmerAddress(''); setEditingFarmer(null); };

    const handleCreateFarmer = async () => {
        if (!newFarmerCode.trim() || !newFarmerName.trim() || !newFarmerMobile.trim()) { showAlert('Error', 'Please fill code, name and mobile'); return; }
        setSavingFarmer(true);
        try {
            const res = await purchaseFarmersApi.create({ code: newFarmerCode.trim().toUpperCase(), name: newFarmerName.trim(), mobile: newFarmerMobile.trim(), address: newFarmerAddress.trim() });
            if (res.success) { showAlert('Success', 'Farmer created'); clearFarmerForm(); setCodeModalTab('list'); await fetchData(); }
            else { showAlert('Error', res.message || 'Failed'); }
        } catch (error) { showAlert('Error', 'Failed to create farmer'); }
        setSavingFarmer(false);
    };

    const handleUpdateFarmer = async () => {
        if (!editingFarmer || !newFarmerName.trim() || !newFarmerMobile.trim()) { showAlert('Error', 'Please fill name and mobile'); return; }
        setSavingFarmer(true);
        try {
            const res = await purchaseFarmersApi.update(editingFarmer._id, { name: newFarmerName.trim(), mobile: newFarmerMobile.trim(), address: newFarmerAddress.trim() });
            if (res.success) { showAlert('Success', 'Farmer updated'); clearFarmerForm(); setCodeModalTab('list'); await fetchData(); }
            else { showAlert('Error', res.message || 'Failed'); }
        } catch (error) { showAlert('Error', 'Failed to update farmer'); }
        setSavingFarmer(false);
    };

    const handleEditFarmer = (farmer: PurchaseFarmer) => { setEditingFarmer(farmer); setNewFarmerCode(farmer.code); setNewFarmerName(farmer.name); setNewFarmerMobile(farmer.mobile); setNewFarmerAddress(farmer.address || ''); setCodeModalTab('create'); };

    const handleDeleteFarmer = (farmerId: string) => {
        showConfirm('Delete Farmer', 'Are you sure?', async () => {
            setConfirmVisible(false);
            try { const res = await purchaseFarmersApi.delete(farmerId); if (res.success) { showAlert('Success', 'Farmer deleted'); await fetchData(); } else { showAlert('Error', res.message || 'Failed'); } } catch (error) { showAlert('Error', 'Failed'); }
        });
    };

    const handleSelectFarmer = (farmer: PurchaseFarmer) => {
        setEntryFarmerCode(farmer.code);
        setEntryFarmerName(farmer.name);
        setEntryFarmerId(farmer._id);
        setShowCodeModal(false);
    };

    const filteredFarmers = purchaseFarmers.filter(f =>
        f.code.toLowerCase().includes(farmerSearchQuery.toLowerCase()) ||
        f.name.toLowerCase().includes(farmerSearchQuery.toLowerCase()) ||
        f.mobile.includes(farmerSearchQuery)
    );

    const totalAmount = (parseFloat(entryQty || '0') * parseFloat(entryRate || '0')).toFixed(2);
    const formatDisplayDate = (date: Date | null) => { if (!date) return 'All'; return `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`; };
    const formatApiDate = (date: Date | null) => { if (!date) return ''; return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; };

    const handleFarmerCodeChange = (code: string) => {
        setEntryFarmerCode(code);
        const farmer = purchaseFarmers.find(f => f.code.toUpperCase() === code.trim().toUpperCase());
        setEntryFarmerName(farmer?.name || '');
        setEntryFarmerId(farmer?._id || null);
    };
    const handleClearEntry = () => {
        setEntryDate(new Date());
        setEntryFarmerCode('');
        setEntryFarmerName('');
        setEntryFarmerId(null);
        setEntryFat('');
        setEntrySnf('');
        setEntryQty('');
        setEntryRate('');
        setEntryShift('morning');
    };

    const handleUpdateEntry = async () => {
        if (saving) return;
        if (!entryFarmerCode) { showAlert('Error', 'Please enter farmer code'); return; }
        if (!entryQty || !entryRate) { showAlert('Error', 'Please enter quantity and rate'); return; }
        setSaving(true);
        try {
            const res = await milkCollectionsApi.create({
                farmerCode: entryFarmerCode.trim().toUpperCase(),
                purchaseFarmerId: entryFarmerId || undefined,
                quantity: parseFloat(entryQty),
                rate: parseFloat(entryRate),
                date: entryDate ? formatApiDate(entryDate) : undefined,
                shift: entryShift,
                fat: entryFat ? parseFloat(entryFat) : undefined,
                snf: entrySnf ? parseFloat(entrySnf) : undefined
            });
            if (res.success) {
                showAlert('Success', 'Milk collection recorded');
                handleClearEntry();
                // Clear all filters and refresh history to show all data including new entry
                setSelectedRanges([]);
                setHistoryFilterCode('');
                setHistoryFromDate(null);
                setHistoryToDate(null);
                // Force refresh history after a short delay to ensure state is updated
                setTimeout(async () => {
                    try {
                        const historyRes = await milkCollectionsApi.getAll({ limit: 100 });
                        if (historyRes.success) {
                            setHistoryCollections(historyRes.response?.data || []);
                            setHistoryTotals(historyRes.response?.totals || { quantity: 0, amount: 0 });
                        }
                    } catch (e) { console.error('Failed to refresh history:', e); }
                }, 300);
            } else { showAlert('Error', res.message || 'Failed'); }
        } catch (error) { showAlert('Error', 'Failed to save entry'); }
        setSaving(false);
    };

    const handleToggleRange = (rangeId: string) => {
        const range = customRanges.find(r => r.id === rangeId);
        if (range) {
            const now = new Date();
            const year = now.getFullYear();
            const month = now.getMonth();
            const daysInMonth = new Date(year, month + 1, 0).getDate();

            const startDate = new Date(year, month, range.startDay);
            const endDate = new Date(year, month, Math.min(range.endDay, daysInMonth));

            setHistoryFromDate(startDate);
            setHistoryToDate(endDate);
            setSelectedRanges([rangeId]);
        }
    };
    const handleClearRanges = () => { setSelectedRanges([]); setHistoryFromDate(null); setHistoryToDate(null); setHistoryFilterCode(''); };

    const handleCreateRange = () => {
        const start = parseInt(newRangeStart), end = parseInt(newRangeEnd);
        if (isNaN(start) || isNaN(end) || start < 1 || end > 31 || start > end) { showAlert('Error', 'Please enter valid day range (1-31)'); return; }
        const newRange: CustomRange = { id: `${start}-${end}`, label: `${start}-${end}`, startDay: start, endDay: end };
        if (customRanges.some(r => r.id === newRange.id)) { showAlert('Error', 'This range already exists'); return; }
        setCustomRanges([...customRanges, newRange]); setNewRangeStart(''); setNewRangeEnd(''); setShowCreateRangeModal(false);
    };

    const handleDeleteRange = (rangeId: string) => { setCustomRanges(customRanges.filter(r => r.id !== rangeId)); setSelectedRanges(selectedRanges.filter(r => r !== rangeId)); };

    const handleFetchHistory = async () => {
        setLoading(true);
        try {
            let startDate = formatApiDate(historyFromDate), endDate = formatApiDate(historyToDate);
            if (selectedRanges.length > 0 && !historyFromDate && !historyToDate) {
                const now = new Date(), year = now.getFullYear(), month = now.getMonth();
                let minDay = 31, maxDay = 1;
                selectedRanges.forEach(rangeId => { const range = customRanges.find(r => r.id === rangeId); if (range) { if (range.startDay < minDay) minDay = range.startDay; if (range.endDay > maxDay) maxDay = range.endDay; } });
                const daysInMonth = new Date(year, month + 1, 0).getDate();
                startDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(minDay).padStart(2, '0')}`;
                endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(Math.min(maxDay, daysInMonth)).padStart(2, '0')}`;
            }
            const res = await milkCollectionsApi.getAll({ startDate: startDate || undefined, endDate: endDate || undefined, farmerCode: debouncedFilterCode.trim().toUpperCase() || undefined, limit: 100 });
            if (res.success) { setHistoryCollections(res.response?.data || []); setHistoryTotals(res.response?.totals || { quantity: 0, amount: 0 }); }
        } catch (error) { showAlert('Error', 'Failed to fetch history'); }
        setLoading(false);
    };

    const generateHistoryPdfHtml = () => {
        if (historyCollections.length === 0) return '';
        const dateRange = historyFromDate && historyToDate
            ? `${formatDisplayDate(historyFromDate)} to ${formatDisplayDate(historyToDate)}`
            : 'All Records';
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; padding: 15px; font-size: 11px; color: #333; }
        .container { max-width: 500px; margin: 0 auto; }
        .header { text-align: center; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 2px solid #22c55e; }
        .header h1 { color: #22c55e; font-size: 18px; font-weight: 700; margin-bottom: 4px; }
        .header p { color: #666; font-size: 10px; }
        .date-range { background: #f0fdf4; padding: 6px 10px; border-radius: 4px; text-align: center; margin-bottom: 10px; font-size: 10px; color: #166534; }
        table { width: 100%; border-collapse: collapse; font-size: 10px; }
        th { background: #22c55e; color: white; padding: 6px 4px; text-align: center; font-weight: 600; font-size: 9px; }
        td { padding: 5px 4px; text-align: center; border-bottom: 1px solid #e5e7eb; }
        tr:nth-child(even) { background: #f9fafb; }
        tr:hover { background: #f0fdf4; }
        .summary { margin-top: 12px; background: linear-gradient(135deg, #22c55e, #16a34a); padding: 10px 12px; border-radius: 6px; color: white; }
        .summary-row { display: flex; justify-content: space-between; align-items: center; }
        .summary-item { text-align: center; }
        .summary-label { font-size: 9px; opacity: 0.9; margin-bottom: 2px; }
        .summary-value { font-size: 14px; font-weight: 700; }
        .footer { text-align: center; margin-top: 12px; font-size: 8px; color: #999; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🥛 Purchase History</h1>
            <p>Generated on ${new Date().toLocaleDateString()}</p>
        </div>
        <div class="date-range">📅 ${dateRange}</div>
        <table>
            <thead>
                <tr><th>Date</th><th>Shift</th><th>FAT</th><th>SNF</th><th>Qty(L)</th><th>Rate</th><th>Amount</th></tr>
            </thead>
            <tbody>
                ${historyCollections.map(c => `
                <tr>
                    <td>${new Date(c.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</td>
                    <td>${c.shift === 'morning' ? '🌅 AM' : '🌙 PM'}</td>
                    <td>${c.fat || '-'}</td>
                    <td>${c.snf || '-'}</td>
                    <td>${c.quantity}</td>
                    <td>₹${c.rate}</td>
                    <td><strong>₹${c.amount.toFixed(2)}</strong></td>
                </tr>`).join('')}
            </tbody>
        </table>
        <div class="summary">
            <div class="summary-row">
                <div class="summary-item">
                    <div class="summary-label">Total Entries</div>
                    <div class="summary-value">${historyCollections.length}</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Total Quantity</div>
                    <div class="summary-value">${historyTotals.quantity.toFixed(2)} L</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Total Amount</div>
                    <div class="summary-value">₹${historyTotals.amount.toFixed(2)}</div>
                </div>
            </div>
        </div>
        <div class="footer">Milk Purchase Report • Auto-generated</div>
    </div>
</body>
</html>`;
    };

    const handleHistoryPdf = async () => { const html = generateHistoryPdfHtml(); if (!html) { showAlert('Error', 'No data'); return; } try { const { uri } = await Print.printToFileAsync({ html }); if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri); else showAlert('Info', 'PDF saved to: ' + uri); } catch (e) { showAlert('Error', 'Failed'); } };
    const handleHistoryPrint = async () => { const html = generateHistoryPdfHtml(); if (!html) { showAlert('Error', 'No data'); return; } try { await Print.printAsync({ html }); } catch (e) { showAlert('Error', 'Failed'); } };

    return (
        <View style={styles.container}>
            <TopBar />
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}>
                <View style={styles.card}>
                    <View style={styles.cardHeader}><Text style={styles.cardTitle}>Milk Purchase Entry</Text><Pressable style={styles.codeBtn} onPress={() => { setShowCodeModal(true); setCodeModalTab('list'); }}><Code size={16} color="#fff" /><Text style={styles.codeBtnText}>Code</Text></Pressable></View>
                    <View style={styles.row}><View style={[styles.fieldHalf, { flex: 0.4 }]}><Text style={styles.fieldLabel}>Code *</Text><TextInput style={styles.textInput} value={entryFarmerCode} onChangeText={handleFarmerCodeChange} placeholder="Code" placeholderTextColor={colors.mutedForeground} /></View><View style={[styles.fieldHalf, { flex: 1 }]}><Text style={styles.fieldLabel}>Name</Text><TextInput style={[styles.textInput, { backgroundColor: colors.muted }]} value={entryFarmerName} editable={false} placeholder="Auto-filled" placeholderTextColor={colors.mutedForeground} /></View></View>
                    <View style={styles.row}><View style={styles.fieldHalf}><Text style={styles.fieldLabel}>Date</Text><Pressable style={styles.dateInput} onPress={() => { setTempCalendarDate(entryDate || new Date()); setShowEntryDateModal(true); }}><Text style={styles.dateInputText}>{formatDisplayDate(entryDate)}</Text><CalendarIcon size={16} color={colors.mutedForeground} /></Pressable></View><View style={styles.fieldHalf}><Text style={styles.fieldLabel}>Session</Text><View style={styles.sessionRow}><Pressable style={[styles.sessionBtn, entryShift === 'morning' && styles.sessionBtnActive]} onPress={() => setEntryShift('morning')}><Text style={[styles.sessionBtnText, entryShift === 'morning' && styles.sessionBtnTextActive]}>Morning</Text></Pressable><Pressable style={[styles.sessionBtn, entryShift === 'evening' && styles.sessionBtnActiveEvening]} onPress={() => setEntryShift('evening')}><Text style={[styles.sessionBtnText, entryShift === 'evening' && styles.sessionBtnTextActive]}>Evening</Text></Pressable></View></View></View>
                    <View style={styles.row}><View style={styles.fieldHalf}><Text style={styles.fieldLabel}>FAT</Text><TextInput style={styles.textInput} value={entryFat} onChangeText={setEntryFat} keyboardType="decimal-pad" placeholder="5" placeholderTextColor={colors.mutedForeground} /></View><View style={styles.fieldHalf}><Text style={styles.fieldLabel}>SNF</Text><TextInput style={styles.textInput} value={entrySnf} onChangeText={setEntrySnf} keyboardType="decimal-pad" placeholder="6" placeholderTextColor={colors.mutedForeground} /></View></View>
                    <View style={styles.row}><View style={styles.fieldHalf}><Text style={styles.fieldLabel}>Total Qty (L)</Text><TextInput style={styles.textInput} value={entryQty} onChangeText={setEntryQty} keyboardType="decimal-pad" placeholder="300" placeholderTextColor={colors.mutedForeground} /></View><View style={styles.fieldHalf}><Text style={styles.fieldLabel}>Avg Rate (₹/L)</Text><TextInput style={styles.textInput} value={entryRate} onChangeText={setEntryRate} keyboardType="decimal-pad" placeholder="50" placeholderTextColor={colors.mutedForeground} /></View></View>
                    <View style={styles.totalRow}><View style={styles.totalSection}><Text style={styles.totalLabel}>Total Amount (₹)</Text><Text style={styles.totalAmount}>{totalAmount}</Text></View><View style={styles.buttonGroup}><Pressable style={[styles.updateBtn, saving && styles.updateBtnDisabled]} onPress={handleUpdateEntry} disabled={saving}>{saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.updateBtnText}>Save</Text>}</Pressable><Pressable style={styles.clearBtn} onPress={handleClearEntry} disabled={saving}><Text style={styles.clearBtnText}>Clear</Text></Pressable></View></View>
                </View>

                <View style={styles.card}>
                    <View style={styles.historyHeader}><Text style={styles.cardTitle}>Purchase History</Text><View style={styles.historyButtons}><Pressable style={styles.pdfBtn} onPress={handleHistoryPdf}><FileText size={14} color="#fff" /><Text style={styles.pdfBtnText}>PDF</Text></Pressable><Pressable style={styles.printBtn} onPress={handleHistoryPrint}><Printer size={14} color="#fff" /><Text style={styles.printBtnText}>Print</Text></Pressable></View></View>
                    <View style={styles.filterCodeRow}><Text style={styles.fieldLabelSmall}>Filter by Code</Text><TextInput style={styles.filterCodeInput} value={historyFilterCode} onChangeText={setHistoryFilterCode} placeholder="Enter farmer code" placeholderTextColor={colors.mutedForeground} /></View>
                    <View style={styles.row}><View style={styles.fieldHalf}><Text style={styles.fieldLabelSmall}>From Date</Text><Pressable style={styles.dateInput} onPress={() => { setHistoryDateType('from'); setTempCalendarDate(historyFromDate || new Date()); setShowHistoryDateModal(true); }}><Text style={styles.dateInputText}>{formatDisplayDate(historyFromDate)}</Text><CalendarIcon size={16} color={colors.mutedForeground} /></Pressable></View><View style={styles.fieldHalf}><Text style={styles.fieldLabelSmall}>To Date</Text><Pressable style={styles.dateInput} onPress={() => { setHistoryDateType('to'); setTempCalendarDate(historyToDate || new Date()); setShowHistoryDateModal(true); }}><Text style={styles.dateInputText}>{formatDisplayDate(historyToDate)}</Text><CalendarIcon size={16} color={colors.mutedForeground} /></Pressable></View></View>
                    <View style={styles.quickRangesSection}><Text style={styles.quickRangesLabel}>Quick Ranges (long press to delete)</Text><View style={styles.quickRangesRow}>{customRanges.map(range => (<Pressable key={range.id} style={[styles.quickRangeChip, selectedRanges.includes(range.id) && styles.quickRangeChipActive]} onPress={() => handleToggleRange(range.id)} onLongPress={() => handleDeleteRange(range.id)}><Text style={[styles.quickRangeText, selectedRanges.includes(range.id) && styles.quickRangeTextActive]}>{range.label}</Text>{selectedRanges.includes(range.id) && <X size={12} color="#22c55e" />}</Pressable>))}</View><View style={styles.rangeActions}><Pressable onPress={handleClearRanges}><Text style={styles.clearRangesText}>✕ Clear</Text></Pressable><Pressable onPress={() => setShowCreateRangeModal(true)}><Text style={styles.makeRangeText}>+ Make Range</Text></Pressable></View></View>
                    {loading && <View style={styles.loadingRow}><ActivityIndicator size="small" color="#22c55e" /><Text style={styles.loadingText}>Loading...</Text></View>}
                    {/* Always show table with headers */}
                    <View style={styles.tableContainer}>
                        <View style={styles.tableHeader}>
                            <Text style={[styles.tableHeaderCell, styles.tableCellCode]}>Code</Text>
                            <Text style={[styles.tableHeaderCell, styles.tableCellDate]}>Date</Text>
                            <Text style={[styles.tableHeaderCell, styles.tableCellSession]}>Sess</Text>
                            <Text style={[styles.tableHeaderCell, styles.tableCellSmall]}>FAT</Text>
                            <Text style={[styles.tableHeaderCell, styles.tableCellSmall]}>SNF</Text>
                            <Text style={[styles.tableHeaderCell, styles.tableCellSmall]}>Qty</Text>
                            <Text style={[styles.tableHeaderCell, styles.tableCellSmall]}>Rate</Text>
                            <Text style={[styles.tableHeaderCell, styles.tableCellAmount]}>Amt</Text>
                        </View>
                        {historyCollections.length > 0 ? (
                            <>
                                {historyCollections.map((item, index) => (
                                    <View key={item._id} style={[styles.tableRow, index % 2 === 0 && styles.tableRowEven]}>
                                        <Text style={[styles.tableCell, styles.tableCellCode, { color: colors.primary, fontWeight: '600' }]}>{item.farmerCode || '-'}</Text>
                                        <Text style={[styles.tableCell, styles.tableCellDate]}>{new Date(item.date).toISOString().split('T')[0]}</Text>
                                        <Text style={[styles.tableCell, styles.tableCellSession, { color: item.shift === 'morning' ? '#f59e0b' : '#3b82f6' }]}>{item.shift}</Text>
                                        <Text style={[styles.tableCell, styles.tableCellSmall]}>{item.fat || '-'}</Text>
                                        <Text style={[styles.tableCell, styles.tableCellSmall]}>{item.snf || '-'}</Text>
                                        <Text style={[styles.tableCell, styles.tableCellSmall]}>{item.quantity}</Text>
                                        <Text style={[styles.tableCell, styles.tableCellSmall]}>{item.rate}</Text>
                                        <Text style={[styles.tableCell, styles.tableCellAmount, { color: colors.success }]}>₹{item.amount.toFixed(2)}</Text>
                                    </View>
                                ))}
                                <View style={[styles.tableRow, styles.totalRowTable]}>
                                    <Text style={[styles.tableCell, styles.tableCellCode, { fontWeight: '700' }]}>Total</Text>
                                    <Text style={[styles.tableCell, styles.tableCellDate]}></Text>
                                    <Text style={[styles.tableCell, styles.tableCellSession]}></Text>
                                    <Text style={[styles.tableCell, styles.tableCellSmall]}></Text>
                                    <Text style={[styles.tableCell, styles.tableCellSmall]}></Text>
                                    <Text style={[styles.tableCell, styles.tableCellSmall, { fontWeight: '700' }]}>{historyTotals.quantity.toFixed(1)}</Text>
                                    <Text style={[styles.tableCell, styles.tableCellSmall]}></Text>
                                    <Text style={[styles.tableCell, styles.tableCellAmount, { color: colors.success, fontWeight: '700' }]}>₹{historyTotals.amount.toFixed(2)}</Text>
                                </View>
                            </>
                        ) : (
                            <View style={styles.noDataRow}>
                                <Text style={styles.noDataText}>{loading ? 'Loading...' : 'No data available'}</Text>
                            </View>
                        )}
                    </View>
                </View>
            </ScrollView>

            {/* Entry Date Modal - Bottom Sheet Style */}
            <Modal visible={showEntryDateModal} animationType="slide" transparent onRequestClose={() => setShowEntryDateModal(false)}>
                <View style={styles.bottomSheetOverlay}>
                    <Pressable style={{ flex: 1 }} onPress={() => setShowEntryDateModal(false)} />
                    <View style={styles.dateModalContent}>
                        <View style={styles.dateModalHeader}>
                            <Text style={styles.dateModalTitle}>Select Entry Date</Text>
                            <Pressable onPress={() => setShowEntryDateModal(false)}>
                                <X size={20} color={colors.foreground} />
                            </Pressable>
                        </View>
                        <View style={styles.calendarBody}>
                            <Calendar
                                selectedDate={tempCalendarDate}
                                onDateSelect={(date) => {
                                    if (date) {
                                        setEntryDate(date);
                                        setShowEntryDateModal(false);
                                    }
                                }}
                            />
                        </View>
                    </View>
                </View>
            </Modal>

            <Modal visible={showHistoryDateModal} animationType="slide" transparent onRequestClose={() => setShowHistoryDateModal(false)}>
                <View style={styles.bottomSheetOverlay}>
                    <Pressable style={{ flex: 1 }} onPress={() => setShowHistoryDateModal(false)} />
                    <View style={styles.dateModalContent}>
                        <View style={styles.dateModalHeader}>
                            <Text style={styles.dateModalTitle}>{historyDateType === 'from' ? 'Select Start Date' : 'Select End Date'}</Text>
                            <Pressable onPress={() => setShowHistoryDateModal(false)}>
                                <X size={20} color={colors.foreground} />
                            </Pressable>
                        </View>
                        <View style={styles.calendarBody}>
                            <Calendar
                                selectedDate={tempCalendarDate}
                                onDateSelect={(date) => {
                                    if (date) {
                                        if (historyDateType === 'from') setHistoryFromDate(date);
                                        else setHistoryToDate(date);
                                        setShowHistoryDateModal(false);
                                    }
                                }}
                            />
                        </View>
                    </View>
                </View>
            </Modal>
            <Modal visible={showCreateRangeModal} animationType="slide" transparent onRequestClose={() => setShowCreateRangeModal(false)}><View style={styles.modalOverlay}><View style={styles.modalContent}><View style={styles.modalHeader}><Text style={styles.modalTitle}>Create Custom Range</Text><Pressable onPress={() => setShowCreateRangeModal(false)}><X size={20} color={colors.foreground} /></Pressable></View><View style={styles.rangeModalBody}><View style={styles.rangeInputRow}><View style={styles.rangeInputField}><Text style={styles.rangeInputLabel}>Start Day</Text><TextInput style={styles.rangeInput} value={newRangeStart} onChangeText={setNewRangeStart} keyboardType="number-pad" placeholder="1" placeholderTextColor={colors.mutedForeground} maxLength={2} /></View><Text style={styles.rangeDash}>—</Text><View style={styles.rangeInputField}><Text style={styles.rangeInputLabel}>End Day</Text><TextInput style={styles.rangeInput} value={newRangeEnd} onChangeText={setNewRangeEnd} keyboardType="number-pad" placeholder="10" placeholderTextColor={colors.mutedForeground} maxLength={2} /></View></View></View><View style={styles.modalFooter}><Pressable style={styles.cancelModalBtn} onPress={() => setShowCreateRangeModal(false)}><Text style={styles.cancelModalBtnText}>Cancel</Text></Pressable><Pressable style={styles.confirmModalBtn} onPress={handleCreateRange}><Text style={styles.confirmModalBtnText}>Create</Text></Pressable></View></View></View></Modal>
            {/* Improved Code Modal */}
            <Modal visible={showCodeModal} animationType="slide" transparent onRequestClose={() => setShowCodeModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.codeModalContent}>
                        {/* Header */}
                        <View style={styles.codeModalHeader}>
                            <View style={styles.codeModalHeaderLeft}>
                                <View style={styles.codeModalIcon}>
                                    <Milk size={20} color="#fff" />
                                </View>
                                <Text style={styles.codeModalTitle}>Purchase Farmers</Text>
                            </View>
                            <Pressable style={styles.codeModalCloseBtn} onPress={() => { setShowCodeModal(false); clearFarmerForm(); setFarmerSearchQuery(''); }}>
                                <X size={20} color={colors.foreground} />
                            </Pressable>
                        </View>

                        {/* Tabs */}
                        <View style={styles.codeModalTabs}>
                            <Pressable
                                style={[styles.codeModalTab, codeModalTab === 'list' && styles.codeModalTabActive]}
                                onPress={() => { setCodeModalTab('list'); clearFarmerForm(); }}
                            >
                                <User size={16} color={codeModalTab === 'list' ? '#fff' : colors.mutedForeground} />
                                <Text style={[styles.codeModalTabText, codeModalTab === 'list' && styles.codeModalTabTextActive]}>
                                    Select ({purchaseFarmers.length})
                                </Text>
                            </Pressable>
                            <Pressable
                                style={[styles.codeModalTab, codeModalTab === 'create' && styles.codeModalTabActive]}
                                onPress={() => setCodeModalTab('create')}
                            >
                                <UserPlus size={16} color={codeModalTab === 'create' ? '#fff' : colors.mutedForeground} />
                                <Text style={[styles.codeModalTabText, codeModalTab === 'create' && styles.codeModalTabTextActive]}>
                                    {editingFarmer ? 'Edit' : 'Add New'}
                                </Text>
                            </Pressable>
                        </View>

                        <ScrollView style={styles.codeModalBody} showsVerticalScrollIndicator={false}>
                            {codeModalTab === 'list' ? (
                                <View style={styles.farmerListContainer}>
                                    {/* Search Bar */}
                                    <View style={styles.farmerSearchContainer}>
                                        <Search size={18} color={colors.mutedForeground} />
                                        <TextInput
                                            style={styles.farmerSearchInput}
                                            value={farmerSearchQuery}
                                            onChangeText={setFarmerSearchQuery}
                                            placeholder="Search by code, name or mobile..."
                                            placeholderTextColor={colors.mutedForeground}
                                        />
                                        {farmerSearchQuery.length > 0 && (
                                            <Pressable onPress={() => setFarmerSearchQuery('')}>
                                                <X size={16} color={colors.mutedForeground} />
                                            </Pressable>
                                        )}
                                    </View>

                                    {filteredFarmers.length === 0 ? (
                                        <View style={styles.emptyFarmersContainer}>
                                            <View style={styles.emptyFarmersIcon}>
                                                <User size={32} color={colors.mutedForeground} />
                                            </View>
                                            <Text style={styles.emptyFarmersTitle}>
                                                {farmerSearchQuery ? 'No farmers found' : 'No farmers yet'}
                                            </Text>
                                            <Text style={styles.emptyFarmersSubtitle}>
                                                {farmerSearchQuery ? 'Try a different search term' : 'Add your first farmer to get started'}
                                            </Text>
                                            {!farmerSearchQuery && (
                                                <Pressable style={styles.emptyFarmersBtn} onPress={() => setCodeModalTab('create')}>
                                                    <Plus size={16} color="#fff" />
                                                    <Text style={styles.emptyFarmersBtnText}>Add Farmer</Text>
                                                </Pressable>
                                            )}
                                        </View>
                                    ) : (
                                        <View style={styles.farmerGridContainer}>
                                            {filteredFarmers.map((farmer) => (
                                                <Pressable
                                                    key={farmer._id}
                                                    style={styles.farmerCard}
                                                    onPress={() => handleSelectFarmer(farmer)}
                                                >
                                                    <View style={styles.farmerCardHeader}>
                                                        <View style={styles.farmerCodeBadge}>
                                                            <Text style={styles.farmerCodeBadgeText}>{farmer.code}</Text>
                                                        </View>
                                                        <View style={styles.farmerCardActions}>
                                                            <Pressable
                                                                style={styles.farmerCardEditBtn}
                                                                onPress={(e) => { e.stopPropagation(); handleEditFarmer(farmer); }}
                                                            >
                                                                <Edit2 size={14} color={colors.primary} />
                                                            </Pressable>
                                                            <Pressable
                                                                style={styles.farmerCardDeleteBtn}
                                                                onPress={(e) => { e.stopPropagation(); handleDeleteFarmer(farmer._id); }}
                                                            >
                                                                <Trash2 size={14} color="#ef4444" />
                                                            </Pressable>
                                                        </View>
                                                    </View>
                                                    <Text style={styles.farmerCardName} numberOfLines={1}>{farmer.name}</Text>
                                                    <View style={styles.farmerCardMobileRow}>
                                                        <Phone size={12} color={colors.mutedForeground} />
                                                        <Text style={styles.farmerCardMobile}>{farmer.mobile}</Text>
                                                    </View>
                                                    {farmer.totalQuantity > 0 && (
                                                        <View style={styles.farmerCardStats}>
                                                            <Text style={styles.farmerCardStatsText}>
                                                                {farmer.totalQuantity.toFixed(1)}L • ₹{farmer.totalAmount.toFixed(0)}
                                                            </Text>
                                                        </View>
                                                    )}
                                                </Pressable>
                                            ))}
                                        </View>
                                    )}
                                </View>
                            ) : (
                                <View style={styles.farmerFormContainer}>
                                    <View style={styles.farmerFormCard}>
                                        <View style={styles.farmerFormField}>
                                            <Text style={styles.farmerFormLabel}>
                                                <Text style={styles.farmerFormLabelRequired}>* </Text>
                                                Farmer Code
                                            </Text>
                                            <TextInput
                                                style={[styles.farmerFormInput, editingFarmer && styles.farmerFormInputDisabled]}
                                                value={newFarmerCode}
                                                onChangeText={setNewFarmerCode}
                                                placeholder="e.g. F001, A01"
                                                placeholderTextColor={colors.mutedForeground}
                                                editable={!editingFarmer}
                                                autoCapitalize="characters"
                                            />
                                        </View>
                                        <View style={styles.farmerFormField}>
                                            <Text style={styles.farmerFormLabel}>
                                                <Text style={styles.farmerFormLabelRequired}>* </Text>
                                                Full Name
                                            </Text>
                                            <TextInput
                                                style={styles.farmerFormInput}
                                                value={newFarmerName}
                                                onChangeText={setNewFarmerName}
                                                placeholder="Enter farmer name"
                                                placeholderTextColor={colors.mutedForeground}
                                            />
                                        </View>
                                        <View style={styles.farmerFormField}>
                                            <Text style={styles.farmerFormLabel}>
                                                <Text style={styles.farmerFormLabelRequired}>* </Text>
                                                Mobile Number
                                            </Text>
                                            <TextInput
                                                style={styles.farmerFormInput}
                                                value={newFarmerMobile}
                                                onChangeText={setNewFarmerMobile}
                                                placeholder="10-digit mobile number"
                                                placeholderTextColor={colors.mutedForeground}
                                                keyboardType="phone-pad"
                                                maxLength={10}
                                            />
                                        </View>
                                        <View style={styles.farmerFormField}>
                                            <Text style={styles.farmerFormLabel}>Address (Optional)</Text>
                                            <TextInput
                                                style={[styles.farmerFormInput, styles.farmerFormTextarea]}
                                                value={newFarmerAddress}
                                                onChangeText={setNewFarmerAddress}
                                                placeholder="Village, District..."
                                                placeholderTextColor={colors.mutedForeground}
                                                multiline
                                                numberOfLines={2}
                                            />
                                        </View>
                                    </View>

                                    <View style={styles.farmerFormActions}>
                                        {editingFarmer ? (
                                            <>
                                                <Pressable
                                                    style={[styles.farmerFormSaveBtn, savingFarmer && styles.farmerFormSaveBtnDisabled]}
                                                    onPress={handleUpdateFarmer}
                                                    disabled={savingFarmer}
                                                >
                                                    {savingFarmer ? (
                                                        <ActivityIndicator size="small" color="#fff" />
                                                    ) : (
                                                        <Text style={styles.farmerFormSaveBtnText}>Update Farmer</Text>
                                                    )}
                                                </Pressable>
                                                <Pressable style={styles.farmerFormCancelBtn} onPress={clearFarmerForm}>
                                                    <Text style={styles.farmerFormCancelBtnText}>Cancel</Text>
                                                </Pressable>
                                            </>
                                        ) : (
                                            <Pressable
                                                style={[styles.farmerFormSaveBtn, savingFarmer && styles.farmerFormSaveBtnDisabled]}
                                                onPress={handleCreateFarmer}
                                                disabled={savingFarmer}
                                            >
                                                {savingFarmer ? (
                                                    <ActivityIndicator size="small" color="#fff" />
                                                ) : (
                                                    <>
                                                        <Plus size={18} color="#fff" />
                                                        <Text style={styles.farmerFormSaveBtnText}>Create Farmer</Text>
                                                    </>
                                                )}
                                            </Pressable>
                                        )}
                                    </View>
                                </View>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
            <SuccessModal isVisible={alertVisible} title={alertTitle} message={alertMessage} onClose={() => setAlertVisible(false)} />
            <ConfirmationModal visible={confirmVisible} title={confirmData.title} message={confirmData.message} onConfirm={confirmData.onConfirm} onClose={() => setConfirmVisible(false)} />
        </View>
    );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scrollView: { flex: 1 },
    scrollContent: { paddingHorizontal: 6, paddingVertical: 12, gap: 12 },
    card: { backgroundColor: colors.card, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.border },
    cardTitle: { fontSize: 16, fontWeight: '700', color: colors.foreground },
    row: { flexDirection: 'row', gap: 8, marginBottom: 8 },
    fieldHalf: { flex: 1 },
    fieldLabel: { fontSize: 12, fontWeight: '500', color: colors.mutedForeground, marginBottom: 4 },
    fieldLabelSmall: { fontSize: 11, fontWeight: '500', color: colors.mutedForeground, marginBottom: 4 },
    dateInput: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.background, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10, borderWidth: 1, borderColor: colors.border },
    dateInputText: { fontSize: 14, color: colors.foreground },
    sessionRow: { flexDirection: 'row', gap: 6 },
    sessionBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
    sessionBtnActive: { backgroundColor: '#22c55e', borderColor: '#22c55e' },
    sessionBtnActiveEvening: { backgroundColor: '#6b7280', borderColor: '#6b7280' },
    sessionBtnText: { fontSize: 13, fontWeight: '600', color: colors.foreground },
    sessionBtnTextActive: { color: '#fff' },
    textInput: { backgroundColor: colors.background, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10, fontSize: 14, color: colors.foreground, borderWidth: 1, borderColor: colors.border },
    loadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12 },
    loadingText: { fontSize: 13, color: colors.mutedForeground },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 6 },
    totalSection: { flex: 1 },
    totalLabel: { fontSize: 12, color: colors.mutedForeground, marginBottom: 4 },
    totalAmount: { fontSize: 28, fontWeight: '700', color: '#22c55e' },
    buttonGroup: { flexDirection: 'row', gap: 6 },
    updateBtn: { backgroundColor: '#22c55e', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, minWidth: 80, alignItems: 'center' },
    updateBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
    updateBtnDisabled: { backgroundColor: '#86efac', opacity: 0.7 },
    clearBtn: { backgroundColor: colors.muted, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
    clearBtnText: { color: colors.foreground, fontSize: 14, fontWeight: '600' },
    historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    historyButtons: { flexDirection: 'row', gap: 6 },
    pdfBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#22c55e', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
    pdfBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
    printBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#3b82f6', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
    printBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
    filterCodeRow: { marginBottom: 8 },
    filterCodeInput: { backgroundColor: colors.background, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, color: colors.foreground, borderWidth: 1, borderColor: colors.border },
    quickRangesSection: { marginBottom: 8 },
    quickRangesLabel: { fontSize: 12, fontWeight: '500', color: colors.mutedForeground, marginBottom: 6 },
    quickRangesRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
    quickRangeChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.background },
    quickRangeChipActive: { backgroundColor: '#dcfce7' },
    quickRangeText: { fontSize: 13, fontWeight: '600', color: '#22c55e' },
    quickRangeTextActive: { color: '#22c55e' },
    rangeActions: { flexDirection: 'row', gap: 16, marginTop: 8 },
    clearRangesText: { fontSize: 13, color: '#ef4444', fontWeight: '500' },
    makeRangeText: { fontSize: 13, color: '#22c55e', fontWeight: '500' },
    showBtn: { backgroundColor: '#22c55e', borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginBottom: 12 },
    showBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    tableContainer: { borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
    tableHeader: { flexDirection: 'row', backgroundColor: isDark ? colors.muted : '#f3f4f6', paddingVertical: 10, paddingHorizontal: 6 },
    tableHeaderCell: { fontSize: 11, fontWeight: '700', color: isDark ? colors.foreground : '#374151', textAlign: 'center' },
    tableRow: { flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 6, backgroundColor: colors.card },
    tableRowEven: { backgroundColor: isDark ? colors.muted : '#f9fafb' },
    totalRowTable: { backgroundColor: isDark ? 'rgba(34, 197, 94, 0.15)' : '#f0fdf4', borderTopWidth: 1, borderTopColor: '#22c55e' },
    tableCell: { fontSize: 12, color: colors.foreground, textAlign: 'center' },
    tableCellCode: { flex: 0.8, fontWeight: '600' },
    tableCellDate: { flex: 1.8 },
    tableCellSession: { flex: 1 },
    tableCellSmall: { flex: 0.8 },
    tableCellAmount: { flex: 1.2, fontWeight: '600' },
    noDataRow: { paddingVertical: 24, alignItems: 'center', backgroundColor: colors.card },
    noDataText: { fontSize: 13, color: colors.mutedForeground },
    emptyText: { fontSize: 13, color: colors.mutedForeground, textAlign: 'center', marginTop: 16 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalContent: { backgroundColor: colors.card, borderRadius: 16, paddingBottom: 20, width: '100%', maxWidth: 400 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
    modalTitle: { fontSize: 16, fontWeight: '700', color: colors.foreground },
    calendarBody: { padding: 8 },
    modalFooter: { flexDirection: 'row', padding: 12, gap: 8, borderTopWidth: 1, borderTopColor: colors.border },
    cancelModalBtn: { flex: 1, backgroundColor: colors.muted, borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
    cancelModalBtnText: { color: colors.foreground, fontSize: 14, fontWeight: '600' },
    confirmModalBtn: { flex: 1, backgroundColor: '#22c55e', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
    confirmModalBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    codeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#3b82f6', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
    codeBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
    modalTabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border },
    modalTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, backgroundColor: colors.background },
    modalTabActive: { backgroundColor: '#22c55e' },
    modalTabText: { fontSize: 14, fontWeight: '600', color: colors.mutedForeground },
    modalTabTextActive: { color: '#fff' },
    modalScrollBody: { maxHeight: 400 },
    farmerListSection: { padding: 12 },
    emptyFarmersText: { fontSize: 13, color: colors.mutedForeground, textAlign: 'center', paddingVertical: 30 },
    farmerItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.background, borderRadius: 10, padding: 12, marginBottom: 8 },
    farmerItemInfo: { flex: 1 },
    farmerItemCode: { fontSize: 16, fontWeight: '700', color: colors.primary },
    farmerItemName: { fontSize: 14, fontWeight: '500', color: colors.foreground, marginTop: 2 },
    farmerItemMobile: { fontSize: 12, color: colors.mutedForeground, marginTop: 2 },
    farmerItemActions: { flexDirection: 'row', gap: 8 },
    farmerEditBtn: { padding: 8, backgroundColor: colors.primary + '20', borderRadius: 8 },
    farmerDeleteBtn: { padding: 8, backgroundColor: colors.destructive + '20', borderRadius: 8 },
    farmerFormSection: { padding: 12 },
    farmerFormField: { marginBottom: 12 },
    farmerFormLabel: { fontSize: 13, fontWeight: '500', color: colors.mutedForeground, marginBottom: 4 },
    farmerFormInput: { backgroundColor: colors.background, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.foreground, borderWidth: 1, borderColor: colors.border },
    farmerFormButtons: { flexDirection: 'row', gap: 8, marginTop: 8 },
    farmerSaveBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#22c55e', paddingVertical: 12, borderRadius: 8 },
    farmerSaveBtnDisabled: { backgroundColor: '#86efac', opacity: 0.7 },
    farmerSaveBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
    farmerCancelBtn: { flex: 1, backgroundColor: colors.muted, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
    farmerCancelBtnText: { color: colors.foreground, fontSize: 14, fontWeight: '600' },
    rangeModalBody: { padding: 16 },
    rangeInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    rangeInputField: { flex: 1 },
    rangeInputLabel: { fontSize: 12, fontWeight: '500', color: colors.mutedForeground, marginBottom: 4 },
    rangeInput: { backgroundColor: colors.background, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, fontWeight: '600', color: colors.foreground, textAlign: 'center', borderWidth: 1, borderColor: colors.border },
    rangeDash: { fontSize: 20, color: colors.mutedForeground, marginTop: 20 },
    // Code Modal Improved Styles
    codeModalContent: { backgroundColor: colors.card, borderRadius: 16, maxHeight: '85%', width: '100%', maxWidth: 400 },
    codeModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
    codeModalHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    codeModalIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#22c55e', alignItems: 'center', justifyContent: 'center' },
    codeModalTitle: { fontSize: 18, fontWeight: '700', color: colors.foreground },
    codeModalCloseBtn: { padding: 8, backgroundColor: colors.muted, borderRadius: 10 },
    codeModalTabs: { flexDirection: 'row', padding: 12, gap: 8 },
    codeModalTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 12, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
    codeModalTabActive: { backgroundColor: '#22c55e', borderColor: '#22c55e' },
    codeModalTabText: { fontSize: 14, fontWeight: '600', color: colors.mutedForeground },
    codeModalTabTextActive: { color: '#fff' },
    codeModalBody: { paddingHorizontal: 12, paddingBottom: 20, maxHeight: 450 },
    farmerListContainer: { gap: 12 },
    farmerSearchContainer: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.background, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: colors.border },
    farmerSearchInput: { flex: 1, fontSize: 14, color: colors.foreground, padding: 0 },
    emptyFarmersContainer: { alignItems: 'center', paddingVertical: 40 },
    emptyFarmersIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    emptyFarmersTitle: { fontSize: 16, fontWeight: '600', color: colors.foreground, marginBottom: 4 },
    emptyFarmersSubtitle: { fontSize: 13, color: colors.mutedForeground, textAlign: 'center', marginBottom: 16 },
    emptyFarmersBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#22c55e', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
    emptyFarmersBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
    farmerGridContainer: { gap: 10 },
    farmerCard: { backgroundColor: colors.background, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border },
    farmerCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
    farmerCodeBadge: { backgroundColor: '#dcfce7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    farmerCodeBadgeText: { fontSize: 14, fontWeight: '700', color: '#16a34a' },
    farmerCardActions: { flexDirection: 'row', gap: 6 },
    farmerCardEditBtn: { padding: 8, backgroundColor: colors.primary + '15', borderRadius: 8 },
    farmerCardDeleteBtn: { padding: 8, backgroundColor: '#fee2e2', borderRadius: 8 },
    farmerCardName: { fontSize: 15, fontWeight: '600', color: colors.foreground, marginBottom: 6 },
    farmerCardMobileRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    farmerCardMobile: { fontSize: 13, color: colors.mutedForeground },
    farmerCardStats: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border },
    farmerCardStatsText: { fontSize: 12, color: '#22c55e', fontWeight: '600' },
    farmerFormContainer: { gap: 16 },
    farmerFormCard: { backgroundColor: colors.background, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: colors.border },
    farmerFormLabelRequired: { color: '#ef4444' },
    farmerFormInputDisabled: { backgroundColor: colors.muted, opacity: 0.7 },
    farmerFormTextarea: { minHeight: 70, textAlignVertical: 'top' },
    farmerFormActions: { flexDirection: 'row', gap: 10 },
    farmerFormSaveBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#22c55e', paddingVertical: 14, borderRadius: 12 },
    farmerFormSaveBtnDisabled: { backgroundColor: '#86efac', opacity: 0.7 },
    farmerFormSaveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    farmerFormCancelBtn: { flex: 1, backgroundColor: colors.muted, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
    farmerFormCancelBtnText: { color: colors.foreground, fontSize: 15, fontWeight: '600' },
    // Date Modal Bottom Sheet Styles
    bottomSheetOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    dateModalContent: {
        backgroundColor: colors.card,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingBottom: 20,
        width: '100%',
        overflow: 'hidden',
    },
    dateModalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    dateModalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.foreground,
    },
    selectedDateDisplay: {
        alignItems: 'center',
        paddingVertical: 12,
        backgroundColor: isDark ? colors.muted : '#f0fdf4',
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    selectedDateLabel: {
        fontSize: 12,
        color: colors.mutedForeground,
        marginBottom: 4,
    },
    selectedDateValue: {
        fontSize: 20,
        fontWeight: '700',
        color: '#22c55e',
    },
    dateModalFooter: {
        flexDirection: 'row',
        padding: 12,
        gap: 10,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
});
