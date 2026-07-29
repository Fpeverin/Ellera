-- ElleraApp — schema Supabase: Convocazione partita + Rosa Staff categorizzata
--
-- Da eseguire UNA VOLTA nell'SQL Editor di Supabase, dopo tutti gli script
-- precedenti (in particolare 8_schema_roles.sql, per is_staff_or_admin_of, e
-- 5_schema_match_live.sql, per la tabella match_live).

-- ============================================================================
-- Rosa Staff: elenco di persone (nome + categoria + ruolo), indipendente dagli
-- account app — stesso principio di "players" per i giocatori. Non richiede
-- nessun account per comparire nelle convocazioni (es. un fisioterapista che
-- non usera' mai l'app).
-- ============================================================================

create table if not exists staff_members (
  id text primary key,
  org_id uuid not null references organizations (id) on delete cascade,
  name text not null,
  category text not null check (category in ('TECNICO', 'SANITARIO', 'DIRIGENZIALE')),
  role text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists staff_members_org_id_idx on staff_members (org_id);

drop trigger if exists staff_members_set_updated_at on staff_members;
create trigger staff_members_set_updated_at
  before update on staff_members
  for each row execute function set_updated_at();

alter table staff_members enable row level security;

drop policy if exists "read staff_members" on staff_members;
drop policy if exists "staff insert staff_members" on staff_members;
drop policy if exists "staff update staff_members" on staff_members;
drop policy if exists "staff delete staff_members" on staff_members;
create policy "read staff_members" on staff_members for select using (is_member_of(org_id));
create policy "staff insert staff_members" on staff_members for insert with check (is_staff_or_admin_of(org_id));
create policy "staff update staff_members" on staff_members for update using (is_staff_or_admin_of(org_id)) with check (is_staff_or_admin_of(org_id));
create policy "staff delete staff_members" on staff_members for delete using (is_staff_or_admin_of(org_id));

-- ============================================================================
-- Convocazione: una colonna in piu' su match_live (stesso pattern di
-- goals/subs/cards/lineup — un valore jsonb per partita), con la scheda
-- convocazione completa:
--   { ritrovo: string,
--     playerIds: string[],       -- giocatori convocati (id da "players")
--     staffIds: string[],        -- staff convocato (id da "staff_members")
--     menuItems: {id, name}[],   -- piatti disponibili per questa convocazione
--     meals: Record<personId, menuItemId> }  -- scelta di ciascun convocato
-- ============================================================================

alter table match_live add column if not exists convocazione jsonb;
