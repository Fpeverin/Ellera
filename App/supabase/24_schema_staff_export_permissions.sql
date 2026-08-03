-- 24_schema_staff_export_permissions.sql
--
-- Le azioni Importa/Esporta/Modello (Rosa, Partite, Allenamenti) e "Seleziona" (Rosa) sono di
-- default visibili solo all'Admin. L'Admin può concederle anche allo Staff, sezione per sezione
-- (tutto o in parte) da Gestione Squadra -> Admin -> Configurazioni. Nessuna nuova policy RLS:
-- la lettura di "organizations" è già is_member_of, la scrittura è già admin-only.
alter table organizations add column if not exists staff_can_export_rosa boolean not null default false;
alter table organizations add column if not exists staff_can_export_partite boolean not null default false;
alter table organizations add column if not exists staff_can_export_allenamenti boolean not null default false;
