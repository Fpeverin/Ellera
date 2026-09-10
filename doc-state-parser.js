// Parser condiviso: trasforma un flusso lineare {type:'text'|'image', text, newParagraph,
// imgObj} — a prescindere dal formato sorgente (.pdf o .docx, ciascuno con il proprio
// estrattore) — nello stato "report-avversario" che genera-slide.js si aspetta.
// Le intestazioni riconosciute sono quelle scritte dal template/skill report-avversario:
// se il documento le rispetta, l'estrazione è affidabile a prescindere da come è stato
// prodotto (Word→PDF, digitato in un altro editor, ecc.).
const HEADINGS = {
  PRES_AVV: 'PRESENTAZIONE AVVERSARIO', ULTIMI: 'ULTIMI RISULTATI:', SCORE: 'SCORE:',
  COPPA: 'PERCORSO IN COPPA', PRES_SQUADRA: 'PRESENTAZIONE SQUADRA', POSSESSO: 'FASE DI POSSESSO PALLA',
  NON_POSSESSO: 'FASE DI NON POSSESSO', FORZA: 'PUNTI DI FORZA', DEBOLI: 'PUNTI DEBOLI',
  PIAZZATI: 'CALCI PIAZZATI', A_FAVORE: 'A favore', CONTRO: 'Contro', LISTE: 'LISTE GARA DISPONIBILI',
};
const ALL_HEADINGS = Object.keys(HEADINGS).map(k => HEADINGS[k]);

function stripBoldMarkers(s) { return s.replace(/\*\*/g, ''); }
function isHeading(entry, text) { return !!entry && entry.type === 'text' && stripBoldMarkers(entry.text).trim() === text; }
function isBullet(entry) { return !!entry && entry.type === 'text' && /^•\s*/.test(entry.text); }
function bulletText(entry) { return entry.text.replace(/^•\s*/, '').trim(); }

// inverte computeScorersLine(): "Bertaina, Okala, Proietti (2)." -> [{name,goals}]
function parseScorersLine(line) {
  const out = [];
  const groupRe = /([^()]+)\((\d+)\)/g;
  let m;
  while ((m = groupRe.exec(line))) {
    const names = m[1].replace(/\.$/, '').split(',').map(s => s.trim()).filter(Boolean);
    const goals = Number(m[2]);
    names.forEach(name => out.push({ name: name.replace(/,$/, '').trim(), goals }));
  }
  return out;
}

function groupParagraphs(textEntries) {
  const paras = [];
  let cur = [];
  textEntries.forEach((e, idx) => {
    if (idx > 0 && e.newParagraph) { if (cur.length) paras.push(cur.join(' ')); cur = []; }
    cur.push(e.text);
  });
  if (cur.length) paras.push(cur.join(' '));
  return paras;
}

function parseState(entries) {
  const state = {
    meta: { title: '', competition: '', opponent: '' },
    crestLogo: null, agencyLogo: null,
    presentation: { system: '', lastResults: [], cupToggle: false, cupResults: [], scorers: [], goalsFor: '', goalsAgainst: '', narrative: '' },
    possession: { intro: '', blocks: [] },
    nonPossession: { intro: '', blocks: [] },
    strengths: '', weaknesses: '',
    setPiecesFor: { bullets: [], blocks: [] },
    setPiecesAgainst: { bullets: [], blocks: [] },
  };

  let i = 0;
  const n = entries.length;
  const peek = () => entries[i];
  const next = () => entries[i++];
  const atHeading = (text) => isHeading(peek(), text);
  const isAnyHeading = (entry) => entry.type === 'text' && ALL_HEADINGS.includes(stripBoldMarkers(entry.text).trim());

  if (peek() && peek().type === 'text') state.meta.title = stripBoldMarkers(next().text);
  while (i < n && !atHeading(HEADINGS.PRES_AVV)) {
    const e = next();
    if (e.type === 'image' && !state.crestLogo) state.crestLogo = e.imgObj;
    else if (e.type === 'text' && !state.meta.competition && stripBoldMarkers(e.text).trim() && !/cura di|gare visionate|^•/i.test(e.text)) {
      state.meta.competition = stripBoldMarkers(e.text);
    }
  }
  if (peek()) next();

  if (peek() && peek().type === 'text' && /^SISTEMA DI GIOCO:/i.test(stripBoldMarkers(peek().text))) {
    state.presentation.system = stripBoldMarkers(next().text).replace(/^SISTEMA DI GIOCO:\s*/i, '');
  }

  function readBulletList(onBullet) {
    let cur = null;
    while (i < n && peek() && peek().type === 'text' && !isAnyHeading(peek())) {
      const e = peek();
      if (isBullet(e)) { next(); if (cur != null) onBullet(cur); cur = bulletText(e); }
      else if (cur != null && !e.newParagraph) { next(); cur += ' ' + e.text.trim(); }
      else break;
    }
    if (cur != null) onBullet(cur);
  }
  function collectParagraphsUntilHeading(stopHeadingText) {
    const buf = [];
    while (i < n && !atHeading(stopHeadingText)) { const e = next(); if (e.type === 'text') buf.push(e); }
    return groupParagraphs(buf).join('\n\n');
  }
  function collectIntroAndBlocks(stopHeadingText, noIntro) {
    const buf = [];
    while (i < n && !atHeading(stopHeadingText)) buf.push(next());
    const blocks = [];
    let introParas = [];
    let pendingTextRun = [];
    let firstImageSeen = false;
    for (const e of buf) {
      if (e.type === 'image') {
        if (!firstImageSeen && !noIntro) {
          const paras = groupParagraphs(pendingTextRun);
          const caption = paras.pop() || '';
          introParas = paras;
          blocks.push({ caption, image: e.imgObj, videoRef: '', videoLink: '' });
        } else {
          const caption = groupParagraphs(pendingTextRun).join(' ');
          blocks.push({ caption, image: e.imgObj, videoRef: '', videoLink: '' });
        }
        pendingTextRun = [];
        firstImageSeen = true;
      } else pendingTextRun.push(e);
    }
    if (pendingTextRun.length) {
      const caption = groupParagraphs(pendingTextRun).join(' ');
      if (firstImageSeen || noIntro) blocks.push({ caption, image: null, videoRef: '', videoLink: '' });
      else introParas = groupParagraphs(pendingTextRun);
    }
    return { intro: introParas.join('\n\n'), blocks };
  }

  if (atHeading(HEADINGS.ULTIMI)) { next(); readBulletList(t => state.presentation.lastResults.push(t)); }
  if (atHeading(HEADINGS.SCORE)) {
    next();
    readBulletList(b => {
      let m;
      if ((m = b.match(/^GOL FATTI:\s*(\d+)/i))) state.presentation.goalsFor = Number(m[1]);
      else if ((m = b.match(/^GOL SUBITI:\s*(\d+)/i))) state.presentation.goalsAgainst = Number(m[1]);
      else if ((m = b.match(/^MARCATORI:\s*(.+)/i))) state.presentation.scorers = parseScorersLine(m[1]);
    });
  }
  if (atHeading(HEADINGS.COPPA)) { next(); state.presentation.cupToggle = true; readBulletList(t => state.presentation.cupResults.push(t)); }
  if (atHeading(HEADINGS.PRES_SQUADRA)) { next(); state.presentation.narrative = collectParagraphsUntilHeading(HEADINGS.POSSESSO); }
  if (atHeading(HEADINGS.POSSESSO)) { next(); state.possession = collectIntroAndBlocks(HEADINGS.NON_POSSESSO); }
  if (atHeading(HEADINGS.NON_POSSESSO)) { next(); state.nonPossession = collectIntroAndBlocks(HEADINGS.FORZA); }
  if (atHeading(HEADINGS.FORZA)) { next(); state.strengths = collectParagraphsUntilHeading(HEADINGS.DEBOLI); }
  if (atHeading(HEADINGS.DEBOLI)) { next(); state.weaknesses = collectParagraphsUntilHeading(HEADINGS.PIAZZATI); }
  if (atHeading(HEADINGS.PIAZZATI)) {
    next();
    if (atHeading(HEADINGS.A_FAVORE)) {
      next();
      const bullets = [];
      readBulletList(t => bullets.push(t));
      const { blocks } = collectIntroAndBlocks(HEADINGS.CONTRO, true);
      state.setPiecesFor = { bullets, blocks };
    }
    if (atHeading(HEADINGS.CONTRO)) {
      next();
      const bullets = [];
      readBulletList(t => bullets.push(t));
      const { blocks } = collectIntroAndBlocks(HEADINGS.LISTE, true);
      state.setPiecesAgainst = { bullets, blocks };
    }
  }

  return state;
}

module.exports = { parseState, HEADINGS, ALL_HEADINGS };
