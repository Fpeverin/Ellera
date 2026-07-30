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
   `.github/workflows/eas-update.yml`, vedi sotto). Non serve lanciare nessun comando.

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

### Collegamento GitHub↔EAS Workflows (confermato attivo, ma non usato per l'OTA)
Il repository GitHub risulta correttamente collegato al progetto Expo (`Fpeverin/Ellera`, confermato
il 2026-07-29 su expo.dev → progetto → tab **GitHub**) — questo collegamento resta utile per lanciare
build manuali dalla dashboard ("Build from GitHub"), ma **non** per l'OTA automatico: quel compito è
passato alla GitHub Action descritta sopra.

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
- Scorciatoie verso Allenamenti, Partite, Gestione Squadra.

### Calendario (`app/calendario.tsx`)
- Vista a lista di tutti gli eventi ordinati per data/ora, con creazione nuovo evento.

### Allenamenti (`app/allenamenti.tsx`)
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

### Partite (`app/partite.tsx` + `eventi/partita/[id]/*`)
- Creazione partita singola o per competizione/girone (`CompetitionModal`), filtro per competizione.
- Eliminazione singola partita, per competizione, o totale (con conferme dedicate).
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
- **Formazione** (`formazione.tsx`): scelta modulo, convocati (max 20), disposizione titolari/panchina,
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

Per il ruolo **Giocatore**: solo la card Rosa è visibile in questa sezione (sola lettura); Moduli,
Tattiche, Statistiche, Archivio, Staff e Admin non compaiono e le relative schermate mostrano un
messaggio se raggiunte con un link diretto.

### Scheda giocatore (`app/player/[id].tsx`)
- Tab: **Partite** (presenze/statistiche), **Allenamenti** (presenze), **Infortuni** (storico status),
  **Allegati** (documenti).
- Foto profilo (galleria o fotocamera), allegati (document picker), link esterni (browser in-app).
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
- **`app/components/partite/ConvocatiPlayersModal.tsx`** (nuovo, condiviso): checklist giocatori con
  tetto massimo (default 20), usata sia dal tab Convocazione sia dalla modifica "ultimo secondo" in
  Live.
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
