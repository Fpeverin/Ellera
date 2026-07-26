// app/components/partite/SingleMatchModal.tsx
import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Calendar } from 'react-native-calendars';

type CalendarDay = {
  dateString: string;
  day: number;
  month: number;
  year: number;
  timestamp: number;
};

interface SingleMatchModalProps {
  visible: boolean;
  onClose: () => void;
  onCreateMatch: (matchData: {
    date: string;
    time: string;
    opponent: string;
    competition: string;
    homeAway: 'CASA' | 'TRASFERTA';
    location: string;
  }) => void;
}

const TIME_RE = /^\d{2}:\d{2}$/;

export default function SingleMatchModal({ visible, onClose, onCreateMatch }: SingleMatchModalProps) {
  const [singleDate, setSingleDate] = useState<string>('');
  const [singleTime, setSingleTime] = useState<string>('');
  const [singleOpponent, setSingleOpponent] = useState<string>('');
  const [singleCompetition, setSingleCompetition] = useState<string>('');
  const [singleHA, setSingleHA] = useState<'CASA' | 'TRASFERTA'>('CASA');
  const [singleLocation, setSingleLocation] = useState<string>('');

  const resetForm = () => {
    setSingleDate('');
    setSingleTime('');
    setSingleOpponent('');
    setSingleCompetition('');
    setSingleHA('CASA');
    setSingleLocation('');
  };

  const singleErrors = useMemo(() => {
    return {
      date: !singleDate,
      time: !TIME_RE.test(singleTime),
      opponent: !singleOpponent,
      location: !singleLocation,
    };
  }, [singleDate, singleTime, singleOpponent, singleLocation]);

  const canCreateSingle = useMemo(() => {
    return !singleErrors.date && !singleErrors.time && !singleErrors.opponent && !singleErrors.location;
  }, [singleErrors]);

  const handleCreate = () => {
    if (!canCreateSingle) return;
    onCreateMatch({
      date: singleDate,
      time: singleTime,
      opponent: singleOpponent,
      competition: singleCompetition,
      homeAway: singleHA,
      location: singleLocation,
    });
    resetForm();
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.modalTitle}>Crea Partita</Text>
          <ScrollView contentContainerStyle={{ paddingBottom: 16 }}>
            <Text style={styles.label}>Seleziona data</Text>
            <Calendar
              onDayPress={(day: CalendarDay) => setSingleDate(day.dateString)}
              markedDates={singleDate ? { [singleDate]: { selected: true, selectedColor: '#1b7f3b' } } : {}}
              theme={{ todayTextColor: '#1b7f3b', selectedDayBackgroundColor: '#1b7f3b' }}
            />
            <View style={styles.rangeRow}>
              <Text style={{ fontWeight: '700' }}>Data:</Text>
              <Text style={{ marginLeft: 6, color: singleErrors.date ? '#b91c1c' : '#111' }}>
                {singleDate || '— (obbligatoria)'}
              </Text>
            </View>

            <Text style={styles.label}>Ora (HH:mm)</Text>
            <TextInput
              value={singleTime}
              onChangeText={setSingleTime}
              placeholder="15:00"
              style={[styles.input, singleErrors.time && styles.inputError]}
              autoCapitalize="none"
            />
            {singleErrors.time && <Text style={styles.errorMsg}>Formato orario non valido (usa HH:mm)</Text>}

            <Text style={styles.label}>Avversario</Text>
            <TextInput
              value={singleOpponent}
              onChangeText={setSingleOpponent}
              placeholder="Avversario"
              style={[styles.input, singleErrors.opponent && styles.inputError]}
            />
            {singleErrors.opponent && <Text style={styles.errorMsg}>Campo obbligatorio</Text>}

            <Text style={styles.label}>Competizione (opzionale)</Text>
            <TextInput
              value={singleCompetition}
              onChangeText={setSingleCompetition}
              placeholder="Campionato / Coppa"
              style={styles.input}
            />

            <Text style={styles.label}>Casa / Trasferta</Text>
            <View style={styles.toggleRow}>
              <Pressable
                style={[styles.toggleBtn, singleHA === 'CASA' && styles.toggleBtnActive]}
                onPress={() => setSingleHA('CASA')}
              >
                <Text style={[styles.toggleText, singleHA === 'CASA' && styles.toggleTextActive]}>CASA</Text>
              </Pressable>
              <Pressable
                style={[styles.toggleBtn, singleHA === 'TRASFERTA' && styles.toggleBtnActive]}
                onPress={() => setSingleHA('TRASFERTA')}
              >
                <Text style={[styles.toggleText, singleHA === 'TRASFERTA' && styles.toggleTextActive]}>TRASFERTA</Text>
              </Pressable>
            </View>

            <Text style={styles.label}>Luogo</Text>
            <TextInput
              value={singleLocation}
              onChangeText={setSingleLocation}
              placeholder="Stadio / Campo"
              style={[styles.input, singleErrors.location && styles.inputError]}
            />
            {singleErrors.location && <Text style={styles.errorMsg}>Campo obbligatorio</Text>}

            <View style={styles.checklist}>
              <Text style={styles.checkTitle}>Requisiti per creare la partita</Text>
              <Text style={styles.checkItem}>
                {singleErrors.date ? '❌' : '✅'} Data selezionata dal calendario
              </Text>
              <Text style={styles.checkItem}>
                {singleErrors.time ? '❌' : '✅'} Orario valido (HH:mm)
              </Text>
              <Text style={styles.checkItem}>
                {singleErrors.opponent ? '❌' : '✅'} Avversario compilato
              </Text>
              <Text style={styles.checkItem}>
                {singleErrors.location ? '❌' : '✅'} Luogo compilato
              </Text>
            </View>

            <Pressable
              style={[styles.createBtn, !canCreateSingle && { opacity: 0.6 }]}
              disabled={!canCreateSingle}
              onPress={handleCreate}
            >
              <Text style={styles.createText}>CREA PARTITA</Text>
            </Pressable>
            <Pressable style={styles.cancelBtn} onPress={handleClose}>
              <Text style={styles.cancelText}>Chiudi</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
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
    width: '92%',
    maxHeight: '92%',
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
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 10,
    fontSize: 16,
  },
  inputError: {
    borderColor: '#b91c1c',
  },
  errorMsg: {
    fontSize: 12,
    color: '#b91c1c',
    marginTop: 4,
  },
  rangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 4,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    alignItems: 'center',
  },
  toggleBtnActive: {
    backgroundColor: '#1b7f3b',
    borderColor: '#1b7f3b',
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  toggleTextActive: {
    color: 'white',
  },
  checklist: {
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
    marginVertical: 16,
  },
  checkTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  checkItem: {
    fontSize: 13,
    marginBottom: 4,
  },
  createBtn: {
    backgroundColor: '#1b7f3b',
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