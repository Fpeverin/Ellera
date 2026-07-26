import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import CompetitionModal from './components/partite/CompetitionModal';
import ConfirmDeleteModal from './components/partite/ConfirmDeleteModal';
import MatchEventCard from './components/partite/MatchEventCard';
import { CalendarEvent, STORAGE_KEY } from './data/events';

/* -------------------------------------------------------------------------- */
/*                                Tipi locali                                 */
/* -------------------------------------------------------------------------- */

type MatchEventRow = CalendarEvent & {
  competition?: string;
  homeAway?: 'CASA' | 'TRASFERTA';
  status?: 'FINISHED' | string;
  score?: { home: number; away: number };
  resultText?: string;
};

type NewRound = {
  opponent: string;
  date: string;
  time: string;
  homeAway: 'CASA' | 'TRASFERTA';
  location: string;
};

/* -------------------------------------------------------------------------- */
/*                              Schermata Partite                             */
/* -------------------------------------------------------------------------- */

const TIME_RE = /^\d{2}:\d{2}$/;
const ALL_COMP = '__ALL__';

export default function Partite() {
  const router = useRouter();
  const [events, setEvents] = useState<MatchEventRow[]>([]);

  // modali creazione
  const [showSingleModal, setShowSingleModal] = useState(false);
  const [showCompModal, setShowCompModal] = useState(false);

  // cancellazioni
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);

  // elimina competizione
  const [showChooseCompModal, setShowChooseCompModal] = useState(false);
  const [confirmDeleteComp, setConfirmDeleteComp] = useState(false);
  const [compToDelete, setCompToDelete] = useState<string>('—');

  const [busy, setBusy] = useState(false);

  const loadEvents = async () => {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const list: CalendarEvent[] = raw ? JSON.parse(raw) : [];

    const normalized: MatchEventRow[] = list
      .filter((e) => e.type === 'PARTITA')
      .map((e) => {
        const ha = (e as any).homeAway as 'CASA' | 'TRASFERTA' | 'HOME' | 'AWAY' | undefined;
        const homeAway: 'CASA' | 'TRASFERTA' | undefined =
          ha === 'HOME' ? 'CASA' : ha === 'AWAY' ? 'TRASFERTA' : ha;
        return { ...(e as any), homeAway } as MatchEventRow;
      });

    setEvents(normalized);
  };

  useFocusEffect(useCallback(() => { loadEvents(); }, []));

  const openPartita = (ev: MatchEventRow) => {
    router.push({ pathname: '/eventi/partita/[id]/live', params: { id: ev.id } });
  };

  const competitions = useMemo(() => {
    const map = new Map<string, number>();
    events.forEach((e) => {
      const key = e.competition || '—';
      map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
  }, [events]);

  // FILTRO competizione (include "Tutte le competizioni")
  const [compFilter, setCompFilter] = useState<string>(ALL_COMP);
  const filteredEvents = useMemo(() => {
    if (compFilter === ALL_COMP) return events;
    // Nota: nelle competizioni anonime usiamo '—'
    const normalizedFilter = compFilter === '—' ? undefined : compFilter;
    return events.filter(e => (e.competition || '—') === (normalizedFilter || '—'));
  }, [events, compFilter]);

  // Categorizzazione per data (oggi / future / passate)
  const categorized = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const today: MatchEventRow[] = [];
    const future: MatchEventRow[] = [];
    const past: MatchEventRow[] = [];

    filteredEvents.forEach(ev => {
      const time = ev.time && TIME_RE.test(ev.time) ? ev.time : '00:00';
      const dt = new Date(`${ev.date}T${time}:00`);
      if (dt >= todayStart && dt <= todayEnd) {
        today.push(ev);
      } else if (dt > todayEnd) {
        future.push(ev);
      } else {
        past.push(ev);
      }
    });

    const sortFn = (a: MatchEventRow, b: MatchEventRow) => {
      const d = a.date.localeCompare(b.date);
      if (d !== 0) return d;
      return (a.time || '00:00').localeCompare(b.time || '00:00');
    };

    return {
      today: today.sort(sortFn),
      future: future.sort(sortFn),
      past: past.sort(sortFn).reverse(), // passate: più recenti per prime
    };
  }, [filteredEvents]);

  // elimina singola
  const actuallyDeleteOne = async () => {
    if (!confirmDeleteId) return;
    setBusy(true);
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const all: CalendarEvent[] = raw ? JSON.parse(raw) : [];
    const updated = all.filter((ev) => ev.id !== confirmDeleteId);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setBusy(false);
    setConfirmDeleteId(null);
    loadEvents();
  };

  // elimina tutte
  const actuallyDeleteAllMatches = async () => {
    setBusy(true);
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const all: CalendarEvent[] = raw ? JSON.parse(raw) : [];
    const keep = all.filter((ev) => ev.type !== 'PARTITA');
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(keep));
    setBusy(false);
    setConfirmDeleteAll(false);
    loadEvents();
  };

  // elimina competizione
  const actuallyDeleteCompetition = async () => {
    setBusy(true);
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const all: CalendarEvent[] = raw ? JSON.parse(raw) : [];
    const keep = all.filter(
      (ev: any) => ev.type !== 'PARTITA' || (ev.type === 'PARTITA' && (ev.competition || '—') !== compToDelete)
    );
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(keep));
    setBusy(false);
    setConfirmDeleteComp(false);
    loadEvents();
  };

  // crea partita singola
  const handleCreateSingleMatch = async (matchData: {
    date: string;
    time: string;
    opponent: string;
    competition: string;
    homeAway: 'CASA' | 'TRASFERTA';
    location: string;
  }) => {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const all: CalendarEvent[] = raw ? JSON.parse(raw) : [];

    const exists = all.some(
      (ev: any) =>
        ev.type === 'PARTITA' &&
        ev.date === matchData.date &&
        ev.time === matchData.time &&
        ev.opponent === matchData.opponent &&
        (matchData.competition ? (ev.competition || '') === matchData.competition : true)
    );
    if (exists) { setShowSingleModal(false); return; }

    const newMatch: CalendarEvent = {
      id: `${Date.now()}-${matchData.date}-${matchData.time}-${Math.random().toString(36).slice(2, 6)}`,
      type: 'PARTITA',
      date: matchData.date,
      time: matchData.time,
      location: matchData.location,
      opponent: matchData.opponent,
      competition: matchData.competition || undefined,
      homeAway: matchData.homeAway,
      formationSlots: undefined,
      benchIds: [],
      tacticsIds: [],
    } as any;

    const updated = [...all, newMatch];
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setShowSingleModal(false);
    loadEvents();
  };

  // crea calendario competizione
  const handleCreateCompetition = async (competitionData: {
    name: string;
    rounds: NewRound[];
  }) => {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const all: CalendarEvent[] = raw ? JSON.parse(raw) : [];

    const validRound = (r: NewRound) => !!r.opponent && !!r.location && !!r.date && TIME_RE.test(r.time);

    const toAdd: CalendarEvent[] = [];
    competitionData.rounds.forEach((r) => {
      if (!validRound(r)) return;

      const exists = all.some(
        (ev: any) =>
          ev.type === 'PARTITA' &&
          ev.date === r.date &&
          ev.time === r.time &&
          (ev.competition || '') === competitionData.name
      );
      if (exists) return;

      toAdd.push({
        id: `${Date.now()}-${r.date}-${r.time}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'PARTITA',
        date: r.date,
        time: r.time,
        location: r.location,
        opponent: r.opponent,
        competition: competitionData.name,
        homeAway: r.homeAway,
        formationSlots: undefined,
        benchIds: [],
        tacticsIds: [],
      } as any);
    });

    if (toAdd.length === 0) { setShowCompModal(false); return; }

    const updated = [...all, ...toAdd];
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setShowCompModal(false);
    loadEvents();
  };

  const renderItem = ({ item }: { item: MatchEventRow }) => {
    const hasScore = !!item?.score && Number.isFinite(item.score?.home) && Number.isFinite(item.score?.away);
    const result = item?.resultText || (hasScore ? `Risultato: ${item.score!.home} - ${item.score!.away}` : null);

    return (
      <View style={{ marginBottom: 8 }}>
        <MatchEventCard item={item as any} onPress={openPartita as any} onDelete={(id) => setConfirmDeleteId(id)} />
        {result ? (
          <View style={styles.resultRow}>
            <Text style={styles.resultText}>{result}</Text>
          </View>
        ) : null}
      </View>
    );
  };

  // stato per modale "seleziona competizione da rimuovere"
  const [selectedComp, setSelectedComp] = useState<string>('—');

  // Sezione helper
  const Section = ({
    title,
    data,
    icon,
    isPast = false,
  }: {
    title: string;
    data: MatchEventRow[];
    icon: string;
    isPast?: boolean;
  }) => {
    if (!data || data.length === 0) return null;
    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionIcon}>{icon}</Text>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={styles.sectionCount}>({data.length})</Text>
        </View>
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          scrollEnabled={false}
        />
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top','bottom']}>
      <Text style={styles.title}>Partite</Text>

      {/* Filtri in alto */}
      <View style={styles.filtersRow}>
        <View style={styles.filterBlock}>
          <Text style={styles.filterLabel}>Competizione</Text>
          <View style={styles.pickerWrap}>
            <Picker
              selectedValue={compFilter}
              onValueChange={(val) => setCompFilter(val)}
              style={{ width: '100%' }}
            >
              <Picker.Item label="Tutte le competizioni" value={ALL_COMP} />
              {/* competizioni note, incluse quelle senza nome (—) */}
              {competitions.map((c) => (
                <Picker.Item key={c.name} label={`${c.name} (${c.count})`} value={c.name} />
              ))}
            </Picker>
          </View>
        </View>

        {/* Azioni rapide (coerenti con lo stile esistente) */}
        <View style={styles.topActions}>
          <Pressable style={[styles.outlineBtn, { borderColor: '#b91c1c' }]} onPress={() => setConfirmDeleteAll(true)}>
            <Text style={[styles.outlineText, { color: '#b91c1c' }]}>🧹 Rimuovi tutte</Text>
          </Pressable>

          <Pressable
            style={[styles.outlineBtn, { borderColor: '#1f2937' }]}
            onPress={() => {
              const first = competitions[0]?.name ?? '—';
              setSelectedComp(first);
              setShowChooseCompModal(true);
            }}
          >
            <Text style={[styles.outlineText, { color: '#1f2937' }]}>🏷️ Rimuovi competizione</Text>
          </Pressable>
        </View>
      </View>

      {/* Liste: oggi / future / passate */}
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {filteredEvents.length === 0 ? (
          <Text style={{ color: '#6b7280', textAlign: 'center', marginTop: 24 }}>
            Nessuna partita trovata
          </Text>
        ) : (
          <>
            <Section title="Oggi" data={categorized.today} icon="⭐" />
            <Section title="Prossime partite" data={categorized.future} icon="🔜" />
            <Section title="Partite passate" data={categorized.past} icon="📋" isPast />
          </>
        )}
      </ScrollView>

      {/* CTA bottom */}
      <View style={styles.bottomActions}>
        <Pressable style={[styles.cta, { backgroundColor: '#1b7f3b' }]} onPress={() => setShowSingleModal(true)}>
          <Text style={styles.ctaText}>CREA PARTITA</Text>
        </Pressable>
        <Pressable style={[styles.cta, { backgroundColor: '#1b4f7f' }]} onPress={() => setShowCompModal(true)}>
          <Text style={styles.ctaText}>CREA CALENDARIO COMPETIZIONE</Text>
        </Pressable>
      </View>

      {/* Modali creazione */}
      <SingleMatchModal
        visible={showSingleModal}
        onClose={() => setShowSingleModal(false)}
        onCreateMatch={handleCreateSingleMatch}
      />
      <CompetitionModal
        visible={showCompModal}
        onClose={() => setShowCompModal(false)}
        onCreateCompetition={handleCreateCompetition}
      />

      {/* Modale: scegli competizione da cancellare */}
      <Modal visible={showChooseCompModal} transparent animationType="fade" onRequestClose={() => setShowChooseCompModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Seleziona competizione</Text>

            {competitions.length === 0 ? (
              <Text style={{ marginBottom: 12 }}>Nessuna competizione trovata</Text>
            ) : (
              <>
                <View style={styles.pickerWrap}>
                  <Picker selectedValue={selectedComp} onValueChange={(val) => setSelectedComp(val)} style={{ width: '100%' }}>
                    {competitions.map((c) => (
                      <Picker.Item key={c.name} label={`${c.name} (${c.count})`} value={c.name} />
                    ))}
                  </Picker>
                </View>

                <View style={{ height: 10 }} />

                <Pressable
                  style={[styles.cta, { backgroundColor: '#b91c1c' }]}
                  onPress={() => {
                    setCompToDelete(selectedComp);
                    setShowChooseCompModal(false);
                    setConfirmDeleteComp(true);
                  }}
                >
                  <Text style={styles.ctaText}>Prosegui</Text>
                </Pressable>
              </>
            )}

            <View style={{ height: 8 }} />

            <Pressable style={[styles.cta, { backgroundColor: '#9ca3af' }]} onPress={() => setShowChooseCompModal(false)}>
              <Text style={styles.ctaText}>Annulla</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Conferme eliminazione */}
      <ConfirmDeleteModal
        visible={!!confirmDeleteId}
        title="Eliminare questa partita?"
        message="L'operazione non può essere annullata."
        onConfirm={actuallyDeleteOne}
        onCancel={() => setConfirmDeleteId(null)}
        busy={busy}
      />

      <ConfirmDeleteModal
        visible={confirmDeleteAll}
        title="Eliminare TUTTE le partite?"
        message="Questa operazione eliminerà definitivamente tutte le partite."
        onConfirm={actuallyDeleteAllMatches}
        onCancel={() => setConfirmDeleteAll(false)}
        busy={busy}
      />

      <ConfirmDeleteModal
        visible={confirmDeleteComp}
        title="Elimina competizione"
        message={
          competitions.length === 0
            ? 'Nessuna competizione trovata'
            : `Eliminare la competizione "${compToDelete}"?`
        }
        onConfirm={actuallyDeleteCompetition}
        onCancel={() => setConfirmDeleteComp(false)}
        busy={busy}
      />
    </SafeAreaView>
  );
}

/* -------------------------------------------------------------------------- */
/*                         SingleMatchModal (inline)                           */
/* -------------------------------------------------------------------------- */

function SingleMatchModal({
  visible,
  onClose,
  onCreateMatch,
}: {
  visible: boolean;
  onClose: () => void;
  onCreateMatch: (data: {
    date: string;
    time: string;
    opponent: string;
    competition: string;
    homeAway: 'CASA' | 'TRASFERTA';
    location: string;
  }) => void;
}) {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [opponent, setOpponent] = useState('');
  const [competition, setCompetition] = useState('');
  const [homeAway, setHomeAway] = useState<'CASA' | 'TRASFERTA'>('CASA');
  const [location, setLocation] = useState('');

  const canSave = date && TIME_RE.test(time) && opponent && location;

  const reset = () => {
    setDate(''); setTime(''); setOpponent(''); setCompetition(''); setHomeAway('CASA'); setLocation('');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalBox, { width: '92%', maxWidth: 520 }]}>
          <Text style={styles.modalTitle}>Nuova partita</Text>

          <Text style={styles.label}>Data (YYYY-MM-DD)</Text>
          <TextInput value={date} onChangeText={setDate} placeholder="2025-05-20" style={styles.input} />

          <Text style={styles.label}>Ora (HH:MM)</Text>
          <TextInput value={time} onChangeText={setTime} placeholder="15:00" style={styles.input} />

          <Text style={styles.label}>Avversario</Text>
          <TextInput value={opponent} onChangeText={setOpponent} placeholder="Es. Real Quartiere" style={styles.input} />

          <Text style={styles.label}>Competizione (opzionale)</Text>
          <TextInput value={competition} onChangeText={setCompetition} placeholder="Es. Coppa CSI" style={styles.input} />

          <Text style={styles.label}>Casa/Trasferta</Text>
          <View style={styles.pickerWrap}>
            <Picker selectedValue={homeAway} onValueChange={(v) => setHomeAway(v)}>
              <Picker.Item value="CASA" label="CASA" />
              <Picker.Item value="TRASFERTA" label="TRASFERTA" />
            </Picker>
          </View>

          <Text style={styles.label}>Luogo</Text>
          <TextInput value={location} onChangeText={setLocation} placeholder="Campo Comunale" style={styles.input} />

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <Pressable style={[styles.cta, { backgroundColor: '#9ca3af', flex: 1 }]} onPress={() => { reset(); onClose(); }}>
              <Text style={styles.ctaText}>Annulla</Text>
            </Pressable>
            <Pressable
              style={[styles.cta, { backgroundColor: '#1b7f3b', flex: 1, opacity: canSave ? 1 : 0.6 }]}
              disabled={!canSave}
              onPress={() => {
                onCreateMatch({ date, time, opponent, competition, homeAway, location });
                reset();
              }}
            >
              <Text style={styles.ctaText}>Crea</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/*                                   Stili                                    */
/* -------------------------------------------------------------------------- */

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 12 },

  // Filtri
  filtersRow: { marginBottom: 8 },
  filterBlock: { marginBottom: 8 },
  filterLabel: { fontWeight: '700', marginBottom: 6, color: '#111827' },

  topActions: { flexDirection: 'row', gap: 8 },
  outlineBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, backgroundColor: '#fff' },
  outlineText: { fontWeight: '800' },

  bottomActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  cta: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center' },
  ctaText: { color: 'white', fontWeight: '800' },

  // Sezioni
  section: { marginTop: 16, marginBottom: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, paddingHorizontal: 4 },
  sectionIcon: { fontSize: 20, marginRight: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1f2937', flex: 1 },
  sectionCount: { fontSize: 14, color: '#6b7280', fontWeight: '600' },

  resultRow: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f9fafb',
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    marginTop: -6,
  },
  resultText: { fontWeight: '900' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modalBox: { backgroundColor: '#fff', borderRadius: 10, padding: 16 },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 12 },

  pickerWrap: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8,
    overflow: 'hidden', backgroundColor: '#fafafa', marginTop: 6,
  },

  label: { fontWeight: '700', marginTop: 8 },
  input: {
    borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8,
    padding: 10, backgroundColor: '#fff', marginTop: 6,
  },
});
