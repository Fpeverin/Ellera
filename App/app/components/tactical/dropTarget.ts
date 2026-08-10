// app/components/tactical/dropTarget.ts
//
// Helper puro (non un componente) per lo swap-on-drop: trascinare un token sopra un altro per
// scambiarli di posizione. Lavora in PIXEL, non percentuale — il campo non è quadrato, quindi una
// soglia in percentuale non rappresenterebbe una distanza visiva coerente tra le due dimensioni.
// La decisione "sposta o scambia" resta allo screen chiamante (nel suo callback onMove): questo
// helper si limita a dire "c'è un token abbastanza vicino?", nulla di più.
export type DropCandidate = { key: string; xPx: number; yPx: number };

export const DEFAULT_SWAP_THRESHOLD_PX = 40;

export function resolveDropTarget(
  nxPx: number,
  nyPx: number,
  siblings: DropCandidate[],
  excludeKey: string,
  thresholdPx: number = DEFAULT_SWAP_THRESHOLD_PX
): string | null {
  let closestKey: string | null = null;
  let closestDist = thresholdPx;
  for (const s of siblings) {
    if (s.key === excludeKey) continue;
    const dist = Math.hypot(s.xPx - nxPx, s.yPx - nyPx);
    if (dist <= closestDist) {
      closestDist = dist;
      closestKey = s.key;
    }
  }
  return closestKey;
}
