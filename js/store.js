/* Sauvegarde locale (localStorage), sans compte. */
(function () {
  const DD = window.DD;
  const KEY = 'dixdoigts:v1';
  const FORBIDDEN = new Set(['__proto__', 'constructor', 'prototype']);

  function guessLayout() {
    const p = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || navigator.userAgent || '';
    return /mac|iphone|ipad/i.test(p) ? 'mac' : 'pc';
  }

  // v      : version du format de fichier (reste 1, pour que les anciennes sauvegardes s'importent toujours).
  // schema : version de la structure des leçons. 1 = leçons à plat ; 2 = leçons en étapes + fin de module.
  const SCHEMA = 2;
  const END_STEPS = ['e1', 'e2', 'e3', 'mastery', 'revision'];
  const WORKSHOP_TYPES = ['repeat', 'alternate', 'pseudo', 'words', 'mix'];
  // Leçons de l'ancienne structure (schéma 1) : sert à garder les modules déjà terminés.
  const LEGACY_LESSONS = {
    1: ['1.1', '1.2', '1.3', '1.4', '1.5', '1.6'], 2: ['2.1', '2.2', '2.3', '2.4', '2.5', '2.6'], 3: ['3.1', '3.2', '3.3', '3.4', '3.5'],
    4: ['4.1', '4.2', '4.3', '4.4', '4.5'], 5: ['5.1', '5.2', '5.3', '5.4'], 6: ['6.1', '6.2', '6.3', '6.4', '6.5', '6.6'],
    7: ['7.1', '7.2', '7.3', '7.4', '7.5'], 8: ['8.1', '8.2', '8.3', '8.4', '8.5'], 9: ['9.1', '9.2', '9.3', '9.4'],
    10: ['10.1', '10.2', '10.3', '10.4', '10.5'],
  };

  function defaults() {
    return {
      v: 1,
      schema: SCHEMA,
      created: Date.now(),
      profile: { name: '' },
      settings: {
        layout: guessLayout(), // 'mac' | 'pc' (AZERTY)
        sound: true,
        soundProfile: 'clic', // clic | doux | machine
        volume: 0.6,
        showKeyboard: true,
        dailyGoalMin: 10,
        baselineWpm: 80, // niveau à deux doigts, tracé sur la courbe
        testDuration: 2,
        testFingers: 10,
        seriesLength: 'normal', // short (≈60 caractères) | normal (≈150) | long (≈300)
        // Dernier réglage de l'atelier de répétitions
        workshop: { chars: 'fjdk', type: 'alternate', mode: 'chars', minutes: 2, count: 150, weak: false },
      },
      lessons: {}, // id -> {done, stars, bestWpm, bestAcc, tries, stages:{intro, repeat, ...: {done, bestAcc, bestWpm, tries}}}
      modules: {}, // id -> {skipped, done, legacy, end:{e1,e2,e3,mastery,revision}, t}
      tests: [], // {t, dur, fingers, wpm, raw, acc, ok, bad, series, errs, misses}  — tests chronométrés uniquement
      sessions: [], // exercices de l'atelier : {t, type, chars, dur, len, wpm, acc, errors} — comptent dans la série, pas dans les records
      chars: {}, // caractère -> {n, m}
      days: {}, // 'AAAA-MM-JJ' -> {sec, n}
      badges: {}, // id -> timestamp
      flags: {}, // blind, weak, certificate, skip
    };
  }

  const isObj = (o) => o && typeof o === 'object' && !Array.isArray(o);
  const num = (x, d) => (typeof x === 'number' && isFinite(x) ? x : d);

  function cleanMap(src, fn) {
    const out = {};
    if (!isObj(src)) return out;
    for (const k of Object.keys(src)) {
      if (FORBIDDEN.has(k)) continue;
      const v = fn(src[k], k);
      if (v !== undefined) out[k] = v;
    }
    return out;
  }

  // Valide et nettoie un objet venant du disque ou d'un fichier importé.
  function normalize(obj) {
    const d = defaults();
    if (!isObj(obj)) return d;
    d.created = num(obj.created, d.created);
    if (isObj(obj.profile) && typeof obj.profile.name === 'string') d.profile.name = obj.profile.name.slice(0, 60);
    if (isObj(obj.settings)) {
      const s = obj.settings;
      const out = d.settings;
      if (s.layout === 'mac' || s.layout === 'pc') out.layout = s.layout;
      if (typeof s.sound === 'boolean') out.sound = s.sound;
      if (['clic', 'doux', 'machine'].includes(s.soundProfile)) out.soundProfile = s.soundProfile;
      out.volume = Math.min(1, Math.max(0, num(s.volume, out.volume)));
      if (typeof s.showKeyboard === 'boolean') out.showKeyboard = s.showKeyboard;
      out.dailyGoalMin = Math.min(120, Math.max(1, Math.round(num(s.dailyGoalMin, out.dailyGoalMin))));
      out.baselineWpm = Math.min(300, Math.max(5, Math.round(num(s.baselineWpm, out.baselineWpm))));
      if ([1, 2, 3, 5].includes(s.testDuration)) out.testDuration = s.testDuration;
      if (s.testFingers === 2 || s.testFingers === 10) out.testFingers = s.testFingers;
      if (['short', 'normal', 'long'].includes(s.seriesLength)) out.seriesLength = s.seriesLength;
      if (isObj(s.workshop)) {
        const w = s.workshop;
        const chars = typeof w.chars === 'string' ? Array.from(new Set(Array.from(w.chars.normalize('NFC')).filter((c) => c !== ' '))).slice(0, 120).join('') : out.workshop.chars;
        out.workshop = {
          chars: chars || out.workshop.chars,
          type: WORKSHOP_TYPES.includes(w.type) ? w.type : out.workshop.type,
          mode: w.mode === 'minutes' ? 'minutes' : 'chars',
          minutes: Math.min(30, Math.max(1, Math.round(num(w.minutes, 2)))),
          count: Math.min(2000, Math.max(20, Math.round(num(w.count, 150)))),
          weak: !!w.weak,
        };
      }
    }
    d.lessons = cleanMap(obj.lessons, (v) => {
      if (!isObj(v)) return undefined;
      const l = { done: !!v.done, stars: Math.min(3, Math.max(0, Math.round(num(v.stars, 0)))), bestWpm: num(v.bestWpm, 0), bestAcc: num(v.bestAcc, 0), tries: Math.round(num(v.tries, 0)) };
      if (isObj(v.stages)) {
        l.stages = cleanMap(v.stages, (s) => (isObj(s) ? { done: !!s.done, bestAcc: num(s.bestAcc, 0), bestWpm: num(s.bestWpm, 0), tries: Math.round(num(s.tries, 0)) } : undefined));
      }
      return l;
    });
    d.modules = cleanMap(obj.modules, (v) => {
      if (!isObj(v)) return undefined;
      const end = cleanMap(v.end, (x) => (x === true ? true : undefined));
      const m = { t: num(v.t, 0) };
      if (v.skipped) m.skipped = true;
      if (v.done) m.done = true;
      if (v.legacy) m.legacy = true;
      if (Object.keys(end).length) m.end = end;
      return m.skipped || m.done || m.legacy || m.end ? m : undefined;
    });
    // Migration schéma 1 -> 2 : un module dont toutes les anciennes leçons étaient réussies reste « terminé ».
    // Les étoiles, les tests, les badges, les statistiques et les jours ne changent pas.
    if (num(obj.schema, 1) < SCHEMA) {
      Object.keys(LEGACY_LESSONS).forEach((id) => {
        if (LEGACY_LESSONS[id].every((l) => d.lessons[l] && d.lessons[l].done)) d.modules[id] = Object.assign({ t: Date.now() }, d.modules[id], { done: true, legacy: true });
      });
    }
    if (Array.isArray(obj.sessions)) {
      d.sessions = obj.sessions
        .filter((s) => isObj(s) && num(s.t, 0) > 0 && num(s.acc, -1) >= 0 && num(s.wpm, -1) >= 0)
        .slice(-500)
        .map((s) => ({
          t: s.t,
          type: WORKSHOP_TYPES.includes(s.type) ? s.type : 'mix',
          chars: typeof s.chars === 'string' ? s.chars.slice(0, 120) : '',
          dur: num(s.dur, 0),
          len: Math.round(num(s.len, 0)),
          wpm: s.wpm,
          acc: s.acc,
          errors: Math.round(num(s.errors, 0)),
        }));
    }
    if (Array.isArray(obj.tests)) {
      d.tests = obj.tests
        .filter((t) => isObj(t) && num(t.wpm, -1) >= 0 && num(t.acc, -1) >= 0 && num(t.t, 0) > 0 && num(t.dur, 0) > 0)
        .slice(-2000)
        .map((t) => ({
          t: t.t,
          dur: t.dur,
          fingers: t.fingers === 2 ? 2 : 10,
          wpm: t.wpm,
          raw: num(t.raw, t.wpm),
          acc: t.acc,
          ok: num(t.ok, 0),
          bad: num(t.bad, 0),
          series: Array.isArray(t.series) ? t.series.filter((x) => typeof x === 'number').slice(0, 400) : undefined,
          errs: Array.isArray(t.errs) ? t.errs.filter((x) => typeof x === 'number').slice(0, 400) : undefined,
          misses: cleanMap(t.misses, (v) => (typeof v === 'number' ? v : undefined)),
        }));
    }
    d.chars = cleanMap(obj.chars, (v, k) => (isObj(v) && k.length <= 2 ? { n: Math.round(num(v.n, 0)), m: Math.round(num(v.m, 0)) } : undefined));
    d.days = cleanMap(obj.days, (v, k) => (isObj(v) && /^\d{4}-\d{2}-\d{2}$/.test(k) ? { sec: num(v.sec, 0), n: Math.round(num(v.n, 0)) } : undefined));
    d.badges = cleanMap(obj.badges, (v) => (typeof v === 'number' ? v : undefined));
    d.flags = cleanMap(obj.flags, (v) => (v === true ? true : undefined));
    return d;
  }

  const Store = {
    state: defaults(),
    storageOk: true,
    _timer: null,
    _last: 0,

    load() {
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) this.state = normalize(JSON.parse(raw));
      } catch (e) {
        this.storageOk = false;
      }
      return this.state;
    },
    save() {
      clearTimeout(this._timer);
      try {
        localStorage.setItem(KEY, JSON.stringify(this.state));
      } catch (e) {
        this.storageOk = false;
      }
    },
    touch() {
      clearTimeout(this._timer);
      this._timer = setTimeout(() => this.save(), 800);
    },
    reset() {
      this.state = defaults();
      this.save();
    },

    // --- Export / import -------------------------------------------------
    exportJSON() {
      return JSON.stringify({ app: 'dixdoigts', exportedAt: new Date().toISOString(), ...this.state }, null, 1);
    },
    importJSON(text) {
      if (typeof text !== 'string' || text.length > 8 * 1024 * 1024) return { ok: false, error: 'Fichier trop gros ou illisible.' };
      let obj;
      try {
        obj = JSON.parse(text);
      } catch (e) {
        return { ok: false, error: "Ce fichier n'est pas un JSON valide." };
      }
      if (!isObj(obj) || obj.v !== 1 || !isObj(obj.settings) || !Array.isArray(obj.tests)) {
        return { ok: false, error: "Ce fichier ne ressemble pas à une sauvegarde " + DD.APP_NAME + '.' };
      }
      this.state = normalize(obj);
      this.save();
      return { ok: true };
    },

    // --- Activité --------------------------------------------------------
    // Appelé à chaque frappe : cumule le temps réellement passé à taper (pauses > 3 s ignorées).
    tick(now) {
      now = now || Date.now();
      if (this._last && now - this._last < 3000) this._day().sec += (now - this._last) / 1000;
      this._last = now;
      this.touch();
    },
    _day(ts) {
      const k = DD.fmt.dayKey(ts);
      return this.state.days[k] || (this.state.days[k] = { sec: 0, n: 0 });
    },
    activityDone() {
      this._day().n++;
      this.touch();
    },
    todaySec() {
      const d = this.state.days[DD.fmt.dayKey()];
      return d ? d.sec : 0;
    },
    streak() {
      const goal = this.state.settings.dailyGoalMin * 60;
      const ok = (k) => ((this.state.days[k] && this.state.days[k].sec) || 0) >= goal;
      const keyOf = (d) => DD.fmt.dayKey(d.getTime());
      const cursor = new Date();
      cursor.setHours(12, 0, 0, 0);
      const todayDone = ok(keyOf(cursor));
      if (!todayDone) cursor.setDate(cursor.getDate() - 1);
      let current = 0;
      while (ok(keyOf(cursor))) {
        current++;
        cursor.setDate(cursor.getDate() - 1);
      }
      // meilleure série
      const keys = Object.keys(this.state.days).filter(ok).sort();
      let best = 0,
        run = 0,
        prev = null;
      for (const k of keys) {
        const dt = DD.fmt.dayDate(k);
        if (prev && Math.round((dt - prev) / 86400000) === 1) run++;
        else run = 1;
        if (run > best) best = run;
        prev = dt;
      }
      return { current, best: Math.max(best, current), todayDone, todaySec: this.todaySec(), goalSec: goal };
    },

    // --- Frappes ----------------------------------------------------------
    recordChar(ch, ok) {
      const c = this.state.chars[ch] || (this.state.chars[ch] = { n: 0, m: 0 });
      c.n++;
      if (!ok) c.m++;
    },

    // --- Leçons & modules -------------------------------------------------
    lesson(id) {
      return this.state.lessons[id];
    },
    recordLesson(id, res) {
      const l = this.state.lessons[id] || (this.state.lessons[id] = { done: false, stars: 0, bestWpm: 0, bestAcc: 0, tries: 0 });
      l.tries++;
      l.bestWpm = Math.max(l.bestWpm, Math.round(res.wpm));
      l.bestAcc = Math.max(l.bestAcc, Math.round(res.acc * 10) / 10);
      if (res.passed) {
        l.done = true;
        l.stars = Math.max(l.stars, res.stars);
      }
      this.save();
    },
    // Étapes d'une leçon (intro, répétition, ...) : { done, bestAcc, bestWpm, tries }
    stage(lessonId, stage) {
      const l = this.state.lessons[lessonId];
      return (l && l.stages && l.stages[stage]) || null;
    },
    recordStage(lessonId, stage, res) {
      const l = this.state.lessons[lessonId] || (this.state.lessons[lessonId] = { done: false, stars: 0, bestWpm: 0, bestAcc: 0, tries: 0 });
      if (!l.stages) l.stages = {};
      const s = l.stages[stage] || (l.stages[stage] = { done: false, bestAcc: 0, bestWpm: 0, tries: 0 });
      s.tries++;
      s.bestAcc = Math.max(s.bestAcc, Math.round(num(res.acc, 0) * 10) / 10);
      s.bestWpm = Math.max(s.bestWpm, Math.round(num(res.wpm, 0)));
      if (res.passed) s.done = true;
      this.save();
    },
    // Fin de module : e1, e2, e3 (endurance), mastery (maîtrise), revision (mélange)
    endDone(modId, step) {
      const m = this.state.modules[modId];
      return !!(m && ((m.end && m.end[step]) || m.skipped || m.done));
    },
    recordEnd(modId, step) {
      const m = this.state.modules[modId] || (this.state.modules[modId] = { t: Date.now() });
      m.end = m.end || {};
      m.end[step] = true;
      this.save();
    },
    moduleDone(mod) {
      const m = this.state.modules[mod.id];
      if (m && (m.skipped || m.done)) return true;
      const lessonsOk = mod.lessons.every((l) => this.state.lessons[l.id] && this.state.lessons[l.id].done);
      return lessonsOk && END_STEPS.every((s) => !!(m && m.end && m.end[s]));
    },
    // Avancement du module : leçons + étapes de fin de module
    moduleProgress(mod) {
      const m = this.state.modules[mod.id];
      const lessons = mod.lessons.filter((l) => this.state.lessons[l.id] && this.state.lessons[l.id].done).length;
      const end = END_STEPS.filter((s) => m && m.end && m.end[s]).length;
      return lessons + end;
    },
    moduleTotal(mod) {
      return mod.lessons.length + END_STEPS.length;
    },
    // Toutes les leçons faites : la fin de module est ouverte
    lessonsDone(mod) {
      return mod.lessons.every((l) => this.state.lessons[l.id] && this.state.lessons[l.id].done);
    },
    moduleUnlocked(modules, idx) {
      if (idx === 0) return true;
      return this.moduleDone(modules[idx - 1]) || this.moduleDone(modules[idx]);
    },
    skipModule(id) {
      this.state.modules[id] = { skipped: true, t: Date.now() };
      this.state.flags.skip = true;
      this.save();
    },

    // --- Tests -------------------------------------------------------------
    addTest(t) {
      const tests = this.state.tests;
      tests.push(t);
      // On ne garde les courbes détaillées que pour les 60 derniers tests (place dans le stockage).
      for (let i = 0; i < tests.length - 60; i++) {
        delete tests[i].series;
        delete tests[i].errs;
      }
      this.save();
    },
    // Exercices de l'atelier : enregistrés à part des tests chronométrés (ils ne comptent ni pour les
    // badges de vitesse, ni pour le certificat), mais le temps passé compte pour l'objectif quotidien.
    addSession(s) {
      this.state.sessions.push(s);
      if (this.state.sessions.length > 500) this.state.sessions.splice(0, this.state.sessions.length - 500);
      this.save();
    },
    testsBy(fingers) {
      return this.state.tests.filter((t) => t.fingers === fingers);
    },
    bestWpm(fingers) {
      const v = this.testsBy(fingers).filter((t) => t.acc >= 90);
      return v.length ? Math.max(...v.map((t) => t.wpm)) : 0;
    },
  };

  Store.normalize = normalize; // exposé pour les tests de migration
  Store.END_STEPS = END_STEPS;
  DD.Store = Store;
  Store.load();
  window.addEventListener('beforeunload', () => Store.save());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) Store.save();
  });
})();
