"""Lager siden «Hvordan henger publikasjonene sammen?» (okologiskitall.no/publikasjoner/nettverk/).

Nettverksanalysen er gjort én gang og lagret i data/publikasjonsnettverk.json: hvem som siterer hvem, felles kilder,
felles forfattere, gruppene, forskerne og forskningsmiljøene, med ferdig beregnet plassering av alle sirklene.
Dette skriptet fyller malen dashbord/side/nettverk.html med tallene og dataene, og kopierer nettverk.css og
nettverk.js. Det kjøres av lag_nettside.py, etter publikasjonsbiblioteket.

Kjør alene:  python3 dashbord/skript/lag_nettverk_side.py
"""
import argparse, datetime, html, json, os, re, shutil, sys

HER = os.path.dirname(os.path.abspath(__file__))
DASH = os.path.abspath(os.path.join(HER, '..'))
ROT = os.path.abspath(os.path.join(DASH, '..'))
SIDE = os.path.join(DASH, 'side')
sys.path.insert(0, HER)
import lag_bibliotek  # noqa: E402  (logoen hentes på samme måte som i biblioteket)

MAANEDER = ['januar', 'februar', 'mars', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'desember']
e = html.escape


def tall(n):
    return f'{n:,}'.replace(',', ' ')


def dato_tekst(iso):
    d = datetime.date.fromisoformat(iso)
    return f'{d.day}. {MAANEDER[d.month - 1]} {d.year}'


def kpi(etikett, verdi, under=''):
    return (f'<div class="oko-kpi"><span class="oko-kpi-label">{e(etikett)}</span><span class="oko-kpi-value">{verdi}</span>'
            + (f'<span class="oko-kpi-sub">{e(under)}</span>' if under else '') + '</div>')


def hvem_tabell(hvem):
    """Tabell over siteringer mellom typene; cellene får en blåtone etter antallet (én farge, lys til mørk)."""
    kol = hvem['kolonner']
    m = hvem['matrise']
    maks = max([v for rad in m.values() for v in rad.values()] or [1])

    def celle(n):
        andel = 0 if not n else 0.08 + 0.5 * n / maks
        return f'<td class="tall" style="background:color-mix(in srgb, var(--oko-farge-1) {round(andel * 100)}%, transparent)">{n}</td>'
    hode = ('<thead><tr><th scope="col">Publikasjoner av typen …</th>'
            + ''.join(f'<th scope="col" class="tall">… siterer {e(navn.lower())}</th>' for _, navn in kol)
            + '<th scope="col" class="tall">Sum</th></tr></thead>')
    rader = ''.join(
        f'<tr><th scope="row">{e(navn)}</th>' + ''.join(celle(m[g].get(h, 0)) for h, _ in kol)
        + f'<td class="tall"><b>{sum(m[g].get(h, 0) for h, _ in kol)}</b></td></tr>' for g, navn in kol)
    return f'<table class="nett-tabell nett-matrise">{hode}<tbody>{rader}</tbody></table>'


def main(argv=None):
    ap = argparse.ArgumentParser(description='Lager nettverkssiden.')
    ap.add_argument('--data', default=os.path.join(ROT, 'data', 'publikasjonsnettverk.json'))
    ap.add_argument('--ut', default=os.path.join(DASH, 'nettside', 'publikasjoner', 'nettverk'))
    a = ap.parse_args(argv)
    if not os.path.exists(a.data):
        print('Nettverkssiden ble ikke laget: fant ikke', a.data)
        return
    with open(a.data, encoding='utf-8') as f:
        n = json.load(f)
    k = n['kpi']
    kpis = ''.join([
        kpi('Publikasjoner i nettverket', tall(n['i_nett']), f"av {tall(n['antall'])} i biblioteket"),
        kpi('Siteringer mellom dem', tall(k['siteringer'])),
        kpi('Par med felles kilder', tall(k['kildepar']), 'minst to felles referanser'),
        kpi('Forskere', tall(k['forskere']), f"{tall(k['forskere_2pluss'])} med minst to publikasjoner"),
        kpi('Grupper', tall(k['grupper']), 'publikasjoner som henger tett sammen'),
    ])
    with open(os.path.join(SIDE, 'nettverk.html'), encoding='utf-8') as f:
        mal = f.read()
    data = json.dumps(n['data'], ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
    side = (mal.replace('{{LOGO}}', lag_bibliotek.logo_html())
               .replace('{{KPIS}}', kpis)
               .replace('{{FUNN}}', ''.join('<li>' + e(t) + '</li>' for t in n['funn']))
               .replace('{{HVEM}}', hvem_tabell(n['hvem']))
               .replace('{{ALDER}}', f"{n['hvem']['alder_median']:g}")
               .replace('{{UTEN}}', tall(n['uten']))
               .replace('{{FORSKERE_VIST}}', tall(k['forskere_vist']))
               .replace('{{KILDER_ULIKE}}', tall(n['felles_kilder']['ulike']))
               .replace('{{KILDER_UTENFOR}}', tall(n['felles_kilder']['utenfor']))
               .replace('{{DEKNING}}', tall(n['dekning']))
               .replace('{{ANTALL}}', tall(n['antall']))
               .replace('{{LAGET}}', dato_tekst(n['laget']))
               .replace('{{DATA}}', data))
    igjen = sorted(set(re.findall(r'\{\{[A-ZÆØÅ_]+\}\}', side)))
    if igjen:
        raise SystemExit('Malen har plassholdere uten innhold: ' + ', '.join(igjen))
    os.makedirs(a.ut, exist_ok=True)
    with open(os.path.join(a.ut, 'index.html'), 'w', encoding='utf-8') as f:
        f.write(side)
    for navn in ('nettverk.css', 'nettverk.js'):
        shutil.copyfile(os.path.join(SIDE, navn), os.path.join(a.ut, navn))
    print(f"Nettverkssiden er laget i {a.ut}: {n['antall']} publikasjoner, {n['i_nett']} i nettverket, analysen er fra {n['laget']}.")


if __name__ == '__main__':
    main()
