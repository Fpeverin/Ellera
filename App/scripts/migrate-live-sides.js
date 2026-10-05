#!/usr/bin/env node
//
// UNA TANTUM (2026-10-05): rimette a posto i lati casa/trasferta dei dati Live già registrati.
//
// Il bug: Live decideva "giochiamo in casa?" con `homeAway === 'HOME'`, ma il calendario salva
// 'CASA'/'TRASFERTA', quindi per ogni partita IN CASA Live ci considerava la squadra ospite: gol,
// cartellini e cambi nostri sono stati registrati con team='AWAY' (e quelli avversari con 'HOME'),
// al contrario di quanto previsto dal resto dell'app (Altre Partite, Statistiche corrette, ecc.).
// Le partite in TRASFERTA sono invece già coerenti (Live ci dava per ospiti, e lo siamo) e non
// vanno toccate.
//
// Cosa fa, per ogni partita IN CASA con dati Live:
//   1. scambia HOME<->AWAY su goals, cards e subs (dove `team` è valorizzato) di match_live, e sulle
//      proposte dei giocatori ancora "pending" (quelle già approvate/rifiutate sono già state
//      applicate ai gol);
//   2. ricalcola la riga "nostra partita" di Altre Partite (own-{id}) con la stessa formula di
//      altrePartite.tsx, così risultato e marcatori sono corretti subito;
//   3. segna l'evento con data.liveSidesFixed = true.
// PRIMA di scrivere salva un backup completo (App/logs/backup-live-sides-*.json, ignorato da git).
//
// Uso (stesse variabili d'ambiente di sync-tuttocampo.js, via run-migrate-live-sides.ps1):
//   node scripts/migrate-live-sides.js           -> prova a vuoto: mostra cosa cambierebbe, non scrive
//   node scripts/migrate-live-sides.js --apply   -> backup + scrittura
// Non rilanciare dopo il rilascio del fix: rifiuta di girare se trova eventi già segnati
// (liveSidesFixed), a meno di --force.
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Variabile d'ambiente mancante: ${name}`);
    process.exit(1);
  }
  return v;
}

const APPLY = process.argv.includes('--apply');
const FORCE = process.argv.includes('--force');
const ORG_ID = requireEnv('TEAMBOARD_ORG_ID');
const CLUB_NAME = 'Ellera';

const supabase = createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false },
});

// Stessa logica di isHomeEvent in app/data/events.ts
function isHomeEvent(ev) {
  const d = ev.data ?? {};
  if (typeof d.isHome === 'boolean') return d.isHome;
  const ha = String(d.homeAway ?? '').trim().toUpperCase();
  return !(ha === 'TRASFERTA' || ha === 'AWAY');
}

const flip = (side) => (side === 'HOME' ? 'AWAY' : side === 'AWAY' ? 'HOME' : side);
const swapTeam = (items) => (items ?? []).map((x) => (x && x.team ? { ...x, team: flip(x.team) } : x));
const count = (goals, side) => (goals ?? []).filter((g) => g.team === side).length;

async function main() {
  const { data: events, error: evErr } = await supabase
    .from('events')
    .select('id, date, opponent, data')
    .eq('org_id', ORG_ID)
    .eq('type', 'PARTITA');
  if (evErr) throw evErr;

  const alreadyFixed = events.filter((e) => e.data?.liveSidesFixed);
  if (alreadyFixed.length > 0 && !FORCE) {
    console.error(
      `Trovati ${alreadyFixed.length} eventi già segnati liveSidesFixed: la migrazione è già stata fatta. ` +
        'Nessuna modifica. (--force per ignorare, ma rischia di scambiare due volte.)'
    );
    process.exit(1);
  }

  const homeEvents = events.filter(isHomeEvent).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  console.log(`Partite in casa: ${homeEvents.length} su ${events.length}`);

  const backup = { createdAt: new Date().toISOString(), events: [], matchLive: [], proposals: [], fixtures: [] };
  const plans = [];

  for (const ev of homeEvents) {
    const { data: live, error } = await supabase
      .from('match_live')
      .select('event_id, goals, cards, subs')
      .eq('event_id', ev.id)
      .maybeSingle();
    if (error) throw error;

    const { data: props } = await supabase
      .from('match_event_proposals')
      .select('id, payload, status')
      .eq('event_id', ev.id)
      .eq('status', 'pending');

    const { data: fixture } = await supabase
      .from('matchday_fixtures')
      .select('*')
      .eq('id', `own-${ev.id}`)
      .maybeSingle();

    const goals = live?.goals ?? [];
    const cards = live?.cards ?? [];
    const subs = live?.subs ?? [];
    const hasData = goals.length + cards.length + subs.length > 0 || (props ?? []).length > 0;
    const label = `${ev.date} ${CLUB_NAME}-${ev.opponent}`;

    if (hasData) {
      console.log(
        `${label}: gol ${goals.length}, cartellini ${cards.length}, cambi ${subs.length}, proposte pending ${(props ?? []).length}` +
          ` | registrato ${count(goals, 'HOME')}-${count(goals, 'AWAY')} (casa-ospiti) -> diventa ${count(goals, 'AWAY')}-${count(goals, 'HOME')}`
      );
    } else {
      console.log(`${label}: nessun dato Live, solo marcata`);
    }
    backup.events.push({ id: ev.id, data: ev.data });
    if (live) backup.matchLive.push(live);
    if (props?.length) backup.proposals.push(...props);
    if (fixture) backup.fixtures.push(fixture);
    plans.push({ ev, live, props: props ?? [], fixture, hasData, goals, cards, subs });
  }

  if (!APPLY) {
    console.log('\nPROVA A VUOTO: nessuna modifica scritta. Rilancia con --apply per applicare.');
    return;
  }

  const logsDir = path.join(__dirname, '..', 'logs');
  fs.mkdirSync(logsDir, { recursive: true });
  const backupFile = path.join(logsDir, `backup-live-sides-${backup.createdAt.replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2), 'utf8');
  console.log(`\nBackup salvato: ${backupFile}`);

  for (const p of plans) {
    const { ev, live, props, fixture, hasData, goals, cards, subs } = p;
    if (hasData && live) {
      const newGoals = swapTeam(goals);
      const { error } = await supabase
        .from('match_live')
        .update({ goals: newGoals, cards: swapTeam(cards), subs: swapTeam(subs) })
        .eq('event_id', ev.id);
      if (error) throw new Error(`match_live ${ev.id}: ${error.message}`);

      for (const pr of props) {
        const payload = pr.payload?.team ? { ...pr.payload, team: flip(pr.payload.team) } : pr.payload;
        const { error: e2 } = await supabase.from('match_event_proposals').update({ payload }).eq('id', pr.id);
        if (e2) throw new Error(`proposta ${pr.id}: ${e2.message}`);
      }

      if (fixture) {
        // Casa = HOME: stessa formula di syncOwnFixture in altrePartite.tsx
        const scorers = newGoals
          .slice()
          .sort((a, b) => a.minute - b.minute)
          .map((g) => `${g.scorer} ${g.minute}'${g.team === 'HOME' ? '' : ` (${ev.opponent || 'Avversario'})`}`)
          .join(', ');
        const { error: e3 } = await supabase
          .from('matchday_fixtures')
          .update({ home_score: count(newGoals, 'HOME'), away_score: count(newGoals, 'AWAY'), scorers })
          .eq('id', fixture.id);
        if (e3) throw new Error(`fixture ${fixture.id}: ${e3.message}`);
      }
    }

    const { error: e4 } = await supabase
      .from('events')
      .update({ data: { ...(ev.data ?? {}), liveSidesFixed: true } })
      .eq('id', ev.id);
    if (e4) throw new Error(`evento ${ev.id}: ${e4.message}`);
    console.log(`Fatto: ${ev.date} ${CLUB_NAME}-${ev.opponent}`);
  }
  console.log('\nMigrazione completata.');
}

main().catch((err) => {
  console.error('Migrazione fallita:', err);
  process.exit(1);
});
