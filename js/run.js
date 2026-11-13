/*
 * Exercice "strict" : la frappe n'avance que si le caractère est juste.
 * Sert aux leçons, aux étapes de leçon, aux fins de module, à l'atelier et aux points faibles.
 *
 * cfg = {
 *   title, subtitle, back: {href, label},
 *   extraTop:  HTML ou élément affiché sous le titre (bandeau d'étapes, choix de la longueur...),
 *   text,
 *   timeLimit: secondes (0 ou absent = pas de limite : l'exercice finit quand le texte est tapé),
 *   repsLabel: mot devant « X / N » (défaut « répétitions »),
 *   evaluate(res) -> { passed, stars, headline, notes:[], buttons:[{label, href | onclick, primary}] },
 *   restart(), onEnter()
 * }
 */
(function () {
  const DD = window.DD;

  const mmss = (s) => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');

  DD.StrictRun = function (root, cfg) {
    const S = DD.Store;
    const layout = DD.Layout.current();
    const timed = cfg.timeLimit > 0;
    const tv = DD.TextView(cfg.text, { test: timed }); // chronométré : fenêtre de 3 lignes qui défile
    const chars = tv.chars;
    const reps = cfg.repsLabel || 'répétitions';
    let idx = 0,
      errors = 0,
      total = 0,
      t0 = 0,
      done = false,
      sawKeyboard = false,
      timer = null;
    const missed = {};

    root.innerHTML = '';
    const page = DD.el('section', 'page run');
    page.innerHTML =
      '<a class="back" href="' + cfg.back.href + '">← ' + DD.esc(cfg.back.label) + '</a>' +
      '<h1>' + DD.esc(cfg.title) + '</h1>' +
      (cfg.subtitle ? '<p class="lead">' + DD.esc(cfg.subtitle) + '</p>' : '') +
      '<div id="rs-extra"></div>' +
      '<div class="run-stats"><span id="rs-prog"></span><div class="progress"><span id="rs-bar"></span></div></div>' +
      '<div id="rs-text" class="tt-wrap"></div>' +
      '<div id="rs-hint" class="hint" aria-live="polite"></div>' +
      '<div class="kbd-bar"><button class="btn small ghost" id="rs-kbtoggle"></button><span class="muted small">Échap : recommencer avec un nouveau contenu</span></div>' +
      '<div id="rs-kb"></div>' +
      '<div id="rs-result" hidden></div>';
    root.appendChild(page);
    const $ = (id) => page.querySelector('#' + id);
    if (cfg.extraTop) {
      if (typeof cfg.extraTop === 'string') $('rs-extra').innerHTML = cfg.extraTop;
      else $('rs-extra').appendChild(cfg.extraTop);
    }
    $('rs-text').appendChild(tv.el);
    tv.caret(0);

    const kb = DD.Keyboard.create(layout, 'fingers');
    $('rs-kb').appendChild(kb.el);

    const showKb = () => S.state.settings.showKeyboard;
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
      if (timed) {
        const left = t0 ? Math.max(0, cfg.timeLimit - (performance.now() - t0) / 1000) : cfg.timeLimit;
        $('rs-prog').textContent = mmss(left) + ' · ' + reps + ' ' + idx;
        $('rs-bar').style.width = ((cfg.timeLimit - left) / cfg.timeLimit) * 100 + '%';
      } else {
        $('rs-prog').textContent = reps + ' ' + idx + ' / ' + chars.length;
        $('rs-bar').style.width = (idx / chars.length) * 100 + '%';
      }
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

    function finish(timeUp) {
      done = true;
      clearInterval(timer);
      const dur = timeUp ? cfg.timeLimit : Math.max(1, (performance.now() - t0) / 1000);
      const wpm = idx / 5 / (dur / 60);
      const acc = total ? (idx / total) * 100 : 0;
      const res = { wpm, acc, errors, total, dur, len: idx, missed, blind: !sawKeyboard, timeUp: !!timeUp };
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
      h += '<div><b>' + res.len + '</b><span>caractères</span></div>';
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

    function tickTimer() {
      updateProgress();
      if (!done && t0 && (performance.now() - t0) / 1000 >= cfg.timeLimit) finish(true);
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
      if (!t0) {
        t0 = performance.now();
        if (timed) timer = setInterval(tickTimer, 200);
      }
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
          finish(false);
          return;
        }
        tv.caret(idx);
        tv.scroll();
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
        clearInterval(timer);
        detach();
        S.save();
      },
      started: () => !!t0,
    };
  };
})();
