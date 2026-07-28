import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { deleteTactic, loadTactics, TacticItem } from '../../data/tactics';

export default function TacticsIndex() {
  const router = useRouter();
  const { membership } = useAuth();
  const [list, setList] = useState<TacticItem[]>([]);
  const [toDelete, setToDelete] = useState<TacticItem | null>(null);

  const load = useCallback(async () => {
    setList(await loadTactics());
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const doDelete = async (id: string) => {
    await deleteTactic(id);
    setList((prev) => prev.filter(t => t.id !== id));
  };

  if (membership?.role === 'giocatore') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: '#64748b', textAlign: 'center' }}>Non disponibile per il tuo ruolo.</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top','bottom']}>
      <View style={styles.topBar}>
        <Text style={styles.title}>Tattiche</Text>
        <Pressable style={[styles.btn, { backgroundColor: '#1b7f3b' }]} onPress={() => router.push('/squadra/tattiche/editor')}>
          <Text style={styles.btnText}>+ Nuova</Text>
        </Pressable>
      </View>

      <FlatList
        data={list}
        keyExtractor={t => t.id}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        ListEmptyComponent={<Text style={{ color:'#6b7280', marginTop: 12 }}>Nessuna tattica salvata</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            {item.preview ? (
              <Image source={{ uri: item.preview }} style={styles.preview} />
            ) : (
              <View style={[styles.preview, styles.previewPlaceholder]}>
                <Text style={{ color:'#6b7280', fontSize:12 }}>Nessuna preview</Text>
              </View>
            )}

            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.meta}>{item.elements.length} elementi</Text>
            </View>

            <View style={{ flexDirection:'row', gap: 8 }}>
              <Pressable style={[styles.btnSm, { backgroundColor: '#2563eb' }]} onPress={() => router.push({ pathname: '/squadra/tattiche/editor', params: { id: item.id } })}>
                <Text style={styles.btnSmText}>Modifica</Text>
              </Pressable>
              <Pressable style={[styles.btnSm, { backgroundColor: '#ef4444' }]} onPress={() => setToDelete(item)}>
                <Text style={styles.btnSmText}>Elimina</Text>
              </Pressable>
            </View>
          </View>
        )}
        contentContainerStyle={{ paddingBottom: 24, paddingHorizontal: 12, paddingTop: 6 }}
      />

      {/* Conferma elimina */}
      <Modal visible={!!toDelete} transparent animationType="fade" onRequestClose={() => setToDelete(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Eliminare questa tattica?</Text>
            <Text style={{ color:'#374151', marginBottom: 12 }}>"{toDelete?.name}"</Text>
            <View style={{ flexDirection:'row', gap: 8 }}>
              <Pressable style={[styles.btn, { backgroundColor:'#9ca3af', flex:1 }]} onPress={() => setToDelete(null)}>
                <Text style={styles.btnText}>Annulla</Text>
              </Pressable>
              <Pressable
                style={[styles.btn, { backgroundColor:'#b91c1c', flex:1 }]}
                onPress={async () => { if (toDelete) await doDelete(toDelete.id); setToDelete(null); }}
              >
                <Text style={styles.btnText}>Conferma</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, backgroundColor:'#fff' },
  topBar: { padding:12, flexDirection:'row', alignItems:'center', justifyContent:'space-between' },
  title: { fontWeight:'900', fontSize:18 },
  btn: { borderRadius:8, paddingVertical:8, paddingHorizontal:12, alignItems:'center' },
  btnText: { color:'#fff', fontWeight:'900' },

  card: { flexDirection:'row', alignItems:'center', gap:10, backgroundColor:'#f9fafb', borderRadius:12, padding:10 },
  name: { fontWeight:'900' },
  meta: { color:'#6b7280', fontSize:12 },

  preview: { width: 120, height: 80, borderRadius:8, backgroundColor:'#e5e7eb' },
  previewPlaceholder: { alignItems:'center', justifyContent:'center' },

  btnSm: { borderRadius:8, paddingVertical:6, paddingHorizontal:10, alignItems:'center', justifyContent:'center' },
  btnSmText: { color:'#fff', fontWeight:'800', fontSize:12 },

  modalOverlay: { flex:1, backgroundColor:'rgba(0,0,0,0.4)', justifyContent:'center', alignItems:'center', padding:16 },
  modalBox: { width:'92%', maxWidth:420, backgroundColor:'#fff', borderRadius:12, padding:16 },
  modalTitle: { fontSize:18, fontWeight:'800', marginBottom: 6 },
});
