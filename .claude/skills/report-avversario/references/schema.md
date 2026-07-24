# Schema JSON del report — riferimento completo

Questo è lo schema esatto atteso dal pulsante "Importa bozza" dello strumento
"Analisi Avversario — Generatore Report" (artifact HTML). Rispettalo alla lettera: nomi dei
campi, tipi, e struttura annidata. Campi mancanti vengono trattati come stringa vuota / lista
vuota / null dal tool, quindi puoi omettere quelli che l'utente lascia vuoti, ma è più sicuro
includerli comunque con valore vuoto.

Tutti i campi immagine (`agencyLogo`, `crestLogo`, ogni `image`, `squadPhoto`) sono `null` oppure
una data URL stringa tipo `"data:image/png;base64,AAAA..."`.

Tutte le date sono stringhe `"YYYY-MM-DD"`.

## Scheletro vuoto (stato di partenza per un report nuovo)

```json
{
  "matchTitle": "",
  "meta": {
    "title": "ANALISI AVVERSARIO",
    "competition": "",
    "opponent": "",
    "place": "",
    "date": "",
    "authorName": "",
    "authorRole": "Match Analyst",
    "footerLine": ""
  },
  "agencyLogo": null,
  "crestLogo": null,
  "matchesViewed": [],
  "presentation": {
    "system": "",
    "lastResults": [],
    "cupToggle": false,
    "cupResults": [],
    "scorers": [],
    "goalsFor": "",
    "goalsAgainst": "",
    "narrative": ""
  },
  "possession": { "intro": "", "blocks": [] },
  "nonPossession": { "intro": "", "blocks": [] },
  "strengths": "",
  "weaknesses": "",
  "setPiecesFor": { "bullets": [], "blocks": [] },
  "setPiecesAgainst": { "bullets": [], "blocks": [] },
  "matchSheets": [],
  "roster": [],
  "playerAnalysis": { "squadPhoto": null, "gk": "", "df": "", "mf": "", "fw": "" },
  "formation": { "note": "", "image": null, "disqualified": "" }
}
```

Un "blocco" media (usato in `possession.blocks`, `nonPossession.blocks`,
`setPiecesFor.blocks`, `setPiecesAgainst.blocks`) ha sempre questa forma:

```json
{ "caption": "", "image": null, "videoRef": "", "videoLink": "" }
```

- `caption`: la frase descrittiva scritta da te sopra l'immagine (supporta `**grassetto**`).
- `image`: data URL dell'immagine, o null se l'utente non ne ha una per quel blocco.
- `videoRef`: riferimento testuale tipo "min. 53'17''" (facoltativo).
- `videoLink`: URL cliccabile a un video, se l'utente ne fornisce uno (facoltativo).

## Domande suggerite per sezione

Usa queste come traccia, non alla lettera — adattale al flusso naturale della conversazione.

**1. Copertina** → `meta`, `agencyLogo`, `crestLogo`, `matchesViewed`
- "Come si chiama l'avversario e che competizione è?"
- "Hai lo stemma della squadra da allegare? E un tuo logo personale/dell'agenzia da mettere in alto su ogni pagina?"
- "Quali gare hai visionato per questo report? Dammi avversario/risultato/data per ciascuna."
- Autore: nome, qualifica, e la riga di credenziali che vuole ripetuta a piè di pagina (può
  darti tutto insieme, es. "Mario Rossi, Allenatore UEFA B, cell. ..., email ...").

**2. Presentazione squadra** → `presentation`
- "Che sistema di gioco usa? (es. 4-3-1-2, 3-5-2...)"
- "Ultimi risultati?" (una riga per risultato, es. "TERNI FC – SPOLETO 1-1")
- "Percorso in coppa da segnalare?" (se sì, `cupToggle = true` e compila `cupResults`)
- "Marcatori stagionali: nome e gol per ciascuno."
- "Gol fatti e subiti in totale?"
- "Dammi 3-4 concetti sull'andamento generale: classifica/posizione, allenatore, punti chiave
  della gara/e vista/e, impressione generale." → scrivi tu `narrative`.

**3. Fase di possesso** → `possession`
- "Come costruisce da dietro? Chi guida il gioco, che movimenti fanno i centrali/mediani?"
- Per ogni immagine: "cosa vediamo in questa immagine?" → `blocks[i].caption`, più
  `videoRef`/`videoLink` se disponibili.

**4. Fase di non possesso** → `nonPossession`
- "Come pressano? Chi esce, con che aggressività, come si ricompongono?"
- Stessa logica di blocchi/immagini della sezione precedente.

**5. Punti di forza** → `strengths`
- "3-4 cose in cui questa squadra è più forte."

**6. Punti deboli** → `weaknesses`
- "3-4 fragilità da sfruttare."

**7. Calci piazzati — a favore** → `setPiecesFor`
- "Chi sono i saltatori principali? Chi calcia? Che schemi ricorrenti hai notato?" → `bullets`
  (una nota breve per riga, tipo elenco puntato — qui NON serve prosa articolata, sono note
  puntuali come nell'originale).
- Immagini di supporto → `blocks`.

**8. Calci piazzati — contro** → `setPiecesAgainst`
- "Come si dispongono in marcatura su punizione/corner? Zona, uomo, misto?" → `bullets`.
- Immagini di supporto → `blocks`.

**9. Liste gara & rosa** → `matchSheets`, `roster`
- "Hai le foto delle distinte per giornata? Dimmi l'etichetta (es. 'Giornata 3') per ciascuna."
- "Dammi la rosa: nome, anno di nascita, ruolo (portiere/difensore/centrocampista/attaccante)
  per ciascun giocatore." → popola `roster` con `role` uno tra `"GK"|"DF"|"MF"|"FW"`.

**10. Analisi calciatori** → `playerAnalysis`
- Usa direttamente i nomi già raccolti in `roster` (non richiederli di nuovo).
- Per ciascun reparto: "dammi 3-4 impressioni sui giocatori di reparto X: caratteristiche,
  piede, chi si è messo in mostra, chi ha faticato." → scrivi tu il paragrafo per quel reparto,
  con i nomi in **grassetto** seguiti dall'anno tra parentesi quando lo conosci, es.
  `**Rossi** ('05)`.
- Foto squadra opzionale → `playerAnalysis.squadPhoto`.

**11. Probabile formazione** → `formation`
- "Note tattiche sulla probabile formazione avversaria?"
- "Hai un'immagine della formazione (es. da creaformazioni.it) da allegare?"
- "Ci sono squalificati o diffidati da segnalare?"
