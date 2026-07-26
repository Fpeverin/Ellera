import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { exPlayers as staticExPlayers, players as staticPlayers, Player, Role } from '../data/players';

const CUSTOM_ACTIVE_KEY = 'players/custom';
const CUSTOM_EX_KEY = 'players/custom/ex';

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

export function usePlayers(): UsePlayersResult {
  const [customActive, setCustomActive] = useState<Player[]>([]);
  const [customEx, setCustomEx] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [rawActive, rawEx] = await Promise.all([
        AsyncStorage.getItem(CUSTOM_ACTIVE_KEY),
        AsyncStorage.getItem(CUSTOM_EX_KEY),
      ]);
      setCustomActive(rawActive ? JSON.parse(rawActive) : []);
      setCustomEx(rawEx ? JSON.parse(rawEx) : []);
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
    const next = [...customActive, newPlayer];
    await AsyncStorage.setItem(CUSTOM_ACTIVE_KEY, JSON.stringify(next));
    setCustomActive(next);
    return newPlayer;
  };

  const moveToEx = async (id: string): Promise<void> => {
    const player = customActive.find(p => p.id === id);
    if (!player) return;
    const nextActive = customActive.filter(p => p.id !== id);
    const nextEx = [...customEx, player];
    await Promise.all([
      AsyncStorage.setItem(CUSTOM_ACTIVE_KEY, JSON.stringify(nextActive)),
      AsyncStorage.setItem(CUSTOM_EX_KEY, JSON.stringify(nextEx)),
    ]);
    setCustomActive(nextActive);
    setCustomEx(nextEx);
  };

  const removeCustomPlayer = async (id: string): Promise<void> => {
    const nextActive = customActive.filter(p => p.id !== id);
    const nextEx = customEx.filter(p => p.id !== id);
    await Promise.all([
      AsyncStorage.setItem(CUSTOM_ACTIVE_KEY, JSON.stringify(nextActive)),
      AsyncStorage.setItem(CUSTOM_EX_KEY, JSON.stringify(nextEx)),
    ]);
    setCustomActive(nextActive);
    setCustomEx(nextEx);
  };

  return { players, exPlayers, allPlayers, customPlayers: customActive, addPlayer, moveToEx, removeCustomPlayer, loading };
}
