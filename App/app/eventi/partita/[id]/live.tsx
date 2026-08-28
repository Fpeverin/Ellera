// =============================================================
// app/eventi/partita/[id]/live.tsx — eventi SEMPRE editabili (anche a fine partita)
// + Pulsante (solo icona) accanto a "Cronologia partita" per INSERIMENTO MANUALE evento
//   - Sempre attivo (anche a partita finita)
//   - Per Ellera usa i GIOCATORI CONVOCATI dalla formazione (LIVE_FORMATION = allPlayers)
// =============================================================
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, AppStateStatus, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../../context/AuthContext';
import { useTimer } from '../../../context/TimerContext';
import {
  checkLineupAgainstRules,
  describeViolations,
  loadCompetitionRules,
  type CompetitionRules,
} from '../../../data/competitionRules';
import ConvocatiPlayersModal from '../../../components/partite/ConvocatiPlayersModal';
import TeamLogo from '../../../components/TeamLogo';
import { findTeamLogoForOpponent } from '../../../data/competitionTeams';
import { loadConvocazione, saveConvocatiPlayerIds } from '../../../data/convocazione';
import { loadEvents, patchEventData, saveEvents } from '../../../data/events';
import { loadOrgLogoUrl, opponentLogoUrlFromPath } from '../../../data/organization';
import {
  CardItem,
  GoalItem,
  InCampoPlayer,
  loadCards as loadCardsRemote,
  loadGoals as loadGoalsRemote,
  loadLineup as loadLineupRemote,
  loadLiveFormation as loadLiveFormationRemote,
  loadStarted as loadStartedRemote,
  loadSubs as loadSubsRemote,
  loadTimerState,
  PersistTimer,
  saveCards as saveCardsRemote,
  saveGoals as saveGoalsRemote,
  saveLiveFormation as saveLiveFormationRemote,
  saveSubs as saveSubsRemote,
  saveTimerState,
  setStarted as setStartedRemote,
  SubItem,
  TeamSide,
} from '../../../data/matchLive';
import {
  CardProposalPayload,
  decideProposal,
  EventProposal,
  GoalProposalPayload,
  loadProposals,
  proposeCard,
  proposeGoal,
} from '../../../data/proposals';
import { usePlayers } from '../../../hooks/usePlayers';

// Cartellini
type CardColor = 'YELLOW' | 'RED';

// Eventi per lista
type EventRow =
  | { kind: 'GOAL'; id: string; minute: number; team: TeamSide; scorer: string }
  | { kind: 'SUB';  id: string; minute: number; outName: string; inName: string; team: TeamSide }
  | { kind: 'CARD'; id: string; minute: number; team: TeamSide; color: CardColor; playerName: string; auto?: boolean };


const LAST_TOUCH_KEY = 'app/lastUpdate/touch';

const touchApp = async () => {
  try { await AsyncStorage.setItem(LAST_TOUCH_KEY, String(Date.now())); } catch (e) {}
};
const CLUB_NAME = 'Ellera';

const nowMs = () => Date.now();
const msToClock = (ms: number) => {
  if (ms < 0 || !Number.isFinite(ms)) ms = 0;
  const totalSec = Math.floor(ms / 1000);
  const mm = Math.floor(totalSec / 60);
  const ss = totalSec % 60;
  const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${pad(mm)}:${pad(ss)}`;
};
const msToMinutePlusOne = (ms: number) => Math.floor(Math.max(0, ms) / 60000) + 1;

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export default function LivePartita() {
  const { id: matchId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { players: basePlayers, allPlayers: baseAllPlayers, loading: basePlayersLoading } = usePlayers();
  const { membership, session } = useAuth();
  const readOnly = membership?.role === 'giocatore';
  const canModerate = membership?.role === 'admin' || membership?.role === 'staff';

  // TIMER (context esistente)
  const {
    time, phase, isRunning,
    start, pause, reset, nextPhase,
    formatTime, timerActive, computedMinutePlusOne,
  } = useTimer();

  // TIMER persistente (background)
  const [persistTimer, setPersistTimer] = useState<PersistTimer>({ running: false, startAt: null, pausedAccum: 0, lastPausedAt: null });
  const [derivedClock, setDerivedClock] = useState<string>('00:00');
  const appState = useRef<AppStateStatus>(AppState.currentState);

  const calcPersistMs = (pt: PersistTimer) => {
    if (!pt.startAt) return 0;
    const base = nowMs() - pt.startAt - pt.pausedAccum - (pt.running ? 0 : (pt.lastPausedAt ? nowMs() - pt.lastPausedAt : 0));
    return Math.max(0, base);
  };

  useEffect(() => {
    (async () => {
      try {
        const parsed = await loadTimerState(matchId!);
        if (parsed) {
          const fixed: PersistTimer = {
            running: !!parsed.running,
            startAt: typeof parsed.startAt === 'number' ? parsed.startAt : null,
            pausedAccum: typeof parsed.pausedAccum === 'number' ? parsed.pausedAccum : 0,
            lastPausedAt: typeof parsed.lastPausedAt === 'number' ? parsed.lastPausedAt : null,
          };
          setPersistTimer(fixed);
        }
      } catch {}
    })();
  }, [matchId]);

  const savePersistTimer = async (pt: PersistTimer) => {
    setPersistTimer(pt);
    try { await saveTimerState(matchId!, pt); } catch {}
  };

  useEffect(() => {
    setDerivedClock(msToClock(calcPersistMs(persistTimer)));
    const id = setInterval(() => setDerivedClock(msToClock(calcPersistMs(persistTimer))), 1000);
    return () => clearInterval(id);
  }, [persistTimer]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      const prev = appState.current;
      appState.current = next;
      if ((prev === 'background' || prev === 'inactive') && next === 'active') {
        setDerivedClock(msToClock(calcPersistMs(persistTimer)));
      }
    });
    return () => sub.remove();
  }, [persistTimer]);

  const persistStart = async () => {
    const now = nowMs();
    const next: PersistTimer = { ...persistTimer };
    if (next.startAt == null) next.startAt = now;
    if (next.lastPausedAt != null) {
      next.pausedAccum += Math.max(0, now - next.lastPausedAt);
      next.lastPausedAt = null;
    }
    next.running = true;
    await savePersistTimer(next);
  };
  const persistPause = async () => {
    const now = nowMs();
    const next: PersistTimer = { ...persistTimer };
    if (next.running && next.lastPausedAt == null) {
      next.lastPausedAt = now;
      next.running = false;
      await savePersistTimer(next);
    }
  };
  const persistReset = async () => {
    const next: PersistTimer = { running: false, startAt: null, pausedAccum: 0, lastPausedAt: null };
    await savePersistTimer(next);
  };
  // Fissa la baseline a 45:00 e riparte SUBITO, in un solo passaggio: calcola lo stato finale
  // direttamente (mai leggendo `persistTimer` dalla closure), perché prima veniva chiamata insieme
  // a `persistStart()` nella stessa pressione di bottone — due letture separate della stessa
  // closure "vecchia" di `persistTimer`, la seconda ignorava l'aggiornamento appena fatto dalla
  // prima (lo stato React di un `setState` non è visibile nella stessa closure già in esecuzione).
  const startSecondHalf = async () => {
    const now = nowMs();
    const next: PersistTimer = {
      running: true,
      startAt: now - 45 * 60 * 1000,
      pausedAccum: 0,
      lastPausedAt: null,
    };
    await savePersistTimer(next);
  };
  const [isFinished, setIsFinished] = useState(false);
  const [startedOnce, setStartedOnce] = useState(false);

  const [homeName, setHomeName] = useState<string>('Casa');
  const [awayName, setAwayName] = useState<string>('Trasferta');
  const [ourSide, setOurSide]   = useState<TeamSide | null>(null);
  const [orgLogoUrl, setOrgLogoUrl] = useState<string | null>(null);
  const [opponentLogoUrl, setOpponentLogoUrl] = useState<string | null>(null);

  // Un solo modale di inserimento evento (gol/cartellino/sostituzione/manuale) è aperto per volta:
  // uno stato "in salvataggio" condiviso basta a disabilitare il bottone e impedire un doppio tocco
  // durante il round-trip di rete (causa concreta di eventi doppi/mancanti su connessione instabile
  // a bordo campo, segnalato dopo la prima partita — 2026-08-23).
  const [savingEvent, setSavingEvent] = useState(false);

  const [finishOpen, setFinishOpen] = useState(false);
  const [finishBusy, setFinishBusy] = useState(false);
  // Durata totale della partita in minuti — usata per calcolare i minuti giocati di chi non è mai
  // stato sostituito. Di norma coincide con la partita seguita dal vivo, ma serve poterla impostare
  // a mano quando nessuno ha usato il cronometro (richiesta di Francesco dopo la prima partita,
  // 2026-08-23): senza, le statistiche userebbero sempre 90' fissi anche per una gara più corta.
  const [matchDurationInput, setMatchDurationInput] = useState('90');
  const [finishError, setFinishError] = useState<string>('');

  // Regole di partecipazione (Under/Over) della competizione di questa partita
  const [competitionRules, setCompetitionRules] = useState<CompetitionRules | null>(null);

  // Convocati (dal tab Convocazione) — modificabili "all'ultimo secondo" prima di Start
  const [convocatiPlayerIds, setConvocatiPlayerIds] = useState<string[]>([]);
  const [convocatiModalOpen, setConvocatiModalOpen] = useState(false);

  useEffect(() => {
    (async () => {
      if (!matchId) return;
      try {
        const conv = await loadConvocazione(matchId);
        setConvocatiPlayerIds(conv.playerIds);
      } catch {}
    })();
  }, [matchId]);

  // Stesso auto-fix di convocazione.tsx: un id rimasto orfano (giocatore eliminato del tutto dalla
  // Rosa dopo essere stato convocato) non deve più gonfiare questo conteggio.
  useEffect(() => {
    if (!matchId || basePlayersLoading) return;
    const validIds = convocatiPlayerIds.filter((id) => baseAllPlayers.some((p) => p.id === id));
    if (validIds.length === convocatiPlayerIds.length) return;
    setConvocatiPlayerIds(validIds);
    saveConvocatiPlayerIds(matchId, validIds).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId, basePlayersLoading, convocatiPlayerIds, baseAllPlayers]);

  const handleConfirmConvocati = async (ids: string[]) => {
    if (!matchId) return;
    setConvocatiPlayerIds(ids);
    try {
      await saveConvocatiPlayerIds(matchId, ids);
    } catch {
      Alert.alert('Errore', 'Impossibile salvare i giocatori convocati.');
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const events = await loadEvents();
        const ev = events.find((e) => `${e.id}` === `${matchId}`);

        const opponent: string = (ev?.opponent ?? ev?.avversario ?? '').toString().trim();
        const isHomeEvent: boolean =
          typeof ev?.isHome === 'boolean' ? ev.isHome : (ev?.homeAway === 'HOME');

        if (isHomeEvent) {
          setHomeName(CLUB_NAME); setAwayName(opponent || 'Ospiti'); setOurSide('HOME');
        } else {
          setHomeName(opponent || 'Avversari'); setAwayName(CLUB_NAME); setOurSide('AWAY');
        }

        // Stemmi delle due squadre per il tabellone — il nostro (logo squadra, Admin) e quello
        // avversario, già collegato alla partita se ci si è passati da Convocazione/pagina scelta-
        // partita; se manca ancora, stesso recupero automatico dalle Squadre configurate usato lì.
        loadOrgLogoUrl().then(setOrgLogoUrl).catch(() => {});
        const opponentLogoPath = (ev as any)?.opponentLogoPath;
        if (opponentLogoPath) {
          setOpponentLogoUrl(opponentLogoUrlFromPath(opponentLogoPath));
        } else if (opponent) {
          findTeamLogoForOpponent((ev as any)?.competition, opponent)
            .then((match) => {
              if (match?.logoPath && matchId) {
                patchEventData(matchId, { opponentLogoPath: match.logoPath }).catch(() => {});
                setOpponentLogoUrl(match.logoUrl);
              }
            })
            .catch(() => {});
        }

        if (ev?.status === 'FINISHED') setIsFinished(true);

        const savedDuration = (ev as any)?.matchDurationMinutes;
        if (typeof savedDuration === 'number' && savedDuration > 0) {
          setMatchDurationInput(String(savedDuration));
        }

        const competition = (ev as any)?.competition as string | undefined;
        if (competition) {
          try { setCompetitionRules(await loadCompetitionRules(competition)); } catch { setCompetitionRules(null); }
        }
      } catch {
        setHomeName(CLUB_NAME); setAwayName('Ospiti'); setOurSide('HOME');
      }
    })();
  }, [matchId]);

  useEffect(() => {
    (async () => {
      const started = await loadStartedRemote(matchId!);
      setStartedOnce(started);
    })();
  }, [matchId]);

  // Il nome "vero" di un convocato viene sempre da qui, mai dal campo `name` salvato in
  // `live_formation` — quel campo può restare "congelato" a un valore sbagliato (vedi sotto) e
  // altrimenti non si autocorreggerebbe mai da solo.
  const basePlayersById = useMemo(
    () => new Map(baseAllPlayers.map((p) => [p.id, p.name])),
    [baseAllPlayers]
  );
  const withFreshNames = (list: InCampoPlayer[]) =>
    list.map((p) => {
      const real = basePlayersById.get(p.id);
      if (real) return real !== p.name ? { ...p, name: real } : p;
      // Nessun nome trovato con la Rosa già caricata (mappa non vuota) e il nome salvato è ancora
      // l'id grezzo (il fallback storico di initializeLiveFormationFromLineup): il giocatore è
      // stato eliminato del tutto dalla Rosa (non solo spostato tra gli ex), non c'è più nessun
      // nome vero da recuperare — meglio un'etichetta leggibile che l'id crudo nelle select.
      if (basePlayersById.size > 0 && p.name === p.id) return { ...p, name: '(giocatore rimosso)' };
      return p;
    });

  const [allPlayers, setAllPlayers] = useState<InCampoPlayer[]>([]);
  const [inCampo, setInCampo]       = useState<InCampoPlayer[]>([]);
  const loadLiveFormation = async () => {
   // 1) leggi la formazione live attuale
    let arr = await loadLiveFormationRemote(matchId!);

    // 2) Fallback: se vuota/incoerente, rigenera dalla lineup salvata (silenzioso:
    //    se la formazione non rispetta le regole di partecipazione non mostriamo
    //    un alert qui, ci pensa il bottone "Start" quando viene premuto davvero)
    if (!arr || arr.length === 0) {
      const result = await initializeLiveFormationFromLineup({ silent: true });
      if (result === 'done') {
        // ricarica la versione appena salvata per uniformità
        arr = await loadLiveFormationRemote(matchId!);
      }
    }

    // 3) normalizza, ricalcola i nomi dalla Rosa e aggiorna stato
    const norm = withFreshNames((arr as InCampoPlayer[]).map(p => ({ ...p, expelled: !!p.expelled })));
    setAllPlayers(norm);
    setInCampo(norm.filter(p => p.inField));
  };
  useEffect(() => { loadLiveFormation(); }, [matchId]);

  // Ricarica la formazione quando torni su questa schermata
  useFocusEffect(
    useCallback(() => {
      loadLiveFormation();
    }, [matchId])
  );

  // Se la Rosa (usePlayers) finisce di caricare DOPO la formazione — connessione lenta al campo,
  // lo scenario reale in cui si è visto un id al posto del nome nelle select — questo effect
  // corregge da solo i nomi appena i dati della Rosa sono disponibili, senza dover uscire e
  // rientrare dalla schermata.
  useEffect(() => {
    if (basePlayersById.size === 0) return;
    setAllPlayers((prev) => withFreshNames(prev));
    setInCampo((prev) => withFreshNames(prev));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basePlayersById]);

  const saveLiveFormation = async (list: InCampoPlayer[]) => {
    const fresh = withFreshNames(list);
    await saveLiveFormationRemote(matchId!, fresh);
    setAllPlayers(fresh);
    setInCampo(fresh.filter(p => p.inField));
  };

  type InitLiveFormationResult = 'done' | 'already_started' | 'no_lineup' | 'blocked';

  const initializeLiveFormationFromLineup = async (opts?: { silent?: boolean }): Promise<InitLiveFormationResult> => {
    const already = await loadStartedRemote(matchId!);
    if (already) return 'already_started';

    const lineup = await loadLineupRemote(matchId!);
    if (!lineup) return 'no_lineup';

    const inFieldIds = (lineup.field || []).filter(Boolean) as string[];

    // Regole di partecipazione (Under/Over): l'11 titolare deve rispettarle.
    if (competitionRules && (competitionRules.underEnabled || competitionRules.overEnabled)) {
      const onField = inFieldIds
        .map((id) => basePlayers.find((p) => p.id === id))
        .filter((p): p is NonNullable<typeof p> => !!p)
        .map((p) => ({ year: p.year }));
      const check = checkLineupAgainstRules(onField, competitionRules);
      if (!check.compliant) {
        if (!opts?.silent) {
          Alert.alert('Formazione non conforme', describeViolations(check));
        }
        return 'blocked';
      }
    }

    // basePlayersById (attivi + ex, non solo attivi) evita di scrivere l'id come nome per un
    // convocato spostato tra gli ex dopo la convocazione ma prima di premere Start — con la sola
    // rosa attiva quella ricerca falliva sempre, indipendentemente da quanto la Rosa avesse già
    // finito di caricare (bug distinto dalla race di caricamento, 2026-08-24).
    const benchIds = lineup.bench || [];

    const list: InCampoPlayer[] = withFreshNames([
      ...inFieldIds.map((id) => ({ id, name: basePlayersById.get(id) || id, inField: true, expelled: false })),
      ...benchIds.map((id)   => ({ id, name: basePlayersById.get(id) || id, inField: false, expelled: false })),
    ]);
    await saveLiveFormationRemote(matchId!, list);
    await setStartedRemote(matchId!, true);
      await touchApp();
    setAllPlayers(list);
    setInCampo(list.filter(p => p.inField));
    setStartedOnce(true);
    return 'done';
  };

  const handleStart = async () => {
    if (phase === 'PRE_MATCH') {
      const result = await initializeLiveFormationFromLineup();
      if (result === 'blocked') return;
    }
    start();
    await persistStart();
  };
  const handleReset = async () => {
    reset();
    await persistReset();
    await setStartedRemote(matchId!, false);
    setStartedOnce(false);
  };
  // Ogni transizione di fase aggiorna il cronometro persistente in modo esplicito (mai tramite un
  // effect legato a `isRunning`: quello stato vive nel TimerContext globale — montato una volta
  // sola in app/_layout.tsx, non per-partita — quindi resta true tra una partita e l'altra. Un
  // effect `[isRunning]` rifatto scattava a ogni mount/remount di questa schermata (es. tornando su
  // Live dopo essere stati su Formazione) leggendo il valore di default {running:false,...} di
  // `persistTimer` prima che il caricamento dal server finisse, e sovrascriveva il cronometro reale
  // con uno "ripartito da ora" — bug reale osservato dopo la prima partita (2026-08-23).
  const onPressPhaseBtn = async () => {
    if (phase === 'FULL_TIME') { setFinishOpen(true); return; }
    if (phase === 'FIRST_HALF' || phase === 'SECOND_HALF') {
      // fine tempo: ferma il cronometro persistente insieme al cambio fase
      await persistPause();
      nextPhase();
      return;
    }
    if (phase === 'HALF_TIME') {
      // inizio 2° tempo: fissa la baseline a 45:00 e la riavvia subito, in un solo passaggio
      await startSecondHalf();
      nextPhase();
      return;
    }
    nextPhase();
  };

  const finalizeMatchAndSave = async () => {
    try {
      setFinishBusy(true);
      setFinishError('');
      const parsedDuration = Math.round(Number(matchDurationInput));
      const matchDurationMinutes = Number.isFinite(parsedDuration) && parsedDuration > 0 ? parsedDuration : 90;

      const events = await loadEvents();
      const idx = events.findIndex((e) => `${e.id}` === `${matchId}`);
      if (idx >= 0) {
        const current = events[idx] ?? {};
        events[idx] = {
          ...current,
          status: 'FINISHED',
          score: { home: scoreHome, away: scoreAway },
          resultText: `${homeName} ${scoreHome} - ${scoreAway} ${awayName}`,
          goals,
          subs,
          cards,
          matchDurationMinutes,
        };
        await saveEvents(events);
      }
      await setStartedRemote(matchId!, true);
      await touchApp();
      setIsFinished(true);
      setFinishOpen(false);
      router.replace({ pathname: '/calendario', params: { tab: 'partite' } });
    } catch {
      setFinishError('Si è verificato un problema durante il salvataggio.');
    } finally {
      setFinishBusy(false);
    }
  };

  /* ---------------- GOAL ---------------- */
  const [goals, setGoals] = useState<GoalItem[]>([]);
  useEffect(() => {
    (async () => {
      setGoals(await loadGoalsRemote(matchId!));
    })();
  }, [matchId]);
  const saveGoals = async (list: GoalItem[]) => {
    await saveGoalsRemote(matchId!, list);
    setGoals(list);
    await touchApp();
  };

  const scoreHome = useMemo(() => goals.filter((g) => g.team === 'HOME').length, [goals]);
  const scoreAway = useMemo(() => goals.filter((g) => g.team === 'AWAY').length, [goals]);
  const homeCrestUrl = ourSide === 'AWAY' ? opponentLogoUrl : orgLogoUrl;
  const awayCrestUrl = ourSide === 'AWAY' ? orgLogoUrl : opponentLogoUrl;

  /* ---------------- SOSTITUZIONI ---------------- */
  const [subs, setSubs] = useState<SubItem[]>([]);
  useEffect(() => {
    (async () => {
      setSubs(await loadSubsRemote(matchId!));
    })();
  }, [matchId]);
  const saveSubs = async (list: SubItem[]) => {
    await saveSubsRemote(matchId!, list);
    setSubs(list);
    await touchApp();
  };

  /* ---------------- CARTELLINI ---------------- */
  const [cards, setCards] = useState<CardItem[]>([]);

  // Ricalcolo espulsioni quando cambiano cartellini o convocati (best-effort: un eventuale errore
  // di rete qui è già stato/sarà mostrato dall'azione esplicita che ha causato il cambio, es.
  // persistCard — evita un doppio Alert per lo stesso problema).
  useEffect(() => {
    if (allPlayers.length === 0) return;
    recomputeExpulsionsFromCards(cards).catch(() => {});
  }, [cards, allPlayers]);

  useEffect(() => {
    (async () => {
      setCards(await loadCardsRemote(matchId!));
    })();
  }, [matchId]);

  const saveCards = async (list: CardItem[]) => {
    await saveCardsRemote(matchId!, list);
    setCards(list);
    await touchApp();
    await recomputeExpulsionsFromCards(list);
  };

  /** Aggiorna `expelled`/`inField` in base ai cartellini — scrive `live_formation` SOLO se lo
   * stato di espulsione di qualcuno è davvero cambiato. Prima confrontava sempre un array
   * ricreato da zero (`.map` produce oggetti nuovi anche quando nulla cambia): siccome
   * `saveLiveFormation` aggiorna `allPlayers`, e questa funzione gira anche in un effect che
   * dipende da `allPlayers`, una scrittura incondizionata rientrava nel proprio stesso effect
   * all'infinito — scritture continue su `live_formation` in corsa con gol/cartellini/sostituzioni
   * reali, causa concreta del salvataggio "a volte sì a volte no" segnalato dopo la prima partita. */
  const recomputeExpulsionsFromCards = async (list: CardItem[]) => {
    if (allPlayers.length === 0) return;
    const yellowCount = new Map<string, number>();
    const redSet = new Set<string>();
    for (const c of [...list].sort((a, b) => a.minute - b.minute)) {
      const key = c.team + '|' + (c.playerId || c.playerName);
      if (c.color === 'RED') redSet.add(key);
      if (c.color === 'YELLOW') {
        const n = (yellowCount.get(key) || 0) + 1;
        yellowCount.set(key, n);
        if (n >= 2) redSet.add(key);
      }
    }

    let changed = false;
    const next = allPlayers.map(p => {
      const key = (ourSide ?? 'HOME') + '|' + p.id;
      const isExpelled = redSet.has(key);
      if (isExpelled && !p.expelled) { changed = true; return { ...p, inField: false, expelled: true }; }
      if (!isExpelled && p.expelled) { changed = true; return { ...p, expelled: false }; }
      return p;
    });
    if (!changed) return;
    await saveLiveFormation(next);
  };

  /* ---------------- Minuto “robusto” ---------------- */
  const effectiveMinute = (manual: number) =>
  timerActive ? computedMinutePlusOne() : Math.max(1, Number.isFinite(manual) ? manual : 1);
  
  const minuteNowPlusOne = () => {
    if (persistTimer?.startAt != null) {
      const ms = calcPersistMs(persistTimer);
      return msToMinutePlusOne(ms);
    }
    return computedMinutePlusOne();
  };
  const autoMinuteActive = !!persistTimer.startAt;
  const currentMinutePlusOne = () => {
    if (persistTimer.startAt) {
      const ms = calcPersistMs(persistTimer);
      return msToMinutePlusOne(ms);
    }
    return computedMinutePlusOne();
  };

  /* ---------------- MODALI: CREAZIONE GOL ---------------- */
  const [goalOpen, setGoalOpen] = useState(false);
  const [goalTeam, setGoalTeam] = useState<TeamSide>('HOME');
  const [goalScorerFree, setGoalScorerFree] = useState<string>('');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('');
  const isOurTeam = (team: TeamSide) => ourSide !== null && team === ourSide;

  const openGoal = (team: TeamSide) => {
    setGoalTeam(team);
    setSelectedPlayerId('');
    setGoalScorerFree('');
    setGoalOpen(true);
  };

  const canSaveGoal = useMemo(() => {
    const scorerOk = isOurTeam(goalTeam) ? !!selectedPlayerId : !!goalScorerFree.trim();
    return scorerOk;
  }, [goalScorerFree, selectedPlayerId, goalTeam]);

  const persistGoal = async () => {
    if (!canSaveGoal || savingEvent) return;
    setSavingEvent(true);
    try {
      const minute = currentMinutePlusOne();
      const playerId = isOurTeam(goalTeam) ? selectedPlayerId : undefined;
      const scorer = isOurTeam(goalTeam)
        ? (basePlayers.find((p) => p.id === selectedPlayerId)?.name ?? '')
        : goalScorerFree.trim();
      const item: GoalItem = { id: uid(), team: goalTeam, minute, scorer, playerId };
      const next = [...goals, item].sort((a, b) => a.minute - b.minute);
      await saveGoals(next);
      setGoalOpen(false);
    } catch {
      Alert.alert('Errore', 'Impossibile salvare il gol. Controlla la connessione e riprova.');
    } finally {
      setSavingEvent(false);
    }
  };

  /* ---------------- MODALI: CREAZIONE SOSTITUZIONI ---------------- */
  const [subsOpen, setSubsOpen] = useState(false);
  const [subsTeam, setSubsTeam] = useState<TeamSide>(ourSide ?? 'HOME');
  const [subsOutId, setSubsOutId] = useState<string>('');
  const [subsInId, setSubsInId] = useState<string>('');
  const [subsOutOpponent, setSubsOutOpponent] = useState<string>('');
  const [subsInOpponent, setSubsInOpponent] = useState<string>('');
  const [subsMinute, setSubsMinute] = useState<number>(1);

  const openSubs = () => {
    setSubsTeam(ourSide ?? 'HOME');
    setSubsOutId('');
    setSubsInId('');
    setSubsOutOpponent('');
    setSubsInOpponent('');
    setSubsMinute(currentMinutePlusOne());
    setSubsOpen(true);
  };

  const canExecSub = useMemo(() => {
    const our = isOurTeam(subsTeam);
    if (our) {
      const outOk = !!subsOutId && allPlayers.some(p => p.id === subsOutId && p.inField && !p.expelled);
      const inOk  = !!subsInId  && allPlayers.some(p => p.id === subsInId  && !p.inField && !p.expelled);
      return outOk && inOk;
    }
    // opponent: require names
    return !!subsOutOpponent.trim() && !!subsInOpponent.trim() && Number.isFinite(Number(subsMinute)) && subsMinute >= 1;
  }, [subsOutId, subsInId, subsOutOpponent, subsInOpponent, subsMinute, subsTeam, allPlayers]);

  const executeSubstitution = async () => {
    if (!canExecSub || savingEvent) return;
    setSavingEvent(true);
    try {
      const isOur = isOurTeam(subsTeam);
      let minute = isOur ? currentMinutePlusOne() : Math.max(1, Number(subsMinute) || 1);

      if (isOur) {
        const outP = allPlayers.find((p) => p.id === subsOutId)!;
        const inP  = allPlayers.find((p) => p.id === subsInId)!;

        // Regole di partecipazione: chi conta ai fini della regola in questo
        // momento e' chi e' in campo O espulso (un'espulsione continua a
        // contare); una sostituzione vera e propria invece toglie dal conteggio.
        if (competitionRules && (competitionRules.underEnabled || competitionRules.overEnabled)) {
          const afterSubIds = allPlayers
            .filter((p) => (p.inField || p.expelled) && p.id !== outP.id)
            .map((p) => p.id)
            .concat([inP.id]);
          const onField = afterSubIds
            .map((id) => basePlayers.find((p) => p.id === id))
            .filter((p): p is NonNullable<typeof p> => !!p)
            .map((p) => ({ year: p.year }));
          const check = checkLineupAgainstRules(onField, competitionRules);
          if (!check.compliant) {
            Alert.alert('Sostituzione non consentita', describeViolations(check));
            return;
          }
        }

        const nextFormation = allPlayers.map((p) =>
          p.id === subsOutId ? { ...p, inField: false } :
          p.id === subsInId  ? { ...p, inField: true  } :
          p
        );
        await saveLiveFormation(nextFormation);

        const subItem: SubItem = { id: uid(), minute, outId: outP.id, outName: outP.name, inId: inP.id, inName: inP.name, team: subsTeam };
        const nextSubs = [...subs, subItem].sort((a, b) => a.minute - b.minute);
        await saveSubs(nextSubs);
      } else {
        const subItem: SubItem = { id: uid(), minute, outName: subsOutOpponent.trim(), inName: subsInOpponent.trim(), team: subsTeam };
        const nextSubs = [...subs, subItem].sort((a, b) => a.minute - b.minute);
        await saveSubs(nextSubs);
      }

      setSubsOutId('');
      setSubsInId('');
      setSubsOutOpponent('');
      setSubsInOpponent('');
      setSubsOpen(false);
    } catch {
      Alert.alert('Errore', 'Impossibile salvare la sostituzione. Controlla la connessione e riprova.');
    } finally {
      setSavingEvent(false);
    }
  };

  /* ---------------- MODALI: CREAZIONE CARTELLINI ---------------- */
  const [cardOpen, setCardOpen] = useState(false);
  const [cardColor, setCardColor] = useState<CardColor>('YELLOW');
  const [cardTeam, setCardTeam] = useState<TeamSide>('HOME');
  const [cardMinute, setCardMinute] = useState<number>(1);
  const [cardPlayerId, setCardPlayerId] = useState<string>(''); // per i nostri
  const [cardOpponentName, setCardOpponentName] = useState<string>(''); // per avversari

  const openCard = (color: CardColor) => {
    setCardColor(color);
    setCardTeam(ourSide ?? 'HOME');
    setCardMinute(currentMinutePlusOne());
    setCardPlayerId('');
    setCardOpponentName('');
    setCardOpen(true);
  };

  const canSaveCard = useMemo(() => {
    const whoOk = isOurTeam(cardTeam) ? !!cardPlayerId : !!cardOpponentName.trim();
    return whoOk;
  }, [cardTeam, cardPlayerId, cardOpponentName]);

  const markPlayerExpelled = async (playerId: string) => {
    const next = allPlayers.map(p => p.id === playerId ? { ...p, inField: false, expelled: true } : p);
    await saveLiveFormation(next);
  };

  const persistCard = async () => {
    if (!canSaveCard || savingEvent) return;
    setSavingEvent(true);
    try {
      const minute = currentMinutePlusOne();
      const playerName = isOurTeam(cardTeam)
        ? (basePlayers.find(p => p.id === cardPlayerId)?.name ?? '')
        : cardOpponentName.trim();

      const baseCard: CardItem = {
        id: uid(),
        minute,
        team: cardTeam,
        color: cardColor,
        playerId: isOurTeam(cardTeam) ? cardPlayerId : undefined,
        playerName,
      };

      let next = [...cards, baseCard];

      if (cardColor === 'RED' && isOurTeam(cardTeam) && cardPlayerId) {
        await markPlayerExpelled(cardPlayerId);
      }

      if (cardColor === 'YELLOW') {
        const key = cardTeam + '|' + (isOurTeam(cardTeam) ? cardPlayerId : playerName);
        const prevYellows = cards.filter(c => c.color === 'YELLOW' && (c.team + '|' + (c.playerId || c.playerName)) === key).length;
        const totalYellows = prevYellows + 1;
        if (totalYellows >= 2) {
          const redAuto: CardItem = {
            id: uid(),
            minute,
            team: cardTeam,
            color: 'RED',
            playerId: isOurTeam(cardTeam) ? cardPlayerId : undefined,
            playerName,
            autoFromSecondYellow: true,
          };
          next.push(redAuto);
          if (isOurTeam(cardTeam) && cardPlayerId) {
            await markPlayerExpelled(cardPlayerId);
          }
        }
      }

      next = next.sort((a, b) => a.minute - b.minute || a.id.localeCompare(b.id));
      await saveCards(next);
      setCardOpen(false);
    } catch {
      Alert.alert('Errore', 'Impossibile salvare il cartellino. Controlla la connessione e riprova.');
    } finally {
      setSavingEvent(false);
    }
  };

  /* ---------------- PROPOSTE (ruolo Giocatore) ---------------- */
  const [proposals, setProposals] = useState<EventProposal[]>([]);
  const refreshProposals = async () => {
    try { setProposals(await loadProposals(matchId!)); } catch {}
  };
  useEffect(() => { refreshProposals(); }, [matchId]);
  useFocusEffect(useCallback(() => {
    refreshProposals();
    const t = setInterval(refreshProposals, 5000);
    return () => clearInterval(t);
  }, [matchId]));

  const pendingProposals = useMemo(() => proposals.filter(p => p.status === 'pending'), [proposals]);
  const myProposals = useMemo(
    () => proposals.filter(p => p.proposedBy === session?.user?.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [proposals, session?.user?.id]
  );

  const proposeGoalNow = async () => {
    if (!canSaveGoal) return;
    const minute = currentMinutePlusOne();
    const playerId = isOurTeam(goalTeam) ? selectedPlayerId : undefined;
    const scorer = isOurTeam(goalTeam)
      ? (basePlayers.find((p) => p.id === selectedPlayerId)?.name ?? '')
      : goalScorerFree.trim();
    const payload: GoalProposalPayload = { team: goalTeam, minute, scorer, playerId };
    try {
      await proposeGoal(matchId!, payload);
      setGoalOpen(false);
      await refreshProposals();
      Alert.alert('Proposta inviata', 'In attesa di conferma dello staff.');
    } catch {
      Alert.alert('Errore', 'Impossibile inviare la proposta.');
    }
  };

  const proposeCardNow = async () => {
    if (!canSaveCard) return;
    const minute = currentMinutePlusOne();
    const playerName = isOurTeam(cardTeam)
      ? (basePlayers.find(p => p.id === cardPlayerId)?.name ?? '')
      : cardOpponentName.trim();
    const payload: CardProposalPayload = {
      minute,
      team: cardTeam,
      color: cardColor,
      playerId: isOurTeam(cardTeam) ? cardPlayerId : undefined,
      playerName,
    };
    try {
      await proposeCard(matchId!, payload);
      setCardOpen(false);
      await refreshProposals();
      Alert.alert('Proposta inviata', 'In attesa di conferma dello staff.');
    } catch {
      Alert.alert('Errore', 'Impossibile inviare la proposta.');
    }
  };

  const approveProposal = async (p: EventProposal) => {
    try {
      // Rilegge l'elenco più recente invece di fidarsi dello stato locale `goals`/`cards`: se due
      // proposte vengono confermate a tocchi ravvicinati, entrambe partirebbero dalla stessa
      // copia in memoria e l'ultimo salvataggio sovrascriverebbe l'altro evento (l'intera colonna
      // viene riscritta per intero, non c'è un merge lato server).
      if (p.type === 'GOAL') {
        const payload = p.payload as GoalProposalPayload;
        const item: GoalItem = { id: uid(), ...payload };
        const latest = await loadGoalsRemote(matchId!);
        await saveGoals([...latest, item].sort((a, b) => a.minute - b.minute));
      } else {
        const payload = p.payload as CardProposalPayload;
        const item: CardItem = { id: uid(), ...payload };
        const latest = await loadCardsRemote(matchId!);
        await saveCards([...latest, item].sort((a, b) => a.minute - b.minute));
      }
      await decideProposal(p.id, 'approved');
      await refreshProposals();
    } catch {
      Alert.alert('Errore', 'Impossibile confermare la proposta.');
    }
  };

  const rejectProposal = async (p: EventProposal) => {
    try {
      await decideProposal(p.id, 'rejected');
      await refreshProposals();
    } catch {
      Alert.alert('Errore', 'Impossibile rifiutare la proposta.');
    }
  };

  /* ---------------- DELETE ---------------- */
  type DelState = { open: boolean; kind: 'GOAL' | 'SUB' | 'CARD' | null; id?: string; title?: string; detail?: string };
  const [del, setDel] = useState<DelState>({ open: false, kind: null });

  const askDeleteGoal = (g: GoalItem) => {
    setDel({
      open: true,
      kind: 'GOAL',
      id: g.id,
      title: 'Eliminare gol?',
      detail: `${g.minute}' — ${g.scorer} (${g.team === 'HOME' ? homeName : awayName})`
    });
  };
  const askDeleteSub = (s: SubItem) => {
    setDel({
      open: true,
      kind: 'SUB',
      id: s.id,
      title: 'Eliminare sostituzione?',
      detail: `${s.minute}' — esce ${s.outName}, entra ${s.inName}`
    });
  };
  const askDeleteCard = (c: CardItem) => {
    setDel({
      open: true,
      kind: 'CARD',
      id: c.id,
      title: `Eliminare ${c.color === 'RED' ? 'cartellino rosso' : 'cartellino giallo'}?`,
      detail: `${c.minute}' — ${c.playerName} (${c.team === 'HOME' ? homeName : awayName})${c.autoFromSecondYellow ? ' — auto (2° giallo)' : ''}`
    });
  };

  const confirmDelete = async () => {
    if (!del.open || !del.kind || !del.id) return;
    try {
      if (del.kind === 'GOAL') {
        const next = goals.filter(g => g.id !== del.id);
        await saveGoals(next);
      } else if (del.kind === 'SUB') {
        const next = subs.filter(s => s.id !== del.id);
        await saveSubs(next);
      } else {
        const next = cards.filter(c => c.id !== del.id);
        await saveCards(next);
      }
      setDel({ open: false, kind: null });
    } catch {
      Alert.alert('Errore', 'Impossibile eliminare. Controlla la connessione e riprova.');
    }
  };

  const cancelDelete = () => setDel({ open: false, kind: null });

  /* ---------------- EDIT (NUOVO) ---------------- */
  // GOL
  const [editGoalOpen, setEditGoalOpen] = useState(false);
  const [editGoalId, setEditGoalId] = useState<string>('');
  const [editGoalMinute, setEditGoalMinute] = useState<number>(1);
  const [editGoalPlayerId, setEditGoalPlayerId] = useState<string>('');
  const [editGoalOpponentName, setEditGoalOpponentName] = useState<string>('');
  const [editGoalTeam, setEditGoalTeam] = useState<TeamSide>('HOME');

  const openEditGoal = (g: GoalItem) => {
    setEditGoalId(g.id);
    setEditGoalMinute(g.minute);
    setEditGoalTeam(g.team);
    if (isOurTeam(g.team)) {
      setEditGoalPlayerId(g.playerId || (basePlayers.find(p => p.name === g.scorer)?.id ?? ''));
      setEditGoalOpponentName('');
    } else {
      setEditGoalPlayerId('');
      setEditGoalOpponentName(g.scorer);
    }
    setEditGoalOpen(true);
  };
  const canSaveEditGoal = useMemo(() => {
    return isOurTeam(editGoalTeam) ? !!editGoalPlayerId : !!editGoalOpponentName.trim();
  }, [editGoalTeam, editGoalPlayerId, editGoalOpponentName]);

  const persistEditGoal = async () => {
    if (!canSaveEditGoal) return;
    try {
      const next = goals.map(g => {
        if (g.id !== editGoalId) return g;
        const playerId = isOurTeam(g.team) ? editGoalPlayerId : undefined;
        const scorer = isOurTeam(g.team)
          ? (basePlayers.find(p => p.id === editGoalPlayerId)?.name ?? g.scorer)
          : editGoalOpponentName.trim();
        return { ...g, minute: Math.max(1, Number(editGoalMinute) || 1), scorer, playerId };
      }).sort((a, b) => a.minute - b.minute);
      await saveGoals(next);
      setEditGoalOpen(false);
    } catch {
      Alert.alert('Errore', 'Impossibile salvare le modifiche. Controlla la connessione e riprova.');
    }
  };

  // SUB
  const [editSubOpen, setEditSubOpen] = useState(false);
  const [editSubId, setEditSubId] = useState<string>('');
  const [editSubMinute, setEditSubMinute] = useState<number>(1);

  const openEditSub = (s: SubItem) => {
    setEditSubId(s.id);
    setEditSubMinute(s.minute);
    setEditSubOpen(true);
  };
  const persistEditSub = async () => {
    try {
      const next = subs.map(s => s.id === editSubId ? { ...s, minute: Math.max(1, Number(editSubMinute) || 1) } : s)
        .sort((a, b) => a.minute - b.minute);
      await saveSubs(next);
      setEditSubOpen(false);
    } catch {
      Alert.alert('Errore', 'Impossibile salvare le modifiche. Controlla la connessione e riprova.');
    }
  };

  // CARD
  const [editCardOpen, setEditCardOpen] = useState(false);
  const [editCardId, setEditCardId] = useState<string>('');
  const [editCardMinute, setEditCardMinute] = useState<number>(1);
  const [editCardTeam, setEditCardTeam] = useState<TeamSide>('HOME');
  const [editCardColor, setEditCardColor] = useState<CardColor>('YELLOW');
  const [editCardPlayerId, setEditCardPlayerId] = useState<string>('');
  const [editCardOpponentName, setEditCardOpponentName] = useState<string>('');

  const openEditCard = (c: CardItem) => {
    setEditCardId(c.id);
    setEditCardMinute(c.minute);
    setEditCardTeam(c.team);
    setEditCardColor(c.color);
    if (isOurTeam(c.team)) {
      setEditCardPlayerId(c.playerId || (basePlayers.find(p => p.name === c.playerName)?.id ?? ''));
      setEditCardOpponentName('');
    } else {
      setEditCardPlayerId('');
      setEditCardOpponentName(c.playerName);
    }
    setEditCardOpen(true);
  };
  const canSaveEditCard = useMemo(() => {
    return isOurTeam(editCardTeam) ? !!editCardPlayerId : !!editCardOpponentName.trim();
  }, [editCardTeam, editCardPlayerId, editCardOpponentName]);

  const persistEditCard = async () => {
    if (!canSaveEditCard) return;
    try {
      let next = cards.map(c => {
        if (c.id !== editCardId) return c;
        const playerName = isOurTeam(c.team)
          ? (basePlayers.find(p => p.id === editCardPlayerId)?.name ?? c.playerName)
          : editCardOpponentName.trim();
        return {
          ...c,
          minute: Math.max(1, Number(editCardMinute) || 1),
          playerId: isOurTeam(c.team) ? editCardPlayerId : undefined,
          playerName,
        };
      });

      // Ordino
      next = next.sort((a, b) => a.minute - b.minute || a.id.localeCompare(b.id));

      await saveCards(next); // ricalcola anche espulsioni
      setEditCardOpen(false);
    } catch {
      Alert.alert('Errore', 'Impossibile salvare le modifiche. Controlla la connessione e riprova.');
    }
  };

  /* ---------------- LISTA EVENTI ---------------- */
  const events: EventRow[] = useMemo(() => {
    const g: EventRow[] = goals.map((x) => ({ kind: 'GOAL', id: x.id, minute: x.minute, team: x.team, scorer: x.scorer }));
    const s: EventRow[] = subs.map((x)  => ({ kind: 'SUB',  id: x.id, minute: x.minute, outName: x.outName, inName: x.inName, team: (x.team ?? (ourSide ?? 'HOME')) }));
    const c: EventRow[] = cards.map((x) => ({ kind: 'CARD', id: x.id, minute: x.minute, team: x.team, color: x.color, playerName: x.playerName, auto: !!x.autoFromSecondYellow }));
    return [...g, ...s, ...c].sort((a, b) => a.minute - b.minute || (('id' in a ? a.id : '') as string).localeCompare(('id' in b ? b.id : '') as string));
  }, [goals, subs, cards]);

  const phaseBtnText =
    phase === 'FIRST_HALF' ? 'Fine 1° tempo'
    : phase === 'HALF_TIME' ? 'Inizia 2° tempo'
    : phase === 'SECOND_HALF' ? 'Fine partita'
    : 'Termina partita';

  const disabledStyle = (cond: boolean) => cond ? { opacity: 0.5 } : null;

  const clockToShow = persistTimer.running || persistTimer.startAt
    ? derivedClock
    : formatTime(time);

  /* ---------------- STATO: INSERIMENTO MANUALE ---------------- */
  type ManualKind = 'GOAL' | 'SUB' | 'CARD_YELLOW' | 'CARD_RED';
  const [manualOpen, setManualOpen] = useState(false);
  const [manualKind, setManualKind] = useState<ManualKind>('GOAL');
  const [manualTeam, setManualTeam] = useState<TeamSide>('HOME');
  const [manualMinute, setManualMinute] = useState<number>(1);
  const [manualGoalPlayerId, setManualGoalPlayerId] = useState('');
  const [manualGoalOpponent, setManualGoalOpponent] = useState('');
  const [manualSubOutId, setManualSubOutId] = useState('');
  const [manualSubInId, setManualSubInId] = useState('');
  const [manualCardPlayerId, setManualCardPlayerId] = useState('');
  const [manualCardOpponent, setManualCardOpponent] = useState('');

  const openManual = () => {
    setManualKind('GOAL');
    setManualTeam(ourSide ?? 'HOME');
    setManualMinute(Math.max(1, currentMinutePlusOne()));
    setManualGoalPlayerId('');
    setManualGoalOpponent('');
    setManualSubOutId('');
    setManualSubInId('');
    setManualCardPlayerId('');
    setManualCardOpponent('');
    setManualOpen(true);
  };

  const isManualOurTeam = isOurTeam(manualTeam);
  const manualPlayers = allPlayers; // tutti i convocati (campo + panchina)

// 1) Solo VALIDAZIONE / ABILITAZIONE pulsante
  const canSaveManual = useMemo(() => {
    if (manualKind === 'GOAL') {
      return isManualOurTeam ? !!manualGoalPlayerId : !!manualGoalOpponent.trim();
    }

    if (manualKind === 'SUB') {
      if (isManualOurTeam) {
        const outOk = !!manualSubOutId && manualPlayers.some(p => p.id === manualSubOutId && p.inField && !p.expelled);
        const inOk  = !!manualSubInId  && manualPlayers.some(p => p.id === manualSubInId  && !p.inField && !p.expelled);
        return outOk && inOk;
      }
      // avversari: servono i nomi + minuto valido
      return !!manualSubOutId.trim() && !!manualSubInId.trim() && Number.isFinite(Number(manualMinute)) && manualMinute >= 1;
    }

    if (manualKind === 'CARD_YELLOW' || manualKind === 'CARD_RED') {
      return isManualOurTeam ? !!manualCardPlayerId : !!manualCardOpponent.trim();
    }

    return false;
  }, [
    manualKind, manualTeam, manualMinute,
    manualGoalPlayerId, manualGoalOpponent,
    manualSubOutId, manualSubInId,
    manualCardPlayerId, manualCardOpponent,
    isManualOurTeam, manualPlayers
  ]);

  const persistManual = async () => {
  if (!canSaveManual || savingEvent) return;
  setSavingEvent(true);
  try {
  // assicuriamoci di avere un minuto >= 1
  const minute = Math.max(1, Number(manualMinute) || 1);

  if (manualKind === 'GOAL') {
    const playerId = isManualOurTeam ? manualGoalPlayerId : undefined;
    const scorer = isManualOurTeam
      ? (basePlayers.find(p => p.id === manualGoalPlayerId)?.name ?? '')
      : manualGoalOpponent.trim();
    const item: GoalItem = { id: uid(), team: manualTeam, minute, scorer, playerId };
    await saveGoals([...goals, item].sort((a, b) => a.minute - b.minute));
    setManualOpen(false);
    return;
  }

  if (manualKind === 'SUB') {
    if (isManualOurTeam) {
      const outP = manualPlayers.find(p => p.id === manualSubOutId)!;
      const inP  = manualPlayers.find(p => p.id === manualSubInId)!;

      // aggiorno formazione (best effort anche a gara finita)
      const nextFormation = allPlayers.map((p) =>
        p.id === outP.id ? { ...p, inField: false }
        : p.id === inP.id ? { ...p, inField: true }
        : p
      );
      await saveLiveFormation(nextFormation);

      const s: SubItem = { id: uid(), minute, outId: outP.id, outName: outP.name, inId: inP.id, inName: inP.name, team: manualTeam };
      await saveSubs([...subs, s].sort((a,b)=>a.minute-b.minute));
    } else {
      const s: SubItem = { id: uid(), minute, outName: manualSubOutId.trim(), inName: manualSubInId.trim(), team: manualTeam };
      await saveSubs([...subs, s].sort((a,b)=>a.minute-b.minute));
    }
    setManualOpen(false);
    return;
  }

  if (manualKind === 'CARD_YELLOW' || manualKind === 'CARD_RED') {
    const color: CardColor = manualKind === 'CARD_RED' ? 'RED' : 'YELLOW';
    const playerName = isManualOurTeam
      ? (manualPlayers.find(p => p.id === manualCardPlayerId)?.name ?? '')
      : manualCardOpponent.trim();

    let next: CardItem[] = [
      ...cards,
      {
        id: uid(),
        minute,
        team: manualTeam,
        color,
        playerId: isManualOurTeam ? manualCardPlayerId : undefined,
        playerName,
      }
    ];

    // doppio giallo => rosso
    if (color === 'YELLOW') {
      const key = manualTeam + '|' + (isManualOurTeam ? manualCardPlayerId : playerName);
      const prevY = cards.filter(c => c.color === 'YELLOW' && (c.team + '|' + (c.playerId || c.playerName)) === key).length;
      if (prevY + 1 >= 2) {
        next.push({
          id: uid(),
          minute,
          team: manualTeam,
          color: 'RED',
          playerId: isManualOurTeam ? manualCardPlayerId : undefined,
          playerName,
          autoFromSecondYellow: true
        });
      }
    }

    next = next.sort((a,b)=>a.minute-b.minute || a.id.localeCompare(b.id));
    await saveCards(next);

    // espulsione (nostri)
    if ((color === 'RED' || next.some(c => c.autoFromSecondYellow && c.playerId === manualCardPlayerId && c.minute === minute))
        && isManualOurTeam && manualCardPlayerId) {
      await markPlayerExpelled(manualCardPlayerId);
    }

    setManualOpen(false);
    return;
  }
  } catch {
    Alert.alert('Errore', 'Impossibile salvare l\'evento. Controlla la connessione e riprova.');
  } finally {
    setSavingEvent(false);
  }
};

  /* ---------------- RENDER ---------------- */
  return (
    <SafeAreaView style={[styles.safeArea, { paddingTop: insets.top, paddingBottom: insets.bottom }]} edges={['top', 'bottom']}>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 8 }}>
          <Pressable
            style={styles.backBtn}
            onPress={() => router.replace({ pathname: '/calendario', params: { tab: 'partite' } })}
            accessibilityLabel="Torna a Partite"
          >
            <Text style={styles.backBtnTxt}>← Partite</Text>
          </Pressable>
          <TeamLogo size={26} />
        </View>
        {/* HEADER MATCH */}
        <View style={styles.scoreBoard}>
          <View style={[styles.teamSection, ourSide === 'HOME' && styles.ourTeam]}>
            {homeCrestUrl ? (
              <Image source={{ uri: homeCrestUrl }} style={styles.teamCrest} resizeMode="contain" />
            ) : (
              <View style={styles.teamCrestPlaceholder} />
            )}
            <Text style={styles.teamName} numberOfLines={1}>{homeName}</Text>
            <Text style={[styles.teamScore, ourSide === 'HOME' && styles.ourScore]}>{scoreHome}</Text>
          </View>

          <View style={styles.timerSection}>
            <Text style={styles.timerDisplay}>{clockToShow}</Text>
            <View style={styles.phaseIndicator}>
              <Text style={styles.phaseText}>
                {phase === 'PRE_MATCH' ? '⚪ Pre-partita'
                  : phase === 'FIRST_HALF' ? '🟢 1° tempo'
                  : phase === 'HALF_TIME' ? '🟡 Intervallo'
                  : phase === 'SECOND_HALF' ? '🟢 2° tempo'
                  : '🔴 Finale'}
              </Text>
            </View>

            {!isFinished && (
              <Text style={styles.matchStatus}>
                {isRunning || persistTimer.running ? '▶️ In corso' : '⏸️ In pausa'}
              </Text>
            )}
          </View>

          <View style={[styles.teamSection, ourSide === 'AWAY' && styles.ourTeam]}>
            {awayCrestUrl ? (
              <Image source={{ uri: awayCrestUrl }} style={styles.teamCrest} resizeMode="contain" />
            ) : (
              <View style={styles.teamCrestPlaceholder} />
            )}
            <Text style={[styles.teamName, { textAlign: 'right' }]} numberOfLines={1}>{awayName}</Text>
            <Text style={[styles.teamScore, ourSide === 'AWAY' && styles.ourScore]}>{scoreAway}</Text>
          </View>
        </View>

        {/* CONTROLLI TIMER */}
        {!readOnly && (
        <View style={styles.timerControls}>
          {phase !== 'FULL_TIME' && (
            <Pressable
              style={[
                styles.controlButton,
                styles.primaryButton,
              ]}
              onPress={() => {
                if (phase === 'FIRST_HALF' || phase === 'SECOND_HALF') {
                  if (isRunning || persistTimer.running) {
                    pause();
                    persistPause();
                  } else {
                    handleStart();
                  }
                } else {
                  handleStart();
                }
              }}
            >
              <Text style={styles.controlButtonIcon}>
                {phase === 'FIRST_HALF' || phase === 'SECOND_HALF'
                  ? ((isRunning || persistTimer.running) ? '⏸️' : '▶️')
                  : '▶️'}
              </Text>
              <Text style={styles.controlButtonText}>
                {phase === 'FIRST_HALF' || phase === 'SECOND_HALF'
                  ? ((isRunning || persistTimer.running) ? 'Pausa' : 'Start')
                  : 'Start'}
              </Text>
            </Pressable>
          )}

          <Pressable
            style={[styles.controlButton, styles.secondaryButton]}
            onPress={handleReset}
          >
            <Text style={styles.controlButtonIcon}>🔄</Text>
            <Text style={styles.controlButtonText}>Reset</Text>
          </Pressable>

          <Pressable
            style={[styles.controlButton, styles.phaseButton]}
            onPress={onPressPhaseBtn}
          >
            <Text style={styles.controlButtonIcon}>⏭️</Text>
            <Text style={styles.controlButtonText}>{phaseBtnText}</Text>
          </Pressable>
        </View>
        )}

        {/* Per una partita mai seguita dal vivo (nessuno ha premuto Start): il bottone "Fine
            partita" sopra non si raggiunge mai, perché richiede di passare per tutte le fasi.
            Questo link apre lo stesso modale (risultato + durata) indipendentemente dalla fase. */}
        {!readOnly && phase !== 'FULL_TIME' && (
          <Pressable style={styles.durationLink} onPress={() => setFinishOpen(true)}>
            <Text style={styles.durationLinkText}>🏁 Termina/aggiorna partita senza cronometro</Text>
          </Pressable>
        )}

        {/* AZIONI PRINCIPALI */}
        <View style={styles.actionCards}>
          {/* Gol */}
          <View style={styles.goalActions}>
            <Pressable
              style={[
                styles.actionCard,
                styles.goalCard,
                styles.homeGoalCard,
              ]}
              onPress={() => openGoal('HOME')}
            >
              <Text style={styles.actionIcon}>⚽</Text>
              <Text style={styles.actionTitle}>GOL</Text>
              <Text style={styles.actionSubtitle} numberOfLines={1}>{homeName}</Text>
            </Pressable>

            <Pressable
              style={[
                styles.actionCard,
                styles.goalCard,
                styles.awayGoalCard,
              ]}
              onPress={() => openGoal('AWAY')}
            >
              <Text style={styles.actionIcon}>⚽</Text>
              <Text style={styles.actionTitle}>GOL</Text>
              <Text style={styles.actionSubtitle} numberOfLines={1}>{awayName}</Text>
            </Pressable>
          </View>

          <View style={styles.managementActions}>
            {!readOnly && (!startedOnce ? (
              <Pressable
                style={[styles.actionCard, styles.formationCard]}
                onPress={() => router.push(`/eventi/partita/${matchId}/formazione`)}
              >
                <Text style={styles.actionIcon}>👥</Text>
                <Text style={styles.actionTitle}>FORMAZIONE</Text>
                <Text style={styles.actionSubtitle}>Imposta lineup</Text>
              </Pressable>
            ) : (
              <Pressable
                style={[styles.actionCard, styles.subCard]}
                onPress={openSubs}
              >
                <Text style={styles.actionIcon}>🔄</Text>
                <Text style={styles.actionTitle}>SOSTITUZIONI</Text>
                <Text style={styles.actionSubtitle}>Cambi in campo</Text>
              </Pressable>
            ))}

            <Pressable
              style={[styles.actionCard, styles.tacticsCard]}
              onPress={() => router.push(`/eventi/partita/${matchId}/tattiche`)}
            >
              <Text style={styles.actionIcon}>📋</Text>
              <Text style={styles.actionTitle}>TATTICHE</Text>
              <Text style={styles.actionSubtitle}>Strategie</Text>
            </Pressable>
          </View>

          {!readOnly && (
            <View style={[styles.managementActions, { marginTop: 12 }]}>
              <Pressable
                style={[styles.actionCard, styles.convocazioneCard]}
                onPress={() => router.push(`/eventi/partita/${matchId}/convocazione`)}
              >
                <Text style={styles.actionIcon}>🗒️</Text>
                <Text style={styles.actionTitle}>CONVOCAZIONE</Text>
                <Text style={styles.actionSubtitle}>{convocatiPlayerIds.length} convocati</Text>
              </Pressable>
              {!startedOnce && (
                <Pressable
                  style={[styles.actionCard, styles.convocazioneCard]}
                  onPress={() => setConvocatiModalOpen(true)}
                >
                  <Text style={styles.actionIcon}>✏️</Text>
                  <Text style={styles.actionTitle}>MODIFICA CONVOCATI</Text>
                  <Text style={styles.actionSubtitle}>Ultimo secondo</Text>
                </Pressable>
              )}
            </View>
          )}

          {/* Cartellini */}
          <View style={[styles.managementActions, { marginTop: 12 }]}>
            <Pressable
              style={[styles.actionCard, styles.yellowCard]}
              onPress={() => openCard('YELLOW')}
            >
              <Text style={styles.actionIcon}>🟨</Text>
              <Text style={styles.actionTitle}>CARTELLINO GIALLO</Text>
              <Text style={styles.actionSubtitle}>Registra ammonizione</Text>
            </Pressable>

            <Pressable
              style={[styles.actionCard, styles.redCard]}
              onPress={() => openCard('RED')}
            >
              <Text style={styles.actionIcon}>🟥</Text>
              <Text style={styles.actionTitle}>CARTELLINO ROSSO</Text>
              <Text style={styles.actionSubtitle}>Espulsione diretta</Text>
            </Pressable>
          </View>
        </View>

        {/* CRONOLOGIA EVENTI */}
        <View style={styles.eventsSection}>
          <View style={styles.eventsSectionHeader}>
            <Text style={styles.eventsTitle}>⚡ Cronologia partita</Text>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.eventsCount}>{events.length} eventi</Text>
              {/* Nuovo: pulsante solo icona per inserimento manuale, sempre attivo */}
              {!readOnly && (
                <Pressable style={styles.iconOnlyBtn} onPress={openManual}>
                  <Text style={{ fontSize: 18 }}>➕</Text>
                </Pressable>
              )}
            </View>
          </View>

          {events.length === 0 ? (
            <View style={styles.emptyEvents}>
              <Text style={styles.emptyEventsIcon}>🏟️</Text>
              <Text style={styles.emptyEventsTitle}>Nessun evento ancora</Text>
              <Text style={styles.emptyEventsSubtitle}>Inizia la partita per registrare gol, sostituzioni e cartellini</Text>
            </View>
          ) : (
            <View style={styles.eventsList}>
              {events.map((ev) => {
                if (ev.kind === 'GOAL') {
                  const g = goals.find(x => x.id === ev.id)!;
                  const isOurGoal = isOurTeam(ev.team);
                  return (
                    <View key={`G_${ev.id}`} style={[styles.eventCard, isOurGoal && styles.ourEventCard]}>
                      <View style={[styles.eventBadge, styles.goalBadge]}>
                        <Text style={styles.eventBadgeIcon}>⚽</Text>
                        <Text style={styles.eventBadgeText}>{ev.minute}'</Text>
                      </View>

                      <View style={styles.eventContent}>
                        <Text style={styles.eventTitle}>GOL!</Text>
                        <Text style={styles.eventPlayer}>{ev.scorer}</Text>
                        <Text style={styles.eventTeam}>
                          {ev.team === 'HOME' ? homeName : awayName}
                          {isOurGoal && ' 🎉'}
                        </Text>
                      </View>

                      {!readOnly && (
                        <>
                          {/* EDIT sempre attivo */}
                          <Pressable style={styles.editEventBtn} onPress={() => openEditGoal(g)}>
                            <Text style={styles.editEventIcon}>✏️</Text>
                          </Pressable>

                          {/* DELETE sempre attivo */}
                          <Pressable style={styles.deleteEventBtn} onPress={() => askDeleteGoal(g)}>
                            <Text style={styles.deleteEventIcon}>🗑️</Text>
                          </Pressable>
                        </>
                      )}
                    </View>
                  );
                }

                if (ev.kind === 'SUB') {
                  const s = subs.find(x => x.id === ev.id)!;
                  const teamLabel = (s.team ?? (ourSide ?? 'HOME')) === 'HOME' ? homeName : awayName;
                  return (
                    <View key={`S_${ev.id}`} style={[styles.eventCard, ((s.team ?? (ourSide ?? 'HOME')) === (ourSide ?? 'HOME')) && styles.ourEventCard]}>
                      <View style={[styles.eventBadge, styles.subBadge]}>
                        <Text style={styles.eventBadgeIcon}>🔄</Text>
                        <Text style={styles.eventBadgeText}>{ev.minute}'</Text>
                      </View>

                      <View style={styles.eventContent}>
                        <Text style={styles.eventTitle}>SOSTITUZIONE</Text>
                        <Text style={styles.eventSubDetails}>
                          <Text style={styles.eventPlayerOut}>Esce {s.outName}</Text>
                          {'\n'}
                          <Text style={styles.eventPlayerIn}>Entra {s.inName}</Text>
                        </Text>
                        <Text style={styles.eventTeam}>{teamLabel}</Text>
                      </View>

                      {!readOnly && (
                        <>
                          <Pressable style={styles.editEventBtn} onPress={() => openEditSub(s)}>
                            <Text style={styles.editEventIcon}>✏️</Text>
                          </Pressable>

                          <Pressable style={styles.deleteEventBtn} onPress={() => askDeleteSub(s)}>
                            <Text style={styles.deleteEventIcon}>🗑️</Text>
                          </Pressable>
                        </>
                      )}
                    </View>
                  );
                }

                // CARTELLINI
                const c = cards.find(x => x.id === ev.id)!;
                const isOurCard = isOurTeam(c.team);
                const isRed = c.color === 'RED';
                return (
                  <View key={`C_${ev.id}`} style={[styles.eventCard, isOurCard && styles.ourEventCard]}>
                    <View style={[styles.eventBadge]}>
                      <Text style={styles.eventBadgeIcon}>{isRed ? '🟥' : '🟨'}</Text>
                      <Text style={styles.eventBadgeText}>{ev.minute}'</Text>
                    </View>
                    <View style={styles.eventContent}>
                      <Text style={styles.eventTitle}>
                        {isRed ? 'CARTELLINO ROSSO' : 'CARTELLINO GIALLO'}{c.autoFromSecondYellow ? ' (2° giallo ⇒ rosso)' : ''}
                      </Text>
                      <Text style={styles.eventPlayer}>{c.playerName}</Text>
                      <Text style={styles.eventTeam}>{c.team === 'HOME' ? homeName : awayName}{isRed && isOurCard ? ' — ESPULSO' : ''}</Text>
                    </View>

                    {!readOnly && (
                      <>
                        <Pressable style={styles.editEventBtn} onPress={() => openEditCard(c)}>
                          <Text style={styles.editEventIcon}>✏️</Text>
                        </Pressable>

                        <Pressable style={styles.deleteEventBtn} onPress={() => askDeleteCard(c)}>
                          <Text style={styles.deleteEventIcon}>🗑️</Text>
                        </Pressable>
                      </>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* PROPOSTE IN ATTESA (Staff/Admin) */}
        {canModerate && pendingProposals.length > 0 && (
          <View style={styles.eventsSection}>
            <Text style={styles.eventsTitle}>🙋 Proposte in attesa ({pendingProposals.length})</Text>
            <View style={styles.eventsList}>
              {pendingProposals.map((p) => {
                const isGoal = p.type === 'GOAL';
                const payload = p.payload as any;
                const label = isGoal
                  ? `⚽ Gol — ${payload.scorer} · ${payload.minute}'`
                  : `${payload.color === 'RED' ? '🟥' : '🟨'} Cartellino — ${payload.playerName} · ${payload.minute}'`;
                return (
                  <View key={p.id} style={styles.eventCard}>
                    <View style={styles.eventContent}>
                      <Text style={styles.eventTitle}>{label}</Text>
                      <Text style={styles.eventTeam}>{payload.team === 'HOME' ? homeName : awayName}</Text>
                    </View>
                    <Pressable style={[styles.modalBtn, { backgroundColor: '#1b7f3b', paddingHorizontal: 12 }]} onPress={() => approveProposal(p)}>
                      <Text style={styles.modalBtnText}>Conferma</Text>
                    </Pressable>
                    <Pressable style={[styles.modalBtn, { backgroundColor: '#9ca3af', paddingHorizontal: 12, marginLeft: 8 }]} onPress={() => rejectProposal(p)}>
                      <Text style={styles.modalBtnText}>Rifiuta</Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* LE TUE PROPOSTE (Giocatore) */}
        {readOnly && myProposals.length > 0 && (
          <View style={styles.eventsSection}>
            <Text style={styles.eventsTitle}>Le tue proposte</Text>
            <View style={styles.eventsList}>
              {myProposals.map((p) => {
                const isGoal = p.type === 'GOAL';
                const payload = p.payload as any;
                const label = isGoal
                  ? `⚽ Gol — ${payload.scorer} · ${payload.minute}'`
                  : `${payload.color === 'RED' ? '🟥' : '🟨'} Cartellino — ${payload.playerName} · ${payload.minute}'`;
                const statusLabel = p.status === 'pending' ? '⏳ In attesa' : p.status === 'approved' ? '✅ Confermata' : '❌ Rifiutata';
                return (
                  <View key={p.id} style={styles.eventCard}>
                    <View style={styles.eventContent}>
                      <Text style={styles.eventTitle}>{label}</Text>
                      <Text style={styles.eventTeam}>{statusLabel}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* MODALE: CREAZIONE GOL */}
        <Modal visible={goalOpen} transparent animationType="slide" onRequestClose={() => setGoalOpen(false)}>
          <View style={styles.overlay}>
            <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}>
              <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>Registra gol — {goalTeam === 'HOME' ? homeName : awayName}</Text>

              <Text style={styles.label}>Squadra</Text>
              <View style={styles.readonlyBox}><Text style={{ fontWeight: '800' }}>{goalTeam === 'HOME' ? homeName : awayName}</Text></View>

              <Text style={styles.label}>Minuto</Text>
              <TextInput
                style={[styles.input]}
                value={String(currentMinutePlusOne())}
                onChangeText={()=>{}}
                editable={false}
              />
              <Text style={styles.help}>Il minuto viene calcolato al salvataggio usando il cronometro corrente.</Text>

              {isOurTeam(goalTeam) ? (
                <>
                  <Text style={styles.label}>Autore (Ellera — convocati (in campo o panchina))</Text>
                  <View style={styles.pickerWrap}>
                    <Picker selectedValue={selectedPlayerId} onValueChange={(v) => setSelectedPlayerId(String(v))} dropdownIconColor="#111">
                      <Picker.Item label="— Scegli marcatore —" value="" />
                      {allPlayers.map(p => (<Picker.Item key={p.id} label={p.name} value={p.id} />))}
                    </Picker>
                  </View>
                </>
              ) : (
                <>
                  <Text style={styles.label}>Autore (avversario)</Text>
                  <TextInput style={styles.input} placeholder="Es. Rossi" value={goalScorerFree} onChangeText={setGoalScorerFree} />
                </>
              )}

              <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
                <Pressable
                  style={[styles.modalBtn, { backgroundColor: '#1b7f3b', flex: 1, opacity: (canSaveGoal && !savingEvent) ? 1 : 0.5 }]}
                  onPress={readOnly ? proposeGoalNow : persistGoal}
                  disabled={!canSaveGoal || savingEvent}
                >
                  <Text style={styles.modalBtnText}>{savingEvent ? 'Salvataggio…' : (readOnly ? 'Proponi gol' : 'Salva gol')}</Text>
                </Pressable>
                <Pressable style={[styles.modalBtn, { backgroundColor: '#9ca3af', flex: 1 }]} onPress={() => setGoalOpen(false)}>
                  <Text style={styles.modalBtnText}>Annulla</Text>
                </Pressable>
              </View>
              </ScrollView>
            </View>
          </View>
        </Modal>

        
{/* MODALE: CREAZIONE SOSTITUZIONI */}
        <Modal visible={subsOpen} transparent animationType="slide" onRequestClose={() => setSubsOpen(false)}>
          <View style={styles.overlay}>
            <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}>
              <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>Sostituzioni</Text>

              <Text style={styles.label}>Squadra</Text>
              <View style={styles.pickerWrap}>
                <Picker selectedValue={subsTeam} onValueChange={(v) => setSubsTeam(String(v) as TeamSide)} dropdownIconColor="#111">
                  <Picker.Item label={homeName} value="HOME" />
                  <Picker.Item label={awayName} value="AWAY" />
                </Picker>
              </View>

              {isOurTeam(subsTeam) ? (
                <>
                  <Text style={styles.label}>Minuto (verrà salvato come il minuto corrente)</Text>
                  <TextInput style={[styles.input]} value={String(currentMinutePlusOne())} editable={false} />

                  <Text style={styles.label}>Esce (in campo)</Text>
                  <View style={styles.pickerWrap}>
                    <Picker selectedValue={subsOutId} onValueChange={(v) => setSubsOutId(String(v))} dropdownIconColor="#111">
                      <Picker.Item label="— Seleziona chi esce —" value="" />
                      {allPlayers.filter(p => p.inField && !p.expelled).map(p => (<Picker.Item key={'OUT_' + p.id} label={p.name} value={p.id} />))}
                    </Picker>
                  </View>

                  <Text style={styles.label}>Entra (panchina)</Text>
                  <View style={styles.pickerWrap}>
                    <Picker selectedValue={subsInId} onValueChange={(v) => setSubsInId(String(v))} dropdownIconColor="#111">
                      <Picker.Item label="— Seleziona chi entra —" value="" />
                      {allPlayers.filter(p => !p.inField && !p.expelled).map(p => (<Picker.Item key={'IN_' + p.id} label={p.name} value={p.id} />))}
                    </Picker>
                  </View>
                </>
              ) : (
                <>
                  <Text style={styles.label}>Minuto</Text>
                  <TextInput style={styles.input} value={String(subsMinute)} onChangeText={(t) => setSubsMinute(Math.max(1, parseInt(t || '1', 10)))} keyboardType="number-pad" />

                  <Text style={styles.label}>Esce (avversario)</Text>
                  <TextInput style={styles.input} placeholder="Es. Rossi" value={subsOutOpponent} onChangeText={setSubsOutOpponent} />

                  <Text style={styles.label}>Entra (avversario)</Text>
                  <TextInput style={styles.input} placeholder="Es. Bianchi" value={subsInOpponent} onChangeText={setSubsInOpponent} />
                </>
              )}

              <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
                <Pressable
                  style={[styles.modalBtn, { backgroundColor: '#f59e0b', flex: 1, opacity: (canExecSub && !savingEvent) ? 1 : 0.5 }]}
                  onPress={executeSubstitution}
                  disabled={!canExecSub || savingEvent}
                >
                  <Text style={styles.modalBtnText}>{savingEvent ? 'Salvataggio…' : 'Esegui sostituzione'}</Text>
                </Pressable>
                <Pressable style={[styles.modalBtn, { backgroundColor: '#9ca3af', flex: 1 }]} onPress={() => setSubsOpen(false)}>
                  <Text style={styles.modalBtnText}>Chiudi</Text>
                </Pressable>
              </View>
              </ScrollView>
            </View>
          </View>
        </Modal>


        {/* MODALE: CREAZIONE CARTELLINI */}
        <Modal visible={cardOpen} transparent animationType="slide" onRequestClose={() => setCardOpen(false)}>
          <View style={styles.overlay}>
            <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}>
              <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>
                {cardColor === 'RED' ? 'Cartellino rosso' : 'Cartellino giallo'}
              </Text>

              <Text style={styles.label}>Squadra</Text>
              <View style={styles.pickerWrap}>
                <Picker selectedValue={cardTeam} onValueChange={(v) => setCardTeam(String(v) as TeamSide)} dropdownIconColor="#111">
                  <Picker.Item label={homeName} value="HOME" />
                  <Picker.Item label={awayName} value="AWAY" />
                </Picker>
              </View>

              <Text style={styles.label}>Minuto</Text>
              <TextInput style={[styles.input]} value={String(currentMinutePlusOne())} editable={false} />
              <Text style={styles.help}>Il minuto viene calcolato al salvataggio usando il cronometro corrente.</Text>

              {isOurTeam(cardTeam) ? (
                <>
                  <Text style={styles.label}>Giocatore (Ellera — convocati (in campo o panchina))</Text>
                  <View style={styles.pickerWrap}>
                    <Picker selectedValue={cardPlayerId} onValueChange={(v) => setCardPlayerId(String(v))} dropdownIconColor="#111">
                      <Picker.Item label="— Seleziona giocatore —" value="" />
                      {allPlayers.map(p => (<Picker.Item key={'C_' + p.id} label={p.name} value={p.id} />))}
                    </Picker>
                  </View>
                </>
              ) : (
                <>
                  <Text style={styles.label}>Giocatore (avversario)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Es. Rossi"
                    value={cardOpponentName}
                    onChangeText={setCardOpponentName}
                  />
                </>
              )}

              <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
                <Pressable
                  style={[styles.modalBtn, { backgroundColor: cardColor === 'RED' ? '#b91c1c' : '#f59e0b', flex: 1, opacity: (canSaveCard && !savingEvent) ? 1 : 0.5 }]}
                  onPress={readOnly ? proposeCardNow : persistCard}
                  disabled={!canSaveCard || savingEvent}
                >
                  <Text style={styles.modalBtnText}>{savingEvent ? 'Salvataggio…' : (readOnly ? 'Proponi' : 'Salva')}</Text>
                </Pressable>
                <Pressable style={[styles.modalBtn, { backgroundColor: '#9ca3af', flex: 1 }]} onPress={() => setCardOpen(false)}>
                  <Text style={styles.modalBtnText}>Annulla</Text>
                </Pressable>
              </View>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* MODALE: conferma cancellazione evento */}
        <Modal visible={del.open} transparent animationType="fade" onRequestClose={cancelDelete}>
          <View style={styles.overlay}>
            <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}>
              <Text style={styles.modalTitle}>{del.title || 'Conferma eliminazione'}</Text>
              {!!del.detail && <Text style={{ marginTop: 6 }}>{del.detail}</Text>}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
                <Pressable style={[styles.modalBtn, { backgroundColor: '#9ca3af', flex: 1 }]} onPress={cancelDelete}>
                  <Text style={styles.modalBtnText}>Annulla</Text>
                </Pressable>
                <Pressable
                  style={[styles.modalBtn, { backgroundColor: '#b91c1c', flex: 1 }]}
                  onPress={confirmDelete}
                >
                  <Text style={styles.modalBtnText}>Elimina</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {/* ============ MODALI EDIT ============ */}

        {/* EDIT GOL */}
        <Modal visible={editGoalOpen} transparent animationType="slide" onRequestClose={() => setEditGoalOpen(false)}>
          <View style={styles.overlay}>
            <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}>
              <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>Modifica gol — {editGoalTeam === 'HOME' ? homeName : awayName}</Text>

              <Text style={styles.label}>Minuto</Text>
              <TextInput
                style={styles.input}
                value={String(editGoalMinute)}
                onChangeText={(t) => setEditGoalMinute(Math.max(1, parseInt(t || '1', 10)))}
                keyboardType="number-pad"
              />

              {isOurTeam(editGoalTeam) ? (
                <>
                  <Text style={styles.label}>Autore (Ellera — convocati (in campo o panchina))</Text>
                  <View style={styles.pickerWrap}>
                    <Picker selectedValue={editGoalPlayerId} onValueChange={(v) => setEditGoalPlayerId(String(v))} dropdownIconColor="#111">
                      <Picker.Item label="— Scegli marcatore —" value="" />
                      {allPlayers.map(p => (<Picker.Item key={'EG_' + p.id} label={p.name} value={p.id} />))}
                    </Picker>
                  </View>
                </>
              ) : (
                <>
                  <Text style={styles.label}>Autore (avversario)</Text>
                  <TextInput style={styles.input} value={editGoalOpponentName} onChangeText={setEditGoalOpponentName} placeholder="Es. Rossi" />
                </>
              )}

              <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
                <Pressable
                  style={[styles.modalBtn, { backgroundColor: '#1b7f3b', flex: 1, opacity: canSaveEditGoal ? 1 : 0.5 }]}
                  onPress={persistEditGoal}
                  disabled={!canSaveEditGoal}
                >
                  <Text style={styles.modalBtnText}>Salva modifiche</Text>
                </Pressable>
                <Pressable style={[styles.modalBtn, { backgroundColor: '#9ca3af', flex: 1 }]} onPress={() => setEditGoalOpen(false)}>
                  <Text style={styles.modalBtnText}>Annulla</Text>
                </Pressable>
              </View>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* EDIT SOSTITUZIONE (solo minuto) */}
        <Modal visible={editSubOpen} transparent animationType="slide" onRequestClose={() => setEditSubOpen(false)}>
          <View style={styles.overlay}>
            <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}>
              <Text style={styles.modalTitle}>Modifica sostituzione</Text>

              <Text style={styles.label}>Minuto</Text>
              <TextInput
                style={styles.input}
                value={String(editSubMinute)}
                onChangeText={(t) => setEditSubMinute(Math.max(1, parseInt(t || '1', 10)))}
                keyboardType="number-pad"
              />

              <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
                <Pressable
                  style={[styles.modalBtn, { backgroundColor: '#f59e0b', flex: 1 }]}
                  onPress={persistEditSub}
                >
                  <Text style={styles.modalBtnText}>Salva modifiche</Text>
                </Pressable>
                <Pressable style={[styles.modalBtn, { backgroundColor: '#9ca3af', flex: 1 }]} onPress={() => setEditSubOpen(false)}>
                  <Text style={styles.modalBtnText}>Annulla</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {/* EDIT CARTELLINO (minuto + giocatore) */}
        <Modal visible={editCardOpen} transparent animationType="slide" onRequestClose={() => setEditCardOpen(false)}>
          <View style={styles.overlay}>
            <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}>
              <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>
                Modifica cartellino {editCardColor === 'RED' ? 'rosso' : 'giallo'}
              </Text>

              <Text style={styles.label}>Squadra</Text>
              <View style={styles.readonlyBox}>
                <Text style={{ fontWeight: '800' }}>{editCardTeam === 'HOME' ? homeName : awayName}</Text>
              </View>

              <Text style={styles.label}>Minuto</Text>
              <TextInput
                style={styles.input}
                value={String(editCardMinute)}
                onChangeText={(t) => setEditCardMinute(Math.max(1, parseInt(t || '1', 10)))}
                keyboardType="number-pad"
              />

              {isOurTeam(editCardTeam) ? (
                <>
                  <Text style={styles.label}>Giocatore (Ellera — convocati (in campo o panchina))</Text>
                  <View style={styles.pickerWrap}>
                    <Picker selectedValue={editCardPlayerId} onValueChange={(v) => setEditCardPlayerId(String(v))} dropdownIconColor="#111">
                      <Picker.Item label="— Seleziona giocatore —" value="" />
                      {allPlayers.map(p => (<Picker.Item key={'EC_' + p.id} label={p.name} value={p.id} />))}
                    </Picker>
                  </View>
                </>
              ) : (
                <>
                  <Text style={styles.label}>Giocatore (avversario)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Es. Rossi"
                    value={editCardOpponentName}
                    onChangeText={setEditCardOpponentName}
                  />
                </>
              )}

              <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
                <Pressable
                  style={[styles.modalBtn, { backgroundColor: editCardColor === 'RED' ? '#b91c1c' : '#f59e0b', flex: 1, opacity: canSaveEditCard ? 1 : 0.5 }]}
                  onPress={persistEditCard}
                  disabled={!canSaveEditCard}
                >
                  <Text style={styles.modalBtnText}>Salva modifiche</Text>
                </Pressable>
                <Pressable style={[styles.modalBtn, { backgroundColor: '#9ca3af', flex: 1 }]} onPress={() => setEditCardOpen(false)}>
                  <Text style={styles.modalBtnText}>Annulla</Text>
                </Pressable>
              </View>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* MODALE: termina partita */}
        <Modal visible={finishOpen} transparent animationType="fade" onRequestClose={() => !finishBusy && setFinishOpen(false)}>
          <View style={styles.overlay}>
            <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}>
              <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>Terminare la partita?</Text>
              <Text style={{ marginTop: 6 }}>
                Salverò il risultato:<Text style={{ fontWeight: '900' }}> {homeName} {scoreHome} - {scoreAway} {awayName}</Text>
              </Text>

              <Text style={[styles.label, { marginTop: 14 }]}>Durata partita (minuti)</Text>
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                value={matchDurationInput}
                onChangeText={setMatchDurationInput}
                placeholder="90"
              />
              <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                Usata per calcolare i minuti giocati di chi non è stato sostituito — cambiala se la
                partita è durata meno di 90' (es. nessuno ha seguito il cronometro dal vivo).
              </Text>

              {!!finishError && <Text style={{ color: '#b91c1c', marginTop: 8 }}>{finishError}</Text>}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
                <Pressable
                  style={[styles.modalBtn, { backgroundColor: '#9ca3af', flex: 1, opacity: finishBusy ? 0.6 : 1 }]}
                  onPress={() => setFinishOpen(false)}
                  disabled={finishBusy}
                >
                  <Text style={styles.modalBtnText}>Annulla</Text>
                </Pressable>
                <Pressable
                  style={[styles.modalBtn, { backgroundColor: '#b91c1c', flex: 1, opacity: finishBusy ? 0.6 : 1 }]}
                  onPress={finalizeMatchAndSave}
                  disabled={finishBusy}
                >
                  <Text style={styles.modalBtnText}>Conferma</Text>
                </Pressable>
              </View>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* ===== MODALE: INSERIMENTO MANUALE EVENTO ===== */}
        <Modal visible={manualOpen} transparent animationType="slide" onRequestClose={() => setManualOpen(false)}>
          <View style={styles.overlay}>
            <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}>
              <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>Nuovo evento (manuale)</Text>

              <Text style={styles.label}>Tipo</Text>
              <View style={styles.pickerWrap}>
                <Picker selectedValue={manualKind} onValueChange={(v) => setManualKind(String(v) as ManualKind)} dropdownIconColor="#111">
                  <Picker.Item label="Gol" value="GOAL" />
                  <Picker.Item label="Sostituzione" value="SUB" />
                  <Picker.Item label="Giallo" value="CARD_YELLOW" />
                  <Picker.Item label="Rosso" value="CARD_RED" />
                </Picker>
              </View>

              <Text style={styles.label}>Squadra</Text>
              <View style={styles.pickerWrap}>
                <Picker selectedValue={manualTeam} onValueChange={(v) => setManualTeam(String(v) as TeamSide)} dropdownIconColor="#111">
                  <Picker.Item label={homeName} value="HOME" />
                  <Picker.Item label={awayName} value="AWAY" />
                </Picker>
              </View>

              <Text style={styles.label}>Minuto</Text>
              <TextInput
                style={styles.input}
                value={String(manualMinute)}
                onChangeText={(t) => setManualMinute(Math.max(1, parseInt(t || '1', 10)))}
                keyboardType="number-pad"
              />

              {/* Campi dinamici */}
              {manualKind === 'GOAL' && (
                isManualOurTeam ? (
                  <>
                    <Text style={styles.label}>Autore (Ellera — CONVOCATI)</Text>
                    <View style={styles.pickerWrap}>
                      <Picker selectedValue={manualGoalPlayerId} onValueChange={(v) => setManualGoalPlayerId(String(v))} dropdownIconColor="#111">
                        <Picker.Item label="— Seleziona marcatore —" value="" />
                        {manualPlayers.map(p => (<Picker.Item key={'MG_' + p.id} label={p.name} value={p.id} />))}
                      </Picker>
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={styles.label}>Autore (avversario)</Text>
                    <TextInput style={styles.input} placeholder="Es. Rossi" value={manualGoalOpponent} onChangeText={setManualGoalOpponent} />
                  </>
                )
              )}

              {manualKind === 'SUB' && (
                isManualOurTeam ? (
                <>
                  <Text style={styles.help}>La sostituzione verrà applicata anche alla formazione live.</Text>
                  <Text style={styles.label}>Esce</Text>
                  <View style={styles.pickerWrap}>
                    <Picker selectedValue={manualSubOutId} onValueChange={(v) => setManualSubOutId(String(v))} dropdownIconColor="#111">
                      <Picker.Item label="— Seleziona —" value="" />
                      {manualPlayers.map(p => (<Picker.Item key={'MSO_' + p.id} label={p.name + (p.inField ? ' (in campo)' : '')} value={p.id} />))}
                    </Picker>
                  </View>

                  <Text style={styles.label}>Entra</Text>
                  <View style={styles.pickerWrap}>
                    <Picker selectedValue={manualSubInId} onValueChange={(v) => setManualSubInId(String(v))} dropdownIconColor="#111">
                      <Picker.Item label="— Seleziona —" value="" />
                      {manualPlayers.map(p => (<Picker.Item key={'MSI_' + p.id} label={p.name + (!p.inField ? ' (panchina)' : '')} value={p.id} />))}
                    </Picker>
                  </View>
                </>
                ) : (
                <>
                  <Text style={styles.label}>Esce (avversario)</Text>
                  <TextInput style={styles.input} placeholder="Es. Rossi" value={manualSubOutId} onChangeText={setManualSubOutId} />

                  <Text style={styles.label}>Entra (avversario)</Text>
                  <TextInput style={styles.input} placeholder="Es. Bianchi" value={manualSubInId} onChangeText={setManualSubInId} />
                </>
                )
              )}

              {(manualKind === 'CARD_YELLOW' || manualKind === 'CARD_RED') && (
                isManualOurTeam ? (
                  <>
                    <Text style={styles.label}>Giocatore (Ellera — CONVOCATI)</Text>
                    <View style={styles.pickerWrap}>
                      <Picker selectedValue={manualCardPlayerId} onValueChange={(v) => setManualCardPlayerId(String(v))} dropdownIconColor="#111">
                        <Picker.Item label="— Seleziona giocatore —" value="" />
                        {manualPlayers.map(p => (<Picker.Item key={'MC_' + p.id} label={p.name} value={p.id} />))}
                      </Picker>
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={styles.label}>Giocatore (avversario)</Text>
                    <TextInput style={styles.input} placeholder="Es. Rossi" value={manualCardOpponent} onChangeText={setManualCardOpponent} />
                  </>
                )
              )}

              <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
                <Pressable
                  style={[styles.modalBtn, { backgroundColor: '#111827', flex: 1, opacity: (canSaveManual && !savingEvent) ? 1 : 0.5 }]}
                  onPress={persistManual}
                  disabled={!canSaveManual || savingEvent}
                >
                  <Text style={styles.modalBtnText}>{savingEvent ? 'Salvataggio…' : 'Aggiungi evento'}</Text>
                </Pressable>
                <Pressable style={[styles.modalBtn, { backgroundColor: '#9ca3af', flex: 1 }]} onPress={() => setManualOpen(false)}>
                  <Text style={styles.modalBtnText}>Annulla</Text>
                </Pressable>
              </View>
              </ScrollView>
            </View>
          </View>
        </Modal>

        <ConvocatiPlayersModal
          visible={convocatiModalOpen}
          players={basePlayers}
          selectedIds={convocatiPlayerIds}
          onClose={() => setConvocatiModalOpen(false)}
          onConfirm={handleConfirmConvocati}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

/* ---------------- STILI ---------------- */
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f1f5f9' },
  container: { flex: 1, backgroundColor: '#f1f5f9' },

  backBtn: {
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8,
    borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff',
  },
  backBtnTxt: { fontSize: 14, fontWeight: '800', color: '#111' },

  scoreBoard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    marginHorizontal: 16
  },
  teamSection: {
    flex: 1,
    alignItems: 'center',
  },
  ourTeam: {
    backgroundColor: 'transparent',
  },
  teamCrest: {
    width: 56,
    height: 56,
    marginBottom: 4,
  },
  teamCrestPlaceholder: {
    width: 56,
    height: 56,
    marginBottom: 4,
    borderRadius: 8,
    backgroundColor: '#e5e7eb',
  },
  teamName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  teamScore: {
    fontSize: 42,
    fontWeight: '900',
    color: '#0f172a',
  },
  ourScore: {
    color: '#065f46',
  },
  timerSection: {
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  timerDisplay: {
    fontSize: 36,
    fontWeight: '800',
    color: '#0f172a',
  },
  phaseIndicator: {
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: '#e5e7eb',
    borderRadius: 999,
  },
  phaseText: {
    fontSize: 12,
    color: '#111827',
    fontWeight: '700',
  },
  matchStatus: {
    marginTop: 6,
    fontSize: 12,
    color: '#374151',
  },

  timerControls: {
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: 16,
  },
  durationLink: {
    marginHorizontal: 16,
    marginTop: 8,
    alignItems: 'center',
  },
  durationLinkText: {
    fontSize: 12,
    color: '#6b7280',
    textDecorationLine: 'underline',
  },
  controlButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
  },
  controlButtonIcon: {
    fontSize: 16,
  },
  controlButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: 'white',
  },
  primaryButton: {
    backgroundColor: '#111827',
  },
  secondaryButton: {
    backgroundColor: '#4b5563',
  },
  phaseButton: {
    backgroundColor: '#1f2937',
  },

  actionCards: {
    marginTop: 16,
    marginHorizontal: 16,
    gap: 12,
  },
  goalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  managementActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  actionIcon: {
    fontSize: 24,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '900',
    marginTop: 6,
    color: '#0f172a',
  },
  actionSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  goalCard: {
    backgroundColor: '#dcfce7',
  },
  homeGoalCard: {},
  awayGoalCard: {},
  formationCard: {
    backgroundColor: '#e0f2fe',
  },
  subCard: {
    backgroundColor: '#fef3c7',
  },
  tacticsCard: {
    backgroundColor: '#ede9fe',
  },
  convocazioneCard: {
    backgroundColor: '#dcfce7',
  },
  yellowCard: {
    backgroundColor: '#fef9c3',
  },
  redCard: {
    backgroundColor: '#fee2e2',
  },

  eventsSection: {
    marginTop: 18,
    marginHorizontal: 16,
  },
  eventsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  eventsTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
  },
  eventsCount: {
    fontSize: 12,
    color: '#6b7280',
  },
  iconOnlyBtn: {
    backgroundColor: 'white',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },

  emptyEvents: {
    backgroundColor: 'white',
    borderRadius: 16,
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyEventsIcon: {
    fontSize: 28,
  },
  emptyEventsTitle: {
    fontSize: 14,
    fontWeight: '900',
    marginTop: 6,
  },
  emptyEventsSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },

  eventsList: {
    gap: 8,
  },
  eventCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  ourEventCard: {
    borderColor: '#a7f3d0',
    backgroundColor: '#ecfdf5',
  },
  eventBadge: {
    width: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    paddingVertical: 6,
  },
  goalBadge: {
    backgroundColor: '#dcfce7',
  },
  subBadge: {
    backgroundColor: '#fef3c7',
  },
  eventBadgeIcon: {
    fontSize: 16,
  },
  eventBadgeText: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '800',
    color: '#111827',
  },
  eventContent: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0f172a',
  },
  eventPlayer: {
    marginTop: 2,
    fontSize: 14,
  },
  eventTeam: {
    marginTop: 2,
    fontSize: 12,
    color: '#6b7280',
  },

  editEventBtn: {
    padding: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
  },
  editEventIcon: {
    fontSize: 14,
  },
  deleteEventBtn: {
    padding: 8,
    backgroundColor: '#fee2e2',
    borderRadius: 10,
  },
  deleteEventIcon: {
    fontSize: 14,
  },

  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  sheet: {
    width: '100%',
    maxHeight: '85%',
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
  },
  label: {
    marginTop: 12,
    fontSize: 12,
    fontWeight: '800',
    color: '#111827',
  },
  input: {
    marginTop: 6,
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  help: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 6,
  },
  pickerWrap: {
    marginTop: 6,
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    overflow: 'hidden',
  },
  modalBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnText: {
    color: 'white',
    fontWeight: '900',
  },
   eventSubDetails: {
    fontSize: 13,
    marginBottom: 2
  },
  eventPlayerOut: {
    color: '#dc2626',
    fontWeight: '600'
  },
  eventPlayerIn: {
    color: '#16a34a',
    fontWeight: '600'
  },
    readonlyBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: '#e2e8f0'
  },
});