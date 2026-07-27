-- ElleraApp — schema Supabase, Fase 2: Giocatori/Rosa + foto/allegati/infortuni
--
-- Da eseguire UNA VOLTA nell'SQL Editor di Supabase, in aggiunta a schema.sql
-- (che deve essere gia' stato eseguito prima di questo).

-- ============================================================================
-- Giocatori aggiunti manualmente (il roster di base resta hardcoded nel
-- codice, in app/data/players.ts — non ha una riga qui)
-- ============================================================================

create table if not exists players (
  id text primary key,
  org_id uuid not null references organizations (id) on delete cascade,
  name text not null,
  role text not null check (role in ('PORTIERE', 'DIFENSORE', 'CENTROCAMPISTA', 'ATTACCANTE')),
  year integer,
  height text,
  weight text,
  is_ex boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists players_org_id_idx on players (org_id);

drop trigger if exists players_set_updated_at on players;
create trigger players_set_updated_at
  before update on players
  for each row execute function set_updated_at();

-- ============================================================================
-- Foto profilo, allegati e "tipologia infortunio" per striscia.
--
-- NB: si applicano a QUALSIASI giocatore, anche quelli statici scritti nel
-- codice (che non hanno una riga in "players") — per questo player_id e'
-- testo libero, senza foreign key verso players.id.
-- ============================================================================

create table if not exists player_photos (
  org_id uuid not null references organizations (id) on delete cascade,
  player_id text not null,
  photo_path text not null,
  updated_at timestamptz not null default now(),
  primary key (org_id, player_id)
);

create table if not exists player_attachments (
  id text primary key,
  org_id uuid not null references organizations (id) on delete cascade,
  player_id text not null,
  name text not null,
  storage_path text not null,
  created_at timestamptz not null default now()
);

create index if not exists player_attachments_org_player_idx on player_attachments (org_id, player_id);

create table if not exists player_injury_types (
  org_id uuid not null references organizations (id) on delete cascade,
  player_id text not null,
  injury_key text not null,
  type text not null,
  primary key (org_id, player_id, injury_key)
);

-- ============================================================================
-- Row Level Security (stesso pattern di schema.sql: solo i membri della
-- propria squadra possono leggere/scrivere)
-- ============================================================================

alter table players enable row level security;
alter table player_photos enable row level security;
alter table player_attachments enable row level security;
alter table player_injury_types enable row level security;

drop policy if exists "members manage players" on players;
create policy "members manage players" on players
  for all using (is_member_of(org_id)) with check (is_member_of(org_id));

drop policy if exists "members manage player_photos" on player_photos;
create policy "members manage player_photos" on player_photos
  for all using (is_member_of(org_id)) with check (is_member_of(org_id));

drop policy if exists "members manage player_attachments" on player_attachments;
create policy "members manage player_attachments" on player_attachments
  for all using (is_member_of(org_id)) with check (is_member_of(org_id));

drop policy if exists "members manage player_injury_types" on player_injury_types;
create policy "members manage player_injury_types" on player_injury_types
  for all using (is_member_of(org_id)) with check (is_member_of(org_id));

-- ============================================================================
-- Storage: bucket pubblici (URL stabili senza scadenza, non elencati
-- pubblicamente da nessuna parte) per foto e allegati.
-- Path: "{org_id}/..." — solo i membri di quella squadra possono scrivere/
-- cancellare nella propria cartella; la lettura e' libera (bucket pubblico).
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('player-photos', 'player-photos', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('player-attachments', 'player-attachments', true)
on conflict (id) do nothing;

drop policy if exists "members can write own org photos" on storage.objects;
create policy "members can write own org photos" on storage.objects
  for insert with check (
    bucket_id = 'player-photos' and is_member_of((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "members can update own org photos" on storage.objects;
create policy "members can update own org photos" on storage.objects
  for update using (
    bucket_id = 'player-photos' and is_member_of((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "members can delete own org photos" on storage.objects;
create policy "members can delete own org photos" on storage.objects
  for delete using (
    bucket_id = 'player-photos' and is_member_of((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "members can write own org attachments" on storage.objects;
create policy "members can write own org attachments" on storage.objects
  for insert with check (
    bucket_id = 'player-attachments' and is_member_of((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "members can update own org attachments" on storage.objects;
create policy "members can update own org attachments" on storage.objects
  for update using (
    bucket_id = 'player-attachments' and is_member_of((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "members can delete own org attachments" on storage.objects;
create policy "members can delete own org attachments" on storage.objects
  for delete using (
    bucket_id = 'player-attachments' and is_member_of((storage.foldername(name))[1]::uuid)
  );
