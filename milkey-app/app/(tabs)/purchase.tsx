import React, { useState, useEffect, useCallback, memo } from 'react';
import {
    View, Text, StyleSheet, Pressable, TextInput, FlatList,
    ActivityIndicator, RefreshControl, Modal, ScrollView
} from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import {
    Plus, Edit2, Trash2, Calendar as CalendarIcon, Search, X,
    ChevronDown, FileText, User, Sun, Moon,
    Droplets, CircleDot, Download, Check
} from 'lucide-react-native';
import TopBar from '@/components/TopBar';
import {
    milkCollectionsApi, purchaseFarmersApi,
    MilkCollection, PurchaseFarmer
} from '@/lib/milkeyApi';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { SuccessModal } from '@/components/SuccessModal';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { Calendar } from '@/components/Calendar';
import { useDebounce } from '@/hooks/useDebounce';
import { useSubscriptionCheck } from '@/hooks/useSubscriptionCheck';
import { SubscriptionModal } from '@/components/SubscriptionModal';
import { AddCustomerSheet } from '@/components/purchase/AddCustomerSheet';

export default function PurchaseScreen() {
    const { colors, isDark } = useTheme();
    const {
        hasAccess, loading: subscriptionLoading, showSubscriptionModal,
        handleModalClose, handleSubscriptionSuccess
    } = useSubscriptionCheck('purchase');

    const [customers, setCustomers] = useState<PurchaseFarmer[]>([]);
    const [selectedCustomer, setSelectedCustomer] = useState<PurchaseFarmer | null>(null);
    const [customerSearch, setCustomerSearch] = useState('');
    const debouncedSearch = useDebounce(customerSearch, 400);

    const [entryDate, setEntryDate] = useState(new Date());
    const [entryShift, setEntryShift] = useState<'morning' | 'evening'>(new Date().getHours() < 12 ? 'morning' : 'evening');
    const [milkType, setMilkType] = useState<'cow' | 'buffalo'>('buffalo');
    const [milkQty, setMilkQty] = useState('');
    const [fatValue, setFatValue] = useState('');
    const [rateValue, setRateValue] = useState('');
    const [isZero, setIsZero] = useState(false);
    const [saving, setSaving] = useState(false);

    const [collections, setCollections] = useState<MilkCollection[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyPage, setHistoryPage] = useState(1);
    const [hasMoreHistory, setHasMoreHistory] = useState(true);
    const [historyTotals, setHistoryTotals] = useState({ quantity: 0, amount: 0 });

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

    useEffect(() => { fetchCustomers(); }, []);
    useEffect(() => { fetchCollections(1); }, [entryDate, entryShift]);
    useEffect(() => { if (debouncedSearch !== undefined) fetchCustomers(debouncedSearch); }, [debouncedSearch]);

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
                milkType,
            });
            if (res.success) {
                showAlert('Success', 'Entry saved');
                setMilkQty(''); setFatValue('');
                if (selectedCustomer.priceBasis === 'rate') autoFillRate(selectedCustomer, milkType);
                setIsZero(false);
                fetchCollections(1);
            } else {
                showAlert('Error', res.message || 'Failed to save');
            }
        } catch { showAlert('Error', 'Failed to save entry'); }
        setSaving(false);
    }, [saving, selectedCustomer, milkQty, rateValue, fatValue, entryDate, entryShift, milkType, isZero]);

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

    const renderCollectionItem = useCallback(({ item, index }: { item: MilkCollection; index: number }) => (
        <View style={[s.entryRow, index % 2 !== 0 && { backgroundColor: isDark ? colors.muted + '30' : '#f8fafc' }]}>
            <View style={s.entryCell1}>
                <Text style={[s.entryCellText, { color: colors.primary, fontWeight: '700' }]}>{item.farmerCode || '-'}</Text>
                <Text style={s.entrySubText} numberOfLines={1}>{item.purchaseFarmer?.name || ''}</Text>
            </View>
            <Text style={[s.entryCellText, s.entryCell2]}>{item.quantity}</Text>
            <Text style={[s.entryCellText, s.entryCell2]}>{item.fat || '-'}</Text>
            <Text style={[s.entryCellText, s.entryCell2]}>{item.rate}</Text>
            <Text style={[s.entryCellText, s.entryCell3, { color: colors.primary, fontWeight: '700' }]}>₹{item.amount.toFixed(0)}</Text>
            <Pressable style={s.deleteBtn} onPress={() => handleDeleteCollection(item._id)} disabled={deletingId === item._id}>
                {deletingId === item._id ? <ActivityIndicator size="small" color="#ef4444" /> : <Trash2 size={12} color="#ef4444" />}
            </Pressable>
        </View>
    ), [deletingId, colors, isDark]);

    const handleExportPdf = useCallback(async () => {
        if (collections.length === 0) { showAlert('Info', 'No data to export'); return; }
        const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
            body{font-family:sans-serif;padding:16px;font-size:12px}
            h2{color:#22c55e;text-align:center}
            table{width:100%;border-collapse:collapse;margin-top:12px}
            th{background:#22c55e;color:#fff;padding:6px 4px;font-size:10px}
            td{padding:5px 4px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:10px}
            .total{background:#f0fdf4;font-weight:bold}
        </style></head><body>
        <h2>Purchase Report - ${formatDate(entryDate)} (${entryShift === 'morning' ? 'AM' : 'PM'})</h2>
        <table><thead><tr><th>Code</th><th>Name</th><th>Milk(L)</th><th>Fat</th><th>Rate</th><th>Amount</th></tr></thead>
        <tbody>${collections.map(c => `<tr><td>${c.farmerCode || '-'}</td><td>${c.purchaseFarmer?.name || '-'}</td><td>${c.quantity}</td><td>${c.fat || '-'}</td><td>₹${c.rate}</td><td>₹${c.amount.toFixed(2)}</td></tr>`).join('')}
        <tr class="total"><td colspan="2">Total (${collections.length})</td><td>${historyTotals.quantity.toFixed(1)}</td><td></td><td></td><td>₹${historyTotals.amount.toFixed(2)}</td></tr>
        </tbody></table></body></html>`;
        try {
            const { uri } = await Print.printToFileAsync({ html });
            if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
        } catch { showAlert('Error', 'Failed to export'); }
    }, [collections, historyTotals, entryDate, entryShift]);

    const showCow = selectedCustomer ? selectedCustomer.cowEnabled : true;
    const showBuffalo = selectedCustomer ? selectedCustomer.buffaloEnabled : true;
    const isMorning = entryShift === 'morning';

    return (
        <View style={s.container}>
            <SubscriptionModal visible={showSubscriptionModal} onClose={handleModalClose} onSubscribe={handleSubscriptionSuccess} filterTab="purchase" title="Subscribe to Access Purchase" fullScreen />
            <TopBar />

            <ScrollView
                style={s.scroll}
                contentContainerStyle={s.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
                keyboardShouldPersistTaps="handled"
            >
                {/* ── Top Controls: Date + Shift ── */}
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
                            <Sun size={12} color={isMorning ? '#fff' : colors.mutedForeground} />
                            <Text style={[s.shiftBtnText, isMorning && s.shiftBtnTextActive]}>AM</Text>
                        </Pressable>
                        <Pressable
                            onPress={() => setEntryShift('evening')}
                            style={[s.shiftBtn, !isMorning && s.shiftBtnActive]}
                        >
                            <Moon size={12} color={!isMorning ? '#fff' : colors.mutedForeground} />
                            <Text style={[s.shiftBtnText, !isMorning && s.shiftBtnTextActive]}>PM</Text>
                        </Pressable>
                    </View>
                </View>

                {/* ── Summary Bar ── */}
                <View style={s.summaryBar}>
                    <View style={s.summaryCell}>
                        <Droplets size={14} color={colors.primary} />
                        <View>
                            <Text style={s.summaryVal}>{milkQty || '0'} L</Text>
                            <Text style={s.summaryLbl}>Quantity</Text>
                        </View>
                    </View>
                    <View style={s.summaryDivider} />
                    <View style={s.summaryCell}>
                        <Text style={{ fontSize: 14, color: colors.primary, fontWeight: '800' }}>₹</Text>
                        <View>
                            <Text style={s.summaryVal}>{rateValue || '0'}</Text>
                            <Text style={s.summaryLbl}>Rate/L</Text>
                        </View>
                    </View>
                    <View style={s.summaryDivider} />
                    <View style={s.summaryCell}>
                        <Text style={{ fontSize: 14, color: colors.primary, fontWeight: '800' }}>₹</Text>
                        <View>
                            <Text style={[s.summaryVal, { color: colors.primary }]}>{computeAmount().toFixed(1)}</Text>
                            <Text style={s.summaryLbl}>Amount</Text>
                        </View>
                    </View>
                </View>

                {/* ── Customer Selector ── */}
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
                            {selectedCustomer ? selectedCustomer.name : 'Select Customer'}
                        </Text>
                        {selectedCustomer && (
                            <Text style={s.customerMeta}>
                                {selectedCustomer.priceBasis === 'rate' ? '📊 Rate Based' : '📊 Fat Based'}
                                {selectedCustomer.mobile ? ` • ${selectedCustomer.mobile}` : ''}
                            </Text>
                        )}
                    </View>
                    <ChevronDown size={16} color={colors.mutedForeground} />
                </Pressable>

                {/* ── Milk Type + Inputs ── */}
                <View style={s.entryCard}>
                    {/* Milk type toggle */}
                    <View style={s.milkRow}>
                        {showCow && (
                            <Pressable
                                onPress={() => setMilkType('cow')}
                                style={[s.milkBtn, milkType === 'cow' && s.milkBtnActive]}
                            >
                                <Text style={{ fontSize: 16 }}>🐄</Text>
                                <Text style={[s.milkBtnText, milkType === 'cow' && { color: '#fff' }]}>Cow</Text>
                                {milkType === 'cow' && <Check size={12} color="#fff" />}
                            </Pressable>
                        )}
                        {showBuffalo && (
                            <Pressable
                                onPress={() => setMilkType('buffalo')}
                                style={[s.milkBtn, milkType === 'buffalo' && s.milkBtnActive]}
                            >
                                <Text style={{ fontSize: 16 }}>🐃</Text>
                                <Text style={[s.milkBtnText, milkType === 'buffalo' && { color: '#fff' }]}>Buffalo</Text>
                                {milkType === 'buffalo' && <Check size={12} color="#fff" />}
                            </Pressable>
                        )}
                    </View>

                    {/* Input fields inline */}
                    <View style={s.fieldsRow}>
                        <View style={s.fieldBox}>
                            <Text style={s.fieldLabel}>Milk (L)</Text>
                            <TextInput
                                style={s.fieldInput}
                                value={milkQty}
                                onChangeText={setMilkQty}
                                keyboardType="decimal-pad"
                                placeholder="0.0"
                                placeholderTextColor={colors.mutedForeground}
                                editable={!isZero}
                            />
                        </View>
                        {selectedCustomer?.priceBasis !== 'rate' && (
                            <View style={s.fieldBox}>
                                <Text style={s.fieldLabel}>Fat</Text>
                                <TextInput
                                    style={s.fieldInput}
                                    value={fatValue}
                                    onChangeText={setFatValue}
                                    keyboardType="decimal-pad"
                                    placeholder="0.0"
                                    placeholderTextColor={colors.mutedForeground}
                                />
                            </View>
                        )}
                        <View style={s.fieldBox}>
                            <Text style={s.fieldLabel}>Rate ₹</Text>
                            <TextInput
                                style={s.fieldInput}
                                value={isZero ? '0' : rateValue}
                                onChangeText={setRateValue}
                                keyboardType="decimal-pad"
                                placeholder="0.00"
                                placeholderTextColor={colors.mutedForeground}
                                editable={!isZero}
                            />
                        </View>
                    </View>

                    {/* Actions */}
                    <View style={s.actionsRow}>
                        <Pressable
                            style={[s.zeroToggle, isZero && { backgroundColor: colors.destructive, borderColor: colors.destructive }]}
                            onPress={() => setIsZero(!isZero)}
                        >
                            <CircleDot size={13} color={isZero ? '#fff' : colors.mutedForeground} />
                            <Text style={[s.zeroText, isZero && { color: '#fff' }]}>Zero</Text>
                        </Pressable>
                        <Pressable
                            style={[s.saveEntryBtn, saving && { opacity: 0.5 }]}
                            onPress={handleSaveEntry}
                            disabled={saving}
                        >
                            {saving ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <Text style={s.saveEntryText}>✓ Save Entry</Text>
                            )}
                        </Pressable>
                    </View>
                </View>

                {/* ── Entries Table ── */}
                <View style={s.tableWrap}>
                    <View style={s.tableBar}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                            <FileText size={13} color={colors.primary} />
                            <Text style={s.tableBarTitle}>Entries</Text>
                            <View style={s.badge}><Text style={s.badgeText}>{collections.length}</Text></View>
                        </View>
                        <Pressable style={s.pdfBtn} onPress={handleExportPdf}>
                            <Download size={12} color="#fff" />
                            <Text style={s.pdfBtnText}>PDF</Text>
                        </Pressable>
                    </View>

                    <View style={s.tHead}>
                        <Text style={[s.tHeadText, s.entryCell1]}>Code</Text>
                        <Text style={[s.tHeadText, s.entryCell2]}>Milk</Text>
                        <Text style={[s.tHeadText, s.entryCell2]}>Fat</Text>
                        <Text style={[s.tHeadText, s.entryCell2]}>Rate</Text>
                        <Text style={[s.tHeadText, s.entryCell3]}>Amt</Text>
                        <View style={{ width: 26 }} />
                    </View>

                    {historyLoading && collections.length === 0 ? (
                        <View style={s.emptyBox}><ActivityIndicator color={colors.primary} /></View>
                    ) : collections.length === 0 ? (
                        <View style={s.emptyBox}>
                            <Droplets size={24} color={colors.border} />
                            <Text style={s.emptyText}>No entries yet</Text>
                        </View>
                    ) : (
                        <>
                            {collections.map((item, index) => (
                                <View key={item._id}>{renderCollectionItem({ item, index })}</View>
                            ))}
                            <View style={s.tFootRow}>
                                <Text style={[s.tFootText, s.entryCell1]}>Total ({collections.length})</Text>
                                <Text style={[s.tFootText, s.entryCell2]}>{historyTotals.quantity.toFixed(1)}</Text>
                                <Text style={[s.tFootText, s.entryCell2]}></Text>
                                <Text style={[s.tFootText, s.entryCell2]}></Text>
                                <Text style={[s.tFootText, s.entryCell3, { color: colors.primary }]}>₹{historyTotals.amount.toFixed(0)}</Text>
                                <View style={{ width: 26 }} />
                            </View>
                        </>
                    )}
                </View>

                <View style={{ height: 16 }} />
            </ScrollView>

            {/* ── Modals ── */}
            <Modal visible={showDateModal} animationType="slide" transparent onRequestClose={() => setShowDateModal(false)}>
                <View style={s.modalOverlay}>
                    <Pressable style={{ flex: 1 }} onPress={() => setShowDateModal(false)} />
                    <View style={s.modalSheet}>
                        <View style={s.modalHandle} />
                        <View style={s.modalHeader}>
                            <Text style={s.modalTitle}>Select Date</Text>
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
                            <Text style={s.modalTitle}>Select Customer</Text>
                            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                                <Pressable onPress={() => { setShowCustomerModal(false); setEditingCustomer(null); setShowAddCustomer(true); }} style={s.addCustBtn}>
                                    <Plus size={14} color="#fff" />
                                    <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>New</Text>
                                </Pressable>
                                <Pressable onPress={() => setShowCustomerModal(false)}><X size={18} color={colors.foreground} /></Pressable>
                            </View>
                        </View>

                        <View style={s.searchRow}>
                            <Search size={14} color={colors.mutedForeground} />
                            <TextInput
                                style={s.searchInput}
                                value={customerSearch}
                                onChangeText={setCustomerSearch}
                                placeholder="Search name or code..."
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

            <SuccessModal isVisible={alertVisible} title={alertTitle} message={alertMessage} onClose={() => setAlertVisible(false)} />
            <ConfirmationModal visible={confirmVisible} title={confirmData.title} message={confirmData.message} onConfirm={confirmData.onConfirm} onClose={() => setConfirmVisible(false)} />
        </View>
    );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: 6, gap: 3 },

    // Top controls
    topControls: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
    dateBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
    dateText: { fontSize: 12, fontWeight: '600', color: colors.foreground },

    // Shift
    shiftRow: { flexDirection: 'row', borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
    shiftBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 6, backgroundColor: colors.card },
    shiftBtnActive: { backgroundColor: colors.primary },
    shiftBtnText: { fontSize: 12, fontWeight: '700', color: colors.foreground },
    shiftBtnTextActive: { color: '#fff' },

    // Summary
    summaryBar: { flexDirection: 'row', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, paddingVertical: 8 },
    summaryCell: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
    summaryVal: { fontSize: 14, fontWeight: '800', color: colors.foreground },
    summaryLbl: { fontSize: 9, color: colors.mutedForeground, fontWeight: '500' },
    summaryDivider: { width: 1, backgroundColor: colors.border, marginVertical: 2 },

    // Customer
    customerBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, padding: 8, gap: 8 },
    customerBadge: { width: 34, height: 34, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
    customerBadgeText: { fontSize: 12, fontWeight: '800', color: '#fff' },
    customerName: { fontSize: 13, fontWeight: '700', color: colors.foreground },
    customerMeta: { fontSize: 10, color: colors.mutedForeground, marginTop: 1 },

    // Entry card
    entryCard: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, padding: 8 },
    milkRow: { flexDirection: 'row', gap: 4, marginBottom: 6 },
    milkBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 7, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
    milkBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    milkBtnText: { fontSize: 12, fontWeight: '700', color: colors.foreground },

    fieldsRow: { flexDirection: 'row', gap: 5 },
    fieldBox: { flex: 1 },
    fieldLabel: { fontSize: 9, fontWeight: '600', color: colors.mutedForeground, marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
    fieldInput: { borderWidth: 1, borderColor: colors.border, paddingHorizontal: 6, paddingVertical: 5, fontSize: 15, fontWeight: '700', color: colors.foreground, backgroundColor: colors.background, textAlign: 'center' },

    actionsRow: { flexDirection: 'row', gap: 5, marginTop: 6 },
    zeroToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
    zeroText: { fontSize: 11, fontWeight: '600', color: colors.mutedForeground },
    saveEntryBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8, backgroundColor: colors.primary },
    saveEntryText: { fontSize: 13, fontWeight: '800', color: '#fff' },

    // Table
    tableWrap: { borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
    tableBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 5, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
    tableBarTitle: { fontSize: 12, fontWeight: '700', color: colors.foreground },
    badge: { backgroundColor: colors.primary, paddingHorizontal: 5, paddingVertical: 0 },
    badgeText: { fontSize: 9, fontWeight: '800', color: '#fff' },
    pdfBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.primary, paddingHorizontal: 8, paddingVertical: 4 },
    pdfBtnText: { fontSize: 10, fontWeight: '700', color: '#fff' },

    tHead: { flexDirection: 'row', backgroundColor: isDark ? colors.muted : '#eef2f7', paddingVertical: 5, paddingHorizontal: 6, alignItems: 'center' },
    tHeadText: { fontSize: 9, fontWeight: '700', color: colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 0.3, textAlign: 'center' },

    entryRow: { flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 6, alignItems: 'center', borderBottomWidth: 0.5, borderBottomColor: colors.border },
    entryCell1: { flex: 1.3 },
    entryCell2: { flex: 0.7, textAlign: 'center' },
    entryCell3: { flex: 0.9, textAlign: 'right' },
    entryCellText: { fontSize: 11, color: colors.foreground },
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
    searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background, paddingHorizontal: 8, marginHorizontal: 6, marginBottom: 4, gap: 5, borderWidth: 1, borderColor: colors.border },
    searchInput: { flex: 1, paddingVertical: 6, fontSize: 12, color: colors.foreground },

    // Customer list
    custListItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: colors.border },
    custListAvatar: { width: 30, height: 30, backgroundColor: colors.primary + '18', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.primary + '30' },
    custListAvatarText: { fontSize: 11, fontWeight: '800', color: colors.primary },
    custListName: { fontSize: 12, fontWeight: '600', color: colors.foreground },
    custListSub: { fontSize: 10, color: colors.mutedForeground },

    miniIconBtn: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
    addCustBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.primary, paddingHorizontal: 8, paddingVertical: 4 },
});
