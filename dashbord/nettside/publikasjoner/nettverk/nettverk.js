/* nettverk.js – tegner tre nettverk (publikasjoner, forskere, forskningsmiljøer) med forhåndsberegnet plassering,
   med zoom, svevetekst, søk, valg med naboer og et sidepanel. Data ligger i <script id="nett-data">, som
   dashbord/skript/lag_nettverk_side.py fyller fra data/publikasjonsnettverk.json. Trenger d3 (v7). */
(function () {
  'use strict';
  const D = JSON.parse(document.getElementById('nett-data').textContent);
  const NS = 'http://www.w3.org/2000/svg';
  const B = 1000, H = 760;
  const GRUPPE = {
    art: 'Vitenskapelig artikkel', rap: 'Rapport, oppgave eller konferansebidrag', fag: 'Praktisk fagstoff',
    off: 'Offentlig dokument eller organisasjon',
  };
  const tall = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const el = (tag, attrs, tekst) => {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) { if (attrs[k] !== undefined && attrs[k] !== null) e.setAttribute(k, attrs[k]); }
    if (tekst !== undefined) e.textContent = tekst;
    return e;
  };
  const svgEl = (tag, attrs) => {
    const e = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  };
  const norm = (s) => (s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/ø/g, 'o').replace(/æ/g, 'ae').replace(/å/g, 'a');
  const kort = (s, n) => (s.length > n ? s.slice(0, n - 1).replace(/[\s,.:;–-]+$/, '') + '…' : s);

  // ---------- faner ----------
  const faner = Array.from(document.querySelectorAll('#nett-faner .oko-tab'));
  const sider = {};
  faner.forEach((f) => { sider[f.dataset.side] = document.getElementById('side-' + f.dataset.side); });
  const tegnet = {};
  function visFane(navn, fokus, utenAdresse) {
    if (!sider[navn]) navn = 'publikasjoner';
    faner.forEach((f) => {
      const valgt = f.dataset.side === navn;
      f.setAttribute('aria-selected', valgt ? 'true' : 'false');
      f.tabIndex = valgt ? 0 : -1;
      sider[f.dataset.side].hidden = !valgt;
      if (valgt && fokus) f.focus();
    });
    if (!tegnet[navn] && TEGN[navn]) { tegnet[navn] = true; TEGN[navn](); }
    if (!utenAdresse) { try { history.replaceState(null, '', '#' + navn); } catch (e) { /* forhåndsvisning */ } }
  }
  // GoatCounter-hendelse når en besøkende bytter visning (ikke ved første visning)
  function tell(navn) {
    try { if (window.goatcounter && window.goatcounter.count) window.goatcounter.count({ path: navn, title: navn, event: true }); } catch (e) { /* ingen telling */ }
  }
  faner.forEach((f, i) => {
    f.addEventListener('click', () => { visFane(f.dataset.side); tell('nett-fane-' + f.dataset.side); });
    f.addEventListener('keydown', (ev) => {
      if (ev.key !== 'ArrowRight' && ev.key !== 'ArrowLeft') return;
      ev.preventDefault();
      const j = (i + (ev.key === 'ArrowRight' ? 1 : faner.length - 1)) % faner.length;
      visFane(faner[j].dataset.side, true);
    });
  });

  // ---------- felles nettverksvisning ----------
  function Nettverk(rot, opt) {
    const flate = rot.querySelector('.nett-flate');
    const svg = flate.querySelector('svg');
    const tips = flate.querySelector('.nett-tips');
    const lag = svgEl('g');
    const gE = svgEl('g'), gN = svgEl('g'), gL = svgEl('g');
    lag.append(gE, gN, gL);
    svg.appendChild(lag);
    const noder = opt.noder;
    const nabo = noder.map(() => new Map());   // nabo[i]: j -> [typer]
    const kantEl = [];
    for (const sett of opt.kanter) {
      for (const k of sett.liste) {
        const [a, b, w] = k;
        const A = noder[a], Bn = noder[b];
        const linje = svgEl('line', { x1: A.x, y1: A.y, x2: Bn.x, y2: Bn.y, class: 'e ' + sett.klasse });
        if (sett.bredde) linje.style.strokeWidth = sett.bredde(w || 1) + 'px';
        gE.appendChild(linje);
        kantEl.push({ a, b, linje, type: sett.type });
        if (!nabo[a].has(b)) nabo[a].set(b, []);
        if (!nabo[b].has(a)) nabo[b].set(a, []);
        nabo[a].get(b).push(sett.type);
        nabo[b].get(a).push(sett.type);
      }
    }
    const nodeEl = noder.map((n, i) => {
      const c = svgEl('circle', { cx: n.x, cy: n.y, r: n.r, class: 'n ' + n.cls });
      c.dataset.i = i;
      gN.appendChild(c);
      return c;
    });
    const lblEl = new Map();
    noder.forEach((n, i) => {
      if (!n.lbl) return;
      const [lx, ly, la] = n.l || [n.x + n.r + 3, n.y + 4, 'start'];
      const t = svgEl('text', { x: lx, y: ly, class: 'lbl', 'text-anchor': la });
      t.textContent = n.lbl;
      gL.appendChild(t);
      lblEl.set(i, t);
    });
    const klLbl = (opt.klyngeEtiketter || []).map((k) => {
      const t = svgEl('text', { x: k.x, y: k.y, class: 'kl-lbl', 'text-anchor': 'middle' });
      t.textContent = k.navn;
      gL.appendChild(t);
      return { t, k };
    });

    // zoom
    let k = 1;
    const zoom = d3.zoom().scaleExtent([0.6, 9]).on('zoom', (ev) => {
      k = ev.transform.k;
      lag.setAttribute('transform', ev.transform.toString());
      const f = 11.5 / Math.sqrt(k);
      lblEl.forEach((t) => { t.style.fontSize = f + 'px'; });
      klLbl.forEach(({ t }) => { t.style.fontSize = (13 / Math.sqrt(k)) + 'px'; });
    });
    const sel = d3.select(svg).call(zoom).on('dblclick.zoom', null);
    lblEl.forEach((t) => { t.style.fontSize = '11.5px'; });
    klLbl.forEach(({ t }) => { t.style.fontSize = '13px'; });
    const knapper = flate.querySelectorAll('.nett-zoom button');
    knapper[0].addEventListener('click', () => sel.transition().duration(250).call(zoom.scaleBy, 1.6));
    knapper[1].addEventListener('click', () => sel.transition().duration(250).call(zoom.scaleBy, 1 / 1.6));
    knapper[2].addEventListener('click', () => sel.transition().duration(300).call(zoom.transform, d3.zoomIdentity));

    function sentrer(i) {
      const n = noder[i];
      const s = Math.max(k, 2.2);
      sel.transition().duration(450).call(zoom.transform, d3.zoomIdentity.translate(B / 2 - n.x * s, H / 2 - n.y * s).scale(s));
    }

    // nærmeste node under pekeren (romslig treffområde)
    function naermeste(ev) {
      const [px, py] = d3.pointer(ev, svg);
      const t = d3.zoomTransform(svg);
      const [x, y] = t.invert([px, py]);
      const skala = svg.clientWidth / B;
      let best = -1, bestD = Infinity;
      for (let i = 0; i < noder.length; i++) {
        const n = noder[i];
        const d = Math.hypot(n.x - x, n.y - y) * t.k * skala - n.r * t.k * skala;
        if (d < bestD) { bestD = d; best = i; }
      }
      return bestD <= 14 ? best : -1;
    }
    let svev = -1, valgt = -1, uthevet = null;
    function visTips(i, ev) {
      if (i < 0) { tips.hidden = true; return; }
      tips.replaceChildren();
      const [tittel, ...linjer] = opt.tips(noder[i], i);
      tips.appendChild(el('b', null, tittel));
      linjer.forEach((l) => tips.appendChild(el('span', null, l)));
      tips.hidden = false;
      const r = flate.getBoundingClientRect();
      const x = ev.clientX - r.left, y = ev.clientY - r.top;
      const w = tips.offsetWidth, h = tips.offsetHeight;
      tips.style.left = Math.max(6, Math.min(r.width - w - 6, x + 14)) + 'px';
      tips.style.top = (y + 16 + h > r.height ? Math.max(6, y - h - 12) : y + 16) + 'px';
    }
    svg.addEventListener('pointermove', (ev) => {
      if (ev.buttons) return;
      const i = naermeste(ev);
      if (i !== svev) {
        if (svev >= 0) nodeEl[svev].classList.remove('svev');
        svev = i;
        if (i >= 0) nodeEl[i].classList.add('svev');
        svg.style.cursor = i >= 0 ? 'pointer' : '';
      }
      visTips(i, ev);
    });
    svg.addEventListener('pointerleave', () => {
      if (svev >= 0) nodeEl[svev].classList.remove('svev');
      svev = -1; tips.hidden = true;
    });
    let ned = null;
    svg.addEventListener('pointerdown', (ev) => { ned = [ev.clientX, ev.clientY]; });
    svg.addEventListener('click', (ev) => {
      if (ned && Math.hypot(ev.clientX - ned[0], ev.clientY - ned[1]) > 5) return;  // dra, ikke klikk
      const i = naermeste(ev);
      if (i >= 0) api.velg(i, false); else api.nullstill();
    });

    function marker(sett, kanter) {
      lag.classList.toggle('har-valg', !!sett);
      nodeEl.forEach((c, i) => c.classList.toggle('aktiv', !!sett && sett.has(i)));
      lblEl.forEach((t, i) => t.classList.toggle('aktiv', !!sett && sett.has(i)));
      kantEl.forEach((e) => e.linje.classList.toggle('aktiv', !!kanter && kanter(e)));
      klLbl.forEach(({ t, k: kl }) => t.classList.toggle('aktiv', !!sett && uthevet === kl.nr));
    }
    const skjult = new Set();   // kanttyper som er slått av
    const synligNabo = (i) => Array.from(nabo[i].entries()).filter(([, typer]) => typer.some((t) => !skjult.has(t))).map(([j]) => j);
    const api = {
      noder, nabo, sentrer,
      velg(i, flytt) {
        if (valgt >= 0) nodeEl[valgt].classList.remove('valgt');
        valgt = i; uthevet = null;
        nodeEl[i].classList.add('valgt');
        const sett = new Set([i, ...synligNabo(i)]);
        marker(sett, (e) => (e.a === i || e.b === i) && !skjult.has(e.type));
        if (flytt) sentrer(i);
        opt.vis(i);
      },
      uthev(nr, medlemmer) {
        if (valgt >= 0) nodeEl[valgt].classList.remove('valgt');
        valgt = -1; uthevet = nr;
        const sett = new Set(medlemmer);
        marker(sett, (e) => sett.has(e.a) && sett.has(e.b));
      },
      nullstill() {
        if (valgt >= 0) nodeEl[valgt].classList.remove('valgt');
        valgt = -1; uthevet = null;
        marker(null, null);
        opt.vis(-1);
      },
      zoomUt() { sel.transition().duration(300).call(zoom.transform, d3.zoomIdentity); },
      settKlasse(navn, pa) { lag.classList.toggle(navn, pa); },
      skjulType(type, pa) {
        if (pa) skjult.add(type); else skjult.delete(type);
        lag.classList.toggle('skjul-' + type, pa);
        if (valgt >= 0) api.velg(valgt, false);
      },
    };
    // søk
    const sok = rot.querySelector('.nett-sok input');
    const treff = rot.querySelector('.nett-treff');
    if (sok) {
      const indeks = noder.map((n) => norm(opt.sokeTekst(n)));
      const vis = () => {
        const q = norm(sok.value.trim());
        treff.replaceChildren();
        if (q.length < 2) { treff.hidden = true; return; }
        const ord = q.split(/\s+/);
        const funn = [];
        for (let i = 0; i < noder.length && funn.length < 10; i++) {
          if (ord.every((o) => indeks[i].includes(o))) funn.push(i);
        }
        if (!funn.length) treff.appendChild(el('li', { class: 'nett-meta', style: 'padding:6px 8px' }, 'Ingen treff'));
        funn.forEach((i) => {
          const li = el('li');
          const b = el('button', { type: 'button' }, opt.sokeTittel(noder[i]));
          b.appendChild(el('span', { class: 'nett-treff-meta' }, opt.sokeMeta(noder[i])));
          b.addEventListener('click', () => { treff.hidden = true; sok.value = ''; api.velg(i, true); });
          li.appendChild(b);
          treff.appendChild(li);
        });
        treff.hidden = false;
      };
      sok.addEventListener('input', vis);
      sok.addEventListener('keydown', (ev) => {
        if (ev.key === 'Escape') { sok.value = ''; treff.hidden = true; }
        if (ev.key === 'Enter') { const b = treff.querySelector('button'); if (b) { ev.preventDefault(); b.click(); } }
        if (ev.key === 'ArrowDown') { const b = treff.querySelector('button'); if (b) { ev.preventDefault(); b.focus(); } }
      });
      treff.addEventListener('keydown', (ev) => {
        const knapper = Array.from(treff.querySelectorAll('button'));
        const j = knapper.indexOf(document.activeElement);
        if (ev.key === 'ArrowDown' && j < knapper.length - 1) { ev.preventDefault(); knapper[j + 1].focus(); }
        if (ev.key === 'ArrowUp') { ev.preventDefault(); (j > 0 ? knapper[j - 1] : sok).focus(); }
        if (ev.key === 'Escape') { treff.hidden = true; sok.focus(); }
      });
      document.addEventListener('click', (ev) => { if (!rot.querySelector('.nett-sok').contains(ev.target)) treff.hidden = true; });
    }
    return api;
  }

  // hjelpere for panelet
  function liste(elementer) {
    const ul = el('ul', { class: 'nett-liste' });
    elementer.forEach(({ tekst, tall: t, prikk, klikk }) => {
      const li = el('li');
      const b = el('button', { type: 'button' });
      if (prikk) b.appendChild(el('span', { class: 'nett-prikk ' + prikk, 'aria-hidden': 'true' }));
      b.appendChild(document.createTextNode(tekst));
      if (t !== undefined) b.appendChild(el('span', { class: 'nett-tall' }, ' · ' + t));
      b.addEventListener('click', klikk);
      li.appendChild(b);
      ul.appendChild(li);
    });
    return ul;
  }
  const prikkKlasse = { art: 'g-art', rap: 'g-rap', fag: 'g-fag', off: 'g-off' };

  // ---------- publikasjonsnettverket ----------
  function tegnPublikasjoner() {
    const rot = document.getElementById('side-publikasjoner');
    const P = D.p;
    const vis = P.map((p, i) => i).filter((i) => P[i].x !== null);
    const pos = new Map(vis.map((i, j) => [i, j]));
    const noder = vis.map((i) => {
      const p = P[i];
      return { ...p, i, cls: 'g-' + p.g, r: 3.6 + 2.3 * Math.sqrt(p.inn), lbl: p.lbl || null };
    });
    const kant = (liste) => liste.filter((k) => pos.has(k[0]) && pos.has(k[1])).map((k) => [pos.get(k[0]), pos.get(k[1]), k[2]]);
    const kl = new Map(D.kl.map((k) => [k.nr, k]));
    const panel = rot.querySelector('.nett-panel');
    let nett = null;

    function standardPanel() {
      panel.replaceChildren();
      panel.appendChild(el('h3', null, 'Grupper av publikasjoner'));
      panel.appendChild(el('p', { class: 'nett-meta' },
        'Publikasjoner som siterer hverandre, bygger på de samme kildene eller har forfattere felles, havner i samme gruppe. Velg en gruppe for å se den i nettverket.'));
      D.kl.forEach((g) => {
        const boks = el('div', { class: 'nett-gruppe' });
        const b = el('button', { type: 'button', class: 'nett-gruppe-navn', 'aria-pressed': 'false' }, g.navn + ' (' + g.n + ')');
        b.addEventListener('click', () => {
          const pa = b.getAttribute('aria-pressed') !== 'true';
          panel.querySelectorAll('.nett-gruppe-navn').forEach((x) => x.setAttribute('aria-pressed', 'false'));
          if (pa) {
            b.setAttribute('aria-pressed', 'true');
            nett.uthev(g.nr, noder.map((n, j) => (n.kl === g.nr ? j : -1)).filter((j) => j >= 0));
          } else nett.nullstill();
        });
        boks.appendChild(b);
        boks.appendChild(el('p', null, g.beskrivelse));
        boks.appendChild(liste(g.sentrale.filter((i) => pos.has(i)).slice(0, 3).map((i) => ({
          tekst: kort(P[i].t, 70), prikk: prikkKlasse[P[i].g], klikk: () => nett.velg(pos.get(i), true),
        }))));
        panel.appendChild(boks);
      });
      if (D.tall.uten_kobling) {
        panel.appendChild(el('p', { class: 'nett-merknad' },
          D.tall.uten_kobling + ' publikasjoner har ingen koblinger i dataene og vises ikke i nettverket. Du finner dem i fanen «Tabell».'));
      }
    }
    function visPub(j) {
      if (j < 0) { standardPanel(); return; }
      const n = noder[j];
      panel.replaceChildren();
      const tilbake = el('button', { type: 'button', class: 'nett-knapp nett-tilbake' }, '← Alle grupper');
      tilbake.addEventListener('click', () => nett.nullstill());
      panel.appendChild(tilbake);
      const h = el('h3');
      h.appendChild(el('a', { href: n.url, class: 'nett-lenke', target: '_blank', rel: 'noopener' }, n.t));
      panel.appendChild(h);
      panel.appendChild(el('p', { class: 'nett-meta' }, [n.type, n.aar, n.utg].filter(Boolean).join(' · ')));
      if (n.forf) panel.appendChild(el('p', { class: 'nett-meta' }, n.forf));
      const g = kl.get(n.kl);
      panel.appendChild(el('p', { class: 'nett-meta' }, 'Gruppe: ' + (g ? g.navn : 'ingen gruppe')));
      const seksjon = (tittel, ider, tallFn) => {
        if (!ider.length) return;
        panel.appendChild(el('h4', null, tittel + ' (' + ider.length + ')'));
        panel.appendChild(liste(ider.map((i) => ({
          tekst: kort(P[i].t, 80) + ' (' + P[i].aar + ')', prikk: prikkKlasse[P[i].g], tall: tallFn ? tallFn(i) : undefined,
          klikk: () => { if (pos.has(i)) nett.velg(pos.get(i), true); },
        }))));
      };
      const i = n.i;
      seksjon('Siterer i biblioteket', D.s.filter((k) => k[0] === i).map((k) => k[1]).sort((a, b) => P[b].aar - P[a].aar));
      seksjon('Sitert av i biblioteket', D.s.filter((k) => k[1] === i).map((k) => k[0]).sort((a, b) => P[b].aar - P[a].aar));
      const kilder = D.k.filter((k) => k[0] === i || k[1] === i).map((k) => [k[0] === i ? k[1] : k[0], k[2]]).sort((a, b) => b[1] - a[1]);
      seksjon('Bygger på de samme kildene som', kilder.slice(0, 8).map((x) => x[0]), (m) => kilder.find((x) => x[0] === m)[1] + ' felles kilder');
      const forf = D.f.filter((k) => k[0] === i || k[1] === i).map((k) => (k[0] === i ? k[1] : k[0]));
      if (forf.length) {
        panel.appendChild(el('h4', null, 'Har forfattere felles med'));
        panel.appendChild(el('p', { class: 'nett-meta' }, forf.length + ' publikasjoner. Slå på «Felles forfattere» over nettverket for å se dem.'));
      }
      if (!n.harref) panel.appendChild(el('p', { class: 'nett-merknad' }, 'Vi fant ikke referanselisten til denne publikasjonen, så den kan sitere flere enn det som vises.'));
    }

    nett = Nettverk(rot, {
      noder,
      kanter: [
        { type: 'f', klasse: 'e-f', liste: kant(D.f) },
        { type: 'k', klasse: 'e-k', liste: kant(D.k) },
        { type: 's', klasse: 'e-s', liste: kant(D.s) },
      ],
      klyngeEtiketter: D.kl.filter((g) => g.lx !== null).map((g) => ({ nr: g.nr, navn: g.kort, x: g.lx, y: g.ly })),
      tips: (n) => [n.t, GRUPPE[n.g] + ' · ' + n.aar, 'Sitert av ' + n.inn + ' · siterer ' + n.ut + ' i biblioteket'],
      vis: visPub,
      sokeTekst: (n) => n.t + ' ' + (n.forf || '') + ' ' + n.aar,
      sokeTittel: (n) => kort(n.t, 90),
      sokeMeta: (n) => [n.aar, n.forf ? kort(n.forf, 50) : ''].filter(Boolean).join(' · '),
    });
    rot.querySelectorAll('input[data-kant]').forEach((cb) => {
      nett.skjulType(cb.dataset.kant, !cb.checked);
      cb.addEventListener('change', () => nett.skjulType(cb.dataset.kant, !cb.checked));
    });
    rot.querySelector('.nett-nullstill').addEventListener('click', () => { nett.nullstill(); nett.zoomUt(); });
    standardPanel();
    const fra = new URLSearchParams(location.search).get('p');
    if (fra) { const j = noder.findIndex((n) => n.id === fra); if (j >= 0) nett.velg(j, true); }
  }

  // ---------- forskernettverket ----------
  function tegnForskere() {
    const rot = document.getElementById('side-forskere');
    const F = D.fo;
    const noder = F.map((f) => ({ ...f, cls: 'g-no', r: 3 + 2.1 * Math.sqrt(f.n), lbl: f.lbl ? f.navn : null }));
    const panel = rot.querySelector('.nett-panel');
    let nett = null;
    const pubListe = (ider) => liste(ider.map((i) => ({
      tekst: kort(D.p[i].t, 80) + ' (' + D.p[i].aar + ')', prikk: prikkKlasse[D.p[i].g],
      klikk: () => { window.open(D.p[i].url, '_blank', 'noopener'); },
    })));
    function standardPanel() {
      panel.replaceChildren();
      panel.appendChild(el('h3', null, 'Forskere som binder miljøene sammen'));
      panel.appendChild(el('p', { class: 'nett-meta' },
        'Forskere som ofte står på veien mellom andre forskere i nettverket. De har skrevet sammen med folk fra ulike grupper.'));
      const bro = noder.map((n, j) => j).sort((a, b) => noder[b].btw - noder[a].btw).slice(0, 8);
      panel.appendChild(liste(bro.map((j) => ({ tekst: noder[j].navn, tall: noder[j].n + ' publ.', klikk: () => nett.velg(j, true) }))));
      panel.appendChild(el('h4', null, 'Flest publikasjoner i biblioteket'));
      const flest = noder.map((n, j) => j).sort((a, b) => noder[b].n - noder[a].n).slice(0, 8);
      panel.appendChild(liste(flest.map((j) => ({ tekst: noder[j].navn, tall: noder[j].n + ' publ.', klikk: () => nett.velg(j, true) }))));
      panel.appendChild(el('p', { class: 'nett-merknad' },
        'Nettverket viser ' + noder.length + ' forskere med minst to publikasjoner i biblioteket. Navn er slått sammen på etternavn og første fornavnsbokstav.'));
    }
    function visForsker(j) {
      if (j < 0) { standardPanel(); return; }
      const n = noder[j];
      panel.replaceChildren();
      const tilbake = el('button', { type: 'button', class: 'nett-knapp nett-tilbake' }, '← Oversikt');
      tilbake.addEventListener('click', () => nett.nullstill());
      panel.appendChild(tilbake);
      panel.appendChild(el('h3', null, n.navn));
      panel.appendChild(el('p', { class: 'nett-meta' }, n.n + ' publikasjoner i biblioteket' + (n.miljo ? ' · oftest registrert hos ' + n.miljo : '')));
      const medf = Array.from(nett.nabo[j].keys()).map((m) => [m, D.fe.find((e) => (e[0] === j && e[1] === m) || (e[1] === j && e[0] === m))[2]])
        .sort((a, b) => b[1] - a[1] || noder[b[0]].n - noder[a[0]].n);
      if (medf.length) {
        panel.appendChild(el('h4', null, 'Har skrevet sammen med (' + medf.length + ')'));
        panel.appendChild(liste(medf.slice(0, 12).map(([m, w]) => ({ tekst: noder[m].navn, tall: w + ' felles', klikk: () => nett.velg(m, true) }))));
      }
      panel.appendChild(el('h4', null, 'Publikasjoner i biblioteket'));
      panel.appendChild(pubListe(n.pubs.slice().sort((a, b) => D.p[b].aar - D.p[a].aar)));
    }
    nett = Nettverk(rot, {
      noder,
      kanter: [{ type: 'v', klasse: 'e-v', liste: D.fe, bredde: (w) => 0.7 + 0.55 * Math.min(w, 8) }],
      tips: (n) => [n.navn, n.n + ' publikasjoner i biblioteket', n.miljo ? 'Oftest registrert hos ' + n.miljo : ''].filter(Boolean),
      vis: visForsker,
      sokeTekst: (n) => n.navn,
      sokeTittel: (n) => n.navn,
      sokeMeta: (n) => n.n + ' publikasjoner',
    });
    rot.querySelector('.nett-nullstill').addEventListener('click', () => { nett.nullstill(); nett.zoomUt(); });
    standardPanel();
  }

  // ---------- miljønettverket ----------
  function tegnMiljoer() {
    const rot = document.getElementById('side-miljoer');
    const M = D.mi;
    const noder = M.map((m) => ({ ...m, cls: m.ut ? 'g-ut' : 'g-no', r: 4 + 2.4 * Math.sqrt(m.n), lbl: m.kort }));
    const panel = rot.querySelector('.nett-panel');
    let nett = null;
    const vekt = new Map(D.me.map((e) => [e[0] + '-' + e[1], e[2]]));
    const w = (a, b) => vekt.get(a + '-' + b) || vekt.get(b + '-' + a) || 0;
    function standardPanel() {
      panel.replaceChildren();
      panel.appendChild(el('h3', null, 'Sterkeste samarbeid'));
      panel.appendChild(el('p', { class: 'nett-meta' }, 'Antall publikasjoner i biblioteket der begge miljøene er registrert.'));
      const par = D.me.slice().sort((a, b) => b[2] - a[2]).slice(0, 10);
      panel.appendChild(liste(par.map(([a, b, v]) => ({ tekst: noder[a].navn + ' og ' + noder[b].navn, tall: v, klikk: () => nett.velg(a, false) }))));
      panel.appendChild(el('p', { class: 'nett-merknad' },
        'Miljø er hentet fra registreringen i Organic Eprints for hver publikasjon, ikke fra den enkelte forfatter. Utenlandske miljøer er slått sammen per land.'));
    }
    function visMiljo(j) {
      if (j < 0) { standardPanel(); return; }
      const n = noder[j];
      panel.replaceChildren();
      const tilbake = el('button', { type: 'button', class: 'nett-knapp nett-tilbake' }, '← Oversikt');
      tilbake.addEventListener('click', () => nett.nullstill());
      panel.appendChild(tilbake);
      panel.appendChild(el('h3', null, n.navn));
      panel.appendChild(el('p', { class: 'nett-meta' }, n.n + ' publikasjoner i biblioteket'));
      const part = Array.from(nett.nabo[j].keys()).map((m) => [m, w(j, m)]).sort((a, b) => b[1] - a[1]);
      if (part.length) {
        panel.appendChild(el('h4', null, 'Samarbeider med (' + part.length + ')'));
        panel.appendChild(liste(part.map(([m, v]) => ({ tekst: noder[m].navn, tall: v + ' felles', prikk: noder[m].ut ? 'g-ut' : 'g-no', klikk: () => nett.velg(m, false) }))));
      }
    }
    nett = Nettverk(rot, {
      noder,
      kanter: [{ type: 'v', klasse: 'e-v', liste: D.me, bredde: (v) => 0.8 + 0.7 * Math.sqrt(v) }],
      tips: (n) => [n.navn, n.n + ' publikasjoner i biblioteket', (n.ut ? 'Utenlandske miljøer' : 'Norsk miljø')],
      vis: visMiljo,
      sokeTekst: (n) => n.navn, sokeTittel: (n) => n.navn, sokeMeta: (n) => n.n + ' publikasjoner',
    });
    rot.querySelector('.nett-nullstill').addEventListener('click', () => { nett.nullstill(); nett.zoomUt(); });
    standardPanel();
  }

  // ---------- tabell ----------
  function tegnTabell() {
    const rot = document.getElementById('side-tabell');
    const tbody = rot.querySelector('tbody');
    const kl = new Map(D.kl.map((k) => [k.nr, k.kort]));
    const rader = D.p.map((p) => {
      const tr = el('tr');
      const td = el('td');
      td.appendChild(el('a', { href: p.url, target: '_blank', rel: 'noopener' }, p.t));
      tr.append(td, el('td', null, p.type), el('td', { class: 'tall' }, String(p.aar)), el('td', null, kl.get(p.kl) || '–'),
        el('td', { class: 'tall' }, String(p.inn)), el('td', { class: 'tall' }, String(p.ut)), el('td', { class: 'tall' }, String(p.nk)),
        el('td', { class: 'tall' }, String(p.nf)));
      return { tr, p, tekst: norm(p.t + ' ' + (p.forf || '') + ' ' + p.type) };
    });
    let nokkel = 'inn', retning = -1;
    const verdi = { t: (p) => norm(p.t), type: (p) => p.type, aar: (p) => p.aar, kl: (p) => kl.get(p.kl) || '~', inn: (p) => p.inn, ut: (p) => p.ut, nk: (p) => p.nk, nf: (p) => p.nf };
    function sorter() {
      const f = verdi[nokkel];
      rader.sort((a, b) => {
        const x = f(a.p), y = f(b.p);
        return (x < y ? -1 : x > y ? 1 : 0) * retning || norm(a.p.t).localeCompare(norm(b.p.t));
      });
      tbody.replaceChildren(...rader.map((r) => r.tr));
      rot.querySelectorAll('th[data-n]').forEach((th) => th.setAttribute('aria-sort', th.dataset.n === nokkel ? (retning < 0 ? 'descending' : 'ascending') : 'none'));
    }
    rot.querySelectorAll('th[data-n] button').forEach((b) => b.addEventListener('click', () => {
      const n = b.parentElement.dataset.n;
      if (n === nokkel) retning = -retning; else { nokkel = n; retning = (n === 't' || n === 'type' || n === 'kl') ? 1 : -1; }
      sorter();
    }));
    const filter = rot.querySelector('.nett-tabellfilter input');
    const antall = rot.querySelector('.nett-tabellfilter .nett-meta');
    filter.addEventListener('input', () => {
      const q = norm(filter.value.trim()).split(/\s+/).filter(Boolean);
      let n = 0;
      rader.forEach((r) => { const vis = q.every((o) => r.tekst.includes(o)); r.tr.hidden = !vis; if (vis) n++; });
      antall.textContent = n + ' av ' + rader.length + ' publikasjoner';
    });
    antall.textContent = rader.length + ' publikasjoner';
    sorter();
  }

  const TEGN = { publikasjoner: tegnPublikasjoner, forskere: tegnForskere, miljoer: tegnMiljoer, tabell: tegnTabell };
  const start = (location.hash || '').slice(1);
  visFane(sider[start] ? start : 'publikasjoner', false, true);   // adressen får ikke #… før en fane velges
  // adressen kan endres uten at siden lastes på nytt, for eksempel av en lenke til #forskere
  window.addEventListener('hashchange', () => { const h = (location.hash || '').slice(1); if (sider[h]) visFane(h); });
  // lenker i teksten som åpner en fane («Om analysen»)
  document.querySelectorAll('[data-fane]').forEach((a) => a.addEventListener('click', (ev) => {
    ev.preventDefault();
    const t = document.querySelector('#nett-faner [data-side="' + a.dataset.fane + '"]');
    if (t) { t.click(); t.scrollIntoView({ block: 'start' }); }
  }));
})();

/* Kontaktadressen settes sammen i nettleseren, så den ikke står i klartekst i HTML-koden. */
(function () {
  'use strict';
  function snu(s) { return s.split('').reverse().join(''); }
  Array.prototype.forEach.call(document.querySelectorAll('.oko-epost[data-a][data-b]'), function (el) {
    var adresse = snu(el.getAttribute('data-a')) + String.fromCharCode(64) + snu(el.getAttribute('data-b'));
    var emne = el.getAttribute('data-emne');
    var lenke = document.createElement('a');
    lenke.className = 'oko-lenke';
    lenke.href = 'mai' + 'lto:' + adresse + (emne ? '?subject=' + encodeURIComponent(emne) : '');
    lenke.textContent = adresse;
    el.textContent = '';
    el.appendChild(lenke);
  });
})();
