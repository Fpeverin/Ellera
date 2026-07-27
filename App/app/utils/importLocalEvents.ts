// app/utils/importLocalEvents.ts
//
// Tool di importazione una tantum: se questo dispositivo ha ancora eventi
// salvati con il vecchio sistema locale (AsyncStorage, pre-Supabase) e la
// squadra su Supabase non ha ancora nessun evento, propone di caricarli.
// Se la squadra ha gia' eventi (es. gia' importati da un altro dispositivo),
// non chiede mai nulla: evita che un device con dati vecchi/di test possa
// sovrascrivere quelli buoni.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CalendarEvent, LEGACY_STORAGE_KEY, saveEvents } from '../data/events';
import { getCurrentOrgId } from '../lib/currentOrg';
import { supabase } from '../lib/supabase';

const DECIDED_KEY = 'migration/events/decided';

export async function checkLocalImportNeeded(): Promise<CalendarEvent[] | null> {
  const alreadyDecided = await AsyncStorage.getItem(DECIDED_KEY);
  if (alreadyDecided) return null;

  const raw = await AsyncStorage.getItem(LEGACY_STORAGE_KEY);
  const localEvents: CalendarEvent[] = raw ? JSON.parse(raw) : [];
  if (localEvents.length === 0) return null;

  const orgId = getCurrentOrgId();
  const { count, error } = await supabase
    .from('events')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId);

  if (error) return null; // in dubbio, non disturbare con un prompt

  if ((count ?? 0) > 0) {
    // la squadra ha gia' dati: non proporre mai l'import
    await AsyncStorage.setItem(DECIDED_KEY, '1');
    return null;
  }

  return localEvents;
}

export async function importLocalEvents(events: CalendarEvent[]): Promise<void> {
  await saveEvents(events);
  await AsyncStorage.setItem(DECIDED_KEY, '1');
}

export async function skipLocalImport(): Promise<void> {
  await AsyncStorage.setItem(DECIDED_KEY, '1');
}
