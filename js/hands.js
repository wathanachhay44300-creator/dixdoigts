/*
 * Mains réalistes, semi-transparentes, posées sur le clavier visuel et animées.
 *
 * - Deux mains vues de dessus, dessinées en SVG par couches : un groupe par doigt et par phalange
 *   (<g class="finger"> > <g class="seg">), plus la paume et les pouces. Dessins originaux, aucun fichier externe.
 * - Placées d'après les positions RÉELLES des touches mesurées dans la page (elles suivent la taille de la fenêtre).
 * - Un doigt = trois segments ; ses angles sont calculés (hand-model.js) pour que le bout arrive au centre de la touche.
 * - Animation par ressort critique (accélération puis décélération, ~150 à 250 ms), via requestAnimationFrame.
 * - Ne bloquent jamais la souris ni la saisie (pointer-events: none), sont décoratives (aria-hidden).
 * - Mouvement réduit (prefers-reduced-motion) ou machine lente : les mains restent fixes, le doigt concerné est surligné.
 */
(function () {
  'use strict';
  const DD = window.DD;
  const M = DD.HandModel;
  const NS = 'http://www.w3.org/2000/svg';

  const EXTRA_U = 3.0; // espace ajouté sous le clavier pour les paumes, en largeurs de touche
  const OMEGA = { lent: 16, normal: 23, rapide: 31 }; // raideur du ressort : ~95 % du trajet en 0,29 s / 0,2 s / 0,15 s
  const DIP = 0.09; // enfoncement du bout du doigt à l'appui (en touches)
  const SHAKE = 0.08; // amplitude de la secousse d'erreur
  const WSCALE = 0.74; // doigts plus fins que les touches : on voit bien les espaces entre eux (style de la capture)
  const THUMB_W = 1.12; // largeur du pouce (en touches)
  const WF = [1, 0.96, 0.9, 0.78]; // largeur relative du doigt à la base de chaque phalange, puis au bout
  const OVERLAP = 0.12; // chevauchement des phalanges (en largeurs de doigt), pour qu'aucune jointure ne laisse de vide

  // Teintes : remplissage et contour fin. 'blanc' (par défaut) = blanc translucide, comme sur la capture de référence.
  const TINTS = {
    blanc: { fill: '#ffffff', line: '#98a2b3' },
    claire: { fill: '#fbe2d0', line: '#c8a38d' },
    moyenne: { fill: '#e2b28a', line: '#a87c59' },
    foncee: { fill: '#a66f48', line: '#6d4830' },
    fantome: { fill: '#d9e5ff', line: '#8ba2e6' },
  };
  const TINT_NAMES = { blanc: 'Blanc translucide', claire: 'Peau claire', moyenne: 'Peau moyenne', foncee: 'Peau foncée', fantome: 'Fantôme bleu' };

  let UID = 0;
  let perfLevel = 0; // 0 : normal · 1 : allégé (sans ombres) · 2 : sans animation
  const reduced = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

  function svgEl(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    if (attrs) for (const k of Object.keys(attrs)) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  // Courbe lisse fermée passant par des points (Catmull-Rom -> Bézier)
  function closedSpline(pts) {
    const n = pts.length;
    let d = 'M ' + pts[0].x.toFixed(3) + ' ' + pts[0].y.toFixed(3);
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n];
      const p1 = pts[i];
      const p2 = pts[(i + 1) % n];
      const p3 = pts[(i + 2) % n];
      const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
      const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
      d += ' C ' + [c1.x, c1.y, c2.x, c2.y, p2.x, p2.y].map((v) => v.toFixed(3)).join(' ');
    }
    return d + ' Z';
  }

  // Ressort critique exact : renvoie [nouvelle position, nouvelle vitesse]
  function spring(p, v, t, w, dt) {
    const x = p - t;
    const e = Math.exp(-w * dt);
    const j = v + w * x;
    return [t + (x + j * dt) * e, (v - j * w * dt) * e];
  }

  // Phalange : plaque plate à la base (y = 0), bout arrondi en y = -len, flancs légèrement bombés.
  function segPath(wb, wt, len) {
    const r = wt / 2;
    const yTip = -len + r;
    const bulge = ((wb + wt) / 4) * 1.07;
    return (
      'M ' + -wb / 2 + ' 0 Q ' + -bulge + ' ' + -len / 2 + ' ' + -wt / 2 + ' ' + yTip +
      ' A ' + r + ' ' + r + ' 0 0 1 ' + wt / 2 + ' ' + yTip +
      ' Q ' + bulge + ' ' + -len / 2 + ' ' + wb / 2 + ' 0 Z'
    );
  }

  // ---- Réglages ----------------------------------------------------------------------------------------------------------
  function settings() {
    const s = (DD.Store && DD.Store.state.settings) || {};
    return {
      visible: s.showHands !== false,
      opacity: clamp(Number(s.handOpacity) || 62, 20, 80) / 100,
      tint: TINTS[s.handTint] ? s.handTint : 'blanc',
      speed: OMEGA[s.handSpeed] ? s.handSpeed : 'normal',
    };
  }

  // ---- Option « images » : assets/hands/hands.json ------------------------------------------------------------------------------
  // Si le fichier existe, est activé et que ses images se chargent, elles remplacent le dessin SVG. Sinon : SVG.
  const images = { cfg: null, base: 'assets/hands/', listeners: [] };
  function resolveUrl(u) {
    return /^(data:|https?:|blob:|\/)/.test(u) ? u : images.base + u;
  }
  function imageUrls(cfg) {
    const out = [];
    if (cfg.mode === 'per-hand') ['left', 'right'].forEach((k) => cfg.hands && cfg.hands[k] && out.push(cfg.hands[k]));
    else Object.values(cfg.segments || {}).forEach((v) => (Array.isArray(v) ? out.push(...v) : v && out.push(v)));
    return out;
  }
  function useImages(cfg) {
    const off = () => {
      const had = !!images.cfg;
      images.cfg = null;
      if (had) images.listeners.forEach((f) => f());
      return Promise.resolve(false);
    };
    if (!cfg || !cfg.enabled || !['per-hand', 'per-segment'].includes(cfg.mode)) return off();
    const urls = imageUrls(cfg);
    if (!urls.length) return off();
    return Promise.all(
      urls.map(
        (u) =>
          new Promise((ok) => {
            const im = new Image();
            im.onload = () => ok(true);
            im.onerror = () => ok(false);
            im.src = resolveUrl(u);
          })
      )
    ).then((res) => {
      const good = res.every(Boolean); // une image manque : on garde les mains SVG
      images.cfg = good ? cfg : null;
      images.listeners.forEach((f) => f());
      return good;
    });
  }
  function loadImageConfig() {
    if (typeof fetch !== 'function' || !/^https?:$/.test(location.protocol)) return Promise.resolve(false);
    return fetch(images.base + 'hands.json', { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : null))
      .then((cfg) => (cfg ? useImages(cfg) : false))
      .catch(() => false);
  }

  // ======================================================================================================================
  function attach(kb, layoutDef, opts) {
    opts = opts || {};
    const uid = ++UID;
    const root = kb.el;
    const byId = kb.byId;
    const geom = M.keyGeometry(layoutDef);
    const cfg = settings();

    const layer = document.createElement('div');
    layer.className = 'hands-layer';
    layer.setAttribute('aria-hidden', 'true');
    root.classList.add('with-hands');
    root.appendChild(layer);

    const st = {
      u: 0,
      ready: false,
      keyPos: {},
      rest: null,
      omega: OMEGA[cfg.speed],
      hands: { L: null, R: null },
      curIds: [],
      lastHand: null,
      raf: 0,
      last: 0,
      frames: 0,
      acc: 0,
      timers: new Set(),
      demo: null,
      destroyed: false,
      hl: null,
      hlEls: [], // doigts surlignés en ce moment
    };
    let svg = null;

    // ---- Dessin ----------------------------------------------------------------------------------------------------------------
    // Style : formes pleines d'une seule couleur (blanc translucide), SANS dégradé ni ombre. Le contour fin est tracé par un filtre
    // autour de la silhouette entière : il n'y a donc aucune ligne aux articulations. La translucidité vient de l'opacité du calque.
    function buildDefs() {
      const p = 'h' + uid;
      const defs = svgEl('defs', null, svg);
      const f = svgEl('filter', { id: p + 'O', x: '-10%', y: '-10%', width: '120%', height: '120%' }, defs);
      st.morph = svgEl('feMorphology', { in: 'SourceAlpha', operator: 'dilate', radius: 0.03, result: 'd' }, f);
      svgEl('feFlood', { style: 'flood-color: var(--hand-line)', result: 'c' }, f);
      svgEl('feComposite', { in: 'c', in2: 'd', operator: 'in', result: 'o' }, f);
      const mg = svgEl('feMerge', null, f);
      svgEl('feMergeNode', { in: 'o' }, mg);
      svgEl('feMergeNode', { in: 'SourceGraphic' }, mg);
      return p;
    }

    function buildSegment(parent, wb, wt, len, kind, imgUrl) {
      const g = svgEl('g', { class: 'seg' }, parent);
      const out = { g, len, nail: null, shade: null, image: null };
      if (imgUrl) {
        out.image = svgEl('image', { x: -wb / 2, y: -len, width: wb, height: len, preserveAspectRatio: 'none', href: resolveUrl(imgUrl) }, g);
        return out;
      }
      svgEl('path', { class: 'skin', d: segPath(wb, wt, len) }, g);
      return out;
    }

    function buildHand(side) {
      const g = svgEl('g', { class: 'hand hand-' + side, 'data-hand': side }, svg);
      const h = { side, g, palmPath: null, shift: { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0 }, fingers: {}, thumb: null, handImage: null };
      const inner = svgEl('g', { class: 'hand-inner' }, g);
      h.inner = inner;
      if (images.cfg && images.cfg.mode === 'per-hand') {
        h.handImage = svgEl('image', { class: 'hand-image', preserveAspectRatio: 'xMidYMid meet', href: resolveUrl(images.cfg.hands[side === 'L' ? 'left' : 'right']) }, inner);
      } else {
        g.setAttribute('filter', 'url(#' + st.pid + 'O)');
        h.palmPath = svgEl('path', { class: 'skin palm-skin' }, inner); // paume et poignet : une seule forme lisse
      }
      // pouce (deux segments), puis les quatre doigts par-dessus
      const useSeg = images.cfg && images.cfg.mode === 'per-segment';
      const thumbImgs = useSeg && images.cfg.segments['thumb-' + side];
      const tg = svgEl('g', { class: 'finger thumb', 'data-f': 'TH-' + side }, inner);
      if (!h.handImage) tg.setAttribute('filter', 'url(#' + st.pid + 'O)'); // le pouce est cerclé d'un contour fin, même sur la paume
      tg.style.setProperty('--fc', DD.Layout.FINGERS.TH.color);
      const T = M.THUMB;
      const TW1 = T.w1 * 0.74;
      const plainThumb = !h.handImage && !useSeg;
      h.thumb = {
        g: tg,
        spec: T,
        // sans images : un pouce = une forme arrondie et courte (comme sur la capture), de la base au bout
        shape: plainThumb ? svgEl('path', { class: 'skin thumb-skin' }, tg) : null,
        segs: h.handImage || plainThumb
          ? []
          : [buildSegment(tg, TW1, TW1 * 0.92, T.l1, 'first', thumbImgs && thumbImgs[0]), buildSegment(tg, TW1 * 0.92, TW1 * 0.78, T.l2, 'thumb-last', thumbImgs && thumbImgs[1])],
        tip: { x: 0, y: 0, vx: 0, vy: 0 },
        tgt: { x: 0, y: 0 },
        base: { x: 0, y: 0 },
        home: { x: 0, y: 0 },
        active: null,
        press: 0,
        shake: 0,
        halo: svgEl('circle', { class: 'halo', r: 0.5, cx: 0, cy: 0 }, inner),
        nail: null,
      };
      const codes = side === 'L' ? ['LP', 'LR', 'LM', 'LI'] : ['RI', 'RM', 'RR', 'RP'];
      codes.forEach((code) => {
        const spec = M.SPEC[code];
        const W = spec.width * WSCALE;
        const fg = svgEl('g', { class: 'finger', 'data-f': code }, inner);
        const imgs = useSeg && images.cfg.segments[code];
        // les deux premières phalanges dépassent un peu sous la suivante : aucune jointure ne laisse de vide
        const segs = h.handImage ? [] : [0, 1, 2].map((i) => buildSegment(fg, W * WF[i], W * WF[i + 1], spec.len * spec.seg[i] + (i < 2 ? OVERLAP * W : 0), i === 0 ? 'first' : i === 2 ? 'last' : 'mid', imgs && imgs[i]));
        fg.style.setProperty('--fc', DD.Layout.FINGERS[code].color);
        const cap = h.handImage || imgs ? null : svgEl('circle', { class: 'skin cap', r: (W * WF[3]) / 2 }, fg);
        const halo = svgEl('circle', { class: 'halo', r: 0.5, cx: 0, cy: 0, style: 'fill:' + DD.Layout.FINGERS[code].color }, fg);
        h.fingers[code] = { code, side, spec, g: fg, segs, cap, nail: null, halo, mcp: { x: 0, y: 0 }, home: { x: 0, y: 0 }, tip: { x: 0, y: 0, vx: 0, vy: 0 }, tgt: { x: 0, y: 0 }, active: null, press: 0, shake: 0 };
      });
      return h;
    }

    function build() {
      layer.innerHTML = '';
      svg = svgEl('svg', { class: 'hands-svg', preserveAspectRatio: 'xMinYMin meet', focusable: 'false' }, layer);
      st.pid = buildDefs();
      st.hands.L = buildHand('L');
      st.hands.R = buildHand('R');
      st.ready = false;
      applyTint();
      relayout();
    }

    function applyTint() {
      const t = TINTS[cfg.tint];
      layer.style.setProperty('--hand-fill', t.fill);
      layer.style.setProperty('--hand-line', t.line);
      layer.style.opacity = String(cfg.opacity);
      layer.classList.toggle('lite', perfLevel >= 1);
      layer.hidden = !cfg.visible;
    }

    // ---- Placement d'après les positions réelles des touches ----------------------------------------------------------------
    function relayout() {
      if (st.destroyed || !svg) return;
      const r = root.getBoundingClientRect();
      const cellF = byId.f && byId.f.parentElement && byId.f.parentElement.getBoundingClientRect();
      if (!r.width || !cellF || !cellF.width) {
        st.ready = false;
        return;
      }
      const u = cellF.width; // 1 unité = la largeur d'une touche
      st.u = u;
      const extra = EXTRA_U * u;
      layer.style.height = r.height + extra + 'px';
      root.style.marginBottom = extra + 'px'; // réserve la place des paumes sous le clavier
      st.totalH = (r.height + extra) / u;
      if (st.morph) st.morph.setAttribute('radius', (1.3 / u).toFixed(4)); // contour d'environ 1,3 px
      svg.setAttribute('viewBox', '0 0 ' + r.width / u + ' ' + (r.height + extra) / u);
      svg.setAttribute('width', r.width);
      svg.setAttribute('height', r.height + extra);
      // centre de chaque touche, en unités
      st.keyPos = {};
      Object.keys(byId).forEach((id) => {
        const c = byId[id].parentElement.getBoundingClientRect();
        st.keyPos[id] = { x: (c.left - r.left + c.width / 2) / u, y: (c.top - r.top + c.height / 2) / u };
      });
      const home = {};
      M.FINGERS.forEach((f) => (home[f] = st.keyPos[M.HOME_KEY[f]]));
      st.rest = M.restLayout(home, st.keyPos.Space);
      ['L', 'R'].forEach((side) => placeHand(st.hands[side]));
      st.ready = true;
      applyTargets();
      drawAll();
      kick();
    }

    function placeHand(h) {
      const side = h.side;
      const codes = side === 'L' ? ['LP', 'LR', 'LM', 'LI'] : ['RI', 'RM', 'RR', 'RP'];
      codes.forEach((code) => {
        const F = h.fingers[code];
        const R = st.rest.fingers[code];
        F.mcp = { x: R.mcp.x, y: R.mcp.y };
        F.home = { x: R.tipHome.x, y: R.tipHome.y };
      });
      const T = st.rest.thumbs[side];
      h.thumb.base = { x: T.base.x, y: T.base.y };
      h.thumb.home = { x: T.tipRest.x, y: T.tipRest.y };
      // Paume : part des articulations des doigts, s'élargit côté pouce, descend sous le clavier et finit par un poignet arrondi.
      const ms = codes.map((c) => h.fingers[c].mcp);
      const avgY = ms.reduce((q, p) => q + p.y, 0) / 4;
      const sgn = side === 'L' ? 1 : -1; // le pouce est du côté de l'index : à droite pour la main gauche
      const ordered = side === 'L' ? ms : ms.slice().reverse(); // de l'auriculaire vers l'index
      const o = ordered[0].x; // côté auriculaire
      const span = Math.abs(ordered[3].x - o);
      const yB = Math.max(avgY + 3, (st.totalH || 0) - 0.14); // bas du poignet : tout en bas de la zone libre sous le clavier
      const Hh = yB - avgY;
      const P = (dx, fy) => ({ x: o + sgn * dx, y: avgY + Hh * fy });
      const pts = [P(-0.42, 0.02), ...ordered.map((m) => ({ x: m.x, y: m.y - 0.2 })), P(span + 0.46, 0.04), P(span + 1.0, 0.3), P(span + 0.92, 0.62), P(span + 0.42, 0.9), P(span / 2 + 0.1, 1.0), P(-0.2, 0.92), P(-0.66, 0.62), P(-0.62, 0.3)];
      if (h.palmPath) h.palmPath.setAttribute('d', closedSpline(pts));
      if (h.handImage) {
        const c = images.cfg;
        const w = (c.hands.width || 6) * (c.hands.scale || 1);
        const aspect = c.hands.aspect || 1;
        const ax = (c.hands.anchor && c.hands.anchor[0]) != null ? c.hands.anchor[0] : 0.5;
        const ay = (c.hands.anchor && c.hands.anchor[1]) != null ? c.hands.anchor[1] : 0.4;
        const cx = (first.x + last.x) / 2;
        h.handImage.setAttribute('width', w);
        h.handImage.setAttribute('height', w / aspect);
        h.handImage.setAttribute('x', cx - ax * w);
        h.handImage.setAttribute('y', h.fingers[codes[1]].home.y - ay * (w / aspect));
      }
      // repos : bouts sur les touches de repos, pouces sur la barre d'espace
      codes.forEach((code) => {
        const F = h.fingers[code];
        F.tip.x = F.tgt.x = F.home.x;
        F.tip.y = F.tgt.y = F.home.y;
        F.tip.vx = F.tip.vy = 0;
      });
      h.thumb.tip.x = h.thumb.tgt.x = h.thumb.home.x;
      h.thumb.tip.y = h.thumb.tgt.y = h.thumb.home.y;
      h.shift.x = h.shift.y = h.shift.tx = h.shift.ty = 0;
    }

    // ---- Dessin d'une image (appelé à chaque image de l'animation) -----------------------------------------------------------
    function drawFinger(F, h) {
      const spec = F.spec;
      let tx = F.tip.x;
      let ty = F.tip.y;
      // appui : le bout s'enfonce ; erreur : petite secousse latérale
      if (F.press > 0) ty += DIP * F.press;
      if (F.shake > 0) tx += Math.sin(F.shake * 28) * SHAKE * F.shake;
      const pose = M.fingerPose(spec, F.mcp, { x: tx, y: ty });
      F.g.setAttribute('transform', 'translate(' + F.mcp.x.toFixed(4) + ' ' + F.mcp.y.toFixed(4) + ') rotate(' + ((pose.psi * 180) / Math.PI).toFixed(3) + ')');
      let off = 0;
      for (let i = 0; i < 3; i++) {
        const full = spec.len * spec.seg[i];
        let s = pose.proj[i] / full; // cosinus de l'angle de flexion : la phalange paraît plus courte
        if (Math.abs(s) < 0.05) s = s < 0 ? -0.05 : 0.05;
        const seg = F.segs[i];
        seg.g.setAttribute('transform', 'translate(0 ' + (-off).toFixed(4) + ') scale(1 ' + s.toFixed(4) + ')');
        if (seg.shade) seg.shade.setAttribute('opacity', (0.38 * (1 - Math.abs(s))).toFixed(3));
        off += pose.proj[i];
      }
      F.halo.setAttribute('cy', (-pose.distance).toFixed(4));
      if (F.cap) F.cap.setAttribute('cy', (-pose.distance + (spec.width * WSCALE * WF[3]) / 2 * 0.2).toFixed(4));
    }

    function drawThumb(T, h) {
      let tx = T.tip.x;
      let ty = T.tip.y;
      if (T.press > 0) ty += DIP * 1.2 * T.press;
      if (T.shake > 0) tx += Math.sin(T.shake * 28) * SHAKE * T.shake;
      if (T.shape) {
        const dx = tx - T.base.x;
        const dy = ty - T.base.y;
        const L = Math.max(0.4, Math.hypot(dx, dy));
        const r = THUMB_W / 2;
        T.shape.setAttribute('transform', 'translate(' + T.base.x.toFixed(4) + ' ' + T.base.y.toFixed(4) + ') rotate(' + ((Math.atan2(dx, -dy) * 180) / Math.PI).toFixed(3) + ')');
        T.shape.setAttribute('d', 'M ' + -r + ' 0 L ' + -r + ' ' + -L.toFixed(4) + ' A ' + r + ' ' + r + ' 0 0 1 ' + r + ' ' + -L.toFixed(4) + ' L ' + r + ' 0 A ' + r + ' ' + r + ' 0 0 1 ' + -r + ' 0 Z');
        T.halo.setAttribute('cx', tx.toFixed(4));
        T.halo.setAttribute('cy', ty.toFixed(4));
        return;
      }
      const pose = M.thumbPose(T.base, { x: tx, y: ty }, h.side);
      const deg = (a) => ((a * 180) / Math.PI).toFixed(3);
      T.segs[0].g.setAttribute('transform', 'translate(' + T.base.x.toFixed(4) + ' ' + T.base.y.toFixed(4) + ') rotate(' + deg(pose.a1) + ')');
      T.segs[1].g.setAttribute('transform', 'translate(' + pose.p1.x.toFixed(4) + ' ' + pose.p1.y.toFixed(4) + ') rotate(' + deg(pose.a2) + ')');
      T.halo.setAttribute('cx', pose.tip.x.toFixed(4));
      T.halo.setAttribute('cy', pose.tip.y.toFixed(4));
    }

    function drawHand(h) {
      h.g.setAttribute('transform', 'translate(' + h.shift.x.toFixed(4) + ' ' + h.shift.y.toFixed(4) + ')');
      if (h.handImage) {
        // mode « une image par main » : l'image suit légèrement le doigt actif
        const act = Object.values(h.fingers).find((F) => F.active);
        const dx = act ? (act.tip.x - act.home.x) * 0.5 : 0;
        const dy = act ? (act.tip.y - act.home.y) * 0.5 : 0;
        h.inner.setAttribute('transform', 'translate(' + dx.toFixed(4) + ' ' + dy.toFixed(4) + ')');
        Object.values(h.fingers).forEach((F) => {
          F.halo.setAttribute('cx', F.tip.x - F.mcp.x);
          F.halo.setAttribute('cy', F.tip.y - F.mcp.y);
        });
        return;
      }
      Object.values(h.fingers).forEach((F) => drawFinger(F, h));
      drawThumb(h.thumb, h);
    }
    function drawAll() {
      if (!st.ready) return;
      drawHand(st.hands.L);
      drawHand(st.hands.R);
    }

    // ---- Cibles ------------------------------------------------------------------------------------------------------------------
    const motion = (id) => M.motionFor(layoutDef, id, geom);
    const inert = () => reduced() || perfLevel >= 2; // mains fixes : le doigt est seulement surligné

    function clearActive() {
      if (!st.ready) return; // la mise en page n'est pas encore calculée : rien à repositionner
      ['L', 'R'].forEach((side) => {
        const h = st.hands[side];
        h.shift.tx = h.shift.ty = 0;
        Object.values(h.fingers).forEach((F) => {
          F.active = null;
          F.tgt.x = F.home.x;
          F.tgt.y = F.home.y;
        });
        h.thumb.active = null;
        h.thumb.tgt.x = h.thumb.home.x;
        h.thumb.tgt.y = h.thumb.home.y;
      });
      st.hlEls.forEach((e) => e.classList.remove('hl'));
      st.hlEls = [];
      layer.classList.remove('has-active');
    }

    // Envoie le doigt qui doit taper chaque touche de la liste vers cette touche.
    function activateKeys(ids) {
      if (!st.ready) return [];
      const used = [];
      ids.forEach((id) => {
        const m = motion(id);
        const kp = st.keyPos[id];
        if (!m || !kp) return;
        if (m.finger === 'TH') {
          const side = M.thumbFor(id, st.lastHand, layoutDef);
          const T = st.hands[side].thumb;
          T.active = id;
          // espace : le pouce reste au-dessus de la barre (il s'enfonce seulement) ; AltGr : il va jusqu'à la touche
          if (id === 'Space') {
            T.tgt.x = T.home.x;
            T.tgt.y = T.home.y;
          } else {
            T.tgt.x = kp.x - st.hands[side].shift.tx;
            T.tgt.y = kp.y - st.hands[side].shift.ty;
          }
          used.push({ el: T.g, f: T, id });
        } else {
          const h = st.hands[m.hand];
          const F = h.fingers[m.finger];
          F.active = id;
          const sh = M.handShift(F.spec, F.mcp, kp); // trop loin ? la main avance juste ce qu'il faut
          h.shift.tx = sh.x;
          h.shift.ty = sh.y;
          F.tgt.x = kp.x - sh.x;
          F.tgt.y = kp.y - sh.y;
          st.lastHand = m.hand;
          used.push({ el: F.g, f: F, id });
        }
      });
      used.forEach((u) => {
        u.el.classList.add('hl');
        st.hlEls.push(u.el);
      });
      layer.classList.toggle('has-active', used.length > 0);
      if (inert()) snapRest();
      kick();
      return used;
    }

    // Mains fixes (mouvement réduit) : on ne déplace rien, on garde seulement le doigt surligné.
    function snapRest() {
      ['L', 'R'].forEach((side) => {
        const h = st.hands[side];
        h.shift.x = h.shift.y = h.shift.tx = h.shift.ty = 0;
        Object.values(h.fingers).forEach((F) => {
          F.tip.x = F.tgt.x = F.home.x;
          F.tip.y = F.tgt.y = F.home.y;
          F.tip.vx = F.tip.vy = 0;
        });
        h.thumb.tip.x = h.thumb.tgt.x = h.thumb.home.x;
        h.thumb.tip.y = h.thumb.tgt.y = h.thumb.home.y;
      });
      drawAll();
    }

    function applyTargets() {
      // après un recalcul de la mise en page : on remet les cibles courantes
      const ids = st.curIds.slice();
      clearActive();
      if (st.demo && st.demo.keys) activateKeys(st.demo.keys);
      else if (ids.length) {
        const plan = M.planForKeys(ids);
        activateKeys(plan.mode === 'sequence' ? plan.steps[1] : plan.steps[0] || []);
      }
    }

    function later(fn, ms) {
      const t = setTimeout(() => {
        st.timers.delete(t);
        if (!st.destroyed) fn();
      }, ms);
      st.timers.add(t);
      return t;
    }
    function clearTimers() {
      st.timers.forEach(clearTimeout);
      st.timers.clear();
    }

    // ---- Boucle d'animation --------------------------------------------------------------------------------------------------------
    function kick() {
      if (st.raf || st.destroyed || !st.ready || !cfg.visible || inert()) return;
      st.last = 0;
      st.raf = requestAnimationFrame(frame);
    }

    function stepFinger(F, dt, w) {
      let moving = false;
      let r = spring(F.tip.x, F.tip.vx, F.tgt.x, w, dt);
      F.tip.x = r[0];
      F.tip.vx = r[1];
      r = spring(F.tip.y, F.tip.vy, F.tgt.y, w, dt);
      F.tip.y = r[0];
      F.tip.vy = r[1];
      if (Math.abs(F.tip.x - F.tgt.x) > 0.003 || Math.abs(F.tip.y - F.tgt.y) > 0.003 || Math.abs(F.tip.vx) > 0.04 || Math.abs(F.tip.vy) > 0.04) moving = true;
      if (F.press > 0) {
        F.press = Math.max(0, F.press - dt / 0.14);
        moving = true;
      }
      if (F.shake > 0) {
        F.shake = Math.max(0, F.shake - dt / 0.32);
        moving = true;
      }
      return moving;
    }

    // Avance toute l'animation de dt secondes ; renvoie true tant que quelque chose bouge encore.
    function step(dt) {
      const w = st.omega * (perfLevel >= 1 ? 1.35 : 1);
      let moving = false;
      ['L', 'R'].forEach((side) => {
        const h = st.hands[side];
        // la main avance avec le doigt (un peu plus doucement)
        let r = spring(h.shift.x, h.shift.vx, h.shift.tx, w * 0.85, dt);
        h.shift.x = r[0];
        h.shift.vx = r[1];
        r = spring(h.shift.y, h.shift.vy, h.shift.ty, w * 0.85, dt);
        h.shift.y = r[0];
        h.shift.vy = r[1];
        if (Math.abs(h.shift.x - h.shift.tx) > 0.003 || Math.abs(h.shift.y - h.shift.ty) > 0.003 || Math.abs(h.shift.vx) > 0.04 || Math.abs(h.shift.vy) > 0.04) moving = true;
        Object.values(h.fingers).forEach((F) => {
          if (stepFinger(F, dt, w)) moving = true;
        });
        if (stepFinger(h.thumb, dt, w)) moving = true;
      });
      return moving;
    }

    function frame(ts) {
      st.raf = 0;
      if (st.destroyed || !st.ready) return;
      const dt = st.last ? Math.min(0.05, (ts - st.last) / 1000) : 1 / 60;
      const slow = ts - st.last > 0 && st.last ? ts - st.last : 0;
      st.last = ts;
      const moving = step(dt);
      drawAll();
      governor(slow);
      if (moving) st.raf = requestAnimationFrame(frame);
    }

    // Va jusqu'au bout de l'animation tout de suite (utile aux vérifications automatiques et au mode « mains fixes »).
    function settle() {
      if (!st.ready) return;
      for (let i = 0; i < 600; i++) if (!step(1 / 60)) break;
      drawAll();
    }

    // Si la machine est lente, on simplifie : d'abord sans ombres, puis sans animation.
    function governor(ms) {
      if (!ms || ms > 250) return;
      st.frames++;
      st.acc += ms;
      if (st.frames >= 45) {
        const avg = st.acc / st.frames;
        st.frames = 0;
        st.acc = 0;
        if (avg > 52 && perfLevel < 2) perfLevel = 2;
        else if (avg > 34 && perfLevel < 1) perfLevel = 1;
        else return;
        layer.classList.toggle('lite', perfLevel >= 1);
        if (perfLevel >= 2) snapRest();
      }
    }

    // ---- API --------------------------------------------------------------------------------------------------------------------
    // Les doigts à utiliser pour la prochaine frappe (null ou [] : retour à la position de repos).
    function target(ids) {
      st.curIds = (ids || []).slice();
      clearTimers();
      if (!st.ready) relayout(); // le clavier vient d'être déplacé ou affiché : on recalcule tout de suite
      if (!st.ready) return; // clavier pas encore affiché : la cible est gardée et appliquée dès que la mise en page est prête
      clearActive();
      const plan = M.planForKeys(st.curIds);
      if (plan.mode === 'none') {
        kick();
        return;
      }
      if (plan.mode === 'sequence') {
        // touche morte : d'abord ^ (auriculaire droit), puis la voyelle : les deux mouvements s'enchaînent
        activateKeys(plan.steps[0]);
        later(() => {
          pressKeys(plan.steps[0]);
          later(() => {
            clearActive();
            activateKeys(plan.steps[1]);
          }, 130);
        }, 260);
      } else activateKeys(plan.steps[0]);
    }

    // Appui : le doigt et la touche s'enfoncent légèrement
    function pressKeys(ids) {
      ids.forEach((id) => {
        const m = motion(id);
        if (!m) return;
        const part = m.finger === 'TH' ? st.hands[M.thumbFor(id, st.lastHand, layoutDef)].thumb : st.hands[m.hand].fingers[m.finger];
        part.press = 1;
        if (kb.pressKey) kb.pressKey(id);
      });
      kick();
    }

    // Retour de la frappe : touche juste -> appui ; touche fausse -> rien de plus que le clignotement de la touche
    function feedback(id, kind) {
      if (!st.ready) relayout();
      if (!st.ready || kind === 'bad') return;
      const m = motion(id);
      if (!m) return;
      if (st.curIds.includes(id)) {
        // le doigt attendu est déjà en route : on le fait appuyer (et Maj / AltGr en même temps)
        pressKeys(st.curIds.filter((k) => M.MODIFIERS.includes(k)).concat([id]));
        return;
      }
      // pas d'indication en cours (tests) : le doigt va à la touche, appuie, puis revient
      const used = activateKeys([id]);
      if (!used.length) return;
      later(() => pressKeys([id]), 60);
      later(() => {
        if (!st.curIds.length) clearActive();
        else applyTargets();
      }, 230);
    }

    // Erreur : légère secousse du doigt attendu + éclat rouge discret sur la touche attendue
    function error() {
      if (!st.ready) return;
      const ids = st.curIds.length ? (M.planForKeys(st.curIds).mode === 'sequence' ? M.planForKeys(st.curIds).steps[1] : st.curIds) : [];
      ids.forEach((id) => {
        const m = motion(id);
        if (!m) return;
        const part = m.finger === 'TH' ? st.hands[M.thumbFor(id, st.lastHand, layoutDef)].thumb : st.hands[m.hand].fingers[m.finger];
        if (!inert()) part.shake = 1;
        const k = byId[id];
        if (k) {
          k.classList.remove('err-burst');
          void k.offsetWidth;
          k.classList.add('err-burst');
          later(() => k.classList.remove('err-burst'), 480);
        }
      });
      kick();
    }

    function rest() {
      target([]);
    }

    // Tuto : le doigt va à la touche, appuie, puis revient à sa place.
    function show(ids, hold) {
      target(ids);
      later(() => pressKeys(M.planForKeys(ids).steps[0] || []), 300);
      later(rest, hold || 1300);
    }

    // Met en avant des doigts (ex. les doigts d'un module) : les autres s'estompent.
    function highlight(set) {
      st.hl = set || null;
      layer.querySelectorAll('.finger').forEach((e) => {
        const code = e.getAttribute('data-f');
        const on = !set || set.has(code.indexOf('TH') === 0 ? 'TH' : code);
        e.classList.toggle('dim', !!set && !on);
        e.classList.toggle('mark', !!set && on);
      });
    }

    // ---- Démonstration : les mains tapent seules le texte ---------------------------------------------------------------------
    // o = { speed: 'lent' | 'normal', onChar(i, ch, 'start' | 'done'), onEnd(completed) }
    function demo(text, o) {
      o = o || {};
      const chars = Array.from(text);
      const slow = o.speed === 'lent';
      const t = slow ? { move: 520, press: 300, gap: 120 } : { move: 230, press: 130, gap: 40 };
      const prevOmega = st.omega;
      st.omega = slow ? OMEGA.lent : OMEGA.normal;
      let i = 0;
      let stopped = false;
      clearTimers();
      clearActive();
      st.curIds = [];
      const handle = {
        keys: null,
        stop(silent) {
          if (stopped) return;
          stopped = true;
          clearTimers();
          st.omega = prevOmega;
          st.demo = null;
          clearActive();
          if (kb.setNext) kb.setNext([], { quiet: true });
          if (!silent && o.onEnd) o.onEnd(i >= chars.length);
        },
      };
      st.demo = handle;
      function nextChar() {
        if (stopped) return;
        if (i >= chars.length) return handle.stop();
        const ch = chars[i];
        const plan = M.planFor(layoutDef, ch);
        if (!plan) {
          i++;
          return nextChar();
        }
        if (o.onChar) o.onChar(i, ch, 'start');
        let s = 0;
        const runStep = () => {
          if (stopped) return;
          if (s >= plan.steps.length) {
            if (o.onChar) o.onChar(i, ch, 'done');
            i++;
            later(nextChar, t.gap);
            return;
          }
          const keys = plan.steps[s];
          clearActive();
          handle.keys = keys;
          if (kb.setNext) kb.setNext(keys, { quiet: true });
          activateKeys(keys);
          later(() => {
            pressKeys(keys);
            if (kb.flash) kb.flash(keys[keys.length - 1], 'ok');
            later(() => {
              s++;
              runStep();
            }, t.press);
          }, t.move);
        };
        runStep();
      }
      nextChar();
      return handle;
    }

    function setOptions(o) {
      Object.assign(cfg, o);
      if (o.speed && OMEGA[o.speed]) st.omega = OMEGA[o.speed];
      applyTint();
    }

    // Positions actuelles des bouts (en pixels, par rapport au clavier) : sert aux vérifications automatiques.
    function tips() {
      const out = {};
      if (!st.ready) return out;
      ['L', 'R'].forEach((side) => {
        const h = st.hands[side];
        Object.values(h.fingers).forEach((F) => {
          out[F.code] = { x: (F.tip.x + h.shift.x) * st.u, y: (F.tip.y + h.shift.y) * st.u, active: F.active };
        });
        out['TH-' + side] = { x: (h.thumb.tip.x + h.shift.x) * st.u, y: (h.thumb.tip.y + h.shift.y) * st.u, active: h.thumb.active };
      });
      return out;
    }
    function keyCenter(id) {
      const p = st.keyPos[id];
      return p ? { x: p.x * st.u, y: p.y * st.u } : null;
    }

    function destroy() {
      st.destroyed = true;
      clearTimers();
      cancelAnimationFrame(st.raf);
      if (ro) ro.disconnect();
      images.listeners = images.listeners.filter((f) => f !== onImages);
      layer.remove();
      root.classList.remove('with-hands');
      root.style.marginBottom = '';
    }

    // ---- Mise en route ---------------------------------------------------------------------------------------------------------------
    const onImages = () => {
      if (!st.destroyed) build();
    };
    images.listeners.push(onImages);
    build();
    let ro = null;
    if (typeof ResizeObserver === 'function') {
      let pending = 0;
      ro = new ResizeObserver(() => {
        if (pending) return;
        pending = requestAnimationFrame(() => {
          pending = 0;
          relayout();
        });
      });
      ro.observe(root);
    } else window.addEventListener('resize', relayout);
    // Filet de sécurité : si le clavier est ajouté à la page après coup, ou si les polices changent sa taille,
    // on recalcule sans dépendre uniquement de l'observateur de taille.
    // (minuteurs à part : target() annule les minuteurs d'animation, pas ceux-là)
    setTimeout(() => !st.destroyed && relayout(), 30);
    setTimeout(() => !st.destroyed && relayout(), 250);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => !st.destroyed && relayout());

    const api = { target, feedback, error, rest, show, highlight, demo, pressKeys, setOptions, relayout, settle, draw: drawAll, tips, keyCenter, destroy, root: layer, isInert: inert, state: st };
    DD.Hands.last = api; // dernier clavier créé : sert aux vérifications automatiques dans le navigateur
    return api;
  }

  /**
   * Barre « Voir la démo » (bouton + vitesse lente / normale). Les mains tapent seules le texte donné par o.text().
   * o = { text(), canStart(), onStart(), onChar(i, ch, phase), onEnd() }.
   */
  function demoBar(kb, o) {
    const wrap = document.createElement('span');
    wrap.className = 'demo-bar';
    wrap.innerHTML = '<button type="button" class="btn small ghost demo-go">Voir la démo</button><select class="demo-speed" aria-label="Vitesse de la démo"><option value="lent">Démo lente</option><option value="normal">Démo normale</option></select>';
    const btn = wrap.querySelector('.demo-go');
    const sel = wrap.querySelector('.demo-speed');
    sel.value = (DD.Store.state.settings.demoSpeed === 'lent') ? 'lent' : 'normal';
    let handle = null;
    function stop() {
      if (!handle) return;
      const h = handle;
      handle = null;
      h.stop(true);
      btn.textContent = 'Voir la démo';
      kb.setHandsVisible(DD.Store.state.settings.showHands !== false); // on remet l'affichage choisi dans les réglages
      if (o.onEnd) o.onEnd();
    }
    function start() {
      if (o.canStart && !o.canStart()) return;
      kb.setHandsVisible(true); // la démo montre les mains même si elles sont masquées d'habitude
      if (!kb.hands) return;
      if (o.onStart) o.onStart();
      btn.textContent = 'Arrêter la démo';
      handle = kb.hands.demo(o.text(), { speed: sel.value, onChar: o.onChar, onEnd: () => stop() });
    }
    btn.onclick = () => {
      if (handle) stop();
      else start();
      btn.blur();
    };
    sel.onchange = () => {
      DD.Store.state.settings.demoSpeed = sel.value;
      DD.Store.save();
      sel.blur();
    };
    return { el: wrap, stop, running: () => !!handle, setEnabled: (on) => ((btn.disabled = !on), (btn.title = on ? '' : 'La démo est disponible avant de commencer.')) };
  }

  DD.Hands = { attach, demoBar, settings, setPerf: (n) => (perfLevel = n), getPerf: () => perfLevel, TINTS, TINT_NAMES, OMEGA, useImages, loadImageConfig, images, EXTRA_U };
})();
