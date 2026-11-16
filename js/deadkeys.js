/*
 * Touches mortes — module PUR (aucun accès au navigateur : il reçoit des événements, il rend des caractères).
 *
 * Sur un clavier AZERTY français :
 *   ^ (à droite de P) puis une voyelle        -> â ê î ô û
 *   Maj + ^ (donne ¨) puis une voyelle        -> ä ë ï ö ü ÿ
 *   ^ puis espace                             -> ^   (et ¨ puis espace -> ¨)
 *
 * Les navigateurs ne se comportent pas pareil. Cette machine à états les accepte tous :
 *   A. Le navigateur compose lui-même (Chrome, Edge...) : keydown "Dead", compositionstart / update / end,
 *      puis la lettre finale dans compositionend (ou dans key). On attend ces événements.
 *   B. key contient déjà la lettre composée (ex. "ê") : on la prend telle quelle.
 *   C. La composition n'a pas lieu et la voyelle arrive seule (key = "e") : SOLUTION DE SECOURS, on reconstitue le
 *      caractère avec la table ^ -> â ê î ô û / ¨ -> ä ë ï ö ü.
 *   D. Le navigateur envoie "Process" / "Unidentified" (keyCode 229) sans composition : repli par la touche physique
 *      (event.code) avec la disposition AZERTY.
 *
 * États : aucune touche morte en attente -> touche morte en attente -> caractère final.
 * ATTENTION : ne jamais annuler (preventDefault) le keydown de la touche morte : cela empêche le navigateur de composer.
 *
 * create({ onChar(str, info), onPending(deadChar|null, meta), reset(), now(), setTimer(fn, ms), clearTimer(id),
 *          fallbackMs, observe })
 *   onChar   : le caractère FINAL (déjà en NFC). info = { source, dead, invalid }. invalid = vrai pour une combinaison
 *              impossible (^ puis p donne « ^p » : une seule erreur côté exercice).
 *   onPending: appelé quand une touche morte attend sa voyelle (deadChar = '^' ou '¨'), puis avec null quand c'est fini
 *              (meta.resolved = vrai si un caractère suit, meta.cancelled = vrai si on a annulé).
 *   observe  : vrai = ne jamais appeler preventDefault (page de diagnostic : on regarde sans rien changer).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && root.DD) root.DD.DeadKeys = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const TABLE = {
    '^': { a: 'â', e: 'ê', i: 'î', o: 'ô', u: 'û', A: 'Â', E: 'Ê', I: 'Î', O: 'Ô', U: 'Û' },
    '¨': { a: 'ä', e: 'ë', i: 'ï', o: 'ö', u: 'ü', y: 'ÿ', A: 'Ä', E: 'Ë', I: 'Ï', O: 'Ö', U: 'Ü', Y: 'Ÿ' },
  };
  const DEAD_CHARS = ['^', '¨'];
  const COMPOSED = new Set(Object.values(TABLE).flatMap((t) => Object.values(t)));

  // Touche physique -> lettre, pour un clavier AZERTY (solution de secours quand key ne donne pas la lettre).
  const CODE_LETTER = {
    KeyQ: 'a', KeyW: 'z', KeyE: 'e', KeyR: 'r', KeyT: 't', KeyY: 'y', KeyU: 'u', KeyI: 'i', KeyO: 'o', KeyP: 'p',
    KeyA: 'q', KeyS: 's', KeyD: 'd', KeyF: 'f', KeyG: 'g', KeyH: 'h', KeyJ: 'j', KeyK: 'k', KeyL: 'l', Semicolon: 'm',
    KeyZ: 'w', KeyX: 'x', KeyC: 'c', KeyV: 'v', KeyB: 'b', KeyN: 'n', Space: ' ',
  };
  const MODIFIER_KEYS = new Set(['Shift', 'Control', 'Alt', 'AltGraph', 'Meta', 'CapsLock', 'OS', 'Fn', 'NumLock', 'ScrollLock']);

  const nfc = (s) => String(s == null ? '' : s).normalize('NFC');
  const single = (k) => {
    if (typeof k !== 'string') return null;
    const n = nfc(k);
    return Array.from(n).length === 1 ? n : null;
  };

  // Que donne la touche morte `dead` suivie du caractère `c` ?
  function combine(dead, c) {
    if (c === ' ') return { str: dead, invalid: false }; // ^ puis espace = ^
    const hit = TABLE[dead] && TABLE[dead][c];
    if (hit) return { str: hit, invalid: false };
    return { str: dead + c, invalid: true }; // combinaison impossible : « ^p »
  }

  // C'est la touche morte elle-même qu'on vient d'appuyer ?
  function isDeadStart(ev) {
    const k = ev.key;
    if (k === 'Dead') return true;
    // Certains navigateurs envoient "Process" / "Unidentified" (keyCode 229) pour la touche à droite de P
    return ev.code === 'BracketLeft' && (k === 'Process' || k === 'Unidentified' || ev.keyCode === 229);
  }
  const isComposingKey = (ev) => !!ev.isComposing || ev.keyCode === 229 || ev.key === 'Process' || ev.key === 'Unidentified';
  // La touche à droite de P : ^ seule, ou ¨ avec Maj. Une autre touche morte (ex. ´ sur Mac) : « · » (inconnue) ;
  // dans ce cas on se fie à la composition du navigateur.
  const deadCharOf = (ev) => (ev.code === 'BracketLeft' || ev.code === '' || ev.code == null ? (ev.shiftKey ? '¨' : '^') : '·');

  function create(o) {
    o = o || {};
    const observe = !!o.observe;
    const now = o.now || (() => Date.now());
    const setT = o.setTimer || ((f, ms) => setTimeout(f, ms));
    const clrT = o.clearTimer || ((id) => clearTimeout(id));
    const fallbackMs = o.fallbackMs == null ? 120 : o.fallbackMs;
    let dead = null; // { ch, composing, waiting, code, shift }
    let timer = null;
    let last = null; // dernier caractère rendu : évite de le compter deux fois (keydown puis composition)

    const pending = (ch, meta) => o.onPending && o.onPending(ch, meta || {});
    const stopTimer = () => {
      if (timer != null) clrT(timer);
      timer = null;
    };
    const prevent = (ev) => {
      if (!observe && ev && typeof ev.preventDefault === 'function') ev.preventDefault();
    };
    const resetField = () => {
      if (!observe && o.reset) o.reset();
    };

    function resolve(str, source, invalid) {
      const d = dead;
      dead = null;
      stopTimer();
      last = { str: nfc(str), at: now() };
      resetField();
      pending(null, { resolved: true });
      if (o.onChar) o.onChar(nfc(str), { source, dead: d ? d.ch : null, invalid: !!invalid });
    }
    function cancel() {
      if (!dead) return;
      dead = null;
      stopTimer();
      resetField();
      pending(null, { cancelled: true });
    }
    function startDead(ch, viaComposition) {
      dead = { ch, composing: !!viaComposition, waiting: false };
      stopTimer();
      pending(ch, {});
    }
    const recent = (str) => !!(last && str === last.str && now() - last.at < 400);

    // Pas d'événement de composition : on reconstitue la lettre avec la touche physique (disposition AZERTY).
    function fromCode(d) {
      let letter = CODE_LETTER[d.code];
      if (letter && d.shift && letter !== ' ') letter = letter.toUpperCase();
      if (!letter) return resolve(d.ch + '?', 'code-fallback', true);
      const r = combine(d.ch, letter);
      resolve(r.str, 'code-fallback', r.invalid);
    }

    return {
      // Renvoie { consumed, prevented } : consumed = la machine s'est occupée de cette touche (pas de traitement normal).
      keydown(ev) {
        const key = ev.key;
        if (MODIFIER_KEYS.has(key)) return { consumed: false };
        if (!dead) {
          if (ev.repeat) return { consumed: false };
          if (isDeadStart(ev)) {
            // surtout : PAS de preventDefault ici, sinon le navigateur ne compose pas l'accent
            startDead(deadCharOf(ev), false);
            return { consumed: true, prevented: false };
          }
          return { consumed: false };
        }
        // ---- une touche morte attend sa voyelle ----
        if (ev.repeat) return { consumed: true, prevented: false };
        if (key === 'Escape' || key === 'Backspace') {
          cancel();
          return { consumed: false }; // Échap et Retour arrière gardent leur rôle habituel
        }
        const d = dead;
        if (isDeadStart(ev)) {
          // deux touches mortes de suite : « ^^ » (combinaison impossible)
          prevent(ev);
          resolve(d.ch + deadCharOf(ev), 'keydown-table', true);
          return { consumed: true, prevented: !observe };
        }
        const c = single(key);
        if (c !== null && !isComposingKey(ev)) {
          prevent(ev);
          if (COMPOSED.has(c)) resolve(c, 'keydown-composed', false); // B : le navigateur a déjà composé
          else {
            const r = combine(d.ch, c); // C : la voyelle arrive seule : on compose nous-mêmes
            resolve(r.str, 'keydown-table', r.invalid);
          }
          return { consumed: true, prevented: !observe };
        }
        if (isComposingKey(ev)) {
          // A / D : la composition est en cours. On attend compositionend ; sinon repli par la touche physique.
          d.waiting = true;
          d.code = ev.code;
          d.shift = !!ev.shiftKey;
          stopTimer();
          timer = setT(() => {
            timer = null;
            if (dead === d) fromCode(d);
          }, fallbackMs);
          return { consumed: true, prevented: false };
        }
        // touche sans rapport (flèche, F5...) : on abandonne l'attente
        cancel();
        return { consumed: false };
      },

      compositionstart() {
        if (dead) dead.composing = true;
        return { consumed: !!dead };
      },
      compositionupdate(ev) {
        const data = nfc(ev.data);
        if (!dead && single(data) && DEAD_CHARS.includes(data)) {
          startDead(data, true); // composition sans keydown "Dead" reconnu : on démarre l'attente ici
          return { consumed: true };
        }
        if (dead) dead.composing = true;
        return { consumed: !!dead };
      },
      compositionend(ev) {
        const data = nfc(ev.data);
        if (dead) {
          if (data) resolve(data, 'composition', Array.from(data).length > 1);
          else cancel();
          return { consumed: true };
        }
        // déjà rendu par keydown (B ou C) : on ne le compte pas deux fois
        return { consumed: recent(data) };
      },
      beforeinput(ev) {
        const data = nfc(ev.data);
        const type = ev.inputType || '';
        if (dead && type === 'insertText' && data) {
          prevent(ev);
          resolve(data, 'input', Array.from(data).length > 1);
          return { consumed: true };
        }
        if (!dead && type === 'insertCompositionText' && single(data) && DEAD_CHARS.includes(data)) {
          startDead(data, true);
          return { consumed: true };
        }
        return { consumed: !dead && !!data && recent(data) };
      },
      input(ev) {
        const data = nfc(ev.data);
        if (dead && ev.inputType === 'insertText' && data) {
          resolve(data, 'input', Array.from(data).length > 1);
          return { consumed: true };
        }
        return { consumed: !dead && !!data && recent(data) };
      },

      cancel,
      state: () => ({ pending: dead ? dead.ch : null, composing: !!(dead && dead.composing) }),
    };
  }

  return { create, combine, isDeadStart, TABLE, COMPOSED, DEAD_CHARS, CODE_LETTER };
});
