# Endringslogg

Én seksjon per fiks-prompt (nyeste først). Detaljer står i kommentarene i `src/` («Fiks NN.x») og i `docs/avvik.md`.

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
