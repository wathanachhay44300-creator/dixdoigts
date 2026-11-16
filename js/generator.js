/*
 * Générateur d'exercices — module PUR : aucun accès au navigateur, aucune donnée enregistrée.
 * Il marche donc aussi dans Node (tests automatiques) et accepte une graine aléatoire :
 * même graine + mêmes options = même texte.
 *
 * generate({
 *   type:   'repeat' | 'alternate' | 'pseudo' | 'words' | 'sentences' | 'mix',
 *   chars:  caractères autorisés (l'espace est toujours permis entre les groupes),
 *   len:    longueur visée, en caractères (le texte s'arrête à la fin d'un groupe),
 *   seed:   graine (nombre entier) — facultatif,
 *   focus:  caractères à travailler en priorité,
 *   focusWeight: poids de ces caractères (défaut 1,6),
 *   focusShare:  part minimale (0 à 1) de caractères "focus" dans le texte (défaut 0 = pas de règle),
 *   weights:{caractère: poids}  poids supplémentaires (ex. touches les plus ratées),
 *   pool:   liste de mots (types 'words' et 'mix'),
 *   sentences: liste de phrases (types 'sentences' et 'mix') — par défaut, la même liste que pool,
 *   focusOnly: pour les mots, ne garder que ceux qui contiennent au moins une de ces touches,
 *   kinds:  types autorisés dans un 'mix',
 *   caps:   true = majuscule au début de chaque mot / phrase,
 *   fingerOf: caractère -> 'LP'|'LR'|...|null (pour alterner les mains et les doigts)
 * }) -> { text, type, seed, counts, length, unavailable }
 *
 * 'words' et 'sentences' renvoient { unavailable: true } s'il n'y a pas assez de contenu
 * (moins de 30 mots différents pour 'words') : l'appelant saute alors cette étape.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && root.DD) root.DD.Gen = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const MIN_WORDS = 30;

  // Doigt de chaque lettre (AZERTY). Pour le reste, l'appelant fournit fingerOf.
  const LETTER_FINGER = {
    a: 'LP', z: 'LR', e: 'LM', r: 'LI', t: 'LI', y: 'RI', u: 'RI', i: 'RM', o: 'RR', p: 'RP',
    q: 'LP', s: 'LR', d: 'LM', f: 'LI', g: 'LI', h: 'RI', j: 'RI', k: 'RM', l: 'RR', m: 'RP',
    w: 'LP', x: 'LR', c: 'LM', v: 'LI', b: 'LI', n: 'RI',
  };
  const VOWELS = new Set(Array.from('aeiouyéèàùêâîôûëï'));
  const LETTER = /^[a-zéèàùçêâîôûëï]$/;

  // ---- Hasard avec graine (mulberry32) ----------------------------------------------------------
  function rng(seed) {
    let a = seed >>> 0 || 0x9e3779b9;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const uniq = (arr) => Array.from(new Set(arr));
  const chars_ = (s) => Array.from(String(s || '').normalize('NFC'));
  const cap = (w) => (/^[a-z]/.test(w) ? w.charAt(0).toUpperCase() + w.slice(1) : w);

  // ---- Contexte : équilibrage des touches ---------------------------------------------------------
  function context(o) {
    const chars = uniq(chars_(o.chars).filter((c) => c !== ' '));
    const seed = o.seed != null ? o.seed >>> 0 : Math.floor(Math.random() * 4294967296);
    const rnd = rng(seed);
    const weight = {};
    chars.forEach((c) => (weight[c] = 1));
    const focus = new Set(chars_(o.focus).filter((c) => weight[c] !== undefined));
    const fw = o.focusWeight > 0 ? o.focusWeight : 1.6;
    focus.forEach((c) => (weight[c] *= fw));
    if (o.weights) {
      Object.keys(o.weights).forEach((c) => {
        const w = Number(o.weights[c]);
        if (weight[c] !== undefined && w > 0 && isFinite(w)) weight[c] *= Math.min(w, 20);
      });
    }
    const counts = {};
    chars.forEach((c) => (counts[c] = 0));
    let total = 0;
    let focusTotal = 0;
    const share = focus.size > 0 && focus.size < chars.length ? Math.min(0.95, o.focusShare || 0) : 0;
    const fingerOf = o.fingerOf || ((c) => LETTER_FINGER[c] || null);
    const ctx = {
      chars, rnd, seed, counts, focus, share, caps: !!o.caps,
      finger: (c) => fingerOf(c) || null,
      hand: (c) => {
        const f = fingerOf(c);
        return f ? f.charAt(0) : null;
      },
      ratio: () => (total ? focusTotal / total : 0),
      // Choisit le caractère le moins utilisé (selon son poids), parmi cands.
      // tmp = ce que le groupe en cours de construction a déjà pris (pas encore compté).
      pick(cands, tmp) {
        tmp = tmp || {};
        let pool = cands;
        if (share > 0) {
          const t = total + (tmp._t || 0);
          const f = focusTotal + (tmp._f || 0);
          const wantFocus = f / (t + 1) < share;
          const g = cands.filter((c) => focus.has(c) === wantFocus);
          if (g.length) pool = g;
        }
        let best = pool[0];
        let bs = Infinity;
        for (const c of pool) {
          const s = (counts[c] + (tmp[c] || 0)) / weight[c] + rnd() * 0.9;
          if (s < bs) {
            bs = s;
            best = c;
          }
        }
        return best;
      },
      note(tmp, c) {
        tmp[c] = (tmp[c] || 0) + 1;
        tmp._t = (tmp._t || 0) + 1;
        if (focus.has(c)) tmp._f = (tmp._f || 0) + 1;
      },
      commit(tok) {
        for (const c of chars_(tok)) {
          const k = counts[c] !== undefined ? c : c.toLowerCase();
          if (counts[k] === undefined) continue;
          counts[k]++;
          total++;
          if (focus.has(k)) focusTotal++;
        }
      },
      weight,
    };
    return ctx;
  }

  const lenOf = (tokens) => tokens.reduce((a, t) => a + t.length + 1, 0);

  // ---- Répétition pure : vvv bbb vbv bvb --------------------------------------------------------
  function alt(a, b, L) {
    let s = '';
    for (let i = 0; i < L; i++) s += i % 2 === 0 ? a : b;
    return s;
  }
  function genRepeat(ctx, len, o) {
    o = o || {};
    const { chars } = ctx;
    const out = [];
    const perKey = len / chars.length;
    let guard = 0;
    while (lenOf(out) <= len && guard++ < 5000) {
      const p = lenOf(out) / len;
      // longueur croissante : 3, puis 4, puis 5 (ou 2 si on a beaucoup de touches pour peu de place)
      const L = o.L || (perKey < 6 ? 2 : p < 0.3 ? 3 : p < 0.65 ? 4 : 5);
      const tmp = {};
      const a = ctx.pick(chars, tmp);
      ctx.note(tmp, a);
      let block;
      if (chars.length === 1) block = [a.repeat(L)];
      else {
        let cands = chars.filter((c) => c !== a);
        const other = cands.filter((c) => ctx.hand(c) !== ctx.hand(a));
        if (other.length) cands = other;
        const b = ctx.pick(cands, tmp);
        const style = o.block || (perKey >= 12 ? 'quad' : 'duo');
        block = style === 'quad' ? [a.repeat(L), b.repeat(L), alt(a, b, L), alt(b, a, L)] : [a.repeat(L), b.repeat(L)];
      }
      for (const t of block) {
        if (lenOf(out) > len) break;
        ctx.commit(t);
        out.push(t);
      }
    }
    return out;
  }

  // ---- Alternances : vn nv vnb bnv ----------------------------------------------------------------
  function genAlternate(ctx, len) {
    const { chars } = ctx;
    if (chars.length < 2) return genRepeat(ctx, len);
    const out = [];
    let guard = 0;
    while (lenOf(out) <= len && guard++ < 5000) {
      const L = ctx.rnd() < 0.5 ? 2 : 3; // bigrammes et trigrammes
      const tmp = {};
      let tok = '';
      let prev = null;
      for (let i = 0; i < L; i++) {
        let cands = chars.filter((c) => c !== prev);
        if (prev) {
          const dh = cands.filter((c) => ctx.hand(c) !== ctx.hand(prev));
          if (dh.length) cands = dh;
          else {
            const df = cands.filter((c) => ctx.finger(c) !== ctx.finger(prev));
            if (df.length) cands = df;
          }
        }
        const c = ctx.pick(cands, tmp);
        tok += c;
        ctx.note(tmp, c);
        prev = c;
      }
      if (tok === out[out.length - 1]) continue;
      ctx.commit(tok);
      out.push(tok);
    }
    return out;
  }

  // ---- Pseudo-mots : vanb, cxnv ---------------------------------------------------------------------
  function genPseudo(ctx, len) {
    const { chars } = ctx;
    if (chars.length < 2) return genRepeat(ctx, len);
    const vow = chars.filter((c) => VOWELS.has(c));
    const con = chars.filter((c) => !VOWELS.has(c) && LETTER.test(c));
    const cv = vow.length >= 1 && con.length >= 1;
    const out = [];
    let guard = 0;
    while (lenOf(out) <= len && guard++ < 5000) {
      const L = 3 + Math.floor(ctx.rnd() * 3); // 3 à 5 caractères
      const tmp = {};
      let tok = '';
      let prev = null;
      for (let i = 0; i < L; i++) {
        let cands = chars.filter((c) => c !== prev);
        if (cv && prev) {
          // Presque prononçable : jamais deux voyelles d'affilée, jamais trois consonnes d'affilée.
          // Le choix final reste équilibré entre les touches.
          const last2 = tok.slice(-2);
          if (VOWELS.has(prev)) {
            const nv = cands.filter((c) => !VOWELS.has(c));
            if (nv.length) cands = nv;
          } else if (last2.length === 2 && !VOWELS.has(last2[0]) && ctx.share === 0) {
            // (sans objectif de part de touches : sinon les voyelles imposées feraient baisser cette part)
            const vv = cands.filter((c) => VOWELS.has(c));
            if (vv.length) cands = vv;
          }
        } else if (prev && ctx.rnd() < 0.6) {
          const dh = cands.filter((c) => ctx.hand(c) !== ctx.hand(prev));
          if (dh.length) cands = dh;
        }
        const c = ctx.pick(cands, tmp);
        tok += c;
        ctx.note(tmp, c);
        prev = c;
      }
      if (tok === out[out.length - 1]) continue;
      ctx.commit(tok);
      out.push(tok);
    }
    return out;
  }

  // ---- Mots / phrases réels ---------------------------------------------------------------------------
  function candidates(chars, pool, focus, caps) {
    const set = new Set(chars_(chars));
    const f = focus ? new Set(chars_(focus)) : null;
    return uniq((pool || []).map((w) => String(w).normalize('NFC'))).filter((w) => {
      const cs = chars_(w);
      if (cs.length < 2) return false;
      if (!cs.every((c) => set.has(c) || (caps && set.has(c.toLowerCase())))) return false;
      return !f || cs.some((c) => f.has(c));
    });
  }
  // Combien de mots différents peut-on écrire avec ces touches ? (si 'focus' : au moins une de ces touches)
  function availableWords(chars, pool, focus) {
    return candidates(chars, pool, focus, false).length;
  }

  function genWords(ctx, len, pool, o) {
    o = o || {};
    const cands = candidates(ctx.chars.join(''), pool, o.focusOnly || null, false).filter((w) => !/\s/.test(w));
    if (cands.length < MIN_WORDS) return null;
    // Index : touche -> mots qui la contiennent (pour ne pas oublier les lettres rares)
    const byChar = {};
    cands.forEach((w) => uniq(chars_(w)).forEach((c) => (byChar[c] = byChar[c] || []).push(w)));
    const out = [];
    const recent = [];
    const keep = Math.min(20, Math.floor(cands.length / 2));
    let guard = 0;
    while (lenOf(out) <= len && guard++ < 5000) {
      // Une fois sur deux, on cherche un mot avec la touche la moins vue.
      let source = cands;
      if (ctx.rnd() < 0.5) {
        let target = null;
        let ts = Infinity;
        for (const c of ctx.chars) {
          if (!byChar[c]) continue;
          const s = ctx.counts[c] / ctx.weight[c] + ctx.rnd() * 0.5;
          if (s < ts) {
            ts = s;
            target = c;
          }
        }
        if (target) source = byChar[target];
      }
      // On tire quelques mots au hasard et on garde celui qui sert le mieux les touches les moins vues.
      let best = null;
      let bs = -Infinity;
      for (let i = 0; i < 12; i++) {
        const w = source[Math.floor(ctx.rnd() * source.length)];
        if (recent.includes(w)) continue;
        const cs = chars_(w);
        let s = 0;
        let f = 0;
        for (const c of cs) {
          s += (ctx.weight[c] || 1) / (1 + ctx.counts[c]);
          if (ctx.focus.has(c)) f++;
        }
        s /= Math.sqrt(cs.length);
        if (ctx.share > 0 && ctx.ratio() < ctx.share) s += 3 * (f / cs.length);
        s += ctx.rnd() * 0.05;
        if (s > bs) {
          bs = s;
          best = w;
        }
      }
      if (!best) continue;
      recent.push(best);
      if (recent.length > keep) recent.shift();
      ctx.commit(best);
      out.push(ctx.caps ? cap(best) : best);
    }
    return out;
  }

  // Phrases de la liste écrites uniquement avec les touches autorisées
  function sentenceCands(ctx, pool) {
    const set = new Set(ctx.chars);
    return uniq((pool || []).map((s) => String(s).normalize('NFC'))).filter((s) => chars_(s).every((c) => c === ' ' || set.has(c) || (ctx.caps && set.has(c.toLowerCase()))));
  }

  function genSentences(ctx, len, pool) {
    const cands = sentenceCands(ctx, pool);
    if (!cands.length) return null;
    const order = [];
    cands.forEach((_, i) => order.push(i));
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(ctx.rnd() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    const out = [];
    let i = 0;
    while (lenOf(out) <= len && i < order.length * 50) {
      const s = cands[order[i % order.length]];
      ctx.commit(s.replace(/ /g, ''));
      out.push(ctx.caps ? cap(s) : s);
      i++;
    }
    return out;
  }

  // ---- Mélange -------------------------------------------------------------------------------------------
  function genMix(ctx, len, o) {
    const kinds = (o.kinds && o.kinds.length ? o.kinds : ['alternate', 'pseudo', 'words', 'repeat']).slice();
    const pool = o.pool || [];
    const spool = o.sentences || o.pool || [];
    const wordsOk = kinds.includes('words') && candidates(ctx.chars.join(''), pool, o.focusOnly || null, false).length >= MIN_WORDS;
    const sentOk = kinds.includes('sentences') && sentenceCands(ctx, spool).length > 0;
    const weights = { alternate: 3, pseudo: 3, words: 3, repeat: 1, sentences: 2 };
    const avail = kinds.filter((k) => (k === 'words' ? wordsOk : k === 'sentences' ? sentOk : true));
    if (!avail.length) avail.push('pseudo');
    const out = [];
    let guard = 0;
    while (lenOf(out) <= len && guard++ < 2000) {
      // Si la part de touches travaillées passe sous l'objectif, on n'ajoute que des groupes faits sur mesure
      // (les vrais mots ne contiennent pas toujours assez de ces touches).
      let kinds2 = avail;
      if (ctx.share > 0 && ctx.ratio() < ctx.share + 0.05) {
        const charLevel = avail.filter((k) => k === 'pseudo' || k === 'alternate');
        if (charLevel.length) kinds2 = charLevel;
      }
      let r = ctx.rnd() * kinds2.reduce((a, k) => a + weights[k], 0);
      let kind = kinds2[0];
      for (const k of kinds2) {
        r -= weights[k];
        if (r <= 0) {
          kind = k;
          break;
        }
      }
      const chunk = 18 + Math.floor(ctx.rnd() * 14);
      let toks;
      if (kind === 'alternate') toks = genAlternate(ctx, chunk);
      else if (kind === 'pseudo') toks = genPseudo(ctx, chunk);
      else if (kind === 'repeat') toks = genRepeat(ctx, chunk, { L: 3, block: 'duo' });
      else if (kind === 'words') toks = genWords(ctx, chunk, pool, o) || genPseudo(ctx, chunk);
      else toks = genSentences(ctx, chunk, spool) || genPseudo(ctx, chunk);
      out.push(...toks);
    }
    return out;
  }

  // ---- Point d'entrée ------------------------------------------------------------------------------------------
  function generate(o) {
    o = o || {};
    const ctx = context(o);
    const type = o.type || 'mix';
    const len = Math.max(6, Math.round(o.len || 150));
    const res = { type, seed: ctx.seed, len, text: '', counts: ctx.counts, length: 0, unavailable: false };
    if (!ctx.chars.length) {
      res.unavailable = true;
      return res;
    }
    let tokens;
    if (type === 'repeat') tokens = genRepeat(ctx, len);
    else if (type === 'alternate') tokens = genAlternate(ctx, len);
    else if (type === 'pseudo') tokens = genPseudo(ctx, len);
    else if (type === 'words') tokens = genWords(ctx, len, o.pool || [], o);
    else if (type === 'sentences') tokens = genSentences(ctx, len, o.sentences || o.pool || []);
    else tokens = genMix(ctx, len, o);
    if (!tokens || !tokens.length) {
      res.unavailable = true;
      return res;
    }
    res.text = tokens.join(' ');
    res.length = res.text.length;
    return res;
  }

  // Poids à partir des statistiques de frappe : {caractère: {n, m}} -> {caractère: poids > 1}
  function weightsFromStats(chars, stats) {
    const out = {};
    chars_(chars).forEach((c) => {
      const s = stats && stats[c];
      if (!s || s.n < 3 || !s.m) return;
      const rate = s.m / (s.n + 2);
      const w = 1 + 6 * Math.min(1, rate / 0.15);
      if (w > 1.05) out[c] = Math.round(w * 100) / 100;
    });
    return out;
  }

  return { generate, availableWords, weightsFromStats, rng, MIN_WORDS, LETTER_FINGER, cap };
});
