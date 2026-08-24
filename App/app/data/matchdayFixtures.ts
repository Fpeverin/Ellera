// app/data/matchdayFixtures.ts
//
// "Altre Partite": incontri (testo libero) delle altre squadre della stessa giornata di una
// competizione. Chiave (org_id, competition, giornata) — non un id-partita, stesso principio di
// competitionRules.ts — così un incontro inserito da una qualsiasi delle nostre partite di quella
// giornata compare automaticamente anche dalle altre.
import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';
import { getCurrentOrgId } from '../lib/currentOrg';
import { supabase } from '../lib/supabase';

const ATTACHMENTS_BUCKET = 'matchday-attachments';

export type MatchdayFixture = {
  id: string;
  competition: string;
  giornata: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  scorers: string;
};

function fromRow(row: any): MatchdayFixture {
  return {
    id: row.id,
    competition: row.competition,
    giornata: row.giornata,
    homeTeam: row.home_team,
    awayTeam: row.away_team,
    homeScore: row.home_score,
    awayScore: row.away_score,
    scorers: row.scorers ?? '',
  };
}

export async function loadFixtures(competition: string, giornata: string): Promise<MatchdayFixture[]> {
  const orgId = getCurrentOrgId();
  const { data, error } = await supabase
    .from('matchday_fixtures')
    .select('*')
    .eq('org_id', orgId)
    .eq('competition', competition)
    .eq('giornata', giornata)
    .order('created_at');
  if (error) throw error;
  return (data ?? []).map(fromRow);
}

export type FixtureInput = {
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  scorers: string;
};

export async function addFixture(
  competition: string,
  giornata: string,
  input: FixtureInput
): Promise<MatchdayFixture> {
  const orgId = getCurrentOrgId();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const { error } = await supabase.from('matchday_fixtures').insert({
    id,
    org_id: orgId,
    competition,
    giornata,
    home_team: input.homeTeam,
    away_team: input.awayTeam,
    home_score: input.homeScore,
    away_score: input.awayScore,
    scorers: input.scorers,
  });
  if (error) throw error;
  return { id, competition, giornata, ...input };
}

export async function updateFixture(id: string, input: FixtureInput): Promise<void> {
  const { error } = await supabase
    .from('matchday_fixtures')
    .update({
      home_team: input.homeTeam,
      away_team: input.awayTeam,
      home_score: input.homeScore,
      away_score: input.awayScore,
      scorers: input.scorers,
    })
    .eq('id', id);
  if (error) throw error;
}

export async function removeFixture(id: string): Promise<void> {
  const attachments = await loadFixtureAttachments(id);
  for (const att of attachments) {
    await removeFixtureAttachment(att);
  }
  const { error } = await supabase.from('matchday_fixtures').delete().eq('id', id);
  if (error) throw error;
}

/* ---------------------------------- Allegati ------------------------------------ */

export type FixtureAttachment = { id: string; name: string; uri: string; storagePath: string };

function publicUrlFor(path: string): string {
  return supabase.storage.from(ATTACHMENTS_BUCKET).getPublicUrl(path).data.publicUrl;
}

function extensionFromUri(uri: string): string {
  const match = uri.match(/\.([a-zA-Z0-9]+)(\?.*)?$/);
  return match ? match[1].toLowerCase() : 'jpg';
}

export async function loadFixtureAttachments(fixtureId: string): Promise<FixtureAttachment[]> {
  const { data, error } = await supabase
    .from('matchday_fixture_attachments')
    .select('id, name, storage_path')
    .eq('fixture_id', fixtureId)
    .order('created_at');
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    storagePath: row.storage_path,
    uri: publicUrlFor(row.storage_path),
  }));
}

export async function addFixtureAttachment(
  fixtureId: string,
  localUri: string,
  name: string
): Promise<FixtureAttachment> {
  const orgId = getCurrentOrgId();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const ext = extensionFromUri(localUri);
  const path = `${orgId}/${fixtureId}/${id}.${ext}`;

  const base64 = await FileSystem.readAsStringAsync(localUri, { encoding: FileSystem.EncodingType.Base64 });
  const arrayBuffer = decode(base64);
  const { error: uploadError } = await supabase.storage
    .from(ATTACHMENTS_BUCKET)
    .upload(path, arrayBuffer, { contentType: 'application/octet-stream', upsert: true });
  if (uploadError) throw uploadError;

  const { error } = await supabase
    .from('matchday_fixture_attachments')
    .insert({ id, org_id: orgId, fixture_id: fixtureId, name, storage_path: path });
  if (error) throw error;

  return { id, name, uri: publicUrlFor(path), storagePath: path };
}

export async function removeFixtureAttachment(
  attachment: Pick<FixtureAttachment, 'id' | 'storagePath'>
): Promise<void> {
  const { error: storageError } = await supabase.storage.from(ATTACHMENTS_BUCKET).remove([attachment.storagePath]);
  if (storageError) throw storageError;

  const { error } = await supabase.from('matchday_fixture_attachments').delete().eq('id', attachment.id);
  if (error) throw error;
}
