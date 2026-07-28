-- ElleraApp — schema Supabase: ruoli a 3 livelli (Admin/Staff/Giocatore) + inviti personali
--
-- Da eseguire UNA VOLTA nell'SQL Editor di Supabase, dopo TUTTI gli script precedenti
-- (1_schema.sql, 2_schema_players.sql, 3_schema_archive.sql, 4_schema_modules_tactics.sql,
-- 5_schema_match_live.sql, 7_schema_staff.sql).
--
-- Cambia il modello di ingresso in squadra: non esistono piu' codici invito condivisi.
-- Ogni codice e' personale e generato dall'admin per UNA persona precisa:
--   - per un Giocatore, l'admin lo genera dalla scheda di un giocatore gia' in rosa
--     (create_player_invite) — chi lo riscatta si collega a QUEL giocatore.
--   - per lo Staff, l'admin lo genera dando solo un nome (create_staff_invite) — chi lo
--     riscatta entra come Staff.
-- Il vecchio "codice invito" condiviso di organizations/join_organization (1_schema.sql)
-- resta nel database inutilizzato: non lo tocchiamo, il client smette solo di chiamarlo.

-- ============================================================================
-- Ruolo Giocatore + collegamento a un giocatore della rosa
-- ============================================================================

alter table memberships drop constraint if exists memberships_role_check;
alter table memberships add constraint memberships_role_check
  check (role in ('admin', 'staff', 'giocatore'));

alter table memberships add column if not exists player_id text references players (id) on delete set null;

-- ============================================================================
-- Helper: membro con ruolo Staff o Admin (per le policy di scrittura sotto)
-- ============================================================================

create or replace function is_staff_or_admin_of(target_org uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from memberships
    where user_id = auth.uid() and org_id = target_org and role in ('admin', 'staff')
  );
$$;

-- ============================================================================
-- Tabella inviti personali. Nessuna policy RLS diretta (RLS attiva senza
-- policy = accesso diretto sempre negato): tutto passa dalle funzioni
-- SECURITY DEFINER qui sotto, stesso pattern di list_org_members.
-- ============================================================================

create table if not exists invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  role text not null check (role in ('staff', 'giocatore')),
  player_id text references players (id) on delete cascade,
  display_name text,
  code text not null unique default substr(md5(random()::text || clock_timestamp()::text), 1, 8),
  claimed_by uuid references auth.users (id),
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint invites_player_required_for_giocatore check (role <> 'giocatore' or player_id is not null)
);

create index if not exists invites_org_id_idx on invites (org_id);

alter table invites enable row level security;

-- ============================================================================
-- RPC inviti
-- ============================================================================

-- Genera (o ritorna quello gia' esistente, non ancora riscattato) il codice
-- personale per collegare un account a un giocatore preciso della rosa.
create or replace function create_player_invite(p_org_id uuid, p_player_id text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_code text;
  new_code text;
begin
  if not is_admin_of(p_org_id) then
    raise exception 'Solo l''admin puo'' generare inviti';
  end if;

  if not exists (select 1 from players where id = p_player_id and org_id = p_org_id) then
    raise exception 'Giocatore non trovato';
  end if;

  select code into existing_code
  from invites
  where org_id = p_org_id and role = 'giocatore' and player_id = p_player_id and claimed_by is null
  order by created_at desc
  limit 1;

  if existing_code is not null then
    return existing_code;
  end if;

  insert into invites (org_id, role, player_id)
  values (p_org_id, 'giocatore', p_player_id)
  returning code into new_code;

  return new_code;
end;
$$;

-- Genera un nuovo codice personale per un membro Staff, identificato solo da
-- un nome libero (la persona non e' ancora un utente registrato).
create or replace function create_staff_invite(p_org_id uuid, p_display_name text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  new_code text;
begin
  if not is_admin_of(p_org_id) then
    raise exception 'Solo l''admin puo'' generare inviti';
  end if;
  if p_display_name is null or length(trim(p_display_name)) = 0 then
    raise exception 'Il nome non puo'' essere vuoto';
  end if;

  insert into invites (org_id, role, display_name)
  values (p_org_id, 'staff', trim(p_display_name))
  returning code into new_code;

  return new_code;
end;
$$;

-- Elenco inviti non ancora riscattati (per la sezione "Inviti in attesa").
create or replace function list_pending_invites(p_org_id uuid)
returns table (
  id uuid, role text, player_id text, player_name text, display_name text,
  code text, created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin_of(p_org_id) then
    raise exception 'Solo l''admin puo'' vedere gli inviti in attesa';
  end if;

  return query
    select i.id, i.role, i.player_id, p.name as player_name, i.display_name, i.code, i.created_at
    from invites i
    left join players p on p.id = i.player_id
    where i.org_id = p_org_id and i.claimed_by is null
    order by i.created_at desc;
end;
$$;

-- Cancella un invito non ancora riscattato (mandato per errore, o da rigenerare).
create or replace function revoke_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  select org_id into v_org_id from invites where id = p_invite_id and claimed_by is null;
  if v_org_id is null then
    raise exception 'Invito non trovato o gia'' riscattato';
  end if;
  if not is_admin_of(v_org_id) then
    raise exception 'Solo l''admin puo'' revocare un invito';
  end if;

  delete from invites where id = p_invite_id;
end;
$$;

-- Chi si registra chiama questa con il proprio codice personale: crea la
-- membership con ruolo (e giocatore collegato, se previsto) presi dall'invito.
create or replace function redeem_invite(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  inv invites%rowtype;
begin
  select * into inv from invites where code = trim(p_code) for update;

  if inv.id is null then
    raise exception 'Codice non valido';
  end if;
  if inv.claimed_by is not null then
    raise exception 'Questo codice e'' gia'' stato usato';
  end if;

  insert into memberships (user_id, org_id, role, player_id)
  values (auth.uid(), inv.org_id, inv.role, inv.player_id)
  on conflict (user_id, org_id) do update
    set role = excluded.role, player_id = excluded.player_id;

  update invites set claimed_by = auth.uid(), claimed_at = now() where id = inv.id;

  return inv.org_id;
end;
$$;

-- ============================================================================
-- Estensione funzioni staff esistenti (7_schema_staff.sql): terzo ruolo +
-- nome del giocatore collegato nell'elenco membri.
-- ============================================================================

drop function if exists list_org_members(uuid);
create or replace function list_org_members(p_org_id uuid)
returns table (user_id uuid, email text, role text, joined_at timestamptz, player_id text, player_name text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin_of(p_org_id) then
    raise exception 'Solo l''admin puo'' vedere i membri della squadra';
  end if;

  return query
    select m.user_id, u.email::text, m.role, m.created_at, m.player_id, p.name as player_name
    from memberships m
    join auth.users u on u.id = m.user_id
    left join players p on p.id = m.player_id
    where m.org_id = p_org_id
    order by m.created_at;
end;
$$;

create or replace function update_member_role(p_org_id uuid, p_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin_of(p_org_id) then
    raise exception 'Solo l''admin puo'' modificare i ruoli';
  end if;
  if p_role not in ('admin', 'staff', 'giocatore') then
    raise exception 'Ruolo non valido';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'Non puoi cambiare il tuo stesso ruolo';
  end if;

  update memberships set role = p_role where org_id = p_org_id and user_id = p_user_id;
end;
$$;

-- ============================================================================
-- Read/write separati su tutte le tabelle dati: chiunque sia membro (incluso
-- Giocatore) puo' leggere; solo Staff/Admin possono scrivere. Sostituisce le
-- vecchie policy "for all using (is_member_of(org_id))".
-- ============================================================================

drop policy if exists "members can manage events of own organization" on events;
drop policy if exists "read events" on events;
drop policy if exists "staff insert events" on events;
drop policy if exists "staff update events" on events;
drop policy if exists "staff delete events" on events;
create policy "read events" on events for select using (is_member_of(org_id));
create policy "staff insert events" on events for insert with check (is_staff_or_admin_of(org_id));
create policy "staff update events" on events for update using (is_staff_or_admin_of(org_id)) with check (is_staff_or_admin_of(org_id));
create policy "staff delete events" on events for delete using (is_staff_or_admin_of(org_id));

drop policy if exists "members manage players" on players;
drop policy if exists "read players" on players;
drop policy if exists "staff insert players" on players;
drop policy if exists "staff update players" on players;
drop policy if exists "staff delete players" on players;
create policy "read players" on players for select using (is_member_of(org_id));
create policy "staff insert players" on players for insert with check (is_staff_or_admin_of(org_id));
create policy "staff update players" on players for update using (is_staff_or_admin_of(org_id)) with check (is_staff_or_admin_of(org_id));
create policy "staff delete players" on players for delete using (is_staff_or_admin_of(org_id));

drop policy if exists "members manage player_photos" on player_photos;
drop policy if exists "read player_photos" on player_photos;
drop policy if exists "staff insert player_photos" on player_photos;
drop policy if exists "staff update player_photos" on player_photos;
drop policy if exists "staff delete player_photos" on player_photos;
create policy "read player_photos" on player_photos for select using (is_member_of(org_id));
create policy "staff insert player_photos" on player_photos for insert with check (is_staff_or_admin_of(org_id));
create policy "staff update player_photos" on player_photos for update using (is_staff_or_admin_of(org_id)) with check (is_staff_or_admin_of(org_id));
create policy "staff delete player_photos" on player_photos for delete using (is_staff_or_admin_of(org_id));

drop policy if exists "members manage player_attachments" on player_attachments;
drop policy if exists "read player_attachments" on player_attachments;
drop policy if exists "staff insert player_attachments" on player_attachments;
drop policy if exists "staff update player_attachments" on player_attachments;
drop policy if exists "staff delete player_attachments" on player_attachments;
create policy "read player_attachments" on player_attachments for select using (is_member_of(org_id));
create policy "staff insert player_attachments" on player_attachments for insert with check (is_staff_or_admin_of(org_id));
create policy "staff update player_attachments" on player_attachments for update using (is_staff_or_admin_of(org_id)) with check (is_staff_or_admin_of(org_id));
create policy "staff delete player_attachments" on player_attachments for delete using (is_staff_or_admin_of(org_id));

drop policy if exists "members manage player_injury_types" on player_injury_types;
drop policy if exists "read player_injury_types" on player_injury_types;
drop policy if exists "staff insert player_injury_types" on player_injury_types;
drop policy if exists "staff update player_injury_types" on player_injury_types;
drop policy if exists "staff delete player_injury_types" on player_injury_types;
create policy "read player_injury_types" on player_injury_types for select using (is_member_of(org_id));
create policy "staff insert player_injury_types" on player_injury_types for insert with check (is_staff_or_admin_of(org_id));
create policy "staff update player_injury_types" on player_injury_types for update using (is_staff_or_admin_of(org_id)) with check (is_staff_or_admin_of(org_id));
create policy "staff delete player_injury_types" on player_injury_types for delete using (is_staff_or_admin_of(org_id));

drop policy if exists "members manage season_archives" on season_archives;
drop policy if exists "read season_archives" on season_archives;
drop policy if exists "staff insert season_archives" on season_archives;
drop policy if exists "staff update season_archives" on season_archives;
drop policy if exists "staff delete season_archives" on season_archives;
create policy "read season_archives" on season_archives for select using (is_member_of(org_id));
create policy "staff insert season_archives" on season_archives for insert with check (is_staff_or_admin_of(org_id));
create policy "staff update season_archives" on season_archives for update using (is_staff_or_admin_of(org_id)) with check (is_staff_or_admin_of(org_id));
create policy "staff delete season_archives" on season_archives for delete using (is_staff_or_admin_of(org_id));

drop policy if exists "members manage modules" on modules;
drop policy if exists "read modules" on modules;
drop policy if exists "staff insert modules" on modules;
drop policy if exists "staff update modules" on modules;
drop policy if exists "staff delete modules" on modules;
create policy "read modules" on modules for select using (is_member_of(org_id));
create policy "staff insert modules" on modules for insert with check (is_staff_or_admin_of(org_id));
create policy "staff update modules" on modules for update using (is_staff_or_admin_of(org_id)) with check (is_staff_or_admin_of(org_id));
create policy "staff delete modules" on modules for delete using (is_staff_or_admin_of(org_id));

drop policy if exists "members manage tactics" on tactics;
drop policy if exists "read tactics" on tactics;
drop policy if exists "staff insert tactics" on tactics;
drop policy if exists "staff update tactics" on tactics;
drop policy if exists "staff delete tactics" on tactics;
create policy "read tactics" on tactics for select using (is_member_of(org_id));
create policy "staff insert tactics" on tactics for insert with check (is_staff_or_admin_of(org_id));
create policy "staff update tactics" on tactics for update using (is_staff_or_admin_of(org_id)) with check (is_staff_or_admin_of(org_id));
create policy "staff delete tactics" on tactics for delete using (is_staff_or_admin_of(org_id));

drop policy if exists "members manage match_live" on match_live;
drop policy if exists "read match_live" on match_live;
drop policy if exists "staff insert match_live" on match_live;
drop policy if exists "staff update match_live" on match_live;
drop policy if exists "staff delete match_live" on match_live;
create policy "read match_live" on match_live for select using (is_member_of(org_id));
create policy "staff insert match_live" on match_live for insert with check (is_staff_or_admin_of(org_id));
create policy "staff update match_live" on match_live for update using (is_staff_or_admin_of(org_id)) with check (is_staff_or_admin_of(org_id));
create policy "staff delete match_live" on match_live for delete using (is_staff_or_admin_of(org_id));

-- Storage: la lettura resta pubblica (bucket public=true, nessuna RLS
-- necessaria); solo scrittura/modifica/cancellazione limitate a Staff/Admin.

drop policy if exists "members can write own org photos" on storage.objects;
create policy "staff can write own org photos" on storage.objects
  for insert with check (bucket_id = 'player-photos' and is_staff_or_admin_of((storage.foldername(name))[1]::uuid));
drop policy if exists "members can update own org photos" on storage.objects;
create policy "staff can update own org photos" on storage.objects
  for update using (bucket_id = 'player-photos' and is_staff_or_admin_of((storage.foldername(name))[1]::uuid));
drop policy if exists "members can delete own org photos" on storage.objects;
create policy "staff can delete own org photos" on storage.objects
  for delete using (bucket_id = 'player-photos' and is_staff_or_admin_of((storage.foldername(name))[1]::uuid));

drop policy if exists "members can write own org attachments" on storage.objects;
create policy "staff can write own org attachments" on storage.objects
  for insert with check (bucket_id = 'player-attachments' and is_staff_or_admin_of((storage.foldername(name))[1]::uuid));
drop policy if exists "members can update own org attachments" on storage.objects;
create policy "staff can update own org attachments" on storage.objects
  for update using (bucket_id = 'player-attachments' and is_staff_or_admin_of((storage.foldername(name))[1]::uuid));
drop policy if exists "members can delete own org attachments" on storage.objects;
create policy "staff can delete own org attachments" on storage.objects
  for delete using (bucket_id = 'player-attachments' and is_staff_or_admin_of((storage.foldername(name))[1]::uuid));

drop policy if exists "members can write own org tactic previews" on storage.objects;
create policy "staff can write own org tactic previews" on storage.objects
  for insert with check (bucket_id = 'tactic-previews' and is_staff_or_admin_of((storage.foldername(name))[1]::uuid));
drop policy if exists "members can update own org tactic previews" on storage.objects;
create policy "staff can update own org tactic previews" on storage.objects
  for update using (bucket_id = 'tactic-previews' and is_staff_or_admin_of((storage.foldername(name))[1]::uuid));
drop policy if exists "members can delete own org tactic previews" on storage.objects;
create policy "staff can delete own org tactic previews" on storage.objects
  for delete using (bucket_id = 'tactic-previews' and is_staff_or_admin_of((storage.foldername(name))[1]::uuid));

-- ============================================================================
-- Proposte di evento live (gol/cartellino) da parte dei Giocatori, da
-- confermare/rifiutare da Staff/Admin.
-- ============================================================================

create table if not exists match_event_proposals (
  id text primary key,
  org_id uuid not null references organizations (id) on delete cascade,
  event_id text not null references events (id) on delete cascade,
  type text not null check (type in ('GOAL', 'CARD')),
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  proposed_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  decided_by uuid references auth.users (id),
  decided_at timestamptz
);

create index if not exists match_event_proposals_event_idx on match_event_proposals (event_id);

alter table match_event_proposals enable row level security;

drop policy if exists "members can read proposals" on match_event_proposals;
create policy "members can read proposals" on match_event_proposals
  for select using (is_member_of(org_id));

drop policy if exists "members can propose" on match_event_proposals;
create policy "members can propose" on match_event_proposals
  for insert with check (is_member_of(org_id) and proposed_by = auth.uid());

drop policy if exists "staff can decide proposals" on match_event_proposals;
create policy "staff can decide proposals" on match_event_proposals
  for update using (is_staff_or_admin_of(org_id)) with check (is_staff_or_admin_of(org_id));

drop policy if exists "staff can delete proposals" on match_event_proposals;
create policy "staff can delete proposals" on match_event_proposals
  for delete using (is_staff_or_admin_of(org_id));
