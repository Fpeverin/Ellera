// app/moduli/editor.tsx
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import TeamLogo from '../components/TeamLogo';
import { loadModules, saveModule } from '../data/modules';
import { MODULES as DEFAULT_MODULES, type FieldSlot } from '../utils/modules-layout';

const { width: SW, height: SH } = Dimensions.get('window');
const FIELD_W = Math.round(SW * 0.7);
const FIELD_H = Math.max(Math.round(SH * 0.8), 520);

const SHIRT_W = 54;
const SHIRT_H = 36;

function Draggable({
  idx, editable, xPct, yPct, onMove, children,
}: {
  idx: number;
  editable: boolean;
  xPct: number;
  yPct: number;
  onMove: (i: number, nx: number, ny: number) => void;
  children: React.ReactNode;
}) {
  const x = useSharedValue((xPct / 100) * FIELD_W - SHIRT_W / 2);
  const y = useSharedValue((yPct / 100) * FIELD_H - SHIRT_H / 2);

  const pan = Gesture.Pan()
    .onChange(e => {
      if (!editable) return;
      x.value += e.changeX;
      y.value += e.changeY;
    })
    .onEnd(() => {
      if (!editable) return;
      const nx = Math.max(0, Math.min(100, ((x.value + SHIRT_W / 2) / FIELD_W) * 100));
      const ny = Math.max(0, Math.min(100, ((y.value + SHIRT_H / 2) / FIELD_H) * 100));
      onMove(idx, nx, ny);
    });

  const style = useAnimatedStyle(() => ({
    position: 'absolute',
    left: withSpring(x.value, { damping: 18, stiffness: 220 }),
    top: withSpring(y.value, { damping: 18, stiffness: 220 }),
    width: SHIRT_W,
    height: SHIRT_H,
    alignItems: 'center',
    justifyContent: 'center',
  }));

  return (
    <GestureDetector gesture={editable ? pan : Gesture.Tap()}>
      <Animated.View style={style}>{children}</Animated.View>
    </GestureDetector>
  );
}

export default function ModuleEditor() {
  const router = useRouter();
  const { name, readonly } = useLocalSearchParams<{ name?: string; readonly?: string }>();
  const isEditing = !!name;
  const isReadOnly = readonly === '1';

  // 11 slot “logici” (se available[i] === true lo slot i non è visibile in campo)
  const [slots, setSlots] = useState<FieldSlot[]>([]);
  const [available, setAvailable] = useState<boolean[]>(Array(11).fill(true));
  const [placingIndex, setPlacingIndex] = useState<number | null>(null);
  const [title, setTitle] = useState<string>(name ?? '');

  const [showConfirmReset, setShowConfirmReset] = useState(false);
  const [showConfirmSave, setShowConfirmSave] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);

  const fieldRef = useRef<View>(null);

  useEffect(() => {
    (async () => {
      // default (readonly)
      if (isEditing && DEFAULT_MODULES[name!]) {
        setSlots(DEFAULT_MODULES[name!]);
        setAvailable(Array(11).fill(false));
        return;
      }
      // custom esistente
      const list = await loadModules();
      const found = isEditing ? list.find(m => m.name === name) : undefined;
      if (found) {
        setSlots(found.slots);
        setAvailable(Array(11).fill(false));
        setTitle(found.name);
        return;
      }
      // nuovo
      const base: FieldSlot[] = Array.from({ length: 11 }, (_, i) => ({
        id: `P${i + 1}`,
        x: 50,
        y: 50,
      }));
      setSlots(base);
      setAvailable(Array(11).fill(true));
      setTitle('');
    })();
  }, [name, isEditing]);

  const jerseyIndices = useMemo(() => Array.from({ length: 11 }, (_, i) => i), []);
  const allPlaced = useMemo(() => available.every(v => !v), [available]);

  const handlePlaceOnField = (evt: any) => {
    if (placingIndex === null || isReadOnly) return;
    if (!available[placingIndex]) { setPlacingIndex(null); return; }
    const { locationX, locationY } = evt.nativeEvent;
    const nx = Math.max(0, Math.min(100, (locationX / FIELD_W) * 100));
    const ny = Math.max(0, Math.min(100, (locationY / FIELD_H) * 100));

    setSlots(prev => {
      const next = [...prev];
      const id = next[placingIndex].id;
      next[placingIndex] = { id, x: nx, y: ny };
      return next;
    });
    setAvailable(prev => {
      const n = [...prev];
      n[placingIndex] = false;
      return n;
    });
    setPlacingIndex(null);
  };

  const handleMove = (idx: number, nx: number, ny: number) => {
    if (isReadOnly) return;
    setSlots(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], x: nx, y: ny };
      return next;
    });
  };

  const ShirtOnField = ({ index }: { index: number }) => (
    <View style={styles.fieldShirtBody}>
      {[0, 1, 2, 3, 4].map(i => (
        <View key={i} style={{ flex: 1, backgroundColor: i % 2 === 0 ? '#ffffff' : '#3b82f6' }} />
      ))}
      <View style={[styles.fieldSleeve, { left: -10 }]} />
      <View style={[styles.fieldSleeve, { right: -10 }]} />
      <Text style={styles.fieldShirtNum}>{index + 1}</Text>
    </View>
  );

  // --- RESET: apre modale, conferma esegue ---
  const requestReset = () => {
    setShowConfirmReset(true);
  };
  const actuallyReset = () => {
    setAvailable(Array(11).fill(true));
    setSlots(prev => prev.map(s => ({ ...s, x: 50, y: 50 })));
    setPlacingIndex(null);
    setShowConfirmReset(false);
  };

  // --- SALVA core ---
  const saveCore = async (finalName: string) => {
    await saveModule({ name: finalName, slots });
  };

  // --- SALVA: apre modale nome se manca, altrimenti modale conferma ---
  const requestSave = () => {
    if (!allPlaced) return; // bottone già disabilitato, niente popup
    if (!title.trim()) {
      setShowNameModal(true);
      return;
    }
    setShowConfirmSave(true);
  };

  const actuallySave = async () => {
    const key = title.trim();
    if (!key) { setShowConfirmSave(false); setShowNameModal(true); return; }
    await saveCore(key);
    setShowConfirmSave(false);
    router.replace('/moduli' as Href);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={styles.container}>
          {/* SINISTRA - Campo */}
          <View style={styles.leftCol}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TeamLogo size={24} style={{ marginRight: 6 }} />
              <Text style={styles.title}>
                {isEditing ? (title || 'Modifica Modulo') : 'Nuovo Modulo'}
                {isReadOnly ? ' (solo lettura)' : ''}
              </Text>
            </View>

            <View
              ref={fieldRef}
              style={styles.field}
              onStartShouldSetResponder={() => true}
              onResponderRelease={handlePlaceOnField}
            >
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

              {slots.map((s, i) =>
                available[i] ? null : (
                  <Draggable
                    key={s.id}
                    idx={i}
                    editable={!isReadOnly}
                    xPct={s.x}
                    yPct={s.y}
                    onMove={handleMove}
                  >
                    <ShirtOnField index={i} />
                  </Draggable>
                )
              )}
            </View>

            {!isReadOnly && (
              <>
                <Text style={styles.counterText}>Maglie piazzate: {11 - available.filter(Boolean).length}/11</Text>
                <View style={styles.bottomBar}>
                  <Pressable style={[styles.btn, { backgroundColor: '#d46f00' }]} onPress={requestReset}>
                    <Text style={styles.btnText}>Reset</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.btn, { backgroundColor: allPlaced ? '#1b7f3b' : '#9ca3af' }]}
                    disabled={!allPlaced}
                    onPress={requestSave}
                  >
                    <Text style={styles.btnText}>{isEditing ? 'Aggiorna' : 'Salva'}</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>

          {/* DESTRA - Pannello */}
          <View style={styles.rightCol}>
            {!isReadOnly && (
              <>
                <Text style={styles.panelTitle}>Nome modulo</Text>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Es. 4-4-1-1 stretta"
                  style={styles.input}
                />
                <Text style={[styles.panelTitle, { marginTop: 8 }]}>Maglie disponibili</Text>
                <View style={styles.jerseysWrap}>
                  {jerseyIndices.map(i =>
                    available[i] ? (
                      <Pressable
                        key={i}
                        style={[styles.shirtBtn, placingIndex === i && styles.shirtBtnActive]}
                        onPress={() => setPlacingIndex(i)}
                      >
                        <View style={styles.shirtMini}>
                          {[0, 1, 2, 3, 4].map(k => (
                            <View key={k} style={{ flex: 1, backgroundColor: k % 2 === 0 ? '#fff' : '#3b82f6' }} />
                          ))}
                        </View>
                        <Text style={styles.shirtNumMini}>{i + 1}</Text>
                      </Pressable>
                    ) : null
                  )}
                </View>
                <Text style={styles.helpText}>Tocca una maglia, poi tocca il campo per posizionarla. Trascina per regolare.</Text>
              </>
            )}
            {isReadOnly && <Text style={{ color: '#6b7280' }}>Modulo predefinito in sola lettura.</Text>}
          </View>
        </View>

        {/* --- MODALI --- */}

        {/* Modale: conferma reset */}
        <Modal
          visible={showConfirmReset}
          transparent
          animationType="fade"
          onRequestClose={() => setShowConfirmReset(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>Ripulire il campo?</Text>
              <Text style={{ color: '#374151', marginTop: 6 }}>
                Questa azione rimuove tutte le maglie dal campo.
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                <Pressable style={[styles.btn, { backgroundColor: '#9ca3af', flex: 1 }]} onPress={() => setShowConfirmReset(false)}>
                  <Text style={styles.btnText}>Annulla</Text>
                </Pressable>
                <Pressable style={[styles.btn, { backgroundColor: '#b91c1c', flex: 1 }]} onPress={actuallyReset}>
                  <Text style={styles.btnText}>Conferma</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {/* Modale: nome mancante */}
        <Modal
          visible={showNameModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowNameModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>Nome modulo</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Es. 4-4-2 a rombo"
                style={styles.input}
              />
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                <Pressable style={[styles.btn, { backgroundColor: '#9ca3af', flex: 1 }]} onPress={() => setShowNameModal(false)}>
                  <Text style={styles.btnText}>Annulla</Text>
                </Pressable>
                <Pressable
                  style={[styles.btn, { backgroundColor: '#1b7f3b', flex: 1 }]}
                  onPress={() => {
                    if (!title.trim()) return;
                    setShowNameModal(false);
                    setTimeout(() => setShowConfirmSave(true), 0);
                  }}
                >
                  <Text style={styles.btnText}>Continua</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {/* Modale: conferma salvataggio/aggiornamento */}
        <Modal
          visible={showConfirmSave}
          transparent
          animationType="fade"
          onRequestClose={() => setShowConfirmSave(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>{isEditing ? 'Confermi aggiornamento?' : 'Confermi salvataggio?'}</Text>
              <Text style={{ color: '#374151', marginTop: 6 }}>"{title.trim()}"</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                <Pressable style={[styles.btn, { backgroundColor: '#9ca3af', flex: 1 }]} onPress={() => setShowConfirmSave(false)}>
                  <Text style={styles.btnText}>Annulla</Text>
                </Pressable>
                <Pressable
                  style={[styles.btn, { backgroundColor: '#1b7f3b', flex: 1 }]}
                  onPress={actuallySave}
                >
                  <Text style={styles.btnText}>Conferma</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </GestureHandlerRootView>
    </SafeAreaView>
  );
}

const LINE = 'rgba(255,255,255,0.7)';

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f7fa' },
  container: { flex: 1, flexDirection: 'row', backgroundColor: '#f5f7fa' },
  leftCol: { flex: 7, padding: 12 },
  rightCol: { flex: 3, padding: 12, borderLeftWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff' },
  title: { fontSize: 20, fontWeight: '800', marginBottom: 8 },

  field: {
    width: '100%', height: FIELD_H, backgroundColor: '#1b7f3b',
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

  fieldShirtBody: {
    width: SHIRT_W, height: SHIRT_H, flexDirection: 'row',
    borderTopLeftRadius: 12, borderTopRightRadius: 12,
    borderBottomLeftRadius: 10, borderBottomRightRadius: 10,
    overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(0,0,0,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  fieldSleeve: { position: 'absolute', top: 6, width: 18, height: 18, borderRadius: 5, backgroundColor: '#3b82f6' },
  fieldShirtNum: { position: 'absolute', color: '#111', fontWeight: '900', fontSize: 12 },

  bottomBar: { flexDirection: 'row', gap: 10, marginTop: 10 },
  btn: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8 },
  btnText: { color: 'white', fontWeight: '800', textAlign: 'center' },
  counterText: { marginTop: 8, color: '#374151', fontWeight: '700' },

  panelTitle: { fontSize: 16, fontWeight: '800', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 10, backgroundColor: '#fff' },
  helpText: { color: '#4b5563', fontStyle: 'italic', marginTop: 6 },

  jerseysWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  shirtBtn: {
    width: '47%', borderRadius: 10, backgroundColor: '#eef2ff',
    borderWidth: 1, borderColor: '#c7d2fe', paddingVertical: 10, alignItems: 'center',
  },
  shirtBtnActive: { borderColor: '#1b7f3b', backgroundColor: '#e6ffe9' },
  shirtMini: { width: 44, height: 28, borderRadius: 8, overflow: 'hidden', flexDirection: 'row', marginBottom: 4 },
  shirtNumMini: { fontWeight: '900', color: '#0f172a' },

  // Modali
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modalBox: { width: '90%', maxWidth: 520, backgroundColor: '#fff', borderRadius: 12, padding: 16 },
  modalTitle: { fontSize: 18, fontWeight: '800' },
});
