/* dash-adapter.js – lar sidekoden til dashbordet (oko.js) kjøre på en vanlig nettside.
   Claude-dashbordet gir siden et objekt «dash» som henter data. Denne filen lager det samme
   objektet i nettleseren: den leser datasettene fra mappen datasett/ (oversikten står i
   datasett/datasett.json), regner ut dash.calc-beregningene og tegner siden på nytt når data
   kommer eller vindusbredden endres. Krever d3 (lastes før denne filen). */
(function () {
  'use strict';

  var skript = document.currentScript;
  var BASE = (skript && skript.getAttribute('data-datasett')) || 'datasett/';
  var oversikt = null;
  var datasett = {};
  var beregninger = {};
  var lyttere = [];
  var planlagt = false;
  var params = {};

  function varsle() {
    if (planlagt) return;
    planlagt = true;
    requestAnimationFrame(function () {
      planlagt = false;
      lyttere.slice().forEach(function (fn) {
        try { fn(); } catch (e) { console.error(e); }
      });
    });
  }

  function hentOversikt() {
    if (!oversikt) {
      oversikt = fetch(BASE + 'datasett.json', { cache: 'no-cache' })
        .then(function (r) {
          if (!r.ok) throw new Error('Fant ikke datasett.json (HTTP ' + r.status + ')');
          return r.json();
        })
        .then(function (m) { return m.datasett || {}; });
    }
    return oversikt;
  }

  function last(id) {
    datasett[id] = { status: 'loading', data: [], columns: [], message: '' };
    hentOversikt()
      .then(function (m) {
        var info = m[id];
        if (!info) {
          datasett[id] = { status: 'missing', data: [], columns: [], message: 'Ukjent datasett: ' + id };
          varsle();
          return null;
        }
        return fetch(BASE + info.fil, { cache: 'no-cache' })
          .then(function (r) {
            if (!r.ok) throw new Error(info.fil + ': HTTP ' + r.status);
            return /\.json$/i.test(info.fil) ? r.json() : r.text();
          })
          .then(function (innhold) {
            var rader;
            var kolonner;
            if (typeof innhold === 'string') {
              var p = d3.csvParse(innhold);
              kolonner = p.columns.slice();
              rader = Array.from(p);
            } else {
              rader = Array.isArray(innhold) ? innhold : (innhold.rows || innhold.data || innhold.results || []);
              kolonner = rader.length ? Object.keys(rader[0]) : [];
            }
            datasett[id] = { status: 'ok', data: rader, columns: kolonner, message: '' };
            varsle();
          });
      })
      .catch(function (e) {
        console.error('Datasettet ' + id + ' kunne ikke lastes', e);
        datasett[id] = { status: 'error', data: [], columns: [], message: String((e && e.message) || e) };
        varsle();
      });
  }

  function beregn(id) {
    var c = beregninger[id];
    var inn = c.inputs.map(data);
    if (inn.some(function (d) { return d.status !== 'ok' && d.status !== 'loading'; })) {
      return { status: 'error', data: [], columns: [], message: 'Data mangler', refreshing: false, meta: [] };
    }
    if (inn.some(function (d) { return d.status !== 'ok'; })) {
      return { status: 'loading', data: [], columns: [], message: '', refreshing: false, meta: [] };
    }
    var samme = c.svar && c.forrige && c.forrige.every(function (d, i) { return d === inn[i].data; });
    if (!samme) {
      try {
        var ut = c.fn.apply(null, inn.map(function (d) { return d.data; }));
        var kol = Array.isArray(ut) && ut.length && typeof ut[0] === 'object' ? Object.keys(ut[0]) : [];
        c.svar = { status: 'ok', data: ut, columns: kol, message: '', refreshing: false, meta: [] };
      } catch (e) {
        console.error('Beregningen ' + id + ' feilet', e);
        c.svar = { status: 'error', data: [], columns: [], message: String((e && e.message) || e), refreshing: false, meta: [] };
      }
      c.forrige = inn.map(function (d) { return d.data; });
    }
    return c.svar;
  }

  function data(id) {
    if (beregninger[id]) return beregn(id);
    if (!datasett[id]) last(id);
    var d = datasett[id];
    return { status: d.status, data: d.data, columns: d.columns, message: d.message, refreshing: false, meta: [] };
  }

  var bredde = window.innerWidth;
  var tidsur = null;
  window.addEventListener('resize', function () {
    clearTimeout(tidsur);
    tidsur = setTimeout(function () {
      if (window.innerWidth !== bredde) {
        bredde = window.innerWidth;
        varsle();
      }
    }, 120);
  });

  window.dash = {
    data: data,
    onData: function (fn) {
      lyttere.push(fn);
      try { fn(); } catch (e) { console.error(e); }
    },
    calc: function (id, def) {
      beregninger[id] = { inputs: def.inputs || [], fn: def.fn, title: def.title, description: def.description };
    },
    loader: function () {},
    refresh: function () { varsle(); },
    colors: [1, 2, 3, 4, 5, 6, 7, 8].map(function (i) { return 'var(--oko-farge-' + i + ')'; }),
    params: function () { return Object.assign({}, params); },
    setParams: function (p) { Object.assign(params, p || {}); varsle(); },
    resetParams: function () { params = {}; varsle(); },
    setLink: function (navn) {
      try { history.replaceState(null, '', '#' + encodeURIComponent(navn)); } catch (e) { /* ingen historikk tilgjengelig */ }
    },
  };
})();
