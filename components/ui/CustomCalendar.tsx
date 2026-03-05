import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { AppText } from '~/components/ds';
import { Ionicons } from '@expo/vector-icons';

interface CustomCalendarProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  minimumDate?: Date;
}

// Días de semana en español, empezando el lunes
const DAYS_OF_WEEK = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function CustomCalendar({
  selectedDate,
  onDateChange,
  minimumDate = new Date(),
}: CustomCalendarProps) {
  const today = startOfDay(new Date());
  const minDate = startOfDay(minimumDate);

  // El mes actual nunca puede ser menor al mes de hoy
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date(selectedDate);
    d.setDate(1);
    return d;
  });

  const isCurrentOrFutureMonth = () => {
    return (
      currentMonth.getFullYear() > today.getFullYear() ||
      (currentMonth.getFullYear() === today.getFullYear() &&
        currentMonth.getMonth() >= today.getMonth())
    );
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(newMonth.getMonth() + (direction === 'next' ? 1 : -1));

    // No permitir navegar a meses anteriores al de hoy
    const todayFirstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    if (newMonth < todayFirstOfMonth) return;

    setCurrentMonth(newMonth);
  };

  const getDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // getDay(): 0=Dom, 1=Lun, ..., 6=Sáb
    // Convertir a base Lunes: 0=Lun, 1=Mar, ..., 6=Dom
    const rawDay = firstDay.getDay();
    const firstDayOffset = rawDay === 0 ? 6 : rawDay - 1;

    const days: {
      date: Date;
      isCurrentMonth: boolean;
      isSelected: boolean;
      isDisabled: boolean;
    }[] = [];

    // Rellenar con días del mes anterior
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    for (let i = firstDayOffset - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, daysInPrevMonth - i),
        isCurrentMonth: false,
        isSelected: false,
        isDisabled: true,
      });
    }

    // Días del mes actual
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month, i);
      days.push({
        date,
        isCurrentMonth: true,
        isSelected: date.toDateString() === selectedDate.toDateString(),
        isDisabled: date < minDate,
      });
    }

    // Rellenar solo la última fila incompleta
    const remainder = days.length % 7;
    if (remainder !== 0) {
      const fill = 7 - remainder;
      for (let i = 1; i <= fill; i++) {
        days.push({
          date: new Date(year, month + 1, i),
          isCurrentMonth: false,
          isSelected: false,
          isDisabled: true,
        });
      }
    }

    return days;
  };

  const formatMonthYear = (date: Date) => {
    const formatted = date.toLocaleDateString('es-ES', {
      month: 'long',
      year: 'numeric',
    });
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  };

  const days = getDays();
  const canGoPrev = !isCurrentOrFutureMonth() || (() => {
    const firstOfCurrent = new Date(today.getFullYear(), today.getMonth(), 1);
    const firstOfShown = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    return firstOfShown > firstOfCurrent;
  })();

  return (
    <View style={styles.container}>
      <View style={styles.calendarContainer}>
        {/* Navegación mes/año */}
        <View style={styles.navigationContainer}>
          <TouchableOpacity
            style={[styles.navButton, !canGoPrev && styles.navButtonDisabled]}
            onPress={() => navigateMonth('prev')}
            disabled={!canGoPrev}
          >
            <Ionicons name="chevron-back" size={20} color={canGoPrev ? '#FFFFFF' : '#4A5568'} />
          </TouchableOpacity>

          <AppText style={styles.monthYearText}>
            {formatMonthYear(currentMonth)}
          </AppText>

          <TouchableOpacity style={styles.navButton} onPress={() => navigateMonth('next')}>
            <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Cabecera días de semana */}
        <View style={styles.daysHeader}>
          {DAYS_OF_WEEK.map((day) => (
            <AppText key={day} style={styles.dayHeaderText}>{day}</AppText>
          ))}
        </View>

        {/* Grid del calendario */}
        <View style={styles.calendarGrid}>
          {days.map((day, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.dayButton,
                day.isSelected && styles.selectedDay,
              ]}
              onPress={() => onDateChange(day.date)}
              disabled={day.isDisabled || !day.isCurrentMonth}
              activeOpacity={0.7}
            >
              <AppText
                style={[
                  styles.dayText,
                  day.isSelected && styles.selectedDayText,
                  (!day.isCurrentMonth || day.isDisabled) && styles.disabledDayText,
                ]}
              >
                {day.date.getDate()}
              </AppText>
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
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
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
  navButtonDisabled: {
    backgroundColor: '#1A2332',
  },
  monthYearText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  daysHeader: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  dayHeaderText: {
    flex: 1,
    textAlign: 'center',
    color: '#A3B3CC',
    fontSize: 12,
    fontWeight: '600',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayButton: {
    width: `${100 / 7}%` as any,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 2,
  },
  selectedDay: {
    backgroundColor: '#1D4ED8',
    borderRadius: 8,
  },
  dayText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  selectedDayText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  disabledDayText: {
    color: '#2A3A4A',
  },
});
