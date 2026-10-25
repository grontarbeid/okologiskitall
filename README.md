# Økologisk landbruk i Norge – statistikk

Dashbordet bak **[okologiskitall.no](https://okologiskitall.no)**. Det samler statistikk om økologisk
landbruk i Norge på ett sted: areal og gårder, produksjon, fylker (med kart), vare for vare, marked,
Europa og målet om 10 % økologisk jordbruksareal innen 2032. Dashbordet er laget for alle som er
interessert i økologisk landbruk, men mest for produsenter og fagpersoner.

Inntil domenet er koblet til, ligger siden på https://grontarbeid.github.io/okologiskitall/.

Under hver figur kan du åpne «Vis tallene» og «Vis kildene». Kildene lenker til siden hos kilden der
tallene ligger, så du kan sjekke dem selv. Tallene dashbordet bygger på, ligger i `data/`, og de ferdige
datasettene i `dashbord/nettside/datasett/`.

## Kilder og vilkår

| Kilde | Hva dashbordet bruker | Vilkår |
|---|---|---|
| [Statistisk sentralbyrå](https://www.ssb.no/statbank/list/stjord), tabell 12661, 12662, 12663 og 04496 | Økologisk areal og gårder (landet og fylker), areal etter vekst, husdyr, jordbruksareal | CC BY 4.0 |
| [Landbruksdirektoratet](https://www.landbruksdirektoratet.no/nb/jordbruk/miljo-og-klima/okologisk-landbruk), årsrapportene om økologiske jordbruksvarer | Melk, kjøtt, egg, korn, salg, salgskanaler og tilskudd | NLOD |
| [Debio](https://debio.no/statistikk/), årlig statistikk | Gårder inn og ut av ordningen, vekster | Publisert åpent på debio.no |
| [Eurostat](https://ec.europa.eu/eurostat/databrowser/view/org_cropar/default/table?lang=en), org_cropar og org_cropar_h2 | Økologisk andel i Europa og Norden | Fri gjenbruk med kildehenvisning |
| [FiBL](https://statistics.fibl.org/europe/retail-sales-europe.html) | Forbruk av økologisk mat per innbygger i europeiske land (29 tall for 2024, hentet 24.–25.10.2026) | Enkelttall med kilde, lenke og hentedato. Større uttrekk krever skriftlig tillatelse fra FiBL og ligger derfor ikke her. |
| [Kartverket](https://data.norge.no/en/datasets/cffde12f-3530-4406-9aa0-d6d4519ef077/administrative-enheter-fylker) via [robhop/fylker-og-kommuner](https://github.com/robhop/fylker-og-kommuner) | Fylkesgrenser | CC BY 4.0 |
| [Regjeringen](https://www.regjeringen.no/no/dokumenter/nasjonal-strategi-for-okologisk-jordbruk-2025-2032/id3097100/) | Målet om 10 % innen 2032 (Nasjonal strategi for økologisk jordbruk 2025–2032) | – |
| [d3](https://d3js.org) 7.9.0 | Figurene | ISC, se `dashbord/nettside/d3-LICENSE.txt` |

## Slik holdes tallene oppdatert

- **Hver mandag** henter GitHub nye tall fra SSB og Eurostat, bygger datasettene på nytt og publiserer
  siden hvis noe er endret (`.github/workflows/oppdater.yml`).
- **Én gang i året** (mars) legges tallene fra Landbruksdirektoratets rapport, Debio og FiBL inn for hånd.

Mer om oppdateringen, mappene og kontrollen av tallene står i [`dashbord/README.md`](dashbord/README.md).

## Mappene

| Mappe | Innhold |
|---|---|
| `data/` | Kildetallene dashbordet bygges fra (CSV) |
| `dashbord/skript/` | Skriptene som henter tall og bygger datasettene og nettsiden (bare Python 3, ingen ekstra pakker) |
| `dashbord/side/` | Sidekoden: HTML, CSS og JavaScript |
| `dashbord/nettside/` | Den ferdige nettsiden som publiseres, med datasettene i `datasett/` |
| `dashbord/kart/` | Fylkesgrensene |

## Om dashbordet

Dashbordet er laget med KI (Claude fra Anthropic). Tallene er hentet med skript og kontrollert mot
kildene, men sjekk kilden før du siterer et enkelttall.
