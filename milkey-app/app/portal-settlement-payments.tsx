import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, IndianRupee } from 'lucide-react-native';
import { Pressable } from '@/components/ui/HapticPressable';
import { useTheme } from '@/hooks/useTheme';
import {
    clearPortalSession,
    getPortalSession,
    portalApi,
    PortalAdvanceCursor,
    PortalCollectionPaymentsResult,
    PortalPaymentRow,
} from '@/lib/portalAuth';

const money = (value?: number) => {
    const n = Number(value || 0);
    return `${n < 0 ? '-' : ''}₹${Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
const dateText = (value?: string) => {
    if (!value) return '--';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '--' : date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export function SettlementPaymentsScreen({ selling = false }: { selling?: boolean }) {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const [ready, setReady] = useState(false);
    const [result, setResult] = useState<PortalCollectionPaymentsResult | null>(null);
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
            if (mode === 'initial') setLoading(true);
            else setRefreshing(true);
        }
        const response = await (selling ? portalApi.getSellingPayments : portalApi.getCollectionPayments)(mode === 'more' ? cursor : undefined);
        if (requestId !== generation.current) return;
        if (response.success && response.response) {
            const page = response.response;
            setResult((current) => {
                if (mode !== 'more' || !current) return page;
                const known = new Set(current.payments.map((row) => row.id));
                return { ...page, payments: [...current.payments, ...page.payments.filter((row) => !known.has(row.id))] };
            });
        } else if (response.status === 401 || response.code === 'INVALID_PORTAL_SESSION' || response.code === 'PORTAL_SESSION_REQUIRED') {
            await clearPortalSession();
            router.replace('/auth');
            return;
        } else if (mode === 'more') {
            setPageError(response.message || 'Could not load more payments.');
        } else {
            setError(response.message || 'Could not load settlement payments.');
        }
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
        loadMoreLock.current = false;
    }, [selling]);

    useEffect(() => { if (ready) void load('initial'); }, [ready, load]);

    const goBack = () => {
        if ((router as any).canGoBack?.()) router.back();
        else router.replace('/portal');
    };
    const rows = result?.payments || [];
    const border = colors.primary + '30';
    const line = (label: string, amount?: number, color?: string) => (
        <View style={styles.amountRow} key={label}>
            <Text style={[styles.amountLabel, { color: colors.mutedForeground }]}>{label}</Text>
            <Text style={[styles.amountValue, { color: color || colors.foreground }]}>{money(amount)}</Text>
        </View>
    );
    const renderPayment = ({ item, index }: { item: PortalPaymentRow; index: number }) => {
        const range = item.periodStart && item.periodEnd
            ? `${dateText(item.periodStart)} - ${dateText(item.periodEnd)}`
            : dateText(item.date);
        const closing = Number(item.closingBalance || 0);
        return (
            <View style={[styles.paymentCard, { backgroundColor: colors.card, borderColor: border }]}>
                <View style={styles.paymentTop}>
                    <Text style={[styles.paymentNumber, { color: colors.primary }]}>{index + 1}</Text>
                    <Text numberOfLines={1} style={[styles.paymentMode, { color: colors.foreground }]}>{item.mode || 'Settlement'}</Text>
                    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={[styles.period, { color: colors.mutedForeground }]}>{range}</Text>
                </View>
                {result?.multipleProfiles && (
                    <Text numberOfLines={1} style={[styles.profile, { color: colors.mutedForeground }]}>{selling ? (item.customerName || 'Customer') : (item.farmerName || 'Farmer')} · {item.dairyName || 'Dairy'}</Text>
                )}
                <View style={[styles.divider, { backgroundColor: border }]} />
                {line('Milk Amount:', item.totalMilkAmount)}
                {line(item.advanceEffect === 'add' ? 'Advance (+):' : 'Advance:', (Number(item.totalAdvanceDeduction) || 0) * (item.advanceEffect === 'add' ? 1 : -1), colors.warning)}
                {line('Total Payable:', item.netPayable)}
                {line('Paid Amount:', item.amount, colors.success)}
                <View style={[styles.closingRow, { borderTopColor: border }]}>
                    <Text style={[styles.closingLabel, { color: colors.mutedForeground }]}>Closing Balance:</Text>
                    <Text style={[styles.closingValue, { color: closing < 0 ? colors.destructive : colors.success }]}>{money(closing)}</Text>
                    <Text style={[styles.created, { color: colors.mutedForeground }]}>Created: {dateText(item.createdAt || item.date)}</Text>
                </View>
            </View>
        );
    };
    const header = (
        <View>
            <View style={styles.topRow}>
                <Pressable accessibilityRole="button" accessibilityLabel="Back to portal" onPress={goBack} style={styles.backButton}>
                    <ArrowLeft size={25} color={colors.foreground} strokeWidth={2.5} />
                </Pressable>
                <Text style={[styles.pageTitle, { color: colors.foreground }]}>{selling ? 'Selling Payment History' : 'Settlement Payment History'}</Text>
            </View>
            <View style={[styles.sectionHeader, { backgroundColor: colors.secondary, borderColor: border }]}>
                <View style={[styles.sectionIcon, { backgroundColor: colors.primary }]}><IndianRupee size={18} color={colors.white} /></View>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{selling ? 'Selling Payments' : 'Settlement Payments'}</Text>
                    <Text style={[styles.sectionCount, { color: colors.mutedForeground }]}>{result ? `${result.total} records • ${rows.length} shown` : error ? 'Unable to load records' : 'Loading records...'}</Text>
                </View>
            </View>
            {!!error && rows.length > 0 && <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>}
        </View>
    );

    return (
        <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
            <FlatList
                data={rows}
                keyExtractor={(row) => row.id}
                renderItem={renderPayment}
                contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: Math.max(insets.bottom, 16) + 20 }}
                ListHeaderComponent={header}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load('refresh')} colors={[colors.primary]} />}
                ListEmptyComponent={loading ? (
                    <View style={styles.empty}><ActivityIndicator color={colors.primary} /><Text style={{ color: colors.mutedForeground, marginTop: 8 }}>Loading payments...</Text></View>
                ) : error ? (
                    <View style={styles.empty}><Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text><Pressable accessibilityRole="button" onPress={() => void load('initial')} style={styles.retry}><Text style={{ color: colors.primary, fontWeight: '700' }}>Retry</Text></Pressable></View>
                ) : (
                    <View style={styles.empty}><Text style={{ color: colors.mutedForeground }}>No settlement payments found.</Text></View>
                )}
                ListFooterComponent={result && rows.length > 0 ? (
                    <View style={styles.footer}>
                        {!!pageError && <Text style={[styles.errorText, { color: colors.destructive }]}>{pageError}</Text>}
                        {result.nextCursor && <Pressable accessibilityRole="button" disabled={loadingMore} onPress={() => void load('more', result.nextCursor || undefined)} style={[styles.more, { borderColor: colors.primary }]}>
                            {loadingMore ? <ActivityIndicator color={colors.primary} /> : <Text style={{ color: colors.primary, fontWeight: '700' }}>Load More</Text>}
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
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderWidth: 1, borderRadius: 12, marginBottom: 10 },
    sectionIcon: { width: 30, height: 30, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
    sectionTitle: { fontSize: 14, fontWeight: '800' },
    sectionCount: { fontSize: 10, marginTop: 2 },
    paymentCard: { borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 10 },
    paymentTop: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    paymentNumber: { fontSize: 13, fontWeight: '900' },
    paymentMode: { flex: 1, fontSize: 12, fontWeight: '800' },
    period: { maxWidth: '64%', fontSize: 11, textAlign: 'right' },
    profile: { fontSize: 10, marginTop: 5 },
    divider: { height: 1, marginVertical: 7 },
    amountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 23, gap: 8 },
    amountLabel: { fontSize: 12, flexShrink: 1 },
    amountValue: { fontSize: 12, fontWeight: '700' },
    closingRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 5, marginTop: 6, paddingTop: 8, borderTopWidth: 1 },
    closingLabel: { fontSize: 11, fontWeight: '800' },
    closingValue: { fontSize: 11, fontWeight: '900' },
    created: { flexGrow: 1, fontSize: 9, textAlign: 'right' },
    empty: { padding: 28, alignItems: 'center' },
    errorText: { textAlign: 'center', fontSize: 12, marginVertical: 6 },
    retry: { padding: 12 },
    footer: { paddingVertical: 8, alignItems: 'center' },
    more: { borderWidth: 1, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 18, minWidth: 150, alignItems: 'center' },
});

export default function PortalSettlementPaymentsScreen() { return <SettlementPaymentsScreen />; }
