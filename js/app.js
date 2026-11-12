/* Routeur (hash) et en-tête. */
(function () {
  const DD = window.DD;
  DD.views = DD.views || {};

  // [expression, nom de la vue, lien du menu à mettre en avant]
  const routes = [
    [/^\/?$/, 'home', '#/'],
    [/^\/lecons$/, 'lessons', '#/lecons'],
    [/^\/module\/(\d+)$/, 'module', '#/lecons'],
    [/^\/lecon\/([\d.]+)$/, 'lesson', '#/lecons'],
    [/^\/passage\/(\d+)$/, 'skip', '#/lecons'],
    [/^\/points-faibles(?:\/(.+))?$/, 'weak', '#/stats'],
    [/^\/test$/, 'test', '#/test'],
    [/^\/stats$/, 'stats', '#/stats'],
    [/^\/badges$/, 'badges', '#/badges'],
    [/^\/certificat$/, 'certificate', '#/certificat'],
    [/^\/guide$/, 'guide', '#/guide'],
    [/^\/reglages$/, 'settings', '#/reglages'],
  ];

  let cleanup = null;

  function refreshHeader() {
    const sk = DD.Store.streak();
    const chip = document.getElementById('streak');
    if (chip) {
      chip.textContent = '🔥 ' + sk.current;
      chip.title = 'Série : ' + sk.current + ' jour' + (sk.current > 1 ? 's' : '') + ' de suite (objectif : ' + DD.Store.state.settings.dailyGoalMin + ' min par jour). Aujourd\'hui : ' + Math.floor(sk.todaySec / 60) + ' min.';
      chip.classList.toggle('done', sk.todayDone);
    }
  }

  function run() {
    if (typeof cleanup === 'function') {
      try {
        cleanup();
      } catch (e) {
        console.error(e);
      }
    }
    cleanup = null;
    const raw = decodeURI(location.hash.replace(/^#/, '')) || '/';
    let hit = null;
    for (const [re, name, nav] of routes) {
      const m = raw.match(re);
      if (m) {
        hit = { name, nav, params: m.slice(1) };
        break;
      }
    }
    if (!hit) {
      location.hash = '#/';
      return;
    }
    document.querySelectorAll('.nav a').forEach((a) => a.classList.toggle('on', a.getAttribute('href') === hit.nav));
    const main = document.getElementById('app');
    main.innerHTML = '';
    window.scrollTo({ top: 0, behavior: 'instant' });
    try {
      cleanup = DD.views[hit.name](main, ...hit.params);
    } catch (e) {
      console.error(e);
      main.innerHTML = '<section class="page"><div class="notice warn">Une erreur est survenue dans cet écran (' + DD.esc(e.message) + '). <a href="#/">Retour à l\'accueil</a></div></section>';
    }
    refreshHeader();
  }

  DD.router = { reload: run };
  DD.app = { refreshHeader };

  // Clavier QWERTY détecté ? (Chrome / Edge uniquement)
  function layoutCheck() {
    if (!(navigator.keyboard && navigator.keyboard.getLayoutMap)) return;
    navigator.keyboard
      .getLayoutMap()
      .then((m) => {
        if (m.get('KeyQ') !== 'q') return;
        let dismissed = false;
        try {
          dismissed = sessionStorage.getItem('dd-qwerty') === '1';
        } catch (e) {}
        if (dismissed) return;
        const b = document.getElementById('banner');
        b.hidden = false;
        b.innerHTML = '⚠️ Ton clavier semble être en QWERTY. Les leçons sont prévues pour un clavier français AZERTY : change la disposition dans les réglages de ton ordinateur. <button class="btn small ghost" id="banner-x">Compris</button>';
        document.getElementById('banner-x').onclick = () => {
          b.hidden = true;
          try {
            sessionStorage.setItem('dd-qwerty', '1');
          } catch (e) {}
        };
      })
      .catch(() => {});
  }

  window.addEventListener('hashchange', run);
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-app-name]').forEach((e) => (e.textContent = DD.APP_NAME));
    run();
    layoutCheck();
  });
})();
