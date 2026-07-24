// Genera una presentazione HTML a slide (autonoma, senza dipendenze) a partire dal file
// .json di un report "Analisi Avversario" prodotto dallo skill report-avversario.
//
// Uso:
//   node genera-slide.js <percorso-report.json> [percorso-output.html]
//
// Se l'output non è indicato, viene creato nella stessa cartella del file .json con nome
// "Slide - <Avversario>.html".
const fs = require('fs');
const path = require('path');

const SRC = process.argv[2];
if (!SRC) {
  console.error('Uso: node genera-slide.js <percorso-report.json> [percorso-output.html]');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(SRC, 'utf-8'));

const OUT = process.argv[3] || path.join(
  path.dirname(SRC),
  `Slide - ${(data.meta.opponent || 'Report').replace(/[\\/:*?"<>|]/g, '')}.html`
);

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function md(s) {
  const e = esc(s);
  return e.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

function paras(s) {
  return String(s ?? '')
    .split(/\n\n+/)
    .map(p => `<p>${md(p.trim())}</p>`)
    .join('\n');
}

function stripImgNote(cap) {
  return md(String(cap ?? '').replace(/\s*—\s*inserire immagine\.?$/i, '.'));
}

function parseResult(line) {
  const m = line.match(/^(.*?)\s+(\d+)\s*-\s*(\d+)\s+(.*)$/);
  if (!m) return { raw: esc(line) };
  const [, t1, s1, s2, t2] = m;
  const isT1Terni = /terni/i.test(t1);
  const isT2Terni = /terni/i.test(t2);
  const terniScore = isT1Terni ? +s1 : +s2;
  const oppScore = isT1Terni ? +s2 : +s1;
  let outcome = 'draw';
  if (terniScore > oppScore) outcome = 'win';
  else if (terniScore < oppScore) outcome = 'loss';
  return { t1: esc(t1.trim()), s1, s2, t2: esc(t2.trim()), isT1Terni, isT2Terni, outcome };
}

const results = data.presentation.lastResults.map(parseResult);
const outcomeLabel = { win: 'V', draw: 'N', loss: 'P' };

function placeholderImage(label) {
  return `
      <div class="img-placeholder">
        <div class="ph-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10.5" r="1.6"/><path d="M21 16.5l-5.3-5.3a2 2 0 0 0-2.8 0L4 20"/></svg>
        </div>
        <p class="ph-label">${label ? stripImgNote(label) : 'Schema tattico &mdash; immagine da inserire'}</p>
      </div>`;
}

// ---- slide builders ----

function slideCover() {
  return `
  <section class="slide cover" data-section="cover">
    <div class="pitch-lines" aria-hidden="true"></div>
    <div class="cover-inner">
      <div class="cover-logos">
        <img src="${data.crestLogo}" alt="" class="crest" />
      </div>
      <p class="eyebrow">${esc(data.meta.title)}</p>
      <h1 class="cover-title">${esc(data.meta.opponent)}</h1>
      <p class="cover-sub">${esc(data.meta.competition)}</p>
      <div class="cover-foot">
        <img src="${data.agencyLogo}" alt="" class="agency" />
      </div>
    </div>
  </section>`;
}

function slidePresentazione1() {
  return `
  <section class="slide" data-section="presentazione">
    <header class="slide-head">
      <p class="eyebrow">Presentazione &middot; Sistema di gioco</p>
      <h2>Come gioca il Terni FC</h2>
    </header>
    <div class="content one-col">
      <div class="tactic-chip">${esc(data.presentation.system)}</div>
      <div class="prose">${paras(data.presentation.narrative)}</div>
    </div>
  </section>`;
}

function slidePresentazione2() {
  const scorers = data.presentation.scorers;
  return `
  <section class="slide" data-section="presentazione">
    <header class="slide-head">
      <p class="eyebrow">Presentazione &middot; Rendimento</p>
      <h2>Ultimi risultati e marcatori</h2>
    </header>
    <div class="content two-col">
      <div class="panel">
        <h3 class="panel-title">Ultime 4 giornate</h3>
        <ul class="results-list">
          ${results.map(r => r.raw ? `<li class="result-row"><span>${r.raw}</span></li>` : `
          <li class="result-row outcome-${r.outcome}">
            <span class="badge">${outcomeLabel[r.outcome]}</span>
            <span class="team ${r.isT1Terni ? 'is-terni' : ''}" title="${r.t1}">${r.t1}</span>
            <span class="score">${r.s1} &ndash; ${r.s2}</span>
            <span class="team ${r.isT2Terni ? 'is-terni' : ''}" title="${r.t2}">${r.t2}</span>
          </li>`).join('\n')}
        </ul>
        <div class="stat-pair">
          <div class="stat"><span class="stat-num">${esc(data.presentation.goalsFor)}</span><span class="stat-label">Gol fatti</span></div>
          <div class="stat"><span class="stat-num">${esc(data.presentation.goalsAgainst)}</span><span class="stat-label">Gol subiti</span></div>
        </div>
      </div>
      <div class="panel">
        <h3 class="panel-title">Marcatori stagionali</h3>
        <ol class="scorers-list">
          ${scorers.map((s, i) => `<li class="${i === 0 ? 'top' : ''}"><span class="rank">${i + 1}</span><span class="name">${esc(s.name)}</span><span class="goals">${esc(s.goals)}</span></li>`).join('\n')}
        </ol>
      </div>
    </div>
  </section>`;
}

function slidePresentazione3() {
  return `
  <section class="slide" data-section="presentazione">
    <header class="slide-head">
      <p class="eyebrow">Presentazione &middot; Valutazione</p>
      <h2>Punti di forza e punti deboli</h2>
    </header>
    <div class="content two-col">
      <div class="panel panel-good">
        <h3 class="panel-title">Punti di forza</h3>
        <div class="prose">${paras(data.strengths)}</div>
      </div>
      <div class="panel panel-bad">
        <h3 class="panel-title">Punti deboli</h3>
        <div class="prose">${paras(data.weaknesses)}</div>
      </div>
    </div>
  </section>`;
}

function slidePossesso1() {
  const p = data.possession.intro.split(/\n\n+/);
  return `
  <section class="slide" data-section="possesso">
    <header class="slide-head">
      <p class="eyebrow">Fase di possesso &middot; 1/3</p>
      <h2>Costruzione dal basso</h2>
    </header>
    <div class="content one-col">
      <div class="tactic-chip">Assetto: 1-3-4-3 in costruzione (Mattia si abbassa tra i centrali)</div>
      <div class="prose">${md(p[0].trim())}</div>
    </div>
  </section>`;
}

function slidePossesso2() {
  const p = data.possession.intro.split(/\n\n+/);
  return `
  <section class="slide" data-section="possesso">
    <header class="slide-head">
      <p class="eyebrow">Fase di possesso &middot; 2/3</p>
      <h2>Uscita dal recupero palla</h2>
    </header>
    <div class="content one-col">
      <div class="prose">${md(p[1].trim())}</div>
      <div class="two-path">
        <div class="path-card">
          <p class="path-label">Opzione A &middot; Attacco diretto</p>
          <p>Lancio lungo a ricercare la velocit&agrave; di <strong>Bertaina</strong> o <strong>Principi</strong> in profondit&agrave;.</p>
        </div>
        <div class="path-card">
          <p class="path-label">Opzione B &middot; Riorganizzazione</p>
          <p>Palla su <strong>Giacomelli</strong> o <strong>Mattia</strong>, con i terzini che si allargano sulle corsie.</p>
        </div>
      </div>
    </div>
  </section>`;
}

function slidePossesso3() {
  return `
  <section class="slide" data-section="possesso">
    <header class="slide-head">
      <p class="eyebrow">Fase di possesso &middot; 3/3</p>
      <h2>Moduli osservati nelle ultime uscite</h2>
    </header>
    <div class="content">
      <div class="img-grid three">
        ${data.possession.blocks.map(b => `
        <figure class="img-card">
          <div class="img-frame"><img src="${b.image}" alt="" /></div>
          <figcaption>${md(b.caption)}</figcaption>
        </figure>`).join('\n')}
      </div>
    </div>
  </section>`;
}

function slidePressing1() {
  const p = data.nonPossession.intro.split(/\n\n+/);
  return `
  <section class="slide" data-section="pressing">
    <header class="slide-head">
      <p class="eyebrow">Fuori possesso &middot; 1/3</p>
      <h2>Pressing alto: chi partecipa</h2>
    </header>
    <div class="content one-col">
      <div class="prose">${md(p[0].trim())}</div>
      <div class="callout">${stripImgNote(data.nonPossession.blocks[0].caption)}</div>
    </div>
  </section>`;
}

function slidePressing2() {
  const p = data.nonPossession.intro.split(/\n\n+/);
  return `
  <section class="slide" data-section="pressing">
    <header class="slide-head">
      <p class="eyebrow">Fuori possesso &middot; 2/3</p>
      <h2>Evoluzione stagionale del pressing</h2>
    </header>
    <div class="content one-col">
      <div class="prose">${md(p[1].trim())}</div>
      <div class="callout">${stripImgNote(data.nonPossession.blocks[1].caption)}</div>
    </div>
  </section>`;
}

function slidePressing3() {
  return `
  <section class="slide" data-section="pressing">
    <header class="slide-head">
      <p class="eyebrow">Fuori possesso &middot; 3/3</p>
      <h2>Sintesi dei ruoli in non possesso</h2>
    </header>
    <div class="content">
      <div class="role-grid">
        <div class="role-card role-press">
          <p class="role-title">Aggrediscono con continuit&agrave;</p>
          <p class="role-names">Principi &middot; Bruschi &middot; Bertaina &middot; Pucci</p>
        </div>
        <div class="role-card role-mid">
          <p class="role-title">Lavora meno in fase difensiva</p>
          <p class="role-names">Giacomelli</p>
        </div>
        <div class="role-card role-deep">
          <p class="role-title">Resta sempre basso, garantisce equilibrio</p>
          <p class="role-names">Mattia</p>
        </div>
      </div>
    </div>
  </section>`;
}

// ---- calci piazzati: one slide per bullet, with an image placeholder ----

const spf = data.setPiecesFor.bullets;
const spa = data.setPiecesAgainst.bullets;

const piazzatiConfig = [
  { side: 'favore', cat: 'Angoli', title: 'Disposizione in area sui corner', text: spf[0], note: data.setPiecesFor.blocks[0].caption },
  { side: 'favore', cat: 'Angoli', title: 'Scambio sul primo palo', text: spf[1], note: data.setPiecesFor.blocks[0].caption },
  { side: 'favore', cat: 'Angoli', title: 'Uomini da tenere d’occhio', text: spf[2], note: data.setPiecesFor.blocks[0].caption },
  { side: 'favore', cat: 'Punizioni laterali', title: 'Stessa disposizione degli angoli', text: spf[3], note: data.setPiecesFor.blocks[1].caption },
  { side: 'contro', cat: 'Punizioni laterali', title: 'Difesa a zona con linea alta', text: spa[0], note: data.setPiecesAgainst.blocks[0].caption },
  { side: 'contro', cat: 'Angoli', title: 'Marcatura mista', text: spa[1], note: data.setPiecesAgainst.blocks[1].caption },
  { side: 'contro', cat: 'Angoli', title: 'Vulnerabilità sulla seconda palla', text: spa[2], note: data.setPiecesAgainst.blocks[1].caption },
];

const piazzatiSlides = piazzatiConfig.map((cfg, i) => `
  <section class="slide" data-section="piazzati">
    <header class="slide-head">
      <p class="eyebrow">Calci piazzati &middot; ${cfg.side === 'favore' ? 'A favore' : 'Contro'} &middot; ${esc(cfg.cat)} &middot; ${i + 1}/${piazzatiConfig.length}</p>
      <h2>${esc(cfg.title)}</h2>
    </header>
    <div class="content piazzato-content">
      <p class="statement">${md(cfg.text)}</p>
      ${placeholderImage(cfg.note)}
    </div>
  </section>`);

const slides = [
  slideCover(),
  slidePresentazione1(),
  slidePresentazione2(),
  slidePresentazione3(),
  slidePossesso1(),
  slidePossesso2(),
  slidePossesso3(),
  slidePressing1(),
  slidePressing2(),
  slidePressing3(),
  ...piazzatiSlides,
];

const sectionMeta = {
  cover: { label: 'Copertina' },
  presentazione: { label: 'Presentazione' },
  possesso: { label: 'Possesso palla' },
  pressing: { label: 'Fuori possesso' },
  piazzati: { label: 'Calci piazzati' },
};

const html = `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8" />
<title>Analisi Avversario &middot; ${esc(data.meta.opponent)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
:root {
  --bg: #14120f;
  --surface: #1c1a16;
  --surface-2: #242019;
  --line: #38332b;
  --ink: #f3efe7;
  --ink-dim: #b8ae9c;
  --accent: #e2a53a;
  --accent-ink: #1c1a16;
  --good: #6fae6a;
  --bad: #d97a5a;
  --shadow: 0 20px 60px rgba(0,0,0,0.45);
}
@media (prefers-color-scheme: light) {
  :root {
    --bg: #f6f3ec; --surface: #ffffff; --surface-2: #efe9dd; --line: #ddd4c2;
    --ink: #221f1a; --ink-dim: #5c5647; --accent: #b8791f; --accent-ink: #fbf6ea;
    --good: #3f7a3a; --bad: #a8442a;
    --shadow: 0 16px 40px rgba(60,50,30,0.12);
  }
}
:root[data-theme="dark"] {
  --bg: #14120f; --surface: #1c1a16; --surface-2: #242019; --line: #38332b;
  --ink: #f3efe7; --ink-dim: #b8ae9c; --accent: #e2a53a; --accent-ink: #1c1a16;
  --good: #6fae6a; --bad: #d97a5a;
  --shadow: 0 20px 60px rgba(0,0,0,0.45);
}
:root[data-theme="light"] {
  --bg: #f6f3ec; --surface: #ffffff; --surface-2: #efe9dd; --line: #ddd4c2;
  --ink: #221f1a; --ink-dim: #5c5647; --accent: #b8791f; --accent-ink: #fbf6ea;
  --good: #3f7a3a; --bad: #a8442a;
  --shadow: 0 16px 40px rgba(60,50,30,0.12);
}

* { box-sizing: border-box; }
html, body {
  margin: 0; padding: 0; height: 100%; width: 100%;
  background: var(--bg); color: var(--ink);
  font-family: -apple-system, "Segoe UI", "Helvetica Neue", Arial, sans-serif;
  overflow: hidden;
}
strong { color: var(--accent); font-weight: 700; }

.deck { position: relative; width: 100vw; height: 100vh; overflow: hidden; }
.track {
  display: flex; height: 100%; width: max-content;
  transition: transform 0.5s cubic-bezier(.65,0,.35,1);
  will-change: transform;
}
@media (prefers-reduced-motion: reduce) { .track { transition: none; } }

.slide {
  position: relative;
  width: 100vw; height: 100vh;
  flex: 0 0 100vw;
  display: flex;
  flex-direction: column;
  padding: clamp(18px, 3.6vh, 50px) clamp(26px, 6vw, 90px);
  overflow: hidden;
}

.eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.13em;
  font-size: clamp(10.5px, 1.5vh, 12.5px);
  font-weight: 700;
  color: var(--accent);
  margin: 0 0 clamp(6px, 1vh, 10px);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.slide-head { flex: 0 0 auto; margin-bottom: clamp(10px, 2.4vh, 26px); min-width: 0; }
.slide-head h2 {
  margin: 0;
  font-size: clamp(20px, 4.2vh, 38px);
  font-weight: 900;
  letter-spacing: -0.01em;
  text-wrap: balance;
  border-bottom: 3px solid var(--line);
  padding-bottom: clamp(8px, 1.4vh, 14px);
}

.content { flex: 1 1 auto; min-height: 0; display: flex; overflow: hidden; }
.content.one-col { flex-direction: column; gap: clamp(12px, 2.2vh, 22px); max-width: 920px; }
.content.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: clamp(16px, 2.4vw, 28px); width: 100%; height: 100%; align-items: stretch; }

.prose { min-height: 0; overflow: hidden; }
.prose p { margin: 0 0 clamp(7px, 1.3vh, 14px); font-size: clamp(13.5px, 2.15vh, 19px); line-height: 1.5; max-width: 70ch; }
.prose p:last-child { margin-bottom: 0; }

.tactic-chip {
  display: inline-block;
  align-self: flex-start;
  background: var(--surface-2);
  border: 1px solid var(--line);
  color: var(--ink);
  font-weight: 700;
  font-size: clamp(12px, 1.6vh, 15px);
  padding: clamp(6px, 1vh, 8px) clamp(12px, 1.6vw, 16px);
  border-radius: 5px;
}

.panel {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: clamp(12px, 2.2vh, 22px) clamp(14px, 1.8vw, 24px);
  box-shadow: var(--shadow);
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}
.panel-title {
  margin: 0 0 clamp(8px, 1.4vh, 14px);
  font-size: clamp(11px, 1.3vh, 13px);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--ink-dim);
  font-weight: 700;
  flex: 0 0 auto;
}
.panel-good { border-top: 4px solid var(--good); }
.panel-good .panel-title { color: var(--good); }
.panel-bad { border-top: 4px solid var(--bad); }
.panel-bad .panel-title { color: var(--bad); }
.panel-good .prose p, .panel-bad .prose p { max-width: none; font-size: clamp(12px, 1.7vh, 16.5px); }

.results-list { list-style: none; margin: 0 0 clamp(10px, 1.8vh, 20px); padding: 0; display: flex; flex-direction: column; gap: clamp(5px, 0.9vh, 8px); flex: 0 0 auto; }
.result-row {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  font-size: clamp(11px, 1.5vh, 14.5px);
  padding: clamp(5px, 0.9vh, 8px) 10px;
  border-radius: 6px;
  background: var(--surface-2);
}
.result-row .badge {
  width: 20px; height: 20px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 10.5px; font-weight: 800; color: var(--accent-ink);
  background: var(--ink-dim);
  flex: 0 0 auto;
}
.result-row.outcome-win .badge { background: var(--good); }
.result-row.outcome-loss .badge { background: var(--bad); }
.result-row.outcome-draw .badge { background: var(--accent); }
.result-row .team {
  color: var(--ink-dim);
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.result-row .team.is-terni { color: var(--ink); font-weight: 700; }
.result-row .team:last-child { text-align: right; }
.result-row .score {
  font-variant-numeric: tabular-nums;
  font-family: ui-monospace, "Cascadia Code", "SF Mono", Consolas, monospace;
  font-weight: 700;
  text-align: center;
  white-space: nowrap;
}

.stat-pair { display: flex; gap: clamp(16px, 2.4vw, 28px); padding-top: clamp(6px, 1vh, 10px); border-top: 1px solid var(--line); margin-top: auto; flex: 0 0 auto; }
.stat { display: flex; flex-direction: column; }
.stat-num {
  font-variant-numeric: tabular-nums;
  font-family: ui-monospace, "Cascadia Code", "SF Mono", Consolas, monospace;
  font-size: clamp(20px, 3.8vh, 34px); font-weight: 800; color: var(--accent); line-height: 1;
}
.stat-label { font-size: clamp(10px, 1.2vh, 12px); color: var(--ink-dim); text-transform: uppercase; letter-spacing: 0.08em; margin-top: 4px; }

.scorers-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: clamp(2px, 0.5vh, 5px); flex: 1 1 auto; min-height: 0; overflow: hidden; justify-content: space-between; }
.scorers-list li {
  display: grid;
  grid-template-columns: 20px minmax(0,1fr) auto;
  gap: 8px;
  align-items: center;
  font-size: clamp(10.5px, 1.45vh, 14.5px);
  padding: clamp(3px, 0.6vh, 7px) 10px;
  border-radius: 6px;
}
.scorers-list li.top { background: var(--surface-2); border: 1px solid var(--accent); }
.scorers-list .name { min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.scorers-list .rank { color: var(--ink-dim); font-variant-numeric: tabular-nums; font-size: 11px; }
.scorers-list .goals {
  font-variant-numeric: tabular-nums;
  font-family: ui-monospace, "Cascadia Code", "SF Mono", Consolas, monospace;
  font-weight: 700; color: var(--accent);
  white-space: nowrap;
}

.two-path { display: grid; grid-template-columns: 1fr 1fr; gap: clamp(10px, 1.8vh, 18px); max-width: 920px; }
.path-card { background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: clamp(12px, 2vh, 18px) clamp(14px, 1.8vw, 20px); }
.path-card p { margin: 0; font-size: clamp(12.5px, 1.8vh, 15px); line-height: 1.5; }
.path-label { font-weight: 800; color: var(--accent); text-transform: uppercase; letter-spacing: 0.06em; font-size: 11.5px; margin-bottom: 8px !important; }

.callout {
  border-left: 3px solid var(--accent);
  background: var(--surface-2);
  padding: clamp(8px, 1.4vh, 12px) 18px;
  border-radius: 0 8px 8px 0;
  font-size: clamp(12px, 1.6vh, 14.5px);
  line-height: 1.5;
  color: var(--ink-dim);
  max-width: 920px;
  flex: 0 0 auto;
}

.img-grid { display: grid; gap: clamp(12px, 2vh, 20px); width: 100%; height: 100%; }
.img-grid.three { grid-template-columns: repeat(3, 1fr); }
.img-card {
  margin: 0;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 10px;
  overflow: hidden;
  box-shadow: var(--shadow);
  display: flex; flex-direction: column;
  min-height: 0;
}
.img-frame { flex: 1 1 auto; min-height: 0; background: var(--surface-2); display: flex; }
.img-card img { width: 100%; height: 100%; object-fit: contain; display: block; }
.img-card figcaption { flex: 0 0 auto; padding: clamp(8px, 1.2vh, 12px) 14px; font-size: clamp(10.5px, 1.3vh, 13px); line-height: 1.4; color: var(--ink-dim); }

.role-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: clamp(12px, 2vh, 20px); width: 100%; align-content: center; height: 100%; }
.role-card { background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: clamp(16px, 2.4vh, 24px) 22px; border-top: 4px solid var(--line); display: flex; flex-direction: column; justify-content: center; }
.role-card.role-press { border-top-color: var(--bad); }
.role-card.role-mid { border-top-color: var(--accent); }
.role-card.role-deep { border-top-color: var(--good); }
.role-title { margin: 0 0 10px; font-size: 12.5px; color: var(--ink-dim); text-transform: uppercase; letter-spacing: 0.06em; font-weight: 700; }
.role-names { margin: 0; font-size: clamp(15px, 2.2vh, 19px); font-weight: 800; }

.bullet-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: clamp(8px, 1.6vh, 14px); max-width: 920px; }
.bullet-list li { position: relative; padding-left: 22px; font-size: clamp(13px, 2vh, 18px); line-height: 1.5; }
.bullet-list li::before { content: ""; position: absolute; left: 0; top: 9px; width: 8px; height: 8px; border-radius: 50%; background: var(--accent); }

/* calci piazzati: statement + image placeholder */
.piazzato-content { flex-direction: column; gap: clamp(14px, 2.2vh, 22px); max-width: 1020px; width: 100%; }
.statement {
  flex: 0 0 auto;
  margin: 0;
  font-size: clamp(15px, 2.6vh, 21px);
  line-height: 1.5;
  font-weight: 600;
}
.img-placeholder {
  flex: 1 1 auto;
  min-height: 0;
  border: 2px dashed var(--line);
  border-radius: 12px;
  background: var(--surface-2);
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 10px;
  color: var(--ink-dim);
}
.img-placeholder .ph-icon { opacity: 0.55; }
.img-placeholder .ph-label { margin: 0; font-size: clamp(12px, 1.6vh, 14.5px); text-align: center; max-width: 62ch; padding: 0 24px; line-height: 1.5; }

/* cover */
.cover { align-items: center; justify-content: center; text-align: center; background: radial-gradient(ellipse at 50% 30%, var(--surface-2), var(--bg) 70%); }
.pitch-lines { position: absolute; inset: 0; pointer-events: none; opacity: 0.5; }
.pitch-lines::before { content: ""; position: absolute; top: 50%; left: 8%; right: 8%; height: 1px; background: var(--line); }
.pitch-lines::after {
  content: ""; position: absolute; top: 50%; left: 50%;
  width: clamp(140px,20vh,300px); height: clamp(140px,20vh,300px);
  border: 1px solid var(--line); border-radius: 50%;
  transform: translate(-50%, -50%);
}
.cover-inner { position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; gap: 8px; }
.cover-logos { margin-bottom: 6px; }
.cover .crest { height: clamp(56px, 11vh, 96px); width: auto; }
.cover-title { margin: 6px 0 0; font-size: clamp(38px, 9vh, 96px); font-weight: 900; letter-spacing: -0.02em; text-transform: uppercase; }
.cover-sub { margin: 4px 0 0; color: var(--ink-dim); font-size: clamp(13px, 2vh, 18px); }
.cover-foot { margin-top: clamp(20px, 6vh, 60px); opacity: 0.85; }
.cover .agency { height: clamp(24px, 4vh, 34px); width: auto; }

/* nav chrome */
.progress { position: fixed; top: 0; left: 0; right: 0; height: 4px; background: var(--line); z-index: 10; }
.progress-bar { height: 100%; background: var(--accent); transition: width 0.4s ease; }

.hud {
  position: fixed; left: 0; right: 0; bottom: 0;
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px clamp(18px, 3.6vw, 44px);
  z-index: 10;
  pointer-events: none;
}
.hud > * { pointer-events: auto; }
.counter {
  font-family: ui-monospace, "Cascadia Code", "SF Mono", Consolas, monospace;
  font-size: 12.5px; color: var(--ink-dim);
  background: color-mix(in srgb, var(--bg) 70%, transparent);
  padding: 6px 12px; border-radius: 20px;
  border: 1px solid var(--line);
  white-space: nowrap;
}
.counter .sec { color: var(--accent); font-weight: 700; }

.nav-btns { display: flex; gap: 8px; flex: 0 0 auto; }
.nav-btn {
  width: 38px; height: 38px; border-radius: 50%;
  border: 1px solid var(--line); background: var(--surface);
  color: var(--ink); font-size: 16px; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: background 0.15s, transform 0.15s;
}
.nav-btn:hover { background: var(--surface-2); }
.nav-btn:active { transform: scale(0.94); }
.nav-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.nav-btn[disabled] { opacity: 0.3; cursor: default; }

.jump-toggle {
  border: 1px solid var(--line); background: var(--surface);
  color: var(--ink); border-radius: 20px; padding: 7px 15px;
  font-size: 12.5px; font-weight: 700; cursor: pointer;
  text-transform: uppercase; letter-spacing: 0.06em;
}
.jump-toggle:hover { background: var(--surface-2); }
.jump-toggle:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

.jump-panel {
  position: fixed; bottom: 64px; left: 50%; transform: translateX(-50%) translateY(12px);
  background: var(--surface); border: 1px solid var(--line); border-radius: 12px;
  box-shadow: var(--shadow);
  padding: 10px; display: flex; gap: 4px;
  z-index: 20; opacity: 0; pointer-events: none;
  transition: opacity 0.18s ease, transform 0.18s ease;
  max-width: 90vw; overflow-x: auto;
}
.jump-panel.open { opacity: 1; pointer-events: auto; transform: translateX(-50%) translateY(0); }
.jump-item {
  background: transparent; border: none; color: var(--ink-dim);
  font-size: 12.5px; font-weight: 700; padding: 8px 14px; border-radius: 8px; cursor: pointer;
  text-transform: uppercase; letter-spacing: 0.04em; white-space: nowrap;
}
.jump-item:hover { background: var(--surface-2); color: var(--ink); }
.jump-item.active { color: var(--accent-ink); background: var(--accent); }

@media (max-width: 900px) {
  .content.two-col, .two-path, .img-grid.three, .role-grid { grid-template-columns: 1fr; height: auto; }
  .content.two-col { overflow-y: hidden; }
}
</style>
</head>
<body>
<div class="progress"><div class="progress-bar" id="progressBar"></div></div>

<div class="deck">
  <div class="track" id="track">
    ${slides.join('\n')}
  </div>
</div>

<div class="hud">
  <div class="counter" id="counter"></div>
  <button class="jump-toggle" id="jumpToggle" aria-haspopup="true" aria-expanded="false">Sezioni</button>
  <div class="nav-btns">
    <button class="nav-btn" id="prevBtn" aria-label="Slide precedente">&#8592;</button>
    <button class="nav-btn" id="nextBtn" aria-label="Slide successiva">&#8594;</button>
  </div>
</div>

<div class="jump-panel" id="jumpPanel"></div>

<script>
(function () {
  var slides = Array.prototype.slice.call(document.querySelectorAll('.slide'));
  var track = document.getElementById('track');
  var counter = document.getElementById('counter');
  var progressBar = document.getElementById('progressBar');
  var prevBtn = document.getElementById('prevBtn');
  var nextBtn = document.getElementById('nextBtn');
  var jumpToggle = document.getElementById('jumpToggle');
  var jumpPanel = document.getElementById('jumpPanel');
  var sectionMeta = ${JSON.stringify(sectionMeta)};
  var current = 0;

  var firstIndexOfSection = {};
  slides.forEach(function (s, i) {
    var sec = s.getAttribute('data-section');
    if (!(sec in firstIndexOfSection)) firstIndexOfSection[sec] = i;
  });
  Object.keys(firstIndexOfSection).forEach(function (sec) {
    var btn = document.createElement('button');
    btn.className = 'jump-item';
    btn.textContent = sectionMeta[sec] ? sectionMeta[sec].label : sec;
    btn.dataset.index = firstIndexOfSection[sec];
    btn.addEventListener('click', function () {
      goTo(parseInt(btn.dataset.index, 10));
      jumpPanel.classList.remove('open');
      jumpToggle.setAttribute('aria-expanded', 'false');
    });
    jumpPanel.appendChild(btn);
  });

  function update() {
    track.style.transform = 'translateX(-' + (current * 100) + 'vw)';
    var sec = slides[current].getAttribute('data-section');
    var label = sectionMeta[sec] ? sectionMeta[sec].label : sec;
    counter.innerHTML = (current + 1) + ' / ' + slides.length + '  <span class="sec">' + label + '</span>';
    progressBar.style.width = (((current + 1) / slides.length) * 100) + '%';
    prevBtn.disabled = current === 0;
    nextBtn.disabled = current === slides.length - 1;
    Array.prototype.forEach.call(jumpPanel.children, function (btn) {
      btn.classList.toggle('active', parseInt(btn.dataset.index, 10) <= current &&
        (parseInt(btn.dataset.index, 10) === current || nextSectionStart(btn) > current));
    });
  }
  function nextSectionStart(btn) {
    var idx = Array.prototype.indexOf.call(jumpPanel.children, btn);
    var nb = jumpPanel.children[idx + 1];
    return nb ? parseInt(nb.dataset.index, 10) : slides.length;
  }
  function goTo(i) {
    current = Math.max(0, Math.min(slides.length - 1, i));
    update();
  }
  prevBtn.addEventListener('click', function () { goTo(current - 1); });
  nextBtn.addEventListener('click', function () { goTo(current + 1); });
  jumpToggle.addEventListener('click', function () {
    var open = jumpPanel.classList.toggle('open');
    jumpToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  document.addEventListener('click', function (e) {
    if (!jumpPanel.contains(e.target) && e.target !== jumpToggle) {
      jumpPanel.classList.remove('open');
      jumpToggle.setAttribute('aria-expanded', 'false');
    }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { goTo(current + 1); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { goTo(current - 1); }
    else if (e.key === 'Home') { goTo(0); }
    else if (e.key === 'End') { goTo(slides.length - 1); }
    else if (e.key === 'Escape') { jumpPanel.classList.remove('open'); jumpToggle.setAttribute('aria-expanded', 'false'); }
  });

  var touchStartX = null;
  document.addEventListener('touchstart', function (e) { touchStartX = e.touches[0].clientX; }, { passive: true });
  document.addEventListener('touchend', function (e) {
    if (touchStartX === null) return;
    var dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 50) { goTo(current + (dx < 0 ? 1 : -1)); }
    touchStartX = null;
  }, { passive: true });

  update();
})();
</script>
</body>
</html>
`;

fs.writeFileSync(OUT, html, 'utf-8');
console.log('Written to', OUT, '(' + (html.length / 1024).toFixed(0) + ' KB)');
console.log('Slides:', slides.length);
