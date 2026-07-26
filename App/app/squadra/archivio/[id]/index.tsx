import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArchivedMatch, ArchivedPlayer, SeasonArchive } from '../../../data/archive';
import { loadArchiveById } from '../../../utils/archiveBuilder';

type Tab = 'partite' | 'giocatori' | 'allenamenti';

export default function ArchivioDettaglio() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [archive, setArchive] = useState<SeasonArchive | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('partite');

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

  if (!archive) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Archivio non trovato</Text>
      </View>
    );
  }

  const { summary } = archive;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Header stagione */}
      <View style={styles.seasonHeader}>
        <Text style={styles.seasonLabel}>{archive.label}</Text>
        <View style={styles.statsRow}>
          <StatPill icon="⚽" label="Partite" value={summary.totalMatches} />
          <StatPill icon="✅" label="Vittorie" value={summary.wins} />
          <StatPill icon="➖" label="Pareggi" value={summary.draws} />
          <StatPill icon="❌" label="Sconfitte" value={summary.losses} />
        </View>
        <Text style={styles.goalsSummary}>
          Gol fatti: {summary.goalsFor} · Gol subiti: {summary.goalsAgainst} · Allenamenti: {summary.totalTrainings}
        </Text>
      </View>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {(['partite', 'giocatori', 'allenamenti'] as Tab[]).map(t => (
          <Pressable key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'partite' ? 'Partite' : t === 'giocatori' ? 'Giocatori' : 'Allenamenti'}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === 'partite' && <PartiteTab archive={archive} router={router} />}
      {tab === 'giocatori' && <GiocatoriTab archive={archive} />}
      {tab === 'allenamenti' && <AllenamentiTab archive={archive} />}
    </SafeAreaView>
  );
}

function StatPill({ icon, label, value }: { icon: string; label: string; value: number }) {
  return (
    <View style={styles.pill}>
      <Text style={styles.pillIcon}>{icon}</Text>
      <Text style={styles.pillValue}>{value}</Text>
      <Text style={styles.pillLabel}>{label}</Text>
    </View>
  );
}

function PartiteTab({ archive, router }: { archive: SeasonArchive; router: any }) {
  const sorted = [...archive.matches].sort((a, b) => a.date.localeCompare(b.date));
  return (
    <ScrollView contentContainerStyle={styles.tabContent}>
      {sorted.length === 0 && (
        <Text style={styles.emptyMsg}>Nessuna partita in archivio</Text>
      )}
      {sorted.map(m => {
        const home = m.isHome ? 'ELLERA' : m.opponent;
        const away = m.isHome ? m.opponent : 'ELLERA';
        const scoreH = m.goals.filter(g => g.team === 'HOME').length;
        const scoreA = m.goals.filter(g => g.team === 'AWAY').length;
        return (
          <Pressable
            key={m.id}
            style={styles.matchCard}
            onPress={() => router.push({ pathname: '/squadra/archivio/[id]/match', params: { id: archive.id, matchId: m.id } })}
          >
            <Text style={styles.matchDate}>{formatDate(m.date)} · {m.competition}</Text>
            <View style={styles.matchRow}>
              <Text style={styles.teamName} numberOfLines={1}>{home}</Text>
              <View style={styles.scoreBadge}>
                <Text style={styles.score}>{scoreH} – {scoreA}</Text>
              </View>
              <Text style={styles.teamName} numberOfLines={1}>{away}</Text>
            </View>
            <Text style={styles.matchMeta}>
              {m.lineup ? `${m.lineup.fieldPlayerIds.filter(Boolean).length} titolari · ` : ''}
              {m.goals.length} gol · {m.subs.length} cambi · {m.cards.length} cartellini
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function GiocatoriTab({ archive }: { archive: SeasonArchive }) {
  const sorted = [...archive.squad].sort((a, b) => b.stats.minutesPlayed - a.stats.minutesPlayed);
  return (
    <ScrollView contentContainerStyle={styles.tabContent}>
      {sorted.map(p => {
        const s = p.stats;
        const role = p.role === 'PORTIERE' ? '🥅' : p.role === 'DIFENSORE' ? '🛡️' : p.role === 'CENTROCAMPISTA' ? '⚽' : '🎯';
        const golDisplay = p.role === 'PORTIERE' ? `${s.goalsConceded} sub.` : `${s.goals} gol`;
        return (
          <View key={p.id} style={styles.playerCard}>
            <View style={styles.playerTop}>
              <Text style={styles.playerRole}>{role}</Text>
              <Text style={styles.playerName} numberOfLines={1}>{p.name}</Text>
              <Text style={styles.playerMins}>{s.minutesPlayed}'</Text>
            </View>
            <View style={styles.playerStats}>
              <StatCell label="Part." value={s.matchesPlayed} />
              <StatCell label="Tit." value={s.starts} />
              <StatCell label="Pan." value={s.bench} />
              <StatCell label="Gol" value={golDisplay} />
              <StatCell label="🟨" value={s.yellowCards} />
              <StatCell label="🟥" value={s.redCards} />
              {s.trainingsTotal > 0 && (
                <StatCell label="All." value={`${s.trainingsPresent}/${s.trainingsTotal}`} />
              )}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

function AllenamentiTab({ archive }: { archive: SeasonArchive }) {
  const sorted = [...archive.trainings].sort((a, b) => a.date.localeCompare(b.date));
  const totals = archive.squad.reduce(
    (acc, p) => {
      acc.present += p.stats.trainingsPresent;
      acc.absent += p.stats.trainingsAbsent;
      acc.injured += p.stats.trainingsInjured;
      acc.diff += p.stats.trainingsDiff;
      acc.total += p.stats.trainingsTotal;
      return acc;
    },
    { present: 0, absent: 0, injured: 0, diff: 0, total: 0 }
  );
  const pct = totals.total > 0 ? Math.round((totals.present / totals.total) * 100) : 0;

  return (
    <ScrollView contentContainerStyle={styles.tabContent}>
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Riepilogo allenamenti</Text>
        <Text style={styles.summaryLine}>Totale sedute: {archive.summary.totalTrainings}</Text>
        <Text style={styles.summaryLine}>Presenze complessive: {totals.present} ({pct}%)</Text>
        <Text style={styles.summaryLine}>Assenze: {totals.absent} · Infortuni: {totals.injured} · Differenziato: {totals.diff}</Text>
      </View>

      {sorted.map(t => {
        const presentCount = Object.values(t.presenze).filter(s => s === 'presente').length;
        const total = Object.keys(t.presenze).length;
        return (
          <View key={t.id} style={styles.trainingCard}>
            <Text style={styles.trainingDate}>{formatDate(t.date)} {t.time}</Text>
            {t.tema ? <Text style={styles.trainingTema}>Tema: {t.tema}</Text> : null}
            <Text style={styles.trainingMeta}>{t.location} · {presentCount}/{total} presenti</Text>
          </View>
        );
      })}

      {sorted.length === 0 && <Text style={styles.emptyMsg}>Nessun allenamento in archivio</Text>}
    </ScrollView>
  );
}

function StatCell({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.statCell}>
      <Text style={styles.statCellValue}>{value}</Text>
      <Text style={styles.statCellLabel}>{label}</Text>
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

  seasonHeader: {
    backgroundColor: '#7c3aed',
    padding: 20,
    paddingBottom: 16,
  },
  seasonLabel: { fontSize: 28, fontWeight: '800', color: '#fff', marginBottom: 12 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  pill: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center', minWidth: 60 },
  pillIcon: { fontSize: 16 },
  pillValue: { fontSize: 20, fontWeight: '800', color: '#fff' },
  pillLabel: { fontSize: 11, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
  goalsSummary: { fontSize: 13, color: 'rgba(255,255,255,0.85)' },

  tabBar: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 3, borderBottomColor: '#7c3aed' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#64748b' },
  tabTextActive: { color: '#7c3aed' },

  tabContent: { padding: 16, gap: 12 },
  emptyMsg: { textAlign: 'center', color: '#94a3b8', fontSize: 15, paddingTop: 32 },

  matchCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  matchDate: { fontSize: 12, color: '#64748b', marginBottom: 6 },
  matchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  teamName: { flex: 1, fontSize: 15, fontWeight: '700', color: '#1e293b', textAlign: 'center' },
  scoreBadge: { backgroundColor: '#1e293b', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 4 },
  score: { fontSize: 18, fontWeight: '800', color: '#fff' },
  matchMeta: { fontSize: 12, color: '#94a3b8' },

  playerCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  playerTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  playerRole: { fontSize: 20 },
  playerName: { flex: 1, fontSize: 15, fontWeight: '700', color: '#1e293b' },
  playerMins: { fontSize: 14, fontWeight: '600', color: '#7c3aed' },
  playerStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statCell: { alignItems: 'center', minWidth: 44 },
  statCellValue: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  statCellLabel: { fontSize: 11, color: '#64748b' },

  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 4,
    borderLeftWidth: 4,
    borderLeftColor: '#7c3aed',
  },
  summaryTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b', marginBottom: 8 },
  summaryLine: { fontSize: 14, color: '#374151', marginBottom: 4 },

  trainingCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  trainingDate: { fontSize: 14, fontWeight: '700', color: '#1e293b', marginBottom: 2 },
  trainingTema: { fontSize: 13, color: '#7c3aed', fontStyle: 'italic', marginBottom: 2 },
  trainingMeta: { fontSize: 12, color: '#64748b' },
});
