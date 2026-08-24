// app/calendario.tsx
//
// Schermata "Calendario" unificata (2026-08-24): sostituisce i due bottoni separati "Allenamenti"/
// "Partite" in Home. Racchiude entrambe le funzionalità — calendario mensile in cima
// (MonthCalendarGrid, lo stesso componente già usato in Home) più un selettore Allenamenti/Partite
// che mostra il contenuto della vecchia route corrispondente (spostato, invariato, in
// app/components/calendario/AllenamentiTab.tsx e PartiteTab.tsx). Tap su un giorno del calendario
// apre direttamente l'evento, stesso comportamento della Home.
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AllenamentiTab from './components/calendario/AllenamentiTab';
import PartiteTab from './components/calendario/PartiteTab';
import MonthCalendarGrid from './components/MonthCalendarGrid';
import TeamLogo from './components/TeamLogo';
import { CalendarEvent, loadEvents } from './data/events';

type TabKey = 'allenamenti' | 'partite';

export default function Calendario() {
  const router = useRouter();
  const { tab: initialTabParam } = useLocalSearchParams<{ tab?: string }>();
  const { width } = useWindowDimensions();
  const isWide = width >= 700;

  const [tab, setTab] = useState<TabKey>(initialTabParam === 'partite' ? 'partite' : 'allenamenti');
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  const refreshEvents = async () => {
    const list = await loadEvents();
    setEvents(list);
  };

  useFocusEffect(useCallback(() => { refreshEvents(); }, []));

  const goToEvent = (ev: CalendarEvent) => {
    router.push(ev.type === 'PARTITA' ? `/eventi/partita/${ev.id}` : `/eventi/allenamento/${ev.id}`);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} accessibilityLabel="Indietro">
          <Text style={styles.backBtnTxt}>←</Text>
        </Pressable>
        <TeamLogo size={28} style={{ marginRight: 8 }} />
        <Text style={styles.title}>Calendario</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={[styles.wide, isWide && styles.wideCentered]}>
          <MonthCalendarGrid events={events} onSelectEvent={goToEvent} />
        </View>

        <View style={[styles.tabSwitch, styles.wide, isWide && styles.wideCentered]}>
          <Pressable
            style={[styles.tabBtn, tab === 'allenamenti' && styles.tabBtnActive]}
            onPress={() => setTab('allenamenti')}
          >
            <Text style={[styles.tabBtnText, tab === 'allenamenti' && styles.tabBtnTextActive]}>🏃 Allenamenti</Text>
          </Pressable>
          <Pressable
            style={[styles.tabBtn, tab === 'partite' && styles.tabBtnActive]}
            onPress={() => setTab('partite')}
          >
            <Text style={[styles.tabBtnText, tab === 'partite' && styles.tabBtnTextActive]}>🏆 Partite</Text>
          </Pressable>
        </View>

        <View style={[styles.wide, isWide && styles.wideCentered]}>
          {tab === 'allenamenti' ? <AllenamentiTab /> : <PartiteTab />}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 10 },
  backBtn: {
    width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff',
  },
  backBtnTxt: { fontSize: 18, fontWeight: '800', color: '#111' },
  title: { fontSize: 22, fontWeight: '800', color: '#1a202c' },

  scrollContent: { paddingHorizontal: 16, paddingBottom: 32 },
  wide: { width: '100%' },
  wideCentered: { maxWidth: 700, alignSelf: 'center' },

  tabSwitch: {
    flexDirection: 'row', gap: 8, marginTop: 16, marginBottom: 16,
    backgroundColor: '#e5e7eb', borderRadius: 12, padding: 4,
  },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center' },
  tabBtnActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, elevation: 1 },
  tabBtnText: { fontWeight: '700', color: '#6b7280', fontSize: 14 },
  tabBtnTextActive: { color: '#1a202c' },
});
