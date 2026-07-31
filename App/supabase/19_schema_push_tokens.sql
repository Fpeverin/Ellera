-- 19_schema_push_tokens.sql
--
-- Fondamenta per le notifiche push tra utenti diversi (sondaggi, convocazione,
-- proposte Live, modifiche anagrafica) — finora l'app aveva solo promemoria
-- locali (app/utils/eventReminders.ts). Ogni account salva il proprio push
-- token Expo sulla propria riga di membership; l'invio vero e proprio resta
-- lato client (fetch verso l'API pubblica di Expo, nessun server dedicato) —
-- fanno eccezione i sondaggi programmati/ricorrenti, vedi 22_schema_surveys_cron.sql.

alter table memberships add column if not exists push_token text;

-- Un utente scrive SOLO il proprio token (auth.uid() nel where, non nel
-- parametro) — evita di dover toccare le policy RLS di scrittura esistenti su
-- memberships (oggi solo admin, "admin can manage memberships" in 1_schema.sql).
create or replace function register_push_token(p_org_id uuid, p_push_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update memberships
  set push_token = p_push_token
  where user_id = auth.uid() and org_id = p_org_id;
end;
$$;

-- Risolve i token di chi deve ricevere una notifica "verso lo staff":
-- 'admin_only' -> solo gli admin, 'all' -> tutto staff+admin,
-- 'selected' -> solo i membri collegati a uno dei staff_member_id indicati.
-- Riusata da: notifiche proposte Live, notifiche modifiche anagrafica,
-- notifiche risposta sondaggio. Chiunque sia membro dell'org puo' chiamarla
-- (anche un Giocatore, es. per notificare lo staff di una sua proposta) —
-- ritorna solo token opachi, nessun dato personale.
create or replace function get_notification_tokens(p_org_id uuid, p_mode text, p_staff_member_ids text[] default null)
returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  tokens text[];
begin
  if not is_member_of(p_org_id) then
    raise exception 'Non sei membro di questa organizzazione';
  end if;

  select array_agg(m.push_token) into tokens
  from memberships m
  where m.org_id = p_org_id
    and m.push_token is not null
    and (
      (p_mode = 'admin_only' and m.role = 'admin')
      or (p_mode = 'all' and m.role in ('admin', 'staff'))
      or (p_mode = 'selected' and m.staff_member_id = any(p_staff_member_ids))
    );

  return coalesce(tokens, array[]::text[]);
end;
$$;

-- Risolve i token dei giocatori convocati (o di una lista qualsiasi di
-- player_id), per la notifica di Convocazione.
create or replace function get_push_tokens_for_players(p_org_id uuid, p_player_ids text[])
returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  tokens text[];
begin
  if not is_member_of(p_org_id) then
    raise exception 'Non sei membro di questa organizzazione';
  end if;

  select array_agg(m.push_token) into tokens
  from memberships m
  where m.org_id = p_org_id
    and m.push_token is not null
    and m.player_id = any(p_player_ids);

  return coalesce(tokens, array[]::text[]);
end;
$$;

-- Risolve i token di TUTTI i giocatori dell'org (invio "subito" di un
-- sondaggio) — solo Staff/Admin possono chiamarla, sono gli unici che creano
-- sondaggi.
create or replace function get_org_player_tokens(p_org_id uuid)
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
  where m.org_id = p_org_id and m.role = 'giocatore' and m.push_token is not null;

  return coalesce(tokens, array[]::text[]);
end;
$$;
