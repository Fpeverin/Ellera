// app/components/calendario/PartiteTab.tsx
//
// Contenuto di quella che era la route app/partite.tsx (spostato qui il 2026-08-24 per la fusione
// in un'unica schermata Calendario) — stessa logica, invariata: crea singola, crea calendario
// competizione, filtro competizione, Regole Under/Over, modifica data/ora/luogo/competizione/
// giornata, cancellazioni, Import/Export/Modello Excel. Rimossi solo header/SafeAreaView/scroll
// propri: li fornisce la shell (app/calendario.tsx).
import { Picker } from '@react-native-picker/picker';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import CompetitionModal from '../partite/CompetitionModal';
import CompetitionRulesModal from '../partite/CompetitionRulesModal';
import CompetitionTeamsModal from '../partite/CompetitionTeamsModal';
import ConfirmDeleteModal from '../partite/ConfirmDeleteModal';
import EditMatchModal from '../partite/EditMatchModal';
import MatchEventCard from '../partite/MatchEventCard';
import { useAuth } from '../../context/AuthContext';
import { downloadMatchesTemplate, exportMatchesToXlsx, pickAndParseMatchesXlsx, planMatchesImport } from '../../data/calendarFile';
import { CompetitionTeam, loadCompetitionTeams } from '../../data/competitionTeams';
import { CalendarEvent, loadEvents, saveEvents } from '../../data/events';
import { loadHomeStadium, loadStaffExportPermissions } from '../../data/organization';

/* -------------------------------------------------------------------------- */
/*                                Tipi locali                                 */
/* -------------------------------------------------------------------------- */

type MatchEventRow = CalendarEvent & {
  competition?: string;
  giornata?: string;
  homeAway?: 'CASA' | 'TRASFERTA';
  status?: 'FINISHED' | string;
  score?: { home: number; away: number };
  resultText?: string;
  opponentLogoPath?: string;
};

type NewRound = {
  opponent: string;
  date: string;
  time: string;
  homeAway: 'CASA' | 'TRASFERTA';
  location: string;
  giornata: string;
  opponentLogoPath?: string;
};

/* -------------------------------------------------------------------------- */
/*                              Schermata Partite                             */
/* -------------------------------------------------------------------------- */

const TIME_RE = /^\d{2}:\d{2}$/;
const ALL_COMP = '__ALL__';

export default function PartiteTab() {
  const router = useRouter();
  const { membership } = useAuth();
  const readOnly = membership?.role === 'giocatore';
  const isAdmin = membership?.role === 'admin';
  const [events, setEvents] = useState<MatchEventRow[]>([]);

  // Importa/Esporta/Modello: Admin sempre, Staff solo se l'Admin lo concede da Configurazioni.
  const [staffCanExport, setStaffCanExport] = useState(false);
  useEffect(() => {
    loadStaffExportPermissions().then((p) => setStaffCanExport(p.partite)).catch(() => {});
  }, []);
  const canUseXlsxTools = isAdmin || staffCanExport;

  // modali creazione
  const [showSingleModal, setShowSingleModal] = useState(false);
  const [showCompModal, setShowCompModal] = useState(false);

  // modifica data/ora/luogo (solo Admin)
  const [editingMatch, setEditingMatch] = useState<MatchEventRow | null>(null);

  // cancellazioni
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);

  // elimina competizione
  const [showChooseCompModal, setShowChooseCompModal] = useState(false);
  const [confirmDeleteComp, setConfirmDeleteComp] = useState(false);
  const [compToDelete, setCompToDelete] = useState<string>('—');

  const [busy, setBusy] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showTeamsModal, setShowTeamsModal] = useState(false);

  const refreshEvents = async () => {
    const list = await loadEvents();

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

  useFocusEffect(useCallback(() => { refreshEvents(); }, []));

  const openPartita = (ev: MatchEventRow) => {
    router.push({ pathname: '/eventi/partita/[id]', params: { id: ev.id } });
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

  // modifica data/ora/luogo di una partita già creata (solo Admin)
  const handleSaveEditedMatch = async (
    eventId: string,
    patch: { date: string; time: string; location: string; competition: string; giornata: string }
  ) => {
    setBusy(true);
    try {
      const all: CalendarEvent[] = await loadEvents();
      const normalized = {
        ...patch,
        competition: patch.competition || undefined,
        giornata: patch.giornata || undefined,
      };
      const updated = all.map((ev) => (ev.id === eventId ? { ...ev, ...normalized } : ev));
      await saveEvents(updated);
      setEditingMatch(null);
      refreshEvents();
    } catch {
      Alert.alert('Errore', 'Impossibile salvare le modifiche.');
    } finally {
      setBusy(false);
    }
  };

  // elimina singola
  const actuallyDeleteOne = async () => {
    if (!confirmDeleteId) return;
    setBusy(true);
    const all: CalendarEvent[] = await loadEvents();
    const updated = all.filter((ev) => ev.id !== confirmDeleteId);
    await saveEvents(updated);
    setBusy(false);
    setConfirmDeleteId(null);
    refreshEvents();
  };

  // elimina tutte
  const actuallyDeleteAllMatches = async () => {
    setBusy(true);
    const all: CalendarEvent[] = await loadEvents();
    const keep = all.filter((ev) => ev.type !== 'PARTITA');
    await saveEvents(keep);
    setBusy(false);
    setConfirmDeleteAll(false);
    refreshEvents();
  };

  // elimina competizione
  const actuallyDeleteCompetition = async () => {
    setBusy(true);
    const all: CalendarEvent[] = await loadEvents();
    const keep = all.filter(
      (ev: any) => ev.type !== 'PARTITA' || (ev.type === 'PARTITA' && (ev.competition || '—') !== compToDelete)
    );
    await saveEvents(keep);
    setBusy(false);
    setConfirmDeleteComp(false);
    refreshEvents();
  };

  // crea partita singola
  const handleCreateSingleMatch = async (matchData: {
    date: string;
    time: string;
    opponent: string;
    competition: string;
    giornata: string;
    homeAway: 'CASA' | 'TRASFERTA';
    location: string;
    opponentLogoPath?: string;
  }) => {
    const all: CalendarEvent[] = await loadEvents();

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
      giornata: matchData.giornata || undefined,
      homeAway: matchData.homeAway,
      opponentLogoPath: matchData.opponentLogoPath || undefined,
      formationSlots: undefined,
      benchIds: [],
      tacticsIds: [],
    } as any;

    const updated = [...all, newMatch];
    await saveEvents(updated);
    setShowSingleModal(false);
    refreshEvents();
  };

  // crea calendario competizione
  const handleCreateCompetition = async (competitionData: {
    name: string;
    rounds: NewRound[];
  }) => {
    const all: CalendarEvent[] = await loadEvents();

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
        giornata: r.giornata || undefined,
        homeAway: r.homeAway,
        opponentLogoPath: r.opponentLogoPath || undefined,
        formationSlots: undefined,
        benchIds: [],
        tacticsIds: [],
      } as any);
    });

    if (toAdd.length === 0) { setShowCompModal(false); return; }

    const updated = [...all, ...toAdd];
    await saveEvents(updated);
    setShowCompModal(false);
    refreshEvents();
  };

  const handleExportMatches = async () => {
    try {
      await exportMatchesToXlsx(compFilter === ALL_COMP ? 'tutte' : compFilter, filteredEvents);
    } catch {
      Alert.alert('Errore', 'Impossibile esportare le partite.');
    }
  };

  const handleImportMatches = async () => {
    try {
      const rows = await pickAndParseMatchesXlsx();
      if (!rows) return; // annullato
      if (rows.length === 0) {
        Alert.alert('File vuoto', 'Non ho trovato righe da importare in questo file.');
        return;
      }
      const all = await loadEvents();
      const plan = planMatchesImport(rows, all);
      await plan.apply();
      await refreshEvents();
      Alert.alert('Import completato', `${plan.toInsertCount} nuove partite, ${plan.toUpdateCount} aggiornate.`);
    } catch {
      Alert.alert('Errore', "Impossibile completare l'importazione.");
    }
  };

  const handleDownloadMatchesTemplate = async () => {
    try {
      await downloadMatchesTemplate();
    } catch {
      Alert.alert('Errore', 'Impossibile generare il modello.');
    }
  };

  const renderItem = ({ item }: { item: MatchEventRow }) => {
    const hasScore = !!item?.score && Number.isFinite(item.score?.home) && Number.isFinite(item.score?.away);
    const result = item?.resultText || (hasScore ? `Risultato: ${item.score!.home} - ${item.score!.away}` : null);

    return (
      <View style={{ marginBottom: 8 }}>
        <MatchEventCard
          item={item as any}
          onPress={openPartita as any}
          onEdit={isAdmin ? (ev) => setEditingMatch(ev as MatchEventRow) : undefined}
          onDelete={readOnly ? undefined : (id) => setConfirmDeleteId(id)}
        />
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
    <View style={styles.container}>
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
        {!readOnly && (
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
        )}
      </View>

      {!readOnly && (canUseXlsxTools || compFilter !== ALL_COMP) && (
        <View style={styles.xlsxRow}>
          {canUseXlsxTools && (
            <>
              <Pressable style={styles.xlsxBtn} onPress={handleExportMatches}>
                <Text style={styles.xlsxBtnText}>📤 Esporta Excel</Text>
              </Pressable>
              <Pressable style={styles.xlsxBtn} onPress={handleImportMatches}>
                <Text style={styles.xlsxBtnText}>📥 Importa Excel</Text>
              </Pressable>
              <Pressable style={styles.xlsxBtn} onPress={handleDownloadMatchesTemplate}>
                <Text style={styles.xlsxBtnText}>📄 Modello</Text>
              </Pressable>
            </>
          )}
          {compFilter !== ALL_COMP && (
            <>
              <Pressable style={styles.xlsxBtn} onPress={() => setShowRulesModal(true)}>
                <Text style={styles.xlsxBtnText}>⚙️ Regole</Text>
              </Pressable>
              <Pressable style={styles.xlsxBtn} onPress={() => setShowTeamsModal(true)}>
                <Text style={styles.xlsxBtnText}>🏟️ Squadre</Text>
              </Pressable>
            </>
          )}
        </View>
      )}

      {/* Liste: oggi / future / passate */}
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

      {/* CTA bottom */}
      {!readOnly && (
        <View style={styles.bottomActions}>
          <Pressable style={[styles.cta, { backgroundColor: '#1b7f3b' }]} onPress={() => setShowSingleModal(true)}>
            <Text style={styles.ctaText}>CREA PARTITA</Text>
          </Pressable>
          <Pressable style={[styles.cta, { backgroundColor: '#1b4f7f' }]} onPress={() => setShowCompModal(true)}>
            <Text style={styles.ctaText}>CREA CALENDARIO COMPETIZIONE</Text>
          </Pressable>
        </View>
      )}

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
      {compFilter !== ALL_COMP && (
        <>
          <CompetitionRulesModal
            visible={showRulesModal}
            competition={compFilter}
            onClose={() => setShowRulesModal(false)}
          />
          <CompetitionTeamsModal
            visible={showTeamsModal}
            competition={compFilter}
            onClose={() => setShowTeamsModal(false)}
          />
        </>
      )}

      {/* Modale: modifica data/ora/luogo (solo Admin) */}
      <EditMatchModal
        visible={!!editingMatch}
        event={editingMatch}
        onClose={() => setEditingMatch(null)}
        onSave={handleSaveEditedMatch}
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
    </View>
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
    giornata: string;
    homeAway: 'CASA' | 'TRASFERTA';
    location: string;
    opponentLogoPath?: string;
  }) => void;
}) {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [opponent, setOpponent] = useState('');
  const [competition, setCompetition] = useState('');
  const [giornata, setGiornata] = useState('');
  const [homeAway, setHomeAway] = useState<'CASA' | 'TRASFERTA'>('CASA');
  const [location, setLocation] = useState('');
  const [opponentLogoPath, setOpponentLogoPath] = useState<string | undefined>(undefined);
  const [teams, setTeams] = useState<CompetitionTeam[]>([]);
  const [homeStadium, setHomeStadium] = useState('');
  // true finché il Luogo è stato scritto dall'automatismo (stadio squadra/stadio di casa) e non
  // ancora toccato a mano — permette di ricalcolarlo cambiando Casa/Trasferta o squadra, senza mai
  // sovrascrivere un Luogo scritto a mano dall'utente.
  const [locationAuto, setLocationAuto] = useState(false);

  const canSave = date && TIME_RE.test(time) && opponent && location;

  const reset = () => {
    setDate(''); setTime(''); setOpponent(''); setCompetition(''); setGiornata(''); setHomeAway('CASA'); setLocation('');
    setOpponentLogoPath(undefined);
    setLocationAuto(false);
  };

  useEffect(() => {
    if (visible) loadHomeStadium().then(setHomeStadium).catch(() => {});
  }, [visible]);

  useEffect(() => {
    const name = competition.trim();
    if (!name) { setTeams([]); return; }
    loadCompetitionTeams(name).then(setTeams).catch(() => setTeams([]));
  }, [competition]);

  // Scelta rapida di una squadra configurata per questa competizione: riusa nome, stadio (per il
  // Luogo, se non già scritto a mano o comunque frutto dell'automatismo) e stemma — stessa logica
  // di CompetitionModal.
  const pickTeam = (team: CompetitionTeam) => {
    setOpponent(team.name);
    setOpponentLogoPath(team.logoPath || undefined);
    if (!location || locationAuto) {
      const auto = homeAway === 'CASA' ? homeStadium : team.stadium;
      if (auto) { setLocation(auto); setLocationAuto(true); }
    }
  };

  const handleHomeAwayChange = (value: 'CASA' | 'TRASFERTA') => {
    setHomeAway(value);
    if (!location || locationAuto) {
      const auto = value === 'CASA' ? homeStadium : teams.find((t) => t.name === opponent)?.stadium;
      if (auto) { setLocation(auto); setLocationAuto(true); }
    }
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
          <TextInput
            value={opponent}
            onChangeText={(v) => { setOpponent(v); setOpponentLogoPath(undefined); }}
            placeholder="Es. Real Quartiere"
            style={styles.input}
          />
          {teams.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
              {teams.map((t) => (
                <Pressable
                  key={t.id}
                  style={[styles.teamChip, opponent === t.name && styles.teamChipActive]}
                  onPress={() => pickTeam(t)}
                >
                  {t.logoUrl && <Image source={{ uri: t.logoUrl }} style={styles.teamChipLogo} />}
                  <Text style={[styles.teamChipText, opponent === t.name && styles.teamChipTextActive]}>{t.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}

          <Text style={styles.label}>Competizione (opzionale)</Text>
          <TextInput value={competition} onChangeText={setCompetition} placeholder="Es. Coppa CSI" style={styles.input} />

          <Text style={styles.label}>Giornata (opzionale)</Text>
          <TextInput value={giornata} onChangeText={setGiornata} placeholder="Es. 25" style={styles.input} />

          <Text style={styles.label}>Casa/Trasferta</Text>
          <View style={styles.pickerWrap}>
            <Picker selectedValue={homeAway} onValueChange={handleHomeAwayChange}>
              <Picker.Item value="CASA" label="CASA" />
              <Picker.Item value="TRASFERTA" label="TRASFERTA" />
            </Picker>
          </View>

          <Text style={styles.label}>Luogo</Text>
          <TextInput
            value={location}
            onChangeText={(v) => { setLocation(v); setLocationAuto(false); }}
            placeholder="Campo Comunale"
            style={styles.input}
          />

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <Pressable style={[styles.cta, { backgroundColor: '#9ca3af', flex: 1 }]} onPress={() => { reset(); onClose(); }}>
              <Text style={styles.ctaText}>Annulla</Text>
            </Pressable>
            <Pressable
              style={[styles.cta, { backgroundColor: '#1b7f3b', flex: 1, opacity: canSave ? 1 : 0.6 }]}
              disabled={!canSave}
              onPress={() => {
                onCreateMatch({ date, time, opponent, competition, giornata, homeAway, location, opponentLogoPath });
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
  container: { flex: 1 },

  // Filtri
  filtersRow: { marginBottom: 8 },
  filterBlock: { marginBottom: 8 },
  filterLabel: { fontWeight: '700', marginBottom: 6, color: '#111827' },

  topActions: { flexDirection: 'row', gap: 8 },
  outlineBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, backgroundColor: '#fff' },
  outlineText: { fontWeight: '800' },

  xlsxRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  xlsxBtn: { flex: 1, backgroundColor: '#eef2f7', borderRadius: 10, paddingVertical: 8, alignItems: 'center' },
  xlsxBtnText: { color: '#1a202c', fontWeight: '700', fontSize: 13 },

  bottomActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  cta: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center' },
  ctaText: { color: 'white', fontWeight: '800' },

  teamChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderColor: '#d1d5db', borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 5, marginRight: 6, backgroundColor: '#fff',
  },
  teamChipActive: { backgroundColor: '#1b7f3b', borderColor: '#1b7f3b' },
  teamChipLogo: { width: 16, height: 16, resizeMode: 'contain' },
  teamChipText: { fontSize: 12, fontWeight: '600', color: '#374151' },
  teamChipTextActive: { color: '#fff' },

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
