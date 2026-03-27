import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal } from 'react-native';
import { Calendar as CalendarIcon } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { PaymentRangeCalendar, BlockedPeriod } from '@/components/PaymentRangeCalendar';

interface DateRangePickerProps {
    startDate: string | null;
    endDate: string | null;
    onStartDateChange: (date: string) => void;
    onEndDateChange: (date: string) => void;
    blockedPeriods?: BlockedPeriod[];
    startPlaceholder?: string;
    endPlaceholder?: string;
    formatDate?: (date: string) => string;
}

const defaultFormatDate = (dateStr: string): string => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
};

export function DateRangePicker({
    startDate,
    endDate,
    onStartDateChange,
    onEndDateChange,
    blockedPeriods = [],
    startPlaceholder = 'Start Date',
    endPlaceholder = 'End Date',
    formatDate = defaultFormatDate,
}: DateRangePickerProps) {
    const { colors, isDark } = useTheme();
    const [visible, setVisible] = useState(false);
    const [selectingType, setSelectingType] = useState<'start' | 'end'>('start');

    const openStart = () => {
        setSelectingType('start');
        setVisible(true);
    };

    const openEnd = () => {
        setSelectingType('end');
        setVisible(true);
    };

    return (
        <>
            <View style={styles.row}>
                <Pressable
                    style={[
                        styles.dateInput,
                        {
                            backgroundColor: isDark ? colors.muted : colors.background,
                            borderColor: colors.border,
                        },
                        selectingType === 'start' && visible && { borderColor: colors.primary, borderWidth: 2 },
                    ]}
                    onPress={openStart}
                >
                    <CalendarIcon size={14} color={selectingType === 'start' && visible ? colors.primary : colors.mutedForeground} />
                    <Text style={[styles.dateText, { color: startDate ? colors.foreground : colors.mutedForeground }]}>
                        {startDate ? formatDate(startDate) : startPlaceholder}
                    </Text>
                </Pressable>

                <Text style={[styles.arrow, { color: colors.mutedForeground }]}>→</Text>

                <Pressable
                    style={[
                        styles.dateInput,
                        {
                            backgroundColor: isDark ? colors.muted : colors.background,
                            borderColor: colors.border,
                        },
                        selectingType === 'end' && visible && { borderColor: colors.primary, borderWidth: 2 },
                    ]}
                    onPress={openEnd}
                >
                    <CalendarIcon size={14} color={selectingType === 'end' && visible ? colors.primary : colors.mutedForeground} />
                    <Text style={[styles.dateText, { color: endDate ? colors.foreground : colors.mutedForeground }]}>
                        {endDate ? formatDate(endDate) : endPlaceholder}
                    </Text>
                </Pressable>
            </View>

            <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
                <Pressable
                    style={styles.overlay}
                    onPress={() => setVisible(false)}
                >
                    <Pressable onPress={() => { }} style={[styles.calendarContainer, {
                        backgroundColor: isDark ? colors.card : '#fff',
                        borderColor: colors.border,
                    }]}>
                        <PaymentRangeCalendar
                            startDate={startDate}
                            endDate={endDate}
                            onStartDateSelect={(date) => {
                                onStartDateChange(date);
                                setSelectingType('end');
                            }}
                            onEndDateSelect={(date) => {
                                onEndDateChange(date);
                                setVisible(false);
                            }}
                            blockedPeriods={blockedPeriods}
                            selectingType={selectingType}
                        />
                    </Pressable>
                </Pressable>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 6,
    },
    dateInput: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 8,
    },
    dateText: {
        fontSize: 12,
        fontWeight: '500',
    },
    arrow: {
        fontSize: 14,
        fontWeight: '600',
    },
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        paddingHorizontal: 16,
    },
    calendarContainer: {
        borderRadius: 16,
        padding: 12,
        borderWidth: 1,
    },
});
