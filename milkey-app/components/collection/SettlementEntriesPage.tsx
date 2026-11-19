import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ArrowLeft, Search } from 'lucide-react-native';
import { router, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Pressable } from '@/components/ui/HapticPressable';
import { TextInput } from '@/components/ui/HapticTextInput';
import { useTheme } from '@/hooks/useTheme';
import { paymentsApi, type Payment } from '@/lib/milkeyApi';
import { settlementCollectionEntries } from '@/lib/settlementCollectionEntries';

const dateText = (value?: string) => {
    const date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString('en-GB') : '-';
};
const money = (value?: number | null) => value == null ? '--' : `₹${value.toFixed(2)}`;
const num = (value?: number | null, digits = 2) => value == null ? '--' : value.toFixed(digits);

export default function SettlementEntriesPage({ paymentId }: { paymentId: string }) {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const [payment, setPayment] = useState<Payment | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const s = styles(colors);

    const load = useCallback(async (refresh = false) => {
        if (refresh) setRefreshing(true); else setLoading(true);
        setError('');
        try {
            const response = await paymentsApi.getById(paymentId);
            if (!response.success || !response.response) throw new Error(response.message || 'Unable to load settlement entries.');
            setPayment(response.response);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Unable to load settlement entries.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [paymentId]);

    useEffect(() => { void load(); }, [load]);
    const data = useMemo(() => payment ? settlementCollectionEntries(payment) : null, [payment]);
    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return (data?.rows || []).filter(row => !q || [row.quantity, row.rate, row.shift].some(value => String(value ?? '').toLowerCase().includes(q)));
    }, [data, search]);

    return <View style={[s.container, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={s.header}>
            <Pressable accessibilityRole="button" accessibilityLabel="Back to edit payment" onPress={() => router.back()} style={s.backBtn}><ArrowLeft size={20} color={colors.foreground} /></Pressable>
            <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={s.headerTitle}>{payment?.farmer?.name || 'Settlement entries'}{payment?.farmer?.code ? ` (${payment.farmer.code})` : ''}</Text>
                <Text style={s.headerSub}>{payment ? `${dateText(payment.periodStart)} → ${dateText(payment.periodEnd)} · ${data?.rows.length ?? 0} entries` : 'Settlement entries'}</Text>
            </View>
        </View>
        {loading ? <View style={s.center}><ActivityIndicator color={colors.primary} /><Text style={s.muted}>Loading settlement entries...</Text></View>
            : error ? <View style={s.center}><Text style={{ color: colors.destructive, textAlign: 'center' }}>{error}</Text><Pressable accessibilityRole="button" onPress={() => void load()}><Text style={{ color: colors.primary, fontWeight: '700' }}>Retry</Text></Pressable></View>
            : <>
                <View style={s.summaryBar}>
                    <View style={s.summaryItem}><Text style={s.summaryLabel}>{data?.snapshot ? 'Total Qty' : 'Available Qty'}</Text><Text style={s.summaryValue}>{data?.quantity == null ? '--' : `${num(data.quantity)} L`}</Text></View>
                    <View style={s.summaryItem}><Text style={s.summaryLabel}>{data?.snapshot ? 'Total Amount' : 'Available Amount'}</Text><Text style={[s.summaryValue, { color: colors.primary }]}>{money(data?.amount)}</Text>{data?.bonus != null && data.bonus > 0 && <Text style={{ fontSize: 9, fontWeight: '700', color: colors.primary, marginTop: 2 }}>incl. bonus {money(data.bonus)}</Text>}</View>
                </View>
                <Text style={s.notice}>{data?.snapshot ? 'Entries saved with this settlement.' : 'Older linked entries as they exist now; entries may have changed or be missing.'}</Text>
                <View style={s.searchRow}><Search size={14} color={colors.mutedForeground} /><TextInput style={s.searchInput} placeholder="Search qty/rate/shift" value={search} onChangeText={setSearch} placeholderTextColor={colors.mutedForeground} /></View>
                <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: Math.max(insets.bottom, 24), flexGrow: 1 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />}>
                    {filtered.length === 0 ? <View style={s.center}><Text style={s.muted}>{data?.rows.length ? 'No matching entries.' : 'No linked entries available.'}</Text></View> :
                        <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ flexGrow: 1 }}>
                            <View style={s.table}>
                                <View style={s.tableHeader}>{[['Date', 1], ['Shift', 0.6], ['Qty', 0.7], ['Fat', 0.7], ['SNF', 0.7], ['Rate', 0.7], ['Bonus', 0.7], ['Amt', 0.9]].map(([label, flex]) => <Text key={String(label)} style={[s.th, { flex: Number(flex) }]}>{label}</Text>)}</View>
                                {filtered.map((row, index) => <View key={`${row.id}-${index}`} style={s.tr}>
                                    <Text style={[s.td, { flex: 1 }]}>{dateText(row.date)}</Text><Text style={[s.td, { flex: 0.6, textTransform: 'capitalize' }]}>{row.shift || '-'}</Text>
                                    <Text style={[s.td, { flex: 0.7 }]}>{num(row.quantity)}</Text><Text style={[s.td, { flex: 0.7 }]}>{num(row.fat, 1)}</Text><Text style={[s.td, { flex: 0.7 }]}>{num(row.snf, 1)}</Text>
                                    <Text style={[s.td, { flex: 0.7 }]}>{money(row.rate)}</Text><Text style={[s.td, { flex: 0.7 }]}>{money(row.bonusAmount)}</Text><Text style={[s.td, { flex: 0.9, fontWeight: '700', color: colors.primary }]}>{money(row.amount)}</Text>
                                </View>)}
                            </View>
                        </ScrollView>}
                </ScrollView>
            </>}
    </View>;
}

const styles = (colors: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.card },
    backBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.muted },
    headerTitle: { fontSize: 15, fontWeight: '800', color: colors.foreground }, headerSub: { fontSize: 11, color: colors.mutedForeground, marginTop: 2 },
    summaryBar: { flexDirection: 'row', gap: 12, padding: 12, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
    summaryItem: { flex: 1, backgroundColor: colors.background, borderWidth: 1.2, borderColor: '#9CA3AF', borderRadius: 8, padding: 10, alignItems: 'center' },
    summaryLabel: { fontSize: 10, fontWeight: '600', color: colors.mutedForeground }, summaryValue: { fontSize: 14, fontWeight: '800', color: colors.foreground, marginTop: 4 },
    notice: { fontSize: 11, color: colors.mutedForeground, marginHorizontal: 12, marginTop: 8 },
    searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 12, backgroundColor: colors.card, borderWidth: 1.2, borderColor: '#9CA3AF', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
    searchInput: { flex: 1, fontSize: 13, color: colors.foreground, padding: 0 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 }, muted: { fontSize: 13, color: colors.mutedForeground },
    table: { flexGrow: 1, minWidth: 550, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 8, overflow: 'hidden' },
    tableHeader: { flexDirection: 'row', backgroundColor: colors.primary, paddingVertical: 8, paddingHorizontal: 6 }, th: { fontSize: 11, fontWeight: '700', color: '#fff', textAlign: 'center' },
    tr: { flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 6, borderTopWidth: 1, borderTopColor: colors.border, alignItems: 'center' }, td: { fontSize: 11, color: colors.foreground, textAlign: 'center' },
});
