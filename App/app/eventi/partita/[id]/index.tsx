// app/eventi/partita/[id]/index.tsx
//
// Prima di avviare il live, chi apre una partita:
// - Staff/Admin sceglie tra Convocazione e Live.
// - Giocatore vede solo data/ora/avversario + loghi, in sola lettura (niente
//   Convocazione/Formazione/Live finché la partita non è avviata).
// Dopo lo Start, tutti vanno dritti su Live (dove il Giocatore può proporre
// gol/cartellini, come già previsto).
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../../context/AuthContext';
import { CalendarEvent, loadEvents } from '../../../data/events';
import { loadStarted } from '../../../data/matchLive';
import { loadOrgLogoUrl, opponentLogoUrlFromPath } from '../../../data/organization';

export default function PartitaIndexChooser() {
  const { id: matchId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { membership } = useAuth();
  const readOnly = membership?.role === 'giocatore';

  const [loading, setLoading] = useState(true);
  const [started, setStarted] = useState(true);
  const [event, setEvent] = useState<CalendarEvent | null>(null);
  const [orgLogoUrl, setOrgLogoUrl] = useState<string | null>(null);
  const [opponentLogoUrl, setOpponentLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!matchId) return;
      try {
        const [isStarted, events, orgLogo] = await Promise.all([loadStarted(matchId), loadEvents(), loadOrgLogoUrl()]);
        setStarted(isStarted);
        const ev = events.find((e) => `${e.id}` === `${matchId}`) ?? null;
        setEvent(ev);
        setOrgLogoUrl(orgLogo);
        const opponentLogoPath = (ev as any)?.opponentLogoPath;
        setOpponentLogoUrl(opponentLogoPath ? opponentLogoUrlFromPath(opponentLogoPath) : null);
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

  if (started) {
    return <Redirect href={{ pathname: '/eventi/partita/[id]/live', params: { id: matchId } }} />;
  }

  if (readOnly) {
    const homeAway = (event as any)?.homeAway as 'CASA' | 'TRASFERTA' | undefined;
    const opponent = event?.opponent || 'Avversario';
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.preMatchInfo}>
          <View style={styles.preMatchLogos}>
            {orgLogoUrl ? <Image source={{ uri: orgLogoUrl }} style={styles.preMatchLogo} /> : <View style={styles.preMatchLogo} />}
            <Text style={styles.preMatchVs}>vs</Text>
            {opponentLogoUrl ? <Image source={{ uri: opponentLogoUrl }} style={styles.preMatchLogo} /> : <View style={styles.preMatchLogo} />}
          </View>
          <Text style={styles.title}>{homeAway === 'TRASFERTA' ? `${opponent} - Ellera` : `Ellera - ${opponent}`}</Text>
          {(event?.date || event?.time) && (
            <Text style={styles.subtitle}>
              {event?.date} {event?.time ? `· ${event.time}` : ''}
            </Text>
          )}
          <Text style={styles.preMatchHint}>La partita non è ancora iniziata.</Text>
        </View>
      </SafeAreaView>
    );
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

  preMatchInfo: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  preMatchLogos: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 16 },
  preMatchLogo: { width: 64, height: 64, borderRadius: 8, backgroundColor: '#e5e7eb' },
  preMatchVs: { fontSize: 14, fontWeight: '700', color: '#94a3b8' },
  preMatchHint: { fontSize: 13, color: '#94a3b8', marginTop: 20 },

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
