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

1. **Migrare a Supabase i domini rimasti** (stesso pattern usato per Eventi/Calendario, vedi
   "Completato" sotto — una tabella + `org_id` + RLS, JSONB per i campi complessi):
   - Giocatori (rosa, ex giocatori) + foto/allegati/infortuni — le foto vanno su Supabase Storage
     invece di URI locali.
   - Dati live-partita (gol, sostituzioni, cartellini, formazione, timer, tattiche assegnate — oggi
     9 chiavi AsyncStorage per partita, diventano una riga per partita in una tabella `match_live`).
   - Moduli personalizzati e tattiche/lavagna tattica.
   - Archivio stagioni.
2. **Gestione staff (lato admin)**: schermata per l'admin per vedere chi è nella squadra, cambiare
   ruoli, rimuovere una persona, rigenerare l'invite code.
3. **Rimuovere i dati "di default" scritti nel codice** (rosa giocatori in `app/data/players.ts`,
   moduli/tattiche predefiniti) — una volta che tutti i domini vivono davvero nel backend, non ha più
   senso avere una rosa hardcoded nei sorgenti. *Dipende dal punto 1.*

## In corso

*(vuoto — si popola quando iniziamo davvero il prossimo punto del backlog)*

## Completato

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
