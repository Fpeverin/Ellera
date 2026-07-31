-- 21_schema_surveys.sql
--
-- Sondaggi staff -> giocatori (stato di salute, allenamento, infortuni,
-- assenze...): creabili da Staff/Admin, con domande a testo libero/scala 1-5/
-- scelta singola, inviabili subito, programmati o ricorrenti ("ogni N
-- giorni"). Ogni invio effettivo e' una riga di survey_sends (serve per i
-- sondaggi ricorrenti: ogni occorrenza ha le sue risposte, non si mescolano).
-- L'invio programmato/ricorrente e' gestito da 22_schema_surveys_cron.sql.

create table if not exists surveys (
  id text primary key,
  org_id uuid not null references organizations (id) on delete cascade,
  title text not null,
  questions jsonb not null default '[]'::jsonb, -- [{id, text, type: 'text'|'scale'|'choice', options?: string[]}]
  schedule_mode text not null default 'immediate' check (schedule_mode in ('immediate', 'once', 'recurring')),
  next_run_at timestamptz, -- prossimo invio dovuto ('once'/'recurring'), null altrimenti
  recurrence_days int, -- solo per 'recurring': ogni quanti giorni si ripete
  notify_mode text not null default 'admin_only' check (notify_mode in ('admin_only', 'all', 'selected')),
  notify_staff_ids jsonb not null default '[]'::jsonb, -- chi avvisare quando arriva una risposta
  active boolean not null default true, -- lo staff puo' sospendere un ricorrente senza cancellarlo
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists survey_sends (
  id uuid primary key default gen_random_uuid(),
  survey_id text not null references surveys (id) on delete cascade,
  org_id uuid not null references organizations (id) on delete cascade,
  sent_at timestamptz not null default now()
);

create table if not exists survey_responses (
  id uuid primary key default gen_random_uuid(),
  survey_send_id uuid not null references survey_sends (id) on delete cascade,
  org_id uuid not null references organizations (id) on delete cascade,
  player_id text not null references players (id) on delete cascade,
  answers jsonb not null default '{}'::jsonb, -- {questionId: string|number}
  submitted_at timestamptz not null default now(),
  unique (survey_send_id, player_id)
);

create index if not exists survey_sends_survey_idx on survey_sends (survey_id);
create index if not exists survey_responses_send_idx on survey_responses (survey_send_id);
create index if not exists surveys_due_idx on surveys (org_id, active, schedule_mode, next_run_at);

alter table surveys enable row level security;
alter table survey_sends enable row level security;
alter table survey_responses enable row level security;

drop policy if exists "members can read surveys" on surveys;
create policy "members can read surveys" on surveys for select using (is_member_of(org_id));
drop policy if exists "staff insert surveys" on surveys;
create policy "staff insert surveys" on surveys for insert with check (is_staff_or_admin_of(org_id));
drop policy if exists "staff update surveys" on surveys;
create policy "staff update surveys" on surveys for update using (is_staff_or_admin_of(org_id)) with check (is_staff_or_admin_of(org_id));
drop policy if exists "staff delete surveys" on surveys;
create policy "staff delete surveys" on surveys for delete using (is_staff_or_admin_of(org_id));

drop policy if exists "members can read survey sends" on survey_sends;
create policy "members can read survey sends" on survey_sends for select using (is_member_of(org_id));
drop policy if exists "staff insert survey sends" on survey_sends;
create policy "staff insert survey sends" on survey_sends for insert with check (is_staff_or_admin_of(org_id));
drop policy if exists "staff delete survey sends" on survey_sends;
create policy "staff delete survey sends" on survey_sends for delete using (is_staff_or_admin_of(org_id));

-- Le risposte le legge lo staff (tutte) o il giocatore proprietario (solo le
-- proprie); le scrive solo il giocatore proprietario, stesso pattern di
-- player_edit_requests (9_schema_player_edits.sql).
drop policy if exists "read survey responses" on survey_responses;
create policy "read survey responses" on survey_responses
  for select using (
    is_staff_or_admin_of(org_id)
    or exists (
      select 1 from memberships m
      where m.user_id = auth.uid() and m.org_id = survey_responses.org_id and m.player_id = survey_responses.player_id
    )
  );

drop policy if exists "giocatore insert own survey response" on survey_responses;
create policy "giocatore insert own survey response" on survey_responses
  for insert with check (
    is_member_of(org_id)
    and exists (
      select 1 from memberships m
      where m.user_id = auth.uid() and m.org_id = survey_responses.org_id and m.player_id = survey_responses.player_id
    )
  );

drop policy if exists "giocatore update own survey response" on survey_responses;
create policy "giocatore update own survey response" on survey_responses
  for update using (
    exists (
      select 1 from memberships m
      where m.user_id = auth.uid() and m.org_id = survey_responses.org_id and m.player_id = survey_responses.player_id
    )
  )
  with check (
    exists (
      select 1 from memberships m
      where m.user_id = auth.uid() and m.org_id = survey_responses.org_id and m.player_id = survey_responses.player_id
    )
  );

-- Toggle Admin per l'intera sezione (stesso pattern di show_training_attendance).
alter table organizations add column if not exists surveys_enabled boolean not null default true;
