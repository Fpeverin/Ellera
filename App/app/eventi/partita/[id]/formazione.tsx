// app/eventi/partita/[id]/formazione.tsx
import { Picker } from '@react-native-picker/picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { autoAssignPlayersToSlots } from '../../../utils/autoFormation';
import DraggableToken from '../../../components/tactical/DraggableToken';
import Field from '../../../components/tactical/Field';
import { Jersey } from '../../../components/tactical/Jersey';
import { DEFAULT_SWAP_THRESHOLD_PX, resolveDropTarget } from '../../../components/tactical/dropTarget';
import TeamLogo from '../../../components/TeamLogo';
import { useAuth } from '../../../context/AuthContext';
import {
  checkLineupAgainstRules,
  loadCompetitionRules,
  type CompetitionRules,
  type RulesCheckResult,
} from '../../../data/competitionRules';
import { loadConvocazione } from '../../../data/convocazione';
import { loadEvents } from '../../../data/events';
import {
  loadLineup as loadLineupRemote,
  loadListaGara,
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

type PickTarget =
  | { kind: 'FIELD'; index: number }
  | { kind: 'BENCH'; index: number };

// helper per mostrare solo il cognome — il nome è salvato come "Cognome Nome" (il cognome può
// essere composto da più parole, es. "Di Marzo": l'ultima parola è sempre il nome, tutto il resto
// è il cognome)
const surnameOf = (full: string) => {
  const parts = (full || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return parts[0] || '';
  return parts.slice(0, -1).join(' ');
};

export default function Schieramento() {
  const { id: matchId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { players: basePlayers, allPlayers: baseAllPlayers, loading: basePlayersLoading } = usePlayers();
  const { membership } = useAuth();
  const readOnly = membership?.role === 'giocatore';
  const params = useLocalSearchParams();
  const liveMode = (params as any)?.live === '1';

  const [modules, setModules] = useState<CustomModule[]>([]);
  const [selectedModuleName, setSelectedModuleName] = useState<string | null>(null);

  const [fieldSize, setFieldSize] = useState({ w: 0, h: 0 });

  // Convocati: scelti nel tab "Convocazione" della partita, qui solo consumati
  // (sola lettura) per decidere chi si può schierare in campo/panchina.
  const [convocatiPlayerIds, setConvocatiPlayerIds] = useState<string[]>([]);

  const [fieldAssignments, setFieldAssignments] = useState<(Player | null)[]>([]);
  const [benchAssignments, setBenchAssignments] = useState<Player[]>([]);

  const [pickModalOpen, setPickModalOpen] = useState(false);
  const [pickTarget, setPickTarget] = useState<PickTarget | null>(null);

  const [numberModalOpen, setNumberModalOpen] = useState(false);
  const [numberTarget, setNumberTarget] = useState<PickTarget | null>(null);
  const [numberValue, setNumberValue] = useState<string>('');

  const [posOverrides, setPosOverrides] = useState<PosOverride[]>([]);
  const loadedRef = useRef(false);
  // Finché non è true, l'editor resta bloccato: prima si poteva assegnare un giocatore mentre il
  // caricamento della formazione salvata era ancora in corso, e quando quel caricamento finiva
  // sovrascriveva silenziosamente l'assegnazione appena fatta — stessa famiglia del bug del
  // 2026-08-23, ma sulla finestra di editing invece che sul solo caricamento id→giocatore.
  const [screenReady, setScreenReady] = useState(false);
  // null finché non si sa ancora, poi true/false a seconda che sia stata trovata una formazione già
  // salvata — usato per decidere se proporre la Lista Gara come punto di partenza (solo su una
  // formazione mai impostata, mai per sovrascrivere qualcosa di già fatto).
  const [hasSavedLineup, setHasSavedLineup] = useState<boolean | null>(null);
  const appliedListaGaraDefaultRef = useRef(false);

  // --- regole di partecipazione (Under/Over) della competizione ---
  const [competition, setCompetition] = useState<string | undefined>(undefined);
  const [competitionRules, setCompetitionRules] = useState<CompetitionRules | null>(null);

  React.useEffect(() => {
    (async () => {
      if (!matchId) return;
      try {
        const events = await loadEvents();
        const ev = events.find(e => e.id === matchId);
        setCompetition((ev as any)?.competition || undefined);
      } catch {}
    })();
  }, [matchId]);

  React.useEffect(() => {
    (async () => {
      if (!competition) { setCompetitionRules(null); return; }
      try {
        setCompetitionRules(await loadCompetitionRules(competition));
      } catch {
        setCompetitionRules(null);
      }
    })();
  }, [competition]);

  // --- convocati (dal tab Convocazione) ---
  React.useEffect(() => {
    (async () => {
      if (!matchId) return;
      try {
        const conv = await loadConvocazione(matchId);
        setConvocatiPlayerIds(conv.playerIds);
      } catch {}
    })();
  }, [matchId]);

  const rulesCheck: RulesCheckResult | null = useMemo(() => {
    if (!competitionRules || (!competitionRules.underEnabled && !competitionRules.overEnabled)) return null;
    const onField = fieldAssignments
      .filter((p): p is Player => !!p)
      .map(p => basePlayers.find(bp => bp.id === p.id))
      .filter((bp): bp is NonNullable<typeof bp> => !!bp)
      .map(bp => ({ year: bp.year }));
    return checkLineupAgainstRules(onField, competitionRules);
  }, [fieldAssignments, basePlayers, competitionRules]);

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
  // Aspetta che la Rosa (usePlayers) abbia finito di caricare: questo effect gira una sola volta
  // (dipende solo da matchId) e la sua closure resta legata per sempre a `basePlayers` di quel
  // preciso render — se a quel momento la Rosa non aveva ancora finito di caricare (sempre vuota
  // al primo render, prima che la fetch risponda), ogni giocatore salvato falliva la ricerca per id
  // e finiva scartato: la formazione già salvata veniva letta come vuota e il salvataggio
  // automatico qui sotto la sovrascriveva così per davvero, cancellando la formazione a ogni
  // apertura della schermata — bug reale segnalato da Francesco, 2026-08-23.
  React.useEffect(() => {
    (async () => {
      if (!matchId || basePlayersLoading) return;
      try {
        const saved = await loadLineupRemote(matchId);
        if (saved) {
          if (saved.moduleName) setSelectedModuleName(saved.moduleName);

          const numbersMap: Record<string, number> = saved.numbers || {};
          // attivi + ex (non solo attivi): un convocato spostato tra gli ex dopo essere stato
          // schierato non deve sparire dalla formazione già salvata — sarebbe stato letto come
          // "giocatore non trovato" e scartato in silenzio, facendo sembrare la formazione mai
          // salvata correttamente (2026-08-24).
          const idToPlayer = new Map(baseAllPlayers.map(p => [p.id, p]));

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
          // "Salvato" ma vuoto (nessuno slot compilato) conta come "non ancora impostata" ai fini
          // del punto di partenza dalla Lista Gara — l'autosalvataggio scrive comunque uno scheletro
          // vuoto la prima volta che si apre questa schermata, quindi `saved` da solo non basta a
          // distinguere "mai toccata" da "già impostata sul serio".
          setHasSavedLineup(fieldById.some(Boolean) || benchById.length > 0);
        } else {
          setHasSavedLineup(false);
        }
        setPosOverrides(await loadPositionsRemote(matchId));
      } catch {
      } finally {
        loadedRef.current = true;
        setScreenReady(true);
      }
    })();
  }, [matchId, basePlayersLoading]);

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
      .filter(p => convocatiPlayerIds.includes(p.id) && !inUseIds.has(p.id))
      .sort((a, b) => a.name.localeCompare(b.name));
    const seen = new Set<string>();
    return arr.filter(p => {
      if (seen.has(p.name)) return false;
      seen.add(p.name);
      return true;
    });
  }, [basePlayers, convocatiPlayerIds, fieldAssignments, benchAssignments]);

  const openPickerForField = (index: number) => {
    if (liveMode || readOnly) return;
    setPickTarget({ kind: 'FIELD', index });
    setPickModalOpen(true);
  };
  const openPickerForBench = (index: number) => {
    if (liveMode || readOnly) return;
    setPickTarget({ kind: 'BENCH', index });
    setPickModalOpen(true);
  };

  const openNumberForField = (index: number) => {
    if (readOnly) return;
    const current = fieldAssignments[index];
    if (!current) return;
    setNumberTarget({ kind: 'FIELD', index });
    setNumberValue(current.number ? String(current.number) : '');
    setNumberModalOpen(true);
  };
  const openNumberForBench = (index: number) => {
    if (readOnly) return;
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
    if (liveMode || readOnly) return;
    setFieldAssignments(prev => {
      const next = [...prev];
      next[i] = null;
      return next;
    });
  };

  const removeFromBench = (i: number) => {
    if (liveMode || readOnly) return;
    setBenchAssignments(prev => prev.filter((_, idx) => idx !== i));
  };

  const toPx = (x: number, y: number) => ({
    left: fieldSize.w ? (x / 100) * fieldSize.w - SHIRT_W / 2 : 0,
    top: fieldSize.h ? (y / 100) * fieldSize.h - SHIRT_H / 2 : 0,
  });

  // Drag di una maglia in LIVE: sola posizione disegnata (posOverrides), mai l'assegnazione
  // giocatore↔slot (fieldAssignments) — trascinarne una sopra un'altra le scambia di posto.
  const handleFieldTokenMove = (key: string, nx: number, ny: number) => {
    const idx = Number(key);
    setPosOverrides(prev => {
      const w = fieldSize.w;
      const h = fieldSize.h;
      if (w <= 0 || h <= 0) {
        const next = [...prev];
        next[idx] = { x: nx, y: ny };
        return next;
      }
      const droppedPx = { x: (nx / 100) * w, y: (ny / 100) * h };
      const siblings = fieldSlots
        .map((_, i) => i)
        .filter(i => i !== idx)
        .map(i => {
          const p = prev[i] ?? fieldSlots[i];
          return { key: String(i), xPx: (p.x / 100) * w, yPx: (p.y / 100) * h };
        });
      const swapWith = resolveDropTarget(droppedPx.x, droppedPx.y, siblings, key, DEFAULT_SWAP_THRESHOLD_PX);
      if (swapWith != null) {
        const j = Number(swapWith);
        const posA = prev[idx] ?? fieldSlots[idx];
        const posB = prev[j] ?? fieldSlots[j];
        const next = [...prev];
        next[idx] = posB;
        next[j] = posA;
        return next;
      }
      const next = [...prev];
      next[idx] = { x: nx, y: ny };
      return next;
    });
  };

  // "Disponi automaticamente": ripartisce i convocati (meno chi è già in panchina a mano) sugli
  // slot del modulo scelto, per reparto. Non tocca mai la panchina.
  const applyAutoAssign = () => {
    const benchIds = new Set(benchAssignments.map(p => p.id));
    const pool = basePlayers.filter(p => convocatiPlayerIds.includes(p.id) && !benchIds.has(p.id));
    const previousNumbers: Record<string, number> = {};
    [...fieldAssignments, ...benchAssignments].forEach(p => {
      if (p?.number) previousNumbers[p.id] = p.number;
    });
    const assigned = autoAssignPlayersToSlots(fieldSlots, pool, previousNumbers);
    setFieldAssignments(assigned.map(a => (a ? { id: a.id, name: a.name, number: a.number } : null)));
  };

  // Punto di partenza dalla Lista Gara: se questa partita non ha ancora una formazione impostata
  // (mai salvata, o salvata ma ancora completamente vuota) e la Lista Gara ha già dei numeri
  // assegnati, li usa come disposizione iniziale — titolari 1-11 sul campo (per reparto, come
  // "Disponi automaticamente"), panchina 12-20, numeri di maglia compresi. Richiesta di Francesco,
  // 2026-08-24. Aspetta `screenReady` (Rosa + lineup già caricati) e che il modulo sia risolto
  // (`fieldSlots` non vuoto), altrimenti gli slot su cui piazzare i titolari non esistono ancora.
  React.useEffect(() => {
    if (!matchId || !screenReady || hasSavedLineup !== false || readOnly) return;
    if (fieldSlots.length === 0) return;
    if (appliedListaGaraDefaultRef.current) return;
    if (fieldAssignments.some(Boolean) || benchAssignments.length > 0) return;
    appliedListaGaraDefaultRef.current = true;

    (async () => {
      try {
        const listaGara = await loadListaGara(matchId);
        const idToPlayer = new Map(basePlayers.map(p => [p.id, p]));
        const numberByPlayerId: Record<string, number> = {};
        const starters: (typeof basePlayers)[number][] = [];
        const benchFromListaGara: { player: (typeof basePlayers)[number]; number: number }[] = [];

        for (const [numStr, playerId] of Object.entries(listaGara.numbers || {})) {
          const num = Number(numStr);
          const player = idToPlayer.get(playerId);
          if (!player || !Number.isFinite(num)) continue;
          numberByPlayerId[playerId] = num;
          if (num <= 11) starters.push(player);
          else benchFromListaGara.push({ player, number: num });
        }
        if (starters.length === 0 && benchFromListaGara.length === 0) return; // Lista Gara non compilata

        if (starters.length > 0) {
          const assigned = autoAssignPlayersToSlots(fieldSlots, starters, numberByPlayerId);
          setFieldAssignments(assigned.map(a => (a ? { id: a.id, name: a.name, number: a.number } : null)));
        }
        if (benchFromListaGara.length > 0) {
          setBenchAssignments(
            benchFromListaGara
              .sort((a, b) => a.number - b.number)
              .map(({ player, number }) => ({ id: player.id, name: player.name, number }))
          );
        }
      } catch {}
    })();
  }, [matchId, screenReady, hasSavedLineup, fieldSlots, basePlayers, fieldAssignments, benchAssignments, readOnly]);

  const requestAutoAssign = () => {
    if (liveMode || readOnly) return;
    if (fieldAssignments.some(Boolean)) {
      Alert.alert(
        'Disponi automaticamente?',
        'Questo sovrascrive la disposizione attuale in campo (la panchina resta invariata).',
        [
          { text: 'Annulla', style: 'cancel' },
          { text: 'Conferma', style: 'destructive', onPress: applyAutoAssign },
        ]
      );
      return;
    }
    applyAutoAssign();
  };

  // --- salvataggi lineup + posizioni ---
  // Ogni assegnazione (drag, tap sul picker, "Disponi automaticamente"...) fa scattare questo
  // effect da capo: più modifiche ravvicinate potevano quindi avere più scritture in volo insieme,
  // e senza un ordine garantito quella per uno stato "vecchio" poteva arrivare al server DOPO
  // quella per lo stato più recente, sovrascrivendolo — la formazione appena impostata spariva al
  // rientro sulla schermata. Le due code qui sotto forzano l'ordine: una nuova scrittura parte solo
  // dopo che la precedente è finita, così l'ultima modifica vince sempre per davvero.
  const lineupSaveQueueRef = React.useRef<Promise<void>>(Promise.resolve());
  React.useEffect(() => {
    if (!loadedRef.current || !matchId) return;
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
      convocati: convocatiPlayerIds,
      field: fieldAssignments.map(p => p?.id ?? null),
      bench: benchAssignments.map(p => p.id),
      numbers, // <-- SALVO I NUMERI
    };
    lineupSaveQueueRef.current = lineupSaveQueueRef.current.then(
      () => saveLineupRemote(matchId, payload).catch(() => {}),
      () => saveLineupRemote(matchId, payload).catch(() => {})
    );
  }, [matchId, selectedModuleName, convocatiPlayerIds, fieldAssignments, benchAssignments]);

  const positionsSaveQueueRef = React.useRef<Promise<void>>(Promise.resolve());
  React.useEffect(() => {
    if (!loadedRef.current || !matchId) return;
    if (!liveMode) return;
    positionsSaveQueueRef.current = positionsSaveQueueRef.current.then(
      () => savePositionsRemote(matchId, posOverrides).catch(() => {}),
      () => savePositionsRemote(matchId, posOverrides).catch(() => {})
    );
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
    <>
      {/* SAFE AREA: evita sovrapposizione con notch e con i bottoni di gesture in basso, mantenendo
          lo sfondo coerente */}
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <Pressable style={styles.backBtn} onPress={() => router.back()} accessibilityLabel="Indietro">
            <Text style={styles.backBtnTxt}>←</Text>
          </Pressable>
          <Text style={styles.topBarTitle}>Formazione</Text>
          <TeamLogo size={24} />
        </View>
        {!screenReady ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#1b7f3b" />
            <Text style={styles.loadingText}>Caricamento formazione…</Text>
          </View>
        ) : (
        <View style={styles.wrap}>
          {/* SINISTRA */}
          <View style={styles.left}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={styles.sectionTitle}>Modulo</Text>
              {liveMode ? <Text style={{ color: '#b45309', fontWeight: '800' }}>LIVE: solo drag posizioni</Text> : null}
            </View>
            <View style={[styles.moduleSelectRow, (liveMode || readOnly) && { opacity: 0.6 }]}>
              <Picker
                enabled={!liveMode && !readOnly}
                selectedValue={selectedModuleName ?? undefined}
                onValueChange={(val) => setSelectedModuleName(val)}
                style={styles.modulePicker}
              >
                {modules.map(m => (
                  <Picker.Item key={m.name} label={m.name} value={m.name} />
                ))}
              </Picker>
            </View>

            {!liveMode && !readOnly && (
              <Pressable style={styles.autoBtn} onPress={requestAutoAssign}>
                <Text style={styles.autoBtnText}>🪄 Disponi automaticamente</Text>
              </Pressable>
            )}

            {/* Campo */}
            <View style={styles.fieldWrap}>
              <Field zoomable resetKey={selectedModuleName} onMeasure={setFieldSize}>
                {/* Maglie */}
                {fieldSlots.map((s, i) => {
                  const posPct = posOverrides[i] ?? { x: s.x, y: s.y };
                  const assigned = fieldAssignments[i];
                  const shirtSize = { w: SHIRT_W, h: SHIRT_H };
                  const shirt = (
                    <Pressable
                      style={{ opacity: assigned ? 1 : 0.45 }}
                      onPress={() => {
                        if (assigned) {
                          openNumberForField(i);
                        } else {
                          openPickerForField(i);
                        }
                      }}
                      onLongPress={() => assigned && removeFromField(i)}
                      disabled={readOnly}
                    >
                      <Jersey variant="home" number={assigned?.number} size={shirtSize} />
                    </Pressable>
                  );
                  if (liveMode && !readOnly) {
                    return (
                      <DraggableToken
                        key={i}
                        tokenKey={String(i)}
                        xPct={posPct.x}
                        yPct={posPct.y}
                        size={shirtSize}
                        onMove={handleFieldTokenMove}
                      >
                        {shirt}
                      </DraggableToken>
                    );
                  }
                  const pos = toPx(posPct.x, posPct.y);
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
              </Field>
            </View>

            {/* Panchina */}
            <Text style={styles.sectionTitle}>Panchina (max 9)</Text>
            <View style={[styles.bench, (liveMode || readOnly) && { opacity: 0.7 }]}>
              {Array.from({ length: 9 }, (_, i) => {
                const p = benchAssignments[i];
                return (
                  <Pressable
                    key={i}
                    disabled={liveMode || readOnly}
                    style={[styles.benchItem, !p && styles.benchEmpty]}
                    onPress={() => {
                      if (liveMode || readOnly) return;
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
            {rulesCheck && (rulesCheck.underChecks.length > 0 || rulesCheck.overChecks.length > 0) && (
              <View style={styles.rulesPanel}>
                <Text style={styles.rulesPanelTitle}>Regole {competition}</Text>
                {rulesCheck.underChecks.map((c, i) => (
                  <Text key={`u${i}`} style={[styles.rulesPanelLine, c.ok ? styles.ruleOk : styles.ruleBad]}>
                    {c.ok ? '✅' : '❌'} Under {c.year}+: {c.actualCount}/{c.minCount}
                  </Text>
                ))}
                {rulesCheck.overChecks.map((c, i) => (
                  <Text key={`o${i}`} style={[styles.rulesPanelLine, c.ok ? styles.ruleOk : styles.ruleBad]}>
                    {c.ok ? '✅' : '❌'} Over {c.year}-: {c.actualCount}/{c.minCount}
                  </Text>
                ))}
              </View>
            )}
            {convocatiPlayerIds.length === 0 ? (
              <Pressable
                style={styles.convBanner}
                disabled={readOnly}
                onPress={() => !readOnly && router.push(`/eventi/partita/${matchId}/convocazione`)}
              >
                <Text style={styles.convBannerText}>
                  ⚠️ Nessuna convocazione impostata. Tocca per andare al tab Convocazione.
                </Text>
              </Pressable>
            ) : (
              <Pressable
                style={styles.convBtn}
                disabled={readOnly}
                onPress={() => !readOnly && router.push(`/eventi/partita/${matchId}/convocazione`)}
              >
                <Text style={styles.convBtnText}>CONVOCATI: {convocatiPlayerIds.length}</Text>
              </Pressable>
            )}
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

          {/* MODALE PICKER */}
          <Modal visible={pickModalOpen} transparent animationType="fade" onRequestClose={() => { setPickModalOpen(false); setPickTarget(null); }}>
            <View style={styles.modalOverlay}>
              <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>
                  {pickTarget?.kind === 'FIELD' ? 'Scegli giocatore per lo slot' : 'Scegli giocatore per la panchina'}
                </Text>
                <FlatList
                  style={styles.pickList}
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
        )}
      </SafeAreaView>
    </>
  );
}

/* --------------------- STILI --------------------- */
const styles = StyleSheet.create({
  // SafeArea con stesso background della pagina, così il notch rispetta il design
  safeArea: { flex: 1, backgroundColor: '#f5f7fa' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: '#6b7280', fontWeight: '600' },

  topBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff',
  },
  backBtnTxt: { fontSize: 18, fontWeight: '800', color: '#111' },
  topBarTitle: { flex: 1, fontSize: 18, fontWeight: '800', color: '#1a202c' },

  wrap: { flex: 1, flexDirection: 'row', backgroundColor: '#f5f7fa' },
  left: { flex: 7, padding: 12, gap: 8 },
  right: { flex: 3, padding: 12, borderLeftWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff' },

  sectionTitle: { fontSize: 16, fontWeight: '800' },

  moduleSelectRow: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, backgroundColor: '#fff' },
  modulePicker: { width: '100%' },

  autoBtn: {
    backgroundColor: '#7c3aed', borderRadius: 8, paddingVertical: 8, alignItems: 'center', marginTop: 4,
  },
  autoBtnText: { color: 'white', fontWeight: '800' },

  fieldWrap: { flex: 1, marginTop: 6 },

  shirtWrap: { position: 'absolute' },

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
  convBanner: { backgroundColor: '#fef3c7', borderWidth: 1, borderColor: '#f59e0b', borderRadius: 8, padding: 10 },
  convBannerText: { color: '#92400e', fontWeight: '700', fontSize: 12 },

  rulesPanel: {
    backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10,
    padding: 10, marginBottom: 10,
  },
  rulesPanelTitle: { fontSize: 12, fontWeight: '800', color: '#334155', marginBottom: 4 },
  rulesPanelLine: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  ruleOk: { color: '#16a34a' },
  ruleBad: { color: '#dc2626' },

  avRow: {
    padding: 10, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10,
    backgroundColor: '#f8fafc', flexDirection: 'row', alignItems: 'center',
  },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },

  modalCard: { width: '92%', maxHeight: '92%', backgroundColor: '#fff', borderRadius: 12, padding: 14 },
  // Un maxHeight sul contenitore non basta a rendere scorrevole una FlatList figlia: senza un
  // limite proprio, prova a rendersi alla sua altezza naturale e con una rosa lunga il contenuto
  // (compreso il bottone "Chiudi") finiva fuori dallo schermo, irraggiungibile — bug reale,
  // segnalato dal vivo 2026-08-24.
  pickList: { maxHeight: 360 },
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
