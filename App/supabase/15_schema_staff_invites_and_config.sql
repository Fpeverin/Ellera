-- 15_schema_staff_invites_and_config.sql
--
-- Collega un account a una persona della Rosa Staff, esattamente come già
-- avviene per i Giocatori (memberships.player_id) — mirror di
-- App/supabase/8_schema_roles.sql. Aggiunge anche la prima "configurazione"
-- gestibile dall'Admin: la lista dei Ruoli disponibili per lo Staff.

-- ============================================================================
-- Collegamento account <-> persona dello Staff
-- ============================================================================

alter table memberships add column if not exists staff_member_id text references staff_members (id) on delete set null;
alter table invites add column if not exists staff_member_id text references staff_members (id) on delete cascade;

-- ============================================================================
-- Configurazioni squadra: lista Ruoli disponibili per lo Staff (editabile
-- dall'Admin nella sezione "Configurazioni"). Seed = i ruoli indicati da
-- Francesco + "Fisioterapista" per coprire la categoria Sanitario.
-- ============================================================================

alter table organizations add column if not exists staff_roles jsonb not null default
  '["Allenatore","Vice-Allenatore","Preparatore Atletico","Preparatore Portieri","Direttore Sportivo","Fisioterapista"]'::jsonb;

-- ============================================================================
-- RPC: genera (o ritorna quello gia' esistente, non riscattato) il codice
-- personale per collegare un account a una persona gia' censita in Staff.
-- Stesso identico pattern di create_player_invite.
-- ============================================================================

create or replace function create_staff_member_invite(p_org_id uuid, p_staff_member_id text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_code text;
  new_code text;
  v_name text;
begin
  if not is_admin_of(p_org_id) then
    raise exception 'Solo l''admin puo'' generare inviti';
  end if;

  select name into v_name from staff_members where id = p_staff_member_id and org_id = p_org_id;
  if v_name is null then
    raise exception 'Persona non trovata nella Rosa Staff';
  end if;

  select code into existing_code
  from invites
  where org_id = p_org_id and role = 'staff' and staff_member_id = p_staff_member_id and claimed_by is null
  order by created_at desc
  limit 1;

  if existing_code is not null then
    return existing_code;
  end if;

  insert into invites (org_id, role, staff_member_id, display_name)
  values (p_org_id, 'staff', p_staff_member_id, v_name)
  returning code into new_code;

  return new_code;
end;
$$;

-- ============================================================================
-- redeem_invite: ridefinita per propagare anche staff_member_id sulla
-- membership creata/aggiornata (oltre a player_id, gia' presente).
-- ============================================================================

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

  insert into memberships (user_id, org_id, role, player_id, staff_member_id)
  values (auth.uid(), inv.org_id, inv.role, inv.player_id, inv.staff_member_id)
  on conflict (user_id, org_id) do update
    set role = excluded.role, player_id = excluded.player_id, staff_member_id = excluded.staff_member_id;

  update invites set claimed_by = auth.uid(), claimed_at = now() where id = inv.id;

  return inv.org_id;
end;
$$;

-- ============================================================================
-- list_org_members: ridefinita per aggiungere staff_member_id/staff_member_name
-- (left join staff_members), mirror di player_id/player_name.
-- ============================================================================

drop function if exists list_org_members(uuid);
create or replace function list_org_members(p_org_id uuid)
returns table (
  user_id uuid, email text, role text, joined_at timestamptz,
  player_id text, player_name text,
  staff_member_id text, staff_member_name text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin_of(p_org_id) then
    raise exception 'Solo l''admin puo'' vedere i membri della squadra';
  end if;

  return query
    select m.user_id, u.email::text, m.role, m.created_at,
           m.player_id, p.name as player_name,
           m.staff_member_id, s.name as staff_member_name
    from memberships m
    join auth.users u on u.id = m.user_id
    left join players p on p.id = m.player_id
    left join staff_members s on s.id = m.staff_member_id
    where m.org_id = p_org_id
    order by m.created_at;
end;
$$;

-- ============================================================================
-- list_pending_invites: ridefinita per aggiungere staff_member_id (il nome
-- e' gia' disponibile in display_name, valorizzato da create_staff_member_invite).
-- ============================================================================

drop function if exists list_pending_invites(uuid);
create or replace function list_pending_invites(p_org_id uuid)
returns table (
  id uuid, role text, player_id text, player_name text, staff_member_id text,
  display_name text, code text, created_at timestamptz
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
    select i.id, i.role, i.player_id, p.name as player_name, i.staff_member_id, i.display_name, i.code, i.created_at
    from invites i
    left join players p on p.id = i.player_id
    where i.org_id = p_org_id and i.claimed_by is null
    order by i.created_at desc;
end;
$$;

-- Il vecchio create_staff_invite (nome libero, non collegato a nessuna persona
-- della Rosa Staff) resta nel database inutilizzato — stessa convenzione gia'
-- seguita per join_organization: il client smette solo di chiamarlo.
