---
name: report-avversario
description: Guida un'intervista rapida (poche note a voce, non prosa già scritta) per costruire un report scouting "Analisi Avversario" in stile match-analyst (sistema di gioco, fase di possesso/non possesso, punti di forza/deboli, calci piazzati, rosa, analisi calciatori, probabile formazione), e produce un file .json pronto da importare nello strumento HTML "Analisi Avversario — Generatore Report" per generare il PDF finale. Attiva SEMPRE questo skill quando l'utente vuole preparare, scrivere, aggiornare, riprendere o compilare un report su una squadra avversaria di calcio, un'analisi pre-partita, un report scouting/osservazione, oppure menziona una qualunque delle sezioni sopra (es. "presentazione squadra", "punti di forza", "calci piazzati", "analisi calciatori", "liste gara") in un contesto calcistico — anche se non nomina esplicitamente lo skill, il file json o l'artifact.
---

# Report Avversario — intervista guidata

## Scopo

L'utente è un match analyst che scrive report di scouting sugli avversari, in italiano, nello
stile professionale dei report "ANALISI AVVERSARIO" (registro tecnico-calcistico, terminologia
da osservatore: "sistema di gioco", "in fase di possesso...", "in fase di non possesso...",
nomi dei giocatori messi in risalto). L'utente NON vuole scrivere lui stesso il testo finale:
vuole dare 3-4 concetti al volo per sezione e ricevere da te un paragrafo già articolato,
pronto per il report. Il tuo compito in questo skill è condurre l'intervista sezione per sezione,
scrivere tu la prosa, raccogliere le immagini, e alla fine produrre un file .json conforme allo
schema in `references/schema.md`, che l'utente importerà nel suo strumento (un artifact HTML
già pubblicato, generatore di PDF) con il pulsante "Importa bozza".

Non devi mai rigenerare o toccare il codice dell'artifact: il tool è fisso e riutilizzabile,
cambia solo il file dati che gli passi.

## Prima di iniziare

Chiedi in una sola domanda:
1. Se sta iniziando un report nuovo (nome/avversario della prossima gara), oppure se sta
   riprendendo una bozza già iniziata — in quel caso chiedi il percorso del file .json
   precedente, leggilo con Read e usalo come stato di partenza (così può modificare solo
   alcune sezioni senza rifare tutto).

Se è un report nuovo, crea subito un file di lavoro in una cartella scratchpad (es.
`report-<nome-avversario>-<data>.json`) partendo dallo scheletro vuoto in
`references/schema.md`, e **aggiornalo via via dopo ogni sezione** (non solo alla fine): se la
conversazione si interrompe, l'utente non perde il lavoro già fatto e può riprendere semplicemente
richiamando lo skill e indicando il percorso del file.

## Come condurre l'intervista

Procedi **una sezione alla volta**, nell'ordine sotto. Per ogni sezione:
- Fai una domanda breve, colloquiale, che chiede 3-4 concetti veloci (non prosa) — vedi le
  domande suggerite in `references/schema.md` per ciascuna sezione.
- Se l'utente non ha nulla da dire su una sezione, lasciala vuota/di default e passa oltre:
  non insistere, non tutte le sezioni servono per ogni report.
- Se la sezione produce testo libero (presentazione squadra, punti di forza/deboli, fase di
  possesso/non possesso, note sui calci piazzati, analisi calciatori per reparto), riscrivi TU
  gli appunti dell'utente in un paragrafo scorrevole e professionale — vedi "Stile del testo"
  sotto. Mostra il paragrafo che hai scritto all'utente prima di salvarlo, così può correggerlo
  al volo se qualcosa non lo convince, poi passa alla sezione successiva.
- Aggiorna il file .json di lavoro con Edit dopo ogni sezione completata.

Ordine delle sezioni (rispecchia l'ordine nel tool):
1. Copertina (titolo, competizione, avversario, loghi, autore, gare visionate, luogo/data)
2. Presentazione squadra (sistema di gioco, ultimi risultati, marcatori, gol, narrativa generale)
3. Fase di possesso palla
4. Fase di non possesso
5. Punti di forza
6. Punti deboli
7. Calci piazzati — a favore
8. Calci piazzati — contro
9. Liste gara disponibili & rosa giocatori
10. Analisi calciatori (per reparto: portiere, difesa, centrocampo, attacco)
11. Probabile formazione

## Stile del testo (fondamentale)

Quando trasformi gli appunti dell'utente in prosa, scrivi come lo farebbe un match analyst
esperto che consegna un report a un allenatore:
- Frasi complete e scorrevoli, non elenchi puntati travestiti da paragrafo.
- Terminologia di settore: "sistema di gioco", "fase di possesso", "fase di non possesso",
  "linea difensiva", "corsia", "braccetto", "vertice basso", "ripiegamento", "pressione",
  ecc. — usa quella che l'utente stesso impiega quando ti dà gli appunti, altrimenti scegli
  quella più naturale per il contesto descritto.
- Metti in **grassetto** (sintassi markdown `**nome**`) i nomi dei giocatori quando li citi la
  prima volta in un paragrafo di analisi — il tool li renderizza in grassetto nel PDF.
- Tono oggettivo e valutativo, non entusiastico: descrivi cosa succede in campo e perché conta,
  senza esagerare i giudizi se l'utente non te lo chiede esplicitamente.
- Paragrafi separati da una riga vuota nel testo (il tool li spacca in `<p>` distinti).

Esempio di trasformazione (appunti → testo):
- Appunti utente: "gioca un 4-3-1-2, il trequartista è forte tecnicamente ma non rientra mai,
  portiere insicuro sulle uscite alte, terzino sinistro spinge molto"
- Testo scritto da te: "La squadra si schiera con un **4-3-1-2** abbastanza fluido, in cui il
  trequartista offre buone letture tra le linee e qualità di palleggio, pur non rientrando quasi
  mai a dare una mano in fase di non possesso. Il terzino sinistro è l'elemento più propositivo
  della batteria arretrata, spingendo con continuità sulla corsia; il portiere, invece, è
  apparso poco sicuro nelle uscite alte, un aspetto su cui insistere con i cross dal fondo."

## Marcatori

Chiedi semplicemente nome e gol per ciascun marcatore (es. "Rossi 2, Bianchi 1, Verdi 1").
Non calcolare tu la riga aggregata in stile "Rossi (2), Bianchi, Verdi (1)." — lo fa già
automaticamente lo strumento a partire dall'array `scorers`. Limitati a popolare
`presentation.scorers` come lista di `{name, goals}`.

## Immagini (stemma, foto azioni, liste gara, foto squadra, formazione)

L'utente allega le immagini direttamente nel messaggio di chat. Per ciascuna:
1. Individua il percorso del file allegato (Claude Code espone i file allegati con un percorso
   locale nel messaggio dell'utente). Se non riesci a risalire al percorso, chiedilo esplicitamente
   — non inventarlo e non saltare l'immagine in silenzio.
2. Codificala in base64 e componi una data URL con il mime type corretto in base all'estensione,
   ad esempio via Bash:
   `printf 'data:image/%s;base64,' <ext> && base64 -w0 "<percorso file>"`
   (usa `image/jpeg` per .jpg/.jpeg, `image/png` per .png, `image/webp` per .webp, ecc.)
3. Inserisci la data URL risultante nel campo corretto dello schema (es. `crestLogo`,
   `possession.blocks[i].image`, `matchSheets[i].image`, ecc. — vedi `references/schema.md`).

Le immagini possono pesare molto in base64: se l'utente allega molte foto ad alta risoluzione,
avvisalo che il file .json risultante sarà pesante, senza però comprimere o alterare le immagini
di tua iniziativa.

## Alla fine dell'intervista

1. Rileggi il file .json di lavoro e verifica che sia JSON valido e conforme allo schema.
2. Di' chiaramente all'utente il percorso completo del file.
3. Ricordagli che deve aprire lo strumento "Analisi Avversario — Generatore Report" e usare il
   pulsante "Importa bozza" per caricare questo file, poi "Genera PDF" per ottenere il documento
   finale. Se conosci l'URL dell'artifact già pubblicato per questo utente, ricordaglielo per
   comodità (ma è lui che decide se e quando aprirlo — non aprirlo tu automaticamente).
4. Chiedi se vuole rivedere/correggere qualche sezione prima di chiudere.

## Riprendere o modificare solo alcune sezioni

Se l'utente richiama lo skill per modificare un report esistente, leggi il file .json indicato,
mostragli rapidamente quali sezioni risultano già compilate (non vuote) e chiedigli quali vuole
rivedere — non ripetere l'intera intervista da capo se non serve.

Per lo schema JSON completo, i campi esatti di ogni sezione e le domande suggerite sezione per
sezione, leggi `references/schema.md`.
