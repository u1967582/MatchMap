import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface CustomCalendarProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  minimumDate?: Date;
}

const { width } = Dimensions.get('window');

export default function CustomCalendar({ 
  selectedDate, 
  onDateChange, 
  minimumDate = new Date() 
}: CustomCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date(selectedDate));

  // Days of week in Spanish (Monday to Sunday)
  const daysOfWeek = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();

    // Get day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
    // Convert to Monday-based (0 = Monday, 1 = Tuesday, ..., 6 = Sunday)
    let firstDayOfWeek = firstDay.getDay();
    // Adjust: Monday = 0, Tuesday = 1, ..., Sunday = 6
    firstDayOfWeek = (firstDayOfWeek + 6) % 7;

    const days = [];

    // Add days from previous month to fill the first week
    if (firstDayOfWeek > 0) {
      const prevMonthDate = new Date(year, month, 0); // Last day of previous month
      const daysInPrevMonth = prevMonthDate.getDate();

      for (let i = firstDayOfWeek; i > 0; i--) {
        days.push({
          date: new Date(year, month - 1, daysInPrevMonth - i + 1),
          isCurrentMonth: false,
          isSelected: false,
          isDisabled: true,
        });
      }
    }

    // Add days from current month
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month, i);
      days.push({
        date,
        isCurrentMonth: true,
        isSelected: date.toDateString() === selectedDate.toDateString(),
        isDisabled: date < minimumDate,
      });
    }

    // Add days from next month to complete the grid
    const remainingDays = 42 - days.length; // 6 rows * 7 days
    for (let i = 1; i <= remainingDays; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
        isSelected: false,
        isDisabled: true,
      });
    }

    return days;
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newMonth = new Date(currentMonth);
    if (direction === 'prev') {
      newMonth.setMonth(newMonth.getMonth() - 1);
    } else {
      newMonth.setMonth(newMonth.getMonth() + 1);
    }
    setCurrentMonth(newMonth);
  };

  const handleDateSelect = (date: Date) => {
    if (date >= minimumDate) {
      onDateChange(date);
    }
  };

  const formatMonthYear = (date: Date) => {
    const formatted = date.toLocaleDateString('es-ES', {
      month: 'long',
      year: 'numeric',
    });
    // Capitalize first letter (español → Español)
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  };

  const days = getDaysInMonth(currentMonth);

  return (
    <View style={styles.container}>
      <View style={styles.calendarContainer}>
        {/* Month/Year Navigation */}
        <View style={styles.navigationContainer}>
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => navigateMonth('prev')}
          >
            <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          
          <Text style={styles.monthYearText}>
            {formatMonthYear(currentMonth)}
          </Text>
          
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => navigateMonth('next')}
          >
            <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Days of Week Header */}
        <View style={styles.daysHeader}>
          {daysOfWeek.map((day, index) => (
            <Text key={index} style={styles.dayHeaderText}>
              {day}
            </Text>
          ))}
        </View>

        {/* Calendar Grid */}
        <View style={styles.calendarGrid}>
          {days.map((day, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.dayButton,
                day.isSelected && styles.selectedDay,
                day.isDisabled && styles.disabledDay,
              ]}
              onPress={() => handleDateSelect(day.date)}
              disabled={day.isDisabled}
            >
              <Text
                style={[
                  styles.dayText,
                  day.isSelected && styles.selectedDayText,
                  !day.isCurrentMonth && styles.otherMonthDayText,
                  day.isDisabled && styles.disabledDayText,
                ]}
              >
                {day.date.getDate()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1C2A3A',
    borderRadius: 0,
    padding: 16,
    marginHorizontal: 0,
    marginVertical: 0,
    paddingBottom: 12,
  },

  calendarContainer: {
    backgroundColor: '#1A2332',
    borderRadius: 12,
    padding: 12,
  },
  navigationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  navButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2A3A4A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthYearText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  daysHeader: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  dayHeaderText: {
    flex: 1,
    textAlign: 'center',
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayButton: {
    width: (width - 120) / 7,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 1,
  },
  selectedDay: {
    backgroundColor: '#1D4ED8',
    borderRadius: 8,
  },
  disabledDay: {
    opacity: 0.3,
  },
  dayText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  selectedDayText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  otherMonthDayText: {
    color: '#8E8E93',
  },
  disabledDayText: {
    color: '#8E8E93',
  },
}); 