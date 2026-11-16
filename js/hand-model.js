/*
 * Modèle des mains — module PUR (aucun accès au navigateur), donc testable avec Node.
 * Il répond à trois questions :
 *   1. Pour une touche : quel doigt, et quel genre de mouvement ? (motionFor)
 *   2. Pour un doigt à trois phalanges : quels angles pour que le bout arrive au centre de la touche ? (fingerPose)
 *   3. Pour le pouce (deux segments) : même question. (thumbPose)
 *
 * Toutes les longueurs sont en « touches » (1 unité = la largeur d'une touche) ; l'axe y descend vers l'utilisateur.
 * Le dessin (hands.js) convertit ces unités en pixels à partir des positions réelles des touches dans la page.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && root.DD) root.DD.HandModel = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const FINGERS = ['LP', 'LR', 'LM', 'LI', 'RI', 'RM', 'RR', 'RP'];
  const HOME_KEY = { LP: 'q', LR: 's', LM: 'd', LI: 'f', RI: 'j', RM: 'k', RR: 'l', RP: 'm' };
  const KINDS = ['home', 'up', 'down', 'number', 'lateral', 'far', 'thumb'];
  const MODIFIERS = ['ShiftL', 'ShiftR', 'AltGr'];
  const SEG = [0.46, 0.31, 0.23]; // part de la longueur : phalange proximale, moyenne, distale

  // Doigts : longueur (de l'articulation de la base au bout, doigt tendu), largeur, léger écartement au repos.
  const SPEC = {
    LP: { len: 3.7, width: 0.8, fan: -0.09 },
    LR: { len: 4.6, width: 0.9, fan: -0.04 },
    LM: { len: 5.0, width: 0.94, fan: 0 },
    LI: { len: 4.6, width: 0.94, fan: 0.1 },
    RI: { len: 4.6, width: 0.94, fan: -0.1 },
    RM: { len: 5.0, width: 0.94, fan: 0 },
    RR: { len: 4.6, width: 0.9, fan: 0.04 },
    RP: { len: 3.7, width: 0.8, fan: 0.09 },
  };
  Object.values(SPEC).forEach((s) => (s.seg = SEG));
  const THUMB = { l1: 2.5, l2: 1.9, w1: 1.08, w2: 0.98 };

  const FLEX = [75, 85, 55]; // degrés de flexion ajoutés par phalange quand le doigt est entièrement replié
  const C_MAX = 0.62; // repli maximal utile (au-delà, le bout passerait derrière l'articulation)
  const REST_RATIO = 0.44; // au repos, le bout est à 56 % de la longueur du doigt : le doigt est arrondi, prêt à s'étendre
  const SHIFT_FROM = 0.94; // au-delà de 94 % de la longueur, la main avance un peu avec le doigt

  const rad = (d) => (d * Math.PI) / 180;
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const sum = (a) => a.reduce((s, x) => s + x, 0);

  // ---- Un doigt : angles de flexion selon le repli c (0 = tendu, C_MAX = très replié) ---------------------------
  function angles(c) {
    const a1 = c * FLEX[0];
    const a2 = a1 + c * FLEX[1];
    const a3 = a2 + c * FLEX[2];
    return [a1, a2, a3]; // angles cumulés, en degrés
  }
  // Longueurs vues de dessus : un segment fléchi paraît plus court (cosinus de son angle cumulé).
  function projections(spec, c) {
    const a = angles(c);
    return spec.seg.map((r, i) => r * spec.len * Math.cos(rad(a[i])));
  }
  const reach = (spec, c) => sum(projections(spec, c));

  // Quel repli donne une distance d entre la base du doigt et son bout ?
  function solveCurl(spec, d) {
    const L = spec.len;
    const minR = reach(spec, C_MAX);
    if (d >= L) return { c: 0, excess: d - L, deficit: 0 };
    if (d <= minR) return { c: C_MAX, excess: 0, deficit: minR - d };
    let lo = 0;
    let hi = C_MAX;
    for (let i = 0; i < 50; i++) {
      const mid = (lo + hi) / 2;
      if (reach(spec, mid) > d) lo = mid;
      else hi = mid;
    }
    return { c: (lo + hi) / 2, excess: 0, deficit: 0 };
  }
  const restCurl = (spec) => solveCurl(spec, REST_RATIO * spec.len).c;

  /**
   * Pose d'un doigt dont la base est en mcp et dont le bout doit arriver en tip.
   * psi : écart latéral (radians, depuis la verticale, positif vers la droite) ; curl : repli ;
   * proj : longueurs vues de dessus des trois segments ; excess/deficit : > 0 si la touche est hors d'atteinte.
   */
  function fingerPose(spec, mcp, tip) {
    const dx = tip.x - mcp.x;
    const dy = mcp.y - tip.y; // > 0 : la touche est plus loin que la base (vers l'écran)
    const d = Math.hypot(dx, dy);
    const psi = d < 1e-9 ? 0 : Math.atan2(dx, dy);
    const s = solveCurl(spec, d);
    const proj = projections(spec, s.c);
    const got = sum(proj);
    return {
      psi,
      curl: s.c,
      angles: angles(s.c),
      proj,
      distance: d,
      excess: s.excess,
      deficit: s.deficit,
      tip: { x: mcp.x + Math.sin(psi) * got, y: mcp.y - Math.cos(psi) * got },
      error: Math.abs(d - got),
    };
  }

  // Si la touche est trop loin, la main avance (ou recule) de ce qu'il faut pour que le doigt l'atteigne.
  function handShift(spec, mcp, tip) {
    const dx = tip.x - mcp.x;
    const dy = tip.y - mcp.y;
    const d = Math.hypot(dx, dy);
    const minR = reach(spec, C_MAX) * 1.15;
    let extra = 0;
    if (d > SHIFT_FROM * spec.len) extra = d - SHIFT_FROM * spec.len;
    else if (d < minR) extra = d - minR;
    if (d < 1e-9 || extra === 0) return { x: 0, y: 0, size: 0 };
    return { x: (dx / d) * extra, y: (dy / d) * extra, size: Math.abs(extra) };
  }

  // ---- Le pouce : deux segments, cinématique inverse dans le plan ------------------------------------------------
  // Le genou du pouce (articulation du milieu) bombe du côté de sa propre paume, à l'opposé de l'autre main :
  // les deux pouces ne se croisent donc pas sous la barre d'espace.
  function thumbPose(base, tip, side) {
    const { l1, l2 } = THUMB;
    const dx = tip.x - base.x;
    const dy = tip.y - base.y;
    const d = Math.hypot(dx, dy);
    const dMax = l1 + l2 - 1e-3;
    const dMin = Math.abs(l1 - l2) + 0.05;
    const dd = clamp(d, dMin, dMax);
    const beta = Math.atan2(dx, -dy); // direction base -> bout (depuis la verticale, sens horaire)
    const A = Math.acos(clamp((l1 * l1 + dd * dd - l2 * l2) / (2 * l1 * dd), -1, 1));
    const a1 = beta + (side === 'L' ? -1 : 1) * A;
    const p1 = { x: base.x + Math.sin(a1) * l1, y: base.y - Math.cos(a1) * l1 };
    const reached = { x: base.x + Math.sin(beta) * dd, y: base.y - Math.cos(beta) * dd };
    const a2 = Math.atan2(reached.x - p1.x, -(reached.y - p1.y));
    return { a1, a2, p1, tip: reached, clamped: d > dMax || d < dMin, error: Math.abs(d - dd) };
  }

  // ---- Les touches --------------------------------------------------------------------------------------------------
  // Centre de chaque touche dans une disposition (layout.rows), en unités de touches.
  function keyGeometry(layoutDef) {
    const geom = {};
    layoutDef.rows.forEach((r, ri) => {
      let x = 0;
      r.forEach((k) => {
        if (!k.spacer) geom[k.id] = { id: k.id, x: x + k.w / 2, y: ri + 0.5, w: k.w, row: ri, finger: k.f, special: !!k.special, dead: !!k.dead };
        x += k.w;
      });
    });
    return geom;
  }

  /**
   * Quel doigt et quel mouvement pour une touche ?
   * kind : home (touche de repos) · up (rangée du haut : le doigt s'étend) · down (rangée du bas : il se replie) ·
   *        number (rangée des chiffres : il s'étend davantage) · lateral (index : déplacement vers G H B N Y U...) ·
   *        far (auriculaire qui s'écarte vers Maj, Entrée...) · thumb (espace, AltGr).
   * rows : rangées au-dessus (+) ou au-dessous (-) de la rangée de repos ; lateral : colonnes d'écart avec la touche de repos.
   */
  function motionFor(layoutDef, id, geom) {
    geom = geom || keyGeometry(layoutDef);
    const g = geom[id];
    if (!g) return null;
    const f = g.finger;
    if (f === 'TH') {
      const key = layoutDef.keys[id];
      return { id, finger: 'TH', hand: 'T', kind: 'thumb', thumb: (key && key.thumb) || 'either', rows: 0, lateral: 0 };
    }
    const home = geom[HOME_KEY[f]];
    const rows = home.y - g.y;
    const lateral = g.x - home.x;
    const index = f === 'LI' || f === 'RI';
    let kind;
    if (rows >= 1.5) kind = 'number';
    else if (index && Math.abs(lateral) >= 0.2) kind = 'lateral';
    else if (!index && Math.abs(lateral) > 1.6) kind = 'far';
    else if (rows > 0.5) kind = 'up';
    else if (rows < -0.5) kind = 'down';
    else kind = 'home';
    return { id, finger: f, hand: f.charAt(0), kind, rows, lateral };
  }

  // Dans quel ordre appuyer ? 'together' : Maj / AltGr tenu en même temps que la touche ; 'sequence' : touche morte
  // (^ puis la voyelle, ou Maj + ^ puis la voyelle : deux étapes) ; 'single' : une seule touche.
  function planForKeys(ids) {
    if (!ids || !ids.length) return { mode: 'none', steps: [] };
    const i = ids.indexOf('^');
    if (i !== -1 && i < ids.length - 1) return { mode: 'sequence', steps: [ids.slice(0, i + 1), ids.slice(i + 1)] };
    if (ids.length > 1 && MODIFIERS.includes(ids[0])) return { mode: 'together', steps: [ids.slice(0, 2)] };
    return { mode: 'single', steps: [[ids[0]]] };
  }
  function planFor(layoutDef, ch) {
    const h = layoutDef.hint(ch);
    return h ? Object.assign(planForKeys(h.keys), { hint: h }) : null;
  }

  // Quel pouce pour la barre d'espace ? Celui de la main qui n'a pas tapé la dernière lettre (AltGr : toujours le droit).
  function thumbFor(id, lastHand, layoutDef) {
    const key = layoutDef && layoutDef.keys && layoutDef.keys[id];
    if (key && key.thumb === 'R') return 'R';
    return lastHand === 'R' ? 'L' : 'R';
  }

  // ---- Position de repos ------------------------------------------------------------------------------------------------
  /**
   * À partir du centre des touches de repos (home : {LP:{x,y}, ...}) et de la barre d'espace, calcule pour chaque doigt
   * la position de sa base (mcp) et, pour chaque pouce, sa base et la position de repos de son bout.
   * Tout est en unités de touches ; l'appelant peut passer des pixels divisés par la largeur d'une touche.
   */
  function restLayout(home, space) {
    const fingers = {};
    FINGERS.forEach((f) => {
      const s = SPEC[f];
      const tip = home[f];
      // base du doigt : exactement à la distance de repos du bout, avec un léger écartement latéral
      const D = REST_RATIO * s.len;
      fingers[f] = { spec: s, tipHome: { x: tip.x, y: tip.y }, mcp: { x: tip.x + s.fan, y: tip.y + Math.sqrt(D * D - s.fan * s.fan) }, curlRest: restCurl(s) };
    });
    const thumbs = {};
    ['L', 'R'].forEach((side) => {
      const idx = fingers[side === 'L' ? 'LI' : 'RI'];
      const avgY = sum(FINGERS.filter((f) => f.charAt(0) === side).map((f) => fingers[f].mcp.y)) / 4;
      const dir = side === 'L' ? 1 : -1; // le pouce est du côté de l'index
      thumbs[side] = {
        base: { x: idx.mcp.x + dir * 0.7, y: avgY + 1.9 },
        tipRest: { x: space.x + (side === 'L' ? -0.6 : 0.6), y: space.y + 0.15 },
      };
    });
    return { fingers, thumbs };
  }

  return {
    FINGERS, HOME_KEY, KINDS, MODIFIERS, SPEC, THUMB, FLEX, C_MAX, REST_RATIO, SHIFT_FROM,
    angles, projections, reach, solveCurl, restCurl, fingerPose, handShift, thumbPose,
    keyGeometry, motionFor, planForKeys, planFor, thumbFor, restLayout,
  };
});
