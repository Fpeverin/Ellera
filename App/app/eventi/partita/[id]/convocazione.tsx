// app/eventi/partita/[id]/convocazione.tsx
//
// Scheda Convocazione della partita — solo staff (Admin/Staff), visibile
// come tab autonomo accanto a Formazione/Tattiche/Live. Sceglie chi tra
// giocatori e staff è convocato, il ritrovo e il menu pranzo, e produce un
// PDF (stesso pattern di app/squadra/statistiche.tsx). I giocatori convocati
// qui alimentano Formazione (vedi app/data/convocazione.ts).
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ConvocatiPlayersModal from '../../../components/partite/ConvocatiPlayersModal';
import { useAuth } from '../../../context/AuthContext';
import {
  ConvocazioneMenuItem,
  loadConvocazione,
  loadPreviousMenuTemplate,
  saveConvocatiPlayerIds,
  saveConvocazione,
} from '../../../data/convocazione';
import { CalendarEvent, loadEvents } from '../../../data/events';
import { loadStaffMembers, StaffCategory, StaffMember, addStaffMember } from '../../../data/staffRoster';
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
  const [menuItems, setMenuItems] = useState<ConvocazioneMenuItem[]>([]);
  const [meals, setMeals] = useState<Record<string, string>>({});

  const [playersModalOpen, setPlayersModalOpen] = useState(false);
  const [newDish, setNewDish] = useState('');
  const [newStaffName, setNewStaffName] = useState<Record<StaffCategory, string>>({
    TECNICO: '',
    SANITARIO: '',
    DIRIGENZIALE: '',
  });
  const [newStaffRole, setNewStaffRole] = useState<Record<StaffCategory, string>>({
    TECNICO: '',
    SANITARIO: '',
    DIRIGENZIALE: '',
  });

  // --- caricamento iniziale ---
  useEffect(() => {
    (async () => {
      if (!matchId) return;
      try {
        const [events, staff, conv] = await Promise.all([
          loadEvents(),
          loadStaffMembers(),
          loadConvocazione(matchId),
        ]);
        setEvent(events.find((e) => e.id === matchId) ?? null);
        setStaffMembers(staff);

        let { menuItems: mi, meals: me } = conv;
        if (mi.length === 0) {
          const template = await loadPreviousMenuTemplate(matchId);
          if (template) {
            mi = template.menuItems;
            me = template.meals;
          }
        }

        setRitrovo(conv.ritrovo);
        setPlayerIds(conv.playerIds);
        setStaffIds(conv.staffIds);
        setMenuItems(mi);
        setMeals(me);
      } catch {
        Alert.alert('Errore', 'Impossibile caricare la convocazione.');
      } finally {
        setLoading(false);
        loadedRef.current = true;
      }
    })();
  }, [matchId]);

  // --- autosalvataggio (tutto tranne playerIds, che ha il suo percorso dedicato) ---
  useEffect(() => {
    if (!loadedRef.current || !matchId) return;
    (async () => {
      try {
        await saveConvocazione(matchId, { ritrovo, playerIds, staffIds, menuItems, meals });
      } catch {}
    })();
  }, [matchId, ritrovo, staffIds, menuItems, meals]);

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

  const handleAddStaff = async (category: StaffCategory) => {
    const name = newStaffName[category].trim();
    if (!name) return;
    try {
      const member = await addStaffMember({ name, category, role: newStaffRole[category].trim() || undefined });
      setStaffMembers((prev) => [...prev, member].sort((a, b) => a.name.localeCompare(b.name)));
      setStaffIds((prev) => [...prev, member.id]);
      setNewStaffName((prev) => ({ ...prev, [category]: '' }));
      setNewStaffRole((prev) => ({ ...prev, [category]: '' }));
    } catch {
      Alert.alert('Errore', 'Impossibile aggiungere la persona.');
    }
  };

  const addDish = () => {
    const name = newDish.trim();
    if (!name) return;
    const item: ConvocazioneMenuItem = { id: `dish-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name };
    setMenuItems((prev) => [...prev, item]);
    setNewDish('');
  };

  const removeDish = (id: string) => {
    setMenuItems((prev) => prev.filter((m) => m.id !== id));
    setMeals((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        if (next[key] === id) delete next[key];
      }
      return next;
    });
  };

  const chooseMeal = (personId: string, menuItemId: string) => {
    setMeals((prev) => ({ ...prev, [personId]: menuItemId }));
  };

  // --- persone convocate (giocatori + staff) ---
  const convocatedPlayers = players.filter((p) => playerIds.includes(p.id));
  const convocatedStaff = staffMembers.filter((s) => staffIds.includes(s.id));
  const convocatedPeople = [
    ...convocatedPlayers.map((p) => ({ id: p.id, name: p.name })),
    ...convocatedStaff.map((s) => ({ id: s.id, name: s.name })),
  ];

  const staffCountByCategory = (cat: StaffCategory) =>
    staffMembers.filter((s) => s.category === cat && staffIds.includes(s.id)).length;
  const totale = playerIds.length + staffIds.length;

  const mealCounts = menuItems.map((item) => ({
    item,
    count: convocatedPeople.filter((p) => meals[p.id] === item.id).length,
  }));
  const totalMeals = convocatedPeople.filter((p) => meals[p.id]).length;

  // --- PDF ---
  const exportPdf = async () => {
    const giocatoriRows = players
      .map((p) => `<tr><td>${esc(p.name)}</td><td>${playerIds.includes(p.id) ? '✔' : ''}</td></tr>`)
      .join('');

    const staffSectionHtml = CATEGORIES.map((cat) => {
      const rows = staffMembers
        .filter((s) => s.category === cat)
        .map(
          (s) =>
            `<tr><td>${esc(s.name)}${s.role ? ` — ${esc(s.role)}` : ''}</td><td>${staffIds.includes(s.id) ? '✔' : ''}</td></tr>`
        )
        .join('');
      if (!rows) return '';
      return `<h3>${esc(CATEGORY_LABELS[cat])}</h3><table>${rows}</table>`;
    }).join('');

    const mealRows = mealCounts.map((m) => `<tr><td>${esc(m.item.name)}</td><td>${m.count}</td></tr>`).join('');

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
          <h1>Scheda Convocazione</h1>
          <p><strong>${esc(formatMatchTitle(event))}</strong></p>
          <p>${esc((event as any)?.competition || '')}</p>
          <p>${esc(event?.date || '')} — ${esc(event?.time || '')}</p>
          <p>${esc(event?.location || '')}</p>
          <p>Ritrovo: ${esc(ritrovo || '—')}</p>

          <h2>Giocatori convocati</h2>
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

          <h2>Riepilogo pranzo</h2>
          <table>
            <tr><td><strong>Totale pasti</strong></td><td><strong>${totalMeals}</strong></td></tr>
            ${mealRows}
          </table>
        </body>
      </html>
    `;

    if (typeof window !== 'undefined' && (window as any)?.print) {
      const w = window.open('', '', 'width=1200,height=800');
      if (!w) return;
      w.document.write(html);
      w.document.close();
      w.print();
      w.close();
    } else {
      const { uri } = await Print.printToFileAsync({ html });
      try {
        await Sharing.shareAsync(uri);
      } catch {
        Alert.alert('PDF creato', `File salvato in:\n${uri}`);
      }
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
          <Text style={styles.previewText}>
            {convocatedPlayers.length > 0 ? convocatedPlayers.map((p) => p.name).join(', ') : 'Nessun giocatore convocato'}
          </Text>
        </View>

        {CATEGORIES.map((cat) => {
          const inCategory = staffMembers.filter((s) => s.category === cat);
          return (
            <View style={styles.section} key={cat}>
              <Text style={styles.sectionTitle}>
                {CATEGORY_LABELS[cat]} ({staffCountByCategory(cat)})
              </Text>
              {inCategory.map((s) => {
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
              })}
              <View style={styles.addRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Nome"
                  value={newStaffName[cat]}
                  onChangeText={(v) => setNewStaffName((prev) => ({ ...prev, [cat]: v }))}
                />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Ruolo (es. Allenatore)"
                  value={newStaffRole[cat]}
                  onChangeText={(v) => setNewStaffRole((prev) => ({ ...prev, [cat]: v }))}
                />
                <Pressable style={styles.smallBtn} onPress={() => handleAddStaff(cat)}>
                  <Text style={styles.smallBtnText}>+ Aggiungi</Text>
                </Pressable>
              </View>
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

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Menu pranzo</Text>
          {menuItems.map((item) => (
            <View key={item.id} style={styles.dishRow}>
              <Text style={{ flex: 1 }}>{item.name}</Text>
              <Pressable onPress={() => removeDish(item.id)}>
                <Text style={{ fontSize: 18 }}>🗑️</Text>
              </Pressable>
            </View>
          ))}
          <View style={styles.addRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Nuovo piatto"
              value={newDish}
              onChangeText={setNewDish}
            />
            <Pressable style={styles.smallBtn} onPress={addDish}>
              <Text style={styles.smallBtnText}>+ Aggiungi</Text>
            </Pressable>
          </View>

          {menuItems.length > 0 && convocatedPeople.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Scelte</Text>
              {convocatedPeople.map((p) => (
                <View key={p.id} style={styles.mealRow}>
                  <Text style={styles.mealName}>{p.name}</Text>
                  <View style={styles.chipsRow}>
                    {menuItems.map((item) => {
                      const active = meals[p.id] === item.id;
                      return (
                        <Pressable
                          key={item.id}
                          style={[styles.chip, active && styles.chipActive]}
                          onPress={() => chooseMeal(p.id, item.id)}
                        >
                          <Text style={[styles.chipText, active && styles.chipTextActive]}>{item.name}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))}

              <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Riepilogo pranzo</Text>
              <Text style={styles.summaryLine}>Totale pasti: {totalMeals}</Text>
              {mealCounts.map((m) => (
                <Text key={m.item.id} style={styles.summaryLine}>
                  {m.item.name}: {m.count}
                </Text>
              ))}
            </>
          )}
        </View>

        <Pressable style={styles.pdfBtn} onPress={exportPdf}>
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

  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#f9fafb',
    fontSize: 14,
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

  addRow: { flexDirection: 'row', gap: 8, marginTop: 8, alignItems: 'center' },

  summaryLine: { fontSize: 14, color: '#334155', marginBottom: 2 },

  dishRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },

  mealRow: { marginBottom: 12 },
  mealName: { fontWeight: '700', marginBottom: 6 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#f9fafb',
  },
  chipActive: { backgroundColor: '#1b7f3b', borderColor: '#1b7f3b' },
  chipText: { fontSize: 12, color: '#334155', fontWeight: '600' },
  chipTextActive: { color: 'white' },

  pdfBtn: {
    backgroundColor: '#1b4f7f',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  pdfBtnText: { color: 'white', fontWeight: '800', fontSize: 16 },
});
