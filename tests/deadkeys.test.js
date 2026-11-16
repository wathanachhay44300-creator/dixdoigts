// Tests des touches mortes (^ puis voyelle, Maj + ^ puis voyelle) avec des événements simulés.
// Chaque test rejoue ce qu'un navigateur envoie vraiment. Lancer : node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const DK = require('../js/deadkeys.js');
const { loadSite } = require('./helpers.js');

// Résolveur + minuterie simulée (on avance le temps à la main)
function harness(opts) {
  const h = { chars: [], pendings: [], resets: 0, t: 0, timers: [] };
  h.r = DK.create(
    Object.assign(
      {
        now: () => h.t,
        setTimer: (fn, ms) => {
          h.timers.push({ fn, at: h.t + ms, id: h.timers.length + 1 });
          return h.timers.length;
        },
        clearTimer: (id) => {
          const x = h.timers.find((y) => y.id === id);
          if (x) x.fn = null;
        },
        onChar: (str, info) => h.chars.push(Object.assign({ str }, info)),
        onPending: (ch, meta) => h.pendings.push(Object.assign({ ch }, meta)),
        reset: () => h.resets++,
      },
      opts
    )
  );
  h.tick = (ms) => {
    h.t += ms;
    h.timers.filter((x) => x.fn && x.at <= h.t).forEach((x) => {
      const f = x.fn;
      x.fn = null;
      f();
    });
  };
  return h;
}
const ev = (o) => Object.assign({ key: '', code: '', keyCode: 0, shiftKey: false, isComposing: false, repeat: false, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } }, o);
const deadDown = (shift) => ev({ key: 'Dead', code: 'BracketLeft', keyCode: 219, shiftKey: !!shift });
const plain = (key, code, shift) => ev({ key, code, shiftKey: !!shift });
const process = (code, shift) => ev({ key: 'Process', code, keyCode: 229, isComposing: true, shiftKey: !!shift });

// Voyelle -> touche physique AZERTY
const CODE = { a: 'KeyQ', e: 'KeyE', i: 'KeyI', o: 'KeyO', u: 'KeyU', y: 'KeyY' };

test('la touche morte n\'est JAMAIS annulée (c\'était le bug : preventDefault empêchait le navigateur de composer)', () => {
  const h = harness();
  const d = deadDown(false);
  const r = h.r.keydown(d);
  assert.equal(d.defaultPrevented, false, 'keydown de la touche morte : pas de preventDefault');
  assert.equal(r.consumed, true);
  assert.equal(r.prevented, false);
  // même avec Maj (¨)
  const h2 = harness();
  const d2 = deadDown(true);
  h2.r.keydown(d2);
  assert.equal(d2.defaultPrevented, false);
});

test('états : rien en attente -> touche morte en attente -> caractère final (aucun caractère pendant l\'attente)', () => {
  const h = harness();
  assert.deepEqual(h.r.state(), { pending: null, composing: false });
  h.r.keydown(deadDown(false));
  assert.equal(h.r.state().pending, '^');
  assert.equal(h.chars.length, 0, 'pendant l\'attente : aucun caractère, donc aucune erreur et aucune avance');
  assert.deepEqual(JSON.parse(JSON.stringify(h.pendings)), [{ ch: '^' }]);
  h.r.keydown(plain('e', 'KeyE'));
  assert.equal(h.chars.length, 1);
  assert.equal(h.chars[0].str, 'ê');
  assert.deepEqual(h.r.state(), { pending: null, composing: false });
  // l'attente est levée AVANT l'arrivée du caractère, et signalée comme « résolue »
  assert.deepEqual(JSON.parse(JSON.stringify(h.pendings)), [{ ch: '^' }, { ch: null, resolved: true }]);
});

test('A. composition du navigateur (Chrome, Edge) : ^ puis chaque voyelle -> â ê î ô û', () => {
  for (const [v, want] of [['a', 'â'], ['e', 'ê'], ['i', 'î'], ['o', 'ô'], ['u', 'û']]) {
    const h = harness();
    h.r.keydown(deadDown(false));
    h.r.compositionstart({});
    h.r.compositionupdate({ data: '^' });
    assert.equal(h.chars.length, 0);
    const k = process(CODE[v]);
    const r = h.r.keydown(k);
    assert.equal(r.consumed, true);
    assert.equal(k.defaultPrevented, false, 'on laisse la composition se terminer');
    assert.equal(h.chars.length, 0, 'toujours rien tant que la composition n\'est pas finie');
    h.r.compositionupdate({ data: want });
    h.r.compositionend({ data: want });
    assert.deepEqual(h.chars.map((c) => c.str), [want], v);
    assert.equal(h.chars[0].source, 'composition');
    assert.equal(h.chars[0].invalid, false);
    // le repli ne se déclenche pas ensuite
    h.tick(500);
    assert.equal(h.chars.length, 1, 'un seul caractère : pas de doublon avec la solution de secours');
  }
});

test('A. avec Maj + ^ : le tréma, ä ë ï ö ü', () => {
  for (const [v, want] of [['a', 'ä'], ['e', 'ë'], ['i', 'ï'], ['o', 'ö'], ['u', 'ü']]) {
    const h = harness();
    h.r.keydown(deadDown(true));
    assert.equal(h.r.state().pending, '¨');
    h.r.compositionstart({});
    h.r.compositionupdate({ data: '¨' });
    h.r.keydown(process(CODE[v]));
    h.r.compositionend({ data: want });
    assert.deepEqual(h.chars.map((c) => [c.str, c.dead]), [[want, '¨']], v);
  }
});

test('B. le navigateur a déjà composé la lettre dans key (« ê ») : prise telle quelle, sans doublon', () => {
  const h = harness();
  h.r.keydown(deadDown(false));
  const k = plain('ê', 'KeyE');
  h.r.keydown(k);
  assert.equal(k.defaultPrevented, true);
  assert.deepEqual(h.chars.map((c) => [c.str, c.source]), [['ê', 'keydown-composed']]);
  // la composition se termine juste après avec la même lettre : ignorée
  h.t += 20;
  const r = h.r.compositionend({ data: 'ê' });
  assert.equal(r.consumed, true);
  assert.equal(h.chars.length, 1);
});

test('C. SOLUTION DE SECOURS : la voyelle arrive seule (key = « e ») -> reconstituée avec la table', () => {
  for (const [v, want] of [['a', 'â'], ['e', 'ê'], ['i', 'î'], ['o', 'ô'], ['u', 'û']]) {
    const h = harness();
    h.r.keydown(deadDown(false));
    const k = plain(v, CODE[v]);
    h.r.keydown(k);
    assert.deepEqual(h.chars.map((c) => [c.str, c.source, c.invalid]), [[want, 'keydown-table', false]], v);
    assert.equal(k.defaultPrevented, true, 'la voyelle seule ne doit pas s\'insérer toute seule');
  }
  for (const [v, want] of [['a', 'ä'], ['e', 'ë'], ['i', 'ï'], ['o', 'ö'], ['u', 'ü'], ['y', 'ÿ']]) {
    const h = harness();
    h.r.keydown(deadDown(true));
    h.r.keydown(plain(v, CODE[v]));
    assert.equal(h.chars[0].str, want, 'Maj + ^ puis ' + v);
  }
});

test('la solution de secours par keydown donne le MÊME résultat que la composition', () => {
  for (const shift of [false, true]) {
    for (const v of ['a', 'e', 'i', 'o', 'u']) {
      const viaComposition = harness();
      viaComposition.r.keydown(deadDown(shift));
      viaComposition.r.keydown(process(CODE[v]));
      viaComposition.r.compositionend({ data: DK.TABLE[shift ? '¨' : '^'][v] });
      const viaKey = harness();
      viaKey.r.keydown(deadDown(shift));
      viaKey.r.keydown(plain(v, CODE[v]));
      const viaCode = harness();
      viaCode.r.keydown(deadDown(shift));
      viaCode.r.keydown(process(CODE[v])); // « Process » sans aucun événement de composition
      viaCode.tick(150);
      assert.equal(viaKey.chars[0].str, viaComposition.chars[0].str, `${shift ? '¨' : '^'}${v} : keydown vs composition`);
      assert.equal(viaCode.chars[0].str, viaComposition.chars[0].str, `${shift ? '¨' : '^'}${v} : touche physique vs composition`);
    }
  }
});

test('D. « Process » sans composition : repli par la touche physique AZERTY après un court délai', () => {
  const h = harness();
  h.r.keydown(deadDown(false));
  h.r.keydown(process('KeyQ')); // la touche A d'un clavier AZERTY est la touche physique Q
  assert.equal(h.chars.length, 0, 'on attend d\'abord la composition');
  h.tick(60);
  assert.equal(h.chars.length, 0);
  h.tick(100);
  assert.deepEqual(h.chars.map((c) => [c.str, c.source]), [['â', 'code-fallback']]);
  // espace
  const s = harness();
  s.r.keydown(deadDown(false));
  s.r.keydown(process('Space'));
  s.tick(200);
  assert.equal(s.chars[0].str, '^');
  assert.equal(s.chars[0].invalid, false);
});

test('une combinaison impossible donne UNE erreur : ^ puis p -> « ^p »', () => {
  // voyelle seule
  let h = harness();
  h.r.keydown(deadDown(false));
  h.r.keydown(plain('p', 'KeyP'));
  assert.deepEqual(h.chars.map((c) => [c.str, c.invalid]), [['^p', true]]);
  // via la composition (Chrome rend « ^p » d'un coup)
  h = harness();
  h.r.keydown(deadDown(false));
  h.r.keydown(process('KeyP'));
  h.r.compositionend({ data: '^p' });
  assert.deepEqual(h.chars.map((c) => [c.str, c.invalid]), [['^p', true]]);
  // deux touches mortes de suite
  h = harness();
  h.r.keydown(deadDown(false));
  h.r.keydown(deadDown(false));
  assert.deepEqual(h.chars.map((c) => [c.str, c.invalid]), [['^^', true]]);
  // consonne avec tréma
  h = harness();
  h.r.keydown(deadDown(true));
  h.r.keydown(plain('k', 'KeyK'));
  assert.deepEqual(h.chars.map((c) => [c.str, c.invalid]), [['¨k', true]]);
});

test('^ puis espace donne « ^ » (et ¨ puis espace donne « ¨ »), sans erreur', () => {
  let h = harness();
  h.r.keydown(deadDown(false));
  h.r.keydown(plain(' ', 'Space'));
  assert.deepEqual(h.chars.map((c) => [c.str, c.invalid]), [['^', false]]);
  h = harness();
  h.r.keydown(deadDown(true));
  h.r.keydown(plain(' ', 'Space'));
  assert.deepEqual(h.chars.map((c) => [c.str, c.invalid]), [['¨', false]]);
  // via la composition
  h = harness();
  h.r.keydown(deadDown(false));
  h.r.keydown(process('Space'));
  h.r.compositionend({ data: '^' });
  assert.deepEqual(h.chars.map((c) => [c.str, c.invalid]), [['^', false]]);
});

test('comparaison en NFC : une composition rendue en lettre + accent combinant devient la lettre unique', () => {
  const h = harness();
  h.r.keydown(deadDown(false));
  h.r.keydown(process('KeyE'));
  h.r.compositionend({ data: 'ê' }); // e + accent circonflexe combinant (décomposé)
  assert.equal(h.chars[0].str, 'ê');
  assert.equal(h.chars[0].str, 'ê', 'caractère unique U+00EA');
  assert.equal(h.chars[0].str.normalize('NFC'), h.chars[0].str);
  assert.equal(h.chars[0].invalid, false);
  // key décomposé aussi
  const h2 = harness();
  h2.r.keydown(deadDown(false));
  h2.r.keydown(plain('ô', 'KeyO'));
  assert.equal(h2.chars[0].str, 'ô');
});

test('Maj tenu pendant la voyelle : majuscules accentuées (Ê, Ï)', () => {
  const h = harness();
  h.r.keydown(deadDown(false));
  h.r.keydown(ev({ key: 'Shift', code: 'ShiftLeft', shiftKey: true })); // la touche Maj elle-même est ignorée
  assert.equal(h.chars.length, 0);
  assert.equal(h.r.state().pending, '^', 'Maj n\'annule pas l\'attente');
  h.r.keydown(plain('E', 'KeyE', true));
  assert.equal(h.chars[0].str, 'Ê');
  const h2 = harness();
  h2.r.keydown(deadDown(true));
  h2.r.keydown(plain('I', 'KeyI', true));
  assert.equal(h2.chars[0].str, 'Ï');
});

test('Retour arrière et Échap annulent l\'attente (et gardent leur rôle) ; une touche sans rapport aussi', () => {
  for (const key of ['Backspace', 'Escape']) {
    const h = harness();
    h.r.keydown(deadDown(false));
    const r = h.r.keydown(plain(key, key));
    assert.equal(r.consumed, false, key + ' reste traité par l\'exercice');
    assert.equal(h.chars.length, 0);
    assert.deepEqual(JSON.parse(JSON.stringify(h.pendings.slice(-1))), [{ ch: null, cancelled: true }]);
    assert.equal(h.r.state().pending, null);
    assert.ok(h.resets >= 1, 'le champ caché est vidé');
  }
  const h = harness();
  h.r.keydown(deadDown(false));
  const r = h.r.keydown(plain('ArrowLeft', 'ArrowLeft'));
  assert.equal(r.consumed, false);
  assert.equal(h.r.state().pending, null);
});

test('touche maintenue : les répétitions de la touche morte ne comptent pas', () => {
  const h = harness();
  h.r.keydown(deadDown(false));
  h.r.keydown(ev({ key: 'Dead', code: 'BracketLeft', keyCode: 219, repeat: true }));
  h.r.keydown(ev({ key: 'Dead', code: 'BracketLeft', keyCode: 219, repeat: true }));
  assert.equal(h.chars.length, 0);
  assert.equal(h.r.state().pending, '^');
  h.r.keydown(plain('i', 'KeyI'));
  assert.deepEqual(h.chars.map((c) => c.str), ['î']);
});

test('beforeinput / input : le navigateur insère directement la lettre', () => {
  let h = harness();
  h.r.keydown(deadDown(false));
  const b = ev({ type: 'beforeinput', inputType: 'insertText', data: 'ê' });
  const rb = h.r.beforeinput(b);
  assert.equal(rb.consumed, true);
  assert.equal(b.defaultPrevented, true);
  assert.deepEqual(h.chars.map((c) => [c.str, c.source]), [['ê', 'input']]);
  // l'événement input qui suit n'est pas recompté
  const ri = h.r.input({ inputType: 'insertText', data: 'ê' });
  assert.equal(ri.consumed, true);
  assert.equal(h.chars.length, 1);
  // input seul (sans beforeinput)
  h = harness();
  h.r.keydown(deadDown(false));
  h.r.input({ inputType: 'insertText', data: 'â' });
  assert.deepEqual(h.chars.map((c) => c.str), ['â']);
});

test('composition démarrée sans keydown « Dead » reconnu : l\'attente démarre avec compositionupdate / beforeinput', () => {
  let h = harness();
  h.r.compositionupdate({ data: '^' });
  assert.equal(h.r.state().pending, '^');
  h.r.compositionend({ data: 'ô' });
  assert.deepEqual(h.chars.map((c) => c.str), ['ô']);
  h = harness();
  h.r.beforeinput({ inputType: 'insertCompositionText', data: '¨' });
  assert.equal(h.r.state().pending, '¨');
  h.r.input({ inputType: 'insertText', data: 'ï' });
  assert.deepEqual(h.chars.map((c) => c.str), ['ï']);
  // la touche « Process » sur BracketLeft est reconnue comme la touche morte
  h = harness();
  h.r.keydown(ev({ key: 'Process', code: 'BracketLeft', keyCode: 229 }));
  assert.equal(h.r.state().pending, '^');
});

test('les touches ordinaires ne sont pas touchées par la machine', () => {
  const h = harness();
  for (const k of ['e', 'a', ' ', 'É', '5', 'ê']) {
    const r = h.r.keydown(plain(k, 'KeyX'));
    assert.equal(r.consumed, false, k);
  }
  assert.equal(h.chars.length, 0);
  // une composition étrangère sans attente est ignorée
  assert.equal(h.r.compositionend({ data: 'x' }).consumed, false);
});

test('mode observation (page de diagnostic) : jamais de preventDefault, jamais de remise à zéro du champ', () => {
  const h = harness({ observe: true });
  const a = deadDown(false);
  const b = plain('e', 'KeyE');
  h.r.keydown(a);
  h.r.keydown(b);
  assert.equal(a.defaultPrevented, false);
  assert.equal(b.defaultPrevented, false);
  assert.equal(h.resets, 0);
  assert.deepEqual(h.chars.map((c) => c.str), ['ê'], 'mais le résultat est bien calculé');
});

test('la table de composition est complète et cohérente avec le clavier visuel (Mac et PC)', () => {
  const DD = loadSite(['util.js', 'store.js', 'layout.js']);
  for (const id of ['mac', 'pc']) {
    const layout = DD.Layout.get(id);
    for (const [dead, t] of Object.entries(DK.TABLE)) {
      for (const [vowel, composed] of Object.entries(t)) {
        const h = layout.hint(composed);
        assert.ok(h, `${id} : ${composed} doit être tapable`);
        assert.equal(h.dead, true);
        assert.equal(h.deadChar, dead, `${id} : ${composed} se tape avec ${dead}`);
        assert.equal(h.vowel, vowel.toLowerCase());
        assert.equal(h.steps.length, 2, 'deux étapes : la touche morte, puis la voyelle');
        assert.equal(h.steps[0].includes('^'), true, 'étape 1 : la touche ^');
        assert.equal(h.steps[0].includes('ShiftL'), dead === '¨', 'Maj gauche seulement pour le tréma');
        assert.equal(h.steps[1][h.steps[1].length - 1], layout.map[vowel.toLowerCase()].id, 'étape 2 : la voyelle');
        // et la machine donne la même lettre
        assert.equal(DK.combine(dead, vowel).str, composed);
      }
    }
    // « ^ » et « ¨ » seuls : la touche morte puis l'espace
    assert.deepEqual(JSON.parse(JSON.stringify(layout.hint('^').steps)), [['^'], ['Space']]);
    assert.deepEqual(JSON.parse(JSON.stringify(layout.hint('¨').steps)), [['ShiftL', '^'], ['Space']]);
  }
});
