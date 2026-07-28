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
| `players` | Tutta la rosa (attivi ed ex, colonna `is_ex`) — dal 2026-07-28 non c'è più nessun giocatore hardcoded nel codice, [players.ts](app/data/players.ts) contiene solo i tipi `Player`/`Role` |
| `player_photos`, `player_attachments`, `player_injury_types` + bucket Storage `player-photos`/`player-attachments` | Foto profilo, allegati e tipologia infortuni per QUALSIASI giocatore (anche quelli statici) — vedi [playerMedia.ts](app/data/playerMedia.ts) |
| `modules` | Moduli di gioco personalizzati (chiave naturale = nome), oltre ai predefiniti hardcoded in [modules-layout.tsx](app/utils/modules-layout.tsx) — vedi [modules.ts](app/data/modules.ts) |
| `tactics` + bucket Storage `tactic-previews` | Tattiche/schemi salvati dalla lavagna tattica, con preview immagine su Storage — vedi [tactics.ts](app/data/tactics.ts) |
| `match_live` | Una riga per partita: gol, sostituzioni, cartellini, formazione/posizioni live, timer persistente, tattiche assegnate — vedi [matchLive.ts](app/data/matchLive.ts) |
| `season_archives` | Archivio stagioni: un `data` jsonb con l'intero snapshot (`SeasonArchive` — vedi [archive.ts](app/data/archive.ts) / [archiveBuilder.ts](app/utils/archiveBuilder.ts)) |
| `invites` | Codici di accesso personali (Giocatore collegato a un `player_id`, o Staff con un nome libero), riscattabili una sola volta — vedi [invites.ts](app/data/invites.ts) |
| `match_event_proposals` | Gol/cartellini proposti da un Giocatore in una partita Live, in attesa di conferma/rifiuto da Staff/Admin — vedi [proposals.ts](app/data/proposals.ts) |
| `player_edit_requests` | Modifiche a ruolo/anno/altezza/peso proposte da un Giocatore per il proprio giocatore collegato, in attesa di conferma/rifiuto da Staff/Admin — vedi [playerEdits.ts](app/data/playerEdits.ts) |

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
- **Staff** (`staff.tsx`, card visibile solo se `membership.role === 'admin'`): elenco inviti in attesa
  (Condividi/Revoca) e membri attivi con email/ruolo (per i Giocatori anche il nome collegato in
  rosa); l'admin può cambiare il ruolo (Admin/Staff/Giocatore) o rimuovere chiunque tranne se stesso, e
  invitare un nuovo membro Staff dando solo un nome.

Per il ruolo **Giocatore**: solo la card Rosa è visibile in questa sezione (sola lettura); Moduli,
Tattiche, Statistiche, Archivio e Staff non compaiono e le relative schermate mostrano un messaggio
se raggiunte con un link diretto.

### Scheda giocatore (`app/player/[id].tsx`)
- Tab: **Partite** (presenze/statistiche), **Allenamenti** (presenze), **Infortuni** (storico status),
  **Allegati** (documenti).
- Foto profilo (galleria o fotocamera), allegati (document picker), link esterni (browser in-app).
- **Dati anagrafici** (Ruolo/Anno di nascita/Altezza/Peso): Admin e Staff li modificano su
  **qualunque** giocatore, in scrittura diretta (`updatePlayer` in `app/hooks/usePlayers.ts`). Un
  **Giocatore** vede questa sezione solo sulla scheda del giocatore a cui è collegato
  (`membership.playerId`) e può solo **proporre** una modifica (`proposePlayerEdit` in
  `app/data/playerEdits.ts`) — resta `pending` in `player_edit_requests` finché Staff/Admin non la
  conferma (applica i cambiamenti a `players`) o rifiuta, mostrato direttamente in questa stessa
  sezione quando Staff/Admin aprono quella scheda. Un giocatore non può proporre una seconda modifica
  finché quella in corso non è stata decisa. Schema: `App/supabase/9_schema_player_edits.sql`.

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
