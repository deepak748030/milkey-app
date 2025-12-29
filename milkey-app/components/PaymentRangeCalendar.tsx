import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Modal } from 'react-native';
import { ChevronLeft, ChevronRight, AlertCircle, X } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';

export interface BlockedPeriod {
    startDate: string; // YYYY-MM-DD
    endDate: string;   // YYYY-MM-DD
}

interface PaymentRangeCalendarProps {
    startDate: string | null;  // YYYY-MM-DD
    endDate: string | null;    // YYYY-MM-DD
    onStartDateSelect: (date: string) => void;
    onEndDateSelect: (date: string) => void;
    blockedPeriods?: BlockedPeriod[];
    selectingType: 'start' | 'end';
    onClose?: () => void;
}

// Helper to format date as YYYY-MM-DD
const formatDateStr = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// Helper to parse YYYY-MM-DD to Date
const parseDate = (dateStr: string): Date => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
};

// Check if two date ranges overlap
const rangesOverlap = (start1: Date, end1: Date, start2: Date, end2: Date): boolean => {
    return start1 <= end2 && end1 >= start2;
};

// Format date for display (DD MMM YYYY)
const formatDisplayDateFull = (dateStr: string): string => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${date.getDate()} ${months[date.getMonth()]} ${year}`;
};

export function PaymentRangeCalendar({
    startDate,
    endDate,
    onStartDateSelect,
    onEndDateSelect,
    blockedPeriods = [],
    selectingType,
    onClose,
}: PaymentRangeCalendarProps) {
    const { colors, isDark } = useTheme();
    const [currentMonth, setCurrentMonth] = useState(() => {
        if (startDate) {
            const d = parseDate(startDate);
            return new Date(d.getFullYear(), d.getMonth(), 1);
        }
        return new Date();
    });
    const [showOverlapModal, setShowOverlapModal] = useState(false);
    const [overlapMessage, setOverlapMessage] = useState<{ title: string; periods: string[] }>({ title: '', periods: [] });

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

    const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

    const goToPreviousMonth = () => {
        setCurrentMonth(new Date(year, month - 1, 1));
    };

    const goToNextMonth = () => {
        setCurrentMonth(new Date(year, month + 1, 1));
    };

    // Get all blocked dates as a Set for quick lookup
    const blockedDatesSet = useMemo(() => {
        const set = new Set<string>();
        blockedPeriods.forEach(period => {
            const start = parseDate(period.startDate);
            const end = parseDate(period.endDate);
            const current = new Date(start);
            while (current <= end) {
                set.add(formatDateStr(current));
                current.setDate(current.getDate() + 1);
            }
        });
        return set;
    }, [blockedPeriods]);

    // Check if a date is blocked
    const isDateBlocked = (dateStr: string): boolean => {
        return blockedDatesSet.has(dateStr);
    };

    // Get overlapping periods for a potential range
    const getOverlappingPeriods = (day: number): BlockedPeriod[] => {
        const dateStr = formatDateStr(new Date(year, month, day));
        const date = parseDate(dateStr);
        const overlapping: BlockedPeriod[] = [];

        if (selectingType === 'start') {
            if (endDate) {
                const end = parseDate(endDate);
                for (const period of blockedPeriods) {
                    const blockedStart = parseDate(period.startDate);
                    const blockedEnd = parseDate(period.endDate);
                    if (rangesOverlap(date, end, blockedStart, blockedEnd)) {
                        overlapping.push(period);
                    }
                }
            }
        } else {
            if (startDate) {
                const start = parseDate(startDate);
                for (const period of blockedPeriods) {
                    const blockedStart = parseDate(period.startDate);
                    const blockedEnd = parseDate(period.endDate);
                    if (rangesOverlap(start, date, blockedStart, blockedEnd)) {
                        overlapping.push(period);
                    }
                }
            }
        }
        return overlapping;
    };

    // Check if selecting this date would create an overlapping range
    const wouldCreateOverlap = (day: number): boolean => {
        return getOverlappingPeriods(day).length > 0;
    };

    const handleDatePress = (day: number) => {
        const dateStr = formatDateStr(new Date(year, month, day));

        if (isDateBlocked(dateStr)) {
            // Show modal for blocked date
            setOverlapMessage({
                title: 'This date is already in an existing payment period',
                periods: blockedPeriods
                    .filter(p => {
                        const start = parseDate(p.startDate);
                        const end = parseDate(p.endDate);
                        const date = parseDate(dateStr);
                        return date >= start && date <= end;
                    })
                    .map(p => `${formatDisplayDateFull(p.startDate)} → ${formatDisplayDateFull(p.endDate)}`)
            });
            setShowOverlapModal(true);
            return;
        }

        const overlapping = getOverlappingPeriods(day);
        if (overlapping.length > 0) {
            // Show modal with overlapping periods
            setOverlapMessage({
                title: 'Selected range would overlap with existing payment periods',
                periods: overlapping.map(p => `${formatDisplayDateFull(p.startDate)} → ${formatDisplayDateFull(p.endDate)}`)
            });
            setShowOverlapModal(true);
            return;
        }

        if (selectingType === 'start') {
            onStartDateSelect(dateStr);
        } else {
            onEndDateSelect(dateStr);
        }

        if (onClose) onClose();
    };

    const isStartDate = (day: number): boolean => {
        if (!startDate) return false;
        const dateStr = formatDateStr(new Date(year, month, day));
        return startDate === dateStr;
    };

    const isEndDate = (day: number): boolean => {
        if (!endDate) return false;
        const dateStr = formatDateStr(new Date(year, month, day));
        return endDate === dateStr;
    };

    const isInRange = (day: number): boolean => {
        if (!startDate || !endDate) return false;
        const dateStr = formatDateStr(new Date(year, month, day));
        const date = parseDate(dateStr);
        const start = parseDate(startDate);
        const end = parseDate(endDate);
        return date > start && date < end;
    };

    const isToday = (day: number): boolean => {
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
            const dateStr = formatDateStr(new Date(year, month, day));
            const isStart = isStartDate(day);
            const isEnd = isEndDate(day);
            const inRange = isInRange(day);
            const blocked = isDateBlocked(dateStr);
            const wouldOverlap = !blocked && wouldCreateOverlap(day);
            const isTodayDate = isToday(day);
            const isDisabled = blocked || wouldOverlap;
            const showRangeHighlight = inRange || (isStart && endDate) || (isEnd && startDate);

            days.push(
                <View key={day} style={styles.dayCell}>
                    {/* Range highlight bar */}
                    {showRangeHighlight && !blocked && (
                        <View
                            style={[
                                styles.rangeBar,
                                { backgroundColor: isDark ? 'rgba(34, 197, 94, 0.25)' : 'rgba(34, 197, 94, 0.12)' },
                                isStart && styles.rangeBarStart,
                                isEnd && styles.rangeBarEnd,
                                (isStart && isEnd) && styles.rangeBarHidden,
                            ]}
                        />
                    )}

                    <Pressable
                        style={({ pressed }) => [
                            styles.dayButton,
                            (isStart || isEnd) && [styles.dayButtonSelected, { backgroundColor: colors.primary }],
                            isTodayDate && !isStart && !isEnd && [styles.dayButtonToday, { borderColor: colors.primary }],
                            pressed && !isDisabled && styles.dayButtonPressed,
                        ]}
                        onPress={() => handleDatePress(day)}
                        disabled={isDisabled}
                    >
                        <Text
                            style={[
                                styles.dayText,
                                { color: colors.foreground },
                                (isStart || isEnd) && styles.dayTextSelected,
                                inRange && { color: colors.primary, fontWeight: '500' },
                                blocked && [styles.dayTextBlocked, { color: colors.mutedForeground }],
                                wouldOverlap && [styles.dayTextBlocked, { color: colors.mutedForeground }],
                                isTodayDate && !isStart && !isEnd && { color: colors.primary, fontWeight: '700' },
                            ]}
                        >
                            {day}
                        </Text>
                    </Pressable>
                </View>
            );
        }

        return days;
    };

    return (
        <View style={[styles.calendar, { backgroundColor: isDark ? colors.card : '#FFFFFF' }]}>
            {/* Header */}
            <View style={styles.headerRow}>
                <Text style={[styles.monthYear, { color: isDark ? '#F7FAFC' : '#1A202C' }]}>
                    {monthNames[month]} {year}
                </Text>
                <View style={styles.navRow}>
                    <Pressable
                        style={({ pressed }) => [
                            styles.navButton,
                            { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' },
                            pressed && { opacity: 0.7 }
                        ]}
                        onPress={goToPreviousMonth}
                    >
                        <ChevronLeft size={20} color={isDark ? '#A0AEC0' : '#718096'} />
                    </Pressable>
                    <Pressable
                        style={({ pressed }) => [
                            styles.navButton,
                            { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' },
                            pressed && { opacity: 0.7 }
                        ]}
                        onPress={goToNextMonth}
                    >
                        <ChevronRight size={20} color={isDark ? '#A0AEC0' : '#718096'} />
                    </Pressable>
                </View>
            </View>

            {/* Selecting indicator */}
            <View style={[styles.selectingIndicator, { backgroundColor: isDark ? 'rgba(34, 197, 94, 0.15)' : 'rgba(34, 197, 94, 0.08)' }]}>
                <Text style={[styles.selectingText, { color: colors.primary }]}>
                    Select {selectingType === 'start' ? 'Start' : 'End'} Date
                </Text>
            </View>

            {/* Day names row */}
            <View style={styles.dayNamesRow}>
                {dayNames.map((dayName, index) => (
                    <View key={`${dayName}-${index}`} style={styles.dayNameCell}>
                        <Text style={[styles.dayNameText, { color: isDark ? '#718096' : '#A0AEC0' }]}>
                            {dayName}
                        </Text>
                    </View>
                ))}
            </View>

            {/* Divider */}
            <View style={[styles.divider, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)' }]} />

            {/* Calendar grid */}
            <View style={styles.calendarGrid}>
                {renderCalendarDays()}
            </View>

            {/* Selected range display */}
            {(startDate || endDate) && (
                <View style={[styles.rangeDisplay, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F7FAFC' }]}>
                    <View style={styles.rangeDateBox}>
                        <Text style={[styles.rangeDateLabel, { color: colors.mutedForeground }]}>From</Text>
                        <Text style={[styles.rangeDateValue, { color: colors.foreground }]}>
                            {startDate ? formatDisplayDate(startDate) : '—'}
                        </Text>
                    </View>
                    <View style={[styles.rangeArrow, { backgroundColor: colors.primary }]}>
                        <Text style={styles.rangeArrowText}>→</Text>
                    </View>
                    <View style={styles.rangeDateBox}>
                        <Text style={[styles.rangeDateLabel, { color: colors.mutedForeground }]}>To</Text>
                        <Text style={[styles.rangeDateValue, { color: colors.foreground }]}>
                            {endDate ? formatDisplayDate(endDate) : '—'}
                        </Text>
                    </View>
                </View>
            )}

            {/* Overlap Warning Modal */}
            <Modal
                visible={showOverlapModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowOverlapModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: isDark ? colors.card : '#FFFFFF' }]}>
                        <View style={styles.modalHeader}>
                            <View style={[styles.modalIconContainer, { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : 'rgba(245, 158, 11, 0.1)' }]}>
                                <AlertCircle size={28} color="#F59E0B" />
                            </View>
                            <Pressable
                                style={({ pressed }) => [styles.modalCloseBtn, pressed && { opacity: 0.7 }]}
                                onPress={() => setShowOverlapModal(false)}
                            >
                                <X size={20} color={isDark ? '#A0AEC0' : '#718096'} />
                            </Pressable>
                        </View>

                        <Text style={[styles.modalTitle, { color: isDark ? '#F7FAFC' : '#1A202C' }]}>
                            Date Conflict
                        </Text>
                        <Text style={[styles.modalMessage, { color: isDark ? '#A0AEC0' : '#718096' }]}>
                            {overlapMessage.title}
                        </Text>

                        {overlapMessage.periods.length > 0 && (
                            <View style={[styles.periodsContainer, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F7FAFC' }]}>
                                <Text style={[styles.periodsLabel, { color: isDark ? '#718096' : '#A0AEC0' }]}>
                                    Existing Period{overlapMessage.periods.length > 1 ? 's' : ''}:
                                </Text>
                                {overlapMessage.periods.map((period, index) => (
                                    <Text key={index} style={[styles.periodText, { color: isDark ? '#F59E0B' : '#D97706' }]}>
                                        {period}
                                    </Text>
                                ))}
                            </View>
                        )}

                        <Pressable
                            style={({ pressed }) => [
                                styles.modalButton,
                                { backgroundColor: colors.primary },
                                pressed && { opacity: 0.9 }
                            ]}
                            onPress={() => setShowOverlapModal(false)}
                        >
                            <Text style={styles.modalButtonText}>Got it</Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

// Format date for display (DD MMM)
const formatDisplayDate = (dateStr: string): string => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${date.getDate()} ${months[date.getMonth()]}`;
};

const styles = StyleSheet.create({
    calendar: {
        borderRadius: 20,
        padding: 20,
        paddingTop: 18,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 5,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    monthYear: {
        fontSize: 18,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    navRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    navButton: {
        width: 36,
        height: 36,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    selectingIndicator: {
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 8,
        alignSelf: 'flex-start',
        marginBottom: 14,
    },
    selectingText: {
        fontSize: 13,
        fontWeight: '600',
    },
    dayNamesRow: {
        flexDirection: 'row',
        marginBottom: 6,
    },
    dayNameCell: {
        width: '14.28%',
        alignItems: 'center',
        paddingVertical: 8,
    },
    dayNameText: {
        fontSize: 13,
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    divider: {
        height: 1,
        marginBottom: 8,
    },
    calendarGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    dayCell: {
        width: '14.28%',
        height: 48,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    rangeBar: {
        position: 'absolute',
        top: 8,
        bottom: 8,
        left: 0,
        right: 0,
    },
    rangeBarStart: {
        left: '50%',
    },
    rangeBarEnd: {
        right: '50%',
    },
    rangeBarHidden: {
        display: 'none',
    },
    dayButton: {
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1,
    },
    dayButtonSelected: {
        shadowColor: '#4285F4',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 3,
    },
    dayButtonToday: {
        borderWidth: 2,
    },
    dayButtonPressed: {
        opacity: 0.7,
        transform: [{ scale: 0.95 }],
    },
    dayText: {
        fontSize: 15,
        textAlign: 'center',
    },
    dayTextSelected: {
        color: '#FFFFFF',
        fontWeight: '700',
    },
    dayTextBlocked: {
        textDecorationLine: 'line-through',
    },
    rangeDisplay: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 16,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        gap: 12,
    },
    rangeDateBox: {
        alignItems: 'center',
        flex: 1,
    },
    rangeDateLabel: {
        fontSize: 11,
        fontWeight: '500',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 2,
    },
    rangeDateValue: {
        fontSize: 16,
        fontWeight: '700',
    },
    rangeArrow: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rangeArrowText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    modalContent: {
        width: '100%',
        maxWidth: 340,
        borderRadius: 20,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 24,
        elevation: 10,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    modalIconContainer: {
        width: 52,
        height: 52,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalCloseBtn: {
        padding: 4,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        marginBottom: 8,
    },
    modalMessage: {
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 16,
    },
    periodsContainer: {
        padding: 14,
        borderRadius: 12,
        marginBottom: 20,
    },
    periodsLabel: {
        fontSize: 11,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 8,
    },
    periodText: {
        fontSize: 14,
        fontWeight: '600',
        marginTop: 4,
    },
    modalButton: {
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    modalButtonText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '700',
    },
});
