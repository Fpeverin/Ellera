import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArchivedCard, ArchivedGoal, ArchivedMatch, ArchivedSub, SeasonArchive } from '../../../data/archive';
import { loadArchiveById } from '../../../utils/archiveBuilder';

type TimelineEvent =
  | { kind: 'goal'; minute: number; data: ArchivedGoal }
  | { kind: 'sub'; minute: number; data: ArchivedSub }
  | { kind: 'card'; minute: number; data: ArchivedCard };

export default function ArchivioMatch() {
  const { id, matchId } = useLocalSearchParams<{ id: string; matchId: string }>();
  const [archive, setArchive] = useState<SeasonArchive | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadArchiveById(id).then(a => { setArchive(a); setLoading(false); });
  }, [id]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#7c3aed" />
      </View>
    );
  }

  const match: ArchivedMatch | undefined = archive?.matches.find(m => m.id === matchId);

  if (!archive || !match) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Partita non trovata</Text>
      </View>
    );
  }

  const scoreHome = match.goals.filter(g => g.team === 'HOME').length;
  const scoreAway = match.goals.filter(g => g.team === 'AWAY').length;
  const home = match.isHome ? 'ELLERA' : match.opponent;
  const away = match.isHome ? match.opponent : 'ELLERA';

  // Costruisco timeline cronologica
  const timeline: TimelineEvent[] = [
    ...match.goals.map(g => ({ kind: 'goal' as const, minute: g.minute, data: g })),
    ...match.subs.map(s => ({ kind: 'sub' as const, minute: s.minute, data: s })),
    ...match.cards.map(c => ({ kind: 'card' as const, minute: c.minute, data: c })),
  ].sort((a, b) => a.minute - b.minute);

  // Mappa id → nome dalla squad archiviata
  const playerName = (id: string) => archive.squad.find(p => p.id === id)?.name ?? id;

  const lu = match.lineup;
  const fieldIds = lu?.fieldPlayerIds ?? [];
  const benchIds = lu?.benchPlayerIds ?? [];

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>

        {/* Risultato */}
        <View style={styles.resultCard}>
          <Text style={styles.matchMeta}>{formatDate(match.date)} · {match.competition}</Text>
          <Text style={styles.locationText}>{match.location}</Text>
          <View style={styles.scoreRow}>
            <Text style={styles.teamLabel} numberOfLines={2}>{home}</Text>
            <View style={styles.scoreBadge}>
              <Text style={styles.scoreText}>{scoreHome} – {scoreAway}</Text>
            </View>
            <Text style={styles.teamLabel} numberOfLines={2}>{away}</Text>
          </View>
        </View>

        {/* Formazione */}
        {lu && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Formazione {lu.moduleName ? `(${lu.moduleName})` : ''}</Text>

            {fieldIds.length > 0 && (
              <>
                <Text style={styles.subsectionLabel}>Titolari</Text>
                {fieldIds.map((pid, i) => pid ? (
                  <View key={i} style={styles.playerRow}>
                    <Text style={styles.playerNum}>{i + 1}</Text>
                    <Text style={styles.playerNameText}>{playerName(pid)}</Text>
                  </View>
                ) : null)}
              </>
            )}

            {benchIds.length > 0 && (
              <>
                <Text style={[styles.subsectionLabel, { marginTop: 12 }]}>Panchina</Text>
                {benchIds.map((pid, i) => (
                  <View key={i} style={[styles.playerRow, styles.benchRow]}>
                    <Text style={styles.playerNum}>B</Text>
                    <Text style={styles.playerNameText}>{playerName(pid)}</Text>
                  </View>
                ))}
              </>
            )}
          </View>
        )}

        {/* Tattiche */}
        {match.tacticsIds.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tattiche assegnate</Text>
            {match.tacticsIds.map((tid, i) => (
              <Text key={i} style={styles.tacticItem}>📐 {tid}</Text>
            ))}
          </View>
        )}

        {/* Timeline */}
        {timeline.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Cronologia</Text>
            {timeline.map((ev, i) => (
              <TimelineRow key={i} event={ev} isHome={match.isHome} playerName={playerName} />
            ))}
          </View>
        )}

        {timeline.length === 0 && !lu && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Nessun dettaglio registrato per questa partita</Text>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

function TimelineRow({
  event,
  isHome,
  playerName,
}: {
  event: TimelineEvent;
  isHome: boolean;
  playerName: (id: string) => string;
}) {
  let icon = '';
  let text = '';
  let color = '#1e293b';

  if (event.kind === 'goal') {
    const g = event.data;
    const isOurGoal = isHome ? g.team === 'HOME' : g.team === 'AWAY';
    icon = isOurGoal ? '⚽' : '🔴';
    text = isOurGoal
      ? `Gol — ${g.scorerName || 'N/D'}`
      : `Gol subito (${g.scorerName || 'N/D'})`;
    color = isOurGoal ? '#16a34a' : '#dc2626';
  } else if (event.kind === 'sub') {
    const s = event.data;
    icon = '🔄';
    text = `${playerName(s.inId) || s.inName} ↔ ${playerName(s.outId) || s.outName}`;
  } else {
    const c = event.data;
    const isOurCard = isHome ? c.team === 'HOME' : c.team === 'AWAY';
    icon = c.color === 'RED' ? '🟥' : '🟨';
    text = isOurCard
      ? (c.playerId ? playerName(c.playerId) : c.playerName)
      : `Avversario — ${c.playerName}`;
    color = c.color === 'RED' ? '#dc2626' : '#ca8a04';
  }

  return (
    <View style={styles.timelineRow}>
      <View style={styles.minuteBadge}>
        <Text style={styles.minuteText}>{event.minute}'</Text>
      </View>
      <Text style={styles.timelineIcon}>{icon}</Text>
      <Text style={[styles.timelineText, { color }]} numberOfLines={2}>{text}</Text>
    </View>
  );
}

function formatDate(d: string) {
  try {
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
  } catch { return d; }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: 16, color: '#64748b' },
  content: { padding: 16, gap: 16 },

  resultCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  matchMeta: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 2 },
  locationText: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 16, fontStyle: 'italic' },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 12, width: '100%' },
  teamLabel: { flex: 1, fontSize: 15, fontWeight: '700', color: '#fff', textAlign: 'center' },
  scoreBadge: { backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  scoreText: { fontSize: 24, fontWeight: '900', color: '#1e293b' },

  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b', marginBottom: 12 },
  subsectionLabel: { fontSize: 13, fontWeight: '600', color: '#7c3aed', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },

  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  benchRow: { opacity: 0.7 },
  playerNum: { width: 24, fontSize: 13, fontWeight: '700', color: '#94a3b8', textAlign: 'center' },
  playerNameText: { fontSize: 14, fontWeight: '600', color: '#1e293b' },

  tacticItem: { fontSize: 14, color: '#374151', paddingVertical: 4 },

  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  minuteBadge: {
    width: 36,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    paddingVertical: 3,
    alignItems: 'center',
  },
  minuteText: { fontSize: 12, fontWeight: '700', color: '#64748b' },
  timelineIcon: { fontSize: 18, width: 24, textAlign: 'center' },
  timelineText: { flex: 1, fontSize: 14, fontWeight: '600' },

  emptyState: { alignItems: 'center', paddingVertical: 32 },
  emptyText: { fontSize: 14, color: '#94a3b8', textAlign: 'center' },
});
