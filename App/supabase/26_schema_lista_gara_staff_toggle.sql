-- ElleraApp — schema Supabase: Lista Gara, sezione Staff configurabile

-- Da eseguire UNA VOLTA nell'SQL Editor di Supabase, dopo 25_schema_lista_gara.sql.

-- ============================================================================
-- Mostra/nasconde la sezione Staff nella Lista Gara (a schermo e nel PDF) —
-- stesso pattern di show_training_attendance/surveys_enabled: default true
-- (mostrata), configurabile dall'Admin in Gestione Squadra → Admin →
-- Configurazioni. Nessuna nuova policy RLS necessaria (stesso principio delle
-- altre colonne booleane su organizations).
-- ============================================================================

alter table organizations add column if not exists lista_gara_show_staff boolean not null default true;
