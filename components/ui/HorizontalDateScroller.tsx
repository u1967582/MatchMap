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
      const offset = Math.max(0, (selectedIndex * 75) - (width / 2) + 37.5);
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

              {today && (
                <View style={styles.todayIndicator}>
                  <Text style={styles.todayText}>HOY</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  scrollContent: {
    paddingHorizontal: 4,
    gap: 10,
  },
  dateItem: {
    width: 65,
    paddingVertical: 14,
    paddingHorizontal: 6,
    borderRadius: 12,
    backgroundColor: '#1E3A5F',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  dateItemSelected: {
    backgroundColor: '#1976D2',
    borderColor: '#1976D2',
    transform: [{ scale: 1.05 }],
  },
  dayOfWeek: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8E9AAF',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  dayOfWeekSelected: {
    color: '#FFFFFF',
  },
  dayOfWeekToday: {
    color: '#4CAF50',
  },
  dayNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  dayNumberSelected: {
    color: '#FFFFFF',
  },
  dayNumberToday: {
    color: '#4CAF50',
  },
  month: {
    fontSize: 11,
    fontWeight: '500',
    color: '#8E9AAF',
    textTransform: 'uppercase',
  },
  monthSelected: {
    color: '#FFFFFF',
  },
  monthToday: {
    color: '#4CAF50',
  },
  todayIndicator: {
    position: 'absolute',
    top: 2,
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  todayText: {
    fontSize: 7,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
});

