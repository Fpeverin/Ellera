// app/data/calendarFile.ts
//
// Export/import XLSX del calendario: partite divise per competizione (file
// separato per allenamenti). Su una partita/allenamento gia' esistente
// l'import aggiorna SOLO i campi di calendario (data/ora/luogo/avversario/
// tema) — mai punteggio/formazione/cartellini/eventi live gia' registrati.
//
// Identita' usata per riconoscere "la stessa partita" tra file e calendario
// attuale: avversario + casa/trasferta, all'interno della stessa competizione
// (l'avversario di solito non cambia, mentre data/ora/luogo sono proprio i
// campi che tipicamente vengono corretti/riprogrammati). Per gli allenamenti:
// data + ora.
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';
import { CalendarEvent, loadEvents, saveEvents } from './events';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

async function writeAndShare(fileName: string, rows: Record<string, any>[], sheetName: string): Promise<void> {
  const sheet = XLSX.utils.json_to_sheet(rows);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, sheetName);
  const base64 = XLSX.write(book, { type: 'base64', bookType: 'xlsx' });
  const fileUri = FileSystem.cacheDirectory + fileName;
  await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 });
  await Sharing.shareAsync(fileUri, { mimeType: XLSX_MIME, dialogTitle: fileName });
}

async function pickAndReadXlsx(): Promise<any[] | null> {
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
  return XLSX.utils.sheet_to_json<any>(sheet);
}

/* --------------------------------- Partite -------------------------------- */

export async function exportMatchesToXlsx(competition: string, matches: CalendarEvent[]): Promise<void> {
  const rows = matches.map((ev) => ({
    Avversario: ev.opponent ?? '',
    Data: ev.date,
    Ora: ev.time,
    'Casa/Trasferta': (ev as any).homeAway ?? 'CASA',
    Luogo: ev.location ?? '',
    Competizione: competition,
  }));
  await writeAndShare(`partite-${competition || 'senza-competizione'}.xlsx`, rows, 'Partite');
}

export type MatchFileRow = {
  opponent: string;
  date: string;
  time: string;
  homeAway: 'CASA' | 'TRASFERTA';
  location: string;
};

export async function pickAndParseMatchesXlsx(): Promise<MatchFileRow[] | null> {
  const raw = await pickAndReadXlsx();
  if (!raw) return null;
  return raw
    .map((row): MatchFileRow => ({
      opponent: String(row.Avversario ?? '').trim(),
      date: String(row.Data ?? '').trim(),
      time: String(row.Ora ?? '').trim(),
      homeAway: String(row['Casa/Trasferta'] ?? '').trim().toUpperCase() === 'TRASFERTA' ? 'TRASFERTA' : 'CASA',
      location: String(row.Luogo ?? '').trim(),
    }))
    .filter((r) => r.opponent.length > 0 && r.date.length > 0);
}

export type MatchesImportPlan = {
  toInsertCount: number;
  toUpdateCount: number;
  apply: () => Promise<void>;
};

export function planMatchesImport(
  rows: MatchFileRow[],
  allEvents: CalendarEvent[],
  competition: string
): MatchesImportPlan {
  const key = (opponent: string, homeAway: string) => `${opponent.trim().toUpperCase()}|${homeAway}`;
  const existingByKey = new Map(
    allEvents
      .filter((ev) => ev.type === 'PARTITA' && ((ev as any).competition || '') === competition)
      .map((ev) => [key(ev.opponent || '', (ev as any).homeAway || 'CASA'), ev])
  );

  const toInsert: CalendarEvent[] = [];
  const patchById = new Map<string, Partial<CalendarEvent>>();

  for (const row of rows) {
    const existing = existingByKey.get(key(row.opponent, row.homeAway));
    if (existing) {
      patchById.set(existing.id, { date: row.date, time: row.time, location: row.location, homeAway: row.homeAway } as any);
    } else {
      toInsert.push({
        id: `${Date.now()}-${row.date}-${row.time}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'PARTITA',
        date: row.date,
        time: row.time,
        location: row.location,
        opponent: row.opponent,
        competition,
        homeAway: row.homeAway,
        formationSlots: undefined,
        benchIds: [],
        tacticsIds: [],
      } as any);
    }
  }

  return {
    toInsertCount: toInsert.length,
    toUpdateCount: patchById.size,
    apply: async () => {
      const all = await loadEvents();
      const updated = all.map((ev) => (patchById.has(ev.id) ? { ...ev, ...patchById.get(ev.id) } : ev));
      await saveEvents([...updated, ...toInsert]);
    },
  };
}

/* -------------------------------- Allenamenti ------------------------------ */

export async function exportTrainingsToXlsx(trainings: CalendarEvent[]): Promise<void> {
  const rows = trainings.map((ev) => ({
    Data: ev.date,
    Ora: ev.time,
    Luogo: ev.location ?? '',
    Tema: ev.temaAllenamento ?? '',
  }));
  await writeAndShare('allenamenti.xlsx', rows, 'Allenamenti');
}

export type TrainingFileRow = { date: string; time: string; location: string; tema: string };

export async function pickAndParseTrainingsXlsx(): Promise<TrainingFileRow[] | null> {
  const raw = await pickAndReadXlsx();
  if (!raw) return null;
  return raw
    .map((row): TrainingFileRow => ({
      date: String(row.Data ?? '').trim(),
      time: String(row.Ora ?? '').trim(),
      location: String(row.Luogo ?? '').trim(),
      tema: String(row.Tema ?? '').trim(),
    }))
    .filter((r) => r.date.length > 0);
}

export type TrainingsImportPlan = {
  toInsertCount: number;
  toUpdateCount: number;
  apply: () => Promise<void>;
};

export function planTrainingsImport(rows: TrainingFileRow[], allEvents: CalendarEvent[]): TrainingsImportPlan {
  const key = (date: string, time: string) => `${date}|${time}`;
  const existingByKey = new Map(
    allEvents.filter((ev) => ev.type === 'ALLENAMENTO').map((ev) => [key(ev.date, ev.time), ev])
  );

  const toInsert: CalendarEvent[] = [];
  const patchById = new Map<string, Partial<CalendarEvent>>();

  for (const row of rows) {
    const existing = existingByKey.get(key(row.date, row.time));
    if (existing) {
      patchById.set(existing.id, { location: row.location, temaAllenamento: row.tema || undefined });
    } else {
      toInsert.push({
        id: `${Date.now()}-${row.date}-${row.time}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'ALLENAMENTO',
        date: row.date,
        time: row.time,
        location: row.location,
        temaAllenamento: row.tema || undefined,
        presenze: {},
        formationSlots: undefined,
        benchIds: [],
        tacticsIds: [],
      });
    }
  }

  return {
    toInsertCount: toInsert.length,
    toUpdateCount: patchById.size,
    apply: async () => {
      const all = await loadEvents();
      const updated = all.map((ev) => (patchById.has(ev.id) ? { ...ev, ...patchById.get(ev.id) } : ev));
      await saveEvents([...updated, ...toInsert]);
    },
  };
}
