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
