/* Les 10 modules de leçons. Chaque leçon génère un texte différent à chaque essai. */
(function () {
  const DD = window.DD;
  const T = DD.Text;

  const HOME = 'qsdfghjklm';
  const TOP = 'azertyuiop';
  const BOT = 'wxcvbn';
  const ALPHA = HOME + TOP + BOT;

  // Raccourcis de fabrication
  const lesson = (id, title, desc, gen, extra) => Object.assign({ id, title, desc, gen, minAcc: 90, minWpm: 0 }, extra);
  const drill = (chars, focus, len) => () => T.drill(chars, len || 70, focus);
  const mix = (chars, focus, len, real) => () => T.mix({ chars, focus, len: len || 80, real: real == null ? 0.6 : real });
  const accentMix = (allowed, focus, len) => () => T.mix({ chars: ALPHA + allowed, focus, len: len || 90, pool: T.WORDS, real: 0.97 });
  const wordsOf = (filter, len) => () => T.fill(T.PLAIN.filter(filter), len || 90);

  const modules = [
    {
      id: 1,
      title: 'Rangée de base',
      short: 'Rangée de base',
      icon: '🏠',
      desc: "Pose les huit doigts sur Q S D F et J K L M, les pouces sur la barre d'espace. C'est ta position de repos : tu y reviens après chaque touche.",
      keys: HOME,
      lessons: [
        lesson('1.1', 'F et J : les index', 'Les deux touches avec un repère en relief.', drill('fj', 'fj', 60)),
        lesson('1.2', 'D et K : les majeurs', 'On ajoute les majeurs.', drill('fjdk', 'dk', 70)),
        lesson('1.3', 'S et L : les annulaires', 'On ajoute les annulaires.', drill('fjdksl', 'sl', 80)),
        lesson('1.4', 'Q et M : les auriculaires', 'Les petits doigts, souvent les plus paresseux.', drill('fjdkslqm', 'qm', 80)),
        lesson('1.5', 'G et H : les index qui se déplacent', 'Les index vont chercher une touche vers le centre.', drill(HOME, 'gh', 90)),
        lesson('1.6', 'Révision de la rangée de base', 'Toute la rangée, sans regarder.', drill(HOME, '', 110)),
      ],
      skip: { gen: drill(HOME, '', 130), minWpm: 25 },
    },
    {
      id: 2,
      title: 'Rangée du haut',
      short: 'Rangée du haut',
      icon: '⬆️',
      desc: 'A Z E R T Y U I O P : chaque doigt monte, tape, puis revient à sa touche de repos.',
      keys: TOP,
      lessons: [
        lesson('2.1', 'R et U : les index', '', mix(HOME + 'ru', 'ru', 80)),
        lesson('2.2', 'E et I : les majeurs', '', mix(HOME + 'ruei', 'ei', 80)),
        lesson('2.3', 'Z et O : les annulaires', '', mix(HOME + 'rueizo', 'zo', 80)),
        lesson('2.4', 'A et P : les auriculaires', '', mix(HOME + 'rueizoap', 'ap', 80)),
        lesson('2.5', 'T et Y : les index', '', mix(HOME + TOP, 'ty', 90)),
        lesson('2.6', 'Révision des deux rangées', '', mix(HOME + TOP, '', 110, 0.8)),
      ],
      skip: { gen: mix(HOME + TOP, '', 130, 0.8), minWpm: 25 },
    },
    {
      id: 3,
      title: 'Rangée du bas',
      short: 'Rangée du bas',
      icon: '⬇️',
      desc: "W X C V B N : les doigts descendent d'un cran. Toutes les lettres de l'alphabet sont à toi après ce module.",
      keys: BOT,
      lessons: [
        lesson('3.1', 'V et B : l\'index gauche', '', mix(HOME + TOP + 'vb', 'vb', 80)),
        lesson('3.2', 'N : l\'index droit', '', mix(HOME + TOP + 'vbn', 'n', 80)),
        lesson('3.3', 'C et X : majeur et annulaire', '', mix(HOME + TOP + 'vbncx', 'cx', 80)),
        lesson('3.4', 'W : l\'auriculaire gauche', '', mix(ALPHA, 'w', 80)),
        lesson('3.5', "Révision : tout l'alphabet", '', mix(ALPHA, '', 110, 0.85)),
      ],
      skip: { gen: mix(ALPHA, '', 130, 0.85), minWpm: 25 },
    },
    {
      id: 4,
      title: 'Mots et phrases',
      short: 'Mots et phrases',
      icon: '📝',
      desc: 'Des vrais mots, des phrases simples. Le but : un rythme régulier, sans à-coups.',
      keys: '',
      lessons: [
        lesson('4.1', 'Mots courts', '2 à 4 lettres.', wordsOf((w) => w.length <= 4, 80)),
        lesson('4.2', 'Mots moyens', '5 à 7 lettres.', wordsOf((w) => w.length >= 5 && w.length <= 7, 90)),
        lesson('4.3', 'Mots longs', '8 lettres ou plus.', wordsOf((w) => w.length >= 8, 100)),
        lesson('4.4', 'Lettres rares', 'W, X, Y, Z, K, Q, V.', () => T.mix({ chars: ALPHA, focus: 'wxyzkqv', len: 90, real: 0.9 })),
        lesson('4.5', 'Phrases simples', 'Sans majuscules ni ponctuation.', () => T.sentences(T.SIMPLE, 130)),
      ],
      skip: { gen: () => T.sentences(T.SIMPLE, 130), minWpm: 25 },
    },
    {
      id: 5,
      title: 'Majuscules',
      short: 'Majuscules',
      icon: '🔠',
      desc: "Pour une majuscule, on tient Maj avec l'auriculaire de la main opposée à la lettre : Maj droite pour les lettres de la main gauche, et inversement.",
      keys: '',
      lessons: [
        lesson('5.1', 'Lettres de la main gauche', 'Maj droite + lettre.', () => T.capsWords('L', 85)),
        lesson('5.2', 'Lettres de la main droite', 'Maj gauche + lettre.', () => T.capsWords('R', 85)),
        lesson('5.3', 'Noms propres', 'Prénoms et villes.', () => T.fill(T.NAMES_PLAIN.concat(T.CITIES), 95)),
        lesson('5.4', 'Début de phrase', 'Une majuscule au début de chaque phrase.', () => T.sentenceArr(T.SIMPLE, 130).map(T.cap).join(' ')),
      ],
      skip: { gen: () => T.fill(T.NAMES_PLAIN.concat(T.CITIES).concat(T.PLAIN.map(T.cap)), 130), minWpm: 25 },
    },
    {
      id: 6,
      title: 'Accents',
      short: 'Accents',
      icon: 'é',
      desc: 'é è à ç ù sont sur des touches directes. Pour ê â î ô û : touche ^ puis la lettre (touche morte).',
      keys: 'éèàçù',
      lessons: [
        lesson('6.1', 'É', "L'accent aigu, le plus fréquent.", accentMix('é', 'é', 90)),
        lesson('6.2', 'È et À', 'Accent grave.', accentMix('éèà', 'èà', 90)),
        lesson('6.3', 'Ç et Ù', 'La cédille et le ù de « où ».', accentMix('éèàçù', 'çù', 90)),
        lesson('6.4', 'Ê et Â', 'Touche ^, puis la lettre.', accentMix('éèàçùêâ', 'êâ', 90)),
        lesson('6.5', 'Î, Ô et Û', 'Même principe avec ^.', accentMix('éèàçùêâîôû', 'îôû', 90)),
        lesson('6.6', 'Révision des accents', '', accentMix('éèàçùêâîôû', 'éèàçùêâîôû', 120)),
      ],
      skip: { gen: accentMix('éèàçùêâîôû', 'éèàçùêâîôû', 130), minWpm: 25 },
    },
    {
      id: 7,
      title: 'Chiffres',
      short: 'Chiffres',
      icon: '🔢',
      desc: 'Sur un clavier AZERTY, les chiffres demandent Maj. Même règle : Maj de la main opposée.',
      keys: '1234567890',
      lessons: [
        lesson('7.1', '1, 2, 3', '', () => T.digits('123', 60, '123')),
        lesson('7.2', '4, 5, 6', '', () => T.digits('123456', 70, '456')),
        lesson('7.3', '7, 8, 9, 0', '', () => T.digits('1234567890', 80, '7890')),
        lesson('7.4', 'Révision des chiffres', '', () => T.digits('1234567890', 100, '')),
        lesson('7.5', 'Dates, prix et téléphones', '', () => T.numbers(110)),
      ],
      skip: { gen: () => T.numbers(120), minWpm: 20 },
    },
    {
      id: 8,
      title: 'Ponctuation',
      short: 'Ponctuation',
      icon: '❓',
      desc: ". , ; : ! ? ' \" ( ) - /. En français, on laisse une espace avant ? ! ; :",
      keys: ".,;:!?'\"()-/",
      lessons: [
        lesson('8.1', 'Point et virgule', '. et ,', () => T.punct(['.', ',', ','], 100)),
        lesson('8.2', 'Ponctuation double', '; : ! ?', () => T.punct(['?', '!', ';', ':'], 100)),
        lesson('8.3', 'Apostrophes, guillemets, parenthèses', '\' " ( )', () =>
          T.fill(T.APOS.concat(T.PLAIN.filter((w) => w.length <= 6).flatMap((w) => ['(' + w + ')', '"' + w + '"'])), 100)),
        lesson('8.4', 'Tirets et barres', '- et /', () => T.fill(T.HYPH.concat(T.SLASH), 100)),
        lesson('8.5', 'Phrases ponctuées', 'Tout ensemble.', () => T.sentences(T.SENTENCES, 150)),
      ],
      skip: { gen: () => T.sentences(T.SENTENCES, 150), minWpm: 20 },
    },
    {
      id: 9,
      title: 'Vitesse',
      short: 'Vitesse',
      icon: '⚡',
      desc: "Des objectifs de vitesse. Garde 95 % de précision : mieux vaut un rythme régulier qu'un sprint plein de fautes.",
      keys: '',
      lessons: [
        lesson('9.1', 'Mots courts, vite', 'Objectif : 25 MPM.', () => T.fill(T.WORDS.filter((w) => w.length <= 5), 110), { minWpm: 25, minAcc: 95 }),
        lesson('9.2', 'Mots longs, rythme régulier', 'Objectif : 30 MPM.', () => T.fill(T.WORDS.filter((w) => w.length >= 7), 110), { minWpm: 30, minAcc: 95 }),
        lesson('9.3', 'Phrases fluides', 'Objectif : 35 MPM.', () => T.sentences(T.SENTENCES, 170), { minWpm: 35, minAcc: 95 }),
        lesson('9.4', 'Sprint', 'Objectif : 40 MPM.', () => T.sentences(T.SENTENCES, 220), { minWpm: 40, minAcc: 95 }),
      ],
    },
    {
      id: 10,
      title: 'Maîtrise',
      short: 'Maîtrise',
      icon: '🏆',
      desc: 'Des vrais paragraphes : accents, majuscules, chiffres, ponctuation. Le test final de ta technique.',
      keys: '',
      lessons: T.PASSAGES.map((p, i) =>
        lesson('10.' + (i + 1), p.title, 'Objectif : ' + (35 + i * 5 + (i > 2 ? 5 : 0)) + ' MPM.', () => p.text, { minWpm: 35 + i * 5 + (i > 2 ? 5 : 0), minAcc: 95 })
      ),
    },
  ];

  // Objectifs de vitesse du module 10 : 35, 40, 45, 55, 60 MPM.

  function find(lessonId) {
    for (const m of modules) {
      const l = m.lessons.find((x) => x.id === lessonId);
      if (l) return { module: m, lesson: l };
    }
    return null;
  }

  // Prochaine leçon à faire (première non terminée du premier module ouvert et inachevé).
  function next() {
    const S = DD.Store;
    for (let i = 0; i < modules.length; i++) {
      const m = modules[i];
      if (S.moduleDone(m)) continue;
      if (!S.moduleUnlocked(modules, i)) break;
      const l = m.lessons.find((x) => !(S.lesson(x.id) && S.lesson(x.id).done));
      if (l) return { module: m, lesson: l };
    }
    return null;
  }

  function after(lessonId) {
    const f = find(lessonId);
    if (!f) return null;
    const i = f.module.lessons.indexOf(f.lesson);
    if (i < f.module.lessons.length - 1) return { module: f.module, lesson: f.module.lessons[i + 1] };
    const mi = modules.indexOf(f.module);
    const nm = modules[mi + 1];
    if (nm) return { module: nm, lesson: nm.lessons[0] };
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
      if (h.shift) set.add(h.keys[0] === 'ShiftL' ? 'LP' : 'RP');
    });
    return set;
  }

  DD.Curriculum = { modules, find, next, after, fingersFor, HOME, TOP, BOT, ALPHA };
})();
