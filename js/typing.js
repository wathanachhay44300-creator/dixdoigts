/* Moteur de frappe : saisie clavier, affichage du texte, exercice "strict" (leçons). */
(function () {
  const DD = window.DD;
  const F = DD.Layout.FINGERS;

  // ---- Saisie ---------------------------------------------------------------------------
  // handler reçoit :
  //   { key, ev }                 : 'Escape', 'Backspace', 'Enter' ou UN caractère final (déjà composé : ê, É, 5...),
  //                                 ou une combinaison impossible (« ^p » : une seule erreur à compter)
  //   { type: 'dead', key }       : une touche morte (^ ou ¨) attend sa voyelle : à montrer en grisé, SANS erreur,
  //                                 sans avancer le curseur et sans arrêter le chronomètre
  //   { type: 'deadend', resolved }: l'attente est finie (resolved : un caractère final va suivre ; sinon annulée)
  //
  // Pourquoi un champ de saisie invisible : pour composer un accent (^ puis e), le navigateur a besoin d'un champ qui
  // a le focus. Et surtout, on ne doit JAMAIS annuler (preventDefault) le keydown de la touche morte : c'est ce qui
  // empêchait ê, â, î, ô, û de fonctionner. Toute la logique est dans deadkeys.js (testée).
  const isControl = (t) => t && t.closest && t.closest('input:not(.dd-sink), textarea, select, button, a, [contenteditable="true"]');

  function makeSink() {
    document.querySelectorAll('input.dd-sink').forEach((e) => e.remove());
    const s = document.createElement('input');
    s.type = 'text';
    s.className = 'dd-sink';
    s.tabIndex = -1;
    s.name = 'dd-saisie';
    s.setAttribute('aria-hidden', 'true');
    s.setAttribute('autocomplete', 'off');
    s.setAttribute('autocorrect', 'off');
    s.setAttribute('autocapitalize', 'off');
    s.setAttribute('spellcheck', 'false');
    document.body.appendChild(s);
    return s;
  }

  DD.Input = {
    attach(handler) {
      if (document.activeElement && document.activeElement !== document.body && document.activeElement.blur) document.activeElement.blur();
      const sink = makeSink();
      const focusSink = () => {
        if (document.activeElement !== sink) {
          try {
            sink.focus({ preventScroll: true });
          } catch (e) {}
        }
      };
      // Le champ est vidé après chaque caractère ; pendant une composition, on le relâche pour l'interrompre proprement.
      const resetSink = () => {
        sink.value = '';
        if (document.activeElement === sink && resolver.state().composing) {
          sink.blur();
          focusSink();
        }
      };
      const resolver = DD.DeadKeys.create({
        now: () => performance.now(),
        onChar: (str, info) => handler({ key: str, type: 'key', source: info.source, invalid: info.invalid }),
        onPending: (ch, meta) => handler(ch ? { type: 'dead', key: ch } : { type: 'deadend', resolved: !!(meta && meta.resolved) }),
        reset: resetSink,
      });

      const down = (ev) => {
        const t = ev.target;
        if (t !== sink && isControl(t)) return; // l'utilisateur écrit ailleurs (réglages...)
        if (ev.ctrlKey || ev.metaKey) return;
        if (t !== sink) focusSink(); // dernier recours : sans champ actif, le navigateur ne compose pas les accents
        // 1) touches mortes et compositions : la machine à états s'en occupe (sans jamais annuler la touche morte)
        if (resolver.keydown(ev).consumed) return;
        // 2) touches ordinaires
        const k = ev.key;
        let key = null;
        if (k === 'Escape' || k === 'Backspace' || k === 'Enter') key = k;
        else if (k && Array.from(k.normalize('NFC')).length === 1) key = k.normalize('NFC');
        if (!key) return;
        ev.preventDefault(); // évite aussi la recherche rapide de Firefox (' et /), le défilement avec Espace, et l'écriture dans le champ caché
        if (ev.repeat) return;
        handler({ key, ev });
      };
      // Espace sur un bouton "cliquerait" au relâchement : on l'empêche pendant la frappe.
      const up = (ev) => {
        if (ev.key === ' ') ev.preventDefault();
      };
      // Événements du champ caché : composition et insertion de texte (Chrome, Edge, Firefox, Safari les envoient différemment)
      const onCompStart = (ev) => resolver.compositionstart(ev);
      const onCompUpdate = (ev) => resolver.compositionupdate(ev);
      const onCompEnd = (ev) => {
        resolver.compositionend(ev);
        if (!resolver.state().pending) sink.value = '';
      };
      const onBeforeInput = (ev) => {
        resolver.beforeinput(ev);
      };
      const onInput = (ev) => {
        resolver.input(ev);
        if (!ev.isComposing && !resolver.state().pending) sink.value = '';
      };
      const onFocusOut = (ev) => {
        if (!ev.relatedTarget) setTimeout(focusSink, 0); // le focus est tombé sur rien : on le reprend
      };
      const onPointer = (ev) => {
        if (!isControl(ev.target)) setTimeout(focusSink, 0);
      };
      // Après un clic de souris sur un bouton (démo, masquer le clavier...), la saisie reprend : le champ caché retrouve le focus.
      // Au clavier (Tab, Entrée), le bouton garde le focus : ev.detail vaut 0.
      const onClick = (ev) => {
        const b = ev.target && ev.target.closest ? ev.target.closest('button, a') : null;
        if (b && ev.detail > 0) setTimeout(() => {
          const a = document.activeElement;
          if (!a || a === document.body || a === b) focusSink();
        }, 0);
      };
      // Un élément qui se « défocalise » tout seul (btn.blur()) : on reprend le focus s'il est tombé sur la page.
      const onAnyFocusOut = (ev) => {
        if (ev.target === sink || ev.relatedTarget) return;
        setTimeout(() => {
          const a = document.activeElement;
          if (!a || a === document.body) focusSink();
        }, 0);
      };
      const onWinBlur = () => resolver.cancel(); // on change de fenêtre : plus d'accent en attente
      const onWinFocus = () => focusSink();

      window.addEventListener('keydown', down);
      window.addEventListener('keyup', up);
      sink.addEventListener('compositionstart', onCompStart);
      sink.addEventListener('compositionupdate', onCompUpdate);
      sink.addEventListener('compositionend', onCompEnd);
      sink.addEventListener('beforeinput', onBeforeInput);
      sink.addEventListener('input', onInput);
      sink.addEventListener('focusout', onFocusOut);
      document.addEventListener('pointerdown', onPointer);
      document.addEventListener('click', onClick);
      document.addEventListener('focusout', onAnyFocusOut, true);
      window.addEventListener('blur', onWinBlur);
      window.addEventListener('focus', onWinFocus);
      focusSink();
      return () => {
        window.removeEventListener('keydown', down);
        window.removeEventListener('keyup', up);
        document.removeEventListener('pointerdown', onPointer);
        document.removeEventListener('click', onClick);
        document.removeEventListener('focusout', onAnyFocusOut, true);
        window.removeEventListener('blur', onWinBlur);
        window.removeEventListener('focus', onWinFocus);
        resolver.cancel();
        sink.remove();
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
    let ghostIdx = -1;
    return {
      el,
      // Touche morte en attente (^ ou ¨) : affichée en grisé au-dessus du caractère attendu, sans rien compter
      ghost(idx, ch) {
        if (ghostIdx >= 0 && spans[ghostIdx]) spans[ghostIdx].removeAttribute('data-ghost');
        ghostIdx = -1;
        if (idx >= 0 && ch && spans[idx]) {
          spans[idx].setAttribute('data-ghost', ch);
          ghostIdx = idx;
        }
      },
      chars,
      length: chars.length,
      set(idx, state) {
        const s = spans[idx];
        if (!s) return;
        s.classList.remove('ok', 'bad', 'demo');
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
  // Texte d'aide pour un caractère. `pending` : la touche morte (^ ou ¨) qui attend sa voyelle, s'il y en a une.
  DD.hintHTML = function (ch, layout, pending) {
    const h = layout.hint(ch);
    if (!h) return '';
    const shown = ch === ' ' ? 'espace' : ch;
    let s = '<span class="hint-char">' + DD.esc(shown) + '</span> ';
    const mainName = h.finger === 'TH' ? 'pouce' : F[h.finger].name;
    if (h.dead) {
      // Touche morte : deux étapes. Rien ne s'affiche à la première, c'est normal.
      const second = h.vowel === ' ' ? "la barre d'espace" : (h.upper ? 'Maj + ' : '') + keyLabel(h.main) + ' <em>(' + mainName + ')</em>';
      const first = h.deadChar === '¨' ? 'Maj gauche <em>(auriculaire gauche)</em> + la touche ^ <em>(auriculaire droit)</em>' : 'la touche ^ <em>(auriculaire droit)</em>';
      if (pending && pending === h.deadChar) {
        s += '<span class="hint-step">étape 2/2</span><span class="hint-text">Maintenant : ' + second + '.</span>';
      } else {
        s += '<span class="hint-step">étape 1/2</span><span class="hint-text">Appuie sur ' + first + ' : rien ne s\'affiche, c\'est normal. Puis sur ' + second + '.</span>';
      }
      return s;
    }
    if (h.shift) {
      const sh = h.keys[0];
      const shFinger = sh === 'ShiftL' ? F.LP : F.RP;
      s += '<span class="hint-text">' + keyLabel(sh) + ' <em>(' + shFinger.name + ')</em> + ' + DD.esc(ch) + ' <em>(' + mainName + ')</em></span>';
    } else if (h.altgr) {
      s += '<span class="hint-text">Alt Gr <em>(pouce droit)</em> + ' + keyLabel(h.main) + ' <em>(' + mainName + ')</em></span>';
    } else {
      s += '<span class="hint-text">' + keyLabel(h.main) + ' <em>(' + mainName + ')</em></span>';
    }
    return s;
  };

})();
