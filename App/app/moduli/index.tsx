import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import TeamLogo from '../components/TeamLogo';
import { useAuth } from '../context/AuthContext';
import { CustomModule, deleteModule, loadModules } from '../data/modules';
import { MODULES as DEFAULT_MODULES } from '../utils/modules-layout';

export default function ModuliIndex() {
  const router = useRouter();
  const { membership } = useAuth();

  const defaultNames = useMemo(() => Object.keys(DEFAULT_MODULES), []);
  const [custom, setCustom] = useState<CustomModule[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setCustom(await loadModules());
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  const createNew = () => {
    router.push('/moduli/editor'); // nuovo modulo
  };

  const openDefault = (name: string) => {
    router.push({ pathname: '/moduli/editor', params: { name, readonly: '1' } });
  };

  const openCustom = (name: string) => {
    router.push({ pathname: '/moduli/editor', params: { name } });
  };

  // === pattern uguale alle partite ===
  const actuallyDeleteOne = async () => {
    if (!confirmDeleteId) return;
    setBusy(true);
    await deleteModule(confirmDeleteId);
    setBusy(false);
    setConfirmDeleteId(null);
    load();
  };

  const renderDefault = ({ item }: { item: string }) => (
    <Pressable style={styles.cardRow} onPress={() => openDefault(item)}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{item}</Text>
        <Text style={styles.rowMeta}>Modulo predefinito</Text>
      </View>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>Default</Text>
      </View>
    </Pressable>
  );

  const renderCustom = ({ item }: { item: CustomModule }) => (
    <View style={styles.cardRow}>
      <Pressable style={{ flex: 1 }} onPress={() => openCustom(item.name)}>
        <Text style={styles.rowTitle}>{item.name}</Text>
        <Text style={styles.rowMeta}>Personalizzato</Text>
      </Pressable>
      <Pressable style={styles.iconBtn} onPress={() => setConfirmDeleteId(item.name)}>
        <Text style={{ fontSize: 18 }}>🗑️</Text>
      </Pressable>
    </View>
  );

  if (membership?.role === 'giocatore') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: '#64748b', textAlign: 'center' }}>Non disponibile per il tuo ruolo.</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <View style={styles.topBar}>
          <View style={styles.topBarTitleRow}>
            <TeamLogo size={28} style={{ marginRight: 8 }} />
            <Text style={styles.title}>Moduli</Text>
          </View>
          <Pressable style={styles.createBtn} onPress={createNew}>
            <Text style={styles.createBtnText}>＋ Crea nuovo modulo</Text>
          </Pressable>
        </View>

        <Text style={styles.section}>Predefiniti</Text>
        <FlatList
          data={defaultNames}
          keyExtractor={(n) => `def-${n}`}
          renderItem={renderDefault}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          contentContainerStyle={{ paddingBottom: 4 }}
        />

        <Text style={[styles.section, { marginTop: 16 }]}>I miei moduli</Text>
        <FlatList
          data={custom}
          keyExtractor={(m) => `cus-${m.name}`}
          renderItem={renderCustom}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListEmptyComponent={<Text style={{ color: '#6b7280' }}>Nessun modulo personalizzato</Text>}
          contentContainerStyle={{ paddingBottom: 20 }}
        />

        {/* Modale conferma cancellazione singola (solo custom) */}
        <Modal visible={!!confirmDeleteId} transparent animationType="fade" onRequestClose={() => setConfirmDeleteId(null)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>Eliminare il modulo "{confirmDeleteId}"?</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                <Pressable style={[styles.btn, { backgroundColor: '#9ca3af', flex: 1 }]} onPress={() => setConfirmDeleteId(null)}>
                  <Text style={styles.btnText}>Annulla</Text>
                </Pressable>
                <Pressable
                  style={[styles.btn, { backgroundColor: '#b91c1c', flex: 1, opacity: busy ? 0.6 : 1 }]}
                  disabled={busy}
                  onPress={actuallyDeleteOne}
                >
                  <Text style={styles.btnText}>Elimina</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 8, backgroundColor: '#fff' },

  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  topBarTitleRow: { flexDirection: 'row', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '800' },
  createBtn: { backgroundColor: '#1b7f3b', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  createBtnText: { color: 'white', fontWeight: '800' },

  section: { fontSize: 16, fontWeight: '800', marginTop: 8, marginBottom: 6, color: '#111' },

  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f4f6f8',
    borderRadius: 10,
    padding: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  rowTitle: { fontWeight: '800', fontSize: 16 },
  rowMeta: { color: '#6b7280', marginTop: 2, fontSize: 12 },

  badge: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#e5efe8', borderRadius: 999 },
  badgeText: { fontWeight: '800', color: '#1b7f3b', fontSize: 12 },

  iconBtn: { paddingHorizontal: 8, paddingVertical: 6 },

  // Modale
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modalBox: { width: '90%', maxWidth: 420, backgroundColor: '#fff', borderRadius: 12, padding: 16 },
  modalTitle: { fontSize: 18, fontWeight: '800' },
  btn: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8 },
  btnText: { color: 'white', fontWeight: '800', textAlign: 'center' },
});
