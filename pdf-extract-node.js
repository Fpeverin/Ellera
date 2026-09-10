// Estrazione .pdf lato Node (niente canvas/ImageBitmap del browser: le immagini vengono
// ricodificate in JPEG con jpeg-js, puro JS, nessuna dipendenza nativa). Usato dal tool CLI
// unificato quando l'input è un .pdf. La logica di interpretazione del contenuto (titoli,
// sezioni, blocchi) è condivisa con docx-extract-node.js via doc-state-parser.js.
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
const jpeg = require('jpeg-js');
const { parseState } = require('./doc-state-parser.js');

const HEADERISH_MIN_SIZE = 9;
const IMAGE_RESOLVE_TIMEOUT_MS = 8000;

function matMul(m1, m2) {
  return [
    m1[0] * m2[0] + m1[1] * m2[2],
    m1[0] * m2[1] + m1[1] * m2[3],
    m1[2] * m2[0] + m1[3] * m2[2],
    m1[2] * m2[1] + m1[3] * m2[3],
    m1[4] * m2[0] + m1[5] * m2[2] + m2[4],
    m1[4] * m2[1] + m1[5] * m2[3] + m2[5],
  ];
}

async function extractDoc(pdfBytes, onProgress, onWarning) {
  const doc = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
  const allEntries = [];
  const OPS = pdfjsLib.OPS;

  for (let p = 1; p <= doc.numPages; p++) {
    if (onProgress) onProgress(p, doc.numPages);
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    const opList = await page.getOperatorList();

    const rawItems = tc.items
      .filter(it => it.str != null && Math.abs(it.transform[3] || it.transform[0] || 0) >= HEADERISH_MIN_SIZE)
      .map(it => {
        const style = tc.styles[it.fontName] || {};
        const fam = (style.fontFamily || '').toLowerCase();
        return {
          str: it.str,
          bold: fam.includes('bold') || it.fontName === 'g_d0_f1' || it.fontName === 'g_d0_f5',
          x: it.transform[4],
          y: it.transform[5],
          w: it.width,
          size: Math.abs(it.transform[3] || it.transform[0] || 0),
        };
      });

    const lines = [];
    for (const it of rawItems) {
      let line = lines.find(l => Math.abs(l.y - it.y) < 1.2);
      if (!line) { line = { y: it.y, items: [] }; lines.push(line); }
      line.items.push(it);
    }
    lines.sort((a, b) => b.y - a.y);
    let prevLineY = null, prevLineSize = null;
    for (const line of lines) {
      const lineSize = Math.max.apply(null, line.items.map(it => it.size || 11));
      const gap = prevLineY == null ? null : prevLineY - line.y;
      const newParagraph = gap != null && gap > (prevLineSize || lineSize) * 1.55;
      prevLineY = line.y; prevLineSize = lineSize;
      line.newParagraph = newParagraph;
    }
    for (const line of lines) {
      line.items.sort((a, b) => a.x - b.x);
      let runs = [];
      let curBold = null, curText = '';
      let prevEndX = null;
      for (const it of line.items) {
        const gap = prevEndX == null ? 0 : it.x - prevEndX;
        const boldChanged = curBold !== null && it.bold !== curBold;
        const startsWithClosingPunct = /^[.,;:)\]!?%/]/.test(it.str);
        const prevEndsWithOpening = /[(’'‘\-/]$/.test(curText);
        let needSpace;
        if (boldChanged) needSpace = !startsWithClosingPunct && !prevEndsWithOpening;
        else needSpace = prevEndX != null && gap > 1.0 && !startsWithClosingPunct && !prevEndsWithOpening;
        if (curBold === null) { curBold = it.bold; curText = it.str; }
        else if (!boldChanged) { curText += (needSpace ? ' ' : '') + it.str; }
        else { runs.push({ text: curText, bold: curBold }); curBold = it.bold; curText = (needSpace ? ' ' : '') + it.str; }
        prevEndX = it.x + (it.w || 0);
      }
      if (curText) runs.push({ text: curText, bold: curBold });
      runs = runs.filter(r => r.text.length);
      const mdText = runs.map(r => r.bold ? '**' + r.text.trim() + '**' : r.text).join('');
      allEntries.push({ type: 'text', page: p, y: line.y, text: mdText.replace(/[ \t]+/g, ' ').trim(), newParagraph: line.newParagraph });
    }

    let ctm = [1, 0, 0, 1, 0, 0];
    const ctmStack = [];
    const pageImages = [];
    for (let i = 0; i < opList.fnArray.length; i++) {
      const fn = opList.fnArray[i];
      const args = opList.argsArray[i];
      if (fn === OPS.save) ctmStack.push(ctm);
      else if (fn === OPS.restore) ctm = ctmStack.pop() || ctm;
      else if (fn === OPS.transform) ctm = matMul(args, ctm);
      else if (fn === OPS.paintImageXObject || fn === OPS.paintJpegXObject) {
        const y0 = ctm[5], y1 = 1 * ctm[3] + ctm[5];
        pageImages.push({ objId: args[0], y: (y0 + y1) / 2 });
      }
    }
    for (const pi of pageImages) {
      // page.objs.get(id, cb) può non richiamare mai il callback per un'immagine in un
      // formato che pdf.js non riesce a decodificare: un timeout evita che l'estrazione
      // resti bloccata per sempre — quell'immagine viene semplicemente saltata.
      let imgObj;
      try {
        imgObj = await Promise.race([
          new Promise((resolve) => page.objs.get(pi.objId, resolve)),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout decodifica immagine')), IMAGE_RESOLVE_TIMEOUT_MS)),
        ]);
      } catch (e) {
        if (onWarning) onWarning(`pagina ${p}: immagine saltata (${e.message})`);
        continue;
      }
      allEntries.push({ type: 'image', page: p, y: pi.y, imgObj });
    }
  }

  allEntries.sort((a, b) => (a.page - b.page) || (b.y - a.y));
  return allEntries;
}

// oggetto pixel grezzo di pdf.js (Node non ha ImageBitmap: qui .data è sempre presente) ->
// data:image/jpeg URL, ricodificando con jpeg-js.
function imageObjToDataUrl(imgObj) {
  const { width, height, data, kind } = imgObj;
  if (!data) throw new Error('immagine senza pixel decodificati');
  const rgba = new Uint8Array(width * height * 4);
  if (kind === 3) { // RGBA_32BPP
    rgba.set(data);
  } else if (kind === 1) { // GRAYSCALE_1BPP (bit-packed)
    let bit = 0;
    for (let i = 0; i < width * height; i++) {
      const byte = data[bit >> 3];
      const v = (byte >> (7 - (bit % 8))) & 1 ? 255 : 0;
      rgba[i * 4] = v; rgba[i * 4 + 1] = v; rgba[i * 4 + 2] = v; rgba[i * 4 + 3] = 255;
      bit++;
    }
  } else { // RGB_24BPP (il più comune qui)
    for (let i = 0, j = 0; i < width * height; i++, j += 3) {
      rgba[i * 4] = data[j]; rgba[i * 4 + 1] = data[j + 1]; rgba[i * 4 + 2] = data[j + 2]; rgba[i * 4 + 3] = 255;
    }
  }
  const { data: jpegBytes } = jpeg.encode({ data: rgba, width, height }, 86);
  return 'data:image/jpeg;base64,' + jpegBytes.toString('base64');
}

async function extractStateFromPdf(pdfBytes, onProgress, onWarning) {
  const entries = await extractDoc(pdfBytes, onProgress, onWarning);
  const state = parseState(entries);
  function safeConvert(imgObj, where) {
    try { return imageObjToDataUrl(imgObj); }
    catch (e) { if (onWarning) onWarning(`immagine saltata (${where}): ${e.message}`); return null; }
  }
  if (state.crestLogo) state.crestLogo = safeConvert(state.crestLogo, 'stemma');
  state.agencyLogo = state.agencyLogo ? safeConvert(state.agencyLogo, 'logo') : (state.crestLogo || null);
  [state.possession, state.nonPossession, state.setPiecesFor, state.setPiecesAgainst].forEach(section => {
    section.blocks.forEach(b => { if (b.image) b.image = safeConvert(b.image, 'blocco'); });
  });
  return state;
}

module.exports = { extractStateFromPdf };
