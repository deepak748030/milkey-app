import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';

interface SellingPaymentCalendarProps {
    onDateSelect: (date: Date) => void;
    selectedDate: Date | null;
    blockedBeforeDate?: string; // ISO date string (YYYY-MM-DD) - dates before this are blocked/crossed
}

export function SellingPaymentCalendar({
    onDateSelect,
    selectedDate,
    blockedBeforeDate
}: SellingPaymentCalendarProps) {
    const { colors } = useTheme();
    const [currentMonth, setCurrentMonth] = useState(() => {
        if (selectedDate) {
            return new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
        }
        return new Date();
    });

    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const firstDayWeekday = firstDayOfMonth.getDay();
    const daysInMonth = lastDayOfMonth.getDate();

    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // Parse blocked before date once
    const blockedBeforeDateParsed = useMemo(() => {
        if (!blockedBeforeDate) return null;
        const [y, m, d] = blockedBeforeDate.split('-').map(Number);
        return new Date(y, m - 1, d);
    }, [blockedBeforeDate]);

    const goToPreviousMonth = () => {
        setCurrentMonth(new Date(year, month - 1, 1));
    };

    const goToNextMonth = () => {
        setCurrentMonth(new Date(year, month + 1, 1));
    };

    const handleDatePress = (day: number) => {
        const date = new Date(year, month, day);
        onDateSelect(date);
    };

    const isDateSelected = (day: number) => {
        if (!selectedDate) return false;
        return (
            selectedDate.getDate() === day &&
            selectedDate.getMonth() === month &&
            selectedDate.getFullYear() === year
        );
    };

    // Check if date is blocked (before the blockedBeforeDate - exclusive, so blockedBeforeDate itself is selectable)
    const isDateBlocked = (day: number) => {
        if (!blockedBeforeDateParsed) return false;
        const date = new Date(year, month, day);
        // Dates strictly before blockedBeforeDate are blocked
        return date < blockedBeforeDateParsed;
    };

    const isToday = (day: number) => {
        const today = new Date();
        return (
            today.getDate() === day &&
            today.getMonth() === month &&
            today.getFullYear() === year
        );
    };

    const renderCalendarDays = () => {
        const days = [];

        // Empty cells for days before the first day of the month
        for (let i = 0; i < firstDayWeekday; i++) {
            days.push(<View key={`empty-${i}`} style={styles.dayCell} />);
        }

        // Days of the month
        for (let day = 1; day <= daysInMonth; day++) {
            const isSelected = isDateSelected(day);
            const isBlocked = isDateBlocked(day);
            const isTodayDate = isToday(day);

            days.push(
                <View key={day} style={styles.dayCell}>
                    <Pressable
                        style={[
                            styles.dayButton,
                            { backgroundColor: 'transparent' },
                            isSelected && { backgroundColor: colors.primary },
                            isTodayDate && !isSelected && !isBlocked && { borderWidth: 1, borderColor: colors.primary },
                        ]}
                        onPress={() => !isBlocked && handleDatePress(day)}
                        disabled={isBlocked}
                    >
                        <Text
                            style={[
                                styles.dayText,
                                { color: colors.foreground },
                                isSelected && { color: colors.primaryForeground, fontWeight: '600' },
                                isBlocked && { color: colors.mutedForeground, opacity: 0.5 },
                                isTodayDate && !isSelected && !isBlocked && { color: colors.primary, fontWeight: '600' },
                            ]}
                        >
                            {day}
                        </Text>
                        {/* Red X mark for blocked dates */}
                        {isBlocked && (
                            <View style={styles.blockedXContainer}>
                                <X size={16} color="#EF4444" strokeWidth={3} />
                            </View>
                        )}
                    </Pressable>
                </View>
            );
        }

        return days;
    };

    return (
        <View style={[styles.calendar, { backgroundColor: colors.card }]}>
            {/* Header */}
            <View style={styles.header}>
                <Pressable style={[styles.navButton, { backgroundColor: colors.muted }]} onPress={goToPreviousMonth}>
                    <ChevronLeft size={20} color={colors.foreground} />
                </Pressable>
                <Text style={[styles.monthYear, { color: colors.foreground }]}>
                    {monthNames[month]} {year}
                </Text>
                <Pressable style={[styles.navButton, { backgroundColor: colors.muted }]} onPress={goToNextMonth}>
                    <ChevronRight size={20} color={colors.foreground} />
                </Pressable>
            </View>

            {/* Day names */}
            <View style={styles.dayNamesRow}>
                {dayNames.map((dayName) => (
                    <View key={dayName} style={styles.dayNameCell}>
                        <Text style={[styles.dayName, { color: colors.mutedForeground }]}>{dayName}</Text>
                    </View>
                ))}
            </View>

            {/* Calendar grid */}
            <View style={styles.daysGrid}>
                {renderCalendarDays()}
            </View>

            {/* Legend */}
            {blockedBeforeDateParsed && (
                <View style={styles.legend}>
                    <View style={styles.legendItem}>
                        <X size={14} color="#EF4444" strokeWidth={3} />
                        <Text style={[styles.legendText, { color: colors.mutedForeground }]}>Already Paid</Text>
                    </View>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    calendar: {
        borderRadius: 12,
        padding: 16,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    navButton: {
        width: 36,
        height: 36,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    monthYear: {
        fontSize: 18,
        fontWeight: '600',
    },
    dayNamesRow: {
        flexDirection: 'row',
        marginBottom: 8,
    },
    dayNameCell: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 8,
    },
    dayName: {
        fontSize: 12,
        fontWeight: '500',
    },
    daysGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    dayCell: {
        width: '14.28%',
        aspectRatio: 1,
        padding: 2,
    },
    dayButton: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 8,
        position: 'relative',
    },
    dayText: {
        fontSize: 14,
    },
    blockedXContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
    },
    legend: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(128, 128, 128, 0.2)',
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    legendText: {
        fontSize: 12,
    },
});
