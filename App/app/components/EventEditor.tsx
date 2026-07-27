// app/components/EventEditor.tsx
import { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { CalendarEvent, EventType, loadEvents, saveEvents } from '../data/events';

type Props = {
  initialType: EventType;       // 'PARTITA' | 'ALLENAMENTO'
  initialDate?: string;         // YYYY-MM-DD (opzionale, es. dalla dashboard)
  defaultDate?: string;         // fallback
  defaultTime?: string;         // HH:mm
  onSaved?: (ev: CalendarEvent) => void;
  onCancel?: () => void;
};

export default function EventEditor({
  initialType,
  initialDate,
  defaultDate,
  defaultTime,
  onSaved,
  onCancel,
}: Props) {
  const [type] = useState<EventType>(initialType);
  const [date, setDate] = useState<string>(initialDate ?? defaultDate ?? '');
  const [time, setTime] = useState<string>(defaultTime ?? '');
  const [location, setLocation] = useState<string>('');
  const [opponent, setOpponent] = useState<string>('');          // solo per PARTITA
  const [temaAllenamento, setTemaAllenamento] = useState<string>(''); // solo per ALLENAMENTO

  const isPartita = type === 'PARTITA';

  const canSave = useMemo(() => {
    if (!date || !time || !location) return false;
    if (isPartita && !opponent) return false;
    return true;
  }, [date, time, location, opponent, isPartita]);

  const save = async () => {
    const list = await loadEvents();

    const id = `${Date.now()}`;
    const newEvent: CalendarEvent = {
      id,
      type,
      date,
      time,
      location,
      opponent: isPartita ? opponent : undefined,
      // opzionali supportati dal tuo schema:
      module: undefined,
      formationSlots: undefined,
      benchIds: [],
      tacticsIds: [],
      presenze: type === 'ALLENAMENTO' ? {} : undefined,
      temaAllenamento: type === 'ALLENAMENTO' ? (temaAllenamento || undefined) : undefined,
    };

    const updated = [...list, newEvent];
    await saveEvents(updated);
    onSaved?.(newEvent);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Nuovo {isPartita ? 'Match' : 'Allenamento'}</Text>

      <Text style={styles.label}>Data (YYYY-MM-DD)</Text>
      <TextInput
        value={date}
        onChangeText={setDate}
        placeholder="2025-08-17"
        style={styles.input}
        autoCapitalize="none"
      />

      <Text style={styles.label}>Orario (HH:mm)</Text>
      <TextInput
        value={time}
        onChangeText={setTime}
        placeholder="20:45"
        style={styles.input}
        autoCapitalize="none"
      />

      <Text style={styles.label}>Luogo</Text>
      <TextInput
        value={location}
        onChangeText={setLocation}
        placeholder="Stadio Comunale"
        style={styles.input}
      />

      {isPartita ? (
        <>
          <Text style={styles.label}>Avversario</Text>
          <TextInput
            value={opponent}
            onChangeText={setOpponent}
            placeholder="Tiferno"
            style={styles.input}
          />
        </>
      ) : (
        <>
          <Text style={styles.label}>Tema allenamento (opzionale)</Text>
          <TextInput
            value={temaAllenamento}
            onChangeText={setTemaAllenamento}
            placeholder="Possesso, rifinitura, palle inattive..."
            style={styles.input}
          />
        </>
      )}

      <View style={styles.row}>
        <Pressable style={[styles.btn, styles.btnCancel]} onPress={onCancel}>
          <Text style={styles.btnText}>Annulla</Text>
        </Pressable>
        <Pressable
          style={[styles.btn, canSave ? styles.btnSave : styles.btnDisabled]}
          onPress={save}
          disabled={!canSave}
        >
          <Text style={styles.btnText}>Salva</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingTop: Platform.OS === 'web' ? 24 : 16, backgroundColor: '#fff', flex: 1 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  label: { marginTop: 10, fontWeight: '600' },
  input: {
    borderWidth: 1, borderColor: '#ccc', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8, marginTop: 6,
  },
  row: { flexDirection: 'row', gap: 8, marginTop: 16 },
  btn: { flex: 1, padding: 12, borderRadius: 6, alignItems: 'center' },
  btnCancel: { backgroundColor: '#999' },
  btnSave: { backgroundColor: '#1b7f3b' },
  btnDisabled: { backgroundColor: '#c9c9c9' },
  btnText: { color: 'white', fontWeight: '700' },
});
