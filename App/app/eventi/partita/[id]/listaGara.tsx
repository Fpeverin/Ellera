// app/eventi/partita/[id]/listaGara.tsx
//
// Tab "Lista Gara", solo Staff/Admin: numeri 1-11 (titolari) e 12-20 (panchina) assegnati ai
// giocatori, più 6 ruoli di staff dedicati (Allenatore/Vice-Allenatore/Preparatore Atletico/
// Preparatore Portieri/Fisioterapista/Dirigente Accompagnatore). Ogni assegnazione si sceglie
// prima tra i convocati di questa partita, con la rosa/staff completi come ripiego (richiesta di
// Francesco, 2026-08-21) — nessun vincolo di reparto sui ruoli di staff, solo un ordinamento che
// mette i convocati in cima.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import TeamLogo from '../../../components/TeamLogo';
import { useAuth } from '../../../context/AuthContext';
import { loadConvocazione } from '../../../data/convocazione';
import { CalendarEvent, loadEvents } from '../../../data/events';
import {
  LISTA_GARA_STAFF_ROLES,
  ListaGaraData,
  ListaGaraStaffRole,
  loadListaGara,
  saveListaGara,
} from '../../../data/matchLive';
import { loadOrgLogoUrl, opponentLogoUrlFromPath } from '../../../data/organization';
import { loadStaffMembers, StaffMember } from '../../../data/staffRoster';
import { usePlayers } from '../../../hooks/usePlayers';
import { printOrShareHtml } from '../../../utils/webExport';

function esc(s: any) {
  return String(s ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

/** "2026-09-14" -> "Domenica 14 settembre 2026"; testo libero lasciato invariato. */
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
  data: string;
  ora: string;
};

const STAFF_ROLE_LABELS: Record<ListaGaraStaffRole, string> = {
  allenatore: 'Allenatore',
  viceAllenatore: 'Vice-Allenatore',
  preparatoreAtletico: 'Preparatore Atletico',
  preparatorePortieri: 'Preparatore Portieri',
  fisioterapista: 'Fisioterapista',
  dirigenteAccompagnatore: 'Dirigente Accompagnatore',
};

const STARTER_NUMBERS = Array.from({ length: 11 }, (_, i) => i + 1); // 1..11
const BENCH_NUMBERS = Array.from({ length: 9 }, (_, i) => i + 12); // 12..20

type PersonRef = { kind: 'player' | 'staff'; id: string; name: string };

function encodeStaffValue(ref: PersonRef): string {
  return `${ref.kind}:${ref.id}`;
}
function decodeStaffValue(value: string | undefined): { kind: 'player' | 'staff'; id: string } | null {
  if (!value) return null;
  const idx = value.indexOf(':');
  if (idx === -1) return null;
  return { kind: value.slice(0, idx) as 'player' | 'staff', id: value.slice(idx + 1) };
}

function formatMatchTitle(ev: CalendarEvent | null): string {
  if (!ev) return '';
  const opp = ev.opponent || 'Avversario';
  const ha = (ev as any).homeAway as 'CASA' | 'TRASFERTA' | undefined;
  return ha === 'TRASFERTA' ? `${opp} - Ellera` : `Ellera - ${opp}`;
}

type PickerTarget = { kind: 'number'; number: number } | { kind: 'staff'; role: ListaGaraStaffRole };

export default function ListaGara() {
  const { id: matchId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { membership } = useAuth();
  const readOnly = membership?.role === 'giocatore';
  const { players, loading: playersLoading } = usePlayers();

  const [event, setEvent] = useState<CalendarEvent | null>(null);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [convocatiPlayerIds, setConvocatiPlayerIds] = useState<string[]>([]);
  const [convocatiStaffIds, setConvocatiStaffIds] = useState<string[]>([]);
  const [data, setData] = useState<ListaGaraData>({ numbers: {}, staff: {} });
  const [loading, setLoading] = useState(true);
  const [pickerTarget, setPickerTarget] = useState<PickerTarget | null>(null);

  const [orgLogoUrl, setOrgLogoUrl] = useState<string | null>(null);
  const [opponentLogoUrl, setOpponentLogoUrl] = useState<string | null>(null);
  const [exportForm, setExportForm] = useState<ExportForm | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    (async () => {
      if (!matchId) return;
      const [events, conv, staff, lg, orgLogo] = await Promise.all([
        loadEvents(),
        loadConvocazione(matchId),
        loadStaffMembers(),
        loadListaGara(matchId),
        loadOrgLogoUrl(),
      ]);
      const ev = events.find((e) => `${e.id}` === `${matchId}`) ?? null;
      setEvent(ev);
      setConvocatiPlayerIds(conv.playerIds ?? []);
      setConvocatiStaffIds(conv.staffIds ?? []);
      setStaffMembers(staff);
      setData(lg);
      setOrgLogoUrl(orgLogo);
      const opponentLogoPath = (ev as any)?.opponentLogoPath;
      setOpponentLogoUrl(opponentLogoPath ? opponentLogoUrlFromPath(opponentLogoPath) : null);
      setLoading(false);
    })();
  }, [matchId]);

  const playersById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const staffById = useMemo(() => new Map(staffMembers.map((s) => [s.id, s])), [staffMembers]);

  const persist = async (next: ListaGaraData) => {
    setData(next);
    await saveListaGara(matchId, next);
  };

  const assignNumber = (number: number, playerId: string) => {
    const next = { ...data, numbers: { ...data.numbers, [String(number)]: playerId } };
    persist(next);
    setPickerTarget(null);
  };
  const clearNumber = (number: number) => {
    const nextNumbers = { ...data.numbers };
    delete nextNumbers[String(number)];
    persist({ ...data, numbers: nextNumbers });
  };

  const assignStaffRole = (role: ListaGaraStaffRole, ref: PersonRef) => {
    const next = { ...data, staff: { ...data.staff, [role]: encodeStaffValue(ref) } };
    persist(next);
    setPickerTarget(null);
  };
  const clearStaffRole = (role: ListaGaraStaffRole) => {
    const nextStaff = { ...data.staff };
    delete nextStaff[role];
    persist({ ...data, staff: nextStaff });
  };

  const nameForNumber = (number: number): string | null => {
    const playerId = data.numbers[String(number)];
    if (!playerId) return null;
    return playersById.get(playerId)?.name ?? '(giocatore rimosso)';
  };

  const nameForStaffRole = (role: ListaGaraStaffRole): string | null => {
    const ref = decodeStaffValue(data.staff[role]);
    if (!ref) return null;
    if (ref.kind === 'player') return playersById.get(ref.id)?.name ?? '(giocatore rimosso)';
    return staffById.get(ref.id)?.name ?? '(persona rimossa)';
  };

  /** Candidati per un numero: convocati prima, poi il resto della rosa attiva — mai chi occupa già un altro numero. */
  const candidatesForNumber = (number: number) => {
    const usedElsewhere = new Set(
      Object.entries(data.numbers)
        .filter(([n]) => n !== String(number))
        .map(([, id]) => id)
    );
    const pool = players.filter((p) => !usedElsewhere.has(p.id));
    const convocati = pool.filter((p) => convocatiPlayerIds.includes(p.id));
    const others = pool.filter((p) => !convocatiPlayerIds.includes(p.id));
    return {
      convocati: convocati.map((p) => ({ kind: 'player' as const, id: p.id, name: p.name })),
      others: others.map((p) => ({ kind: 'player' as const, id: p.id, name: p.name })),
    };
  };

  /** Candidati per un ruolo di staff: convocati (staff + giocatori) prima, poi il resto di staff e rosa. */
  const candidatesForStaffRole = () => {
    const convocatiStaff = staffMembers.filter((s) => convocatiStaffIds.includes(s.id));
    const otherStaff = staffMembers.filter((s) => !convocatiStaffIds.includes(s.id));
    const convocatiPlayers = players.filter((p) => convocatiPlayerIds.includes(p.id));
    const otherPlayers = players.filter((p) => !convocatiPlayerIds.includes(p.id));
    return {
      convocati: [
        ...convocatiStaff.map((s) => ({ kind: 'staff' as const, id: s.id, name: s.name })),
        ...convocatiPlayers.map((p) => ({ kind: 'player' as const, id: p.id, name: p.name })),
      ],
      staff: otherStaff.map((s) => ({ kind: 'staff' as const, id: s.id, name: s.name })),
      players: otherPlayers.map((p) => ({ kind: 'player' as const, id: p.id, name: p.name })),
    };
  };

  // --- PDF ---
  const openExportModal = () => {
    setExportForm({
      competizione: (event as any)?.competition || '',
      luogo: event?.location || '',
      data: event?.date || '',
      ora: event?.time || '',
    });
  };

  const runExport = async () => {
    if (!exportForm) return;
    setExporting(true);
    try {
      const titolariRows = STARTER_NUMBERS
        .map((n) => `<tr><td class="numCell">${n}</td><td>${esc(nameForNumber(n) ?? '—')}</td></tr>`)
        .join('');
      const panchinaRows = BENCH_NUMBERS
        .map((n) => `<tr><td class="numCell">${n}</td><td>${esc(nameForNumber(n) ?? '—')}</td></tr>`)
        .join('');
      const staffRows = LISTA_GARA_STAFF_ROLES
        .map(
          (role) => `
            <tr class="roleRow"><td colspan="2">${esc(STAFF_ROLE_LABELS[role])}</td></tr>
            <tr class="nameRow"><td colspan="2">${esc(nameForStaffRole(role) ?? '—')}</td></tr>
          `
        )
        .join('');

      const styles = `
        <style>
          body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #000; margin: 20px; }
          .topBanner { text-align: center; font-weight: bold; font-size: 14px; margin-bottom: 8px; }
          .headerTable { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
          .headerTable td { vertical-align: middle; border: 1px solid #000; padding: 6px; }
          .logoCell { width: 22%; text-align: center; border: none !important; }
          .logoCell img { max-width: 100px; max-height: 100px; }
          .titleCell { width: 56%; text-align: center; }
          .matchTitle { font-size: 16px; font-weight: bold; color: #1D00FF; margin-bottom: 2px; }
          .compLine { font-size: 13px; margin-bottom: 2px; }
          .dateTimeLine { font-size: 13px; margin-bottom: 2px; }
          .venueLine { font-size: 12px; }
          .columns { display: flex; gap: 10px; }
          .col { flex: 1; }
          .sectionHeader { border: 1px solid #000; text-align: center; font-weight: bold; padding: 5px; margin-top: 8px; }
          .col > .sectionHeader:first-child { margin-top: 0; }
          table.list { width: 100%; border-collapse: collapse; }
          table.list td { border: 1px solid #000; padding: 4px 8px; font-size: 12px; text-align: left; }
          table.list td.numCell { width: 26px; font-weight: bold; text-align: center; }
          .roleRow td { font-weight: bold; border-bottom: none; text-align: left; }
          .nameRow td { border-top: none; text-align: left; }
        </style>
      `;

      const html = `
        <html>
          <head>${styles}</head>
          <body>
            <div class="topBanner">Lista Gara</div>

            <table class="headerTable">
              <tr>
                <td class="logoCell">${orgLogoUrl ? `<img src="${esc(orgLogoUrl)}" />` : ''}</td>
                <td class="titleCell">
                  <div class="matchTitle">${esc(formatMatchTitle(event))}</div>
                  ${exportForm.competizione ? `<div class="compLine">${esc(exportForm.competizione)}</div>` : ''}
                  <div class="dateTimeLine"><strong>${esc(formatLongDateIt(exportForm.data))}</strong>${exportForm.ora ? ` — Ore ${esc(exportForm.ora)}` : ''}</div>
                  ${exportForm.luogo ? `<div class="venueLine">${esc(exportForm.luogo)}</div>` : ''}
                </td>
                <td class="logoCell">${opponentLogoUrl ? `<img src="${esc(opponentLogoUrl)}" />` : ''}</td>
              </tr>
            </table>

            <div class="columns">
              <div class="col">
                <div class="sectionHeader">Titolari (1-11)</div>
                <table class="list">${titolariRows}</table>
                <div class="sectionHeader">Panchina (12-20)</div>
                <table class="list">${panchinaRows}</table>
              </div>
              <div class="col">
                <div class="sectionHeader">Staff</div>
                <table class="list">${staffRows}</table>
              </div>
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

  if (readOnly) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <Text style={{ padding: 20, color: '#64748b' }}>Non disponibile per il tuo ruolo.</Text>
      </SafeAreaView>
    );
  }

  if (loading || playersLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <Text style={{ padding: 20, color: '#64748b' }}>Caricamento…</Text>
      </SafeAreaView>
    );
  }

  const renderNumberRow = (number: number) => {
    const name = nameForNumber(number);
    return (
      <Pressable
        key={number}
        style={styles.row}
        onPress={() => setPickerTarget({ kind: 'number', number })}
        onLongPress={() => name && clearNumber(number)}
      >
        <View style={styles.numberBadge}>
          <Text style={styles.numberBadgeText}>{number}</Text>
        </View>
        <Text style={[styles.rowText, !name && styles.rowTextEmpty]}>
          {name ?? 'Tocca per assegnare'}
        </Text>
      </Pressable>
    );
  };

  const renderStaffRow = (role: ListaGaraStaffRole) => {
    const name = nameForStaffRole(role);
    return (
      <Pressable
        key={role}
        style={styles.row}
        onPress={() => setPickerTarget({ kind: 'staff', role })}
        onLongPress={() => name && clearStaffRole(role)}
      >
        <Text style={styles.staffRoleLabel}>{STAFF_ROLE_LABELS[role]}</Text>
        <Text style={[styles.rowText, !name && styles.rowTextEmpty, { flex: 1, textAlign: 'right' }]}>
          {name ?? 'Tocca per assegnare'}
        </Text>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <View style={styles.titleRow}>
          <Pressable style={styles.backBtn} onPress={() => router.back()} accessibilityLabel="Indietro">
            <Text style={styles.backBtnTxt}>←</Text>
          </Pressable>
          <Text style={styles.title}>Lista Gara</Text>
          <TeamLogo size={28} />
        </View>
        <Text style={styles.matchTitle}>{formatMatchTitle(event)}</Text>
        {event?.date && (
          <Text style={styles.matchSub}>{event.date} {event.time ? `· ${event.time}` : ''}</Text>
        )}

        <Text style={styles.hint}>
          Tocca un numero o un ruolo per assegnarlo — tocca a lungo per svuotarlo.
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Titolari (1-11)</Text>
          {STARTER_NUMBERS.map(renderNumberRow)}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Panchina (12-20)</Text>
          {BENCH_NUMBERS.map(renderNumberRow)}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Staff</Text>
          {LISTA_GARA_STAFF_ROLES.map(renderStaffRow)}
        </View>

        <Pressable style={styles.pdfBtn} onPress={openExportModal}>
          <Text style={styles.pdfBtnText}>📄 Esporta PDF</Text>
        </Pressable>
      </ScrollView>

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
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
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

      <Modal
        visible={!!pickerTarget}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerTarget(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>
              {pickerTarget?.kind === 'number'
                ? `Numero ${pickerTarget.number}`
                : pickerTarget
                ? STAFF_ROLE_LABELS[pickerTarget.role]
                : ''}
            </Text>
            <ScrollView style={{ maxHeight: 420 }}>
              {pickerTarget?.kind === 'number' && (() => {
                const { convocati, others } = candidatesForNumber(pickerTarget.number);
                return (
                  <>
                    {convocati.length > 0 && <Text style={styles.pickerGroupLabel}>Convocati</Text>}
                    {convocati.map((c) => (
                      <Pressable key={c.id} style={styles.pickerRow} onPress={() => assignNumber(pickerTarget.number, c.id)}>
                        <Text style={styles.pickerRowText}>{c.name}</Text>
                      </Pressable>
                    ))}
                    {others.length > 0 && <Text style={styles.pickerGroupLabel}>Altri giocatori in rosa</Text>}
                    {others.map((c) => (
                      <Pressable key={c.id} style={styles.pickerRow} onPress={() => assignNumber(pickerTarget.number, c.id)}>
                        <Text style={styles.pickerRowText}>{c.name}</Text>
                      </Pressable>
                    ))}
                    {convocati.length === 0 && others.length === 0 && (
                      <Text style={{ color: '#6b7280', padding: 12 }}>Nessun giocatore disponibile</Text>
                    )}
                  </>
                );
              })()}

              {pickerTarget?.kind === 'staff' && (() => {
                const { convocati, staff, players: otherPlayers } = candidatesForStaffRole();
                const role = pickerTarget.role;
                return (
                  <>
                    {convocati.length > 0 && <Text style={styles.pickerGroupLabel}>Convocati</Text>}
                    {convocati.map((c) => (
                      <Pressable key={`${c.kind}-${c.id}`} style={styles.pickerRow} onPress={() => assignStaffRole(role, c)}>
                        <Text style={styles.pickerRowText}>{c.name}</Text>
                      </Pressable>
                    ))}
                    {staff.length > 0 && <Text style={styles.pickerGroupLabel}>Staff</Text>}
                    {staff.map((c) => (
                      <Pressable key={`${c.kind}-${c.id}`} style={styles.pickerRow} onPress={() => assignStaffRole(role, c)}>
                        <Text style={styles.pickerRowText}>{c.name}</Text>
                      </Pressable>
                    ))}
                    {otherPlayers.length > 0 && <Text style={styles.pickerGroupLabel}>Giocatori</Text>}
                    {otherPlayers.map((c) => (
                      <Pressable key={`${c.kind}-${c.id}`} style={styles.pickerRow} onPress={() => assignStaffRole(role, c)}>
                        <Text style={styles.pickerRowText}>{c.name}</Text>
                      </Pressable>
                    ))}
                  </>
                );
              })()}
            </ScrollView>
            <Pressable style={styles.modalCancelBtn} onPress={() => setPickerTarget(null)}>
              <Text style={styles.modalCancelBtnText}>Annulla</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backBtn: {
    width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff',
  },
  backBtnTxt: { fontSize: 18, fontWeight: '800', color: '#111' },
  title: { flex: 1, fontSize: 24, fontWeight: '800', color: '#1a202c' },
  matchTitle: { fontSize: 18, fontWeight: '700', color: '#1a202c', marginTop: 8 },
  matchSub: { fontSize: 14, color: '#64748b' },
  hint: { fontSize: 13, color: '#6b7280', marginTop: 12, fontStyle: 'italic' },

  section: { marginTop: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#1a202c', marginBottom: 8 },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb',
    paddingVertical: 10, paddingHorizontal: 12, marginBottom: 6,
  },
  numberBadge: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: '#1b7f3b',
    alignItems: 'center', justifyContent: 'center',
  },
  numberBadgeText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  staffRoleLabel: { fontWeight: '700', color: '#374151' },
  rowText: { fontSize: 15, color: '#111', fontWeight: '600' },
  rowTextEmpty: { color: '#9ca3af', fontWeight: '400', fontStyle: 'italic' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, maxHeight: '80%' },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 10, color: '#1a202c' },
  pickerGroupLabel: { fontSize: 12, fontWeight: '800', color: '#6b7280', marginTop: 10, marginBottom: 4, textTransform: 'uppercase' },
  pickerRow: { paddingVertical: 10, paddingHorizontal: 8, borderBottomWidth: 1, borderColor: '#f1f5f9' },
  pickerRowText: { fontSize: 15, color: '#111' },
  modalCancelBtn: { marginTop: 12, paddingVertical: 12, alignItems: 'center', backgroundColor: '#f3f4f6', borderRadius: 8 },
  modalCancelBtnText: { fontWeight: '800', color: '#111' },

  pdfBtn: {
    marginTop: 24, paddingVertical: 14, borderRadius: 10, alignItems: 'center',
    backgroundColor: '#1b7f3b',
  },
  pdfBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },

  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 10, backgroundColor: '#fff', marginBottom: 10 },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  btnOutline: { backgroundColor: '#f3f4f6' },
  btnOutlineText: { fontWeight: '800', color: '#111' },
  btnPrimary: { backgroundColor: '#1b7f3b' },
  btnPrimaryText: { fontWeight: '800', color: '#fff' },
});
