// app/components/CompactCalendar.tsx
import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { CalendarEvent } from '../data/events';

interface CompactCalendarProps {
  events: CalendarEvent[];
  onDateSelect?: (date: string) => void;
}

export function CompactCalendar({ events, onDateSelect }: CompactCalendarProps) {
  const [currentDate] = useState(new Date());
  
  const today = new Date();
  const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  
  // Get days of current month
  const daysInMonth = useMemo(() => {
    const days = [];
    for (let day = 1; day <= endOfMonth.getDate(); day++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
      const dateStr = date.toISOString().split('T')[0];
      const dayEvents = events.filter(event => event.date === dateStr);
      
      days.push({
        day,
        date: dateStr,
        isToday: dateStr === today.toISOString().split('T')[0],
        hasEvents: dayEvents.length > 0,
        events: dayEvents,
      });
    }
    return days;
  }, [currentDate, events, today]);

  const monthName = currentDate.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });

  return (
    <View style={styles.container}>
      <Text style={styles.monthTitle}>{monthName}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.daysContainer}>
          {daysInMonth.map((dayInfo) => (
            <Pressable
              key={dayInfo.day}
              style={[
                styles.dayCard,
                dayInfo.isToday && styles.todayCard,
                dayInfo.hasEvents && styles.hasEventsCard
              ]}
              onPress={() => onDateSelect?.(dayInfo.date)}
            >
              <Text style={[
                styles.dayNumber,
                dayInfo.isToday && styles.todayText,
                dayInfo.hasEvents && styles.hasEventsText
              ]}>
                {dayInfo.day}
              </Text>
              {dayInfo.hasEvents && (
                <View style={styles.eventDots}>
                  {dayInfo.events.slice(0, 3).map((event, index) => (
                    <View
                      key={index}
                      style={[
                        styles.eventDot,
                        { backgroundColor: event.type === 'PARTITA' ? '#e74c3c' : '#3498db' }
                      ]}
                    />
                  ))}
                </View>
              )}
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
    color: '#333',
  },
  daysContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  dayCard: {
    width: 50,
    height: 60,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  todayCard: {
    backgroundColor: '#1b7f3b',
    borderColor: '#1b7f3b',
  },
  hasEventsCard: {
    borderColor: '#3498db',
    borderWidth: 2,
  },
  dayNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  todayText: {
    color: '#fff',
  },
  hasEventsText: {
    color: '#3498db',
  },
  eventDots: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 4,
  },
  eventDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});