// app/squadra/statistiche.tsx
import { useAuth } from '@/app/context/AuthContext';
import { CalendarEvent, loadEvents } from '@/app/data/events';
import { loadLineup } from '@/app/data/matchLive';
import { loadPhotoMap } from '@/app/data/playerMedia';
import { usePlayers } from '@/app/hooks/usePlayers';
import { printOrShareHtml, saveOrShareFile } from '@/app/utils/webExport';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';


// Dimension constants
const LEFT_COL_WIDTH = 280;
const CELL_W = 70;

type TeamSide = 'HOME' | 'AWAY';
type SavedGoal = {
  id: string;
  team: TeamSide;
  minute: number;
  scorer?: string;
  scorerId?: string;
  playerId?: string;
  idPlayer?: string;
  whoId?: string;
  player?: string;
  name?: string;
  who?: string;
};
type SavedSub = { id: string; minute: number; outId: string; outName: string; inId: string; inName: string };
type SavedCard = {
  id?: string;
  minute?: number;
  playerId?: string;
  player?: string;
  idPlayer?: string;
  playerName?: string;
  name?: string;
  who?: string;
  color?: 'YELLOW' | 'RED' | 'SECOND_YELLOW' | string;
  type?: 'Y' | 'R' | '2Y' | string;
};

type MatchLike = CalendarEvent & {
  status?: string;
  goals?: SavedGoal[];
  subs?: SavedSub[];
  opponent?: string;
  avversario?: string;
  isHome?: boolean;
  homeAway?: 'HOME' | 'AWAY';
  resultText?: string;
  cards?: SavedCard[];
  duration?: number;
  matchLength?: number;
  competition?: string; competizione?: string; torneo?: string; league?: string; categoria?: string;
};

type Totals = {
  minutes: number;
  goals: number;
  goalsConceded: number;
  starts: number;
  bench: number;
  notCalled: number;
  subbedOff: number;
  subbedOn: number;
  yellows: number;
  reds: number;
  tr_total: number;
  tr_present: number;
  tr_absent: number;
  tr_inj: number;
  tr_diff: number;
};

const EMPTY: Totals = {
  minutes: 0, goals: 0, goalsConceded: 0, starts: 0, bench: 0, notCalled: 0, subbedOff: 0, subbedOn: 0, yellows: 0, reds: 0,
  tr_total: 0, tr_present: 0, tr_absent: 0, tr_inj: 0, tr_diff: 0,
};

export default function StatisticheSquadra() {
  const { membership } = useAuth();
  const { allPlayers } = usePlayers();
  const [loading, setLoading] = useState(false);
  const [competitions, setCompetitions] = useState<string[]>(['Tutte']);
  const [selected, setSelected] = useState<string>('Tutte');
  const [showTrainings, setShowTrainings] = useState<boolean>(false);
  const [perPlayerTotals, setPerPlayerTotals] = useState<Record<string, Record<string, Totals>>>({});
  const [photos, setPhotos] = useState<Record<string, string | null>>({});

  // Horizontal scroll sync
  const hHeaderRef = useRef<ScrollView>(null);
  const hBodyRef = useRef<ScrollView>(null);
  const hSyncing = useRef<'header' | 'body' | null>(null);

  const onHeaderHScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (hSyncing.current === 'body') return;
    hSyncing.current = 'header';
    hBodyRef.current?.scrollTo({ x: e.nativeEvent.contentOffset.x, animated: false });
    setTimeout(() => { hSyncing.current = null; }, 0);
  };

  const onBodyHScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (hSyncing.current === 'header') return;
    hSyncing.current = 'body';
    hHeaderRef.current?.scrollTo({ x: e.nativeEvent.contentOffset.x, animated: false });
    setTimeout(() => { hSyncing.current = null; }, 0);
  };

  // === sticky first column (sincronizzazione scroll verticale) ===
  const leftRef = useRef<ScrollView>(null);
  const rightRef = useRef<ScrollView>(null);
  
const vSyncing = useRef<'left' | 'right' | null>(null);

const onLeftScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
  if (vSyncing.current === 'right') return;
  vSyncing.current = 'left';
  rightRef.current?.scrollTo({ y: e.nativeEvent.contentOffset.y, animated: false });
  setTimeout(() => { vSyncing.current = null; }, 0);
};

const onRightScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
  if (vSyncing.current === 'left') return;
  vSyncing.current = 'right';
  leftRef.current?.scrollTo({ y: e.nativeEvent.contentOffset.y, animated: false });
  setTimeout(() => { vSyncing.current = null; }, 0);
};


  const activeCompetition = selected === 'Tutte' ? undefined : selected;

  const recompute = useCallback(async () => {
    setLoading(true);
    try {
      const [list, photoMap] = await Promise.all([
        loadEvents() as Promise<MatchLike[]>,
        loadPhotoMap(),
      ]);

      setPhotos(photoMap);

      // === PARTITE ===
      const finished = list
        .filter(ev => ev.type === 'PARTITA' && ev.status === 'FINISHED')
        .sort((a, b) => `${a.date} ${a.time || '00:00'}`.localeCompare(`${b.date} ${b.time || '00:00'}`));

      // competizioni disponibili
      const compSet = new Set<string>();

      // precarico lineup
      const lineupMap: Record<string, { field?: (string|null)[]; bench?: string[] } | null> = {};
      for (const ev of finished) {
        try {
          lineupMap[`${ev.id}`] = await loadLineup(`${ev.id}`);
        } catch {
          lineupMap[`${ev.id}`] = null;
        }
      }

      // Accumulatore
      const acc: Record<string, Record<string, Totals>> = {};
      const allCompKey = '__ALL__';

      // helper match per gol/cartellini
      const matchByIdOrName = (targetId: string, targetName: string | undefined, opts: any) => {
        const idCandidate =
          opts.scorerId || opts.playerId || opts.idPlayer || opts.whoId || opts.player_id || null;
        const nameCandidate =
          opts.scorer || opts.player || opts.playerName || opts.name || opts.who || null;
        return (idCandidate && idCandidate === targetId) || (nameCandidate && nameCandidate === targetName);
      };

      for (const ev of finished) {
        const comp = (ev.competition ?? ev.competizione ?? ev.torneo ?? ev.league ?? ev.categoria ?? '').toString().trim() || '—';
        compSet.add(comp);

        const goals = ev.goals || [];
        const subs  = ev.subs  || [];
        const cards = (ev as any).cards as SavedCard[] | undefined;
        const lu = lineupMap[`${ev.id}`];
        const field = (lu?.field || []).filter(Boolean) as string[];
        const bench = (lu?.bench || []) as string[];

        // Durata reale match
        const inferredMaxMinute = Math.max(
          0,
          ...goals.map(g => g.minute || 0),
          ...subs.map(s => s.minute || 0),
          ...(Array.isArray(cards) ? cards.map(c => c.minute || 0) : []),
        );
        const FULL = Math.max(90, ev.duration || ev.matchLength || inferredMaxMinute || 90);

        const isHome = typeof ev.isHome === 'boolean' ? ev.isHome : (ev.homeAway === 'HOME');
        const opponentTeam: TeamSide = isHome ? 'AWAY' : 'HOME';

        // per ogni giocatore
        for (const p of allPlayers) {
          const id = p.id;
          const name = p.name;

          let started = field.includes(id);
          if (!lu) {
            // fallback (come in PlayerDetail)
            const hasOut = subs.some(s => s.outId === id);
            const hasIn  = subs.some(s => s.inId === id);
            started = hasOut && !hasIn;
          }

          const subOnMin  = (() => { const xs = subs.filter(s => s.inId === id).map(s => s.minute); return xs.length ? Math.min(...xs) : null; })();
          const subOffMin = (() => { const xs = subs.filter(s => s.outId === id).map(s => s.minute); return xs.length ? Math.min(...xs) : null; })();

          // minuti effettivi
          let minutes = 0;
          let onFieldFrom: number | null = null;
          let onFieldTo: number | null = null;
          if (started) {
            onFieldFrom = 0;
            onFieldTo = (subOffMin != null ? subOffMin : FULL);
            minutes = Math.max(0, onFieldTo - onFieldFrom);
          } else if (subOnMin != null) {
            onFieldFrom = subOnMin;
            onFieldTo = (subOffMin != null ? subOffMin : FULL);
            minutes = Math.max(0, onFieldTo - onFieldFrom);
          }

          const subbedOn = subOnMin != null ? 1 : 0;
          const subbedOff = started && subOffMin != null ? 1 : 0;

          // panchina/non convocato valutati solo se abbiamo una lineup
          const wasOnBench = !!lu && bench.includes(id) && !subOnMin;
          const notCalled = !!lu && !field.includes(id) && !bench.includes(id) ? 1 : 0;

          // === GOL: match robusto su id o nome ===
          const goalsHere = goals.filter(g => matchByIdOrName(id, name, g)).length;

          // cartellini
          let yellows = 0; let reds = 0;
          if (Array.isArray(cards)) {
            for (const c of cards) {
              const matchThisPlayer = matchByIdOrName(id, name, c);
              if (!matchThisPlayer) continue;
              const norm = (c.color || c.type || '').toString().toUpperCase();
              if (norm.includes('RED') || norm === 'R' || norm === 'ROSSO') { reds += 1; }
              else if (norm.includes('SECOND') || norm === '2Y') { yellows += 1; reds += 1; }
              else if (norm.includes('YELLOW') || norm === 'Y' || norm === 'GIALLO' || norm === 'AMMONIZIONE') { yellows += 1; }
            }
          }

          // Gol subiti per portiere (solo mentre è in campo)
          let conceded = 0;
          if (p.role === 'PORTIERE' && onFieldFrom != null && onFieldTo != null) {
            for (const g of goals) {
              const m = g.minute ?? 0;
              if (g.team === opponentTeam && m >= onFieldFrom && m < onFieldTo) conceded += 1;
            }
          }

          // Aggiorna accumulatori
          const ensure = (pid: string, key: string) => {
            acc[pid] = acc[pid] || {};
            acc[pid][key] = acc[pid][key] || { ...EMPTY };
            return acc[pid][key];
          };

          const add = (t: Totals) => (src: Partial<Totals>) => ({
            ...t,
            minutes: t.minutes + (src.minutes || 0),
            goals: t.goals + (src.goals || 0),
            goalsConceded: t.goalsConceded + (src.goalsConceded || 0),
            starts: t.starts + (src.starts || 0),
            bench: t.bench + (src.bench || 0),
            notCalled: t.notCalled + (src.notCalled || 0),
            subbedOff: t.subbedOff + (src.subbedOff || 0),
            subbedOn: t.subbedOn + (src.subbedOn || 0),
            yellows: t.yellows + (src.yellows || 0),
            reds: t.reds + (src.reds || 0),
            tr_total: t.tr_total + (src.tr_total || 0),
            tr_present: t.tr_present + (src.tr_present || 0),
            tr_absent: t.tr_absent + (src.tr_absent || 0),
            tr_inj: t.tr_inj + (src.tr_inj || 0),
            tr_diff: t.tr_diff + (src.tr_diff || 0),
          });

          const delta: Partial<Totals> = {
            minutes,
            goals: goalsHere,
            goalsConceded: conceded,
            starts: started ? 1 : 0,
            bench: wasOnBench ? 1 : 0,
            notCalled,
            subbedOff,
            subbedOn,
            yellows,
            reds,
          };

          const curComp = ensure(id, comp);
          acc[id][comp] = add(curComp)(delta);

          const curAll = ensure(id, allCompKey);
          acc[id][allCompKey] = add(curAll)(delta);
        }
      }

      // === ALLENAMENTI ===
      const trainings = list
        .filter(ev => ev.type === 'ALLENAMENTO')
        .sort((a, b) => `${a.date} ${a.time || '00:00'}`.localeCompare(`${b.date} ${b.time || '00:00'}`));

      for (const ev of trainings) {
        for (const p of allPlayers) {
          const id = p.id;
          const s = (ev as any).presenze?.[id];
          let status: 'presente' | 'assente' | 'infortunato' | 'differenziato' | undefined;
          if (typeof s === 'boolean') status = s ? 'presente' : 'assente'; else status = s;

          const ensure = (pid: string, key: string) => {
            acc[pid] = acc[pid] || {};
            acc[pid]['__ALL__'] = acc[pid]['__ALL__'] || { ...EMPTY };
            return acc[pid]['__ALL__'];
          };
          const cur = ensure(id, '__ALL__');
          const next: Partial<Totals> = { tr_total: cur.tr_total + 1 };
          if (status === 'presente') next.tr_present = cur.tr_present + 1;
          else if (status === 'assente') next.tr_absent = cur.tr_absent + 1;
          else if (status === 'infortunato') next.tr_inj = cur.tr_inj + 1;
          else if (status === 'differenziato') next.tr_diff = cur.tr_diff + 1;
          acc[id]['__ALL__'] = { ...cur, ...next };
        }
      }

      setPerPlayerTotals(acc);
      setCompetitions(['Tutte', ...Array.from(compSet).sort()]);
    } catch (e) {
      console.warn('Errore calcolo statistiche squadra', e);
      setPerPlayerTotals({});
      setCompetitions(['Tutte']);
    } finally {
      setLoading(false);
    }
  }, [allPlayers]);

  // ricalcola quando si torna sulla schermata
  useFocusEffect(
    useCallback(() => {
      recompute();
    }, [recompute])
  );

  // ======= Ordinamento per minuti (decrescente) =======
  const list = useMemo(() => {
    const key = (activeCompetition ?? '__ALL__');
    return allPlayers.slice().sort((a, b) => {
      const sa = (perPlayerTotals[a.id]?.[key] || EMPTY).minutes;
      const sb = (perPlayerTotals[b.id]?.[key] || EMPTY).minutes;
      return sb - sa;
    });
  }, [perPlayerTotals, activeCompetition]);

  // ======= Export CSV =======
  const shortRole = (role?: string) => {
    if (role === 'PORTIERE') return 'P';
    if (role === 'DIFENSORE') return 'D';
    if (role === 'CENTROCAMPISTA') return 'C';
    if (role === 'ATTACCANTE') return 'A';
    return '';
  };

  // Evidenziatura ammonizioni
  const highlightPolicy = (comp?: string) => {
    if (!comp) return { enabled: false, first: 0, step: 0 };
    const c = comp.toLowerCase().trim();
    if (c.includes('amichevoli')) return { enabled: false, first: 0, step: 0 };
    if (c.includes('coppa'))      return { enabled: true, first: 1, step: 2 };
    return { enabled: true, first: 4, step: 5 };
  };
  const shouldHighlightRow = (yellows: number) => {
    const pol = highlightPolicy(activeCompetition);
    if (!pol.enabled) return false;
    return yellows >= pol.first && ((yellows - pol.first) % pol.step === 0);
  };

  const exportCSV = async () => {
    try {
      const header = [
        'Giocatore',
        'Gol',               // intestazione semplificata
        '🟨','🟥',
        'Min','Titolare','Panchina','Non conv.','Uscito','Entrato',
        ...(showTrainings ? ['All. tot','Pres.','Ass.','Inj','Diff','% Pres'] : [])
      ].join(';');

      const key = (activeCompetition ?? '__ALL__');

      const rows = allPlayers.map(p => {
        const map = perPlayerTotals[p.id] || {};
        const s = map[key] || EMPTY;
        const pct = s.tr_total > 0 ? Math.round((s.tr_present / s.tr_total) * 100) : 0;

        const golUnico = p.role === 'PORTIERE' ? s.goalsConceded : s.goals;

        const base: (string | number)[] = [
          `"${p.name.replace(/"/g, '""')}"`,
          golUnico,
          s.yellows, s.reds,
          s.minutes, s.starts, s.bench, s.notCalled, s.subbedOff, s.subbedOn,
        ];

        if (showTrainings) {
          base.push(s.tr_total, s.tr_present, s.tr_absent, s.tr_inj, s.tr_diff, `${pct}%`);
        }
        return base.join(';');
      });

      const csv = [header, ...rows].join('\n');
      await saveOrShareFile({ content: csv, encoding: 'utf8', filename: 'statistiche.csv', mimeType: 'text/csv' });
    } catch (e) {
      Alert.alert('Errore', 'Impossibile esportare il CSV');
    }
  };

  // ======= Print =======
  const printTable = async () => {
    const esc = (s: any) =>
      String(s ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;');

    const key = (activeCompetition ?? '__ALL__');
    const shouldHL = (y: number) => {
      const pol = highlightPolicy(activeCompetition);
      if (!pol.enabled) return false;
      return y >= pol.first && ((y - pol.first) % pol.step === 0);
    };

    const baseHeaders = [
      'Giocatore',
      'Gol',
      '🟨','🟥',
      'Min','Titolare','Panchina','Non conv.','Uscito','Entrato',
    ];
    const trHeaders = showTrainings ? ['All. tot','Pres.','Ass.','Inj','Diff','% Pres'] : [];
    const headers = [...baseHeaders, ...trHeaders];

    const rowsHtml = allPlayers
      .slice()
      .sort((a, b) => {
        const sa = (perPlayerTotals[a.id]?.[key] || EMPTY).minutes;
        const sb = (perPlayerTotals[b.id]?.[key] || EMPTY).minutes;
        return sb - sa;
      })
      .map(p => {
        const s = (perPlayerTotals[p.id]?.[key] || EMPTY);
        const pct = s.tr_total > 0 ? Math.round((s.tr_present / s.tr_total) * 100) : 0;
        const golUnico = p.role === 'PORTIERE' ? s.goalsConceded : s.goals;

        const base = [
          esc(p.name),
          golUnico,
          s.yellows, s.reds,
          s.minutes, s.starts, s.bench, s.notCalled, s.subbedOff, s.subbedOn,
        ];
        const train = showTrainings ? [s.tr_total, s.tr_present, s.tr_absent, s.tr_inj, s.tr_diff, `${pct}%`] : [];
        const cells = [...base, ...train].map(v => `<td>${esc(v)}</td>`).join('');
        const hlClass = shouldHL(s.yellows) ? ' class="hl"' : '';
        return `<tr${hlClass}>${cells}</tr>`;
      })
      .join('');

    const styles = `
      <style>
        body { font-family: system-ui, Roboto, Arial; }
        table { width: 100%; border-collapse: collapse; }
        thead th, tbody td { border: 1px solid #e5e7eb; padding: 6px; text-align: center; }
        thead th { background: #f1f5f9; }
        tbody td:first-child { text-align: left; font-weight: bold; }
        tbody tr.hl { background: #fff7b3; }
      </style>
    `;

    const html = `
      <html>
        <head>${styles}</head>
        <body>
          <h1>Statistiche squadra</h1>
          <p>Competizione: <strong>${esc(activeCompetition ?? 'Tutte')}</strong></p>
          <table>
            <thead><tr>${headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </body>
      </html>
    `;

    await printOrShareHtml(html);
  };

  // ======= UI =======
  if (membership?.role === 'giocatore') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: '#64748b', textAlign: 'center' }}>Non disponibile per il tuo ruolo.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Statistiche Squadra</Text>
        
        {/* Export Actions */}
        <View style={styles.exportBar}>
          <Pressable onPress={exportCSV} style={styles.exportBtn}>
            <Text style={styles.exportText}>📊 CSV</Text>
          </Pressable>
          <Pressable onPress={printTable} style={styles.exportBtn}>
            <Text style={styles.exportText}>🖨 Stampa</Text>
          </Pressable>
        </View>
      </View>

      {/* Filtri */}
      <View style={styles.filterSection}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterBar}
        >
          {competitions.map(c => {
            const active = c === selected;
            return (
              <Pressable key={c} onPress={() => setSelected(c)} style={[styles.chip, active && styles.chipActive]}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{c}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        
        <Pressable onPress={() => setShowTrainings(v => !v)} style={[styles.toggleBtn, showTrainings && styles.toggleBtnActive]}>
          <Text style={[styles.toggleText, showTrainings && styles.toggleTextActive]}>
            {showTrainings ? '✓ Allenamenti' : 'Allenamenti'}
          </Text>
        </Pressable>
      </View>

      {loading && (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Caricamento statistiche...</Text>
        </View>
      )}

      {!loading && (
        <View style={styles.tableContainer}>
          <View style={styles.tableWrapper}>
            
            {/* Header della tabella */}
            <View style={styles.tableHeader}>
              {/* Header colonna fissa */}
              <View style={styles.fixedHeaderCell}>
                <Text style={styles.headerTitle}>Giocatore</Text>
              </View>
              
              {/* Header colonne scrollabili */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} ref={hHeaderRef} onScroll={onHeaderHScroll}>
                <View style={styles.scrollableHeader}>
                  {/* Gruppo Performance */}
                  <View style={[styles.headerGroup, { width: 140 }]}> {/* 2 celle × 70 = 140 */}
                    <Text style={styles.groupTitle}>Performance</Text>
                    <View style={styles.headerRow}>
                      <View style={styles.headerCell}><Text style={styles.headerText}>Gol</Text></View>
                      <View style={styles.headerCell}><Text style={styles.headerText}>Min</Text></View>
                    </View>
                  </View>
                  
                  {/* Gruppo Disciplina */}
                  <View style={[styles.headerGroup, { width: 140 }]}> {/* 2 celle × 70 = 140 */}
                    <Text style={styles.groupTitle}>Disciplina</Text>
                    <View style={styles.headerRow}>
                      <View style={styles.headerCell}><Text style={styles.headerText}>🟨</Text></View>
                      <View style={styles.headerCell}><Text style={styles.headerText}>🟥</Text></View>
                    </View>
                  </View>
                  
                  {/* Gruppo Impiego */}
                  <View style={[styles.headerGroup, { width: 350 }]}> {/* 5 celle × 70 = 350 */}
                    <Text style={styles.groupTitle}>Impiego</Text>
                    <View style={styles.headerRow}>
                      <View style={styles.headerCell}><Text style={styles.headerText}>Tit</Text></View>
                      <View style={styles.headerCell}><Text style={styles.headerText}>Pan</Text></View>
                      <View style={styles.headerCell}><Text style={styles.headerText}>NC</Text></View>
                      <View style={styles.headerCell}><Text style={styles.headerText}>Ent</Text></View>
                      <View style={styles.headerCell}><Text style={styles.headerText}>Usc</Text></View>
                    </View>
                  </View>
                  
                  {/* Gruppo Allenamenti */}
                  {showTrainings && (
                    <View style={[styles.headerGroup, { width: 280 }]}> {/* 4 celle × 70 = 280 */}
                      <Text style={styles.groupTitle}>Allenamenti</Text>
                      <View style={styles.headerRow}>
                        <View style={styles.headerCell}><Text style={styles.headerText}>Tot</Text></View>
                        <View style={styles.headerCell}><Text style={styles.headerText}>Pre</Text></View>
                        <View style={styles.headerCell}><Text style={styles.headerText}>Ass</Text></View>
                        <View style={styles.headerCell}><Text style={styles.headerText}>%</Text></View>
                      </View>
                    </View>
                  )}
                </View>
              </ScrollView>
            </View>

            {/* Body della tabella */}
            <View style={styles.tableBody}>
              {/* Colonna fissa (giocatori) */}
              <ScrollView
                ref={leftRef}
                onScroll={onLeftScroll}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled={Platform.OS === 'android'}
                style={styles.fixedColumn}
              >
                {list.map((p, index) => {
                  const map = perPlayerTotals[p.id] || {};
                  const key = (activeCompetition ?? '__ALL__');
                  const s = map[key] || EMPTY;
                  const hasPhoto = photos && photos[p.id];
                  const highlight = shouldHighlightRow(s.yellows);
                  
                  return (
                    <View key={p.id} style={[styles.playerRow, highlight && styles.highlightRow, index % 2 === 0 && styles.evenRow]}>
                      <View style={styles.playerContent}>
                        <View style={styles.playerAvatar}>
                          {hasPhoto ? (
                            <Image source={{ uri: photos[p.id]! }} style={styles.avatar} />
                          ) : (
                            <View style={styles.avatarPlaceholder}>
                              <Text style={styles.avatarText}>
                                {p.role === 'PORTIERE' ? '🥅' : p.role === 'DIFENSORE' ? '🛡️' : p.role === 'CENTROCAMPISTA' ? '⚽' : '🎯'}
                              </Text>
                            </View>
                          )}
                        </View>
                        <View style={styles.playerInfo}>
                          <Text style={styles.playerName} numberOfLines={1}>{p.name}</Text>
                          <Text style={styles.playerMeta}>
                            {shortRole(p.role)} • {p.year} • {s.minutes}'
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>

              {/* Colonne scrollabili (dati) */}
              <ScrollView horizontal showsHorizontalScrollIndicator={true} ref={hBodyRef} onScroll={onBodyHScroll}>
                <ScrollView
                  ref={rightRef}
                  onScroll={onRightScroll}
                  scrollEventThrottle={16}
                  showsVerticalScrollIndicator={false}
                  nestedScrollEnabled={Platform.OS === 'android'}
                >
                  {list.map((p, index) => {
                    const map = perPlayerTotals[p.id] || {};
                    const key = (activeCompetition ?? '__ALL__');
                    const s = map[key] || EMPTY;
                    const pct = s.tr_total > 0 ? Math.round((s.tr_present / s.tr_total) * 100) : 0;
                    const highlight = shouldHighlightRow(s.yellows);
                    const golUnico = p.role === 'PORTIERE' ? s.goalsConceded : s.goals;
                    
                    return (
                      <View key={p.id} style={[styles.dataRow, highlight && styles.highlightRow, index % 2 === 0 && styles.evenRow]}>
                        {/* Performance */}
                        <View style={styles.dataGroup}>
                          <Text style={[styles.dataCell, styles.primaryStat]}>{golUnico}</Text>
                          <Text style={styles.dataCell}>{s.minutes}</Text>
                        </View>
                        
                        {/* Disciplina */}
                        <View style={styles.dataGroup}>
                          <Text style={[styles.dataCell, s.yellows > 0 && styles.yellowCard]}>{s.yellows}</Text>
                          <Text style={[styles.dataCell, s.reds > 0 && styles.redCard]}>{s.reds}</Text>
                        </View>
                        
                        {/* Impiego */}
                        <View style={styles.dataGroup}>
                          <Text style={styles.dataCell}>{s.starts}</Text>
                          <Text style={styles.dataCell}>{s.bench}</Text>
                          <Text style={styles.dataCell}>{s.notCalled}</Text>
                          <Text style={styles.dataCell}>{s.subbedOn}</Text>
                          <Text style={styles.dataCell}>{s.subbedOff}</Text>
                        </View>
                        
                        {/* Allenamenti */}
                        {showTrainings && (
                          <View style={styles.dataGroup}>
                            <Text style={styles.dataCell}>{s.tr_total}</Text>
                            <Text style={styles.dataCell}>{s.tr_present}</Text>
                            <Text style={styles.dataCell}>{s.tr_absent}</Text>
                            <Text style={[styles.dataCell, styles.percentStat]}>{pct}%</Text>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </ScrollView>
              </ScrollView>
            </View>
            
            {list.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>📊</Text>
                <Text style={styles.emptyText}>Nessuna statistica disponibile</Text>
              </View>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f8fafc' 
  },
  
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  title: { 
    fontSize: 28, 
    fontWeight: 'bold', 
    color: '#1e293b' 
  },
  exportBar: {
    flexDirection: 'row',
    gap: 8,
  },
  exportBtn: {
    paddingHorizontal: 12, 
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#0ea5e9',
  },
  exportText: { 
    color: '#fff', 
    fontWeight: '600',
    fontSize: 12
  },

  // Filters
  filterSection: {
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 12,
  },
  filterBar: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 8,
  },
  chip: {
    paddingHorizontal: 16, 
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#e5e7eb',
  },
  chipActive: { 
    backgroundColor: '#0ea5e9' 
  },
  chipText: { 
    color: '#111827', 
    fontWeight: '600',
    fontSize: 13
  },
  chipTextActive: { 
    color: '#fff' 
  },
  toggleBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#e5e7eb',
    alignSelf: 'flex-start',
  },
  toggleBtnActive: {
    backgroundColor: '#10b981',
  },
  toggleText: {
    color: '#111827',
    fontWeight: '600',
    fontSize: 13,
  },
  toggleTextActive: {
    color: '#fff',
  },

  // Loading
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    color: '#64748b',
    fontSize: 16,
  },

  // Table
  tableContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  tableWrapper: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
    flex: 1,
  },

  // Table Header
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderBottomWidth: 2,
    borderBottomColor: '#e5e7eb',
  },
  fixedHeaderCell: {
    width: 280, // 🔹 larghezza fissa colonna Giocatore
    padding: 16,
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  scrollableHeader: {
    flexDirection: 'row',
  },
  headerGroup: {
    // Non metto borderRightWidth qui per evitare doppi bordi
  },
  groupTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#64748b',
    textAlign: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#f1f5f9',
  },
  headerRow: {
    flexDirection: 'row',
  },
  headerCell: {
    width: 70, // Aumentato da 60 a 70 per allinearsi meglio con dataCell
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: '#e5e7eb',
  },
  headerText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#374151',
  },

  // Table Body
  tableBody: {
    flexDirection: 'row',
    flex: 1,
  },
 fixedColumn: {
  width: 280, // 🔹 larghezza fissa anche per il body
  backgroundColor: '#fff',
  borderRightWidth: 1,
  borderRightColor: '#e5e7eb',
},
  playerRow: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
    minHeight: 60,
    justifyContent: 'center',
  },
  evenRow: {
    backgroundColor: '#f9fafb',
  },
  highlightRow: {
    backgroundColor: '#fef3c7',
  },
playerContent: {
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: 16,
  paddingVertical: 8,
  width: '100%',   // 🔹 aggiunto per occupare tutta la colonna
},
  playerAvatar: {
    marginRight: 12,
  },
  avatar: { 
    width: 40, 
    height: 40, 
    borderRadius: 20 
  },
  avatarPlaceholder: { 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    backgroundColor: '#e2e8f0', 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  avatarText: {
    fontSize: 16,
  },
  playerInfo: {
  flex: 1,
  minWidth: 0,     // 🔹 aggiunto per evitare overflow del testo
},
  playerName: { 
  fontSize: 14, 
  fontWeight: 'bold', 
  color: '#1e293b',
  marginBottom: 2,
  flexShrink: 1,   // 🔹 aggiunto per evitare che il testo allarghi la colonna
},
  playerMeta: {
    fontSize: 12,
    color: '#64748b',
  },

  // Data rows
  dataRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
    minHeight: 60,
    alignItems: 'center',
  },
  dataGroup: {
    flexDirection: 'row',
    // Rimuovo borderRightWidth per evitare doppi bordi
  },
  dataCell: {
    width: 70, // Aumentato da 60 a 70 per allinearsi con headerCell
    paddingVertical: 8,
    paddingHorizontal: 4,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: '#e5e7eb',
  },
  primaryStat: {
    color: '#0ea5e9',
    fontWeight: 'bold',
  },
  yellowCard: {
    color: '#f59e0b',
    fontWeight: 'bold',
  },
  redCard: {
    color: '#ef4444',
    fontWeight: 'bold',
  },
  percentStat: {
    color: '#10b981',
    fontWeight: 'bold',
  },

  // Empty state
  emptyState: { 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingVertical: 60,
    backgroundColor: '#f9fafb',
  },
  emptyIcon: { 
    fontSize: 48, 
    marginBottom: 12 
  },
  emptyText: { 
    fontSize: 16, 
    fontWeight: '600', 
    color: '#6b7280' 
  },
});
