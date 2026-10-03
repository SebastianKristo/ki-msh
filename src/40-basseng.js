/* Basseng-kortet msh-basseng-card. Kilde: Basseng v4 popup, variant a (fiks 26.14/28.14/30.1). Basseng v3 er utgått
 * (bare den gamle localStorage-nøkkelen basseng-v3-cfg leses én gang for migrering).
 * ÉTT kort i popupen (Fiks 42 C.4, 1:1 «Basseng v4 popup» variant a): toppkort (msh-basseng-hero-card, innebygd via
 * MSH.HEROES; følger fanen: basseng-scene · Varme-graf 24 t/3 d/7 d · Klor-uke · Spreder) → hurtigknapper (Lys · Pumpe ·
 * Varme · Stille · Kontakt) → glass-faner + tannhjul → fanen: Oversikt (setning, «I dag», Automatikk + Klor-ring),
 * Varme (mål-stepper, moduser, setning, Nattsenking/Pooltak/Vintermodus), Klor (hvem la i, antall, angre, påminnelse,
 * månedskalender), Spreder (start/stopp med fremdrift, varigheter, brukt i dag, Program/Maks/Frostvakt).
 * Autokonfig (M.poolAuto): 1) område fra M.poolDetect (basseng/pool/spa …), 2) navn/id/enhet med samme mønster, kjente
 * bassengintegrasjoner og pH-/ORP-sensorer, 3) domene + device_class. Overstyring: overrides.<rolle> (bytt), exclude: [rolle|entitet], include: [{ entity, navn, ikon }] /
 * include.hurtig (ekstra hurtigknapper), include.flagg / include.personer. Gammel config (`hurtig:`, ki-basseng-nøkler,
 * basseng-v3-cfg i localStorage) migreres én gang til config (M.poolNorm). Bunnluft: MSH.popupBottomPad (ingen gap-card).
 * Fiks 42 Del C: strategien lager #basseng igjen (mal A) – autodeteksjon M.poolDetect (område/alias, navn på entitet/
 * enhet, kjente bassengintegrasjoner, pH-/ORP-sensor) eller manuelt i Tilpass Hjem → Popups (popups.basseng.enabled).
 */
(function () {
  const M = window.MSH, esc = M.esc, C = M.C;
  // Fiks 34 (Del A) · semantiske tokens med dagens mørke verdier som fallback (mørk modus uendret)
  const K = { card: 'var(--ki-surface, var(--gray200, #3a3a3a))', inner: 'var(--ki-surface-2, var(--gray300, #404040))', ctrl: 'var(--ki-ctrl, var(--gray400, #545454))' };

  /* ------------------------------------------------------------ felles hjelpere (kan brukes av andre kort) */
  M.txt = M.txt || function (hass, id) {
    const s = hass && hass.states[id];
    return (id + ' ' + ((s && s.attributes.friendly_name) || '')).toLowerCase();
  };
  M.cap = M.cap || ((t) => (t ? String(t).charAt(0).toUpperCase() + String(t).slice(1) : t));
  // Tilstands-historikk (strenger, ikke tall) – kun når popupen åpnes. Cache 5 min.
  const SH = new Map();
  M.stateHistory = M.stateHistory || async function (hass, ids, startMs, endMs) {
    ids = (ids || []).filter((id) => id && hass && hass.states[id]);
    if (!ids.length || !hass.callWS) return {};
    endMs = endMs || Date.now();
    const key = ids.join(',') + '|' + Math.round(startMs / 300000) + '|' + Math.round(endMs / 300000);
    const c = SH.get(key);
    if (c && Date.now() - c.t < 300000) return c.d;
    let d = {};
    try {
      const r = await hass.callWS({ type: 'history/history_during_period', start_time: new Date(startMs).toISOString(), end_time: new Date(endMs).toISOString(), entity_ids: ids, minimal_response: true, no_attributes: true, significant_changes_only: false });
      ids.forEach((id) => {
        d[id] = ((r && r[id]) || []).map((p) => ({ t: p.lu != null ? p.lu * 1000 : p.lc != null ? p.lc * 1000 : new Date(p.last_changed || p.last_updated).getTime(), s: p.s != null ? p.s : p.state })).filter((p) => !isNaN(p.t));
      });
    } catch (e) { d = {}; }
    SH.set(key, { t: Date.now(), d });
    return d;
  };
  // Sekunder «på» i [from,to] ut fra tilstandsserie.
  M.onSeconds = M.onSeconds || function (pts, isOn, from, to, liveOn) {
    if (!pts || !pts.length) return 0;
    let tot = 0;
    for (let i = 0; i < pts.length; i++) {
      if (!isOn(pts[i].s)) continue;
      const a = Math.max(from, pts[i].t), b = Math.min(to, i + 1 < pts.length ? pts[i + 1].t : (liveOn === false ? pts[i].t : to));
      if (b > a) tot += b - a;
    }
    return tot / 1000;
  };
  // Kalenderhendelser (REST via hass.callApi). Returnerer [] ved feil.
  M.calEvents = M.calEvents || async function (hass, id, startMs, endMs) {
    if (!hass || !id || !hass.callApi) return [];
    try {
      const r = await hass.callApi('GET', `calendars/${id}?start=${encodeURIComponent(new Date(startMs).toISOString())}&end=${encodeURIComponent(new Date(endMs).toISOString())}`);
      return (r || []).map((e) => ({ ...e, t0: new Date((e.start && (e.start.dateTime || e.start.date)) || e.start).getTime(), t1: new Date((e.end && (e.end.dateTime || e.end.date)) || e.end).getTime() })).filter((e) => !isNaN(e.t0)).sort((a, b) => a.t0 - b.t0);
    } catch (e) { return []; }
  };
  // Myk SVG-sti (catmull-rom → bezier) gjennom punkter [[x,y]…].
  M.smoothPath = M.smoothPath || function (P) {
    if (!P.length) return '';
    let d = `M${P[0][0].toFixed(1)},${P[0][1].toFixed(1)}`;
    for (let i = 0; i < P.length - 1; i++) {
      const p0 = P[i - 1] || P[i], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2] || p2;
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
    }
    return d;
  };
  M.hm = M.hm || ((t) => { const d = new Date(t); return M.pad(d.getHours()) + ':' + M.pad(d.getMinutes()); });
  M.parseNum = M.parseNum || ((v, d) => { const n = parseFloat(String(v == null ? '' : v).replace(',', '.')); return isNaN(n) ? d : n; });
  M.parseHM = M.parseHM || ((v, d) => { const m = /(\d{1,2})[:.](\d{2})/.exec(String(v || '')); return m ? Number(m[1]) + Number(m[2]) / 60 : d; });
  // Vannrett scroll-rad inni popup: native scroll, men ikke la Bubble tolke sveipet.
  M.guardScroll = M.guardScroll || function (el) {
    if (!el || el.__mshScroll) return;
    el.__mshScroll = true;
    el.style.touchAction = 'pan-x';
    const stop = (e) => e.stopPropagation();
    el.addEventListener('touchstart', stop, { passive: true });
    el.addEventListener('touchmove', stop, { passive: true });
    el.addEventListener('pointerdown', stop);
  };
  // Sett en måltemperatur/verdi på climate/water_heater/number/input_number.
  M.setValue = M.setValue || function (hass, id, v) {
    const d = id.split('.')[0];
    if (d === 'climate') return M.call(hass, 'climate', 'set_temperature', { entity_id: id, temperature: v });
    if (d === 'water_heater') return M.call(hass, 'water_heater', 'set_temperature', { entity_id: id, temperature: v });
    if (d === 'number' || d === 'input_number') return M.call(hass, d, 'set_value', { entity_id: id, value: v });
    return Promise.resolve();
  };
  M.onState = M.onState || function (s) {
    if (!s) return false;
    const d = s.entity_id.split('.')[0];
    if (d === 'climate') return s.state !== 'off' && (s.attributes.hvac_action ? ['heating', 'preheating', 'defrosting'].includes(s.attributes.hvac_action) : s.state !== 'off');
    if (d === 'cover') return ['closed', 'closing'].includes(s.state); // tak lukket = «på»
    if (d === 'water_heater') return s.state !== 'off';
    return M.isOn(s);
  };

  /* ------------------------------------------------------------ autokonfig (fiks 26.14 · rollene i ENTS) */
  // Hver rolle søkes i rekkefølge: 1) entiteter i området «Basseng»/«Pool»/«Badebasseng», 2) entiteter der navn eller id
  // inneholder basseng|baseng|pool (typoen «baseng» tas med), 3) domene + device_class innenfor de to settene.
  const DOMS = ['sensor', 'switch', 'input_boolean', 'fan', 'climate', 'water_heater', 'cover', 'binary_sensor', 'light', 'valve', 'select', 'input_select', 'number', 'input_number', 'input_datetime', 'counter'];
  const POOL_RX = /basseng|baseng|(^|[^a-zæøå])pool|sv[øo]mmebasseng|boblebad|jacuzzi|(^|[^a-zæøå])spa($|[^a-zæøå])/; // 42 C.2: ikke «nordpool»/«spisestue»
  /* ------------------------------------------------------------ autodeteksjon (Fiks 42 Del C.2 · entiteter.md, Basseng-raden) */
  // Popupen #basseng lages når minst én av disse finnes (første treff = «via», resten kombineres):
  //   1) område med navn/id/alias basseng|pool|svømmebasseng|boblebad|spa|jacuzzi (case-insensitive; «spa» og «pool» bare
  //      som eget ord/ordstart, så «spisestue» og «nordpool» ikke treffer)
  //   2) entitet eller enhet med samme mønster i navn/entity_id (sensor.*pool*, switch.*basseng*, climate.*pool* …)
  //   3) kjente bassengintegrasjoner (hass.entities[id].platform, POOL_PLATFORMS)
  //   4) sensor med device_class ph, eller enhet mV (ORP/klor; ikke spenningssensorer – batterispenning i mV)
  // Rollene (vanntemp, pumpe, varme, pH, klor/ORP, lys, tak) finnes deretter av M.poolAuto i treffene.
  const POOL_WORD = /basseng|baseng|sv[øo]mmebasseng|boblebad|jacuzzi|hot[\s_-]?tub|(^|[^a-zæøå])pool|(^|[^a-zæøå])spa($|[^a-zæøå])/i;
  M.POOL_WORD = POOL_WORD;
  M.POOL_PLATFORMS = ['pentair', 'intellicenter', 'screenlogic', 'omnilogic', 'iaqualink', 'hayward', 'fluidra', 'astralpool', 'poolsense', 'ondilo_ico', 'flipr', 'blueriiot', 'zodiac'];
  const isOrp = (s) => !!s && String(s.attributes.unit_of_measurement || '') === 'mV' && s.attributes.device_class !== 'voltage' && !/volt|spenning|batter/i.test(s.entity_id + ' ' + (s.attributes.friendly_name || ''));
  M.poolIsOrp = isOrp;
  const DET = new WeakMap();
  M.poolDetect = function (hass) {
    if (!hass || !hass.states) return { found: false, via: null, area: null, ids: [], reason: 'ingen hass' };
    if (DET.has(hass)) return DET.get(hass);
    const S = hass.states, E = hass.entities || {}, D = hass.devices || {};
    const areaHit = (a) => { const x = (hass.areas && hass.areas[a.id]) || {}; return [a.id, a.name, ...(Array.isArray(x.aliases) ? x.aliases : [])].some((t) => POOL_WORD.test(String(t || ''))); };
    const areas = (M.areas ? M.areas(hass) : Object.values(hass.areas || {}).map((a) => ({ id: a.area_id, name: a.name }))).filter(areaHit).map((a) => a.id);
    const vis = (id) => { const e = E[id]; return !e || !(e.hidden_by || e.hidden || e.disabled_by); };
    const devName = (id) => { const e = E[id], d = e && e.device_id && D[e.device_id]; return d ? `${d.name_by_user || ''} ${d.name || ''}` : ''; };
    const by = { area: [], name: [], platform: [], sensor: [] };
    Object.keys(S).forEach((id) => {
      if (!DOMS.includes(id.split('.')[0]) || !vis(id)) return;
      const s = S[id], e = E[id];
      if (areas.length && areas.includes(M.areaOf(hass, id))) by.area.push(id);
      else if (POOL_WORD.test(id) || POOL_WORD.test(String(s.attributes.friendly_name || '')) || POOL_WORD.test(devName(id))) by.name.push(id);
      else if (e && M.POOL_PLATFORMS.includes(e.platform)) by.platform.push(id);
      else if (id.startsWith('sensor.') && (s.attributes.device_class === 'ph' || isOrp(s))) by.sensor.push(id);
    });
    const via = areas.length ? 'area' : by.name.length ? 'name' : by.platform.length ? 'platform' : by.sensor.length ? 'sensor' : null;
    const ids = [...by.area, ...by.name, ...by.platform, ...by.sensor];
    const VIA = { area: `område «${areas.map((a) => M.areaName ? M.areaName(hass, a) : a).join('», «')}»`, name: `${by.name.length} entitet(er) med basseng/pool i navnet`, platform: `bassengintegrasjon (${[...new Set(by.platform.map((id) => E[id].platform))].join(', ')})`, sensor: `pH-/ORP-sensor (${by.sensor.slice(0, 2).join(', ')})` };
    const r = { found: !!via, via, area: areas[0] || null, areas, ids, by,
      reason: via ? 'funnet via ' + VIA[via] : 'fant ikke område/enhet/entitet med basseng|pool|svømmebasseng|boblebad|spa|jacuzzi, ingen bassengintegrasjon og ingen pH-/ORP-sensor' };
    DET.set(hass, r);
    return r;
  };
  // Tilpass Hjem → Popups (ki-store popups.basseng.enabled): true = alltid (også uten treff), false = aldri, ellers autodeteksjon
  M.poolEnabled = () => { let p = null; try { p = M.store && M.store.get ? M.store.get('popups.basseng') : null; } catch (x) { p = null; } return p && typeof p === 'object' && typeof p.enabled === 'boolean' ? p.enabled : null; };
  M.poolWanted = function (hass, en) {
    const e = en === undefined ? M.poolEnabled() : en;
    if (e === false) return { on: false, reason: 'slått av i Tilpass Hjem → Popups (popups.basseng.enabled: false)' };
    const d = M.poolDetect(hass);
    if (d.found) return { on: true, reason: d.reason, detect: d };
    if (e === true) return { on: true, reason: 'slått på manuelt (popups.basseng.enabled) – ingen entiteter funnet, popupen viser «–» og «Velg entiteter»', detect: d };
    return { on: false, reason: d.reason, detect: d };
  };
  M.popupNeeds = M.popupNeeds || {};
  M.popupNeeds['#basseng'] = (hass) => M.poolWanted(hass).on;
  M.poolArea = (hass, cfg) => (cfg && cfg.area) || M.poolDetect(hass).area || M.findArea(hass, 'basseng', 'badebasseng', 'svommebasseng');
  // Rolle ut fra én entitet (brukes av migreringen av gamle `hurtig:`)
  const QUIET_RX = /stille|silent|quiet|lyd_av|mute/, PUMP_RX = /pump|filter|sirkul/, HEAT_RX = /varme|heat/, SOCK_RX = /stikkontakt|outlet|socket|(^|[_ .])plug/;
  M.poolRoleOf = function (hass, id) {
    const d = String(id || '').split('.')[0], s = hass && hass.states[id], t = M.txt(hass, id), dc = s && s.attributes.device_class;
    if (d === 'light') return 'light';
    if (d === 'climate' || d === 'water_heater') return 'heat';
    if (d === 'cover') return 'cover';
    if (d === 'valve' || /spreder|sprinkler/.test(t)) return ['switch', 'valve', 'input_boolean'].includes(d) ? 'spr' : null;
    if (!['switch', 'input_boolean', 'fan'].includes(d)) return null;
    if (QUIET_RX.test(t)) return 'quiet';
    if (dc === 'outlet' || SOCK_RX.test(t)) return 'sock';
    if (PUMP_RX.test(t) && !HEAT_RX.test(t)) return 'pump';
    if (/lys|light/.test(t)) return 'light';
    if (HEAT_RX.test(t)) return 'heat';
    return null;
  };
  M.poolAuto = function (hass, cfg) {
    const area = M.poolArea(hass, cfg), o = { area };
    if (!hass) return o;
    const T = (id) => M.txt(hass, id), dc = (id) => hass.states[id].attributes.device_class;
    const A1 = area ? M.all(hass, DOMS, (s, id) => M.areaOf(hass, id) === area) : [];
    // 2) navn/id – bare når området ikke er valgt eksplisitt (et valgt område er fasit)
    // 42 C.2: + enheter med bassengnavn, kjente bassengintegrasjoner og pH-/ORP-sensorer (M.poolDetect)
    const A2 = cfg && cfg.area ? [] : [...new Set([...M.all(hass, DOMS, (s, id) => !A1.includes(id) && POOL_RX.test(T(id))), ...M.poolDetect(hass).ids.filter((id) => !A1.includes(id))])];
    const ids = A1.concat(A2);
    const used = new Set();
    // første treff i område-settet, deretter i navne-settet
    const f = (doms, re, not, pred) => {
      for (const L of [A1, A2]) {
        const id = L.find((x) => doms.includes(x.split('.')[0]) && !used.has(x) && (!re || re.test(T(x))) && (!not || !not.test(T(x))) && (!pred || pred(x)));
        if (id) return id;
      }
      return null;
    };
    const take = (id) => { if (id) used.add(id); return id || null; };
    const sens = ids.filter((id) => id.startsWith('sensor.'));
    const temps = sens.filter((id) => dc(id) === 'temperature');
    const OUT = /(^|[_ .])ute|outdoor|outside|luft|(^|[_ .])air/;
    o.water = temps.find((id) => !OUT.test(T(id)) && /vann|water|basseng|baseng|pool/.test(T(id))) || temps.find((id) => !OUT.test(T(id))) || null;
    // Utetemperatur: bassengets egen ute-sensor, ellers samme som Hjem (ute-temperatursensor / weather.*)
    o.ute = temps.find((id) => OUT.test(T(id))) || M.all(hass, 'sensor', (s, id) => s.attributes.device_class === 'temperature' && /(^|[_ .])ute|outdoor|outside/.test(T(id)))[0] || M.all(hass, 'weather')[0] || null;
    // Stille-/lyd av-bryteren først, så den ikke tas som pumpe eller varme
    o.quiet = take(f(['switch', 'input_boolean'], QUIET_RX));
    o.heat = take(f(['climate']) || f(['water_heater']) || f(['switch', 'input_boolean'], HEAT_RX, /prio|natt|night|senk|vinter|winter/));
    o.pump = take(f(['switch', 'input_boolean', 'fan'], PUMP_RX, HEAT_RX));
    o.light = take(f(['light']) || f(['switch'], /lys|light|(^|[_ .])led/));
    o.spr = take(f(['switch', 'valve', 'input_boolean'], /spreder|sprinkler|fontene|fountain|dusj/));
    o.sock = take(f(['switch'], null, null, (id) => dc(id) === 'outlet') || f(['switch'], SOCK_RX));
    o.cover = take(f(['cover']) || f(['switch', 'input_boolean', 'binary_sensor'], /(^|[_ .])tak|pooltak|cover|lokk|presenning/, SOCK_RX));
    // Effekt: device_class power på pumpe-/varmeenheten, ellers navnet
    const devOf = (id) => { const e = id && M.regEntry(hass, id); return (e && e.device_id) || null; };
    const pw = sens.filter((id) => dc(id) === 'power');
    const onDev = (dev) => (dev ? pw.find((id) => devOf(id) === dev) : null);
    o.power = onDev(devOf(o.pump)) || pw.find((id) => PUMP_RX.test(T(id)) && !HEAT_RX.test(T(id))) || pw.find((id) => !HEAT_RX.test(T(id))) || null;
    o.heat_power = (onDev(devOf(o.heat)) !== o.power && onDev(devOf(o.heat))) || pw.find((id) => HEAT_RX.test(T(id)) && id !== o.power) || null;
    o.ph = sens.find((id) => dc(id) === 'ph' || /(^|[_ .])ph($|[_ .])/.test(T(id))) || null;
    o.klor = sens.find((id) => /klor|chlor|orp|redox/.test(T(id))) || sens.find((id) => M.poolIsOrp(hass.states[id])) || null; // 42 C.2: ORP i mV
    o.savings = sens.find((id) => /spart|saving/.test(T(id))) || null;
    o.cost = sens.find((id) => (dc(id) === 'monetary' || /kost|cost|kroner/.test(T(id))) && !/spart|saving/.test(T(id))) || null;
    o.turnover = sens.find((id) => /omsetning|turnover/.test(T(id))) || null;
    o.pumped = sens.find((id) => /pumpet|runtime|driftstid|kjoretid|kjøretid|run_time/.test(T(id))) || null;
    o.mode = f(['select', 'input_select'], /modus|mode|profil|drift/) || f(['select', 'input_select']);
    o.auto = f(['switch', 'input_boolean'], /automat|auto/);
    o.price = f(['switch', 'input_boolean'], /pris|price|billig|nordpool/);
    o.prio = f(['switch', 'input_boolean'], /prio/);
    o.night = f(['switch', 'input_boolean'], /natt|night|senk/);
    o.winter = f(['switch', 'input_boolean'], /vinter|winter/);
    o.eta = sens.find((id) => /(^|[_ .])eta($|[_ .])|time_to_target|tid_til_(mal|mål)|oppvarmingstid|heat(ing)?_time/.test(T(id))) || null;
    o.heat_loss = sens.find((id) => /varmetap|heat_loss|heatloss/.test(T(id))) || null;
    o.solar = sens.find((id) => dc(id) === 'irradiance' || /(^|[_ .])sol|solar/.test(T(id))) || null;
    o.target = (o.heat && /^(climate|water_heater)\./.test(o.heat)) ? o.heat : f(['number', 'input_number'], /mal|mål|target|settpunkt|setpunkt|setpoint/);
    o.spr_duration = f(['number', 'input_number'], /varighet|duration/);
    // Klorkalender: calendar.* med klor i navnet, ellers input_datetime/counter for siste klortablett
    o.klor_calendar = M.all(hass, 'calendar', (s, id) => /klor|chlor/.test(M.txt(hass, id)))[0] || M.all(hass, 'calendar', (s, id) => POOL_RX.test(M.txt(hass, id)))[0] || null;
    o.klor_last = o.klor_calendar ? null : (M.all(hass, ['input_datetime', 'counter'], (s, id) => /klor|chlor/.test(M.txt(hass, id)))[0] || null);
    o.flags = [o.auto, o.price, o.prio].filter(Boolean);
    o.people = M.all(hass, 'person');
    return o;
  };
  // Rollenavn fra designet (ENTS/CTL) → nøklene her
  const ROLE_ALIAS = { out: 'ute', cal: 'klor_calendar', mute: 'quiet', stille: 'quiet', stikkontakt: 'sock', lys: 'light', pumpe: 'pump', varme: 'heat' };
  const roleKey = (k) => ROLE_ALIAS[k] || k;
  // Ekstra hurtigknapper: include: [{ entity, navn, ikon }] (YAML) eller include.hurtig: [id] (editoren) + labels.<id>
  M.poolExtras = function (cfg) {
    const c = cfg || {}, L = c.labels || {}, out = [], seen = new Set();
    const add = (x) => {
      const it = typeof x === 'string' ? { entity: x } : x;
      const id = it && (it.entity || it.entity_id);
      if (!id || seen.has(id) || (c.exclude || []).includes(id)) return;
      seen.add(id);
      out.push({ entity: id, navn: it.navn || it.name || (L[id] && L[id].navn) || null, ikon: it.ikon || it.icon || (L[id] && L[id].ikon) || null });
    };
    if (Array.isArray(c.include)) c.include.forEach(add);
    else if (c.include && Array.isArray(c.include.hurtig)) c.include.hurtig.forEach(add);
    return out;
  };
  // Endelig oppsett: overrides vinner, exclude (rolle eller entitet) fjerner auto-valg.
  M.poolEnts = function (hass, cfg) {
    cfg = cfg || {};
    const a = M.poolAuto(hass, cfg), e = { area: a.area, auto: a };
    const ov = {};
    Object.keys(cfg.overrides || {}).forEach((k) => { if (cfg.overrides[k]) ov[roleKey(k)] = cfg.overrides[k]; });
    const ex = new Set((Array.isArray(cfg.exclude) ? cfg.exclude : []).map(roleKey));
    Object.keys(a).forEach((k) => { if (k === 'area' || Array.isArray(a[k])) return; e[k] = ex.has(k) ? null : ov[k] || (a[k] && !ex.has(a[k]) ? a[k] : null); });
    e.flags = M.applyLists(Array.isArray(cfg.include) ? { ...cfg, include: {} } : cfg, 'flagg', a.flags || []);
    e.people = M.applyLists(Array.isArray(cfg.include) ? { ...cfg, include: {} } : cfg, 'personer', a.people || []);
    e.extra = M.poolExtras(cfg);
    return e;
  };
  const OVR = [
    ['water', 'Vanntemperatur', 'sensor', 'temperature'], ['ute', 'Utetemperatur', ['sensor', 'weather']], ['pump', 'Pumpe', ['switch', 'input_boolean', 'fan']], ['heat', 'Varme (varmepumpe)', ['climate', 'water_heater', 'switch', 'input_boolean']],
    ['quiet', 'Stille (lyd av)', ['switch', 'input_boolean']], ['sock', 'Stikkontakt', ['switch', 'input_boolean']],
    ['cover', 'Pooltak', ['cover', 'switch', 'input_boolean', 'binary_sensor']], ['light', 'Lys', ['light', 'switch']], ['spr', 'Spreder', ['switch', 'valve', 'input_boolean']], ['power', 'Effekt · pumpe', 'sensor', 'power'],
    ['heat_power', 'Effekt · varmepumpe', 'sensor', 'power'], ['ph', 'pH', 'sensor'], ['klor', 'Klor (mg/L / ORP)', 'sensor'], ['target', 'Måltemperatur', ['climate', 'water_heater', 'number', 'input_number']],
    ['turnover', 'Omsetninger i dag', 'sensor'], ['pumped', 'Pumpet i dag (timer)', 'sensor'], ['savings', 'Spart i dag', 'sensor'], ['cost', 'Strømkostnad i dag', 'sensor'],
    ['eta', 'Tid til mål (ETA, valgfri)', 'sensor'], ['mode', 'Driftsmodus', ['select', 'input_select']], ['night', 'Nattsenking', ['switch', 'input_boolean']], ['winter', 'Vintermodus', ['switch', 'input_boolean']], ['heat_loss', 'Varmetap', 'sensor'],
    ['solar', 'Sol inn', 'sensor'], ['spr_duration', 'Spreder · varighet', ['number', 'input_number']], ['klor_calendar', 'Klorkalender (logg)', 'calendar'], ['klor_last', 'Siste klortablett (uten kalender)', ['input_datetime', 'counter']],
  ];
  const ovrFields = (keys) => OVR.filter((x) => !keys || keys.includes(x[0])).map(([name, label, domain, device_class]) => ({ name, label, domains: [].concat(domain), device_class, auto: (h, c) => M.poolAuto(h, c)[name] }));
  const AREA_F = { type: 'area', name: 'area', label: 'Område', help: 'Tomt = område «Basseng»/«pool»', auto: (h, c) => M.poolArea(h, {}) };

  /* ============================================================ HERO */
  // Fiks 42 C.4 · toppkortet 1:1 fra «Basseng v4 popup» (176 px, radius 28, mørk øy): bassengscenen (Oversikt) og – når
  // «Toppkortet følger fanen» (hero_follow, standard på) – Varme (graf 24 t/3 d/7 d), Klor (uka) og Spreder (sprut).
  // Tekst: kicker 13 px, status-chip 24 px, stort tall 40 px/300 + enhet 14 px, undertekst 12 px. Data fra vertskortet
  // (msh-basseng-card: valgt fane, historikk, klorlogg, spreder); alene (gammel config) vises Oversikt-scenen.
  // Ingen entiteter funnet → «–» og knappen «Velg entiteter» (åpner Entiteter i Tilpass) – toppkortet skjules aldri.
  const POOL_ROLES = ['water', 'pump', 'heat', 'light', 'cover', 'ph', 'klor', 'spr', 'target', 'quiet', 'sock', 'mode', 'turnover'];
  M.poolNone = (e) => !POOL_ROLES.some((k) => e && e[k]);
  const RANGES = [['24t', '24 t', 24], ['3d', '3 d', 72], ['7d', '7 d', 168]];
  class BassengHero extends M.Card {
    static get cardName() { return 'Basseng · hero'; }
    static get defaults() { return { anim: true, hero_follow: true }; }
    static get schema() {
      return [
        AREA_F,
        { type: 'text', name: 'name', label: 'Navn', placeholder: 'Bassenget' },
        { type: 'overrides', label: 'Bytt entiteter', fields: ovrFields(['water', 'pump', 'heat', 'cover', 'light', 'turnover', 'target']) },
        { type: 'section', label: 'Animasjon', icon: 'mdi:animation', open: true, fields: [
          { type: 'boolean', name: 'anim', label: 'Animasjoner', help: 'Bølger, bobler, vifte og damp i toppkortet', default: true },
          { type: 'text', name: 'vals.turnovers', label: 'Omsetninger per døgn (mål)', placeholder: '3,75' },
        ] },
      ];
    }
    get cardSize() { return 4; }
    get _hostCard() { const H = this._host; return H && H.localName === 'msh-basseng-card' ? H : null; }
    onAction(name, el, ev) {
      const H = this._hostCard;
      if (name === 'range' && H) { M.haptic('selection'); return H.setRange(el.dataset.v); }
      return super.onAction(name, el, ev);
    }
    // Bassengscenen (designets fx/steam), animasjoner av når anim: false
    _pool(st, A) {
      const { pump, heat, light, cover } = st;
      const an = (v) => (A ? v : 'none');
      const bub = pump && A ? [18, 42, 66, 84].map((l, i) => `<span style="position:absolute;left:${l}%;bottom:4px;width:3px;height:3px;border-radius:50%;background:rgb(255 255 255 / .55);animation:steam ${2 + i * 0.3}s ease-in ${i * 0.5}s infinite"></span>`).join('') : ''; /* ki-hex-ok: mørk øy */
      const steam = heat && !cover && A ? [[30, '#c98a6a', 0], [56, '#8a939c', 0.9], [78, '#c98a6a', 1.7]].map(([l, c, d]) => `<svg viewBox="0 0 8 22" style="position:absolute;left:${l}%;top:-26px;width:8px;height:22px;overflow:visible;animation:steam 3s ease-in ${d}s infinite"><path d="M4 21 C0 17 8 14 4 10 C0 6 8 4 4 1" fill="none" stroke="${c}" stroke-width="1.6" stroke-linecap="round"></path></svg>`).join('') : ''; /* ki-hex-ok: mørk øy */
      const heatSq = (b, d) => `<div style="position:absolute;right:45px;bottom:${b}px;width:8px;height:12px;border-left:2px solid #d9785f;border-radius:50%;opacity:${heat ? 1 : 0};transition:opacity .5s;animation:${heat ? an(`pulse 1.4s ease-in-out ${d}s infinite`) : 'none'}"></div>`; /* ki-hex-ok: mørk øy */
      return `<div class="sc" data-scene="pool">
          <div style="position:absolute;left:18%;bottom:-40px;width:260px;height:120px;border-radius:50%;background:radial-gradient(closest-side,rgba(200,110,80,.22),transparent);opacity:${heat ? 1 : 0};transition:opacity .8s"></div>
          <div style="position:absolute;right:0;bottom:0;width:52%;height:22px;background:#1a2127"></div>
          <div style="position:absolute;right:52px;bottom:22px;width:calc(46% - 40px);height:92px">
            <span style="position:absolute;left:8px;top:-2px;width:18px;height:13px;border:2.5px solid #c5ccd3;border-bottom:0;border-radius:11px 11px 0 0;box-sizing:border-box"></span>
            <div style="position:absolute;left:-4px;right:-4px;top:10px;height:6px;border-radius:3px;background:#2e3942"></div>
            <div style="position:absolute;left:-2px;right:-2px;top:16px;height:11px;border-radius:3px;background:repeating-linear-gradient(90deg,#7c8894 0 17px,#a9b3bd 17px 18px);box-shadow:0 2px 0 rgb(0 0 0 / .25)"></div>
            <div class="water" style="position:absolute;left:0;right:0;top:26px;bottom:0;border-radius:0 0 8px 8px;overflow:hidden;background:linear-gradient(180deg,#2c93b3 0%,#1f7797 60%,#1a6582 100%)">
              <div class="glow" style="position:absolute;left:-30px;bottom:-40px;width:150px;height:120px;border-radius:50%;background:radial-gradient(closest-side,rgba(255,236,170,.55),rgba(255,236,170,.15) 60%,transparent);opacity:${light ? 1 : 0};transition:opacity .6s;animation:${light ? an('pulse 3.5s ease-in-out infinite') : 'none'}"></div>
              <div style="position:absolute;left:0;top:10px;width:200%;height:8px;opacity:.28;background:repeating-linear-gradient(90deg,transparent 0 22px,#fff 22px 38px,transparent 38px 70px);background-size:70px 1.5px;background-repeat:repeat-x;animation:${an(`wave ${pump ? 4 : 18}s linear infinite`)}"></div>
              <div style="position:absolute;left:0;top:26px;width:200%;height:8px;opacity:.18;background:repeating-linear-gradient(90deg,transparent 0 40px,#fff 40px 52px,transparent 52px 96px);background-size:96px 1.5px;background-repeat:repeat-x;animation:${an(`wave ${pump ? 6 : 26}s linear infinite reverse`)}"></div>
              ${bub}
              <div style="position:absolute;right:2px;top:30px;width:18px;height:2px;border-radius:1px;background:rgb(255 255 255 / .6);display:${pump ? 'block' : 'none'};animation:${an('jet 1.6s ease-out infinite')}"></div>
              <span style="position:absolute;left:12px;bottom:22px;width:9px;height:6px;border-radius:2px;background:${light ? '#ffe08a' : '#4f6f7e'};box-shadow:${light ? '0 0 10px 3px rgba(255,224,138,.7)' : 'none'};transition:background .4s,box-shadow .4s"></span>
            </div>
            <div class="cov" style="position:absolute;left:-2px;top:16px;height:30px;width:${cover ? 'calc(100% + 4px)' : '0%'};border-radius:3px;background:repeating-linear-gradient(90deg,#9fb4c2 0 10px,#8499a8 10px 11px);box-shadow:0 3px 6px rgb(0 0 0 / .35);transition:width 1.4s cubic-bezier(.6,0,.3,1);overflow:hidden"></div>
            ${steam}
          </div>
          ${heatSq(66, 0)}${heatSq(50, 0.4)}
          <div class="hp" style="position:absolute;right:8px;bottom:24px;width:34px;height:70px;border-radius:7px;background:#232c34;box-shadow:inset 0 0 0 1px #37424d${heat ? ',0 0 14px rgba(217,120,95,.3)' : ''};display:flex;flex-direction:column;align-items:center;padding-top:8px;gap:4px;box-sizing:border-box;transition:box-shadow .5s">
            <div style="position:relative;width:24px;height:24px;margin-bottom:6px;animation:${an('spin .9s linear infinite')};animation-play-state:${heat ? 'running' : 'paused'}">
              <span style="position:absolute;left:50%;top:50%;width:20px;height:7px;margin:-3.5px 0 0 -10px;border-radius:50%;background:#aeb7c1;transform:rotate(45deg)"></span>
              <span style="position:absolute;left:50%;top:50%;width:20px;height:7px;margin:-3.5px 0 0 -10px;border-radius:50%;background:#aeb7c1;transform:rotate(-45deg)"></span>
              <span style="position:absolute;left:50%;top:50%;width:5px;height:5px;margin:-2.5px 0 0 -2.5px;border-radius:50%;background:#263039"></span>
            </div>
            <span style="width:22px;height:1.5px;background:#4a5561"></span><span style="width:22px;height:1.5px;background:#4a5561"></span><span style="width:22px;height:1.5px;background:#4a5561"></span>
          </div>
        </div>`;
    }
    render() {
      const H = this._hostCard, c = M.poolNorm(this.config, this.hass);
      const e = (H && H._e) || M.poolEnts(this.hass, c), A = c.anim !== false;
      const follow = (H ? H.config.hero_follow : c.hero_follow) !== false;
      const tab = follow && H ? H._cur || 'ov' : 'ov';
      const on = (k) => M.onState(this.s(e[k]));
      const st = { pump: on('pump'), heat: on('heat'), light: on('light'), cover: on('cover') };
      const tw = this.n(e.water), tgtS = this.s(e.target);
      const tgt = tgtS ? (/^(climate|water_heater)\./.test(e.target) ? (tgtS.attributes.temperature != null ? Number(tgtS.attributes.temperature) : null) : M.isNum(tgtS.state) ? Number(tgtS.state) : null) : null;
      const fmt1 = (v) => (v != null ? M.nf(v, 1) : '–'), fT = (v) => M.nf(v, v % 1 ? 1 : 0);
      const none = M.poolNone(e);
      let h, scene = '';
      if (tab === 'heat') {
        const hp = this.n(e.heat_power), outS = this.s(e.ute);
        const outV = outS ? (outS.entity_id.startsWith('weather.') ? outS.attributes.temperature : M.isNum(outS.state) ? Number(outS.state) : null) : null;
        h = { kicker: 'Vanntemperatur', chip: st.heat ? (hp != null ? `${M.nf(hp >= 100 ? hp / 1000 : hp, 1)} kW` : 'Varmer') : e.heat ? 'Av' : '–', icon: 'bolt', bg: 'rgba(240,179,107,.25)', big: fmt1(tw), unit: '°C', sub: [tgt != null ? `Mål ${fT(tgt)}°` : null, outV != null ? `ute ${M.nf(outV, 0)}°` : null].filter(Boolean).join(' · ') };
        const g = H ? H._graph(tgt) : null, rg = H ? H._range() : '24t';
        scene = `<div class="sc" data-scene="heat">
            <div class="rgs">${RANGES.map(([k, l]) => `<button class="rg" data-act="range" data-v="${k}" data-key="rg-${k}" style="background:${rg === k ? PINK : 'transparent'};color:${rg === k ? INK : '#a9b0ba'}">${l}</button>`).join('')}</div>
            <svg viewBox="0 0 300 80" preserveAspectRatio="none" class="hg">${g ? `<path d="${g.area}" fill="rgba(90,200,210,.14)"></path><path d="${g.line}" fill="none" stroke="#5ac8d2" stroke-width="2" vector-effect="non-scaling-stroke"></path>${g.ty != null ? `<line x1="0" x2="300" y1="${g.ty}" y2="${g.ty}" stroke="rgb(255 255 255 / .4)" stroke-dasharray="4 4" vector-effect="non-scaling-stroke"></line>` : ''}` : '<line x1="0" x2="300" y1="40" y2="40" stroke="rgb(255 255 255 / .25)" stroke-dasharray="4 4" vector-effect="non-scaling-stroke"></line>'}</svg>
          </div>`; /* ki-hex-ok: mørk øy */
      } else if (tab === 'klor' && H) {
        const k = H._klorInfo();
        h = { kicker: 'Klor', chip: k.today ? 'Lagt i i dag' : k.next ? `Neste ${k.nextShort}` : e.klor_calendar || e.klor_last ? 'Ingen logget' : '–', icon: 'mdi:pill', bg: 'rgba(111,210,154,.25)', big: k.left != null ? String(Math.max(0, k.left)) : '–', unit: k.left != null ? (Math.max(0, k.left) === 1 ? 'dag' : 'dager') : '', sub: k.left != null ? `til neste${k.who ? ` · ${k.who}${k.today ? '' : ' la i sist'}` : ''}` : (e.klor_calendar ? 'Logg første tablett under' : 'Velg klorkalender i Tilpass') };
        scene = `<div class="sc" data-scene="klor"><div class="wk">${k.week.map((d) => `<span class="wkd"><span style="width:14px;height:14px;border-radius:50%;background:${d.on ? '#6fd29a' : 'transparent'};box-shadow:${d.today ? '0 0 0 1.5px var(--ki-text, #fafafa)' : 'inset 0 0 0 1.5px #4a525e'}"></span><span style="font-size:10px;color:#a9b0ba">${esc(d.l)}</span></span>`).join('')}</div></div>`; /* ki-hex-ok: mørk øy */
      } else if (tab === 'spr' && H) {
        const s = H._sprInfo();
        h = { kicker: 'Spreder', chip: s.ent ? (s.running ? 'Går' : 'Klar') : '–', icon: 'water_drop', bg: 'rgba(122,184,240,.25)', big: s.ent ? (s.running ? 'Sprer' : 'Står') : '–', unit: '', sub: s.ent ? s.sub : 'Velg spreder i Tilpass' };
        const drops = s.running && A ? Array.from({ length: 8 }, (_, i) => `<span style="position:absolute;left:calc(62% + 2px);bottom:68px;width:4px;height:4px;border-radius:50%;background:#cfe8f5;--dx:${(i - 3.5) * 10}px;animation:spray 1.1s ease-out ${(i * 0.14).toFixed(2)}s infinite"></span>`).join('') : ''; /* ki-hex-ok: mørk øy */
        scene = `<div class="sc" data-scene="spr" style="background:linear-gradient(180deg,#16222f 0%,#1d3348 55%,#2a5f80 100%)">
            <span style="position:absolute;right:28px;top:16px;width:22px;height:22px;border-radius:50%;background:#e6dfc4;box-shadow:0 0 18px rgba(230,223,196,.4)"></span>
            <div style="position:absolute;left:0;bottom:0;width:200%;height:46px;background:repeating-radial-gradient(ellipse 60px 18px at 30px 0,#2f7aa2 0 60%,transparent 61%);background-size:60px 46px;background-color:#2a6a8f;animation:${A ? 'wave 6s linear infinite' : 'none'}"></div>
            <span style="position:absolute;left:62%;bottom:40px;width:6px;height:26px;border-radius:3px;background:#b8c2cc"></span>
            <span style="position:absolute;left:calc(62% - 7px);bottom:64px;width:20px;height:7px;border-radius:4px;background:#d6dde3"></span>
            ${drops}
          </div>`; /* ki-hex-ok: mørk øy */
      } else {
        const turn = this.n(e.turnover), turnT = M.parseNum(c.vals && c.vals.turnovers, 3.75);
        const name = c.name || c.navn || 'Bassenget';
        const chip = e.heat ? (st.heat ? ['Varmer', 'heat', 'rgba(242,128,114,.28)'] : ['Hviler', 'pause', 'rgb(255 255 255 / .12)']) : e.pump ? (st.pump ? ['Filtrerer', 'autorenew', 'rgb(255 255 255 / .12)'] : ['Står', 'pause', 'rgb(255 255 255 / .12)']) : ['–', 'pause', 'rgb(255 255 255 / .12)'];
        h = { kicker: st.cover ? `${name} · tak på` : name, chip: chip[0], icon: chip[1], bg: chip[2], big: fmt1(tw), unit: '°C', sub: [turn != null ? `${M.nf(turn, 2)} av ${M.nf(turnT, 2)} omsetninger` : null, tgt != null ? `mål ${fT(tgt)}°` : null].filter(Boolean).join(' · ') };
        scene = this._pool(st, A);
      }
      const pick = none ? `<button class="pick press" data-act="customize" data-section="overrides" data-key="velg">${M.icon('mdi:plus', 16)}Velg entiteter</button>` : '';
      return `
        <section class="hero press0" data-theme="dark" data-ki-island data-tab="${tab}" data-ent="${esc(e.water || e.pump || '')}">
          ${scene}
          <div class="tl"><span class="lbl">${esc(h.kicker)}</span><span class="st" style="background:${h.bg}">${M.icon(h.icon, 14)}${esc(h.chip)}</span></div>
          <div class="bl"><span class="row"><span class="t num">${esc(h.big)}</span>${h.unit ? `<span class="u">${esc(h.unit)}</span>` : ''}</span>${pick || (h.sub ? `<span class="sub">${esc(h.sub)}</span>` : '')}</div>
        </section>`;
    }
    get styles() {
      return `
        @keyframes fade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
        @keyframes steam{0%{opacity:0;transform:translateY(6px) scaleX(1)}40%{opacity:.7}100%{opacity:0;transform:translateY(-18px) scaleX(1.4)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:.55}50%{opacity:1}}
        @keyframes jet{0%{transform:translateX(0);opacity:0}20%{opacity:.8}100%{transform:translateX(-60px);opacity:0}}
        @keyframes wave{from{transform:translateX(0)}to{transform:translateX(-50%)}}
        @keyframes spray{0%{opacity:0;transform:translate(0,0) scale(.6)}30%{opacity:1}100%{opacity:0;transform:translate(var(--dx),-34px) scale(1)}}
        .hero{position:relative;height:176px;border-radius:28px;overflow:hidden;background:linear-gradient(165deg,#15191f 0%,#1a2129 55%,#1d2a33 100%);width:100%;color:var(--ki-text, #fafafa)} /* ki-hex-ok: mørk øy (lys tekst i begge moduser) */
        .sc{position:absolute;inset:0;animation:fade .35s ease}
        .rgs{position:absolute;right:14px;top:14px;display:flex;gap:2px;z-index:2}
        .rg{height:26px;padding:0 10px;border-radius:13px;font-size:12px;font-weight:500;white-space:nowrap}
        .hg{position:absolute;left:38%;right:0;bottom:14px;width:62%;height:96px;overflow:visible;-webkit-mask-image:linear-gradient(90deg,transparent,#000 22%);mask-image:linear-gradient(90deg,transparent,#000 22%)}
        .wk{position:absolute;right:16px;bottom:16px;display:flex;gap:6px}
        .wkd{display:flex;flex-direction:column;align-items:center;gap:5px}
        .tl{position:absolute;left:18px;top:16px;display:flex;flex-direction:column;gap:6px;align-items:flex-start;z-index:1}
        .lbl{font-size:13px;color:#cfd3da}
        .st{height:24px;padding:0 10px 0 8px;border-radius:12px;display:flex;align-items:center;gap:5px;font-size:12px;font-weight:500;white-space:nowrap}
        .bl{position:absolute;left:18px;bottom:16px;display:flex;flex-direction:column;gap:2px;max-width:60%;align-items:flex-start;z-index:1}
        .bl .row{display:flex;align-items:baseline;gap:3px}
        .t{font-size:40px;font-weight:300;line-height:1}
        .u{font-size:14px;color:#cfd3da}
        .sub{font-size:12px;color:#a9b0ba;text-wrap:pretty}
        .pick{margin-top:6px;height:32px;padding:0 14px 0 10px;border-radius:16px;background:rgb(255 255 255 / .14);color:var(--ki-text, #fafafa);display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:500;white-space:nowrap}
      `;
    }
  }
  M.define('msh-basseng-hero-card', BassengHero, 'MSH Basseng · hero', 'Toppkortet i msh-basseng-card (innebygd via MSH.HEROES): bassengscenen med pumpe, varmepumpe, tak og lys, og – når toppkortet følger fanen – Varme-graf, Klor-uke og Spreder. Legges ikke som eget kort i popupen.');

  /* ============================================================ HOVEDKORT */
  // Fiks 42 C.4 · hurtigknapper som i «Basseng v4 popup» (QDEF): Lys · Pumpe · Varme · Stille · Kontakt – vises bare for
  // roller som ble funnet; Pooltak/Spreder kan slås på i Tilpass. [ikon, navn, farge (null = rosa), tittel]
  const PINK = C.accent, INK = 'var(--ki-on-accent, rgba(70,58,64,.95))';
  const CTL = { light: ['lightbulb', 'Lys', C.yellow], pump: ['mode_fan', 'Pumpe', null], heat: ['heat', 'Varme', C.red], quiet: ['volume_off', 'Stille', null, 'Lyd av'], sock: ['outlet', 'Kontakt', null, 'Stikkontakt'], cover: ['roofing', 'Pooltak', C.blue], spr: ['sprinkler', 'Spreder', C.blue] };
  const CTL_STD = ['light', 'pump', 'heat', 'quiet', 'sock', 'cover', 'spr'], CTL_HID = ['cover', 'spr'];
  const TABS = { ov: 'Oversikt', heat: 'Varme', klor: 'Klor', spr: 'Spreder' };
  const TAB_IC = { ov: 'dashboard', heat: 'heat', klor: 'mdi:pill', spr: 'sprinkler' };
  // Designets «Styring og verdier» → config.vals.<nøkkel> (placeholder = standard).
  const CFG = [
    ['tune', 'Styring', [['profile', 'Driftsprofil', 'Setter mål og puls i ett grep', 'Egen'], ['turnovers', 'Omsetninger per døgn', 'Hvor mye vann som skal gjennom filteret', '3,75'], ['pulse', 'Vedlikeholdspuls', 'Sirkulasjon hver time når målet er nådd', '15 min/t'], ['day_hours', 'Dagtimer i planen', 'Timer om dagen pumpa skal gå', '5 t'], ['price_ctrl', 'Prisstyring', 'Pumper i de billigste timene', true], ['heat_prio', 'Varmeprioritet', 'Pumper når varmepumpa trenger det', true]]],
    ['water_pump', 'Pumpe', [['min_run', 'Minste kjøretid', 'Kortere starter sliter pumpa av', '15 min'], ['base_load', 'Basislast', 'Pumpas effekt når den går', '800 W'], ['override', 'Manuell overstyring varer', 'Så lenge automatikken venter', '60 min']]],
    ['heat', 'Varme', [['ctrl_heat', 'Styr varmepumpa', 'Varme bare når vannet sirkulerer', true], ['ctrl_setpoint', 'Styr settpunkt', 'Holder varmepumpa på ønsket temperatur', true], ['heat_from', 'Varmevindu fra', 'Bassenget skal være klart', '5:00'], ['heat_to', 'Varmevindu til', 'Natta starter', '22:00'], ['away_drop', 'Senking når ingen er hjemme', '', '2,0°'], ['solar', 'Solvarme', 'Pumper når sola varmer (med solfanger)', true], ['targets', 'Hurtigvalg mål (°C)', 'Kommaseparert', '23 24 25 26 27']]],
    ['functions', 'Varmemodell', [['loss_open', 'Varmetap uten tak', '', '15,0 W/m²K'], ['loss_closed', 'Varmetap med tak', '', '5,0 W/m²K'], ['sun_through', 'Sol gjennom taket', '', '60 %']]],
    ['pill', 'Klor', [['klor_every', 'Klortablett hver (dager)', 'Kortere i varmt vann', '7,0 d'], ['klor_remind', 'Påminnelse', 'Minner om neste klortablett', true]]],
    ['sprinkler', 'Spreder', [['spr_prog', 'Program', 'Starter spreder etter planen', false], ['spr_every', 'Start hver', 'Mellom 10 og 20', '4 t'], ['spr_max', 'Maks per døgn', 'Spreder stopper når tiden er brukt', '60 min'], ['spr_durs', 'Varigheter (min)', 'Kommaseparert', '5 10 15 20 30'], ['spr_frost', 'Frostvakt', 'Starter ikke når det er under 2 °C ute', true]]],
  ];
  const VDEF = {};
  CFG.forEach(([, , rows]) => rows.forEach(([k, , , v]) => { VDEF[k] = v; }));
  const nums = (v, d) => { const a = String(v == null ? d : v).split(/[\s,;]+/).map((x) => parseFloat(x)).filter((x) => !isNaN(x)); return a.length ? a : d.split(' ').map(Number); };
  const MODE_IC = [[/boost|turbo|maks/, 'mdi:rocket-launch'], [/spre|sprink|fontene/, 'sprinkler'], [/eco|spar/, 'eco'], [/bal|normal|auto/, 'balance'], [/bade|bad|swim|komfort/, 'pool'], [/av|off|stopp/, 'power_settings_new'], [/natt|night/, 'bedtime'], [/vinter|winter/, 'ac_unit']];
  const modeIcon = (o) => { const t = String(o).toLowerCase(); const m = MODE_IC.find(([re]) => re.test(t)); return m ? m[1] : 'tune'; };

  /* ------------------------------------------------------------ migrering (fiks 26.14) */
  // Gammel config (ki-basseng-card/ki-basseng-hero-card, `hurtig:`, designets ctl/ctlHide/ents, basseng-v3-cfg fra
  // localStorage) → ny config. Rolle-entiteter som autokonfig finner selv skrives IKKE inn (overrides bare ved avvik).
  const LEG_ROLE = { varmepumpe: 'heat', pumpe: 'pump', lys: 'light', stillemodus: 'quiet', stikkontakt: 'sock', vanntemp: 'water', ute: 'ute', pooltak: 'cover' };
  const LEG_KEYS = ['navn', 'hurtig', 'hurtig_navn', 'hero', 'forvalg', 'ctl', 'ctlHide', 'tabHide', 'ents'];
  const LBL = {};
  CFG.forEach(([, , rows]) => rows.forEach(([k, l]) => { LBL[l] = k; }));
  const hidList = (v) => (Array.isArray(v) ? v : v && typeof v === 'object' ? Object.keys(v).filter((k) => v[k]) : []);
  M.poolLegacy = (cfg) => !!cfg && (LEG_KEYS.some((k) => k in cfg) || Object.keys(LEG_ROLE).some((k) => typeof cfg[k] === 'string' && cfg[k].includes('.')) || Array.isArray(cfg.include));
  M.POOL_LS = 'basseng-v3-cfg';
  M.poolLS = () => { try { return JSON.parse(localStorage.getItem(M.POOL_LS) || 'null'); } catch (e) { return null; } };
  M.poolNorm = function (cfg, hass, pc) {
    if (!cfg || (!M.poolLegacy(cfg) && !pc)) return cfg;
    const n = { ...cfg }, ov = { ...(cfg.overrides || {}) }, claimed = new Set(Object.keys(ov));
    let auto = null;
    const A = () => auto || (auto = M.poolAuto(hass, { ...cfg, overrides: {} }));
    const role = (k, id) => {
      k = roleKey(k);
      if (!id || typeof id !== 'string' || claimed.has(k)) return false;
      claimed.add(k);
      if (!(hass && A()[k] === id)) ov[k] = id;
      return true;
    };
    const labels = { ...(cfg.labels || {}) }, inc = cfg.include && !Array.isArray(cfg.include) ? { ...cfg.include } : {}, extra = [...(inc.hurtig || [])];
    const addExtra = (it) => {
      const id = it && (it.entity || it.entity_id);
      if (!id || extra.includes(id)) return;
      extra.push(id);
      const nv = it.navn || it.name, ik = it.ikon || it.icon;
      if (nv || ik) labels[id] = { ...(nv ? { navn: nv } : {}), ...(ik ? { ikon: ik } : {}) };
    };
    if ('navn' in cfg) { if (!n.name && cfg.navn) n.name = cfg.navn; delete n.navn; }
    Object.keys(LEG_ROLE).forEach((k) => { if (typeof cfg[k] === 'string' && cfg[k].includes('.')) { role(LEG_ROLE[k], cfg[k]); delete n[k]; } });
    if (Array.isArray(cfg.hurtig)) cfg.hurtig.forEach((x) => {
      const it = typeof x === 'string' ? { entity: x } : x || {}, id = it.entity;
      if (!id) return;
      const r = M.poolRoleOf(hass, id);
      if (!(r && role(r, id))) addExtra(it);
    });
    if (Array.isArray(cfg.include)) cfg.include.forEach((x) => addExtra(typeof x === 'string' ? { entity: x } : x));
    if (cfg.ents && typeof cfg.ents === 'object') Object.keys(cfg.ents).forEach((k) => role(k, cfg.ents[k]));
    if (Array.isArray(cfg.forvalg) && cfg.forvalg.length && !(cfg.vals && cfg.vals.targets)) n.vals = { ...(n.vals || {}), targets: cfg.forvalg.join(' ') };
    if (Array.isArray(cfg.ctl) && !cfg.controls) n.controls = cfg.ctl.map(roleKey).filter((k) => CTL[k]);
    if (cfg.ctlHide && !cfg.hidden_controls) n.hidden_controls = hidList(cfg.ctlHide).map(roleKey);
    if (cfg.tabHide && !cfg.hidden_tabs) n.hidden_tabs = hidList(cfg.tabHide);
    // basseng-v3-cfg (designets localStorage) – bare det config ikke har fra før
    if (pc && typeof pc === 'object') {
      if (pc.ents) Object.keys(pc.ents).forEach((k) => role(k, pc.ents[k]));
      if (Array.isArray(pc.ctl) && !n.controls) n.controls = pc.ctl.map(roleKey).filter((k) => CTL[k]);
      if (pc.ctlHide && !n.hidden_controls && hidList(pc.ctlHide).length) n.hidden_controls = hidList(pc.ctlHide).map(roleKey);
      if (Array.isArray(pc.tabs) && !n.tabs) n.tabs = pc.tabs.filter((k) => TABS[k]);
      if (pc.tabHide && !n.hidden_tabs && hidList(pc.tabHide).length) n.hidden_tabs = hidList(pc.tabHide);
      if (pc.vals && typeof pc.vals === 'object') {
        const v = { ...(n.vals || {}) };
        Object.keys(pc.vals).forEach((l) => { const k = LBL[l] || (VDEF[l] !== undefined ? l : null); if (k && v[k] == null && pc.vals[l] !== '') v[k] = pc.vals[l]; });
        if (Object.keys(v).length) n.vals = v;
      }
      ['anim', 'chips'].forEach((k) => { if (pc[k] === false && n[k] == null) n[k] = false; });
    }
    LEG_KEYS.forEach((k) => { delete n[k]; });
    if (Object.keys(ov).length) n.overrides = ov; else delete n.overrides;
    if (extra.length) n.include = { ...inc, hurtig: extra }; else if (Array.isArray(cfg.include)) delete n.include;
    if (Object.keys(labels).length) n.labels = labels;
    return n;
  };
  // Popup-oppsett fra et importert/gammelt Bubble-popup (med ki-basseng-card, ki-basseng-hero-card og
  // gap-card) → config for ÉTT msh-basseng-card. null = ikke et gammelt basseng-popup.
  const LEG_TAGS = ['ki-basseng-card', 'ki-basseng-hero-card', 'msh-basseng-hero-card'];
  const tagOfC = (c) => String((c && c.type) || '').replace(/^custom:/, '');
  const cardsDeep = (o, out = [], d = 0) => {
    if (!o || typeof o !== 'object' || d > 12) return out;
    if (Array.isArray(o)) { o.forEach((x) => cardsDeep(x, out, d + 1)); return out; }
    if (o.type) out.push(o);
    if (Array.isArray(o.cards)) cardsDeep(o.cards, out, d + 1);
    if (o.card && typeof o.card === 'object') cardsDeep(o.card, out, d + 1);
    return out;
  };
  M.bassengLegacyCard = function (popup) {
    const list = cardsDeep(popup && popup.cards);
    const main = list.find((c) => tagOfC(c) === 'ki-basseng-card'), hero = list.find((c) => ['ki-basseng-hero-card', 'msh-basseng-hero-card'].includes(tagOfC(c)));
    if (!main && !hero) return null;
    const strip = (c) => { if (!c) return {}; const { type, card_id, view_layout, grid_options, layout_options, ...r } = c; return r; };
    const h = strip(hero), m = strip(main), out = { ...h, ...m };
    if (h.navn && !m.navn) out.navn = h.navn; // navn flyttes fra toppkortet
    const own = list.find((c) => tagOfC(c) === 'msh-basseng-card');
    return { ...strip(own), ...out };
  };
  M.bassengLegacyTest = (popup) => cardsDeep(popup && popup.cards).some((c) => LEG_TAGS.includes(tagOfC(c)));

  const TV = (k, n) => (M.tabH ? M.tabH.v(k, n) : n + 'px'); // 33.4: fanehøyde-variabler (05-tab-bar.js)
  class Basseng extends M.Card {
    static get cardName() { return 'Basseng'; }
    static get defaults() { return { controls: CTL_STD.slice(), hidden_controls: CTL_HID.slice(), tabs: ['ov', 'heat', 'klor', 'spr'] }; }
    static getStubConfig() { return { card_id: 'pop-basseng' }; }
    // Bunnluft over navbaren (fiks 26.14: minst 120 px + safe area; ingen gap-card): nav-h 68 + 8 + 44
    static get spacingDefaults() { return { ...(M.SPACING || {}), pad_bottom: 44 }; }
    static get schema() {
      return [
        AREA_F,
        { type: 'text', name: 'name', label: 'Navn i toppkortet', placeholder: 'Bassenget' },
        { type: 'overrides', id: 'overrides', label: 'Entiteter', fields: ovrFields() },
        { type: 'lists', id: 'entities', label: 'Hurtigknapper, brytere og navn', lists: (h, c) => { const a = M.poolAuto(h, c); return [{ key: 'hurtig', label: 'Ekstra hurtigknapper', ids: [], domains: ['switch', 'light', 'input_boolean', 'fan', 'script', 'scene', 'cover', 'valve'] }, { key: 'flagg', label: 'Brytere (Oversikt)', ids: a.flags, domains: ['switch', 'input_boolean'] }, { key: 'personer', label: 'Navn i klorloggen', ids: a.people, domains: ['person'] }]; } },
        { type: 'order', name: 'controls', hiddenName: 'hidden_controls', label: 'Hurtigknapper (vises når rollen finnes)', options: Object.keys(CTL).map((k) => [k, CTL[k][3] ? `${CTL[k][1]} (${CTL[k][3]})` : CTL[k][1]]) },
        ...(M.startTab ? [M.startTab.field({ items: (h, c) => { const hid = new Set(c.hidden_tabs || []), o = (Array.isArray(c.tabs) ? c.tabs : []).filter((k) => TABS[k]); Object.keys(TABS).forEach((k) => { if (!o.includes(k)) o.push(k); }); return o.filter((k) => !hid.has(k)).map((k) => ({ key: k, label: TABS[k] })); } })] : []), // 36.5: startfane over Faner
        { type: 'order', name: 'tabs', hiddenName: 'hidden_tabs', label: 'Faner', start: true, options: Object.keys(TABS).map((k) => [k, TABS[k]]) },
        { type: 'section', id: 'styr', label: 'Styring og verdier', icon: 'mdi:tune', fields: CFG.flatMap(([, title, rows]) => [{ type: 'info', label: title.toUpperCase() }].concat(rows.map(([k, l, sub, v]) => (typeof v === 'boolean' ? { type: 'boolean', name: 'vals.' + k, label: l, help: sub, default: v } : { type: 'text', name: 'vals.' + k, label: l, help: sub, placeholder: String(v) })))) },
        { type: 'section', label: 'Visning', icon: 'mdi:eye-outline', fields: [
          { type: 'boolean', name: 'anim', label: 'Animasjoner', help: 'Bølger, bobler, vifte og damp i toppkortet', default: true },
          { type: 'boolean', name: 'hero_follow', label: 'Toppkortet følger fanen', help: 'Av: bassengbildet står fast', default: true },
          { type: 'boolean', name: 'show_sentence', label: 'Setning i Oversikt', help: '«Vannet når 25° om ca …»', default: true },
          { type: 'select', name: 'quick_mode', label: 'Knappene viser', options: [['begge', 'Ikon + tekst'], ['ikon', 'Bare ikon']], default: 'begge' },
          { type: 'select', name: 'tab_mode', label: 'Fanene viser', options: [['tekst', 'Tekst'], ['ikon', 'Ikon'], ['begge', 'Begge']], default: 'tekst' }, { type: 'boolean', name: 'toasts', label: 'Bekreftelsesmeldinger', default: true }, { type: 'gap' }, ...(M.tabH ? [M.tabH.field({ items: (h, c) => (Array.isArray(c.tabs) && c.tabs.length ? c.tabs : Object.keys(TABS)).filter((k) => TABS[k]).map((k) => TABS[k]), native: 44, gear: true })] : [])] }, // 33.4: fanehøyde i Visning (ingen Faner-fane)
      ];
    }
    get cardSize() { return 10; }
    // Gammel config (hurtig:, navn, ctl/ctlHide …) leses normalisert til den er migrert og lagret (se _migrate)
    get config() {
      const c = this._config || {};
      if (this._normSrc !== c) { this._normSrc = c; this._norm = M.poolLegacy(c) ? { ...Basseng.defaults, ...M.poolNorm(c, this._hass) } : c; }
      return this._norm;
    }
    // Fiks 26.14 · migrering, lagres én gang per kort: `hurtig:`/ki-basseng-nøkler → overrides/include, og designets
    // basseng-v3-cfg (localStorage) → config. Bare det levende kortet, ikke mens et utkast er åpent.
    _migrate() {
      const raw = this._rawConfig, id = raw && raw.card_id, h = this._hass;
      if (!id || !this.isConnected || !h || !Object.keys(h.states || {}).length || !M.store || !M.store.loaded || (M.draftOf && M.draftOf(this))) return;
      const pc = M.poolLS();
      if (!M.poolLegacy(raw) && !pc) return;
      const done = (M._poolMig = M._poolMig || new Set());
      if (done.has(id)) return;
      done.add(id);
      const nc = M.poolNorm(raw, h, pc);
      Promise.resolve(M.saveCardConfig(h, raw, nc, { toasts: false, card: this }))
        .then(() => { if (pc) { try { localStorage.removeItem(M.POOL_LS); } catch (e) { /* */ } } })
        .catch((e) => console.warn('[ki-msh] basseng-migrering', e));
    }
    _v(k) { const v = this.config.vals && this.config.vals[k]; return v != null && v !== '' ? v : VDEF[k]; }
    _toast(t) { M.toast(t, { enabled: this.config.toasts !== false }); }
    onOpen() { this._loadHist(); this._loadKlor(); }
    _range() { const r = this.ui.range; return RANGES.some((x) => x[0] === r) ? r : '24t'; }
    setRange(k) { if (!RANGES.some((x) => x[0] === k) || k === this._range()) return; this.setUI({ range: k }); this._loadHist(); }
    async _loadHist() {
      const e = M.poolEnts(this.hass, this.config), hrs = (RANGES.find((x) => x[0] === this._range()) || RANGES[0])[2];
      const d0 = new Date(); d0.setHours(0, 0, 0, 0);
      if (e.water) { const h = await M.history(this.hass, [e.water], hrs); this._hist = h[e.water] || []; this._histH = hrs; }
      const ids = [!e.pumped && e.pump, e.spr].filter(Boolean);
      if (ids.length) {
        const h = await M.stateHistory(this.hass, ids, d0.getTime());
        const isOn = (s) => ['on', 'open', 'opening'].includes(s);
        if (!e.pumped && e.pump) { const pts = h[e.pump] || []; this._pumpedSec = pts.length ? M.onSeconds(pts, isOn, d0.getTime(), Date.now()) : null; }
        if (e.spr) { const pts = h[e.spr] || []; this._sprUsedSec = pts.length ? M.onSeconds(pts, isOn, d0.getTime(), Date.now()) : 0; }
      }
      this.update();
    }
    async _loadKlor() {
      const e = M.poolEnts(this.hass, this.config);
      if (!e.klor_calendar) { this._klor = null; return; }
      const now = new Date(), a = new Date(now.getFullYear(), now.getMonth() - 2, 1), b = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      this._klor = await M.calEvents(this.hass, e.klor_calendar, a.getTime(), b.getTime());
      this.update();
    }
    // Fiks 36.5: startfane ved åpning (MSH.startTab, 05-start-tab.js) – synlige faner i rekkefølge
    static get startTabSpec() { return { tabs: (card) => card._tabs(card._e || M.poolEnts(card.hass, card.config)) }; }
    // Faner uten data skjules automatisk (Spreder uten spreder …). Uten noen entiteter (popupen slått på manuelt) vises
    // Oversikt, så popupen aldri blir tom.
    _tabs(e) {
      const c = this.config, hid = new Set(c.hidden_tabs || []);
      const has = { ov: true, heat: !!(e.heat || e.water || e.target), klor: !!(e.klor_calendar || e.klor_last || e.klor || e.ph), spr: !!e.spr };
      const order = (Array.isArray(c.tabs) ? c.tabs : []).filter((k) => TABS[k]);
      Object.keys(TABS).forEach((k) => { if (!order.includes(k)) order.push(k); });
      return order.filter((k) => !hid.has(k) && has[k]);
    }
    // Hurtigknapper: rekkefølge (controls) og skjuling (hidden_controls); bare roller som ble funnet
    _ctls(e) {
      const c = this.config, hid = new Set((Array.isArray(c.hidden_controls) ? c.hidden_controls : CTL_HID).map(roleKey));
      const order = (Array.isArray(c.controls) ? c.controls.map(roleKey) : []).filter((k) => CTL[k]);
      CTL_STD.forEach((k) => { if (!order.includes(k)) order.push(k); });
      return order.filter((k, i) => order.indexOf(k) === i && !hid.has(k) && e[k]);
    }
    _target(e) {
      const s = this.s(e.target);
      if (!s) return null;
      if (/^(climate|water_heater)\./.test(e.target)) return s.attributes.temperature != null ? Number(s.attributes.temperature) : null;
      return M.isNum(s.state) ? Number(s.state) : null;
    }
    // Rad med bryter (designets rows/sw): rosa bryter med hvit knott (prosjektets brytere, Fiks 26)
    _sw(on) { return `<span class="trk" style="background:${on ? M.SWITCH_ON || C.pink : K.ctrl}"><span class="knb" style="left:${on ? 26 : 4}px"></span></span>`; }
    _row(r, i) {
      const attrs = r.act ? `data-act="${r.act}" ${r.attrs || ''}` : '';
      return `<button class="lr ${i ? 'bt' : ''}" data-key="${esc(r.key)}" ${attrs} ${r.ent ? `data-ent="${esc(r.ent)}"` : ''} style="${r.dim ? 'opacity:.55' : ''}">
          ${M.icon(r.icon, 22, 'color:var(--ki-text-1, #d6d6d6)')}
          <span class="lrt"><span class="lrl">${esc(r.label)}</span><span class="lrs">${esc(r.sub || '')}</span></span>
          ${r.val ? `<span class="lrv">${esc(r.val)}</span>` : ''}${r.sw != null ? this._sw(r.sw) : ''}</button>`;
    }
    _rows(list) { return list.length ? `<div class="rows" data-section="rows">${list.map((r, i) => this._row(r, i)).join('')}</div>` : ''; }
    // Graf i toppkortet (Varme): vanntemperatur for valgt periode, stiplet mållinje (viewBox 300 × 80)
    _graph(tgt) {
      const e = this._e || {}, hrs = (RANGES.find((x) => x[0] === this._range()) || RANGES[0])[2];
      const tw = this.n(e.water), pts = (this._histH === hrs ? this._hist || [] : []).slice();
      if (!pts.length && tw == null) return null;
      const vals = pts.length ? M.sample(pts, 48, hrs) : [tw, tw];
      const all = vals.concat(tgt != null ? [tgt] : []);
      let lo = Math.min(...all), hi = Math.max(...all);
      if (hi - lo < 1) { lo -= 0.5; hi += 0.5; }
      const pad = (hi - lo) * 0.12; lo -= pad; hi += pad;
      const y = (v) => (78 - ((v - lo) / (hi - lo)) * 74).toFixed(1);
      const line = vals.map((v, i) => `${i ? 'L' : 'M'}${((i / (vals.length - 1)) * 300).toFixed(1)},${y(v)}`).join(' ');
      return { line, area: line + ' L300,80 L0,80 Z', ty: tgt != null ? y(tgt) : null };
    }
    // Klor: siste/neste tablett, hvem, uka (toppkortet) – fra klorkalenderen (eller input_datetime/counter)
    _klorInfo() {
      const e = this._e || {}, every = M.parseNum(this._v('klor_every'), 7), last = this._lastKlor();
      const names = (e.people || []).map((id) => M.name(this.hass, id));
      const next = last ? new Date(last.t0 + every * 86400000) : null;
      const d0 = new Date(); d0.setHours(0, 0, 0, 0);
      const dayOf = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
      const today = !!last && last.t0 >= d0.getTime();
      const left = next ? Math.ceil((next.getTime() - Date.now()) / 86400000) : null;
      const who = last ? names.find((nm) => (last.summary || '').toLowerCase().includes(nm.toLowerCase())) || null : null;
      const days = new Set(this._klorEvents().map((ev) => dayOf(ev.t0)));
      if (last) days.add(dayOf(last.t0));
      const week = Array.from({ length: 7 }, (_, i) => { const d = new Date(d0); d.setDate(d.getDate() - 6 + i); return { l: d.toLocaleDateString('nb-NO', { weekday: 'short' }).replace('.', '').slice(0, 2), on: days.has(d.getTime()), today: i === 6 }; });
      const nextShort = next ? next.toLocaleDateString('nb-NO', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\.(?=\s)/, '') : '';
      return { every, last, next, nextShort, today, left, who, week, names };
    }
    _durNow(e) {
      const durs = nums(this._v('spr_durs'), '5 10 15 20 30').slice(0, 5), ds = this.s(e.spr_duration);
      let dur = ds && M.isNum(ds.state) ? null : this.ui.dur; // varighets-entitet er sannheten (stepperen skriver til den)
      if (dur == null && ds && M.isNum(ds.state)) dur = Number(ds.state) / (/s$|sek/.test(ds.attributes.unit_of_measurement || '') ? 60 : 1);
      if (dur == null) dur = durs[0];
      return dur;
    }
    // Spreder: går/står, gjenstående tid (fra sist endret + varighet), brukt i dag
    _sprInfo() {
      const e = this._e || {}, s = this.s(e.spr), running = M.onState(s), dur = this._durNow(e);
      let remain = null;
      if (running && s) remain = Math.max(0, Math.round(dur * 60 - (Date.now() - new Date(s.last_changed).getTime()) / 1000));
      const mm = remain != null ? `${Math.floor(remain / 60)}:${String(remain % 60).padStart(2, '0')}` : '';
      return { ent: !!s, running, dur, remain, mm, sub: running ? `${mm} igjen` : `Klar for ${M.nf(dur, 0)} min` };
    }
    render() {
      const c = this.config, e = M.poolEnts(this.hass, c);
      this._e = e;
      this._migrate();
      const tl = this._tabs(e), cur = tl.includes(this.ui.tab) ? this.ui.tab : tl[0] || 'ov';
      this._tl = tl; this._cur = cur;
      const idx = Math.max(0, tl.indexOf(cur)), n = tl.length || 1, tm = c.tab_mode || 'tekst';
      const tabs = tl.map((k, i) => `<span class="gti" role="tab" aria-selected="${i === idx}" data-key="${k}" title="${esc(TABS[k])}" style="color:${i === idx ? INK : 'var(--ki-text-2, #afafaf)'}">${tm !== 'tekst' ? M.icon(TAB_IC[k], 20) : ''}${tm !== 'ikon' ? `<span class="gtl">${esc(TABS[k])}</span>` : ''}</span>`).join('');
      const body = cur === 'heat' ? this._heat(e) : cur === 'klor' ? this._klorTab(e) : cur === 'spr' ? this._spr(e) : this._ov(e);
      // Fiks 42 C.4 · rekkefølge som designet: toppkort (MSH.HEROES-sloten) → hurtigknapper → faner + tannhjul → fanens innhold
      return `<div class="wrap">
        ${this._quick(e)}
        <div class="tabrow" data-section="tabs"${M.tabH && M.tabH.style(c) ? ` style="${M.tabH.style(c)}"` : ''}>
          ${tl.length ? `<div class="gt"><div class="gtg" style="grid-template-columns:repeat(${n},minmax(max-content,1fr))"><span class="ind" style="left:${(idx / n) * 100}%;width:${100 / n}%"></span>${tabs}</div></div>` : ''}
          <button class="cfg press" data-act="customize" title="Tilpass basseng" aria-label="Tilpass basseng">${M.icon('settings', 22)}</button>
        </div>
        ${tl.length ? `<div class="body" data-tab="${cur}">${body}</div>` : M.emptyState('Alle faner er skjult', 'sections')}
      </div>`;
    }
    /* Fiks 33.1 · setningen i Oversikt (fasit Basseng v4 popup linje 135, showSent): ÉN flytende <p class="sent"> med
     * inline-piller – aldri flex/grid, aldri løse tekstnoder. «Vannet når [mål°] om ca [X t Y min]. Pumpa går nå.» /
     * «Vannet holder [mål°] · [ingen oppvarming]. …». Mål = climate/water_heater.temperature (eller number), vanntemp =
     * vanntemperatursensoren, ETA = integrasjonens sensor (rollen eta) eller beregnet som i designet (210 min/°,
     * boost ×0,7, eco ×1,4). Mangler data → pille «–», setningen skjules aldri stille. Av/på: show_sentence. */
    _etaMin(e, diff) {
      const s = this.s(e.eta);
      if (s && s.state != null && !['unknown', 'unavailable', ''].includes(s.state)) {
        const dc = s.attributes.device_class, u = String(s.attributes.unit_of_measurement || '').toLowerCase();
        if (dc === 'timestamp') { const t = new Date(s.state).getTime(); if (!isNaN(t)) return Math.max(0, Math.round((t - Date.now()) / 60000)); }
        else if (M.isNum(s.state)) { const v = Number(s.state); return Math.max(0, Math.round(/^(h|t|timer|hours?)$/.test(u) ? v * 60 : /^(s|sek|sec|seconds?)$/.test(u) ? v / 60 : /^d/.test(u) ? v * 1440 : v)); }
      }
      if (diff == null) return null;
      const md = String((this.s(e.mode) || {}).state || '').toLowerCase();
      return Math.round(diff * 210 * (/boost|turbo|maks/.test(md) ? 0.7 : /eco|spar/.test(md) ? 1.4 : 1));
    }
    _sentParts(e) {
      const tw = this.n(e.water), tgt = this._target(e), pumpS = this.s(e.pump);
      const diff = tw != null && tgt != null ? tgt - tw : null;
      const hold = diff != null && diff <= 0;
      let eta = '–';
      if (!hold) { const m = this._etaMin(e, diff); if (m != null) eta = `${Math.floor(m / 60)} t ${m % 60} min`; }
      return {
        sentA: hold ? 'Vannet holder' : 'Vannet når', targetTxt: tgt != null ? `${M.nf(tgt, tgt % 1 ? 1 : 0)}°` : '–',
        sentB: hold ? '·' : 'om ca', eta: hold ? 'ingen oppvarming' : eta, pumpSent: pumpS ? (M.onState(pumpS) ? 'Pumpa går nå.' : 'Pumpa står.') : '',
      };
    }
    _sent(e) {
      const c = this.config, on = c.show_sentence != null ? c.show_sentence : c.showSent != null ? c.showSent : c.sent; // showSent/sent = designets navn
      if (on === false) return '';
      const p = this._sentParts(e), pill = (t) => `<span class="pill">${esc(t)}</span>`;
      // én linje uten linjeskift/innrykk inni <p>: ingen tomme tekstnoder, punktum rett etter eta-pillen
      return `<p class="sent num" data-section="sent" data-key="sent">${esc(p.sentA)} ${pill(p.targetTxt)} ${esc(p.sentB)} ${pill(p.eta)}.${p.pumpSent ? ' ' + esc(p.pumpSent) : ''}</p>`;
    }
    // Hurtigknapper (designets quick: 72 px, radius 22; på = farget/rosa flate, av = ring) + ekstra fra include
    _quick(e) {
      const cl = this._ctls(e), ico = this.config.quick_mode === 'ikon';
      const btn = (key, id, ic, l, col, title) => {
        const st = this.s(id), on = M.onState(st);
        const bg = on ? (col ? `linear-gradient(160deg,${col},color-mix(in srgb, ${col} 80%, transparent))` : PINK) : 'transparent';
        return `<button class="tile press" data-key="${esc(key)}" data-act="ctl" data-k="${esc(key)}" data-ent="${esc(id)}" title="${esc(title || l)}" aria-pressed="${on}" style="background:${bg};color:${on ? 'var(--ki-on-accent, #141414)' : 'var(--ki-text-2, #bdbdbd)'};box-shadow:${on ? '0 4px 14px rgb(0 0 0 / .25)' : 'inset 0 0 0 1.5px var(--ki-ctrl, #4a4a4a)'}">${M.icon(ic, 24)}${ico ? '' : `<span class="tl ell">${esc(l)}</span>`}</button>`;
      };
      const L = cl.map((k) => { const [ic, l, col, t] = CTL[k]; return btn(k, e[k], ic, l, col, t ? `${l} · ${t}` : l); });
      (e.extra || []).forEach((x) => { const s = this.s(x.entity); L.push(btn('x:' + x.entity, x.entity, x.ikon || (s && s.attributes.icon) || M.domainIcon(x.entity, s), x.navn || M.name(this.hass, x.entity, M.areaName(this.hass, e.area)), null)); });
      if (!L.length) return `<div class="qempty">${M.emptyState('Fant ingen hurtigknapper (lys, pumpe, varme …)', 'overrides')}</div>`;
      return `<div class="ctl" data-section="quick" style="grid-template-columns:repeat(${Math.max(1, L.length)},minmax(0,1fr))">${L.join('')}</div>`;
    }
    /* ---------------- Oversikt: setning → «I dag» → Automatikk (brytere + Klor) */
    _ov(e) {
      const val = (id, d = 1) => { const v = this.n(id); return v != null ? M.nf(v, d) : '–'; };
      const unit = (id, u) => { const s = this.s(id); return (s && s.attributes.unit_of_measurement) || u; };
      const date = new Date().toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' });
      let pumped = '–';
      if (e.pumped) { const v = this.n(e.pumped), u = unit(e.pumped, 'h'); pumped = v == null ? '–' : M.nf(/min/.test(u) ? v / 60 : v, 1); }
      else if (this._pumpedSec != null) pumped = M.nf(this._pumpedSec / 3600, 1);
      const turnT = M.parseNum(this._v('turnovers'), 3.75);
      const rows = [['Pumpet', pumped, 't', e.pumped || e.pump], ['Omsetninger', val(e.turnover, 2), `av ${M.nf(turnT, 2)}`, e.turnover], ['Spart', val(e.savings, 0), unit(e.savings, 'kr'), e.savings]];
      if (e.ph) rows.push(['pH', val(e.ph, 1), '', e.ph]); // 42 C.2: pH/klor (ORP) når de finnes
      if (e.klor) rows.push([M.poolIsOrp(this.s(e.klor)) ? 'ORP' : 'Klor', val(e.klor, M.poolIsOrp(this.s(e.klor)) ? 0 : 1), unit(e.klor, ''), e.klor]);
      const today = rows.map(([l, v, u, id]) => `<div class="tr bt" data-key="${esc(l)}" ${id ? `data-act="more" data-id="${esc(id)}"` : ''}><span class="trl">${esc(l)}</span><span class="trvw"><span class="trv num">${esc(v)}</span><span class="tru">${esc(u)}</span></span></div>`).join('');
      // Automatikk: brytere (Automatikk, Prisstyring, Varmeprioritet + egne) og Klor-flisen (ring = dager siden / intervall)
      const known = { [e.auto]: ['smart_toy', 'Automatikk'], [e.price]: ['savings', 'Prisstyring'], [e.prio]: ['heat', 'Varmeprioritet'] };
      const autos = e.flags.map((id) => {
        const s = this.s(id), on = M.isOn(s), k = known[id] || [M.domainIcon(id, s), M.name(this.hass, id, M.areaName(this.hass, e.area))];
        return `<button class="au press" data-key="${esc(id)}" data-act="toggle" data-id="${esc(id)}" data-ent="${esc(id)}"><span class="aur"><span class="aui" style="background:${on ? PINK : K.inner};color:${on ? INK : 'var(--ki-text, #fafafa)'}">${M.icon(k[0], 24)}</span></span><span class="aut"><span class="aul ell">${esc(k[1])}</span><span class="aus ell">${on ? 'På' : 'Av'}</span></span></button>`;
      });
      if (this._tl.includes('klor')) {
        const k = this._klorInfo(), days = k.last ? Math.max(0, Math.floor((Date.now() - k.last.t0) / 86400000)) : null;
        const p = days != null ? Math.min(100, (days / Math.max(1, k.every)) * 100) : 0, due = days != null && days >= k.every - 1, kc = due ? C.orange : C.green;
        autos.push(`<button class="au press" data-key="klor" data-act="gotab" data-t="klor"><span class="aur" style="background:conic-gradient(${kc} ${p.toFixed(0)}%, ${M.theme ? M.theme.whiteA(0.08) : 'rgb(255 255 255 / .08)'} 0)"><span class="aui" style="width:50px;height:50px;background:${K.inner}">${M.icon('mdi:pill', 24)}</span></span><span class="aut"><span class="aul">Klor</span><span class="aus ell" style="${due ? `color:var(--ki-orange-text, ${C.orange})` : ''}">${days == null ? '–' : days === 0 ? 'Lagt i i dag' : `${days} d siden`}</span></span></button>`);
      }
      return `${this._sent(e)}
        <div class="today" data-section="today"><div class="dh">${M.icon('today', 18)}<span class="dht">I dag ·</span><span class="dhd">${esc(date)}</span></div>${today}</div>
        ${autos.length ? `<div class="g2" data-section="autos">${autos.join('')}</div>` : ''}`;
    }
    /* ---------------- Varme: mål-stepper → moduser → setning → Nattsenking/Pooltak/Vintermodus */
    _heat(e) {
      const tw = this.n(e.water), tgt = this._target(e), hs = this.s(e.heat), heat = M.onState(hs), hp = this.n(e.heat_power);
      const pill = (t) => `<span class="pill">${esc(t)}</span>`;
      const ms = this.s(e.mode), opts = (ms && ms.attributes.options) || [];
      const modes = ms ? `<div class="hs noscroll" data-section="modes">${opts.map((o) => `<button class="md press" data-key="${esc(o)}" data-act="mode" data-v="${esc(o)}" data-haptic="selection" style="background:${ms.state === o ? PINK : K.card};color:${ms.state === o ? INK : 'var(--ki-text, #fafafa)'}">${M.icon(modeIcon(o), 18)}${esc(o)}</button>`).join('')}</div>` : '';
      const cost = this.s(e.cost);
      const kr = cost && M.isNum(cost.state) ? `${M.nf(Number(cost.state), 0)} ${/(nok|kr|sek)/i.test(cost.attributes.unit_of_measurement || '') || !cost.attributes.unit_of_measurement ? 'kr' : cost.attributes.unit_of_measurement}` : null;
      const sent = hs && heat ? `Varmepumpa trekker ${pill(hp != null ? `${M.nf(hp >= 100 ? hp / 1000 : hp, 1)} kW` : '–')}.${kr ? ` Strømmen har kostet ${pill(kr)} i dag.` : ''}`
        : hs ? `Varmepumpa er ${pill('av')}. Vannet holder ${pill(tw != null ? `${M.nf(tw, 1)}°` : '–')}.` : `Vannet holder ${pill(tw != null ? `${M.nf(tw, 1)}°` : '–')}.`;
      const tog = (k, l, icon, sub) => { const id = e[k], s = this.s(id), on = M.onState(s); return { key: k, icon, label: l, sub: s ? sub(on) : 'Velg entitet', sw: on, act: id ? 'ctl' : 'customize', attrs: id ? `data-k="${k}"` : 'data-section="overrides"', ent: id, dim: !s }; };
      const rows = [
        tog('night', 'Nattsenking', 'bedtime', (on) => (on ? 'Holder varmen · senker om natta' : 'Av')),
        tog('cover', 'Pooltak', 'roofing', (on) => (on ? 'Lukket · sparer varme' : 'Åpent')),
        tog('winter', 'Vintermodus', 'ac_unit', (on) => (on ? 'På' : 'Av')),
      ];
      return `
        <div class="stp" data-section="target" ${e.target ? `data-ent="${esc(e.target)}"` : ''}>
          <button class="stb press" data-act="tstep" data-v="-1" data-haptic="selection" aria-label="Senk mål">${M.icon('remove', 26)}</button>
          <span class="stm"><span class="stl">Mål</span><span class="stv num">${tgt != null ? `${M.nf(tgt, tgt % 1 ? 1 : 0)}°` : '–'}</span></span>
          <button class="stb press" data-act="tstep" data-v="1" data-haptic="selection" aria-label="Øk mål">${M.icon('add', 26)}</button>
        </div>
        ${modes}
        <p class="sent num" data-key="heatsent">${sent}</p>
        ${this._rows(rows)}`;
    }
    /* ---------------- Klor */
    _klorEvents() { return (this._klor || []).filter((ev) => /klor|chlor|tablett/i.test(ev.summary || '') || this._e.klor_calendar && /klor|chlor/.test(this._e.klor_calendar)); }
    _lastKlor() {
      const L = this._klorEvents().filter((ev) => ev.t0 <= Date.now());
      if (L.length) return L[L.length - 1];
      // uten klorkalender: input_datetime (tidspunkt) eller counter (sist endret) for siste klortablett
      const s = this._e && this._e.klor_last && this.s(this._e.klor_last);
      if (!s) return null;
      const t = s.entity_id.startsWith('input_datetime.') ? new Date(String(s.state).replace(' ', 'T')).getTime() : new Date(s.last_changed).getTime();
      return isNaN(t) ? null : { t0: t, summary: '' };
    }
    _qtyOf(ev) { const m = /[×x](\d+)|(\d+)\s*stk/i.exec(ev.summary || ''); return m ? Number(m[1] || m[2]) : 1; }
    _whoOf(ev, names) { return names.find((nm) => (ev.summary || '').toLowerCase().includes(nm.toLowerCase())) || ''; }
    _klorTab(e) {
      const cal = e.klor_calendar, k = this._klorInfo(), names = k.names;
      const now = new Date(), y = now.getFullYear(), m = now.getMonth();
      const d0 = new Date(); d0.setHours(0, 0, 0, 0);
      const monthEv = this._klorEvents().filter((ev) => { const d = new Date(ev.t0); return d.getFullYear() === y && d.getMonth() === m; });
      const todayEv = monthEv.filter((ev) => ev.t0 >= d0.getTime());
      const qty = this.ui.qty || 1;
      const people = e.people.map((id, i) => {
        const nm = names[i], cnt = monthEv.filter((ev) => this._whoOf(ev, [nm])).reduce((t, ev) => t + this._qtyOf(ev), 0), act = todayEv.some((ev) => this._whoOf(ev, [nm]));
        return `<button class="pp press" data-key="${esc(id)}" data-act="log" data-name="${esc(nm)}" data-haptic="success" style="background:${act ? C.green : K.card};color:${act ? 'var(--ki-on-accent, #10261a)' : 'var(--ki-text, #fafafa)'}"><span class="ppt">${M.icon('person', 22)}<span class="ppc">${cal ? cnt : '–'}</span></span><span class="ppn ell">${esc(nm)}</span></button>`;
      }).join('');
      const counts = [1, 2, 3].map((q) => `<button class="qt press" data-key="q${q}" data-act="qty" data-q="${q}" data-haptic="selection" style="background:${qty === q ? PINK : K.card};color:${qty === q ? INK : 'var(--ki-text, #fafafa)'}">${q} stk</button>`).join('');
      const off = (new Date(y, m, 1).getDay() + 6) % 7, dim = new Date(y, m + 1, 0).getDate();
      const mark = {};
      monthEv.forEach((ev) => { const d = new Date(ev.t0).getDate(), w = this._whoOf(ev, names); mark[d] = w ? w[0].toUpperCase() : (mark[d] || '·'); });
      const cells = Array.from({ length: Math.ceil((off + dim) / 7) * 7 }, (_, i) => {
        const d = i - off + 1, inM = d >= 1 && d <= dim, mk = inM && mark[d], td = inM && d === now.getDate();
        return `<span class="cd" style="background:${mk ? C.green : 'transparent'};color:${mk ? 'var(--ki-on-accent, #10261a)' : inM ? 'var(--ki-text-1, #d6d6d6)' : 'transparent'};${td ? 'box-shadow:inset 0 0 0 1.5px var(--ki-text, #fafafa);' : ''}"><span>${inM ? d : ''}</span><span class="cdm">${mk && mk !== '·' ? esc(mk) : ''}</span></span>`;
      }).join('');
      const monthName = now.toLocaleDateString('nb-NO', { month: 'long' });
      const remind = this._v('klor_remind');
      const rows = [{ key: 'remind', icon: 'notifications', label: 'Påminnelse', sub: `Hver ${M.nf(k.every, k.every % 1 ? 1 : 0)}. dag · oftere i varmt vann`, sw: remind === true || remind === 'true', act: 'vtog', attrs: 'data-v="klor_remind"' }];
      return `
        <span class="hint">Hvem la i? Trykk på navnet.</span>
        ${people ? `<div class="g3" data-section="people">${people}</div>` : `<button class="la press" data-act="log" data-name="" data-haptic="success"><span class="lai">${M.icon('mdi:pill', 22)}</span>Logg klortablett</button>`}
        <div class="qts">${counts}<button class="qt undo press" data-key="undo" data-act="undo" data-haptic="selection" style="background:${K.card}">${M.icon('mdi:undo', 18)}Angre siste</button></div>
        ${this._rows(rows)}
        <div class="kal" data-section="kal" ${cal ? `data-ent="${esc(cal)}"` : ''}>
          <div class="kalh"><span style="font-size:15px;font-weight:500">${esc(M.cap(monthName))} ${y}</span><span class="kalc">${cal ? `${monthEv.reduce((t, ev) => t + this._qtyOf(ev), 0)} i ${esc(monthName)}` : 'Velg klorkalender i Tilpass'}</span></div>
          <div class="calg">${['ma', 'ti', 'on', 'to', 'fr', 'lø', 'sø'].map((w) => `<span class="wd">${w}</span>`).join('')}${cells}</div>
        </div>`;
    }
    /* ---------------- Spreder: start/stopp (fremdrift) → varigheter → brukt i dag → Program/Maks/Frostvakt */
    _spr(e) {
      const sp = this._sprInfo(), dur = sp.dur;
      this._dur = dur;
      const durs = nums(this._v('spr_durs'), '5 10 15 20 30').slice(0, 5);
      const maxMin = M.parseNum(this._v('spr_max'), 60), used = Math.round((this._sprUsedSec || 0) / 60);
      const frac = sp.running && sp.remain != null ? Math.max(0, Math.min(1, 1 - sp.remain / (dur * 60))) : 0;
      const prog = this._v('spr_prog'), frost = this._v('spr_frost'), isT = (v) => v === true || v === 'true';
      const rows = [
        { key: 'prog', icon: 'schedule', label: 'Program', sub: isT(prog) ? `Start hver ${this._v('spr_every')} · mellom 10 og 20` : 'Av', sw: isT(prog), act: 'vtog', attrs: 'data-v="spr_prog"' },
        { key: 'max', icon: 'hourglass_top', label: 'Maks per døgn', sub: 'Stopper når tiden er brukt', val: `${M.nf(maxMin, 0)} min`, act: 'customize', attrs: 'data-section="styr"' },
        { key: 'frost', icon: 'severe_cold', label: 'Frostvakt', sub: 'Starter ikke under 2 °C ute', sw: isT(frost), act: 'vtog', attrs: 'data-v="spr_frost"' },
      ];
      return `
        <button class="sbtn press" data-act="sprstart" data-haptic="success" ${e.spr ? `data-ent="${esc(e.spr)}"` : ''} style="background:${sp.running ? K.card : C.blue};color:${sp.running ? 'var(--ki-text, #fafafa)' : 'var(--ki-on-accent, #10233a)'}"><span class="sfill" style="width:${(frac * 100).toFixed(1)}%"></span>${M.icon(sp.running ? 'stop' : 'play_arrow', 22, 'position:relative')}<span style="position:relative">${sp.ent ? (sp.running ? `Stopp · ${sp.mm}` : `Start i ${M.nf(dur, 0)} min`) : 'Velg spreder'}</span></button>
        <div class="g5" data-section="durs">${durs.map((d) => `<button class="du press" data-key="${d}" data-act="dur" data-v="${d}" data-haptic="selection" style="background:${d === dur ? PINK : K.card};color:${d === dur ? INK : 'var(--ki-text, #fafafa)'}"><span class="duv num">${M.nf(d, 0)}</span><span class="duu">min</span></button>`).join('')}</div>
        ${e.spr_duration ? `<div class="stpc">${M.stepperHTML(this.hass, e.spr_duration, { label: 'Varighet', sub: 'Hvor lenge spreder går hver gang', key: 'stp-spr' })}</div>` : ''}
        <span class="hint">Brukt i dag ${M.nf(used, 0)} av ${M.nf(maxMin, 0)} min</span>
        ${this._rows(rows)}`;
    }
    /* ---------------- handlinger */
    async onAction(name, el, ev) {
      const d = el.dataset, e = this._e || M.poolEnts(this.hass, this.config), h = this.hass;
      if (name === 'ctl') {
        const id = String(d.k || '').startsWith('x:') ? d.k.slice(2) : e[d.k];
        if (!id) return this.customize('overrides');
        const dom = id.split('.')[0];
        if (dom === 'binary_sensor') return M.moreInfo(this, id);
        if (dom === 'climate') { const s = h.states[id]; return M.call(h, 'climate', s.state === 'off' ? 'turn_on' : 'turn_off', { entity_id: id }); }
        if (dom === 'water_heater') { const s = h.states[id]; return M.call(h, 'water_heater', s.state === 'off' ? 'turn_on' : 'turn_off', { entity_id: id }); }
        if (dom === 'cover') { const s = h.states[id]; return M.call(h, 'cover', ['closed', 'closing'].includes(s && s.state) ? 'open_cover' : 'close_cover', { entity_id: id }); }
        return M.toggle(h, id);
      }
      if (name === 'gotab') return this.setUI({ tab: d.t });
      if (name === 'mode') { if (!e.mode) return; return M.call(h, e.mode.split('.')[0], 'select_option', { entity_id: e.mode, option: d.v }); }
      if (name === 'tstep' || name === 'target') {
        if (!e.target) return this.customize('overrides');
        const s = h.states[e.target], A = (s && s.attributes) || {}, cur = this._target(e);
        const step = Number(A.target_temp_step || A.step) || 1, lo = A.min_temp != null ? Number(A.min_temp) : A.min != null ? Number(A.min) : 20, hi = A.max_temp != null ? Number(A.max_temp) : A.max != null ? Number(A.max) : 32;
        const v = name === 'target' ? Number(d.v) : Math.max(lo, Math.min(hi, Math.round(((cur != null ? cur : 25) + Number(d.v) * step) * 10) / 10));
        await M.setValue(h, e.target, v);
        return this._toast(`Mål satt til ${M.nf(v, v % 1 ? 1 : 0)}°`);
      }
      if (name === 'vtog') { // brytere uten entitet (Påminnelse, Program, Frostvakt) → config.vals
        const k = d.v, cur = this._v(k), on = cur === true || cur === 'true';
        return M.mshPatchConfig(this, { vals: { ...(this.config.vals || {}), [k]: !on } });
      }
      if (name === 'qty') return this.setUI({ qty: Number(d.q) });
      if (name === 'log') {
        if (!e.klor_calendar) return this.customize('overrides');
        const q = this.ui.qty || 1, t = new Date();
        const summary = `Klortablett${d.name ? ' · ' + d.name : ''}${q > 1 ? ' ×' + q : ''}`;
        await M.call(h, 'calendar', 'create_event', { entity_id: e.klor_calendar, summary, start_date_time: t.toISOString(), end_date_time: new Date(t.getTime() + 300000).toISOString() });
        this._toast(`${q} klortablett${q > 1 ? 'er' : ''} logget${d.name ? ' · ' + d.name : ''}`);
        setTimeout(() => this._loadKlor(), 800);
        return;
      }
      if (name === 'undo') {
        const last = this._lastKlor();
        if (!last || !last.uid || !e.klor_calendar) return this._toast('Ingenting å angre');
        try { await h.callWS({ type: 'calendar/event/delete', entity_id: e.klor_calendar, uid: last.uid, ...(last.recurrence_id ? { recurrence_id: last.recurrence_id } : {}) }); this._toast('Siste klortablett fjernet'); } catch (x) { this._toast('Kunne ikke angre'); }
        setTimeout(() => this._loadKlor(), 800);
        return;
      }
      if (name === 'dur') {
        const v = Number(d.v);
        this.setUI({ dur: v });
        if (e.spr_duration) { const ds = h.states[e.spr_duration]; M.setValue(h, e.spr_duration, /s$|sek/.test((ds && ds.attributes.unit_of_measurement) || '') ? v * 60 : v); }
        return;
      }
      if (name === 'sprstart') {
        if (!e.spr) return this.customize('overrides');
        const s = h.states[e.spr], on = M.onState(s), dom = e.spr.split('.')[0];
        if (on) { await M.call(h, dom === 'valve' ? 'valve' : 'homeassistant', dom === 'valve' ? 'close_valve' : 'turn_off', { entity_id: e.spr }); return this._toast('Spreder stoppet'); }
        if (e.spr_duration) { const ds = h.states[e.spr_duration]; await M.setValue(h, e.spr_duration, /s$|sek/.test((ds && ds.attributes.unit_of_measurement) || '') ? this._dur * 60 : this._dur); }
        await M.call(h, dom === 'valve' ? 'valve' : 'homeassistant', dom === 'valve' ? 'open_valve' : 'turn_on', { entity_id: e.spr });
        return this._toast(`Spreder startet · ${M.nf(this._dur, 0)} min`);
      }
      return super.onAction(name, el, ev);
    }
    afterRender() {
      // toppkortet følger fanen/dataene i vertskortet (valgt fane, graf, klor, spreder) – tegnes på nytt sammen med kortet
      if (this._heroEl && this._heroEl.update && this._heroEl.isConnected) { try { this._heroEl.update(); } catch (x) { /* */ } }
      // spreder går: nedtelling hvert sekund mens popupen er åpen (stopper av seg selv)
      const sp = this._e && this._e.spr && M.onState(this.s(this._e.spr));
      if (sp && !this._sprTick) this._sprTick = setInterval(() => { if (!this.isConnected || !(this._e && M.onState(this.s(this._e.spr)))) { clearInterval(this._sprTick); this._sprTick = null; return; } if (this._cur === 'spr' && !this._busy) this.update(); }, 1000);
      const gt = this.shadowRoot.querySelector('.gt');
      if (gt && !gt.__b) {
        gt.__b = true;
        M.guardDrag(gt, 'none');
        const g = () => gt.querySelector('.gtg');
        const xOf = (ev) => { const r = g().getBoundingClientRect(); return (ev.clientX - r.left) / r.width; };
        let drag = null, near = -1;
        const paint = (x) => {
          const n = this._tl.length, pos = Math.max(0.5 / n, Math.min(1 - 0.5 / n, x)), nr = Math.max(0, Math.min(n - 1, Math.floor(x * n)));
          const ind = gt.querySelector('.ind');
          Object.assign(ind.style, { left: ((pos - 0.5 / n) * 100) + '%', background: 'linear-gradient(180deg, rgb(255 255 255 / .3), rgb(255 255 255 / .1))', boxShadow: 'inset 0 1px 0 rgb(255 255 255 / .6), inset 0 -1px 1px rgb(255 255 255 / .15), inset 0 0 0 0.5px rgb(255 255 255 / .35), 0 8px 20px rgb(0 0 0 / .35)', backdropFilter: 'blur(6px) saturate(200%)', transform: 'scale(1.12, 1.1)', transition: 'transform .25s cubic-bezier(.34,1.8,.64,1), background .2s' });
          gt.querySelectorAll('.gti').forEach((s, i) => { s.style.color = i === nr ? 'var(--ki-text, #fff)' : 'var(--ki-text-2, #afafaf)'; });
          if (nr !== near) { if (near >= 0) M.haptic('selection'); near = nr; }
        };
        // Dra (≥ 8 px) = glassboblen følger fingeren; vanlig trykk = linse-animasjon (MSH.glassMorph, Fiks 4 · 3)
        gt.addEventListener('pointerdown', (ev) => { if (ev.button) return; drag = { x: xOf(ev), cx: ev.clientX, on: false }; near = -1; this._busy = true; try { gt.setPointerCapture(ev.pointerId); } catch (x) { /* */ } });
        const trOn = () => { const T = gt.__tabReorder; return !!T && ((T.st && T.st.phase === 'drag') || Date.now() < T.eatUntil); }; // Fiks 28.13: fane-flytting pågår
        gt.addEventListener('pointermove', (ev) => { if (!drag || trOn()) return; ev.preventDefault(); drag.x = xOf(ev); if (!drag.on && Math.abs(ev.clientX - drag.cx) < 8) return; drag.on = true; paint(drag.x); });
        const up = (ev, cancel) => {
          if (!drag) return;
          if (trOn()) { drag = null; return; } // hold + dra flyttet fanen (MSH.tabReorder) – ikke et fanebytte
          const n = this._tl.length, i = Math.max(0, Math.min(n - 1, Math.floor(drag.x * n))), tap = !drag.on;
          drag = null; this._busy = false;
          if (tap && !cancel && this._tl[i] && this._tl[i] !== this._cur && M.glassMorph) { const sp2 = gt.querySelectorAll('.gti'); M.glassMorph(g(), sp2[this._tl.indexOf(this._cur)], sp2[i], { axis: 'x' }); }
          const ind = gt.querySelector('.ind');
          ind.removeAttribute('style');
          gt.querySelectorAll('.gti').forEach((s) => s.removeAttribute('style'));
          if (!cancel && this._tl[i] && this._tl[i] !== this._cur) { M.haptic('selection'); this.setUI({ tab: this._tl[i] }); } else this.update();
        };
        gt.addEventListener('pointerup', (ev) => up(ev, false));
        gt.addEventListener('pointercancel', (ev) => up(ev, true));
      }
      // Fiks 28.13: hold 400 ms + dra = omorganiser fanene (tabs); glassboblen/trykk over er fortsatt kortets egen kode
      if (gt && M.tabReorder) M.tabReorder(gt, {
        card: this, styleRow: false, glassTap: false, itemStop: false,
        items: () => Array.from(gt.querySelectorAll('.gti')), idOf: (b) => b.dataset.key, active: () => this._cur,
        onReorder: (keys) => { const c = this.config, all = (Array.isArray(c.tabs) ? c.tabs : []).filter((k) => TABS[k]); Object.keys(TABS).forEach((k) => { if (!all.includes(k)) all.push(k); }); M.mshPatchConfig(this, { tabs: M.tabMerge(keys, all) }); },
      });
      this.shadowRoot.querySelectorAll('.hs').forEach((el) => M.guardScroll(el));
    }
    disconnectedCallback() { if (super.disconnectedCallback) super.disconnectedCallback(); clearInterval(this._sprTick); this._sprTick = null; }
    get styles() {
      return (M.STEPPER_CSS || '') + `
        @keyframes fade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
        .stpc{border-radius:24px;background:${K.card}}
        .wrap{display:flex;flex-direction:column;gap:var(--msh-gap,10px)}
        .body{display:flex;flex-direction:column;gap:10px;animation:fade .3s ease}
        .ctl{display:grid;gap:8px}
        .tile{height:72px;border-radius:22px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;min-width:0;padding:0 2px;transition:background .3s,color .3s,box-shadow .3s}
        .tile .tl{font-size:11px;font-weight:500;max-width:100%}
        .tabrow{display:flex;align-items:center;gap:8px;min-width:0;margin:2px 0}
        /* 33.4: fanehøyde (MSH.tabH) – pille H (44 som designet), sporet H + 8, tannhjul = sporets høyde */
        .gt{flex:1;min-width:0;padding:4px;border-radius:calc(${TV('th', 44)} / 2 + 4px);background:${K.card};box-shadow:${C.edge};overflow-x:auto;scrollbar-width:none;touch-action:none;user-select:none;-webkit-user-select:none;cursor:pointer}
        .gt::-webkit-scrollbar{display:none}
        .gtg{position:relative;display:grid;width:100%;min-width:max-content}
        .ind{position:absolute;top:0;bottom:0;border-radius:999px;pointer-events:none;background:${PINK};transition:left .5s cubic-bezier(.34,1.4,.64,1),transform .45s cubic-bezier(.34,1.8,.64,1),background .35s}
        .gti{position:relative;z-index:1;height:${TV('th', 44)};padding:0 ${TV('tp', 10)};display:flex;align-items:center;justify-content:center;gap:6px;font-size:${TV('tf', 13)};font-weight:500;white-space:nowrap;transition:color .35s}
        .gtl{max-width:100%;overflow:hidden;text-overflow:ellipsis}
        .cfg{width:calc(${TV('th', 44)} + 8px);height:calc(${TV('th', 44)} + 8px);border-radius:calc(${TV('th', 44)} / 2 + 4px);flex:none;display:grid;place-items:center;background:${K.card};box-shadow:${C.edge};color:var(--ki-text, #fafafa)}
        .g2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
        .g3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
        .g5{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}
        /* Fiks 33.1 · flytende setning: blokk-avsnitt, inline-piller (ingen flex/grid/gap, ingen width:100%) */
        p.sent{display:block;margin:6px 4px 2px;padding:0;font-size:19px;line-height:1.75;text-wrap:pretty;color:var(--ki-text, #fafafa);font-weight:400}
        p.sent .pill{display:inline;height:auto;background:var(--ki-pill-bg, #fafafa);color:var(--ki-pill-fg, #141414);border-radius:999px;padding:2px 10px;font-weight:500;white-space:nowrap;vertical-align:baseline;line-height:inherit;-webkit-box-decoration-break:clone;box-decoration-break:clone}
        .today{display:flex;flex-direction:column;padding:4px 16px;border-radius:24px;background:${K.card}}
        .dh{display:flex;align-items:center;gap:8px;padding:10px 0 6px;font-size:13px;color:var(--ki-text-2, #a8a8a8)}
        .dht,.dhd{font-size:13px;color:var(--ki-text-2, #a8a8a8)}
        .dht{margin-right:-4px}
        .tr{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:54px;cursor:pointer}
        .bt{border-top:1px solid rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.07*var(--ki-wa-k,1)),var(--ki-wa-max,1)))}
        .trl{font-size:15px;color:var(--ki-text, #fafafa)}
        .trvw{display:flex;align-items:baseline;gap:4px}
        .trv{font-size:24px;font-weight:300}
        .tru{font-size:12px;color:var(--ki-text-2, #a8a8a8)}
        .au{display:flex;align-items:center;gap:10px;min-width:0;height:72px;padding:6px 12px 6px 6px;border-radius:36px;background:${K.card};text-align:left;width:100%;box-sizing:border-box}
        .aur{width:60px;height:60px;flex:none;border-radius:50%;display:grid;place-items:center;transition:background .4s}
        .aui{width:60px;height:60px;border-radius:50%;display:grid;place-items:center;box-shadow:${C.edge};transition:background .3s,color .3s}
        .aut{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}
        .aul{font-size:15px;font-weight:500}
        .aus{font-size:13px;color:var(--ki-text-mid, #979797)}
        .hs{display:flex;gap:6px;overflow-x:auto;padding:2px 0;scrollbar-width:none}
        .hs::-webkit-scrollbar{display:none}
        .md{height:36px;padding:0 14px;border-radius:999px;font-size:13px;font-weight:500;white-space:nowrap;display:flex;align-items:center;gap:6px;flex:none;transition:background .3s,color .3s}
        .stp{background:${K.card};border-radius:28px;padding:8px;display:flex;align-items:center;gap:8px}
        .stb{width:56px;height:56px;border-radius:50%;background:var(--ki-ctrl, #4b4b4b);display:flex;align-items:center;justify-content:center;flex:none}
        .stm{flex:1;display:flex;flex-direction:column;align-items:center}
        .stl{font-size:12px;color:var(--ki-text-2, #a8a8a8)}
        .stv{font-size:34px;font-weight:300;line-height:1.1}
        .rows{background:${K.card};border-radius:24px;padding:2px 16px;display:flex;flex-direction:column}
        .lr{display:flex;align-items:center;gap:12px;min-height:60px;width:100%;text-align:left}
        .lrt{flex:1;min-width:0;display:flex;flex-direction:column}
        .lrl{font-size:15px}
        .lrs{font-size:12px;color:var(--ki-text-2, #a8a8a8)}
        .lrv{font-size:14px;color:var(--ki-text-1, #d6d6d6)}
        .trk{position:relative;width:50px;height:28px;border-radius:14px;flex:none;transition:background .25s}
        .knb{position:absolute;top:4px;width:20px;height:20px;border-radius:10px;background:var(--ki-knob, #fff);transition:left .25s}
        .hint{font-size:13px;color:var(--ki-text-2, #a8a8a8);padding:4px 6px 0}
        .pp{height:88px;border-radius:24px;padding:12px 12px 12px 14px;display:flex;flex-direction:column;align-items:flex-start;text-align:left;min-width:0;transition:background .3s,color .3s}
        .ppt{display:flex;justify-content:space-between;align-items:center;width:100%}
        .ppc{font-size:12px;opacity:.7}
        .ppn{font-size:15px;font-weight:500;margin-top:14px;max-width:100%}
        .la{display:flex;align-items:center;gap:12px;height:60px;padding:0 16px 0 6px;border-radius:30px;background:${C.green};color:var(--ki-on-accent, #3a3a3a);font-size:15px;font-weight:600}
        .lai{width:48px;height:48px;border-radius:24px;background:rgb(0 0 0 / .1);display:grid;place-items:center}
        .qts{display:flex;gap:6px;flex-wrap:wrap}
        .qt{height:36px;padding:0 14px;border-radius:999px;display:flex;align-items:center;gap:6px;white-space:nowrap;flex:none;font-size:13px;font-weight:500;transition:background .3s,color .3s}
        .qt.undo{padding:0 14px 0 10px;border-radius:18px;margin-left:auto;color:var(--ki-text, #fafafa)}
        .kal{background:${K.card};border-radius:24px;padding:14px 12px;display:flex;flex-direction:column;gap:8px}
        .kalh{display:flex;justify-content:space-between;align-items:center;padding:0 4px}
        .kalc{font-size:12px;color:var(--ki-text-2, #a8a8a8)}
        .calg{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px;text-align:center}
        .wd{font-size:11px;color:var(--ki-text-3, #8a8a8a);padding:4px 0}
        .cd{height:40px;border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;font-size:13px}
        .cdm{font-size:9px;font-weight:600;line-height:1}
        .sbtn{position:relative;overflow:hidden;height:56px;border-radius:28px;display:flex;align-items:center;justify-content:center;gap:8px;font-size:16px;font-weight:500;transition:background .3s}
        .sfill{position:absolute;left:0;top:0;bottom:0;background:color-mix(in srgb, ${C.blue} 35%, transparent);transition:width 1s linear}
        .du{height:64px;border-radius:20px;display:flex;flex-direction:column;align-items:center;justify-content:center;transition:background .3s}
        .duv{font-size:20px;font-weight:500}
        .duu{font-size:11px;opacity:.75}
        .qempty .empty{min-height:72px}
      `;
    }
  }
  M.define('msh-basseng-card', Basseng, 'MSH Basseng', 'Basseng (ÉTT kort i popupen #basseng, 1:1 «Basseng v4 popup»): toppkort som følger fanen, hurtigknapper (Lys, Pumpe, Varme, Stille, Kontakt), faner (Oversikt, Varme, Klor, Spreder), klorlogg og spreder – autokonfigurert.');

  /* ------------------------------------------------------------ #basseng genereres igjen (Fiks 42 Del C) */
  // Strategien lager funksjons-popupen #basseng (mal A, ÉTT msh-basseng-card) når M.poolWanted sier ja: autodeteksjon
  // (M.poolDetect) eller Tilpass Hjem → Popups (ki-store popups.basseng.enabled: true = alltid, false = aldri).
  // Den gamle engangsmigreringen som slettet bassengpopups/-valg/-lenker fra ki-store (migrations.basseng_fjernet) er
  // fjernet – den kjøres ikke lenger, så #basseng og popups.basseng blir ikke slettet igjen.
  //   · MSH.POPUP_DROP.basseng: GAMLE importerte bassengpopups (ki-basseng-card/-hero-card, decluttering-maler o.l. på
  //     #basseng/#badebasseng/#pool/#svommebasseng uten msh-basseng-card) droppes – den genererte #basseng tar over.
  //     En egen popup med msh-basseng-card beholdes (og erstatter den genererte på samme hash).
  //   · MSH.ROOM_BLOCK: et område som heter basseng/pool/spa … får ingen rom-popup så lenge #basseng er på
  //     (bassengpopupen viser området); slås Basseng av, kommer rom-popupen tilbake.
  const ALL_HASH = ['#badebasseng', '#basseng', '#pool', '#svommebasseng'];
  M.BASSENG_HASHES = ALL_HASH;
  const hashN = (cfg) => { const s = String((cfg && cfg.hash) || '').trim(); return s ? s.replace(/^#?/, '#') : ''; };
  const hasMainC = (cfg) => cardsDeep(cfg && cfg.cards).some((c) => tagOfC(c) === 'msh-basseng-card');
  // Ser ut som en bassengpopup: gamle/nye bassengkort, eller navn/ikon/innhold om basseng (f.eks. decluttering-maler)
  const POOLISH_RX = /basseng|baseng|pool|sv[øo]mme/i;
  const poolish = (cfg) => !!cfg && typeof cfg === 'object' && (M.bassengLegacyTest(cfg) || hasMainC(cfg) || POOLISH_RX.test(`${cfg.name || ''} ${cfg.icon || ''}`) || (() => { try { return POOLISH_RX.test(JSON.stringify(cfg.cards || [])); } catch (e) { return false; } })());
  M.bassengIsOldPopup = (cfg) => !!cfg && typeof cfg === 'object' && (M.bassengLegacyTest(cfg) || (ALL_HASH.includes(hashN(cfg)) && !hasMainC(cfg) && poolish(cfg)));
  // Gamle kort i en overstyring av den genererte #basseng (ki-store/YAML popup_overrides fra før sletting: ki-basseng-card,
  // ki-basseng-hero-card, msh-basseng-hero-card, gap-card) → ÉTT msh-basseng-card med innstillingene fra de gamle kortene;
  // egne kort (andre typer) beholdes på plassen sin.
  const OLDC = ['ki-basseng-card', 'ki-basseng-hero-card', 'msh-basseng-hero-card', 'gap-card'];
  M.bassengMigratePopup = function (cfg, gen) {
    const list = cfg && Array.isArray(cfg.cards) ? cfg.cards : null;
    if (!list || !list.some((c) => ['ki-basseng-card', 'ki-basseng-hero-card', 'msh-basseng-hero-card'].includes(tagOfC(c)))) return null;
    const main = list.find((c) => tagOfC(c) === 'msh-basseng-card');
    const { type: _t, card_id: _i, ...legacy } = M.bassengLegacyCard({ cards: list }) || {};
    const merged = { ...legacy, ...(main || {}), type: 'custom:msh-basseng-card', card_id: (main && main.card_id) || (gen && gen.card_id) || 'pop-basseng' };
    const out = [];
    let put = false;
    list.forEach((c) => { if (OLDC.includes(tagOfC(c)) || c === main) { if (!put) { out.push(merged); put = true; } } else out.push(c); });
    return { ...cfg, cards: out };
  };
  M.POPUP_MIGRATE = M.POPUP_MIGRATE || {};
  M.POPUP_MIGRATE['#basseng'] = (cfg, gen) => M.bassengMigratePopup(cfg, gen && Array.isArray(gen.cards) ? gen.cards[0] : null);
  M.POPUP_DROP = M.POPUP_DROP || {};
  M.POPUP_DROP.basseng = { name: 'Basseng (gammel popup – erstattet av #basseng)', test: (cfg) => M.bassengIsOldPopup(cfg) };
  M.ROOM_BLOCK = M.ROOM_BLOCK || [];
  M.ROOM_BLOCK.push((hass, id) => { const a = (hass && hass.areas && hass.areas[id]) || {}; return [id, a.name, ...(Array.isArray(a.aliases) ? a.aliases : [])].some((t) => POOL_WORD.test(String(t || ''))) && M.poolEnabled() !== false; });

  const OLD_FILE_RX = /(^|\/)ki-basseng(-hero)?-card\.js(\?|$)/;
  // Service worker-/Cache Storage: fjern de gamle filene (ki-basseng-card.js, ki-basseng-hero-card.js) fra alle cacher.
  M.bassengClearCache = function () {
    try {
      if (!window.caches || !caches.keys) return Promise.resolve(0);
      return caches.keys().then((ks) => Promise.all(ks.map((k) => caches.open(k).then((c) => c.keys().then((reqs) => Promise.all(reqs.filter((r) => OLD_FILE_RX.test(new URL(r.url).pathname)).map((r) => c.delete(r))))))))
        .then((a) => { const n = a.flat().filter(Boolean).length; if (n) console.info('[ki-msh] Basseng: ' + n + ' gamle filer fjernet fra service worker-cachen'); return n; })
        .catch(() => 0);
    } catch (e) { return Promise.resolve(0); }
  };

  /* Fiks 30.1 · alias-elementer for gammel config: `type: custom:ki-basseng-card` / `custom:ki-basseng-hero-card` rendrer
   * msh-basseng-card med samme config (+ én advarsel i konsollen). Hero-aliaset rendrer ingenting når det står i samme
   * popup som et bassengkort. Defineres bare hvis taggen ikke finnes, og litt etter oppstart, så en gammel ki-cards-ressurs
   * som fortsatt lastes ikke krasjer (HA tegner kortet på nytt når elementet blir definert). */
  const warned = new Set();
  const deepFind = (root, self, d = 0) => {
    if (!root || d > 10 || !root.querySelectorAll) return false;
    for (const e of root.querySelectorAll('*')) {
      if (e !== self && !self.contains(e) && ['msh-basseng-card', 'ki-basseng-card'].includes(e.localName) && !(e.parentNode && e.parentNode.host === self)) return true;
      if (e.shadowRoot && e !== self && deepFind(e.shadowRoot, self, d + 1)) return true;
    }
    return false;
  };
  const popupOfEl = (el) => { let n = el; for (let i = 0; i < 60 && n; i++) { if (n.localName === 'bubble-card' || (n.classList && n.classList.contains('bubble-pop-up-container'))) return n; n = n.parentNode || n.host; } return null; };
  // samme popup = nærmeste Bubble-popup over elementet; uten popup (vanlig visning): kortene i samme stack/rot
  M.bassengHeroBeside = (el) => { const p = popupOfEl(el); if (p) return deepFind(p, el) || deepFind(p.shadowRoot, el); const r = el.getRootNode && el.getRootNode(); return !!r && r !== document && deepFind(r, el); };
  const aliasClass = (tag, hero) => class extends HTMLElement {
    static getStubConfig() { return { card_id: 'pop-basseng' }; }
    setConfig(c) {
      this._cfg = { ...(c || {}), type: 'custom:msh-basseng-card' };
      if (!warned.has(tag)) { warned.add(tag); console.warn(`[ki-msh] «custom:${tag}» er utgått – rendres som msh-basseng-card${hero ? ' (ingenting hvis popupen allerede har et bassengkort)' : ''}. Bytt til «type: custom:msh-basseng-card» i popupen.`); }
      if (this._inner) this._inner.setConfig(this._cfg);
      else if (this.isConnected) this._mount();
    }
    set hass(h) { this._hass = h; if (this._inner) this._inner.hass = h; }
    get hass() { return this._hass; }
    connectedCallback() { this.style.display = 'block'; this._mount(); }
    getCardSize() { return this._inner && this._inner.getCardSize ? this._inner.getCardSize() : hero ? 0 : 10; }
    getGridOptions() { return { columns: 'full' }; }
    _mount() {
      if (!this._cfg || this._inner) return;
      const make = () => {
        if (this._inner || !this.isConnected) return;
        const el = document.createElement('msh-basseng-card');
        try { el.setConfig(this._cfg); } catch (e) { console.warn('[ki-msh]', tag, e); return; }
        if (this._hass) el.hass = this._hass;
        this._inner = el;
        this.appendChild(el);
      };
      if (!hero) return make();
      // hero: vent til nabokortene er tegnet; står et bassengkort i samme popup → ingenting
      this.style.display = 'none';
      clearTimeout(this._t);
      const check = (n) => {
        if (!this.isConnected) return;
        if (M.bassengHeroBeside(this)) { this._beside = true; if (this._inner) { this._inner.remove(); this._inner = null; } return; }
        if (n > 0) { this._t = setTimeout(() => check(n - 1), 250); return; }
        this._beside = false; this.style.display = 'block'; make();
      };
      this._t = setTimeout(() => check(3), 0);
    }
    disconnectedCallback() { clearTimeout(this._t); }
  };
  M.bassengDefineAliases = function () {
    [['ki-basseng-card', false], ['ki-basseng-hero-card', true]].forEach(([tag, hero]) => {
      if (customElements.get(tag)) return;
      try { customElements.define(tag, aliasClass(tag, hero)); } catch (e) { /* definert av en annen ressurs i mellomtiden */ }
    });
  };

  if (!window.__mshPoolHash) {
    window.__mshPoolHash = true;
    setTimeout(() => M.bassengDefineAliases(), 1500);
    setTimeout(() => M.bassengClearCache(), 3000);
  }
})();
