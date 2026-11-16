/* Dispositions de clavier AZERTY (Mac et PC), doigts, et "quelle(s) touche(s) pour ce caractère ?" */
(function () {
  const DD = window.DD;

  const FINGERS = {
    LP: { name: 'auriculaire gauche', hand: 'L', color: '#e5557f' },
    LR: { name: 'annulaire gauche', hand: 'L', color: '#f08c3a' },
    LM: { name: 'majeur gauche', hand: 'L', color: '#e0b41c' },
    LI: { name: 'index gauche', hand: 'L', color: '#4fb35a' },
    RI: { name: 'index droit', hand: 'R', color: '#26a8b0' },
    RM: { name: 'majeur droit', hand: 'R', color: '#3b88e0' },
    RR: { name: 'annulaire droit', hand: 'R', color: '#7a62dc' },
    RP: { name: 'auriculaire droit', hand: 'R', color: '#bf5bd0' },
    TH: { name: 'pouce', hand: 'T', color: '#97a1ab' },
  };

  const LETTER_FINGER = {
    a: 'LP', z: 'LR', e: 'LM', r: 'LI', t: 'LI', y: 'RI', u: 'RI', i: 'RM', o: 'RR', p: 'RP',
    q: 'LP', s: 'LR', d: 'LM', f: 'LI', g: 'LI', h: 'RI', j: 'RI', k: 'RM', l: 'RR', m: 'RP',
    w: 'LP', x: 'LR', c: 'LM', v: 'LI', b: 'LI', n: 'RI',
  };

  // Lettres composées avec une touche morte : on appuie d'abord sur la touche morte, puis sur la voyelle.
  //   ^ (à droite de P) puis la voyelle      -> â ê î ô û
  //   Maj + ^ (donne ¨) puis la voyelle      -> ä ë ï ö ü ÿ
  const COMPOSE = { ê: 'e', â: 'a', î: 'i', ô: 'o', û: 'u', ë: 'e', ï: 'i', ä: 'a', ö: 'o', ü: 'u', ÿ: 'y' };
  const DEAD_OF = { ê: '^', â: '^', î: '^', ô: '^', û: '^', ë: '¨', ï: '¨', ä: '¨', ö: '¨', ü: '¨', ÿ: '¨' };

  const K = (b, s, f, extra) => Object.assign({ b, s, f, w: 1 }, extra);
  const S = (id, label, f, w, extra) => Object.assign({ id, label, f, w, special: true }, extra);
  const SP = (w) => ({ spacer: true, w });
  const row = (letters) => letters.split('').map((c) => K(c, c.toUpperCase(), LETTER_FINGER[c]));

  // Rangée du bas : la barre d'espace et, à sa droite, AltGr (touche « option » sur Mac), tapée par le pouce droit.
  const bottomRow = (altLabel) => [SP(3.5), S('Space', '', 'TH', 6.5), S('AltGr', altLabel, 'TH', 1.25, { thumb: 'R' }), SP(3.75)];

  // Sur PC, ces caractères se tapent avec AltGr + la touche indiquée (identifiant = caractère sans Maj de la touche).
  const ALTGR_PC = { '~': 'é', '#': '"', '{': "'", '[': '(', '|': '-', '`': 'è', '\\': '_', '@': 'à', ']': ')', '}': '=', '€': 'e' };

  const DEFS = {
    mac: {
      id: 'mac',
      name: 'AZERTY (Mac)',
      rows: [
        [K('@', '#', 'LP'), K('&', '1', 'LP'), K('é', '2', 'LR'), K('"', '3', 'LM'), K("'", '4', 'LI'), K('(', '5', 'LI'), K('§', '6', 'RI'), K('è', '7', 'RI'), K('!', '8', 'RM'), K('ç', '9', 'RR'), K('à', '0', 'RP'), K(')', '°', 'RP'), K('-', '_', 'RP'), S('Back', '⌫', 'RP', 2)],
        [S('Tab', 'tab', 'LP', 1.5), ...row('azertyuiop'), K('^', '¨', 'RP', { dead: true }), K('$', '*', 'RP'), S('Enter', 'entrée', 'RP', 1.5)],
        [S('Caps', 'verr. maj', 'LP', 1.75), ...row('qsdfghjklm'), K('ù', '%', 'RP'), K('`', '£', 'RP'), S('Enter2', '', 'RP', 1.25)],
        [S('ShiftL', 'maj', 'LP', 1.25), K('<', '>', 'LP'), ...row('wxcvbn'), K(',', '?', 'RM'), K(';', '.', 'RR'), K(':', '/', 'RP'), K('=', '+', 'RP'), S('ShiftR', 'maj', 'RP', 2.75)],
        bottomRow('⌥'),
      ],
      altgr: {},
    },
    pc: {
      id: 'pc',
      name: 'AZERTY (PC)',
      altgr: ALTGR_PC,
      rows: [
        [K('²', null, 'LP'), K('&', '1', 'LP'), K('é', '2', 'LR'), K('"', '3', 'LM'), K("'", '4', 'LI'), K('(', '5', 'LI'), K('-', '6', 'RI'), K('è', '7', 'RI'), K('_', '8', 'RM'), K('ç', '9', 'RR'), K('à', '0', 'RP'), K(')', '°', 'RP'), K('=', '+', 'RP'), S('Back', '⌫', 'RP', 2)],
        [S('Tab', 'tab', 'LP', 1.5), ...row('azertyuiop'), K('^', '¨', 'RP', { dead: true }), K('$', '£', 'RP'), S('Enter', 'entrée', 'RP', 1.5)],
        [S('Caps', 'verr. maj', 'LP', 1.75), ...row('qsdfghjklm'), K('ù', '%', 'RP'), K('*', 'µ', 'RP'), S('Enter2', '', 'RP', 1.25)],
        [S('ShiftL', 'maj', 'LP', 1.25), K('<', '>', 'LP'), ...row('wxcvbn'), K(',', '?', 'RM'), K(';', '.', 'RR'), K(':', '/', 'RP'), K('!', '§', 'RP'), S('ShiftR', 'maj', 'RP', 2.75)],
        bottomRow('alt gr'),
      ],
    },
  };

  function build(def) {
    const map = {}; // caractère -> {id, shift}
    const keys = {}; // id -> touche
    def.rows.forEach((r) =>
      r.forEach((k) => {
        if (k.spacer) return;
        if (!k.id) k.id = k.b;
        keys[k.id] = k;
        if (!k.special && !k.dead) {
          if (!(k.b in map)) map[k.b] = { id: k.id, shift: false };
          if (k.s && !(k.s in map)) map[k.s] = { id: k.id, shift: true };
        }
      })
    );
    def.map = map;
    def.keys = keys;
    // Maj de la main opposée à celle qui tape la touche
    const shiftFor = (id) => (FINGERS[keys[id].f].hand === 'L' ? 'ShiftR' : 'ShiftL');
    // Quelles touches faut-il presser pour ce caractère ?
    //   keys  : toutes les touches, dans l'ordre ; steps : les mêmes, en étapes (2 étapes pour une touche morte)
    //   dead  : vrai si une touche morte est nécessaire (deadChar : '^' ou '¨')
    def.hint = function (ch) {
      if (ch === ' ') return { keys: ['Space'], steps: [['Space']], main: 'Space', finger: 'TH', shift: false, dead: false };
      // touche morte seule : on l'écrit en appuyant dessus puis sur la barre d'espace
      if (ch === '^' || ch === '¨') {
        const first = ch === '¨' ? [shiftFor('^'), '^'] : ['^'];
        return { keys: first.concat(['Space']), steps: [first, ['Space']], main: '^', finger: keys['^'].f, shift: false, dead: true, deadChar: ch, vowel: ' ' };
      }
      const lower = ch.toLowerCase();
      if (COMPOSE[lower]) {
        const base = map[COMPOSE[lower]];
        const upper = ch !== lower; // majuscule : Maj (main opposée) avec la voyelle, après la touche morte
        const dead = DEAD_OF[lower];
        const first = dead === '¨' ? [shiftFor('^'), '^'] : ['^'];
        const second = upper ? [shiftFor(base.id), base.id] : [base.id];
        return { keys: first.concat(second), steps: [first, second], main: base.id, finger: keys[base.id].f, shift: false, dead: true, deadChar: dead, vowel: COMPOSE[lower], upper };
      }
      const m = map[ch];
      if (!m) {
        // caractère tapé avec AltGr (pouce droit) + une touche, sur PC
        const ag = def.altgr && def.altgr[ch];
        if (ag && keys[ag]) return { keys: ['AltGr', ag], steps: [['AltGr', ag]], main: ag, finger: keys[ag].f, shift: false, dead: false, altgr: true };
        return null;
      }
      const k = keys[m.id];
      const out = [];
      if (m.shift) out.push(shiftFor(m.id));
      out.push(m.id);
      return { keys: out, steps: [out], main: m.id, finger: k.f, shift: m.shift, dead: false };
    };
    // Touche physique principale d'un caractère (pour la carte de chaleur)
    def.keyOf = function (ch) {
      const h = def.hint(ch);
      return h ? h.main : null;
    };
    return def;
  }
  Object.values(DEFS).forEach(build);

  DD.Layout = {
    FINGERS,
    COMPOSE,
    DEAD_OF,
    LETTER_FINGER,
    get(id) {
      return DEFS[id] || DEFS.mac;
    },
    current() {
      const id = DD.Store && DD.Store.state.settings.layout;
      return DEFS[id] || DEFS.mac;
    },
    all: () => Object.values(DEFS),
    // Chaque caractère des textes est-il tapable ?
    typable(ch, layout) {
      return !!(layout || DD.Layout.current()).hint(ch);
    },
  };
})();
