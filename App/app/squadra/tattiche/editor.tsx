// app/squadra/tattiche/editor.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Dimensions, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import ViewShot, { captureRef, type ViewShotRef } from 'react-native-view-shot';

// === Tipi ===
type TacticElementType = 'HOME' | 'AWAY' | 'BALL';
type TacticElement = { id: string; type: TacticElementType; x: number; y: number; number?: number };
type TacticItem = { id: string; name: string; preview?: string; elements: TacticElement[] };

const TACTICS_KEY = 'tactics/custom';

// === Misure schermo/campo ===
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
// Campo alto 80% dell'altezza schermo, a piena larghezza
const FIELD_W = SCREEN_W; // piena larghezza
const FIELD_H = Math.max(Math.round(SCREEN_H * 0.8), 420);

const SHIRT_W = 54;
const SHIRT_H = 36;
const BALL_SIZE = 22;

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

/* ---- Render elementi ---- */
function HomeShirt({ number }: { number?: number }) {
  return (
    <View style={styles.fieldShirtBody}>
      {[0,1,2,3,4].map(i => (
        <View key={i} style={{ flex:1, backgroundColor: i%2===0 ? '#ffffff' : '#3b82f6' }} />
      ))}
      <View style={[styles.fieldSleeve, { left: -10 }]} />
      <View style={[styles.fieldSleeve, { right: -10 }]} />
      <Text style={styles.fieldShirtNum}>{number ?? ''}</Text>
    </View>
  );
}
function AwayShirt({ number }: { number?: number }) {
  return (
    <View style={[styles.fieldShirtBody, { borderColor: 'rgba(0,0,0,0.2)' }]}> 
      {[0,1,2,3,4].map(i => (
        <View key={i} style={{ flex:1, backgroundColor: i%2===0 ? '#ef4444' : '#b91c1c' }} />
      ))}
      <View style={[styles.fieldSleeve, { left: -10, backgroundColor: '#ef4444' }]} />
      <View style={[styles.fieldSleeve, { right: -10, backgroundColor: '#ef4444' }]} />
      <Text style={[styles.fieldShirtNum, { color: '#fff' }]}>{number ?? ''}</Text>
    </View>
  );
}
function Ball() {
  return (
    <View style={styles.ball}>
      <Text style={{ fontWeight: '900' }}>⚽</Text>
    </View>
  );
}

/* ---- Draggable generico ---- */
function Draggable({
  idx, xPct, yPct, onMove, children,
}: { idx: number; xPct: number; yPct: number; onMove: (i:number, nx:number, ny:number)=>void; children: React.ReactNode }) {
  const isBall = (children as any)?.type?.name === 'Ball';
  const wrapW = isBall ? BALL_SIZE : SHIRT_W;
  const wrapH = isBall ? BALL_SIZE : SHIRT_H;

  const x = useSharedValue((xPct / 100) * FIELD_W - wrapW / 2);
  const y = useSharedValue((yPct / 100) * FIELD_H - wrapH / 2);

  const pan = Gesture.Pan()
    .onChange((e) => { 
      // SOLO animazioni/UI thread qui
      x.value += e.changeX; 
      y.value += e.changeY; 
    })
    .onEnd(() => {
      // Calcolo percentuali nuove e rimando a JS in sicurezza
      const nx = Math.max(0, Math.min(100, ((x.value + wrapW / 2) / FIELD_W) * 100));
      const ny = Math.max(0, Math.min(100, ((y.value + wrapH / 2) / FIELD_H) * 100));
      runOnJS(onMove)(idx, nx, ny);
    });

  const style = useAnimatedStyle(() => ({
    position: 'absolute',
    left: withSpring(x.value, { damping: 18, stiffness: 220 }),
    top: withSpring(y.value, { damping: 18, stiffness: 220 }),
    width: wrapW,
    height: wrapH,
    alignItems: 'center',
    justifyContent: 'center',
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={style}>{children}</Animated.View>
    </GestureDetector>
  );
}

export default function TacticsEditor() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEditing = !!id;

  const [title, setTitle] = useState('');
  const [elements, setElements] = useState<TacticElement[]>([]);
  const [showNameModal, setShowNameModal] = useState(false);

  const shotRef = useRef<ViewShotRef>(null);

  // carica se editing
  useEffect(() => {
    (async () => {
      if (!isEditing) return;
      const raw = await AsyncStorage.getItem(TACTICS_KEY);
      const list: TacticItem[] = raw ? JSON.parse(raw) : [];
      const found = list.find(t => t.id === id);
      if (found) {
        setTitle(found.name);
        setElements(found.elements);
      }
    })();
  }, [id, isEditing]);

  const addHome = () => {
    const numbers = elements.filter(e => e.type === 'HOME').map(e => e.number ?? 0);
    let next = 1; while (numbers.includes(next) && next <= 99) next++;
    setElements(prev => [...prev, { id: uid(), type: 'HOME', x: 50, y: 80, number: next }]);
  };
  const addAway = () => {
    const numbers = elements.filter(e => e.type === 'AWAY').map(e => e.number ?? 0);
    let next = 1; while (numbers.includes(next) && next <= 99) next++;
    setElements(prev => [...prev, { id: uid(), type: 'AWAY', x: 50, y: 20, number: next }]);
  };
  const addBall = () => {
    if (elements.some(e => e.type === 'BALL')) {
      Alert.alert('Pallone già presente', 'C’è già un pallone: spostalo dove preferisci.');
      return;
    }
    setElements(prev => [...prev, { id: uid(), type: 'BALL', x: 50, y: 50 }]);
  };

  const confirmReset = () => {
  Alert.alert(
    'Ripulire il campo?',
    'Questa azione rimuove tutti i giocatori e il pallone.',
    [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Conferma', style: 'destructive', onPress: () => setElements([]) },
    ]
  );
};

  const handleMove = (idx: number, nx: number, ny: number) => {
    setElements(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], x: nx, y: ny };
      return next;
    });
  };

  const removeAt = (idx: number) => {
    setElements(prev => prev.filter((_, i) => i !== idx));
  };

  /* -------------------- salva con conferma + preview -------------------- */
  const doSave = async () => {
    // genera preview del campo (base64)
    let previewBase64: string | undefined;
    try {
      if (shotRef.current) {
        previewBase64 = await captureRef(shotRef.current, {
          result: 'base64',
          format: 'png',
          quality: 0.6,
          width: Math.min(700, FIELD_W),
        });
      }
    } catch {
      // ignora eventuali errori preview
    }

    const raw = await AsyncStorage.getItem(TACTICS_KEY);
    const list: TacticItem[] = raw ? JSON.parse(raw) : [];

    if (isEditing) {
      const idx = list.findIndex(t => t.id === id);
      if (idx >= 0) {
        list[idx] = {
          ...list[idx],
          name: title.trim(),
          elements,
          preview: previewBase64 ?? list[idx].preview,
        };
      }
    } else {
      list.push({ id: uid(), name: title.trim(), elements, preview: previewBase64 });
    }

    await AsyncStorage.setItem(TACTICS_KEY, JSON.stringify(list));
    router.replace('/squadra/tattiche' as Href);
  };

  const requestSave = () => {
    if (!title.trim()) { setShowNameModal(true); return; }
    Alert.alert(
      isEditing ? 'Aggiornare questa tattica?' : 'Salvare nuova tattica?',
      '',
      [
        { text: 'Annulla', style: 'cancel' },
        { text: 'Conferma', style: 'destructive', onPress: doSave },
      ],
      { cancelable: true }
    );
  };

  /* --------------------------- UI -------------------------- */
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>
        {/* TOOLBAR SUPERIORE */}
        <View style={styles.topBar}>
          <Pressable style={styles.iconBtn} onPress={() => router.back()} accessibilityLabel="Indietro">
            <Text style={styles.iconTxt}>←</Text>
          </Pressable>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Nome tattica"
            style={styles.topInput}
            placeholderTextColor="#9ca3af"
          />
          <Pressable style={[styles.iconBtn, styles.saveBtn]} onPress={requestSave} accessibilityLabel="Salva tattica">
            <Text style={[styles.iconTxt, { color: 'white' }]}>💾</Text>
          </Pressable>
        </View>

        {/* TOOLBAR SECONDARIA (3 bottoni) */}
        <View style={styles.toolsBar}>
          <Pressable style={[styles.toolBtn, { backgroundColor: '#e0ecff', borderColor: '#93c5fd' }]} onPress={addHome}>
            <Text style={styles.toolTxt}>👕 Nostro</Text>
          </Pressable>
          <Pressable style={[styles.toolBtn, { backgroundColor: '#ffe2e2', borderColor: '#fca5a5' }]} onPress={addAway}>
            <Text style={styles.toolTxt}>👕 Avversario</Text>
          </Pressable>
          <Pressable style={[styles.toolBtn, { backgroundColor: '#fffceb', borderColor: '#fde68a' }]} onPress={addBall}>
            <Text style={styles.toolTxt}>⚽ Pallone</Text>
          </Pressable>
          <Pressable
            style={[styles.toolBtn, { backgroundColor: '#f3f4f6', borderColor: '#d1d5db' }]}
            onPress={confirmReset}
          >
            <Text style={styles.toolTxt}>♻️ Reset</Text>
          </Pressable>
        </View>

        {/* CAMPO (80% schermo) */}
        <View style={styles.fieldWrap}>
          {/* wrapper per poter usare collapsable senza errori di tipi */}
          <View collapsable={false}>
            <ViewShot ref={shotRef} style={[styles.fieldShot, { height: FIELD_H, width: FIELD_W }] }>
              <View style={[styles.field, { width: FIELD_W, height: FIELD_H }]}>
                {/* linee campo */}
                <View style={styles.midLine} />
                <View style={styles.centerCircle} />
                {/* aree & porte */}
                <View style={[styles.penaltyBox, styles.topPenaltyBox]} />
                <View style={[styles.sixYardBox, styles.topSixYard]} />
                <View style={[styles.goal, styles.topGoal]} />
                <View style={[styles.penaltyBox, styles.bottomPenaltyBox]} />
                <View style={[styles.sixYardBox, styles.bottomSixYard]} />
                <View style={[styles.goal, styles.bottomGoal]} />

                {elements.map((el, i) => {
                  const child =
                    el.type === 'HOME' ? <HomeShirt number={el.number} /> :
                    el.type === 'AWAY' ? <AwayShirt number={el.number} /> :
                    <Ball />;

                  const wrapW = el.type === 'BALL' ? BALL_SIZE : SHIRT_W;
                  const wrapH = el.type === 'BALL' ? BALL_SIZE : SHIRT_H;

                  return (
                    <Draggable key={el.id} idx={i} xPct={el.x} yPct={el.y} onMove={handleMove}>
                      <Pressable
                        style={{ width: wrapW, height: wrapH, alignItems: 'center', justifyContent: 'center' }}
                        onLongPress={() => removeAt(i)}
                      >
                        {child}
                      </Pressable>
                    </Draggable>
                  );
                })}
              </View>
            </ViewShot>
          </View>
        </View>
      </View>

      {/* Modal nome (se manca) */}
      <Modal visible={showNameModal} transparent animationType="fade" onRequestClose={() => setShowNameModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Nome tattica</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Es. Pressing alto 4-3-3"
              style={styles.modalInput}
            />
            <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              style={[styles.btn, { backgroundColor: '#9ca3af', flex: 1 }]}
              onPress={() => setShowNameModal(false)}
            >
              <Text style={styles.btnText}>Annulla</Text>
            </Pressable>

            <Pressable
              style={[styles.btn, { backgroundColor: '#1b7f3b', flex: 1 }]} // ← tolta la ) in più qui
              onPress={() => {
                if (!title.trim()) { Alert.alert('Inserisci un nome valido'); return; }
                setShowNameModal(false);
                setTimeout(requestSave, 0);
              }}
            >
              <Text style={styles.btnText}>Continua</Text>
            </Pressable>
          </View>
        </View>
         </View>
      </Modal>
    </GestureHandlerRootView>
  );
}

/* ------------------------------- STILI ------------------------------- */

const LINE = 'rgba(255,255,255,0.7)';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },

  // Toolbar superiore
  topBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 10, paddingVertical: 8,
    borderBottomWidth: 1, borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  iconBtn: {
    width: 40, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#f8fafc',
  },
  iconTxt: { fontSize: 18, fontWeight: '800', color: '#111' },
  saveBtn: { backgroundColor: '#1b7f3b', borderColor: '#1b7f3b' },
  topInput: {
    flex: 1,
    height: 38,
    borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8,
    paddingHorizontal: 10,
    fontWeight: '700',
    backgroundColor: '#fff',
  },

  // Toolbar secondaria
  toolsBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: 8, paddingHorizontal: 10, paddingVertical: 8,
    borderBottomWidth: 1, borderColor: '#eef2f7', backgroundColor: '#fafafa',
  },
  toolBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
    borderWidth: 1,
  },
  toolTxt: { fontWeight: '800', color: '#111' },

  // Campo
  fieldWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 10 },
  fieldShot: { width: '100%' },
  field: {
    backgroundColor: '#1b7f3b',
    borderRadius: 12, borderWidth: 3, borderColor: '#0d5f2b', overflow: 'hidden',
  },
  midLine: { position: 'absolute', left: 0, right: 0, top: '50%', height: 2, backgroundColor: LINE },
  centerCircle: {
    position: 'absolute', top: '50%', left: '50%', width: 120, height: 120,
    marginLeft: -60, marginTop: -60, borderWidth: 2, borderColor: LINE, borderRadius: 60,
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

  // Elementi di campo
  fieldShirtBody: {
    width: SHIRT_W, height: SHIRT_H, flexDirection: 'row',
    borderTopLeftRadius: 12, borderTopRightRadius: 12, borderBottomLeftRadius: 10, borderBottomRightRadius: 10,
    overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(0,0,0,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  fieldSleeve: { position: 'absolute', top: 6, width: 18, height: 18, borderRadius: 5, backgroundColor: '#3b82f6' },
  fieldShirtNum: { position: 'absolute', color: '#111', fontWeight: '900', fontSize: 12 },

  ball: {
    width: BALL_SIZE, height: BALL_SIZE, borderRadius: BALL_SIZE/2,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#111',
  },

  // Modal nome
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modalBox: { width: '92%', maxWidth: 520, backgroundColor: '#fff', borderRadius: 12, padding: 16 },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 10 },
  modalInput: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 10, backgroundColor: '#fff', marginBottom: 10 },
  btn: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8 },
  btnText: { color: 'white', fontWeight: '800', textAlign: 'center' },
});
