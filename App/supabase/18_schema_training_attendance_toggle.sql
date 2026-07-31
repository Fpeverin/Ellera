-- 18_schema_training_attendance_toggle.sql
--
-- Configurazione Admin: mostra/nascondi il registro presenze quando si apre
-- un allenamento dal calendario (data/ora/luogo/tema restano sempre visibili,
-- riguarda solo il registro presenze). Stesso pattern di organizations.staff_roles
-- (15_schema_staff_invites_and_config.sql) — nessuna nuova policy RLS: la
-- scrittura su organizations e' gia' admin-only ("admin can update own
-- organization", 1_schema.sql).

alter table organizations add column if not exists show_training_attendance boolean not null default true;
