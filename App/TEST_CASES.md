# TeamBoard — Casi di Test

Documento vivo, **nel repo apposta**: a differenza di CLAUDE.md/PIANO_LAVORO.md (cosa è stato fatto
e perché) questo file descrive **cosa deve succedere quando** — è pensato prima di tutto per essere
letto da un'AI (Claude) prima di toccare una funzionalità e per verificarla dopo averla modificata,
non solo per un tester umano. Non c'è alcuna suite di test automatizzata nel progetto (nessun
framework di test configurato): questo file è l'unico "contratto" scritto del comportamento atteso,
e la verifica resta manuale (a mano, o via browser-use per il web) — vedi `CLAUDE.md` per il
workflow di verifica standard (`tsc --noEmit` + `npx expo export -p web`, poi controllo dal vero).

## Come usarlo (regola per l'AI)

- **Prima di modificare una funzionalità**: leggi la sezione corrispondente per capire il
  comportamento atteso attuale (comprese le regole "non ovvie" marcate **Nota**) prima di cambiare
  codice.
- **Dopo aver modificato una funzionalità**: ripercorri (anche solo mentalmente/leggendo il codice,
  se non è possibile un giro reale nell'app) i casi di test della sezione toccata; se il
  comportamento atteso è cambiato DAVVERO (non un bug fix che lo riporta a come doveva essere),
  aggiorna la riga o aggiungine una nuova — stessa disciplina con cui si aggiornano
  CLAUDE.md/PIANO_LAVORO.md ad ogni giro di lavoro.
- **Nuova funzionalità**: aggiungi una nuova sezione (o nuove righe in una esistente) con lo stesso
  formato.
- **ID stabili**: non rinumerare le righe esistenti quando aggiungi casi — aggiungi in coda alla
  sezione con il prossimo numero libero. Un ID non deve mai essere riassegnato a un caso diverso.
- **Colonna Ruolo**: `Admin`, `Staff`, `Giocatore`, o `Admin/Staff` quando il comportamento è
  identico per entrambi; `—` quando il caso non dipende dal ruolo (es. puro comportamento dati).
- **Colonna Piattaforma**: vuota = vale ovunque; `Web` o `Nativo` solo per i casi con una
  differenza nota tra le due (vedi anche l'ultima sezione, "Compatibilità multipiattaforma").

## Legenda ruoli

- **Admin**: una persona per squadra (chi la crea), gestisce tutto incluse Configurazioni.
- **Staff**: invitato da una persona già censita in Rosa Staff; stessi permessi di Admin salvo le
  sezioni esplicitamente riservate (Configurazioni, gestione membri/inviti, alcuni Permessi Staff
  per Importa/Esporta disattivabili da Admin).
- **Giocatore**: invitato da un giocatore già censito in Rosa; accesso in sola lettura/consultazione
  alla maggior parte delle schermate, nessun accesso a Live/Lista Gara/Convocazione/Configurazioni.

---

## 1. Autenticazione, onboarding, ruoli e multi-squadra

File: `app/login.tsx`, `app/register.tsx`, `app/onboarding/team.tsx`, `app/context/AuthContext.tsx`.

| ID | Caso | Precondizioni | Passi | Risultato atteso | Ruolo |
|---|---|---|---|---|---|
| AUTH-01 | Registrazione nuova squadra | Nessun account | Registrati con email+password, scegli "Crea nuova squadra", inserisci nome squadra | Account creato, diventa Admin della nuova squadra, entra in Home | — |
| AUTH-02 | Ingresso in squadra esistente con codice invito | Un codice invito valido (Giocatore o Staff) già generato | Registrati, scegli "Ho un codice personale", inserisci il codice | Account collegato alla persona (giocatore/staff) corrispondente, ruolo e nome coerenti con l'invito | — |
| AUTH-03 | Codice invito già riscattato | Codice già usato da un altro account | Prova a riscattarlo di nuovo | Errore chiaro, nessun secondo collegamento creato | — |
| AUTH-04 | Login con credenziali errate | Account esistente | Login con password sbagliata | Messaggio di errore, nessun accesso | — |
| AUTH-05 | Accesso Giocatore a partita non ancora avviata | Membership Giocatore, partita futura | Apri la partita dalla Home/Calendario | Non vede Live/Lista Gara/Convocazione in scrittura; vede solo le info base della partita (vedi anche PART-xx) | Giocatore |
| AUTH-06 | Multi-squadra sullo stesso dispositivo | Due squadre diverse, due account diversi | Logout dalla prima, login con l'account della seconda | Dati (rosa, calendario, ecc.) completamente separati tra le due squadre | — |

---

## 2. Rosa Giocatori

File: `app/squadra/rosa.tsx`, `app/hooks/usePlayers.ts`, `app/components/AddPlayerModal.tsx`,
`app/data/rosterFile.ts`.

| ID | Caso | Precondizioni | Passi | Risultato atteso | Ruolo |
|---|---|---|---|---|---|
| ROSA-01 | Aggiungi giocatore | — | "+ Aggiungi", compila nome/ruolo/data nascita/altezza/peso, salva | Compare nella sezione del proprio ruolo, ordinato alfabeticamente nel ruolo | Admin/Staff |
| ROSA-02 | Sposta tra ex giocatori | Giocatore attivo | Tieni premuto sulla card → "Sposta tra ex giocatori" | Sparisce dalle sezioni per ruolo, compare in fondo sotto "Ex giocatori"; **Nota**: resta selezionabile ovunque sia già stato convocato/schierato in passato, non più per nuove convocazioni/Lista Gara/Formazione | Admin/Staff |
| ROSA-03 | Elimina definitivamente un giocatore mai sceso in campo | Giocatore mai convocato/in formazione/Lista Gara di nessuna partita | Tieni premuto → "Elimina giocatore" → conferma | Rimosso per sempre (non finisce tra gli ex) | Admin/Staff |
| ROSA-04 | Elimina definitivamente un giocatore già in una partita | Giocatore presente in convocazione/lineup/lista gara/live_formation di una partita della stagione | Prova a eliminarlo definitivamente | Bloccato con `PlayerInMatchError`, messaggio invita a usare "Sposta tra ex" invece | Admin/Staff |
| ROSA-05 | Selezione multipla → Sposta tra ex / Elimina | Più giocatori in rosa | Attiva modalità selezione, seleziona alcuni, usa la barra azioni in basso | Stesso comportamento di ROSA-02/03/04 ma in blocco; chi è bloccato per eliminazione viene segnalato per nome | Admin/Staff |
| ROSA-06 | Filtro per ruolo/anno/nome | Rosa con giocatori di ruoli/anni diversi | Applica un filtro | Solo i giocatori che corrispondono restano visibili, età media ricalcolata sul filtro | Admin/Staff |
| ROSA-07 | Esporta rosa in Excel | — | "Esporta Excel" | File scaricato con attivi ed ex in fogli/sezioni distinte | Admin (Staff se il permesso è concesso, vedi ADMIN-xx) |
| ROSA-08 | Importa rosa da Excel | File Excel nel formato del modello | "Importa Excel", scegli file | Anteprima delle righe da creare/aggiornare/spostare tra ex prima di confermare, nulla scritto finché non si conferma | Admin (Staff se permesso concesso) |
| ROSA-09 | Scarica modello Excel | — | "Modello" | File scaricato con intestazioni corrette e una riga di esempio | Admin (Staff se permesso concesso) |
| ROSA-10 | Carica foto profilo (web) | Scheda giocatore aperta | Tocca l'icona foto, scegli un'immagine | Anteprima locale immediata, poi caricata; nessun errore silenzioso | Admin/Staff |
| ROSA-11 | Giocatore in sola lettura | — | Apri Rosa come Giocatore | Vede l'elenco, nessun pulsante di modifica/eliminazione/selezione multipla | Giocatore |

---

## 3. Rosa Staff

File: `app/squadra/staffRoster.tsx`, `app/data/staffRoster.ts`.

| ID | Caso | Precondizioni | Passi | Risultato atteso | Ruolo |
|---|---|---|---|---|---|
| STAFF-01 | Aggiungi persona Staff | — | "+ Aggiungi" sotto una categoria (Tecnico/Sanitario/Dirigenza), nome + ruolo, salva | Compare nella categoria scelta, tra gli attivi | Admin |
| STAFF-02 | Ruolo "Collaboratore Tecnico" disponibile | — | Apri il picker Ruolo nella modale aggiungi/modifica persona Staff Tecnico | "Collaboratore Tecnico" è tra le opzioni senza doverlo aggiungere a mano | Admin |
| STAFF-03 | Sposta tra gli ex | Persona Staff attiva | "🔄 Sposta tra ex" sulla sua card | Si sposta nel blocco "Ex" della categoria (card più sbiadita), bottone diventa "↩️ Riattiva" | Admin |
| STAFF-04 | Riattiva persona ex | Persona Staff tra gli ex | "↩️ Riattiva" | Torna tra gli attivi della categoria | Admin |
| STAFF-05 | Persona ex non selezionabile per nuova convocazione | Persona Staff tra gli ex, non ancora convocata per la partita in esame | Apri Convocazione di una partita, cerca quella persona nella categoria | Non compare tra le caselle selezionabili | Admin/Staff |
| STAFF-06 | Persona diventata ex resta visibile se già convocata | Persona Staff convocata a una partita, poi spostata tra gli ex | Riapri la Convocazione di quella partita | La persona resta nella checklist, selezionata, e nel conteggio/PDF | Admin/Staff |
| STAFF-07 | Persona ex esclusa dai nuovi ruoli Lista Gara | Persona Staff tra gli ex, non ancora assegnata a un ruolo in questa Lista Gara | Apri il picker di un ruolo Staff vuoto in Lista Gara | Non compare tra "Staff" (il resto selezionabile); se già nei "Convocati" di quella partita resta visibile lì | Admin/Staff |
| STAFF-08 | Invita persona Staff (collega account) | Persona Staff non ancora collegata | "📤 Invita" | Codice generato e condiviso in un solo tocco; dopo il riscatto la riga mostra "✓ Collegato" | Admin |
| STAFF-09 | Scollega account | Persona Staff collegata a un account | Modifica → "🔓 Scollega account" | L'account esce dalla squadra, la persona torna collegabile a un nuovo codice | Admin |
| STAFF-10 | Rimuovi persona Staff | — | "Rimuovi" → conferma | Persona eliminata dall'elenco; **Nota**: a differenza dei Giocatori non esiste un blocco se già convocata in passato (nessun `isPlayerInMatches`-equivalente per lo Staff) | Admin |
| STAFF-11 | Elenco in sola lettura | — | Apri Rosa Staff come Giocatore (o Staff non Admin) | Vede l'elenco (attivi+ex); nessun pulsante di modifica/invito/sposta-ex per chi non è Admin | Giocatore/Staff |

---

## 4. Calendario unificato (Allenamenti + Partite)

File: `app/calendario.tsx`, `app/components/calendario/AllenamentiTab.tsx`,
`app/components/calendario/PartiteTab.tsx`, `app/components/MonthCalendarGrid.tsx`.

| ID | Caso | Precondizioni | Passi | Risultato atteso | Ruolo |
|---|---|---|---|---|---|
| CAL-01 | Apertura da Home | — | Tocca "📅 Calendario" in Home | Si apre la griglia mensile in cima + selettore Allenamenti/Partite sotto | — |
| CAL-02 | Tap su un giorno con eventi | Giorno con 1+ eventi | Tocca il giorno nella griglia | Se un solo evento, apre direttamente quello; se più di uno, modale di scelta | — |
| CAL-03 | Icone/colori/giornata in griglia | Eventi di tipo diverso nel mese | Osserva la griglia mensile | Allenamento = icona 🏃 verde; Partita = icona ⚽ colorata per competizione (stesso colore per la stessa competizione, colori diversi tra competizioni diverse fino a 4); partita senza competizione = grigio neutro; numero giornata in evidenza nella pillola | — |
| CAL-04 | Stemma-segnaposto sul giorno | Partita con stemma avversario configurato | Osserva il giorno di quella partita nella griglia | Stemma circolare in overlay sull'angolo della cella, più grande delle icone normali | — |
| CAL-05 | Crea settimana tipo Allenamenti | Tab Allenamenti | "Settimana ideale", configura giorni/orari, salva | Allenamenti ricorrenti creati per le settimane indicate | Admin/Staff |
| CAL-06 | Crea singolo allenamento | Tab Allenamenti | "+ Nuovo allenamento", compila data/ora/luogo/tema, salva | Evento creato, visibile in griglia e nell'elenco Prossimi | Admin/Staff |
| CAL-07 | Crea calendario competizione (più partite) | Tab Partite | "+ Competizione", compila squadre fisse se servono, round con date/giornate, conferma | Tutte le partite del calendario create in un colpo, ciascuna con competizione+giornata coerente | Admin/Staff |
| CAL-08 | Crea singola partita | Tab Partite | "+ Partita singola", compila avversario/data/competizione/giornata | Partita creata, compare in griglia/elenco | Admin/Staff |
| CAL-09 | Modifica data/ora/luogo/competizione/giornata partita | Partita esistente | Apri modifica dalla lista | Campi aggiornati e salvati, riflessi ovunque (griglia, pagina partita) | Admin |
| CAL-10 | Cancella evento | Evento esistente | Elimina dall'elenco Allenamenti/Partite | Sparisce da griglia ed elenchi; se partita, i dati live/lista gara/convocazione collegati non restano orfani visibili altrove | Admin/Staff |
| CAL-11 | Filtro per competizione (tab Partite) | Più competizioni nel calendario | Seleziona una competizione dal filtro | Solo le partite di quella competizione restano in elenco | Admin/Staff |
| CAL-12 | Import/Export/Modello Excel (entrambi i tab) | — | Come ROSA-07/08/09 ma per Allenamenti/Partite | Stesso comportamento (anteprima prima di confermare l'import) | Admin (Staff se permesso concesso) |
| CAL-13 | Regole Under/Over violate in una competizione | Regole configurate per la competizione | Crea/modifica un round con una formazione non conforme (vedi anche PART-xx) | Segnalazione chiara delle violazioni | Admin/Staff |

---

## 5. Competizione, Giornata, Squadre fisse

File: `app/components/partite/CompetitionModal.tsx`, `app/components/partite/CompetitionTeamsModal.tsx`,
`app/data/competitionTeams.ts`, `app/data/competitionRules.ts`, `app/squadra/staff.tsx` (stadio di casa).

| ID | Caso | Precondizioni | Passi | Risultato atteso | Ruolo |
|---|---|---|---|---|---|
| COMP-01 | Configura squadre per una competizione | Creazione/modifica competizione | Apri "Squadre", aggiungi nome + stadio + stemma per ciascuna | Squadre salvate, riusabili come chip rapidi in qualunque punto si scelga un avversario di quella competizione | Admin/Staff |
| COMP-02 | Carica stemma squadra (anteprima) | Modale Squadre aperta | Tocca l'icona stemma, scegli un'immagine | Anteprima locale immediata, poi upload; nessun errore silenzioso | Admin/Staff |
| COMP-03 | Scelta rapida squadra con chip | Squadre configurate per la competizione | In un campo "Avversario", tocca un chip squadra | Nome avversario, Luogo (auto da Casa/Trasferta + stadio) e stemma si compilano da soli | Admin/Staff |
| COMP-04 | Toggle Casa/Trasferta ricalcola Luogo | Avversario scelto via chip, Luogo non modificato a mano | Cambia Casa↔Trasferta | Il campo Luogo si aggiorna da solo (stadio proprio vs stadio avversario); **Nota**: se l'utente ha scritto il Luogo a mano, il toggle non lo sovrascrive più | Admin/Staff |
| COMP-05 | Stadio di casa configurato | — | Admin → Configurazioni → imposta Stadio di casa | Usato come Luogo automatico per le partite "Casa" | Admin |
| COMP-06 | Inserimento squadra senza competizione avviata | Nessuna competizione/round creato ancora | In Altre Partite o nel form partita singola, inserisci una squadra a mano | Funziona comunque: inserimento libero testuale, nessun blocco per mancanza di competizione | Admin/Staff |
| COMP-07 | Regole Under/Over | Competizione con regola configurata (es. max N over-age in campo) | Imposta una formazione che la viola | Segnalazione al momento del controllo (creazione round, Start partita) | Admin/Staff |

---

## 6. Pagina Partita (4 riquadri)

File: `app/eventi/partita/[id]/index.tsx`.

| ID | Caso | Precondizioni | Passi | Risultato atteso | Ruolo |
|---|---|---|---|---|---|
| PART-01 | Apertura pre-partita | Partita non ancora avviata | Apri la partita da Calendario/Home | Griglia 2×2: Convocati, Lista Gara, Live, Altre Partite — tutti raggiungibili | Admin/Staff |
| PART-02 | Apertura partita in corso/finita (Staff/Admin) | Partita avviata o terminata | Apri la partita | **Nota**: raggiunge SEMPRE la griglia a 4 riquadri, nessun redirect forzato a Live | Admin/Staff |
| PART-03 | Apertura partita non avviata (Giocatore) | Partita futura | Apri come Giocatore | Accesso di sola consultazione, nessuna scrittura (vedi AUTH-05) | Giocatore |
| PART-04 | Stemma avversario recuperato in automatico | Nessuno stemma caricato a mano per questa partita, ma una squadra configurata nella competizione ha lo stesso nome (match case/spazi-insensitive) | Apri la pagina partita/Convocazione/Lista Gara/Live | Lo stemma si collega da solo, nessun caricamento manuale necessario | Admin/Staff |

---

## 7. Convocazione

File: `app/eventi/partita/[id]/convocazione.tsx`.

| ID | Caso | Precondizioni | Passi | Risultato atteso | Ruolo |
|---|---|---|---|---|---|
| CONV-01 | Convoca giocatori | Rosa con giocatori attivi | Spunta i giocatori dalla checklist | Convocati salvati subito (autosalvataggio), contatore aggiornato | Admin/Staff |
| CONV-02 | Seleziona/deseleziona tutti i giocatori | — | "Seleziona tutti" / "Deseleziona tutti" | Tutti gli attivi spuntati/spuntati via in un tocco | Admin/Staff |
| CONV-03 | Convoca Staff per categoria | Rosa Staff con persone attive | Spunta persone nelle 3 categorie | Convocati salvati, conteggio per categoria aggiornato | Admin/Staff |
| CONV-04 | Giocatore ex non selezionabile, ma persiste se già convocato | Vedi ROSA-02 | Apri checklist giocatori | Stesso comportamento di STAFF-05/06 ma per i giocatori (già esistente, riferimento) | Admin/Staff |
| CONV-05 | Pulizia automatica id orfani | Un giocatore convocato in passato è stato eliminato del tutto dalla Rosa (caso ormai raro, vedi ROSA-04) | Riapri la Convocazione | L'id orfano viene tolto da solo da `playerIds`, conteggio corretto | Admin/Staff |
| CONV-06 | Carica stemma avversario (web) | — | Tocca icona stemma avversario, scegli immagine | Caricato senza errori, anche da webapp (non solo nativo) | Admin/Staff |
| CONV-07 | Esporta PDF Convocazione | Almeno un convocato | "📄 Esporta PDF" | PDF con loghi, titolo partita, elenco giocatori numerato, Staff per categoria, riepilogo | Admin/Staff |
| CONV-08 | Notifica push ai convocati | Convocati con account collegato e push configurato | "🔔 Notifica convocati" | Notifica inviata ai convocati con token push; messaggio chiaro su quanti avvisati rispetto al totale | Admin/Staff |
| CONV-09 | Ritrovo | — | Scrivi nel campo Ritrovo | Salvato in autosalvataggio, compare nel PDF | Admin/Staff |

---

## 8. Lista Gara

File: `app/eventi/partita/[id]/listaGara.tsx`, `app/data/matchLive.ts`.

| ID | Caso | Precondizioni | Passi | Risultato atteso | Ruolo |
|---|---|---|---|---|---|
| LG-01 | Assegna numero titolare/panchina | — | Tocca un numero (1-11 o 12-20), scegli un giocatore | Numero assegnato, convocati proposti per primi nel picker | Admin/Staff |
| LG-02 | Capitano/Vice Capitano | Numero assegnato | Tocca "C" o "VC" sulla riga | Etichetta attivata; toccarla di nuovo la disattiva; C e VC si escludono a vicenda sulla stessa riga | Admin/Staff |
| LG-03 | Sezione Staff attivabile/disattivabile | Toggle "Staff nella Lista Gara" in Admin → Configurazioni | Disattiva il toggle | La sezione Staff sparisce da schermo e PDF per tutte le partite; riattivandolo, ricompare | Admin |
| LG-04 | Assegna ruolo Staff | Sezione Staff attiva | Tocca un ruolo (Allenatore, ecc.), scegli una persona | Solo persone della Rosa Staff selezionabili (mai giocatori), convocati proposti per primi | Admin/Staff |
| LG-05 | Sezione Arbitri attivabile/disattivabile | Toggle "Arbitri nella Lista Gara" in Admin → Configurazioni | Disattiva il toggle | La sezione "Direzione di Gara" sparisce da schermo e PDF; riattivandolo ricompare | Admin |
| LG-06 | Compila Arbitro/Assistenti | Sezione Arbitri attiva | Scrivi nei 3 campi di testo libero | Autosalva al blur del campo, non collegati a nessuna persona della Rosa | Admin/Staff |
| LG-07 | Giocatore/persona rimossi mostrano placeholder | Un numero/ruolo punta a un id non più nella Rosa | Apri Lista Gara di quella partita | Mostra "(giocatore rimosso)"/"(persona rimossa)", mai un id grezzo | Admin/Staff |
| LG-08 | Esporta PDF Lista Gara | — | "📄 Esporta PDF" | PDF con Titolari/Panchina/Staff (se attivo)/Direzione di Gara (se attiva), loghi, intestazione partita | Admin/Staff |
| LG-09 | Giocatore in sola lettura | — | Apri come Giocatore | Messaggio "Non disponibile per il tuo ruolo", nessun accesso | Giocatore |

---

## 9. Formazione (per-match) e Moduli

File: `app/eventi/partita/[id]/formazione.tsx`, `app/moduli/index.tsx`, `app/moduli/editor.tsx`,
`app/utils/autoFormation.ts`.

| ID | Caso | Precondizioni | Passi | Risultato atteso | Ruolo |
|---|---|---|---|---|---|
| FORM-01 | Caricamento con stato visibile | Apertura schermata | Osserva subito dopo l'apertura | Indicatore di caricamento finché Rosa+lineup non sono pronti; **Nota**: nessuna assegnazione è possibile prima, per evitare che venga persa da un caricamento ancora in corso | Admin/Staff |
| FORM-02 | Formazione di default dalla Lista Gara | Partita senza formazione salvata, Lista Gara già compilata con numeri | Apri Formazione | Titolari/panchina/numeri precompilati dalla Lista Gara, disposti per reparto; scatta una sola volta per visita | Admin/Staff |
| FORM-03 | Formazione esistente mai sovrascritta dal default | Formazione già impostata in precedenza | Riapri Formazione | Resta quella salvata, il default da Lista Gara non la tocca mai | Admin/Staff |
| FORM-04 | Disponi automaticamente | Modulo scelto, convocati disponibili | "Disponi automaticamente" | Titolari piazzati per reparto coerente col ruolo di ciascuno | Admin/Staff |
| FORM-05 | Scambio posizione trascinando un token sopra un altro | Due giocatori già piazzati | Trascina un token sopra un altro | I due si scambiano posizione | Admin/Staff |
| FORM-06 | Modale "Scegli giocatore" scorrevole | Rosa lunga | Apri il picker di uno slot | Si scorre fino in fondo, bottone Chiudi compreso | Admin/Staff |
| FORM-07 | Giocatore spostato tra gli ex resta visibile se già schierato | Giocatore in formazione, poi spostato tra gli ex | Riapri Formazione | Nome corretto, non sparisce | Admin/Staff |
| FORM-08 | Modulo personalizzato | — | moduli → crea/modifica un modulo custom (posizioni libere) | Disponibile tra i moduli scelti in Formazione | Admin/Staff |

---

## 10. Tattiche (libreria squadra + per-match)

File: `app/squadra/tattiche/index.tsx`, `app/squadra/tattiche/editor.tsx`,
`app/eventi/partita/[id]/tattiche.tsx`.

| ID | Caso | Precondizioni | Passi | Risultato atteso | Ruolo |
|---|---|---|---|---|---|
| TAT-01 | Crea/salva schema tattico | — | squadra/tattiche → nuovo schema, disponi token, salva | Compare nell'elenco Tattiche, riapribile e modificabile | Admin/Staff |
| TAT-02 | Usa Tattiche dentro una partita | Schema salvato in libreria | Apri Tattiche dalla partita | Usa i giocatori REALI convocati/in rosa per quella partita (non un roster statico) | Admin/Staff |
| TAT-03 | Campo/token visibili su web | — | Apri una tattica da web | Campo e token renderizzati correttamente (colori/texture/drag), non invisibili | Admin/Staff (Web) |

---

## 11. Live

File: `app/eventi/partita/[id]/live.tsx`, `app/data/matchLive.ts`.

| ID | Caso | Precondizioni | Passi | Risultato atteso | Ruolo |
|---|---|---|---|---|---|
| LIVE-01 | Start partita | Partita non avviata, lineup valido | "Start" | Formazione live inizializzata da lineup/Lista Gara, cronometro avviabile, partita segnata come avviata | Admin/Staff |
| LIVE-02 | Start bloccato da Regole Under/Over | Formazione non conforme | "Start" | Alert con le violazioni, partita NON avviata | Admin/Staff |
| LIVE-03 | Cronometro continua tra uscita/rientro | Partita avviata, cronometro in corsa | Esci da Live, rientra dopo qualche secondo | Tempo corretto, non azzerato né bloccato | Admin/Staff |
| LIVE-04 | Registra gol | Partita avviata | "Gol" → scegli squadra/marcatore/minuto → conferma | Evento salvato e visibile nel tabellone/cronaca; se nostro gol, aggiorna anche Altre Partite (vedi AP-03) | Admin/Staff |
| LIVE-05 | Registra cartellino | Partita avviata | "Giallo"/"Rosso" → scegli squadra/giocatore | Evento salvato, giocatore marcato espulso se rosso (non più selezionabile per sostituzioni successive) | Admin/Staff |
| LIVE-06 | Registra sostituzione | Partita avviata, panchina disponibile | "Sostituzione" → chi esce (in campo, non espulso) → chi entra (in panchina, non espulso) | Formazione aggiornata, evento in cronaca | Admin/Staff |
| LIVE-07 | Inserimento manuale evento | Partita avviata | "Inserimento manuale" → tipo evento, squadra, dettagli | Evento aggiunto come se registrato dal vivo | Admin/Staff |
| LIVE-08 | Modifica/elimina evento già registrato | Evento esistente | Tocca un evento in cronaca → modifica/elimina | Cambiamento riflesso ovunque (tabellone, statistiche, Altre Partite se nostro gol) | Admin/Staff |
| LIVE-09 | Select con nome e cognome, mai un id | Qualunque modale con un picker giocatore (Gol/Giallo/Rosso/Sostituzione/Manuale) | Apri il picker | Mostra sempre `Nome Cognome`, mai un id grezzo; se il giocatore non esiste più in Rosa, mostra "(giocatore rimosso)" | Admin/Staff |
| LIVE-10 | Giocatore eliminabile solo se non già in questa partita | Giocatore già in `live_formation`/numeri Lista Gara di una partita | Prova a eliminarlo del tutto dalla Rosa | Bloccato, invita a "Sposta tra ex" (stesso principio di ROSA-04, esteso anche a questi due casi) | Admin/Staff |
| LIVE-11 | Fine partita | Partita avviata | "Fine partita" | Stato partita = terminata, cronometro fermo, evento salvato | Admin/Staff |
| LIVE-12 | Durata partita impostata a mano | Partita mai seguita dal vivo (risultato inserito dopo) | Imposta la durata manualmente | Statistiche minutaggio coerenti con la durata indicata | Admin/Staff |
| LIVE-13 | Stemmi squadre nello scoreboard | Stemmi configurati/disponibili per entrambe le squadre | Apri Live | Stemmi 56×56 sopra i nomi delle squadre; placeholder grigio se manca | Admin/Staff |
| LIVE-14 | Modali scorrevoli su schermo piccolo | Telefono in verticale | Apri un modale con Picker (Sostituzione, Inserimento manuale) | Tutto il contenuto raggiungibile scorrendo, Picker compreso, nulla sotto la barra di gesture | Admin/Staff |

---

## 12. Altre Partite

File: `app/eventi/partita/[id]/altrePartite.tsx`, `app/data/matchdayFixtures.ts`.

| ID | Caso | Precondizioni | Passi | Risultato atteso | Ruolo |
|---|---|---|---|---|---|
| AP-01 | Inserisci incontro di un'altra squadra | Qualunque stato della partita (anche senza competizione/giornata impostate) | Apri Altre Partite → aggiungi incontro | Squadre (testo libero o chip da Squadre configurate), risultato, marcatori inseribili liberamente | Admin/Staff |
| AP-02 | Condivisione tra le nostre partite della stessa giornata | Due nostre partite con stessa competizione+giornata | Inserisci un incontro da una delle due, apri Altre Partite dall'altra | L'incontro compare automaticamente in entrambe (chiave competizione+giornata) | Admin/Staff |
| AP-03 | Nostra partita sincronizzata in automatico | Partita con gol registrati in Live | Apri Altre Partite della propria partita | Riga "nostra" con risultato/marcatori presi da Live, non modificabile a mano (ma alleg abile) | Admin/Staff |
| AP-04 | Modifica Competizione/Giornata dalla partita | — | Modifica i campi inline in Altre Partite | Autosalva, e la chiave di condivisione con le altre partite si aggiorna di conseguenza | Admin/Staff |
| AP-05 | Allega foto/PDF a un incontro | Incontro inserito | "Allega" → scegli file | Allegato caricato, elencato sotto l'incontro | Admin/Staff |
| AP-06 | Anteprima allegato immagine | Allegato immagine presente | Tocca l'allegato | Anteprima a schermo intero dentro l'app (non apertura in browser esterno) | Admin/Staff |
| AP-07 | Elimina incontro/allegato | — | Elimina | Rimosso ovunque sia condiviso (altre nostre partite della stessa giornata) | Admin/Staff |
| AP-08 | Import automatico da TuttoCampo | `scripts/run-sync-tuttocampo.ps1` eseguito dal PC (Task Scheduler o a mano) per una Giornata con nostra partita | Apri Altre Partite di quella partita | Incontri delle altre squadre presenti con badge "🌐 Importata da TuttoCampo", risultato, marcatori e screenshot Formazioni allegato; nessuna riga per la nostra partita (quella resta quella sincronizzata da Live) | Admin/Staff |
| AP-09 | Riga importata non modificabile a mano | Incontro con badge TuttoCampo | Prova "✏️ Modifica"/"🗑️ Elimina" | Bottoni assenti (stesso trattamento della riga "nostra"); "📎 Allega foto/PDF" resta disponibile | Admin/Staff |

---

## 13. Statistiche squadra

File: `app/squadra/statistiche.tsx`.

| ID | Caso | Precondizioni | Passi | Risultato atteso | Ruolo |
|---|---|---|---|---|---|
| STAT-01 | Colonna Gol per i portieri | Portiere con gol subiti nella stagione | Apri Statistiche | Mostra i gol SUBITI come numero negativo in rosso (es. "-3"), non i gol fatti | Admin/Staff |
| STAT-02 | Coerenza schermo/CSV/PDF | — | Confronta i tre export per lo stesso giocatore | Stessi numeri; il segno negativo del portiere resta nel PDF, nel CSV è un numero semplice | Admin/Staff |
| STAT-03 | Presenze/minutaggio coerenti con Live | Partita con sostituzioni ed espulsioni | Controlla un giocatore coinvolto | Minuti giocati coerenti con ingresso/uscita/espulsione registrati in Live | Admin/Staff |

---

## 14. Archivio stagioni

File: `app/squadra/archivio.tsx`, `app/squadra/archivio/[id]/index.tsx`,
`app/squadra/archivio/[id]/match.tsx`.

| ID | Caso | Precondizioni | Passi | Risultato atteso | Ruolo |
|---|---|---|---|---|---|
| ARCH-01 | Archivia stagione | Stagione corrente con dati | Avvia l'archiviazione da Admin | Dati della stagione (calendario, statistiche, lista_gara, ecc.) salvati come istantanea consultabile, dati "correnti" ripartono puliti | Admin |
| ARCH-02 | Consulta stagione archiviata | Almeno una stagione archiviata | Apri l'archivio, scegli una stagione, apri una partita | Dati storici corretti e completi (risultato, marcatori, formazione) | Admin/Staff |

---

## 15. Sondaggi

File: `app/squadra/sondaggi/index.tsx`, `app/squadra/sondaggi/editor.tsx`.

| ID | Caso | Precondizioni | Passi | Risultato atteso | Ruolo |
|---|---|---|---|---|---|
| SOND-01 | Sezione disattivabile | Toggle Sondaggi in Admin → Configurazioni | Disattiva | Sezione sparisce per tutti, incluso Admin | Admin |
| SOND-02 | Crea sondaggio | Sezione attiva | Nuovo sondaggio, scegli destinatari, domande | Sondaggio inviato/visibile ai destinatari scelti | Admin/Staff |
| SOND-03 | Rispondi a un sondaggio | Sondaggio assegnato all'utente | Apri e rispondi | Risposta salvata, non ri-sollecitata | Giocatore/Staff |

---

## 16. Notifiche push

File: `app/data/pushNotify.ts`, integrazioni in Convocazione/Live/varie.

| ID | Caso | Precondizioni | Passi | Risultato atteso | Ruolo |
|---|---|---|---|---|---|
| NOTIF-01 | Notifica proposta Live | Toggle `notify_live_proposals` configurato con destinatari | Un Giocatore propone un evento Live (se previsto) | I destinatari configurati ricevono la notifica | — |
| NOTIF-02 | Notifica modifica dati giocatore | Toggle `notify_player_edit` configurato | Un giocatore modifica i propri dati | I destinatari configurati ricevono la notifica | — |
| NOTIF-03 | Nessun token push | Utente senza permesso notifiche concesso | Invia una notifica che lo includerebbe | Conteggio "avvisati X di Y", nessun errore bloccante | Admin/Staff |

---

## 17. Admin — Configurazioni

File: `app/squadra/staff.tsx` (sezione Configurazioni), `app/data/organization.ts`.

| ID | Caso | Precondizioni | Passi | Risultato atteso | Ruolo |
|---|---|---|---|---|---|
| ADMIN-01 | Logo squadra | — | Carica/cambia logo | Usato ovunque compaia `TeamLogo` (header, PDF, Live) | Admin |
| ADMIN-02 | Ruoli disponibili per lo Staff | — | Aggiungi/rimuovi un ruolo custom | Disponibile/non più disponibile nel picker Ruolo di Rosa Staff | Admin |
| ADMIN-03 | Permessi Staff per Importa/Esporta/Modello/Seleziona | — | Attiva/disattiva per area (Rosa/Calendario/ecc.) | Lo Staff vede/non vede quei bottoni di conseguenza | Admin |
| ADMIN-04 | Toggle "Staff nella Lista Gara" | — | Vedi LG-03 | — | Admin |
| ADMIN-05 | Toggle "Arbitri nella Lista Gara" | — | Vedi LG-05 | — | Admin |
| ADMIN-06 | Stadio di casa | — | Vedi COMP-05 | — | Admin |
| ADMIN-07 | Registro presenze allenamenti attivabile | — | Attiva/disattiva | Sezione presenze compare/sparisce in Allenamenti | Admin |
| ADMIN-08 | Gestione membri: cambio ruolo / rimozione | Membro esistente | Cambia ruolo o rimuovi | Permessi aggiornati al prossimo accesso; se rimosso, perde l'accesso alla squadra | Admin |
| ADMIN-09 | Inviti in attesa | Invito generato, non ancora riscattato | Visualizza/revoca | Codice mostrato, revoca lo invalida | Admin |

---

## 18. Import/Export Excel

File: `app/data/rosterFile.ts` e equivalenti per Calendario.

| ID | Caso | Precondizioni | Passi | Risultato atteso | Ruolo |
|---|---|---|---|---|---|
| XLSX-01 | Font professionale, nessuna formula rotta | File esportato | Apri il file | Font leggibile, nessun `#REF!`/`#NAME?`, formule (se presenti) corrette | — |
| XLSX-02 | Import con righe non valide | File con una riga malformata (es. data invalida) | Importa | Riga segnalata in anteprima come errore, le altre righe valide comunque importabili | Admin/Staff |
| XLSX-03 | Import idempotente | Stesso file importato due volte | Importa due volte di seguito | Nessun duplicato, la seconda volta aggiorna invece di ricreare | Admin/Staff |

---

## 19. Export PDF (Convocazione, Lista Gara, Statistiche)

| ID | Caso | Precondizioni | Passi | Risultato atteso | Ruolo |
|---|---|---|---|---|---|
| PDF-01 | Apertura/condivisione cross-platform | — | "Esporta PDF" su web e su nativo | Su nativo apre il flusso di condivisione del sistema; su web apre/scarica il PDF, nessun errore silenzioso | Admin/Staff |
| PDF-02 | Loghi presenti quando configurati | Logo squadra + stemma avversario presenti | Esporta un PDF che li include | Entrambi visibili e ben dimensionati | Admin/Staff |

---

## 20. Compatibilità multipiattaforma e note tecniche per l'AI

Casi che storicamente si sono rotti SOLO su una piattaforma — utili da ricontrollare esplicitamente
ogni volta che si tocca un flusso di caricamento immagini o un `Picker`.

| ID | Caso | Piattaforma | Cosa verificare |
|---|---|---|---|
| XPLAT-01 | Apertura selettore immagini al primo tocco | Web | Il file picker si apre SUBITO al tocco, senza bisogno di un secondo tentativo — qualunque `await` prima di `launchImageLibraryAsync()` (anche un permesso, no-op su web) rompe il gesto utente su alcuni browser |
| XPLAT-02 | Anteprima immagine dopo la selezione | Web/Nativo | L'anteprima locale compare subito, prima ancora che l'upload finisca |
| XPLAT-03 | `Picker` scorrevole dentro un modale con altezza massima | Web/Nativo | Nessun contenuto (incluso il bottone Chiudi) tagliato fuori dallo schermo |
| XPLAT-04 | Sincronizzazione multi-dispositivo | — | Una modifica fatta su un dispositivo compare sull'altro al prossimo caricamento/focus della schermata (dati su Supabase, non locali) |
| XPLAT-05 | Nessun id grezzo mostrato all'utente | — | Qualunque punto che risolve un id in un nome (giocatore, staff, squadra) deve avere un fallback leggibile ("(rimosso)"), mai l'id stesso — causa ricorrente di bug passati (vedi sezioni Live/Lista Gara) |

---

## Changelog di questo documento

- **2026-10-01**: creazione iniziale — prima stesura di tutte le sezioni, basata sullo stato
  dell'app a questa data (dopo "Staff: sposta tra gli ex + Collaboratore Tecnico").
- **2026-10-01**: aggiunti AP-08/AP-09 per la sincronizzazione automatica da TuttoCampo.
