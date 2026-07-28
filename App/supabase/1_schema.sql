-- ElleraApp — schema Supabase (Fase 1: autenticazione + squadre + eventi/calendario)
--
-- Come usarlo: apri il progetto su https://supabase.com/dashboard -> SQL Editor ->
-- incolla tutto questo file -> Run. Puo' essere eseguito una sola volta su un
-- progetto nuovo; le fasi successive aggiungeranno nuovi script separati.

-- ============================================================================
-- Estensioni
-- ============================================================================
create extension if not exists "pgcrypto"; -- per gen_random_uuid()

-- ============================================================================
-- Tabelle: organizzazioni (squadre) e appartenenza (membership)
-- ============================================================================

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique default substr(md5(random()::text), 1, 8),
  created_at timestamptz not null default now()
);

create table if not exists memberships (
  user_id uuid not null references auth.users (id) on delete cascade,
  org_id uuid not null references organizations (id) on delete cascade,
  role text not null default 'staff' check (role in ('admin', 'staff')),
  created_at timestamptz not null default now(),
  primary key (user_id, org_id)
);

-- ============================================================================
-- Funzioni helper (SECURITY DEFINER: evitano subquery ricorsive costose nelle
-- policy RLS, e permettono di verificare l'appartenenza senza dover esporre
-- direttamente tutta la tabella memberships in lettura)
-- ============================================================================

create or replace function is_member_of(target_org uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from memberships
    where user_id = auth.uid() and org_id = target_org
  );
$$;

create or replace function is_admin_of(target_org uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from memberships
    where user_id = auth.uid() and org_id = target_org and role = 'admin'
  );
$$;

-- ============================================================================
-- RPC: creare una nuova squadra (chi la crea diventa admin) o entrare in una
-- squadra esistente tramite invite code (si entra come staff)
-- ============================================================================

create or replace function create_organization(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_org_id uuid;
begin
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'Il nome della squadra non puo'' essere vuoto';
  end if;

  insert into organizations (name) values (trim(p_name))
  returning id into new_org_id;

  insert into memberships (user_id, org_id, role)
  values (auth.uid(), new_org_id, 'admin');

  return new_org_id;
end;
$$;

create or replace function join_organization(p_invite_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_org_id uuid;
begin
  select id into target_org_id
  from organizations
  where invite_code = trim(p_invite_code);

  if target_org_id is null then
    raise exception 'Codice invito non valido';
  end if;

  insert into memberships (user_id, org_id, role)
  values (auth.uid(), target_org_id, 'staff')
  on conflict (user_id, org_id) do nothing;

  return target_org_id;
end;
$$;

-- ============================================================================
-- Tabella dati: eventi (calendario / partite / allenamenti) — Fase 1
-- ============================================================================

-- NB: "id" e' testo (non uuid) perche' l'app genera gia' da sola i propri id
-- (stringhe tipo "1737890123456-...", non UUID veri) in vari punti del codice.
create table if not exists events (
  id text primary key,
  org_id uuid not null references organizations (id) on delete cascade,
  type text not null check (type in ('PARTITA', 'ALLENAMENTO')),
  date date not null,
  time text,
  location text,
  opponent text,
  -- tutto il resto di CalendarEvent (module, formationSlots, benchIds,
  -- tacticsIds, tattiche, presenze, temaAllenamento, competition, homeAway...)
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists events_org_id_idx on events (org_id);

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists events_set_updated_at on events;
create trigger events_set_updated_at
  before update on events
  for each row execute function set_updated_at();

-- ============================================================================
-- Row Level Security
-- ============================================================================

alter table organizations enable row level security;
alter table memberships enable row level security;
alter table events enable row level security;

-- organizations: solo i membri possono leggere la propria; solo l'admin puo'
-- aggiornarla (es. rinominarla). L'inserimento avviene solo tramite la
-- funzione create_organization (SECURITY DEFINER), non via insert diretto.
drop policy if exists "members can read own organization" on organizations;
create policy "members can read own organization" on organizations
  for select using (is_member_of(id));

drop policy if exists "admin can update own organization" on organizations;
create policy "admin can update own organization" on organizations
  for update using (is_admin_of(id));

-- memberships: i membri vedono le membership della propria squadra; solo
-- l'admin puo' modificarle/rimuoverle (gestione staff).
drop policy if exists "members can read memberships of own organization" on memberships;
create policy "members can read memberships of own organization" on memberships
  for select using (is_member_of(org_id));

drop policy if exists "admin can manage memberships" on memberships;
create policy "admin can manage memberships" on memberships
  for all using (is_admin_of(org_id)) with check (is_admin_of(org_id));

-- events: qualunque membro della squadra puo' leggere/creare/modificare/
-- cancellare gli eventi della propria squadra.
drop policy if exists "members can manage events of own organization" on events;
create policy "members can manage events of own organization" on events
  for all using (is_member_of(org_id)) with check (is_member_of(org_id));
