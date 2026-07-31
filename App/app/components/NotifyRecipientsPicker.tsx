// app/components/NotifyRecipientsPicker.tsx
//
// Selettore "chi riceve questa notifica": Solo Admin / Tutto lo Staff /
// Alcuni membri (con checklist). Riusato in Gestione Squadra → Admin →
// Configurazioni (notifiche proposte Live, notifiche modifiche giocatore) e
// nell'editor dei Sondaggi (notifiche di una risposta).
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { NotifyConfig, NotifyMode } from '../data/organization';
import { StaffMember } from '../data/staffRoster';

const MODES: { value: NotifyMode; label: string }[] = [
  { value: 'admin_only', label: 'Solo Admin' },
  { value: 'all', label: 'Tutto lo Staff' },
  { value: 'selected', label: 'Alcuni' },
];

type Props = {
  label: string;
  hint?: string;
  value: NotifyConfig;
  onChange: (config: NotifyConfig) => void;
  staffMembers: StaffMember[];
  disabled?: boolean;
};

export default function NotifyRecipientsPicker({ label, hint, value, onChange, staffMembers, disabled }: Props) {
  const toggleStaffId = (id: string) => {
    const next = value.staffIds.includes(id) ? value.staffIds.filter((x) => x !== id) : [...value.staffIds, id];
    onChange({ ...value, staffIds: next });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}

      <View style={styles.modeRow}>
        {MODES.map((m) => {
          const active = value.mode === m.value;
          return (
            <Pressable
              key={m.value}
              style={[styles.modeBtn, active && styles.modeBtnActive]}
              onPress={() => onChange({ ...value, mode: m.value })}
              disabled={disabled}
            >
              <Text style={[styles.modeBtnText, active && styles.modeBtnTextActive]}>{m.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {value.mode === 'selected' && (
        <View style={styles.staffList}>
          {staffMembers.length === 0 ? (
            <Text style={styles.hint}>Nessuna persona censita in Staff.</Text>
          ) : (
            staffMembers.map((s) => {
              const checked = value.staffIds.includes(s.id);
              return (
                <Pressable key={s.id} style={styles.staffRow} onPress={() => toggleStaffId(s.id)} disabled={disabled}>
                  <View style={[styles.checkbox, checked && styles.checkboxOn]}>
                    {checked ? <Text style={styles.checkboxMark}>✓</Text> : null}
                  </View>
                  <Text style={styles.staffName}>
                    {s.name}
                    {s.role ? ` — ${s.role}` : ''}
                  </Text>
                </Pressable>
              );
            })
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 4 },
  label: { fontSize: 14, fontWeight: '700', color: '#334155', marginBottom: 4 },
  hint: { fontSize: 12, color: '#64748b', marginBottom: 8 },

  modeRow: { flexDirection: 'row', gap: 8 },
  modeBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
  },
  modeBtnActive: { backgroundColor: '#1b7f3b' },
  modeBtnText: { fontSize: 12, fontWeight: '700', color: '#475569' },
  modeBtnTextActive: { color: '#fff' },

  staffList: { marginTop: 10 },
  staffRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  checkboxOn: { backgroundColor: '#1b7f3b', borderColor: '#1b7f3b' },
  checkboxMark: { color: '#fff', fontSize: 12, fontWeight: '800' },
  staffName: { flex: 1, fontSize: 14, color: '#1a202c' },
});
