import { Picker } from '@react-native-picker/picker';
import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import DatePickerField from './DatePickerField';
import { NewPlayerInput, Player, Role } from '../hooks/usePlayers';

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onSaved: (player: Player) => void;
  addPlayer: (input: NewPlayerInput) => Promise<Player>;
}

const ROLES: { label: string; value: Role }[] = [
  { label: 'Portiere', value: 'PORTIERE' },
  { label: 'Difensore', value: 'DIFENSORE' },
  { label: 'Centrocampista', value: 'CENTROCAMPISTA' },
  { label: 'Attaccante', value: 'ATTACCANTE' },
];

export default function AddPlayerModal({ visible, onClose, onSaved, addPlayer }: Props) {
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('CENTROCAMPISTA');
  const [dob, setDob] = useState<string | null>(null);
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [saving, setSaving] = useState(false);

  const isValid =
    name.trim().length >= 2 &&
    !!dob &&
    height.trim().length > 0 &&
    weight.trim().length > 0;

  const handleSave = async () => {
    if (!isValid || saving || !dob) return;
    setSaving(true);
    try {
      const player = await addPlayer({ name, role, dob, height: height.trim(), weight: weight.trim() });
      onSaved(player);
      resetForm();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setName('');
    setRole('CENTROCAMPISTA');
    setDob(null);
    setHeight('');
    setWeight('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.modalTitle}>Aggiungi Giocatore</Text>
          <ScrollView contentContainerStyle={{ paddingBottom: 16 }} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Nome e Cognome</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={t => setName(t.toUpperCase())}
              placeholder="Es. ROSSI MARIO"
              autoCapitalize="characters"
              autoCorrect={false}
            />

            <Text style={styles.label}>Ruolo</Text>
            <View style={styles.pickerWrapper}>
              <Picker selectedValue={role} onValueChange={v => setRole(v as Role)} style={styles.picker}>
                {ROLES.map(r => (
                  <Picker.Item key={r.value} label={r.label} value={r.value} />
                ))}
              </Picker>
            </View>

            <DatePickerField
              label="Data di nascita"
              value={dob}
              onChange={setDob}
              minDate="1950-01-01"
              maxDate={todayStr()}
            />

            <View style={styles.row}>
              <View style={styles.halfField}>
                <Text style={styles.label}>Altezza (cm)</Text>
                <TextInput
                  style={styles.input}
                  value={height}
                  onChangeText={setHeight}
                  placeholder="170"
                  keyboardType="numeric"
                  maxLength={3}
                />
              </View>
              <View style={styles.halfField}>
                <Text style={styles.label}>Peso (kg)</Text>
                <TextInput
                  style={styles.input}
                  value={weight}
                  onChangeText={setWeight}
                  placeholder="70"
                  keyboardType="numeric"
                  maxLength={3}
                />
              </View>
            </View>

            <Pressable
              style={[styles.saveBtn, (!isValid || saving) && { opacity: 0.5 }]}
              onPress={handleSave}
              disabled={!isValid || saving}
            >
              <Text style={styles.saveText}>{saving ? 'SALVATAGGIO...' : 'AGGIUNGI GIOCATORE'}</Text>
            </Pressable>

            <Pressable style={styles.cancelBtn} onPress={handleClose}>
              <Text style={styles.cancelText}>Annulla</Text>
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
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '85%',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 8,
    textAlign: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 6,
    marginTop: 14,
  },
  input: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  pickerWrapper: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  picker: {
    height: 50,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfField: {
    flex: 1,
  },
  saveBtn: {
    backgroundColor: '#1b7f3b',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  saveText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '800',
  },
  cancelBtn: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  cancelText: {
    color: '#64748b',
    fontSize: 16,
    fontWeight: '600',
  },
});
