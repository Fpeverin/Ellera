// app/data/events.ts
import { getCurrentOrgId } from '../lib/currentOrg';
import { supabase } from '../lib/supabase';

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
  // allenamento: playerId -> presente (legacy: boolean) o stato presenza (stringa, es. PresenceStatus)
  presenze?: Record<string, boolean | string>;
  temaAllenamento?: string;                 // allenamento: tema della seduta

  // altri campi runtime usati da alcune schermate (competition, homeAway,
  // status, score, resultText...) — restano dinamici, salvati tutti nella
  // colonna "data" jsonb della riga Supabase.
  [extra: string]: any;
}

const CORE_COLUMNS = ['id', 'type', 'date', 'time', 'location', 'opponent'] as const;

function rowToEvent(row: any): CalendarEvent {
  return {
    id: row.id,
    type: row.type,
    date: row.date,
    time: row.time ?? '00:00',
    location: row.location ?? '',
    opponent: row.opponent ?? undefined,
    ...(row.data ?? {}),
  };
}

function eventToRow(ev: CalendarEvent, orgId: string) {
  const rest: Record<string, any> = {};
  for (const key of Object.keys(ev)) {
    if (!(CORE_COLUMNS as readonly string[]).includes(key)) rest[key] = (ev as any)[key];
  }
  return {
    id: ev.id,
    org_id: orgId,
    type: ev.type,
    date: ev.date,
    time: ev.time ?? '00:00',
    location: ev.location ?? '',
    opponent: ev.opponent ?? null,
    data: rest,
  };
}

/**
 * Aggiorna solo alcuni campi dinamici (colonna "data") di un evento senza
 * toccare il resto — più sicuro di saveEvents (che riscrive l'intero
 * elenco) quando serve patchare un singolo campo da una schermata che non
 * ha già in memoria tutti gli eventi.
 */
export async function patchEventData(eventId: string, patch: Record<string, any>): Promise<void> {
  const { data, error } = await supabase.from('events').select('data').eq('id', eventId).single();
  if (error) throw error;
  const merged = { ...(data?.data ?? {}), ...patch };
  const { error: updateError } = await supabase.from('events').update({ data: merged }).eq('id', eventId);
  if (updateError) throw updateError;
}

export async function loadEvents(): Promise<CalendarEvent[]> {
  const orgId = getCurrentOrgId();
  const { data, error } = await supabase.from('events').select('*').eq('org_id', orgId);
  if (error) throw error;
  return (data ?? []).map(rowToEvent);
}

/**
 * Sostituisce l'intero elenco eventi con quello passato: aggiorna/crea le
 * righe presenti (upsert per id) e cancella quelle che non ci sono più —
 * stesso comportamento di "riscrivi tutto" che aveva AsyncStorage, ma senza
 * perdere/duplicare righe quando due dispositivi salvano in momenti diversi.
 */
export async function saveEvents(events: CalendarEvent[]): Promise<void> {
  const orgId = getCurrentOrgId();

  if (events.length > 0) {
    const rows = events.map((ev) => eventToRow(ev, orgId));
    const { error } = await supabase.from('events').upsert(rows, { onConflict: 'id' });
    if (error) throw error;
  }

  const keepIds = events.map((e) => e.id);
  let deleteQuery = supabase.from('events').delete().eq('org_id', orgId);
  if (keepIds.length > 0) {
    deleteQuery = deleteQuery.not('id', 'in', `(${keepIds.join(',')})`);
  }
  const { error: deleteError } = await deleteQuery;
  if (deleteError) throw deleteError;
}
