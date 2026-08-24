// app/eventi/partita/[id]/altrePartite.tsx
//
// "Altre Partite": incontri delle altre squadre della stessa giornata/competizione di questa
// partita — testo libero (squadre, risultato, marcatori), nessun collegamento alla rosa. Chiave
// (org_id, competition, giornata) — vedi app/data/matchdayFixtures.ts: un incontro inserito da una
// qualsiasi delle nostre partite di quella giornata compare automaticamente anche dalle altre.
// Sola lettura per il Giocatore (stesso principio di tutte le altre schermate di partita).
//
// Competizione/Giornata si impostano DIRETTAMENTE qui (2026-08-24) e sono del tutto OPZIONALI
// (2026-08-24, secondo giro — Francesco: "deve essere possibile crearlo in ogni momento, anche
// senza competizione impostata"): la sezione si usa sempre, senza alcun prerequisito. Se compilate,
// aggiornano anche la partita stessa (stessa colonna letta da MatchEventCard/EditMatchModal) e gli
// incontri si condividono con le altre nostre partite della stessa giornata/competizione; se
// lasciate vuote, `fixtureKey()` usa l'id di questa partita come chiave privata (mai condivisa per
// errore con un'altra partita altrettanto priva di competizione/giornata).
//
// La NOSTRA partita compare da sola nell'elenco (2026-08-24, terzo giro): `syncOwnFixture`
// sincronizza automaticamente una riga con risultato/marcatori presi da Live (non modificabile a
// mano, ma resta possibile allegare foto/PDF anche lì). Gli allegati immagine si aprono con
// un'anteprima a schermo intero dentro l'app (prima solo un chip col nome, apribile solo nel
// browser esterno).
import * as DocumentPicker from 'expo-document-picker';
import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import TeamLogo from '../../../components/TeamLogo';
import { useAuth } from '../../../context/AuthContext';
import { CompetitionTeam, loadCompetitionTeams } from '../../../data/competitionTeams';
import { CalendarEvent, loadEvents, patchEventData } from '../../../data/events';
import {
  addFixture,
  addFixtureAttachment,
  FixtureAttachment,
  FixtureInput,
  loadFixtureAttachments,
  loadFixtures,
  MatchdayFixture,
  removeFixture,
  removeFixtureAttachment,
  syncOwnMatchFixture,
  updateFixture,
} from '../../../data/matchdayFixtures';
import { GoalItem, loadGoals, loadStarted } from '../../../data/matchLive';

const CLUB_NAME = 'Ellera';
const IMAGE_EXT_RE = /\.(jpe?g|png|gif|webp|heic|bmp)$/i;

type FormState = {
  id?: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: string;
  awayScore: string;
  scorers: string;
};

const EMPTY_FORM: FormState = { homeTeam: '', awayTeam: '', homeScore: '', awayScore: '', scorers: '' };

function formatMatchTitle(ev: CalendarEvent | null): string {
  if (!ev) return '';
  const opp = ev.opponent || 'Avversario';
  const ha = (ev as any).homeAway as 'CASA' | 'TRASFERTA' | undefined;
  return ha === 'TRASFERTA' ? `${opp} - Ellera` : `Ellera - ${opp}`;
}

export default function AltrePartite() {
  const { id: matchId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { membership } = useAuth();
  const readOnly = membership?.role === 'giocatore';

  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState<CalendarEvent | null>(null);
  const [competitionInput, setCompetitionInput] = useState('');
  const [giornataInput, setGiornataInput] = useState('');
  const [savingMeta, setSavingMeta] = useState(false);
  const [fixtures, setFixtures] = useState<MatchdayFixture[]>([]);
  const [attachmentsByFixture, setAttachmentsByFixture] = useState<Record<string, FixtureAttachment[]>>({});
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);

  const competition = competitionInput.trim();
  const giornata = giornataInput.trim();

  // Altre Partite si può usare sempre, anche senza Competizione/Giornata impostate — quando
  // mancano entrambe, l'elenco resta privato di questa partita (chiave sulla sua id) invece di
  // condividersi per errore con qualunque altra partita altrettanto priva di competizione/
  // giornata. Non appena si compila almeno uno dei due campi, torna la condivisione con le altre
  // nostre partite della stessa giornata/competizione (comportamento originale, invariato).
  const fixtureKey = (comp: string, g: string): [string, string] =>
    comp || g ? [comp, g] : ['', `_solo_${matchId}`];

  const loadFixturesFor = async (comp: string, g: string) => {
    const [effComp, effG] = fixtureKey(comp, g);
    const list = await loadFixtures(effComp, effG);
    setFixtures(list);
    const pairs = await Promise.all(list.map((f) => loadFixtureAttachments(f.id).then((a) => [f.id, a] as const)));
    setAttachmentsByFixture(Object.fromEntries(pairs));
  };

  // La nostra partita compare da sola in Altre Partite, con risultato/marcatori presi da Live —
  // richiesta di Francesco: "la partita della mia squadra deve comunque andare ad aggiornare
  // automaticamente la sezione Altre Partite". Upsert su un id deterministico (own-{matchId}),
  // quindi resta comunque possibile allegare foto/PDF su questa riga come su ogni altra. Solo
  // Staff/Admin possono scrivere (RLS), un Giocatore vede l'ultimo stato sincronizzato.
  const syncOwnFixture = async (ev: CalendarEvent, comp: string, g: string) => {
    if (!matchId || readOnly) return;
    const homeAway = ((ev as any).homeAway === 'TRASFERTA' ? 'TRASFERTA' : 'CASA') as 'CASA' | 'TRASFERTA';
    const opponent = ev.opponent || 'Avversario';
    const homeTeam = homeAway === 'CASA' ? CLUB_NAME : opponent;
    const awayTeam = homeAway === 'CASA' ? opponent : CLUB_NAME;
    const ourSide = homeAway === 'CASA' ? 'HOME' : 'AWAY';

    let homeScore: number | null = null;
    let awayScore: number | null = null;
    let scorers = '';
    try {
      const [started, goals] = await Promise.all([loadStarted(matchId), loadGoals(matchId)]);
      if (started) {
        homeScore = goals.filter((gl) => gl.team === 'HOME').length;
        awayScore = goals.filter((gl) => gl.team === 'AWAY').length;
        scorers = goals
          .slice()
          .sort((a: GoalItem, b: GoalItem) => a.minute - b.minute)
          .map((gl) => `${gl.scorer} ${gl.minute}'${gl.team === ourSide ? '' : ` (${opponent})`}`)
          .join(', ');
      }
    } catch {
      // nessun dato Live ancora disponibile — resta 0 gol/nessun marcatore, non blocca il resto
    }

    try {
      const [effComp, effG] = fixtureKey(comp, g);
      await syncOwnMatchFixture(effComp, effG, matchId, { homeTeam, awayTeam, homeScore, awayScore, scorers });
    } catch {
      // sync silenziosa: se fallisce, Altre Partite resta comunque utilizzabile per gli incontri manuali
    }
  };

  useEffect(() => {
    (async () => {
      if (!matchId) return;
      const events = await loadEvents();
      const ev = events.find((e) => `${e.id}` === `${matchId}`) ?? null;
      setEvent(ev);
      const comp = ((ev as any)?.competition || '').trim();
      const g = ((ev as any)?.giornata || '').trim();
      setCompetitionInput(comp);
      setGiornataInput(g);
      if (ev) await syncOwnFixture(ev, comp, g);
      await loadFixturesFor(comp, g);
      setLoading(false);
    })();
  }, [matchId]);

  const reloadFixtures = () => loadFixturesFor(competition, giornata);

  // Squadre fisse configurate per questa competizione (app/data/competitionTeams.ts) — scelta
  // rapida per le due squadre di un incontro, invece di ridigitare ogni volta lo stesso nome.
  const [teams, setTeams] = useState<CompetitionTeam[]>([]);
  useEffect(() => {
    if (!competition) { setTeams([]); return; }
    loadCompetitionTeams(competition).then(setTeams).catch(() => setTeams([]));
  }, [competition]);

  // Salva Competizione/Giornata direttamente sulla partita (stessa colonna di Calendario/
  // EditMatchModal) appena si esce dal campo — nessun bisogno di andare altrove per impostarle
  // prima di poter usare questa sezione.
  const saveMeta = async (nextCompetition: string, nextGiornata: string) => {
    if (!matchId) return;
    const comp = nextCompetition.trim();
    const g = nextGiornata.trim();
    const prevComp = ((event as any)?.competition || '').trim();
    const prevG = ((event as any)?.giornata || '').trim();
    if (comp === prevComp && g === prevG) return; // niente da salvare
    setSavingMeta(true);
    try {
      await patchEventData(matchId, { competition: comp || undefined, giornata: g || undefined });
      setEvent((prev) => (prev ? { ...prev, competition: comp || undefined, giornata: g || undefined } : prev));
      await loadFixturesFor(comp, g);
    } catch {
      Alert.alert('Errore', 'Impossibile salvare Competizione/Giornata.');
    } finally {
      setSavingMeta(false);
    }
  };

  const openAddModal = () => setForm({ ...EMPTY_FORM });
  const openEditModal = (f: MatchdayFixture) =>
    setForm({
      id: f.id,
      homeTeam: f.homeTeam,
      awayTeam: f.awayTeam,
      homeScore: f.homeScore != null ? String(f.homeScore) : '',
      awayScore: f.awayScore != null ? String(f.awayScore) : '',
      scorers: f.scorers,
    });

  const saveForm = async () => {
    if (!form || !form.homeTeam.trim() || !form.awayTeam.trim()) {
      Alert.alert('Dati mancanti', 'Inserisci almeno le due squadre.');
      return;
    }
    setSaving(true);
    try {
      const input: FixtureInput = {
        homeTeam: form.homeTeam.trim(),
        awayTeam: form.awayTeam.trim(),
        homeScore: form.homeScore.trim() === '' ? null : Number(form.homeScore),
        awayScore: form.awayScore.trim() === '' ? null : Number(form.awayScore),
        scorers: form.scorers.trim(),
      };
      if (form.id) {
        await updateFixture(form.id, input);
      } else {
        const [effComp, effG] = fixtureKey(competition, giornata);
        await addFixture(effComp, effG, input);
      }
      setForm(null);
      await reloadFixtures();
    } catch {
      Alert.alert('Errore', "Impossibile salvare l'incontro.");
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteFixture = (f: MatchdayFixture) => {
    Alert.alert('Elimina incontro', `Eliminare "${f.homeTeam} - ${f.awayTeam}"?`, [
      { text: 'Annulla', style: 'cancel' },
      {
        text: 'Elimina',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeFixture(f.id);
            await reloadFixtures();
          } catch {
            Alert.alert('Errore', "Impossibile eliminare l'incontro.");
          }
        },
      },
    ]);
  };

  const addAttachment = async (fixtureId: string) => {
    const res = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
      type: ['image/*', 'application/pdf'],
    });
    if (res.canceled || !res.assets?.length) return;
    const file = res.assets[0];
    setUploadingFor(fixtureId);
    try {
      const newAtt = await addFixtureAttachment(fixtureId, file.uri, file.name ?? 'Formazione');
      setAttachmentsByFixture((prev) => ({ ...prev, [fixtureId]: [...(prev[fixtureId] ?? []), newAtt] }));
    } catch {
      Alert.alert('Errore', "Impossibile caricare l'allegato.");
    } finally {
      setUploadingFor(null);
    }
  };

  const removeAttachment = async (fixtureId: string, attachment: FixtureAttachment) => {
    setAttachmentsByFixture((prev) => ({
      ...prev,
      [fixtureId]: (prev[fixtureId] ?? []).filter((a) => a.id !== attachment.id),
    }));
    try {
      await removeFixtureAttachment(attachment);
    } catch {
      Alert.alert('Errore', "Impossibile rimuovere l'allegato.");
    }
  };

  // Anteprima a schermo intero per un allegato immagine — un file (foto/PDF) allegato deve essere
  // "consultabile in qualche modo": prima si vedeva solo un chip col nome, senza modo di vederlo
  // se non aprendolo nel browser esterno. Le immagini si aprono ora dentro l'app; i PDF restano
  // aperti esternamente (nessun visualizzatore PDF integrato).
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const openAttachment = async (a: FixtureAttachment) => {
    if (IMAGE_EXT_RE.test(a.name)) {
      setPreviewImage(a.uri);
      return;
    }
    if (/^https?:\/\//i.test(a.uri)) await WebBrowser.openBrowserAsync(a.uri);
    else await Linking.openURL(a.uri);
  };

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
        <View style={styles.titleRow}>
          <Pressable style={styles.backBtn} onPress={() => router.back()} accessibilityLabel="Indietro">
            <Text style={styles.backBtnTxt}>←</Text>
          </Pressable>
          <Text style={styles.title}>Altre Partite</Text>
          <TeamLogo size={28} />
        </View>
        <Text style={styles.matchTitle}>{formatMatchTitle(event)}</Text>

        <View style={styles.metaCard}>
          <View style={styles.metaRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Competizione</Text>
              <TextInput
                style={styles.input}
                value={competitionInput}
                onChangeText={setCompetitionInput}
                onBlur={() => saveMeta(competitionInput, giornataInput)}
                placeholder="Es. Campionato"
                editable={!readOnly}
              />
            </View>
            <View style={{ width: 110 }}>
              <Text style={styles.label}>Giornata</Text>
              <TextInput
                style={styles.input}
                value={giornataInput}
                onChangeText={setGiornataInput}
                onBlur={() => saveMeta(competitionInput, giornataInput)}
                placeholder="Es. 25"
                editable={!readOnly}
              />
            </View>
          </View>
          {savingMeta && <Text style={styles.metaSaving}>Salvataggio…</Text>}
          {!(competition || giornata) && (
            <Text style={styles.metaHint}>
              Opzionali: se le compili, questi incontri compaiono automaticamente anche dalle
              altre nostre partite della stessa giornata/competizione. Senza, restano visibili solo
              da qui.
            </Text>
          )}
        </View>

        <>
            {fixtures.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>🗒️</Text>
                <Text style={styles.emptyTitle}>Nessun incontro inserito</Text>
                <Text style={styles.emptyText}>
                  Aggiungi le partite delle altre squadre di questa giornata.
                </Text>
              </View>
            )}

            {fixtures.map((f) => {
              const hasScore = f.homeScore != null && f.awayScore != null;
              const attachments = attachmentsByFixture[f.id] ?? [];
              const homeLogo = teams.find((t) => t.name === f.homeTeam)?.logoUrl;
              const awayLogo = teams.find((t) => t.name === f.awayTeam)?.logoUrl;
              const isOwn = !!f.matchId && f.matchId === matchId;
              return (
                <View key={f.id} style={styles.fixtureCard}>
                  <View style={styles.fixtureHeaderRow}>
                    <Text style={styles.fixtureTeams} numberOfLines={2}>
                      {homeLogo && <Image source={{ uri: homeLogo }} style={styles.fixtureTeamLogo} />}
                      {' '}{f.homeTeam} <Text style={styles.fixtureVs}>vs</Text> {f.awayTeam}
                      {awayLogo && <Image source={{ uri: awayLogo }} style={styles.fixtureTeamLogo} />}
                    </Text>
                    <View style={styles.scoreBadge}>
                      <Text style={styles.scoreBadgeText}>
                        {hasScore ? `${f.homeScore} - ${f.awayScore}` : '— : —'}
                      </Text>
                    </View>
                  </View>
                  {isOwn && <Text style={styles.ownBadge}>🔴 Aggiornata automaticamente da Live</Text>}
                  {!!f.scorers && <Text style={styles.scorersText}>⚽ {f.scorers}</Text>}

                  {attachments.length > 0 && (
                    <View style={styles.attachmentsRow}>
                      {attachments.map((a) =>
                        IMAGE_EXT_RE.test(a.name) ? (
                          <View key={a.id} style={styles.attachmentImageWrap}>
                            <Pressable onPress={() => openAttachment(a)}>
                              <Image source={{ uri: a.uri }} style={styles.attachmentImage} />
                            </Pressable>
                            {!readOnly && (
                              <Pressable style={styles.attachmentImageRemove} onPress={() => removeAttachment(f.id, a)} accessibilityLabel="Rimuovi allegato">
                                <Text style={styles.attachmentChipRemoveText}>✕</Text>
                              </Pressable>
                            )}
                          </View>
                        ) : (
                          <View key={a.id} style={styles.attachmentChip}>
                            <Pressable style={{ flexDirection: 'row', alignItems: 'center' }} onPress={() => openAttachment(a)}>
                              <Text style={styles.attachmentChipIcon}>📄</Text>
                              <Text style={styles.attachmentChipText} numberOfLines={1}>{a.name}</Text>
                            </Pressable>
                            {!readOnly && (
                              <Pressable onPress={() => removeAttachment(f.id, a)} accessibilityLabel="Rimuovi allegato">
                                <Text style={styles.attachmentChipRemove}>✕</Text>
                              </Pressable>
                            )}
                          </View>
                        )
                      )}
                    </View>
                  )}

                  {!readOnly && (
                    <View style={styles.fixtureActionsRow}>
                      {!isOwn && (
                        <Pressable style={styles.smallBtn} onPress={() => openEditModal(f)}>
                          <Text style={styles.smallBtnText}>✏️ Modifica</Text>
                        </Pressable>
                      )}
                      <Pressable
                        style={styles.smallBtn}
                        onPress={() => addAttachment(f.id)}
                        disabled={uploadingFor === f.id}
                      >
                        <Text style={styles.smallBtnText}>
                          {uploadingFor === f.id ? 'Caricamento…' : '📎 Allega foto/PDF'}
                        </Text>
                      </Pressable>
                      {!isOwn && (
                        <Pressable style={[styles.smallBtn, styles.smallBtnDanger]} onPress={() => confirmDeleteFixture(f)}>
                          <Text style={styles.smallBtnDangerText}>🗑️ Elimina</Text>
                        </Pressable>
                      )}
                    </View>
                  )}
                </View>
              );
            })}

            {!readOnly && (
              <Pressable style={styles.addBtn} onPress={openAddModal}>
                <Text style={styles.addBtnText}>＋ Aggiungi incontro</Text>
              </Pressable>
            )}
        </>
      </ScrollView>

      <Modal visible={!!form} transparent animationType="slide" onRequestClose={() => setForm(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{form?.id ? 'Modifica incontro' : 'Nuovo incontro'}</Text>
            <ScrollView>
              <Text style={styles.label}>Squadra Casa</Text>
              <TextInput
                style={styles.input}
                value={form?.homeTeam ?? ''}
                onChangeText={(v) => setForm((f) => (f ? { ...f, homeTeam: v } : f))}
                placeholder="Nome squadra"
              />
              {teams.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.teamChipsRow}>
                  {teams.map((t) => (
                    <Pressable
                      key={t.id}
                      style={[styles.teamChip, form?.homeTeam === t.name && styles.teamChipActive]}
                      onPress={() => setForm((f) => (f ? { ...f, homeTeam: t.name } : f))}
                    >
                      {t.logoUrl && <Image source={{ uri: t.logoUrl }} style={styles.teamChipLogo} />}
                      <Text style={[styles.teamChipText, form?.homeTeam === t.name && styles.teamChipTextActive]}>{t.name}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              )}
              <Text style={styles.label}>Squadra Trasferta</Text>
              <TextInput
                style={styles.input}
                value={form?.awayTeam ?? ''}
                onChangeText={(v) => setForm((f) => (f ? { ...f, awayTeam: v } : f))}
                placeholder="Nome squadra"
              />
              {teams.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.teamChipsRow}>
                  {teams.map((t) => (
                    <Pressable
                      key={t.id}
                      style={[styles.teamChip, form?.awayTeam === t.name && styles.teamChipActive]}
                      onPress={() => setForm((f) => (f ? { ...f, awayTeam: t.name } : f))}
                    >
                      {t.logoUrl && <Image source={{ uri: t.logoUrl }} style={styles.teamChipLogo} />}
                      <Text style={[styles.teamChipText, form?.awayTeam === t.name && styles.teamChipTextActive]}>{t.name}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              )}
              <Text style={styles.label}>Risultato</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TextInput
                  style={[styles.input, { flex: 1, textAlign: 'center' }]}
                  value={form?.homeScore ?? ''}
                  onChangeText={(v) => setForm((f) => (f ? { ...f, homeScore: v.replace(/[^0-9]/g, '') } : f))}
                  placeholder="—"
                  keyboardType="numeric"
                />
                <Text style={{ fontWeight: '800', color: '#6b7280' }}>-</Text>
                <TextInput
                  style={[styles.input, { flex: 1, textAlign: 'center' }]}
                  value={form?.awayScore ?? ''}
                  onChangeText={(v) => setForm((f) => (f ? { ...f, awayScore: v.replace(/[^0-9]/g, '') } : f))}
                  placeholder="—"
                  keyboardType="numeric"
                />
              </View>
              <Text style={styles.label}>Marcatori (opzionale)</Text>
              <TextInput
                style={[styles.input, { height: 70, textAlignVertical: 'top' }]}
                value={form?.scorers ?? ''}
                onChangeText={(v) => setForm((f) => (f ? { ...f, scorers: v } : f))}
                placeholder="Es. Rossi 12', Bianchi 55'"
                multiline
              />
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <Pressable style={[styles.btn, styles.btnOutline]} onPress={() => setForm(null)}>
                  <Text style={styles.btnOutlineText}>Annulla</Text>
                </Pressable>
                <Pressable style={[styles.btn, styles.btnPrimary]} onPress={saveForm} disabled={saving}>
                  <Text style={styles.btnPrimaryText}>{saving ? 'Salvataggio…' : 'Salva'}</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={!!previewImage} transparent animationType="fade" onRequestClose={() => setPreviewImage(null)}>
        <Pressable style={styles.previewOverlay} onPress={() => setPreviewImage(null)}>
          {previewImage && <Image source={{ uri: previewImage }} style={styles.previewImage} />}
          <Pressable style={styles.previewCloseBtn} onPress={() => setPreviewImage(null)}>
            <Text style={styles.previewCloseBtnText}>✕ Chiudi</Text>
          </Pressable>
        </Pressable>
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
  matchTitle: { fontSize: 18, fontWeight: '700', color: '#1a202c', marginTop: 8, marginBottom: 12 },

  metaCard: {
    backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#e5e7eb',
    padding: 14, marginBottom: 4,
  },
  metaRow: { flexDirection: 'row', gap: 10 },
  metaSaving: { marginTop: 8, fontSize: 12, color: '#6b7280', fontStyle: 'italic' },
  metaHint: { marginTop: 10, fontSize: 13, color: '#92400e', lineHeight: 18 },

  emptyState: { alignItems: 'center', paddingVertical: 32 },
  emptyIcon: { fontSize: 32, marginBottom: 8 },
  emptyTitle: { fontWeight: '800', color: '#1a202c', marginBottom: 4 },
  emptyText: { color: '#6b7280', fontSize: 13, textAlign: 'center' },

  fixtureCard: {
    marginTop: 12, backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#e5e7eb',
    padding: 12,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  fixtureHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  fixtureTeams: { flex: 1, fontSize: 15, fontWeight: '700', color: '#1a202c' },
  fixtureTeamLogo: { width: 16, height: 16 },
  fixtureVs: { color: '#9ca3af', fontWeight: '400' },
  scoreBadge: { backgroundColor: '#f1f5f9', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  scoreBadgeText: { fontWeight: '800', color: '#1a202c' },
  ownBadge: { marginTop: 6, fontSize: 12, fontWeight: '700', color: '#b91c1c' },
  scorersText: { marginTop: 6, fontSize: 13, color: '#4b5563' },

  attachmentsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  attachmentChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#f1f5f9', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6,
    maxWidth: 220,
  },
  attachmentChipIcon: { fontSize: 12 },
  attachmentChipText: { fontSize: 12, color: '#334155', maxWidth: 140 },
  attachmentChipRemove: { fontSize: 12, color: '#dc2626', fontWeight: '800', marginLeft: 6 },
  attachmentImageWrap: { width: 72, height: 72, borderRadius: 8, overflow: 'hidden' },
  attachmentImage: { width: 72, height: 72, backgroundColor: '#f1f5f9' },
  attachmentImageRemove: {
    position: 'absolute', top: 2, right: 2, width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center',
  },
  attachmentChipRemoveText: { color: '#fff', fontSize: 11, fontWeight: '800' },

  previewOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', alignItems: 'center', justifyContent: 'center' },
  previewImage: { width: '92%', height: '80%', resizeMode: 'contain' },
  previewCloseBtn: { position: 'absolute', top: 50, right: 20, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)' },
  previewCloseBtnText: { color: '#fff', fontWeight: '700' },

  fixtureActionsRow: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  smallBtn: {
    backgroundColor: '#f3f4f6', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8,
  },
  smallBtnText: { fontSize: 12, fontWeight: '700', color: '#111' },
  smallBtnDanger: { backgroundColor: '#fef2f2' },
  smallBtnDangerText: { fontSize: 12, fontWeight: '700', color: '#dc2626' },

  addBtn: {
    marginTop: 16, paddingVertical: 14, borderRadius: 10, alignItems: 'center',
    backgroundColor: '#1b7f3b',
  },
  addBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalBox: {
    backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, maxHeight: '85%',
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: -2 },
  },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#e5e7eb', alignSelf: 'center', marginBottom: 10 },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 10, color: '#1a202c' },
  label: { fontSize: 13, fontWeight: '700', color: '#374151', marginTop: 8, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 10, backgroundColor: '#fff' },
  teamChipsRow: { marginTop: 6 },
  teamChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderColor: '#d1d5db', borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 5, marginRight: 6, backgroundColor: '#fff',
  },
  teamChipActive: { backgroundColor: '#1b7f3b', borderColor: '#1b7f3b' },
  teamChipLogo: { width: 16, height: 16, resizeMode: 'contain' },
  teamChipText: { fontSize: 12, fontWeight: '600', color: '#374151' },
  teamChipTextActive: { color: '#fff' },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  btnOutline: { backgroundColor: '#f3f4f6' },
  btnOutlineText: { fontWeight: '800', color: '#111' },
  btnPrimary: { backgroundColor: '#1b7f3b' },
  btnPrimaryText: { fontWeight: '800', color: '#fff' },
});
