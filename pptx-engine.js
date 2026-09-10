// Motore di rendering PowerPoint: prende lo stesso modello di slide di slide-engine.js
// (report-model.js) e produce un vero file .pptx con pptxgenjs — stessa fonte dati, stessa
// struttura di slide, formato diverso. Solo Node (pptxgenjs + Buffer non sono disponibili
// in modo pulito lato browser in questo progetto).
const PptxGenJS = require('pptxgenjs');
const { buildSlideModel } = require('./report-model.js');

const COLOR = {
  bg: '14120F', surface: '1C1A16', surface2: '242019', line: '38332B',
  ink: 'F3EFE7', inkDim: 'B8AE9C', accent: 'E2A53A', accentInk: '1C1A16',
  good: '6FAE6A', bad: 'D97A5A',
};
const FONT = 'Arial';
const W = 13.333, H = 7.5;
const MARGIN_X = 0.55;
const CONTENT_X = MARGIN_X, CONTENT_W = W - MARGIN_X * 2;
const HEAD_Y = 0.4, HEAD_RULE_Y = 1.5, CONTENT_Y = 1.72, CONTENT_H = H - CONTENT_Y - 0.45;

// converte **testo** in un array di run pptxgenjs (grassetto = colore accento, come <strong>
// nell'HTML), un run per paragrafo con newline preservate.
function mdRuns(text, baseOpts) {
  const runs = [];
  const paras = String(text || '').split(/\n\n+/);
  paras.forEach((para, pi) => {
    const parts = para.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
    parts.forEach((part, i) => {
      const isBold = part.startsWith('**') && part.endsWith('**');
      const t = isBold ? part.slice(2, -2) : part;
      const opts = Object.assign({}, baseOpts);
      if (isBold) { opts.bold = true; opts.color = COLOR.accent; }
      const isLastOfPara = i === parts.length - 1;
      runs.push({ text: t, options: isLastOfPara && pi < paras.length - 1 ? Object.assign({}, opts, { breakLine: true }) : opts });
    });
    if (!parts.length) runs.push({ text: '', options: Object.assign({}, baseOpts, { breakLine: pi < paras.length - 1 }) });
  });
  return runs;
}

function addHeader(slide, eyebrow, heading) {
  slide.addText(String(eyebrow || '').toUpperCase(), {
    x: CONTENT_X, y: HEAD_Y, w: CONTENT_W, h: 0.32,
    fontFace: FONT, fontSize: 12, bold: true, color: COLOR.accent, charSpacing: 2,
  });
  slide.addText(heading || '', {
    x: CONTENT_X, y: HEAD_Y + 0.32, w: CONTENT_W, h: 0.7,
    fontFace: FONT, fontSize: 30, bold: true, color: COLOR.ink,
  });
  slide.addShape('line', {
    x: CONTENT_X, y: HEAD_RULE_Y, w: CONTENT_W, h: 0,
    line: { color: COLOR.line, width: 1.5 },
  });
}

function placeholderBox(slide, x, y, w, h, label) {
  slide.addShape('roundRect', {
    x, y, w, h, rectRadius: 0.08,
    fill: { color: COLOR.surface2 },
    line: { color: COLOR.line, width: 1.5, dashType: 'dash' },
  });
  slide.addText(label ? label.replace(/\s*—\s*inserire immagine\.?$/i, '.') : 'Schema tattico — immagine da inserire', {
    x: x + 0.4, y: y + h / 2 - 0.4, w: w - 0.8, h: 0.8,
    fontFace: FONT, fontSize: 14, color: COLOR.inkDim, align: 'center', valign: 'middle',
  });
}

function imageContain(slide, dataUrl, x, y, w, h) {
  slide.addShape('rect', { x, y, w, h, fill: { color: COLOR.surface2 }, line: { color: COLOR.line, width: 1 } });
  slide.addImage({ data: dataUrl, x, y, w, h, sizing: { type: 'contain', w, h } });
}

// ---- render di una singola slide del modello -> slide pptx ----

function renderCover(pptx, s) {
  const slide = pptx.addSlide();
  slide.background = { color: COLOR.bg };
  slide.addShape('line', { x: W * 0.08, y: H * 0.5, w: W * 0.84, h: 0, line: { color: COLOR.line, width: 1 } });
  if (s.crestLogo) slide.addImage({ data: s.crestLogo, x: W / 2 - 0.7, y: H * 0.22, w: 1.4, h: 1.4, sizing: { type: 'contain', w: 1.4, h: 1.4 } });
  slide.addText(String(s.title || '').toUpperCase(), {
    x: 0, y: H * 0.44, w: W, h: 0.4,
    fontFace: FONT, fontSize: 14, bold: true, color: COLOR.accent, align: 'center', charSpacing: 2,
  });
  slide.addText(String(s.opponent || '').toUpperCase(), {
    x: 0, y: H * 0.49, w: W, h: 1.0,
    fontFace: FONT, fontSize: 54, bold: true, color: COLOR.ink, align: 'center',
  });
  slide.addText(s.competition || '', {
    x: 0, y: H * 0.63, w: W, h: 0.45,
    fontFace: FONT, fontSize: 18, color: COLOR.inkDim, align: 'center',
  });
  if (s.agencyLogo) slide.addImage({ data: s.agencyLogo, x: W / 2 - 0.45, y: H * 0.82, w: 0.9, h: 0.32, sizing: { type: 'contain', w: 0.9, h: 0.32 } });
  return slide;
}

function renderProse(pptx, s) {
  const slide = pptx.addSlide();
  slide.background = { color: COLOR.bg };
  addHeader(slide, s.eyebrow, s.heading);
  let y = CONTENT_Y;
  if (s.chip) {
    slide.addShape('roundRect', { x: CONTENT_X, y, w: 2.6, h: 0.38, rectRadius: 0.06, fill: { color: COLOR.surface2 }, line: { color: COLOR.line, width: 1 } });
    slide.addText(s.chip, { x: CONTENT_X + 0.15, y, w: 2.4, h: 0.38, fontFace: FONT, fontSize: 13, bold: true, color: COLOR.ink, valign: 'middle' });
    y += 0.55;
  }
  slide.addText(mdRuns(s.paragraphs.join('\n\n'), { fontFace: FONT, fontSize: 17, color: COLOR.ink }), {
    x: CONTENT_X, y, w: CONTENT_W, h: CONTENT_Y + CONTENT_H - y, valign: 'top', lineSpacing: 24,
  });
  return slide;
}

function renderResultsScorers(pptx, s) {
  const slide = pptx.addSlide();
  slide.background = { color: COLOR.bg };
  addHeader(slide, s.eyebrow, s.heading);
  const colW = (CONTENT_W - 0.4) / 2;
  const leftX = CONTENT_X, rightX = CONTENT_X + colW + 0.4;

  slide.addShape('roundRect', { x: leftX, y: CONTENT_Y, w: colW, h: CONTENT_H, rectRadius: 0.06, fill: { color: COLOR.surface }, line: { color: COLOR.line, width: 1 } });
  slide.addShape('roundRect', { x: rightX, y: CONTENT_Y, w: colW, h: CONTENT_H, rectRadius: 0.06, fill: { color: COLOR.surface }, line: { color: COLOR.line, width: 1 } });

  const pad = 0.3;
  slide.addText('ULTIMI RISULTATI', { x: leftX + pad, y: CONTENT_Y + 0.2, w: colW - pad * 2, h: 0.3, fontFace: FONT, fontSize: 12, bold: true, color: COLOR.inkDim, charSpacing: 1.5 });
  const rows = s.results;
  const rowsAreaH = CONTENT_H - 1.5;
  const rowH = Math.max(0.32, Math.min(0.5, rowsAreaH / Math.max(1, rows.length)));
  const outcomeColor = { win: COLOR.good, loss: COLOR.bad, draw: COLOR.accent };
  const outcomeLabel = { win: 'V', loss: 'P', draw: 'N' };
  rows.forEach((r, i) => {
    const ry = CONTENT_Y + 0.55 + i * (rowH + 0.06);
    slide.addShape('roundRect', { x: leftX + pad, y: ry, w: colW - pad * 2, h: rowH, rectRadius: 0.04, fill: { color: COLOR.surface2 } });
    if (r.raw) {
      slide.addText(r.raw, { x: leftX + pad + 0.12, y: ry, w: colW - pad * 2 - 0.24, h: rowH, fontFace: FONT, fontSize: 13, color: COLOR.ink, valign: 'middle' });
      return;
    }
    slide.addShape('ellipse', { x: leftX + pad + 0.1, y: ry + rowH / 2 - 0.13, w: 0.26, h: 0.26, fill: { color: outcomeColor[r.outcome] } });
    slide.addText(outcomeLabel[r.outcome], { x: leftX + pad + 0.1, y: ry + rowH / 2 - 0.13, w: 0.26, h: 0.26, fontFace: FONT, fontSize: 10, bold: true, color: COLOR.accentInk, align: 'center', valign: 'middle' });
    slide.addText(r.t1, { x: leftX + pad + 0.46, y: ry, w: colW * 0.36, h: rowH, fontFace: FONT, fontSize: 13, bold: r.isT1Terni, color: r.isT1Terni ? COLOR.ink : COLOR.inkDim, valign: 'middle' });
    slide.addText(`${r.s1} – ${r.s2}${r.note ? '  (' + r.note + ')' : ''}`, { x: leftX + colW * 0.5, y: ry, w: colW * 0.24, h: rowH, fontFace: FONT, fontSize: 13, bold: true, color: COLOR.ink, align: 'center', valign: 'middle' });
    slide.addText(r.t2, { x: leftX + colW * 0.5 + colW * 0.24, y: ry, w: colW * 0.36 - pad, h: rowH, fontFace: FONT, fontSize: 13, bold: r.isT2Terni, color: r.isT2Terni ? COLOR.ink : COLOR.inkDim, align: 'right', valign: 'middle' });
  });
  const statY = CONTENT_Y + CONTENT_H - 0.75;
  slide.addShape('line', { x: leftX + pad, y: statY, w: colW - pad * 2, h: 0, line: { color: COLOR.line, width: 1 } });
  slide.addText(String(s.goalsFor ?? ''), { x: leftX + pad, y: statY + 0.1, w: 1.2, h: 0.4, fontFace: FONT, fontSize: 26, bold: true, color: COLOR.accent });
  slide.addText('GOL FATTI', { x: leftX + pad, y: statY + 0.5, w: 1.4, h: 0.25, fontFace: FONT, fontSize: 10, color: COLOR.inkDim, charSpacing: 1 });
  slide.addText(String(s.goalsAgainst ?? ''), { x: leftX + pad + 1.6, y: statY + 0.1, w: 1.2, h: 0.4, fontFace: FONT, fontSize: 26, bold: true, color: COLOR.accent });
  slide.addText('GOL SUBITI', { x: leftX + pad + 1.6, y: statY + 0.5, w: 1.4, h: 0.25, fontFace: FONT, fontSize: 10, color: COLOR.inkDim, charSpacing: 1 });

  slide.addText('MARCATORI', { x: rightX + pad, y: CONTENT_Y + 0.2, w: colW - pad * 2, h: 0.3, fontFace: FONT, fontSize: 12, bold: true, color: COLOR.inkDim, charSpacing: 1.5 });
  const scorers = s.scorers;
  const sRowH = Math.max(0.3, Math.min(0.45, (CONTENT_H - 0.6) / Math.max(1, scorers.length)));
  scorers.forEach((sc, i) => {
    const ry = CONTENT_Y + 0.55 + i * (sRowH + 0.04);
    if (i === 0) slide.addShape('roundRect', { x: rightX + pad, y: ry, w: colW - pad * 2, h: sRowH, rectRadius: 0.04, fill: { color: COLOR.surface2 }, line: { color: COLOR.accent, width: 1 } });
    slide.addText(String(i + 1), { x: rightX + pad + 0.05, y: ry, w: 0.35, h: sRowH, fontFace: FONT, fontSize: 11, color: COLOR.inkDim, valign: 'middle' });
    slide.addText(sc.name, { x: rightX + pad + 0.4, y: ry, w: colW - pad * 2 - 1.2, h: sRowH, fontFace: FONT, fontSize: 14, color: COLOR.ink, valign: 'middle' });
    slide.addText(String(sc.goals), { x: rightX + colW - pad - 0.8, y: ry, w: 0.8, h: sRowH, fontFace: FONT, fontSize: 14, bold: true, color: COLOR.accent, align: 'right', valign: 'middle' });
  });
  return slide;
}

function renderValutazione(pptx, s) {
  const slide = pptx.addSlide();
  slide.background = { color: COLOR.bg };
  addHeader(slide, s.eyebrow, s.heading);
  if (s.type === 'valutazione-single') {
    const good = s.kind === 'good';
    slide.addShape('rect', { x: CONTENT_X, y: CONTENT_Y, w: CONTENT_W, h: 0.06, fill: { color: good ? COLOR.good : COLOR.bad } });
    slide.addText(mdRuns(s.paragraphs.join('\n\n'), { fontFace: FONT, fontSize: 17, color: COLOR.ink }), {
      x: CONTENT_X, y: CONTENT_Y + 0.2, w: CONTENT_W, h: CONTENT_H - 0.2, valign: 'top', lineSpacing: 24,
    });
    return slide;
  }
  const colW = (CONTENT_W - 0.4) / 2;
  [{ x: CONTENT_X, label: 'PUNTI DI FORZA', color: COLOR.good, paras: s.strengthsParas },
   { x: CONTENT_X + colW + 0.4, label: 'PUNTI DEBOLI', color: COLOR.bad, paras: s.weaknessesParas }]
    .forEach(col => {
      slide.addShape('rect', { x: col.x, y: CONTENT_Y, w: colW, h: 0.06, fill: { color: col.color } });
      slide.addText(col.label, { x: col.x, y: CONTENT_Y + 0.16, w: colW, h: 0.3, fontFace: FONT, fontSize: 12, bold: true, color: col.color, charSpacing: 1.5 });
      slide.addText(mdRuns(col.paras.join('\n\n'), { fontFace: FONT, fontSize: 14, color: COLOR.ink }), {
        x: col.x, y: CONTENT_Y + 0.55, w: colW, h: CONTENT_H - 0.55, valign: 'top', lineSpacing: 19,
      });
    });
  return slide;
}

function renderGallery(pptx, s) {
  const slide = pptx.addSlide();
  slide.background = { color: COLOR.bg };
  addHeader(slide, s.eyebrow, s.heading);
  const n = s.images.length;
  const gap = 0.35;
  const w = (CONTENT_W - gap * (n - 1)) / n;
  const capH = 0.7;
  const imgH = CONTENT_H - capH;
  s.images.forEach((b, i) => {
    const x = CONTENT_X + i * (w + gap);
    imageContain(slide, b.image, x, CONTENT_Y, w, imgH);
    slide.addShape('rect', { x, y: CONTENT_Y + imgH, w, h: capH, fill: { color: 'FFFFFF' }, line: { color: COLOR.line, width: 1 } });
    slide.addText(b.caption || '', { x: x + 0.15, y: CONTENT_Y + imgH + 0.06, w: w - 0.3, h: capH - 0.12, fontFace: FONT, fontSize: 11.5, color: '5C5647', valign: 'top' });
  });
  return slide;
}

function renderStatement(pptx, s) {
  const slide = pptx.addSlide();
  slide.background = { color: COLOR.bg };
  addHeader(slide, s.eyebrow, s.heading);
  slide.addText(mdRuns(s.text, { fontFace: FONT, fontSize: 19, bold: true, color: COLOR.ink }), {
    x: CONTENT_X, y: CONTENT_Y, w: CONTENT_W, h: 0.9, valign: 'top', lineSpacing: 24,
  });
  const imgY = CONTENT_Y + 1.0, imgH = CONTENT_H - 1.0;
  if (s.image) imageContain(slide, s.image, CONTENT_X, imgY, CONTENT_W, imgH);
  else placeholderBox(slide, CONTENT_X, imgY, CONTENT_W, imgH, s.caption);
  return slide;
}

const RENDERERS = {
  cover: renderCover,
  prose: renderProse,
  'results-scorers': renderResultsScorers,
  'valutazione-combined': renderValutazione,
  'valutazione-single': renderValutazione,
  gallery: renderGallery,
  statement: renderStatement,
};

async function buildPptxBuffer(data) {
  const model = buildSlideModel(data);
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = data.meta.authorName || '';
  pptx.title = `Analisi Avversario - ${data.meta.opponent || ''}`;
  model.forEach(s => RENDERERS[s.type](pptx, s));
  return pptx.write({ outputType: 'nodebuffer' });
}

module.exports = { buildPptxBuffer };
