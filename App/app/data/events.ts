// app/data/events.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

export type EventType = 'PARTITA' | 'ALLENAMENTO';

// Tipo per lo slot del modulo
export interface Slot {
  id: string;
  x: number; // posizione % sul campo
  y: number;
}

export interface CalendarEvent {
  id: string;
  type: EventType;
  date: string;        // YYYY-MM-DD
  time: string;        // HH:mm
  location: string;
  opponent?: string;   // solo per PARTITA

  // Dati legati al singolo evento:
  module?: string;                         // modulo scelto (es. '4-4-2')
  formationSlots?: { slot: Slot; playerId?: string }[]; // posizioni in campo
  benchIds?: string[];                     // id dei giocatori in panchina
  tacticsIds?: string[];                   // array di ID tattiche salvate in Gestione Squadra

  tattiche?: string;                        // note/testo
  presenze?: Record<string, boolean>;       // allenamento: playerId -> presente
  temaAllenamento?: string;                 // allenamento: tema della seduta
}

export const STORAGE_KEY = 'calendar/events';

export async function loadEvents(): Promise<CalendarEvent[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  const list: any[] = JSON.parse(raw);

  // Migrazione soft: garantisco campi minimi
  return list.map((e) => ({
    id: String(e.id),
    type:
      e.type === 'Partita' || e.type === 'PARTITA'
        ? 'PARTITA'
        : e.type === 'Allenamento' || e.type === 'ALLENAMENTO'
        ? 'ALLENAMENTO'
        : 'ALLENAMENTO', // default prudente
    date: e.date ?? '',
    time: e.time ?? '00:00',
    location: e.location ?? '',
    opponent: e.opponent ?? undefined,
    module: e.module ?? undefined,
    formationSlots: e.formationSlots ?? undefined,
    benchIds: e.benchIds ?? [],
    tacticsIds: e.tacticsIds ?? [],
    tattiche: e.tattiche ?? undefined,
    presenze: e.presenze ?? undefined,
    temaAllenamento: e.temaAllenamento ?? undefined,
  }));
}

export async function saveEvents(events: CalendarEvent[]) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(events));
}
