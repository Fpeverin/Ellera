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

- **Impaginazione del PDF Convocazione più fedele all'originale** (richiesta di Francesco del
  2026-07-30): l'attuale PDF è funzionale (solo convocati, loghi, dati partita) ma l'impaginazione va
  rifatta per assomigliare di più allo "Scheda Convocazione Ellera.xlsx" condiviso all'inizio — da
  rivedere font/layout/stile delle tabelle, non solo il contenuto.

- **Menu pranzo configurabile in Convocazione** (rimosso dalla UI il 2026-07-30 su richiesta di
  Francesco, da riprogettare): piatti disponibili e scelta per ciascun convocato. Deve essere "molto
  più configurabile" di come era stato costruito la prima volta — da ridiscutere il design prima di
  reintrodurlo (i campi `menuItems`/`meals` restano comunque nella colonna dati di ogni partita).

- **Webapp: lavagna tattica/moduli non reattivi al resize della finestra** (emerso lavorando sulla
  webapp, 2026-07-31): `app/squadra/tattiche/editor.tsx`, `app/moduli/editor.tsx` e
  `app/eventi/partita/[id]/tattiche.tsx` calcolano le dimensioni del campo una sola volta con
  `Dimensions.get('window')` al caricamento — su desktop, ridimensionare la finestra del browser
  dopo aver aperto la lavagna non aggiorna il layout (serve ricaricare la pagina). Non bloccante
  (il caricamento iniziale prende già la dimensione corretta), ma da rivedere con
  `useWindowDimensions()` quando si mette mano a queste schermate — richiede però di far passare le
  dimensioni ai componenti drag&drop del campo (oggi lette da costanti di modulo), non un cambio
  isolato.

## In corso

### Notifiche push tra utenti: Sondaggi, Convocazione, Proposte Live, Modifiche anagrafica (avviata 2026-07-31)
Prima infrastruttura di notifiche push **verso un altro utente** (finora solo promemoria locali,
`app/utils/eventReminders.ts`). Stato: **implementato, da eseguire gli script SQL e testare dal vero**
(nessun invio push remoto è mai stato provato finora su questa app).
- **Fondamenta**: `memberships.push_token` + RPC `register_push_token`/`get_notification_tokens`/
  `get_push_tokens_for_players`/`get_org_player_tokens` (`App/supabase/19_schema_push_tokens.sql`).
  Nuovo `app/data/pushNotify.ts` (`registerPushTokenForCurrentUser`, no-op sul web;
  `sendExpoPush`, fetch diretto verso l'API di Expo). Il token si registra da `app/index.tsx` per
  **tutti i ruoli** (non solo Giocatore).
- **Notifica Convocazione**: nuovo bottone "🔔 Notifica convocati" in Convocazione, separato da
  "Esporta PDF" come richiesto — invia ai convocati con token registrato.
- **Notifiche configurabili** (`App/supabase/20_schema_notify_config.sql`): due impostazioni Admin
  indipendenti in Gestione Squadra → Admin → Configurazioni — "Notifiche proposte Live" e "Notifiche
  modifiche giocatore" — ciascuna Solo Admin/Tutto lo Staff/Alcuni membri (nuovo componente
  `NotifyRecipientsPicker`, riusato anche nei sondaggi). Agganciate a `app/data/proposals.ts` e
  `app/data/playerEdits.ts` (notifica parte dal client di chi propone).
- **Sondaggi** (`App/supabase/21_schema_surveys.sql` + `22_schema_surveys_cron.sql`): nuova sezione
  "Sondaggi" in Gestione Squadra (Staff/Admin creano/modificano/vedono le risposte, Giocatore
  risponde), attivabile/disattivabile da Admin → Configurazioni. Domande a testo libero/scala 1-5/
  scelta singola. Invio subito (dal client), programmato o ricorrente ("ogni N giorni") — questi
  ultimi due gestiti **davvero** lato Supabase con `pg_cron`+`pg_net` (scatta anche se nessuno ha
  l'app aperta), non con un controllo "al prossimo che apre l'app". Ogni invio è un `survey_sends`
  a parte (i ricorrenti non mescolano le risposte tra un'occorrenza e l'altra). Notifica allo staff
  scelto (per sondaggio) quando un giocatore risponde.
- **Aggiunto dopo il primo test di Francesco (2026-07-31)**: non era chiaro "a chi arriva" il
  sondaggio — aggiunto un selettore **Destinatari** per sondaggio (Tutti i giocatori, comportamento
  di prima e default, oppure Solo alcuni scelti alla creazione), `App/supabase/
  23_schema_survey_recipients.sql` (colonne `notify_players_mode`/`notify_players_ids`, ridefinisce
  anche `process_due_surveys()` per rispettarle nei sondaggi programmati/ricorrenti).
- **Da fare (Francesco)**: eseguire in ordine su Supabase SQL Editor gli script `19`, `20`, `21`, `22`,
  `23` (il `22` attiva le estensioni `pg_cron`/`pg_net` — se il comando desse un permission error, il
  commento nello script indica il fallback da Dashboard → Database → Extensions).
- **Da verificare dal vero** (prima volta che questa app invia un push remoto, non solo locale):
  registrazione token su un dispositivo reale, notifica Convocazione, proposta Live con destinatari
  configurati, sondaggio "subito" e uno "programmato" a pochi minuti (chiudendo l'app per verificare
  che arrivi comunque via cron), risposta di un giocatore e relativa notifica allo staff.

### Webapp per PC e per chi ha iPhone (avviata 2026-07-31)
Vedi la decisione originale del 2026-07-30 più sotto in Completato una volta chiuso il giro. Stato:
- **Fatto**: `app.json` (`web.output` passato da `static` a `single` — la modalità "static"
  pre-renderizza ogni pagina lato server e crash con `window is not defined` perché il client
  Supabase legge `localStorage` al caricamento, non compatibile con un'app 100% client-side come
  questa), `App/public/index.html` (template HTML custom con manifest/meta PWA — **non** funziona
  con `app/+html.tsx`, che si applica solo alla modalità "static"), `App/public/manifest.json` +
  icone 192/512/512-maskable generate da `assets/images/icon.png`, `App/vercel.json` (build
  `npx expo export -p web`, fallback SPA per le route). Adattamenti codice: nuovo
  `app/utils/webExport.ts` (helper condivisi `printOrShareHtml`/`saveOrShareFile`/
  `pickFileAsBase64` con ramo web via Blob/download invece di `expo-print`/`expo-sharing`/
  `expo-file-system`, che su web non funzionano) usato da `statistiche.tsx`, `convocazione.tsx`,
  `rosterFile.ts`, `calendarFile.ts`; `eventReminders.ts` disattivato su web (`Platform.OS ===
  'web'` → no-op). Verificato con `npx expo export -p web` + server locale: build senza errori,
  login si carica correttamente nel browser.
- **Fatto (Francesco)**: account Vercel creato, repo collegato (Root Directory `App`), variabili
  d'ambiente impostate — online su `ellera.vercel.app`.
- **Testato in produzione da Francesco (2026-07-31)**:
  - ✅ Export PDF (funziona ovunque).
  - ✅ Tattiche e Formazioni.
  - ✅ Export/Import Excel Rosa.
  - ❌ → **fix fatto**: in Rosa, "Elimina giocatore"/"Sposta tra ex giocatori" non funzionavano sul
    web — quel menu si apriva solo con "tieni premuto" (`onLongPress` su `Pressable` in
    `app/squadra/rosa.tsx`), un gesto touch che con mouse su desktop non ha un equivalente
    naturale/scopribile. Aggiunto un bottone "⋮" visibile solo su web (`Platform.OS === 'web'`)
    accanto a ogni giocatore che apre lo stesso menu con un click — nessuna modifica al
    comportamento nativo (long-press resta com'era su Android).
  - ❌ → **fix fatto** (vedi voce "Allenamenti solo eventi + piano Calendario" qui sotto): layout
    Dashboard/Calendario rifatto per il web, insieme alle due migliorie calendario già in programma.
- **Da verificare ancora**: "Aggiungi a Home" da Safari iPhone; export/import Excel
  Partite/Allenamenti (solo Rosa testata finora).

### Allenamenti solo eventi + Calendario/Dashboard rifatti (avviata 2026-07-31)
Su richiesta di Francesco: gli allenamenti non hanno più una sezione presenze dedicata nella scheda
giocatore/Statistiche, e il calendario Dashboard è stato rifatto (le due migliorie già in Backlog +
il fix del layout webapp segnalato sopra). Stato: **implementato, da verificare** (Francesco non ha
ancora testato in produzione).
- **Scheda giocatore** (`app/player/[id].tsx`): rimosso il tab "Allenamenti" (statistiche presenze,
  trend, riepilogo mensile) e la card "Presenze" nell'header — il tab "Infortuni" resta invariato
  (stessa fonte dati `trainings`, usata solo per le strisce di infortunio consecutive).
- **Statistiche squadra** (`app/squadra/statistiche.tsx`): rimosso del tutto il blocco Allenamenti
  (toggle, colonne a schermo, export CSV/PDF) — non più configurabile, tolto definitivamente.
- **Registro presenze allenamento — ora configurabile dall'Admin**: nuova colonna
  `organizations.show_training_attendance` (booleana, default **attivo** —
  `App/supabase/18_schema_training_attendance_toggle.sql`, stesso pattern di `staff_roles`, già
  admin-only via la policy di scrittura esistente su `organizations`). Nuovo switch in Gestione
  Squadra → Admin → Configurazioni ("Registro presenze allenamenti"). Se disattivato, aprendo un
  allenamento dal calendario (`app/eventi/allenamento/[id]/index.tsx`) si vede solo data/ora/luogo/
  tema — niente statistiche presenze/lista giocatori/modale stato. I 3 punti di navigazione verso
  quella schermata (Dashboard, Calendario, Allenamenti) sono rimasti invariati: cambia solo cosa si
  vede una volta apertA.
- **Dashboard/Calendario** (`app/index.tsx`):
  1. Tolto il tap-per-creare-evento su una cella della griglia mensile.
  2. Toccare un giorno **con eventi** apre direttamente l'evento (1 solo) o una piccola scelta (più
     di uno); giorno vuoto → nessuna azione, per tutti i ruoli (non solo Giocatore, come prima).
  3. **Navigazione tra mesi**: freccette ‹ › sempre visibili (utili anche da mouse/webapp) + swipe
     orizzontale sulla griglia, più un link "Torna a oggi" quando si naviga fuori dal mese corrente.
  4. **Layout responsive**: su schermi larghi (≥700px, stesso breakpoint già usato in
     `app/squadra/index.tsx`) il blocco Oggi/Domani e il calendario mensile restano centrati a una
     larghezza massima invece di allargarsi a celle enormi; testo dei numeri/pillole leggermente più
     grande.
- **Vista Calendario** (`app/calendario.tsx`): stesso trattamento responsive (lista centrata a
  larghezza massima su schermi larghi) — il bottone "＋ Nuovo" per creare un evento resta (non è
  quello disattivato al punto sopra, che riguardava solo il tap sulla griglia Dashboard).
- **Non incluso in questo giro**: reattività al resize della finestra per lavagna tattica/moduli
  (vedi voce a parte nel Backlog qui sopra — cosa diversa, non toccata).
- **Chiarimento di Francesco (2026-07-31)**: sull'allenamento il comportamento era già corretto
  (Staff/Admin modifica il tema, Giocatore vede tutto in sola lettura incluso il tema). Sulla
  **partita** invece no — un account Giocatore che apriva una partita non ancora avviata andava
  dritto sulla schermata Live (stesso accesso di Staff/Admin dopo lo Start), invece di vedere solo le
  informazioni essenziali. **Fix**: `app/eventi/partita/[id]/index.tsx` — prima dello Start, un
  Giocatore vede ora una schermata minimale in sola lettura (loghi squadra/avversario, "Ellera -
  Avversario" o viceversa in base a casa/trasferta, data/ora, nessun'altra azione); Staff/Admin
  continuano a vedere il chooser Convocazione/Live come già facevano. Dopo lo Start, tutti vanno su
  Live come prima (dove il Giocatore può proporre gol/cartellini, comportamento già esistente).
- **Fix web: ultima riga del calendario Dashboard tagliata (segnalato da Francesco 2026-07-31)**:
  `app/index.tsx` non aveva mai avuto uno `ScrollView` intorno a header+Oggi/Domani+calendario mensile
  (pensato per "stare tutto a schermo" su un telefono) — su una finestra browser più corta della
  griglia (6 righe), `body{overflow:hidden}` (impostato dal template web) tagliava semplicemente
  l'ultima riga, invisibile e non raggiungibile. **Fix**: quel blocco è ora dentro uno `ScrollView`
  (`topSection` passa da `flexShrink: 0` a `flex: 1` + `ScrollView`), mentre "Azioni rapide" resta
  fissa sotto come prima. Nessun impatto nativo: su telefono, dove il contenuto già ci stava, lo
  scroll semplicemente non serve (nessun overflow da scrollare).

## Completato

### 2026-07-30 — Staff in sola consultazione per chi non è Admin
Su richiesta di Francesco, la schermata "Staff" (Tecnico/Sanitario/Dirigenziale) resta visibile a
tutti (anche al Giocatore, che prima non la vedeva affatto) ma **solo l'Admin** può aggiungere,
modificare o rimuovere persone e generare/revocare codici di accesso — prima anche lo Staff poteva
farlo. Cambiate le policy RLS di scrittura su `staff_members` (ora `is_admin_of`, non più
`is_staff_or_admin_of`).

### 2026-07-30 — Sezioni "Admin" e "Staff" + collegamento account per lo Staff
Le due schermate di gestione staff sotto Gestione Squadra sono state rinominate e allineate al
comportamento della Rosa Giocatori:
- **"Admin"** (ex "Staff", solo admin): logo squadra, membri/ruoli/revoca invariati, più una nuova
  sezione **Configurazioni** — per ora contiene l'elenco dei Ruoli disponibili per lo Staff,
  modificabile liberamente (aggiungi/rimuovi). Rimosso il vecchio invito "a nome libero": ogni invito
  Staff nasce ora sempre da una persona già censita in "Staff".
- **"Staff"** (ex "Rosa Staff", Staff+Admin): il Ruolo si sceglie ora da un menu (le opzioni vengono
  dalla Configurazione sopra) invece di testo libero. L'Admin vede un terzo bottone "📤 Invita"
  direttamente nell'elenco (accanto a Modifica/Rimuovi): genera il codice **e lo condivide subito**
  in un solo tocco — su feedback di Francesco, più rapido del doppio passaggio "genera poi condividi"
  usato per i Giocatori. Una volta collegata, il bottone diventa "✓ Collegato"; lo scollegamento resta
  nella scheda di modifica.

### 2026-07-30 — Nome persona in Dashboard + gestione unificata ruolo/collegamento in Admin
- **Dashboard**: sotto il nome della squadra, Staff e Giocatore vedono ora anche il proprio nome
  (dalla persona collegata in Rosa/Staff) — non l'Admin.
- **Admin**: toccando il nome di un membro si apre un'unica schermata per cambiare ruolo
  (Admin/Staff/Giocatore) e collegare/scollegare **forzatamente** quell'account a un Giocatore o a
  una persona dello Staff a scelta — utile per correggere un collegamento sbagliato senza rigenerare
  un codice. Chi non è collegato lo mostra chiaramente ("Non collegato a nessuno", in rosso).

### 2026-07-30 — Rifinitura Convocazione + Loghi squadra/avversario
Dopo il primo giro (vedi voce del 2026-07-29 sotto), Francesco ha provato la Convocazione e segnalato
5 problemi puntuali, tutti sistemati in questo giro:
1. **Chooser Convocazione/Live**: aprendo una partita non ancora avviata (Staff/Admin) compare ora una
   schermata con due card, "Convocazione" e "Live" — dopo lo Start (o da un account Giocatore) si va
   dritti su Live come prima.
2. **Riepilogo giocatori più leggibile**: la vecchia stringa `nome, nome, nome` è diventata un elenco
   di chip.
3. **Staff convocabile solo dalla Rosa Staff**: rimossa la possibilità di aggiungere staff al volo
   dentro Convocazione — ora si fa dalla nuova schermata dedicata **Rosa Staff** (Gestione Squadra →
   Rosa Staff, visibile a Staff/Admin), che gestisce nome/categoria/ruolo con la stessa logica di
   prima ma in un posto suo.
4. **Menu pranzo rimosso dalla UI** (vedi Backlog: da riprogettare per essere più configurabile) — i
   dati restano nella colonna, nessuna migrazione.
5. **PDF rifatto**: corretto un bug (`e.id === matchId` senza coercizione di tipo) che lasciava vuota
   l'intestazione partita; il bottone "Esporta PDF" apre ora una modale con Competizione/Giornata,
   Luogo, Ritrovo, Data/Ora (prepopolati dalla partita, tutti modificabili prima di generare); il PDF
   elenca **solo i convocati** (non più l'intera rosa con spunta).

**Novità aggiuntiva**: primi loghi nell'app. Un **logo squadra** generale (caricato dall'admin in
Gestione Squadra → Staff) e un **logo avversario** per singola partita (caricato dal tab
Convocazione) — entrambi compaiono nell'header del PDF Convocazione.

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
