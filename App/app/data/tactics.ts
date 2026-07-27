// app/data/tactics.ts
import { decode } from 'base64-arraybuffer';
import { getCurrentOrgId } from '../lib/currentOrg';
import { supabase } from '../lib/supabase';

const PREVIEWS_BUCKET = 'tactic-previews';

export type TacticElementType = 'HOME' | 'AWAY' | 'BALL';
export type TacticElement = { id: string; type: TacticElementType; x: number; y: number; number?: number };
export type TacticItem = { id: string; name: string; preview?: string; elements: TacticElement[] };

function publicUrlFor(path: string): string {
  return supabase.storage.from(PREVIEWS_BUCKET).getPublicUrl(path).data.publicUrl;
}

function rowToTactic(row: any): TacticItem {
  return {
    id: row.id,
    name: row.name,
    elements: row.elements,
    preview: row.preview_path ? publicUrlFor(row.preview_path) : undefined,
  };
}

export async function loadTactics(): Promise<TacticItem[]> {
  const orgId = getCurrentOrgId();
  const { data, error } = await supabase.from('tactics').select('*').eq('org_id', orgId).order('name');
  if (error) throw error;
  return (data ?? []).map(rowToTactic);
}

/**
 * Salva una tattica (crea o aggiorna per id). Se si passa `previewBase64`
 * (stringa base64 SENZA prefisso "data:...", come restituita da
 * react-native-view-shot) viene caricata su Storage e sostituisce la
 * preview esistente; se omessa, la preview esistente (se c'e') resta
 * invariata.
 */
export async function saveTactic(
  tactic: { id: string; name: string; elements: TacticElement[] },
  previewBase64?: string
): Promise<TacticItem> {
  const orgId = getCurrentOrgId();
  let previewPath: string | undefined;

  if (previewBase64) {
    previewPath = `${orgId}/${tactic.id}.png`;
    const arrayBuffer = decode(previewBase64);
    const { error: uploadError } = await supabase.storage
      .from(PREVIEWS_BUCKET)
      .upload(previewPath, arrayBuffer, { contentType: 'image/png', upsert: true });
    if (uploadError) throw uploadError;
  }

  const row: Record<string, any> = { id: tactic.id, org_id: orgId, name: tactic.name, elements: tactic.elements };
  if (previewPath) row.preview_path = previewPath;

  const { data, error } = await supabase.from('tactics').upsert(row).select().single();
  if (error) throw error;
  return rowToTactic(data);
}

export async function deleteTactic(id: string): Promise<void> {
  const { error } = await supabase.from('tactics').delete().eq('id', id);
  if (error) throw error;
}
