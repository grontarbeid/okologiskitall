"""Lager nettsideversjonen av dashbordet i dashbord/nettside/.

Sidekoden ligger i dashbord/side/ (index.html, oko.css, oko.js) og er den samme som i
Claude-dashbordet. Dette skriptet pakker innholdet inn i et helt HTML-dokument og kopierer
filene til dashbord/nettside/, sammen med dash-adapter.js, tema.css, d3 og datasettene.

Kjør:  python3 dashbord/skript/lag_nettside.py
Se resultatet lokalt:  cd dashbord/nettside && python3 -m http.server 8000   → http://localhost:8000
(Siden må vises via en webserver – nettlesere slipper ikke til datafilene fra file://.)
"""
import os, re, shutil

HER = os.path.dirname(os.path.abspath(__file__))
DASH = os.path.abspath(os.path.join(HER, '..'))
SIDE = os.path.join(DASH, 'side')
UT = os.path.join(DASH, 'nettside')

with open(os.path.join(SIDE, 'index.html'), encoding='utf-8') as f:
    innhold = f.read()
innhold = re.sub(r'\s*<link rel="stylesheet" href="oko\.css">\s*', '\n', innhold)
innhold = re.sub(r'\s*<script src="oko\.js"></script>\s*', '\n', innhold)

DOKUMENT = """<!doctype html>
<html lang="nb">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Økologisk landbruk i Norge</title>
<meta name="description" content="Statistikk om økologisk landbruk i Norge: areal, gårder, produksjon, fylker, marked og Europa. Tall fra SSB, Debio, Landbruksdirektoratet, Eurostat og FiBL.">
<link rel="icon" href="logo.svg" type="image/svg+xml">
<link rel="stylesheet" href="tema.css">
<link rel="stylesheet" href="oko.css">
</head>
<body>
<main id="dash-root" class="oko-nettside">
{innhold}
<footer class="oko-bunn">
<p class="oko-ansvarlig">Ansvarlig: Grønt arbeid Nordvik, org.nr. <a class="oko-lenke" href="https://virksomhet.brreg.no/nb/oppslag/enheter/936885403">936&nbsp;885&nbsp;403</a> · Kontakt: <span class="oko-epost" data-a="diebratnorg" data-b="moc.liamg">e-postadressen vises når siden er lastet</span></p>
<p>Tall: Statistisk sentralbyrå, Debio, Landbruksdirektoratet, Eurostat og FiBL. Fylkeskart: Kartverket (CC BY 4.0). Laget med Claude (Anthropic). Datasett og kode: <a class="oko-lenke" href="https://github.com/grontarbeid/okologiskitall">github.com/grontarbeid/okologiskitall</a>.</p>
</footer>
</main>
<script src="d3.v7.9.0.min.js"></script>
<script src="dash-adapter.js" data-datasett="datasett/"></script>
<script src="oko.js"></script>
<script>
/* Kontaktadressen settes sammen i nettleseren, så den ikke står i klartekst i HTML-koden
   der programmer som samler inn e-postadresser leter. */
document.querySelectorAll('.oko-epost[data-a][data-b]').forEach(function (el) {
  function snu(s) { return s.split('').reverse().join(''); }
  var adresse = snu(el.getAttribute('data-a')) + String.fromCharCode(64) + snu(el.getAttribute('data-b'));
  var lenke = document.createElement('a');
  lenke.className = 'oko-lenke';
  lenke.href = 'mai' + 'lto:' + adresse;
  lenke.textContent = adresse;
  el.textContent = '';
  el.appendChild(lenke);
});
</script>
</body>
</html>
"""
os.makedirs(UT, exist_ok=True)
with open(os.path.join(UT, 'index.html'), 'w', encoding='utf-8') as f:
    f.write(DOKUMENT.replace('{innhold}', innhold.strip()))
for navn in ('oko.css', 'oko.js'):
    shutil.copyfile(os.path.join(SIDE, navn), os.path.join(UT, navn))
mangler = [n for n in ('dash-adapter.js', 'tema.css', 'd3.v7.9.0.min.js', os.path.join('datasett', 'datasett.json'))
           if not os.path.exists(os.path.join(UT, n))]
print('Nettsiden er laget i', UT)
if mangler:
    print('MANGLER:', ', '.join(mangler), '– kjør bygg_datasett.py først / legg d3 i mappen.')
