// app/eventi/partita/[id]/index.tsx
//
// Prima di avviare il live, chi apre una partita (Staff/Admin) sceglie tra
// Convocazione e Live. Dopo lo Start (o per un account Giocatore, che non ha
// accesso alla Convocazione), si va dritti su Live.
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../../context/AuthContext';
import { CalendarEvent, loadEvents } from '../../../data/events';
import { loadStarted } from '../../../data/matchLive';

export default function PartitaIndexChooser() {
  const { id: matchId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { membership } = useAuth();
  const readOnly = membership?.role === 'giocatore';

  const [loading, setLoading] = useState(true);
  const [started, setStarted] = useState(true);
  const [event, setEvent] = useState<CalendarEvent | null>(null);

  useEffect(() => {
    (async () => {
      if (!matchId) return;
      try {
        const [isStarted, events] = await Promise.all([loadStarted(matchId), loadEvents()]);
        setStarted(isStarted);
        setEvent(events.find((e) => `${e.id}` === `${matchId}`) ?? null);
      } catch {
        setStarted(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [matchId]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1b7f3b" />
      </View>
    );
  }

  if (started || readOnly) {
    return <Redirect href={{ pathname: '/eventi/partita/[id]/live', params: { id: matchId } }} />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={{ padding: 20 }}>
        <Text style={styles.title}>Ellera{event?.opponent ? ` - ${event.opponent}` : ''}</Text>
        {(event?.date || event?.time) && (
          <Text style={styles.subtitle}>
            {event?.date} {event?.time ? `· ${event.time}` : ''}
          </Text>
        )}

        <View style={styles.cardsRow}>
          <Pressable
            style={[styles.actionCard, styles.convocazioneCard]}
            onPress={() => router.push(`/eventi/partita/${matchId}/convocazione`)}
          >
            <Text style={styles.actionIcon}>📋</Text>
            <Text style={styles.actionTitle}>CONVOCAZIONE</Text>
            <Text style={styles.actionSubtitle}>Chi convocare, ritrovo, PDF</Text>
          </Pressable>

          <Pressable
            style={[styles.actionCard, styles.liveCard]}
            onPress={() => router.push(`/eventi/partita/${matchId}/live`)}
          >
            <Text style={styles.actionIcon}>🔴</Text>
            <Text style={styles.actionTitle}>LIVE</Text>
            <Text style={styles.actionSubtitle}>Formazione, tattiche, cronaca</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f7fa' },
  title: { fontSize: 20, fontWeight: '800', color: '#1a202c' },
  subtitle: { fontSize: 14, color: '#64748b', marginTop: 4 },

  cardsRow: { flexDirection: 'row', gap: 12, marginTop: 28 },
  actionCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 16,
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  convocazioneCard: { backgroundColor: '#dcfce7' },
  liveCard: { backgroundColor: '#fee2e2' },
  actionIcon: { fontSize: 32 },
  actionTitle: { fontSize: 15, fontWeight: '900', marginTop: 10, color: '#0f172a' },
  actionSubtitle: { fontSize: 12, color: '#6b7280', marginTop: 4, textAlign: 'center', paddingHorizontal: 8 },
});
