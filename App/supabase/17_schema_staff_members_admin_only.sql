-- 17_schema_staff_members_admin_only.sql
--
-- La schermata "Staff" (Rosa Staff) diventa sola-consultazione per chiunque
-- non sia Admin, su richiesta di Francesco — prima Staff+Admin potevano
-- entrambi aggiungere/modificare/rimuovere persone, ora solo l'Admin.
-- La lettura resta a tutti i membri (Staff e Giocatore inclusi).

drop policy if exists "staff insert staff_members" on staff_members;
drop policy if exists "staff update staff_members" on staff_members;
drop policy if exists "staff delete staff_members" on staff_members;

create policy "admin insert staff_members" on staff_members
  for insert with check (is_admin_of(org_id));
create policy "admin update staff_members" on staff_members
  for update using (is_admin_of(org_id)) with check (is_admin_of(org_id));
create policy "admin delete staff_members" on staff_members
  for delete using (is_admin_of(org_id));
