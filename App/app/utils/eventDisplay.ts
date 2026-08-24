// app/utils/eventDisplay.ts
//
// Colore/icona/etichetta di un evento calendario, condivisi tra Dashboard e Calendario (griglia
// mensile + blocco "Oggi/Domani") — un solo posto per "come mostro un evento in poco spazio".
// Aggiunto il 2026-08-24 su richiesta di Francesco: nella griglia mensile mancavano le icone e non
// si vedeva né la competizione né il numero di giornata.
import { CalendarEvent } from '../data/events';

// Tavolozza a 5 colori nettamente distinti, come richiesto da Francesco (2026-08-24, undicesimo
// giro): verde per gli allenamenti (invariato, il verde del brand), giallo/blu/rosso/viola per le
// competizioni. Una partita senza competizione impostata usa un grigio neutro invece del rosso di
// prima — altrimenti si sarebbe confusa con una competizione reale colorata di rosso.
const COMPETITION_PALETTE = [
  '#ca8a04', // giallo (scuro abbastanza da restare leggibile col testo bianco della pillola)
  '#2563eb', // blu
  '#dc2626', // rosso
  '#7c3aed', // viola
];
const NO_COMPETITION_COLOR = '#64748b'; // grigio neutro — partita senza competizione impostata
const TRAINING_COLOR = '#1b7f3b'; // verde brand, invariato

function normalizeCompetition(competition: string | undefined | null): string {
  return (competition ?? '').trim().toLowerCase();
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

/** Mappa competizione → colore, senza collisioni finché le competizioni distinte restano al
 * massimo quante i colori disponibili (4): assegna i colori in ordine alfabetico del nome invece
 * che per hash — un hash su 4 caselle fa collidere quasi sicuramente 2-3 competizioni reali (visto
 * il 2026-08-24: Coppa e Campionato finivano entrambe blu). Da ricalcolare (con `useMemo`) da tutti
 * gli eventi visibili, e passare a `eventColor` — entrambi gli usi (Home, Calendario) hanno già
 * l'elenco completo a disposizione. Il confronto ignora spazi e maiuscole/minuscole, altrimenti
 * "Amichevole" digitato in modo leggermente diverso tra una partita e l'altra risultava colorato
 * in modo diverso pur essendo la stessa competizione. */
export function buildCompetitionColorMap(events: CalendarEvent[]): Record<string, string> {
  const names = new Set<string>();
  for (const ev of events) {
    if (ev.type !== 'PARTITA') continue;
    const name = normalizeCompetition((ev as any).competition);
    if (name) names.add(name);
  }
  const sorted = Array.from(names).sort();
  const map: Record<string, string> = {};
  sorted.forEach((name, i) => {
    map[name] = COMPETITION_PALETTE[i % COMPETITION_PALETTE.length];
  });
  return map;
}

export function eventColor(ev: CalendarEvent, competitionColorMap?: Record<string, string>): string {
  if (ev.type === 'ALLENAMENTO') return TRAINING_COLOR;
  const competition = normalizeCompetition((ev as any).competition);
  if (!competition) return NO_COMPETITION_COLOR;
  if (competitionColorMap?.[competition]) return competitionColorMap[competition];
  // Fallback se non è stata passata la mappa (usarla è sempre preferibile: evita collisioni tra
  // competizioni diverse, vedi buildCompetitionColorMap).
  return COMPETITION_PALETTE[hashString(competition) % COMPETITION_PALETTE.length];
}

export function eventIcon(ev: CalendarEvent): string {
  return ev.type === 'PARTITA' ? '⚽' : '🏃';
}

/** Etichetta compatta per spazi minuscoli (pillole nella griglia mensile): il numero di giornata
 * (se presente) va PRIMA dell'avversario, in evidenza — la competizione è già distinguibile dal
 * colore, ripeterla per esteso qui sprecherebbe lo spazio disponibile prima del troncamento a una
 * riga. */
export function eventCompactLabel(ev: CalendarEvent): string {
  if (ev.type === 'ALLENAMENTO') {
    const tema = ev.temaAllenamento ? ` · ${ev.temaAllenamento}` : '';
    return `Allenamento${tema}`;
  }
  const opp = ev.opponent || 'Avversario';
  const giornata = (ev as any).giornata as string | undefined;
  return giornata ? `${giornata}ª · ${opp}` : opp;
}

/** Etichetta estesa per spazi con più respiro (blocco "Oggi/Domani", modale scelta giorno). */
export function eventFullLabel(ev: CalendarEvent): string {
  if (ev.type === 'ALLENAMENTO') {
    const tema = ev.temaAllenamento ? ` · ${ev.temaAllenamento}` : '';
    const comp = (ev as any).competition ? ` · ${(ev as any).competition}` : '';
    return `Allenamento${tema}${comp}`;
  }
  const opp = ev.opponent || 'Avversario';
  const ha = (ev as any).homeAway as 'CASA' | 'TRASFERTA' | undefined;
  const titolo = ha === 'TRASFERTA' ? `${opp} - Ellera` : `Ellera - ${opp}`;
  const competition = (ev as any).competition as string | undefined;
  const giornata = (ev as any).giornata as string | undefined;
  const compPart =
    competition && giornata
      ? `${competition} · ${giornata}ª giornata`
      : competition || (giornata ? `${giornata}ª giornata` : '');
  return compPart ? `${titolo} · ${compPart}` : titolo;
}
