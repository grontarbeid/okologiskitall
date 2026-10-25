/* Økologisk landbruk i Norge – beregninger, figurer og tall i teksten.
   Siden leser bare datasettene via dash.data(id). Alle tall i teksten er merket med
   data-source/data-field og fylles inn her; figurene tegnes på nytt når data eller bredde endres.
   Samme fil brukes i Claude-dashbordet og på nettsiden (der gir dash-adapter.js det samme dash-grensesnittet). */

const MAAL = { andel: 10, aar: 2032 }; // Nasjonal strategi for økologisk jordbruk 2025–2032

/* ======================================================================= beregninger */

dash.calc('andel_beregnet', {
  title: 'Økologisk andel, beregnet',
  description: 'Økologisk areal med og uten karens i prosent av jordbruksarealet i drift, per år.',
  inputs: ['ssb_areal', 'ssb_jordbruksareal'],
  fn: (ssb_areal, ssb_jordbruksareal) => {
    const jord = new Map(ssb_jordbruksareal.map((r) => [String(r.aar), Number(r.jordbruksareal_dekar)]));
    return ssb_areal
      .filter((r) => jord.get(String(r.aar)) > 0)
      .map((r) => ({
        aar: String(r.aar),
        andel_inkl_karens: (100 * Number(r.areal_i_alt_dekar)) / jord.get(String(r.aar)),
        andel_godkjent: (100 * Number(r.godkjent_areal_dekar)) / jord.get(String(r.aar)),
      }));
  },
});

dash.calc('nokkeltall', {
  title: 'Nøkkeltall siste år',
  description: 'Siste år og endringen fra året før for økologisk andel, økologisk areal og antall gårder.',
  inputs: ['ssb_areal', 'andel_beregnet'],
  fn: (ssb_areal, andel_beregnet) => {
    const a = [...ssb_areal].sort((x, y) => x.aar - y.aar);
    const [f, s] = a.slice(-2);
    const andel = new Map(andel_beregnet.map((r) => [String(r.aar), r]));
    const as = andel.get(String(s.aar));
    const af = andel.get(String(f.aar));
    return [{
      aar: String(s.aar),
      forrige_aar: String(f.aar),
      andel: as.andel_inkl_karens,
      andel_endring_pp: as.andel_inkl_karens - af.andel_inkl_karens,
      andel_godkjent: as.andel_godkjent,
      areal: Number(s.areal_i_alt_dekar),
      karens: Number(s.karens_areal_dekar),
      areal_endring_prosent: (100 * (Number(s.areal_i_alt_dekar) - Number(f.areal_i_alt_dekar))) / Number(f.areal_i_alt_dekar),
      gaarder: Number(s.bedrifter),
      gaarder_endring: Number(s.bedrifter) - Number(f.bedrifter),
    }];
  },
});

dash.calc('endring_areal', {
  title: 'Årlig endring i økologisk areal',
  description: 'Endring fra året før i økologisk areal (dekar, med karens) og i antall gårder med økologisk drift.',
  inputs: ['ssb_areal'],
  fn: (ssb_areal) => {
    const a = [...ssb_areal].sort((x, y) => x.aar - y.aar);
    return a.slice(1).map((r, i) => ({
      aar: String(r.aar),
      areal_endring_dekar: Number(r.areal_i_alt_dekar) - Number(a[i].areal_i_alt_dekar),
      gaarder_endring: Number(r.bedrifter) - Number(a[i].bedrifter),
    }));
  },
});

dash.calc('maal_2032', {
  title: 'Avstand til målet for 2032',
  description: 'Areal som må være økologisk i 2032 (10 % av jordbruksarealet i drift siste år), hvor mye som mangler, hvor mye som må legges om per år, og faktisk endring per år de siste fem og ti årene.',
  inputs: ['ssb_areal', 'ssb_jordbruksareal'],
  fn: (ssb_areal, ssb_jordbruksareal) => {
    const MAAL_PROSENT = 10;
    const MAAL_AAR = 2032;
    const a = [...ssb_areal].sort((x, y) => x.aar - y.aar);
    const siste = a[a.length - 1];
    const jord = [...ssb_jordbruksareal].sort((x, y) => x.aar - y.aar).filter((r) => Number(r.aar) <= Number(siste.aar)).pop();
    const naa = Number(siste.areal_i_alt_dekar);
    const maal = (Number(jord.jordbruksareal_dekar) * MAAL_PROSENT) / 100;
    const aarIgjen = MAAL_AAR - Number(siste.aar);
    const snitt = (n) => (naa - Number(a[a.length - 1 - n].areal_i_alt_dekar)) / n;
    const s5 = snitt(5);
    return [{
      aar: String(siste.aar),
      maal_prosent: MAAL_PROSENT,
      maal_aar: MAAL_AAR,
      maal_dekar: maal,
      okologisk_dekar: naa,
      mangler_dekar: maal - naa,
      aar_igjen: aarIgjen,
      trengs_per_aar: aarIgjen > 0 ? (maal - naa) / aarIgjen : null,
      snitt_siste_5_aar: s5,
      snitt_siste_5_aar_abs: Math.abs(s5),
      retning_siste_5_aar: s5 > 0 ? 'økt' : s5 < 0 ? 'gått ned' : 'stått stille',
      snitt_siste_10_aar: snitt(10),
    }];
  },
});

dash.calc('snitt_per_gard', {
  title: 'Økologisk areal per gård',
  description: 'Økologisk areal (dekar, med karens) delt på antall gårder med økologisk drift, per år.',
  inputs: ['ssb_areal'],
  fn: (ssb_areal) => ssb_areal.map((r) => ({
    aar: String(r.aar),
    dekar_per_gard: Number(r.areal_i_alt_dekar) / Number(r.bedrifter),
  })),
});

dash.calc('andeler_siste', {
  title: 'Økologisk andel per område',
  description: 'Siste år med tall for økologisk andel av jordbruksarealet, av melk, egg og slakt per dyreslag, og av omsetningen i dagligvarehandelen.',
  inputs: ['andel_beregnet', 'ldir_melk', 'ldir_egg', 'ldir_kjott', 'ldir_dagligvare'],
  fn: (andel_beregnet, ldir_melk, ldir_egg, ldir_kjott, ldir_dagligvare) => {
    const siste = (rader, felt) => rader
      .filter((r) => r[felt] !== '' && r[felt] != null)
      .sort((x, y) => x.aar - y.aar)
      .pop();
    const rad = (omraade, rader, felt) => {
      const r = siste(rader, felt);
      return r && { omraade, aar: String(r.aar), andel_prosent: Number(r[felt]) };
    };
    const dyr = (navn) => ldir_kjott.filter((r) => r.dyreslag === navn);
    return [
      rad('Jordbruksareal', andel_beregnet, 'andel_inkl_karens'),
      rad('Melk', ldir_melk, 'okologisk_andel_av_all_melk_prosent'),
      rad('Egg', ldir_egg, 'andel_av_alle_egg_prosent'),
      rad('Sau og lam', dyr('Sau og lam'), 'andel_prosent'),
      rad('Storfekjøtt', dyr('Storfe'), 'andel_prosent'),
      rad('Kylling og kalkun', dyr('Fjørfe'), 'andel_prosent'),
      rad('Svinekjøtt', dyr('Svin'), 'andel_prosent'),
      rad('Dagligvarehandelen', ldir_dagligvare, 'andel_prosent'),
    ].filter(Boolean);
  },
});

dash.calc('europa_plass', {
  title: 'Norges plass i Europa',
  description: 'Norges plass når landene rangeres etter økologisk andel av jordbruksarealet (Eurostat, siste år).',
  inputs: ['eurostat_europa'],
  fn: (eurostat_europa) => {
    const r = [...eurostat_europa].sort((x, y) => Number(y.andel_prosent) - Number(x.andel_prosent));
    const i = r.findIndex((x) => x.landkode === 'NO');
    return [{ aar: String(r[i].aar), plass: i + 1, antall_land: r.length, andel_prosent: Number(r[i].andel_prosent) }];
  },
});

dash.calc('fylker_endring', {
  title: 'Endring per fylke siste år',
  description: 'Endring fra året før per fylke i økologisk andel (prosentpoeng), økologisk areal (dekar) og antall gårder.',
  inputs: ['ssb_fylker'],
  fn: (ssb_fylker) => {
    const aar = [...new Set(ssb_fylker.map((r) => Number(r.aar)))].sort((a, b) => a - b);
    const [f, s] = aar.slice(-2);
    const forrige = new Map(ssb_fylker.filter((r) => Number(r.aar) === f).map((r) => [r.fylkesnr, r]));
    return ssb_fylker
      .filter((r) => Number(r.aar) === s && forrige.has(r.fylkesnr))
      .map((r) => {
        const p = forrige.get(r.fylkesnr);
        return {
          fylkesnr: r.fylkesnr,
          fylke: r.fylke,
          aar: String(s),
          forrige_aar: String(f),
          andel_endring_pp: Number(r.andel_okologisk_prosent) - Number(p.andel_okologisk_prosent),
          areal_endring_dekar: Number(r.areal_i_alt_dekar) - Number(p.areal_i_alt_dekar),
          gaarder_endring: Number(r.bedrifter) - Number(p.bedrifter),
        };
      });
  },
});

/* ======================================================================= formatering */

const nf = {};
const tallFmt = (des) => {
  if (!nf[des]) nf[des] = new Intl.NumberFormat('nb-NO', { minimumFractionDigits: des, maximumFractionDigits: des });
  return (v) => nf[des].format(v);
};
const fmt = { int: tallFmt(0), d1: tallFmt(1), d2: tallFmt(2) };
const medFortegn = (f) => (v) => (v > 0 && f(v) !== f(0) ? '+' : '') + f(v);
const FMT = {
  int: fmt.int, d1: fmt.d1, d2: fmt.d2,
  'int+': medFortegn(fmt.int), 'd1+': medFortegn(fmt.d1), 'd2+': medFortegn(fmt.d2),
};
const pst = (v, des = 1) => tallFmt(des)(v) + ' %';
const dekar = (v) => fmt.int(v) + ' dekar';
const mkr = (v) => fmt.int(v) + ' mill. kr';
const tonn = (v) => fmt.int(v) + ' tonn';
const pstAkse = (v) => fmt.int(v) + ' %';
const kompakt = (v) => {
  const a = Math.abs(v);
  if (a >= 1e6) return tallFmt(a >= 1e7 ? 0 : 1)(v / 1e6) + ' mill.';
  return fmt.int(v);
};

/* ======================================================================= data */

const D = (id) => dash.data(id);
const rader = (id) => {
  const d = D(id);
  return d.status === 'ok' && Array.isArray(d.data) ? d.data : [];
};
const N = (v) => (v === '' || v === null || v === undefined ? null : Number(v));
const sisteAar = (rows, felt = 'aar') => d3.max(rows, (r) => Number(r[felt]));
const farge = (i) => dash.colors[i];
const DEMPET = 'var(--cds-chart-muted)';
const REF = 'var(--cds-chart-reference)';

/* ======================================================================= byggeklosser */

function lagEl(tag, cls, tekst) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (tekst != null) e.textContent = tekst;
  return e;
}

function melding(tekst) {
  return lagEl('div', 'oko-chart-msg', tekst);
}

function svgI(el, w, h, etikett) {
  const svg = d3.select(el).append('svg')
    .attr('viewBox', `0 0 ${w} ${h}`)
    .attr('width', '100%')
    .attr('role', 'img');
  const kort = el.closest('.oko-card');
  const t = etikett || kort?.querySelector('.oko-card-title')?.textContent;
  if (t) svg.attr('aria-label', t);
  return svg;
}

function tekstBredde(svg, s, cls = 'oko-ticklabel') {
  const t = svg.append('text').attr('class', cls).attr('x', -9999).attr('y', -9999).text(s);
  const w = t.node().getComputedTextLength();
  t.remove();
  return w;
}

function forkort(svg, s, maks, cls) {
  if (tekstBredde(svg, s, cls) <= maks) return s;
  let t = s;
  while (t.length > 3 && tekstBredde(svg, t + '…', cls) > maks) t = t.slice(0, -1);
  return t.trimEnd() + '…';
}

function forklaring(el, punkter) {
  const ul = lagEl('ul', 'oko-legend');
  for (const p of punkter) {
    const li = lagEl('li');
    const k = lagEl('span', 'oko-key oko-key-' + (p.form || 'box'));
    if (p.form === 'line' || p.form === 'dash') k.style.borderTopColor = p.farge;
    else if (p.form === 'ring') k.style.borderColor = p.farge;
    else k.style.background = p.farge;
    if (p.opasitet != null) k.style.opacity = p.opasitet;
    li.append(k, document.createTextNode(p.tekst));
    ul.appendChild(li);
  }
  el.appendChild(ul);
  return ul;
}

function verktoytips(el) {
  const tip = lagEl('div', 'oko-tip');
  tip.hidden = true;
  el.appendChild(tip);
  return {
    vis(ev, tittel, linjer, notat) {
      tip.replaceChildren(lagEl('div', 'oko-tip-title', tittel));
      for (const l of linjer) {
        const rad = lagEl('div', 'oko-tip-row');
        if (l.farge) {
          const k = lagEl('span', 'oko-key ' + (l.form === 'line' ? 'oko-key-line' : 'oko-key-box'));
          if (l.form === 'line') k.style.borderTopColor = l.farge;
          else k.style.background = l.farge;
          if (l.opasitet != null) k.style.opacity = l.opasitet;
          rad.appendChild(k);
        }
        rad.appendChild(lagEl('b', null, l.verdi));
        if (l.tekst) rad.appendChild(lagEl('span', null, l.tekst));
        tip.appendChild(rad);
      }
      if (notat) tip.appendChild(lagEl('div', 'oko-tip-note', notat));
      tip.hidden = false;
      const [px, py] = d3.pointer(ev, el);
      const W = el.clientWidth;
      const tw = tip.offsetWidth;
      const th = tip.offsetHeight;
      let x = px + 14;
      if (x + tw > W) x = px - tw - 14;
      if (x < 0) x = Math.max(0, W - tw);
      let y = py - th - 10;
      if (y < 0) y = py + 18;
      tip.style.left = `${x}px`;
      tip.style.top = `${y}px`;
    },
    skjul() {
      tip.hidden = true;
    },
  };
}

const rektSti = (x, y0, y1, w) => `M${x},${y0}V${y1}H${x + w}V${y0}Z`;

function soyleSti(x, y0, y1, w, r = 4) {
  const h = Math.abs(y1 - y0);
  if (h < 0.5) return '';
  r = Math.min(r, w / 2, h);
  if (y1 < y0) return `M${x},${y0}V${y1 + r}Q${x},${y1} ${x + r},${y1}H${x + w - r}Q${x + w},${y1} ${x + w},${y1 + r}V${y0}Z`;
  return `M${x},${y0}V${y1 - r}Q${x},${y1} ${x + r},${y1}H${x + w - r}Q${x + w},${y1} ${x + w},${y1 - r}V${y0}Z`;
}

function liggendeSti(x0, x1, y, h, r = 4) {
  const w = Math.abs(x1 - x0);
  if (w < 0.5) return '';
  r = Math.min(r, h / 2, w);
  if (x1 > x0) return `M${x0},${y}H${x1 - r}Q${x1},${y} ${x1},${y + r}V${y + h - r}Q${x1},${y + h} ${x1 - r},${y + h}H${x0}Z`;
  return `M${x0},${y}H${x1 + r}Q${x1},${y} ${x1},${y + r}V${y + h - r}Q${x1},${y + h} ${x1 + r},${y + h}H${x0}Z`;
}

function aarSteg(x0, x1, bredde) {
  const maks = Math.max(2, Math.floor(bredde / 46));
  for (const steg of [1, 2, 5, 10, 20, 50]) {
    const forste = Math.ceil(x0 / steg) * steg;
    const n = Math.floor((x1 - forste) / steg) + 1;
    if (n <= maks) return d3.range(forste, x1 + 0.001, steg);
  }
  return [x0, x1];
}

function yAkse(svg, y, ml, xr, tf) {
  const ticks = y.ticks(5);
  svg.append('g').selectAll('line').data(ticks).join('line')
    .attr('class', 'oko-gridline')
    .attr('x1', ml).attr('x2', xr)
    .attr('y1', (t) => Math.round(y(t)) + 0.5).attr('y2', (t) => Math.round(y(t)) + 0.5);
  svg.append('g').selectAll('text').data(ticks).join('text')
    .attr('class', 'oko-ticklabel')
    .attr('x', ml - 8).attr('y', (t) => y(t)).attr('dy', '0.32em').attr('text-anchor', 'end')
    .text(tf);
  if (y.domain()[0] < 0) {
    svg.append('line').attr('class', 'oko-baseline')
      .attr('x1', ml).attr('x2', xr)
      .attr('y1', Math.round(y(0)) + 0.5).attr('y2', Math.round(y(0)) + 0.5);
  }
}

function venstreMarg(svg, y, tf) {
  return Math.ceil(d3.max(y.ticks(5), (t) => tekstBredde(svg, tf(t))) || 0) + 10;
}

/* ---------- stående søyler (også stablet og med negative verdier) ---------- */
function soyler(el, o) {
  const W = Math.max(260, el.clientWidth);
  const H = o.hoyde || 240;
  const kat = o.kategorier;
  const etikett = o.etikett || ((k) => k);
  const perKat = new Map(o.rader.map((r) => [r.x, r]));
  let lo = 0;
  let hi = 0;
  for (const r of o.rader) {
    if (o.stablet) {
      let p = 0;
      let n = 0;
      for (const s of o.serier) {
        const v = r[s.felt];
        if (v > 0) p += v;
        else if (v < 0) n += v;
      }
      hi = Math.max(hi, p);
      lo = Math.min(lo, n);
    } else {
      for (const s of o.serier) {
        const v = r[s.felt];
        if (v != null) {
          hi = Math.max(hi, v);
          lo = Math.min(lo, v);
        }
      }
    }
  }
  for (const ref of o.ref || []) {
    hi = Math.max(hi, ref.verdi);
    lo = Math.min(lo, ref.verdi);
  }
  if (hi === lo) hi = lo + 1;
  const svg = svgI(el, W, H);
  const mb = 24;
  const mt = o.ref?.length ? 18 : 10;
  const y = d3.scaleLinear([lo, hi], [H - mb, mt]).nice(5);
  const tf = o.akseFmt || fmt.int;
  const ml = venstreMarg(svg, y, tf);
  const merkelapper = kat.map(etikett);
  const lw = d3.max(merkelapper, (m) => tekstBredde(svg, m)) || 30;
  const mr = Math.max(6, Math.ceil(lw / 2) - 2);
  const x = d3.scaleBand(kat, [ml, W - mr]).paddingInner(0.3).paddingOuter(0.1);
  yAkse(svg, y, ml, W - mr, tf);
  if (lo >= 0) {
    svg.append('line').attr('class', 'oko-baseline')
      .attr('x1', ml).attr('x2', W - mr)
      .attr('y1', Math.round(y(0)) + 0.5).attr('y2', Math.round(y(0)) + 0.5);
  }
  const bw = Math.max(1, Math.min(24, x.bandwidth()));
  const off = (x.bandwidth() - bw) / 2;
  const fyll = (s, r) => (typeof s.farge === 'function' ? s.farge(r) : s.farge);
  const gk = svg.append('g');
  const grupper = new Map();
  for (const k of kat) {
    const r = perKat.get(k);
    if (!r) continue;
    const gx = x(k) + off;
    const g = gk.append('g');
    grupper.set(k, g);
    if (o.stablet) {
      let pos = 0;
      let neg = 0;
      const verdier = o.serier.map((s) => ({ s, v: r[s.felt] || 0 }));
      const sistePos = verdier.map((d) => d.v > 0).lastIndexOf(true);
      const sisteNeg = verdier.map((d) => d.v < 0).lastIndexOf(true);
      verdier.forEach((d, i) => {
        if (!d.v) return;
        const base = d.v > 0 ? pos : neg;
        const topp = base + d.v;
        let y0 = y(base);
        const y1 = y(topp);
        if (base !== 0) y0 += d.v > 0 ? -2 : 2;
        const ytterst = d.v > 0 ? i === sistePos : i === sisteNeg;
        const sti = ytterst ? soyleSti(gx, y0, y1, bw) : (Math.abs(y1 - y0) > 0.5 ? rektSti(gx, y0, y1, bw) : '');
        if (sti) g.append('path').attr('d', sti).style('fill', fyll(d.s, r)).style('opacity', d.s.opasitet ?? null);
        if (d.v > 0) pos = topp;
        else neg = topp;
      });
    } else {
      for (const s of o.serier) {
        const v = r[s.felt];
        if (v == null || v === 0) continue;
        g.append('path').attr('d', soyleSti(gx, y(0), y(v), bw))
          .style('fill', fyll(s, r))
          .style('opacity', typeof s.opasitet === 'function' ? s.opasitet(r) : (s.opasitet ?? null));
      }
    }
  }
  for (const ref of o.ref || []) {
    const yy = Math.round(y(ref.verdi)) + 0.5;
    svg.append('line').attr('class', 'oko-ref').attr('x1', ml).attr('x2', W - mr).attr('y1', yy).attr('y2', yy);
    svg.append('text').attr('class', 'oko-reflabel oko-halo').attr('x', W - mr).attr('y', yy - 5)
      .attr('text-anchor', 'end').text(ref.tekst);
  }
  // etiketter på x-aksen
  const steg = x.step();
  const minSteg = Math.max(1, Math.ceil((lw + 10) / steg));
  let vis;
  if (kat.every((k) => /^\d{4}$/.test(k))) {
    const pent = [1, 2, 5, 10, 20, 50].find((s) => s >= minSteg) || minSteg;
    vis = pent === 1 ? kat : kat.filter((k) => Number(k) % pent === 0);
    if (vis.length < 2) vis = [kat[0], kat[kat.length - 1]];
  } else {
    vis = kat.filter((k, i) => (kat.length - 1 - i) % minSteg === 0);
  }
  svg.append('g').selectAll('text').data(vis).join('text')
    .attr('class', 'oko-ticklabel')
    .attr('x', (k) => x(k) + x.bandwidth() / 2).attr('y', H - 6)
    .attr('text-anchor', 'middle')
    .text(etikett);
  // hover
  if (o.tips) {
    const tip = verktoytips(el);
    svg.append('g').selectAll('rect').data(kat.filter((k) => perKat.has(k))).join('rect')
      .attr('class', 'oko-hit')
      .attr('x', (k) => x(k) - (x.step() - x.bandwidth()) / 2).attr('width', x.step())
      .attr('y', mt).attr('height', H - mb - mt)
      .on('pointerenter pointermove', (ev, k) => {
        for (const [kk, g] of grupper) g.classed('oko-dim', kk !== k);
        const t = o.tips(perKat.get(k));
        tip.vis(ev, t.tittel, t.linjer, t.notat);
      })
      .on('pointerleave', () => {
        for (const g of grupper.values()) g.classed('oko-dim', false);
        tip.skjul();
      });
  }
  return svg;
}

/* ---------- linjer (med hull, bånd mellom to serier og mållinje) ---------- */
function medHull(punkter, maksHull = 1) {
  const ut = [];
  punkter.forEach((p, i) => {
    if (i && p.x - punkter[i - 1].x > maksHull) ut.push({ x: (p.x + punkter[i - 1].x) / 2, y: null });
    ut.push(p);
  });
  return ut;
}

function linjer(el, o) {
  const W = Math.max(260, el.clientWidth);
  const H = o.hoyde || 260;
  const serier = o.serier.map((s) => ({ ...s, punkter: s.punkter.filter((p) => p.y != null && !Number.isNaN(p.y)).sort((a, b) => a.x - b.x) }));
  const alle = serier.flatMap((s) => s.punkter);
  if (!alle.length) {
    el.appendChild(melding('Ingen tall å vise'));
    return null;
  }
  const x0 = o.x0 ?? d3.min(alle, (p) => p.x);
  const x1 = o.x1 ?? d3.max(alle, (p) => p.x);
  let hi = o.yMaks ?? d3.max(alle, (p) => p.y);
  if (o.mal) hi = Math.max(hi, o.mal.y);
  for (const r of o.ref || []) hi = Math.max(hi, r.verdi);
  const lo = Math.min(0, d3.min(alle, (p) => p.y));
  const svg = svgI(el, W, H);
  const mb = 24;
  const mt = o.mal ? 22 : 12;
  const y = d3.scaleLinear([lo, hi], [H - mb, mt]).nice(5);
  if (o.yMaks != null) y.domain([lo, o.yMaks]);
  const tf = o.akseFmt || fmt.int;
  const vf = o.verdiFmt || tf;
  const ml = venstreMarg(svg, y, tf);
  // endeetiketter: vis bare når de ikke kolliderer
  const ender = serier.filter((s) => s.punkter.length).map((s) => {
    const p = s.punkter[s.punkter.length - 1];
    return { s, p, tekst: o.endeTekst ? o.endeTekst(s, p) : `${s.navn} ${vf(p.y)}` };
  });
  let visEnder = o.endeEtiketter !== false && W >= 420 && ender.length > 0;
  if (visEnder) {
    const ys = ender.map((e) => y(e.p.y)).sort((a, b) => a - b);
    for (let i = 1; i < ys.length; i += 1) if (ys[i] - ys[i - 1] < 14) visEnder = false;
  }
  const aarBredde = tekstBredde(svg, '0000') + 4;
  let mr = Math.ceil(aarBredde / 2) + 2;
  if (visEnder) {
    const ew = d3.max(ender, (e) => tekstBredde(svg, e.tekst, 'oko-label')) + 12;
    if (ew > W * 0.34) visEnder = false;
    else mr = Math.max(mr, Math.ceil(ew));
  }
  if (o.mal) mr = Math.max(mr, Math.ceil(tekstBredde(svg, o.mal.tekst, 'oko-label') / 2) + 4);
  if (o.merkSiste && !visEnder) {
    for (const s of serier) {
      const p = s.punkter[s.punkter.length - 1];
      if (o.merkSiste.includes(s.felt) && p && p.x >= x1 - 0.5) mr = Math.max(mr, Math.ceil(tekstBredde(svg, vf(p.y), 'oko-label')) + 14);
    }
  }
  const x = d3.scaleLinear([x0, x1], [ml, W - mr]);
  yAkse(svg, y, ml, W - mr, tf);
  if (lo >= 0) {
    svg.append('line').attr('class', 'oko-baseline')
      .attr('x1', ml).attr('x2', W - mr)
      .attr('y1', Math.round(y(0)) + 0.5).attr('y2', Math.round(y(0)) + 0.5);
  }
  // loddrette referanser (brudd i serien)
  for (const v of o.vref || []) {
    const xx = Math.round(x(v.x)) + 0.5;
    svg.append('line').attr('class', 'oko-ref').attr('x1', xx).attr('x2', xx).attr('y1', mt).attr('y2', H - mb);
    svg.append('text').attr('class', 'oko-reflabel oko-halo').attr('x', xx + 4).attr('y', mt + 10).text(v.tekst);
  }
  // bånd mellom to serier
  if (o.baand) {
    const ov = new Map(serier.find((s) => s.felt === o.baand.over).punkter.map((p) => [p.x, p.y]));
    const un = new Map(serier.find((s) => s.felt === o.baand.under).punkter.map((p) => [p.x, p.y]));
    const xs = [...ov.keys()].filter((k) => un.has(k)).sort((a, b) => a - b);
    const pts = medHull(xs.map((k) => ({ x: k, y: ov.get(k), y0: un.get(k) })));
    svg.append('path')
      .attr('d', d3.area().defined((p) => p.y != null).x((p) => x(p.x)).y0((p) => y(p.y0)).y1((p) => y(p.y))(pts))
      .style('fill', o.baand.farge).style('opacity', 0.14);
  }
  // mållinje
  if (o.mal) {
    const fra = serier.find((s) => s.felt === o.mal.fra)?.punkter.slice(-1)[0];
    if (fra) {
      svg.append('line').attr('class', 'oko-ref')
        .attr('x1', x(fra.x)).attr('y1', y(fra.y)).attr('x2', x(o.mal.x)).attr('y2', y(o.mal.y));
    }
    svg.append('circle').attr('cx', x(o.mal.x)).attr('cy', y(o.mal.y)).attr('r', 5)
      .style('fill', 'var(--color-panel)').style('stroke', REF).style('stroke-width', 2);
    svg.append('text').attr('class', 'oko-label oko-halo')
      .attr('x', Math.min(x(o.mal.x), W - 2)).attr('y', y(o.mal.y) - 10)
      .attr('text-anchor', x(o.mal.x) > W - 60 ? 'end' : 'middle')
      .text(o.mal.tekst);
  }
  const linje = d3.line().defined((p) => p.y != null).x((p) => x(p.x)).y((p) => y(p.y));
  for (const s of serier) {
    if (!s.punkter.length) continue;
    svg.append('path').attr('class', 'oko-line' + (s.stiplet ? ' oko-line-dashed' : ''))
      .attr('d', linje(medHull(s.punkter, o.maksHull ?? 1)))
      .style('stroke', s.farge);
    // enslige punkter får en prikk
    s.punkter.forEach((p, i) => {
      const forr = s.punkter[i - 1];
      const neste = s.punkter[i + 1];
      const alene = (!forr || p.x - forr.x > (o.maksHull ?? 1)) && (!neste || neste.x - p.x > (o.maksHull ?? 1));
      if (alene) svg.append('circle').attr('class', 'oko-dot').attr('cx', x(p.x)).attr('cy', y(p.y)).attr('r', 3.5).style('fill', s.farge);
    });
    const siste = s.punkter[s.punkter.length - 1];
    svg.append('circle').attr('class', 'oko-dot').attr('cx', x(siste.x)).attr('cy', y(siste.y)).attr('r', 4).style('fill', s.farge);
    if (o.merkSiste?.includes(s.felt) && !visEnder) {
      svg.append('text').attr('class', 'oko-label oko-halo')
        .attr('x', x(siste.x) + 8).attr('y', y(siste.y)).attr('dy', '0.32em')
        .text(vf(siste.y));
    }
  }
  if (visEnder) {
    for (const e of ender) {
      svg.append('text').attr('class', 'oko-label oko-halo')
        .attr('x', x(e.p.x) + 8).attr('y', y(e.p.y)).attr('dy', '0.32em')
        .text(e.tekst);
    }
  }
  // x-akse
  const ticks = aarSteg(x0, x1, W - ml - mr);
  svg.append('g').selectAll('text').data(ticks).join('text')
    .attr('class', 'oko-ticklabel')
    .attr('x', (t) => x(t)).attr('y', H - 6).attr('text-anchor', 'middle')
    .text((t) => (o.xFmt ? o.xFmt(t) : String(t)));
  // trådkors og verktøytips
  const xs = [...new Set(alle.map((p) => p.x))].sort((a, b) => a - b);
  const tip = verktoytips(el);
  const regel = svg.append('line').attr('class', 'oko-rule').attr('y1', mt).attr('y2', H - mb).style('display', 'none');
  const prikker = svg.append('g');
  svg.append('rect').attr('class', 'oko-hit')
    .attr('x', ml).attr('y', mt).attr('width', Math.max(1, W - mr - ml)).attr('height', H - mb - mt)
    .on('pointerenter pointermove', (ev) => {
      const [px] = d3.pointer(ev);
      const v = xs.reduce((a, b) => (Math.abs(x(b) - px) < Math.abs(x(a) - px) ? b : a), xs[0]);
      regel.style('display', null).attr('x1', x(v)).attr('x2', x(v));
      prikker.selectAll('*').remove();
      const linjerTips = [];
      for (const s of serier) {
        const p = s.punkter.find((q) => q.x === v);
        if (!p) continue;
        prikker.append('circle').attr('class', 'oko-dot').attr('cx', x(v)).attr('cy', y(p.y)).attr('r', 4).style('fill', s.farge);
        linjerTips.push({ farge: serier.length > 1 ? s.farge : null, form: 'line', verdi: vf(p.y), tekst: s.navn });
      }
      const ekstra = o.tipsEkstra ? o.tipsEkstra(v) : null;
      tip.vis(ev, o.xFmt ? o.xFmt(v) : String(v), linjerTips.concat(ekstra?.linjer || []), ekstra?.notat);
    })
    .on('pointerleave', () => {
      regel.style('display', 'none');
      prikker.selectAll('*').remove();
      tip.skjul();
    });
  return svg;
}

/* ---------- liggende søyler (rangering, også med negative verdier) ---------- */
function liggende(el, o) {
  if (!o.rader.length) {
    el.appendChild(melding('Ingen tall å vise'));
    return null;
  }
  const W = Math.max(260, el.clientWidth);
  const radH = o.radHoyde || 24;
  const bh = Math.min(16, radH - 8);
  const mt = o.ref ? 22 : 4;
  const H = mt + o.rader.length * radH + 4;
  const svg = svgI(el, W, H);
  const vf = o.fmt || fmt.int;
  const lab = Math.min(W * 0.42, (d3.max(o.rader, (r) => tekstBredde(svg, r.navn, r.uthev ? 'oko-label-strong' : 'oko-label')) || 40) + 12);
  const verdier = o.rader.map((r) => r.verdi);
  const lo = Math.min(0, d3.min(verdier));
  const hi = Math.max(0, d3.max(verdier), o.ref?.verdi ?? 0, d3.max(o.rader, (r) => r.merke ?? 0));
  const vw = (d3.max(o.rader, (r) => tekstBredde(svg, vf(r.verdi), 'oko-label')) || 30) + 10;
  const venstre = lab + (lo < 0 ? vw : 0);
  const x = d3.scaleLinear([lo, hi === lo ? lo + 1 : hi], [venstre, Math.max(venstre + 40, W - (hi > 0 ? vw : 6))]);
  const x0 = x(0);
  if (lo < 0) {
    svg.append('line').attr('class', 'oko-baseline').attr('x1', Math.round(x0) + 0.5).attr('x2', Math.round(x0) + 0.5).attr('y1', mt - 2).attr('y2', H - 2);
  }
  // lag: søyler, referanselinje, tekst (med kant i bakgrunnsfargen) og treffflater
  const lagSoyler = svg.append('g');
  const lagRef = svg.append('g');
  const lagTekst = svg.append('g');
  const lagTreff = svg.append('g');
  const tip = o.tips ? verktoytips(el) : null;
  const radG = [];
  o.rader.forEach((r, i) => {
    const yy = mt + i * radH;
    const g = lagSoyler.append('g');
    const t = lagTekst.append('g');
    radG.push([g, t]);
    t.append('text').attr('class', r.uthev ? 'oko-label-strong' : 'oko-label-muted')
      .attr('x', lab - 10).attr('y', yy + radH / 2).attr('dy', '0.32em').attr('text-anchor', 'end')
      .text(forkort(svg, r.navn, lab - 12, r.uthev ? 'oko-label-strong' : 'oko-label'));
    const sti = liggendeSti(x0, x(r.verdi), yy + (radH - bh) / 2, bh);
    if (sti) g.append('path').attr('d', sti).style('fill', r.farge || farge(0));
    if (r.merke != null) {
      g.append('line').attr('x1', x(r.merke)).attr('x2', x(r.merke)).attr('y1', yy + 3).attr('y2', yy + radH - 3)
        .style('stroke', 'var(--color-fg)').style('stroke-width', 1.5);
    }
    const tekstX = r.verdi >= 0 ? Math.max(x(r.verdi), r.merke != null ? x(r.merke) : -Infinity) + 6 : x(r.verdi) - 6;
    t.append('text').attr('class', 'oko-label-muted oko-halo')
      .attr('x', tekstX).attr('y', yy + radH / 2).attr('dy', '0.32em')
      .attr('text-anchor', r.verdi >= 0 ? 'start' : 'end')
      .text(vf(r.verdi));
    if (tip) {
      lagTreff.append('rect').attr('class', 'oko-hit').attr('x', 0).attr('y', yy).attr('width', W).attr('height', radH)
        .on('pointerenter pointermove', (ev) => {
          radG.forEach(([a, b], j) => {
            a.classed('oko-dim', j !== i);
            b.classed('oko-dim', j !== i);
          });
          const tt = o.tips(r);
          tip.vis(ev, tt.tittel, tt.linjer, tt.notat);
        })
        .on('pointerleave', () => {
          radG.forEach(([a, b]) => {
            a.classed('oko-dim', false);
            b.classed('oko-dim', false);
          });
          tip.skjul();
        });
    }
  });
  if (o.ref) {
    const xx = Math.round(x(o.ref.verdi)) + 0.5;
    lagRef.append('line').attr('class', 'oko-ref').attr('x1', xx).attr('x2', xx).attr('y1', mt - 4).attr('y2', H - 2);
    const tw = tekstBredde(svg, o.ref.tekst, 'oko-reflabel');
    const anker = xx + tw / 2 > W ? 'end' : xx - tw / 2 < 0 ? 'start' : 'middle';
    lagRef.append('text').attr('class', 'oko-reflabel').attr('x', xx).attr('y', mt - 9).attr('text-anchor', anker).text(o.ref.tekst);
  }
  return svg;
}

/* ---------- små multipler ---------- */
function smaa(el, o) {
  const rutenett = lagEl('div', 'oko-sm');
  el.appendChild(rutenett);
  const x0 = o.x0 ?? d3.min(o.paneler, (p) => d3.min(p.punkter, (q) => q.x));
  const x1 = o.x1 ?? d3.max(o.paneler, (p) => d3.max(p.punkter, (q) => q.x));
  const bokser = o.paneler.map((p) => {
    const d = lagEl('div', 'oko-sm-panel');
    rutenett.appendChild(d);
    d.appendChild(lagEl('p', 'oko-sm-title', p.tittel));
    const pts = p.punkter.filter((q) => q.y != null);
    const siste = pts[pts.length - 1];
    d.appendChild(lagEl('p', 'oko-sm-value', siste ? `${p.fmt(siste.y)}` : '–'));
    const boks = lagEl('div', 'oko-chart');
    d.appendChild(boks);
    return { p, boks, pts };
  });
  for (const { p, boks, pts } of bokser) {
    const W = Math.max(120, boks.clientWidth);
    const H = o.hoyde || 86;
    const svg = svgI(boks, W, H, p.tittel);
    if (!pts.length) continue;
    const hi = d3.max(pts, (q) => q.y) || 1;
    const y = d3.scaleLinear([0, hi], [H - 18, 10]).nice(2);
    const top = y.domain()[1];
    const ml = Math.ceil(tekstBredde(svg, kompakt(top))) + 8;
    const mr = Math.ceil(tekstBredde(svg, '0000') / 2) + 2;
    const x = d3.scaleLinear([x0, x1], [ml, W - mr]);
    svg.append('line').attr('class', 'oko-gridline').attr('x1', ml).attr('x2', W - mr).attr('y1', Math.round(y(top)) + 0.5).attr('y2', Math.round(y(top)) + 0.5);
    svg.append('line').attr('class', 'oko-baseline').attr('x1', ml).attr('x2', W - mr).attr('y1', Math.round(y(0)) + 0.5).attr('y2', Math.round(y(0)) + 0.5);
    svg.append('text').attr('class', 'oko-ticklabel').attr('x', ml - 6).attr('y', y(top)).attr('dy', '0.32em').attr('text-anchor', 'end').text(kompakt(top));
    svg.append('text').attr('class', 'oko-ticklabel').attr('x', ml - 6).attr('y', y(0)).attr('dy', '0.32em').attr('text-anchor', 'end').text('0');
    for (const t of [x0, x1]) {
      svg.append('text').attr('class', 'oko-ticklabel').attr('x', x(t)).attr('y', H - 3).attr('text-anchor', t === x0 ? 'start' : 'end').text(String(t));
    }
    const hull = medHull(pts, 1);
    const fargen = o.farge || farge(0);
    svg.append('path').attr('d', d3.area().defined((q) => q.y != null).x((q) => x(q.x)).y0(y(0)).y1((q) => y(q.y))(hull))
      .style('fill', fargen).style('opacity', 0.1);
    svg.append('path').attr('class', 'oko-line').attr('d', d3.line().defined((q) => q.y != null).x((q) => x(q.x)).y((q) => y(q.y))(hull)).style('stroke', fargen);
    const s = pts[pts.length - 1];
    svg.append('circle').attr('class', 'oko-dot').attr('cx', x(s.x)).attr('cy', y(s.y)).attr('r', 3.5).style('fill', fargen);
    const tip = verktoytips(boks);
    const regel = svg.append('line').attr('class', 'oko-rule').attr('y1', 10).attr('y2', H - 18).style('display', 'none');
    const prikk = svg.append('circle').attr('class', 'oko-dot').attr('r', 3.5).style('fill', fargen).style('display', 'none');
    svg.append('rect').attr('class', 'oko-hit').attr('x', ml).attr('y', 0).attr('width', Math.max(1, W - mr - ml)).attr('height', H - 16)
      .on('pointerenter pointermove', (ev) => {
        const [px] = d3.pointer(ev);
        const q = pts.reduce((a, b) => (Math.abs(x(b.x) - px) < Math.abs(x(a.x) - px) ? b : a), pts[0]);
        regel.style('display', null).attr('x1', x(q.x)).attr('x2', x(q.x));
        prikk.style('display', null).attr('cx', x(q.x)).attr('cy', y(q.y));
        tip.vis(ev, `${p.tittel}, ${q.x}`, [{ verdi: p.fmt(q.y) }]);
      })
      .on('pointerleave', () => {
        regel.style('display', 'none');
        prikk.style('display', 'none');
        tip.skjul();
      });
  }
}

/* ---------- kart (fargelagte fylker) ---------- */
function kart(el, o) {
  const bw = o.former[0].w;
  const bh = o.former[0].h;
  const tilgjengelig = Math.max(220, el.clientWidth);
  const bredde = Math.min(tilgjengelig, (o.maksHoyde || 500) * (bw / bh));
  const ramme = lagEl('div', 'oko-map-wrap');
  el.appendChild(ramme);
  const svg = d3.select(ramme).append('svg')
    .attr('viewBox', `0 0 ${bw} ${bh}`)
    .attr('width', '100%')
    .attr('role', 'img')
    .attr('aria-label', o.etikett)
    .style('max-width', `${Math.floor(bredde)}px`);
  const verdier = o.former.map((f) => o.verdi(f.id)).filter((v) => v != null);
  const maks = d3.max(verdier) || 1;
  const aksent = farge(0);
  const fyll = (v) => (v == null ? 'var(--cds-chart-grid)' : `color-mix(in oklab, ${aksent} ${Math.round(14 + (86 * v) / maks)}%, var(--color-panel))`);
  const tip = verktoytips(el);
  svg.append('g').selectAll('path').data(o.former).join('path')
    .attr('class', 'oko-shape')
    .attr('d', (f) => f.d)
    .style('fill', (f) => fyll(o.verdi(f.id)))
    .on('pointerenter pointermove', function (ev, f) {
      d3.select(this).classed('is-hover', true).raise();
      const t = o.tips(f.id);
      if (t) tip.vis(ev, t.tittel, t.linjer, t.notat);
    })
    .on('pointerleave', function () {
      d3.select(this).classed('is-hover', false);
      tip.skjul();
    });
  const skala = lagEl('div', 'oko-ramp');
  const bar = lagEl('div', 'oko-ramp-bar');
  bar.style.background = `linear-gradient(to right, color-mix(in oklab, ${aksent} 14%, var(--color-panel)), ${aksent})`;
  const tekster = lagEl('div', 'oko-ramp-labels');
  tekster.append(lagEl('span', null, o.fmt(0).replace(/,0+(?!\d)/, '')), lagEl('span', null, o.fmt(maks)));
  skala.append(lagEl('div', null, o.skalaTekst), bar, tekster);
  ramme.appendChild(skala);
}

/* ---------- tabellvisning ---------- */
function tabell(boksId, o) {
  const boks = document.getElementById(boksId);
  if (!boks) return;
  boks.replaceChildren();
  const t = lagEl('table', 'oko-table');
  t.dataset.source = o.kilde;
  t.dataset.rowKey = o.nokkel.join(',');
  const hode = lagEl('thead');
  const hr = lagEl('tr');
  for (const k of o.kolonner) {
    const th = lagEl('th', k.tekst ? 'oko-txt' : null, k.navn);
    th.dataset.field = k.felt;
    if (k.kilde) th.dataset.source = k.kilde;
    th.scope = 'col';
    hr.appendChild(th);
  }
  hode.appendChild(hr);
  const kropp = lagEl('tbody');
  for (const r of o.rader) {
    const tr = lagEl('tr');
    tr.dataset.key = o.nokkel.length > 1 ? o.nokkel.map((k) => encodeURIComponent(r[k])).join(',') : String(r[o.nokkel[0]]);
    for (const k of o.kolonner) {
      const v = k.verdi ? k.verdi(r) : r[k.felt];
      const td = lagEl('td', k.tekst ? 'oko-txt' : null);
      if (k.lenke && /^https:\/\//.test(k.lenke(r) || '')) {
        const a = lagEl('a', null, v == null ? '' : String(v));
        a.href = k.lenke(r);
        a.target = '_blank';
        a.rel = 'noopener';
        td.appendChild(a);
      } else {
        td.textContent = v === '' || v == null ? '' : k.fmt ? k.fmt(Number(v)) : String(v);
      }
      tr.appendChild(td);
    }
    kropp.appendChild(tr);
  }
  t.append(hode, kropp);
  boks.appendChild(t);
}

/* ======================================================================= figurene */

const FIGURER = {};
const figur = (id, kilder, tegn) => {
  FIGURER[id] = { kilder, tegn };
};
const aarListe = (fra, til) => d3.range(fra, til + 1).map(String);

let fylkeMaal = 'andel';
const FYLKE_MAAL = {
  andel: {
    felt: 'andel_okologisk_prosent', navn: 'Økologisk andel av jordbruksarealet', fmt: (v) => pst(v, 1),
    endring: 'andel_endring_pp', endringFmt: medFortegn(fmt.d1), endringEnhet: 'prosentpoeng, regnet av SSBs avrundede andeler',
  },
  areal: {
    felt: 'areal_i_alt_dekar', navn: 'Økologisk areal (dekar, med karens)', fmt: dekar,
    endring: 'areal_endring_dekar', endringFmt: medFortegn(fmt.int), endringEnhet: 'dekar',
  },
  gaarder: {
    felt: 'bedrifter', navn: 'Gårder med økologisk drift', fmt: fmt.int,
    endring: 'gaarder_endring', endringFmt: medFortegn(fmt.int), endringEnhet: 'antall gårder',
  },
};

// ---- Oversikt
figur('graf-andel', ['ssb_areal', 'andel_beregnet'], (el) => {
  const ssb = rader('ssb_areal');
  const beregnet = rader('andel_beregnet');
  forklaring(el, [
    { tekst: 'Med areal under omlegging', farge: farge(0), form: 'line' },
    { tekst: 'Bare godkjent økologisk areal', farge: DEMPET, form: 'line' },
    { tekst: `Utvikling som trengs for å nå ${MAAL.andel} % i ${MAAL.aar}`, farge: REF, form: 'dash' },
  ]);
  const godkjent = new Map(beregnet.map((r) => [String(r.aar), r.andel_godkjent]));
  linjer(el, {
    serier: [
      { felt: 'inkl', navn: 'Med karens', farge: farge(0), punkter: ssb.map((r) => ({ x: Number(r.aar), y: N(r.andel_okologisk_prosent) })) },
      { felt: 'godkjent', navn: 'Godkjent', farge: DEMPET, punkter: beregnet.map((r) => ({ x: Number(r.aar), y: r.andel_godkjent })) },
    ],
    x1: MAAL.aar,
    akseFmt: pstAkse,
    verdiFmt: (v) => pst(v, 1),
    mal: { fra: 'inkl', x: MAAL.aar, y: MAAL.andel, tekst: `Mål ${MAAL.aar}: ${MAAL.andel} %` },
    endeEtiketter: false,
    merkSiste: ['inkl'],
    hoyde: 300,
    tipsEkstra: (aar) => {
      const r = ssb.find((q) => Number(q.aar) === aar);
      return r ? { notat: `${dekar(Number(r.areal_i_alt_dekar))} økologisk, ${fmt.int(Number(r.bedrifter))} gårder` } : null;
    },
  });
  tabell('tabell-andel', {
    kilde: 'ssb_areal',
    nokkel: ['aar'],
    kolonner: [
      { felt: 'aar', navn: 'År' },
      { felt: 'andel_okologisk_prosent', navn: 'Andel med karens (%)', fmt: fmt.d1 },
      { felt: 'andel_godkjent', navn: 'Andel godkjent (%)', kilde: 'andel_beregnet', fmt: fmt.d2, verdi: (r) => godkjent.get(String(r.aar)) },
      { felt: 'areal_i_alt_dekar', navn: 'Økologisk areal (dekar)', fmt: fmt.int },
    ],
    rader: [...ssb].reverse(),
  });
});

figur('graf-andeler', ['andeler_siste'], (el) => {
  const r = [...rader('andeler_siste')].sort((a, b) => b.andel_prosent - a.andel_prosent);
  liggende(el, {
    rader: r.map((d) => ({ navn: d.omraade, verdi: d.andel_prosent, farge: d.omraade === 'Jordbruksareal' ? farge(0) : farge(0), uthev: d.omraade === 'Jordbruksareal', d })),
    fmt: (v) => pst(v, 1),
    radHoyde: 28,
    tips: (x) => ({ tittel: `${x.d.omraade}, ${x.d.aar}`, linjer: [{ verdi: pst(x.d.andel_prosent, 1), tekst: 'økologisk' }] }),
  });
  tabell('tabell-andeler', {
    kilde: 'andeler_siste',
    nokkel: ['omraade'],
    kolonner: [
      { felt: 'omraade', navn: 'Område', tekst: true },
      { felt: 'aar', navn: 'År' },
      { felt: 'andel_prosent', navn: 'Økologisk andel (%)', fmt: fmt.d1 },
    ],
    rader: r,
  });
});

figur('graf-innut', ['debio_innut'], (el) => {
  const alle = rader('debio_innut');
  const r = alle.filter((d) => d.nye_innmeldt !== '' || d.utmeldt !== '').map((d) => ({
    x: String(d.aar),
    inn: N(d.nye_innmeldt),
    ut: N(d.utmeldt) == null ? null : -N(d.utmeldt),
    netto: (N(d.nye_innmeldt) || 0) - (N(d.utmeldt) || 0),
    tot: N(d.landbruksvirksomheter),
  }));
  forklaring(el, [
    { tekst: 'Nye i økologisk drift', farge: farge(0) },
    { tekst: 'Meldt ut', farge: farge(1) },
  ]);
  soyler(el, {
    kategorier: r.map((d) => d.x),
    rader: r,
    serier: [{ felt: 'inn', farge: farge(0) }, { felt: 'ut', farge: farge(1) }],
    akseFmt: (v) => fmt.int(Math.abs(v)),
    hoyde: 240,
    tips: (d) => ({
      tittel: d.x,
      linjer: [
        { farge: farge(0), verdi: fmt.int(d.inn), tekst: 'nye' },
        { farge: farge(1), verdi: fmt.int(-d.ut), tekst: 'meldt ut' },
        { verdi: medFortegn(fmt.int)(d.netto), tekst: 'netto' },
      ],
      notat: `${fmt.int(d.tot)} virksomheter under kontroll`,
    }),
  });
  tabell('tabell-innut', {
    kilde: 'debio_innut',
    nokkel: ['aar'],
    kolonner: [
      { felt: 'aar', navn: 'År' },
      { felt: 'landbruksvirksomheter', navn: 'Virksomheter', fmt: fmt.int },
      { felt: 'nye_innmeldt', navn: 'Nye', fmt: fmt.int },
      { felt: 'utmeldt', navn: 'Meldt ut', fmt: fmt.int },
    ],
    rader: [...alle].reverse(),
  });
});

// ---- Areal og gårder
figur('graf-arealtype', ['ssb_areal'], (el) => {
  const ssb = rader('ssb_areal');
  const r = ssb.map((d) => ({ x: String(d.aar), g: N(d.godkjent_areal_dekar), k: N(d.karens_areal_dekar), t: N(d.areal_i_alt_dekar) }));
  forklaring(el, [
    { tekst: 'Godkjent økologisk', farge: farge(0) },
    { tekst: 'Under omlegging (karens)', farge: farge(1) },
  ]);
  soyler(el, {
    kategorier: r.map((d) => d.x),
    rader: r,
    stablet: true,
    serier: [{ felt: 'g', farge: farge(0) }, { felt: 'k', farge: farge(1) }],
    hoyde: 280,
    tips: (d) => ({
      tittel: d.x,
      linjer: [
        { farge: farge(0), verdi: dekar(d.g), tekst: 'godkjent' },
        { farge: farge(1), verdi: dekar(d.k), tekst: 'under omlegging' },
        { verdi: dekar(d.t), tekst: 'i alt' },
      ],
    }),
  });
  tabell('tabell-arealtype', {
    kilde: 'ssb_areal',
    nokkel: ['aar'],
    kolonner: [
      { felt: 'aar', navn: 'År' },
      { felt: 'godkjent_areal_dekar', navn: 'Godkjent (dekar)', fmt: fmt.int },
      { felt: 'karens_areal_dekar', navn: 'Karens (dekar)', fmt: fmt.int },
      { felt: 'areal_i_alt_dekar', navn: 'I alt (dekar)', fmt: fmt.int },
      { felt: 'bedrifter', navn: 'Gårder', fmt: fmt.int },
      { felt: 'andel_okologisk_prosent', navn: 'Andel (%)', fmt: fmt.d1 },
    ],
    rader: [...ssb].reverse(),
  });
});

figur('graf-gaarder', ['ssb_areal'], (el) => {
  const ssb = rader('ssb_areal');
  const r = ssb.map((d, i) => ({ x: String(d.aar), v: N(d.bedrifter), e: i ? N(d.bedrifter) - N(ssb[i - 1].bedrifter) : null }));
  soyler(el, {
    kategorier: r.map((d) => d.x),
    rader: r,
    serier: [{ felt: 'v', farge: farge(0) }],
    hoyde: 240,
    tips: (d) => ({
      tittel: d.x,
      linjer: [{ verdi: fmt.int(d.v), tekst: 'gårder' }].concat(d.e == null ? [] : [{ verdi: medFortegn(fmt.int)(d.e), tekst: 'fra året før' }]),
    }),
  });
});

figur('graf-pergard', ['snitt_per_gard'], (el) => {
  const r = rader('snitt_per_gard');
  linjer(el, {
    serier: [{ felt: 'snitt', navn: 'Dekar per gård', farge: farge(0), punkter: r.map((d) => ({ x: Number(d.aar), y: d.dekar_per_gard })) }],
    verdiFmt: (v) => `${fmt.int(v)} dekar`,
    endeEtiketter: false,
    merkSiste: ['snitt'],
    hoyde: 240,
  });
  tabell('tabell-pergard', {
    kilde: 'snitt_per_gard',
    nokkel: ['aar'],
    kolonner: [{ felt: 'aar', navn: 'År' }, { felt: 'dekar_per_gard', navn: 'Dekar per gård', fmt: fmt.d1 }],
    rader: [...r].reverse(),
  });
});

// ---- Produksjon
figur('graf-bruk', ['ssb_bruk'], (el) => {
  const alle = rader('ssb_bruk');
  const aar = sisteAar(alle);
  const iAar = alle.filter((d) => Number(d.aar) === aar);
  const totalt = N(iAar.find((d) => d.kode === '00a')?.dekar);
  const r = iAar.filter((d) => d.kode !== '00a').map((d) => ({ navn: d.bruk, verdi: N(d.dekar), d })).sort((a, b) => b.verdi - a.verdi);
  liggende(el, {
    rader: r,
    fmt: fmt.int,
    tips: (x) => ({
      tittel: `${x.d.bruk}, ${aar}`,
      linjer: [{ verdi: dekar(x.verdi) }].concat(totalt ? [{ verdi: pst((100 * x.verdi) / totalt, 1), tekst: 'av godkjent areal' }] : []),
    }),
  });
  tabell('tabell-bruk', {
    kilde: 'ssb_bruk',
    nokkel: ['aar', 'kode'],
    kolonner: [
      { felt: 'bruk', navn: 'Bruk', tekst: true },
      { felt: 'aar', navn: 'År' },
      { felt: 'dekar', navn: 'Dekar', fmt: fmt.int },
    ],
    rader: [...iAar].sort((a, b) => N(b.dekar) - N(a.dekar)),
  });
});

figur('graf-bruk-utvikling', ['ssb_bruk'], (el) => {
  const alle = rader('ssb_bruk');
  const aarene = [...new Set(alle.map((d) => Number(d.aar)))].sort((a, b) => a - b);
  const grupper = ['Eng og beite', 'Korn', 'Grønnfôr og silo', 'Grønnsaker, potet, frukt og bær', 'Grønngjødsling og andre vekster'];
  smaa(el, {
    paneler: grupper.map((g) => ({
      tittel: g,
      fmt: dekar,
      punkter: aarene.map((a) => {
        const deler = alle.filter((d) => Number(d.aar) === a && d.gruppe === g);
        return { x: a, y: deler.length ? d3.sum(deler, (d) => N(d.dekar)) : null };
      }),
    })),
  });
});

figur('graf-husdyr', ['ssb_husdyr'], (el) => {
  const alle = rader('ssb_husdyr');
  const valg = [['02', 'Melkekyr'], ['03', 'Ammekyr'], ['04e', 'Sau og lam'], ['15a', 'Geiter'], ['05a', 'Svin'], ['10', 'Verpehøner']];
  smaa(el, {
    paneler: valg.map(([kode, navn]) => ({
      tittel: navn,
      fmt: fmt.int,
      punkter: alle.filter((d) => d.kode === kode).map((d) => ({ x: Number(d.aar), y: N(d.antall) })).sort((a, b) => a.x - b.x),
    })),
  });
  const sist = sisteAar(alle);
  tabell('tabell-husdyr', {
    kilde: 'ssb_husdyr',
    nokkel: ['aar', 'kode'],
    kolonner: [
      { felt: 'husdyrslag', navn: 'Dyreslag', tekst: true },
      { felt: 'aar', navn: 'År' },
      { felt: 'antall', navn: 'Antall', fmt: fmt.int },
    ],
    rader: [...alle].sort((a, b) => Number(b.aar) - Number(a.aar) || a.kode.localeCompare(b.kode)).filter((d) => Number(d.aar) >= sist - 9),
  });
});

figur('graf-vekster', ['debio_vekster'], (el) => {
  const alle = rader('debio_vekster');
  const grupper = ['Korn og belgvekster', 'Grønnsaker og potet', 'Frukt og bær', 'Annet'];
  const fargeFor = (g) => (g === 'Annet' ? DEMPET : farge(grupper.indexOf(g)));
  const r = alle.filter((d) => d.gruppe !== 'Grovfôr og beite' && N(d.totalt_dekar) > 0)
    .map((d) => ({ navn: d.kultur, verdi: N(d.totalt_dekar), farge: fargeFor(d.gruppe), d }))
    .sort((a, b) => b.verdi - a.verdi);
  forklaring(el, grupper.map((g) => ({ tekst: g, farge: fargeFor(g) })));
  liggende(el, {
    rader: r,
    fmt: fmt.int,
    radHoyde: 22,
    tips: (x) => ({
      tittel: `${x.d.kultur}, ${x.d.aar}`,
      linjer: [
        { verdi: dekar(x.verdi), tekst: 'i alt' },
        { verdi: dekar(N(x.d.karens_dekar)), tekst: 'herav under omlegging' },
      ],
      notat: x.d.gruppe,
    }),
  });
  tabell('tabell-vekster', {
    kilde: 'debio_vekster',
    nokkel: ['kultur'],
    kolonner: [
      { felt: 'kultur', navn: 'Vekst', tekst: true },
      { felt: 'gruppe', navn: 'Gruppe', tekst: true },
      { felt: 'okologisk_dekar', navn: 'Økologisk (dekar)', fmt: fmt.int },
      { felt: 'karens_dekar', navn: 'Karens (dekar)', fmt: fmt.int },
      { felt: 'totalt_dekar', navn: 'I alt (dekar)', fmt: fmt.int },
    ],
    rader: [...alle].sort((a, b) => N(b.totalt_dekar) - N(a.totalt_dekar)),
  });
});

// ---- Fylker
function fylkeData() {
  const alle = rader('ssb_fylker');
  const aar = sisteAar(alle);
  return { alle, aar, iAar: new Map(alle.filter((d) => Number(d.aar) === aar).map((d) => [d.fylkesnr, d])) };
}

figur('graf-kart', ['fylkeskart', 'ssb_fylker'], (el) => {
  const m = FYLKE_MAAL[fylkeMaal];
  const { aar, iAar } = fylkeData();
  const former = rader('fylkeskart').map((d) => ({ id: d.fylkesnr, navn: d.fylke, d: d.sti, w: Number(d.bredde), h: Number(d.hoyde) }));
  kart(el, {
    former,
    etikett: `${m.navn} per fylke`,
    verdi: (id) => N(iAar.get(id)?.[m.felt]),
    fmt: m.fmt,
    skalaTekst: `${m.navn}, ${aar}`,
    maksHoyde: 470,
    tips: (id) => {
      const d = iAar.get(id);
      if (!d) return null;
      return {
        tittel: `${d.fylke}, ${aar}`,
        linjer: [
          { verdi: pst(N(d.andel_okologisk_prosent), 1), tekst: 'av jordbruksarealet' },
          { verdi: dekar(N(d.areal_i_alt_dekar)), tekst: 'økologisk' },
          { verdi: fmt.int(N(d.bedrifter)), tekst: 'gårder' },
        ],
      };
    },
  });
});

figur('graf-fylker', ['ssb_fylker', 'ssb_areal'], (el) => {
  const m = FYLKE_MAAL[fylkeMaal];
  const { alle, aar, iAar } = fylkeData();
  const land = rader('ssb_areal').find((d) => Number(d.aar) === aar);
  const note = document.getElementById('fylker-note');
  if (note) note.textContent = fylkeMaal === 'andel' ? 'Siste år. Den stiplede linjen er landsgjennomsnittet.' : 'Siste år.';
  const r = [...iAar.values()].map((d) => ({ navn: d.fylke, verdi: N(d[m.felt]), d })).sort((a, b) => b.verdi - a.verdi);
  liggende(el, {
    rader: r,
    fmt: m.fmt,
    radHoyde: 26,
    ref: fylkeMaal === 'andel' && land ? { verdi: N(land.andel_okologisk_prosent), tekst: `Hele landet ${pst(N(land.andel_okologisk_prosent), 1)}` } : null,
    tips: (x) => ({
      tittel: `${x.d.fylke}, ${aar}`,
      linjer: [
        { verdi: pst(N(x.d.andel_okologisk_prosent), 1), tekst: 'av jordbruksarealet' },
        { verdi: dekar(N(x.d.areal_i_alt_dekar)), tekst: 'økologisk' },
        { verdi: fmt.int(N(x.d.bedrifter)), tekst: 'gårder' },
      ],
    }),
  });
  tabell('tabell-fylker', {
    kilde: 'ssb_fylker',
    nokkel: ['fylkesnr', 'aar'],
    kolonner: [
      { felt: 'fylke', navn: 'Fylke', tekst: true },
      { felt: 'aar', navn: 'År' },
      { felt: 'bedrifter', navn: 'Gårder', fmt: fmt.int },
      { felt: 'areal_i_alt_dekar', navn: 'Areal (dekar)', fmt: fmt.int },
      { felt: 'karens_areal_dekar', navn: 'Herav karens', fmt: fmt.int },
      { felt: 'andel_okologisk_prosent', navn: 'Andel (%)', fmt: fmt.d1 },
    ],
    rader: [...alle].sort((a, b) => a.fylke.localeCompare(b.fylke, 'nb') || Number(b.aar) - Number(a.aar)),
  });
});

figur('graf-fylker-endring', ['fylker_endring'], (el) => {
  const m = FYLKE_MAAL[fylkeMaal];
  const r = rader('fylker_endring').map((d) => ({ navn: d.fylke, verdi: d[m.endring], d })).sort((a, b) => b.verdi - a.verdi);
  const maalTekst = document.getElementById('fylker-endring-maal');
  const enhetTekst = document.getElementById('fylker-endring-enhet');
  if (maalTekst) maalTekst.textContent = m.navn;
  if (enhetTekst) enhetTekst.textContent = m.endringEnhet;
  liggende(el, {
    rader: r.map((x) => ({ ...x, farge: x.verdi >= 0 ? farge(0) : farge(1) })),
    fmt: m.endringFmt,
    radHoyde: 26,
    tips: (x) => ({
      tittel: x.d.fylke,
      linjer: [
        { verdi: `${medFortegn(fmt.d1)(x.d.andel_endring_pp)} prosentpoeng`, tekst: 'andel' },
        { verdi: `${medFortegn(fmt.int)(x.d.areal_endring_dekar)} dekar`, tekst: 'areal' },
        { verdi: medFortegn(fmt.int)(x.d.gaarder_endring), tekst: 'gårder' },
      ],
      notat: `Fra ${x.d.forrige_aar} til ${x.d.aar}`,
    }),
  });
});

// ---- Vare for vare
figur('graf-melk', ['ldir_melk'], (el) => {
  const r = rader('ldir_melk');
  const lev = r.map((d) => ({ x: Number(d.aar), y: N(d.levert_mill_liter) }));
  const solgt = r.map((d) => ({ x: Number(d.aar), y: N(d.solgt_som_okologisk_mill_liter) }));
  forklaring(el, [
    { tekst: 'Levert til meieri', farge: farge(0), form: 'line' },
    { tekst: 'Solgt som økologisk', farge: farge(1), form: 'line' },
    { tekst: 'Solgt som vanlig melk', farge: farge(0), opasitet: 0.25 },
  ]);
  linjer(el, {
    serier: [
      { felt: 'lev', navn: 'Levert', farge: farge(0), punkter: lev },
      { felt: 'solgt', navn: 'Solgt som økologisk', farge: farge(1), punkter: solgt },
    ],
    baand: { over: 'lev', under: 'solgt', farge: farge(0) },
    verdiFmt: (v) => `${fmt.d1(v)} mill. liter`,
    endeEtiketter: false,
    hoyde: 260,
    tipsEkstra: (aar) => {
      const d = r.find((q) => Number(q.aar) === aar);
      if (!d) return null;
      const l = N(d.levert_mill_liter);
      const s = N(d.solgt_som_okologisk_mill_liter);
      const linjerTips = l != null && s != null ? [{ verdi: `${fmt.d1(l - s)} mill. liter`, tekst: 'solgt som vanlig melk' }] : [];
      return { linjer: linjerTips, notat: `Tall fra ${d.datagrunnlag}${N(d.okologisk_andel_av_all_melk_prosent) != null ? `; ${pst(N(d.okologisk_andel_av_all_melk_prosent), 1)} av all melk` : ''}` };
    },
  });
  tabell('tabell-melk', {
    kilde: 'ldir_melk',
    nokkel: ['aar'],
    kolonner: [
      { felt: 'aar', navn: 'År' },
      { felt: 'levert_mill_liter', navn: 'Levert (mill. liter)', fmt: fmt.d1 },
      { felt: 'solgt_som_okologisk_mill_liter', navn: 'Solgt som økologisk', fmt: fmt.d1 },
      { felt: 'okologisk_andel_av_all_melk_prosent', navn: 'Andel av all melk (%)', fmt: fmt.d1 },
      { felt: 'datagrunnlag', navn: 'Datagrunnlag', tekst: true },
      { felt: 'kilde', navn: 'Kilde i rapporten', tekst: true },
    ],
    rader: [...r].reverse(),
  });
});

figur('graf-anvendelse', ['ldir_anvendelse'], (el) => {
  const r = rader('ldir_anvendelse');
  const varer = ['Melk', 'Egg', 'Kjøtt'];
  forklaring(el, varer.map((v, i) => ({ tekst: v, farge: farge(i), form: 'line' })));
  linjer(el, {
    serier: varer.map((v, i) => ({
      felt: v,
      navn: v,
      farge: farge(i),
      punkter: r.filter((d) => d.vare === v).map((d) => ({ x: Number(d.aar), y: N(d.prosent) })),
    })),
    yMaks: 100,
    akseFmt: pstAkse,
    verdiFmt: (v) => pst(v, 0),
    hoyde: 260,
  });
  tabell('tabell-anvendelse', {
    kilde: 'ldir_anvendelse',
    nokkel: ['aar', 'vare'],
    kolonner: [{ felt: 'vare', navn: 'Vare', tekst: true }, { felt: 'aar', navn: 'År' }, { felt: 'prosent', navn: 'Solgt som økologisk (%)', fmt: fmt.d1 }, { felt: 'kilde', navn: 'Kilde i rapporten', tekst: true }],
    rader: [...r].sort((a, b) => Number(b.aar) - Number(a.aar) || varer.indexOf(a.vare) - varer.indexOf(b.vare)),
  });
});

figur('graf-egg', ['ldir_egg'], (el) => {
  const r = rader('ldir_egg').map((d) => ({ x: String(d.aar), v: N(d.okologiske_egg_tonn), a: N(d.andel_av_alle_egg_prosent) }));
  const aar = r.map((d) => Number(d.x));
  soyler(el, {
    kategorier: aarListe(d3.min(aar), d3.max(aar)),
    rader: r,
    serier: [{ felt: 'v', farge: farge(0) }],
    hoyde: 240,
    tips: (d) => ({
      tittel: d.x,
      linjer: [{ verdi: tonn(d.v), tekst: 'økologiske egg' }].concat(d.a == null ? [] : [{ verdi: pst(d.a, 1), tekst: 'av alle egg' }]),
    }),
  });
  tabell('tabell-egg', {
    kilde: 'ldir_egg',
    nokkel: ['aar'],
    kolonner: [{ felt: 'aar', navn: 'År' }, { felt: 'okologiske_egg_tonn', navn: 'Tonn', fmt: fmt.int }, { felt: 'andel_av_alle_egg_prosent', navn: 'Andel av alle egg (%)', fmt: fmt.d1 }, { felt: 'kilde', navn: 'Kilde i rapporten', tekst: true }],
    rader: [...rader('ldir_egg')].reverse(),
  });
});

figur('graf-kjott', ['ldir_kjott'], (el) => {
  const r = rader('ldir_kjott');
  const slag = [['Storfe', 'Storfe'], ['Sau og lam', 'Sau og lam'], ['Fjørfe', 'Kylling og kalkun'], ['Svin', 'Svin']];
  forklaring(el, slag.map(([, navn], i) => ({ tekst: navn, farge: farge(i), form: 'line' })));
  linjer(el, {
    serier: slag.map(([kode, navn], i) => ({
      felt: kode,
      navn,
      farge: farge(i),
      punkter: r.filter((d) => d.dyreslag === kode).map((d) => ({ x: Number(d.aar), y: N(d.slakt_tonn) })),
    })),
    verdiFmt: tonn,
    endeEtiketter: false,
    hoyde: 260,
    tipsEkstra: (aar) => {
      const andeler = slag.map(([kode, navn]) => {
        const d = r.find((q) => q.dyreslag === kode && Number(q.aar) === aar);
        return d && N(d.andel_prosent) != null ? `${navn.toLowerCase()} ${pst(N(d.andel_prosent), 1)}` : null;
      }).filter(Boolean);
      return andeler.length ? { notat: `Økologisk andel: ${andeler.join(', ')}` } : null;
    },
  });
  tabell('tabell-kjott', {
    kilde: 'ldir_kjott',
    nokkel: ['aar', 'dyreslag'],
    kolonner: [{ felt: 'dyreslag', navn: 'Dyreslag', tekst: true }, { felt: 'aar', navn: 'År' }, { felt: 'slakt_tonn', navn: 'Tonn', fmt: fmt.int }, { felt: 'andel_prosent', navn: 'Andel (%)', fmt: fmt.d2 }, { felt: 'kilde', navn: 'Kilde i rapporten', tekst: true }],
    rader: [...r].sort((a, b) => Number(b.aar) - Number(a.aar) || a.dyreslag.localeCompare(b.dyreslag, 'nb')),
  });
});

figur('graf-korn', ['ldir_korn'], (el) => {
  const r = rader('ldir_korn').map((d) => ({ x: d.sesong, start: Number(d.sesong.slice(0, 4)), v: N(d.tonn), status: d.status, rapport: d.rapport }));
  const fra = d3.min(r, (d) => d.start);
  const til = d3.max(r, (d) => d.start);
  const kat = d3.range(fra, til + 1).map((a) => `${a}–${a + 1}`);
  const kort = (s) => `${s.slice(0, 4)}–${s.slice(7, 9)}`;
  forklaring(el, [
    { tekst: 'Levert', farge: farge(0) },
    { tekst: 'Anslag fra februar', farge: farge(0), opasitet: 0.5 },
  ]);
  soyler(el, {
    kategorier: kat,
    etikett: kort,
    rader: r,
    serier: [{ felt: 'v', farge: farge(0), opasitet: (d) => (d.status === 'anslag' ? 0.5 : null) }],
    hoyde: 240,
    tips: (d) => ({
      tittel: `Sesongen ${d.x}`,
      linjer: [{ verdi: tonn(d.v), tekst: d.status }],
      notat: `Fra rapporten for ${d.rapport}`,
    }),
  });
  tabell('tabell-korn', {
    kilde: 'ldir_korn',
    nokkel: ['sesong'],
    kolonner: [{ felt: 'sesong', navn: 'Sesong' }, { felt: 'tonn', navn: 'Tonn', fmt: fmt.int }, { felt: 'status', navn: 'Status', tekst: true }, { felt: 'kilde', navn: 'Kilde i rapporten', tekst: true }],
    rader: [...rader('ldir_korn')].reverse(),
  });
});

// ---- Marked
const GRUNNLAG = ['Nielsen', 'Dagligvarekjedene', 'NielsenIQ'];
const KANAL_KORT = { 'Bakerier inkl. kaféutsalg': 'Bakerier og kaféer', 'Storhusholdning (grossistledd)': 'Storhusholdning' };
figur('graf-dagligvare', ['ldir_dagligvare'], (el) => {
  const alle = rader('ldir_dagligvare');
  const r = alle.map((d) => ({ x: String(d.aar), v: N(d.omsetning_mill_kr), a: N(d.andel_prosent), g: d.datagrunnlag, ag: d.andel_grunnlag }));
  const aar = r.map((d) => Number(d.x));
  const fargeFor = (g) => farge(Math.max(0, GRUNNLAG.indexOf(g)));
  forklaring(el, GRUNNLAG.filter((g) => r.some((d) => d.g === g)).map((g) => ({ tekst: g, farge: fargeFor(g) })));
  soyler(el, {
    kategorier: aarListe(d3.min(aar), d3.max(aar)),
    rader: r,
    serier: [{ felt: 'v', farge: (d) => fargeFor(d.g) }],
    hoyde: 260,
    tips: (d) => ({
      tittel: d.x,
      linjer: [{ farge: fargeFor(d.g), verdi: mkr(d.v), tekst: 'økologisk salg' }].concat(d.a == null ? [] : [{ verdi: pst(d.a, 1), tekst: 'av omsetningen' }]),
      notat: `Datagrunnlag: ${d.g}${d.ag ? `. ${d.ag}` : ''}`,
    }),
  });
  tabell('tabell-dagligvare', {
    kilde: 'ldir_dagligvare',
    nokkel: ['aar'],
    kolonner: [{ felt: 'aar', navn: 'År' }, { felt: 'omsetning_mill_kr', navn: 'Mill. kr', fmt: fmt.d1 }, { felt: 'andel_prosent', navn: 'Andel (%)', fmt: fmt.d1 }, { felt: 'andel_grunnlag', navn: 'Andelen regnet av', tekst: true }, { felt: 'datagrunnlag', navn: 'Datagrunnlag', tekst: true }, { felt: 'kilde', navn: 'Kilde i rapporten', tekst: true }],
    rader: [...alle].reverse(),
  });
});

figur('graf-kanaler-siste', ['ldir_dagligvare', 'ldir_kanaler'], (el) => {
  const dv = rader('ldir_dagligvare');
  const kan = rader('ldir_kanaler');
  const aar = sisteAar(kan);
  // hver kanal med sitt siste år; året vises i navnet når det ikke er det siste
  const sisteRad = new Map();
  for (const d of kan) {
    const f = sisteRad.get(d.kanal);
    if (!f || Number(d.aar) > Number(f.aar)) sisteRad.set(d.kanal, d);
  }
  const r = [...sisteRad.values()].filter((d) => Number(d.aar) >= aar - 1).map((d) => ({
    navn: (KANAL_KORT[d.kanal] || d.kanal) + (Number(d.aar) !== aar ? ` (${d.aar})` : ''),
    full: d.kanal, aar: d.aar, verdi: N(d.omsetning_mill_kr), farge: farge(0),
  }));
  const dvRad = dv.find((d) => Number(d.aar) === aar);
  if (dvRad) r.push({ navn: 'Dagligvarehandelen', full: 'Dagligvarehandelen', aar: dvRad.aar, verdi: N(dvRad.omsetning_mill_kr), farge: farge(0), uthev: true });
  r.sort((a, b) => b.verdi - a.verdi);
  liggende(el, {
    rader: r,
    fmt: fmt.int,
    radHoyde: 28,
    tips: (x) => ({ tittel: `${x.full}, ${x.aar}`, linjer: [{ verdi: mkr(x.verdi), tekst: 'økologiske varer' }] }),
  });
});

figur('graf-varegrupper', ['ldir_varegrupper'], (el) => {
  const alle = rader('ldir_varegrupper');
  const aar = sisteAar(alle.filter((d) => N(d.andel_prosent) != null));
  const forrige = new Map(alle.filter((d) => Number(d.aar) === aar - 1).map((d) => [d.varegruppe, N(d.andel_prosent)]));
  const salgFor = new Map(alle.filter((d) => Number(d.aar) === aar - 1).map((d) => [d.varegruppe, N(d.omsetning_mill_kr)]));
  const r = alle.filter((d) => Number(d.aar) === aar && N(d.andel_prosent) != null)
    .map((d) => ({ navn: d.varegruppe, verdi: N(d.andel_prosent), merke: forrige.get(d.varegruppe) ?? null, d }))
    .sort((a, b) => b.verdi - a.verdi);
  liggende(el, {
    rader: r,
    fmt: (v) => pst(v, 1),
    radHoyde: 24,
    tips: (x) => ({
      tittel: `${x.d.varegruppe}, ${aar}`,
      linjer: [{ verdi: pst(x.verdi, 1), tekst: 'økologisk andel' }]
        .concat(x.merke != null ? [{ verdi: pst(x.merke, 1), tekst: `i ${aar - 1}` }] : [])
        .concat(N(x.d.omsetning_mill_kr) != null ? [{ verdi: mkr(N(x.d.omsetning_mill_kr)), tekst: `økologisk salg ${aar}` }] : [])
        .concat(salgFor.get(x.d.varegruppe) != null ? [{ verdi: mkr(salgFor.get(x.d.varegruppe)), tekst: `økologisk salg ${aar - 1}` }] : []),
    }),
  });
  tabell('tabell-varegrupper', {
    kilde: 'ldir_varegrupper',
    nokkel: ['aar', 'varegruppe'],
    kolonner: [{ felt: 'varegruppe', navn: 'Varegruppe', tekst: true }, { felt: 'aar', navn: 'År' }, { felt: 'andel_prosent', navn: 'Andel (%)', fmt: fmt.d1 }, { felt: 'omsetning_mill_kr', navn: 'Mill. kr', fmt: fmt.int }, { felt: 'kilde', navn: 'Kilde i rapporten', tekst: true }],
    rader: [...alle].sort((a, b) => Number(b.aar) - Number(a.aar) || N(b.andel_prosent) - N(a.andel_prosent)),
  });
});

figur('graf-kanaler', ['ldir_kanaler'], (el) => {
  const alle = rader('ldir_kanaler');
  const kanaler = ['Vinmonopolet', 'Bakerier inkl. kaféutsalg', 'Storhusholdning (grossistledd)', 'Spesialbutikker', 'Bondens marked'];
  smaa(el, {
    paneler: kanaler.map((k) => ({
      tittel: KANAL_KORT[k] || k,
      fmt: mkr,
      punkter: alle.filter((d) => d.kanal === k).map((d) => ({ x: Number(d.aar), y: N(d.omsetning_mill_kr) })).sort((a, b) => a.x - b.x),
    })),
  });
  tabell('tabell-kanaler', {
    kilde: 'ldir_kanaler',
    nokkel: ['aar', 'kanal'],
    kolonner: [{ felt: 'kanal', navn: 'Kanal', tekst: true }, { felt: 'aar', navn: 'År' }, { felt: 'omsetning_mill_kr', navn: 'Mill. kr', fmt: fmt.d1 }, { felt: 'kilde', navn: 'Kilde i rapporten', tekst: true }],
    rader: [...alle].sort((a, b) => Number(b.aar) - Number(a.aar) || kanaler.indexOf(a.kanal) - kanaler.indexOf(b.kanal)),
  });
});

// ---- Europa
figur('graf-europa', ['eurostat_europa'], (el) => {
  const alle = rader('eurostat_europa');
  const r = [...alle].sort((a, b) => N(b.andel_prosent) - N(a.andel_prosent))
    .map((d) => ({ navn: d.land, verdi: N(d.andel_prosent), farge: d.landkode === 'NO' ? farge(0) : DEMPET, uthev: d.landkode === 'NO', d }));
  liggende(el, {
    rader: r,
    fmt: (v) => pst(v, 1),
    radHoyde: 22,
    tips: (x) => ({ tittel: `${x.d.land}, ${x.d.aar}`, linjer: [{ verdi: pst(x.verdi, 1), tekst: 'av jordbruksarealet' }], notat: x.d.merknad || null }),
  });
  tabell('tabell-europa', {
    kilde: 'eurostat_europa',
    nokkel: ['landkode'],
    kolonner: [{ felt: 'land', navn: 'Land', tekst: true }, { felt: 'aar', navn: 'År' }, { felt: 'andel_prosent', navn: 'Andel (%)', fmt: fmt.d2 }, { felt: 'merknad', navn: 'Merknad', tekst: true }],
    rader: r.map((x) => x.d),
  });
});

figur('graf-norden', ['norden_andel'], (el) => {
  const alle = rader('norden_andel');
  const land = [['NO', 'Norge'], ['SE', 'Sverige'], ['DK', 'Danmark'], ['FI', 'Finland']];
  forklaring(el, land.map(([, navn], i) => ({ tekst: navn, farge: farge(i), form: 'line' })));
  const h2 = alle.filter((d) => d.tabell === 'org_cropar_h2').map((d) => Number(d.aar));
  linjer(el, {
    serier: land.map(([kode, navn], i) => ({
      felt: kode,
      navn,
      farge: farge(i),
      punkter: alle.filter((d) => d.landkode === kode).map((d) => ({ x: Number(d.aar), y: N(d.andel_prosent) })),
    })),
    akseFmt: pstAkse,
    verdiFmt: (v) => pst(v, 1),
    endeTekst: (s, p) => `${s.navn} ${pst(p.y, 1)}`,
    vref: h2.length ? [{ x: d3.max(h2) + 0.5, tekst: 'Ny tabell' }] : [],
    hoyde: 280,
  });
  tabell('tabell-norden', {
    kilde: 'norden_andel',
    nokkel: ['aar', 'landkode'],
    kolonner: [{ felt: 'land', navn: 'Land', tekst: true }, { felt: 'aar', navn: 'År' }, { felt: 'andel_prosent', navn: 'Andel (%)', fmt: fmt.d2 }, { felt: 'tabell', navn: 'Eurostat-tabell', tekst: true }],
    rader: [...alle].sort((a, b) => Number(b.aar) - Number(a.aar) || a.landkode.localeCompare(b.landkode)),
  });
});

figur('graf-forbruk', ['fibl_forbruk'], (el) => {
  const alle = rader('fibl_forbruk');
  const r = [...alle].sort((a, b) => N(b.euro_per_innbygger) - N(a.euro_per_innbygger))
    .map((d) => ({ navn: d.land, verdi: N(d.euro_per_innbygger), farge: d.landkode === 'NO' ? farge(0) : DEMPET, uthev: d.landkode === 'NO', d }));
  liggende(el, {
    rader: r,
    fmt: (v) => `${fmt.int(v)} €`,
    radHoyde: 20,
    tips: (x) => ({ tittel: `${x.d.land}, ${x.d.aar}`, linjer: [{ verdi: `${fmt.d1(x.verdi)} €`, tekst: 'per innbygger' }] }),
  });
  tabell('tabell-forbruk', {
    kilde: 'fibl_forbruk',
    nokkel: ['landkode'],
    kolonner: [{ felt: 'land', navn: 'Land', tekst: true }, { felt: 'aar', navn: 'År' }, { felt: 'euro_per_innbygger', navn: 'Euro per innbygger', fmt: fmt.d1 }],
    rader: r.map((x) => x.d),
  });
});

// ---- Mål og tilskudd
figur('graf-endring', ['endring_areal', 'maal_2032'], (el) => {
  const r = rader('endring_areal').map((d) => ({ x: d.aar, v: d.areal_endring_dekar, g: d.gaarder_endring }));
  const maal = rader('maal_2032')[0];
  forklaring(el, [
    { tekst: 'Økning', farge: farge(0) },
    { tekst: 'Nedgang', farge: farge(1) },
    { tekst: 'Økning som trengs hvert år', farge: REF, form: 'dash' },
  ]);
  soyler(el, {
    kategorier: r.map((d) => d.x),
    rader: r,
    serier: [{ felt: 'v', farge: (d) => (d.v >= 0 ? farge(0) : farge(1)) }],
    ref: maal && maal.trengs_per_aar != null ? [{ verdi: maal.trengs_per_aar, tekst: `Trengs: ${fmt.int(maal.trengs_per_aar)} dekar per år` }] : [],
    hoyde: 280,
    tips: (d) => ({
      tittel: d.x,
      linjer: [{ verdi: `${medFortegn(fmt.int)(d.v)} dekar`, tekst: 'økologisk areal' }, { verdi: medFortegn(fmt.int)(d.g), tekst: 'gårder' }],
    }),
  });
  tabell('tabell-endring', {
    kilde: 'endring_areal',
    nokkel: ['aar'],
    kolonner: [{ felt: 'aar', navn: 'År' }, { felt: 'areal_endring_dekar', navn: 'Endring areal (dekar)', fmt: medFortegn(fmt.int) }, { felt: 'gaarder_endring', navn: 'Endring gårder', fmt: medFortegn(fmt.int) }],
    rader: [...rader('endring_areal')].reverse(),
  });
});

figur('graf-tilskudd', ['ldir_tilskudd'], (el) => {
  const alle = rader('ldir_tilskudd');
  const defs = [...new Set(alle.map((d) => d.definisjon))];
  const r = alle.map((d) => ({
    x: String(d.aar), v: N(d.direkte_tilskudd_mill_kr), def: d.definisjon,
    areal: N(d.arealtilskudd_mill_kr), husdyr: N(d.husdyrtilskudd_mill_kr), omlegging: N(d.omleggingstilskudd_mill_kr),
  }));
  const aar = r.map((d) => Number(d.x));
  forklaring(el, defs.map((d, i) => ({ tekst: d, farge: farge(i) })));
  soyler(el, {
    kategorier: aarListe(d3.min(aar), d3.max(aar)),
    rader: r,
    serier: [{ felt: 'v', farge: (d) => farge(defs.indexOf(d.def)) }],
    hoyde: 260,
    tips: (d) => ({
      tittel: d.x,
      linjer: [{ farge: farge(defs.indexOf(d.def)), verdi: `${fmt.d1(d.v)} mill. kr`, tekst: 'i alt' }]
        .concat(d.areal != null ? [{ verdi: `${fmt.d1(d.areal)} mill. kr`, tekst: 'arealtilskudd' }] : [])
        .concat(d.husdyr != null ? [{ verdi: `${fmt.d1(d.husdyr)} mill. kr`, tekst: 'husdyrtilskudd' }] : [])
        .concat(d.omlegging != null ? [{ verdi: `${fmt.d1(d.omlegging)} mill. kr`, tekst: 'omleggingstilskudd' }] : []),
      notat: d.def,
    }),
  });
  tabell('tabell-tilskudd', {
    kilde: 'ldir_tilskudd',
    nokkel: ['aar'],
    kolonner: [
      { felt: 'aar', navn: 'År' },
      { felt: 'direkte_tilskudd_mill_kr', navn: 'I alt (mill. kr)', fmt: fmt.d1 },
      { felt: 'arealtilskudd_mill_kr', navn: 'Areal', fmt: fmt.d1 },
      { felt: 'husdyrtilskudd_mill_kr', navn: 'Husdyr', fmt: fmt.d1 },
      { felt: 'omleggingstilskudd_mill_kr', navn: 'Omlegging', fmt: fmt.d1 },
      { felt: 'definisjon', navn: 'Definisjon', tekst: true },
      { felt: 'kilde', navn: 'Kilde i rapporten', tekst: true },
    ],
    rader: [...alle].reverse(),
  });
});

// ---- Om tallene
figur('graf-kilder', ['kilder'], (el) => {
  const boks = lagEl('div', 'oko-tabell-boks');
  boks.id = 'tabell-kilder';
  boks.style.maxHeight = 'none';
  el.appendChild(boks);
  tabell('tabell-kilder', {
    kilde: 'kilder',
    nokkel: ['datasett'],
    kolonner: [
      { felt: 'tittel', navn: 'Datasett', tekst: true, lenke: (r) => r.lenke },
      { felt: 'kilde', navn: 'Kilde', tekst: true },
      { felt: 'periode', navn: 'Periode' },
      { felt: 'oppdateres', navn: 'Oppdateres', tekst: true },
    ],
    rader: rader('kilder'),
  });
});

/* ======================================================================= kildene */

// Hvor tallene kommer fra. Lenkene går til siden hos kilden som ligger nærmest dataene
// (Statistikkbanken, siden der rapporten ligger, datasettet hos Eurostat osv.).
const KILDER = {
  ssb_oko: {
    navn: 'Statistisk sentralbyrå (SSB)',
    tittel: 'Gardsbruk, jordbruksareal og husdyr – tabellene i Statistikkbanken',
    lenke: 'https://www.ssb.no/statbank/list/stjord',
    om: 'Økologisk drift står i tabell 12661 (økologisk areal og gårder, hele landet og fylker), 12662 (godkjent økologisk areal etter vekst) og 12663 (økologiske husdyr).',
    mer: [['Om statistikken', 'https://www.ssb.no/jord-skog-jakt-og-fiskeri/jordbruk/statistikk/gardsbruk-jordbruksareal-og-husdyr']],
  },
  ssb_jord: {
    navn: 'Statistisk sentralbyrå (SSB)',
    tittel: 'Gardsbruk, jordbruksareal og husdyr – jordbruksareal i Statistikkbanken',
    lenke: 'https://www.ssb.no/statbank/list/stjord',
    om: 'Tabell 04496: jordbruksareal i drift for hele landet. Brukes som nevner når økologisk andel regnes ut.',
  },
  ldir: {
    navn: 'Landbruksdirektoratet',
    tittel: 'Produksjon av økologiske jordbruksvarer – rapport for 2025',
    lenke: 'https://www.landbruksdirektoratet.no/nb/nyhetsrom/rapporter/produksjon-av-okologiske-jordbruksvarer%202026',
    om: 'Den årlige rapporten (PDF) om økologisk melk, kjøtt, egg, korn, salg og tilskudd. Eldre tall er hentet fra rapportene for 2017–2024.',
    mer: [['Tidligere rapporter (2017–2024)', 'https://www.landbruksdirektoratet.no/nb/jordbruk/miljo-og-klima/okologisk-landbruk']],
  },
  slf2012: {
    navn: 'Statens landbruksforvaltning (nå Landbruksdirektoratet)',
    tittel: 'Produksjon og omsetning av økologiske landbruksvarer – rapport for 2012',
    om: 'Gir tallene for årene før 2015. Rapporten (rapport 12/2013) ligger ikke lenger på Landbruksdirektoratets nettsider; dashbordet bygger på en arkivkopi.',
  },
  debio: {
    navn: 'Debio',
    tittel: 'Statistikk',
    lenke: 'https://debio.no/statistikk/',
    om: 'Debios årlige statistikk med regneark for virksomheter, areal, planteproduksjon og husdyr.',
  },
  eurostat: {
    navn: 'Eurostat',
    tittel: 'Organic crop area by agricultural production methods and crops (org_cropar)',
    lenke: 'https://ec.europa.eu/eurostat/databrowser/view/org_cropar/default/table?lang=en',
    om: 'Økologisk areal og andel av jordbruksarealet i europeiske land.',
    mer: [['Om statistikken', 'https://ec.europa.eu/eurostat/cache/metadata/en/org_esms.htm']],
  },
  eurostat_h2: {
    navn: 'Eurostat',
    tittel: 'Organic crop area – tall til og med 2011 (org_cropar_h2)',
    lenke: 'https://ec.europa.eu/eurostat/databrowser/view/org_cropar_h2/default/table?lang=en',
    om: 'Økologisk andel av jordbruksarealet før 2012.',
  },
  fibl: {
    navn: 'FiBL (Forschungsinstitut für biologischen Landbau)',
    tittel: 'FiBL Statistics – Organic retail sales',
    lenke: 'https://statistics.fibl.org/europe/retail-sales-europe.html',
    om: 'Omsetning av økologisk mat og forbruk per innbygger i europeiske land. Tallene ble hentet fra statistics.fibl.org 24.–25. oktober 2026.',
  },
  strategi: {
    navn: 'Regjeringen',
    tittel: 'Nasjonal strategi for økologisk jordbruk 2025–2032',
    lenke: 'https://www.regjeringen.no/no/dokumenter/nasjonal-strategi-for-okologisk-jordbruk-2025-2032/id3097100/',
    om: 'Målet om at 10 % av jordbruksarealet skal være økologisk innen 2032.',
  },
  kart: {
    navn: 'Kartverket',
    tittel: 'Administrative enheter – fylker',
    lenke: 'https://data.norge.no/en/datasets/cffde12f-3530-4406-9aa0-d6d4519ef077/administrative-enheter-fylker',
    om: 'Fylkesgrensene (CC BY 4.0), forenklet for skjerm via robhop/fylker-og-kommuner.',
    mer: [['robhop/fylker-og-kommuner', 'https://github.com/robhop/fylker-og-kommuner']],
  },
};

function lenkeEl(tekst, href, cls) {
  const a = lagEl('a', cls, tekst);
  a.href = href;
  a.target = '_blank';
  a.rel = 'noopener';
  return a;
}

function fyllKilder() {
  for (const boks of document.querySelectorAll('.oko .oko-kildeboks[data-kilder]')) {
    if (boks.querySelector('.oko-kildeposter')) continue;
    const liste = lagEl('ul', 'oko-kildeposter');
    for (const nokkel of boks.dataset.kilder.split(/\s+/)) {
      const k = KILDER[nokkel];
      if (!k) continue;
      const li = lagEl('li', 'oko-kildepost');
      li.appendChild(lagEl('div', 'oko-kildenavn', k.navn));
      if (k.lenke) {
        li.appendChild(lenkeEl(k.tittel, k.lenke, 'oko-kildetittel'));
        li.appendChild(lagEl('div', 'oko-kildeurl', k.lenke.replace(/^https:\/\//, '').replace(/\/$/, '')));
      } else {
        li.appendChild(lagEl('div', 'oko-kildetittel', k.tittel));
      }
      if (k.om) li.appendChild(lagEl('div', 'oko-kildeom', k.om));
      if (k.mer?.length) {
        const mer = lagEl('div', 'oko-kildemer');
        k.mer.forEach(([t, href], i) => {
          if (i) mer.appendChild(document.createTextNode(' · '));
          mer.appendChild(lenkeEl(t, href));
        });
        li.appendChild(mer);
      }
      liste.appendChild(li);
    }
    boks.appendChild(liste);
  }
}

/* ======================================================================= tall i teksten */

function fyllTekster() {
  for (const el of document.querySelectorAll('.oko [data-fmt]')) {
    const d = D(el.dataset.source);
    if (d.status !== 'ok') {
      if (d.status !== 'loading') el.classList.remove('dash-skeleton');
      continue;
    }
    let rows = Array.isArray(d.data) ? d.data : [];
    if (el.dataset.filter) {
      const [k, v] = el.dataset.filter.split('=');
      rows = rows.filter((r) => String(r[k]) === v);
    }
    let rad = null;
    if (el.dataset.row != null) rad = rows[Number(el.dataset.row)];
    else if (el.dataset.latest) {
      const k = el.dataset.latest;
      const av = el.dataset.latestOf || el.dataset.field;
      for (const r of rows) {
        if (r[av] === '' || r[av] == null) continue;
        if (!rad || Number(r[k]) > Number(rad[k])) rad = r;
      }
      if (rad) el.dataset.where = (el.dataset.filter ? `${el.dataset.filter}&` : '') + `${k}=${encodeURIComponent(rad[k])}`;
    }
    el.classList.remove('dash-skeleton');
    const v = rad ? rad[el.dataset.field] : null;
    if (v === '' || v == null) {
      el.textContent = '—';
      continue;
    }
    const f = FMT[el.dataset.fmt];
    el.textContent = f ? f(Number(v)) : String(v);
    if (el.dataset.good) {
      const n = Number(v);
      const flat = f ? f(n) === f(0) : n === 0;
      const godt = el.dataset.good === 'up' ? n > 0 : n < 0;
      el.classList.toggle('oko-flat', flat);
      el.classList.toggle('oko-up', !flat && godt);
      el.classList.toggle('oko-down', !flat && !godt);
    }
  }
}

/* ======================================================================= faner og tegning */

const faner = [...document.querySelectorAll('.oko-tab')];
const sider = faner.map((f) => f.dataset.page);
let aktivSide = 'oversikt';

function tegnFigur(id) {
  const f = FIGURER[id];
  const el = document.getElementById(id);
  if (!f || !el) return;
  const status = f.kilder.map((k) => D(k).status);
  if (status.some((s) => s !== 'ok' && s !== 'loading')) {
    el.classList.remove('dash-skeleton');
    el.replaceChildren(melding('Kunne ikke laste tallene'));
    return;
  }
  if (!status.every((s) => s === 'ok')) return;
  el.classList.remove('dash-skeleton');
  el.replaceChildren();
  try {
    f.tegn(el);
  } catch (e) {
    console.error(`Figuren ${id} kunne ikke tegnes`, e);
    el.replaceChildren(melding('Figuren kunne ikke tegnes'));
  }
}

function tegnSide(side) {
  for (const id of Object.keys(FIGURER)) {
    const el = document.getElementById(id);
    if (el && el.closest('.oko-page')?.id === side) tegnFigur(id);
  }
}

function visSide(side, fokus) {
  if (!sider.includes(side)) return;
  aktivSide = side;
  for (const f of faner) {
    const paa = f.dataset.page === side;
    f.setAttribute('aria-selected', String(paa));
    f.tabIndex = paa ? 0 : -1;
    if (paa && fokus) f.focus();
  }
  for (const s of sider) document.getElementById(s).hidden = s !== side;
  tegnSide(side);
}

faner.forEach((f, i) => {
  f.addEventListener('click', () => {
    visSide(f.dataset.page);
    dash.setLink(f.dataset.page);
  });
  f.addEventListener('keydown', (ev) => {
    if (ev.key !== 'ArrowRight' && ev.key !== 'ArrowLeft') return;
    ev.preventDefault();
    const j = (i + (ev.key === 'ArrowRight' ? 1 : -1) + faner.length) % faner.length;
    visSide(faner[j].dataset.page, true);
    dash.setLink(faner[j].dataset.page);
  });
});

for (const b of document.querySelectorAll('#fylke-valg button')) {
  b.addEventListener('click', () => {
    fylkeMaal = b.dataset.maal;
    for (const k of document.querySelectorAll('#fylke-valg button')) k.setAttribute('aria-pressed', String(k === b));
    tegnSide('fylker');
  });
}

function aapneLenke() {
  // ?fane=maal åpner en fane og viser siden fra toppen (brukes av kampanjeadressen, se nettside/2032/).
  // #maal åpner fanen og ruller ned til den; #<id> åpner fanen elementet ligger i og ruller dit.
  const fane = new URLSearchParams(location.search).get('fane');
  if (fane && sider.includes(fane)) {
    visSide(fane);
    return;
  }
  const navn = decodeURIComponent((location.hash || '').slice(1));
  if (!navn) return;
  const el = document.getElementById(navn);
  if (!el) return;
  const side = sider.includes(navn) ? navn : el.closest('.oko-page')?.id;
  if (!side) return;
  visSide(side);
  if (side !== navn) el.scrollIntoView({ block: 'start' });
}

fyllKilder();
aapneLenke();

dash.onData(() => {
  fyllTekster();
  tegnSide(aktivSide);
});
