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

/** Attiva/disattiva l'intera sezione Sondaggi (nascosta a tutti, incluso Admin, se disattivata). */
export async function loadSurveysEnabled(): Promise<boolean> {
  const orgId = getCurrentOrgId();
  const { data, error } = await supabase.from('organizations').select('surveys_enabled').eq('id', orgId).maybeSingle();
  if (error) throw error;
  return data?.surveys_enabled ?? true;
}

export async function saveSurveysEnabled(value: boolean): Promise<void> {
  const orgId = getCurrentOrgId();
  const { error } = await supabase.from('organizations').update({ surveys_enabled: value }).eq('id', orgId);
  if (error) throw error;
}

/* ---------------- Permessi Staff: Importa/Esporta/Modello (e "Seleziona" in Rosa) ---------------- */

export type StaffExportArea = 'rosa' | 'partite' | 'allenamenti';
export type StaffExportPermissions = Record<StaffExportArea, boolean>;

const STAFF_EXPORT_COLUMNS: Record<StaffExportArea, string> = {
  rosa: 'staff_can_export_rosa',
  partite: 'staff_can_export_partite',
  allenamenti: 'staff_can_export_allenamenti',
};

/** Di default queste azioni sono solo Admin; se true per una sezione, le vede/usa anche lo Staff. */
export async function loadStaffExportPermissions(): Promise<StaffExportPermissions> {
  const orgId = getCurrentOrgId();
  const { data, error } = await supabase
    .from('organizations')
    .select(Object.values(STAFF_EXPORT_COLUMNS).join(', '))
    .eq('id', orgId)
    .maybeSingle();
  if (error) throw error;
  const row = (data ?? {}) as Record<string, boolean | null>;
  return {
    rosa: row[STAFF_EXPORT_COLUMNS.rosa] ?? false,
    partite: row[STAFF_EXPORT_COLUMNS.partite] ?? false,
    allenamenti: row[STAFF_EXPORT_COLUMNS.allenamenti] ?? false,
  };
}

export async function saveStaffExportPermission(area: StaffExportArea, value: boolean): Promise<void> {
  const orgId = getCurrentOrgId();
  const { error } = await supabase.from('organizations').update({ [STAFF_EXPORT_COLUMNS[area]]: value }).eq('id', orgId);
  if (error) throw error;
}

/* ---------------- Configurazione destinatari notifiche staff ---------------- */

export type NotifyMode = 'admin_only' | 'all' | 'selected';
export type NotifyConfig = { mode: NotifyMode; staffIds: string[] };
export type NotifyKind = 'live_proposals' | 'player_edit';

const NOTIFY_COLUMNS: Record<NotifyKind, { mode: string; ids: string }> = {
  live_proposals: { mode: 'notify_live_proposals_mode', ids: 'notify_live_proposals_staff_ids' },
  player_edit: { mode: 'notify_player_edit_mode', ids: 'notify_player_edit_staff_ids' },
};

/** Chi dello staff riceve la notifica per un certo tipo di evento (proposte Live / modifiche anagrafica). */
export async function loadNotifyConfig(kind: NotifyKind): Promise<NotifyConfig> {
  const orgId = getCurrentOrgId();
  const cols = NOTIFY_COLUMNS[kind];
  const { data, error } = await supabase.from('organizations').select(`${cols.mode}, ${cols.ids}`).eq('id', orgId).maybeSingle();
  if (error) throw error;
  return {
    mode: ((data as any)?.[cols.mode] as NotifyMode | undefined) ?? 'admin_only',
    staffIds: ((data as any)?.[cols.ids] as string[] | undefined) ?? [],
  };
}

export async function saveNotifyConfig(kind: NotifyKind, config: NotifyConfig): Promise<void> {
  const orgId = getCurrentOrgId();
  const cols = NOTIFY_COLUMNS[kind];
  const { error } = await supabase
    .from('organizations')
    .update({ [cols.mode]: config.mode, [cols.ids]: config.staffIds })
    .eq('id', orgId);
  if (error) throw error;
}
