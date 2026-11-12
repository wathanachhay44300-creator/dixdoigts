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

  // ---- Exercice strict --------------------------------------------------------------------
  // La frappe ne progresse que si le caractère est juste (mode leçon).
  /**
   * cfg = {
   *   title, subtitle, back: {href,label},
   *   text,
   *   evaluate(res) -> { passed, stars, headline, notes:[], buttons:[{label, href|onclick, primary}] }   (appelé à la fin)
   *   restart()  -> nouveau texte (Échap / bouton)
   *   goal: 'texte affiché sous le titre' (optionnel)
   * }
   */
  DD.StrictRun = function (root, cfg) {
    const S = DD.Store;
    const layout = DD.Layout.current();
    const tv = DD.TextView(cfg.text);
    const chars = tv.chars;
    let idx = 0,
      errors = 0,
      total = 0,
      t0 = 0,
      done = false,
      sawKeyboard = false;
    const missed = {};
    const startedAt = Date.now();

    root.innerHTML = '';
    const page = DD.el('section', 'page run');
    page.innerHTML =
      '<a class="back" href="' + cfg.back.href + '">← ' + DD.esc(cfg.back.label) + '</a>' +
      '<h1>' + DD.esc(cfg.title) + '</h1>' +
      (cfg.subtitle ? '<p class="lead">' + DD.esc(cfg.subtitle) + '</p>' : '') +
      '<div class="run-stats"><span id="rs-prog"></span><div class="progress"><span id="rs-bar"></span></div></div>' +
      '<div id="rs-text" class="tt-wrap"></div>' +
      '<div id="rs-hint" class="hint" aria-live="polite"></div>' +
      '<div class="kbd-bar"><button class="btn small ghost" id="rs-kbtoggle"></button><span class="muted small">Échap : recommencer</span></div>' +
      '<div id="rs-kb"></div>' +
      '<div id="rs-result" hidden></div>';
    root.appendChild(page);
    const $ = (id) => page.querySelector('#' + id);
    $('rs-text').appendChild(tv.el);
    tv.caret(0);

    const kb = DD.Keyboard.create(layout, 'fingers');
    $('rs-kb').appendChild(kb.el);

    function showKb() {
      return S.state.settings.showKeyboard;
    }
    function refreshKbVisibility() {
      const on = showKb();
      $('rs-kb').hidden = !on;
      $('rs-hint').hidden = !on;
      $('rs-kbtoggle').textContent = on ? 'Masquer le clavier' : 'Afficher le clavier';
    }
    function updateHint() {
      const ch = chars[idx];
      if (ch == null) return;
      const h = layout.hint(ch);
      kb.setNext(h ? h.keys : []);
      $('rs-hint').innerHTML = DD.hintHTML(ch, layout);
    }
    function updateProgress() {
      $('rs-prog').textContent = idx + ' / ' + chars.length;
      $('rs-bar').style.width = (idx / chars.length) * 100 + '%';
    }
    $('rs-kbtoggle').onclick = () => {
      S.state.settings.showKeyboard = !S.state.settings.showKeyboard;
      S.save();
      refreshKbVisibility();
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    };
    refreshKbVisibility();
    updateHint();
    updateProgress();

    function finish() {
      done = true;
      const dur = Math.max(1, (performance.now() - t0) / 1000);
      const wpm = chars.length / 5 / (dur / 60);
      const acc = (chars.length / total) * 100;
      const res = { wpm, acc, errors, total, dur, len: chars.length, missed, blind: !sawKeyboard };
      S.activityDone();
      kb.setNext([]);
      $('rs-hint').innerHTML = '';
      tv.caret(-1);
      const out = cfg.evaluate(res);
      if (out.passed) DD.Audio.success();
      else DD.Audio.fail();
      // Clavier masqué pendant tout l'exercice + 95 % de précision
      if (out.passed && res.blind && acc >= 95) S.state.flags.blind = true;
      S.save();
      showResult(res, out);
      DD.Badges.check();
    }

    function showResult(res, out) {
      const box = $('rs-result');
      const top = Object.entries(res.missed)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
      let h = '<div class="card result ' + (out.passed ? 'pass' : 'fail') + '">';
      h += '<div class="result-head"><div class="stars">' + (out.passed && out.stars ? '★'.repeat(out.stars) + '<span class="off">' + '★'.repeat(3 - out.stars) + '</span>' : '') + '</div>';
      h += '<h2>' + DD.esc(out.headline) + '</h2></div>';
      h += '<div class="big-stats">';
      h += '<div><b>' + Math.round(res.wpm) + '</b><span>MPM</span></div>';
      h += '<div><b>' + DD.fmt.pct(res.acc) + '</b><span>précision</span></div>';
      h += '<div><b>' + res.errors + '</b><span>erreur' + (res.errors > 1 ? 's' : '') + '</span></div>';
      h += '<div><b>' + DD.fmt.duration(res.dur) + '</b><span>durée</span></div>';
      h += '</div>';
      if (out.notes && out.notes.length) h += '<ul class="notes">' + out.notes.map((n) => '<li>' + n + '</li>').join('') + '</ul>';
      if (top.length) h += '<p class="muted">Touches à surveiller : ' + top.map(([c, n]) => '<kbd>' + DD.esc(c === ' ' ? 'espace' : c) + '</kbd> ×' + n).join(' ') + '</p>';
      h += '<div class="actions">';
      (out.buttons || []).forEach((b, i) => {
        const cls = 'btn' + (b.primary ? ' primary' : ' ghost');
        h += b.href ? '<a class="' + cls + '" href="' + b.href + '">' + DD.esc(b.label) + '</a>' : '<button class="' + cls + '" data-b="' + i + '">' + DD.esc(b.label) + '</button>';
      });
      h += '</div></div>';
      box.innerHTML = h;
      box.hidden = false;
      box.querySelectorAll('button[data-b]').forEach((btn) => {
        btn.onclick = () => out.buttons[+btn.dataset.b].onclick();
      });
      box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function onKey({ key }) {
      if (key === 'Escape') {
        cfg.restart();
        return;
      }
      if (done) {
        if (key === 'Enter' && cfg.onEnter) cfg.onEnter();
        return;
      }
      if (key === 'Backspace' || key === 'Enter') return;
      DD.Audio.unlock();
      if (!t0) t0 = performance.now();
      S.tick();
      if (showKb()) sawKeyboard = true;
      const exp = chars[idx];
      const ok = key === exp;
      S.recordChar(exp, ok);
      total++;
      const pressed = layout.keyOf(key);
      if (ok) {
        tv.set(idx, 'ok');
        idx++;
        DD.Audio.click(exp === ' ');
        if (pressed) kb.flash(pressed, 'ok');
        updateProgress();
        if (idx >= chars.length) {
          finish();
          return;
        }
        tv.caret(idx);
        updateHint();
      } else {
        errors++;
        missed[exp] = (missed[exp] || 0) + 1;
        DD.Audio.error();
        tv.caret(idx, true);
        if (pressed) kb.flash(pressed, 'bad');
      }
    }

    const detach = DD.Input.attach(onKey);
    return {
      destroy() {
        detach();
        S.save();
      },
      started: () => !!t0,
    };
  };
})();
