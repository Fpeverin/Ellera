// app/data/staffRoster.ts
//
// Rosa Staff: persone (nome + categoria + ruolo) indipendenti dagli account
// app — stesso principio di app/data/players.ts per i giocatori. Usata dalla
// Convocazione per scegliere chi tra lo staff è convocato.
import { getCurrentOrgId } from '../lib/currentOrg';
import { supabase } from '../lib/supabase';

export type StaffCategory = 'TECNICO' | 'SANITARIO' | 'DIRIGENZIALE';

export type StaffMember = {
  id: string;
  name: string;
  category: StaffCategory;
  role: string | null;
  isEx: boolean;
};

export type NewStaffMemberInput = {
  name: string;
  category: StaffCategory;
  role?: string;
};

function rowToStaffMember(row: any): StaffMember {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    role: row.role ?? null,
    isEx: !!row.is_ex,
  };
}

export async function loadStaffMembers(): Promise<StaffMember[]> {
  const { data, error } = await supabase.from('staff_members').select('*').order('name');
  if (error) throw error;
  return (data ?? []).map(rowToStaffMember);
}

export async function addStaffMember(input: NewStaffMemberInput): Promise<StaffMember> {
  const orgId = getCurrentOrgId();
  const newMember: StaffMember = {
    id: `staff-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: input.name.trim(),
    category: input.category,
    role: input.role?.trim() || null,
    isEx: false,
  };
  const { error } = await supabase.from('staff_members').insert({
    id: newMember.id,
    org_id: orgId,
    name: newMember.name,
    category: newMember.category,
    role: newMember.role,
  });
  if (error) throw error;
  return newMember;
}

export async function updateStaffMember(
  id: string,
  changes: Partial<{ name: string; category: StaffCategory; role: string | null }>
): Promise<void> {
  const { error } = await supabase.from('staff_members').update(changes).eq('id', id);
  if (error) throw error;
}

export async function removeStaffMember(id: string): Promise<void> {
  const { error } = await supabase.from('staff_members').delete().eq('id', id);
  if (error) throw error;
}

/** Sposta una persona tra gli ex (o la riattiva) — stesso principio di moveToEx/moveToExMany per i
 * giocatori (app/hooks/usePlayers.ts): una persona tra gli ex non è più selezionabile per una
 * nuova Convocazione/Lista Gara, ma resta visibile dove già convocata in passato. */
export async function setStaffMemberEx(id: string, isEx: boolean): Promise<void> {
  const { error } = await supabase.from('staff_members').update({ is_ex: isEx }).eq('id', id);
  if (error) throw error;
}
