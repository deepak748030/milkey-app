import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal } from 'react-native';
import { SheetBackdrop } from '@/components/ui/SheetBackdrop';
import { Pressable } from '@/components/ui/HapticPressable';
import { X } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { DateRangePicker } from '@/components/DateRangePicker';

type Kind = 'collection' | 'selling';

interface Props {
    visible: boolean;
    kind: Kind;
    onClose: () => void;
    onRangeSelect?: (range: { startDate: string; endDate: string } | null) => void;
    initialRange?: { startDate: string | null; endDate: string | null } | null;
}

export function OverviewRangeModal({ visible, kind, onClose, onRangeSelect, initialRange }: Props) {
    const { colors, isDark } = useTheme();
    const [startDate, setStartDate] = useState<string | null>(initialRange?.startDate || null);
    const [endDate, setEndDate] = useState<string | null>(initialRange?.endDate || null);

    useEffect(() => {
        if (visible) {
            setStartDate(initialRange?.startDate || null);
            setEndDate(initialRange?.endDate || null);
        } else {
            if (!initialRange) {
                setStartDate(null);
                setEndDate(null);
            }
        }
    }, [visible, initialRange]);

    const styles = createStyles(colors, isDark);
    const title = kind === 'collection' ? 'Milk Collection Range' : 'Selling Range';
    const canApply = !!startDate && !!endDate;

    const handleApply = () => {
        if (startDate && endDate && onRangeSelect) {
            onRangeSelect({ startDate, endDate });
        }
        onClose();
    };
    const handleClear = () => {
        if (onRangeSelect) onRangeSelect(null);
        onClose();
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <Pressable style={styles.overlay} onPress={onClose}>
                <SheetBackdrop />
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
                    <Text style={styles.hint}>Select start & end date — Home will show totals for this range.</Text>

                    <View style={styles.actions}>
                        <Pressable onPress={handleClear} style={[styles.btn, styles.btnClear]}>
                            <Text style={styles.btnClearText}>Clear (Today)</Text>
                        </Pressable>
                        <Pressable onPress={handleApply} disabled={!canApply} style={[styles.btn, styles.btnApply, !canApply && styles.btnDisabled]}>
                            <Text style={[styles.btnApplyText, !canApply && styles.btnDisabledText]}>Apply</Text>
                        </Pressable>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
    overlay: {
        flex: 1, backgroundColor: 'transparent',
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
    hint: { fontSize: 11, color: colors.mutedForeground, textAlign: 'center', paddingVertical: 8 },
    actions: { flexDirection: 'row', gap: 10, marginTop: 10 },
    btn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', borderWidth: 1 },
    btnClear: { backgroundColor: colors.card, borderColor: colors.border },
    btnClearText: { fontSize: 13, fontWeight: '600', color: colors.foreground },
    btnApply: { backgroundColor: colors.primary, borderColor: colors.primary },
    btnApplyText: { fontSize: 13, fontWeight: '700', color: '#fff' },
    btnDisabled: { backgroundColor: colors.muted, borderColor: colors.muted, opacity: 0.6 },
    btnDisabledText: { color: colors.mutedForeground },
});
