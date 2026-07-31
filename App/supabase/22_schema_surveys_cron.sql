-- 22_schema_surveys_cron.sql
--
-- Invio REALE dei sondaggi programmati/ricorrenti, anche se nessuno ha l'app
-- aperta in quel momento: pg_cron (pianificazione) + pg_net (chiamata HTTP
-- verso l'API di Expo), entrambe estensioni Postgres incluse in Supabase —
-- nessun servizio esterno/server dedicato, e' comunque "solo" un altro script
-- SQL. Gli invii "subito" (schedule_mode = 'immediate') restano invece a
-- carico del client (app/data/surveys.ts), qui si gestiscono solo 'once' e
-- 'recurring'.
--
-- Se il comando "create extension" sotto desse un permission error sul piano
-- Supabase in uso: Dashboard -> Database -> Extensions, attiva "pg_cron" e
-- "pg_net" da li', poi rilancia solo la parte sotto (funzione + schedule).

create extension if not exists pg_cron;
create extension if not exists pg_net;

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
    where m.org_id = s.org_id and m.role = 'giocatore' and m.push_token is not null;

    -- Un oggetto messaggio per token (limite Expo: max 100 destinatari per
    -- chiamata — per una squadra di poche decine di giocatori non serve
    -- suddividere in piu' chiamate).
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

-- Idempotente: se lo script viene rilanciato, sostituisce il job invece di duplicarlo.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'process_due_surveys') then
    perform cron.unschedule('process_due_surveys');
  end if;
end $$;

select cron.schedule('process_due_surveys', '*/5 * * * *', 'select process_due_surveys();');
