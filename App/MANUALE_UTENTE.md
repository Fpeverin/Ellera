# ElleraApp — Manuale utente

Guida pratica a tutte le sezioni dell'app, pensata per chi la usa tutti i giorni (non serve
nessuna conoscenza tecnica). Per la documentazione tecnica/di sviluppo vedi [CLAUDE.md](CLAUDE.md);
per le idee future e la cronologia di cosa è stato fatto vedi [PIANO_LAVORO.md](PIANO_LAVORO.md).

## Indice

1. [Primo accesso: account e squadra](#1-primo-accesso-account-e-squadra)
2. [Dashboard (Home)](#2-dashboard-home)
3. [Calendario](#3-calendario)
4. [Allenamenti](#4-allenamenti)
5. [Partite](#5-partite)
6. [Gestione Squadra](#6-gestione-squadra)
7. [Scheda giocatore](#7-scheda-giocatore)
8. [Ruoli utente e permessi](#8-ruoli-utente-e-permessi)
9. [Domande frequenti](#9-domande-frequenti)

---

## 1. Primo accesso: account e squadra

L'app richiede un account: i dati non sono più legati al singolo telefono/tablet, ma alla squadra,
e si vedono identici da qualunque dispositivo su cui si accede con lo stesso account (o un account
diverso collegato alla stessa squadra).

- **Registrazione**: email + password (almeno 6 caratteri). Se richiesta la conferma email, arriva
  un link da aprire prima di poter accedere.
- **Login**: email + password, sempre disponibile dalla stessa schermata (link "Hai già un account?
  Accedi").
- Ogni campo password ha un'icona **👁️** per mostrare il testo in chiaro mentre lo digiti (utile su
  schermi piccoli o password complesse) — tocca di nuovo per rinasconderlo.
- **Prima squadra**: al primo accesso, se non si è ancora in nessuna squadra, l'app chiede di:
  - **Creare una nuova squadra** (basta dare un nome, es. "Ellera") → chi la crea diventa
    automaticamente **Admin**.
  - **Entrare in una squadra esistente** con un **codice invito** condiviso dall'admin (via
    "Staff", vedi [sezione 6](#staff-solo-admin)) → si entra come **Staff**.

## 2. Dashboard (Home)

La prima schermata che si vede aprendo l'app.

- **Header**: nome della squadra a sinistra, bottone **👤 Account** a destra — mostra l'account
  collegato (email, ruolo) e permette di **uscire** (logout). Utile su un dispositivo condiviso da
  più persone: si esce e si accede con un altro account senza reinstallare nulla.
- **Oggi e domani**: due colonne con gli impegni di oggi e di domani (allenamenti/partite),
  toccabili per aprirli direttamente — il modo più rapido per vedere cosa c'è nell'immediato senza
  scorrere il calendario.
- **Calendario mensile**: un pallino/etichetta colorata per ogni evento del giorno (rosso = partita,
  verde = allenamento). Per Admin/Staff, toccare un giorno apre subito la creazione di un nuovo
  evento in quella data (per il Giocatore il tocco non fa nulla, coerente con la sola lettura).
- **Azioni rapide**: scorciatoie dirette ad Allenamenti, Partite e — Gestione Squadra per Admin/
  Staff, direttamente Rosa per il Giocatore (che in Gestione Squadra vedrebbe comunque solo quella).

## 3. Calendario

Vista a elenco di **tutti** gli eventi (partite + allenamenti insieme), ordinati per data e ora.
Bottone **"+ Nuovo"** per aggiungere un evento; toccando una riga si apre il dettaglio (allenamento o
partita a seconda del tipo).

## 4. Allenamenti

- **Statistiche rapide** in cima: totale allenamenti, quanti nel mese corrente, quanti ancora da
  fare.
- **Nuovo allenamento singolo**: data, ora, luogo.
- **"Settimana ideale"**: si sceglie un periodo (data inizio/fine) e i giorni della settimana
  ricorrenti con il relativo orario (es. Lunedì e Mercoledì alle 18:30) → l'app crea in blocco tutti
  gli allenamenti in quel periodo, saltando automaticamente eventuali doppioni già presenti nella
  stessa data/ora.
- **Sezioni Oggi / Prossimi / Passati**, con eliminazione singola o totale (sempre richiesta
  conferma).
- **Esporta/Importa Excel**: esporta tutti gli allenamenti in un file XLSX; l'import riconosce
  l'allenamento esistente per **data+ora** e aggiorna solo luogo/tema — non tocca mai le presenze già
  segnate.
- **📄 Modello**: scarica un file XLSX di esempio già compilato con le colonne giuste (Data, Ora,
  Luogo, Tema) e un foglio "Istruzioni" che spiega ogni colonna — utile per capire come preparare il
  file da importare.
- **Dettaglio allenamento** (toccando una riga): per ogni giocatore si segna lo stato di presenza —
  ✅ Presente, ❌ Assente, 🏥 Infortunato, ⚡ Differenziato — e si può scrivere un tema/nota per la
  seduta. Tutto si salva subito, non serve un bottone "salva".

## 5. Partite

- **Creazione**: partita singola, oppure "per competizione/girone" (inserendo tutte le giornate di
  un torneo in un colpo solo). Filtro in alto per vedere solo le partite di una competizione.
- **Eliminazione**: singola partita, tutte quelle di una competizione, o tutte — sempre con conferma
  dedicata.
- **Esporta/Importa Excel** (sempre visibili, con qualsiasi filtro competizione — anche "Tutte"):
  riconosce la partita esistente per **avversario + casa/trasferta + competizione** (letta dalla
  colonna "Competizione" di ogni riga del file, non dal filtro selezionato nell'app) — l'import
  aggiorna solo data/ora/luogo, **mai** punteggio/formazione/cartellini/eventi già registrati di una
  partita già giocata. Un unico file può contenere partite di più competizioni insieme.
- **📄 Modello**: scarica un file XLSX di esempio già compilato con le colonne giuste (Avversario,
  Data, Ora, Casa/Trasferta, Luogo, Competizione) e un foglio "Istruzioni" che spiega ogni colonna.
- **Regole di partecipazione** (bottone "⚙️ Regole", con una competizione specifica selezionata):
  utile per tornei con vincoli di età (es. Eccellenza) — Under "servono almeno N giocatori in campo
  nati nell'anno X o dopo", Over "...o prima". Puoi aggiungere più soglie (es. 2006→1, 2007→2,
  2008→3: un giocatore giovanissimo soddisfa da solo più soglie). In **Formazione** vedi sempre lo
  stato di ogni soglia; in **Live**, "Start" e le sostituzioni vengono **bloccati con un messaggio
  chiaro** se il risultato non rispetta le regole attive per quella competizione. Un giocatore
  espulso (cartellino rosso) continua a contare come se fosse ancora in campo.
- Toccando una partita non ancora avviata (solo Staff/Admin — un account Giocatore va sempre
  direttamente su Live) compare prima una scelta tra due sezioni:

  ### Convocazione / Live: cosa scegliere
  - **📋 CONVOCAZIONE**: la pagina per decidere chi convocare (sotto).
  - **🔴 LIVE**: la gestione partita vera e propria (sotto). Una volta premuto "Start" in Live, toccare
    di nuovo la partita porta sempre dritti su Live — la scelta compare solo prima dell'inizio.

  ### Convocazione
  Riproduce la scheda di convocazione cartacea. Solo Staff/Admin.
  - **Logo avversario**: si può caricare per questa partita, comparirà nel PDF.
  - **Ritrovo**: testo libero (luogo/orario di ritrovo pre-partita).
  - **Giocatori convocati**: elenco Rosa in ordine alfabetico, fino a 20, con un bottone "✏️
    Modifica" che apre la selezione a spunta; l'elenco di chi è convocato compare come lista di
    etichette. **Sono questi i giocatori disponibili in Formazione** — chi non è convocato non può
    essere schierato.
  - **Staff convocato**: diviso in tre categorie — **Tecnico**, **Sanitario**, **Dirigenziale** — con
    un elenco a spunta sulle persone già censite in **Staff** (Gestione Squadra → Staff); se
    una categoria è vuota, un link porta direttamente lì per aggiungere qualcuno.
  - **Riepilogo**: conteggi per categoria e totale.
  - **📄 Esporta PDF**: prima chiede di confermare/correggere Competizione e giornata, Luogo, Ritrovo,
    Data e Ora (precompilati dai dati della partita), poi genera un PDF con **solo i convocati**
    (giocatori e staff) e i loghi (squadra + avversario, quando caricati).
  - **Modifica dell'ultimo secondo**: dalla schermata **Live**, finché la partita non è ancora
    iniziata (prima di "Start"), un bottone "✏️ Modifica convocati" permette di correggere al volo
    l'elenco giocatori anche senza tornare in questa sezione.
  - *(In arrivo)* Il menu pranzo è stato tolto temporaneamente per essere riprogettato in modo più
    configurabile.

  ### Formazione
  Scelta del **modulo** (es. 3-4-2-1, anche moduli personalizzati creati in "Gestione Squadra") e
  disposizione di titolari e panchina, trascinando le maglie sul campo tra i **giocatori convocati**
  (impostati nella sezione Convocazione — se non è stata ancora fatta, compare un avviso con il
  collegamento diretto), assegnazione del numero di maglia a ciascuno.

  ### Tattiche (di partita)
  Lavagna tattica dedicata a questa singola partita: si possono assegnare schemi/tattiche già salvati
  (vedi [Tattiche](#tattiche) in Gestione Squadra) ai giocatori convocati per quella gara.

  ### Live
  La schermata da usare durante la partita:
  - **Timer di gioco** con le fasi Pre-partita → 1° tempo → intervallo → 2° tempo → fine; il timer
    continua a scorrere anche se si mette l'app in background o si chiude per sbaglio.
  - Registrazione di **gol**, **sostituzioni**, **cartellini** (giallo/rosso — un secondo giallo
    genera automaticamente il rosso), sempre modificabili anche a partita già finita.
  - Le espulsioni restano segnalate sul giocatore in campo.
  - Un bottone dedicato permette di **inserire manualmente un evento passato** (utile se qualcosa non
    è stato segnato al momento giusto), sempre disponibile anche a fine partita.
  - Chi ha ruolo **Giocatore** vede la cronologia in sola lettura ma può **proporre** un gol o un
    cartellino con lo stesso bottone GOL/CARTELLINO (qui diventa "Proponi"); la proposta compare allo
    Staff/Admin in "Proposte in attesa" da confermare o rifiutare.

## 6. Gestione Squadra

Sezione con tutte le funzioni "di amministrazione" della rosa e degli strumenti tattici.

### Panoramica
Conteggi automatici: numero giocatori totali, età media, quanti per ruolo (portieri, difensori,
centrocampisti, attaccanti).

### Rosa
- Elenco giocatori raggruppato per ruolo, con foto profilo ed età (calcolata dalla data di nascita se
  inserita).
- Aggiunta nuovo giocatore, modifica dati, spostamento a "ex giocatori" (restano nello storico ma non
  contano più nella rosa attiva) — ogni giocatore è modificabile/cancellabile allo stesso modo, non
  esiste più distinzione tra giocatori "di base" e aggiunti a mano. Un giocatore che ha già preso
  parte a una partita di questa stagione non può essere eliminato del tutto (solo spostato tra gli
  ex) — l'app te lo segnala se ci provi.
- **Ex giocatori** anche loro eliminabili del tutto (tenuto premuto → "Elimina giocatore"), con la
  stessa protezione se hanno giocato questa stagione.
- **Selezione multipla** (bottone "☑️ Seleziona", funziona sia su attivi che su ex): tocca più
  giocatori per selezionarli, poi scegli "🔄 Sposta tra ex" o "🗑️ Elimina" dalla barra in basso per
  applicare l'azione a tutti insieme.
- **Esporta/Importa Excel**: esporta tutta la rosa (attivi + ex) con nome, ruolo, anno, altezza, peso,
  stato. L'import riconosce lo stesso giocatore **per nome**: aggiunge chi è nuovo e aggiorna i campi
  cambiati (incluso lo stato attivo/ex letto dal file). Se un giocatore attivo manca dal file
  importato, **non viene mai toccato in automatico** — prima di applicare l'import viene mostrata una
  schermata di riepilogo dove si sceglie, uno per uno, chi eventualmente spostare tra gli ex.
- **📄 Modello**: scarica un file XLSX di esempio già compilato con le colonne giuste (Nome, Ruolo,
  Anno, Altezza, Peso, Stato) e un foglio "Istruzioni" che spiega ogni colonna e i valori ammessi.

### Moduli
- Moduli predefiniti (es. 3-1-4-2, 3-4-2-1...) in sola lettura, sempre disponibili.
- Moduli personalizzati: si creano ed editano con un editor a trascinamento delle posizioni in campo
  ("+ Nuovo" nell'elenco moduli).

### Tattiche
Editor della lavagna tattica generale (maglie squadra/avversari + pallone, tutto trascinabile),
con possibilità di salvare uno schema (comparirà con un'anteprima immagine nell'elenco) e
riutilizzarlo poi nella tattica di una singola partita.

### Statistiche
Dati stagionali aggregati per giocatore (minuti giocati, gol, cartellini, presenze
partite/allenamenti...), con filtro per competizione. Bottone per **esportare un PDF** pronto da
condividere/stampare.

### Archivio stagioni
A fine stagione, "Archivia stagione corrente": si dà un'etichetta (es. "2025/2026") e l'app
congela in uno storico tutti i dati della stagione (partite, allenamenti, statistiche giocatori),
poi ripulisce i dati correnti per iniziare la stagione successiva da zero. Gli archivi passati
restano sempre consultabili (e cancellabili singolarmente se serve) da questa stessa sezione.

### Staff (Staff+Admin)
Elenco di persone — **Tecnico**, **Sanitario**, **Dirigenziale** — con nome e ruolo (scelto da un
menu, es. "Allenatore", "Fisioterapista"; la lista dei ruoli è configurabile in Admin →
Configurazioni), indipendente dagli account: non serve che quella persona usi mai l'app per comparire
nelle Convocazioni. Aggiungi/modifica/rimuovi da qui; è la lista da cui la Convocazione di ogni
partita sceglie chi convocare. Toccando una persona già censita, **solo l'Admin** vede anche una
sezione "Accesso account" per collegarla a un vero account (vedi sotto).

### Admin (solo Admin)
Visibile solo a chi ha ruolo Admin. Qui si gestisce chi fa parte della squadra sull'app:
- **Logo squadra**: in cima alla pagina, si può caricare/cambiare il logo generale della squadra —
  comparirà nel PDF di Convocazione.
- **Configurazioni**: per ora contiene l'elenco dei **Ruoli disponibili per lo Staff** (usati nella
  sezione Staff) — aggiungi o rimuovi voci liberamente.
- **Inviti in attesa**: elenco dei codici generati (per i Giocatori dalla loro scheda in Rosa, per lo
  Staff dalla sua scheda in Staff) e non ancora usati, con Condividi di nuovo o Revoca.
- **Membri della squadra**: email e ruolo di ognuno (per i Giocatori il nome collegato in Rosa, per lo
  Staff il nome collegato in Staff). L'admin può cambiare il ruolo (Admin/Staff/Giocatore) o rimuovere
  chiunque — **tranne se stesso**, per evitare sia il rischio di restare senza admin sia quello di
  auto-escludersi per errore.

## 7. Scheda giocatore

Si apre toccando un giocatore da Rosa o da altre schermate. Quattro schede:
- **Partite**: presenze e statistiche (minuti, gol, cartellini) partita per partita.
- **Allenamenti**: storico presenze agli allenamenti.
- **Infortuni**: storico dei periodi segnati come infortunato/differenziato.
- **Allegati**: documenti caricati (referti, certificati...), apribili dall'app.

Da qui si gestiscono anche **foto profilo** (da galleria o fotocamera) e **link esterni** (si aprono
nel browser integrato dell'app, senza uscire da ElleraApp).

**Dati anagrafici** (Ruolo, Data di nascita — scelta con un mini-calendario, Altezza, Peso), in cima
alla scheda:
- **Admin e Staff** li modificano su qualunque giocatore, con salvataggio immediato.
- Un **Giocatore** vede questa sezione solo sulla propria scheda (quella collegata al suo account) e
  può solo *proporre* una modifica: resta "in attesa" finché uno dello Staff/Admin non la conferma o
  rifiuta — quando Staff/Admin aprono quella scheda, la vedono lì con i bottoni Conferma/Rifiuta.

Solo per l'Admin, in cima alla scheda: se il giocatore non ha ancora un account collegato, un
bottone "Genera codice di accesso" (vedi [sezione 8](#8-ruoli-utente-e-permessi)); se è già
collegato, mostra l'email dell'account e un bottone **"🔓 Scollega account"** — rimuove quella
persona dalla squadra e libera il collegamento (potrai generare un nuovo codice per lo stesso
giocatore in seguito). **Non cancella l'account stesso** (per farlo serve la dashboard Supabase,
Authentication → Users).

## 8. Ruoli utente e permessi

Tre ruoli:
- **Admin** (uno per squadra, chi l'ha creata): tutto quello che può fare Staff, più la gestione dello
  Staff (generare inviti, cambiare ruoli, rimuovere membri).
- **Staff** (poche persone): accesso completo a tutte le altre sezioni (Rosa, Calendario, Allenamenti,
  Partite, Live, Moduli, Tattiche, Statistiche, Archivio).
- **Giocatore**: vede in sola lettura Rosa, Calendario/Allenamenti/Partite e la Live di una partita.
  Durante una Live può **proporre** un gol o un cartellino (stesso bottone GOL/CARTELLINO di sempre,
  ma con "Proponi" al posto di "Salva") — la proposta resta in attesa finché uno dello Staff non la
  conferma o la rifiuta da "Proposte in attesa". Non vede Moduli, Tattiche, Statistiche, Archivio né
  la gestione Staff.

### Come si entra in squadra: codici personali

Non esistono più codici invito "generici" condivisi da tutta la squadra. Ogni codice è **personale**,
generato dall'admin per una persona precisa:

- **Per un Giocatore**: dalla scheda di quel giocatore in Rosa (visibile solo all'admin) c'è un
  bottone "Genera codice di accesso" → mostra un codice da condividere (WhatsApp, messaggi...) con
  quella persona esatta. Quando lo usa in fase di registrazione, il suo account resta collegato per
  sempre a quel giocatore della rosa — non è possibile "entrare come Giocatore" senza essere legati a
  un giocatore reale già presente in rosa.
- **Per una persona dello Staff**: apri la sua scheda in Gestione Squadra → Staff → "Genera codice di
  accesso" (solo Admin) — esattamente come per un Giocatore, ma qui non serve che la persona usi mai
  l'app: se non la collega, comparirà comunque nelle Convocazioni.
- Chi riceve un codice si registra normalmente nell'app (email + password) e poi, invece di "Crea una
  nuova squadra", sceglie **"Ho un codice personale"** e lo inserisce: entra direttamente con il ruolo
  giusto, collegato a quella persona/giocatore, senza altri passaggi.
- In Gestione Squadra → Admin, l'admin vede anche l'elenco dei codici generati ma non ancora usati
  ("Inviti in attesa"), con la possibilità di condividerli di nuovo o revocarli se non servono più.

## 9. Domande frequenti

**Se cambio dispositivo, perdo i dati?**
No: tutto (calendario, rosa, foto, tattiche, statistiche, archivio) vive su un database condiviso
(Supabase), non sul telefono. Basta accedere con lo stesso account (o un account collegato alla
stessa squadra) da qualunque dispositivo per vedere sempre gli stessi dati aggiornati.

**Come faccio un backup?**
Non serve farlo manualmente: i dati sono già al sicuro sul database condiviso.

**Chi può vedere i dati della mia squadra?**
Solo chi è stato invitato (con il codice invito) o ha creato la squadra — ogni squadra vede
esclusivamente i propri dati, mai quelli di altre squadre eventualmente registrate sulla stessa app.

**Ho sbagliato a condividere il codice invito, qualcuno di indesiderato potrebbe entrare?**
Vai su Gestione Squadra → Admin → "Inviti in attesa" → "Revoca": il codice smette immediatamente di
funzionare (potrai generarne subito uno nuovo per la stessa persona).
