import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';

interface CalendarProps {
  onDateSelect: (date: Date) => void;
  selectedDate: Date | null;
  bookedDates?: string[]; // Array of ISO date strings (YYYY-MM-DD)
}

export function Calendar({ onDateSelect, selectedDate, bookedDates = [] }: CalendarProps) {
  const { colors } = useTheme();
  const [currentMonth, setCurrentMonth] = useState(new Date());

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

  const isDateBooked = (day: number) => {
    const date = new Date(year, month, day);
    const dateStr = date.toISOString().split('T')[0];
    return bookedDates.includes(dateStr);
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
      const isBooked = isDateBooked(day);
      const isTodayDate = isToday(day);

      days.push(
        <View key={day} style={styles.dayCell}>
          <Pressable
            style={[
              styles.dayButton,
              { backgroundColor: 'transparent' },
              isSelected && { backgroundColor: colors.primary },
              isBooked && { backgroundColor: colors.destructive, opacity: 0.7 },
              isTodayDate && !isSelected && { borderWidth: 1, borderColor: colors.primary },
            ]}
            onPress={() => handleDatePress(day)}
            disabled={isBooked}
          >
            <Text
              style={[
                styles.dayText,
                { color: colors.foreground },
                isSelected && { color: colors.primaryForeground, fontWeight: '600' },
                isBooked && { color: colors.primaryForeground },
                isTodayDate && !isSelected && { color: colors.primary, fontWeight: '600' },
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
            <Text style={[styles.dayNameText, { color: colors.mutedForeground }]}>{dayName}</Text>
          </View>
        ))}
      </View>

      {/* Calendar grid */}
      <View style={styles.calendarGrid}>
        {renderCalendarDays()}
      </View>
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
    padding: 8,
    borderRadius: 8,
  },
  monthYear: {
    fontSize: 16,
    fontWeight: '600',
  },
  dayNamesRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  dayNameCell: {
    width: '14.28%',
    alignItems: 'center',
    paddingVertical: 8,
  },
  dayNameText: {
    fontSize: 12,
    fontWeight: '500',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: {
    fontSize: 14,
    textAlign: 'center',
  },
});