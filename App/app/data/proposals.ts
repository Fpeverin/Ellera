// app/data/proposals.ts
//
// Proposte di evento live (gol/cartellino) fatte da un Giocatore durante una
// partita: restano "pending" finche' Staff/Admin non le conferma o rifiuta.
// Le RLS bastano da sole (vedi schema_roles.sql), non serve passare da RPC.
import { getCurrentOrgId } from '../lib/currentOrg';
import { supabase } from '../lib/supabase';
import { CardItem, GoalItem } from './matchLive';

export type ProposalStatus = 'pending' | 'approved' | 'rejected';

export type GoalProposalPayload = Omit<GoalItem, 'id'>;
export type CardProposalPayload = Omit<CardItem, 'id'>;

export type EventProposal = {
  id: string;
  eventId: string;
  type: 'GOAL' | 'CARD';
  payload: GoalProposalPayload | CardProposalPayload;
  status: ProposalStatus;
  proposedBy: string;
  createdAt: string;
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function fromRow(row: any): EventProposal {
  return {
    id: row.id,
    eventId: row.event_id,
    type: row.type,
    payload: row.payload,
    status: row.status,
    proposedBy: row.proposed_by,
    createdAt: row.created_at,
  };
}

export async function loadProposals(eventId: string): Promise<EventProposal[]> {
  const { data, error } = await supabase
    .from('match_event_proposals')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(fromRow);
}

async function propose(eventId: string, type: 'GOAL' | 'CARD', payload: GoalProposalPayload | CardProposalPayload) {
  const orgId = getCurrentOrgId();
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase.from('match_event_proposals').insert({
    id: uid(),
    org_id: orgId,
    event_id: eventId,
    type,
    payload,
    proposed_by: userData.user?.id,
  });
  if (error) throw error;
}

export const proposeGoal = (eventId: string, payload: GoalProposalPayload) => propose(eventId, 'GOAL', payload);
export const proposeCard = (eventId: string, payload: CardProposalPayload) => propose(eventId, 'CARD', payload);

export async function decideProposal(id: string, decision: 'approved' | 'rejected'): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('match_event_proposals')
    .update({ status: decision, decided_by: userData.user?.id, decided_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}
