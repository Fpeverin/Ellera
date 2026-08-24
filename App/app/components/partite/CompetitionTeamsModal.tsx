// app/components/partite/CompetitionTeamsModal.tsx
//
// Configura le squadre fisse (nome + stadio + stemma) di una competizione — vedi
// app/data/competitionTeams.ts. Riusate da CompetitionModal (scelta rapida avversario per round,
// con prepopolamento di luogo e stemma della partita creata) e da altrePartite.tsx (le due squadre
// di un incontro). Autosalva a ogni modifica, nessun bottone "Salva" esplicito.
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  addCompetitionTeam,
  CompetitionTeam,
  loadCompetitionTeams,
  removeCompetitionTeam,
  updateCompetitionTeam,
  uploadCompetitionTeamLogo,
} from '../../data/competitionTeams';

interface Props {
  visible: boolean;
  competition: string;
  onClose: () => void;
}

export default function CompetitionTeamsModal({ visible, competition, onClose }: Props) {
  const [teams, setTeams] = useState<CompetitionTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newStadium, setNewStadium] = useState('');
  const [newLogoUri, setNewLogoUri] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [uploadingLogoFor, setUploadingLogoFor] = useState<string | null>(null);

  const pickImage = async (): Promise<string | null> => {
    // Tutto avvolto in try/catch: senza, un errore qui (permessi, picker) resta una promise
    // rifiutata senza gestori — su schermo non succede nulla e non lo si può distinguere da un
    // annullamento, esattamente il sintomo segnalato ("non vedo l'anteprima").
    try {
      // Su web niente richiesta permessi prima del picker: launchImageLibraryAsync lì apre un
      // <input type="file"> nascosto con un click simulato, che alcuni browser (Safari su iPhone,
      // dove gira questa PWA) eseguono solo se avviene SUBITO nel gesto dell'utente — un "await"
      // anche solo per una richiesta di permessi che su web è comunque un no-op spezza quel gesto e
      // il click simulato non apre nulla, senza errori (funziona da Android, non da webapp: stesso
      // sintomo esatto). Su nativo il permesso resta necessario e non ha questo vincolo.
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permessi', 'Serve il permesso per accedere alle foto.');
          return null;
        }
      }
      // Niente allowsEditing: apre un ritaglio che su alcuni browser (webapp) può fallire in
      // silenzio con certi formati foto (es. HEIC da iPhone) — per uno stemma non serve ritagliare.
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.9,
      });
      if (res.canceled || !res.assets?.length) return null;
      return res.assets[0].uri;
    } catch {
      Alert.alert('Errore', 'Impossibile aprire la selezione immagini.');
      return null;
    }
  };

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    loadCompetitionTeams(competition)
      .then(setTeams)
      .catch(() => setTeams([]))
      .finally(() => setLoading(false));
  }, [visible, competition]);

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    setAdding(true);
    try {
      let created = await addCompetitionTeam(competition, name, newStadium.trim());
      if (newLogoUri) {
        try {
          const { path, url } = await uploadCompetitionTeamLogo(created.id, newLogoUri);
          created = { ...created, logoPath: path, logoUrl: url };
        } catch {
          Alert.alert('Errore', "Squadra aggiunta, ma non è stato possibile caricare lo stemma. Riprova toccando l'icona 📷 sulla riga.");
        }
      }
      setTeams((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setNewName('');
      setNewStadium('');
      setNewLogoUri(null);
    } catch {
      Alert.alert('Errore', 'Impossibile aggiungere la squadra.');
    } finally {
      setAdding(false);
    }
  };

  const handleUpdate = async (team: CompetitionTeam) => {
    try {
      await updateCompetitionTeam(team.id, team.name, team.stadium);
    } catch {
      Alert.alert('Errore', 'Impossibile salvare la modifica.');
    }
  };

  const pickLogo = async (team: CompetitionTeam) => {
    const localUri = await pickImage();
    if (!localUri) return;
    // Anteprima immediata dal file locale, prima ancora che l'upload sia finito — altrimenti
    // l'icona resta uno spinner per tutta la durata del caricamento e sembra che "non sia successo
    // niente" quando si sceglie una foto.
    setTeams((prev) => prev.map((t) => (t.id === team.id ? { ...t, logoUrl: localUri } : t)));
    setUploadingLogoFor(team.id);
    try {
      const { path, url } = await uploadCompetitionTeamLogo(team.id, localUri);
      setTeams((prev) => prev.map((t) => (t.id === team.id ? { ...t, logoPath: path, logoUrl: url } : t)));
    } catch {
      Alert.alert('Errore', 'Impossibile caricare lo stemma.');
    } finally {
      setUploadingLogoFor(null);
    }
  };

  const handleRemove = (team: CompetitionTeam) => {
    Alert.alert('Rimuovi squadra', `Rimuovere "${team.name}" dall'elenco?`, [
      { text: 'Annulla', style: 'cancel' },
      {
        text: 'Rimuovi',
        style: 'destructive',
        onPress: async () => {
          setTeams((prev) => prev.filter((t) => t.id !== team.id));
          try {
            await removeCompetitionTeam(team.id);
          } catch {
            Alert.alert('Errore', 'Impossibile rimuovere la squadra.');
          }
        },
      },
    ]);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.modalTitle}>Squadre della competizione</Text>
          <Text style={styles.modalSubtitle}>{competition}</Text>

          {loading ? (
            <ActivityIndicator size="large" color="#1b4f7f" style={{ marginVertical: 24 }} />
          ) : (
            <ScrollView contentContainerStyle={{ paddingBottom: 8 }}>
              <Text style={styles.hint}>
                Configura qui le squadre di questa competizione — le ritrovi come scelta rapida
                quando crei il calendario partite e in "Altre Partite". Lo stadio (opzionale) serve
                a precompilare il Luogo quando giochi in trasferta contro quella squadra; lo stemma
                (tocca l'icona 📷) viene riusato automaticamente come stemma avversario della
                partita creata.
              </Text>

              {teams.map((team) => (
                <View key={team.id} style={styles.teamRow}>
                  <Pressable style={styles.logoPicker} onPress={() => pickLogo(team)} disabled={uploadingLogoFor === team.id}>
                    {team.logoUrl ? (
                      <Image source={{ uri: team.logoUrl }} style={styles.logoImage} />
                    ) : (
                      <Text style={styles.logoPickerText}>📷</Text>
                    )}
                    {uploadingLogoFor === team.id && (
                      <View style={styles.logoUploadingOverlay}>
                        <ActivityIndicator size="small" color="#fff" />
                      </View>
                    )}
                  </Pressable>
                  <View style={{ flex: 1 }}>
                    <TextInput
                      style={styles.teamInput}
                      value={team.name}
                      onChangeText={(v) => setTeams((prev) => prev.map((t) => (t.id === team.id ? { ...t, name: v } : t)))}
                      onBlur={() => {
                        const current = teams.find((t) => t.id === team.id);
                        if (current) handleUpdate(current);
                      }}
                      placeholder="Nome squadra"
                    />
                    <TextInput
                      style={[styles.teamInput, { marginTop: 6 }]}
                      value={team.stadium}
                      onChangeText={(v) => setTeams((prev) => prev.map((t) => (t.id === team.id ? { ...t, stadium: v } : t)))}
                      onBlur={() => {
                        const current = teams.find((t) => t.id === team.id);
                        if (current) handleUpdate(current);
                      }}
                      placeholder="Stadio (opzionale)"
                    />
                  </View>
                  <Pressable style={styles.teamRemoveBtn} onPress={() => handleRemove(team)}>
                    <Text style={{ fontSize: 18 }}>🗑️</Text>
                  </Pressable>
                </View>
              ))}

              <View style={styles.addRow}>
                <Pressable style={styles.logoPicker} onPress={async () => setNewLogoUri(await pickImage())}>
                  {newLogoUri ? (
                    <Image source={{ uri: newLogoUri }} style={styles.logoImage} />
                  ) : (
                    <Text style={styles.logoPickerText}>📷</Text>
                  )}
                </Pressable>
                <View style={{ flex: 1 }}>
                  <TextInput
                    style={styles.teamInput}
                    value={newName}
                    onChangeText={setNewName}
                    placeholder="Nome nuova squadra"
                  />
                  <TextInput
                    style={[styles.teamInput, { marginTop: 6 }]}
                    value={newStadium}
                    onChangeText={setNewStadium}
                    placeholder="Stadio (opzionale)"
                  />
                </View>
                <Pressable style={[styles.addBtn, (!newName.trim() || adding) && { opacity: 0.6 }]} onPress={handleAdd} disabled={!newName.trim() || adding}>
                  {adding ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.addBtnText}>+</Text>}
                </Pressable>
              </View>

              <Pressable style={styles.closeBtn} onPress={onClose}>
                <Text style={styles.closeText}>Chiudi</Text>
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
  modalSubtitle: { fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 8 },
  hint: { fontSize: 12, color: '#64748b', marginBottom: 12, fontStyle: 'italic', lineHeight: 17 },

  teamRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 10 },
  teamInput: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 10, fontSize: 14, backgroundColor: '#f9fafb' },
  teamRemoveBtn: { paddingHorizontal: 6, paddingTop: 10 },
  logoPicker: {
    width: 44, height: 44, borderRadius: 8, borderWidth: 1, borderColor: '#d1d5db',
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb', overflow: 'hidden',
  },
  logoImage: { width: 44, height: 44, resizeMode: 'contain' },
  logoPickerText: { fontSize: 18 },
  logoUploadingOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center',
  },

  addRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginTop: 4, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  addBtn: { backgroundColor: '#1b4f7f', borderRadius: 8, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  addBtnText: { color: 'white', fontWeight: '800', fontSize: 20 },

  closeBtn: { paddingVertical: 14, alignItems: 'center', marginTop: 12 },
  closeText: { color: '#64748b', fontWeight: '700' },
});
