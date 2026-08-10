// app/components/tactical/Jersey.tsx
//
// Token condiviso da tutte le lavagne tattiche (Moduli, Tattiche squadra, Formazione, Tattiche di
// partita) — prima erano 4 copie quasi identiche di una "maglia" con maniche a due cerchietti, poco
// leggibile alle dimensioni reali. Ridisegnato come disco colorato con numero (2026-08-10, su
// richiesta esplicita di Francesco — confronto provato prima con un prototipo interattivo).
import { StyleSheet, Text, View } from 'react-native';

export type JerseyVariant = 'home' | 'away';
export type JerseySize = { w: number; h: number };

const HOME_FILL = '#2b3a67';
const HOME_INK = '#f3f4f8';
const AWAY_FILL = '#b8502f';
const AWAY_INK = '#fbeee7';

/** Scurisce un colore hex di una percentuale (0-1) — non esiste color-mix() in React Native. */
function darken(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * (1 - amount));
  const g = Math.round(((n >> 8) & 255) * (1 - amount));
  const b = Math.round((n & 255) * (1 - amount));
  return `rgb(${r}, ${g}, ${b})`;
}

export function Jersey({
  variant = 'home',
  number,
  size = { w: 34, h: 34 },
}: {
  variant?: JerseyVariant;
  number?: number | string | null;
  size?: JerseySize;
}) {
  const fill = variant === 'away' ? AWAY_FILL : HOME_FILL;
  const ink = variant === 'away' ? AWAY_INK : HOME_INK;
  const d = Math.min(size.w, size.h);

  return (
    <View style={{ width: size.w, height: size.h, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={[
          styles.disc,
          { width: d, height: d, borderRadius: d / 2, backgroundColor: fill, borderColor: darken(fill, 0.3) },
        ]}
      >
        {number != null && number !== '' ? (
          <Text style={[styles.number, { color: ink, fontSize: Math.max(10, d * 0.36) }]}>{number}</Text>
        ) : null}
      </View>
    </View>
  );
}

export function Ball({ size = 22 }: { size?: number }) {
  return (
    <View style={[styles.ball, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={{ fontWeight: '900', fontSize: Math.max(10, size * 0.5) }}>⚽</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  disc: {
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 2,
    elevation: 2,
  },
  number: { fontWeight: '800', letterSpacing: -0.3 },
  ball: {
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#111',
  },
});
