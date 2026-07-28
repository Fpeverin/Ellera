-- ElleraApp — schema Supabase: gestione staff (lato admin)
--
-- Da eseguire UNA VOLTA nell'SQL Editor di Supabase, in aggiunta agli
-- script precedenti (1_schema.sql deve essere gia' stato eseguito, servono
-- le funzioni is_member_of/is_admin_of che definisce).

-- Elenco membri di una squadra con email (auth.users non e' leggibile
-- direttamente dal client per le policy di sicurezza di Supabase, per
-- questo serve una funzione SECURITY DEFINER che fa lei il join).
create or replace function list_org_members(p_org_id uuid)
returns table (user_id uuid, email text, role text, joined_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin_of(p_org_id) then
    raise exception 'Solo l''admin puo'' vedere i membri della squadra';
  end if;

  return query
    select m.user_id, u.email::text, m.role, m.created_at
    from memberships m
    join auth.users u on u.id = m.user_id
    where m.org_id = p_org_id
    order by m.created_at;
end;
$$;

-- Cambia il ruolo di un membro. Non si puo' cambiare il proprio stesso
-- ruolo (evita sia il rischio di restare senza admin, sia la necessita'
-- di contare quanti admin restano).
create or replace function update_member_role(p_org_id uuid, p_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin_of(p_org_id) then
    raise exception 'Solo l''admin puo'' modificare i ruoli';
  end if;
  if p_role not in ('admin', 'staff') then
    raise exception 'Ruolo non valido';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'Non puoi cambiare il tuo stesso ruolo';
  end if;

  update memberships set role = p_role where org_id = p_org_id and user_id = p_user_id;
end;
$$;

-- Rimuove un membro dalla squadra. Non ci si puo' rimuovere da soli.
create or replace function remove_member(p_org_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin_of(p_org_id) then
    raise exception 'Solo l''admin puo'' rimuovere membri';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'Non puoi rimuovere te stesso dalla squadra';
  end if;

  delete from memberships where org_id = p_org_id and user_id = p_user_id;
end;
$$;

-- Genera un nuovo codice invito casuale, invalidando quello precedente.
create or replace function regenerate_invite_code(p_org_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  new_code text;
begin
  if not is_admin_of(p_org_id) then
    raise exception 'Solo l''admin puo'' rigenerare il codice invito';
  end if;

  new_code := substr(md5(random()::text || clock_timestamp()::text), 1, 8);
  update organizations set invite_code = new_code where id = p_org_id;
  return new_code;
end;
$$;
