/* msh-ruter-card · popup #ruter. Kilde: Ruter v2.dc.html + Fiks 19.1 («Ruter v3»: toppkort, gå nå, perrong, forsinkelse, belegg, reise, tidslinje)
 * Rekkefølge: toppkort (neste avgang du rekker + tidslinje) → avvik (entur_sx) → Reise (Til skolen / Hjem) → avganger per stopp → sist oppdatert.
 * Avganger: entur_public_transport-sensorene + Entur Journey Planner v3 (hentes bare mens popupen er åpen; feiler den, brukes sensorene).
 * Attributter leses defensivt: route, due_at, due_in, delay, real_time, next_route, next_due_at, next_due_in,
 * next_real_time, transport_mode, stop_id, departure_#N («ca. 21:30 5 Vestli»), evt. departures-liste.
 * Fiks 20.11: reise-kortet kan åpnes (ui.trips) → vertikal reiseplan (gå → påstigning per etappe → bytte → fremme) +
 *   «Neste mulighet» og «Vis i toppkortet» (ui.heroAlt). Tannhjulet i toppkortet er eneste Tilpass-inngang; «Tilpass» over
 *   Avganger bare når toppkortet er av.
 */
(function () {
  const M = window.MSH, esc = M.esc, C = M.C;
  // Fiks 35 (tema): aksent som tekst/ikon mørknes i lys modus (AT), tone-bakgrunner .12→.18 (TONE), gjennomsiktig
  // hvit/svart etter regel 4/3 (WA/KA). Linjefargene (badger) beholdes. Mørk modus = som før.
  const TH = M.theme || {};
  const AT = (c) => (TH.accentText ? TH.accentText(c) : c);
  // Tekst på tone-pille: mørknet aksent blandes ytterligere med svart i lys modus (--ki-accent-mix 60 %) → ≥ 4,5:1
  const ATP = (c) => `color-mix(in srgb, ${AT(c)} var(--ki-accent-mix, 100%), black)`;
  const TONE = (c, a) => (TH.tone ? TH.tone(c, undefined, a).bg : M.alpha(c, a));
  const WA = (a) => (TH.whiteA ? TH.whiteA(a) : `rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(${a}*var(--ki-wa-k,1)),var(--ki-wa-max,1)))`);
  const KA = (a) => (TH.blackA ? TH.blackA(a) : `rgb(0 0 0/max(var(--ki-ka-min,0),calc(${a}*var(--ki-ka-k,1))))`);
  // Transportmiddel → [ikon, linjefarge] (Ruters linjefarger, ikke temafarger).
  const MODE = { metro: ['subway', 'oklch(0.66 0.16 45)'], tram: ['tram', 'oklch(0.62 0.13 245)'], bus: ['directions_bus', 'oklch(0.6 0.17 25)'], coach: ['directions_bus', 'oklch(0.6 0.17 25)'], rail: ['train', 'oklch(0.55 0.12 260)'], water: ['directions_boat', 'oklch(0.6 0.1 220)'], air: ['flight', 'oklch(0.55 0.12 260)'] };
  const modeOf = (k) => MODE[String(k || '').toLowerCase()] || null;
  const PLAT = ['entur_public_transport', 'entur'];
  const NORMAL = /^(normal( service)?|ok|ingen( avvik)?|none|0|unknown|unavailable|)$/i;

  const hmToMin = (s) => {
    const m = /(\d{1,2})[:.](\d{2})/.exec(String(s || ''));
    if (!m) return null;
    const now = new Date(), t = new Date(now);
    t.setHours(Number(m[1]), Number(m[2]), 0, 0);
    let d = (t - now) / 60000;
    if (d < -720) d += 1440;
    if (d > 720) d -= 1440;
    return Math.round(d);
  };
  const isoToMin = (s) => { const t = new Date(s).getTime(); return isNaN(t) ? null : Math.round((t - Date.now()) / 60000); };
  const splitRoute = (r) => {
    const s = String(r || '').trim();
    const i = s.indexOf(' ');
    return i > 0 ? { line: s.slice(0, i), dest: s.slice(i + 1) } : { line: s, dest: '' };
  };

  // Avganger fra én stoppsensor.
  M.enturDepartures = function (st) {
    if (!st) return [];
    const A = st.attributes || {}, out = [];
    const push = (route, min, at, rt, mode) => {
      if (!route) return;
      const r = splitRoute(route);
      out.push({ line: r.line, dest: r.dest, min, at: at || null, rt: rt === true || rt === 'true' || rt === 'True', mode: mode || null });
    };
    if (A.route) {
      let m = hmToMin(A.due_at);
      if (m == null && M.isNum(A.due_in)) m = Number(A.due_in);
      if (m == null && M.isNum(st.state)) m = Number(st.state);
      push(A.route, m, A.due_at, A.real_time, A.transport_mode);
    }
    if (A.next_route) {
      let m = hmToMin(A.next_due_at);
      if (m == null && M.isNum(A.next_due_in)) m = Number(A.next_due_in);
      push(A.next_route, m, A.next_due_at, A.next_real_time, A.next_transport_mode);
    }
    Object.keys(A).map((k) => /^departure_#(\d+)$/.exec(k)).filter(Boolean).sort((a, b) => a[1] - b[1]).forEach((k) => {
      const v = String(A[k[0]] || ''), ca = /^ca\.?\s*/i.test(v), s = v.replace(/^ca\.?\s*/i, '');
      const m = /^(\d{1,2}[:.]\d{2})\s+(.*)$/.exec(s);
      if (m) push(m[2], hmToMin(m[1]), m[1], !ca);
    });
    // Alternativt format: departures: [{ line/route, destination, due_in/expected/aimed, realtime, transport_mode }]
    const L = Array.isArray(A.departures) ? A.departures : [];
    L.forEach((d) => {
      if (!d || typeof d !== 'object') return;
      const line = d.line || d.public_code || d.route_short || '', dest = d.destination || d.front_text || d.front_display || '';
      const min = M.isNum(d.due_in) ? Number(d.due_in) : d.expected ? isoToMin(d.expected) : d.aimed ? isoToMin(d.aimed) : hmToMin(d.due_at);
      out.push({ line: String(line), dest: String(dest), min, at: d.due_at || null, rt: !!(d.realtime || d.real_time), mode: d.transport_mode || null });
    });
    const dm = A.transport_mode || null;
    return out.filter((d) => d.min == null || d.min >= -1).map((d) => ({ ...d, mode: d.mode || dm }));
  };

  // Avvik fra entur_sx-sensorer (linjesensorer og/eller meldingslister).
  function sxItems(hass, id, depModes) {
    const st = hass.states[id];
    if (!st) return [];
    const A = st.attributes || {}, items = [];
    const stat = (s) => { s = String(s || '').toLowerCase(); return /open|active|aktiv|ongoing|pågår/.test(s) ? 'open' : /plan/.test(s) ? 'planned' : /closed|expired|avsluttet/.test(s) ? 'closed' : ''; };
    const lineOf = (v) => String(v || '').replace(/^.*:Line:/i, '');
    const baseLine = lineOf(A.public_code || A.line || A.line_ref || A.line_id || A.line_name || (/line_([a-z0-9]+)$/i.exec(id) || [])[1] || '');
    const kindOf = (line, m) => (m && modeOf(m) ? String(m).toLowerCase() : depModes[line] || 'bus');
    const listKey = ['meldinger', 'messages', 'deviations', 'situations', 'items', 'alerts'].find((k) => Array.isArray(A[k]));
    if (listKey) {
      A[listKey].forEach((x, i) => {
        if (!x || typeof x !== 'object') return;
        const line = lineOf(x.public_code || x.line || x.line_ref || baseLine);
        const s = stat(x.status || x.progress) || 'open';
        if (s === 'closed') return;
        items.push({ key: `${id}#${i}`, ent: id, line, kind: kindOf(line, x.transport_mode), sum: x.summary || x.title || x.text || x.header || '–', st: s, desc: x.description || x.advice || '', from: x.valid_from || x.start_time || x.validity_start || '', to: x.valid_to || x.end_time || x.validity_end || '' });
      });
      return items;
    }
    const sum = A.summary || A.title || st.state;
    let s = stat(A.status || A.progress);
    if (!s && !NORMAL.test(String(sum).trim()) && !M.isNum(st.state)) s = 'open';
    items.push({ key: id, ent: id, line: baseLine, kind: kindOf(baseLine, A.transport_mode), sum: String(sum), st: s, desc: A.description || A.advice || '', from: A.valid_from || A.start_time || A.validity_start || '', to: A.valid_to || A.end_time || A.validity_end || '', isLine: true });
    return items;
  }

  const stopCfg = (cfg, id) => (cfg.stops && cfg.stops[id.split('.').slice(1).join('.')]) || {};
  const stopName = (hass, id, cfg) => stopCfg(cfg || {}, id).name || String(M.name(hass, id)).replace(/^entur\s+/i, '');

  // Autokonfig for Ruter.
  M.ruterAuto = function (hass, cfg) {
    cfg = cfg || {};
    if (!hass) return { stops: [], autoStops: [], allStops: [], sum: null, autoSum: null, lines: [], lineAuto: [] };
    const autoStops = [...new Set(PLAT.flatMap((p) => M.byPlatform(hass, p, 'sensor')))].filter((id) => M.usable(hass, id));
    const allStops = [...new Set([...autoStops, ...((cfg.include && cfg.include.stopp) || [])])];
    let stops = M.applyLists(cfg, 'stopp', autoStops).filter((id) => hass.states[id]);
    const ord = Array.isArray(cfg.stop_order) ? cfg.stop_order : [];
    stops = stops.map((id, i) => [id, ord.indexOf(id) < 0 ? 1000 + i : ord.indexOf(id)]).sort((a, b) => a[1] - b[1]).map((x) => x[0]);
    const sx = M.byPlatform(hass, 'entur_sx').filter((id) => /^(sensor|binary_sensor)\./.test(id));
    const isLine = (id) => { const A = hass.states[id].attributes; return /line/i.test(id.split('.')[1]) || A.line != null || A.line_ref != null || A.line_id != null || A.public_code != null; };
    const autoSum = sx.find((id) => /_summary$/.test(id)) || sx.find((id) => !isLine(id)) || null;
    const sum = M.pick(cfg, 'avvik', autoSum);
    let lineAuto = sx.filter((id) => id !== sum && isLine(id));
    const dev = sum && M.regEntry(hass, sum) && M.regEntry(hass, sum).device_id;
    if (dev) { const same = lineAuto.filter((id) => (M.regEntry(hass, id) || {}).device_id === dev); if (same.length) lineAuto = same; }
    const lines = M.applyLists(cfg, 'linjer', lineAuto).filter((id) => hass.states[id]);
    return { stops, autoStops, allStops, sum, autoSum, lines, lineAuto };
  };

  /* ------------------------------------------------------------ Fiks 19.1 · Entur Journey Planner + reiser */
  // entur_public_transport gir bare neste/neste etter. Perrong, rutetid → forventet og belegg hentes direkte fra
  // Entur Journey Planner v3 (bare mens popupen er åpen, mellomlagret 30 s). Feiler hentingen, brukes sensorene.
  const JP = 'https://api.entur.io/journey-planner/v3/graphql';
  const GEO = 'https://api.entur.io/geocoder/v1/autocomplete';
  const TTL = 30000;
  const CACHE = new Map(); // nøkkel → { t, data } (siste vellykkede) + p (henting på vei)
  const GEOC = new Map(); // stoppnavn (normalisert) → NSR-id | null
  try { const g = JSON.parse(localStorage.getItem('ki-msh:entur-geo') || '{}'); Object.keys(g).forEach((k) => GEOC.set(k, g[k])); } catch (e) { /* */ }
  const norm = (s) => String(s || '').toLowerCase().replace(/^entur\s+/, '').replace(/[^a-z0-9æøåäöü]+/g, ' ').trim();
  const hm = (t) => { const d = new Date(t); return `${M.pad(d.getHours())}:${M.pad(d.getMinutes())}`; };
  const hms = (t) => { const d = new Date(t); return `${hm(t)}:${M.pad(d.getSeconds())}`; };
  const minTo = (t) => Math.round((t - Date.now()) / 60000);
  const walkOf = (o) => { if (!o) return null; if (M.isNum(o.walk_min)) return Number(o.walk_min); const m = /(\d+)\s*min/i.exec(String(o.walk || '')); return m ? Number(m[1]) : null; };
  const listOf = (v) => (Array.isArray(v) ? v : String(v || '').split(/[\s,;]+/)).map((x) => String(x).trim()).filter(Boolean);
  const clientName = (hass) => `${String((hass && hass.user && hass.user.name) || 'ha').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'ha'}-ki-dashboard`;
  const peek = (k) => { const e = CACHE.get(k); return e && e.data !== undefined && Date.now() - e.t < 300000 ? e.data : undefined; }; // eldre enn 5 min → sensorene
  function cached(k, fn) {
    const e = CACHE.get(k) || {};
    if (e.data !== undefined && Date.now() - e.t < TTL - 2000) return Promise.resolve(e.data);
    if (e.p) return e.p;
    e.p = fn().then((d) => { CACHE.set(k, { t: Date.now(), data: d }); return d; }, (err) => { e.p = null; throw err; });
    CACHE.set(k, e);
    return e.p;
  }
  async function http(url, opts) {
    const ac = typeof AbortController !== 'undefined' ? new AbortController() : null, to = ac && setTimeout(() => ac.abort(), 12000);
    try {
      const r = await fetch(url, { ...opts, signal: ac ? ac.signal : undefined });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } finally { if (to) clearTimeout(to); }
  }
  M.enturGQL = async function (hass, query, variables) {
    const j = await http(JP, { method: 'POST', headers: { 'Content-Type': 'application/json', 'ET-Client-Name': clientName(hass) }, body: JSON.stringify({ query, variables }) });
    if (!j || (j.errors && !j.data)) throw new Error((j && j.errors && j.errors[0] && j.errors[0].message) || 'Entur-feil');
    return j.data;
  };
  const Q_STOP = `query($id:String!){stopPlace(id:$id){id name estimatedCalls(timeRange:3600,numberOfDepartures:20){aimedDepartureTime expectedDepartureTime realtime occupancyStatus quay{publicCode name} destinationDisplay{frontText} serviceJourney{line{publicCode transportMode}}}}}`;
  const MODES = ['bus', 'tram', 'metro', 'rail', 'water', 'coach'];
  const qTrip = (mode) => `query($from:String!,$to:String!,$t:DateTime){trip(from:{place:$from},to:{place:$to},dateTime:$t,numTripPatterns:12,searchWindow:90${MODES.includes(mode) ? `,modes:{transportModes:[{transportMode:${mode}}]}` : ''}){tripPatterns{legs{mode realtime aimedStartTime expectedStartTime expectedEndTime fromPlace{name quay{publicCode}} toPlace{name} line{publicCode transportMode} fromEstimatedCall{occupancyStatus}}}}}`;
  // Estimerte avganger fra Entur → samme form som sensoravgangene (+ perrong, rutetid, belegg)
  const callDep = (c) => {
    const t = new Date(c.expectedDepartureTime || c.aimedDepartureTime).getTime(), a = c.aimedDepartureTime ? new Date(c.aimedDepartureTime).getTime() : null;
    const ln = (c.serviceJourney && c.serviceJourney.line) || {};
    return { line: String(ln.publicCode || ''), dest: (c.destinationDisplay && c.destinationDisplay.frontText) || '', mode: ln.transportMode || null, t, aimed: a, rt: !!c.realtime,
      occ: c.occupancyStatus || null, plat: (c.quay && c.quay.publicCode) || '', delay: a ? Math.round((t - a) / 60000) : 0, src: 'entur' };
  };
  // Sensoravganger (M.enturDepartures) → samme form (klokkeslett fra minutter)
  const sensorDeps = (st) => {
    if (!st) return [];
    const A = st.attributes || {}, now = Date.now();
    return M.enturDepartures(st).filter((d) => d.min != null).map((d, i) => ({ line: d.line, dest: d.dest, mode: d.mode, t: now + d.min * 60000, aimed: null, rt: d.rt, occ: null, plat: '',
      delay: i === 0 && M.isNum(A.delay) ? Math.round(Number(A.delay) > 90 ? Number(A.delay) / 60 : Number(A.delay)) : 0, src: 'sensor' }));
  };
  const depKey = (d) => `${d.line}|${d.dest}|${hm(d.aimed || d.t)}`;
  const altKey = (p, i) => String(p.alt.id || (p.alt.legs || []).map((l) => `${l.from}>${l.to}`).join('|') || i);
  // Plattform: «Spor 2» (tall) / «Plf. B» (bokstav)
  const platL = (p) => (!p ? '' : /^\d+$/.test(String(p)) ? `Spor ${p}` : `Plf. ${p}`);
  const OCC = { empty: 1, manySeatsAvailable: 1, fewSeatsAvailable: 2, standingRoomOnly: 2, crushedStandingRoomOnly: 3, full: 3 };
  const OCC_L = ['', 'Lite folk', 'Noe folk', 'Fullt'];
  // «Gå nå»-varsel: ledig = avgang − gangtid (min)
  const goOf = (ledig) => (ledig < 0 ? ['Rekker ikke', C.red] : ledig <= 1 ? ['Gå nå', C.green] : ledig <= 5 ? [`Gå om ${ledig} min`, C.orange] : [`Gå om ${ledig} min`, C.blue]);

  // D · brukerens egne reiser (standard i getStubConfig, fylles inn når trips mangler – som 17.9).
  // Trikkelinjen Majorstuen ↔ Holbergs plass/Frydenlund hardkodes ikke (lines: [] + mode tram → linjene som faktisk går).
  const STD_TRIPS = {
    auto_switch: '12:00', transfer_min: 2,
    school: { name: 'Til skolen', alts: [
      { id: 's1', enabled: true, legs: [{ from: 'Amagerveien', to: 'Majorstuen', lines: ['45'], mode: 'bus' }, { from: 'Majorstuen', to: 'Holbergs plass', lines: [], mode: 'tram' }] },
      { id: 's2', enabled: true, legs: [{ from: 'Holmen', to: 'Majorstuen', lines: ['1'], mode: 'metro' }, { from: 'Majorstuen', to: 'Holbergs plass', lines: [], mode: 'tram' }] },
    ] },
    home: { name: 'Hjem', alts: [
      { id: 'h1', enabled: true, legs: [{ from: 'Holbergs plass', to: 'Majorstuen', lines: [], mode: 'tram' }, { from: 'Majorstuen', to: 'Amagerveien', lines: ['45'], mode: 'bus' }] },
      { id: 'h2', enabled: true, legs: [{ from: 'Frydenlund', to: 'Majorstuen', lines: [], mode: 'tram' }, { from: 'Majorstuen', to: 'Amagerveien', lines: ['46'], mode: 'bus' }] },
      { id: 'h3', enabled: true, legs: [{ from: 'Holbergs plass / Frydenlund', to: 'Majorstuen', lines: [], mode: 'tram' }, { from: 'Majorstuen', to: 'Holmen', lines: ['1'], mode: 'metro' }] },
      { id: 'h4', enabled: true, legs: [{ from: 'Holbergs plass / Frydenlund', to: 'Majorstuen', lines: [], mode: 'tram' }, { from: 'Majorstuen', to: 'Hovseter', lines: ['2'], mode: 'metro' }] },
    ] },
  };
  const clone = (o) => JSON.parse(JSON.stringify(o));
  M.ruterTrips = function (c) {
    const t = (c && c.trips && typeof c.trips === 'object') ? c.trips : {};
    const dir = (k) => { const d = t[k] && typeof t[k] === 'object' ? t[k] : null; return d && Array.isArray(d.alts) ? { name: d.name || STD_TRIPS[k].name, alts: d.alts.filter((a) => a && Array.isArray(a.legs)) } : clone(STD_TRIPS[k]); };
    return { auto_switch: t.auto_switch || STD_TRIPS.auto_switch, transfer_min: M.isNum(t.transfer_min) ? Number(t.transfer_min) : STD_TRIPS.transfer_min, school: dir('school'), home: dir('home') };
  };
  const autoDir = (T) => { const m = /(\d{1,2})[:.]?(\d{2})?/.exec(String(T.auto_switch || '12:00')) || [0, 12, 0], d = new Date(); return d.getHours() * 60 + d.getMinutes() < Number(m[1]) * 60 + Number(m[2] || 0) ? 'school' : 'home'; };
  const fromNames = (s) => String(s || '').split('/').map((x) => x.trim()).filter(Boolean);

  // Stoppnavn / sensor / NSR-id → { name, sensor, nsr } (synkront, fra sensorene og geokoder-bufferen)
  function resolveStop(hass, cfg, ref, stops) {
    ref = String(ref || '').trim();
    if (!ref) return null;
    if (/^sensor\./.test(ref)) { const st = hass.states[ref]; const nsr = st && /^NSR:StopPlace:/.test(st.attributes.stop_id || '') ? st.attributes.stop_id : null; return { name: stopName(hass, ref, cfg), sensor: st ? ref : null, nsr }; }
    if (/^NSR:/.test(ref)) { const s = (stops || []).find((id) => (hass.states[id].attributes || {}).stop_id === ref); return { name: s ? stopName(hass, s, cfg) : ref, sensor: s || null, nsr: ref }; }
    const n = norm(ref), all = stops || [];
    const s = all.find((id) => norm(stopName(hass, id, cfg)) === n) || all.find((id) => norm(stopName(hass, id, cfg)).startsWith(n + ' ')) || null;
    const sa = s ? hass.states[s].attributes || {} : {};
    const nsr = /^NSR:StopPlace:/.test(sa.stop_id || '') ? sa.stop_id : (GEOC.get(n) || null);
    return { name: ref, sensor: s, nsr };
  }
  async function geocode(hass, name) {
    const n = norm(name);
    if (GEOC.has(n)) return GEOC.get(n);
    const cf = (hass && hass.config) || {}, u = new URL(GEO);
    u.searchParams.set('text', name); u.searchParams.set('size', '6'); u.searchParams.set('layers', 'venue'); u.searchParams.set('lang', 'no');
    if (M.isNum(cf.latitude) && M.isNum(cf.longitude)) { u.searchParams.set('focus.point.lat', cf.latitude); u.searchParams.set('focus.point.lon', cf.longitude); }
    const j = await http(u.toString(), { headers: { 'ET-Client-Name': clientName(hass) } });
    const F = ((j && j.features) || []).map((f) => f.properties || {}).filter((p) => /^NSR:StopPlace:/.test(p.id || ''));
    const hit = F.find((p) => norm(p.name) === n) || F[0];
    const id = hit ? hit.id : null;
    GEOC.set(n, id);
    try { const o = {}; GEOC.forEach((v, k) => { o[k] = v; }); localStorage.setItem('ki-msh:entur-geo', JSON.stringify(o)); } catch (e) { /* */ }
    return id;
  }
  // Avganger for et stopp: Entur (når hentet) ellers sensoren
  function depsFor(hass, ref) {
    if (!ref) return { deps: [], src: null };
    const E = ref.nsr ? peek('sp:' + ref.nsr) : undefined;
    const now = Date.now() - 30000;
    if (E) return { deps: E.filter((d) => d.t >= now), src: 'entur' };
    return { deps: ref.sensor ? sensorDeps(hass.states[ref.sensor]) : [], src: ref.sensor ? 'sensor' : null };
  }
  const lineOk = (leg, d) => { const L = listOf(leg.lines); return L.length ? L.includes(String(d.line)) : !leg.mode || !d.mode || String(d.mode).toLowerCase() === String(leg.mode).toLowerCase(); };
  // Forbindelser for én etappe: Entur trip(from,to) (ekte reisetid) ellers stoppsensoren + evt. reisetid (ride_min)
  function legConns(hass, cfg, leg, fromRef, toRef) {
    const now = Date.now() - 30000;
    if (fromRef && toRef && fromRef.nsr && toRef.nsr) {
      const E = peek(`trip:${fromRef.nsr}>${toRef.nsr}|${leg.mode || ''}`);
      if (E) return E.filter((x) => x.t >= now && lineOk(leg, x));
    }
    return depsFor(hass, fromRef).deps.filter((d) => lineOk(leg, d)).map((d) => ({ ...d, arr: M.isNum(leg.ride_min) ? d.t + Number(leg.ride_min) * 60000 : null }));
  }
  // Beregn ett alternativ: første etappe ≥ gangtid, neste ≥ ankomst + byttemargin. Returnerer null-felt når data mangler.
  function planAlt(hass, cfg, alt, T, stops) {
    const now = Date.now(), tm = T.transfer_min * 60000;
    const leg0 = alt.legs[0];
    if (!leg0) return null;
    const cands = fromNames(leg0.from).map((nm) => {
      const fr = resolveStop(hass, cfg, nm, stops);
      const sc = fr && fr.sensor ? stopCfg(cfg, fr.sensor) : {};
      const walk = M.isNum(alt.walk_min) ? Number(alt.walk_min) : (walkOf(sc) || 0);
      const legs = [];
      let ready = now + walk * 60000, fromRef = fr;
      for (let i = 0; i < alt.legs.length; i++) {
        const leg = alt.legs[i], toRef = resolveStop(hass, cfg, leg.to, stops);
        if (i > 0) fromRef = resolveStop(hass, cfg, fromNames(leg.from)[0] || alt.legs[i - 1].to, stops);
        const conns = legConns(hass, cfg, leg, fromRef, toRef), c = conns.find((x) => x.t >= ready - 20000);
        legs.push({ leg, from: fromRef, to: toRef, c: c || null, all: i === 0 ? conns : null }); // all: «Neste mulighet» (20.11)
        if (!c || c.arr == null) break;
        ready = c.arr + tm;
      }
      const done = legs.length === alt.legs.length && legs.every((l) => l.c);
      const first = legs[0] && legs[0].c, last = done ? legs[legs.length - 1].c : null;
      const goAt = first ? first.t - walk * 60000 : null;
      return { alt, walk, legs, first, fromRef: fr, arrive: last && last.arr != null ? last.arr : null, goAt, total: last && last.arr != null && goAt != null ? Math.round((last.arr - goAt) / 60000) : null };
    });
    cands.sort((a, b) => (a.arrive == null) - (b.arrive == null) || (a.arrive || 0) - (b.arrive || 0) || (a.first ? a.first.t : 9e15) - (b.first ? b.first.t : 9e15));
    return cands[0] || null;
  }
  // Én henterunde (popupen er åpen): stoppene (sensorenes stop_id + første stopp i reisene) og etappene i valgt retning.
  // Resultat: { ok, fail } – kortet viser sensorene når alt feiler.
  async function fetchRound(card) {
    const h = card.hass, c = card.config, a = M.ruterAuto(h, c);
    const nsrs = new Set(), trips = new Map();
    a.stops.forEach((id) => { const r = resolveStop(h, c, id, a.stops); if (r && r.nsr) nsrs.add(r.nsr); });
    let ok = 0, fail = 0;
    const run = (p) => p.then(() => { ok++; }, (e) => { fail++; card._lastErr = (e && e.message) || String(e); });
    if (c.show_trips !== false) {
      const T = M.ruterTrips(c), alts = T[card._dirKey(T)].alts.filter((x) => x.enabled !== false);
      const names = new Set();
      alts.forEach((alt) => alt.legs.forEach((l, i) => { (i === 0 ? fromNames(l.from) : fromNames(l.from).slice(0, 1)).forEach((n) => names.add(n)); names.add(String(l.to || '').trim()); }));
      await Promise.all([...names].filter(Boolean).map((n) => { const r = resolveStop(h, c, n, a.stops); return r && !r.nsr && !/^(sensor\.|NSR:)/.test(n) ? run(geocode(h, n)) : null; }));
      alts.forEach((alt) => alt.legs.forEach((leg, i) => {
        const to = resolveStop(h, c, leg.to, a.stops);
        (i === 0 ? fromNames(leg.from) : fromNames(leg.from).slice(0, 1)).forEach((n) => {
          const fr = resolveStop(h, c, n, a.stops);
          if (!fr || !fr.nsr) return;
          if (i === 0) nsrs.add(fr.nsr);
          if (to && to.nsr) trips.set(`trip:${fr.nsr}>${to.nsr}|${leg.mode || ''}`, [fr.nsr, to.nsr, leg.mode || '']);
        });
      }));
    }
    const jobs = [...nsrs].map((id) => run(cached('sp:' + id, () => M.enturGQL(h, Q_STOP, { id }).then((d) => ((d.stopPlace && d.stopPlace.estimatedCalls) || []).map(callDep).filter((x) => !isNaN(x.t))))));
    trips.forEach(([f, t, mode], k) => jobs.push(run(cached(k, () => M.enturGQL(h, qTrip(mode), { from: f, to: t, t: new Date().toISOString() }).then((d) => {
      const out = [], seen = new Set();
      ((d.trip && d.trip.tripPatterns) || []).forEach((p) => {
        const L = (p.legs || []).filter((l) => l.mode !== 'foot' && l.line);
        if (L.length !== 1) return;
        const l = L[0], tt = new Date(l.expectedStartTime).getTime(), key = `${l.line.publicCode}|${tt}`;
        if (seen.has(key) || isNaN(tt)) return;
        seen.add(key);
        const aimed = l.aimedStartTime ? new Date(l.aimedStartTime).getTime() : null;
        out.push({ line: String(l.line.publicCode || ''), dest: (l.toPlace && l.toPlace.name) || '', mode: l.line.transportMode || l.mode, t: tt, aimed, arr: new Date(l.expectedEndTime).getTime(), rt: !!l.realtime,
          plat: (l.fromPlace && l.fromPlace.quay && l.fromPlace.quay.publicCode) || '', delay: aimed ? Math.round((tt - aimed) / 60000) : 0, occ: (l.fromEstimatedCall && l.fromEstimatedCall.occupancyStatus) || null, src: 'entur' });
      });
      return out.sort((x, y) => x.t - y.t);
    })))));
    await Promise.all(jobs);
    return { ok, fail };
  }

  // Editor → Reiser (Fiks 19.1 D): per retning en liste over alternativene med av/på, etapper, gangtid og rekkefølge.
  // Samme HTML i kortets egen «Rediger» og GUI-editoren (msh-editor, felttype html). Lagres som hele trips-objektet.
  const MODE_OPTS = [['', 'Alle'], ['bus', 'Buss'], ['tram', 'Trikk'], ['metro', 'T-bane'], ['rail', 'Tog'], ['water', 'Båt']];
  const setPath = (o, p, v) => { const ks = p.split('.'); let cur = o; ks.slice(0, -1).forEach((k) => { if (cur[k] == null) cur[k] = /^\d+$/.test(k) ? [] : {}; cur = cur[k]; }); const k = ks[ks.length - 1]; if (v === undefined || v === '') delete cur[k]; else cur[k] = v; };
  const altTitle = (alt) => (alt.legs || []).map((l) => listOf(l.lines).join('/') || (MODE_OPTS.find((m) => m[0] === l.mode) || ['', 'Linje'])[1]).join(' › ') + ` · ${fromNames((alt.legs[0] || {}).from).join('/') || '?'} → ${(alt.legs[alt.legs.length - 1] || {}).to || '?'}`;
  function tripsEditorHTML(h, c, key, ed) {
    const T = M.ruterTrips(c), open = ed.__ruterOpen || '';
    if (ed.shadowRoot && !ed.__ruterBound) {
      ed.__ruterBound = true;
      ed.shadowRoot.addEventListener('change', (e) => {
        const t = e.target;
        if (!t || !t.dataset || !t.dataset.trip) return;
        e.stopPropagation();
        const N = clone(M.ruterTrips(ed._config || {}));
        let v = t.value.trim();
        if (t.dataset.num === '1') v = v === '' ? undefined : Number(v);
        if (t.dataset.list === '1') v = listOf(v);
        setPath(N, t.dataset.trip, v);
        ed._set('trips', N);
      });
    }
    const b = (op, extra, inner, cls = 'ib', st = '') => `<button class="${cls}" style="${st}" data-a="fn" data-k="${esc(key)}" data-op="${op}" ${extra}>${inner}</button>`;
    const inp = (path, val, ph, num, list) => `<input class="inp" autocapitalize="off" autocorrect="off" spellcheck="false" ${num ? 'type="number" inputmode="decimal" data-num="1"' : 'inputmode="text"'} ${list ? 'data-list="1"' : ''} data-trip="${esc(path)}" value="${esc(val == null ? '' : Array.isArray(val) ? val.join(', ') : val)}" placeholder="${esc(ph || '')}">`;
    const lab = (t, x) => `<div class="f" style="padding:0"><label>${esc(t)}</label>${x}</div>`;
    const dirHTML = (dk) => {
      const D = T[dk];
      return `<div class="f"><label>${esc(dk === 'school' ? 'Retning før byttetidspunktet' : 'Retning etter byttetidspunktet')}</label>${inp(dk + '.name', D.name, STD_TRIPS[dk].name)}
        ${D.alts.map((alt, i) => {
          const id = `${dk}.${i}`, on = alt.enabled !== false, isOpen = open === id, A = `data-dir="${dk}" data-i="${i}"`;
          return `<div class="ruter-alt" style="display:flex;flex-direction:column;gap:8px;padding:8px 10px;border-radius:16px;background:var(--ki-surface, #3a3a3a)">
            <div class="line" style="gap:6px">${b('toggle', A, '', `sw ${on ? 'on' : ''}`)}
              ${b('edit', A, `<span style="font-size:13px;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(altTitle(alt))}</span>`, '', 'flex:1;min-width:0;text-align:left;background:none;border:0;color:inherit;font:inherit;padding:4px 0;cursor:pointer')}
              ${b('up', A, M.icon('mdi:chevron-up', 20))}${b('down', A, M.icon('mdi:chevron-down', 20))}${b('del', A, M.icon('mdi:delete-outline', 20))}</div>
            ${isOpen ? `${lab('Gangtid til første stopp (min) · tomt = stoppets gangtid', inp(`${dk}.alts.${i}.walk_min`, alt.walk_min, 'f.eks. 4', true))}
              ${(alt.legs || []).map((l, j) => `<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:8px;border-radius:12px;background:var(--ki-surface-3, #2f2f2f)">
                <span class="small" style="grid-column:1/-1;display:flex;align-items:center;gap:6px">Etappe ${j + 1}<span style="flex:1"></span>${b('rmleg', `${A} data-j="${j}"`, M.icon('mdi:close', 18))}</span>
                ${lab('Fra (stopp / sensor / NSR · «A / B» = begge)', inp(`${dk}.alts.${i}.legs.${j}.from`, l.from, 'Majorstuen'))}${lab('Til', inp(`${dk}.alts.${i}.legs.${j}.to`, l.to, 'Holbergs plass'))}
                ${lab('Linje(r) · tomt = alle som går', inp(`${dk}.alts.${i}.legs.${j}.lines`, l.lines, 'f.eks. 45', false, true))}
                <div class="f" style="padding:0"><label>Transportmiddel</label><select class="inp" data-trip="${dk}.alts.${i}.legs.${j}.mode">${MODE_OPTS.map(([v, t]) => `<option value="${v}" ${String(l.mode || '') === v ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
                ${lab('Reisetid (min) · bare uten Entur', inp(`${dk}.alts.${i}.legs.${j}.ride_min`, l.ride_min, 'fra Entur', true))}
              </div>`).join('')}
              ${b('addleg', A, `${M.icon('mdi:plus', 18)}Legg til etappe`, 'pill', 'align-self:flex-start;display:inline-flex;align-items:center;gap:4px')}` : ''}
          </div>`;
        }).join('')}
        ${b('addalt', `data-dir="${dk}"`, `${M.icon('mdi:plus', 18)}Legg til reise`, 'pill', 'align-self:flex-start;display:inline-flex;align-items:center;gap:4px')}</div>`;
    };
    return `${lab('Automatisk retningsbytte (klokkeslett)', inp('auto_switch', T.auto_switch, '12:00'))}${lab('Byttemargin (min)', inp('transfer_min', T.transfer_min, '2', true))}${dirHTML('school')}${dirHTML('home')}`;
  }
  function tripsEditorClick(d, ed) {
    const N = clone(M.ruterTrips(ed._config || {})), D = d.dir && N[d.dir], i = Number(d.i), L = D && D.alts;
    const id = `${d.dir}.${i}`;
    M.haptic('selection');
    switch (d.op) {
      case 'edit': ed.__ruterOpen = ed.__ruterOpen === id ? '' : id; return ed._render();
      case 'toggle': L[i].enabled = L[i].enabled === false; break;
      case 'up': case 'down': { const j = i + (d.op === 'up' ? -1 : 1); if (j < 0 || j >= L.length) return; [L[i], L[j]] = [L[j], L[i]]; if (ed.__ruterOpen === id) ed.__ruterOpen = `${d.dir}.${j}`; break; }
      case 'del': L.splice(i, 1); ed.__ruterOpen = ''; break;
      case 'addalt': L.push({ id: 'r' + Date.now().toString(36), enabled: true, legs: [{ from: '', to: '', lines: [], mode: '' }] }); ed.__ruterOpen = `${d.dir}.${L.length - 1}`; break;
      case 'addleg': { const g = L[i].legs; g.push({ from: (g[g.length - 1] || {}).to || '', to: '', lines: [], mode: '' }); break; }
      case 'rmleg': L[i].legs.splice(Number(d.j), 1); break;
      default: return;
    }
    ed._set('trips', N);
  }

  class Ruter extends M.Card {
    static get cardName() { return 'Ruter'; }
    static get defaults() { return { show_disruptions: true, hide_zero: false, planned: true, walk: true, realtime: true, sort: 'liste', hero: true, timeline: true, go_now: true, show_trips: true, platform: true, aimed: true, next: true, occupancy: true, updated: true }; }
    // Fiks 19.1 D: nytt kort får brukerens egne reiser (Til skolen / Hjem) – samme unntak som 17.9
    static getStubConfig() { return { card_id: M.uid(), ...this.defaults, trips: clone(STD_TRIPS) }; }
    static get schema() {
      return (h, c) => {
        let a;
        try { a = M.ruterAuto(h, c); } catch (e) { a = M.ruterAuto(null); }
        return [
          { type: 'lists', label: 'Stopp og avvikslinjer', lists: () => [
            { key: 'stopp', label: 'Stopp (entur_public_transport)', ids: a.autoStops, domains: ['sensor'] },
            { key: 'linjer', label: 'Avvikslinjer (entur_sx)', ids: a.lineAuto, domains: ['sensor', 'binary_sensor'] },
          ] },
          { type: 'order', name: 'stop_order', hiddenName: 'exclude', label: 'Rekkefølge på stopp', options: a.allStops.map((id) => [id, stopName(h, id, c)]) },
          { type: 'section', label: 'Stopp · navn, ikon, gangtid og linjer', icon: 'mdi:map-marker-outline', id: 'stops', fields: a.stops.length ? a.stops.map((id) => {
            const obj = id.split('.').slice(1).join('.'), deps = M.enturDepartures(h.states[id]);
            const avail = [...new Set(deps.map((d) => d.line))];
            const mm = modeOf((deps[0] || {}).mode);
            return { type: 'section', label: stopName(h, id, c), fields: [
              { type: 'info', label: id },
              { type: 'text', name: `stops.${obj}.name`, label: 'Navn', auto: () => String(M.name(h, id)).replace(/^entur\s+/i, '') },
              { type: 'icon', name: `stops.${obj}.icon`, label: 'Ikon', auto: () => M.iconName(mm ? mm[0] : (h.states[id].attributes.icon || 'directions_bus')) },
              { type: 'text', name: `stops.${obj}.walk`, label: 'Gangtid / tekst', placeholder: '4 min gange' },
              { type: 'number', name: `stops.${obj}.walk_min`, label: 'Gangtid (min) · tomt = tall fra teksten', min: 0, max: 60, placeholder: '4' },
              { type: 'text', name: `stops.${obj}.lines`, label: 'Linjer (line_whitelist) · tomt = alle', placeholder: avail.length ? 'Tilgjengelig: ' + avail.join(', ') : 'f.eks. 5, 19' },
              { type: 'number', name: `stops.${obj}.count`, label: 'Antall avganger', min: 1, max: 10, placeholder: '2' },
            ] };
          }) : [{ type: 'info', label: 'Autokonfig fant ingen stopp' }] },
          { type: 'overrides', label: 'Avvik (Entur SX)', fields: [{ name: 'avvik', label: 'Oppsummeringssensor', domain: ['sensor', 'binary_sensor'], platform: 'entur_sx', auto: () => a.autoSum }] },
          { type: 'section', label: 'Visning', icon: 'mdi:eye-outline', id: 'view', fields: [
            { type: 'boolean', name: 'hero', label: 'Toppkort · nedtelling til neste avgang du rekker', default: true },
            { type: 'select', name: 'hero_stop', label: 'Toppkort-stopp', options: [['', 'Automatisk (reise / første)'], ...a.stops.map((id) => [id, stopName(h, id, c)])], default: '' },
            { type: 'boolean', name: 'timeline', label: 'Tidslinje · neste 30 min', default: true },
            { type: 'boolean', name: 'go_now', label: '«Gå nå»-varsel', default: true },
            { type: 'boolean', name: 'show_trips', label: 'Reise · Til skolen / Hjem', default: true },
            { type: 'boolean', name: 'platform', label: 'Perrong / spor', default: true },
            { type: 'boolean', name: 'aimed', label: 'Forsinkelse og rutetid', default: true },
            { type: 'boolean', name: 'next', label: 'Neste etter («så 12 min»)', default: true },
            { type: 'boolean', name: 'occupancy', label: 'Belegg', default: true },
            { type: 'boolean', name: 'updated', label: 'Sist oppdatert', default: true },
            { type: 'boolean', name: 'show_disruptions', label: 'Vis avvikskort · rett under toppkortet', default: true },
            { type: 'boolean', name: 'hide_zero', label: 'Skjul når ingen avvik', default: false },
            { type: 'boolean', name: 'planned', label: 'Ta med planlagte avvik', default: true },
            { type: 'boolean', name: 'walk', label: 'Vis gangtid · teksten ved hvert stopp', default: true },
            { type: 'boolean', name: 'realtime', label: 'Vis sanntidsmerke', default: true },
            { type: 'select', name: 'sort', label: 'Sortering', options: [['liste', 'Min rekkefølge'], ['tid', 'Neste avgang']], default: 'liste' },
          ] },
          { type: 'section', label: 'Reiser · Til skolen / Hjem', icon: 'mdi:transit-transfer', id: 'trips', fields: [
            { type: 'html', html: tripsEditorHTML, click: tripsEditorClick },
          ] },
          { type: 'gap' },
        ];
      };
    }
    get cardSize() { return 8; }
    // Entur hentes bare mens popupen er åpen: ved åpning og deretter hvert 30. s (fallgruve 8)
    onOpen() {
      clearInterval(this._tick);
      this._tick = setInterval(() => { this._fetch(); this.update(); }, 30000);
      // Litt forsinket: kortet kobles til før Bubble Card har plassert det i popupen (kort «åpen» uten hash)
      clearTimeout(this._first); this._first = setTimeout(() => this._fetch(), 250);
    }
    onClose() {
      clearInterval(this._tick); this._tick = 0; clearTimeout(this._first);
      this._ui = { ...this._ui, dir: null, sel: null, open: {}, more: {}, trips: {}, heroAlt: null }; // nullstilles når popupen lukkes
    }
    async _fetch() {
      if (!this.isOpen || !this.hass || this._fetching || !M.isPopupOpen(this)) return;
      this._fetching = true;
      try {
        const r = await fetchRound(this);
        if (r.ok) { this._okAt = Date.now(); this._fail = false; } else if (r.fail) this._fail = true;
      } catch (e) { this._fail = true; this._lastErr = e && e.message; }
      finally { this._fetching = false; }
      if (this.isOpen) this.update();
    }
    _dirKey(T) { return this.ui.dir || autoDir(T); }
    _badge(line, kind, big, icon) {
      const m = modeOf(kind) || MODE.bus;
      return `<span class="badge" style="height:${big ? 28 : 26}px;border-radius:${String(kind).toLowerCase() === 'bus' || !modeOf(kind) ? 7 : 13}px;background:${m[1]}">${icon ? M.icon(m[0], 15) : ''}${esc(line)}</span>`;
    }
    _chip(ledig, cls = 'go') {
      if (this.config.go_now === false || ledig == null) return '';
      const [t, col] = goOf(ledig);
      return `<span class="${cls}" style="color:${ATP(col)};background:${TONE(col, 0.16)}">${M.icon('mdi:walk', 14)}${esc(t)}</span>`;
    }
    _occ(occ) {
      const l = OCC[occ];
      if (!l || this.config.occupancy === false) return '';
      const col = l === 1 ? C.green : l === 2 ? C.orange : C.red;
      return `<span class="occ" title="${OCC_L[l]}">${[6, 9, 12].map((hh, i) => `<i style="height:${hh}px;background:${i < l ? col : 'var(--ki-surface-3, rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.15*var(--ki-wa-k,1)),var(--ki-wa-max,1))))'}"></i>`).join('')}</span>`;
    }
    // Tid i radene: ≤ 1 min «Nå», under 20 min «18 min», ellers klokkeslett
    _tf(d) { const m = minTo(d.t); return m <= 1 ? 'Nå' : m < 20 ? `${m} min` : hm(d.t); }
    // «Spor 2 · 22:56 → 22:59 · så 12 min»
    _sub(d, all, withNext) {
      const c = this.config, p = [];
      if (c.platform !== false && d.plat) p.push(platL(d.plat));
      if (c.aimed !== false) p.push(d.aimed && Math.abs(d.aimed - d.t) >= 60000 ? `${hm(d.aimed)} → ${hm(d.t)}` : hm(d.t));
      if (withNext && c.next !== false) { const n = all.find((x) => x !== d && x.t > d.t && x.line === d.line && x.dest === d.dest); if (n) p.push(`så ${minTo(n.t)} min`); }
      return p.join(' · ');
    }
    _delay(d) { return this.config.aimed !== false && d.delay >= 1 ? `<span class="dly">+${d.delay} min</span>` : ''; }
    _row(d, all, withNext) {
      const c = this.config, m = minTo(d.t), sub = this._sub(d, all, withNext);
      return `<div class="dep" data-key="${esc(depKey(d))}">
        <div class="d1">${this._badge(d.line, d.mode || 'bus')}<span class="dest grow ell">${esc(d.dest)}</span>${this._occ(d.occ)}${c.realtime !== false && d.rt ? M.icon('sensors', 14, `color:${AT(C.green)}`) : ''}<span class="tm num" style="color:${m <= 2 ? AT(C.orange) : 'var(--ki-text, var(--white, #fafafa))'}">${esc(this._tf(d))}</span></div>
        ${sub || this._delay(d) ? `<div class="d2"><span class="grow ell num">${esc(sub)}</span>${this._delay(d)}</div>` : ''}
      </div>`;
    }
    // Sist oppdatert: Entur-hentingen, ellers sensorenes last_updated
    _updated(a) {
      if (this._okAt) return { t: this._okAt, src: 'Entur' };
      const lu = a.stops.map((id) => Date.parse((this.hass.states[id] || {}).last_updated || '')).filter((x) => !isNaN(x));
      return lu.length ? { t: Math.max(...lu), src: 'Entur-sensorene' } : null;
    }
    render() {
      const c = this.config, h = this.hass, a = M.ruterAuto(h, c), ui = this.ui;
      a.stops.forEach((id) => this.s(id));
      if (a.sum) this.s(a.sum);
      a.lines.forEach((id) => this.s(id));
      // stopp + avganger (Entur når hentet, ellers sensoren)
      const depModes = {};
      let stops = a.stops.map((id) => {
        const st = this.s(id), sc = stopCfg(c, id), wl = listOf(sc.lines), n = Math.max(1, Math.min(10, Number(sc.count) || 2));
        const sens = M.enturDepartures(st);
        sens.forEach((d) => { if (d.mode && !depModes[d.line]) depModes[d.line] = String(d.mode).toLowerCase(); });
        const ref = resolveStop(h, c, id, a.stops), src = depsFor(h, ref);
        const all = src.deps.filter((d) => !wl.length || wl.includes(d.line)).map((d) => ({ ...d, mode: d.mode || (sens[0] || {}).mode }));
        const walk = walkOf(sc) || 0, reach = all.filter((d) => minTo(d.t) >= walk);
        const mm = modeOf((sens[0] || all[0] || {}).mode);
        const icon = sc.icon || (mm ? mm[0] : st.attributes.icon || 'directions_bus');
        const wt = sc.walk || (M.isNum(sc.walk_min) ? `${sc.walk_min} min gange` : '');
        return { id, ref, name: stopName(h, id, c), icon, walkTxt: c.walk !== false ? wt : '', walk, all, reach, n, min: reach[0] ? minTo(reach[0].t) : 9999 };
      });
      if (c.sort === 'tid') stops = [...stops].sort((x, y) => x.min - y.min);
      // D · reiser i valgt retning, sortert etter tidligst fremme
      const T = M.ruterTrips(c), dk = this._dirKey(T);
      const plans = c.show_trips !== false ? T[dk].alts.filter((x) => x.enabled !== false && x.legs && x.legs.length).map((alt) => planAlt(h, c, alt, T, a.stops)).filter(Boolean)
        .sort((x, y) => (x.arrive == null) - (y.arrive == null) || (x.arrive || 0) - (y.arrive || 0) || (x.first ? x.first.t : 9e15) - (y.first ? y.first.t : 9e15)) : [];
      const upd = this._updated(a);
      const hero = c.hero !== false ? this._heroHTML(c, h, stops, plans, upd) : '';
      const trip = c.show_trips !== false ? this._tripHTML(T, dk, plans) : '';
      // avvik
      const sumSt = a.sum ? this.s(a.sum) : null;
      let items = [];
      if (sumSt) items = items.concat(sxItems(h, a.sum, depModes).filter((x) => !x.isLine || x.st));
      a.lines.forEach((id) => { items = items.concat(sxItems(h, id, depModes)); });
      const lineCount = a.lines.length;
      const active = items.filter((x) => x.st === 'open'), planned = items.filter((x) => x.st === 'planned');
      let cnt = active.length + (c.planned !== false ? planned.length : 0);
      if (!items.length && sumSt && M.isNum(sumSt.state)) cnt = Number(sumSt.state);
      const shownItems = items.filter((x) => x.st === 'open' || (c.planned !== false && x.st === 'planned'));
      const sumName = sumSt ? M.name(h, a.sum) : '';
      let dis = '';
      if (c.show_disruptions !== false && !(c.hide_zero && !cnt && a.sum)) {
        if (!a.sum && !lineCount) {
          dis = `<section class="dis"><button class="dh" data-act="customize" data-section="overrides">
            <span class="diw" style="background:var(--ki-surface-2, var(--gray300, #404040));color:var(--ki-text-mid, var(--gray700, #979797))">${M.icon('mdi:help-circle-outline', 24)}</span>
            <span class="grow col" style="gap:2px"><span class="dt">Avvik</span><span class="ds ell">Fant ingen avvikssensor (entur_sx) – trykk for å velge</span></span>
          </button></section>`;
        } else {
          const open = !!ui.disOpen && shownItems.length > 0;
          dis = `<section class="dis" style="background:${cnt ? TONE(C.orange, 0.12) : 'var(--ki-surface, var(--gray200, #3a3a3a))'};box-shadow:${cnt ? `inset 0 0 0 1px ${M.alpha(C.orange, 0.35)}` : 'none'}">
            <button class="dh" data-act="dis" ${a.sum ? `data-ent="${esc(a.sum)}"` : ''} data-haptic="selection">
              <span class="diw" style="background:${cnt ? M.alpha(C.orange, 0.25) : M.alpha(C.green, 0.2)};color:${cnt ? AT(C.orange) : AT(C.green)}">${M.icon(cnt ? 'warning' : 'check_circle', 24)}</span>
              <span class="grow col" style="gap:2px"><span class="dt">${cnt ? `${cnt} avvik på dine linjer` : 'Ingen avvik'}</span><span class="ds ell">${esc(cnt ? `${active.length} aktive${c.planned !== false ? ` · ${planned.length} planlagte` : ''}${sumName ? ' · ' + sumName : ''}` : lineCount ? `Alle ${lineCount} linjer går som normalt` : sumName ? `${sumName} · alt går som normalt` : 'Alt går som normalt')}</span></span>
              ${shownItems.length ? M.icon('expand_more', 22, `color:var(--ki-text-2, var(--gray800, #afafaf));transition:transform .2s;transform:${open ? 'rotate(180deg)' : 'none'}`) : ''}
            </button>
            ${open ? `<div class="dl">${shownItems.map((x) => {
              const xo = ui.xOpen === x.key, act = x.st === 'open';
              return `<button class="dx" data-act="dx" data-k="${esc(x.key)}" data-ent="${esc(x.ent)}" data-key="${esc(x.key)}" data-haptic="selection">
                <span class="row" style="gap:10px;width:100%">${this._badge(x.line, x.kind, true, true)}<span class="grow ell" style="font-size:13px;font-weight:500">${esc(x.sum)}</span><span class="stc" style="background:${act ? M.alpha(C.red, 0.2) : M.alpha(C.blue, 0.2)};color:${act ? AT(C.red) : AT(C.blue)}">${act ? 'Aktiv' : 'Planlagt'}</span></span>
                ${xo ? `${x.desc ? `<span class="dd">${esc(x.desc)}</span>` : ''}${x.from || x.to ? `<span class="dw">${esc(`Fra: ${fmtWhen(x.from)}${x.to ? ` · Til: ${fmtWhen(x.to)}` : ''}`)}</span>` : ''}` : ''}
              </button>`;
            }).join('')}</div>` : ''}
          </section>`;
        }
      }
      // 20.11: tannhjulet i toppkortet er eneste Tilpass-inngang – «Tilpass» her bare når toppkortet er av
      const hdr = `<div class="hdr"><span class="cap">Avganger</span>${c.hero === false ? `<button class="ed press" data-act="customize" data-section="stops" title="Tilpass">${M.icon('settings', 18)}Tilpass</button>` : ''}</div>`;
      const body = stops.length ? stops.map((s) => this._stopHTML(s)).join('') : this._empty();
      let foot = '';
      if (c.updated !== false && upd) {
        const old = Date.now() - upd.t > 120000;
        foot = `<div class="upd" data-key="upd"><i style="background:${old ? C.orange : C.green}"></i><span class="num">${esc(old ? `Ikke oppdatert siden ${hm(upd.t)}` : `Sanntid fra ${upd.src} · oppdatert ${hms(upd.t)}`)}</span></div>`;
      }
      // Rekkefølge (19.1): toppkort → avvik → Reise → avganger → sist oppdatert
      return `<div class="wrap">${hero}${dis}${trip}${hdr}${body}${foot}</div>`;
    }
    // A · toppkort: neste avgang du rekker (gangtid), «Gå nå», tidslinje for de neste 30 min
    _heroHTML(c, h, stops, plans, upd) {
      let name = '', deps = [], walk = 0;
      // «Vis i toppkortet» (20.11) går foran toppkort-stoppet fra Tilpass
      const ha = this.ui.heroAlt ? plans.find((p) => altKey(p) === this.ui.heroAlt && p.fromRef && p.first) : null;
      const hs = !ha && c.hero_stop && stops.find((s) => s.id === c.hero_stop);
      const p0 = ha || (!hs && plans.find((p) => p.fromRef && p.first));
      if (hs) { name = hs.name; deps = hs.all; walk = hs.walk; }
      else if (p0) {
        const leg = p0.alt.legs[0], sc = p0.fromRef.sensor ? stopCfg(c, p0.fromRef.sensor) : {}, wl = listOf(sc.lines);
        name = p0.fromRef.sensor ? stopName(h, p0.fromRef.sensor, c) : p0.fromRef.name; walk = p0.walk;
        deps = depsFor(h, p0.fromRef).deps.filter((d) => lineOk(leg, d) && (!wl.length || wl.includes(d.line)));
        if (!deps.length) deps = [p0.first];
      } else if (stops[0]) { name = stops[0].name; deps = stops[0].all; walk = stops[0].walk; }
      deps = deps.filter((d) => minTo(d.t) >= 0);
      const reach = deps.find((d) => minTo(d.t) >= walk) || null;
      let selD = this.ui.sel ? deps.find((d) => depKey(d) === this.ui.sel) : null;
      if (!selD && ha) { selD = deps.find((x) => x.line === ha.first.line && Math.abs(x.t - ha.first.t) < 90000) || ha.first; if (!deps.includes(selD)) deps = [...deps, selD].sort((x, y) => x.t - y.t); }
      const d = selD || reach;
      const m = d ? minTo(d.t) : null;
      const info = d ? [c.platform !== false && d.plat ? platL(d.plat) : '', c.aimed !== false ? (d.aimed && Math.abs(d.aimed - d.t) >= 60000 ? `${hm(d.aimed)} → ${hm(d.t)}` : hm(d.t)) : '', c.occupancy !== false && OCC[d.occ] ? OCC_L[OCC[d.occ]] : ''].filter(Boolean).join(' · ') : '';
      let tl = '';
      if (c.timeline !== false) {
        const P = (x) => `${(M.clamp(x / 30, 0, 1) * 100).toFixed(2)}%`;
        let prev = -99;
        const dots = deps.filter((x) => minTo(x.t) <= 30).map((x) => {
          const xm = (x.t - Date.now()) / 60000, on = d && depKey(x) === depKey(d), col = (modeOf(x.mode) || MODE.bus)[1];
          const lab = xm - prev >= 2.5; prev = xm;
          return `<button class="tdot${on ? ' on' : ''}" data-act="dot" data-k="${esc(depKey(x))}" data-key="t${esc(depKey(x))}" data-haptic="light" style="left:${P(xm)}" title="${esc(`${x.line} ${x.dest} · ${hm(x.t)}`)}">${lab ? `<span class="tn">${esc(x.line)}</span>` : ''}<i style="background:${col}"></i></button>`;
        }).join('');
        const go = d ? (d.t - Date.now()) / 60000 - walk : null;
        tl = `<div class="tl" data-key="tl"><div class="tli">
          <span class="tax"></span>${walk > 0 ? `<span class="twalk" style="width:${P(walk)}"></span>` : ''}
          ${go != null && go >= 0 && go <= 30 ? `<span class="tgo" style="left:${P(go)}"></span>` : ''}
          ${dots}
          ${[0, 10, 20, 30].map((v) => `<span class="ttk" style="left:${P(v)}">${v ? (v === 30 ? '30 min' : v) : 'nå'}</span>`).join('')}
        </div></div>`;
      }
      return `<section class="hero" data-key="hero">
        <div class="htop"><span class="hname ell">${esc(name || 'Ruter')}</span>${d ? this._chip(m - walk, 'go') : ''}</div>
        <button class="hset press" data-act="customize" data-section="view" title="Tilpass">${M.icon('mdi:cog', 22)}</button>
        <div class="hval">
          <span class="hbig num">${m == null ? '–' : m <= 1 ? 'Nå' : `${m}<small>min</small>`}</span>
          ${d ? `<span class="hinfo"><span class="row" style="gap:8px;min-width:0">${this._badge(d.line, d.mode || 'bus')}<span class="hdest ell">${esc(d.dest)}</span>${this._delay(d)}</span>${info ? `<span class="hsub ell num">${esc(info)}</span>` : ''}</span>` : `<span class="hinfo"><span class="hsub">${esc(name ? 'Ingen avganger funnet' : 'Velg stopp i Rediger')}</span></span>`}
        </div>
        <button class="hlab" data-act="herosel" data-haptic="light">${M.icon('sensors', 14, `color:${d && d.rt ? AT(C.green) : 'inherit'}`)}<span class="ell">${esc(`${selD ? 'Valgt avgang' : 'Neste du rekker'}${upd ? ` · oppdatert ${hm(upd.t)}` : ''}`)}</span></button>
        ${tl}
      </section>`;
    }
    // D · Reise: segment Til skolen · Hjem + ett kort per alternativ (raskest først)
    _tripHTML(T, dk, plans) {
      if (!T.school.alts.length && !T.home.alts.length) return '';
      const seg = ['school', 'home'].map((k) => `<button class="sg${k === dk ? ' on' : ''}" data-act="dir" data-v="${k}" aria-pressed="${k === dk}" data-haptic="selection">${esc(T[k].name)}</button>`).join('');
      const cards = plans.map((p, i) => {
        const fast = i === 0 && p.arrive != null, k = altKey(p, i), open = !!(this.ui.trips || {})[k];
        const badges = p.alt.legs.map((leg, j) => { const x = p.legs[j] && p.legs[j].c; return this._badge(x ? x.line : listOf(leg.lines)[0] || '?', (x && x.mode) || leg.mode || 'bus'); }).join('<span class="sep">›</span>');
        const txt = [];
        if (p.first) txt.push(`${p.fromRef ? p.fromRef.name : fromNames(p.alt.legs[0].from)[0]} ${hm(p.first.t)}`);
        p.legs.slice(1).forEach((l, j) => { const prev = p.legs[j].c, w = l.c && prev && prev.arr != null ? Math.round((l.c.t - prev.arr) / 60000) : null; txt.push(`bytte ${l.from ? l.from.name : l.leg.from}${w != null ? ` (${w} min)` : ''}`); });
        txt.push(`til ${p.alt.legs[p.alt.legs.length - 1].to}`);
        const ledig = p.first ? minTo(p.first.t) - p.walk : null;
        return `<div class="alt${fast ? ' fast' : ''}" role="button" tabindex="0" aria-expanded="${open}" data-act="trip" data-k="${esc(k)}" data-haptic="light" data-key="alt-${esc(k)}">
          <div class="row" style="gap:8px"><span class="row grow" style="gap:4px;min-width:0;flex-wrap:wrap">${badges}${fast ? '<span class="rk">Raskest</span>' : ''}</span>
            <span class="col" style="align-items:flex-end;flex:none"><span class="atot num">${p.total != null ? `${p.total} min` : '–'}</span><span class="aarr num">${p.arrive != null ? `fremme ${hm(p.arrive)}` : p.first ? `går ${hm(p.first.t)}` : 'Ingen avgang funnet'}</span></span>
            ${M.icon('expand_more', 22, `color:var(--ki-text-2, var(--gray800, #afafaf));flex:none;transition:transform .2s;transform:${open ? 'rotate(180deg)' : 'none'}`)}</div>
          <div class="row" style="gap:8px"><span class="atxt grow ell num">${esc(p.first ? txt.join(' · ') : txt.slice(-1).join(''))}</span>${ledig != null ? this._chip(ledig, 'go') : ''}</div>
          ${open ? this._planHTML(p, T, k) : ''}
        </div>`;
      }).join('');
      return `<section class="trip" data-key="trip"><div class="thd"><span class="cap">Reise</span><div class="seg">${seg}</div></div>${cards || '<span class="none">Ingen reiser er slått på – se Tilpass → Reiser</span>'}</section>`;
    }
    // 20.11 · åpen reise = vertikal reiseplan (rutenett 44px 22px 1fr: klokkeslett · skinne med node · tekst)
    _planHTML(p, T, k) {
      const c = this.config, h = this.hass, rows = [], GR = 'var(--gray500, #696969)';
      // Mangler perrong/belegg i reisen: hent fra stoppets avganger (samme linje, samme minutt)
      const fill = (L, x) => {
        if (!x || (x.plat && x.occ)) return x;
        const m = depsFor(h, L.from).deps.find((d) => d.line === x.line && Math.abs(d.t - x.t) < 90000);
        return m ? { ...x, plat: x.plat || m.plat, occ: x.occ || m.occ } : x;
      };
      // node: ['dot', farge] | ['ic', ikon, farge] ; rail: null | [farge, stiplet]
      const step = (time, node, rail, title, sub, cls) => rows.push(`<div class="ps${cls ? ' ' + cls : ''}"><span class="pt num">${esc(time || '')}</span>
        <span class="pr">${rail ? `<b class="pl${rail[1] ? ' dash' : ''}" style="${rail[1] ? `border-color:${rail[0]}` : `background:${rail[0]}`}"></b>` : ''}${node[0] === 'dot' ? `<i class="pn" style="background:${node[1]}"></i>` : `<i class="pn ic" style="background:${node[2] || 'var(--ki-surface-2, var(--gray300, #404040))'};color:${node[3] || 'var(--ki-text-1, var(--gray900, #c7c7c7))'}">${M.icon(node[1], 13)}</i>`}</span>
        <span class="pb"><span class="ptl">${title}</span>${sub ? `<span class="psb num">${sub}</span>` : ''}</span></div>`);
      const nm = (L, fb) => esc((L && L.name) || fb || '');
      if (p.first) {
        const walk = p.walk || 0, go = goOf(minTo(p.first.t) - walk);
        step(p.goAt != null ? hm(p.goAt) : '', ['ic', 'directions_walk'], [GR, true], `Gå til ${nm(p.legs[0].from, fromNames(p.alt.legs[0].from)[0])}`,
          esc([walk > 0 ? `${walk} min gange` : '', go[0]].filter(Boolean).join(' · ')), 'walk');
      }
      for (let j = 0; j < p.legs.length; j++) {
        const L = p.legs[j], x = fill(L, L.c), leg = L.leg, col = (modeOf((x && x.mode) || leg.mode) || MODE.bus)[1];
        const badge = this._badge(x ? x.line : listOf(leg.lines)[0] || '?', (x && x.mode) || leg.mode || 'bus');
        if (!x) { step('–', ['dot', GR], null, `${badge}<span class="ell">${nm(L.from, leg.from)}</span>`, 'Ingen avgang funnet', 'leg'); break; }
        const sub = [c.platform !== false && x.plat ? platL(x.plat) : '', x.dest ? `mot ${x.dest}` : '', x.arr != null ? `${Math.max(1, Math.round((x.arr - x.t) / 60000))} min` : '', c.occupancy !== false && OCC[x.occ] ? OCC_L[OCC[x.occ]] : ''].filter(Boolean);
        step(hm(x.t), ['dot', col], [col, false], `${badge}<span class="ell">${nm(L.from, leg.from)}</span>`, `${esc(sub.join(' · '))}${this._delay(x)}`, 'leg');
        const N = p.legs[j + 1];
        if (N) {
          const nx = fill(N, N.c), w = nx && x.arr != null ? Math.round((nx.t - x.arr) / 60000) : null, kort = w != null && w < T.transfer_min;
          const s2 = [w != null ? `${kort ? 'Kort bytte · ' : ''}${w} min til neste` : '', c.platform !== false && nx && nx.plat ? platL(nx.plat) : ''].filter(Boolean).join(' · ');
          step(x.arr != null ? hm(x.arr) : '', ['ic', 'mdi:transit-transfer'], [GR, true], `Bytte på ${nm(N.from, N.leg.from)}`, s2 ? `<span style="${kort ? `color:${AT(C.orange)}` : ''}">${esc(s2)}</span>` : '', 'swap');
        }
      }
      if (p.arrive != null) step(hm(p.arrive), ['ic', 'flag', C.green, 'var(--ki-on-accent, var(--gray200, #3a3a3a))'], null, esc(p.alt.legs[p.alt.legs.length - 1].to || 'Fremme'), esc(`Fremme${p.total != null ? ` · ${p.total} min totalt` : ''}`), 'end');
      // Neste mulighet: neste avganger på første etappe etter den valgte
      const L0 = p.legs[0], nxt = p.first && L0 && L0.all ? L0.all.filter((x) => x.t > p.first.t + 30000).slice(0, 2) : [];
      const more = nxt.length ? `Neste mulighet: ${nxt[0].line} kl ${hm(nxt[0].t)}${nxt[1] ? ` · deretter ${hm(nxt[1].t)}` : ''}` : '';
      return `<div class="plan" data-act="plan" data-haptic="off" data-key="plan-${esc(k)}"><div class="pgrid">${rows.join('')}</div>
        <div class="pft"><span class="pnx grow ell num">${esc(more)}</span>${p.first && p.fromRef ? `<button class="pv press" data-act="tripHero" data-k="${esc(k)}" data-haptic="light">${M.icon('mdi:arrow-collapse-up', 16)}Vis i toppkortet</button>` : ''}</div></div>`;
    }
    // C · ett stopp som nedtrekksliste: lukket = neste avgang + «så …», åpen = «Neste avgang» + «Senere» + «Vis flere»
    _stopHTML(s) {
      const c = this.config, open = !!(this.ui.open || {})[s.id], more = !!(this.ui.more || {})[s.id];
      const nx = s.reach[0] || null, later = nx ? s.reach.slice(1) : [];
      const nm = nx ? minTo(nx.t) : null;
      let inner = '';
      if (!nx) inner = '<span class="none">Ingen avganger for valgte linjer</span>';
      else if (!open) {
        const so = c.next !== false && later.length ? `så ${later.slice(0, 3).map((x) => this._tf(x)).join(', ')}` : '';
        const sub = [c.platform !== false && nx.plat ? platL(nx.plat) : '', hm(nx.t), so].filter(Boolean).join(' · ');
        inner = `<div class="d1">${this._badge(nx.line, nx.mode || 'bus')}<span class="dest grow ell">${esc(nx.dest)}</span>${this._occ(nx.occ)}${c.realtime !== false && nx.rt ? M.icon('sensors', 14, `color:${AT(C.green)}`) : ''}<span class="tm num" style="color:${nm <= 2 ? AT(C.orange) : 'var(--ki-text, var(--white, #fafafa))'}">${esc(this._tf(nx))}</span></div>
          <span class="csub ell num">${esc(sub)}</span>`;
      } else {
        const base = Math.max(3, s.n), hour = later.filter((x) => minTo(x.t) <= 60).slice(0, 14);
        const shown = more ? hour : later.slice(0, base), extra = Math.max(0, hour.length - base);
        inner = `<div class="nx">
            <div class="row" style="gap:8px">${this._badge(nx.line, nx.mode || 'bus')}<span class="nxk">NESTE AVGANG</span></div>
            <div class="row" style="gap:10px;align-items:flex-end"><span class="col grow" style="gap:3px;min-width:0"><span class="nxd ell">${esc(nx.dest)}</span><span class="nxs ell num">${esc(this._sub(nx, s.all, true))}</span></span>
              <span class="col" style="align-items:flex-end;flex:none;gap:2px"><span class="nxm num" style="color:${nm <= 2 ? AT(C.orange) : 'var(--ki-text, var(--white, #fafafa))'}">${nm <= 1 ? 'Nå' : nm >= 60 ? hm(nx.t) : `${nm}<small>min</small>`}</span>
              <span class="row" style="gap:6px">${c.realtime !== false && nx.rt ? M.icon('sensors', 14, `color:${AT(C.green)}`) : ''}${this._occ(nx.occ)}${this._delay(nx)}</span></span></div>
          </div>
          ${shown.length ? `<span class="lk">${more ? 'Senere · neste time' : 'Senere'}</span>${shown.map((x) => this._row(x, s.all, false)).join('')}` : ''}
          ${extra > 0 || more ? `<button class="vm press" data-act="more" data-k="${esc(s.id)}">${esc(more ? 'Vis færre' : `Vis ${extra} flere`)}</button>` : ''}`;
      }
      const ledig = nx ? nm - s.walk : null;
      return `<div class="stop" role="button" tabindex="0" aria-expanded="${open}" data-act="stop" data-k="${esc(s.id)}" data-key="${esc(s.id)}" data-haptic="light">
          <div class="sh" data-ent="${esc(s.id)}">${M.icon(s.icon, 20, 'color:var(--ki-text-2, var(--gray800, #afafaf))')}<span class="sn grow ell">${esc(s.name)}</span>${s.walkTxt ? `<span class="sw">${esc(s.walkTxt)}</span>` : ''}${nx ? this._chip(ledig, 'go') : ''}${M.icon('expand_more', 22, `color:var(--ki-text-2, var(--gray800, #afafaf));transition:transform .2s;transform:${open ? 'rotate(180deg)' : 'none'}`)}</div>
          ${inner}
        </div>`;
    }
    // Tom-tilstand (ingen entur-stopp): popupen vises alltid, med «Legg til stopp» via felles entitetssøk
    _empty() {
      const pk = M.entityPicker ? M.entityPicker.html({ key: 'pk-addstop', mode: 'add', domains: 'sensor', placeholder: 'Legg til stopp', attrs: 'data-addstop="1"' }) : '';
      return `<div class="nostop" data-key="nostop">
        <span class="nsi">${M.icon('mdi:bus-stop', 26)}</span>
        <span class="nst">Ingen stoppesteder funnet</span>
        <span class="nss">Fant ingen stopp fra Entur-integrasjonen (entur_public_transport). Legg til en avgangssensor, eller installer Entur-integrasjonen.</span>
        ${pk ? `<div class="nsp">${pk}</div>` : `<button class="pick press" data-act="customize" data-section="stops">${M.icon('mdi:plus', 18)}Legg til stopp</button>`}
      </div>`;
    }
    afterRender() {
      // Tidslinjen: trykk på prikkene skal ikke starte Bubble Cards sveip/lukking (fallgruve 2)
      const tl = this.shadowRoot && this.shadowRoot.querySelector('.tl');
      if (tl && !tl.__guard) { tl.__guard = true; ['pointerdown', 'touchstart', 'touchmove'].forEach((ev) => tl.addEventListener(ev, (e) => e.stopPropagation(), { passive: true })); }
      const pk = this.shadowRoot && this.shadowRoot.querySelector('msh-entity-picker[data-addstop]');
      if (!pk) return;
      if (this.hass && pk.hass !== this.hass) pk.hass = this.hass;
      if (pk.__ruter) return;
      pk.__ruter = true;
      pk.addEventListener('value-changed', (e) => { e.stopPropagation(); this._addStop(e.detail && e.detail.value); });
    }
    // Legg til stopp: include.stopp (+ fjern fra exclude) og legg sist i rekkefølgen – lagres i kortets config (ki-store)
    async _addStop(id) {
      if (!id) return;
      const old = this._rawConfig || this.config, inc = { ...(old.include || {}) };
      inc.stopp = [...new Set([...(inc.stopp || []), id])];
      const n = { ...old, include: inc, exclude: (old.exclude || []).filter((x) => x !== id) };
      if (Array.isArray(old.stop_order)) n.stop_order = [...old.stop_order.filter((x) => x !== id), id];
      this.setConfig(n);
      try { const r = await M.saveCardConfig(this.hass, old, n, { card: this }); if (r && r.config) this.setConfig(r.config); } catch (e) { console.warn('[ki-msh] Ruter', e); }
    }
    onAction(name, el, ev) {
      if (name === 'dis') return this.setUI({ disOpen: !this.ui.disOpen });
      if (name === 'dx') return this.setUI({ xOpen: this.ui.xOpen === el.dataset.k ? null : el.dataset.k });
      if (name === 'dot') { if (ev) ev.stopPropagation(); return this.setUI({ sel: el.dataset.k }); }
      if (name === 'herosel') return this.ui.sel || this.ui.heroAlt ? this.setUI({ sel: null, heroAlt: null }) : undefined;
      if (name === 'dir') { this.setUI({ dir: el.dataset.v, sel: null }); return this._fetch(); }
      if (name === 'plan') return undefined; // trykk i reiseplanen lukker ikke kortet
      if (name === 'trip') { const o = { ...(this.ui.trips || {}) }; o[el.dataset.k] = !o[el.dataset.k]; return this.setUI({ trips: o }); }
      if (name === 'tripHero') {
        if (ev) ev.stopPropagation();
        this.setUI({ heroAlt: el.dataset.k, sel: null });
        const hero = this.shadowRoot && this.shadowRoot.querySelector('.hero');
        if (hero && hero.scrollIntoView) try { hero.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (e) { /* */ }
        return undefined;
      }
      if (name === 'stop') { const o = { ...(this.ui.open || {}) }; o[el.dataset.k] = !o[el.dataset.k]; return this.setUI({ open: o }); }
      if (name === 'more') { if (ev) ev.stopPropagation(); const o = { ...(this.ui.more || {}) }; o[el.dataset.k] = !o[el.dataset.k]; return this.setUI({ more: o }); }
      return super.onAction(name, el, ev);
    }
    get styles() {
      return `
        .wrap{display:flex;flex-direction:column;gap:var(--msh-gap, 14px)}
        .hero{position:relative;height:184px;border-radius:28px;background:var(--ki-surface, var(--gray200,#3a3a3a));box-shadow:inset 0 0 0 1px ${WA(0.05)};overflow:hidden;width:100%;flex:none}
        .htop{position:absolute;left:18px;top:18px;right:78px;display:flex;align-items:center;gap:8px;min-width:0}
        .hname{font-size:13px;color:var(--ki-text-2, var(--gray800,#afafaf));min-width:0}
        .go{flex:none;display:inline-flex;align-items:center;gap:3px;height:22px;padding:0 8px 0 6px;border-radius:11px;font-size:11px;font-weight:600;white-space:nowrap}
        .hset{position:absolute;right:16px;top:16px;width:44px;height:44px;border-radius:22px;background:${WA(0.1)};display:grid;place-items:center;color:var(--ki-text, var(--white,#fafafa))}
        .hval{position:absolute;left:18px;right:18px;top:50px;display:flex;align-items:flex-start;gap:14px;min-width:0}
        .hbig{flex:none;font-size:44px;font-weight:300;line-height:1;letter-spacing:-0.02em}
        .hbig small{font-size:22px;margin-left:3px;color:var(--ki-text-1, var(--gray900,#c7c7c7))}
        .hinfo{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px;padding-top:3px}
        .hdest{font-size:15px;font-weight:500;min-width:0}
        .hsub{font-size:12px;color:var(--ki-text-mid, var(--gray700,#979797))}
        .hlab{position:absolute;left:18px;right:18px;top:104px;display:flex;align-items:center;gap:5px;font-size:12px;color:var(--ki-text-3, var(--gray600,#7f7f7f));text-align:left;min-width:0}
        .tl{position:absolute;left:0;right:0;bottom:0;height:62px;touch-action:pan-y}
        .tli{position:absolute;left:18px;right:18px;top:0;bottom:0}
        .tax{position:absolute;left:0;right:0;top:30px;height:2px;border-radius:1px;background:var(--ki-surface-3, rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.1*var(--ki-wa-k,1)),var(--ki-wa-max,1))))}
        .twalk{position:absolute;left:0;top:28px;height:6px;border-radius:3px;background:${M.alpha(C.green, 0.45)}}
        .tgo{position:absolute;top:6px;height:34px;width:0;border-left:1.5px dashed var(--ki-text-2, rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.55*var(--ki-wa-k,1)),var(--ki-wa-max,1))));transform:translateX(-0.75px)}
        .tdot{position:absolute;top:8px;width:28px;height:34px;margin-left:-14px;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding:0 0 3px;-webkit-tap-highlight-color:transparent}
        .tdot i{display:block;width:10px;height:10px;border-radius:50%;flex:none}
        .tdot.on i{width:14px;height:14px;box-shadow:0 0 0 2px var(--ki-text, var(--white,#fafafa));margin-bottom:-2px}
        .tn{position:absolute;top:0;font-size:10px;font-weight:600;color:var(--ki-text-1, var(--gray900,#c7c7c7));white-space:nowrap}
        .ttk{position:absolute;bottom:6px;transform:translateX(-50%);font-size:10px;color:var(--ki-text-3, var(--gray600,#7f7f7f));white-space:nowrap}
        .ttk:first-of-type{transform:none}
        .ttk:last-child{transform:translateX(-100%)}
        .dis{display:flex;flex-direction:column;gap:10px;padding:10px 12px 10px 10px;border-radius:30px;background:var(--ki-surface, var(--gray200,#3a3a3a))}
        .dh{display:flex;align-items:center;gap:12px;width:100%;text-align:left}
        .diw{width:52px;height:52px;border-radius:26px;flex:none;display:grid;place-items:center}
        .dt{font-size:15px;font-weight:600}
        .ds{font-size:12px;color:var(--ki-text-2, var(--gray800,#afafaf))}
        .dl{display:flex;flex-direction:column;gap:6px}
        .dx{display:flex;flex-direction:column;gap:8px;padding:12px;border-radius:18px;background:${KA(0.18)};text-align:left;width:100%}
        .stc{flex:none;font-size:11px;font-weight:600;padding:4px 9px;border-radius:10px}
        .dd{font-size:13px;color:var(--ki-text-1, var(--gray900,#c7c7c7));line-height:1.45;text-wrap:pretty}
        .dw{font-size:11px;color:var(--ki-text-mid, var(--gray700,#979797))}
        .badge{display:inline-flex;align-items:center;justify-content:center;gap:3px;min-width:30px;padding:0 8px;font-size:13px;font-weight:700;color:var(--ki-text, #fff);flex:none;white-space:nowrap}
        .trip{display:flex;flex-direction:column;gap:8px}
        .thd{display:flex;align-items:center;gap:10px;padding:4px 4px 0}
        .seg{display:flex;gap:2px;padding:3px;border-radius:17px;background:var(--ki-surface, var(--gray200,#3a3a3a))}
        .sg{height:30px;padding:0 12px;border-radius:14px;font-size:12px;font-weight:500;white-space:nowrap;color:var(--ki-text-2, var(--gray800,#afafaf))}
        .sg.on{background:${C.accent};color:var(--ki-on-accent, var(--gray200,#3a3a3a))}
        .alt{display:flex;flex-direction:column;gap:8px;padding:12px 14px;border-radius:22px;background:var(--ki-surface, var(--gray200,#3a3a3a))}
        .alt.fast{box-shadow:inset 0 0 0 1.5px ${M.alpha(C.green, 0.7)}}
        .alt{cursor:pointer;-webkit-tap-highlight-color:transparent;outline:none}
        .alt:focus-visible{box-shadow:0 0 0 2px var(--ki-text-3, var(--gray600,#7f7f7f))}
        .plan{display:flex;flex-direction:column;gap:10px;margin-top:4px;padding-top:12px;border-top:1px solid ${WA(0.08)};cursor:default}
        .pgrid{display:flex;flex-direction:column}
        .ps{display:grid;grid-template-columns:44px 22px minmax(0,1fr);column-gap:8px;min-height:46px}
        .ps.end{min-height:0}
        .pt{font-size:13px;font-weight:500;padding-top:2px;font-variant-numeric:tabular-nums;color:var(--ki-text-1, var(--gray900,#c7c7c7))}
        .pr{position:relative}
        .pn{position:absolute;left:5px;top:4px;width:12px;height:12px;border-radius:50%;z-index:1}
        .pn.ic{left:1px;top:0;width:20px;height:20px;display:grid;place-items:center}
        .pl{position:absolute;left:10px;top:12px;bottom:-4px;width:2px;border-radius:1px}
        .pl.dash{width:0;background:none;border-left:2px dashed}
        .pb{display:flex;flex-direction:column;gap:3px;min-width:0;padding:1px 0 12px}
        .ptl{display:flex;align-items:center;gap:8px;min-width:0;font-size:14px;font-weight:500}
        .psb{font-size:12px;color:var(--ki-text-mid, var(--gray700,#979797));display:flex;flex-wrap:wrap;gap:0 8px}
        .ps.walk .ptl,.ps.swap .ptl{font-weight:400;color:var(--ki-text-1, var(--gray900,#c7c7c7))}
        .pft{display:flex;align-items:center;gap:8px;min-width:0}
        .pnx{font-size:12px;color:var(--ki-text-mid, var(--gray700,#979797))}
        .pv{flex:none;height:34px;padding:0 12px 0 10px;border-radius:17px;background:var(--ki-surface-2, var(--gray300,#404040));display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:500;color:var(--ki-text-1, var(--gray1000,#e1e1e1))}
        .sep{color:var(--ki-text-3, var(--gray600,#7f7f7f));font-size:14px}
        .rk{margin-left:4px;font-size:11px;font-weight:600;padding:3px 8px;border-radius:10px;color:${ATP(C.green)};background:${TONE(C.green, 0.16)}}
        .atot{font-size:17px;font-weight:600}
        .aarr{font-size:11px;color:var(--ki-text-mid, var(--gray700,#979797))}
        .atxt{font-size:12px;color:var(--ki-text-mid, var(--gray700,#979797))}
        .hdr{display:flex;align-items:center;gap:10px;padding:4px 4px 0}
        .cap{flex:1;font-size:12px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;color:var(--ki-text-3, var(--gray600,#7f7f7f))}
        .ed{height:36px;padding:0 12px 0 10px;border-radius:18px;background:var(--ki-surface, var(--gray200,#3a3a3a));display:flex;align-items:center;gap:6px;font-size:13px;color:var(--ki-text-1, var(--gray900,#c7c7c7))}
        .stop{display:flex;flex-direction:column;gap:10px;padding:14px 16px;border-radius:24px;background:var(--ki-surface, var(--gray200,#3a3a3a));cursor:pointer;-webkit-tap-highlight-color:transparent;outline:none}
        .stop:focus-visible{box-shadow:0 0 0 2px var(--ki-text-3, var(--gray600,#7f7f7f))}
        .sh{display:flex;align-items:center;gap:8px;min-width:0}
        .sn{font-size:15px;font-weight:600}
        .sw{font-size:12px;color:var(--ki-text-3, var(--gray600,#7f7f7f));white-space:nowrap;flex:none}
        .dep{display:flex;flex-direction:column;gap:3px}
        .d1{display:flex;align-items:center;gap:10px;min-width:0}
        .d2{display:flex;align-items:center;gap:8px;padding-left:40px;font-size:11px;color:var(--ki-text-3, var(--gray600,#7f7f7f));min-width:0}
        .csub{font-size:11px;color:var(--ki-text-3, var(--gray600,#7f7f7f));margin-top:-6px}
        .dly{flex:none;font-size:11px;font-weight:600;color:${AT(C.orange)};white-space:nowrap}
        .occ{display:inline-flex;align-items:flex-end;gap:2px;height:12px;flex:none}
        .occ i{display:block;width:3px;border-radius:1px}
        .dest{font-size:14px}
        .tm{font-size:14px;font-weight:600;white-space:nowrap;min-width:48px;text-align:right}
        .nx{display:flex;flex-direction:column;gap:8px;padding:12px 14px;border-radius:18px;background:var(--ki-surface-2, var(--gray300,#404040))}
        .nxk{font-size:11px;font-weight:600;letter-spacing:0.06em;color:var(--ki-text-mid, var(--gray700,#979797))}
        .nxd{font-size:15px;font-weight:500}
        .nxs{font-size:11px;color:var(--ki-text-mid, var(--gray700,#979797))}
        .nxm{font-size:26px;font-weight:500;line-height:1}
        .nxm small{font-size:13px;margin-left:2px;color:var(--ki-text-2, var(--gray800,#afafaf))}
        .lk{font-size:11px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;color:var(--ki-text-3, var(--gray600,#7f7f7f));padding-top:2px}
        .vm{align-self:center;height:36px;padding:0 16px;border-radius:18px;box-shadow:inset 0 0 0 1px ${WA(0.18)};font-size:13px;color:var(--ki-text-1, var(--gray900,#c7c7c7))}
        .upd{display:flex;align-items:center;justify-content:center;gap:8px;font-size:12px;color:var(--ki-text-3, var(--gray600,#7f7f7f));padding:2px 4px}
        .upd i{width:8px;height:8px;border-radius:4px;flex:none}
        .none{font-size:12px;color:var(--ki-text-3, var(--gray600,#7f7f7f))}
        .nostop{display:flex;flex-direction:column;align-items:center;gap:8px;padding:22px 16px 16px;border-radius:24px;background:var(--ki-surface, var(--gray200,#3a3a3a));text-align:center}
        .nsi{width:52px;height:52px;border-radius:26px;display:grid;place-items:center;background:var(--ki-surface-2, var(--gray300,#404040));color:var(--ki-text-2, var(--gray800,#afafaf))}
        .nst{font-size:15px;font-weight:600}
        .nss{font-size:12px;color:var(--ki-text-mid, var(--gray700,#979797));line-height:1.45;max-width:320px;text-wrap:pretty}
        .nsp{align-self:stretch;margin-top:6px;text-align:left}
      `;
    }
  }
  function fmtWhen(v) {
    if (!v) return '';
    const t = new Date(v);
    if (isNaN(t.getTime())) return String(v);
    const now = new Date(), hm = `${M.pad(t.getHours())}:${M.pad(t.getMinutes())}`;
    if (t.toDateString() === now.toDateString()) return `I dag kl. ${hm}`;
    const d = t.toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' });
    return `${d.charAt(0).toUpperCase() + d.slice(1)} kl. ${hm}`;
  }
  M.define('msh-ruter-card', Ruter, 'MSH Ruter', 'Avvik (Entur SX) og avganger per stopp (Entur). #ruter');
})();
