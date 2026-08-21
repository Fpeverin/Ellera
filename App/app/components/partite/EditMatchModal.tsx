// app/components/partite/EditMatchModal.tsx
//
// Modifica di data/ora/luogo di una partita già creata — solo Admin (richiesta di Francesco,
// 2026-08-22: prima non c'era alcun modo di correggere questi campi dopo la creazione, se non
// eliminare e ricreare la partita). Non tocca avversario/competizione/casa-trasferta: cambiarli
// significherebbe sostituire la partita, non correggerne data/ora/luogo.
import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { CalendarEvent } from '../../data/events';

type CalendarDay = { dateString: string };

interface EditMatchModalProps {
  visible: boolean;
  event: CalendarEvent | null;
  onClose: () => void;
  onSave: (eventId: string, patch: { date: string; time: string; location: string }) => void;
}

const TIME_RE = /^\d{2}:\d{2}$/;

export default function EditMatchModal({ visible, event, onClose, onSave }: EditMatchModalProps) {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');

  // Riparte dai valori della partita ogni volta che si apre (o si cambia partita da modificare).
  useEffect(() => {
    if (event) {
      setDate(event.date || '');
      setTime(event.time || '');
      setLocation(event.location || '');
    }
  }, [event]);

  const errors = useMemo(
    () => ({ date: !date, time: !TIME_RE.test(time), location: !location }),
    [date, time, location]
  );
  const canSave = !errors.date && !errors.time && !errors.location;

  const handleSave = () => {
    if (!event || !canSave) return;
    onSave(event.id, { date, time, location });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.modalTitle}>Modifica Partita</Text>
          {event?.opponent && <Text style={styles.subtitle}>vs {event.opponent}</Text>}
          <ScrollView contentContainerStyle={{ paddingBottom: 16 }}>
            <Text style={styles.label}>Data</Text>
            <Calendar
              current={date || undefined}
              onDayPress={(day: CalendarDay) => setDate(day.dateString)}
              markedDates={date ? { [date]: { selected: true, selectedColor: '#1b7f3b' } } : {}}
              theme={{ todayTextColor: '#1b7f3b', selectedDayBackgroundColor: '#1b7f3b' }}
            />
            <View style={styles.rangeRow}>
              <Text style={{ fontWeight: '700' }}>Data:</Text>
              <Text style={{ marginLeft: 6, color: errors.date ? '#b91c1c' : '#111' }}>
                {date || '— (obbligatoria)'}
              </Text>
            </View>

            <Text style={styles.label}>Ora (HH:mm)</Text>
            <TextInput
              value={time}
              onChangeText={setTime}
              placeholder="15:00"
              style={[styles.input, errors.time && styles.inputError]}
              autoCapitalize="none"
            />
            {errors.time && <Text style={styles.errorMsg}>Formato orario non valido (usa HH:mm)</Text>}

            <Text style={styles.label}>Luogo</Text>
            <TextInput
              value={location}
              onChangeText={setLocation}
              placeholder="Stadio / Campo"
              style={[styles.input, errors.location && styles.inputError]}
            />
            {errors.location && <Text style={styles.errorMsg}>Campo obbligatorio</Text>}

            <Pressable style={[styles.saveBtn, !canSave && { opacity: 0.6 }]} disabled={!canSave} onPress={handleSave}>
              <Text style={styles.saveText}>SALVA MODIFICHE</Text>
            </Pressable>
            <Pressable style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Annulla</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: 'white', borderRadius: 16, width: '92%', maxHeight: '92%',
    padding: 16, alignSelf: 'center', marginBottom: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#6b7280', textAlign: 'center', marginBottom: 12 },
  label: { fontSize: 14, fontWeight: '600', marginTop: 12, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 6, padding: 10, fontSize: 16 },
  inputError: { borderColor: '#b91c1c' },
  errorMsg: { fontSize: 12, color: '#b91c1c', marginTop: 4 },
  rangeRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 8 },
  saveBtn: { backgroundColor: '#1b7f3b', paddingVertical: 14, borderRadius: 8, alignItems: 'center', marginTop: 16 },
  saveText: { color: 'white', fontSize: 16, fontWeight: '700' },
  cancelBtn: { paddingVertical: 12, alignItems: 'center', marginTop: 8 },
  cancelText: { color: '#666', fontSize: 16 },
});
