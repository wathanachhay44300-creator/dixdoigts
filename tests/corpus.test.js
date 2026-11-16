// Le corpus est en NFC (jamais « e + accent circonflexe » séparés) et contient assez de lettres à touche morte.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadSite, SITE_BASE } = require('./helpers.js');

const DD = loadSite(SITE_BASE);
const T = DD.Text;
const C = DD.Curriculum;
const ACC = Array.from('âêîôûëï');
const asText = (x) => (typeof x === 'string' ? x : x.text);

test('mots, phrases et paragraphes sont en NFC, sans caractère combinant', () => {
  for (const [name, list] of [['mots', T.WORDS], ['phrases simples', T.SIMPLE], ['phrases', T.SENTENCES], ['paragraphes', T.PASSAGES]]) {
    for (const x of list) {
      const t = asText(x);
      assert.equal(t, t.normalize('NFC'), name + ' : ' + t.slice(0, 40) + ' n\'est pas en NFC');
      assert.ok(!/\p{M}/u.test(t), name + ' : accent décomposé dans ' + t.slice(0, 40));
    }
  }
});

test('chaque lettre â ê î ô û ë ï a plusieurs mots et plusieurs phrases d\'exemple', () => {
  for (const c of ACC) {
    assert.ok(T.WORDS.filter((w) => w.includes(c)).length >= 8, 'pas assez de mots avec ' + c);
    assert.ok(T.SENTENCES.filter((s) => s.includes(c)).length >= 2, 'pas assez de phrases avec ' + c);
  }
});

test('le texte généré du module 6 est en NFC et contient les lettres nouvelles de chaque leçon', () => {
  const m6 = C.modules.find((m) => m.id === 6);
  for (const l of m6.lessons.filter((x) => x.staged)) {
    const fresh = Array.from(l.newKeys).filter((c) => ACC.includes(c));
    for (let seed = 1; seed <= 8; seed++) {
      for (const st of l.stages().filter((s) => s !== 'intro')) {
        const t = C.stageContent(l, st, { seed }).text;
        assert.equal(t, t.normalize('NFC'));
        assert.ok(!/\p{M}/u.test(t));
        for (const c of fresh) assert.ok(Array.from(t.toLowerCase()).filter((x) => x === c).length >= 2, l.id + '/' + st + ' : « ' + c + ' » trop rare');
      }
    }
  }
});

test('la fin du module 6 (endurance, maîtrise, révision) contient les sept lettres', () => {
  const m6 = C.modules.find((m) => m.id === 6);
  for (const s of C.END_STEPS) {
    for (let seed = 1; seed <= 8; seed++) {
      const t = C.endContent(m6, s, { seed }).text.toLowerCase();
      for (const c of ACC) assert.ok(t.includes(c), s + ' (série ' + seed + ') : pas de « ' + c + ' »');
    }
  }
});

test('la clavier propose deux étapes pour chaque lettre à touche morte (Mac et PC)', () => {
  for (const id of ['mac', 'pc']) {
    const layout = DD.Layout.get(id);
    for (const c of Array.from('âêîôûÂÊÎÔÛëïäöü')) {
      const h = layout.hint(c);
      assert.ok(h && h.dead, id + ' ' + c);
      assert.equal(h.steps.length, 2, id + ' ' + c);
      assert.ok(h.steps[0].includes('^'), id + ' ' + c + ' : étape 1 = touche ^');
    }
    assert.equal(layout.hint('é').steps.length, 1);
  }
});
