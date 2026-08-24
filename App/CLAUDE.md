# ElleraApp — documentazione funzionalità attive

> **Regola per lavori futuri**: tutte le funzionalità elencate qui sotto sono **attive e devono essere mantenute**.
> Non rimuovere, disattivare o riscrivere in modo sostanziale nessuna di queste funzionalità a meno che
> Francesco non lo richieda esplicitamente. Questo file va aggiornato ogni volta che si aggiunge/rimuove
> una funzionalità reale (non serve aggiornarlo per refactoring interni che non cambiano il comportamento).

## Cos'è

App Expo/React Native (gestionale stagione calcistica per allenatore), build APK Android via **EAS**
(`eas build -p android --profile preview`, vedi [Build APP.txt](Build%20APP.txt)).

Dal 2026-07-27 l'app ha un backend (**Supabase**: Postgres + Auth + Row Level Security, piano gratuito)
con login/registrazione e dati legati a un account, non più al singolo dispositivo — vedi sezione
"Autenticazione e squadre" più sotto. **Tutti i dati reali dell'app sono su Supabase** (eventi/calendario,
rosa/foto/allegati, dati live-partita, moduli, tattiche, archivio stagioni) — nessun dominio importante
resta più solo sul dispositivo. Restano solo dati locali minori non legati alla squadra (es. un flag
"ultimo aggiornamento" usato per far ricontrollare i dati ad alcune schermate).

Stack: Expo SDK 57, expo-router 5 (file-based routing, typed routes), React Native 0.86 / React 19,
`react-native-reanimated` 4 + `react-native-gesture-handler` per le lavagne tattiche drag&drop,
`react-native-calendars` per i selettori di date, `expo-print` + `expo-sharing` per l'export PDF.

Il progetto usa **Continuous Native Generation (CNG)**: non esiste più una cartella `android/` (né `ios/`)
committata — `app.json` è l'unica fonte di verità per icona, splash, permessi e plugin nativi, e la
cartella nativa viene rigenerata automaticamente da EAS a ogni build in cloud. Questo significa che
**non serve mai aprire Android Studio o toccare file Gradle/Kotlin** per gestire l'app.

## Come rilascio una modifica

Ci sono solo due scenari:

1. **Modifica normale (99% dei casi)** — hai cambiato una schermata, una logica, un testo, uno stile.
   → Fai commit e push su GitHub del branch `main`. Basta questo: in 1-2 minuti chi ha già l'app
   installata riceve l'aggiornamento **da solo**, senza reinstallare nulla (aggiornamento OTA via
   `.github/workflows/eas-update.yml`, vedi sotto) — **e**, dal 2026-07-31, lo stesso push pubblica da
   solo anche la nuova versione della webapp su Vercel (vedi sezione "Webapp (Vercel)" più sotto). Non
   serve lanciare nessun comando.

   **Nota (2026-07-29)**: il meccanismo pensato originariamente — `App/.eas/workflows/update-on-push.yml`,
   una EAS Workflow nativa attivata dal collegamento GitHub su expo.dev — non è mai partito da solo
   nonostante il repo risultasse correttamente collegato (confermato: nessuna esecuzione automatica su
   due push di prova, `eas workflow:runs` non ha mai registrato il file). Non essendoci una causa
   individuabile lato nostro (documentazione ufficiale Expo consultata, tutti i requisiti noti
   rispettati), abbiamo **rimosso quel file** e sostituito il meccanismo con una **GitHub Action**
   dedicata (`.github/workflows/eas-update.yml`): stessa cosa in pratica, ma è GitHub stesso a far
   partire l'esecuzione (non dipende dal webhook EAS↔GitHub), quindi è più facile da verificare/
   debuggare direttamente dalla tab **Actions** del repository. La Action **partiva** correttamente da
   sola, ma un secondo problema (vedi nota su `runtimeVersion` sotto) ha fatto sì che gli aggiornamenti
   pubblicati da lì non arrivassero comunque sul dispositivo — risolto il 2026-07-29.

2. **Serve una build nuova (raro)** — hai aggiunto una libreria che usa codice nativo, cambiato icona/
   splash/permessi, o aggiornato la versione di Expo. In questi casi una modifica "al volo" (OTA) non
   basta: serve una nuova build Android.
   → Vai su [expo.dev](https://expo.dev) → progetto `ElleraApp` → tab **Workflows** → lancia
   `build-internal.yml` (o da terminale: `eas workflow:run .eas/workflows/build-internal.yml`).
   Dopo qualche minuto ottieni un link/QR code: apri il link sul telefono e installa il nuovo APK
   (distribuzione interna, nessun Play Store).
   → **Importante**: se il motivo della build è un cambio davvero nativo (nuova libreria nativa,
   nuovo permesso — non icona/splash, che sono innocui per la compatibilità OTA), incrementa a mano
   `expo.runtimeVersion` in `app.json` (vedi nota subito sotto) **prima** di lanciare la build.

### `runtimeVersion` fissa, non "fingerprint" (fix 2026-07-29)
`app.json` aveva `runtimeVersion: { policy: "fingerprint" }` — un'"etichetta di compatibilità"
calcolata **automaticamente** in base a codice/dipendenze native, usata da `expo-updates` per capire
se un aggiornamento OTA è compatibile con l'APK installato (aggiornamenti con etichetta diversa
vengono scartati in silenzio, senza errori). **Problema scoperto**: quell'etichetta viene calcolata
in modo diverso a seconda dell'ambiente in cui giri `eas update` — il computer locale (Windows), la
GitHub Action (Linux) e i server di build di Expo producevano **tre valori diversi** pur partendo
dallo stesso codice (problema noto della community Expo quando si pubblica da più ambienti). Risultato
concreto: ogni aggiornamento pubblicato dalla GitHub Action da quando esiste non è mai arrivato sul
dispositivo di Francesco, senza nessun errore visibile.

**Fix**: `runtimeVersion` è ora una stringa fissa (`"1.0.0"`, in `app.json`), identica qualunque sia
l'ambiente che pubblica. **Regola da seguire sempre d'ora in poi**: quando serve una build nuova per
un cambiamento *davvero* nativo (nuova libreria nativa, nuovo permesso — non per icona/splash, che
non cambiano la compatibilità OTA), **incrementa a mano questa stringa** in `app.json` prima di
lanciare `build-internal.yml`, così i futuri aggiornamenti OTA (che porteranno la nuova stringa) non
verranno scartati dal vecchio APK, e viceversa il vecchio codice non verrà mai applicato per errore
al nuovo APK.

### Setup una tantum per la GitHub Action `eas-update.yml` (da fare una volta sola)
La Action ha bisogno di 3 valori configurati su GitHub (repo `Fpeverin/Ellera` → **Settings**):

1. **Settings → Secrets and variables → Actions → tab "Secrets" → "New repository secret"**
   - Nome: `EXPO_TOKEN`
   - Valore: un Personal Access Token generato su
     [expo.dev/settings/access-tokens](https://expo.dev/settings/access-tokens) → "Create token"
     (dà alla Action il permesso di pubblicare aggiornamenti a nome tuo — va trattato come una
     password, non condividerlo).
2. **Stessa pagina → tab "Variables" → "New repository variable"** (questi due NON sono segreti, la
   chiave "anon" di Supabase è pensata per stare nel client — vedi `App/.env.example`):
   - `EXPO_PUBLIC_SUPABASE_URL` = lo stesso valore che hai in `App/.env`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY` = lo stesso valore che hai in `App/.env`

Una volta impostati questi 3 valori, ogni push su `main` che tocca file dentro `App/` pubblica da
solo l'aggiornamento OTA — verificabile dalla tab **Actions** del repository su GitHub.

**Fix 2026-07-31 — virgolette nel messaggio di commit rompevano la Action**: il comando
`eas-cli update --message "${{ github.event.head_commit.message }}"` interpolava il messaggio di
commit **direttamente** nella riga di comando della shell — un commit con virgolette al suo interno
(es. testo tra `"…"` nel corpo del messaggio) le chiude anticipatamente, e il resto del messaggio
viene letto come argomenti sbagliati (`Unexpected arguments: ...`, la Action fallisce silenziosamente
in rosso). **Fix**: il messaggio ora passa tramite una variabile d'ambiente (`COMMIT_MESSAGE`) invece
di essere interpolato — stesso principio di sicurezza raccomandato da GitHub per qualsiasi input non
fidato (`${{ github.event.* }}`) dentro un `run:` di shell. **Da tenere presente per il futuro**:
qualunque altro valore preso da `${{ github.event.* }}` va sempre passato via `env:` + `$NOME_VAR`,
mai interpolato a testo nella riga di comando.

### Collegamento GitHub↔EAS Workflows (confermato attivo, ma non usato per l'OTA)
Il repository GitHub risulta correttamente collegato al progetto Expo (`Fpeverin/Ellera`, confermato
il 2026-07-29 su expo.dev → progetto → tab **GitHub**) — questo collegamento resta utile per lanciare
build manuali dalla dashboard ("Build from GitHub"), ma **non** per l'OTA automatico: quel compito è
passato alla GitHub Action descritta sopra.

## Webapp (Vercel) — 2026-07-31

Stesso identico codice dell'app Android (Expo Router + `react-native-web`, già presenti nel
progetto), pubblicato anche come webapp: da PC si apre l'URL, da iPhone si installa da Safari con
"Aggiungi a Home" (icona propria, schermo intero, nessun account Apple Developer). **Nessuna
modifica alla logica di funzionamento nativa** — solo adattamenti tecnici puntuali dove il web si
comporta diversamente, elencati sotto.

### Modalità di export: `single` (SPA), non `static`
`app.json` → `expo.web.output` è **`"single"`** (client-side rendering puro, come una normale SPA),
non `"static"`. **Non cambiare senza motivo**: la modalità `"static"` pre-renderizza ogni pagina
lato server durante l'export, e questo crasha con `ReferenceError: window is not defined` — il
client Supabase (`app/lib/supabase.ts`) legge la sessione da `localStorage` al caricamento, che non
esiste in quell'ambiente Node. Con `"single"` non c'è pre-rendering: va bene per un'app come questa,
100% client-side, dietro login, senza bisogno di SEO.

**Di conseguenza `app/+html.tsx` non ha alcun effetto** (si applica solo alla modalità `"static"`):
il template HTML root per la modalità `"single"` è invece `App/public/index.html` (letto da Expo
al posto del suo template di default se presente — placeholder `%LANG_ISO_CODE%`/`%WEB_TITLE%` da
non toccare, sostituiti automaticamente). Contiene i tag PWA (manifest, theme-color, icone Apple)
descritti sotto.

### Installabilità PWA
- `App/public/manifest.json`: nome "TeamBoard", `display: "standalone"`, colore brand `#1b7f3b`.
- `App/public/icons/` (`icon-192.png`, `icon-512.png`, `icon-512-maskable.png`): generate da
  `assets/images/icon.png` (1024×1024) con un resize una tantum — se l'icona sorgente cambia,
  vanno rigenerate a mano (nessuno script automatico, non serve una dipendenza in più solo per
  questo).
- Nessun service worker (non serve per "Aggiungi a Home" su Safari iOS, obiettivo di questo giro) —
  possibile miglioria futura per il supporto offline.

### Adattamenti codice per il web
- **`app/utils/webExport.ts`** (nuovo): helper condivisi con un ramo diverso su `Platform.OS ===
  'web'` rispetto a nativo, perché `expo-print`/`expo-sharing`/`expo-file-system` non funzionano sul
  web (niente file-system né share sheet di sistema):
  - `printOrShareHtml(html)`: su web apre una finestra e usa `window.print()` (stampa/salva PDF del
    browser), su nativo `Print.printToFileAsync` + `Sharing.shareAsync` come prima. Usato da
    `app/squadra/statistiche.tsx` e `app/eventi/partita/[id]/convocazione.tsx`.
  - `saveOrShareFile(...)` / `pickFileAsBase64(...)`: su web scaricano/leggono un file via `Blob`
    del browser, su nativo stesso comportamento di prima (`FileSystem.cacheDirectory` +
    `Sharing.shareAsync` / `DocumentPicker`). Usati da `app/data/rosterFile.ts` e
    `app/data/calendarFile.ts` per l'export/import Excel.
- **`app/utils/eventReminders.ts`**: `scheduleEventReminders`/`clearEventReminders` sono no-op su
  web (`Platform.OS === 'web'`) — non esiste sul browser uno scheduler di notifiche locali
  affidabile come sui dispositivi nativi. Nessun impatto sull'app nativa.
- **Non richiedono modifiche**: `expo-web-browser`/`expo-image-picker`/`expo-document-picker` (link
  esterni, foto, allegati) hanno già un comportamento ragionevole di default sul web.
- **Nota**: la lavagna tattica (`react-native-view-shot`, screenshot dello schema) ha già un
  try/catch che salva senza preview se la generazione fallisce — da verificare dal vero nel browser,
  ma non blocca il salvataggio in nessun caso.

### Deploy automatico su Vercel
`App/vercel.json`: build `npx expo export -p web`, output `dist/`, con un fallback SPA per le route
(tutte le richieste che non sono asset/manifest/icone vanno a `index.html`, come in ogni SPA con
`react-navigation`). **Nessuna GitHub Action da scrivere**: a differenza dell'OTA Android, Vercel si
collega direttamente al repo con la sua GitHub App — un push su `main` che tocca `App/**` fa
scattare da solo un nuovo deploy.

**Setup una tantum da fare su vercel.com** (non fatto da Claude Code: richiede un account/OAuth
GitHub tuo):
1. Account su vercel.com ("Continue with GitHub").
2. "Add New Project" → importa `Fpeverin/Ellera` → **Root Directory: `App`**.
3. "Environment Variables" → aggiungi `EXPO_PUBLIC_SUPABASE_URL` e
   `EXPO_PUBLIC_SUPABASE_ANON_KEY` (stessi valori di `App/.env`/delle GitHub Variables usate da
   `eas-update.yml`).
4. Deploy iniziale → Vercel dà un URL tipo `nome-progetto.vercel.app` (dominio personalizzato
   collegabile dopo, se serve).

## Allenamenti: solo eventi + registro presenze configurabile — 2026-07-31

Su richiesta di Francesco, gli allenamenti non hanno più una sezione statistiche/presenze dedicata
nella scheda giocatore e nelle Statistiche squadra — restano **solo eventi di calendario**. Il
registro presenze (per giocatore, quando si apre un allenamento) resta disponibile ma è ora
**configurabile dall'Admin**.

- **Scheda giocatore** (`app/player/[id].tsx`): nessun tab "Allenamenti" (rimosso, insieme alla card
  "Presenze" nell'header). Il tab **Infortuni resta** (invariato) — usa la stessa lista di
  allenamenti/presenze solo per calcolare le strisce di infortunio consecutive, non per mostrare
  statistiche di presenza.
- **Statistiche squadra** (`app/squadra/statistiche.tsx`): nessuna colonna/export legata agli
  allenamenti — rimozione definitiva, non configurabile (a differenza del registro presenze sotto).
- **Registro presenze — nuova configurazione Admin**: `organizations.show_training_attendance`
  (booleana, default `true` — `App/supabase/18_schema_training_attendance_toggle.sql`, stesso
  pattern di `staff_roles`; scrittura già admin-only via la policy esistente su `organizations`).
  Load/save in `app/data/organization.ts` (`loadShowTrainingAttendance`/
  `saveShowTrainingAttendance`), switch in **Gestione Squadra → Admin → Configurazioni**. Quando
  disattivato, `app/eventi/allenamento/[id]/index.tsx` (raggiunta da Dashboard/Calendario/
  Allenamenti, nessuno di questi 3 punti toccato) mostra solo data/ora/luogo/tema — niente statistiche
  presenze, lista giocatori né modale di stato. Il "Tema allenamento" resta sempre visibile/
  modificabile: il toggle riguarda solo il registro presenze.

## Dashboard/Calendario rifatti — 2026-07-31

`app/index.tsx`:
- **Tap-per-creare rimosso**: toccare una cella della griglia mensile non apre più la creazione di un
  evento (resta disponibile da Allenamenti/Partite/Calendario, che hanno le loro azioni dedicate).
- **Tap su un giorno con eventi**: apre direttamente l'evento se ce n'è uno solo, altrimenti una
  piccola modale di scelta; giorno vuoto → nessuna azione. Vale per tutti i ruoli (anche Giocatore,
  che prima non poteva nemmeno aprire un evento toccando la griglia).
- **Navigazione tra mesi**: nuovo state `viewMonth` (prima la griglia mostrava sempre e solo il mese
  reale). Freccette ‹ › sempre visibili accanto al titolo mese (utili anche da mouse su webapp) +
  swipe orizzontale sulla griglia (via `PanResponder`, soglia che ignora scroll verticale), più un
  link "Torna a oggi" quando si naviga fuori dal mese corrente.
- **Responsive** (fix del problema segnalato testando `ellera.vercel.app`): sopra 700px di larghezza
  (stesso breakpoint già in uso in `app/squadra/index.tsx`) il blocco "Oggi e domani" e il calendario
  mensile restano centrati a una larghezza massima (560px) invece di allargarsi a celle enormi; testo
  di numeri/pillole leggermente più grande.

`app/calendario.tsx`: stesso trattamento responsive (lista centrata a una larghezza massima di 700px
sopra la soglia) — il bottone "＋ Nuovo" per creare un evento resta invariato, non è quello disattivato
sopra (che riguardava solo il tap sulla griglia Dashboard).

**Non incluso**: reattività al resize della finestra per la lavagna tattica/moduli — problema diverso
(componenti drag&drop a `Dimensions.get('window')` statico), resta in Backlog.

## Accesso Giocatore a una partita non ancora avviata — 2026-07-31

**Aggiorna** il comportamento descritto in "Convocazione partita + Rosa Staff categorizzata" più
sotto (`app/eventi/partita/[id]/index.tsx`): prima, un account Giocatore che apriva una partita non
ancora avviata andava dritto sulla schermata Live, con lo stesso accesso che Staff/Admin hanno solo
dopo lo Start. Ora un Giocatore in quel caso vede una schermata minimale in **sola lettura**: loghi
squadra/avversario, titolo "Ellera - Avversario" (o l'inverso se in trasferta), data/ora — nessun'altra
azione (niente Convocazione/Formazione/Live). Staff/Admin continuano a vedere il chooser Convocazione/
Live come già facevano, invariato. **Dopo lo Start, tutti (compreso il Giocatore) vanno su Live** come
prima — il Giocatore può proporre gol/cartellini, comportamento già esistente e non toccato.

## Notifiche push tra utenti — 2026-07-31

Prima infrastruttura di notifiche push che arrivano a **un altro utente** (finora l'app aveva solo
promemoria locali, `app/utils/eventReminders.ts` — ogni dispositivo avvisa se stesso). Nessun server
dedicato: ogni account salva il proprio push token Expo su Supabase, e chi vuole notificare invia via
`fetch` diretto all'API pubblica di Expo (`exp.host/--/api/v2/push/send`) — eccetto i sondaggi
programmati/ricorrenti, gestiti da `pg_cron`+`pg_net` (vedi sotto).

### Fondamenta (`App/supabase/19_schema_push_tokens.sql`, `app/data/pushNotify.ts`)
- `memberships.push_token`: ogni account scrive **solo il proprio** (RPC `register_push_token`,
  `auth.uid()` nel `where`, non nel parametro — evita di toccare le policy RLS di scrittura esistenti
  su `memberships`, oggi solo admin).
- `registerPushTokenForCurrentUser(orgId)`: chiamata da `app/index.tsx` per **tutti i ruoli** (non solo
  Giocatore — Staff/Admin ricevono notifiche di proposte/modifiche/risposte sondaggi), no-op su
  `Platform.OS === 'web'` (i push remoti sul web sono un mondo diverso, fuori scope, stesso principio
  già usato per `eventReminders.ts`).
- `sendExpoPush(tokens, title, body, data?)`: invio best-effort a chunk di 100 token (limite Expo),
  errori solo loggati — non deve mai bloccare l'azione di chi ha triggerato la notifica.
- RPC di risoluzione destinatari (tutte security definer, richiedono solo essere membri dell'org —
  ritornano solo token opachi, nessun dato personale): `get_notification_tokens(org, mode,
  staff_ids?)` (per notifiche "verso lo staff": `admin_only`/`all`/`selected`, riusata da proposte
  Live, modifiche anagrafica, risposte sondaggio), `get_push_tokens_for_players(org, player_ids)`
  (Convocazione), `get_org_player_tokens(org)` (tutti i giocatori, solo Staff/Admin — invio sondaggi).

### Notifica Convocazione
`app/eventi/partita/[id]/convocazione.tsx`: bottone **"🔔 Notifica convocati"**, separato dal bottone
"📄 Esporta PDF" (richiesta esplicita di Francesco — non deve essere lo stesso tasto). Notifica i
convocati con token registrato, alert onesto su quanti sono stati avvisati rispetto al totale
convocati (chi non ha ancora aperto l'app/registrato un token non riceve nulla).

### Notifiche configurabili (`App/supabase/20_schema_notify_config.sql`)
Due impostazioni **indipendenti** su `organizations` (`notify_live_proposals_mode/staff_ids`,
`notify_player_edit_mode/staff_ids`), stesso pattern di `staff_roles`/`show_training_attendance` —
nessuna nuova policy RLS. UI in Gestione Squadra → Admin → Configurazioni, nuovo componente condiviso
`app/components/NotifyRecipientsPicker.tsx` (Solo Admin / Tutto lo Staff / Alcuni membri + checklist).
Agganciate a `app/data/proposals.ts` (`propose()`) e `app/data/playerEdits.ts`
(`proposePlayerEdit()`) — la notifica parte dal client di chi propone/richiede (il Giocatore), non
blocca l'operazione se fallisce (solo loggata).

### Sondaggi (`App/supabase/21_schema_surveys.sql`, `22_schema_surveys_cron.sql`, `app/data/surveys.ts`)
Nuova sezione **"Sondaggi"** sotto Gestione Squadra (`app/squadra/sondaggi/index.tsx` +
`editor.tsx`), attivabile/disattivabile da Admin → Configurazioni
(`organizations.surveys_enabled`, nasconde la card per tutti i ruoli, incluso Admin).
- **Domande**: tre tipi scelti da chi crea il sondaggio — testo libero, scala 1-5, scelta singola con
  opzioni personalizzate (`surveys.questions` jsonb).
- **Invio**: subito (dal client, `createSurvey`/`resendSurveyNow` in `app/data/surveys.ts`),
  programmato (una data) o ricorrente ("ogni N giorni"). Per programmato/ricorrente **non** basta un
  controllo lato client al prossimo avvio app (l'orario non sarebbe garantito) — l'invio scatta
  davvero all'ora prevista tramite `pg_cron` + `pg_net` (entrambe estensioni Postgres incluse in
  Supabase, **nessun servizio esterno**): la funzione `process_due_surveys()` gira ogni 5 minuti,
  crea la riga `survey_sends` e chiama direttamente l'API di Expo con `net.http_post`. Se
  `create extension pg_cron`/`pg_net` desse un permission error sul piano Supabase in uso: Dashboard →
  Database → Extensions, attivarle da lì.
- **Ogni invio è un'occorrenza a parte** (`survey_sends`): per i sondaggi ricorrenti le risposte di
  occorrenze diverse non si mescolano mai.
- **Risposte** (`survey_responses`, un giocatore risponde solo per il proprio `player_id`, upsert):
  visibili nell'editor in modalità modifica, raggruppate per invio. Notifica configurabile
  (per-sondaggio, stesso `NotifyRecipientsPicker`) a chi dello staff quando arriva una risposta.
- **Destinatari del sondaggio** (`App/supabase/23_schema_survey_recipients.sql`, aggiunto dopo il
  primo test — non era ovvio "a chi arriva"): sezione **Destinatari** nell'editor — Tutti i
  giocatori (default, comportamento di prima) oppure Solo alcuni scelti alla creazione
  (`surveys.notify_players_mode`/`notify_players_ids`). Nuova RPC `get_survey_player_tokens` per
  l'invio "subito" dal client; `process_due_surveys()` ridefinita per rispettare lo stesso targeting
  nei sondaggi programmati/ricorrenti (il job pg_cron esistente non cambia, richiama la stessa
  funzione).

**Fatto (Francesco)**: eseguiti in ordine su Supabase `19_schema_push_tokens.sql`,
`20_schema_notify_config.sql`, `21_schema_surveys.sql`, `22_schema_surveys_cron.sql`,
`23_schema_survey_recipients.sql`.
**Verificato dal vero (2026-08-03)**: registrazione token su dispositivo fisico, ognuna delle
notifiche sopra, e un sondaggio "programmato" chiudendo completamente l'app — confermato che
`pg_cron`/`pg_net` funzionano davvero senza bisogno di nessun client aperto. Tutto corretto.

## Logo squadra in ogni schermata — 2026-07-31

Il logo squadra (caricato dall'Admin in Gestione Squadra → Admin, `organizations.logo_path`) compare
ora nell'header di **ogni schermata dell'app** quando è stato caricato (nessuna icona se non c'è
ancora un logo). Due pezzi:
- **`app/hooks/useOrgLogo.ts`**: cache in memoria per sessione (una sola query invece di una per
  ogni schermata visitata) — `invalidateOrgLogoCache()` va chiamata da chi carica un nuovo logo
  (fatto in `app/squadra/staff.tsx`, `pickLogo`).
- **`app/components/TeamLogo.tsx`**: `<TeamLogo size={..} />`, non renderizza nulla se il logo non
  c'è ancora.
- **Copertura**: `app/squadra/_layout.tsx` (`headerRight` nello `screenOptions` dello Stack — copre
  in un colpo tutte le schermate sotto Gestione Squadra: Rosa, Moduli, Tattiche, Statistiche,
  Archivio, Admin, Staff, Sondaggi) più ogni altra schermata "root" (Dashboard, Calendario,
  Allenamenti, Partite, Moduli, scheda giocatore, dettaglio Allenamento, e le schermate di una
  partita — chooser pre-Start, Formazione, Tattiche, Convocazione, Live), inserito singolarmente in
  ciascuna dato che non condividono un header comune (`headerShown: false` a livello root,
  `app/_layout.tsx` — ogni schermata costruisce il proprio header in JSX).
- **Non toccate** (nessun contesto squadra ancora disponibile, o pagine non applicabili):
  login/registrazione, onboarding, `+not-found.tsx`, `app/eventi/nuovo.tsx` (codice morto/
  irraggiungibile, non collegato da nessuna navigazione).
- Nella schermata Partita pre-Start per il Giocatore (`app/eventi/partita/[id]/index.tsx`) il logo
  squadra compare già in modo prominente nel confronto "loghi vs avversario" — non duplicato con
  `TeamLogo` in quel branch specifico.

## Convocazione: layout a due colonne + fix conteggio "sporco" — 2026-08-03

Due richieste di Francesco insieme: un bug sul conteggio dei convocati e un layout più simile al PDF.

- **Bug**: il conteggio "Giocatori convocati (N)" poteva mostrare un numero maggiore di quanti
  chip/righe comparivano davvero. **Causa**: `isPlayerInMatches` (`app/data/matchLive.ts`, usata per
  bloccare l'eliminazione totale di un giocatore già coinvolto in una partita) controllava solo
  gol/cartellini/sostituzioni/formazione, **non** la colonna `convocazione` — un giocatore convocato
  ma mai sceso in campo poteva quindi essere eliminato del tutto dalla Rosa, lasciando il suo id
  "orfano" per sempre in `playerIds` di quella convocazione (contato, ma senza un giocatore reale da
  mostrare). **Fix**: `isPlayerInMatches` controlla ora anche `convocazione.playerIds`; inoltre sia
  `app/eventi/partita/[id]/convocazione.tsx` sia la card "MODIFICA CONVOCATI" in `live.tsx` si
  autocorreggono da soli quando trovano id ormai senza un giocatore corrispondente (rimuovendoli e
  salvando la lista pulita) — così anche le convocazioni già sporche da prima si sistemano alla prima
  apertura, senza bisogno di una migrazione a parte. Il conteggio/riepilogo/PDF di
  `convocazione.tsx` usano ora `allPlayers` (attivi + ex, non solo attivi) per la lista dei convocati
  visualizzati: un giocatore convocato e poi spostato tra gli ex resta visibile correttamente
  (comportamento voluto, diverso dal caso "eliminato del tutto" sopra).
- **Layout a due colonne** (`app/eventi/partita/[id]/convocazione.tsx`): la selezione giocatori non
  apre più una modale — checklist inline nella colonna sinistra (con bottone "Seleziona tutti"/
  "Deseleziona tutti" in testa), colonna destra con lo staff diviso per categoria (Tecnico/Sanitario/
  Dirigenza, invariato) — stessa disposizione fianco a fianco della Scheda Excel/PDF. Sotto i 700px di
  larghezza (stesso breakpoint già in uso altrove, es. `app/calendario.tsx`) le due colonne si
  impilano, prima i giocatori. La modale `ConvocatiPlayersModal` non è più usata da questa schermata
  (resta per la modifica rapida "ultimo secondo" in Live, invariata) — le ha guadagnato comunque lo
  stesso bottone "Seleziona tutti"/"Deseleziona tutti" per coerenza.

## PDF Convocazione: ordine dello Staff — 2026-08-10

Richiesta di Francesco: nel PDF (non nella checklist a schermo, che resta come prima), lo staff
convocato nella colonna di destra deve seguire un ordine di ruolo preciso, non l'ordine alfabetico
per nome che usava prima.
- `app/eventi/partita/[id]/convocazione.tsx`, nuova costante `STAFF_ROLE_ORDER_PDF` (per categoria) +
  helper `sortStaffForPdf`, usati solo dentro `runExport` (`staffColumnHtml`):
  - **Staff Tecnico**: Allenatore, Vice-Allenatore, Preparatore Atletico, Preparatore Portieri.
  - **Staff Sanitario**: nessun ordine specifico richiesto — resta l'ordine di prima.
  - **Staff Dirigenziale**: Direttore Sportivo, poi Team Manager.
  - L'ordine tra le categorie stesse (Tecnico → Sanitario → Dirigenziale) era già corretto, non
    toccato.
- Un ruolo non presente in queste liste (es. un ruolo custom aggiunto da Admin → Configurazioni, non
  ancora previsto qui) finisce semplicemente in fondo alla sua categoria — non genera errori né
  nasconde nessuno dal PDF.

## Riprogettazione lavagna tattica — Fase 1: primitive condivise + Moduli — 2026-08-10

Avviata la riprogettazione della lavagna tattica (Moduli/Tattiche/Formazione — vedi il piano completo
in corso, 4 fasi in totale). Prima c'erano **4 implementazioni quasi duplicate e incoerenti** dello
stesso concetto (campo da calcio + maglia trascinabile): componenti `Draggable` locali con differenze
pericolose (uno senza `runOnJS`), un campo ridisegnato 4 volte con valori leggermente incoerenti, e
`Dimensions.get('window')` letto una volta sola in 3 file su 4 (causa nota del bug "non si adatta al
resize"). **Nessuna modifica allo schema Supabase** in tutta la riprogettazione — solo layer visivo/
gesture client-side.

### Primitive condivise — `app/components/tactical/`
- **`Field.tsx`**: sfondo campo unico (linee/area/dischetto/porta, cerchio centrocampo ora
  proporzionale al campo invece di un valore fisso). Si automisura via `onLayout` (mai `Dimensions`
  statico) ed espone la misura sia come Context React (`useFieldMeasure()`, numeri JS) sia come coppia
  di `SharedValue` (`useFieldMeasureShared()`, necessaria dentro un worklet). Prop `zoomable`: pinch-
  to-zoom + pan a due dita (`Gesture.Pinch()` + `Gesture.Pan().minPointers(2)`, già incluso in
  `react-native-gesture-handler` — nessuna nuova dipendenza), scala clampata `[1, 2.5]` (solo zoom-in).
  Prop `resetKey` per azzerare zoom/pan al cambio modulo. Prop opzionale `onTapField` (tap sul campo,
  in percentuale) — usato solo da Moduli per il piazzamento iniziale di una maglia.
- **`DraggableToken.tsx`**: sostituisce i 3 `Draggable` locali. Wrapper esterno guidato direttamente
  da `xPct`/`yPct` (nessuna shared value "posseduta" da risincronizzare — corregge *per costruzione*
  il bug per cui un cambio esterno di posizione, es. uno swap o il futuro layout automatico, non si
  rifletteva a schermo) con animazione di assestamento (`withSpring`); wrapper interno che segue il
  dito col dito durante il drag (`translateX/Y` relativo, azzerato a fine gesto). `onEnd` chiama
  sempre `runOnJS`. Identificato per `tokenKey` (l'id dello slot/elemento), non per indice di array.
- **`Jersey.tsx`**: maglia condivisa (`variant: 'home'|'away'`, `number?`), più `Ball`.
- **`dropTarget.ts`**: helper puro `resolveDropTarget(nxPx, nyPx, siblings, excludeKey, thresholdPx)`
  per lo swap-on-drop (trascinare un token sopra un altro per scambiarli di posizione) — lavora in
  pixel, non percentuale (il campo non è quadrato). La decisione "sposta o scambia" resta nello screen
  chiamante: se c'è un hit, si scambiano solo le coordinate `{x,y}` tra i due elementi, mai gli id/
  numeri/associazioni.

### Migrazione Moduli (`app/moduli/editor.tsx`)
Prima migrazione reale (nessun dato reale, nessun live mode — rischio minimo). Sostituito il
`Draggable` locale, il campo disegnato inline e `ShirtOnField` con le primitive condivise. Il
contenitore del campo è ora `flex: 1` (non più un'altezza fissa calcolata una volta da
`Dimensions.get('window')`) — reattivo a qualunque resize della finestra tramite il normale layout
flessibile, senza bisogno di leggere le dimensioni schermo. Aggiunto swap-on-drop (trascina una maglia
sopra un'altra per scambiarle) e zoom/pan (pizzica con due dita). Il piazzamento iniziale di una nuova
maglia (tocca il pannello, poi tocca il campo) usa ora `Field`'s `onTapField` invece della vecchia API
Responder legacy mescolata con GestureHandler. Rimosso il `GestureHandlerRootView` locale (è già
montato globalmente in `app/_layout.tsx`, era ridondante).

**Da verificare dal vero** (drag/swap/zoom sono gesture multi-touch, non testabili in modo affidabile
senza un dispositivo reale): creare un modulo nuovo (piazzamento, drag, swap tra due maglie, pizzica
per zoomare) e aprire un modulo predefinito in sola lettura; verificare che il campo si adatti
ridimensionando la finestra sulla webapp.

### Fase 2 — Tattiche squadra generiche (`app/squadra/tattiche/editor.tsx`)
Stessa sostituzione di Moduli, più `Jersey variant="away"` e `Ball` (già esistenti in questo file,
ora condivisi). Swap-on-drop tra qualunque coppia di maglie (nostre/avversarie) — il pallone resta
escluso dallo swap (si sposta normalmente, "scambiarlo" con una maglia non avrebbe senso). Sistemato
anche il nesting `View` confuso della modale nome-tattica (c'era un commento manuale "tolta la ) in
più qui" — segno di un fix già raffazzonato in passato), riscritta con indentazione lineare.

**Screenshot e zoom**: la preview salvata (`react-native-view-shot`, `captureRef`) deve rappresentare
lo schema intero, non un'inquadratura zoomata — `doSave` azzera lo zoom (bump di `resetKey` + un
piccolo `setTimeout`) **prima** di scattare, cosa non necessaria a Moduli (che non genera preview).
`GestureHandlerRootView` locale rimosso (già globale).

**Da verificare dal vero**: oltre a drag/swap/zoom come per Moduli, salvare una tattica con maglie
HOME+AWAY+palla e controllare che l'immagine preview su Storage rifletta la disposizione finale
corretta (non un'inquadratura zoomata a metà, né un transform residuo di un drag in corso).

### Fix critico: campo invisibile su web (Fase 1+2)
Dopo il primo giro, Francesco ha segnalato che su webapp il campo non si vedeva **per niente** (e
sull'app nessuna novità grafica) — non un problema di cache/OTA come altre volte, un bug reale.
**Causa**: in `Field.tsx`, il wrapper animato dello zoom (`Animated.View` con solo `transform: [...]`)
non aveva una dimensione propria — senza `flex: 1` resta a grandezza automatica (0), e il campo dentro
(`width/height: '100%'`) si risolveva quindi a **zero px**: invisibile, senza nessun errore in console
(non un crash, un collasso di layout silenzioso). Colpiva entrambe le schermate migrate finora
(entrambe con `zoomable`). **Fix**: `style={[{ flex: 1 }, zoomStyle]}` invece di `style={zoomStyle}`.
**Verificato dal vero** con un server locale (`npx expo start --web`) e una pagina di debug temporanea
(mai committata, rimossa subito dopo) — screenshot che confermano il campo visibile e il token
posizionato correttamente prima e dopo il fix.

### Fase 3 — Formazione + Live (`app/eventi/partita/[id]/formazione.tsx`)
La fase a rischio più alto (dati reali di partita, modalità Live) — **solo layer visivo/gesture**,
nessuna modifica a come si legge/scrive `lineup`, `positions`, `numbers` (`app/data/matchLive.ts`,
non toccato). Sostituiti `Draggable` locale, campo disegnato inline e `BlueWhiteShirt` con le
primitive condivise (`Jersey variant="home"`, stessa dimensione di prima — 46×30 — passata
esplicitamente, non la dimensione di default di `Jersey`). Fuori da Live l'interazione resta
identica: tap su uno slot vuoto apre il picker giocatore, tap su uno assegnato apre il numero
maglia, pressione lunga rimuove — nessun `DraggableToken` coinvolto lì (il drag esisteva solo in
Live anche prima). In Live, swap-on-drop **sugli indici di `posOverrides`** (mai su
`fieldAssignments`): trascinare una maglia sopra un'altra scambia solo la posizione disegnata, non
chi è davvero assegnato a quello slot — nessun impatto sui dati reali. `GestureHandlerRootView`
locale rimosso (il return radice diventa un Fragment `<>...</>` invece di quel wrapper).

**Nuovo bottone "🪄 Disponi automaticamente"** (`app/utils/autoFormation.ts`, nuovo — solo
`!liveMode && !readOnly`): ripartisce i convocati (meno chi è già in panchina a mano — la panchina
non viene mai toccata) sugli slot del modulo scelto, per reparto. Euristica basata sulla **profondità
sul campo** (coordinata `y` dello slot: ≥85 portiere, 65-85 difesa, 38-65 centrocampo, <38 attacco),
non sull'id dello slot — i moduli personalizzati hanno id generici (`P1`..`P11`, nessun significato di
ruolo), un matching per id fallirebbe silenzialmente sul caso più comune. Due passate: match esatto
per reparto, poi riempimento di quel che resta con i candidati non ancora piazzati. Riusa un numero di
maglia già noto se presente. Con meno di 11 convocati disponibili gli slot restanti restano vuoti
(stato già tollerato); con conferma modale (`Alert.alert`) solo se c'è già una disposizione manuale da
sovrascrivere.

**Da verificare dal vero** (la fase più delicata di tutte — dati reali): drag di una maglia in Live,
swap tra due maglie, una sostituzione live, "Disponi automaticamente" pre-partita seguito da
aggiustamenti manuali — confermare che tutto si salvi correttamente e che `live.tsx` (legge solo
`live_formation`, mai `lineup`/`positions`) non abbia alcuna regressione.

### Fase 4 — Tattiche di partita (`app/eventi/partita/[id]/tattiche.tsx`)
Ultima fase, restyle **visivo puro**: sostituito il disegno inline del campo con `Field zoomable` e
`BlueWhiteShirt`/`RedShirt`/il pallone inline con `Jersey`/`Ball` condivisi. **Nessun** `DraggableToken`
né swap-on-drop qui — questo file non ha mai avuto drag (solo tap che apre il picker giocatore, tenuta
premuta per svuotare) e resta legato ai giocatori reali convocati, confermato esplicitamente da
Francesco: introdurre drag sarebbe un cambio di logica, non solo visivo. Il polling ogni 2s e il
matching FIFO delle sostituzioni live restano bit-per-bit identici (nessuna riga toccata in quella
parte del file). L'altezza del campo (`FIELD_H_MODAL`) resta un valore fisso calcolato da
`Dimensions.get('window')` come prima — `Field` la accetta com'è, non serve renderla reattiva per
uno scopo puramente visivo; non toccato nemmeno `IS_NARROW`/`LEGEND_MAX_W` (layout della legenda, non
il campo), già annotato come backlog separato.

Con questa fase si conclude la riprogettazione della lavagna tattica in tutte le sue 4 parti.

## Lavagna tattica — round 2: disco, campo realistico, vassoio drag — 2026-08-10

Dopo aver visto le 4 fasi sopra, Francesco ha dato un feedback netto: il drag non convince, la resa
grafica del campo e il modo in cui si aggiungono/tolgono le pedine "fanno schifo". Confrontati due
prototipi interattivi (HTML, fuori dall'app) prima di toccare codice reale — confermato: disco al
posto della maglietta, campo con erba a strisce e margini veri, e un vassoio da cui si trascina
direttamente sul campo per aggiungere (mai più "tocca per selezionare, poi tocca per piazzare" o
bottoni a posizione fissa) — il gesto opposto e simmetrico (trascinare fuori dal campo) rimuove.

### Aggiornamenti alle primitive condivise (si propagano a tutti e 4 gli usi)
- **`Jersey.tsx`**: da maglia a righe con "maniche" a due cerchietti → disco colorato con numero.
  `size` resta `{w,h}` per non toccare le chiamate esistenti — il disco usa `Math.min(w,h)` come
  diametro, centrato nel riquadro. Niente `color-mix()` (non esiste in React Native): un piccolo
  helper `darken()` scurisce il colore di riempimento per il bordo.
- **`Field.tsx`**: aggiunta erba a strisce di taglio (8 bande alterne, puro sfondo decorativo),
  dischetto centrale, dischetti di rigore. **Non** aggiunti gli archi d'angolo/l'arco dell'area — il
  contenitore ha già gli angoli arrotondati (12px) per lo stile "card" del resto dell'app, un arco
  geometrico esatto lì sarebbe stato ridondante/confuso, non un dettaglio che valeva la complessità.
  `Field` ora è un `React.forwardRef` — espone un ref sulla View del campo, usato da `AddTray` per
  misurarne la posizione assoluta sullo schermo (`measureInWindow`) durante un trascinamento dal
  vassoio.
- **`DraggableToken.tsx`**: nuova prop opzionale `onRemove` — se un drag finisce **fuori dai margini
  del campo** (percentuale raw, non quella clampata, con una tolleranza di 4 punti percentuali per
  non scambiare un piazzamento legittimo vicino al bordo per un tentativo di rimozione), si chiama
  `onRemove` invece di bloccare il token al bordo. Aggiunta anche un'animazione di comparsa/scomparsa
  (`presence`, una shared value 0→1 al mount via `withTiming`, e 1→0 prima della rimozione effettiva)
  — un token nuovo si "materializza" con un piccolo pop invece di apparire di scatto, e uno rimosso si
  rimpicciolisce/svanisce prima di sparire dai dati.
- **`AddTray.tsx`** (nuovo): il vassoio di sorgenti trascinabili. Ogni sorgente resta disponibile
  (non si consuma da sola — decide lo screen se toglierla, es. Moduli, o lasciarla sempre riusabile,
  es. Tattiche squadra, semplicemente aggiornando l'array `items` passato). Il "fantasma" che segue
  il dito **non usa un Portal/Modal**: il vassoio (quindi anche il suo fantasma) viene reso **dopo**
  il campo nell'albero dei componenti in entrambe le schermate — comportamento di default di React
  Native (nessun antenato con `overflow: hidden`), il fantasma che esce dai propri confini dipinge
  semplicemente sopra al campo. Bastano due misurazioni (`measureInWindow` su vassoio e campo,
  all'inizio del trascinamento) per calcolare la posizione del fantasma e testare se il rilascio è
  dentro il campo. Il calcolo della posizione del fantasma durante il drag resta **sul thread UI**
  (nessun `runOnJS` per ogni frame) — solo inizio/fine gesto passano da JS.

### Migrazione Moduli (`app/moduli/editor.tsx`)
Rimossi `placingIndex`/`handleTapField`/il vecchio pannello "tocca una maglia poi tocca il campo":
ogni slot non ancora piazzato è ora un elemento di `AddTray`, trascinabile direttamente sul campo.
Trascinare una maglia già piazzata fuori dal campo la rimanda al vassoio (`onRemove` → `available[i]
= true`). Swap-on-drop tra maglie già piazzate resta invariato.

### Migrazione Tattiche squadra (`app/squadra/tattiche/editor.tsx`)
Rimossi i bottoni "+ Nostro/+ Avversario/+ Pallone" (posizione fissa 50/80, 50/20, 50/50) — sostituiti
da `AddTray` con 3 sorgenti infinite (Nostro/Avversario/Pallone, numerazione auto-assegnata
all'aggiunta, stessa regola "un solo pallone" di prima). **Cambio di layout**: il vassoio è passato da
sopra il campo (`toolsBar`) a sotto (`bottomBar`, insieme al bottone Reset) — necessario perché il
vassoio deve essere reso *dopo* il campo nell'albero per il trucco del fantasma sopra descritto; sopra
il campo non avrebbe funzionato. Rimozione: trascinare fuori dal campo (`onRemove`) invece della
pressione lunga nascosta di prima.

### Non toccate (visivo condiviso sì, interazione no)
`app/eventi/partita/[id]/formazione.tsx` e `.../tattiche.tsx` (Tattiche di partita) ricevono il nuovo
disco/campo automaticamente (stessi componenti condivisi), ma **nessuna modifica** alla loro logica —
resta il tap+Modal per l'assegnazione dei giocatori reali, confermato già in un giro precedente.

### Verifica
`tsc --noEmit` e `npx expo export -p web` puliti. Verificato dal vero con un server locale +
pagine di debug temporanee (mai committate): colori/forme corretti (disco, colori squadra/avversari,
strisce del campo — controllati via `getComputedStyle`), struttura DOM corretta. **Non verificabile in
questo ambiente**: il drag stesso e le animazioni (`withTiming`/`withSpring`) — il pannello browser di
test risulta "non in compositing" (`requestAnimationFrame` confermato mai invocato, anche aspettando
a lungo), quindi qualunque animazione risulta bloccata al valore iniziale indipendentemente dal
codice — non è indicativo di un bug reale (il drag di base, senza le nuove animazioni, era già stato
verificato funzionante su web prima di questo giro). **Da verificare dal vero da Francesco, con
priorità alta dato il precedente**: aspetto del disco/campo, trascinamento dal vassoio al campo
(Moduli e Tattiche squadra), trascinamento fuori dal campo per rimuovere, swap tra maglie, zoom.

## Fix layout Moduli/Tattiche squadra + cognomi composti nel live — 2026-08-21

Feedback di Francesco dopo il round 2 sopra: titolo header duplicato "tattiche/editor" in Tattiche
squadra, vassoio Moduli da spostare da laterale a sotto il campo (come Tattiche squadra), vassoio/
reset di Tattiche squadra coperti dai bottoni di gesture dello smartphone, e un cognome composto
("Di Marzo") troncato a "Di" in Formazione/Tattiche di partita.
- `app/squadra/_layout.tsx`: nuovo `Stack.Screen name="tattiche/editor" options={{ headerShown:
  false }}` — quella schermata ha già una sua topbar custom (indietro/nome/salva), l'header nativo
  era ridondante e mostrava il nome tecnico della route.
- `app/squadra/tattiche/editor.tsx`: Reset spostato accanto al Salva nella topbar, solo icona;
  `SafeAreaView edges={['top','bottom']}` (prima solo `View`) così vassoio e controlli non finiscono
  sotto i bottoni di gesture.
- `app/moduli/editor.tsx`: stesso vassoio (`AddTray`) spostato da un pannello laterale a sotto il
  campo — layout ora verticale come Tattiche squadra, non più a due colonne.
- `app/eventi/partita/[id]/formazione.tsx`: stessa estensione della safe-area anche in basso.
- **Bug cognomi composti**: `surnameOf()` (duplicato in `formazione.tsx` e in `.../tattiche.tsx` di
  partita) prendeva solo la **prima parola** del nome salvato (convenzione "Cognome Nome" di questa
  squadra) — corretto per prendere tutte le parole tranne l'ultima, quindi "Di Marzo Luca" mostra
  "Di Marzo" invece di "Di".

## Lista Gara (entry point) + fix navigazione iPhone (PWA senza bottone indietro) — 2026-08-21

Due segnalazioni di Francesco insieme.

**Lista Gara**: nuova card "🧾 LISTA GARA" nella pagina scelta-partita
(`app/eventi/partita/[id]/index.tsx`, accanto a Convocazione/Live) e nuova schermata
`app/eventi/partita/[id]/listaGara.tsx` — solo Staff/Admin (quella pagina non è raggiungibile dai
Giocatori). Contenuto specificato da Francesco il giorno dopo — vedi sezione dedicata più sotto.

**Navigazione iPhone**: segnalato "non si riesce a navigare la pagina" su iPhone, ipotesi iniziale di
Francesco "gesture non gestite". **Causa reale, diversa**: da iPhone l'app si usa come PWA "Aggiungi
a Home" (`display: "standalone"` nel manifest — vedi sezione Webapp più sopra), modalità in cui **non
esiste né lo swipe di sistema né un tasto indietro del browser** (a differenza dell'app nativa
Android o di un tab Safari normale). Molte schermate con header custom (`headerShown: false` a
livello root, `app/_layout.tsx`) non avevano mai incluso un bottone indietro proprio, perché su
Android/desktop/Safari-in-tab una via per tornare indietro c'era comunque — su iPhone PWA diventavano
un vicolo cieco reale, non un problema di gesture assorbite dalla lavagna tattica.
- Aggiunto un bottone "←" coerente in cima a: `app/moduli/index.tsx`, `app/moduli/editor.tsx`,
  `app/allenamenti.tsx`, `app/calendario.tsx`, `app/partite.tsx`,
  `app/eventi/partita/[id]/index.tsx`, `.../convocazione.tsx`, `.../formazione.tsx` (nuova topBar
  dedicata), `.../listaGara.tsx` (nuovo, nasce già con bottone indietro).
- `.../live.tsx`: bottone "← Partite" con `router.replace('/partite')` invece di `router.back()` —
  un `back()` semplice rientrerebbe nella pagina scelta-partita, che con la partita già avviata
  reindirizza subito di nuovo a Live (rimbalzo); si salta dritti alla lista partite.
- `.../tattiche.tsx` (di partita) aveva già un bottone "Chiudi" funzionante — solo corretto un uso
  scorretto di `useRouter()` chiamato dentro un `onPress` invece della variabile `router` già in
  scope (funzionava comunque via i suoi effetti collaterali, ma viola le regole dei Hook di React).
- **Non toccate** (hanno già un header nativo con bottone indietro "di serie", tramite
  `Stack.Screen` in `app/squadra/_layout.tsx`): Rosa, Statistiche, Archivio, Admin, Staff, Sondaggi,
  Tattiche squadra (l'elenco — l'editor aveva già un suo bottone indietro dal giro precedente).
- **Regola da tenere a mente per ogni nuova schermata futura con header custom** (`headerShown:
  false`): serve sempre un bottone indietro proprio, non basta contare su swipe/back del sistema —
  su iPhone in modalità PWA "Aggiungi a Home" semplicemente non esiste.

## Lista Gara: contenuto — 2026-08-21

Specifica di Francesco per la nuova schermata (vedi entry point sopra): **numeri 1-11 (titolari) e
12-20 (panchina)** assegnati a giocatori, più **6 ruoli di staff dedicati** — Allenatore,
Vice-Allenatore, Preparatore Atletico, Preparatore Portieri, Fisioterapista, Dirigente
Accompagnatore. Ogni assegnazione va scelta **prima tra i convocati di questa partita, con rosa/
staff completi come ripiego** (istruzione esplicita, ricevuta come messaggio successivo nella stessa
richiesta) — nessun altro vincolo sui ruoli di staff (un giocatore può coprire un ruolo di staff per
quella singola partita, es. player-coach: non è un errore, resta selezionabile).

- **Schema** — `App/supabase/25_schema_lista_gara.sql`: colonna `lista_gara` jsonb su `match_live`
  (stesso pattern di goals/subs/cards/lineup/convocazione — un valore per partita, nessuna nuova
  policy RLS, la tabella è già scritta da chi è Staff/Admin). Struttura: `{ numbers:
  Record<"1".."20", playerId>, staff: Record<ruolo, "player:<id>" | "staff:<id>"> }` — il prefisso
  `player:`/`staff:` sui valori di `staff` indica da quale tabella viene l'id scelto.
- **`app/data/matchLive.ts`**: `LISTA_GARA_STAFF_ROLES` (le 6 chiavi), `loadListaGara`/
  `saveListaGara` (default `{numbers:{}, staff:{}}` se la colonna è ancora vuota, stesso pattern
  delle altre get/set granulari).
- **`app/eventi/partita/[id]/listaGara.tsx`**: tre sezioni (Titolari 1-11, Panchina 12-20, Staff) —
  ogni riga si tocca per aprire un picker (modale a fondo schermo, sezione "Convocati" poi il
  ripiego) e si tiene premuta per svuotarla. I numeri pescano dalla rosa giocatori (convocati poi
  resto della rosa), i 6 ruoli di staff **solo** dalla Rosa Staff (convocati poi resto dello Staff
  — **mai i giocatori**, corretto il 2026-08-22 dopo un giro in cui erano selezionabili anche loro
  come ripiego: Francesco ha chiarito che non deve essere possibile). **Vincolo di unicità solo sui
  numeri** (un giocatore non può occupare due numeri contemporaneamente — l'elenco candidati per un
  numero esclude chi occupa già un altro numero): i 6 ruoli di staff sono indipendenti tra loro,
  nessun vincolo incrociato. Autosalva a ogni tocco, nessun bottone "Salva" esplicito (stesso stile
  di Convocazione/Formazione).

### Lista Gara: export PDF (2026-08-21)
Bottone "📄 Esporta PDF" in fondo alla schermata, stesso pattern di
`app/eventi/partita/[id]/convocazione.tsx` (modale pre-export per Competizione/Giornata, Luogo,
Data, Ora — prepopolati dalla partita — poi `printOrShareHtml`): banner "Lista Gara", intestazione
con logo squadra/titolo partita+competizione+data+luogo/logo avversario, due colonne (Titolari 1-11
+ Panchina 12-20 a sinistra, Staff a destra). **A differenza della Convocazione, ogni riga compare
sempre** (anche se non ancora assegnata, mostra "—") — un vero foglio di gara pre-partita ha tutti i
numeri stampati, non solo quelli occupati. **Nessun "Ritrovo"** (pertinente alla Convocazione, non
a un modulo per l'arbitro). **Il modello reale (layout ufficiale) sarà implementato più tardi**,
quando Francesco fornirà un riferimento — per ora è un layout generico coerente con quello della
Convocazione, non una replica di un documento federale specifico.

### Lista Gara: restyling schermata (2026-08-22)
Feedback di Francesco ("va tutto bene, la grafica è migliorabile"): ogni sezione (Titolari/Panchina/
Staff) è ora una card bianca con angoli arrotondati e una barra colorata d'accento accanto al
titolo, più una pillola con il conteggio compilato (es. "7/11") per capire a colpo d'occhio cosa
manca. Il pallino del numero cambia colore per sezione (verde brand per i Titolari, grigio-ardesia
per la Panchina) e i 6 ruoli di staff hanno un badge con sigla colorata (viola/indaco — "ALL",
"VICE", "P.ATL", "P.POR", "FISIO", "DIR") invece del solo testo. Una riga non ancora assegnata ha
bordo tratteggiato e sfondo leggermente più chiaro per invitare a compilarla, una già assegnata ha
bordo continuo. Aggiunte anche piccole rifiniture (ombra leggera sulle card/sul bottone PDF,
maniglietta in cima al modale di selezione). Resta un restyling "leggero" (stessa struttura a lista
verticale, non una griglia) — non verificato dal vero in questo giro, per lo stesso limite
dell'ambiente di test già segnalato più volte in questo file.

**Rimozione con bottone dedicato (2026-08-22, stesso giorno)**: la pressione lunga per svuotare una
riga è stata sostituita da un bottone "✕" rosso, sempre visibile a destra di ogni riga già
assegnata (numero o ruolo di staff) — richiesta esplicita di Francesco, la pressione lunga non era
scopribile/comoda quanto un bottone dedicato. Ogni riga ora è una `View` con dentro due `Pressable`
distinti (`rowMain` per aprire il picker, `removeBtn` per svuotare) invece di un unico `Pressable`
con `onLongPress`.

## Lista Gara: Staff configurabile dall'Admin + Capitano/Vice Capitano — 2026-08-22

Due richieste di Francesco insieme.

**Sezione Staff configurabile**: prima la sezione Staff (Allenatore/Vice-Allenatore/ecc.) era
sempre presente in Lista Gara. Ora l'Admin può disattivarla — di base resta attiva.
- Schema — `App/supabase/26_schema_lista_gara_staff_toggle.sql`: `organizations.lista_gara_show_staff`
  boolean, default `true` (stesso pattern di `show_training_attendance`/`surveys_enabled` — nessuna
  nuova policy RLS).
- `app/data/organization.ts`: `loadListaGaraShowStaff`/`saveListaGaraShowStaff`.
- UI: nuovo switch "Staff nella Lista Gara" in Gestione Squadra → Admin → Configurazioni
  (`app/squadra/staff.tsx`), accanto agli altri switch on/off della sezione (Registro presenze,
  Sondaggi).
- `app/eventi/partita/[id]/listaGara.tsx`: carica l'impostazione all'apertura; se disattivata, la
  sezione Staff non compare **né a schermo né nel PDF** (nel PDF la colonna Staff viene omessa del
  tutto, non lasciata vuota — il layout a colonne resta corretto con una sola colonna).

**Capitano e Vice Capitano**: su ogni riga numero già assegnata (Titolari o Panchina) sono apparsi
due chip "C"/"VC" accanto alla ✕ di rimozione — toccarli marca quel numero come capitano/vice
capitano (si escludono a vicenda: marcare "C" su un numero che era "VC" lo sposta a "C", mai
entrambi sulla stessa riga; toccare di nuovo lo stesso chip lo disattiva). Legato al **numero**, non
alla persona: se il numero viene svuotato con la ✕, la designazione capitano/vice si azzera insieme
(evita di lasciare un riferimento a un numero ormai senza giocatore).
- `app/data/matchLive.ts`: `ListaGaraData` ha due nuovi campi opzionali, `captainNumber`/
  `viceCaptainNumber` ("1".."20").
- Nel PDF: il nome del capitano/vice ha un suffisso `<b>(C)</b>`/`<b>(VC)</b>` accanto al nome, sia
  nella colonna Titolari sia in quella Panchina (un capitano può essere in panchina, es. se parte di
  riserva).

**Anno di nascita accanto al nome (stesso giorno)**: richiesta di Francesco — utile per l'arbitro
verificare le categorie Under/Over. `nameForNumber()` (unico punto usato sia a schermo sia nel PDF)
mostra ora "Nome Cognome · AAAA" invece del solo nome, quando il giocatore ha un `year` valido
(`Player.year`, sempre popolato salvo giocatori creati senza data di nascita). Solo per i numeri
1-20 (giocatori) — la Rosa Staff non ha un anno di nascita tracciato, `nameForStaffRole()` non è
toccata.

## Live: 5 bug/richieste dopo la prima partita vera — 2026-08-23

Francesco ha segnalato insieme, dopo aver usato Live per la prima partita reale della stagione:
il cronometro non scorreva, gli eventi (gol/cartellini/sostituzioni) a volte non venivano salvati,
le form di inserimento finivano sotto la barra di gesture di Android e non si chiudevano da sole,
le select mostravano un id al posto del nome del giocatore, e serviva un modo per impostare a mano
la durata di una partita mai seguita dal vivo. Tutto in `App/app/eventi/partita/[id]/live.tsx`
(~2350 righe, il file più grande dell'app) salvo dove indicato. Investigazione approfondita prima di
intervenire (4 agenti paralleli su timer/salvataggi/form-select/statistiche minutaggio), poi fix
mirati — nessuna riscrittura, il file resta nella sua struttura originale.

### 1. Cronometro che non scorre — causa reale: non un problema di rendering
`TimerProvider` (`app/context/TimerContext.tsx`) è montato **una volta sola per tutta l'app** in
`app/_layout.tsx` — il suo stato (`phase`/`isRunning`/`time`) **non è per-partita**, resta quello che
era anche cambiando schermata o partita. `live.tsx` aveva un `useEffect(() => {...}, [isRunning])`
che ad ogni cambio di `isRunning` chiamava `persistStart()`/`persistPause()` per tenere sincronizzato
il cronometro persistente (`persistTimer`, per-partita, su `match_live.timer_state`) — **ma un
`useEffect` gira sempre anche al primo mount**, non solo ai cambi veri. Tornando su Live di una
partita già avviata (es. dopo aver controllato Formazione, o un semplice sfondo/primo piano
dell'app), il componente si rimonta: `persistTimer` locale riparte dal suo valore di default
(`{running:false, startAt:null,...}`) mentre `isRunning` (globale) è **già `true`** da prima — questo
effect scatta comunque al mount con `isRunning === true`, legge il `persistTimer` di default (non
ancora ricaricato dal server) e chiama `persistStart()`, che scrive su Supabase un cronometro
"ripartito da ora" **sovrascrivendo quello reale**, in corsa con il caricamento asincrono del vero
stato dal server (`loadTimerState`) — a seconda di chi arriva per ultimo, il cronometro può restare
bloccato/azzerato in modo imprevedibile. **Fix**: rimosso quell'effect; ogni transizione (fine tempo,
inizio 2° tempo, pausa/ripresa manuale, reset) chiama ora `persistPause()`/`persistStart()` **in modo
esplicito**, esattamente come già facevano i bottoni Pausa/Start/Reset manuali (mai stati nel giro
dell'effect). La transizione intervallo→2° tempo (`onPressPhaseBtn`, fase `HALF_TIME`) usava due
chiamate separate (`setSecondHalfBaseline()` + `persistStart()`) che leggevano `persistTimer` dalla
stessa closure "vecchia" nello stesso tocco di bottone — la seconda ignorava l'aggiornamento appena
fatto dalla prima; unificate in una sola funzione atomica `startSecondHalf()` che calcola lo stato
finale direttamente, senza mai rileggere `persistTimer`.

### 2. Salvataggio "a volte sì a volte no"
Tre cause distinte, tutte in `live.tsx`:
- **Nessun errore mai mostrato**: `saveGoals`/`saveSubs`/`saveCards`/`saveLiveFormation`
  aggiornavano lo stato locale **prima** di scrivere su Supabase, senza `try/catch` in nessuno dei
  chiamanti (`persistGoal`, `persistCard`, `executeSubstitution`, `persistManual`, `confirmDelete`,
  i tre `persistEdit*`). Su una connessione instabile a bordo campo, un salvataggio poteva fallire
  in silenzio: l'evento sembrava inserito (stato locale già aggiornato) ma non lo era davvero.
  **Fix**: i quattro `save*` ora scrivono su Supabase **prima** di aggiornare lo stato locale (se
  fallisce, l'interfaccia non "mente"), e ogni chiamante ha un `try/catch` con `Alert.alert` +
  vincolo "un salvataggio alla volta" (nuovo stato `savingEvent`, disabilita il bottone e mostra
  "Salvataggio…" finché non finisce) — impedisce anche i doppi tocchi.
- **Loop infinito latente su `live_formation`**: `recomputeExpulsionsFromCards` (ricalcola chi è
  espulso ad ogni cambio cartellini) costruiva **sempre** un nuovo array (`.map` crea oggetti nuovi
  anche quando il valore non cambia) e lo salvava incondizionatamente; siccome questo salvataggio
  aggiorna `allPlayers`, che è la dipendenza dell'effect che richiama la stessa funzione, il giro
  ripartiva da capo **all'infinito** — scritture continue su `live_formation` in corsa con i
  salvataggi reali di gol/cartellini/sostituzioni, causa concreta e piuttosto grave del
  "a volte prende, a volte no". **Fix**: la funzione ora scrive solo se lo stato di espulsione di
  qualcuno è **davvero** cambiato.
- **Race su proposte multiple**: confermare due proposte di un Giocatore a tocchi ravvicinati poteva
  far leggere a entrambe la stessa copia (vecchia) di `goals`/`cards` — l'ultimo salvataggio vince e
  cancella l'altro (l'intera colonna viene riscritta, nessun merge lato server). **Fix**:
  `approveProposal` rilegge l'elenco più recente da Supabase subito prima di unire il nuovo evento.

### 3. Form sotto la barra di gesture Android + non si chiudevano da sole
Tutti gli 8 modali di inserimento/modifica evento usano lo stesso stile condiviso `sheet`, con un
padding fisso che non teneva conto della barra di navigazione Android. **Fix**: aggiunto
`paddingBottom: Math.max(insets.bottom, 16) + 16` (da `useSafeAreaInsets()`, già importato in questo
file) a tutti e 9 gli usi di `styles.sheet`. Sul "non si chiudono/non inseriscono l'evento": in realtà
il codice già chiudeva il modale **dopo** un salvataggio riuscito — il problema reale era il punto 2
sopra (salvataggi falliti in silenzio, quindi "sembra" che il modale non abbia fatto nulla): risolto
insieme al fix del salvataggio.

### 4. Select con l'id al posto del nome
Tutti i `Picker` di questo file (marcatore, cartellino, sostituzione entra/esce, inserimento manuale)
mostravano già correttamente `label={p.name}` — il bug non era lì. La causa vera:
`initializeLiveFormationFromLineup` (chiamata alla pressione di "Start") costruisce
`live_formation.name` con `idToName.get(id) || id` — se la Rosa (`usePlayers()`) non aveva ancora
finito di caricare (connessione lenta a bordo campo, esattamente lo scenario reale) quel fallback usa
l'**id** come nome, e viene salvato così **per sempre**: ogni volta che la formazione viene
ricaricata (anche ad ogni rientro sulla schermata, `useFocusEffect`), quel nome corrotto torna
identico, perché nessun punto del codice lo ricalcolava dalla Rosa. **Fix**: aggiunta una
risoluzione "sempre fresca" — `allPlayers`/`inCampo` ora hanno il nome ricalcolato dalla Rosa
(`usePlayers().allPlayers`) ogni volta che vengono caricati o salvati, più un effect dedicato che
si autocorregge da solo appena la Rosa finisce di caricare (senza dover uscire e rientrare dalla
schermata) — **si autoripara anche sulle formazioni già salvate con il bug**, non serve nessuna
migrazione dati.

### 5. Durata partita impostabile a mano
Per le statistiche minutaggio (`app/squadra/statistiche.tsx`, `app/player/[id].tsx`,
`app/utils/archiveBuilder.ts`) i minuti di chi non viene mai sostituito si calcolano come "durata
totale meno minuto di uscita/entrata" — prima **sempre fissa a 90'**, sbagliata per una partita mai
seguita dal vivo (nessuno ha usato il cronometro) o più corta del normale. Aggiunto un campo "Durata
partita (minuti)" nel modale "Termina partita" di Live (default 90, precompilato se già impostato),
salvato come `matchDurationMinutes` sull'evento — usato con priorità dalle tre viste statistiche
sopra (fallback: ultimo minuto registrato tra gol/cambi/cartellini, poi 90'). **Nuovo link** "🏁
Termina/aggiorna partita senza cronometro", visibile sempre (Staff/Admin) finché la fase non è già
"Fine partita": apre lo stesso modale indipendentemente da quanto il cronometro sia stato usato,
perché altrimenti quel modale si raggiunge solo passando per tutte le fasi — irraggiungibile per una
partita mai avviata dal vivo. Rimossi i due campi morti mai popolati `duration`/`matchLength` in
`statistiche.tsx` (e la clausola `Math.max(90, ...)` che avrebbe comunque impedito una durata
impostata più corta di 90').

**Verifica dal vero necessaria con priorità molto alta, prima della prossima partita**: sono bug reali
osservati in game, non ipotetici — in particolare il cronometro (uscire e rientrare da Live a partita
avviata, verificare che non si azzeri/blocchi), il salvataggio di più eventi ravvicinati (anche con
connessione debole simulata), e che una formazione già "sporca" con id al posto del nome si corregga
da sola aprendo la schermata.

## Live: Formazione che si azzerava da sola — 2026-08-23 (stesso giorno, secondo giro)

Francesco ha segnalato, dopo il giro sopra: impostando la formazione in `formazione.tsx` e tornando
indietro, la disposizione non risultava salvata. **Causa: un bug deterministico, non una race**.
L'effect che carica la formazione già salvata (`useEffect(..., [matchId])`) traduce gli id salvati in
oggetti `Player` cercandoli in `basePlayers` (da `usePlayers()`) — ma quell'effect gira **una sola
volta** e la sua closure resta legata per sempre a `basePlayers` **di quel preciso render**. Al primo
render `basePlayers` è **sempre** `[]` (lo stato iniziale dell'hook, prima che la fetch a Supabase
risponda) — e siccome l'effect non aveva `basePlayers`/il flag `loading` tra le dipendenze, non si
riesegue mai quando la Rosa finisce di caricare poco dopo. Risultato: **ogni singola volta** che si
apre questa schermata, ogni giocatore della formazione salvata falliva la ricerca per id e veniva
scartato (`idToPlayer.get(pid)` su una mappa vuota → sempre `null`) — la formazione risultava vuota
sullo schermo, e l'effect di autosalvataggio (che reagisce a qualsiasi cambio di
`fieldAssignments`/`benchAssignments`) scriveva subito quella vuotezza sul server, **cancellando per
davvero** la formazione appena vista come vuota. Non serviva una connessione lenta perché si
manifestasse: la fetch di `usePlayers()` richiede sempre almeno un giro di rete, quindi è sempre più
lenta del primo render di questo effect.

- **Fix**: `usePlayers()` ora espone anche `loading` in questa schermata (`basePlayersLoading`),
  aggiunto alle dipendenze dell'effect di caricamento — l'effect si riesegue davvero quando la Rosa
  finisce di caricare, questa volta con `basePlayers` popolato.
- **Fix collaterale**: gli effect di autosalvataggio (lineup e, in Live, le posizioni) potevano avere
  più scritture in volo insieme (ogni assegnazione ne fa partire una) senza un ordine garantito — una
  per uno stato "vecchio" poteva arrivare al server dopo quella per lo stato più recente,
  sovrascrivendolo. Aggiunta una coda (`useRef<Promise<void>>`, ogni nuova scrittura aspetta che la
  precedente sia finita) a entrambi, così l'ultima modifica vince sempre per davvero.
- **Verifica dal vero ad altissima priorità**: impostare una formazione completa, tornare indietro,
  riaprire la schermata e controllare che sia ancora quella giusta — sia da ferma (pre-partita) sia
  durante il drag in Live.

## Live/Formazione: causa residua + punto di partenza dalla Lista Gara — 2026-08-24

Il fix del 2026-08-23 sopra risolveva un bug reale, ma Francesco ha confermato che il problema
persisteva ancora: **una seconda causa, diversa**, nella stessa schermata.

### Causa residua: si poteva assegnare durante il caricamento
`formazione.tsx` non aveva **nessuno stato di caricamento visibile** — la schermata si rendeva subito
con l'editor pienamente interagibile, mentre in background partivano le fetch di Rosa/lineup/
posizioni. Se il coach toccava un giocatore prima che quelle fetch finissero, la sua assegnazione
finiva nello stato locale (`fieldAssignments`/`benchAssignments`) — ma quando la fetch della
formazione salvata completava poco dopo, il suo `setFieldAssignments(fieldById)` **sovrascriveva
silenziosamente** quell'assegnazione appena fatta (stessa famiglia del bug di ieri, stavolta sulla
finestra di editing invece che sul solo caricamento id→giocatore). Su una connessione lenta a bordo
campo questa finestra poteva durare diversi secondi — abbastanza per assegnare più giocatori prima
che tutto andasse perso.

**Fix**: nuovo stato `screenReady` (non solo il `loadedRef` interno, usato solo dagli effect) —
finché non diventa `true` (Rosa **e** lineup/posizioni caricati) l'editor non viene proprio renderizzato,
solo un indicatore di caricamento. Nessuna interazione possibile prima che i dati veri siano a posto,
quindi nessuna finestra in cui un'assegnazione fresca possa essere sovrascritta da un caricamento
ancora in corso.

### Nuova funzionalità: formazione di default dalla Lista Gara
Richiesta di Francesco: se una partita non ha ancora una formazione impostata (mai salvata, o salvata
ma completamente vuota — l'autosalvataggio ne scrive comunque una vuota alla prima apertura, quindi
"salvata" da sola non basta a distinguere le due situazioni) e la **Lista Gara** ha già dei numeri
assegnati, usarli come disposizione iniziale: titolari (numeri 1-11) piazzati sul campo per reparto
(stessa euristica di "Disponi automaticamente", `autoAssignPlayersToSlots` in
`app/utils/autoFormation.ts` — profondità dello slot vs `Player.role`, non l'id dello slot), panchina
(numeri 12-20), **numeri di maglia compresi** (passati come `previousNumbers` alla stessa funzione,
così restano quelli della Lista Gara invece di sparire).
- Nuovo effect dedicato (non dentro l'effect di caricamento lineup, che gira prima che il modulo sia
  risolto): aspetta `screenReady`, che `hasSavedLineup` sia risultato `false`, che `fieldSlots` non
  sia vuoto (il modulo dev'essere già risolto — gli slot su cui piazzare i titolari non esistono
  prima), e che l'utente non abbia già iniziato ad assegnare qualcosa a mano nel frattempo. Un
  `useRef` (`appliedListaGaraDefaultRef`) garantisce che scatti **una sola volta** per visita alla
  schermata — non risincronizza continuamente con la Lista Gara dopo il primo popolamento, altrimenti
  cambiare modulo dopo aver svuotato tutto a mano la riproporrebbe inaspettatamente.
- **Non tocca nulla per il ruolo Giocatore** (`readOnly`): un accesso in sola lettura non deve
  innescare una scrittura.
- Il risultato di questo popolamento viene comunque salvato dal normale effect di autosalvataggio
  (nessuna logica di salvataggio duplicata) — diventa a tutti gli effetti la prima formazione
  "vera" salvata per la partita, modificabile liberamente subito dopo.

**Da verificare dal vero, priorità molto alta**: aprire Formazione per una partita con Lista Gara già
compilata e nessuna formazione impostata — verificare che si popoli da sola con titolari/panchina e
numeri corretti; assegnare più giocatori molto rapidamente all'apertura della schermata (anche su
connessione lenta) e controllare che nulla vada perso; controllare che una formazione già impostata
in precedenza non venga MAI sovrascritta dalla Lista Gara.

## Live: select del giocatore non scorrevano nei modali di inserimento evento — 2026-08-24

Effetto collaterale del fix "form sotto la barra di gesture Android" del round precedente: quel fix
aveva aggiunto un `paddingBottom` extra al contenitore (`sheet`) di tutti i modali di Live (gol,
cartellino, sostituzione, inserimento manuale, modifica, fine partita) — ma nessuno di quei modali
aveva mai avuto una `ScrollView` al proprio interno, contavano sul fatto che il contenuto ci stesse
per intero nello schermo. Con il padding in più, su schermi piccoli o con più select in uno stesso
modale (in particolare **Sostituzioni**, 3 Picker, e **Inserimento manuale**, fino a 4 Picker), il
contenuto poteva superare l'altezza visibile — senza modo di scorrere per raggiungere il resto,
compreso il Picker stesso o i bottoni Salva/Annulla.

**Fix**: `styles.sheet` ha ora un `maxHeight: '85%'`, e il contenuto dei 7 modali con più campi (gol,
sostituzione, cartellino, modifica gol, modifica cartellino, fine partita, inserimento manuale) è
avvolto in una `ScrollView` (`keyboardShouldPersistTaps="handled"`, per non perdere il tocco su un
bottone mentre la tastiera del campo "Minuto" è ancora aperta). I due modali senza Picker e con un solo
campo (conferma eliminazione, modifica sostituzione — solo minuto) non ne avevano bisogno, lasciati
com'erano.

**Da verificare dal vero**: aprire ciascuno dei modali con un Picker (in particolare Sostituzioni e
Inserimento manuale) su un telefono con schermo piccolo e controllare che tutto il contenuto sia
raggiungibile scorrendo, Picker compreso.

## Live/Formazione: id ancora al posto del nome + select non scorrevole in Formazione — 2026-08-24 (terzo giro)

Il fix precedente non bastava: indagine da zero (senza fidarsi dei fix passati) su tutti e tre i
sintomi ancora segnalati. Trovate due cause reali, distinte da tutto quanto corretto finora.

**1) Id al posto del nome — ancora in `initializeLiveFormationFromLineup` (`live.tsx`)**: questa
funzione (chiamata alla pressione di "Start") costruiva la mappa id→nome usando `basePlayers`
(`usePlayers().players`, **solo attivi**) invece di `baseAllPlayers`/`basePlayersById` (attivi + ex,
già usati per l'autocorrezione altrove in questo stesso file). Un convocato spostato tra gli ex
**dopo** essere stato messo in formazione ma **prima** di premere Start faceva fallire la ricerca per
sempre, a prescindere da quanto la Rosa avesse già finito di caricare — non era la race di
caricamento già risolta, una causa diversa. Scriveva inoltre la lista "grezza" (non passata da
`withFreshNames`) sia su Supabase sia nello stato locale, quindi l'autocorrezione scattava solo al
prossimo caricamento/focus, non subito. **Fix**: usa `basePlayersById` (attivi+ex) e applica
`withFreshNames` prima di salvare e di aggiornare lo stato.

**2) Formazione "non salvata bene" nella select — in realtà i convocati diventati ex sparivano**: il
caricamento della formazione già salvata (`formazione.tsx`) traduceva gli id in giocatori usando
`basePlayers` (solo attivi) — un convocato spostato tra gli ex dopo essere stato schierato spariva
in silenzio dalla formazione ricaricata (letto come "giocatore non trovato" e scartato), dando
l'impressione che la formazione non fosse stata salvata. **Fix**: usa `baseAllPlayers` (attivi+ex)
per questa lettura — resta corretto usare i soli attivi per decidere chi è assegnabile ORA
(`availablePlayers`, "Disponi automaticamente"), solo la lettura di ciò che è già stato salvato deve
includere anche gli ex.

**3) Select non scorrevole nel modale "Scegli giocatore" di Formazione**: stesso bug già corretto nei
modali di Live (`sheet`) ma mai applicato qui — il contenitore del modale (`modalCard`) ha un
`maxHeight`, ma la `FlatList` al suo interno non aveva alcun limite proprio: senza, prova a
rendersi alla sua altezza naturale e con una rosa lunga il contenuto (bottone "Chiudi" compreso)
finiva fuori dallo schermo, irraggiungibile. **Fix**: `maxHeight: 360` sulla FlatList
(`formazione.tsx`, nuovo stile `pickList`). Applicato per lo stesso motivo anche a
`ConvocatiPlayersModal.tsx` (stesso identico difetto strutturale, non ancora segnalato ma con lo
stesso bug), usato da Convocazione e da "Modifica Convocati" in Live.

**Da verificare dal vero con priorità altissima**: convocare un giocatore, spostarlo tra gli ex,
verificare che compaia ancora correttamente (col nome giusto) sia in Formazione sia in Live dopo
Start; aprire il modale "Scegli giocatore" in Formazione con una rosa lunga e controllare che si
scorra fino in fondo, bottone "Chiudi" compreso.

## Statistiche: gol subiti dal portiere come numero negativo — 2026-08-24

La colonna "Gol" in Statistiche squadra (schermata, export CSV, stampa PDF — `app/squadra/
statistiche.tsx`) mostra già da tempo, per il ruolo Portiere, i gol **subiti** invece dei gol
**fatti** (`golUnico = p.role === 'PORTIERE' ? s.goalsConceded : s.goals`) — ma senza alcun segno, un
numero come "3" nella riga di un portiere poteva sembrare "3 gol fatti" invece di "3 subiti".
Richiesta di Francesco: mostrarli come numero negativo (-1, -2, ...), coerente in tutti e tre i
punti (schermata, CSV, PDF). Nella schermata e nel PDF il numero negativo è anche evidenziato in
rosso (`#b91c1c`, stesso principio dei cartellini gialli/rossi già colorati) — nel CSV resta un
numero semplice (nessuna formattazione possibile in un file dati). Nessuna migrazione: `goalsConceded`
è già calcolato correttamente, cambia solo la formattazione in lettura.

## Calendario unificato, Competizione/Giornata, Altre Partite, pagina partita a 4 riquadri — avviato 2026-08-24

Richiesta di Francesco in 4 parti (piano completo salvato e concordato, si procede in fasi separate
con verifica tra una e l'altra): 1) bottone Home "Calendario" unico al posto di Allenamenti/Partite
separati; 2) partite con "Competizione - Nª Giornata" in evidenza, insieme a nome/stemma
dell'avversario; 3) sezione "Altre Partite" dentro ogni partita, con gli incontri delle altre
squadre della stessa giornata (testo libero) e allegati formazioni (foto/PDF); 4) pagina partita
con griglia 2×2 (Convocati/Lista Gara/Live/Altre Partite) al posto delle 3 card attuali. Ordine di
lavoro: Punto 2 (piccolo, base per il 3) → Punto 3 (isolato) → Punto 4 (visivo) → Punto 1 (il più
grosso, ultimo).

### Punto 2 — Competizione + Giornata (fatto, da verificare dal vero)
`giornata` è un nuovo campo **testo libero** (come già `competition`), salvato nella stessa colonna
dinamica `data` di `events` — nessuna migrazione SQL.
- **`app/components/partite/CompetitionModal.tsx`**: ogni round del calendario-competizione ha ora
  un campo "Giornata" precompilato in sequenza (round 1 → giornata "1", ecc.) ma modificabile a mano
  per round (utile per rinvii/recuperi che spostano una partita fuori dal suo ordine naturale).
- **`app/components/partite/EditMatchModal.tsx`**: oltre a data/ora/luogo (già editabili, vedi sotto
  "Modifica data/ora/luogo"), ora **anche Competizione e Giornata** sono correggibili qui — prima
  l'unico modo per cambiarle era eliminare e ricreare la partita.
- **`app/partite.tsx`** (poi diventato `app/components/calendario/PartiteTab.tsx` col Punto 1 più
  sotto): il form di creazione singola partita ha lo stesso nuovo campo "Giornata (opzionale)";
  `MatchEventRow`/gli handler di creazione e modifica lo propagano.
- **`app/components/partite/MatchEventCard.tsx`**: il badge in alto mostra ora "Competizione ·
  Nª Giornata" (invece della sola competizione) quando la giornata è impostata; aggiunta anche
  un'icona/stemma dell'avversario (`event.opponentLogoPath`, già caricato dal tab Convocazione)
  accanto al nome — richiesta esplicita di Francesco dopo la prima bozza di piano ("deve essere
  presente anche nome, se inserito anche lo stemma, dell'avversario della giornata").
- **Verifica**: `tsc --noEmit` + `npx expo export -p web` puliti. **Da verificare dal vero**: creare/
  modificare una partita con Competizione+Giornata e controllare che compaia nel formato corretto
  nella lista Partite.

### Punto 3 — Altre Partite (fatto, da verificare dal vero)
Nuova sezione per partita con gli incontri delle altre squadre della stessa giornata — **testo
libero**, nessun collegamento alla rosa reale.
- **Schema** — `App/supabase/27_schema_matchday_fixtures.sql`: tabella `matchday_fixtures` (id, org,
  competition, giornata, home_team, away_team, home_score, away_score, scorers) — chiave
  **(org_id, competition, giornata)**, non un id-partita, stesso principio di `competition_rules`:
  inserendo un incontro da una qualsiasi delle nostre partite di quella giornata, compare
  automaticamente anche aprendo "Altre Partite" da un'altra nostra partita della stessa
  giornata/competizione. Tabella `matchday_fixture_attachments` (id, org, fixture_id, name,
  storage_path) + bucket Storage pubblico `matchday-attachments` (4 policy SELECT/INSERT/UPDATE/
  DELETE, stesso pattern-fix di `14_schema_storage_select_fix.sql`) per foto/PDF delle formazioni.
  RLS: lettura `is_member_of`, scrittura `is_staff_or_admin_of` (compreso l'upload sul bucket).
- **`app/data/matchdayFixtures.ts`** (nuovo): `loadFixtures(competition, giornata)`, `addFixture`,
  `updateFixture`, `removeFixture` (cancella anche gli allegati, storage compreso, prima della riga),
  `loadFixtureAttachments`, `addFixtureAttachment` (upload generico `application/octet-stream`,
  stesso pattern di `playerMedia.ts`'s `addAttachment` — funziona sia per immagini sia per PDF),
  `removeFixtureAttachment`.
- **`app/eventi/partita/[id]/altrePartite.tsx`** (nuovo): legge competizione/giornata della partita
  corrente — se una delle due manca, banner che invita a impostarle prima (da Calendario/Partite,
  bottone "✏️", solo Admin) invece della lista. Altrimenti: card per incontro (squadre, risultato,
  marcatori, allegati), aggiungi/modifica/elimina rapidi (Staff/Admin), allega foto o PDF
  (`expo-document-picker`, filtro `image/*`+`application/pdf`). Sola lettura per il Giocatore, stesso
  principio di tutte le altre schermate di partita.
- **Verifica**: `tsc --noEmit` + `npx expo export -p web` puliti. **Da verificare dal vero**:
  aggiungere 2-3 incontri della stessa giornata da una partita e controllare che compaiano anche
  aprendo "Altre Partite" da un'altra nostra partita della stessa giornata/competizione; allegare una
  foto e un PDF e verificare che si aprano correttamente.

### Punto 4 — Pagina partita a 4 riquadri (fatto, da verificare dal vero)
`app/eventi/partita/[id]/index.tsx`: le 3 card in riga (Convocazione/Lista Gara/Live) sono diventate
una griglia 2×2 (`flexWrap`, ogni riquadro ~48% larghezza, `aspectRatio` generoso) con l'aggiunta di
un quarto riquadro **"🗓️ ALTRE PARTITE"** (verso `altrePartite.tsx`). Nessun'altra logica della
schermata cambia (resta raggiungibile solo pre-Start per Staff/Admin, redirect a Live invariato; la
vista minimale del Giocatore pre-Start non è toccata).

### Punto 1 — Calendario unificato (fatto, da verificare dal vero — il più grosso)
Sostituiti i due bottoni Home "🏃 Allenamenti"/"🏆 Partite" con un unico **"📅 Calendario"**
(`router.push('/calendario')`). Strategia seguita: **spostare**, non riscrivere — tutta la logica di
`app/allenamenti.tsx` e `app/partite.tsx` (ora cancellati come route) vive, invariata, in due nuovi
componenti; nessuna funzionalità persa.
- **`app/components/MonthCalendarGrid.tsx`** (nuovo): il calendario mensile a griglia (6×7, swipe tra
  mesi, modale di scelta quando un giorno ha più eventi) **estratto** da `app/index.tsx` — props
  `events`/`onSelectEvent`, completamente self-contained (mese mostrato e modale sono stato interno).
  Riusato identico sia in Home sia nel nuovo Calendario. Home (`app/index.tsx`) non ha più la sua
  copia inline di `viewMonth`/`renderMonthGrid`/`monthPanResponder`/il modale multi-evento — solo
  `<MonthCalendarGrid events={events} onSelectEvent={goToEvent} />`; il blocco "Oggi e domani"
  (diverso, non toccato) mantiene le proprie `pillColor`/`formatEventPill` in loco.
- **`app/components/calendario/AllenamentiTab.tsx`** (nuovo, da `app/allenamenti.tsx`): statistiche,
  crea singolo, "Settimana ideale", sezioni Oggi/Prossimi/Passati, cancellazioni, Import/Export/
  Modello Excel — identico, tolti solo header/SafeAreaView/`ScrollView` propri (il Calendario fornisce
  un unico scroll per tutta la pagina).
- **`app/components/calendario/PartiteTab.tsx`** (nuovo, da `app/partite.tsx`): crea singola, crea
  calendario competizione, filtro competizione, Regole Under/Over, modifica data/ora/luogo/
  competizione/giornata, cancellazioni, Import/Export/Modello Excel — identico, stessa rimozione di
  header/SafeAreaView/scroll propri. Il componente `SingleMatchModal` locale (usato davvero da questo
  file) resta inline; **eliminato invece** `app/components/partite/SingleMatchModal.tsx`, una
  seconda copia mai importata da nessuno (codice morto già identificato durante la fase di
  pianificazione).
- **`app/calendario.tsx`** (riscritto da zero — prima era una semplice lista piatta): header con
  bottone indietro/`TeamLogo`/titolo, `MonthCalendarGrid` in cima, un selettore a due voci
  "🏃 Allenamenti / 🏆 Partite" (solo uno dei due tab è montato per volta) e il tab scelto sotto,
  tutto dentro un unico `ScrollView`. Accetta un parametro di route opzionale `?tab=partite` per
  aprirsi direttamente sul tab Partite — usato da `live.tsx` (i due `router.replace('/partite')` a
  fine/uscita partita puntano ora a `router.replace({ pathname: '/calendario', params: { tab:
  'partite' } })`, unico altro punto dell'app che navigava verso la vecchia route `/partite`).
- **Verifica**: `tsc --noEmit` + `npx expo export -p web` puliti; avviato anche un server locale
  (`npx expo start --web`) e controllato che la schermata di login si carichi senza errori console —
  **non verificato oltre il login** (richiede credenziali reali). **Da verificare dal vero con
  priorità molto alta, dato quanto è ampio questo spostamento**: ripetere OGNI operazione che prima
  viveva in Allenamenti (settimana ideale, singolo, cancellazioni, Excel) e in Partite (competizione,
  singola, Regole, modifica, cancellazioni, Excel) dal nuovo Calendario e confermare che si comportino
  esattamente come prima; il tap su un giorno della griglia mensile deve aprire l'evento giusto; il
  passaggio da Live a "torna a Partite" deve aprire il Calendario già sul tab Partite.

### Fix: griglia 4 riquadri poco leggibile + icone/colori/giornata nel calendario mensile — 2026-08-24 (secondo giro)
Feedback di Francesco dopo il primo giro: "I quattro quadrati sulla partita non si vedono bene, sul
calendario (sia Home sia Calendario) devono vedersi le icone e deve essere in qualche modo
evidenziato il numero della giornata e la competizione (anche con colori diversi in base alla
competizione)".

**Griglia 4 riquadri** (`app/eventi/partita/[id]/index.tsx`, Punto 4): causa reale — il contenitore
attorno alla griglia non aveva `flex: 1`, quindi la griglia si dimensionava solo in base
all'`aspectRatio` delle card (piccola, con molto spazio vuoto sotto, ben lontana da "quasi tutto lo
schermo" come da richiesta originale), e `width: '48%'` + `gap: 12` in un `flexWrap` poteva far
"saltare" la seconda card a capo su schermi stretti per arrotondamento (grafica non prevedibile).
**Fix**: struttura a due righe esplicite (`gridRow`, una per coppia di riquadri) invece di
`flexWrap`, ciascuna `flex: 1` dentro un contenitore `cardsGrid` anch'esso `flex: 1` — la griglia
ora riempie davvero lo spazio verticale disponibile sotto l'intestazione, indipendentemente dalla
larghezza schermo. Aggiunto anche un cerchietto colorato dietro ogni icona (`iconBadge`, un colore
diverso per riquadro) per renderle più leggibili, bordo sottile sulle card e sottotitolo di
competizione/giornata sotto il titolo partita.

**Calendario mensile** (`app/components/MonthCalendarGrid.tsx`, usato sia da Home sia dal nuovo
Calendario): le pillole degli eventi mostravano solo testo (nessuna icona) e MAI la giornata — solo
"Ellera - Avversario · Competizione", troncato a una riga già prima della giornata. Nuovo file
condiviso **`app/utils/eventDisplay.ts`** (elimina anche una duplicazione: `pillColor`/
`formatEventPill` esistevano identiche sia in `MonthCalendarGrid.tsx` sia in `app/index.tsx`):
- `eventColor(ev)`: allenamento sempre verde; una partita **senza** competizione resta rossa (come
  prima); una partita **con** competizione prende un colore stabile ricavato da un hash del nome
  competizione (stessa competizione → sempre lo stesso colore, tra una tavolozza di 8) — soddisfa
  "colori diversi in base alla competizione".
- `eventIcon(ev)`: ⚽ per le partite, 🏃 per gli allenamenti — anteposto al testo di ogni pillola e
  di ogni riga della modale "Eventi del giorno" e del blocco "Oggi/Domani" in Home.
  `eventCompactLabel(ev)`: pensata per lo spazio minuscolo di una pillola nella griglia mensile —
  per una partita mostra **il numero di giornata PRIMA dell'avversario** (es. "5ª · Real Foligno"),
  visibile prima del troncamento a una riga invece di sparire in coda come accadeva con il vecchio
  formato; la competizione non è ripetuta per esteso qui perché già distinguibile dal colore.
  `eventFullLabel(ev)`: formato esteso invariato (usato dove lo spazio non manca — blocco "Oggi/
  Domani", modale "Eventi del giorno").
- **Verifica**: `tsc --noEmit` + `npx expo export -p web` puliti; verificato che la schermata di
  login si carichi senza errori console con un server locale. **Non verificabile oltre il login in
  questo ambiente** (richiede credenziali reali) — **verifica dal vero necessaria**: aprire una
  partita pre-Start e controllare che i 4 riquadri riempiano bene lo schermo; controllare che nella
  griglia mensile (Home e Calendario) compaiano le icone ⚽/🏃, che partite di competizioni diverse
  abbiano colori diversi e che il numero di giornata sia leggibile nella pillola.

### Altre Partite: Competizione/Giornata impostabili sul posto — 2026-08-24 (terzo giro)
Feedback di Francesco: "Non capisco perché per usare Altre Partite devo aver già messo
Competizione e Giornata [altrove] — voglio inserire i record manualmente in qualsiasi momento."
`app/eventi/partita/[id]/altrePartite.tsx`: rimosso il banner che bloccava l'intera sezione se la
partita non aveva ancora Competizione/Giornata — sostituito con due campi **editabili direttamente
in questa schermata** (card in cima, sempre visibile), che salvano su `patchEventData(matchId,
{competition, giornata})` al blur di ciascun campo (stessa colonna letta da MatchEventCard/
EditMatchModal/CompetitionModal — restano coerenti ovunque). Solo l'elenco/aggiunta incontri resta
condizionato ad averle entrambe compilate (messaggio leggero inline, non più un blocco a piena
pagina), perché la chiave di condivisione tra le nostre partite della stessa giornata resta
`(competition, giornata)` — invariato lo scopo della funzionalità, sparita solo la necessità di
uscire dalla schermata per compilarle prima.

### Squadre fisse per competizione (nome, stadio, stemma) — 2026-08-24 (stesso giorno)
Richiesta di Francesco: poter configurare le squadre di una competizione una volta sola (con
stadio e stemma) e riusarle come scelta rapida ovunque si scelga un avversario/le squadre di un
incontro, invece di ridigitare sempre lo stesso nome a mano.
- **Schema** — `App/supabase/28_schema_competition_teams.sql`: tabella `competition_teams` (id,
  org_id, competition, name, stadium, logo_path) — chiave `(org_id, competition)`, stesso
  principio di `competition_rules`/`matchday_fixtures` (le competizioni sono testo libero, non
  un'entità a parte). Lo stemma **riusa il bucket Storage esistente `team-logos`** (path
  `{org_id}/competition-team-{id}.{ext}`, nessuna policy nuova necessaria) invece di crearne uno
  dedicato: è un dettaglio voluto, non solo un'ottimizzazione — quando una squadra viene scelta dai
  chip, il suo `logo_path` diventa direttamente l'`opponentLogoPath` della partita creata, che si
  risolve sempre con `opponentLogoUrlFromPath()` puntata a `team-logos`; un bucket diverso qui
  avrebbe prodotto un URL rotto ovunque lo stemma avversario viene mostrato. Aggiunta anche
  `organizations.home_stadium` (colonna testo) — lo stadio di casa della propria squadra, un solo
  valore per organizzazione.
- **`app/data/competitionTeams.ts`** (nuovo): `loadCompetitionTeams(competition)`,
  `addCompetitionTeam`, `updateCompetitionTeam`, `removeCompetitionTeam`,
  `uploadCompetitionTeamLogo(teamId, localUri)` (stesso pattern upload di `playerMedia.ts`).
  `app/data/organization.ts`: `loadHomeStadium`/`saveHomeStadium`.
- **`app/components/partite/CompetitionTeamsModal.tsx`** (nuovo, condiviso): elenco squadre di una
  competizione — nome e stadio editabili inline (autosalva al blur), stemma caricabile toccando
  un'icona 📷 per riga (`expo-image-picker`, stesso flusso del logo squadra in Admin), "+" per
  aggiungerne una nuova. Nessun bottone "Salva" esplicito.
  - Raggiungibile da **Partite** (nuovo bottone "🏟️ Squadre" accanto a "⚙️ Regole", visibile solo
    con una competizione specifica selezionata nel filtro — stesso posizionamento di
    `CompetitionRulesModal`).
  - Raggiungibile anche da **dentro "Crea Calendario Competizione"** (`CompetitionModal.tsx`,
    nuovo bottone "🏟️ Configura Squadre della competizione", abilitato quando il nome competizione
    non è vuoto) — così le squadre si configurano nello stesso momento in cui si crea il
    calendario, senza uscire dal flusso.
- **Riuso automatico** (il punto centrale della richiesta): ovunque si sceglie un avversario/una
  squadra da un elenco già configurato, sotto il campo compare una riga di chip (nome + stemma se
  presente) — toccarne uno imposta il nome **e**, se il campo Luogo è ancora vuoto, lo precompila
  (stadio della squadra se si gioca in TRASFERTA, `home_stadium` dell'organizzazione se si gioca in
  CASA) **e** collega lo stemma configurato come `opponentLogoPath` della partita creata (stesso
  campo, in `events.data`, già consumato da `MatchEventCard`/pagina pre-partita per mostrare lo
  stemma avversario — prima si poteva impostare solo a mano dal tab Convocazione).
  - `CompetitionModal.tsx`: chip per ogni round, sotto "Avversario" (`pickTeamForRound`); il
    nuovo campo `NewRound.opponentLogoPath` arriva fino a `handleCreateCompetition`
    (`PartiteTab.tsx`) che lo scrive sull'evento creato.
  - `SingleMatchModal` (inline in `PartiteTab.tsx`): stessa logica (`pickTeam`), squadre caricate
    in base al testo digitato nel campo Competizione di quel modale.
  - `altrePartite.tsx`: chip sotto "Squadra Casa"/"Squadra Trasferta" nel modale incontro, più lo
    stemma mostrato direttamente nella card di ogni incontro quando il nome squadra corrisponde a
    una squadra configurata.
  - In tutti i casi resta possibile digitare un nome libero non in elenco (nessun vincolo, solo
    una scorciatoia in più).
- **Admin** (`app/squadra/staff.tsx`, sezione Configurazioni): nuovo campo "Stadio di casa"
  (autosalva al blur) — `organizations.home_stadium`.
- **Verifica**: `tsc --noEmit` + `npx expo export -p web` puliti. **Da verificare dal vero**:
  configurare 2-3 squadre con stadio e stemma per una competizione, creare un calendario partite
  scegliendo quelle squadre dai chip e controllare che Luogo/stemma si precompilino correttamente
  sia in CASA sia in TRASFERTA; verificare lo stesso per la creazione di una singola partita e per
  le due squadre di un incontro in Altre Partite.

### Pagina partita: griglia a 4 riquadri sempre raggiungibile + Altre Partite senza prerequisiti — 2026-08-24 (quarto giro)
Feedback di Francesco: "Quando clicco su una partita devo sempre arrivare sulle 4 card (Live,
Altre Partite, Convocati, Lista Gara) anche se la partita è in corso o finita" — collegato al
punto precedente: il vero blocco non era (solo) l'obbligo di Competizione/Giornata, ma il fatto che
**qualunque partita già avviata reindirizzava dritta a Live**, rendendo Altre Partite (e
Convocazione/Lista Gara) irraggiungibili proprio quando servono di più (durante/dopo la partita).
- **`app/eventi/partita/[id]/index.tsx`**: il redirect automatico a Live quando `started` è vero
  ora si applica **solo al Giocatore** (per lui non cambia nulla — dopo lo Start va sempre dritto
  su Live, comportamento voluto). Per Staff/Admin la griglia a 4 riquadri è sempre quella che si
  vede aprendo una partita, qualunque sia il suo stato (da avviare, in corso, finita) — "LIVE"
  resta uno dei 4 riquadri, non più l'unica destinazione forzata.
- **Altre Partite senza prerequisiti** (`altrePartite.tsx`, seguito diretto: "deve essere possibile
  crearlo in ogni momento, anche se non c'è la competizione impostata"): rimosso anche l'ultimo
  vincolo — Competizione/Giornata sono ora del tutto **opzionali**, la sezione si usa comunque.
  Nuovo `fixtureKey(comp, giornata)`: se almeno uno dei due campi è compilato, la chiave di
  condivisione resta quella originale (condivisa con le altre nostre partite della stessa
  giornata/competizione); se sono **entrambi vuoti**, usa l'id di questa partita come chiave
  privata — così due partite diverse, entrambe senza competizione impostata, non si ritrovano per
  errore a condividere lo stesso elenco di "altre partite" (bug potenziale evitato, non richiesto
  esplicitamente ma necessario per non rompere l'isolamento tra partite scorrelate). Le squadre
  configurate (chip) restano legate a una competizione con nome reale — senza competizione
  impostata l'inserimento squadre resta comunque **sempre possibile a mano** (il campo di testo
  libero non è mai stato condizionato dai chip, invariato).
- **Verifica**: `tsc --noEmit` + `npx expo export -p web` puliti. **Da verificare dal vero**:
  aprire una partita già in corso o già finita e controllare che si vedano sempre le 4 card (non
  il redirect a Live); aprire Altre Partite di una partita senza Competizione/Giornata e
  verificare che si possano comunque aggiungere incontri liberamente.

### Fix: stemma squadra senza anteprima + Luogo non si aggiornava passando a Trasferta — 2026-08-24 (quinto giro)
Due bug segnalati da Francesco su "Squadre della competizione" (`CompetitionTeamsModal.tsx`) e sul
Luogo automatico introdotti nel giro precedente.

**1) Stemma "non si riesce a inserire"**: causa reale — l'icona 📷 per caricare lo stemma esisteva
**solo sulle righe delle squadre già salvate**, non nella riga "aggiungi nuova squadra": chi provava
a impostare lo stemma mentre stava ancora compilando nome/stadio di una squadra nuova non trovava
alcun controllo per farlo, e concludeva che "non funzionava". **Fix**: stessa icona 📷 aggiunta
anche alla riga di aggiunta (`newLogoUri`, stato locale) — l'immagine scelta lì viene caricata
subito dopo che la squadra viene creata (stesso tocco su "+"). In più, **anteprima immediata**: sia
per una squadra nuova sia per una già esistente, l'immagine scelta si vede subito (dal file locale,
`res.assets[0].uri`) invece di restare uno spinner per tutta la durata dell'upload — la richiesta
esplicita di Francesco era proprio "vorrei vedere l'immagine che sto caricando". Lo spinner resta,
ma come overlay semi-trasparente **sopra** l'anteprima, non al posto suo.

**2) Luogo non cambiava passando da CASA a TRASFERTA**: causa reale — l'automatismo che precompila
il Luogo (introdotto per le "Squadre fisse per competizione" sopra) scriveva il valore solo se il
campo era **vuoto** (`!round.location`); dopo la prima compilazione automatica (es. scegliendo una
squadra mentre il round era ancora impostato su CASA → Luogo precompilato con lo stadio di casa), il
campo non era più vuoto, quindi cambiare a TRASFERTA non ricalcolava più nulla — il Luogo restava
quello (sbagliato) di prima. **Fix**: nuovo flag `locationAuto` (su `NewRound` in
`CompetitionModal.tsx`, e come stato locale nell'inline `SingleMatchModal` di `PartiteTab.tsx`) —
true finché il valore in Luogo è stato scritto dall'automatismo e non ancora toccato a mano;
scrivere direttamente nel campo Luogo lo azzera (da quel momento l'automatismo non lo tocca più,
comportamento voluto), mentre cambiare Casa/Trasferta o la squadra scelta ricalcola il Luogo ogni
volta che è vuoto **o** ancora "automatico". Aggiunto anche in `SingleMatchModal` un
`onValueChange` sul Picker Casa/Trasferta che prima non ricalcolava proprio nulla (stesso bug,
un pizzico più esteso lì: mancava del tutto, non solo bloccato dal guard).
- **Verifica**: `tsc --noEmit` + `npx expo export -p web` puliti. **Da verificare dal vero**:
  aggiungere una squadra nuova con stemma e controllare che compaia subito; scegliere una squadra
  per un round/partita mentre è impostato CASA, poi passare a TRASFERTA e controllare che il Luogo
  cambi allo stadio della squadra (se configurato); scrivere il Luogo a mano e controllare che
  cambiare Casa/Trasferta non lo sovrascriva più.

### Fix (parziale, in indagine): anteprima stemma ancora non visibile — 2026-08-24 (sesto giro)
Francesco ha confermato che l'anteprima immediata introdotta nel giro precedente **non risolve**:
"continuo a non vedere l'anteprima". Non essendo riproducibile in questo ambiente (niente
selezione file/fotocamera reale disponibile qui), non è stata trovata una causa certa — solo
irrobustito il punto più fragile trovato via analisi statica:
- **`pickImage()`** (`CompetitionTeamsModal.tsx`) non aveva **nessun** `try/catch` attorno alle due
  chiamate `ImagePicker.requestMediaLibraryPermissionsAsync()`/`launchImageLibraryAsync()` — se una
  delle due lancia un errore (permesso negato in modo anomalo, formato foto non gestito dal
  browser, ecc.), la promise rifiutata restava senza alcun gestore: nessun errore a schermo,
  nessuna anteprima, esattamente il sintomo riportato, indistinguibile da un annullamento. Aggiunto
  un `try/catch` con `Alert.alert` di errore esplicito.
- Rimosso `allowsEditing: true` dalla chiamata: apre un ritaglio (crop) che su alcuni browser può
  fallire in silenzio con certi formati foto (in particolare HEIC, il formato di default delle
  foto scattate da iPhone) — sospetto concreto dato che l'app si usa quasi sempre da iPhone in PWA;
  per uno stemma (mostrato con `resizeMode: 'contain'`, qualunque proporzione va bene) il ritaglio
  non è comunque necessario.
**Confermato risolto** (2026-08-24): Francesco ha riportato la sequenza esatta del bug — icona 📷 →
selezione foto → nessun errore, nessuna anteprima, icona invariata — che corrisponde esattamente al
ritaglio (`allowsEditing`) che falliva in silenzio prima del fix. Con la rimozione del ritaglio ora
funziona.

### Altre Partite: nostra partita automatica, allegati consultabili, stemma sul calendario — 2026-08-24 (settimo giro)
Tre richieste di Francesco insieme dopo aver verificato il fix dello stemma.

**1) La nostra partita compare da sola in Altre Partite**: prima l'elenco conteneva solo gli
incontri inseriti a mano — la partita di Ellera stessa (quella a cui la sezione appartiene) non
c'era. Nuova `syncOwnFixture()` in `altrePartite.tsx`, chiamata a ogni apertura della schermata
(solo Staff/Admin, mai per il Giocatore — RLS in scrittura richiede staff/admin): calcola
Casa/Trasferta/avversario dall'evento, legge `loadGoals`/`loadStarted` da `matchLive.ts` e ne
ricava **risultato e marcatori automaticamente** (richiesta esplicita: "marcatori e risultato li
si deve prendere automaticamente dalla sezione live") — i marcatori avversari, che in Live sono
testo libero digitato dallo staff, vengono riportati con il nome della squadra tra parentesi per
distinguerli dai nostri. Se la partita non è ancora iniziata, resta senza risultato ("— : —"),
coerente con gli incontri manuali non ancora giocati.
- **`app/data/matchdayFixtures.ts`**: nuova `syncOwnMatchFixture(competition, giornata, matchId,
  input)` — upsert su un **id deterministico** `own-{matchId}` (mai un id casuale): questo fa sì
  che, se in seguito cambiano Competizione/Giornata della partita, la stessa riga si sposti lì
  invece di duplicarsi o restare orfana nella vecchia giornata. Nuovo campo `MatchdayFixture.
  matchId` (colonna `match_id`, `App/supabase/29_schema_matchday_fixtures_own_match.sql`) per
  riconoscere questa riga nella UI.
- **UI** (`altrePartite.tsx`): la riga della nostra partita mostra un badge "🔴 Aggiornata
  automaticamente da Live", nasconde "✏️ Modifica"/"🗑️ Elimina" (verrebbero comunque sovrascritte
  al prossimo sync) ma **mantiene "📎 Allega foto/PDF"** — un allegato caricato lì non viene mai
  toccato dal sync (tabella separata, `matchday_fixture_attachments`, tocca solo `matchday_fixtures`).

**2) Allegati "consultabili"**: prima un allegato era un chip col solo nome, apribile solo con
`WebBrowser.openBrowserAsync`/`Linking.openURL` (browser esterno). Ora, se il nome file ha
un'estensione immagine (jpg/png/gif/webp/heic/bmp), viene mostrato come **miniatura reale** nella
card dell'incontro, e toccandola si apre un'**anteprima a schermo intero dentro l'app** (nuovo
Modal, sfondo nero, tap per chiudere). I PDF restano un chip apribile esternamente (nessun
visualizzatore PDF integrato nell'app).

**3) Stemma avversario sul calendario mensile**: `app/components/MonthCalendarGrid.tsx` (condiviso
da Home e Calendario) — quando una partita ha `opponentLogoPath` impostato (caricato da
Convocazione, o riusato automaticamente dalle Squadre fisse per competizione), la pillola nella
griglia mostra lo stemma al posto dell'icona ⚽ generica; stesso trattamento nella modale "Eventi
del giorno" (stemma al posto del pallino colorato).

- **Verifica**: `tsc --noEmit` + `npx expo export -p web` puliti. **Richiede l'esecuzione su
  Supabase di `App/supabase/29_schema_matchday_fixtures_own_match.sql`** (dopo il 27, già presente).
  **Da verificare dal vero**: aprire Altre Partite di una partita con Competizione/Giornata
  impostate, verificare che la propria partita compaia con Casa/Trasferta corretti e che il
  risultato si aggiorni segnando un gol in Live; allegare una foto e controllare l'anteprima a
  schermo intero; controllare lo stemma nella griglia mensile per una partita con logo avversario
  caricato.

**Nota emersa durante questo giro (non affrontata, fuori scope)**: analizzando `live.tsx` per
calcolare Casa/Trasferta della nostra partita, è emerso un possibile bug preesistente e più ampio —
`live.tsx`/`statistiche.tsx`/`player/[id].tsx` determinano Casa/Trasferta controllando solo il
valore legacy `homeAway === 'HOME'`, ma le partite create oggi (`CompetitionModal`/`PartiteTab`)
salvano `'CASA'`/`'TRASFERTA'` — per queste il controllo risulterebbe sempre falso. Segnalato per
un'indagine dedicata (non toccato in questo giro: il codice nuovo di `altrePartite.tsx` usa
direttamente `homeAway === 'TRASFERTA'`, corretto per la convenzione attuale, indipendente da
quell'eventuale bug altrove).

### Fix: stemma non caricabile in Convocazione/Rosa/Admin + stemma squadra non collegato alla partita creata — 2026-08-24 (ottavo giro)
Due segnalazioni di Francesco dopo il giro precedente.

**1) Stemma non caricabile su Convocazione**: stesso identico bug del giro precedente
(`CompetitionTeamsModal.tsx`, risolto rimuovendo `allowsEditing` e aggiungendo un `try/catch`
attorno alla selezione foto) — ma il pattern era stato **copiato** in altri 3 punti dell'app, mai
corretti: `pickOpponentLogo` in `convocazione.tsx` (stemma avversario), `pickLogo` in
`app/squadra/staff.tsx` (logo squadra, Admin), `pickPhoto` in `app/player/[id].tsx` (foto
profilo giocatore). Stesso fix applicato a tutti e tre: rimosso `allowsEditing: true`, tutta la
selezione foto avvolta in `try/catch` con `Alert.alert` di errore esplicito invece di fallire in
silenzio.

**2) Stemma di una squadra configurata non arrivava sulla partita creata**: causa reale trovata in
`CompetitionTeamsModal.tsx` — dopo l'upload di uno stemma (sia per una squadra nuova sia per una
già esistente), lo stato locale veniva aggiornato solo con `logoUrl` (l'URL usato per
l'anteprima), **mai con `logoPath`** (il valore usato altrove per collegare lo stemma alla
partita, es. `pickTeamForRound` in `CompetitionModal.tsx`) — quindi se si sceglieva quella squadra
come avversario subito dopo averle caricato lo stemma (prima di chiudere e riaprire "Squadre",
che invece ricarica tutto fresco dal database), il round restava con `opponentLogoPath` vuoto pur
mostrando correttamente l'anteprima nella lista squadre. **Fix**: sia `handleAdd` sia `pickLogo`
ora aggiornano anche `logoPath` nello stato locale, non solo `logoUrl`.
- **Rete di sicurezza aggiuntiva**: `CompetitionModal.tsx`'s `handleCreate` e il bottone "Crea" del
  form partita singola (`SingleMatchModal` in `PartiteTab.tsx`) ora, appena prima di creare,
  ricaricano le squadre fresche dal database e recuperano lo stemma **per nome** per qualunque
  round/partita che ne fosse ancora privo — copre anche altri eventuali disallineamenti di
  tempistica tra "carico lo stemma" e "scelgo la squadra", non solo la causa specifica trovata sopra.
- **Verifica**: `tsc --noEmit` + `npx expo export -p web` puliti. **Da verificare dal vero**:
  caricare uno stemma su Convocazione/Admin/scheda giocatore; creare una squadra CON stemma in un
  solo passaggio (icona 📷 nella riga "aggiungi nuova squadra") e sceglierla subito come avversario
  di un round, poi controllare che lo stemma compaia sul calendario e sulla pagina partita dopo la
  creazione.

## Permessi Staff per Importa/Esporta/Modello/Seleziona — 2026-08-03

Richiesta di Francesco: i bottoni **Importa Excel/Esporta Excel/Modello** (Rosa, Partite, Allenamenti)
e **"☑️ Seleziona"** (selezione multipla in Rosa) devono essere di default visibili solo all'**Admin**
— prima li vedeva anche lo Staff, come quasi tutto il resto dell'app. L'Admin può comunque concederli
anche allo Staff, **sezione per sezione** (tutto o in parte), da Gestione Squadra → Admin →
Configurazioni → nuova sotto-sezione "Permessi Staff" (tre switch, uno per Rosa/Partite/Allenamenti,
tutti **spenti di default**).

- **Schema** — `App/supabase/24_schema_staff_export_permissions.sql`: tre booleane su
  `organizations` (`staff_can_export_rosa`, `staff_can_export_partite`,
  `staff_can_export_allenamenti`, tutte `default false`). Nessuna nuova policy RLS (lettura già
  `is_member_of`, scrittura già admin-only su `organizations`, stesso principio di `staff_roles`/
  `show_training_attendance`/`surveys_enabled`).
- **`app/data/organization.ts`**: `loadStaffExportPermissions()`/`saveStaffExportPermission(area,
  value)` (`area: 'rosa' | 'partite' | 'allenamenti'`), stesso pattern a mappa colonne di
  `NOTIFY_COLUMNS`.
- **UI Admin** (`app/squadra/staff.tsx`): nuova sotto-sezione "Permessi Staff" dentro
  "Configurazioni", tre switch (uno per area).
- **Punti consumati** (`app/squadra/rosa.tsx`, `app/partite.tsx`, `app/allenamenti.tsx`): ciascuno
  carica il proprio permesso all'avvio e calcola `canUseXlsxTools = isAdmin || staffCanExport`,
  usato per nascondere/mostrare il blocco Importa/Esporta/Modello (e "Seleziona" in Rosa). **Non
  toccati** (restano Staff+Admin come prima, non erano nella richiesta): "+ Aggiungi" giocatore in
  Rosa, "⚙️ Regole"/"🧹 Rimuovi tutte"/"🏷️ Rimuovi competizione"/crea-partita in Partite,
  "➕ Nuovo"/"📅 Settimana"/"🗑️ Elimina" in Allenamenti.

**Nota**: la sezione Sondaggi ha **già** un flag equivalente (attiva/disattiva l'intera sezione per
tutti i ruoli, incluso Admin) — `organizations.surveys_enabled`, switch "Sondaggi" nella stessa
sotto-sezione Configurazioni, costruito insieme al resto dei Sondaggi (vedi sezione "Notifiche push
tra utenti" più sotto). Non è un permesso Staff-vs-Admin come sopra, ma un on/off globale — già
esistente, nessuna modifica necessaria in questo giro.

## Convenzione script SQL (`App/supabase/`)

Ogni file è numerato con l'ordine in cui va eseguito nell'SQL Editor di Supabase (`1_schema.sql`,
`2_schema_players.sql`, ...). **Ogni nuovo script va aggiunto con il numero successivo** (es. il
prossimo sarà `9_...`), così l'ordine di esecuzione resta sempre leggibile dal nome del file senza
dover aprire ogni script per controllare le dipendenze.

## Autenticazione e squadre (Supabase)

- Login/registrazione email+password (`app/login.tsx`, `app/register.tsx`), gestiti da
  `app/context/AuthContext.tsx`.
- Dopo la registrazione, se non si ha ancora una squadra: `app/onboarding/team.tsx` propone di
  **creare una nuova squadra** (si diventa admin) o **entrare con un codice personale** (vedi sezione
  "Ruoli utente e inviti personali" più sotto). Il gating (redirect a login/onboarding/app) è in
  `app/_layout.tsx`.
- Multi-tenant: tabelle `organizations` (squadre) e `memberships` (utente↔squadra + ruolo
  admin/staff/giocatore + `player_id` collegato se Giocatore), con Row Level Security — vedi
  `App/supabase/1_schema.sql` + `App/supabase/8_schema_roles.sql`. Un utente vede solo i dati della
  propria squadra.
- `app/lib/currentOrg.ts` tiene traccia dell'org corrente per le funzioni di data-access (es.
  `saveEvents`), così non va passata a mano in ogni schermata.
- **Gestione staff** (`app/squadra/staff.tsx`, solo admin): vedi sezione "Gestione Squadra" più sotto.

## Ruoli utente e inviti personali (2026-07-28)

Tre ruoli, crescenti in permessi:
- **Admin** (uno solo per squadra, chi l'ha creata): tutto quello che può fare Staff, più la gestione
  dello Staff stesso.
- **Staff** (poche persone): accesso in lettura/scrittura a tutte le sezioni (Rosa, Calendario,
  Allenamenti, Partite, Live, Moduli, Tattiche, Statistiche, Archivio) tranne la gestione Staff.
- **Giocatore**: sola lettura su Rosa/Calendario/Allenamenti/Partite/Live; in una partita Live può
  **proporre** un gol o un cartellino (stessa modale di Staff, bottone "Proponi" invece di "Salva") —
  la proposta resta `pending` finché Staff/Admin non la conferma o rifiuta da "Proposte in attesa".
  Non vede Moduli/Tattiche/Statistiche/Archivio/Staff.

**Niente codici invito condivisi**: ogni codice è personale e generato dall'admin per una persona
precisa.
- **Giocatore**: dalla scheda di un giocatore in Rosa (`app/player/[id].tsx`, solo admin) si genera un
  codice legato a QUEL giocatore (`create_player_invite`) — chi lo riscatta si collega
  automaticamente a quella riga di `players` (`memberships.player_id`). Un giocatore non può esistere
  come ruolo "Giocatore" senza essere collegato a una riga reale della rosa.
- **Staff**: da `app/squadra/staff.tsx` (bottone "+ Invita membro staff") si genera un codice dando
  solo un nome libero (`create_staff_invite`) — la persona non è ancora un utente registrato in quel
  momento.
- Chi riceve un codice si registra e lo inserisce nella schermata "Ho un codice personale"
  dell'onboarding (`redeem_invite`, sostituisce il vecchio `join_organization` a codice condiviso,
  ancora presente in `1_schema.sql` ma non più chiamato dal client).
- `app/squadra/staff.tsx` mostra anche gli **inviti in attesa** (non ancora riscattati) con
  Condividi/Revoca, e per i membri Giocatore già collegati il nome del giocatore in rosa.
- Schema: `App/supabase/8_schema_roles.sql` — tabella `invites` (nessuna policy RLS diretta, solo
  funzioni `security definer`: `create_player_invite`, `create_staff_invite`, `list_pending_invites`,
  `revoke_invite`, `redeem_invite`), helper `is_staff_or_admin_of`, e lo split
  lettura(chiunque)/scrittura(Staff/Admin) delle policy RLS su tutte le tabelle dati esistenti.
- Tabella `match_event_proposals` (gol/cartellino proposti da un Giocatore in una Live) — vedi
  `app/data/proposals.ts`, usata in `app/eventi/partita/[id]/live.tsx`.

## Modello dati (tutto su Supabase, scoping automatico per `org_id` via Row Level Security)

| Tabella/bucket | Contenuto |
|---|---|
| `events` | Tutti gli eventi (partite + allenamenti), tipo `CalendarEvent` ([events.ts](app/data/events.ts)); colonne dirette per i campi filtrabili (type/date/time/location/opponent), il resto in una colonna `data` jsonb |
| `players` | Tutta la rosa (attivi ed ex, colonna `is_ex`) — dal 2026-07-28 non c'è più nessun giocatore hardcoded nel codice, [players.ts](app/data/players.ts) contiene solo i tipi `Player`/`Role`. `year` (anno) e `dob` (data completa, opzionale) convivono: `dob` è la fonte "vera" quando presente, `year` resta sincronizzato per i consumatori che non sono ancora stati aggiornati (filtri Rosa, export Excel, Archivio) |
| `player_photos`, `player_attachments`, `player_injury_types` + bucket Storage `player-photos`/`player-attachments` | Foto profilo, allegati e tipologia infortuni per QUALSIASI giocatore (anche quelli statici) — vedi [playerMedia.ts](app/data/playerMedia.ts) |
| `modules` | Moduli di gioco personalizzati (chiave naturale = nome), oltre ai predefiniti hardcoded in [modules-layout.tsx](app/utils/modules-layout.tsx) — vedi [modules.ts](app/data/modules.ts) |
| `tactics` + bucket Storage `tactic-previews` | Tattiche/schemi salvati dalla lavagna tattica, con preview immagine su Storage — vedi [tactics.ts](app/data/tactics.ts) |
| `match_live` | Una riga per partita: gol, sostituzioni, cartellini, formazione/posizioni live, timer persistente, tattiche assegnate — vedi [matchLive.ts](app/data/matchLive.ts) |
| `season_archives` | Archivio stagioni: un `data` jsonb con l'intero snapshot (`SeasonArchive` — vedi [archive.ts](app/data/archive.ts) / [archiveBuilder.ts](app/utils/archiveBuilder.ts)) |
| `invites` | Codici di accesso personali (Giocatore collegato a un `player_id`, o Staff con un nome libero), riscattabili una sola volta — vedi [invites.ts](app/data/invites.ts) |
| `match_event_proposals` | Gol/cartellini proposti da un Giocatore in una partita Live, in attesa di conferma/rifiuto da Staff/Admin — vedi [proposals.ts](app/data/proposals.ts) |
| `player_edit_requests` | Modifiche a ruolo/anno/altezza/peso proposte da un Giocatore per il proprio giocatore collegato, in attesa di conferma/rifiuto da Staff/Admin — vedi [playerEdits.ts](app/data/playerEdits.ts) |
| `competition_rules` | Regole di partecipazione Under/Over per competizione (chiave org+nome competizione), soglie `{anno, minimo giocatori}` — vedi [competitionRules.ts](app/data/competitionRules.ts) |
| `staff_members` | Anagrafica "Staff" (nome, `category` Tecnico/Sanitario/Dirigenziale, `role` da lista configurabile), indipendente dagli account salvo collegamento opzionale (`memberships.staff_member_id`) — vedi [staffRoster.ts](app/data/staffRoster.ts), gestita da [staffRoster.tsx](app/squadra/staffRoster.tsx) |
| `organizations.logo_path` + bucket Storage `team-logos` | Logo squadra (uno per org, caricato in "Admin", `app/squadra/staff.tsx`) e logo avversario per singola partita (`events.data.opponentLogoPath`, caricato dal tab Convocazione) — vedi [organization.ts](app/data/organization.ts) |
| `organizations.staff_roles` | Configurazione: lista dei Ruoli disponibili per lo Staff, editabile da Admin — vedi [organization.ts](app/data/organization.ts) |

## Funzionalità attive per area

### Dashboard (`app/index.tsx`)
- Calendario mensile con pallini/etichette colorate per partita (rosso) e allenamento (verde).
- Lista eventi futuri (nascosta su schermi piccoli per mancanza di spazio).
- Creazione rapida evento da tap su un giorno del calendario.
- **Export/Import backup**: esporta le eventuali chiavi AsyncStorage ancora locali in un JSON
  condivisibile e le reimporta — ora che tutti i dati veri vivono su Supabase, resta poco da
  esportare (es. flag interni), la vera "copia di sicurezza" dei dati è il database Supabase stesso.
- Scorciatoie verso Calendario, Gestione Squadra.

### Calendario (`app/calendario.tsx`) — unificato dal 2026-08-24, vedi Punto 1 più sotto
Un unico bottone Home ("📅 Calendario") al posto dei due precedenti "🏃 Allenamenti"/"🏆 Partite":
calendario mensile a griglia in cima (`app/components/MonthCalendarGrid.tsx`, condiviso con la
Dashboard), un selettore a due voci **Allenamenti/Partite** sotto, e il contenuto del tab scelto
(`app/components/calendario/AllenamentiTab.tsx` / `PartiteTab.tsx`) — stesse identiche funzionalità
descritte nelle due sottosezioni seguenti, prima route separate (`app/allenamenti.tsx`/
`app/partite.tsx`, non più esistenti).

### Allenamenti (`app/components/calendario/AllenamentiTab.tsx`, tab "Allenamenti" del Calendario)
- Statistiche rapide (totale, del mese, prossimi).
- Creazione singolo allenamento.
- **Generazione "settimana ideale"**: selezione periodo su calendario + giorni/orari ricorrenti →
  crea in blocco gli allenamenti nel range, con deduplica su data/ora esistenti.
- Sezioni Oggi / Prossimi / Passati con eliminazione singola o totale (con conferma).
- **Export/Import Excel** (`app/data/calendarFile.ts`): esporta tutti gli allenamenti in un file XLSX
  e li reimporta lavorando per differenze (match per data+ora) — aggiorna solo luogo/tema, mai le
  presenze già registrate.
- Dettaglio allenamento (`eventi/allenamento/[id]/index.tsx`): gestione presenze per giocatore con stato
  `presente / assente / infortunato / differenziato`, tema della seduta.

### Partite (`app/components/calendario/PartiteTab.tsx`, tab "Partite" del Calendario + `eventi/partita/[id]/*`)
- Creazione partita singola o per competizione/girone (`CompetitionModal`), filtro per competizione.
- Eliminazione singola partita, per competizione, o totale (con conferme dedicate).
- **Modifica data/ora/luogo di una partita già creata** (bottone "✏️" sulla card, **solo Admin** —
  2026-08-22, prima non esisteva alcun modo di correggerli se non eliminare e ricreare la partita):
  nuovo `app/components/partite/EditMatchModal.tsx`, stesso stile del modale di creazione ma solo
  data/ora/luogo (avversario/competizione/casa-trasferta non si toccano — cambiarli sostituirebbe la
  partita, non ne correggerebbe i dati). `MatchEventCard` ha una nuova prop opzionale `onEdit`,
  passata da `partite.tsx` solo quando `isAdmin` (Staff non la vede, coerente con la richiesta
  esplicita "l'Admin deve avere la possibilità"). Il salvataggio ricarica tutti gli eventi, aggiorna
  quello modificato e richiama `saveEvents` — stesso pattern già usato per le cancellazioni in questo
  file, nessuna nuova funzione in `app/data/events.ts`.
- **Export/Import Excel per competizione** (`app/data/calendarFile.ts`, visibile solo con una
  competizione specifica selezionata nel filtro): match per avversario+casa/trasferta — importando
  aggiorna solo data/ora/luogo, mai punteggio/formazione/cartellini di una partita già giocata.
- **Regole di partecipazione Under/Over** (bottone "⚙️ Regole" accanto al filtro competizione, solo
  con una competizione specifica selezionata): per ciascuna, una o più soglie indipendenti `{anno,
  minimo giocatori}` — Under richiede almeno "minimo" giocatori in campo con anno di nascita ≥ soglia,
  Over con anno ≤ soglia (`app/data/competitionRules.ts`, tabella `competition_rules`, chiave
  org+nome-competizione dato che le competizioni non sono un'entità a parte). Un giocatore giovane
  soddisfa più soglie Under insieme (es. 3 giocatori 2008 rispettano anche le soglie 2006/2007). Le
  regole sono **non bloccanti in Formazione** (pannello sempre visibile con conteggi ✅/❌, perché lì
  non esiste un salvataggio esplicito — ogni assegnazione si autosalva) ma **bloccano** la pressione
  di "Start" in Live (formazione titolare non conforme → non parte, `initializeLiveFormationFromLineup`
  in `live.tsx`) e ogni sostituzione che porterebbe l'11 in campo fuori regola
  (`executeSubstitution`). Un giocatore **espulso** (cartellino rosso) continua a contare ai fini
  della regola anche se non più fisicamente in campo — solo una sostituzione vera lo toglie dal
  conteggio.
- **Formazione** (`formazione.tsx`): scelta modulo, convocati (nessun limite massimo — vedi nota sotto
  in "Convocazione partita"), disposizione titolari/panchina,
  assegnazione numero di maglia, drag&drop sul campo.
- **Tattiche di partita** (`tattiche.tsx`): lavagna tattica per la singola partita, assegnazione di
  schemi salvati ai giocatori convocati.
- **Live match** (`live.tsx`):
  - Timer di gioco persistente (sopravvive a background/riavvio app) con fasi PRE_MATCH → 1°T → intervallo → 2°T → fine.
  - Registrazione **gol**, **sostituzioni**, **cartellini** (giallo/rosso, con rosso automatico al secondo giallo), sempre modificabili anche a partita finita.
  - Espulsioni marcate sul giocatore in campo.
  - Inserimento manuale di eventi passati.
  - **Ruolo Giocatore**: sola lettura sulla cronologia; il bottone GOL/CARTELLINO apre la stessa
    modale ma il bottone finale è "Proponi" invece di "Salva" — crea una proposta `pending` in
    `match_event_proposals`. Staff/Admin vedono una sezione "Proposte in attesa" con Conferma (la
    accoda a gol/cartellini reali) o Rifiuta.
- **Altre Partite** (`altrePartite.tsx`, dal 2026-08-24): incontri delle altre squadre della stessa
  giornata/competizione — testo libero (squadre, risultato, marcatori), chiave `(competition,
  giornata)` condivisa tra le nostre partite di quella giornata, allegati foto/PDF delle formazioni.
  Vedi "Punto 3" più sotto per i dettagli tecnici.
- **Pagina scelta-partita a 4 riquadri** (`app/eventi/partita/[id]/index.tsx`, dal 2026-08-24): per
  Staff/Admin pre-Start, griglia 2×2 — Convocazione/Lista Gara/Live/Altre Partite — al posto delle 3
  card in riga di prima. Vedi "Punto 4" più sotto.

### Gestione Squadra (`app/squadra/*`)
- **Panoramica**: conteggi per ruolo ed età media squadra.
- **Rosa** (`rosa.tsx`): elenco giocatori raggruppati per ruolo (attivi) + sezione **Ex giocatori** in
  fondo, con tenuto premuto su un giocatore per "Sposta tra ex giocatori" (solo se ancora attivo) o
  "Elimina giocatore" (con conferma) — quest'ultima disponibile anche per un ex giocatore, per pulire
  la rosa nel tempo. Foto profilo, età calcolata da data di nascita se presente. **Selezione multipla**
  (Staff/Admin, bottone "☑️ Seleziona", funziona sia su attivi che su ex): tocca più giocatori per
  selezionarli, poi "🔄 Sposta tra ex" o "🗑️ Elimina" dalla barra in basso (posizionata rispettando
  l'inset di sicurezza inferiore del dispositivo — `useSafeAreaInsets`, importante sui tablet con barra
  di navigazione di sistema) — stessa distinzione ex/eliminazione definitiva del menu singolo, applicata
  a tutto il gruppo (`moveToExMany`/`removePlayers` in `app/hooks/usePlayers.ts`). **Un giocatore che ha
  già preso parte
  a una partita della stagione corrente (gol, cartellino, sostituzione o convocazione) non può essere
  eliminato del tutto** — solo spostato tra gli ex (`isPlayerInMatches` in `app/data/matchLive.ts`);
  nell'eliminazione multipla i giocatori bloccati vengono saltati (mai un errore in blocco) e elencati
  in un avviso a parte. Le stagioni già archiviate non contano (il controllo guarda solo gli eventi
  correnti). **Export/Import Excel** (`app/data/rosterFile.ts`): riconoscimento per nome, aggiunge i
  nuovi e aggiorna i campi cambiati (incluso lo stato attivo/ex); prima di applicare l'import mostra un
  riepilogo con conferma esplicita per ogni giocatore attivo assente dal file
  (`RosterImportReviewModal`).
- **Moduli** (`app/moduli/*`): moduli predefiniti (es. 3-1-4-2, 3-4-2-1, ecc. — sola lettura) e moduli
  personalizzati creabili/editabili con editor drag&drop delle posizioni in campo.
- **Tattiche** (`squadra/tattiche/*`): editor lavagna tattica generale (maglie HOME/AWAY + palla,
  drag&drop, screenshot/export immagine dello schema via `react-native-view-shot`).
- **Statistiche** (`statistiche.tsx`): dati stagionali aggregati con filtri, **export PDF** (via `expo-print`
  + `expo-sharing`).
- **Archivio stagioni** (`archivio.tsx` + `archivio/[id]/*`): congela i dati della stagione corrente
  (partite, allenamenti, giocatori con statistiche) in uno storico consultabile per stagioni passate,
  cancellabile singolarmente.
- **Staff** (`staffRoster.tsx`, card visibile a Staff+Admin): anagrafica Tecnico/Sanitario/
  Dirigenziale, vedi sezione dedicata più sotto.
- **Admin** (`staff.tsx`, card visibile solo se `membership.role === 'admin'`): logo squadra,
  Configurazioni (Ruoli Staff), elenco inviti in attesa (Condividi/Revoca) e membri attivi con
  email/ruolo (per i Giocatori il nome collegato in Rosa, per lo Staff il nome collegato in Staff);
  l'admin può cambiare il ruolo (Admin/Staff/Giocatore) o rimuovere chiunque tranne se stesso.

Per il ruolo **Giocatore**: solo le card Rosa e Staff sono visibili in questa sezione (entrambe in
sola lettura — vedi "Staff" più sotto, dal 2026-07-30 in sola consultazione anche per il ruolo
Staff, non solo Giocatore); Moduli, Tattiche, Statistiche, Archivio e Admin non compaiono e le
relative schermate mostrano un messaggio se raggiunte con un link diretto.

### Scheda giocatore (`app/player/[id].tsx`)
- Tab: **Partite** (presenze/statistiche), **Allenamenti** (presenze), **Infortuni** (storico status),
  **Allegati** (documenti).
- Foto profilo (galleria o fotocamera), allegati (document picker), link esterni (browser in-app).
- **Nome** (solo Admin, modifica diretta, nessuna proposta — `App/app/player/[id].tsx`, sezione
  "Nome" sopra i Dati anagrafici, 2026-08-03): pensato per correggere nome/cognome invertiti in fase
  di inserimento. Staff e Giocatore non lo vedono (a differenza dei campi sotto, dove Staff modifica
  diretto e Giocatore propone) — richiesta esplicita di Francesco, solo Admin. `updatePlayer` accetta
  ora anche `name` in `PlayerUpdateInput` (`app/hooks/usePlayers.ts`), stessa scrittura diretta su
  Supabase degli altri campi, nessuna migrazione SQL necessaria (colonna già esistente). **Non**
  riscrive i nomi già "congelati" altrove (gol/cartellini/sostituzioni salvano il nome per copia al
  momento dell'evento, gli Archivi Stagioni sono snapshot congelati) — resta lo storico con il nome
  di allora, solo la Rosa/le schede future mostrano il nome corretto.
- **Dati anagrafici** (Ruolo/Data di nascita/Altezza/Peso): Admin e Staff li modificano su
  **qualunque** giocatore, in scrittura diretta (`updatePlayer` in `app/hooks/usePlayers.ts`). Un
  **Giocatore** vede questa sezione solo sulla scheda del giocatore a cui è collegato
  (`membership.playerId`) e può solo **proporre** una modifica (`proposePlayerEdit` in
  `app/data/playerEdits.ts`) — resta `pending` in `player_edit_requests` finché Staff/Admin non la
  conferma (applica i cambiamenti a `players`) o rifiuta, mostrato direttamente in questa stessa
  sezione quando Staff/Admin aprono quella scheda. Un giocatore non può proporre una seconda modifica
  finché quella in corso non è stata decisa. Schema: `App/supabase/9_schema_player_edits.sql`.
- **Data di nascita completa** (`players.dob`, colonna `date` — `App/supabase/10_schema_player_dob.sql`):
  scelta con un mini-calendario (`app/components/DatePickerField.tsx`, riusa `react-native-calendars`,
  nessuna nuova dipendenza) sia in Aggiungi Giocatore sia nella modifica qui sopra. La vecchia colonna
  `year` (solo anno) resta e viene **sincronizzata automaticamente** ogni volta che si imposta `dob`
  (in `usePlayers.updatePlayer`/`addPlayer`), perché la usano ancora i filtri "anno" in Rosa,
  l'export/import Excel (`rosterFile.ts`) e gli snapshot di Archivio Stagioni — nessuno di questi è
  stato convertito a `dob` in questo passaggio. `getPlayerAge()` (in `rosa.tsx` e `squadra/index.tsx`)
  preferisce `dob` quando presente, altrimenti calcola dal solo anno come faceva già prima.

## File rimossi (pulizia del 2026-07-26)

Rimossi perché boilerplate del template `create-expo-app` **non referenziato da nessuna schermata reale**
(verificato via grep su tutti gli import prima di cancellare):
`app/app.zip` (zip di build finito per errore nei sorgenti), `app/(tabs)/note.tsx` (schermata "note" orfana,
nessun layout/route la collegava, salvataggio finto), `app/data/tactics.ts` (seed statico mai importato,
sostituito dal sistema tattiche via AsyncStorage), `components/HelloWave.tsx`, `ParallaxScrollView.tsx`,
`Collapsible.tsx`, `ExternalLink.tsx`, `HapticTab.tsx`, `components/ui/IconSymbol*.tsx`,
`components/ui/TabBarBackground*.tsx`, immagini template (`react-logo*.png`, `partial-react-logo.png`),
font `SpaceMono-Regular.ttf` (mai caricato), `assets/icon.png` e `assets/splash.png` di root (duplicati
inutilizzati — l'app usa quelli in `assets/images/`).

Sono stati **mantenuti** `ThemedText`/`ThemedView`/`useThemeColor`/`useColorScheme`/`constants/Colors.ts`
perché usati dalla schermata di fallback `+not-found.tsx`, e `assets/avatar.png` perché usato come
foto profilo di default in `rosa.tsx`.

## Rimozione tool di import dati locale (2026-07-28)

I due tool di importazione una tantum (`app/utils/importLocalEvents.ts` per il calendario,
`app/utils/importLocalArchives.ts` per l'archivio stagioni) sono stati rimossi insieme ai relativi
avvisi in Dashboard e in Archivio Stagioni: tutti i dati che esistevano solo in locale sul tablet sono
stati caricati su Supabase, quindi non servono più. Rimossa anche la costante ormai inutilizzata
`LEGACY_STORAGE_KEY` in `app/data/events.ts`.

## Aggiornamento SDK e automazione rilasci (2026-07-26)

- Aggiornato Expo da SDK 53 a **SDK 57** (React Native 0.79 → 0.86) con `npx expo install --fix`, e
  rimossa `react-native-uuid` (dipendenza dichiarata ma mai importata da nessun file).
- Rimossa la cartella `android/` dal repository (era solo un artefatto generato, nessun codice nativo
  custom) e passaggio al workflow **CNG** — vedi sezione sopra.
- Corrette 3 rotture d'API introdotte dall'aggiornamento:
  - `expo-file-system`: la vecchia API a funzioni (`cacheDirectory`, `writeAsStringAsync`, ecc., usata in
    [index.tsx](app/index.tsx) e [statistiche.tsx](app/squadra/statistiche.tsx)) ora si importa da
    `expo-file-system/legacy` (il pacchetto principale è stato riscritto con una nuova API a classi).
  - `react-native-view-shot` v5: il ref della lavagna tattica in
    [tattiche/editor.tsx](app/squadra/tattiche/editor.tsx) ora usa il tipo `ViewShotRef` esportato dalla
    libreria invece del componente stesso.
  - [`useThemeColor.ts`](hooks/useThemeColor.ts): il tema del sistema può restituire anche `'unspecified'`
    (Android) oltre a `'light'/'dark'` — normalizzato con fallback a `'light'`.
- Aggiunta `expo-updates` e configurato **EAS Update (OTA)** con `runtimeVersion.policy: "fingerprint"`
  (Expo capisce da solo quando una modifica nativa rende un aggiornamento OTA incompatibile, senza bisogno
  di alzare manualmente un numero di versione) e un canale (`development`/`preview`/`production`) per
  ciascun profilo di build in `eas.json`.
- Aggiunte le EAS Workflows in `.eas/workflows/` descritte nella sezione "Come rilascio una modifica"
  sopra.

## Dati condivisi su Supabase — Fase 1 (2026-07-27)

Vedi anche [PIANO_LAVORO.md](PIANO_LAVORO.md) per il contesto/motivazione completa.

- Aggiunto Supabase (Postgres + Auth + RLS, piano gratuito): `App/supabase/1_schema.sql` contiene tabelle,
  funzioni RPC (`create_organization`, `join_organization`) e le policy di sicurezza.
- Aggiunte `@supabase/supabase-js` e `react-native-url-polyfill` (import obbligatorio
  `'react-native-url-polyfill/auto'` in cima a `app/_layout.tsx`, altrimenti crash all'avvio).
- Nuovi file: `app/lib/supabase.ts` (client), `app/lib/currentOrg.ts` (org corrente), 
  `app/context/AuthContext.tsx`, `app/login.tsx`, `app/register.tsx`, `app/onboarding/team.tsx`,
  `app/utils/importLocalEvents.ts`.
- `app/_layout.tsx` ora fa gating: nessuna sessione → login, sessione senza squadra → onboarding,
  altrimenti l'app normale.
- `app/data/events.ts` riscritto per usare Supabase mantenendo le stesse firme `loadEvents()`/
  `saveEvents()`: tutte le schermate che leggevano/scrivevano `calendar/events` direttamente via
  AsyncStorage (index, calendario, allenamenti, partite, EventEditor/EventEditorModal, live, tattiche
  partita, dettaglio allenamento, archiveBuilder) sono state ricondotte a queste due funzioni.
- **Configurazione richiesta**: `App/.env` (non committato, vedi `App/.env.example`) con
  `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY` — senza questo file l'app non si avvia.
- **Avviso piano gratuito**: i progetti Supabase gratuiti vanno in pausa dopo ~1 settimana di
  inattività; si riattivano con un click dalla dashboard Supabase.

## Dati condivisi su Supabase — Fase 2: Giocatori/Rosa (2026-07-27)

- Schema aggiuntivo `App/supabase/2_schema_players.sql` (da eseguire una volta in più, dopo
  `1_schema.sql`): tabella `players` (giocatori custom, con `is_ex` invece di due liste separate),
  tabelle `player_photos`/`player_attachments`/`player_injury_types` (si applicano anche ai giocatori
  statici, per questo non hanno foreign key verso `players.id`), due bucket Supabase Storage pubblici
  (`player-photos`, `player-attachments`).
- Aggiunta `base64-arraybuffer` (conversione file locale → upload Storage, nessun codice nativo).
- Nuovo modulo `app/data/playerMedia.ts`: `loadPhotoMap`, `uploadPlayerPhoto`, `loadAttachments`,
  `addAttachment`, `removeAttachment`, `loadInjuryTypes`, `setInjuryType` — usato da
  `app/player/[id].tsx`, `app/squadra/rosa.tsx`, `app/squadra/statistiche.tsx`,
  `app/utils/archiveBuilder.ts`.
- `app/hooks/usePlayers.ts` riscritto per usare Supabase mantenendo la stessa interfaccia pubblica.
- Bug corretto: `app/eventi/partita/[id]/tattiche.tsx` usava il roster statico invece di
  `usePlayers()`, quindi i giocatori aggiunti a mano non comparivano nella lavagna tattiche di partita.

## Dati condivisi su Supabase — Fase 3: ultimi 3 domini (2026-07-27)

Con questa fase tutti i domini dell'app sono su Supabase. Tre nuovi script SQL aggiuntivi in
`App/supabase/` (`3_schema_archive.sql`, `4_schema_modules_tactics.sql`, `5_schema_match_live.sql`), da
eseguire una volta ciascuno dopo quelli delle fasi precedenti.

- **Archivio stagioni** → tabella `season_archives` (`app/utils/archiveBuilder.ts`
  `saveArchive`/`loadAllArchives`/`loadArchiveById`/`deleteArchive` riscritte, stessa firma).
- **Moduli** → tabella `modules` (chiave naturale = nome, come si comportava già l'app) —
  `app/data/modules.ts`. **Tattiche** → tabella `tactics` + bucket Storage pubblico `tactic-previews`
  per la preview (prima base64 incorporato nel JSON, ora un URL) — `app/data/tactics.ts`. Toccati
  `app/moduli/*`, `app/squadra/tattiche/*`, e le letture in sola lettura in
  `eventi/partita/[id]/formazione.tsx` (moduli) e `tattiche.tsx` (tattiche).
- **Dati live-partita** → tabella `match_live`, una riga per partita con una colonna per ciascun
  "pezzo" di prima (goals/subs/cards/lineup/positions/live_formation/started/timer_state/
  tactics_assignments). Nuovo modulo `app/data/matchLive.ts` con funzioni get/set granulari (upsert
  mirato su una sola colonna per volta). Riscritti soprattutto `app/eventi/partita/[id]/live.tsx` (il
  file più grande dell'app), oltre a `formazione.tsx`, `tattiche.tsx` di partita, e le letture in sola
  lettura in `archiveBuilder.ts`, `player/[id].tsx`, `squadra/statistiche.tsx`.
- **Corretto un bug di pulizia dati**: `clearCurrentSeasonData` (chiamata quando si archivia una
  stagione) prima lasciava orfane le chiavi `match/{id}/positions` e `match/{id}/tacticsAssignments`
  (mai cancellate). Ora cancella l'intera riga `match_live` della partita, quindi sparisce tutto.

## Rosa non hardcoded + import/export XLSX (2026-07-28)

- **Rosa rimossa dal codice**: `app/data/players.ts` conteneva 29 giocatori attivi + 4 ex reali
  dell'Ellera — spostati una tantum su Supabase (`App/supabase/6_seed_ellera_roster.sql`, da eseguire
  prima di aggiornare l'app) e tolti dai sorgenti (restano solo i tipi). `app/hooks/usePlayers.ts`
  semplificato: non c'è più merge statici+custom, `removeCustomPlayer` → `removePlayer`, il campo
  `customPlayers` è sparito (non serve più distinguere). `app/squadra/rosa.tsx` ha perso la logica
  `isCustom()`: ora ogni giocatore è modificabile/cancellabile allo stesso modo.
- **Import/Export Excel Rosa** (`app/data/rosterFile.ts` + `RosterImportReviewModal.tsx`): vedi
  dettagli nella sezione "Gestione Squadra" sopra.
- **Import/Export Excel Calendario** (`app/data/calendarFile.ts`): vedi dettagli nelle sezioni
  "Allenamenti" e "Partite" sopra.
- Nuova dipendenza `xlsx` (SheetJS, pura JS, nessun codice nativo — non serve una build nuova).
- `usePlayers()` ha ora anche `refresh()` nell'interfaccia pubblica, per ricaricare dopo modifiche
  fatte fuori dall'hook stesso (es. l'import massivo).

## Gestione staff (2026-07-28)

- Schema aggiuntivo `App/supabase/7_schema_staff.sql`: `list_org_members` (SECURITY DEFINER, unico modo
  per leggere le email dei membri dato che il client non può interrogare `auth.users` direttamente),
  `update_member_role`, `remove_member` (entrambe rifiutano `p_user_id = auth.uid()`: non ci si può
  toccare da soli — evita sia il rischio di restare senza admin sia la necessità di contarli),
  `regenerate_invite_code`.
- Nuovo modulo `app/data/staff.ts` e schermata `app/squadra/staff.tsx`, agganciata in
  `app/squadra/_layout.tsx` e con una card dedicata (solo admin) in `app/squadra/index.tsx`.
- Condivisione del codice invito via `Share` di React Native (già incluso, nessuna nuova dipendenza).

## Rebranding: nome app e icona (2026-07-28)

- Nome app visibile sul dispositivo cambiato da "ElleraApp" a **"TeamBoard"** (`expo.name` in
  `app.json`). Non è legato al nome della squadra (scelta esplicita di Francesco), per restare valido
  anche se in futuro l'app venisse riusata da un'altra società. `expo.slug`, `ios.bundleIdentifier` e
  `android.package` **non sono stati toccati** (restano `ElleraApp`/`com.anonymous.ElleraApp`): sono
  legati al progetto EAS e agli store, cambiarli sarebbe un cambio di identità dell'app, non un
  rebranding.
- Nuova icona (pallone da calcio su un campo, colore verde brand `#1b7f3b` già usato in tutta l'app):
  rigenerati `assets/images/icon.png`, `adaptive-icon.png`, `splash-icon.png`, `favicon.png`. L'icona
  Android adattiva ora ha `backgroundColor: "#1b7f3b"` (era `#ffffff`) per abbinarsi al pallone in
  primo piano su sfondo trasparente.
- **Importante**: sia il nome che l'icona sono impostazioni native (non JS), quindi — come già scritto
  sopra in "Come rilascio una modifica", scenario 2 — questa modifica **non arriva via OTA**: serve una
  nuova build (`build-internal.yml`) e reinstallare manualmente il nuovo APK sul dispositivo.

## Promemoria push eventi calendario (2026-07-28)

- Nuova dipendenza nativa `expo-notifications` (plugin aggiunto in `app.json`, colore `#1b7f3b`) —
  come per icona/nome, **serve una nuova build nativa**, non arriva via OTA.
- `app/utils/eventReminders.ts`: `scheduleEventReminders(events)` pianifica una notifica **locale**
  (nessun server, nessun push token) alle 09:00 del giorno stesso per ogni evento `PARTITA`/
  `ALLENAMENTO` futuro. A ogni chiamata cancella e ripianifica tutto da zero (identificatore
  `event-{id}`), così eventi spostati/cancellati restano coerenti. `clearEventReminders()` cancella
  tutto (chiamata al logout).
- Attivo **solo per il ruolo Giocatore** (richiesta esplicita di Francesco: niente promemoria per
  Staff/Admin) — agganciato in `app/index.tsx` (`refreshEvents`, dopo il caricamento del calendario,
  solo se `membership.role === 'giocatore'`).
- **Limite noto**: essendo notifiche locali, funzionano solo per avvisare l'utente stesso del proprio
  calendario. Non coprono il caso "notifica verso un altro utente" (es. avvisare lo staff quando un
  giocatore invia una proposta o risponde a un sondaggio, o avvisare i convocati quando lo staff invia
  una convocazione) — quei casi restano in Backlog e richiederanno di salvare un push token Expo per
  account su Supabase.

## Ridisegno Dashboard/Home (2026-07-29)

Tutto in `app/index.tsx` (unico file toccato):
- **Bottone account/logout**: l'app non aveva nessun modo di uscire dall'account una volta entrati
  in una squadra (`signOut` esisteva già in `AuthContext.tsx` ma era raggiungibile solo
  dall'onboarding, prima di creare/entrare in una squadra) — bloccava, tra l'altro, il testare più
  account sullo stesso dispositivo. Bottone **👤 Account** nell'header (etichetta visibile, non solo
  icona — la sola icona non si notava abbastanza), raggiungibile da tutti i ruoli: apre un `Alert`
  con email + ruolo dell'account corrente e un'azione "Esci" (con conferma) che chiama `signOut()`.
- **Titolo header**: da "Dashboard Calcistica" (statico) al nome della squadra
  (`membership?.orgName`) — più utile, e tolto anche il titolo "Calendario" sopra la griglia mensile
  (ridondante, si capisce già cos'è).
- **Blocco "Oggi e domani"** (nuovo): due colonne compatte con gli eventi del giorno stesso e del
  giorno dopo (riusa `eventsByDate`, già calcolato), righe cliccabili verso il dettaglio evento.
  **Sostituisce** la vecchia lista "Prossimi eventi" (tutti gli eventi futuri, un `FlatList`
  nascosto su schermi piccoli via `hasSpaceForEvents`/`Dimensions` — rimossi entrambi, il nuovo
  blocco è abbastanza compatto da stare sempre).
- **Rimosse le icone 📤/📥** (backup/import JSON via AsyncStorage) accanto al calendario — non
  servono più, tutti i dati reali vivono su Supabase da tempo. Rimosse anche le dipendenze non più
  usate in questo file (`@react-native-async-storage/async-storage`, `expo-document-picker`,
  `expo-file-system/legacy`, `expo-sharing` — restano comunque usate altrove nell'app).
- **Fix**: il tap su un giorno della griglia mensile apriva sempre la creazione di un nuovo evento,
  **senza controllo di ruolo** — un account Giocatore (sola lettura ovunque nel resto dell'app)
  poteva quindi creare eventi dalla Dashboard. Ora il tap non fa nulla per `membership?.role ===
  'giocatore'`.
- **Azioni rapide per ruolo**: Allenamenti/Partite restano uguali per tutti (il Giocatore ha già
  accesso in sola lettura). L'ultimo tasto cambia: "Gestione Squadra" per Admin/Staff, ma per il
  Giocatore diventa un tasto diretto **"Rosa"** (`/squadra/rosa`) — quella pagina per lui mostrerebbe
  comunque solo quella card, quindi si salta il passaggio intermedio.

**Nome della persona in header (2026-07-30)**: sotto il nome della squadra, per i ruoli **Staff** e
**Giocatore** compare anche il nome della persona collegata (non per l'Admin). `AuthContext.tsx`
(`loadMembership`) ora fa embed anche di `players(name)`/`staff_members(name)` nella stessa query su
`memberships` (stesso pattern già usato per `organizations(name)`), calcolando
`membership.displayName = playerName ?? staffMemberName ?? null`.

**Gestione unificata ruolo + collegamento in Admin (2026-07-30)**: in `app/squadra/staff.tsx`
("Admin"), toccando il **nome/email** di un membro (icona ✏️, non se stessi) si apre un'unica
modale con: scelta del ruolo (Admin/Staff/Giocatore, sostituisce il vecchio bottone separato "Cambia
ruolo") e, in base al ruolo scelto, l'elenco selezionabile (radio) di tutti i Giocatori o di tutte le
persone dello Staff a cui collegare **forzatamente** quell'account — utile per correggere un
collegamento sbagliato o sistemare un account entrato senza passare da un invito, senza dover
rigenerare codici. "Salva" applica insieme `update_member_role` (se il ruolo è cambiato) e la nuova
RPC `set_member_link` (se il collegamento è cambiato). Un membro senza collegamento (Staff/Giocatore)
mostra "Non collegato a nessuno" in rosso nell'elenco, per essere subito visibile. Schema:
`App/supabase/16_schema_admin_member_link.sql` (`set_member_link(org_id, user_id, player_id,
staff_member_id)`, admin-only, valida che il giocatore/persona esista nella stessa org). Nuovo
wrapper `setMemberLink` in `app/data/staff.ts`.

**Staff sola-consultazione per chi non è Admin (2026-07-30)**: la schermata "Staff"
(`app/squadra/staffRoster.tsx`) resta visibile a tutti (Admin/Staff/Giocatore, card sbloccata anche
per il Giocatore in `squadra/index.tsx`), ma aggiungere/modificare/rimuovere persone e generare/
revocare il codice di accesso sono ora **solo Admin** (prima anche lo Staff poteva farlo). Lato
server: `App/supabase/17_schema_staff_members_admin_only.sql` cambia le policy di scrittura su
`staff_members` da `is_staff_or_admin_of` a `is_admin_of` (la lettura resta `is_member_of`, invariata
per tutti). Lato client: i bottoni "+ Aggiungi"/"Modifica"/"Rimuovi"/"📤 Invita" sono ora dietro
`isAdmin` invece di essere sempre visibili a chi non è Giocatore.

## Fix Import/Export Partite: competizione per-riga, non per filtro (2026-07-29)

- Bug segnalato da Francesco: i bottoni "Esporta/Importa/Modello" in `app/partite.tsx` erano
  visibili **solo** quando era selezionata una competizione specifica (`compFilter !== ALL_COMP`) —
  con il filtro "Tutte" sparivano del tutto. Inoltre, anche quando visibili, `exportMatchesToXlsx`
  scriveva la **stessa** competizione (quella del filtro) su ogni riga esportata, ignorando il campo
  `competition` reale di ciascun evento — sbagliato non appena si esportava con un filtro diverso da
  una singola competizione.
- **Fix in `app/data/calendarFile.ts`**: `MatchFileRow` ha ora un campo `competition` (letto dalla
  colonna "Competizione" del file, già presente da quando è stato aggiunto il modello scaricabile).
  `exportMatchesToXlsx` scrive la competizione **di ciascun evento**, non un valore fisso.
  `planMatchesImport` non prende più un parametro `competition` singolo: la chiave di identità
  "stessa partita" (avversario + casa/trasferta + competizione) usa la competizione di ogni riga del
  file. Risultato: import/export funzionano identici con qualsiasi filtro (anche "Tutte"), e un
  unico file può contenere partite di più competizioni.
- **`app/partite.tsx`**: "📤 Esporta Excel" / "📥 Importa Excel" / "📄 Modello" ora visibili sempre
  (`!readOnly`, senza il vincolo sulla competizione) — resta legato a una competizione specifica solo
  "⚙️ Regole" (le regole Under/Over si applicano per competizione, ha senso solo lì).

## Modelli XLSX scaricabili per gli import (2026-07-29)

- Ogni import Excel dell'app (Rosa, Partite, Allenamenti) ha ora un bottone **"📄 Modello"** accanto a
  "📥 Importa Excel" che genera al volo e condivide un file XLSX di esempio, diverso per ciascuna
  sezione: colonne corrette già intestate, 2-3 righe di esempio compilate, più un secondo foglio
  "Istruzioni" che spiega ogni colonna e i valori ammessi (es. Ruolo: Portiere/Difensore/
  Centrocampista/Attaccante, Casa/Trasferta: CASA/TRASFERTA, formati data/ora).
- Nuove funzioni: `downloadRosterTemplate()` in `app/data/rosterFile.ts`; `downloadMatchesTemplate()`
  e `downloadTrainingsTemplate()` in `app/data/calendarFile.ts` (quest'ultimo file ha anche un nuovo
  helper interno `writeTemplateAndShare` per generare i due fogli). Il foglio dati è sempre il primo
  del workbook, quindi il modello scaricato può anche essere ricompilato e reimportato direttamente
  senza modifiche di struttura.
- Nessuna dipendenza nuova (riusa `xlsx`/`expo-sharing` già presenti) — arriva via OTA.

## Scollega account giocatore (2026-07-29)

- `app/data/invites.ts`'s `loadPlayerInviteStatus` ritorna ora anche `claimedUserId` (oltre a
  `claimedEmail`/`pendingCode`), preso da `loadOrgMembers` (già disponibile, solo non ancora
  esposto).
- `app/player/[id].tsx`: quando un giocatore è collegato a un account, nuovo bottone **"🔓 Scollega
  account"** (solo Admin, con conferma) che chiama `removeMember(orgId, userId)` (già esistente in
  `app/data/staff.ts`/RPC `remove_member`) — rimuove la membership (quindi anche `player_id`), non
  l'account Supabase stesso (che resta orfano, cancellabile solo dalla dashboard Supabase →
  Authentication → Users → Delete user). Dopo lo scollegamento si può generare un nuovo codice per
  lo stesso giocatore, esattamente come se non fosse mai stato collegato.

## Mostra/nascondi password (2026-07-29)

Nuovo componente `app/components/PasswordInput.tsx` (wrapper di `TextInput` con un bottone 👁️ che
alterna `secureTextEntry`) usato in `app/login.tsx` e `app/register.tsx` (password + conferma
password) — richiesta esplicita di Francesco, prima le password erano sempre oscurate senza modo di
verificarle mentre si digitano.

## Convocazione partita + Rosa Staff categorizzata (2026-07-29)

Portata la gestione dei convocati fuori da `formazione.tsx` in un tab autonomo per-partita
(`app/eventi/partita/[id]/convocazione.tsx`), visibile solo a Staff/Admin (`readOnly` per
Giocatore, come le altre schermate). Riproduce la "Scheda Convocazione" usata dal club (Excel con
liste convocati e riepilogo pranzo), condiviso da Francesco come modello.

- **Schema** — `App/supabase/12_schema_convocazione.sql`:
  - **`staff_members`** (nuova tabella): elenco persone (nome, `category` in
    `TECNICO`/`SANITARIO`/`DIRIGENZIALE`, `role` libero es. "Allenatore") — indipendente dagli
    account, stesso principio di `players` per i giocatori (nessun account richiesto per comparire
    nelle convocazioni). RLS: lettura `is_member_of`, scrittura `is_staff_or_admin_of`.
  - **`match_live.convocazione`** (nuova colonna jsonb, stesso pattern di goals/subs/cards/lineup):
    `{ ritrovo, playerIds, staffIds, menuItems: {id,name}[], meals: Record<personId, menuItemId> }`.
- **`app/data/staffRoster.ts`** (nuovo): CRUD diretto su `staff_members` (`loadStaffMembers`,
  `addStaffMember`, `updateStaffMember`, `removeStaffMember`) — mirror di `players.ts`, senza
  concetto di "ex" e senza blocco cancellazione se già usato in una convocazione passata
  (semplificazione consapevole: dato a basso rischio, a differenza dei giocatori).
- **`app/data/matchLive.ts`**: nuova coppia `loadConvocazione`/`saveConvocazione` (get/set sulla
  colonna `convocazione`, stesso `getColumn`/`setColumn` di tutte le altre).
- **`app/data/convocazione.ts`** (nuovo, livello più alto): `loadConvocazione`/`saveConvocazione`
  (con default vuoto), `saveConvocatiPlayerIds(eventId, ids)` (setter condiviso: salva
  `convocazione.playerIds` **e** pota `lineup.field`/`lineup.bench` togliendo ogni id non più
  convocato — stesso comportamento che prima viveva nella modale CONVOCATI di `formazione.tsx`).
- **`app/components/partite/ConvocatiPlayersModal.tsx`** (nuovo, condiviso): checklist giocatori,
  usata dalla modifica "ultimo secondo" in Live (il tab Convocazione stesso non la usa più dal
  2026-08-03, vedi sotto). **Nessun tetto massimo** (rimosso il 2026-08-03 su richiesta di
  Francesco — prima era fisso a 20, prop `max` opzionale non più passata dal punto di utilizzo
  rimasto): il prop `max` resta disponibile ma opzionale, per un eventuale limite futuro diverso da
  "tutta la rosa". Bottone **"Seleziona tutti"/"Deseleziona tutti"** accanto al titolo (aggiunto lo
  stesso giorno, richiesta esplicita di Francesco).
- **`app/eventi/partita/[id]/convocazione.tsx`** (nuovo): intestazione partita (letta da
  `loadEvents()`) + campo Ritrovo, checklist giocatori (alfabetico, tramite la modale condivisa,
  riepilogo a chip), staff diviso nelle 3 categorie (checklist read-only sulla Rosa Staff, nessuna
  aggiunta rapida qui — si fa da `app/squadra/staffRoster.tsx`), riepilogo conteggi per categoria,
  upload logo avversario, bottone "📄 Esporta PDF" che apre prima una modale (Competizione/Giornata,
  Luogo, Ritrovo, Data/Ora, prepopolati dalla partita) e genera un PDF con **solo i convocati** (non
  l'intera rosa) e i due loghi in intestazione (stesso pattern HTML → `Print.printToFileAsync` →
  `Sharing.shareAsync` di `app/squadra/statistiche.tsx`). Tutto autosalva, nessun bottone "Salva"
  esplicito (stesso stile di `formazione.tsx`).
- **`app/eventi/partita/[id]/formazione.tsx`**: non gestisce più i convocati in proprio — rimossi
  `convocatiIds`/`MAX_CONVOCATI`/la modale "CONVOCATI" interna. Ora legge (sola lettura)
  `loadConvocazione(matchId).playerIds` per filtrare `availablePlayers`; se vuoto mostra un banner
  d'avviso con link al tab Convocazione.
- **`app/eventi/partita/[id]/index.tsx`**: non è più un semplice `<Redirect>` a Live. Se la partita è
  già avviata (`loadStarted`) o l'utente è Giocatore va dritto su Live come prima; altrimenti (Staff/
  Admin, pre-Start) mostra un piccolo chooser con due card, "📋 CONVOCAZIONE" e "🔴 LIVE".
- **`app/eventi/partita/[id]/live.tsx`**: card "🗒️ CONVOCAZIONE" (link al tab) sempre visibile per
  Staff/Admin, più una card "✏️ MODIFICA CONVOCATI" visibile solo **prima di Start** (modifica
  "ultimo secondo" richiesta esplicitamente da Francesco) che apre la stessa
  `ConvocatiPlayersModal` e chiama `saveConvocatiPlayerIds` (stessa pruning-logic).
- **`app/squadra/staffRoster.tsx`** (nuovo): CRUD della Rosa Staff (nome/categoria/ruolo) come
  schermata propria, visibile a Staff+Admin (`!readOnly`, non solo Admin come `staff.tsx` che gestisce
  gli account) — voce "Rosa Staff" in Gestione Squadra.
- **Loghi**: `organizations.logo_path` (logo squadra, uno per org, caricato in `app/squadra/staff.tsx`
  da chi è admin) ed `events.data.opponentLogoPath` (logo avversario, per singola partita, caricato dal
  tab Convocazione) — bucket Storage pubblico `team-logos`, stesso schema di autorizzazione di
  `player-photos`/`player-attachments`. Vedi [organization.ts](app/data/organization.ts).

**Cosa NON è (ancora) inclusa**:
- Nessuna **notifica push** ai convocati — richiede un'infrastruttura di push token per-utente non
  ancora costruita (nota già presente nel Backlog di `PIANO_LAVORO.md` su altri punti simili).
- Nessun **collegamento account↔staff roster** (l'equivalente di `memberships.player_id` per i
  Giocatori) — lo staff roster resta dato puro, non collegato a nessun account.
- **Menu pranzo**: rimosso dalla UI il 2026-07-30 su richiesta di Francesco ("deve essere molto più
  configurabile"), da riprogettare — i campi `menuItems`/`meals` restano nella colonna dati di ogni
  partita per non richiedere una migrazione quando tornerà (vedi Backlog in `PIANO_LAVORO.md`).

Nessuna dipendenza nuova (`expo-print`/`expo-sharing`/`expo-image-picker` già presenti) → arriva via
OTA. Richiede l'esecuzione di `App/supabase/12_schema_convocazione.sql` e
`App/supabase/13_schema_logos.sql` su Supabase.

## Fix critico: upload su Storage bloccato da RLS (2026-07-30)

**Sintomo**: dopo aver aggiunto il logo avversario, ogni upload su Storage falliva con
`StorageApiError` / `403` / "new row violates row-level security policy" — non solo il logo nuovo,
ma anche la foto profilo giocatore (`playerMedia.ts`, funzione esistente da mesi, mai toccata in
questo giro). Diagnosticato per esclusione: dati di membership corretti, testo delle policy
verificato carattere per carattere, salvataggi Postgrest (testi/dati) funzionanti normalmente,
riavvio del progetto Supabase ineffettivo.

**Causa reale**: ogni bucket immagine (`player-photos`, `player-attachments`, `tactic-previews`,
`team-logos`) aveva policy di INSERT/UPDATE/DELETE su `storage.objects` ma **nessuna policy di
SELECT** — il flag `public: true` del bucket copre solo la lettura via URL pubblico (CDN), non la
verifica interna che il servizio Storage fa per decidere se un file esiste già quando si carica con
`upsert: true` (usato ovunque nell'app). Senza una policy SELECT che la copra, quella verifica
interna viene rifiutata da RLS e l'intero upload fallisce — bug preesistente da quando
`8_schema_roles.sql` (2026-07-28) ha separato le policy in lettura/scrittura, mai emerso prima perché
nessuno aveva ricaricato una foto giocatore da allora fino a oggi.

**Fix**: `App/supabase/14_schema_storage_select_fix.sql` aggiunge una policy SELECT (scoped per
organizzazione, stesso `is_member_of`) su tutti e 4 i bucket. **Da tenere a mente per ogni bucket
Storage futuro**: servono sempre 4 policy (SELECT + INSERT + UPDATE + DELETE), mai solo le ultime 3,
anche se il bucket è pubblico.

## Sezioni "Admin" e "Staff" + collegamento account per lo Staff (2026-07-30)

Le due schermate di gestione staff sotto Gestione Squadra sono state rinominate e la Rosa Staff ha
guadagnato l'ultimo pezzo che aveva solo la Rosa Giocatori: collegare un account a una persona.

- **`app/squadra/staff.tsx` → "Admin"** (invariato: solo `membership.role === 'admin'`): oltre a logo
  squadra, "Inviti in attesa" e gestione membri (cambio ruolo/rimozione) già esistenti, ha ora una
  sezione **"Configurazioni"** — per ora contiene solo l'elenco dei **Ruoli disponibili per lo Staff**
  (editabile: aggiungi/rimuovi, autosalva su `organizations.staff_roles` jsonb), pensata per
  accogliere altre configurazioni in futuro. Rimosso il vecchio bottone "+ Invita membro staff" (nome
  libero, non collegato a nessuno): da ora ogni invito Staff nasce sempre da una persona già censita
  in "Staff", esattamente come già avveniva per i Giocatori.
- **`app/squadra/staffRoster.tsx` → "Staff"** (invariato: Staff+Admin, `!readOnly`): il campo Ruolo
  nella modale aggiungi/modifica è ora un `Picker` (le opzioni vengono da
  `loadStaffRoleOptions()`, configurabili da Admin) invece di testo libero. **Solo l'Admin** vede
  anche un terzo bottone per persona nell'elenco, "📤 Invita" (accanto a Modifica/Rimuovi): genera il
  codice (`create_staff_member_invite`, idempotente) e lo condivide **subito** in un solo tocco
  (`Share.share`) — un solo passaggio, più rapido del flusso a due passi (genera poi condividi
  separatamente) usato per i Giocatori, su richiesta esplicita di Francesco. Una volta collegata, il
  bottone diventa una scritta "✓ Collegato" (non cliccabile); lo scollegamento resta nella modale di
  modifica (sezione "Accesso account": stato + "Scollega account", `removeMember` — stesso RPC dei
  Giocatori). Lo stato di tutti gli inviti/collegamenti viene caricato in blocco una volta sola
  all'apertura della schermata (non per-persona), per popolare i bottoni della lista senza N chiamate.
- **Schema** — `App/supabase/15_schema_staff_invites_and_config.sql`: `memberships.staff_member_id`
  e `invites.staff_member_id` (entrambi fk a `staff_members`, mirror di `player_id`),
  `organizations.staff_roles` (jsonb, seed: Allenatore/Vice-Allenatore/Preparatore Atletico/
  Preparatore Portieri/Direttore Sportivo/Fisioterapista), nuovo RPC `create_staff_member_invite`
  (mirror di `create_player_invite`, idempotente), `redeem_invite`/`list_org_members`/
  `list_pending_invites` ridefinite per propagare/esporre anche `staff_member_id`/
  `staff_member_name`. Il vecchio `create_staff_invite` (nome libero) resta nel database inutilizzato,
  stessa convenzione già seguita per `join_organization`.
- `app/data/organization.ts`: `loadStaffRoleOptions`/`saveStaffRoleOptions`. `app/data/invites.ts`:
  `createStaffMemberInvite`/`loadStaffMemberInviteStatus` (rimosso `createStaffInvite`, non più
  chiamato). `app/data/staff.ts`: `OrgMember` esteso con `staffMemberId`/`staffMemberName`.

Nessuna dipendenza nuova (`@react-native-picker/picker` già presente) → arriva via OTA. Richiede
l'esecuzione di `App/supabase/15_schema_staff_invites_and_config.sql` su Supabase.
