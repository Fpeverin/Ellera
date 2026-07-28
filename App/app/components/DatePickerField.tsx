// app/components/DatePickerField.tsx
//
// Campo data riutilizzabile: mostra la data scelta (gg/mm/aaaa) e apre un
// mini calendario (react-native-calendars, gia' usato altrove nell'app —
// nessuna nuova dipendenza) per sceglierne una nuova.
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Calendar } from 'react-native-calendars';

type Props = {
  label: string;
  value: string | null; // 'YYYY-MM-DD'
  onChange: (date: string) => void;
  minDate?: string;
  maxDate?: string;
  placeholder?: string;
};

function formatItalian(date: string | null): string {
  if (!date) return '';
  const [y, m, d] = date.split('-');
  return `${d}/${m}/${y}`;
}

export default function DatePickerField({ label, value, onChange, minDate, maxDate, placeholder }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={styles.field} onPress={() => setOpen(true)}>
        <Text style={value ? styles.fieldText : styles.placeholderText}>
          {value ? formatItalian(value) : (placeholder ?? 'Seleziona data')}
        </Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{label}</Text>
            <Calendar
              current={value ?? undefined}
              minDate={minDate}
              maxDate={maxDate}
              onDayPress={(day) => {
                onChange(day.dateString);
                setOpen(false);
              }}
              markedDates={value ? { [value]: { selected: true, selectedColor: '#1b7f3b' } } : {}}
              theme={{ selectedDayBackgroundColor: '#1b7f3b', todayTextColor: '#1b7f3b' }}
            />
            <Pressable style={styles.cancelBtn} onPress={() => setOpen(false)}>
              <Text style={styles.cancelText}>Annulla</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 6, marginTop: 14 },
  field: {
    backgroundColor: '#f9fafb', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: '#e5e7eb',
  },
  fieldText: { fontSize: 16, color: '#111827' },
  placeholderText: { fontSize: 16, color: '#9ca3af' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  sheet: { backgroundColor: '#fff', borderRadius: 16, padding: 16 },
  sheetTitle: { fontSize: 16, fontWeight: '800', color: '#1e293b', marginBottom: 8, textAlign: 'center' },
  cancelBtn: { marginTop: 8, paddingVertical: 12, alignItems: 'center' },
  cancelText: { color: '#64748b', fontWeight: '700' },
});
