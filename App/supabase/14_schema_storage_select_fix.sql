-- 14_schema_storage_select_fix.sql
--
-- Fix: l'upload con upsert su Storage (usato ovunque nell'app: foto giocatore,
-- allegati, preview tattiche, loghi) fallisce con "new row violates row-level
-- security policy" perché i bucket avevano policy di INSERT/UPDATE/DELETE ma
-- NESSUNA policy di SELECT su storage.objects — il flag "public" del bucket
-- copre solo la lettura via URL pubblico (CDN), non le verifiche interne del
-- servizio Storage quando decide se un file esiste già (upsert). Aggiunta una
-- policy di lettura, scoped per organizzazione, su tutti i bucket immagine
-- esistenti.

drop policy if exists "members can read own org photos" on storage.objects;
create policy "members can read own org photos" on storage.objects
  for select using (
    bucket_id = 'player-photos' and is_member_of((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "members can read own org attachments" on storage.objects;
create policy "members can read own org attachments" on storage.objects
  for select using (
    bucket_id = 'player-attachments' and is_member_of((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "members can read own org tactic previews" on storage.objects;
create policy "members can read own org tactic previews" on storage.objects
  for select using (
    bucket_id = 'tactic-previews' and is_member_of((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "members can read own org logos" on storage.objects;
create policy "members can read own org logos" on storage.objects
  for select using (
    bucket_id = 'team-logos' and is_member_of((storage.foldername(name))[1]::uuid)
  );
