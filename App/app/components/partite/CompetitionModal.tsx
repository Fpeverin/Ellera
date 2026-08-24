// app/components/partite/CompetitionModal.tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { CompetitionTeam, loadCompetitionTeams } from '../../data/competitionTeams';
import { loadHomeStadium } from '../../data/organization';
import CompetitionTeamsModal from './CompetitionTeamsModal';

type CalendarDay = {
  dateString: string;
  day: number;
  month: number;
  year: number;
  timestamp: number;
};

type NewRound = {
  opponent: string;
  date: string;
  time: string;
  homeAway: 'CASA' | 'TRASFERTA';
  location: string;
  giornata: string;
  opponentLogoPath?: string;
  /** true finché il Luogo è stato scritto dall'automatismo (stadio squadra/stadio di casa) e non
   * ancora toccato a mano — permette di ricalcolarlo quando si cambia Casa/Trasferta o si sceglie
   * un'altra squadra, senza però mai sovrascrivere un Luogo scritto a mano dall'utente. */
  locationAuto?: boolean;
};

interface CompetitionModalProps {
  visible: boolean;
  onClose: () => void;
  onCreateCompetition: (competitionData: {
    name: string;
    rounds: NewRound[];
  }) => void;
}

const TIME_RE = /^\d{2}:\d{2}$/;

export default function CompetitionModal({ visible, onClose, onCreateCompetition }: CompetitionModalProps) {
  const [compName, setCompName] = useState('');
  const [roundsCount, setRoundsCount] = useState('10');
  const [rounds, setRounds] = useState<NewRound[]>([]);
  const [datePickerRoundIdx, setDatePickerRoundIdx] = useState<number | null>(null);
  const [teams, setTeams] = useState<CompetitionTeam[]>([]);
  const [homeStadium, setHomeStadium] = useState('');
  const [showTeamsModal, setShowTeamsModal] = useState(false);

  useEffect(() => {
    if (visible) loadHomeStadium().then(setHomeStadium).catch(() => {});
  }, [visible]);

  const reloadTeams = () => {
    const name = compName.trim();
    if (!name) { setTeams([]); return; }
    loadCompetitionTeams(name).then(setTeams).catch(() => setTeams([]));
  };

  useEffect(() => {
    if (!visible) return;
    reloadTeams();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, compName]);

  /** Luogo automatico da proporre (solo se il round non ne ha già uno scritto a mano): lo stadio
   * di casa configurato in Admin se giochiamo in CASA, lo stadio della squadra scelta (se
   * configurato) se giochiamo in TRASFERTA. */
  const computeAutoLocation = (opponent: string, homeAway: 'CASA' | 'TRASFERTA'): string | undefined => {
    if (homeAway === 'CASA') return homeStadium || undefined;
    return teams.find((t) => t.name === opponent)?.stadium || undefined;
  };

  const generateRounds = (n: number) => {
    const arr: NewRound[] = [];
    for (let i = 0; i < n; i++) {
      arr.push({
        opponent: '',
        date: '',
        time: '',
        homeAway: 'CASA',
        location: '',
        // Numero di giornata di partenza — coincide con l'ordine di creazione ma resta modificabile
        // per ogni round (rinvii/recuperi possono spostare una partita fuori dal suo ordine naturale).
        giornata: String(i + 1),
      });
    }
    return arr;
  };

  const resetForm = () => {
    setCompName('');
    setRoundsCount('10');
    setRounds(generateRounds(10));
    setDatePickerRoundIdx(null);
  };

  const onChangeRoundsCount = (val: string) => {
    setRoundsCount(val);
    const n = Math.max(0, Math.min(50, parseInt(val || '0', 10)));
    setRounds(generateRounds(Number.isNaN(n) ? 0 : n));
  };

  const validRound = (r: NewRound) =>
    !!r.opponent && !!r.location && !!r.date && TIME_RE.test(r.time);

  const canCreateCompetition = useMemo(() => {
    if (!compName || rounds.length === 0) return false;
    return rounds.some(validRound);
  }, [compName, rounds]);

  const handleCreate = async () => {
    if (!canCreateCompetition) return;
    // Rilettura finale delle squadre appena prima di creare: se lo stemma di una squadra è stato
    // caricato DOPO averla già scelta per un round (es. squadra aggiunta al volo, stemma caricato
    // con un secondo tocco), il round potrebbe avere ancora `opponentLogoPath` vuoto pur avendo
    // l'avversario giusto — qui lo recupera per nome invece di scartarlo.
    const freshTeams = compName.trim() ? await loadCompetitionTeams(compName.trim()).catch(() => teams) : teams;
    const finalRounds = rounds.map((r) => {
      if (r.opponentLogoPath) return r;
      const match = freshTeams.find((t) => t.name === r.opponent);
      return match?.logoPath ? { ...r, opponentLogoPath: match.logoPath } : r;
    });
    onCreateCompetition({
      name: compName,
      rounds: finalRounds,
    });
    resetForm();
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const updateRound = (idx: number, field: keyof NewRound, value: string | 'CASA' | 'TRASFERTA') => {
    const updated = [...rounds];
    const round = { ...updated[idx], [field]: value } as NewRound;
    if (field === 'location') {
      round.locationAuto = false; // modifica manuale: non va più sovrascritto dall'automatismo
    }
    if ((field === 'opponent' || field === 'homeAway') && (!round.location || round.locationAuto)) {
      const auto = computeAutoLocation(round.opponent, round.homeAway);
      if (auto) {
        round.location = auto;
        round.locationAuto = true;
      }
    }
    updated[idx] = round;
    setRounds(updated);
  };

  /** Scelta di una squadra configurata dai chip: oltre al nome, riusa automaticamente stadio
   * (per il Luogo, se non già scritto a mano o comunque frutto dell'automatismo) e stemma della
   * squadra per questo round. */
  const pickTeamForRound = (idx: number, team: CompetitionTeam) => {
    const updated = [...rounds];
    const round = { ...updated[idx], opponent: team.name, opponentLogoPath: team.logoPath || undefined };
    if (!round.location || round.locationAuto) {
      const auto = computeAutoLocation(round.opponent, round.homeAway);
      if (auto) {
        round.location = auto;
        round.locationAuto = true;
      }
    }
    updated[idx] = round;
    setRounds(updated);
  };

  // Initialize rounds when modal opens
  React.useEffect(() => {
    if (visible && rounds.length === 0) {
      setRounds(generateRounds(10));
    }
  }, [visible]);

  return (
    <>
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.modalTitle}>Calendario Competizione</Text>
          <ScrollView contentContainerStyle={{ paddingBottom: 16 }}>
            <Text style={styles.label}>Competizione</Text>
            <TextInput
              value={compName}
              onChangeText={setCompName}
              placeholder="Esempio: Coppa / Campionato"
              style={[styles.input, !compName && styles.inputWarn]}
            />
            <Pressable
              style={[styles.teamsConfigBtn, !compName.trim() && { opacity: 0.5 }]}
              onPress={() => setShowTeamsModal(true)}
              disabled={!compName.trim()}
            >
              <Text style={styles.teamsConfigBtnText}>🏟️ Configura Squadre della competizione</Text>
            </Pressable>

            <Text style={styles.label}>Numero giornate</Text>
            <TextInput
              value={roundsCount}
              onChangeText={onChangeRoundsCount}
              placeholder="10"
              keyboardType="numeric"
              style={styles.input}
            />

            {rounds.map((r, idx) => {
              const rowErr = {
                date: !r.date,
                time: !TIME_RE.test(r.time),
                opponent: !r.opponent,
                location: !r.location,
              };
              return (
                <View key={idx} style={styles.roundCard}>
                  <Text style={styles.roundTitle}>Round {idx + 1}</Text>

                  <Text style={styles.labelMini}>Giornata</Text>
                  <TextInput
                    value={r.giornata}
                    onChangeText={(val) => updateRound(idx, 'giornata', val)}
                    placeholder={String(idx + 1)}
                    style={styles.inputMini}
                  />

                  <Text style={styles.labelMini}>Avversario</Text>
                  <TextInput
                    value={r.opponent}
                    onChangeText={(val) => updateRound(idx, 'opponent', val)}
                    placeholder="Nome avversario"
                    style={[styles.inputMini, rowErr.opponent && styles.inputError]}
                  />
                  {teams.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.teamChipsRow}>
                      {teams.map((t) => (
                        <Pressable
                          key={t.id}
                          style={[styles.teamChip, r.opponent === t.name && styles.teamChipActive]}
                          onPress={() => pickTeamForRound(idx, t)}
                        >
                          {t.logoUrl && <Image source={{ uri: t.logoUrl }} style={styles.teamChipLogo} />}
                          <Text style={[styles.teamChipText, r.opponent === t.name && styles.teamChipTextActive]}>
                            {t.name}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  )}

                  <Text style={styles.labelMini}>Data</Text>
                  <View style={styles.dateRow}>
                    <Text style={[styles.dateDisplay, rowErr.date && styles.dateError]}>
                      {r.date || '— (seleziona)'}
                    </Text>
                    <Pressable
                      style={styles.dateBtn}
                      onPress={() => setDatePickerRoundIdx(datePickerRoundIdx === idx ? null : idx)}
                    >
                      <Text style={styles.dateBtnText}>📅</Text>
                    </Pressable>
                  </View>

                  {datePickerRoundIdx === idx && (
                    <Calendar
                      onDayPress={(day: CalendarDay) => {
                        updateRound(idx, 'date', day.dateString);
                        setDatePickerRoundIdx(null);
                      }}
                      markedDates={r.date ? { [r.date]: { selected: true, selectedColor: '#1b7f3b' } } : {}}
                      theme={{ todayTextColor: '#1b7f3b', selectedDayBackgroundColor: '#1b7f3b' }}
                    />
                  )}

                  <Text style={styles.labelMini}>Ora (HH:mm)</Text>
                  <TextInput
                    value={r.time}
                    onChangeText={(val) => updateRound(idx, 'time', val)}
                    placeholder="15:00"
                    style={[styles.inputMini, rowErr.time && styles.inputError]}
                    autoCapitalize="none"
                  />

                  <Text style={styles.labelMini}>Casa/Trasferta</Text>
                  <View style={styles.toggleRow}>
                    <Pressable
                      style={[styles.toggleBtn, r.homeAway === 'CASA' && styles.toggleBtnActive]}
                      onPress={() => updateRound(idx, 'homeAway', 'CASA')}
                    >
                      <Text style={[styles.toggleText, r.homeAway === 'CASA' && styles.toggleTextActive]}>CASA</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.toggleBtn, r.homeAway === 'TRASFERTA' && styles.toggleBtnActive]}
                      onPress={() => updateRound(idx, 'homeAway', 'TRASFERTA')}
                    >
                      <Text style={[styles.toggleText, r.homeAway === 'TRASFERTA' && styles.toggleTextActive]}>TRASFERTA</Text>
                    </Pressable>
                  </View>

                  <Text style={styles.labelMini}>Luogo</Text>
                  <TextInput
                    value={r.location}
                    onChangeText={(val) => updateRound(idx, 'location', val)}
                    placeholder="Campo/Stadio"
                    style={[styles.inputMini, rowErr.location && styles.inputError]}
                  />

                  <View style={styles.validationRow}>
                    <Text style={styles.validationText}>
                      {validRound(r) ? '✅ Completa' : '⚠️ Incompleta'}
                    </Text>
                  </View>
                </View>
              );
            })}

            <View style={styles.summary}>
              <Text style={styles.summaryTitle}>Riepilogo</Text>
              <Text style={styles.summaryText}>
                Competizione: {compName || '(non specificata)'}
              </Text>
              <Text style={styles.summaryText}>
                Giornate valide: {rounds.filter(validRound).length} / {rounds.length}
              </Text>
            </View>

            <Pressable
              style={[styles.createBtn, !canCreateCompetition && { opacity: 0.6 }]}
              disabled={!canCreateCompetition}
              onPress={handleCreate}
            >
              <Text style={styles.createText}>CREA CALENDARIO</Text>
            </Pressable>
            <Pressable style={styles.cancelBtn} onPress={handleClose}>
              <Text style={styles.cancelText}>Chiudi</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
    <CompetitionTeamsModal
      visible={showTeamsModal}
      competition={compName.trim()}
      onClose={() => {
        setShowTeamsModal(false);
        reloadTeams();
      }}
    />
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: 'white',
    borderRadius: 16,
    width: '95%',
    maxHeight: '95%',
    padding: 16,
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 6,
  },
  labelMini: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 10,
    fontSize: 16,
  },
  inputMini: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    padding: 8,
    fontSize: 14,
  },
  inputWarn: {
    borderColor: '#f59e0b',
  },
  inputError: {
    borderColor: '#b91c1c',
  },
  teamsConfigBtn: {
    marginTop: 8,
    backgroundColor: '#eef2f7',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  teamsConfigBtnText: { color: '#1b4f7f', fontWeight: '700', fontSize: 13 },
  teamChipsRow: { marginTop: 6 },
  teamChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderColor: '#d1d5db', borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 5, marginRight: 6, backgroundColor: '#fff',
  },
  teamChipActive: { backgroundColor: '#1b4f7f', borderColor: '#1b4f7f' },
  teamChipLogo: { width: 16, height: 16, resizeMode: 'contain' },
  teamChipText: { fontSize: 12, fontWeight: '600', color: '#374151' },
  teamChipTextActive: { color: '#fff' },
  roundCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 12,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  roundTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
    color: '#1f2937',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateDisplay: {
    flex: 1,
    padding: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    fontSize: 14,
  },
  dateError: {
    borderColor: '#b91c1c',
    color: '#b91c1c',
  },
  dateBtn: {
    padding: 8,
    backgroundColor: '#1b7f3b',
    borderRadius: 4,
  },
  dateBtnText: {
    fontSize: 16,
    color: 'white',
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 4,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    alignItems: 'center',
  },
  toggleBtnActive: {
    backgroundColor: '#1b7f3b',
    borderColor: '#1b7f3b',
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  toggleTextActive: {
    color: 'white',
  },
  validationRow: {
    alignItems: 'center',
    marginTop: 8,
  },
  validationText: {
    fontSize: 12,
    fontWeight: '600',
  },
  summary: {
    backgroundColor: '#f0f9ff',
    padding: 12,
    borderRadius: 8,
    marginVertical: 16,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  summaryText: {
    fontSize: 13,
    marginBottom: 2,
  },
  createBtn: {
    backgroundColor: '#1b4f7f',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  createText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  cancelBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  cancelText: {
    color: '#666',
    fontSize: 16,
  },
});