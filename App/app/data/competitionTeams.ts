// app/data/competitionTeams.ts
//
// Squadre fisse di una competizione (nome + stadio + stemma), configurabili una volta e riusate
// per scegliere rapidamente l'avversario in "Crea Calendario Competizione" (precompilando anche
// Luogo e stemma avversario della partita creata) e le due squadre di un incontro in
// "Altre Partite" — chiave (org_id, competition), stesso principio di competitionRules.ts (le
// competizioni sono testo libero, non un'entità a parte).
//
// Lo stemma usa il bucket "team-logos" ESISTENTE (non uno nuovo): quando una squadra viene scelta
// dai chip, il suo logo_path diventa direttamente l'opponentLogoPath della partita (vedi
// CompetitionModal.tsx/PartiteTab.tsx/altrePartite.tsx), che altrove nell'app si risolve sempre
// con opponentLogoUrlFromPath() in app/data/organization.ts — quella funzione punta a
// "team-logos", quindi il path deve vivere nello stesso bucket o l'URL risulterebbe rotto.
import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';
import { getCurrentOrgId } from '../lib/currentOrg';
import { supabase } from '../lib/supabase';

const LOGOS_BUCKET = 'team-logos';

export type CompetitionTeam = { id: string; name: string; stadium: string; logoPath: string | null; logoUrl: string | null };

function publicUrlFor(path: string): string {
  return supabase.storage.from(LOGOS_BUCKET).getPublicUrl(path).data.publicUrl;
}

function extensionFromUri(uri: string): string {
  const match = uri.match(/\.([a-zA-Z0-9]+)(\?.*)?$/);
  return match ? match[1].toLowerCase() : 'jpg';
}

function fromRow(row: any): CompetitionTeam {
  return {
    id: row.id,
    name: row.name,
    stadium: row.stadium ?? '',
    logoPath: row.logo_path ?? null,
    logoUrl: row.logo_path ? publicUrlFor(row.logo_path) : null,
  };
}

export async function loadCompetitionTeams(competition: string): Promise<CompetitionTeam[]> {
  if (!competition) return [];
  const orgId = getCurrentOrgId();
  const { data, error } = await supabase
    .from('competition_teams')
    .select('*')
    .eq('org_id', orgId)
    .eq('competition', competition)
    .order('name');
  if (error) throw error;
  return (data ?? []).map(fromRow);
}

/** Tutte le squadre configurate dall'organizzazione, di qualunque competizione — usata come
 * fallback in findTeamLogoForOpponent quando una partita non ha (ancora) la stessa Competizione
 * con cui la squadra è stata censita. */
export async function loadAllCompetitionTeams(): Promise<CompetitionTeam[]> {
  const orgId = getCurrentOrgId();
  const { data, error } = await supabase
    .from('competition_teams')
    .select('*')
    .eq('org_id', orgId)
    .order('name');
  if (error) throw error;
  return (data ?? []).map(fromRow);
}

function namesMatch(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Trova lo stemma di una squadra configurata a partire dal nome avversario di una partita —
 * usata per il collegamento automatico (Convocazione/pagina scelta-partita). Prima cerca dentro la
 * stessa Competizione (match esatto sul nome, spazi e maiuscole/minuscole ignorati); se non trova
 * nulla lì (o la partita non ha Competizione impostata), cerca tra TUTTE le squadre configurate
 * dall'organizzazione — un nome ripetuto in competizioni diverse è raro, e senza questo fallback
 * un disallineamento tra il nome Competizione della partita e quello con cui è stata censita la
 * squadra impedirebbe il collegamento anche quando lo stemma esiste già. */
export async function findTeamLogoForOpponent(
  competition: string | undefined,
  opponentName: string
): Promise<CompetitionTeam | null> {
  const name = (opponentName || '').trim();
  if (!name) return null;
  if (competition) {
    const scoped = await loadCompetitionTeams(competition);
    const match = scoped.find((t) => namesMatch(t.name, name) && t.logoPath);
    if (match) return match;
  }
  const all = await loadAllCompetitionTeams();
  return all.find((t) => namesMatch(t.name, name) && t.logoPath) ?? null;
}

export async function addCompetitionTeam(competition: string, name: string, stadium: string): Promise<CompetitionTeam> {
  const orgId = getCurrentOrgId();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const { error } = await supabase
    .from('competition_teams')
    .insert({ id, org_id: orgId, competition, name, stadium: stadium || null });
  if (error) throw error;
  return { id, name, stadium, logoPath: null, logoUrl: null };
}

export async function updateCompetitionTeam(id: string, name: string, stadium: string): Promise<void> {
  const { error } = await supabase
    .from('competition_teams')
    .update({ name, stadium: stadium || null })
    .eq('id', id);
  if (error) throw error;
}

export async function removeCompetitionTeam(id: string): Promise<void> {
  const { error } = await supabase.from('competition_teams').delete().eq('id', id);
  if (error) throw error;
}

export async function uploadCompetitionTeamLogo(teamId: string, localUri: string): Promise<{ path: string; url: string }> {
  const orgId = getCurrentOrgId();
  const ext = extensionFromUri(localUri);
  const path = `${orgId}/competition-team-${teamId}.${ext}`;

  const base64 = await FileSystem.readAsStringAsync(localUri, { encoding: FileSystem.EncodingType.Base64 });
  const arrayBuffer = decode(base64);
  const { error: uploadError } = await supabase.storage
    .from(LOGOS_BUCKET)
    .upload(path, arrayBuffer, { contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`, upsert: true });
  if (uploadError) throw uploadError;

  const { error } = await supabase.from('competition_teams').update({ logo_path: path }).eq('id', teamId);
  if (error) throw error;

  return { path, url: publicUrlFor(path) };
}
