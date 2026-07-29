// app/data/convocazione.ts
//
// Convocazione partita: chi tra giocatori/staff è convocato, il ritrovo e il
// menu pranzo. Vive nella colonna "convocazione" di match_live (stesso
// pattern di goals/subs/cards/lineup — vedi app/data/matchLive.ts), qui
// esposta con logica di più alto livello (valore di default, template dalla
// convocazione precedente, pruning di campo/panchina quando cambiano i
// convocati).
import { loadEvents } from './events';
import {
  ConvocazioneData,
  ConvocazioneMenuItem,
  loadConvocazione as loadConvocazioneRemote,
  loadLineup,
  saveConvocazione as saveConvocazioneRemote,
  saveLineup,
} from './matchLive';

export type { ConvocazioneData, ConvocazioneMenuItem };

const EMPTY_CONVOCAZIONE: ConvocazioneData = {
  ritrovo: '',
  playerIds: [],
  staffIds: [],
  menuItems: [],
  meals: {},
};

export async function loadConvocazione(eventId: string): Promise<ConvocazioneData> {
  const data = await loadConvocazioneRemote(eventId);
  return data ?? { ...EMPTY_CONVOCAZIONE };
}

export async function saveConvocazione(eventId: string, data: ConvocazioneData): Promise<void> {
  await saveConvocazioneRemote(eventId, data);
}

/**
 * Cerca, tra le partite passate (per data), la convocazione più recente con
 * un menu già impostato, da usare come base per una convocazione nuova —
 * su richiesta di Francesco i piatti disponibili e le scelte di ciascuno
 * devono ripartire da quelli dell'ultima volta, non da zero.
 */
export async function loadPreviousMenuTemplate(
  currentEventId: string
): Promise<{ menuItems: ConvocazioneMenuItem[]; meals: Record<string, string> } | null> {
  const events = await loadEvents();
  const current = events.find((e) => e.id === currentEventId);
  const currentDate = current?.date ?? '9999-99-99';

  const pastMatches = events
    .filter((e) => e.type === 'PARTITA' && e.id !== currentEventId && e.date < currentDate)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)); // più recente prima

  for (const ev of pastMatches) {
    const conv = await loadConvocazioneRemote(ev.id);
    if (conv && conv.menuItems && conv.menuItems.length > 0) {
      return { menuItems: conv.menuItems, meals: conv.meals ?? {} };
    }
  }
  return null;
}

/**
 * Setter condiviso per i soli giocatori convocati — usato sia dal tab
 * Convocazione sia dalla modifica rapida "ultimo secondo" in Live. Oltre a
 * salvare l'elenco, "pota" campo/panchina della formazione già impostata
 * togliendo ogni id non più convocato (stesso comportamento che aveva la
 * vecchia modale CONVOCATI dentro formazione.tsx).
 */
export async function saveConvocatiPlayerIds(eventId: string, playerIds: string[]): Promise<void> {
  const current = await loadConvocazione(eventId);
  await saveConvocazione(eventId, { ...current, playerIds });

  const lineup = await loadLineup(eventId);
  if (!lineup) return;

  const allowed = new Set(playerIds);
  const prunedField = (lineup.field ?? []).map((id) => (id && allowed.has(id) ? id : null));
  const prunedBench = (lineup.bench ?? []).filter((id) => allowed.has(id));

  const fieldChanged = JSON.stringify(prunedField) !== JSON.stringify(lineup.field ?? []);
  const benchChanged = JSON.stringify(prunedBench) !== JSON.stringify(lineup.bench ?? []);
  if (fieldChanged || benchChanged) {
    await saveLineup(eventId, { ...lineup, field: prunedField, bench: prunedBench });
  }
}
