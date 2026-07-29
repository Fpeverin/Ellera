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

- **Sondaggi staff → giocatori**: uno dello staff invia un sondaggio ai giocatori (stato di salute,
  livello di allenamento, quanto si sentono stanchi, infortuni, assenze); le risposte devono generare
  una notifica push allo staff. **Nota tecnica**: è una notifica *tra utenti diversi* (il giocatore che
  risponde deve avvisare lo staff, su un altro dispositivo), quindi non basta il meccanismo dei
  promemoria eventi già fatto (quello è solo locale, ogni dispositivo avvisa se stesso) — serve
  registrare e salvare su Supabase il push token Expo di ciascun account (`expo-notifications` è già
  installato) e inviare da client all'API pubblica di Expo (`exp.host/--/api/v2/push/send`) verso i
  token dello staff, senza bisogno di un server dedicato.

- **Notifica invio convocazione ai giocatori convocati** (rimasto dal punto "Convocazione partita da
  app", ora completato — vedi Completato — tranne questa parte): quando la convocazione è pronta,
  notifica push ai giocatori convocati. Stessa nota tecnica del punto sopra: serve il push token
  per-utente (notifica verso *altri* dispositivi), non i promemoria locali già implementati.

- **Notifica proposte Live all'admin/staff** (richiesta precedente di Francesco, ancora da fare):
  quando un giocatore propone un gol/cartellino da Live, notifica push allo staff/admin di quella
  squadra. Stessa nota tecnica: serve il push token per-utente.

## In corso

*(vuoto — si popola quando iniziamo davvero il prossimo punto del backlog)*

## Completato

### 2026-07-29 — Scollega account giocatore
Sulla scheda di un giocatore già collegato a un account, l'Admin ora vede anche un bottone "🔓
Scollega account" (con conferma): rimuove quella persona dalla squadra e libera il collegamento, per
poter generare un nuovo codice allo stesso giocatore in seguito — utile ad esempio per ripulire un
account di test. Non cancella l'account Supabase stesso (va fatto dalla dashboard).

### 2026-07-29 — SMTP esterno (SendGrid) configurato e funzionante
Il servizio email gratuito integrato di Supabase (limitato a poche email/ora) è stato sostituito con
SMTP personalizzato via **SendGrid** (piano gratuito, verifica del mittente senza bisogno di un
dominio proprio — "Single Sender Verification"). Diagnosticato un errore 500 in registrazione dovuto
a una configurazione SMTP iniziale sbagliata (nessuna modifica di codice: solo impostazioni sulla
dashboard Supabase, Authentication → Emails → SMTP Settings). Ora la registrazione di nuovi account
funziona regolarmente, senza il limite di invii del piano gratuito integrato.

### 2026-07-29 — Mostra/nascondi password
Aggiunta un'icona 👁️ sui campi password di Login e Registrazione per vederle in chiaro mentre si
digitano (tocca di nuovo per rinascondere).

### 2026-07-29 — Convocazione partita + Rosa Staff categorizzata
Portata la gestione dei convocati fuori da Formazione in un tab autonomo per-partita ("Convocazione",
visibile solo a Staff/Admin), che riproduce la scheda usata dal club (Excel condiviso da Francesco):
- Elenco **giocatori convocati** (Rosa in ordine alfabetico) e **staff convocato**, diviso nelle 3
  categorie **Tecnico / Sanitario / Dirigenziale** — introdotta una vera Rosa Staff (nome + categoria
  + ruolo), indipendente dagli account, sullo stesso principio della Rosa giocatori.
- **Ritrovo** (testo libero) e **riepilogo conteggi** per categoria.
- **Menu pranzo**: piatti disponibili modificabili ad ogni convocazione, scelta per ciascun
  convocato, tutto **prepopolato dall'ultima convocazione fatta** (piatti e scelte), poi lo staff
  aggiusta quello che serve — su richiesta esplicita di Francesco.
- **Esporta PDF** della scheda completa.
- I giocatori convocati qui **alimentano** Formazione (che non gestisce più i convocati in proprio) e
  Live; una modifica "dell'ultimo secondo" ai convocati resta sempre possibile da Live, prima di
  Start.

**Non incluso in questo giro** (segnalato esplicitamente): la notifica push ai convocati (serve
un'infrastruttura di push token non ancora costruita, vedi Backlog) e il collegamento tra un membro
della Rosa Staff e un account app (oggi non richiesto — chi non userà mai l'app comparirà comunque
nelle convocazioni).

### 2026-07-29 — Fix critico: gli aggiornamenti OTA non arrivavano mai (runtimeVersion)
Scoperto perché, nonostante la GitHub Action per l'OTA automatico partisse correttamente, Francesco
non vedeva mai le novità sul telefono: `runtimeVersion` era calcolata automaticamente
("fingerprint") e veniva calcolata **diversa** a seconda di dove giravo `eas update` (computer
locale, GitHub Action, server di build Expo) — un problema noto quando si pubblica da più ambienti.
Ogni aggiornamento pubblicato dalla GitHub Action veniva quindi scartato in silenzio dal telefono
(etichetta di compatibilità diversa da quella dell'APK installato). Fix: `runtimeVersion` ora è una
stringa fissa in `app.json`, uguale in ogni ambiente. **Serve un'ultima nuova build/reinstallazione
dell'APK** per allineare tutto, poi il problema non si ripresenterà più.

### 2026-07-29 — Fix Import/Export Partite con filtro "Tutte"
I bottoni Esporta/Importa/Modello in Partite sparivano del tutto con il filtro "Tutte" (visibili
solo con una competizione specifica selezionata) e, quando visibili, l'export scriveva la stessa
competizione su ogni riga anche se le partite erano di competizioni diverse. Corretto: ora sempre
visibili con qualsiasi filtro, e la competizione di ogni partita viene letta/scritta riga per riga
(colonna "Competizione" del file) invece che dal filtro selezionato — un unico file può quindi
contenere partite di più competizioni insieme. Resta legato a una competizione specifica solo il
bottone "⚙️ Regole" (le regole Under/Over si applicano per competizione).

### 2026-07-29 — Ridisegno Dashboard/Home
Su richiesta di Francesco, rivista tutta la prima schermata dell'app:
- Nuovo blocco **"Oggi e domani"** (impegni del giorno stesso e di domani, colonne cliccabili) subito
  sotto l'header, prima del calendario mensile — che resta centrale ma non è più l'unica cosa in
  cima. Sostituisce la vecchia lista "Prossimi eventi" (a volte nascosta su schermi piccoli).
- Tolti il titolo "Dashboard Calcistica" (sostituito dal nome della squadra) e la scritta
  "Calendario" sopra la griglia mensile — ridondanti, occupavano solo spazio.
- Tolte le icone 📤/📥 di backup/import JSON locale: non servono più, i dati vivono tutti su
  Supabase da tempo.
- **Azioni rapide differenziate per ruolo**: per il Giocatore, "Gestione Squadra" (che per lui
  mostrerebbe comunque solo la card Rosa) diventa un tasto diretto **"Rosa"**.
- **Corretto un bug di permessi**: toccare un giorno nel calendario apriva sempre la creazione di un
  nuovo evento, anche per un account Giocatore (sola lettura in tutto il resto dell'app) — ora il
  tocco non fa nulla per quel ruolo.
- Bottone **👤 Account** nell'header (con etichetta visibile, non solo icona) che mostra email/ruolo
  dell'account e permette di uscire (con conferma) — prima non esisteva alcun modo di uscire
  dall'account una volta entrati in una squadra, impossibile ad esempio provare un secondo account
  sullo stesso dispositivo.

### 2026-07-29 — OTA automatico: da EAS Workflow (mai partita) a GitHub Action
La EAS Workflow nativa (`App/.eas/workflows/update-on-push.yml`), pensata per pubblicare da sola un
aggiornamento OTA a ogni push su GitHub, non è mai partita nonostante il repo risultasse
correttamente collegato su expo.dev (verificato con due push di prova e la documentazione ufficiale
Expo — nessuna causa individuabile lato nostro). Sostituita con una **GitHub Action**
(`.github/workflows/eas-update.yml`): stesso risultato per chi usa l'app, ma il trigger è nativo di
GitHub (non dipende dal collegamento EAS↔GitHub) e le esecuzioni si vedono direttamente nella tab
**Actions** del repository. **Verificato funzionante** il 2026-07-29: dopo la configurazione dei
segreti su GitHub, un push di prova ha fatto partire l'Action da sola e pubblicato l'aggiornamento —
l'automazione OTA ora funziona davvero end-to-end.

### 2026-07-29 — Modello scaricabile per ogni import Excel
Accanto a "📥 Importa Excel" (Rosa, Partite, Allenamenti) c'è ora un bottone **"📄 Modello"**: scarica
un file XLSX di esempio, diverso per ciascuna sezione, con le colonne corrette già intestate, 2-3
righe di esempio compilate e un foglio "Istruzioni" che spiega ogni colonna/i valori ammessi — per
aiutare a capire come preparare il file da importare senza doverlo indovinare dall'export.

### 2026-07-28 — Promemoria push per allenamenti/partite (solo Giocatore)
Ogni account con ruolo **Giocatore** riceve un avviso sul telefono alle **09:00 del giorno stesso** di
ogni allenamento o partita in calendario (non per altri tipi di evento, e non per Staff/Admin — su
loro richiesta esplicita). Sono promemoria **locali**: ogni dispositivo li pianifica da solo in base
al calendario che legge da Supabase (`app/utils/eventReminders.ts`), senza bisogno di un server o di
un push token — costo zero, nessuna nuova infrastruttura. Si ripianificano automaticamente ogni volta
che si apre la Dashboard (così un evento spostato/cancellato aggiorna anche il promemoria) e vengono
cancellati al logout. Aggiunta la dipendenza nativa `expo-notifications` — **richiede una nuova build**
(non arriva via OTA).

**Da tenere presente**: questo meccanismo copre solo i promemoria che un utente manda "a se stesso".
Le prossime richieste in Backlog (notifica allo staff per un sondaggio/una proposta Live, notifica ai
convocati) sono notifiche *verso altri utenti* e servono un pezzo in più (push token salvato per
account) — vedi note tecniche nel Backlog qui sopra.

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
