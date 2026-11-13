/* Atelier de répétitions : l'utilisateur choisit ses touches, le type d'exercice et la durée. */
(function () {
  const DD = window.DD;
  const V = (DD.views = DD.views || {});
  const S = () => DD.Store;
  const C = DD.Curriculum;
  const T = DD.Text;
  const G = DD.Gen;

  const TYPE_LABELS = {
    repeat: 'Répétition pure',
    alternate: 'Alternances',
    pseudo: 'Pseudo-mots',
    words: 'Mots réels',
    mix: 'Mélange',
  };
  const TYPE_HELP = {
    repeat: 'vvv bbb vbv bvb : une touche ou une paire, au même rythme.',
    alternate: 'vn nv vnb : on change de main, puis de doigt.',
    pseudo: 'vanb cxnv : des suites sans sens.',
    words: 'Des vrais mots écrits avec tes touches.',
    mix: 'Un peu de tout, dans le désordre.',
  };
  const FINGER_ORDER = ['LP', 'LR', 'LM', 'LI', 'RI', 'RM', 'RR', 'RP'];
  const uniq = (s) => Array.from(new Set(Array.from(String(s).normalize('NFC')).filter((c) => c !== ' ')));
  const fingerOf = (c) => {
    const h = DD.Layout.current().hint(c);
    return h ? h.finger : null;
  };

  // Touches (caractères sans Maj) d'un doigt ou d'une main : lettres, accents directs, , ; :
  function charsOfFingers(set) {
    const layout = DD.Layout.current();
    return layout.rows
      .flat()
      .filter((k) => !k.spacer && !k.special && !k.dead && set.has(k.f) && /^[a-zéèàçù,;:]$/.test(k.b))
      .map((k) => k.b)
      .join('');
  }

  // ---- Page de réglage ------------------------------------------------------------------------------------------------------
  V.workshop = function (root) {
    const layout = DD.Layout.current();
    const w = Object.assign({}, S().state.settings.workshop);
    let chars = uniq(w.chars); // caractères choisis (liste)
    const PRESETS = [
      ['Rangée de base', () => C.HOME],
      ['Rangée du haut', () => C.TOP],
      ['Rangée du bas', () => C.BOT],
      ['Chiffres', () => C.DIGITS],
      ['Accents', () => C.ACCENTS],
      ['Ponctuation', () => C.PUNCT],
      ['Main gauche seule', () => charsOfFingers(new Set(['LP', 'LR', 'LM', 'LI']))],
      ['Main droite seule', () => charsOfFingers(new Set(['RI', 'RM', 'RR', 'RP']))],
    ];

    root.innerHTML =
      '<section class="page"><h1>Atelier de répétitions</h1>' +
      '<p class="lead">Choisis toi-même ce que tu veux travailler, sans passer par le parcours. Les exercices comptent dans ton objectif du jour et ta série, mais pas comme tests chronométrés.</p>' +
      '<div class="card"><h3>1. Les touches</h3><div class="presets" id="w-presets">' +
      PRESETS.map((p, i) => '<button class="btn small ghost" data-p="' + i + '">' + p[0] + '</button>').join('') +
      '<select id="w-finger" aria-label="Un doigt précis"><option value="">Un doigt précis…</option>' +
      FINGER_ORDER.map((f) => '<option value="' + f + '">' + DD.Layout.FINGERS[f].name + '</option>').join('') + '</select>' +
      '<button class="btn small ghost" data-p="clear">Tout effacer</button></div>' +
      '<div id="w-kb"></div>' +
      '<p class="muted small">Clique sur une touche pour la choisir ou l\'enlever. <b>Maj + clic</b> : le caractère obtenu avec Maj (chiffre, majuscule, symbole).</p>' +
      '<div class="chips" id="w-chips" aria-live="polite"></div></div>' +
      '<div class="card"><h3>2. Le type d\'exercice</h3><div class="types" id="w-types"></div></div>' +
      '<div class="card"><h3>3. La durée</h3>' +
      '<label class="check"><input type="radio" name="w-mode" value="minutes"> Chronométré : <select id="w-min">' + [1, 2, 3, 5, 10].map((m) => '<option value="' + m + '">' + m + ' min</option>').join('') + '</select></label>' +
      '<label class="check"><input type="radio" name="w-mode" value="chars"> Nombre de caractères : <input id="w-count" type="number" min="20" max="2000" step="10"> ' +
      '<span class="seg" id="w-quick">' + Object.keys(C.SERIES_LEN).map((k) => '<button class="seg-b" data-v="' + C.SERIES_LEN[k] + '">' + C.SERIES_LEN[k] + '</button>').join('') + '</span></label></div>' +
      '<div class="card"><h3>4. Option</h3><label class="check"><input id="w-weak" type="checkbox"> Insister sur mes touches les plus ratées</label><p class="muted small" id="w-weakinfo"></p></div>' +
      '<div class="actions"><button class="btn primary" id="w-go">Commencer l\'exercice</button><button class="btn ghost" id="w-sample-btn">Voir un exemple</button></div>' +
      '<pre class="sample" id="w-sample" hidden></pre></section>';
    const $ = (id) => root.querySelector('#' + id);

    // Clavier cliquable
    const kb = DD.Keyboard.create(layout, 'fingers');
    kb.el.classList.add('pick');
    $('w-kb').appendChild(kb.el);
    Object.entries(kb.byId).forEach(([id, el]) => {
      const k = layout.keys[id];
      if (!k || k.special || k.dead) return;
      el.setAttribute('role', 'button');
      el.tabIndex = 0;
      const act = (shift) => {
        const ch = shift ? k.s : k.b;
        if (!ch) return;
        const at = chars.indexOf(ch);
        if (at >= 0) chars.splice(at, 1);
        else chars.push(ch);
        refresh();
      };
      el.onclick = (e) => act(e.shiftKey);
      el.onkeydown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          act(e.shiftKey);
        }
      };
    });

    function wordCount() {
      return G.availableWords(chars.join(''), T.WORDS);
    }

    function refresh() {
      // clavier
      Object.entries(kb.byId).forEach(([id, el]) => {
        const k = layout.keys[id];
        el.classList.toggle('sel', !!k && !k.special && (chars.includes(k.b) || (k.s && chars.includes(k.s))));
      });
      // pastilles
      $('w-chips').innerHTML = chars.length
        ? chars.map((c, i) => '<button class="chip-c" data-i="' + i + '" title="Enlever">' + DD.esc(c) + ' ×</button>').join('')
        : '<span class="muted">Aucune touche choisie pour l\'instant.</span>';
      // types
      const nWords = chars.length ? wordCount() : 0;
      const wordsOk = nWords >= G.MIN_WORDS;
      if (w.type === 'words' && !wordsOk) w.type = 'mix';
      $('w-types').innerHTML = Object.keys(TYPE_LABELS)
        .map((t) => {
          const off = t === 'words' && !wordsOk;
          const help = t === 'words' ? (wordsOk ? nWords + ' mots disponibles' : nWords + ' mot' + (nWords > 1 ? 's' : '') + ' avec ces touches : il en faut ' + G.MIN_WORDS) : TYPE_HELP[t];
          return '<label class="type' + (off ? ' off' : '') + '"><input type="radio" name="w-type" value="' + t + '"' + (w.type === t ? ' checked' : '') + (off ? ' disabled' : '') + '><span><b>' + TYPE_LABELS[t] + '</b><small>' + DD.esc(help) + '</small></span></label>';
        })
        .join('');
      $('w-types').querySelectorAll('input').forEach((r) => (r.onchange = () => (w.type = r.value)));
      // touches ratées
      const weights = G.weightsFromStats(chars.join(''), S().state.chars);
      const hot = Object.keys(weights).sort((a, b) => weights[b] - weights[a]);
      $('w-weakinfo').textContent = hot.length
        ? 'Parmi tes touches choisies, les plus ratées seront plus fréquentes : ' + hot.slice(0, 6).join(' ') + '.'
        : 'Pas encore assez de frappes ratées sur ces touches : l\'option ne changera rien pour l\'instant.';
      $('w-go').disabled = !chars.length;
    }

    // Préréglages
    $('w-presets').onclick = (e) => {
      const b = e.target.closest('button[data-p]');
      if (!b) return;
      chars = b.dataset.p === 'clear' ? [] : uniq(PRESETS[+b.dataset.p][1]());
      $('w-finger').value = '';
      refresh();
    };
    $('w-finger').onchange = (e) => {
      if (!e.target.value) return;
      chars = uniq(charsOfFingers(new Set([e.target.value])));
      refresh();
    };
    $('w-chips').onclick = (e) => {
      const b = e.target.closest('.chip-c');
      if (!b) return;
      chars.splice(+b.dataset.i, 1);
      refresh();
    };

    // Durée
    const modeRadios = root.querySelectorAll('input[name="w-mode"]');
    modeRadios.forEach((r) => {
      r.checked = r.value === w.mode;
      r.onchange = () => (w.mode = r.value);
    });
    $('w-min').value = String(w.minutes);
    $('w-min').onchange = () => ((w.minutes = +$('w-min').value), (w.mode = 'minutes'), (modeRadios[0].checked = true));
    $('w-count').value = w.count;
    $('w-count').oninput = () => {
      w.count = Math.min(2000, Math.max(20, Math.round(+$('w-count').value || 150)));
      w.mode = 'chars';
      modeRadios[1].checked = true;
    };
    $('w-quick').onclick = (e) => {
      const b = e.target.closest('.seg-b');
      if (!b) return;
      w.count = +b.dataset.v;
      $('w-count').value = w.count;
      w.mode = 'chars';
      modeRadios[1].checked = true;
      b.blur();
    };
    $('w-weak').checked = !!w.weak;
    $('w-weak').onchange = () => (w.weak = $('w-weak').checked);

    function settingsOut() {
      return { chars: chars.join(''), type: w.type, mode: w.mode, minutes: w.minutes, count: w.count, weak: w.weak };
    }
    $('w-go').onclick = () => {
      S().state.settings.workshop = settingsOut();
      S().save();
      location.hash = '#/atelier/exercice';
    };
    $('w-sample-btn').onclick = () => {
      const o = settingsOut();
      const r = buildExercise(o, 80);
      const box = $('w-sample');
      box.hidden = false;
      box.textContent = r.text || 'Choisis au moins une touche.';
    };
    refresh();
  };

  // Construit le texte d'un exercice à partir des réglages de l'atelier
  function buildExercise(o, forceLen) {
    const timed = o.mode === 'minutes';
    const len = forceLen || (timed ? o.minutes * 60 * C.CHARS_PER_SEC : o.count);
    const weights = o.weak ? G.weightsFromStats(o.chars, S().state.chars) : undefined;
    const opts = { type: o.type, chars: o.chars, len, weights, pool: T.WORDS, fingerOf };
    let r = G.generate(opts);
    if (r.unavailable) r = G.generate(Object.assign({}, opts, { type: 'pseudo' }));
    return r;
  }
  V.buildExercise = buildExercise;

  // ---- Exercice -----------------------------------------------------------------------------------------------------------------
  V.workshopRun = function (root) {
    const o = S().state.settings.workshop;
    if (!o || !o.chars) return (location.hash = '#/atelier');
    const timed = o.mode === 'minutes';
    const r = buildExercise(o);
    const label = TYPE_LABELS[o.type] + ' · ' + Array.from(o.chars).slice(0, 24).join(' ') + (o.chars.length > 24 ? ' …' : '');
    const run = DD.StrictRun(root, {
      title: 'Atelier de répétitions',
      subtitle: label + (timed ? ' · ' + o.minutes + ' min' : ' · ' + o.count + ' caractères') + (o.weak ? ' · touches ratées renforcées' : ''),
      back: { href: '#/atelier', label: 'Atelier' },
      text: r.text,
      timeLimit: timed ? o.minutes * 60 : 0,
      restart: () => DD.router.reload(),
      onEnter: () => DD.router.reload(),
      evaluate(res) {
        // Enregistré dans l'historique de l'atelier : compte dans l'objectif du jour et la série,
        // mais n'entre ni dans les records de vitesse, ni dans le certificat (ce n'est pas un test chronométré).
        S().addSession({ t: Date.now(), type: o.type, chars: o.chars, dur: Math.round(res.dur), len: res.len, wpm: Math.round(res.wpm * 10) / 10, acc: Math.round(res.acc * 10) / 10, errors: res.errors });
        return {
          passed: true,
          stars: 0,
          headline: res.acc >= 97 ? 'Très propre !' : res.acc >= 90 ? 'Bien joué' : 'Ralentis un peu pour gagner en précision',
          notes: ['Enregistré dans l\'historique de l\'atelier (onglet Statistiques).'],
          buttons: [
            { label: 'Refaire (nouveau contenu)', onclick: () => DD.router.reload(), primary: true },
            { label: "Modifier l'atelier", href: '#/atelier' },
            { label: 'Mes statistiques', href: '#/stats' },
          ],
        };
      },
    });
    return () => run.destroy();
  };
})();
