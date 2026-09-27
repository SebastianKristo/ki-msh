/* Vanning-popup (#vanning). Kilde: Vanning v4.dc.html.
 *   msh-vanning-hero-card – hage-scene med spreder (spray når en sone vanner), overskrift, dagens forbruk
 *   msh-vanning-card      – kontroller (Stopp alt · Regn 24t · Nullstill · Anlegget) + faner Nå · Soner · Program · Forbruk · Historikk
 * Autokonfig: område «Hage» (M.findArea), valve.*, switch med vann/vanning/sprinkler/drypp i navn/id,
 * OpenSprinkler-plattform (stasjoner, programmer, kontroller, regnpause, strømtrekk), jordfuktighet (moisture),
 * vannmåler (device_class water → langtidsstatistikk), vanningskalender (calendar.* vann/vanning/sprinkler) for plan.
 * Overstyring: overrides.<felt>, exclude, include.soner / include.program. YAML-kart: zone_min, zone_types.
 */
(function () {
  const M = window.MSH, esc = M.esc, C = M.C;
  const DAY = 86400000;
  const pad = M.pad;
  const dkey = (t) => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const d0 = (t) => { const d = new Date(t == null ? Date.now() : t); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const fmt = (sec) => `${Math.floor(sec / 60)}:${pad(Math.floor(sec % 60))}`;
  const nf = (n) => M.nf(Math.round(n || 0), 0);
  const cap = (t) => (M.cap ? M.cap(t) : t);
  const txt = (hass, id) => { const s = hass && hass.states[id]; return (id + ' ' + ((s && s.attributes.friendly_name) || '')).toLowerCase(); };
  const KW = /vann|vanning|sprinkl|spreder|drypp|dryp|drip|irrig|sone|zone|hageslange/;
  const ONS = ['on', 'open', 'opening', 'running'];
  // Delte hjelpere (definert i 40-basseng.js; reserve her så filen står alene).
  M.cap = M.cap || ((t) => (t ? String(t).charAt(0).toUpperCase() + String(t).slice(1) : t));
  M.hm = M.hm || ((t) => { const d = new Date(t); return pad(d.getHours()) + ':' + pad(d.getMinutes()); });
  M.stateHistory = M.stateHistory || async function (hass, ids, startMs, endMs) {
    ids = (ids || []).filter((id) => id && hass && hass.states[id]);
    if (!ids.length || !hass.callWS) return {};
    try {
      const r = await hass.callWS({ type: 'history/history_during_period', start_time: new Date(startMs).toISOString(), end_time: new Date(endMs || Date.now()).toISOString(), entity_ids: ids, minimal_response: true, no_attributes: true, significant_changes_only: false });
      const d = {};
      ids.forEach((id) => { d[id] = ((r && r[id]) || []).map((p) => ({ t: p.lu != null ? p.lu * 1000 : p.lc != null ? p.lc * 1000 : new Date(p.last_changed || p.last_updated).getTime(), s: p.s != null ? p.s : p.state })); });
      return d;
    } catch (e) { return {}; }
  };
  M.calEvents = M.calEvents || async function (hass, id, startMs, endMs) {
    if (!hass || !id || !hass.callApi) return [];
    try {
      const r = await hass.callApi('GET', `calendars/${id}?start=${encodeURIComponent(new Date(startMs).toISOString())}&end=${encodeURIComponent(new Date(endMs).toISOString())}`);
      return (r || []).map((e) => ({ ...e, t0: new Date((e.start && (e.start.dateTime || e.start.date)) || e.start).getTime(), t1: new Date((e.end && (e.end.dateTime || e.end.date)) || e.end).getTime() })).filter((e) => !isNaN(e.t0)).sort((a, b) => a.t0 - b.t0);
    } catch (e) { return []; }
  };

  /* ------------------------------------------------------------ autokonfig */
  M.vanArea = (hass, cfg) => (cfg && cfg.area) || M.findArea(hass, 'hage', 'garden', 'utendors', 'hagen', 'ute');
  M.vanAuto = function (hass, cfg) {
    cfg = cfg || {};
    const area = M.vanArea(hass, cfg), explicit = !!cfg.area, o = { area, zones: [], programs: [] };
    if (!hass) return o;
    const T = (id) => txt(hass, id), dc = (id) => hass.states[id].attributes.device_class;
    const inA = (id) => !!area && M.areaOf(hass, id) === area;
    const scope = (id) => inA(id) || (!explicit && KW.test(T(id)));
    const os = cfg.opensprinkler === false ? [] : M.byPlatform(hass, 'opensprinkler').filter((id) => M.usable(hass, id) || /_station_|_program_/.test(id));
    const osSet = new Set(os);
    // soner
    const bases = [];
    os.forEach((id) => { const m = /^(sensor|switch)\.(.+)_station_(status|enabled)$/.exec(id); if (m && !bases.includes(m[2])) bases.push(m[2]); });
    const osZones = bases.map((b) => (hass.states[`sensor.${b}_station_status`] ? `sensor.${b}_station_status` : `switch.${b}_station_enabled`));
    const valves = M.all(hass, 'valve', (s, id) => !osSet.has(id) && (inA(id) || (!explicit && KW.test(T(id)))) && !/hoved|main|stoppekran|shutoff|shut_off/.test(T(id)));
    const sws = M.all(hass, 'switch', (s, id) => !osSet.has(id) && KW.test(T(id)) && (inA(id) || !explicit) && !/regn|rain|anlegg|controller|enabled|hopp|skip|pause|basseng|pool/.test(T(id)));
    o.zones = [...osZones, ...valves, ...sws];
    // kontroller / tilstand
    o.system = os.find((id) => id.startsWith('switch.') && !/_station_|_program_/.test(id) && /enabled|controller|opensprinkler/.test(id)) || M.all(hass, 'input_boolean', (s, id) => /vanning|irrigation|anlegg|sprinkler/.test(T(id)) && !/regn|rain|hopp|skip|pause/.test(T(id)) && (inA(id) || !explicit))[0] || null;
    o.os_controller = os.find((id) => id.startsWith('switch.') && !/_station_|_program_/.test(id)) || null;
    o.rain = os.find((id) => /rain_delay_active|rain_delay/.test(id) && id.startsWith('binary_sensor.')) || M.all(hass, ['input_boolean', 'switch'], (s, id) => /regn|rain/.test(T(id)) && (inA(id) || (!explicit && KW.test(T(id)))))[0] || null;
    o.skip = M.all(hass, ['input_boolean', 'switch'], (s, id) => /hopp|skip/.test(T(id)) && (inA(id) || (!explicit && KW.test(T(id)))))[0] || null;
    o.reset = M.all(hass, ['button', 'input_button', 'script'], (s, id) => /nullstill|reset/.test(T(id)) && (inA(id) || (!explicit && KW.test(T(id)))))[0] || null;
    o.current = os.find((id) => /current/.test(id) && id.startsWith('sensor.')) || M.all(hass, 'sensor', (s, id) => dc(id) === 'current' && scope(id))[0] || null;
    o.power = M.all(hass, 'sensor', (s, id) => dc(id) === 'power' && (inA(id) ? KW.test(T(id)) || /pump/.test(T(id)) : !explicit && KW.test(T(id))))[0] || null;
    const waters = M.all(hass, 'sensor', (s, id) => dc(id) === 'water' && scope(id));
    o.water = waters.find((id) => hass.states[id].attributes.state_class === 'total_increasing') || waters[0] || null;
    o.flow = os.find((id) => /flow/.test(id) && id.startsWith('sensor.')) || M.all(hass, 'sensor', (s, id) => dc(id) === 'volume_flow_rate' && scope(id))[0] || null;
    o.moisture = M.all(hass, 'sensor', (s, id) => dc(id) === 'moisture' && (inA(id) || (!explicit && /jord|soil/.test(T(id)))))[0] || null;
    o.calendar = explicit ? M.all(hass, 'calendar', (s, id) => inA(id))[0] || null : M.all(hass, 'calendar', (s, id) => /vann|vanning|sprinkl|irrig|hage/.test(T(id)))[0] || null;
    // programmer
    const osProg = os.filter((id) => /^switch\..+_program_enabled$/.test(id));
    const autos = M.all(hass, ['automation', 'script'], (s, id) => KW.test(T(id)) && (explicit ? inA(id) : true));
    o.programs = [...osProg, ...autos];
    // innstillinger (tall/klokkeslett) → steppere med systemets velger i Program-fanen
    o.settings = M.all(hass, ['number', 'input_number', 'time', 'input_datetime'], (s, id) => (os.includes(id) || scope(id)) && !/basseng|pool/.test(T(id)));
    return o;
  };
  M.vanEnts = function (hass, cfg) {
    const a = M.vanAuto(hass, cfg), ex = new Set((cfg && cfg.exclude) || []), e = { area: a.area, auto: a };
    ['system', 'os_controller', 'rain', 'skip', 'reset', 'current', 'power', 'water', 'flow', 'moisture', 'calendar'].forEach((k) => { e[k] = M.pick(cfg, k, a[k] && !ex.has(a[k]) ? a[k] : null); });
    e.zoneIds = M.applyLists(cfg, 'soner', a.zones);
    e.progIds = M.applyLists(cfg, 'program', a.programs);
    e.setIds = M.applyLists(cfg, 'innstillinger', a.settings);
    return e;
  };
  // Én sone → modell. g(id) leser state (registrerer avhengighet i kortet).
  M.vanZone = function (hass, id, cfg, g) {
    g = g || ((x) => hass.states[x]);
    const s = g(id);
    if (!s) return null;
    const obj = id.split('.')[1], plat = (hass.entities && hass.entities[id] && hass.entities[id].platform) || '';
    const os = plat === 'opensprinkler' || /_station_(status|enabled|running)$/.test(obj);
    const base = obj.replace(/_station_(status|enabled|running)$/, '');
    const st = os ? g(`sensor.${base}_station_status`) : null, en = os ? g(`switch.${base}_station_enabled`) : null, rn = os ? g(`binary_sensor.${base}_station_running`) : null;
    const area = M.areaOf(hass, id);
    let name = (s.attributes.friendly_name || base.replace(/_/g, ' ')).replace(/\s*(station\s*)?(status|enabled|running|aktivert|kjører)$/i, '').trim();
    const an = area ? M.areaName(hass, area) : '';
    if (an) { const r = new RegExp('^' + an.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s+', 'i'); name = name.replace(r, '') || name; }
    name = cap(name);
    const T = (id + ' ' + name).toLowerCase();
    const types = (cfg && cfg.zone_types) || {};
    const type = types[id] || (/slange|hose/.test(T) ? 'slange' : /drypp|dryp|drip|hekk|bed|roser|busk|potte/.test(T) ? 'drypp' : /spreder|sprinkl|plen|lawn|gress/.test(T) ? 'spreder' : (cfg && cfg.default_type) || 'spreder');
    const mins = (cfg && cfg.zone_min) || {};
    const min = Number(mins[id]) || Number(cfg && cfg.run_min) || 10;
    const stS = st ? st.state : null;
    const running = os ? (stS === 'running' || stS === 'manual' || (rn && rn.state === 'on')) : ONS.includes(s.state);
    const queued = os && stS === 'waiting';
    const disabled = os ? ((en && en.state === 'off') || stS === 'disabled') : s.state === 'unavailable';
    let left = null;
    const A = (st || s).attributes;
    if (running) {
      if (A.end_time) { const et = typeof A.end_time === 'number' ? A.end_time * (A.end_time < 1e12 ? 1000 : 1) : new Date(A.end_time).getTime(); if (!isNaN(et)) left = Math.max(0, (et - Date.now()) / 1000); }
      if (left == null && A.seconds_remaining != null) left = Number(A.seconds_remaining);
      if (left == null && A.remaining != null) { const m = /(\d+):(\d+):(\d+)/.exec(String(A.remaining)); left = m ? (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]) : Number(A.remaining); }
      if (left == null || isNaN(left)) { const since = new Date((rn || st || s).last_changed).getTime(); left = Math.max(0, min * 60 - (Date.now() - since) / 1000); }
    }
    return { id, os, base, hid: os ? (st ? st.entity_id : rn ? rn.entity_id : id) : id, name, type, min, running, queued, disabled, left, area, last: new Date((rn || st || s).last_changed).getTime() };
  };
  const zIcon = (z) => (z.type === 'drypp' ? 'water_drop' : z.type === 'slange' ? 'water' : 'sprinkler');
  const zKind = (z, flow) => (z.type === 'drypp' ? 'Drypp' : z.type === 'slange' ? (flow ? `${String(flow).replace('.', ',')} L/min` : 'Slange') : 'Spreder');

  /* ------------------------------------------------------------ data (når popupen åpnes) */
  const VC = new Map();
  M.vanLoad = function (hass, e, zones, force) {
    const key = [e.water, e.calendar, ...zones.map((z) => z.hid)].join('|');
    const c = VC.get(key);
    if (c && !force && Date.now() - c.t < 60000) return c.p;
    const p = (async () => {
      const now = Date.now(), y0 = new Date(new Date().getFullYear(), 0, 1).getTime(), start = Math.min(y0, d0(now - 62 * DAY));
      const out = { stats: null, run: {}, events: [], t: now };
      if (e.water && hass.callWS) {
        try {
          const r = await hass.callWS({ type: 'recorder/statistics_during_period', start_time: new Date(start).toISOString(), end_time: new Date(now).toISOString(), statistic_ids: [e.water], period: 'day', types: ['change'], units: { volume: 'L' } });
          const rows = r && r[e.water];
          if (rows && rows.length) { out.stats = {}; rows.forEach((x) => { const t = typeof x.start === 'number' ? x.start : new Date(x.start).getTime(); const k = dkey(t); out.stats[k] = (out.stats[k] || 0) + (Number(x.change) || 0); }); }
        } catch (x) { /* ingen statistikk */ }
      }
      const hids = zones.map((z) => z.hid);
      if (hids.length) {
        const h = await M.stateHistory(hass, hids, start, now);
        hids.forEach((id) => {
          const pts = h[id] || [];
          for (let i = 0; i < pts.length; i++) {
            if (!ONS.includes(pts[i].s)) continue;
            let a = pts[i].t;
            const b = i + 1 < pts.length ? pts[i + 1].t : now;
            while (a < b) {
              const end = Math.min(b, d0(a) + DAY), k = dkey(a);
              (out.run[k] = out.run[k] || {})[id] = (out.run[k][id] || 0) + (end - a) / 1000;
              a = end;
            }
          }
        });
      }
      if (e.calendar) out.events = await M.calEvents(hass, e.calendar, d0(now - 45 * DAY), d0(now + 31 * DAY));
      return out;
    })();
    VC.set(key, { t: Date.now(), p });
    return p;
  };

  // Felles modell for begge kortene.
  function model(card) {
    const h = card.hass, c = card.config, e = M.vanEnts(h, c), g = (id) => card.s(id);
    const all = e.zoneIds.map((id) => M.vanZone(h, id, c, g)).filter(Boolean);
    const codes = c.codes !== false;
    let n = 0;
    all.forEach((z) => { z.code = codes && z.type !== 'slange' ? 'S' + pad(++n) : ''; });
    const zones = all.filter((z) => !z.disabled), disabled = all.filter((z) => z.disabled);
    const flowCfg = Number(c.flow_rate) || null;
    const D = card._data || { stats: null, run: {}, events: [] };
    const liters = (min) => (flowCfg ? min * flowCfg : null);
    const unitL = !!(D.stats || flowCfg);
    // plan fra kalender
    const plan = {};
    (D.events || []).forEach((ev) => {
      const sm = (ev.summary || '').toLowerCase();
      const hit = all.filter((z) => sm.includes(z.name.toLowerCase()) || (z.code && new RegExp('\\b' + z.code.toLowerCase() + '\\b').test(sm)));
      const evMin = Math.max(1, Math.round((ev.t1 - ev.t0) / 60000));
      const items = hit.length ? hit.map((z, i) => ({ t: ev.t0 + hit.slice(0, i).reduce((a, x) => a + x.min * 60000, 0), z, name: `${z.code ? z.code + ' ' : ''}${z.name}`, min: hit.length === 1 && ev.t1 > ev.t0 ? evMin : z.min, ev }))
        : [{ t: ev.t0, z: null, name: ev.summary || 'Vanning', min: evMin, ev }];
      items.forEach((it) => { const k = dkey(it.t); (plan[k] = plan[k] || []).push(it); });
    });
    Object.values(plan).forEach((l) => l.sort((a, b) => a.t - b.t));
    const pUnitL = !!flowCfg; // plan: liter krever L/min, ellers minutter
    const amountOf = (items) => items.reduce((t, it) => t + (pUnitL ? liters(it.min) : it.min), 0);
    const dayUsed = (k) => {
      if (D.stats && D.stats[k] != null) return D.stats[k];
      const r = D.run[k];
      if (!r) return D.stats ? 0 : null;
      const sec = Object.values(r).reduce((t, v) => t + v, 0);
      return flowCfg ? (sec / 60) * flowCfg : unitL ? null : sec / 60;
    };
    const running = zones.filter((z) => z.running), queue = zones.filter((z) => z.queued);
    const sysS = g(e.system), rainS = g(e.rain), skipS = g(e.skip);
    const sysOn = sysS ? M.isOn(sysS) : true;
    const rainOn = rainS ? M.isOn(rainS) : false;
    const skipOn = skipS ? M.isOn(skipS) : false;
    const today = dkey(Date.now());
    const upcoming = Object.keys(plan).sort().filter((k) => k >= today).map((k) => ({ k, items: plan[k].filter((it) => it.t >= Date.now() - 60000) })).filter((d) => d.items.length);
    return { e, all, zones, disabled, flowCfg, liters, unitL, pUnitL, plan, amountOf, dayUsed, running, queue, sysOn, sysS, rainOn, rainS, skipOn, skipS, upcoming, today, D };
  }
  const amt = (m, v) => (v == null ? '–' : m.unitL ? `${nf(v)} L` : `${nf(v)} min`);
  const pamt = (m, v) => (v == null ? '–' : m.pUnitL ? `${nf(v)} L` : `${nf(v)} min`);
  const itemAmt = (m, min) => (m.flowCfg ? `${nf(min)} min · ${nf(min * m.flowCfg)} L` : `${nf(min)} min`);
  const dayName = (k) => { const diff = Math.round((d0(new Date(k + 'T12:00:00').getTime()) - d0()) / DAY); return diff === 0 ? 'I dag' : diff === 1 ? 'I morgen' : cap(new Date(k + 'T12:00:00').toLocaleDateString('nb-NO', { weekday: 'long' })); };
  const dShort = (k) => new Date(k + 'T12:00:00').toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' });

  // Tjenestekall for soner
  M.vanRun = function (hass, z, min) {
    if (z.os) return M.call(hass, 'opensprinkler', 'run', { entity_id: z.id, run_seconds: Math.round((min || z.min) * 60) });
    const d = z.id.split('.')[0];
    if (d === 'valve') return M.call(hass, 'valve', 'open_valve', { entity_id: z.id });
    return M.call(hass, 'homeassistant', 'turn_on', { entity_id: z.id });
  };
  M.vanStop = function (hass, z) {
    if (z.os) return M.call(hass, 'opensprinkler', 'stop', { entity_id: z.id });
    const d = z.id.split('.')[0];
    if (d === 'valve') return M.call(hass, 'valve', 'close_valve', { entity_id: z.id });
    return M.call(hass, 'homeassistant', 'turn_off', { entity_id: z.id });
  };

  const SCHEMA_BASE = [
    { type: 'area', name: 'area', label: 'Område', help: 'Tomt = «Hage»/«garden». Satt område = kun entiteter derfra (+ OpenSprinkler)', auto: (h) => M.vanArea(h, {}) },
    { type: 'boolean', name: 'opensprinkler', label: 'Bruk OpenSprinkler-integrasjonen', default: true },
    { type: 'lists', label: 'Soner og programmer', lists: (h, c) => { const a = M.vanAuto(h, c); return [{ key: 'soner', label: 'Soner', ids: a.zones, domains: ['valve', 'switch', 'sensor'] }, { key: 'program', label: 'Programmer', ids: a.programs, domains: ['switch', 'automation', 'script'] }, { key: 'innstillinger', label: 'Innstillinger', ids: a.settings || [], domains: ['number', 'input_number', 'time', 'input_datetime'] }]; } },
    { type: 'overrides', label: 'Entiteter', fields: [
      ['system', 'Anlegget på/av', ['switch', 'input_boolean']], ['rain', 'Regnpause', ['binary_sensor', 'input_boolean', 'switch']], ['skip', 'Hopp over neste', ['input_boolean', 'switch']], ['reset', 'Nullstill', ['button', 'input_button', 'script']],
      ['calendar', 'Vanningskalender (plan)', 'calendar'], ['water', 'Vannmåler', 'sensor', 'water'], ['moisture', 'Jordfuktighet', 'sensor', 'moisture'], ['current', 'Strømtrekk (mA)', 'sensor'], ['power', 'Effekt', 'sensor', 'power'], ['flow', 'Vannføring', 'sensor'],
    ].map(([name, label, domain, device_class]) => ({ name, label, domains: [].concat(domain), device_class, auto: (h, c) => M.vanAuto(h, c)[name] })) },
    { type: 'section', label: 'Vanning', icon: 'mdi:sprinkler', fields: [
      { type: 'number', name: 'run_min', label: 'Standard kjøretid per sone (min)', placeholder: '10', min: 1, max: 240 },
      { type: 'number', name: 'flow_rate', label: 'Vannmengde per sone (L/min)', help: 'Gir liter-estimat for plan og kjøretid. Tomt = vis minutter', step: 0.1 },
      { type: 'number', name: 'water_price', label: 'Vannpris (kr per m³)', step: 0.01 },
      { type: 'number', name: 'rain_hours', label: 'Regnpause (timer)', placeholder: '24' },
      { type: 'number', name: 'dry', label: 'Tørr under (% jordfuktighet)', placeholder: '35' },
      { type: 'boolean', name: 'codes', label: 'Vis sonekoder (S01 …)', default: true },
      { type: 'select', name: 'group_by', label: 'Grupper soner', options: [['area', 'Område'], ['none', 'Ingen']], default: 'area' },
    ] },
  ];

  /* ============================================================ HERO */
  const rnd = (i, k) => { const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };
  const GRASS = Array.from({ length: 38 }, (_, i) => `<span class="gr" style="left:${(3 + i * 2.55 + rnd(i, 1) * 1.5).toFixed(2)}%;top:${(58 + rnd(i, 2) * 16).toFixed(2)}%;height:${(14 + rnd(i, 3) * 12).toFixed(1)}px;background:${rnd(i, 4) > 0.5 ? '#5cb86c' : '#4ea560'};--r:${((rnd(i, 5) - 0.5) * 14).toFixed(1)}deg;transform:rotate(${((rnd(i, 5) - 0.5) * 14).toFixed(1)}deg);animation:sway ${(3 + rnd(i, 6) * 2).toFixed(2)}s ease-in-out ${(rnd(i, 7) * -4).toFixed(2)}s infinite"></span>`).join('');
  const FLOWERS = [[15, 58, C.pink], [22, 63, C.purple], [47, 67, C.yellow]].map(([l, t, c]) => `<div class="fw" style="left:${l}%;top:${t}%"><span style="width:13px;height:13px;border-radius:7px;background:${c};box-shadow:0 0 0 3px ${M.alpha(c, 0.25)}"></span><span style="width:2px;height:16px;background:#4f9c5c;border-radius:1px"></span></div>`).join('');

  class VanningHero extends M.Card {
    static get cardName() { return 'Vanning · hero'; }
    static get schema() { return SCHEMA_BASE; }
    get cardSize() { return 4; }
    onOpen() { this._load(); }
    async _load(force) { const m = model(this); this._data = await M.vanLoad(this.hass, m.e, m.all, force); this.update(); }
    render() {
      const m = model(this), c = this.config;
      const run = m.running[0];
      const mo = this.n(m.e.moisture), dry = Number(c.dry) || 35;
      const headline = !m.sysOn ? 'Vanning er slått av' : run ? `${run.name} vannes` : m.rainOn ? 'Vanning er satt på pause' : mo != null ? (mo < dry ? 'Hagen er tørr og klar' : `Jorda er fuktig · ${M.nf(mo, 0)} %`) : m.zones.length ? 'Hagen er klar' : 'Ingen soner funnet';
      const nx = m.upcoming[m.skipOn ? 1 : 0];
      let subline;
      if (run) subline = `${run.left != null ? fmt(run.left) + ' igjen' : 'Vanner'}${m.queue.length ? ` · ${m.queue.length} soner i kø` : ''}`;
      else if (nx) { const it = nx.items[0]; subline = `Neste: ${it.name}${it.z ? ' · ' + zKind(it.z, m.flowCfg) : ''} · ${dayName(nx.k).toLowerCase()} ${M.hm(it.t)}${m.rainOn ? ' (utsettes)' : ''}`; }
      else subline = m.e.calendar ? 'Ingen planlagt vanning' : m.zones.length ? `${m.zones.length} soner · ingen plan (velg kalender)` : 'Velg soner i tilpass';
      const used = m.dayUsed(m.today), planned = m.amountOf(m.plan[m.today] || []) || null;
      const same = m.unitL === m.pUnitL;
      const pct = used != null && planned && same ? Math.min(100, (used / planned) * 100) : used ? 100 : 0;
      const uu = m.unitL ? 'L' : 'min';
      const label = planned ? (same ? `${used != null ? nf(used) : '–'} ${uu} av ${pamt(m, planned)} i dag` : `${used != null ? nf(used) + ' ' + uu : '–'} i dag · plan ${pamt(m, planned)}`) : `${used != null ? nf(used) : '–'} ${uu} i dag`;
      const spray = run ? `<span class="spray">${Array.from({ length: 14 }, (_, i) => `<span style="--a:${-70 + (i % 7) * 23}deg;animation:spray 1.1s linear ${-(i * 0.08).toFixed(2)}s infinite"></span>`).join('')}</span>` : '';
      return `
        <section class="hero" data-ent="${esc((run && run.id) || m.e.moisture || '')}">
          <div class="h1"></div><div class="h2"></div><div class="dirt" style="left:8%;top:72%;width:28%;height:28px"></div><div class="dirt" style="left:40%;top:80%;width:24%;height:24px"></div>
          ${GRASS}${FLOWERS}
          <div class="spr"><div class="head" style="box-shadow:${run ? `0 0 24px ${M.alpha(C.blue, 0.8)}` : '0 2px 6px rgba(0,0,0,0.3)'}"><span class="dot"></span>${spray}</div><div class="pole"></div><div class="shadow"></div></div>
          <div class="txt"><div class="hl ell">${esc(headline)}</div><div class="sl ell">${esc(subline)}</div></div>
          <button class="gear press" data-act="customize" title="Innstillinger">${M.icon('settings', 22)}</button>
          <div class="bar"><div class="trk"><div style="width:${pct}%;height:100%;border-radius:4px;background:${C.blue};transition:width .6s"></div></div><div class="bl num">${esc(label)}</div></div>
        </section>`;
    }
    afterRender() {
      const running = !!this.shadowRoot.querySelector('.spray');
      if (running && !this._tick && this.isOpen) this._tick = setInterval(() => this.update(), 1000);
      if ((!running || !this.isOpen) && this._tick) { clearInterval(this._tick); this._tick = null; }
    }
    onClose() { if (this._tick) { clearInterval(this._tick); this._tick = null; } }
    get styles() {
      return `
        @keyframes spray{0%{transform:rotate(var(--a)) translateY(0) scale(.6);opacity:0}15%{opacity:1}100%{transform:rotate(var(--a)) translateY(-70px) scale(1);opacity:0}}
        @keyframes sway{0%,100%{transform:rotate(var(--r))}50%{transform:rotate(calc(var(--r) + 4deg))}}
        .hero{position:relative;height:210px;border-radius:26px;overflow:hidden;background:linear-gradient(180deg,#1b2740 0%,#22324c 50%,#2a3d57 100%);box-shadow:${C.edge};width:100%}
        .h1{position:absolute;left:-15%;right:-15%;top:46%;height:120%;border-radius:50% 50% 0 0 / 22% 22% 0 0;background:#24452f}
        .h2{position:absolute;left:-10%;right:-25%;top:54%;height:120%;border-radius:45% 55% 0 0 / 20% 20% 0 0;background:#2c5638}
        .dirt{position:absolute;border-radius:50%;background:#5b4a31;opacity:.85}
        .gr{position:absolute;width:3px;border-radius:2px;opacity:.9;transform-origin:bottom center}
        .fw{position:absolute;display:flex;flex-direction:column;align-items:center}
        .spr{position:absolute;right:17%;top:38%;display:flex;flex-direction:column;align-items:center}
        .head{position:relative;width:24px;height:24px;border-radius:12px;background:#eef3f7;display:grid;place-items:center;z-index:1;transition:box-shadow .4s}
        .dot{width:10px;height:10px;border-radius:5px;background:${C.blue}}
        .spray{position:absolute;left:12px;top:12px;width:0;height:0}
        .spray span{position:absolute;left:-2px;top:-2px;width:4px;height:4px;border-radius:2px;background:${C.blue}}
        .pole{width:12px;height:58px;margin-top:-4px;border-radius:0 0 6px 6px;background:linear-gradient(90deg,#c9d6e2,#eef3f7 60%,#b7c6d4)}
        .shadow{width:64px;height:14px;margin-top:-8px;border-radius:50%;background:rgba(10,20,15,0.45)}
        .txt{position:absolute;left:20px;right:72px;top:18px;display:flex;flex-direction:column;gap:4px}
        .hl{font-size:19px;font-weight:600;letter-spacing:-0.01em}
        .sl{font-size:13px;color:#c8d0dc}
        .gear{position:absolute;right:14px;top:14px;width:40px;height:40px;border-radius:20px;background:rgba(15,20,30,0.7);display:grid;place-items:center}
        .bar{position:absolute;left:20px;right:20px;bottom:16px;display:flex;align-items:center;gap:14px}
        .trk{flex:1;height:5px;border-radius:3px;background:rgba(255,255,255,0.22);overflow:hidden}
        .bl{font-size:13px;white-space:nowrap}
      `;
    }
  }
  M.define('msh-vanning-hero-card', VanningHero, 'MSH Vanning · hero', 'Hage-scene med spreder, status, neste vanning og dagens forbruk. Første kort i #vanning.');

  /* ============================================================ HOVEDKORT */
  const TABS = [['now', 'Nå', 'water_drop'], ['zones', 'Soner', 'sprinkler'], ['prog', 'Program', 'event_repeat'], ['use', 'Forbruk', 'bar_chart'], ['hist', 'Historikk', 'calendar_month']];
  const TL = Object.fromEntries(TABS.map((t) => [t[0], t]));

  class Vanning extends M.Card {
    static get cardName() { return 'Vanning'; }
    static get defaults() { return { tabs: TABS.map((t) => t[0]) }; }
    static get schema() {
      return SCHEMA_BASE.concat([
        { type: 'order', name: 'tabs', hiddenName: 'hidden_tabs', label: 'Faner', options: TABS.map((t) => [t[0], t[1]]) },
        { type: 'section', label: 'Visning', icon: 'mdi:eye-outline', fields: [{ type: 'boolean', name: 'toasts', label: 'Bekreftelsesmeldinger', default: true }, { type: 'gap' }] },
      ]);
    }
    get cardSize() { return 12; }
    _toast(t) { M.toast(t, { enabled: this.config.toasts !== false }); }
    onOpen() { this._load(); }
    onClose() { if (this._tick) { clearInterval(this._tick); this._tick = null; } }
    async _load(force) { const m = model(this); this._data = await M.vanLoad(this.hass, m.e, m.all, force); this.update(); }
    _tabs() {
      const c = this.config, hid = new Set(c.hidden_tabs || []);
      const order = (Array.isArray(c.tabs) ? c.tabs : []).filter((k) => TL[k]);
      TABS.forEach((t) => { if (!order.includes(t[0])) order.push(t[0]); });
      return order.filter((k) => !hid.has(k));
    }
    render() {
      const m = model(this);
      this._m = m;
      const tl = this._tabs(), cur = tl.includes(this.ui.tab) ? this.ui.tab : tl[0];
      const ctrl = (act, ic, label, o = {}) => `<button class="ct press" data-key="${act}" data-act="${act}" ${o.ent ? `data-ent="${esc(o.ent)}"` : ''} ${o.hap ? `data-haptic="${o.hap}"` : ''} style="background:${o.white ? '#fafafa' : o.on ? M.alpha(o.col, 0.18) : C.card};color:${o.white ? '#232323' : '#fafafa'};box-shadow:${o.on && !o.white ? `inset 0 0 0 1px ${M.alpha(o.col, 0.45)}` : C.edge};${o.dim ? 'opacity:.55;' : ''}">${M.icon(ic, 24, `color:${o.iconCol || (o.on && !o.white ? o.col : 'inherit')}`)}<span class="ctl">${esc(label)}</span></button>`;
      const controls = [
        ctrl('stopall', 'stop_circle', 'Stopp alt', { iconCol: C.red, hap: 'warning' }),
        ctrl('rain', 'rainy', `Regn ${Number(this.config.rain_hours) || 24}t`, { on: m.rainOn, col: C.orange, ent: m.e.rain, dim: !m.e.rain }),
        ctrl('reset', 'restart_alt', 'Nullstill', { ent: m.e.reset }),
        ctrl('system', 'power_settings_new', m.sysOn ? 'Anlegget på' : 'Anlegget av', { white: m.sysOn && !!m.sysS, ent: m.e.system, dim: !m.e.system, hap: 'success' }),
      ].join('');
      const nav = tl.map((k) => { const [, label, ic] = TL[k], on = k === cur; return `<button class="tb" data-key="${k}" data-act="tab" data-t="${k}" data-haptic="selection" style="background:${on ? C.accent : 'transparent'};color:${on ? '#2a1720' : '#979797'};font-weight:${on ? 600 : 500}">${M.icon(ic, 20)}${esc(label)}</button>`; }).join('');
      const body = cur === 'zones' ? this._zones(m) : cur === 'prog' ? this._prog(m) : cur === 'use' ? this._use(m) : cur === 'hist' ? this._hist(m) : this._now(m);
      return `<div class="wrap">
        <section class="ctrls">${controls}</section>
        ${tl.length ? `<nav class="nav" style="grid-template-columns:repeat(${tl.length},1fr)">${nav}</nav>` : ''}
        ${tl.length ? body : M.emptyState('Alle faner er skjult', 'sections')}
      </div>`;
    }
    /* ---------------- Nå */
    _now(m) {
      let out = '';
      const run = m.running[0];
      if (run) {
        const total = run.min * 60, left = run.left != null ? run.left : total, el = Math.max(0, total - left);
        const usedL = m.flowCfg ? (el / 60) * m.flowCfg : null;
        out += `<div class="run" data-ent="${esc(run.id)}">
          <div class="rf" style="width:${Math.min(100, (el / total) * 100)}%"></div>
          <div class="rt"><div class="col grow" style="gap:3px;min-width:0"><div style="font-size:12px;color:${C.blue}">Vanner nå</div><div class="ell" style="font-size:18px;font-weight:500">${esc((run.code ? run.code + ' ' : '') + run.name)}</div><div class="ell" style="font-size:12px;color:#979797">${esc(zKind(run, m.flowCfg) + (m.queue.length ? ` · neste: ${m.queue[0].name}` : m.running.length > 1 ? ` · +${m.running.length - 1} til` : ''))}</div></div>
          <div class="num" style="font-size:40px;font-weight:300;letter-spacing:-0.03em;line-height:1">${run.left != null ? fmt(run.left) : '–'}</div></div>
          <div class="rb"><div class="num" style="font-size:13px;color:#afafaf">${usedL != null ? `${nf(usedL)} av ca. ${nf(total / 60 * m.flowCfg)} L` : `${nf(el / 60)} av ${nf(run.min)} min`}</div><button class="stop press" data-act="stopall" data-haptic="warning">${M.icon('stop', 18)}Stopp</button></div>
        </div>`;
      }
      const nx = m.upcoming[m.skipOn ? 1 : 0];
      const skipLabel = m.skipOn ? 'Angre hopp' : 'Hopp over';
      if (nx) {
        const items = nx.items.slice(0, 3).map((it, i) => `<div class="ni ${i ? 'bt' : ''}" data-key="${esc(it.name + it.t)}"><span class="zi" style="width:34px;height:34px">${M.icon(it.z ? zIcon(it.z) : 'sprinkler', 17)}</span><div class="col grow" style="gap:2px;min-width:0"><div class="ell" style="font-size:14px;font-weight:500">${esc(it.name)}</div><div style="font-size:12px;color:#7f7f7f">${esc(M.hm(it.t) + (it.z ? ' · ' + zKind(it.z, m.flowCfg) : ''))}</div></div><div class="num" style="font-size:12px;color:#979797;white-space:nowrap">${esc(itemAmt(m, it.min))}</div></div>`).join('');
        out += `<div class="box">
          <div class="nh"><div class="col" style="gap:4px;min-width:0"><div style="font-size:12px;color:#7f7f7f">Neste vanning</div><div style="font-size:15px;font-weight:500;white-space:nowrap">${esc(`${dayName(nx.k)} ${dShort(nx.k)}${m.rainOn ? ' · utsettes' : ''}`)}</div></div><div class="big num">${esc(M.hm(nx.items[0].t))}</div></div>
          <div class="col">${items}</div>
          <div class="row" style="gap:8px"><button class="b1 press" data-act="runnext" data-haptic="success">${M.icon('play_arrow', 20)}Kjør nå</button><button class="b2 press" data-act="skip" style="${m.e.skip ? '' : 'opacity:.55'}">${M.icon('skip_next', 20)}${skipLabel}</button></div>
        </div>`;
      } else {
        out += `<div class="box">
          <div class="nh"><div class="col" style="gap:4px"><div style="font-size:12px;color:#7f7f7f">Neste vanning</div><div style="font-size:15px;font-weight:500">${m.e.calendar ? 'Ingen planlagt' : 'Ingen plan'}</div></div><div class="big num">–</div></div>
          ${m.e.calendar ? '' : `<button class="ni press" data-act="customize" data-section="overrides" style="width:100%;text-align:left"><span class="zi" style="width:34px;height:34px">${M.icon('calendar_month', 17)}</span><div class="col grow" style="gap:2px"><div style="font-size:14px;font-weight:500">Velg vanningskalender</div><div style="font-size:12px;color:#7f7f7f">Planen leses fra en kalender (calendar.*)</div></div>${M.icon('chevron_right', 20, 'color:#979797')}</button>`}
          <div class="row" style="gap:8px"><button class="b1 press" data-act="runall" data-haptic="success" style="${m.zones.length ? '' : 'opacity:.55'}">${M.icon('play_arrow', 20)}Kjør alle</button><button class="b2 press" data-act="skip" style="${m.e.skip ? '' : 'opacity:.55'}">${M.icon('skip_next', 20)}${skipLabel}</button></div>
        </div>`;
      }
      // neste 7 dager
      const wk = Array.from({ length: 7 }, (_, i) => { const t = d0() + i * DAY + DAY / 2, k = dkey(t); return { k, v: m.amountOf((m.plan[k] || []).filter((it) => it.t >= Date.now() - 60000 || i > 0)), d: i ? cap(new Date(t).toLocaleDateString('nb-NO', { weekday: 'short' }).replace('.', '')) : 'I dag' }; });
      const wkMax = Math.max(1, ...wk.map((w) => w.v));
      const skippedK = m.skipOn && m.upcoming[0] ? m.upcoming[0].k : null;
      out += `<div class="box" style="padding:16px 18px 14px;gap:12px">
        <div class="sp"><div style="font-size:12px;color:#7f7f7f">Neste 7 dager</div><div class="num" style="font-size:12px;color:#7f7f7f">${m.e.calendar ? esc(pamt(m, wk.reduce((t, w) => t + w.v, 0)) + ' planlagt') : '–'}</div></div>
        <div class="wk">${wk.map((w, i) => `<div class="wkc"><div style="width:100%;max-width:34px;height:${w.v ? Math.max(8, (w.v / wkMax) * 64) : 4}px;border-radius:8px;background:${w.v ? (skippedK === w.k ? 'var(--gray300,#404040)' : M.alpha(C.blue, i === 1 ? 0.9 : 0.45)) : 'var(--gray000,#232323)'}"></div><div style="font-size:11px;color:${i ? '#7f7f7f' : '#fafafa'};white-space:nowrap">${esc(w.d)}</div></div>`).join('')}</div>
      </div>`;
      // strøm + sist vannet (+ jordfuktighet)
      const cur = this.n(m.e.current), pw = this.n(m.e.power);
      const power = cur != null ? `${M.nf(cur, 0)} mA · ca. ${M.nf((cur * 24) / 1000, 0)} W` : pw != null ? `${M.nf(pw, 0)} W` : '–';
      let lastTxt = '–';
      for (let i = 0; i < 400; i++) {
        const k = dkey(Date.now() - i * DAY), u = m.dayUsed(k), r = m.D.run[k];
        if ((u != null && u > 0) || (r && Object.values(r).some((v) => v > 0))) { lastTxt = `${i === 0 ? 'I dag' : dShort(k)} · ${u != null ? amt(m, u) : nf(Object.values(r).reduce((t, v) => t + v, 0) / 60) + ' min'}`; break; }
      }
      if (lastTxt === '–' && m.all.length) { const lz = m.all.filter((z) => !z.running).sort((a, b) => b.last - a.last)[0]; if (lz && !isNaN(lz.last)) lastTxt = `${new Date(lz.last).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })} · ${lz.name}`; }
      const mo = this.s(m.e.moisture);
      out += `<div class="g2">
        <div class="tile" ${m.e.current || m.e.power ? `data-ent="${esc(m.e.current || m.e.power)}"` : ''}><div class="th">${M.icon('bolt', 16, `color:${C.yellow}`)}Strøm</div><div class="tv num">${esc(power)}</div></div>
        <div class="tile"><div class="th">${M.icon('history', 16, `color:${C.blue}`)}Sist vannet</div><div class="tv ell">${esc(lastTxt)}</div></div>
        ${mo ? `<div class="tile" style="grid-column:span 2" data-ent="${esc(m.e.moisture)}"><div class="th">${M.icon('water_percent', 16, `color:${C.green}`)}Jordfuktighet</div><div class="tv num">${esc(M.isNum(mo.state) ? M.nf(Number(mo.state), 0) + ' ' + (mo.attributes.unit_of_measurement || '%') : '–')}</div></div>` : ''}
      </div>`;
      return out;
    }
    /* ---------------- Soner */
    _zones(m) {
      if (!m.all.length) return M.emptyState('Fant ingen soner (valve, switch eller OpenSprinkler)', 'entities');
      const by = this.config.group_by === 'none' ? () => 'Soner' : (z) => (z.area ? M.areaName(this.hass, z.area) : null);
      const groups = [];
      m.zones.forEach((z) => { const k = by(z) || 'Øvrige'; let g = groups.find((x) => x.name === k); if (!g) groups.push(g = { name: k, list: [] }); g.list.push(z); });
      groups.sort((a, b) => (a.name === 'Øvrige') - (b.name === 'Øvrige'));
      if (groups.length === 1 && groups[0].name === 'Øvrige') groups[0].name = 'Soner';
      const row = (z, i) => {
        const on = z.running, total = z.min * 60;
        const sub = on ? `Vanner${z.left != null ? ` · ${fmt(z.left)} igjen` : ''}` : z.queued ? 'I kø' : `${zKind(z, m.flowCfg)} · ${z.min} min${m.flowCfg ? ` · ca. ${nf(z.min * m.flowCfg)} L` : ''}`;
        return `<div class="zr ${i ? 'bt' : ''}" data-key="${esc(z.id)}" data-ent="${esc(z.id)}">
          <div class="zf" style="width:${on && z.left != null ? `calc(${(1 - z.left / total) * 100}% + 14px)` : '0'}"></div>
          <span class="zi" style="${on ? `background:${C.blue};color:#141416` : ''}">${M.icon(zIcon(z), 18)}</span>
          <div class="col grow" style="position:relative;gap:2px;min-width:0"><div class="ell" style="font-size:14px;font-weight:500">${z.code ? `<span class="num" style="color:#7f7f7f">${esc(z.code)}</span> ` : ''}${esc(z.name)}</div><div class="ell num" style="font-size:12px;color:${on ? C.blue : z.queued ? '#afafaf' : '#7f7f7f'}">${esc(sub)}</div></div>
          <button class="zb press" data-act="zone" data-id="${esc(z.id)}" data-haptic="${on ? 'warning' : 'success'}" style="background:${on ? C.blue : 'var(--gray000,#232323)'};color:${on ? '#141416' : m.sysOn ? '#fafafa' : '#545454'}">${M.icon(on ? 'stop' : 'play_arrow', 20)}</button>
        </div>`;
      };
      let out = groups.map((g) => `<div class="col" style="gap:8px" data-key="g-${esc(g.name)}"><div class="sp" style="padding:0 4px"><div class="cap">${esc(g.name)}</div><div style="font-size:12px;color:#696969">${g.list.length} ${g.list.length === 1 ? 'sone' : 'soner'}</div></div><div class="zl">${g.list.map(row).join('')}</div></div>`).join('');
      if (m.disabled.length) {
        const open = !!this.ui.dis;
        out += `<button class="dis press" data-act="dis">${M.icon('expand_more', 20, `transform:rotate(${open ? 180 : 0}deg);transition:transform .2s`)}${m.disabled.length} deaktiverte soner</button>`;
        if (open) out += `<div class="row" style="flex-wrap:wrap;gap:6px">${m.disabled.map((z) => `<div class="dz num" data-key="${esc(z.id)}" data-ent="${esc(z.id)}">${esc(z.code ? z.code + ' ' + z.name : z.name)}</div>`).join('')}</div>`;
      }
      return out;
    }
    /* ---------------- Program */
    _prog(m) {
      let out = '';
      if (m.e.progIds.length) {
        out += `<div class="col" style="gap:8px">${m.e.progIds.map((id) => {
          const s = this.s(id);
          if (!s) return '';
          const dom = id.split('.')[0], os = /_program_enabled$/.test(id);
          const base = id.split('.')[1].replace(/_program_enabled$/, '');
          const name = cap((s.attributes.friendly_name || base).replace(/\s*program\s*(enabled|aktivert)?$/i, '').trim());
          const on = dom === 'script' ? true : M.isOn(s);
          const runS = os ? this.s(`binary_sensor.${base}_program_running`) : null;
          const nm = name.toLowerCase();
          let nextIt = null;
          for (const d of m.upcoming) { nextIt = d.items.find((it) => (it.ev.summary || '').toLowerCase().includes(nm)); if (nextIt) break; }
          const matched = nextIt ? (m.plan[dkey(nextIt.t)] || []).filter((it) => it.ev === nextIt.ev) : [];
          const mins = matched.reduce((t, it) => t + it.min, 0);
          const lt = s.attributes.last_triggered;
          const sub = runS && runS.state === 'on' ? 'Kjører nå' : matched.length ? `${matched.length === 1 ? matched[0].name : matched.length + ' soner'} · ${mins} min${m.flowCfg ? ` · ca. ${nf(mins * m.flowCfg)} L` : ''}` : os ? 'OpenSprinkler-program' : dom === 'automation' ? `Automasjon${lt ? ' · sist ' + M.relTime(lt) : ''}` : 'Skript';
          return `<div class="pc" data-key="${esc(id)}" data-ent="${esc(id)}" style="opacity:${on ? 1 : 0.55}">
            <div class="col" style="align-items:flex-start;width:64px;flex:none"><div class="num" style="font-size:24px;font-weight:300;letter-spacing:-0.02em;line-height:1">${nextIt ? M.hm(nextIt.t) : '–'}</div><div style="font-size:11px;color:#7f7f7f;padding-top:4px;white-space:nowrap">${esc(nextIt ? dayName(dkey(nextIt.t)) : 'Ingen plan')}</div></div>
            <div class="col grow" style="gap:3px;min-width:0"><div class="ell" style="font-size:15px;font-weight:500">${esc(name)}</div><div class="ell" style="font-size:12px;color:#7f7f7f">${esc(sub)}</div></div>
            <button class="pr press" data-act="prun" data-id="${esc(id)}" data-haptic="success" title="Kjør nå">${M.icon('play_arrow', 20)}</button>
            ${dom === 'script' ? '' : `<button class="ptr" data-act="toggle" data-id="${esc(id)}" data-haptic="selection" style="background:${on ? C.green : C.ctrl}"><span style="left:${on ? 23 : 3}px"></span></button>`}
          </div>`;
        }).join('')}</div>`;
      } else out += M.emptyState('Fant ingen vanningsprogrammer (OpenSprinkler, automasjon eller skript)', 'entities');
      const sets = (m.e.setIds || []).filter((id) => this.s(id));
      if (sets.length) out += `<div class="col" style="gap:8px" data-key="innst"><div class="cap" style="padding:0 4px">Innstillinger</div><div class="zl stpl">${sets.map((id) => M.stepperHTML(this.hass, id, { label: cap(M.name(this.hass, id, m.e.area ? M.areaName(this.hass, m.e.area) : '')), key: 'stp-' + id })).join('')}</div></div>`;
      out += `<div class="col" style="gap:8px"><div class="cap" style="padding:0 4px">Kommende vanninger</div>`;
      if (m.upcoming.length) {
        out += `<div class="zl" style="padding:4px 16px">${m.upcoming.map((d, i) => `<div data-key="${d.k}" style="padding:12px 0;${i ? 'border-top:1px solid rgba(255,255,255,0.06);' : ''}opacity:${m.skipOn && i === 0 ? 0.4 : 1}">
          <div class="sp" style="padding-bottom:6px"><div style="font-size:14px;font-weight:500">${esc(`${dayName(d.k)} ${dShort(d.k)}`)}</div><div class="num" style="font-size:12px;color:#7f7f7f">${d.items.length} ${d.items.length === 1 ? 'sone' : 'soner'} · ${esc(pamt(m, m.amountOf(d.items)))}</div></div>
          ${d.items.map((it) => `<div class="row" style="gap:12px;padding:5px 0"><div class="num" style="width:40px;flex:none;font-size:13px;color:#afafaf">${M.hm(it.t)}</div><span style="width:6px;height:6px;border-radius:3px;flex:none;background:${it.z && it.z.type !== 'spreder' ? M.alpha(C.blue, 0.5) : C.blue}"></span><div class="ell grow" style="font-size:13px">${esc(it.name)}</div><div class="num" style="font-size:12px;color:#7f7f7f;white-space:nowrap">${esc(itemAmt(m, it.min))}</div></div>`).join('')}
        </div>`).join('')}</div>`;
      } else out += m.e.calendar ? `<div class="zl" style="padding:16px;font-size:13px;color:#7f7f7f;text-align:center">Ingen planlagte vanninger de neste 30 dagene</div>` : M.emptyState('Velg en vanningskalender for å se planen', 'overrides');
      return out + '</div>';
    }
    /* ---------------- Forbruk */
    _periodDays(p) {
      const now = new Date(), t = d0();
      if (p === 'uke') { const s = t - ((now.getDay() + 6) % 7) * DAY; return [s, s + 7 * DAY]; }
      if (p === 'maned') return [new Date(now.getFullYear(), now.getMonth(), 1).getTime(), new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime()];
      if (p === 'ar') return [new Date(now.getFullYear(), 0, 1).getTime(), new Date(now.getFullYear() + 1, 0, 1).getTime()];
      return [t, t + DAY];
    }
    _use(m) {
      const p = this.ui.period || 'dag';
      const [a, b] = this._periodDays(p);
      const now = new Date();
      const label = { dag: 'Brukt i dag', uke: 'Brukt denne uken', maned: `Brukt i ${now.toLocaleDateString('nb-NO', { month: 'long' })}`, ar: `Brukt i ${now.getFullYear()}` }[p];
      const estLabel = { dag: 'estimat i dag', uke: 'planlagt resten av uken', maned: 'planlagt resten av måneden', ar: `sesongen ${now.getFullYear()}` }[p];
      const keys = [];
      for (let t = a; t < Math.min(b, Date.now() + 1); t += DAY) keys.push(dkey(t + DAY / 2));
      let usedSum = null;
      keys.forEach((k) => { const u = m.dayUsed(k); if (u != null) usedSum = (usedSum || 0) + u; });
      // per sone
      const perZ = {}, estZ = {};
      keys.forEach((k) => { const r = m.D.run[k] || {}; m.all.forEach((z) => { if (r[z.hid]) perZ[z.id] = (perZ[z.id] || 0) + r[z.hid] / 60; }); });
      Object.keys(m.plan).filter((k) => { const t = new Date(k + 'T12:00:00').getTime(); return t >= a && t < b; }).forEach((k) => m.plan[k].filter((it) => it.t > Date.now()).forEach((it) => { const id = it.z ? it.z.id : '_' + it.name; estZ[id] = (estZ[id] || 0) + it.min; }));
      const toU = (min) => (m.unitL ? (m.flowCfg ? min * m.flowCfg : null) : min);
      const rows = [...new Set([...Object.keys(perZ), ...Object.keys(estZ)])].map((id) => { const z = m.all.find((x) => x.id === id); return { id, code: z ? z.code : '', name: z ? z.name : id.slice(1), u: toU(perZ[id] || 0), e: toU(estZ[id] || 0), um: perZ[id] || 0, em: estZ[id] || 0 }; })
        .filter((r) => r.um || r.em).sort((x, y) => (y.um - x.um) || (y.em - x.em));
      const estSum = rows.reduce((t, r) => t + (r.e || 0), 0);
      const idle = m.all.length - rows.filter((r) => m.all.some((z) => z.id === r.id)).length;
      const maxR = Math.max(1, ...rows.map((r) => Math.max(r.u || r.um, r.e || r.em)));
      const price = Number(this.config.water_price) || null;
      const cost = usedSum != null && price && m.unitL ? `${(usedSum / 1000 * price).toFixed(2).replace('.', ',')} kr` : '–';
      const zU = rows.reduce((t, r) => t + (r.u || 0), 0);
      const tot = Math.max(usedSum || 0, zU, 1) + estSum;
      const stack = rows.filter((r) => r.u).map((r, i) => `<span style="width:${(r.u / tot) * 100}%;background:${M.alpha(C.blue, Math.max(0.2, 1 - i * 0.08))}"></span>`).join('') + (estSum ? `<span style="width:${(estSum / tot) * 100}%;background:${M.alpha(C.blue, 0.18)}"></span>` : '');
      const unit = m.unitL ? 'L' : 'min';
      const fmtV = (v, vm) => (v != null ? `${nf(v)} ${unit}` : `${nf(vm)} min`);
      return `
        <div class="per">${[['dag', 'I dag'], ['uke', 'Uke'], ['maned', 'Måned'], ['ar', 'År']].map(([k, l]) => `<button data-key="${k}" data-act="period" data-p="${k}" data-haptic="selection" style="background:${p === k ? '#fafafa' : 'transparent'};color:${p === k ? '#232323' : '#afafaf'}">${l}</button>`).join('')}</div>
        <div class="box" style="gap:14px" ${m.e.water ? `data-ent="${esc(m.e.water)}"` : ''}>
          <div class="nh"><div class="col" style="flex:none;gap:4px;white-space:nowrap"><div style="font-size:12px;color:#7f7f7f">${esc(label)}</div><div class="num" style="font-size:34px;font-weight:300;letter-spacing:-0.025em;line-height:1">${usedSum != null ? nf(usedSum) : '–'}<span style="font-size:15px;color:#7f7f7f"> ${unit}</span></div></div>
          <div class="col" style="flex:none;gap:4px;text-align:right;white-space:nowrap"><div class="num" style="font-size:15px;font-weight:500">${esc(cost)}</div><div style="font-size:12px;color:#7f7f7f">${esc(estSum ? `${nf(estSum)} ${unit} ${estLabel}` : estLabel)}</div></div></div>
          <div class="stk">${stack}</div>
        </div>
        <div class="zl" style="padding:4px 16px">
          ${rows.map((r, i) => `<div class="row ${i ? 'bt' : ''}" data-key="${esc(r.id)}" style="padding:11px 0"><div class="col grow" style="gap:6px;min-width:0">
            <div class="sp" style="font-size:13px;gap:10px"><span class="ell">${r.code ? `<span class="num" style="color:#7f7f7f">${esc(r.code)}</span> ` : ''}${esc(r.name)}</span><span class="num" style="white-space:nowrap;color:${r.um ? '#fafafa' : '#7f7f7f'}">${r.um ? fmtV(r.u, r.um) : 'ca. ' + fmtV(r.e, r.em)}</span></div>
            <div class="zbar"><div style="width:${((r.e || r.em) / maxR) * 100}%;background:${M.alpha(C.blue, 0.22)}"></div><div style="width:${((r.u || r.um) / maxR) * 100}%;background:${C.blue};transition:width .4s"></div></div>
          </div></div>`).join('')}
          <div style="padding:12px 0;${rows.length ? 'border-top:1px solid rgba(255,255,255,0.06);' : ''}font-size:12px;color:#696969;text-align:center">${rows.length ? `${idle + m.disabled.length} soner uten forbruk` : 'Ingen forbruk i perioden'}</div>
        </div>`;
    }
    /* ---------------- Historikk */
    _hist(m) {
      const now = new Date();
      const [y, mo] = this.ui.month || [now.getFullYear(), now.getMonth()];
      const f1 = new Date(y, mo, 1), off = (f1.getDay() + 6) % 7;
      const sel = this.ui.sel || m.today;
      const extra = (this._evx && this._evx[`${y}-${mo}`]) || null;
      const planOf = (k) => { const L = m.plan[k] || []; if (L.length || !extra) return L; return extra.filter((ev) => dkey(ev.t0) === k).map((ev) => ({ t: ev.t0, name: ev.summary || 'Vanning', min: Math.max(1, Math.round((ev.t1 - ev.t0) / 60000)), z: null, ev })); };
      const cells = Array.from({ length: 42 }, (_, i) => {
        const d = new Date(y, mo, 1 - off + i), k = dkey(d.getTime()), inM = d.getMonth() === mo;
        const u = m.dayUsed(k), w = u != null && u > 0, pl = planOf(k).length > 0, isSel = sel === k, td = k === m.today;
        return `<button class="cc" data-key="${k}" data-act="sel" data-k="${k}" data-haptic="selection" style="background:${isSel ? 'var(--gray300,#404040)' : 'transparent'};box-shadow:${td ? 'inset 0 0 0 1px rgba(255,255,255,0.35)' : 'none'};opacity:${inM ? 1 : 0.3}"><span class="cn num" style="background:${w ? '#4d6a8a' : 'transparent'};font-weight:${w || td ? 600 : 400}">${d.getDate()}</span><span style="width:5px;height:5px;border-radius:3px;background:${pl && !w ? C.green : 'transparent'}"></span></button>`;
      }).join('');
      const selItems = planOf(sel), su = m.dayUsed(sel);
      const selD = new Date(sel + 'T12:00:00');
      const meta = su != null && su > 0 ? `${amt(m, su)} vannet` : selItems.length ? `Planlagt · ${pamt(m, m.amountOf(selItems))}` : 'Ingen vanning';
      const h14 = Array.from({ length: 14 }, (_, i) => { const k = dkey(Date.now() - (13 - i) * DAY); return { k, v: m.dayUsed(k) || 0 }; });
      const hmax = Math.max(1, ...h14.map((x) => x.v)), hsum = h14.reduce((t, x) => t + x.v, 0), hdays = h14.filter((x) => x.v > 0).length;
      const price = Number(this.config.water_price) || null;
      const hasData = !!(m.D.stats || Object.keys(m.D.run).length);
      return `
        <div class="box" style="padding:14px 14px 16px;gap:10px">
          <div class="sp" style="align-items:center"><button class="nb press" data-act="month" data-d="-1" data-haptic="selection">${M.icon('chevron_left', 22)}</button><div style="font-size:15px;font-weight:500">${esc(cap(f1.toLocaleDateString('nb-NO', { month: 'long', year: 'numeric' })))}</div><button class="nb press" data-act="month" data-d="1" data-haptic="selection">${M.icon('chevron_right', 22)}</button></div>
          <div class="calg">${['M', 'T', 'O', 'T', 'F', 'L', 'S'].map((w) => `<div style="text-align:center;font-size:11px;color:#696969;padding:4px 0">${w}</div>`).join('')}${cells}</div>
          <div class="row" style="gap:14px;font-size:11px;color:#7f7f7f;padding:0 6px"><span class="row" style="gap:6px"><span style="width:8px;height:8px;border-radius:4px;background:#4d6a8a"></span>Vannet</span><span class="row" style="gap:6px"><span style="width:8px;height:8px;border-radius:4px;box-shadow:inset 0 0 0 1.5px ${C.green}"></span>Planlagt</span></div>
          <div style="border-top:1px solid rgba(255,255,255,0.06);padding:12px 6px 0;display:flex;flex-direction:column;gap:6px">
            <div class="sp" style="gap:10px"><div style="font-size:14px;font-weight:500">${esc(cap(selD.toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' })))}</div><div style="font-size:13px;color:#979797;white-space:nowrap">${esc(meta)}</div></div>
            ${selItems.map((it) => `<div class="row" style="gap:12px;font-size:12px;color:#979797"><span class="num" style="width:38px">${M.hm(it.t)}</span><span class="ell grow">${esc(it.name)}</span><span style="white-space:nowrap">${nf(it.min)} min</span></div>`).join('')}
          </div>
        </div>
        <div class="box" style="gap:16px">
          <div class="nh"><div class="col" style="flex:none;gap:4px;white-space:nowrap"><div style="font-size:12px;color:#7f7f7f">Siste 14 døgn</div><div class="num" style="font-size:34px;font-weight:300;letter-spacing:-0.025em;line-height:1">${hasData ? nf(hsum) : '–'}<span style="font-size:15px;color:#7f7f7f"> ${m.unitL ? 'L' : 'min'}</span></div></div>
          <div class="col" style="flex:none;gap:4px;text-align:right;white-space:nowrap"><div class="num" style="font-size:15px;font-weight:500">${price && m.unitL && hasData ? `${(hsum / 1000 * price).toFixed(2).replace('.', ',')} kr` : '–'}</div><div style="font-size:12px;color:#7f7f7f">${hdays} av 14 døgn med vanning</div></div></div>
          <div class="h14">${h14.map((x, i) => `<div title="${esc(x.k + ': ' + nf(x.v) + (m.unitL ? ' L' : ' min'))}" style="height:${x.v ? (x.v / hmax) * 100 + '%' : '4px'};border-radius:6px;background:${x.v ? C.blue : i === 13 ? C.card : 'var(--gray000,#232323)'}"></div>`).join('')}</div>
          <div class="sp" style="font-size:11px;color:#696969"><span>${esc(dShort(h14[0].k))}</span><span>I dag</span></div>
        </div>`;
    }
    /* ---------------- handlinger */
    async onAction(name, el, ev) {
      const d = el.dataset, m = this._m || model(this), h = this.hass;
      const need = (k) => { if (!m.e[k]) { this.customize('overrides'); return false; } return true; };
      switch (name) {
        case 'tab': return this.setUI({ tab: d.t });
        case 'stopall': {
          if (m.e.os_controller && m.all.some((z) => z.os)) await M.call(h, 'opensprinkler', 'stop', { entity_id: m.e.os_controller });
          await Promise.all(m.all.filter((z) => z.running && !z.os).map((z) => M.vanStop(h, z)));
          return this._toast('All vanning stoppet');
        }
        case 'rain': {
          if (!need('rain')) return;
          const hrs = Number(this.config.rain_hours) || 24;
          if (m.e.rain.startsWith('binary_sensor.') && m.e.os_controller) { await M.call(h, 'opensprinkler', 'set_rain_delay', { entity_id: m.e.os_controller, rain_delay: m.rainOn ? 0 : hrs }); }
          else await M.toggle(h, m.e.rain);
          return this._toast(m.rainOn ? 'Regnpause av' : `Regnpause ${hrs} t`);
        }
        case 'reset': {
          if (m.skipOn && m.e.skip) await M.call(h, 'homeassistant', 'turn_off', { entity_id: m.e.skip });
          if (m.e.reset) await M.toggle(h, m.e.reset);
          this._load(true);
          return this._toast('Nullstilt');
        }
        case 'system': {
          if (!need('system')) return;
          await M.toggle(h, m.e.system);
          return this._toast(m.sysOn ? 'Anlegget er slått av' : 'Anlegget er slått på');
        }
        case 'skip': {
          if (!need('skip')) return;
          await M.toggle(h, m.e.skip);
          return this._toast(m.skipOn ? 'Neste vanning gjenopprettet' : 'Neste vanning hoppes over');
        }
        case 'runnext': {
          const nx = m.upcoming[m.skipOn ? 1 : 0];
          if (!nx || !m.sysOn) return this._toast(m.sysOn ? 'Ingen planlagt vanning' : 'Anlegget er av');
          const zs = nx.items.filter((it) => it.z);
          if (!zs.length) return this._toast('Fant ingen soner i planen');
          const os = zs.filter((it) => it.z.os);
          for (const it of os) await M.vanRun(h, it.z, it.min); // OpenSprinkler køer stasjonene selv
          if (!os.length) await M.vanRun(h, zs[0].z, zs[0].min);
          return this._toast(os.length ? `${os.length} soner startet` : `${zs[0].name} startet`);
        }
        case 'runall': {
          if (!m.zones.length) return this.customize('entities');
          if (!m.sysOn) return this._toast('Anlegget er av');
          const os = m.zones.filter((z) => z.os);
          for (const z of os) await M.vanRun(h, z);
          if (!os.length) await M.vanRun(h, m.zones[0]);
          return this._toast(os.length ? `${os.length} soner startet` : `${m.zones[0].name} startet`);
        }
        case 'zone': {
          const z = m.all.find((x) => x.id === d.id);
          if (!z) return;
          if (z.running) { await M.vanStop(h, z); return this._toast(`${z.name} stoppet`); }
          if (!m.sysOn) return this._toast('Anlegget er av');
          await M.vanRun(h, z);
          return this._toast(`${z.name} startet · ${z.min} min`);
        }
        case 'prun': {
          const dom = d.id.split('.')[0];
          if (/_program_enabled$/.test(d.id)) await M.call(h, 'opensprinkler', 'run', { entity_id: d.id });
          else if (dom === 'automation') await M.call(h, 'automation', 'trigger', { entity_id: d.id });
          else await M.call(h, 'script', 'turn_on', { entity_id: d.id });
          return this._toast(`${M.name(h, d.id)} startet`);
        }
        case 'dis': return this.setUI({ dis: !this.ui.dis });
        case 'period': return this.setUI({ period: d.p });
        case 'sel': return this.setUI({ sel: d.k });
        case 'month': {
          const now = new Date(), [y, mo] = this.ui.month || [now.getFullYear(), now.getMonth()];
          const n = new Date(y, mo + Number(d.d), 1), key = `${n.getFullYear()}-${n.getMonth()}`;
          this.setUI({ month: [n.getFullYear(), n.getMonth()] });
          if (m.e.calendar) {
            this._evx = this._evx || {};
            if (!this._evx[key]) { this._evx[key] = await M.calEvents(h, m.e.calendar, n.getTime(), new Date(n.getFullYear(), n.getMonth() + 1, 1).getTime()); this.update(); }
          }
          return;
        }
        default: return super.onAction(name, el, ev);
      }
    }
    afterRender() {
      const running = this._m && this._m.running.length > 0;
      if (running && this.isOpen && !this._tick) this._tick = setInterval(() => this.update(), 1000);
      if ((!running || !this.isOpen) && this._tick) { clearInterval(this._tick); this._tick = null; }
    }
    get styles() {
      return (M.STEPPER_CSS || '') + `
        .stpl{padding:0}
        .stpl>.msh-stp-row+.msh-stp-row{border-top:1px solid rgba(255,255,255,0.06)}
        .wrap{display:flex;flex-direction:column;gap:var(--msh-gap,16px)}
        .ctrls{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;container-type:inline-size}
        .ct{height:76px;border-radius:22px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;transition:background .2s,color .2s;min-width:0}
        .ctl{font-size:min(13px,3.05cqi);font-weight:600;white-space:nowrap;max-width:100%;padding:0 2px;overflow:hidden;text-overflow:ellipsis}
        .nav{display:grid;padding:4px;border-radius:18px;background:${C.card};gap:2px;position:sticky;top:8px;z-index:2;box-shadow:0 8px 20px rgba(0,0,0,0.35)}
        .tb{height:52px;border-radius:14px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;font-size:11px;white-space:nowrap;min-width:0}
        .box{background:${C.card};box-shadow:${C.edge};border-radius:24px;padding:18px;display:flex;flex-direction:column;gap:16px}
        .run{position:relative;overflow:hidden;background:${C.card};border-radius:24px;padding:18px;box-shadow:inset 0 0 0 1px ${M.alpha(C.blue, 0.45)};display:flex;flex-direction:column;gap:14px}
        .rf{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(90deg,${M.alpha(C.blue, 0.05)},${M.alpha(C.blue, 0.16)});transition:width 1s linear}
        .rt{position:relative;display:flex;align-items:flex-start;gap:12px}
        .rb{position:relative;display:flex;justify-content:space-between;align-items:center}
        .stop{height:36px;padding:0 14px 0 10px;border-radius:18px;background:${C.blue};color:#141416;display:flex;align-items:center;gap:6px;font-size:13px;font-weight:600}
        .nh{display:flex;align-items:flex-end;justify-content:space-between;gap:12px}
        .big{font-size:52px;font-weight:300;letter-spacing:-0.04em;line-height:.9}
        .ni{display:flex;align-items:center;gap:12px;padding:10px 0}
        .bt{border-top:1px solid rgba(255,255,255,0.06)}
        .zi{position:relative;width:36px;height:36px;border-radius:18px;flex:none;display:grid;place-items:center;background:${M.alpha(C.blue, 0.16)};color:${C.blue}}
        .b1{flex:1;height:44px;border-radius:16px;background:var(--gray000,#232323);display:flex;align-items:center;justify-content:center;gap:6px;font-size:14px;font-weight:500}
        .b2{flex:1;height:44px;border-radius:16px;box-shadow:inset 0 0 0 1px rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;gap:6px;font-size:14px;font-weight:500;color:#afafaf}
        .sp{display:flex;justify-content:space-between;align-items:baseline;gap:12px;white-space:nowrap}
        .wk{display:grid;grid-template-columns:repeat(7,1fr);gap:6px;align-items:end;height:96px}
        .wkc{display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:6px;height:100%}
        .g2{display:grid;grid-template-columns:1fr 1fr;gap:8px}
        .tile{background:${C.card};box-shadow:${C.edge};border-radius:20px;padding:14px 16px;display:flex;flex-direction:column;gap:4px;min-width:0}
        .th{display:flex;align-items:center;gap:6px;font-size:12px;color:#7f7f7f}
        .tv{font-size:16px;font-weight:500}
        .cap{font-size:12px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;color:#7f7f7f}
        .zl{background:${C.card};box-shadow:${C.edge};border-radius:22px;padding:4px 12px 4px 14px}
        .zr{position:relative;display:flex;align-items:center;gap:12px;padding:10px 0}
        .zf{position:absolute;left:-14px;top:0;bottom:0;background:${M.alpha(C.blue, 0.1)};transition:width 1s linear}
        .zb{position:relative;width:40px;height:40px;border-radius:20px;flex:none;display:grid;place-items:center}
        .dis{height:48px;border-radius:18px;box-shadow:inset 0 0 0 1px rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:center;gap:8px;font-size:13px;font-weight:500;color:#979797}
        .dz{height:32px;padding:0 12px;border-radius:16px;background:var(--gray000,#232323);box-shadow:${C.edge};display:flex;align-items:center;font-size:12px;color:#696969}
        .pc{display:flex;align-items:center;gap:12px;padding:14px 14px 14px 16px;border-radius:20px;background:${C.card};box-shadow:${C.edge};transition:opacity .2s}
        .pr{width:38px;height:38px;border-radius:19px;background:var(--gray000,#232323);display:grid;place-items:center;flex:none}
        .ptr{position:relative;width:50px;height:30px;border-radius:15px;flex:none;transition:background .2s}
        .ptr span{position:absolute;top:3px;width:24px;height:24px;border-radius:12px;background:#fafafa;box-shadow:0 1px 3px rgba(0,0,0,0.3);transition:left .2s}
        .per{display:flex;padding:3px;border-radius:14px;background:${C.card};gap:2px;align-self:flex-start}
        .per button{height:32px;padding:0 14px;border-radius:11px;font-size:13px;font-weight:500}
        .stk{display:flex;height:8px;border-radius:4px;overflow:hidden;background:var(--gray000,#232323);gap:2px}
        .zbar{position:relative;height:4px;border-radius:2px;background:var(--gray000,#232323);overflow:hidden}
        .zbar div{position:absolute;left:0;top:0;bottom:0;border-radius:2px}
        .nb{width:36px;height:36px;border-radius:18px;display:grid;place-items:center}
        .calg{display:grid;grid-template-columns:repeat(7,1fr);gap:2px}
        .cc{height:46px;border-radius:14px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;min-width:0}
        .cn{width:28px;height:28px;border-radius:14px;display:grid;place-items:center;font-size:14px;color:#fafafa}
        .h14{display:grid;grid-template-columns:repeat(14,1fr);gap:4px;height:110px;align-items:end}
      `;
    }
  }
  M.define('msh-vanning-card', Vanning, 'MSH Vanning', 'Vanning-popup: kontroller, soner, programmer, forbruk og historikk (OpenSprinkler, valve/switch, kalender, vannmåler). Legg under msh-vanning-hero-card i #vanning.');
})();
