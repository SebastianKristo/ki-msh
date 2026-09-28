/* msh-kart-card · Kart-popup #kart (fiks 20.22, fasit «Kart.html», fiks 23.3). Fullskjerm-kart med personer, biler, soner og kollektiv.
 * Popup (23.3): Bubble Card pop-up (Mal A + M.POPUP_LOOK['#kart'], håndhevet etter overstyringer via M.POPUP_FORCE['#kart']):
 *   margin_top 0, bg_opacity 0, bg_blur 0, radius 0, overflow hidden, popupen starter i toppen av dashbord-containeren
 *   (Bubble legger ellers 56 px + margin_top over). Bubble-headeren (ikon, «Kart», ×) ligger absolutt over kartet, transparent,
 *   rett under safe-area-inset-top; tannhjulet står ved siden av ×. Kortet fyller popupen (absolute, inset 0, høyde i px fra
 *   dashbord-containeren). Navbaren er eget kort; ledig flate leses fra --ki-nav-occ-* / 'ki-nav-rect' (10-navbar.js).
 * Kart: HAs ha-map (leafletMap + Leaflet fra elementet) når den finnes, ellers Leaflet 1.9.4 lastet én gang på dokumentnivå
 *   (MSH.leafletLoad) + CARTO-fliser (dark_all/light_all, eller egen tile_url) med attribusjon (fiks 22.4, ingen invert). Kartflaten har
 *   touch-action: none og stopPropagation (pointer/touch/wheel), så pan/zoom aldri lukker popupen (fallgruve 2).
 *   Markører er divIcon med bare inline-stil (fungerer både i vår shadow root og inni ha-map).
 * Lag: soner (zone.*, farge/ikon fra «Tilpass header → Status og soner» via MSH.hjemZoneStyle), personer (person.* med
 *   posisjon, ring i statusfargen fra MSH.personStatus – i bevegelse = oransje puls), biler (device_tracker med GPS valgt
 *   i editoren / autokonfig), kollektiv (Entur sanntid: vehicles(lineRef) for linjene fra #ruter, hvert 15. s bare mens
 *   #kart er åpen – fallgruve 8; linjeoppslag og rutelinjer via MSH.enturGQL fra 47-ruter.js).
 * Config: { persons: [], cars: [], zones: 'all' | [], transit: true, lines: [], start: 'fit'|'home'|'me', style: 'dark'|'light'|'satellite', tile_url? }
 */
(function () {
  const M = window.MSH;
  if (!M || customElements.get('msh-kart-card')) return;
  const esc = M.esc, C = M.C;
  const HASH = '#kart';
  const PINK = C.accent;
  const DEF = { persons: [], cars: [], zones: 'all', transit: true, lines: [], start: 'fit', style: 'dark' };
  const LAYERS = [['persons', 'Personer', 'mdi:account-multiple'], ['cars', 'Biler', 'mdi:car'], ['zones', 'Soner', 'mdi:map-marker-radius'], ['transit', 'Kollektiv', 'mdi:bus']];
  const LEAF_JS = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js';
  const LEAF_CSS = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css';
  // Fiks 23.3: kjernen av leaflet.css (1.9.4) ligger ALLTID i kortets shadow root (dokumentets <link> når ikke inn hit, og
  //   CDN-en kan svikte). Uten den mangler .leaflet-container touch-action: none, og nettleseren tar pan/knip-gestene.
  const LEAF_BASE = `.leaflet-pane,.leaflet-tile,.leaflet-marker-icon,.leaflet-marker-shadow,.leaflet-tile-container,.leaflet-pane>svg,.leaflet-pane>canvas,.leaflet-zoom-box,.leaflet-image-layer,.leaflet-layer{position:absolute;left:0;top:0}
    .leaflet-container{overflow:hidden;-webkit-tap-highlight-color:transparent;outline:0;background:#1d1d1d;font-family:inherit}
    .leaflet-tile,.leaflet-marker-icon,.leaflet-marker-shadow{-webkit-user-select:none;user-select:none;-webkit-user-drag:none}
    .leaflet-marker-icon,.leaflet-marker-shadow{display:block}
    .leaflet-container .leaflet-overlay-pane svg{max-width:none!important;max-height:none!important}
    .leaflet-container .leaflet-marker-pane img,.leaflet-container .leaflet-tile-pane img,.leaflet-container img.leaflet-image-layer,.leaflet-container .leaflet-tile{max-width:none!important;max-height:none!important;width:auto;padding:0}
    .leaflet-container.leaflet-touch-zoom{touch-action:pan-x pan-y}
    .leaflet-container.leaflet-touch-drag,.leaflet-container.leaflet-touch-drag.leaflet-touch-zoom,.leaflet-container{touch-action:none}
    .leaflet-tile{filter:inherit;visibility:hidden}.leaflet-tile-loaded{visibility:inherit}
    .leaflet-zoom-box{width:0;height:0;box-sizing:border-box;z-index:800}
    .leaflet-pane{z-index:400}.leaflet-tile-pane{z-index:200}.leaflet-overlay-pane{z-index:400}.leaflet-shadow-pane{z-index:500}.leaflet-marker-pane{z-index:600}.leaflet-tooltip-pane{z-index:650}.leaflet-popup-pane{z-index:700}.leaflet-map-pane canvas{z-index:100}.leaflet-map-pane svg{z-index:200}
    .leaflet-control{position:relative;z-index:800;pointer-events:auto}
    .leaflet-top,.leaflet-bottom{position:absolute;z-index:1000;pointer-events:none}.leaflet-top{top:0}.leaflet-right{right:0}.leaflet-bottom{bottom:0}.leaflet-left{left:0}
    .leaflet-zoom-animated{transform-origin:0 0}
    .leaflet-zoom-anim .leaflet-zoom-animated{transition:transform .25s cubic-bezier(0,0,.25,1)}
    .leaflet-zoom-anim .leaflet-tile,.leaflet-pan-anim .leaflet-tile{transition:none}.leaflet-zoom-anim .leaflet-zoom-hide{visibility:hidden}
    .leaflet-interactive{cursor:pointer}.leaflet-grab{cursor:grab}.leaflet-dragging .leaflet-grab{cursor:grabbing}
    .leaflet-marker-icon,.leaflet-marker-shadow,.leaflet-image-layer,.leaflet-pane>svg path,.leaflet-tile-container{pointer-events:none}
    .leaflet-marker-icon.leaflet-interactive,.leaflet-image-layer.leaflet-interactive,.leaflet-pane>svg path.leaflet-interactive{pointer-events:auto}`;
  // Fiks 22.4: CARTO-fliser (som HAs eget kart) – tile.openstreetmap.org gir 403 fra dashbord. Ingen invert-filter.
  const CARTO_ATT = '© OpenStreetMap contributors © CARTO';
  const TILES = {
    dark: ['https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', CARTO_ATT],
    light: ['https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', CARTO_ATT],
    satellite: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', 'Bilder © Esri'],
  };
  const styleOf = (c) => (c.tile_url ? 'custom' : c.style === 'standard' ? 'light' : TILES[c.style] ? c.style : 'dark'); // «standard» (fiks 20) = light
  const tileDef = (c) => { const st = styleOf(c); return st === 'custom' ? [String(c.tile_url), c.tile_attribution || '© OpenStreetMap contributors'] : TILES[st]; };
  // Transportmiddel → linjefarge (samme som Ruter-kortet) når Entur ikke gir presentation.colour
  const MODE_COL = { metro: 'oklch(0.66 0.16 45)', tram: 'oklch(0.62 0.13 245)', bus: 'oklch(0.6 0.17 25)', coach: 'oklch(0.6 0.17 25)', rail: 'oklch(0.55 0.12 260)', water: 'oklch(0.6 0.1 220)', ferry: 'oklch(0.6 0.1 220)' };
  const MODE_L = { metro: 'T-bane', tram: 'Trikk', bus: 'Buss', coach: 'Buss', rail: 'Tog', water: 'Båt', ferry: 'Båt' };
  const OCC = { empty: 'God plass', manySeatsAvailable: 'God plass', many_seats_available: 'God plass', fewSeatsAvailable: 'Noen ledige seter', few_seats_available: 'Noen ledige seter', standingRoomOnly: 'Bare ståplass', standing_room_only: 'Bare ståplass', full: 'Fullt', notAcceptingPassengers: 'Tar ikke passasjerer' };
  const CAR_RX = /tesla|(^|_)bil(_|$)|(^|_)car(_|$)|vehicle|kjoretoy|volvo|polestar|(^|_)kia(_|$)|hyundai|ioniq|(^|_)leaf(_|$)|audi|bmw|mercedes|skoda|enyaq|volkswagen|(^|_)vw(_|$)|(^|_)id_?[3457](_|$)|model_?[3sxy](_|$)|mach_?e|(^|_)bmw|peugeot|toyota|nissan|renault|zoe/;
  const MOVE_RX = /automotive|in_vehicle|driving|cycling|on_bicycle|running|kjører/i;
  const num = (v) => (v == null || v === '' || isNaN(Number(v)) ? null : Number(v));
  const hm = (t) => { const d = new Date(t); return `${M.pad(d.getHours())}:${M.pad(d.getMinutes())}`; };
  const objId = (id) => String(id || '').split('.').slice(1).join('.');
  const clientName = (hass) => `${String((hass && hass.user && hass.user.name) || 'ha').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'ha'}-ki-dashboard`;
  const dist = (a, b) => { // meter mellom [lat, lon]
    const R = 6371000, r = Math.PI / 180, dl = (b[0] - a[0]) * r, dn = (b[1] - a[1]) * r;
    const x = Math.sin(dl / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dn / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  };

  /* ------------------------------------------------------------ Leaflet (én gang på dokumentnivå, fallgruve 5) */
  M.leafletLoad = M.leafletLoad || function () {
    if (window.L && window.L.map) return Promise.resolve(window.L);
    if (M._leafP) return M._leafP;
    M._leafP = new Promise((res, rej) => {
      if (!document.querySelector('link[data-msh-leaflet]')) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = LEAF_CSS; l.setAttribute('data-msh-leaflet', ''); document.head.appendChild(l); }
      const s = document.createElement('script');
      s.src = LEAF_JS; s.async = true; s.setAttribute('data-msh-leaflet', '');
      s.onload = () => (window.L && window.L.map ? res(window.L) : rej(new Error('Leaflet mangler')));
      s.onerror = () => { M._leafP = null; rej(new Error('Kunne ikke laste Leaflet')); };
      document.head.appendChild(s);
    });
    return M._leafP;
  };

  /* ------------------------------------------------------------ status (MSH.personStatus fra 20-hjem-header, ellers lokal reserve) */
  const zoneByState = (h, st) => {
    if (!st) return null;
    if (st === 'home') return h.states['zone.home'] ? 'zone.home' : null;
    return Object.keys(h.states).find((z) => z.startsWith('zone.') && (h.states[z].attributes.friendly_name === st || objId(z) === M.slug(st))) || null;
  };
  const zoneStyle = (h, zid) => {
    if (M.hjemZoneStyle) { try { return M.hjemZoneStyle(h, (M.hjemHeaderCfg && M.hjemHeaderCfg()) || {}, zid); } catch (e) { /* reserve */ } }
    const s = h.states[zid];
    if (zid === 'zone.home') return { icon: 'mdi:home', color: C.green };
    return { icon: (s && s.attributes.icon) || 'mdi:map-marker', color: C.blue };
  };
  function statusOf(h, pid) {
    if (M.personStatus) { try { const st = M.personStatus(h, pid); if (st) return st; } catch (e) { /* reserve */ } }
    const s = h.states[pid];
    if (!s || M.unavailable(s)) return { kind: 'unknown', color: null, icon: null, place: '–', label: '–', zone: null };
    if (s.state === 'home') return { kind: 'home', color: C.green, icon: 'mdi:home', place: 'Hjemme', label: 'Hjemme', zone: 'zone.home' };
    if (s.state === 'not_home') return { kind: 'away', color: C.purple, icon: 'mdi:airplane', place: 'Borte', label: 'Borte', zone: null };
    const z = zoneByState(h, s.state), zs = z ? zoneStyle(h, z) : { icon: 'mdi:map-marker', color: C.blue };
    return { kind: 'zone', color: zs.color, icon: zs.icon, place: s.state, label: s.state, zone: z };
  }

  /* ------------------------------------------------------------ autokonfig */
  const posOf = (h, id) => { const s = id && h.states[id]; if (!s) return null; const la = num(s.attributes.latitude), lo = num(s.attributes.longitude); return la != null && lo != null ? [la, lo] : null; };
  const devIds = (h, id) => { const e = h.entities && h.entities[id], dev = e && e.device_id; return dev ? Object.keys(h.entities).filter((x) => h.entities[x].device_id === dev && h.states[x]) : []; };
  const findOn = (h, ids, dom, rx, dc) => ids.find((x) => x.startsWith(dom + '.') && ((dc && h.states[x].attributes.device_class === dc) || rx.test(x))) || null;
  const homePos = (h) => posOf(h, 'zone.home') || (h.config && num(h.config.latitude) != null ? [Number(h.config.latitude), Number(h.config.longitude)] : null);
  const phoneOf = (h, pid) => { const a = (h.states[pid] || {}).attributes || {}; const src = a.source || (Array.isArray(a.device_trackers) ? a.device_trackers[0] : null); return src && h.states[src] ? src : null; };
  M.kartPersons = function (h, c) {
    const ids = (Array.isArray(c.persons) && c.persons.length ? c.persons : M.all(h, 'person')).filter((id) => h.states[id]);
    return ids.map((id) => {
      const s = h.states[id], a = s.attributes, st = statusOf(h, id), ph = phoneOf(h, id), pa = ph ? h.states[ph].attributes : {};
      let pos = posOf(h, id) || posOf(h, ph);
      if (!pos && st.zone) pos = posOf(h, st.zone);
      const D = ph ? devIds(h, ph) : [];
      const bat = num(pa.battery_level) != null ? num(pa.battery_level) : (() => { const b = findOn(h, D, 'sensor', /battery_level|batteri(niva)?$/, 'battery'); return b ? num(h.states[b].state) : null; })();
      const act = findOn(h, D, 'sensor', /activity|aktivitet/);
      const spd = num(a.speed) != null ? num(a.speed) : num(pa.speed);
      const kmh = spd != null && spd >= 0 ? Math.round(spd * 3.6) : null;
      const moving = (kmh != null && kmh >= 7) || (act && MOVE_RX.test(String(h.states[act].state)));
      const pic = a.entity_picture ? (M.hjemPicUrl ? M.hjemPicUrl(h, a.entity_picture) : a.entity_picture) : null;
      return { id, kind: 'p', name: M.name(h, id), first: String(M.name(h, id)).split(/\s+/)[0], pos, st, moving, kmh, bat, acc: num(a.gps_accuracy != null ? a.gps_accuracy : pa.gps_accuracy), since: s.last_changed, upd: (ph && h.states[ph].last_updated) || s.last_updated, pic, user: a.user_id || null, col: moving ? C.orange : st.color || (st.kind === 'away' ? C.purple : 'var(--gray600,#7f7f7f)') };
    });
  };
  M.kartCarsAuto = function (h) {
    const phones = new Set();
    M.all(h, 'person').forEach((p) => { const a = h.states[p].attributes; [a.source, ...(a.device_trackers || [])].forEach((x) => x && phones.add(x)); });
    return M.all(h, 'device_tracker').filter((id) => !phones.has(id) && h.states[id].attributes.source_type === 'gps' && (CAR_RX.test(objId(id)) || CAR_RX.test(M.slug(h.states[id].attributes.friendly_name || ''))));
  };
  M.kartCars = function (h, c) {
    const ids = (Array.isArray(c.cars) && c.cars.length ? c.cars : M.kartCarsAuto(h)).filter((id) => h.states[id]);
    return ids.map((id) => {
      const s = h.states[id], a = s.attributes, D = devIds(h, id), val = (x) => (x ? num(h.states[x].state) : null);
      const batId = findOn(h, D, 'sensor', /battery_level|batteri(niva)?$|_battery$/, 'battery'), rngId = findOn(h, D, 'sensor', /range|rekkevidde/);
      const spdId = findOn(h, D, 'sensor', /_speed$|_fart$/, 'speed'), shift = findOn(h, D, 'sensor', /shift_state|gir/);
      const lock = D.find((x) => x.startsWith('lock.')) || null, eta = findOn(h, D, 'sensor', /time_to_arrival|arrival|ankomst|_eta$/);
      const sp = val(spdId) != null ? val(spdId) : num(a.speed) != null ? Math.round(num(a.speed) * 3.6) : null;
      const moving = (sp != null && sp > 3) || (shift && /^(d|r|drive|reverse)$/i.test(String(h.states[shift].state)));
      let etaTxt = null;
      if (eta) { const es = h.states[eta]; const t = new Date(es.state).getTime(); etaTxt = !isNaN(t) && /T|:/.test(es.state) ? hm(t) : M.isNum(es.state) ? `${Math.round(Number(es.state))} min` : null; }
      const pic = a.entity_picture ? (M.hjemPicUrl ? M.hjemPicUrl(h, a.entity_picture) : a.entity_picture) : null;
      return { id, kind: 'c', name: M.name(h, id), pos: posOf(h, id), moving, kmh: sp, bat: val(batId) != null ? val(batId) : num(a.battery_level), range: val(rngId) != null ? val(rngId) : num(a.est_battery_range != null ? a.est_battery_range : a.range), rangeU: rngId ? h.states[rngId].attributes.unit_of_measurement || 'km' : 'km', lock, locked: lock ? h.states[lock].state === 'locked' : null, eta: etaTxt, upd: s.last_updated, pic };
    });
  };
  M.kartZones = function (h, c) {
    const all = M.all(h, 'zone').filter((z) => posOf(h, z));
    const ids = Array.isArray(c.zones) ? c.zones.filter((z) => all.includes(z)) : all;
    return ids.map((id) => { const a = h.states[id].attributes, zs = zoneStyle(h, id); return { id, kind: 'z', name: id === 'zone.home' ? (a.friendly_name && a.friendly_name !== 'Home' ? a.friendly_name : 'Hjem') : M.name(h, id), pos: posOf(h, id), r: num(a.radius) || 100, icon: zs.icon, col: zs.color }; });
  };

  /* ------------------------------------------------------------ kollektiv (Entur) */
  const VEH = 'https://api.entur.io/realtime/v2/vehicles/graphql';
  const TR = (M.kartTransit = M.kartTransit || { lines: [], key: '', linesT: 0, routes: {}, veh: [], t: 0, err: null, busy: false, quay: {} });
  const Q_LINES = 'query kartLinjer($id:String!){stopPlace(id:$id){id estimatedCalls(timeRange:7200,numberOfDepartures:60){serviceJourney{line{id publicCode transportMode presentation{colour textColour}}}}}}';
  const Q_LINE = 'query kartLinje($id:ID!){line(id:$id){id publicCode transportMode presentation{colour textColour} journeyPatterns{directionType pointsOnLink{points}}}}';
  const Q_QUAY = 'query kartStopp($id:String!){quay(id:$id){id name estimatedCalls(numberOfDepartures:12){expectedArrivalTime serviceJourney{line{id}}}}}';
  const VF_FULL = 'vehicleId lastUpdated bearing delay occupancyStatus destinationName mode line{lineRef publicCode} location{latitude longitude} monitoredCall{stopPointRef}';
  const VF_MIN = 'vehicleId lastUpdated bearing destinationName line{lineRef publicCode} location{latitude longitude}';
  let vf = VF_FULL;
  const jp = (h, q, v) => (M.enturGQL ? M.enturGQL(h, q, v) : Promise.reject(new Error('Entur-hjelperen (47-ruter) mangler')));
  async function vehGQL(h, query) {
    const ac = typeof AbortController !== 'undefined' ? new AbortController() : null, to = ac && setTimeout(() => ac.abort(), 12000);
    try {
      const r = await fetch(VEH, { method: 'POST', headers: { 'Content-Type': 'application/json', 'ET-Client-Name': clientName(h) }, body: JSON.stringify({ query }), signal: ac ? ac.signal : undefined });
      if (!r.ok) { console.warn('[ki-map] vehicles: HTTP ' + r.status); throw new Error('HTTP ' + r.status); }
      const j = await r.json();
      if (!j || (j.errors && !j.data)) throw new Error((j && j.errors && j.errors[0] && j.errors[0].message) || 'Entur-feil');
      return j.data;
    } finally { if (to) clearTimeout(to); }
  }
  const decodePoly = (s) => {
    const out = []; let i = 0, la = 0, lo = 0;
    const next = () => { let b, sh = 0, r = 0; do { b = s.charCodeAt(i++) - 63; r |= (b & 31) << sh; sh += 5; } while (b >= 32 && i <= s.length); return r & 1 ? ~(r >> 1) : r >> 1; };
    while (i < s.length) { la += next(); lo += next(); out.push([la / 1e5, lo / 1e5]); }
    return out;
  };
  const ruterCfg = () => {
    const live = M.liveCards && M.liveCards.get('pop-ruter');
    if (live) for (const el of live) if (el._config) return el._config;
    try { return (M.store && M.store.eff && M.store.eff('cards.pop-ruter')) || {}; } catch (e) { return {}; }
  };
  // Linjene fra #ruter: stoppene (entur-sensorene, stop_id) + linjekodene i avgangene og reisene. c.lines overstyrer.
  M.kartTransitWanted = function (h, c) {
    const rc = ruterCfg(), A = M.ruterAuto ? M.ruterAuto(h, rc) : { stops: [] };
    const stops = [...new Set(A.stops.map((id) => (h.states[id].attributes || {}).stop_id).filter((x) => /^NSR:StopPlace:/.test(x || '')))];
    const own = Array.isArray(c.lines) ? c.lines.map(String).filter(Boolean) : [];
    const codes = new Set();
    if (own.length) own.forEach((x) => codes.add(x));
    else {
      A.stops.forEach((id) => (M.enturDepartures ? M.enturDepartures(h.states[id]) : []).forEach((d) => d.line && codes.add(String(d.line))));
      if (M.ruterTrips) { const T = M.ruterTrips(rc); ['school', 'home'].forEach((k) => ((T[k] || {}).alts || []).forEach((a) => a.enabled !== false && (a.legs || []).forEach((l) => (Array.isArray(l.lines) ? l.lines : []).forEach((x) => x && codes.add(String(x)))))); }
    }
    return { stops, codes: [...codes], own: own.length > 0 };
  };
  async function resolveLines(h, c) {
    const W = M.kartTransitWanted(h, c), key = JSON.stringify(W);
    if (TR.key === key && Date.now() - TR.linesT < 600000 && TR.lines.length) return TR.lines;
    const found = new Map();
    const refs = (c && c.line_refs && typeof c.line_refs === 'object') ? c.line_refs : {}; // lagret fra editoren: { '31': 'RUT:Line:31' }
    const direct = [...new Set([...W.codes.filter((x) => /:Line:/.test(x)), ...W.codes.map((x) => refs[x]).filter((x) => /:Line:/.test(x || ''))])];
    await Promise.all(W.stops.slice(0, 6).map((id) => jp(h, Q_LINES, { id }).then((d) => {
      ((d.stopPlace && d.stopPlace.estimatedCalls) || []).forEach((ec) => { const l = ec.serviceJourney && ec.serviceJourney.line; if (l && l.id && !found.has(l.id)) found.set(l.id, l); });
    }).catch(() => {})));
    let lines = [...found.values()].filter((l) => !W.codes.length || W.codes.includes(String(l.publicCode)) || W.codes.includes(l.id));
    direct.forEach((id) => { if (!lines.some((l) => l.id === id)) lines.push({ id, publicCode: id.split(':').pop(), transportMode: null }); });
    lines = lines.slice(0, 10).map((l) => ({ id: l.id, code: String(l.publicCode || ''), mode: String(l.transportMode || '').toLowerCase() || null, col: l.presentation && l.presentation.colour ? '#' + l.presentation.colour : null, tcol: l.presentation && l.presentation.textColour ? '#' + l.presentation.textColour : null }));
    TR.lines = lines; TR.key = key; TR.linesT = Date.now();
    return lines;
  }
  async function loadRoutes(h) {
    await Promise.all(TR.lines.filter((l) => !TR.routes[l.id]).map((l) => jp(h, Q_LINE, { id: l.id }).then((d) => {
      const L = d.line; if (!L) return;
      if (!l.col && L.presentation && L.presentation.colour) l.col = '#' + L.presentation.colour;
      if (!l.mode && L.transportMode) l.mode = String(L.transportMode).toLowerCase();
      const best = {};
      (L.journeyPatterns || []).forEach((p) => { const pts = p.pointsOnLink && p.pointsOnLink.points; if (!pts) return; const k = p.directionType || 'x'; if (!best[k] || pts.length > best[k].length) best[k] = pts; });
      TR.routes[l.id] = Object.values(best).slice(0, 2).map(decodePoly);
    }).catch(() => { TR.routes[l.id] = []; })));
  }
  async function loadVehicles(h) {
    if (!TR.lines.length) { TR.veh = []; return; }
    const cs = (id) => { const x = String(id).split(':')[0]; return /^[A-Z]{3}$/.test(x) ? `codespaceId:${JSON.stringify(x)},` : ''; }; // RUT:Line:31 → codespaceId "RUT"
    const q = (f) => '{' + TR.lines.map((l, i) => `v${i}:vehicles(${cs(l.id)}lineRef:${JSON.stringify(l.id)}){${f}}`).join(' ') + '}';
    let d;
    try { d = await vehGQL(h, q(vf)); } catch (e) { if (vf === VF_MIN) throw e; vf = VF_MIN; d = await vehGQL(h, q(vf)); } // eldre skjema: færre felt
    const out = [];
    TR.lines.forEach((l, i) => ((d && d['v' + i]) || []).forEach((v) => {
      const la = v.location && num(v.location.latitude), lo = v.location && num(v.location.longitude);
      if (la == null || lo == null) return;
      if (v.lastUpdated && Date.now() - new Date(v.lastUpdated).getTime() > 120000) return; // fiks 22.5: skjul eldre enn 2 min
      out.push({ id: 'v:' + (v.vehicleId || l.id + i + out.length), kind: 'v', line: l, code: (v.line && v.line.publicCode) || l.code, mode: String(v.mode || l.mode || 'bus').toLowerCase(), pos: [la, lo], dest: v.destinationName || '', bearing: num(v.bearing), delay: num(v.delay), occ: v.occupancyStatus || null, stop: v.monitoredCall && v.monitoredCall.stopPointRef, upd: v.lastUpdated });
    }));
    TR.veh = out;
    console.info('[ki-map] vehicles: ' + out.length);
  }
  M.kartTransitRefresh = async function (h, c, full) {
    if (TR.busy) return TR;
    TR.busy = true;
    try {
      if (full || !TR.lines.length) { await resolveLines(h, c); loadRoutes(h).then(() => M.kartTransitNotify(), () => {}); }
      await loadVehicles(h);
      TR.err = null;
    } catch (e) { TR.err = (e && e.message) || String(e); console.warn('[ki-map] vehicles: 0 (' + TR.err + ')'); } finally { TR.busy = false; TR.t = Date.now(); }
    M.kartTransitNotify();
    return TR;
  };
  M.kartTransitNotify = () => window.dispatchEvent(new CustomEvent('msh-kart-transit'));
  // Neste stopp (quay-navn) + forventet ankomst for kjøretøyets linje – hentes når detaljkortet åpnes
  async function quayInfo(h, v) {
    if (!v || !v.stop) return null;
    const k = v.stop, e = TR.quay[k];
    if (e && Date.now() - e.t < 30000) return e;
    const d = await jp(h, Q_QUAY, { id: k }).catch(() => null);
    const q = d && d.quay;
    const r = { t: Date.now(), name: q ? q.name : null, calls: q ? (q.estimatedCalls || []).map((x) => ({ t: new Date(x.expectedArrivalTime).getTime(), line: x.serviceJourney && x.serviceJourney.line && x.serviceJourney.line.id })) : [] };
    TR.quay[k] = r;
    return r;
  }

  /* ------------------------------------------------------------ markører (divIcon, bare inline-stil) */
  const PULSE_CSS = '<style>@keyframes mshKartPulse{0%{transform:scale(1);opacity:.7}100%{transform:scale(1.9);opacity:0}}</style>';
  const BAD = new Set(); // bilder som feilet → forbokstav
  const avatar = (p, sz) => (p.pic && !BAD.has(p.pic) ? `<img src="${esc(p.pic)}" alt="" draggable="false" style="width:100%;height:100%;object-fit:cover;display:block;border-radius:50%">` : `<span style="font:600 ${Math.round(sz * 0.36)}px/1 inherit;color:#fafafa">${esc((p.first || '?').slice(0, 1).toUpperCase())}</span>`);
  function personIcon(p, sel) {
    const sz = 52, ring = p.col;
    return `<div style="position:relative;width:${sz}px;display:flex;flex-direction:column;align-items:center;font-family:${M.FONT || 'inherit'}">
      ${p.moving ? `${PULSE_CSS}<span style="position:absolute;left:0;top:0;width:${sz}px;height:${sz}px;border-radius:50%;background:${ring};animation:mshKartPulse 1.6s ease-out infinite"></span>` : ''}
      <span style="position:relative;width:${sz}px;height:${sz}px;border-radius:50%;box-sizing:border-box;border:3px solid ${ring};background:var(--gray300,#404040);display:grid;place-items:center;overflow:hidden;box-shadow:0 4px 14px rgba(0,0,0,.45)${sel ? ',0 0 0 3px #fafafa' : ''}">${avatar(p, sz)}</span>
      <span style="margin-top:4px;padding:2px 8px;border-radius:10px;background:rgba(35,35,35,.88);color:#fafafa;font-size:12px;font-weight:600;white-space:nowrap">${esc(p.first)}</span></div>`;
  }
  const carIcon = (c, sel) => `<div style="width:34px;height:34px;border-radius:50%;background:#fafafa;color:#232323;display:grid;place-items:center;box-shadow:0 3px 10px rgba(0,0,0,.45)${sel ? ',0 0 0 3px ' + C.pink : ''}">${M.icon('mdi:car', 20)}</div>`;
  const zoneLabel = (z, sel) => `<div style="display:inline-flex;align-items:center;gap:4px;height:26px;padding:0 10px 0 6px;border-radius:13px;background:rgba(35,35,35,.88);color:#fafafa;font:500 12px/1 ${M.FONT || 'inherit'};white-space:nowrap;box-shadow:inset 0 0 0 1px ${sel ? '#fafafa' : 'rgba(255,255,255,.08)'};transform:translate(-50%,-50%)"><span style="color:${z.col};display:grid">${M.icon(z.icon, 16)}</span>${esc(z.name)}</div>`;
  const lineCol = (v) => (v.line && v.line.col) || MODE_COL[v.mode] || MODE_COL.bus;
  const vehIcon = (v, sel) => {
    const round = v.mode !== 'bus' && v.mode !== 'coach';
    return `<div style="min-width:28px;height:24px;padding:0 6px;box-sizing:border-box;border-radius:${round ? 12 : 5}px;background:${lineCol(v)};color:${(v.line && v.line.tcol) || '#fff'};display:grid;place-items:center;font:700 12px/1 ${M.FONT || 'inherit'};box-shadow:0 2px 8px rgba(0,0,0,.5)${sel ? ',0 0 0 2px #fafafa' : ''};position:relative">${v.bearing != null ? `<span data-bearing="${Math.round(v.bearing)}" style="position:absolute;left:50%;top:50%;width:0;height:0;transform:rotate(${Math.round(v.bearing)}deg);pointer-events:none"><span style="position:absolute;left:-5px;top:-24px;border:5px solid transparent;border-bottom:7px solid ${lineCol(v)}"></span></span>` : ''}${esc(v.code || '?')}</div>`;
  };

  /* ============================================================ kortet */
  class Kart extends M.Card {
    static get cardName() { return 'Kart'; }
    static get defaults() { return { ...DEF }; }
    static getStubConfig() { return { card_id: M.uid(), ...DEF }; }
    static get uiPersist() { return ['layers']; }
    static get schema() {
      return (h, c) => {
        c = c || {};
        const lineChips = (hh, cc, key) => {
          const W = hh ? M.kartTransitWanted(hh, { lines: [] }) : { codes: [] };
          const sel = new Set(Array.isArray(cc.lines) ? cc.lines.map(String) : []);
          const all = [...new Set([...W.codes, ...sel])];
          return `<div class="f"><label>Kollektiv-linjer (fra Ruter-kortet) · ingen valgt = alle</label><div class="chips">${all.length ? all.map((x) => `<button class="chip ${sel.has(x) ? 'on' : ''}" aria-pressed="${sel.has(x)}" data-a="fn" data-k="${key}" data-v="${esc(x)}">${esc(x)}</button>`).join('') : '<span class="small">Fant ingen linjer i Ruter-kortet</span>'}</div></div>`;
        };
        return [
          { type: 'section', id: 'innhold', label: 'Personer og biler', icon: 'mdi:account-group', open: true, fields: [
            { type: 'entities', name: 'persons', label: 'Personer · tomt = alle', domains: ['person'], domain: 'person', multiple: true },
            { type: 'entities', name: 'cars', label: 'Biler (device_tracker med GPS) · tomt = automatisk', domains: ['device_tracker'], domain: 'device_tracker', multiple: true, help: h ? 'Automatisk: ' + (M.kartCarsAuto(h).map((x) => M.name(h, x)).join(', ') || 'fant ingen') : '' },
          ] },
          { type: 'section', id: 'soner', label: 'Soner', icon: 'mdi:map-marker-radius', fields: [
            { type: 'boolean', label: 'Vis alle soner', get: (hh, cc) => !Array.isArray(cc.zones), set: (v, hh, cc, ed) => ed._set('zones', v ? undefined : M.all(hh, 'zone')) },
            ...(Array.isArray(c.zones) ? [{ type: 'entities', name: 'zones', label: 'Valgte soner', domains: ['zone'], domain: 'zone', multiple: true }] : []),
          ] },
          { type: 'section', id: 'kollektiv', label: 'Kollektiv', icon: 'mdi:bus-clock', fields: [
            { type: 'boolean', name: 'transit', label: 'Vis busser og trikker i sanntid (Entur)', default: true },
            { type: 'html', html: lineChips, click: (d, ed) => { const s = new Set(Array.isArray(ed._config.lines) ? ed._config.lines.map(String) : []); if (s.has(d.v)) s.delete(d.v); else s.add(d.v); M.haptic('selection'); ed._set('lines', s.size ? [...s] : undefined);
              // fiks 22.5: slå opp lineRef (line.id) via Journey Planner og lagre sammen med linjenummeret – aldri bygget av tekst
              if (s.size && ed.hass) resolveLines(ed.hass, { lines: [] }).then((all) => { const refs = {}; [...s].forEach((x) => { const l = /:Line:/.test(x) ? null : all.find((y) => y.code === x); if (l) refs[x] = l.id; }); if (ed._config && Object.keys(refs).length) ed._set('line_refs', refs); }).catch(() => {});
              else if (!s.size) ed._set('line_refs', undefined); } },
          ] },
          { type: 'section', id: 'visning', label: 'Visning', icon: 'mdi:map-outline', fields: [
            { type: 'select', name: 'start', label: 'Startvisning', options: [['fit', 'Vis alle'], ['home', 'Hjem'], ['me', 'Meg']], default: 'fit' },
            { type: 'select', name: 'style', label: 'Kartstil', options: [['dark', 'Mørk'], ['light', 'Lys'], ['satellite', 'Satellitt']], default: 'dark' },
            { type: 'text', name: 'tile_url', label: 'Egen flis-URL (valgfritt, overstyrer stilen)', placeholder: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' },
          ] },
        ];
      };
    }
    get cardSize() { return 12; }
    constructor() {
      super();
      this._mk = new Map(); // nøkkel → { m, html, pos }
      this._key = (e) => { if (e.key === 'Escape' && this.isOpen && location.hash === HASH && !document.querySelector('.msh-overlay-root, ki-overlay-root')) { M.closePopup(); } };
      this._tr = () => { if (this.isOpen) this.update(); };
      this._rs = () => { this._fitHeight(); clearTimeout(this._rsT); this._rsT = setTimeout(() => this._fitHeight(), 350); };
      // 23.3: navbaren melder ledig flate ('ki-nav-rect') → padding til fitBounds/flyTo og ny måling av headeren
      this._nr = (e) => { if (e && e.detail) this._occ = { ...e.detail }; if (this.isOpen) this._fitHeight(); };
      // 23.3: Leaflet startes først når popupen er synlig (hashchange + IntersectionObserver), invalidateSize etter animasjonen
      this._hc = () => { if (location.hash !== HASH) return; setTimeout(() => this._maybeInit(), 60); clearTimeout(this._inv); this._inv = setTimeout(() => { this._fitHeight(); this._maybeInit(); }, 350); };
      // 22.7: «Vis på kart» fra headeren (M.kartFocus → event + M.kartFocusReq) → velg og fly til personen
      this._fc = (e) => { const id = e && e.detail && e.detail.entity_id; if (id) { this._focusId = id; this._focus(); } };
      this.shadowRoot.addEventListener('error', (e) => { const t = e.target; if (t && t.tagName === 'IMG' && t.getAttribute('src') && !BAD.has(t.getAttribute('src'))) { BAD.add(t.getAttribute('src')); this.update(); } }, true);
    }
    connectedCallback() {
      super.connectedCallback();
      window.addEventListener('keydown', this._key);
      window.addEventListener('msh-kart-transit', this._tr);
      window.addEventListener('resize', this._rs);
      window.addEventListener('msh-kart-focus', this._fc);
      window.addEventListener('ki-nav-rect', this._nr);
      window.addEventListener('hashchange', this._hc);
      if (typeof IntersectionObserver !== 'undefined') {
        if (!this._io) this._io = new IntersectionObserver((es) => { if (es.some((x) => x.isIntersecting)) { this._fitHeight(); this._maybeInit(); } });
        this._io.observe(this);
      }
    }
    disconnectedCallback() {
      super.disconnectedCallback();
      if (this._ro) this._ro.disconnect();
      if (this._io) this._io.disconnect();
      window.removeEventListener('ki-nav-rect', this._nr);
      window.removeEventListener('hashchange', this._hc);
      window.removeEventListener('keydown', this._key);
      window.removeEventListener('msh-kart-transit', this._tr);
      window.removeEventListener('resize', this._rs);
      window.removeEventListener('msh-kart-focus', this._fc);
    }
    // Fullskjerm: ingen mellomrom fra popupen (kartet går kant til kant), høyden i px fra dashbord-containeren (23.3)
    _applySpacing() { this.style.paddingBottom = '0px'; this.style.marginTop = ''; this._fitHeight(); }
    _popEl() {
      let n = this;
      for (let i = 0; n && i < 60; i++) { if (n.classList && n.classList.contains('bubble-pop-up')) return n; n = n.parentNode || n.host; }
      return null;
    }
    _fitHeight() {
      const pop = this._popEl();
      // Dashbord-containeren (ikke vinduet): toppen = der popupen starter, høyden = resten ned til bunnen
      const D = M.rectOf && M.dashEl ? M.rectOf(M.dashEl(this)) : null;
      const top = D ? Math.max(0, Math.round(D.top)) : 0;
      const hgt = D && D.height > 200 ? D.height : pop && pop.clientHeight > 200 ? pop.clientHeight : window.innerHeight;
      this.style.setProperty('--kart-h', Math.round(hgt) + 'px');
      this.toggleAttribute('data-pop', !!pop);
      if (pop && pop.style.getPropertyValue('--ki-kart-top') !== top + 'px') pop.style.setProperty('--ki-kart-top', top + 'px');
      this._measureNav();
      this._measureHead(pop);
      if (this._map && this._map.invalidateSize) { try { this._map.invalidateSize(); } catch (e) { /* */ } }
    }
    // 23.3: Bubble-headeren ligger over kartet → chipsene rett under den, tannhjulet ved siden av ×
    _measureHead(pop) {
      const hd = pop && pop.querySelector(':scope > .bubble-header-container');
      const hr = hd && hd.getBoundingClientRect(), box = this.getBoundingClientRect();
      const vis = !!hr && hr.height > 0 && getComputedStyle(hd).display !== 'none';
      this.toggleAttribute('data-bh', vis);
      if (!vis || !box.height) { ['--kart-hd', '--kart-act-top', '--kart-act-right'].forEach((k) => this.style.removeProperty(k)); return; }
      this.style.setProperty('--kart-hd', Math.round(hr.bottom - box.top) + 'px');
      const x = hd.querySelector('.bubble-close-button, .close-pop-up');
      const xr = x && x.getBoundingClientRect();
      if (xr && xr.width) {
        const cog = this.shadowRoot.querySelector('.acts .cog'), ch = cog ? cog.getBoundingClientRect().height || 44 : 44;
        this.style.setProperty('--kart-act-top', Math.round(xr.top - box.top + (xr.height - ch) / 2) + 'px');
        this.style.setProperty('--kart-act-right', Math.round(box.right - xr.left + 8) + 'px');
      }
    }
    // Fiks 23.3: navbaren måler seg selv (10-navbar.js → --ki-nav-occ-* på dashbord-containeren + 'ki-nav-rect'). Kortet leser
    //   MSH.navOcc() / eventet (omregnet fra dashbord-containeren til kortets flate); egen måling (fiks 22.1) brukes bare som
    //   reserve når navbaren ikke melder noe. Resultatet skrives som --kart-occ-* på kortet og --ki-kart-occ-* på popupen.
    _navEl() {
      const np = document.querySelector('.msh-navbar-portal');
      const n = (np && np.shadowRoot && np.shadowRoot.querySelector('[data-nav]')) || document.querySelector('msh-navbar-card');
      return n && n.getBoundingClientRect && n.getBoundingClientRect().width > 0 ? n : null;
    }
    _measureNav() {
      const K = ['top', 'right', 'bottom', 'left'], box = this.getBoundingClientRect();
      const occ = M.navOcc ? M.navOcc() : this._occ || null;
      const any = (o) => !!o && K.some((k) => Number(o[k]) > 0);
      let N = { top: 0, right: 0, bottom: 0, left: 0 };
      if (occ && (any(occ) || !this._navEl())) {
        // navbarens tall gjelder dashbord-containeren → omregnet til kortets flate (på PC starter popupen til høyre for railen)
        const D = M.rectOf && M.dashEl ? M.rectOf(M.dashEl(this)) : null, o = (k) => Math.max(0, Number(occ[k]) || 0);
        if (D && box.width > 0) {
          const Dr = D.left + D.width, Db = D.top + D.height;
          N = { top: o('top') ? D.top + o('top') - box.top : 0, left: o('left') ? D.left + o('left') - box.left : 0, right: o('right') ? box.right - (Dr - o('right')) : 0, bottom: o('bottom') ? box.bottom - (Db - o('bottom')) : 0 };
        } else N = { top: o('top'), right: o('right'), bottom: o('bottom'), left: o('left') };
        this._navSrc = 'navbar';
      } else {
        const n = this._navEl();
        if (n && box.width > 0) {
          const r = n.getBoundingClientRect(), cs = getComputedStyle(n);
          const vis = cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.05;
          const ox = Math.min(r.right, box.right) - Math.max(r.left, box.left), oy = Math.min(r.bottom, box.bottom) - Math.max(r.top, box.top);
          if (vis && ox > 0 && oy > 0) {
            if (r.width >= r.height) { if (r.top + r.height / 2 > box.top + box.height / 2) N.bottom = box.bottom - r.top + 8; else N.top = r.bottom - box.top + 8; }
            else if (r.left + r.width / 2 < box.left + box.width / 2) N.left = r.right - box.left + 8; else N.right = box.right - r.left + 8;
          }
        }
        this._navSrc = 'reserve';
      }
      // --kart-occ-* på kortet (CSS faller tilbake til de arvede --ki-nav-occ-*), --ki-kart-occ-* på popupen (Bubble-headeren)
      const pop = this._popEl();
      K.forEach((k) => {
        N[k] = Math.max(0, Math.round(N[k] || 0));
        const v = N[k] + 'px';
        if (this.style.getPropertyValue('--kart-occ-' + k) !== v) this.style.setProperty('--kart-occ-' + k, v);
        if (pop && pop.style.getPropertyValue('--ki-kart-occ-' + k) !== v) pop.style.setProperty('--ki-kart-occ-' + k, v);
      });
      this._nav = N;
      return N;
    }
    _watch() {
      if (typeof ResizeObserver === 'undefined') return;
      if (!this._ro) this._ro = new ResizeObserver(() => { if (this.isOpen) this._fitHeight(); });
      this._ro.disconnect();
      this._ro.observe(this);
      const n = this._navEl(); if (n) this._ro.observe(n);
      const mb = this.shadowRoot.querySelector('.map'); if (mb) this._ro.observe(mb);
    }
    // Leaflet-marginer = ledig flate (navbar + header/chips + detaljkort), så valgt markør aldri havner bak navbar/detaljkort
    _pad() {
      const N = this._nav || this._measureNav(), det = this.shadowRoot.querySelector('.det');
      const dh = det ? det.getBoundingClientRect().height : 0, row = this.shadowRoot.querySelector('.row');
      const rh = row ? row.getBoundingClientRect().height + 8 : 0;
      const tp = this.shadowRoot.querySelector('.top'), box = this.getBoundingClientRect();
      const tb = tp && box.height ? Math.round(tp.getBoundingClientRect().bottom - box.top) : 0;
      return { paddingTopLeft: [N.left + 16, Math.max(N.top + 120, tb + 16)], paddingBottomRight: [N.right + 16 + 64, N.bottom + Math.max(dh, rh) + 16] };
    }
    _flyTo(pos, z) {
      const map = this._map, L = this._L;
      if (!map) return;
      const P = this._pad();
      if (L && L.latLngBounds && map.flyToBounds) { map.flyToBounds(L.latLngBounds([pos, pos]), { ...P, maxZoom: z, duration: 0.8 }); return; }
      map.flyTo(pos, z, { duration: 0.8 });
    }
    get layers() { const L = this.ui.layers || {}; return { persons: L.persons !== false, cars: L.cars !== false, zones: L.zones !== false, transit: L.transit !== false }; }
    onOpen() {
      this._fitHeight();
      this.update();
      this._watch();
      this._focus();
      clearTimeout(this._inv); this._inv = setTimeout(() => { this._fitHeight(); this._maybeInit(); }, 350); // etter Bubble sin åpne-animasjon (22.2/23.3)
      if (this.config.transit !== false) {
        M.kartTransitRefresh(this.hass, this.config, true);
        clearInterval(this._poll);
        this._poll = setInterval(() => { if (this.isOpen && location.hash === HASH && this.layers.transit) M.kartTransitRefresh(this.hass, this.config); }, 15000);
      }
    }
    _focus() {
      const R = M.kartFocusReq;
      if (!this._focusId && R && R.entity_id && Date.now() - (R.t || 0) < 5000) this._focusId = R.entity_id;
      if (!this._focusId || !this._map || !this._D) return; // kartet lages ved åpning; kalles igjen fra _initMap
      const id = this._focusId, x = [...this._D.P, ...this._D.K].find((y) => y.id === id);
      this._focusId = null; M.kartFocusReq = null;
      if (x && x.pos) { this.setUI({ sel: { k: x.kind, id } }); clearTimeout(this._fcT); this._fcT = setTimeout(() => this._flyTo(x.pos, 15), 380); }
    }
    onClose() { clearInterval(this._poll); this._poll = 0; clearTimeout(this._inv); if (this.ui.sel) this._ui = { ...this._ui, sel: null }; }
    _data() {
      const h = this.hass, c = this.config;
      const P = M.kartPersons(h, c), K = M.kartCars(h, c), Z = M.kartZones(h, c), V = c.transit !== false ? TR.veh : [];
      [...P.map((x) => x.id), ...K.map((x) => x.id), ...Z.map((x) => x.id)].forEach((id) => this.s(id));
      K.forEach((k) => devIds(h, k.id).forEach((x) => this.s(x)));
      return { P, K, Z, V };
    }
    _find(D, sel) { if (!sel) return null; const L = sel.k === 'p' ? D.P : sel.k === 'c' ? D.K : sel.k === 'z' ? D.Z : D.V; return L.find((x) => x.id === sel.id) || null; }
    render() {
      const h = this.hass, c = this.config, D = this._data(), Ly = this.layers;
      this._D = D;
      const home = D.P.filter((p) => p.st.kind === 'home').length, away = D.P.length - home;
      const hp = homePos(h), near = hp ? D.V.filter((v) => dist(v.pos, hp) < 5000).length : D.V.length;
      const sum = [`${home} hjemme`, `${away} borte`, ...(c.transit !== false ? [`${near} kollektiv i nærheten`] : [])].join(' · ');
      const counts = { persons: D.P.filter((p) => p.pos).length, cars: D.K.filter((k) => k.pos).length, zones: D.Z.length, transit: D.V.length };
      const chips = LAYERS.filter(([k]) => k !== 'transit' || c.transit !== false).map(([k, l, ic]) => `<button class="chip ${Ly[k] ? 'on' : ''}" data-act="layer" data-v="${k}" aria-pressed="${Ly[k]}" data-key="ly-${k}">${M.icon(ic, 16)}${esc(l)}${k === 'transit' && !counts[k] && TR.t && Ly.transit ? '<b>Ingen kjøretøy i sanntid nå</b>' : `<b>${counts[k]}</b>`}</button>`).join('');
      const sel = this.ui.sel, cur = this._find(D, sel);
      const pill = (x) => {
        const on = cur && cur.id === x.id;
        if (x.kind === 'p') {
          const sub = x.moving ? `${x.kmh != null && x.kmh > 0 ? 'Kjører · ' + x.kmh + ' km/t' : 'I bevegelse'}` : `${esc(x.st.label || x.st.place || '–')}${x.since ? ' · siden ' + hm(x.since) : ''}`;
          return `<button class="pl ${on ? 'on' : ''}" data-act="sel" data-k="p" data-id="${esc(x.id)}" data-key="pl-${esc(x.id)}"><span class="pa" style="box-shadow:0 0 0 2px ${x.col}">${avatar(x, 40)}</span><span class="pt"><b>${esc(x.name)}</b><i><span style="color:${x.col}">●</span> ${sub}</i></span></button>`;
        }
        const sub = [x.moving ? `Kjører${x.kmh != null ? ' · ' + Math.round(x.kmh) + ' km/t' : ''}` : 'Parkert', x.bat != null ? Math.round(x.bat) + ' %' : null].filter(Boolean).join(' · ');
        return `<button class="pl ${on ? 'on' : ''}" data-act="sel" data-k="c" data-id="${esc(x.id)}" data-key="pl-${esc(x.id)}"><span class="pa car">${x.pic && !BAD.has(x.pic) ? `<img src="${esc(x.pic)}" alt="" draggable="false">` : M.icon('mdi:car', 22)}</span><span class="pt"><b>${esc(x.name)}</b><i>${esc(sub)}</i></span></button>`;
      };
      const row = [...D.P, ...D.K].map(pill).join('');
      const err = this._leafErr ? `<div class="err" data-key="err">${M.icon('mdi:map-marker-off', 22)}<span>${esc(this._leafErr)}</span></div>` : '';
      return `<div class="kart" data-key="kart">
        <div class="map" id="map" data-nomorph data-key="map"></div>${err}
        <div class="grad" data-key="grad"></div>
        <div class="acts" data-key="acts">
          <button class="rb cog" data-act="customize" title="Tilpass kart">${M.icon('mdi:cog', 22)}</button>
          <button class="rb x" data-act="close" title="Lukk" aria-label="Lukk">${M.icon('mdi:close', 24)}</button>
        </div>
        <div class="top" data-key="top">
          <div class="chips noscroll" data-key="chips">${chips}</div>
          <div class="sm" data-key="sum">${esc(sum)}</div>
        </div>
        <div class="side" data-key="side">
          <button class="sb" data-act="zin" title="Zoom inn">${M.icon('mdi:plus', 24)}</button>
          <button class="sb" data-act="zout" title="Zoom ut">${M.icon('mdi:minus', 24)}</button>
          <button class="sb" data-act="fit" title="Vis alle">${M.icon('mdi:fit-to-screen-outline', 22)}</button>
          <button class="sb" data-act="home" title="Hjem">${M.icon('mdi:home', 22)}</button>
        </div>
        <div class="bot" data-key="bot">
          ${cur ? this._detail(cur) : ''}
          ${row ? `<div class="row noscroll" data-key="row">${row}</div>` : ''}
          <div class="att" data-key="att">${esc(tileDef(c)[1])}</div>
        </div>
      </div>`;
    }
    _detail(x) {
      const h = this.hass, st = (l, v) => `<div class="kv"><span>${esc(l)}</span><b>${v == null || v === '' ? '–' : esc(v)}</b></div>`;
      let head = '', body = '', acts = '';
      if (x.kind === 'p') {
        head = `<span class="da" style="box-shadow:0 0 0 2px ${x.col}">${avatar(x, 44)}</span><div class="dt"><b>${esc(x.name)}</b><i><span style="color:${x.col}">●</span> ${esc(x.moving ? 'I bevegelse' : x.st.label || x.st.place || '–')}${x.since ? ' · siden ' + hm(x.since) : ''}</i></div>`;
        body = st('Batteri', x.bat != null ? Math.round(x.bat) + ' %' : null) + st('Fart', x.kmh != null ? x.kmh + ' km/t' : null) + st('Nøyaktighet', x.acc != null ? '± ' + Math.round(x.acc) + ' m' : null) + st('Oppdatert', x.upd ? M.relTime(x.upd) : null);
        if (x.pos) acts = `<button class="db" data-act="route" data-id="${esc(x.id)}">${M.icon('mdi:directions', 20)}Veibeskrivelse</button>`;
      } else if (x.kind === 'c') {
        head = `<span class="da car">${M.icon('mdi:car', 24)}</span><div class="dt"><b>${esc(x.name)}</b><i>${esc(x.moving ? 'Kjører' + (x.kmh != null ? ' · ' + Math.round(x.kmh) + ' km/t' : '') : 'Parkert')}</i></div>`;
        body = st('Batteri', x.bat != null ? Math.round(x.bat) + ' %' : null) + st('Rekkevidde', x.range != null ? Math.round(x.range) + ' ' + x.rangeU : null) + st('Låst', x.locked == null ? null : x.locked ? 'Ja' : 'Nei') + (x.eta ? st('Hjemme', x.eta) : '');
        if (x.pos) acts = `<button class="db" data-act="route" data-id="${esc(x.id)}">${M.icon('mdi:directions', 20)}Veibeskrivelse</button>`;
      } else if (x.kind === 'z') {
        const who = (this._D ? this._D.P : []).filter((p) => p.st.zone === x.id || (x.id === 'zone.home' && p.st.kind === 'home'));
        head = `<span class="da" style="background:${M.alpha(x.col, 0.25)};color:${x.col}">${M.icon(x.icon, 24)}</span><div class="dt"><b>${esc(x.name)}</b><i>Sone · ${Math.round(x.r)} m</i></div>`;
        body = `<div class="who">${who.length ? who.map((p) => `<span class="wp"><span class="wa" style="box-shadow:0 0 0 2px ${p.col}">${avatar(p, 28)}</span>${esc(p.first)}</span>`).join('') : '<span class="dim">Ingen er her nå</span>'}</div>`;
      } else {
        const q = this._qi && this._qi.stop === x.stop ? this._qi.r : null;
        const call = q && q.calls.find((k) => k.line === (x.line && x.line.id) && k.t > Date.now() - 60000);
        head = `<span class="da">${vehIcon(x)}</span><div class="dt"><b>${esc((MODE_L[x.mode] || 'Linje') + ' ' + (x.code || ''))}</b><i>mot ${esc(x.dest || '–')}</i></div>`;
        body = st('Neste stopp', q && q.name ? q.name : x.stop ? '…' : null) + st('Tid', call ? hm(call.t) : null) + st('Belegg', x.occ ? OCC[x.occ] || x.occ : null) + st('Forsinkelse', x.delay != null ? (Math.abs(x.delay) < 60 ? 'I rute' : Math.round(x.delay / 60) + ' min') : null);
        acts = `<button class="db" data-act="ruter">${M.icon('mdi:bus-clock', 20)}Åpne Ruter</button>`;
        if (x.stop && (!this._qi || this._qi.stop !== x.stop)) { this._qi = { stop: x.stop, r: null }; quayInfo(h, x).then((r) => { if (this._qi && this._qi.stop === x.stop) { this._qi.r = r; this.update(); } }); }
      }
      return `<div class="det" data-key="det-${esc(x.id)}"><div class="dh">${head}<button class="rb sm" data-act="unsel" title="Lukk">${M.icon('mdi:close', 20)}</button></div><div class="dg">${body}</div>${acts}</div>`;
    }
    onAction(name, el, ev) {
      const d = el.dataset;
      if (name === 'close') { this._select(null); return M.closePopup(); }
      if (name === 'layer') { const L = { ...(this.ui.layers || {}) }; L[d.v] = !this.layers[d.v]; this.setUI({ layers: L }); if (d.v === 'transit' && L.transit && this.config.transit !== false) M.kartTransitRefresh(this.hass, this.config); return; }
      if (name === 'sel') return this._select({ k: d.k, id: d.id }, true);
      if (name === 'unsel') return this._select(null);
      if (name === 'zin') return this._map && this._map.zoomIn();
      if (name === 'zout') return this._map && this._map.zoomOut();
      if (name === 'fit') return this._fitAll(true);
      if (name === 'home') { const hp = homePos(this.hass); if (hp && this._map) this._flyTo(hp, 15); return; }
      if (name === 'route') return this._route(d.id);
      if (name === 'ruter') { this._select(null); return M.openPopup('#ruter'); }
      return super.onAction(name, el, ev);
    }
    _select(sel, fly) {
      const same = sel && this.ui.sel && this.ui.sel.k === sel.k && this.ui.sel.id === sel.id;
      const nxt = same ? null : sel;
      this.setUI({ sel: nxt });
      if (nxt && fly && this._map && this._D) { const x = this._find(this._D, nxt); if (x && x.pos) requestAnimationFrame(() => this._flyTo(x.pos, Math.max(this._map.getZoom ? this._map.getZoom() : 14, x.kind === 'z' ? 14 : 15))); } // rAF: detaljkortet er tegnet og målt
    }
    _route(id) {
      const x = this._D && [...this._D.P, ...this._D.K].find((y) => y.id === id);
      if (!x || !x.pos) return;
      const [la, lo] = x.pos, ua = navigator.userAgent || '';
      const url = /iPhone|iPad|iPod|Macintosh/.test(ua) && 'ontouchend' in document ? `https://maps.apple.com/?daddr=${la},${lo}` : /Android/.test(ua) ? `geo:${la},${lo}?q=${la},${lo}(${encodeURIComponent(x.name)})` : `https://www.google.com/maps/dir/?api=1&destination=${la},${lo}`;
      window.open(url, '_blank');
    }
    _fitAll(anim) {
      const L = this._L, map = this._map, D = this._D;
      if (!L || !map || !D) return;
      const pts = [...D.P, ...D.K].map((x) => x.pos).filter(Boolean);
      const hp = homePos(this.hass); if (hp) pts.push(hp);
      if (!pts.length) return false;
      if (pts.length === 1) { if (anim) this._flyTo(pts[0], 14); else map.setView(pts[0], 14); return true; }
      const b = L.latLngBounds(pts), opt = { ...this._pad(), maxZoom: 15 };
      if (anim && map.flyToBounds) map.flyToBounds(b, { ...opt, duration: 0.8 }); else map.fitBounds(b, opt);
      return true;
    }
    _startView() {
      const c = this.config, h = this.hass, D = this._D;
      if (c.start === 'home') { const hp = homePos(h); if (hp) return this._map.setView(hp, 15); }
      if (c.start === 'me') { const me = D && D.P.find((p) => p.user && h.user && p.user === h.user.id && p.pos); if (me) return this._map.setView(me.pos, 15); }
      if (!this._fitAll(false)) this._map.setView(homePos(h) || [59.91, 10.75], 12);
    }
    /* ---------------------------------------------------------- kart-motor */
    // 23.3: Leaflet startes først når popupen er åpen og kartflaten har størrelse (ellers blir getSize() 0 og gestene døde)
    _maybeInit() {
      if (this._init || !this.isOpen || location.hash !== HASH || !this.isConnected) return;
      const box = this.shadowRoot.querySelector('.map'), r = box && box.getBoundingClientRect();
      if (!r || r.width < 2 || r.height < 2) return;
      this._initMap();
    }
    async _initMap() {
      if (this._init) return;
      this._init = true;
      const box = this.shadowRoot.querySelector('.map');
      if (!box) { this._init = false; return; }
      if (!box.__mshGuard) this._guard(box);
      const c = this.config;
      try {
        if (customElements.get('ha-map') && c.engine !== 'leaflet') {
          const hm2 = document.createElement('ha-map');
          hm2.style.cssText = 'display:block;width:100%;height:100%';
          hm2.hass = this.hass; hm2.darkMode = styleOf(c) !== 'light'; hm2.themeMode = styleOf(c) === 'light' ? 'light' : 'dark'; hm2.zoom = 13; hm2.interactiveZones = false; hm2.autoFit = false;
          box.appendChild(hm2);
          for (let i = 0; i < 100 && !(hm2.leafletMap && hm2.Leaflet); i++) await new Promise((r) => setTimeout(r, 50));
          if (hm2.leafletMap && hm2.Leaflet) {
            this._haMap = hm2; this._L = hm2.Leaflet; this._map = hm2.leafletMap;
            // ha-map kan ha slått av dra/knip på touch – slå på alt kartet trenger (23.3)
            ['dragging', 'touchZoom', 'doubleClickZoom', 'scrollWheelZoom'].forEach((k) => { const hd = this._map[k]; if (hd && hd.enable) try { hd.enable(); } catch (e) { /* */ } });
            if (this._map.tap && this._map.tap.disable) try { this._map.tap.disable(); } catch (e) { /* */ }
            hm2.style.touchAction = 'none';
          }
          else hm2.remove();
        }
        if (!this._map) {
          const L = await M.leafletLoad();
          box.innerHTML = `<link rel="stylesheet" href="${LEAF_CSS}"><div class="lf"></div>`; // full leaflet.css i tillegg til LEAF_BASE i <style>
          const el = box.querySelector('.lf');
          this._L = L;
          this._map = L.map(el, { zoomControl: false, attributionControl: false, zoomSnap: 0.5, dragging: true, touchZoom: true, scrollWheelZoom: true, doubleClickZoom: true, tap: false });
          this._map.setView(homePos(this.hass) || [59.91, 10.75], 13);
        }
      } catch (e) {
        this._init = false; this._leafErr = 'Kartet kunne ikke lastes (' + ((e && e.message) || e) + ')'; this.update(); return;
      }
      this._leafErr = null;
      const L = this._L, map = this._map;
      this._tiles = null;
      this._setStyle();
      this._g = { zones: L.layerGroup().addTo(map), transit: L.layerGroup().addTo(map), routes: L.layerGroup().addTo(map), cars: L.layerGroup().addTo(map), persons: L.layerGroup().addTo(map) };
      map.on('click', () => { if (this.ui.sel) { M.haptic('light'); this._select(null); } });
      this._fitHeight();
      this._sync();
      this._startView();
      this.update();
      this._focus();
    }
    _setStyle() {
      const L = this._L, map = this._map, st = styleOf(this.config), T = tileDef(this.config), key = st + '|' + T[0];
      if (!L || !map || this._styleNow === key) return;
      this._styleNow = key;
      if (this._tiles) { map.removeLayer(this._tiles); this._tiles = null; }
      if (this._haMap) { // ha-map har CARTO selv; bare satellitt / egen URL legges oppå
        this._haMap.darkMode = st !== 'light'; this._haMap.themeMode = st === 'light' ? 'light' : 'dark';
        if (st === 'satellite' || st === 'custom') this._tiles = L.tileLayer(T[0], { maxZoom: 20, subdomains: 'abcd', attribution: T[1] }).addTo(map);
        return;
      }
      this._tiles = L.tileLayer(T[0], { maxZoom: 20, subdomains: 'abcd', attribution: T[1], className: 'msh-tiles msh-' + st }).addTo(map);
    }
    // Lag: legg til / flytt / fjern markører etter data og filter (diff på nøkkel, setIcon bare når HTML endres)
    _sync() {
      const L = this._L, map = this._map, D = this._D;
      if (!L || !map || !D || !this._g) return;
      const Ly = this.layers, sel = this.ui.sel, seen = new Set();
      Object.keys(this._g).forEach((k) => { const on = k === 'routes' ? Ly.transit : Ly[k]; const has = map.hasLayer(this._g[k]); if (on && !has) this._g[k].addTo(map); else if (!on && has) map.removeLayer(this._g[k]); });
      const isSel = (x) => !!sel && sel.id === x.id;
      const put = (key, grp, pos, html, size, anchor, z, onClick) => {
        seen.add(key);
        let e = this._mk.get(key);
        if (!e) {
          const m = L.marker(pos, { icon: L.divIcon({ html, className: 'msh-mk', iconSize: size, iconAnchor: anchor }), zIndexOffset: z || 0, keyboard: false });
          m.on('click', (ev) => { if (ev && ev.originalEvent) ev.originalEvent.stopPropagation(); if (L.DomEvent && ev) L.DomEvent.stopPropagation(ev); M.haptic('light'); onClick(); });
          m.addTo(this._g[grp]);
          e = { m, html, pos, grp, click: onClick };
          this._mk.set(key, e);
        } else {
          e.click = onClick;
          if (e.pos[0] !== pos[0] || e.pos[1] !== pos[1]) { e.m.setLatLng(pos); e.pos = pos; }
          if (e.html !== html) { e.m.setIcon(L.divIcon({ html, className: 'msh-mk', iconSize: size, iconAnchor: anchor })); e.html = html; }
        }
      };
      // soner: sirkel + etikett
      D.Z.forEach((z) => {
        const k = 'zc:' + z.id;
        seen.add(k);
        let e = this._mk.get(k);
        const col = M.resolveColor ? M.resolveColor(z.col) : z.col;
        if (!e) { const m = L.circle(z.pos, { radius: z.r, color: col, weight: 1.5, opacity: 0.8, fillColor: col, fillOpacity: 0.12, dashArray: z.r > 500 ? '6 6' : null, interactive: false }).addTo(this._g.zones); e = { m, pos: z.pos, r: z.r, grp: 'zones' }; this._mk.set(k, e); }
        else if (e.r !== z.r || e.pos[0] !== z.pos[0] || e.pos[1] !== z.pos[1]) { e.m.setLatLng(z.pos); e.m.setRadius(z.r); e.r = z.r; e.pos = z.pos; }
        put('zl:' + z.id, 'zones', z.pos, zoneLabel(z, isSel(z)), [0, 0], [0, 0], -200, () => this._select({ k: 'z', id: z.id }, true));
      });
      D.P.forEach((p) => { if (p.pos) put('p:' + p.id, 'persons', p.pos, personIcon(p, isSel(p)), [52, 74], [26, 26], 1000, () => this._select({ k: 'p', id: p.id }, true)); });
      D.K.forEach((c) => {
        if (!c.pos) return;
        const near = D.P.some((p) => p.pos && dist(p.pos, c.pos) < 40);
        put('c:' + c.id, 'cars', c.pos, carIcon(c, isSel(c)), [34, 34], near ? [-14, 44] : [17, 17], 500, () => this._select({ k: 'c', id: c.id }, true));
      });
      D.V.forEach((v) => put(v.id, 'transit', v.pos, vehIcon(v, isSel(v)), [28, 24], [14, 12], 300, () => this._select({ k: 'v', id: v.id }, true)));
      // rutelinjer (tynn strek i linjefargen)
      TR.lines.forEach((l) => (TR.routes[l.id] || []).forEach((pts, i) => {
        const k = 'r:' + l.id + ':' + i;
        seen.add(k);
        if (!this._mk.has(k) && pts.length > 1) { const col = l.col || MODE_COL[l.mode] || MODE_COL.bus; this._mk.set(k, { m: L.polyline(pts, { color: col, weight: 2.5, opacity: 0.55, interactive: false }).addTo(this._g.routes), grp: 'routes' }); }
      }));
      for (const [k, e] of this._mk) if (!seen.has(k)) { try { this._g[e.grp].removeLayer(e.m); } catch (er) { /* */ } this._mk.delete(k); }
    }
    afterRender() {
      if (this.isOpen && !this._init) this._maybeInit();
      else if (this._map) { this._setStyle(); this._sync(); }
      const box = this.shadowRoot.querySelector('.kart');
      if (box && !box.__b) {
        box.__b = true;
        // kartflaten, detaljkort, topp og knapper: dra her skal ikke lukke eller scrolle popupen (23.3)
        ['.map', '.bot', '.top', '.side', '.acts'].forEach((s) => { const el = box.querySelector(s); if (el && !el.__mshGuard) this._guard(el); });
      }
    }
    _guard(el) {
      const stop = (e) => e.stopPropagation();
      ['pointerdown', 'touchstart', 'touchmove', 'wheel', 'mousedown'].forEach((t) => el.addEventListener(t, stop, { passive: true }));
      el.__mshGuard = true;
    }
    get styles() {
      return `
        :host{display:block;width:100%;height:var(--kart-h,100vh);position:relative}
        :host([data-pop]){position:absolute;left:0;right:0;top:0;bottom:0;inset:0;width:auto;height:var(--kart-h,100%)} /* 23.3: fyller popupens flate */
        ha-card{height:100%}
        .kart{position:relative;height:100%;overflow:hidden;background:#1d1d1d;font-family:${M.FONT || 'inherit'}}
        .map,.map .lf{position:absolute;inset:0;touch-action:none}
        #map,#map .leaflet-container,#map ha-map{touch-action:none!important}
        .map .lf{background:#1d1d1d}
        .msh-mk{background:none;border:0}
        ${LEAF_BASE}
        .err{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:var(--gray700,#979797);font-size:13px;text-align:center;padding:0 40px}
        /* 23.3: én gradient (mørk øverst, gjennomsiktig fra ca. 160 px). Overleggene slipper trykk gjennom til kartet;
           bare knapper, chips og kort tar imot (pointer-events: auto). */
        .grad{position:absolute;left:0;right:0;top:0;height:calc(env(safe-area-inset-top,0px) + var(--kart-occ-top,var(--ki-nav-occ-top,0px)) + 160px);z-index:999;pointer-events:none;background:linear-gradient(180deg,rgba(35,35,35,.94) 0%,rgba(35,35,35,.7) 45%,rgba(35,35,35,0) 100%)}
        .acts{position:absolute;z-index:1001;top:var(--kart-act-top,calc(env(safe-area-inset-top,0px) + var(--kart-occ-top,var(--ki-nav-occ-top,0px)) + 8px));right:var(--kart-act-right,calc(var(--kart-occ-right,var(--ki-nav-occ-right,0px)) + 16px));display:flex;gap:8px;pointer-events:none}
        .acts>*{pointer-events:auto}
        :host([data-bh]) .acts .x{display:none} /* Bubble-headeren har × */
        .top{position:absolute;left:var(--kart-occ-left,var(--ki-nav-occ-left,0px));right:var(--kart-occ-right,var(--ki-nav-occ-right,0px));top:var(--kart-hd,calc(env(safe-area-inset-top,0px) + var(--kart-occ-top,var(--ki-nav-occ-top,0px)) + 64px));z-index:1000;padding:0 16px;display:flex;flex-direction:column;gap:6px;pointer-events:none}
        .top .chips{pointer-events:none}
        .top .chip{pointer-events:auto}
        .rb{width:44px;height:44px;border-radius:50%;flex:none;display:grid;place-items:center;background:rgba(58,58,58,.9);color:#fafafa;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}
        .rb.sm{width:36px;height:36px;background:var(--gray300,#404040)}
        .rb:active,.sb:active,.chip:active,.pl:active,.db:active{transform:scale(.95)}
        .sm{font-size:12px;color:var(--gray800,#afafaf);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-shadow:0 1px 3px rgba(0,0,0,.6);pointer-events:none}
        .chips{display:flex;gap:8px;overflow-x:auto;touch-action:pan-x;margin:0 -16px;padding:0 16px}
        .chip{flex:none;display:inline-flex;align-items:center;gap:6px;height:36px;padding:0 12px 0 10px;border-radius:18px;background:rgba(58,58,58,.9);color:#e1e1e1;font-size:13px;font-weight:500;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);white-space:nowrap}
        .chip b{font-weight:600;opacity:.7}
        .chip.on{background:${PINK};color:#2f2f2f}
        .side{position:absolute;right:calc(var(--kart-occ-right,var(--ki-nav-occ-right,0px)) + 12px);top:calc(50% + (var(--kart-occ-top,var(--ki-nav-occ-top,0px)) - var(--kart-occ-bottom,var(--ki-nav-occ-bottom,0px))) / 2);transform:translateY(-50%);z-index:1000;display:flex;flex-direction:column;gap:8px;pointer-events:none}
        .side>*{pointer-events:auto}
        .sb{width:48px;height:48px;border-radius:50%;display:grid;place-items:center;background:rgba(58,58,58,.9);color:#fafafa;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);box-shadow:0 2px 10px rgba(0,0,0,.35)}
        .bot{position:absolute;left:var(--kart-occ-left,var(--ki-nav-occ-left,0px));right:var(--kart-occ-right,var(--ki-nav-occ-right,0px));bottom:calc(var(--kart-occ-bottom,var(--ki-nav-occ-bottom,0px)) + 12px);z-index:1000;display:flex;flex-direction:column;gap:8px;pointer-events:none}
        .bot .det,.bot .pl{pointer-events:auto}
        .row{display:flex;gap:8px;overflow-x:auto;touch-action:pan-x;padding:0 12px;pointer-events:none}
        .pl{flex:none;display:flex;align-items:center;gap:10px;height:64px;padding:0 16px 0 12px;border-radius:32px;background:rgba(58,58,58,.92);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);text-align:left;box-shadow:0 4px 14px rgba(0,0,0,.35);max-width:260px}
        .pl.on{box-shadow:0 0 0 2px #fafafa,0 4px 14px rgba(0,0,0,.35)}
        .pa,.da,.wa{width:40px;height:40px;border-radius:50%;flex:none;display:grid;place-items:center;overflow:hidden;background:var(--gray300,#404040);color:#fafafa}
        .pa img,.da img,.wa img{width:100%;height:100%;object-fit:cover}
        .pa.car,.da.car{background:#fafafa;color:#232323}
        .pt{display:flex;flex-direction:column;min-width:0}
        .pt b,.dt b{font-size:15px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .pt i,.dt i{font-style:normal;font-size:12px;color:var(--gray800,#afafaf);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .att{align-self:flex-end;margin:0 12px;padding:1px 6px;border-radius:6px;background:rgba(35,35,35,.6);color:var(--gray700,#979797);font-size:10px;pointer-events:none}
        .det{margin:0 12px;padding:14px;border-radius:24px;background:rgba(40,40,40,.96);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);box-shadow:0 8px 24px rgba(0,0,0,.45),${C.edge};display:flex;flex-direction:column;gap:12px;max-width:520px;max-height:calc(var(--kart-h,100vh) - var(--kart-hd,64px) - var(--kart-occ-bottom,var(--ki-nav-occ-bottom,0px)) - 140px);overflow-y:auto;overscroll-behavior:contain}
        .dh{display:flex;align-items:center;gap:12px}
        .da{width:44px;height:44px;background:none}
        .dt{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
        .dg{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px}
        .kv{display:flex;flex-direction:column;gap:2px;padding:10px 12px;border-radius:16px;background:var(--gray200,#3a3a3a)}
        .kv span{font-size:11px;color:var(--gray700,#979797)}
        .kv b{font-size:14px;font-weight:600}
        .who{display:flex;flex-wrap:wrap;gap:10px;grid-column:1/-1}
        .wp{display:inline-flex;align-items:center;gap:6px;font-size:13px}
        .wa{width:28px;height:28px}
        .db{height:44px;border-radius:22px;background:#fafafa;color:#232323;display:flex;align-items:center;justify-content:center;gap:6px;font-size:14px;font-weight:600}
      `;
    }
  }
  M.define('msh-kart-card', Kart, 'MSH Kart', 'Kart-popup (#kart): fullskjerm-kart med personer, biler, soner og kollektiv i sanntid (Entur).');

  /* ------------------------------------------------------------ popup-utseende (fiks 23.3)
   * Hvorfor 50 px-stripen overlevde 22.1: unntaket lå bare i M.popupTemplateA (M.POPUP_LOOK). Alt som ble lagt OPPÅ den
   * genererte popupen tok det bort igjen: popup_overrides (ki-store/strategi-YAML, særlig «replace» lagret fra Tilpass Hjem →
   * Popups med standardmalens margin_top 50px/bg 98), custom_popups med #kart og M.buildPopups (manuelle dashbord: eksisterende
   * popup får bare nytt kort). I tillegg legger Bubble Card alltid 56 px + safe-area + margin_top over popupen
   * (top: calc(56px + … + var(--custom-height-offset-mobile))), så selv margin_top 0 ga en stripe uten HA-verktøylinjen (PWA/kiosk).
   * Nå: M.POPUP_FORCE['#kart'] kjøres av strategien ETTER overstyringene (04-strategy.js mergePopups) og av buildPopups,
   * og stilene under setter popupens topp til dashbord-containerens topp (--ki-kart-top, satt av kortet). */
  const KS = '/* ki-kart:start (fiks 23.3 · fullskjerm-kart, legges inn på nytt ved hver generering) */', KE = '/* ki-kart:end */';
  const KART_BLOCK = `${KS}
.bubble-pop-up.bubble-pop-up:not(.editor){top:var(--ki-kart-top,0px)!important;bottom:0!important;height:auto!important;max-height:none!important;border-radius:0!important;overflow:hidden!important;--bubble-pop-up-border-radius:0px;--bubble-pop-up-content-border-radius:0px;--bubble-pop-up-header-overlap:0px}
.bubble-pop-up.bubble-pop-up .bubble-pop-up-background{border-radius:0!important}
.bubble-pop-up.bubble-pop-up > .bubble-header-container{position:absolute!important;top:calc(env(safe-area-inset-top,0px) + var(--ki-kart-occ-top,0px))!important;left:var(--ki-kart-occ-left,0px)!important;right:var(--ki-kart-occ-right,0px)!important;margin:0!important;width:auto!important;max-width:none!important;z-index:6!important;background:transparent!important;box-shadow:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;pointer-events:none!important}
.bubble-pop-up.bubble-pop-up > .bubble-header-container *{pointer-events:none}
.bubble-pop-up.bubble-pop-up > .bubble-header-container .bubble-close-button,.bubble-pop-up.bubble-pop-up > .bubble-header-container .close-pop-up,.bubble-pop-up.bubble-pop-up > .bubble-header-container .bubble-close-button *{pointer-events:auto!important}
.bubble-pop-up #header-container > div > div,.bubble-pop-up.bubble-pop-up .bubble-header{background:transparent!important;box-shadow:none!important}
.bubble-pop-up.bubble-pop-up .bubble-name{font-size:30px!important;font-weight:500;line-height:1.4!important;padding:8px 0!important;text-shadow:0 1px 4px rgba(0,0,0,.5)}
.bubble-pop-up.bubble-pop-up .bubble-close-button{background-color:rgba(58,58,58,.9)!important;border-radius:50%}
.bubble-pop-up.bubble-pop-up > .bubble-pop-up-container{position:absolute!important;inset:0!important;height:auto!important;max-height:none!important;padding:0!important;margin:0!important;border-radius:0!important;clip-path:none!important;-webkit-clip-path:none!important;mask-image:none!important;-webkit-mask-image:none!important;overflow:hidden!important;overscroll-behavior:none!important;touch-action:none!important;z-index:1;gap:0!important;--vertical-stack-card-gap:0px!important}
${KE}`;
  const KART_ICON = '.icon-container {background-color:var(--gray1000)!important;}\n.icon-container > ha-icon {color:var(--black)!important;opacity:1!important}';
  // Gammel (20.22/22.1) kart-blokk: skjult header + margin-top-regler → fjernes før den nye legges inn
  const OLD_RX = /^\.bubble-pop-up\.bubble-pop-up(,\.bubble-pop-up\.bubble-pop-up \.bubble-pop-up-background\{border-radius:0!important;--bubble-pop-up-border-radius:0px\}| \.bubble-header-container\{display:none!important\}| > \.bubble-pop-up-container\{padding:0!important;margin-top:0!important;[^\n]*)\n?/gm;
  const kartStyles = (prev) => {
    let s = typeof prev === 'string' ? prev : '';
    for (let i = s.indexOf(KS); i >= 0; i = s.indexOf(KS)) { const j = s.indexOf(KE, i); s = s.slice(0, i) + (j >= 0 ? s.slice(j + KE.length) : ''); }
    s = s.replace(OLD_RX, '').trim();
    if (!/\.icon-container\s*\{\s*background-color/.test(s)) s = (s ? s + '\n' : '') + KART_ICON;
    return s + '\n' + KART_BLOCK;
  };
  const FIXED = { margin_top_mobile: '0px', margin_top_desktop: '0px', bg_opacity: '0', bg_blur: '0' };
  M.POPUP_LOOK = M.POPUP_LOOK || {};
  M.POPUP_LOOK[HASH] = {
    // width_desktop: hele dashbordflaten til høyre for HA-sidebaren/navbar-railen (Bubble sentrerer på content-inline-start)
    width_desktop: 'calc(100% - var(--bubble-pop-up-content-inline-start, 0px))', ...FIXED, close_by_clicking_outside: false,
    styles: kartStyles(''),
  };
  // Håndheves på den ferdige popupen (etter overstyringer/egne popups): bare når popupens kort er msh-kart-card
  M.POPUP_FORCE = M.POPUP_FORCE || {};
  M.POPUP_FORCE[HASH] = (cfg) => {
    if (!cfg || typeof cfg !== 'object' || !Array.isArray(cfg.cards) || !cfg.cards.some((c) => c && String(c.type || '').replace(/^custom:/, '') === 'msh-kart-card')) return null;
    const out = { ...cfg, ...FIXED, styles: kartStyles(cfg.styles) };
    delete out.show_header; // Bubble-headeren vises (over kartet)
    if (!out.width_desktop) out.width_desktop = M.POPUP_LOOK[HASH].width_desktop;
    if (out.close_by_clicking_outside == null) out.close_by_clicking_outside = false;
    return out;
  };

  /* ------------------------------------------------------------ konsollsjekkene (23.3) · MSH.kartDiag()
   * Kjør på telefonen (Safari Web Inspector / Chrome remote) med #kart åpen. Returnerer objektet med de fire sjekkene:
   *   touchAction === 'none', map.getSize() > 0, dragging + touchZoom på, elementFromPoint(midten) treffer kartet (ikke overlegg). */
  const deepFind = (root, tag, d = 0) => {
    if (!root || d > 20 || !root.querySelectorAll) return null;
    const hit = root.querySelector(tag); if (hit) return hit;
    for (const e of root.querySelectorAll('*')) if (e.shadowRoot) { const r = deepFind(e.shadowRoot, tag, d + 1); if (r) return r; }
    return null;
  };
  M.kartDiag = function (el) {
    const card = el || deepFind(document, 'msh-kart-card');
    if (!card || !card.shadowRoot) return { pass: false, err: 'fant ikke msh-kart-card (åpne #kart først)' };
    const sr = card.shadowRoot, map = card._map, box = sr.querySelector('#map');
    const mapEl = (map && map.getContainer && map.getContainer()) || sr.querySelector('.leaflet-container') || box;
    const touchAction = mapEl ? getComputedStyle(mapEl).touchAction : null;
    let size = null; try { const z = map && map.getSize && map.getSize(); size = z ? { x: Math.round(z.x), y: Math.round(z.y) } : null; } catch (e) { /* */ }
    const en = (k) => { try { return !!(map && map[k] && map[k].enabled && map[k].enabled()); } catch (e) { return false; } };
    const r = box ? box.getBoundingClientRect() : { left: 0, top: 0, width: 0, height: 0 };
    const mid = { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    const hit = sr.elementFromPoint ? sr.elementFromPoint(mid.x, mid.y) : null;
    const desc = (e) => (e ? e.localName + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).join('.') : '') : null);
    const inMap = !!hit && !!box && (hit === box || box.contains(hit));
    const overlay = !!hit && !!hit.closest && !!hit.closest('.grad,.top,.bot,.side,.acts');
    const css = [...sr.querySelectorAll('style')].some((s) => /\.leaflet-container[^{]*\{[^}]*touch-action:\s*none/.test(s.textContent));
    const ok = {
      touchAction: touchAction === 'none',
      size: !!size && size.x > 0 && size.y > 0,
      gestures: en('dragging') && en('touchZoom'),
      hit: inMap && !overlay,
    };
    return {
      touchAction, size, dragging: en('dragging'), touchZoom: en('touchZoom'), mid, hit: desc(hit), hitLeaflet: !!hit && /leaflet-(tile|pane|container)/.test(String(hit.className || '')) || (!!hit && hit.localName === 'ha-map'),
      leafletCss: css, engine: card._haMap ? 'ha-map' : map ? 'leaflet' : 'ingen', navSrc: card._navSrc || null, nav: card._nav || null,
      ok, pass: Object.values(ok).every(Boolean),
    };
  };
})();
