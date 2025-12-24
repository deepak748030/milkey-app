import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, RefreshControl, Modal, ActivityIndicator } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { X, FileText, Calendar as CalendarIcon, Printer, Plus, Edit2, Trash2, Code, UserPlus, Phone, MapPin } from 'lucide-react-native';
import TopBar from '@/components/TopBar';
import { milkCollectionsApi, farmersApi, MilkCollection, Farmer } from '@/lib/milkeyApi';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { SuccessModal } from '@/components/SuccessModal';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { Calendar } from '@/components/Calendar';

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
    const [farmers, setFarmers] = useState<Farmer[]>([]);

    const [entryDate, setEntryDate] = useState<Date | null>(null);
    const [entryShift, setEntryShift] = useState<'morning' | 'evening'>('morning');
    const [entryFarmerCode, setEntryFarmerCode] = useState('');
    const [entryFarmerName, setEntryFarmerName] = useState('');
    const [entryFat, setEntryFat] = useState('');
    const [entrySnf, setEntrySnf] = useState('');
    const [entryQty, setEntryQty] = useState('');
    const [entryRate, setEntryRate] = useState('');
    const [showEntryDateModal, setShowEntryDateModal] = useState(false);

    const [historyFromDate, setHistoryFromDate] = useState<Date | null>(null);
    const [historyToDate, setHistoryToDate] = useState<Date | null>(null);
    const [historyCollections, setHistoryCollections] = useState<MilkCollection[]>([]);
    const [historyTotals, setHistoryTotals] = useState({ quantity: 0, amount: 0 });
    const [selectedRanges, setSelectedRanges] = useState<string[]>([]);
    const [showHistoryDateModal, setShowHistoryDateModal] = useState(false);
    const [historyDateType, setHistoryDateType] = useState<'from' | 'to'>('from');
    const [tempCalendarDate, setTempCalendarDate] = useState<Date | null>(null);
    const [historyFilterCode, setHistoryFilterCode] = useState('');

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
    const [editingFarmer, setEditingFarmer] = useState<Farmer | null>(null);

    const [alertVisible, setAlertVisible] = useState(false);
    const [alertTitle, setAlertTitle] = useState('');
    const [alertMessage, setAlertMessage] = useState('');
    const [confirmVisible, setConfirmVisible] = useState(false);
    const [confirmData, setConfirmData] = useState<{ title: string; message: string; onConfirm: () => void }>({ title: '', message: '', onConfirm: () => { } });

    const styles = createStyles(colors, isDark);

    const showAlert = (title: string, message: string) => { setAlertTitle(title); setAlertMessage(message); setAlertVisible(true); };
    const showConfirm = (title: string, message: string, onConfirm: () => void) => { setConfirmData({ title, message, onConfirm }); setConfirmVisible(true); };

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const farmersRes = await farmersApi.getAll({ type: 'farmer' }).catch(() => null);
            if (farmersRes?.success) setFarmers(farmersRes.response?.data || []);
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    const onRefresh = useCallback(async () => { setRefreshing(true); await fetchData(); setRefreshing(false); }, []);

    const clearFarmerForm = () => { setNewFarmerCode(''); setNewFarmerName(''); setNewFarmerMobile(''); setNewFarmerAddress(''); setEditingFarmer(null); };

    const handleCreateFarmer = async () => {
        if (!newFarmerCode.trim() || !newFarmerName.trim() || !newFarmerMobile.trim()) { showAlert('Error', 'Please fill code, name and mobile'); return; }
        setSavingFarmer(true);
        try {
            const res = await farmersApi.create({ code: newFarmerCode.trim().toUpperCase(), name: newFarmerName.trim(), mobile: newFarmerMobile.trim(), address: newFarmerAddress.trim(), type: 'farmer' });
            if (res.success) { showAlert('Success', 'Farmer created'); clearFarmerForm(); setCodeModalTab('list'); await fetchData(); }
            else { showAlert('Error', res.message || 'Failed'); }
        } catch (error) { showAlert('Error', 'Failed to create farmer'); }
        setSavingFarmer(false);
    };

    const handleUpdateFarmer = async () => {
        if (!editingFarmer || !newFarmerName.trim() || !newFarmerMobile.trim()) { showAlert('Error', 'Please fill name and mobile'); return; }
        setSavingFarmer(true);
        try {
            const res = await farmersApi.update(editingFarmer._id, { name: newFarmerName.trim(), mobile: newFarmerMobile.trim(), address: newFarmerAddress.trim() });
            if (res.success) { showAlert('Success', 'Farmer updated'); clearFarmerForm(); setCodeModalTab('list'); await fetchData(); }
            else { showAlert('Error', res.message || 'Failed'); }
        } catch (error) { showAlert('Error', 'Failed to update farmer'); }
        setSavingFarmer(false);
    };

    const handleEditFarmer = (farmer: Farmer) => { setEditingFarmer(farmer); setNewFarmerCode(farmer.code); setNewFarmerName(farmer.name); setNewFarmerMobile(farmer.mobile); setNewFarmerAddress(farmer.address || ''); setCodeModalTab('create'); };

    const handleDeleteFarmer = (farmerId: string) => {
        showConfirm('Delete Farmer', 'Are you sure?', async () => {
            setConfirmVisible(false);
            try { const res = await farmersApi.delete(farmerId); if (res.success) { showAlert('Success', 'Farmer deleted'); await fetchData(); } else { showAlert('Error', res.message || 'Failed'); } } catch (error) { showAlert('Error', 'Failed'); }
        });
    };

    const handleSelectFarmer = (farmer: Farmer) => { setEntryFarmerCode(farmer.code); setEntryFarmerName(farmer.name); setShowCodeModal(false); };

    const totalAmount = (parseFloat(entryQty || '0') * parseFloat(entryRate || '0')).toFixed(2);
    const formatDisplayDate = (date: Date | null) => { if (!date) return 'Select Date'; return `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`; };
    const formatApiDate = (date: Date | null) => { if (!date) return ''; return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; };

    const handleFarmerCodeChange = (code: string) => {
        setEntryFarmerCode(code);
        const farmer = farmers.find(f => f.code.toUpperCase() === code.trim().toUpperCase());
        setEntryFarmerName(farmer?.name || '');
    };
    const handleClearEntry = () => { setEntryDate(null); setEntryFarmerCode(''); setEntryFarmerName(''); setEntryFat(''); setEntrySnf(''); setEntryQty(''); setEntryRate(''); setEntryShift('morning'); };

    const handleUpdateEntry = async () => {
        if (saving) return;
        if (!entryFarmerCode) { showAlert('Error', 'Please enter farmer code'); return; }
        if (!entryQty || !entryRate) { showAlert('Error', 'Please enter quantity and rate'); return; }
        setSaving(true);
        try {
            const res = await milkCollectionsApi.create({ farmerCode: entryFarmerCode.trim().toUpperCase(), quantity: parseFloat(entryQty), rate: parseFloat(entryRate), date: entryDate ? formatApiDate(entryDate) : undefined, shift: entryShift, fat: entryFat ? parseFloat(entryFat) : undefined, snf: entrySnf ? parseFloat(entrySnf) : undefined });
            if (res.success) { showAlert('Success', 'Milk collection recorded'); handleClearEntry(); } else { showAlert('Error', res.message || 'Failed'); }
        } catch (error) { showAlert('Error', 'Failed to save entry'); }
        setSaving(false);
    };

    const handleToggleRange = (rangeId: string) => { setSelectedRanges(prev => prev.includes(rangeId) ? prev.filter(r => r !== rangeId) : [...prev, rangeId]); };
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
            const res = await milkCollectionsApi.getAll({ startDate: startDate || undefined, endDate: endDate || undefined, farmerCode: historyFilterCode.trim().toUpperCase() || undefined, limit: 100 });
            if (res.success) { setHistoryCollections(res.response?.data || []); setHistoryTotals(res.response?.totals || { quantity: 0, amount: 0 }); }
        } catch (error) { showAlert('Error', 'Failed to fetch history'); }
        setLoading(false);
    };

    const generateHistoryPdfHtml = () => historyCollections.length === 0 ? '' : `<html><head><style>body{font-family:Arial;padding:20px}h1{color:#22c55e;text-align:center}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border:1px solid #ddd;padding:10px;text-align:center}th{background:#22c55e;color:white}.summary{background:#f0fdf4;padding:15px;border-radius:8px;margin-top:20px}</style></head><body><h1>Purchase History</h1><table><tr><th>Date</th><th>Session</th><th>FAT</th><th>SNF</th><th>Qty</th><th>Rate</th><th>Amt</th></tr>${historyCollections.map(c => `<tr><td>${new Date(c.date).toISOString().split('T')[0]}</td><td>${c.shift}</td><td>${c.fat || '-'}</td><td>${c.snf || '-'}</td><td>${c.quantity}</td><td>${c.rate}</td><td>₹${c.amount.toFixed(2)}</td></tr>`).join('')}</table><div class="summary"><p><strong>Total Quantity:</strong> ${historyTotals.quantity.toFixed(2)} L</p><p><strong>Total Amount:</strong> ₹${historyTotals.amount.toFixed(2)}</p></div></body></html>`;

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
                    <View style={styles.totalRow}><View style={styles.totalSection}><Text style={styles.totalLabel}>Total Amount (₹)</Text><Text style={styles.totalAmount}>{totalAmount}</Text></View><View style={styles.buttonGroup}><Pressable style={[styles.updateBtn, saving && styles.updateBtnDisabled]} onPress={handleUpdateEntry} disabled={saving}>{saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.updateBtnText}>Update</Text>}</Pressable><Pressable style={styles.clearBtn} onPress={handleClearEntry} disabled={saving}><Text style={styles.clearBtnText}>Clear</Text></Pressable></View></View>
                </View>

                <View style={styles.card}>
                    <View style={styles.historyHeader}><Text style={styles.cardTitle}>Purchase History</Text><View style={styles.historyButtons}><Pressable style={styles.pdfBtn} onPress={handleHistoryPdf}><FileText size={14} color="#fff" /><Text style={styles.pdfBtnText}>PDF</Text></Pressable><Pressable style={styles.printBtn} onPress={handleHistoryPrint}><Printer size={14} color="#fff" /><Text style={styles.printBtnText}>Print</Text></Pressable></View></View>
                    <View style={styles.filterCodeRow}><Text style={styles.fieldLabelSmall}>Filter by Code</Text><TextInput style={styles.filterCodeInput} value={historyFilterCode} onChangeText={setHistoryFilterCode} placeholder="Enter farmer code" placeholderTextColor={colors.mutedForeground} /></View>
                    <View style={styles.row}><View style={styles.fieldHalf}><Text style={styles.fieldLabelSmall}>From Date</Text><Pressable style={styles.dateInput} onPress={() => { setHistoryDateType('from'); setTempCalendarDate(historyFromDate || new Date()); setShowHistoryDateModal(true); }}><Text style={styles.dateInputText}>{formatDisplayDate(historyFromDate)}</Text><CalendarIcon size={16} color={colors.mutedForeground} /></Pressable></View><View style={styles.fieldHalf}><Text style={styles.fieldLabelSmall}>To Date</Text><Pressable style={styles.dateInput} onPress={() => { setHistoryDateType('to'); setTempCalendarDate(historyToDate || new Date()); setShowHistoryDateModal(true); }}><Text style={styles.dateInputText}>{formatDisplayDate(historyToDate)}</Text><CalendarIcon size={16} color={colors.mutedForeground} /></Pressable></View></View>
                    <View style={styles.quickRangesSection}><Text style={styles.quickRangesLabel}>Quick Ranges (long press to delete)</Text><View style={styles.quickRangesRow}>{customRanges.map(range => (<Pressable key={range.id} style={[styles.quickRangeChip, selectedRanges.includes(range.id) && styles.quickRangeChipActive]} onPress={() => handleToggleRange(range.id)} onLongPress={() => handleDeleteRange(range.id)}><Text style={[styles.quickRangeText, selectedRanges.includes(range.id) && styles.quickRangeTextActive]}>{range.label}</Text>{selectedRanges.includes(range.id) && <X size={12} color={colors.destructive} />}</Pressable>))}</View><View style={styles.rangeActions}><Pressable onPress={handleClearRanges}><Text style={styles.clearRangesText}>✕ Clear</Text></Pressable><Pressable onPress={() => setShowCreateRangeModal(true)}><Text style={styles.makeRangeText}>+ Make Range</Text></Pressable></View></View>
                    <Pressable style={styles.showBtn} onPress={handleFetchHistory} disabled={loading}>{loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.showBtnText}>Show</Text>}</Pressable>
                    {historyCollections.length > 0 && (<View style={styles.tableContainer}><View style={styles.tableHeader}><Text style={[styles.tableHeaderCell, styles.tableCellCode]}>Code</Text><Text style={[styles.tableHeaderCell, styles.tableCellDate]}>Date</Text><Text style={[styles.tableHeaderCell, styles.tableCellSession]}>Sess</Text><Text style={[styles.tableHeaderCell, styles.tableCellSmall]}>FAT</Text><Text style={[styles.tableHeaderCell, styles.tableCellSmall]}>SNF</Text><Text style={[styles.tableHeaderCell, styles.tableCellSmall]}>Qty</Text><Text style={[styles.tableHeaderCell, styles.tableCellSmall]}>Rate</Text><Text style={[styles.tableHeaderCell, styles.tableCellAmount]}>Amt</Text></View>{historyCollections.map((item, index) => (<View key={item._id} style={[styles.tableRow, index % 2 === 0 && styles.tableRowEven]}><Text style={[styles.tableCell, styles.tableCellCode, { color: colors.primary, fontWeight: '600' }]}>{item.farmerCode || '-'}</Text><Text style={[styles.tableCell, styles.tableCellDate]}>{new Date(item.date).toISOString().split('T')[0]}</Text><Text style={[styles.tableCell, styles.tableCellSession, { color: item.shift === 'morning' ? '#f59e0b' : '#3b82f6' }]}>{item.shift}</Text><Text style={[styles.tableCell, styles.tableCellSmall]}>{item.fat || '-'}</Text><Text style={[styles.tableCell, styles.tableCellSmall]}>{item.snf || '-'}</Text><Text style={[styles.tableCell, styles.tableCellSmall]}>{item.quantity}</Text><Text style={[styles.tableCell, styles.tableCellSmall]}>{item.rate}</Text><Text style={[styles.tableCell, styles.tableCellAmount, { color: colors.success }]}>₹{item.amount.toFixed(2)}</Text></View>))}<View style={[styles.tableRow, styles.totalRowTable]}><Text style={[styles.tableCell, styles.tableCellCode, { fontWeight: '700' }]}>Total</Text><Text style={[styles.tableCell, styles.tableCellDate]}></Text><Text style={[styles.tableCell, styles.tableCellSession]}></Text><Text style={[styles.tableCell, styles.tableCellSmall]}></Text><Text style={[styles.tableCell, styles.tableCellSmall]}></Text><Text style={[styles.tableCell, styles.tableCellSmall, { fontWeight: '700' }]}>{historyTotals.quantity.toFixed(1)}</Text><Text style={[styles.tableCell, styles.tableCellSmall]}></Text><Text style={[styles.tableCell, styles.tableCellAmount, { color: colors.success, fontWeight: '700' }]}>₹{historyTotals.amount.toFixed(2)}</Text></View></View>)}
                    {historyCollections.length === 0 && !loading && <Text style={styles.emptyText}>Select date range and click Show to view history</Text>}
                </View>
            </ScrollView>

            <Modal visible={showEntryDateModal} animationType="slide" transparent onRequestClose={() => setShowEntryDateModal(false)}><View style={styles.modalOverlay}><View style={styles.modalContent}><View style={styles.modalHeader}><Text style={styles.modalTitle}>Select Date</Text><Pressable onPress={() => setShowEntryDateModal(false)}><X size={20} color={colors.foreground} /></Pressable></View><View style={styles.calendarBody}><Calendar selectedDate={tempCalendarDate} onDateSelect={setTempCalendarDate} /></View><View style={styles.modalFooter}><Pressable style={styles.cancelModalBtn} onPress={() => setShowEntryDateModal(false)}><Text style={styles.cancelModalBtnText}>Cancel</Text></Pressable><Pressable style={styles.confirmModalBtn} onPress={() => { if (tempCalendarDate) setEntryDate(tempCalendarDate); setShowEntryDateModal(false); }}><Text style={styles.confirmModalBtnText}>Confirm</Text></Pressable></View></View></View></Modal>
            <Modal visible={showHistoryDateModal} animationType="slide" transparent onRequestClose={() => setShowHistoryDateModal(false)}><View style={styles.modalOverlay}><View style={styles.modalContent}><View style={styles.modalHeader}><Text style={styles.modalTitle}>{historyDateType === 'from' ? 'From Date' : 'To Date'}</Text><Pressable onPress={() => setShowHistoryDateModal(false)}><X size={20} color={colors.foreground} /></Pressable></View><View style={styles.calendarBody}><Calendar selectedDate={tempCalendarDate} onDateSelect={setTempCalendarDate} /></View><View style={styles.modalFooter}><Pressable style={styles.cancelModalBtn} onPress={() => setShowHistoryDateModal(false)}><Text style={styles.cancelModalBtnText}>Cancel</Text></Pressable><Pressable style={styles.confirmModalBtn} onPress={() => { if (tempCalendarDate) { if (historyDateType === 'from') setHistoryFromDate(tempCalendarDate); else setHistoryToDate(tempCalendarDate); } setShowHistoryDateModal(false); }}><Text style={styles.confirmModalBtnText}>Confirm</Text></Pressable></View></View></View></Modal>
            <Modal visible={showCreateRangeModal} animationType="slide" transparent onRequestClose={() => setShowCreateRangeModal(false)}><View style={styles.modalOverlay}><View style={styles.modalContent}><View style={styles.modalHeader}><Text style={styles.modalTitle}>Create Custom Range</Text><Pressable onPress={() => setShowCreateRangeModal(false)}><X size={20} color={colors.foreground} /></Pressable></View><View style={styles.rangeModalBody}><View style={styles.rangeInputRow}><View style={styles.rangeInputField}><Text style={styles.rangeInputLabel}>Start Day</Text><TextInput style={styles.rangeInput} value={newRangeStart} onChangeText={setNewRangeStart} keyboardType="number-pad" placeholder="1" placeholderTextColor={colors.mutedForeground} maxLength={2} /></View><Text style={styles.rangeDash}>—</Text><View style={styles.rangeInputField}><Text style={styles.rangeInputLabel}>End Day</Text><TextInput style={styles.rangeInput} value={newRangeEnd} onChangeText={setNewRangeEnd} keyboardType="number-pad" placeholder="10" placeholderTextColor={colors.mutedForeground} maxLength={2} /></View></View></View><View style={styles.modalFooter}><Pressable style={styles.cancelModalBtn} onPress={() => setShowCreateRangeModal(false)}><Text style={styles.cancelModalBtnText}>Cancel</Text></Pressable><Pressable style={styles.confirmModalBtn} onPress={handleCreateRange}><Text style={styles.confirmModalBtnText}>Create</Text></Pressable></View></View></View></Modal>
            <Modal visible={showCodeModal} animationType="slide" transparent onRequestClose={() => setShowCodeModal(false)}><View style={styles.modalOverlay}><View style={styles.modalContent}><View style={styles.modalHeader}><Text style={styles.modalTitle}>Farmers</Text><Pressable onPress={() => { setShowCodeModal(false); clearFarmerForm(); }}><X size={20} color={colors.foreground} /></Pressable></View><View style={styles.modalTabs}><Pressable style={[styles.modalTab, codeModalTab === 'list' && styles.modalTabActive]} onPress={() => { setCodeModalTab('list'); clearFarmerForm(); }}><Text style={[styles.modalTabText, codeModalTab === 'list' && styles.modalTabTextActive]}>Select</Text></Pressable><Pressable style={[styles.modalTab, codeModalTab === 'create' && styles.modalTabActive]} onPress={() => setCodeModalTab('create')}><UserPlus size={16} color={codeModalTab === 'create' ? '#fff' : colors.mutedForeground} /><Text style={[styles.modalTabText, codeModalTab === 'create' && styles.modalTabTextActive]}>{editingFarmer ? 'Edit' : 'New'}</Text></Pressable></View><ScrollView style={styles.modalScrollBody}>{codeModalTab === 'list' ? (<View style={styles.farmerListSection}>{farmers.length === 0 ? <Text style={styles.emptyFarmersText}>No farmers found. Create one first.</Text> : farmers.map(farmer => (<Pressable key={farmer._id} style={styles.farmerItem} onPress={() => handleSelectFarmer(farmer)}><View style={styles.farmerItemInfo}><Text style={styles.farmerItemCode}>{farmer.code}</Text><Text style={styles.farmerItemName}>{farmer.name}</Text><Text style={styles.farmerItemMobile}>{farmer.mobile}</Text></View><View style={styles.farmerItemActions}><Pressable style={styles.farmerEditBtn} onPress={() => handleEditFarmer(farmer)}><Edit2 size={14} color={colors.primary} /></Pressable><Pressable style={styles.farmerDeleteBtn} onPress={() => handleDeleteFarmer(farmer._id)}><Trash2 size={14} color={colors.destructive} /></Pressable></View></Pressable>))}</View>) : (<View style={styles.farmerFormSection}><View style={styles.farmerFormField}><Text style={styles.farmerFormLabel}>Code *</Text><TextInput style={[styles.farmerFormInput, editingFarmer && { backgroundColor: colors.muted }]} value={newFarmerCode} onChangeText={setNewFarmerCode} placeholder="e.g. F001" placeholderTextColor={colors.mutedForeground} editable={!editingFarmer} autoCapitalize="characters" /></View><View style={styles.farmerFormField}><Text style={styles.farmerFormLabel}>Name *</Text><TextInput style={styles.farmerFormInput} value={newFarmerName} onChangeText={setNewFarmerName} placeholder="Farmer name" placeholderTextColor={colors.mutedForeground} /></View><View style={styles.farmerFormField}><Text style={styles.farmerFormLabel}>Mobile *</Text><TextInput style={styles.farmerFormInput} value={newFarmerMobile} onChangeText={setNewFarmerMobile} placeholder="Mobile number" placeholderTextColor={colors.mutedForeground} keyboardType="phone-pad" /></View><View style={styles.farmerFormField}><Text style={styles.farmerFormLabel}>Address</Text><TextInput style={[styles.farmerFormInput, { minHeight: 60 }]} value={newFarmerAddress} onChangeText={setNewFarmerAddress} placeholder="Address (optional)" placeholderTextColor={colors.mutedForeground} multiline /></View><View style={styles.farmerFormButtons}>{editingFarmer ? (<><Pressable style={[styles.farmerSaveBtn, savingFarmer && styles.farmerSaveBtnDisabled]} onPress={handleUpdateFarmer} disabled={savingFarmer}>{savingFarmer ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.farmerSaveBtnText}>Update Farmer</Text>}</Pressable><Pressable style={styles.farmerCancelBtn} onPress={clearFarmerForm}><Text style={styles.farmerCancelBtnText}>Cancel</Text></Pressable></>) : (<Pressable style={[styles.farmerSaveBtn, savingFarmer && styles.farmerSaveBtnDisabled]} onPress={handleCreateFarmer} disabled={savingFarmer}>{savingFarmer ? <ActivityIndicator size="small" color="#fff" /> : <><Plus size={16} color="#fff" /><Text style={styles.farmerSaveBtnText}>Create Farmer</Text></>}</Pressable>)}</View></View>)}</ScrollView></View></View></Modal>
            <SuccessModal isVisible={alertVisible} title={alertTitle} message={alertMessage} onClose={() => setAlertVisible(false)} />
            <ConfirmationModal visible={confirmVisible} title={confirmData.title} message={confirmData.message} onConfirm={confirmData.onConfirm} onClose={() => setConfirmVisible(false)} />
        </View>
    );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scrollView: { flex: 1 },
    scrollContent: { padding: 12, gap: 12 },
    card: { backgroundColor: colors.card, borderRadius: 12, padding: 12 },
    cardTitle: { fontSize: 16, fontWeight: '700', color: colors.foreground },
    row: { flexDirection: 'row', gap: 8, marginBottom: 8 },
    fieldHalf: { flex: 1 },
    fieldLabel: { fontSize: 12, fontWeight: '500', color: colors.mutedForeground, marginBottom: 4 },
    fieldLabelSmall: { fontSize: 11, fontWeight: '500', color: colors.mutedForeground, marginBottom: 4 },
    dateInput: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.background, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10 },
    dateInputText: { fontSize: 14, color: colors.foreground },
    sessionRow: { flexDirection: 'row', gap: 6 },
    sessionBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', backgroundColor: colors.background },
    sessionBtnActive: { backgroundColor: '#22c55e' },
    sessionBtnActiveEvening: { backgroundColor: '#6b7280' },
    sessionBtnText: { fontSize: 13, fontWeight: '600', color: colors.foreground },
    sessionBtnTextActive: { color: '#fff' },
    textInput: { backgroundColor: colors.background, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10, fontSize: 14, color: colors.foreground },
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
    filterCodeInput: { backgroundColor: colors.background, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, color: colors.foreground },
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
    tableContainer: { borderRadius: 8, overflow: 'hidden' },
    tableHeader: { flexDirection: 'row', backgroundColor: '#f3f4f6', paddingVertical: 8, paddingHorizontal: 6 },
    tableHeaderCell: { fontSize: 11, fontWeight: '700', color: colors.mutedForeground, textAlign: 'center' },
    tableRow: { flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 6 },
    tableRowEven: { backgroundColor: colors.background },
    totalRowTable: { backgroundColor: '#f0fdf4', borderTopWidth: 1, borderTopColor: '#22c55e' },
    tableCell: { fontSize: 12, color: colors.foreground, textAlign: 'center' },
    tableCellCode: { flex: 0.8, fontWeight: '600' },
    tableCellDate: { flex: 1.8 },
    tableCellSession: { flex: 1 },
    tableCellSmall: { flex: 0.8 },
    tableCellAmount: { flex: 1.2, fontWeight: '600' },
    emptyText: { fontSize: 13, color: colors.mutedForeground, textAlign: 'center', marginTop: 16 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 20 },
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
});
