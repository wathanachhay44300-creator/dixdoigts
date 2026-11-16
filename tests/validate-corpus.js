#!/usr/bin/env node
// Validation du corpus : compte, pour chaque leçon, les mots réels disponibles, et vérifie que tout
// le contenu généré se tape sur AZERTY Mac et PC.
// Lancer : node tests/validate-corpus.js      (code de sortie 1 s'il y a un problème)
const { loadSite, SITE_BASE } = require('./helpers.js');

const DD = loadSite(SITE_BASE);
const C = DD.Curriculum;
const G = DD.Gen;
const T = DD.Text;
let problems = 0;
const bad = (m) => {
  problems++;
  if (problems <= 40) console.log('PROBLÈME :', m);
};

console.log('Corpus : ' + T.WORDS.length + ' mots (' + T.PLAIN.length + ' sans accent), ' + T.SIMPLE.length + ' phrases simples, ' + T.SENTENCES.length + ' phrases, ' + T.PASSAGES.length + ' paragraphes.\n');

// 1) Mots réels disponibles par leçon (seuil : 30 mots différents)
console.log('Mots disponibles par leçon (touches de la leçon, avec au moins une touche nouvelle) :');
console.log('leçon  mots  étape « mots réels »  touches');
for (const m of C.modules) {
  for (const l of m.lessons.filter((x) => x.staged)) {
    const n = G.availableWords(l.chars.words || l.allowed, T.WORDS, l.newKeys);
    const has = l.stages().includes('words');
    if (has !== n >= G.MIN_WORDS) bad(l.id + ' : étape mots réels incohérente avec le nombre de mots');
    console.log(l.id.padEnd(6) + String(n).padStart(4) + '  ' + (has ? 'incluse            ' : 'ignorée (< ' + G.MIN_WORDS + ')    ') + Array.from(l.allowed).join(' '));
  }
}
console.log('\nMots pour chaque rangée complète :');
for (const [name, chars] of [['rangée de base', C.HOME], ['rangée du haut', C.TOP], ['rangée du bas', C.BOT]]) {
  const n = G.availableWords(chars, T.WORDS);
  console.log('  ' + name.padEnd(16) + String(n).padStart(4) + ' mots' + (n >= G.MIN_WORDS ? '' : '  (moins de 30 : pas de mots réels, c\'est normal)'));
}

// 1 bis) Texte source : tout en NFC, jamais d'accent décomposé (e + U+0302), assez d'exemples de chaque lettre accentuée
const ACC = Array.from('âêîôûëï');
const asText = (x) => (typeof x === 'string' ? x : x && x.text) || '';
console.log('\nLettres à touche morte dans le corpus (mots / phrases / paragraphes) :');
for (const [name, list] of [['mots', T.WORDS], ['phrases simples', T.SIMPLE], ['phrases', T.SENTENCES], ['paragraphes', T.PASSAGES]]) {
  list.forEach((x, i) => {
    const t = asText(x);
    if (t !== t.normalize('NFC')) bad(name + ' #' + i + ' : pas en NFC : ' + JSON.stringify(t.slice(0, 40)));
    if (/\p{M}/u.test(t)) bad(name + ' #' + i + ' : accent décomposé (caractère combinant) : ' + JSON.stringify(t.slice(0, 40)));
  });
}
const MIN_WORDS_PER_ACCENT = 8;
const MIN_SENTENCES_PER_ACCENT = 2;
for (const c of ACC) {
  const w = T.WORDS.filter((x) => x.includes(c)).length;
  const se = T.SENTENCES.filter((x) => x.includes(c)).length;
  const pa = T.PASSAGES.filter((x) => asText(x).includes(c)).length;
  console.log('  ' + c + '  ' + String(w).padStart(3) + ' mots  ' + String(se).padStart(2) + ' phrases  ' + String(pa).padStart(2) + ' paragraphes');
  if (w < MIN_WORDS_PER_ACCENT) bad('pas assez de mots avec ' + c + ' (' + w + ' < ' + MIN_WORDS_PER_ACCENT + ')');
  if (se < MIN_SENTENCES_PER_ACCENT) bad('pas assez de phrases avec ' + c + ' (' + se + ' < ' + MIN_SENTENCES_PER_ACCENT + ')');
}
// Dans le module 6, chaque leçon d'accents contient bien ses lettres nouvelles, plusieurs fois, à chaque étape
const m6 = C.modules.find((m) => m.id === 6);
for (const l of m6.lessons.filter((x) => x.staged)) {
  const fresh = Array.from(l.newKeys).filter((c) => ACC.includes(c));
  if (!fresh.length) continue;
  for (let seed = 1; seed <= 15; seed++) {
    for (const st of l.stages().filter((s) => s !== 'intro')) {
      const t = C.stageContent(l, st, { seed }).text.toLowerCase();
      for (const c of fresh) {
        const n = Array.from(t).filter((x) => x === c).length;
        if (n < 2) bad('leçon ' + l.id + '/' + st + ' (série ' + seed + ') : « ' + c + ' » seulement ' + n + ' fois');
      }
    }
  }
}
for (const s of C.END_STEPS) {
  for (let seed = 1; seed <= 15; seed++) {
    const t = C.endContent(m6, s, { seed }).text.toLowerCase();
    for (const c of ACC) if (!t.includes(c)) bad('fin du module 6 / ' + s + ' (série ' + seed + ') : aucune lettre « ' + c + ' »');
  }
}

// 2) Tout le contenu est tapable
let texts = 0;
for (const id of ['mac', 'pc']) {
  const layout = DD.Layout.get(id);
  const check = (label, t) => {
    texts++;
    if (!t || t !== t.normalize('NFC')) bad(label + ' : texte vide ou non NFC');
    if (/^ | $|  /.test(t)) bad(label + ' : espaces en trop');
    for (const ch of t) if (!layout.hint(ch)) bad(label + ' [' + id + '] : caractère non tapable ' + JSON.stringify(ch));
  };
  for (const m of C.modules) {
    for (let seed = 1; seed <= 15; seed++) {
      for (const l of m.lessons) {
        if (l.staged) for (const st of l.stages().filter((s) => s !== 'intro')) check('leçon ' + l.id + '/' + st, C.stageContent(l, st, { seed }).text);
        else check('leçon ' + l.id, l.gen());
      }
      for (const s of C.END_STEPS) check('module ' + m.id + '/' + s, C.endContent(m, s, { seed }).text);
      if (m.skip) check('passage ' + m.id, m.skip.gen());
    }
  }
  for (let i = 0; i < 20; i++) check('points faibles', T.weak(['é', 'q', 'A', '5', '?', 'ê'], 200));
}
console.log('\n' + texts + ' textes générés et vérifiés sur AZERTY Mac et PC.');
console.log(problems ? problems + ' problème(s)' : 'OK : le corpus est valide.');
process.exit(problems ? 1 : 0);
