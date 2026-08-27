-- ElleraApp — schema Supabase: Lista Gara, sezione Arbitri configurabile

-- Da eseguire UNA VOLTA nell'SQL Editor di Supabase, dopo 29_schema_matchday_fixtures_own_match.sql.

-- ============================================================================
-- Mostra/nasconde la sezione Arbitro/Assistenti Arbitro nella Lista Gara (a
-- schermo e nel PDF) — stesso pattern di lista_gara_show_staff: default true
-- (mostrata), configurabile dall'Admin in Gestione Squadra → Admin →
-- Configurazioni. I nomi arbitro/assistenti sono testo libero (non collegati
-- a Rosa/Staff) e vivono nella colonna jsonb lista_gara già esistente, quindi
-- non serve nessuna nuova colonna oltre al toggle.
-- ============================================================================

alter table organizations add column if not exists lista_gara_show_arbitri boolean not null default true;
