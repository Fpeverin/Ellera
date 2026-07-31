// app/data/organization.ts
//
// Logo generale della squadra (uno per organizzazione), usato nell'header
// dell'app e nel PDF di Convocazione. Stesso pattern di upload di
// app/data/playerMedia.ts.
import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';
import { getCurrentOrgId } from '../lib/currentOrg';
import { supabase } from '../lib/supabase';

const LOGOS_BUCKET = 'team-logos';

function extensionFromUri(uri: string): string {
  const match = uri.match(/\.([a-zA-Z0-9]+)(\?.*)?$/);
  return match ? match[1].toLowerCase() : 'jpg';
}

function publicUrlFor(path: string): string {
  return supabase.storage.from(LOGOS_BUCKET).getPublicUrl(path).data.publicUrl;
}

async function uploadLogo(path: string, localUri: string, contentType: string): Promise<string> {
  const base64 = await FileSystem.readAsStringAsync(localUri, { encoding: FileSystem.EncodingType.Base64 });
  const arrayBuffer = decode(base64);
  const { error } = await supabase.storage.from(LOGOS_BUCKET).upload(path, arrayBuffer, { contentType, upsert: true });
  if (error) throw error;
  return publicUrlFor(path);
}

export async function loadOrgLogoUrl(): Promise<string | null> {
  const orgId = getCurrentOrgId();
  const { data, error } = await supabase.from('organizations').select('logo_path').eq('id', orgId).maybeSingle();
  if (error) throw error;
  return data?.logo_path ? publicUrlFor(data.logo_path) : null;
}

export async function uploadOrgLogo(localUri: string): Promise<string> {
  const orgId = getCurrentOrgId();
  const ext = extensionFromUri(localUri);
  const path = `${orgId}/team.${ext}`;
  const publicUrl = await uploadLogo(path, localUri, `image/${ext === 'jpg' ? 'jpeg' : ext}`);

  const { error } = await supabase.from('organizations').update({ logo_path: path }).eq('id', orgId);
  if (error) throw error;

  return publicUrl;
}

export async function uploadOpponentLogo(eventId: string, localUri: string): Promise<{ path: string; url: string }> {
  const orgId = getCurrentOrgId();
  const ext = extensionFromUri(localUri);
  const path = `${orgId}/opponent-${eventId}.${ext}`;
  const url = await uploadLogo(path, localUri, `image/${ext === 'jpg' ? 'jpeg' : ext}`);
  return { path, url };
}

export function opponentLogoUrlFromPath(path: string): string {
  return publicUrlFor(path);
}

/* ------------------------- Configurazioni squadra -------------------------- */

export async function loadStaffRoleOptions(): Promise<string[]> {
  const orgId = getCurrentOrgId();
  const { data, error } = await supabase.from('organizations').select('staff_roles').eq('id', orgId).maybeSingle();
  if (error) throw error;
  return (data?.staff_roles as string[] | null) ?? [];
}

export async function saveStaffRoleOptions(roles: string[]): Promise<void> {
  const orgId = getCurrentOrgId();
  const { error } = await supabase.from('organizations').update({ staff_roles: roles }).eq('id', orgId);
  if (error) throw error;
}

/** Mostra/nasconde il registro presenze quando si apre un allenamento dal calendario (data/ora/luogo/tema restano sempre visibili). */
export async function loadShowTrainingAttendance(): Promise<boolean> {
  const orgId = getCurrentOrgId();
  const { data, error } = await supabase.from('organizations').select('show_training_attendance').eq('id', orgId).maybeSingle();
  if (error) throw error;
  return data?.show_training_attendance ?? true;
}

export async function saveShowTrainingAttendance(value: boolean): Promise<void> {
  const orgId = getCurrentOrgId();
  const { error } = await supabase.from('organizations').update({ show_training_attendance: value }).eq('id', orgId);
  if (error) throw error;
}
