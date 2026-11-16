/* Écrans d'apprentissage : accueil, modules, leçons, tests de passage, points faibles, guide des mains. */
(function () {
  const DD = window.DD;
  const V = (DD.views = DD.views || {});
  const S = () => DD.Store;
  const C = DD.Curriculum;

  function stars(n) {
    return '<span class="stars sm">' + '★'.repeat(n) + '<span class="off">' + '★'.repeat(3 - n) + '</span></span>';
  }

  const RECO = '<span class="reco" title="La suite conseillée du parcours">Recommandé</span>';

  // « Ouvert » (on peut jouer) et « validé » (terminé) sont deux choses différentes :
  //   terminé / ouvert par la progression / déverrouillé (pas validé) / verrouillé.
  // La barre de progression ne compte que les vraies réussites.
  function moduleCards() {
    const mods = C.modules;
    const next = C.next();
    return (
      '<div class="modules">' +
      mods
        .map((m, i) => {
          const done = S().moduleDone(m);
          const open = S().moduleOpen(mods, i);
          const unlockedOnly = open && !done && !S().moduleReached(mods, i); // déverrouillé, pas encore atteint
          const prog = S().moduleProgress(m);
          const tot = S().moduleTotal(m);
          const skipped = S().state.modules[m.id] && S().state.modules[m.id].skipped;
          const pct = done ? 100 : (prog / tot) * 100;
          const rec = !!(next && next.module.id === m.id);
          const state = done
            ? '✓ ' + (skipped ? 'Validé par test' : 'Terminé')
            : unlockedOnly
              ? '🔓 Déverrouillé · non validé · ' + prog + ' / ' + tot
              : open
                ? prog + ' / ' + tot + ' étapes'
                : '🔒 Verrouillé';
          return (
            '<div class="mod ' + (done ? 'done' : unlockedOnly ? 'unlocked' : open ? 'open' : 'locked') + '">' +
            '<a class="mod-link" href="#/module/' + m.id + '"><span class="mod-ico">' + DD.esc(m.icon) + '</span>' +
            '<span class="mod-body"><span class="mod-num">Module ' + m.id + (rec ? ' ' + RECO : '') + '</span><strong>' + DD.esc(m.title) + '</strong>' +
            '<span class="progress thin"><span style="width:' + pct + '%"></span></span>' +
            '<span class="mod-state">' + state + '</span></span></a>' +
            (open ? '' : '<button class="btn small mod-unlock" data-unlock-module="' + m.id + '">Déverrouiller</button>') +
            '</div>'
          );
        })
        .join('') +
      '</div>'
    );
  }

  // Boutons « Déverrouiller » (un clic suffit, avec un simple message) et interrupteur « Tout déverrouiller »
  function bindUnlocks(root) {
    const msg = (what, target) => {
      const adv = C.adviceAfter(target);
      DD.toast(what + (adv ? ' Cet exercice est conseillé après ' + DD.esc(adv) + '.' : ''));
    };
    root.querySelectorAll('[data-unlock-module]').forEach((b) => {
      b.onclick = () => {
        const m = C.modules.find((x) => x.id === +b.dataset.unlockModule);
        S().unlockModule(m.id);
        msg('Module déverrouillé.', { module: m });
        DD.router.reload();
      };
    });
    root.querySelectorAll('[data-unlock-lesson]').forEach((b) => {
      b.onclick = () => {
        const f = C.find(b.dataset.unlockLesson);
        S().unlockLesson(f.lesson.id);
        msg('Leçon déverrouillée.', f);
        DD.router.reload();
      };
    });
    const all = root.querySelector('#unlock-all');
    if (all)
      all.onchange = () => {
        S().setUnlockAll(all.checked);
        DD.toast(all.checked ? 'Tout est déverrouillé. Le parcours conseillé reste indiqué par « Recommandé ».' : 'Retour au parcours conseillé. Tes validations sont conservées.');
        DD.router.reload();
      };
  }
  V.bindUnlocks = bindUnlocks;

  function ring(value, label, sub) {
    const r = 36,
      c = 2 * Math.PI * r;
    return (
      '<div class="ring"><svg viewBox="0 0 90 90"><circle class="ring-bg" cx="45" cy="45" r="' + r + '"/><circle class="ring-fg" cx="45" cy="45" r="' + r + '" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + (c * (1 - Math.min(1, value))).toFixed(1) + '" transform="rotate(-90 45 45)"/></svg>' +
      '<div class="ring-txt"><b>' + label + '</b><span>' + sub + '</span></div></div>'
    );
  }

  // ---- Accueil ------------------------------------------------------------------------------
  V.home = function (root) {
    const st = S().state;
    const sk = S().streak();
    const next = C.next();
    const best10 = S().bestWpm(10);
    const base = st.settings.baselineWpm;
    const mins = Math.floor(sk.todaySec / 60);
    const goal = st.settings.dailyGoalMin;
    const pts = S()
      .testsBy(10)
      .slice(-20)
      .map((t, i) => ({ y: Math.round(t.wpm), title: DD.fmt.date(t.t) + ' : ' + Math.round(t.wpm) + ' MPM' }));

    let levelMsg;
    if (!best10) levelMsg = 'Fais un premier test à dix doigts pour te situer. Il apparaîtra ici, face à ton niveau à deux doigts.';
    else if (best10 > base) levelMsg = 'Tu as dépassé ton niveau à deux doigts de ' + (best10 - base) + ' MPM. Bravo !';
    else levelMsg = 'Encore ' + Math.ceil(base - best10) + ' MPM pour rattraper ton niveau à deux doigts. Les premières semaines sont les plus lentes, c\'est normal.';

    root.innerHTML =
      '<section class="page">' +
      '<div class="hero"><div><h1>' + (st.profile.name ? 'Bonjour ' + DD.esc(st.profile.name) + ' 👋' : 'Bienvenue 👋') + '</h1>' +
      '<p class="lead">Apprends à taper à dix doigts, sans regarder le clavier. Dix à quinze minutes par jour suffisent, mais tous les jours.</p></div></div>' +
      (st.profile.name ? '' : '<form class="inline-form" id="name-form"><label for="name-in">Ton prénom <span class="muted">(pour le certificat, facultatif)</span></label><input id="name-in" maxlength="40" autocomplete="off"><button class="btn small">Enregistrer</button></form>') +
      '<div class="cards3">' +
      '<div class="card today"><h3>Aujourd\'hui</h3>' + ring(sk.todaySec / sk.goalSec, mins + '<small>/' + goal + ' min</small>', 'entraînement') +
      '<p class="muted">' + (sk.todayDone ? 'Objectif du jour atteint ✓' : 'Encore ' + Math.max(1, Math.ceil((sk.goalSec - sk.todaySec) / 60)) + ' min pour valider ta journée.') + '</p>' +
      '<p class="streak">🔥 <b>' + sk.current + '</b> jour' + (sk.current > 1 ? 's' : '') + ' de suite <span class="muted">(record : ' + sk.best + ')</span></p></div>' +
      '<div class="card"><h3>Continuer</h3>' +
      (next
        ? next.end
          ? '<p class="next-title"><span class="muted">Module ' + next.module.id + ' · ' + DD.esc(next.module.title) + '</span><br><strong>Fin de module : ' + DD.esc(C.endLabel(next.module, next.end)) + '</strong></p><a class="btn primary" href="#/fin/' + next.module.id + '/' + next.end + '">Continuer</a>'
          : '<p class="next-title"><span class="muted">Module ' + next.module.id + ' · ' + DD.esc(next.module.title) + '</span><br><strong>' + next.lesson.id + ' ' + DD.esc(next.lesson.title) + '</strong></p><a class="btn primary" href="#/lecon/' + next.lesson.id + '">Reprendre la leçon</a>'
        : '<p>Tous les modules sont terminés. Bravo ! Continue avec les tests pour progresser en vitesse.</p><a class="btn primary" href="#/test">Faire un test</a>') +
      '<div class="quick"><a class="btn ghost small" href="#/atelier">Atelier</a><a class="btn ghost small" href="#/points-faibles">Points faibles</a><a class="btn ghost small" href="#/guide">Guide des mains</a></div></div>' +
      '<div class="card"><h3>Ton niveau à dix doigts</h3><div class="level"><b>' + (best10 ? Math.round(best10) : '—') + '</b><span>MPM</span><em class="muted">à deux doigts : ' + base + ' MPM</em></div>' +
      '<div class="levelbar"><span style="width:' + Math.min(100, (best10 / (base * 1.25)) * 100) + '%"></span><i style="left:' + (base / (base * 1.25)) * 100 + '%"></i></div>' +
      '<p class="muted small">' + levelMsg + '</p><a class="btn ghost small" href="#/test">Faire un test</a></div>' +
      '</div>' +
      (pts.length > 1 ? '<div class="card"><h3>Ta progression</h3>' + DD.Charts.line({ pts, baseline: { y: base, label: 'deux doigts : ' + base + ' MPM' }, height: 200, aria: 'Courbe de tes derniers tests à dix doigts' }) + '</div>' : '') +
      '<h2>Les 10 modules</h2>' + moduleCards() +
      '</section>';

    bindUnlocks(root);
    const form = root.querySelector('#name-form');
    if (form)
      form.onsubmit = (e) => {
        e.preventDefault();
        const v = form.querySelector('input').value.trim().slice(0, 40);
        if (v) {
          S().state.profile.name = v;
          S().save();
          DD.router.reload();
        }
      };
  };

  V.lessons = function (root) {
    root.innerHTML =
      '<section class="page"><h1>Leçons</h1><p class="lead">Dix modules, du plus simple au plus complet. L\'ordre est conseillé, jamais obligatoire : la suite du parcours est marquée « Recommandé », et tu peux déverrouiller n\'importe quel module d\'un clic.</p>' +
      '<div class="card unlock-card"><label class="check"><input type="checkbox" id="unlock-all"' + (S().isUnlockAll() ? ' checked' : '') + '> <b>Tout déverrouiller</b></label>' +
      '<p class="muted small">Ouvre tous les modules et toutes les leçons d\'un coup. Déverrouiller ne valide rien : pas d\'étoiles, pas de badge, pas de progression tant que tu n\'as pas réussi l\'exercice. Tu peux le désactiver quand tu veux, tes validations sont gardées.</p></div>' +
      '<div class="notice">Envie de répéter une touche ou un doigt précis, sans suivre le parcours ? <a href="#/atelier"><b>Ouvre l\'atelier de répétitions</b></a>.</div>' +
      moduleCards() + '</section>';
    bindUnlocks(root);
  };

  // ---- Module -------------------------------------------------------------------------------
  // Bouton « suite » vers la prochaine leçon ou la prochaine étape de fin de module
  function nextButton(nxt) {
    if (nxt.lesson) return { label: 'Leçon suivante', href: '#/lecon/' + nxt.lesson.id, primary: true };
    return { label: 'Fin du module : ' + C.endLabel(nxt.module, nxt.end), href: '#/fin/' + nxt.module.id + '/' + nxt.end, primary: true };
  }
  V.nextButton = nextButton;

  // ---- Fin de module : 3 séries d'endurance, test de maîtrise, révision en mélange ------------------------------------------------
  function endCard(m, open) {
    const lessonsOk = S().lessonsDone(m);
    const moduleOk = S().moduleDone(m);
    const free = S().freeAccess(m); // module déverrouillé : pas d'ordre imposé non plus pour la fin de module
    const next = C.next();
    const rows = C.END_STEPS.map((step, i) => {
      const done = S().endDone(m.id, step);
      const prevDone = i === 0 || S().endDone(m.id, C.END_STEPS[i - 1]);
      const can = open && (lessonsOk || moduleOk || free) && (free || prevDone || done);
      const rec = !!(next && next.end === step && next.module.id === m.id);
      const secs = C.END_SECONDS[step];
      const meta = step === 'revision' ? 'au moins ' + Math.max(150, C.seriesLen()) + ' caractères' : secs / 60 + ' min' + (step === 'mastery' ? ' · 95 % de précision' : '');
      const body = '<span class="les-id">' + (i + 1) + '</span><span class="les-body"><strong>' + DD.esc(C.endLabel(m, step)) + '</strong>' + (rec ? ' ' + RECO : '') + '<span class="muted small">' + meta + '</span></span><span class="les-stars">' + (done ? '✓' : '') + '</span>';
      return can ? '<a class="les' + (done ? ' done' : '') + '" href="#/fin/' + m.id + '/' + step + '">' + body + '</a>' : '<div class="les locked' + (done ? ' done' : '') + '">' + body + '</div>';
    }).join('');
    return (
      '<h2>Fin du module</h2><p class="muted">' +
      (lessonsOk || moduleOk || free ? "Trois séries d'endurance (avec une courte pause entre chaque), un test de maîtrise, puis une révision en mélange." : 'Conseillé quand toutes les leçons sont terminées : déverrouille le module pour y accéder avant.') +
      '</p><div class="lesson-list">' + rows + '</div>'
    );
  }

  V.module = function (root, id) {
    const mods = C.modules;
    const idx = mods.findIndex((m) => m.id === +id);
    if (idx < 0) return (location.hash = '#/lecons');
    const m = mods[idx];
    const open = S().moduleOpen(mods, idx);
    const done = S().moduleDone(m);
    const unlockedOnly = open && !done && !S().moduleReached(mods, idx); // déverrouillé, mais pas validé
    const next = C.next();
    const layout = DD.Layout.current();
    const fingers = m.keys ? C.fingersFor(m.keys) : null;
    const rows = m.lessons
      .map((l) => {
        const r = S().lesson(l.id);
        const lopen = S().lessonOpen(mods, m, l);
        const rec = !!(next && next.lesson && next.lesson.id === l.id);
        const single = lopen && !open && !(r && r.done); // leçon déverrouillée toute seule
        const meta = r && r.tries ? 'meilleur : ' + r.bestWpm + ' MPM · ' + DD.fmt.pct(r.bestAcc) : l.desc || '';
        const goal = l.minWpm ? '<span class="pill">≥ ' + l.minWpm + ' MPM</span>' : '';
        // Leçons en étapes : une pastille par étape (faite / à faire)
        const dots = l.staged
          ? '<span class="stage-dots">' + l.stages().map((st) => '<i class="' + (r && (r.done || (r.stages && r.stages[st] && r.stages[st].done)) ? 'on' : '') + '" title="' + DD.esc(C.STAGE_LABELS[st]) + '"></i>').join('') + '</span>'
          : '';
        const tags = (rec ? ' ' + RECO : '') + (single ? ' <span class="pill soft">Déverrouillée</span>' : '');
        const body =
          '<span class="les-id">' + l.id + '</span><span class="les-body"><strong>' + DD.esc(l.title) + '</strong> ' + goal + tags + dots + '<span class="muted small">' + DD.esc(meta) + '</span></span>' +
          '<span class="les-stars">' + (r && r.done ? stars(r.stars) : '') + '</span>';
        return lopen
          ? '<a class="les' + (r && r.done ? ' done' : '') + '" href="#/lecon/' + l.id + '">' + body + '</a>'
          : '<div class="les locked">' + body + '<button class="btn small" data-unlock-lesson="' + l.id + '">Déverrouiller</button></div>';
      })
      .join('');
    const advice = C.adviceAfter({ module: m });
    root.innerHTML =
      '<section class="page"><a class="back" href="#/lecons">← Tous les modules</a>' +
      '<div class="mod-head"><span class="mod-ico big">' + DD.esc(m.icon) + '</span><div><span class="mod-num">Module ' + m.id + (done ? ' · terminé ✓' : '') + '</span><h1>' + DD.esc(m.title) + '</h1></div></div>' +
      '<p class="lead">' + DD.esc(m.desc) + '</p>' +
      (!open
        ? '<div class="notice unlock-note">🔒 <span>Ce module est conseillé après ' + DD.esc(advice || 'le début du parcours') + '. Tu peux quand même le déverrouiller, d\'un clic.</span> <button class="btn small primary" data-unlock-module="' + m.id + '">Déverrouiller le module</button></div>'
        : unlockedOnly
          ? '<div class="notice">🔓 Déverrouillé' + (advice ? ' : ce module est conseillé après ' + DD.esc(advice) : '') + '. Il reste « non validé » (pas d\'étoiles, pas de badge, pas de progression) tant que tu n\'as pas réussi les exercices.</div>'
          : '') +
      (fingers ? '<div class="card"><h3>Les doigts de ce module</h3><div id="m-kb"></div><div class="kbd-bar" id="m-bar"></div></div>' : '') +
      '<div class="lesson-list">' + rows + '</div>' +
      endCard(m, open) +
      (m.skip && !done
        ? '<div class="card skip"><h3>Tu connais déjà ces touches ?</h3><p>Le test de passage valide le module d\'un coup, même s\'il est verrouillé : il faut <b>95 %</b> de précision et au moins <b>' + m.skip.minWpm + ' MPM</b>. Il vérifie que tu connais les touches, pas la technique des dix doigts : joue le jeu !</p><a class="btn primary" href="#/passage/' + m.id + '">Passer le test de passage</a></div>'
        : '') +
      '</section>';
    bindUnlocks(root);
    if (fingers) {
      const kb = DD.Keyboard.create(layout, 'fingers', { hands: true });
      const ids = [];
      Array.from(m.keys).forEach((c) => {
        const h = layout.hint(c);
        if (h) ids.push(...(h.dead ? h.steps.flat() : [h.main]));
      });
      kb.setFocus(ids);
      root.querySelector('#m-kb').appendChild(kb.el);
      if (kb.hands) kb.hands.highlight(fingers);
      const demo = DD.Hands.demoBar(kb, { text: () => Array.from(m.keys).slice(0, 14).join(' ') });
      root.querySelector('#m-bar').appendChild(demo.el);
      return () => {
        demo.stop();
        if (kb.hands) kb.hands.destroy();
      };
    }
  };

  // ---- Leçon ----------------------------------------------------------------------------------
  V.lesson = function (root, id, stage) {
    const f = C.find(id);
    if (!f) return (location.hash = '#/lecons');
    const mods = C.modules;
    // Ouverte = module ouvert, ou leçon déverrouillée, ou leçon déjà validée (rejouable). Sinon : page du module (bouton « Déverrouiller »).
    if (!S().lessonOpen(mods, f.module, f.lesson)) return (location.hash = '#/module/' + f.module.id);
    if (f.lesson.staged) return V.stagedLesson(root, f, stage); // leçon en étapes (view-lesson.js)
    const { module: m, lesson: l } = f;
    const run = DD.StrictRun(root, {
      title: l.id + ' · ' + l.title,
      subtitle: (l.desc ? l.desc + ' ' : '') + (l.minWpm ? 'Objectif : ' + l.minWpm + ' MPM, ' + l.minAcc + ' % de précision.' : 'Il faut ' + l.minAcc + ' % de précision pour valider.'),
      back: { href: '#/module/' + m.id, label: 'Module ' + m.id + ' · ' + m.title },
      text: l.gen(),
      restart: () => DD.router.reload(),
      onEnter: () => DD.router.reload(),
      evaluate(res) {
        const accOk = res.acc >= l.minAcc;
        const wpmOk = res.wpm >= l.minWpm;
        const passed = accOk && wpmOk;
        const nStars = passed ? 1 + (res.acc >= 95 ? 1 : 0) + (res.acc >= 98 ? 1 : 0) : 0;
        S().recordLesson(l.id, { wpm: res.wpm, acc: res.acc, passed, stars: nStars });
        const notes = [];
        if (!accOk) notes.push('Précision : il en faut au moins ' + l.minAcc + ' %. Ralentis un peu, la vitesse viendra après.');
        if (accOk && !wpmOk) notes.push('Vitesse : vise ' + l.minWpm + ' MPM (tu es à ' + Math.round(res.wpm) + ').');
        if (passed && res.blind && res.acc >= 95) notes.push('Clavier masqué : bravo, c\'est la vraie technique 🙈');
        const nxt = C.after(l.id);
        const buttons = [];
        const again = { label: 'Recommencer (nouveau contenu)', onclick: () => DD.router.reload(), primary: !passed };
        if (passed && nxt) buttons.push(nextButton(nxt));
        if (passed && !nxt) buttons.push({ label: 'Faire un test chronométré', href: '#/test', primary: true });
        buttons.push(again);
        buttons.push({ label: 'Retour au module', href: '#/module/' + m.id });
        return {
          passed,
          stars: nStars,
          headline: passed ? (nStars === 3 ? 'Parfait !' : 'Leçon réussie') : accOk ? 'Presque : un peu plus de vitesse' : 'Presque : un peu plus de précision',
          notes,
          buttons,
        };
      },
    });
    return () => run.destroy();
  };

  // ---- Test de passage -------------------------------------------------------------------------
  V.skip = function (root, id) {
    const mods = C.modules;
    const idx = mods.findIndex((m) => m.id === +id);
    const m = mods[idx];
    // Le test de passage reste possible même pour un module verrouillé : le réussir valide le module.
    if (!m || !m.skip || S().moduleDone(m)) return (location.hash = '#/module/' + id);
    const run = DD.StrictRun(root, {
      title: 'Test de passage · ' + m.title,
      subtitle: 'Il faut ' + m.skip.minWpm + ' MPM et 95 % de précision pour valider tout le module d\'un coup. Utilise bien tes dix doigts !',
      back: { href: '#/module/' + m.id, label: 'Module ' + m.id + ' · ' + m.title },
      text: m.skip.gen(),
      restart: () => DD.router.reload(),
      evaluate(res) {
        const accOk = res.acc >= 95;
        const wpmOk = res.wpm >= m.skip.minWpm;
        const passed = accOk && wpmOk;
        if (passed) S().skipModule(m.id);
        const nxt = mods[idx + 1];
        const notes = [];
        if (!accOk) notes.push('Précision : 95 % minimum (tu es à ' + DD.fmt.pct(res.acc) + ').');
        if (!wpmOk) notes.push('Vitesse : ' + m.skip.minWpm + ' MPM minimum (tu es à ' + Math.round(res.wpm) + ').');
        const buttons = passed
          ? [nxt ? { label: 'Module ' + nxt.id + ' : ' + nxt.title, href: '#/module/' + nxt.id, primary: true } : { label: 'Faire un test', href: '#/test', primary: true }, { label: 'Retour aux modules', href: '#/lecons' }]
          : [{ label: 'Réessayer', onclick: () => DD.router.reload(), primary: true }, { label: 'Faire les leçons', href: '#/module/' + m.id }];
        return { passed, stars: 0, headline: passed ? 'Module validé !' : 'Pas tout à fait', notes: passed ? ['Le module « ' + DD.esc(m.title) + ' » est validé. Les leçons restent disponibles si tu veux t\'entraîner.'] : notes, buttons };
      },
    });
    return () => run.destroy();
  };

  // ---- Points faibles ----------------------------------------------------------------------------
  V.weak = function (root, param) {
    let weak = [];
    if (param) weak = Array.from(decodeURIComponent(param)).slice(0, 8);
    else weak = DD.Keyboard.weakest(S().state.chars, 8, 5).map((w) => w.c);
    if (!weak.length) {
      root.innerHTML =
        '<section class="page"><a class="back" href="#/">← Accueil</a><h1>S\'entraîner sur mes points faibles</h1>' +
        '<div class="card"><p>Je n\'ai pas encore assez de frappes pour repérer tes touches difficiles. Fais quelques leçons ou un test chronométré, puis reviens ici : l\'exercice sera construit à partir de tes touches les plus ratées.</p>' +
        '<div class="actions"><a class="btn primary" href="#/test">Faire un test</a><a class="btn ghost" href="#/lecons">Voir les leçons</a></div></div></section>';
      return;
    }
    const run = DD.StrictRun(root, {
      title: 'Mes points faibles',
      subtitle: 'Exercice sur tes touches les plus ratées : ' + weak.map((c) => (c === ' ' ? 'espace' : c)).join('  '),
      back: { href: '#/stats', label: 'Statistiques' },
      text: DD.Text.weak(weak, 220),
      restart: () => DD.router.reload(),
      evaluate(res) {
        S().state.flags.weak = true;
        return {
          passed: true,
          stars: 0,
          headline: res.acc >= 95 ? 'Très bien : ces touches se calment' : 'Exercice terminé',
          notes: ['Refais cet exercice de temps en temps : le texte change à chaque fois et suit tes erreurs récentes.'],
          buttons: [{ label: 'Un autre exercice', onclick: () => DD.router.reload(), primary: true }, { label: 'Mes statistiques', href: '#/stats' }],
        };
      },
    });
    return () => run.destroy();
  };

  // ---- Guide : position des mains ------------------------------------------------------------------
  V.guide = function (root) {
    const layout = DD.Layout.current();
    const side = (h) => new Set(Object.keys(DD.Layout.FINGERS).filter((k) => DD.Layout.FINGERS[k].hand === h));
    const keysOf = (set) =>
      layout.rows
        .flat()
        .filter((k) => !k.spacer && !k.special && set.has(k.f))
        .map((k) => k.id);
    const steps = [
      {
        t: 'Installe-toi bien',
        p: '<ul class="tips"><li><b>Dos droit</b>, épaules détendues, pieds à plat au sol.</li><li><b>Avant-bras à l\'horizontale</b>, coudes proches du corps, à angle droit.</li><li><b>Poignets droits</b>, dans le prolongement des avant-bras : ne les pose pas sur le bord de la table en tapant.</li><li><b>Écran à hauteur des yeux</b>, à une longueur de bras.</li><li>Une pause de 30 secondes toutes les 20 minutes.</li></ul>',
      },
      {
        t: 'La position de repos',
        p: '<p>Pose l\'<b>index gauche sur F</b> et l\'<b>index droit sur J</b> : ces deux touches ont un petit relief que tu sens sans regarder. Les autres doigts se placent à côté : <b>Q S D</b> à gauche, <b>K L M</b> à droite. Les pouces se reposent sur la barre d\'espace.</p><p>Après chaque touche, le doigt revient à sa place. C\'est la base de tout.</p>',
        hands: null,
        focus: () => ['q', 's', 'd', 'f', 'j', 'k', 'l', 'm', 'g', 'h'].filter((c) => layout.keys[c]),
      },
      {
        t: 'Un doigt par touche',
        p: '<p>Chaque touche a son doigt, indiqué par la couleur. Tu retrouveras ces couleurs sur le clavier de chaque leçon. Un doigt couvre une colonne en diagonale : l\'annulaire gauche tape S, mais aussi Z au-dessus et X en dessous.</p>',
        hands: null,
        focus: () => [],
      },
      {
        t: 'La main gauche',
        p: '<p>De l\'auriculaire à l\'index : <b>Q</b>, <b>S</b>, <b>D</b>, <b>F</b>. L\'index gauche s\'occupe aussi de <b>G</b>, <b>R</b>, <b>T</b>, <b>V</b>, <b>B</b>. L\'auriculaire gauche : <b>A</b>, <b>W</b>, et Maj gauche.</p>',
        hands: side('L'),
        focus: () => keysOf(side('L')),
      },
      {
        t: 'La main droite',
        p: '<p>De l\'index à l\'auriculaire : <b>J</b>, <b>K</b>, <b>L</b>, <b>M</b>. L\'index droit s\'occupe aussi de <b>H</b>, <b>Y</b>, <b>U</b>, <b>N</b>. L\'auriculaire droit : <b>P</b>, la touche <b>^</b>, <b>ù</b>, et Maj droite.</p>',
        hands: side('R'),
        focus: () => keysOf(side('R')),
      },
      {
        t: 'Majuscules, accents et touches mortes',
        p: '<p>Les <b>pouces</b> tapent l\'espace (celui que tu veux, mais toujours le même). Pour une <b>majuscule</b> ou un <b>chiffre</b>, on tient Maj avec l\'auriculaire de <b>l\'autre main</b> : Maj droite pour une lettre de la main gauche, Maj gauche pour la main droite.</p>' +
          '<p><b>Â, ê, î, ô, û</b> : appuie sur la touche <b>^</b> (auriculaire droit, à droite de P). <b>Rien ne s\'affiche : c\'est normal.</b> Puis appuie sur la voyelle. Pour <b>ä, ë, ï, ö, ü</b>, tiens Maj (auriculaire gauche) en appuyant sur <b>^</b> : cela donne le tréma ¨, puis la voyelle.</p>' +
          '<p>Tu peux regarder la démo avec ê et ë : le doigt appuie d\'abord sur ^, puis sur la voyelle. Si ça ne marche pas sur ton clavier, ouvre la <a href="#/diagnostic">page de diagnostic</a>.</p>',
        hands: new Set(['TH', 'LP', 'RP']),
        focus: () => ['Space', 'ShiftL', 'ShiftR'],
      },
      {
        t: 'Vitesse ou précision ?',
        p: '<p><b>La précision d\'abord.</b> Si tu vas plus vite que tes doigts, tu te trompes et tu corriges : c\'est plus lent. Vise 95 % de précision, puis accélère petit à petit.</p><p>À dix doigts, tu seras <b>plus lent que maintenant</b> au début : c\'est le prix à payer, et ça passe en quelques semaines de pratique régulière. Ne regarde pas le clavier : masque-le dès que tu te sens prêt.</p>',
        hands: null,
        focus: () => [],
      },
    ];
    let i = 0;
    root.innerHTML = '<section class="page"><h1>Guide : position des mains</h1><div id="g-card" class="card guide"></div><div class="dots" id="g-dots"></div></section>';
    const card = root.querySelector('#g-card');
    const dots = root.querySelector('#g-dots');
    const kb = DD.Keyboard.create(layout, 'fingers', { hands: true });
    // texte joué par la démo à chaque étape (position de repos, un doigt par touche, mains, pouces et Maj)
    const DEMOS = { 1: 'f j d k s l q m', 2: 'q s d f g h j k l m', 3: 'a z e r t q s d f g w x c v b', 4: 'y u i o p h j k l m n , ;', 5: 'A b P q 5 8 ê ë' };
    let demo = null;
    function render() {
      if (demo) demo.stop();
      demo = null;
      const s = steps[i];
      card.innerHTML =
        '<div class="g-step">Étape ' + (i + 1) + ' sur ' + steps.length + '</div><h2>' + DD.esc(s.t) + '</h2>' + s.p +
        (i >= 1 && i <= 5 ? '<div id="g-kb"></div><div class="kbd-bar" id="g-bar"></div>' + (i === 2 ? '<p class="muted small">Clique sur une touche du clavier : la main te montre quel doigt s\'en occupe, comment il appuie, puis revient.</p>' : '') : '') +
        '<div class="actions"><button class="btn ghost" id="g-prev"' + (i === 0 ? ' disabled' : '') + '>← Précédent</button>' +
        (i < steps.length - 1 ? '<button class="btn primary" id="g-next">Suivant →</button>' : '<a class="btn primary" href="#/lecon/1.1">Commencer la leçon 1.1</a>') + '</div>';
      if (i >= 1 && i <= 5) {
        card.querySelector('#g-kb').appendChild(kb.el);
        kb.setFocus(s.focus());
        if (kb.hands) {
          kb.hands.relayout(); // le clavier vient de changer de conteneur
          kb.hands.rest();
          kb.hands.highlight(s.hands);
        }
        demo = DD.Hands.demoBar(kb, { text: () => DEMOS[i] });
        card.querySelector('#g-bar').appendChild(demo.el);
        // clic sur une touche : le bon doigt vient l'appuyer, puis retourne en position de repos
        Object.keys(kb.byId).forEach((id) => {
          kb.byId[id].style.cursor = 'pointer';
          kb.byId[id].onclick = () => {
            kb.setHandsVisible(true);
            if (kb.hands) kb.hands.show([id], 1400);
          };
        });
      }
      dots.innerHTML = steps.map((_, k) => '<button class="dot' + (k === i ? ' on' : '') + '" data-k="' + k + '" aria-label="Étape ' + (k + 1) + '"></button>').join('');
      const p = card.querySelector('#g-prev'),
        n = card.querySelector('#g-next');
      if (p) p.onclick = () => ((i = Math.max(0, i - 1)), render());
      if (n) n.onclick = () => ((i = Math.min(steps.length - 1, i + 1)), render());
      dots.querySelectorAll('.dot').forEach((d) => (d.onclick = () => ((i = +d.dataset.k), render())));
    }
    render();
    return () => {
      if (demo) demo.stop();
      if (kb.hands) kb.hands.destroy();
    };
  };
})();
