// app/components/partite/CompetitionRulesModal.tsx
//
// Configura le regole di partecipazione (Under/Over) di una competizione:
// vedi app/data/competitionRules.ts per la logica di verifica.
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import {
  CompetitionRules,
  loadCompetitionRules,
  RuleTier,
  saveCompetitionRules,
} from '../../data/competitionRules';

interface Props {
  visible: boolean;
  competition: string;
  onClose: () => void;
}

function TierRow({
  tier,
  onChangeYear,
  onChangeMinCount,
  onRemove,
}: {
  tier: RuleTier;
  onChangeYear: (v: string) => void;
  onChangeMinCount: (v: string) => void;
  onRemove: () => void;
}) {
  return (
    <View style={styles.tierRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.tierLabel}>Anno</Text>
        <TextInput
          style={styles.tierInput}
          value={tier.year ? String(tier.year) : ''}
          onChangeText={onChangeYear}
          keyboardType="numeric"
          maxLength={4}
          placeholder="2006"
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.tierLabel}>Min. giocatori</Text>
        <TextInput
          style={styles.tierInput}
          value={tier.minCount ? String(tier.minCount) : ''}
          onChangeText={onChangeMinCount}
          keyboardType="numeric"
          maxLength={2}
          placeholder="1"
        />
      </View>
      <Pressable style={styles.tierRemoveBtn} onPress={onRemove}>
        <Text style={{ fontSize: 18 }}>🗑️</Text>
      </Pressable>
    </View>
  );
}

function TiersSection({
  title,
  hint,
  enabled,
  onToggle,
  tiers,
  onChangeTiers,
}: {
  title: string;
  hint: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  tiers: RuleTier[];
  onChangeTiers: (tiers: RuleTier[]) => void;
}) {
  const updateTier = (idx: number, patch: Partial<RuleTier>) => {
    const next = tiers.slice();
    next[idx] = { ...next[idx], ...patch };
    onChangeTiers(next);
  };
  const removeTier = (idx: number) => onChangeTiers(tiers.filter((_, i) => i !== idx));
  const addTier = () => onChangeTiers([...tiers, { year: 0, minCount: 1 }]);

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Switch value={enabled} onValueChange={onToggle} />
      </View>
      {enabled && (
        <>
          <Text style={styles.hint}>{hint}</Text>
          {tiers.map((t, idx) => (
            <TierRow
              key={idx}
              tier={t}
              onChangeYear={(v) => updateTier(idx, { year: parseInt(v, 10) || 0 })}
              onChangeMinCount={(v) => updateTier(idx, { minCount: parseInt(v, 10) || 0 })}
              onRemove={() => removeTier(idx)}
            />
          ))}
          <Pressable style={styles.addTierBtn} onPress={addTier}>
            <Text style={styles.addTierText}>+ Aggiungi soglia</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

export default function CompetitionRulesModal({ visible, competition, onClose }: Props) {
  const [rules, setRules] = useState<CompetitionRules | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    loadCompetitionRules(competition)
      .then(setRules)
      .catch(() => setRules({ competition, underEnabled: false, underTiers: [], overEnabled: false, overTiers: [] }))
      .finally(() => setLoading(false));
  }, [visible, competition]);

  const handleSave = async () => {
    if (!rules) return;
    setSaving(true);
    try {
      await saveCompetitionRules(rules);
      onClose();
    } catch {
      Alert.alert('Errore', 'Impossibile salvare le regole.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.modalTitle}>Regole di partecipazione</Text>
          <Text style={styles.modalSubtitle}>{competition}</Text>

          {loading || !rules ? (
            <ActivityIndicator size="large" color="#1b4f7f" style={{ marginVertical: 24 }} />
          ) : (
            <ScrollView contentContainerStyle={{ paddingBottom: 8 }}>
              <TiersSection
                title="Regola Under"
                hint={'Es. per "almeno 3 Under" con 1 nato dal 2006, 2 dal 2007, 3 dal 2008: aggiungi 2006→1, 2007→2, 2008→3.'}
                enabled={rules.underEnabled}
                onToggle={(v) => setRules({ ...rules, underEnabled: v })}
                tiers={rules.underTiers}
                onChangeTiers={(underTiers) => setRules({ ...rules, underTiers })}
              />
              <TiersSection
                title="Regola Over"
                hint="Ogni soglia richiede almeno N giocatori in campo nati in quell'anno o prima."
                enabled={rules.overEnabled}
                onToggle={(v) => setRules({ ...rules, overEnabled: v })}
                tiers={rules.overTiers}
                onChangeTiers={(overTiers) => setRules({ ...rules, overTiers })}
              />

              <Pressable style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
                <Text style={styles.saveText}>{saving ? 'Salvataggio…' : 'Salva'}</Text>
              </Pressable>
              <Pressable style={styles.cancelBtn} onPress={onClose}>
                <Text style={styles.cancelText}>Annulla</Text>
              </Pressable>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: 'white', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '90%' },
  modalTitle: { fontSize: 20, fontWeight: '800', textAlign: 'center', color: '#1e293b' },
  modalSubtitle: { fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 12 },

  section: { marginTop: 8, marginBottom: 8 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  hint: { fontSize: 12, color: '#64748b', marginTop: 8, marginBottom: 8, fontStyle: 'italic' },

  tierRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-end', marginBottom: 8 },
  tierLabel: { fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 4 },
  tierInput: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 8, fontSize: 14, backgroundColor: '#f9fafb' },
  tierRemoveBtn: { paddingHorizontal: 6, paddingBottom: 8 },

  addTierBtn: { alignSelf: 'flex-start', paddingVertical: 6 },
  addTierText: { color: '#1b4f7f', fontWeight: '700' },

  saveBtn: { backgroundColor: '#1b4f7f', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  saveText: { color: 'white', fontWeight: '800', fontSize: 16 },
  cancelBtn: { paddingVertical: 12, alignItems: 'center' },
  cancelText: { color: '#64748b', fontWeight: '600' },
});
