import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';

interface HorizontalDateScrollerProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  minimumDate?: Date;
  daysToShow?: number;
}

const { width } = Dimensions.get('window');

export default function HorizontalDateScroller({
  selectedDate,
  onDateChange,
  minimumDate = new Date(),
  daysToShow = 30,
}: HorizontalDateScrollerProps) {
  const scrollViewRef = useRef<ScrollView>(null);

  // Generate array of dates starting from today
  const generateDates = () => {
    const dates = [];
    const startDate = new Date(minimumDate);
    
    for (let i = 0; i < daysToShow; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      dates.push(date);
    }
    
    return dates;
  };

  const dates = generateDates();

  // Format day of week (short)
  const formatDayOfWeek = (date: Date) => {
    const days = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
    return days[date.getDay()];
  };

  // Format month (short)
  const formatMonth = (date: Date) => {
    const months = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
    return months[date.getMonth()];
  };

  // Check if date is today
  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  // Check if date is selected
  const isSelected = (date: Date) => {
    return date.toDateString() === selectedDate.toDateString();
  };

  // Scroll to selected date on mount
  useEffect(() => {
    const selectedIndex = dates.findIndex(date => isSelected(date));
    if (selectedIndex !== -1 && scrollViewRef.current) {
      // Scroll to center the selected date
      const offset = Math.max(0, (selectedIndex * 80) - (width / 2) + 40);
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ x: offset, animated: true });
      }, 100);
    }
  }, []);

  const handleDatePress = (date: Date) => {
    onDateChange(date);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        decelerationRate="fast"
      >
        {dates.map((date, index) => {
          const selected = isSelected(date);
          const today = isToday(date);

          return (
            <TouchableOpacity
              key={index}
              style={[
                styles.dateItem,
                selected && styles.dateItemSelected,
              ]}
              onPress={() => handleDatePress(date)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.dayOfWeek,
                selected && styles.dayOfWeekSelected,
                today && !selected && styles.dayOfWeekToday,
              ]}>
                {formatDayOfWeek(date)}
              </Text>
              
              <Text style={[
                styles.dayNumber,
                selected && styles.dayNumberSelected,
                today && !selected && styles.dayNumberToday,
              ]}>
                {date.getDate()}
              </Text>
              
              <Text style={[
                styles.month,
                selected && styles.monthSelected,
                today && !selected && styles.monthToday,
              ]}>
                {formatMonth(date)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
  },
  scrollContent: {
    paddingHorizontal: 8,
    gap: 12,
  },
  dateItem: {
    width: 68,
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
  },
  dateItemSelected: {
    backgroundColor: '#1976D2',
    borderWidth: 0,
  },
  dayOfWeek: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.5)',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dayOfWeekSelected: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  dayOfWeekToday: {
    color: '#F59E0B',
  },
  dayNumber: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  dayNumberSelected: {
    color: '#FFFFFF',
  },
  dayNumberToday: {
    color: '#F59E0B',
  },
  month: {
    fontSize: 10,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.5)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  monthSelected: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  monthToday: {
    color: '#F59E0B',
  },
});

