# Config-nøkler per kort

Generert fra kortenes editor-skjema (`node test/docs.mjs`). Alle kort har i tillegg `card_id` (settes automatisk) og kan stå uten config – alt annet autokonfigureres.

## `msh-settings-card`

Innhold i #settings-popupen: snarveier til Tilpass Hjem/navbar/header og HA-innstillinger.

| Nøkkel | Betydning | Gruppe |
|---|---|---|
| `gap` | Mellom seksjonene · range | Mellomrom |
| `pad_top` | Fra popup-headeren til første kort · range | Mellomrom |
| `pad_bottom` | Luft i bunnen (over navbaren) · range | Mellomrom |

## `msh-navbar-card`

Flytende navbar utenfor popups: bunn på mobil, rail til venstre på bred skjerm. Åpner popups via hash, merker med vilkår, «Mer»-meny og liquid glass.

| Nøkkel | Betydning | Gruppe |
|---|---|---|
| `layout` | Oppsett (auto \| mobil \| stor) | Plassering og oppførsel |
| `reserve_space` | Gi innholdet plass (padding i bunnen / til venstre) · boolean | Plassering og oppførsel |
| `toasts` | Bekreftelsesmeldinger · boolean | Plassering og oppførsel |
| `admin_tools` | Vis «Tilpass» i Mer-menyen · boolean | Plassering og oppførsel |
| `action_style` | Handlingsvelger (ruter \| liste) | Plassering og oppførsel |

## `msh-gjoremal-card`

Alle todo.*-lister som faner: legg til, fullfør, slett, filtre og prioritet ([h]/[m]/[l] i beskrivelsen).

| Nøkkel | Betydning | Gruppe |
|---|---|---|
| `entities` | Lister i rekkefølge (tomt = alle todo.*) · entities |  |
| `exclude · include.{lister}` | skjul / legg til |  |
| `filter` | Standardfilter (open \| high \| done \| all) | Visning |
| `priority` | Prioritet Høy/Medium/Lav · boolean | Visning |
| `show_who` | Vis beskrivelse («hvem») og frist · boolean | Visning |
| `gap` | 4 / 8 / 18 px | Visning |
| `gap` | Mellom seksjonene · range | Mellomrom |
| `pad_top` | Fra popup-headeren til første kort · range | Mellomrom |
| `pad_bottom` | Luft i bunnen (over navbaren) · range | Mellomrom |

## `msh-person-hero-card`

Avatar (entity_picture), sone-glorie, sted og «siden». Første kort i #person-<id>.

| Nøkkel | Betydning | Gruppe |
|---|---|---|
| `person` | Person · entity |  |
| `name` | Navn |  |
| `color` | Avatarfarge (uten bilde) · color |  |
| `show_picture` | Vis bilde (entity_picture) · boolean |  |
| `overrides.{location}` | bytt entitet |  |

## `msh-person-card`

Skritt, distanse, søvn, mobil (batteri/lading/nett) og soner i dag for én person. Legg msh-person-hero-card først.

| Nøkkel | Betydning | Gruppe |
|---|---|---|
| `person` | Person · entity |  |
| `sections · hidden_sections` | rekkefølge/synlighet: stats, sleep, mobil, zones |  |
| `overrides.{battery, battery_state, charging, connection, ssid, steps, distance, focus, location, sleep_duration, sleep_score, sleep_start, sleep_awake, sleep_light, sleep_deep, sleep_rem}` | bytt entitet |  |
| `gap` | 4 / 8 / 18 px |  |
| `gap` | Mellom seksjonene · range | Mellomrom |
| `pad_top` | Fra popup-headeren til første kort · range | Mellomrom |
| `pad_bottom` | Luft i bunnen (over navbaren) · range | Mellomrom |

## `msh-hjem-header-card`

Hilsen, vær og personprofiler med soner, hurtigark og servermeny. Ligger på Hjem-visningen.

| Nøkkel | Betydning | Gruppe |
|---|---|---|
| `mode` | Oppsett (hilsen \| sted \| navn \| hjem \| stor \| profil) · modes |  |
| `kiosk_entity` | Kiosk-modus-entitet · entity | Handlinger på tittelen |
| `g_font` | Maks tekst · range | Størrelser |
| `g_avatar` | Bilder · range | Størrelser |
| `g_badge` | Merke · range | Størrelser |
| `g_gap` | Avstand (minus = overlapp) · range | Størrelser |
| `prose_gap` | Avstand til prosa · range | Størrelser |
| `pic_size` | Profilbilde · range | Størrelser |
| `persons_size` | Personer · range | Størrelser |
| `title_size` | Tittel · range | Størrelser |
| `prose_gap` | Avstand til prosa · range | Størrelser |
| `hFont` | Tekststørrelse (maks) · range | Størrelser |
| `hAv` | Bildestørrelse · range | Størrelser |
| `hBadge` | Merke (ikon-sirkel) · range | Størrelser |
| `hGap` | Mellom bildene · range | Størrelser |
| `hTGap` | Mellom tekst og bilder · range | Størrelser |
| `prose_gap` | Avstand til prosa · range | Størrelser |
| `prose_gap` | Avstand til prosa · range | Størrelser |
| `people` | Personer i headeren · rows | Personer |
| `zones` | Soner med eget ikon og farge · rows | Status og soner |
| `away_marker` | Borte · vis merke · boolean | Status og soner |
| `greeting` | Hilsen | Hilsen |
| `undertekst` | Undertekst (valgfri) | Hilsen |
| `size` | Størrelse (S \| M \| L) | Bilder |
| `badge` | Merke (icon \| dot \| ring \| none) | Bilder |
| `show_name` | Vis navn · boolean | Bilder |
| `show_place` | Vis sted · Hjemme, sonen eller Borte under bildet · boolean | Bilder |
| `ring_me` | Ring rundt meg · markerer bildet ditt · boolean | Bilder |
| `weather_tap` | Trykk på været åpner Vær · gjelder «Hjem» og «Profil» · boolean | Bilder |
| `weather_hash` | Vær-popup · hash | Bilder |
| `servere` | Bytt sted – Home Assistant-servere · rows | Steder |
| `server_navn` | Denne serverens navn (valgfri) | Steder |
| `server_sti` | Side som åpnes (valgfri) | Steder |
| `server_plass` | Hvor stedsnavnet står (tittel \| under \| navn) | Steder |
| `server_meny_med` | Menyen åpnes med (tap \| double_tap \| hold \| ingen) | Steder |
| `overrides.weather` | Vær · entity | Bytt entiteter |
| `people.0.home` | Cybele · hjemme · entity | Bytt entiteter |
| `people.0.sleep` | Cybele · søvn · entity | Bytt entiteter |
| `people.0.zone` | Cybele · sone når borte · boolean | Bytt entiteter |
| `people.1.home` | Emma · hjemme · entity | Bytt entiteter |
| `people.1.sleep` | Emma · søvn · entity | Bytt entiteter |
| `people.1.zone` | Emma · sone når borte · boolean | Bytt entiteter |
| `people.2.home` | Rune · hjemme · entity | Bytt entiteter |
| `people.2.sleep` | Rune · søvn · entity | Bytt entiteter |
| `people.2.zone` | Rune · sone når borte · boolean | Bytt entiteter |
| `people.3.home` | Sebastian · hjemme · entity | Bytt entiteter |
| `people.3.sleep` | Sebastian · søvn · entity | Bytt entiteter |
| `people.3.zone` | Sebastian · sone når borte · boolean | Bytt entiteter |

## `msh-prosa-card`

Setninger med live verdier i bobler (vær, strømpris, effekt, lys …) og handling per boble.

| Nøkkel | Betydning | Gruppe |
|---|---|---|
| `prose_font_size` | Tekststørrelse · range |  |
| `prose_line_height` | Linjehøyde · range |  |
| `rekkefolge · exclude` | rekkefølge/synlighet: vaer, hjemkomst, ringeklokke, apparater, planter, pris, setninger, bursdag |  |
| `vaer.entity` | Entitet · entity | Vær |
| `vaer.attributt` | Attributt (tom = tilstanden) | Vær |
| `vaer.enhet` | Enhet | Vær |
| `vaer.mellomrom` | Mellomrom mellom tall og enhet · boolean | Vær |
| `vaer.ikon` | Ikon · mdi:, emoji eller attributt:current.icon | Vær |
| `vaer.ikon_plassering` | Ikon i pillen (start \| slutt) | Vær |
| `vaer.små_bokstaver` | Små bokstaver · boolean | Vær |
| `vaer.tekst` | Tekstmal · {pille} er pillen | Vær |
| `vaer.path` | Trykk åpner popup · hash | Vær |
| `hjemkomst` | Personer på vei hjem · rows | Hjemkomst |
| `ringeklokke.entity` | Varsel aktiv (på/av) · entity | Ringeklokke |
| `ringeklokke.tekst` | Tekstmal · {pille} er pillen | Ringeklokke |
| `ringeklokke.animasjon` | Animasjon ( \| auto \| hopp \| vugg \| vink \| snurr \| puls) | Ringeklokke |
| `ringeklokke.path` | Trykk åpner popup (tom = slå av varselet) · hash | Ringeklokke |
| `apparater` | Apparater som går · rows | Apparater |
| `planter.auto` | Finn stedene automatisk (KI Planter) · boolean | Planter · KI Planter |
| `planter.tekst` | Tekstmal · {planter} {antall} {sted} | Planter · KI Planter |
| `planter.ikon` | Ikon (attributt:ikon = plantens eget) · icon | Planter · KI Planter |
| `planter.animasjon` | Animasjon ( \| auto \| hopp \| vugg \| vink \| snurr \| puls) | Planter · KI Planter |
| `planter.path` | Trykk åpner popup · hold = alle vannet · hash | Planter · KI Planter |
| `pris.entity` | Entitet · entity | Strømpris |
| `pris.tekst` | Tekstmal · {pille} er pillen | Strømpris |
| `pris.path` | Trykk åpner popup (tom = detaljer) · hash | Strømpris |
| `bursdag.vis` | Vises når (på/av) · entity | Bursdag |
| `bursdag.navn` | Navn (sensor med dagens bursdager) · entity | Bursdag |
| `bursdag.tekst` | Tekstmal · {pille} er pillen | Bursdag |
| `prose` | Setninger · rows |  |
| `overrides.{weather, temp, price, watt, lights, lock, alarm, trash, garage, tv, vacuum}` | bytt entitet |  |
| `exclude · include.{kalendere, lister}` | skjul / legg til |  |
| `price_high` | Strømpris rød over (kr) · number | Farger og popups |
| `price_mid` | Strømpris gul over (kr) · number | Farger og popups |
| `alarm_hash` | Alarm-popup (når kode kreves) · hash | Farger og popups |
| `toasts` | Bekreftelsesmeldinger · boolean | Farger og popups |

## `msh-soppel-card`

Dager til neste søppeltømming. Trykk og hold kan velges (popup, visning, more-info, tjeneste, URL).

| Nøkkel | Betydning | Gruppe |
|---|---|---|
| `tap_action` | Trykk · tap |  |
| `hold_action` | Hold · tap |  |
| `action_style` | Handlingsvelger (ruter \| liste) |  |
| `sensor` | Entitet · dager til tømming · entity |  |
| `type_sensor` | Sensor · type avfall (valgfri) · entity |  |
| `rosa` | Rosa på tømmedagen · boolean |  |
| `rosa_dager` | Rosa også dagen før (0 \| 1) |  |
| `tekst_i_dag` | Tittel · i dag (0) |  |
| `tekst_en` | Tittel · 1 dag |  |
| `tekst_flere` | Tittel · flere dager |  |
| `title` | Fast tittel (overstyrer de tre over) |  |
| `animate` | Animasjon · boolean |  |

## `msh-hjem-gjoremal-card`

Gjøremål fra alle todo.*-lister med avkrysning. Trykk åpner #gjoremal.

| Nøkkel | Betydning | Gruppe |
|---|---|---|
| `title` | Overskrift |  |
| `popup_hash` | Popup-hash · hash |  |
| `max_items` | Maks antall rader · number |  |
| `show_completed` | Vis ferdige gjøremål · boolean |  |
| `exclude · include.{lister}` | skjul / legg til |  |

## `msh-hjem-faner-card`

Fanerad (Hjem, etasjer, Aktuelt, Batterier) med sveipbare romkort, kortliste, snarveier, apparater og rom-varsler.

| Nøkkel | Betydning | Gruppe |
|---|---|---|
| `tab_order · tab_hidden` | rekkefølge/synlighet: hjem, forste, andre, ute, uten_etasje, aktuelt, batterier |  |
| `tab_labels.hjem` | Navn · Hjem | Faner |
| `tab_labels.forste` | Navn · 1. etg | Faner |
| `tab_labels.andre` | Navn · 2. etg | Faner |
| `tab_labels.ute` | Navn · Ute | Faner |
| `tab_labels.uten_etasje` | Navn · Andre rom | Faner |
| `tab_labels.aktuelt` | Navn · Aktuelt | Faner |
| `tab_labels.batterier` | Navn · Batterier | Faner |
| `tab_views.hjem` | Visning · Hjem (karusell \| liste \| batterier) | Faner |
| `tab_views.forste` | Visning · 1. etg (karusell \| liste \| batterier) | Faner |
| `tab_views.andre` | Visning · 2. etg (karusell \| liste \| batterier) | Faner |
| `tab_views.ute` | Visning · Ute (karusell \| liste \| batterier) | Faner |
| `tab_views.uten_etasje` | Visning · Andre rom (karusell \| liste \| batterier) | Faner |
| `tab_views.aktuelt` | Visning · Aktuelt (karusell \| liste \| batterier) | Faner |
| `custom_tabs` | Egne faner | Faner |
| `default_tab` | Startfane | Faner |
| `tab_height` | Høyde (std \| lav \| mid \| hoy \| ekstra \| custom) | Faner |
| `tab_width` | Bredde per fane (std \| kompakt \| full \| custom) | Faner |
| `tab_style` | Fanestil · stil (pille \| glide \| chips \| to \| popup \| gear) | Faner |
| `battery.limit` | Grense for lavt batteri (%) · number | Batterier |
| `battery.show` | Liste (lav \| alle) | Batterier |
| `battery.always` | Vis fanen alltid · boolean | Batterier |
| `battery.cond` | Vis fanen når denne er på · entity | Batterier |
| `appliance_animation` | Animasjon (full \| calm \| off) | Hvitevarer |
| `tabs.hjem.auto_fill` | Autofyll Hjem med alle rom · boolean | Rom og snarveier · Hjem |
| `layout.hjem.order · layout.hjem.hidden` | rekkefølge/synlighet: stue, soverom, kjokken, bad | Rom og snarveier · Hjem |
| `layout.hjem.side.stue` | Kolonne · Stue (L \| R) | Rom og snarveier · Hjem |
| `layout.hjem.side.soverom` | Kolonne · Soverom (L \| R) | Rom og snarveier · Hjem |
| `layout.hjem.side.kjokken` | Kolonne · Kjøkken (L \| R) | Rom og snarveier · Hjem |
| `layout.hjem.side.bad` | Kolonne · Bad (L \| R) | Rom og snarveier · Hjem |
| `slides.hjem.L.cal` | Sveip-kort · venstre karusell · Kalender · boolean | Rom og snarveier · Hjem |
| `slides.hjem.R.cal` | Sveip-kort · høyre karusell · Kalender · boolean | Rom og snarveier · Hjem |
| `slides.hjem.L.vaer` | Sveip-kort · venstre karusell · Vær · boolean | Rom og snarveier · Hjem |
| `slides.hjem.R.vaer` | Sveip-kort · høyre karusell · Vær · boolean | Rom og snarveier · Hjem |
| `slides.hjem.L.strom` | Sveip-kort · venstre karusell · Strøm · boolean | Rom og snarveier · Hjem |
| `slides.hjem.R.strom` | Sveip-kort · høyre karusell · Strøm · boolean | Rom og snarveier · Hjem |
| `slides.hjem.L.trash` | Sveip-kort · venstre karusell · Søppel · boolean | Rom og snarveier · Hjem |
| `slides.hjem.R.trash` | Sveip-kort · høyre karusell · Søppel · boolean | Rom og snarveier · Hjem |
| `carousel.hjem.L.dots` | Vis prikker · venstre karusell · boolean | Rom og snarveier · Hjem |
| `carousel.hjem.R.dots` | Vis prikker · høyre karusell · boolean | Rom og snarveier · Hjem |
| `tiles.hjem.lock.slot` | Snarvei · Dørlås (off \| L-top \| L-bottom \| R-top \| R-bottom) | Rom og snarveier · Hjem |
| `tiles.hjem.lock.stack` | Dørlås · sveip sammen med andre i samme plass · boolean | Rom og snarveier · Hjem |
| `tiles.hjem.lock.fra` | Dørlås · vis fra (MM-DD) | Rom og snarveier · Hjem |
| `tiles.hjem.lock.til` | Dørlås · vis til (MM-DD) | Rom og snarveier · Hjem |
| `tiles.hjem.garage.slot` | Snarvei · Garasjeport (off \| L-top \| L-bottom \| R-top \| R-bottom) | Rom og snarveier · Hjem |
| `tiles.hjem.alarm.slot` | Snarvei · Alarm (off \| L-top \| L-bottom \| R-top \| R-bottom) | Rom og snarveier · Hjem |
| `tiles.hjem.alarm.stack` | Alarm · sveip sammen med andre i samme plass · boolean | Rom og snarveier · Hjem |
| `tiles.hjem.alarm.fra` | Alarm · vis fra (MM-DD) | Rom og snarveier · Hjem |
| `tiles.hjem.alarm.til` | Alarm · vis til (MM-DD) | Rom og snarveier · Hjem |
| `tiles.hjem.cam.slot` | Snarvei · Kamera (off \| L-top \| L-bottom \| R-top \| R-bottom) | Rom og snarveier · Hjem |
| `tiles.hjem.cam.stack` | Kamera · sveip sammen med andre i samme plass · boolean | Rom og snarveier · Hjem |
| `tiles.hjem.cam.fra` | Kamera · vis fra (MM-DD) | Rom og snarveier · Hjem |
| `tiles.hjem.cam.til` | Kamera · vis til (MM-DD) | Rom og snarveier · Hjem |
| `tiles.hjem.ruter.slot` | Snarvei · Ruter (off \| L-top \| L-bottom \| R-top \| R-bottom) | Rom og snarveier · Hjem |
| `tiles.hjem.ruter.stack` | Ruter · sveip sammen med andre i samme plass · boolean | Rom og snarveier · Hjem |
| `tiles.hjem.ruter.fra` | Ruter · vis fra (MM-DD) | Rom og snarveier · Hjem |
| `tiles.hjem.ruter.til` | Ruter · vis til (MM-DD) | Rom og snarveier · Hjem |
| `tiles.hjem.todo.slot` | Snarvei · Gjøremål (off \| L-top \| L-bottom \| R-top \| R-bottom) | Rom og snarveier · Hjem |
| `tiles.hjem.todo.stack` | Gjøremål · sveip sammen med andre i samme plass · boolean | Rom og snarveier · Hjem |
| `tiles.hjem.todo.fra` | Gjøremål · vis fra (MM-DD) | Rom og snarveier · Hjem |
| `tiles.hjem.todo.til` | Gjøremål · vis til (MM-DD) | Rom og snarveier · Hjem |
| `tiles.hjem.dish.slot` | Snarvei · Oppvaskmaskin (off \| L-top \| L-bottom \| R-top \| R-bottom) | Rom og snarveier · Hjem |
| `tiles.hjem.vacr.slot` | Snarvei · Støvsuger (off \| L-top \| L-bottom \| R-top \| R-bottom) | Rom og snarveier · Hjem |
| `tiles.hjem.tv.slot` | Snarvei · TV (off \| L-top \| L-bottom \| R-top \| R-bottom) | Rom og snarveier · Hjem |
| `tiles.hjem.wash.slot` | Snarvei · Vaskemaskin (off \| L-top \| L-bottom \| R-top \| R-bottom) | Rom og snarveier · Hjem |
| `tiles.hjem.jul.slot` | Snarvei · Jul (off \| L-top \| L-bottom \| R-top \| R-bottom) | Rom og snarveier · Hjem |
| `swipe.hjem.R-bottom` | Sveip alle snarveier · Høyre · under rom · boolean | Rom og snarveier · Hjem |
| `tile_order.hjem · tile_hidden.hjem` | rekkefølge/synlighet: lock, alarm, cam, ruter, todo | Rom og snarveier · Hjem |
| `tabs.forste.auto_fill` | Autofyll fra HA-områder/etasjen · boolean | Rom og snarveier · 1. etg |
| `layout.forste.order · layout.forste.hidden` | rekkefølge/synlighet: bod, gang, kjokken, stue | Rom og snarveier · 1. etg |
| `layout.forste.add.a01` | Hent rom fra en annen etasje · area | Rom og snarveier · 1. etg |
| `layout.forste.side.bod` | Kolonne · Bod (L \| R) | Rom og snarveier · 1. etg |
| `layout.forste.side.gang` | Kolonne · Gang (L \| R) | Rom og snarveier · 1. etg |
| `layout.forste.side.kjokken` | Kolonne · Kjøkken (L \| R) | Rom og snarveier · 1. etg |
| `layout.forste.side.stue` | Kolonne · Stue (L \| R) | Rom og snarveier · 1. etg |
| `tiles.forste.lock.slot` | Snarvei · Dørlås (off \| L-top \| L-bottom \| R-top \| R-bottom) | Rom og snarveier · 1. etg |
| `tiles.forste.garage.slot` | Snarvei · Garasjeport (off \| L-top \| L-bottom \| R-top \| R-bottom) | Rom og snarveier · 1. etg |
| `tiles.forste.alarm.slot` | Snarvei · Alarm (off \| L-top \| L-bottom \| R-top \| R-bottom) | Rom og snarveier · 1. etg |
| `tiles.forste.cam.slot` | Snarvei · Kamera (off \| L-top \| L-bottom \| R-top \| R-bottom) | Rom og snarveier · 1. etg |
| `tiles.forste.ruter.slot` | Snarvei · Ruter (off \| L-top \| L-bottom \| R-top \| R-bottom) | Rom og snarveier · 1. etg |
| `tiles.forste.todo.slot` | Snarvei · Gjøremål (off \| L-top \| L-bottom \| R-top \| R-bottom) | Rom og snarveier · 1. etg |
| `tiles.forste.dish.slot` | Snarvei · Oppvaskmaskin (off \| L-top \| L-bottom \| R-top \| R-bottom) | Rom og snarveier · 1. etg |
| `tiles.forste.vacr.slot` | Snarvei · Støvsuger (off \| L-top \| L-bottom \| R-top \| R-bottom) | Rom og snarveier · 1. etg |
| `tiles.forste.tv.slot` | Snarvei · TV (off \| L-top \| L-bottom \| R-top \| R-bottom) | Rom og snarveier · 1. etg |
| `tiles.forste.wash.slot` | Snarvei · Vaskemaskin (off \| L-top \| L-bottom \| R-top \| R-bottom) | Rom og snarveier · 1. etg |
| `tiles.forste.jul.slot` | Snarvei · Jul (off \| L-top \| L-bottom \| R-top \| R-bottom) | Rom og snarveier · 1. etg |
| `tabs.andre.auto_fill` | Autofyll fra HA-områder/etasjen · boolean | Rom og snarveier · 2. etg |
| `layout.andre.order · layout.andre.hidden` | rekkefølge/synlighet: bad, kontor, soverom, vaskerom | Rom og snarveier · 2. etg |
| `layout.andre.add.a01` | Hent rom fra en annen etasje · area | Rom og snarveier · 2. etg |
| `layout.andre.side.bad` | Kolonne · Bad (L \| R) | Rom og snarveier · 2. etg |
| `layout.andre.side.kontor` | Kolonne · Kontor (L \| R) | Rom og snarveier · 2. etg |
| `layout.andre.side.soverom` | Kolonne · Soverom (L \| R) | Rom og snarveier · 2. etg |
| `layout.andre.side.vaskerom` | Kolonne · Vaskerom (L \| R) | Rom og snarveier · 2. etg |
| `tiles.andre.lock.slot` | Snarvei · Dørlås (off \| L-top \| L-bottom \| R-top \| R-bottom) | Rom og snarveier · 2. etg |
| `tiles.andre.garage.slot` | Snarvei · Garasjeport (off \| L-top \| L-bottom \| R-top \| R-bottom) | Rom og snarveier · 2. etg |
| `tiles.andre.alarm.slot` | Snarvei · Alarm (off \| L-top \| L-bottom \| R-top \| R-bottom) | Rom og snarveier · 2. etg |
| `tiles.andre.cam.slot` | Snarvei · Kamera (off \| L-top \| L-bottom \| R-top \| R-bottom) | Rom og snarveier · 2. etg |
| `tiles.andre.ruter.slot` | Snarvei · Ruter (off \| L-top \| L-bottom \| R-top \| R-bottom) | Rom og snarveier · 2. etg |
| `tiles.andre.todo.slot` | Snarvei · Gjøremål (off \| L-top \| L-bottom \| R-top \| R-bottom) | Rom og snarveier · 2. etg |
| `tiles.andre.dish.slot` | Snarvei · Oppvaskmaskin (off \| L-top \| L-bottom \| R-top \| R-bottom) | Rom og snarveier · 2. etg |
| `tiles.andre.vacr.slot` | Snarvei · Støvsuger (off \| L-top \| L-bottom \| R-top \| R-bottom) | Rom og snarveier · 2. etg |
| `tiles.andre.tv.slot` | Snarvei · TV (off \| L-top \| L-bottom \| R-top \| R-bottom) | Rom og snarveier · 2. etg |
| `tiles.andre.wash.slot` | Snarvei · Vaskemaskin (off \| L-top \| L-bottom \| R-top \| R-bottom) | Rom og snarveier · 2. etg |
| `tiles.andre.jul.slot` | Snarvei · Jul (off \| L-top \| L-bottom \| R-top \| R-bottom) | Rom og snarveier · 2. etg |
| `tabs.ute.auto_fill` | Autofyll fra HA-områder/etasjen · boolean | Rom og snarveier · Ute |
| `layout.ute.order · layout.ute.hidden` | rekkefølge/synlighet: basseng, hage | Rom og snarveier · Ute |
| `layout.ute.add.a01` | Hent rom fra en annen etasje · area | Rom og snarveier · Ute |
| `layout.ute.side.basseng` | Kolonne · Basseng (L \| R) | Rom og snarveier · Ute |
| `layout.ute.side.hage` | Kolonne · Hage (L \| R) | Rom og snarveier · Ute |
| `tiles.ute.lock.slot` | Snarvei · Dørlås (off \| L-top \| L-bottom \| R-top \| R-bottom) | Rom og snarveier · Ute |
| `tiles.ute.garage.slot` | Snarvei · Garasjeport (off \| L-top \| L-bottom \| R-top \| R-bottom) | Rom og snarveier · Ute |
| `tiles.ute.alarm.slot` | Snarvei · Alarm (off \| L-top \| L-bottom \| R-top \| R-bottom) | Rom og snarveier · Ute |
| `tiles.ute.cam.slot` | Snarvei · Kamera (off \| L-top \| L-bottom \| R-top \| R-bottom) | Rom og snarveier · Ute |
| `tiles.ute.ruter.slot` | Snarvei · Ruter (off \| L-top \| L-bottom \| R-top \| R-bottom) | Rom og snarveier · Ute |
| `tiles.ute.todo.slot` | Snarvei · Gjøremål (off \| L-top \| L-bottom \| R-top \| R-bottom) | Rom og snarveier · Ute |
| `tiles.ute.dish.slot` | Snarvei · Oppvaskmaskin (off \| L-top \| L-bottom \| R-top \| R-bottom) | Rom og snarveier · Ute |
| `tiles.ute.vacr.slot` | Snarvei · Støvsuger (off \| L-top \| L-bottom \| R-top \| R-bottom) | Rom og snarveier · Ute |
| `tiles.ute.tv.slot` | Snarvei · TV (off \| L-top \| L-bottom \| R-top \| R-bottom) | Rom og snarveier · Ute |
| `tiles.ute.wash.slot` | Snarvei · Vaskemaskin (off \| L-top \| L-bottom \| R-top \| R-bottom) | Rom og snarveier · Ute |
| `tiles.ute.jul.slot` | Snarvei · Jul (off \| L-top \| L-bottom \| R-top \| R-bottom) | Rom og snarveier · Ute |
| `tabs.uten_etasje.auto_fill` | Autofyll fra HA-områder/etasjen · boolean | Rom og snarveier · Andre rom |
| `layout.uten_etasje.order · layout.uten_etasje.hidden` | rekkefølge/synlighet: garasje | Rom og snarveier · Andre rom |
| `layout.uten_etasje.add.a01` | Hent rom fra en annen etasje · area | Rom og snarveier · Andre rom |
| `layout.uten_etasje.side.garasje` | Kolonne · Garasje (L \| R) | Rom og snarveier · Andre rom |
| `tiles.uten_etasje.lock.slot` | Snarvei · Dørlås (off \| L-top \| L-bottom \| R-top \| R-bottom) | Rom og snarveier · Andre rom |
| `tiles.uten_etasje.garage.slot` | Snarvei · Garasjeport (off \| L-top \| L-bottom \| R-top \| R-bottom) | Rom og snarveier · Andre rom |
| `tiles.uten_etasje.alarm.slot` | Snarvei · Alarm (off \| L-top \| L-bottom \| R-top \| R-bottom) | Rom og snarveier · Andre rom |
| `tiles.uten_etasje.cam.slot` | Snarvei · Kamera (off \| L-top \| L-bottom \| R-top \| R-bottom) | Rom og snarveier · Andre rom |
| `tiles.uten_etasje.ruter.slot` | Snarvei · Ruter (off \| L-top \| L-bottom \| R-top \| R-bottom) | Rom og snarveier · Andre rom |
| `tiles.uten_etasje.todo.slot` | Snarvei · Gjøremål (off \| L-top \| L-bottom \| R-top \| R-bottom) | Rom og snarveier · Andre rom |
| `tiles.uten_etasje.dish.slot` | Snarvei · Oppvaskmaskin (off \| L-top \| L-bottom \| R-top \| R-bottom) | Rom og snarveier · Andre rom |
| `tiles.uten_etasje.vacr.slot` | Snarvei · Støvsuger (off \| L-top \| L-bottom \| R-top \| R-bottom) | Rom og snarveier · Andre rom |
| `tiles.uten_etasje.tv.slot` | Snarvei · TV (off \| L-top \| L-bottom \| R-top \| R-bottom) | Rom og snarveier · Andre rom |
| `tiles.uten_etasje.wash.slot` | Snarvei · Vaskemaskin (off \| L-top \| L-bottom \| R-top \| R-bottom) | Rom og snarveier · Andre rom |
| `tiles.uten_etasje.jul.slot` | Snarvei · Jul (off \| L-top \| L-bottom \| R-top \| R-bottom) | Rom og snarveier · Andre rom |
| `layout.aktuelt.side.bod` | Kolonne · Bod (L \| R) | Rom og snarveier · Aktuelt |
| `layout.aktuelt.side.gang` | Kolonne · Gang (L \| R) | Rom og snarveier · Aktuelt |
| `layout.aktuelt.side.kjokken` | Kolonne · Kjøkken (L \| R) | Rom og snarveier · Aktuelt |
| `layout.aktuelt.side.stue` | Kolonne · Stue (L \| R) | Rom og snarveier · Aktuelt |
| `layout.aktuelt.side.bad` | Kolonne · Bad (L \| R) | Rom og snarveier · Aktuelt |
| `layout.aktuelt.side.kontor` | Kolonne · Kontor (L \| R) | Rom og snarveier · Aktuelt |
| `layout.aktuelt.side.soverom` | Kolonne · Soverom (L \| R) | Rom og snarveier · Aktuelt |
| `layout.aktuelt.side.vaskerom` | Kolonne · Vaskerom (L \| R) | Rom og snarveier · Aktuelt |
| `layout.aktuelt.side.basseng` | Kolonne · Basseng (L \| R) | Rom og snarveier · Aktuelt |
| `layout.aktuelt.side.hage` | Kolonne · Hage (L \| R) | Rom og snarveier · Aktuelt |
| `layout.aktuelt.side.garasje` | Kolonne · Garasje (L \| R) | Rom og snarveier · Aktuelt |
| `tiles.aktuelt.lock.slot` | Snarvei · Dørlås (off \| L-top \| L-bottom \| R-top \| R-bottom) | Rom og snarveier · Aktuelt |
| `tiles.aktuelt.garage.slot` | Snarvei · Garasjeport (off \| L-top \| L-bottom \| R-top \| R-bottom) | Rom og snarveier · Aktuelt |
| `tiles.aktuelt.alarm.slot` | Snarvei · Alarm (off \| L-top \| L-bottom \| R-top \| R-bottom) | Rom og snarveier · Aktuelt |
| `tiles.aktuelt.cam.slot` | Snarvei · Kamera (off \| L-top \| L-bottom \| R-top \| R-bottom) | Rom og snarveier · Aktuelt |
| `tiles.aktuelt.ruter.slot` | Snarvei · Ruter (off \| L-top \| L-bottom \| R-top \| R-bottom) | Rom og snarveier · Aktuelt |
| `tiles.aktuelt.todo.slot` | Snarvei · Gjøremål (off \| L-top \| L-bottom \| R-top \| R-bottom) | Rom og snarveier · Aktuelt |
| `tiles.aktuelt.jul.slot` | Snarvei · Jul (off \| L-top \| L-bottom \| R-top \| R-bottom) | Rom og snarveier · Aktuelt |
| `tiles.hjem.lock.slot` | Plassering (L-top \| R-top \| L-bottom \| R-bottom) | Snarveier · soner, entitet og handlinger › Venstre · over rommene › Dørlås |
| `tile_cfg.lock.entity` | Entitet · entity | Snarveier · soner, entitet og handlinger › Venstre · over rommene › Dørlås |
| `tile_cfg.lock.name` | Navn | Snarveier · soner, entitet og handlinger › Venstre · over rommene › Dørlås |
| `tile_cfg.lock.icon` | Ikon · icon | Snarveier · soner, entitet og handlinger › Venstre · over rommene › Dørlås |
| `tile_cfg.lock.sub` | Undertekst | Snarveier · soner, entitet og handlinger › Venstre · over rommene › Dørlås |
| `tile_cfg.lock.state_text.locked.title` | locked · tittel | Snarveier · soner, entitet og handlinger › Venstre · over rommene › Dørlås › Tekst per tilstand |
| `tile_cfg.lock.state_text.locked.sub` | locked · undertekst | Snarveier · soner, entitet og handlinger › Venstre · over rommene › Dørlås › Tekst per tilstand |
| `tile_cfg.lock.state_text.unlocked.title` | unlocked · nå · tittel | Snarveier · soner, entitet og handlinger › Venstre · over rommene › Dørlås › Tekst per tilstand |
| `tile_cfg.lock.state_text.unlocked.sub` | unlocked · undertekst | Snarveier · soner, entitet og handlinger › Venstre · over rommene › Dørlås › Tekst per tilstand |
| `tile_cfg.lock.state_text.locking.title` | locking · tittel | Snarveier · soner, entitet og handlinger › Venstre · over rommene › Dørlås › Tekst per tilstand |
| `tile_cfg.lock.state_text.locking.sub` | locking · undertekst | Snarveier · soner, entitet og handlinger › Venstre · over rommene › Dørlås › Tekst per tilstand |
| `tile_cfg.lock.state_text.unlocking.title` | unlocking · tittel | Snarveier · soner, entitet og handlinger › Venstre · over rommene › Dørlås › Tekst per tilstand |
| `tile_cfg.lock.state_text.unlocking.sub` | unlocking · undertekst | Snarveier · soner, entitet og handlinger › Venstre · over rommene › Dørlås › Tekst per tilstand |
| `tile_cfg.lock.state_text.open.title` | open · tittel | Snarveier · soner, entitet og handlinger › Venstre · over rommene › Dørlås › Tekst per tilstand |
| `tile_cfg.lock.state_text.open.sub` | open · undertekst | Snarveier · soner, entitet og handlinger › Venstre · over rommene › Dørlås › Tekst per tilstand |
| `tile_cfg.lock.state_text.opening.title` | opening · tittel | Snarveier · soner, entitet og handlinger › Venstre · over rommene › Dørlås › Tekst per tilstand |
| `tile_cfg.lock.state_text.opening.sub` | opening · undertekst | Snarveier · soner, entitet og handlinger › Venstre · over rommene › Dørlås › Tekst per tilstand |
| `tile_cfg.lock.state_text.jammed.title` | jammed · tittel | Snarveier · soner, entitet og handlinger › Venstre · over rommene › Dørlås › Tekst per tilstand |
| `tile_cfg.lock.state_text.jammed.sub` | jammed · undertekst | Snarveier · soner, entitet og handlinger › Venstre · over rommene › Dørlås › Tekst per tilstand |
| `tile_cfg.lock.state_text.unavailable.title` | unavailable · tittel | Snarveier · soner, entitet og handlinger › Venstre · over rommene › Dørlås › Tekst per tilstand |
| `tile_cfg.lock.state_text.unavailable.sub` | unavailable · undertekst | Snarveier · soner, entitet og handlinger › Venstre · over rommene › Dørlås › Tekst per tilstand |
| `tile_cfg.lock.state_text.unknown.title` | unknown · tittel | Snarveier · soner, entitet og handlinger › Venstre · over rommene › Dørlås › Tekst per tilstand |
| `tile_cfg.lock.state_text.unknown.sub` | unknown · undertekst | Snarveier · soner, entitet og handlinger › Venstre · over rommene › Dørlås › Tekst per tilstand |
| `tile_cfg.lock.popup_hash` | Popup (popup_hash) · trykk på kortet · hash | Snarveier · soner, entitet og handlinger › Venstre · over rommene › Dørlås |
| `tile_cfg.lock.tap_icon` | Trykk på ikonet · tap | Snarveier · soner, entitet og handlinger › Venstre · over rommene › Dørlås |
| `tile_cfg.lock.tap_card` | Trykk på kortet · tap | Snarveier · soner, entitet og handlinger › Venstre · over rommene › Dørlås |
| `tile_cfg.lock.hold_icon` | Hold på ikonet · tap | Snarveier · soner, entitet og handlinger › Venstre · over rommene › Dørlås |
| `tile_cfg.lock.hold_card` | Hold på kortet · tap | Snarveier · soner, entitet og handlinger › Venstre · over rommene › Dørlås |
| `tiles.hjem.alarm.slot` | Plassering (L-top \| R-top \| L-bottom \| R-bottom) | Snarveier · soner, entitet og handlinger › Venstre · under rommene › Alarm |
| `tile_cfg.alarm.entity` | Entitet · entity | Snarveier · soner, entitet og handlinger › Venstre · under rommene › Alarm |
| `tile_cfg.alarm.name` | Navn | Snarveier · soner, entitet og handlinger › Venstre · under rommene › Alarm |
| `tile_cfg.alarm.icon` | Ikon · icon | Snarveier · soner, entitet og handlinger › Venstre · under rommene › Alarm |
| `tile_cfg.alarm.sub` | Undertekst | Snarveier · soner, entitet og handlinger › Venstre · under rommene › Alarm |
| `tile_cfg.alarm.state_text.disarmed.title` | disarmed · nå · tittel | Snarveier · soner, entitet og handlinger › Venstre · under rommene › Alarm › Tekst per tilstand |
| `tile_cfg.alarm.state_text.disarmed.sub` | disarmed · undertekst | Snarveier · soner, entitet og handlinger › Venstre · under rommene › Alarm › Tekst per tilstand |
| `tile_cfg.alarm.state_text.armed_home.title` | armed_home · tittel | Snarveier · soner, entitet og handlinger › Venstre · under rommene › Alarm › Tekst per tilstand |
| `tile_cfg.alarm.state_text.armed_home.sub` | armed_home · undertekst | Snarveier · soner, entitet og handlinger › Venstre · under rommene › Alarm › Tekst per tilstand |
| `tile_cfg.alarm.state_text.armed_away.title` | armed_away · tittel | Snarveier · soner, entitet og handlinger › Venstre · under rommene › Alarm › Tekst per tilstand |
| `tile_cfg.alarm.state_text.armed_away.sub` | armed_away · undertekst | Snarveier · soner, entitet og handlinger › Venstre · under rommene › Alarm › Tekst per tilstand |
| `tile_cfg.alarm.state_text.armed_night.title` | armed_night · tittel | Snarveier · soner, entitet og handlinger › Venstre · under rommene › Alarm › Tekst per tilstand |
| `tile_cfg.alarm.state_text.armed_night.sub` | armed_night · undertekst | Snarveier · soner, entitet og handlinger › Venstre · under rommene › Alarm › Tekst per tilstand |
| `tile_cfg.alarm.state_text.armed_vacation.title` | armed_vacation · tittel | Snarveier · soner, entitet og handlinger › Venstre · under rommene › Alarm › Tekst per tilstand |
| `tile_cfg.alarm.state_text.armed_vacation.sub` | armed_vacation · undertekst | Snarveier · soner, entitet og handlinger › Venstre · under rommene › Alarm › Tekst per tilstand |
| `tile_cfg.alarm.state_text.armed_custom_bypass.title` | armed_custom_bypass · tittel | Snarveier · soner, entitet og handlinger › Venstre · under rommene › Alarm › Tekst per tilstand |
| `tile_cfg.alarm.state_text.armed_custom_bypass.sub` | armed_custom_bypass · undertekst | Snarveier · soner, entitet og handlinger › Venstre · under rommene › Alarm › Tekst per tilstand |
| `tile_cfg.alarm.state_text.arming.title` | arming · tittel | Snarveier · soner, entitet og handlinger › Venstre · under rommene › Alarm › Tekst per tilstand |
| `tile_cfg.alarm.state_text.arming.sub` | arming · undertekst | Snarveier · soner, entitet og handlinger › Venstre · under rommene › Alarm › Tekst per tilstand |
| `tile_cfg.alarm.state_text.pending.title` | pending · tittel | Snarveier · soner, entitet og handlinger › Venstre · under rommene › Alarm › Tekst per tilstand |
| `tile_cfg.alarm.state_text.pending.sub` | pending · undertekst | Snarveier · soner, entitet og handlinger › Venstre · under rommene › Alarm › Tekst per tilstand |
| `tile_cfg.alarm.state_text.triggered.title` | triggered · tittel | Snarveier · soner, entitet og handlinger › Venstre · under rommene › Alarm › Tekst per tilstand |
| `tile_cfg.alarm.state_text.triggered.sub` | triggered · undertekst | Snarveier · soner, entitet og handlinger › Venstre · under rommene › Alarm › Tekst per tilstand |
| `tile_cfg.alarm.state_text.unavailable.title` | unavailable · tittel | Snarveier · soner, entitet og handlinger › Venstre · under rommene › Alarm › Tekst per tilstand |
| `tile_cfg.alarm.state_text.unavailable.sub` | unavailable · undertekst | Snarveier · soner, entitet og handlinger › Venstre · under rommene › Alarm › Tekst per tilstand |
| `tile_cfg.alarm.state_text.unknown.title` | unknown · tittel | Snarveier · soner, entitet og handlinger › Venstre · under rommene › Alarm › Tekst per tilstand |
| `tile_cfg.alarm.state_text.unknown.sub` | unknown · undertekst | Snarveier · soner, entitet og handlinger › Venstre · under rommene › Alarm › Tekst per tilstand |
| `tile_cfg.alarm.tap_icon` | Trykk på ikonet · tap | Snarveier · soner, entitet og handlinger › Venstre · under rommene › Alarm |
| `tile_cfg.alarm.tap_card` | Trykk på kortet · tap | Snarveier · soner, entitet og handlinger › Venstre · under rommene › Alarm |
| `tile_cfg.alarm.hold_icon` | Hold på ikonet · tap | Snarveier · soner, entitet og handlinger › Venstre · under rommene › Alarm |
| `tile_cfg.alarm.hold_card` | Hold på kortet · tap | Snarveier · soner, entitet og handlinger › Venstre · under rommene › Alarm |
| `swipe.hjem.R-bottom` | Swipe · ett kort om gangen, sveip for neste · boolean | Snarveier · soner, entitet og handlinger › Høyre · under rommene |
| `tiles.hjem.cam.slot` | Plassering (L-top \| R-top \| L-bottom \| R-bottom) | Snarveier · soner, entitet og handlinger › Høyre · under rommene › Kamera |
| `tile_cfg.cam.entity` | Entitet · entity | Snarveier · soner, entitet og handlinger › Høyre · under rommene › Kamera |
| `tile_cfg.cam.name` | Navn | Snarveier · soner, entitet og handlinger › Høyre · under rommene › Kamera |
| `tile_cfg.cam.icon` | Ikon · icon | Snarveier · soner, entitet og handlinger › Høyre · under rommene › Kamera |
| `tile_cfg.cam.sub` | Undertekst | Snarveier · soner, entitet og handlinger › Høyre · under rommene › Kamera |
| `tile_cfg.cam.active.mode` | Utløsere (any \| all) | Snarveier · soner, entitet og handlinger › Høyre · under rommene › Kamera |
| `tile_cfg.cam.active.triggers.0.entity` | Utløser 1 · entitet · entity | Snarveier · soner, entitet og handlinger › Høyre · under rommene › Kamera |
| `tile_cfg.cam.active.hold_min` | Hold aktiv i (min etter at utløseren slutter) · number | Snarveier · soner, entitet og handlinger › Høyre · under rommene › Kamera |
| `tile_cfg.cam.active.quiet.from` | Stille-periode fra (ikke aktiver) | Snarveier · soner, entitet og handlinger › Høyre · under rommene › Kamera |
| `tile_cfg.cam.active.quiet.to` | Stille-periode til | Snarveier · soner, entitet og handlinger › Høyre · under rommene › Kamera |
| `tile_cfg.cam.active.style` | Stil (tint \| solid \| pink \| icon) | Snarveier · soner, entitet og handlinger › Høyre · under rommene › Kamera |
| `tile_cfg.cam.active.color` | Farge · color | Snarveier · soner, entitet og handlinger › Høyre · under rommene › Kamera |
| `tile_cfg.cam.active.icon` | Ikon når aktiv · icon | Snarveier · soner, entitet og handlinger › Høyre · under rommene › Kamera |
| `tile_cfg.cam.active.pulse` | Puls rundt ikonet · boolean | Snarveier · soner, entitet og handlinger › Høyre · under rommene › Kamera |
| `tile_cfg.cam.active.sub_active` | Undertekst mens aktiv | Snarveier · soner, entitet og handlinger › Høyre · under rommene › Kamera |
| `tile_cfg.cam.active.sub_after` | Undertekst i holdetiden | Snarveier · soner, entitet og handlinger › Høyre · under rommene › Kamera |
| `tile_cfg.cam.active.on_activate` | Ved aktivering (none \| haptic \| popup \| top) | Snarveier · soner, entitet og handlinger › Høyre · under rommene › Kamera |
| `tile_cfg.cam.state_text.on.title` | on · tittel | Snarveier · soner, entitet og handlinger › Høyre · under rommene › Kamera › Tekst per tilstand |
| `tile_cfg.cam.state_text.on.sub` | on · undertekst | Snarveier · soner, entitet og handlinger › Høyre · under rommene › Kamera › Tekst per tilstand |
| `tile_cfg.cam.state_text.off.title` | off · tittel | Snarveier · soner, entitet og handlinger › Høyre · under rommene › Kamera › Tekst per tilstand |
| `tile_cfg.cam.state_text.off.sub` | off · undertekst | Snarveier · soner, entitet og handlinger › Høyre · under rommene › Kamera › Tekst per tilstand |
| `tile_cfg.cam.state_text.unavailable.title` | unavailable · tittel | Snarveier · soner, entitet og handlinger › Høyre · under rommene › Kamera › Tekst per tilstand |
| `tile_cfg.cam.state_text.unavailable.sub` | unavailable · undertekst | Snarveier · soner, entitet og handlinger › Høyre · under rommene › Kamera › Tekst per tilstand |
| `tile_cfg.cam.state_text.unknown.title` | unknown · tittel | Snarveier · soner, entitet og handlinger › Høyre · under rommene › Kamera › Tekst per tilstand |
| `tile_cfg.cam.state_text.unknown.sub` | unknown · undertekst | Snarveier · soner, entitet og handlinger › Høyre · under rommene › Kamera › Tekst per tilstand |
| `tile_cfg.cam.tap_icon` | Trykk på ikonet · tap | Snarveier · soner, entitet og handlinger › Høyre · under rommene › Kamera |
| `tile_cfg.cam.tap_card` | Trykk på kortet · tap | Snarveier · soner, entitet og handlinger › Høyre · under rommene › Kamera |
| `tile_cfg.cam.hold_icon` | Hold på ikonet · tap | Snarveier · soner, entitet og handlinger › Høyre · under rommene › Kamera |
| `tile_cfg.cam.hold_card` | Hold på kortet · tap | Snarveier · soner, entitet og handlinger › Høyre · under rommene › Kamera |
| `tiles.hjem.ruter.slot` | Plassering (L-top \| R-top \| L-bottom \| R-bottom) | Snarveier · soner, entitet og handlinger › Høyre · under rommene › Ruter |
| `tile_cfg.ruter.entity` | Stopp (Entur-sensor) · entity | Snarveier · soner, entitet og handlinger › Høyre · under rommene › Ruter |
| `tile_cfg.ruter.name` | Navn | Snarveier · soner, entitet og handlinger › Høyre · under rommene › Ruter |
| `tile_cfg.ruter.icon` | Ikon · icon | Snarveier · soner, entitet og handlinger › Høyre · under rommene › Ruter |
| `tile_cfg.ruter.avvik_entity` | Avvik-sensor (valgfri) · entity | Snarveier · soner, entitet og handlinger › Høyre · under rommene › Ruter |
| `tile_cfg.ruter.show_next` | Vis neste etter («, deretter 7 min») · boolean | Snarveier · soner, entitet og handlinger › Høyre · under rommene › Ruter |
| `tile_cfg.ruter.sub_format` | Undertekst · format | Snarveier · soner, entitet og handlinger › Høyre · under rommene › Ruter |
| `tile_cfg.ruter.tap_icon` | Trykk på ikonet · tap | Snarveier · soner, entitet og handlinger › Høyre · under rommene › Ruter |
| `tile_cfg.ruter.tap_card` | Trykk på kortet · tap | Snarveier · soner, entitet og handlinger › Høyre · under rommene › Ruter |
| `tile_cfg.ruter.hold_icon` | Hold på ikonet · tap | Snarveier · soner, entitet og handlinger › Høyre · under rommene › Ruter |
| `tile_cfg.ruter.hold_card` | Hold på kortet · tap | Snarveier · soner, entitet og handlinger › Høyre · under rommene › Ruter |
| `tiles.hjem.todo.slot` | Plassering (L-top \| R-top \| L-bottom \| R-bottom) | Snarveier · soner, entitet og handlinger › Høyre · under rommene › Gjøremål |
| `tile_cfg.todo.entity` | Entitet · entity | Snarveier · soner, entitet og handlinger › Høyre · under rommene › Gjøremål |
| `tile_cfg.todo.name` | Navn | Snarveier · soner, entitet og handlinger › Høyre · under rommene › Gjøremål |
| `tile_cfg.todo.icon` | Ikon · icon | Snarveier · soner, entitet og handlinger › Høyre · under rommene › Gjøremål |
| `tile_cfg.todo.sub` | Undertekst | Snarveier · soner, entitet og handlinger › Høyre · under rommene › Gjøremål |
| `tile_cfg.todo.tap_icon` | Trykk på ikonet · tap | Snarveier · soner, entitet og handlinger › Høyre · under rommene › Gjøremål |
| `tile_cfg.todo.tap_card` | Trykk på kortet · tap | Snarveier · soner, entitet og handlinger › Høyre · under rommene › Gjøremål |
| `tile_cfg.todo.hold_icon` | Hold på ikonet · tap | Snarveier · soner, entitet og handlinger › Høyre · under rommene › Gjøremål |
| `tile_cfg.todo.hold_card` | Hold på kortet · tap | Snarveier · soner, entitet og handlinger › Høyre · under rommene › Gjøremål |
| `tiles.hjem.garage.slot` | Plassering (L-top \| R-top \| L-bottom \| R-bottom) | Snarveier · soner, entitet og handlinger › Ikke på Hjem › Garasjeport |
| `tile_cfg.garage.entity` | Entitet · entity | Snarveier · soner, entitet og handlinger › Ikke på Hjem › Garasjeport |
| `tile_cfg.garage.name` | Navn | Snarveier · soner, entitet og handlinger › Ikke på Hjem › Garasjeport |
| `tile_cfg.garage.icon` | Ikon · icon | Snarveier · soner, entitet og handlinger › Ikke på Hjem › Garasjeport |
| `tile_cfg.garage.sub` | Undertekst | Snarveier · soner, entitet og handlinger › Ikke på Hjem › Garasjeport |
| `tile_cfg.garage.state_text.closed.title` | closed · nå · tittel | Snarveier · soner, entitet og handlinger › Ikke på Hjem › Garasjeport › Tekst per tilstand |
| `tile_cfg.garage.state_text.closed.sub` | closed · undertekst | Snarveier · soner, entitet og handlinger › Ikke på Hjem › Garasjeport › Tekst per tilstand |
| `tile_cfg.garage.state_text.open.title` | open · tittel | Snarveier · soner, entitet og handlinger › Ikke på Hjem › Garasjeport › Tekst per tilstand |
| `tile_cfg.garage.state_text.open.sub` | open · undertekst | Snarveier · soner, entitet og handlinger › Ikke på Hjem › Garasjeport › Tekst per tilstand |
| `tile_cfg.garage.state_text.opening.title` | opening · tittel | Snarveier · soner, entitet og handlinger › Ikke på Hjem › Garasjeport › Tekst per tilstand |
| `tile_cfg.garage.state_text.opening.sub` | opening · undertekst | Snarveier · soner, entitet og handlinger › Ikke på Hjem › Garasjeport › Tekst per tilstand |
| `tile_cfg.garage.state_text.closing.title` | closing · tittel | Snarveier · soner, entitet og handlinger › Ikke på Hjem › Garasjeport › Tekst per tilstand |
| `tile_cfg.garage.state_text.closing.sub` | closing · undertekst | Snarveier · soner, entitet og handlinger › Ikke på Hjem › Garasjeport › Tekst per tilstand |
| `tile_cfg.garage.state_text.unavailable.title` | unavailable · tittel | Snarveier · soner, entitet og handlinger › Ikke på Hjem › Garasjeport › Tekst per tilstand |
| `tile_cfg.garage.state_text.unavailable.sub` | unavailable · undertekst | Snarveier · soner, entitet og handlinger › Ikke på Hjem › Garasjeport › Tekst per tilstand |
| `tile_cfg.garage.state_text.unknown.title` | unknown · tittel | Snarveier · soner, entitet og handlinger › Ikke på Hjem › Garasjeport › Tekst per tilstand |
| `tile_cfg.garage.state_text.unknown.sub` | unknown · undertekst | Snarveier · soner, entitet og handlinger › Ikke på Hjem › Garasjeport › Tekst per tilstand |
| `tile_cfg.garage.popup_hash` | Popup (popup_hash) · trykk på kortet · hash | Snarveier · soner, entitet og handlinger › Ikke på Hjem › Garasjeport |
| `tile_cfg.garage.tap_icon` | Trykk på ikonet · tap | Snarveier · soner, entitet og handlinger › Ikke på Hjem › Garasjeport |
| `tile_cfg.garage.tap_card` | Trykk på kortet · tap | Snarveier · soner, entitet og handlinger › Ikke på Hjem › Garasjeport |
| `tile_cfg.garage.hold_icon` | Hold på ikonet · tap | Snarveier · soner, entitet og handlinger › Ikke på Hjem › Garasjeport |
| `tile_cfg.garage.hold_card` | Hold på kortet · tap | Snarveier · soner, entitet og handlinger › Ikke på Hjem › Garasjeport |
| `tiles.hjem.dish.slot` | Plassering (L-top \| R-top \| L-bottom \| R-bottom) | Snarveier · soner, entitet og handlinger › Ikke på Hjem › Oppvaskmaskin |
| `tile_cfg.dish.entity` | Entitet · entity | Snarveier · soner, entitet og handlinger › Ikke på Hjem › Oppvaskmaskin |
| `tile_cfg.dish.name` | Navn | Snarveier · soner, entitet og handlinger › Ikke på Hjem › Oppvaskmaskin |
| `tile_cfg.dish.icon` | Ikon · icon | Snarveier · soner, entitet og handlinger › Ikke på Hjem › Oppvaskmaskin |
| `tile_cfg.dish.sub` | Undertekst | Snarveier · soner, entitet og handlinger › Ikke på Hjem › Oppvaskmaskin |
| `tile_cfg.dish.tap_icon` | Trykk på ikonet · tap | Snarveier · soner, entitet og handlinger › Ikke på Hjem › Oppvaskmaskin |
| `tile_cfg.dish.tap_card` | Trykk på kortet · tap | Snarveier · soner, entitet og handlinger › Ikke på Hjem › Oppvaskmaskin |
| `tile_cfg.dish.hold_icon` | Hold på ikonet · tap | Snarveier · soner, entitet og handlinger › Ikke på Hjem › Oppvaskmaskin |
| `tile_cfg.dish.hold_card` | Hold på kortet · tap | Snarveier · soner, entitet og handlinger › Ikke på Hjem › Oppvaskmaskin |
| `tiles.hjem.vacr.slot` | Plassering (L-top \| R-top \| L-bottom \| R-bottom) | Snarveier · soner, entitet og handlinger › Ikke på Hjem › Støvsuger |
| `tile_cfg.vacr.entity` | Entitet · entity | Snarveier · soner, entitet og handlinger › Ikke på Hjem › Støvsuger |
| `tile_cfg.vacr.name` | Navn | Snarveier · soner, entitet og handlinger › Ikke på Hjem › Støvsuger |
| `tile_cfg.vacr.icon` | Ikon · icon | Snarveier · soner, entitet og handlinger › Ikke på Hjem › Støvsuger |
| `tile_cfg.vacr.sub` | Undertekst | Snarveier · soner, entitet og handlinger › Ikke på Hjem › Støvsuger |
| `tile_cfg.vacr.state_text.cleaning.title` | cleaning · nå · tittel | Snarveier · soner, entitet og handlinger › Ikke på Hjem › Støvsuger › Tekst per tilstand |
| `tile_cfg.vacr.state_text.cleaning.sub` | cleaning · undertekst | Snarveier · soner, entitet og handlinger › Ikke på Hjem › Støvsuger › Tekst per tilstand |
| `tile_cfg.vacr.state_text.docked.title` | docked · tittel | Snarveier · soner, entitet og handlinger › Ikke på Hjem › Støvsuger › Tekst per tilstand |
| `tile_cfg.vacr.state_text.docked.sub` | docked · undertekst | Snarveier · soner, entitet og handlinger › Ikke på Hjem › Støvsuger › Tekst per tilstand |
| `tile_cfg.vacr.state_text.paused.title` | paused · tittel | Snarveier · soner, entitet og handlinger › Ikke på Hjem › Støvsuger › Tekst per tilstand |
| `tile_cfg.vacr.state_text.paused.sub` | paused · undertekst | Snarveier · soner, entitet og handlinger › Ikke på Hjem › Støvsuger › Tekst per tilstand |
| `tile_cfg.vacr.state_text.returning.title` | returning · tittel | Snarveier · soner, entitet og handlinger › Ikke på Hjem › Støvsuger › Tekst per tilstand |
| `tile_cfg.vacr.state_text.returning.sub` | returning · undertekst | Snarveier · soner, entitet og handlinger › Ikke på Hjem › Støvsuger › Tekst per tilstand |
| `tile_cfg.vacr.state_text.idle.title` | idle · tittel | Snarveier · soner, entitet og handlinger › Ikke på Hjem › Støvsuger › Tekst per tilstand |
| `tile_cfg.vacr.state_text.idle.sub` | idle · undertekst | Snarveier · soner, entitet og handlinger › Ikke på Hjem › Støvsuger › Tekst per tilstand |
| `tile_cfg.vacr.state_text.error.title` | error · tittel | Snarveier · soner, entitet og handlinger › Ikke på Hjem › Støvsuger › Tekst per tilstand |
| `tile_cfg.vacr.state_text.error.sub` | error · undertekst | Snarveier · soner, entitet og handlinger › Ikke på Hjem › Støvsuger › Tekst per tilstand |
| `tile_cfg.vacr.state_text.unavailable.title` | unavailable · tittel | Snarveier · soner, entitet og handlinger › Ikke på Hjem › Støvsuger › Tekst per tilstand |
| `tile_cfg.vacr.state_text.unavailable.sub` | unavailable · undertekst | Snarveier · soner, entitet og handlinger › Ikke på Hjem › Støvsuger › Tekst per tilstand |
| `tile_cfg.vacr.state_text.unknown.title` | unknown · tittel | Snarveier · soner, entitet og handlinger › Ikke på Hjem › Støvsuger › Tekst per tilstand |
| `tile_cfg.vacr.state_text.unknown.sub` | unknown · undertekst | Snarveier · soner, entitet og handlinger › Ikke på Hjem › Støvsuger › Tekst per tilstand |
| `tile_cfg.vacr.tap_icon` | Trykk på ikonet · tap | Snarveier · soner, entitet og handlinger › Ikke på Hjem › Støvsuger |
| `tile_cfg.vacr.tap_card` | Trykk på kortet · tap | Snarveier · soner, entitet og handlinger › Ikke på Hjem › Støvsuger |
| `tile_cfg.vacr.hold_icon` | Hold på ikonet · tap | Snarveier · soner, entitet og handlinger › Ikke på Hjem › Støvsuger |
| `tile_cfg.vacr.hold_card` | Hold på kortet · tap | Snarveier · soner, entitet og handlinger › Ikke på Hjem › Støvsuger |
| `tiles.hjem.tv.slot` | Plassering (L-top \| R-top \| L-bottom \| R-bottom) | Snarveier · soner, entitet og handlinger › Ikke på Hjem › TV |
| `tile_cfg.tv.entity` | Entitet · entity | Snarveier · soner, entitet og handlinger › Ikke på Hjem › TV |
| `tile_cfg.tv.name` | Navn | Snarveier · soner, entitet og handlinger › Ikke på Hjem › TV |
| `tile_cfg.tv.icon` | Ikon · icon | Snarveier · soner, entitet og handlinger › Ikke på Hjem › TV |
| `tile_cfg.tv.sub` | Undertekst | Snarveier · soner, entitet og handlinger › Ikke på Hjem › TV |
| `tile_cfg.tv.state_text.on.title` | on · tittel | Snarveier · soner, entitet og handlinger › Ikke på Hjem › TV › Tekst per tilstand |
| `tile_cfg.tv.state_text.on.sub` | on · undertekst | Snarveier · soner, entitet og handlinger › Ikke på Hjem › TV › Tekst per tilstand |
| `tile_cfg.tv.state_text.off.title` | off · tittel | Snarveier · soner, entitet og handlinger › Ikke på Hjem › TV › Tekst per tilstand |
| `tile_cfg.tv.state_text.off.sub` | off · undertekst | Snarveier · soner, entitet og handlinger › Ikke på Hjem › TV › Tekst per tilstand |
| `tile_cfg.tv.state_text.playing.title` | playing · nå · tittel | Snarveier · soner, entitet og handlinger › Ikke på Hjem › TV › Tekst per tilstand |
| `tile_cfg.tv.state_text.playing.sub` | playing · undertekst | Snarveier · soner, entitet og handlinger › Ikke på Hjem › TV › Tekst per tilstand |
| `tile_cfg.tv.state_text.paused.title` | paused · tittel | Snarveier · soner, entitet og handlinger › Ikke på Hjem › TV › Tekst per tilstand |
| `tile_cfg.tv.state_text.paused.sub` | paused · undertekst | Snarveier · soner, entitet og handlinger › Ikke på Hjem › TV › Tekst per tilstand |
| `tile_cfg.tv.state_text.idle.title` | idle · tittel | Snarveier · soner, entitet og handlinger › Ikke på Hjem › TV › Tekst per tilstand |
| `tile_cfg.tv.state_text.idle.sub` | idle · undertekst | Snarveier · soner, entitet og handlinger › Ikke på Hjem › TV › Tekst per tilstand |
| `tile_cfg.tv.state_text.standby.title` | standby · tittel | Snarveier · soner, entitet og handlinger › Ikke på Hjem › TV › Tekst per tilstand |
| `tile_cfg.tv.state_text.standby.sub` | standby · undertekst | Snarveier · soner, entitet og handlinger › Ikke på Hjem › TV › Tekst per tilstand |
| `tile_cfg.tv.state_text.unavailable.title` | unavailable · tittel | Snarveier · soner, entitet og handlinger › Ikke på Hjem › TV › Tekst per tilstand |
| `tile_cfg.tv.state_text.unavailable.sub` | unavailable · undertekst | Snarveier · soner, entitet og handlinger › Ikke på Hjem › TV › Tekst per tilstand |
| `tile_cfg.tv.state_text.unknown.title` | unknown · tittel | Snarveier · soner, entitet og handlinger › Ikke på Hjem › TV › Tekst per tilstand |
| `tile_cfg.tv.state_text.unknown.sub` | unknown · undertekst | Snarveier · soner, entitet og handlinger › Ikke på Hjem › TV › Tekst per tilstand |
| `tile_cfg.tv.tap_icon` | Trykk på ikonet · tap | Snarveier · soner, entitet og handlinger › Ikke på Hjem › TV |
| `tile_cfg.tv.tap_card` | Trykk på kortet · tap | Snarveier · soner, entitet og handlinger › Ikke på Hjem › TV |
| `tile_cfg.tv.hold_icon` | Hold på ikonet · tap | Snarveier · soner, entitet og handlinger › Ikke på Hjem › TV |
| `tile_cfg.tv.hold_card` | Hold på kortet · tap | Snarveier · soner, entitet og handlinger › Ikke på Hjem › TV |
| `tiles.hjem.wash.slot` | Plassering (L-top \| R-top \| L-bottom \| R-bottom) | Snarveier · soner, entitet og handlinger › Ikke på Hjem › Vaskemaskin |
| `tile_cfg.wash.entity` | Entitet · entity | Snarveier · soner, entitet og handlinger › Ikke på Hjem › Vaskemaskin |
| `tile_cfg.wash.name` | Navn | Snarveier · soner, entitet og handlinger › Ikke på Hjem › Vaskemaskin |
| `tile_cfg.wash.icon` | Ikon · icon | Snarveier · soner, entitet og handlinger › Ikke på Hjem › Vaskemaskin |
| `tile_cfg.wash.sub` | Undertekst | Snarveier · soner, entitet og handlinger › Ikke på Hjem › Vaskemaskin |
| `tile_cfg.wash.tap_icon` | Trykk på ikonet · tap | Snarveier · soner, entitet og handlinger › Ikke på Hjem › Vaskemaskin |
| `tile_cfg.wash.tap_card` | Trykk på kortet · tap | Snarveier · soner, entitet og handlinger › Ikke på Hjem › Vaskemaskin |
| `tile_cfg.wash.hold_icon` | Hold på ikonet · tap | Snarveier · soner, entitet og handlinger › Ikke på Hjem › Vaskemaskin |
| `tile_cfg.wash.hold_card` | Hold på kortet · tap | Snarveier · soner, entitet og handlinger › Ikke på Hjem › Vaskemaskin |
| `calendar.entities` | Kalendere (tom = alle) · entities | Sveip-kort · kalender |
| `calendar.all_day` | Ta med «Hele dagen»-hendelser · boolean | Sveip-kort · kalender |
| `calendar.tap_action` | Trykk · tap | Sveip-kort · kalender |
| `calendar.hold_action` | Hold · tap | Sveip-kort · kalender |
| `overrides.{lock, garage, alarm, cam, ruter, todo, tv, vacr, dish, wash, dry, weather, price, watt, calendar, trash}` | bytt entitet |  |
| `links.l01.title` | Ny snarvei · tittel | Egne snarveier |
| `trash_hash` | Popup · hash | Sveip-kort · søppel |
| `trash_type_sensor` | Type avfall (valgfri) · entity | Sveip-kort · søppel |
| `icon_color_mode` | Ikonfarge (lights \| always \| never) | Romkort · ikon (standard for alle rom) |
| `icon_tap` | Trykk på ikonet (toggle_lights \| open_popup \| none) | Romkort · ikon (standard for alle rom) |
| `rooms.basseng.icon` | Ikon · icon | Rom · Basseng |
| `rooms.basseng.color` | Farge (ikon når lys er på) · color | Rom · Basseng |
| `rooms.basseng.size` | Størrelse i kortliste (S \| M \| L) | Rom · Basseng |
| `rooms.basseng.klima` | Klima-knapp (+/−) · boolean | Rom · Basseng |
| `rooms.basseng.temperature` | Temperatur · entity | Rom · Basseng |
| `rooms.basseng.humidity` | Luftfuktighet · entity | Rom · Basseng |
| `rooms.basseng.climate` | Termostat · entity | Rom · Basseng |
| `rooms.basseng.badges_own` | Egne varsel-vilkår · boolean | Rom · Basseng |
| `rooms.hage.icon` | Ikon · icon | Rom · Hage |
| `rooms.hage.color` | Farge (ikon når lys er på) · color | Rom · Hage |
| `rooms.hage.size` | Størrelse i kortliste (S \| M \| L) | Rom · Hage |
| `rooms.hage.klima` | Klima-knapp (+/−) · boolean | Rom · Hage |
| `rooms.hage.temperature` | Temperatur · entity | Rom · Hage |
| `rooms.hage.humidity` | Luftfuktighet · entity | Rom · Hage |
| `rooms.hage.climate` | Termostat · entity | Rom · Hage |
| `rooms.hage.badges_own` | Egne varsel-vilkår · boolean | Rom · Hage |
| `rooms.bod.icon` | Ikon · icon | Rom · Bod |
| `rooms.bod.color` | Farge (ikon når lys er på) · color | Rom · Bod |
| `rooms.bod.size` | Størrelse i kortliste (S \| M \| L) | Rom · Bod |
| `rooms.bod.klima` | Klima-knapp (+/−) · boolean | Rom · Bod |
| `rooms.bod.temperature` | Temperatur · entity | Rom · Bod |
| `rooms.bod.humidity` | Luftfuktighet · entity | Rom · Bod |
| `rooms.bod.climate` | Termostat · entity | Rom · Bod |
| `rooms.bod.badges_own` | Egne varsel-vilkår · boolean | Rom · Bod |
| `rooms.gang.icon` | Ikon · icon | Rom · Gang |
| `rooms.gang.color` | Farge (ikon når lys er på) · color | Rom · Gang |
| `rooms.gang.size` | Størrelse i kortliste (S \| M \| L) | Rom · Gang |
| `rooms.gang.klima` | Klima-knapp (+/−) · boolean | Rom · Gang |
| `rooms.gang.temperature` | Temperatur · entity | Rom · Gang |
| `rooms.gang.humidity` | Luftfuktighet · entity | Rom · Gang |
| `rooms.gang.climate` | Termostat · entity | Rom · Gang |
| `rooms.gang.badges_own` | Egne varsel-vilkår · boolean | Rom · Gang |
| `rooms.kjokken.icon` | Ikon · icon | Rom · Kjøkken |
| `rooms.kjokken.color` | Farge (ikon når lys er på) · color | Rom · Kjøkken |
| `rooms.kjokken.size` | Størrelse i kortliste (S \| M \| L) | Rom · Kjøkken |
| `rooms.kjokken.klima` | Klima-knapp (+/−) · boolean | Rom · Kjøkken |
| `rooms.kjokken.temperature` | Temperatur · entity | Rom · Kjøkken |
| `rooms.kjokken.humidity` | Luftfuktighet · entity | Rom · Kjøkken |
| `rooms.kjokken.climate` | Termostat · entity | Rom · Kjøkken |
| `rooms.kjokken.badges_own` | Egne varsel-vilkår · boolean | Rom · Kjøkken |
| `rooms.stue.icon` | Ikon · icon | Rom · Stue |
| `rooms.stue.color` | Farge (ikon når lys er på) · color | Rom · Stue |
| `rooms.stue.size` | Størrelse i kortliste (S \| M \| L) | Rom · Stue |
| `rooms.stue.klima` | Klima-knapp (+/−) · boolean | Rom · Stue |
| `rooms.stue.temperature` | Temperatur · entity | Rom · Stue |
| `rooms.stue.humidity` | Luftfuktighet · entity | Rom · Stue |
| `rooms.stue.climate` | Termostat · entity | Rom · Stue |
| `rooms.stue.badges_own` | Egne varsel-vilkår · boolean | Rom · Stue |
| `rooms.bad.icon` | Ikon · icon | Rom · Bad |
| `rooms.bad.color` | Farge (ikon når lys er på) · color | Rom · Bad |
| `rooms.bad.size` | Størrelse i kortliste (S \| M \| L) | Rom · Bad |
| `rooms.bad.klima` | Klima-knapp (+/−) · boolean | Rom · Bad |
| `rooms.bad.temperature` | Temperatur · entity | Rom · Bad |
| `rooms.bad.humidity` | Luftfuktighet · entity | Rom · Bad |
| `rooms.bad.climate` | Termostat · entity | Rom · Bad |
| `rooms.bad.badges_own` | Egne varsel-vilkår · boolean | Rom · Bad |
| `rooms.kontor.icon` | Ikon · icon | Rom · Kontor |
| `rooms.kontor.color` | Farge (ikon når lys er på) · color | Rom · Kontor |
| `rooms.kontor.size` | Størrelse i kortliste (S \| M \| L) | Rom · Kontor |
| `rooms.kontor.klima` | Klima-knapp (+/−) · boolean | Rom · Kontor |
| `rooms.kontor.temperature` | Temperatur · entity | Rom · Kontor |
| `rooms.kontor.humidity` | Luftfuktighet · entity | Rom · Kontor |
| `rooms.kontor.climate` | Termostat · entity | Rom · Kontor |
| `rooms.kontor.badges_own` | Egne varsel-vilkår · boolean | Rom · Kontor |
| `rooms.soverom.icon` | Ikon · icon | Rom · Soverom |
| `rooms.soverom.color` | Farge (ikon når lys er på) · color | Rom · Soverom |
| `rooms.soverom.size` | Størrelse i kortliste (S \| M \| L) | Rom · Soverom |
| `rooms.soverom.klima` | Klima-knapp (+/−) · boolean | Rom · Soverom |
| `rooms.soverom.temperature` | Temperatur · entity | Rom · Soverom |
| `rooms.soverom.humidity` | Luftfuktighet · entity | Rom · Soverom |
| `rooms.soverom.climate` | Termostat · entity | Rom · Soverom |
| `rooms.soverom.badges_own` | Egne varsel-vilkår · boolean | Rom · Soverom |
| `rooms.vaskerom.icon` | Ikon · icon | Rom · Vaskerom |
| `rooms.vaskerom.color` | Farge (ikon når lys er på) · color | Rom · Vaskerom |
| `rooms.vaskerom.size` | Størrelse i kortliste (S \| M \| L) | Rom · Vaskerom |
| `rooms.vaskerom.klima` | Klima-knapp (+/−) · boolean | Rom · Vaskerom |
| `rooms.vaskerom.temperature` | Temperatur · entity | Rom · Vaskerom |
| `rooms.vaskerom.humidity` | Luftfuktighet · entity | Rom · Vaskerom |
| `rooms.vaskerom.climate` | Termostat · entity | Rom · Vaskerom |
| `rooms.vaskerom.badges_own` | Egne varsel-vilkår · boolean | Rom · Vaskerom |
| `rooms.garasje.icon` | Ikon · icon | Rom · Garasje |
| `rooms.garasje.color` | Farge (ikon når lys er på) · color | Rom · Garasje |
| `rooms.garasje.size` | Størrelse i kortliste (S \| M \| L) | Rom · Garasje |
| `rooms.garasje.klima` | Klima-knapp (+/−) · boolean | Rom · Garasje |
| `rooms.garasje.temperature` | Temperatur · entity | Rom · Garasje |
| `rooms.garasje.humidity` | Luftfuktighet · entity | Rom · Garasje |
| `rooms.garasje.climate` | Termostat · entity | Rom · Garasje |
| `rooms.garasje.badges_own` | Egne varsel-vilkår · boolean | Rom · Garasje |
| `layout_mode` | Layout (auto \| mobil \| stor) | Layout |
| `toasts` | Bekreftelsesmeldinger (f.eks. «Garasjeporten åpnes») · boolean | Layout |

## `msh-hjem-card`

Hele Hjem-visningen i ett kort: header, prosa, faner/romkort, søppel, strømpris og gjøremål med designets marger (mobil og Fold).

| Nøkkel | Betydning | Gruppe |
|---|---|---|
| `layout_mode` | Layout (auto \| mobil \| stor) | Layout |
| `breakout` | Mål margene mot dashbordflaten (bryt ut av seksjonens padding) · boolean | Layout |
| `show_todo` | Vis gjøremål · boolean | Kort |
| `order · hidden` | rekkefølge/synlighet: header, prosa, faner, soppel, strom, gjoremal |  |

## `msh-strompris-card`

Strømpris nå og per time i dag / i morgen (Norge: spot, totalpris eller Norgespris; Sverige: SEK i kr/kWh), nettleie i morgen og referanselinje. Dra på grafen for å se en time.

| Nøkkel | Betydning | Gruppe |
|---|---|---|
| `power_price.profile` | Profil (no \| se) | Strømpris-kilde |
| `power_price.source` | Kilde ( \| nordpool \| tibber \| strompris \| custom) | Strømpris-kilde |
| `power_price.spot_entity` | Spotpris-sensor · entity | Strømpris-kilde |
| `power_price.area` | Prisområde ( \| NO1 \| NO2 \| NO3 \| NO4 \| NO5) | Strømpris-kilde |
| `power_price.norgespris_entity` | Norgespris-sensor · entity | Strømpris-kilde |
| `power_price.norgespris` | Norgespris uten sensor (kr/kWh) · number | Strømpris-kilde |
| `power_price.grid_entity` | Nettleie-sensor (valgfri, today/tomorrow) · entity | Strømpris-kilde |
| `power_price.mode` | Pris som vises (spot \| total \| norgespris) | Strømpris-kilde |
| `power_price.unit` | Enhet (kr \| ore) | Strømpris-kilde |
| `power_price.tab.style` | Stil (standard \| glass) | Fane «I dag / I morgen» |
| `power_price.tab.font` | Tekststørrelse · range | Fane «I dag / I morgen» |
| `power_price.tab.height` | Høyde · range | Fane «I dag / I morgen» |
| `power_price.tab.padding` | Bredde (sidemarg per knapp) · range | Fane «I dag / I morgen» |
| `threshold` | Oransje linje over (kr/kWh) · number | Graf |
| `show_norgespris` | Vis referanselinje (Norgespris / spot) · boolean | Graf |

## `msh-rom-klima-card`

Temperatur, fukt, termostat-chip og 24 t-graf med scrubbing. Alltid første kort i rom-popupen.

| Nøkkel | Betydning | Gruppe |
|---|---|---|
| `area` | Rom (område) · area |  |
| `name` | Navn |  |
| `overrides.climate` | Termostat · entity | Klima |
| `overrides.temperature` | Temperatursensor · entity | Klima |
| `overrides.humidity` | Fuktsensor · entity | Klima |
| `header_icon` | Rommets ikon i popup-headeren · boolean |  |
| `graph_t` | Linje · temperatur · color | Graf |
| `graph_h` | Linje · fukt · color | Graf |
| `graph_fill` | Fyll (0 \| 0.2 \| 0.4) | Graf |
| `graph_width` | Linje (1.5 \| 2 \| 3) | Graf |

## `msh-rom-card`

Rom-popupen: rullegardin, scener, lys, enheter, klima, media og sensorer – autokonfig fra KI Rom / HA-områder.

| Nøkkel | Betydning | Gruppe |
|---|---|---|


## `msh-romkort-card`

Romkort for Hjem: temperatur, fukt, lys, termostat og varsler. Trykk åpner Rom-popupen.

| Nøkkel | Betydning | Gruppe |
|---|---|---|
| `area` | Rom (område) · area | Rom |
| `variant` | Variant (graf \| karusell \| L \| M \| S) | Rom |
| `name` | Navn | Rom |
| `hash` | Popup (hash) · hash | Rom |
| `klima` | Klima-knapp (+/−) på kortet · boolean | Rom |
| `room_card.klima_pill_height.M` | Klima-knapp · høyde Medium (px) · number | Rom |
| `room_card.klima_pill_height.L` | Klima-knapp · høyde Stor/karusell (px) · number | Rom |
| `icon` | Ikon · icon | Ikon og farge |
| `color` | Romfarge (ikon når lys er på) · color | Ikon og farge |
| `icon_color_mode` | Ikonfarge ( \| lights \| always \| never) | Ikon og farge |
| `icon_tap` | Trykk på ikonet ( \| toggle_lights \| open_popup \| none) | Ikon og farge |
| `overrides.{temperature, humidity, climate}` | bytt entitet |  |
| `badges_own` | Egne varsel-vilkår · boolean | Varsler på rommet |
| `graph_t` | Linje · temperatur · color | Graf (variant graf) |
| `graph_h` | Linje · fukt · color | Graf (variant graf) |
| `background` | Bakgrunn · color | Graf (variant graf) |
| `motes` | Svevende partikler (animasjon) · boolean | Graf (variant graf) |
| `toasts` | Bekreftelsesmeldinger · boolean |  |

## `msh-basseng-hero-card`

Toppkortet i msh-basseng-card (innebygd via MSH.HEROES, fiks 26.14): vanntemperatur, status og animert pumpe/varmepumpe/tak/lys. Legges ikke som eget kort i popupen.

| Nøkkel | Betydning | Gruppe |
|---|---|---|
| `area` | Område · area |  |
| `name` | Navn |  |
| `overrides.{water, pump, heat, cover, light, target, turnover}` | bytt entitet |  |
| `anim` | Animasjoner (bølger, bobler, vifte og varme) · boolean | Animasjon |
| `chips` | Statusikoner (pumpe, varme, tak og lys i bildet) · boolean | Animasjon |
| `vals.turnovers` | Omsetninger per døgn (mål) | Animasjon |

## `msh-basseng-card`

Basseng (ÉTT kort, legges manuelt i en egen popup): toppkort, prosalinje, faner (Oversikt, Varme, Klor, Spreder), hurtigknapper (Lys, Pumpe, Varme, Stille, Stikkontakt) autokonfigurert, klorlogg og spreder.

| Nøkkel | Betydning | Gruppe |
|---|---|---|
| `area` | Område · area |  |
| `name` | Navn i toppkortet |  |
| `overrides.{water, ute, pump, heat, quiet, sock, cover, light, spr, power, heat_power, ph, klor, target, turnover, pumped, savings, cost, eta, mode, night, winter, heat_loss, solar, spr_duration, klor_calendar, klor_last}` | bytt entitet |  |
| `exclude · include.{hurtig, flagg, personer}` | skjul / legg til |  |
| `controls · hidden_controls` | rekkefølge/synlighet: light, pump, heat, quiet, sock, cover, spr |  |
| `tabs · hidden_tabs` | rekkefølge/synlighet: ov, heat, klor, spr |  |
| `vals.profile` | Driftsprofil | Styring og verdier |
| `vals.turnovers` | Omsetninger per døgn | Styring og verdier |
| `vals.pulse` | Vedlikeholdspuls | Styring og verdier |
| `vals.day_hours` | Dagtimer i planen | Styring og verdier |
| `vals.price_ctrl` | Prisstyring · boolean | Styring og verdier |
| `vals.heat_prio` | Varmeprioritet · boolean | Styring og verdier |
| `vals.min_run` | Minste kjøretid | Styring og verdier |
| `vals.base_load` | Basislast | Styring og verdier |
| `vals.override` | Manuell overstyring varer | Styring og verdier |
| `vals.ctrl_heat` | Styr varmepumpa · boolean | Styring og verdier |
| `vals.ctrl_setpoint` | Styr settpunkt · boolean | Styring og verdier |
| `vals.heat_from` | Varmevindu fra | Styring og verdier |
| `vals.heat_to` | Varmevindu til | Styring og verdier |
| `vals.away_drop` | Senking når ingen er hjemme | Styring og verdier |
| `vals.solar` | Solvarme · boolean | Styring og verdier |
| `vals.targets` | Hurtigvalg mål (°C) | Styring og verdier |
| `vals.loss_open` | Varmetap uten tak | Styring og verdier |
| `vals.loss_closed` | Varmetap med tak | Styring og verdier |
| `vals.sun_through` | Sol gjennom taket | Styring og verdier |
| `vals.klor_every` | Klortablett hver (dager) | Styring og verdier |
| `vals.spr_every` | Start hver | Styring og verdier |
| `vals.spr_max` | Maks per døgn | Styring og verdier |
| `vals.spr_durs` | Varigheter (min) | Styring og verdier |
| `vals.spr_frost` | Frostvakt · boolean | Styring og verdier |
| `anim` | Animasjoner (bølger, bobler, vifte og varme) · boolean | Animasjon |
| `chips` | Statusikoner (pumpe, varme, tak og lys i bildet) · boolean | Animasjon |
| `show_sentence` | Setning i Oversikt · boolean | Visning |
| `toasts` | Bekreftelsesmeldinger · boolean | Visning |
| `gap` | 4 / 8 / 18 px | Visning |
| `gap` | Mellom seksjonene · range | Mellomrom |
| `pad_top` | Fra popup-headeren til første kort · range | Mellomrom |
| `pad_bottom` | Luft i bunnen (over navbaren) · range | Mellomrom |

## `msh-vanning-card`

Vanning-popup (#vanning), ett kort: hagescene, Nå · Soner · Program · Forbruk (KI Vann) · Historikk. Setter seg opp selv fra KI Vanning, OpenSprinkler og KI Vann.

| Nøkkel | Betydning | Gruppe |
|---|---|---|


## `msh-klima-hero-card`

Ring med tid i timen og effekt nå mot tillatt, status, setning, timebudsjett og bortemodus. Første seksjon i Klima-popupen.

| Nøkkel | Betydning | Gruppe |
|---|---|---|
| `toasts` | Bekreftelsesmeldinger · boolean |  |

## `msh-klima-card`

KI Energi: hero med ring og timebudsjett, moduser, 8 faner (Oversikt, Soner, Energi, Vann og bad, Lading, Tanker, Oppsett, Avansert) og «Tilpass klima».

| Nøkkel | Betydning | Gruppe |
|---|---|---|
| `title` | Tittel (valgfri) |  |
| `layout.show_hero` | Hero-kort · boolean | Visning |
| `hero_style` | Toppkort-stil (ring \| hus \| batteri \| maaler \| puls \| blokker) | Visning |
| `layout.show_modes` | Modus-bobler · boolean | Visning |
| `layout.tab_look` | Fanestil (fylt \| kontur \| linje) | Visning |
| `layout.tab_style` | Faner viser (both \| text \| icon) | Visning |
| `layout.tab_order · layout.hidden_tabs` | rekkefølge/synlighet: oversikt, soner, energi, vann, lading, tanker, oppsett, avansert | Faner |
| `layout.block_order.oversikt · layout.hidden_blocks.oversikt` | rekkefølge/synlighet: siste12, forventet, leggetid, styrer, tiltak, budsjett, varmtvann, borte | Blokker |
| `layout.block_order.soner · layout.hidden_blocks.soner` | rekkefølge/synlighet: soner | Blokker |
| `layout.block_order.energi · layout.hidden_blocks.energi` | rekkefølge/synlighet: dynamisk, sparer, maaned, topp3, effekt6, grenser | Blokker |
| `layout.block_order.vann · layout.hidden_blocks.vann` | rekkefølge/synlighet: status, pris, brytere, handling, vindu, legionella, handkle, hk_sparer, dusj, fukt, vifte, gulv | Blokker |
| `layout.block_order.lading · layout.hidden_blocks.lading` | rekkefølge/synlighet: status, ledig, trinn, auto, vindu | Blokker |
| `layout.block_order.tanker · layout.hidden_blocks.tanker` | rekkefølge/synlighet: tenker, logg, vurdering, tau | Blokker |
| `layout.block_order.oppsett · layout.hidden_blocks.oppsett` | rekkefølge/synlighet: motor, varme, gardiner, helg, vannbad, lys, varslinger, tider, dagnatt, personer, stue, diagnostikk | Blokker |
| `layout.block_order.avansert · layout.hidden_blocks.avansert` | rekkefølge/synlighet: terskler, prognose, moduser, helgevarsler, vvb, tariff, entiteter, raa, handlinger | Blokker |
| `gap` | Mellom seksjonene · range | Mellomrom |
| `pad_top` | Fra popup-headeren til første kort · range | Mellomrom |
| `pad_bottom` | Luft i bunnen · range | Mellomrom |
| `toasts` | Bekreftelsesmeldinger · boolean |  |

## `msh-lys-card`

Utelys med tidslinje og styring, lys per etasje og rom med felles lys-rad, og oversikt over lys som er på.

| Nøkkel | Betydning | Gruppe |
|---|---|---|
| `cols` | Kolonner (1 \| 2 \| 3) | Visning |
| `color_mode` | Farge på lys (lamp \| kelvin \| single) | Visning |
| `on_color` | På-farge (Én farge) · color | Visning |
| `off_color` | Av-farge (bakgrunn bak lysene) ( \| var(--gray300) \| var(--gray100) \| var(--gray400)) | Visning |
| `show_kelvin` | Vis fargetemperatur («70 % · 2700 K») · boolean | Visning |
| `toasts` | Bekreftelsesmeldinger · boolean | Visning |
| `gap` | Mellom seksjonene · range | Mellomrom |
| `tile_gap` | Mellom lys-radene · range | Mellomrom |
| `top` | Fra popup-headeren til første kort · range | Mellomrom |
| `bottom` | Luft i bunnen (over navbaren) · range | Mellomrom |
| `tab_order · hide_tabs` | rekkefølge/synlighet: out, f:forste, f:andre, on | Faner |
| `tab_names.out` | Utelys | Faner › Navn på fanene |
| `tab_names.f:forste` | 1. etg | Faner › Navn på fanene |
| `tab_names.f:andre` | 2. etg | Faner › Navn på fanene |
| `tab_names.on` | Lys på | Faner › Navn på fanene |
| `floor_tabs.forste` | 1. etg · boolean | Faner › Fane per etasje |
| `floor_tabs.andre` | 2. etg · boolean | Faner › Fane per etasje |
| `tab_style` | Fanestil (pill \| icon \| iconText \| underline \| segment) | Design |
| `tab_label` | Faneetiketter (short \| long) | Design |
| `gear_position` | Tannhjul (right \| left) | Design |
| `scene_style` | Scenestil (bubble \| pill \| grid) | Design |
| `room_header` | Romoverskrift (icon \| text \| hidden) | Design |
| `tab_count` | Antall lys på i fanene («1. etg · 3») · boolean | Design |
| `show_scenes` | Vis scener · boolean | Design |
| `room_toggle` | «Av / På»-knapp per rom · boolean | Design |
| `scene_source` | Kilde (auto \| ki \| egne \| begge) | Scener |
| `scene_order · hide_scenes` | rekkefølge/synlighet: ki:maks, ki:natt, ki:av, ki:komfort, ki:middag, ki:tv, ki:mindre, p:max, p:kveld, p:dim, p:natt, p:av, scene.bad_morgen, scene.soverom_natt | Scener |
| `extra_scenes` | Egne scener · entities | Scener |
| `scene_icon.ki_maks` | Ikon · icon | Scener › Maks lys |
| `scene_color.ki_maks` | Farge (ikonet) · color | Scener › Maks lys |
| `scene_icon.ki_natt` | Ikon · icon | Scener › Nattmodus |
| `scene_color.ki_natt` | Farge (ikonet) · color | Scener › Nattmodus |
| `scene_icon.ki_av` | Ikon · icon | Scener › Alt av |
| `scene_color.ki_av` | Farge (ikonet) · color | Scener › Alt av |
| `scene_icon.ki_komfort` | Ikon · icon | Scener › Komfort |
| `scene_color.ki_komfort` | Farge (ikonet) · color | Scener › Komfort |
| `scene_icon.ki_middag` | Ikon · icon | Scener › Middag |
| `scene_color.ki_middag` | Farge (ikonet) · color | Scener › Middag |
| `scene_icon.ki_tv` | Ikon · icon | Scener › TV-kveld |
| `scene_color.ki_tv` | Farge (ikonet) · color | Scener › TV-kveld |
| `scene_icon.ki_mindre` | Ikon · icon | Scener › Mindre lys |
| `scene_color.ki_mindre` | Farge (ikonet) · color | Scener › Mindre lys |
| `scene_icon.p_max` | Ikon · icon | Scener › Maks |
| `scene_color.p_max` | Farge (ikonet) · color | Scener › Maks |
| `scene_icon.p_kveld` | Ikon · icon | Scener › Kveld |
| `scene_color.p_kveld` | Farge (ikonet) · color | Scener › Kveld |
| `scene_icon.p_dim` | Ikon · icon | Scener › Dempet |
| `scene_color.p_dim` | Farge (ikonet) · color | Scener › Dempet |
| `scene_icon.p_natt` | Ikon · icon | Scener › Natt |
| `scene_color.p_natt` | Farge (ikonet) · color | Scener › Natt |
| `scene_icon.p_av` | Ikon · icon | Scener › Alt av |
| `scene_color.p_av` | Farge (ikonet) · color | Scener › Alt av |
| `scene_icon.scene_bad_morgen` | Ikon · icon | Scener › Bad Morgen |
| `scene_color.scene_bad_morgen` | Farge (ikonet) · color | Scener › Bad Morgen |
| `scene_icon.scene_soverom_natt` | Ikon · icon | Scener › Soverom natt |
| `scene_color.scene_soverom_natt` | Farge (ikonet) · color | Scener › Soverom natt |
| `room_order.forste · hide_rooms` | rekkefølge/synlighet: gang, kjokken, stue | Rom og lys › 1. etg |
| `room_names.gang` | Navn på rommet | Rom og lys › 1. etg › Gang |
| `light_order.gang · hide_lights` | rekkefølge/synlighet: light.gang_speil, light.gang_tak | Rom og lys › 1. etg › Gang |
| `groups.gang.name` | Gruppenavn | Rom og lys › 1. etg › Gang › Gruppe (én rad i popupen) |
| `groups.gang.members` | Lys i gruppen (minst 2) · entities | Rom og lys › 1. etg › Gang › Gruppe (én rad i popupen) |
| `light_room.gang_speil` | Rom ( \| bod \| gang \| kjokken \| stue \| bad \| kontor \| soverom \| vaskerom) | Rom og lys › 1. etg › Gang › Speil |
| `lights.gang_speil.name` | Navn | Rom og lys › 1. etg › Gang › Speil |
| `lights.gang_speil.icon` | Ikon · icon | Rom og lys › 1. etg › Gang › Speil |
| `light_types.gang_speil` | Lystype ( \| dim \| ct \| color \| onoff) | Rom og lys › 1. etg › Gang › Speil |
| `lights.gang_speil.brightness_min` | Minste lysstyrke (%) · number | Rom og lys › 1. etg › Gang › Speil › Slider (avansert) |
| `lights.gang_speil.brightness_max` | Største lysstyrke (%) · number | Rom og lys › 1. etg › Gang › Speil › Slider (avansert) |
| `lights.gang_speil.hide_temperature_slider` | Skjul temperatur (pil) · boolean | Rom og lys › 1. etg › Gang › Speil › Slider (avansert) |
| `lights.gang_speil.hide_color_controls` | Skjul farge (pil) · boolean | Rom og lys › 1. etg › Gang › Speil › Slider (avansert) |
| `light_room.gang_tak` | Rom ( \| bod \| gang \| kjokken \| stue \| bad \| kontor \| soverom \| vaskerom) | Rom og lys › 1. etg › Gang › Tak |
| `lights.gang_tak.name` | Navn | Rom og lys › 1. etg › Gang › Tak |
| `lights.gang_tak.icon` | Ikon · icon | Rom og lys › 1. etg › Gang › Tak |
| `light_types.gang_tak` | Lystype ( \| dim \| ct \| color \| onoff) | Rom og lys › 1. etg › Gang › Tak |
| `lights.gang_tak.brightness_min` | Minste lysstyrke (%) · number | Rom og lys › 1. etg › Gang › Tak › Slider (avansert) |
| `lights.gang_tak.brightness_max` | Største lysstyrke (%) · number | Rom og lys › 1. etg › Gang › Tak › Slider (avansert) |
| `lights.gang_tak.hide_temperature_slider` | Skjul temperatur (pil) · boolean | Rom og lys › 1. etg › Gang › Tak › Slider (avansert) |
| `lights.gang_tak.hide_color_controls` | Skjul farge (pil) · boolean | Rom og lys › 1. etg › Gang › Tak › Slider (avansert) |
| `room_names.kjokken` | Navn på rommet | Rom og lys › 1. etg › Kjøkken |
| `light_order.kjokken · hide_lights` | rekkefølge/synlighet: light.kjokken_spot | Rom og lys › 1. etg › Kjøkken |
| `groups.kjokken.name` | Gruppenavn | Rom og lys › 1. etg › Kjøkken › Gruppe (én rad i popupen) |
| `groups.kjokken.members` | Lys i gruppen (minst 2) · entities | Rom og lys › 1. etg › Kjøkken › Gruppe (én rad i popupen) |
| `light_room.kjokken_spot` | Rom ( \| bod \| gang \| kjokken \| stue \| bad \| kontor \| soverom \| vaskerom) | Rom og lys › 1. etg › Kjøkken › Spot |
| `lights.kjokken_spot.name` | Navn | Rom og lys › 1. etg › Kjøkken › Spot |
| `lights.kjokken_spot.icon` | Ikon · icon | Rom og lys › 1. etg › Kjøkken › Spot |
| `light_types.kjokken_spot` | Lystype ( \| dim \| ct \| color \| onoff) | Rom og lys › 1. etg › Kjøkken › Spot |
| `lights.kjokken_spot.brightness_min` | Minste lysstyrke (%) · number | Rom og lys › 1. etg › Kjøkken › Spot › Slider (avansert) |
| `lights.kjokken_spot.brightness_max` | Største lysstyrke (%) · number | Rom og lys › 1. etg › Kjøkken › Spot › Slider (avansert) |
| `lights.kjokken_spot.hide_temperature_slider` | Skjul temperatur (pil) · boolean | Rom og lys › 1. etg › Kjøkken › Spot › Slider (avansert) |
| `lights.kjokken_spot.hide_color_controls` | Skjul farge (pil) · boolean | Rom og lys › 1. etg › Kjøkken › Spot › Slider (avansert) |
| `room_names.stue` | Navn på rommet | Rom og lys › 1. etg › Stue |
| `light_order.stue · hide_lights` | rekkefølge/synlighet: light.stue_lampe, light.stue_led, light.stue_tak | Rom og lys › 1. etg › Stue |
| `groups.stue.name` | Gruppenavn | Rom og lys › 1. etg › Stue › Gruppe (én rad i popupen) |
| `groups.stue.members` | Lys i gruppen (minst 2) · entities | Rom og lys › 1. etg › Stue › Gruppe (én rad i popupen) |
| `light_room.stue_lampe` | Rom ( \| bod \| gang \| kjokken \| stue \| bad \| kontor \| soverom \| vaskerom) | Rom og lys › 1. etg › Stue › Lampe |
| `lights.stue_lampe.name` | Navn | Rom og lys › 1. etg › Stue › Lampe |
| `lights.stue_lampe.icon` | Ikon · icon | Rom og lys › 1. etg › Stue › Lampe |
| `light_types.stue_lampe` | Lystype ( \| dim \| ct \| color \| onoff) | Rom og lys › 1. etg › Stue › Lampe |
| `lights.stue_lampe.brightness_min` | Minste lysstyrke (%) · number | Rom og lys › 1. etg › Stue › Lampe › Slider (avansert) |
| `lights.stue_lampe.brightness_max` | Største lysstyrke (%) · number | Rom og lys › 1. etg › Stue › Lampe › Slider (avansert) |
| `lights.stue_lampe.hide_temperature_slider` | Skjul temperatur (pil) · boolean | Rom og lys › 1. etg › Stue › Lampe › Slider (avansert) |
| `lights.stue_lampe.hide_color_controls` | Skjul farge (pil) · boolean | Rom og lys › 1. etg › Stue › Lampe › Slider (avansert) |
| `light_room.stue_led` | Rom ( \| bod \| gang \| kjokken \| stue \| bad \| kontor \| soverom \| vaskerom) | Rom og lys › 1. etg › Stue › LED |
| `lights.stue_led.name` | Navn | Rom og lys › 1. etg › Stue › LED |
| `lights.stue_led.icon` | Ikon · icon | Rom og lys › 1. etg › Stue › LED |
| `light_types.stue_led` | Lystype ( \| dim \| ct \| color \| onoff) | Rom og lys › 1. etg › Stue › LED |
| `lights.stue_led.brightness_min` | Minste lysstyrke (%) · number | Rom og lys › 1. etg › Stue › LED › Slider (avansert) |
| `lights.stue_led.brightness_max` | Største lysstyrke (%) · number | Rom og lys › 1. etg › Stue › LED › Slider (avansert) |
| `lights.stue_led.hide_temperature_slider` | Skjul temperatur (pil) · boolean | Rom og lys › 1. etg › Stue › LED › Slider (avansert) |
| `lights.stue_led.hide_color_controls` | Skjul farge (pil) · boolean | Rom og lys › 1. etg › Stue › LED › Slider (avansert) |
| `light_room.stue_tak` | Rom ( \| bod \| gang \| kjokken \| stue \| bad \| kontor \| soverom \| vaskerom) | Rom og lys › 1. etg › Stue › Tak |
| `lights.stue_tak.name` | Navn | Rom og lys › 1. etg › Stue › Tak |
| `lights.stue_tak.icon` | Ikon · icon | Rom og lys › 1. etg › Stue › Tak |
| `light_types.stue_tak` | Lystype ( \| dim \| ct \| color \| onoff) | Rom og lys › 1. etg › Stue › Tak |
| `lights.stue_tak.brightness_min` | Minste lysstyrke (%) · number | Rom og lys › 1. etg › Stue › Tak › Slider (avansert) |
| `lights.stue_tak.brightness_max` | Største lysstyrke (%) · number | Rom og lys › 1. etg › Stue › Tak › Slider (avansert) |
| `lights.stue_tak.hide_temperature_slider` | Skjul temperatur (pil) · boolean | Rom og lys › 1. etg › Stue › Tak › Slider (avansert) |
| `lights.stue_tak.hide_color_controls` | Skjul farge (pil) · boolean | Rom og lys › 1. etg › Stue › Tak › Slider (avansert) |
| `room_order.andre · hide_rooms` | rekkefølge/synlighet: bad, soverom | Rom og lys › 2. etg |
| `room_names.bad` | Navn på rommet | Rom og lys › 2. etg › Bad |
| `light_order.bad · hide_lights` | rekkefølge/synlighet: light.bad_tak | Rom og lys › 2. etg › Bad |
| `groups.bad.name` | Gruppenavn | Rom og lys › 2. etg › Bad › Gruppe (én rad i popupen) |
| `groups.bad.members` | Lys i gruppen (minst 2) · entities | Rom og lys › 2. etg › Bad › Gruppe (én rad i popupen) |
| `light_room.bad_tak` | Rom ( \| bod \| gang \| kjokken \| stue \| bad \| kontor \| soverom \| vaskerom) | Rom og lys › 2. etg › Bad › Tak |
| `lights.bad_tak.name` | Navn | Rom og lys › 2. etg › Bad › Tak |
| `lights.bad_tak.icon` | Ikon · icon | Rom og lys › 2. etg › Bad › Tak |
| `light_types.bad_tak` | Lystype ( \| dim \| ct \| color \| onoff) | Rom og lys › 2. etg › Bad › Tak |
| `lights.bad_tak.brightness_min` | Minste lysstyrke (%) · number | Rom og lys › 2. etg › Bad › Tak › Slider (avansert) |
| `lights.bad_tak.brightness_max` | Største lysstyrke (%) · number | Rom og lys › 2. etg › Bad › Tak › Slider (avansert) |
| `lights.bad_tak.hide_temperature_slider` | Skjul temperatur (pil) · boolean | Rom og lys › 2. etg › Bad › Tak › Slider (avansert) |
| `lights.bad_tak.hide_color_controls` | Skjul farge (pil) · boolean | Rom og lys › 2. etg › Bad › Tak › Slider (avansert) |
| `room_names.soverom` | Navn på rommet | Rom og lys › 2. etg › Soverom |
| `light_order.soverom · hide_lights` | rekkefølge/synlighet: light.soverom_nattbord, light.soverom_tak | Rom og lys › 2. etg › Soverom |
| `groups.soverom.name` | Gruppenavn | Rom og lys › 2. etg › Soverom › Gruppe (én rad i popupen) |
| `groups.soverom.members` | Lys i gruppen (minst 2) · entities | Rom og lys › 2. etg › Soverom › Gruppe (én rad i popupen) |
| `light_room.soverom_nattbord` | Rom ( \| bod \| gang \| kjokken \| stue \| bad \| kontor \| soverom \| vaskerom) | Rom og lys › 2. etg › Soverom › Nattbord |
| `lights.soverom_nattbord.name` | Navn | Rom og lys › 2. etg › Soverom › Nattbord |
| `lights.soverom_nattbord.icon` | Ikon · icon | Rom og lys › 2. etg › Soverom › Nattbord |
| `light_types.soverom_nattbord` | Lystype ( \| dim \| ct \| color \| onoff) | Rom og lys › 2. etg › Soverom › Nattbord |
| `lights.soverom_nattbord.brightness_min` | Minste lysstyrke (%) · number | Rom og lys › 2. etg › Soverom › Nattbord › Slider (avansert) |
| `lights.soverom_nattbord.brightness_max` | Største lysstyrke (%) · number | Rom og lys › 2. etg › Soverom › Nattbord › Slider (avansert) |
| `lights.soverom_nattbord.hide_temperature_slider` | Skjul temperatur (pil) · boolean | Rom og lys › 2. etg › Soverom › Nattbord › Slider (avansert) |
| `lights.soverom_nattbord.hide_color_controls` | Skjul farge (pil) · boolean | Rom og lys › 2. etg › Soverom › Nattbord › Slider (avansert) |
| `light_room.soverom_tak` | Rom ( \| bod \| gang \| kjokken \| stue \| bad \| kontor \| soverom \| vaskerom) | Rom og lys › 2. etg › Soverom › Tak |
| `lights.soverom_tak.name` | Navn | Rom og lys › 2. etg › Soverom › Tak |
| `lights.soverom_tak.icon` | Ikon · icon | Rom og lys › 2. etg › Soverom › Tak |
| `light_types.soverom_tak` | Lystype ( \| dim \| ct \| color \| onoff) | Rom og lys › 2. etg › Soverom › Tak |
| `lights.soverom_tak.brightness_min` | Minste lysstyrke (%) · number | Rom og lys › 2. etg › Soverom › Tak › Slider (avansert) |
| `lights.soverom_tak.brightness_max` | Største lysstyrke (%) · number | Rom og lys › 2. etg › Soverom › Tak › Slider (avansert) |
| `lights.soverom_tak.hide_temperature_slider` | Skjul temperatur (pil) · boolean | Rom og lys › 2. etg › Soverom › Tak › Slider (avansert) |
| `lights.soverom_tak.hide_color_controls` | Skjul farge (pil) · boolean | Rom og lys › 2. etg › Soverom › Tak › Slider (avansert) |
| `include.lys` | Lagt til · entities | Rom og lys |
| `outdoor.ring_start` | Døgnringen (0 \| 12) | Utelys › Visning |
| `outdoor.sections · outdoor.hidden_sections` | rekkefølge/synlighet: auto, lamps, sun, settings | Utelys › Visning |
| `overrides.automatikk` | Automatikk · entity | Utelys › Entiteter |
| `overrides.kveld_bryter` | Kveld · entity | Utelys › Entiteter |
| `overrides.morgen_bryter` | Morgen · entity | Utelys › Entiteter |
| `overrides.neste_paa` | Neste tenning · entity | Utelys › Entiteter |
| `overrides.neste_av` | Neste slukking · entity | Utelys › Entiteter |
| `overrides.utelys_status` | Status · entity | Utelys › Entiteter |
| `overrides.terskel_paa` | Tenn under (lx) · entity | Utelys › Entiteter |
| `overrides.terskel_av` | Slukk over (lx) · entity | Utelys › Entiteter |
| `overrides.minst_morke` | Minste mørketid (min) · entity | Utelys › Entiteter |
| `overrides.sun_dawn` | Grålysning · entity | Utelys › Entiteter |
| `overrides.sun_rising` | Soloppgang · entity | Utelys › Entiteter |
| `overrides.sun_noon` | Midt på dagen · entity | Utelys › Entiteter |
| `overrides.sun_setting` | Solnedgang · entity | Utelys › Entiteter |
| `overrides.sun_dusk` | Skumring · entity | Utelys › Entiteter |
| `overrides.sun_elevation` | Solhøyde · entity | Utelys › Entiteter |
| `overrides.sun_stiger` | Sola stiger · entity | Utelys › Entiteter |
| `overrides.lux` | Lysnivåsensor (ute) · entity | Utelys › Entiteter |
| `overrides.modus` | Modusvelger (eldre) · entity | Utelys › Entiteter |
| `outdoor.mode` | Styring (auto \| tid \| manuell) | Utelys › Reserve uten KI Utelys |
| `outdoor.on` | Tennes (HH:MM) | Utelys › Reserve uten KI Utelys |
| `outdoor.off` | Slukkes (HH:MM) | Utelys › Reserve uten KI Utelys |
| `outdoor.latest` | Slukk senest (HH:MM) | Utelys › Reserve uten KI Utelys |
| `outdoor.morning` | Morgen fra (HH:MM) | Utelys › Reserve uten KI Utelys |
| `outdoor.offset` | Forskyvning skumring (min) · number | Utelys › Reserve uten KI Utelys |
| `outdoor.lux_on` | Tenn under (lx) · number | Utelys › Reserve uten KI Utelys |
| `outdoor.lux_off` | Slukk over (lx) · number | Utelys › Reserve uten KI Utelys |
| `outdoor.kveld` | Kveld · tenn i skumringen · boolean | Utelys › Reserve uten KI Utelys |
| `outdoor.morgen` | Morgen · tenn før det lysner · boolean | Utelys › Reserve uten KI Utelys |
| `order.utelys · exclude` | rekkefølge/synlighet: light.basseng_lys, light.utelys_garasje, light.utelys_inngang, light.veranda_flomlys, light.verandalampe | Utelys |
| `include.utelys` | Lagt til · entities | Utelys |
| `lights.basseng_lys.name` | Navn | Utelys › Basseng lys |
| `lights.basseng_lys.icon` | Ikon · icon | Utelys › Basseng lys |
| `light_types.basseng_lys` | Lystype ( \| dim \| ct \| color \| onoff) | Utelys › Basseng lys |
| `lights.basseng_lys.brightness_min` | Minste lysstyrke (%) · number | Utelys › Basseng lys › Slider (avansert) |
| `lights.basseng_lys.brightness_max` | Største lysstyrke (%) · number | Utelys › Basseng lys › Slider (avansert) |
| `lights.basseng_lys.hide_temperature_slider` | Skjul temperatur (pil) · boolean | Utelys › Basseng lys › Slider (avansert) |
| `lights.basseng_lys.hide_color_controls` | Skjul farge (pil) · boolean | Utelys › Basseng lys › Slider (avansert) |
| `lights.utelys_garasje.name` | Navn | Utelys › Utelys garasje |
| `lights.utelys_garasje.icon` | Ikon · icon | Utelys › Utelys garasje |
| `light_types.utelys_garasje` | Lystype ( \| dim \| ct \| color \| onoff) | Utelys › Utelys garasje |
| `lights.utelys_garasje.brightness_min` | Minste lysstyrke (%) · number | Utelys › Utelys garasje › Slider (avansert) |
| `lights.utelys_garasje.brightness_max` | Største lysstyrke (%) · number | Utelys › Utelys garasje › Slider (avansert) |
| `lights.utelys_garasje.hide_temperature_slider` | Skjul temperatur (pil) · boolean | Utelys › Utelys garasje › Slider (avansert) |
| `lights.utelys_garasje.hide_color_controls` | Skjul farge (pil) · boolean | Utelys › Utelys garasje › Slider (avansert) |
| `lights.utelys_inngang.name` | Navn | Utelys › Utelys inngang |
| `lights.utelys_inngang.icon` | Ikon · icon | Utelys › Utelys inngang |
| `light_types.utelys_inngang` | Lystype ( \| dim \| ct \| color \| onoff) | Utelys › Utelys inngang |
| `lights.utelys_inngang.brightness_min` | Minste lysstyrke (%) · number | Utelys › Utelys inngang › Slider (avansert) |
| `lights.utelys_inngang.brightness_max` | Største lysstyrke (%) · number | Utelys › Utelys inngang › Slider (avansert) |
| `lights.utelys_inngang.hide_temperature_slider` | Skjul temperatur (pil) · boolean | Utelys › Utelys inngang › Slider (avansert) |
| `lights.utelys_inngang.hide_color_controls` | Skjul farge (pil) · boolean | Utelys › Utelys inngang › Slider (avansert) |
| `lights.veranda_flomlys.name` | Navn | Utelys › Veranda flomlys |
| `lights.veranda_flomlys.icon` | Ikon · icon | Utelys › Veranda flomlys |
| `light_types.veranda_flomlys` | Lystype ( \| dim \| ct \| color \| onoff) | Utelys › Veranda flomlys |
| `lights.veranda_flomlys.brightness_min` | Minste lysstyrke (%) · number | Utelys › Veranda flomlys › Slider (avansert) |
| `lights.veranda_flomlys.brightness_max` | Største lysstyrke (%) · number | Utelys › Veranda flomlys › Slider (avansert) |
| `lights.veranda_flomlys.hide_temperature_slider` | Skjul temperatur (pil) · boolean | Utelys › Veranda flomlys › Slider (avansert) |
| `lights.veranda_flomlys.hide_color_controls` | Skjul farge (pil) · boolean | Utelys › Veranda flomlys › Slider (avansert) |
| `lights.verandalampe.name` | Navn | Utelys › Verandalampe |
| `lights.verandalampe.icon` | Ikon · icon | Utelys › Verandalampe |
| `light_types.verandalampe` | Lystype ( \| dim \| ct \| color \| onoff) | Utelys › Verandalampe |
| `lights.verandalampe.brightness_min` | Minste lysstyrke (%) · number | Utelys › Verandalampe › Slider (avansert) |
| `lights.verandalampe.brightness_max` | Største lysstyrke (%) · number | Utelys › Verandalampe › Slider (avansert) |
| `lights.verandalampe.hide_temperature_slider` | Skjul temperatur (pil) · boolean | Utelys › Verandalampe › Slider (avansert) |
| `lights.verandalampe.hide_color_controls` | Skjul farge (pil) · boolean | Utelys › Verandalampe › Slider (avansert) |

## `msh-media-hero-card`

Sveipbar «nå spilles»-karusell med omslag for valgt fane. Første kort i Media-popupen.

| Nøkkel | Betydning | Gruppe |
|---|---|---|
| `players.stue_tv.type` | Type (auto \| tv \| musikk \| skjul) | Stue TV · TV · Stue |
| `players.stue_tv.name` | Navn | Stue TV · TV · Stue |
| `players.stue_tv.icon` | Ikon · icon | Stue TV · TV · Stue |
| `players.stue_tv.platform` | Plattform (apple \| google) | Stue TV · TV · Stue |
| `players.stue_tv.remote_style` | Fjernkontroll (kompakt \| sirkel) | Stue TV · TV · Stue |
| `players.stue_tv.remote` | Fjernkontroll (remote) · entity | Stue TV · TV · Stue |
| `players.stue_tv.back_hold_action` | Hold Tilbake · action | Stue TV · TV · Stue |
| `players.stue_tv.home_hold_action` | Hold Hjem · action | Stue TV · TV · Stue |
| `players.stue_tv.menu_hold_action` | Hold Meny · action | Stue TV · TV · Stue |
| `players.stue_tv.volume` | Volum styres av (media \| buttons) | Stue TV · TV · Stue |
| `players.stue_tv.volume_up` | Volum opp · entity | Stue TV · TV · Stue |
| `players.stue_tv.volume_down` | Volum ned · entity | Stue TV · TV · Stue |
| `players.stue_tv.volume_mute` | Demp · entity | Stue TV · TV · Stue |
| `players.stue_tv.hide_sources` | Skjul apper i autokonfig (kommaseparert) | Stue TV · TV · Stue |
| `players.stue_tv.volume_sensor` | Volum-sensor (faktisk nivå) · entity | Stue TV · TV · Stue |
| `players.stue_tv.watch` | Skjermtid i dag (sensor, første brukes i kortet) · entities | Stue TV · TV · Stue |
| `watch_time.stue_tv.i_dag` | Seertid i dag (Album-kortet) · entity | Stue TV · TV · Stue |
| `watch_time.stue_tv.maned` | Seertid denne måneden (Album-kortet) · entity | Stue TV · TV · Stue |
| `players.soverom_tv.type` | Type (auto \| tv \| musikk \| skjul) | Soverom TV · TV · Soverom |
| `players.soverom_tv.name` | Navn | Soverom TV · TV · Soverom |
| `players.soverom_tv.icon` | Ikon · icon | Soverom TV · TV · Soverom |
| `players.soverom_tv.platform` | Plattform (apple \| google) | Soverom TV · TV · Soverom |
| `players.soverom_tv.remote_style` | Fjernkontroll (kompakt \| sirkel) | Soverom TV · TV · Soverom |
| `players.soverom_tv.remote` | Fjernkontroll (remote) · entity | Soverom TV · TV · Soverom |
| `players.soverom_tv.back_hold_action` | Hold Tilbake · action | Soverom TV · TV · Soverom |
| `players.soverom_tv.home_hold_action` | Hold Hjem · action | Soverom TV · TV · Soverom |
| `players.soverom_tv.menu_hold_action` | Hold Meny · action | Soverom TV · TV · Soverom |
| `players.soverom_tv.volume` | Volum styres av (media \| buttons) | Soverom TV · TV · Soverom |
| `players.soverom_tv.volume_up` | Volum opp · entity | Soverom TV · TV · Soverom |
| `players.soverom_tv.volume_down` | Volum ned · entity | Soverom TV · TV · Soverom |
| `players.soverom_tv.volume_mute` | Demp · entity | Soverom TV · TV · Soverom |
| `players.soverom_tv.hide_sources` | Skjul apper i autokonfig (kommaseparert) | Soverom TV · TV · Soverom |
| `players.soverom_tv.volume_sensor` | Volum-sensor (faktisk nivå) · entity | Soverom TV · TV · Soverom |
| `players.soverom_tv.watch` | Skjermtid i dag (sensor, første brukes i kortet) · entities | Soverom TV · TV · Soverom |
| `watch_time.soverom_tv.i_dag` | Seertid i dag (Album-kortet) · entity | Soverom TV · TV · Soverom |
| `watch_time.soverom_tv.maned` | Seertid denne måneden (Album-kortet) · entity | Soverom TV · TV · Soverom |
| `players.plex_stue.type` | Type (auto \| tv \| musikk \| skjul) | Plex (Stue) · TV |
| `players.plex_stue.name` | Navn | Plex (Stue) · TV |
| `players.plex_stue.icon` | Ikon · icon | Plex (Stue) · TV |
| `players.plex_stue.platform` | Plattform (apple \| google) | Plex (Stue) · TV |
| `players.plex_stue.remote_style` | Fjernkontroll (kompakt \| sirkel) | Plex (Stue) · TV |
| `players.plex_stue.remote` | Fjernkontroll (remote) · entity | Plex (Stue) · TV |
| `players.plex_stue.back_hold_action` | Hold Tilbake · action | Plex (Stue) · TV |
| `players.plex_stue.home_hold_action` | Hold Hjem · action | Plex (Stue) · TV |
| `players.plex_stue.menu_hold_action` | Hold Meny · action | Plex (Stue) · TV |
| `players.plex_stue.volume` | Volum styres av (media \| buttons) | Plex (Stue) · TV |
| `players.plex_stue.volume_up` | Volum opp · entity | Plex (Stue) · TV |
| `players.plex_stue.volume_down` | Volum ned · entity | Plex (Stue) · TV |
| `players.plex_stue.volume_mute` | Demp · entity | Plex (Stue) · TV |
| `players.plex_stue.hide_sources` | Skjul apper i autokonfig (kommaseparert) | Plex (Stue) · TV |
| `players.plex_stue.volume_sensor` | Volum-sensor (faktisk nivå) · entity | Plex (Stue) · TV |
| `players.plex_stue.watch` | Skjermtid i dag (sensor, første brukes i kortet) · entities | Plex (Stue) · TV |
| `watch_time.plex_stue.i_dag` | Seertid i dag (Album-kortet) · entity | Plex (Stue) · TV |
| `watch_time.plex_stue.maned` | Seertid denne måneden (Album-kortet) · entity | Plex (Stue) · TV |
| `players.prosjektor.type` | Type (auto \| tv \| musikk \| skjul) | Prosjektor · TV |
| `players.prosjektor.name` | Navn | Prosjektor · TV |
| `players.prosjektor.icon` | Ikon · icon | Prosjektor · TV |
| `players.prosjektor.platform` | Plattform (apple \| google) | Prosjektor · TV |
| `players.prosjektor.remote_style` | Fjernkontroll (kompakt \| sirkel) | Prosjektor · TV |
| `players.prosjektor.remote` | Fjernkontroll (remote) · entity | Prosjektor · TV |
| `players.prosjektor.back_hold_action` | Hold Tilbake · action | Prosjektor · TV |
| `players.prosjektor.home_hold_action` | Hold Hjem · action | Prosjektor · TV |
| `players.prosjektor.menu_hold_action` | Hold Meny · action | Prosjektor · TV |
| `players.prosjektor.volume` | Volum styres av (media \| buttons) | Prosjektor · TV |
| `players.prosjektor.volume_up` | Volum opp · entity | Prosjektor · TV |
| `players.prosjektor.volume_down` | Volum ned · entity | Prosjektor · TV |
| `players.prosjektor.volume_mute` | Demp · entity | Prosjektor · TV |
| `players.prosjektor.hide_sources` | Skjul apper i autokonfig (kommaseparert) | Prosjektor · TV |
| `players.prosjektor.volume_sensor` | Volum-sensor (faktisk nivå) · entity | Prosjektor · TV |
| `players.prosjektor.watch` | Skjermtid i dag (sensor, første brukes i kortet) · entities | Prosjektor · TV |
| `watch_time.prosjektor.i_dag` | Seertid i dag (Album-kortet) · entity | Prosjektor · TV |
| `watch_time.prosjektor.maned` | Seertid denne måneden (Album-kortet) · entity | Prosjektor · TV |
| `tab_order · hidden_tabs` | rekkefølge/synlighet: tv, musikk | Faner |
| `exclude · include.{spillere}` | skjul / legg til |  |
| `area` | Begrens til område · area |  |
| `now_playing.style` | Spilles nå-kort (album \| detailed) |  |
| `card_height` | Kortets høyde (Detaljert) · range |  |
| `vol_style` | Volum-stil · Musikk (pille \| trinn \| user) |  |
| `vol_style_tv` | Volum-stil · TV (trinn \| knapper \| user) |  |
| `remote_swipe` | Sveip på styreflaten · boolean |  |
| `toasts` | Bekreftelsesmeldinger · boolean |  |

## `msh-media-card`

Faner (TV/Musikk), apper/kilder, transport eller fjernkontroll og volum for alle media_player.*

| Nøkkel | Betydning | Gruppe |
|---|---|---|
| `players.stue_tv.type` | Type (auto \| tv \| musikk \| skjul) | Stue TV · TV · Stue |
| `players.stue_tv.name` | Navn | Stue TV · TV · Stue |
| `players.stue_tv.icon` | Ikon · icon | Stue TV · TV · Stue |
| `players.stue_tv.platform` | Plattform (apple \| google) | Stue TV · TV · Stue |
| `players.stue_tv.remote_style` | Fjernkontroll (kompakt \| sirkel) | Stue TV · TV · Stue |
| `players.stue_tv.remote` | Fjernkontroll (remote) · entity | Stue TV · TV · Stue |
| `players.stue_tv.back_hold_action` | Hold Tilbake · action | Stue TV · TV · Stue |
| `players.stue_tv.home_hold_action` | Hold Hjem · action | Stue TV · TV · Stue |
| `players.stue_tv.menu_hold_action` | Hold Meny · action | Stue TV · TV · Stue |
| `players.stue_tv.volume` | Volum styres av (media \| buttons) | Stue TV · TV · Stue |
| `players.stue_tv.volume_up` | Volum opp · entity | Stue TV · TV · Stue |
| `players.stue_tv.volume_down` | Volum ned · entity | Stue TV · TV · Stue |
| `players.stue_tv.volume_mute` | Demp · entity | Stue TV · TV · Stue |
| `players.stue_tv.hide_sources` | Skjul apper i autokonfig (kommaseparert) | Stue TV · TV · Stue |
| `players.stue_tv.volume_sensor` | Volum-sensor (faktisk nivå) · entity | Stue TV · TV · Stue |
| `players.stue_tv.watch` | Skjermtid i dag (sensor, første brukes i kortet) · entities | Stue TV · TV · Stue |
| `watch_time.stue_tv.i_dag` | Seertid i dag (Album-kortet) · entity | Stue TV · TV · Stue |
| `watch_time.stue_tv.maned` | Seertid denne måneden (Album-kortet) · entity | Stue TV · TV · Stue |
| `players.soverom_tv.type` | Type (auto \| tv \| musikk \| skjul) | Soverom TV · TV · Soverom |
| `players.soverom_tv.name` | Navn | Soverom TV · TV · Soverom |
| `players.soverom_tv.icon` | Ikon · icon | Soverom TV · TV · Soverom |
| `players.soverom_tv.platform` | Plattform (apple \| google) | Soverom TV · TV · Soverom |
| `players.soverom_tv.remote_style` | Fjernkontroll (kompakt \| sirkel) | Soverom TV · TV · Soverom |
| `players.soverom_tv.remote` | Fjernkontroll (remote) · entity | Soverom TV · TV · Soverom |
| `players.soverom_tv.back_hold_action` | Hold Tilbake · action | Soverom TV · TV · Soverom |
| `players.soverom_tv.home_hold_action` | Hold Hjem · action | Soverom TV · TV · Soverom |
| `players.soverom_tv.menu_hold_action` | Hold Meny · action | Soverom TV · TV · Soverom |
| `players.soverom_tv.volume` | Volum styres av (media \| buttons) | Soverom TV · TV · Soverom |
| `players.soverom_tv.volume_up` | Volum opp · entity | Soverom TV · TV · Soverom |
| `players.soverom_tv.volume_down` | Volum ned · entity | Soverom TV · TV · Soverom |
| `players.soverom_tv.volume_mute` | Demp · entity | Soverom TV · TV · Soverom |
| `players.soverom_tv.hide_sources` | Skjul apper i autokonfig (kommaseparert) | Soverom TV · TV · Soverom |
| `players.soverom_tv.volume_sensor` | Volum-sensor (faktisk nivå) · entity | Soverom TV · TV · Soverom |
| `players.soverom_tv.watch` | Skjermtid i dag (sensor, første brukes i kortet) · entities | Soverom TV · TV · Soverom |
| `watch_time.soverom_tv.i_dag` | Seertid i dag (Album-kortet) · entity | Soverom TV · TV · Soverom |
| `watch_time.soverom_tv.maned` | Seertid denne måneden (Album-kortet) · entity | Soverom TV · TV · Soverom |
| `players.plex_stue.type` | Type (auto \| tv \| musikk \| skjul) | Plex (Stue) · TV |
| `players.plex_stue.name` | Navn | Plex (Stue) · TV |
| `players.plex_stue.icon` | Ikon · icon | Plex (Stue) · TV |
| `players.plex_stue.platform` | Plattform (apple \| google) | Plex (Stue) · TV |
| `players.plex_stue.remote_style` | Fjernkontroll (kompakt \| sirkel) | Plex (Stue) · TV |
| `players.plex_stue.remote` | Fjernkontroll (remote) · entity | Plex (Stue) · TV |
| `players.plex_stue.back_hold_action` | Hold Tilbake · action | Plex (Stue) · TV |
| `players.plex_stue.home_hold_action` | Hold Hjem · action | Plex (Stue) · TV |
| `players.plex_stue.menu_hold_action` | Hold Meny · action | Plex (Stue) · TV |
| `players.plex_stue.volume` | Volum styres av (media \| buttons) | Plex (Stue) · TV |
| `players.plex_stue.volume_up` | Volum opp · entity | Plex (Stue) · TV |
| `players.plex_stue.volume_down` | Volum ned · entity | Plex (Stue) · TV |
| `players.plex_stue.volume_mute` | Demp · entity | Plex (Stue) · TV |
| `players.plex_stue.hide_sources` | Skjul apper i autokonfig (kommaseparert) | Plex (Stue) · TV |
| `players.plex_stue.volume_sensor` | Volum-sensor (faktisk nivå) · entity | Plex (Stue) · TV |
| `players.plex_stue.watch` | Skjermtid i dag (sensor, første brukes i kortet) · entities | Plex (Stue) · TV |
| `watch_time.plex_stue.i_dag` | Seertid i dag (Album-kortet) · entity | Plex (Stue) · TV |
| `watch_time.plex_stue.maned` | Seertid denne måneden (Album-kortet) · entity | Plex (Stue) · TV |
| `players.prosjektor.type` | Type (auto \| tv \| musikk \| skjul) | Prosjektor · TV |
| `players.prosjektor.name` | Navn | Prosjektor · TV |
| `players.prosjektor.icon` | Ikon · icon | Prosjektor · TV |
| `players.prosjektor.platform` | Plattform (apple \| google) | Prosjektor · TV |
| `players.prosjektor.remote_style` | Fjernkontroll (kompakt \| sirkel) | Prosjektor · TV |
| `players.prosjektor.remote` | Fjernkontroll (remote) · entity | Prosjektor · TV |
| `players.prosjektor.back_hold_action` | Hold Tilbake · action | Prosjektor · TV |
| `players.prosjektor.home_hold_action` | Hold Hjem · action | Prosjektor · TV |
| `players.prosjektor.menu_hold_action` | Hold Meny · action | Prosjektor · TV |
| `players.prosjektor.volume` | Volum styres av (media \| buttons) | Prosjektor · TV |
| `players.prosjektor.volume_up` | Volum opp · entity | Prosjektor · TV |
| `players.prosjektor.volume_down` | Volum ned · entity | Prosjektor · TV |
| `players.prosjektor.volume_mute` | Demp · entity | Prosjektor · TV |
| `players.prosjektor.hide_sources` | Skjul apper i autokonfig (kommaseparert) | Prosjektor · TV |
| `players.prosjektor.volume_sensor` | Volum-sensor (faktisk nivå) · entity | Prosjektor · TV |
| `players.prosjektor.watch` | Skjermtid i dag (sensor, første brukes i kortet) · entities | Prosjektor · TV |
| `watch_time.prosjektor.i_dag` | Seertid i dag (Album-kortet) · entity | Prosjektor · TV |
| `watch_time.prosjektor.maned` | Seertid denne måneden (Album-kortet) · entity | Prosjektor · TV |
| `tab_order · hidden_tabs` | rekkefølge/synlighet: tv, musikk | Faner |
| `exclude · include.{spillere}` | skjul / legg til |  |
| `area` | Begrens til område · area |  |
| `now_playing.style` | Spilles nå-kort (album \| detailed) |  |
| `card_height` | Kortets høyde (Detaljert) · range |  |
| `vol_style` | Volum-stil · Musikk (pille \| trinn \| user) |  |
| `vol_style_tv` | Volum-stil · TV (trinn \| knapper \| user) |  |
| `remote_swipe` | Sveip på styreflaten · boolean |  |
| `toasts` | Bekreftelsesmeldinger · boolean |  |
| `gap` | 4 / 8 / 18 px |  |
| `gap` | Mellom seksjonene · range | Mellomrom |
| `pad_top` | Fra popup-headeren til første kort · range | Mellomrom |
| `pad_bottom` | Luft i bunnen (over navbaren) · range | Mellomrom |

## `msh-kamera-card`

Kamera-popup eller eget kamera-dashbord: alle camera.* med mosaikk/rutenett/liste, enkeltkamera, hendelser og Frigate. Stillbilder oppdateres kun mens popupen er åpen.

| Nøkkel | Betydning | Gruppe |
|---|---|---|
| `profile` | Profil (auto \| popup \| dashboard) | Profil |
| `title` | Tittel (dashbord) | Profil |
| `back_path` | «Tilbake»-knapp (dashbord) | Profil |
| `fill_screen` | Fyll skjermen (flere kolonner på bred skjerm) · boolean | Profil |
| `fill_breakpoint` | Bredde for flere kolonner (px) · number | Profil |
| `layout` | Oppsett (mosaic \| main \| grid \| list \| masonry \| overview \| focus \| 2x2 \| 3col) | Visning |
| `tab_order · tab_hidden` | rekkefølge/synlighet: live, frigate | Visning |
| `view` | Startvisning (alle \| events) | Visning |
| `refresh` | Oppdater stillbilder (sekunder) · number | Visning |
| `frigate_instance` | Frigate-instans | Visning |
| `area` | Begrens til område · area | Visning |
| `toasts` | Bekreftelsesmeldinger · boolean | Visning |
| `cam_gap` | Mellomrom mellom kameraer · range | Utseende |
| `padT` | Fra popup-headeren til første kort · range | Utseende |
| `show_name` | Vis navn på kameraene · boolean | Utseende |
| `show_badge` | Vis «OPPTAK»-merke · boolean | Utseende |
| `text_size` | Tekststørrelse (xs \| s \| m \| l) | Utseende |
| `show_events` | Vis «Hendelser» · boolean | Hendelser |
| `events_limit` | Maks antall hendelser · number | Hendelser |
| `events_columns` | Kolonner · number | Hendelser |
| `events_height` | Maks høyde | Hendelser |
| `order · hidden` | rekkefølge/synlighet: camera.inngang, camera.inngang_package_camera, camera.pakke, camera.veranda, camera.garasje, camera.hage_high, camera.innkjorsel_high, camera.ringeklokke_high |  |
| `names.camera\.inngang` | camera.inngang | Navn på kameraene |
| `names.camera\.inngang_package_camera` | camera.inngang_package_camera | Navn på kameraene |
| `names.camera\.pakke` | camera.pakke | Navn på kameraene |
| `names.camera\.veranda` | camera.veranda | Navn på kameraene |
| `names.camera\.garasje` | camera.garasje | Navn på kameraene |
| `names.camera\.hage_high` | camera.hage_high | Navn på kameraene |
| `names.camera\.innkjorsel_high` | camera.innkjorsel_high | Navn på kameraene |
| `names.camera\.ringeklokke_high` | camera.ringeklokke_high | Navn på kameraene |
| `exclude · include.{kameraer}` | skjul / legg til |  |
| `names.camera\.inngang` | Navn | Ringeklokke · G6 Entry |
| `cameras.inngang.icon` | Ikon · icon | Ringeklokke · G6 Entry |
| `cameras.inngang.light` | Lys · entity | Ringeklokke · G6 Entry |
| `cameras.inngang.siren` | Sirene · entity | Ringeklokke · G6 Entry |
| `cameras.inngang.talk` | Snakk (script/button) · entity | Ringeklokke · G6 Entry |
| `cameras.inngang.privacy` | Personvern-modus · entity | Ringeklokke · G6 Entry |
| `cameras.inngang.motion` | Bevegelse · entity | Ringeklokke · G6 Entry |
| `cameras.inngang.last_motion` | Siste bevegelse · entity | Ringeklokke · G6 Entry |
| `names.camera\.inngang_package_camera` | Navn | Ringeklokke · Pakke · inngang |
| `cameras.inngang_package_camera.icon` | Ikon · icon | Ringeklokke · Pakke · inngang |
| `cameras.inngang_package_camera.light` | Lys · entity | Ringeklokke · Pakke · inngang |
| `cameras.inngang_package_camera.siren` | Sirene · entity | Ringeklokke · Pakke · inngang |
| `cameras.inngang_package_camera.talk` | Snakk (script/button) · entity | Ringeklokke · Pakke · inngang |
| `cameras.inngang_package_camera.privacy` | Personvern-modus · entity | Ringeklokke · Pakke · inngang |
| `cameras.inngang_package_camera.motion` | Bevegelse · entity | Ringeklokke · Pakke · inngang |
| `cameras.inngang_package_camera.last_motion` | Siste bevegelse · entity | Ringeklokke · Pakke · inngang |
| `names.camera\.pakke` | Navn | Ringeklokke · Pakke · pakke |
| `cameras.pakke.icon` | Ikon · icon | Ringeklokke · Pakke · pakke |
| `cameras.pakke.light` | Lys · entity | Ringeklokke · Pakke · pakke |
| `cameras.pakke.siren` | Sirene · entity | Ringeklokke · Pakke · pakke |
| `cameras.pakke.talk` | Snakk (script/button) · entity | Ringeklokke · Pakke · pakke |
| `cameras.pakke.privacy` | Personvern-modus · entity | Ringeklokke · Pakke · pakke |
| `cameras.pakke.motion` | Bevegelse · entity | Ringeklokke · Pakke · pakke |
| `cameras.pakke.last_motion` | Siste bevegelse · entity | Ringeklokke · Pakke · pakke |
| `names.camera\.veranda` | Navn | Veranda |
| `cameras.veranda.icon` | Ikon · icon | Veranda |
| `cameras.veranda.light` | Lys · entity | Veranda |
| `cameras.veranda.siren` | Sirene · entity | Veranda |
| `cameras.veranda.talk` | Snakk (script/button) · entity | Veranda |
| `cameras.veranda.privacy` | Personvern-modus · entity | Veranda |
| `cameras.veranda.motion` | Bevegelse · entity | Veranda |
| `cameras.veranda.last_motion` | Siste bevegelse · entity | Veranda |
| `names.camera\.garasje` | Navn | Garasje |
| `cameras.garasje.icon` | Ikon · icon | Garasje |
| `cameras.garasje.light` | Lys · entity | Garasje |
| `cameras.garasje.siren` | Sirene · entity | Garasje |
| `cameras.garasje.talk` | Snakk (script/button) · entity | Garasje |
| `cameras.garasje.privacy` | Personvern-modus · entity | Garasje |
| `cameras.garasje.motion` | Bevegelse · entity | Garasje |
| `cameras.garasje.last_motion` | Siste bevegelse · entity | Garasje |
| `names.camera\.hage_high` | Navn | Hage |
| `cameras.hage_high.icon` | Ikon · icon | Hage |
| `cameras.hage_high.light` | Lys · entity | Hage |
| `cameras.hage_high.siren` | Sirene · entity | Hage |
| `cameras.hage_high.talk` | Snakk (script/button) · entity | Hage |
| `cameras.hage_high.privacy` | Personvern-modus · entity | Hage |
| `cameras.hage_high.motion` | Bevegelse · entity | Hage |
| `cameras.hage_high.last_motion` | Siste bevegelse · entity | Hage |
| `names.camera\.innkjorsel_high` | Navn | Innkjørsel |
| `cameras.innkjorsel_high.icon` | Ikon · icon | Innkjørsel |
| `cameras.innkjorsel_high.light` | Lys · entity | Innkjørsel |
| `cameras.innkjorsel_high.siren` | Sirene · entity | Innkjørsel |
| `cameras.innkjorsel_high.talk` | Snakk (script/button) · entity | Innkjørsel |
| `cameras.innkjorsel_high.privacy` | Personvern-modus · entity | Innkjørsel |
| `cameras.innkjorsel_high.motion` | Bevegelse · entity | Innkjørsel |
| `cameras.innkjorsel_high.last_motion` | Siste bevegelse · entity | Innkjørsel |
| `names.camera\.ringeklokke_high` | Navn | Ringeklokke · G4 Doorbell Pro |
| `cameras.ringeklokke_high.icon` | Ikon · icon | Ringeklokke · G4 Doorbell Pro |
| `cameras.ringeklokke_high.light` | Lys · entity | Ringeklokke · G4 Doorbell Pro |
| `cameras.ringeklokke_high.siren` | Sirene · entity | Ringeklokke · G4 Doorbell Pro |
| `cameras.ringeklokke_high.talk` | Snakk (script/button) · entity | Ringeklokke · G4 Doorbell Pro |
| `cameras.ringeklokke_high.privacy` | Personvern-modus · entity | Ringeklokke · G4 Doorbell Pro |
| `cameras.ringeklokke_high.motion` | Bevegelse · entity | Ringeklokke · G4 Doorbell Pro |
| `cameras.ringeklokke_high.last_motion` | Siste bevegelse · entity | Ringeklokke · G4 Doorbell Pro |
| `pad_bottom` | Luft i bunnen (over navbaren) · range | Mellomrom |

## `msh-sikkerhet-hero-card`

Toppkort for #sikkerhet: sensorring, alarmmodus og status. Legges først i popupen.

| Nøkkel | Betydning | Gruppe |
|---|---|---|
| `overrides.{alarm}` | bytt entitet |  |
| `exclude · include.{sensorer}` | skjul / legg til |  |
| `sensors.binary_sensor.inngangsdor.name` | Navn | Sensorer · navn, type og rom › Gang · 6 |
| `sensors.binary_sensor.inngangsdor.type` | Type (door \| window \| lock \| motion \| presence) | Sensorer · navn, type og rom › Gang · 6 |
| `sensors.binary_sensor.inngangsdor.room` | Rom | Sensorer · navn, type og rom › Gang · 6 |
| `sensors.binary_sensor.gang_ytterdor.name` | Navn | Sensorer · navn, type og rom › Gang · 6 |
| `sensors.binary_sensor.gang_ytterdor.type` | Type (door \| window \| lock \| motion \| presence) | Sensorer · navn, type og rom › Gang · 6 |
| `sensors.binary_sensor.gang_ytterdor.room` | Rom | Sensorer · navn, type og rom › Gang · 6 |
| `sensors.lock.inngangsdor.name` | Navn | Sensorer · navn, type og rom › Gang · 6 |
| `sensors.lock.inngangsdor.type` | Type (door \| window \| lock \| motion \| presence) | Sensorer · navn, type og rom › Gang · 6 |
| `sensors.lock.inngangsdor.room` | Rom | Sensorer · navn, type og rom › Gang · 6 |
| `sensors.binary_sensor.gang_bevegelse.name` | Navn | Sensorer · navn, type og rom › Gang · 6 |
| `sensors.binary_sensor.gang_bevegelse.type` | Type (door \| window \| lock \| motion \| presence) | Sensorer · navn, type og rom › Gang · 6 |
| `sensors.binary_sensor.gang_bevegelse.room` | Rom | Sensorer · navn, type og rom › Gang · 6 |
| `sensors.binary_sensor.inngang_bevegelse.name` | Navn | Sensorer · navn, type og rom › Gang · 6 |
| `sensors.binary_sensor.inngang_bevegelse.type` | Type (door \| window \| lock \| motion \| presence) | Sensorer · navn, type og rom › Gang · 6 |
| `sensors.binary_sensor.inngang_bevegelse.room` | Rom | Sensorer · navn, type og rom › Gang · 6 |
| `sensors.binary_sensor.inngang_person.name` | Navn | Sensorer · navn, type og rom › Gang · 6 |
| `sensors.binary_sensor.inngang_person.type` | Type (door \| window \| lock \| motion \| presence) | Sensorer · navn, type og rom › Gang · 6 |
| `sensors.binary_sensor.inngang_person.room` | Rom | Sensorer · navn, type og rom › Gang · 6 |
| `sensors.binary_sensor.kjokken_vindu.name` | Navn | Sensorer · navn, type og rom › Kjøkken · 1 |
| `sensors.binary_sensor.kjokken_vindu.type` | Type (door \| window \| lock \| motion \| presence) | Sensorer · navn, type og rom › Kjøkken · 1 |
| `sensors.binary_sensor.kjokken_vindu.room` | Rom | Sensorer · navn, type og rom › Kjøkken · 1 |
| `sensors.binary_sensor.stue_vindu.name` | Navn | Sensorer · navn, type og rom › Stue · 3 |
| `sensors.binary_sensor.stue_vindu.type` | Type (door \| window \| lock \| motion \| presence) | Sensorer · navn, type og rom › Stue · 3 |
| `sensors.binary_sensor.stue_vindu.room` | Rom | Sensorer · navn, type og rom › Stue · 3 |
| `sensors.binary_sensor.stue_bevegelse.name` | Navn | Sensorer · navn, type og rom › Stue · 3 |
| `sensors.binary_sensor.stue_bevegelse.type` | Type (door \| window \| lock \| motion \| presence) | Sensorer · navn, type og rom › Stue · 3 |
| `sensors.binary_sensor.stue_bevegelse.room` | Rom | Sensorer · navn, type og rom › Stue · 3 |
| `sensors.binary_sensor.stue_tilstede.name` | Navn | Sensorer · navn, type og rom › Stue · 3 |
| `sensors.binary_sensor.stue_tilstede.type` | Type (door \| window \| lock \| motion \| presence) | Sensorer · navn, type og rom › Stue · 3 |
| `sensors.binary_sensor.stue_tilstede.room` | Rom | Sensorer · navn, type og rom › Stue · 3 |
| `sensors.binary_sensor.soverom_vindu.name` | Navn | Sensorer · navn, type og rom › Soverom · 2 |
| `sensors.binary_sensor.soverom_vindu.type` | Type (door \| window \| lock \| motion \| presence) | Sensorer · navn, type og rom › Soverom · 2 |
| `sensors.binary_sensor.soverom_vindu.room` | Rom | Sensorer · navn, type og rom › Soverom · 2 |
| `sensors.binary_sensor.vindu_soverom.name` | Navn | Sensorer · navn, type og rom › Soverom · 2 |
| `sensors.binary_sensor.vindu_soverom.type` | Type (door \| window \| lock \| motion \| presence) | Sensorer · navn, type og rom › Soverom · 2 |
| `sensors.binary_sensor.vindu_soverom.room` | Rom | Sensorer · navn, type og rom › Soverom · 2 |
| `sensors.binary_sensor.garasjeport.name` | Navn | Sensorer · navn, type og rom › Annet · 6 |
| `sensors.binary_sensor.garasjeport.type` | Type (door \| window \| lock \| motion \| presence) | Sensorer · navn, type og rom › Annet · 6 |
| `sensors.binary_sensor.garasjeport.room` | Rom | Sensorer · navn, type og rom › Annet · 6 |
| `sensors.lock.bod.name` | Navn | Sensorer · navn, type og rom › Annet · 6 |
| `sensors.lock.bod.type` | Type (door \| window \| lock \| motion \| presence) | Sensorer · navn, type og rom › Annet · 6 |
| `sensors.lock.bod.room` | Rom | Sensorer · navn, type og rom › Annet · 6 |
| `sensors.binary_sensor.hage_motion.name` | Navn | Sensorer · navn, type og rom › Annet · 6 |
| `sensors.binary_sensor.hage_motion.type` | Type (door \| window \| lock \| motion \| presence) | Sensorer · navn, type og rom › Annet · 6 |
| `sensors.binary_sensor.hage_motion.room` | Rom | Sensorer · navn, type og rom › Annet · 6 |
| `sensors.binary_sensor.innkjorsel_motion.name` | Navn | Sensorer · navn, type og rom › Annet · 6 |
| `sensors.binary_sensor.innkjorsel_motion.type` | Type (door \| window \| lock \| motion \| presence) | Sensorer · navn, type og rom › Annet · 6 |
| `sensors.binary_sensor.innkjorsel_motion.room` | Rom | Sensorer · navn, type og rom › Annet · 6 |
| `sensors.binary_sensor.ringeklokke_motion.name` | Navn | Sensorer · navn, type og rom › Annet · 6 |
| `sensors.binary_sensor.ringeklokke_motion.type` | Type (door \| window \| lock \| motion \| presence) | Sensorer · navn, type og rom › Annet · 6 |
| `sensors.binary_sensor.ringeklokke_motion.room` | Rom | Sensorer · navn, type og rom › Annet · 6 |
| `sensors.binary_sensor.ringeklokke_doorbell.name` | Navn | Sensorer · navn, type og rom › Annet · 6 |
| `sensors.binary_sensor.ringeklokke_doorbell.type` | Type (door \| window \| lock \| motion \| presence) | Sensorer · navn, type og rom › Annet · 6 |
| `sensors.binary_sensor.ringeklokke_doorbell.room` | Rom | Sensorer · navn, type og rom › Annet · 6 |
| `show_ring` | Sensorring · stor ring med alle sensorer · boolean | Visning |

## `msh-sikkerhet-card`

Alarmmodus (hold inne, kode via tastatur), rom og sensorer (status, rom/type) og siste hendelser. #sikkerhet

| Nøkkel | Betydning | Gruppe |
|---|---|---|
| `overrides.{alarm}` | bytt entitet |  |
| `state_entity` | Status-entitet · entity | Status og tekst |
| `code_for` | Krev kode (alle \| av \| aldri) | Kode |
| `code_length` | Kodelengde (4 \| 6) | Kode |
| `exclude · include.{sensorer}` | skjul / legg til |  |
| `sensors.binary_sensor.inngangsdor.name` | Navn | Sensorer · navn, type og rom › Gang · 6 |
| `sensors.binary_sensor.inngangsdor.type` | Type (door \| window \| lock \| motion \| presence) | Sensorer · navn, type og rom › Gang · 6 |
| `sensors.binary_sensor.inngangsdor.room` | Rom | Sensorer · navn, type og rom › Gang · 6 |
| `sensors.binary_sensor.gang_ytterdor.name` | Navn | Sensorer · navn, type og rom › Gang · 6 |
| `sensors.binary_sensor.gang_ytterdor.type` | Type (door \| window \| lock \| motion \| presence) | Sensorer · navn, type og rom › Gang · 6 |
| `sensors.binary_sensor.gang_ytterdor.room` | Rom | Sensorer · navn, type og rom › Gang · 6 |
| `sensors.lock.inngangsdor.name` | Navn | Sensorer · navn, type og rom › Gang · 6 |
| `sensors.lock.inngangsdor.type` | Type (door \| window \| lock \| motion \| presence) | Sensorer · navn, type og rom › Gang · 6 |
| `sensors.lock.inngangsdor.room` | Rom | Sensorer · navn, type og rom › Gang · 6 |
| `sensors.binary_sensor.gang_bevegelse.name` | Navn | Sensorer · navn, type og rom › Gang · 6 |
| `sensors.binary_sensor.gang_bevegelse.type` | Type (door \| window \| lock \| motion \| presence) | Sensorer · navn, type og rom › Gang · 6 |
| `sensors.binary_sensor.gang_bevegelse.room` | Rom | Sensorer · navn, type og rom › Gang · 6 |
| `sensors.binary_sensor.inngang_bevegelse.name` | Navn | Sensorer · navn, type og rom › Gang · 6 |
| `sensors.binary_sensor.inngang_bevegelse.type` | Type (door \| window \| lock \| motion \| presence) | Sensorer · navn, type og rom › Gang · 6 |
| `sensors.binary_sensor.inngang_bevegelse.room` | Rom | Sensorer · navn, type og rom › Gang · 6 |
| `sensors.binary_sensor.inngang_person.name` | Navn | Sensorer · navn, type og rom › Gang · 6 |
| `sensors.binary_sensor.inngang_person.type` | Type (door \| window \| lock \| motion \| presence) | Sensorer · navn, type og rom › Gang · 6 |
| `sensors.binary_sensor.inngang_person.room` | Rom | Sensorer · navn, type og rom › Gang · 6 |
| `sensors.binary_sensor.kjokken_vindu.name` | Navn | Sensorer · navn, type og rom › Kjøkken · 1 |
| `sensors.binary_sensor.kjokken_vindu.type` | Type (door \| window \| lock \| motion \| presence) | Sensorer · navn, type og rom › Kjøkken · 1 |
| `sensors.binary_sensor.kjokken_vindu.room` | Rom | Sensorer · navn, type og rom › Kjøkken · 1 |
| `sensors.binary_sensor.stue_vindu.name` | Navn | Sensorer · navn, type og rom › Stue · 3 |
| `sensors.binary_sensor.stue_vindu.type` | Type (door \| window \| lock \| motion \| presence) | Sensorer · navn, type og rom › Stue · 3 |
| `sensors.binary_sensor.stue_vindu.room` | Rom | Sensorer · navn, type og rom › Stue · 3 |
| `sensors.binary_sensor.stue_bevegelse.name` | Navn | Sensorer · navn, type og rom › Stue · 3 |
| `sensors.binary_sensor.stue_bevegelse.type` | Type (door \| window \| lock \| motion \| presence) | Sensorer · navn, type og rom › Stue · 3 |
| `sensors.binary_sensor.stue_bevegelse.room` | Rom | Sensorer · navn, type og rom › Stue · 3 |
| `sensors.binary_sensor.stue_tilstede.name` | Navn | Sensorer · navn, type og rom › Stue · 3 |
| `sensors.binary_sensor.stue_tilstede.type` | Type (door \| window \| lock \| motion \| presence) | Sensorer · navn, type og rom › Stue · 3 |
| `sensors.binary_sensor.stue_tilstede.room` | Rom | Sensorer · navn, type og rom › Stue · 3 |
| `sensors.binary_sensor.soverom_vindu.name` | Navn | Sensorer · navn, type og rom › Soverom · 2 |
| `sensors.binary_sensor.soverom_vindu.type` | Type (door \| window \| lock \| motion \| presence) | Sensorer · navn, type og rom › Soverom · 2 |
| `sensors.binary_sensor.soverom_vindu.room` | Rom | Sensorer · navn, type og rom › Soverom · 2 |
| `sensors.binary_sensor.vindu_soverom.name` | Navn | Sensorer · navn, type og rom › Soverom · 2 |
| `sensors.binary_sensor.vindu_soverom.type` | Type (door \| window \| lock \| motion \| presence) | Sensorer · navn, type og rom › Soverom · 2 |
| `sensors.binary_sensor.vindu_soverom.room` | Rom | Sensorer · navn, type og rom › Soverom · 2 |
| `sensors.binary_sensor.garasjeport.name` | Navn | Sensorer · navn, type og rom › Annet · 6 |
| `sensors.binary_sensor.garasjeport.type` | Type (door \| window \| lock \| motion \| presence) | Sensorer · navn, type og rom › Annet · 6 |
| `sensors.binary_sensor.garasjeport.room` | Rom | Sensorer · navn, type og rom › Annet · 6 |
| `sensors.lock.bod.name` | Navn | Sensorer · navn, type og rom › Annet · 6 |
| `sensors.lock.bod.type` | Type (door \| window \| lock \| motion \| presence) | Sensorer · navn, type og rom › Annet · 6 |
| `sensors.lock.bod.room` | Rom | Sensorer · navn, type og rom › Annet · 6 |
| `sensors.binary_sensor.hage_motion.name` | Navn | Sensorer · navn, type og rom › Annet · 6 |
| `sensors.binary_sensor.hage_motion.type` | Type (door \| window \| lock \| motion \| presence) | Sensorer · navn, type og rom › Annet · 6 |
| `sensors.binary_sensor.hage_motion.room` | Rom | Sensorer · navn, type og rom › Annet · 6 |
| `sensors.binary_sensor.innkjorsel_motion.name` | Navn | Sensorer · navn, type og rom › Annet · 6 |
| `sensors.binary_sensor.innkjorsel_motion.type` | Type (door \| window \| lock \| motion \| presence) | Sensorer · navn, type og rom › Annet · 6 |
| `sensors.binary_sensor.innkjorsel_motion.room` | Rom | Sensorer · navn, type og rom › Annet · 6 |
| `sensors.binary_sensor.ringeklokke_motion.name` | Navn | Sensorer · navn, type og rom › Annet · 6 |
| `sensors.binary_sensor.ringeklokke_motion.type` | Type (door \| window \| lock \| motion \| presence) | Sensorer · navn, type og rom › Annet · 6 |
| `sensors.binary_sensor.ringeklokke_motion.room` | Rom | Sensorer · navn, type og rom › Annet · 6 |
| `sensors.binary_sensor.ringeklokke_doorbell.name` | Navn | Sensorer · navn, type og rom › Annet · 6 |
| `sensors.binary_sensor.ringeklokke_doorbell.type` | Type (door \| window \| lock \| motion \| presence) | Sensorer · navn, type og rom › Annet · 6 |
| `sensors.binary_sensor.ringeklokke_doorbell.room` | Rom | Sensorer · navn, type og rom › Annet · 6 |
| `unlock_sensor` | Hvem låste opp · entity | Siste hendelser · hvem låste opp |
| `sections · hidden_sections` | rekkefølge/synlighet: modes, rooms, log, edit |  |
| `show_hint` | Hjelpetekst · «Hold inne for å bytte modus» · boolean | Visning |
| `show_log` | Siste hendelser · logg nederst · boolean | Visning |
| `room_view` | Rom-seksjonen viser først (rom \| type) | Visning |
| `toasts` | Bekreftelsesmeldinger (toast) · boolean | Visning |
| `gap` | 4 / 8 / 18 px |  |
| `gap` | Mellom seksjonene · range | Mellomrom |
| `pad_top` | Fra popup-headeren til første kort · range | Mellomrom |
| `pad_bottom` | Luft i bunnen (over navbaren) · range | Mellomrom |

## `msh-ruter-card`

Avvik (Entur SX) og avganger per stopp (Entur). #ruter

| Nøkkel | Betydning | Gruppe |
|---|---|---|
| `exclude · include.{stopp, linjer}` | skjul / legg til |  |
| `stop_order · exclude` | rekkefølge/synlighet: sensor.entur_bislett, sensor.entur_stoppested, sensor.entur_holbergs_plass |  |
| `stops.entur_bislett.name` | Navn | Stopp · navn, ikon, gangtid og linjer › Bislett |
| `stops.entur_bislett.icon` | Ikon · icon | Stopp · navn, ikon, gangtid og linjer › Bislett |
| `stops.entur_bislett.walk` | Gangtid / tekst | Stopp · navn, ikon, gangtid og linjer › Bislett |
| `stops.entur_bislett.walk_min` | Gangtid (min) · tomt = tall fra teksten · number | Stopp · navn, ikon, gangtid og linjer › Bislett |
| `stops.entur_bislett.lines` | Linjer (line_whitelist) · tomt = alle | Stopp · navn, ikon, gangtid og linjer › Bislett |
| `stops.entur_bislett.count` | Antall avganger · number | Stopp · navn, ikon, gangtid og linjer › Bislett |
| `stops.entur_stoppested.name` | Navn | Stopp · navn, ikon, gangtid og linjer › Majorstuen |
| `stops.entur_stoppested.icon` | Ikon · icon | Stopp · navn, ikon, gangtid og linjer › Majorstuen |
| `stops.entur_stoppested.walk` | Gangtid / tekst | Stopp · navn, ikon, gangtid og linjer › Majorstuen |
| `stops.entur_stoppested.walk_min` | Gangtid (min) · tomt = tall fra teksten · number | Stopp · navn, ikon, gangtid og linjer › Majorstuen |
| `stops.entur_stoppested.lines` | Linjer (line_whitelist) · tomt = alle | Stopp · navn, ikon, gangtid og linjer › Majorstuen |
| `stops.entur_stoppested.count` | Antall avganger · number | Stopp · navn, ikon, gangtid og linjer › Majorstuen |
| `stops.entur_holbergs_plass.name` | Navn | Stopp · navn, ikon, gangtid og linjer › Holbergs plass |
| `stops.entur_holbergs_plass.icon` | Ikon · icon | Stopp · navn, ikon, gangtid og linjer › Holbergs plass |
| `stops.entur_holbergs_plass.walk` | Gangtid / tekst | Stopp · navn, ikon, gangtid og linjer › Holbergs plass |
| `stops.entur_holbergs_plass.walk_min` | Gangtid (min) · tomt = tall fra teksten · number | Stopp · navn, ikon, gangtid og linjer › Holbergs plass |
| `stops.entur_holbergs_plass.lines` | Linjer (line_whitelist) · tomt = alle | Stopp · navn, ikon, gangtid og linjer › Holbergs plass |
| `stops.entur_holbergs_plass.count` | Antall avganger · number | Stopp · navn, ikon, gangtid og linjer › Holbergs plass |
| `overrides.{avvik}` | bytt entitet |  |
| `hero` | Toppkort · nedtelling til neste avgang du rekker · boolean | Visning |
| `hero_stop` | Toppkort-stopp ( \| sensor.entur_bislett \| sensor.entur_stoppested \| sensor.entur_holbergs_plass) | Visning |
| `timeline` | Tidslinje · neste 30 min · boolean | Visning |
| `go_now` | «Gå nå»-varsel · boolean | Visning |
| `show_trips` | Reise · Til skolen / Hjem · boolean | Visning |
| `platform` | Perrong / spor · boolean | Visning |
| `aimed` | Forsinkelse og rutetid · boolean | Visning |
| `next` | Neste etter («så 12 min») · boolean | Visning |
| `occupancy` | Belegg · boolean | Visning |
| `updated` | Sist oppdatert · boolean | Visning |
| `show_disruptions` | Vis avvikskort · rett under toppkortet · boolean | Visning |
| `hide_zero` | Skjul når ingen avvik · boolean | Visning |
| `planned` | Ta med planlagte avvik · boolean | Visning |
| `walk` | Vis gangtid · teksten ved hvert stopp · boolean | Visning |
| `realtime` | Vis sanntidsmerke · boolean | Visning |
| `sort` | Sortering (liste \| tid) | Visning |
| `gap` | 4 / 8 / 18 px |  |
| `gap` | Mellom seksjonene · range | Mellomrom |
| `pad_top` | Fra popup-headeren til første kort · range | Mellomrom |
| `pad_bottom` | Luft i bunnen (over navbaren) · range | Mellomrom |

## `msh-vaer-hero-card`

Været nå med værbakgrunn, sol/måne/UV og pollen i en sveipbar karusell. Innebygd i msh-vaer-card.

| Nøkkel | Betydning | Gruppe |
|---|---|---|
| `name` | Stedsnavn |  |
| `overrides.{weather, sol, mane, uv}` | bytt entitet |  |
| `exclude · include.{pollen}` | skjul / legg til |  |
| `hero_fx` | Bakgrunnsanimasjon · boolean | Visning |
| `show_extras` | Toppkort side 2 · Andre varsler (sol, måne, UV) · boolean | Visning |
| `show_pollen` | Toppkort side 3 · Pollen i dag · boolean | Visning |

## `msh-vaer-card`

Toppkort, farevarsler, time for time, dagskort, detaljkort og månefase med «Tilpass været». Prognose abonneres kun mens #vaer er åpen.

| Nøkkel | Betydning | Gruppe |
|---|---|---|
| `style` | Stil (klassisk \| scene) |  |
| `tile_order · hidden_tiles` | rekkefølge/synlighet: sky, wind, gust, sun, hum, uv, press, rain, moon, feels, vis |  |
| `overrides.{weather, sol, mane, uv}` | bytt entitet |  |
| `section_order · hidden_sections` | rekkefølge/synlighet: hero, alerts, hours, days, tiles, moon |  |
| `name` | Stedsnavn | Toppkort |
| `hero_fx` | Bakgrunnsanimasjon · boolean | Toppkort |
| `show_extras` | Toppkort side 2 · Andre varsler (sol, måne, UV) · boolean | Toppkort |
| `show_pollen` | Toppkort side 3 · Pollen i dag · boolean | Toppkort |
| `hours` | Timer i «Time for time» · number | Prognose |
| `days` | Antall dagskort · number | Prognose |
| `show_graph` | Temperaturgraf med scrub (etter Time for time) · boolean | Prognose |
| `exclude · include.{varsler, pollen}` | skjul / legg til |  |
| `gap` | 4 / 8 / 18 px |  |
| `gap` | Mellom seksjonene · range | Mellomrom |
| `pad_top` | Fra popup-headeren til første kort · range | Mellomrom |
| `pad_bottom` | Luft i bunnen (over navbaren) · range | Mellomrom |

## `msh-las-card`

Dørlås-popup (#dorlas): låsvelger, toppkort med dra/hold/trykk for å låse opp, status, automatikk og historikk.

| Nøkkel | Betydning | Gruppe |
|---|---|---|
| `exclude · include.{laser}` | skjul / legg til |  |
| `locks_cfg.bod.name` | Navn | Lås · Boddør |
| `locks_cfg.bod.hidden` | Skjul i velgeren · boolean | Lås · Boddør |
| `locks_cfg.bod.door` | Dørsensor · entity | Lås · Boddør |
| `locks_cfg.bod.battery` | Batterisensor · entity | Lås · Boddør |
| `locks_cfg.bod.auto_lock` | Autolås-tid (minutter) · entity | Lås · Boddør |
| `locks_cfg.inngangsdor.name` | Navn | Lås · Inngangsdør |
| `locks_cfg.inngangsdor.hidden` | Skjul i velgeren · boolean | Lås · Inngangsdør |
| `locks_cfg.inngangsdor.door` | Dørsensor · entity | Lås · Inngangsdør |
| `locks_cfg.inngangsdor.battery` | Batterisensor · entity | Lås · Inngangsdør |
| `locks_cfg.inngangsdor.auto_lock` | Autolås-tid (minutter) · entity | Lås · Inngangsdør |
| `show_status` | Status · dør, batteri, autolås · boolean | Seksjoner |
| `show_auto` | Automatikk · boolean | Seksjoner |
| `show_hist` | Historikk · boolean | Seksjoner |
| `unlock` | Opplåsing (dra \| hold \| trykk) | Seksjoner |
| `code_length` | PIN-lengde (auto \| 4 \| 6) | Seksjoner |
| `hist_count` | Antall hendelser (4 \| 6 \| 10 \| 20) | Historikk |
| `hist_all` | Alle låser (ellers bare valgt lås) · boolean | Historikk |
| `hist_door` | Dør åpnet/lukket (fra dørsensoren) · boolean | Historikk |
| `hist_who` | Hvem (navn og bilde når det er kjent) · boolean | Historikk |
| `hist_method` | Metode (kode, app, nøkkel, autolås …) · boolean | Historikk |
| `overrides.{auto_lock, away_lock, night_lock, jam_alert}` | bytt entitet |  |
| `toasts` | Bekreftelsesmeldinger (toast) · boolean | Visning |
| `gap` | Mellom seksjonene · range | Mellomrom |
| `pad_top` | Fra popup-headeren til første kort · range | Mellomrom |
| `pad_bottom` | Luft i bunnen (over navbaren) · range | Mellomrom |

## `msh-ringeklokke-card`

Ringeklokke-popup (#ringeklokke): live-video, deteksjoner, Ta bilde / Lås opp (hold) / Avvis, svar via høyttaleren og siste hendelser.

| Nøkkel | Betydning | Gruppe |
|---|---|---|
| `ring_entity` | Ringe-utløser (binary_sensor.*_doorbell / event.*) · entity | Enhet |
| `camera` | Kamera · entity | Enhet |
| `package_camera` | Pakkekamera · entity | Enhet |
| `lock` | Lås som låses opp · entity | Enhet |
| `speaker` | Høyttaler for svar · entity | Enhet |
| `tts` | TTS-tjeneste · entity | Enhet |
| `hold_ms` | Hold-tid for Lås opp (500 \| 1000 \| 2000 \| 0) | Handlinger |
| `mute_min` | «Avvis» demper ringelyden i (0 \| 5 \| 15 \| 60) | Handlinger |
| `snapshot` | Ta bilde · boolean | Handlinger |
| `haptic` | Vibrer når det ringer · boolean | Handlinger |
| `package_first` | Vis pakkekamera først (når pakke er oppdaget) · boolean | Handlinger |
| `show_replies` | Svar via høyttaleren · boolean | Visning |
| `show_history` | Tidligere i dag · boolean | Visning |
| `gap` | Mellom seksjonene · range | Mellomrom |
| `pad_top` | Fra popup-headeren til første kort · range | Mellomrom |
| `pad_bottom` | Luft i bunnen (over navbaren) · range | Mellomrom |

## `msh-kart-card`

Kart-popup (#kart): fullskjerm-kart med personer, biler, soner og kollektiv i sanntid (Entur).

| Nøkkel | Betydning | Gruppe |
|---|---|---|
| `persons` | Personer · tomt = alle · entities | Personer og biler |
| `cars` | Biler (device_tracker med GPS) · tomt = automatisk · entities | Personer og biler |
| `transit` | Vis busser og trikker i sanntid (Entur) · boolean | Kollektiv |
| `start` | Startvisning (fit \| home \| me) | Visning |
| `style` | Kartstil (dark \| light \| satellite) | Visning |
| `tile_url` | Egen flis-URL (valgfritt, overstyrer stilen) | Visning |

## `msh-energi-card`

Energi-popup (#energi): hus med strømflyt, snarveier, strøm, strømpriser, toppforbrukere og vann fra HAs Energi-oppsett.

| Nøkkel | Betydning | Gruppe |
|---|---|---|


## `msh-kalender-card`

Kalender-popup (#kalender): kalendere, hyttebesøk, Sonarr/Radarr/Plex, bursdager, Posten og pakker.

| Nøkkel | Betydning | Gruppe |
|---|---|---|


## `msh-tesla-card`

Tesla-popup (#tesla): bilscenen, hurtigknapper, Lading, Kjøring og Sparing med «Tilpass Tesla».

| Nøkkel | Betydning | Gruppe |
|---|---|---|


## `msh-stovsuger-card`

Støvsuger-popup (#rolf): animert robot, rom, soner, kontroll, vedlikehold og kart.

| Nøkkel | Betydning | Gruppe |
|---|---|---|


## `msh-server-card`

Server-popup (#server): vertvelger Nettverk · Proxmox · Unraid · HA, toppkort med graf, prosa-setning, underfaner og felles utvidbar liste.

| Nøkkel | Betydning | Gruppe |
|---|---|---|


## `msh-avfall-card`

Søppel-popupen (#soppel): neste tømming med søppelbil, fraksjoner, kalender og varsler (fiks 25.4).

| Nøkkel | Betydning | Gruppe |
|---|---|---|


## `msh-innstillinger-card`

Innstillinger-popupen (#settings): God natt/God morgen, natt- og privatmodus, varsler fra KI Varslinger og sikkerhet (kategorier som faner) og KI Energi (fiks 27; dashbord-delen fjernet i fiks 33.3).

| Nøkkel | Betydning | Gruppe |
|---|---|---|


## `msh-varmepumpe-card`

Varmepumpe-popup (#varmepumpe): NIBE S/F-serien via nibe_heatpump / myUplink – animert pumpe, KPI, hurtigknapper, Info · Varme · Varmtvann · Luft og diagnostikk (v3).

| Nøkkel | Betydning | Gruppe |
|---|---|---|


## `msh-garasje-card`

Garasje-popup (#garasje): portvelger, toppkort med portillustrasjon og Åpne/Stopp/Lukk, status, automatikk og historikk.

| Nøkkel | Betydning | Gruppe |
|---|---|---|
| `exclude · include.{porter}` | skjul / legg til |  |
| `doors_cfg.garasjeport.name` | Navn | Port · Garasjeport |
| `doors_cfg.garasjeport.light` | Lys · entity | Port · Garasjeport |
| `doors_cfg.garasjeport.motion` | Bevegelse · entity | Port · Garasjeport |
| `show_status` | Status · lys, bevegelse, tid · boolean | Seksjoner |
| `show_auto` | Automatikk · boolean | Seksjoner |
| `show_hist` | Historikk · boolean | Seksjoner |
| `open_confirm` | Åpne krever (ingen \| to \| borte) | Sikkerhet |
| `overrides.{auto_close, away_close, arrive_open, night_alert}` | bytt entitet |  |
| `toasts` | Bekreftelsesmeldinger (toast) · boolean | Visning |
| `gap` | Mellom seksjonene · range | Mellomrom |
| `pad_top` | Fra popup-headeren til første kort · range | Mellomrom |
| `pad_bottom` | Luft i bunnen (over navbaren) · range | Mellomrom |
