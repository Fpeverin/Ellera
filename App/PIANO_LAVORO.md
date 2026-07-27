# ElleraApp — Piano di lavoro

Documento vivo: qui dentro finiscono le idee non appena vengono in mente (anche non ordinate/non
dettagliate), e via via che le realizziamo le spostiamo in fondo con **data** e **come è stato fatto**.
Non serve scrivere qui i dettagli tecnici di implementazione minuti: quelli stanno nel codice/commit;
qui basta capire cosa è stato deciso e perché.

## Come si usa
- **Backlog**: idee/richieste non ancora avviate, in qualunque ordine. Aggiungile pure grezze, le
  ordiniamo/dettagliamo quando ci arriviamo.
- **In corso**: cosa stiamo sviluppando adesso.
- **Completato**: cronologia con data, cosa è cambiato e come (in breve).

## Visione generale

Oggi l'app è installata solo da Francesco, su un tablet e uno smartphone Android, con i dati salvati
solo sul dispositivo (`AsyncStorage`) — per questo tablet e telefono hanno dati diversi. L'obiettivo dei
prossimi sviluppi è passare a dati condivisi e legati a un account, con più persone (staff tecnico)
che potranno usare l'app in futuro con ruoli diversi (admin vs utente normale).

## Backlog

### 1. Migrare a Supabase gli ultimi domini rimasti
Stesso pattern già validato con Eventi e Giocatori: una tabella + `org_id` + Row Level Security,
funzioni di data-access con la stessa firma di prima così le schermate cambiano il meno possibile.

- **Dati live-partita** (il più complesso dei tre — merita una sessione dedicata tutta sua). Oggi sono
  9 chiavi AsyncStorage separate per partita: `matches/goals/{id}`, `matches/subs/{id}`,
  `matches/cards/{id}`, `match/{id}/lineup`, `match/{id}/positions`, `live/formation/{id}`,
  `live/started/{id}`, `live/timerState/{id}`, `match/{id}/tacticsAssignments`. Diventano **una riga
  per partita** in una tabella `match_live` (`event_id` = id dell'evento partita, `org_id`, e una
  colonna jsonb per ciascuno dei gruppi sopra: `goals`, `subs`, `cards`, `lineup`, `positions`,
  `live_formation`, `timer_state`, `tactics_assignments`, più `started boolean`). Un nuovo modulo
  `app/data/matchLive.ts` espone le stesse funzioni granulari usate oggi (goals/subs/cards/lineup/
  timer) ma come update mirati di singole colonne della riga, invece di 9 chiavi separate. Tocca
  soprattutto `live.tsx`, `formazione.tsx`, `tattiche.tsx` (partita), `player/[id].tsx` (statistiche).
- **Moduli personalizzati e tattiche/lavagna tattica**: `modules/custom` → tabella `modules` (id, org_id,
  name, slots jsonb); `tactics/custom` → tabella `tactics` (id, org_id, name, elements jsonb, preview
  testo/immagine). Tocca `app/moduli/*`, `app/squadra/tattiche/*`.
- **Archivio stagioni**: `seasons/archive/index` + `seasons/archive/{id}` → un'unica tabella
  `season_archives` (id, org_id, label, archived_at, `data` jsonb con l'intero snapshot stagione —
  è già un blob unico oggi, la migrazione è la più semplice delle tre). Tocca `app/squadra/archivio*`.

### 2. Gestione staff (lato admin)
Schermata per l'admin per vedere chi è nella squadra, cambiare ruoli, rimuovere una persona, rigenerare
l'invite code.

### 3. Rimuovere i dati "di default" scritti nel codice
Rosa giocatori in `app/data/players.ts`, moduli/tattiche predefiniti — una volta che tutti i domini
vivono davvero nel backend, non ha più senso avere una rosa hardcoded nei sorgenti. *Dipende dal
punto 1 (in particolare dalla migrazione Giocatori, già fatta, e da quella dei Moduli).*

### 4. Import/Export massivo CSV/XLSX per la Rosa
Esportare l'intera rosa (attivi + ex) in CSV/XLSX, e poterla reimportare **lavorando per differenze**:
i giocatori nuovi nel file vengono aggiunti, quelli già esistenti (stesso id o stesso nome?) vengono
aggiornati sui campi cambiati, non un "cancella tutto e ricrea". Da definire nel dettaglio quando ci
arriviamo: come si riconosce "lo stesso giocatore" tra rosa attuale e file importato, e cosa succede ai
giocatori presenti in rosa ma assenti dal file (restano, vengono spostati ex, o segnalati per conferma).

### 5. Import/Export massivo CSV/XLSX per il Calendario
Stessa idea per il calendario, **diviso per competizione** (un export/import per competizione, non
uno unico per tutto il calendario). Deve coprire anche gli **allenamenti**, che oggi sono già visibili
nel calendario insieme alle partite (`app/calendario.tsx`) e già creabili manualmente dall'utente
(`EventEditorModal`) — l'obiettivo è aggiungere la possibilità di crearli/aggiornarli anche in massa via
file, non sostituire la creazione manuale che resta com'è.

## In corso

*(vuoto — si popola quando iniziamo davvero il prossimo punto del backlog)*

## Completato

### 2026-07-27 — Dati condivisi su Supabase: Giocatori/Rosa + foto/allegati/infortuni (Fase 2)
- Migrata la rosa (giocatori aggiunti manualmente + ex giocatori) da `AsyncStorage` a una tabella
  `players` su Supabase (colonna `is_ex` invece di due chiavi separate) — il roster di base scritto nel
  codice (`app/data/players.ts`) resta com'è per ora, si somma a quello custom come prima.
  `usePlayers()` ha la stessa identica interfaccia pubblica di prima.
- Foto profilo e allegati (documenti/certificati) ora vanno su **Supabase Storage** (bucket pubblici,
  URL stabili non elencati pubblicamente) invece che come file locali sul device — sincronizzati tra
  tablet e telefono come tutto il resto.
- Nuovo modulo condiviso `app/data/playerMedia.ts` per foto/allegati/tipologia infortuni, usato da
  `player/[id].tsx`, `rosa.tsx`, `statistiche.tsx`, `archiveBuilder.ts`.
- **Bug corretto**: la lavagna tattiche di una singola partita (`eventi/partita/[id]/tattiche.tsx`)
  leggeva il roster statico invece dei giocatori reali della squadra — i giocatori aggiunti a mano non
  comparivano mai lì. Ora usa `usePlayers()` come le altre schermate.
- Dettagli tecnici: schema aggiuntivo in `App/supabase/schema_players.sql` (da eseguire una volta in
  più, dopo `schema.sql`).

### 2026-07-27 — Dati condivisi su Supabase: autenticazione + squadre + Eventi/Calendario (Fase 1)
- Aggiunto un vero backend (Supabase: Postgres + Auth + Row Level Security), **piano gratuito** —
  nessun costo finché l'uso resta a poche persone.
- **Login/registrazione** (email+password) e modello **multi-squadra**: dopo la registrazione si crea
  una nuova squadra (si diventa admin) oppure si entra in una esistente con un codice invito condiviso
  dall'admin. Pensato fin da subito per poter dare l'app anche ad altre squadre in futuro, non solo
  Ellera.
- Migrato il dominio **Eventi/Calendario** (partite + allenamenti) da `AsyncStorage` locale a Supabase:
  `loadEvents()`/`saveEvents()` in `app/data/events.ts` hanno la stessa firma di prima, cambia solo la
  sorgente dati sotto — tutte le schermate (Dashboard, Calendario, Allenamenti, Partite, Live, ecc.)
  continuano a funzionare come prima ma ora vedono gli stessi dati da qualunque dispositivo collegato
  allo stesso account.
- **Importazione dati locali una tantum**: se un dispositivo ha ancora eventi salvati alla vecchia
  maniera e la squadra su Supabase non ha ancora nessun evento, viene chiesto esplicitamente (Sì/No) se
  caricarli — mai in automatico, per evitare che un device con dati vecchi/di test sovrascriva quelli
  buoni di un altro device.
- Tutti gli altri domini (rosa/foto, dati live-partita, moduli, tattiche, archivio stagioni) **restano
  ancora locali** in questa fase — migrazione pianificata nel Backlog qui sopra, un dominio alla volta.
- Dettagli tecnici: schema SQL in `App/supabase/schema.sql`, client in `App/app/lib/supabase.ts`.

### 2026-07-26/27 — Aggiornamento Expo SDK 57 e automazione rilasci
- Portato Expo da SDK 53 a SDK 57 (React Native 0.79 → 0.86), passaggio al workflow CNG (niente più
  cartella `android/` committata), rimossa dipendenza morta `react-native-uuid`.
- Configurato EAS Update (OTA) + EAS Workflows: ogni push su `main` pubblica da solo l'aggiornamento,
  build nativa nuova solo quando serve (workflow manuale).
- Pulizia file inutilizzati (boilerplate del template Expo mai usato).
- Dettagli completi in [CLAUDE.md](CLAUDE.md).
