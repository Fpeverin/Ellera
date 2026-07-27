// app/eventi/partita/[id]/formazione.tsx
import { Picker } from '@react-native-picker/picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useRef, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  loadLineup as loadLineupRemote,
  loadPositions as loadPositionsRemote,
  saveLineup as saveLineupRemote,
  savePositions as savePositionsRemote,
  type PosOverride,
  type SavedLineup,
} from '../../../data/matchLive';
import { loadModules, type CustomModule } from '../../../data/modules';
import { usePlayers } from '../../../hooks/usePlayers';
import { MODULES as DEFAULT_MODULES } from '../../../utils/modules-layout';

type Player = { id: string; name: string; role?: string; number?: number };

const SHIRT_W = 46;
const SHIRT_H = 30;
const MAX_CONVOCATI = 20;

type PickTarget =
  | { kind: 'FIELD'; index: number }
  | { kind: 'BENCH'; index: number };

// helper per mostrare solo il cognome
const surnameOf = (full: string) => (full || '').trim().split(/\s+/)[0];

// Draggable shirt (LIVE only)
function Draggable({
  idx, xPct, yPct, onMove, children,
}: { idx: number; xPct: number; yPct: number; onMove: (i:number, nx:number, ny:number)=>void; children: React.ReactNode }) {
  const x = useSharedValue(0);
  const y = useSharedValue(0);

  const pan = Gesture.Pan()
    .onChange((e) => { x.value += e.changeX; y.value += e.changeY; })
    .onEnd(() => {
      onMove(idx, x.value, y.value);
      x.value = 0; y.value = 0;
    });

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: withSpring(x.value, { damping: 18, stiffness: 220 }) }, { translateY: withSpring(y.value, { damping: 18, stiffness: 220 }) }],
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={style}>{children}</Animated.View>
    </GestureDetector>
  );
}

// Piccola maglia bianco-azzurra (strisce) con numero
function BlueWhiteShirt({ empty, number }: { empty?: boolean; number?: number }) {
  return (
    <View style={[styles.shirtBody, empty && styles.shirtEmpty]}>
      <View style={styles.shirtStripes}>
        {[0,1,2,3,4].map(i => (
          <View
            key={i}
            style={{ flex:1, backgroundColor: i%2===0 ? '#ffffff' : '#60a5fa' }}
          />
        ))}
      </View>
      {number ? <Text style={styles.shirtNum}>{number}</Text> : null}
    </View>
  );
}

export default function Schieramento() {
  const { id: matchId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { players: basePlayers } = usePlayers();
  const params = useLocalSearchParams();
  const liveMode = (params as any)?.live === '1';

  const [modules, setModules] = useState<CustomModule[]>([]);
  const [selectedModuleName, setSelectedModuleName] = useState<string | null>(null);

  const [fieldSize, setFieldSize] = useState({ w: 0, h: 0 });

  const [convocatiOpen, setConvocatiOpen] = useState(false);
  const [convocatiIds, setConvocatiIds] = useState<Set<string>>(new Set());

  const [fieldAssignments, setFieldAssignments] = useState<(Player | null)[]>([]);
  const [benchAssignments, setBenchAssignments] = useState<Player[]>([]);

  const [pickModalOpen, setPickModalOpen] = useState(false);
  const [pickTarget, setPickTarget] = useState<PickTarget | null>(null);

  const [numberModalOpen, setNumberModalOpen] = useState(false);
  const [numberTarget, setNumberTarget] = useState<PickTarget | null>(null);
  const [numberValue, setNumberValue] = useState<string>('');

  const [posOverrides, setPosOverrides] = useState<PosOverride[]>([]);
  const loadedRef = useRef(false);

  // --- carica moduli (default + custom) ---
  React.useEffect(() => {
    (async () => {
      try {
        const defaultArray: CustomModule[] = Object.entries(DEFAULT_MODULES || {}).map(
          ([name, slots]) => ({ name, slots })
        );
        const customList = await loadModules();
        const combined = [...defaultArray, ...customList];
        setModules(combined);
        if (!selectedModuleName && combined.length > 0) {
          setSelectedModuleName(combined[0].name);
        }
      } catch {
        const fallback: CustomModule[] = Object.entries(DEFAULT_MODULES || {}).map(
          ([name, slots]) => ({ name, slots })
        );
        setModules(fallback);
        if (!selectedModuleName && fallback.length > 0) {
          setSelectedModuleName(fallback[0].name);
        }
      }
    })();
  }, []);

  // --- slots dal modulo selezionato ---
  const fieldSlots = useMemo(() => {
    const mod = modules.find(m => m.name === selectedModuleName);
    if (!mod) return [];
    return mod.slots
      .slice()
      .sort((a, b) => a.y - b.y || a.x - b.x)
      .map(s => ({ x: s.x, y: s.y }));
  }, [modules, selectedModuleName]);

  // --- carica lineup salvata ---
  React.useEffect(() => {
    (async () => {
      if (!matchId) return;
      try {
        const saved = await loadLineupRemote(matchId);
        if (saved) {
          if (saved.moduleName) setSelectedModuleName(saved.moduleName);
          setConvocatiIds(new Set(saved.convocati));

          const numbersMap: Record<string, number> = saved.numbers || {};
          const idToPlayer = new Map(basePlayers.map(p => [p.id, p]));

          const fieldById = (saved.field || []).map(pid => {
            if (!pid) return null;
            const base = idToPlayer.get(pid);
            if (!base) return null;
            const n = numbersMap[pid];
            return n ? { ...base, number: n } : base;
          });

          const benchById = (saved.bench || [])
            .map(pid => {
              const base = idToPlayer.get(pid);
              if (!base) return null;
              const n = numbersMap[pid];
              return n ? { ...base, number: n } : base;
            })
            .filter(Boolean) as Player[];

          setFieldAssignments(fieldById);
          setBenchAssignments(benchById);
        }
        setPosOverrides(await loadPositionsRemote(matchId));
      } catch {
      } finally {
        loadedRef.current = true;
      }
    })();
  }, [matchId]);

  // --- allinea lunghezze ---
  React.useEffect(() => {
    setFieldAssignments(prev => {
      const need = fieldSlots.length;
      const out = prev.slice(0, need);
      while (out.length < need) out.push(null);
      return out;
    });
    setPosOverrides(prev => {
      const need = fieldSlots.length;
      const out = prev.slice(0, need);
      while (out.length < need) out.push(null);
      return out;
    });
  }, [fieldSlots.length]);

  // --- disponibili ---
  const availablePlayers = useMemo(() => {
    const inUseIds = new Set<string>();
    fieldAssignments.forEach(p => p && inUseIds.add(p.id));
    benchAssignments.forEach(p => inUseIds.add(p.id));
    const arr = basePlayers
      .filter(p => convocatiIds.has(p.id) && !inUseIds.has(p.id))
      .sort((a, b) => a.name.localeCompare(b.name));
    const seen = new Set<string>();
    return arr.filter(p => {
      if (seen.has(p.name)) return false;
      seen.add(p.name);
      return true;
    });
  }, [basePlayers, convocatiIds, fieldAssignments, benchAssignments]);

  // --- lista completa per convocati ---
  const uniquePlayers = useMemo(() => {
    const seen = new Set<string>();
    const out: Player[] = [];
    for (const p of basePlayers.slice().sort((a, b) => a.name.localeCompare(b.name))) {
      if (!seen.has(p.name)) {
        seen.add(p.name);
        out.push(p);
      }
    }
    return out;
  }, [basePlayers]);

  // --- helpers convocati ---
  const toggleConvocato = (id: string) => {
    setConvocatiIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= MAX_CONVOCATI) return next;
        next.add(id);
      }
      return next;
    });
  };

  const openPickerForField = (index: number) => {
    if (liveMode) return;
    setPickTarget({ kind: 'FIELD', index });
    setPickModalOpen(true);
  };
  const openPickerForBench = (index: number) => {
    if (liveMode) return;
    setPickTarget({ kind: 'BENCH', index });
    setPickModalOpen(true);
  };

  const openNumberForField = (index: number) => {
    const current = fieldAssignments[index];
    if (!current) return;
    setNumberTarget({ kind: 'FIELD', index });
    setNumberValue(current.number ? String(current.number) : '');
    setNumberModalOpen(true);
  };
  const openNumberForBench = (index: number) => {
    const current = benchAssignments[index];
    if (!current) return;
    setNumberTarget({ kind: 'BENCH', index });
    setNumberValue(current.number ? String(current.number) : '');
    setNumberModalOpen(true);
  };

  const assignToTarget = (p: Player) => {
    if (!pickTarget) return;
    if (pickTarget.kind === 'FIELD') {
      setFieldAssignments(prev => {
        const next = [...prev];
        next[pickTarget.index] = p;
        return next;
      });
      setTimeout(() => openNumberForField(pickTarget.index), 0);
    } else {
      setBenchAssignments(prev => {
        const next = [...prev];
        while (next.length < 9) next.push(undefined as unknown as Player);
        next[pickTarget.index] = p;
        return next.filter(Boolean) as Player[];
      });
      setTimeout(() => openNumberForBench(pickTarget.index), 0);
    }
    setPickModalOpen(false);
    setPickTarget(null);
  };

  const removeFromField = (i: number) => {
    if (liveMode) return;
    setFieldAssignments(prev => {
      const next = [...prev];
      next[i] = null;
      return next;
    });
  };

  const removeFromBench = (i: number) => {
    if (liveMode) return;
    setBenchAssignments(prev => prev.filter((_, idx) => idx !== i));
  };

  const toPx = (x: number, y: number) => ({
    left: fieldSize.w ? (x / 100) * fieldSize.w - SHIRT_W / 2 : 0,
    top: fieldSize.h ? (y / 100) * fieldSize.h - SHIRT_H / 2 : 0,
  });

  // --- salvataggi lineup + posizioni ---
  React.useEffect(() => {
    if (!loadedRef.current || !matchId) return;
    (async () => {
      try {
        // costruisci mappa id->numero
        const numbers: Record<string, number> = {};
        for (const p of fieldAssignments) {
          if (p?.number) numbers[p.id] = p.number;
        }
        for (const p of benchAssignments) {
          if (p?.number) numbers[p.id] = p.number;
        }

        const payload: SavedLineup = {
          moduleName: selectedModuleName ?? null,
          convocati: Array.from(convocatiIds),
          field: fieldAssignments.map(p => p?.id ?? null),
          bench: benchAssignments.map(p => p.id),
          numbers, // <-- SALVO I NUMERI
        };
        await saveLineupRemote(matchId, payload);
      } catch {}
    })();
  }, [matchId, selectedModuleName, convocatiIds, fieldAssignments, benchAssignments]);

  React.useEffect(() => {
    if (!loadedRef.current || !matchId) return;
    if (!liveMode) return;
    (async () => {
      try {
        await savePositionsRemote(matchId, posOverrides);
      } catch {}
    })();
  }, [posOverrides, matchId, liveMode]);

  // ==== Calcolo etichette nomi ====
  const nameLabels = useMemo(() => {
    const items = fieldSlots.map((s, i) => {
      const posPct = posOverrides[i] ?? { x: s.x, y: s.y };
      const px = toPx(posPct.x, posPct.y);
      return {
        i,
        name: fieldAssignments[i]?.name ?? '',
        left: px.left,
        top: px.top,
      };
    });
    const placed: { i: number; xCenter: number; top: number }[] = [];
    const BASE_OFFSET = 16;
    const MIN_V_SPACING = 16;
    const H_NEAR = 44;
    return items.map(it => {
      const xCenter = it.left + SHIRT_W / 2;
      let top = it.top - BASE_OFFSET;
      for (const prev of placed) {
        if (Math.abs(prev.xCenter - xCenter) < H_NEAR && Math.abs(prev.top - top) < MIN_V_SPACING) {
          top = prev.top - MIN_V_SPACING;
        }
      }
      placed.push({ i: it.i, xCenter, top });
      return { index: it.i, name: it.name, xCenter, top };
    });
  }, [fieldSlots, posOverrides, fieldAssignments, fieldSize]);

  // --- UI ---
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* SAFE AREA: evita sovrapposizione con notch mantenendo lo sfondo coerente */}
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.wrap}>
          {/* SINISTRA */}
          <View style={styles.left}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={styles.sectionTitle}>Modulo</Text>
              {liveMode ? <Text style={{ color: '#b45309', fontWeight: '800' }}>LIVE: solo drag posizioni</Text> : null}
            </View>
            <View style={[styles.moduleSelectRow, liveMode && { opacity: 0.6 }]}>
              <Picker
                enabled={!liveMode}
                selectedValue={selectedModuleName ?? undefined}
                onValueChange={(val) => setSelectedModuleName(val)}
                style={styles.modulePicker}
              >
                {modules.map(m => (
                  <Picker.Item key={m.name} label={m.name} value={m.name} />
                ))}
              </Picker>
            </View>

            {/* Campo */}
            <View
              style={styles.field}
              onLayout={e => {
                const { width, height } = e.nativeEvent.layout;
                setFieldSize({ w: width, h: height });
              }}
            >
              {/* linee campo */}
              <View style={styles.midLine} />
              <View style={styles.centerCircle} />
              <View style={[styles.penaltyBox, styles.topPenaltyBox]} />
              <View style={[styles.sixYardBox, styles.topSixYard]} />
              <View style={[styles.goal, styles.topGoal]} />
              <View style={[styles.penaltyBox, styles.bottomPenaltyBox]} />
              <View style={[styles.sixYardBox, styles.bottomSixYard]} />
              <View style={[styles.goal, styles.bottomGoal]} />

              {/* Maglie */}
              {fieldSlots.map((s, i) => {
                const posPct = posOverrides[i] ?? { x: s.x, y: s.y };
                const pos = toPx(posPct.x, posPct.y);
                const assigned = fieldAssignments[i];
                const shirt = (
                  <Pressable
                    style={{}}
                    onPress={() => {
                      if (assigned) {
                        openNumberForField(i);
                      } else {
                        openPickerForField(i);
                      }
                    }}
                    onLongPress={() => assigned && removeFromField(i)}
                  >
                    <BlueWhiteShirt empty={!assigned} number={assigned?.number} />
                  </Pressable>
                );
                if (liveMode) {
                  return (
                    <View key={i} style={[styles.shirtWrap, { left: pos.left, top: pos.top }]}>
                      <Draggable
                        idx={i}
                        xPct={posPct.x}
                        yPct={posPct.y}
                        onMove={(idx, dx, dy) => {
                          const currentLeft = (posPct.x / 100) * fieldSize.w - SHIRT_W / 2;
                          const currentTop = (posPct.y / 100) * fieldSize.h - SHIRT_H / 2;
                          const newCenterX = currentLeft + dx + SHIRT_W / 2;
                          const newCenterY = currentTop + dy + SHIRT_H / 2;
                          const nx = Math.max(0, Math.min(100, (newCenterX / Math.max(1, fieldSize.w)) * 100));
                          const ny = Math.max(0, Math.min(100, (newCenterY / Math.max(1, fieldSize.h)) * 100));
                          setPosOverrides(prev => {
                            const next = [...prev];
                            next[idx] = { x: nx, y: ny };
                            return next;
                          });
                        }}
                      >
                        {shirt}
                      </Draggable>
                    </View>
                  );
                }
                return (
                  <View key={i} style={[styles.shirtWrap, { left: pos.left, top: pos.top }]}>
                    {shirt}
                  </View>
                );
              })}

              {/* Etichette sopra maglie */}
              {nameLabels.map(lbl => {
                const assigned = fieldAssignments[lbl.index];
                if (!assigned) return null;
                return (
                  <View
                    key={`name-${lbl.index}`}
                    style={[
                      styles.nameTag,
                      {
                        left: lbl.xCenter,
                        top: Math.max(4, lbl.top),
                        transform: [{ translateX: -0.5 * (SHIRT_W) }],
                      },
                    ]}
                    pointerEvents="none"
                  >
                    <Text style={styles.nameText}>{surnameOf(assigned.name)}</Text>
                  </View>
                );
              })}
            </View>

            {/* Panchina */}
            <Text style={styles.sectionTitle}>Panchina (max 9)</Text>
            <View style={[styles.bench, liveMode && { opacity: 0.7 }]}>
              {Array.from({ length: 9 }, (_, i) => {
                const p = benchAssignments[i];
                return (
                  <Pressable
                    key={i}
                    disabled={liveMode}
                    style={[styles.benchItem, !p && styles.benchEmpty]}
                    onPress={() => {
                      if (liveMode) return;
                      if (p) {
                        openNumberForBench(i);
                      } else {
                        openPickerForBench(i);
                      }
                    }}
                    onLongPress={() => p && removeFromBench(i)}
                  >
                    <Text style={{ fontWeight: '700', flex: 1 }}>
                      {p ? surnameOf(p.name) : '—'}{p?.number ? `  (n° ${p.number})` : ''}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* DESTRA */}
          <View style={styles.right}>
            <Pressable disabled={liveMode} style={[styles.convBtn, liveMode && { opacity: 0.6 }]} onPress={() => setConvocatiOpen(true)}>
              <Text style={styles.convBtnText}>CONVOCATI</Text>
            </Pressable>
            <Text style={[styles.sectionTitle, { marginTop: 8 }]}>Disponibili</Text>
            <FlatList
              data={availablePlayers}
              keyExtractor={(it) => it.id}
              contentContainerStyle={{ gap: 8, paddingBottom: 16 }}
              renderItem={({ item }) => (
                <Pressable
                  disabled={liveMode}
                  style={[styles.avRow, liveMode && { opacity: 0.5 }]}
                  onPress={() => {
                    if (liveMode) return;
                    if (pickTarget) {
                      assignToTarget(item);
                    } else {
                      const firstFreeIdx = fieldAssignments.findIndex(v => !v);
                      if (firstFreeIdx >= 0) {
                        setFieldAssignments(prev => {
                          const next = [...prev];
                          next[firstFreeIdx] = item;
                          return next;
                        });
                        setTimeout(() => openNumberForField(firstFreeIdx), 0);
                      } else if (benchAssignments.length < 9) {
                        const newIndex = benchAssignments.length;
                        setBenchAssignments(prev => [...prev, item]);
                        setTimeout(() => openNumberForBench(newIndex), 0);
                      }
                    }
                  }}
                >
                  <Text style={{ fontWeight: '700', flex: 1 }}>{surnameOf(item.name)}</Text>
                </Pressable>
              )}
              ListEmptyComponent={<Text style={{ color: '#64748b' }}>Nessun giocatore disponibile</Text>}
            />
          </View>

          {/* MODALE CONVOCATI */}
          <Modal visible={convocatiOpen} transparent animationType="slide" onRequestClose={() => setConvocatiOpen(false)}>
            <View style={styles.modalOverlay}>
              <View style={styles.modalCardSm}>
                <Text style={styles.modalTitle}>
                  Seleziona convocati ({convocatiIds.size}/{MAX_CONVOCATI})
                </Text>
                <FlatList
                  data={uniquePlayers}
                  keyExtractor={(p) => p.id}
                  renderItem={({ item }) => {
                    const checked = convocatiIds.has(item.id);
                    const atLimit = convocatiIds.size >= MAX_CONVOCATI;
                    const disabled = (atLimit && !checked) || liveMode;
                    return (
                      <Pressable
                        style={[styles.ckRow, disabled && { opacity: 0.5 }]}
                        onPress={() => !disabled && toggleConvocato(item.id)}
                      >
                        <View style={[styles.ckBox, checked && styles.ckBoxOn]}>
                          {checked ? <Text style={{ color: 'white' }}>✓</Text> : null}
                        </View>
                        <Text style={{ flex: 1 }}>{surnameOf(item.name)}</Text>
                      </Pressable>
                    );
                  }}
                />
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  <Pressable style={[styles.btn, { backgroundColor: '#9ca3af', flex: 1 }]} onPress={() => setConvocatiOpen(false)}>
                    <Text style={styles.btnText}>Chiudi</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.btn, { backgroundColor: '#1b7f3b', flex: 1, opacity: liveMode ? 0.6 : 1 }]}
                    disabled={liveMode}
                    onPress={() => {
                      setConvocatiOpen(false);
                      setFieldAssignments(prev => prev.map(p => (p && !convocatiIds.has(p.id) ? null : p)));
                      setBenchAssignments(prev => prev.filter(p => convocatiIds.has(p.id)));
                    }}
                  >
                    <Text style={styles.btnText}>Conferma</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </Modal>

          {/* MODALE PICKER */}
          <Modal visible={pickModalOpen} transparent animationType="fade" onRequestClose={() => { setPickModalOpen(false); setPickTarget(null); }}>
            <View style={styles.modalOverlay}>
              <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>
                  {pickTarget?.kind === 'FIELD' ? 'Scegli giocatore per lo slot' : 'Scegli giocatore per la panchina'}
                </Text>
                <FlatList
                  data={availablePlayers}
                  keyExtractor={(p) => p.id}
                  ListEmptyComponent={
                    <Text style={{ color: '#64748b' }}>
                      Nessun giocatore disponibile. Aggiungi convocati o libera uno slot.
                    </Text>
                  }
                  renderItem={({ item }) => (
                    <Pressable style={styles.avRow} onPress={() => assignToTarget(item)}>
                      <Text style={{ fontWeight: '700', flex: 1 }}>{surnameOf(item.name)}</Text>
                    </Pressable>
                  )}
                />
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  <Pressable style={[styles.btn, { backgroundColor: '#9ca3af', flex: 1 }]} onPress={() => { setPickModalOpen(false); setPickTarget(null); }}>
                    <Text style={styles.btnText}>Chiudi</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </Modal>

          {/* MODALE NUMERO */}
          <Modal visible={numberModalOpen} transparent animationType="fade" onRequestClose={() => setNumberModalOpen(false)}>
            <View style={styles.modalOverlay}>
              <View style={styles.modalCardNumber}>
                <Text style={styles.modalTitle}>Numero calciatore</Text>
                <TextInput
                  value={numberValue}
                  onChangeText={(t) => {
                    const onlyDigits = t.replace(/[^0-9]/g, '');
                    setNumberValue(onlyDigits.slice(0, 2));
                  }}
                  placeholder="Es. 10"
                  keyboardType="number-pad"
                  style={styles.inputNumber}
                  maxLength={2}
                />
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  <Pressable style={[styles.btn, { backgroundColor: '#9ca3af', flex: 1 }]} onPress={() => setNumberModalOpen(false)}>
                    <Text style={styles.btnText}>Annulla</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.btn, { backgroundColor: '#1b7f3b', flex: 1 }]}
                    onPress={() => {
                      const n = parseInt(numberValue, 10);
                      if (isNaN(n) || n < 1 || n > 99 || !numberTarget) {
                        setNumberModalOpen(false);
                        return;
                      }
                      if (numberTarget.kind === 'FIELD') {
                        setFieldAssignments(prev => {
                          const next = [...prev];
                          const p = next[numberTarget.index];
                          if (p) next[numberTarget.index] = { ...p, number: n };
                          return next;
                        });
                      } else {
                        setBenchAssignments(prev => {
                          const next = [...prev];
                          const p = next[numberTarget.index];
                          if (p) next[numberTarget.index] = { ...p, number: n };
                          return next;
                        });
                      }
                      setNumberModalOpen(false);
                    }}
                  >
                    <Text style={styles.btnText}>Salva</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </Modal>
        </View>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

/* --------------------- STILI --------------------- */
const LINE = 'rgba(255,255,255,0.7)';
const styles = StyleSheet.create({
  // SafeArea con stesso background della pagina, così il notch rispetta il design
  safeArea: { flex: 1, backgroundColor: '#f5f7fa' },

  wrap: { flex: 1, flexDirection: 'row', backgroundColor: '#f5f7fa' },
  left: { flex: 7, padding: 12, gap: 8 },
  right: { flex: 3, padding: 12, borderLeftWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff' },

  sectionTitle: { fontSize: 16, fontWeight: '800' },

  moduleSelectRow: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, backgroundColor: '#fff' },
  modulePicker: { width: '100%' },

  field: {
    flex: 1,
    backgroundColor: '#1b7f3b',
    borderRadius: 12, borderWidth: 3, borderColor: '#0d5f2b',
    overflow: 'hidden', marginTop: 6,
  },
  midLine: { position: 'absolute', left: 0, right: 0, top: '50%', height: 2, backgroundColor: LINE },
  centerCircle: {
    position: 'absolute', top: '50%', left: '50%', width: 110, height: 110,
    marginLeft: -55, marginTop: -55, borderWidth: 2, borderColor: LINE, borderRadius: 55,
  },
  penaltyBox: { position: 'absolute', width: '60%', height: '18%', left: '20%', borderColor: LINE, borderWidth: 2 },
  sixYardBox: { position: 'absolute', width: '36%', height: '6%', left: '32%', borderColor: LINE, borderWidth: 2 },
  goal: { position: 'absolute', width: '16%', height: 4, left: '42%', backgroundColor: LINE },
  topPenaltyBox: { top: '4%' }, topSixYard: { top: '4%' }, topGoal: { top: '1.2%' },
  bottomPenaltyBox: { bottom: '4%' }, bottomSixYard: { bottom: '4%' }, bottomGoal: { bottom: '1.2%' },

  shirtWrap: { position: 'absolute' },

  shirtBody: {
    width: SHIRT_W, height: SHIRT_H, borderRadius: 10,
    backgroundColor: '#ffffff',
    borderWidth: 2, borderColor: 'rgba(0,0,0,0.15)',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  shirtStripes: { position: 'absolute', inset: 0, flexDirection: 'row' },
  shirtEmpty: { opacity: 0.45 },
  shirtNum: { position: 'absolute', fontWeight: '900', color: '#111', fontSize: 12 },

  nameTag: {
    position: 'absolute',
    minWidth: 20,
    maxWidth: 160,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.08)',
  },
  nameText: { fontSize: 11, fontWeight: '800', color: '#111' },

  bench: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12,
    padding: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 8, minHeight: 60,
  },
  benchItem: {
    width: '31%', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10,
    backgroundColor: '#f8fafc', padding: 8, flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  benchEmpty: { backgroundColor: '#f1f5f9', borderStyle: 'dashed' },

  convBtn: { backgroundColor: '#1b7f3b', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  convBtnText: { color: 'white', fontWeight: '900' },

  avRow: {
    padding: 10, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10,
    backgroundColor: '#f8fafc', flexDirection: 'row', alignItems: 'center',
  },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },

  modalCard: { width: '92%', maxHeight: '92%', backgroundColor: '#fff', borderRadius: 12, padding: 14 },
  modalCardSm: { width: '86%', maxHeight: '70%', backgroundColor: '#fff', borderRadius: 12, padding: 14 },
  modalCardNumber: { width: 320, maxWidth: '86%', backgroundColor: '#fff', borderRadius: 12, padding: 14 },

  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 10 },
  ckRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 10, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, backgroundColor: '#f9fafb',
  },
  ckBox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#cbd5e1',
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff',
  },
  ckBoxOn: { backgroundColor: '#1b7f3b', borderColor: '#1b7f3b' },

  btn: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, alignItems: 'center' },
  btnText: { color: 'white', fontWeight: '800' },

  inputNumber: {
    borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8,
    paddingVertical: 8, paddingHorizontal: 10, backgroundColor: '#fff', fontSize: 16, fontWeight: '800', textAlign: 'center',
  },
});
