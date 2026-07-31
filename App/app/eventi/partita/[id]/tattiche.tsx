// app/eventi/partita/[id]/tattiche.tsx
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, FlatList, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import TeamLogo from '../../../components/TeamLogo';
import { useAuth } from '../../../context/AuthContext';
import { CalendarEvent, loadEvents, saveEvents } from '../../../data/events';
import {
  loadLineup as loadLineupRemote,
  loadLiveFormation as loadLiveFormationRemote,
  loadTacticsAssignments as loadTacticsAssignmentsRemote,
  saveTacticsAssignments as saveTacticsAssignmentsRemote,
  type AssignState,
} from '../../../data/matchLive';
import { loadTactics, type TacticItem } from '../../../data/tactics';
import { usePlayers } from '../../../hooks/usePlayers';

/* ------------------------- TYPES & CONSTANTS ------------------------- */

type LivePlayer = { id: string; name: string; inField: boolean };

/* ------------------------------ UI CONST ----------------------------- */

const SHIRT_W = 46;
const SHIRT_H = 30;
const BALL_SIZE = 22;

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const FIELD_H_MODAL = Math.max(520, Math.min(700, Math.round(SCREEN_H * 0.72)));
const IS_NARROW = SCREEN_W < 900; // telefoni / tablet piccoli
const LEGEND_MAX_W = Math.min(360, Math.round(SCREEN_W * 0.3)); // <= 30% (cap a 360)

/* ------------------------------- HELPERS ------------------------------ */

const surnameOf = (full: string) => {
  const parts = (full || '').trim().split(/\s+/);
  return parts[0] || (full || '').trim();
};

/* ------------------------------- SHIRTS ------------------------------- */

function BlueWhiteShirt({ empty, number }: { empty?: boolean; number?: number }) {
  return (
    <View style={[styles.shirtBody, empty && styles.shirtEmpty]}>
      <View style={styles.shirtStripes}>
        {[0,1,2,3,4].map(i => (
          <View key={i} style={{ flex:1, backgroundColor: i%2===0 ? '#ffffff' : '#60a5fa' }} />
        ))}
      </View>
      {/* Mostro il numero SOLO se è assegnato un giocatore */}
      {(!empty && number) ? <Text style={styles.shirtNum}>{number}</Text> : null}
    </View>
  );
}

function RedShirt({ number }: { number?: number }) {
  return (
    <View style={[styles.shirtBody, { borderColor: 'rgba(0,0,0,0.2)' }] }>
      <View style={styles.shirtStripes}>
        {[0,1,2,3,4].map(i => (
          <View key={i} style={{ flex:1, backgroundColor: i%2===0 ? '#ef4444' : '#b91c1c' }} />
        ))}
      </View>
      {number ? <Text style={[styles.shirtNum, { color: '#fff' }]}>{number}</Text> : null}
    </View>
  );
}

/* -------------------------------- VIEW -------------------------------- */

export default function TattichePartita() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { membership } = useAuth();
  const readOnly = membership?.role === 'giocatore';
  const { allPlayers } = usePlayers();

  const [event, setEvent] = useState<CalendarEvent | null>(null);
  const [assigned, setAssigned] = useState<string[]>([]);
  const [allTactics, setAllTactics] = useState<TacticItem[]>([]);
  const [modalOpen, setModalOpen] = useState(false);

  const [assignments, setAssignments] = useState<AssignState>({});
  const [assignModal, setAssignModal] = useState<{ open: boolean; tacticId?: string }>({ open: false });

  // LIVE: solo chi è in campo
  const [inCampoPlayers, setInCampoPlayers] = useState<{ id: string; name: string }[]>([]);
  const prevInCampoRef = useRef<string[]>([]);

  const [titolari, setTitolari] = useState<{ id: string; name: string }[]>([]);
  const [numbersMap, setNumbersMap] = useState<Record<string, number>>({}); // <--- numeri da "Formazione"

  const selectablePlayers = useMemo(
    () =>
      [...inCampoPlayers]
        .map(p => ({ ...p, number: numbersMap[p.id] }))
        .sort((a, b) => {
          // ordina prima per numero se disponibile, altrimenti per nome
          const an = a.number ?? 999;
          const bn = b.number ?? 999;
          return an !== bn ? an - bn : a.name.localeCompare(b.name);
        }),
    [inCampoPlayers, numbersMap]
  );

  /* -------------------- LOAD (on focus + light polling) ------------------- */

  const loadAll = useCallback(async () => {
    if (!id) return;

    // Evento
    const list: CalendarEvent[] = await loadEvents();
    const ev = list.find(e => e.id === id) ?? null;
    setEvent(ev);
    setAssigned(ev?.tacticsIds ?? []);

    // Tattiche
    setAllTactics(await loadTactics());

    // LIVE (solo inField)
    const liveArr = await loadLiveFormationRemote(id);
    const justInField = liveArr.filter(p => p.inField).map(p => ({ id: p.id, name: p.name }));
    setInCampoPlayers(justInField);

    // TITOLARI + NUMERI dalla lineup salvata
    const saved = await loadLineupRemote(id);
    const nums = saved?.numbers || {};
    setNumbersMap(nums);

    if (saved?.field?.length) {
      const idToName = new Map(allPlayers.map(p => [p.id, p.name]));
      const starters = (saved.field as (string | null)[])
        .filter(Boolean)
        .map(pid => ({ id: pid as string, name: idToName.get(pid as string) || 'Senza nome' }));
      setTitolari(starters);
    } else {
      setTitolari([]);
    }

    // Assegnazioni tattiche
    setAssignments(await loadTacticsAssignmentsRemote(id));
  }, [id, allPlayers]);

  useFocusEffect(
    useCallback(() => {
      loadAll();
      const t = setInterval(loadAll, 2000);
      return () => clearInterval(t);
    }, [loadAll])
  );

  /* --------- Rileva sostituzioni LIVE e propaga alle tattiche ------------- */
  useEffect(() => {
    if (!id) return;

    const prevIds = prevInCampoRef.current;
    const currIds = inCampoPlayers.map(p => p.id);

    const prevSet = new Set(prevIds);
    const currSet = new Set(currIds);

    const outs = prevIds.filter(x => !currSet.has(x));
    const ins = currIds.filter(x => !prevSet.has(x));

    prevInCampoRef.current = currIds;

    if (outs.length === 0 && ins.length === 0) return;

    setAssignments(prev => {
      const next = { ...(prev || {}) } as AssignState;
      let anyChange = false;

      const insPoolGlobal: string[] = [...ins];

      for (const tid of Object.keys(next)) {
        const map = { ...(next[tid] || {}) };

        const usedInThisTactic = new Set(
          Object.values(map).filter(Boolean) as string[]
        );

        let localChange = false;

        for (const elId of Object.keys(map)) {
          const currentPid = map[elId];
          if (!currentPid) continue;

          if (outs.includes(currentPid)) {
            const idx = insPoolGlobal.findIndex(p => !usedInThisTactic.has(p));
            if (idx >= 0) {
              const replacement = insPoolGlobal[idx];
              map[elId] = replacement;
              usedInThisTactic.add(replacement);
              insPoolGlobal.splice(idx, 1);
            } else {
              map[elId] = null;
            }
            localChange = true;
            anyChange = true;
          }
        }

        if (localChange) {
          next[tid] = map;
        }
      }

      if (anyChange) {
        saveTacticsAssignmentsRemote(id, next);
      }
      return next;
    });
  }, [inCampoPlayers, id]);

  /* ---------------------------- HELPERS / SAVE ---------------------------- */

  const assignedFull = useMemo(
    () => assigned.map(tid => allTactics.find(t => t.id === tid)).filter(Boolean) as TacticItem[],
    [assigned, allTactics]
  );

  const saveEventTactics = async (nextIds: string[]) => {
    if (!event) return;
    const list: CalendarEvent[] = await loadEvents();
    const updated = list.map(ev => ev.id === event.id ? { ...ev, tacticsIds: nextIds } : ev);
    await saveEvents(updated);
    setAssigned(nextIds);
  };

  const addTactic = (tid: string) => {
    if (assigned.includes(tid)) { setModalOpen(false); return; }
    const next = [...assigned, tid];
    saveEventTactics(next);
    setModalOpen(false);
  };

  const removeTactic = (tid: string) => {
    const next = assigned.filter(x => x !== tid);
    saveEventTactics(next);
    setAssignments(prev => {
      const n = { ...prev };
      delete n[tid];
      saveTacticsAssignmentsRemote(id!, n);
      return n;
    });
  };

  const openAssign = (tid: string) => setAssignModal({ open: true, tacticId: tid });
  const assignForTactic = (tid: string): Record<string, string | null> => assignments[tid] ?? {};
  const setAssign = (tid: string, elId: string, playerId: string | null) => {
    setAssignments(prev => {
      const next = { ...(prev || {}) };
      next[tid] = { ...(next[tid] || {}) };
      next[tid][elId] = playerId;
      saveTacticsAssignmentsRemote(id!, next);
      return next;
    });
  };

  const [pickerState, setPickerState] = useState<{ open: boolean; tacticId?: string; elementId?: string }>({ open: false });

  /* ---------------------------- RENDER ----------------------------------- */

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.container}>
        <View style={styles.topBar}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={styles.title}>Tattiche partita</Text>
            <TeamLogo size={24} />
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {!readOnly && (
              <Pressable style={[styles.btn, { backgroundColor: '#1b7f3b' }]} onPress={() => setModalOpen(true)}>
                <Text style={styles.btnText}>+ Aggiungi</Text>
              </Pressable>
            )}
            <Pressable style={[styles.btn, { backgroundColor: '#9ca3af' }]} onPress={() => useRouter().back()}>
              <Text style={styles.btnText}>Chiudi</Text>
            </Pressable>
          </View>
        </View>

        <FlatList
          data={assignedFull}
          keyExtractor={t => t.id}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListEmptyComponent={<Text style={{ color: '#6b7280' }}>Nessuna tattica assegnata</Text>}
          renderItem={({ item }) => {
            const currentAssign = assignForTactic(item.id);
            const assignedCount = Object.values(currentAssign).filter(Boolean).length;
            const homeSlots = item.elements.filter(e => e.type === 'HOME');
            return (
              <View style={styles.card}>
                <Pressable style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }} onPress={() => openAssign(item.id)}>
                  {item.preview ? (
                    <Image source={{ uri: item.preview }} style={styles.preview} />
                  ) : (
                    <View style={[styles.preview, styles.previewPlaceholder]}>
                      <Text style={{ color: '#6b7280', fontSize: 12 }}>Nessuna preview</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{item.name}</Text>
                    <Text style={styles.meta}>{assignedCount}/{homeSlots.length} giocatori assegnati</Text>
                  </View>
                </Pressable>
                {!readOnly && (
                  <Pressable style={styles.deleteBtn} onPress={() => removeTactic(item.id)}>
                    <Text style={{ fontSize: 16 }}>🗑️</Text>
                  </Pressable>
                )}
              </View>
            );
          }}
          contentContainerStyle={{ paddingBottom: 20, paddingTop: 6 }}
        />

        {/* Modale: elenco tattiche salvate */}
        <Modal visible={modalOpen} transparent animationType="slide" onRequestClose={() => setModalOpen(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalBoxCentered}>
              <Text style={styles.modalTitle}>Seleziona una tattica</Text>
              <FlatList
                data={allTactics}
                keyExtractor={t => t.id}
                ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
                ListEmptyComponent={<Text style={{ color: '#6b7280' }}>Nessuna tattica salvata</Text>}
                renderItem={({ item }) => (
                  <Pressable style={[styles.tacticRow, assigned.includes(item.id) && { opacity: 0.6 }]} onPress={() => addTactic(item.id)}>
                    {item.preview ? (
                      <Image source={{ uri: item.preview }} style={styles.previewSmall} />
                    ) : (
                      <View style={[styles.previewSmall, styles.previewPlaceholder]} />
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>{item.name}</Text>
                      <Text style={styles.meta}>{item.elements.length} elementi</Text>
                    </View>
                  </Pressable>
                )}
              />
              <Pressable style={[styles.btn, { backgroundColor: '#9ca3af', marginTop: 10 }]} onPress={() => setModalOpen(false)}>
                <Text style={styles.btnText}>Chiudi</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        {/* Modale FULLSCREEN: CAMPO (max spazio) + LEGENDA (<=30% o sotto) */}
        <Modal visible={assignModal.open} transparent={false} animationType="slide" onRequestClose={() => setAssignModal({ open: false })}>
          {(() => {
            const tid = assignModal.tacticId!;
            const tactic = allTactics.find(t => t.id === tid);
            if (!tactic) return (
              <SafeAreaView style={{ flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }} edges={['top']}>
                <Text style={{ fontWeight: '800' }}>Tattica non trovata</Text>
                <Pressable style={[styles.btn, { backgroundColor: '#9ca3af', marginTop: 10 }]} onPress={() => setAssignModal({ open: false })}>
                  <Text style={styles.btnText}>Chiudi</Text>
                </Pressable>
              </SafeAreaView>
            );

            const current = assignForTactic(tid);
            const homeSlots = tactic.elements
              .filter(e => e.type === 'HOME')
              .slice()
              .sort((a, b) => (a.number ?? 0) - (b.number ?? 0) || a.y - b.y);

            return (
              <SafeAreaView style={styles.fsWrap} edges={['top', 'left', 'right', 'bottom']}>
                {/* HEADER */}
                <View style={styles.fsHeader}>
                  <Pressable style={[styles.headerBtn, { backgroundColor: 'rgba(239,68,68,0.1)', borderColor: '#ef4444' }]} onPress={() => setAssignModal({ open: false })}>
                    <Text style={[styles.headerBtnText, { color: '#ef4444' }]}>✕</Text>
                  </Pressable>
                  <Text style={styles.fsTitle}>⚽ {tactic.name}</Text>
                  <View style={[styles.headerCounter]}>
                    <Text style={styles.headerCounterText}>
                      {Object.values(current).filter(Boolean).length}/{homeSlots.length}
                    </Text>
                  </View>
                </View>

                {/* WRAP: Campo (priorità) + Legenda */}
                <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 20 }}>
                  <View style={{ flexDirection: IS_NARROW ? 'column' : 'row', gap: 12, alignItems: 'stretch' }}>
                    {/* CAMPO: SOLO MAGLIE/PALLONE, NESSUNA ETICHETTA */}
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={[styles.field, { height: FIELD_H_MODAL }]}>
                        {/* linee campo */}
                        <View style={styles.midLine} />
                        <View style={styles.centerCircle} />
                        <View style={[styles.penaltyBox, styles.topPenaltyBox]} />
                        <View style={[styles.sixYardBox, styles.topSixYard]} />
                        <View style={[styles.goal, styles.topGoal]} />
                        <View style={[styles.penaltyBox, styles.bottomPenaltyBox]} />
                        <View style={[styles.sixYardBox, styles.bottomSixYard]} />
                        <View style={[styles.goal, styles.bottomGoal]} />

                        {tactic.elements.map((el) => {
                          const elW = el.type === 'BALL' ? BALL_SIZE : SHIRT_W;
                          const elH = el.type === 'BALL' ? BALL_SIZE : SHIRT_H;

                          const top = (el.y / 100) * FIELD_H_MODAL - elH / 2;

                          if (el.type === 'BALL') {
                            return (
                              <View key={el.id} style={[styles.abs, { left: `${el.x}%`, top } ]}>
                                <View style={styles.ball}><Text style={{ fontSize: 16 }}>⚽</Text></View>
                              </View>
                            );
                          }
                          if (el.type === 'AWAY') {
                            return (
                              <View key={el.id} style={[styles.abs, { left: `${el.x}%`, top, marginLeft: -SHIRT_W/2 }] }>
                                <RedShirt number={el.number} />
                              </View>
                            );
                          }
                          // HOME (assegnabile): mostra numero SOLO se c'è un giocatore assegnato (numero proveniente da "Formazione")
                          const assignedId = current[el.id] || null;
                          const jerseyNumber = assignedId ? numbersMap[assignedId] : undefined;
                          return (
                            <View key={el.id} style={[styles.abs, { left: `${el.x}%`, top, marginLeft: -SHIRT_W/2 }]}>
                              <Pressable
                                onPress={readOnly ? undefined : () => setPickerState({ open: true, tacticId: tid, elementId: el.id })}
                                onLongPress={readOnly ? undefined : () => assignedId && setAssign(tid, el.id, null)}
                              >
                                <BlueWhiteShirt empty={!assignedId} number={jerseyNumber} />
                              </Pressable>
                            </View>
                          );
                        })}
                      </View>

                      {/* AZIONI */}
                      <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                        {!readOnly && (
                          <Pressable
                            style={[styles.modalBtn, { backgroundColor: '#9ca3af', flex: 1 }]}
                            onPress={() => {
                              const resetAssignments = Object.fromEntries(
                                tactic.elements.filter(e => e.type === 'HOME').map(e => [e.id, null as string | null])
                              );
                              setAssignments(prev => {
                                const next = { ...prev };
                                next[tid] = resetAssignments;
                                saveTacticsAssignmentsRemote(id!, next);
                                return next;
                              });
                            }}
                          >
                            <Text style={styles.modalBtnText}>Reset</Text>
                          </Pressable>
                        )}
                        <Pressable
                          style={[styles.modalBtn, { backgroundColor: '#10b981', flex: 1 }]}
                          onPress={() => setAssignModal({ open: false })}
                        >
                          <Text style={styles.modalBtnText}>Salva</Text>
                        </Pressable>
                      </View>
                    </View>

                    {/* LEGENDA INTERATTIVA: max 30% su schermi larghi, sotto e full-width su stretti */}
                    <View style={[
                      styles.legendCol,
                      IS_NARROW ? { width: '100%' } : { width: LEGEND_MAX_W, maxWidth: LEGEND_MAX_W }
                    ]}>
                      <Text style={styles.legendTitle}>Legenda</Text>
                      <Text style={styles.legendSub}>
                        {Object.values(current).filter(Boolean).length}/{homeSlots.length} assegnati
                      </Text>

                      <View style={{ marginTop: 8 }}>
                        {homeSlots.length === 0 ? (
                          <Text style={{ color: '#6b7280' }}>Nessun giocatore (HOME) nella tattica.</Text>
                        ) : (
                          homeSlots.map((slot) => {
                            const assignedId = current[slot.id] || null;
                            const assignedPlayer = selectablePlayers.find(p => p.id === assignedId);
                            const displayName = assignedPlayer ? surnameOf(assignedPlayer.name) : '—';
                            const jerseyNumber = assignedId ? numbersMap[assignedId] : undefined;
                            return (
                              <Pressable
                                key={slot.id}
                                style={styles.legendRow}
                                onPress={readOnly ? undefined : () => setPickerState({ open: true, tacticId: tid, elementId: slot.id })}
                                onLongPress={readOnly ? undefined : () => assignedId && setAssign(tid, slot.id, null)}
                              >
                                <View style={styles.numberBadge}>
                                  <Text style={styles.numberBadgeText}>
                                    {jerseyNumber ?? '—'}
                                  </Text>
                                </View>
                                <Text numberOfLines={1} style={[styles.legendName, !assignedPlayer && { color: '#6b7280' }]}>
                                  {displayName}
                                </Text>
                              </Pressable>
                            );
                          })
                        )}
                      </View>

                      <View style={styles.legendHint}>
                        <Text style={styles.legendHintText}>Tocca una riga per assegnare. Tieni premuto per svuotare.</Text>
                      </View>
                    </View>
                  </View>
                </ScrollView>
              </SafeAreaView>
            );
          })()}
        </Modal>

        {/* Picker giocatore */}
        <Modal visible={pickerState.open} transparent animationType="fade" onRequestClose={() => setPickerState({ open: false })}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalBoxCentered, { maxHeight: '80%' }]} >
              <Text style={styles.modalTitle}>Scegli giocatore</Text>
              <FlatList
                data={selectablePlayers}
                keyExtractor={p => p.id}
                renderItem={({ item }) => (
                  <Pressable
                    style={styles.pickRow}
                    onPress={() => {
                      if (pickerState.tacticId && pickerState.elementId) {
                        setAssign(pickerState.tacticId, pickerState.elementId, item.id);
                        setPickerState({ open: false });
                      }
                    }}
                  >
                    {/* Numero + cognome nel picker */}
                    <View style={[styles.numberBadge, { marginRight: 8 }]}>
                      <Text style={styles.numberBadgeText}>{item.number ?? '—'}</Text>
                    </View>
                    <Text style={{ fontWeight: '700' }}>{surnameOf(item.name)}</Text>
                  </Pressable>
                )}
                ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
                ListEmptyComponent={<Text style={{ color:'#6b7280' }}>Nessun giocatore disponibile</Text>}
              />
              <Pressable style={[styles.btn, { backgroundColor: '#9ca3af', marginTop: 8 }]} onPress={() => setPickerState({ open: false })}>
                <Text style={styles.btnText}>Chiudi</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

/* -------------------------------- STYLES -------------------------------- */

const LINE = 'rgba(255,255,255,0.7)';

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
  container: { flex:1, backgroundColor:'#fff' },
  topBar: { paddingHorizontal:12, paddingTop:6, paddingBottom:12, flexDirection:'row', justifyContent:'space-between', alignItems:'center' },
  title: { fontWeight:'900', fontSize:18 },
  btn: { borderRadius:8, paddingVertical:8, paddingHorizontal:12, alignItems:'center' },
  btnText: { color:'white', fontWeight:'900' },

  card: { flexDirection:'row', gap:10, padding:10, backgroundColor:'#f9fafb', borderRadius:12, marginHorizontal:12 },
  preview: { width: 120, height: 80, borderRadius:8, backgroundColor:'#e5e7eb' },
  previewSmall: { width: 64, height: 40, borderRadius:6, backgroundColor:'#e5e7eb' },
  previewPlaceholder: { alignItems:'center', justifyContent:'center' },
  name: { fontWeight:'900' },
  meta: { color:'#6b7280', fontSize:12 },

  deleteBtn: { backgroundColor:'#ffe4e6', borderRadius:8, paddingHorizontal:8, alignItems:'center', justifyContent:'center' },

  modalOverlay: { flex:1, backgroundColor:'rgba(0,0,0,0.4)', alignItems:'center', justifyContent:'center', padding:16 },
  modalBoxCentered: { backgroundColor:'white', borderRadius:12, width:'92%', maxWidth:820, padding:12 },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 10 },

  tacticRow: { flexDirection:'row', alignItems:'center', gap:10, backgroundColor:'#fff', borderRadius:10, padding:8 },

  /* ====== FULLSCREEN MODALE ====== */
  fsWrap: { flex: 1, backgroundColor: '#f5f7fa' },
  fsHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#e5e7eb',
  },
  fsTitle: { fontSize: 18, fontWeight: '800', color: '#111', flex: 1, textAlign: 'center' },
  headerBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  headerBtnText: { fontSize: 16, fontWeight: '900' },
  headerCounter: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: 'rgba(16,185,129,0.15)' },
  headerCounterText: { color: '#059669', fontWeight: '800', fontSize: 12 },

  legendCol: {
    alignSelf: 'stretch',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  legendTitle: { fontSize: 16, fontWeight: '900', color: '#0f172a' },
  legendSub: { marginTop: 2, color: '#475569', fontWeight: '700' },

  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: '#f1f5f9',
  },
  numberBadge: {
    minWidth: 28, height: 28, borderRadius: 6,
    backgroundColor: '#e2f2ff',
    borderWidth: 1, borderColor: '#bfdbfe',
    alignItems: 'center', justifyContent: 'center',
  },
  numberBadgeText: { fontWeight: '900', color: '#1e3a8a' },
  legendName: { flex: 1, fontWeight: '800', color: '#111827' },
  legendHint: { marginTop: 10, padding: 8, backgroundColor: '#f8fafc', borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb' },
  legendHintText: { color: '#334155', fontSize: 12 },

  field: {
    width: '100%',
    backgroundColor: '#1b7f3b',
    borderRadius: 12, borderWidth: 3, borderColor: '#0d5f2b',
    overflow: 'hidden',
    alignSelf: 'center',
  },
  abs: { position: 'absolute' as const },
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

  // Maglie
  shirtBody: {
    width: SHIRT_W, height: SHIRT_H, borderRadius: 10,
    backgroundColor: '#ffffff',
    borderWidth: 2, borderColor: 'rgba(0,0,0,0.15)',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  shirtStripes: { position: 'absolute', inset: 0, flexDirection: 'row' },
  shirtEmpty: { opacity: 0.45 },
  shirtNum: { position: 'absolute', fontWeight: '900', color: '#111', fontSize: 12 },

  // Pallone
  ball: {
    width: BALL_SIZE, height: BALL_SIZE, borderRadius: BALL_SIZE/2,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#111',
  },

  // Pulsanti footer modale
  modalBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  modalBtnText: { color: 'white', fontWeight: '800', fontSize: 16 },

  // Picker righe
  pickRow: { backgroundColor:'#f8fafc', borderRadius:8, padding:10, borderWidth:1, borderColor:'#e5e7eb', flexDirection: 'row', alignItems: 'center' },
});
