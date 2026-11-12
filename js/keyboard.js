/* Clavier visuel (coloré par doigt ou en carte de chaleur) et schéma des mains. */
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
     * Renvoie { el, setNext(ids), flash(id, kind), setHeat(map) }.
     */
    create(layout, mode) {
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
      return {
        el: root,
        byId,
        setNext(ids) {
          Object.values(byId).forEach((k) => k.classList.remove('next', 'mod'));
          (ids || []).forEach((id, i, arr) => {
            const k = byId[id];
            if (!k) return;
            k.classList.add('next');
            if (arr.length > 1 && i < arr.length - 1) k.classList.add('mod'); // Maj ou touche morte
          });
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
          void k.offsetWidth;
          k.classList.add(kind === 'bad' ? 'flash-bad' : 'flash-ok');
          setTimeout(() => k.classList.remove('flash-ok', 'flash-bad'), 260);
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

  // ---- Mains -------------------------------------------------------------------
  // Dessin simple : paume + 4 doigts + pouce par main. 'active' = ensemble de doigts à mettre en avant.
  const HANDS = {
    // x, largeur, haut (y du bout), hauteur, étiquette de repos
    L: [
      { f: 'LP', x: 34, w: 40, y: 112, h: 98, t: 'Q' },
      { f: 'LR', x: 82, w: 42, y: 78, h: 132, t: 'S' },
      { f: 'LM', x: 132, w: 44, y: 66, h: 144, t: 'D' },
      { f: 'LI', x: 184, w: 44, y: 80, h: 130, t: 'F' },
    ],
  };

  Keyboard.hands = function (opts) {
    opts = opts || {};
    const active = opts.active || null; // Set de doigts, ou null = tous
    const W = 640;
    const parts = [];
    const dim = (f) => (active && !active.has(f) ? ' dim' : '');
    const finger = (f, x, w, y, h, label, mirror, home) => {
      const X = mirror ? W - x - w : x;
      const cx = X + w / 2;
      let s = '<g class="fg' + dim(f) + '" style="--fc:' + F[f].color + '">';
      s += '<rect x="' + X + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + w / 2 + '"/>';
      s += '<text x="' + cx + '" y="' + (y + 30) + '" text-anchor="middle" class="fl">' + label + '</text>';
      if (home) s += '<rect class="bump" x="' + (cx - 8) + '" y="' + (y + 38) + '" width="16" height="3" rx="1.5"/>';
      s += '</g>';
      return s;
    };
    [false, true].forEach((mirror) => {
      const labels = mirror ? ['J', 'K', 'L', 'M'] : ['Q', 'S', 'D', 'F'];
      const fingers = mirror
        ? [
            { f: 'RI', i: 3 },
            { f: 'RM', i: 2 },
            { f: 'RR', i: 1 },
            { f: 'RP', i: 0 },
          ]
        : [
            { f: 'LP', i: 0 },
            { f: 'LR', i: 1 },
            { f: 'LM', i: 2 },
            { f: 'LI', i: 3 },
          ];
      // paume
      const px = mirror ? W - 34 - 194 : 34;
      parts.push('<rect class="palm" x="' + px + '" y="190" width="194" height="58" rx="26"/>');
      fingers.forEach(({ f, i }) => {
        const g = HANDS.L[i];
        const label = mirror ? labels[3 - i] : labels[i];
        parts.push(finger(f, g.x, g.w, g.y, g.h, label, mirror, label === 'F' || label === 'J'));
      });
      // pouce
      const tx = mirror ? W - 236 : 236;
      parts.push(
        '<g class="fg' + dim('TH') + '" style="--fc:' + F.TH.color + '"><rect x="' + (tx - 20) + '" y="168" width="40" height="86" rx="20" transform="rotate(' + (mirror ? 38 : -38) + ' ' + tx + ' 214)"/></g>'
      );
    });
    parts.push('<text x="' + (34 + 97) + '" y="272" text-anchor="middle" class="hl">main gauche</text>');
    parts.push('<text x="' + (W - 34 - 97) + '" y="272" text-anchor="middle" class="hl">main droite</text>');
    parts.push('<text x="' + W / 2 + '" y="236" text-anchor="middle" class="hl">pouces : espace</text>');
    return '<svg class="hands" viewBox="0 0 ' + W + ' 282" role="img" aria-label="Position des mains sur la rangée de base">' + parts.join('') + '</svg>';
  };

  DD.Keyboard = Keyboard;
})();
