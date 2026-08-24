-- ElleraApp — schema Supabase: Altre Partite (incontri delle altre squadre della giornata)
--
-- Da eseguire UNA VOLTA nell'SQL Editor di Supabase, dopo 8_schema_roles.sql (per
-- is_member_of/is_staff_or_admin_of) e 14_schema_storage_select_fix.sql (per il pattern
-- di policy Storage con SELECT esplicita, applicato anche qui).

-- ============================================================================
-- matchday_fixtures: incontri di testo libero (squadra-squadra, risultato, marcatori)
-- per una giornata di una competizione. Chiave (org_id, competition, giornata) — NON
-- legata all'id di una partita nostra, stesso principio di "competition_rules": inserendo
-- un incontro da una qualsiasi delle nostre partite di quella giornata, compare
-- automaticamente anche aprendo "Altre Partite" da un'altra nostra partita della stessa
-- giornata/competizione.
-- ============================================================================

create table if not exists matchday_fixtures (
  id text primary key,
  org_id uuid not null references organizations (id) on delete cascade,
  competition text not null,
  giornata text not null,
  home_team text not null,
  away_team text not null,
  home_score integer,
  away_score integer,
  scorers text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists matchday_fixtures_lookup_idx
  on matchday_fixtures (org_id, competition, giornata);

drop trigger if exists matchday_fixtures_set_updated_at on matchday_fixtures;
create trigger matchday_fixtures_set_updated_at
  before update on matchday_fixtures
  for each row execute function set_updated_at();

alter table matchday_fixtures enable row level security;

drop policy if exists "read matchday_fixtures" on matchday_fixtures;
drop policy if exists "staff insert matchday_fixtures" on matchday_fixtures;
drop policy if exists "staff update matchday_fixtures" on matchday_fixtures;
drop policy if exists "staff delete matchday_fixtures" on matchday_fixtures;
create policy "read matchday_fixtures" on matchday_fixtures for select using (is_member_of(org_id));
create policy "staff insert matchday_fixtures" on matchday_fixtures for insert with check (is_staff_or_admin_of(org_id));
create policy "staff update matchday_fixtures" on matchday_fixtures for update using (is_staff_or_admin_of(org_id)) with check (is_staff_or_admin_of(org_id));
create policy "staff delete matchday_fixtures" on matchday_fixtures for delete using (is_staff_or_admin_of(org_id));

-- ============================================================================
-- matchday_fixture_attachments: foto/PDF delle formazioni allegate a un incontro.
-- ============================================================================

create table if not exists matchday_fixture_attachments (
  id text primary key,
  org_id uuid not null references organizations (id) on delete cascade,
  fixture_id text not null references matchday_fixtures (id) on delete cascade,
  name text not null,
  storage_path text not null,
  created_at timestamptz not null default now()
);

create index if not exists matchday_fixture_attachments_fixture_id_idx
  on matchday_fixture_attachments (fixture_id);

alter table matchday_fixture_attachments enable row level security;

drop policy if exists "read matchday_fixture_attachments" on matchday_fixture_attachments;
drop policy if exists "staff insert matchday_fixture_attachments" on matchday_fixture_attachments;
drop policy if exists "staff delete matchday_fixture_attachments" on matchday_fixture_attachments;
create policy "read matchday_fixture_attachments" on matchday_fixture_attachments for select using (is_member_of(org_id));
create policy "staff insert matchday_fixture_attachments" on matchday_fixture_attachments for insert with check (is_staff_or_admin_of(org_id));
create policy "staff delete matchday_fixture_attachments" on matchday_fixture_attachments for delete using (is_staff_or_admin_of(org_id));

-- ============================================================================
-- Storage: bucket pubblico per gli allegati (foto o PDF, contentType generico —
-- stesso principio di "player-attachments"). Path: "{org_id}/...". Servono le 4
-- policy (SELECT+INSERT+UPDATE+DELETE), non solo le ultime 3 — vedi nota in
-- 14_schema_storage_select_fix.sql.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('matchday-attachments', 'matchday-attachments', true)
on conflict (id) do nothing;

drop policy if exists "members can read own org matchday attachments" on storage.objects;
create policy "members can read own org matchday attachments" on storage.objects
  for select using (
    bucket_id = 'matchday-attachments' and is_member_of((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "members can write own org matchday attachments" on storage.objects;
create policy "members can write own org matchday attachments" on storage.objects
  for insert with check (
    bucket_id = 'matchday-attachments' and is_staff_or_admin_of((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "members can update own org matchday attachments" on storage.objects;
create policy "members can update own org matchday attachments" on storage.objects
  for update using (
    bucket_id = 'matchday-attachments' and is_staff_or_admin_of((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "members can delete own org matchday attachments" on storage.objects;
create policy "members can delete own org matchday attachments" on storage.objects
  for delete using (
    bucket_id = 'matchday-attachments' and is_staff_or_admin_of((storage.foldername(name))[1]::uuid)
  );
