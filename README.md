# KI MSH

My SmartHome v3-dashbordet for Home Assistant som **custom cards i JavaScript**, laget for **Bubble Card-popups**.
Gjenskaper Claude Design-prosjektet «Home Assistant-prosjekt» (designfilene ligger i [`design/`](design/)) piksel-nøyaktig:
Hjem-visning med navbar, header, prosa, faner og romkort – og popups for rom, basseng, vanning, klima, lys, media,
kamera, sikkerhet, ruter, vær, gjøremål og personer.

Alt autokonfigureres fra HA-områder, -etasjer og -registre og [KI Rom](https://github.com/SebastianKristo/ki-rom)
(`sensor.<rom>_oversikt`, `_lys`, `_effekt` …). Ingen eksempeldata, ingen hardkodede entitets-IDer. Det som blir feil,
overstyres per kort med `overrides` (bytt), `exclude` (skjul) og `include` (legg til) – i HAs GUI-editor eller i kortets
egen «Tilpass» (samme editor, lagres til kortets YAML-config).

## Installasjon

1. Installer **Bubble Card** (HACS) og temaet **My SmartHome v3** (mørk). KI Rom anbefales.
2. HACS → Custom repositories → `SebastianKristo/ki-msh` (type *Dashboard*) → last ned *KI MSH*.
   Manuelt: kopier `dist/ki-msh.js` til `/config/www/` og legg til ressursen `/local/ki-msh.js` (JavaScript-modul).
3. Lag et dashbord fra [`examples/dashboard.yaml`](examples/dashboard.yaml) (Rå konfigurasjonsredigering) og bytt
   rom-/person-hashene til dine.

Kortene heter `msh-…` slik at de kan lastes sammen med [ki-cards](https://github.com/SebastianKristo/ki-cards)
(som allerede har `ki-rom-card` osv.).

## Oppsett

- Visningen er `type: sections` (grid) – aldri panel.
- **Navbaren** (`msh-navbar-card`) ligger i egen seksjon, utenfor alle popups. Den portales til dokumentnivå og
  plasseres mot dashbordflaten: bunn på mobil (maks 392 px), vertikal rail til høyre for HA-sidebaren på PC.
- **Popups** er frittstående Bubble Card `pop-up` med innholdskortene i `cards:` («Legg til kort» i Bubble-editoren).
  Toppkortet (hero) er alltid første kort. Bubble eier headeren (navn, ikon, lukk) – kortene tegner ingen egen.
  Bakgrunn settes i Bubble: `bg_color: '#282828'`, `bg_opacity: 100`, `bg_blur: 0`.
- **Mellomrom:** KI MSH setter `--bubble-pop-up-gap: 8px` som standard (temaet kan overstyre).

```yaml
type: custom:bubble-card
card_type: pop-up
hash: '#klima'
name: Klima
icon: mdi:thermostat
bg_color: '#282828'
bg_opacity: 100
bg_blur: 0
cards:
  - type: custom:msh-klima-hero-card
  - type: custom:msh-klima-card
```

## Kortene

| Skjerm | Hash | Kort (i rekkefølge) | Design |
|---|---|---|---|
| Navbar | – | `msh-navbar-card` | Hjem v2 (`<nav>`) |
| Hjem | – | `msh-hjem-card` (container, full bredde – tegner griden og oppretter delkortene under `cards.header/prosa/faner/soppel/strom/gjoremal`, hvert med `type` + `card_id`; `layout_mode`, `zoom`, `breakout`, `order`, `hidden`). Delkortene virker også alene: `msh-hjem-header-card`, `msh-prosa-card`, `msh-hjem-faner-card`, `msh-soppel-card`, `msh-strompris-card`, `msh-hjem-gjoremal-card` | Hjem v2 |
| Strømpris | – (trykk → `#strom`) | `msh-strompris-card` (nåpris, søyler per time i dag/i morgen, billigste time, dra for å se time; `overrides.price`/`watt`, `day`, `price_high`/`price_mid`, `popup_hash`) | Hjem v2 strøm-data + ki-strompris-card |
| Romkort | – | `msh-romkort-card` (også brukt inni fanene) | Romkort |
| Rom | `#<area_id>` | `msh-rom-klima-card` (alltid først), `msh-rom-card` | Rom v4 |
| Basseng | `#basseng` | `msh-basseng-hero-card`, `msh-basseng-card` | Basseng v3 |
| Vanning | `#vanning` | `msh-vanning-hero-card`, `msh-vanning-card` | Vanning v4 |
| Klima | `#klima` | `msh-klima-hero-card`, `msh-klima-card` | Klima v2 |
| Lys | `#lys` | `msh-lys-card` | Lys v4 |
| Media | `#media` | `msh-media-hero-card`, `msh-media-card` | Media v4 |
| Kamera | `#kamera` | `msh-kamera-card` | Kamera v2 |
| Sikkerhet | `#sikkerhet` | `msh-sikkerhet-hero-card`, `msh-sikkerhet-card` | Sikkerhet v3 |
| Ruter | `#ruter` | `msh-ruter-card` | Ruter v2 |
| Vær | `#vaer` | `msh-vaer-hero-card`, `msh-vaer-card` | Vær v3 |
| Gjøremål | `#gjoremal` | `msh-gjoremal-card` | Gjøremål |
| Person | `#person-<id>` | `msh-person-hero-card`, `msh-person-card` | Person |
| Søppel | `#soppel` (ekstern) | `msh-soppel-card` åpner popupen, vises alltid | Hjem v2 |

Alle kort kan stå uten config. Rom-kortene henter rommet fra popupens hash (`#stue` → område `stue`), Person-kortene
personen fra `#person-<slug>`. Alle config-nøkler finnes i GUI-editoren; se [`docs/kort.md`](docs/kort.md) for full liste.

### Autokonfig (kort fortalt, se [`docs/entiteter.md`](docs/entiteter.md))

| Popup | Kilde |
|---|---|
| Rom | KI Rom `sensor.<rom>_oversikt` (lys, media, brytere, vifter, klima, gardiner, sensorer, scener, skript, temperatur, fukt) → ellers entiteter i området |
| Hjem | `person.*`, første `weather.*`, `sensor.hele_huset_effekt`/`_lys`, `alarm_control_panel.*`, `lock.*`, `calendar.*`, `todo.*`; strømpris = `MSH.priceSensor` (plattform nordpool → tibber → energi_data_service, kun sensorer med enhet …/kWh eller timesprislister; aldri kostnad/energi) – samme sensor i prosa og strømpriskortet |
| Basseng | område «Basseng»/`pool`: temperatur, pumpe, varmepumpe, pH/klor, tak, lys, spreder, klorkalender |
| Vanning | område «Hage», OpenSprinkler, `valve.*`, vann-brytere, jordfuktighet, vanningskalender |
| Klima | alle `climate.*` + `fan.*` per område, effekt/timegrense/pris, varmtvann |
| Lys | alle `light.*` per etasje/område, utelys, `sun.*` |
| Media / Kamera | alle `media_player.*` / `camera.*` (+ remote, knapper, lys, sirene og hendelser på samme enhet) |
| Sikkerhet | `alarm_control_panel.*`, `lock.*`, `binary_sensor` dør/vindu/port/bevegelse |
| Ruter | plattform `entur_public_transport`/`entur` + `entur_sx` |
| Vær | første `weather.*` (+ `weather/subscribe_forecast` mens popupen er åpen), `sun.*`, pollen, farevarsler |
| Gjøremål | alle `todo.*` (`todo/item/subscribe` mens popupen er åpen) |

Finnes ingenting: kortet vises likevel med «–» og en «Velg entitet»-knapp som åpner overstyringen.

## Felles oppførsel

- **Ikoner** rendres alltid med `<ha-icon>` (alle prefiks: `mdi:`, `hass:`, `phu:`, `hue:`, `fapro:`, `si:` …);
  designets Material Symbols-navn mappes til `mdi:`.
- **Farger** er temafarger med fallback (`var(--red, #f28073)`); fargevelgerne tilbyr temafarger, HA-farger og hex.
- **Haptic** (`haptic`-eventet) én gang per trykk, maks én per 40 ms; ikke på Bubble Cards egne knapper.
- **Drag** (slidere, graf-scrub, sveip, fane-omorganisering, glass-linse) har `touch-action` + `stopPropagation`,
  og vannrett scrollbare lister stopper sveip – Bubble Card lukker ikke popupen mens man drar.
- **Overlegg** (tastatur, ark, menyer, fullskjerm) portales til dokumentnivå og plasseres mot dashbordflaten.
- **Historikk** hentes kun når popupen åpnes (`minimal_response`, `no_attributes`), cache 5 min, siste punkt live.
- **Lagring fra kortets egen editor:** fersk `lovelace/config` → kortet finnes via `card_id` → kun det kortet endres →
  `lovelace/config/save`. YAML-modus: meldingen «Rediger i YAML», endringen lagres kun lokalt.
- **Toasts** («Dørlås låst opp») kan slås av per kort med `toasts: false`.

## Utvikling

```bash
npm run build       # dist/ki-msh.js (alle filer i src/ i navnerekkefølge, hver i egen try-blokk)
npm test            # smoke-test av alle kort (test/cases, test/mock) i Chromium, mobil + PC
npm run checklist   # «Sjekk før levering» per popup mot ekte Bubble Card → docs/sjekkliste.md
```

- `src/00-base.js` – felles hjelpere (`window.MSH`): ikoner, haptic, farger, fonter, autokonfig, historikk,
  overlegg/toast, drag-vern, DOM-morph, config-lagring og basekortet `MSH.Card`.
- `src/01-editor.js` – felles editor `msh-editor` (GUI-editor og kortets egen tilpasning).
- `src/NN-*.js` – ett eller flere kort per skjerm.
- Prosjektregler: [`CLAUDE.md`](CLAUDE.md). Siste sjekkliste-resultat: [`docs/sjekkliste.md`](docs/sjekkliste.md).
- Avvik fra designet og hvorfor: [`docs/avvik.md`](docs/avvik.md).
