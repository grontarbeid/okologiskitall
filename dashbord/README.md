# Dashbordet «Økologisk landbruk i Norge»

Denne mappen inneholder alt dashbordet er laget av: datasettene det viser, sidekoden, skriptene som
henter og bygger tallene, og en ferdig nettsideversjon. Dashbordet finnes i to utgaver som bruker
nøyaktig samme sidekode og de samme datasettene:

- **Nettsiden okologiskitall.no** – publiseres fra GitHub-repoet
  [grontarbeid/okologiskitall](https://github.com/grontarbeid/okologiskitall). Inntil domenet er
  koblet til: https://grontarbeid.github.io/okologiskitall/
- **Claude-dashbordet** – en privat utgave i Claude (lenken står i `claude-dashbord.json` i den lokale mappen).

Dashbordet har ni faner: Oversikt, Areal og gårder, Produksjon, Fylker (med kart), Vare for vare,
Marked, Europa, Mål og tilskudd, og Om tallene. Alle tall i teksten og alle figurer hentes fra
datasettene – ingen tall er skrevet inn i sidekoden – så siden oppdaterer seg selv når datasettene byttes.
Under hver figur ligger «Vis tallene» med en tabell og «Vis kildene» med lenke til kildens egen side.

Adressen `okologiskitall.no/2032` (mappen `nettside/2032/`) åpner fanen «Mål og tilskudd» direkte.
Kampanjeadressen økologisk2032.no peker dit.

## Mappene

| Mappe / fil | Innhold |
|---|---|
| `side/` | Sidekoden: `index.html` (innhold og tekst), `oko.css` (utseende), `oko.js` (beregninger og figurer). Samme filer brukes i Claude-dashbordet. |
| `nettside/` | Ferdig nettside: sidekoden + `dash-adapter.js`, `tema.css`, d3 (med lisensen i `d3-LICENSE.txt`), `2032/` og `datasett/`. Lages av `skript/lag_nettside.py`. |
| `nettside/datasett/` | De 21 datasettene dashbordet viser (CSV + `fylkeskart.json`), og `datasett.json` med tittel, kilde og periode for hvert. |
| `skript/oppdater_kilder.py` | Henter nye tall fra SSB (API-et PxWebApi v2) og Eurostat, og bygger datasett og nettside på nytt. |
| `skript/bygg_datasett.py` | Lager datasettene i `nettside/datasett/` fra kildefilene i `../data/`. |
| `skript/lag_nettside.py` | Pakker sidekoden inn i `nettside/index.html`. |
| `skript/lag_fylkeskart.sh` | Lager fylkeskartet på nytt (bare ved ny fylkesreform). |
| `kart/` | Fylkesgrensene (2024) i UTM sone 33. Kartverket, CC BY 4.0. |
| `nettside-oppsett/` | Kopi av arbeidsflyten som oppdaterer og publiserer nettsiden (bare i den lokale mappen; i repoet ligger den i `.github/workflows/oppdater.yml`). |
| `claude-dashbord.json` | Hvilke filer Claude-dashbordet bruker nå (bare i den lokale mappen). |

## Hvor ligger hva?

- **GitHub-repoet er hovedkopien av nettsiden.** Der oppdateres SSB- og Eurostat-tallene automatisk hver uke.
- **Den lokale mappen «Statistikk_Økologisk landbruk» er arkivet.** Den har i tillegg alle
  kildefilene som ikke skal ligge i et offentlig repo: rapportene (PDF), Debios regneark, FiBL-uttrekkene
  og FiBL/IFOAM-årboken (`kilder/` og de store `data/fibl_*`-filene).

Det offentlige repoet inneholder bare det som trengs for å bygge siden: `data/` med de elleve
kildefilene skriptene leser, og `dashbord/` uten `claude-dashbord.json` og `nettside-oppsett/`.

## Årlig oppdatering

Tallene kommer én gang i året, de fleste i mars:

| Når | Kilde | Hvordan |
|---|---|---|
| Februar | FiBL/IFOAM (forbruk per innbygger) | For hånd: last ned nye tall fra statistics.fibl.org og be Claude oppdatere `data/fibl_*.csv`. Oppdater også hentedatoen i `KILDER.fibl` i `side/oko.js`. |
| Mars | SSB (areal, gårder, fylker, bruk, husdyr) | Automatisk: GitHub henter hver mandag. Lokalt: `python3 dashbord/skript/oppdater_kilder.py` |
| Mars | Landbruksdirektoratets rapport «Produksjon av økologiske jordbruksvarer» | For hånd: legg PDF-en i `kilder/landbruksdirektoratet/` og be Claude hente ut tallene etter samme mal som før og legge dem inn i `data/ldir_okologi_tidsserier.csv`. |
| Mars | Debio (gårder inn og ut, vekster) | For hånd: last ned xlsx-filene fra debio.no/statistikk til `kilder/debio/` og be Claude gjøre dem om til `data/debio_*.csv`. |
| Høst | SSB (endelig jordbruksareal) og Eurostat (Europa og Norden) | Automatisk: samme som over. |

Etter en oppdatering for hånd:

1. Kjør `python3 dashbord/skript/oppdater_kilder.py` fra mappen «Statistikk_Økologisk landbruk» (eller
   fra roten av repoet). Skriptet henter SSB- og Eurostat-tallene, bygger datasettene og lager nettsiden
   på nytt. Har du bare oppdatert filer for hånd, holder det med `python3 dashbord/skript/bygg_datasett.py`
   og `python3 dashbord/skript/lag_nettside.py`.
2. Skriptet sjekker blant annet at fylkene summerer til landstallet, og stopper med en advarsel hvis noe ikke stemmer.
3. Nettsiden: be Claude legge de endrede filene i `data/` og `dashbord/` inn i GitHub-repoet. GitHub bygger
   og publiserer siden automatisk når endringene kommer inn.
4. Claude-dashbordet: be Claude om å «oppdatere dashbordet Økologisk landbruk i Norge med de nye
   datasettene i dashbord/nettside/datasett». Claude laster opp filene og bytter kildene; sidekoden
   trenger ikke endres.

Siste år, mål og nøkkeltall regnes ut på nytt automatisk. Målet (10 % av jordbruksarealet innen 2032,
fra Nasjonal strategi for økologisk jordbruk 2025–2032) står som en konstant øverst i `side/oko.js`.

## Den automatiske oppdateringen på GitHub

Arbeidsflyten `.github/workflows/oppdater.yml` i repoet:

- **Hver mandag morgen** henter den nye tall fra SSB og Eurostat, bygger datasettene og nettsiden, lagrer
  endringene i repoet og publiserer siden. Er ingen tall endret, publiseres ingenting.
- **Når noe legges inn i repoet** bygger den siden fra filene og publiserer.
- **Feiler noe** i den ukentlige kjøringen, publiseres ingenting, og det opprettes en sak under Issues
  i repoet, slik at eieren får e-post. Siden viser da fortsatt de forrige tallene.
- **GitHub slår av planlagte kjøringer** i offentlige repo etter 60 dager uten aktivitet. Arbeidsflyten
  slår seg derfor på igjen selv hver uke.
- Den kan også startes for hånd: Actions → «Oppdater og publiser» → Run workflow.

Nettsiden publiseres med GitHub Pages (Settings → Pages → Source: GitHub Actions). Domenet
okologiskitall.no settes under Settings → Pages → Custom domain, og DNS-oppføringene legges inn hos Webhuset.

## Besøksstatistikk

Besøk på nettsiden telles med GoatCounter, uten informasjonskapsler: https://okologiskitall.goatcounter.com
(innlogging kreves). Telleren lastes bare på nettsiden, ikke i Claude-dashbordet (se slutten av
`skript/lag_nettside.py`). Sidevisninger telles automatisk. Når noen bytter fane, telles det som en
hendelse med navnet `fane-<fane>` (se `setLink` i `nettside/dash-adapter.js`). Besøk som kommer via
økologisk2032.no, vises med denne adressen som henvisning (referrer) og siden `/?fane=maal`.

## Rettelser etter kontroll

Alle tall i dashbordet er kontrollert mot kildene: SSB- og Eurostat-tallene mot SSBs og Eurostats
API-er, og tallene fra Landbruksdirektoratet mot tabellene og sidene i rapportene. Kontrollen fant noen
feil og blandinger av rapportutgaver, som `skript/bygg_datasett.py` nå retter (se `RETTELSER` i skriptet):

- **Vinmonopolet:** I rapporten for 2025 (tabell 20) er Vinmonopolet-raden rapporten for 2024 sine tall
  forskjøvet ett år. Dashbordet bruker rapporten for 2024 (2023: 1 291,9 og 2024: 1 387,7 mill. kr) og
  har ikke noe 2025-tall for Vinmonopolet.
- **Dagligvare 2019:** Tallet på 2 588 mill. kr brukte gammel varegruppering. Dashbordet bruker anslaget
  på samme grunnlag som 2020–2021 (2,25 mrd. kr, rapporten for 2022, s. 47).
- **Dagligvare, andel 2024:** 2,1 % (revidert i rapporten for 2025, s. 48), på samme grunnlag som 2,3 % i 2025.
  Fra 2024 regnes andelen bare av varegrupper der det finnes økologiske varer; regnet av all mat er den lavere.
- **Melk:** Seriene gjelder økologisk melk levert til Tine Råvare (fra 2023 Norsk Melkeråvare) i alle år.
  Andelen for 2020 er 3,3 % av all innveid kumelk (rapporten for 2020, s. 18), ikke 3,5 % (bare Tine).
- **Varegrupper:** Andeler og omsetning hentes bare fra siste rapport, så de står på samme grunnlag.
- **Kornet:** Februaranslagene justeres ofte mye i neste rapport. Dashbordet viser anslagene slik de er trykt.
- **Fylkesendringer i prosentpoeng** er regnet av SSBs avrundede andeler (én desimal).

## Se nettsiden lokalt

Siden må vises via en webserver (http/https), ikke ved å dobbeltklikke på filen:
`cd dashbord/nettside && python3 -m http.server 8000` og åpne http://localhost:8000.

Siden kan også legges på et vanlig webhotell (last opp innholdet i `nettside/`) eller bygges inn i en
annen side med `<iframe src="https://okologiskitall.no/" style="width:100%;height:1400px;border:0" title="Økologisk landbruk i Norge"></iframe>`.

Farger, skrift og avstander justeres i `nettside/tema.css` (lyst og mørkt tema).

## Kilder og bruksvilkår

- SSB: tabell 12661, 12662, 12663 og 04496. Fri bruk med kildehenvisning (CC BY 4.0).
- Landbruksdirektoratet: årlige rapporter om økologiske jordbruksvarer. Åpne offentlige data (NLOD).
- Debio: årlig statistikk på debio.no.
- Eurostat: org_cropar og org_cropar_h2. Fri gjenbruk med kildehenvisning.
- FiBL: statistics.fibl.org. FiBL tillater enkelttall med kilde, lenke og hentedato, men ikke at større
  uttrekk (over 100 dataserier) spres videre uten skriftlig tillatelse. Dashbordet viser 29 tall
  (forbruk per innbygger 2024, hentet 24.–25.10.2026), og bare de ligger i repoet
  (`data/fibl_forbruk_per_innbygger.csv`). De store FiBL-uttrekkene og årboken ligger bare i den lokale mappen.
- Kart: Kartverket via robhop/fylker-og-kommuner (CC BY 4.0).
- Programvare: d3 versjon 7.9.0 (ISC-lisens, se `nettside/d3-LICENSE.txt`), lagt ved i `nettside/`.

Dashbordet er laget med Claude (Anthropic). Tallene fra Landbruksdirektoratets PDF-rapporter er lest
ut automatisk og kontrollert, men sjekk kilden før et enkelttall siteres.
