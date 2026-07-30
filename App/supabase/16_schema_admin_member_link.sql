-- 16_schema_admin_member_link.sql
--
-- Permette all'Admin di collegare/scollegare FORZATAMENTE un account già
-- membro della squadra a un giocatore o a una persona dello Staff, senza
-- passare da un codice di invito — utile per correggere un collegamento
-- sbagliato o per sistemare un account che è entrato in altro modo.
-- Usata dalla nuova gestione unificata "tocca il nome" in Admin
-- (app/squadra/staff.tsx), insieme a update_member_role già esistente.

create or replace function set_member_link(
  p_org_id uuid,
  p_user_id uuid,
  p_player_id text,
  p_staff_member_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin_of(p_org_id) then
    raise exception 'Solo l''admin puo'' modificare i collegamenti';
  end if;

  if p_player_id is not null and not exists (
    select 1 from players where id = p_player_id and org_id = p_org_id
  ) then
    raise exception 'Giocatore non trovato';
  end if;

  if p_staff_member_id is not null and not exists (
    select 1 from staff_members where id = p_staff_member_id and org_id = p_org_id
  ) then
    raise exception 'Persona dello staff non trovata';
  end if;

  update memberships
  set player_id = p_player_id, staff_member_id = p_staff_member_id
  where org_id = p_org_id and user_id = p_user_id;
end;
$$;
