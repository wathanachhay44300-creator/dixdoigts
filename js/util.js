/* Utilitaires communs */
(function () {
  const DD = (window.DD = window.DD || {});

  // Nom provisoire du site : un seul endroit à changer (+ <title> dans index.html).
  DD.APP_NAME = 'DixDoigts';

  DD.esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  DD.el = function (tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  };

  DD.rnd = {
    int: (a, b) => a + Math.floor(Math.random() * (b - a + 1)),
    pick: (arr) => arr[Math.floor(Math.random() * arr.length)],
    shuffle(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
  };

  const pad = (n) => String(n).padStart(2, '0');

  DD.fmt = {
    dayKey(ts) {
      const d = ts == null ? new Date() : new Date(ts);
      return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    },
    // Date locale à midi (évite les soucis d'heure d'été)
    dayDate(key) {
      const [y, m, d] = key.split('-').map(Number);
      return new Date(y, m - 1, d, 12);
    },
    date(ts) {
      return new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
    },
    dateLong(ts) {
      return new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    },
    short(ts) {
      return new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    },
    duration(sec) {
      sec = Math.round(sec);
      if (sec < 60) return sec + ' s';
      const m = Math.round(sec / 60);
      if (m < 60) return m + ' min';
      return Math.floor(m / 60) + ' h ' + pad(m % 60);
    },
    pct(x) {
      return (Math.round(x * 10) / 10).toString().replace('.', ',') + ' %';
    },
  };

  // Petit toast en bas de l'écran
  DD.toast = function (html, ms) {
    const box = document.getElementById('toasts');
    if (!box) return;
    const t = DD.el('div', 'toast', html);
    box.appendChild(t);
    requestAnimationFrame(() => t.classList.add('in'));
    setTimeout(() => {
      t.classList.remove('in');
      setTimeout(() => t.remove(), 300);
    }, ms || 4500);
  };

  // Télécharger un fichier généré côté navigateur
  DD.download = function (name, data, type) {
    const blob = data instanceof Blob ? data : new Blob([data], { type: type || 'application/octet-stream' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 500);
  };

  DD.levelName = function (wpm) {
    if (wpm >= 120) return 'Maître';
    if (wpm >= 100) return 'Expert';
    if (wpm >= 80) return 'Avancé';
    if (wpm >= 60) return 'Confirmé';
    if (wpm >= 40) return 'Intermédiaire';
    if (wpm >= 20) return 'Apprenti';
    return 'Débutant';
  };
})();
