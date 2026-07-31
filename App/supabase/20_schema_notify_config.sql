-- 20_schema_notify_config.sql
--
-- Configurazione Admin: chi dello staff riceve la notifica quando un
-- giocatore fa una proposta Live (gol/cartellino) o una richiesta di modifica
-- anagrafica. Due impostazioni indipendenti (Francesco puo' scegliere
-- destinatari diversi per le due), stesso pattern di organizations.staff_roles
-- / show_training_attendance — nessuna nuova policy RLS, la scrittura su
-- organizations e' gia' admin-only ("admin can update own organization",
-- 1_schema.sql). I valori vengono letti da get_notification_tokens
-- (19_schema_push_tokens.sql).

alter table organizations add column if not exists notify_live_proposals_mode text not null default 'admin_only'
  check (notify_live_proposals_mode in ('admin_only', 'all', 'selected'));
alter table organizations add column if not exists notify_live_proposals_staff_ids jsonb not null default '[]'::jsonb;

alter table organizations add column if not exists notify_player_edit_mode text not null default 'admin_only'
  check (notify_player_edit_mode in ('admin_only', 'all', 'selected'));
alter table organizations add column if not exists notify_player_edit_staff_ids jsonb not null default '[]'::jsonb;
