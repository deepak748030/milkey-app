import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Check, Droplets } from 'lucide-react-native';
import { Pressable } from '@/components/ui/HapticPressable';
import { DateRangePicker } from '@/components/DateRangePicker';
import { useTheme } from '@/hooks/useTheme';
import {
    clearPortalSession,
    getPortalSession,
    portalApi,
    PortalAdvanceCursor,
    PortalCollectionEntriesResult,
    PortalEntryRow,
} from '@/lib/portalAuth';

const dateParam = (value?: string) => value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '';
const numberText = (value: number | undefined, decimals = 2) => Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: decimals });
const money = (value: number | undefined) => `₹${numberText(value)}`;
const dateText = (value?: string) => {
    if (!value) return '--';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '--' : d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
};
const bonusText = (row: PortalEntryRow) => (
    Number(row.bonusAmount) > 0 ? money(row.bonusAmount) : '--'
);

const COLUMNS = [
    { title: 'Date', flex: 1.25 }, { title: 'Milk', flex: 0.65 },
    { title: 'FAT', flex: 0.5 }, { title: 'SNF', flex: 0.5 },
    { title: 'Rate', flex: 0.65 }, { title: 'Bonus', flex: 0.8 },
    { title: 'Amt', flex: 1 }, { title: 'Paid', flex: 0.55 },
];

export function PortalEntriesScreen({ selling = false }: { selling?: boolean }) {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams<{ startDate?: string; endDate?: string }>();
    const [startDate, setStartDate] = useState(() => dateParam(params.startDate));
    const [endDate, setEndDate] = useState(() => dateParam(params.endDate));
    const [ready, setReady] = useState(false);
    const [result, setResult] = useState<PortalCollectionEntriesResult | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState('');
    const [pageError, setPageError] = useState('');
    const generation = useRef(0);
    const loadMoreLock = useRef(false);

    useEffect(() => {
        let alive = true;
        void getPortalSession().then((session) => {
            if (!alive) return;
            if (!session) router.replace('/auth');
            else setReady(true);
        });
        return () => { alive = false; ++generation.current; };
    }, []);

    const load = useCallback(async (mode: 'initial' | 'refresh' | 'more', cursor?: PortalAdvanceCursor) => {
        const requestId = mode === 'more' ? generation.current : ++generation.current;
        if (mode === 'more') {
            if (!cursor || loadMoreLock.current) return;
            loadMoreLock.current = true;
            setLoadingMore(true);
            setPageError('');
        } else {
            loadMoreLock.current = false;
            setLoadingMore(false);
            setPageError('');
            setError('');
            if (mode === 'initial') { setLoading(true); setResult(null); }
            else setRefreshing(true);
        }
        const response = await (selling ? portalApi.getSellingEntries : portalApi.getCollectionEntries)({
            startDate: startDate || undefined,
            endDate: endDate || undefined,
            cursor: mode === 'more' ? cursor : undefined,
        });
        if (requestId !== generation.current) return;
        if (response.success && response.response) {
            const page = response.response;
            setResult((current) => {
                if (mode !== 'more' || !current) return page;
                const existing = new Set(current.entries.map((row) => row.id));
                return { ...page, entries: [...current.entries, ...page.entries.filter((row) => !existing.has(row.id))] };
            });
        } else if (response.status === 401 || response.code === 'INVALID_PORTAL_SESSION' || response.code === 'PORTAL_SESSION_REQUIRED') {
            await clearPortalSession();
            router.replace('/auth');
            return;
        } else if (mode === 'more') {
            setPageError(response.message || 'Could not load more entries.');
        } else {
            setResult(null);
            setError(response.message || 'Could not load collection entries.');
        }
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
        loadMoreLock.current = false;
    }, [startDate, endDate, selling]);

    useEffect(() => {
        if (ready) void load('initial');
    }, [ready, load]);

    const goBack = () => {
        if ((router as any).canGoBack?.()) router.back();
        else router.replace('/portal');
    };
    const stats = result?.summary;
    const rows = result?.entries || [];
    const showProfile = !!result?.multipleProfiles || (result?.dairyNames?.length || 0) > 1;
    const border = colors.primary + '30';
    const cell = (text: string, flex: number, bold = false) => (
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={{ flex, minWidth: 0, textAlign: 'center', fontSize: 10, fontWeight: bold ? '700' : '600', color: colors.foreground }}>
            {text}
        </Text>
    );

    const columns = selling ? [
        { title: 'Date', flex: 1.2 }, { title: 'M + E (L)', flex: 1.35 },
        { title: 'Rate', flex: 0.8 }, { title: 'Amount', flex: 1 }, { title: 'Paid', flex: 0.6 },
    ] : COLUMNS;
    const header = (
        <View>
            <View style={styles.topRow}>
                <Pressable accessibilityRole="button" accessibilityLabel="Back to portal" onPress={goBack} style={styles.backButton}>
                    <ArrowLeft size={25} color={colors.foreground} strokeWidth={2.5} />
                </Pressable>
                <Text style={[styles.pageTitle, { color: colors.foreground }]}>{selling ? 'Selling Entries' : 'Collection Entries'}</Text>
            </View>
            <DateRangePicker
                startDate={startDate || null}
                endDate={endDate || null}
                onStartDateChange={(date) => { setStartDate(date); setEndDate((old) => old && old < date ? '' : old); }}
                onEndDateChange={(date) => { setEndDate(date); setStartDate((old) => old && old > date ? '' : old); }}
            />
            {(!!startDate || !!endDate) && (
                <Pressable onPress={() => { setStartDate(''); setEndDate(''); }} style={styles.clearDate}>
                    <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>Clear dates</Text>
                </Pressable>
            )}
            <View style={[styles.summary, { backgroundColor: colors.card, borderColor: border }]}>
                {[
                    { label: 'Quantity', value: stats ? `${numberText(stats.quantity, 3)} L` : '--' },
                    { label: 'Avg Rate', value: stats ? money(stats.avgRate) : '--' },
                    { label: 'Amount', value: stats ? money(stats.amount) : '--' },
                    ...(!selling ? [{ label: 'Bonus', value: stats ? money(stats.bonus) : '--' }] : []),
                ].map((item, index) => (
                    <View key={item.label} style={[styles.stat, index > 0 && { borderLeftWidth: 1, borderLeftColor: border }]}>
                        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.statValue, { color: index === 0 ? colors.foreground : colors.primary }]}>{item.value}</Text>
                        <Text numberOfLines={1} style={[styles.statLabel, { color: colors.mutedForeground }]}>{item.label}</Text>
                    </View>
                ))}
            </View>
            <View style={[styles.sectionHeader, { backgroundColor: colors.secondary, borderColor: border }]}>
                <View style={[styles.sectionIcon, { backgroundColor: colors.primary }]}><Droplets size={17} color={colors.white} /></View>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{selling ? 'Selling Entries' : 'Collection Entries'}</Text>
                    <Text style={[styles.sectionCount, { color: colors.mutedForeground }]}>{stats ? `${stats.count} records • ${rows.length} shown` : error ? 'Unable to load records' : 'Loading records...'}</Text>
                </View>
            </View>
            {rows.length > 0 && (
                <View style={[styles.tableHeader, { backgroundColor: colors.secondary, borderColor: border }]}>
                    {columns.map((column) => <Text key={column.title} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.tableHeaderText, { flex: column.flex, color: colors.mutedForeground }]}>{column.title}</Text>)}
                </View>
            )}
        </View>
    );

    return (
        <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
            <FlatList
                data={rows}
                keyExtractor={(row) => row.id}
                contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: Math.max(insets.bottom, 16) + 20 }}
                ListHeaderComponent={header}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load('refresh')} colors={[colors.primary]} />}
                ListEmptyComponent={loading ? (
                    <View style={styles.empty}><ActivityIndicator color={colors.primary} /><Text style={{ color: colors.mutedForeground, marginTop: 8 }}>Loading entries...</Text></View>
                ) : error ? (
                    <View style={styles.empty}><Text style={{ color: colors.destructive, textAlign: 'center' }}>{error}</Text><Pressable onPress={() => void load('initial')} style={styles.retry}><Text style={{ color: colors.primary, fontWeight: '700' }}>Retry</Text></Pressable></View>
                ) : (
                    <View style={styles.empty}><Text style={{ color: colors.mutedForeground }}>{selling ? 'No selling entries for this period.' : 'No collection entries for this period.'}</Text></View>
                )}
                renderItem={({ item, index }) => {
                    const paid = String(item.status || '').trim().toLowerCase() === 'paid';
                    const shift = String(item.shift || '').toLowerCase();
                    return (
                        <View style={{ borderColor: border, borderLeftWidth: 1, borderRightWidth: 1, backgroundColor: index % 2 ? colors.secondary : colors.card }}>
                            <View style={[styles.tableRow, { borderColor: border }]}>
                                {selling ? <>
                                    {cell(item.date ? new Date(item.date).toLocaleDateString('en-GB', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' }) : '--', 1.2)}
                                    {cell(`${numberText(item.morningQuantity, 3)} + ${numberText(item.eveningQuantity, 3)}`, 1.35)}
                                    {cell(numberText(item.rate), 0.8)}
                                    {cell(money(item.amount), 1, true)}
                                </> : <>
                                <View style={{ flex: 1.25, alignItems: 'center', minWidth: 0 }}>
                                    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ fontSize: 10, fontWeight: '600', color: colors.foreground }}>{dateText(item.date)}</Text>
                                    {!!shift && <Text style={{ fontSize: 8, color: colors.mutedForeground }}>{shift === 'morning' ? 'M' : shift === 'evening' ? 'E' : shift}</Text>}
                                </View>
                                {cell(numberText(item.quantity, 3), 0.65)}
                                {cell(item.fat == null ? '--' : numberText(item.fat), 0.5)}
                                {cell(item.snf == null ? '--' : numberText(item.snf), 0.5)}
                                {cell(numberText(item.rate), 0.65)}
                                {cell(bonusText(item), 0.8)}
                                {cell(money(item.amount), 1, true)}
                                </>}
                                <View accessible accessibilityRole="text" accessibilityLabel={paid ? 'Paid' : 'Not paid'} style={{ flex: selling ? 0.6 : 0.55, alignItems: 'center', justifyContent: 'center', minHeight: 16 }}>
                                    {paid ? <Check size={14} color={colors.success} strokeWidth={3} /> : null}
                                </View>
                            </View>
                            {showProfile && <Text numberOfLines={1} style={{ textAlign: 'right', paddingHorizontal: 8, paddingBottom: 4, fontSize: 9, color: colors.mutedForeground }}>{selling ? (item.customerName || 'Customer') : (item.farmerName || 'Farmer')} · {item.dairyName || 'Dairy'}</Text>}
                        </View>
                    );
                }}
                ListFooterComponent={result && rows.length > 0 ? (
                    <View style={{ paddingVertical: 12, alignItems: 'center' }}>
                        {!!pageError && <Text style={{ color: colors.destructive, textAlign: 'center', marginBottom: 6 }}>{pageError}</Text>}
                        {result.nextCursor && <Pressable accessibilityRole="button" disabled={loadingMore} onPress={() => void load('more', result.nextCursor || undefined)} style={[styles.more, { borderColor: colors.primary }]}>
                            {loadingMore ? <ActivityIndicator color={colors.primary} /> : <Text style={{ color: colors.primary, fontWeight: '700' }}>Load More Entries</Text>}
                        </Pressable>}
                    </View>
                ) : null}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    topRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 },
    backButton: { width: 38, height: 38, justifyContent: 'center', alignItems: 'center' },
    pageTitle: { fontSize: 17, fontWeight: '800', flex: 1 },
    clearDate: { alignSelf: 'flex-end', paddingVertical: 4, paddingHorizontal: 4 },
    summary: { marginTop: 12, borderWidth: 1, borderRadius: 12, flexDirection: 'row', paddingVertical: 6, marginBottom: 10 },
    stat: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
    statValue: { fontSize: 15, fontWeight: '800', textAlign: 'center' },
    statLabel: { fontSize: 10, marginTop: 2 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 9, borderWidth: 1, borderTopLeftRadius: 12, borderTopRightRadius: 12 },
    sectionIcon: { width: 28, height: 28, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
    sectionTitle: { fontSize: 14, fontWeight: '800' },
    sectionCount: { fontSize: 10, marginTop: 1 },
    tableHeader: { flexDirection: 'row', alignItems: 'center', borderLeftWidth: 1, borderRightWidth: 1, paddingHorizontal: 3, paddingVertical: 8 },
    tableHeaderText: { fontSize: 9, fontWeight: '700', textAlign: 'center', textTransform: 'uppercase', minWidth: 0 },
    tableRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 3, paddingVertical: 10, borderTopWidth: 1 },
    empty: { padding: 24, alignItems: 'center' },
    retry: { padding: 12 },
    more: { borderWidth: 1, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 18, minWidth: 150, alignItems: 'center' },
});

export default function PortalCollectionEntriesScreen() { return <PortalEntriesScreen />; }
