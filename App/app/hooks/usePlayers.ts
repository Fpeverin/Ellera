import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { loadEvents } from '../data/events';
import { isPlayerInMatches } from '../data/matchLive';
import { Player, Role } from '../data/players';
import { supabase } from '../lib/supabase';

/** Lanciata da removePlayer quando il giocatore ha gia' preso parte a una partita della stagione corrente. */
export class PlayerInMatchError extends Error {
  constructor() {
    super('Questo giocatore ha gia\' preso parte a una partita di questa stagione: non puo\' essere eliminato del tutto, solo spostato tra gli ex.');
    this.name = 'PlayerInMatchError';
  }
}

export type { Player, Role };

export interface NewPlayerInput {
  name: string;
  role: Role;
  year: number;
  height: string;
  weight: string;
}

export interface RemovePlayersResult {
  /** id dei giocatori eliminati con successo */
  removed: string[];
  /** id dei giocatori NON eliminati perche' gia' in una partita della stagione corrente */
  blocked: string[];
}

export interface UsePlayersResult {
  players: Player[];
  exPlayers: Player[];
  allPlayers: Player[];
  addPlayer: (input: NewPlayerInput) => Promise<Player>;
  moveToEx: (id: string) => Promise<void>;
  moveToExMany: (ids: string[]) => Promise<void>;
  removePlayer: (id: string) => Promise<void>;
  /** Elimina piu' giocatori insieme; quelli gia' in una partita di questa stagione vengono saltati (mai un errore in blocco). */
  removePlayers: (ids: string[]) => Promise<RemovePlayersResult>;
  /** Ricarica dalla base dati — utile dopo modifiche fatte fuori da questo hook (es. import massivo). */
  refresh: () => Promise<void>;
  loading: boolean;
}

function rowToPlayer(row: any): Player {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    year: row.year,
    height: row.height,
    weight: row.weight,
    photo: null,
  };
}

export function usePlayers(): UsePlayersResult {
  const [active, setActive] = useState<Player[]>([]);
  const [ex, setEx] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('players').select('*').order('name');
      if (error) throw error;
      const rows = data ?? [];
      setActive(rows.filter((r) => !r.is_ex).map(rowToPlayer));
      setEx(rows.filter((r) => r.is_ex).map(rowToPlayer));
    } catch {
      setActive([]);
      setEx([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const allPlayers = [...active, ...ex];

  const addPlayer = async (input: NewPlayerInput): Promise<Player> => {
    const newPlayer: Player = {
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: input.name.trim().toUpperCase(),
      role: input.role,
      year: input.year,
      height: input.height,
      weight: input.weight,
      photo: null,
    };
    const { error } = await supabase.from('players').insert({
      id: newPlayer.id,
      name: newPlayer.name,
      role: newPlayer.role,
      year: newPlayer.year,
      height: newPlayer.height,
      weight: newPlayer.weight,
      is_ex: false,
    });
    if (error) throw error;
    setActive((prev) => [...prev, newPlayer]);
    return newPlayer;
  };

  const moveToExMany = async (ids: string[]): Promise<void> => {
    const toMove = active.filter((p) => ids.includes(p.id));
    if (toMove.length === 0) return;
    const { error } = await supabase.from('players').update({ is_ex: true }).in('id', ids);
    if (error) throw error;
    setActive((prev) => prev.filter((p) => !ids.includes(p.id)));
    setEx((prev) => [...prev, ...toMove]);
  };

  const moveToEx = (id: string) => moveToExMany([id]);

  const removePlayers = async (ids: string[]): Promise<RemovePlayersResult> => {
    const events = await loadEvents();
    const matchIds = events.filter((e) => e.type === 'PARTITA').map((e) => e.id);

    const removed: string[] = [];
    const blocked: string[] = [];
    for (const id of ids) {
      if (await isPlayerInMatches(id, matchIds)) {
        blocked.push(id);
      } else {
        removed.push(id);
      }
    }

    if (removed.length > 0) {
      const { error } = await supabase.from('players').delete().in('id', removed);
      if (error) throw error;
      setActive((prev) => prev.filter((p) => !removed.includes(p.id)));
      setEx((prev) => prev.filter((p) => !removed.includes(p.id)));
    }

    return { removed, blocked };
  };

  const removePlayer = async (id: string): Promise<void> => {
    const { blocked } = await removePlayers([id]);
    if (blocked.length > 0) throw new PlayerInMatchError();
  };

  return {
    players: active,
    exPlayers: ex,
    allPlayers,
    addPlayer,
    moveToEx,
    moveToExMany,
    removePlayer,
    removePlayers,
    refresh: load,
    loading,
  };
}
