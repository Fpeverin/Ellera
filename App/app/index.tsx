// app/index.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Dimensions, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import EventEditorModal from './components/EventEditorModal';
import { CalendarEvent, loadEvents } from './data/events';
import { checkLocalImportNeeded, importLocalEvents, skipLocalImport } from './utils/importLocalEvents';

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
export default function Dashboard() {
  const router = useRouter();
  const { height: screenHeight } = Dimensions.get('window');

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [initialDateForModal, setInitialDateForModal] = useState<string | undefined>(undefined);

  // Import una tantum dei dati locali (pre-Supabase) trovati su questo device
  const [importCandidate, setImportCandidate] = useState<CalendarEvent[] | null>(null);
  const [importBusy, setImportBusy] = useState(false);

  useEffect(() => {
    checkLocalImportNeeded().then(setImportCandidate);
  }, []);

  const confirmImport = async () => {
    if (!importCandidate) return;
    setImportBusy(true);
    try {
      await importLocalEvents(importCandidate);
      await refreshEvents();
    } finally {
      setImportBusy(false);
      setImportCandidate(null);
    }
  };

  const declineImport = async () => {
    setImportBusy(true);
    try {
      await skipLocalImport();
    } finally {
      setImportBusy(false);
      setImportCandidate(null);
    }
  };

  // Calcola se c'è spazio per mostrare gli eventi futuri
  const hasSpaceForEvents = screenHeight > 700;

  const refreshEvents = async () => {
    const list = await loadEvents();
    // ordina per data/ora
    list.sort(
      (a, b) =>
        parseYMDTimeLocal(a.date, a.time || '00:00').getTime() -
        parseYMDTimeLocal(b.date, b.time || '00:00').getTime()
    );
    setEvents(list);
  };

  useFocusEffect(
    useCallback(() => {
      refreshEvents();
    }, [])
  );

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

  /* ---------------------------- Eventi futuri ---------------------------- */
  const now = new Date();
  const upcomingEvents = useMemo(
    () =>
      events
        .filter((ev) => parseYMDTimeLocal(ev.date, ev.time || '00:00') >= now)
        .sort(
          (a, b) =>
            parseYMDTimeLocal(a.date, a.time || '00:00').getTime() -
            parseYMDTimeLocal(b.date, b.time || '00:00').getTime()
        ),
    [events]
  );
const exportData = async () => {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const allItems = await AsyncStorage.multiGet(allKeys);
      const data: Record<string, any> = {};
      allItems.forEach(([key, value]) => {
        if (value !== null) data[key] = JSON.parse(value);
      });

      const fileUri = FileSystem.cacheDirectory + 'backup.json';
      await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(data, null, 2));
      await Sharing.shareAsync(fileUri, { mimeType: 'application/json', dialogTitle: 'Esporta dati' });
    } catch (e) {
      console.error('Errore export', e);
    }
  };

  const importData = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: 'application/json' });
      if (res.canceled) return;
      const file = res.assets[0];
      const content = await FileSystem.readAsStringAsync(file.uri);
      const parsed = JSON.parse(content);

      for (const [key, value] of Object.entries(parsed)) {
        await AsyncStorage.setItem(key, JSON.stringify(value));
      }
      alert('Dati importati con successo!');
      refreshEvents(); // ricarico calendario
    } catch (e) {
      console.error('Errore import', e);
    }
  };
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

  const formatEventCardTitle = (ev: CalendarEvent) =>
    ev.type === 'PARTITA'
      ? formatEventPill(ev)
      : formatEventPill(ev);

  /* ------------------------- Griglia calendario (6x7) ------------------------- */
  const renderMonthGrid = () => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
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
          onPress={() => {
            setInitialDateForModal(dateStr);
            setShowModal(true);
          }}
        >
          <Text
            style={[
              styles.dayNumber,
              !isCurrentMonth && styles.otherMonthText,
              isToday && styles.todayNumber,
            ]}
          >
            {d}
          </Text>

          <View style={styles.pillsWrap}>
            {topTwo.map((ev) => (
              <View key={ev.id} style={[styles.pill, { backgroundColor: pillColor(ev) }]}>
                <Text style={styles.pillText} numberOfLines={1}>
                  {formatEventPill(ev)}
                </Text>
              </View>
            ))}
            {more > 0 && (
              <View style={[styles.pill, styles.morePill]}>
                <Text style={[styles.pillText, { color: '#111' }]}>+{more}</Text>
              </View>
            )}
          </View>
        </Pressable>
      );

      cursor.setDate(cursor.getDate() + 1);
    }

    return cells;
  };

  /* --------------------------------- Render --------------------------------- */
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.innerContainer}>
        {/* Header + Calendario - fissi, non scrollabili */}
        <View style={styles.topSection}>
        <View style={styles.header}>
          <Text style={styles.title}>Dashboard Calcistica</Text>
        </View>

        <View style={styles.calendarSection}>
          <Text style={styles.sectionTitle}>Calendario</Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Pressable onPress={exportData}>
              <Text style={{ fontSize: 20 }}>📤</Text>
            </Pressable>
            <Pressable onPress={importData}>
              <Text style={{ fontSize: 20 }}>📥</Text>
            </Pressable>
          </View>
          <View style={styles.miniCalendar}>
            <Text style={styles.monthTitle}>
              {new Date().toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}
            </Text>

            {/* Giorni settimana */}
            <View style={styles.weekDays}>
              {['L', 'M', 'M', 'G', 'V', 'S', 'D'].map((d, i) => (
                <Text key={i} style={styles.weekDay}>
                  {d}
                </Text>
              ))}
            </View>

            {/* Griglia 6x7 */}
            <View style={styles.daysGrid}>{renderMonthGrid()}</View>

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
      </View>

      {/* Eventi futuri - solo se c'è spazio */}
      {hasSpaceForEvents && (
        <View style={styles.eventsSection}>
        
          <FlatList
            data={upcomingEvents}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={<Text style={styles.emptyText}>Nessun evento futuro</Text>}
            renderItem={({ item }) => (
              <Pressable
                style={styles.eventCard}
                onPress={() => {
                  if (item.type === 'PARTITA') {
                    router.push(`/eventi/partita/${item.id}`);
                  } else {
                    router.push(`/eventi/allenamento/${item.id}`);
                  }
                }}
              >
                <View style={styles.eventHeader}>
                  <Text
                    style={[
                      styles.eventType,
                      { backgroundColor: item.type === 'PARTITA' ? '#e74c3c' : '#1b7f3b' },
                    ]}
                  >
                    {item.type}
                  </Text>
                  <Text style={styles.eventDate}>{item.date}</Text>
                </View>
                <Text style={styles.eventTitle}>{formatEventCardTitle(item)}</Text>
                <Text style={styles.eventDetails}>
                  {item.time || '--:--'} · {item.location}
                </Text>
              </Pressable>
            )}
          />
        </View>
      )}
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
          <Pressable style={styles.actionButton} onPress={() => router.push('/squadra')}>
            <Text style={styles.actionIcon}>👥</Text>
            <Text style={styles.actionText}>Gestione Squadra</Text>
          </Pressable>
        </View>
      </View>
      
      {/* Spazio per la barra di navigazione del sistema */}
      <SafeAreaView edges={['bottom']} />

      {/* Modale Nuovo evento (solo clic sul calendario, con data preselezionata) */}
      <EventEditorModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        onSaved={refreshEvents}
        initialDate={initialDateForModal}
      />

      {/* Import una tantum dati locali (pre-Supabase) */}
      <Modal visible={!!importCandidate} transparent animationType="fade">
        <View style={importStyles.overlay}>
          <View style={importStyles.card}>
            <Text style={importStyles.title}>Dati trovati su questo dispositivo</Text>
            <Text style={importStyles.body}>
              Abbiamo trovato {importCandidate?.length ?? 0} eventi salvati su questo dispositivo
              (dalla vecchia versione dell'app). Vuoi caricarli nella squadra? Conferma solo se questi
              sono i dati corretti da tenere.
            </Text>
            <View style={importStyles.row}>
              <Pressable
                style={[importStyles.btn, importStyles.btnNo, importBusy && importStyles.btnDisabled]}
                onPress={declineImport}
                disabled={importBusy}
              >
                <Text style={importStyles.btnNoText}>No, ignora</Text>
              </Pressable>
              <Pressable
                style={[importStyles.btn, importStyles.btnYes, importBusy && importStyles.btnDisabled]}
                onPress={confirmImport}
                disabled={importBusy}
              >
                <Text style={importStyles.btnYesText}>{importBusy ? 'Caricamento…' : 'Sì, carica'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const importStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 420 },
  title: { fontSize: 18, fontWeight: '800', color: '#1a202c', marginBottom: 12, textAlign: 'center' },
  body: { fontSize: 15, color: '#374151', lineHeight: 22, marginBottom: 20, textAlign: 'center' },
  row: { flexDirection: 'row', gap: 12 },
  btn: { flex: 1, borderRadius: 12, padding: 14, alignItems: 'center' },
  btnNo: { backgroundColor: '#f1f5f9' },
  btnYes: { backgroundColor: '#1b7f3b' },
  btnDisabled: { opacity: 0.6 },
  btnNoText: { color: '#475569', fontWeight: '700' },
  btnYesText: { color: '#fff', fontWeight: '700' },
});

/* --------------------------------- Stili --------------------------------- */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  
  innerContainer: {
    flex: 1,
  },

  bottomSafeArea: {
    backgroundColor: '#f5f7fa',
  },

  // Sezione top fissa (niente scroll): occupa solo lo spazio necessario
  topSection: {
    flexShrink: 0,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    marginBottom: 20,
  },
  title: { fontSize: 28, fontWeight: '700', color: '#1a202c' },

  sectionTitle: { fontSize: 20, fontWeight: '700', color: '#1a202c', marginBottom: 12 },

  // Calendario
  calendarSection: { paddingHorizontal: 16, marginBottom: 24 },
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
  monthTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a202c',
    textAlign: 'center',
    marginBottom: 16,
    textTransform: 'capitalize',
  },
  weekDays: { flexDirection: 'row', marginBottom: 8 },
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
  todayCell: { borderWidth: 1, borderColor: '#1b7f3b', borderRadius: 8 },
  todayNumber: { color: '#1b7f3b' },
  otherMonth: { opacity: 0.35 },
  otherMonthText: { color: '#999' },

  pillsWrap: { marginTop: 4, gap: 2 },
  pill: { borderRadius: 4, paddingHorizontal: 4, paddingVertical: 2, minHeight: 18 },
  pillText: { color: 'white', fontSize: 10, fontWeight: '700' },
  morePill: { backgroundColor: '#e5e7eb' },

  calendarInfo: { fontSize: 14, color: '#666', textAlign: 'center', marginTop: 8 },

  // Eventi futuri - flessibile in base allo spazio
  eventsSection: { 
    flex: 1, 
    paddingHorizontal: 16, 
    marginBottom: 8,
    maxHeight: '25%'
  },
  eventCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  eventHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  eventType: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    textTransform: 'uppercase',
  },
  eventDate: { fontSize: 14, color: '#666', fontWeight: '500' },
  eventTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4, color: '#1a202c' },
  eventDetails: { fontSize: 14, color: '#666' },
  emptyText: { color: '#666', textAlign: 'center', fontStyle: 'italic', paddingVertical: 20 },

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
});
