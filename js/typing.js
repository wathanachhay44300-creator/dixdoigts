/* Moteur de frappe : saisie clavier, affichage du texte, exercice "strict" (leçons). */
(function () {
  const DD = window.DD;
  const F = DD.Layout.FINGERS;

  // ---- Saisie ---------------------------------------------------------------------------
  // handler({ key, ev }) reçoit 'Escape', 'Backspace', 'Enter' ou UN caractère (déjà composé : ê, É, 5...).
  DD.Input = {
    attach(handler) {
      if (document.activeElement && document.activeElement !== document.body && document.activeElement.blur) document.activeElement.blur();
      const down = (ev) => {
        const t = ev.target;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
        if (ev.ctrlKey || ev.metaKey) return;
        const k = ev.key;
        if (k === 'Dead') {
          ev.preventDefault();
          return;
        }
        let key = null;
        if (k === 'Escape' || k === 'Backspace' || k === 'Enter') key = k;
        else if (k && Array.from(k.normalize('NFC')).length === 1) key = k.normalize('NFC');
        if (!key) return;
        ev.preventDefault(); // évite aussi la recherche rapide de Firefox (' et /) et le défilement avec Espace
        if (ev.repeat) return;
        handler({ key, ev });
      };
      // Espace sur un bouton "cliquerait" au relâchement : on l'empêche pendant la frappe.
      const up = (ev) => {
        if (ev.key === ' ') ev.preventDefault();
      };
      window.addEventListener('keydown', down);
      window.addEventListener('keyup', up);
      return () => {
        window.removeEventListener('keydown', down);
        window.removeEventListener('keyup', up);
      };
    },
  };

  // ---- Affichage du texte ----------------------------------------------------------------
  DD.TextView = function (text, opts) {
    opts = opts || {};
    text = text.normalize('NFC');
    const chars = Array.from(text);
    const el = DD.el('div', 'tt' + (opts.test ? ' test' : ''));
    const inner = DD.el('div', 'tt-inner');
    if (opts.test) {
      // Fenêtre de hauteur exacte (3 lignes) : le défilement ne laisse pas voir de demi-lignes.
      const view = DD.el('div', 'tt-view');
      view.appendChild(inner);
      el.appendChild(view);
    } else el.appendChild(inner);
    const spans = [];
    let i = 0;
    text.split(' ').forEach((word, wi, arr) => {
      const w = DD.el('span', 'w');
      Array.from(word).forEach((c) => {
        const s = DD.el('span', 'ch');
        s.textContent = c;
        w.appendChild(s);
        spans.push(s);
        i++;
      });
      // L'espace suit son mot dans le même bloc : une ligne ne commence jamais par une espace.
      if (wi < arr.length - 1) {
        const sp = DD.el('span', 'ch sp');
        sp.textContent = ' ';
        w.appendChild(sp);
        spans.push(sp);
        i++;
      }
      inner.appendChild(w);
    });
    let cur = -1;
    let lineH = 0;
    return {
      el,
      chars,
      length: chars.length,
      set(idx, state) {
        const s = spans[idx];
        if (!s) return;
        s.classList.remove('ok', 'bad');
        if (state) s.classList.add(state);
      },
      caret(idx, err) {
        if (cur >= 0 && spans[cur]) spans[cur].classList.remove('cur', 'err');
        cur = idx;
        const s = spans[idx];
        if (!s) return;
        s.classList.add('cur');
        if (err) {
          void s.offsetWidth;
          s.classList.add('err');
        }
      },
      // Fait défiler le texte pour garder la ligne courante en 2e position (mode test).
      scroll() {
        if (!opts.test) return;
        const s = spans[Math.min(cur, spans.length - 1)];
        if (!s) return;
        if (!lineH) lineH = parseFloat(getComputedStyle(inner).lineHeight) || 50;
        const line = Math.round(s.offsetTop / lineH);
        inner.style.transform = 'translateY(' + -Math.max(0, line - 1) * lineH + 'px)';
      },
    };
  };

  // ---- Indication "quelle touche, quel doigt" ---------------------------------------------
  function keyLabel(id) {
    if (id === 'ShiftL') return 'Maj gauche';
    if (id === 'ShiftR') return 'Maj droite';
    if (id === 'Space') return 'Espace';
    if (id === '^') return 'touche ^';
    return /^[a-z]$/.test(id) ? id.toUpperCase() : id;
  }
  DD.hintHTML = function (ch, layout) {
    const h = layout.hint(ch);
    if (!h) return '';
    const shown = ch === ' ' ? 'espace' : ch;
    let s = '<span class="hint-char">' + DD.esc(shown) + '</span> ';
    const mainName = h.finger === 'TH' ? 'pouce' : F[h.finger].name;
    if (h.shift) {
      const sh = h.keys[0];
      const shFinger = sh === 'ShiftL' ? F.LP : F.RP;
      s += '<span class="hint-text">' + keyLabel(sh) + ' <em>(' + shFinger.name + ')</em> + ' + DD.esc(ch) + ' <em>(' + mainName + ')</em></span>';
    } else if (h.dead) {
      s += '<span class="hint-text">touche ^ <em>(auriculaire droit)</em>, puis ' + keyLabel(h.main) + ' <em>(' + mainName + ')</em></span>';
    } else {
      s += '<span class="hint-text">' + keyLabel(h.main) + ' <em>(' + mainName + ')</em></span>';
    }
    return s;
  };

})();
