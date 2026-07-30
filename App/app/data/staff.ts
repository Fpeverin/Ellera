// app/data/staff.ts
import { supabase } from '../lib/supabase';

export type Role = 'admin' | 'staff' | 'giocatore';

export type OrgMember = {
  userId: string;
  email: string;
  role: Role;
  joinedAt: string;
  playerId: string | null;
  playerName: string | null;
  staffMemberId: string | null;
  staffMemberName: string | null;
};

export async function loadOrgMembers(orgId: string): Promise<OrgMember[]> {
  const { data, error } = await supabase.rpc('list_org_members', { p_org_id: orgId });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    userId: row.user_id,
    email: row.email,
    role: row.role,
    joinedAt: row.joined_at,
    playerId: row.player_id ?? null,
    playerName: row.player_name ?? null,
    staffMemberId: row.staff_member_id ?? null,
    staffMemberName: row.staff_member_name ?? null,
  }));
}

export async function updateMemberRole(orgId: string, userId: string, role: Role): Promise<void> {
  const { error } = await supabase.rpc('update_member_role', {
    p_org_id: orgId,
    p_user_id: userId,
    p_role: role,
  });
  if (error) throw error;
}

export async function removeMember(orgId: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc('remove_member', { p_org_id: orgId, p_user_id: userId });
  if (error) throw error;
}
