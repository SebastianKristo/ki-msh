# Handoff: Home Assistant-dashbord (My SmartHome v3)

**Start her.** Legg `prosjektregler.md` i roten av HA-prosjektet som `CLAUDE.md`, så gjelder reglene automatisk. Les i denne rekkefølgen: `README.md` → `prosjektregler.md` (regler, må følges) → `entiteter.md` (autokonfig) → designfilene i `design/`.

## Oversikt
Komplett mørkt Home Assistant-dashbord på norsk: Hjem-visning med navbar, romkort og header, pluss Bubble Card-popups for rom og funksjoner. Alt autokonfigureres fra HA-områder og KI Rom-integrasjonen; brukeren overstyrer i editorer.

## Om designfilene
Filene i `design/` er **designreferanser laget i HTML** (åpnes direkte i nettleser, `support.js` må ligge ved siden av). De viser utseende og oppførsel – de er **ikke** produksjonskode. Oppgaven er å gjenskape dem som **Home Assistant custom cards i JavaScript** (Lit / vanilla web components), lastet som Lovelace-ressurser, plassert i Bubble Card-popups i en `type: sections`-visning. All data i designene er mock – se `entiteter.md`.

## Fidelity
**High-fidelity.** Farger, typografi, mål, radier, animasjoner og interaksjoner er endelige. Gjenskap piksel-nøyaktig.

## Leveranse
Bygg alt i én leveranse (se prosjektregler.md punkt 9): først felles hjelpere, deretter alle kort/popups. Kjør «Sjekk før levering» for hver popup og rapporter resultatet.

### Felles hjelpere (bygges først, brukes av alle kort)
| Modul | Innhold | Referanse |
|---|---|---|
| `renderIcon(name)` | `prefiks:navn` → `<ha-icon>`; Material Symbols-navn → mapping til `mdi:` | prosjektregler.md «Ikon-rendering» |
| `haptic(type)` | HA-eventet `haptic` (light/selection/medium/heavy/success/warning/failure), maks 1 per 40 ms, ikke på Bubble Cards egne elementer | `design/haptic.js` |
| Farger | `var(--navn, #hex)` alltid med fallback | «Design tokens» under |
| Fonter | Space Grotesk lastet én gang på dokumentnivå | prosjektregler.md fallgruve 5 |
| Autokonfig | KI Rom + HA-registre + `overrides`/`exclude`/`include` | `entiteter.md` |
| Ikon-/fargevelger | alle HA-ikonprefiks + tema-/HA-farger | `design/ha-picker.js` (bruk `ha-icon-picker`/`ha-selector` i HA-editorer) |
| Liquid glass-drag | glass-effekt ved drag på navbar/sveipekort | `design/glass-drag.js` |
| More-info | portalert more-info-overlegg | `design/more-info.js` |
| Config-lagring | fersk `lovelace/config` → endre kort via `card_id` → `lovelace/config/save`; YAML-modus → melding | prosjektregler.md fallgruve 3 |

## Skjermer
| Skjerm | Hash | Designfil | Merknad |
|---|---|---|---|
| Hjem (dashbord) | – | `Hjem v2.dc.html` | Header-profiler, prosa-kort med live verdier, romkort med sveip, faner (drag-omorganisering), søppelkort, gjøremål |
| Navbar | – | `Hjem v2.dc.html` (`<nav>`) | Eget kort UTENFOR popups. Mobil: bunn, sentrert i dashbordflaten, maks 392 px. PC: vertikal rail ytterst til venstre i dashbordflaten (til høyre for HA-sidebaren). Merker (røde prikker) med betingelser. «Mer»-meny. |
| Rom | `#<area_id>` | `Rom v4.dc.html` | Klima-toppkort ALLTID først (spesifikasjon i prosjektregler.md). Deretter: gardiner, scener, lys, enheter, klima, media, sensorer – rekkefølge/synlighet i editor. Standard mellomrom 8 px. |
| Romkort | – | `Romkort.dc.html` | Kortet på Hjem som åpner Rom-popupen |
| Basseng | `#badebasseng` (alias `#basseng`) | Basseng v4 popup (variant a) – Basseng v3 er utgått | Toppkort + faner |
| Ruter | `#ruter` | `Ruter v2.dc.html` | Avganger (`entur`) + avvik (`entur_sx`) |
| Klima | `#klima` | `Klima v2.dc.html` | Alle `climate.*`/`fan.*` gruppert per rom |
| Media | `#media` | `Media v4.dc.html` | Alle `media_player.*` |
| Vanning | `#vanning` | `Vanning v4.dc.html` | |
| Sikkerhet | `#sikkerhet` | `Sikkerhet v3.dc.html` | Tastatur (keypad) portales ut av popupen, sentrert i dashbordflaten |
| Vær | `#vaer` | `Vær v3.dc.html` | |
| Lys | `#lys` | `Lys v4.dc.html` | |
| Kamera | `#kamera` | `Kamera v2.dc.html` | |
| Gjøremål | `#gjoremal` | `Gjøremål.dc.html` | `todo.*` |
| Person | `#person-<id>` | `Person.dc.html` | |

**Søppelkortet på Hjem** åpner en ekstern popup: `popup_hash` (standard `#soppel`) + `sensor` (dager til tømming) + valgfri `type_sensor` i config. Trykk setter `location.hash`. Kortet vises alltid.

### Bubble Card-oppsett (alle popups)
```yaml
type: custom:bubble-card
card_type: pop-up
hash: '#klima'
name: Klima
icon: mdi:thermostat
bg_color: '#282828'
bg_opacity: 100
bg_blur: 0
# kortene legges inni popupen – full bredde, 8 px mellomrom
```
Custom cards: `:host{display:block;width:100%}`, `ha-card{background:none;box-shadow:none;border:none}`, `getGridOptions(){return{columns:'full'}}`, ingen egen header/lukk-knapp.

## Interaksjoner og oppførsel
- **Haptic** på knapper, brytere, fliser og trinn i slidere (se felles hjelper).
- **Scener/skript:** engangshandlinger – ingen aktiv-tilstand; trykk = scale-animasjon + haptic.
- **Drag** (graf-scrub, dimmere, sveipekort, fane-omorganisering): `touch-action:none` (horisontalt `pan-y`) + `stopPropagation()` så Bubble Card ikke lukker ved drag ned.
- **Lys av/på-bryter (Rom):** spor `#695b51`, knapp av `#8e7563`, på = gradient `#b8875a → #e0b27e`. Dimmer: spor `#545454`, fyll `linear-gradient(90deg,#a07c5c,#d8b07e)`.
- **Enheter (Rom):** aktiv enhet har INGEN glød/box-shadow.
- **Bekreftelsesmelding** (toast, f.eks. «Dørlås låst opp»): 44 px høy pill, `#e1e1e1` / tekst `#232323`, `top:106px`, sentrert i dashbordflaten, 2,2 s. Kan slås av i config (`toasts: false`).
- **Adaptiv layout:** mål dashbord-containeren, ikke vinduet. Mobil = én kolonne (maks 420 px); bred = to kolonner; ≥1500 px = tre kolonner; zoom opptil 1,8×. Ingenting skal dekke HA-sidebaren.
- **Tab-omorganisering** i popups: drag, lagres i kortets config.
- **Rom-editor:** seksjonsrekkefølge og -synlighet, mellomrom (Tett 4 / Standard 8 / Luftig 18), per-entitet skjul (`exclude`), legg til (`include`, søk i `hass.states` per domene eller skriv entity_id), bytt sensor/termostat (`overrides`), utseende per kort (ikon, farger).
- **Ikon-/fargevelgere overalt:** alle HA-ikonprefiks (mdi:, hass:, phu:, hue:, fapro:, si: …); temafarger lagres som `var(--navn, #hex)`.

## State og data
- Config er sannheten (YAML via editorene); localStorage kun cache.
- Historikk (grafer): `history/history_during_period`, siste 24 t, `minimal_response`, `no_attributes`, kun når popupen åpnes, cache 5 min, siste punkt fra live `hass`.
- Ingen polling for lukkede popups.

## Design tokens
**Flater:** dashbord `#232323` · popup `#282828` · kort/rader `#3a3a3a` · aktiv/utvidet/indre `#404040` · kontroller `#545454`.

**Tema (My SmartHome v3, mørk)** – alltid `var(--navn, fallback)`:
| Token | Hex | Token | Hex |
|---|---|---|---|
| `--red` | `#f28073` | `--gray000` | `#232323` |
| `--orange` | `#f2b573` | `--gray100` | `#2f2f2f` |
| `--yellow` | `#f2d26f` | `--gray200` | `#3a3a3a` |
| `--lime` | `#b8e674` | `--gray300` | `#404040` |
| `--green` | `#66d19e` | `--gray400` | `#545454` |
| `--blue` | `#73b9f2` | `--gray500` | `#696969` |
| `--light-blue` | `#c8ddfa` | `--gray600` | `#7f7f7f` |
| `--purple` | `#ad99e6` | `--gray700` | `#979797` |
| `--pink` | `#f285c9` | `--gray800` | `#afafaf` |
| `--brown` | `#8c794d` | `--gray900` | `#c7c7c7` |
| `--white` | `#fafafa` | `--gray1000` | `#e1e1e1` |

Aksent-gradient (rosa): `linear-gradient(145deg, rgb(242 133 201) -10%, rgb(245 205 198) 100%)`.
Grå-verdiene er ikke verifisert mot temafilen – les fra aktivt tema i HA.

**Typografi:** Space Grotesk 300/400/500/600. Skala brukt: 11 · 12 · 13 · 14 · 15 · 17 · 18 · 21 · 24 · 44 · 72 px. Tall: `font-variant-numeric: tabular-nums`.

**Radier:** 12 · 14 · 16 · 18 · 22 · 24 · 28 · 32 · 33 · 38 (popup-topp) px; pills = høyde/2.

**Mål:** rad/flis-høyde 56–66 px, ikonceller 44–56 px, trykkflater ≥ 44 px, kortmellomrom 8 px.

**Skygger:** kortkant `inset 0 0 0 1px rgba(255,255,255,0.05)`; toast `0 12px 30px rgba(0,0,0,0.45)`.

## Assets
Ingen bildefiler. Ikoner: Material Symbols-navn i designet → `mdi:` via `renderIcon`. Personbilder fra `person.*` `entity_picture`.

## Filer
- `prosjektregler.md` – alle prosjektregler og kjente fallgruver (**må følges**)
- `entiteter.md` – autokonfig og overstyring
- `design/*.dc.html` – skjermene over
- `design/haptic.js`, `ha-picker.js`, `glass-drag.js`, `more-info.js`, `image-slot.js` – referanselogikk
- `design/support.js` – kun for å åpne designfilene i nettleser, skal ikke til HA

## Sjekk før levering (per popup)
Åpnes via hash · fyller bredden på mobil og PC · Bubble-header synlig · toppkort synlig (Rom: klima-toppkort) · lukk/tilbake virker · haptic på trykk · drag lukker ikke popupen · navbar dekker ikke HA-sidebaren · ikoner vises som ikoner (ikke «mdi:»-tekst) · autokonfig fant entiteter, «–» der ingenting finnes · GUI-editor i Bubble Card virker og speiler kortets egen editor.
