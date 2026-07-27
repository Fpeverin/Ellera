// app/calendario.tsx
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import EventEditorModal from './components/EventEditorModal';
import { CalendarEvent, loadEvents } from './data/events';

export default function Calendario() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [showModal, setShowModal] = useState(false);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const refreshEvents = async () => {
    const list = await loadEvents();
    setEvents(list);
  };

  useFocusEffect(useCallback(() => { refreshEvents(); }, []));

  return (
    <SafeAreaView style={styles.container} edges={['top','bottom']}>
      {/* Top bar coerente con le altre pagine */}
      <View style={styles.topBar}>
        <Text style={styles.title}>Calendario</Text>
        <Pressable style={styles.createBtn} onPress={() => setShowModal(true)}>
          <Text style={styles.createBtnText}>＋ Nuovo</Text>
        </Pressable>
      </View>

      <FlatList
        data={[...events].sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={{ color: '#6b7280' }}>Nessun evento trovato</Text>}
        renderItem={({ item }) => (
          <Pressable
            style={styles.eventCard}
            onPress={() =>
              item.type === 'PARTITA'
                ? router.push(`/eventi/partita/${item.id}/live`)
                : router.push(`/eventi/allenamento/${item.id}`)
            }
          >
            <Text style={styles.eventTitle}>
              {item.type === 'PARTITA' ? `Partita vs ${item.opponent}` : 'Allenamento'}
            </Text>
            <Text style={{ color: '#374151' }}>{item.date} · {item.time} · {item.location}</Text>
          </Pressable>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        contentContainerStyle={{ paddingBottom: 16 + insets.bottom }}
      />

      <EventEditorModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        onSaved={refreshEvents}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 12 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, marginBottom: 10 },
  title: { fontSize: 22, fontWeight: '800' },
  createBtn: { backgroundColor: '#1b7f3b', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  createBtnText: { color: '#fff', fontWeight: '800' },

  eventCard: { backgroundColor: '#f4f6f8', borderRadius: 10, padding: 12 },
  eventTitle: { fontWeight: '800', marginBottom: 2, fontSize: 16 },
});
