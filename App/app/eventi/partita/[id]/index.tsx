// app/eventi/partita/[id]/index.tsx
//
// Chi apre una partita:
// - Staff/Admin vede sempre la griglia a 4 riquadri (Convocazione/Lista Gara/Live/Altre Partite),
//   qualunque sia lo stato della partita (2026-08-24: prima, a partita avviata o finita, si veniva
//   reindirizzati dritti su Live — impedendo di raggiungere Altre Partite/Convocazione/Lista Gara
//   per qualunque partita già iniziata, non solo mentre è ancora da avviare).
// - Giocatore vede solo data/ora/avversario + loghi, in sola lettura, finché la partita non è
//   avviata; dopo lo Start va dritto su Live (dove può proporre gol/cartellini, come già previsto)
//   — per lui non cambia nulla.
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import TeamLogo from '../../../components/TeamLogo';
import { useAuth } from '../../../context/AuthContext';
import { loadCompetitionTeams } from '../../../data/competitionTeams';
import { CalendarEvent, loadEvents, patchEventData } from '../../../data/events';
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
        if (opponentLogoPath) {
          setOpponentLogoUrl(opponentLogoUrlFromPath(opponentLogoPath));
        } else if (membership?.role !== 'giocatore' && ev?.competition && ev?.opponent) {
          // Nessuno stemma caricato per questa partita: se la squadra avversaria è già configurata
          // (con stemma) per questa competizione, lo recupera automaticamente da lì — stessa logica
          // di convocazione.tsx, qui copre anche chi non apre mai quella scheda prima di guardare il
          // calendario. Mai per il Giocatore (sola lettura, l'RLS in scrittura su "events" glielo
          // impedirebbe comunque).
          try {
            const teams = await loadCompetitionTeams(ev.competition);
            const match = teams.find((t) => t.name === ev.opponent);
            if (match?.logoPath) {
              await patchEventData(matchId, { opponentLogoPath: match.logoPath });
              setOpponentLogoUrl(match.logoUrl);
            }
          } catch {
            // nessuna squadra configurata o errore di rete — resta senza stemma, caricabile a mano
          }
        }
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

  if (readOnly && started) {
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

  const compLabel = (event as any)?.competition
    ? `${(event as any).competition}${(event as any)?.giornata ? ` · ${(event as any).giornata}ª giornata` : ''}`
    : (event as any)?.giornata
    ? `${(event as any).giornata}ª giornata`
    : null;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Pressable style={styles.backBtn} onPress={() => router.back()} accessibilityLabel="Indietro">
            <Text style={styles.backBtnTxt}>←</Text>
          </Pressable>
          <Text style={styles.title}>Ellera{event?.opponent ? ` - ${event.opponent}` : ''}</Text>
          <TeamLogo size={28} />
        </View>
        {(event?.date || event?.time || compLabel) && (
          <Text style={styles.subtitle}>
            {event?.date} {event?.time ? `· ${event.time} ` : ''}{compLabel ? `· ${compLabel}` : ''}
          </Text>
        )}

        <View style={styles.cardsGrid}>
          <View style={styles.gridRow}>
            <Pressable
              style={[styles.gridCard, styles.convocazioneCard]}
              onPress={() => router.push(`/eventi/partita/${matchId}/convocazione`)}
            >
              <View style={[styles.iconBadge, { backgroundColor: '#16a34a' }]}>
                <Text style={styles.actionIcon}>📋</Text>
              </View>
              <Text style={styles.actionTitle}>CONVOCAZIONE</Text>
              <Text style={styles.actionSubtitle}>Chi convocare, ritrovo, PDF</Text>
            </Pressable>

            <Pressable
              style={[styles.gridCard, styles.listaGaraCard]}
              onPress={() => router.push(`/eventi/partita/${matchId}/listaGara`)}
            >
              <View style={[styles.iconBadge, { backgroundColor: '#4f46e5' }]}>
                <Text style={styles.actionIcon}>🧾</Text>
              </View>
              <Text style={styles.actionTitle}>LISTA GARA</Text>
              <Text style={styles.actionSubtitle}>Numeri e staff</Text>
            </Pressable>
          </View>

          <View style={styles.gridRow}>
            <Pressable
              style={[styles.gridCard, styles.liveCard]}
              onPress={() => router.push(`/eventi/partita/${matchId}/live`)}
            >
              <View style={[styles.iconBadge, { backgroundColor: '#dc2626' }]}>
                <Text style={styles.actionIcon}>🔴</Text>
              </View>
              <Text style={styles.actionTitle}>LIVE</Text>
              <Text style={styles.actionSubtitle}>Formazione, tattiche, cronaca</Text>
            </Pressable>

            <Pressable
              style={[styles.gridCard, styles.altrePartiteCard]}
              onPress={() => router.push(`/eventi/partita/${matchId}/altrePartite`)}
            >
              <View style={[styles.iconBadge, { backgroundColor: '#d97706' }]}>
                <Text style={styles.actionIcon}>🗓️</Text>
              </View>
              <Text style={styles.actionTitle}>ALTRE PARTITE</Text>
              <Text style={styles.actionSubtitle}>Risultati della giornata</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f7fa' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backBtn: {
    width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff',
  },
  backBtnTxt: { fontSize: 18, fontWeight: '800', color: '#111' },
  title: { flex: 1, fontSize: 20, fontWeight: '800', color: '#1a202c' },
  subtitle: { fontSize: 14, color: '#64748b', marginTop: 4 },

  preMatchInfo: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  preMatchLogos: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 16 },
  preMatchLogo: { width: 64, height: 64, borderRadius: 8, backgroundColor: '#e5e7eb' },
  preMatchVs: { fontSize: 14, fontWeight: '700', color: '#94a3b8' },
  preMatchHint: { fontSize: 13, color: '#94a3b8', marginTop: 20 },

  content: { flex: 1, padding: 20 },
  cardsGrid: {
    flex: 1,
    gap: 14,
    marginTop: 24,
  },
  gridRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 14,
  },
  gridCard: {
    flex: 1,
    minHeight: 130,
    backgroundColor: 'white',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.06)',
    paddingVertical: 16,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  convocazioneCard: { backgroundColor: '#f0fdf4' },
  listaGaraCard: { backgroundColor: '#eef2ff' },
  liveCard: { backgroundColor: '#fef2f2' },
  altrePartiteCard: { backgroundColor: '#fffbeb' },
  iconBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  actionIcon: { fontSize: 26 },
  actionTitle: { fontSize: 14, fontWeight: '900', letterSpacing: 0.3, color: '#0f172a', textAlign: 'center' },
  actionSubtitle: { fontSize: 12, color: '#6b7280', marginTop: 4, textAlign: 'center', paddingHorizontal: 4 },
});
