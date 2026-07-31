// app/eventi/allenamento/[id].tsx
import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../../context/AuthContext';
import { CalendarEvent, loadEvents, saveEvents } from '../../../data/events';
import { loadShowTrainingAttendance } from '../../../data/organization';
import { usePlayers } from '../../../hooks/usePlayers';

// Tipi di presenza per gli allenamenti
export type PresenceStatus = 'presente' | 'assente' | 'infortunato' | 'differenziato';

const PRESENCE_OPTIONS: { value: PresenceStatus; label: string; emoji: string; color: string }[] = [
  { value: 'presente', label: 'Presente', emoji: '✅', color: '#10b981' },
  { value: 'assente', label: 'Assente', emoji: '❌', color: '#ef4444' },
  { value: 'infortunato', label: 'Infortunato', emoji: '🏥', color: '#f59e0b' },
  { value: 'differenziato', label: 'Differenziato', emoji: '⚡', color: '#8b5cf6' },
];

export default function AllenamentoDettaglio() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { membership } = useAuth();
  const readOnly = membership?.role === 'giocatore';
  const { players } = usePlayers();
  const [event, setEvent] = useState<CalendarEvent | null>(null);
  const [presenze, setPresenze] = useState<Record<string, PresenceStatus>>({});
  const [tema, setTema] = useState('');
  const [showPlayerModal, setShowPlayerModal] = useState<string | null>(null);
  const [showAttendance, setShowAttendance] = useState(true);

  useEffect(() => {
    loadShowTrainingAttendance().then(setShowAttendance).catch(() => {});
  }, []);

  const loadAndSetEvent = async () => {
    const list: CalendarEvent[] = await loadEvents();
    const found = list.find(ev => ev.id === id);
    if (!found) return;

    setEvent(found);
    // Migrazione dei dati: se presenze è boolean, convertilo in PresenceStatus
    const existingPresenze = found.presenze ?? {};
    const migratedPresenze: Record<string, PresenceStatus> = {};
    
    Object.entries(existingPresenze).forEach(([playerId, status]) => {
      if (typeof status === 'boolean') {
        // Migrazione da boolean a PresenceStatus
        migratedPresenze[playerId] = status ? 'presente' : 'assente';
      } else {
        // Già nel nuovo formato
        migratedPresenze[playerId] = status as PresenceStatus;
      }
    });
    
    setPresenze(migratedPresenze);
    setTema(found.temaAllenamento ?? '');
  };

  useEffect(() => {
    loadAndSetEvent();
  }, [id]);

  const sortedPlayers = useMemo(
    () => [...players].sort((a, b) => a.name.localeCompare(b.name, 'it', { sensitivity: 'base' })),
    [players]
  );

  const save = async (newPresenze: Record<string, PresenceStatus>, newTema: string) => {
    if (!event) return;
    const list: CalendarEvent[] = await loadEvents();
    const updatedList = list.map(ev =>
      ev.id === event.id ? { ...ev, presenze: newPresenze, temaAllenamento: newTema } : ev
    );
    await saveEvents(updatedList);
    // Non aggiorniamo lo stato event qui per evitare problemi di tipo
    loadAndSetEvent();
  };

  const updatePresenza = (playerId: string, status: PresenceStatus) => {
    setPresenze(prev => {
      const updated = { ...prev, [playerId]: status };
      // persisto subito
      save(updated, tema);
      return updated;
    });
    setShowPlayerModal(null);
  };

  // Statistiche delle presenze
  const stats = useMemo(() => {
    const total = sortedPlayers.length;
    const presente = Object.values(presenze).filter(s => s === 'presente').length;
    const assente = Object.values(presenze).filter(s => s === 'assente').length;
    const infortunato = Object.values(presenze).filter(s => s === 'infortunato').length;
    const differenziato = Object.values(presenze).filter(s => s === 'differenziato').length;
    const nonRisposto = total - presente - assente - infortunato - differenziato;
    
    return { total, presente, assente, infortunato, differenziato, nonRisposto };
  }, [presenze, sortedPlayers]);

  if (!event) {
    return (
      <View style={styles.container}>
        <Text>Evento non trovato</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Allenamento</Text>
        <View style={styles.eventInfo}>
          <Text style={styles.eventDate}>📅 {event.date}</Text>
          <Text style={styles.eventTime}>🕐 {event.time}</Text>
          <Text style={styles.eventLocation}>📍 {event.location}</Text>
        </View>
      </View>

      {/* Statistiche presenze (configurabile dall'Admin, vedi Gestione Squadra → Admin → Configurazioni) */}
      {showAttendance && (
        <View style={styles.statsContainer}>
          <View style={[styles.statCard, { backgroundColor: '#dcfce7' }]}>
            <Text style={[styles.statNumber, { color: '#16a34a' }]}>{stats.presente}</Text>
            <Text style={styles.statLabel}>Presenti</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#fef2f2' }]}>
            <Text style={[styles.statNumber, { color: '#dc2626' }]}>{stats.assente}</Text>
            <Text style={styles.statLabel}>Assenti</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#fef3c7' }]}>
            <Text style={[styles.statNumber, { color: '#d97706' }]}>{stats.infortunato}</Text>
            <Text style={styles.statLabel}>Infortunati</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#f3e8ff' }]}>
            <Text style={[styles.statNumber, { color: '#7c3aed' }]}>{stats.differenziato}</Text>
            <Text style={styles.statLabel}>Differenziato</Text>
          </View>
        </View>
      )}

      <Text style={styles.subtitle}>Tema allenamento</Text>
      <TextInput
        style={styles.input}
        value={tema}
        onChangeText={(t) => {
          setTema(t);
          save(presenze, t);
        }}
        placeholder="Inserisci tema dell'allenamento..."
        multiline
        numberOfLines={3}
        editable={!readOnly}
      />

      {showAttendance && (
        <>
          <Text style={styles.subtitle}>Presenze giocatori</Text>
          <FlatList
            data={sortedPlayers}
            keyExtractor={(item) => item.id}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            renderItem={({ item }) => {
              const currentStatus = presenze[item.id];
              const statusOption = PRESENCE_OPTIONS.find(opt => opt.value === currentStatus);

              return (
                <Pressable
                  style={styles.playerCard}
                  onPress={readOnly ? undefined : () => setShowPlayerModal(item.id)}
                >
                  <View style={styles.playerInfo}>
                    <Text style={styles.playerName}>{item.name}</Text>
                    <Text style={styles.playerRole}>{item.role}</Text>
                  </View>

                  <View style={[styles.statusBadge, { backgroundColor: statusOption?.color || '#e5e7eb' }]}>
                    <Text style={styles.statusEmoji}>{statusOption?.emoji || '❓'}</Text>
                    <Text style={styles.statusText}>{statusOption?.label || 'Non risposto'}</Text>
                  </View>
                </Pressable>
              );
            }}
            showsVerticalScrollIndicator={false}
          />

          {/* Modal per selezione stato presenza */}
          <Modal
            visible={!!showPlayerModal}
            transparent
            animationType="slide"
            onRequestClose={() => setShowPlayerModal(null)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>
                  Stato presenza - {sortedPlayers.find(p => p.id === showPlayerModal)?.name}
                </Text>

                {PRESENCE_OPTIONS.map((option) => (
                  <Pressable
                    key={option.value}
                    style={[styles.optionButton, { borderColor: option.color }]}
                    onPress={() => updatePresenza(showPlayerModal!, option.value)}
                  >
                    <Text style={styles.optionEmoji}>{option.emoji}</Text>
                    <Text style={[styles.optionText, { color: option.color }]}>{option.label}</Text>
                  </Pressable>
                ))}

                <Pressable
                  style={styles.cancelButton}
                  onPress={() => setShowPlayerModal(null)}
                >
                  <Text style={styles.cancelText}>Annulla</Text>
                </Pressable>
              </View>
            </View>
          </Modal>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f8fafc' },
  
  header: { marginBottom: 20 },
  title: { fontSize: 28, fontWeight: '800', color: '#1e293b', marginBottom: 12 },
  eventInfo: { gap: 8 },
  eventDate: { fontSize: 16, color: '#475569', fontWeight: '500' },
  eventTime: { fontSize: 16, color: '#475569', fontWeight: '500' },
  eventLocation: { fontSize: 16, color: '#475569', fontWeight: '500' },

  statsContainer: { 
    flexDirection: 'row', 
    gap: 8, 
    marginBottom: 20 
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  statNumber: { fontSize: 20, fontWeight: '800', marginBottom: 4 },
  statLabel: { fontSize: 11, color: '#64748b', textAlign: 'center', fontWeight: '600' },

  subtitle: { 
    fontSize: 18, 
    fontWeight: '700', 
    color: '#1e293b', 
    marginTop: 20, 
    marginBottom: 12 
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1, 
    borderColor: '#e2e8f0', 
    paddingHorizontal: 16, 
    paddingVertical: 12, 
    borderRadius: 12,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },

  playerCard: {
    flexDirection: 'row', 
    alignItems: 'center',
    backgroundColor: '#fff', 
    paddingVertical: 16, 
    paddingHorizontal: 16, 
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  playerInfo: { flex: 1 },
  playerName: { fontSize: 16, fontWeight: '700', color: '#1e293b', marginBottom: 4 },
  playerRole: { fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 },
  
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    gap: 6,
  },
  statusEmoji: { fontSize: 16 },
  statusText: { fontSize: 12, fontWeight: '700', color: '#fff' },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 20,
    textAlign: 'center',
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 12,
    gap: 12,
  },
  optionEmoji: { fontSize: 20 },
  optionText: { fontSize: 16, fontWeight: '600' },
  cancelButton: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    marginTop: 8,
  },
  cancelText: { fontSize: 16, fontWeight: '600', color: '#64748b' },
});
