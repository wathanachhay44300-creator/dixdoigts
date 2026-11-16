// Tests du modèle des mains : doigt et mouvement de chaque touche, cinématique des doigts, Maj / AltGr / touches mortes.
// Lancer : node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../js/hand-model.js');
const { loadSite } = require('./helpers.js');

const DD = loadSite(['util.js', 'store.js', 'layout.js']);
const LAYOUTS = ['mac', 'pc'].map((id) => DD.Layout.get(id));
const allKeys = (layout) => layout.rows.flat().filter((k) => !k.spacer);

function restFor(layout) {
  const geom = M.keyGeometry(layout);
  const home = {};
  M.FINGERS.forEach((f) => (home[f] = { x: geom[M.HOME_KEY[f]].x, y: geom[M.HOME_KEY[f]].y }));
  return { geom, rest: M.restLayout(home, geom.Space) };
}

test('la disposition est cohérente : chaque rangée fait 15 touches de large', () => {
  for (const layout of LAYOUTS) {
    layout.rows.forEach((r, i) => {
      const w = r.reduce((s, k) => s + k.w, 0);
      assert.ok(Math.abs(w - 15) < 1e-9, `${layout.id} rangée ${i} : ${w}`);
    });
  }
});

test('chaque touche de l\'AZERTY (Mac et PC) a un doigt et un mouvement associés', () => {
  for (const layout of LAYOUTS) {
    const geom = M.keyGeometry(layout);
    const keys = allKeys(layout);
    assert.ok(keys.length >= 56, `${layout.id} : ${keys.length} touches`);
    for (const k of keys) {
      const m = M.motionFor(layout, k.id, geom);
      assert.ok(m, `${layout.id} / ${k.id} : pas de mouvement`);
      assert.equal(m.id, k.id);
      assert.ok(M.FINGERS.includes(m.finger) || m.finger === 'TH', `${layout.id} / ${k.id} : doigt inconnu ${m.finger}`);
      assert.equal(m.finger, k.f, `${layout.id} / ${k.id} : le doigt doit être celui de la disposition`);
      assert.ok(M.KINDS.includes(m.kind), `${layout.id} / ${k.id} : mouvement inconnu ${m.kind}`);
      assert.ok(['L', 'R', 'T'].includes(m.hand));
      assert.ok(Number.isFinite(m.rows) && Number.isFinite(m.lateral));
      if (m.finger !== 'TH') assert.equal(m.hand, m.finger.charAt(0));
    }
  }
});

test('touches de repos : F et J pour les index, Q S D et K L M pour les autres doigts', () => {
  assert.deepEqual(Object.assign({}, M.HOME_KEY), { LP: 'q', LR: 's', LM: 'd', LI: 'f', RI: 'j', RM: 'k', RR: 'l', RP: 'm' });
  for (const layout of LAYOUTS) {
    for (const [finger, id] of Object.entries(M.HOME_KEY)) {
      const m = M.motionFor(layout, id);
      assert.equal(m.finger, finger);
      assert.equal(m.kind, 'home', `${layout.id} / ${id}`);
      assert.equal(m.rows, 0);
      assert.equal(m.lateral, 0);
    }
  }
});

test('rangée du haut : le doigt s\'étend ; rangée du bas : il se replie ; chiffres : il s\'étend davantage', () => {
  for (const layout of LAYOUTS) {
    for (const c of 'azertyuiop') {
      const m = M.motionFor(layout, c);
      assert.equal(m.rows, 1, `${layout.id} / ${c} : une rangée au-dessus`);
      assert.ok(m.kind === 'up' || m.kind === 'lateral', `${c} : ${m.kind}`);
    }
    for (const c of 'wxcvbn') {
      const m = M.motionFor(layout, c);
      assert.equal(m.rows, -1, `${layout.id} / ${c} : une rangée en dessous`);
      assert.ok(m.kind === 'down' || m.kind === 'lateral', `${c} : ${m.kind}`);
    }
    // chiffres : touches de la rangée du haut du clavier, deux rangées au-dessus de la rangée de repos
    for (const d of '1234567890') {
      const h = layout.hint(d);
      const m = M.motionFor(layout, h.main);
      assert.equal(m.rows, 2, `${layout.id} / chiffre ${d}`);
      assert.equal(m.kind, 'number');
      assert.equal(h.shift, true, 'les chiffres se tapent avec Maj sur AZERTY');
    }
    // les autres doigts : e z i o s'étendent (up), x c se replient (down)
    for (const c of 'ezio') assert.equal(M.motionFor(layout, c).kind, 'up', c);
    for (const c of 'xc') assert.equal(M.motionFor(layout, c).kind, 'down', c);
  }
});

test('index : déplacement latéral vers G, H, B, N, Y, U', () => {
  for (const layout of LAYOUTS) {
    for (const c of 'ghbnyu') {
      const m = M.motionFor(layout, c);
      assert.ok(m.finger === 'LI' || m.finger === 'RI', `${c} : doit être tapé par un index`);
      assert.equal(m.kind, 'lateral', `${layout.id} / ${c}`);
      assert.ok(Math.abs(m.lateral) >= 0.2, `${c} : écart ${m.lateral}`);
    }
    // vers l'intérieur : l'index gauche va à droite (+), l'index droit va à gauche (-)
    for (const c of 'gbt') assert.ok(M.motionFor(layout, c).lateral > 0, c);
    for (const c of 'hy') assert.ok(M.motionFor(layout, c).lateral < 0, c);
  }
});

test('pouces : espace (l\'un ou l\'autre), AltGr (pouce droit)', () => {
  for (const layout of LAYOUTS) {
    const sp = M.motionFor(layout, 'Space');
    assert.equal(sp.kind, 'thumb');
    assert.equal(sp.thumb, 'either');
    const ag = M.motionFor(layout, 'AltGr');
    assert.equal(ag.kind, 'thumb');
    assert.equal(ag.thumb, 'R', 'AltGr : le pouce droit');
    assert.equal(M.thumbFor('AltGr', 'R', layout), 'R');
    assert.equal(M.thumbFor('AltGr', 'L', layout), 'R');
  }
  const mac = LAYOUTS[0];
  assert.equal(M.thumbFor('Space', 'L', mac), 'R', 'après une lettre de la main gauche : pouce droit');
  assert.equal(M.thumbFor('Space', 'R', mac), 'L', 'après une lettre de la main droite : pouce gauche');
  assert.equal(M.thumbFor('Space', null, mac), 'R');
});

test('Maj : l\'auriculaire de la main opposée appuie en même temps que l\'autre doigt', () => {
  for (const layout of LAYOUTS) {
    for (const [ch, shiftKey, shiftFinger, mainFinger] of [['A', 'ShiftR', 'RP', 'LP'], ['E', 'ShiftR', 'RP', 'LM'], ['P', 'ShiftL', 'LP', 'RP'], ['J', 'ShiftL', 'LP', 'RI']]) {
      const plan = M.planFor(layout, ch);
      assert.equal(plan.mode, 'together', ch);
      assert.equal(plan.steps.length, 1);
      assert.equal(plan.steps[0][0], shiftKey);
      assert.equal(M.motionFor(layout, plan.steps[0][0]).finger, shiftFinger, `${layout.id} / ${ch} : doigt de Maj`);
      assert.equal(M.motionFor(layout, plan.steps[0][1]).finger, mainFinger, `${layout.id} / ${ch} : doigt de la touche`);
      // mains opposées
      assert.notEqual(shiftFinger.charAt(0), mainFinger.charAt(0));
    }
    // un chiffre : Maj de la main opposée aussi
    const five = M.planFor(layout, '5');
    assert.equal(five.mode, 'together');
    assert.equal(five.steps[0][0], 'ShiftR', 'le 5 est tapé par la main gauche : Maj droite');
    const eight = M.planFor(layout, '8');
    assert.equal(eight.steps[0][0], 'ShiftL', 'le 8 est tapé par la main droite : Maj gauche');
  }
});

test('touches mortes : ^ puis la voyelle, deux mouvements qui s\'enchaînent', () => {
  for (const layout of LAYOUTS) {
    for (const [ch, vowel] of [['ê', 'e'], ['â', 'a'], ['î', 'i'], ['ô', 'o'], ['û', 'u']]) {
      const plan = M.planFor(layout, ch);
      assert.equal(plan.mode, 'sequence', ch);
      assert.equal(plan.steps.length, 2);
      assert.deepEqual(Array.from(plan.steps[0]), ['^']);
      assert.deepEqual(Array.from(plan.steps[1]), [vowel]);
      assert.equal(M.motionFor(layout, '^').finger, 'RP', 'la touche ^ est tapée par l\'auriculaire droit');
    }
  }
});

test('AltGr (PC) : le pouce droit appuie avec la touche', () => {
  const pc = DD.Layout.get('pc');
  for (const ch of '@#{[|\\}]~`€') {
    const plan = M.planFor(pc, ch);
    assert.ok(plan, `${ch} doit être tapable sur PC`);
    assert.equal(plan.mode, 'together', ch);
    assert.equal(plan.steps[0][0], 'AltGr');
    assert.equal(M.motionFor(pc, 'AltGr').thumb, 'R');
    assert.ok(M.motionFor(pc, plan.steps[0][1]), ch);
  }
  assert.equal(M.planFor(DD.Layout.get('mac'), 'x').mode, 'single');
});

test('tous les caractères tapables ont un plan, et chaque touche du plan a un mouvement', () => {
  for (const layout of LAYOUTS) {
    const geom = M.keyGeometry(layout);
    const chars = new Set(Object.keys(layout.map).concat(Object.keys(DD.Layout.COMPOSE), [' ']));
    if (layout.altgr) Object.keys(layout.altgr).forEach((c) => chars.add(c));
    let n = 0;
    for (const ch of chars) {
      const plan = M.planFor(layout, ch);
      assert.ok(plan, `${layout.id} : ${JSON.stringify(ch)} sans plan`);
      for (const step of plan.steps) for (const id of step) assert.ok(M.motionFor(layout, id, geom), `${layout.id} : ${ch} -> touche ${id}`);
      n++;
    }
    assert.ok(n > 90, `${layout.id} : ${n} caractères`);
  }
});

// ---- Cinématique ------------------------------------------------------------------------------------------------

test('doigt à trois segments : le repli raccourcit le doigt de façon continue', () => {
  for (const f of M.FINGERS) {
    const spec = M.SPEC[f];
    assert.ok(Math.abs(M.reach(spec, 0) - spec.len) < 1e-9, 'doigt tendu : toute sa longueur');
    assert.ok(Math.abs(spec.seg.reduce((a, b) => a + b, 0) - 1) < 1e-9);
    let prev = Infinity;
    for (let c = 0; c <= M.C_MAX + 1e-9; c += 0.01) {
      const r = M.reach(spec, c);
      assert.ok(r < prev, `${f} : la portée doit diminuer avec le repli (c=${c.toFixed(2)})`);
      prev = r;
    }
    assert.ok(M.reach(spec, M.C_MAX) > 0, 'le bout reste devant la base');
    const rest = M.restCurl(spec);
    assert.ok(Math.abs(M.reach(spec, rest) - M.REST_RATIO * spec.len) < 1e-6, 'au repos : REST_RATIO de la longueur');
    assert.ok(rest > 0.25 && rest < 0.5, `${f} : repos arrondi (${rest.toFixed(2)})`);
    // trois angles cumulés croissants (les phalanges se plient dans le même sens)
    const a = M.angles(0.4);
    assert.ok(a[0] < a[1] && a[1] < a[2]);
  }
});

test('solveCurl : le repli trouvé donne bien la distance demandée', () => {
  for (const f of M.FINGERS) {
    const spec = M.SPEC[f];
    const lo = M.reach(spec, M.C_MAX);
    for (let k = 0; k <= 20; k++) {
      const d = lo + ((spec.len - lo) * k) / 20;
      const s = M.solveCurl(spec, d);
      assert.ok(Math.abs(M.reach(spec, s.c) - d) < 1e-6, `${f} d=${d.toFixed(2)}`);
      assert.equal(s.excess, 0);
      assert.equal(s.deficit, 0);
    }
    assert.ok(M.solveCurl(spec, spec.len + 1).excess > 0.99, 'hors de portée : on le sait');
  }
});

test('le bout du doigt arrive au centre de chaque touche ; pour les lettres, seul le doigt bouge', () => {
  const maxShift = {}; // par genre de mouvement, touches normales / spéciales
  for (const layout of LAYOUTS) {
    const { geom, rest } = restFor(layout);
    for (const id of Object.keys(geom)) {
      const m = M.motionFor(layout, id, geom);
      if (m.finger === 'TH') continue;
      const f = rest.fingers[m.finger];
      const tip = { x: geom[id].x, y: geom[id].y };
      const shift = M.handShift(f.spec, f.mcp, tip);
      const mcp = { x: f.mcp.x + shift.x, y: f.mcp.y + shift.y };
      const pose = M.fingerPose(f.spec, mcp, tip);
      assert.ok(pose.error < 1e-6, `${layout.id} / ${id} : le bout rate la touche de ${pose.error.toFixed(3)}`);
      assert.equal(pose.excess, 0, `${layout.id} / ${id} : hors de portée`);
      assert.equal(pose.deficit, 0, `${layout.id} / ${id} : trop près`);
      assert.ok(Math.abs(pose.tip.x - tip.x) < 1e-6 && Math.abs(pose.tip.y - tip.y) < 1e-6);
      const key = m.kind + (geom[id].special ? ':spéciale' : '');
      maxShift[key] = Math.max(maxShift[key] || 0, shift.size);
      assert.ok(shift.size < 1.6, `${layout.id} / ${id} : la main avance de ${shift.size.toFixed(2)} touches`);
    }
  }
  // Touches de repos, du haut, du bas et index latéral : AUCUN déplacement de la main, seul le doigt bouge.
  for (const kind of ['home', 'up', 'down', 'lateral']) assert.ok((maxShift[kind] || 0) < 1e-9, `${kind} : la main ne doit pas bouger (${maxShift[kind]})`);
  // Chiffres : le doigt est tendu à fond, la main avance au plus d'une touche pour les plus éloignées (@, &, à...).
  assert.ok(maxShift.number <= 1.0, 'chiffres : ' + maxShift.number);
  assert.ok(maxShift.number > 0, 'chiffres : les plus éloignées demandent un petit déplacement');
  // Touches spéciales éloignées (Entrée, Retour...) : un peu plus
  assert.ok((maxShift['far:spéciale'] || 0) < 1, 'far : ' + maxShift['far:spéciale']);
  assert.ok((maxShift['number:spéciale'] || 0) < 1.5, 'Retour arrière : ' + maxShift['number:spéciale']);
});

test('au repos : chaque doigt est sur sa touche, légèrement arrondi et presque droit', () => {
  for (const layout of LAYOUTS) {
    const { geom, rest } = restFor(layout);
    for (const f of M.FINGERS) {
      const r = rest.fingers[f];
      const pose = M.fingerPose(r.spec, r.mcp, r.tipHome);
      assert.ok(pose.error < 1e-6);
      assert.equal(pose.excess, 0);
      assert.ok(Math.abs(pose.curl - r.curlRest) < 1e-6);
      assert.ok(Math.abs(pose.psi) < 0.06, `${f} : écart latéral au repos ${pose.psi}`);
      assert.deepEqual(M.handShift(r.spec, r.mcp, r.tipHome), { x: 0, y: 0, size: 0 });
    }
    // les deux mains sont symétriques de part et d'autre de la barre d'espace
    assert.ok(rest.thumbs.L.tipRest.x < geom.Space.x && rest.thumbs.R.tipRest.x > geom.Space.x);
  }
});

test('sens des mouvements : étendre pour le haut, replier pour le bas, pencher vers la touche', () => {
  const layout = LAYOUTS[0];
  const { geom, rest } = restFor(layout);
  const curlOf = (id) => {
    const m = M.motionFor(layout, id, geom);
    const f = rest.fingers[m.finger];
    const sh = M.handShift(f.spec, f.mcp, geom[id]);
    return M.fingerPose(f.spec, { x: f.mcp.x + sh.x, y: f.mcp.y + sh.y }, geom[id]);
  };
  // majeur gauche : D (repos) / E (haut) / C (bas) / « 3 » (chiffres)
  const home = curlOf('d').curl;
  const up = curlOf('e').curl;
  const down = curlOf('c').curl;
  const number = curlOf('"').curl; // touche du 3
  assert.ok(up < home, 'haut : moins replié que le repos');
  assert.ok(down > home, 'bas : plus replié que le repos');
  assert.ok(number < up, 'chiffres : encore plus étendu que le haut');
  // index gauche vers G (à droite) puis B : se penche vers la droite ; index droit vers H : vers la gauche
  assert.ok(curlOf('g').psi > 0 && curlOf('b').psi > 0);
  assert.ok(curlOf('h').psi < 0 && curlOf('y').psi < 0);
  assert.ok(Math.abs(curlOf('f').psi) < 0.06);
});

test('les deux pouces ne se croisent jamais sous la barre d\'espace', () => {
  for (const layout of LAYOUTS) {
    const { rest } = restFor(layout);
    const L = M.thumbPose(rest.thumbs.L.base, rest.thumbs.L.tipRest, 'L');
    const R = M.thumbPose(rest.thumbs.R.base, rest.thumbs.R.tipRest, 'R');
    // tout le pouce gauche reste à gauche du pouce droit (segments : base -> genou -> bout)
    const maxL = Math.max(rest.thumbs.L.base.x, L.p1.x, L.tip.x);
    const minR = Math.min(rest.thumbs.R.base.x, R.p1.x, R.tip.x);
    assert.ok(maxL < minR, `${layout.id} : le pouce gauche va jusqu'à x=${maxL.toFixed(2)}, le droit commence à x=${minR.toFixed(2)}`);
  }
});

test('pouces : l\'espace est à portée des deux pouces, AltGr du pouce droit', () => {
  for (const layout of LAYOUTS) {
    const { geom, rest } = restFor(layout);
    for (const side of ['L', 'R']) {
      const t = rest.thumbs[side];
      const p = M.thumbPose(t.base, t.tipRest, side);
      assert.equal(p.clamped, false, `${layout.id} : pouce ${side} au repos`);
      assert.ok(p.error < 1e-6);
      assert.ok(Math.abs(p.tip.x - t.tipRest.x) < 1e-9 && Math.abs(p.tip.y - t.tipRest.y) < 1e-9);
      // le genou du pouce bombe à l'opposé de l'autre main : les deux pouces ne se croisent pas
      if (side === 'L') assert.ok(p.p1.x < Math.max(t.base.x, t.tipRest.x) + 1e-9, 'pouce gauche : genou côté main gauche');
      else assert.ok(p.p1.x > Math.min(t.base.x, t.tipRest.x) - 1e-9, 'pouce droit : genou côté main droite');
    }
    // AltGr : pouce droit
    const alt = geom.AltGr;
    const pa = M.thumbPose(rest.thumbs.R.base, { x: alt.x, y: alt.y }, 'R');
    assert.equal(pa.clamped, false, `${layout.id} : AltGr hors de portée du pouce droit`);
    assert.ok(pa.error < 1e-6);
  }
});

// ---- Réglages des mains et migration ------------------------------------------------------------------------------

const siteWith = (storage) => loadSite(['util.js', 'store.js', 'layout.js'], { storage: storage || {} });

test('réglages des mains : valeurs par défaut (mains affichées, 62 %, blanc translucide, vitesse normale)', () => {
  const s = siteWith().Store.state.settings;
  assert.equal(s.showHands, true);
  assert.equal(s.handOpacity, 62);
  assert.equal(s.handTint, 'blanc');
  assert.equal(s.handSpeed, 'normal');
  assert.equal(s.demoSpeed, 'normal');
});

test('réglages des mains : opacité bornée de 20 à 80 %, valeurs inconnues ignorées', () => {
  const load = (settings) => siteWith({ 'dixdoigts:v1': JSON.stringify({ v: 1, schema: 3, settings: Object.assign({ handStyle: 2 }, settings), tests: [] }) }).Store.state.settings;
  assert.equal(load({ handOpacity: 5 }).handOpacity, 20);
  assert.equal(load({ handOpacity: 99 }).handOpacity, 80);
  assert.equal(load({ handOpacity: 35.4 }).handOpacity, 35);
  assert.equal(load({ handOpacity: 'beaucoup' }).handOpacity, 62);
  for (const tint of ['blanc', 'claire', 'moyenne', 'foncee', 'fantome']) assert.equal(load({ handTint: tint }).handTint, tint);
  assert.equal(load({ handTint: 'vert' }).handTint, 'blanc');
  for (const v of ['lent', 'normal', 'rapide']) assert.equal(load({ handSpeed: v }).handSpeed, v);
  assert.equal(load({ handSpeed: 'éclair' }).handSpeed, 'normal');
  assert.equal(load({ demoSpeed: 'lent' }).demoSpeed, 'lent');
  assert.equal(load({ demoSpeed: 'rapide' }).demoSpeed, 'normal', 'la démo n\'a que lent / normal');
  assert.equal(load({ showHands: false }).showHands, false);
  assert.equal(load({ showHands: 'non' }).showHands, true, 'seul un booléen est accepté');
});

test('migration : les réglages et les données d\'avant les mains sont conservés, les mains arrivent avec leurs valeurs par défaut', () => {
  const before = {
    v: 1,
    schema: 3,
    profile: { name: 'Léa' },
    settings: { layout: 'pc', sound: false, volume: 0.2, showKeyboard: false, dailyGoalMin: 20, baselineWpm: 91, seriesLength: 'long', unlockAll: true },
    lessons: { '1.1': { done: true, stars: 3, bestWpm: 31, bestAcc: 99, tries: 2 } },
    tests: [{ t: 1700001000000, dur: 120, fingers: 10, wpm: 44.5, raw: 46, acc: 96.2, ok: 445, bad: 16 }],
    unlocks: { modules: [3], lessons: ['5.2'] },
    badges: { 'first-lesson': 1700000100000 },
  };
  const st = siteWith({ 'dixdoigts:v1': JSON.stringify(before) }).Store.state;
  // rien d'ancien n'est perdu
  assert.equal(st.settings.layout, 'pc');
  assert.equal(st.settings.sound, false);
  assert.equal(st.settings.showKeyboard, false);
  assert.equal(st.settings.dailyGoalMin, 20);
  assert.equal(st.settings.baselineWpm, 91);
  assert.equal(st.settings.seriesLength, 'long');
  assert.equal(st.settings.unlockAll, true);
  assert.equal(st.profile.name, 'Léa');
  assert.equal(st.lessons['1.1'].stars, 3);
  assert.equal(st.tests[0].wpm, 44.5);
  assert.equal(JSON.stringify(st.unlocks), '{"modules":[3],"lessons":["5.2"]}');
  assert.equal(JSON.stringify(Object.keys(st.badges)), '["first-lesson"]');
  // les mains : valeurs par défaut
  assert.equal(st.settings.showHands, true);
  assert.equal(st.settings.handOpacity, 62);
  assert.equal(st.settings.handTint, 'blanc');
  assert.equal(st.settings.handSpeed, 'normal');
});

test('réglages des mains : exportés, importés, conservés', () => {
  const a = siteWith();
  Object.assign(a.Store.state.settings, { showHands: false, handOpacity: 65, handTint: 'fantome', handSpeed: 'lent', demoSpeed: 'lent' });
  const json = a.Store.exportJSON();
  const b = siteWith();
  assert.equal(b.Store.importJSON(json).ok, true);
  const s = b.Store.state.settings;
  assert.deepEqual([s.showHands, s.handOpacity, s.handTint, s.handSpeed, s.demoSpeed], [false, 65, 'fantome', 'lent', 'lent']);
});

test('disposition : la touche AltGr est à droite de la barre d\'espace, tapée par le pouce', () => {
  for (const layout of LAYOUTS) {
    const geom = M.keyGeometry(layout);
    assert.ok(geom.AltGr && geom.Space, `${layout.id} : AltGr et Espace`);
    assert.ok(geom.AltGr.x > geom.Space.x, 'AltGr est à droite de la barre d\'espace');
    assert.equal(geom.AltGr.row, 4);
    assert.equal(layout.keys.AltGr.f, 'TH');
  }
  // les anciens textes ne changent pas : aucun caractère courant ne demande AltGr
  const mac = LAYOUTS[0];
  for (const ch of 'azertyAZERTY0123456789 .,;:!?\'"()-éèàçùêâîôû') assert.ok(!(mac.hint(ch).keys || []).includes('AltGr'), ch);
});

test('nouveau style des mains : les anciens réglages de teinte et d\'opacité sont remis une seule fois', () => {
  const old = siteWith({ 'dixdoigts:v1': JSON.stringify({ v: 1, schema: 3, settings: { handTint: 'moyenne', handOpacity: 35 }, tests: [] }) }).Store.state.settings;
  assert.equal(old.handTint, 'blanc');
  assert.equal(old.handOpacity, 62);
  assert.equal(old.handStyle, 2);
  // ensuite, le choix de l'utilisateur est respecté
  const kept = siteWith({ 'dixdoigts:v1': JSON.stringify({ v: 1, schema: 3, settings: { handStyle: 2, handTint: 'foncee', handOpacity: 35 }, tests: [] }) }).Store.state.settings;
  assert.equal(kept.handTint, 'foncee');
  assert.equal(kept.handOpacity, 35);
});
