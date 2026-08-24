// app/index.tsx
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from './context/AuthContext';
import { CalendarEvent, loadEvents } from './data/events';
import { registerPushTokenForCurrentUser } from './data/pushNotify';
import MonthCalendarGrid from './components/MonthCalendarGrid';
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
          <MonthCalendarGrid events={events} onSelectEvent={goToEvent} />
        </View>
        </ScrollView>
      </View>

      {/* Azioni rapide - sempre visibili sopra la barra di navigazione */}
      <View style={styles.actionsSection}>
        <Text style={styles.sectionTitle}>Azioni rapide</Text>
        <View style={styles.actions}>
           <Pressable style={styles.actionButton} onPress={() => router.push('/calendario')}>
            <Text style={styles.actionIcon}>📅</Text>
            <Text style={styles.actionText}>Calendario</Text>
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
