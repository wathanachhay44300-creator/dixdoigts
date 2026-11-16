/*
 * Les 10 modules.
 *
 * Modules 1, 2, 3 (rangées), 6 (accents) et 7 (chiffres) : leçons en ÉTAPES, uniquement avec les touches
 * de la leçon et celles déjà vues dans la même rangée (aucune phrase) :
 *   intro -> répétition -> alternances -> pseudo-mots -> mots réels (si >= 30 mots) -> mini-test d'1 minute.
 * Modules 4, 5, 8, 9, 10 : leçons classiques (mots, phrases, ponctuation, vitesse), les phrases sont permises.
 * Tous les modules finissent par : 3 séries d'endurance, un test de maîtrise (95 %), une révision en mélange.
 * Les textes viennent du générateur (js/generator.js) : nouveau contenu à chaque essai.
 */
(function () {
  const DD = window.DD;
  const T = DD.Text;
  const G = DD.Gen;

  const HOME = 'qsdfghjklm';
  const TOP = 'azertyuiop';
  const BOT_LETTERS = 'wxcvbn';
  const BOT = BOT_LETTERS + ',;:'; // la rangée du bas : lettres + virgule, point-virgule, deux-points
  const ALPHA = HOME + TOP + BOT_LETTERS;
  const ACCENTS = 'éèàçùêâîôûëï';
  const DIGITS = '1234567890';
  const PUNCT = ".,;:!?'\"()-/";
  const FULL = ALPHA + ALPHA.toUpperCase() + ACCENTS + DIGITS + PUNCT;

  const SERIES_LEN = { short: 60, normal: 150, long: 300 };
  const STAGE_LABELS = {
    intro: 'Introduction',
    repeat: 'Répétition',
    alternate: 'Alternances',
    pseudo: 'Pseudo-mots',
    words: 'Mots réels',
    test: 'Mini-test',
  };
  const END_STEPS = ['e1', 'e2', 'e3', 'mastery', 'revision'];
  const END_SECONDS = { e1: 120, e2: 120, e3: 180, mastery: 120 };
  const CHARS_PER_SEC = 9; // texte généré pour un exercice chronométré : de quoi aller jusqu'à ~110 MPM

  const seriesLen = () => SERIES_LEN[(DD.Store && DD.Store.state.settings.seriesLength) || 'normal'] || 150;
  const fingerOf = (c) => {
    const h = DD.Layout.current().hint(c);
    return h ? h.finger : null;
  };

  function textOf(opts) {
    let r = G.generate(opts);
    if (r.unavailable) r = G.generate(Object.assign({}, opts, { type: 'pseudo' }));
    return r.text;
  }

  // ---- Leçons en étapes ---------------------------------------------------------------------------------
  function staged(id, title, intro, newKeys, allowed, extra) {
    const l = Object.assign({ id, title, desc: intro, intro, staged: true, newKeys, allowed, minAcc: 90, focusShare: 0.3, chars: {} }, extra);
    l.hasWords = () => G.availableWords(l.chars.words || l.allowed, T.WORDS, l.newKeys) >= G.MIN_WORDS;
    l.stages = () => ['intro', 'repeat', 'alternate', 'pseudo'].concat(l.hasWords() ? ['words'] : [], ['test']);
    return l;
  }

  function stageOptions(l, stage, o) {
    o = o || {};
    const len = o.len || seriesLen();
    const chars = l.chars[stage] || l.allowed;
    const base = { chars, focus: l.newKeys, focusWeight: 2, focusShare: l.focusShare, seed: o.seed, len, fingerOf };
    if (stage === 'repeat') return Object.assign(base, { type: 'repeat', focusShare: 0 });
    if (stage === 'alternate') return Object.assign(base, { type: 'alternate' });
    if (stage === 'pseudo') return Object.assign(base, { type: 'pseudo' });
    if (stage === 'words') return Object.assign(base, { type: 'words', pool: T.WORDS, focusOnly: l.newKeys });
    if (stage === 'test')
      return Object.assign(base, {
        type: 'mix',
        kinds: l.hasWords() ? ['alternate', 'pseudo', 'words'] : ['alternate', 'pseudo'],
        pool: T.WORDS,
        focusOnly: l.newKeys,
        len: 60 * CHARS_PER_SEC,
      });
    return null;
  }

  // Texte d'une étape. 'test' : { text, timeLimit: 60 }.
  function stageContent(l, stage, o) {
    const opts = stageOptions(l, stage, o);
    if (!opts) return null;
    return { text: textOf(opts), timeLimit: stage === 'test' ? 60 : 0, minAcc: l.minAcc, opts };
  }

  const accCum = (n) => ['é', 'éèà', 'éèàçù', 'éèàçùêâ', ACCENTS][n]; // accents vus jusqu'à la leçon n
  const accentLesson = (id, title, intro, newKeys, n) =>
    staged(id, title, intro, newKeys, ALPHA + accCum(n), {
      focusShare: 0.5,
      chars: { repeat: accCum(n), alternate: accCum(n) + 'aeiou', pseudo: ALPHA + accCum(n), words: ALPHA + accCum(n), test: ALPHA + accCum(n) },
    });

  // ---- Leçons classiques (modules 4, 5, 8, 9, 10 et fin du 7) ------------------------------------------------------
  const classic = (id, title, desc, gen, extra) => Object.assign({ id, title, desc, gen, minAcc: 90, minWpm: 0 }, extra);
  const wordsOf = (filter, len) => () => T.fill(T.PLAIN.filter(filter), len || 90);

  // ---- Fin de module ---------------------------------------------------------------------------------------------
  const wordsShort = T.WORDS.filter((w) => w.length <= 5);
  const wordsLong = T.WORDS.filter((w) => w.length >= 7);
  const plainShort = T.PLAIN.filter((w) => w.length <= 4);
  const plainLong = T.PLAIN.filter((w) => w.length >= 7);
  const passages = T.PASSAGES.map((p) => p.text);

  const rowEnd = (keys, prev, o) => ({
    keys,
    allowed: keys,
    prev,
    series: [
      { label: 'Répétitions', opts: { type: 'repeat' } },
      { label: 'Alternances', opts: { type: 'alternate' } },
      { label: 'Pseudo-mots et mots', opts: { type: 'mix', kinds: ['pseudo', 'words'], pool: T.WORDS } },
    ],
    mastery: { type: 'mix', kinds: ['alternate', 'pseudo', 'words'], pool: T.WORDS },
    revision: { type: 'mix', kinds: ['pseudo', 'words'], pool: T.WORDS, focusShare: 0.6, focusOnly: keys },
    ...(o || {}),
  });

  // ---- Les modules -----------------------------------------------------------------------------------------------------
  const modules = [
    {
      id: 1,
      title: 'Rangée de base',
      short: 'Rangée de base',
      icon: '🏠',
      desc: "Pose les huit doigts sur Q S D F et J K L M, les pouces sur la barre d'espace. C'est ta position de repos : tu y reviens après chaque touche. Ici, on répète beaucoup et on ne mélange rien.",
      keys: HOME,
      lessons: [
        staged('1.1', 'F et J : les index', 'Pose les index sur F et J, les deux touches avec un petit relief : tout part de là.', 'fj', 'fj'),
        staged('1.2', 'D et K : les majeurs', 'D et K : tes majeurs, juste à côté des index.', 'dk', 'fjdk'),
        staged('1.3', 'S et L : les annulaires', 'S et L : tes annulaires, souvent moins agiles que les autres doigts.', 'sl', 'fjdksl'),
        staged('1.4', 'Q et M : les auriculaires', 'Q et M : tes auriculaires, les plus petits doigts.', 'qm', 'fjdkslqm'),
        staged('1.5', 'G et H : les index qui se déplacent', "G et H : l'index se décale d'une touche vers le centre, puis revient sur F ou J.", 'gh', HOME),
      ],
      skip: { gen: () => revisionText(modules[0]), minWpm: 25 },
      end: rowEnd(HOME, ''),
    },
    {
      id: 2,
      title: 'Rangée du haut',
      short: 'Rangée du haut',
      icon: '⬆️',
      desc: 'A Z E R T Y U I O P : chaque doigt monte, tape, puis revient à sa touche de repos. Seulement la rangée du haut, avec beaucoup de répétitions.',
      keys: TOP,
      lessons: [
        staged('2.1', 'R et U : les index', "R et U : l'index monte d'une rangée, tape, puis revient sur F ou J.", 'ru', 'ru'),
        staged('2.2', 'E et I : les majeurs', 'E et I : les majeurs montent tout droit, au-dessus de D et K.', 'ei', 'ruei'),
        staged('2.3', 'Z et O : les annulaires', 'Z et O : les annulaires montent au-dessus de S et L.', 'zo', 'rueizo'),
        staged('2.4', 'A et P : les auriculaires', 'A et P : les auriculaires montent au-dessus de Q et M.', 'ap', 'rueizoap'),
        staged('2.5', 'T et Y : les index', "T et Y : les index vont chercher une touche vers le centre, en haut.", 'ty', TOP),
      ],
      skip: { gen: () => revisionText(modules[1]), minWpm: 25 },
      end: rowEnd(TOP, HOME),
    },
    {
      id: 3,
      title: 'Rangée du bas',
      short: 'Rangée du bas',
      icon: '⬇️',
      desc: 'W X C V B N , ; : : les doigts descendent d\'un cran. Très peu de mots français s\'écrivent avec ces seules touches : on travaille surtout en répétitions, alternances et pseudo-mots.',
      keys: BOT,
      lessons: [
        staged('3.1', "V et B : l'index gauche", "V et B : l'index gauche descend d'une rangée, sous F et G.", 'vb', 'vb'),
        staged('3.2', 'N et la virgule', "N et la virgule : l'index droit descend sous J, le majeur droit sous K.", 'n,', 'vbn,'),
        staged('3.3', 'C et X : majeur et annulaire', 'C et X : le majeur gauche descend sous D, et l\'annulaire gauche sous S.', 'cx', 'vbn,cx'),
        staged('3.4', "W : l'auriculaire gauche", "W : l'auriculaire gauche descend d'une rangée, tout à gauche.", 'w', 'vbn,cxw'),
        staged('3.5', 'Point-virgule et deux-points', "Point-virgule et deux-points : l'annulaire droit sous L, l'auriculaire droit sous M.", ';:', BOT),
      ],
      skip: { gen: () => revisionText(modules[2]), minWpm: 25 },
      end: rowEnd(BOT, HOME + TOP),
    },
    {
      id: 4,
      title: 'Mots et phrases',
      short: 'Mots et phrases',
      icon: '📝',
      desc: 'Des vrais mots, puis des phrases simples. Le but : un rythme régulier, sans à-coups.',
      keys: '',
      lessons: [
        classic('4.1', 'Mots courts', '2 à 4 lettres.', wordsOf((w) => w.length <= 4, 80)),
        classic('4.2', 'Mots moyens', '5 à 7 lettres.', wordsOf((w) => w.length >= 5 && w.length <= 7, 90)),
        classic('4.3', 'Mots longs', '8 lettres ou plus.', wordsOf((w) => w.length >= 8, 100)),
        classic('4.4', 'Lettres rares', 'W, X, Y, Z, K, Q, V.', () => T.mix({ chars: ALPHA, focus: 'wxyzkqv', len: 90, real: 0.9 })),
        classic('4.5', 'Phrases simples', 'Sans majuscules ni ponctuation.', () => T.sentences(T.SIMPLE, 130)),
      ],
      skip: { gen: () => T.sentences(T.SIMPLE, 130), minWpm: 25 },
      end: {
        keys: '',
        allowed: ALPHA,
        prev: '',
        series: [
          { label: 'Mots courts', opts: { type: 'words', pool: plainShort } },
          { label: 'Mots longs', opts: { type: 'words', pool: plainLong } },
          { label: 'Phrases simples', opts: { type: 'sentences', sentences: T.SIMPLE } },
        ],
        mastery: { type: 'mix', kinds: ['words', 'sentences'], pool: T.PLAIN, sentences: T.SIMPLE },
        revision: { type: 'mix', kinds: ['pseudo', 'words', 'sentences'], pool: T.PLAIN, sentences: T.SIMPLE },
      },
    },
    {
      id: 5,
      title: 'Majuscules',
      short: 'Majuscules',
      icon: '🔠',
      desc: "Pour une majuscule, on tient Maj avec l'auriculaire de la main opposée à la lettre : Maj droite pour les lettres de la main gauche, et inversement.",
      keys: '',
      lessons: [
        classic('5.1', 'Lettres de la main gauche', 'Maj droite + lettre.', () => T.capsWords('L', 85)),
        classic('5.2', 'Lettres de la main droite', 'Maj gauche + lettre.', () => T.capsWords('R', 85)),
        classic('5.3', 'Noms propres', 'Prénoms et villes.', () => T.fill(T.NAMES_PLAIN.concat(T.CITIES), 95)),
        classic('5.4', 'Début de phrase', 'Une majuscule au début de chaque phrase.', () => T.sentenceArr(T.SIMPLE, 130).map(T.cap).join(' ')),
      ],
      skip: { gen: () => T.fill(T.NAMES_PLAIN.concat(T.CITIES).concat(T.PLAIN.map(T.cap)), 130), minWpm: 25 },
      end: {
        keys: '',
        allowed: ALPHA + ALPHA.toUpperCase(),
        prev: '',
        series: [
          { label: 'Mots avec majuscule', opts: { type: 'words', pool: T.PLAIN, caps: true } },
          { label: 'Noms propres', opts: { type: 'words', pool: T.NAMES_PLAIN.concat(T.CITIES) } },
          { label: 'Début de phrase', opts: { type: 'sentences', sentences: T.SIMPLE, caps: true } },
        ],
        mastery: { type: 'mix', kinds: ['words', 'sentences'], pool: T.NAMES_PLAIN.concat(T.CITIES), sentences: T.SIMPLE, caps: true },
        revision: { type: 'mix', kinds: ['pseudo', 'words', 'sentences'], pool: T.NAMES_PLAIN.concat(T.CITIES), sentences: T.SIMPLE, caps: true },
      },
    },
    {
      id: 6,
      title: 'Accents',
      short: 'Accents',
      icon: 'é',
      desc: "é è à ç ù sont sur des touches directes. Â ê î ô û utilisent une touche morte : appuie sur ^ (à droite de P), rien ne s'affiche : c'est normal, puis appuie sur la voyelle. Ë ï : Maj + ^ (cela donne ¨), puis la voyelle. On répète chaque accent avant de le mélanger aux mots.",
      keys: ACCENTS,
      lessons: [
        accentLesson('6.1', 'É', "É : l'accent aigu, avec l'annulaire gauche, sur la rangée des chiffres (la touche du 2).", 'é', 0),
        accentLesson('6.2', 'È et À', "È et À : l'accent grave, sur la rangée des chiffres (È sur le 7, À sur le 0).", 'èà', 1),
        accentLesson('6.3', 'Ç et Ù', 'Ç sur la touche du 9, Ù à droite de M.', 'çù', 2),
        accentLesson('6.4', 'Ê et Â', "Ê et Â : appuie sur ^ (auriculaire droit), rien ne s'affiche : c'est normal, puis appuie sur la voyelle.", 'êâ', 3),
        accentLesson('6.5', 'Î, Ô, Û, Ë et Ï', "Î, Ô, Û : appuie sur ^, rien ne s'affiche : c'est normal, puis sur la voyelle. Ë et Ï : Maj gauche + ^ (cela donne le tréma ¨), rien ne s'affiche non plus, puis la voyelle.", 'îôûëï', 4),
      ],
      skip: { gen: () => revisionText(modules[5]), minWpm: 25 },
      end: {
        keys: ACCENTS,
        allowed: ALPHA + ACCENTS,
        prev: '',
        base: { chars: ACCENTS + 'aeiou', focus: ACCENTS, focusShare: 0.5 },
        series: [
          { label: 'Répétitions', opts: { type: 'repeat', chars: ACCENTS, focusShare: 0 } },
          { label: 'Alternances', opts: { type: 'alternate', chars: ACCENTS + 'aeiou', focusShare: 0.6 } },
          { label: 'Pseudo-mots et mots', opts: { type: 'mix', kinds: ['pseudo', 'words'], chars: ALPHA + ACCENTS, focusShare: 0.5, pool: T.WORDS, focusOnly: ACCENTS } },
        ],
        mastery: { type: 'mix', kinds: ['alternate', 'pseudo', 'words'], chars: ALPHA + ACCENTS, focusShare: 0.5, pool: T.WORDS, focusOnly: ACCENTS },
        revision: { type: 'mix', kinds: ['pseudo', 'words'], chars: ALPHA + ACCENTS, focusShare: 0.6, pool: T.WORDS, focusOnly: ACCENTS },
      },
    },
    {
      id: 7,
      title: 'Chiffres',
      short: 'Chiffres',
      icon: '🔢',
      desc: 'Sur un clavier AZERTY, les chiffres demandent Maj. Même règle : Maj de la main opposée.',
      keys: DIGITS,
      lessons: [
        staged('7.1', '1, 2, 3', 'Les chiffres 1, 2, 3 : sur AZERTY, on les tape avec Maj, tenue par l\'auriculaire de l\'autre main.', '123', '123', { focusShare: 0.35 }),
        staged('7.2', '4, 5, 6', '4, 5, 6 : toujours avec Maj, tenue par la main opposée.', '456', '123456', { focusShare: 0.35 }),
        staged('7.3', '7, 8, 9, 0', '7, 8, 9, 0 : pour les chiffres de la main droite, tiens Maj gauche.', '7890', DIGITS, { focusShare: 0.35 }),
        classic('7.4', 'Dates, prix et téléphones', '', () => T.numbers(110)),
      ],
      skip: { gen: () => revisionText(modules[6]), minWpm: 20 },
      end: {
        keys: DIGITS,
        allowed: DIGITS,
        prev: '',
        series: [
          { label: 'Répétitions', opts: { type: 'repeat' } },
          { label: 'Alternances', opts: { type: 'alternate' } },
          { label: 'Suites de chiffres', opts: { type: 'pseudo' } },
        ],
        mastery: { type: 'mix', kinds: ['alternate', 'pseudo'] },
        revision: { type: 'mix', kinds: ['pseudo', 'alternate'], chars: DIGITS + ALPHA, focusShare: 0.6 },
      },
    },
    {
      id: 8,
      title: 'Ponctuation',
      short: 'Ponctuation',
      icon: '❓',
      desc: ". , ; : ! ? ' \" ( ) - /. En français, on laisse une espace avant ? ! ; :",
      keys: PUNCT,
      lessons: [
        classic('8.1', 'Point et virgule', '. et ,', () => T.punct(['.', ',', ','], 100)),
        classic('8.2', 'Ponctuation double', '; : ! ?', () => T.punct(['?', '!', ';', ':'], 100)),
        classic('8.3', 'Apostrophes, guillemets, parenthèses', '\' " ( )', () =>
          T.fill(T.APOS.concat(T.PLAIN.filter((w) => w.length <= 6).flatMap((w) => ['(' + w + ')', '"' + w + '"'])), 100)),
        classic('8.4', 'Tirets et barres', '- et /', () => T.fill(T.HYPH.concat(T.SLASH), 100)),
        classic('8.5', 'Phrases ponctuées', 'Tout ensemble.', () => T.sentences(T.SENTENCES, 150)),
      ],
      skip: { gen: () => T.sentences(T.SENTENCES, 150), minWpm: 20 },
      end: {
        keys: PUNCT,
        allowed: FULL,
        prev: '',
        series: [
          { label: 'Mots ponctués', opts: { type: 'words', pool: T.APOS.concat(T.HYPH, T.SLASH) } },
          { label: 'Phrases ponctuées', opts: { type: 'sentences', sentences: T.SENTENCES } },
          { label: 'Mélange', opts: { type: 'mix', kinds: ['words', 'sentences'], pool: T.APOS.concat(T.HYPH, T.SLASH), sentences: T.SENTENCES } },
        ],
        mastery: { type: 'sentences', sentences: T.SENTENCES },
        revision: { type: 'mix', kinds: ['words', 'sentences', 'pseudo'], pool: T.APOS.concat(T.HYPH, T.SLASH), sentences: T.SENTENCES },
      },
    },
    {
      id: 9,
      title: 'Vitesse',
      short: 'Vitesse',
      icon: '⚡',
      desc: "Des objectifs de vitesse. Garde 95 % de précision : mieux vaut un rythme régulier qu'un sprint plein de fautes.",
      keys: '',
      lessons: [
        classic('9.1', 'Mots courts, vite', 'Objectif : 25 MPM.', () => T.fill(T.WORDS.filter((w) => w.length <= 5), 110), { minWpm: 25, minAcc: 95 }),
        classic('9.2', 'Mots longs, rythme régulier', 'Objectif : 30 MPM.', () => T.fill(T.WORDS.filter((w) => w.length >= 7), 110), { minWpm: 30, minAcc: 95 }),
        classic('9.3', 'Phrases fluides', 'Objectif : 35 MPM.', () => T.sentences(T.SENTENCES, 170), { minWpm: 35, minAcc: 95 }),
        classic('9.4', 'Sprint', 'Objectif : 40 MPM.', () => T.sentences(T.SENTENCES, 220), { minWpm: 40, minAcc: 95 }),
      ],
      end: {
        keys: '',
        allowed: FULL,
        prev: '',
        series: [
          { label: 'Mots courts', opts: { type: 'words', pool: wordsShort } },
          { label: 'Mots longs', opts: { type: 'words', pool: wordsLong } },
          { label: 'Phrases', opts: { type: 'sentences', sentences: T.SENTENCES } },
        ],
        mastery: { type: 'mix', kinds: ['words', 'sentences'], pool: T.WORDS, sentences: T.SENTENCES },
        revision: { type: 'mix', kinds: ['pseudo', 'words', 'sentences'], pool: T.WORDS, sentences: T.SENTENCES },
      },
    },
    {
      id: 10,
      title: 'Maîtrise',
      short: 'Maîtrise',
      icon: '🏆',
      desc: 'Des vrais paragraphes : accents, majuscules, chiffres, ponctuation. Le test final de ta technique.',
      keys: '',
      lessons: T.PASSAGES.map((p, i) => {
        const goal = 35 + i * 5 + (i > 2 ? 5 : 0); // 35, 40, 45, 55, 60 MPM
        return classic('10.' + (i + 1), p.title, 'Objectif : ' + goal + ' MPM.', () => p.text, { minWpm: goal, minAcc: 95 });
      }),
      end: {
        keys: '',
        allowed: FULL,
        prev: '',
        series: [
          { label: 'Paragraphes', opts: { type: 'sentences', sentences: passages } },
          { label: 'Phrases', opts: { type: 'sentences', sentences: T.SENTENCES } },
          { label: 'Mélange', opts: { type: 'mix', kinds: ['words', 'sentences'], pool: T.WORDS, sentences: passages.concat(T.SENTENCES) } },
        ],
        mastery: { type: 'sentences', sentences: passages },
        revision: { type: 'mix', kinds: ['words', 'sentences'], pool: T.WORDS, sentences: passages.concat(T.SENTENCES) },
      },
    },
  ];

  // ---- Contenu des étapes de fin de module ------------------------------------------------------------------------------------
  function endOptions(m, step, o) {
    o = o || {};
    const e = m.end;
    const base = { chars: e.allowed, focus: e.keys, focusWeight: 2, focusShare: 0, seed: o.seed, fingerOf };
    if (step === 'e1' || step === 'e2' || step === 'e3') {
      const s = e.series[END_STEPS.indexOf(step)];
      return Object.assign(base, e.base || {}, s.opts, { len: END_SECONDS[step] * CHARS_PER_SEC });
    }
    if (step === 'mastery') return Object.assign(base, e.base || {}, e.mastery, { len: END_SECONDS.mastery * CHARS_PER_SEC });
    // Révision en mélange : au moins 50 % de touches du module, le reste vient des modules précédents.
    return Object.assign(base, { chars: e.allowed + (e.prev || '') }, e.revision, { len: Math.max(150, o.len || seriesLen()) });
  }

  const endLabel = (m, step) => {
    if (step === 'mastery') return 'Test de maîtrise';
    if (step === 'revision') return 'Révision en mélange';
    return 'Endurance ' + (END_STEPS.indexOf(step) + 1) + '/3 · ' + m.end.series[END_STEPS.indexOf(step)].label;
  };

  // { text, timeLimit (s, 0 = pas de limite), minAcc, label }
  function endContent(m, step, o) {
    const opts = endOptions(m, step, o);
    return {
      text: textOf(opts),
      timeLimit: END_SECONDS[step] || 0,
      minAcc: step === 'mastery' ? 95 : 90,
      label: endLabel(m, step),
      opts,
    };
  }
  function revisionText(m) {
    return endContent(m, 'revision', { len: 150 }).text;
  }

  // ---- Navigation dans le programme ------------------------------------------------------------------------------------------------
  function find(lessonId) {
    for (const m of modules) {
      const l = m.lessons.find((x) => x.id === lessonId);
      if (l) return { module: m, lesson: l };
    }
    return null;
  }

  // Prochaine chose à faire (le « Recommandé » et le bouton « Continuer ») : la PREMIÈRE leçon non validée du
  // parcours, ou l'étape de fin de module. Elle ne dépend jamais de ce qui est déverrouillé : seules les
  // validations comptent. (Le premier module non validé est toujours atteint, puisque les précédents sont validés.)
  function next() {
    const S = DD.Store;
    for (let i = 0; i < modules.length; i++) {
      const m = modules[i];
      if (S.moduleDone(m)) continue;
      const l = m.lessons.find((x) => !(S.lesson(x.id) && S.lesson(x.id).done));
      if (l) return { module: m, lesson: l };
      const step = END_STEPS.find((s) => !S.endDone(m.id, s));
      if (step) return { module: m, end: step };
    }
    return null;
  }

  function after(lessonId) {
    const f = find(lessonId);
    if (!f) return null;
    const i = f.module.lessons.indexOf(f.lesson);
    if (i < f.module.lessons.length - 1) return { module: f.module, lesson: f.module.lessons[i + 1] };
    // Après la dernière leçon : la fin de module, puis le module suivant.
    const step = END_STEPS.find((s) => !DD.Store.endDone(f.module.id, s));
    if (step) return { module: f.module, end: step };
    const nm = modules[modules.indexOf(f.module) + 1];
    return nm ? { module: nm, lesson: nm.lessons[0] } : null;
  }

  // « Cet exercice est conseillé après X » : ce qui précède un module ou une leçon dans le parcours.
  function adviceAfter(target) {
    const m = target.module;
    if (target.lesson) {
      const i = m.lessons.indexOf(target.lesson);
      if (i > 0) return 'la leçon ' + m.lessons[i - 1].id + ' (« ' + m.lessons[i - 1].title + ' »)';
    }
    const j = modules.indexOf(m);
    if (j > 0) return 'le module ' + modules[j - 1].id + ' (« ' + modules[j - 1].title + ' »)';
    return null;
  }

  // Doigts utilisés par un ensemble de caractères
  function fingersFor(chars) {
    const layout = DD.Layout.current();
    const set = new Set();
    Array.from(chars).forEach((c) => {
      const h = layout.hint(c);
      if (!h) return;
      set.add(h.finger);
      // tous les doigts qui interviennent : Maj, touche morte, AltGr, voyelle...
      h.keys.forEach((id) => layout.keys[id] && set.add(layout.keys[id].f));
    });
    return set;
  }

  DD.Curriculum = {
    modules, find, next, after, adviceAfter, fingersFor,
    stageContent, stageOptions, endContent, endOptions, endLabel, seriesLen,
    STAGE_LABELS, END_STEPS, END_SECONDS, SERIES_LEN, CHARS_PER_SEC,
    HOME, TOP, BOT, ALPHA, ACCENTS, DIGITS, PUNCT, FULL,
  };
})();
