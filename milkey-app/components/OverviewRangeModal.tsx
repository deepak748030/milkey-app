import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { X } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { DateRangePicker } from '@/components/DateRangePicker';
import { reportsApi, sellingEntriesApi } from '@/lib/milkeyApi';

type Kind = 'collection' | 'selling';

interface Props {
    visible: boolean;
    kind: Kind;
    onClose: () => void;
}

interface Totals {
    quantity: number;
    amount: number;
    avgRate: number;
}

export function OverviewRangeModal({ visible, kind, onClose }: Props) {
    const { colors, isDark } = useTheme();
    const [startDate, setStartDate] = useState<string | null>(null);
    const [endDate, setEndDate] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [totals, setTotals] = useState<Totals | null>(null);

    useEffect(() => {
        if (!visible) {
            setStartDate(null);
            setEndDate(null);
            setTotals(null);
        }
    }, [visible]);

    useEffect(() => {
        if (!startDate || !endDate) return;
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                if (kind === 'collection') {
                    const res = await reportsApi.getMilkCollections({ startDate, endDate });
                    if (!cancelled && res?.success && res.response) {
                        const s = res.response.summary;
                        setTotals({
                            quantity: s.totalQuantity || 0,
                            amount: s.totalAmount || 0,
                            avgRate: s.avgRate || (s.totalQuantity ? s.totalAmount / s.totalQuantity : 0),
                        });
                    }
                } else {
                    const res = await sellingEntriesApi.getAll({ startDate, endDate, limit: 5000 });
                    if (!cancelled && res?.success && res.response?.data) {
                        let qty = 0;
                        let amt = 0;
                        for (const e of res.response.data) {
                            const q = (e.morningQuantity || 0) + (e.eveningQuantity || 0);
                            qty += q;
                            amt += e.amount || q * (e.rate || 0);
                        }
                        setTotals({ quantity: qty, amount: amt, avgRate: qty ? amt / qty : 0 });
                    }
                }
            } catch {
                if (!cancelled) setTotals(null);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [startDate, endDate, kind]);

    const styles = createStyles(colors, isDark);
    const title = kind === 'collection' ? 'Milk Collection Range' : 'Selling Range';

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <Pressable style={styles.overlay} onPress={onClose}>
                <Pressable style={styles.card} onPress={() => { }}>
                    <View style={styles.header}>
                        <Text style={styles.title}>{title}</Text>
                        <Pressable onPress={onClose} hitSlop={10}>
                            <X size={20} color={colors.foreground} />
                        </Pressable>
                    </View>

                    <DateRangePicker
                        startDate={startDate}
                        endDate={endDate}
                        onStartDateChange={setStartDate}
                        onEndDateChange={setEndDate}
                    />

                    <ScrollView style={{ maxHeight: 280 }}>
                        {!startDate || !endDate ? (
                            <Text style={styles.hint}>Select a date range to view {kind === 'collection' ? 'collection' : 'selling'} summary.</Text>
                        ) : loading ? (
                            <View style={styles.loadingWrap}>
                                <ActivityIndicator color={colors.primary} />
                            </View>
                        ) : totals ? (
                            <View style={styles.rowsWrap}>
                                <Row label="Quantity" value={`${totals.quantity.toFixed(2)} L`} colors={colors} />
                                <Row label="Average Rate" value={`₹ ${totals.avgRate.toFixed(2)}`} colors={colors} />
                                <Row label="Amount" value={`₹ ${totals.amount.toFixed(2)}`} colors={colors} highlight />
                            </View>
                        ) : (
                            <Text style={styles.hint}>No data for selected range.</Text>
                        )}
                    </ScrollView>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

function Row({ label, value, colors, highlight }: { label: string; value: string; colors: any; highlight?: boolean }) {
    return (
        <View style={{
            flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
            paddingVertical: 10, borderBottomWidth: 1, borderColor: colors.border,
        }}>
            <Text style={{ fontSize: 13, color: colors.mutedForeground }}>{label}</Text>
            <Text style={{ fontSize: highlight ? 16 : 14, fontWeight: '700', color: highlight ? colors.primary : colors.foreground }}>{value}</Text>
        </View>
    );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
    overlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center', paddingHorizontal: 16,
    },
    card: {
        backgroundColor: isDark ? colors.card : '#fff',
        borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border,
    },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10,
    },
    title: { fontSize: 15, fontWeight: '700', color: colors.foreground },
    hint: { fontSize: 12, color: colors.mutedForeground, textAlign: 'center', paddingVertical: 20 },
    loadingWrap: { paddingVertical: 24, alignItems: 'center' },
    rowsWrap: { marginTop: 4 },
});
