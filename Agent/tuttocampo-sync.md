# Sync "Altre Partite" da TuttoCampo (App/scripts/sync-tuttocampo.js)

Aggiornato 2026-11-09. Dettaglio storico e motivazioni: `App/CLAUDE.md`, sezione "Sincronizzazione automatica Altre Partite da TuttoCampo".

## Cosa fa
Per ogni partita nostra di competizione "Campionato" con Giornata impostata e data entro ±7 giorni da oggi, scarica da TuttoCampo (Eccellenza Umbria Girone A) le partite di tutta la giornata e fa upsert in `matchday_fixtures` (id `tc-{competizione}-{giornata}-{casa}-{trasferta}`, `source='tuttocampo'`): squadre, risultato, marcatori, e uno screenshot di `#match_formations` come allegato. **Salta sempre le partite con "ellera"** (la nostra riga `own-{matchId}` è di Live). Le righe importate sono non modificabili a mano nell'app.

## Dove e quando gira
- **Sul PC di Francesco**, non su GitHub Actions: TuttoCampo restituisce pagine senza dati agli IP cloud dei runner (verificato 2026-10-01). Non riproporre GitHub Actions.
- Attività pianificata di Windows `TUTTOCAMPO_ELLERA`, ogni giorno 09:30, che lancia `App/scripts/run-sync-tuttocampo.ps1`. Il PC deve essere acceso.
- **Log**: `App/logs/sync-tuttocampo.log` (in coda, ignorato da git). Primo posto dove guardare quando manca un aggiornamento. L'esito dell'attività si legge con `Get-ScheduledTaskInfo -TaskName TUTTOCAMPO_ELLERA` (0 = ok).
- Per provarlo senza aspettare: `Start-ScheduledTask -TaskName 'TUTTOCAMPO_ELLERA'` (identico al lancio reale).

## Configurazione (non segreta)
`App/.env.sync-tuttocampo.local` (mai committato; modello in `App/.env.sync-tuttocampo.example`): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (**segreta**, solo lì), `TEAMBOARD_ORG_ID=9766a9e4-a82a-4913-b726-e03000f15079`, `TUTTOCAMPO_COMPETITION_NAME=Campionato` (deve combaciare col campo Competizione delle partite), `TUTTOCAMPO_LEAGUE_URL=https://www.tuttocampo.it/Umbria/Eccellenza/GironeA`.

## Come è fatto il sito (trappole già incontrate)
- Richieste con User-Agent di default di Playwright → **403**. Serve un context con User-Agent da Chrome desktop, locale `it-IT`.
- Le righe della giornata sono `<tr data-link="URL">`, **non** `<a href>`, e arrivano da una chiamata AJAX dopo il caricamento: aspettare `[data-link*="/Partita/"]` (script: 3 tentativi). `networkidle` da solo va in timeout per le pubblicità, quindi `loadPage()` usa `domcontentloaded` + attesa limitata.
- **2026-11-09**: il `<title>` delle pagine partita è passato da `X vs Y - Eccellenza ...` a `X - Y: risultato e marcatori | Eccellenza ...` e per questo ogni partita veniva scartata. Ora i nomi vengono dall'`<h1>` `Partita X vs Y` (rimasto stabile), con i due titoli come ripiego. Se riaccade, il log riporta titolo e h1 trovati.
- "Tabellino" (riga `MARCATORI:`, `#match-report`) compare solo se qualcuno inserisce formazioni/marcatori. Senza, il risultato è nell'intestazione (`Partita terminata N - N`) e i marcatori in `.match-scorers ul.home|away > li`: **primo `<a>` = marcatore**, un eventuale secondo `<a>` grigio ("Assist di ...") è l'assist e va ignorato. Lo screenshot formazioni si fa solo se c'è il tabellino.
- Partita non giocata: `#match_formations` esiste ma vuota. Per questo niente screenshot senza risultato/tabellino.

## Sicurezza dell'esito
Dal 2026-11-09, se nessuna pagina partita risulta leggibile lo script esce con codice 2 e scrive `ERRORE: ...` nel log (prima chiudeva con esito 0 senza aver salvato nulla). Non simulato su un caso reale: la logica è `unreadable > 0 && readable === 0`.

## Trappole dell'ambiente Windows di Francesco
- Il Chromium di Playwright va installato nel Windows reale con `npx.cmd playwright install chromium` (da una sua PowerShell, cartella `App`). Quello installato dall'AI nella propria sessione non è visibile a Task Scheduler (usciva con codice 1).
- `npx` in PowerShell è bloccato (`npx.ps1` non firmato): usare `npx.cmd`.
- Windows PowerShell 5.1: niente `&&`; i `.ps1` vanno scritti in ASCII (UTF-8 senza BOM con accenti rompe il parsing); il log mostra accenti storpiati (`├®`) solo come artefatto di codifica, i dati su Supabase sono corretti.
- Eliminare o modificare le attività pianificate create dall'utente può dare "Accesso negato" all'AI: lo deve fare lui da "Utilità di pianificazione".
