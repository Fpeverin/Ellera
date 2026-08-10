// app/components/tactical/DraggableToken.tsx
//
// Token trascinabile condiviso — sostituisce i 3 "Draggable" locali di Moduli/Tattiche/Formazione,
// ciascuno leggermente diverso (uno mancava di runOnJS, un altro usava una shared value assoluta
// inizializzata solo al primo render).
//
// Wrapper ESTERNO (Animated.View, ma guidato direttamente da xPct/yPct/misura del campo — non da una
// shared value "posseduta"): la sua posizione è sempre calcolata dal valore vero e attuale dei prop,
// quindi un cambio esterno (swap-on-drop, layout automatico) si riflette da solo, con una piccola
// animazione di assestamento — nessuna shared value da risincronizzare, nessuna classe di bug.
// Wrapper INTERNO (Animated.View): segue il dito 1:1 durante il drag (translateX/Y relativo,
// azzerato a fine gesto, dopo aver comunicato la nuova posizione), e anima anche la comparsa/
// scomparsa del token (usata da Moduli/Tattiche squadra quando un token viene aggiunto dal vassoio o
// trascinato fuori dal campo per eliminarlo — vedi `onRemove`).
import React, { useEffect } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useFieldMeasure, useFieldMeasureShared } from './Field';

/** Margine di tolleranza (in percentuale) prima che un drag fuori dal campo conti come "rimuovi" —
 * evita che un piazzamento legittimo vicino al bordo (es. un portiere sulla linea di porta) venga
 * scambiato per un tentativo di rimozione. */
const OUT_OF_BOUNDS_MARGIN = 4;

export default function DraggableToken({
  tokenKey,
  xPct,
  yPct,
  size,
  editable = true,
  onMove,
  onRemove,
  style,
  children,
}: {
  /** Identificativo stabile del token (l'id dello slot/elemento/giocatore) — non un indice di array. */
  tokenKey: string;
  xPct: number;
  yPct: number;
  size: { w: number; h: number };
  editable?: boolean;
  onMove: (key: string, nxPct: number, nyPct: number) => void;
  /** Se presente, trascinare il token fuori dai margini del campo lo rimuove invece di bloccarlo al
   * bordo — usato da Moduli/Tattiche squadra per tornare il token al vassoio. */
  onRemove?: (key: string) => void;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const { w: fieldW, h: fieldH } = useFieldMeasure();
  const { w: fieldWShared, h: fieldHShared } = useFieldMeasureShared();
  const dx = useSharedValue(0);
  const dy = useSharedValue(0);
  const presence = useSharedValue(0);

  useEffect(() => {
    presence.value = withTiming(1, { duration: 180 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const commitMove = (nxPct: number, nyPct: number) => onMove(tokenKey, nxPct, nyPct);
  const commitRemove = () => {
    presence.value = withTiming(0, { duration: 150 });
    setTimeout(() => onRemove?.(tokenKey), 150);
  };

  const pan = Gesture.Pan()
    .onChange((e) => {
      dx.value += e.changeX;
      dy.value += e.changeY;
    })
    .onEnd(() => {
      const w = fieldWShared.value;
      const h = fieldHShared.value;
      if (w > 0 && h > 0) {
        const curX = (xPct / 100) * w;
        const curY = (yPct / 100) * h;
        const rawNx = ((curX + dx.value) / w) * 100;
        const rawNy = ((curY + dy.value) / h) * 100;
        const outOfBounds =
          rawNx < -OUT_OF_BOUNDS_MARGIN ||
          rawNx > 100 + OUT_OF_BOUNDS_MARGIN ||
          rawNy < -OUT_OF_BOUNDS_MARGIN ||
          rawNy > 100 + OUT_OF_BOUNDS_MARGIN;
        if (outOfBounds && onRemove) {
          runOnJS(commitRemove)();
        } else {
          const nx = Math.max(0, Math.min(100, rawNx));
          const ny = Math.max(0, Math.min(100, rawNy));
          runOnJS(commitMove)(nx, ny);
        }
      }
      dx.value = 0;
      dy.value = 0;
    });

  const outerStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    left: withSpring((xPct / 100) * fieldW - size.w / 2, { damping: 18, stiffness: 220 }),
    top: withSpring((yPct / 100) * fieldH - size.h / 2, { damping: 18, stiffness: 220 }),
    width: size.w,
    height: size.h,
  }));

  const innerStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: dx.value },
      { translateY: dy.value },
      { scale: 0.3 + 0.7 * presence.value },
    ],
    opacity: presence.value,
    width: size.w,
    height: size.h,
    alignItems: 'center',
    justifyContent: 'center',
  }));

  const gesture = editable ? pan : Gesture.Tap();

  return (
    <Animated.View style={[outerStyle, style]}>
      <GestureDetector gesture={gesture}>
        <Animated.View style={innerStyle}>{children}</Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}
