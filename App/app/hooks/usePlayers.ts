import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { exPlayers as staticExPlayers, players as staticPlayers, Player, Role } from '../data/players';
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
  customPlayers: Player[];
  addPlayer: (input: NewPlayerInput) => Promise<Player>;
  moveToEx: (id: string) => Promise<void>;
  removeCustomPlayer: (id: string) => Promise<void>;
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
  const [customActive, setCustomActive] = useState<Player[]>([]);
  const [customEx, setCustomEx] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('players').select('*').order('name');
      if (error) throw error;
      const all = (data ?? []).map(rowToPlayer);
      const rows = data ?? [];
      setCustomActive(all.filter((_, i) => !rows[i].is_ex));
      setCustomEx(all.filter((_, i) => rows[i].is_ex));
    } catch {
      setCustomActive([]);
      setCustomEx([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const players = [...staticPlayers, ...customActive];
  const exPlayers = [...staticExPlayers, ...customEx];
  const allPlayers = [...players, ...exPlayers];

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
    setCustomActive((prev) => [...prev, newPlayer]);
    return newPlayer;
  };

  const moveToEx = async (id: string): Promise<void> => {
    const player = customActive.find((p) => p.id === id);
    if (!player) return;
    const { error } = await supabase.from('players').update({ is_ex: true }).eq('id', id);
    if (error) throw error;
    setCustomActive((prev) => prev.filter((p) => p.id !== id));
    setCustomEx((prev) => [...prev, player]);
  };

  const removeCustomPlayer = async (id: string): Promise<void> => {
    const { error } = await supabase.from('players').delete().eq('id', id);
    if (error) throw error;
    setCustomActive((prev) => prev.filter((p) => p.id !== id));
    setCustomEx((prev) => prev.filter((p) => p.id !== id));
  };

  return { players, exPlayers, allPlayers, customPlayers: customActive, addPlayer, moveToEx, removeCustomPlayer, loading };
}
