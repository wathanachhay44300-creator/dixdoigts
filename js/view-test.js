/* Test chronométré : MPM, précision, courbe de la séance, touches ratées. */
(function () {
  const DD = window.DD;
  const V = (DD.views = DD.views || {});
  const S = () => DD.Store;

  const mmss = (s) => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
  const r1 = (x) => Math.round(x * 10) / 10;

  V.test = function (root) {
    const st = S().state.settings;
    const layout = DD.Layout.current();
    let duration = st.testDuration;
    let fingers = st.testFingers;
    let phase = 'ready'; // ready | running | done
    let timer = null;
    let tv, expected, states, idx, okCount, keys, correctKeys, misses, testChars, t0, series, errs, errSec, lastSec, sawKb;

    root.innerHTML =
      '<section class="page"><h1>Test chronométré</h1>' +
      '<div class="test-opts">' +
      '<div><span class="opt-label">Durée</span><div class="seg" id="t-dur">' + [1, 2, 3, 5].map((d) => '<button class="seg-b" data-v="' + d + '">' + d + ' min</button>').join('') + '</div></div>' +
      '<div><span class="opt-label">Je tape avec</span><div class="seg" id="t-fing"><button class="seg-b" data-v="10">10 doigts</button><button class="seg-b" data-v="2">2 doigts</button></div></div>' +
      '</div>' +
      '<p class="muted small" id="t-note"></p>' +
      '<div class="hud"><div><b id="h-time">0:00</b><span>temps</span></div><div><b id="h-wpm">0</b><span>MPM</span></div><div><b id="h-acc">100 %</b><span>précision</span></div></div>' +
      '<div id="t-text" class="tt-wrap"></div>' +
      '<p class="muted" id="t-help">Le chrono démarre à ta première frappe. Échap : recommencer avec un nouveau texte. Retour arrière pour corriger.</p>' +
      '<div class="kbd-bar"><button class="btn small ghost" id="t-kbtoggle"></button><button class="btn small ghost" id="t-handtoggle"></button></div><div id="t-kb"></div>' +
      '<div id="t-result" hidden></div></section>';
    const $ = (id) => root.querySelector('#' + id);
    const kb = DD.Keyboard.create(layout, 'fingers', { hands: true }); // les mains suivent chaque frappe
    $('t-kb').appendChild(kb.el);

    const handsOn = () => S().state.settings.showHands !== false;
    function refreshKb() {
      const on = S().state.settings.showKeyboard;
      $('t-kb').hidden = !on; // clavier masqué : les mains aussi
      $('t-kbtoggle').textContent = on ? 'Masquer le clavier' : 'Afficher le clavier';
      $('t-handtoggle').hidden = !on;
      $('t-handtoggle').textContent = handsOn() ? 'Masquer les mains' : 'Afficher les mains';
    }
    $('t-handtoggle').onclick = () => {
      S().state.settings.showHands = !handsOn();
      S().save();
      kb.setHandsVisible(handsOn());
      refreshKb();
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    };
    $('t-kbtoggle').onclick = () => {
      S().state.settings.showKeyboard = !S().state.settings.showKeyboard;
      S().save();
      refreshKb();
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    };

    function refreshOpts() {
      root.querySelectorAll('#t-dur .seg-b').forEach((b) => b.classList.toggle('on', +b.dataset.v === duration));
      root.querySelectorAll('#t-fing .seg-b').forEach((b) => b.classList.toggle('on', +b.dataset.v === fingers));
      $('t-note').textContent =
        fingers === 10
          ? 'Test à dix doigts : il alimente ta courbe de progression, face à ton niveau à deux doigts (' + st.baselineWpm + ' MPM).'
          : 'Test à deux doigts : enregistré à part, il ne fausse pas ta courbe à dix doigts.';
    }
    $('t-dur').onclick = (e) => {
      const b = e.target.closest('.seg-b');
      if (!b) return;
      duration = +b.dataset.v;
      st.testDuration = duration;
      S().save();
      b.blur();
      build();
    };
    $('t-fing').onclick = (e) => {
      const b = e.target.closest('.seg-b');
      if (!b) return;
      fingers = +b.dataset.v;
      st.testFingers = fingers;
      S().save();
      b.blur();
      build();
    };

    function hud() {
      const el = phase === 'running' ? (performance.now() - t0) / 1000 : 0;
      $('h-time').textContent = mmss(Math.max(0, duration * 60 - el));
      $('h-wpm').textContent = el > 2 ? Math.round(okCount / 5 / (el / 60)) : '0';
      $('h-acc').textContent = keys ? DD.fmt.pct((correctKeys / keys) * 100) : '100 %';
    }

    function build() {
      clearInterval(timer);
      phase = 'ready';
      const text = DD.Text.fill(DD.Text.WORDS, Math.round(duration * 1400));
      tv = DD.TextView(text, { test: true });
      expected = tv.chars;
      states = new Array(expected.length).fill('');
      idx = 0;
      okCount = 0;
      keys = 0;
      correctKeys = 0;
      misses = {};
      testChars = {};
      series = [];
      errs = [];
      errSec = 0;
      lastSec = 0;
      sawKb = false;
      $('t-text').innerHTML = '';
      $('t-text').appendChild(tv.el);
      tv.caret(0);
      $('t-result').hidden = true;
      $('t-result').innerHTML = '';
      $('t-help').hidden = false;
      root.querySelector('.hud').hidden = false;
      refreshOpts();
      refreshKb();
      hud();
    }

    function start() {
      phase = 'running';
      t0 = performance.now();
      $('t-help').hidden = true;
      timer = setInterval(tick, 100);
    }

    function wpmAt(sec) {
      return sec > 0 ? okCount / 5 / (sec / 60) : 0;
    }

    function tick() {
      const el = (performance.now() - t0) / 1000;
      const sec = Math.floor(el);
      while (lastSec < sec && lastSec < duration * 60) {
        lastSec++;
        series.push(Math.round(wpmAt(lastSec)));
        errs.push(errSec);
        errSec = 0;
      }
      hud();
      if (el >= duration * 60) finish();
    }

    function finish() {
      clearInterval(timer);
      phase = 'done';
      const dur = duration * 60;
      // dernier point de la courbe
      while (series.length < dur && lastSec < dur) {
        lastSec++;
        series.push(Math.round(wpmAt(lastSec)));
        errs.push(errSec);
        errSec = 0;
      }
      const wpm = okCount / 5 / (dur / 60);
      const raw = keys / 5 / (dur / 60);
      const acc = keys ? (correctKeys / keys) * 100 : 0;
      const prevBest = S().bestWpm(fingers);
      const rec = { t: Date.now(), dur, fingers, wpm: r1(wpm), raw: r1(raw), acc: r1(acc), ok: correctKeys, bad: keys - correctKeys, series, errs, misses };
      S().addTest(rec);
      S().activityDone();
      const valid = acc >= 90;
      // Clavier masqué pendant tout le test + 95 % de précision
      if (valid && !sawKb && acc >= 95) S().state.flags.blind = true;
      S().save();
      showResult(rec, prevBest, valid);
      DD.Badges.check();
      if (valid) DD.Audio.success();
      else DD.Audio.fail();
    }

    function showResult(rec, prevBest, valid) {
      const base = st.baselineWpm;
      let verdict = '';
      if (!valid) verdict = 'Précision sous 90 % : ce test est enregistré mais ne compte pas pour tes records. Ralentis un peu pour rester précis.';
      else if (rec.fingers === 10) {
        if (rec.wpm > prevBest && prevBest > 0) verdict = '🏅 Nouveau record à dix doigts !';
        else if (!prevBest) verdict = '🏁 Premier résultat à dix doigts : ta courbe commence ici.';
        if (rec.wpm > base) verdict += ' Tu dépasses ton niveau à deux doigts (' + base + ' MPM) !';
        else verdict += ' Il te manque ' + Math.ceil(base - rec.wpm) + ' MPM pour rattraper ton niveau à deux doigts (' + base + ' MPM).';
      } else verdict = 'Résultat à deux doigts, enregistré à part.';
      const top = Object.entries(rec.misses)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6);
      const box = $('t-result');
      box.innerHTML =
        '<div class="card result ' + (valid ? 'pass' : 'fail') + '"><div class="result-head"><h2>Résultat · ' + rec.dur / 60 + ' min · ' + rec.fingers + ' doigts</h2></div>' +
        '<div class="big-stats"><div><b>' + Math.round(rec.wpm) + '</b><span>MPM</span></div><div><b>' + DD.fmt.pct(rec.acc) + '</b><span>précision</span></div><div><b>' + Math.round(rec.raw) + '</b><span>MPM brut</span></div><div><b>' + rec.ok + ' / ' + rec.bad + '</b><span>justes / fautes</span></div></div>' +
        '<p class="verdict">' + verdict + '</p>' +
        '<h3>Vitesse seconde par seconde</h3>' +
        DD.Charts.line({ pts: rec.series.map((y, i) => ({ y, title: i + 1 + ' s : ' + y + ' MPM' })), errs: rec.errs, area: true, height: 220, xLabels: (i) => i + 1 + ' s', aria: 'Vitesse pendant le test' }) +
        '<p class="muted small">Les barres rouges indiquent les secondes où tu as fait des fautes.</p>' +
        '<h3>Touches ratées pendant ce test</h3>' +
        (top.length ? '<div class="heat-wrap" id="t-heat"></div><p>' + top.map(([c, n]) => '<kbd>' + DD.esc(c === ' ' ? 'espace' : c) + '</kbd> ×' + n).join(' ') + '</p>' : '<p>Aucune faute 🎉</p>') +
        '<div class="actions"><button class="btn primary" id="t-again">Recommencer</button>' +
        (top.length ? '<a class="btn ghost" href="#/points-faibles/' + encodeURIComponent(top.slice(0, 5).map((x) => x[0]).join('')) + '">S\'entraîner sur ces touches</a>' : '') +
        (rec.fingers === 2 && valid ? '<button class="btn ghost" id="t-base">Définir ' + Math.round(rec.wpm) + ' MPM comme mon niveau à deux doigts</button>' : '') +
        '<a class="btn ghost" href="#/stats">Mes statistiques</a></div></div>';
      box.hidden = false;
      root.querySelector('.hud').hidden = true;
      if (top.length) {
        const hk = DD.Keyboard.create(layout, 'heat');
        hk.setHeat(DD.Keyboard.heatFromChars(testChars, layout, { fullRate: 0.15 }));
        box.querySelector('#t-heat').appendChild(hk.el);
      }
      box.querySelector('#t-again').onclick = () => build();
      const bb = box.querySelector('#t-base');
      if (bb)
        bb.onclick = () => {
          S().state.settings.baselineWpm = Math.round(rec.wpm);
          st.baselineWpm = Math.round(rec.wpm);
          S().save();
          bb.disabled = true;
          bb.textContent = 'Niveau de référence mis à jour ✓';
        };
      box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function onKey({ key, type }) {
      // touche morte (^ ou ¨) en attente : ni erreur, ni avance ; le chronomètre démarre et continue
      if (type === 'dead') {
        if (phase === 'done') return;
        DD.Audio.unlock();
        if (phase === 'ready') start();
        if (S().state.settings.showKeyboard) sawKb = true;
        S().tick();
        tv.ghost(idx, key);
        return;
      }
      if (type === 'deadend') {
        tv.ghost(-1);
        return;
      }
      if (key === 'Escape') {
        build();
        return;
      }
      if (phase === 'done') {
        if (key === 'Enter') build();
        return;
      }
      if (key === 'Enter') return;
      if (key === 'Backspace') {
        if (phase !== 'running' || idx === 0) return;
        idx--;
        if (states[idx] === 'ok') okCount--;
        states[idx] = '';
        tv.set(idx, '');
        tv.caret(idx);
        tv.scroll();
        return;
      }
      if (idx >= expected.length) return;
      DD.Audio.unlock();
      if (phase === 'ready') start();
      if (S().state.settings.showKeyboard) sawKb = true;
      S().tick();
      const exp = expected[idx];
      const ok = key === exp;
      keys++;
      S().recordChar(exp, ok);
      const tc = testChars[exp] || (testChars[exp] = { n: 0, m: 0 });
      tc.n++;
      if (ok) {
        correctKeys++;
        okCount++;
        states[idx] = 'ok';
        tv.set(idx, 'ok');
        DD.Audio.click(exp === ' ');
      } else {
        tc.m++;
        misses[exp] = (misses[exp] || 0) + 1;
        errSec++;
        states[idx] = 'bad';
        tv.set(idx, 'bad');
        DD.Audio.error();
      }
      const pressed = layout.keyOf(key);
      if (pressed) kb.flash(pressed, ok ? 'ok' : 'bad');
      idx++;
      tv.caret(idx);
      tv.scroll();
      hud();
      if (idx >= expected.length) finish();
    }

    build();
    const detach = DD.Input.attach(onKey);
    return () => {
      clearInterval(timer);
      if (kb.hands) kb.hands.destroy();
      detach();
      S().save();
    };
  };
})();
