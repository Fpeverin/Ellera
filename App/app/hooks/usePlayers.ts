import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Player, Role } from '../data/players';
import { supabase } from '../lib/supabase';

export type { Player, Role };

export interface NewPlayerInput {
  name: string;
  role: Role;
  year: number;
  height: string;
  weight: string;
}

export interface UsePlayersResult {
  players: Player[];
  exPlayers: Player[];
  allPlayers: Player[];
  addPlayer: (input: NewPlayerInput) => Promise<Player>;
  moveToEx: (id: string) => Promise<void>;
  removePlayer: (id: string) => Promise<void>;
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

  const moveToEx = async (id: string): Promise<void> => {
    const player = active.find((p) => p.id === id);
    if (!player) return;
    const { error } = await supabase.from('players').update({ is_ex: true }).eq('id', id);
    if (error) throw error;
    setActive((prev) => prev.filter((p) => p.id !== id));
    setEx((prev) => [...prev, player]);
  };

  const removePlayer = async (id: string): Promise<void> => {
    const { error } = await supabase.from('players').delete().eq('id', id);
    if (error) throw error;
    setActive((prev) => prev.filter((p) => p.id !== id));
    setEx((prev) => prev.filter((p) => p.id !== id));
  };

  return { players: active, exPlayers: ex, allPlayers, addPlayer, moveToEx, removePlayer, refresh: load, loading };
}
