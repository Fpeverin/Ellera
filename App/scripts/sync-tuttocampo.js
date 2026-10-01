#!/usr/bin/env node
//
// Sincronizza "Altre Partite" con i risultati reali del girone, presi da TuttoCampo.it — eseguito
// in locale (scripts/run-sync-tuttocampo.ps1, pianificato con l'Utilita' di pianificazione di
// Windows sul PC di Francesco), NON da GitHub Actions: TuttoCampo riconosce gli IP "cloud" dei
// runner GitHub e restituisce pagine senza i dati delle partite (verificato dal vero, 2026-10-01 —
// stesso identico script, stesso Chromium: funziona in locale, trova sempre "0 partite" da GitHub
// Actions). Per ogni nostra partita (eventi tipo PARTITA) con la Competizione configurata sotto,
// trova la sua Giornata e scarica da TuttoCampo i risultati di TUTTE le squadre di quella giornata
// (tranne la nostra, già tenuta sincronizzata da Live tramite syncOwnMatchFixture in
// app/data/matchdayFixtures.ts) — squadre, risultato, marcatori, più uno screenshot della sezione
// Formazioni di ogni partita, allegato come "foto delle formazioni".
//
// Le righe create/aggiornate qui hanno sempre `source: 'tuttocampo'` — app/eventi/partita/[id]/
// altrePartite.tsx le mostra come non modificabili a mano (si aggiornano da sole ad ogni sync),
// stesso principio già in uso per la riga della nostra partita (campo `match_id`).
//
// Variabili d'ambiente richieste (vedi .env.sync-tuttocampo.example e run-sync-tuttocampo.ps1 — il
// file reale ".env.sync-tuttocampo.local" non è mai committato, vedi .gitignore):
//   SUPABASE_URL                 - stessa URL del progetto (EXPO_PUBLIC_SUPABASE_URL)
//   SUPABASE_SERVICE_ROLE_KEY    - service role key (bypassa RLS, SOLO in locale — mai nel client)
//   TEAMBOARD_ORG_ID             - uuid dell'organizzazione (squadra) su cui scrivere
//   TUTTOCAMPO_COMPETITION_NAME  - stringa ESATTA usata come "Competizione" sulle nostre partite
//                                  (es. "Campionato") — deve combaciare carattere per carattere
//   TUTTOCAMPO_LEAGUE_URL        - es. https://www.tuttocampo.it/Umbria/Eccellenza/GironeA

const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = requireEnv('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
const ORG_ID = requireEnv('TEAMBOARD_ORG_ID');
const COMPETITION_NAME = requireEnv('TUTTOCAMPO_COMPETITION_NAME');
const LEAGUE_URL = requireEnv('TUTTOCAMPO_LEAGUE_URL').replace(/\/+$/, '');

const ATTACHMENTS_BUCKET = 'matchday-attachments';

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Variabile d'ambiente mancante: ${name}`);
    process.exit(1);
  }
  return v;
}

/** "Agape Pierantonio Umbertide" -> "agape-pierantonio-umbertide" — per id deterministici stabili. */
function slug(s) {
  return String(s)
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // rimuove accenti
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function isOurTeam(name) {
  return /ellera/i.test(name);
}

/** Accetta/chiude il banner cookie di TuttoCampo se presente — non blocca se assente o già gestito. */
async function dismissCookieBanner(page) {
  try {
    const reject = page.getByRole('button', { name: /rifiut/i }).first();
    if (await reject.isVisible({ timeout: 2500 })) {
      await reject.click();
    }
  } catch {
    // banner non presente o già chiuso — nessun problema
  }
}

/** Estrae dalla pagina di una Giornata gli URL (unici) di ogni singola partita. Le righe NON sono
 * <a href>, ma <tr data-link="...URL..."> (il click è gestito via JavaScript dal sito) — un
 * selettore su `a[href]` non trova mai nulla, anche a pagina caricata correttamente. */
async function collectMatchUrls(page, giornataUrl) {
  await page.goto(giornataUrl, { waitUntil: 'networkidle' });
  await dismissCookieBanner(page);
  const links = await page.$$eval('[data-link*="/Partita/"]', (els) =>
    els.map((el) => el.getAttribute('data-link'))
  );
  return Array.from(new Set(links.filter(Boolean)));
}

/** Estrae dati di una singola partita dalla sua pagina TuttoCampo. */
async function scrapeMatch(page, url) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await dismissCookieBanner(page);

  const title = await page.title();
  const titleMatch = title.match(/^(.+?)\s+vs\s+(.+?)\s+-\s+/i);
  if (!titleMatch) return null;
  const homeTeam = titleMatch[1].trim();
  const awayTeam = titleMatch[2].trim();

  const bodyText = await page.locator('body').innerText();

  let homeScore = null;
  let awayScore = null;
  let scorers = '';
  const tabellinoMatch = bodyText.match(/Tabellino\s+.+?\s+-\s+.+?\s+(\d+)\s*-\s*(\d+)/);
  if (tabellinoMatch) {
    homeScore = Number(tabellinoMatch[1]);
    awayScore = Number(tabellinoMatch[2]);
  }
  const marcatoriMatch = bodyText.match(/MARCATORI:\s*([^\n]+)/);
  if (marcatoriMatch) {
    scorers = marcatoriMatch[1].trim();
  }

  return { url, homeTeam, awayTeam, homeScore, awayScore, scorers };
}

/** Screenshot della sezione Formazioni (#match_formations) — null se la partita non ce l'ha ancora
 * (non ancora giocata) o il sito ha cambiato struttura, senza far fallire l'intero giro. */
async function screenshotFormations(page) {
  try {
    const el = page.locator('#match_formations');
    if ((await el.count()) === 0) return null;
    await el.scrollIntoViewIfNeeded();
    return await el.screenshot({ type: 'png' });
  } catch (err) {
    console.warn('  screenshot formazioni non riuscito:', err.message);
    return null;
  }
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // 1) Le nostre partite di questa competizione -> insieme delle Giornate da controllare. Stessa
  //    colonna dinamica "data" jsonb di app/data/events.ts (competition/giornata non sono colonne
  //    reali, "date" invece sì), quindi il filtro è fatto qui in JS dopo aver letto tutte le
  //    PARTITA dell'org.
  const { data: events, error: eventsError } = await supabase
    .from('events')
    .select('id, date, data')
    .eq('org_id', ORG_ID)
    .eq('type', 'PARTITA');
  if (eventsError) throw eventsError;

  // Solo le giornate la cui nostra partita cade in una finestra di ±7 giorni da oggi (settimana
  // appena passata, per recuperare risultati non ancora arrivati, + prossima settimana) — senza
  // questo filtro lo script ricontrollava OGNI giornata della stagione a ogni esecuzione, anche
  // quelle concluse da mesi o lontanissime nel futuro, inutilmente (richiesta di Francesco,
  // 2026-10-01, dopo aver visto il primo giro completo girare su tutte le 30 giornate).
  const WINDOW_DAYS = 7;
  const todayMs = Date.now();
  const minDate = new Date(todayMs - WINDOW_DAYS * 86400000).toISOString().slice(0, 10);
  const maxDate = new Date(todayMs + WINDOW_DAYS * 86400000).toISOString().slice(0, 10);

  const giornate = Array.from(
    new Set(
      (events ?? [])
        .filter((e) => (e.data?.competition ?? '') === COMPETITION_NAME && e.data?.giornata)
        .filter((e) => e.date && e.date >= minDate && e.date <= maxDate)
        .map((e) => String(e.data.giornata))
    )
  ).filter((g) => /^\d+$/.test(g)); // TuttoCampo indicizza le giornate come numeri interi

  if (giornate.length === 0) {
    console.log(
      `Nessuna partita con Competizione "${COMPETITION_NAME}" tra ${minDate} e ${maxDate}: niente da sincronizzare oggi.`
    );
    return;
  }
  console.log(`Giornate da controllare (${minDate} .. ${maxDate}): ${giornate.join(', ')}`);

  // TuttoCampo risponde 403 Forbidden allo User-Agent di default di Playwright (bot detection) —
  // serve uno User-Agent/locale "normali" da browser desktop vero per ottenere le pagine (verificato
  // dal vero, 2026-10-01: stesso identico URL, 403 col default, 200 con questi header).
  const browser = await chromium.launch();
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
    viewport: { width: 1366, height: 900 },
    locale: 'it-IT',
    extraHTTPHeaders: { 'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7' },
  });
  const page = await context.newPage();

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const giornata of giornate) {
    const giornataUrl = `${LEAGUE_URL}/Giornata${giornata}`;
    console.log(`\nGiornata ${giornata}: ${giornataUrl}`);

    let matchUrls;
    try {
      matchUrls = await collectMatchUrls(page, giornataUrl);
    } catch (err) {
      console.warn(`  impossibile leggere la pagina della giornata: ${err.message}`);
      continue;
    }
    console.log(`  ${matchUrls.length} partite trovate`);

    for (const url of matchUrls) {
      let match;
      try {
        match = await scrapeMatch(page, url);
      } catch (err) {
        console.warn(`  ${url}: errore durante la lettura (${err.message})`);
        continue;
      }
      if (!match) {
        console.warn(`  ${url}: formato pagina inatteso, saltata`);
        continue;
      }
      if (isOurTeam(match.homeTeam) || isOurTeam(match.awayTeam)) {
        console.log(`  ${match.homeTeam} - ${match.awayTeam}: nostra partita, saltata (sync da Live)`);
        skipped++;
        continue;
      }

      const id = `tc-${slug(COMPETITION_NAME)}-${giornata}-${slug(match.homeTeam)}-${slug(match.awayTeam)}`;
      const { data: existing } = await supabase
        .from('matchday_fixtures')
        .select('id')
        .eq('id', id)
        .maybeSingle();

      const { error: upsertError } = await supabase.from('matchday_fixtures').upsert({
        id,
        org_id: ORG_ID,
        competition: COMPETITION_NAME,
        giornata,
        home_team: match.homeTeam,
        away_team: match.awayTeam,
        home_score: match.homeScore,
        away_score: match.awayScore,
        scorers: match.scorers,
        source: 'tuttocampo',
      });
      if (upsertError) {
        console.warn(`  ${match.homeTeam} - ${match.awayTeam}: errore salvataggio (${upsertError.message})`);
        continue;
      }
      existing ? updated++ : created++;
      console.log(
        `  ${match.homeTeam} ${match.homeScore ?? '-'} - ${match.awayScore ?? '-'} ${match.awayTeam}` +
          (match.scorers ? ` | ${match.scorers}` : '')
      );

      // Screenshot formazioni -> allegato, solo se la partita ha già un risultato (cioè è stata
      // giocata, almeno in parte): la sezione #match_formations esiste nella pagina ANCHE prima
      // del fischio d'inizio, ma vuota/non ancora compilata — senza questo controllo si allegava
      // uno screenshot inutile anche per partite future (visto dal vero, 2026-10-01). Sostituisce
      // quello di un sync precedente, stesso id deterministico: non si accumulano screenshot
      // vecchi a ogni esecuzione giornaliera.
      const played = match.homeScore != null && match.awayScore != null;
      const shot = played ? await screenshotFormations(page) : null;
      if (shot) {
        const attachmentId = `tc-shot-${id}`;
        const storagePath = `${ORG_ID}/${id}/formazioni.png`;
        const { error: uploadError } = await supabase.storage
          .from(ATTACHMENTS_BUCKET)
          .upload(storagePath, shot, { contentType: 'image/png', upsert: true });
        if (uploadError) {
          console.warn(`    allegato formazioni non caricato: ${uploadError.message}`);
        } else {
          const { error: attError } = await supabase.from('matchday_fixture_attachments').upsert({
            id: attachmentId,
            org_id: ORG_ID,
            fixture_id: id,
            name: 'Formazioni (TuttoCampo).png',
            storage_path: storagePath,
          });
          if (attError) console.warn(`    riga allegato non salvata: ${attError.message}`);
        }
      }
    }
  }

  await browser.close();
  console.log(`\nFatto. Nuove: ${created} · Aggiornate: ${updated} · Nostre partite saltate: ${skipped}`);
}

main().catch((err) => {
  console.error('Sincronizzazione TuttoCampo fallita:', err);
  process.exit(1);
});
