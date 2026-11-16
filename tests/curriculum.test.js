// Tests du programme : modules, leçons en étapes, fins de module, migration des données.
// Lancer : node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadSite, SITE_BASE } = require('./helpers.js');

const DD = loadSite(SITE_BASE);
const C = DD.Curriculum;
const T = DD.Text;
const SEEDS = Array.from({ length: 25 }, (_, i) => i + 1);
const nonSpace = (t) => Array.from(t).filter((c) => c !== ' ');
const staged = (m) => m.lessons.filter((l) => l.staged);
const ROW_MODULES = C.modules.filter((m) => [1, 2, 3].includes(m.id));

// Toutes les phrases du corpus (une phrase = un texte avec majuscule, ponctuation de fin ou plusieurs mots liés)
const SENTENCES = T.SIMPLE.concat(T.SENTENCES, T.PASSAGES.map((p) => p.text));

function stagesOf(l) {
  return l.stages().filter((s) => s !== 'intro');
}
// Touches déjà introduites à la leçon i du module : les nouvelles touches de toutes les leçons jusqu'à i.
function introduced(m, i) {
  return new Set(
    m.lessons
      .slice(0, i + 1)
      .filter((l) => l.staged)
      .flatMap((l) => Array.from(l.newKeys))
  );
}

test('modules 1 à 3 : les leçons sont en 6 étapes (intro, répétition, alternances, pseudo-mots, mots si >= 30, mini-test)', () => {
  for (const m of ROW_MODULES) {
    assert.ok(m.lessons.length >= 5);
    for (const l of m.lessons) {
      assert.ok(l.staged, `${l.id} doit être une leçon en étapes`);
      const s = l.stages();
      assert.deepEqual(Array.from(s.slice(0, 4)), ['intro', 'repeat', 'alternate', 'pseudo'], `${l.id}: ordre des étapes`);
      assert.equal(s[s.length - 1], 'test', `${l.id}: le mini-test finit la leçon`);
      assert.ok(l.intro && l.intro.length > 10 && !l.intro.includes('\n'), `${l.id}: une phrase d'introduction`);
      // « mots réels » seulement s'il existe au moins 30 mots différents
      const nWords = DD.Gen.availableWords(l.chars.words || l.allowed, T.WORDS, l.newKeys);
      assert.equal(s.includes('words'), nWords >= 30, `${l.id}: étape mots réels incohérente (${nWords} mots)`);
    }
  }
  // rangée du bas : aucun mot réel (c'est normal)
  for (const l of C.modules[2].lessons) assert.ok(!l.stages().includes('words'), `${l.id}: pas de mots réels dans la rangée du bas`);
  // rangée du haut : les mots n'arrivent qu'avec la rangée complète
  assert.ok(C.modules[1].lessons[4].stages().includes('words'));
});

test('modules 1 à 3 : aucune phrase, nulle part (leçons, endurance, maîtrise, révision, passage)', () => {
  for (const m of ROW_MODULES) {
    // pas de type "phrases" dans la définition
    const defs = [].concat(m.end.series.map((s) => s.opts), m.end.mastery, m.end.revision);
    for (const d of defs) {
      assert.notEqual(d.type, 'sentences', `module ${m.id}: type phrases interdit`);
      assert.ok(!(d.kinds || []).includes('sentences'), `module ${m.id}: phrases interdites dans un mélange`);
    }
    const texts = [];
    for (const seed of SEEDS) {
      for (const l of m.lessons) for (const st of stagesOf(l)) texts.push([l.id + '/' + st, C.stageContent(l, st, { seed }).text]);
      for (const step of C.END_STEPS) texts.push([m.id + '/' + step, C.endContent(m, step, { seed }).text]);
      texts.push([m.id + '/passage', m.skip.gen()]);
    }
    for (const [label, text] of texts) {
      assert.ok(!/[A-ZÉÈÀÇ]/.test(text), `${label}: majuscule (début de phrase)`);
      assert.ok(!/[.?!]/.test(text), `${label}: ponctuation de phrase`);
      for (const s of SENTENCES) assert.ok(!text.includes(s.toLowerCase().slice(0, 12)), `${label}: contient le début d'une phrase du corpus`);
    }
  }
});

test('aucun contenu n\'utilise une touche non encore introduite (leçons en étapes)', () => {
  for (const m of C.modules) {
    m.lessons.forEach((l, i) => {
      if (!l.staged) return;
      if (m.id <= 3) {
        // rangées : uniquement les touches de la leçon et celles déjà vues dans la même rangée
        const intro = introduced(m, i);
        assert.deepEqual(new Set(Array.from(l.allowed)), intro, `${l.id}: les touches autorisées doivent être les touches déjà vues`);
        for (const seed of SEEDS) {
          for (const st of stagesOf(l)) {
            for (const c of nonSpace(C.stageContent(l, st, { seed }).text)) assert.ok(intro.has(c), `${l.id}/${st}: touche non introduite ${JSON.stringify(c)}`);
          }
        }
      } else {
        // accents et chiffres : les lettres déjà apprises + les accents / chiffres déjà vus
        const base = m.id === 6 ? new Set(Array.from(C.ALPHA)) : new Set();
        const intro = new Set([...base, ...introduced(m, i)]);
        for (const seed of SEEDS) {
          for (const st of stagesOf(l)) {
            for (const c of nonSpace(C.stageContent(l, st, { seed }).text)) assert.ok(intro.has(c), `${l.id}/${st}: touche non introduite ${JSON.stringify(c)}`);
          }
        }
      }
    });
  }
});

test('fin de module : endurance et maîtrise = uniquement les touches du module ; révision = module + modules précédents', () => {
  for (const m of ROW_MODULES) {
    const own = new Set(Array.from(m.end.keys));
    const prev = new Set(Array.from(m.end.prev || ''));
    for (const seed of SEEDS) {
      for (const step of ['e1', 'e2', 'e3', 'mastery']) {
        for (const c of nonSpace(C.endContent(m, step, { seed }).text)) assert.ok(own.has(c), `module ${m.id}/${step}: ${c} n'est pas une touche du module`);
      }
      for (const c of nonSpace(C.endContent(m, 'revision', { seed }).text)) assert.ok(own.has(c) || prev.has(c), `module ${m.id}/revision: ${c} n'est ni du module ni d'un module précédent`);
    }
  }
});

test('fin de module : 3 séries d\'endurance de types différents, test de maîtrise à 95 %, durées', () => {
  for (const m of C.modules) {
    assert.equal(m.end.series.length, 3, `module ${m.id}: 3 séries d'endurance`);
    const kinds = m.end.series.map((s) => s.label);
    assert.equal(new Set(kinds).size, 3, `module ${m.id}: les 3 séries doivent être différentes (${kinds.join(', ')})`);
    for (const step of ['e1', 'e2', 'e3']) {
      const c = C.endContent(m, step, { seed: 3 });
      assert.ok(c.timeLimit >= 120 && c.timeLimit <= 180, `module ${m.id}/${step}: 2 à 3 minutes`);
      assert.equal(c.minAcc, 90);
      assert.ok(c.text.length > 100);
    }
    const mastery = C.endContent(m, 'mastery', { seed: 3 });
    assert.equal(mastery.timeLimit, 120, `module ${m.id}: test de maîtrise de 2 minutes`);
    assert.equal(mastery.minAcc, 95);
  }
  // rangées : répétitions, alternances, puis pseudo-mots / mots
  for (const m of ROW_MODULES) assert.deepEqual(Array.from(m.end.series.map((s) => s.opts.type)), ['repeat', 'alternate', 'mix']);
});

test('révision en mélange : au moins 50 % de touches du module (modules 1 à 3, accents, chiffres)', () => {
  for (const m of C.modules.filter((x) => [2, 3, 6, 7].includes(x.id))) {
    const own = new Set(Array.from(m.end.keys));
    for (const seed of SEEDS) {
      const letters = nonSpace(C.endContent(m, 'revision', { seed }).text);
      const share = letters.filter((c) => own.has(c)).length / letters.length;
      assert.ok(share >= 0.5, `module ${m.id}, graine ${seed}: ${(share * 100).toFixed(0)} % de touches du module`);
    }
  }
});

test('phrases : seulement à partir du module 4', () => {
  // module 4 : les phrases apparaissent bien (séries et mélange)
  const m4 = C.modules[3];
  assert.ok(m4.end.series.some((s) => s.opts.type === 'sentences'));
  const text = C.endContent(m4, 'e3', { seed: 1 }).text;
  assert.ok(T.SIMPLE.some((s) => text.includes(s)));
  // modules 5 à 10 : leurs séries finales utilisent des phrases ou des mots, jamais de répétition pure
  for (const m of C.modules.slice(3)) assert.ok(m.end.series.every((s) => s.opts.type !== 'repeat' || [6, 7].includes(m.id)), `module ${m.id}`);
});

test('tout le contenu se tape sur AZERTY Mac et PC', () => {
  for (const id of ['mac', 'pc']) {
    const layout = DD.Layout.get(id);
    for (const m of C.modules) {
      const texts = [];
      for (const l of m.lessons) {
        if (l.staged) for (const st of stagesOf(l)) texts.push(C.stageContent(l, st, { seed: 5 }).text);
        else texts.push(l.gen());
      }
      for (const step of C.END_STEPS) texts.push(C.endContent(m, step, { seed: 5 }).text);
      for (const t of texts) {
        assert.equal(t, t.normalize('NFC'));
        assert.ok(!/^ | $|  /.test(t), `module ${m.id}: espaces en trop`);
        for (const ch of t) assert.ok(layout.hint(ch), `${id}: module ${m.id}: caractère non tapable ${JSON.stringify(ch)}`);
      }
    }
  }
});

test('contenu reproductible avec une graine, et nouveau à chaque essai sans graine', () => {
  const l = C.modules[0].lessons[0];
  assert.equal(C.stageContent(l, 'repeat', { seed: 9 }).text, C.stageContent(l, 'repeat', { seed: 9 }).text);
  const a = C.stageContent(C.modules[0].lessons[4], 'pseudo').text;
  const b = C.stageContent(C.modules[0].lessons[4], 'pseudo').text;
  assert.notEqual(a, b, 'refaire une série doit donner un contenu nouveau');
  const t1 = C.stageContent(l, 'test', { seed: 1 }).text;
  const t2 = C.stageContent(l, 'test', { seed: 2 }).text;
  assert.notEqual(t1, t2);
  assert.equal(C.stageContent(l, 'test').timeLimit, 60, 'mini-test : 1 minute');
});

test('longueur des séries réglable : courte ≈ 60, normale ≈ 150, longue ≈ 300 caractères', () => {
  const l = C.modules[0].lessons[4];
  const expected = { short: 60, normal: 150, long: 300 };
  for (const [key, n] of Object.entries(expected)) {
    DD.Store.state.settings.seriesLength = key;
    assert.equal(C.seriesLen(), n);
    for (const st of ['repeat', 'alternate', 'pseudo']) {
      const len = C.stageContent(l, st, { seed: 4 }).text.length;
      assert.ok(len >= n && len <= n + 8, `${key}/${st}: ${len} caractères pour ${n} demandés`);
    }
  }
  DD.Store.state.settings.seriesLength = 'normal';
});

test('étape de répétition : longueur croissante des groupes', () => {
  const l = C.modules[0].lessons[2];
  DD.Store.state.settings.seriesLength = 'long';
  const toks = C.stageContent(l, 'repeat', { seed: 12 }).text.split(' ');
  const third = Math.floor(toks.length / 3);
  const avg = (a) => a.reduce((s, t) => s + t.length, 0) / a.length;
  assert.ok(avg(toks.slice(-third)) >= avg(toks.slice(0, third)));
  DD.Store.state.settings.seriesLength = 'normal';
});

// ---- Migration des anciennes données ----------------------------------------------------------------------

const LEGACY = {
  v: 1, // ancien format : pas de "schema"
  created: 1700000000000,
  profile: { name: 'Camille' },
  settings: { layout: 'pc', sound: false, soundProfile: 'doux', volume: 0.3, showKeyboard: false, dailyGoalMin: 15, baselineWpm: 82, testDuration: 3, testFingers: 10 },
  lessons: {
    '1.1': { done: true, stars: 3, bestWpm: 31, bestAcc: 99, tries: 2 },
    '1.2': { done: true, stars: 2, bestWpm: 28, bestAcc: 96, tries: 1 },
    '1.3': { done: true, stars: 1, bestWpm: 22, bestAcc: 91, tries: 4 },
    '1.4': { done: true, stars: 2, bestWpm: 25, bestAcc: 95, tries: 1 },
    '1.5': { done: true, stars: 3, bestWpm: 30, bestAcc: 98, tries: 1 },
    '1.6': { done: true, stars: 2, bestWpm: 30, bestAcc: 96, tries: 1 },
    '2.1': { done: true, stars: 2, bestWpm: 24, bestAcc: 95, tries: 1 },
  },
  modules: { 4: { skipped: true, t: 1700000500000 } },
  tests: [
    { t: 1700001000000, dur: 120, fingers: 10, wpm: 41.5, raw: 44, acc: 96.2, ok: 415, bad: 16, series: [30, 40], errs: [0, 1], misses: { e: 3 } },
    { t: 1700002000000, dur: 60, fingers: 2, wpm: 79, raw: 80, acc: 97, ok: 395, bad: 12 },
  ],
  chars: { e: { n: 200, m: 9 }, a: { n: 150, m: 2 } },
  days: { '2023-11-14': { sec: 900, n: 3 }, '2023-11-15': { sec: 700, n: 2 } },
  badges: { 'first-lesson': 1700000100000, 'mod-1': 1700000200000, 'wpm-30': 1700001100000 },
  flags: { skip: true },
};

function legacySite() {
  return loadSite(SITE_BASE, { storage: { 'dixdoigts:v1': JSON.stringify(LEGACY) } });
}

test('migration : étoiles, historique, badges, séries et réglages sont conservés', () => {
  const D = legacySite();
  const st = D.Store.state;
  assert.equal(st.schema, 3);
  assert.equal(st.profile.name, 'Camille');
  assert.equal(st.settings.layout, 'pc');
  assert.equal(st.settings.sound, false);
  assert.equal(st.settings.baselineWpm, 82);
  assert.equal(st.settings.seriesLength, 'normal', 'nouveau réglage : valeur par défaut');
  // leçons : mêmes étoiles et mêmes meilleurs résultats
  for (const [id, l] of Object.entries(LEGACY.lessons)) {
    assert.equal(st.lessons[id].done, l.done);
    assert.equal(st.lessons[id].stars, l.stars, `${id}: étoiles conservées`);
    assert.equal(st.lessons[id].bestWpm, l.bestWpm);
    assert.equal(st.lessons[id].bestAcc, l.bestAcc);
    assert.equal(st.lessons[id].tries, l.tries);
  }
  // tests, statistiques, jours, badges
  assert.equal(st.tests.length, 2);
  assert.equal(st.tests[0].wpm, 41.5);
  assert.deepEqual(Array.from(st.tests[0].series), [30, 40]);
  assert.equal(st.tests[1].fingers, 2);
  assert.equal(JSON.stringify(st.chars.e), '{"n":200,"m":9}');
  assert.equal(st.days['2023-11-14'].sec, 900);
  assert.deepEqual(Object.keys(st.badges).sort(), ['first-lesson', 'mod-1', 'wpm-30']);
  assert.equal(st.badges['wpm-30'], 1700001100000);
  assert.equal(st.flags.skip, true);
  assert.equal(st.sessions.length, 0, 'pas encore de séance d\'atelier');
  assert.equal(D.Store.bestWpm(10), 41.5);
});

test('migration : un module terminé avec l\'ancien programme reste terminé, un module commencé reste ouvert', () => {
  const D = legacySite();
  const mods = D.Curriculum.modules;
  assert.equal(D.Store.moduleDone(mods[0]), true, 'module 1 : toutes les anciennes leçons étaient réussies');
  assert.equal(D.Store.state.modules[1].legacy, true);
  assert.equal(D.Store.moduleDone(mods[1]), false, 'module 2 : seulement 2.1');
  assert.equal(D.Store.moduleDone(mods[3]), true, 'module 4 validé par test de passage');
  assert.equal(D.Store.moduleUnlocked(mods, 1), true, 'module 2 ouvert grâce au module 1');
  assert.equal(D.Store.moduleUnlocked(mods, 2), false, 'module 3 encore fermé');
  assert.equal(D.Store.endDone(1, 'revision'), true, 'fin de module 1 comptée comme faite');
  // la leçon 2.1 déjà réussie n'est pas à refaire : toutes ses étapes sont ouvertes
  const next = D.Curriculum.next();
  assert.equal(next.module.id, 2);
  assert.equal(next.lesson.id, '2.2');
});

test('migration : un ancien fichier exporté s\'importe, et on ne perd rien', () => {
  const D = loadSite(SITE_BASE);
  const r = D.Store.importJSON(JSON.stringify(LEGACY));
  assert.equal(r.ok, true);
  assert.equal(D.Store.state.lessons['1.1'].stars, 3);
  assert.equal(D.Store.state.tests.length, 2);
  assert.equal(D.Store.moduleDone(D.Curriculum.modules[0]), true);
  // exporter puis réimporter ne change rien
  const json = D.Store.exportJSON();
  const again = loadSite(SITE_BASE);
  assert.equal(again.Store.importJSON(json).ok, true);
  assert.equal(JSON.stringify(again.Store.state.lessons), JSON.stringify(D.Store.state.lessons));
  assert.equal(again.Store.state.schema, 3);
  assert.equal(JSON.stringify(again.Store.state.badges), JSON.stringify(D.Store.state.badges));
});

test('migration : une deuxième lecture ne change plus rien (idempotente)', () => {
  const D = legacySite();
  const once = JSON.stringify(D.Store.state.modules);
  const twice = D.Store.normalize(JSON.parse(JSON.stringify(D.Store.state)));
  assert.equal(JSON.stringify(twice.modules).replace(/"t":\d+/g, ''), once.replace(/"t":\d+/g, ''));
});

// ---- Étapes, fin de module, atelier ------------------------------------------------------------------------

test('un module neuf se termine par les 5 étapes de fin, pas avant', () => {
  const D = loadSite(SITE_BASE);
  const m = D.Curriculum.modules[0];
  m.lessons.forEach((l) => D.Store.recordLesson(l.id, { wpm: 30, acc: 97, passed: true, stars: 2 }));
  assert.equal(D.Store.lessonsDone(m), true);
  assert.equal(D.Store.moduleDone(m), false, 'toutes les leçons ne suffisent plus : il reste la fin de module');
  assert.equal(D.Curriculum.next().end, 'e1');
  D.Curriculum.END_STEPS.forEach((s, i) => {
    assert.equal(D.Store.moduleDone(m), false);
    D.Store.recordEnd(1, s);
  });
  assert.equal(D.Store.moduleDone(m), true);
  assert.equal(D.Store.moduleUnlocked(D.Curriculum.modules, 1), true);
  assert.equal(D.Curriculum.next().module.id, 2);
});

test('étapes de leçon enregistrées ; la leçon n\'est réussie qu\'avec le mini-test', () => {
  const D = loadSite(SITE_BASE);
  D.Store.recordStage('1.1', 'repeat', { acc: 95, wpm: 20, passed: true });
  D.Store.recordStage('1.1', 'alternate', { acc: 80, wpm: 20, passed: false });
  assert.equal(D.Store.stage('1.1', 'repeat').done, true);
  assert.equal(D.Store.stage('1.1', 'alternate').done, false);
  assert.equal(D.Store.stage('1.1', 'alternate').tries, 1);
  assert.notEqual(D.Store.lesson('1.1').done, true);
});

test('atelier : les séances sont enregistrées à part des tests chronométrés', () => {
  const D = loadSite(SITE_BASE);
  D.Store.addTest({ t: Date.now(), dur: 60, fingers: 10, wpm: 50, raw: 52, acc: 96, ok: 250, bad: 10 });
  const before = { best: D.Store.bestWpm(10), tests: D.Store.state.tests.length };
  D.Store.addSession({ t: Date.now(), type: 'repeat', chars: 'fj', dur: 90, len: 300, wpm: 140, acc: 99, errors: 1 });
  assert.equal(D.Store.state.sessions.length, 1);
  assert.equal(D.Store.state.tests.length, before.tests, 'pas ajouté aux tests');
  assert.equal(D.Store.bestWpm(10), before.best, 'ne change pas le meilleur MPM (records, badges, certificat)');
  // sauvegarde : la séance survit à un export / import
  const again = loadSite(SITE_BASE);
  again.Store.importJSON(D.Store.exportJSON());
  assert.equal(again.Store.state.sessions.length, 1);
  assert.equal(again.Store.state.sessions[0].wpm, 140);
  // le temps passé compte pour l'objectif quotidien (via le suivi d'activité commun aux exercices)
  const t = Date.now();
  D.Store.tick(t);
  D.Store.tick(t + 2000);
  assert.ok(D.Store.todaySec() >= 2);
});

test('réglages de l\'atelier : valeurs nettoyées à l\'import', () => {
  const D = loadSite(SITE_BASE);
  const bad = JSON.stringify({ v: 1, settings: { workshop: { chars: 'ab  c', type: 'nimporte', mode: 'x', minutes: 999, count: 1, weak: 1 }, seriesLength: 'énorme' }, tests: [] });
  assert.equal(D.Store.importJSON(bad).ok, true);
  const w = D.Store.state.settings.workshop;
  assert.equal(w.chars, 'abc');
  assert.equal(w.type, 'alternate');
  assert.equal(w.mode, 'chars');
  assert.equal(w.minutes, 30);
  assert.equal(w.count, 20);
  assert.equal(w.weak, true);
  assert.equal(D.Store.state.settings.seriesLength, 'normal');
});
