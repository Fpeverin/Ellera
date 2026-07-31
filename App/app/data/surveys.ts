// app/data/surveys.ts
//
// Sondaggi staff -> giocatori: creazione/modifica (Staff/Admin), invio
// (subito dal client, oppure programmato/ricorrente via pg_cron — vedi
// App/supabase/22_schema_surveys_cron.sql), risposte dei giocatori.
import { getCurrentOrgId } from '../lib/currentOrg';
import { supabase } from '../lib/supabase';
import { NotifyConfig, loadNotifyConfig } from './organization';
import { sendExpoPush } from './pushNotify';

export type SurveyQuestionType = 'text' | 'scale' | 'choice';
export type SurveyQuestion = { id: string; text: string; type: SurveyQuestionType; options?: string[] };
export type ScheduleMode = 'immediate' | 'once' | 'recurring';

/** A chi va inviato il sondaggio: tutti i giocatori, oppure solo alcuni scelti alla creazione. */
export type PlayerTargetMode = 'all' | 'selected';
export type PlayerTargetConfig = { mode: PlayerTargetMode; playerIds: string[] };

export type Survey = {
  id: string;
  title: string;
  questions: SurveyQuestion[];
  scheduleMode: ScheduleMode;
  nextRunAt: string | null;
  recurrenceDays: number | null;
  playerTargets: PlayerTargetConfig;
  notify: NotifyConfig;
  active: boolean;
  createdAt: string;
};

export type SurveySend = { id: string; surveyId: string; sentAt: string };
export type SurveyResponse = { id: string; sendId: string; playerId: string; answers: Record<string, string | number>; submittedAt: string };
export type SurveyResponseWithPlayer = SurveyResponse & { playerName: string };

function uid() {
  return `survey-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function surveyFromRow(row: any): Survey {
  return {
    id: row.id,
    title: row.title,
    questions: row.questions ?? [],
    scheduleMode: row.schedule_mode,
    nextRunAt: row.next_run_at,
    recurrenceDays: row.recurrence_days,
    playerTargets: { mode: row.notify_players_mode ?? 'all', playerIds: row.notify_players_ids ?? [] },
    notify: { mode: row.notify_mode, staffIds: row.notify_staff_ids ?? [] },
    active: row.active,
    createdAt: row.created_at,
  };
}

export async function loadSurveys(): Promise<Survey[]> {
  const { data, error } = await supabase.from('surveys').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(surveyFromRow);
}

export async function loadSurvey(id: string): Promise<Survey | null> {
  const { data, error } = await supabase.from('surveys').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? surveyFromRow(data) : null;
}

export type SurveyInput = {
  title: string;
  questions: SurveyQuestion[];
  scheduleMode: ScheduleMode;
  scheduledAt?: string | null; // ISO — richiesto per 'once'/'recurring' (prima occorrenza)
  recurrenceDays?: number | null; // richiesto per 'recurring'
  playerTargets: PlayerTargetConfig;
  notify: NotifyConfig;
};

async function sendSurveyNow(surveyId: string, orgId: string, title: string, playerTargets: PlayerTargetConfig): Promise<void> {
  const { data: send, error } = await supabase
    .from('survey_sends')
    .insert({ survey_id: surveyId, org_id: orgId })
    .select('id')
    .single();
  if (error) throw error;

  const { data: tokens, error: tokensError } = await supabase.rpc('get_survey_player_tokens', {
    p_org_id: orgId,
    p_mode: playerTargets.mode,
    p_player_ids: playerTargets.playerIds,
  });
  if (tokensError) throw tokensError;

  await sendExpoPush(tokens ?? [], 'Nuovo sondaggio', title, { surveyId, sendId: send.id });
}

export async function createSurvey(input: SurveyInput): Promise<Survey> {
  const orgId = getCurrentOrgId();
  const { data: userData } = await supabase.auth.getUser();
  const id = uid();
  const nextRunAt = input.scheduleMode === 'immediate' ? null : input.scheduledAt ?? null;

  const { error } = await supabase.from('surveys').insert({
    id,
    org_id: orgId,
    title: input.title,
    questions: input.questions,
    schedule_mode: input.scheduleMode,
    next_run_at: nextRunAt,
    recurrence_days: input.scheduleMode === 'recurring' ? input.recurrenceDays ?? null : null,
    notify_players_mode: input.playerTargets.mode,
    notify_players_ids: input.playerTargets.playerIds,
    notify_mode: input.notify.mode,
    notify_staff_ids: input.notify.staffIds,
    created_by: userData.user?.id,
  });
  if (error) throw error;

  if (input.scheduleMode === 'immediate') {
    await sendSurveyNow(id, orgId, input.title, input.playerTargets);
  }

  const created = await loadSurvey(id);
  if (!created) throw new Error('Sondaggio creato ma non trovato.');
  return created;
}

export async function updateSurvey(id: string, input: SurveyInput): Promise<void> {
  const nextRunAt = input.scheduleMode === 'immediate' ? null : input.scheduledAt ?? null;
  const { error } = await supabase
    .from('surveys')
    .update({
      title: input.title,
      questions: input.questions,
      schedule_mode: input.scheduleMode,
      next_run_at: nextRunAt,
      recurrence_days: input.scheduleMode === 'recurring' ? input.recurrenceDays ?? null : null,
      notify_players_mode: input.playerTargets.mode,
      notify_players_ids: input.playerTargets.playerIds,
      notify_mode: input.notify.mode,
      notify_staff_ids: input.notify.staffIds,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) throw error;
}

/** Invia di nuovo subito lo stesso sondaggio (nuova occorrenza/send), indipendentemente dallo schedule_mode. */
export async function resendSurveyNow(id: string): Promise<void> {
  const orgId = getCurrentOrgId();
  const survey = await loadSurvey(id);
  if (!survey) throw new Error('Sondaggio non trovato.');
  await sendSurveyNow(id, orgId, survey.title, survey.playerTargets);
}

export async function setSurveyActive(id: string, active: boolean): Promise<void> {
  const { error } = await supabase.from('surveys').update({ active, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

export async function deleteSurvey(id: string): Promise<void> {
  const { error } = await supabase.from('surveys').delete().eq('id', id);
  if (error) throw error;
}

/* --------------------------- Invii e risposte --------------------------- */

export async function loadSendsForSurvey(surveyId: string): Promise<SurveySend[]> {
  const { data, error } = await supabase
    .from('survey_sends')
    .select('id, survey_id, sent_at')
    .eq('survey_id', surveyId)
    .order('sent_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({ id: row.id, surveyId: row.survey_id, sentAt: row.sent_at }));
}

export async function loadResponsesForSend(sendId: string): Promise<SurveyResponseWithPlayer[]> {
  const { data, error } = await supabase
    .from('survey_responses')
    .select('id, player_id, answers, submitted_at, players(name)')
    .eq('survey_send_id', sendId)
    .order('submitted_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: row.id,
    sendId,
    playerId: row.player_id,
    playerName: row.players?.name ?? 'Giocatore',
    answers: row.answers ?? {},
    submittedAt: row.submitted_at,
  }));
}

/** Tutti gli invii dei sondaggi attivi/passati per l'org, con lo stato di risposta del giocatore indicato. */
export async function loadSendsForPlayer(playerId: string): Promise<{ send: SurveySend; survey: Survey; answered: boolean }[]> {
  const [{ data: sends, error: sendsError }, { data: responses, error: respError }] = await Promise.all([
    supabase.from('survey_sends').select('id, survey_id, sent_at, surveys(*)').order('sent_at', { ascending: false }),
    supabase.from('survey_responses').select('survey_send_id').eq('player_id', playerId),
  ]);
  if (sendsError) throw sendsError;
  if (respError) throw respError;

  const answeredIds = new Set((responses ?? []).map((r: any) => r.survey_send_id));
  return (sends ?? [])
    .filter((row: any) => row.surveys)
    .map((row: any) => ({
      send: { id: row.id, surveyId: row.survey_id, sentAt: row.sent_at },
      survey: surveyFromRow(row.surveys),
      answered: answeredIds.has(row.id),
    }));
}

export async function loadOwnResponse(sendId: string, playerId: string): Promise<SurveyResponse | null> {
  const { data, error } = await supabase
    .from('survey_responses')
    .select('id, player_id, answers, submitted_at')
    .eq('survey_send_id', sendId)
    .eq('player_id', playerId)
    .maybeSingle();
  if (error) throw error;
  return data ? { id: data.id, sendId, playerId: data.player_id, answers: data.answers ?? {}, submittedAt: data.submitted_at } : null;
}

async function notifyStaffOfSurveyResponse(orgId: string, survey: Survey, playerName: string) {
  try {
    const config = survey.notify ?? (await loadNotifyConfig('live_proposals'));
    const { data: tokens, error } = await supabase.rpc('get_notification_tokens', {
      p_org_id: orgId,
      p_mode: config.mode,
      p_staff_member_ids: config.staffIds,
    });
    if (error) throw error;
    await sendExpoPush(tokens ?? [], 'Risposta al sondaggio', `${playerName} ha risposto a "${survey.title}".`);
  } catch (e) {
    console.error('Errore notifica risposta sondaggio', e);
  }
}

export async function submitSurveyResponse(
  sendId: string,
  playerId: string,
  playerName: string,
  survey: Survey,
  answers: Record<string, string | number>
): Promise<void> {
  const orgId = getCurrentOrgId();
  const { error } = await supabase
    .from('survey_responses')
    .upsert({ survey_send_id: sendId, org_id: orgId, player_id: playerId, answers, submitted_at: new Date().toISOString() }, { onConflict: 'survey_send_id,player_id' });
  if (error) throw error;
  notifyStaffOfSurveyResponse(orgId, survey, playerName);
}
