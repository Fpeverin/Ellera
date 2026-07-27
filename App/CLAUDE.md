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
"Autenticazione e squadre" più sotto. **Eventi/Calendario e Giocatori/Rosa (+ foto/allegati) sono già su
Supabase**; i domini rimasti (dati live-partita, moduli, tattiche, archivio stagioni) restano ancora
locali via `@react-native-async-storage/async-storage`, in attesa delle fasi successive (vedi
[PIANO_LAVORO.md](PIANO_LAVORO.md)). Backup/ripristino manuale via export/import di un file JSON (copre
solo i dati ancora locali).

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
   `App/.eas/workflows/update-on-push.yml`). Non serve lanciare nessun comando.

2. **Serve una build nuova (raro)** — hai aggiunto una libreria che usa codice nativo, cambiato icona/
   splash/permessi, o aggiornato la versione di Expo. In questi casi una modifica "al volo" (OTA) non
   basta: serve una nuova build Android.
   → Vai su [expo.dev](https://expo.dev) → progetto `ElleraApp` → tab **Workflows** → lancia
   `build-internal.yml` (o da terminale: `eas workflow:run .eas/workflows/build-internal.yml`).
   Dopo qualche minuto ottieni un link/QR code: apri il link sul telefono e installa il nuovo APK
   (distribuzione interna, nessun Play Store).

### Setup una tantum (già fatto, da rifare solo se si crea un nuovo progetto EAS)
Perché l'aggiornamento automatico al push funzioni, il repository GitHub deve essere collegato al
progetto Expo: su [expo.dev](https://expo.dev) → progetto → tab **GitHub** → "Install & Authorize"
(un click, richiede l'autorizzazione GitHub del proprietario del repo).

## Autenticazione e squadre (Supabase)

- Login/registrazione email+password (`app/login.tsx`, `app/register.tsx`), gestiti da
  `app/context/AuthContext.tsx`.
- Dopo la registrazione, se non si ha ancora una squadra: `app/onboarding/team.tsx` propone di
  **creare una nuova squadra** (si diventa admin) o **entrare in una esistente** con un invite code
  condiviso dall'admin. Il gating (redirect a login/onboarding/app) è in `app/_layout.tsx`.
- Multi-tenant: tabelle `organizations` (squadre) e `memberships` (utente↔squadra + ruolo admin/staff),
  con Row Level Security — vedi `App/supabase/schema.sql`. Un utente vede solo i dati della propria
  squadra.
- `app/lib/currentOrg.ts` tiene traccia dell'org corrente per le funzioni di data-access (es.
  `saveEvents`), così non va passata a mano in ogni schermata.
- **Import dati locali una tantum**: se un device ha ancora eventi salvati alla vecchia maniera
  (pre-Supabase) e la squadra su Supabase non ha ancora eventi, la Dashboard chiede esplicitamente se
  caricarli (`app/utils/importLocalEvents.ts`) — mai in automatico.

## Modello dati

| Dove | Contenuto |
|---|---|
| **Supabase** — tabella `events` | Tutti gli eventi (partite + allenamenti), tipo `CalendarEvent` ([events.ts](app/data/events.ts)); colonne dirette per i campi filtrabili (type/date/time/location/opponent), il resto in una colonna `data` jsonb |
| **Supabase** — tabella `players` | Giocatori aggiunti manualmente (colonna `is_ex` invece di due liste separate) — il roster di base resta hardcoded in [players.ts](app/data/players.ts) |
| **Supabase** — tabelle `player_photos`, `player_attachments`, `player_injury_types` + bucket Storage `player-photos`/`player-attachments` | Foto profilo, allegati e tipologia infortuni per QUALSIASI giocatore (anche quelli statici) — vedi [playerMedia.ts](app/data/playerMedia.ts) |
| *(sotto: ancora `AsyncStorage` locale, in attesa di migrazione — vedi PIANO_LAVORO.md)* | |
| `modules/custom` | Moduli di gioco personalizzati (oltre ai predefiniti in [modules-layout.tsx](app/utils/modules-layout.tsx)) |
| `tactics/custom` | Tattiche/schemi salvati dalla lavagna tattica |
| `matches/goals/{id}`, `matches/subs/{id}`, `matches/cards/{id}` | Eventi live di una partita (gol, sostituzioni, cartellini) |
| `match/{id}/lineup` | Formazione (convocati, titolari, panchina, numeri di maglia) |
| `match/{id}/positions`, `live/formation/{id}` | Posizioni live in campo durante la partita |
| `live/timerState/{id}`, `live/started/{id}` | Stato persistente del cronometro partita (sopravvive a background/kill dell'app) |
| `match/{id}/tacticsAssignments` | Assegnazione tattiche salvate ai giocatori per una specifica partita |
| Archivio stagioni | Vedi [archive.ts](app/data/archive.ts) / [archiveBuilder.ts](app/utils/archiveBuilder.ts) |

## Funzionalità attive per area

### Dashboard (`app/index.tsx`)
- Calendario mensile con pallini/etichette colorate per partita (rosso) e allenamento (verde).
- Lista eventi futuri (nascosta su schermi piccoli per mancanza di spazio).
- Creazione rapida evento da tap su un giorno del calendario.
- **Export/Import backup**: esporta tutte le chiavi AsyncStorage in un JSON condivisibile e le reimporta.
- Scorciatoie verso Allenamenti, Partite, Gestione Squadra.

### Calendario (`app/calendario.tsx`)
- Vista a lista di tutti gli eventi ordinati per data/ora, con creazione nuovo evento.

### Allenamenti (`app/allenamenti.tsx`)
- Statistiche rapide (totale, del mese, prossimi).
- Creazione singolo allenamento.
- **Generazione "settimana ideale"**: selezione periodo su calendario + giorni/orari ricorrenti →
  crea in blocco gli allenamenti nel range, con deduplica su data/ora esistenti.
- Sezioni Oggi / Prossimi / Passati con eliminazione singola o totale (con conferma).
- Dettaglio allenamento (`eventi/allenamento/[id]/index.tsx`): gestione presenze per giocatore con stato
  `presente / assente / infortunato / differenziato`, tema della seduta.

### Partite (`app/partite.tsx` + `eventi/partita/[id]/*`)
- Creazione partita singola o per competizione/girone (`CompetitionModal`), filtro per competizione.
- Eliminazione singola partita, per competizione, o totale (con conferme dedicate).
- **Formazione** (`formazione.tsx`): scelta modulo, convocati (max 20), disposizione titolari/panchina,
  assegnazione numero di maglia, drag&drop sul campo.
- **Tattiche di partita** (`tattiche.tsx`): lavagna tattica per la singola partita, assegnazione di
  schemi salvati ai giocatori convocati.
- **Live match** (`live.tsx`):
  - Timer di gioco persistente (sopravvive a background/riavvio app) con fasi PRE_MATCH → 1°T → intervallo → 2°T → fine.
  - Registrazione **gol**, **sostituzioni**, **cartellini** (giallo/rosso, con rosso automatico al secondo giallo), sempre modificabili anche a partita finita.
  - Espulsioni marcate sul giocatore in campo.
  - Inserimento manuale di eventi passati.

### Gestione Squadra (`app/squadra/*`)
- **Panoramica**: conteggi per ruolo ed età media squadra.
- **Rosa** (`rosa.tsx`): elenco giocatori raggruppati per ruolo, aggiunta/spostamento a "ex giocatori",
  foto profilo, età calcolata da data di nascita se presente.
- **Moduli** (`app/moduli/*`): moduli predefiniti (es. 3-1-4-2, 3-4-2-1, ecc. — sola lettura) e moduli
  personalizzati creabili/editabili con editor drag&drop delle posizioni in campo.
- **Tattiche** (`squadra/tattiche/*`): editor lavagna tattica generale (maglie HOME/AWAY + palla,
  drag&drop, screenshot/export immagine dello schema via `react-native-view-shot`).
- **Statistiche** (`statistiche.tsx`): dati stagionali aggregati con filtri, **export PDF** (via `expo-print`
  + `expo-sharing`).
- **Archivio stagioni** (`archivio.tsx` + `archivio/[id]/*`): congela i dati della stagione corrente
  (partite, allenamenti, giocatori con statistiche) in uno storico consultabile per stagioni passate,
  cancellabile singolarmente.

### Scheda giocatore (`app/player/[id].tsx`)
- Tab: **Partite** (presenze/statistiche), **Allenamenti** (presenze), **Infortuni** (storico status),
  **Allegati** (documenti).
- Foto profilo (galleria o fotocamera), allegati (document picker), link esterni (browser in-app).

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

- Aggiunto Supabase (Postgres + Auth + RLS, piano gratuito): `App/supabase/schema.sql` contiene tabelle,
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

- Schema aggiuntivo `App/supabase/schema_players.sql` (da eseguire una volta in più, dopo
  `schema.sql`): tabella `players` (giocatori custom, con `is_ex` invece di due liste separate),
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
