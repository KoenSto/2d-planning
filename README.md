# RuimteScenario PDOK

Een statische 2D-webapp voor vroege ruimtelijke planvorming op Nederlandse PDOK-kaarten. Selecteer kadastrale percelen, teken bebouwing, groen, parkeren en openbare ruimte, vergelijk varianten en exporteer de resultaten.

## Functies

- zoeken op adres, woonplaats of kadastrale aanduiding via de PDOK Location API;
- kadastrale percelen laden en selecteren via de BRK Kadastrale Kaart OGC API;
- scenario-objecten tekenen en bewerken: bebouwing, groen, parkeren en openbare ruimte;
- eigenschappen per bouwvlak: functie, bouwlagen en aandeel wonen;
- live kengetallen: plangebied, bebouwd oppervlak, BVO, FSI, GSI, groenpercentage, indicatieve woningen en parkeerbalans;
- scenario's aanmaken, dupliceren, hernoemen, verwijderen en vergelijken;
- lokale opslag in de browser;
- import en export als RuimteScenario-JSON en GeoJSON;
- demonstratiescenario in Utrecht;
- automatische tests en publicatie via GitHub Actions en GitHub Pages.

## Direct lokaal starten

Er is geen installatie- of buildstap nodig. Start vanuit de hoofdmap een eenvoudige webserver:

```bash
python3 -m http.server 4173
```

Open daarna:

```
http://localhost:4173
```

Open index.html niet rechtstreeks als file://-bestand. ES-modules en browserbeveiliging werken betrouwbaarder via een lokale webserver.

## Publiceren op GitHub Pages

1. Maak een lege GitHub-repository aan.
2. Pak het ZIP-bestand uit en upload alle bestanden naar de hoofdmap van de repository.
3. Gebruik main als standaardbranch.
4. Open in GitHub Settings > Pages.
5. Kies bij Source voor GitHub Actions.
6. Push een wijziging naar main of start de workflow handmatig onder Actions.

De workflow in `.github/workflows/deploy-pages.yml` controleert de JavaScriptbestanden, voert de tests uit en publiceert daarna de statische site.

Voor upload via Git:

```bash
git init
git add .
git commit -m "Eerste versie RuimteScenario PDOK"
git branch -M main
git remote add origin <URL-VAN-JOUW-REPOSITORY>
git push -u origin main
```

## Gebruikersroute

1. Zoek een locatie of navigeer handmatig.
2. Zoom in tot straatniveau en kies Laad kavels.
3. Klik een of meer percelen om het plangebied samen te stellen.
4. Teken bebouwing, groen, parkeren en openbare ruimte.
5. Klik een getekend vlak om eigenschappen in te voeren.
6. Pas de scenario-aannames aan.
7. Dupliceer het scenario en vergelijk varianten.
8. Exporteer als JSON voor volledig herstel of als GeoJSON voor GIS-gebruik.

## Rekenregels

De tool rekent indicatief in de browser met Turf.js.

| Kengetal | Vereenvoudigde berekening |
|---|---|
| Plangebied | som van geselecteerde perceeloppervlakken |
| Bebouwd oppervlak | som van bouwvlakoppervlakken |
| BVO | som van bouwvlak x bouwlagen |
| GSI | bebouwd oppervlak / plangebied |
| FSI | BVO / plangebied |
| Groenpercentage | groenoppervlak / plangebied |
| Woningen | wonen-BVO x netto/bruto / gemiddelde woningoppervlakte |
| Parkeervraag | woningen x parkeernorm |
| Parkeercapaciteit | getekend parkeeroppervlak / ruimte per parkeerplek |

Overlappende polygonen worden niet automatisch ontdubbeld. De tool toont daarom een waarschuwing wanneer de getekende grondfuncties samen groter zijn dan het geselecteerde plangebied.

## Opslag en privacy

- Scenario's staan uitsluitend in localStorage van de gebruikte browser.
- Er is geen account, serverdatabase of analysetracker ingebouwd.
- Verwijderde browsergegevens kunnen lokale scenario's wissen; exporteer belangrijke varianten daarom als JSON.
- Zoekopdrachten en kaartbevragingen worden rechtstreeks vanaf de browser naar PDOK gestuurd.

## Configuratie

Belangrijke instellingen staan in `src/config.js`:

- beginpositie en zoomniveau;
- PDOK-endpoints;
- minimale zoom voor perceelbevraging;
- maximale omvang van een perceelbevraging;
- standaard scenario-aannames;
- kleuren en labels van tekenobjecten.

## Projectstructuur

```
.
├── .github/workflows/deploy-pages.yml
├── assets/
├── examples/demo-scenario.json
├── src/
│   ├── app.js
│   ├── calculations.js
│   ├── config.js
│   ├── demo.js
│   ├── pdok.js
│   └── scenarios.js
├── tests/
├── index.html
├── styles.css
├── manifest.webmanifest
├── LICENSE
├── THIRD_PARTY_NOTICES.md
└── package.json
```

## Testen

Node.js 20 of nieuwer is nodig voor de lokale controles, niet voor het gebruik van de website.

```bash
npm run check
npm test
```

## Belangrijke beperkingen

- De toepassing is bedoeld voor verkenning en vroege planvorming, niet voor juridische, financiële of vergunningsbesluiten.
- De Kadastrale Kaart geeft de globale ligging van perceelgrenzen weer; er kunnen geen maten aan worden ontleend.
- Oppervlakten worden geodetisch uit GeoJSON berekend en zijn indicatief.
- Externe PDOK-diensten en CDN's vereisen een internetverbinding en kunnen veranderen of tijdelijk niet beschikbaar zijn.
- De statische versie heeft geen centrale opslag, gebruikersrechten, audittrail of realtime samenwerking.
- Voor productiegebruik met meerdere gebruikers is een backend met authenticatie en een ruimtelijke database aan te raden.

## Licenties

De eigen broncode is beschikbaar onder de MIT-licentie. Externe software en PDOK-data vallen onder hun eigen licenties en voorwaarden; zie THIRD_PARTY_NOTICES.md.
