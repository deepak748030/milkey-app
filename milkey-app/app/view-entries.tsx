import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, Modal, KeyboardAvoidingView, Platform, ToastAndroid } from 'react-native';
import { Pressable } from '@/components/ui/HapticPressable';
import { TextInput } from '@/components/ui/HapticTextInput';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { ArrowLeft, Trash2, Edit2, X, Save, Calendar as CalendarIcon, Download, Share2, Zap } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { sellingEntriesApi, SellingEntry } from '@/lib/milkeyApi';
import { SuccessModal } from '@/components/SuccessModal';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { Calendar } from '@/components/Calendar';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';

// Simple DD/MM/YYYY formatter used across the screen
const formatDate = (iso?: string) => {
    if (!iso) return '-';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '-';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
};

// Local YYYY-MM-DD string (Quick entry default date)
const toISODate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
};

// User passes ISO-ish dates (YYYY-MM-DD) through params. Format them for header.
const prettyPeriod = (start?: string, end?: string) => {
    const s = start ? formatDate(start) : '';
    const e = end ? formatDate(end) : 'Today';
    if (!s && !e) return 'All time';
    if (!s) return `Till ${e}`;
    return `${s} → ${e}`;
};

export default function ViewEntriesScreen() {
    const insets = useSafeAreaInsets();
    const { colors } = useTheme();
    const params = useLocalSearchParams<{
        memberId?: string;
        memberName?: string;
        startDate?: string;
        endDate?: string;
        rate?: string;
    }>();

    const memberId = String(params.memberId || '');
    const memberName = String(params.memberName || 'Member');
    const startDate = params.startDate ? String(params.startDate) : '';
    const endDate = params.endDate ? String(params.endDate) : '';
    const defaultRate = params.rate ? String(params.rate) : '';

    const [entries, setEntries] = useState<SellingEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Edit modal state
    const [editVisible, setEditVisible] = useState(false);
    const [editing, setEditing] = useState<SellingEntry | null>(null);
    const [editMorn, setEditMorn] = useState('');
    const [editEve, setEditEve] = useState('');
    const [editRate, setEditRate] = useState('');
    const [editNotes, setEditNotes] = useState('');
    const [saving, setSaving] = useState(false);
    const [pdfBusy, setPdfBusy] = useState<null | 'download' | 'share'>(null);

    // Quick entry modal state (single member, isi page se)
    const [quickVisible, setQuickVisible] = useState(false);
    const [quickDate, setQuickDate] = useState('');
    const [quickMorn, setQuickMorn] = useState('');
    const [quickEve, setQuickEve] = useState('');
    const [quickRate, setQuickRate] = useState('');
    const [quickSaving, setQuickSaving] = useState(false);
    const [quickDatePicker, setQuickDatePicker] = useState(false);
    const [quickTempDate, setQuickTempDate] = useState<Date | null>(new Date());

    // Alert + confirm modals (reused from the app's shared components)
    const [alertVisible, setAlertVisible] = useState(false);
    const [alertTitle, setAlertTitle] = useState('');
    const [alertMessage, setAlertMessage] = useState('');
    const [confirmVisible, setConfirmVisible] = useState(false);
    const [confirmTitle, setConfirmTitle] = useState('');
    const [confirmMessage, setConfirmMessage] = useState('');
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

    const showAlert = (title: string, message: string) => {
        setAlertTitle(title);
        setAlertMessage(message);
        setAlertVisible(true);
    };

    const toast = (msg: string) => {
        if (Platform.OS === 'android') ToastAndroid.show(msg, ToastAndroid.SHORT);
    };

    const fetchEntries = useCallback(async () => {
        if (!memberId) {
            setError('Missing member — please open this page from the Payment tab.');
            setLoading(false);
            return;
        }
        setError(null);
        try {
            const p: any = { memberId, limit: 10 };
            if (startDate) p.startDate = startDate;
            if (endDate) p.endDate = endDate;
            const res = await sellingEntriesApi.getAll(p);
            if (res.success && res.response) {
                setEntries(res.response.data || []);
            } else {
                setEntries([]);
                setError(res.message || 'Failed to load entries');
            }
        } catch (e: any) {
            setError(e?.message || 'Failed to load entries');
            setEntries([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [memberId, startDate, endDate]);

    useEffect(() => {
        setLoading(true);
        fetchEntries();
    }, [fetchEntries]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchEntries();
    };

    // Totals shown in the summary card
    const totals = useMemo(() => {
        let liters = 0;
        let amount = 0;
        const visible = entries.filter((e) => !e.isPaid);
        visible.forEach((e) => {
            liters += Number(e.morningQuantity || 0) + Number(e.eveningQuantity || 0);
            const amt = Number(e.amount || 0);
            amount += amt;
        });
        return { liters, amount, count: visible.length };
    }, [entries]);

    // Only unpaid entries are shown / exported
    const visibleEntries = useMemo(() => entries.filter((e) => !e.isPaid), [entries]);

    // ─── Edit ───
    const openEdit = (entry: SellingEntry) => {
        setEditing(entry);
        setEditMorn(entry.morningQuantity ? String(entry.morningQuantity) : '');
        setEditEve(entry.eveningQuantity ? String(entry.eveningQuantity) : '');
        setEditRate(entry.rate ? String(entry.rate) : defaultRate);
        setEditNotes(entry.notes || '');
        setEditVisible(true);
    };

    const closeEdit = () => {
        setEditVisible(false);
        setEditing(null);
    };

    const handleSaveEdit = async () => {
        if (!editing) return;
        const m = parseFloat(editMorn || '0');
        const e = parseFloat(editEve || '0');
        const r = parseFloat(editRate || '0');
        if ((!m || m < 0) && (!e || e < 0)) {
            showAlert('Error', 'Enter morning or evening quantity');
            return;
        }
        if (!r || r < 0 || Number.isNaN(r)) {
            showAlert('Error', 'Enter a valid rate');
            return;
        }
        setSaving(true);
        try {
            const res = await sellingEntriesApi.update(editing._id, {
                morningQuantity: Number.isNaN(m) ? 0 : Math.max(0, m),
                eveningQuantity: Number.isNaN(e) ? 0 : Math.max(0, e),
                rate: r,
                notes: editNotes,
            });
            if (res.success) {
                toast('Entry updated');
                closeEdit();
                fetchEntries();
            } else {
                showAlert('Error', res.message || 'Failed to update entry');
            }
        } catch (err: any) {
            showAlert('Error', err?.message || 'Failed to update entry');
        } finally {
            setSaving(false);
        }
    };

    // ─── Delete ───
    const askDelete = (id: string) => {
        setPendingDeleteId(id);
        setConfirmTitle('Delete Entry');
        setConfirmMessage('This will permanently remove this milk entry and update the member balance. Continue?');
        setConfirmVisible(true);
    };

    const handleConfirmDelete = async () => {
        const id = pendingDeleteId;
        setConfirmVisible(false);
        setPendingDeleteId(null);
        if (!id) return;
        try {
            const res = await sellingEntriesApi.delete(id);
            if (res.success) {
                toast('Entry deleted');
                setEntries((prev) => prev.filter((e) => e._id !== id));
            } else {
                showAlert('Error', res.message || 'Failed to delete entry');
            }
        } catch (err: any) {
            showAlert('Error', err?.message || 'Failed to delete entry');
        }
    };

    // ─── Quick entry (yahi member, isi page se) ───
    const openQuick = () => {
        setQuickDate(toISODate(new Date()));
        setQuickMorn('');
        setQuickEve('');
        setQuickRate(defaultRate || '');
        setQuickVisible(true);
    };

    const handleQuickDateSelect = (date: Date | null) => {
        if (date) {
            setQuickDate(toISODate(date));
            setQuickTempDate(date);
        }
        setQuickDatePicker(false);
    };

    const handleQuickSave = async () => {
        const m = parseFloat(quickMorn || '0') || 0;
        const e = parseFloat(quickEve || '0') || 0;
        const r = parseFloat(quickRate || '0');
        if (!quickDate) {
            showAlert('Error', 'Select a date');
            return;
        }
        if (m <= 0 && e <= 0) {
            showAlert('Error', 'Enter quantity (L) for Morning or Evening');
            return;
        }
        if (!r || r <= 0 || Number.isNaN(r)) {
            showAlert('Error', 'Enter a valid rate');
            return;
        }
        setQuickSaving(true);
        try {
            const res = await sellingEntriesApi.create({
                memberId,
                date: quickDate,
                rate: r,
                morningQuantity: Math.max(0, m),
                eveningQuantity: Math.max(0, e),
            });
            if (res.success) {
                toast('Entry added');
                setQuickVisible(false);
                fetchEntries();
            } else {
                showAlert('Error', res.message || 'Failed to add entry');
            }
        } catch (err: any) {
            showAlert('Error', err?.message || 'Failed to add entry');
        } finally {
            setQuickSaving(false);
        }
    };

    // ─── PDF (Download / Share) ───
    const buildPdfHtml = () => {
        const rows = visibleEntries.map((e) => {
            const qty = Number(e.morningQuantity || 0) + Number(e.eveningQuantity || 0);
            const amt = Number(e.amount || 0);
            return `
                <tr>
                    <td>${formatDate(e.date)}</td>
                    <td style="text-align:center">${e.morningQuantity > 0 ? Number(e.morningQuantity).toFixed(2) : '-'}</td>
                    <td style="text-align:center">${e.eveningQuantity > 0 ? Number(e.eveningQuantity).toFixed(2) : '-'}</td>
                    <td style="text-align:center">${qty.toFixed(2)}</td>
                    <td style="text-align:right">₹${Number(e.rate || 0).toFixed(2)}</td>
                    <td style="text-align:right;font-weight:700">₹${amt.toFixed(2)}</td>
                </tr>`;
        }).join('');

        return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
            <style>
                *{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif}
                body{padding:20px;color:#111}
                h1{margin:0 0 4px 0;font-size:20px}
                .sub{color:#6b7280;font-size:12px;margin-bottom:14px}
                .cards{display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap}
                .card{flex:1;min-width:120px;border:1px solid #e5e7eb;border-radius:8px;padding:10px}
                .card .l{font-size:11px;color:#6b7280;text-transform:uppercase}
                .card .v{font-size:16px;font-weight:700;margin-top:2px}
                table{width:100%;border-collapse:collapse;font-size:12px}
                th,td{padding:8px 6px;border-bottom:1px solid #e5e7eb}
                th{background:#f3f4f6;text-align:left;font-size:11px;text-transform:uppercase;color:#374151}
                tfoot td{font-weight:700;background:#f9fafb;border-top:2px solid #111}
            </style></head><body>
            <h1>${memberName}</h1>
            <div class="sub">Period: ${prettyPeriod(startDate, endDate)} &nbsp;•&nbsp; Generated: ${formatDate(new Date().toISOString())}</div>
            <div class="cards">
                <div class="card"><div class="l">Entries</div><div class="v">${totals.count}</div></div>
                <div class="card"><div class="l">Total Qty (L)</div><div class="v">${totals.liters.toFixed(2)}</div></div>
                <div class="card"><div class="l">Total Amount</div><div class="v">₹${totals.amount.toFixed(2)}</div></div>
            </div>
            <table>
                <thead><tr>
                    <th>Date</th><th style="text-align:center">Morn (L)</th><th style="text-align:center">Eve (L)</th>
                    <th style="text-align:center">Qty (L)</th><th style="text-align:right">Rate</th>
                    <th style="text-align:right">Amount</th>
                </tr></thead>
                <tbody>${rows || '<tr><td colspan="6" style="text-align:center;padding:20px;color:#6b7280">No entries</td></tr>'}</tbody>
                <tfoot><tr>
                    <td colspan="3">Totals</td>
                    <td style="text-align:center">${totals.liters.toFixed(2)}</td>
                    <td></td>
                    <td style="text-align:right">₹${totals.amount.toFixed(2)}</td>
                </tr></tfoot>
            </table>
        </body></html>`;
    };

    const safeFileName = () =>
        `${memberName.replace(/[^a-zA-Z0-9]+/g, '_')}_entries_${new Date().toISOString().slice(0, 10)}.pdf`;

    const handleDownloadPdf = async () => {
        if (visibleEntries.length === 0) { showAlert('No data', 'Nothing to export'); return; }
        setPdfBusy('download');
        try {
            const { uri } = await Print.printToFileAsync({ html: buildPdfHtml() });
            const target = (FileSystem.documentDirectory || '') + safeFileName();
            try { await FileSystem.copyAsync({ from: uri, to: target }); } catch { /* fall back to uri */ }
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(target || uri, {
                    mimeType: 'application/pdf',
                    dialogTitle: `${memberName} - Save PDF`,
                    UTI: 'com.adobe.pdf',
                });
            } else {
                toast('PDF saved: ' + (target || uri));
            }
        } catch (err: any) {
            showAlert('Error', err?.message || 'Failed to generate PDF');
        } finally {
            setPdfBusy(null);
        }
    };

    const handleSharePdf = async () => {
        if (visibleEntries.length === 0) { showAlert('No data', 'Nothing to share'); return; }
        setPdfBusy('share');
        try {
            const { uri } = await Print.printToFileAsync({ html: buildPdfHtml() });
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri, {
                    mimeType: 'application/pdf',
                    dialogTitle: `${memberName} - Milk Entries`,
                    UTI: 'com.adobe.pdf',
                });
            } else {
                showAlert('Not supported', 'Sharing is not available on this device');
            }
        } catch (err: any) {
            showAlert('Error', err?.message || 'Failed to share PDF');
        } finally {
            setPdfBusy(null);
        }
    };

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* ── Custom header ── */}
            <View
                style={[
                    styles.header,
                    { paddingTop: insets.top + 8, backgroundColor: colors.card, borderBottomColor: colors.border },
                ]}
            >
                <Pressable onPress={() => router.back()} style={styles.headerBtn} hitSlop={8}>
                    <ArrowLeft size={20} color={colors.foreground} />
                </Pressable>
                <View style={{ flex: 1, marginLeft: 4 }}>
                    <Text style={[styles.headerTitle, { color: colors.foreground }]} numberOfLines={1}>
                        {memberName}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <CalendarIcon size={11} color={colors.mutedForeground} />
                        <Text style={[styles.headerSub, { color: colors.mutedForeground }]} numberOfLines={1}>
                            {prettyPeriod(startDate, endDate)}
                        </Text>
                    </View>
                </View>
            </View>

            {/* ── Summary card ── */}
            <View style={[styles.summary, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.summaryCell}>
                    <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Entries</Text>
                    <Text style={[styles.summaryVal, { color: colors.foreground }]}>{totals.count}</Text>
                </View>
                <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
                <View style={styles.summaryCell}>
                    <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Total Qty (L)</Text>
                    <Text style={[styles.summaryVal, { color: colors.foreground }]}>{totals.liters.toFixed(2)}</Text>
                </View>
                <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
                <View style={styles.summaryCell}>
                    <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Total Amount</Text>
                    <Text style={[styles.summaryVal, { color: colors.primary }]}>₹{totals.amount.toFixed(2)}</Text>
                </View>
            </View>

            {/* ── PDF actions ── */}
            <View style={styles.actionsRow}>
                <Pressable
                    onPress={handleDownloadPdf}
                    disabled={pdfBusy !== null}
                    style={[styles.pdfBtn, { backgroundColor: colors.primary, opacity: pdfBusy ? 0.7 : 1 }]}
                    hitSlop={4}
                >
                    {pdfBusy === 'download' ? (
                        <ActivityIndicator size="small" color={colors.white} />
                    ) : (
                        <>
                            <Download size={14} color={colors.white} />
                            <Text style={styles.pdfBtnText}>PDF</Text>
                        </>
                    )}
                </Pressable>
                <Pressable
                    onPress={handleSharePdf}
                    disabled={pdfBusy !== null}
                    style={[styles.pdfBtn, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.primary, opacity: pdfBusy ? 0.7 : 1 }]}
                    hitSlop={4}
                >
                    {pdfBusy === 'share' ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                        <>
                            <Share2 size={14} color={colors.primary} />
                            <Text style={[styles.pdfBtnText, { color: colors.primary }]}>Share</Text>
                        </>
                    )}
                </Pressable>
                <Pressable
                    onPress={openQuick}
                    style={[styles.pdfBtn, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.primary, marginLeft: 'auto' }]}
                    hitSlop={4}
                >
                    <Zap size={14} color={colors.primary} />
                    <Text style={[styles.pdfBtnText, { color: colors.primary }]}>Quick entry</Text>
                </Pressable>
            </View>

            {/* ── Body ── */}
            {loading ? (
                <View style={styles.centerBox}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={{ marginTop: 8, color: colors.mutedForeground }}>Loading entries…</Text>
                </View>
            ) : error ? (
                <View style={styles.centerBox}>
                    <Text style={{ color: colors.destructive, textAlign: 'center', paddingHorizontal: 24 }}>{error}</Text>
                    <Pressable
                        onPress={fetchEntries}
                        style={[styles.retryBtn, { backgroundColor: colors.primary }]}
                    >
                        <Text style={{ color: colors.white, fontWeight: '700' }}>Retry</Text>
                    </Pressable>
                </View>
            ) : visibleEntries.length === 0 ? (
                <View style={styles.centerBox}>
                    <Text style={{ color: colors.mutedForeground }}>No entries found for this period</Text>
                </View>
            ) : (
                <ScrollView
                    contentContainerStyle={{ padding: 12, paddingBottom: 32 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
                >
                    <View style={[styles.tableHeader, { backgroundColor: colors.muted }]}>
                        <Text style={[styles.th, { flex: 1.1, color: colors.mutedForeground }]}>Date</Text>
                        <Text style={[styles.th, { flex: 1, textAlign: 'center', color: colors.mutedForeground }]}>M / E</Text>
                        <Text style={[styles.th, { flex: 0.7, textAlign: 'center', color: colors.mutedForeground }]}>Rate</Text>
                        <Text style={[styles.th, { flex: 0.9, textAlign: 'right', color: colors.mutedForeground }]}>Amt</Text>
                        <Text style={[styles.th, { width: 68, textAlign: 'center', color: colors.mutedForeground }]}>Action</Text>
                    </View>

                    {visibleEntries.map((e) => {
                        const qty = Number(e.morningQuantity || 0) + Number(e.eveningQuantity || 0);
                        return (
                            <View
                                key={e._id}
                                style={[styles.tr, { backgroundColor: colors.card, borderColor: colors.border }]}
                            >
                                <View style={{ flex: 1.1 }}>
                                    <Text style={[styles.td, { color: colors.foreground, fontWeight: '600' }]}>
                                        {formatDate(e.date)}
                                    </Text>
                                    {e.entryCount && e.entryCount > 1 ? (
                                        <Text style={{ fontSize: 10, color: colors.primary, marginTop: 2 }}>
                                            {e.entryCount} entries
                                        </Text>
                                    ) : null}
                                </View>
                                <View style={{ flex: 1, alignItems: 'center' }}>
                                    <Text style={[styles.td, { color: colors.foreground }]}>
                                        {e.morningQuantity > 0 ? e.morningQuantity : '-'} + {e.eveningQuantity > 0 ? e.eveningQuantity : '-'}
                                    </Text>
                                    <Text style={{ fontSize: 10, color: colors.mutedForeground }}>
                                        Total {qty.toFixed(2)} L
                                    </Text>
                                </View>
                                <Text style={[styles.td, { flex: 0.7, textAlign: 'center', color: colors.foreground }]}>
                                    ₹{Number(e.rate || 0).toFixed(0)}
                                </Text>
                                <Text
                                    style={[styles.td, { flex: 0.9, textAlign: 'right', color: colors.primary, fontWeight: '700' }]}
                                >
                                    ₹{Number(e.amount || 0).toFixed(0)}
                                </Text>
                                <View style={{ width: 68, flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
                                    <Pressable
                                        onPress={() => openEdit(e)}
                                        style={[styles.iconBtn, { backgroundColor: colors.secondary }]}
                                        hitSlop={4}
                                    >
                                        <Edit2 size={14} color={colors.primary} />
                                    </Pressable>
                                    <Pressable
                                        onPress={() => askDelete(e._id)}
                                        style={[styles.iconBtn, { backgroundColor: colors.destructive + '15' }]}
                                        hitSlop={4}
                                    >
                                        <Trash2 size={14} color={colors.destructive} />
                                    </Pressable>
                                </View>
                            </View>
                        );
                    })}
                </ScrollView>
            )}

            {/* ── Edit modal ── */}
            <Modal visible={editVisible} transparent animationType="slide" onRequestClose={closeEdit} statusBarTranslucent>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={styles.modalOverlay}
                >
                    <Pressable style={{ flex: 1 }} onPress={closeEdit} />
                    <View
                        style={[
                            styles.modalSheet,
                            {
                                backgroundColor: colors.card,
                                paddingBottom: Math.max(insets.bottom, 12) + 8,
                            },
                        ]}
                    >
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Edit Entry</Text>
                            <Pressable onPress={closeEdit} hitSlop={8}>
                                <X size={20} color={colors.foreground} />
                            </Pressable>
                        </View>

                        {editing ? (
                            <View style={{ paddingHorizontal: 16, gap: 10 }}>
                                <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                                    {formatDate(editing.date)} • {memberName}
                                </Text>

                                <View style={{ flexDirection: 'row', gap: 10 }}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.label, { color: colors.mutedForeground }]}>Morning (L)</Text>
                                        <TextInput
                                            value={editMorn}
                                            onChangeText={setEditMorn}
                                            placeholder="0"
                                            placeholderTextColor={colors.mutedForeground}
                                            keyboardType="decimal-pad"
                                            style={[styles.input, { color: colors.foreground, backgroundColor: colors.input, borderColor: colors.border }]}
                                        />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.label, { color: colors.mutedForeground }]}>Evening (L)</Text>
                                        <TextInput
                                            value={editEve}
                                            onChangeText={setEditEve}
                                            placeholder="0"
                                            placeholderTextColor={colors.mutedForeground}
                                            keyboardType="decimal-pad"
                                            style={[styles.input, { color: colors.foreground, backgroundColor: colors.input, borderColor: colors.border }]}
                                        />
                                    </View>
                                </View>

                                <View>
                                    <Text style={[styles.label, { color: colors.mutedForeground }]}>Rate (₹/L)</Text>
                                    <TextInput
                                        value={editRate}
                                        onChangeText={setEditRate}
                                        placeholder="Rate"
                                        placeholderTextColor={colors.mutedForeground}
                                        keyboardType="decimal-pad"
                                        style={[styles.input, { color: colors.foreground, backgroundColor: colors.input, borderColor: colors.border }]}
                                    />
                                </View>

                                <View>
                                    <Text style={[styles.label, { color: colors.mutedForeground }]}>Notes (optional)</Text>
                                    <TextInput
                                        value={editNotes}
                                        onChangeText={setEditNotes}
                                        placeholder="Notes"
                                        placeholderTextColor={colors.mutedForeground}
                                        style={[styles.input, { color: colors.foreground, backgroundColor: colors.input, borderColor: colors.border }]}
                                    />
                                </View>

                                {/* Live preview of the new amount */}
                                <View style={[styles.preview, { backgroundColor: colors.secondary }]}>
                                    <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>New Amount</Text>
                                    <Text style={{ color: colors.primary, fontSize: 16, fontWeight: '700' }}>
                                        ₹
                                        {(
                                            ((parseFloat(editMorn || '0') || 0) + (parseFloat(editEve || '0') || 0)) *
                                            (parseFloat(editRate || '0') || 0)
                                        ).toFixed(2)}
                                    </Text>
                                </View>

                                <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                                    <Pressable
                                        onPress={closeEdit}
                                        style={[styles.btnGhost, { borderColor: colors.border }]}
                                    >
                                        <Text style={{ color: colors.foreground, fontWeight: '600' }}>Cancel</Text>
                                    </Pressable>
                                    <Pressable
                                        onPress={handleSaveEdit}
                                        disabled={saving}
                                        style={[styles.btnPrimary, { backgroundColor: colors.primary, opacity: saving ? 0.7 : 1 }]}
                                    >
                                        {saving ? (
                                            <ActivityIndicator size="small" color={colors.white} />
                                        ) : (
                                            <>
                                                <Save size={14} color={colors.white} />
                                                <Text style={{ color: colors.white, fontWeight: '700' }}>Save Changes</Text>
                                            </>
                                        )}
                                    </Pressable>
                                </View>
                            </View>
                        ) : null}
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* ── Quick entry modal ── */}
            <Modal visible={quickVisible} transparent animationType="slide" onRequestClose={() => setQuickVisible(false)} statusBarTranslucent>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={styles.modalOverlay}
                >
                    <Pressable style={{ flex: 1 }} onPress={() => setQuickVisible(false)} />
                    <View
                        style={[
                            styles.modalSheet,
                            { backgroundColor: colors.card, paddingBottom: Math.max(insets.bottom, 12) + 8 },
                        ]}
                    >
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Quick Entry</Text>
                            <Pressable onPress={() => setQuickVisible(false)} hitSlop={8}>
                                <X size={20} color={colors.foreground} />
                            </Pressable>
                        </View>

                        <View style={{ paddingHorizontal: 16, gap: 10 }}>
                            <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{memberName}</Text>

                            {/* Date - default today, editable */}
                            <View>
                                <Text style={[styles.label, { color: colors.mutedForeground }]}>Date</Text>
                                <Pressable
                                    style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
                                    onPress={() => {
                                        setQuickTempDate(new Date(quickDate + 'T00:00:00'));
                                        setQuickDatePicker(true);
                                    }}
                                >
                                    <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: '600' }}>{formatDate(quickDate)}</Text>
                                    <CalendarIcon size={16} color={colors.mutedForeground} />
                                </Pressable>
                            </View>

                            {/* Morning + Evening qty */}
                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.label, { color: colors.mutedForeground }]}>Morning (L)</Text>
                                    <TextInput
                                        value={quickMorn}
                                        onChangeText={setQuickMorn}
                                        placeholder="0"
                                        placeholderTextColor={colors.mutedForeground}
                                        keyboardType="decimal-pad"
                                        style={[styles.input, { color: colors.foreground, backgroundColor: colors.input, borderColor: colors.border }]}
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.label, { color: colors.mutedForeground }]}>Evening (L)</Text>
                                    <TextInput
                                        value={quickEve}
                                        onChangeText={setQuickEve}
                                        placeholder="0"
                                        placeholderTextColor={colors.mutedForeground}
                                        keyboardType="decimal-pad"
                                        style={[styles.input, { color: colors.foreground, backgroundColor: colors.input, borderColor: colors.border }]}
                                    />
                                </View>
                            </View>

                            {/* Rate - member default, editable */}
                            <View>
                                <Text style={[styles.label, { color: colors.mutedForeground }]}>Rate (₹/L)</Text>
                                <TextInput
                                    value={quickRate}
                                    onChangeText={setQuickRate}
                                    placeholder={defaultRate || '50'}
                                    placeholderTextColor={colors.mutedForeground}
                                    keyboardType="decimal-pad"
                                    style={[styles.input, { color: colors.foreground, backgroundColor: colors.input, borderColor: colors.border }]}
                                />
                                {defaultRate ? (
                                    <Text style={{ fontSize: 10, color: colors.mutedForeground, marginTop: 2 }}>
                                        Default ₹{defaultRate}/L · editable
                                    </Text>
                                ) : null}
                            </View>

                            {/* Live amount preview */}
                            <View style={[styles.preview, { backgroundColor: colors.secondary }]}>
                                <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Amount</Text>
                                <Text style={{ color: colors.primary, fontSize: 16, fontWeight: '700' }}>
                                    ₹{(((parseFloat(quickMorn || '0') || 0) + (parseFloat(quickEve || '0') || 0)) * (parseFloat(quickRate || '0') || 0)).toFixed(2)}
                                </Text>
                            </View>

                            <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                                <Pressable
                                    onPress={() => setQuickVisible(false)}
                                    style={[styles.btnGhost, { borderColor: colors.border }]}
                                >
                                    <Text style={{ color: colors.foreground, fontWeight: '600' }}>Cancel</Text>
                                </Pressable>
                                <Pressable
                                    onPress={handleQuickSave}
                                    disabled={quickSaving}
                                    style={[styles.btnPrimary, { backgroundColor: colors.primary, opacity: quickSaving ? 0.7 : 1 }]}
                                >
                                    {quickSaving ? (
                                        <ActivityIndicator size="small" color={colors.white} />
                                    ) : (
                                        <>
                                            <Zap size={14} color={colors.white} />
                                            <Text style={{ color: colors.white, fontWeight: '700' }}>Add Entry</Text>
                                        </>
                                    )}
                                </Pressable>
                            </View>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* ── Quick entry date picker ── */}
            <Modal visible={quickDatePicker} transparent animationType="slide" onRequestClose={() => setQuickDatePicker(false)} statusBarTranslucent>
                <View style={styles.datePickerOverlay}>
                    <View style={[styles.datePickerModal, { backgroundColor: colors.card }]}>
                        <View style={[styles.datePickerHeader, { borderBottomColor: colors.border }]}>
                            <Text style={[styles.datePickerTitle, { color: colors.foreground }]}>Select Date</Text>
                            <Pressable onPress={() => setQuickDatePicker(false)}>
                                <X size={20} color={colors.foreground} />
                            </Pressable>
                        </View>
                        <View style={{ padding: 12 }}>
                            <Calendar onDateSelect={handleQuickDateSelect} selectedDate={quickTempDate} />
                        </View>
                    </View>
                </View>
            </Modal>

            <SuccessModal
                isVisible={alertVisible}
                onClose={() => setAlertVisible(false)}
                title={alertTitle}
                message={alertMessage}
            />

            <ConfirmationModal
                visible={confirmVisible}
                title={confirmTitle}
                message={confirmMessage}
                onConfirm={handleConfirmDelete}
                onClose={() => { setConfirmVisible(false); setPendingDeleteId(null); }}
                confirmText="Delete"
                cancelText="Cancel"
                confirmDestructive
            />
        </View>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingBottom: 12,
        borderBottomWidth: 1,
    },
    headerBtn: {
        width: 36,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 18,
    },
    headerTitle: { fontSize: 16, fontWeight: '700' },
    headerSub: { fontSize: 11 },

    summary: {
        margin: 12,
        marginBottom: 6,
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 10,
        borderWidth: 1,
        paddingVertical: 12,
    },
    summaryCell: { flex: 1, alignItems: 'center' },
    summaryDivider: { width: 1, height: 28 },
    summaryLabel: { fontSize: 11, marginBottom: 2 },
    summaryVal: { fontSize: 15, fontWeight: '700' },

    actionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        marginBottom: 6,
    },
    pill: {
        flex: 1,
        borderWidth: 1,
        borderRadius: 8,
        paddingVertical: 6,
        paddingHorizontal: 8,
        alignItems: 'center',
    },
    pillLabel: { fontSize: 10, textTransform: 'uppercase', fontWeight: '600' },
    pillVal: { fontSize: 13, fontWeight: '700', marginTop: 1 },
    pdfBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 8,
        minWidth: 68,
    },
    pdfBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },

    centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
    retryBtn: { marginTop: 12, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },

    tableHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 8,
        marginBottom: 6,
    },
    th: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },

    tr: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        borderRadius: 8,
        borderWidth: 1,
        marginBottom: 6,
    },
    td: { fontSize: 13 },
    iconBtn: { width: 28, height: 28, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
    modalSheet: {
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        paddingTop: 4,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    modalTitle: { fontSize: 17, fontWeight: '700' },

    label: { fontSize: 12, marginBottom: 4, fontWeight: '600' },
    input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
    preview: { marginTop: 4, padding: 12, borderRadius: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

    btnGhost: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
        borderWidth: 1,
    },
    btnPrimary: {
        flex: 1.4,
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 6,
    },

    datePickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    datePickerModal: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 20, overflow: 'hidden' },
    datePickerHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    datePickerTitle: { fontSize: 16, fontWeight: '600' },
});