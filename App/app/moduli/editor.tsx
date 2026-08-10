// app/moduli/editor.tsx
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DraggableToken from '../components/tactical/DraggableToken';
import Field from '../components/tactical/Field';
import { Jersey } from '../components/tactical/Jersey';
import { DEFAULT_SWAP_THRESHOLD_PX, resolveDropTarget } from '../components/tactical/dropTarget';
import TeamLogo from '../components/TeamLogo';
import { loadModules, saveModule } from '../data/modules';
import { MODULES as DEFAULT_MODULES, type FieldSlot } from '../utils/modules-layout';

const SHIRT_SIZE = { w: 54, h: 36 };

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
  const [fieldSize, setFieldSize] = useState({ w: 0, h: 0 });
  const [zoomResetKey, setZoomResetKey] = useState(0);

  const [showConfirmReset, setShowConfirmReset] = useState(false);
  const [showConfirmSave, setShowConfirmSave] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);

  useEffect(() => {
    (async () => {
      // default (readonly)
      if (isEditing && DEFAULT_MODULES[name!]) {
        setSlots(DEFAULT_MODULES[name!]);
        setAvailable(Array(11).fill(false));
        setZoomResetKey((k) => k + 1);
        return;
      }
      // custom esistente
      const list = await loadModules();
      const found = isEditing ? list.find(m => m.name === name) : undefined;
      if (found) {
        setSlots(found.slots);
        setAvailable(Array(11).fill(false));
        setTitle(found.name);
        setZoomResetKey((k) => k + 1);
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
      setZoomResetKey((k) => k + 1);
    })();
  }, [name, isEditing]);

  const jerseyIndices = useMemo(() => Array.from({ length: 11 }, (_, i) => i), []);
  const allPlaced = useMemo(() => available.every(v => !v), [available]);
  const slotIndexById = useMemo(() => {
    const map = new Map<string, number>();
    slots.forEach((s, i) => map.set(s.id, i));
    return map;
  }, [slots]);

  const handleTapField = (nx: number, ny: number) => {
    if (placingIndex === null || isReadOnly) return;
    if (!available[placingIndex]) { setPlacingIndex(null); return; }

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

  const handleMove = (key: string, nx: number, ny: number) => {
    if (isReadOnly) return;
    setSlots(prev => {
      const w = fieldSize.w;
      const h = fieldSize.h;
      if (w <= 0 || h <= 0) {
        return prev.map(s => (s.id === key ? { ...s, x: nx, y: ny } : s));
      }
      const droppedPx = { x: (nx / 100) * w, y: (ny / 100) * h };
      const siblings = prev
        .filter((s, i) => s.id !== key && !available[i])
        .map(s => ({ key: s.id, xPx: (s.x / 100) * w, yPx: (s.y / 100) * h }));
      const swapWith = resolveDropTarget(droppedPx.x, droppedPx.y, siblings, key, DEFAULT_SWAP_THRESHOLD_PX);
      if (swapWith) {
        const a = prev.find(s => s.id === key)!;
        const b = prev.find(s => s.id === swapWith)!;
        return prev.map(s => {
          if (s.id === key) return { ...s, x: b.x, y: b.y };
          if (s.id === swapWith) return { ...s, x: a.x, y: a.y };
          return s;
        });
      }
      return prev.map(s => (s.id === key ? { ...s, x: nx, y: ny } : s));
    });
  };

  // --- RESET: apre modale, conferma esegue ---
  const requestReset = () => {
    setShowConfirmReset(true);
  };
  const actuallyReset = () => {
    setAvailable(Array(11).fill(true));
    setSlots(prev => prev.map(s => ({ ...s, x: 50, y: 50 })));
    setPlacingIndex(null);
    setShowConfirmReset(false);
    setZoomResetKey((k) => k + 1);
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

          <View style={styles.fieldWrap}>
            <Field
              zoomable
              resetKey={zoomResetKey}
              onMeasure={setFieldSize}
              onTapField={isReadOnly ? undefined : handleTapField}
            >
              {slots.map((s, i) =>
                available[i] ? null : (
                  <DraggableToken
                    key={s.id}
                    tokenKey={s.id}
                    xPct={s.x}
                    yPct={s.y}
                    size={SHIRT_SIZE}
                    editable={!isReadOnly}
                    onMove={handleMove}
                  >
                    <Jersey variant="home" number={i + 1} size={SHIRT_SIZE} />
                  </DraggableToken>
                )
              )}
            </Field>
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
              <Text style={styles.helpText}>
                Tocca una maglia, poi tocca il campo per posizionarla. Trascina per regolare, o
                trascina una maglia sopra un'altra per scambiarle di posto. Pizzica con due dita per
                zoomare.
              </Text>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f7fa' },
  container: { flex: 1, flexDirection: 'row', backgroundColor: '#f5f7fa' },
  leftCol: { flex: 7, padding: 12 },
  rightCol: { flex: 3, padding: 12, borderLeftWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff' },
  title: { fontSize: 20, fontWeight: '800', marginBottom: 8 },

  fieldWrap: { flex: 1, minHeight: 400 },

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
