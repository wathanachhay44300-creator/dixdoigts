/* Leçon en étapes (modules 1, 2, 3, 6, 7) et fin de module (endurance, maîtrise, révision). */
(function () {
  const DD = window.DD;
  const V = (DD.views = DD.views || {});
  const S = () => DD.Store;
  const C = DD.Curriculum;

  const LEN_LABELS = { short: 'Courte', normal: 'Normale', long: 'Longue' };

  // Choix de la longueur des séries (courte ≈ 60, normale ≈ 150, longue ≈ 300 caractères)
  function lenControl() {
    const cur = S().state.settings.seriesLength;
    return (
      '<div class="len-ctl"><span class="opt-label">Longueur des séries</span><div class="seg" id="len-seg">' +
      Object.keys(C.SERIES_LEN)
        .map((k) => '<button class="seg-b' + (k === cur ? ' on' : '') + '" data-v="' + k + '">' + LEN_LABELS[k] + ' · ' + C.SERIES_LEN[k] + '</button>')
        .join('') +
      '</div></div>'
    );
  }
  function bindLenControl(root) {
    const seg = root.querySelector('#len-seg');
    if (!seg) return;
    seg.onclick = (e) => {
      const b = e.target.closest('.seg-b');
      if (!b) return;
      S().state.settings.seriesLength = b.dataset.v;
      S().save();
      DD.router.reload(); // nouvelle série, à la nouvelle longueur
    };
  }

  function stepperHTML(items) {
    // items : [{label, state: 'done'|'cur'|'todo'|'locked', href}]
    return (
      '<ol class="stepper">' +
      items
        .map((it, i) => {
          const inner = '<span class="step-n">' + (it.state === 'done' ? '✓' : i + 1) + '</span><span class="step-t">' + DD.esc(it.label) + '</span>';
          const cls = 'step ' + it.state;
          return '<li class="' + cls + '">' + (it.href && it.state !== 'locked' ? '<a href="' + it.href + '">' + inner + '</a>' : inner) + '</li>';
        })
        .join('') +
      '</ol>'
    );
  }

  const SUBTITLES = {
    repeat: "Répétition pure : une touche ou une paire, toujours au même rythme. Les groupes s'allongent peu à peu.",
    alternate: "Alternances : on passe d'une main à l'autre, ou d'un doigt à l'autre.",
    pseudo: 'Pseudo-mots : des suites de lettres sans sens, uniquement avec les touches de cette leçon.',
    words: 'Mots réels, écrits uniquement avec les touches vues dans cette leçon.',
    test: "Mini-test d'1 minute, avec un contenu que tu n'as jamais vu.",
  };

  // ---- Leçon en étapes -------------------------------------------------------------------------------------------------
  V.stagedLesson = function (root, f, stageParam) {
    const { module: m, lesson: l } = f;
    const stages = l.stages();
    const rec = S().lesson(l.id);
    const isDone = (st) => !!(rec && (rec.done || (rec.stages && rec.stages[st] && rec.stages[st].done)));
    const unlocked = (st) => stages.slice(0, stages.indexOf(st)).every(isDone);
    const firstTodo = stages.find((st) => !isDone(st)) || 'intro';
    const stage = stages.includes(stageParam) ? stageParam : rec && rec.done ? 'intro' : firstTodo;
    if (!unlocked(stage)) {
      location.hash = '#/lecon/' + l.id + '/' + firstTodo;
      return;
    }
    const base = '#/lecon/' + l.id + '/';
    const stepper = stepperHTML(
      stages.map((st) => ({
        label: st === 'test' ? 'Mini-test (1 min)' : C.STAGE_LABELS[st],
        state: st === stage ? 'cur' : isDone(st) ? 'done' : unlocked(st) ? 'todo' : 'locked',
        href: base + st,
      }))
    );
    const title = l.id + ' · ' + l.title;
    const back = { href: '#/module/' + m.id, label: 'Module ' + m.id + ' · ' + m.title };

    // --- Introduction : une phrase + le schéma du doigt
    if (stage === 'intro') {
      const layout = DD.Layout.current();
      const fingers = C.fingersFor(l.newKeys);
      root.innerHTML =
        '<section class="page"><a class="back" href="' + back.href + '">← ' + DD.esc(back.label) + '</a><h1>' + DD.esc(title) + '</h1>' + stepper +
        '<div class="card"><p class="lead intro-line">' + DD.esc(l.intro) + '</p><div id="i-kb"></div><div class="kbd-bar" id="i-bar"></div>' +
        '<p class="muted small">Dans cette leçon : uniquement ' + Array.from(l.allowed).map((c) => '<kbd>' + DD.esc(c) + '</kbd>').join(' ') + ' (les touches nouvelles sont en couleur). Aucune phrase.</p>' +
        '<div class="actions"><a class="btn primary" id="go" href="' + base + stages[1] + '">Commencer</a></div></div></section>';
      const kb = DD.Keyboard.create(layout, 'fingers', { hands: true });
      kb.setFocus(
        Array.from(l.newKeys)
          .map((c) => layout.hint(c))
          .filter(Boolean)
          .flatMap((h) => (h.dead ? h.steps.flat() : [h.main]))
      );
      root.querySelector('#i-kb').appendChild(kb.el);
      // Les doigts de cette leçon sont mis en avant, et la démo montre ce qu'ils font sur les nouvelles touches.
      if (kb.hands) kb.hands.highlight(fingers);
      const demo = DD.Hands.demoBar(kb, { text: () => Array.from(l.newKeys).join(' ') + ' ' + Array.from(l.newKeys).reverse().join(' ') });
      root.querySelector('#i-bar').appendChild(demo.el);
      root.querySelector('#go').onclick = () => S().recordStage(l.id, 'intro', { acc: 100, wpm: 0, passed: true });
      return () => {
        demo.stop();
        if (kb.hands) kb.hands.destroy();
      };
    }

    // --- Séries d'entraînement et mini-test
    const content = C.stageContent(l, stage);
    const isTest = stage === 'test';
    const next = stages[stages.indexOf(stage) + 1];
    const need = l.minAcc;
    const run = DD.StrictRun(root, {
      title,
      subtitle: SUBTITLES[stage] + ' Il faut ' + need + ' % de précision pour valider.',
      back,
      extraTop: stepper + (isTest ? '' : lenControl()),
      text: content.text,
      timeLimit: content.timeLimit,
      restart: () => DD.router.reload(),
      onEnter: () => DD.router.reload(),
      evaluate(res) {
        const passed = res.acc >= need && (!isTest || res.len >= 30); // un mini-test demande au moins 30 caractères
        S().recordStage(l.id, stage, { acc: res.acc, wpm: res.wpm, passed });
        const notes = [];
        const buttons = [];
        let stars = 0;
        if (!passed) notes.push(res.acc < need ? 'Précision : il en faut au moins ' + need + ' %. Ralentis un peu, la vitesse viendra après.' : 'Tape un peu plus pour valider.');
        if (passed && res.blind && res.acc >= 95) notes.push('Clavier masqué : bravo, c\'est la vraie technique 🙈');
        if (isTest && passed) {
          stars = 1 + (res.acc >= 95 ? 1 : 0) + (res.acc >= 98 ? 1 : 0);
          S().recordLesson(l.id, { wpm: res.wpm, acc: res.acc, passed: true, stars });
          notes.push('🎉 Leçon terminée !');
          const nxt = C.after(l.id);
          buttons.push(nxt ? V.nextButton(nxt) : { label: 'Faire un test chronométré', href: '#/test', primary: true });
          buttons.push({ label: 'Refaire le mini-test', onclick: () => DD.router.reload() });
        } else if (passed) {
          buttons.push({ label: 'Continuer : ' + (next === 'test' ? 'mini-test' : C.STAGE_LABELS[next].toLowerCase()), href: base + next, primary: true });
          buttons.push({ label: 'Refaire cette série (nouveau contenu)', onclick: () => DD.router.reload() });
        } else {
          buttons.push({ label: 'Réessayer (nouveau contenu)', onclick: () => DD.router.reload(), primary: true });
        }
        buttons.push({ label: 'Retour au module', href: back.href });
        return { passed, stars, headline: passed ? (isTest ? (stars === 3 ? 'Parfait !' : 'Mini-test réussi') : 'Série réussie') : 'Presque !', notes, buttons };
      },
    });
    bindLenControl(root);
    return () => run.destroy();
  };

  // ---- Fin de module ------------------------------------------------------------------------------------------------------
  V.end = function (root, modId, step) {
    const mods = C.modules;
    const idx = mods.findIndex((x) => x.id === +modId);
    const m = mods[idx];
    const steps = C.END_STEPS;
    if (!m || !m.end || !steps.includes(step)) return (location.hash = '#/lecons');
    // Module ouvert (progression, déverrouillé, ou « tout déverrouiller »). Un module déverrouillé ouvre aussi sa
    // fin sans ordre imposé ; sinon : leçons terminées d'abord, et les étapes dans l'ordre conseillé.
    const free = S().freeAccess(m);
    if (!S().moduleOpen(mods, idx) || !(S().lessonsDone(m) || S().moduleDone(m) || free)) return (location.hash = '#/module/' + modId);
    const i = steps.indexOf(step);
    const firstTodo = steps.find((s) => !S().endDone(m.id, s)) || steps[0];
    if (!free && i > 0 && !S().endDone(m.id, steps[i - 1]) && !S().endDone(m.id, step)) return (location.hash = '#/fin/' + m.id + '/' + firstTodo);

    const link = (s) => '#/fin/' + m.id + '/' + s;
    const stepper = stepperHTML(
      steps.map((s, k) => ({
        label: s === 'mastery' ? 'Maîtrise' : s === 'revision' ? 'Révision' : 'Endurance ' + (k + 1),
        state: s === step ? 'cur' : S().endDone(m.id, s) ? 'done' : free || k === 0 || S().endDone(m.id, steps[k - 1]) ? 'todo' : 'locked',
        href: link(s),
      }))
    );
    const back = { href: '#/module/' + m.id, label: 'Module ' + m.id + ' · ' + m.title };
    const c = C.endContent(m, step);
    const wasDone = S().moduleDone(m);
    let run = null;
    let pauseTimer = null;

    const subtitles = {
      e1: 'Série d\'endurance, 2 minutes : uniquement les touches du module. Garde un rythme régulier.',
      e2: 'Série d\'endurance, 2 minutes : uniquement les touches du module.',
      e3: 'Dernière série d\'endurance, 3 minutes : pseudo-mots et mots.',
      mastery: 'Test de maîtrise, 2 minutes : uniquement les touches du module. Il faut 95 % de précision.',
      revision: 'Révision en mélange : au moins la moitié de touches du module, le reste vient des modules précédents.',
    };

    function showPause(nextStep) {
      if (run) run.destroy();
      run = null;
      let left = 20;
      root.innerHTML =
        '<section class="page"><a class="back" href="' + back.href + '">← ' + DD.esc(back.label) + '</a><h1>Pause</h1>' + stepper +
        '<div class="card pause"><p class="lead">Secoue les mains, regarde au loin, respire. La série suivante commence dans <b id="pz">' + left + '</b> secondes.</p>' +
        '<div class="actions"><a class="btn primary" href="' + link(nextStep) + '">Je suis prêt, on continue</a></div></div></section>';
      pauseTimer = setInterval(() => {
        left--;
        const el = root.querySelector('#pz');
        if (el) el.textContent = left;
        if (left <= 0) {
          clearInterval(pauseTimer);
          location.hash = link(nextStep);
        }
      }, 1000);
    }

    run = DD.StrictRun(root, {
      title: m.title + ' · ' + c.label,
      subtitle: subtitles[step],
      back,
      extraTop: stepper + (step === 'revision' ? lenControl() : ''),
      text: c.text,
      timeLimit: c.timeLimit,
      restart: () => DD.router.reload(),
      onEnter: () => DD.router.reload(),
      evaluate(res) {
        const passed = res.acc >= c.minAcc && res.len >= 60;
        const notes = [];
        const buttons = [];
        if (!passed) notes.push(res.acc < c.minAcc ? 'Précision : il en faut au moins ' + c.minAcc + ' % (tu es à ' + DD.fmt.pct(res.acc) + '). Ralentis un peu.' : 'Tape au moins 60 caractères pour valider.');
        if (passed && res.blind && res.acc >= 95) notes.push('Clavier masqué : bravo 🙈');
        if (passed) {
          S().recordEnd(m.id, step);
          const nextStep = steps[i + 1];
          if (nextStep && (step === 'e1' || step === 'e2')) {
            buttons.push({ label: 'Pause de 20 secondes, puis la série suivante', onclick: () => showPause(nextStep), primary: true });
            buttons.push({ label: 'Continuer sans pause', href: link(nextStep) });
          } else if (nextStep) {
            buttons.push({ label: 'Continuer : ' + C.endLabel(m, nextStep), href: link(nextStep), primary: true });
          } else {
            const nm = mods[idx + 1];
            if (!wasDone && S().moduleDone(m)) notes.push('🎉 Module « ' + DD.esc(m.title) + ' » terminé !');
            buttons.push(nm ? { label: 'Module ' + nm.id + ' : ' + nm.title, href: '#/module/' + nm.id, primary: true } : { label: 'Faire un test chronométré', href: '#/test', primary: true });
          }
          buttons.push({ label: 'Refaire cette série (nouveau contenu)', onclick: () => DD.router.reload() });
        } else {
          buttons.push({ label: 'Réessayer (nouveau contenu)', onclick: () => DD.router.reload(), primary: true });
        }
        buttons.push({ label: 'Retour au module', href: back.href });
        return { passed, stars: 0, headline: passed ? 'Étape réussie' : step === 'mastery' ? 'Pas tout à fait : 95 % demandés' : 'Presque !', notes, buttons };
      },
    });
    bindLenControl(root);
    return () => {
      clearInterval(pauseTimer);
      if (run) run.destroy();
    };
  };
})();
