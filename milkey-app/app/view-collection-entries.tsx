import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, Modal, Linking } from 'react-native';
import { Pressable } from '@/components/ui/HapticPressable';
import { TextInput } from '@/components/ui/HapticTextInput';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { ArrowLeft, Search, MoreVertical, Printer, Share2, Edit2, Trash2 } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { milkCollectionsApi, MilkCollection, printSettingsApi } from '@/lib/milkeyApi';
import { getAuthToken } from '@/lib/authStore';
import { TZ_OFFSET_MINUTES } from '@/lib/purchaseConstants';
import { getSlipLabels, getThermalSlipLabels } from '@/lib/printTranslations';
import { useBluetoothPrinter } from '@/hooks/useBluetoothPrinter';
import { SuccessModal } from '@/components/SuccessModal';

const formatDate = (iso?: string) => {
    if (!iso) return '-';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '-';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
};

const prettyPeriod = (start?: string, end?: string) => {
    const s = start ? formatDate(start) : '';
    const e = end ? formatDate(end) : 'Today';
    if (!s && !e) return 'All time';
    if (!s) return `Till ${e}`;
    return `${s} → ${e}`;
};

export default function ViewCollectionEntriesScreen() {
    const insets = useSafeAreaInsets();
    const { colors } = useTheme();
    const params = useLocalSearchParams<{
        farmerCode?: string;
        farmerName?: string;
        startDate?: string;
        endDate?: string;
    }>();

    const farmerCode = String(params.farmerCode || '');
    const farmerName = String(params.farmerName || farmerCode || 'Farmer');
    const startDate = params.startDate ? String(params.startDate) : '';
    const endDate = params.endDate ? String(params.endDate) : '';

    const [entries, setEntries] = useState<MilkCollection[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQty, setSearchQty] = useState('');
    // Row actions (same 3-dot menu the Collection screen rows use)
    const [actionEntry, setActionEntry] = useState<MilkCollection | null>(null);
    const { printText, isPrinting } = useBluetoothPrinter();
    const [printSettings, setPrintSettings] = useState<any>(null);
    const [alertVisible, setAlertVisible] = useState(false);
    const [alertTitle, setAlertTitle] = useState('');
    const [alertMessage, setAlertMessage] = useState('');
    const showAlert = useCallback((title: string, message: string) => {
        setAlertTitle(title);
        setAlertMessage(message);
        setAlertVisible(true);
    }, []);
    const [deleteTarget, setDeleteTarget] = useState<MilkCollection | null>(null);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        printSettingsApi.get()
            .then(res => { if (res.success && res.response) setPrintSettings(res.response); })
            .catch(() => { });
    }, []);

    const fetch = useCallback(async () => {
        if (!farmerCode) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const token = await getAuthToken();
            if (!token) { setLoading(false); return; }
            const res = await milkCollectionsApi.getAll({
                farmerCode,
                startDate: startDate || undefined,
                endDate: endDate || undefined,
                limit: 100,
                isPaid: false,
                tzOffsetMinutes: TZ_OFFSET_MINUTES,
            });
            if (res.success && res.response?.data) {
                setEntries(res.response.data);
            } else {
                setEntries([]);
            }
        } catch (e) {
            setEntries([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [farmerCode, startDate, endDate]);

    useEffect(() => { fetch(); }, [fetch]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetch();
    }, [fetch]);

    const totals = useMemo(() => {
        const qty = entries.reduce((s, e) => s + (e.quantity || 0), 0);
        const amt = entries.reduce((s, e) => s + (e.amount || 0), 0);
        // Bonus is already inside amt — show the split so it is visible here too
        const bonus = entries.reduce((s, e) => s + (Number((e as any).bonusAmount) || 0), 0);
        return { qty, amt, bonus };
    }, [entries]);

    const filtered = useMemo(() => {
        if (!searchQty.trim()) return entries;
        const q = searchQty.toLowerCase();
        return entries.filter(e =>
            String(e.quantity).includes(q) ||
            String(e.rate).includes(q) ||
            (e.shift || '').toLowerCase().includes(q)
        );
    }, [entries, searchQty]);

    // Thermal milk slip for one entry (bonus line only when the entry has a bonus)
    const buildSlip = useCallback((entry: MilkCollection) => {
        const t = getThermalSlipLabels();
        const dObj = new Date(entry.date);
        const dStr = `${String(dObj.getDate()).padStart(2, '0')}-${String(dObj.getMonth() + 1).padStart(2, '0')}-${String(dObj.getFullYear()).slice(-2)}`;
        let payload = '';
        payload += `[L]${t.code} : ${entry.farmerCode || '-'}\n`;
        payload += `[L]${t.name} : ${entry.purchaseFarmer?.name || farmerName}\n`;
        payload += `[L]${t.date} : ${dStr}[R]${t.shift} : ${entry.shift === 'morning' ? t.morningShort : t.eveningShort}\n`;
        payload += `[L]${t.fat} : ${(entry.fat || 0).toFixed(1)}[R]${t.snf} : ${((entry as any).snf || 0).toFixed(1)}\n`;
        payload += `[L]${t.qty} : ${Number(entry.quantity).toFixed(2)}[R]${t.rate} : ${Number(entry.rate).toFixed(1)}\n`;
        const bonus = Number((entry as any).bonusAmount) || 0;
        if (bonus > 0) {
            const bType = (entry as any).bonusType;
            const bRate = Number((entry as any).bonusRate) || 0;
            payload += `[L]Bonus : ${bType === 'percent' ? `${bRate}%` : bRate}[R]+${bonus.toFixed(2)}\n`;
        }
        payload += `[L]${t.amount} : ${Number(entry.amount).toFixed(2)}\n`;
        return payload;
    }, [farmerName]);

    const handlePrintEntry = useCallback(async (entry: MilkCollection) => {
        if (isPrinting) return;
        try {
            const ok = await printText(buildSlip(entry));
            if (!ok) showAlert('Print failed', 'Could not print. Open the printer scanner from the top bar and reconnect.');
        } catch {
            showAlert('Error', 'Print failed');
        }
    }, [buildSlip, isPrinting, printText, showAlert]);

    const handleShareEntry = useCallback((entry: MilkCollection) => {
        const t = getSlipLabels();
        const dateObj = new Date(entry.date);
        const dateStr = `${String(dateObj.getDate()).padStart(2, '0')}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getFullYear()).slice(-2)}`;
        const shiftStr = entry.shift === 'morning' ? t.morning : t.evening;
        const dairyLabel = (printSettings?.digitalSlipName || printSettings?.dairyName || t.dairy).trim();
        const bonus = Number((entry as any).bonusAmount) || 0;
        const bonusLine = bonus > 0 ? `\n${'Bonus'} - ₹${bonus.toFixed(2)}` : '';
        const message = `*${t.digitalMilkSlip}*\n${t.dairy} - ${dairyLabel}\n${t.code} - ${entry.farmerCode || '-'}\n${t.name} - ${entry.purchaseFarmer?.name || farmerName}\n${t.date} - ${dateStr}  ${t.shift} - ${shiftStr}\n${t.fat} - ${entry.fat || '-'}  ${t.snf} - ${(entry as any).snf || '-'}\n${t.rate} - ${entry.rate}  ${t.qty} - ${entry.quantity}${bonusLine}\n${t.amount} - ₹${entry.amount.toFixed(2)}`;
        const phone = (entry.purchaseFarmer?.mobile || '').replace(/\D/g, '');
        if (!phone) { showAlert('Error', 'No mobile number found'); return; }
        const whatsappPhone = phone.startsWith('91') ? phone : `91${phone}`;
        const encoded = encodeURIComponent(message);
        Linking.openURL(`whatsapp://send?phone=${whatsappPhone}&text=${encoded}`).catch(() => {
            Linking.openURL(`https://wa.me/${whatsappPhone}?text=${encoded}`).catch(() => showAlert('Error', 'WhatsApp not available'));
        });
    }, [farmerName, printSettings, showAlert]);

    // Edit = open the Collection screen with this entry loaded in the entry form
    const handleEditEntry = useCallback((entry: MilkCollection) => {
        router.push({
            pathname: '/(tabs)/purchase',
            params: { editEntryId: entry._id },
        } as any);
    }, []);

    const handleDeleteEntry = useCallback(async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            const res = await milkCollectionsApi.delete(deleteTarget._id);
            if (res.success) {
                setDeleteTarget(null);
                showAlert('Success', 'Entry deleted');
                fetch();
            } else {
                showAlert('Error', res.message || 'Failed to delete entry');
            }
        } catch {
            showAlert('Error', 'Failed to delete entry');
        } finally {
            setDeleting(false);
        }
    }, [deleteTarget, fetch, showAlert]);

    const s = styles(colors);

    return (
        <View style={[s.container, { paddingTop: insets.top }]}>
            <Stack.Screen options={{ headerShown: false }} />
            <View style={s.header}>
                <Pressable onPress={() => router.back()} style={s.backBtn}><ArrowLeft size={20} color={colors.foreground} /></Pressable>
                <View style={{ flex: 1 }}>
                    <Text style={s.headerTitle} numberOfLines={1}>{farmerName} ({farmerCode})</Text>
                    <Text style={s.headerSub}>{prettyPeriod(startDate, endDate)} • {entries.length} entries</Text>
                </View>
            </View>

            <View style={s.summaryBar}>
                <View style={s.summaryItem}><Text style={s.summaryLabel}>Total Qty</Text><Text style={s.summaryValue}>{totals.qty.toFixed(2)} L</Text></View>
                <View style={s.summaryItem}>
                    <Text style={s.summaryLabel}>Total Amount</Text>
                    <Text style={[s.summaryValue, { color: colors.primary }]}>₹{totals.amt.toFixed(2)}</Text>
                    {totals.bonus > 0 && (
                        <Text style={{ fontSize: 9, fontWeight: '700', color: colors.primary, marginTop: 2 }}>
                            incl. bonus ₹{totals.bonus.toFixed(2)}
                        </Text>
                    )}
                </View>
            </View>

            <View style={s.searchRow}>
                <Search size={14} color={colors.mutedForeground} />
                <TextInput
                    style={s.searchInput}
                    placeholder="Search qty/rate/shift"
                    value={searchQty}
                    onChangeText={setSearchQty}
                    placeholderTextColor={colors.mutedForeground}
                />
            </View>

            {loading ? (
                <View style={s.center}><ActivityIndicator color={colors.primary} /><Text style={s.muted}>Loading collection entries...</Text></View>
            ) : filtered.length === 0 ? (
                <View style={s.center}><Text style={s.muted}>No collection entries for this period</Text></View>
            ) : (
                <ScrollView
                    contentContainerStyle={{ padding: 12, paddingBottom: 24 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                >
                    <View style={s.table}>
                        <View style={s.tableHeader}>
                            <Text style={[s.th, { flex: 1 }]}>Date</Text>
                            <Text style={[s.th, { flex: 0.6 }]}>Shift</Text>
                            <Text style={[s.th, { flex: 0.7 }]}>Qty</Text>
                            <Text style={[s.th, { flex: 0.7 }]}>Fat</Text>
                            <Text style={[s.th, { flex: 0.7 }]}>Rate</Text>
                            <Text style={[s.th, { flex: 0.7 }]}>Bonus</Text>
                            <Text style={[s.th, { flex: 0.9 }]}>Amt</Text>
                            <View style={{ width: 24 }} />
                        </View>
                        {filtered.map((e) => (
                            <View key={e._id} style={s.tr}>
                                <Text style={[s.td, { flex: 1 }]}>{formatDate(e.date)}</Text>
                                <Text style={[s.td, { flex: 0.6, textTransform: 'capitalize' }]}>{e.shift || '-'}</Text>
                                <Text style={[s.td, { flex: 0.7 }]}>{(e.quantity || 0).toFixed(2)}</Text>
                                <Text style={[s.td, { flex: 0.7 }]}>{e.fat != null ? e.fat.toFixed(1) : '-'}</Text>
                                <Text style={[s.td, { flex: 0.7 }]}>₹{(e.rate || 0).toFixed(2)}</Text>
                                <Text style={[s.td, { flex: 0.7, color: Number((e as any).bonusAmount) > 0 ? colors.primary : colors.mutedForeground }]}>
                                    {Number((e as any).bonusAmount) > 0 ? `₹${Number((e as any).bonusAmount).toFixed(2)}` : '-'}
                                </Text>
                                <Text style={[s.td, { flex: 0.9, fontWeight: '700', color: colors.primary }]}>₹{(e.amount || 0).toFixed(2)}</Text>
                                <Pressable style={{ width: 24, alignItems: 'center', justifyContent: 'center' }} hitSlop={8} onPress={() => setActionEntry(e)}>
                                    <MoreVertical size={14} color={colors.mutedForeground} />
                                </Pressable>
                            </View>
                        ))}
                    </View>
                </ScrollView>
            )}
            {/* Row actions — same options as the Collection screen's 3-dot menu */}
            <Modal visible={!!actionEntry} transparent animationType="fade" onRequestClose={() => setActionEntry(null)}>
                <Pressable style={s.menuOverlay} onPress={() => setActionEntry(null)}>
                    <View style={[s.menuSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <View style={[s.menuHandle, { backgroundColor: colors.border }]} />
                        <Text style={[s.menuTitle, { color: colors.foreground }]}>Actions</Text>
                        {[
                            {
                                icon: <Printer size={18} color={colors.primary} />, label: 'Print', onPress: () => {
                                    if (!actionEntry) return;
                                    const e = actionEntry;
                                    setActionEntry(null);
                                    void handlePrintEntry(e);
                                }
                            },
                            {
                                icon: <Share2 size={18} color={colors.primary} />, label: 'Share Digital Slip', onPress: () => {
                                    if (!actionEntry) return;
                                    const e = actionEntry;
                                    setActionEntry(null);
                                    handleShareEntry(e);
                                }
                            },
                            {
                                icon: <Edit2 size={18} color={colors.primary} />, label: 'Edit', onPress: () => {
                                    if (!actionEntry) return;
                                    const e = actionEntry;
                                    setActionEntry(null);
                                    handleEditEntry(e);
                                }
                            },
                            {
                                icon: <Trash2 size={18} color={colors.destructive} />, label: 'Delete', color: colors.destructive, onPress: () => {
                                    const e = actionEntry;
                                    setActionEntry(null);
                                    if (e) setDeleteTarget(e);
                                }
                            },
                        ].map((action, i) => (
                            <Pressable
                                key={i}
                                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: i < 3 ? 0.5 : 0, borderBottomColor: colors.border }}
                                onPress={action.onPress}
                            >
                                {action.icon}
                                <Text style={{ fontSize: 15, fontWeight: '600', color: (action as any).color || colors.foreground }}>{action.label}</Text>
                            </Pressable>
                        ))}
                        <Pressable style={{ alignItems: 'center', paddingVertical: 14, marginTop: 4 }} onPress={() => setActionEntry(null)}>
                            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.mutedForeground }}>Cancel</Text>
                        </Pressable>
                    </View>
                </Pressable>
            </Modal>

            {/* Delete confirmation */}
            <Modal visible={!!deleteTarget} transparent animationType="fade" onRequestClose={() => setDeleteTarget(null)}>
                <View style={s.menuOverlayCentered}>
                    <View style={[s.confirmCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Text style={[s.confirmTitle, { color: colors.foreground }]}>Delete Entry</Text>
                        <Text style={[s.confirmMsg, { color: colors.mutedForeground }]}>
                            Delete this milk entry? Ye entry farmer ke totals se bhi hat jayegi.
                        </Text>
                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
                            <Pressable
                                style={[s.confirmBtn, { backgroundColor: colors.muted }]}
                                onPress={() => setDeleteTarget(null)}
                                disabled={deleting}
                            >
                                <Text style={{ color: colors.foreground, fontWeight: '700', fontSize: 14 }}>Cancel</Text>
                            </Pressable>
                            <Pressable
                                style={[s.confirmBtn, { backgroundColor: colors.destructive, opacity: deleting ? 0.6 : 1 }]}
                                onPress={handleDeleteEntry}
                                disabled={deleting}
                            >
                                {deleting
                                    ? <ActivityIndicator size="small" color="#fff" />
                                    : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Delete</Text>}
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>

            <SuccessModal
                isVisible={alertVisible}
                title={alertTitle}
                message={alertMessage}
                onClose={() => setAlertVisible(false)}
                autoClose={alertTitle === 'Success'}
            />
        </View>
    );
}

const styles = (colors: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.card },
    backBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.muted },
    headerTitle: { fontSize: 15, fontWeight: '800', color: colors.foreground },
    headerSub: { fontSize: 11, color: colors.mutedForeground, marginTop: 2 },
    summaryBar: { flexDirection: 'row', gap: 12, padding: 12, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
    summaryItem: { flex: 1, backgroundColor: colors.background, borderWidth: 1.2, borderColor: '#9CA3AF', borderRadius: 8, padding: 10, alignItems: 'center' },
    summaryLabel: { fontSize: 10, fontWeight: '600', color: colors.mutedForeground },
    summaryValue: { fontSize: 14, fontWeight: '800', color: colors.foreground, marginTop: 4 },
    searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 12, backgroundColor: colors.card, borderWidth: 1.2, borderColor: '#9CA3AF', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
    searchInput: { flex: 1, fontSize: 13, color: colors.foreground, padding: 0 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
    muted: { fontSize: 13, color: colors.mutedForeground },
    table: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 8, overflow: 'hidden' },
    tableHeader: { flexDirection: 'row', backgroundColor: colors.primary, paddingVertical: 8, paddingHorizontal: 6 },
    th: { fontSize: 11, fontWeight: '700', color: '#fff', textAlign: 'center' },
    tr: { flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 6, borderTopWidth: 1, borderTopColor: colors.border, alignItems: 'center' },
    td: { fontSize: 11, color: colors.foreground, textAlign: 'center' },

    menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    menuSheet: { borderTopLeftRadius: 18, borderTopRightRadius: 18, borderWidth: 1, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 20 },
    menuHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 8 },
    menuTitle: { fontSize: 15, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
    menuOverlayCentered: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: 24 },
    confirmCard: { width: '100%', maxWidth: 340, borderRadius: 14, borderWidth: 1, padding: 18, gap: 8 },
    confirmTitle: { fontSize: 16, fontWeight: '800' },
    confirmMsg: { fontSize: 13, lineHeight: 18 },
    confirmBtn: { flex: 1, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
