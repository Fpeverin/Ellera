# Agent/ — contesto per gli agenti AI

Cartella voluta dall'utente (regola globale, 2026-10-14). Raccoglie quello che il codice non dice. Tienila aggiornata mentre lavori. Mai segreti.

| File | Contenuto |
|---|---|
| [analisi-avversari-slide.md](analisi-avversari-slide.md) | Strumenti Node per slide/pptx degli avversari, flussi, domande da fare, trappole |
| [teamboard-live.md](teamboard-live.md) | Live: convenzione casa/trasferta, modello cartellini/espulsioni, come ispezionare e correggere i dati di una partita, correzioni ancora aperte |
| [tuttocampo-sync.md](tuttocampo-sync.md) | Sync automatico di Altre Partite da TuttoCampo: dove gira (PC, Task Scheduler), log, config non segreta, trappole del sito e di Windows |

## Il repository

- `App/`: app Expo/React Native + Supabase. Ha la sua documentazione: `App/CLAUDE.md`, `TEST_CASES.md`, `PIANO_LAVORO.md`, `MANUALE_UTENTE.md`. Convenzione: gli script `App/supabase/*.sql` hanno un prefisso numerico di ordine di esecuzione (`N_...sql`).
- Radice: strumenti per le presentazioni degli avversari (vedi sopra).
- `Analisi Avversari/`: materiale per squadra (video, formazioni, pptx), ignorato da git. Contiene anche `Configurazioni Longo Match/Squadre/*.ltt`: nei roster LongoMatch si compila solo `LastName` (cognome); `Name` resta vuoto salvo cognomi duplicati nella stessa squadra.
- `2025-2026/`, `2026-2027/`: materiali di stagione (stemmi avversari in `Stemmi Avversari/`, loghi partite).
