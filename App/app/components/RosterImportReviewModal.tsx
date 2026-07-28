// app/components/RosterImportReviewModal.tsx
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { RosterImportPlan } from '../data/rosterFile';

type Props = {
  visible: boolean;
  plan: RosterImportPlan | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (moveToExIds: string[]) => void;
};

export default function RosterImportReviewModal({ visible, plan, busy, onCancel, onConfirm }: Props) {
  const [toMoveToEx, setToMoveToEx] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (visible) setToMoveToEx(new Set());
  }, [visible, plan]);

  if (!plan) return null;

  const toggle = (id: string) => {
    setToMoveToEx((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Riepilogo import rosa</Text>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryText}>➕ {plan.toInsert.length} nuovi giocatori</Text>
            <Text style={styles.summaryText}>✏️ {plan.toUpdate.length} da aggiornare</Text>
          </View>

          {plan.missingActivePlayers.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>
                {plan.missingActivePlayers.length} giocatori attivi non presenti nel file
              </Text>
              <Text style={styles.sectionHint}>
                Seleziona quelli da spostare tra gli ex — quelli non selezionati restano invariati.
              </Text>
              <ScrollView style={styles.list}>
                {plan.missingActivePlayers.map((p) => {
                  const checked = toMoveToEx.has(p.id);
                  return (
                    <Pressable key={p.id} style={styles.row} onPress={() => toggle(p.id)}>
                      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                        {checked && <Text style={styles.checkboxMark}>✓</Text>}
                      </View>
                      <Text style={styles.rowText}>{p.name}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </>
          )}

          <View style={styles.actions}>
            <Pressable style={[styles.btn, styles.btnCancel]} onPress={onCancel} disabled={busy}>
              <Text style={styles.btnCancelText}>Annulla</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, styles.btnConfirm, busy && styles.btnDisabled]}
              onPress={() => onConfirm(Array.from(toMoveToEx))}
              disabled={busy}
            >
              <Text style={styles.btnConfirmText}>{busy ? 'Importazione…' : 'Conferma import'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 20, width: '100%', maxWidth: 480, maxHeight: '85%' },
  title: { fontSize: 18, fontWeight: '800', color: '#1a202c', marginBottom: 12, textAlign: 'center' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 },
  summaryText: { fontSize: 14, fontWeight: '700', color: '#1b7f3b' },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#1a202c', marginBottom: 4 },
  sectionHint: { fontSize: 13, color: '#64748b', marginBottom: 8 },
  list: { maxHeight: 260, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: '#dc2626', borderColor: '#dc2626' },
  checkboxMark: { color: '#fff', fontSize: 14, fontWeight: '900' },
  rowText: { fontSize: 15, color: '#1a202c', flex: 1 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  btn: { flex: 1, borderRadius: 12, padding: 14, alignItems: 'center' },
  btnCancel: { backgroundColor: '#f1f5f9' },
  btnConfirm: { backgroundColor: '#1b7f3b' },
  btnDisabled: { opacity: 0.6 },
  btnCancelText: { color: '#475569', fontWeight: '700' },
  btnConfirmText: { color: '#fff', fontWeight: '700' },
});
