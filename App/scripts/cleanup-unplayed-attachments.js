#!/usr/bin/env node
//
// Una tantum: rimuove gli screenshot "Formazioni" allegati per errore a partite non ancora
// giocate (bug del primo giro di sync-tuttocampo.js, corretto il 2026-10-01 — lo screenshot
// scattava anche quando #match_formations esisteva ma era ancora vuota). Non più necessario dopo
// questa pulizia: le esecuzioni successive di sync-tuttocampo.js non ricreano più il problema.
//
// Stesse variabili d'ambiente di sync-tuttocampo.js (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).
const { createClient } = require('@supabase/supabase-js');

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Variabile d'ambiente mancante: ${name}`);
    process.exit(1);
  }
  return v;
}

const SUPABASE_URL = requireEnv('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
const ATTACHMENTS_BUCKET = 'matchday-attachments';

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data: fixtures, error: fixturesError } = await supabase
    .from('matchday_fixtures')
    .select('id, home_team, away_team, home_score, away_score')
    .eq('source', 'tuttocampo')
    .or('home_score.is.null,away_score.is.null');
  if (fixturesError) throw fixturesError;

  if (!fixtures || fixtures.length === 0) {
    console.log('Nessuna partita senza risultato trovata.');
    return;
  }

  let removed = 0;
  for (const f of fixtures) {
    const { data: attachments, error: attError } = await supabase
      .from('matchday_fixture_attachments')
      .select('id, storage_path')
      .eq('fixture_id', f.id);
    if (attError) {
      console.warn(`${f.home_team} - ${f.away_team}: errore lettura allegati (${attError.message})`);
      continue;
    }
    for (const att of attachments ?? []) {
      const { error: storageError } = await supabase.storage
        .from(ATTACHMENTS_BUCKET)
        .remove([att.storage_path]);
      if (storageError) {
        console.warn(`  ${f.home_team} - ${f.away_team}: errore rimozione file (${storageError.message})`);
        continue;
      }
      const { error: delError } = await supabase.from('matchday_fixture_attachments').delete().eq('id', att.id);
      if (delError) {
        console.warn(`  ${f.home_team} - ${f.away_team}: errore rimozione riga (${delError.message})`);
        continue;
      }
      removed++;
      console.log(`Rimosso allegato di ${f.home_team} - ${f.away_team} (partita non ancora giocata)`);
    }
  }

  console.log(`\nFatto. Allegati rimossi: ${removed}.`);
}

main().catch((err) => {
  console.error('Pulizia fallita:', err);
  process.exit(1);
});
