"""Lager publikasjonsbiblioteket på okologiskitall.no/publikasjoner/.

Publikasjonene står i data/publikasjoner.csv, én rad per publikasjon. Skriptet sjekker radene og lager
dashbord/nettside/publikasjoner/index.html fra malen dashbord/side/publikasjoner.html. Alle publikasjonene
står i selve HTML-en, så siden kan leses uten JavaScript og av søkemotorer; bibliotek.js filtrerer og søker.
Skriptet kopierer også bibliotek.css og bibliotek.js, og legger listen ut som publikasjoner.csv.

Kjør:  python3 dashbord/skript/lag_bibliotek.py      (lag_nettside.py kjører det også)
Test med en annen liste:  python3 dashbord/skript/lag_bibliotek.py --data liste.csv --ut mappe

Kolonnene i data/publikasjoner.csv (UTF-8, komma eller semikolon mellom feltene):
  tittel         tittelen slik den står hos utgiveren
  beskrivelse    én setning på norsk, med egne ord, om hva leseren får ut av publikasjonen
  forfattere     kort form: «Etternavn», «Etternavn og Etternavn» eller «Etternavn m.fl.»; tom for dokumenter
                 fra myndigheter og organisasjoner
  utgiver        departement, etat, institutt, tidsskrift eller organisasjon
  aar            utgivelsesår
  kategori       se KATEGORIER under (for eksempel forskning)
  underkategori  se KATEGORIER under (for eksempel rapporter)
  tema           null til tre temakoder fra TEMAER under, skilt med semikolon (for eksempel husdyr;okonomi)
  spraak         no eller en
  tilgang        gratis eller abonnement
  url            lenken til publikasjonen hos utgiveren (https://)
  lagt_til       datoen publikasjonen ble lagt inn (ÅÅÅÅ-MM-DD) – de nyeste vises under «Nytt i biblioteket»
  kontrollert    datoen lenken sist ble kontrollert (ÅÅÅÅ-MM-DD)

Publikasjonene sorteres etter hva slags dokument de er, ikke etter hvem som har gitt dem ut: en
forskningsrapport som et direktorat har bestilt, er forskning/rapporter.
Rader med feil hoppes over med en advarsel, så resten av siden blir laget.
"""
import argparse, csv, datetime, html, os, re, shutil, sys, urllib.parse

HER = os.path.dirname(os.path.abspath(__file__))
DASH = os.path.abspath(os.path.join(HER, '..'))
ROT = os.path.abspath(os.path.join(DASH, '..'))
SIDE = os.path.join(DASH, 'side')

KATEGORIER = [
    ('politikk', 'Politikk og styring', [
        ('strategier', 'Strategier og handlingsplaner'),
        ('meldinger', 'Stortingsmeldinger og proposisjoner'),
        ('jordbruksoppgjoret', 'Jordbruksoppgjøret'),
        ('stortinget', 'Stortingets behandling'),
        ('horinger', 'Høringer'),
    ]),
    ('regelverk', 'Regelverk og tilskudd', [
        ('forskrift', 'Økologiforskriften og EU-regelverket'),
        ('veiledning', 'Veiledning om regelverket'),
        ('kontroll', 'Godkjenning og kontroll'),
        ('tilskudd', 'Tilskudd til økologisk drift'),
    ]),
    ('forvaltning', 'Rapporter fra forvaltningen', [
        ('ldir', 'Landbruksdirektoratet'),
        ('mattilsynet', 'Mattilsynet'),
        ('ssb', 'SSB'),
        ('regionalt', 'Statsforvalterne og fylkeskommunene'),
        ('andre', 'Andre etater'),
    ]),
    ('forskning', 'Forskning', [
        ('artikler', 'Vitenskapelige artikler'),
        ('rapporter', 'Forskningsrapporter'),
        ('oppgaver', 'Masteroppgaver og doktoravhandlinger'),
    ]),
    ('fagstoff', 'Praktisk fagstoff', [
        ('fagark', 'Fagark og veiledere om drift'),
        ('artikler', 'Artikler og reportasjer'),
    ]),
    ('organisasjoner', 'Organisasjoner og næring', [
        ('interesse', 'Interesseorganisasjoner'),
        ('naering', 'Næringen'),
    ]),
]
TEMAER = [
    ('omlegging', 'Omlegging'),
    ('jord', 'Jord og gjødsling'),
    ('plantevern', 'Plantevern og ugras'),
    ('planter', 'Planteproduksjon'),
    ('husdyr', 'Husdyr og dyrevelferd'),
    ('marked', 'Marked og forbruk'),
    ('okonomi', 'Økonomi og lønnsomhet'),
    ('klima', 'Klima og miljø'),
]
KOLONNER = ['tittel', 'beskrivelse', 'forfattere', 'utgiver', 'aar', 'kategori', 'underkategori', 'tema',
            'spraak', 'tilgang', 'url', 'lagt_til', 'kontrollert']
MAANEDER = ['januar', 'februar', 'mars', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober',
            'november', 'desember']
UT_IKON = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" '
           'stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M7 17 17 7"/><path d="M8 7h9v9"/></svg>')

KAT_NAVN = {k: n for k, n, _ in KATEGORIER}
UNDER_NAVN = {(k, u): un for k, _, under in KATEGORIER for u, un in under}
TEMA_NAVN = dict(TEMAER)
e = lambda s: html.escape(str(s), quote=True)


def dato_tekst(d):
    return f'{d.day}. {MAANEDER[d.month - 1]} {d.year}'


def sorteringsnokkel(tekst):
    # Norsk alfabet: æ, ø og å kommer etter z, i den rekkefølgen.
    return tekst.casefold().replace('æ', '{').replace('ø', '|').replace('å', '}')


def lag_id(tittel, brukt):
    s = tittel.lower().replace('æ', 'ae').replace('ø', 'o').replace('å', 'a')
    s = re.sub(r'[^a-z0-9]+', '-', s).strip('-')[:60].rstrip('-') or 'publikasjon'
    kandidat, n = s, 2
    while kandidat in brukt:
        kandidat, n = f'{s}-{n}', n + 1
    brukt.add(kandidat)
    return kandidat


def vert(url):
    v = urllib.parse.urlparse(url).hostname or ''
    return v[4:] if v.startswith('www.') else v


def les_liste(sti):
    advarsler, poster, urler = [], [], set()
    if not os.path.exists(sti):
        return [], [f'fant ikke {sti}']
    with open(sti, encoding='utf-8-sig', newline='') as f:
        # Norsk Excel lagrer CSV med semikolon mellom feltene; begge deler går.
        forste = f.readline()
        f.seek(0)
        leser = csv.DictReader(f, delimiter=';' if forste.count(';') > forste.count(',') else ',')
        mangler = [k for k in KOLONNER if k not in (leser.fieldnames or [])]
        if mangler:
            return [], [f'{sti} mangler kolonnene: {", ".join(mangler)}']
        aar_naa = datetime.date.today().year
        for nr, rad in enumerate(leser, start=2):
            r = {k: (rad.get(k) or '').strip() for k in KOLONNER}
            feil = []
            for k in ('tittel', 'beskrivelse', 'utgiver', 'aar', 'kategori', 'underkategori', 'url', 'lagt_til'):
                if not r[k]:
                    feil.append(f'{k} mangler')
            try:
                r['aar'] = int(r['aar'])
                if not 1900 <= r['aar'] <= aar_naa + 1:
                    feil.append(f'urimelig år {r["aar"]}')
            except ValueError:
                feil.append(f'år «{r["aar"]}» er ikke et tall')
            if r['kategori'] not in KAT_NAVN:
                feil.append(f'ukjent kategori «{r["kategori"]}»')
            elif (r['kategori'], r['underkategori']) not in UNDER_NAVN:
                feil.append(f'ukjent underkategori «{r["underkategori"]}» under {r["kategori"]}')
            r['tema'] = [t.strip() for t in r['tema'].split(';') if t.strip()]
            for t in r['tema']:
                if t not in TEMA_NAVN:
                    feil.append(f'ukjent tema «{t}»')
            rekkefolge = [t for t, _ in TEMAER]
            r['tema'] = sorted(set(r['tema']), key=lambda t: rekkefolge.index(t) if t in rekkefolge else 99)
            r['spraak'] = r['spraak'] or 'no'
            if r['spraak'] not in ('no', 'en'):
                feil.append(f'språk må være no eller en, ikke «{r["spraak"]}»')
            r['tilgang'] = r['tilgang'] or 'gratis'
            if r['tilgang'] not in ('gratis', 'abonnement'):
                feil.append(f'tilgang må være gratis eller abonnement, ikke «{r["tilgang"]}»')
            if not r['url'].startswith('https://'):
                feil.append('lenken må begynne med https://')
            elif r['url'] in urler:
                feil.append('lenken står allerede i listen')
            for k in ('lagt_til', 'kontrollert'):
                if r[k]:
                    try:
                        r[k] = datetime.date.fromisoformat(r[k])
                    except ValueError:
                        feil.append(f'{k} «{r[k]}» er ikke en dato (ÅÅÅÅ-MM-DD)')
                else:
                    r[k] = None
            if feil:
                advarsler.append(f'rad {nr} ({r["tittel"][:50] or "uten tittel"}): ' + '; '.join(feil) + ' – hoppet over')
                continue
            urler.add(r['url'])
            poster.append(r)
    return poster, advarsler


def post_html(p):
    meta = [e(x) for x in (p['forfattere'], p['utgiver'], p['aar']) if x != '']
    if p['spraak'] == 'en':
        meta.append('På engelsk')
    if p['tilgang'] == 'abonnement':
        meta.append('<span class="bib-abo">Krever abonnement</span>')
    meta.append(e(vert(p['url'])))
    tags = ''.join(f'<button type="button" class="bib-tag" data-tema="{t}">{e(TEMA_NAVN[t])}</button>' for t in p['tema'])
    return (
        f'        <li class="bib-post" id="{p["id"]}" data-type="{p["kategori"]}" data-under="{p["underkategori"]}" '
        f'data-tema="{" ".join(p["tema"])}" data-aar="{p["aar"]}" data-spraak="{p["spraak"]}" data-tilgang="{p["tilgang"]}">\n'
        f'          <p class="bib-type">{e(KAT_NAVN[p["kategori"]])} › {e(UNDER_NAVN[(p["kategori"], p["underkategori"])])}</p>\n'
        f'          <h3 class="bib-tittel"><a href="{e(p["url"])}" target="_blank" rel="noopener">{e(p["tittel"])}{UT_IKON}</a></h3>\n'
        f'          <p class="bib-beskr">{e(p["beskrivelse"])}</p>\n'
        f'          <p class="bib-meta">{" · ".join(meta)}</p>\n'
        + (f'          <div class="bib-tags" aria-label="Temaer">{tags}</div>\n' if tags else '')
        + '        </li>'
    )


def meny_html(poster):
    antall = {}
    for p in poster:
        for k in ('', p['kategori'], p['kategori'] + '/' + p['underkategori']):
            antall[k] = antall.get(k, 0) + 1
    linjer = ['        <ul>',
              f'          <li class="bib-hoved"><a href="./" data-type="" aria-current="true"><span class="bib-navn">Alle publikasjoner</span> '
              f'<span class="bib-antall">{antall.get("", 0)}</span></a></li>']
    for k, navn, under in KATEGORIER:
        linjer.append(f'          <li class="bib-hoved"><a href="?type={k}" data-type="{k}"><span class="bib-navn">{e(navn)}</span> '
                      f'<span class="bib-antall">{antall.get(k, 0)}</span></a>')
        med = [(u, un) for u, un in under if antall.get(f'{k}/{u}')]
        if med:
            linjer.append(f'            <ul class="bib-under" data-type="{k}" hidden>')
            for u, un in med:
                linjer.append(f'              <li><a href="?type={k}&amp;under={u}" data-type="{k}" data-under="{u}"><span class="bib-navn">{e(un)}</span> '
                              f'<span class="bib-antall">{antall[f"{k}/{u}"]}</span></a></li>')
            linjer.append('            </ul>')
        linjer.append('          </li>')
    linjer.append('        </ul>')
    return '\n'.join(linjer)


def temaer_html(poster):
    antall = {}
    for p in poster:
        for t in p['tema']:
            antall[t] = antall.get(t, 0) + 1
    knapper = [f'          <button type="button" data-tema="" aria-pressed="true">Alle temaer <span class="bib-antall">{len(poster)}</span></button>']
    for t, navn in TEMAER:
        knapper.append(f'          <button type="button" data-tema="{t}" aria-pressed="false">{e(navn)} <span class="bib-antall">{antall.get(t, 0)}</span></button>')
    return '\n'.join(knapper)


def nytt_html(poster, antall=5):
    if not poster:
        return ''
    # sist lagt inn først; blant dem som ble lagt inn samme dag, nyeste utgivelsesår først, så alfabetisk
    nyeste = sorted(poster, key=lambda p: sorteringsnokkel(p['tittel']))
    nyeste = sorted(nyeste, key=lambda p: (p['lagt_til'], p['aar']), reverse=True)[:antall]
    siste = max(p['lagt_til'] for p in poster)
    linjer = [
        '      <section class="bib-nytt" id="bib-nytt" aria-labelledby="bib-nytt-tittel">',
        '        <h2 id="bib-nytt-tittel">Nytt i biblioteket</h2>',
        f'        <p class="bib-nytt-note">Sist lagt inn {dato_tekst(siste)}.</p>',
        '        <ul>',
    ]
    for p in nyeste:
        linjer.append(f'          <li><a href="#{p["id"]}">{e(p["tittel"])}</a> <span class="bib-nytt-meta">{e(p["utgiver"])}, {p["aar"]}</span></li>')
    linjer += ['        </ul>', '      </section>']
    return '\n'.join(linjer)


def logo_html():
    with open(os.path.join(SIDE, 'index.html'), encoding='utf-8') as f:
        tekst = f.read()
    svg = re.search(r'<svg class="oko-logo-merke".*?</svg>', tekst, re.S)
    ord_ = re.search(r'<span class="oko-logo-ord">.*?</span></span>', tekst, re.S)
    if not svg or not ord_:
        raise SystemExit('Fant ikke logoen i dashbord/side/index.html')
    return svg.group(0) + '\n          ' + ord_.group(0)


def csv_verdi(verdi):
    if verdi is None:
        return ''
    if isinstance(verdi, list):
        return ';'.join(verdi)
    if isinstance(verdi, datetime.date):
        return verdi.isoformat()
    return verdi


def main(argv=None):
    ap = argparse.ArgumentParser(description='Lager publikasjonsbiblioteket.')
    ap.add_argument('--data', default=os.path.join(ROT, 'data', 'publikasjoner.csv'))
    ap.add_argument('--ut', default=os.path.join(DASH, 'nettside', 'publikasjoner'))
    a = ap.parse_args(argv)

    poster, advarsler = les_liste(a.data)
    for adv in advarsler:
        print('ADVARSEL publikasjoner:', adv)
    if not poster:
        print('Publikasjonsbiblioteket ble ikke laget: ingen gyldige publikasjoner.')
        return
    poster.sort(key=lambda p: (-p['aar'], sorteringsnokkel(p['tittel'])))
    brukt = set()
    for p in poster:
        p['id'] = lag_id(p['tittel'], brukt)
    kontrollert = max((p['kontrollert'] for p in poster if p['kontrollert']), default=max(p['lagt_til'] for p in poster))

    with open(os.path.join(SIDE, 'publikasjoner.html'), encoding='utf-8') as f:
        mal = f.read()
    side = (mal.replace('{{LOGO}}', logo_html())
               .replace('{{MENY}}', meny_html(poster))
               .replace('{{TEMAER}}', temaer_html(poster))
               .replace('{{NYTT}}', nytt_html(poster))
               .replace('{{POSTER}}', '\n'.join(post_html(p) for p in poster))
               .replace('{{ANTALL}}', str(len(poster)))
               .replace('{{KONTROLLERT}}', dato_tekst(kontrollert)))
    igjen = re.findall(r'\{\{[A-Z]+\}\}', side)
    if igjen:
        raise SystemExit('Malen har plassholdere uten innhold: ' + ', '.join(sorted(set(igjen))))

    os.makedirs(a.ut, exist_ok=True)
    with open(os.path.join(a.ut, 'index.html'), 'w', encoding='utf-8') as f:
        f.write(side)
    for navn in ('bibliotek.css', 'bibliotek.js'):
        shutil.copyfile(os.path.join(SIDE, navn), os.path.join(a.ut, navn))
    with open(os.path.join(a.ut, 'publikasjoner.csv'), 'w', encoding='utf-8', newline='') as f:
        w = csv.writer(f)
        w.writerow(KOLONNER)
        for p in poster:
            w.writerow([csv_verdi(p[k]) for k in KOLONNER])

    per_kat = {}
    for p in poster:
        per_kat[p['kategori']] = per_kat.get(p['kategori'], 0) + 1
    print(f'Publikasjonsbiblioteket er laget i {a.ut}: {len(poster)} publikasjoner (' +
          ', '.join(f'{KAT_NAVN[k]} {per_kat.get(k, 0)}' for k, _, _ in KATEGORIER) + ')')


if __name__ == '__main__':
    # Kjørt direkte: les valgene fra kommandolinjen. Kjørt fra lag_nettside.py: bruk standardvalgene.
    main(None if os.path.basename(sys.argv[0]) == 'lag_bibliotek.py' else [])
