// app/components/EventEditorModal.tsx
import { Picker } from '@react-native-picker/picker';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { loadEvents, saveEvents, type CalendarEvent } from '../data/events';

export type EventType = 'PARTITA' | 'ALLENAMENTO';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  /** Data da precompilare (YYYY-MM-DD) quando si apre dal calendario */
  initialDate?: string;
  /** Nuovo nome prop per il tipo iniziale dell’editor */
  initialType?: EventType;
  /** Alias legacy per compatibilità (evita l’errore “property 'type' does not exist”) */
  type?: EventType;
};

const TIME_RE = /^\d{2}:\d{2}$/;

export default function EventEditorModal({
  visible,
  onClose,
  onSaved,
  initialDate,
  initialType,
  type: legacyType,
}: Props) {
  const defaultType: EventType = useMemo(
    () => initialType || legacyType || 'PARTITA',
    [initialType, legacyType]
  );

  const [tab, setTab] = useState<EventType>(defaultType);

  // campi comuni
  const [date, setDate] = useState<string>(initialDate || '');
  const [time, setTime] = useState<string>('');
  const [location, setLocation] = useState<string>('');

  // campi PARTITA
  const [opponent, setOpponent] = useState<string>('');
  const [competition, setCompetition] = useState<string>('');
  const [homeAway, setHomeAway] = useState<'CASA' | 'TRASFERTA'>('CASA');

  // campi ALLENAMENTO
  const [temaAllenamento, setTemaAllenamento] = useState<string>('');

  // reset quando si apre/chiude o cambia il tipo iniziale
  useEffect(() => {
    if (!visible) return;
    setTab(defaultType);
    setDate(initialDate || '');
    setTime('');
    setLocation('');
    setOpponent('');
    setCompetition('');
    setHomeAway('CASA');
    setTemaAllenamento('');
  }, [visible, defaultType, initialDate]);

  const canSave = useMemo(() => {
    if (!date || !TIME_RE.test(time) || !location) return false;
    if (tab === 'PARTITA') {
      return !!opponent;
    }
    // ALLENAMENTO
    return true;
  }, [tab, date, time, location, opponent]);

  const actuallySave = async () => {
    if (!canSave) return;
    const all: CalendarEvent[] = await loadEvents();

    if (tab === 'PARTITA') {
      // dedupe minima su data/ora/avversario/competizione
      const exists = all.some(
        (ev: any) =>
          ev.type === 'PARTITA' &&
          ev.date === date &&
          ev.time === time &&
          (ev.opponent || '') === opponent &&
          (ev.competition || '') === (competition || '')
      );
      if (exists) {
        onClose();
        return;
      }
      const item: CalendarEvent = {
        id: `${Date.now()}-${date}-${time}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'PARTITA',
        date,
        time,
        location,
        opponent,
        competition: competition || undefined,
        homeAway,
        formationSlots: undefined,
        benchIds: [],
        tacticsIds: [],
      } as any;
      await saveEvents([...all, item]);
    } else {
      // ALLENAMENTO
      const exists = all.some(
        (ev: any) => ev.type === 'ALLENAMENTO' && ev.date === date && ev.time === time && (ev.location || '') === location
      );
      if (exists) {
        onClose();
        return;
      }
      const item: CalendarEvent = {
        id: `${Date.now()}-${date}-${time}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'ALLENAMENTO',
        date,
        time,
        location,
        temaAllenamento: temaAllenamento || undefined,
        presenze: {},
        formationSlots: undefined,
        benchIds: [],
        tacticsIds: [],
      } as any;
      await saveEvents([...all, item]);
    }

    onClose();
    onSaved();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Nuovo evento</Text>

          {/* Tabs tipo evento */}
          <View style={styles.tabsRow}>
            <Pressable
              style={[styles.tabBtn, tab === 'PARTITA' && styles.tabActive]}
              onPress={() => setTab('PARTITA')}
            >
              <Text style={[styles.tabText, tab === 'PARTITA' && styles.tabTextActive]}>Partita</Text>
            </Pressable>
            <Pressable
              style={[styles.tabBtn, tab === 'ALLENAMENTO' && styles.tabActive]}
              onPress={() => setTab('ALLENAMENTO')}
            >
              <Text style={[styles.tabText, tab === 'ALLENAMENTO' && styles.tabTextActive]}>Allenamento</Text>
            </Pressable>
          </View>

          {/* Contenuto scrollabile (così su smartphone non “sparisce”) */}
          <ScrollView contentContainerStyle={{ paddingBottom: 12 }}>
            <Text style={styles.label}>Data (YYYY-MM-DD)</Text>
            <TextInput
              value={date}
              onChangeText={setDate}
              placeholder="2025-08-23"
              style={styles.input}
              autoCapitalize="none"
            />

            <Text style={styles.label}>Ora (HH:MM)</Text>
            <TextInput
              value={time}
              onChangeText={setTime}
              placeholder="16:30"
              style={styles.input}
              autoCapitalize="none"
            />

            <Text style={styles.label}>Luogo</Text>
            <TextInput
              value={location}
              onChangeText={setLocation}
              placeholder={tab === 'PARTITA' ? 'Stadio Comunale' : 'Campo di allenamento'}
              style={styles.input}
            />

            {tab === 'PARTITA' ? (
              <>
                <Text style={styles.label}>Avversario</Text>
                <TextInput
                  value={opponent}
                  onChangeText={setOpponent}
                  placeholder="Es. Real Quartiere"
                  style={styles.input}
                />

                <Text style={styles.label}>Competizione (opzionale)</Text>
                <TextInput
                  value={competition}
                  onChangeText={setCompetition}
                  placeholder="Es. Coppa CSI"
                  style={styles.input}
                />

                <Text style={styles.label}>Casa/Trasferta</Text>
                <View style={styles.pickerWrap}>
                  <Picker selectedValue={homeAway} onValueChange={(v) => setHomeAway(v)}>
                    <Picker.Item value="CASA" label="CASA" />
                    <Picker.Item value="TRASFERTA" label="TRASFERTA" />
                  </Picker>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.label}>Tema allenamento (opzionale)</Text>
                <TextInput
                  value={temaAllenamento}
                  onChangeText={setTemaAllenamento}
                  placeholder="Es. Possesso palla / Tattica"
                  style={styles.input}
                />
              </>
            )}

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <Pressable style={[styles.cta, { backgroundColor: '#9ca3af', flex: 1 }]} onPress={onClose}>
                <Text style={styles.ctaText}>Annulla</Text>
              </Pressable>
              <Pressable
                style={[styles.cta, { backgroundColor: '#1b7f3b', flex: 1, opacity: canSave ? 1 : 0.6 }]}
                disabled={!canSave}
                onPress={actuallySave}
              >
                <Text style={styles.ctaText}>Salva</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/* --------------------------------- STILI --------------------------------- */

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  sheet: { backgroundColor: 'white', borderRadius: 12, width: '92%', maxWidth: 520, maxHeight: '92%', padding: 16 },
  title: { fontSize: 18, fontWeight: '800', marginBottom: 10 },

  tabsRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  tabBtn: { flex: 1, backgroundColor: '#eef2f7', paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  tabActive: { backgroundColor: '#1b7f3b' },
  tabText: { fontWeight: '800', color: '#111' },
  tabTextActive: { color: 'white' },

  label: { fontWeight: '700', marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 6,
    backgroundColor: 'white',
  },

  pickerWrap: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#fafafa',
    marginTop: 6,
  },

  cta: { padding: 12, borderRadius: 8, alignItems: 'center' },
  ctaText: { color: 'white', fontWeight: '800' },
});
