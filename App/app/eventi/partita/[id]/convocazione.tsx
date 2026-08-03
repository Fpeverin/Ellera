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
import { sendExpoPush } from '../../../data/pushNotify';
import { loadStaffMembers, StaffCategory, StaffMember } from '../../../data/staffRoster';
import TeamLogo from '../../../components/TeamLogo';
import { usePlayers } from '../../../hooks/usePlayers';
import { getCurrentOrgId } from '../../../lib/currentOrg';
import { supabase } from '../../../lib/supabase';

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

/** "2026-09-14" -> "Domenica 14 settembre 2026" (come nella Scheda Convocazione Excel); testo libero lasciato invariato. */
function formatLongDateIt(value: string): string {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return value;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const s = d.toLocaleDateString('it-IT', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
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
  const [notifying, setNotifying] = useState(false);

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
        .map((p, i) => `<tr><td class="numCell">${i + 1}</td><td>${esc(p.name)}</td></tr>`)
        .join('');

      const staffColumnHtml = CATEGORIES.map((cat) => {
        const members = convocatedStaff.filter((s) => s.category === cat);
        if (members.length === 0) return '';
        const rows = members
          .map(
            (s) => `
              <tr class="roleRow"><td colspan="2">${esc(s.role || '—')}</td></tr>
              <tr class="nameRow"><td colspan="2">${esc(s.name)}</td></tr>
            `
          )
          .join('');
        return `
          <div class="sectionHeader">${esc(CATEGORY_LABELS[cat])}</div>
          <table class="list">${rows}</table>
        `;
      }).join('');

      const styles = `
        <style>
          body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #000; margin: 20px; }
          .topBanner { text-align: center; font-weight: bold; font-size: 14px; margin-bottom: 8px; }
          .headerTable { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
          .headerTable td { vertical-align: middle; border: 1px solid #000; padding: 6px; }
          .logoCell { width: 22%; text-align: center; border: none !important; }
          .logoCell img { max-width: 100px; max-height: 100px; }
          .titleCell { width: 56%; text-align: center; }
          .matchTitle { font-size: 16px; font-weight: bold; color: #1D00FF; margin-bottom: 2px; }
          .compLine { font-size: 13px; margin-bottom: 2px; }
          .dateTimeLine { font-size: 13px; margin-bottom: 2px; }
          .venueLine { font-size: 12px; }
          .ritrovoBox { border: 1px solid #000; padding: 8px; font-weight: bold; margin-bottom: 10px; }
          .ritrovoBox .value { font-weight: normal; }
          .columns { display: flex; gap: 10px; }
          .col { flex: 1; }
          .sectionHeader { border: 1px solid #000; text-align: center; font-weight: bold; padding: 5px; margin-top: 8px; }
          .col > .sectionHeader:first-child { margin-top: 0; }
          table.list { width: 100%; border-collapse: collapse; }
          table.list td { border: 1px solid #000; padding: 4px 8px; font-size: 12px; text-align: center; }
          table.list td.numCell { width: 26px; font-weight: bold; }
          table.list tr:not(.roleRow):not(.nameRow) td:not(.numCell) { text-align: left; }
          .roleRow td { font-weight: bold; border-bottom: none; }
          .nameRow td { border-top: none; }
          .riepilogoWrap { display: flex; justify-content: center; align-items: center; gap: 20px; margin-top: 16px; }
          .bottomLogo img { max-width: 90px; max-height: 90px; }
          .riepilogoBox { border: 1px solid #000; min-width: 220px; }
          .riepilogoBox .title { text-align: center; font-weight: bold; border-bottom: 1px solid #000; padding: 5px; }
          .riepilogoBox table { width: 100%; border-collapse: collapse; }
          .riepilogoBox td { padding: 4px 10px; font-size: 12px; border-top: 1px solid #000; }
          .riepilogoBox tr:first-child td { border-top: none; }
          .riepilogoBox tr.tot td { font-weight: bold; }
          .riepilogoBox td:last-child { text-align: center; }
        </style>
      `;

      const html = `
        <html>
          <head>${styles}</head>
          <body>
            <div class="topBanner">Scheda Convocazione</div>

            <table class="headerTable">
              <tr>
                <td class="logoCell">${orgLogoUrl ? `<img src="${esc(orgLogoUrl)}" />` : ''}</td>
                <td class="titleCell">
                  <div class="matchTitle">Convocazione ${esc(formatMatchTitle(event))}</div>
                  ${exportForm.competizione ? `<div class="compLine">${esc(exportForm.competizione)}</div>` : ''}
                  <div class="dateTimeLine"><strong>${esc(formatLongDateIt(exportForm.data))}</strong>${exportForm.ora ? ` — Ore ${esc(exportForm.ora)}` : ''}</div>
                  ${exportForm.luogo ? `<div class="venueLine">${esc(exportForm.luogo)}</div>` : ''}
                </td>
                <td class="logoCell">${opponentLogoUrl ? `<img src="${esc(opponentLogoUrl)}" />` : ''}</td>
              </tr>
            </table>

            ${exportForm.ritrovo ? `<div class="ritrovoBox">Ritrovo: <span class="value">${esc(exportForm.ritrovo)}</span></div>` : ''}

            <div class="columns">
              <div class="col">
                <div class="sectionHeader">Convocazioni Giocatori (${convocatedPlayers.length})</div>
                <table class="list">${giocatoriRows}</table>
              </div>
              <div class="col">${staffColumnHtml}</div>
            </div>

            <div class="riepilogoWrap">
              <div class="bottomLogo">${orgLogoUrl ? `<img src="${esc(orgLogoUrl)}" />` : ''}</div>
              <div class="riepilogoBox">
                <div class="title">Riepilogo</div>
                <table>
                  <tr><td>Giocatori</td><td>${playerIds.length}</td></tr>
                  <tr><td>Staff Tecnico</td><td>${staffCountByCategory('TECNICO')}</td></tr>
                  <tr><td>Staff Sanitario</td><td>${staffCountByCategory('SANITARIO')}</td></tr>
                  <tr><td>Dirigenza</td><td>${staffCountByCategory('DIRIGENZIALE')}</td></tr>
                  <tr class="tot"><td>Totale</td><td>${totale}</td></tr>
                </table>
              </div>
              <div class="bottomLogo">${opponentLogoUrl ? `<img src="${esc(opponentLogoUrl)}" />` : ''}</div>
            </div>
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

  // --- notifica push ai convocati (a parte, non parte dell'export PDF) ---
  const handleNotifyConvocati = async () => {
    if (playerIds.length === 0) {
      Alert.alert('Nessun convocato', 'Convoca almeno un giocatore prima di inviare la notifica.');
      return;
    }
    setNotifying(true);
    try {
      const orgId = getCurrentOrgId();
      const { data: tokens, error } = await supabase.rpc('get_push_tokens_for_players', {
        p_org_id: orgId,
        p_player_ids: playerIds,
      });
      if (error) throw error;

      const title = `Convocazione — ${formatMatchTitle(event)}`;
      const when = [event?.date, event?.time].filter(Boolean).join(' · ');
      const body = [when, ritrovo ? `Ritrovo: ${ritrovo}` : null].filter(Boolean).join(' — ') || 'Controlla i dettagli in app.';
      await sendExpoPush(tokens ?? [], title, body, { matchId });

      const notified = tokens?.length ?? 0;
      Alert.alert(
        'Notifica inviata',
        notified < playerIds.length
          ? `Avvisati ${notified} di ${playerIds.length} convocati (gli altri non hanno ancora l'app configurata per le notifiche).`
          : `Avvisati tutti i ${notified} convocati.`
      );
    } catch {
      Alert.alert('Errore', 'Impossibile inviare la notifica.');
    } finally {
      setNotifying(false);
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
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={styles.title}>Convocazione</Text>
          <TeamLogo size={28} />
        </View>
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

        <Pressable style={styles.notifyBtn} onPress={handleNotifyConvocati} disabled={notifying}>
          <Text style={styles.notifyBtnText}>{notifying ? 'Invio…' : '🔔 Notifica convocati'}</Text>
        </Pressable>

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
    marginTop: 12,
  },
  pdfBtnText: { color: 'white', fontWeight: '800', fontSize: 16 },

  notifyBtn: {
    backgroundColor: '#b45309',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  notifyBtnText: { color: 'white', fontWeight: '800', fontSize: 16 },

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
