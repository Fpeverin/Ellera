-- ElleraApp — schema Supabase: regole di partecipazione per competizione (Under/Over)
--
-- Da eseguire UNA VOLTA nell'SQL Editor di Supabase, dopo tutti gli script precedenti.
--
-- Le competizioni oggi non sono un'entita' a parte (solo una stringa libera su
-- events.competition), quindi le regole si agganciano per nome competizione.
-- Esempio: Eccellenza Umbra richiede sempre almeno 3 giocatori "Under" in campo,
-- con soglie indipendenti (almeno 1 nato nel 2006 o dopo, almeno 1 nel 2007 o
-- dopo, almeno 1 nel 2008 o dopo) — un giocatore molto giovane puo' soddisfare
-- piu' soglie insieme, quindi la verifica conta, per ciascuna soglia, quanti
-- giocatori in campo hanno anno di nascita >= soglia (Under) o <= soglia (Over).

create table if not exists competition_rules (
  org_id uuid not null references organizations (id) on delete cascade,
  competition text not null,
  under_enabled boolean not null default false,
  under_tiers jsonb not null default '[]'::jsonb,  -- [{ "year": 2006, "minCount": 1 }, ...]
  over_enabled boolean not null default false,
  over_tiers jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (org_id, competition)
);

drop trigger if exists competition_rules_set_updated_at on competition_rules;
create trigger competition_rules_set_updated_at
  before update on competition_rules
  for each row execute function set_updated_at();

alter table competition_rules enable row level security;

drop policy if exists "read competition_rules" on competition_rules;
create policy "read competition_rules" on competition_rules for select using (is_member_of(org_id));

drop policy if exists "staff insert competition_rules" on competition_rules;
create policy "staff insert competition_rules" on competition_rules for insert with check (is_staff_or_admin_of(org_id));

drop policy if exists "staff update competition_rules" on competition_rules;
create policy "staff update competition_rules" on competition_rules for update using (is_staff_or_admin_of(org_id)) with check (is_staff_or_admin_of(org_id));

drop policy if exists "staff delete competition_rules" on competition_rules;
create policy "staff delete competition_rules" on competition_rules for delete using (is_staff_or_admin_of(org_id));
