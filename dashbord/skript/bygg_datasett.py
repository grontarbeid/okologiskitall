"""Bygger datasettene som dashbordet «Økologisk landbruk i Norge» viser.

Leser kildefilene i mappen data/ (hentet fra SSB, Debio, Landbruksdirektoratet,
Eurostat og FiBL) og skriver ferdige, små tabeller til dashbord/nettside/datasett/:

  <id>.csv          én fil per datasett (komma, punktum som desimaltegn, UTF-8)
  fylkeskart.json   fylkesgrensene som SVG-stier
  datasett.json     oversikt over alle datasettene (tittel, kilde, lenke, periode)

Kjør fra hvor som helst:  python3 dashbord/skript/bygg_datasett.py
Skriptet trenger bare Python 3 (ingen ekstra pakker). Det velger selv siste år
i dataene, så det kan kjøres på nytt hver gang kildefilene er oppdatert.
"""
import csv, glob, json, os, re, sys
from collections import defaultdict
from datetime import datetime, timezone

HER = os.path.dirname(os.path.abspath(__file__))
ROT = os.path.abspath(os.path.join(HER, '..', '..'))          # mappen «Statistikk_Økologisk landbruk»
DATA = os.path.join(ROT, 'data')
UT = os.path.join(ROT, 'dashbord', 'nettside', 'datasett')
KART = os.path.join(ROT, 'dashbord', 'kart', 'fylker_2024_utm33.geojson')
os.makedirs(UT, exist_ok=True)

NAA = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z')
manifest, advarsler = {}, []


# ---------------------------------------------------------------- hjelpere
def les(navn):
    with open(os.path.join(DATA, navn), encoding='utf-8') as f:
        return list(csv.DictReader(f))


def tall(v):
    if v is None:
        return None
    v = str(v).strip().replace(' ', '').replace(' ', '')
    if v in ('', '.', '..', ':', '-'):
        return None
    try:
        return float(v)
    except ValueError:
        return None


def fmt(v, des=None):
    """Tall til tekst for CSV: heltall uten desimaler, ellers maks 4 desimaler."""
    if v is None:
        return ''
    if des is not None:
        v = round(v, des)
    if abs(v - round(v)) < 1e-9:
        return str(int(round(v)))
    return ('%.4f' % v).rstrip('0').rstrip('.')


def skriv(id_, rader, kolonner, tittel, beskrivelse, kilde, lenke, periode, fast=False, plan=''):
    sti = os.path.join(UT, id_ + '.csv')
    with open(sti, 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=kolonner, extrasaction='ignore')
        w.writeheader()
        for r in rader:
            w.writerow({k: ('' if r.get(k) is None else r.get(k)) for k in kolonner})
    if not rader:
        advarsler.append(f'{id_}: ingen rader')
    assert len(tittel) <= 32, (id_, tittel)
    manifest[id_] = {
        'fil': id_ + '.csv', 'tittel': tittel, 'beskrivelse': beskrivelse, 'kilde': kilde,
        'lenke': lenke, 'periode': periode, 'rader': len(rader), 'fast': fast,
        'oppdateres': plan, 'bygget': NAA,
    }
    print(f'  {id_:20s} {len(rader):5d} rader  {periode}')


def periode_av(aar):
    aar = sorted({int(a) for a in aar if a not in (None, '')})
    return f'{aar[0]}–{aar[-1]}' if aar else ''


SSB = 'Statistisk sentralbyrå (SSB)'
LDIR = 'Landbruksdirektoratet'
LDIR_URL = 'https://www.landbruksdirektoratet.no/nb/nyhetsrom/rapporter/produksjon-av-okologiske-jordbruksvarer%202026'  # siden med siste rapport (PDF)
SSB_URL = 'https://www.ssb.no/statbank/list/stjord'  # Statistikkbanken: alle tabellene i «Gardsbruk, jordbruksareal og husdyr»
ARLIG_SSB = 'Årlig: SSB publiserer nye tall for økologisk jordbruk i mars.'
ARLIG_LDIR = 'Årlig: Landbruksdirektoratets rapport kommer i mars; tallene legges inn for hånd.'

# ---------------------------------------------------------------- SSB areal og gårder
hele = les('ssb_12661_hele_landet.csv')
rader = [{
    'aar': r['aar'], 'bedrifter': r['bedrifter'], 'areal_i_alt_dekar': r['areal_i_alt_dekar'],
    'godkjent_areal_dekar': r['godkjent_areal_dekar'], 'karens_areal_dekar': r['karens_areal_dekar'],
    'andel_okologisk_prosent': r['andel_okologisk_prosent'], 'merknad': r['merknad'],
} for r in hele]
SISTE_AAR = max(int(r['aar']) for r in hele)
skriv('ssb_areal', rader,
      ['aar', 'bedrifter', 'areal_i_alt_dekar', 'godkjent_areal_dekar', 'karens_areal_dekar', 'andel_okologisk_prosent', 'merknad'],
      'Økologisk areal og gårder',
      'Hele landet: antall jordbruksbedrifter med økologisk drift, økologisk areal (godkjent og under omlegging/karens) og økologisk andel av jordbruksarealet. SSB tabell 12661.',
      SSB, SSB_URL, periode_av(r['aar'] for r in hele), plan=ARLIG_SSB)

jord = les('ssb_04496_jordbruksareal.csv')
skriv('ssb_jordbruksareal', [{'aar': r['aar'], 'jordbruksareal_dekar': r['jordbruksareal_dekar']} for r in jord if int(r['aar']) >= 1990],
      ['aar', 'jordbruksareal_dekar'],
      'Jordbruksareal i drift',
      'Hele landet: alt jordbruksareal i drift (dekar). Brukes som nevner for økologisk andel og for å regne ut arealet som trengs for å nå målet. SSB tabell 04496.',
      SSB, SSB_URL, periode_av(r['aar'] for r in jord if int(r['aar']) >= 1990),
      plan='Årlig: SSB publiserer endelige tall for jordbruksarealet om høsten.')

# ---------------------------------------------------------------- SSB fylker (dagens fylker)
fy = les('ssb_12661_fylker.csv')
gjeldende_fra = max(int(r['gjelder_fra']) for r in fy if int(r['gjelder_til']) == SISTE_AAR and r['inndeling'].startswith('Dagens'))
piv = defaultdict(dict)
for r in fy:
    if int(r['gjelder_til']) != SISTE_AAR or int(r['aar']) < gjeldende_fra:
        continue
    if not (int(r['gjelder_fra']) <= int(r['aar']) <= int(r['gjelder_til'])):
        continue
    navn = r['fylke'].split(' - ')[0].strip()
    piv[(r['fylkesnr'], navn, r['aar'])][r['variabel']] = r['verdi']
# Jordbruksareal i drift per fylke (tabell 04496, samme regionkoder) er nevneren for andelen uten karens.
# SSBs egen andel (med karens) står i tabell 12661 og brukes som den er.
JORD_FYLKER = 'ssb_04496_jordbruksareal_fylker.csv'
jord_fy = {}
if os.path.exists(os.path.join(DATA, JORD_FYLKER)):
    jord_fy = {(r['fylkesnr'], r['aar']): tall(r['jordbruksareal_dekar']) for r in les(JORD_FYLKER)}
else:
    advarsler.append(f'ssb_fylker: fant ikke data/{JORD_FYLKER} – kjør oppdater_kilder.py')
rader = []
for (nr, navn, aar), v in sorted(piv.items(), key=lambda kv: (kv[0][2], kv[0][1])):
    jord_ = jord_fy.get((nr, aar))
    godkjent, i_alt, ssb_andel = tall(v.get('godkjent_areal_dekar')), tall(v.get('areal_i_alt_dekar')), tall(v.get('andel_okologisk_prosent'))
    rad = {'fylkesnr': nr, 'fylke': navn, 'aar': aar, **v}
    if jord_:
        rad['jordbruksareal_dekar'] = fmt(jord_)
        if godkjent is not None:
            rad['andel_godkjent_prosent'] = fmt(100 * godkjent / jord_)
        # kontroll: SSBs andel stemmer med jordbruksarealet i 04496. SSB regner andelen med jordbruksarealet
        # slik det var da tallene ble publisert (foreløpige tall), så 0,1 prosentpoeng avvik er vanlig.
        if i_alt is not None and ssb_andel is not None and abs(round(100 * i_alt / jord_, 1) - ssb_andel) > 0.15:
            advarsler.append(f'ssb_fylker {aar} {navn}: SSBs andel {ssb_andel} %, regnet med 04496 {100 * i_alt / jord_:.2f} %')
    elif jord_fy:
        advarsler.append(f'ssb_fylker {aar} {navn}: mangler jordbruksareal i {JORD_FYLKER}')
    rader.append(rad)
# kontroll: fylkene summerer til landstallet
for aar in sorted({r['aar'] for r in rader}):
    s = sum(int(r['areal_i_alt_dekar']) for r in rader if r['aar'] == aar)
    land = next(int(r['areal_i_alt_dekar']) for r in hele if r['aar'] == aar)
    if abs(s - land) > 20:
        advarsler.append(f'ssb_fylker {aar}: fylkene summerer til {s}, hele landet {land}')
    if jord_fy:
        sj = sum(tall(r.get('jordbruksareal_dekar')) or 0 for r in rader if r['aar'] == aar)
        lj = next((tall(r['jordbruksareal_dekar']) for r in jord if r['aar'] == aar), None)
        if lj and abs(sj - lj) > 20:
            advarsler.append(f'ssb_fylker {aar}: jordbruksarealet i fylkene summerer til {sj:.0f}, hele landet {lj:.0f}')
skriv('ssb_fylker', rader,
      ['fylkesnr', 'fylke', 'aar', 'bedrifter', 'areal_i_alt_dekar', 'godkjent_areal_dekar', 'karens_areal_dekar', 'andel_okologisk_prosent',
       'jordbruksareal_dekar', 'andel_godkjent_prosent'],
      'Økologisk drift per fylke',
      f'Dagens fylker (inndelingen fra {gjeldende_fra}): økologiske gårder, økologisk areal (godkjent og under omlegging/karens), jordbruksareal i drift og økologisk andel av jordbruksarealet – med karens (SSBs andel) og uten karens (godkjent økologisk areal delt på jordbruksarealet, regnet ut her). Oslo og Akershus publiseres samlet. SSB tabell 12661 og 04496.',
      SSB, SSB_URL, periode_av(r['aar'] for r in rader), plan=ARLIG_SSB)

# ---------------------------------------------------------------- SSB areal etter bruk
GRUPPE_BRUK = {
    '15': 'Eng og beite', '17': 'Eng og beite', '18': 'Eng og beite',
    '04': 'Korn', '11a': 'Grønnfôr og silo',
    '10': 'Grønnsaker, potet, frukt og bær', '21a': 'Grønnsaker, potet, frukt og bær',
    '19a': 'Grønnsaker, potet, frukt og bær', '19b': 'Grønnsaker, potet, frukt og bær',
    '23': 'Grønngjødsling og andre vekster', '13d': 'Grønngjødsling og andre vekster',
}
NAVN_BRUK = {
    '00a': 'Godkjent økologisk areal i alt', '04': 'Korn', '10': 'Potet', '11a': 'Grønnfôr og silovekster',
    '13d': 'Andre vekster', '15': 'Fulldyrka eng', '17': 'Overflatedyrka eng', '18': 'Innmarksbeite',
    '19a': 'Frukt', '19b': 'Bær', '21a': 'Grønnsaker og urter', '23': 'Grønngjødsling',
}
bruk = les('ssb_12662_areal_etter_bruk.csv')
rader = [{'aar': r['aar'], 'kode': r['kode'], 'bruk': NAVN_BRUK.get(r['kode'], r['bruk']),
          'gruppe': GRUPPE_BRUK.get(r['kode'], ''), 'dekar': r['verdi']}
         for r in bruk if tall(r['verdi']) is not None]
for aar in sorted({r['aar'] for r in rader}):
    deler = sum(float(r['dekar']) for r in rader if r['aar'] == aar and r['gruppe'])
    tot = [float(r['dekar']) for r in rader if r['aar'] == aar and r['kode'] == '00a']
    if tot and abs(deler - tot[0]) > max(50, tot[0] * 0.002):
        advarsler.append(f'ssb_bruk {aar}: delene summerer til {deler:.0f}, i alt {tot[0]:.0f}')
skriv('ssb_bruk', rader, ['aar', 'kode', 'bruk', 'gruppe', 'dekar'],
      'Økologisk areal etter bruk',
      'Hele landet: godkjent økologisk areal (uten karens) fordelt på eng, beite, korn, grønnsaker, frukt, bær og andre vekster. SSB tabell 12662.',
      SSB, SSB_URL, periode_av(r['aar'] for r in rader), plan=ARLIG_SSB)

# ---------------------------------------------------------------- SSB husdyr
NAVN_DYR = {'01a': 'Storfe i alt', '02': 'Melkekyr', '03': 'Ammekyr', '07a': 'Andre storfe',
            '04e': 'Sau og lam', '15a': 'Geiter i alt', '15': 'Melkegeiter', '05a': 'Svin i alt',
            '09': 'Slaktegris', '10': 'Verpehøner'}
dyr = les('ssb_12663_okologiske_husdyr.csv')
rader = [{'aar': r['aar'], 'kode': r['kode'], 'husdyrslag': NAVN_DYR.get(r['kode'], r['husdyrslag']), 'antall': r['antall']}
         for r in dyr if tall(r['antall']) is not None]
skriv('ssb_husdyr', rader, ['aar', 'kode', 'husdyrslag', 'antall'],
      'Økologiske husdyr',
      'Hele landet: antall økologiske husdyr etter dyreslag (storfe, sau, geit, svin, verpehøner). SSB tabell 12663.',
      SSB, SSB_URL, periode_av(r['aar'] for r in rader), plan=ARLIG_SSB)

# ---------------------------------------------------------------- Debio
deb = les('debio_landbruk_virksomheter_hele_landet.csv')
skriv('debio_innut', deb, ['aar', 'landbruksvirksomheter', 'nye_innmeldt', 'utmeldt'],
      'Gårder inn og ut (Debio)',
      'Hele landet: landbruksvirksomheter godkjent av Debio, og hvor mange som meldte seg inn i og ut av økologisk drift hvert år. Debios årsstatistikk.',
      'Debio', 'https://debio.no/statistikk/', periode_av(r['aar'] for r in deb), plan='Årlig: Debio legger ut ny statistikk i mars; filene gjøres om for hånd.')

GRUPPE_VEKST = [
    ('Grovfôr og beite', ['Eng', 'Innmarksbeite', 'grønnfôr', 'silo']),
    ('Korn og belgvekster', ['Hvete', 'Rug', 'Bygg', 'Havre', 'Korn', 'Erter', 'bønner', 'Oljevekster', 'Rughvete', 'Spelt']),
    ('Grønnsaker og potet', ['Potet', 'Løk', 'Purre', 'Rødbete', 'kålrot', 'kålslag', 'Gulrot', 'grønnsaker', 'Urter', 'Veksthus', 'Salat', 'Kepaløk']),
    ('Frukt og bær', ['Epler', 'frukt', 'Jordbær', 'bær', 'Plommer', 'Pærer', 'Kirsebær', 'Moreller']),
]
def vekstgruppe(navn):
    if navn.startswith('Engfrø'):
        return 'Annet'
    for g, ord_ in GRUPPE_VEKST:
        if any(o.lower() in navn.lower() for o in ord_):
            return g
    return 'Annet'
filer = sorted(glob.glob(os.path.join(DATA, 'debio_planteproduksjon_*_hele_landet.csv')))
vek = les(os.path.basename(filer[-1]))
rader = [{'aar': r['aar'], 'kultur': r['kultur'], 'gruppe': vekstgruppe(r['kultur']),
          'okologisk_dekar': fmt(tall(r['okologisk_dekar']), 0), 'karens_dekar': fmt(tall(r['karens_dekar']), 0),
          'totalt_dekar': fmt(tall(r['totalt_dekar']) if tall(r['totalt_dekar']) is not None else (tall(r['okologisk_dekar']) or 0) + (tall(r['karens_dekar']) or 0), 0)}
         for r in vek]
skriv('debio_vekster', rader, ['aar', 'kultur', 'gruppe', 'okologisk_dekar', 'karens_dekar', 'totalt_dekar'],
      'Vekster hos Debio, siste år',
      'Hele landet: areal per vekst hos virksomheter godkjent av Debio, økologisk og under omlegging (karens), avrundet til hele dekar. Debios årsstatistikk.',
      'Debio', 'https://debio.no/statistikk/', periode_av(r['aar'] for r in rader), plan='Årlig: Debio legger ut ny statistikk i mars; filene gjøres om for hånd.')

# ---------------------------------------------------------------- Landbruksdirektoratet
ld = les('ldir_okologi_tidsserier.csv')
def serie(ind, kat='Totalt', gruppe='', enhet=None):
    ut = {}
    for r in ld:
        if r['indikator'] == ind and r['kategori'] == kat and r['gruppe'] == gruppe and (enhet is None or r['enhet'] == enhet):
            ut[r['periode']] = r
    return ut

def aarstall(p):
    return int(p[:4])


# Rettelser etter kontroll mot rapportene (se dashbord/README.md, «Rettelser»).
# (indikator, kategori, periode) -> (verdi eller None for «ingen verdi», rapport, kilde)
RETTELSER = {
    # 2025-rapportens tabell 20 gjentar 2024-rapportens Vinmonopol-tall forskjøvet ett år; bruk 2024-rapporten.
    ('kanal_omsetning', 'Vinmonopolet', '2023'): ('1291.9', '2024', 'Tabell 19', '58'),
    ('kanal_omsetning', 'Vinmonopolet', '2024'): ('1387.7', '2024', 'Tabell 19', '58'),
    ('kanal_omsetning', 'Vinmonopolet', '2025'): (None, '2025', 'Tabell 20', '61'),
    # 2019 på samme klassifisering som 2020–2021 (anslag i 2022-rapporten, s. 47).
    ('dagligvare_omsetning', 'Totalt', '2019'): ('2250', '2022', 'Tekst', '47'),
    # 2024 revidert til samme grunnlag som 2025 (2025-rapporten, s. 48).
    ('dagligvare_andel', 'Totalt', '2024'): ('2.1', '2025', 'Tekst', '48'),
    # Andel av all innveid kumelk (2020-rapporten, s. 18); tabell 1 gjelder bare Tine.
    ('melk_andel', 'Totalt', '2020'): ('3.3', '2020', 'Tekst', '18'),
}


def rettet(ind, kat, ut):
    """Bruker RETTELSER på en serie {periode: rad}."""
    ut = dict(ut)
    for (i, k, p), (v, rapport, kilde, side) in RETTELSER.items():
        if i == ind and k == kat:
            if v is None:
                ut.pop(p, None)
            else:
                ut[p] = {'verdi': v, 'kilde_rapport': rapport, 'kilde_tabell': kilde, 'side': side, 'merknad': 'rettet etter kontroll'}
    return ut


def henvis(*kilderader):
    """Hvor i rapportene tallene står, f.eks. «Rapport for 2025: tabell 5 s. 17, tekst s. 18»."""
    per = {}
    for r in kilderader:
        if not r or not str(r.get('kilde_rapport', '')).strip():
            continue
        rap = str(r['kilde_rapport']).strip()
        tab = (r.get('kilde_tabell') or '').strip().lower() or 'tekst'
        side = str(r.get('side') or '').strip()
        del_ = f'{tab} s. {side}' if side else tab
        per.setdefault(rap, [])
        if del_ not in per[rap]:
            per[rap].append(del_)
    ut = []
    for rap in sorted(per, key=int, reverse=True):
        navn = 'SLF-rapport for 2012' if rap == '2012' else f'Rapport for {rap}'
        ut.append(f"{navn}: {', '.join(per[rap])}")
    return '; '.join(ut)

# melk
lev, anv, andel = serie('melk_levert', enhet='mill. liter'), serie('melk_anvendt', enhet='mill. liter'), rettet('melk_andel', 'Totalt', serie('melk_andel', enhet='prosent'))
def melk_grunnlag(a):
    # Økologisk melk er melk levert til Tine Råvare, som fra 2023 heter Norsk Melkeråvare.
    # Q-meieriene tar bare imot konvensjonell melk og inngår bare i nevneren for andelen.
    return 'Tine Råvare' if a <= 2022 else 'Norsk Melkeråvare (tidligere Tine Råvare)'
rader = []
for p in sorted(set(lev) | set(anv), key=aarstall):
    if not re.fullmatch(r'\d{4}', p):
        continue
    rader.append({'aar': p, 'levert_mill_liter': lev.get(p, {}).get('verdi'),
                  'solgt_som_okologisk_mill_liter': anv.get(p, {}).get('verdi'),
                  'okologisk_andel_av_all_melk_prosent': andel.get(p, {}).get('verdi'),
                  'datagrunnlag': melk_grunnlag(int(p)), 'kilde': henvis(lev.get(p), anv.get(p), andel.get(p))})
skriv('ldir_melk', rader, ['aar', 'levert_mill_liter', 'solgt_som_okologisk_mill_liter', 'okologisk_andel_av_all_melk_prosent', 'datagrunnlag', 'kilde'],
      'Økologisk melk',
      'Økologisk kumelk levert til Tine Råvare (fra 2023 Norsk Melkeråvare), hvor mye av den som ble solgt videre som økologisk, og økologisk andel av all levert kumelk. Landbruksdirektoratets årlige rapporter (2012–2025).',
      LDIR, LDIR_URL, periode_av(r['aar'] for r in rader), plan=ARLIG_LDIR)

# andel solgt som økologisk (anvendelsesgrad)
rader = []
for vare, ind in [('Melk', 'melk_anvendelsesgrad'), ('Egg', 'egg_anvendelsesgrad'), ('Kjøtt', 'kjott_anvendelsesgrad')]:
    for p, r in serie(ind, enhet='prosent').items():
        if re.fullmatch(r'\d{4}', p):
            rader.append({'aar': p, 'vare': vare, 'prosent': r['verdi'], 'kilde': henvis(r)})
rader.sort(key=lambda r: (r['vare'] != 'Melk', r['vare'], int(r['aar'])))
skriv('ldir_anvendelse', rader, ['aar', 'vare', 'prosent', 'kilde'],
      'Andel solgt som økologisk',
      'Hvor stor del av den økologiske produksjonen av melk, egg og kjøtt som ble solgt som økologisk (resten selges som konvensjonell vare). Landbruksdirektoratets årlige rapporter.',
      LDIR, LDIR_URL, periode_av(r['aar'] for r in rader), plan=ARLIG_LDIR)

# egg
eo, ea = serie('egg_okologisk', enhet='tonn'), serie('egg_andel', enhet='prosent')
rader = [{'aar': p, 'okologiske_egg_tonn': eo[p]['verdi'], 'andel_av_alle_egg_prosent': ea.get(p, {}).get('verdi'),
          'kilde': henvis(eo[p], ea.get(p))}
         for p in sorted(eo, key=aarstall) if re.fullmatch(r'\d{4}', p)]
skriv('ldir_egg', rader, ['aar', 'okologiske_egg_tonn', 'andel_av_alle_egg_prosent', 'kilde'],
      'Økologiske egg',
      'Økologiske egg levert til eggpakkeri (tonn) og økologisk andel av alle egg. Landbruksdirektoratets årlige rapporter.',
      LDIR, LDIR_URL, periode_av(r['aar'] for r in rader), plan=ARLIG_LDIR)

# kjøtt
rader = []
for dyr_ in ['Storfe', 'Sau og lam', 'Svin', 'Fjørfe']:
    sl, an = serie('kjott_slakt', dyr_, enhet='tonn'), serie('kjott_andel', dyr_, enhet='prosent')
    for p in sorted(set(sl) | set(an), key=aarstall):
        if re.fullmatch(r'\d{4}', p):
            rader.append({'aar': p, 'dyreslag': dyr_, 'slakt_tonn': fmt(tall(sl[p]['verdi']), 0) if p in sl else None,
                          'andel_prosent': an.get(p, {}).get('verdi'), 'kilde': henvis(sl.get(p), an.get(p))})
skriv('ldir_kjott', rader, ['aar', 'dyreslag', 'slakt_tonn', 'andel_prosent', 'kilde'],
      'Økologisk kjøtt (slakt)',
      'Innveid økologisk slakt per dyreslag (tonn, avrundet) og økologisk andel av all slakt. Fjørfe er kylling og kalkun. Landbruksdirektoratets årlige rapporter.',
      LDIR, LDIR_URL, periode_av(r['aar'] for r in rader), plan=ARLIG_LDIR)

# korn
ko = serie('korn_produksjon', enhet='tonn')
rader = []
for p, r in sorted(ko.items(), key=lambda kv: aarstall(kv[0])):
    if not re.fullmatch(r'\d{4}–\d{4}', p):
        continue
    m = r['merknad'].lower()
    if 'anslag' in m or 'foreløpig' in m or 'prognose' in m:
        status = 'anslag'
    elif re.search(r'per \d+\. ?\w+', m):
        status = 'levert hittil'
    else:
        status = 'levert'
    rader.append({'sesong': p, 'tonn': fmt(tall(r['verdi']), 0), 'status': status, 'rapport': r['kilde_rapport'], 'kilde': henvis(r)})
skriv('ldir_korn', rader, ['sesong', 'tonn', 'status', 'rapport', 'kilde'],
      'Økologisk korn levert',
      'Økologisk korn, erter, oljefrø og åkerbønner levert til kornkjøpere per sesong (juli–juni). De fleste tallene er anslag gjort i februar, før sesongen var over. Landbruksdirektoratets årlige rapporter.',
      LDIR, LDIR_URL, f"{rader[0]['sesong']} til {rader[-1]['sesong']}" if rader else '', plan=ARLIG_LDIR)

# dagligvare
do = rettet('dagligvare_omsetning', 'Totalt', serie('dagligvare_omsetning', enhet='mill. kr'))
da = rettet('dagligvare_andel', 'Totalt', serie('dagligvare_andel', enhet='prosent'))
def andel_grunnlag(a):
    if a <= 2018: return 'Andel av all mat'
    return 'Andel i varegrupper der det finnes økologiske varer'
def dv_grunnlag(a):
    if a <= 2018: return 'Nielsen'
    if a <= 2021: return 'Dagligvarekjedene'
    return 'NielsenIQ'
rader = [{'aar': p, 'omsetning_mill_kr': fmt(tall(do[p]['verdi']), 1), 'andel_prosent': da.get(p, {}).get('verdi'),
          'andel_grunnlag': andel_grunnlag(int(p)) if da.get(p) else None,
          'datagrunnlag': dv_grunnlag(int(p)), 'kilde': henvis(do[p], da.get(p))} for p in sorted(do, key=aarstall) if re.fullmatch(r'\d{4}', p)]
skriv('ldir_dagligvare', rader, ['aar', 'omsetning_mill_kr', 'andel_prosent', 'andel_grunnlag', 'datagrunnlag', 'kilde'],
      'Økologisk i dagligvare',
      'Omsetning av økologiske matvarer i dagligvarehandelen (mill. kr, løpende priser) og økologisk andel. Datagrunnlaget er byttet to ganger (2019 og 2022), så nivåene er ikke direkte sammenlignbare over hele perioden. Fra 2024 regnes andelen bare av varegrupper der det finnes økologiske varer; før 2019 av all mat. Landbruksdirektoratets årlige rapporter.',
      LDIR, LDIR_URL, periode_av(r['aar'] for r in rader), plan=ARLIG_LDIR)

# varegrupper (de to siste årene i siste rapport)
vg = [r for r in ld if r['indikator'] in ('dagligvare_andel', 'dagligvare_omsetning') and r['gruppe'] == ''
      and r['kategori'] not in ('Totalt', 'Landsgjennomsnitt', 'Sum alle økologiske varer', 'Totalt økologiske varer')
      and re.fullmatch(r'\d{4}', r['periode'])]
siste_rapport = max(int(r['kilde_rapport']) for r in vg)
# Bare tall fra siste rapport, så andeler og omsetning står på samme grunnlag (tidligere rapporter er beregnet annerledes).
piv, kildene = defaultdict(dict), defaultdict(list)
for r in vg:
    if int(r['kilde_rapport']) == siste_rapport and int(r['periode']) >= siste_rapport - 1:
        piv[(r['periode'], r['kategori'])]['andel_prosent' if r['indikator'] == 'dagligvare_andel' else 'omsetning_mill_kr'] = r['verdi']
        kildene[(r['periode'], r['kategori'])].append(r)
grupper_siste = {k for (a, k), v in piv.items() if int(a) == siste_rapport and 'andel_prosent' in v}
rader = [{'aar': a, 'varegruppe': k, **v, 'kilde': henvis(*kildene[(a, k)])} for (a, k), v in sorted(piv.items()) if k in grupper_siste]
skriv('ldir_varegrupper', rader, ['aar', 'varegruppe', 'omsetning_mill_kr', 'andel_prosent', 'kilde'],
      'Dagligvare per varegruppe',
      'Økologisk andel per varegruppe i dagligvarehandelen siste år, og omsetning av økologiske varer de to siste årene, fra siste rapport. Landbruksdirektoratets årlige rapport.',
      LDIR, LDIR_URL, periode_av(r['aar'] for r in rader), plan=ARLIG_LDIR)

# andre salgskanaler
rader = []
for kanal in ['Vinmonopolet', 'Bakerier inkl. kaféutsalg', 'Storhusholdning (grossistledd)', 'Spesialbutikker', 'Bondens marked']:
    for p, r in sorted(rettet('kanal_omsetning', kanal, serie('kanal_omsetning', kanal, enhet='mill. kr')).items(), key=lambda kv: aarstall(kv[0])):
        if re.fullmatch(r'\d{4}', p):
            rader.append({'aar': p, 'kanal': kanal, 'omsetning_mill_kr': r['verdi'], 'kilde': henvis(r)})
skriv('ldir_kanaler', rader, ['aar', 'kanal', 'omsetning_mill_kr', 'kilde'],
      'Andre salgskanaler',
      'Omsetning av økologiske varer utenom dagligvarehandelen: Vinmonopolet, bakerier, storhusholdning (grossistledd), spesialbutikker og Bondens marked (mill. kr). Vinmonopolet-tallene i 2025-rapporten er 2024-rapportens tall forskjøvet ett år, så her brukes 2024-rapporten og det finnes ikke noe 2025-tall for Vinmonopolet. Landbruksdirektoratets årlige rapporter.',
      LDIR, LDIR_URL, periode_av(r['aar'] for r in rader), plan=ARLIG_LDIR)

# tilskudd
tot, sumd = serie('tilskudd', 'Totalt', enhet='mill. kr'), serie('tilskudd', 'Sum direkte tilskudd', enhet='mill. kr')
ar_, hu_, om_ = serie('tilskudd', 'Arealtilskudd', enhet='mill. kr'), serie('tilskudd', 'Husdyrtilskudd', enhet='mill. kr'), serie('tilskudd', 'Omleggingstilskudd', enhet='mill. kr')
rader = []
for p in sorted(set(sumd) | set(tot), key=aarstall):
    if not re.fullmatch(r'\d{4}', p):
        continue
    a = int(p)
    if p in sumd:
        verdi, defin = sumd[p]['verdi'], 'Areal-, husdyr- og omleggingstilskudd'
    elif a >= 2013:
        verdi, defin = tot[p]['verdi'], 'Areal- og husdyrtilskudd'
    else:
        continue
    rader.append({'aar': p, 'direkte_tilskudd_mill_kr': verdi, 'arealtilskudd_mill_kr': ar_.get(p, {}).get('verdi'),
                  'husdyrtilskudd_mill_kr': hu_.get(p, {}).get('verdi'), 'omleggingstilskudd_mill_kr': om_.get(p, {}).get('verdi'),
                  'definisjon': defin, 'kilde': henvis(sumd.get(p) or tot.get(p), ar_.get(p), hu_.get(p), om_.get(p))})
skriv('ldir_tilskudd', rader, ['aar', 'direkte_tilskudd_mill_kr', 'arealtilskudd_mill_kr', 'husdyrtilskudd_mill_kr', 'omleggingstilskudd_mill_kr', 'definisjon', 'kilde'],
      'Tilskudd til økologisk drift',
      'Utbetalte direkte tilskudd til økologisk jordbruk (mill. kr, løpende priser). Til og med 2012 inkludert omleggingstilskudd; fra 2017 areal- og husdyrtilskudd utbetalt i året (gjelder søknadsåret før). Landbruksdirektoratets årlige rapporter.',
      LDIR, LDIR_URL, periode_av(r['aar'] for r in rader), plan=ARLIG_LDIR)

# ---------------------------------------------------------------- Internasjonalt
eu = les('eurostat_areal_land.csv')
AGGR = {'EU', 'EU27_2020', 'EU28'}
andel_tot = [r for r in eu if r['variabel'] == 'andel_areal' and r['kategori'] == 'Totalt']
per_aar = defaultdict(list)
for r in andel_tot:
    if r['landkode'] not in AGGR:
        per_aar[int(r['aar'])].append(r)
siste_eu = max(a for a, v in per_aar.items() if len(v) >= 25)
rader = [{'landkode': r['landkode'], 'land': r['land'], 'aar': r['aar'], 'andel_prosent': r['verdi'], 'merknad': r['merknad']}
         for r in sorted(per_aar[siste_eu], key=lambda r: -float(r['verdi']))]
skriv('eurostat_europa', rader, ['landkode', 'land', 'aar', 'andel_prosent', 'merknad'],
      'Andel økologisk i Europa',
      f'Økologisk areal (ferdig omlagt og under omlegging) i prosent av jordbruksarealet, alle land Eurostat har tall for i {siste_eu}. Eurostat-tabell org_cropar.',
      'Eurostat', 'https://ec.europa.eu/eurostat/databrowser/view/org_cropar/default/table?lang=en', str(siste_eu),
      plan='Årlig: Eurostat publiserer nye tall med 1–2 års forsinkelse.')

hist = les('eurostat_areal_historisk_norden.csv')
rader = []
NORDEN = ['NO', 'SE', 'DK', 'FI']
for r in hist:
    if r['variabel'] == 'andel_areal' and r['kategori'] == 'Totalt' and r['landkode'] in NORDEN:
        rader.append({'aar': r['aar'], 'landkode': r['landkode'], 'land': r['land'], 'andel_prosent': r['verdi'], 'tabell': 'org_cropar_h2'})
har = {(r['aar'], r['landkode']) for r in rader}
for r in andel_tot:
    if r['landkode'] in NORDEN and (r['aar'], r['landkode']) not in har:
        rader.append({'aar': r['aar'], 'landkode': r['landkode'], 'land': r['land'], 'andel_prosent': r['verdi'], 'tabell': 'org_cropar'})
rader.sort(key=lambda r: (NORDEN.index(r['landkode']), int(r['aar'])))
skriv('norden_andel', rader, ['aar', 'landkode', 'land', 'andel_prosent', 'tabell'],
      'Andel økologisk i Norden',
      'Økologisk andel av jordbruksarealet i Norge, Sverige, Danmark og Finland. Eurostat: org_cropar_h2 til og med 2011, org_cropar fra 2012 (brudd i serien mellom 2011 og 2012).',
      'Eurostat', 'https://ec.europa.eu/eurostat/databrowser/view/org_cropar/default/table?lang=en', periode_av(r['aar'] for r in rader),
      plan='Årlig: Eurostat publiserer nye tall med 1–2 års forsinkelse.')

# FiBL tillater enkelttall med kilde, lenke og hentedato, men ikke at større uttrekk (over 100
# dataserier) spres videre uten skriftlig tillatelse. Dashbordet viser bare forbruket per innbygger
# i siste år med tall for minst 20 land. Disse tallene skrives til et lite uttrekk,
# data/fibl_forbruk_per_innbygger.csv, og det er bare det som ligger i det offentlige repoet på
# GitHub. Det store FiBL-uttrekket finnes bare i den lokale datamappen; finnes det, lages det lille
# uttrekket på nytt fra det.
FIBL_STORT = 'fibl_statistikk_marked_europa.csv'
FIBL_UTTREKK = 'fibl_forbruk_per_innbygger.csv'
if os.path.exists(os.path.join(DATA, FIBL_STORT)):
    pc = defaultdict(list)
    for r in les(FIBL_STORT):
        if r['variabel'] == 'forbruk_per_innbygger' and tall(r['verdi']) is not None:
            pc[int(r['aar'])].append(r)
    siste_f = max(a for a, v in pc.items() if len(v) >= 20)
    uttrekk = sorted(pc[siste_f], key=lambda r: -float(r['verdi']))
    with open(os.path.join(DATA, FIBL_UTTREKK), 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=list(uttrekk[0].keys()))
        w.writeheader()
        w.writerows(uttrekk)
fibl = les(FIBL_UTTREKK)
siste_f = max(int(r['aar']) for r in fibl)
rader = [{'landkode': r['landkode'], 'land': r['land'], 'aar': r['aar'], 'euro_per_innbygger': r['verdi']}
         for r in sorted(fibl, key=lambda r: -float(r['verdi'])) if int(r['aar']) == siste_f]
skriv('fibl_forbruk', rader, ['landkode', 'land', 'aar', 'euro_per_innbygger'],
      'Økologisk forbruk per person',
      f'Kjøp av økologisk mat per innbygger i {siste_f} (euro), europeiske land med tall. Land utenfor eurosonen er regnet om med årets valutakurs. FiBL-statistikk (statistics.fibl.org).',
      'FiBL', 'https://statistics.fibl.org/europe/retail-sales-europe.html', str(siste_f),
      plan='Årlig: FiBL og IFOAM gir ut årboken «The World of Organic Agriculture» i februar.')

# ---------------------------------------------------------------- Fylkeskart
with open(KART, encoding='utf-8') as f:
    geo = json.load(f)
def ringer(geom):
    if geom['type'] == 'Polygon':
        return geom['coordinates']
    return [ring for poly in geom['coordinates'] for ring in poly]
alle = [pt for ft in geo['features'] for ring in ringer(ft['geometry']) for pt in ring]
minx, maxx = min(p[0] for p in alle), max(p[0] for p in alle)
miny, maxy = min(p[1] for p in alle), max(p[1] for p in alle)
B, H = (maxx - minx) / 1000, (maxy - miny) / 1000
kart = []
for ft in sorted(geo['features'], key=lambda f: f['properties']['kode']):
    deler = []
    for ring in ringer(ft['geometry']):
        pts = [((x - minx) / 1000, (maxy - y) / 1000) for x, y in ring]
        deler.append('M' + 'L'.join(f'{x:.1f},{y:.1f}' for x, y in pts) + 'Z')
    kart.append({'fylkesnr': ft['properties']['kode'], 'fylke': ft['properties']['navn'], 'sti': ''.join(deler),
                 'bredde': round(B, 1), 'hoyde': round(H, 1)})
with open(os.path.join(UT, 'fylkeskart.json'), 'w', encoding='utf-8') as f:
    json.dump(kart, f, ensure_ascii=False, separators=(',', ':'))
fylker_i_data = {r['fylkesnr'] for r in csv.DictReader(open(os.path.join(UT, 'ssb_fylker.csv'), encoding='utf-8'))}
if fylker_i_data != {k['fylkesnr'] for k in kart}:
    advarsler.append(f'fylkeskart: kartet har {sorted(k["fylkesnr"] for k in kart)}, dataene {sorted(fylker_i_data)} – kartet må lages på nytt (se lag_fylkeskart.sh)')
manifest['fylkeskart'] = {
    'fil': 'fylkeskart.json', 'tittel': 'Fylkeskart (2024-grenser)',
    'beskrivelse': 'Fylkesgrensene fra 2024 som SVG-stier (UTM sone 33, kilometer), forenklet for skjerm. Oslo og Akershus er slått sammen slik SSB publiserer dem. Kartverket via robhop/fylker-og-kommuner, CC BY 4.0.',
    'kilde': 'Kartverket (CC BY 4.0)', 'lenke': 'https://data.norge.no/en/datasets/cffde12f-3530-4406-9aa0-d6d4519ef077/administrative-enheter-fylker', 'periode': '2024–',
    'rader': len(kart), 'fast': True, 'oppdateres': 'Ved neste fylkesreform.', 'bygget': NAA,
}
print(f'  {"fylkeskart":20s} {len(kart):5d} rader  ({os.path.getsize(os.path.join(UT, "fylkeskart.json")) // 1024} kB)')

# ---------------------------------------------------------------- Kildeoversikt
rekkefolge = ['ssb_areal', 'ssb_jordbruksareal', 'ssb_fylker', 'ssb_bruk', 'ssb_husdyr', 'debio_innut', 'debio_vekster',
              'ldir_melk', 'ldir_anvendelse', 'ldir_egg', 'ldir_kjott', 'ldir_korn', 'ldir_dagligvare', 'ldir_varegrupper',
              'ldir_kanaler', 'ldir_tilskudd', 'eurostat_europa', 'norden_andel', 'fibl_forbruk', 'fylkeskart']
rader = [{'datasett': k, 'tittel': manifest[k]['tittel'], 'kilde': manifest[k]['kilde'], 'periode': manifest[k]['periode'],
          'oppdateres': manifest[k]['oppdateres'], 'lenke': manifest[k]['lenke']} for k in rekkefolge]
skriv('kilder', rader, ['datasett', 'tittel', 'kilde', 'periode', 'oppdateres', 'lenke'],
      'Kildeoversikt',
      'Liste over datasettene i dashbordet: hva de inneholder, hvilken periode de dekker, hvor de kommer fra og når de oppdateres.',
      'Dashbordet', '', '', plan='Lages på nytt hver gang datasettene bygges.')

with open(os.path.join(UT, 'datasett.json'), 'w', encoding='utf-8') as f:
    json.dump({'bygget': NAA, 'siste_aar_ssb': SISTE_AAR, 'datasett': manifest}, f, ensure_ascii=False, indent=1)

print(f'\nFerdig: {len(manifest)} datasett i {UT}')
if advarsler:
    print('\nADVARSLER:')
    for a in advarsler:
        print(' -', a)
    sys.exit(1)
