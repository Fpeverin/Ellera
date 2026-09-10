// Motore di rendering HTML condiviso: prende il modello di slide (report-model.js, la stessa
// fonte usata anche da pptx-engine.js per il PowerPoint) e restituisce la stringa HTML
// autonoma della presentazione. Usato sia da genera-slide.js (CLI Node) sia da
// genera-slide.html (tool browser, accetta .json o .pdf).
//
// Espone window.buildSlideDeckHtml nel browser e module.exports.buildSlideDeckHtml in Node.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.buildSlideDeckHtml = factory().buildSlideDeckHtml;
})(typeof self !== 'undefined' ? self : this, function () {

var buildSlideModel = (typeof module === 'object' && module.exports)
  ? require('./report-model.js').buildSlideModel
  : (typeof self !== 'undefined' ? self : this).buildSlideModel;

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

function mdParas(paragraphsArr) {
  return (paragraphsArr || []).map(p => `<p>${md(p)}</p>`).join('\n');
}

function stripImgNote(cap) {
  return md(String(cap ?? '').replace(/\s*—\s*inserire immagine\.?$/i, '.'));
}

const OUTCOME_LABEL = { win: 'V', draw: 'N', loss: 'P' };

function placeholderImage(label) {
  return `
      <div class="img-placeholder">
        <div class="ph-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10.5" r="1.6"/><path d="M21 16.5l-5.3-5.3a2 2 0 0 0-2.8 0L4 20"/></svg>
        </div>
        <p class="ph-label">${label ? stripImgNote(label) : 'Schema tattico &mdash; immagine da inserire'}</p>
      </div>`;
}

function realImage(image, caption) {
  return `
      <figure class="piazzato-image-card">
        <div class="img-frame"><img src="${image}" alt="" /></div>
        ${caption ? `<figcaption>${md(caption)}</figcaption>` : ''}
      </figure>`;
}

// ---- render di una singola slide del modello -> HTML ----

function renderCover(s) {
  return `
  <section class="slide cover" data-section="cover">
    <div class="pitch-lines" aria-hidden="true"></div>
    <div class="cover-inner">
      <div class="cover-logos">
        <img src="${s.crestLogo}" alt="" class="crest" />
      </div>
      <p class="eyebrow">${esc(s.title)}</p>
      <h1 class="cover-title">${esc(s.opponent)}</h1>
      <p class="cover-sub">${esc(s.competition)}</p>
      <div class="cover-foot">
        <img src="${s.agencyLogo}" alt="" class="agency" />
      </div>
    </div>
  </section>`;
}

function renderProse(s) {
  return `
  <section class="slide" data-section="${s.section}">
    <header class="slide-head">
      <p class="eyebrow">${esc(s.eyebrow)}</p>
      <h2>${esc(s.heading)}</h2>
    </header>
    <div class="content one-col">
      ${s.chip ? `<div class="tactic-chip">${esc(s.chip)}</div>` : ''}
      <div class="prose">${mdParas(s.paragraphs)}</div>
    </div>
  </section>`;
}

function renderResultsScorers(s) {
  return `
  <section class="slide" data-section="${s.section}">
    <header class="slide-head">
      <p class="eyebrow">${esc(s.eyebrow)}</p>
      <h2>${esc(s.heading)}</h2>
    </header>
    <div class="content two-col">
      <div class="panel">
        <h3 class="panel-title">Ultimi risultati</h3>
        <ul class="results-list">
          ${s.results.map(r => r.raw ? `<li class="result-row"><span>${esc(r.raw)}</span></li>` : `
          <li class="result-row outcome-${r.outcome}">
            <span class="badge">${OUTCOME_LABEL[r.outcome]}</span>
            <span class="team ${r.isT1Terni ? 'is-terni' : ''}" title="${esc(r.t1)}">${esc(r.t1)}</span>
            <span class="score">${r.s1} &ndash; ${r.s2}${r.note ? ` <span class="note-tag">${esc(r.note)}</span>` : ''}</span>
            <span class="team ${r.isT2Terni ? 'is-terni' : ''}" title="${esc(r.t2)}">${esc(r.t2)}</span>
          </li>`).join('\n')}
        </ul>
        <div class="stat-pair">
          <div class="stat"><span class="stat-num">${esc(s.goalsFor)}</span><span class="stat-label">Gol fatti</span></div>
          <div class="stat"><span class="stat-num">${esc(s.goalsAgainst)}</span><span class="stat-label">Gol subiti</span></div>
        </div>
      </div>
      <div class="panel">
        <h3 class="panel-title">Marcatori</h3>
        <ol class="scorers-list">
          ${s.scorers.map((sc, i) => `<li class="${i === 0 ? 'top' : ''}"><span class="rank">${i + 1}</span><span class="name">${esc(sc.name)}</span><span class="goals">${esc(sc.goals)}</span></li>`).join('\n')}
        </ol>
      </div>
    </div>
  </section>`;
}

function renderValutazioneCombined(s) {
  return `
  <section class="slide" data-section="${s.section}">
    <header class="slide-head">
      <p class="eyebrow">${esc(s.eyebrow)}</p>
      <h2>${esc(s.heading)}</h2>
    </header>
    <div class="content two-col">
      <div class="panel panel-good">
        <h3 class="panel-title">Punti di forza</h3>
        <div class="prose">${mdParas(s.strengthsParas)}</div>
      </div>
      <div class="panel panel-bad">
        <h3 class="panel-title">Punti deboli</h3>
        <div class="prose">${mdParas(s.weaknessesParas)}</div>
      </div>
    </div>
  </section>`;
}

function renderValutazioneSingle(s) {
  const isGood = s.kind === 'good';
  return `
  <section class="slide" data-section="${s.section}">
    <header class="slide-head">
      <p class="eyebrow">${esc(s.eyebrow)}</p>
      <h2>${esc(s.heading)}</h2>
    </header>
    <div class="content one-col">
      <div class="panel ${isGood ? 'panel-good' : 'panel-bad'} panel-full">
        <div class="prose">${mdParas(s.paragraphs)}</div>
      </div>
    </div>
  </section>`;
}

function renderGallery(s) {
  return `
  <section class="slide" data-section="${s.section}">
    <header class="slide-head">
      <p class="eyebrow">${esc(s.eyebrow)}</p>
      <h2>${esc(s.heading)}</h2>
    </header>
    <div class="content">
      <div class="img-grid" style="grid-template-columns:repeat(${s.images.length},1fr)">
        ${s.images.map(b => `
        <figure class="img-card">
          <div class="img-frame"><img src="${b.image}" alt="" /></div>
          <figcaption>${md(b.caption || '')}</figcaption>
        </figure>`).join('\n')}
      </div>
    </div>
  </section>`;
}

function renderStatement(s) {
  return `
  <section class="slide" data-section="${s.section}">
    <header class="slide-head">
      <p class="eyebrow">${esc(s.eyebrow)}</p>
      <h2>${esc(s.heading)}</h2>
    </header>
    <div class="content piazzato-content">
      <p class="statement">${md(s.text)}</p>
      ${s.image ? realImage(s.image, s.caption) : placeholderImage(s.caption)}
    </div>
  </section>`;
}

const RENDERERS = {
  cover: renderCover,
  prose: renderProse,
  'results-scorers': renderResultsScorers,
  'valutazione-combined': renderValutazioneCombined,
  'valutazione-single': renderValutazioneSingle,
  gallery: renderGallery,
  statement: renderStatement,
};

function buildSlideDeckHtml(data) {
  const model = buildSlideModel(data);
  const slides = model.map(s => RENDERERS[s.type](s));

  const sectionMeta = {
    cover: { label: 'Copertina' },
    presentazione: { label: 'Presentazione' },
    possesso: { label: 'Possesso palla' },
    pressing: { label: 'Fuori possesso' },
    piazzati: { label: 'Calci piazzati' },
  };

  return `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8" />
<title>Analisi Avversario &middot; ${esc(data.meta.opponent)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
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
  overscroll-behavior: none;
  -webkit-text-size-adjust: 100%;
}
strong { color: var(--accent); font-weight: 700; }

.deck {
  position: relative;
  width: 100vw; height: 100vh;
  overflow: hidden;
  touch-action: pan-y;
}
@supports (height: 100dvh) { .deck { height: 100dvh; } }
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
  padding:
    calc(clamp(18px, 3.6vh, 50px) + env(safe-area-inset-top))
    calc(clamp(26px, 6vw, 90px) + env(safe-area-inset-right))
    calc(clamp(18px, 3.6vh, 50px) + env(safe-area-inset-bottom))
    calc(clamp(26px, 6vw, 90px) + env(safe-area-inset-left));
  overflow: hidden;
}
@supports (height: 100dvh) { .slide { height: 100dvh; } }

.eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.13em;
  font-size: clamp(12.5px, 1.8vh, 15px);
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
  font-size: clamp(24px, 4.8vh, 46px);
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
.prose p { margin: 0 0 clamp(7px, 1.3vh, 14px); font-size: clamp(16px, 2.6vh, 23px); line-height: 1.5; max-width: 70ch; }
.prose p:last-child { margin-bottom: 0; }

.tactic-chip {
  display: inline-block;
  align-self: flex-start;
  background: var(--surface-2);
  border: 1px solid var(--line);
  color: var(--ink);
  font-weight: 700;
  font-size: clamp(14px, 1.9vh, 17px);
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
.panel.panel-full { max-width: 920px; }
.panel-title {
  margin: 0 0 clamp(8px, 1.4vh, 14px);
  font-size: clamp(12.5px, 1.5vh, 15px);
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
.panel-good .prose p, .panel-bad .prose p { max-width: none; font-size: clamp(14px, 2vh, 19px); }
.panel-full .prose p { font-size: clamp(16px, 2.6vh, 23px); max-width: 70ch; }

.results-list { list-style: none; margin: 0 0 clamp(10px, 1.8vh, 20px); padding: 0; display: flex; flex-direction: column; gap: clamp(5px, 0.9vh, 8px); flex: 0 0 auto; }
.result-row {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  font-size: clamp(13px, 1.8vh, 17px);
  padding: clamp(5px, 0.9vh, 8px) 10px;
  border-radius: 6px;
  background: var(--surface-2);
}
.result-row .badge {
  width: 22px; height: 22px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 800; color: var(--accent-ink);
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
.note-tag {
  font-family: -apple-system, "Segoe UI", "Helvetica Neue", Arial, sans-serif;
  font-weight: 600;
  font-size: 0.75em;
  color: var(--ink-dim);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.stat-pair { display: flex; gap: clamp(16px, 2.4vw, 28px); padding-top: clamp(6px, 1vh, 10px); border-top: 1px solid var(--line); margin-top: auto; flex: 0 0 auto; }
.stat { display: flex; flex-direction: column; }
.stat-num {
  font-variant-numeric: tabular-nums;
  font-family: ui-monospace, "Cascadia Code", "SF Mono", Consolas, monospace;
  font-size: clamp(24px, 4.3vh, 40px); font-weight: 800; color: var(--accent); line-height: 1;
}
.stat-label { font-size: clamp(11.5px, 1.4vh, 13.5px); color: var(--ink-dim); text-transform: uppercase; letter-spacing: 0.08em; margin-top: 4px; }

.scorers-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: clamp(4px, 1vh, 9px); flex: 1 1 auto; min-height: 0; overflow: hidden; justify-content: flex-start; }
.scorers-list li {
  display: grid;
  grid-template-columns: 20px minmax(0,1fr) auto;
  gap: 8px;
  align-items: center;
  font-size: clamp(12.5px, 1.75vh, 17px);
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

.img-grid { display: grid; gap: clamp(12px, 2vh, 20px); width: 100%; height: 100%; }
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
.img-card figcaption { flex: 0 0 auto; padding: clamp(8px, 1.2vh, 12px) 14px; font-size: clamp(12.5px, 1.6vh, 15.5px); line-height: 1.4; color: var(--ink-dim); }

.bullet-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: clamp(8px, 1.6vh, 14px); max-width: 920px; }
.bullet-list li { position: relative; padding-left: 22px; font-size: clamp(16px, 2.4vh, 21px); line-height: 1.5; }
.bullet-list li::before { content: ""; position: absolute; left: 0; top: 9px; width: 8px; height: 8px; border-radius: 50%; background: var(--accent); }

/* calci piazzati: statement + immagine (reale o placeholder), sempre intera */
.piazzato-content { flex-direction: column; gap: clamp(14px, 2.2vh, 22px); max-width: 1020px; width: 100%; }
.statement {
  flex: 0 0 auto;
  margin: 0;
  font-size: clamp(18px, 3.1vh, 26px);
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
.img-placeholder .ph-label { margin: 0; font-size: clamp(14px, 1.9vh, 17px); text-align: center; max-width: 62ch; padding: 0 24px; line-height: 1.5; }

.piazzato-image-card {
  flex: 1 1 auto; min-height: 0; margin: 0;
  display: flex; flex-direction: column;
  background: var(--surface); border: 1px solid var(--line); border-radius: 12px;
  overflow: hidden; box-shadow: var(--shadow);
}
.piazzato-image-card .img-frame { flex: 1 1 auto; min-height: 0; background: var(--surface-2); display: flex; }
.piazzato-image-card img { width: 100%; height: 100%; object-fit: contain; display: block; }
.piazzato-image-card figcaption { flex: 0 0 auto; padding: clamp(8px, 1.2vh, 12px) 16px; font-size: clamp(13px, 1.7vh, 15.5px); line-height: 1.4; color: var(--ink-dim); }

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
.cover-sub { margin: 4px 0 0; color: var(--ink-dim); font-size: clamp(15px, 2.3vh, 21px); }
.cover-foot { margin-top: clamp(20px, 6vh, 60px); opacity: 0.85; }
.cover .agency { height: clamp(24px, 4vh, 34px); width: auto; }

/* nav chrome */
.progress { position: fixed; top: 0; left: 0; right: 0; height: 4px; background: var(--line); z-index: 10; }
.progress-bar { height: 100%; background: var(--accent); transition: width 0.4s ease; }

.hud {
  position: fixed; left: 0; right: 0; bottom: 0;
  display: flex; align-items: center; justify-content: flex-end;
  padding: 12px calc(clamp(18px, 3.6vw, 44px) + env(safe-area-inset-right)) calc(12px + env(safe-area-inset-bottom)) calc(clamp(18px, 3.6vw, 44px) + env(safe-area-inset-left));
  z-index: 10;
  pointer-events: none;
}
.hud > * { pointer-events: auto; }
.counter {
  position: fixed;
  top: calc(14px + env(safe-area-inset-top));
  right: calc(clamp(18px, 3.6vw, 44px) + env(safe-area-inset-right));
  z-index: 10;
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
  width: clamp(38px, 6vh, 44px); height: clamp(38px, 6vh, 44px); border-radius: 50%;
  border: 1px solid var(--line); background: var(--surface);
  color: var(--ink); font-size: 16px; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: background 0.15s, transform 0.15s;
  touch-action: manipulation;
}
.nav-btn:hover { background: var(--surface-2); }
.nav-btn:active { transform: scale(0.94); }
.nav-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.nav-btn[disabled] { opacity: 0.3; cursor: default; }

@media (max-width: 900px) {
  .content.two-col, .img-grid { grid-template-columns: 1fr !important; height: auto; }
  .content.two-col { overflow-y: hidden; }
}
</style>
</head>
<body>
<div class="progress"><div class="progress-bar" id="progressBar"></div></div>
<div class="counter" id="counter"></div>

<div class="deck">
  <div class="track" id="track">
    ${slides.join('\n')}
  </div>
</div>

<div class="hud">
  <div class="nav-btns">
    <button class="nav-btn" id="prevBtn" aria-label="Slide precedente">&#8592;</button>
    <button class="nav-btn" id="nextBtn" aria-label="Slide successiva">&#8594;</button>
  </div>
</div>

<script>
(function () {
  var slides = Array.prototype.slice.call(document.querySelectorAll('.slide'));
  var track = document.getElementById('track');
  var counter = document.getElementById('counter');
  var progressBar = document.getElementById('progressBar');
  var prevBtn = document.getElementById('prevBtn');
  var nextBtn = document.getElementById('nextBtn');
  var sectionMeta = ${JSON.stringify(sectionMeta)};
  var current = 0;

  function update() {
    track.style.transform = 'translateX(-' + (current * 100) + 'vw)';
    var sec = slides[current].getAttribute('data-section');
    var label = sectionMeta[sec] ? sectionMeta[sec].label : sec;
    counter.innerHTML = (current + 1) + ' / ' + slides.length + '  <span class="sec">' + label + '</span>';
    progressBar.style.width = (((current + 1) / slides.length) * 100) + '%';
    prevBtn.disabled = current === 0;
    nextBtn.disabled = current === slides.length - 1;
  }
  function goTo(i) {
    current = Math.max(0, Math.min(slides.length - 1, i));
    update();
  }
  prevBtn.addEventListener('click', function () { goTo(current - 1); });
  nextBtn.addEventListener('click', function () { goTo(current + 1); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { goTo(current + 1); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { goTo(current - 1); }
    else if (e.key === 'Home') { goTo(0); }
    else if (e.key === 'End') { goTo(slides.length - 1); }
  });

  // Swipe orizzontale per cambiare slide. touchmove non-passive con preventDefault solo
  // quando il gesto è chiaramente orizzontale: evita che iOS/Android interpretino lo swipe
  // come "torna indietro" o come scroll, ma lascia libero lo scroll verticale/pinch-zoom.
  var touchStartX = null, touchStartY = null, touchIsHorizontal = false;
  document.addEventListener('touchstart', function (e) {
    if (e.touches.length !== 1) { touchStartX = null; return; }
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchIsHorizontal = false;
  }, { passive: true });
  document.addEventListener('touchmove', function (e) {
    if (touchStartX === null || e.touches.length !== 1) return;
    var dx = e.touches[0].clientX - touchStartX;
    var dy = e.touches[0].clientY - touchStartY;
    if (!touchIsHorizontal && Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) touchIsHorizontal = true;
    if (touchIsHorizontal) e.preventDefault();
  }, { passive: false });
  document.addEventListener('touchend', function (e) {
    if (touchStartX === null) return;
    var dx = e.changedTouches[0].clientX - touchStartX;
    if (touchIsHorizontal && Math.abs(dx) > 50) { goTo(current + (dx < 0 ? 1 : -1)); }
    touchStartX = null;
  }, { passive: true });

  update();
})();
</script>
</body>
</html>
`;
}

return { buildSlideDeckHtml: buildSlideDeckHtml };

});
