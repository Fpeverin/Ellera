// app/data/playerMedia.ts
//
// Foto profilo, allegati e "tipologia infortunio" per striscia — si
// applicano a QUALSIASI giocatore (anche quelli statici scritti nel codice
// in app/data/players.ts), per questo sono tenuti in tabelle separate da
// "players" invece che come colonne (i giocatori statici non hanno una riga
// in "players").
import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';
import { getCurrentOrgId } from '../lib/currentOrg';
import { supabase } from '../lib/supabase';

const PHOTOS_BUCKET = 'player-photos';
const ATTACHMENTS_BUCKET = 'player-attachments';

function extensionFromUri(uri: string): string {
  const match = uri.match(/\.([a-zA-Z0-9]+)(\?.*)?$/);
  return match ? match[1].toLowerCase() : 'jpg';
}

function publicUrlFor(bucket: string, path: string): string {
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

async function uploadFile(bucket: string, path: string, localUri: string, contentType: string): Promise<string> {
  const base64 = await FileSystem.readAsStringAsync(localUri, { encoding: FileSystem.EncodingType.Base64 });
  const arrayBuffer = decode(base64);
  const { error } = await supabase.storage.from(bucket).upload(path, arrayBuffer, { contentType, upsert: true });
  if (error) throw error;
  return publicUrlFor(bucket, path);
}

/* --------------------------------- Foto profilo --------------------------------- */

export async function loadPhotoMap(): Promise<Record<string, string | null>> {
  const orgId = getCurrentOrgId();
  const { data, error } = await supabase
    .from('player_photos')
    .select('player_id, photo_path')
    .eq('org_id', orgId);
  if (error) throw error;

  const map: Record<string, string | null> = {};
  for (const row of data ?? []) {
    map[row.player_id] = publicUrlFor(PHOTOS_BUCKET, row.photo_path);
  }
  return map;
}

export async function uploadPlayerPhoto(playerId: string, localUri: string): Promise<string> {
  const orgId = getCurrentOrgId();
  const ext = extensionFromUri(localUri);
  const path = `${orgId}/${playerId}.${ext}`;
  const publicUrl = await uploadFile(PHOTOS_BUCKET, path, localUri, `image/${ext === 'jpg' ? 'jpeg' : ext}`);

  const { error } = await supabase
    .from('player_photos')
    .upsert({ org_id: orgId, player_id: playerId, photo_path: path });
  if (error) throw error;

  return publicUrl;
}

/* ---------------------------------- Allegati ------------------------------------ */

export type PlayerAttachment = { id: string; name: string; uri: string; storagePath: string };

export async function loadAttachments(playerId: string): Promise<PlayerAttachment[]> {
  const orgId = getCurrentOrgId();
  const { data, error } = await supabase
    .from('player_attachments')
    .select('id, name, storage_path')
    .eq('org_id', orgId)
    .eq('player_id', playerId)
    .order('created_at');
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    storagePath: row.storage_path,
    uri: publicUrlFor(ATTACHMENTS_BUCKET, row.storage_path),
  }));
}

export async function addAttachment(playerId: string, localUri: string, name: string): Promise<PlayerAttachment> {
  const orgId = getCurrentOrgId();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const ext = extensionFromUri(localUri);
  const path = `${orgId}/${playerId}/${id}.${ext}`;
  const publicUrl = await uploadFile(ATTACHMENTS_BUCKET, path, localUri, 'application/octet-stream');

  const { error } = await supabase
    .from('player_attachments')
    .insert({ id, org_id: orgId, player_id: playerId, name, storage_path: path });
  if (error) throw error;

  return { id, name, uri: publicUrl, storagePath: path };
}

export async function removeAttachment(attachment: Pick<PlayerAttachment, 'id' | 'storagePath'>): Promise<void> {
  const { error: storageError } = await supabase.storage.from(ATTACHMENTS_BUCKET).remove([attachment.storagePath]);
  if (storageError) throw storageError;

  const { error } = await supabase.from('player_attachments').delete().eq('id', attachment.id);
  if (error) throw error;
}

/* ------------------------- Tipologia infortunio per striscia --------------------- */

export async function loadInjuryTypes(playerId: string): Promise<Record<string, { type: string }>> {
  const orgId = getCurrentOrgId();
  const { data, error } = await supabase
    .from('player_injury_types')
    .select('injury_key, type')
    .eq('org_id', orgId)
    .eq('player_id', playerId);
  if (error) throw error;

  const map: Record<string, { type: string }> = {};
  for (const row of data ?? []) map[row.injury_key] = { type: row.type };
  return map;
}

export async function setInjuryType(playerId: string, injuryKey: string, type: string): Promise<void> {
  const orgId = getCurrentOrgId();
  const { error } = await supabase
    .from('player_injury_types')
    .upsert({ org_id: orgId, player_id: playerId, injury_key: injuryKey, type });
  if (error) throw error;
}
