// app/components/partite/ConvocatiPlayersModal.tsx
//
// Checklist "giocatori convocati", condivisa tra il tab Convocazione e la
// modifica rapida "ultimo secondo" in Live (prima di Start) — stesso
// componente, stessa validazione, nessuna logica duplicata tra le due.
import { useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

type SimplePlayer = { id: string; name: string };

type Props = {
  visible: boolean;
  players: SimplePlayer[];
  selectedIds: string[];
  /** Nessun limite se omesso — la lista è comunque limitata dalla rosa reale. */
  max?: number;
  onClose: () => void;
  onConfirm: (ids: string[]) => void;
};

export default function ConvocatiPlayersModal({
  visible,
  players,
  selectedIds,
  max,
  onClose,
  onConfirm,
}: Props) {
  const [ids, setIds] = useState<Set<string>>(new Set(selectedIds));

  useEffect(() => {
    if (visible) setIds(new Set(selectedIds));
  }, [visible, selectedIds]);

  const toggle = (id: string) => {
    setIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (max != null && next.size >= max) return next;
        next.add(id);
      }
      return next;
    });
  };

  const allSelected = players.length > 0 && players.every((p) => ids.has(p.id));
  const toggleAll = () => {
    if (allSelected) {
      setIds(new Set());
    } else {
      const all = players.map((p) => p.id);
      setIds(new Set(max != null ? all.slice(0, max) : all));
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>
              Giocatori convocati ({ids.size}{max != null ? `/${max}` : ''})
            </Text>
            <Pressable style={styles.selectAllBtn} onPress={toggleAll}>
              <Text style={styles.selectAllText}>{allSelected ? 'Deseleziona tutti' : 'Seleziona tutti'}</Text>
            </Pressable>
          </View>
          <FlatList
            style={styles.list}
            data={players}
            keyExtractor={(p) => p.id}
            renderItem={({ item }) => {
              const checked = ids.has(item.id);
              const disabled = !checked && max != null && ids.size >= max;
              return (
                <Pressable
                  style={[styles.row, disabled && { opacity: 0.5 }]}
                  onPress={() => !disabled && toggle(item.id)}
                >
                  <View style={[styles.box, checked && styles.boxOn]}>
                    {checked ? <Text style={{ color: 'white' }}>✓</Text> : null}
                  </View>
                  <Text style={{ flex: 1 }}>{item.name}</Text>
                </Pressable>
              );
            }}
          />
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <Pressable style={[styles.btn, { backgroundColor: '#9ca3af', flex: 1 }]} onPress={onClose}>
              <Text style={styles.btnText}>Annulla</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, { backgroundColor: '#1b7f3b', flex: 1 }]}
              onPress={() => {
                onConfirm(Array.from(ids));
                onClose();
              }}
            >
              <Text style={styles.btnText}>Conferma</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  card: { width: '86%', maxHeight: '80%', backgroundColor: '#fff', borderRadius: 12, padding: 14 },
  // Un maxHeight sul contenitore non basta a rendere scorrevole una FlatList figlia — serve un
  // limite proprio, altrimenti con una rosa lunga il contenuto (bottoni compresi) finisce fuori
  // dallo schermo, irraggiungibile.
  list: { maxHeight: 360 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 8 },
  title: { fontSize: 18, fontWeight: '800', flex: 1 },
  selectAllBtn: { backgroundColor: '#1b7f3b', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8 },
  selectAllText: { color: 'white', fontWeight: '700', fontSize: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    backgroundColor: '#f9fafb',
    marginBottom: 8,
  },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  boxOn: { backgroundColor: '#1b7f3b', borderColor: '#1b7f3b' },
  btn: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, alignItems: 'center' },
  btnText: { color: 'white', fontWeight: '800' },
});
