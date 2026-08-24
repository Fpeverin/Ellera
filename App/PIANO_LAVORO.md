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

- **Menu pranzo configurabile in Convocazione** (rimosso dalla UI il 2026-07-30 su richiesta di
  Francesco, da riprogettare): piatti disponibili e scelta per ciascun convocato. Deve essere "molto
  più configurabile" di come era stato costruito la prima volta — da ridiscutere il design prima di
  reintrodurlo (i campi `menuItems`/`meals` restano comunque nella colonna dati di ciascun partita).
- **Lista Gara: modello reale**: l'export PDF (vedi Completato, 2026-08-21) usa per ora un layout
  generico coerente con quello della Convocazione — Francesco ha detto esplicitamente che il modello
  ufficiale (probabilmente serve una foto/scan del documento federale reale, come già fatto per la
  Scheda Convocazione Excel) lo implementeremo più avanti.

## In corso

### Riprogettazione lavagna tattica: Moduli, Tattiche, Formazione/Live (avviata 2026-08-10)
Il punto "da riprogettare" del backlog (non solo un problema di resize: 4 implementazioni quasi
duplicate e incoerenti dello stesso concetto campo+maglia trascinabile) — piano completo in 4 fasi,
salvato e concordato con Francesco. Richiesta: un'esperienza più "smart" (scambio di posizione
trascinando un token sopra un altro, un "modulo smart" che dispone da solo i convocati, zoom/pan sul
campo), funzionalità attuali mantenute identiche, nessuna migrazione Supabase. Regola dati confermata:
Formazione (sempre) + Tattiche di partita restano legate ai convocati reali; Moduli + Tattiche squadra
generiche restano con numeri 1-11 generici.
- **Fase 1 (fatta)**: primitive condivise `app/components/tactical/` (`Field`, `DraggableToken`,
  `Jersey`, `dropTarget`) — vedi CLAUDE.md per i dettagli tecnici — e migrazione di
  `app/moduli/editor.tsx` (rischio minimo, nessun dato reale). **Da verificare dal vero**: drag, swap,
  zoom/pan e adattamento al resize sono gesture multi-touch, non verificabili da soli.
- **Fase 2 (fatta)**: `app/squadra/tattiche/editor.tsx` — stesse primitive, più swap tra maglie
  nostre/avversarie (pallone escluso) e zoom azzerato automaticamente prima dello screenshot di
  preview. **Da verificare dal vero**: come Fase 1, più il controllo della preview salvata.
- **Fix critico (Fase 1+2)**: dopo il primo giro Francesco ha segnalato che il campo non si vedeva
  per niente su web — bug reale (non cache/OTA): il wrapper animato dello zoom in `Field.tsx` non
  aveva una dimensione propria, il campo dentro si risolveva a zero px, invisibile senza errori.
  Corretto e verificato dal vero con un server locale (screenshot prima/dopo) — vedi CLAUDE.md.
- **Fase 3 (fatta)**: `app/eventi/partita/[id]/formazione.tsx` — dati reali di partita e modalità
  Live, solo layer visivo/gesture (nessuna modifica a come si salva `lineup`/`positions`/`numbers`).
  Swap-on-drop in Live sugli indici di posizione (mai sull'assegnazione giocatore↔slot). Nuovo
  bottone "🪄 Disponi automaticamente" (`app/utils/autoFormation.ts`): dispone i convocati sugli slot
  per reparto (profondità sul campo, non id dello slot — funziona anche sui moduli personalizzati),
  non tocca mai la panchina, chiede conferma solo se sovrascrive una disposizione manuale già
  presente. **Da verificare dal vero — la fase più delicata**: drag/swap/sostituzione in Live, e
  "Disponi automaticamente" pre-partita.
- **Fase 4 (fatta)**: `app/eventi/partita/[id]/tattiche.tsx` — restyle visivo puro (`Field`/`Jersey`/
  `Ball`), interazione tap+Modal invariata (confermato: resta legata ai convocati reali, nessun drag,
  polling sostituzioni live e matching FIFO bit-per-bit identici).

**Tutte le 4 fasi sono implementate.** Resta da fare la verifica dal vero di Francesco su ciascuna —
data la segnalazione precedente (campo invisibile su web, corretto), questa volta la verifica conta
doppio prima di considerare il punto davvero chiuso.

### Round 2 — disco, campo realistico, vassoio drag (2026-08-10)
Dopo il primo giro, feedback negativo netto di Francesco sul risultato visivo: "il drag non mi piace,
la resa grafica del campo e il modo con cui vengono inseriti i placeholder dei giocatori nel campo
fanno schifo", con TacticalPad citata come riferimento di qualità. Validato con due round di prototipi
HTML interattivi (non nel codice dell'app) prima di toccare produzione — confermati da Francesco uno
per uno:
- **Round A**: confronto maglia-vs-disco e campo-vecchio-vs-campo-texture → **disco + campo con
  texture "erba tagliata" confermati come nettamente migliori**.
- **Round B**: nuovo meccanismo di aggiunta/rimozione token (vassoio con trascinamento diretto sul
  campo per aggiungere, trascinamento fuori dal campo per rimuovere, con animazione di comparsa/
  scomparsa) → **confermato "perfetto", richiesta esplicita di implementarlo nell'app reale**.

Implementato in produzione:
- **`Jersey.tsx`**: da maglia rettangolare a **disco circolare** con bordo scurito (nessun
  `color-mix()` disponibile in React Native, helper `darken()` manuale).
- **`Field.tsx`**: campo con texture a bande "erba tagliata" (`TURF_1`/`TURF_2`, 8 bande), dischetti
  del rigore aggiunti oltre al dischetto centrale già presente.
- **`DraggableToken.tsx`**: nuova prop `onRemove` — un token trascinato fuori dai margini del campo
  (con una piccola tolleranza) si rimuove da solo, con una micro-animazione di comparsa all'aggiunta e
  scomparsa alla rimozione.
- **`AddTray.tsx` (nuovo)**: vassoio di elementi trascinabili che sostituisce sia il vecchio "tocca per
  selezionare poi tocca il campo" (Moduli) sia i bottoni a posizione fissa "+ Nostro/+ Avversario/+
  Pallone" (Tattiche squadra) — un solo gesto di trascinamento dal vassoio al punto esatto del campo.
  Tecnica: il "fantasma" che segue il dito durante il trascinamento dipinge sopra il campo sfruttando
  il normale ordine di disegno di React Native (il vassoio va nell'albero JSX **dopo** il campo, nessun
  Portal/Modal necessario) — per questo in Tattiche squadra i controlli del vassoio sono stati spostati
  da sopra a **sotto** il campo.
- **`app/moduli/editor.tsx`** e **`app/squadra/tattiche/editor.tsx`**: riscritti sull'uso di `AddTray`
  al posto della UI di piazzamento precedente; funzionalità mantenute (numerazione automatica, "un
  solo pallone" in Tattiche squadra).
- **Formazione/Live e Tattiche di partita**: non toccate in questo round — i miglioramenti a
  `Jersey`/`Field` si applicano automaticamente perché sono le stesse primitive condivise, zero
  modifiche di codice necessarie in quei due file.

**Limite di verifica dell'ambiente di test automatico**: il drag-and-drop reale e tutte le animazioni
(comparsa/scomparsa token, fantasma durante il trascinamento) **non sono verificabili meccanicamente
in questa sessione** — il pannello browser automatizzato usato per i test non compone i frame quando
non è in primo piano, il che sospende `requestAnimationFrame` e quindi ogni animazione basata su di
esso (confermato con un test diretto: 30s di attesa, zero tick). Verificati invece con successo:
colori/forme/texture del campo (via ispezione stile calcolato) e la logica di rilevamento del drop
(entro i confini del campo sì/no). **Verifica dal vero di Francesco necessaria con priorità alta**,
dato il precedente miss sullo stesso set di funzionalità (campo invisibile su web).

## Completato

### Live: select del giocatore non scorrevano nei modali (2026-08-24)
Effetto collaterale del fix precedente "form sotto la barra Android": quel fix aveva aggiunto
padding in basso a tutti i modali di Live, ma nessuno aveva mai avuto uno scroll interno — con il
padding extra, su schermi piccoli o nei modali con più select (Sostituzioni, Inserimento manuale) il
contenuto poteva superare l'altezza visibile senza modo di raggiungerlo. Aggiunto lo scroll interno
ai 7 modali con più campi.

### Live/Formazione: causa residua + formazione di default dalla Lista Gara (2026-08-24)
Il fix di ieri (sotto) risolveva un bug reale ma il problema persisteva: **una seconda causa**. La
schermata non aveva nessuno stato di caricamento — si poteva assegnare un giocatore mentre Rosa/
lineup stavano ancora caricando in background, e quando il caricamento finiva sovrascriveva
silenziosamente quell'assegnazione appena fatta (su connessione lenta questa finestra poteva durare
diversi secondi). **Fix**: la schermata ora mostra un indicatore di caricamento e blocca ogni
interazione finché Rosa e formazione salvata non sono davvero pronte — nessuna finestra in cui
un'assegnazione fresca possa sparire.
Aggiunta anche la funzionalità richiesta insieme: se una partita non ha ancora una formazione
impostata e la **Lista Gara** ha già dei numeri assegnati, questi diventano il punto di partenza —
titolari (1-11) piazzati per reparto come "Disponi automaticamente", panchina (12-20), **numeri di
maglia compresi**. Scatta una sola volta a schermata, mai se c'è già una formazione impostata, mai
per il ruolo Giocatore.
**Da verificare dal vero con priorità molto alta**: aprire Formazione con Lista Gara già compilata e
nessuna formazione impostata (deve popolarsi da sola); assegnare più giocatori molto rapidamente
appena aperta la schermata; controllare che una formazione già impostata non venga mai sovrascritta.

### Live/Formazione: la formazione impostata si azzerava da sola (2026-08-23, secondo giro)
Segnalato subito dopo il giro qui sotto: impostare la formazione e tornare indietro non la salvava.
Causa reale — non una race di rete, un bug deterministico: l'effect che carica la formazione già
salvata gira una volta sola e traduce gli id in giocatori usando la Rosa (`usePlayers()`), ma non
riaspettava che la Rosa avesse finito di caricare (sempre vuota al primissimo render) — ogni
giocatore veniva quindi scartato, la formazione risultava vuota, e l'autosalvataggio scriveva subito
quella vuotezza sul server, cancellando per davvero quanto già impostato. **Si verificava ogni
volta**, non solo su connessione lenta. Corretto (dettagli in CLAUDE.md), più una coda che ordina i
salvataggi automatici (lineup e posizioni) così una scrittura più vecchia non può più arrivare dopo
una più recente e cancellarla.
**Da verificare dal vero con priorità altissima**: impostare una formazione, uscire, rientrare e
controllare che sia rimasta quella giusta.

### Live: 5 bug/richieste dopo la prima partita vera (2026-08-23)
Francesco ha segnalato insieme, dopo la prima partita reale della stagione: cronometro che non
scorreva, salvataggi di gol/cartellini/sostituzioni "a volte sì a volte no", form di inserimento
nascoste dalla barra di gesture Android (e che sembravano non chiudersi/non inserire l'evento),
select con un id al posto del nome del giocatore, e il bisogno di impostare a mano la durata di una
partita mai seguita dal vivo per le statistiche minutaggio. Investigati con 4 agenti paralleli prima
di intervenire — dettagli tecnici completi (cause reali, non sintomi) in CLAUDE.md. In breve:
- **Cronometro**: un effect ridondante scattava anche solo rientrando sulla schermata a partita già
  avviata, sovrascrivendo il cronometro reale con uno "ripartito da ora" — rimosso, ogni transizione
  ora aggiorna il cronometro in modo esplicito come già facevano i bottoni manuali.
- **Salvataggi**: nessun errore veniva mai mostrato (fallivano in silenzio su connessione debole a
  bordo campo) + un loop che scriveva in continuazione su `live_formation` in corsa con i salvataggi
  veri — entrambi corretti, aggiunto anche un blocco anti-doppio-tocco con "Salvataggio…" a schermo.
- **Form nascoste**: aggiunto lo spazio per la barra di gesture Android a tutti i modali di Live.
- **Select con id**: la formazione live poteva salvare l'id al posto del nome se la Rosa non aveva
  ancora finito di caricare (bordo campo, connessione lenta) — ora si autocorregge da sola, anche
  sulle formazioni già salvate con il bug, senza bisogno di alcuna migrazione.
- **Durata partita**: nuovo campo nel modale "Termina partita" di Live + un link sempre visibile per
  raggiungerlo anche su una partita mai avviata dal vivo — usato dalle statistiche minutaggio al
  posto del fisso 90'.
**Da verificare dal vero con priorità molto alta prima della prossima partita** (bug reali osservati
in game, non ipotetici): uscire e rientrare su Live a partita avviata senza che il cronometro si
blocchi/azzeri; inserire più eventi ravvicinati anche con connessione debole; aprire una formazione
già "sporca" (id al posto del nome) e verificare che si corregga da sola; impostare la durata di una
partita mai avviata dal vivo e controllare che le statistiche minutaggio la usino.

### Lista Gara: Staff configurabile + Capitano/Vice Capitano (2026-08-22)
Due richieste di Francesco: la sezione Staff nella Lista Gara deve poter essere disattivata
dall'Admin (di base è attiva) — nuovo switch in Admin → Configurazioni, applicato sia a schermo sia
nel PDF (colonna omessa del tutto, non lasciata vuota). E un modo semplice per indicare Capitano/
Vice Capitano: due chip "C"/"VC" su ogni riga numero già assegnata, mostrati anche nel PDF vicino al
nome ("(C)"/"(VC)"). Dettagli tecnici in CLAUDE.md — **da eseguire su Supabase**:
`App/supabase/26_schema_lista_gara_staff_toggle.sql`.
**Da verificare dal vero**: attivare/disattivare lo switch Staff e controllare che scompaia/
riapparisca sia a schermo sia nel PDF; marcare un capitano e un vice (anche in panchina) e
controllare che compaiano corretti nel PDF; che svuotare un numero con la ✕ tolga anche
l'eventuale capitano/vice legato a quel numero.

### Lista Gara: anno di nascita accanto al nome (2026-08-22, stesso giorno)
Richiesta di Francesco: utile per l'arbitro verificare le categorie Under/Over. Ogni giocatore
assegnato a un numero mostra ora "Nome Cognome · AAAA" sia a schermo sia nel PDF (solo per i
giocatori, non per lo Staff — non ha un anno di nascita tracciato). Nessuna modifica allo schema
dati (l'anno è già su `players.year`).

### Modifica data/ora/luogo partita, solo Admin (2026-08-22)
Richiesta di Francesco: prima non c'era alcun modo di correggere data/ora/luogo di una partita già
creata — bisognava eliminarla e ricrearla (perdendo convocazione/formazione/eventi già registrati).
Bottone "✏️" sulla card in Partite, solo Admin, apre `EditMatchModal` (nuovo componente, stesso
stile del modale di creazione ma solo questi 3 campi). Confermato con Francesco: "Luogo" resta un
campo unico (copre anche il nome dello stadio), nessuna modifica allo schema dati.
**Da verificare dal vero**: modificare una partita già passata/con dati registrati (convocazione,
formazione, eventi live) e controllare che nulla di quei dati venga toccato — la modifica dovrebbe
riguardare solo data/ora/luogo.

### Fix: su iPhone impossibile uscire da molte pagine (2026-08-21)
Segnalato da Francesco: su iPhone non si riusciva a "navigare la pagina" (tornare indietro) in
Moduli, Convocazione, Formazione, Live, Allenamenti, Calendario, Partite. **Non è un problema di
gesture assorbite** dalla lavagna tattica (ipotesi iniziale) — la causa reale: l'app si usa su iPhone
come PWA "Aggiunta a Home" (`display: "standalone"` nel manifest, vedi sezione Webapp in CLAUDE.md),
e in quella modalità **non esiste né lo swipe di sistema né un tasto indietro del browser** — a
differenza dell'app nativa Android o di un tab Safari normale. Tutte queste pagine sono `headerShown:
false` (header nativo disattivato a livello root) con un header **fatto a mano** che non aveva mai
incluso un bottone indietro, perché su Android/desktop/Safari-in-tab una via per tornare indietro
c'era sempre stata comunque — su iPhone PWA diventavano invece un vicolo cieco reale.
- Aggiunto un bottone "←" coerente (stesso stile in tutte) in cima a: `app/moduli/index.tsx`,
  `app/moduli/editor.tsx`, `app/allenamenti.tsx`, `app/calendario.tsx`, `app/partite.tsx`,
  `app/eventi/partita/[id]/index.tsx`, `.../convocazione.tsx`, `.../formazione.tsx` (nuova topBar
  dedicata, prima assente), `.../listaGara.tsx` (nuovo, vedi sotto).
- `.../live.tsx`: bottone "← Partite" che va con `router.replace('/partite')` invece di
  `router.back()` — un semplice "indietro" rientrerebbe nella pagina scelta-partita, che con la
  partita già avviata reindirizza subito di nuovo a Live (rimbalzo), quindi si salta dritti alla
  lista.
- `.../tattiche.tsx` (di partita) aveva già un bottone "Chiudi" funzionante — solo corretto un uso
  scorretto di `useRouter()` chiamato dentro un `onPress` invece della variabile `router` già in
  scope (funzionava comunque, ma viola le regole dei Hook).
- **Non toccate** (già con header nativo e bottone indietro "di serie" via `Stack.Screen` in
  `app/squadra/_layout.tsx`): Rosa, Statistiche, Archivio, Admin, Staff, Sondaggi, Tattiche squadra
  (l'elenco — l'editor invece aveva già un suo bottone indietro proprio dal giro precedente).

### Lista Gara (2026-08-21)
Nuova card "🧾 LISTA GARA" nella pagina scelta-partita (`app/eventi/partita/[id]/index.tsx`, accanto
a Convocazione/Live — quella pagina è comunque solo Staff/Admin) e nuova schermata
`app/eventi/partita/[id]/listaGara.tsx`. Contenuto specificato da Francesco: numeri **1-11 titolari**
e **12-20 panchina** assegnati a giocatori, più 6 ruoli di staff dedicati (Allenatore,
Vice-Allenatore, Preparatore Atletico, Preparatore Portieri, Fisioterapista, Dirigente
Accompagnatore) — i numeri scelti prima tra i convocati poi sul resto della rosa, i ruoli di staff
**solo** tra le persone della Rosa Staff (mai i giocatori — corretto il 2026-08-22, vedi sotto).
Nuova colonna `lista_gara` su `match_live` (dettagli tecnici in CLAUDE.md) — **da eseguire su
Supabase**: `App/supabase/25_schema_lista_gara.sql`. Aggiunto anche **"📄 Esporta PDF"** (stesso
pattern della Convocazione: loghi + info partita, layout generico — il modello ufficiale resta da
fare più avanti, vedi Backlog).

### Lista Gara: correzioni dopo il primo giro (2026-08-22)
Feedback di Francesco: **non deve essere possibile assegnare un giocatore a un ruolo di staff**
(prima era permesso come ripiego se nessuno in Staff era adatto — ora i 6 ruoli pescano solo dalla
Rosa Staff), **restyling grafico** (card colorate per sezione, pillole di conteggio, badge colorati
per numeri/ruoli — dettagli in CLAUDE.md, "va tutto bene, la grafica è migliorabile" era il feedback
esatto), e un **bottone "✕" rosso dedicato** su ogni riga assegnata per svuotarla (sostituisce la
pressione lunga, non abbastanza scopribile).
**Da verificare dal vero** (non testabile in questo ambiente senza un account/dati reali): apertura
della schermata con convocati già impostati, assegnazione/rimozione con la ✕ di un numero e di un
ruolo di staff (e che ora **non** compaiano giocatori tra i candidati di un ruolo), che il
salvataggio persista alla riapertura della pagina, il PDF generato, e il nuovo aspetto grafico.

### PDF Convocazione: replica fedele della Scheda Excel (2026-07-31, verificato 2026-08-03)
Ricevuto da Francesco il file originale "Scheda Convocazione Ellera.xlsx" (analizzato con `openpyxl`:
celle unite, box con bordi, posizione loghi/testo) — il vecchio PDF era solo un elenco di tabelle
senza stile. **Decisione presa con Francesco**: layout/disposizione replicati fedelmente, ma il
contenuto resta "solo i convocati" (non l'intera rosa con ✓/✗ come nell'Excel — quella era una scelta
precedente esplicita, confermata).
- `app/eventi/partita/[id]/convocazione.tsx`, `runExport`: nuovo template HTML — banner titolo, riga
  con logo squadra a sinistra/blocco titolo-competizione-data-ora-luogo al centro/logo avversario a
  destra (bordo attorno al blocco centrale, titolo partita in blu grassetto come nell'originale),
  box "Ritrovo" con bordo, due colonne affiancate (Convocazioni Giocatori numerati 1..N a sinistra;
  Staff Tecnico/Sanitario/Dirigenza a destra, ciascuna persona su due righe — ruolo in grassetto sopra,
  nome sotto, come nell'Excel), Riepilogo in basso al centro con i loghi ai lati (replica delle 4
  immagini nel file originale: loghi sia in alto che in basso). Nuovo `formatLongDateIt()` per la data
  in formato lungo italiano ("Domenica 12 ottobre 2025", come `dddd dd mmmm yyyy` nell'Excel).
- **Non toccato**: menu pranzo (voce a parte nel Backlog, foglio "MENU"/"Riepilogo Pranzo"
  dell'Excel — stessa richiesta "da riprogettare", non nel PDF Convocazione).
- **Verificato da Francesco (2026-08-03)**: confermato corretto su un vero PDF da telefono/browser.

### Notifiche push tra utenti: Sondaggi, Convocazione, Proposte Live, Modifiche anagrafica (avviata 2026-07-31, verificato 2026-08-03)
Prima infrastruttura di notifiche push **verso un altro utente** (finora solo promemoria locali,
`app/utils/eventReminders.ts`). Stato: **implementato, script SQL eseguiti, verificato dal vero**.
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
- **Fatto (Francesco)**: eseguiti in ordine su Supabase SQL Editor gli script `19`, `20`, `21`, `22`,
  `23`.
- **Verificato dal vero (2026-08-03)**: registrazione token su un dispositivo reale, notifica
  Convocazione, proposta Live con destinatari configurati, sondaggio "subito" e uno "programmato"
  (chiudendo l'app, per confermare che arrivi comunque via cron), risposta di un giocatore e relativa
  notifica allo staff — tutto confermato corretto.

### Webapp per PC e per chi ha iPhone (avviata 2026-07-31, verificato 2026-08-03)
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
- **Verificato (2026-08-03)**: "Aggiungi a Home" da Safari iPhone; export/import Excel
  Partite/Allenamenti — tutto confermato corretto.

### Allenamenti solo eventi + Calendario/Dashboard rifatti (avviata 2026-07-31, verificato 2026-08-03)
Su richiesta di Francesco: gli allenamenti non hanno più una sezione presenze dedicata nella scheda
giocatore/Statistiche, e il calendario Dashboard è stato rifatto (le due migliorie già in Backlog +
il fix del layout webapp segnalato sopra). Stato: **implementato e verificato in produzione**.
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

### Logo squadra in ogni schermata (2026-07-31)
Richiesta di Francesco: il logo squadra (caricato dall'Admin) deve comparire nell'header di tutte le
pagine dell'app, se caricato. Fatto letteralmente ovunque tranne login/registrazione/onboarding
(nessuna squadra ancora selezionata) e la pagina d'errore 404 — vedi `App/CLAUDE.md`, sezione "Logo
squadra in ogni schermata", per l'elenco completo e i dettagli tecnici (cache in memoria per non
rifare la query a ogni schermata, invalidata quando l'Admin carica un nuovo logo).

### Primi riscontri dopo l'apertura allo Staff (2026-07-31)
Francesco ha iniziato a distribuire l'app (solo allo Staff per ora). Tre segnalazioni:
- **Fix critico: tabella Statistiche che "lampeggiava"** — non era un problema della schermata in sé
  ma un bug di fondo in `app/hooks/usePlayers.ts`: `allPlayers` veniva ricreato (`[...active, ...ex]`)
  a **ogni render**, senza `useMemo`. In `statistiche.tsx`, dove `recompute` è un `useCallback` che
  dipende da `allPlayers` dentro un `useFocusEffect`, questo faceva ripartire il ricalcolo a ogni
  render → nuovo render → nuovo `allPlayers` → di nuovo ricalcolo, in loop infinito (da cui il
  lampeggiamento). **Fix**: `allPlayers` ora è `useMemo(() => [...active, ...ex], [active, ex])` —
  stessa identità finché i dati non cambiano davvero. Beneficia potenzialmente anche altre schermate
  che usano `usePlayers()` in modo simile, non solo Statistiche.
- **Ruolo Giocatore ampliato in Gestione Squadra**: prima vedeva solo Rosa e Staff. Ora vede anche
  **Statistiche** e **Archivio Stagioni**, entrambe già di sola consultazione (nessuna azione di
  scrittura in quelle schermate per nessun ruolo, tranne "Archivia stagione"/elimina archivio in
  Archivio — quei due bottoni restano nascosti per il Giocatore). Moduli e Tattiche restano
  Staff/Admin, come Allenamenti/Partite restano già in sola consultazione per il Giocatore (nessun
  cambiamento lì, comportamento confermato corretto da Francesco).
- **Ruolo di un "tester"**: per dargli la stessa visione di un Admin (non di uno Staff) non serve
  nessuna modifica al codice — basta che Francesco vada su Gestione Squadra → Admin, tocchi il nome
  della persona e cambi il ruolo in Admin da lì (funzionalità già esistente, più admin per squadra
  sono già supportati).

### 2026-08-10 — PDF Convocazione: ordine dello Staff
Francesco: nel PDF, lo staff a destra deve seguire un ordine di ruolo preciso — Staff Tecnico:
Allenatore, Vice-Allenatore, Preparatore Atletico, Preparatore Portieri; poi Staff Sanitario
(ordine tra categorie già corretto); poi Staff Dirigenziale: Direttore Sportivo, poi Team Manager.
Aggiunto solo nella generazione del PDF (`runExport` in `convocazione.tsx`), non nella checklist a
schermo — vedi CLAUDE.md per i dettagli tecnici. Un ruolo non previsto nell'ordine finisce in fondo
alla sua categoria, senza rompere l'export.

### 2026-08-03 — Permessi Staff per Importa/Esporta/Modello/Seleziona
Francesco: questi bottoni (Rosa/Partite/Allenamenti, più "Seleziona" in Rosa) devono essere di
default solo Admin, con un flag in Admin → Configurazioni per concederli anche allo Staff, sezione
per sezione (tutto o in parte). Aggiunta la sotto-sezione "Permessi Staff" con tre switch (Rosa/
Partite/Allenamenti, tutti spenti di default) — vedi CLAUDE.md per i dettagli tecnici. **Fatto
(Francesco)**: eseguito `App/supabase/24_schema_staff_export_permissions.sql`.

**Sondaggi (stessa richiesta)**: il toggle "accendi/spegni da admin" **esisteva già**
(`organizations.surveys_enabled`, switch "Sondaggi" nella stessa sotto-sezione Configurazioni,
costruito insieme al resto della funzionalità Sondaggi) — nessuna modifica necessaria.

### 2026-08-03 — Admin può modificare il nome del giocatore
Francesco si è accorto di aver invertito nome/cognome in alcuni giocatori inseriti in passato.
Aggiunto un campo "Nome" (solo Admin, modifica diretta, nessuna proposta) sopra i Dati anagrafici
nella scheda giocatore — Staff e Giocatore non lo vedono, a differenza degli altri campi. Non
riscrive lo storico già congelato (gol/cartellini/sostituzioni salvano il nome per copia al momento
dell'evento, gli Archivi Stagioni sono snapshot) — solo Rosa e schede da quel momento in avanti.

### 2026-08-03 — Convocazione: fix conteggio "sporco" + layout a due colonne + Seleziona tutti
Tre richieste di Francesco insieme (vedi CLAUDE.md, sezione "Convocazione: layout a due colonne +
fix conteggio sporco" per i dettagli tecnici):
1. **Bug segnalato**: il conteggio "Giocatori convocati (N)" mostrava un giocatore in più di quanti
   ne comparissero davvero. Causa: `isPlayerInMatches` non controllava la convocazione, quindi un
   giocatore convocato ma mai sceso in campo poteva essere eliminato del tutto dalla Rosa, lasciando
   un id "orfano" per sempre nel conteggio. Corretto sia alla radice sia con un'autocorrezione dei
   dati già sporchi (si sistemano da soli alla prima apertura della schermata).
2. **Layout a due colonne come il PDF**: la pagina Convocazione non usa più una modale per scegliere
   i giocatori — checklist diretta a sinistra, staff a destra (si impilano sotto i 700px di
   larghezza).
3. **Bottone "Seleziona tutti"/"Deseleziona tutti"**: sia nella nuova checklist inline sia nella
   modale rimasta per la modifica rapida in Live.

### 2026-08-03 — Rimosso il tetto massimo di 20 convocati
Su richiesta di Francesco ("deve essere possibile convocare più di 20 giocatori"): rimosso il limite
fisso, non sostituito con un altro numero arbitrario. `app/components/partite/ConvocatiPlayersModal.tsx`
ha ora il prop `max` opzionale (nessun tetto se omesso, invece del vecchio `DEFAULT_MAX = 20`);
`app/eventi/partita/[id]/convocazione.tsx` non passa più `max` (rimossa la costante `MAX_CONVOCATI`
e l'indicazione "/20" nel titolo della sezione). Il secondo punto che usa la stessa modale
("✏️ MODIFICA CONVOCATI" in `live.tsx`) non passava già un `max` esplicito, quindi ha ereditato
automaticamente il nuovo comportamento senza modifiche.

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
