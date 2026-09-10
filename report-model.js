// Modello di contenuto condiviso: trasforma il json "Analisi Avversario" in un elenco di
// slide astratte (tipo + contenuto), a prescindere da come poi vengono renderizzate.
// Usato sia da slide-engine.js (HTML) sia da pptx-engine.js (PowerPoint), così le due
// versioni restano sempre sincronizzate — le regole su quali slide includere e come
// raggruppare le immagini vivono in un solo posto.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.buildSlideModel = factory().buildSlideModel;
})(typeof self !== 'undefined' ? self : this, function () {

// Preferenze di default per il taglio delle slide (decise dopo aver confrontato l'output
// generico con la versione curata a mano per Terni FC): niente slide "sistema di gioco" a sé
// stante, né "punti di forza/deboli", né i paragrafi introduttivi di possesso/non possesso —
// solo le situazioni osservate — e al massimo 2 immagini per slide nelle gallerie.
const INCLUDE_SISTEMA_DI_GIOCO_SLIDE = false;
const INCLUDE_VALUTAZIONE_SLIDES = false;
const INCLUDE_PHASE_INTRO_SLIDES = false;
const IMAGES_PER_GALLERY_SLIDE = 2;

function paragraphs(s) {
  return String(s ?? '').split(/\n\n+/).map(p => p.trim()).filter(Boolean);
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// Prova più pattern noti per le righe di "ultimi risultati": il testo è libero (scritto
// dall'utente durante l'intervista, o letto da un PDF), quindi se nessun pattern combacia
// si mostra la riga così com'è, senza inventare una struttura.
function parseResult(line) {
  const buildResult = (t1, s1, t2, s2, note) => {
    const isT1Terni = /terni/i.test(t1);
    const isT2Terni = /terni/i.test(t2);
    const terniScore = isT1Terni ? +s1 : (isT2Terni ? +s2 : null);
    const oppScore = isT1Terni ? +s2 : (isT2Terni ? +s1 : null);
    let outcome = 'draw';
    if (terniScore !== null && oppScore !== null) {
      if (terniScore > oppScore) outcome = 'win';
      else if (terniScore < oppScore) outcome = 'loss';
    }
    return {
      t1: t1.trim(), s1, s2, t2: t2.trim(),
      isT1Terni, isT2Terni, outcome,
      note: note ? note.replace(/^\(|\)$/g, '') : ''
    };
  };
  // "TEAM1 - TEAM2 N-M (nota)"
  let m = line.match(/^(.+?)\s*-\s*(.+?)\s+(\d+)\s*-\s*(\d+)\s*(\(.*\))?\s*$/);
  if (m) return buildResult(m[1], m[3], m[2], m[4], m[5]);
  // "TEAM1 N - M TEAM2"
  m = line.match(/^(.+?)\s+(\d+)\s*-\s*(\d+)\s+(.+)$/);
  if (m) return buildResult(m[1], m[2], m[4], m[3]);
  return { raw: line };
}

function buildSlideModel(data) {
  const model = [];

  model.push({ type: 'cover', title: data.meta.title, opponent: data.meta.opponent, competition: data.meta.competition, crestLogo: data.crestLogo, agencyLogo: data.agencyLogo });

  if (INCLUDE_SISTEMA_DI_GIOCO_SLIDE) {
    model.push({
      type: 'prose', section: 'presentazione',
      eyebrow: 'Presentazione · Sistema di gioco', heading: `Come gioca ${data.meta.opponent}`,
      chip: data.presentation.system, paragraphs: paragraphs(data.presentation.narrative),
    });
  }

  model.push({
    type: 'results-scorers', section: 'presentazione',
    eyebrow: 'Presentazione · Rendimento', heading: 'Ultimi risultati e marcatori',
    results: data.presentation.lastResults.map(parseResult),
    goalsFor: data.presentation.goalsFor, goalsAgainst: data.presentation.goalsAgainst,
    scorers: data.presentation.scorers,
  });

  if (INCLUDE_VALUTAZIONE_SLIDES) {
    const combinedLength = (data.strengths || '').length + (data.weaknesses || '').length;
    if (combinedLength > 1300) {
      model.push({ type: 'valutazione-single', section: 'presentazione', eyebrow: 'Presentazione · Valutazione', heading: 'Punti di forza', kind: 'good', paragraphs: paragraphs(data.strengths) });
      model.push({ type: 'valutazione-single', section: 'presentazione', eyebrow: 'Presentazione · Valutazione', heading: 'Punti deboli', kind: 'bad', paragraphs: paragraphs(data.weaknesses) });
    } else {
      model.push({ type: 'valutazione-combined', section: 'presentazione', eyebrow: 'Presentazione · Valutazione', heading: 'Punti di forza e punti deboli', strengthsParas: paragraphs(data.strengths), weaknessesParas: paragraphs(data.weaknesses) });
    }
  }

  function phaseSlides(sectionId, eyebrowBase, proseHeading, galleryHeading, intro, blocks, chip) {
    const paraChunks = INCLUDE_PHASE_INTRO_SLIDES ? chunk(paragraphs(intro), 2) : [];
    const imgChunks = chunk((blocks || []).filter(b => b && b.image), IMAGES_PER_GALLERY_SLIDE);
    const total = paraChunks.length + imgChunks.length;
    paraChunks.forEach((pc, i) => model.push({
      type: 'prose', section: sectionId, eyebrow: `${eyebrowBase} · ${i + 1}/${total}`, heading: proseHeading,
      chip: i === 0 ? chip : null, paragraphs: pc,
    }));
    imgChunks.forEach((ic, j) => model.push({
      type: 'gallery', section: sectionId, eyebrow: `${eyebrowBase} · ${paraChunks.length + j + 1}/${total}`, heading: galleryHeading,
      images: ic.map(b => ({ image: b.image, caption: b.caption || '' })),
    }));
  }

  phaseSlides('possesso', 'Fase di possesso', 'Costruzione e sviluppo del possesso', 'Situazioni osservate', data.possession.intro, data.possession.blocks, data.presentation.system);
  phaseSlides('pressing', 'Fuori possesso', 'Comportamento senza palla', 'Situazioni osservate', data.nonPossession.intro, data.nonPossession.blocks, null);

  function piazzatiSlides(side, bullets, blocks) {
    const label = side === 'favore' ? 'A favore' : 'Contro';
    const heading = side === 'favore' ? 'Calcio piazzato a favore' : 'Calcio piazzato contro';
    bullets.forEach((text, i) => {
      const block = blocks[i];
      model.push({
        type: 'statement', section: 'piazzati',
        eyebrow: `Calci piazzati · ${label} · ${i + 1}/${bullets.length}`, heading,
        text, image: block && block.image ? block.image : null, caption: block ? block.caption : '',
      });
    });
  }
  piazzatiSlides('favore', data.setPiecesFor.bullets, data.setPiecesFor.blocks);
  piazzatiSlides('contro', data.setPiecesAgainst.bullets, data.setPiecesAgainst.blocks);

  return model;
}

return {
  buildSlideModel: buildSlideModel,
  constants: { INCLUDE_SISTEMA_DI_GIOCO_SLIDE, INCLUDE_VALUTAZIONE_SLIDES, INCLUDE_PHASE_INTRO_SLIDES, IMAGES_PER_GALLERY_SLIDE },
};

});
