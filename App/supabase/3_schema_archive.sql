-- ElleraApp — schema Supabase, Fase 3A: Archivio stagioni
--
-- Da eseguire UNA VOLTA nell'SQL Editor di Supabase, dopo 1_schema.sql e
-- 2_schema_players.sql.

create table if not exists season_archives (
  id text primary key,
  org_id uuid not null references organizations (id) on delete cascade,
  label text not null,
  archived_at timestamptz not null default now(),
  -- l'intero oggetto SeasonArchive (summary+squad+matches+trainings) — è
  -- già uno snapshot autosufficiente, non serve normalizzarlo ulteriormente.
  data jsonb not null
);

create index if not exists season_archives_org_id_idx on season_archives (org_id);

alter table season_archives enable row level security;

drop policy if exists "members manage season_archives" on season_archives;
create policy "members manage season_archives" on season_archives
  for all using (is_member_of(org_id)) with check (is_member_of(org_id));
