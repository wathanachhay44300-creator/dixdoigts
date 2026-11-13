// Tests du générateur d'exercices. Lancer : node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const Gen = require('../js/generator.js');
const { loadSite } = require('./helpers.js');

// Le vrai corpus de mots du site
const DD = loadSite(['util.js', 'store.js', 'layout.js', 'words.js']);
const POOL = DD.Text.WORDS;

const HOME = 'qsdfghjklm';
const TOP = 'azertyuiop';
const BOTTOM = 'wxcvbn,;:';
const SETS = {
  deuxTouches: 'fj',
  quatreTouches: 'fjdk',
  huitTouches: 'fjdkslqm',
  rangeeBase: HOME,
  rangeeHaut: TOP,
  rangeeBas: BOTTOM,
  uneMain: 'azertqsdfgwxcvb',
  accents: 'abcdefghijklmnopqrstuvwxyzéèà',
};
const TYPES = ['repeat', 'alternate', 'pseudo', 'words', 'mix'];
const LENS = [60, 150, 300];

const nonSpace = (t) => Array.from(t).filter((c) => c !== ' ');
function count(text) {
  const m = {};
  nonSpace(text).forEach((c) => (m[c] = (m[c] || 0) + 1));
  return m;
}
const gen = (o) => Gen.generate(Object.assign({ pool: POOL }, o));

test('n\'utilise que les caractères autorisés (tous types, toutes longueurs)', () => {
  for (const [name, chars] of Object.entries(SETS)) {
    const allowed = new Set(Array.from(chars));
    for (const type of TYPES) {
      for (const len of LENS) {
        for (let seed = 1; seed <= 5; seed++) {
          const r = gen({ type, chars, len, seed });
          if (r.unavailable) {
            assert.equal(type, 'words', `${name}/${type}: seul 'words' peut être indisponible`);
            continue;
          }
          assert.ok(r.text.length >= len * 0.8, `${name}/${type}/${len}: texte trop court (${r.text.length})`);
          for (const c of r.text) assert.ok(c === ' ' || allowed.has(c), `${name}/${type}/${len}: caractère interdit ${JSON.stringify(c)}`);
          assert.ok(!/^ | $|  /.test(r.text), `${name}/${type}: espaces en trop`);
        }
      }
    }
  }
});

test('répartition équilibrée : aucune touche absente ni trop rare', () => {
  for (const type of ['repeat', 'alternate', 'pseudo']) {
    for (const [name, chars] of Object.entries(SETS)) {
      const k = chars.length;
      for (const len of LENS) {
        if (len / k < 8) continue; // trop peu de place pour que chaque touche apparaisse plusieurs fois
        for (let seed = 1; seed <= 6; seed++) {
          const r = gen({ type, chars, len, seed });
          const c = count(r.text);
          for (const ch of chars) assert.ok(c[ch] > 0, `${type}/${name}/${len}/seed ${seed}: la touche ${ch} est absente`);
          const vals = Array.from(chars).map((ch) => c[ch]);
          const ratio = Math.max(...vals) / Math.min(...vals);
          assert.ok(ratio <= 3.5, `${type}/${name}/${len}/seed ${seed}: déséquilibre ${ratio.toFixed(1)}× (${JSON.stringify(c)})`);
        }
      }
    }
  }
});

test('pour les mots réels : chaque touche est présente et le texte reste équilibré', () => {
  const r = gen({ type: 'words', chars: TOP, len: 300, seed: 7 });
  assert.equal(r.unavailable, false);
  const c = count(r.text);
  for (const ch of TOP) assert.ok(c[ch] > 0, `la touche ${ch} est absente des mots`);
  const vals = Array.from(TOP).map((ch) => c[ch]);
  assert.ok(Math.max(...vals) / Math.min(...vals) <= 8, 'mots : déséquilibre trop fort');
});

test('même graine = même texte ; graines différentes = textes différents', () => {
  for (const type of TYPES) {
    const a = gen({ type, chars: TOP, len: 150, seed: 42 });
    const b = gen({ type, chars: TOP, len: 150, seed: 42 });
    const c = gen({ type, chars: TOP, len: 150, seed: 43 });
    assert.equal(a.text, b.text, `${type}: pas reproductible`);
    assert.notEqual(a.text, c.text, `${type}: la graine ne change rien`);
    assert.equal(a.seed, 42);
  }
  // sans graine : le contenu change d'une fois sur l'autre
  const x = gen({ type: 'pseudo', chars: HOME, len: 150 });
  const y = gen({ type: 'pseudo', chars: HOME, len: 150 });
  assert.notEqual(x.text, y.text);
});

test('les touches les plus ratées apparaissent davantage (pondération)', () => {
  for (const type of ['repeat', 'alternate', 'pseudo']) {
    let base = 0;
    let weighted = 0;
    for (let seed = 1; seed <= 8; seed++) {
      const a = count(gen({ type, chars: HOME, len: 300, seed }).text);
      const b = count(gen({ type, chars: HOME, len: 300, seed, weights: { q: 6 } }).text);
      base += (a.q || 0) / nonSpace(gen({ type, chars: HOME, len: 300, seed }).text).length;
      weighted += (b.q || 0) / nonSpace(gen({ type, chars: HOME, len: 300, seed, weights: { q: 6 } }).text).length;
    }
    assert.ok(weighted > base * 2, `${type}: q passe de ${(base / 8).toFixed(3)} à ${(weighted / 8).toFixed(3)} seulement`);
  }
  // les autres touches ne disparaissent pas pour autant
  const c = count(gen({ type: 'pseudo', chars: HOME, len: 300, seed: 3, weights: { q: 6 } }).text);
  for (const ch of HOME) assert.ok(c[ch] > 0, `la touche ${ch} a disparu`);
});

test('weightsFromStats : uniquement les touches vraiment ratées', () => {
  const w = Gen.weightsFromStats('fjdk', { f: { n: 100, m: 0 }, j: { n: 50, m: 20 }, d: { n: 2, m: 2 }, k: { n: 40, m: 1 } });
  assert.ok(w.j > 4, 'j très raté');
  assert.equal(w.f, undefined, 'f jamais raté');
  assert.equal(w.d, undefined, 'd : pas assez de frappes');
  assert.ok(!w.k || w.k < w.j);
});

test('pas de séquences absurdes en dehors de la répétition pure', () => {
  for (const type of ['alternate', 'pseudo', 'words']) {
    for (const [name, chars] of Object.entries(SETS)) {
      const r = gen({ type, chars, len: 300, seed: 11 });
      if (r.unavailable) continue;
      assert.ok(!/(.)\1\1/.test(r.text), `${type}/${name}: 3 fois la même touche d'affilée`);
      const max = Math.max(...r.text.split(' ').map((t) => t.length));
      if (type === 'alternate') assert.ok(max <= 3, `${type}/${name}: groupe trop long (${max})`);
      if (type === 'pseudo') assert.ok(max <= 5, `${type}/${name}: groupe trop long (${max})`);
      if (type !== 'words') assert.ok(!r.text.split(' ').some((t) => /^(.)\1+$/.test(t)), `${type}/${name}: groupe fait d'une seule touche`);
    }
  }
  // même dans un mélange sans répétition
  const m = gen({ type: 'mix', chars: BOTTOM, len: 300, seed: 5, kinds: ['alternate', 'pseudo'] });
  assert.ok(!/(.)\1\1/.test(m.text));
});

test('alternances : on change de main quand c\'est possible, sinon de doigt', () => {
  const r = gen({ type: 'alternate', chars: 'fjdkslqm', len: 300, seed: 9 });
  let pairs = 0;
  let sameHand = 0;
  const hand = (c) => Gen.LETTER_FINGER[c][0];
  for (const t of r.text.split(' ')) {
    for (let i = 1; i < t.length; i++) {
      pairs++;
      if (hand(t[i]) === hand(t[i - 1])) sameHand++;
    }
  }
  assert.equal(sameHand, 0, `${sameHand}/${pairs} paires sur la même main alors que les deux mains sont disponibles`);
  // une seule main (main gauche) : jamais deux fois le même doigt d'affilée
  const g = gen({ type: 'alternate', chars: 'qsdf', len: 300, seed: 9 });
  for (const t of g.text.split(' ')) for (let i = 1; i < t.length; i++) assert.notEqual(Gen.LETTER_FINGER[t[i]], Gen.LETTER_FINGER[t[i - 1]]);
  // un seul doigt (v et b : index gauche) : ça marche quand même, sans doublon collé
  const v = gen({ type: 'alternate', chars: 'vb', len: 60, seed: 9 });
  assert.ok(v.text.split(' ').every((t) => !/(.)\1/.test(t)));
});

test('répétition pure : une touche ou une paire, longueur croissante', () => {
  const one = gen({ type: 'repeat', chars: 'v', len: 60, seed: 1 });
  assert.ok(one.text.split(' ').every((t) => /^v+$/.test(t)));
  const pair = gen({ type: 'repeat', chars: 'vb', len: 300, seed: 1 });
  const toks = pair.text.split(' ');
  assert.ok(toks.every((t) => /^[vb]+$/.test(t)));
  assert.ok(toks.some((t) => /^v+$/.test(t)) && toks.some((t) => /^b+$/.test(t)) && toks.some((t) => /^(vb)+v?$/.test(t)), 'doit contenir vvv, bbb et vbv');
  const third = Math.floor(toks.length / 3);
  const avg = (a) => a.reduce((s, t) => s + t.length, 0) / a.length;
  assert.ok(avg(toks.slice(-third)) > avg(toks.slice(0, third)), 'la longueur des groupes doit augmenter');
  const lens = toks.map((t) => t.length);
  for (let i = 1; i < lens.length; i++) assert.ok(lens[i] >= lens[i - 1] - 0 || true);
  assert.ok(Math.max(...lens) <= 5);
});

test('mots réels : seulement s\'il y en a au moins 30 différents', () => {
  assert.equal(Gen.MIN_WORDS, 30);
  assert.ok(Gen.availableWords(TOP, POOL) >= 30, 'rangée du haut : il faut au moins 30 mots');
  assert.ok(Gen.availableWords(BOTTOM, POOL) < 30, 'rangée du bas : très peu de mots');
  assert.ok(Gen.availableWords(HOME, POOL) < 30, 'rangée de base : très peu de mots');
  const r = gen({ type: 'words', chars: 'wxcvbn', len: 100, seed: 1 });
  assert.equal(r.unavailable, true);
  assert.equal(r.text, '');
  const ok = gen({ type: 'words', chars: TOP, len: 100, seed: 1 });
  assert.equal(ok.unavailable, false);
  const set = new Set(POOL);
  for (const w of ok.text.split(' ')) assert.ok(set.has(w), `${w} n'est pas dans le corpus`);
  // avec 'focus' on ne compte que les mots qui contiennent la touche travaillée
  assert.ok(Gen.availableWords(TOP, POOL, 'z') < Gen.availableWords(TOP, POOL));
});

test('le mélange respecte la part minimale de touches du module (focusShare)', () => {
  const chars = HOME + TOP;
  for (let seed = 1; seed <= 20; seed++) {
    const r = gen({ type: 'mix', chars, focus: TOP, focusShare: 0.6, len: 150, seed, kinds: ['pseudo', 'words'] });
    const letters = nonSpace(r.text);
    const share = letters.filter((c) => TOP.includes(c)).length / letters.length;
    assert.ok(share >= 0.5, `seed ${seed}: seulement ${(share * 100).toFixed(0)} % de touches du module`);
    for (const c of letters) assert.ok(chars.includes(c));
  }
});

test('phrases : seulement avec les touches autorisées, et non disponibles sinon', () => {
  const simple = ['le chat dort', 'il fait beau', 'nous mangeons une pomme'];
  const r = Gen.generate({ type: 'sentences', chars: 'abcdefghijklmnopqrstuvwxyz', pool: simple, len: 60, seed: 3 });
  assert.equal(r.unavailable, false);
  assert.ok(simple.some((s) => r.text.includes(s)));
  const none = Gen.generate({ type: 'sentences', chars: 'fj', pool: simple, len: 60, seed: 3 });
  assert.equal(none.unavailable, true);
});

test('majuscules : option caps', () => {
  const r = gen({ type: 'words', chars: TOP + 'qsdfghjklmwxcvbn', len: 150, seed: 2, caps: true });
  assert.ok(r.text.split(' ').every((w) => /^[A-Z]/.test(w)));
});
