"""Henter nye tall fra SSB og Eurostat og bygger dashbordet på nytt.

Bruk (fra mappen «Statistikk_Økologisk landbruk»):
    python3 dashbord/skript/oppdater_kilder.py            hent, bygg datasett og nettside
    python3 dashbord/skript/oppdater_kilder.py --bare-hent bare hent kildefilene

Skriptet bruker bare Python 3 (ingen ekstra pakker) og trenger internett. SSB-tallene hentes fra
SSBs API for Statistikkbanken, versjon 2 (PxWebApi v2, lansert høsten 2025). Det henter:
  SSB 12661  økologisk areal og gårder, hele landet og fylker   → data/ssb_12661_hele_landet.csv, data/ssb_12661_fylker.csv
  SSB 12662  økologisk areal etter bruk                          → data/ssb_12662_areal_etter_bruk.csv
  SSB 12663  økologiske husdyr                                   → data/ssb_12663_okologiske_husdyr.csv
  SSB 04496  jordbruksareal i drift, hele landet og fylker       → data/ssb_04496_jordbruksareal.csv, data/ssb_04496_jordbruksareal_fylker.csv
  Eurostat org_cropar  økologisk areal i europeiske land         → data/eurostat_areal_land.csv
Rådataene lagres i kilder/ssb/ og kilder/internasjonal/eurostat/.

Tall som ikke kan hentes automatisk (Landbruksdirektoratets årsrapport, Debio, FiBL) står
i dashbord/README.md under «Årlig oppdatering».
"""
import csv, itertools, json, os, re, subprocess, sys, urllib.parse, urllib.request

HER = os.path.dirname(os.path.abspath(__file__))
ROT = os.path.abspath(os.path.join(HER, '..', '..'))
DATA = os.path.join(ROT, 'data')
KILDER_SSB = os.path.join(ROT, 'kilder', 'ssb')
KILDER_EU = os.path.join(ROT, 'kilder', 'internasjonal', 'eurostat')
SSB = 'https://data.ssb.no/api/pxwebapi/v2/tables/'
EUROSTAT = 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/'
feil = []


def hent(url, sporring=None):
    data = json.dumps(sporring).encode('utf-8') if sporring else None
    req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json', 'User-Agent': 'okologisk-dashbord/1.0'})
    with urllib.request.urlopen(req, timeout=120) as svar:
        return json.load(svar)


def ssb_tabell(tabell, utvalg=None):
    """Henter hele SSB-tabellen (eller utvalgte koder per variabel) som JSON-stat2 og lagrer rådataene.

    Alle variabler får en verdiliste (* = alle koder), ellers gir API-et bare standardutvalget."""
    meta = hent(f'{SSB}{tabell}/metadata?lang=no')
    parametre = [('lang', 'no'), ('outputFormat', 'json-stat2')]
    for dim in meta['id']:
        koder = (utvalg or {}).get(dim)
        parametre.append((f'valueCodes[{dim}]', ','.join(koder) if koder else '*'))
    d = hent(f'{SSB}{tabell}/data?' + urllib.parse.urlencode(parametre))
    os.makedirs(KILDER_SSB, exist_ok=True)
    with open(os.path.join(KILDER_SSB, f'{tabell}.json'), 'w', encoding='utf-8') as f:
        json.dump(d, f, ensure_ascii=False)
    return d


def koder_i(dim):
    idx = dim['category']['index']
    return list(idx) if isinstance(idx, list) else sorted(idx, key=lambda k: idx[k])


def pakk_ut(d):
    ids = d['id']
    dims = d['dimension']
    kat = {i: koder_i(dims[i]) for i in ids}
    navn = {i: dims[i]['category'].get('label', {}) for i in ids}
    verdier, status = d['value'], d.get('status') or {}
    V, ST = {}, {}
    for n, kombo in enumerate(itertools.product(*[kat[i] for i in ids])):
        V[kombo] = verdier[n] if isinstance(verdier, list) else verdier.get(str(n))
        s = status[n] if isinstance(status, list) else status.get(str(n))
        if s:
            ST[kombo] = s
    return ids, kat, navn, V, ST


def tall(v):
    if v is None:
        return ''
    return str(int(v)) if float(v).is_integer() else repr(float(v))


def skriv(navn, kolonner, rader, linjeskift='\r\n'):
    sti = os.path.join(DATA, navn)
    with open(sti, 'w', newline='', encoding='utf-8') as f:
        w = csv.writer(f, lineterminator=linjeskift)
        w.writerow(kolonner)
        w.writerows(rader)
    print(f'  {navn}: {len(rader)} rader')


def siste_aar(navn, kol='aar'):
    try:
        with open(os.path.join(DATA, navn), encoding='utf-8') as f:
            return max(int(r[kol]) for r in csv.DictReader(f) if r[kol][:4].isdigit())
    except (OSError, ValueError):
        return None


# ------------------------------------------------------------------ SSB 12661
KORT = {'JordbbOkoOml': 'bedrifter', 'GodkjOkoJordArealOml': 'areal_i_alt_dekar', 'GodkjOkoJordAreal': 'godkjent_areal_dekar',
        'JordArealOmlOko': 'karens_areal_dekar', 'ProsentOkoJordAreal': 'andel_okologisk_prosent'}
ENHET = {'JordbbOkoOml': 'antall', 'ProsentOkoJordAreal': 'prosent'}


def gyldighet(kode, etikett, aarene, har_tall, har_verdi):
    """Hvilke år en regionkode gjelder for. SSB viser 0 for år før et nytt fylke fantes, så
    startåret for dagens fylker settes til første år med tall; nedlagte fylker har årstall i navnet."""
    m = re.search(r'\((\d{4})?\s*-\s*(\d{4})\)', etikett)
    if m:
        a = int(m.group(1)) if m.group(1) else min([int(y) for y in aarene if har_verdi(y)] or [int(aarene[0])])
        b = int(m.group(2))
        if b == 2017:
            return a, b, 'Fylke før 2018'
        if b == 2019:
            return a, b, 'Fylke før 2020'
        return a, b, f'Fylke {a}–{b}'
    med_tall = [int(y) for y in aarene if har_tall(y)]
    a = min(med_tall) if med_tall else int(aarene[0])
    b = int(aarene[-1])
    tidligste_fylkesaar = 1997  # regionale tall finnes fra 1997
    return a, b, 'Dagens fylke (uendret)' if a <= tidligste_fylkesaar else f'Dagens fylke (fra {a})'


def ssb_12661():
    ids, kat, navn, V, ST = pakk_ut(ssb_tabell('12661'))
    aarene = kat['Tid']
    land = next(k for k in kat['Region'] if k == '0N' or 'landet' in navn['Region'][k].lower())
    rader = []
    for y in aarene:
        rader.append([y] + [tall(V[(land, c, y)]) for c in KORT] + ['inkl. areal ute av drift' if int(y) <= 2011 else ''])
    skriv('ssb_12661_hele_landet.csv', ['aar'] + list(KORT.values()) + ['merknad'], rader)
    rader = []
    for reg in kat['Region']:
        if reg == land:
            continue
        et = navn['Region'][reg]
        a, b, inndeling = gyldighet(reg, et, aarene, lambda y: any((V[(reg, c, y)] or 0) > 0 for c in KORT),
                                    lambda y: any(V[(reg, c, y)] is not None for c in KORT))
        rent = re.sub(r'\s*\((\d{4})?\s*-\s*(\d{4})\)', '', et)
        for c in KORT:
            for y in aarene:
                if a <= int(y) <= b:
                    v = V[(reg, c, y)]
                    rader.append([reg, rent, inndeling, a, b, y, KORT[c], tall(v), ENHET.get(c, 'dekar'), '..' if v is None else ''])
    skriv('ssb_12661_fylker.csv', ['fylkesnr', 'fylke', 'inndeling', 'gjelder_fra', 'gjelder_til', 'aar', 'variabel', 'verdi', 'enhet', 'status'], rader)


def ssb_12662():
    ids, kat, navn, V, ST = pakk_ut(ssb_tabell('12662'))
    rader = []
    for y in kat['Tid']:
        for k in kat['VekstarDekar']:
            nokkel = tuple({'VekstarDekar': k, 'ContentsCode': kat['ContentsCode'][0], 'Tid': y}[i] for i in ids)
            v = V[nokkel]
            rader.append([y, k, navn['VekstarDekar'][k], tall(v), 'dekar', ST.get(nokkel, '') or ('..' if v is None else '')])
    skriv('ssb_12662_areal_etter_bruk.csv', ['aar', 'kode', 'bruk', 'verdi', 'enhet', 'status'], rader)


def ssb_12663():
    ids, kat, navn, V, ST = pakk_ut(ssb_tabell('12663'))
    rader = []
    for y in kat['Tid']:
        for h in kat['Husdyr']:
            nokkel = tuple({'Region': kat['Region'][0], 'Husdyr': h, 'ContentsCode': kat['ContentsCode'][0], 'Tid': y}[i] for i in ids)
            v = V[nokkel]
            rader.append([y, h, navn['Husdyr'][h], tall(v), 'antall dyr', ST.get(nokkel, '') or ('..' if v is None else '')])
    skriv('ssb_12663_okologiske_husdyr.csv', ['aar', 'kode', 'husdyrslag', 'antall', 'enhet', 'status'], rader)


def ssb_04496():
    """Jordbruksareal i drift for hele landet og per fylke (samme regionkoder som i tabell 12661).
    Fylkestallene er nevneren for økologisk andel uten karens per fylke."""
    ids, kat, navn, V, ST = pakk_ut(ssb_tabell('04496', {'DyrkJordAreal': ['99']}))

    def nokkel(reg, y):
        return tuple({'Region': reg, 'DyrkJordAreal': '99', 'ContentsCode': kat['ContentsCode'][0], 'Tid': y}[i] for i in ids)

    rader = []
    for y in kat['Tid']:
        v = V[nokkel('0', y)]
        rader.append([y, tall(v), ST.get(nokkel('0', y), '')])
    skriv('ssb_04496_jordbruksareal.csv', ['aar', 'jordbruksareal_dekar', 'status'], rader)
    rader = []
    for reg in kat['Region']:
        if reg == '0':
            continue
        rent = re.sub(r'\s*\((\d{4})?\s*-\s*(\d{4})\)', '', navn['Region'][reg])
        for y in kat['Tid']:
            v = V[nokkel(reg, y)]
            rader.append([reg, rent, y, tall(v), ST.get(nokkel(reg, y), '') or ('..' if v is None else '')])
    skriv('ssb_04496_jordbruksareal_fylker.csv', ['fylkesnr', 'fylke', 'aar', 'jordbruksareal_dekar', 'status'], rader)


# ------------------------------------------------------------------ Eurostat org_cropar
LAND = {
    'EU': 'EU (skiftende sammensetning)', 'EU27_2020': 'EU-27', 'EU28': 'EU-28', 'BE': 'Belgia', 'BG': 'Bulgaria',
    'CZ': 'Tsjekkia', 'DK': 'Danmark', 'DE': 'Tyskland', 'EE': 'Estland', 'IE': 'Irland', 'EL': 'Hellas',
    'ES': 'Spania', 'FR': 'Frankrike', 'HR': 'Kroatia', 'IT': 'Italia', 'CY': 'Kypros', 'LV': 'Latvia',
    'LT': 'Litauen', 'LU': 'Luxembourg', 'HU': 'Ungarn', 'MT': 'Malta', 'NL': 'Nederland', 'AT': 'Østerrike',
    'PL': 'Polen', 'PT': 'Portugal', 'RO': 'Romania', 'SI': 'Slovenia', 'SK': 'Slovakia', 'FI': 'Finland',
    'SE': 'Sverige', 'IS': 'Island', 'NO': 'Norge', 'CH': 'Sveits', 'UK': 'Storbritannia', 'ME': 'Montenegro',
    'MK': 'Nord-Makedonia', 'AL': 'Albania', 'RS': 'Serbia', 'TR': 'Tyrkia', 'BA': 'Bosnia-Hercegovina',
    'XK': 'Kosovo', 'LI': 'Liechtenstein', 'MD': 'Moldova', 'UA': 'Ukraina', 'GE': 'Georgia',
}
FLAGG = {'e': 'estimert', 'p': 'foreløpig', 'b': 'brudd i tidsserien', 'd': 'definisjon avviker (se metadata)',
         'c': 'konfidensielt', 'u': 'lav pålitelighet', 'n': 'ikke signifikant', 's': 'Eurostat-estimat',
         'f': 'prognose', 'r': 'revidert', 'z': 'ikke relevant', 'i': 'se metadata'}
DRIFT = {'TOTAL': 'Totalt', 'FCONV': 'Ferdig omlagt', 'UCONV': 'Under omlegging'}


def flagg_tekst(flagg):
    if not flagg:
        return ''
    f = flagg.replace('|', '').lower()
    return '; '.join(FLAGG.get(ch, f'flagg «{ch}»') for ch in f) + f' (Eurostat-flagg: {f})'


def eurostat_cropar():
    d = hent(EUROSTAT + 'org_cropar?format=JSON&lang=en&crops=UAAXK0000')
    os.makedirs(KILDER_EU, exist_ok=True)
    with open(os.path.join(KILDER_EU, 'org_cropar_totalt.json'), 'w', encoding='utf-8') as f:
        json.dump(d, f, ensure_ascii=False)
    ids, storrelse = d['id'], d['size']
    kat = []
    for dim in ids:
        idx = d['dimension'][dim]['category']['index']
        kat.append(idx if isinstance(idx, list) else sorted(idx, key=lambda k: idx[k]))
    verdier = d['value']
    status = d.get('status') or {}
    if isinstance(verdier, list):
        verdier = {str(i): v for i, v in enumerate(verdier) if v is not None}
    if isinstance(status, list):
        status = {str(i): s for i, s in enumerate(status) if s}
    rader = []
    for pos in sorted({int(k) for k in verdier} | {int(k) for k in status}):
        rest, k = pos, {}
        for dim, n, koder in zip(reversed(ids), reversed(storrelse), reversed(kat)):
            k[dim] = koder[rest % n]
            rest //= n
        if k.get('crops') != 'UAAXK0000' or k.get('agprdmet') not in DRIFT or k.get('unit') not in ('HA', 'PC_UAA'):
            continue
        verdi = verdier.get(str(pos))
        merknad = flagg_tekst(status.get(str(pos), ''))
        if k['geo'] == 'EU':
            merknad = '; '.join(x for x in [merknad, 'EU-aggregat med skiftende sammensetning (EU-15/25/27/28 etter år)'] if x)
        var, enh = ('areal', 'hektar') if k['unit'] == 'HA' else ('andel_areal', 'prosent av jordbruksarealet')
        rader.append(['Eurostat', 'org_cropar', k['geo'], LAND.get(k['geo'], k['geo']), k['time'], var, DRIFT[k['agprdmet']],
                      tall(verdi), enh, merknad])
    rader.sort(key=lambda r: (r[2] != 'NO', r[2], r[5], r[6], r[4]))
    skriv('eurostat_areal_land.csv', ['kilde', 'datasett', 'landkode', 'land', 'aar', 'variabel', 'kategori', 'verdi', 'enhet', 'merknad'], rader, '\n')


# ------------------------------------------------------------------ kjøring
def main():
    for_ = {n: siste_aar(n) for n in ('ssb_12661_hele_landet.csv', 'ssb_04496_jordbruksareal.csv', 'eurostat_areal_land.csv')}
    print('Henter fra SSB og Eurostat …')
    for navn, jobb in [('SSB 12661', ssb_12661), ('SSB 12662', ssb_12662), ('SSB 12663', ssb_12663),
                       ('SSB 04496', ssb_04496), ('Eurostat org_cropar', eurostat_cropar)]:
        try:
            jobb()
        except Exception as e:  # behold den gamle filen og gå videre
            feil.append(f'{navn}: {e}')
            print(f'  FEIL {navn}: {e} – den gamle filen er beholdt')
    for n, a in for_.items():
        b = siste_aar(n)
        if b and a and b > a:
            print(f'  Nytt år i {n}: {b} (var {a})')
    if '--bare-hent' not in sys.argv:
        print('\nBygger datasettene …')
        r1 = subprocess.run([sys.executable, os.path.join(HER, 'bygg_datasett.py')])
        print('\nLager nettsiden …')
        r2 = subprocess.run([sys.executable, os.path.join(HER, 'lag_nettside.py')])
        if r1.returncode or r2.returncode:
            feil.append('bygging av datasett eller nettside meldte feil (se over)')
    if feil:
        print('\nNoe gikk galt:')
        for f in feil:
            print(' -', f)
        sys.exit(1)
    print('\nFerdig. Husk de manuelle årlige stegene i dashbord/README.md.')


if __name__ == '__main__':
    main()
