// Tests du déverrouillage libre : « ouvert » (on peut jouer) n'est jamais « validé » (étoiles, scores, badges, progression).
// Lancer : node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadSite, SITE_BASE } = require('./helpers.js');

// Site complet avec les badges ; on coupe les messages et les sons (pas de navigateur ici).
function site(storage) {
  const D = loadSite(SITE_BASE.concat(['badges.js']), { storage: storage || {} });
  D.toast = () => {};
  D.Audio = { success() {} };
  return D;
}

const ok = (D, mi) => D.Store.moduleOpen(D.Curriculum.modules, mi);
const openModules = (D) => D.Curriculum.modules.map((m, i) => (ok(D, i) ? m.id : null)).filter((x) => x !== null).join(',');
const lessonOpen = (D, id) => {
  const f = D.Curriculum.find(id);
  return D.Store.lessonOpen(D.Curriculum.modules, f.module, f.lesson);
};
const pass = (D, id, acc, stars) => D.Store.recordLesson(id, { wpm: 30, acc: acc || 97, passed: true, stars: stars || 2 });
const validateModule = (D, m) => {
  m.lessons.forEach((l) => pass(D, l.id));
  D.Curriculum.END_STEPS.forEach((s) => D.Store.recordEnd(m.id, s));
};
// Ce que « validé » veut dire : tout ce qui est enregistré comme réussite
const validated = (D) => JSON.stringify({ lessons: D.Store.state.lessons, modules: D.Store.state.modules, badges: D.Store.state.badges, tests: D.Store.state.tests, flags: D.Store.state.flags });

// Ancienne règle de progression, réécrite ici de façon indépendante
function expectedReached(D) {
  const mods = D.Curriculum.modules;
  return mods.map((m, i) => i === 0 || D.Store.moduleDone(mods[i - 1]) || D.Store.moduleDone(m));
}

test('par défaut : seul le module 1 est ouvert, le reste est verrouillé', () => {
  const D = site();
  assert.equal(openModules(D), '1');
  assert.equal(D.Store.isUnlockAll(), false);
  assert.equal(lessonOpen(D, '1.1'), true);
  assert.equal(lessonOpen(D, '1.5'), true, 'toutes les leçons d\'un module ouvert sont ouvertes');
  assert.equal(lessonOpen(D, '2.1'), false);
  assert.equal(lessonOpen(D, '10.5'), false);
  assert.equal(D.Store.state.unlocks.modules.length + D.Store.state.unlocks.lessons.length, 0);
});

test('déverrouiller un module : ouvre le module et ses leçons, mais ne valide rien', () => {
  const D = site();
  const before = validated(D);
  D.Store.unlockModule(3);
  assert.equal(openModules(D), '1,3');
  assert.equal(lessonOpen(D, '3.1'), true);
  assert.equal(lessonOpen(D, '3.5'), true);
  assert.equal(lessonOpen(D, '2.1'), false, 'les autres modules restent verrouillés');
  assert.equal(lessonOpen(D, '4.1'), false);
  const m3 = D.Curriculum.modules[2];
  assert.equal(D.Store.moduleDone(m3), false, 'non validé');
  assert.equal(D.Store.moduleProgress(m3), 0, 'aucune progression');
  assert.equal(D.Store.lesson('3.1'), undefined, 'pas de ligne de résultat : ni étoiles, ni score');
  assert.equal(validated(D), before, 'rien de « validé » n\'a bougé');
  assert.deepEqual(Array.from(D.Badges.check()), [], 'aucun badge');
  assert.deepEqual(Array.from(D.Store.state.unlocks.modules), [3]);
  // le cliquer deux fois ne duplique rien
  D.Store.unlockModule(3);
  assert.equal(D.Store.state.unlocks.modules.length, 1);
});

test('déverrouiller une seule leçon : le module reste verrouillé, les autres leçons aussi', () => {
  const D = site();
  D.Store.unlockLesson('3.2');
  assert.equal(lessonOpen(D, '3.2'), true);
  assert.equal(lessonOpen(D, '3.1'), false);
  assert.equal(lessonOpen(D, '3.3'), false);
  assert.equal(openModules(D), '1', 'le module 3 reste verrouillé');
  assert.equal(D.Store.lesson('3.2'), undefined);
  assert.deepEqual(Array.from(D.Badges.check()), []);
});

test('« Tout déverrouiller » ouvre tout, peut être désactivé, et ne fait perdre aucune validation', () => {
  const D = site();
  pass(D, '1.1', 99, 3);
  D.Store.recordStage('1.1', 'repeat', { acc: 96, wpm: 20, passed: true });
  D.Store.unlockModule(4);
  const before = validated(D);
  D.Store.setUnlockAll(true);
  assert.equal(openModules(D), '1,2,3,4,5,6,7,8,9,10');
  for (const m of D.Curriculum.modules) for (const l of m.lessons) assert.equal(lessonOpen(D, l.id), true, l.id);
  assert.equal(validated(D), before, 'activer ne valide rien');
  assert.equal(D.Store.moduleDone(D.Curriculum.modules[1]), false);
  assert.deepEqual(Array.from(D.Badges.check()).map((b) => b.id), ['first-lesson'], 'seul le badge de la vraie réussite (1.1)');
  D.Store.setUnlockAll(false);
  assert.equal(D.Store.isUnlockAll(), false);
  assert.equal(openModules(D), '1,4', 'retour à la progression + déverrouillage manuel du module 4');
  assert.equal(D.Store.lesson('1.1').stars, 3, 'les étoiles sont toujours là');
  assert.equal(D.Store.lesson('1.1').done, true);
  assert.equal(D.Store.stage('1.1', 'repeat').done, true);
  assert.deepEqual(Array.from(D.Store.state.unlocks.modules), [4], 'le déverrouillage manuel est conservé');
});

test('une leçon déverrouillée mais non réussie n\'a ni étoiles ni badge, et ne compte pas dans la progression', () => {
  const D = site();
  D.Store.unlockModule(3);
  const m3 = D.Curriculum.modules[2];
  // essai raté
  D.Store.recordLesson('3.1', { wpm: 18, acc: 80, passed: false, stars: 0 });
  const l = D.Store.lesson('3.1');
  assert.equal(l.done, false);
  assert.equal(l.stars, 0);
  assert.equal(l.tries, 1, 'l\'essai est noté, mais pas comme une réussite');
  assert.equal(D.Store.moduleProgress(m3), 0);
  assert.equal(D.Store.moduleDone(m3), false);
  assert.deepEqual(Array.from(D.Badges.check()), []);
  // vraie réussite
  pass(D, '3.1', 97, 2);
  assert.equal(D.Store.lesson('3.1').done, true);
  assert.equal(D.Store.lesson('3.1').stars, 2);
  assert.equal(D.Store.moduleProgress(m3), 1);
  assert.deepEqual(Array.from(D.Badges.check()).map((b) => b.id), ['first-lesson']);
});

test('« Continuer » mène toujours à la première leçon non validée, même si d\'autres sont déverrouillées ou validées', () => {
  const D = site();
  const mods = D.Curriculum.modules;
  const nextId = () => {
    const n = D.Curriculum.next();
    return n.lesson ? n.lesson.id : n.module.id + ':' + n.end;
  };
  assert.equal(nextId(), '1.1');
  D.Store.unlockModule(5);
  D.Store.setUnlockAll(true);
  assert.equal(nextId(), '1.1', 'les déverrouillages ne changent pas la recommandation');
  // on valide tout le module 3 (déverrouillé) : la recommandation reste au début du parcours
  validateModule(D, mods[2]);
  assert.equal(nextId(), '1.1');
  pass(D, '1.1');
  assert.equal(nextId(), '1.2');
  mods[0].lessons.slice(1).forEach((l) => pass(D, l.id));
  assert.equal(nextId(), '1:e1', 'leçons finies : la fin de module est la suite');
  D.Curriculum.END_STEPS.forEach((s) => D.Store.recordEnd(1, s));
  assert.equal(nextId(), '2.1', 'module 1 validé : première leçon du module 2, pas celle du module 4');
  D.Store.setUnlockAll(false);
  assert.equal(nextId(), '2.1');
  // tout le parcours validé : plus rien à recommander
  mods.forEach((m) => validateModule(D, m));
  assert.equal(D.Curriculum.next(), null);
});

test('un module déverrouillé reste « non validé » : pas de badge de module avant la vraie réussite', () => {
  const D = site();
  D.Store.setUnlockAll(true);
  assert.deepEqual(Array.from(D.Badges.check()), []);
  assert.equal(Object.keys(D.Store.state.badges).length, 0);
  assert.equal(D.Store.moduleDone(D.Curriculum.modules[1]), false);
  // test de passage réussi : le module est validé, avec son badge
  D.Store.skipModule(2);
  assert.equal(D.Store.moduleDone(D.Curriculum.modules[1]), true);
  assert.deepEqual(Array.from(D.Badges.check()).map((b) => b.id).sort(), ['mod-2', 'skip']);
  assert.equal(D.Store.moduleDone(D.Curriculum.modules[2]), false, 'le module 3 n\'est pas validé pour autant');
});

test('les tests de passage valident un module même verrouillé, et ouvrent le suivant par la progression', () => {
  const D = site();
  assert.equal(openModules(D), '1');
  D.Store.skipModule(4);
  assert.equal(D.Store.moduleDone(D.Curriculum.modules[3]), true);
  assert.equal(D.Store.moduleReached(D.Curriculum.modules, 4), true, 'module 5 atteint : le 4 est validé');
  assert.equal(ok(D, 3), true, 'un module validé est toujours ouvert');
  assert.equal(ok(D, 1), false, 'module 2 : toujours verrouillé');
  assert.equal(D.Store.moduleProgress(D.Curriculum.modules[1]), 0);
});

test('on peut rejouer une leçon validée, même si son module n\'est plus ouvert', () => {
  const D = site();
  pass(D, '5.1');
  assert.equal(ok(D, 4), false);
  assert.equal(lessonOpen(D, '5.1'), true);
  assert.equal(lessonOpen(D, '5.2'), false);
});

test('fin de module : accès libre seulement pour un module déverrouillé (ou tout déverrouillé)', () => {
  const D = site();
  const m1 = D.Curriculum.modules[0];
  const m3 = D.Curriculum.modules[2];
  assert.equal(D.Store.freeAccess(m1), false, 'module 1 ouvert par la progression : ordre conseillé');
  D.Store.unlockModule(3);
  assert.equal(D.Store.freeAccess(m3), true);
  assert.equal(D.Store.freeAccess(D.Curriculum.modules[3]), false);
  D.Store.setUnlockAll(true);
  assert.equal(D.Store.freeAccess(D.Curriculum.modules[3]), true);
  // accéder aux étapes de fin ne valide rien tant qu'elles ne sont pas réussies
  assert.equal(D.Store.endDone(3, 'e1'), false);
  assert.equal(D.Store.moduleDone(m3), false);
});

test('conseil : « conseillé après X »', () => {
  const D = site();
  const C = D.Curriculum;
  assert.equal(C.adviceAfter({ module: C.modules[0] }), null);
  assert.equal(C.adviceAfter({ module: C.modules[2] }), 'le module 2 (« Rangée du haut »)');
  const m3 = C.modules[2];
  assert.equal(C.adviceAfter({ module: m3, lesson: m3.lessons[1] }), 'la leçon 3.1 (« V et B : l\'index gauche »)');
  assert.equal(C.adviceAfter({ module: m3, lesson: m3.lessons[0] }), 'le module 2 (« Rangée du haut »)');
});

// ---- Migration et données --------------------------------------------------------------------------------

// Données telles que l'ancienne version (schéma 2) les enregistrait : pas de champ « unlocks »
const SCHEMA2 = {
  v: 1,
  schema: 2,
  created: 1700000000000,
  profile: { name: 'Léa' },
  settings: { layout: 'mac', sound: true, soundProfile: 'clic', volume: 0.6, showKeyboard: true, dailyGoalMin: 10, baselineWpm: 80, testDuration: 2, testFingers: 10, seriesLength: 'long', workshop: { chars: 'fjdk', type: 'alternate', mode: 'chars', minutes: 2, count: 150, weak: false } },
  lessons: {
    '1.1': { done: true, stars: 3, bestWpm: 31, bestAcc: 99, tries: 2, stages: { intro: { done: true, bestAcc: 100, bestWpm: 0, tries: 1 } } },
    '1.2': { done: true, stars: 2, bestWpm: 28, bestAcc: 96, tries: 1 },
    '1.3': { done: true, stars: 2, bestWpm: 28, bestAcc: 96, tries: 1 },
    '1.4': { done: true, stars: 2, bestWpm: 28, bestAcc: 96, tries: 1 },
    '1.5': { done: true, stars: 2, bestWpm: 28, bestAcc: 96, tries: 1 },
    '4.1': { done: true, stars: 2, bestWpm: 30, bestAcc: 96, tries: 1 },
    '4.2': { done: true, stars: 2, bestWpm: 30, bestAcc: 96, tries: 1 },
    '4.3': { done: true, stars: 1, bestWpm: 30, bestAcc: 91, tries: 1 },
    '4.4': { done: true, stars: 3, bestWpm: 30, bestAcc: 99, tries: 1 },
    '4.5': { done: true, stars: 2, bestWpm: 30, bestAcc: 96, tries: 1 },
  },
  modules: { 1: { t: 1, end: { e1: true, e2: true, e3: true, mastery: true, revision: true } } },
  tests: [{ t: 1700001000000, dur: 120, fingers: 10, wpm: 44.5, raw: 46, acc: 96.2, ok: 445, bad: 16 }],
  sessions: [{ t: 1700002000000, type: 'repeat', chars: 'fj', dur: 90, len: 300, wpm: 60, acc: 98, errors: 2 }],
  chars: { e: { n: 200, m: 9 } },
  days: { '2023-11-14': { sec: 900, n: 3 } },
  badges: { 'first-lesson': 1700000100000 },
  flags: {},
};

test('migration schéma 2 -> 3 : tout est conservé, aucun déverrouillage ajouté, mêmes modules ouverts', () => {
  const D = site({ 'dixdoigts:v1': JSON.stringify(SCHEMA2) });
  const st = D.Store.state;
  assert.equal(st.schema, 3);
  assert.equal(st.unlocks.modules.length, 0);
  assert.equal(st.unlocks.lessons.length, 0);
  assert.equal(st.settings.unlockAll, false);
  assert.equal(st.settings.seriesLength, 'long', 'les réglages existants sont conservés');
  assert.equal(st.profile.name, 'Léa');
  assert.equal(st.lessons['1.1'].stars, 3);
  assert.equal(st.lessons['1.1'].stages.intro.done, true);
  assert.equal(st.tests.length, 1);
  assert.equal(st.tests[0].wpm, 44.5);
  assert.equal(st.sessions.length, 1);
  assert.equal(st.days['2023-11-14'].sec, 900);
  assert.equal(JSON.stringify(Object.keys(st.badges)), '["first-lesson"]');
  // les modules ouverts par la progression le restent : exactement l'ancienne règle
  const expected = expectedReached(D);
  D.Curriculum.modules.forEach((m, i) => assert.equal(ok(D, i), expected[i], 'module ' + m.id));
  assert.equal(openModules(D), '1,2', 'module 1 validé -> module 2 ouvert ; le 4 n\'est pas ouvert');
});

test('migration : la conversion de l\'ancien programme (schéma 1) n\'est PAS rejouée sur des données récentes', () => {
  // Leçons 4.1 à 4.5 faites, mais pas la fin de module : le module 4 ne doit pas devenir « terminé » tout seul
  const D = site({ 'dixdoigts:v1': JSON.stringify(SCHEMA2) });
  assert.equal(D.Store.lessonsDone(D.Curriculum.modules[3]), true);
  assert.equal(D.Store.moduleDone(D.Curriculum.modules[3]), false);
  assert.equal(D.Store.state.modules[4], undefined);
  assert.equal(D.Curriculum.next().lesson.id, '2.1');
});

test('migration schéma 1 -> 3 : un module terminé le reste, les mêmes modules sont ouverts qu\'avant', () => {
  const legacy = {
    v: 1,
    lessons: Object.fromEntries(['1.1', '1.2', '1.3', '1.4', '1.5', '1.6', '2.1'].map((id) => [id, { done: true, stars: 2, bestWpm: 25, bestAcc: 96, tries: 1 }])),
    modules: {},
    tests: [],
    badges: { 'first-lesson': 5 },
  };
  const D = site({ 'dixdoigts:v1': JSON.stringify(legacy) });
  assert.equal(D.Store.state.schema, 3);
  assert.equal(D.Store.moduleDone(D.Curriculum.modules[0]), true);
  assert.equal(D.Store.moduleDone(D.Curriculum.modules[1]), false);
  assert.equal(openModules(D), '1,2');
  assert.equal(D.Store.lesson('2.1').stars, 2);
  assert.equal(D.Curriculum.next().lesson.id, '2.2');
});

test('déverrouillages : sauvegardés, exportés, importés, et nettoyés si le fichier est abîmé', () => {
  const D = site();
  D.Store.unlockModule(6);
  D.Store.unlockLesson('3.2');
  D.Store.setUnlockAll(true);
  const json = D.Store.exportJSON();
  const again = site();
  assert.equal(again.Store.importJSON(json).ok, true);
  assert.equal(JSON.stringify(again.Store.state.unlocks), '{"modules":[6],"lessons":["3.2"]}');
  assert.equal(again.Store.isUnlockAll(), true);
  // rechargement depuis le stockage local
  const reloaded = site({ 'dixdoigts:v1': JSON.stringify(again.Store.state) });
  assert.equal(reloaded.Store.isModuleManual(6), true);
  assert.equal(reloaded.Store.isLessonManual('3.2'), true);
  // fichier abîmé ou piégé
  const bad = { v: 1, settings: { unlockAll: 'oui' }, tests: [], unlocks: { modules: [1, '2', '2', 'x', '__proto__', 3.5, 99999], lessons: ['4.1', '4.1', 'abc', '../x', '9.99', 12, null] } };
  const B = site();
  assert.equal(B.Store.importJSON(JSON.stringify(bad)).ok, true);
  assert.equal(JSON.stringify(B.Store.state.unlocks.modules), '[1,2]', 'doublons, texte et nombres hors format enlevés');
  assert.equal(JSON.stringify(B.Store.state.unlocks.lessons), '["4.1","9.99"]');
  assert.equal(B.Store.isUnlockAll(), false, 'une valeur qui n\'est pas un booléen est ignorée');
  assert.equal(({}).polluted, undefined);
});

test('statistiques et badges : ils ne comptent que les exercices réellement réussis', () => {
  const D = site();
  D.Store.setUnlockAll(true);
  D.Store.unlockModule(2);
  D.Store.unlockLesson('7.1');
  // plein d'essais ratés, un seul réussi
  for (let i = 0; i < 5; i++) D.Store.recordLesson('2.1', { wpm: 10, acc: 70, passed: false, stars: 0 });
  assert.deepEqual(Array.from(D.Badges.check()), []);
  assert.equal(Object.values(D.Store.state.lessons).filter((l) => l.done).length, 0);
  assert.equal(D.Store.moduleProgress(D.Curriculum.modules[1]), 0);
  pass(D, '2.1', 96, 2);
  assert.equal(Object.values(D.Store.state.lessons).filter((l) => l.done).length, 1);
  assert.deepEqual(Array.from(D.Badges.check()).map((b) => b.id), ['first-lesson']);
  assert.equal(D.Store.moduleProgress(D.Curriculum.modules[1]), 1);
});
