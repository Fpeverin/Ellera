-- ElleraApp — schema Supabase: proposte di modifica dati giocatore
--
-- Da eseguire UNA VOLTA nell'SQL Editor di Supabase, dopo tutti gli script precedenti
-- (servono is_member_of/is_admin_of da 1_schema.sql, is_staff_or_admin_of e
-- memberships.player_id da 8_schema_roles.sql).
--
-- Admin e Staff possono modificare ruolo/anno di nascita/altezza/peso di QUALSIASI
-- giocatore direttamente (gia' permesso dalle policy di scrittura su "players").
-- Un Giocatore puo' modificare SOLO i propri dati (il giocatore a cui e' collegato
-- tramite memberships.player_id), e la modifica resta in attesa finche' Staff o
-- Admin non la conferma o rifiuta — stesso pattern di match_event_proposals.

create table if not exists player_edit_requests (
  id text primary key,
  org_id uuid not null references organizations (id) on delete cascade,
  player_id text not null references players (id) on delete cascade,
  changes jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  decided_by uuid references auth.users (id),
  decided_at timestamptz
);

create index if not exists player_edit_requests_player_idx on player_edit_requests (player_id);

alter table player_edit_requests enable row level security;

-- Nessuna policy diretta necessaria oltre a queste: la scrittura effettiva sui
-- dati del giocatore resta sulla tabella "players" (gia' protetta), qui si
-- protegge solo chi puo' proporre/leggere/decidere una richiesta.

drop policy if exists "members can read player edit requests" on player_edit_requests;
create policy "members can read player edit requests" on player_edit_requests
  for select using (is_member_of(org_id));

drop policy if exists "giocatore can propose own player edit" on player_edit_requests;
create policy "giocatore can propose own player edit" on player_edit_requests
  for insert with check (
    is_member_of(org_id)
    and requested_by = auth.uid()
    and exists (
      select 1 from memberships m
      where m.user_id = auth.uid() and m.org_id = org_id and m.player_id = player_id
    )
  );

drop policy if exists "staff can decide player edits" on player_edit_requests;
create policy "staff can decide player edits" on player_edit_requests
  for update using (is_staff_or_admin_of(org_id)) with check (is_staff_or_admin_of(org_id));

drop policy if exists "staff can delete player edits" on player_edit_requests;
create policy "staff can delete player edits" on player_edit_requests
  for delete using (is_staff_or_admin_of(org_id));
