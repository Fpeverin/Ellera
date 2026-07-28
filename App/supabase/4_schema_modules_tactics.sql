-- ElleraApp — schema Supabase, Fase 3B: Moduli personalizzati e Tattiche
--
-- Da eseguire UNA VOLTA nell'SQL Editor di Supabase, dopo 1_schema.sql,
-- 2_schema_players.sql e 3_schema_archive.sql.

-- I moduli predefiniti restano hardcoded nel codice (app/utils/modules-layout.tsx):
-- qui vivono solo quelli personalizzati, con il NOME come chiave naturale
-- (stesso comportamento di oggi: creare/salvare con un nome già esistente
-- sovrascrive quel modulo).
create table if not exists modules (
  org_id uuid not null references organizations (id) on delete cascade,
  name text not null,
  slots jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (org_id, name)
);

drop trigger if exists modules_set_updated_at on modules;
create trigger modules_set_updated_at
  before update on modules
  for each row execute function set_updated_at();

-- Le tattiche hanno un id proprio (generato lato client, testo libero come
-- per eventi/giocatori). La preview e' un path nel bucket Storage, non piu'
-- un base64 incorporato nella riga.
create table if not exists tactics (
  id text primary key,
  org_id uuid not null references organizations (id) on delete cascade,
  name text not null,
  elements jsonb not null,
  preview_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tactics_org_id_idx on tactics (org_id);

drop trigger if exists tactics_set_updated_at on tactics;
create trigger tactics_set_updated_at
  before update on tactics
  for each row execute function set_updated_at();

alter table modules enable row level security;
alter table tactics enable row level security;

drop policy if exists "members manage modules" on modules;
create policy "members manage modules" on modules
  for all using (is_member_of(org_id)) with check (is_member_of(org_id));

drop policy if exists "members manage tactics" on tactics;
create policy "members manage tactics" on tactics
  for all using (is_member_of(org_id)) with check (is_member_of(org_id));

-- Storage: bucket pubblico per le preview delle tattiche (stesso schema di
-- player-photos/player-attachments).
insert into storage.buckets (id, name, public)
values ('tactic-previews', 'tactic-previews', true)
on conflict (id) do nothing;

drop policy if exists "members can write own org tactic previews" on storage.objects;
create policy "members can write own org tactic previews" on storage.objects
  for insert with check (
    bucket_id = 'tactic-previews' and is_member_of((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "members can update own org tactic previews" on storage.objects;
create policy "members can update own org tactic previews" on storage.objects
  for update using (
    bucket_id = 'tactic-previews' and is_member_of((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "members can delete own org tactic previews" on storage.objects;
create policy "members can delete own org tactic previews" on storage.objects
  for delete using (
    bucket_id = 'tactic-previews' and is_member_of((storage.foldername(name))[1]::uuid)
  );
