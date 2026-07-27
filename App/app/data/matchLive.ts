// app/data/matchLive.ts
//
// Sostituisce le 9 chiavi AsyncStorage per-partita di prima con un'unica
// riga per partita nella tabella "match_live". Ogni funzione get/set legge
// o scrive UNA colonna di quella riga (upsert, cosi' non serve sapere se la
// riga esiste gia' — i default della tabella coprono l'inserimento iniziale
// e un upsert parziale non tocca le altre colonne).
import { getCurrentOrgId } from '../lib/currentOrg';
import { supabase } from '../lib/supabase';

export type TeamSide = 'HOME' | 'AWAY';

export type GoalItem = { id: string; team: TeamSide; minute: number; scorer: string; playerId?: string };
export type SubItem = {
  id: string;
  minute: number;
  outId?: string;
  outName: string;
  inId?: string;
  inName: string;
  team?: TeamSide;
};
export type CardItem = {
  id: string;
  minute: number;
  team: TeamSide;
  color: 'YELLOW' | 'RED';
  playerId?: string;
  playerName: string;
  autoFromSecondYellow?: boolean;
};
export type InCampoPlayer = { id: string; name: string; inField: boolean; expelled?: boolean };
export type PersistTimer = {
  running: boolean;
  startAt: number | null;
  pausedAccum: number;
  lastPausedAt: number | null;
};
export type SavedLineup = {
  moduleName: string | null;
  convocati: string[];
  field: (string | null)[];
  bench: string[];
  numbers?: Record<string, number>;
};
export type PosOverride = { x: number; y: number } | null;
export type AssignState = Record<string, Record<string, string | null>>;

async function getColumn<T>(eventId: string, column: string): Promise<T | null> {
  const { data, error } = await supabase
    .from('match_live')
    .select(column)
    .eq('event_id', eventId)
    .maybeSingle();
  if (error) throw error;
  return (data as any)?.[column] ?? null;
}

async function setColumn(eventId: string, column: string, value: unknown): Promise<void> {
  const orgId = getCurrentOrgId();
  const { error } = await supabase
    .from('match_live')
    .upsert({ event_id: eventId, org_id: orgId, [column]: value }, { onConflict: 'event_id' });
  if (error) throw error;
}

export const loadGoals = (eventId: string) => getColumn<GoalItem[]>(eventId, 'goals').then((v) => v ?? []);
export const saveGoals = (eventId: string, goals: GoalItem[]) => setColumn(eventId, 'goals', goals);

export const loadSubs = (eventId: string) => getColumn<SubItem[]>(eventId, 'subs').then((v) => v ?? []);
export const saveSubs = (eventId: string, subs: SubItem[]) => setColumn(eventId, 'subs', subs);

export const loadCards = (eventId: string) => getColumn<CardItem[]>(eventId, 'cards').then((v) => v ?? []);
export const saveCards = (eventId: string, cards: CardItem[]) => setColumn(eventId, 'cards', cards);

export const loadLineup = (eventId: string) => getColumn<SavedLineup>(eventId, 'lineup');
export const saveLineup = (eventId: string, lineup: SavedLineup) => setColumn(eventId, 'lineup', lineup);

export const loadPositions = (eventId: string) =>
  getColumn<PosOverride[]>(eventId, 'positions').then((v) => v ?? []);
export const savePositions = (eventId: string, positions: PosOverride[]) =>
  setColumn(eventId, 'positions', positions);

export const loadLiveFormation = (eventId: string) =>
  getColumn<InCampoPlayer[]>(eventId, 'live_formation').then((v) => v ?? []);
export const saveLiveFormation = (eventId: string, formation: InCampoPlayer[]) =>
  setColumn(eventId, 'live_formation', formation);

export const loadStarted = (eventId: string) => getColumn<boolean>(eventId, 'started').then((v) => v ?? false);
export const setStarted = (eventId: string, started: boolean) => setColumn(eventId, 'started', started);

export const loadTimerState = (eventId: string) => getColumn<PersistTimer>(eventId, 'timer_state');
export const saveTimerState = (eventId: string, timer: PersistTimer) => setColumn(eventId, 'timer_state', timer);

export const loadTacticsAssignments = (eventId: string) =>
  getColumn<AssignState>(eventId, 'tactics_assignments').then((v) => v ?? {});
export const saveTacticsAssignments = (eventId: string, assignments: AssignState) =>
  setColumn(eventId, 'tactics_assignments', assignments);

/** Cancella l'intera riga di una partita (usato quando si archivia la stagione). */
export async function deleteMatchLive(eventId: string): Promise<void> {
  const { error } = await supabase.from('match_live').delete().eq('event_id', eventId);
  if (error) throw error;
}
