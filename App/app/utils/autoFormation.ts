// app/utils/autoFormation.ts
//
// Layout automatico per Formazione ("Disponi automaticamente"): assegna i convocati disponibili ai
// slot del modulo scelto. Usa la profondità sul campo (coordinata y dello slot) per stimare il
// reparto, non l'id dello slot — i moduli predefiniti hanno id semantici (GK, DF1, MF2...) ma quelli
// personalizzati creati a mano hanno id generici (P1..P11, senza alcun significato di ruolo): un
// matching per id fallirebbe silenziosamente sul caso più comune.
import type { Player, Role } from '../data/players';

export type FieldBucket = 'GK' | 'DF' | 'MF' | 'FW';

export function bucketSlotByDepth(yPct: number): FieldBucket {
  if (yPct >= 85) return 'GK';
  if (yPct >= 65) return 'DF';
  if (yPct >= 38) return 'MF';
  return 'FW';
}

export function bucketPlayerByRole(role: Role): FieldBucket {
  switch (role) {
    case 'PORTIERE': return 'GK';
    case 'DIFENSORE': return 'DF';
    case 'CENTROCAMPISTA': return 'MF';
    case 'ATTACCANTE': return 'FW';
    default: return 'MF';
  }
}

/**
 * Due passate: (1) match esatto per reparto, slot in ordine di profondità poi x per determinismo;
 * (2) riempimento di quel che resta con i candidati non ancora piazzati, qualunque ruolo — garantisce
 * che con abbastanza convocati tutti gli slot si riempiano anche se la distribuzione dei ruoli reali
 * non coincide esattamente col modulo. Con meno candidati che slot, quelli restanti rimangono `null`
 * (stato già tollerato dal resto della schermata). Riusa un numero di maglia già noto, se presente.
 */
export function autoAssignPlayersToSlots<P extends Pick<Player, 'id' | 'name' | 'role'>>(
  slots: { x: number; y: number }[],
  candidates: P[],
  previousNumbers?: Record<string, number>
): Array<(P & { number?: number }) | null> {
  const result: Array<(P & { number?: number }) | null> = slots.map(() => null);
  const remaining = [...candidates];
  const slotOrder = slots
    .map((s, i) => ({ i, s }))
    .sort((a, b) => b.s.y - a.s.y || a.s.x - b.s.x);

  const takeByBucket = (bucket: FieldBucket): P | null => {
    const idx = remaining.findIndex((p) => bucketPlayerByRole(p.role) === bucket);
    if (idx === -1) return null;
    return remaining.splice(idx, 1)[0];
  };

  const place = (i: number, player: P) => {
    const number = previousNumbers?.[player.id];
    result[i] = number != null ? { ...player, number } : { ...player };
  };

  for (const { i, s } of slotOrder) {
    const player = takeByBucket(bucketSlotByDepth(s.y));
    if (player) place(i, player);
  }
  for (const { i } of slotOrder) {
    if (result[i]) continue;
    const player = remaining.shift();
    if (!player) break;
    place(i, player);
  }

  return result;
}
