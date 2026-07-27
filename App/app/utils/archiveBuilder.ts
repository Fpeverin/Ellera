import AsyncStorage from '@react-native-async-storage/async-storage';
import { Player } from '../data/players';
import { CalendarEvent, loadEvents, saveEvents } from '../data/events';
import { loadPhotoMap } from '../data/playerMedia';
import {
  ARCHIVE_INDEX_KEY,
  ArchivedCard,
  ArchivedGoal,
  ArchivedLineup,
  ArchivedMatch,
  ArchivedPlayer,
  ArchivedPlayerStats,
  ArchivedSub,
  ArchivedTraining,
  SeasonArchive,
  SeasonSummary,
  archiveKey,
} from '../data/archive';

type PresenceStatus = 'presente' | 'assente' | 'infortunato' | 'differenziato';

const GOALS_KEY = (id: string) => `matches/goals/${id}`;
const SUBS_KEY = (id: string) => `matches/subs/${id}`;
const CARDS_KEY = (id: string) => `matches/cards/${id}`;
const LINEUP_KEY = (id: string) => `match/${id}/lineup`;
const LIVE_KEY = (id: string) => `live/formation/${id}`;
const TIMER_KEY = (id: string) => `live/timerState/${id}`;
const LIVE_STARTED_KEY = (id: string) => `live/started/${id}`;

function parseOrNull<T>(raw: string | null): T | null {
  if (!raw) return null;
  try { return JSON.parse(raw) as T; } catch { return null; }
}

type RawGoal = {
  id: string; team: 'HOME' | 'AWAY'; minute: number;
  scorer?: string; playerId?: string; scorerId?: string;
};
type RawSub = { id: string; minute: number; outId?: string; outName?: string; inId?: string; inName?: string };
type RawCard = {
  id?: string; minute?: number; team?: 'HOME' | 'AWAY';
  color?: string; type?: string; playerId?: string; playerName?: string; name?: string;
};
type RawLineup = { field?: (string | null)[]; bench?: string[] };

function normalizeGoals(raw: RawGoal[] | null): ArchivedGoal[] {
  if (!raw) return [];
  return raw.map((g, i) => ({
    id: g.id ?? String(i),
    team: g.team ?? 'HOME',
    minute: g.minute ?? 0,
    scorerName: g.scorer ?? '',
    scorerId: g.playerId ?? g.scorerId,
  }));
}

function normalizeSubs(raw: RawSub[] | null): ArchivedSub[] {
  if (!raw) return [];
  return raw.map((s, i) => ({
    id: s.id ?? String(i),
    minute: s.minute ?? 0,
    outId: s.outId ?? '',
    outName: s.outName ?? '',
    inId: s.inId ?? '',
    inName: s.inName ?? '',
  }));
}

function normalizeCards(raw: RawCard[] | null): ArchivedCard[] {
  if (!raw) return [];
  return raw.map((c, i) => {
    const colorRaw = (c.color || c.type || '').toString().toUpperCase();
    let color: 'YELLOW' | 'RED' = 'YELLOW';
    if (colorRaw.includes('RED') || colorRaw === 'R' || colorRaw === 'ROSSO') color = 'RED';
    else if (colorRaw.includes('SECOND') || colorRaw === '2Y') color = 'RED';
    return {
      id: c.id ?? String(i),
      minute: c.minute ?? 0,
      team: (c.team ?? 'HOME') as 'HOME' | 'AWAY',
      color,
      playerId: c.playerId,
      playerName: c.playerName ?? c.name ?? '',
    };
  });
}

function normalizeLineup(raw: RawLineup | null, ev: CalendarEvent): ArchivedLineup | null {
  if (raw) {
    return {
      moduleName: ev.module ?? null,
      convocatiIds: [
        ...((raw.field ?? []).filter(Boolean) as string[]),
        ...(raw.bench ?? []),
      ],
      fieldPlayerIds: raw.field ?? [],
      benchPlayerIds: raw.bench ?? [],
    };
  }
  if (ev.formationSlots || ev.benchIds) {
    const fieldIds = (ev.formationSlots ?? []).map(fs => fs.playerId ?? null);
    return {
      moduleName: ev.module ?? null,
      convocatiIds: [
        ...fieldIds.filter(Boolean) as string[],
        ...(ev.benchIds ?? []),
      ],
      fieldPlayerIds: fieldIds,
      benchPlayerIds: ev.benchIds ?? [],
    };
  }
  return null;
}

function computeStats(
  allPlayers: Player[],
  matches: ArchivedMatch[],
  trainings: ArchivedTraining[],
  photos: Record<string, string | null>
): ArchivedPlayer[] {
  const acc: Record<string, ArchivedPlayerStats> = {};
  const empty = (): ArchivedPlayerStats => ({
    matchesPlayed: 0, minutesPlayed: 0, goals: 0, goalsConceded: 0,
    starts: 0, bench: 0, notCalled: 0, subbedOn: 0, subbedOff: 0,
    yellowCards: 0, redCards: 0,
    trainingsTotal: 0, trainingsPresent: 0, trainingsAbsent: 0, trainingsInjured: 0, trainingsDiff: 0,
  });

  for (const p of allPlayers) {
    acc[p.id] = empty();
  }

  for (const m of matches) {
    const lu = m.lineup;
    const field = (lu?.fieldPlayerIds ?? []).filter(Boolean) as string[];
    const bench = lu?.benchPlayerIds ?? [];
    const FULL = 90;
    const isHome = m.isHome;
    const opponentSide: 'HOME' | 'AWAY' = isHome ? 'AWAY' : 'HOME';

    for (const p of allPlayers) {
      const s = acc[p.id];
      const started = field.includes(p.id);
      const subOnMin = (() => {
        const xs = m.subs.filter(sb => sb.inId === p.id).map(sb => sb.minute);
        return xs.length ? Math.min(...xs) : null;
      })();
      const subOffMin = (() => {
        const xs = m.subs.filter(sb => sb.outId === p.id).map(sb => sb.minute);
        return xs.length ? Math.min(...xs) : null;
      })();

      let minutes = 0;
      let onFrom: number | null = null;
      let onTo: number | null = null;
      if (started) {
        onFrom = 0; onTo = subOffMin ?? FULL;
        minutes = Math.max(0, onTo - onFrom);
      } else if (subOnMin != null) {
        onFrom = subOnMin; onTo = subOffMin ?? FULL;
        minutes = Math.max(0, onTo - onFrom);
      }

      if (started || subOnMin != null) s.matchesPlayed++;
      s.minutesPlayed += minutes;
      if (started) s.starts++;
      if (lu && bench.includes(p.id) && subOnMin == null) s.bench++;
      if (lu && !field.includes(p.id) && !bench.includes(p.id)) s.notCalled++;
      if (subOnMin != null) s.subbedOn++;
      if (started && subOffMin != null) s.subbedOff++;

      s.goals += m.goals.filter(g =>
        (g.scorerId && g.scorerId === p.id) || (!g.scorerId && g.scorerName === p.name)
      ).length;

      for (const c of m.cards) {
        const match = (c.playerId && c.playerId === p.id) || (!c.playerId && c.playerName === p.name);
        if (!match) continue;
        if (c.color === 'RED') s.redCards++;
        else s.yellowCards++;
      }

      if (p.role === 'PORTIERE' && onFrom != null && onTo != null) {
        s.goalsConceded += m.goals.filter(g => g.team === opponentSide && g.minute >= onFrom! && g.minute < onTo!).length;
      }
    }
  }

  for (const t of trainings) {
    for (const p of allPlayers) {
      const s = acc[p.id];
      const status = t.presenze[p.id];
      if (!status) continue;
      s.trainingsTotal++;
      if (status === 'presente') s.trainingsPresent++;
      else if (status === 'assente') s.trainingsAbsent++;
      else if (status === 'infortunato') s.trainingsInjured++;
      else if (status === 'differenziato') s.trainingsDiff++;
    }
  }

  return allPlayers.map(p => ({
    id: p.id,
    name: p.name,
    role: p.role,
    year: p.year,
    height: p.height,
    weight: p.weight,
    photo: photos[p.id] ?? null,
    stats: acc[p.id] ?? empty(),
  }));
}

function computeSummary(matches: ArchivedMatch[], trainings: ArchivedTraining[]): SeasonSummary {
  let wins = 0, draws = 0, losses = 0, goalsFor = 0, goalsAgainst = 0;
  for (const m of matches) {
    if (m.scoreHome == null || m.scoreAway == null) continue;
    const ourScore = m.isHome ? m.scoreHome : m.scoreAway;
    const theirScore = m.isHome ? m.scoreAway : m.scoreHome;
    goalsFor += ourScore;
    goalsAgainst += theirScore;
    if (ourScore > theirScore) wins++;
    else if (ourScore === theirScore) draws++;
    else losses++;
  }
  return { totalMatches: matches.length, wins, draws, losses, goalsFor, goalsAgainst, totalTrainings: trainings.length };
}

export async function buildSeasonArchive(label: string, allPlayers: Player[]): Promise<SeasonArchive> {
  const events: CalendarEvent[] = await loadEvents();

  const matchEvents = events.filter(e => e.type === 'PARTITA');
  const trainingEvents = events.filter(e => e.type === 'ALLENAMENTO');

  const photos: Record<string, string | null> = await loadPhotoMap();

  // Carica tutti i dati di ogni partita in parallelo
  const matchDataBatch = await Promise.all(
    matchEvents.map(async (ev) => {
      const id = String(ev.id);
      const [goalsRaw, subsRaw, cardsRaw, lineupRaw] = await Promise.all([
        AsyncStorage.getItem(GOALS_KEY(id)),
        AsyncStorage.getItem(SUBS_KEY(id)),
        AsyncStorage.getItem(CARDS_KEY(id)),
        AsyncStorage.getItem(LINEUP_KEY(id)),
      ]);
      return { ev, goalsRaw, subsRaw, cardsRaw, lineupRaw };
    })
  );

  const matches: ArchivedMatch[] = matchDataBatch.map(({ ev, goalsRaw, subsRaw, cardsRaw, lineupRaw }) => {
    const goals = normalizeGoals(parseOrNull<RawGoal[]>(goalsRaw));
    const subs = normalizeSubs(parseOrNull<RawSub[]>(subsRaw));
    const cards = normalizeCards(parseOrNull<RawCard[]>(cardsRaw));
    const lineup = normalizeLineup(parseOrNull<RawLineup>(lineupRaw), ev);
    // isHome e homeAway sono campi runtime non dichiarati nel tipo CalendarEvent
    const evAny = ev as any;
    const isHome = evAny.isHome !== false && evAny.homeAway !== 'AWAY';

    return {
      id: String(ev.id),
      date: ev.date,
      time: ev.time,
      location: ev.location,
      opponent: ev.opponent ?? '',
      competition: ((ev as any).competition ?? (ev as any).competizione ?? '').toString().trim() || '—',
      isHome,
      scoreHome: goals.filter(g => g.team === 'HOME').length || undefined,
      scoreAway: goals.filter(g => g.team === 'AWAY').length || undefined,
      lineup,
      goals,
      subs,
      cards,
      tacticsIds: ev.tacticsIds ?? [],
    };
  });

  const trainings: ArchivedTraining[] = trainingEvents.map(ev => {
    const presenze: Record<string, 'presente' | 'assente' | 'infortunato' | 'differenziato'> = {};
    const raw = (ev.presenze ?? {}) as Record<string, any>;
    for (const [pid, v] of Object.entries(raw)) {
      if (typeof v === 'boolean') presenze[pid] = v ? 'presente' : 'assente';
      else presenze[pid] = v as PresenceStatus;
    }
    return {
      id: String(ev.id),
      date: ev.date,
      time: ev.time,
      location: ev.location,
      tema: ev.temaAllenamento,
      presenze,
    };
  });

  const squad = computeStats(allPlayers, matches, trainings, photos);
  const summary = computeSummary(matches, trainings);

  return {
    id: `season-${Date.now()}`,
    label,
    archivedAt: new Date().toISOString(),
    summary,
    squad,
    matches,
    trainings,
  };
}

export async function saveArchive(archive: SeasonArchive): Promise<void> {
  const indexRaw = await AsyncStorage.getItem(ARCHIVE_INDEX_KEY);
  const index: string[] = indexRaw ? JSON.parse(indexRaw) : [];
  index.push(archive.id);
  await Promise.all([
    AsyncStorage.setItem(ARCHIVE_INDEX_KEY, JSON.stringify(index)),
    AsyncStorage.setItem(archiveKey(archive.id), JSON.stringify(archive)),
  ]);
}

export async function clearCurrentSeasonData(matches: ArchivedMatch[]): Promise<void> {
  // Elimina tutte le partite e gli allenamenti correnti (ora su Supabase)
  await saveEvents([]);

  // Elimina i dati dettaglio di ogni partita
  const keysToDelete: string[] = [];
  for (const m of matches) {
    keysToDelete.push(
      GOALS_KEY(m.id),
      SUBS_KEY(m.id),
      CARDS_KEY(m.id),
      LINEUP_KEY(m.id),
      LIVE_KEY(m.id),
      TIMER_KEY(m.id),
      LIVE_STARTED_KEY(m.id),
    );
  }
  await Promise.all(keysToDelete.map(k => AsyncStorage.removeItem(k)));
}

export async function loadArchiveIndex(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(ARCHIVE_INDEX_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function loadArchiveById(id: string): Promise<SeasonArchive | null> {
  const raw = await AsyncStorage.getItem(archiveKey(id));
  return raw ? JSON.parse(raw) : null;
}

export async function loadAllArchives(): Promise<SeasonArchive[]> {
  const index = await loadArchiveIndex();
  const results = await Promise.all(index.map(id => loadArchiveById(id)));
  return results.filter(Boolean) as SeasonArchive[];
}

export async function deleteArchive(id: string): Promise<void> {
  const indexRaw = await AsyncStorage.getItem(ARCHIVE_INDEX_KEY);
  const index: string[] = indexRaw ? JSON.parse(indexRaw) : [];
  const updated = index.filter(i => i !== id);
  await Promise.all([
    AsyncStorage.setItem(ARCHIVE_INDEX_KEY, JSON.stringify(updated)),
    AsyncStorage.removeItem(archiveKey(id)),
  ]);
}
