// app/eventi/partita/[id]/convocazione.tsx
//
// Scheda Convocazione della partita — solo staff (Admin/Staff), visibile
// come tab autonomo accanto a Formazione/Tattiche/Live. Sceglie chi tra
// giocatori e staff (censito in Rosa Staff) è convocato e il ritrovo, e
// produce un PDF (stesso pattern di app/squadra/statistiche.tsx) con solo i
// convocati. I giocatori convocati qui alimentano Formazione (vedi
// app/data/convocazione.ts). Il Menu pranzo è temporaneamente rimosso dalla
// UI (TO DO futuro, vedi PIANO_LAVORO.md) — i campi restano nella colonna
// dati per non richiedere una migrazione quando tornerà.
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ConvocatiPlayersModal from '../../../components/partite/ConvocatiPlayersModal';
import { useAuth } from '../../../context/AuthContext';
import { loadConvocazione, saveConvocatiPlayerIds, saveConvocazione } from '../../../data/convocazione';
import { printOrShareHtml } from '../../../utils/webExport';
import { CalendarEvent, loadEvents, patchEventData } from '../../../data/events';
import { loadOrgLogoUrl, opponentLogoUrlFromPath, uploadOpponentLogo } from '../../../data/organization';
import { loadStaffMembers, StaffCategory, StaffMember } from '../../../data/staffRoster';
import { usePlayers } from '../../../hooks/usePlayers';

const MAX_CONVOCATI = 20;

const CATEGORY_LABELS: Record<StaffCategory, string> = {
  TECNICO: 'Staff Tecnico',
  SANITARIO: 'Staff Sanitario',
  DIRIGENZIALE: 'Dirigenza',
};
const CATEGORIES: StaffCategory[] = ['TECNICO', 'SANITARIO', 'DIRIGENZIALE'];

function esc(s: any) {
  return String(s ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function formatMatchTitle(ev: CalendarEvent | null): string {
  if (!ev) return '';
  const opp = ev.opponent || 'Avversario';
  const ha = (ev as any).homeAway as 'CASA' | 'TRASFERTA' | undefined;
  return ha === 'TRASFERTA' ? `${opp} - Ellera` : `Ellera - ${opp}`;
}

type ExportForm = {
  competizione: string;
  luogo: string;
  ritrovo: string;
  data: string;
  ora: string;
};

export default function Convocazione() {
  const { id: matchId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { membership } = useAuth();
  const readOnly = membership?.role === 'giocatore';
  const { players } = usePlayers();

  const [event, setEvent] = useState<CalendarEvent | null>(null);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const loadedRef = useRef(false);

  const [ritrovo, setRitrovo] = useState('');
  const [playerIds, setPlayerIds] = useState<string[]>([]);
  const [staffIds, setStaffIds] = useState<string[]>([]);

  const [playersModalOpen, setPlayersModalOpen] = useState(false);

  const [orgLogoUrl, setOrgLogoUrl] = useState<string | null>(null);
  const [opponentLogoUrl, setOpponentLogoUrl] = useState<string | null>(null);
  const [logoBusy, setLogoBusy] = useState(false);

  const [exportForm, setExportForm] = useState<ExportForm | null>(null);
  const [exporting, setExporting] = useState(false);

  // --- caricamento iniziale ---
  useEffect(() => {
    (async () => {
      if (!matchId) return;
      try {
        const [events, staff, conv, orgLogo] = await Promise.all([
          loadEvents(),
          loadStaffMembers(),
          loadConvocazione(matchId),
          loadOrgLogoUrl(),
        ]);
        const ev = events.find((e) => `${e.id}` === `${matchId}`) ?? null;
        setEvent(ev);
        setStaffMembers(staff);
        setOrgLogoUrl(orgLogo);
        const opponentLogoPath = (ev as any)?.opponentLogoPath;
        setOpponentLogoUrl(opponentLogoPath ? opponentLogoUrlFromPath(opponentLogoPath) : null);

        setRitrovo(conv.ritrovo);
        setPlayerIds(conv.playerIds);
        setStaffIds(conv.staffIds);
      } catch {
        Alert.alert('Errore', 'Impossibile caricare la convocazione.');
      } finally {
        setLoading(false);
        loadedRef.current = true;
      }
    })();
  }, [matchId]);

  // --- autosalvataggio ---
  useEffect(() => {
    if (!loadedRef.current || !matchId) return;
    (async () => {
      try {
        await saveConvocazione(matchId, { ritrovo, playerIds, staffIds, menuItems: [], meals: {} });
      } catch {}
    })();
  }, [matchId, ritrovo, staffIds]);

  const handleConfirmPlayers = async (ids: string[]) => {
    if (!matchId) return;
    setPlayerIds(ids);
    try {
      await saveConvocatiPlayerIds(matchId, ids);
    } catch {
      Alert.alert('Errore', 'Impossibile salvare i giocatori convocati.');
    }
  };

  const toggleStaff = (id: string) => {
    setStaffIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const pickOpponentLogo = async () => {
    if (!matchId) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permessi', 'Serve il permesso per accedere alle foto.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.9,
    });
    if (res.canceled) return;
    setLogoBusy(true);
    try {
      const { path, url } = await uploadOpponentLogo(matchId, res.assets[0].uri);
      await patchEventData(matchId, { opponentLogoPath: path });
      setOpponentLogoUrl(url);
    } catch {
      Alert.alert('Errore', 'Impossibile salvare il logo avversario.');
    } finally {
      setLogoBusy(false);
    }
  };

  // --- persone convocate (giocatori + staff) ---
  const convocatedPlayers = players.filter((p) => playerIds.includes(p.id));
  const convocatedStaff = staffMembers.filter((s) => staffIds.includes(s.id));

  const staffCountByCategory = (cat: StaffCategory) =>
    staffMembers.filter((s) => s.category === cat && staffIds.includes(s.id)).length;
  const totale = playerIds.length + staffIds.length;

  // --- PDF ---
  const openExportModal = () => {
    setExportForm({
      competizione: (event as any)?.competition || '',
      luogo: event?.location || '',
      ritrovo,
      data: event?.date || '',
      ora: event?.time || '',
    });
  };

  const runExport = async () => {
    if (!exportForm) return;
    setExporting(true);
    try {
      const giocatoriRows = convocatedPlayers
        .map((p) => `<tr><td>${esc(p.name)}</td></tr>`)
        .join('');

      const staffSectionHtml = CATEGORIES.map((cat) => {
        const rows = convocatedStaff
          .filter((s) => s.category === cat)
          .map((s) => `<tr><td>${esc(s.name)}${s.role ? ` — ${esc(s.role)}` : ''}</td></tr>`)
          .join('');
        if (!rows) return '';
        return `<h3>${esc(CATEGORY_LABELS[cat])}</h3><table>${rows}</table>`;
      }).join('');

      const logosHtml = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <div>${orgLogoUrl ? `<img src="${esc(orgLogoUrl)}" style="height:64px;" />` : ''}</div>
          <div>${opponentLogoUrl ? `<img src="${esc(opponentLogoUrl)}" style="height:64px;" />` : ''}</div>
        </div>
      `;

      const styles = `
        <style>
          body { font-family: system-ui, Roboto, Arial; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
          td, th { border: 1px solid #e5e7eb; padding: 6px; }
          h1 { margin-bottom: 4px; }
          h2 { margin-top: 24px; }
          h3 { margin-bottom: 4px; }
        </style>
      `;

      const html = `
        <html>
          <head>${styles}</head>
          <body>
            ${logosHtml}
            <h1>Scheda Convocazione</h1>
            <p><strong>${esc(formatMatchTitle(event))}</strong></p>
            <p>${esc(exportForm.competizione)}</p>
            <p>${esc(exportForm.data)} — ${esc(exportForm.ora)}</p>
            <p>${esc(exportForm.luogo)}</p>
            <p>Ritrovo: ${esc(exportForm.ritrovo || '—')}</p>

            <h2>Giocatori convocati (${convocatedPlayers.length})</h2>
            <table>${giocatoriRows}</table>

            <h2>Staff</h2>
            ${staffSectionHtml}

            <h2>Riepilogo</h2>
            <table>
              <tr><td>Giocatori</td><td>${playerIds.length}</td></tr>
              <tr><td>Staff Tecnico</td><td>${staffCountByCategory('TECNICO')}</td></tr>
              <tr><td>Staff Sanitario</td><td>${staffCountByCategory('SANITARIO')}</td></tr>
              <tr><td>Dirigenza</td><td>${staffCountByCategory('DIRIGENZIALE')}</td></tr>
              <tr><td><strong>Totale</strong></td><td><strong>${totale}</strong></td></tr>
            </table>
          </body>
        </html>
      `;

      await printOrShareHtml(html);
      setExportForm(null);
    } catch {
      Alert.alert('Errore', 'Impossibile generare il PDF.');
    } finally {
      setExporting(false);
    }
  };

  if (readOnly) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <Text style={{ padding: 20, color: '#64748b' }}>Non disponibile per il tuo ruolo.</Text>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <Text style={{ padding: 20, color: '#64748b' }}>Caricamento…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <Text style={styles.title}>Convocazione</Text>
        <Text style={styles.matchTitle}>{formatMatchTitle(event)}</Text>
        <Text style={styles.matchSub}>
          {(event as any)?.competition ? `${(event as any).competition} · ` : ''}
          {event?.date} {event?.time ? `· ${event.time}` : ''}
        </Text>
        {event?.location ? <Text style={styles.matchSub}>{event.location}</Text> : null}

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Logo avversario</Text>
            <Pressable style={styles.smallBtn} onPress={pickOpponentLogo} disabled={logoBusy}>
              <Text style={styles.smallBtnText}>{logoBusy ? 'Caricamento…' : opponentLogoUrl ? 'Cambia' : '+ Carica'}</Text>
            </Pressable>
          </View>
          {opponentLogoUrl ? (
            <Image source={{ uri: opponentLogoUrl }} style={styles.opponentLogoPreview} resizeMode="contain" />
          ) : (
            <Text style={styles.previewText}>Nessun logo caricato</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ritrovo</Text>
          <TextInput
            style={styles.input}
            value={ritrovo}
            onChangeText={setRitrovo}
            placeholder="Es. Ore 11:45 - Stadio G.Fioroni"
          />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>
              Giocatori convocati ({playerIds.length}/{MAX_CONVOCATI})
            </Text>
            <Pressable style={styles.smallBtn} onPress={() => setPlayersModalOpen(true)}>
              <Text style={styles.smallBtnText}>✏️ Modifica</Text>
            </Pressable>
          </View>
          {convocatedPlayers.length > 0 ? (
            <View style={styles.chipsRow}>
              {convocatedPlayers.map((p) => (
                <View key={p.id} style={styles.playerChip}>
                  <Text style={styles.playerChipText}>{p.name}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.previewText}>Nessun giocatore convocato</Text>
          )}
        </View>

        {CATEGORIES.map((cat) => {
          const inCategory = staffMembers.filter((s) => s.category === cat);
          return (
            <View style={styles.section} key={cat}>
              <Text style={styles.sectionTitle}>
                {CATEGORY_LABELS[cat]} ({staffCountByCategory(cat)})
              </Text>
              {inCategory.length === 0 ? (
                <Pressable onPress={() => router.push('/squadra/staffRoster')}>
                  <Text style={styles.linkText}>
                    Nessuno in {CATEGORY_LABELS[cat]} — aggiungilo da Rosa Staff
                  </Text>
                </Pressable>
              ) : (
                inCategory.map((s) => {
                  const checked = staffIds.includes(s.id);
                  return (
                    <Pressable key={s.id} style={styles.ckRow} onPress={() => toggleStaff(s.id)}>
                      <View style={[styles.ckBox, checked && styles.ckBoxOn]}>
                        {checked ? <Text style={{ color: 'white' }}>✓</Text> : null}
                      </View>
                      <Text style={{ flex: 1 }}>
                        {s.name}
                        {s.role ? ` — ${s.role}` : ''}
                      </Text>
                    </Pressable>
                  );
                })
              )}
            </View>
          );
        })}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Riepilogo</Text>
          <Text style={styles.summaryLine}>Giocatori: {playerIds.length}</Text>
          <Text style={styles.summaryLine}>Staff Tecnico: {staffCountByCategory('TECNICO')}</Text>
          <Text style={styles.summaryLine}>Staff Sanitario: {staffCountByCategory('SANITARIO')}</Text>
          <Text style={styles.summaryLine}>Dirigenza: {staffCountByCategory('DIRIGENZIALE')}</Text>
          <Text style={[styles.summaryLine, { fontWeight: '800' }]}>Totale: {totale}</Text>
        </View>

        <Pressable style={styles.pdfBtn} onPress={openExportModal}>
          <Text style={styles.pdfBtnText}>📄 Esporta PDF</Text>
        </Pressable>
      </ScrollView>

      <ConvocatiPlayersModal
        visible={playersModalOpen}
        players={players}
        selectedIds={playerIds}
        max={MAX_CONVOCATI}
        onClose={() => setPlayersModalOpen(false)}
        onConfirm={handleConfirmPlayers}
      />

      {/* pre-export: conferma/aggiusta i dati che vanno sul PDF */}
      <Modal visible={!!exportForm} transparent animationType="fade" onRequestClose={() => setExportForm(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Dati per il PDF</Text>
            <TextInput
              style={styles.input}
              placeholder="Competizione / Giornata"
              value={exportForm?.competizione ?? ''}
              onChangeText={(v) => setExportForm((f) => (f ? { ...f, competizione: v } : f))}
            />
            <TextInput
              style={styles.input}
              placeholder="Luogo"
              value={exportForm?.luogo ?? ''}
              onChangeText={(v) => setExportForm((f) => (f ? { ...f, luogo: v } : f))}
            />
            <TextInput
              style={styles.input}
              placeholder="Ritrovo"
              value={exportForm?.ritrovo ?? ''}
              onChangeText={(v) => setExportForm((f) => (f ? { ...f, ritrovo: v } : f))}
            />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Data"
                value={exportForm?.data ?? ''}
                onChangeText={(v) => setExportForm((f) => (f ? { ...f, data: v } : f))}
              />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Ora"
                value={exportForm?.ora ?? ''}
                onChangeText={(v) => setExportForm((f) => (f ? { ...f, ora: v } : f))}
              />
            </View>
            <View style={styles.row}>
              <Pressable style={[styles.btn, styles.btnOutline]} onPress={() => setExportForm(null)}>
                <Text style={styles.btnOutlineText}>Annulla</Text>
              </Pressable>
              <Pressable style={[styles.btn, styles.btnPrimary]} onPress={runExport} disabled={exporting}>
                <Text style={styles.btnPrimaryText}>{exporting ? 'Creazione…' : 'Esporta'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  title: { fontSize: 24, fontWeight: '800', color: '#1a202c' },
  matchTitle: { fontSize: 18, fontWeight: '700', color: '#1a202c', marginTop: 8 },
  matchSub: { fontSize: 14, color: '#64748b' },

  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1a202c', marginBottom: 8 },
  previewText: { fontSize: 13, color: '#64748b' },
  linkText: { fontSize: 13, color: '#2563eb', fontWeight: '600' },

  opponentLogoPreview: { width: 64, height: 64, marginTop: 4 },

  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#f9fafb',
    fontSize: 14,
    marginBottom: 8,
  },

  smallBtn: { backgroundColor: '#1b7f3b', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  smallBtnText: { color: 'white', fontWeight: '700', fontSize: 13 },

  ckRow: {
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
  ckBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  ckBoxOn: { backgroundColor: '#1b7f3b', borderColor: '#1b7f3b' },

  summaryLine: { fontSize: 14, color: '#334155', marginBottom: 2 },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  playerChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#dcfce7',
  },
  playerChipText: { fontSize: 13, color: '#166534', fontWeight: '600' },

  pdfBtn: {
    backgroundColor: '#1b4f7f',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  pdfBtnText: { color: 'white', fontWeight: '800', fontSize: 16 },

  row: { flexDirection: 'row', gap: 12, marginTop: 4 },
  btn: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  btnPrimary: { backgroundColor: '#1b7f3b' },
  btnPrimaryText: { color: '#fff', fontWeight: '700' },
  btnOutline: { backgroundColor: '#f1f5f9' },
  btnOutlineText: { color: '#475569', fontWeight: '700' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalBox: { backgroundColor: '#fff', borderRadius: 16, padding: 20, width: '100%', maxWidth: 420 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: '#1a202c', marginBottom: 8, textAlign: 'center' },
});
