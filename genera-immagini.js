// Esporta ogni slide del report "Analisi Avversario" come immagine PNG separata, numerata in
// ordine — pensato per essere copiato su una chiavetta USB e scorso col telecomando nel
// visualizzatore foto di una smart TV (che non può aprire un file .html).
//
// Uso:
//   node genera-immagini.js <percorso-report.json> [cartella-output] [--w=1920] [--h=1080]
//
// Se la cartella di output non è indicata, viene creata accanto al file .json con nome
// "Slide - <Avversario> (immagini)".
const fs = require('fs');
const path = require('path');
const { buildSlideDeckHtml } = require('./slide-engine.js');
const { exportSlideImages } = require('./image-export.js');

const args = process.argv.slice(2);
const positional = args.filter(a => !a.startsWith('--'));
const flags = Object.fromEntries(
  args.filter(a => a.startsWith('--')).map(a => {
    const [k, v] = a.slice(2).split('=');
    return [k, v === undefined ? true : v];
  })
);

const SRC = positional[0];
if (!SRC) {
  console.error('Uso: node genera-immagini.js <percorso-report.json> [cartella-output] [--w=1920] [--h=1080]');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(SRC, 'utf-8'));
const opponent = (data.meta.opponent || 'Report').replace(/[\\/:*?"<>|]/g, '');

const OUT_DIR = positional[1] || path.join(path.dirname(SRC), `Slide - ${opponent} (immagini)`);
const WIDTH = Number(flags.w) || 1920;
const HEIGHT = Number(flags.h) || 1080;

async function main() {
  const html = buildSlideDeckHtml(data);
  console.log(`Esporto a ${WIDTH}x${HEIGHT}…`);
  const total = await exportSlideImages(html, OUT_DIR, { width: WIDTH, height: HEIGHT });
  console.log(`Esportate ${total} immagini in: ${OUT_DIR}`);
}

main().catch(e => { console.error(e); process.exit(1); });
