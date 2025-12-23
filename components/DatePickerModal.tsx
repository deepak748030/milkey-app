import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, ScrollView } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react-native';

interface DatePickerModalProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (date: string) => void;
    selectedDate?: string;
    title?: string;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function DatePickerModal({ visible, onClose, onSelect, selectedDate, title = 'Select Date' }: DatePickerModalProps) {
    const { colors, isDark } = useTheme();

    const initialDate = selectedDate ? new Date(selectedDate) : new Date();
    const [currentMonth, setCurrentMonth] = useState(initialDate.getMonth());
    const [currentYear, setCurrentYear] = useState(initialDate.getFullYear());

    const getDaysInMonth = (month: number, year: number) => {
        return new Date(year, month + 1, 0).getDate();
    };

    const getFirstDayOfMonth = (month: number, year: number) => {
        return new Date(year, month, 1).getDay();
    };

    const handlePrevMonth = () => {
        if (currentMonth === 0) {
            setCurrentMonth(11);
            setCurrentYear(currentYear - 1);
        } else {
            setCurrentMonth(currentMonth - 1);
        }
    };

    const handleNextMonth = () => {
        if (currentMonth === 11) {
            setCurrentMonth(0);
            setCurrentYear(currentYear + 1);
        } else {
            setCurrentMonth(currentMonth + 1);
        }
    };

    const handleSelectDate = (day: number) => {
        const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        onSelect(dateStr);
        onClose();
    };

    const renderCalendar = () => {
        const daysInMonth = getDaysInMonth(currentMonth, currentYear);
        const firstDay = getFirstDayOfMonth(currentMonth, currentYear);
        const days = [];

        // Empty cells for days before the first day
        for (let i = 0; i < firstDay; i++) {
            days.push(<View key={`empty-${i}`} style={styles.dayCell} />);
        }

        // Actual days
        const selectedParts = selectedDate?.split('-');
        const selectedYear = selectedParts ? parseInt(selectedParts[0]) : null;
        const selectedMonth = selectedParts ? parseInt(selectedParts[1]) - 1 : null;
        const selectedDay = selectedParts ? parseInt(selectedParts[2]) : null;

        const today = new Date();
        const isToday = (day: number) =>
            today.getDate() === day &&
            today.getMonth() === currentMonth &&
            today.getFullYear() === currentYear;

        const isSelected = (day: number) =>
            selectedYear === currentYear &&
            selectedMonth === currentMonth &&
            selectedDay === day;

        for (let day = 1; day <= daysInMonth; day++) {
            days.push(
                <Pressable
                    key={day}
                    style={[
                        styles.dayCell,
                        isToday(day) && { backgroundColor: colors.secondary },
                        isSelected(day) && { backgroundColor: colors.primary }
                    ]}
                    onPress={() => handleSelectDate(day)}
                >
                    <Text style={[
                        styles.dayText,
                        { color: colors.foreground },
                        isSelected(day) && { color: colors.white }
                    ]}>
                        {day}
                    </Text>
                </Pressable>
            );
        }

        return days;
    };

    const styles = createStyles(colors, isDark);

    return (
        <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={styles.container}>
                    <View style={styles.header}>
                        <Text style={styles.title}>{title}</Text>
                        <Pressable onPress={onClose}>
                            <X size={20} color={colors.foreground} />
                        </Pressable>
                    </View>

                    <View style={styles.monthSelector}>
                        <Pressable onPress={handlePrevMonth} style={styles.navBtn}>
                            <ChevronLeft size={20} color={colors.foreground} />
                        </Pressable>
                        <Text style={styles.monthYearText}>
                            {MONTHS[currentMonth]} {currentYear}
                        </Text>
                        <Pressable onPress={handleNextMonth} style={styles.navBtn}>
                            <ChevronRight size={20} color={colors.foreground} />
                        </Pressable>
                    </View>

                    <View style={styles.daysHeader}>
                        {DAYS.map(day => (
                            <Text key={day} style={styles.dayHeaderText}>{day}</Text>
                        ))}
                    </View>

                    <View style={styles.daysGrid}>
                        {renderCalendar()}
                    </View>

                    <View style={styles.footer}>
                        <Pressable style={styles.todayBtn} onPress={() => {
                            const today = new Date();
                            const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                            onSelect(dateStr);
                            onClose();
                        }}>
                            <Calendar size={14} color={colors.primary} />
                            <Text style={styles.todayBtnText}>Today</Text>
                        </Pressable>
                        <Pressable style={styles.closeBtn} onPress={onClose}>
                            <Text style={styles.closeBtnText}>Cancel</Text>
                        </Pressable>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    container: {
        backgroundColor: colors.background,
        borderRadius: 16,
        width: '100%',
        maxWidth: 340,
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    title: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.foreground,
    },
    monthSelector: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 12,
    },
    navBtn: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: colors.secondary,
    },
    monthYearText: {
        fontSize: 15,
        fontWeight: '600',
        color: colors.foreground,
    },
    daysHeader: {
        flexDirection: 'row',
        paddingHorizontal: 8,
        paddingBottom: 8,
    },
    dayHeaderText: {
        flex: 1,
        textAlign: 'center',
        fontSize: 12,
        fontWeight: '600',
        color: colors.mutedForeground,
    },
    daysGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: 8,
        paddingBottom: 12,
    },
    dayCell: {
        width: '14.28%',
        aspectRatio: 1,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 8,
    },
    dayText: {
        fontSize: 14,
        fontWeight: '500',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        gap: 12,
    },
    todayBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        borderRadius: 8,
        backgroundColor: colors.secondary,
    },
    todayBtnText: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.primary,
    },
    closeBtn: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: 8,
        backgroundColor: colors.muted,
    },
    closeBtnText: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.foreground,
    },
});
