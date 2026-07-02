import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Pressable,
    ActivityIndicator,
    RefreshControl,
    TextInput,
    Modal,
    KeyboardAvoidingView,
    Platform,
    ToastAndroid,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { ArrowLeft, Trash2, Edit2, X, Save, Calendar as CalendarIcon } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { sellingEntriesApi, SellingEntry } from '@/lib/milkeyApi';
import { SuccessModal } from '@/components/SuccessModal';
import { ConfirmationModal } from '@/components/ConfirmationModal';

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
            const p: any = { memberId, limit: 500 };
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
        entries.forEach((e) => {
            liters += Number(e.morningQuantity || 0) + Number(e.eveningQuantity || 0);
            amount += Number(e.amount || 0);
        });
        return { liters, amount, count: entries.length };
    }, [entries]);

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
            ) : entries.length === 0 ? (
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

                    {entries.map((e) => {
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
                                    {e.isPaid ? (
                                        <Text style={{ fontSize: 10, color: colors.success, marginTop: 2 }}>PAID</Text>
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
});