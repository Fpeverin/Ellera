// app/allenamenti.tsx
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar } from 'react-native-calendars';
import EventEditorModal from './components/EventEditorModal';
import { CalendarEvent, loadEvents, saveEvents } from './data/events';

interface CalendarDay {
  dateString: string;
  day: number;
  month: number;
  year: number;
  timestamp: number;
}
type WeekKey = 0 | 1 | 2 | 3 | 4 | 5 | 6; // JS getDay(): 0=Dom ... 6=Sab

// Giorni in ordine italiano (Lun→Dom) ma mappati verso getDay()
const IT_DAYS: { label: string; getDay: WeekKey }[] = [
  { label: 'Lunedì', getDay: 1 },
  { label: 'Martedì', getDay: 2 },
  { label: 'Mercoledì', getDay: 3 },
  { label: 'Giovedì', getDay: 4 },
  { label: 'Venerdì', getDay: 5 },
  { label: 'Sabato', getDay: 6 },
  { label: 'Domenica', getDay: 0 },
];

export default function Allenamenti() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [showModal, setShowModal] = useState(false);       // modale "nuovo evento" singolo
  const [showWeekModal, setShowWeekModal] = useState(false); // modale "settimana ideale"
  const router = useRouter();

  // Statistiche degli allenamenti
  const stats = useMemo(() => {
    const total = events.length;
    const thisMonth = events.filter(e => {
      const eventDate = new Date(e.date);
      const now = new Date();
      return eventDate.getMonth() === now.getMonth() && eventDate.getFullYear() === now.getFullYear();
    }).length;
    const upcoming = events.filter(e => new Date(e.date) >= new Date()).length;
    
    return { total, thisMonth, upcoming };
  }, [events]);

  // Stato "settimana ideale"
  const [startDate, setStartDate] = useState<string>(''); // YYYY-MM-DD
  const [endDate, setEndDate] = useState<string>('');     // YYYY-MM-DD
  const [location, setLocation] = useState('Campo di allenamento');
  const [weekCfg, setWeekCfg] = useState<Record<WeekKey, { enabled: boolean; time: string }>>({
    1: { enabled: true, time: '18:30' },  // Lunedì
    2: { enabled: false, time: '18:30' }, // Martedì
    3: { enabled: true, time: '18:30' },  // Mercoledì
    4: { enabled: false, time: '18:30' }, // Giovedì
    5: { enabled: false, time: '18:30' }, // Venerdì
    6: { enabled: false, time: '10:00' }, // Sabato
    0: { enabled: false, time: '10:00' }, // Domenica
  });

  // Conferme eliminazione (custom modal → funziona su web)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [busy, setBusy] = useState(false);

  const refreshEvents = async () => {
    const list = await loadEvents();
    setEvents(list.filter((e) => e.type === 'ALLENAMENTO'));
  };

  useFocusEffect(useCallback(() => { refreshEvents(); }, []));

  // Categorizzazione degli eventi per data
  const categorizedEvents = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Inizio giornata
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999); // Fine giornata alle 23:59
    
    const todayEvents: CalendarEvent[] = [];
    const futureEvents: CalendarEvent[] = [];
    const pastEvents: CalendarEvent[] = [];
    
    events.forEach(event => {
      const eventDate = new Date(event.date + 'T00:00:00');
      
      if (eventDate >= today && eventDate <= todayEnd) {
        todayEvents.push(event);
      } else if (eventDate > todayEnd) {
        futureEvents.push(event);
      } else {
        pastEvents.push(event);
      }
    });
    
    // Ordina ogni categoria per data e ora
    const sortEvents = (a: CalendarEvent, b: CalendarEvent) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return (a.time || '00:00').localeCompare(b.time || '00:00');
    };
    
    return {
      today: todayEvents.sort(sortEvents),
      future: futureEvents.sort(sortEvents),
      past: pastEvents.sort(sortEvents).reverse(), // I più recenti prima
    };
  }, [events]);

  const renderEventCard = (item: CalendarEvent, isPast = false) => (
    <Pressable 
      key={item.id}
      style={[styles.eventCard, isPast && styles.eventCardPast]} 
      onPress={() => router.push(`/eventi/allenamento/${item.id}`)}
    >
      <View style={styles.eventContent}>
        <View style={styles.eventHeader}>
          <View style={[styles.eventStatusDot, isPast ? styles.eventStatusPast : styles.eventStatusUpcoming]} />
          <Text style={[styles.eventTitle, isPast && styles.eventTitlePast]}>{item.location}</Text>
        </View>
        <View style={styles.eventDetails}>
          <Text style={[styles.eventDate, isPast && styles.eventDatePast]}>
            📅 {item.date}
          </Text>
          <Text style={[styles.eventTime, isPast && styles.eventTimePast]}>
            🕐 {item.time}
          </Text>
        </View>
        {item.temaAllenamento && (
          <Text style={[styles.eventTheme, isPast && styles.eventThemePast]} numberOfLines={1}>
            💡 {item.temaAllenamento}
          </Text>
        )}
      </View>
      
      <View style={styles.eventActions}>
        <Pressable 
          style={styles.deleteBtn} 
          onPress={(e) => {
            e.stopPropagation();
            setConfirmDeleteId(item.id);
          }}
        >
          <Text style={styles.deleteBtnText}>🗑️</Text>
        </Pressable>
      </View>
    </Pressable>
  );

  const renderSection = (title: string, sectionEvents: CalendarEvent[], isPast = false, icon = '📅') => {
    if (sectionEvents.length === 0) return null;
    
    return (
      <View key={title} style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionIcon}>{icon}</Text>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={styles.sectionCount}>({sectionEvents.length})</Text>
        </View>
        {sectionEvents.map(event => renderEventCard(event, isPast))}
      </View>
    );
  };

  // util: loop date
  const eachDay = (startISO: string, endISO: string): Date[] => {
    const start = new Date(`${startISO}T00:00:00`);
    const end = new Date(`${endISO}T00:00:00`);
    const out: Date[] = [];
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return out;
    let cur = new Date(start);
    while (cur <= end) {
      out.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return out;
  };

  const fmtDate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const canCreateBulk = useMemo(() => {
    if (!startDate || !endDate || !location) return false;
    // almeno un giorno della settimana attivo con orario valido HH:mm
    return IT_DAYS.some(({ getDay }) => {
      const c = weekCfg[getDay];
      return c?.enabled && /^\d{2}:\d{2}$/.test(c.time);
    });
  }, [startDate, endDate, location, weekCfg]);

  const createTrainingsFromWeek = async () => {
    if (!canCreateBulk) return;

    const all: CalendarEvent[] = await loadEvents();

    const days = eachDay(startDate, endDate);
    const toAdd: CalendarEvent[] = [];

    for (const day of days) {
      const dayIdx = day.getDay() as WeekKey; // 0..6
      const cfg = weekCfg[dayIdx];
      if (!cfg?.enabled) continue;

      const dateStr = fmtDate(day);
      const timeStr = cfg.time;

      // dedupe: esiste già un ALLENAMENTO stessa data/ora?
      const exists = all.some(
        (ev) => ev.type === 'ALLENAMENTO' && ev.date === dateStr && ev.time === timeStr
      );
      if (exists) continue;

      toAdd.push({
        id: `${Date.now()}-${dateStr}-${timeStr}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'ALLENAMENTO',
        date: dateStr,
        time: timeStr,
        location,
        presenze: {},
        temaAllenamento: undefined,
        formationSlots: undefined,
        benchIds: [],
        tacticsIds: [],
      });
    }

    if (toAdd.length === 0) {
      setShowWeekModal(false);
      return;
    }

    const updatedAll = [...all, ...toAdd];
    await saveEvents(updatedAll);

    setShowWeekModal(false);
    refreshEvents();
  };

  // Eliminazione singolo ALLENAMENTO (conferma via modal custom)
  const actuallyDeleteOne = async () => {
    if (!confirmDeleteId) return;
    setBusy(true);
    const all: CalendarEvent[] = await loadEvents();
    const updated = all.filter((ev) => ev.id !== confirmDeleteId);
    await saveEvents(updated);
    setBusy(false);
    setConfirmDeleteId(null);
    refreshEvents();
  };

  // Eliminazione di TUTTI gli ALLENAMENTI
  const actuallyDeleteAllTrainings = async () => {
    setBusy(true);
    const all: CalendarEvent[] = await loadEvents();
    const keep = all.filter((ev) => ev.type !== 'ALLENAMENTO'); // mantieni solo NON-allenamenti
    await saveEvents(keep);
    setBusy(false);
    setConfirmDeleteAll(false);
    refreshEvents();
  };

  // --- gestione mini calendario (range picker) ---
  const onDayPress = (day: CalendarDay) => {
    const d = day.dateString; // YYYY-MM-DD
    if (!startDate || (startDate && endDate)) {
      setStartDate(d);
      setEndDate('');
    } else {
      if (d < startDate) {
        setStartDate(d);
        setEndDate('');
      } else {
        setEndDate(d);
      }
    }
  };

  const markedDates = useMemo(() => {
    const marks: Record<string, any> = {};
    if (startDate && !endDate) {
      marks[startDate] = { startingDay: true, endingDay: true, color: '#1b7f3b', textColor: 'white' };
      return marks;
    }
    if (startDate && endDate) {
      const days = eachDay(startDate, endDate);
      days.forEach((date, idx) => {
        const ds = fmtDate(date);
        if (idx === 0) {
          marks[ds] = { startingDay: true, color: '#1b7f3b', textColor: 'white' };
        } else if (idx === days.length - 1) {
          marks[ds] = { endingDay: true, color: '#1b7f3b', textColor: 'white' };
        } else {
          marks[ds] = { color: '#49a86a', textColor: 'white' };
        }
      });
    }
    return marks;
  }, [startDate, endDate]);

  return (
    <SafeAreaView style={styles.container} edges={['top','bottom']}>
      <View style={styles.header}>
        <Text style={styles.title}>Allenamenti</Text>
        <Text style={styles.subtitle}>Gestisci tutti gli allenamenti della squadra</Text>
      </View>

      {/* Statistiche panoramica */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.total}</Text>
          <Text style={styles.statLabel}>Totale</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.thisMonth}</Text>
          <Text style={styles.statLabel}>Questo mese</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.upcoming}</Text>
          <Text style={styles.statLabel}>Prossimi</Text>
        </View>
      </View>

      {/* Azioni rapide */}
      <View style={styles.quickActions}>
        <Pressable
          style={[styles.quickActionBtn, styles.primaryAction]}
          onPress={() => setShowModal(true)}
        >
          <Text style={styles.quickActionIcon}>➕</Text>
          <Text style={styles.quickActionText}>Nuovo</Text>
        </Pressable>
        
        <Pressable
          style={[styles.quickActionBtn, styles.secondaryAction]}
          onPress={() => setShowWeekModal(true)}
        >
          <Text style={styles.quickActionIcon}>📅</Text>
          <Text style={styles.quickActionText}>Settimana</Text>
        </Pressable>
        
        <Pressable
          style={[styles.quickActionBtn, styles.dangerAction]}
          onPress={() => setConfirmDeleteAll(true)}
        >
          <Text style={styles.quickActionIcon}>🗑️</Text>
          <Text style={styles.quickActionText}>Elimina</Text>
        </Pressable>
      </View>

      <ScrollView 
        style={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {events.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🏃‍♂️</Text>
            <Text style={styles.emptyTitle}>Nessun allenamento</Text>
            <Text style={styles.emptySubtitle}>Crea il primo allenamento per la tua squadra</Text>
          </View>
        ) : (
          <>
            {/* Allenamenti di oggi - priorità massima */}
            {renderSection('Oggi', categorizedEvents.today, false, '⭐')}
            
            {/* Allenamenti futuri */}
            {renderSection('Prossimi allenamenti', categorizedEvents.future, false, '🔜')}
            
            {/* Allenamenti passati */}
            {renderSection('Allenamenti passati', categorizedEvents.past, true, '📋')}
          </>
        )}
      </ScrollView>

      {/* Modale "nuovo" (riutilizzo editor standard) */}
      <EventEditorModal
        visible={showModal}
        initialType="ALLENAMENTO"
        onClose={() => setShowModal(false)}
        onSaved={refreshEvents}
      />

      {/* Modale "Settimana ideale" */}
      <Modal
        visible={showWeekModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowWeekModal(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.modalTitle}>Settimana ideale</Text>
            <ScrollView contentContainerStyle={{ paddingBottom: 16 }}>
              {/* MINI CALENDARIO: range start/end */}
              <Text style={styles.label}>Periodo</Text>
              <Calendar
                onDayPress={onDayPress}
                markedDates={markedDates}
                markingType="period"
                theme={{
                  selectedDayBackgroundColor: '#1b7f3b',
                  todayTextColor: '#1b7f3b',
                }}
              />
              <View style={styles.rangeRow}>
                <Text style={{ fontWeight: '700' }}>Inizio:</Text>
                <Text style={{ marginLeft: 6 }}>{startDate || '-'}</Text>
                <Text style={{ marginLeft: 12, fontWeight: '700' }}>Fine:</Text>
                <Text style={{ marginLeft: 6 }}>{endDate || '-'}</Text>
              </View>

              {/* Luogo unico per tutti i nuovi eventi */}
              <Text style={styles.label}>Luogo</Text>
              <TextInput
                value={location}
                onChangeText={setLocation}
                placeholder="Campo di allenamento"
                style={styles.input}
              />

              {/* Giorni/orari */}
              <Text style={[styles.label, { marginTop: 12 }]}>Giorni & orari</Text>
              {IT_DAYS.map(({ label, getDay }) => {
                const cfg = weekCfg[getDay];
                return (
                  <View key={getDay} style={styles.dayRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                      <Switch
                        value={cfg.enabled}
                        onValueChange={(v) =>
                          setWeekCfg((prev) => ({ ...prev, [getDay]: { ...prev[getDay], enabled: v } }))
                        }
                      />
                      <Text style={{ fontWeight: '600' }}>{label}</Text>
                    </View>
                    <TextInput
                      value={cfg.time}
                      onChangeText={(t) =>
                        setWeekCfg((prev) => ({ ...prev, [getDay]: { ...prev[getDay], time: t } }))
                      }
                      placeholder="HH:mm"
                      style={[styles.input, { width: 90 }]}
                      autoCapitalize="none"
                    />
                  </View>
                );
              })}

              <View style={{ height: 12 }} />

              {/* CTA */}
              <Pressable
                style={[styles.createBtn, !canCreateBulk && { opacity: 0.6 }]}
                onPress={createTrainingsFromWeek}
                disabled={!canCreateBulk}
              >
                <Text style={styles.createText}>CREA ALLENAMENTI</Text>
              </Pressable>

              <Pressable style={styles.cancelBtn} onPress={() => setShowWeekModal(false)}>
                <Text style={styles.cancelText}>Chiudi</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODALE CONFERMA: elimina SINGOLO */}
      <Modal visible={!!confirmDeleteId} transparent animationType="fade" onRequestClose={() => setConfirmDeleteId(null)}>
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Eliminare questo allenamento?</Text>
            <View style={styles.confirmRow}>
              <Pressable style={[styles.confirmBtn, styles.confirmCancel]} onPress={() => setConfirmDeleteId(null)}>
                <Text style={styles.confirmCancelText}>Annulla</Text>
              </Pressable>
              <Pressable
                style={[styles.confirmBtn, styles.confirmDelete, busy && { opacity: 0.6 }]}
                onPress={actuallyDeleteOne}
                disabled={busy}
              >
                <Text style={styles.confirmDeleteText}>Elimina</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODALE CONFERMA: elimina TUTTI */}
      <Modal visible={confirmDeleteAll} transparent animationType="fade" onRequestClose={() => setConfirmDeleteAll(false)}>
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Eliminare TUTTI gli allenamenti?</Text>
            <View style={styles.confirmRow}>
              <Pressable style={[styles.confirmBtn, styles.confirmCancel]} onPress={() => setConfirmDeleteAll(false)}>
                <Text style={styles.confirmCancelText}>Annulla</Text>
              </Pressable>
              <Pressable
                style={[styles.confirmBtn, styles.confirmDelete, busy && { opacity: 0.6 }]}
                onPress={actuallyDeleteAllTrainings}
                disabled={busy}
              >
                <Text style={styles.confirmDeleteText}>Elimina tutti</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f8fafc' },
  
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    fontWeight: '500',
  },
  
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1b7f3b',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
  },
  
  quickActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  quickActionBtn: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  primaryAction: {
    backgroundColor: '#1b7f3b',
  },
  secondaryAction: {
    backgroundColor: '#3b82f6',
  },
  dangerAction: {
    backgroundColor: '#ef4444',
  },
  quickActionIcon: {
    fontSize: 20,
    marginBottom: 8,
  },
  quickActionText: {
    fontSize: 14,
    fontWeight: '700',
    color: 'white',
  },

  scrollContainer: {
    flex: 1,
  },
  
  // Sezioni
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  sectionIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    flex: 1,
  },
  sectionCount: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
  },
  
  // Card eventi
  eventCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  eventCardPast: {
    backgroundColor: '#f8fafc',
    opacity: 0.75,
  },
  eventContent: {
    flex: 1,
  },
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  eventStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
  },
  eventStatusUpcoming: {
    backgroundColor: '#1b7f3b',
  },
  eventStatusPast: {
    backgroundColor: '#94a3b8',
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    flex: 1,
  },
  eventTitlePast: {
    color: '#64748b',
  },
  eventDetails: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 4,
  },
  eventDate: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  eventDatePast: {
    color: '#94a3b8',
  },
  eventTime: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  eventTimePast: {
    color: '#94a3b8',
  },
  eventTheme: {
    fontSize: 14,
    color: '#1b7f3b',
    fontWeight: '500',
    fontStyle: 'italic',
  },
  eventThemePast: {
    color: '#94a3b8',
  },
  eventActions: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: {
    padding: 8,
    borderRadius: 8,
  },
  deleteBtnText: {
    fontSize: 18,
  },
  
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 48,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 24,
  },

  // Modal styles
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 24,
    textAlign: 'center',
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  rangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  createBtn: {
    backgroundColor: '#1b7f3b',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  createText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '800',
  },
  cancelBtn: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  cancelText: {
    color: '#64748b',
    fontSize: 16,
    fontWeight: '600',
  },

  // Confirm modal
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  confirmCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    textAlign: 'center',
    marginBottom: 24,
  },
  confirmRow: {
    flexDirection: 'row',
    gap: 12,
  },
  confirmBtn: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  confirmCancel: {
    backgroundColor: '#f1f5f9',
  },
  confirmDelete: {
    backgroundColor: '#ef4444',
  },
  confirmCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
  },
  confirmDeleteText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});