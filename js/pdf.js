/* Générateur de certificat PDF minimal (une page A4 paysage, polices standard du PDF). Aucune dépendance. */
(function () {
  const DD = window.DD;

  // Polices de base du PDF (toujours disponibles dans un lecteur PDF) et équivalents pour mesurer le texte.
  const FONTS = {
    F1: { base: 'Helvetica', css: '100px Helvetica, Arial, sans-serif' },
    F2: { base: 'Helvetica-Bold', css: 'bold 100px Helvetica, Arial, sans-serif' },
    F3: { base: 'Times-Bold', css: 'bold 100px "Times New Roman", Times, serif' },
    F4: { base: 'Times-Italic', css: 'italic 100px "Times New Roman", Times, serif' },
  };

  const WIN_ANSI = { 0x2019: '\x92', 0x2018: '\x91', 0x201c: '\x93', 0x201d: '\x94', 0x2013: '\x96', 0x2014: '\x97', 0x2026: '\x85', 0x20ac: '\x80', 0x0153: '\x9c' };
  const toLatin1 = (s) => {
    let out = '';
    for (const ch of String(s).normalize('NFC')) {
      const c = ch.codePointAt(0);
      out += c < 256 ? ch : WIN_ANSI[c] || '?';
    }
    return out;
  };
  const pesc = (s) => toLatin1(s).replace(/([\\()])/g, '\\$1');

  let mctx = null;
  function textWidth(str, font, size, tracking) {
    if (!mctx) mctx = document.createElement('canvas').getContext('2d');
    mctx.font = FONTS[font].css;
    // On mesure à 100 px puis on met à l'échelle.
    const w = mctx.measureText(str).width * (size / 100);
    return w + (tracking || 0) * Math.max(0, Array.from(str).length - 1);
  }

  const col = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => (v / 255).toFixed(3)).join(' ');
  };
  const f2 = (n) => (+n).toFixed(2);

  function Page(w, h) {
    const ops = [];
    return {
      w,
      h,
      ops,
      rect(x, y, rw, rh, o) {
        o = o || {};
        if (o.fill) ops.push(col(o.fill) + ' rg');
        if (o.stroke) ops.push(col(o.stroke) + ' RG ' + f2(o.lw || 1) + ' w');
        ops.push([f2(x), f2(y), f2(rw), f2(rh)].join(' ') + ' re ' + (o.fill && o.stroke ? 'B' : o.fill ? 'f' : 'S'));
      },
      line(x1, y1, x2, y2, color, lw) {
        ops.push(col(color) + ' RG ' + f2(lw || 1) + ' w ' + f2(x1) + ' ' + f2(y1) + ' m ' + f2(x2) + ' ' + f2(y2) + ' l S');
      },
      circle(cx, cy, r, o) {
        const k = 0.5523 * r;
        if (o.fill) ops.push(col(o.fill) + ' rg');
        if (o.stroke) ops.push(col(o.stroke) + ' RG ' + f2(o.lw || 1) + ' w');
        ops.push(
          [f2(cx + r), f2(cy), 'm', f2(cx + r), f2(cy + k), f2(cx + k), f2(cy + r), f2(cx), f2(cy + r), 'c', f2(cx - k), f2(cy + r), f2(cx - r), f2(cy + k), f2(cx - r), f2(cy), 'c', f2(cx - r), f2(cy - k), f2(cx - k), f2(cy - r), f2(cx), f2(cy - r), 'c', f2(cx + k), f2(cy - r), f2(cx + r), f2(cy - k), f2(cx + r), f2(cy), 'c', o.fill && o.stroke ? 'B' : o.fill ? 'f' : 'S'].join(' ')
        );
      },
      star(cx, cy, R, r, fill) {
        const pts = [];
        for (let i = 0; i < 10; i++) {
          const a = Math.PI / 2 + (i * Math.PI) / 5;
          const rad = i % 2 ? r : R;
          pts.push(f2(cx + rad * Math.cos(a)) + ' ' + f2(cy + rad * Math.sin(a)));
        }
        ops.push(col(fill) + ' rg ' + pts.map((p, i) => p + (i ? ' l' : ' m')).join(' ') + ' h f');
      },
      text(str, x, y, font, size, color, o) {
        o = o || {};
        const tr = o.tracking || 0;
        const wd = textWidth(str, font, size, tr);
        if (o.align === 'center') x -= wd / 2;
        else if (o.align === 'right') x -= wd;
        ops.push('BT ' + col(color) + ' rg /' + font + ' ' + f2(size) + ' Tf ' + f2(tr) + ' Tc ' + f2(x) + ' ' + f2(y) + ' Td (' + pesc(str) + ') Tj ET');
        return wd;
      },
      width: textWidth,
    };
  }

  function toPDF(page) {
    const content = page.ops.join('\n');
    const objs = [];
    objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    objs[2] = '<< /Type /Pages /Kids [3 0 R] /Count 1 >>';
    objs[3] =
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + page.w + ' ' + page.h + '] /Contents 4 0 R /Resources << /Font << ' +
      Object.keys(FONTS).map((k, i) => '/' + k + ' ' + (5 + i) + ' 0 R').join(' ') + ' >> >> >>';
    objs[4] = '<< /Length ' + content.length + ' >>\nstream\n' + content + '\nendstream';
    Object.keys(FONTS).forEach((k, i) => {
      objs[5 + i] = '<< /Type /Font /Subtype /Type1 /BaseFont /' + FONTS[k].base + ' /Encoding /WinAnsiEncoding >>';
    });
    let out = '%PDF-1.4\n';
    const offs = [];
    for (let i = 1; i < objs.length; i++) {
      offs[i] = out.length;
      out += i + ' 0 obj\n' + objs[i] + '\nendobj\n';
    }
    const xref = out.length;
    out += 'xref\n0 ' + objs.length + '\n0000000000 65535 f \n';
    for (let i = 1; i < objs.length; i++) out += String(offs[i]).padStart(10, '0') + ' 00000 n \n';
    out += 'trailer\n<< /Size ' + objs.length + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF';
    const bytes = new Uint8Array(out.length);
    for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 255;
    return new Blob([bytes], { type: 'application/pdf' });
  }

  const build = toPDF;

  const INK = '#1c2333';
  const ACCENT = '#2f5bea';
  const GOLD = '#c8962b';
  const MUTED = '#667085';

  /**
   * d = { name, wpm, acc, dur, date, level, modulesDone, modulesTotal, baseline, beat }
   */
  function certificate(d) {
    const W = 842,
      H = 595;
    const p = Page(W, H);
    p.rect(0, 0, W, H, { fill: '#fdfbf6' });
    p.rect(26, 26, W - 52, H - 52, { stroke: ACCENT, lw: 3 });
    p.rect(36, 36, W - 72, H - 72, { stroke: GOLD, lw: 1 });
    // coins
    [[36, 36], [W - 36, 36], [36, H - 36], [W - 36, H - 36]].forEach(([x, y]) => p.circle(x, y, 5, { fill: GOLD }));

    p.star(W / 2, H - 82, 17, 7, GOLD);
    p.text(DD.APP_NAME.toUpperCase(), W / 2, H - 120, 'F2', 12, ACCENT, { align: 'center', tracking: 4 });
    p.text('CERTIFICAT DE DACTYLOGRAPHIE', W / 2, H - 170, 'F3', 36, INK, { align: 'center' });
    p.text('Ce certificat est décerné à', W / 2, H - 208, 'F1', 14, MUTED, { align: 'center' });

    let size = 46;
    const name = d.name || 'Un(e) dactylo motivé(e)';
    while (size > 22 && p.width(name, 'F4', size) > 600) size -= 2;
    p.text(name, W / 2, H - 262, 'F4', size, INK, { align: 'center' });
    p.line(W / 2 - 260, H - 274, W / 2 + 260, H - 274, GOLD, 1);

    p.text('pour avoir atteint une vitesse de', W / 2, H - 312, 'F1', 14, MUTED, { align: 'center' });
    p.text(Math.round(d.wpm) + ' MPM', W / 2, H - 372, 'F2', 62, ACCENT, { align: 'center' });
    p.text('à dix doigts, avec une précision de ' + Math.round(d.acc) + ' %', W / 2, H - 402, 'F1', 16, INK, { align: 'center' });
    const mins = Math.round(d.dur / 60);
    p.text('lors d\'un test chronométré de ' + mins + ' minute' + (mins > 1 ? 's' : '') + '  -  niveau ' + d.level, W / 2, H - 428, 'F1', 13, MUTED, { align: 'center' });
    if (d.beat) {
      p.text('Son niveau de départ à deux doigts (' + d.baseline + ' MPM) est dépassé.', W / 2, H - 452, 'F2', 12, GOLD, { align: 'center' });
    }

    p.text('Délivré le ' + d.date, 70, 66, 'F1', 11, MUTED);
    p.text('Parcours : ' + d.modulesDone + ' module' + (d.modulesDone > 1 ? 's' : '') + ' sur ' + d.modulesTotal + ' terminé' + (d.modulesDone > 1 ? 's' : ''), W - 70, 66, 'F1', 11, MUTED, { align: 'right' });
    p.text('MPM = mots par minute (1 mot = 5 caractères). Précision = frappes justes / frappes totales.', W / 2, 50, 'F1', 8, MUTED, { align: 'center' });

    return build(p);
  }

  DD.PDF = { certificate };
})();
