import React, { useEffect, useMemo, useState, memo, useCallback } from 'react';
import {
    View, Text, Modal, Pressable, TextInput, ScrollView, StyleSheet, Platform,
    ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { X, RefreshCw, Table as TableIcon } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { buildChart } from '@/lib/rateChart';
import { rateChartsApi } from '@/lib/milkeyApi';

interface Props {
    visible: boolean;
    onClose: () => void;
    initialRate?: string;
    highlightFat?: number;
    highlightSnf?: number;
}

const PRESETS: Record<string, { fatMin: number; fatMax: number; snfMin: number; snfMax: number; step: number; label: string }> = {
    full: { fatMin: 1, fatMax: 15, snfMin: 1, snfMax: 15, step: 0.1, label: 'Full (1–15)' },
};

const STORAGE_KEY = 'milkey.rateChart.settings';
const CELL_W = 62;
const CELL_H = 34;
const LABEL_W = 56;

export default function RateChartModal({ visible, onClose, initialRate, highlightFat, highlightSnf }: Props) {
    const { colors, isDark } = useTheme();
    const s = makeStyles(colors, isDark);

    const [rateText, setRateText] = useState(initialRate || '60');
    const [presetKey, setPresetKey] = useState<keyof typeof PRESETS>('full');
    const [fatMin, setFatMin] = useState('1');
    const [fatMax, setFatMax] = useState('15');
    const [snfMin, setSnfMin] = useState('1');
    const [snfMax, setSnfMax] = useState('15');
    // Step is locked to 0.1 (hidden from UI)
    const step = '0.1';
    const [advanced, setAdvanced] = useState(false);
    const [saving, setSaving] = useState(false);
    const hydratedRef = React.useRef(false);

    // Load persisted settings — try server first, fall back to AsyncStorage.
    useEffect(() => {
        (async () => {
            try {
                const res = await rateChartsApi.getQuickSettings();
                if (res?.success && res.response) {
                    const d: any = res.response;
                    if (d.rate != null) setRateText(String(d.rate));
                    if (d.fatMin != null) setFatMin(String(d.fatMin));
                    if (d.fatMax != null) setFatMax(String(d.fatMax));
                    if (d.snfMin != null) setSnfMin(String(d.snfMin));
                    if (d.snfMax != null) setSnfMax(String(d.snfMax));
                    // step is locked; ignore persisted value
                    if (d.presetKey && PRESETS[d.presetKey]) setPresetKey(d.presetKey);
                    hydratedRef.current = true;
                    return;
                }
            } catch { /* fall through to local cache */ }
            try {
                const raw = await AsyncStorage.getItem(STORAGE_KEY);
                if (raw) {
                    const st = JSON.parse(raw);
                    if (st.rate) setRateText(String(st.rate));
                    if (st.fatMin != null) setFatMin(String(st.fatMin));
                    if (st.fatMax != null) setFatMax(String(st.fatMax));
                    if (st.snfMin != null) setSnfMin(String(st.snfMin));
                    if (st.snfMax != null) setSnfMax(String(st.snfMax));
                    if (st.presetKey && PRESETS[st.presetKey]) setPresetKey(st.presetKey);
                }
            } catch { /* noop */ }
            hydratedRef.current = true;
        })();
    }, []);

    // Persist on change (visible only) — write to both local cache and server.
    useEffect(() => {
        if (!visible || !hydratedRef.current) return;
        setSaving(true);
        const t = setTimeout(() => {
            const payload = {
                rate: rateText, fatMin, fatMax, snfMin, snfMax, step, presetKey,
            };
            AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload)).catch(() => { });
            rateChartsApi.updateQuickSettings({
                rate: parseFloat(rateText) || 0,
                fatMin: parseFloat(fatMin) || 0,
                fatMax: parseFloat(fatMax) || 0,
                snfMin: parseFloat(snfMin) || 0,
                snfMax: parseFloat(snfMax) || 0,
                step: parseFloat(step) || 0.1,
                presetKey,
            })
                .catch(() => { /* offline-safe */ })
                .finally(() => setSaving(false));
        }, 600);
        return () => clearTimeout(t);
    }, [visible, rateText, fatMin, fatMax, snfMin, snfMax, step, presetKey]);

    // Prefill rate from prop when opening if user hasn't typed anything meaningful
    useEffect(() => {
        if (visible && initialRate && Number(initialRate) > 0) setRateText(initialRate);
    }, [visible, initialRate]);

    const applyPreset = (key: keyof typeof PRESETS) => {
        const p = PRESETS[key];
        setPresetKey(key);
        setFatMin(String(p.fatMin));
        setFatMax(String(p.fatMax));
        setSnfMin(String(p.snfMin));
        setSnfMax(String(p.snfMax));
    };

    // Skip heavy chart build entirely while the modal is closed — the
    // component stays mounted inside a parent screen, so we don't want to
    // recompute a 14×14+ grid every time inputs change off-screen.
    const chart = useMemo(() => {
        if (!visible) return { fatValues: [], snfValues: [], rows: [], fatRate: 0, snfRate: 0 };
        return buildChart({
            rate: parseFloat(rateText) || 0,
            fatMin: parseFloat(fatMin) || 0,
            fatMax: parseFloat(fatMax) || 0,
            snfMin: parseFloat(snfMin) || 0,
            snfMax: parseFloat(snfMax) || 0,
            step: parseFloat(step) || 0.1,
        });
    }, [visible, rateText, fatMin, fatMax, snfMin, snfMax, step]);

    const reset = () => {
        setRateText('60');
        applyPreset('full');
    };

    // Match highlighted cell (rounded to nearest step)
    const roundToStep = (v: number | undefined, stepN: number) =>
        v == null || !Number.isFinite(v) ? null : Math.round(v / stepN) * stepN;
    const stepNum = parseFloat(step) || 0.1;
    const hFat = roundToStep(highlightFat, stepNum);
    const hSnf = roundToStep(highlightSnf, stepNum);

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
            <View style={s.root}>
                {/* Header */}
                <View style={s.header}>
                    <View style={s.headerLeft}>
                        <View style={s.headerIcon}><TableIcon size={18} color="#fff" /></View>
                        <View>
                            <Text style={s.headerTitle}>Rate Chart</Text>
                            <Text style={s.headerSub}>FAT × SNF calculator</Text>
                        </View>
                        {saving && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 8 }}>
                                <ActivityIndicator size="small" color={colors.primary} />
                                <Text style={{ color: colors.mutedForeground, fontSize: 11, fontWeight: '600' }}>Saving…</Text>
                            </View>
                        )}
                    </View>
                    <Pressable onPress={onClose} style={s.closeBtn} hitSlop={10}>
                        <X size={20} color={colors.foreground} />
                    </Pressable>
                </View>

                {/* Controls */}
                <View style={s.controls}>
                    <View style={s.rateRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={s.label}>Rate (₹)</Text>
                            <TextInput
                                style={s.rateInput}
                                value={rateText}
                                onChangeText={setRateText}
                                keyboardType="decimal-pad"
                                placeholder="60"
                                placeholderTextColor={colors.mutedForeground}
                            />
                        </View>
                        {/* Fat Rate / SNF Rate hidden intentionally — locked internal formula */}
                    </View>
                    {/* Advanced toggle — lets user tweak FAT/SNF ranges. Step is locked at 0.1. */}
                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                        <Pressable
                            onPress={() => setAdvanced(a => !a)}
                            style={[s.chip, advanced && s.chipActive]}
                        >
                            <Text style={[s.chipText, advanced && s.chipTextActive]}>
                                {advanced ? 'Hide Advanced' : 'Advanced'}
                            </Text>
                        </Pressable>
                    </View>
                    {advanced && (
                        <View>
                            <View style={s.advRow}>
                                <View style={s.advCell}>
                                    <Text style={s.label}>FAT Min</Text>
                                    <TextInput style={s.smallInput} value={fatMin} onChangeText={setFatMin}
                                        keyboardType="decimal-pad" placeholder="1"
                                        placeholderTextColor={colors.mutedForeground} />
                                </View>
                                <View style={s.advCell}>
                                    <Text style={s.label}>FAT Max</Text>
                                    <TextInput style={s.smallInput} value={fatMax} onChangeText={setFatMax}
                                        keyboardType="decimal-pad" placeholder="15"
                                        placeholderTextColor={colors.mutedForeground} />
                                </View>
                            </View>
                            <View style={[s.advRow, { marginTop: 8 }]}>
                                <View style={s.advCell}>
                                    <Text style={s.label}>SNF Min</Text>
                                    <TextInput style={s.smallInput} value={snfMin} onChangeText={setSnfMin}
                                        keyboardType="decimal-pad" placeholder="1"
                                        placeholderTextColor={colors.mutedForeground} />
                                </View>
                                <View style={s.advCell}>
                                    <Text style={s.label}>SNF Max</Text>
                                    <TextInput style={s.smallInput} value={snfMax} onChangeText={setSnfMax}
                                        keyboardType="decimal-pad" placeholder="15"
                                        placeholderTextColor={colors.mutedForeground} />
                                </View>
                            </View>
                            {/* Step is intentionally hidden — locked at 0.1 */}
                        </View>
                    )}
                </View>

                {/* Table */}
                <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12 }}>
                    <ScrollView horizontal showsHorizontalScrollIndicator>
                        <View>
                            {/* Header row: SNF values */}
                            <View style={s.row}>
                                <View style={[s.cellLabel, { width: LABEL_W, backgroundColor: colors.primary }]}>
                                    <Text style={[s.cellLabelText, { color: '#fff' }]}>FAT\SNF</Text>
                                </View>
                                {chart.snfValues.map((snf) => {
                                    const isH = hSnf != null && Math.abs(snf - hSnf) < 1e-6;
                                    return (
                                        <View key={snf} style={[s.cellHead, isH && s.cellHeadActive]}>
                                            <Text style={[s.cellHeadText, isH && { color: '#fff' }]}>{snf.toFixed(1)}</Text>
                                        </View>
                                    );
                                })}
                            </View>
                            {chart.rows.map((r) => (
                                <ChartRow
                                    key={r.fat}
                                    fat={r.fat}
                                    cells={r.cells}
                                    snfValues={chart.snfValues}
                                    hFat={hFat}
                                    hSnf={hSnf}
                                    styles={s}
                                />
                            ))}
                            {chart.rows.length === 0 && (
                                <Text style={{ color: colors.mutedForeground, padding: 24 }}>
                                    Adjust the ranges to see the chart.
                                </Text>
                            )}
                        </View>
                    </ScrollView>
                </ScrollView>

                {/* Footer */}
                <View style={s.footer}>
                    <Pressable onPress={reset} style={[s.footerBtn, s.footerBtnGhost]}>
                        <RefreshCw size={16} color={colors.foreground} />
                        <Text style={[s.footerBtnText, { color: colors.foreground }]}>Reset</Text>
                    </Pressable>
                    <Pressable onPress={onClose} style={[s.footerBtn, s.footerBtnPrimary]}>
                        <Text style={[s.footerBtnText, { color: '#fff' }]}>Close</Text>
                    </Pressable>
                </View>
            </View>
        </Modal>
    );
}

function makeStyles(colors: any, isDark: boolean) {
    return _makeStyles(colors, isDark);
}

// Memoized row — avoids re-rendering hundreds of cells when only the highlight
// or an unrelated input changes. Cells shallow-compare via primitive props.
const ChartRow = memo(function ChartRow({
    fat, cells, snfValues, hFat, hSnf, styles: s,
}: {
    fat: number;
    cells: number[];
    snfValues: number[];
    hFat: number | null;
    hSnf: number | null;
    styles: any;
}) {
    const rowH = hFat != null && Math.abs(fat - hFat) < 1e-6;
    return (
        <View style={s.row}>
            <View style={[s.cellLabel, { width: LABEL_W }, rowH && s.cellHeadActive]}>
                <Text style={[s.cellLabelText, rowH && { color: '#fff' }]}>{fat.toFixed(1)}</Text>
            </View>
            {cells.map((v, i) => {
                const snf = snfValues[i];
                const colH = hSnf != null && Math.abs(snf - hSnf) < 1e-6;
                const cellH = rowH && colH;
                return (
                    <View
                        key={i}
                        style={[
                            s.cell,
                            (rowH || colH) && s.cellHi,
                            cellH && s.cellHiStrong,
                        ]}
                    >
                        <Text style={[s.cellText, cellH && { color: '#fff', fontWeight: '800' }]}>
                            {v.toFixed(2)}
                        </Text>
                    </View>
                );
            })}
        </View>
    );
});

function _makeStyles(colors: any, isDark: boolean) {
    return StyleSheet.create({
        root: { flex: 1, backgroundColor: colors.background, paddingTop: Platform.OS === 'ios' ? 50 : 30 },
        header: {
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            paddingHorizontal: 14, paddingVertical: 12,
            borderBottomWidth: 1, borderColor: colors.border,
        },
        headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
        headerIcon: {
            width: 36, height: 36, borderRadius: 10, backgroundColor: colors.primary,
            alignItems: 'center', justifyContent: 'center',
        },
        headerTitle: { color: colors.foreground, fontSize: 16, fontWeight: '800' },
        headerSub: { color: colors.mutedForeground, fontSize: 11 },
        closeBtn: { padding: 6, borderRadius: 8 },

        controls: { padding: 12, gap: 10, borderBottomWidth: 1, borderColor: colors.border },
        rateRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
        label: { color: colors.mutedForeground, fontSize: 11, fontWeight: '600', marginBottom: 4 },
        rateInput: {
            backgroundColor: colors.input, color: colors.foreground,
            borderRadius: 10, borderWidth: 1, borderColor: colors.border,
            paddingHorizontal: 12, paddingVertical: 10, fontSize: 18, fontWeight: '800',
        },
        derivedBox: {
            backgroundColor: colors.secondary, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8,
            minWidth: 88, alignItems: 'center',
        },
        derivedLbl: { color: colors.mutedForeground, fontSize: 10, fontWeight: '600' },
        derivedVal: { color: colors.primary, fontSize: 15, fontWeight: '800' },

        presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
        chip: {
            paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
            backgroundColor: colors.muted, borderWidth: 1, borderColor: colors.border,
        },
        chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
        chipGhost: { backgroundColor: 'transparent', borderColor: colors.primary },
        chipText: { fontSize: 12, color: colors.foreground, fontWeight: '600' },
        chipTextActive: { color: '#fff' },

        advGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
        advRow: { flexDirection: 'row', gap: 8 },
        advCell: { flex: 1, minWidth: 90 },
        smallInput: {
            backgroundColor: colors.input, color: colors.foreground,
            borderRadius: 8, borderWidth: 1, borderColor: colors.border,
            paddingHorizontal: 10, paddingVertical: 8, fontSize: 14,
        },

        row: { flexDirection: 'row' },
        cellHead: {
            width: CELL_W, height: CELL_H, alignItems: 'center', justifyContent: 'center',
            backgroundColor: isDark ? '#2A3B32' : '#E8F5E9',
            borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
        },
        cellHeadActive: { backgroundColor: colors.primary },
        cellHeadText: { fontSize: 12, fontWeight: '700', color: colors.foreground },
        cellLabel: {
            height: CELL_H, alignItems: 'center', justifyContent: 'center',
            backgroundColor: isDark ? '#2A3B32' : '#E8F5E9',
            borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
        },
        cellLabelText: { fontSize: 12, fontWeight: '700', color: colors.foreground },
        cell: {
            width: CELL_W, height: CELL_H, alignItems: 'center', justifyContent: 'center',
            backgroundColor: colors.card,
            borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
        },
        cellHi: { backgroundColor: isDark ? '#1E3A2F' : '#DCFCE7' },
        cellHiStrong: { backgroundColor: colors.primary },
        cellText: { fontSize: 12, color: colors.foreground, fontWeight: '600' },

        footer: {
            flexDirection: 'row', gap: 10, padding: 12,
            borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.background,
        },
        footerBtn: {
            flex: 1, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center',
            paddingVertical: 12, borderRadius: 12,
        },
        footerBtnGhost: { backgroundColor: colors.muted },
        footerBtnPrimary: { backgroundColor: colors.primary },
        footerBtnText: { fontSize: 14, fontWeight: '700' },
    });
}
