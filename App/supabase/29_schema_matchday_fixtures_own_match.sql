-- ElleraApp — schema Supabase: collegamento "nostra partita" in Altre Partite

-- Da eseguire UNA VOLTA nell'SQL Editor di Supabase, dopo 27_schema_matchday_fixtures.sql.

-- ============================================================================
-- Colonna opzionale che collega una riga di matchday_fixtures alla partita (events.id) che
-- rappresenta — usata per sincronizzare automaticamente risultato/marcatori della NOSTRA partita
-- (presi da Live) dentro la sua stessa sezione "Altre Partite", così la giornata è completa senza
-- doverla reinserire a mano. Id della riga sincronizzata: sempre `own-{matchId}` (deterministico),
-- vedi syncOwnMatchFixture in app/data/matchdayFixtures.ts.
-- ============================================================================

alter table matchday_fixtures add column if not exists match_id text;
