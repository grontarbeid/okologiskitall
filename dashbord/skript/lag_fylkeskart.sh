#!/usr/bin/env bash
# Lager fylkeskartet (dashbord/kart/fylker_2024_utm33.geojson) på nytt – trengs bare ved en ny fylkesreform.
# Krever Node.js. Kartgrunnlag: Kartverket via github.com/robhop/fylker-og-kommuner (CC BY 4.0).
#   1. git clone https://github.com/robhop/fylker-og-kommuner.git /tmp/fylker-og-kommuner
#   2. bash dashbord/skript/lag_fylkeskart.sh /tmp/fylker-og-kommuner/Fylker-M.geojson
#   3. python3 dashbord/skript/bygg_datasett.py   (gjør om kartet til SVG-stier i datasett/fylkeskart.json)
# Kartet projiseres til UTM sone 33 (slik norske kart vanligvis tegnes), Oslo og Akershus slås sammen
# slik SSB publiserer dem, små øyer fjernes og grensene forenkles så filen blir liten.
set -euo pipefail
KILDE="${1:?Oppgi stien til Fylker-M.geojson}"
UT="$(cd "$(dirname "$0")/.." && pwd)/kart/fylker_2024_utm33.geojson"
npx --yes mapshaper@0.6.102 "$KILDE" \
  -proj '+proj=utm +zone=33 +ellps=GRS80 +towgs84=0,0,0 +units=m +no_defs' \
  -each 'kode = (fylkesnummer=="03"||fylkesnummer=="32") ? "03+32" : fylkesnummer; navn = (kode=="03+32") ? "Oslo og Akershus" : name' \
  -dissolve kode copy-fields=navn \
  -filter-islands min-area=10km2 remove-empty \
  -simplify weighted 10% keep-shapes \
  -clean \
  -o format=geojson precision=100 "$UT"
echo "Skrev $UT"
