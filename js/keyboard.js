/* Clavier visuel (coloré par doigt ou en carte de chaleur). Les mains animées viennent de hands.js. */
(function () {
  const DD = window.DD;
  const F = DD.Layout.FINGERS;

  function keyHTML(k) {
    if (k.special) return k.label ? '<span class="kl">' + DD.esc(k.label) + '</span>' : '';
    if (/^[a-z]$/.test(k.b)) return '<span class="kc">' + k.b.toUpperCase() + '</span>';
    if (k.s) return '<span class="ks">' + DD.esc(k.s) + '</span><span class="kb">' + DD.esc(k.b) + '</span>';
    return '<span class="kc">' + DD.esc(k.b) + '</span>';
  }

  const Keyboard = {
    /**
     * Crée un clavier. mode = 'fingers' (couleur par doigt) ou 'heat' (carte de chaleur).
     * opts.hands = true : superpose les mains animées (si elles sont activées dans les réglages).
     * Renvoie { el, byId, setNext(ids), flash(id, kind), pressKey(id), markError(), setFocus(ids), setHeat(map), hands }.
     */
    create(layout, mode, opts) {
      opts = opts || {};
      layout = layout || DD.Layout.current();
      const root = DD.el('div', 'kbd ' + (mode === 'heat' ? 'heat' : 'fingers'));
      const byId = {};
      layout.rows.forEach((r) => {
        const rowEl = DD.el('div', 'krow');
        r.forEach((k) => {
          const cell = DD.el('div', 'kcell');
          cell.style.setProperty('--w', k.w);
          if (!k.spacer) {
            const key = DD.el('div', 'key' + (k.special ? ' special' : '') + (k.id === 'Enter2' ? ' filler' : ''), keyHTML(k));
            key.style.setProperty('--fc', F[k.f].color);
            if (k.id === 'f' || k.id === 'j') key.classList.add('bump');
            key.dataset.id = k.id;
            cell.appendChild(key);
            byId[k.id] = key;
          }
          rowEl.appendChild(cell);
        });
        root.appendChild(rowEl);
      });
      let lit = []; // touches actuellement surlignées (on ne nettoie que celles-là : plus rapide à chaque frappe)
      const api = {
        el: root,
        byId,
        hands: null,
        // Touches à taper ensuite : surlignées, et les mains vont vers elles (sauf meta.quiet).
        setNext(ids, meta) {
          lit.forEach((k) => k.classList.remove('next', 'mod'));
          lit = [];
          (ids || []).forEach((id, i, arr) => {
            const k = byId[id];
            if (!k) return;
            k.classList.add('next');
            if (arr.length > 1 && i < arr.length - 1) k.classList.add('mod'); // Maj, AltGr ou touche morte
            lit.push(k);
          });
          if (api.hands && !(meta && meta.quiet)) api.hands.target(ids);
        },
        // Les mains : visibles ou non (créées au premier besoin)
        setHandsVisible(on) {
          if (on && !api.hands && DD.Hands) api.hands = DD.Hands.attach(api, layout);
          if (api.hands) api.hands.setOptions({ visible: !!on });
        },
        // La touche s'enfonce légèrement
        pressKey(id) {
          const k = byId[id];
          if (!k) return;
          k.classList.add('down');
          setTimeout(() => k.classList.remove('down'), 150);
        },
        // Erreur : secousse du doigt attendu et éclat rouge discret sur la touche attendue
        markError() {
          if (api.hands) api.hands.error();
        },
        // Mise en avant d'un ensemble de touches (aperçu d'un module)
        setFocus(ids) {
          const set = new Set(ids);
          Object.entries(byId).forEach(([id, k]) => k.classList.toggle('focus', set.has(id)));
          root.classList.toggle('has-focus', set.size > 0);
        },
        flash(id, kind) {
          const k = byId[id];
          if (!k) return;
          k.classList.remove('flash-ok', 'flash-bad');
          if (kind === 'bad') void k.offsetWidth; // relance la secousse (animation) ; inutile pour le simple changement de couleur
          k.classList.add(kind === 'bad' ? 'flash-bad' : 'flash-ok');
          setTimeout(() => k.classList.remove('flash-ok', 'flash-bad'), 260);
          if (api.hands) api.hands.feedback(id, kind === 'bad' ? 'bad' : 'ok');
        },
        setHeat(map, info) {
          Object.entries(byId).forEach(([id, k]) => {
            const v = map[id];
            if (v == null) {
              k.style.setProperty('--heat', 0);
              k.classList.remove('hot');
              k.removeAttribute('title');
            } else {
              k.style.setProperty('--heat', v.value.toFixed(3));
              k.classList.toggle('hot', v.value > 0);
              k.title = v.title;
            }
          });
        },
      };
      if (opts.hands && DD.Hands && DD.Hands.settings().visible) api.hands = DD.Hands.attach(api, layout);
      return api;
    },

    // Agrège des stats {caractère: {n, m}} par touche physique -> valeurs 0..1 pour la carte de chaleur.
    heatFromChars(chars, layout, opts) {
      layout = layout || DD.Layout.current();
      opts = opts || {};
      const full = opts.fullRate || 0.2; // 20 % d'erreurs = rouge plein
      const agg = {};
      Object.entries(chars).forEach(([c, v]) => {
        const id = layout.keyOf(c);
        if (!id) return;
        const a = agg[id] || (agg[id] = { n: 0, m: 0 });
        a.n += v.n;
        a.m += v.m;
      });
      const out = {};
      Object.entries(agg).forEach(([id, a]) => {
        if (a.n < (opts.minN || 1)) return;
        const rate = a.m / (a.n + 2);
        out[id] = {
          value: Math.min(1, rate / full),
          title: (layout.keys[id].b || id) + ' : ' + a.m + ' erreur' + (a.m > 1 ? 's' : '') + ' sur ' + a.n + ' frappes',
          n: a.n,
          m: a.m,
        };
      });
      return out;
    },

    // Les touches les plus ratées, triées par taux d'erreur (au moins minN frappes)
    weakest(chars, minN, limit) {
      return Object.entries(chars)
        .filter(([c, v]) => v.n >= (minN || 8) && v.m > 0 && c !== ' ')
        .map(([c, v]) => ({ c, n: v.n, m: v.m, rate: v.m / (v.n + 2) }))
        .sort((a, b) => b.rate - a.rate)
        .slice(0, limit || 5);
    },
  };

  DD.Keyboard = Keyboard;
})();
