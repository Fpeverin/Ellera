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

L'app ha un account/squadra condivisa (Supabase): tutti i dati (calendario, rosa, tattiche, dati
live-partita, archivio) sono legati all'account e sincronizzati tra dispositivi, non più solo sul
telefono/tablet di chi li ha creati. C'è gestione utenti con ruoli admin/staff, invito tramite codice,
ed export/import Excel per rosa e calendario. Il backlog qui sotto è vuoto: aggiungici pure la
prossima idea non appena viene in mente.

## Backlog

- **Notifiche push**: promemoria automatici sul device in base al ruolo, a partire da un promemoria
  alle 09:00 del giorno stesso per ogni evento (partita, allenamento, scadenza). Richiede
  `expo-notifications` + un push token per utente/device salvato su Supabase, e capire come inviarle
  (scheduled locali vs. invio da un job/edge function).

- **Sondaggi staff → giocatori**: uno dello staff invia un sondaggio ai giocatori (stato di salute,
  livello di allenamento, quanto si sentono stanchi, infortuni, assenze); le risposte devono generare
  una notifica push allo staff. Richiede uno schema per domande/risposte e si appoggia alle notifiche
  push del punto precedente.

- **Convocazione partita da app**: portare la gestione dei convocati fuori dalla sezione Live (oggi è
  dentro `formazione.tsx`), come sezione autonoma visibile allo staff che poi *alimenta* la Live
  (non viceversa). Deve riprodurre un modello di convocazione in PDF che Francesco fornirà come
  esempio. All'invio della convocazione, notifica push ai giocatori convocati.

## In corso

*(vuoto — si popola quando iniziamo davvero il prossimo punto del backlog)*

## Completato

### 2026-07-28 — Rebranding: nome app "TeamBoard" e nuova icona
Il nome che compare sotto l'icona sul telefono/tablet è cambiato da "ElleraApp" a "TeamBoard" — un
nome legato al calcio/alla gestione squadra ma non al nome della società, per scelta di Francesco.
Nuova icona: pallone da calcio su un campo, negli stessi colori verdi già usati nell'app. **Richiede
una nuova build** (non arriva via aggiornamento automatico OTA, va reinstallato l'APK — vedi
`App/CLAUDE.md`, sezione "Come rilascio una modifica").

### 2026-07-28 — Regole di partecipazione Under/Over per competizione
Pensato per l'Eccellenza Umbra: si possono impostare, per una competizione (da Partite → filtro →
"⚙️ Regole"), soglie del tipo "almeno N giocatori in campo nati nell'anno X o dopo" (Under) o "o
prima" (Over) — un giocatore molto giovane soddisfa più soglie Under insieme (es. 3 giocatori classe
2008 rispettano anche le soglie 2006/2007).
- In **Formazione** compare un pannello sempre visibile con lo stato di ogni soglia (✅/❌ e conteggi)
  — non blocca la composizione perché lì non esiste un salvataggio esplicito.
- In **Live**, il bottone **"Start"** si blocca con un messaggio chiaro se l'11 titolare non rispetta
  le regole, e ogni **sostituzione** che porterebbe l'11 in campo fuori regola viene rifiutata con lo
  stesso tipo di messaggio.
- Un giocatore **espulso** (cartellino rosso) continua a contare ai fini della regola per il resto
  della partita anche se non più fisicamente in campo — solo una sostituzione vera lo toglie dal
  conteggio. Schema `App/supabase/11_schema_competition_rules.sql`.

### 2026-07-28 — Data di nascita completa (al posto del solo anno)
Nell'aggiunta di un nuovo giocatore e nella modifica dati anagrafici, "Anno di nascita" è diventato
"Data di nascita" completa (giorno/mese/anno), scelta con un mini-calendario a comparsa. La vecchia
colonna "anno" resta e viene calcolata da sola dalla nuova data ogni volta che si salva, quindi
filtri Rosa/export Excel/Archivio continuano a funzionare come prima senza bisogno di toccarli — solo
non hanno ancora la data completa disponibile (restano legati al solo anno). Schema
`App/supabase/10_schema_player_dob.sql`.

### 2026-07-28 — Modifica dati anagrafici giocatore (Ruolo/Anno/Altezza/Peso)
- **Admin e Staff**: possono modificare ruolo, anno di nascita, altezza e peso di qualunque
  giocatore, dalla sua scheda — salvataggio diretto, subito effettivo.
- **Giocatore**: vede questa sezione solo sulla scheda del giocatore a cui è collegato (il proprio) e
  può solo *proporre* una modifica — resta in attesa finché Staff o Admin non la conferma (applica i
  cambiamenti) o rifiuta. La proposta compare direttamente in quella stessa scheda quando Staff/Admin
  la aprono, con Conferma/Rifiuta. Non può proporne una seconda finché quella in corso non è stata
  decisa. Schema `App/supabase/9_schema_player_edits.sql` (tabella `player_edit_requests`, stesso
  pattern di `match_event_proposals`).

### 2026-07-28 — Selezione multipla nella Rosa (Staff/Admin) + eliminazione ex giocatori
- Da Rosa, bottone "☑️ Seleziona": tocca più giocatori (attivi **o** ex) e poi "🔄 Sposta tra ex" o
  "🗑️ Elimina" dalla barra in basso — stessa distinzione ex/eliminazione definitiva del menu su
  singolo giocatore, solo applicata a un gruppo intero. Nell'eliminazione multipla i giocatori già in
  una partita di questa stagione vengono saltati automaticamente (mai un errore in blocco che ferma
  tutto) e segnalati a parte per nome, con lo stesso suggerimento di spostarli tra gli ex.
- **Ex giocatori ora gestibili**: prima non c'era alcun modo di eliminarli — tenendo premuto su un ex
  giocatore compare "Elimina giocatore" (niente "Sposta tra ex", ovvio, ci è già).
- **Fix grafico**: la barra di selezione multipla in basso ora rispetta l'inset di sicurezza inferiore
  del dispositivo (`useSafeAreaInsets`) invece di un padding fisso — su alcuni tablet con barra di
  navigazione di sistema più alta i pulsanti risultavano coperti.

### 2026-07-28 — Rimossi i tool di import dati locale (una tantum, ormai usati)
Tutti i dati che esistevano solo sul tablet (calendario ed archivio stagioni) sono stati caricati su
Supabase con successo. Rimossi `app/utils/importLocalEvents.ts` e `app/utils/importLocalArchives.ts`
insieme ai relativi avvisi in Dashboard e Archivio Stagioni, e la costante `LEGACY_STORAGE_KEY` ormai
inutilizzata in `app/data/events.ts` — non servono più.

### 2026-07-28 — Import archivio stagioni locale + blocco eliminazione giocatori in partita
- **Import una tantum archivio stagioni**: l'Archivio Stagioni esisteva già in locale (AsyncStorage)
  prima di Supabase — quello storico non era mai stato portato sul database condiviso. Aggiunto lo
  stesso pattern già usato per il calendario: se un dispositivo ha ancora archivi salvati localmente e
  la squadra su Supabase non ne ha nessuno, la schermata Archivio Stagioni propone di caricarli (mai
  in automatico). *(Rimosso poco dopo, vedi voce sopra, una volta completata l'importazione reale.)*
- **Rosa**: un giocatore che ha già preso parte a una partita della stagione corrente (gol, cartellino,
  sostituzione o solo convocazione) non può più essere eliminato del tutto dalla Rosa — solo spostato
  tra gli ex. Le stagioni già archiviate non contano ai fini del controllo. Aggiunta anche una conferma
  esplicita prima di un'eliminazione definitiva (prima non c'era).

### 2026-07-28 — Ruoli utente a 3 livelli (Admin/Staff/Giocatore) + inviti personali
- Terzo ruolo **Giocatore**: sola lettura su Rosa/Calendario/Allenamenti/Partite/Live; in una Live
  può **proporre** un gol o un cartellino (stessa modale di sempre, bottone "Proponi" al posto di
  "Salva") — la proposta resta in `match_event_proposals` con stato `pending` finché Staff/Admin non
  la conferma (viene accodata a gol/cartellini reali) o rifiuta, da una nuova sezione "Proposte in
  attesa" nella Live. Non vede Moduli/Tattiche/Statistiche/Archivio/Staff.
- **Niente più codici invito condivisi**: ogni codice è personale, generato dall'admin per una
  persona precisa.
  - *Giocatore*: si genera dalla scheda di quel giocatore in Rosa (`app/player/[id].tsx`, solo
    admin) — chi lo riscatta si collega automaticamente a quella riga della rosa
    (`memberships.player_id`). Non è possibile "essere Giocatore" senza corrispondere a un giocatore
    reale già in rosa.
  - *Staff*: si genera da Gestione Squadra → Staff dando solo un nome libero (la persona non è
    ancora registrata in quel momento).
  - Chi riceve un codice si registra e poi lo inserisce in onboarding ("Ho un codice personale")
    invece di creare/entrare in una squadra col vecchio flusso.
- Schema aggiuntivo `App/supabase/8_schema_roles.sql`: tabella `invites` (accesso solo tramite funzioni
  `security definer` — `create_player_invite`, `create_staff_invite`, `list_pending_invites`,
  `revoke_invite`, `redeem_invite`), helper `is_staff_or_admin_of`, e split delle policy RLS di tutte
  le tabelle dati esistenti in lettura (chiunque sia membro) / scrittura (solo Staff/Admin).
- `app/squadra/staff.tsx` aggiornata con "Inviti in attesa" (Condividi/Revoca) e cambio ruolo a 3 vie.

### 2026-07-28 — Gestione staff (lato admin)
- Nuova schermata `app/squadra/staff.tsx` (visibile solo all'admin, con una card dedicata in
  "Gestione Squadra"): mostra il codice invito della squadra con un bottone "Condividi" e uno
  "Rigenera" (invalida il vecchio codice), e l'elenco di chi è nella squadra con email e ruolo.
- L'admin può cambiare il ruolo (staff↔admin) o rimuovere chiunque tranne se stesso — niente rischio
  di restare senza admin o di auto-escludersi per errore.
- Tre nuove funzioni SQL (`App/supabase/7_schema_staff.sql`): `list_org_members` (unica via per leggere
  le email dei membri, dato che il client non può interrogare `auth.users` direttamente),
  `update_member_role`, `remove_member`, `regenerate_invite_code`.

### 2026-07-28 — Rosa non più hardcoded + import/export XLSX (rosa e calendario)
- **Rosa non più scritta nel codice**: i 29 giocatori attivi + 4 ex che vivevano in
  `app/data/players.ts` sono stati spostati (una tantum, script `6_seed_ellera_roster.sql`) dentro la
  tabella `players` su Supabase e rimossi dai sorgenti — restano solo i tipi `Player`/`Role`. Effetto
  collaterale positivo: prima solo i giocatori aggiunti a mano erano modificabili/cancellabili dalla
  Rosa, ora lo sono tutti allo stesso modo (`app/hooks/usePlayers.ts` semplificato,
  `removeCustomPlayer` rinominato `removePlayer`).
- **Import/Export Excel (XLSX) della Rosa** (`app/data/rosterFile.ts`, azioni in `rosa.tsx`):
  esporta tutta la rosa (attivi+ex) con Nome/Ruolo/Anno/Altezza/Peso/Stato; l'import riconosce lo
  stesso giocatore **per nome**, aggiunge i nuovi e aggiorna i campi cambiati (compreso lo Stato
  attivo/ex, letto dal file). I giocatori attivi **assenti dal file** non vengono mai toccati in
  automatico: prima di applicare l'import viene mostrata una schermata di riepilogo dove si sceglie,
  uno per uno, chi spostare tra gli ex.
- **Import/Export Excel del Calendario** (`app/data/calendarFile.ts`): partite esportabili/importabili
  **per competizione** (da `partite.tsx`, richiede una competizione specifica selezionata, non
  "tutte"); allenamenti in un file separato (da `allenamenti.tsx`). Il riconoscimento di "stessa
  partita" è per avversario+casa/trasferta dentro la competizione (l'avversario di solito non cambia,
  mentre data/ora/luogo sì); per gli allenamenti è data+ora. Su un evento già esistente l'import
  aggiorna **solo** i campi di calendario, mai punteggio/formazione/cartellini/eventi live già
  registrati.
- Nuova dipendenza `xlsx` (SheetJS, pura JS).

### 2026-07-27 — Dati condivisi su Supabase: ultimi 3 domini (Fase 3) — TUTTO ora su Supabase
Con questa fase **tutti** i dati dell'app vivono su Supabase: non resta più nulla di importante solo
sul dispositivo (a parte impostazioni locali minori tipo l'ultimo tocco per il refresh).

- **Archivio stagioni**: `seasons/archive/index` + `seasons/archive/{id}` → tabella `season_archives`
  (un `data` jsonb con l'intero snapshot stagione, com'era già prima — nessuna normalizzazione in più).
- **Moduli personalizzati**: `modules/custom` → tabella `modules`, chiave naturale = nome (come si
  comportava già l'app). **Tattiche/lavagna tattica**: `tactics/custom` → tabella `tactics`; la preview
  (prima un'immagine PNG base64 incorporata nel JSON) ora è su **Supabase Storage** (bucket pubblico
  `tactic-previews`), più leggero e sincronizzato tra dispositivi.
- **Dati live-partita** (il dominio più complesso): le 9 chiavi per-partita di prima (gol, sostituzioni,
  cartellini, formazione, posizioni live, timer, tattiche assegnate) diventano **una sola riga per
  partita** nella tabella `match_live`. Nuovo modulo `app/data/matchLive.ts` con funzioni get/set per
  ciascun "pezzo" (stessa granularità di prima, solo lato Supabase). Tocca soprattutto `live.tsx` (il
  file più grande dell'app), oltre a `formazione.tsx` e `tattiche.tsx` di partita.
- **Corretto un piccolo bug di pulizia dati**: quando si archivia una stagione, prima restavano orfane
  le chiavi `match/{id}/positions` e `match/{id}/tacticsAssignments` (mai cancellate). Ora sparisce
  tutto insieme cancellando la riga `match_live` della partita.
- Dettagli tecnici: tre script SQL aggiuntivi in `App/supabase/` (`3_schema_archive.sql`,
  `4_schema_modules_tactics.sql`, `5_schema_match_live.sql`), da eseguire una volta ciascuno dopo quelli
  delle fasi precedenti.

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
- Dettagli tecnici: schema aggiuntivo in `App/supabase/2_schema_players.sql` (da eseguire una volta in
  più, dopo `1_schema.sql`).

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
- Dettagli tecnici: schema SQL in `App/supabase/1_schema.sql`, client in `App/app/lib/supabase.ts`.

### 2026-07-26/27 — Aggiornamento Expo SDK 57 e automazione rilasci
- Portato Expo da SDK 53 a SDK 57 (React Native 0.79 → 0.86), passaggio al workflow CNG (niente più
  cartella `android/` committata), rimossa dipendenza morta `react-native-uuid`.
- Configurato EAS Update (OTA) + EAS Workflows: ogni push su `main` pubblica da solo l'aggiornamento,
  build nativa nuova solo quando serve (workflow manuale).
- Pulizia file inutilizzati (boilerplate del template Expo mai usato).
- Dettagli completi in [CLAUDE.md](CLAUDE.md).
