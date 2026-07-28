-- ElleraApp — schema Supabase, Fase 3C: dati live-partita
--
-- Da eseguire UNA VOLTA nell'SQL Editor di Supabase, dopo 1_schema.sql,
-- 2_schema_players.sql, 3_schema_archive.sql e 4_schema_modules_tactics.sql.
--
-- Sostituisce le 9 chiavi AsyncStorage per-partita di oggi (goals, subs,
-- cards, lineup, positions, live_formation, started, timer_state,
-- tactics_assignments) con UNA riga per partita.

create table if not exists match_live (
  event_id text primary key references events (id) on delete cascade,
  org_id uuid not null references organizations (id) on delete cascade,
  goals jsonb not null default '[]'::jsonb,
  subs jsonb not null default '[]'::jsonb,
  cards jsonb not null default '[]'::jsonb,
  lineup jsonb,
  positions jsonb,
  live_formation jsonb,
  started boolean not null default false,
  timer_state jsonb,
  tactics_assignments jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists match_live_org_id_idx on match_live (org_id);

drop trigger if exists match_live_set_updated_at on match_live;
create trigger match_live_set_updated_at
  before update on match_live
  for each row execute function set_updated_at();

alter table match_live enable row level security;

drop policy if exists "members manage match_live" on match_live;
create policy "members manage match_live" on match_live
  for all using (is_member_of(org_id)) with check (is_member_of(org_id));
