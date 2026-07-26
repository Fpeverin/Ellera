import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SeasonArchive } from '../data/archive';
import { usePlayers } from '../hooks/usePlayers';
import {
  buildSeasonArchive,
  clearCurrentSeasonData,
  deleteArchive,
  loadAllArchives,
  saveArchive,
} from '../utils/archiveBuilder';

export default function Archivio() {
  const router = useRouter();
  const { allPlayers } = usePlayers();
  const [archives, setArchives] = useState<SeasonArchive[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [seasonLabel, setSeasonLabel] = useState('');
  const [archiving, setArchiving] = useState(false);

  const defaultLabel = () => {
    const now = new Date();
    return `${now.getFullYear() - 1}/${now.getFullYear()}`;
  };

  const load = useCallback(async () => {
    setLoadingList(true);
    try {
      const list = await loadAllArchives();
      setArchives(list.slice().reverse());
    } finally {
      setLoadingList(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openArchiveModal = () => {
    setSeasonLabel(defaultLabel());
    setShowArchiveModal(true);
  };

  const handleArchive = async () => {
    const label = seasonLabel.trim();
    if (!label) {
      Alert.alert('Errore', 'Inserisci il nome della stagione (es. 2024/2025)');
      return;
    }
    setArchiving(true);
    try {
      const archive = await buildSeasonArchive(label, allPlayers);
      await saveArchive(archive);
      await clearCurrentSeasonData(archive.matches);
      setShowArchiveModal(false);
      await load();
      Alert.alert('Stagione archiviata', `La stagione "${label}" è stata archiviata con successo.\nDati correnti eliminati.`);
    } catch (e) {
      Alert.alert('Errore', 'Impossibile archiviare la stagione. Riprova.');
    } finally {
      setArchiving(false);
    }
  };

  const handleDelete = (archive: SeasonArchive) => {
    Alert.alert(
      'Elimina archivio',
      `Eliminare definitivamente l'archivio della stagione "${archive.label}"?`,
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Elimina', style: 'destructive',
          onPress: async () => {
            await deleteArchive(archive.id);
            load();
          },
        },
      ]
    );
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch { return iso; }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.header}>
        <Text style={styles.title}>Archivio Stagioni</Text>
        <Pressable style={styles.archiveBtn} onPress={openArchiveModal}>
          <Text style={styles.archiveBtnText}>+ Archivia stagione</Text>
        </Pressable>
      </View>

      {loadingList ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#7c3aed" />
        </View>
      ) : archives.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🗄️</Text>
          <Text style={styles.emptyTitle}>Nessuna stagione archiviata</Text>
          <Text style={styles.emptySubtitle}>
            Al termine della stagione, usa il pulsante "Archivia stagione" per creare uno snapshot completo di partite, giocatori e statistiche.
          </Text>
        </View>
      ) : (
        <FlatList
          data={archives}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() => router.push({ pathname: '/squadra/archivio/[id]', params: { id: item.id } })}
            >
              <View style={styles.cardLeft}>
                <Text style={styles.cardLabel}>{item.label}</Text>
                <Text style={styles.cardDate}>Archiviato il {formatDate(item.archivedAt)}</Text>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryChip}>⚽ {item.summary.totalMatches} partite</Text>
                  <Text style={styles.summaryChip}>✅ {item.summary.wins}V</Text>
                  <Text style={styles.summaryChip}>➖ {item.summary.draws}P</Text>
                  <Text style={styles.summaryChip}>❌ {item.summary.losses}S</Text>
                </View>
                <Text style={styles.goalsLine}>
                  Gol fatti: {item.summary.goalsFor} · Subiti: {item.summary.goalsAgainst}
                </Text>
              </View>
              <View style={styles.cardRight}>
                <Text style={styles.chevron}>›</Text>
                <Pressable style={styles.deleteBtn} onPress={() => handleDelete(item)} hitSlop={8}>
                  <Text style={styles.deleteBtnText}>🗑️</Text>
                </Pressable>
              </View>
            </Pressable>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        />
      )}

      {/* Modal archivia stagione */}
      <Modal visible={showArchiveModal} transparent animationType="slide" onRequestClose={() => setShowArchiveModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.modalTitle}>Archivia Stagione</Text>
            <Text style={styles.modalDesc}>
              Verrà creato uno snapshot completo di rosa, partite, statistiche e allenamenti. I dati correnti verranno eliminati.
            </Text>

            <Text style={styles.fieldLabel}>Nome stagione</Text>
            <TextInput
              style={styles.input}
              value={seasonLabel}
              onChangeText={setSeasonLabel}
              placeholder="Es. 2024/2025"
              autoCapitalize="none"
            />

            {archiving ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color="#7c3aed" />
                <Text style={styles.loadingText}>Raccolta dati stagione in corso...</Text>
              </View>
            ) : (
              <>
                <Pressable
                  style={[styles.confirmBtn, !seasonLabel.trim() && { opacity: 0.5 }]}
                  onPress={handleArchive}
                  disabled={!seasonLabel.trim()}
                >
                  <Text style={styles.confirmBtnText}>ARCHIVIA STAGIONE</Text>
                </Pressable>
                <Pressable style={styles.cancelBtn} onPress={() => setShowArchiveModal(false)}>
                  <Text style={styles.cancelBtnText}>Annulla</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  title: { fontSize: 22, fontWeight: '800', color: '#1e293b' },
  archiveBtn: {
    backgroundColor: '#7c3aed',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
  },
  archiveBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#1e293b', marginBottom: 12, textAlign: 'center' },
  emptySubtitle: { fontSize: 15, color: '#64748b', textAlign: 'center', lineHeight: 22 },

  list: { padding: 16 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: '#7c3aed',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
  },
  cardLeft: { flex: 1 },
  cardLabel: { fontSize: 20, fontWeight: '800', color: '#1e293b', marginBottom: 2 },
  cardDate: { fontSize: 13, color: '#64748b', marginBottom: 8 },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  summaryChip: { fontSize: 13, color: '#374151', backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, fontWeight: '600' },
  goalsLine: { fontSize: 13, color: '#64748b' },
  cardRight: { alignItems: 'center', gap: 12 },
  chevron: { fontSize: 24, color: '#94a3b8' },
  deleteBtn: { padding: 4 },
  deleteBtnText: { fontSize: 20 },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalTitle: { fontSize: 22, fontWeight: '800', color: '#1e293b', textAlign: 'center', marginBottom: 8 },
  modalDesc: { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  fieldLabel: { fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 6 },
  input: { backgroundColor: '#f9fafb', borderRadius: 12, padding: 12, fontSize: 16, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 8 },
  loadingBox: { alignItems: 'center', paddingVertical: 24, gap: 12 },
  loadingText: { fontSize: 15, color: '#64748b', textAlign: 'center' },
  confirmBtn: { backgroundColor: '#7c3aed', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 16 },
  confirmBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  cancelBtn: { borderRadius: 12, padding: 14, alignItems: 'center' },
  cancelBtnText: { color: '#64748b', fontSize: 16, fontWeight: '600' },
});
