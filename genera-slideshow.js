// Genera un visualizzatore HTML per una cartella di immagini già pronte (es. rinominate a
// mano con la didascalia nel nome del file). A differenza di genera-immagini.js (che
// ESPORTA le immagini da un report), questo tool fa l'inverso: prende immagini già esistenti
// e costruisce la pagina per scorrerle a schermo intero — pensato per collegare il PC a una
// TV via HDMI e usare le frecce della tastiera.
//
// La didascalia si ricava dal nome del file: si toglie un eventuale prefisso numerico
// ("12 - ", "3- ", ecc.) e l'estensione. Un nome puramente numerico (es. "01.png") resta
// senza didascalia.
//
// Uso:
//   node genera-slideshow.js <cartella-immagini> [percorso-output.html]
//
// Se l'output non è indicato, viene creato dentro la stessa cartella come "Slideshow.html"
// (così le immagini restano referenziate con percorsi relativi: leggero, e la cartella
// resta portabile se la sposti/copi intera).
const fs = require('fs');
const path = require('path');

const SRC_DIR = process.argv[2];
if (!SRC_DIR) {
  console.error('Uso: node genera-slideshow.js <cartella-immagini> [percorso-output.html]');
  process.exit(1);
}
if (!fs.statSync(SRC_DIR).isDirectory()) {
  console.error('Non è una cartella:', SRC_DIR);
  process.exit(1);
}

const OUT = process.argv[3] || path.join(SRC_DIR, 'Slideshow.html');
const IMG_EXT = /\.(png|jpe?g|webp)$/i;

function naturalCompare(a, b) {
  const re = /(\d+)|(\D+)/g;
  const pa = a.match(re) || [], pb = b.match(re) || [];
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const ca = pa[i] || '', cb = pb[i] || '';
    const na = /^\d+$/.test(ca), nb = /^\d+$/.test(cb);
    if (na && nb) { const d = Number(ca) - Number(cb); if (d) return d; }
    else { const d = ca.localeCompare(cb); if (d) return d; }
  }
  return 0;
}

function captionFromFilename(filename) {
  const noExt = filename.replace(IMG_EXT, '');
  const stripped = noExt.replace(/^\s*\d+\s*-\s*/, '').trim();
  return /^\d+$/.test(noExt.trim()) || !stripped ? '' : stripped;
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const outDir = path.dirname(OUT);
const files = fs.readdirSync(SRC_DIR)
  .filter(f => IMG_EXT.test(f) && fs.statSync(path.join(SRC_DIR, f)).isFile())
  .sort(naturalCompare);

if (!files.length) {
  console.error('Nessuna immagine (.png/.jpg/.jpeg/.webp) trovata in:', SRC_DIR);
  process.exit(1);
}

const slides = files.map(f => ({
  // percorso relativo dall'html (che di norma sta nella stessa cartella: relPath = solo il
  // nome file) alla cartella immagini, per restare portabile se l'html viene messo altrove.
  src: path.relative(outDir, path.join(SRC_DIR, f)).split(path.sep).map(encodeURIComponent).join('/'),
  caption: captionFromFilename(f),
}));

const html = `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8" />
<title>Slideshow &middot; ${esc(path.basename(SRC_DIR))}</title>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<style>
:root {
  --bg: #0c0b0a; --ink: #f3efe7; --ink-dim: #b8ae9c; --accent: #e2a53a; --line: #38332b;
}
* { box-sizing: border-box; }
html, body {
  margin: 0; padding: 0; height: 100%; width: 100%;
  background: var(--bg); color: var(--ink);
  font-family: -apple-system, "Segoe UI", "Helvetica Neue", Arial, sans-serif;
  overflow: hidden; overscroll-behavior: none;
}
.deck { position: relative; width: 100vw; height: 100vh; overflow: hidden; touch-action: pan-y; }
@supports (height: 100dvh) { .deck { height: 100dvh; } }
.track { display: flex; height: 100%; width: max-content; transition: transform 0.4s cubic-bezier(.65,0,.35,1); }
@media (prefers-reduced-motion: reduce) { .track { transition: none; } }
.slide {
  width: 100vw; height: 100vh; flex: 0 0 100vw;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: clamp(16px, 3vh, 40px);
}
@supports (height: 100dvh) { .slide { height: 100dvh; } }
.slide img {
  max-width: 100%; max-height: 100%; object-fit: contain;
  border-radius: 4px; box-shadow: 0 20px 60px rgba(0,0,0,0.5);
}
.caption-bar {
  position: fixed; left: 0; right: 0; bottom: 0;
  padding: clamp(14px, 2.4vh, 26px) clamp(24px, 5vw, 70px)
    calc(clamp(14px, 2.4vh, 26px) + env(safe-area-inset-bottom));
  background: linear-gradient(to top, rgba(0,0,0,0.78), rgba(0,0,0,0));
  font-size: clamp(15px, 2.4vh, 24px); line-height: 1.4;
  text-align: center; pointer-events: none;
  opacity: 0; transition: opacity 0.25s ease;
}
.caption-bar.show { opacity: 1; }
.counter {
  position: fixed; top: calc(14px + env(safe-area-inset-top)); right: calc(16px + env(safe-area-inset-right));
  font-family: ui-monospace, "Cascadia Code", "SF Mono", Consolas, monospace;
  font-size: 13px; color: var(--ink-dim);
  background: rgba(12,11,10,0.7); border: 1px solid var(--line);
  padding: 6px 12px; border-radius: 20px; white-space: nowrap;
}
.nav-btns { position: fixed; bottom: calc(18px + env(safe-area-inset-bottom)); right: calc(18px + env(safe-area-inset-right)); display: flex; gap: 8px; }
.nav-btn {
  width: 44px; height: 44px; border-radius: 50%;
  border: 1px solid var(--line); background: rgba(28,26,22,0.85); color: var(--ink);
  font-size: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center;
  touch-action: manipulation;
}
.nav-btn:hover { background: rgba(36,32,25,0.95); }
.nav-btn:active { transform: scale(0.94); }
.nav-btn[disabled] { opacity: 0.3; cursor: default; }
.nav-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
</style>
</head>
<body>
<div class="deck">
  <div class="track" id="track">
    ${slides.map(s => `
    <div class="slide"><img src="${esc(s.src)}" alt="" loading="eager" /></div>`).join('')}
  </div>
</div>
<div class="counter" id="counter"></div>
<div class="caption-bar" id="captionBar"></div>
<div class="nav-btns">
  <button class="nav-btn" id="prevBtn" aria-label="Precedente">&#8592;</button>
  <button class="nav-btn" id="nextBtn" aria-label="Successiva">&#8594;</button>
</div>
<script>
(function () {
  var captions = ${JSON.stringify(slides.map(s => s.caption))};
  var track = document.getElementById('track');
  var counter = document.getElementById('counter');
  var captionBar = document.getElementById('captionBar');
  var prevBtn = document.getElementById('prevBtn');
  var nextBtn = document.getElementById('nextBtn');
  var total = captions.length;
  var current = 0;

  function update() {
    track.style.transform = 'translateX(-' + (current * 100) + 'vw)';
    counter.textContent = (current + 1) + ' / ' + total;
    var cap = captions[current];
    if (cap) { captionBar.textContent = cap; captionBar.classList.add('show'); }
    else { captionBar.classList.remove('show'); }
    prevBtn.disabled = current === 0;
    nextBtn.disabled = current === total - 1;
  }
  function goTo(i) { current = Math.max(0, Math.min(total - 1, i)); update(); }
  prevBtn.addEventListener('click', function () { goTo(current - 1); });
  nextBtn.addEventListener('click', function () { goTo(current + 1); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { goTo(current + 1); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { goTo(current - 1); }
    else if (e.key === 'Home') { goTo(0); }
    else if (e.key === 'End') { goTo(total - 1); }
  });

  var touchStartX = null, touchStartY = null, touchIsHorizontal = false;
  document.addEventListener('touchstart', function (e) {
    if (e.touches.length !== 1) { touchStartX = null; return; }
    touchStartX = e.touches[0].clientX; touchStartY = e.touches[0].clientY; touchIsHorizontal = false;
  }, { passive: true });
  document.addEventListener('touchmove', function (e) {
    if (touchStartX === null || e.touches.length !== 1) return;
    var dx = e.touches[0].clientX - touchStartX, dy = e.touches[0].clientY - touchStartY;
    if (!touchIsHorizontal && Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) touchIsHorizontal = true;
    if (touchIsHorizontal) e.preventDefault();
  }, { passive: false });
  document.addEventListener('touchend', function (e) {
    if (touchStartX === null) return;
    var dx = e.changedTouches[0].clientX - touchStartX;
    if (touchIsHorizontal && Math.abs(dx) > 50) goTo(current + (dx < 0 ? 1 : -1));
    touchStartX = null;
  }, { passive: true });

  update();
})();
</script>
</body>
</html>
`;

fs.writeFileSync(OUT, html, 'utf-8');
console.log(`Slideshow generato: ${OUT}`);
console.log(`${files.length} immagini trovate.`);
