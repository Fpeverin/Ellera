// app/components/tactical/Jersey.tsx
//
// Maglia condivisa da tutte le lavagne tattiche (Moduli, Tattiche squadra, Formazione, Tattiche di
// partita) — prima erano 4 copie quasi identiche (ShirtOnField/HomeShirt/AwayShirt/BlueWhiteShirt).
import { StyleSheet, Text, View } from 'react-native';

export type JerseyVariant = 'home' | 'away';
export type JerseySize = { w: number; h: number };

const HOME_STRIPES: [string, string] = ['#ffffff', '#3b82f6'];
const AWAY_STRIPES: [string, string] = ['#ef4444', '#b91c1c'];

export function Jersey({
  variant = 'home',
  number,
  size = { w: 54, h: 36 },
}: {
  variant?: JerseyVariant;
  number?: number | string | null;
  size?: JerseySize;
}) {
  const [c1, c2] = variant === 'away' ? AWAY_STRIPES : HOME_STRIPES;
  const sleeveColor = variant === 'away' ? '#ef4444' : '#3b82f6';
  const borderColor = variant === 'away' ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.15)';
  const numberColor = variant === 'away' ? '#fff' : '#111';

  return (
    <View style={[styles.body, { width: size.w, height: size.h, borderColor }]}>
      {[0, 1, 2, 3, 4].map((i) => (
        <View key={i} style={{ flex: 1, backgroundColor: i % 2 === 0 ? c1 : c2 }} />
      ))}
      <View style={[styles.sleeve, { left: -10, backgroundColor: sleeveColor }]} />
      <View style={[styles.sleeve, { right: -10, backgroundColor: sleeveColor }]} />
      {number != null && number !== '' ? (
        <Text style={[styles.number, { color: numberColor }]}>{number}</Text>
      ) : null}
    </View>
  );
}

export function Ball({ size = 22 }: { size?: number }) {
  return (
    <View style={[styles.ball, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={{ fontWeight: '900' }}>⚽</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    flexDirection: 'row',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    overflow: 'hidden',
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sleeve: { position: 'absolute', top: 6, width: 18, height: 18, borderRadius: 5 },
  number: { position: 'absolute', fontWeight: '900', fontSize: 12 },
  ball: {
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#111',
  },
});
