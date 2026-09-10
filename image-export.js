// Esporta ogni slide di un deck HTML (prodotto da slide-engine.js) come PNG separato,
// pilotando una pagina headless con Puppeteer. Condiviso da genera-immagini.js (standalone)
// e dal tool unificato genera-slide.js.
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

async function exportSlideImages(html, outDir, { width = 1920, height = 1080 } = {}) {
  fs.mkdirSync(outDir, { recursive: true });
  for (const f of fs.readdirSync(outDir)) {
    if (/^\d+\.png$/.test(f)) fs.unlinkSync(path.join(outDir, f));
  }

  const browser = await puppeteer.launch({ headless: 'new' });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    // Il documento può pesare decine di MB (immagini incorporate come data URI): passarlo
    // via CDP e decodificarlo può richiedere più del timeout di navigazione di default.
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 180000 });
    await page.evaluate(() => new Promise(resolve => {
      const imgs = Array.from(document.images);
      let pending = imgs.filter(img => !img.complete).length;
      if (!pending) return resolve();
      imgs.forEach(img => { if (!img.complete) img.addEventListener('load', () => { if (--pending <= 0) resolve(); }); });
    }));
    // le immagini devono contenere solo il contenuto della slide: nasconde la barra di
    // navigazione, il contatore e la progress bar, pensati solo per la sfoglia interattiva.
    await page.addStyleTag({ content: '.hud, .progress, .counter { display: none !important; }' });

    const total = await page.evaluate(() => document.querySelectorAll('.slide').length);
    const digits = String(total).length;
    for (let i = 0; i < total; i++) {
      await page.evaluate((idx) => {
        const track = document.getElementById('track');
        track.style.transition = 'none'; // niente animazione, screenshot istantaneo
        track.style.transform = 'translateX(-' + (idx * 100) + 'vw)';
      }, i);
      const name = String(i + 1).padStart(digits, '0') + '.png';
      await page.screenshot({ path: path.join(outDir, name) });
    }
    return total;
  } finally {
    await browser.close();
  }
}

module.exports = { exportSlideImages };
