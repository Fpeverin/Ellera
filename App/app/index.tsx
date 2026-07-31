// app/index.tsx
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from './context/AuthContext';
import { CalendarEvent, loadEvents } from './data/events';
import { registerPushTokenForCurrentUser } from './data/pushNotify';
import TeamLogo from './components/TeamLogo';
import { scheduleEventReminders } from './utils/eventReminders';

/* ------------------ Helpers date in fuso locale (no UTC) ------------------ */
function pad2(n: number) {
  return String(n).padStart(2, '0');
}
function fmtYMDLocal(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function parseYMDTimeLocal(ymd: string, hhmm = '00:00') {
  const [y, m, day] = ymd.split('-').map(Number);
  const [hh, mm] = (hhmm || '00:00').split(':').map(Number);
  return new Date(y, (m ?? 1) - 1, day ?? 1, hh ?? 0, mm ?? 0, 0, 0);
}

/* ------------------------------ Component ------------------------------ */
const ROLE_LABELS: Record<string, string> = {
  admin: 'Amministratore',
  staff: 'Staff',
  giocatore: 'Giocatore',
};

export default function Dashboard() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWide = width >= 700;
  const { session, membership, signOut } = useAuth();
  const isGiocatore = membership?.role === 'giocatore';

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const [dayPickerEvents, setDayPickerEvents] = useState<CalendarEvent[] | null>(null);

  const refreshEvents = async () => {
    const list = await loadEvents();
    // ordina per data/ora
    list.sort(
      (a, b) =>
        parseYMDTimeLocal(a.date, a.time || '00:00').getTime() -
        parseYMDTimeLocal(b.date, b.time || '00:00').getTime()
    );
    setEvents(list);
    // Promemoria push (locali, solo giocatori): un avviso alle 09:00 del
    // giorno stesso per ogni allenamento/partita in calendario.
    if (membership?.role === 'giocatore') {
      scheduleEventReminders(list).catch((e) => console.error('Errore pianificazione promemoria', e));
    }
  };

  useFocusEffect(
    useCallback(() => {
      refreshEvents();
    }, [])
  );

  // Registra il push token del dispositivo per questo account (tutti i ruoli:
  // Staff/Admin ricevono notifiche di proposte/modifiche/sondaggi, Giocatore
  // di convocazioni/sondaggi) — una volta per sessione, non a ogni focus.
  useEffect(() => {
    if (membership?.orgId) {
      registerPushTokenForCurrentUser(membership.orgId);
    }
  }, [membership?.orgId]);

  /* --------------------- Mappa: eventi per data (YYYY-MM-DD) --------------------- */
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of events) {
      const arr = map.get(ev.date) ?? [];
      arr.push(ev);
      map.set(ev.date, arr);
    }
    return map;
  }, [events]);

  /* ------------------------- Blocco "Oggi / Domani" ------------------------- */
  const todayStr = fmtYMDLocal(new Date());
  const tomorrowStr = fmtYMDLocal(new Date(Date.now() + 24 * 60 * 60 * 1000));
  const todayEvents = useMemo(() => eventsByDate.get(todayStr) ?? [], [eventsByDate, todayStr]);
  const tomorrowEvents = useMemo(() => eventsByDate.get(tomorrowStr) ?? [], [eventsByDate, tomorrowStr]);

  /* ---------------------- Format e colori delle pill ---------------------- */
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

  const goToEvent = (ev: CalendarEvent) => {
    router.push(ev.type === 'PARTITA' ? `/eventi/partita/${ev.id}` : `/eventi/allenamento/${ev.id}`);
  };

  const renderDayBlock = (label: string, list: CalendarEvent[]) => (
    <View style={styles.dayBlock}>
      <Text style={styles.dayBlockLabel}>{label}</Text>
      {list.length === 0 ? (
        <Text style={styles.dayBlockEmpty}>Nessun impegno</Text>
      ) : (
        list.map((ev) => (
          <Pressable key={ev.id} style={styles.dayBlockRow} onPress={() => goToEvent(ev)}>
            <View style={[styles.dayBlockDot, { backgroundColor: pillColor(ev) }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.dayBlockTitle} numberOfLines={1}>
                {formatEventPill(ev)}
              </Text>
              <Text style={styles.dayBlockDetails}>
                {ev.time || '--:--'}
                {ev.location ? ` · ${ev.location}` : ''}
              </Text>
            </View>
          </Pressable>
        ))
      )}
    </View>
  );

  /* ------------------------- Navigazione mese ------------------------- */
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
      goToEvent(list[0]);
      return;
    }
    setDayPickerEvents(list);
  };

  /* ------------------------- Griglia calendario (6x7) ------------------------- */
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

  /* ------------------------- Swipe orizzontale tra mesi ------------------------- */
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

  const handleAccountPress = () => {
    const roleLabel = membership ? ROLE_LABELS[membership.role] ?? membership.role : '';
    Alert.alert(
      membership?.orgName || 'Account',
      `${session?.user?.email ?? ''}${roleLabel ? `\nRuolo: ${roleLabel}` : ''}`,
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Esci',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Uscire dall’account?', 'Potrai accedere di nuovo con questo o un altro account.', [
              { text: 'Annulla', style: 'cancel' },
              { text: 'Esci', style: 'destructive', onPress: () => signOut() },
            ]);
          },
        },
      ]
    );
  };

  /* --------------------------------- Render --------------------------------- */
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.innerContainer}>
        {/* Header + Calendario - scrollabile se non ci sta tutto in altezza
            (successo su schermi corti/webapp: senza scroll l'ultima riga del
            calendario restava tagliata, sul telefono "entrava" per caso) */}
        <ScrollView style={styles.topSection} contentContainerStyle={styles.topSectionContent}>
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <TeamLogo size={40} style={{ marginRight: 10 }} />
            <View>
              <Text style={styles.title}>{membership?.orgName || 'TeamBoard'}</Text>
              {membership && membership.role !== 'admin' && (
                <Text style={styles.subtitleName}>
                  {membership.displayName ? `${membership.displayName} · ` : ''}
                  {membership.role === 'staff' ? 'Staff' : 'Giocatore'}
                </Text>
              )}
            </View>
          </View>
          <Pressable style={styles.accountBtn} onPress={handleAccountPress}>
            <Text style={styles.accountBtnIcon}>👤</Text>
            <Text style={styles.accountBtnText}>Account</Text>
          </Pressable>
        </View>

        <View style={[styles.todayTomorrowSection, isWide && styles.calendarSectionWide]}>
          <Text style={styles.sectionTitle}>Oggi e domani</Text>
          <View style={styles.todayTomorrowCard}>
            {renderDayBlock('Oggi', todayEvents)}
            <View style={styles.daySeparator} />
            {renderDayBlock('Domani', tomorrowEvents)}
          </View>
        </View>

        <View style={[styles.calendarSection, isWide && styles.calendarSectionWide]}>
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

            {/* Giorni settimana */}
            <View style={styles.weekDays}>
              {['L', 'M', 'M', 'G', 'V', 'S', 'D'].map((d, i) => (
                <Text key={i} style={styles.weekDay}>
                  {d}
                </Text>
              ))}
            </View>

            {/* Griglia 6x7 (swipe orizzontale per cambiare mese) */}
            <View style={styles.daysGrid} {...monthPanResponder.panHandlers}>{renderMonthGrid()}</View>

            <Text style={styles.calendarInfo}>
              {events.length} eventi totali ·{' '}
              {
                events.filter((ev) => parseYMDTimeLocal(ev.date, ev.time || '00:00') >= new Date())
                  .length
              }{' '}
              futuri
            </Text>
          </View>
        </View>
        </ScrollView>
      </View>

      {/* Azioni rapide - sempre visibili sopra la barra di navigazione */}
      <View style={styles.actionsSection}>
        <Text style={styles.sectionTitle}>Azioni rapide</Text>
        <View style={styles.actions}>
           <Pressable style={styles.actionButton} onPress={() => router.push('/allenamenti')}>
            <Text style={styles.actionIcon}>🏃</Text>
            <Text style={styles.actionText}>Allenamenti</Text>
          </Pressable>
          <Pressable style={styles.actionButton} onPress={() => router.push('/partite')}>
            <Text style={styles.actionIcon}>🏆</Text>
            <Text style={styles.actionText}>Partite</Text>
          </Pressable>
          {isGiocatore ? (
            <Pressable style={styles.actionButton} onPress={() => router.push('/squadra/rosa')}>
              <Text style={styles.actionIcon}>📋</Text>
              <Text style={styles.actionText}>Rosa</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.actionButton} onPress={() => router.push('/squadra')}>
              <Text style={styles.actionIcon}>👥</Text>
              <Text style={styles.actionText}>Gestione Squadra</Text>
            </Pressable>
          )}
        </View>
      </View>
      
      {/* Spazio per la barra di navigazione del sistema */}
      <SafeAreaView edges={['bottom']} />

      {/* Scelta evento quando un giorno del calendario ne ha più di uno */}
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
                  goToEvent(ev);
                }}
              >
                <View style={[styles.dayBlockDot, { backgroundColor: pillColor(ev) }]} />
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
    </SafeAreaView>
  );
}

/* --------------------------------- Stili --------------------------------- */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  
  innerContainer: {
    flex: 1,
  },

  // Sezione top fissa (niente scroll): occupa solo lo spazio necessario
  topSection: {
    flex: 1,
  },
  topSectionContent: {
    flexGrow: 1,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    marginBottom: 20,
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  title: { fontSize: 28, fontWeight: '700', color: '#1a202c' },
  subtitleName: { fontSize: 15, fontWeight: '600', color: '#64748b', marginTop: 2 },
  accountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#eef2f7',
  },
  accountBtnIcon: { fontSize: 16 },
  accountBtnText: { fontSize: 14, fontWeight: '700', color: '#1a202c' },

  sectionTitle: { fontSize: 20, fontWeight: '700', color: '#1a202c', marginBottom: 12 },

  // Blocco "Oggi / Domani"
  todayTomorrowSection: { paddingHorizontal: 16, marginBottom: 20 },
  todayTomorrowCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  dayBlock: { flex: 1, padding: 14 },
  daySeparator: { width: 1, backgroundColor: '#eef2f7' },
  dayBlockLabel: { fontSize: 13, fontWeight: '700', color: '#64748b', marginBottom: 8, textTransform: 'uppercase' },
  dayBlockEmpty: { fontSize: 13, color: '#999', fontStyle: 'italic' },
  dayBlockRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 10 },
  dayBlockDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  dayBlockTitle: { fontSize: 14, fontWeight: '700', color: '#1a202c' },
  dayBlockDetails: { fontSize: 12, color: '#666', marginTop: 2 },

  // Calendario
  calendarSection: { paddingHorizontal: 16, marginBottom: 24 },
  // Su schermi larghi (webapp desktop): contenuto centrato a larghezza massima leggibile,
  // invece della griglia mensile che si allarga a celle enormi
  calendarSectionWide: { width: '100%', maxWidth: 560, alignSelf: 'center' },
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

  // Bottoni - sempre visibili in fondo
  actionsSection: { 
    paddingHorizontal: 16, 
    paddingBottom: 16,
    backgroundColor: '#f5f7fa'
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  actionButton: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  actionIcon: { fontSize: 24, marginBottom: 8 },
  actionText: { fontSize: 14, fontWeight: '600', color: '#1a202c', textAlign: 'center' },

  // Modale scelta evento (giorno con più eventi)
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
  dayPickerItemText: { flex: 1, fontSize: 15, fontWeight: '600', color: '#1a202c' },
  dayPickerCancel: { alignItems: 'center', paddingVertical: 14, marginTop: 4 },
  dayPickerCancelText: { fontSize: 15, fontWeight: '700', color: '#64748b' },
});
