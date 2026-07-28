-- ElleraApp — migrazione una tantum: sposta la rosa scritta nel codice
-- (app/data/players.ts) dentro Supabase, prima di toglierla dai sorgenti.
--
-- Da eseguire UNA VOLTA nell'SQL Editor di Supabase, PRIMA di aggiornare
-- l'app alla versione che rimuove la rosa hardcoded (altrimenti per un
-- po' la rosa risulterebbe vuota).

do $$
declare
  v_org_id uuid;
begin
  select id into v_org_id from organizations where name = 'Ellera' limit 1;
  if v_org_id is null then
    raise exception 'Squadra "Ellera" non trovata: controlla il nome esatto in organizations.name';
  end if;

  insert into players (id, org_id, name, role, year, height, weight, is_ex) values
    ('beccari-gabriele', v_org_id, 'BECCARI GABRIELE', 'PORTIERE', 2008, '170', '60', false),
    ('segoloni-riccardo', v_org_id, 'SEGOLONI RICCARDO', 'PORTIERE', 1988, '170', '60', false),
    ('liuzza-alessandro', v_org_id, 'LIUZZA ALESSANDRO', 'PORTIERE', 2007, '170', '60', false),
    ('polidori-mattia', v_org_id, 'POLIDORI MATTIA', 'DIFENSORE', 1998, '170', '60', false),
    ('morlunghi-alessandro', v_org_id, 'MORLUNGHI ALESSANDRO', 'DIFENSORE', 2005, '170', '60', false),
    ('mottola-francesco', v_org_id, 'MOTTOLA FRANCESCO', 'DIFENSORE', 2005, '170', '60', false),
    ('vescovi-filippo', v_org_id, 'VESCOVI FILIPPO', 'DIFENSORE', 2005, '170', '60', false),
    ('sorbelli-daniele', v_org_id, 'SORBELLI DANIELE', 'DIFENSORE', 2002, '170', '60', false),
    ('tarpani-matteo', v_org_id, 'TARPANI MATTEO', 'DIFENSORE', 2006, '170', '60', false),
    ('giombetti-daniele', v_org_id, 'SEBBEN VALENTINO', 'DIFENSORE', 2006, '170', '60', false),
    ('silvestri-giacomo', v_org_id, 'SILVESTRI GIACOMO', 'DIFENSORE', 2008, '170', '60', false),
    ('spippoli-lorenzo', v_org_id, 'SPIPPOLI LORENZO', 'DIFENSORE', 2007, '170', '60', false),
    ('borgnini-edoardo', v_org_id, 'BORGNINI EDOARDO', 'DIFENSORE', 2009, '170', '60', false),
    ('capaccio-nicola', v_org_id, 'CAPACCIO NICOLA', 'CENTROCAMPISTA', 2009, '170', '60', false),
    ('vitale-lucio', v_org_id, 'VITALE LUCIO', 'CENTROCAMPISTA', 2009, '170', '60', false),
    ('convito-michele', v_org_id, 'CONVITO MICHELE', 'CENTROCAMPISTA', 2002, '170', '60', false),
    ('gejci-leonardo', v_org_id, 'GEJCI LEONARDO', 'CENTROCAMPISTA', 2008, '170', '60', false),
    ('heid-fabian', v_org_id, 'EID FABIAN', 'CENTROCAMPISTA', 2007, '170', '60', false),
    ('mennini-lorenzo', v_org_id, 'MENNINI LORENZO', 'CENTROCAMPISTA', 2000, '170', '60', false),
    ('paccaduscio-andrea', v_org_id, 'PACCADUSCIO ANDREA', 'CENTROCAMPISTA', 2006, '170', '60', false),
    ('paradisi-filippo', v_org_id, 'PARADISI FILIPPO', 'CENTROCAMPISTA', 1998, '170', '60', false),
    ('polidoro-federico', v_org_id, 'POLIDORO FEDERICO', 'CENTROCAMPISTA', 2002, '170', '60', false),
    ('roticiani-tommaso', v_org_id, 'ROTICIANI TOMMASO', 'CENTROCAMPISTA', 2008, '170', '60', false),
    ('salvucci-thomas', v_org_id, 'SALVUCCI THOMAS', 'CENTROCAMPISTA', 1998, '170', '60', false),
    ('sisani-alessio', v_org_id, 'SISANI ALESSIO', 'CENTROCAMPISTA', 2007, '170', '60', false),
    ('antognoni-nicola', v_org_id, 'ANTOGNONI NICOLA', 'ATTACCANTE', 2004, '170', '60', false),
    ('vinciarelli-daniele', v_org_id, 'VINCIARELLI DANIELE', 'ATTACCANTE', 2002, '170', '60', false),
    ('nuti-francesco', v_org_id, 'NUTI FRANCESCO', 'ATTACCANTE', 2006, '170', '60', false),
    ('mariotti-francesco', v_org_id, 'MARIOTTI FRANCESCO', 'ATTACCANTE', 2006, '170', '60', false),
    ('massetti-giovanni', v_org_id, 'MASSETTI GIOVANNI', 'ATTACCANTE', 2007, '170', '60', false),
    ('mantovani-filippo', v_org_id, 'MANTOVANI FILIPPO', 'ATTACCANTE', 2008, '170', '60', false),
    ('bolletta-marco', v_org_id, 'BOLLETTA MARCO', 'DIFENSORE', 1993, '170', '60', true),
    ('ravanelli-carlo', v_org_id, 'RAVANELLI CARLO', 'ATTACCANTE', 2005, '170', '60', true),
    ('gazzani-michele', v_org_id, 'GAZZANI MICHELE', 'ATTACCANTE', 2005, '170', '60', true),
    ('bertini-lorenzo', v_org_id, 'BERTINI LORENZO', 'CENTROCAMPISTA', 2006, '170', '60', true)
  on conflict (id) do nothing;
end $$;
