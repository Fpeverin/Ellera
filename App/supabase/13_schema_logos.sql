-- 13_schema_logos.sql
--
-- Logo squadra (generale, una volta per organizzazione) + logo avversario
-- (per singola partita, salvato in events.data.opponentLogoPath — nessuna
-- colonna dedicata, riusa il campo dinamico jsonb già esistente).
--
-- Path nel bucket: "{org_id}/..." — stesso schema di autorizzazione già
-- usato per player-photos/player-attachments in 2_schema_players.sql.

alter table organizations add column if not exists logo_path text;

-- ============================================================================
-- Storage: bucket pubblico per i loghi (squadra + avversari)
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('team-logos', 'team-logos', true)
on conflict (id) do nothing;

drop policy if exists "members can write own org logos" on storage.objects;
create policy "members can write own org logos" on storage.objects
  for insert with check (
    bucket_id = 'team-logos' and is_member_of((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "members can update own org logos" on storage.objects;
create policy "members can update own org logos" on storage.objects
  for update using (
    bucket_id = 'team-logos' and is_member_of((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "members can delete own org logos" on storage.objects;
create policy "members can delete own org logos" on storage.objects
  for delete using (
    bucket_id = 'team-logos' and is_member_of((storage.foldername(name))[1]::uuid)
  );
