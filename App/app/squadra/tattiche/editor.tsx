// app/squadra/tattiche/editor.tsx
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import ViewShot, { captureRef, type ViewShotRef } from 'react-native-view-shot';
import AddTray, { type TrayItem } from '../../components/tactical/AddTray';
import DraggableToken from '../../components/tactical/DraggableToken';
import Field, { type FieldMeasure } from '../../components/tactical/Field';
import { Ball, Jersey } from '../../components/tactical/Jersey';
import { DEFAULT_SWAP_THRESHOLD_PX, resolveDropTarget } from '../../components/tactical/dropTarget';
import { loadTactics, saveTactic, type TacticElement } from '../../data/tactics';

const DISC_SIZE = { w: 38, h: 38 };
const TRAY_DISC_SIZE = { w: 30, h: 30 };
const BALL_SIZE = 22;
const TRAY_BALL_SIZE = 24;

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export default function TacticsEditor() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEditing = !!id;

  const [title, setTitle] = useState('');
  const [elements, setElements] = useState<TacticElement[]>([]);
  const [showNameModal, setShowNameModal] = useState(false);
  const [fieldSize, setFieldSize] = useState<FieldMeasure>({ w: 0, h: 0 });
  const [zoomResetKey, setZoomResetKey] = useState(0);
  const fieldRef = useRef<View>(null);

  const shotRef = useRef<ViewShotRef>(null);

  // carica se editing
  useEffect(() => {
    (async () => {
      if (!isEditing) return;
      const list = await loadTactics();
      const found = list.find(t => t.id === id);
      if (found) {
        setTitle(found.name);
        setElements(found.elements);
        setZoomResetKey((k) => k + 1);
      }
    })();
  }, [id, isEditing]);

  const trayItems: TrayItem[] = [
    { key: 'home', node: <Jersey variant="home" size={TRAY_DISC_SIZE} /> },
    { key: 'away', node: <Jersey variant="away" size={TRAY_DISC_SIZE} /> },
    { key: 'ball', node: <Ball size={TRAY_BALL_SIZE} /> },
  ];

  const handleDropOnField = (itemKey: string, nx: number, ny: number) => {
    if (itemKey === 'ball') {
      if (elements.some(e => e.type === 'BALL')) {
        Alert.alert('Pallone già presente', 'C’è già un pallone: spostalo dove preferisci.');
        return;
      }
      setElements(prev => [...prev, { id: uid(), type: 'BALL', x: nx, y: ny }]);
      return;
    }
    const type = itemKey === 'home' ? 'HOME' : 'AWAY';
    const numbers = elements.filter(e => e.type === type).map(e => e.number ?? 0);
    let next = 1; while (numbers.includes(next) && next <= 99) next++;
    setElements(prev => [...prev, { id: uid(), type, x: nx, y: ny, number: next }]);
  };

  const confirmReset = () => {
    Alert.alert(
      'Ripulire il campo?',
      'Questa azione rimuove tutti i giocatori e il pallone.',
      [
        { text: 'Annulla', style: 'cancel' },
        { text: 'Conferma', style: 'destructive', onPress: () => { setElements([]); setZoomResetKey((k) => k + 1); } },
      ]
    );
  };

  // Trascinare una maglia sopra un'altra le scambia di posizione (il pallone resta escluso, si
  // sposta normalmente — non ha senso "scambiarlo" con una maglia). Trascinare fuori dal campo la
  // rimuove — vedi DraggableToken's `onRemove`.
  const handleMove = (key: string, nx: number, ny: number) => {
    setElements(prev => {
      const moving = prev.find(e => e.id === key);
      const w = fieldSize.w;
      const h = fieldSize.h;
      if (!moving || moving.type === 'BALL' || w <= 0 || h <= 0) {
        return prev.map(e => (e.id === key ? { ...e, x: nx, y: ny } : e));
      }
      const droppedPx = { x: (nx / 100) * w, y: (ny / 100) * h };
      const siblings = prev
        .filter(e => e.id !== key && e.type !== 'BALL')
        .map(e => ({ key: e.id, xPx: (e.x / 100) * w, yPx: (e.y / 100) * h }));
      const swapWith = resolveDropTarget(droppedPx.x, droppedPx.y, siblings, key, DEFAULT_SWAP_THRESHOLD_PX);
      if (swapWith) {
        const a = moving;
        const b = prev.find(e => e.id === swapWith)!;
        return prev.map(e => {
          if (e.id === key) return { ...e, x: b.x, y: b.y };
          if (e.id === swapWith) return { ...e, x: a.x, y: a.y };
          return e;
        });
      }
      return prev.map(e => (e.id === key ? { ...e, x: nx, y: ny } : e));
    });
  };

  const removeAt = (key: string) => {
    setElements(prev => prev.filter(e => e.id !== key));
  };

  /* -------------------- salva con conferma + preview -------------------- */
  const doSave = async () => {
    // azzera lo zoom prima dello scatto, altrimenti la preview salvata rifletterebbe l'inquadratura
    // zoomata del momento invece dello schema completo
    setZoomResetKey((k) => k + 1);
    await new Promise((resolve) => setTimeout(resolve, 50));

    let previewBase64: string | undefined;
    try {
      if (shotRef.current) {
        previewBase64 = await captureRef(shotRef.current, {
          result: 'base64',
          format: 'png',
          quality: 0.6,
          width: Math.min(700, fieldSize.w || 700),
        });
      }
    } catch {
      // ignora eventuali errori preview
    }

    const tacticId = isEditing ? id! : uid();
    await saveTactic({ id: tacticId, name: title.trim(), elements }, previewBase64);
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

      {/* CAMPO */}
      <View style={styles.fieldWrap}>
        <View collapsable={false} style={styles.fieldShotOuter}>
          <ViewShot ref={shotRef} style={styles.fieldShot}>
            <Field ref={fieldRef} zoomable resetKey={zoomResetKey} onMeasure={setFieldSize}>
              {elements.map((el) => {
                const isBall = el.type === 'BALL';
                const size = isBall ? { w: BALL_SIZE, h: BALL_SIZE } : DISC_SIZE;
                const child = isBall ? (
                  <Ball size={BALL_SIZE} />
                ) : (
                  <Jersey variant={el.type === 'HOME' ? 'home' : 'away'} number={el.number} size={DISC_SIZE} />
                );
                return (
                  <DraggableToken key={el.id} tokenKey={el.id} xPct={el.x} yPct={el.y} size={size} onMove={handleMove} onRemove={removeAt}>
                    {child}
                  </DraggableToken>
                );
              })}
            </Field>
          </ViewShot>
        </View>
      </View>

      {/* VASSOIO (sotto il campo — deve essere reso dopo, per disegnare sopra quando il "fantasma"
          esce dal proprio riquadro durante il trascinamento) + Reset */}
      <View style={styles.bottomBar}>
        <AddTray
          items={trayItems}
          fieldRef={fieldRef}
          onDrop={handleDropOnField}
          style={styles.trayInline}
          hint="Trascina sul campo per aggiungere — trascina un elemento del campo fuori per rimuoverlo."
        />
        <Pressable style={styles.resetBtn} onPress={confirmReset}>
          <Text style={styles.resetBtnText}>♻️ Reset</Text>
        </Pressable>
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
                style={[styles.btn, { backgroundColor: '#1b7f3b', flex: 1 }]}
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
    </View>
  );
}

/* ------------------------------- STILI ------------------------------- */

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

  // Campo
  fieldWrap: { flex: 1, padding: 10 },
  fieldShotOuter: { flex: 1 },
  fieldShot: { flex: 1, width: '100%' },

  // Vassoio + reset (sotto il campo)
  bottomBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    paddingHorizontal: 12, paddingVertical: 10,
    borderTopWidth: 1, borderColor: '#eef2f7', backgroundColor: '#fafafa',
  },
  trayInline: { flex: 1 },
  resetBtn: {
    borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14,
    backgroundColor: '#f3f4f6',
  },
  resetBtnText: { fontWeight: '800', color: '#111' },

  // Modal nome
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modalBox: { width: '92%', maxWidth: 520, backgroundColor: '#fff', borderRadius: 12, padding: 16 },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 10 },
  modalInput: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 10, backgroundColor: '#fff', marginBottom: 10 },
  btn: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8 },
  btnText: { color: 'white', fontWeight: '800', textAlign: 'center' },
});
