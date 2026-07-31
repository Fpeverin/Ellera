// app/squadra/sondaggi/index.tsx
//
// Staff/Admin: elenco sondaggi creati, tap per modificare/vedere le risposte.
// Giocatore: elenco degli invii a lui destinati (pendenti/già risposti), tap
// su un invio pendente per rispondere.
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import {
  loadOwnResponse,
  loadSendsForPlayer,
  loadSurveys,
  submitSurveyResponse,
  type Survey,
  type SurveyQuestion,
  type SurveySend,
} from '../../data/surveys';

const SCHEDULE_LABELS: Record<Survey['scheduleMode'], string> = {
  immediate: 'Inviato subito',
  once: 'Programmato',
  recurring: 'Ricorrente',
};

type PendingSend = { send: SurveySend; survey: Survey; answered: boolean };

export default function SondaggiIndex() {
  const router = useRouter();
  const { membership } = useAuth();
  const isStaffOrAdmin = membership?.role === 'admin' || membership?.role === 'staff';

  const [loading, setLoading] = useState(true);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [sends, setSends] = useState<PendingSend[]>([]);

  const [answerFor, setAnswerFor] = useState<PendingSend | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | number>>({});
  const [readOnlyAnswers, setReadOnlyAnswers] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (isStaffOrAdmin) {
        setSurveys(await loadSurveys());
      } else if (membership?.playerId) {
        setSends(await loadSendsForPlayer(membership.playerId));
      }
    } catch {
      Alert.alert('Errore', 'Impossibile caricare i sondaggi.');
    } finally {
      setLoading(false);
    }
  }, [isStaffOrAdmin, membership?.playerId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openAnswer = async (item: PendingSend) => {
    if (!membership?.playerId) return;
    setAnswerFor(item);
    setAnswers({});
    setReadOnlyAnswers(item.answered);
    if (item.answered) {
      try {
        const existing = await loadOwnResponse(item.send.id, membership.playerId);
        setAnswers(existing?.answers ?? {});
      } catch {}
    }
  };

  const handleSubmit = async () => {
    if (!answerFor || !membership?.playerId) return;
    const missing = answerFor.survey.questions.some((q) => answers[q.id] === undefined || answers[q.id] === '');
    if (missing) {
      Alert.alert('Rispondi a tutte le domande', 'Completa tutte le domande prima di inviare.');
      return;
    }
    setSubmitting(true);
    try {
      await submitSurveyResponse(
        answerFor.send.id,
        membership.playerId,
        membership.displayName || 'Giocatore',
        answerFor.survey,
        answers
      );
      setAnswerFor(null);
      load();
    } catch {
      Alert.alert('Errore', 'Impossibile inviare la risposta.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderQuestionInput = (q: SurveyQuestion) => {
    const value = answers[q.id];
    if (q.type === 'text') {
      return (
        <TextInput
          style={styles.textInput}
          value={typeof value === 'string' ? value : ''}
          onChangeText={(t) => setAnswers((a) => ({ ...a, [q.id]: t }))}
          multiline
          editable={!readOnlyAnswers}
          placeholder="Scrivi la tua risposta…"
        />
      );
    }
    if (q.type === 'scale') {
      return (
        <View style={styles.scaleRow}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Pressable
              key={n}
              style={[styles.scaleBtn, value === n && styles.scaleBtnActive]}
              onPress={() => !readOnlyAnswers && setAnswers((a) => ({ ...a, [q.id]: n }))}
              disabled={readOnlyAnswers}
            >
              <Text style={[styles.scaleBtnText, value === n && styles.scaleBtnTextActive]}>{n}</Text>
            </Pressable>
          ))}
        </View>
      );
    }
    // choice
    return (
      <View>
        {(q.options ?? []).map((opt) => (
          <Pressable
            key={opt}
            style={[styles.choiceRow, value === opt && styles.choiceRowActive]}
            onPress={() => !readOnlyAnswers && setAnswers((a) => ({ ...a, [q.id]: opt }))}
            disabled={readOnlyAnswers}
          >
            <View style={[styles.radio, value === opt && styles.radioOn]} />
            <Text style={styles.choiceText}>{opt}</Text>
          </Pressable>
        ))}
      </View>
    );
  };

  if (isStaffOrAdmin) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Sondaggi</Text>
          <Pressable style={styles.newBtn} onPress={() => router.push('/squadra/sondaggi/editor')}>
            <Text style={styles.newBtnText}>+ Nuovo sondaggio</Text>
          </Pressable>
        </View>
        <FlatList
          data={surveys}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16 }}
          refreshing={loading}
          onRefresh={load}
          ListEmptyComponent={!loading ? <Text style={styles.emptyText}>Nessun sondaggio creato.</Text> : null}
          renderItem={({ item }) => (
            <Pressable
              style={styles.surveyCard}
              onPress={() => router.push({ pathname: '/squadra/sondaggi/editor', params: { id: item.id } })}
            >
              <Text style={styles.surveyTitle}>{item.title}</Text>
              <Text style={styles.surveyMeta}>
                {SCHEDULE_LABELS[item.scheduleMode]}
                {!item.active && item.scheduleMode !== 'immediate' ? ' · in pausa' : ''} · {item.questions.length} domande
              </Text>
            </Pressable>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        />
      </SafeAreaView>
    );
  }

  // --- Giocatore ---
  if (!membership?.playerId) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <Text style={styles.emptyText}>Il tuo account non è collegato a un giocatore in Rosa.</Text>
      </SafeAreaView>
    );
  }

  const pending = sends.filter((s) => !s.answered);
  const answered = sends.filter((s) => s.answered);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <FlatList
        data={[...pending, ...answered]}
        keyExtractor={(item) => item.send.id}
        contentContainerStyle={{ padding: 16 }}
        refreshing={loading}
        onRefresh={load}
        ListHeaderComponent={<Text style={styles.title}>Sondaggi</Text>}
        ListEmptyComponent={!loading ? <Text style={styles.emptyText}>Nessun sondaggio per te al momento.</Text> : null}
        renderItem={({ item }) => (
          <Pressable style={styles.surveyCard} onPress={() => openAnswer(item)}>
            <Text style={styles.surveyTitle}>{item.survey.title}</Text>
            <Text style={[styles.surveyMeta, item.answered ? styles.answeredMeta : styles.pendingMeta]}>
              {item.answered ? '✓ Risposto' : '● In attesa di risposta'}
            </Text>
          </Pressable>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      />

      <Modal visible={!!answerFor} animationType="slide" onRequestClose={() => setAnswerFor(null)}>
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            <Text style={styles.title}>{answerFor?.survey.title}</Text>
            {readOnlyAnswers && <Text style={styles.emptyText}>Hai già risposto — le risposte non sono più modificabili.</Text>}
            {answerFor?.survey.questions.map((q) => (
              <View key={q.id} style={styles.questionBlock}>
                <Text style={styles.questionText}>{q.text}</Text>
                {renderQuestionInput(q)}
              </View>
            ))}
            <View style={styles.row}>
              <Pressable style={[styles.btn, styles.btnOutline]} onPress={() => setAnswerFor(null)}>
                <Text style={styles.btnOutlineText}>Chiudi</Text>
              </Pressable>
              {!readOnlyAnswers && (
                <Pressable style={[styles.btn, styles.btnPrimary]} onPress={handleSubmit} disabled={submitting}>
                  <Text style={styles.btnPrimaryText}>{submitting ? 'Invio…' : 'Invia risposte'}</Text>
                </Pressable>
              )}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16 },
  title: { fontSize: 24, fontWeight: '800', color: '#1a202c', marginBottom: 4 },
  emptyText: { color: '#64748b', padding: 16, textAlign: 'center' },

  newBtn: { backgroundColor: '#1b7f3b', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  newBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  surveyCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  surveyTitle: { fontSize: 16, fontWeight: '700', color: '#1a202c' },
  surveyMeta: { fontSize: 13, color: '#64748b', marginTop: 4 },
  pendingMeta: { color: '#b45309', fontWeight: '700' },
  answeredMeta: { color: '#16a34a', fontWeight: '700' },

  questionBlock: { marginBottom: 20 },
  questionText: { fontSize: 15, fontWeight: '700', color: '#1a202c', marginBottom: 8 },
  textInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 10,
    minHeight: 60,
    textAlignVertical: 'top',
    backgroundColor: '#fff',
  },
  scaleRow: { flexDirection: 'row', gap: 8 },
  scaleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
  },
  scaleBtnActive: { backgroundColor: '#1b7f3b' },
  scaleBtnText: { fontSize: 16, fontWeight: '700', color: '#475569' },
  scaleBtnTextActive: { color: '#fff' },

  choiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#f9fafb',
    marginBottom: 6,
  },
  choiceRowActive: { backgroundColor: '#dcfce7' },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#cbd5e1' },
  radioOn: { backgroundColor: '#1b7f3b', borderColor: '#1b7f3b' },
  choiceText: { fontSize: 14, color: '#1a202c' },

  row: { flexDirection: 'row', gap: 12, marginTop: 8 },
  btn: { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnPrimary: { backgroundColor: '#1b7f3b' },
  btnPrimaryText: { color: '#fff', fontWeight: '700' },
  btnOutline: { backgroundColor: '#f1f5f9' },
  btnOutlineText: { color: '#475569', fontWeight: '700' },
});
