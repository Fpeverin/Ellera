// app/squadra/staffRoster.tsx
//
// Rosa Staff: elenco di persone (Tecnico/Sanitario/Dirigenziale) indipendenti
// dagli account app, usate dalla Convocazione. Visibile a Staff+Admin (non
// solo Admin, a differenza di app/squadra/staff.tsx che gestisce gli account).
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import {
  addStaffMember,
  loadStaffMembers,
  removeStaffMember,
  StaffCategory,
  StaffMember,
  updateStaffMember,
} from '../data/staffRoster';

const CATEGORY_LABELS: Record<StaffCategory, string> = {
  TECNICO: 'Staff Tecnico',
  SANITARIO: 'Staff Sanitario',
  DIRIGENZIALE: 'Dirigenza',
};
const CATEGORIES: StaffCategory[] = ['TECNICO', 'SANITARIO', 'DIRIGENZIALE'];

export default function StaffRoster() {
  const { membership } = useAuth();
  const readOnly = membership?.role === 'giocatore';

  const [members, setMembers] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [editTarget, setEditTarget] = useState<StaffMember | null>(null);
  const [addCategory, setAddCategory] = useState<StaffCategory | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<StaffMember | null>(null);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setMembers(await loadStaffMembers());
    } catch {
      Alert.alert('Errore', 'Impossibile caricare la Rosa Staff.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openAdd = (category: StaffCategory) => {
    setName('');
    setRole('');
    setAddCategory(category);
  };

  const openEdit = (member: StaffMember) => {
    setName(member.name);
    setRole(member.role ?? '');
    setEditTarget(member);
  };

  const closeModal = () => {
    setAddCategory(null);
    setEditTarget(null);
    setName('');
    setRole('');
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      if (editTarget) {
        await updateStaffMember(editTarget.id, { name: name.trim(), role: role.trim() || null });
      } else if (addCategory) {
        await addStaffMember({ name: name.trim(), category: addCategory, role: role.trim() || undefined });
      }
      closeModal();
      await load();
    } catch {
      Alert.alert('Errore', 'Impossibile salvare la persona.');
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    if (!confirmRemove) return;
    setBusy(true);
    try {
      await removeStaffMember(confirmRemove.id);
      setConfirmRemove(null);
      await load();
    } catch {
      Alert.alert('Errore', 'Impossibile rimuovere la persona.');
    } finally {
      setBusy(false);
    }
  };

  if (readOnly) {
    return (
      <View style={styles.center}>
        <Text style={styles.deniedText}>Non disponibile per il tuo ruolo.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1b7f3b" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <Text style={styles.title}>Rosa Staff</Text>
        <Text style={styles.hint}>
          Persone censite qui (nome + ruolo) sono quelle che compaiono nella Convocazione — non
          serve un account app.
        </Text>

        {CATEGORIES.map((cat) => {
          const inCategory = members.filter((m) => m.category === cat);
          return (
            <View key={cat} style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>{CATEGORY_LABELS[cat]} ({inCategory.length})</Text>
                <Pressable style={styles.smallBtn} onPress={() => openAdd(cat)}>
                  <Text style={styles.smallBtnText}>+ Aggiungi</Text>
                </Pressable>
              </View>

              {inCategory.length === 0 ? (
                <Text style={styles.emptyText}>Nessuno censito.</Text>
              ) : (
                inCategory.map((m) => (
                  <View key={m.id} style={styles.memberCard}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.memberName}>{m.name}</Text>
                      {m.role ? <Text style={styles.memberRole}>{m.role}</Text> : null}
                    </View>
                    <View style={styles.memberActions}>
                      <Pressable style={styles.memberActionBtn} onPress={() => openEdit(m)}>
                        <Text style={styles.memberActionText}>Modifica</Text>
                      </Pressable>
                      <Pressable style={styles.memberActionBtn} onPress={() => setConfirmRemove(m)}>
                        <Text style={[styles.memberActionText, { color: '#dc2626' }]}>Rimuovi</Text>
                      </Pressable>
                    </View>
                  </View>
                ))
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* aggiungi/modifica persona */}
      <Modal visible={!!addCategory || !!editTarget} transparent animationType="fade" onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>
              {editTarget ? 'Modifica persona' : `Nuova persona — ${addCategory ? CATEGORY_LABELS[addCategory] : ''}`}
            </Text>
            <TextInput style={styles.input} placeholder="Nome" value={name} onChangeText={setName} />
            <TextInput
              style={styles.input}
              placeholder="Ruolo (es. Allenatore, Fisioterapista)"
              value={role}
              onChangeText={setRole}
            />
            <View style={styles.row}>
              <Pressable style={[styles.btn, styles.btnOutline]} onPress={closeModal}>
                <Text style={styles.btnOutlineText}>Annulla</Text>
              </Pressable>
              <Pressable
                style={[styles.btn, styles.btnPrimary, !name.trim() && styles.btnDisabled]}
                onPress={handleSave}
                disabled={busy || !name.trim()}
              >
                <Text style={styles.btnPrimaryText}>{busy ? 'Salvataggio…' : 'Salva'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* conferma rimozione */}
      <Modal visible={!!confirmRemove} transparent animationType="fade" onRequestClose={() => setConfirmRemove(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Rimuovere {confirmRemove?.name}?</Text>
            <Text style={styles.modalText}>Non comparirà più nelle nuove convocazioni.</Text>
            <View style={styles.row}>
              <Pressable style={[styles.btn, styles.btnOutline]} onPress={() => setConfirmRemove(null)}>
                <Text style={styles.btnOutlineText}>Annulla</Text>
              </Pressable>
              <Pressable style={[styles.btn, styles.btnDanger]} onPress={handleRemove} disabled={busy}>
                <Text style={styles.btnPrimaryText}>{busy ? 'Attendere…' : 'Rimuovi'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#f8fafc' },
  deniedText: { fontSize: 16, color: '#64748b', textAlign: 'center' },

  title: { fontSize: 24, fontWeight: '800', color: '#1a202c' },
  hint: { fontSize: 13, color: '#64748b', marginTop: 8, marginBottom: 20 },

  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1a202c' },
  emptyText: { fontSize: 13, color: '#94a3b8', fontStyle: 'italic' },

  smallBtn: { backgroundColor: '#1b7f3b', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  smallBtnText: { color: 'white', fontWeight: '700', fontSize: 13 },

  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  memberName: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  memberRole: { fontSize: 12, color: '#64748b', marginTop: 2 },
  memberActions: { gap: 6, alignItems: 'flex-end' },
  memberActionBtn: { paddingVertical: 4, paddingHorizontal: 8 },
  memberActionText: { fontSize: 13, fontWeight: '700', color: '#2563eb' },

  row: { flexDirection: 'row', gap: 12, marginTop: 4 },
  btn: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  btnPrimary: { backgroundColor: '#1b7f3b' },
  btnPrimaryText: { color: '#fff', fontWeight: '700' },
  btnOutline: { backgroundColor: '#f1f5f9' },
  btnOutlineText: { color: '#475569', fontWeight: '700' },
  btnDanger: { backgroundColor: '#dc2626' },
  btnDisabled: { opacity: 0.5 },

  input: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginVertical: 8,
  },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalBox: { backgroundColor: '#fff', borderRadius: 16, padding: 20, width: '100%', maxWidth: 420 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: '#1a202c', marginBottom: 8, textAlign: 'center' },
  modalText: { fontSize: 14, color: '#64748b', marginBottom: 16, textAlign: 'center' },
});
