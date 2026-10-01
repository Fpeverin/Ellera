-- ElleraApp — schema Supabase: Altre Partite, provenienza automatica (TuttoCampo)

-- Da eseguire UNA VOLTA nell'SQL Editor di Supabase, dopo 29_schema_matchday_fixtures_own_match.sql.

-- ============================================================================
-- Colonna opzionale che marca una riga di matchday_fixtures come importata in automatico (es.
-- 'tuttocampo') invece che inserita a mano da Staff/Admin o sincronizzata dalla nostra Live
-- (quella resta distinta, via match_id). Usata da altrePartite.tsx per bloccare la modifica
-- manuale di squadre/risultato/marcatori di una riga importata (si aggiorna da sola a ogni sync)
-- pur lasciando sempre possibile allegare foto/PDF — stesso principio già in uso per match_id.
-- ============================================================================

alter table matchday_fixtures add column if not exists source text;
