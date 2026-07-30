// app/data/convocazione.ts
//
// Convocazione partita: chi tra giocatori/staff è convocato e il ritrovo.
// Vive nella colonna "convocazione" di match_live (stesso pattern di
// goals/subs/cards/lineup — vedi app/data/matchLive.ts), qui esposta con
// logica di più alto livello (valore di default, pruning di campo/panchina
// quando cambiano i convocati). Il menu pranzo (menuItems/meals nel tipo
// ConvocazioneData) è temporaneamente fuori dalla UI — vedi TO DO in
// PIANO_LAVORO.md — ma i campi restano nel tipo/colonna per non richiedere
// una migrazione quando tornerà.
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
