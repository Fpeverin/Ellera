// app/squadra/sondaggi/editor.tsx
//
// Crea/modifica un sondaggio (stesso pattern "una route, id opzionale" di
// app/squadra/tattiche/editor.tsx). In modifica, sezione aggiuntiva
// "Risposte": un blocco per ogni invio effettivo (survey_sends), con le
// risposte dei giocatori che hanno risposto a quell'occorrenza.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import NotifyRecipientsPicker from '../../components/NotifyRecipientsPicker';
import { loadNotifyConfig, NotifyConfig } from '../../data/organization';
import { loadStaffMembers, StaffMember } from '../../data/staffRoster';
import {
  createSurvey,
  deleteSurvey,
  loadResponsesForSend,
  loadSendsForSurvey,
  loadSurvey,
  resendSurveyNow,
  setSurveyActive,
  updateSurvey,
  type ScheduleMode,
  type Survey,
  type SurveyQuestion,
  type SurveyQuestionType,
  type SurveyResponseWithPlayer,
  type SurveySend,
} from '../../data/surveys';

function uid() {
  return `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

const QUESTION_TYPES: { value: SurveyQuestionType; label: string }[] = [
  { value: 'text', label: 'Testo libero' },
  { value: 'scale', label: 'Scala 1-5' },
  { value: 'choice', label: 'Scelta singola' },
];

const SCHEDULE_MODES: { value: ScheduleMode; label: string }[] = [
  { value: 'immediate', label: 'Subito' },
  { value: 'once', label: 'Programmato' },
  { value: 'recurring', label: 'Ricorrente' },
];

export default function SondaggioEditor() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const isEditing = !!id;

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);

  const [title, setTitle] = useState('');
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>('immediate');
  const [scheduledDate, setScheduledDate] = useState(''); // AAAA-MM-GG
  const [scheduledTime, setScheduledTime] = useState('09:00');
  const [recurrenceDays, setRecurrenceDays] = useState('7');
  const [notify, setNotify] = useState<NotifyConfig>({ mode: 'admin_only', staffIds: [] });
  const [active, setActive] = useState(true);

  const [sends, setSends] = useState<SurveySend[]>([]);
  const [responsesBySend, setResponsesBySend] = useState<Record<string, SurveyResponseWithPlayer[]>>({});
  const [expandedSendId, setExpandedSendId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const staff = await loadStaffMembers();
        setStaffMembers(staff);

        if (id) {
          const survey = await loadSurvey(id);
          if (!survey) {
            Alert.alert('Errore', 'Sondaggio non trovato.');
            router.back();
            return;
          }
          setTitle(survey.title);
          setQuestions(survey.questions);
          setScheduleMode(survey.scheduleMode);
          setActive(survey.active);
          setNotify(survey.notify);
          if (survey.nextRunAt) {
            const d = new Date(survey.nextRunAt);
            setScheduledDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
            setScheduledTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
          }
          if (survey.recurrenceDays) setRecurrenceDays(String(survey.recurrenceDays));

          setSends(await loadSendsForSurvey(id));
        } else {
          setNotify(await loadNotifyConfig('live_proposals'));
        }
      } catch {
        Alert.alert('Errore', 'Impossibile caricare i dati.');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const addQuestion = (type: SurveyQuestionType) => {
    setQuestions((qs) => [...qs, { id: uid(), text: '', type, options: type === 'choice' ? [''] : undefined }]);
  };

  const updateQuestion = (qid: string, patch: Partial<SurveyQuestion>) => {
    setQuestions((qs) => qs.map((q) => (q.id === qid ? { ...q, ...patch } : q)));
  };

  const removeQuestion = (qid: string) => {
    setQuestions((qs) => qs.filter((q) => q.id !== qid));
  };

  const addOption = (qid: string) => {
    setQuestions((qs) => qs.map((q) => (q.id === qid ? { ...q, options: [...(q.options ?? []), ''] } : q)));
  };

  const updateOption = (qid: string, idx: number, value: string) => {
    setQuestions((qs) =>
      qs.map((q) => (q.id === qid ? { ...q, options: (q.options ?? []).map((o, i) => (i === idx ? value : o)) } : q))
    );
  };

  const removeOption = (qid: string, idx: number) => {
    setQuestions((qs) => qs.map((q) => (q.id === qid ? { ...q, options: (q.options ?? []).filter((_, i) => i !== idx) } : q)));
  };

  const buildScheduledAt = (): string | null => {
    if (scheduleMode === 'immediate') return null;
    if (!scheduledDate) return null;
    return new Date(`${scheduledDate}T${scheduledTime || '09:00'}:00`).toISOString();
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Titolo obbligatorio', 'Dai un titolo al sondaggio.');
      return;
    }
    if (questions.length === 0) {
      Alert.alert('Nessuna domanda', 'Aggiungi almeno una domanda.');
      return;
    }
    if (questions.some((q) => !q.text.trim())) {
      Alert.alert('Domanda vuota', 'Compila il testo di tutte le domande.');
      return;
    }
    if ((scheduleMode === 'once' || scheduleMode === 'recurring') && !scheduledDate) {
      Alert.alert('Data richiesta', "Indica quando inviare il sondaggio.");
      return;
    }

    setSaving(true);
    try {
      const input = {
        title: title.trim(),
        questions,
        scheduleMode,
        scheduledAt: buildScheduledAt(),
        recurrenceDays: scheduleMode === 'recurring' ? Number(recurrenceDays) || 7 : null,
        notify,
      };
      if (isEditing && id) {
        await updateSurvey(id, input);
      } else {
        await createSurvey(input);
      }
      router.back();
    } catch {
      Alert.alert('Errore', 'Impossibile salvare il sondaggio.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (value: boolean) => {
    if (!id) return;
    setActive(value);
    try {
      await setSurveyActive(id, value);
    } catch {
      setActive(!value);
      Alert.alert('Errore', "Impossibile aggiornare lo stato.");
    }
  };

  const handleResendNow = async () => {
    if (!id) return;
    try {
      await resendSurveyNow(id);
      setSends(await loadSendsForSurvey(id));
      Alert.alert('Fatto', 'Sondaggio inviato di nuovo.');
    } catch {
      Alert.alert('Errore', 'Impossibile inviare di nuovo il sondaggio.');
    }
  };

  const handleDelete = () => {
    if (!id) return;
    Alert.alert('Eliminare il sondaggio?', 'Verranno eliminati anche tutti gli invii e le risposte. Azione non reversibile.', [
      { text: 'Annulla', style: 'cancel' },
      {
        text: 'Elimina',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteSurvey(id);
            router.back();
          } catch {
            Alert.alert('Errore', 'Impossibile eliminare il sondaggio.');
          }
        },
      },
    ]);
  };

  const toggleExpandSend = async (sendId: string) => {
    if (expandedSendId === sendId) {
      setExpandedSendId(null);
      return;
    }
    setExpandedSendId(sendId);
    if (!responsesBySend[sendId]) {
      try {
        const responses = await loadResponsesForSend(sendId);
        setResponsesBySend((prev) => ({ ...prev, [sendId]: responses }));
      } catch {
        Alert.alert('Errore', 'Impossibile caricare le risposte.');
      }
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.hint}>Caricamento…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Text style={styles.sectionTitle}>Titolo</Text>
        <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Es. Stato di forma settimanale" />

        <Text style={styles.sectionTitle}>Domande</Text>
        {questions.map((q, idx) => (
          <View key={q.id} style={styles.questionCard}>
            <View style={styles.questionHeader}>
              <Text style={styles.questionIndex}>Domanda {idx + 1}</Text>
              <Pressable onPress={() => removeQuestion(q.id)}>
                <Text style={{ fontSize: 16 }}>🗑️</Text>
              </Pressable>
            </View>
            <TextInput
              style={styles.input}
              value={q.text}
              onChangeText={(t) => updateQuestion(q.id, { text: t })}
              placeholder="Testo della domanda"
            />
            <View style={styles.typeRow}>
              {QUESTION_TYPES.map((t) => (
                <Pressable
                  key={t.value}
                  style={[styles.typeBtn, q.type === t.value && styles.typeBtnActive]}
                  onPress={() => updateQuestion(q.id, { type: t.value, options: t.value === 'choice' ? q.options ?? [''] : undefined })}
                >
                  <Text style={[styles.typeBtnText, q.type === t.value && styles.typeBtnTextActive]}>{t.label}</Text>
                </Pressable>
              ))}
            </View>
            {q.type === 'choice' && (
              <View style={{ marginTop: 8 }}>
                {(q.options ?? []).map((opt, oIdx) => (
                  <View key={oIdx} style={styles.optionRow}>
                    <TextInput
                      style={[styles.input, { flex: 1, marginBottom: 0 }]}
                      value={opt}
                      onChangeText={(v) => updateOption(q.id, oIdx, v)}
                      placeholder={`Opzione ${oIdx + 1}`}
                    />
                    <Pressable onPress={() => removeOption(q.id, oIdx)}>
                      <Text style={{ fontSize: 16 }}>✕</Text>
                    </Pressable>
                  </View>
                ))}
                <Pressable style={styles.addOptionBtn} onPress={() => addOption(q.id)}>
                  <Text style={styles.addOptionBtnText}>+ Opzione</Text>
                </Pressable>
              </View>
            )}
          </View>
        ))}
        <View style={styles.addQuestionRow}>
          {QUESTION_TYPES.map((t) => (
            <Pressable key={t.value} style={styles.smallBtn} onPress={() => addQuestion(t.value)}>
              <Text style={styles.smallBtnText}>+ {t.label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Invio</Text>
        <View style={styles.typeRow}>
          {SCHEDULE_MODES.map((m) => (
            <Pressable
              key={m.value}
              style={[styles.typeBtn, scheduleMode === m.value && styles.typeBtnActive]}
              onPress={() => setScheduleMode(m.value)}
            >
              <Text style={[styles.typeBtnText, scheduleMode === m.value && styles.typeBtnTextActive]}>{m.label}</Text>
            </Pressable>
          ))}
        </View>
        {(scheduleMode === 'once' || scheduleMode === 'recurring') && (
          <View style={{ marginTop: 10 }}>
            <View style={styles.row}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={scheduledDate}
                onChangeText={setScheduledDate}
                placeholder="Data AAAA-MM-GG"
              />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={scheduledTime}
                onChangeText={setScheduledTime}
                placeholder="Ora HH:MM"
              />
            </View>
            {scheduleMode === 'recurring' && (
              <View style={styles.row}>
                <Text style={styles.hint}>Ripeti ogni</Text>
                <TextInput
                  style={[styles.input, { width: 60, marginBottom: 0 }]}
                  value={recurrenceDays}
                  onChangeText={setRecurrenceDays}
                  keyboardType="number-pad"
                />
                <Text style={styles.hint}>giorni</Text>
              </View>
            )}
            {isEditing && (
              <View style={styles.switchRow}>
                <Text style={styles.hint}>Attivo</Text>
                <Switch value={active} onValueChange={handleToggleActive} />
              </View>
            )}
          </View>
        )}

        <Text style={styles.sectionTitle}>Notifiche risposte</Text>
        <NotifyRecipientsPicker
          label="Chi viene avvisato quando un giocatore risponde"
          value={notify}
          onChange={setNotify}
          staffMembers={staffMembers}
        />

        <View style={styles.row}>
          <Pressable style={[styles.btn, styles.btnPrimary]} onPress={handleSave} disabled={saving}>
            <Text style={styles.btnPrimaryText}>{saving ? 'Salvataggio…' : isEditing ? 'Salva modifiche' : 'Crea sondaggio'}</Text>
          </Pressable>
        </View>

        {isEditing && (
          <View style={styles.row}>
            <Pressable style={[styles.btn, styles.btnOutline]} onPress={handleResendNow}>
              <Text style={styles.btnOutlineText}>🔔 Invia di nuovo ora</Text>
            </Pressable>
            <Pressable style={[styles.btn, styles.btnDanger]} onPress={handleDelete}>
              <Text style={styles.btnDangerText}>Elimina</Text>
            </Pressable>
          </View>
        )}

        {isEditing && (
          <>
            <Text style={styles.sectionTitle}>Risposte</Text>
            {sends.length === 0 ? (
              <Text style={styles.hint}>Nessun invio ancora effettuato.</Text>
            ) : (
              sends.map((send) => {
                const responses = responsesBySend[send.id];
                const expanded = expandedSendId === send.id;
                return (
                  <View key={send.id} style={styles.sendCard}>
                    <Pressable style={styles.sendHeader} onPress={() => toggleExpandSend(send.id)}>
                      <Text style={styles.sendDate}>{new Date(send.sentAt).toLocaleString('it-IT')}</Text>
                      <Text style={styles.hint}>{expanded ? '▲' : `▼ ${responses?.length ?? '…'} risposte`}</Text>
                    </Pressable>
                    {expanded && (
                      <View style={{ marginTop: 8 }}>
                        {(responses ?? []).length === 0 ? (
                          <Text style={styles.hint}>Nessuna risposta ancora.</Text>
                        ) : (
                          responses!.map((r) => (
                            <View key={r.id} style={styles.responseBlock}>
                              <Text style={styles.responsePlayer}>{r.playerName}</Text>
                              {questions.map((q) => (
                                <Text key={q.id} style={styles.responseAnswer}>
                                  {q.text}: <Text style={{ fontWeight: '700' }}>{String(r.answers[q.id] ?? '—')}</Text>
                                </Text>
                              ))}
                            </View>
                          ))
                        )}
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#1a202c', marginTop: 20, marginBottom: 8 },
  hint: { fontSize: 13, color: '#64748b' },

  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#fff',
    fontSize: 14,
    marginBottom: 8,
  },

  questionCard: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 10 },
  questionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  questionIndex: { fontSize: 13, fontWeight: '700', color: '#64748b' },

  typeRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  typeBtn: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: '#f1f5f9' },
  typeBtnActive: { backgroundColor: '#1b7f3b' },
  typeBtnText: { fontSize: 12, fontWeight: '700', color: '#475569' },
  typeBtnTextActive: { color: '#fff' },

  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  addOptionBtn: { alignSelf: 'flex-start' },
  addOptionBtnText: { color: '#2563eb', fontWeight: '700', fontSize: 13 },

  addQuestionRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 },
  smallBtn: { backgroundColor: '#1b7f3b', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  smallBtnText: { color: 'white', fontWeight: '700', fontSize: 13 },

  row: { flexDirection: 'row', gap: 12, alignItems: 'center', marginTop: 12 },
  switchRow: { flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 10 },

  btn: { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnPrimary: { backgroundColor: '#1b7f3b' },
  btnPrimaryText: { color: '#fff', fontWeight: '700' },
  btnOutline: { backgroundColor: '#f1f5f9' },
  btnOutlineText: { color: '#475569', fontWeight: '700' },
  btnDanger: { backgroundColor: '#fee2e2' },
  btnDangerText: { color: '#dc2626', fontWeight: '700' },

  sendCard: { backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 8 },
  sendHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sendDate: { fontSize: 13, fontWeight: '700', color: '#1a202c' },
  responseBlock: { paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  responsePlayer: { fontSize: 13, fontWeight: '800', color: '#1b7f3b', marginBottom: 4 },
  responseAnswer: { fontSize: 13, color: '#334155', marginBottom: 2 },
});
