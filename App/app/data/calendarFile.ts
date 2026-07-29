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

async function writeTemplateAndShare(
  fileName: string,
  dialogTitle: string,
  dataRows: Record<string, any>[],
  dataSheetName: string,
  istruzioni: { Colonna: string; Descrizione: string }[]
): Promise<void> {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(dataRows), dataSheetName);
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(istruzioni), 'Istruzioni');
  const base64 = XLSX.write(book, { type: 'base64', bookType: 'xlsx' });
  const fileUri = FileSystem.cacheDirectory + fileName;
  await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 });
  await Sharing.shareAsync(fileUri, { mimeType: XLSX_MIME, dialogTitle });
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

export async function exportMatchesToXlsx(label: string, matches: CalendarEvent[]): Promise<void> {
  const rows = matches.map((ev) => ({
    Avversario: ev.opponent ?? '',
    Data: ev.date,
    Ora: ev.time,
    'Casa/Trasferta': (ev as any).homeAway ?? 'CASA',
    Luogo: ev.location ?? '',
    Competizione: (ev as any).competition ?? '',
  }));
  await writeAndShare(`partite-${label || 'tutte'}.xlsx`, rows, 'Partite');
}

/** Genera e condivide un file XLSX di esempio con le colonne attese dall'import delle partite. */
export async function downloadMatchesTemplate(): Promise<void> {
  const rows = [
    {
      Avversario: 'VIRTUS SPOLETO',
      Data: '2026-09-14',
      Ora: '15:30',
      'Casa/Trasferta': 'CASA',
      Luogo: 'Campo Sportivo Ellera',
      Competizione: 'Eccellenza Umbra',
    },
    {
      Avversario: 'BASTIA UMBRA',
      Data: '2026-09-21',
      Ora: '15:30',
      'Casa/Trasferta': 'TRASFERTA',
      Luogo: 'Campo Sportivo Bastia',
      Competizione: 'Eccellenza Umbra',
    },
  ];
  const istruzioni = [
    { Colonna: 'Avversario', Descrizione: 'Nome della squadra avversaria' },
    { Colonna: 'Data', Descrizione: 'Formato AAAA-MM-GG, es. 2026-09-14' },
    { Colonna: 'Ora', Descrizione: 'Formato HH:MM, es. 15:30' },
    { Colonna: 'Casa/Trasferta', Descrizione: 'CASA oppure TRASFERTA' },
    { Colonna: 'Luogo', Descrizione: 'Nome/indirizzo del campo' },
    {
      Colonna: 'Competizione',
      Descrizione: 'Nome del campionato/torneo di quella partita (es. "Eccellenza Umbra")',
    },
  ];
  await writeTemplateAndShare('modello-partite.xlsx', 'Modello Partite', rows, 'Partite', istruzioni);
}

export type MatchFileRow = {
  opponent: string;
  date: string;
  time: string;
  homeAway: 'CASA' | 'TRASFERTA';
  location: string;
  competition: string;
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
      competition: String(row.Competizione ?? '').trim(),
    }))
    .filter((r) => r.opponent.length > 0 && r.date.length > 0);
}

export type MatchesImportPlan = {
  toInsertCount: number;
  toUpdateCount: number;
  apply: () => Promise<void>;
};

/**
 * L'identità "stessa partita" usa la competizione scritta su ogni riga del file
 * (colonna "Competizione"), non un filtro scelto nell'app — così l'import
 * funziona identico sia con una competizione specifica selezionata sia con
 * "Tutte", e un unico file può contenere partite di più competizioni insieme.
 */
export function planMatchesImport(rows: MatchFileRow[], allEvents: CalendarEvent[]): MatchesImportPlan {
  const key = (opponent: string, homeAway: string, competition: string) =>
    `${opponent.trim().toUpperCase()}|${homeAway}|${competition.trim().toUpperCase()}`;
  const existingByKey = new Map(
    allEvents
      .filter((ev) => ev.type === 'PARTITA')
      .map((ev) => [
        key(ev.opponent || '', (ev as any).homeAway || 'CASA', (ev as any).competition || ''),
        ev,
      ])
  );

  const toInsert: CalendarEvent[] = [];
  const patchById = new Map<string, Partial<CalendarEvent>>();

  for (const row of rows) {
    const existing = existingByKey.get(key(row.opponent, row.homeAway, row.competition));
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
        competition: row.competition,
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

/** Genera e condivide un file XLSX di esempio con le colonne attese dall'import degli allenamenti. */
export async function downloadTrainingsTemplate(): Promise<void> {
  const rows = [
    { Data: '2026-09-10', Ora: '18:30', Luogo: 'Campo Sportivo Ellera', Tema: 'Lavoro aerobico e possesso palla' },
    { Data: '2026-09-12', Ora: '18:30', Luogo: 'Campo Sportivo Ellera', Tema: 'Tattica: fase di non possesso' },
  ];
  const istruzioni = [
    { Colonna: 'Data', Descrizione: 'Formato AAAA-MM-GG, es. 2026-09-10' },
    { Colonna: 'Ora', Descrizione: 'Formato HH:MM, es. 18:30' },
    { Colonna: 'Luogo', Descrizione: 'Nome/indirizzo del campo' },
    { Colonna: 'Tema', Descrizione: "Testo libero, tema della seduta (facoltativo)" },
  ];
  await writeTemplateAndShare('modello-allenamenti.xlsx', 'Modello Allenamenti', rows, 'Allenamenti', istruzioni);
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
