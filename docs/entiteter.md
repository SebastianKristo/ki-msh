# Entiteter – autokonfig først, overstyring ved behov

**Prinsipp:** Nesten alt konfigureres automatisk fra HA-områder (rom) og integrasjonen **KI Rom** (`SebastianKristo/ki-rom`). Brukeren overstyrer kun entiteter som blir feil. Ingen hardkodede entitets-IDer i kortene.

## Kilde 1 · KI Rom (per rom `<rom>` = area-slug, pluss `hele_huset`)
| Sensor | Verdi | Brukes til |
|---|---|---|
| `sensor.<rom>_oversikt` | antall entiteter | **Hovedkilde for auto-bygging av rom-popupen.** Attributter: `lys`, `media`, `brytere`, `vifter`, `klima`, `gardiner`, `sensorer` (+klasse), `skript`, `scener`, `temperatur`, `fuktighet`, `lysniva`, `effekt`, `area_id`, `ikon`, `etasje`/`etasje_niva` |
| `sensor.<rom>_lys` | antall lys på | Lys-seksjonens header (`tekst` = «3 på - 5 av»), `aktiv_liste`, `entiteter` |
| `sensor.<rom>_media` | antall som spiller | Media-seksjon (`tekst` = «1 spiller - 2 av») |
| `sensor.<rom>_brytere` | antall på | Enheter-seksjon |
| `sensor.<rom>_sensorer` | antall aktive | Sensorer-seksjon (`tekst` = «1 aktiv - 5 stille») |
| `sensor.<rom>_effekt` | sum W | Rom-kort/enheter (`tekst` = «412 W», `kilder` = W per entitet) |
| `sensor.hele_huset_*` | totaler | Hjem-header/prosa (lys på, total effekt) |

Rom-listen, navn, ikon og etasje hentes fra HA (`hass.areas`, `hass.floors`) + `sensor.<rom>_oversikt`. Nye rom dukker opp automatisk.

## Kilde 2 · HA-registre (når KI Rom ikke dekker det)
- Entiteter i rommet: `hass.entities` (område direkte, ellers via `hass.devices[device_id].area_id`). Hopp over skjulte/deaktiverte, `entity_category` config/diagnostic og grupper – samme logikk som KI Rom.
- Klima-toppkort: `temperatur`/`fuktighet` fra `_oversikt`; ellers første `sensor` med `device_class: temperature`/`humidity` i rommet; chip = første `climate.*` i rommet.
- Popups uten rom (Basseng, Media, Ruter, Klima, Strøm …): finn via domene + `device_class` + integrasjon (`hass.entities[id].platform`, f.eks. `entur`, `nordpool`, `tibber`) – se tabell under.

## Kilde 3 · Overstyring (kun det som er feil)
Hvert kort har i config (og i begge editorene – kortets egen og Bubble Card/HA GUI-editoren):
- `overrides: { felt: entity_id }` – bytt en auto-valgt entitet
- `exclude: [entity_id]` – skjul entiteter autokonfig fant (øye-bryter per entitet i editoren, «Vis alle/Skjul alle» per seksjon)
- `include: { lys: [...], enheter: [...], sensorer: [...] }` – legg til entiteter autokonfig ikke fant (søk i `hass.states` filtrert på domene, eller skriv entity_id)

Rom-editoren (Rom v4 → tilpass) er referansen for UI-et. Overstyring vinner alltid over autokonfig. Editoren viser auto-valgt entitet som placeholder, så man ser hva som blir brukt.

```yaml
type: custom:ki-rom-card
area: stue            # alt annet auto
overrides:
  temperatur: sensor.stue_temp_2
exclude: [light.kjokken_spot_1, light.kjokken_spot_2]
include:
  lys: [light.trapp_led]
  sensorer: [binary_sensor.vindu_kjokken]
```

## Auto-oppslag per popup (uten rom)
| Popup | Auto-regel |
|---|---|
| Hjem-header | `person.*`, `weather.*` (første), `sensor.hele_huset_effekt`, `alarm_control_panel.*` |
| Media | alle `media_player.*`, gruppert per område |
| Klima | alle `climate.*` + `fan.*`, gruppert per område |
| Basseng | entiteter i område «Basseng»/`pool` (temperatur, pumpe-switch, pH/klor) |
| Ruter | plattform `entur` (avganger) + `entur_sx` (avvik) |
| Strøm | `sensor` med `device_class: power`/`energy` + plattform `nordpool`/`tibber` for pris |
| Vær | første `weather.*` |
| Gjøremål | alle `todo.*` |
| Sikkerhet | `alarm_control_panel.*`, `lock.*`, `binary_sensor` door/window/motion |
| Kamera | alle `camera.*` |
| Vanning | område «Hage»/`valve.*`/`switch` med «vann» i navn |

Finner ikke autokonfig noe → vis «–»/tom-tilstand med knapp «Velg entitet» (åpner overstyring). Aldri mock-data, aldri gjettede IDer.
