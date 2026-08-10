// app/components/tactical/Field.tsx
//
// Sfondo campo condiviso (linee, area, dischetto, porta) per tutte le lavagne tattiche — prima
// duplicato e leggermente incoerente in 4 file diversi (es. il cerchio di centrocampo era 120px fisso
// in due file e 110px fisso negli altri due, mai proporzionale al campo). Si automisura via onLayout
// (mai `Dimensions.get('window')` letto una volta sola — quella è la causa nota del bug "non si
// adatta se ridimensioni la finestra": qui basta che il contenitore passato dallo screen sia
// reattivo, es. con `flex: 1`, e questo componente segue).
//
// La misura è esposta in due forme, entrambe necessarie:
// - `useFieldMeasure()` — numeri JS, per chi calcola fuori da un worklet (screen, per lo swap-on-drop).
// - `useFieldMeasureShared()` — coppia di SharedValue, l'unica leggibile dentro un worklet
//   (DraggableToken, nel calcolo della posizione finale a fine drag).
import React, { createContext, useContext, useEffect, useState } from 'react';
import { LayoutChangeEvent, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, SharedValue, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

const LINE = 'rgba(255,255,255,0.7)';
const MIN_ZOOM = 1;
const MAX_ZOOM = 2.5;

export type FieldMeasure = { w: number; h: number };

const FieldMeasureContext = createContext<FieldMeasure>({ w: 0, h: 0 });
export function useFieldMeasure(): FieldMeasure {
  return useContext(FieldMeasureContext);
}

type SharedMeasure = { w: SharedValue<number>; h: SharedValue<number> };
const FieldMeasureSharedContext = createContext<SharedMeasure | null>(null);
export function useFieldMeasureShared(): SharedMeasure {
  const ctx = useContext(FieldMeasureSharedContext);
  if (!ctx) {
    throw new Error('useFieldMeasureShared deve essere usato dentro <Field>');
  }
  return ctx;
}

export default function Field({
  style,
  zoomable,
  resetKey,
  onTapField,
  onMeasure,
  children,
}: {
  style?: StyleProp<ViewStyle>;
  /** Pinch-to-zoom + pan a due dita — un dito solo resta sempre libero per il drag dei token. */
  zoomable?: boolean;
  /** Quando cambia, azzera zoom/pan (usarlo al cambio modulo/tattica selezionata). */
  resetKey?: unknown;
  /** Tap su un punto del campo, in percentuale — usato solo da Moduli per il piazzamento iniziale. */
  onTapField?: (nxPct: number, nyPct: number) => void;
  onMeasure?: (measure: FieldMeasure) => void;
  children?: React.ReactNode;
}) {
  const [measure, setMeasure] = useState<FieldMeasure>({ w: 0, h: 0 });
  const wShared = useSharedValue(0);
  const hShared = useSharedValue(0);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setMeasure({ w: width, h: height });
    wShared.value = width;
    hShared.value = height;
    onMeasure?.({ w: width, h: height });
  };

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  useEffect(() => {
    scale.value = 1;
    savedScale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, savedScale.value * e.scale));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });

  const pan2 = Gesture.Pan()
    .minPointers(2)
    .maxPointers(2)
    .onUpdate((e) => {
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const zoomStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const handleTap = (nxPct: number, nyPct: number) => {
    onTapField?.(nxPct, nyPct);
  };

  const tap = Gesture.Tap().onEnd((e) => {
    const w = wShared.value;
    const h = hShared.value;
    if (w <= 0 || h <= 0) return;
    const nx = Math.max(0, Math.min(100, (e.x / w) * 100));
    const ny = Math.max(0, Math.min(100, (e.y / h) * 100));
    runOnJS(handleTap)(nx, ny);
  });

  const centerCircleStyle =
    measure.w > 0
      ? {
          width: measure.w * 0.28,
          height: measure.w * 0.28,
          marginLeft: -(measure.w * 0.14),
          marginTop: -(measure.w * 0.14),
          borderRadius: measure.w * 0.14,
        }
      : null;

  const pitch = (
    <View style={[styles.field, style]} onLayout={onLayout}>
      <View style={styles.midLine} />
      <View style={[styles.centerCircle, centerCircleStyle]} />
      <View style={[styles.penaltyBox, styles.topPenaltyBox]} />
      <View style={[styles.sixYardBox, styles.topSixYard]} />
      <View style={[styles.goal, styles.topGoal]} />
      <View style={[styles.penaltyBox, styles.bottomPenaltyBox]} />
      <View style={[styles.sixYardBox, styles.bottomSixYard]} />
      <View style={[styles.goal, styles.bottomGoal]} />
      {children}
    </View>
  );

  const withTap = onTapField ? <GestureDetector gesture={tap}>{pitch}</GestureDetector> : pitch;

  const content = zoomable ? (
    <GestureDetector gesture={Gesture.Simultaneous(pinch, pan2)}>
      <Animated.View style={zoomStyle}>{withTap}</Animated.View>
    </GestureDetector>
  ) : (
    withTap
  );

  return (
    <FieldMeasureContext.Provider value={measure}>
      <FieldMeasureSharedContext.Provider value={{ w: wShared, h: hShared }}>
        {content}
      </FieldMeasureSharedContext.Provider>
    </FieldMeasureContext.Provider>
  );
}

const styles = StyleSheet.create({
  field: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1b7f3b',
    borderRadius: 12,
    borderWidth: 3,
    borderColor: '#0d5f2b',
    overflow: 'hidden',
  },
  midLine: { position: 'absolute', left: 0, right: 0, top: '50%', height: 2, backgroundColor: LINE },
  centerCircle: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    borderWidth: 2,
    borderColor: LINE,
  },
  penaltyBox: { position: 'absolute', width: '60%', height: '18%', left: '20%', borderColor: LINE, borderWidth: 2 },
  sixYardBox: { position: 'absolute', width: '36%', height: '6%', left: '32%', borderColor: LINE, borderWidth: 2 },
  goal: { position: 'absolute', width: '16%', height: 4, left: '42%', backgroundColor: LINE },
  topPenaltyBox: { top: '4%' },
  topSixYard: { top: '4%' },
  topGoal: { top: '1.2%' },
  bottomPenaltyBox: { bottom: '4%' },
  bottomSixYard: { bottom: '4%' },
  bottomGoal: { bottom: '1.2%' },
});
