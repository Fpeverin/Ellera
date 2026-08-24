// app/utils/eventDisplay.ts
//
// Colore/icona/etichetta di un evento calendario, condivisi tra Dashboard e Calendario (griglia
// mensile + blocco "Oggi/Domani") — un solo posto per "come mostro un evento in poco spazio".
// Aggiunto il 2026-08-24 su richiesta di Francesco: nella griglia mensile mancavano le icone e non
// si vedeva né la competizione né il numero di giornata.
import { CalendarEvent } from '../data/events';

// Una partita senza competizione impostata resta rossa (comportamento di prima); con una
// competizione impostata prende un colore stabile ricavato dal nome — stessa competizione, stesso
// colore sempre, diverse competizioni si distinguono a colpo d'occhio.
const COMPETITION_PALETTE = [
  '#2980b9', '#8e44ad', '#d35400', '#16a085', '#c0392b', '#0f766e', '#b45309', '#0891b2',
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function eventColor(ev: CalendarEvent): string {
  if (ev.type === 'ALLENAMENTO') return '#1b7f3b';
  const competition = (ev as any).competition as string | undefined;
  if (!competition) return '#e74c3c';
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
