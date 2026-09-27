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
| `bottom_offset` | Avstand fra bunnen · range | Plassering og oppførsel |
| `reserve_space` | Gi innholdet plass (padding i bunnen / til venstre) · boolean | Plassering og oppførsel |
| `toasts` | Bekreftelsesmeldinger · boolean | Plassering og oppførsel |
| `admin_tools` | Vis «Tilpass» i Mer-menyen · boolean | Plassering og oppførsel |

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
| `mode` | Oppsett (familie \| sted \| navn \| under \| kompakt \| hjem \| stor \| profil) · modes |  |
| `kiosk_entity` | Kiosk-modus-entitet · entity | Handlinger på tittelen |
| `g_font` | Maks tekst · range | Størrelser |
| `g_avatar` | Bilder · range | Størrelser |
| `g_badge` | Merke · range | Størrelser |
| `g_gap` | Avstand (minus = overlapp) · range | Størrelser |
| `pic_size` | Profilbilde · range | Størrelser |
| `persons_size` | Personer · range | Størrelser |
| `title_size` | Tittel · range | Størrelser |
| `people` | Personer i headeren · rows | Personer |
| `zones` | Soner med eget ikon og farge · rows | Soner |
| `zone_away.icon` | Borte · ikon · icon | Soner |
| `zone_away.color` | Borte · farge · color | Soner |
| `away_marker` | Borte · vis merke · boolean | Soner |
| `greeting` | Hilsen | Hilsen |
| `size` | Størrelse (S \| M \| L) | Bilder |
| `badge` | Merke (icon \| dot \| ring \| none) | Bilder |
| `show_name` | Vis navn · boolean | Bilder |
| `show_place` | Vis sted · Hjemme, sonen eller Borte under bildet · boolean | Bilder |
| `ring_me` | Ring rundt meg · markerer bildet ditt · boolean | Bilder |
| `weather_tap` | Trykk på været åpner Vær · gjelder «Hjem» og «Profil» · boolean | Bilder |
| `weather_hash` | Vær-popup · hash | Bilder |
| `person_tap` | Trykk på person (quick \| popup) | Bilder |
| `servers` | Bytt sted – Home Assistant-installasjoner (også denne) · rows | Steder (servermeny) |
| `place_name` | Navn på dette stedet | Steder (servermeny) |
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
| `prose` | Setninger · rows |  |
| `overrides.{weather, temp, price, watt, lights, lock, alarm, trash, garage, tv, vacuum}` | bytt entitet |  |
| `exclude · include.{kalendere, lister}` | skjul / legg til |  |
| `price_high` | Strømpris rød over (kr) · number | Farger og popups |
| `price_mid` | Strømpris gul over (kr) · number | Farger og popups |
| `alarm_hash` | Alarm-popup (når kode kreves) · hash | Farger og popups |
| `toasts` | Bekreftelsesmeldinger · boolean | Farger og popups |

## `msh-soppel-card`

Dager til neste søppeltømming. Trykk åpner søppel-popupen (#soppel).

| Nøkkel | Betydning | Gruppe |
|---|---|---|
| `popup_hash` | Popup-hash · hash |  |
| `sensor` | Sensor · dager til tømming · entity |  |
| `type_sensor` | Sensor · type avfall (valgfri) · entity |  |
| `title` | Tekst |  |
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
| `battery.limit` | Grense for lavt batteri (%) · number | Batterier |
| `battery.show` | Liste (lav \| alle) | Batterier |
| `battery.always` | Vis fanen alltid · boolean | Batterier |
| `battery.cond` | Vis fanen når denne er på · entity | Batterier |
| `appliance_animation` | Animasjon (full \| calm \| off) | Hvitevarer |
| `tabs.hjem.auto_fill` | Autofyll Hjem med alle rom · boolean | Rom og snarveier · Hjem |
| `layout.hjem.order · layout.hjem.hidden` | rekkefølge/synlighet: stue, kjokken, soverom, bad | Rom og snarveier · Hjem |
| `layout.hjem.side.stue` | Kolonne · Stue (L \| R) | Rom og snarveier · Hjem |
| `layout.hjem.side.kjokken` | Kolonne · Kjøkken (L \| R) | Rom og snarveier · Hjem |
| `layout.hjem.side.soverom` | Kolonne · Soverom (L \| R) | Rom og snarveier · Hjem |
| `layout.hjem.side.bad` | Kolonne · Bad (L \| R) | Rom og snarveier · Hjem |
| `slides.hjem.L.cal` | Sveip-kort · venstre karusell · Kalender · boolean | Rom og snarveier · Hjem |
| `slides.hjem.R.cal` | Sveip-kort · høyre karusell · Kalender · boolean | Rom og snarveier · Hjem |
| `slides.hjem.L.vaer` | Sveip-kort · venstre karusell · Vær · boolean | Rom og snarveier · Hjem |
| `slides.hjem.R.vaer` | Sveip-kort · høyre karusell · Vær · boolean | Rom og snarveier · Hjem |
| `slides.hjem.L.strom` | Sveip-kort · venstre karusell · Strøm · boolean | Rom og snarveier · Hjem |
| `slides.hjem.R.strom` | Sveip-kort · høyre karusell · Strøm · boolean | Rom og snarveier · Hjem |
| `slides.hjem.L.trash` | Sveip-kort · venstre karusell · Søppel · boolean | Rom og snarveier · Hjem |
| `slides.hjem.R.trash` | Sveip-kort · høyre karusell · Søppel · boolean | Rom og snarveier · Hjem |
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
| `tile_order.hjem · tile_hidden.hjem` | rekkefølge/synlighet: lock, alarm, cam, todo | Rom og snarveier · Hjem |
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
| `layout.aktuelt.order · layout.aktuelt.hidden` | rekkefølge/synlighet: bod, gang, kjokken, stue, bad, kontor, soverom, vaskerom, basseng, hage, garasje | Rom og snarveier · Aktuelt |
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
| `tap.lock.card_hash` | Dørlås · trykk på kortet åpner popup · hash | Snarveier · handlinger |
| `tap.lock.icon` | Dørlås · trykk på ikonet (auto \| popup \| more \| script \| none) | Snarveier · handlinger |
| `tap.garage.card_hash` | Garasjeport · trykk på kortet åpner popup · hash | Snarveier · handlinger |
| `tap.garage.icon` | Garasjeport · trykk på ikonet (auto \| popup \| more \| script \| none) | Snarveier · handlinger |
| `tap.alarm.card_hash` | Alarm · trykk på kortet åpner popup · hash | Snarveier · handlinger |
| `tap.alarm.icon` | Alarm · trykk på ikonet (auto \| popup \| more \| script \| none) | Snarveier · handlinger |
| `tap.cam.card_hash` | Kamera · trykk på kortet åpner popup · hash | Snarveier · handlinger |
| `tap.cam.icon` | Kamera · trykk på ikonet (auto \| popup \| more \| script \| none) | Snarveier · handlinger |
| `tap.ruter.card_hash` | Ruter · trykk på kortet åpner popup · hash | Snarveier · handlinger |
| `tap.ruter.icon` | Ruter · trykk på ikonet (auto \| popup \| more \| script \| none) | Snarveier · handlinger |
| `tap.todo.card_hash` | Gjøremål · trykk på kortet åpner popup · hash | Snarveier · handlinger |
| `tap.todo.icon` | Gjøremål · trykk på ikonet (auto \| popup \| more \| script \| none) | Snarveier · handlinger |
| `tap.dish.card_hash` | Oppvaskmaskin · trykk på kortet åpner popup · hash | Snarveier · handlinger |
| `tap.dish.icon` | Oppvaskmaskin · trykk på ikonet (auto \| popup \| more \| script \| none) | Snarveier · handlinger |
| `tap.vacr.card_hash` | Støvsuger · trykk på kortet åpner popup · hash | Snarveier · handlinger |
| `tap.vacr.icon` | Støvsuger · trykk på ikonet (auto \| popup \| more \| script \| none) | Snarveier · handlinger |
| `tap.tv.card_hash` | TV · trykk på kortet åpner popup · hash | Snarveier · handlinger |
| `tap.tv.icon` | TV · trykk på ikonet (auto \| popup \| more \| script \| none) | Snarveier · handlinger |
| `tap.wash.card_hash` | Vaskemaskin · trykk på kortet åpner popup · hash | Snarveier · handlinger |
| `tap.wash.icon` | Vaskemaskin · trykk på ikonet (auto \| popup \| more \| script \| none) | Snarveier · handlinger |
| `tap.jul.card_hash` | Jul · trykk på kortet åpner popup · hash | Snarveier · handlinger |
| `tap.jul.icon` | Jul · trykk på ikonet (auto \| popup \| more \| script \| none) | Snarveier · handlinger |
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
| `zoom` | Skaler opp på store skjermer (opptil 1,8×) · boolean | Layout |
| `toasts` | Bekreftelsesmeldinger (f.eks. «Dørlås låst opp») · boolean | Layout |

## `msh-hjem-card`

Hele Hjem-visningen i ett kort: header, prosa, faner/romkort, søppel, strømpris og gjøremål med designets marger (mobil og bred).

| Nøkkel | Betydning | Gruppe |
|---|---|---|
| `layout_mode` | Layout (auto \| mobil \| stor) | Layout |
| `zoom` | Skaler opp på store skjermer (opptil 1,8×) · boolean | Layout |
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
| `graph_t` | Linje · temperatur (romfarge) · color | Graf |
| `graph_h` | Linje · fukt · color | Graf |
| `graph_fill` | Fyll (0 \| 0.2 \| 0.4) | Graf |
| `graph_width` | Linje (1.5 \| 2 \| 3) | Graf |

## `msh-rom-card`

Rom-popupen: rullegardin, scener, lys, enheter, klima, media og sensorer – autokonfig fra KI Rom / HA-områder.

| Nøkkel | Betydning | Gruppe |
|---|---|---|
| `gap` | Mellom seksjonene · range | Mellomrom |
| `pad_top` | Fra popup-headeren til første kort · range | Mellomrom |
| `pad_bottom` | Luft i bunnen · range | Mellomrom |
| `look.col` | Romfarge · color | Utseende |
| `icon_color_mode` | Ikonfarge på romkortet (Hjem) (lights \| always \| never) | Utseende |
| `look.icon` | Rom-ikon · icon | Utseende |
| `icon_tap` | Trykk på ikonet (romkortet på Hjem) (toggle_lights \| open_popup \| none) | Handlinger |
| `area` | Rom (område) · area |  |
| `overrides.climate` | Termostat · entity | Klima |
| `overrides.temperature` | Temperatursensor · entity | Klima |
| `overrides.humidity` | Fuktsensor · entity | Klima |
| `include.climate` | Ekstra termostater · entities | Klima |
| `graph_t` | Toppkort · graf temperatur · color | Klima |
| `graph_h` | Toppkort · graf fukt · color | Klima |
| `graph_fill` | Toppkort · fyll (0 \| 0.2 \| 0.4) | Klima |
| `graph_width` | Toppkort · linje (1.5 \| 2 \| 3) | Klima |
| `header_icon` | Rommets ikon i popup-headeren · boolean | Klima |
| `klima_bg` | Klima-kort · bakgrunn · color | Klima |
| `klima_ring` | Klima-kort · knappfarge · color | Klima |
| `klima_btn` | Klima-kort · knapp (outline \| fill) | Klima |
| `klima_mode` | Farg etter modus · boolean | Klima |
| `sections · hidden_sections` | rekkefølge/synlighet: curtain, scenes, lys, dev, klima, media, sens |  |
| `exclude · include.{}` | skjul / legg til |  |
| `appliance_animation` | Animasjon (full \| calm \| off) | Hvitevarer |
| `run_threshold_w` | Kjører over (W) · number | Hvitevarer |
| `customize_button` | Vis «Tilpass rommet»-knapp nederst · boolean |  |

## `msh-romkort-card`

Romkort for Hjem: temperatur, fukt, lys, termostat og varsler. Trykk åpner Rom-popupen.

| Nøkkel | Betydning | Gruppe |
|---|---|---|
| `area` | Rom (område) · area | Rom |
| `variant` | Variant (graf \| karusell \| L \| M \| S) | Rom |
| `name` | Navn | Rom |
| `hash` | Popup (hash) · hash | Rom |
| `klima` | Klima-knapp (+/−) på kortet · boolean | Rom |
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

Basseng-hero med vanntemperatur, status og animert pumpe/varmepumpe/tak/lys. Første kort i #basseng.

| Nøkkel | Betydning | Gruppe |
|---|---|---|
| `area` | Område · area |  |
| `name` | Navn |  |
| `overrides.{water, pump, heat, cover, light, target, turnover}` | bytt entitet |  |
| `anim` | Animasjoner (bølger, bobler, vifte og varme) · boolean | Animasjon |
| `chips` | Statusikoner (pumpe, varme, tak og lys i bildet) · boolean | Animasjon |
| `vals.turnovers` | Omsetninger per døgn (mål) | Animasjon |

## `msh-basseng-card`

Basseng-popup: kontroller, faner (Oversikt, Varme, Klor, Spreder), klorlogg og spreder. Legg under msh-basseng-hero-card i #basseng.

| Nøkkel | Betydning | Gruppe |
|---|---|---|
| `area` | Område · area |  |
| `overrides.{water, ute, pump, heat, cover, light, spr, power, heat_power, ph, klor, target, turnover, pumped, savings, cost, mode, night, winter, heat_loss, solar, spr_duration, klor_calendar}` | bytt entitet |  |
| `exclude · include.{flagg, personer}` | skjul / legg til |  |
| `controls · hidden_controls` | rekkefølge/synlighet: light, pump, heat, cover, spr |  |
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
| `toasts` | Bekreftelsesmeldinger · boolean | Visning |
| `gap` | 4 / 8 / 18 px | Visning |
| `gap` | Mellom seksjonene · range | Mellomrom |
| `pad_top` | Fra popup-headeren til første kort · range | Mellomrom |
| `pad_bottom` | Luft i bunnen (over navbaren) · range | Mellomrom |

## `msh-vanning-hero-card`

Hage-scene med spreder, status, neste vanning og dagens forbruk. Første kort i #vanning.

| Nøkkel | Betydning | Gruppe |
|---|---|---|
| `area` | Område · area |  |
| `opensprinkler` | Bruk OpenSprinkler-integrasjonen · boolean |  |
| `exclude · include.{soner, program, innstillinger}` | skjul / legg til |  |
| `overrides.{system, rain, skip, reset, calendar, water, moisture, current, power, flow}` | bytt entitet |  |
| `run_min` | Standard kjøretid per sone (min) · number | Vanning |
| `flow_rate` | Vannmengde per sone (L/min) · number | Vanning |
| `water_price` | Vannpris (kr per m³) · number | Vanning |
| `rain_hours` | Regnpause (timer) · number | Vanning |
| `dry` | Tørr under (% jordfuktighet) · number | Vanning |
| `codes` | Vis sonekoder (S01 …) · boolean | Vanning |
| `group_by` | Grupper soner (area \| none) | Vanning |

## `msh-vanning-card`

Vanning-popup: kontroller, soner, programmer, forbruk og historikk (OpenSprinkler, valve/switch, kalender, vannmåler). Legg under msh-vanning-hero-card i #vanning.

| Nøkkel | Betydning | Gruppe |
|---|---|---|
| `area` | Område · area |  |
| `opensprinkler` | Bruk OpenSprinkler-integrasjonen · boolean |  |
| `exclude · include.{soner, program, innstillinger}` | skjul / legg til |  |
| `overrides.{system, rain, skip, reset, calendar, water, moisture, current, power, flow}` | bytt entitet |  |
| `run_min` | Standard kjøretid per sone (min) · number | Vanning |
| `flow_rate` | Vannmengde per sone (L/min) · number | Vanning |
| `water_price` | Vannpris (kr per m³) · number | Vanning |
| `rain_hours` | Regnpause (timer) · number | Vanning |
| `dry` | Tørr under (% jordfuktighet) · number | Vanning |
| `codes` | Vis sonekoder (S01 …) · boolean | Vanning |
| `group_by` | Grupper soner (area \| none) | Vanning |
| `tabs · hidden_tabs` | rekkefølge/synlighet: now, zones, prog, use, hist |  |
| `toasts` | Bekreftelsesmeldinger · boolean | Visning |
| `gap` | 4 / 8 / 18 px | Visning |
| `gap` | Mellom seksjonene · range | Mellomrom |
| `pad_top` | Fra popup-headeren til første kort · range | Mellomrom |
| `pad_bottom` | Luft i bunnen (over navbaren) · range | Mellomrom |

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
| `layout.show_modes` | Modus-bobler · boolean | Visning |
| `layout.tab_style` | Fanestil (both \| text \| icon) | Visning |
| `layout.default_tab` | Standardfane (oversikt \| soner \| energi \| vann \| lading \| tanker \| oppsett \| avansert) | Faner |
| `remember_tab` | Husk sist valgte fane · boolean | Faner |
| `layout.tab_order · layout.hidden_tabs` | rekkefølge/synlighet: oversikt, soner, energi, vann, lading, tanker, oppsett, avansert | Faner |
| `layout.block_order.oversikt · layout.hidden_blocks.oversikt` | rekkefølge/synlighet: siste12, forventet, leggetid, styrer, tiltak, budsjett, varmtvann, borte | Blokker |
| `layout.block_order.soner · layout.hidden_blocks.soner` | rekkefølge/synlighet: soner | Blokker |
| `layout.block_order.energi · layout.hidden_blocks.energi` | rekkefølge/synlighet: dynamisk, sparer, maaned, topp3, effekt6, grenser | Blokker |
| `layout.block_order.vann · layout.hidden_blocks.vann` | rekkefølge/synlighet: status, pris, brytere, handling, vindu, legionella, handkle, hk_sparer, dusj, fukt, vifte, gulv | Blokker |
| `layout.block_order.lading · layout.hidden_blocks.lading` | rekkefølge/synlighet: status, ledig, trinn, auto, vindu | Blokker |
| `layout.block_order.tanker · layout.hidden_blocks.tanker` | rekkefølge/synlighet: tenker, logg, vurdering, tau | Blokker |
| `layout.block_order.oppsett · layout.hidden_blocks.oppsett` | rekkefølge/synlighet: motor, varme, gardiner, helg, vannbad, lys, varslinger, tider, dagnatt, personer, stue, diagnostikk | Blokker |
| `layout.block_order.avansert · layout.hidden_blocks.avansert` | rekkefølge/synlighet: terskler, prognose, moduser, helgevarsler, vvb, tariff, entiteter, raa, handlinger | Blokker |
| `toasts` | Bekreftelsesmeldinger · boolean |  |
| `gap` | Mellom seksjonene · range | Mellomrom |
| `pad_top` | Fra popup-headeren til første kort · range | Mellomrom |
| `pad_bottom` | Luft i bunnen (over navbaren) · range | Mellomrom |

## `msh-lys-card`

Utelys med tidslinje og styring, lys per etasje og rom med felles lys-rad, og oversikt over lys som er på.

| Nøkkel | Betydning | Gruppe |
|---|---|---|
| `columns` | Kolonner (1 \| 2) | Visning |
| `size` | Størrelse (standard \| compact) | Visning |
| `slider_height` | Slider-høyde · range | Visning |
| `toasts` | Bekreftelsesmeldinger · boolean | Visning |
| `gap` | Mellom seksjonene · range | Mellomrom |
| `tile_gap` | Mellom lys-radene · range | Mellomrom |
| `pad_top` | Fra popup-headeren til første kort · range | Mellomrom |
| `pad_bottom` | Luft i bunnen (over navbaren) · range | Mellomrom |
| `tab_order · hidden_tabs` | rekkefølge/synlighet: out, f:forste, f:andre, on | Faner |
| `start_tab` | Startfane ( \| out \| f:forste \| f:andre \| on) | Faner |
| `tab_names.out` | Utelys | Faner › Navn på fanene |
| `tab_names.f:forste` | 1. etg | Faner › Navn på fanene |
| `tab_names.f:andre` | 2. etg | Faner › Navn på fanene |
| `tab_names.on` | Lys på | Faner › Navn på fanene |
| `floor_tabs.forste` | 1. etg · boolean | Faner › Fane per etasje |
| `floor_tabs.andre` | 2. etg · boolean | Faner › Fane per etasje |
| `scene_source` | Kilde (auto \| ki \| egne \| begge) | Scener |
| `scene_order · hidden_scenes` | rekkefølge/synlighet: ki:maks, ki:natt, ki:av, ki:komfort, ki:middag, ki:tv, ki:mindre, p:max, p:kveld, p:dim, p:natt, p:av, scene.bad_morgen, scene.soverom_natt | Scener |
| `include.scener_lys` | Egne scener · entities | Scener |
| `room_order.forste · hidden_rooms` | rekkefølge/synlighet: gang, kjokken, stue | Rom og lys › 1. etg |
| `light_order.gang · exclude` | rekkefølge/synlighet: light.gang_speil, light.gang_tak | Rom og lys › 1. etg › Gang |
| `lights.gang_speil.name` | Navn | Rom og lys › 1. etg › Gang › Speil |
| `lights.gang_speil.icon` | Ikon · icon | Rom og lys › 1. etg › Gang › Speil |
| `light_types.gang_speil` | Lystype ( \| dim \| ct \| color \| onoff) | Rom og lys › 1. etg › Gang › Speil |
| `lights.gang_speil.brightness_min` | Minste lysstyrke (%) · number | Rom og lys › 1. etg › Gang › Speil › Slider (avansert) |
| `lights.gang_speil.brightness_max` | Største lysstyrke (%) · number | Rom og lys › 1. etg › Gang › Speil › Slider (avansert) |
| `lights.gang_speil.color_control` | Fargekontroll (utvidet) ( \| spectrum \| presets \| both) | Rom og lys › 1. etg › Gang › Speil › Slider (avansert) |
| `lights.gang_speil.hide_temperature_slider` | Skjul temperaturslider · boolean | Rom og lys › 1. etg › Gang › Speil › Slider (avansert) |
| `lights.gang_speil.hide_color_controls` | Skjul fargespekter · boolean | Rom og lys › 1. etg › Gang › Speil › Slider (avansert) |
| `lights.gang_speil.hide_color_presets` | Skjul fargeforhåndsvalg · boolean | Rom og lys › 1. etg › Gang › Speil › Slider (avansert) |
| `lights.gang_speil.color_presets` | Fargeforhåndsvalg | Rom og lys › 1. etg › Gang › Speil › Slider (avansert) |
| `lights.gang_tak.name` | Navn | Rom og lys › 1. etg › Gang › Tak |
| `lights.gang_tak.icon` | Ikon · icon | Rom og lys › 1. etg › Gang › Tak |
| `light_types.gang_tak` | Lystype ( \| dim \| ct \| color \| onoff) | Rom og lys › 1. etg › Gang › Tak |
| `lights.gang_tak.brightness_min` | Minste lysstyrke (%) · number | Rom og lys › 1. etg › Gang › Tak › Slider (avansert) |
| `lights.gang_tak.brightness_max` | Største lysstyrke (%) · number | Rom og lys › 1. etg › Gang › Tak › Slider (avansert) |
| `lights.gang_tak.color_control` | Fargekontroll (utvidet) ( \| spectrum \| presets \| both) | Rom og lys › 1. etg › Gang › Tak › Slider (avansert) |
| `lights.gang_tak.hide_temperature_slider` | Skjul temperaturslider · boolean | Rom og lys › 1. etg › Gang › Tak › Slider (avansert) |
| `lights.gang_tak.hide_color_controls` | Skjul fargespekter · boolean | Rom og lys › 1. etg › Gang › Tak › Slider (avansert) |
| `lights.gang_tak.hide_color_presets` | Skjul fargeforhåndsvalg · boolean | Rom og lys › 1. etg › Gang › Tak › Slider (avansert) |
| `lights.gang_tak.color_presets` | Fargeforhåndsvalg | Rom og lys › 1. etg › Gang › Tak › Slider (avansert) |
| `light_order.kjokken · exclude` | rekkefølge/synlighet: light.kjokken_spot | Rom og lys › 1. etg › Kjøkken |
| `lights.kjokken_spot.name` | Navn | Rom og lys › 1. etg › Kjøkken › Spot |
| `lights.kjokken_spot.icon` | Ikon · icon | Rom og lys › 1. etg › Kjøkken › Spot |
| `light_types.kjokken_spot` | Lystype ( \| dim \| ct \| color \| onoff) | Rom og lys › 1. etg › Kjøkken › Spot |
| `lights.kjokken_spot.brightness_min` | Minste lysstyrke (%) · number | Rom og lys › 1. etg › Kjøkken › Spot › Slider (avansert) |
| `lights.kjokken_spot.brightness_max` | Største lysstyrke (%) · number | Rom og lys › 1. etg › Kjøkken › Spot › Slider (avansert) |
| `lights.kjokken_spot.color_control` | Fargekontroll (utvidet) ( \| spectrum \| presets \| both) | Rom og lys › 1. etg › Kjøkken › Spot › Slider (avansert) |
| `lights.kjokken_spot.hide_temperature_slider` | Skjul temperaturslider · boolean | Rom og lys › 1. etg › Kjøkken › Spot › Slider (avansert) |
| `lights.kjokken_spot.hide_color_controls` | Skjul fargespekter · boolean | Rom og lys › 1. etg › Kjøkken › Spot › Slider (avansert) |
| `lights.kjokken_spot.hide_color_presets` | Skjul fargeforhåndsvalg · boolean | Rom og lys › 1. etg › Kjøkken › Spot › Slider (avansert) |
| `lights.kjokken_spot.color_presets` | Fargeforhåndsvalg | Rom og lys › 1. etg › Kjøkken › Spot › Slider (avansert) |
| `light_order.stue · exclude` | rekkefølge/synlighet: light.stue_lampe, light.stue_led, light.stue_tak | Rom og lys › 1. etg › Stue |
| `lights.stue_lampe.name` | Navn | Rom og lys › 1. etg › Stue › Lampe |
| `lights.stue_lampe.icon` | Ikon · icon | Rom og lys › 1. etg › Stue › Lampe |
| `light_types.stue_lampe` | Lystype ( \| dim \| ct \| color \| onoff) | Rom og lys › 1. etg › Stue › Lampe |
| `lights.stue_lampe.brightness_min` | Minste lysstyrke (%) · number | Rom og lys › 1. etg › Stue › Lampe › Slider (avansert) |
| `lights.stue_lampe.brightness_max` | Største lysstyrke (%) · number | Rom og lys › 1. etg › Stue › Lampe › Slider (avansert) |
| `lights.stue_lampe.color_control` | Fargekontroll (utvidet) ( \| spectrum \| presets \| both) | Rom og lys › 1. etg › Stue › Lampe › Slider (avansert) |
| `lights.stue_lampe.hide_temperature_slider` | Skjul temperaturslider · boolean | Rom og lys › 1. etg › Stue › Lampe › Slider (avansert) |
| `lights.stue_lampe.hide_color_controls` | Skjul fargespekter · boolean | Rom og lys › 1. etg › Stue › Lampe › Slider (avansert) |
| `lights.stue_lampe.hide_color_presets` | Skjul fargeforhåndsvalg · boolean | Rom og lys › 1. etg › Stue › Lampe › Slider (avansert) |
| `lights.stue_lampe.color_presets` | Fargeforhåndsvalg | Rom og lys › 1. etg › Stue › Lampe › Slider (avansert) |
| `lights.stue_led.name` | Navn | Rom og lys › 1. etg › Stue › LED |
| `lights.stue_led.icon` | Ikon · icon | Rom og lys › 1. etg › Stue › LED |
| `light_types.stue_led` | Lystype ( \| dim \| ct \| color \| onoff) | Rom og lys › 1. etg › Stue › LED |
| `lights.stue_led.brightness_min` | Minste lysstyrke (%) · number | Rom og lys › 1. etg › Stue › LED › Slider (avansert) |
| `lights.stue_led.brightness_max` | Største lysstyrke (%) · number | Rom og lys › 1. etg › Stue › LED › Slider (avansert) |
| `lights.stue_led.color_control` | Fargekontroll (utvidet) ( \| spectrum \| presets \| both) | Rom og lys › 1. etg › Stue › LED › Slider (avansert) |
| `lights.stue_led.hide_temperature_slider` | Skjul temperaturslider · boolean | Rom og lys › 1. etg › Stue › LED › Slider (avansert) |
| `lights.stue_led.hide_color_controls` | Skjul fargespekter · boolean | Rom og lys › 1. etg › Stue › LED › Slider (avansert) |
| `lights.stue_led.hide_color_presets` | Skjul fargeforhåndsvalg · boolean | Rom og lys › 1. etg › Stue › LED › Slider (avansert) |
| `lights.stue_led.color_presets` | Fargeforhåndsvalg | Rom og lys › 1. etg › Stue › LED › Slider (avansert) |
| `lights.stue_tak.name` | Navn | Rom og lys › 1. etg › Stue › Tak |
| `lights.stue_tak.icon` | Ikon · icon | Rom og lys › 1. etg › Stue › Tak |
| `light_types.stue_tak` | Lystype ( \| dim \| ct \| color \| onoff) | Rom og lys › 1. etg › Stue › Tak |
| `lights.stue_tak.brightness_min` | Minste lysstyrke (%) · number | Rom og lys › 1. etg › Stue › Tak › Slider (avansert) |
| `lights.stue_tak.brightness_max` | Største lysstyrke (%) · number | Rom og lys › 1. etg › Stue › Tak › Slider (avansert) |
| `lights.stue_tak.color_control` | Fargekontroll (utvidet) ( \| spectrum \| presets \| both) | Rom og lys › 1. etg › Stue › Tak › Slider (avansert) |
| `lights.stue_tak.hide_temperature_slider` | Skjul temperaturslider · boolean | Rom og lys › 1. etg › Stue › Tak › Slider (avansert) |
| `lights.stue_tak.hide_color_controls` | Skjul fargespekter · boolean | Rom og lys › 1. etg › Stue › Tak › Slider (avansert) |
| `lights.stue_tak.hide_color_presets` | Skjul fargeforhåndsvalg · boolean | Rom og lys › 1. etg › Stue › Tak › Slider (avansert) |
| `lights.stue_tak.color_presets` | Fargeforhåndsvalg | Rom og lys › 1. etg › Stue › Tak › Slider (avansert) |
| `room_order.andre · hidden_rooms` | rekkefølge/synlighet: bad, soverom | Rom og lys › 2. etg |
| `light_order.bad · exclude` | rekkefølge/synlighet: light.bad_tak | Rom og lys › 2. etg › Bad |
| `lights.bad_tak.name` | Navn | Rom og lys › 2. etg › Bad › Tak |
| `lights.bad_tak.icon` | Ikon · icon | Rom og lys › 2. etg › Bad › Tak |
| `light_types.bad_tak` | Lystype ( \| dim \| ct \| color \| onoff) | Rom og lys › 2. etg › Bad › Tak |
| `lights.bad_tak.brightness_min` | Minste lysstyrke (%) · number | Rom og lys › 2. etg › Bad › Tak › Slider (avansert) |
| `lights.bad_tak.brightness_max` | Største lysstyrke (%) · number | Rom og lys › 2. etg › Bad › Tak › Slider (avansert) |
| `lights.bad_tak.color_control` | Fargekontroll (utvidet) ( \| spectrum \| presets \| both) | Rom og lys › 2. etg › Bad › Tak › Slider (avansert) |
| `lights.bad_tak.hide_temperature_slider` | Skjul temperaturslider · boolean | Rom og lys › 2. etg › Bad › Tak › Slider (avansert) |
| `lights.bad_tak.hide_color_controls` | Skjul fargespekter · boolean | Rom og lys › 2. etg › Bad › Tak › Slider (avansert) |
| `lights.bad_tak.hide_color_presets` | Skjul fargeforhåndsvalg · boolean | Rom og lys › 2. etg › Bad › Tak › Slider (avansert) |
| `lights.bad_tak.color_presets` | Fargeforhåndsvalg | Rom og lys › 2. etg › Bad › Tak › Slider (avansert) |
| `light_order.soverom · exclude` | rekkefølge/synlighet: light.soverom_nattbord, light.soverom_tak | Rom og lys › 2. etg › Soverom |
| `lights.soverom_nattbord.name` | Navn | Rom og lys › 2. etg › Soverom › Nattbord |
| `lights.soverom_nattbord.icon` | Ikon · icon | Rom og lys › 2. etg › Soverom › Nattbord |
| `light_types.soverom_nattbord` | Lystype ( \| dim \| ct \| color \| onoff) | Rom og lys › 2. etg › Soverom › Nattbord |
| `lights.soverom_nattbord.brightness_min` | Minste lysstyrke (%) · number | Rom og lys › 2. etg › Soverom › Nattbord › Slider (avansert) |
| `lights.soverom_nattbord.brightness_max` | Største lysstyrke (%) · number | Rom og lys › 2. etg › Soverom › Nattbord › Slider (avansert) |
| `lights.soverom_nattbord.color_control` | Fargekontroll (utvidet) ( \| spectrum \| presets \| both) | Rom og lys › 2. etg › Soverom › Nattbord › Slider (avansert) |
| `lights.soverom_nattbord.hide_temperature_slider` | Skjul temperaturslider · boolean | Rom og lys › 2. etg › Soverom › Nattbord › Slider (avansert) |
| `lights.soverom_nattbord.hide_color_controls` | Skjul fargespekter · boolean | Rom og lys › 2. etg › Soverom › Nattbord › Slider (avansert) |
| `lights.soverom_nattbord.hide_color_presets` | Skjul fargeforhåndsvalg · boolean | Rom og lys › 2. etg › Soverom › Nattbord › Slider (avansert) |
| `lights.soverom_nattbord.color_presets` | Fargeforhåndsvalg | Rom og lys › 2. etg › Soverom › Nattbord › Slider (avansert) |
| `lights.soverom_tak.name` | Navn | Rom og lys › 2. etg › Soverom › Tak |
| `lights.soverom_tak.icon` | Ikon · icon | Rom og lys › 2. etg › Soverom › Tak |
| `light_types.soverom_tak` | Lystype ( \| dim \| ct \| color \| onoff) | Rom og lys › 2. etg › Soverom › Tak |
| `lights.soverom_tak.brightness_min` | Minste lysstyrke (%) · number | Rom og lys › 2. etg › Soverom › Tak › Slider (avansert) |
| `lights.soverom_tak.brightness_max` | Største lysstyrke (%) · number | Rom og lys › 2. etg › Soverom › Tak › Slider (avansert) |
| `lights.soverom_tak.color_control` | Fargekontroll (utvidet) ( \| spectrum \| presets \| both) | Rom og lys › 2. etg › Soverom › Tak › Slider (avansert) |
| `lights.soverom_tak.hide_temperature_slider` | Skjul temperaturslider · boolean | Rom og lys › 2. etg › Soverom › Tak › Slider (avansert) |
| `lights.soverom_tak.hide_color_controls` | Skjul fargespekter · boolean | Rom og lys › 2. etg › Soverom › Tak › Slider (avansert) |
| `lights.soverom_tak.hide_color_presets` | Skjul fargeforhåndsvalg · boolean | Rom og lys › 2. etg › Soverom › Tak › Slider (avansert) |
| `lights.soverom_tak.color_presets` | Fargeforhåndsvalg | Rom og lys › 2. etg › Soverom › Tak › Slider (avansert) |
| `include.lys` | Lagt til · entities | Rom og lys |
| `outdoor.mode` | Styring (auto \| tid \| manuell) | Utelys › Tider og terskler |
| `outdoor.on` | Tennes (HH:MM) | Utelys › Tider og terskler |
| `outdoor.off` | Slukkes (HH:MM) | Utelys › Tider og terskler |
| `outdoor.latest` | Slukk senest (HH:MM) | Utelys › Tider og terskler |
| `outdoor.morning` | Morgen fra (HH:MM) | Utelys › Tider og terskler |
| `outdoor.offset` | Forskyvning skumring (min) · number | Utelys › Tider og terskler |
| `outdoor.lux_on` | Tenn under (lx) · number | Utelys › Tider og terskler |
| `outdoor.lux_off` | Slukk over (lx) · number | Utelys › Tider og terskler |
| `outdoor.kveld` | Kveld · tenn i skumringen · boolean | Utelys › Tider og terskler |
| `outdoor.morgen` | Morgen · tenn før det lysner · boolean | Utelys › Tider og terskler |
| `overrides.lux` | Lysnivåsensor (ute) · entity | Utelys › Entiteter |
| `overrides.automatikk` | Automatikk-bryter · entity | Utelys › Entiteter |
| `overrides.modus` | Modusvelger (Auto/Tidsplan/Manuelt) · entity | Utelys › Entiteter |
| `overrides.kveld_bryter` | Kveld-bryter · entity | Utelys › Entiteter |
| `overrides.morgen_bryter` | Morgen-bryter · entity | Utelys › Entiteter |
| `order.utelys · exclude` | rekkefølge/synlighet: light.basseng_lys, light.utelys_inngang, light.veranda_flomlys, light.verandalampe | Utelys |
| `include.utelys` | Lagt til · entities | Utelys |
| `lights.basseng_lys.name` | Navn | Utelys › Basseng lys |
| `lights.basseng_lys.icon` | Ikon · icon | Utelys › Basseng lys |
| `light_types.basseng_lys` | Lystype ( \| dim \| ct \| color \| onoff) | Utelys › Basseng lys |
| `lights.basseng_lys.brightness_min` | Minste lysstyrke (%) · number | Utelys › Basseng lys › Slider (avansert) |
| `lights.basseng_lys.brightness_max` | Største lysstyrke (%) · number | Utelys › Basseng lys › Slider (avansert) |
| `lights.basseng_lys.color_control` | Fargekontroll (utvidet) ( \| spectrum \| presets \| both) | Utelys › Basseng lys › Slider (avansert) |
| `lights.basseng_lys.hide_temperature_slider` | Skjul temperaturslider · boolean | Utelys › Basseng lys › Slider (avansert) |
| `lights.basseng_lys.hide_color_controls` | Skjul fargespekter · boolean | Utelys › Basseng lys › Slider (avansert) |
| `lights.basseng_lys.hide_color_presets` | Skjul fargeforhåndsvalg · boolean | Utelys › Basseng lys › Slider (avansert) |
| `lights.basseng_lys.color_presets` | Fargeforhåndsvalg | Utelys › Basseng lys › Slider (avansert) |
| `lights.utelys_inngang.name` | Navn | Utelys › Utelys inngang |
| `lights.utelys_inngang.icon` | Ikon · icon | Utelys › Utelys inngang |
| `light_types.utelys_inngang` | Lystype ( \| dim \| ct \| color \| onoff) | Utelys › Utelys inngang |
| `lights.utelys_inngang.brightness_min` | Minste lysstyrke (%) · number | Utelys › Utelys inngang › Slider (avansert) |
| `lights.utelys_inngang.brightness_max` | Største lysstyrke (%) · number | Utelys › Utelys inngang › Slider (avansert) |
| `lights.utelys_inngang.color_control` | Fargekontroll (utvidet) ( \| spectrum \| presets \| both) | Utelys › Utelys inngang › Slider (avansert) |
| `lights.utelys_inngang.hide_temperature_slider` | Skjul temperaturslider · boolean | Utelys › Utelys inngang › Slider (avansert) |
| `lights.utelys_inngang.hide_color_controls` | Skjul fargespekter · boolean | Utelys › Utelys inngang › Slider (avansert) |
| `lights.utelys_inngang.hide_color_presets` | Skjul fargeforhåndsvalg · boolean | Utelys › Utelys inngang › Slider (avansert) |
| `lights.utelys_inngang.color_presets` | Fargeforhåndsvalg | Utelys › Utelys inngang › Slider (avansert) |
| `lights.veranda_flomlys.name` | Navn | Utelys › Veranda flomlys |
| `lights.veranda_flomlys.icon` | Ikon · icon | Utelys › Veranda flomlys |
| `light_types.veranda_flomlys` | Lystype ( \| dim \| ct \| color \| onoff) | Utelys › Veranda flomlys |
| `lights.veranda_flomlys.brightness_min` | Minste lysstyrke (%) · number | Utelys › Veranda flomlys › Slider (avansert) |
| `lights.veranda_flomlys.brightness_max` | Største lysstyrke (%) · number | Utelys › Veranda flomlys › Slider (avansert) |
| `lights.veranda_flomlys.color_control` | Fargekontroll (utvidet) ( \| spectrum \| presets \| both) | Utelys › Veranda flomlys › Slider (avansert) |
| `lights.veranda_flomlys.hide_temperature_slider` | Skjul temperaturslider · boolean | Utelys › Veranda flomlys › Slider (avansert) |
| `lights.veranda_flomlys.hide_color_controls` | Skjul fargespekter · boolean | Utelys › Veranda flomlys › Slider (avansert) |
| `lights.veranda_flomlys.hide_color_presets` | Skjul fargeforhåndsvalg · boolean | Utelys › Veranda flomlys › Slider (avansert) |
| `lights.veranda_flomlys.color_presets` | Fargeforhåndsvalg | Utelys › Veranda flomlys › Slider (avansert) |
| `lights.verandalampe.name` | Navn | Utelys › Verandalampe |
| `lights.verandalampe.icon` | Ikon · icon | Utelys › Verandalampe |
| `light_types.verandalampe` | Lystype ( \| dim \| ct \| color \| onoff) | Utelys › Verandalampe |
| `lights.verandalampe.brightness_min` | Minste lysstyrke (%) · number | Utelys › Verandalampe › Slider (avansert) |
| `lights.verandalampe.brightness_max` | Største lysstyrke (%) · number | Utelys › Verandalampe › Slider (avansert) |
| `lights.verandalampe.color_control` | Fargekontroll (utvidet) ( \| spectrum \| presets \| both) | Utelys › Verandalampe › Slider (avansert) |
| `lights.verandalampe.hide_temperature_slider` | Skjul temperaturslider · boolean | Utelys › Verandalampe › Slider (avansert) |
| `lights.verandalampe.hide_color_controls` | Skjul fargespekter · boolean | Utelys › Verandalampe › Slider (avansert) |
| `lights.verandalampe.hide_color_presets` | Skjul fargeforhåndsvalg · boolean | Utelys › Verandalampe › Slider (avansert) |
| `lights.verandalampe.color_presets` | Fargeforhåndsvalg | Utelys › Verandalampe › Slider (avansert) |

## `msh-media-hero-card`

Sveipbar «nå spilles»-karusell med omslag for valgt fane. Første kort i Media-popupen.

| Nøkkel | Betydning | Gruppe |
|---|---|---|
| `tab_order · hidden_tabs` | rekkefølge/synlighet: tv, musikk |  |
| `exclude · include.{spillere}` | skjul / legg til |  |
| `area` | Begrens til område · area |  |
| `players.kjokken_radio.type` | Type (auto \| tv \| musikk \| skjul) | Kjøkken radio · Musikk · Kjøkken |
| `players.kjokken_radio.name` | Navn | Kjøkken radio · Musikk · Kjøkken |
| `players.kjokken_radio.icon` | Ikon · icon | Kjøkken radio · Musikk · Kjøkken |
| `players.kjokken_radio.shortcuts` | Snarveier (button/script/scene) · entities | Kjøkken radio · Musikk · Kjøkken |
| `players.kjokken_radio.chip_title` | Tittel over snarveier | Kjøkken radio · Musikk · Kjøkken |
| `players.kjokken_radio.hide_sources` | Skjul kilder (kommaseparert) | Kjøkken radio · Musikk · Kjøkken |
| `players.kjokken_radio.watch` | Statistikk (sensorer under omslaget) · entities | Kjøkken radio · Musikk · Kjøkken |
| `players.rn602_stue.type` | Type (auto \| tv \| musikk \| skjul) | RN602 stue · Musikk · Stue |
| `players.rn602_stue.name` | Navn | RN602 stue · Musikk · Stue |
| `players.rn602_stue.icon` | Ikon · icon | RN602 stue · Musikk · Stue |
| `players.rn602_stue.shortcuts` | Snarveier (button/script/scene) · entities | RN602 stue · Musikk · Stue |
| `players.rn602_stue.chip_title` | Tittel over snarveier | RN602 stue · Musikk · Stue |
| `players.rn602_stue.hide_sources` | Skjul kilder (kommaseparert) | RN602 stue · Musikk · Stue |
| `players.rn602_stue.watch` | Statistikk (sensorer under omslaget) · entities | RN602 stue · Musikk · Stue |
| `players.stue_sonos.type` | Type (auto \| tv \| musikk \| skjul) | Stue Sonos · Musikk · Stue |
| `players.stue_sonos.name` | Navn | Stue Sonos · Musikk · Stue |
| `players.stue_sonos.icon` | Ikon · icon | Stue Sonos · Musikk · Stue |
| `players.stue_sonos.shortcuts` | Snarveier (button/script/scene) · entities | Stue Sonos · Musikk · Stue |
| `players.stue_sonos.chip_title` | Tittel over snarveier | Stue Sonos · Musikk · Stue |
| `players.stue_sonos.hide_sources` | Skjul kilder (kommaseparert) | Stue Sonos · Musikk · Stue |
| `players.stue_sonos.watch` | Statistikk (sensorer under omslaget) · entities | Stue Sonos · Musikk · Stue |
| `players.stue_tv.type` | Type (auto \| tv \| musikk \| skjul) | Stue TV · TV · Stue |
| `players.stue_tv.name` | Navn | Stue TV · TV · Stue |
| `players.stue_tv.icon` | Ikon · icon | Stue TV · TV · Stue |
| `players.stue_tv.platform` | Plattform (apple \| google) | Stue TV · TV · Stue |
| `players.stue_tv.remote` | Fjernkontroll (remote) · entity | Stue TV · TV · Stue |
| `players.stue_tv.back_hold_action` | Hold Tilbake · action | Stue TV · TV · Stue |
| `players.stue_tv.home_hold_action` | Hold Hjem · action | Stue TV · TV · Stue |
| `players.stue_tv.menu_hold_action` | Hold Meny · action | Stue TV · TV · Stue |
| `players.stue_tv.volume` | Volum styres av (media \| buttons) | Stue TV · TV · Stue |
| `players.stue_tv.volume_up` | Volum opp · entity | Stue TV · TV · Stue |
| `players.stue_tv.volume_down` | Volum ned · entity | Stue TV · TV · Stue |
| `players.stue_tv.volume_mute` | Demp · entity | Stue TV · TV · Stue |
| `players.stue_tv.hide_sources` | Skjul apper (kommaseparert) | Stue TV · TV · Stue |
| `players.stue_tv.watch` | Seertid (sensorer under omslaget) · entities | Stue TV · TV · Stue |
| `players.soverom_tv.type` | Type (auto \| tv \| musikk \| skjul) | Soverom TV · TV · Soverom |
| `players.soverom_tv.name` | Navn | Soverom TV · TV · Soverom |
| `players.soverom_tv.icon` | Ikon · icon | Soverom TV · TV · Soverom |
| `players.soverom_tv.platform` | Plattform (apple \| google) | Soverom TV · TV · Soverom |
| `players.soverom_tv.remote` | Fjernkontroll (remote) · entity | Soverom TV · TV · Soverom |
| `players.soverom_tv.back_hold_action` | Hold Tilbake · action | Soverom TV · TV · Soverom |
| `players.soverom_tv.home_hold_action` | Hold Hjem · action | Soverom TV · TV · Soverom |
| `players.soverom_tv.menu_hold_action` | Hold Meny · action | Soverom TV · TV · Soverom |
| `players.soverom_tv.volume` | Volum styres av (media \| buttons) | Soverom TV · TV · Soverom |
| `players.soverom_tv.volume_up` | Volum opp · entity | Soverom TV · TV · Soverom |
| `players.soverom_tv.volume_down` | Volum ned · entity | Soverom TV · TV · Soverom |
| `players.soverom_tv.volume_mute` | Demp · entity | Soverom TV · TV · Soverom |
| `players.soverom_tv.hide_sources` | Skjul apper (kommaseparert) | Soverom TV · TV · Soverom |
| `players.soverom_tv.watch` | Seertid (sensorer under omslaget) · entities | Soverom TV · TV · Soverom |
| `remote_swipe` | Sveip på styreflaten · boolean |  |
| `toasts` | Bekreftelsesmeldinger · boolean |  |

## `msh-media-card`

Faner (TV/Musikk), apper/kilder, transport eller fjernkontroll og volum for alle media_player.*

| Nøkkel | Betydning | Gruppe |
|---|---|---|
| `default_tab` | Fane ved åpning (tv \| musikk \| last) |  |
| `tab_order · hidden_tabs` | rekkefølge/synlighet: tv, musikk |  |
| `exclude · include.{spillere}` | skjul / legg til |  |
| `area` | Begrens til område · area |  |
| `players.kjokken_radio.type` | Type (auto \| tv \| musikk \| skjul) | Kjøkken radio · Musikk · Kjøkken |
| `players.kjokken_radio.name` | Navn | Kjøkken radio · Musikk · Kjøkken |
| `players.kjokken_radio.icon` | Ikon · icon | Kjøkken radio · Musikk · Kjøkken |
| `players.kjokken_radio.shortcuts` | Snarveier (button/script/scene) · entities | Kjøkken radio · Musikk · Kjøkken |
| `players.kjokken_radio.chip_title` | Tittel over snarveier | Kjøkken radio · Musikk · Kjøkken |
| `players.kjokken_radio.hide_sources` | Skjul kilder (kommaseparert) | Kjøkken radio · Musikk · Kjøkken |
| `players.kjokken_radio.watch` | Statistikk (sensorer under omslaget) · entities | Kjøkken radio · Musikk · Kjøkken |
| `players.rn602_stue.type` | Type (auto \| tv \| musikk \| skjul) | RN602 stue · Musikk · Stue |
| `players.rn602_stue.name` | Navn | RN602 stue · Musikk · Stue |
| `players.rn602_stue.icon` | Ikon · icon | RN602 stue · Musikk · Stue |
| `players.rn602_stue.shortcuts` | Snarveier (button/script/scene) · entities | RN602 stue · Musikk · Stue |
| `players.rn602_stue.chip_title` | Tittel over snarveier | RN602 stue · Musikk · Stue |
| `players.rn602_stue.hide_sources` | Skjul kilder (kommaseparert) | RN602 stue · Musikk · Stue |
| `players.rn602_stue.watch` | Statistikk (sensorer under omslaget) · entities | RN602 stue · Musikk · Stue |
| `players.stue_sonos.type` | Type (auto \| tv \| musikk \| skjul) | Stue Sonos · Musikk · Stue |
| `players.stue_sonos.name` | Navn | Stue Sonos · Musikk · Stue |
| `players.stue_sonos.icon` | Ikon · icon | Stue Sonos · Musikk · Stue |
| `players.stue_sonos.shortcuts` | Snarveier (button/script/scene) · entities | Stue Sonos · Musikk · Stue |
| `players.stue_sonos.chip_title` | Tittel over snarveier | Stue Sonos · Musikk · Stue |
| `players.stue_sonos.hide_sources` | Skjul kilder (kommaseparert) | Stue Sonos · Musikk · Stue |
| `players.stue_sonos.watch` | Statistikk (sensorer under omslaget) · entities | Stue Sonos · Musikk · Stue |
| `players.stue_tv.type` | Type (auto \| tv \| musikk \| skjul) | Stue TV · TV · Stue |
| `players.stue_tv.name` | Navn | Stue TV · TV · Stue |
| `players.stue_tv.icon` | Ikon · icon | Stue TV · TV · Stue |
| `players.stue_tv.platform` | Plattform (apple \| google) | Stue TV · TV · Stue |
| `players.stue_tv.remote` | Fjernkontroll (remote) · entity | Stue TV · TV · Stue |
| `players.stue_tv.back_hold_action` | Hold Tilbake · action | Stue TV · TV · Stue |
| `players.stue_tv.home_hold_action` | Hold Hjem · action | Stue TV · TV · Stue |
| `players.stue_tv.menu_hold_action` | Hold Meny · action | Stue TV · TV · Stue |
| `players.stue_tv.volume` | Volum styres av (media \| buttons) | Stue TV · TV · Stue |
| `players.stue_tv.volume_up` | Volum opp · entity | Stue TV · TV · Stue |
| `players.stue_tv.volume_down` | Volum ned · entity | Stue TV · TV · Stue |
| `players.stue_tv.volume_mute` | Demp · entity | Stue TV · TV · Stue |
| `players.stue_tv.hide_sources` | Skjul apper (kommaseparert) | Stue TV · TV · Stue |
| `players.stue_tv.watch` | Seertid (sensorer under omslaget) · entities | Stue TV · TV · Stue |
| `players.soverom_tv.type` | Type (auto \| tv \| musikk \| skjul) | Soverom TV · TV · Soverom |
| `players.soverom_tv.name` | Navn | Soverom TV · TV · Soverom |
| `players.soverom_tv.icon` | Ikon · icon | Soverom TV · TV · Soverom |
| `players.soverom_tv.platform` | Plattform (apple \| google) | Soverom TV · TV · Soverom |
| `players.soverom_tv.remote` | Fjernkontroll (remote) · entity | Soverom TV · TV · Soverom |
| `players.soverom_tv.back_hold_action` | Hold Tilbake · action | Soverom TV · TV · Soverom |
| `players.soverom_tv.home_hold_action` | Hold Hjem · action | Soverom TV · TV · Soverom |
| `players.soverom_tv.menu_hold_action` | Hold Meny · action | Soverom TV · TV · Soverom |
| `players.soverom_tv.volume` | Volum styres av (media \| buttons) | Soverom TV · TV · Soverom |
| `players.soverom_tv.volume_up` | Volum opp · entity | Soverom TV · TV · Soverom |
| `players.soverom_tv.volume_down` | Volum ned · entity | Soverom TV · TV · Soverom |
| `players.soverom_tv.volume_mute` | Demp · entity | Soverom TV · TV · Soverom |
| `players.soverom_tv.hide_sources` | Skjul apper (kommaseparert) | Soverom TV · TV · Soverom |
| `players.soverom_tv.watch` | Seertid (sensorer under omslaget) · entities | Soverom TV · TV · Soverom |
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
| `mode` | Startmodus (live \| frigate) | Visning |
| `view` | Startvisning (alle \| events) | Visning |
| `refresh` | Oppdater stillbilder (sekunder) · number | Visning |
| `frigate_instance` | Frigate-instans | Visning |
| `area` | Begrens til område · area | Visning |
| `toasts` | Bekreftelsesmeldinger · boolean | Visning |
| `cam_gap` | Mellomrom mellom kameraer · range | Utseende |
| `show_name` | Vis navn på kameraene · boolean | Utseende |
| `show_badge` | Vis «OPPTAK»-merke · boolean | Utseende |
| `text_size` | Tekststørrelse (xs \| s \| m \| l) | Utseende |
| `show_events` | Vis «Hendelser» · boolean | Hendelser |
| `events_limit` | Maks antall hendelser · number | Hendelser |
| `events_columns` | Kolonner · number | Hendelser |
| `events_height` | Maks høyde | Hendelser |
| `order · hidden` | rekkefølge/synlighet: camera.inngang, camera.pakke, camera.veranda, camera.garasje, camera.innkjorsel |  |
| `exclude · include.{kameraer}` | skjul / legg til |  |
| `cameras.inngang.name` | Navn | Inngang |
| `cameras.inngang.icon` | Ikon · icon | Inngang |
| `cameras.inngang.light` | Lys · entity | Inngang |
| `cameras.inngang.siren` | Sirene · entity | Inngang |
| `cameras.inngang.talk` | Snakk (script/button) · entity | Inngang |
| `cameras.inngang.privacy` | Personvern-modus · entity | Inngang |
| `cameras.inngang.motion` | Bevegelse · entity | Inngang |
| `cameras.inngang.last_motion` | Siste bevegelse · entity | Inngang |
| `cameras.pakke.name` | Navn | Pakke |
| `cameras.pakke.icon` | Ikon · icon | Pakke |
| `cameras.pakke.light` | Lys · entity | Pakke |
| `cameras.pakke.siren` | Sirene · entity | Pakke |
| `cameras.pakke.talk` | Snakk (script/button) · entity | Pakke |
| `cameras.pakke.privacy` | Personvern-modus · entity | Pakke |
| `cameras.pakke.motion` | Bevegelse · entity | Pakke |
| `cameras.pakke.last_motion` | Siste bevegelse · entity | Pakke |
| `cameras.veranda.name` | Navn | Veranda |
| `cameras.veranda.icon` | Ikon · icon | Veranda |
| `cameras.veranda.light` | Lys · entity | Veranda |
| `cameras.veranda.siren` | Sirene · entity | Veranda |
| `cameras.veranda.talk` | Snakk (script/button) · entity | Veranda |
| `cameras.veranda.privacy` | Personvern-modus · entity | Veranda |
| `cameras.veranda.motion` | Bevegelse · entity | Veranda |
| `cameras.veranda.last_motion` | Siste bevegelse · entity | Veranda |
| `cameras.garasje.name` | Navn | Garasje |
| `cameras.garasje.icon` | Ikon · icon | Garasje |
| `cameras.garasje.light` | Lys · entity | Garasje |
| `cameras.garasje.siren` | Sirene · entity | Garasje |
| `cameras.garasje.talk` | Snakk (script/button) · entity | Garasje |
| `cameras.garasje.privacy` | Personvern-modus · entity | Garasje |
| `cameras.garasje.motion` | Bevegelse · entity | Garasje |
| `cameras.garasje.last_motion` | Siste bevegelse · entity | Garasje |
| `cameras.innkjorsel.name` | Navn | Innkjørsel |
| `cameras.innkjorsel.icon` | Ikon · icon | Innkjørsel |
| `cameras.innkjorsel.light` | Lys · entity | Innkjørsel |
| `cameras.innkjorsel.siren` | Sirene · entity | Innkjørsel |
| `cameras.innkjorsel.talk` | Snakk (script/button) · entity | Innkjørsel |
| `cameras.innkjorsel.privacy` | Personvern-modus · entity | Innkjørsel |
| `cameras.innkjorsel.motion` | Bevegelse · entity | Innkjørsel |
| `cameras.innkjorsel.last_motion` | Siste bevegelse · entity | Innkjørsel |
| `pad_top` | Fra popup-headeren til første kort · range | Mellomrom |
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
| `sensors.binary_sensor.garasjeport.name` | Navn | Sensorer · navn, type og rom › Annet · 2 |
| `sensors.binary_sensor.garasjeport.type` | Type (door \| window \| lock \| motion \| presence) | Sensorer · navn, type og rom › Annet · 2 |
| `sensors.binary_sensor.garasjeport.room` | Rom | Sensorer · navn, type og rom › Annet · 2 |
| `sensors.lock.bod.name` | Navn | Sensorer · navn, type og rom › Annet · 2 |
| `sensors.lock.bod.type` | Type (door \| window \| lock \| motion \| presence) | Sensorer · navn, type og rom › Annet · 2 |
| `sensors.lock.bod.room` | Rom | Sensorer · navn, type og rom › Annet · 2 |
| `show_ring` | Sensorring · stor ring med alle sensorer · boolean | Visning |

## `msh-sikkerhet-card`

Alarmmodus (hold inne, kode via tastatur), varsler, sensorer per rom og siste hendelser. #sikkerhet

| Nøkkel | Betydning | Gruppe |
|---|---|---|
| `overrides.{alarm}` | bytt entitet |  |
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
| `sensors.binary_sensor.garasjeport.name` | Navn | Sensorer · navn, type og rom › Annet · 2 |
| `sensors.binary_sensor.garasjeport.type` | Type (door \| window \| lock \| motion \| presence) | Sensorer · navn, type og rom › Annet · 2 |
| `sensors.binary_sensor.garasjeport.room` | Rom | Sensorer · navn, type og rom › Annet · 2 |
| `sensors.lock.bod.name` | Navn | Sensorer · navn, type og rom › Annet · 2 |
| `sensors.lock.bod.type` | Type (door \| window \| lock \| motion \| presence) | Sensorer · navn, type og rom › Annet · 2 |
| `sensors.lock.bod.room` | Rom | Sensorer · navn, type og rom › Annet · 2 |
| `sections · hidden_sections` | rekkefølge/synlighet: modes, alerts, rooms, log, edit |  |
| `show_alerts` | Varsler · «Krever oppmerksomhet» øverst · boolean | Visning |
| `show_log` | Siste hendelser · logg nederst · boolean | Visning |
| `sensor_view` | Sensorer i rom (rows \| chips) | Visning |
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
| `stops.entur_bislett.lines` | Linjer (line_whitelist) · tomt = alle | Stopp · navn, ikon, gangtid og linjer › Bislett |
| `stops.entur_bislett.count` | Antall avganger · number | Stopp · navn, ikon, gangtid og linjer › Bislett |
| `stops.entur_stoppested.name` | Navn | Stopp · navn, ikon, gangtid og linjer › Majorstuen |
| `stops.entur_stoppested.icon` | Ikon · icon | Stopp · navn, ikon, gangtid og linjer › Majorstuen |
| `stops.entur_stoppested.walk` | Gangtid / tekst | Stopp · navn, ikon, gangtid og linjer › Majorstuen |
| `stops.entur_stoppested.lines` | Linjer (line_whitelist) · tomt = alle | Stopp · navn, ikon, gangtid og linjer › Majorstuen |
| `stops.entur_stoppested.count` | Antall avganger · number | Stopp · navn, ikon, gangtid og linjer › Majorstuen |
| `stops.entur_holbergs_plass.name` | Navn | Stopp · navn, ikon, gangtid og linjer › Holbergs plass |
| `stops.entur_holbergs_plass.icon` | Ikon · icon | Stopp · navn, ikon, gangtid og linjer › Holbergs plass |
| `stops.entur_holbergs_plass.walk` | Gangtid / tekst | Stopp · navn, ikon, gangtid og linjer › Holbergs plass |
| `stops.entur_holbergs_plass.lines` | Linjer (line_whitelist) · tomt = alle | Stopp · navn, ikon, gangtid og linjer › Holbergs plass |
| `stops.entur_holbergs_plass.count` | Antall avganger · number | Stopp · navn, ikon, gangtid og linjer › Holbergs plass |
| `overrides.{avvik}` | bytt entitet |  |
| `show_disruptions` | Vis avvikskort · øverst i popupen · boolean | Visning |
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
| `show_extras` | Toppkort side 2 · Andre varsler (sol, måne, UV) · boolean | Visning |
| `show_pollen` | Toppkort side 3 · Pollen i dag · boolean | Visning |

## `msh-vaer-card`

Toppkort, farevarsler, time for time, dagskort, detaljkort og månefase med «Tilpass været». Prognose abonneres kun mens #vaer er åpen.

| Nøkkel | Betydning | Gruppe |
|---|---|---|
| `overrides.{weather, sol, mane, uv}` | bytt entitet |  |
| `sections · hidden_sections` | rekkefølge/synlighet: hero, alerts, hours, days, tiles, moon |  |
| `tiles · hidden_tiles` | rekkefølge/synlighet: sky, wind, gust, sun, hum, uv, press, rain |  |
| `name` | Stedsnavn | Toppkort |
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
