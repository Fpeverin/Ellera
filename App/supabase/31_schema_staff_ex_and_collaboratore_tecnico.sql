-- 31_schema_staff_ex_and_collaboratore_tecnico.sql
--
-- Due richieste di Francesco insieme: 1) "Sposta tra gli ex" anche per lo Staff Tecnico/Sanitario/
-- Dirigenza (stesso principio di players.is_ex — vedi App/supabase/2_schema_players.sql), con la
-- conseguenza che solo lo Staff attivo è selezionabile per una nuova Convocazione/Lista Gara;
-- 2) nuova figura "Collaboratore Tecnico" tra i ruoli disponibili per lo Staff Tecnico.

-- ============================================================================
-- Staff: Sposta tra gli ex (stesso identico pattern di players.is_ex)
-- ============================================================================

alter table staff_members add column if not exists is_ex boolean not null default false;

-- ============================================================================
-- Nuovo ruolo "Collaboratore Tecnico" tra i Ruoli disponibili per lo Staff
-- (organizations.staff_roles, introdotta in 15_schema_staff_invites_and_config.sql).
-- Aggiornato sia il default per le organizzazioni future, sia (con l'update sotto) quelle già
-- esistenti — il default di una colonna non si applica retroattivamente alle righe già scritte.
-- ============================================================================

alter table organizations alter column staff_roles set default
  '["Allenatore","Vice-Allenatore","Preparatore Atletico","Preparatore Portieri","Collaboratore Tecnico","Direttore Sportivo","Fisioterapista"]'::jsonb;

update organizations
set staff_roles = staff_roles || '["Collaboratore Tecnico"]'::jsonb
where not (staff_roles @> '["Collaboratore Tecnico"]'::jsonb);
