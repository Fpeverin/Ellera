// Estrazione .docx lato Node: molto più robusta del .pdf, perché un .docx è uno zip con XML
// vero (paragrafi e grassetto espliciti) e le immagini sono i byte originali incorporati
// (nessuna ri-decodifica: quasi impossibile che un'immagine "fallisca"). La logica di
// interpretazione del contenuto (titoli, sezioni, blocchi) è condivisa con
// pdf-extract-node.js via doc-state-parser.js.
const JSZip = require('jszip');
const { XMLParser } = require('fast-xml-parser');
const { parseState } = require('./doc-state-parser.js');

// trimValues:false è essenziale: Word marca gli spazi significativi ai bordi di un run con
// <w:t xml:space="preserve"> — uno spazio come UNICO contenuto di un nodo (es. fra un nome
// in grassetto e il testo normale) verrebbe altrimenti tagliato dal parser, incollando le
// parole ("Il**Tavernelle**arriva" invece di "Il **Tavernelle** arriva").
const parser = new XMLParser({ preserveOrder: true, ignoreAttributes: false, attributeNamePrefix: '@_', trimValues: false });

// -- helpers generici per l'AST "preserveOrder" di fast-xml-parser: ogni nodo è
// {tagName: [figli...], ':@': {attributi}} dentro un array che ne preserva l'ordine reale.
function walk(node, visit) {
  if (Array.isArray(node)) { node.forEach(n => walk(n, visit)); return; }
  if (node && typeof node === 'object') {
    for (const k of Object.keys(node)) {
      if (k === ':@' || k === '#text') continue;
      visit(k, node[k], node[':@'] || {});
      walk(node[k], visit);
    }
  }
}
function findAll(root, tag) {
  const out = [];
  walk(root, (k, children, attrs) => { if (k === tag) out.push({ children, attrs }); });
  return out;
}
function getText(children) {
  let s = '';
  walk(children, (k, v) => {}); // no-op, kept for symmetry
  (function rec(n) {
    if (Array.isArray(n)) { n.forEach(rec); return; }
    if (n && typeof n === 'object') {
      if ('#text' in n) s += n['#text'];
      for (const k of Object.keys(n)) if (k !== ':@') rec(n[k]);
    }
  })(children);
  return s;
}

async function extractStateFromDocx(docxBytes, onWarning) {
  const zip = await JSZip.loadAsync(docxBytes);

  const docXmlFile = zip.file('word/document.xml');
  if (!docXmlFile) throw new Error('non è un .docx valido (manca word/document.xml)');
  const xml = await docXmlFile.async('string');
  const ast = parser.parse(xml);

  // mappa rId -> percorso nel zip (word/_rels/document.xml.rels)
  const relMap = {};
  const relsFile = zip.file('word/_rels/document.xml.rels');
  if (relsFile) {
    const relsXml = await relsFile.async('string');
    const relsAst = parser.parse(relsXml);
    findAll(relsAst, 'Relationship').forEach(({ attrs }) => {
      if (attrs['@_Id'] && attrs['@_Target']) relMap[attrs['@_Id']] = attrs['@_Target'];
    });
  }

  const bodyNode = findAll(ast, 'w:body')[0];
  if (!bodyNode) throw new Error('non è un .docx valido (manca w:body)');

  // paragrafi in ordine reale nel documento: quelli diretti del body, più quelli dentro le
  // tabelle (es. il riquadro della copertina), espansi al loro posto.
  const paragraphs = [];
  bodyNode.children.forEach(item => {
    if ('w:p' in item) paragraphs.push(item);
    else if ('w:tbl' in item) findAll(item['w:tbl'], 'w:p').forEach(p => paragraphs.push({ 'w:p': p.children }));
  });

  // immagini incorporate: lette una volta, per rId, come byte grezzi (nessuna decodifica).
  const imageCache = {};
  async function loadImage(rId) {
    if (rId in imageCache) return imageCache[rId];
    const target = relMap[rId];
    if (!target) { imageCache[rId] = null; return null; }
    const mediaPath = 'word/' + target.replace(/^\.?\//, '');
    const file = zip.file(mediaPath);
    if (!file) { imageCache[rId] = null; return null; }
    try {
      const buf = await file.async('nodebuffer');
      const ext = (mediaPath.match(/\.([a-z0-9]+)$/i) || [, 'png'])[1].toLowerCase();
      const mime = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', bmp: 'image/bmp', webp: 'image/webp' }[ext] || 'image/png';
      if (!/^(image\/(jpeg|png|gif|bmp|webp))$/.test(mime)) { imageCache[rId] = null; return null; } // es. .emf/.wmf: non decodificabili dal browser
      const dataUrl = 'data:' + mime + ';base64,' + buf.toString('base64');
      imageCache[rId] = dataUrl;
      return dataUrl;
    } catch (e) {
      if (onWarning) onWarning(`immagine saltata (${mediaPath}): ${e.message}`);
      imageCache[rId] = null;
      return null;
    }
  }

  // costruisce il flusso lineare {type, text, newParagraph, imgObj} atteso da parseState.
  // Ogni <w:p> del docx è già un paragrafo vero: non serve alcuna euristica di posizione
  // come nel PDF. Le liste puntate del template sono vere liste Word (<w:numPr>), non
  // testo con "•": lo si ripristina qui per riusare invariata la logica di parseState.
  const entries = [];
  for (const p of paragraphs) {
    const pChildren = p['w:p'];
    const pPr = findAll(pChildren, 'w:pPr')[0];
    const isListItem = pPr && findAll(pPr.children, 'w:numPr').length > 0;

    const runs = findAll(pChildren, 'w:r');
    const textParts = [];
    for (const run of runs) {
      const rPr = findAll(run.children, 'w:rPr')[0];
      const boldNodes = rPr ? findAll(rPr.children, 'w:b') : [];
      const isBold = boldNodes.length > 0 && boldNodes[0].attrs['@_w:val'] !== '0' && boldNodes[0].attrs['@_w:val'] !== 'false';
      const text = getText(findAll(run.children, 'w:t'));
      if (text) textParts.push(isBold ? '**' + text + '**' : text);

      for (const blip of findAll(run.children, 'a:blip')) {
        const rId = blip.attrs['@_r:embed'];
        if (!rId) continue;
        const dataUrl = await loadImage(rId);
        if (dataUrl) entries.push({ type: 'image', imgObj: { dataUrl } });
        else if (onWarning) onWarning(`immagine non incorporabile saltata (rId ${rId})`);
      }
    }

    let text = textParts.join('').replace(/[ \t]+/g, ' ').trim();
    if (!text) continue;
    if (isListItem) text = '• ' + text;
    entries.push({ type: 'text', text, newParagraph: true });
  }

  const state = parseState(entries);
  // l'estrattore docx restituisce già data URL pronte: nessuna conversione da fare.
  const toDataUrl = (imgObj) => (imgObj ? imgObj.dataUrl : null);
  state.crestLogo = toDataUrl(state.crestLogo);
  state.agencyLogo = state.agencyLogo ? toDataUrl(state.agencyLogo) : state.crestLogo;
  [state.possession, state.nonPossession, state.setPiecesFor, state.setPiecesAgainst].forEach(section => {
    section.blocks.forEach(b => { if (b.image) b.image = toDataUrl(b.image); });
  });
  return state;
}

module.exports = { extractStateFromDocx };
