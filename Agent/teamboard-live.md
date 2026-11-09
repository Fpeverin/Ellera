# Live, casa/trasferta, correzione dati (App/)

Aggiornato 2026-11-09. Dettaglio per funzione: `App/CLAUDE.md` e `App/TEST_CASES.md`.

## Convenzione casa/trasferta (decisa 2026-10-05)
- Il calendario salva `homeAway` come `'CASA'`/`'TRASFERTA'` (versioni vecchie: `'HOME'`/`'AWAY'`, o booleano `isHome`). **Usare sempre `isHomeEvent(ev)` di `App/app/data/events.ts`**, mai confronti diretti: il confronto con `'HOME'` in Live ha invertito i lati di tutte le partite in casa fino al 2026-10-05.
- Nei dati Live `team: 'HOME'` = squadra di casa della partita, non "noi". `ourSide = isHomeEvent ? 'HOME' : 'AWAY'`.

## Modello cartellini/espulsioni (live.tsx)
- Un 2° giallo genera un rosso automatico separato (`autoFromSecondYellow`). Dal 2026-11-09 `withNormalizedAutoReds` (chiamata da `saveCards`) lo rigenera sempre: uno per giocatore, al minuto del 2° giallo, solo se i gialli sono ≥ 2. Non scrivere i cartellini senza passare da `saveCards`.
- Stato in campo/espulso dei nostri giocatori: `match_live.live_formation` (`inField`, `expelled`). `recomputeExpulsionsFromCards` lo riallinea ai cartellini; se toglie un'espulsione ricostruisce `inField` da `lineup.field` + cambi.
- Cambio in diretta: vincoli di stato (esce uno in campo, entra uno in panchina). Cambio manuale: nessun vincolo di stato (serve per correggere a posteriori).
- Gli eventi hanno ID propri e si possono modificare/eliminare dalla cronaca di Live.

## Come ispezionare o correggere i dati di una partita
- Sola lettura: piccolo script Node con `@supabase/supabase-js` e la service role key (variabili d'ambiente da `App/.env.sync-tuttocampo.local`, mai stampare la chiave); tabelle `events` (colonne `date`, `opponent`, `data` jsonb con `homeAway`/`competition`/`giornata`) e `match_live` (`goals`, `cards`, `subs`, `live_formation`, `lineup`, `started`).
- Per scrivere: prima prova a vuoto, poi backup in `App/logs/` (ignorato da git), poi applicazione, poi verifica. Modello: `App/scripts/migrate-live-sides.js`. Chiedere sempre l'ok all'utente prima di scrivere su dati veri.
- Formato di un cambio in `match_live.subs`: `{id, minute, outId, outName, inId, inName, team}`; nomi in maiuscolo come in rosa (es. `CONVITO MICHELE`), id tipo `convito-michele`.

## Statistiche e fine partita (decisione 2026-11-09)
- Le statistiche (squadra, scheda giocatore, archivio) NON leggono `match_live`: usano la **copia** di gol/cambi/cartellini nell'evento (`events.data.goals/subs/cards`) più `match_live.lineup` per i titolari e `matchDurationMinutes` per i minuti. La copia si riscrive solo con "Termina partita" / "Termina/aggiorna partita senza cronometro" (`finalizeMatchAndSave`), che per richiesta esplicita dell'utente **ricalcolano sempre tutto** e rileggono i dati veri da Supabase, non lo stato della schermata.
- Modificare gli eventi di una partita già terminata non aggiorna le statistiche finché non si preme uno dei due pulsanti. Quando si correggono dati a mano via script, riallineare anche la copia nell'evento (vedi `App/CLAUDE.md`, sezione 2026-11-09).
- Il secondo giallo chiede conferma ("Sì, espelli") in Live e nell'inserimento manuale; avviso inline nel modale, non un secondo Modal (iOS).

## Interventi sui dati già fatti
- 2026-10-05: lati casa/trasferta di Live riallineati con `migrate-live-sides.js` (backup in `App/logs/`).
- 2026-11-09: Montone-Ellera (evento `1787576246135-2026-11-08-14:30-t7xf`): aggiunto il cambio 54' Convito→Roticiani e riallineata la copia dell'evento (backup `App/logs/backup-montone-cambio-*.json`).
