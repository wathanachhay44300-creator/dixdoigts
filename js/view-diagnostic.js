/*
 * Page de diagnostic du clavier (#/diagnostic).
 * Elle montre, en direct, ce que le navigateur envoie quand on tape ^ puis une voyelle, et ce que DixDoigts en comprend.
 * Elle ne change rien : le résolveur tourne en mode « observe » (jamais de preventDefault).
 */
(function () {
  const DD = window.DD;
  const V = (DD.views = DD.views || {});

  const MAX_LINES = 400;
  const pad = (n, w) => String(n).padStart(w || 2, '0');
  const stamp = (d) => pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()) + '.' + pad(d.getMilliseconds(), 3);
  const show = (v) => (v === undefined || v === null ? '∅' : v === '' ? '""' : v === ' ' ? '" "' : JSON.stringify(String(v)));
  const point = (s) => (s ? Array.from(String(s)).map((c) => 'U+' + c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')).join(' ') : '');

  V.diagnostic = function (root) {
    root.innerHTML =
      '<section class="page"><h1>Diagnostic du clavier</h1>' +
      '<p class="lead">Cette page sert à comprendre pourquoi â, ê, î, ô, û, ë ou ï ne s\'écrivent pas. Elle montre ce que ton navigateur reçoit, touche après touche.</p>' +
      '<div class="diag-grid">' +
      '<div>' +
      '<div class="card"><h3>1. Essaie ici</h3>' +
      '<ol class="small"><li>Clique dans le champ ci-dessous.</li><li>Appuie sur la touche <b>^</b> (à droite de P). <b>Rien ne s\'affiche : c\'est normal.</b></li><li>Appuie sur <b>e</b>. Tu dois voir <b>ê</b>.</li><li>Essaie aussi <b>Maj + ^</b> (tréma ¨) puis <b>e</b> : tu dois voir <b>ë</b>.</li></ol>' +
      '<input id="dg-in" class="diag-input" type="text" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" placeholder="Tape ici : ^ puis e">' +
      '</div>' +
      '<div class="card"><h3>2. Ce que DixDoigts comprend</h3>' +
      '<div class="diag-seen"><span class="diag-big" id="dg-now">·</span><div><div id="dg-state" class="muted">Aucune touche morte en attente.</div><div id="dg-last" class="small"></div></div></div>' +
      '<div id="dg-verdict" class="notice" hidden></div>' +
      '</div>' +
      '<div class="card"><h3>3. Ton navigateur</h3><div id="dg-env" class="small mono"></div></div>' +
      '</div>' +
      '<div class="card"><div class="card-head"><h3>Journal des événements</h3><div class="actions"><button class="btn ghost small" id="dg-clear" type="button">Effacer</button><button class="btn ghost small" id="dg-copy" type="button">Copier</button></div></div>' +
      '<div class="diag-log" id="dg-log" role="log" aria-live="off"></div>' +
      '<p class="muted small">Pour demander de l\'aide : appuie sur ^ puis e, clique sur « Copier » et colle le journal dans ton message.</p></div>' +
      '</div>' +
      '<p><a href="#/reglages">← Retour aux réglages</a></p></section>';

    const $ = (id) => root.querySelector('#' + id);
    const input = $('dg-in');
    const log = $('dg-log');
    const lines = [];
    let counts = { dead: 0, ok: 0, bad: 0 };

    function push(kind, text) {
      lines.push(stamp(new Date()) + '  ' + text);
      const div = document.createElement('div');
      div.className = kind;
      div.textContent = stamp(new Date()) + '  ' + text;
      log.appendChild(div);
      while (log.childNodes.length > MAX_LINES) log.removeChild(log.firstChild);
      if (lines.length > MAX_LINES) lines.shift();
      log.scrollTop = log.scrollHeight;
    }

    // ---- ce que DixDoigts comprend (mode observation : on ne change rien) ----
    const resolver = DD.DeadKeys.create({
      observe: true,
      onPending(ch, meta) {
        const now = $('dg-now');
        if (ch) {
          counts.dead++;
          now.textContent = ch;
          now.classList.add('pending');
          $('dg-state').textContent = 'Touche morte « ' + ch + ' » en attente : rien ne s\'affiche, c\'est normal. Appuie maintenant sur une voyelle.';
        } else {
          now.classList.remove('pending');
          if (meta && meta.cancelled) {
            now.textContent = '·';
            $('dg-state').textContent = 'Touche morte annulée.';
          } else $('dg-state').textContent = 'Aucune touche morte en attente.';
        }
      },
      onChar(str, info) {
        const now = $('dg-now');
        now.textContent = str;
        const ok = !info.invalid;
        counts[ok ? 'ok' : 'bad']++;
        $('dg-last').innerHTML = (ok ? '✅ ' : '⚠️ ') + 'Résultat : <b>' + DD.esc(str) + '</b> <span class="muted">(' + point(str) + ')</span> · obtenu par : <b>' + DD.esc(info.source) + '</b>' + (info.invalid ? ' · combinaison impossible : une seule erreur dans un exercice' : '');
        verdict();
      },
    });

    function verdict() {
      const box = $('dg-verdict');
      box.hidden = false;
      if (counts.ok) {
        box.className = 'notice ok';
        box.textContent = 'Les touches mortes fonctionnent sur ton clavier : DixDoigts reconnaît ' + counts.ok + ' caractère' + (counts.ok > 1 ? 's' : '') + ' accentué' + (counts.ok > 1 ? 's' : '') + '.';
      } else if (counts.bad) {
        box.className = 'notice warn';
        box.textContent = 'La touche morte est reconnue, mais la combinaison tapée n\'existe pas (essaie ^ puis e).';
      }
    }

    const sum = (ev) => {
      const parts = [];
      if ('key' in ev) parts.push('key=' + show(ev.key));
      if ('code' in ev) parts.push('code=' + show(ev.code));
      if ('data' in ev) parts.push('data=' + show(ev.data));
      if ('inputType' in ev && ev.inputType) parts.push('inputType=' + ev.inputType);
      if ('isComposing' in ev) parts.push('isComposing=' + ev.isComposing);
      if ('shiftKey' in ev) parts.push('Maj=' + ev.shiftKey);
      if (ev.keyCode === 229) parts.push('keyCode=229');
      if (ev.repeat) parts.push('repeat');
      return parts.join('  ');
    };
    const row = (kind, ev) => push(kind === 'keydown' || kind === 'keyup' ? 'k' : kind.startsWith('composition') ? 'c' : 'i', kind.padEnd(17) + sum(ev));

    const handlers = {
      keydown: (ev) => (row('keydown', ev), resolver.keydown(ev)),
      keyup: (ev) => row('keyup', ev),
      beforeinput: (ev) => (row('beforeinput', ev), resolver.beforeinput(ev)),
      input: (ev) => (row('input', ev), resolver.input(ev)),
      compositionstart: (ev) => (row('compositionstart', ev), resolver.compositionstart(ev)),
      compositionupdate: (ev) => (row('compositionupdate', ev), resolver.compositionupdate(ev)),
      compositionend: (ev) => (row('compositionend', ev), resolver.compositionend(ev)),
    };
    Object.keys(handlers).forEach((k) => input.addEventListener(k, handlers[k]));
    input.addEventListener('blur', () => resolver.cancel());

    // ---- environnement ----
    const env = [
      'Navigateur : ' + navigator.userAgent,
      'Langue : ' + (navigator.language || '?'),
      'Système : ' + (navigator.platform || '?'),
    ];
    $('dg-env').innerHTML = env.map((l) => '<div>' + DD.esc(l) + '</div>').join('') + '<div id="dg-map"></div>';
    if (navigator.keyboard && navigator.keyboard.getLayoutMap) {
      navigator.keyboard
        .getLayoutMap()
        .then((m) => {
          const el = $('dg-map');
          if (!el) return;
          const q = m.get('KeyQ'), br = m.get('BracketLeft');
          el.textContent = 'Disposition détectée : touche Q = « ' + q + ' »' + (q === 'a' ? ' (AZERTY ✓)' : q === 'q' ? ' (QWERTY : change la disposition dans les réglages)' : '') + ' · touche à droite de P = « ' + br + ' »';
        })
        .catch(() => {});
    } else $('dg-map').textContent = 'Disposition : ce navigateur ne la communique pas (c\'est normal sur Firefox et Safari).';

    $('dg-clear').onclick = () => {
      lines.length = 0;
      log.textContent = '';
      input.value = '';
      counts = { dead: 0, ok: 0, bad: 0 };
      $('dg-last').textContent = '';
      $('dg-verdict').hidden = true;
      input.focus();
    };
    $('dg-copy').onclick = () => {
      const txt = ['DixDoigts — diagnostic clavier', env.join('\n'), '', lines.join('\n')].join('\n');
      const done = () => DD.toast('Journal copié ✓');
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, () => DD.toast('Copie impossible : sélectionne le journal à la main.'));
      else DD.toast('Copie impossible : sélectionne le journal à la main.');
    };
    setTimeout(() => input.isConnected && input.focus(), 50);

    return () => {
      resolver.cancel();
    };
  };
})();
