// app/data/playerEdits.ts
//
// Proposte di modifica dei dati anagrafici di un giocatore (ruolo, anno di
// nascita, altezza, peso). Admin/Staff modificano "players" direttamente
// (vedi updatePlayer in app/hooks/usePlayers.ts); un Giocatore puo' solo
// PROPORRE una modifica per il giocatore a cui e' collegato, che resta
// "pending" finche' Staff/Admin non la conferma o rifiuta.
import { getCurrentOrgId } from '../lib/currentOrg';
import { supabase } from '../lib/supabase';
import { loadNotifyConfig } from './organization';
import { Role } from './players';
import { sendExpoPush } from './pushNotify';

export type PlayerEditChanges = Partial<{
  role: Role;
  dob: string; // 'YYYY-MM-DD'
  height: string;
  weight: string;
}>;

export type PlayerEditStatus = 'pending' | 'approved' | 'rejected';

export type PlayerEditRequest = {
  id: string;
  playerId: string;
  changes: PlayerEditChanges;
  status: PlayerEditStatus;
  requestedBy: string;
  createdAt: string;
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function fromRow(row: any): PlayerEditRequest {
  return {
    id: row.id,
    playerId: row.player_id,
    changes: row.changes,
    status: row.status,
    requestedBy: row.requested_by,
    createdAt: row.created_at,
  };
}

export async function loadPlayerEditRequests(playerId: string): Promise<PlayerEditRequest[]> {
  const { data, error } = await supabase
    .from('player_edit_requests')
    .select('*')
    .eq('player_id', playerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(fromRow);
}

async function notifyStaffOfPlayerEdit(orgId: string, playerId: string) {
  try {
    const [config, { data: player }] = await Promise.all([
      loadNotifyConfig('player_edit'),
      supabase.from('players').select('name').eq('id', playerId).maybeSingle(),
    ]);
    const { data: tokens, error } = await supabase.rpc('get_notification_tokens', {
      p_org_id: orgId,
      p_mode: config.mode,
      p_staff_member_ids: config.staffIds,
    });
    if (error) throw error;
    const name = player?.name ?? 'un giocatore';
    await sendExpoPush(tokens ?? [], 'Richiesta modifica anagrafica', `${name} ha proposto una modifica ai propri dati.`);
  } catch (e) {
    console.error('Errore notifica modifica anagrafica', e);
  }
}

export async function proposePlayerEdit(playerId: string, changes: PlayerEditChanges): Promise<void> {
  const orgId = getCurrentOrgId();
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase.from('player_edit_requests').insert({
    id: uid(),
    org_id: orgId,
    player_id: playerId,
    changes,
    requested_by: userData.user?.id,
  });
  if (error) throw error;
  notifyStaffOfPlayerEdit(orgId, playerId);
}

export async function decidePlayerEdit(id: string, decision: 'approved' | 'rejected'): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('player_edit_requests')
    .update({ status: decision, decided_by: userData.user?.id, decided_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}
