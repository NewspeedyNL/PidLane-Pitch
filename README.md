# PidLane-Pitch
Pitch site 4 PidLane

## Foutcodepagina's (`/foutcode/`)

Een pagina per OBD2-foutcode (`/foutcode/P0420`), een index en de regels in
`sitemap.xml`. Gegenereerd uit `pidlane-data.js` van de app — de tekst is
dezelfde als in PidLane zelf. GitHub Pages heeft geen buildstap, dus de
pagina's worden meegecommit.

```
node tools/foutcodes.js                     # bron: ../PidLane/public/pidlane-data.js of app.pidlane.nl
node tools/foutcodes.js --bron <pad|url>    # een andere bron
node tools/foutcodes.js --snapshot          # opnieuw opbouwen uit foutcode/bron.json (na een wijziging aan de opmaak)
node tools/test-foutcodes.js                # draait ook in CI (.github/workflows/tests.yml)
```

Verandert de foutcodetekst in de app, draai dan de eerste regel en commit
`foutcode/` en `sitemap.xml`. Niet met de hand in een codepagina werken: de
test wordt dan rood.
