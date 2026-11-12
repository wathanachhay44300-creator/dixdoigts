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

  // Lettre + accent circonflexe / tréma : touche morte ^ puis la lettre.
  const COMPOSE = { ê: 'e', â: 'a', î: 'i', ô: 'o', û: 'u' };

  const K = (b, s, f, extra) => Object.assign({ b, s, f, w: 1 }, extra);
  const S = (id, label, f, w, extra) => Object.assign({ id, label, f, w, special: true }, extra);
  const SP = (w) => ({ spacer: true, w });
  const row = (letters) => letters.split('').map((c) => K(c, c.toUpperCase(), LETTER_FINGER[c]));

  const bottomBlank = [SP(4), S('Space', '', 'TH', 7), SP(4)];

  const DEFS = {
    mac: {
      id: 'mac',
      name: 'AZERTY (Mac)',
      rows: [
        [K('@', '#', 'LP'), K('&', '1', 'LP'), K('é', '2', 'LR'), K('"', '3', 'LM'), K("'", '4', 'LI'), K('(', '5', 'LI'), K('§', '6', 'RI'), K('è', '7', 'RI'), K('!', '8', 'RM'), K('ç', '9', 'RR'), K('à', '0', 'RP'), K(')', '°', 'RP'), K('-', '_', 'RP'), S('Back', '⌫', 'RP', 2)],
        [S('Tab', 'tab', 'LP', 1.5), ...row('azertyuiop'), K('^', '¨', 'RP', { dead: true }), K('$', '*', 'RP'), S('Enter', 'entrée', 'RP', 1.5)],
        [S('Caps', 'verr. maj', 'LP', 1.75), ...row('qsdfghjklm'), K('ù', '%', 'RP'), K('`', '£', 'RP'), S('Enter2', '', 'RP', 1.25)],
        [S('ShiftL', 'maj', 'LP', 1.25), K('<', '>', 'LP'), ...row('wxcvbn'), K(',', '?', 'RM'), K(';', '.', 'RR'), K(':', '/', 'RP'), K('=', '+', 'RP'), S('ShiftR', 'maj', 'RP', 2.75)],
        bottomBlank,
      ],
    },
    pc: {
      id: 'pc',
      name: 'AZERTY (PC)',
      rows: [
        [K('²', null, 'LP'), K('&', '1', 'LP'), K('é', '2', 'LR'), K('"', '3', 'LM'), K("'", '4', 'LI'), K('(', '5', 'LI'), K('-', '6', 'RI'), K('è', '7', 'RI'), K('_', '8', 'RM'), K('ç', '9', 'RR'), K('à', '0', 'RP'), K(')', '°', 'RP'), K('=', '+', 'RP'), S('Back', '⌫', 'RP', 2)],
        [S('Tab', 'tab', 'LP', 1.5), ...row('azertyuiop'), K('^', '¨', 'RP', { dead: true }), K('$', '£', 'RP'), S('Enter', 'entrée', 'RP', 1.5)],
        [S('Caps', 'verr. maj', 'LP', 1.75), ...row('qsdfghjklm'), K('ù', '%', 'RP'), K('*', 'µ', 'RP'), S('Enter2', '', 'RP', 1.25)],
        [S('ShiftL', 'maj', 'LP', 1.25), K('<', '>', 'LP'), ...row('wxcvbn'), K(',', '?', 'RM'), K(';', '.', 'RR'), K(':', '/', 'RP'), K('!', '§', 'RP'), S('ShiftR', 'maj', 'RP', 2.75)],
        bottomBlank,
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
    // Quelles touches faut-il presser pour ce caractère ?
    def.hint = function (ch) {
      if (ch === ' ') return { keys: ['Space'], main: 'Space', finger: 'TH', shift: false, dead: false };
      if (COMPOSE[ch]) {
        const base = map[COMPOSE[ch]];
        return { keys: ['^', base.id], main: base.id, finger: keys[base.id].f, shift: false, dead: true };
      }
      const m = map[ch];
      if (!m) return null;
      const k = keys[m.id];
      const out = [];
      if (m.shift) out.push(FINGERS[k.f].hand === 'L' ? 'ShiftR' : 'ShiftL');
      out.push(m.id);
      return { keys: out, main: m.id, finger: k.f, shift: m.shift, dead: false };
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
