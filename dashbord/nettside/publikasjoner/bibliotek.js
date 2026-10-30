/* Publikasjonsbiblioteket på okologiskitall.no/publikasjoner/.
   Alle publikasjonene står i HTML-en (laget av dashbord/skript/lag_bibliotek.py). Dette skriptet
   filtrerer listen etter type (fanene), underkategori, tema, år, språk og tilgang, søker i teksten,
   sorterer og skriver valgene inn i adressen, så et utvalg kan deles som lenke,
   for eksempel ?type=forskning&tema=husdyr. */
(function () {
  'use strict';

  var rot = document.getElementById('bibliotek');
  if (!rot) return;

  var $ = function (id) { return document.getElementById(id); };
  var alle = function (sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); };

  var liste = $('bib-liste');
  var poster = alle('.bib-post', liste);
  var faner = alle('#bib-faner a[data-type]');
  var underrader = alle('.bib-underrad');
  var underLenker = alle('.bib-underrad a[data-type]');
  var temaKnapper = alle('#bib-temaer button[data-tema]');
  var sokefelt = $('bib-sok');
  var aarValg = $('bib-aar');
  var spraakValg = $('bib-spraak');
  var gratisValg = $('bib-gratis');
  var sortValg = $('bib-sort');
  var status = $('bib-status');
  var tom = $('bib-tom');
  var nytt = $('bib-nytt');
  var nullstillKnapper = alle('[data-nullstill]');
  var flere = $('bib-flere');

  var STANDARD = { type: '', under: '', tema: '', q: '', aar: '', spraak: '', gratis: false, sort: 'nyest' };
  var tilstand = Object.assign({}, STANDARD);

  // Lovlige verdier, slik at en gammel eller feilskrevet lenke ikke gir en tom side.
  var typer = {}, undertyper = {}, temaer = {};
  faner.forEach(function (a) { typer[a.dataset.type] = true; });
  underLenker.forEach(function (a) { if (a.dataset.under) undertyper[a.dataset.type + '/' + a.dataset.under] = true; });
  temaKnapper.forEach(function (b) { temaer[b.dataset.tema] = true; });

  function norm(s) {
    return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  poster.forEach(function (p) {
    p._sok = norm(['.bib-tittel', '.bib-beskr', '.bib-meta', '.bib-type'].map(function (s) {
      var el = p.querySelector(s);
      return el ? el.textContent : '';
    }).join(' '));
    p._tema = (p.dataset.tema || '').split(' ').filter(Boolean);
    p._aar = Number(p.dataset.aar);
    p._tittel = p.querySelector('.bib-tittel').textContent.trim();
  });
  var standardRekkefolge = poster.slice();

  // ---------- filtrering ----------
  function passerFiltre(p, utenTema) {
    if (tilstand.q) {
      var ord = norm(tilstand.q).split(/\s+/).filter(Boolean);
      for (var i = 0; i < ord.length; i++) if (p._sok.indexOf(ord[i]) < 0) return false;
    }
    if (!utenTema && tilstand.tema && p._tema.indexOf(tilstand.tema) < 0) return false;
    if (tilstand.aar) {
      if (tilstand.aar === 'eldre' ? p._aar >= 2010 : p._aar < Number(tilstand.aar)) return false;
    }
    if (tilstand.spraak && p.dataset.spraak !== tilstand.spraak) return false;
    if (tilstand.gratis && p.dataset.tilgang !== 'gratis') return false;
    return true;
  }
  function passerType(p) {
    if (tilstand.type && p.dataset.type !== tilstand.type) return false;
    if (tilstand.under && p.dataset.under !== tilstand.under) return false;
    return true;
  }
  function harValg() {
    return Boolean(tilstand.type || tilstand.tema || tilstand.q || tilstand.aar || tilstand.spraak || tilstand.gratis);
  }

  var sammenlign = new Intl.Collator('nb', { numeric: true }).compare;
  function sorter() {
    var rekke = standardRekkefolge.slice();
    if (tilstand.sort === 'eldst') rekke.sort(function (a, b) { return a._aar - b._aar || sammenlign(a._tittel, b._tittel); });
    else if (tilstand.sort === 'tittel') rekke.sort(function (a, b) { return sammenlign(a._tittel, b._tittel); });
    // Flytt bare det som står feil, så fokus og rulleposisjon ikke forstyrres unødig.
    var forrige = null;
    rekke.forEach(function (p) {
      var riktig = forrige ? forrige.nextElementSibling === p : liste.firstElementChild === p;
      if (!riktig) liste.insertBefore(p, forrige ? forrige.nextElementSibling : liste.firstElementChild);
      forrige = p;
    });
  }

  function settAntall(el, n) {
    var a = el.querySelector('.bib-antall');
    if (a) a.textContent = n;
  }

  // Lange lister vises litt etter litt: de første STEG treffene, og «Vis flere» for resten.
  var STEG = 30;
  var grense = STEG;

  function oppdater(beholdGrense) {
    if (!beholdGrense) grense = STEG;
    var antall = {};
    poster.forEach(function (p) {
      var ok = passerFiltre(p, false);
      if (ok) {
        antall[''] = (antall[''] || 0) + 1;
        antall[p.dataset.type] = (antall[p.dataset.type] || 0) + 1;
        var k = p.dataset.type + '/' + p.dataset.under;
        antall[k] = (antall[k] || 0) + 1;
      }
      p._treff = ok && passerType(p);
    });

    faner.forEach(function (a) {
      if (a.dataset.type === tilstand.type) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
    underrader.forEach(function (rad) { rad.hidden = !tilstand.type || rad.dataset.type !== tilstand.type; });
    underLenker.forEach(function (a) {
      var n = a.dataset.under ? antall[a.dataset.type + '/' + a.dataset.under] || 0 : antall[a.dataset.type] || 0;
      settAntall(a, n);
      a.classList.toggle('bib-null', n === 0);
      if (a.dataset.type === tilstand.type && a.dataset.under === tilstand.under) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });

    var temaAntall = {};
    poster.forEach(function (p) {
      if (!passerFiltre(p, true) || !passerType(p)) return;
      temaAntall[''] = (temaAntall[''] || 0) + 1;
      p._tema.forEach(function (t) { temaAntall[t] = (temaAntall[t] || 0) + 1; });
    });
    temaKnapper.forEach(function (b) {
      var n = temaAntall[b.dataset.tema] || 0;
      settAntall(b, n);
      b.setAttribute('aria-pressed', String(b.dataset.tema === tilstand.tema));
      b.disabled = n === 0 && b.dataset.tema !== tilstand.tema;
    });

    sorter();

    var treff = 0;
    Array.prototype.forEach.call(liste.children, function (p) {
      if (p._treff) treff++;
      p.hidden = !p._treff || treff > grense;
    });
    var totalt = poster.length;
    status.textContent = harValg()
      ? treff + ' av ' + totalt + ' publikasjoner'
      : totalt + ' publikasjoner';
    tom.hidden = treff > 0;
    if (flere) {
      var igjen = treff - grense;
      flere.hidden = igjen <= 0;
      flere.textContent = igjen <= STEG ? 'Vis de siste ' + igjen : 'Vis ' + STEG + ' til (' + igjen + ' igjen)';
    }
    if (nytt) nytt.hidden = harValg();
    nullstillKnapper.forEach(function (b) { if (!tom.contains(b)) b.hidden = !harValg(); });

    if (sokefelt.value.trim() !== tilstand.q) sokefelt.value = tilstand.q;
    aarValg.value = tilstand.aar;
    spraakValg.value = tilstand.spraak;
    gratisValg.checked = tilstand.gratis;
    sortValg.value = tilstand.sort;
    skrivAdresse();
  }

  // ---------- adressen ----------
  function lesAdresse() {
    var p = new URLSearchParams(location.search);
    var t = p.get('type') || '';
    var u = p.get('under') || '';
    tilstand.type = typer[t] ? t : '';
    tilstand.under = tilstand.type && undertyper[tilstand.type + '/' + u] ? u : '';
    var tema = p.get('tema') || '';
    tilstand.tema = tema && temaer[tema] ? tema : '';
    tilstand.q = (p.get('q') || '').slice(0, 100);
    var aar = p.get('aar') || '';
    tilstand.aar = ['2020', '2015', '2010', 'eldre'].indexOf(aar) >= 0 ? aar : '';
    var sp = p.get('spraak') || '';
    tilstand.spraak = sp === 'no' || sp === 'en' ? sp : '';
    tilstand.gratis = p.get('gratis') === '1';
    var s = p.get('sort') || '';
    tilstand.sort = s === 'eldst' || s === 'tittel' ? s : 'nyest';
  }
  function skrivAdresse() {
    var p = new URLSearchParams();
    if (tilstand.type) p.set('type', tilstand.type);
    if (tilstand.under) p.set('under', tilstand.under);
    if (tilstand.tema) p.set('tema', tilstand.tema);
    if (tilstand.q) p.set('q', tilstand.q);
    if (tilstand.aar) p.set('aar', tilstand.aar);
    if (tilstand.spraak) p.set('spraak', tilstand.spraak);
    if (tilstand.gratis) p.set('gratis', '1');
    if (tilstand.sort !== 'nyest') p.set('sort', tilstand.sort);
    var s = p.toString();
    try { history.replaceState(null, '', location.pathname + (s ? '?' + s : '') + location.hash); } catch (e) { /* ingen historikk */ }
  }

  // ---------- besøkstelling (GoatCounter, bare på nettsiden) ----------
  function tell(sti, tittel) {
    try {
      var gc = window.goatcounter;
      if (gc && typeof gc.count === 'function') gc.count({ path: sti, title: tittel, event: true });
    } catch (e) { /* telleren er ikke lastet */ }
  }

  function rolig() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  // Har man rullet forbi starten av listen, rulles den fram igjen etter et nytt valg.
  function tilListen() {
    if (status.getBoundingClientRect().top < 0) status.scrollIntoView({ block: 'start', behavior: rolig() ? 'auto' : 'smooth' });
  }

  // ---------- hendelser ----------
  function velgType(a) {
    tilstand.type = a.dataset.type;
    tilstand.under = a.dataset.under || '';
    oppdater();
    tilListen();
    if (tilstand.type) tell('bib-type-' + tilstand.type + (tilstand.under ? '-' + tilstand.under : ''),
                            'Bibliotek: ' + a.querySelector('.bib-navn').textContent);
  }
  faner.concat(underLenker).forEach(function (a) {
    a.addEventListener('click', function (ev) {
      ev.preventDefault();
      velgType(a);
    });
  });

  function velgTema(tema) {
    tilstand.tema = tilstand.tema === tema ? '' : tema;
    oppdater();
    tilListen();
    if (tilstand.tema) tell('bib-tema-' + tilstand.tema, 'Bibliotek, tema: ' + tilstand.tema);
  }
  temaKnapper.forEach(function (b) {
    b.addEventListener('click', function () { velgTema(b.dataset.tema); });
  });
  liste.addEventListener('click', function (ev) {
    var tag = ev.target.closest('.bib-tag[data-tema]');
    if (tag) {
      tilstand.tema = '';
      velgTema(tag.dataset.tema);
      return;
    }
    var lenke = ev.target.closest('.bib-tittel a');
    if (lenke) {
      var post = lenke.closest('.bib-post');
      tell('bib-apnet-' + post.id, 'Åpnet: ' + post._tittel);
    }
  });

  var venter = null;
  sokefelt.addEventListener('input', function () {
    clearTimeout(venter);
    venter = setTimeout(function () { tilstand.q = sokefelt.value.trim().slice(0, 100); oppdater(); }, 150);
  });
  sokefelt.form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    tilstand.q = sokefelt.value.trim().slice(0, 100);
    oppdater();
    sokefelt.blur();
  });
  aarValg.addEventListener('change', function () { tilstand.aar = aarValg.value; oppdater(); });
  spraakValg.addEventListener('change', function () { tilstand.spraak = spraakValg.value; oppdater(); });
  gratisValg.addEventListener('change', function () { tilstand.gratis = gratisValg.checked; oppdater(); });
  sortValg.addEventListener('change', function () { tilstand.sort = sortValg.value; oppdater(); });
  nullstillKnapper.forEach(function (b) {
    b.addEventListener('click', function () {
      tilstand = Object.assign({}, STANDARD, { sort: tilstand.sort });
      sokefelt.value = '';
      oppdater();
    });
  });

  if (flere) {
    flere.addEventListener('click', function () {
      // flytt fokus til første nye publikasjon, så tastaturbrukere fortsetter der listen ble utvidet
      var forrige = grense;
      grense += STEG;
      oppdater(true);
      var nye = Array.prototype.filter.call(liste.children, function (p) { return p._treff; });
      var forste = nye[forrige] && nye[forrige].querySelector('.bib-tittel a');
      if (forste) forste.focus({ preventScroll: true });
    });
  }

  // En lenke til én publikasjon (#id, for eksempel fra «Nytt i biblioteket») viser den, også om den
  // ligger langt ned i listen eller utenfor valgene som gjelder.
  function visPost(id) {
    var p = id && document.getElementById(id);
    if (!p || !p.classList.contains('bib-post')) return false;
    if (!p._treff) {
      tilstand = Object.assign({}, STANDARD, { sort: tilstand.sort });
      sokefelt.value = '';
      oppdater();
    }
    var nr = Array.prototype.filter.call(liste.children, function (x) { return x._treff; }).indexOf(p);
    if (nr >= grense) {
      grense = Math.ceil((nr + 1) / STEG) * STEG;
      oppdater(true);
    }
    return true;
  }
  document.addEventListener('click', function (ev) {
    var a = ev.target.closest('a[href^="#"]');
    if (!a) return;
    var id = decodeURIComponent(a.getAttribute('href').slice(1));
    if (visPost(id)) {
      ev.preventDefault();
      location.hash = id;
    }
  });

  lesAdresse();
  oppdater();
  if (location.hash) {
    var id = decodeURIComponent(location.hash.slice(1));
    if (visPost(id)) document.getElementById(id).scrollIntoView({ block: 'start' });
  }
})();

/* Kontaktadressen settes sammen i nettleseren, så den ikke står i klartekst i HTML-koden
   der programmer som samler inn e-postadresser leter. data-emne gir e-posten et emne. */
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
