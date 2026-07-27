// app/data/modules.ts
import { getCurrentOrgId } from '../lib/currentOrg';
import { supabase } from '../lib/supabase';
import type { FieldSlot } from '../utils/modules-layout';

export type CustomModule = { name: string; slots: FieldSlot[] };

export async function loadModules(): Promise<CustomModule[]> {
  const orgId = getCurrentOrgId();
  const { data, error } = await supabase
    .from('modules')
    .select('name, slots')
    .eq('org_id', orgId)
    .order('name');
  if (error) throw error;
  return (data ?? []).map((row) => ({ name: row.name, slots: row.slots as FieldSlot[] }));
}

/** Upsert per nome: se esiste gia' un modulo con lo stesso nome, lo sovrascrive. */
export async function saveModule(mod: CustomModule): Promise<void> {
  const orgId = getCurrentOrgId();
  const { error } = await supabase
    .from('modules')
    .upsert({ org_id: orgId, name: mod.name, slots: mod.slots });
  if (error) throw error;
}

export async function deleteModule(name: string): Promise<void> {
  const orgId = getCurrentOrgId();
  const { error } = await supabase.from('modules').delete().eq('org_id', orgId).eq('name', name);
  if (error) throw error;
}
