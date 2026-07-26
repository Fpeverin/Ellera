# ElleraApp — documentazione funzionalità attive

> **Regola per lavori futuri**: tutte le funzionalità elencate qui sotto sono **attive e devono essere mantenute**.
> Non rimuovere, disattivare o riscrivere in modo sostanziale nessuna di queste funzionalità a meno che
> Francesco non lo richieda esplicitamente. Questo file va aggiornato ogni volta che si aggiunge/rimuove
> una funzionalità reale (non serve aggiornarlo per refactoring interni che non cambiano il comportamento).

## Cos'è

App Expo/React Native (gestionale stagione calcistica per allenatore), build APK Android via **EAS**
(`eas build -p android --profile preview`, vedi [Build APP.txt](Build%20APP.txt)). Nessun backend: tutti
i dati vivono in locale sul dispositivo tramite `@react-native-async-storage/async-storage`. Backup/ripristino
manuale via export/import di un file JSON.

Stack: Expo SDK 53, expo-router 5 (file-based routing, typed routes), React Native 0.79 / React 19,
`react-native-reanimated` + `react-native-gesture-handler` per le lavagne tattiche drag&drop,
`react-native-calendars` per i selettori di date, `expo-print` + `expo-sharing` per l'export PDF.

## Modello dati (AsyncStorage)

| Chiave | Contenuto |
|---|---|
| `calendar/events` | Tutti gli eventi (partite + allenamenti), tipo `CalendarEvent` ([events.ts](app/data/events.ts)) |
| `players/custom`, `players/custom/ex` | Giocatori aggiunti manualmente (attivi / ex), oltre a quelli statici in [players.ts](app/data/players.ts) |
| `players/photos` | Foto profilo giocatori |
| `players/attachments/{playerId}` | Allegati documenti per giocatore |
| `players/injuries/{playerId}` | Storico infortuni/status presenza |
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
