-- ElleraApp — schema Supabase: Squadre fisse per competizione + stadio di casa

-- Da eseguire UNA VOLTA nell'SQL Editor di Supabase, dopo 8_schema_roles.sql (per
-- is_member_of/is_staff_or_admin_of) e 13_schema_logos.sql (per il bucket "team-logos", riusato
-- qui sotto per gli stemmi delle squadre — stesso bucket già usato per logo squadra/avversario,
-- nessun bucket nuovo necessario: le policy SELECT/INSERT/UPDATE/DELETE esistono già).

-- ============================================================================
-- Squadre fisse per competizione: elenco configurabile (nome + stadio) usato per
-- scegliere rapidamente l'avversario in "Crea Calendario Competizione" e le due squadre di un
-- incontro in "Altre Partite" — invece di ridigitare ogni volta lo stesso nome a mano. Chiave
-- (org_id, competition) — stesso principio di competition_rules/matchday_fixtures: le
-- competizioni sono testo libero, non un'entità a parte.
-- ============================================================================

create table if not exists competition_teams (
  id text primary key,
  org_id uuid not null references organizations (id) on delete cascade,
  competition text not null,
  name text not null,
  stadium text,
  logo_path text,
  created_at timestamptz not null default now()
);

create index if not exists competition_teams_lookup_idx on competition_teams (org_id, competition);

alter table competition_teams enable row level security;

drop policy if exists "read competition_teams" on competition_teams;
drop policy if exists "staff insert competition_teams" on competition_teams;
drop policy if exists "staff update competition_teams" on competition_teams;
drop policy if exists "staff delete competition_teams" on competition_teams;
create policy "read competition_teams" on competition_teams for select using (is_member_of(org_id));
create policy "staff insert competition_teams" on competition_teams for insert with check (is_staff_or_admin_of(org_id));
create policy "staff update competition_teams" on competition_teams for update using (is_staff_or_admin_of(org_id)) with check (is_staff_or_admin_of(org_id));
create policy "staff delete competition_teams" on competition_teams for delete using (is_staff_or_admin_of(org_id));

-- Nota: lo stemma di una squadra configurata (colonna logo_path sopra) usa il bucket "team-logos"
-- esistente (path "{org_id}/competition-team-{id}.{ext}") — stesso bucket di logo_path
-- dell'organizzazione e di events.data.opponentLogoPath, per cui non serve alcuna policy nuova; e
-- soprattutto perché quando una squadra viene scelta dai chip (vedi CompetitionModal.tsx/
-- PartiteTab.tsx/altrePartite.tsx), il suo stemma diventa DIRETTAMENTE l'opponentLogoPath della
-- partita creata — deve quindi risolversi con la stessa funzione (opponentLogoUrlFromPath in
-- app/data/organization.ts), che punta a "team-logos": un bucket diverso qui avrebbe prodotto un
-- URL rotto ovunque lo stemma avversario viene mostrato.

-- ============================================================================
-- Stadio di casa della propria squadra (uno per organizzazione) — usato per prepopolare il
-- "Luogo" di una partita in CASA, cosi' come lo stadio di una squadra configurata sopra
-- prepopola il "Luogo" di una partita in TRASFERTA contro quella squadra.
-- ============================================================================

alter table organizations add column if not exists home_stadium text;
