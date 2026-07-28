// app/data/rosterFile.ts
//
// Export/import della rosa in formato XLSX, lavorando "per differenze":
// i nomi nuovi vengono aggiunti, quelli gia' in rosa vengono aggiornati
// (match per nome, case-insensitive). I giocatori attivi assenti dal file
// vengono solo segnalati (planRosterImport), mai toccati automaticamente —
// la decisione finale spetta all'utente (vedi RosterImportReviewModal).
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';
import { getCurrentOrgId } from '../lib/currentOrg';
import { supabase } from '../lib/supabase';
import { Player, Role } from './players';

const ROLE_LABELS: Record<Role, string> = {
  PORTIERE: 'Portiere',
  DIFENSORE: 'Difensore',
  CENTROCAMPISTA: 'Centrocampista',
  ATTACCANTE: 'Attaccante',
};
const LABEL_TO_ROLE: Record<string, Role> = Object.fromEntries(
  Object.entries(ROLE_LABELS).map(([role, label]) => [label.toLowerCase(), role as Role])
);

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export async function exportRosterToXlsx(active: Player[], ex: Player[]): Promise<void> {
  const rows = [
    ...active.map((p) => ({
      Nome: p.name,
      Ruolo: ROLE_LABELS[p.role],
      Anno: p.year,
      Altezza: p.height,
      Peso: p.weight,
      Stato: 'Attivo',
    })),
    ...ex.map((p) => ({
      Nome: p.name,
      Ruolo: ROLE_LABELS[p.role],
      Anno: p.year,
      Altezza: p.height,
      Peso: p.weight,
      Stato: 'Ex',
    })),
  ];

  const sheet = XLSX.utils.json_to_sheet(rows);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Rosa');
  const base64 = XLSX.write(book, { type: 'base64', bookType: 'xlsx' });

  const fileUri = FileSystem.cacheDirectory + 'rosa.xlsx';
  await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 });
  await Sharing.shareAsync(fileUri, { mimeType: XLSX_MIME, dialogTitle: 'Esporta rosa' });
}

export type RosterFileRow = {
  name: string;
  role: Role;
  year: number;
  height: string;
  weight: string;
  isEx: boolean;
};

/** Apre il selettore file e legge un XLSX di rosa. Ritorna null se l'utente annulla. */
export async function pickAndParseRosterXlsx(): Promise<RosterFileRow[] | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: [XLSX_MIME, 'application/vnd.ms-excel'],
    copyToCacheDirectory: true,
  });
  if (res.canceled || !res.assets?.length) return null;

  const base64 = await FileSystem.readAsStringAsync(res.assets[0].uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const book = XLSX.read(base64, { type: 'base64' });
  const sheet = book.Sheets[book.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<any>(sheet);

  return raw
    .map((row): RosterFileRow => {
      const roleLabel = String(row.Ruolo ?? '').trim().toLowerCase();
      const statoLabel = String(row.Stato ?? '').trim().toLowerCase();
      return {
        name: String(row.Nome ?? '').trim().toUpperCase(),
        role: LABEL_TO_ROLE[roleLabel] ?? 'CENTROCAMPISTA',
        year: Number(row.Anno) || new Date().getFullYear(),
        height: String(row.Altezza ?? '170'),
        weight: String(row.Peso ?? '60'),
        isEx: statoLabel === 'ex',
      };
    })
    .filter((r) => r.name.length > 0);
}

export type RosterImportPlan = {
  toInsert: RosterFileRow[];
  toUpdate: { id: string; row: RosterFileRow }[];
  /** Giocatori attivi non presenti nel file — l'utente decide cosa farne. */
  missingActivePlayers: Player[];
};

export function planRosterImport(fileRows: RosterFileRow[], active: Player[], ex: Player[]): RosterImportPlan {
  const key = (name: string) => name.trim().toUpperCase();
  const activeByName = new Map(active.map((p) => [key(p.name), p]));
  const exByName = new Map(ex.map((p) => [key(p.name), p]));
  const seenNames = new Set<string>();

  const toInsert: RosterFileRow[] = [];
  const toUpdate: RosterImportPlan['toUpdate'] = [];

  for (const row of fileRows) {
    seenNames.add(row.name);
    const existing = activeByName.get(row.name) ?? exByName.get(row.name);
    if (!existing) {
      toInsert.push(row);
      continue;
    }
    const wasEx = exByName.has(row.name);
    const changed =
      existing.role !== row.role ||
      existing.year !== row.year ||
      existing.height !== row.height ||
      existing.weight !== row.weight ||
      wasEx !== row.isEx;
    if (changed) toUpdate.push({ id: existing.id, row });
  }

  const missingActivePlayers = active.filter((p) => !seenNames.has(key(p.name)));

  return { toInsert, toUpdate, missingActivePlayers };
}

/**
 * Applica il piano: inserisce i nuovi, aggiorna gli esistenti, e sposta tra
 * gli ex solo gli id esplicitamente confermati dall'utente (moveToExIds).
 */
export async function applyRosterImport(plan: RosterImportPlan, moveToExIds: string[]): Promise<void> {
  const orgId = getCurrentOrgId();

  for (const row of plan.toInsert) {
    const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const { error } = await supabase.from('players').insert({
      id,
      org_id: orgId,
      name: row.name,
      role: row.role,
      year: row.year,
      height: row.height,
      weight: row.weight,
      is_ex: row.isEx,
    });
    if (error) throw error;
  }

  for (const item of plan.toUpdate) {
    const { error } = await supabase
      .from('players')
      .update({
        role: item.row.role,
        year: item.row.year,
        height: item.row.height,
        weight: item.row.weight,
        is_ex: item.row.isEx,
      })
      .eq('id', item.id);
    if (error) throw error;
  }

  if (moveToExIds.length > 0) {
    const { error } = await supabase.from('players').update({ is_ex: true }).in('id', moveToExIds);
    if (error) throw error;
  }
}
