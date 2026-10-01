# Endringslogg

Én seksjon per fiks-prompt (nyeste først). Detaljer står i kommentarene i `src/` («Fiks NN.x») og i `docs/avvik.md`.

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
