/* Graphiques SVG sans dépendance. */
(function () {
  const DD = window.DD;

  function niceMax(v) {
    if (v <= 10) return 10;
    const steps = [10, 20, 30, 40, 50, 60, 80, 100, 120, 150, 200, 250, 300];
    return steps.find((s) => s >= v) || Math.ceil(v / 50) * 50;
  }

  const Charts = {
    /**
     * Courbe.
     * o = { pts:[{y, label, title}], baseline:{y,label}, height, area:true, errs:[...], color, yMax }
     * Les abscisses sont les indices (1, 2, 3, ...). Les étiquettes x : 'xLabels' (fonction i -> texte ou '').
     */
    line(o) {
      const W = 680,
        H = o.height || 260;
      const m = { l: 44, r: 16, t: 16, b: 30 };
      const pts = o.pts || [];
      const ys = pts.map((p) => p.y).concat(o.baseline ? [o.baseline.y] : []);
      const ymax = o.yMax || niceMax(Math.max(10, ...ys) * 1.08);
      const n = Math.max(pts.length, 2);
      const x = (i) => m.l + ((W - m.l - m.r) * (pts.length > 1 ? i : 0.5)) / Math.max(1, pts.length - 1);
      const y = (v) => H - m.b - ((H - m.t - m.b) * v) / ymax;
      let s = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + DD.esc(o.aria || 'Graphique') + '">';
      // grille + axe y
      const ticks = 4;
      for (let i = 0; i <= ticks; i++) {
        const v = (ymax * i) / ticks;
        s += '<line class="grid" x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + y(v) + '" y2="' + y(v) + '"/>';
        s += '<text class="ax" x="' + (m.l - 8) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + Math.round(v) + '</text>';
      }
      // étiquettes x
      if (o.xLabels) {
        const every = Math.max(1, Math.ceil(pts.length / 8));
        pts.forEach((p, i) => {
          if (i % every !== 0 && i !== pts.length - 1) return;
          const t = o.xLabels(i);
          if (t) s += '<text class="ax" x="' + x(i) + '" y="' + (H - 8) + '" text-anchor="middle">' + DD.esc(t) + '</text>';
        });
      }
      // barres d'erreurs
      if (o.errs && pts.length) {
        const mx = Math.max(1, ...o.errs);
        const bw = Math.max(2, Math.min(10, (W - m.l - m.r) / pts.length - 2));
        o.errs.forEach((e, i) => {
          if (!e) return;
          const hh = Math.min(28, 6 + (22 * e) / mx);
          s += '<rect class="errbar" x="' + (x(i) - bw / 2) + '" y="' + (H - m.b - hh) + '" width="' + bw + '" height="' + hh + '" rx="1.5"><title>' + e + ' erreur' + (e > 1 ? 's' : '') + '</title></rect>';
        });
      }
      // ligne de référence (niveau à deux doigts)
      if (o.baseline) {
        s += '<line class="baseline" x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + y(o.baseline.y) + '" y2="' + y(o.baseline.y) + '"/>';
        s += '<text class="baseline-label" x="' + (W - m.r) + '" y="' + (y(o.baseline.y) - 6) + '" text-anchor="end">' + DD.esc(o.baseline.label) + '</text>';
      }
      if (pts.length) {
        const d = pts.map((p, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(p.y).toFixed(1)).join(' ');
        if (o.area && pts.length > 1) {
          s += '<path class="area" d="' + d + ' L' + x(pts.length - 1).toFixed(1) + ' ' + y(0) + ' L' + x(0).toFixed(1) + ' ' + y(0) + ' Z"/>';
        }
        if (pts.length > 1) s += '<path class="curve" d="' + d + '"/>';
        const r = pts.length > 60 ? 0 : pts.length > 25 ? 2.5 : 4;
        if (r)
          pts.forEach((p, i) => {
            s += '<circle class="dot' + (p.hl ? ' hl' : '') + '" cx="' + x(i).toFixed(1) + '" cy="' + y(p.y).toFixed(1) + '" r="' + r + '"><title>' + DD.esc(p.title || String(p.y)) + '</title></circle>';
          });
      } else {
        s += '<text class="ax" x="' + W / 2 + '" y="' + H / 2 + '" text-anchor="middle">Pas encore de données</text>';
      }
      return s + '</svg>';
    },

    // Barres : minutes d'entraînement par jour, avec la ligne d'objectif.
    bars(o) {
      const W = 680,
        H = o.height || 200;
      const m = { l: 36, r: 12, t: 12, b: 28 };
      const vals = o.values; // [{label, v, title}]
      const ymax = niceMax(Math.max(o.goal || 0, ...vals.map((d) => d.v), 5) * 1.1);
      const y = (v) => H - m.b - ((H - m.t - m.b) * v) / ymax;
      const bw = (W - m.l - m.r) / vals.length;
      let s = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + DD.esc(o.aria || 'Minutes par jour') + '">';
      for (let i = 0; i <= 4; i++) {
        const v = (ymax * i) / 4;
        s += '<line class="grid" x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + y(v) + '" y2="' + y(v) + '"/>';
        s += '<text class="ax" x="' + (m.l - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + Math.round(v) + '</text>';
      }
      vals.forEach((d, i) => {
        const bx = m.l + i * bw + bw * 0.18;
        const h = Math.max(0, H - m.b - y(d.v));
        s += '<rect class="bar' + (o.goal && d.v >= o.goal ? ' ok' : '') + '" x="' + bx.toFixed(1) + '" y="' + y(d.v).toFixed(1) + '" width="' + (bw * 0.64).toFixed(1) + '" height="' + h.toFixed(1) + '" rx="3"><title>' + DD.esc(d.title || '') + '</title></rect>';
        if (i % Math.ceil(vals.length / 7) === 0 || i === vals.length - 1)
          s += '<text class="ax" x="' + (bx + bw * 0.32).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle">' + DD.esc(d.label) + '</text>';
      });
      if (o.goal) {
        s += '<line class="baseline" x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + y(o.goal) + '" y2="' + y(o.goal) + '"/>';
        s += '<text class="baseline-label" x="' + (W - m.r) + '" y="' + (y(o.goal) - 5) + '" text-anchor="end">objectif ' + o.goal + ' min</text>';
      }
      return s + '</svg>';
    },
  };

  DD.Charts = Charts;
})();
