// app/player/[id].tsx
import { Picker } from '@react-native-picker/picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { CalendarEvent, loadEvents } from '../data/events';
import { createPlayerInvite, loadPlayerInviteStatus } from '../data/invites';
import {
  loadCards as loadCardsRemote,
  loadGoals as loadGoalsRemote,
  loadLineup as loadLineupRemote,
  loadSubs as loadSubsRemote,
} from '../data/matchLive';
import { Player, Role } from '../data/players';
import {
  addAttachment as addAttachmentRemote,
  loadAttachments,
  loadInjuryTypes,
  loadPhotoMap,
  PlayerAttachment,
  removeAttachment as removeAttachmentRemote,
  setInjuryType as setInjuryTypeRemote,
  uploadPlayerPhoto,
} from '../data/playerMedia';
import {
  decidePlayerEdit,
  loadPlayerEditRequests,
  PlayerEditChanges,
  PlayerEditRequest,
  proposePlayerEdit,
} from '../data/playerEdits';
import { usePlayers } from '../hooks/usePlayers';
import DatePickerField from '../components/DatePickerField';

const ROLE_LABELS: Record<Role, string> = {
  PORTIERE: 'Portiere',
  DIFENSORE: 'Difensore',
  CENTROCAMPISTA: 'Centrocampista',
  ATTACCANTE: 'Attaccante',
};

function formatItalianDate(date: string): string {
  const [y, m, d] = date.split('-');
  return `${d}/${m}/${y}`;
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function describeChanges(changes: PlayerEditChanges): string {
  const parts: string[] = [];
  if (changes.role) parts.push(`Ruolo: ${ROLE_LABELS[changes.role]}`);
  if (changes.dob) parts.push(`Data di nascita: ${formatItalianDate(changes.dob)}`);
  if (changes.height) parts.push(`Altezza: ${changes.height}cm`);
  if (changes.weight) parts.push(`Peso: ${changes.weight}kg`);
  return parts.join(' · ') || '—';
}
const LAST_TOUCH_KEY = 'app/lastUpdate/touch';

type TabKey = 'PARTITE' | 'ALLENAMENTI' | 'INFORTUNI' | 'ALLEGATI';
type PresenceStatus = 'presente' | 'assente' | 'infortunato' | 'differenziato';

type InjuryRecord = {
  key: string;
  from: string;
  to: string;
  length: number;
  runs: { status: PresenceStatus; count: number }[];
};

type StoredInjuryTypeMap = Record<string, { type: string }>;

type TeamSide = 'HOME' | 'AWAY';
type SavedGoal = { id: string; team: TeamSide; minute: number; scorer: string };
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

type MatchRow = {
  id: string;
  date: string;
  label: string;
  opponent: string;
  competition?: string;
  started: boolean;
  subOn: boolean;
  subOff: boolean;
  minutes: number;
  goals: number;
  yellowCards: number;
  redCards: number;
  result?: string;
};

function SmallStatCard({ title, value, icon, color }: { title: string; value: string | number; icon?: string; color?: string }) {
  return (
    <View style={[styles.sCard, { borderColor: color || '#cbd5e1' }]}>
      {!!icon && <Text style={styles.sCardIcon}>{icon}</Text>}
      <Text numberOfLines={1} style={styles.sCardTitle}>{title}</Text>
      <Text numberOfLines={1} style={styles.sCardValue}>{String(value)}</Text>
    </View>
  );
}

export default function PlayerDetail() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const { allPlayers, updatePlayer } = usePlayers();
  const base = allPlayers.find(p => p.id === id) as Player | undefined;
  const playerName = base?.name || '';
  const { membership } = useAuth();
  const isAdmin = membership?.role === 'admin';
  const readOnly = membership?.role === 'giocatore';
  const canEditDirectly = membership?.role === 'admin' || membership?.role === 'staff';
  const isOwnPlayer = membership?.role === 'giocatore' && membership.playerId === id;

  const [tab, setTab] = useState<TabKey>('PARTITE');

  // Dati anagrafici (ruolo/data di nascita/altezza/peso): Admin/Staff modificano diretto,
  // Giocatore propone solo per il proprio giocatore collegato.
  const [editRole, setEditRole] = useState<Role>('CENTROCAMPISTA');
  const [editDob, setEditDob] = useState<string | null>(null);
  const [editHeight, setEditHeight] = useState('');
  const [editWeight, setEditWeight] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [pendingEdit, setPendingEdit] = useState<PlayerEditRequest | null>(null);

  useEffect(() => {
    if (!base) return;
    setEditRole(base.role);
    setEditDob(base.dob ?? null);
    setEditHeight(base.height ?? '');
    setEditWeight(base.weight ?? '');
  }, [base?.id, base?.role, base?.dob, base?.height, base?.weight]);

  const loadPendingEdit = async () => {
    if (!id || !(canEditDirectly || isOwnPlayer)) return;
    try {
      const list = await loadPlayerEditRequests(id);
      setPendingEdit(list.find((r) => r.status === 'pending') ?? null);
    } catch {}
  };

  useEffect(() => { loadPendingEdit(); }, [id, canEditDirectly, isOwnPlayer]);

  const handleSaveEdit = async () => {
    if (!id) return;
    if (!editHeight.trim() || !editWeight.trim() || !editDob) {
      Alert.alert('Dati mancanti', 'Compila ruolo, data di nascita, altezza e peso.');
      return;
    }
    const changes: PlayerEditChanges = {
      role: editRole,
      dob: editDob,
      height: editHeight.trim(),
      weight: editWeight.trim(),
    };
    setEditSaving(true);
    try {
      if (canEditDirectly) {
        await updatePlayer(id, changes);
        Alert.alert('Salvato', 'Dati aggiornati.');
      } else {
        await proposePlayerEdit(id, changes);
        await loadPendingEdit();
        Alert.alert('Proposta inviata', 'In attesa di conferma dello staff.');
      }
    } catch {
      Alert.alert('Errore', 'Impossibile salvare le modifiche.');
    } finally {
      setEditSaving(false);
    }
  };

  const handleApproveEdit = async () => {
    if (!pendingEdit || !id) return;
    try {
      await updatePlayer(id, pendingEdit.changes);
      await decidePlayerEdit(pendingEdit.id, 'approved');
      setPendingEdit(null);
    } catch {
      Alert.alert('Errore', 'Impossibile confermare la modifica.');
    }
  };

  const handleRejectEdit = async () => {
    if (!pendingEdit) return;
    try {
      await decidePlayerEdit(pendingEdit.id, 'rejected');
      setPendingEdit(null);
    } catch {
      Alert.alert('Errore', 'Impossibile rifiutare la modifica.');
    }
  };

  // Codice di accesso (solo admin): collega questo giocatore a un account.
  const [inviteStatus, setInviteStatus] = useState<{ pendingCode: string | null; claimedEmail: string | null } | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);

  const loadInviteStatus = async () => {
    if (!isAdmin || !membership?.orgId || !id) return;
    try {
      setInviteStatus(await loadPlayerInviteStatus(membership.orgId, id));
    } catch {}
  };

  useEffect(() => { loadInviteStatus(); }, [isAdmin, membership?.orgId, id]);

  const handleGenerateInvite = async () => {
    if (!membership?.orgId || !id) return;
    setInviteBusy(true);
    try {
      const code = await createPlayerInvite(membership.orgId, id);
      setInviteStatus({ pendingCode: code, claimedEmail: null });
    } catch (e) {
      Alert.alert('Errore', 'Impossibile generare il codice.');
    } finally {
      setInviteBusy(false);
    }
  };

  const handleShareInvite = async () => {
    if (!inviteStatus?.pendingCode) return;
    try {
      await Share.share({
        message: `Codice personale per collegarti come "${playerName}" su ElleraApp: ${inviteStatus.pendingCode}`,
      });
    } catch {}
  };

  const [photo, setPhoto] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<PlayerAttachment[]>([]);

  const [matches, setMatches] = useState<MatchRow[]>([]);

  const competitions = useMemo(() => {
    const set = new Set(matches.map(m => (m.competition || '').trim()).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [matches]);
  const [compFilter, setCompFilter] = useState<string>('__ALL__');
  const filteredMatches = useMemo(() => compFilter === '__ALL__' ? matches : matches.filter(m => (m.competition || '') === compFilter), [matches, compFilter]);
  
  // Statistiche filtrate per competizione
  const totalMatches = useMemo(() => filteredMatches.length, [filteredMatches]);
  const totalMinutes = useMemo(() => filteredMatches.reduce((s, m) => s + m.minutes, 0), [filteredMatches]);
  const totalGoals = useMemo(() => filteredMatches.reduce((s, m) => s + m.goals, 0), [filteredMatches]);
  const totalYellows = useMemo(() => filteredMatches.reduce((s, m) => s + (m.yellowCards || 0), 0), [filteredMatches]);
  const totalReds = useMemo(() => filteredMatches.reduce((s, m) => s + (m.redCards || 0), 0), [filteredMatches]);

  const [trainings, setTrainings] = useState<{ date: string; status?: PresenceStatus }[]>([]);
  const trainingsTotal = trainings.length;
  const trainingsPresent = trainings.filter(t => t.status === 'presente').length;
  const trainingsAbsent = trainings.filter(t => t.status === 'assente').length;
  const trainingsInj = trainings.filter(t => t.status === 'infortunato').length;
  const trainingsDiff = trainings.filter(t => t.status === 'differenziato').length;
  const trainingsNoReply = trainings.filter(t => !t.status).length;
  const presencePct = useMemo(() => trainingsTotal === 0 ? 0 : Math.round((trainingsPresent / trainingsTotal) * 100), [trainingsPresent, trainingsTotal]);
  const recentTrend = useMemo(() => trainings.slice(-5), [trainings]);

  const monthlySummary = useMemo(() => {
    const map = new Map<string, { present: number; total: number; inj: number; diff: number; abs: number }>();
    for (const t of trainings) {
      const month = (t.date || '').slice(0, 7) || 'N/D';
      const entry = map.get(month) ?? { present: 0, total: 0, inj: 0, diff: 0, abs: 0 };
      entry.total += 1;
      if (t.status === 'presente') entry.present += 1;
      if (t.status === 'infortunato') entry.inj += 1;
      if (t.status === 'differenziato') entry.diff += 1;
      if (t.status === 'assente') entry.abs += 1;
      map.set(month, entry);
    }
    return Array.from(map.entries()).map(([month, v]) => ({ month, ...v })).sort((a, b) => a.month.localeCompare(b.month));
  }, [trainings]);

  const [injuryRecords, setInjuryRecords] = useState<InjuryRecord[]>([]);
  const [injuryTypesMap, setInjuryTypesMap] = useState<StoredInjuryTypeMap>({});

  useEffect(() => {
    navigation.setOptions({ title: base?.name ?? 'Giocatore' });
  }, [navigation, base?.name]);

  // FOTO, ALLEGATI, TIPI INFORTUNIO
  useEffect(() => {
    (async () => {
      if (!id) return;
      try {
        const [photoMap, atts, injTypes] = await Promise.all([
          loadPhotoMap(),
          loadAttachments(id),
          loadInjuryTypes(id),
        ]);
        if (photoMap[id]) setPhoto(photoMap[id]);
        setAttachments(atts);
        setInjuryTypesMap(injTypes);
      } catch (e) {
        console.warn('Errore caricamento dati giocatore', e);
      }
    })();
  }, [id]);

  
  const [lastTouch, setLastTouch] = useState<string>('0');
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const v = (await AsyncStorage.getItem(LAST_TOUCH_KEY)) || '0';
        if (alive) setLastTouch(v);
      } catch {}
    };
    tick();
    const id = setInterval(tick, 1500);
    return () => { alive = false; clearInterval(id); };
  }, []);
// === PARTITE: carica e calcola minuti/gol/cartellini ===
  useEffect(() => {
    (async () => {
      if (!id || !playerName) { setMatches([]); return; }
      try {
        const list: (CalendarEvent & {
          status?: string;
          goals?: SavedGoal[];
          subs?: SavedSub[];
          opponent?: string;
          avversario?: string;
          isHome?: boolean;
          homeAway?: 'HOME'|'AWAY';
          resultText?: string;
          cards?: SavedCard[];
          competition?: string; competizione?: string; torneo?: string; league?: string; categoria?: string;
        })[] = await loadEvents();

        const finished = list
          .filter(ev => ev.type === 'PARTITA' && ev.status === 'FINISHED')
          .sort((a, b) => `${a.date} ${a.time || '00:00'}`.localeCompare(`${b.date} ${b.time || '00:00'}`));

        const rows: MatchRow[] = [];
        for (const ev of finished) {
          const matchId = `${ev.id}`;
          
          const [liveGoals, liveSubs, liveCards] = await Promise.all([
            loadGoalsRemote(matchId),
            loadSubsRemote(matchId),
            loadCardsRemote(matchId),
          ]);
          const goals = liveGoals.length > 0 ? liveGoals as SavedGoal[] : (ev.goals || []);
          const subs  = liveSubs.length > 0  ? liveSubs  as SavedSub[]  : (ev.subs  || []);
          const cards = liveCards.length > 0 ? liveCards as SavedCard[] : ((ev as any).cards as SavedCard[] | undefined);

          // titolare?
          let started = false;
          try {
            const lu = await loadLineupRemote(matchId);
            if (lu) {
              const fieldIds = (lu.field || []).filter(Boolean) as string[];
              started = fieldIds.includes(id);
            }
          } catch {
            const hasOut = subs.some(s => s.outId === id);
            const hasIn  = subs.some(s => s.inId === id);
            started = hasOut && !hasIn;
          }

          // minuti
          const FULL = 90;
          const subOnMin  = (() => {
            const xs = subs.filter(s => s.inId === id).map(s => s.minute);
            return xs.length ? Math.min(...xs) : null;
          })();
          const subOffMin = (() => {
            const xs = subs.filter(s => s.outId === id).map(s => s.minute);
            return xs.length ? Math.min(...xs) : null;
          })();

          let minutes = 0;
          if (started) {
            minutes = subOffMin != null ? subOffMin : FULL;
          } else if (subOnMin != null) {
            minutes = subOffMin != null ? Math.max(0, subOffMin - subOnMin) : Math.max(0, FULL - subOnMin);
          }

          const goalsHere = goals.filter(g => g.scorer === playerName).length;

          // cartellini
          let yellows = 0; let reds = 0;
          if (Array.isArray(cards)) {
            for (const c of cards) {
              const pid = (c.playerId || c.player || c.idPlayer) as string | undefined;
              const pname = (c.playerName || c.name || c.who) as string | undefined;
              const matchThisPlayer = (pid && pid === id) || (!!pname && pname === playerName);
              if (!matchThisPlayer) continue;
              const norm = (c.color || c.type || '').toString().toUpperCase();
              if (norm.includes('RED') || norm === 'R' || norm === 'ROSSO') { reds += 1; }
              else if (norm.includes('SECOND') || norm === '2Y') { yellows += 1; reds += 1; }
              else if (norm.includes('YELLOW') || norm === 'Y' || norm === 'GIALLO' || norm === 'AMMONIZIONE') { yellows += 1; }
            }
          }

          const opponent = (ev.opponent ?? ev.avversario ?? 'Avversari').toString();
          const isHome = typeof ev.isHome === 'boolean' ? ev.isHome : (ev.homeAway === 'HOME');
          const competition = (ev.competition ?? ev.competizione ?? ev.torneo ?? ev.league ?? ev.categoria ?? '').toString().trim() || undefined;
          const competitionPrefix = competition ? `${competition} - ` : '';
          const label = isHome ? `${competitionPrefix}🏟️ Casa vs ${opponent}` : `${competitionPrefix}🚍 Trasferta @ ${opponent}`;

          rows.push({
            id: matchId,
            date: ev.date || 'N/D',
            opponent: opponent,
            label,
            competition,
            started,
            subOn: !started && subOnMin != null,
            subOff: started && subOffMin != null,
            minutes,
            goals: goalsHere,
            yellowCards: yellows,
            redCards: reds,
            result: ev.resultText,
          });
        }
        setMatches(rows);
      } catch (e) {
        console.warn('Errore calcolo partite giocatore', e);
        setMatches([]);
      }
    })();
  }, [id, playerName, lastTouch]);

  // === ALLENAMENTI + STRISCE INFORTUNI AUTO ===
  useEffect(() => {
    (async () => {
      try {
        const list: CalendarEvent[] = await loadEvents();
        const allenamenti = list
          .filter(ev => ev.type === 'ALLENAMENTO')
          .sort((a, b) => `${a.date} ${a.time || '00:00'}`.localeCompare(`${b.date} ${b.time || '00:00'}`));

        const normalized = allenamenti.map(ev => {
          const s = (ev as any).presenze?.[id!];
          let status: PresenceStatus | undefined;
          if (typeof s === 'boolean') status = s ? 'presente' : 'assente';
          else status = s as PresenceStatus | undefined;
          return { date: ev.date || 'N/D', status };
        });

        setTrainings(normalized);

        // Strisce consecutive infortunato/differenziato
        const recs: InjuryRecord[] = [];
        let current: { from: string; to: string; runs: { status: PresenceStatus; count: number }[] } | null = null;
        const pushCurrent = () => {
          if (!current) return;
          const length = current.runs.reduce((s, r) => s + r.count, 0);
          const key = `${current.from}_${current.to}`;
          recs.push({ key, from: current.from, to: current.to, length, runs: current.runs.slice() });
          current = null;
        };
        for (let i = 0; i < normalized.length; i++) {
          const { date, status } = normalized[i];
          const isInjLike = status === 'infortunato' || status === 'differenziato';
          if (isInjLike) {
            if (!current) current = { from: date, to: date, runs: [{ status, count: 1 }] };
            else {
              current.to = date;
              const lastRun = current.runs[current.runs.length - 1];
              if (lastRun.status === status) lastRun.count += 1; else current.runs.push({ status, count: 1 });
            }
          } else { if (current) pushCurrent(); }
        }
        if (current) pushCurrent();
        setInjuryRecords(recs);
      } catch (e) {
        console.warn('Errore calcolo allenamenti/infortuni', e);
        setTrainings([]);
        setInjuryRecords([]);
      }
    })();
  }, [id]);

  // quante strisce sono "attive" all’ultima data
  const activeInjuriesCount = useMemo(() => {
    if (injuryRecords.length === 0 || trainings.length === 0) return 0;
    const lastDate = trainings[trainings.length - 1]?.date;
    return injuryRecords.filter(r => r.to === lastDate).length;
  }, [injuryRecords, trainings]);

  // === FOTO / ALLEGATI / TIPI INFORTUNIO ===
   const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permessi', 'Serve il permesso per accedere alle foto.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.9,
    });
    if (!res.canceled) savePhoto(res.assets[0].uri);
  };
  const savePhoto = async (uri: string | null) => {
    if (!id || !uri) return;
    try {
      const publicUrl = await uploadPlayerPhoto(id, uri);
      setPhoto(publicUrl);
    } catch {
      Alert.alert('Errore', 'Impossibile salvare la foto');
    }
  };
  const addAttachment = async () => {
    if (!id) return;
    const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
    if (!res.canceled && res.assets?.length) {
      const file = res.assets[0];
      try {
        const newAtt = await addAttachmentRemote(id, file.uri, file.name ?? 'Senza nome');
        setAttachments((prev) => [...prev, newAtt]);
      } catch {
        Alert.alert('Errore', "Impossibile caricare l'allegato");
      }
    }
  };
  const removeAttachment = async (attachment: PlayerAttachment) => {
    setAttachments((prev) => prev.filter((a) => a.id !== attachment.id));
    await removeAttachmentRemote(attachment);
  };
  const openAttachment = async (uri: string) => {
    if (/^https?:\/\//i.test(uri)) await WebBrowser.openBrowserAsync(uri);
    else await Linking.openURL(uri);
  };

  const setInjuryType = async (key: string, type: string) => {
    if (!id) return;
    setInjuryTypesMap((prev) => ({ ...prev, [key]: { type } }));
    await setInjuryTypeRemote(id, key, type);
  };

  /* =============================== RENDER =============================== */
  if (!base) {
    return <View style={styles.center}><Text style={styles.emptyText}>Giocatore non trovato</Text></View>;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }} edges={['top','bottom']}>
      {/* HEADER FISSO CON OMBRA (safe area top) */}
      <View style={[styles.fixedHeader, { paddingTop: 16 }]}>
        <View style={styles.headerRow}>
          {photo ? (
            <Image source={{ uri: photo }} style={styles.photo} />
          ) : (
            <View style={styles.placeholder}><Text style={{ fontSize: 32 }}>👤</Text></View>
          )}
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.name}>{base.name}</Text>
            <Text>{base.dob ? `Nato il ${formatItalianDate(base.dob)}` : `Anno: ${base.year}`}</Text>
            {'height' in base && base.height ? <Text>Altezza: {base.height} cm</Text> : null}
            {'weight' in base && base.weight ? <Text>Peso: {base.weight} kg</Text> : null}
          </View>
        </View>

        {/* Statistiche rapide */}
        <View style={styles.quickStatsRow}>
          <SmallStatCard title="Presenze" value={`${presencePct}%`} icon="📊" color="#1b7f3b" />
          <SmallStatCard title="Infortuni" value={activeInjuriesCount} icon="🚨" color={activeInjuriesCount > 0 ? '#dc2626' : '#16a34a'} />
          {'height' in base && base.height ? (<SmallStatCard title="Altezza" value={`${base.height}cm`} icon="📏" color="#2563eb" />) : null}
          {'weight' in base && base.weight ? (<SmallStatCard title="Peso" value={`${base.weight}kg`} icon="⚖️" color="#7c3aed" />) : null}
        </View>

        {!readOnly && (
          <View style={styles.headerActions}>
            <Pressable style={styles.actionBtn} onPress={pickPhoto}>
              <Text style={styles.actionText}>{photo ? 'Cambia foto' : 'Aggiungi foto'}</Text>
            </Pressable>
          </View>
        )}

        {/* TAB */}
        <View style={styles.tabContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 4 }}>
            <View style={styles.tabRow}>
              {(['PARTITE', 'ALLENAMENTI', 'INFORTUNI', 'ALLEGATI'] as TabKey[]).map(k => (
                <Pressable key={k} style={[styles.tabBtn, tab === k && styles.tabBtnActive]} onPress={() => setTab(k)}>
                  <Text style={styles.tabIcon}>
                    {k === 'PARTITE' ? '⚽' : k === 'ALLENAMENTI' ? '🏃‍♂️' : k === 'INFORTUNI' ? '🩹' : '📎'}
                  </Text>
                  <Text style={[styles.tabText, tab === k && styles.tabTextActive]}>
                    {k === 'PARTITE' ? 'Partite' : k === 'ALLENAMENTI' ? 'Allenamenti' : k === 'INFORTUNI' ? 'Infortuni' : 'Allegati'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>
      </View>

      {/* CONTENUTO SCROLLABILE SOTTO L’HEADER */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 248 + insets.top, paddingBottom: 24 }}>
        {/* ====== DATI ANAGRAFICI (Admin/Staff diretto, Giocatore solo il proprio - proposta) ====== */}
        {(canEditDirectly || isOwnPlayer) && (
          <View style={[styles.tabContent, { paddingBottom: 0 }]}>
            <View style={styles.editCard}>
              <Text style={styles.editCardTitle}>Dati anagrafici</Text>

              {pendingEdit && canEditDirectly && (
                <View style={styles.pendingEditBox}>
                  <Text style={styles.pendingEditText}>
                    Modifica proposta in attesa: {describeChanges(pendingEdit.changes)}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                    <Pressable style={[styles.actionBtn, { backgroundColor: '#1b7f3b' }]} onPress={handleApproveEdit}>
                      <Text style={styles.actionText}>Conferma</Text>
                    </Pressable>
                    <Pressable style={[styles.actionBtn, { backgroundColor: '#9ca3af' }]} onPress={handleRejectEdit}>
                      <Text style={styles.actionText}>Rifiuta</Text>
                    </Pressable>
                  </View>
                </View>
              )}

              {pendingEdit && isOwnPlayer && !canEditDirectly && (
                <View style={styles.pendingEditBox}>
                  <Text style={styles.pendingEditText}>
                    Hai una modifica in attesa di conferma dello staff: {describeChanges(pendingEdit.changes)}
                  </Text>
                </View>
              )}

              {(canEditDirectly || (isOwnPlayer && !pendingEdit)) && (
                <>
                  <Text style={styles.formLabel}>Ruolo</Text>
                  <View style={styles.pickerWrap}>
                    <Picker selectedValue={editRole} onValueChange={(v) => setEditRole(v as Role)}>
                      <Picker.Item label="Portiere" value="PORTIERE" />
                      <Picker.Item label="Difensore" value="DIFENSORE" />
                      <Picker.Item label="Centrocampista" value="CENTROCAMPISTA" />
                      <Picker.Item label="Attaccante" value="ATTACCANTE" />
                    </Picker>
                  </View>

                  <DatePickerField
                    label="Data di nascita"
                    value={editDob}
                    onChange={setEditDob}
                    minDate="1950-01-01"
                    maxDate={todayStr()}
                  />

                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.formLabel}>Altezza (cm)</Text>
                      <TextInput style={styles.formInput} value={editHeight} onChangeText={setEditHeight} keyboardType="numeric" maxLength={3} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.formLabel}>Peso (kg)</Text>
                      <TextInput style={styles.formInput} value={editWeight} onChangeText={setEditWeight} keyboardType="numeric" maxLength={3} />
                    </View>
                  </View>

                  <Pressable
                    style={[styles.actionBtn, { marginTop: 12, alignSelf: 'flex-start' }]}
                    onPress={handleSaveEdit}
                    disabled={editSaving}
                  >
                    <Text style={styles.actionText}>
                      {editSaving ? 'Salvataggio…' : canEditDirectly ? 'Salva modifiche' : 'Proponi modifica'}
                    </Text>
                  </Pressable>
                </>
              )}
            </View>
          </View>
        )}

        {/* ====== ACCESSO ALL'APP (solo admin) ====== */}
        {isAdmin && (
          <View style={[styles.tabContent, { paddingBottom: 0 }]}>
            <View style={styles.inviteCard}>
              {inviteStatus?.claimedEmail ? (
                <Text style={styles.inviteText}>
                  ✅ Collegato all'account <Text style={{ fontWeight: '800' }}>{inviteStatus.claimedEmail}</Text>
                </Text>
              ) : inviteStatus?.pendingCode ? (
                <>
                  <Text style={styles.inviteText}>Codice di accesso per {playerName}:</Text>
                  <Text style={styles.inviteCode}>{inviteStatus.pendingCode}</Text>
                  <Pressable style={styles.actionBtn} onPress={handleShareInvite}>
                    <Text style={styles.actionText}>Condividi</Text>
                  </Pressable>
                </>
              ) : (
                <Pressable style={styles.actionBtn} onPress={handleGenerateInvite} disabled={inviteBusy}>
                  <Text style={styles.actionText}>{inviteBusy ? 'Generazione…' : 'Genera codice di accesso'}</Text>
                </Pressable>
              )}
            </View>
          </View>
        )}

        {/* ====== PARTITE ====== */}
        {tab === 'PARTITE' && (
          <View style={styles.tabContent}>
            <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>⚽ Partite</Text></View>

            {/* Totali */}
            <View style={styles.totalsRow}>
              <View style={[styles.totalCard, { backgroundColor: '#eaf6ef' }]}><Text style={styles.totalLabel}>Presenze</Text><Text style={styles.totalValue}>{totalMatches}</Text></View>
              <View style={[styles.totalCard, { backgroundColor: '#eef2ff' }]}><Text style={styles.totalLabel}>Minuti</Text><Text style={styles.totalValue}>{totalMinutes}</Text></View>
              <View style={[styles.totalCard, { backgroundColor: '#fff7ed' }]}><Text style={styles.totalLabel}>Gol</Text><Text style={styles.totalValue}>{totalGoals}</Text></View>
              <View style={[styles.totalCard, { backgroundColor: '#fffbeb' }]}><Text style={styles.totalLabel}>🟨 Gialli</Text><Text style={styles.totalValue}>{totalYellows}</Text></View>
              <View style={[styles.totalCard, { backgroundColor: '#fef2f2' }]}><Text style={styles.totalLabel}>🟥 Rossi</Text><Text style={styles.totalValue}>{totalReds}</Text></View>
            </View>

            {/* Filtro competizione */}
            <View style={styles.filterBar}>
              <Text style={styles.filterLabel}>Competizione:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.filterChipsRow}>
                  <Pressable style={[styles.chip, compFilter === '__ALL__' && styles.chipActive]} onPress={() => setCompFilter('__ALL__')}>
                    <Text style={[styles.chipText, compFilter === '__ALL__' && styles.chipTextActive]}>Tutte</Text>
                  </Pressable>
                  {competitions.map(c => (
                    <Pressable key={c} style={[styles.chip, compFilter === c && styles.chipActive]} onPress={() => setCompFilter(c)}>
                      <Text style={[styles.chipText, compFilter === c && styles.chipTextActive]} numberOfLines={1}>{c}</Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </View>

            {filteredMatches.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>🏟️</Text>
                <Text style={styles.emptyTitle}>Nessuna partita {compFilter === '__ALL__' ? 'registrata' : `per “${compFilter}”`}</Text>
                <Text style={styles.emptyText}>Quando concludi le partite in “Live”, appariranno qui.</Text>
              </View>
            ) : (
              <View style={styles.matchesList}>
                <View style={[styles.matchRow, styles.matchHeaderRow]}>
                  <Text style={[styles.colDate, styles.matchHeaderTxt]}>Data</Text>
                  <View style={styles.colMatchWrap}><Text style={[styles.matchHeaderTxt]}>Partita</Text></View>
                  <Text style={[styles.colMin, styles.matchHeaderTxt]}>Min</Text>
                  <Text style={[styles.colStatus, styles.matchHeaderTxt]}>Status</Text>
                  <Text style={[styles.colGol, styles.matchHeaderTxt]}>Gol</Text>
                  <Text style={[styles.colCards, styles.matchHeaderTxt]}>Cards</Text>
                </View>
                {filteredMatches.map(m => (
                  <View key={m.id} style={styles.matchRow}>
                    <Text style={styles.colDate}>{m.date || '—'}</Text>
                     <View style={styles.colMatchWrap}>
                       <Text numberOfLines={1} style={styles.colMatch}>{m.label}</Text>
                       <View style={styles.rowMeta}>
                         <Text numberOfLines={1} style={styles.opponentTxt}>vs {m.opponent}</Text>
                         {!!m.result && <Text numberOfLines={1} style={styles.resultTxt}>{m.result}</Text>}
                       </View>
                     </View>
                    <Text style={styles.colMin}>{m.minutes}</Text>
                    <Text style={styles.colStatus}>
                      {m.started && '✅'}
                      {m.subOn && '🔼'}
                      {m.subOff && '🔽'}
                      {!m.started && !m.subOn && !m.subOff && '—'}
                    </Text>
                    <Text style={styles.colGol}>{m.goals}</Text>
                    <Text style={styles.colCards}>
                      {m.yellowCards > 0 && `🟨${m.yellowCards}`}
                      {m.redCards > 0 && ` 🟥${m.redCards}`}
                      {m.yellowCards === 0 && m.redCards === 0 && '—'}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* ====== ALLENAMENTI ====== */}
        {tab === 'ALLENAMENTI' && (
          <View style={styles.tabContent}>
            <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>🏃‍♂️ Statistiche Allenamenti</Text></View>

            <View style={styles.statsSection}>
              <View style={styles.statsRow}>
                <SmallStatCard title="Totale" value={trainingsTotal} icon="📈" color="#1b7f3b" />
                <SmallStatCard title="Presenti" value={trainingsPresent} icon="✅" color="#16a34a" />
              </View>
              <View style={[styles.statsRow, { marginTop: 8 }]}>
                <SmallStatCard title="Assenti" value={trainingsAbsent} icon="❌" color="#dc2626" />
                <SmallStatCard title="Infortunato" value={trainingsInj} icon="🏥" color="#d97706" />
                <SmallStatCard title="Differenziato" value={trainingsDiff} icon="⚡" color="#7c3aed" />
                <SmallStatCard title="Senza Risposta" value={trainingsNoReply} icon="❔" color="#64748b" />
              </View>
            </View>

            <View style={styles.trendCard}>
              <Text style={styles.cardTitle}>📊 Ultimi 5 allenamenti</Text>
              <View style={styles.trendRow}>
                {recentTrend.length === 0 ? (
                  <Text style={styles.noDataText}>Nessun dato disponibile</Text>
                ) : (
                  recentTrend.map((t, idx) => (
                    <View key={idx} style={[
                      styles.trendDot,
                      t.status === 'presente' ? styles.trendPresent :
                      t.status === 'assente' ? styles.trendAbsent :
                      t.status === 'infortunato' ? styles.trendInj :
                      t.status === 'differenziato' ? styles.trendDiff :
                      styles.trendUnknown,
                    ]}>
                      <Text style={styles.trendIcon}>
                        {t.status === 'presente' ? '✓' : t.status === 'assente' ? '✗' : t.status === 'infortunato' ? '🏥' : t.status === 'differenziato' ? '⚡' : '？'}
                      </Text>
                    </View>
                  ))
                )}
              </View>
            </View>

            {monthlySummary.length > 0 && (
              <View style={styles.monthlyCard}>
                <Text style={styles.cardTitle}>📅 Riepilogo Mensile</Text>
                {monthlySummary.map(m => (
                  <View key={m.month} style={styles.monthRow}>
                    <Text style={styles.monthLabel}>{m.month}</Text>
                    <View style={styles.monthStats}>
                      <Text style={styles.monthValue}>{m.present}/{m.total}</Text>
                      <Text style={styles.monthPercent}>({m.total > 0 ? Math.round((m.present / m.total) * 100) : 0}%)</Text>
                    </View>
                    <View style={styles.monthBadges}>
                      {m.inj > 0 && <Text style={[styles.badge, styles.badgeInj]}>🏥 {m.inj}</Text>}
                      {m.diff > 0 && <Text style={[styles.badge, styles.badgeDiff]}>⚡ {m.diff}</Text>}
                      {m.abs > 0  && <Text style={[styles.badge, styles.badgeAbs]}>❌ {m.abs}</Text>}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* ====== INFORTUNI AUTO ====== */}
        {tab === 'INFORTUNI' && (
          <View style={styles.tabContent}>
            <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>🩹 Storico Infortuni (auto)</Text></View>
            {injuryRecords.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>💪</Text>
                <Text style={styles.emptyTitle}>Nessuna striscia di infortunio</Text>
                <Text style={styles.emptyText}>Le strisce vengono create automaticamente quando il giocatore risulta "infortunato" o "differenziato" in allenamenti consecutivi.</Text>
              </View>
            ) : (
              <View style={styles.injuriesList}>
                {injuryRecords.slice().sort((a, b) => b.from.localeCompare(a.from)).map(rec => {
                  const comp = rec.runs.map(r => `${r.count}× ${r.status}`).join(', ');
                  const currentType = injuryTypesMap[rec.key]?.type ?? '';
                  const active = trainings.length > 0 && rec.to === trainings[trainings.length - 1]?.date;
                  return (
                    <View key={rec.key} style={[styles.injuryCard, active && styles.activeInjury]}>
                      <View style={styles.injuryHeader}>
                        <Text style={styles.injuryType}>{currentType?.trim() ? currentType : '— Tipologia non specificata —'}</Text>
                        {active && (<View style={styles.activeBadge}><Text style={styles.activeBadgeText}>ATTIVO</Text></View>)}
                      </View>
                      <Text style={styles.injuryDate}>📅 {rec.from} → {rec.to}</Text>
                      <Text style={styles.injuryNote}>Striscia: {comp}</Text>
                      {!readOnly && (
                        <View style={{ marginTop: 10 }}>
                          <Text style={styles.formLabel}>Tipologia (libera)</Text>
                          <TextInput value={currentType} onChangeText={(txt) => setInjuryType(rec.key, txt)} placeholder="Es. Distrazione flessore, distorsione caviglia" style={styles.formInput} />
                          <Text style={styles.hintText}>Questo testo è solo descrittivo e viene salvato per questa striscia ({rec.from} → {rec.to}).</Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* ====== ALLEGATI ====== */}
        {tab === 'ALLEGATI' && (
          <View style={styles.tabContent}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>📎 Allegati</Text>
              {!readOnly && (
                <Pressable style={styles.addButton} onPress={addAttachment}><Text style={styles.addButtonText}>+ Aggiungi</Text></Pressable>
              )}
            </View>
            {attachments.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>📁</Text>
                <Text style={styles.emptyTitle}>Nessun allegato</Text>
                <Text style={styles.emptyText}>Aggiungi documenti, certificati o altri file</Text>
              </View>
            ) : (
              <View style={styles.attachmentsList}>
                {attachments.map((item) => (
                  <Pressable key={item.id} style={styles.attachmentCard} onPress={() => openAttachment(item.uri)}>
                    <Text style={styles.attachmentIcon}>📄</Text>
                    <View style={styles.attachmentInfo}>
                      <Text style={styles.attachmentName} numberOfLines={1}>{item.name}</Text>
                      <Text style={styles.attachmentPath} numberOfLines={1}>{item.uri}</Text>
                    </View>
                    <Pressable
                      style={[styles.removeAttachmentBtn, readOnly && { opacity: 0 }]}
                      onPress={() => removeAttachment(item)}
                      disabled={readOnly}
                    >
                      <Text style={styles.removeAttachmentText}>🗑️</Text>
                    </Pressable>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/* =============================== STILI =============================== */
const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 16, color: '#64748b' },

  fixedHeader: {
    position: 'absolute', top: 0, left: 0, right: 0,
    backgroundColor: '#fff',
    padding: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    zIndex: 10,
    elevation: 6,
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
  },
  headerRow: { flexDirection: 'row', alignItems: 'center' },

  quickStatsRow: { flexDirection: 'row', alignItems: 'stretch', justifyContent: 'flex-start', marginTop: 10, gap: 8 },

  // SmallStatCard
  sCard: {
    width: 86, height: 86,
    borderRadius: 12, borderWidth: 2,
    backgroundColor: '#f8fafc',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 6,
  },
  sCardIcon: { fontSize: 14, marginBottom: 2 },
  sCardTitle: { fontSize: 11, fontWeight: '800', color: '#334155' },
  sCardValue: { fontSize: 16, fontWeight: '900', color: '#0f172a', marginTop: 2 },

  tabContainer: { marginTop: 8 },
  tabRow: { flexDirection: 'row', gap: 8 },
  tabBtn: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 16,
    borderRadius: 20, backgroundColor: '#e2e8f0', minWidth: 110, justifyContent: 'center',
  },
  tabBtnActive: { backgroundColor: '#1b7f3b' },
  tabIcon: { fontSize: 16, marginRight: 6 },
  tabText: { fontSize: 14, fontWeight: '800', color: '#475569' },
  tabTextActive: { color: 'white' },

  tabContent: { padding: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
  addButton: { backgroundColor: '#1b7f3b', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  addButtonText: { color: 'white', fontWeight: '600', fontSize: 14 },

  photo: { width: 90, height: 90, borderRadius: 45 },
  placeholder: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#ddd', alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 18, fontWeight: '800', marginBottom: 2 },

  totalsRow: { flexDirection: 'row', gap: 10, marginBottom: 10, flexWrap: 'wrap' },
  totalCard: { flexGrow: 1, minWidth: 120, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 12 },
  totalLabel: { fontSize: 12, color: '#475569', fontWeight: '700' },
  totalValue: { fontSize: 20, fontWeight: '900', color: '#0f172a', marginTop: 4 },

  /* filtro competizione */
  filterBar: { marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  filterLabel: { fontWeight: '800', color: '#334155' },
  filterChipsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chip: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, backgroundColor: '#e2e8f0', borderWidth: 1, borderColor: '#cbd5e1' },
  chipActive: { backgroundColor: '#1b7f3b', borderColor: '#166534' },
  chipText: { fontSize: 12, fontWeight: '800', color: '#334155' },
  chipTextActive: { color: 'white' },

  matchesList: { backgroundColor: '#fff', borderRadius: 12, paddingVertical: 6, borderWidth: 1, borderColor: '#e5e7eb' },
  matchHeaderRow: { backgroundColor: '#f1f5f9', borderTopLeftRadius: 12, borderTopRightRadius: 12 },
  matchHeaderTxt: { fontWeight: '800', color: '#334155' },
  matchRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', gap: 8 },
  colDate: { width: 88, fontSize: 12, color: '#111', fontWeight: '700' },
  colMatchWrap: { flex: 1, minWidth: 0 },
  colMatch: { fontSize: 13, fontWeight: '800', color: '#111' },
  rowMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2, alignItems: 'center' },
  compPill: { fontSize: 11, fontWeight: '800', color: '#0f172a', backgroundColor: '#e2e8f0', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  resultTxt: { fontSize: 12, color: '#475569' },
  opponentTxt: { fontSize: 11, fontWeight: '700', color: '#0f172a' },
  colComp: { width: 100, fontSize: 11, color: '#111' },
  colMin: { width: 44, textAlign: 'center', fontWeight: '800' },
  colFlag: { width: 40, textAlign: 'center' },
  colStatus: { width: 60, textAlign: 'center', fontSize: 11, color: '#111' },
  colGol: { width: 44, textAlign: 'center', fontWeight: '800' },
  colCard: { width: 44, textAlign: 'center', fontWeight: '800' },
  colCards: { width: 70, textAlign: 'center', fontSize: 11, color: '#111' },

  // Allenamenti
  statsSection: { marginBottom: 16 },
  statsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  trendCard: {
    backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
  },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#374151', marginBottom: 8 },
  trendRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  trendDot: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  trendPresent: { backgroundColor: '#dcfce7' },
  trendAbsent: { backgroundColor: '#fee2e2' },
  trendInj: { backgroundColor: '#fef3c7' },
  trendDiff: { backgroundColor: '#f3e8ff' },
  trendUnknown: { backgroundColor: '#e2e8f0' },
  trendIcon: { fontSize: 16, fontWeight: 'bold' },
  noDataText: { fontSize: 14, color: '#64748b', fontStyle: 'italic' },

  monthlyCard: {
    backgroundColor: '#fff', padding: 16, borderRadius: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
  },
  monthRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  monthLabel: { fontSize: 14, color: '#374151', fontWeight: '500', width: 92 },
  monthStats: { flexDirection: 'row', alignItems: 'center', minWidth: 80 },
  monthValue: { fontSize: 14, fontWeight: 'bold', color: '#1e293b', marginRight: 4 },
  monthPercent: { fontSize: 12, color: '#64748b' },
  monthBadges: { flexDirection: 'row', gap: 6, marginLeft: 'auto' },
  badge: { fontSize: 12, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  badgeInj: { backgroundColor: '#fef3c7', color: '#92400e' },
  badgeDiff: { backgroundColor: '#f3e8ff', color: '#6d28d9' },
  badgeAbs: { backgroundColor: '#fee2e2', color: '#991b1b' },

  // Infortuni
  injuriesList: { gap: 12 },
  injuryCard: {
    backgroundColor: '#fff', padding: 16, borderRadius: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
  },
  activeInjury: { borderLeftWidth: 4, borderLeftColor: '#dc2626' },
  injuryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  injuryType: { fontSize: 16, fontWeight: 'bold', color: '#1e293b', flex: 1 },
  activeBadge: { backgroundColor: '#fee2e2', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  activeBadgeText: { fontSize: 10, fontWeight: 'bold', color: '#dc2626' },
  injuryDate: { fontSize: 14, color: '#64748b', marginBottom: 4 },
  injuryNote: { fontSize: 14, color: '#64748b' },

  formLabel: { fontWeight: '700', marginBottom: 6, marginTop: 8, color: '#1e293b' },
  formInput: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: 'white' },
  hintText: { fontSize: 12, color: '#64748b', marginTop: 6, fontStyle: 'italic' },

  // Foto & Allegati
  headerActions: { marginTop: 10, flexDirection: 'row', gap: 8 },
  actionBtn: { backgroundColor: '#1b7f3b', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  actionText: { color: 'white', fontWeight: '800' },
  inviteCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 4,
    borderWidth: 1, borderColor: '#e5e7eb', gap: 8, alignItems: 'flex-start',
  },
  inviteText: { fontSize: 14, color: '#374151' },
  inviteCode: { fontSize: 24, fontWeight: '900', letterSpacing: 2, color: '#1b7f3b' },

  editCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 4,
    borderWidth: 1, borderColor: '#e5e7eb',
  },
  editCardTitle: { fontSize: 16, fontWeight: '800', color: '#1e293b', marginBottom: 4 },
  pickerWrap: {
    backgroundColor: '#f9fafb', borderRadius: 8, borderWidth: 1, borderColor: '#d1d5db', overflow: 'hidden',
  },
  pendingEditBox: {
    backgroundColor: '#fef3c7', borderRadius: 10, padding: 12, marginTop: 8, marginBottom: 4,
  },
  pendingEditText: { fontSize: 13, color: '#92400e', fontWeight: '600' },

  emptyState: { alignItems: 'center', paddingVertical: 20 },
  emptyIcon: { fontSize: 26 },
  emptyTitle: { fontWeight: '900', marginTop: 6, color: '#0f172a' },

  attachmentsList: { gap: 8 },
  attachmentCard: {
    backgroundColor: '#fff', padding: 12, borderRadius: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
    flexDirection: 'row', gap: 10, alignItems: 'center',
  },
  attachmentIcon: { fontSize: 22 },
  attachmentInfo: { flex: 1 },
  attachmentName: { fontWeight: '800', color: '#0f172a' },
  attachmentPath: { color: '#6b7280', marginTop: 2, fontSize: 12 },
  removeAttachmentBtn: { paddingHorizontal: 6, paddingVertical: 4, borderRadius: 8, backgroundColor: '#fee2e2' },
  removeAttachmentText: { fontSize: 16 },
});