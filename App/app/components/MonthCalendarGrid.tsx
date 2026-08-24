// app/components/MonthCalendarGrid.tsx
//
// Calendario mensile a griglia (6x7), estratto da app/index.tsx (2026-08-24) per essere condiviso
// con la nuova schermata Calendario unificata — self-contained: gestisce da solo mese mostrato,
// swipe tra mesi e la modale di scelta quando un giorno ha più eventi. Nessun tap-per-creare (solo
// per aprire un evento esistente), stessa scelta già presa in Dashboard.
import { useMemo, useRef, useState } from 'react';
import { Modal, PanResponder, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { CalendarEvent } from '../data/events';

function pad2(n: number) {
  return String(n).padStart(2, '0');
}
function fmtYMDLocal(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

type Props = {
  events: CalendarEvent[];
  onSelectEvent: (ev: CalendarEvent) => void;
};

export default function MonthCalendarGrid({ events, onSelectEvent }: Props) {
  const { width } = useWindowDimensions();
  const isWide = width >= 700;

  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const [dayPickerEvents, setDayPickerEvents] = useState<CalendarEvent[] | null>(null);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of events) {
      const arr = map.get(ev.date) ?? [];
      arr.push(ev);
      map.set(ev.date, arr);
    }
    return map;
  }, [events]);

  const pillColor = (ev: CalendarEvent) => (ev.type === 'PARTITA' ? '#e74c3c' : '#1b7f3b');

  const formatEventPill = (ev: CalendarEvent) => {
    if (ev.type === 'ALLENAMENTO') {
      const tema = ev.temaAllenamento ? ` · ${ev.temaAllenamento}` : '';
      const comp = (ev as any).competition ? ` · ${(ev as any).competition}` : '';
      return `Allenamento${tema}${comp}`;
    }
    const opp = ev.opponent || 'Avversario';
    const ha = (ev as any).homeAway as 'CASA' | 'TRASFERTA' | undefined;
    const titolo = ha === 'TRASFERTA' ? `${opp} - Ellera` : `Ellera - ${opp}`;
    const comp = (ev as any).competition ? ` · ${(ev as any).competition}` : '';
    return `${titolo}${comp}`;
  };

  const shiftMonth = (delta: number) => {
    setViewMonth((prev) => {
      const next = new Date(prev);
      next.setDate(1);
      next.setMonth(next.getMonth() + delta);
      return next;
    });
  };
  const goToCurrentMonth = () => {
    const d = new Date();
    d.setDate(1);
    setViewMonth(d);
  };
  const isCurrentMonthShown = fmtYMDLocal(viewMonth).slice(0, 7) === fmtYMDLocal(new Date()).slice(0, 7);

  const handleDayPress = (list: CalendarEvent[]) => {
    if (list.length === 0) return;
    if (list.length === 1) {
      onSelectEvent(list[0]);
      return;
    }
    setDayPickerEvents(list);
  };

  const renderMonthGrid = () => {
    const today = new Date();
    const currentMonth = viewMonth.getMonth();
    const currentYear = viewMonth.getFullYear();
    const firstDay = new Date(currentYear, currentMonth, 1);
    const startDate = new Date(firstDay);
    // settimana che inizia di Lunedì
    const weekday = firstDay.getDay() === 0 ? 7 : firstDay.getDay(); // 1..7
    startDate.setDate(startDate.getDate() - (weekday - 1));

    const cells: React.ReactElement[] = [];
    const cursor = new Date(startDate);

    for (let i = 0; i < 42; i++) {
      const d = cursor.getDate();
      const isCurrentMonth = cursor.getMonth() === currentMonth;
      const isToday = fmtYMDLocal(cursor) === fmtYMDLocal(today);
      const dateStr = fmtYMDLocal(cursor);
      const list = eventsByDate.get(dateStr) || [];

      const topTwo = list.slice(0, 2);
      const more = list.length - topTwo.length;

      cells.push(
        <Pressable
          key={dateStr}
          style={[styles.dayCell, !isCurrentMonth && styles.otherMonth, isToday && styles.todayCell]}
          onPress={() => handleDayPress(list)}
        >
          <Text
            style={[
              styles.dayNumber,
              isWide && styles.dayNumberWide,
              !isCurrentMonth && styles.otherMonthText,
              isToday && styles.todayNumber,
            ]}
          >
            {d}
          </Text>

          <View style={styles.pillsWrap}>
            {topTwo.map((ev) => (
              <View key={ev.id} style={[styles.pill, { backgroundColor: pillColor(ev) }]}>
                <Text style={[styles.pillText, isWide && styles.pillTextWide]} numberOfLines={1}>
                  {formatEventPill(ev)}
                </Text>
              </View>
            ))}
            {more > 0 && (
              <View style={[styles.pill, styles.morePill]}>
                <Text style={[styles.pillText, isWide && styles.pillTextWide, { color: '#111' }]}>+{more}</Text>
              </View>
            )}
          </View>
        </Pressable>
      );

      cursor.setDate(cursor.getDate() + 1);
    }

    return cells;
  };

  const monthPanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, gesture) =>
        Math.abs(gesture.dx) > 20 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 2,
      onPanResponderRelease: (_evt, gesture) => {
        if (gesture.dx < -50) shiftMonth(1);
        else if (gesture.dx > 50) shiftMonth(-1);
      },
    })
  ).current;

  return (
    <>
      <View style={styles.miniCalendar}>
        <View style={styles.monthNavRow}>
          <Pressable style={styles.monthNavBtn} onPress={() => shiftMonth(-1)} hitSlop={8}>
            <Text style={styles.monthNavBtnText}>‹</Text>
          </Pressable>
          <Text style={styles.monthTitle}>
            {viewMonth.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}
          </Text>
          <Pressable style={styles.monthNavBtn} onPress={() => shiftMonth(1)} hitSlop={8}>
            <Text style={styles.monthNavBtnText}>›</Text>
          </Pressable>
        </View>
        {!isCurrentMonthShown && (
          <Pressable style={styles.todayLinkBtn} onPress={goToCurrentMonth}>
            <Text style={styles.todayLinkText}>Torna a oggi</Text>
          </Pressable>
        )}

        <View style={styles.weekDays}>
          {['L', 'M', 'M', 'G', 'V', 'S', 'D'].map((d, i) => (
            <Text key={i} style={styles.weekDay}>
              {d}
            </Text>
          ))}
        </View>

        <View style={styles.daysGrid} {...monthPanResponder.panHandlers}>{renderMonthGrid()}</View>

        <Text style={styles.calendarInfo}>
          {events.length} eventi totali ·{' '}
          {
            events.filter((ev) => {
              const [hh, mm] = (ev.time || '00:00').split(':').map(Number);
              const [y, m, day] = ev.date.split('-').map(Number);
              return new Date(y, (m ?? 1) - 1, day ?? 1, hh ?? 0, mm ?? 0) >= new Date();
            }).length
          }{' '}
          futuri
        </Text>
      </View>

      <Modal
        visible={!!dayPickerEvents}
        transparent
        animationType="fade"
        onRequestClose={() => setDayPickerEvents(null)}
      >
        <Pressable style={styles.dayPickerOverlay} onPress={() => setDayPickerEvents(null)}>
          <View style={styles.dayPickerCard}>
            <Text style={styles.dayPickerTitle}>Eventi del giorno</Text>
            {dayPickerEvents?.map((ev) => (
              <Pressable
                key={ev.id}
                style={styles.dayPickerItem}
                onPress={() => {
                  setDayPickerEvents(null);
                  onSelectEvent(ev);
                }}
              >
                <View style={[styles.dayPickerDot, { backgroundColor: pillColor(ev) }]} />
                <Text style={styles.dayPickerItemText} numberOfLines={1}>
                  {formatEventPill(ev)}
                </Text>
              </Pressable>
            ))}
            <Pressable style={styles.dayPickerCancel} onPress={() => setDayPickerEvents(null)}>
              <Text style={styles.dayPickerCancelText}>Annulla</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  miniCalendar: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  monthNavRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthNavBtn: { paddingHorizontal: 14, paddingVertical: 4 },
  monthNavBtnText: { fontSize: 22, fontWeight: '700', color: '#1b7f3b' },
  monthTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#1a202c',
    textAlign: 'center',
    textTransform: 'capitalize',
  },
  todayLinkBtn: { alignSelf: 'center', marginTop: 4, marginBottom: 8 },
  todayLinkText: { fontSize: 13, fontWeight: '700', color: '#1b7f3b' },
  weekDays: { flexDirection: 'row', marginBottom: 8, marginTop: 12 },
  weekDay: {
    flex: 1,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    paddingVertical: 8,
  },

  daysGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 },
  dayCell: {
    width: '14.28571%',
    aspectRatio: 1,
    position: 'relative',
    paddingTop: 6,
    paddingHorizontal: 4,
  },
  dayNumber: { fontSize: 12, color: '#1a202c', fontWeight: '700' },
  dayNumberWide: { fontSize: 14 },
  todayCell: { borderWidth: 1, borderColor: '#1b7f3b', borderRadius: 8 },
  todayNumber: { color: '#1b7f3b' },
  otherMonth: { opacity: 0.35 },
  otherMonthText: { color: '#999' },

  pillsWrap: { marginTop: 4, gap: 2 },
  pill: { borderRadius: 4, paddingHorizontal: 4, paddingVertical: 2, minHeight: 18 },
  pillText: { color: 'white', fontSize: 10, fontWeight: '700' },
  pillTextWide: { fontSize: 11 },
  morePill: { backgroundColor: '#e5e7eb' },

  calendarInfo: { fontSize: 14, color: '#666', textAlign: 'center', marginTop: 8 },

  dayPickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  dayPickerCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16 },
  dayPickerTitle: { fontSize: 16, fontWeight: '700', color: '#1a202c', marginBottom: 8, textAlign: 'center' },
  dayPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  dayPickerDot: { width: 8, height: 8, borderRadius: 4 },
  dayPickerItemText: { flex: 1, fontSize: 15, fontWeight: '600', color: '#1a202c' },
  dayPickerCancel: { alignItems: 'center', paddingVertical: 14, marginTop: 4 },
  dayPickerCancelText: { fontSize: 15, fontWeight: '700', color: '#64748b' },
});
