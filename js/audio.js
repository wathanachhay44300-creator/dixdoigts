/* Sons de frappe synthétisés (aucun fichier audio : tout est généré avec WebAudio). */
(function () {
  const DD = window.DD;
  let ctx = null;
  let noise = null;

  function ensure() {
    const s = DD.Store.state.settings;
    if (!s.sound) return null;
    if (!ctx) {
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        return null;
      }
      noise = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function burst(type, freq, q, dur, gain, t0) {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq * (0.92 + Math.random() * 0.16);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(ctx.destination);
    src.start(t0, Math.random() * 0.1);
    src.stop(t0 + dur + 0.02);
  }

  function tone(type, f0, f1, dur, gain, t0) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  DD.Audio = {
    unlock() {
      ensure();
    },
    click(isSpace) {
      const c = ensure();
      if (!c) return;
      const s = DD.Store.state.settings;
      const v = s.volume;
      const t = c.currentTime;
      if (s.soundProfile === 'doux') {
        burst('lowpass', 1400, 0.7, 0.05, 0.35 * v, t);
      } else if (s.soundProfile === 'machine') {
        burst('bandpass', isSpace ? 700 : 1100, 0.9, 0.07, 0.6 * v, t);
        tone('sine', isSpace ? 90 : 130, 60, 0.05, 0.35 * v, t);
      } else {
        burst('bandpass', isSpace ? 1800 : 3200, 1.1, 0.03, 0.55 * v, t);
        tone('sine', isSpace ? 150 : 210, 120, 0.02, 0.2 * v, t);
      }
    },
    error() {
      const c = ensure();
      if (!c) return;
      const v = DD.Store.state.settings.volume;
      tone('triangle', 150, 80, 0.14, 0.3 * v, c.currentTime);
    },
    success() {
      const c = ensure();
      if (!c) return;
      const v = DD.Store.state.settings.volume;
      const t = c.currentTime;
      [660, 880, 1320].forEach((f, i) => tone('sine', f, f, 0.22, 0.25 * v, t + i * 0.09));
    },
    fail() {
      const c = ensure();
      if (!c) return;
      const v = DD.Store.state.settings.volume;
      const t = c.currentTime;
      [330, 247].forEach((f, i) => tone('triangle', f, f, 0.22, 0.25 * v, t + i * 0.12));
    },
  };
})();
