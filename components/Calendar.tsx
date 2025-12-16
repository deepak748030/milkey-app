import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { colors } from '@/lib/colors';

interface CalendarProps {
  onDateSelect: (date: Date) => void;
  selectedDate: Date | null;
  bookedDates?: string[]; // Array of ISO date strings (YYYY-MM-DD)
}

export function Calendar({ onDateSelect, selectedDate, bookedDates = [] }: CalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const today = new Date();
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
    if (date >= today) {
      onDateSelect(date);
    }
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

  const isDateDisabled = (day: number) => {
    const date = new Date(year, month, day);
    // Set time to 00:00:00 for comparison to ignore time part
    date.setHours(0, 0, 0, 0);
    const todayCompare = new Date();
    todayCompare.setHours(0, 0, 0, 0);
    return date < todayCompare;
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
      const isDisabled = isDateDisabled(day);
      const isBooked = isDateBooked(day);
      const isUnavailable = isDisabled || isBooked;

      days.push(
        <View key={day} style={styles.dayCell}>
          <Pressable
            style={[
              styles.dayButton,
              isSelected && styles.selectedDay,
              isDisabled && styles.disabledDay,
              isBooked && styles.bookedDay,
            ]}
            onPress={() => handleDatePress(day)}
            disabled={isUnavailable}
          >
            <Text
              style={[
                styles.dayText,
                isSelected && styles.selectedDayText,
                isDisabled && styles.disabledDayText,
                isBooked && styles.bookedDayText,
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
    <View style={styles.calendar}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.navButton} onPress={goToPreviousMonth}>
          <ChevronLeft size={20} color={colors.foreground} />
        </Pressable>
        <Text style={styles.monthYear}>
          {monthNames[month]} {year}
        </Text>
        <Pressable style={styles.navButton} onPress={goToNextMonth}>
          <ChevronRight size={20} color={colors.foreground} />
        </Pressable>
      </View>

      {/* Day names */}
      <View style={styles.dayNamesRow}>
        {dayNames.map((dayName) => (
          <View key={dayName} style={styles.dayNameCell}>
            <Text style={styles.dayNameText}>{dayName}</Text>
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
    backgroundColor: colors.card,
    borderRadius: 8,
    padding: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  navButton: {
    padding: 8,
    borderRadius: 6,
  },
  monthYear: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
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
    color: colors.mutedForeground,
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
  selectedDay: {
    backgroundColor: colors.primary,
  },
  disabledDay: {
    opacity: 0.3,
  },
  bookedDay: {
    backgroundColor: colors.destructive,
    opacity: 0.7,
  },
  dayText: {
    fontSize: 14,
    color: colors.foreground,
    textAlign: 'center',
  },
  selectedDayText: {
    color: colors.primaryForeground,
    fontWeight: '600',
  },
  disabledDayText: {
    color: colors.mutedForeground,
  },
  bookedDayText: {
    color: colors.primaryForeground,
  },
});
