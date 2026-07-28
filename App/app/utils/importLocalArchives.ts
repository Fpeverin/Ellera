// app/utils/importLocalArchives.ts
//
// Tool di importazione una tantum: prima di Supabase, l'Archivio Stagioni
// viveva in locale (AsyncStorage) con le chiavi "seasons/archive/index"
// (elenco id) e "seasons/archive/{id}" (snapshot stagione) — stessa forma
// usata oggi nella colonna "data" di season_archives, nessuna trasformazione
// necessaria. Se questo dispositivo ha ancora quei dati e la squadra su
// Supabase non ha ancora nessun archivio, propone di caricarli.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SeasonArchive } from '../data/archive';
import { getCurrentOrgId } from '../lib/currentOrg';
import { supabase } from '../lib/supabase';

const ARCHIVE_INDEX_KEY = 'seasons/archive/index';
const archiveKey = (id: string) => `seasons/archive/${id}`;
const DECIDED_KEY = 'migration/archives/decided';

export async function checkLocalArchiveImportNeeded(): Promise<SeasonArchive[] | null> {
  const alreadyDecided = await AsyncStorage.getItem(DECIDED_KEY);
  if (alreadyDecided) return null;

  const indexRaw = await AsyncStorage.getItem(ARCHIVE_INDEX_KEY);
  const ids: string[] = indexRaw ? JSON.parse(indexRaw) : [];
  if (ids.length === 0) return null;

  const localArchives = (
    await Promise.all(
      ids.map(async (id) => {
        const raw = await AsyncStorage.getItem(archiveKey(id));
        return raw ? (JSON.parse(raw) as SeasonArchive) : null;
      })
    )
  ).filter(Boolean) as SeasonArchive[];

  if (localArchives.length === 0) return null;

  const orgId = getCurrentOrgId();
  const { count, error } = await supabase
    .from('season_archives')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId);

  if (error) return null; // in dubbio, non disturbare con un prompt

  if ((count ?? 0) > 0) {
    // la squadra ha gia' archivi: non proporre mai l'import
    await AsyncStorage.setItem(DECIDED_KEY, '1');
    return null;
  }

  return localArchives;
}

export async function importLocalArchives(archives: SeasonArchive[]): Promise<void> {
  const orgId = getCurrentOrgId();
  const rows = archives.map((a) => ({
    id: a.id,
    org_id: orgId,
    label: a.label,
    archived_at: a.archivedAt,
    data: a,
  }));
  const { error } = await supabase.from('season_archives').upsert(rows);
  if (error) throw error;
  await AsyncStorage.setItem(DECIDED_KEY, '1');
}

export async function skipLocalArchiveImport(): Promise<void> {
  await AsyncStorage.setItem(DECIDED_KEY, '1');
}
