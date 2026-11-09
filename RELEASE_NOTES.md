# Release notes — TeamBoard (app di gestione squadra Ellera)

Storia delle modifiche rilasciate, la più recente in cima, raggruppate per data (le versioni non sono numerate). Il dettaglio tecnico di ogni modifica è in `App/CLAUDE.md` e `App/PIANO_LAVORO.md`.

L'app si aggiorna da sola: ogni push su `main` pubblica l'aggiornamento per Android (OTA) e per la webapp.

## 2026-11-09

### Live: errori sui cartellini non bloccano più le sostituzioni
- **Corretto**: eliminando un'espulsione (per esempio un'ammonizione messa per sbaglio) il giocatore ora torna in campo; prima restava "fuori" e non si poteva sostituire (Montone-Ellera, Convito).
- **Corretto**: il rosso automatico del secondo giallo segue i gialli: eliminando i gialli in eccesso sparisce anche il rosso, e c'è un solo rosso per giocatore.
- **Corretto**: l'inserimento manuale di un cambio funziona anche a partita finita o con la formazione di Live sbagliata, senza richiedere chi è "in campo" e chi "in panchina".
- **Novità**: registrando una seconda ammonizione a un giocatore compare un avviso ("verrà espulso, confermi?"), sia in Live sia nell'inserimento manuale.
- **Corretto**: "Termina partita" e "Termina/aggiorna partita senza cronometro" ricalcolano sempre le statistiche di quella partita partendo dai dati reali (prima la copia usata dalle statistiche poteva restare indietro, come i minuti dopo un cambio inserito a posteriori). Il pulsante "Termina/aggiorna" è ora disponibile anche a partita già terminata.

### Sincronizzazione TuttoCampo
- **Corretto**: dopo un cambio di TuttoCampo il sync delle 09:30 non salvava più nessun risultato (16 partite su 16 scartate) e finiva senza segnalare errori. Ora legge di nuovo tutte le partite.
- **Corretto**: i marcatori delle partite senza tabellino non includono più gli assist come se fossero gol; sono nel formato `11' pt M. Branchesi (Viv)` e in ordine di minuto.
- **Novità**: se il sito cambia di nuovo e nessuna pagina risulta leggibile, l'attività pianificata segna errore (prima risultava "riuscita").

## Storia precedente (ricostruita)

### 2026-10-05
- **Corretto**: in Live le partite giocate in casa mostravano Ellera come squadra ospite (Ellera-Padule 2-0 appariva 0-2). Corretti Live, Statistiche, scheda giocatore e archivio, e riallineati i dati già registrati (con backup).
- **Sync TuttoCampo**: risultato e marcatori anche per partite finite senza formazioni sul sito; log dell'esecuzione in `App/logs`.

### 2026-10-01
- **Novità**: Altre Partite si aggiorna da sola da TuttoCampo (Eccellenza Umbria Girone A) ogni mattina dal PC: squadre, risultato, marcatori e screenshot delle formazioni. Le righe importate non si modificano a mano.
- **Novità**: Staff "Sposta tra gli ex" (come i giocatori) e nuovo ruolo Collaboratore Tecnico; solo lo staff attivo è convocabile.
- **Novità**: `TEST_CASES.md`, elenco dei comportamenti attesi di ogni funzione.

### 2026-08-27 / 2026-08-28
- **Novità**: Lista Gara con Arbitro e due Assistenti, attivabili dall'Admin.
- **Corretto**: nei menu di Live comparivano ID al posto dei nomi per giocatori eliminati dalla rosa; un giocatore già in campo o in Lista Gara non si può più eliminare del tutto.

### 2026-08-24
- **Novità**: Calendario unico (allenamenti e partite), Competizione e Giornata sulle partite, sezione Altre Partite con allegati, pagina partita a 4 riquadri, squadre fisse per competizione con stemma e stadio, stemma avversario recuperato in automatico, colori per competizione sul calendario, stemmi nel tabellone Live.

### Prima del 2026-08-24
Non ricostruita qui: vedi `App/PIANO_LAVORO.md` (sezione Completato) e `App/CLAUDE.md`.
