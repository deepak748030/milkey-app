import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { ArrowLeft, Search } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { milkCollectionsApi, MilkCollection } from '@/lib/milkeyApi';
import { getAuthToken } from '@/lib/authStore';

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
        return { qty, amt };
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
                <View style={s.summaryItem}><Text style={s.summaryLabel}>Total Amount</Text><Text style={[s.summaryValue, { color: colors.primary }]}>₹{totals.amt.toFixed(2)}</Text></View>
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
                            <Text style={[s.th, { flex: 0.9 }]}>Amt</Text>
                        </View>
                        {filtered.map((e) => (
                            <View key={e._id} style={s.tr}>
                                <Text style={[s.td, { flex: 1 }]}>{formatDate(e.date)}</Text>
                                <Text style={[s.td, { flex: 0.6, textTransform: 'capitalize' }]}>{e.shift || '-'}</Text>
                                <Text style={[s.td, { flex: 0.7 }]}>{(e.quantity || 0).toFixed(2)}</Text>
                                <Text style={[s.td, { flex: 0.7 }]}>{e.fat != null ? e.fat.toFixed(1) : '-'}</Text>
                                <Text style={[s.td, { flex: 0.7 }]}>₹{(e.rate || 0).toFixed(2)}</Text>
                                <Text style={[s.td, { flex: 0.9, fontWeight: '700', color: colors.primary }]}>₹{(e.amount || 0).toFixed(2)}</Text>
                            </View>
                        ))}
                    </View>
                </ScrollView>
            )}
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
});
