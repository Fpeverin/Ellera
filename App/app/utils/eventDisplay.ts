// app/utils/eventDisplay.ts
//
// Colore/icona/etichetta di un evento calendario, condivisi tra Dashboard e Calendario (griglia
// mensile + blocco "Oggi/Domani") — un solo posto per "come mostro un evento in poco spazio".
// Aggiunto il 2026-08-24 su richiesta di Francesco: nella griglia mensile mancavano le icone e non
// si vedeva né la competizione né il numero di giornata.
import { CalendarEvent } from '../data/events';

// Tavolozza a 5 colori nettamente distinti, come richiesto da Francesco (2026-08-24, undicesimo
// giro): verde per gli allenamenti (invariato, il verde del brand), giallo/blu/rosso/viola a
// rotazione per le competizioni (stessa competizione = stesso colore sempre, tramite hash del
// nome). Una partita senza competizione impostata usa un grigio neutro invece del rosso di prima —
// altrimenti si sarebbe confusa con una competizione reale colorata di rosso dalla rotazione.
const COMPETITION_PALETTE = [
  '#ca8a04', // giallo (scuro abbastanza da restare leggibile col testo bianco della pillola)
  '#2563eb', // blu
  '#dc2626', // rosso
  '#7c3aed', // viola
];
const NO_COMPETITION_COLOR = '#64748b'; // grigio neutro — partita senza competizione impostata
const TRAINING_COLOR = '#1b7f3b'; // verde brand, invariato

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function eventColor(ev: CalendarEvent): string {
  if (ev.type === 'ALLENAMENTO') return TRAINING_COLOR;
  const competition = (ev as any).competition as string | undefined;
  if (!competition) return NO_COMPETITION_COLOR;
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
