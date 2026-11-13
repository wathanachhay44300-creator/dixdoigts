/* Statistiques, badges, certificat PDF, réglages et sauvegarde. */
(function () {
  const DD = window.DD;
  const V = (DD.views = DD.views || {});
  const S = () => DD.Store;

  // ---- Statistiques -----------------------------------------------------------------------------
  V.stats = function (root) {
    const st = S().state;
    const base = st.settings.baselineWpm;
    const layout = DD.Layout.current();
    let filter = 10;
    const t10 = S().testsBy(10);
    const last10 = t10.slice(-10);
    const avg = last10.length ? last10.reduce((a, t) => a + t.wpm, 0) / last10.length : 0;
    const totalSec = Object.values(st.days).reduce((a, d) => a + d.sec, 0);
    const sk = S().streak();

    root.innerHTML =
      '<section class="page"><h1>Statistiques</h1>' +
      '<div class="cards4">' +
      '<div class="card stat"><b>' + (S().bestWpm(10) ? Math.round(S().bestWpm(10)) : '—') + '</b><span>meilleur MPM à dix doigts</span></div>' +
      '<div class="card stat"><b>' + (avg ? Math.round(avg) : '—') + '</b><span>moyenne des ' + (last10.length || 10) + ' derniers tests</span></div>' +
      '<div class="card stat"><b>' + st.tests.length + '</b><span>test' + (st.tests.length > 1 ? 's' : '') + ' chronométré' + (st.tests.length > 1 ? 's' : '') + '</span></div>' +
      '<div class="card stat"><b>' + DD.fmt.duration(totalSec) + '</b><span>d\'entraînement · série : ' + sk.current + ' j</span></div>' +
      '</div>' +
      '<div class="card"><div class="card-head"><h3>Courbe de progression</h3><div class="seg" id="s-fing"><button class="seg-b" data-v="10">10 doigts</button><button class="seg-b" data-v="2">2 doigts</button></div></div><div id="s-curve"></div>' +
      '<p class="muted small">La ligne orange pointillée est ton niveau à deux doigts (' + base + ' MPM). Quand ta courbe à dix doigts passe au-dessus, tu as dépassé ton point de départ. <a href="#/reglages">Changer cette valeur</a></p></div>' +
      '<div class="card"><h3>Minutes d\'entraînement (14 derniers jours)</h3><div id="s-days"></div></div>' +
      '<div class="card"><h3>Touches ratées</h3><div id="s-heat"></div></div>' +
      '<div class="card"><h3>Historique des tests</h3><div id="s-table"></div></div>' +
      '<div class="card"><h3>Exercices de l\'atelier</h3><p class="muted small">Ils comptent dans ton objectif du jour et ta série, mais pas dans tes records de vitesse ni dans le certificat.</p><div id="s-ws"></div></div>' +
      '<div class="card"><h3>Sauvegarde</h3><p class="muted">Ta progression est enregistrée dans ce navigateur. Si tu vides les données du navigateur, elle disparaît : exporte-la de temps en temps.</p><div class="actions"><button class="btn ghost" id="s-export">Exporter ma progression</button><a class="btn ghost" href="#/reglages">Importer / réinitialiser</a></div></div>' +
      '</section>';
    const $ = (id) => root.querySelector('#' + id);

    function curve() {
      root.querySelectorAll('#s-fing .seg-b').forEach((b) => b.classList.toggle('on', +b.dataset.v === filter));
      const tests = S().testsBy(filter);
      const pts = tests.slice(-60).map((t) => ({ y: Math.round(t.wpm), t: t.t, hl: t.acc >= 90, title: DD.fmt.date(t.t) + ' : ' + Math.round(t.wpm) + ' MPM, ' + DD.fmt.pct(t.acc) + ', ' + t.dur / 60 + ' min' }));
      $('s-curve').innerHTML = pts.length
        ? DD.Charts.line({ pts, baseline: { y: base, label: 'deux doigts : ' + base + ' MPM' }, height: 280, xLabels: (i) => DD.fmt.short(pts[i].t), aria: 'Courbe des tests' })
        : '<p class="muted">Aucun test à ' + (filter === 10 ? 'dix' : 'deux') + ' doigts pour l\'instant. <a href="#/test">Faire un test</a></p>';
    }
    $('s-fing').onclick = (e) => {
      const b = e.target.closest('.seg-b');
      if (b) {
        filter = +b.dataset.v;
        b.blur();
        curve();
      }
    };
    curve();

    // minutes par jour
    const days = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setHours(12, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const k = DD.fmt.dayKey(d.getTime());
      const m = Math.round(((st.days[k] && st.days[k].sec) || 0) / 6) / 10;
      days.push({ label: DD.fmt.short(d.getTime()), v: m, title: DD.fmt.short(d.getTime()) + ' : ' + m + ' min' });
    }
    $('s-days').innerHTML = DD.Charts.bars({ values: days, goal: st.settings.dailyGoalMin, aria: 'Minutes d\'entraînement par jour' });

    // carte de chaleur
    const weak = DD.Keyboard.weakest(st.chars, 8, 6);
    const hasData = Object.keys(st.chars).length > 0;
    if (!hasData) {
      $('s-heat').innerHTML = '<p class="muted">Pas encore de frappes enregistrées. Fais une leçon ou un test.</p>';
    } else {
      $('s-heat').innerHTML =
        '<p class="muted small">Plus la touche est rouge, plus tu la rates (toutes frappes confondues). Passe la souris dessus pour le détail.</p><div id="h-kb"></div>' +
        '<div class="legend"><span>peu d\'erreurs</span><i></i><span>≥ 20 % d\'erreurs</span></div>' +
        (weak.length ? '<p>Tes touches les plus difficiles : ' + weak.map((w) => '<kbd>' + DD.esc(w.c) + '</kbd> ' + Math.round((w.m / w.n) * 100) + ' %').join(' · ') + '</p>' : '<p>Aucune touche vraiment problématique pour l\'instant 👏</p>') +
        '<div class="actions"><a class="btn primary" href="#/points-faibles">S\'entraîner sur mes points faibles</a></div>';
      const hk = DD.Keyboard.create(layout, 'heat');
      hk.setHeat(DD.Keyboard.heatFromChars(st.chars, layout, { minN: 3, fullRate: 0.2 }));
      $('h-kb').appendChild(hk.el);
    }

    // tableau
    const rows = st.tests.slice(-25).reverse();
    $('s-table').innerHTML = rows.length
      ? '<div class="table-wrap"><table><thead><tr><th>Date</th><th>Durée</th><th>Doigts</th><th>MPM</th><th>Précision</th><th>Fautes</th></tr></thead><tbody>' +
        rows.map((t) => '<tr><td>' + DD.fmt.date(t.t) + '</td><td>' + t.dur / 60 + ' min</td><td>' + t.fingers + '</td><td><b>' + Math.round(t.wpm) + '</b></td><td>' + DD.fmt.pct(t.acc) + '</td><td>' + t.bad + '</td></tr>').join('') +
        '</tbody></table></div>'
      : '<p class="muted">Aucun test pour l\'instant.</p>';
    // exercices de l'atelier (séparés des tests chronométrés)
    const TYPE = { repeat: 'Répétition', alternate: 'Alternances', pseudo: 'Pseudo-mots', words: 'Mots réels', mix: 'Mélange' };
    const ws = (st.sessions || []).slice(-15).reverse();
    $('s-ws').innerHTML = ws.length
      ? '<div class="table-wrap"><table><thead><tr><th>Date</th><th>Exercice</th><th>Touches</th><th>Durée</th><th>MPM</th><th>Précision</th></tr></thead><tbody>' +
        ws.map((s) => '<tr><td>' + DD.fmt.date(s.t) + '</td><td>' + (TYPE[s.type] || s.type) + '</td><td><span class="mono">' + DD.esc(Array.from(s.chars).slice(0, 14).join(' ')) + (s.chars.length > 14 ? ' …' : '') + '</span></td><td>' + DD.fmt.duration(s.dur) + '</td><td><b>' + Math.round(s.wpm) + '</b></td><td>' + DD.fmt.pct(s.acc) + '</td></tr>').join('') +
        '</tbody></table></div>'
      : '<p class="muted">Aucun exercice pour l\'instant. <a href="#/atelier">Ouvrir l\'atelier</a></p>';
    $('s-export').onclick = exportProgress;
  };

  function exportProgress() {
    DD.download('dixdoigts-sauvegarde-' + DD.fmt.dayKey() + '.json', S().exportJSON(), 'application/json');
    DD.toast('Sauvegarde téléchargée. Garde ce fichier en lieu sûr.');
  }

  // ---- Badges ------------------------------------------------------------------------------------
  V.badges = function (root) {
    const have = S().state.badges;
    const defs = DD.Badges.defs;
    const n = defs.filter((b) => have[b.id]).length;
    root.innerHTML =
      '<section class="page"><h1>Badges</h1><p class="lead">' + n + ' / ' + defs.length + ' débloqués.</p><div class="badges">' +
      defs
        .map(
          (b) =>
            '<div class="bdg ' + (have[b.id] ? 'on' : 'off') + '"><span class="bdg-ico">' + DD.esc(b.icon) + '</span><strong>' + DD.esc(b.name) + '</strong><span class="small muted">' + DD.esc(b.desc) + '</span>' +
            (have[b.id] ? '<span class="small bdg-date">' + DD.fmt.date(have[b.id]) + '</span>' : '') + '</div>'
        )
        .join('') +
      '</div></section>';
  };

  // ---- Certificat -------------------------------------------------------------------------------
  V.certificate = function (root) {
    const st = S().state;
    const valid = S().testsBy(10).filter((t) => t.acc >= 90 && t.dur >= 60);
    const best = valid.sort((a, b) => b.wpm - a.wpm)[0];
    const mods = DD.Curriculum.modules;
    const doneMods = mods.filter((m) => S().moduleDone(m)).length;
    if (!best) {
      root.innerHTML =
        '<section class="page"><h1>Certificat</h1><div class="card"><p>Le certificat récompense ton meilleur test <b>à dix doigts</b> : au moins 1 minute et 90 % de précision. Tu n\'en as pas encore. Une fois que tu en auras un, tu pourras télécharger ton certificat en PDF ici.</p><div class="actions"><a class="btn primary" href="#/test">Faire un test</a></div></div></section>';
      return;
    }
    root.innerHTML =
      '<section class="page"><h1>Certificat</h1><p class="lead">Ton meilleur test à dix doigts : <b>' + Math.round(best.wpm) + ' MPM</b>, ' + DD.fmt.pct(best.acc) + ' de précision, ' + best.dur / 60 + ' min, le ' + DD.fmt.dateLong(best.t) + '.</p>' +
      '<form class="inline-form" id="c-form"><label for="c-name">Nom sur le certificat</label><input id="c-name" maxlength="50" value="' + DD.esc(st.profile.name) + '" placeholder="Ton nom"><button class="btn primary">Télécharger le PDF</button></form>' +
      '<div class="cert" id="c-prev"></div>' +
      '<p class="muted small">Le certificat est généré dans ton navigateur : rien n\'est envoyé sur Internet.</p></section>';
    const $ = (id) => root.querySelector('#' + id);
    const info = () => ({
      name: $('c-name').value.trim(),
      wpm: best.wpm,
      acc: best.acc,
      dur: best.dur,
      date: DD.fmt.dateLong(Date.now()),
      level: DD.levelName(best.wpm),
      modulesDone: doneMods,
      modulesTotal: mods.length,
      baseline: st.settings.baselineWpm,
      beat: best.wpm > st.settings.baselineWpm,
    });
    function preview() {
      const d = info();
      $('c-prev').innerHTML =
        '<div class="cert-in"><div class="cert-star">★</div><div class="cert-app">' + DD.esc(DD.APP_NAME.toUpperCase()) + '</div><h2>Certificat de dactylographie</h2><p>Ce certificat est décerné à</p><div class="cert-name">' + DD.esc(d.name || 'Un(e) dactylo motivé(e)') + '</div>' +
        '<p>pour avoir atteint une vitesse de</p><div class="cert-wpm">' + Math.round(d.wpm) + ' MPM</div><p>à dix doigts, avec une précision de ' + Math.round(d.acc) + ' %</p><p class="muted">test de ' + d.dur / 60 + ' min · niveau ' + d.level + '</p>' +
        (d.beat ? '<p class="cert-beat">Son niveau de départ à deux doigts (' + d.baseline + ' MPM) est dépassé.</p>' : '') + '</div>';
    }
    preview();
    $('c-name').oninput = preview;
    $('c-form').onsubmit = (e) => {
      e.preventDefault();
      const d = info();
      if (d.name && d.name !== st.profile.name) {
        st.profile.name = d.name;
        S().save();
      }
      try {
        const blob = DD.PDF.certificate(d);
        DD.download('certificat-' + DD.APP_NAME.toLowerCase() + '.pdf', blob);
        S().state.flags.certificate = true;
        S().save();
        DD.Badges.check();
      } catch (err) {
        DD.toast('Impossible de créer le PDF : ' + DD.esc(err.message));
      }
    };
  };

  // ---- Réglages -----------------------------------------------------------------------------------
  V.settings = function (root) {
    const st = S().state.settings;
    const sel = (v, cur) => (v === cur ? ' selected' : '');
    root.innerHTML =
      '<section class="page"><h1>Réglages</h1>' +
      (S().storageOk ? '' : '<div class="notice warn">⚠️ Ce navigateur bloque le stockage local : ta progression ne sera pas conservée. Désactive la navigation privée ou autorise le stockage pour ce site.</div>') +
      '<div class="notice warn" id="layout-warn" hidden></div>' +
      '<div class="card form"><h3>Profil</h3><label>Prénom ou nom<input id="p-name" maxlength="50" value="' + DD.esc(S().state.profile.name) + '"></label>' +
      '<label>Objectif quotidien<select id="p-goal">' + [5, 10, 15, 20, 30].map((m) => '<option value="' + m + '"' + sel(m, st.dailyGoalMin) + '>' + m + ' minutes</option>').join('') + '</select><small>Un jour compte dans ta série quand tu atteins cet objectif.</small></label>' +
      '<label>Longueur des séries d\'exercice<select id="p-series">' + [['short', 'Courte (≈ 60 caractères)'], ['normal', 'Normale (≈ 150 caractères)'], ['long', 'Longue (≈ 300 caractères)']].map((o) => '<option value="' + o[0] + '"' + sel(o[0], st.seriesLength) + '>' + o[1] + '</option>').join('') + '</select><small>Pour les séries des leçons et la révision de fin de module. Chaque série peut être refaite à l\'infini avec un contenu nouveau.</small></label>' +
      '<label>Mon niveau à deux doigts (MPM)<input id="p-base" type="number" min="5" max="300" value="' + st.baselineWpm + '"><small>Tracé comme une ligne sur ta courbe. Tu peux aussi le mesurer avec un test « 2 doigts ».</small></label></div>' +
      '<div class="card form"><h3>Clavier</h3><label>Disposition<select id="p-layout">' + DD.Layout.all().map((l) => '<option value="' + l.id + '"' + sel(l.id, st.layout) + '>' + l.name + '</option>').join('') + '</select><small>Change quelques touches (par exemple le tiret et le point d\'exclamation). Choisis celle qui ressemble à ton clavier.</small></label>' +
      '<label class="check"><input id="p-kb" type="checkbox"' + (st.showKeyboard ? ' checked' : '') + '> Afficher le clavier visuel et les indications de doigts</label></div>' +
      '<div class="card form"><h3>Sons de frappe</h3><label class="check"><input id="p-sound" type="checkbox"' + (st.sound ? ' checked' : '') + '> Activer les sons</label>' +
      '<label>Style<select id="p-prof"><option value="clic"' + sel('clic', st.soundProfile) + '>Clic mécanique</option><option value="doux"' + sel('doux', st.soundProfile) + '>Doux</option><option value="machine"' + sel('machine', st.soundProfile) + '>Machine à écrire</option></select></label>' +
      '<label>Volume<input id="p-vol" type="range" min="0" max="1" step="0.05" value="' + st.volume + '"></label><button class="btn ghost small" id="p-try" type="button">Essayer le son</button></div>' +
      '<div class="card form"><h3>Ma progression</h3><p class="muted">Tout est enregistré dans ce navigateur, sans compte. Exporte un fichier pour la garder en sécurité ou la passer sur un autre appareil.</p>' +
      '<div class="actions"><button class="btn ghost" id="p-export" type="button">Exporter (fichier .json)</button><label class="btn ghost file">Importer un fichier<input id="p-import" type="file" accept="application/json,.json" hidden></label><button class="btn danger" id="p-reset" type="button">Tout effacer</button></div></div>' +
      '</section>';
    const $ = (id) => root.querySelector('#' + id);
    const save = () => S().save();
    $('p-name').onchange = () => ((S().state.profile.name = $('p-name').value.trim().slice(0, 50)), save());
    $('p-goal').onchange = () => ((st.dailyGoalMin = +$('p-goal').value), save());
    $('p-series').onchange = () => ((st.seriesLength = $('p-series').value), save());
    $('p-base').onchange = () => {
      st.baselineWpm = Math.min(300, Math.max(5, Math.round(+$('p-base').value || 80)));
      $('p-base').value = st.baselineWpm;
      save();
    };
    $('p-layout').onchange = () => ((st.layout = $('p-layout').value), save());
    $('p-kb').onchange = () => ((st.showKeyboard = $('p-kb').checked), save());
    $('p-sound').onchange = () => ((st.sound = $('p-sound').checked), save(), DD.Audio.click());
    $('p-prof').onchange = () => ((st.soundProfile = $('p-prof').value), save(), DD.Audio.click());
    $('p-vol').oninput = () => ((st.volume = +$('p-vol').value), save());
    $('p-vol').onchange = () => DD.Audio.click();
    $('p-try').onclick = () => {
      DD.Audio.unlock();
      DD.Audio.click();
      setTimeout(DD.Audio.click, 120);
      setTimeout(() => DD.Audio.click(true), 260);
    };
    $('p-export').onclick = exportProgress;
    $('p-import').onchange = (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (!confirm('Remplacer toute ta progression actuelle par celle de ce fichier ?')) return;
        const r = S().importJSON(String(reader.result));
        if (r.ok) {
          DD.toast('Progression importée ✓');
          DD.app.refreshHeader();
          DD.router.reload();
        } else DD.toast('Import impossible : ' + DD.esc(r.error));
      };
      reader.onerror = () => DD.toast('Impossible de lire ce fichier.');
      reader.readAsText(f);
      e.target.value = '';
    };
    $('p-reset').onclick = () => {
      if (!confirm('Effacer toute ta progression (leçons, tests, badges, série) ? Cette action est définitive. Pense à exporter avant.')) return;
      S().reset();
      DD.toast('Progression effacée.');
      DD.app.refreshHeader();
      DD.router.reload();
    };
    // Détection de disposition (Chrome / Edge) : si la touche Q donne "q", le clavier est QWERTY.
    if (navigator.keyboard && navigator.keyboard.getLayoutMap) {
      navigator.keyboard
        .getLayoutMap()
        .then((m) => {
          if (m.get('KeyQ') === 'q') {
            const w = $('layout-warn');
            if (w) {
              w.hidden = false;
              w.innerHTML = '⚠️ Ton clavier semble être en QWERTY, or les leçons sont prévues pour un clavier AZERTY français. Change la disposition dans les réglages de ton système pour suivre les leçons.';
            }
          }
        })
        .catch(() => {});
    }
  };
})();
