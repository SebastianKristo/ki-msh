# Endringslogg

Én seksjon per fiks-prompt (nyeste først). Detaljer står i kommentarene i `src/` («Fiks NN.x») og i `docs/avvik.md`.

## 1.7.0 · Runde 2 · Enhetlige Tilpass-menyer, jevnere animasjoner, integrasjonen henter inn huset
**Tilpass-menyene**
- Én felles bryter (`MSH.tp.sw`: 50×30 spor, hvit knott med fjær, «Reduser bevegelse») i alle Tilpass-ark og editorer. På-fargen er arkets egen (rosa eller designets gradient). Bryterne inni popupene (Server, Tesla, Klima-varslinger) er som i designet. Bryterne inni popupene (Server, Tesla) er som i designet.
- Én liste over Tilpass-oppføringene (`MSH.tp.entries`) med ikon og forklaring, brukt i Tilpass-arket, Innstillinger og HA-hub-en, så navn og forklaring er like overalt.
- **Navbar:** «Plassering» som egen seksjon. Sjeldne valg ligger under «Avansert» (lukket): plass til navbaren, korte bekreftelser, «Tilpass» i Mer-menyen for brukere uten admin, og visning av handlingsvalg. Tydeligere tekster: «I Mer-menyen», «Når du trykker / holder inne», «Gjelder bare denne enheten (navn)». «Liquid glass» heter nå «Glass» («Glass i menyer og Tilpass-ark»).
- **Tilpass-arket, PC, Server, Tilpass alt og Analyse** bruker felles header (`MSH.tp.head`), seksjonstitler (`MSH.tp.SEC`), grupper og chips. PC-arket har språkvalg (Norsk/English) og «Bytt til mobilvisning». «Tilpass alt»: «Steg n av 13 · lagres straks», og første steg heter «Hva skal med».
- Ordbruk: «Nullstill» overalt (ikke «Tilbakestill»), «Tilpass server» og «Tilpass innstillinger» med liten forbokstav. Hurtigpanelets sveip-valg forklarer hva de gjør («Hvor langt du må dra» …).
- Kosmetikk: grå reservefarger utenfor paletten er byttet til temaets gråtoner (hurtigpanelet, Tilpass alt), og tekst på rosa er `--ki-on-accent`. Ark-bakgrunnen er `--ki-popup`.

**Animasjoner**
- Trykk-skalering virker igjen i lister som glir inn (`animation-fill-mode: backwards` i stedet for `both` i HA-innstillingene, handlingsvelgeren og varslingsreglene).
- Tilpass-arkene glir helt ut før de fjernes (`transitionend`, ikke fast 250 ms mot en utgang på 240 ms).
- «Reduser bevegelse» gjelder alle kort (`MSH.BASE_CSS`). Lastesirkler snurrer fortsatt, også i Ytelsesmodus.
- Glansen som følger telefonen beregnes bare når glass-temaet er på og Ytelsesmodus er av (før ble hele dokumentet restylet på hver bevegelse).
- Nedtellingslinja (Hjem → Apparater) bruker `scaleX` i stedet for bredde, og media-prikkene animerer bare bredde og farge (ikke `all`).

**Integrasjonen**
- **Kilder** (`kilder.py`): KI Rom (romsensorene fra registeret), KI Energi (`unique_id` → entitets-ID, status, tjenester), bryterne fra KI Varslinger m.fl., HAs Energi-oppsett og strømprissensoren samles i husmodellen. Legger du til eller fjerner KI Rom, lastes eller bygges modellen på nytt.
- **Husmodellen** (`ki_msh/hus`): rom med KI Rom-data, HAs klimasensorer for området, bilde og aliaser, samt `kilder`, `energi`, `reserve` og `rev`. `ki_msh/hus/abonner` sender den på nytt når noe endres. Totalen for «Hele huset» regnes ut med 1 s forsinkelse.
- **Frontend** (`src/01b-hus.js`, `MSH.hus`): strategien lager rom-popups bare for rommene som er valgt i integrasjonen. Reservesensorene kommer fra Konfigurer → Kilder; de gjettede `sensor.hus_temperature`/`sensor.hus_fuktighet` er fjernet. `MSH.kiRom` og KI Energi-oppslaget bruker integrasjonens kart (virker også for brukere som ikke er admin). Nye rom og enheter gir nye popups uten omlasting. Uten integrasjonen virker alt som før.
- **Felles lager** (`store.py`, `ki_msh/lager/*`): «Lagring: Felles for alle» (standard) gjør Tilpass-valgene like for alle brukere. ki-store bruker lageret automatisk og laster opp det eksisterende oppsettet første gang. «Per Home Assistant-bruker» beholder `user_data`.
- **Oppsett:** adressen gjøres om til en gyldig URL (æøå håndteres), og du får feilmelding hvis den er ugyldig eller opptatt. Nytt steg «Kilder» (reservesensorer for temperatur og fukt, strømpris). Tømte valg fjernes fra innstillingene. Etter oppsettet får du en velkomstmelding med lenke til dashbordet.
- **Ryddig:** bundelen får innholdshash i URL-en (`?v=<versjon>-<hash>`), Bubble Card fra CDN fjernes når den ikke trengs lenger, og integrasjonens JS avregistreres ved utlasting. Ved fjerning slettes også det felles lageret og reparasjonsmeldingene. Bubble Card-CDN er låst til `v3.4.2`. `sensor.ki_msh` lagrer ikke store attributter i historikken.
- **Tester:** `tests/test_runde2.py` (URL-er, innstillinger, KI Energi-kart, lager, websocket) og `test/runde2-check.mjs` (frontend med og uten integrasjonen, felles lager, live-oppdatering, felles kontroller, ark som lukkes).
- Testoppsettet (`test/harness.html`) følger `hass.themes.darkMode` som i HA. Før fulgte det Playwrights lyse `prefers-color-scheme`, og noen sjekker kjørte derfor i lys modus.

## 1.6.0 · KI MSH som integrasjon + Claude Design 23.10.2026 (runde 2)
**KI MSH er nå en Home Assistant-integrasjon** (`custom_components/ki_msh/`, HACS-type *Integration*). Se README → Installasjon for flytting fra plugin-utgaven.
- **Kortene** serveres fra integrasjonen (`/ki_msh_static/ki-msh.js?v=<versjon>`) og lastes på alle sider – ingen Lovelace-ressurs. Den gamle ressursen til `ki-msh.js` (HACS-plugin eller `/local/`) fjernes automatisk. Bubble Card lastes fra jsDelivr når den mangler (Konfigurer → Kort: auto/cdn/av).
- **Dashbordet lages automatisk** på `/ki-msh` med strategien `custom:ki-dashboard` (navn, ikon, adresse, sidepanel, bare admin). Strategien skrives bare når lageret er tomt – egne endringer beholdes. `ki_msh.lag_dashbord` skriver den på nytt; fjernes integrasjonen, slettes dashbordet.
- **Husmodellen:** `sensor.ki_msh` og websocket `ki_msh/hus` (rom, etasjer, funksjons-popups med `aktiv`/`grunn`). Funksjonslista (`FUNKSJONER` i `const.py`) speiler nå alle `M.FUNCTION_POPUPS` og vilkårene i strategien som regler (domene, plattform, device_class, produsent, regex, attributt, posisjon); `npm run funksjoner` sjekker at hashene er like.
- **Romtellerne fra KI Rom** (`sensor.<rom>_lys` … `_oversikt`) når KI Rom ikke er installert (Automatisk/Alltid/Av).
- **HA 2024.11 → nyeste:** panelet registreres med `show_in_sidebar` bare der HA har parameteren (2024.11/2025.1 ga TypeError), `hass.data["lovelace"]` som dict og `LovelaceData`, `StaticPathConfig` uten den fjernede `register_static_path`, ingen fil-I/O i hendelsesløkken (versjon leses ved import, `exists()` i executor), gammel `extra_js_url` fjernes ved ny versjon uten omstart.
- **Tester:** `tests/` (pytest-homeassistant-custom-component, som ki-rom): `hub._build` med registre, `_finn_funksjoner`, dashbordet lagres bare når lageret er tomt, ingen romtellere når KI Rom er satt opp.
- `npm run build` skriver bundelen også til `custom_components/ki_msh/frontend/ki-msh.js` og setter `version` i `manifest.json` fra `package.json`. `hacs.json` er integrasjon (uten `filename`).

Fra Claude Design (base main 164e2e4):
- **Popup-header:** rom-popups får pille (999px) bak ikon og navn og rund × på 50 px uten kant; funksjons-popups (`data-ki-hdr=plain`, lest fra popupens styles) har ikonet helt til venstre, ingen flate og × uten sirkel (`00-a-theme.js`).
- **Mer-menyen:** «Tilpass» ligger i Innstillinger (under oppdateringskortet) for admin og er fjernet fra menyen; ikke-admin beholder den. Flisene har hel farge bak ikonet, mørkt ikon og navnet i flisens farge (kontrast ≥ 5:1 på navbaren i begge tema). Rettet her: ikonet arvet flisens farge og ble usynlig.
- **Prototypen:** `phu:tesla-*` vendret lokalt (`app/prototype/vendor/phu.js`, kopieres til appen av `build-www.mjs`), andre ikonprefiks via Iconify, dra ned for å oppdatere, oppstartstekst «Laster …».
- **Ikke tatt inn:** `src/00-c-tilpass-ui.js` (bare prototypen, ligger i `app/prototype/src-extra/`), `ki/native.js` (kopieres fra `app/web/`), `*.dc.html`. «Tema: Auto» i `69i` følger fortsatt HAs darkMode i HA (rettelsen fra forrige runde). «Glimt-konto» er bare beskrevet i handoffen – `glimt.js` har ikke leverandøren, og API-et mot Nordlys OS er ikke sjekket (TODO i `69i-ha-app.js`).

## Claude Design 23.10.2026 · HA-innstillinger, mer info, Liquid Glass
Endringer tatt inn fra Claude Design-prosjektet «Home Assistant App» (base main 164e2e4).
- **HA-innstillinger:** «Lag ny» med maler for automasjoner, skript og scener (`src/69f-ha-ny.js`), sider for etiketter og mapper, ekstra paneler/verktøy (`69g`, `69h`), profilkort, «Companion-appen» og «Tilpass dashbordet» i hub-en (`69i-ha-app.js`). Scene fra rom (`69d`). Headeren dekker innhold som ruller under (`69`). «Tema: Auto» følger HAs eget temavalg i HA, telefonen i appen.
- **Mer info-ark:** tannhjul ved ✕ med entitetsinnstillinger (navn, entitets-ID, ikon, område, synlig/aktivert via `config/entity_registry/update`); klima får nøkkeltall og «Sensorer i rommet»; media får nytt toppkort, volum ± og gruppemedlemmer.
- **Navbar / Mer-panel:** nytt menydesign (ikonfliser i farge, utvidet rutenett), og panelets regel som skjuler mini-spilleren fjernes når panelet lukkes.
- **Liquid Glass:** klarere glass, glans som følger telefonen (`--ki-gl-tilt`), lys under fingeren og gelé-morf i segmentrader (`00-base.js`).
- **Popups:** enklere Bubble-header (ingen pille bak ikon/tittel, 34 px tittel, × uten sirkel) (`02-popups.js`).
- **Lysrader:** hold inne 450 ms = mer info for lampen (`08-light-row.js`). Server-menyens «Tilpass …» heter nå «Innstillinger» og åpner HA-innstillingene.
- **App:** SRC-lista i `demo/ki/runtime.html` genereres nå fra `src/` i `app/scripts/build-www.mjs` (manglende `00-c-tilpass.js`, `00-a-lang-en-17/18.js` og `69*-ha-*.js` ga `MSH.tp`/`MSH.ha` = undefined i appen). Prototypen bruker `MSH.ha` i stedet for gamle `ki/ha-settings.js`, har demo-register for etiketter/mapper/entiteter, og Vær holdes under statuslinjen.

## Fiks 66 · Felles kontroller i Tilpass-arkene
- Én slider overalt (`MSH.tp.range`): 6 px spor, rosa fyll fram til verdien, hvit knott – erstatter native `accent-color`-slidere (ulikt utseende på iOS/Android) og de egne variantene i kamera, strømpris, lys, klima, navbar, Hjem og fanehøyde.
- Forvalg under slidere er små, stille snarvalg (rosa tone når valgt) i stedet for en ekstra rad med store piller; valg-chips er like overalt (34 px, valgt = rosa).
- Felles editor: felt i en gruppe har ingen egen flate (ingen boks i boks), skillelinjer mellom feltene, etiketter 14/500, hjelpetekst 12 px med bedre kontrast, tekstfelt 16 px (ingen zoom på iOS) med rosa fokusring.
- Radlister er én gruppe med skillelinjer: Rom-seksjoner, Kort på Hjem, faner i Lys og Strøm, kameraer. Pilknapper/øye uten egne mørke piller.
- «Mellomrom» (ki-spacing-editor) og «Fanehøyde»: slider først, så forvalg; radene skilt med linjer.

## Fiks 66 · Felles Tilpass-design
Alle «Tilpass …»-arkene har nå samme oppbygning (`src/00-c-tilpass.js`, `MSH.tp`).
- **Header:** `[× Avbryt]  Tilpass <navn> / undertittel  [↺ Nullstill]  [Ferdig]` i navbar, header, Hjem, rom og alle
  kortenes editorer, lys, kamera, klima, vær, ringeklokke, kiosk, Tilpass alt, Tesla, strøm, varmepumpe, dørlås,
  garasje, server og PC-oversikten. Titlene skrives likt («Tilpass navbar», ikke «Tilpass · Navbar») og kuttes ikke
  lenger («Tilpass · Hjem · he…»). Undertittelen sier hva arket gjelder, eller om endringer vises live / lagres straks.
- **Avbryt** (×) finnes i alle ark med utkast og forkaster endringene. Ark som lagrer straks har bare «Ferdig».
- **Nullstill** er en rund ikonknapp på samme plass i alle ark som har den.
- **Seksjonstitler** er like overalt: setning, 13/600, sekundærtekst (ingen VERSALER).
- **Navbar:** knappene ligger i én gruppeflate med skillelinjer, som listene i de andre arkene.
- Skjermbilder før/etter: `docs/images/tilpass/`, ta nye med `node test/tilpass-shots.mjs`.
## Fiks 65 · Home Assistant-innstillinger i appen
Målet er at appen kan erstatte Home Assistant-appen for det meste av innstillingene.
- **Hvor:** nederst i Innstillinger (`#settings`, seks snarveier, bare for administratorer, `ha_meny: false` skjuler) og
  som raden «Home Assistant» i Mer → Tilpass. Alt åpnes i ett helhøyt ark med egen sidestabel (`MSH.ha.open(side)`,
  `src/69-ha-config.js`). Sider appen ikke har egen versjon av åpner HAs side.
- **Automasjoner, scener og skript** (`src/69c-ha-auto.js`): lister gruppert i mapper (HAs kategorier), områder eller
  etiketter, med søk, etikettfilter, av/på, kjør, dupliser, slett og «Siste kjøringer» (spor med alle steg).
  Mappe, etiketter og område settes i entitetsregisteret, som i HA. Egne sider for mapper og etiketter.
- **Editor** (`src/69b-ha-blocks.js`): utløsere, betingelser og handlinger som kort med lesbar oppsummering. Skjema for
  alle vanlige typer, nøstede blokker (hvis/så/ellers, velg, gjenta, parallelt, sekvens, og/eller/ikke, vent på utløser),
  tjenestefelt med glidebrytere fra HAs egne felt, test av betingelser og handlinger, YAML per blokk og for hele
  automasjonen. Leser gammelt format (`platform:`/`service:`) og lagrer nytt (eldre HA får gamle nøkler).
- **Scener** (`src/69d-ha-scene.js`): legg til entiteter, «Hent» nåværende tilstand per entitet eller alle, prøv scenen
  (`scene.apply`) og lagre.
- **Oppdateringer, backup og system** (`src/69e-ha-system.js`): installer med backup først, utgivelsesnotater, hopp over,
  «Ta backup og oppdater alt» (Core sist). Backup: lag, last ned, gjenopprett, slett og automatisk plan, oppbevaring,
  innhold og steder. Reparasjoner, logger, start på nytt (sjekker konfigurasjonen først), last inn YAML, generelt og om.
- **Språk:** engelsk i `src/00-a-lang-en-17.js`. Test: `node test/ha65-check.mjs [skjermbildemappe]`.

## Fiks 64 · PC-dashbord (prompt v8)
Designet ligger i `design/PC-dashbord.dc.html`.
- **Valg:** ny rad «Dashbord på PC» i Tilpass-arket (Hjem). Den bytter `localStorage['ki-pc-oppsett']` mellom `pc` og
  `mobil` (`MSH.pc`). `msh-hjem-card` viser `msh-pc-card` når valget er `pc` og dashbordflaten er minst 1100 px bred.
  Navbaren skjules da. Smalere skjermer viser alltid mobilvisningen.
- **Oppsett** (`src/68-pc.js`):
  - Helt-panel med bilde (`photo` eller rommets bilde), navn, fire tall og romchips. Trykk på et valgt rom åpner
    rommet i sidepanelet.
  - Bredden dras i høyre kant (300–760 px, dobbeltklikk = 480, `ki-pc-bredde`).
  - Fanerad med flytende glass og hold-og-dra (felles `MSH.tabRow`, `tab_order` speilet i `ki-pc-faner`).
  - Dato og klokke, varsler (hurtigpanelet) og profil.
- **Faner:** Oversikt, Klima, Energi, Sikkerhet, Enheter og Rom og apper, med kortene fra designet. Alle tall kommer fra
  de samme entitetene som mobilkortene (`src/68-pc-data.js`, `MSH.pcData`): rom/klima, vær, strømpris, HAs
  Energi-oppsett, alarm, personer, kamera og device_class. Mangler noe, vises «–».
  - Varmepumpe −/+ og modus, alarmmodus og «Slå av alt» (to trykk) styrer HA direkte.
- **Sidepanel:** popupens eget kort tegnes innebygd i et portalt panel (`embedded`), uten Bubble-header. Det gir ingen
  dobbel X og ingen fargeskille (`--ki-popup`). «Åpne i egen fane» åpner den vanlige popupen. Popups som ikke finnes,
  får ingen flis i «Rom og apper».
- **Søk:** maks 40 treff. Enter åpner første treff, og Esc lukker.
- **Tilpass oversikten:** Språk, Dashbord på PC, Tilpass alt, Tilpass Hjem og Innstillinger, pluss «Kort i oversikten»
  (`ki-pc-kort`).
- **Analyse:** 7 / 30 / 90 dager / 1 år (52 uker) fra `recorder/statistics_during_period`.
- **Språk:** engelsk i `src/00-a-lang-en-16.js`. Test: `node test/v8-check.mjs`.

## Fiks 63 · Besøkskart for arildkristo.com (prompt v7)
Designet ligger i `design/Besokskart.html` og `design/Server v6.dc.html`.
- **«Besøk på kart»** (`src/58c-server-cf.js`): nytt kort på underfanen Besøk, under «Besøkende» og over listene.
  - Verdenskart i Natural Earth-projeksjon, uten Antarktis, 1,9 : 1.
  - Geometrien er `world-atlas@2.0.2/countries-110m.json` fra jsDelivr. Den lastes én gang, første gang kortet vises.
  - d3-geo og topojson-client er bygget inn i `src/vendor/geo-no.js` (`window.KI_GEO`, 22 KB).
- **Farger:** land med besøk er rosa, med opasitet 0,25–1 på kvadratrotskala. Land uten besøk er grå.
- **Trykk:** trykk på et land gir hvit kant og «Land · N besøk · X %». Trykk på samme land eller havet gir «N land · N besøk».
  Forklaringen 0 → maks står nede til høyre.
- **Data:** attributtet `land` på toppland-sensoren (`[{ kode: 'NO', besok: 3120 }, …]`, ISO alpha-2), oversatt til ISO
  numerisk med en innebygd tabell. `XX`/`T1` hoppes over.
  - Landnavn kommer fra `Intl.DisplayNames` og følger språket.
  - Kan ikke geometrien lastes, vises «Kunne ikke laste kartet».
- **HA-siden:** REST-spørringen `_land` i `packages/ki_cloudflare.yaml` må gi attributtet `land` (`clientCountryName`,
  `limit: 250`, `sum { visits }`). State er uendret.
- **Test:** `node test/v6-check.mjs` del 8. Geometrien leveres fra `node_modules/world-atlas` i testen.

## Fiks 62 · Server: arildkristo.com (Cloudflare), ikon i fanene og «Tilpass server» (prompt v6)
Designfilen ligger i `design/Server v6.dc.html`.
- **1 · arildkristo.com** (`src/58c-server-cf.js`, `MSH.serverCF`): ny vert-fane etter qBittorrent. Den vises bare når
  Cloudflare-sensorene finnes. Sensorene finnes via `unique_id` `ki_arildkristo_*` (fra `hass.entities`, ellers
  `config/entity_registry/list` én gang) og deretter `sensor.ki_arild_kristo_<suffiks>`. Hver nøkkel kan overstyres med
  `overrides.cf_<nøkkel>` i Avansert → «arildkristo.com (Cloudflare)».
  - Chip «Tilkoblet», eller oransje «Feil i spørring» når en status-sensor ikke er `ok`.
  - Toppkortet viser Besøk, Forespørsler og Data (MB). Kort-velgeren viser «N besøk · 24 t».
  - Prosa: «arildkristo.com har hatt … besøk og … forespørsler siste 24 timer.»
- **Underfaner:**
  - Trafikk: veksleren «Siste 24 t / I dag».
  - Besøk: Besøkende, Toppland og Mest besøkte sider. Listene leses fra `"Navn 123 · Navn 45"`, med søyle relativt til
    den største.
  - Ytelse: Svartid og feil, og Hurtiglager med målere.
  - Sikkerhet: Sikkerhet og DNS.
  - Flisene ligger i 2 kolonner, etikettene brytes, og trykk åpner more-info. `unavailable`/`none` vises som «–», og et
    kort uten tilgjengelige sensorer skjules.
- **Historikk:** `recorder/statistics_during_period` med `period: day`.
  - Periode 7 d / 30 d / 90 d / 1 år (52 uker), lagret i `localStorage['ki-cf-periode']`. Siste søyle har full farge,
    resten 55 %. Trykk viser dato og verdi.
  - Tellere viser sum og «snitt § / dag» (over 1000 MB vises som GB). ms/% viser snitt og «maks §», og en uke er snitt.
  - Dataene mellomlagres i 5 min og hentes bare når fanen vises.
- **Statuslinje** per underfane: grønn «Cloudflare · N spørringer ok · oppdateres hvert 30. min», eller oransje varsel med
  feilteksten.
- **2 · Ikon i vert-fanene:** 18 px ikon foran navnet med 6 px mellomrom, i tekstfargen. Standardikoner: Nettverk `router`,
  Proxmox `view_in_ar`, Unraid `dns`, HA `home`, qBittorrent `download`, arildkristo.com `language`. Kort-velgeren bruker
  samme ikon.
- **3 · «Tilpass server»:** tannhjulet åpner et ark øverst i popupen (portalt, mørk bakgrunn; utenfor, ✕ eller Esc lukker).
  - «Faner viser» (`tab_mode`): Ikon og navn / Navn på valgt fane / Bare ikoner. En fane med bare ikon har min-bredde lik
    fanehøyde + 8 og `title` = navnet.
  - «Ikon per server» (`host_icons`): 18 ikoner i 6 kolonner, og «Tilbakestill» vises når ikonet er endret.
  - Lagres i kortets config (speilet i `localStorage['ki-server-tilpass']`). Samme valg finnes i GUI-editoren
    (Visning → «Faner viser», Faner → «Ikon per server»).
  - «Flere innstillinger» åpner hele «Tilpass Server»-arket som før.
- **Språk:** engelsk for alt nytt (`src/00-a-lang-en-15.js`). Test: `node test/v6-check.mjs`.

## Fiks 61 · Onboarding v2, servere, strømpris, hurtigpanel og Ringeopptak (prompt v5)
Designfilene ligger i `design/` (Onboarding v2, Ringeopptak, Hurtigpanel, Strømpriser, Ringeklokke og ny Hjem v3).
- **1 · Servere** (`src/06-server.js`, `src/20-hjem-header.js`): pil, meny og bytteknapp vises bare når det finnes mer enn én
  server. Hvert sted kan ha en adresse (`url`), som brukes utenfor Companion-appen. Stedene redigeres i «Tilpass header» og i
  «Tilpass alt» → Servere (første rad = denne serveren).
- **2 · «Tilpass alt» v2** (`src/54b-tilpass-v2.js`): veiviser i 13 steg som erstatter den gamle oversikten og
  første oppstart. Prikkene er klikkbare, «n av 13» viser alle steg, og siste steg har «Endre» per steg. Valgene skrives
  straks til samme config som kortene leser (header, header-profil, navbar, fanekortet, prosa, Søppel, power_price,
  kiosk, enhetsoppsett), så endringene vises med en gang. Den gamle koden finnes som `openOnboardingV1` / `openTilpassAltV1`.
- **3 · Strømpris** (`src/15-strompris-kilde.js`, `26`, `29`, `61`): «Kortet viser» Nord Pool + Norgespris / bare Nord Pool /
  statisk pris (sensor eller fast verdi, «Fast pris» og «Statisk pris»), valuta kr / $ / € / egen med hundredel (øre, cent
  eller egen) på grafaksen. Samme valg i «Tilpass Hjem» → Popups → Strømpris, GUI-editoren og Strøm-popupen → Visning →
  «Prisgraf». Lagring sender `hjem-price`, og kortet og popupen tegnes på nytt.
- **4 · Hurtigpanel**: varsellista scroller jevnt – panelet tar over dragget bare helt øverst (dra ned) eller helt nederst
  (dra opp). Bakgrunnen låses mens panelet er åpent (html/body overflow hidden, overscroll none), og touchmove/hjul
  utenfor `[data-qs-scroll]` stoppes.
- **5 · Lys-søk**: søkefelt øverst i «Slideren styrer» (ID og navn, maks 30 treff), «Bruk denne entiteten» for en gyldig ukjent
  `light.*`. Slideren kaller `light.turn_on` med `brightness_pct`, og `light.turn_off` på 0.
- **6 · Hint**: «Vis hint øverst» i sveip-innstillingene (`hurtigpanel-cfg.hint`), og «Tilbakestill» slår det på igjen.
- **7 · Ringeopptak** (`src/50b-ringeopptak.js`): modal med Video (spill av, spoling, klokkeslett) og Bilder (+0/+2/+4/+6 s),
  merker (Person, Pakke), Se live, Lagre og Del. Åpnes fra ringevarselet i hurtigpanelet («Se opptak», play-merke), fra
  «Opptak» i ringekortet på Hjem og fra det nye «tapt ringing»-kortet. Det vises når ringekortet går ut uten å bli avvist,
  og X fjerner det. Kildene er `rec_clip` og `rec_snaps` i Ringeklokke-kortet, ellers `/local/ringeklokke/klipp.mp4` og
  `bilde_0–3.jpg` eller `image.*`. Mangler fil, vises en plassholder.
- **Språk**: engelsk for alt nytt (`src/00-a-lang-en-14.js`). Test: `node test/v5-check.mjs`.

## Fiks 60 · Rom-slidere, Vær på Android, Planter/Søvn/3D-printer (prompt v4)
- **1 · Gardin-/markise-slidere i Rom** (`src/31-rom.js`): navnet bestemmer bredden og kuttes aldri. I hovedraden er navnet
  `flex: 0 1 auto; max-width: 60 %` og slideren `flex: 1 1 96px; min-width: 96px`. Underradene ligger i ett felles grid
  (`fit-content(60%) minmax(96px, 1fr) auto`, radene `display: contents`), så alle sliderne starter og slutter likt; et langt navn
  gir kortere slidere for alle radene.
- **2 · Vær på Android** (`src/48-vaer.js`, `src/10-navbar.js`): på Android åpnes Vær alltid som vanlig popup (klassisk, ark,
  navbar og mini-spiller synlige), uansett lagret stil – valget lagres fortsatt. Navbaren skjules i `#vaer` bare når værscenen
  faktisk vises (`MSH.vaerScene()`), også på PC/iPad/iPhone med stilen «Klassisk». Merknad i «Tilpass alt» → Vær.
- **3 · Nye popups** (designfilene ligger i `design/`):
  - **Planter** `#planter` (`src/65-planter.js`, `msh-planter-card`): status, neste vanning, Enkel/Avansert, jordfukt med målbånd,
    Lys/Temp/Næring og «Merk som vannet». Autokonfig fra KI Planter (`binary_sensor.<plante>_trenger_vann`), `plant.*` og
    enheter med jordfukt-sensor. Erstatter den importerte `#planter` (`ki-planter-pro-card`).
  - **Søvn** `#sovn` (`src/66-sovn.js`, `msh-sovn-card`): ring per person, hvem sover, Søvn/Vekking, siste 24 timer (historikk
    ved åpning, 5 min cache), vekketid ±15 min, på/av og ukedager.
  - **3D-printer** `#3d-printer` (`src/67-printer.js`, `msh-printer-card`): status, fremdrift, kamera, Pause/Fortsett/Stopp/Lys/
    Strøm, «Skriv ut siste jobb», temperaturer, Avansert og filament (CFS/AMS). `#3d` er alias.
  - Alle tre står i «Mer»-menyen (bare når popupen finnes) og i popup-listene, og er med i `examples/dashboard.yaml`.
    PC/Datamaskiner står fortsatt i `GONE` til designet er klart.
- **4 · Lik bakgrunn:** de nye kortene har gjennomsiktig rot (popupens #282828); de eksisterende hadde det fra før.
- **5 · Mini-spiller** (`src/10-navbar.js`): radio/kanal (`media_content_type` radio/channel) eller uten varighet → ingen
  tidslinje i det utvidede kortet (124 px). Retter også en gammel feil der pause-timeren overskrev den utvidede spilleren.
- **Språk:** engelsk for alt nytt (`src/00-a-lang-en-13.js`); alle kort tegnes på nytt ved språkbytte, så `kiT()`-tekst følger med.
- Test: `node test/v4-check.mjs`.

## Fiks 59 · Språk (norsk / engelsk)
Designordbøkene (`i18n-en*.js`) finnes ikke i repoet – den engelske ordboken er bygget fra tekstene i `src/` og alle
testkortene (≈ 5 000 oppføringer, britisk engelsk, «Tilpass» = «Customize»).
- **Motor** (`src/00-a-i18n.js`, `M.i18n`): norsk er kildespråket. API `window.kiLang()`, `kiSetLang('en'|'no')`
  (localStorage `ki-lang` + hendelsen `ki-lang`), `kiT('Norsk', 'English')` / `kiT('Norsk')`. Valget lagres også per
  HA-bruker i ki-store (`lang`); standard følger `hass.language` (nb/nn/no → norsk, ellers engelsk). Synk mellom faner
  via `storage`, `<html lang="nb|en">`.
- **Oversettelse i DOM:** én MutationObserver per KI-shadow-root (+ `ki-overlay-root`) oversetter tekstnoder og
  `placeholder`/`title`/`aria-label`; originalteksten huskes (WeakMap), så bytte tilbake til norsk gir nøyaktig
  originalen uten omlasting. Oppslag tåler store/små bokstaver, ikoner foran, tegnsetting bak, sammensatte tekster
  (` · `, ` – `, ` / `, `, `, `: `, « og ») og variabler (`§` for tall og navn: «Skjul §», «Lys · § av § på»).
  Dato-ord (ukedager, måneder, i dag/i morgen) oversettes. `data-noi18n` og entitets-ID-er/URL-er/YAML røres ikke.
  Mangler oversettelse → norsk (dev: `MSH.i18n.missing`).
- **Språkvalg:** første steg i onboarding («Språk / Language», gjelder straks), øverste rad i «Tilpass Hjem»
  («Språk · Language») og Norsk/English-segment i Stue-redigering. Funksjons-popupenes navn i strategien oversettes og
  bygges på nytt ved bytte.
- Ordbok: `src/00-a-lang-en-01.js` … `-12.js` (`MSH.i18n.add({...})`). Test: `node test/i18n59-check.mjs`
  (`I18N_MISSING=<fil>` skriver tekster uten oversettelse).

## Fiks 58 · Hurtigpanel (nedtrekk) og Stue-dashbord v2
Designfilene (`Hurtigpanel.dc.html`, `Stue dashboard v2.dc.html`) finnes ikke i repoet – bygget etter prompt-teksten.
- **A · Hurtigpanel** (`src/11-hurtigpanel.js`, `M.hurtig`): nedtrekkspanel på Hjem (`msh-hjem-card`), portalt til
  `ki-overlay-root` og plassert mot dashbordflaten. Bare aktivt i Hjem uten åpen popup, Tilpass-ark eller tastatur; lukkes
  hvis det slutter å være aktivt. Hint-strek øverst (`show_hint`).
  - Åpne-gest: siden helt øverst og i ro i `rest` ms (scroll opp og fortsett samme bevegelse åpner ikke), startsone
    kant/øvre/overalt, ikke fra vannrette karuseller/inputfelt, dy > 10 og loddrett, dødsone, åpner over
    `min(open, panelhøyde − 40)`, forbi panelhøyde + 90 → rett i nivå 2. Touch via touch-events, mus via pointer-events,
    musehjul med terskel og sperre mot etterskli (+160 ms per hjul-event).
  - To nivåer: runde fliser → «Alle lys»-slider, 8 fliser i rutenett og minispiller (dra ned/opp, terskel 0,3 / 0,7; dra
    videre opp > 90 px lukker). Lukk også med scrim, Esc og musehjul.
  - Fliser autokonfigureres (ingen hardkodede ID-er) og kan byttes/ordnes/skjules; skript/scener vises aldri som aktive.
    Gjeste-Wi-Fi på → QR fra UniFi (`image.*qr*`) + «Slå av».
  - Varsler: ringeklokke, hvitevarer, dyr strømtime (+ utsett/lad Tesla), Tesla lader, støvsuger utilgjengelig, søppel i
    morgen og `persistent_notification` (abonnement bare mens panelet er åpent). Sveip > 110 px fjerner (huskes),
    «Fjern alle». Listen får plassen som er igjen på skjermen.
  - Sveip-innstillinger (tune-knappen) i `localStorage['hurtigpanel-cfg']` per enhet, «Tilbakestill».
    Panelconfig (`hurtigpanel:` i Hjem-kortet) i GUI-editoren og via «rediger fliser».
- **B · Stue-dashbord v2** (`src/64-stue.js`, `msh-stue-card`): header (klokke 80 px, vær → #vaer, statuspiller, avatarer,
  prosa med chip-lenker), felles fanelinje (glass + hold og dra, `tab_order` i config, `start_tab`), nattmodus-kort
  (følger `input_boolean`, «Slå av»), scener, Plex nylig lagt til, termostat (bytt, Varme/Auto/Av, 15–28 °C), spiller nå
  med prikker, gardiner/markise som slidere, lys (trykk = av/på, sideveis dra = lysstyrke), hvit dock. Nedtrekkspanelet
  er samme komponent (`variant: 'nettbrett'`, delt/sentrert, skjermens lysstyrke, skjerm av) – gestlogikken finnes ett sted.
  Strategien: `stue: true` gir visningen `/stue` med kortet + de samme popupene.
- **2b · oppdateringer i Stue og Hurtigpanel:**
  - «Tilpass alt» / onboarding → Denne enheten: forhåndsvalget **Stue-tablet** (miniatyr: navbar til venstre, header,
    scener, tre kolonner) lagres i `localStorage['ki-device-preset'] = 'stue'`, slår på visningen `/stue` (ki-store
    `stue.enabled`) og sender enheten dit ved oppstart (én gang per økt).
  - Stue: hvit navbar til venstre (fast, 92 px, mot dashbordflaten; snarveier + `tune` → `#settings`), innholdet i full
    bredde (padding 14/20/40/126). Scener 132 px / r40 med strek øverst.
  - Markise og gardiner som utvidbare kort: hovedslider (snittet, setter alle delene), 0/25/50/75/100 %, gardiner med en
    slider per del (cover-gruppe eller flere gardiner i rommet).
  - Lys: «+ Legg til lys»-velger (stua først, «Tilbakestill»/«Ferdig»), utvalg og rekkefølge i config `lights`.
  - «Tilpass» (dra og slipp) i Hjem-fanen: redigeringsfelt med øye-chips, overlegg per kort, spøkelse som følger pekeren,
    masonry (8 px-rader, row dense, ResizeObserver; ≥1080 → 3 kolonner, ≥700 → 2). Lagres i config `layout`
    (`{ cols, hidden }`, ikke localStorage – config er sannheten). Nedtrekkspanelet er av i redigeringsmodus.
  - Panelet: rAF-batching under dra (`M.rs` / `M.flushRs`), blur bare når panelet ligger åpent og ikke dras, lys-slider
    med valg av mål (alle som er på / Alle lys i stua / område / enkeltlampe – `localStorage` `hurtigpanel-lys` /
    `stue-panel-lys`, standard `light_entity` i panelconfigen), musehjul åpner ikke inne i en container som er scrollet ned.
- Test: `node test/hurtig58-check.mjs` (ekte touch via CDP: alle akseptansekriteriene + 2b).

## Ytelse på Android («tregt og tungt»)
- **Bygg:** `build.mjs` minifiserer hver fil i `src/` for seg med esbuild (mellomrom, kommentarer, syntaks – navnene beholdes,
  target es2022 = ingen senking av syntaks). Hver fil står fortsatt i egen try/catch; banner/versjonssjekk/`KI_MSH_VERSION`
  er uminifisert øverst. `dist/ki-msh.js` 5,1 MB → 3,7 MB (gzip 1,5 → 1,15 MB). `node build.mjs --dev` gir uminifisert
  `dist/ki-msh.dev.js`. esbuild er devDependency (`npm install`).
- **Ytelsesmodus** (`src/00-b-perf.js`, `MSH.perf`): på Android (UA) og svake berøringsenheter (deviceMemory ≤ 2, ikke Apple)
  skrus backdrop-filter av overalt (kort, Tilpass-ark, navbar-portalen og Bubble-popupene: `--custom-popup-filter` → none,
  dvs. bg_blur 0), glassflater får sin «uten blur»-reserve (samme som `@supports not`), og evige animasjoner kjøres én
  runde. `<html data-ki-perf="lite">` + `--ki-perf: lite`; reglene står i `@container style(--ki-perf: lite)`, så av/på
  virker uten omlasting. iPhone/PC: av – nøyaktig samme CSS som før. Valg per enhet: Mer → Tilpass → Enheter (og #settings):
  «Ytelsesmodus · Auto / På / Av» (`localStorage['ki-perf']`).
- **Tegning:** `MSH.all` gjenbruker den sorterte domenelisten (bare entiteter med nytt state-objekt sjekkes på nytt),
  `_changed` teller states én gang per runde, Hjem-låseflisene søker ikke lenger gjennom alle automatiseringer
  (`M.lasLocks`), ringeklokke-søket sorterer ikke alle states ved hver oppdatering, header-søsken (søvn/hjemme) via
  `MSH.all`, og navbaren tegnes ikke på nytt når dashbordflaten bare vokser i høyden.
- Temaets MutationObserver per popup kobles bare til i lys modus.
- Måling + krav: `test/perf-check.mjs` (`npm run perf`, CPU ×6, 390×844, touch; median av 2): tegning ved 20
  effekt-oppdateringer 1458 → 748 ms (TBT 1173 → 457), TBT ved lasting 4270 → 3845 ms (Android 3591), tomgang på Hjem
  (Android) 7 359 → 179 oppgaver / 10 s, blur i åpne popups 19 → 0 elementer (Android).

## Fiks 37 · Servervelger («Bytt sted») med logikk fra family-status-card
- Ny felles hjelper `MSH.servervelger` (`src/06-server.js`; `MSH.server` er Server-kortets): parsing av `servere`
  (streng «Oslo, Strömstad=Strømstad, Toten» eller liste med navn/server/ikon/farge/sti), gjenkjenning (`server_navn`,
  ellers `location_name` med ö→ø/ä→æ), URL `homeassistant://navigate/<sti>?server=<navn>` (navnet kodes bare for & ? # %
  og mellomrom) åpnet med `window.open` (aldri `location.href`), `server_plass` tittel/under/navn, `server_meny_med`,
  gester (trykk i click, hold 500 ms → Tilpass uten handling, dobbelttrykk 320 ms), `greeting_*_action`, og menyen
  (portalt lag over dashbordflaten, 260 px ark med spiss, «Bytt sted», «Du er her», «Tilpass …», Esc, lys/mørk).
- Hjem-headeren bruker den; ingen standardsteder lenger (uten servere: ingen meny, ingen pil). Pila skjules først når
  navnet ikke får plass. Eldre `servers`/`this_server`/`place_name`/`title_actions` leses og skrives om én gang.
- Tilpass header → Steder og GUI-editoren har det nye skjemaet. Test: `test/server37-check.mjs` (+ oppdaterte
  header31/header34/fiks21-flis-sted/header-check).

## Basseng: popupene er slettet
- Strategien lager ingen bassengpopup lenger – verken `#badebasseng` eller `#basseng` (`FUNCTION_POPUPS` og vilkåret i
  `04-strategy.js` er fjernet), og ingen rom-popup for et område som heter «Basseng»/«Pool» (`MSH.ROOM_BLOCK`/`roomBlocked`).
  Navbarens innebygde basseng-knapp (`CAT`/`DEF`/`POPS`) er fjernet, og onboarding foreslår den ikke.
- Gamle/importerte bassengpopups i dashbord-configen droppes av strategien (`MSH.POPUP_DROP.basseng` i `mergePopups`,
  `report.dropped`) i stedet for å tas over (POPUP_ALIAS/SUPERSEDE/MIGRATE/EXTRA for basseng er fjernet). Hash-omdirigeringen
  `#basseng` → `#badebasseng` er fjernet.
- Engangsmigrering av ki-store (`migrations.basseng_fjernet`, logget): alle bassengpopups i `custom_popups`,
  `popup_overrides`/`popups` for basseng/badebasseng/pool/svommebasseng, navbar-knappen «basseng» og lenker til
  bassenghashene i kortconfigene fjernes. Admin: Lovelace-ressursene `ki-basseng-card.js`/`ki-basseng-hero-card.js` slettes.
- `msh-basseng-card` finnes fortsatt og kan legges manuelt i en egen popup (README → Manuelt: Basseng i en egen popup,
  kommentert eksempel nederst i `examples/dashboard.yaml`); alias-elementene `ki-basseng-card`/`ki-basseng-hero-card` står.

## 30.1 / 31.3 – Basseng: én popup · Vær: fast høyde i «Neste timer»
- Basseng: nøyaktig ÉN popup `#badebasseng` (card_id `pop-basseng` beholdes); `#basseng`/`#pool`/`#svommebasseng` er alias
  (`MSH.HASH_ALIAS`, `history.replaceState`). 28.14-tvillingen er fjernet. Engangsmigrering av ki-store (custom_popups,
  popup_overrides, popups, lenker i kortconfigene) med logg; gamle Lovelace-ressurser og service worker-cache ryddes;
  alias-elementer for `ki-basseng-card`/`ki-basseng-hero-card`. Se README → Oppdatering og cache.
- Vær «Neste timer»: kolonnene er 152 px (border-box) i alle tre fanene, faste px-høyder, vindgrafen absolutt nederst –
  ingen høydeendring ved fanebytte (iOS WebKit og Chrome).

## 29 – Innstillinger: brytere fra KI Varslinger + KI Energi
- Ny felles modul `src/06-varsling-kilde.js` (`MSH.finnBrytere`, `KI_VARS_TEKST`, `KI_VARS_IKON`, `kiVarsErMaster`):
  datalogikken fra `ki-varsling-card` flyttet uendret – kilden er entitetsregisteret (`switch`/`input_boolean`, standard
  `ki_notifications` + `ki_energi`, KI Energi bare varslingsbryterne, én hovedbryter per regel). Innstillinger har ingen
  egen kopi lenger.
- Innstillinger (`#settings`): fanene er `faner: [{ key, name, icon, plattform, enheter, ikke_enheter, bare, ekstra }]`
  (én fane = én ki-varsling-card-config). Standard: Sikkerhet (kjente regler) · Hjem (resten) · Strøm (KI Energi).
  `tabs`/`custom_tabs`/`rows.include` leses fortsatt og migreres ved første lagring. Trykk = toggle (optimistisk +
  tilbakerulling), hold 500 ms = more-info, utilgjengelig = dempet «Svarer ikke». Tomt: «Velg integrasjoner».
- Tilpass → Faner: per fane Integrasjoner (alle plattformer med brytere, flest først), Bare disse / Ikke disse med
  «Viser N brytere», Ekstra brytere og Visning – også i «Legg til fane». GUI-editoren: ett ha-form per fane med ekko-vakt.

## 28 – Kamera-navn og Basseng-cache (1.3.0)
- Kamera: eget navn per kamera (`names: { camera.x: Navn }`) i «Tilpass kameraer» og GUI-editoren – brukt på fliser, chips,
  enkeltvisning, hendelser og Frigate. Standardnavn fra enheten → området → navnet uten «High resolution channel»;
  like navn får kanal/modell («Ringeklokke · Pakke»). Ny `padT` (Fra popup-headeren, standard −10) på Direkte/Frigate-raden.
- Basseng: strategien lager `#basseng` og `#badebasseng` med ÉTT `msh-basseng-card`; gamle kort i importerte/overstyrte
  popups migreres (ki-store `popup_overrides` skrives om én gang). Basseng v3 er utgått.
- Versjon 1.3.0. **Etter oppdatering: sett `?v=1.3.0` på ressursen og tøm cachen** (hard omlasting / «Tilbakestill
  frontend-hurtigbuffer» i Companion-appen) – se README → Oppdatering og cache. Konsollen advarer når en gammel kopi kjører.

## 26 – Server v5, Basseng 4a, Varmepumpe, Hjem-header og GitHub-dokumentasjon
- Server (`#server`) bygget om: toppkort alltid synlig, underfaner, Nettverk/Proxmox/Unraid, autokonfig med manuelt valg;
  popupen lages også når bare UniFi Protect finnes.
- Navbar: popup-velgeren kan scrolles; Tesla v3 og Sir Sweeps v3 rettet mot designet, kartet kan panoreres med én finger.
- Vanning: «Hvor gikk vannet» vises alltid. Basseng: ett kort med autokonfigurerte hurtigknapper.
- Innstillinger (`#settings`): «Tilpass Innstillinger» som designet og animert Privatmodus.
- Alle Tilpass-ark dekker navbaren; kiosk-arket har samme design.
- Mellomrom under Bubble-headeren: −10 px i alle popups (`popup_header_gap`, per popup i Tilpass Hjem → Popups);
  `gap-card` med høyde 0 øverst fjernes.
- Gjøremål: rediger og kopier tekst. Rom: «Tilpass rommet»-knappen nederst er av som standard.
- Ny popup: Varmepumpe (`#varmepumpe`, NIBE).
- Hjem-header: «👋 Navn!» + menu-down på én linje, avatarer 80 px side om side (56 px under 420 px, maks 3 + «+N»),
  statusmerker etter sone/tilstand; trykk = hurtigark, langt trykk = person-popup.
- Vær: to stiler å velge mellom, og Vær-scenen i Bubble Card.
- README med ikon og skjermbilder, `hacs.json`, `info.md` og denne endringsloggen.

## 25 – Vanning ett kort, Søppel og Innstillinger
- Vanning tegner toppkortet selv (ett kort). Ny Søppel-popup (`#soppel`, avfallsfraksjoner og varsler).
- Ny Innstillinger-popup (natt-/privatmodus, automasjoner, varsler og strøm). Sikkerhet rettet.

## 24 – Server v4, Tesla og Sir Sweeps
- Homelab-popupen (`#server`: UniFi, Proxmox VE, Unraid), Tesla (`#tesla`) og støvsugeren Sir Sweeps (`#rolf`).
- Liquid Glass-linsen får målene til den aktive fanen.

## 23 – Person-hurtigark, ledig flate og Kalender
- Person-hurtigarket i `ki-overlay-root` (avataren alltid synlig). Ledig flate rundt navbaren (`--ki-nav-occ-*`).
- Kart i fullskjerm, felles ikonfaner og ny Kalender-popup (`#kalender`).

## 22 – Kiosk, media og personhandlinger
- Kiosk-modus per enhet, spoling i mini-spilleren, handlinger på personbildene (trykk/dobbelttrykk/hold).

## 21 – Energi og ark
- Energi-popup (`#energi`) fra HAs Energi-oppsett. «Tilpass rom»-arket med søk i flyten.

## 20 – Kart, ark-design og status
- Kart-popup, nytt ark-design, glass-animasjonen avbrytes trygt, status og soner i headeren.

## 19 – Ringeklokke og header-profiler
- Ringeklokke-popup (UniFi Protect), header-profiler per bruker × enhet, trykk-feedback uten tap-highlight.

## 18 – Fold-oppsett og haptic per enhet
- Fold/iPad/PC-oppsett i én kolonne, haptic kan slås av per enhet, navbarens avstand per enhet.

## 17 – Hilsen-header og Liquid Glass
- «Hilsen»/«Sted» i headeren, Liquid Glass-navbar, Klima med blokker og mellomrom.

## 16 – Dørlås, maler og hui-card
- Dørlås-popup (`#dorlas`), button-card-/decluttering-maler, kompatibel med HAs `hui-card`.

## 15 – Robust rendering og egne popups
- Vernet rendering, utkast i Tilpass-arkene, egne og importerte popups i Tilpass Hjem.

## 1–14 – Grunnlaget
- Kortene, strategien `custom:ki-dashboard`, Tilpass-arkene, ki-store og popup-malene A og B.
