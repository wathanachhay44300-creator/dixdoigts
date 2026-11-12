/* Badges : déblocage automatique après chaque leçon ou test. */
(function () {
  const DD = window.DD;
  const S = () => DD.Store;

  const doneLessons = () => Object.values(S().state.lessons).filter((l) => l.done).length;
  const validBest = (fingers) => S().bestWpm(fingers);
  const tests10 = () => S().testsBy(10);

  const defs = [
    { id: 'first-lesson', icon: '🌱', name: 'Premier pas', desc: 'Terminer une première leçon', test: () => doneLessons() >= 1 },
    { id: 'lessons-10', icon: '📘', name: 'Studieux', desc: 'Terminer 10 leçons', test: () => doneLessons() >= 10 },
    { id: 'lessons-25', icon: '📚', name: 'Assidu', desc: 'Terminer 25 leçons', test: () => doneLessons() >= 25 },
    // un badge par module, ajouté plus bas
    { id: 'wpm-30', icon: '🚶', name: '30 MPM', desc: '30 MPM à dix doigts (précision ≥ 90 %)', test: () => validBest(10) >= 30 },
    { id: 'wpm-50', icon: '🏃', name: '50 MPM', desc: '50 MPM à dix doigts', test: () => validBest(10) >= 50 },
    { id: 'wpm-70', icon: '🚴', name: '70 MPM', desc: '70 MPM à dix doigts', test: () => validBest(10) >= 70 },
    { id: 'beat-baseline', icon: '🚀', name: 'Dépassé !', desc: 'Dépasser ton niveau à deux doigts avec dix doigts', test: () => validBest(10) > S().state.settings.baselineWpm },
    { id: 'wpm-100', icon: '💯', name: '100 MPM', desc: '100 MPM à dix doigts', test: () => validBest(10) >= 100 },
    { id: 'wpm-120', icon: '🏎️', name: '120 MPM', desc: '120 MPM à dix doigts', test: () => validBest(10) >= 120 },
    { id: 'acc-98', icon: '🎯', name: 'Précis', desc: 'Test de 1 min ou plus avec 98 % de précision (10 doigts)', test: () => tests10().some((t) => t.dur >= 60 && t.acc >= 98) },
    { id: 'acc-100', icon: '✨', name: 'Sans faute', desc: 'Test de 1 min ou plus sans aucune erreur (10 doigts)', test: () => tests10().some((t) => t.dur >= 60 && t.acc >= 100) },
    { id: 'tests-10', icon: '⏱️', name: 'Chrono ×10', desc: 'Faire 10 tests chronométrés', test: () => S().state.tests.length >= 10 },
    { id: 'tests-50', icon: '🔟', name: 'Chrono ×50', desc: 'Faire 50 tests chronométrés', test: () => S().state.tests.length >= 50 },
    { id: 'marathon', icon: '🏔️', name: 'Marathonien', desc: 'Réussir un test de 5 minutes (10 doigts, précision ≥ 90 %)', test: () => tests10().some((t) => t.dur >= 300 && t.acc >= 90) },
    { id: 'streak-3', icon: '🔥', name: '3 jours de suite', desc: 'Atteindre ton objectif quotidien 3 jours de suite', test: () => S().streak().best >= 3 },
    { id: 'streak-7', icon: '🔥', name: 'Une semaine', desc: '7 jours de suite', test: () => S().streak().best >= 7 },
    { id: 'streak-14', icon: '🔥', name: 'Deux semaines', desc: '14 jours de suite', test: () => S().streak().best >= 14 },
    { id: 'streak-30', icon: '🔥', name: 'Un mois', desc: '30 jours de suite', test: () => S().streak().best >= 30 },
    { id: 'blind', icon: '🙈', name: "À l'aveugle", desc: 'Réussir une leçon ou un test avec le clavier masqué (95 % de précision)', test: () => !!S().state.flags.blind },
    { id: 'weak', icon: '🩹', name: 'Points faibles', desc: 'Terminer un entraînement sur tes touches les plus ratées', test: () => !!S().state.flags.weak },
    { id: 'skip', icon: '⏩', name: 'Déjà acquis', desc: 'Réussir un test de passage', test: () => !!S().state.flags.skip },
    { id: 'certificate', icon: '🎓', name: 'Diplômé', desc: 'Télécharger ton certificat', test: () => !!S().state.flags.certificate },
  ];

  // Un badge par module
  DD.Curriculum.modules.forEach((m) => {
    defs.splice(3 + m.id - 1, 0, {
      id: 'mod-' + m.id,
      icon: m.icon,
      name: 'Module ' + m.id,
      desc: 'Terminer le module « ' + m.title + ' »',
      test: () => S().moduleDone(m),
    });
  });

  const Badges = {
    defs,
    unlocked: () => S().state.badges,
    // Évalue tous les badges, enregistre et annonce les nouveaux. Renvoie la liste des nouveaux.
    check() {
      const fresh = [];
      defs.forEach((b) => {
        if (S().state.badges[b.id]) return;
        let ok = false;
        try {
          ok = !!b.test();
        } catch (e) {}
        if (ok) {
          S().state.badges[b.id] = Date.now();
          fresh.push(b);
        }
      });
      if (fresh.length) {
        S().save();
        fresh.forEach((b, i) => setTimeout(() => DD.toast('<span class="toast-ico">' + b.icon + '</span><span><strong>Badge débloqué : ' + DD.esc(b.name) + '</strong><br>' + DD.esc(b.desc) + '</span>', 6000), i * 400));
        if (DD.Audio) DD.Audio.success();
      }
      return fresh;
    },
  };

  DD.Badges = Badges;
})();
