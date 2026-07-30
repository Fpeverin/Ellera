// app/data/invites.ts
//
// Inviti personali: ogni codice e' generato dall'admin per UNA persona precisa
// (un giocatore gia' in rosa, o un membro dello staff identificato per nome) —
// non esistono piu' codici condivisi da tutta la squadra.
import { supabase } from '../lib/supabase';
import { loadOrgMembers } from './staff';

export type PendingInvite = {
  id: string;
  role: 'staff' | 'giocatore';
  playerId: string | null;
  playerName: string | null;
  staffMemberId: string | null;
  displayName: string | null;
  code: string;
  createdAt: string;
};

export async function createPlayerInvite(orgId: string, playerId: string): Promise<string> {
  const { data, error } = await supabase.rpc('create_player_invite', {
    p_org_id: orgId,
    p_player_id: playerId,
  });
  if (error) throw error;
  return data as string;
}

export async function createStaffMemberInvite(orgId: string, staffMemberId: string): Promise<string> {
  const { data, error } = await supabase.rpc('create_staff_member_invite', {
    p_org_id: orgId,
    p_staff_member_id: staffMemberId,
  });
  if (error) throw error;
  return data as string;
}

export async function loadPendingInvites(orgId: string): Promise<PendingInvite[]> {
  const { data, error } = await supabase.rpc('list_pending_invites', { p_org_id: orgId });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: row.id,
    role: row.role,
    playerId: row.player_id ?? null,
    playerName: row.player_name ?? null,
    staffMemberId: row.staff_member_id ?? null,
    displayName: row.display_name ?? null,
    code: row.code,
    createdAt: row.created_at,
  }));
}

export async function revokeInvite(inviteId: string): Promise<void> {
  const { error } = await supabase.rpc('revoke_invite', { p_invite_id: inviteId });
  if (error) throw error;
}

/** Stato del collegamento account per un giocatore (per la scheda giocatore, solo admin). */
export async function loadPlayerInviteStatus(
  orgId: string,
  playerId: string
): Promise<{ pendingCode: string | null; claimedEmail: string | null; claimedUserId: string | null }> {
  const [invites, members] = await Promise.all([loadPendingInvites(orgId), loadOrgMembers(orgId)]);
  const pending = invites.find((i) => i.role === 'giocatore' && i.playerId === playerId);
  const claimed = members.find((m) => m.role === 'giocatore' && m.playerId === playerId);
  return {
    pendingCode: pending?.code ?? null,
    claimedEmail: claimed?.email ?? null,
    claimedUserId: claimed?.userId ?? null,
  };
}

/** Stato del collegamento account per una persona della Rosa Staff (solo admin). */
export async function loadStaffMemberInviteStatus(
  orgId: string,
  staffMemberId: string
): Promise<{ pendingCode: string | null; claimedEmail: string | null; claimedUserId: string | null }> {
  const [invites, members] = await Promise.all([loadPendingInvites(orgId), loadOrgMembers(orgId)]);
  const pending = invites.find((i) => i.role === 'staff' && i.staffMemberId === staffMemberId);
  const claimed = members.find((m) => m.role === 'staff' && m.staffMemberId === staffMemberId);
  return {
    pendingCode: pending?.code ?? null,
    claimedEmail: claimed?.email ?? null,
    claimedUserId: claimed?.userId ?? null,
  };
}
