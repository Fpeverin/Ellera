-- 23_schema_survey_recipients.sql
--
-- A chi va il sondaggio: tutti i giocatori (default, comportamento di prima,
-- coerente con l'unico sondaggio gia' creato) oppure solo alcuni scelti alla
-- creazione — richiesto da Francesco dopo il primo test ("a chi arriva? va
-- resa configurabile"). Simmetrico a notify_mode/notify_staff_ids (chi dello
-- staff viene avvisato di una risposta, gia' in 21_schema_surveys.sql).

alter table surveys add column if not exists notify_players_mode text not null default 'all'
  check (notify_players_mode in ('all', 'selected'));
alter table surveys add column if not exists notify_players_ids jsonb not null default '[]'::jsonb;

-- Risolve i token dei giocatori destinatari di UN sondaggio, per l'invio
-- "subito" dal client (app/data/surveys.ts) — solo Staff/Admin, sono gli
-- unici che creano/inviano sondaggi.
create or replace function get_survey_player_tokens(p_org_id uuid, p_mode text, p_player_ids text[] default null)
returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  tokens text[];
begin
  if not is_staff_or_admin_of(p_org_id) then
    raise exception 'Solo lo staff puo'' inviare sondaggi';
  end if;

  select array_agg(m.push_token) into tokens
  from memberships m
  where m.org_id = p_org_id
    and m.push_token is not null
    and (
      (p_mode = 'all' and m.role = 'giocatore')
      or (p_mode = 'selected' and m.player_id = any(p_player_ids))
    );

  return coalesce(tokens, array[]::text[]);
end;
$$;

-- Ridefinita (creata in 22_schema_surveys_cron.sql) per rispettare
-- notify_players_mode/notify_players_ids invece di avvisare sempre tutti i
-- giocatori — il job pg_cron esistente ("process_due_surveys", ogni 5 minuti)
-- continua a chiamare questa stessa funzione, nessuna modifica al job.
create or replace function process_due_surveys()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s record;
  new_send_id uuid;
  tokens text[];
begin
  for s in
    select * from surveys
    where active
      and schedule_mode in ('once', 'recurring')
      and next_run_at is not null
      and next_run_at <= now()
  loop
    insert into survey_sends (survey_id, org_id, sent_at)
    values (s.id, s.org_id, now())
    returning id into new_send_id;

    select array_agg(m.push_token) into tokens
    from memberships m
    where m.org_id = s.org_id
      and m.push_token is not null
      and (
        (s.notify_players_mode = 'all' and m.role = 'giocatore')
        or (s.notify_players_mode = 'selected' and m.player_id = any(array(select jsonb_array_elements_text(s.notify_players_ids))))
      );

    if tokens is not null and array_length(tokens, 1) > 0 then
      perform net.http_post(
        url := 'https://exp.host/--/api/v2/push/send',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := (
          select jsonb_agg(jsonb_build_object(
            'to', t,
            'title', 'Nuovo sondaggio',
            'body', s.title,
            'data', jsonb_build_object('surveyId', s.id, 'sendId', new_send_id)
          ))
          from unnest(tokens) as t
        )
      );
    end if;

    if s.schedule_mode = 'recurring' and s.recurrence_days is not null then
      update surveys set next_run_at = s.next_run_at + (s.recurrence_days || ' days')::interval, updated_at = now() where id = s.id;
    else
      update surveys set schedule_mode = 'once', active = false, next_run_at = null, updated_at = now() where id = s.id;
    end if;
  end loop;
end;
$$;
