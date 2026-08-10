// app/components/tactical/AddTray.tsx
//
// Vassoio di elementi trascinabili per aggiungere nuovi token al campo (Moduli, Tattiche squadra) —
// sostituisce il vecchio "tocca per selezionare, poi tocca il campo per piazzare" (Moduli) e i
// bottoni "+ Nostro/+ Avversario/+ Pallone" a posizione fissa (Tattiche squadra) con un trascinamento
// diretto dal vassoio al punto esatto del campo, in un unico gesto.
//
// Ogni sorgente resta disponibile (non si "consuma" da sola): è compito dello screen chiamante
// decidere se un elemento va tolto dal vassoio dopo l'uso (Moduli, dove ogni maglia numerata è un
// elemento a sé) o resta sempre riutilizzabile (Tattiche squadra, dove "+ Nostro" crea tanti
// giocatori quanti servono) — semplicemente aggiornando l'array `items` passato.
//
// Non serve un Portal/Modal per il "fantasma" che segue il dito: il vassoio (e il suo fantasma, che
// vi appartiene) è reso DOPO il campo nell'albero (stesso ordine in entrambe le schermate), quindi
// dipinge sopra di esso quando il fantasma "esce" dai confini del vassoio — comportamento di default
// di React Native (nessun `overflow: hidden` sugli antenati). Bastano due misurazioni via
// `measureInWindow` (vassoio e campo) a inizio trascinamento.
import React, { useRef } from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, SharedValue, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

export type TrayItem = {
  key: string;
  node: React.ReactNode;
};

type Rect = { x: number; y: number; w: number; h: number };

const GHOST_SIZE = 40;

export default function AddTray({
  items,
  fieldRef,
  onDrop,
  label,
  hint,
  style,
}: {
  items: TrayItem[];
  fieldRef: React.RefObject<View | null>;
  /** xPct/yPct sono già in percentuale del campo, pronte da salvare nel modello dati. */
  onDrop: (itemKey: string, xPct: number, yPct: number) => void;
  label?: string;
  hint?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const trayRef = useRef<View>(null);
  const fieldRectRef = useRef<Rect | null>(null);
  const draggingKeyRef = useRef<string | null>(null);

  const trayOriginX = useSharedValue(0);
  const trayOriginY = useSharedValue(0);
  const ghostX = useSharedValue(0);
  const ghostY = useSharedValue(0);
  const ghostVisible = useSharedValue(0);
  const [ghostKey, setGhostKey] = React.useState<string | null>(null);

  const beginDrag = (key: string, absX: number, absY: number) => {
    draggingKeyRef.current = key;
    setGhostKey(key);
    // Posizione iniziale un po' approssimata (trayOrigin non ancora misurata) — si autocorregge al
    // primo `onUpdate`, che arriva quasi subito visto che il dito si è già mosso per generare onStart.
    ghostX.value = absX - trayOriginX.value - GHOST_SIZE / 2;
    ghostY.value = absY - trayOriginY.value - GHOST_SIZE / 2;
    ghostVisible.value = 1;
    trayRef.current?.measureInWindow((x, y) => {
      trayOriginX.value = x;
      trayOriginY.value = y;
    });
    fieldRef.current?.measureInWindow((x, y, w, h) => {
      fieldRectRef.current = { x, y, w, h };
    });
  };

  const endDrag = (absX: number, absY: number) => {
    ghostVisible.value = 0;
    const key = draggingKeyRef.current;
    draggingKeyRef.current = null;
    setGhostKey(null);
    const fr = fieldRectRef.current;
    if (!key || !fr) return;
    if (absX >= fr.x && absX <= fr.x + fr.w && absY >= fr.y && absY <= fr.y + fr.h) {
      const xPct = Math.max(0, Math.min(100, ((absX - fr.x) / fr.w) * 100));
      const yPct = Math.max(0, Math.min(100, ((absY - fr.y) / fr.h) * 100));
      onDrop(key, xPct, yPct);
    }
  };

  const ghostStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    left: ghostX.value,
    top: ghostY.value,
    opacity: ghostVisible.value,
    transform: [{ scale: 1.15 }],
  }));

  return (
    <View ref={trayRef} style={[styles.tray, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.itemsRow}>
        {items.map((item) => (
          <TraySourceItem
            key={item.key}
            item={item}
            onBegin={beginDrag}
            trayOriginX={trayOriginX}
            trayOriginY={trayOriginY}
            ghostX={ghostX}
            ghostY={ghostY}
            onEnd={endDrag}
          />
        ))}
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}

      <Animated.View style={[styles.ghostBox, ghostStyle]}>
        {ghostKey ? items.find((i) => i.key === ghostKey)?.node : null}
      </Animated.View>
    </View>
  );
}

function TraySourceItem({
  item,
  onBegin,
  trayOriginX,
  trayOriginY,
  ghostX,
  ghostY,
  onEnd,
}: {
  item: TrayItem;
  onBegin: (key: string, absX: number, absY: number) => void;
  trayOriginX: SharedValue<number>;
  trayOriginY: SharedValue<number>;
  ghostX: SharedValue<number>;
  ghostY: SharedValue<number>;
  onEnd: (absX: number, absY: number) => void;
}) {
  const pan = Gesture.Pan()
    .onStart((e) => {
      runOnJS(onBegin)(item.key, e.absoluteX, e.absoluteY);
    })
    .onUpdate((e) => {
      // Sul thread UI: nessun runOnJS per ogni frame del drag, solo per inizio/fine gesto.
      ghostX.value = e.absoluteX - trayOriginX.value - GHOST_SIZE / 2;
      ghostY.value = e.absoluteY - trayOriginY.value - GHOST_SIZE / 2;
    })
    .onEnd((e) => {
      runOnJS(onEnd)(e.absoluteX, e.absoluteY);
    });

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={styles.sourceItem}>{item.node}</Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  tray: { position: 'relative' },
  label: { fontSize: 13, fontWeight: '800', color: '#374151', marginBottom: 8 },
  itemsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  sourceItem: { alignItems: 'center', justifyContent: 'center' },
  hint: { fontSize: 12, color: '#6b7280', marginTop: 8, fontStyle: 'italic' },
  ghostBox: { width: GHOST_SIZE, height: GHOST_SIZE, alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' },
});
