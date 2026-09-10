// Tool unico: da un report "Analisi Avversario" (.docx, .pdf o .json) produce una cartella
// con tutto il necessario per presentare le slide in qualsiasi contesto:
//
//   Presentazione <nome>/
//     <nome>.html          — presentazione interattiva (frecce/swipe/tastiera; Mac+HDMI o
//                            un browser qualsiasi)
//     <nome>.pptx          — vero PowerPoint, apribile anche dall'Office Viewer di una
//                            smart TV via chiavetta USB, o modificabile a mano
//     <nome> (immagini)/   — un PNG per slide, per il visualizzatore foto di una TV da
//                            chiavetta USB quando non supporta l'Office Viewer
//
// Tra .docx e .pdf, il .docx è preferibile quando esiste: è uno zip con XML vero (paragrafi
// e grassetto espliciti, immagini incorporate come byte originali) invece di dover
// reinterpretare un flusso di comandi di disegno — molto meno soggetto a inceppi.
// Un'immagine che non si riesce a estrarre viene saltata con un avviso, non blocca il resto.
//
// Uso:
//   node genera-slide.js <percorso-report.docx-pdf-o-json> [cartella-padre-output]
//
// Se non indicata, la cartella "Presentazione <nome>" viene creata accanto al file sorgente.
const fs = require('fs');
const path = require('path');
const { buildSlideDeckHtml } = require('./slide-engine.js');
const { buildPptxBuffer } = require('./pptx-engine.js');
const { exportSlideImages } = require('./image-export.js');

const SRC = process.argv[2];
if (!SRC) {
  console.error('Uso: node genera-slide.js <percorso-report.docx-pdf-o-json> [cartella-padre-output]');
  process.exit(1);
}
const isDocx = /\.docx$/i.test(SRC);
const isPdf = /\.pdf$/i.test(SRC);
const isJson = /\.json$/i.test(SRC);
if (!isDocx && !isPdf && !isJson) {
  console.error('Il file di input deve avere estensione .docx, .pdf o .json');
  process.exit(1);
}

const baseName = path.basename(SRC).replace(/\.(docx|pdf|json)$/i, '');
const parentDir = process.argv[3] || path.dirname(SRC);
const OUT_DIR = path.join(parentDir, `Presentazione ${baseName}`);

function warn(msg) { console.warn('  ATTENZIONE:', msg); }

async function loadData() {
  if (isJson) return JSON.parse(fs.readFileSync(SRC, 'utf-8'));

  let state;
  if (isDocx) {
    console.log('Lettura del docx ed estrazione di testo e immagini…');
    const { extractStateFromDocx } = require('./docx-extract-node.js');
    const bytes = fs.readFileSync(SRC);
    state = await extractStateFromDocx(bytes, warn);
  } else {
    console.log('Lettura del PDF ed estrazione di testo e immagini…');
    const { extractStateFromPdf } = require('./pdf-extract-node.js');
    const bytes = new Uint8Array(fs.readFileSync(SRC));
    state = await extractStateFromPdf(bytes, (p, total) => {
      process.stdout.write(`  pagina ${p}/${total}\r`);
    }, warn);
    process.stdout.write('\n');
  }
  // Né il docx né il PDF riportano di norma il nome dell'avversario come testo isolato: si
  // usa il nome del file come stima ragionevole (rinominabile a mano dopo, se serve).
  if (!state.meta.opponent) state.meta.opponent = baseName.replace(/[_-]+/g, ' ').trim();
  if (!state.meta.title) state.meta.title = 'ANALISI AVVERSARIO';
  return state;
}

async function main() {
  const data = await loadData();
  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log('Genero la presentazione HTML…');
  const html = buildSlideDeckHtml(data);
  fs.writeFileSync(path.join(OUT_DIR, `${baseName}.html`), html, 'utf-8');
  console.log(`  fatto (${(html.length / 1024 / 1024).toFixed(1)} MB)`);

  console.log('Genero il PowerPoint…');
  const pptxBuf = await buildPptxBuffer(data);
  fs.writeFileSync(path.join(OUT_DIR, `${baseName}.pptx`), pptxBuf);
  console.log(`  fatto (${(pptxBuf.length / 1024 / 1024).toFixed(1)} MB)`);

  console.log('Genero le immagini (una per slide)…');
  const imgDir = path.join(OUT_DIR, `${baseName} (immagini)`);
  const total = await exportSlideImages(html, imgDir, { width: 1920, height: 1080 });
  console.log(`  fatto (${total} immagini)`);

  console.log('\nTutto pronto in:', OUT_DIR);
}

main().catch(e => { console.error(e); process.exit(1); });
