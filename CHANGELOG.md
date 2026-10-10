# Endringslogg

Én seksjon per fiks-prompt (nyeste først). Detaljer står i kommentarene i `src/` («Fiks NN.x») og i `docs/avvik.md`.

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
