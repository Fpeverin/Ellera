-- ElleraApp — schema Supabase: Lista Gara

-- Da eseguire UNA VOLTA nell'SQL Editor di Supabase, dopo 5_schema_match_live.sql.

-- ============================================================================
-- Lista Gara: una colonna in piu' su match_live (stesso pattern di
-- goals/subs/cards/lineup/convocazione — un valore jsonb per partita):
--   { numbers: Record<"1".."20", playerId>,   -- titolari 1-11, panchina 12-20
--     staff: Record<ruolo, "player:<id>" | "staff:<id>"> }  -- un ruolo -> una persona
-- Il prefisso "player:"/"staff:" nei valori di "staff" distingue da quale
-- tabella viene l'id scelto (un giocatore puo' comunque coprire un ruolo di
-- staff per quella singola partita, es. player-coach).
-- ============================================================================

alter table match_live add column if not exists lista_gara jsonb;
