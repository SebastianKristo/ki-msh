/* Vanning-popup (#vanning) – ETT kort: msh-vanning-card. Kilde: Vanning v4.dc.html + Fiks 25.1–25.3/25.6.
 *   Toppkort (alltid først): hagescenen (kiVaScene) i Nå/Soner/Program, vann-toppkortet (KI Vann) i Forbruk/Historikk.
 *   Faner (Liquid Glass-pille): Nå · Soner · Program · Forbruk · Historikk. «Tilpass Vanning»: Faner · Soner · Entiteter · Avansert.
 * Data/autokonfig (fasit, flyttet uendret fra ki-cards):
 *   · KI Vanning / OpenSprinkler-prefiks – 55-ki-vanning-card.js 4.3.1 (_prefiks, _ki, _kiEnt, _soner, _programmer, _harFlyt,
 *     _kiEntitet, _hentHistorikk, _kjor, _stopp, _regn, _veksleAnlegg, _husk/_husket, lag_program/slett_program, hopp_over,
 *     kjor_program, kiVaScene, _manedskalender, _panelInnstillinger).
 *   · KI Vann – 71-ki-vann-card.js 1.1.0 (KI_VN_KAT, vann_prefiks, kostnad, modell, forklart, per_person, mal).
 * Reserve (når ki-cards-logikken ikke finner noe): ki-msh-autokonfig under – område «Hage», valve.*, vanningsbrytere,
 *   OpenSprinkler via plattform, vannmåler (langtidsstatistikk), vanningskalender. Overstyring: overrides.<felt>, exclude, include.
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
    // uten hageområde: bare tydelige vanningsnavn (ikke «varmtvann», «sone» o.l. fra f.eks. KI Energi)
    const KW_SET = /vanning|sprinkl|spreder|drypp|drip|irrig|hageslange/;
    o.settings = M.all(hass, ['number', 'input_number', 'time', 'input_datetime'], (s, id) => (os.includes(id) || inA(id) || (!explicit && KW_SET.test(T(id)))) && !/basseng|pool|varmtvann|bereder|vvb/.test(T(id)));
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
      ['calendar', 'Vanningskalender (plan)', 'calendar'], ['water', 'Vannmåler', 'sensor', 'water'], ['current', 'Strømtrekk (mA)', 'sensor'], ['power', 'Effekt', 'sensor', 'power'], ['flow', 'Vannføring', 'sensor'],
    ].map(([name, label, domain, device_class]) => ({ name, label, domains: [].concat(domain), device_class, auto: (h, c) => M.vanAuto(h, c)[name] })) },
    { type: 'section', label: 'Vanning', icon: 'mdi:sprinkler', fields: [
      { type: 'number', name: 'run_min', label: 'Standard kjøretid per sone (min)', placeholder: '10', min: 1, max: 240 },
      { type: 'number', name: 'flow_rate', label: 'Vannmengde per sone (L/min)', help: 'Gir liter-estimat for plan og kjøretid. Tomt = vis minutter', step: 0.1 },
      { type: 'number', name: 'water_price', label: 'Vannpris (kr per m³)', step: 0.01 },
      { type: 'number', name: 'rain_hours', label: 'Regnpause (timer)', placeholder: '24' },
      { type: 'boolean', name: 'codes', label: 'Vis sonekoder (S01 …)', default: true },
    ] },
  ];

  /* ============================================================ KI Vanning (ki-cards 55-ki-vanning-card.js 4.3.1) */
  // Logikken er flyttet uendret; bare tilpasset MSH (this._c = kortets config, this._h = hass, haptic via MSH.haptic).
  const kiVaEsc = esc;
  /* Hagen i hero-kortet: himmel, sol, bed, gress og en spreder som svinger. Regnet er byttet mot designets skyer og
     skrå dråper (egne elementer over scenen, .skyer), resten er som i ki-cards. */
  const kiVaScene = () => {
    const straa = Array.from({ length: 34 }, (_, i) => {
      const x = 6 + i * 9.2, h = 9 + ((i * 7) % 13);
      return `<path class="straa" d="M${x} 150 q2 -${h / 2} 0 -${h}" stroke="#5fbf7a" stroke-width="2.4" fill="none"
      stroke-linecap="round" style="animation-delay:-${((i * 0.21) % 3.4).toFixed(2)}s;opacity:${(0.55 + (i % 4) * 0.12).toFixed(2)}"/>`;
    }).join('');
    const sprut = Array.from({ length: 10 }, (_, i) => {
      const lengde = 30 + ((i * 11) % 26), hoyde = 10 + ((i * 7) % 10);
      return `<circle class="sdrape" cx="250" cy="110" r="${1.8 + (i % 3) * 0.5}" fill="#bfe9ff"
      style="--dx:${lengde.toFixed(0)}px;--dy:${hoyde.toFixed(0)}px;animation-delay:-${((i * 0.15) % 1.5).toFixed(2)}s"/>`;
    }).join('');
    const sno = Array.from({ length: 16 }, (_, i) =>
      `<circle class="snofnugg" cx="${12 + i * 20}" cy="-6" r="${1.6 + (i % 3) * 0.5}" fill="#fff"
      style="animation-duration:${(5 + (i % 4)).toFixed(1)}s;animation-delay:-${((i * 0.4) % 5).toFixed(1)}s"/>`).join('');
    return `<svg viewBox="0 0 320 190" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
    <g class="sol" transform="translate(268 34)"><circle r="30" fill="#ffd98a" opacity=".18"/><circle r="15" fill="#ffe2a3"/></g>
    <g class="sky2" opacity=".22" fill="#eaf6ff"><ellipse cx="70" cy="34" rx="26" ry="12"/><ellipse cx="92" cy="30" rx="18" ry="14"/></g>
    <g class="sky2 b" opacity=".14" fill="#eaf6ff"><ellipse cx="180" cy="22" rx="22" ry="10"/><ellipse cx="198" cy="19" rx="14" ry="11"/></g>
    ${sno}
    <path d="M0 128 q80 -14 160 -4 t160 -6 V190 H0 Z" fill="#2b5c46"/>
    <path class="vaatt" d="M0 136 q80 -12 160 -3 t160 -5 V190 H0 Z" fill="#17403a"/>
    <g fill="#8b5e3c" opacity=".55"><ellipse cx="52" cy="150" rx="34" ry="9"/><ellipse cx="150" cy="156" rx="30" ry="8"/></g>
    <g class="blomst" style="animation-delay:-1s"><path d="M46 150v-16" stroke="#5fbf7a" stroke-width="2.4" fill="none"/>
      <circle cx="46" cy="131" r="5" fill="#ff9ec4"/><circle cx="46" cy="131" r="2" fill="#ffe2a3"/></g>
    <g class="blomst" style="animation-delay:-2.3s"><path d="M60 152v-12" stroke="#5fbf7a" stroke-width="2.2" fill="none"/>
      <circle cx="60" cy="137" r="4" fill="#c9a7ff"/></g>
    <g class="blomst" style="animation-delay:-3.1s"><path d="M148 156v-14" stroke="#5fbf7a" stroke-width="2.2" fill="none"/>
      <circle cx="148" cy="140" r="4.5" fill="#ffd98a"/></g>
    ${straa}
    <g class="stralegruppe" transform-origin="250px 110px">
      <g class="straale">
        <path d="M250 110 q30 -34 62 -16" stroke="#bfe9ff" stroke-width="3" fill="none" stroke-linecap="round" opacity=".55"/>
        <path d="M250 110 q24 -28 48 -18" stroke="#bfe9ff" stroke-width="2" fill="none" stroke-linecap="round" opacity=".4"/>
      </g>
      ${sprut}
    </g>
    <g class="spreder" transform-origin="250px 150px">
      <rect x="246" y="112" width="8" height="40" rx="4" fill="#dce8f0"/>
      <circle cx="250" cy="110" r="7" fill="#eaf6ff"/><circle cx="250" cy="110" r="3" fill="#6aa9c9"/>
      <ellipse cx="250" cy="152" rx="16" ry="5" fill="#1d3a33" opacity=".6"/>
    </g>
  </svg>`;
  };
  const SCENE = kiVaScene();
  // Designets regnpause (scene.clouds / scene.rain): 3 grå skyer som driver, skrå regndråper
  const SKYER = `<div class="skyer" aria-hidden="true">${[[6, 22, 1], [40, 12, 0.8], [66, 26, 1.1]].map(([l, t, s], i) => `<i class="sky" style="left:${l}%;top:${t}px;--s:${s};animation-delay:-${i * 7}s"></i>`).join('')}${Array.from({ length: 22 }, (_, i) => `<i class="rd" style="left:${((i * 4.7 + 6) % 100).toFixed(1)}%;animation-duration:${(0.7 + (i % 4) * 0.12).toFixed(2)}s;animation-delay:-${((i * 0.19) % 1).toFixed(2)}s"></i>`).join('')}</div>`;
  const kiVaIkon = (t) => /drypp/i.test(t) ? 'mdi:water-outline' : /spreder|spr\b/i.test(t) ? 'mdi:sprinkler-variant' : 'mdi:sprinkler';

  // Metodene fra KiVanningCard. `this._c` = config (med standardverdier), `this._h` = hass.
  const KV = {
    get _c() { return this.__c || {}; },
    get _h() { return this.__h; },
    /* Demomodus: kortet tegnes med eksempeldata (bare med `demo:` i config). `demo: true` gir en sone som vanner. */
    _demoData() {
      if (this._demo) return this._demo;
      const modus = this._c.demo === true ? 'vanner' : String(this._c.demo);
      const p = 'demo_opensprinkler';
      const soner = [['01', 'Urtebed', 'Drypp B1'], ['02', 'Lavendelbed', 'Drypp B1'], ['03', 'Garasje/Roser', 'Spreder B1'],
        ['04', 'Bed v/støttemur', 'Drypp B2'], ['05', 'Plen nord', 'Spreder B2'], ['06', 'Hilliihekk', 'Drypp B2'],
        ['07', 'Ligusterhekk', 'Drypp B3'], ['08', 'Plen sør', 'Spreder B3']];
      const S = {};
      soner.forEach(([nr, navn, metode]) => {
        const h = '_' + navn.toLowerCase().replace(/[^a-z0-9]+/g, '_');
        S[`switch.${p}_s${nr}${h}_station_enabled`] = { state: nr === '07' ? 'off' : 'on', attributes: { friendly_name: `S${nr} ${navn} · ${metode} Station Enabled` } };
        const gaar = modus === 'vanner' && nr === '05';
        S[`binary_sensor.${p}_s${nr}${h}_station_running`] = { state: gaar ? 'on' : 'off', attributes: {} };
        S[`sensor.${p}_s${nr}${h}_station_status`] = { state: gaar ? '7:24' : 'idle', attributes: {} };
      });
      S[`switch.${p}_enabled`] = { state: modus === 'av' ? 'off' : 'on', attributes: {} };
      S[`binary_sensor.${p}_rain_delay_active`] = { state: modus === 'regn' ? 'on' : 'off', attributes: {} };
      S[`sensor.${p}_rain_delay_stop_time`] = { state: 'i morgen 07:00', attributes: {} };
      S['input_boolean.demo_vinter'] = { state: modus === 'vinter' ? 'on' : 'off', attributes: {} };
      S[`sensor.${p}_water_level`] = { state: '100', attributes: {} };
      S[`sensor.${p}_flow_rate`] = { state: '12.4', attributes: {} };
      [['p1', 'Plen nord', 'on', modus === 'vanner' ? 'on' : 'off'], ['p2', 'Plen sør', 'off', 'off'], ['p3', 'Runde – Mandag', 'on', 'off']]
        .forEach(([slug, navn, pa, gaar]) => {
          S[`switch.${p}_${slug}_program_enabled`] = { state: pa, attributes: { friendly_name: navn + ' Program Enabled' } };
          S[`binary_sensor.${p}_${slug}_program_running`] = { state: gaar, attributes: {} };
          S[`time.${p}_${slug}_start_time`] = { state: '06:00:00', attributes: {} };
          S[`number.${p}_${slug}_interval_days`] = { state: '2', attributes: {} };
        });
      S['sensor.demo_ki_vanning_oversikt'] = { state: '8 soner', attributes: {
        integrasjon: 'ki_vanning', ki_type: 'oversikt', prefiks: p, pris_m3: 41.11,
        i_dag: 842, uke: 3120, maaned: 9480, aar: 41200, totalt: 52340, kostnad_i_dag: 34.61,
        estimat_i_dag: 1180, estimat_kostnad: 48.5,
        neste: { naar: 'I morgen', tid: '06:00', navn: 'Runde – Mandag', total_min: 64, estimat_liter: 520 },
        programmer: [
          { navn: 'Plen nord', tid: '06:00', i_dag: true, total_min: 40, estimat_liter: 480,
            soner: [{ navn: 'Plen nord', min: 25, nr: 5 }, { navn: 'Hilliihekk', min: 15, nr: 6 }] },
          { navn: 'Runde – Mandag', tid: '05:30', i_dag: false, total_min: 64, estimat_liter: 520,
            soner: [{ navn: 'Urtebed', min: 12, nr: 1 }, { navn: 'Lavendelbed', min: 12, nr: 2 }, { navn: 'Garasje/Roser', min: 40, nr: 3 }] }],
        soner: [
          { nr: 5, navn: 'Plen nord', i_dag: 420, uke: 1600, maaned: 4200, aar: 18400, totalt: 18400, rate: 12.4, kalibrert: true },
          { nr: 6, navn: 'Hilliihekk', i_dag: 180, uke: 700, maaned: 1900, aar: 6200, totalt: 6200, rate: 6.1, kalibrert: true },
          { nr: 1, navn: 'Urtebed', i_dag: 120, uke: 480, maaned: 1400, aar: 3100, totalt: 3100, rate: 4.2, kalibrert: true },
          { nr: 0, navn: 'Hageslange', i_dag: 122, uke: 340, maaned: 980, aar: 2400, totalt: 2400, rate: 8, kalibrert: false }] } };
      this._demo = S;
      return S;
    },
    get _states() { return this._c && this._c.demo ? this._demoData() : (this._h ? this._h.states : {}); },
    _st(id) { const S = this._states; return (id && S[id]) || null; },
    _on(id) { const s = this._st(id); return !!s && s.state === 'on'; },
    /* Oversiktssensoren fra KI Vanning gir forbruk, estimat og programplan ferdig regnet ut */
    _ki() {
      const S = this._states; if (!S) return null;
      const finn = () => Object.keys(S).find((x) => x.startsWith('sensor.') && (S[x].attributes || {}).ki_type === 'oversikt'
        && (S[x].attributes || {}).integrasjon === 'ki_vanning') || null;
      const id = this._c.ki_vanning || (this._c.demo ? finn() : (this._kiId !== undefined ? this._kiId : (this._kiId = finn())));
      const st = id ? this._st(id) : null;
      return st ? { id, ...st.attributes } : null;
    },
    /* Entiteten statistikken hentes fra: «Forbruk totalt» (ki_type: total), ellers oversikten. `historikk_entitet` overstyrer. */
    _kiEntitet() {
      if (this._c.historikk_entitet) return this._c.historikk_entitet;
      const S = this._states || {};
      const total = Object.keys(S).find((id) => {
        const a = S[id].attributes || {};
        return id.startsWith('sensor.') && a.integrasjon === 'ki_vanning' && a.ki_type === 'total';
      }) || Object.keys(S).find((id) => /^sensor\..*(ki_vanning|vanning).*forbruk_totalt$/.test(id));
      if (total) return total;
      const ki = this._ki();
      return ki ? ki.id : null;
    },
    /* Finner en entitet fra KI Vanning ut fra markøren i attributtene (regnpause, hovedbryter, knappene).
       Config `anlegg`/`regnpause` (Tilpass → Entiteter) overstyrer. */
    _kiEnt(type) {
      if (type === 'anlegg' && this._c.anlegg) return this._c.anlegg;
      if (type === 'regnpause' && this._c.regnpause) return this._c.regnpause;
      const S = this._states; if (!S) return null;
      this._kiEntCache = this._kiEntCache || {};
      if (this._kiEntCache[type] !== undefined) return this._kiEntCache[type];
      let treff = Object.keys(S).find((id) => {
        const a = S[id].attributes || {};
        return a.integrasjon === 'ki_vanning' && a.ki_type === type;
      }) || null;
      if (!treff) {
        const moenster = {
          anlegg: /^switch\..*anlegg/, regnpause: /^number\..*regnpause/,
          regn_24t: /^button\..*regn(pause)?_?24/, regn_48t: /^button\..*regn(pause)?_?48/,
          nullstill_regnpause: /^button\..*nullstill_regnpause/, stopp_alt: /^button\..*stopp/,
          hent_plan: /^button\..*(hent|plan)/,
          nullstill_forbruk: /^button\..*nullstill_forbruk/, nullstill_kalibrering: /^button\..*nullstill_kalibrering/,
        }[type];
        if (moenster) treff = Object.keys(S).find((id) => moenster.test(id) && /ki_vanning|vanning/.test(id)) || null;
      }
      this._kiEntCache[type] = treff;
      return treff;
    },
    _tidTekst(v) {
      if (v === null || v === undefined || v === '') return '';
      const d = v instanceof Date ? v : new Date(v);
      if (isNaN(d.getTime()) || (!/\d{4}-\d{2}-\d{2}|T\d{2}:/.test(String(v)) && !(v instanceof Date))) return String(v);
      const idag = new Date(); idag.setHours(0, 0, 0, 0);
      const dag = new Date(d); dag.setHours(0, 0, 0, 0);
      const diff = Math.round((dag - idag) / 864e5);
      const kl = d.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });
      if (diff === 0) return `i dag kl. ${kl}`;
      if (diff === 1) return `i morgen kl. ${kl}`;
      if (diff === -1) return `i går kl. ${kl}`;
      const dato = d.toLocaleDateString('nb-NO', { weekday: 'short', day: 'numeric', month: 'short' });
      return `${dato} kl. ${kl}`;
    },
    _tidFlis(v) {
      const t = this._tidTekst(v);
      const m = t.match(/^(.*?)\s+(kl\. \d{2}[:.]\d{2})$/);
      return m ? `<span class="d">${kiVaEsc(m[1])}</span> <span class="k">${kiVaEsc(m[2])}</span>` : kiVaEsc(t);
    },
    // Én haptic per trykk (fallgruve 7): MSH.haptic struper til én per 40 ms, så kortets egen klikk-haptic vinner.
    _haptikk(type) { if (this._c.haptikk !== false) M.haptic(type || 'selection'); },
    _igjen(v) {
      const d = new Date(v); if (isNaN(d.getTime())) return '';
      const min = Math.round((d.getTime() - Date.now()) / 60000);
      if (min <= 0) return '';
      if (min < 60) return `${min} min`;
      if (min < 48 * 60) return `${Math.round(min / 60)} t`;
      return `${Math.round(min / 1440)} d`;
    },
    /* Strømtrekket fra OpenSprinkler, i mA, og hva det blir i watt ved ventilspenningen (24 V AC som standard). */
    _strom(id) {
      const st = this._st(id);
      if (!st || ['unknown', 'unavailable'].includes(st.state)) return null;
      let mA = Number(st.state);
      if (isNaN(mA)) return null;
      const enhet = String((st.attributes || {}).unit_of_measurement || 'mA');
      if (enhet === 'A') mA *= 1000;
      const volt = Number(this._c.spenning) || 24;
      return { mA, W: (mA / 1000) * volt };
    },
    _litertekst(v) {
      const n = Number(v) || 0;
      return n >= 1000 ? (n / 1000).toLocaleString('nb-NO', { maximumFractionDigits: 2 }) + ' m³'
        : Math.round(n).toLocaleString('nb-NO') + ' L';
    },
    /* ---------- automatisk oppsett ---------- */
    _prefiks() {
      if (this._c.prefiks) return this._c.prefiks;
      const ki0 = this._ki();
      if (ki0 && ki0.modus === 'ventiler') return ki0.prefiks || 'ki_vanning';
      if (this._pref !== undefined) return this._pref;
      const S = this._states;
      const t = Object.keys(S).find((id) => /^binary_sensor\..+_s\d\d.*_station_running$/.test(id));
      this._pref = t ? t.replace(/^binary_sensor\./, '').replace(/_s\d\d.*_station_running$/, '') : null;
      if (this._c && this._c.demo) { const x = this._pref; this._pref = undefined; return x; }
      return this._pref;
    },
    _ventilmodus() { const ki = this._ki(); return !!ki && ki.modus === 'ventiler'; },
    /* Har anlegget en vannmåler – felles eller på en sone? Uten en er alle literne estimater, og forbruksdelen skjules. */
    _harFlyt() {
      if (this._c.flyt === false) return false;
      if (this._c.flyt === true) return true;
      const ki = this._ki();
      if (ki) {
        if (ki.har_flyt !== undefined) return !!ki.har_flyt;
        if (Array.isArray(ki.soner) && ki.soner.some((z) => z.flow)) return true;
      }
      const os = this._styring().flyt;
      const st = os ? this._st(os) : null;
      return !!(st && !['unknown', 'unavailable'].includes(st.state));
    },
    /* Soner: S01 … S16 med navn og metode hentet fra friendly_name («S05 Plen nord · Spreder B2»), boks fra B\d */
    _soner() {
      const ki = this._ki();
      if (ki && ki.modus === 'ventiler') {
        return (ki.soner || []).filter((z) => z.nr !== 0).map((z) => ({
          nr: String(z.nr).padStart(2, '0'), navn: z.navn, metode: z.metode || '', boks: z.boks || '',
          bryter: z.bryter, gaar: z.gaar || z.bryter, status: z.status || z.bryter, ubrukt: false,
        }));
      }
      const S = this._states, p = this._prefiks(); if (!p) return [];
      const re = new RegExp('^switch\\.' + p + '_s(\\d\\d)(.*)_station_enabled$');
      return Object.keys(S).map((id) => {
        const m = id.match(re); if (!m) return null;
        const nr = m[1], hale = m[2] || '';
        const fn = (S[id].attributes || {}).friendly_name || '';
        const tekst = fn.replace(/^.*?\bS\d\d\b\s*/i, '').replace(/\s*Station Enabled$/i, '').trim();
        const ubrukt = !tekst || /^S?\d+$/.test(tekst);
        const deler = tekst.split('·').map((x) => x.trim());
        const navn = deler[0] || 'Sone ' + nr;
        const metode = deler[1] || '';
        const boks = (metode.match(/B(\d)/i) || [])[1] || (tekst.match(/B(\d)/i) || [])[1] || '';
        return { nr, navn, metode, boks, ubrukt,
          bryter: id,
          gaar: `binary_sensor.${p}_s${nr}${hale}_station_running`,
          status: `sensor.${p}_s${nr}${hale}_station_status` };
      }).filter(Boolean).sort((a, b) => a.nr.localeCompare(b.nr))
        .filter((z) => !(this._c.skjul_ubrukte !== false && z.ubrukt));
    },
    _programmer() {
      const ki = this._ki();
      if (ki && ki.modus === 'ventiler') {
        return (ki.program_historikk || []).map((x) => ({
          navn: x.navn, slug: x.slug, bryter: null, gaar: null, start: null, intervall: null,
          plan: x,
        }));
      }
      const S = this._states, p = this._prefiks(); if (!p) return [];
      const re = new RegExp('^switch\\.' + p + '_(.+)_program_enabled$');
      return Object.keys(S).map((id) => {
        const m = id.match(re); if (!m) return null;
        const slug = m[1];
        const fn = (S[id].attributes || {}).friendly_name || slug;
        return { navn: fn.replace(/\s*Program Enabled$/i, '').trim(), slug, bryter: id,
          gaar: `binary_sensor.${p}_${slug}_program_running`,
          start: `time.${p}_${slug}_start_time`,
          vaer: `switch.${p}_${slug}_program_use_weather`,
          intervall: `number.${p}_${slug}_interval_days` };
      }).filter(Boolean).sort((a, b) => a.navn.localeCompare(b.navn, 'nb'));
    },
    _styring() {
      const p = this._prefiks();
      return p ? {
        aktiv: `switch.${p}_enabled`, regn: `binary_sensor.${p}_rain_delay_active`,
        regn_til: `sensor.${p}_rain_delay_stop_time`, vannivaa: `sensor.${p}_water_level`,
        flyt: `sensor.${p}_flow_rate`, strom: this._c.strom || `sensor.${p}_current_draw`,
        siste: `sensor.${p}_last_run`,
        neste: this._st(`sensor.${p}_next_run`) ? `sensor.${p}_next_run` : 'sensor.opensprinkler_next_run',
        pause: `binary_sensor.${p}_paused`, pause_til: `sensor.${p}_pause_end_time`,
      } : {};
    },
    _aktivSone() { return this._soner().find((z) => this._on(z.gaar)) || null; },
    /* ---------- handlinger ---------- */
    _tjeneste(navn, data, mål) {
      this._haptikk('light');
      return this._h.callService('opensprinkler', navn, data || {}, mål ? { entity_id: mål } : undefined);
    },
    _ki_tjeneste(navn, data) {
      this._haptikk('light');
      return this._h.callService('ki_vanning', navn, data || {});
    },
    /* Nedtelling for vanning startet med en fast tid – kortet husker selv når sonen skal være ferdig (localStorage). */
    _husk(sone, min) {
      try {
        const alle = JSON.parse(localStorage.getItem('ki-vanning-slutt') || '{}');
        alle[sone.bryter] = { slutt: Date.now() + min * 60000, total: min * 60 };
        localStorage.setItem('ki-vanning-slutt', JSON.stringify(alle));
      } catch (e) { /* privat modus */ }
    },
    _glem(id) {
      try {
        const alle = JSON.parse(localStorage.getItem('ki-vanning-slutt') || '{}');
        if (id) delete alle[id]; else for (const k of Object.keys(alle)) delete alle[k];
        localStorage.setItem('ki-vanning-slutt', JSON.stringify(alle));
      } catch (e) { /* privat modus */ }
    },
    _husket(sone) {
      try {
        const x = JSON.parse(localStorage.getItem('ki-vanning-slutt') || '{}')[sone.bryter];
        return x && x.slutt > Date.now() - 5000 ? x : null;
      } catch (e) { return null; }
    },
    _kjor(sone, min) {
      this._husk(sone, min);
      if (this._ventilmodus() || (this._ki() && this._h.services && this._h.services.ki_vanning && this._h.services.ki_vanning.kjor))
        return this._ki_tjeneste('kjor', { sone: sone.bryter, minutter: min });
      return this._tjeneste('run_station', { run_seconds: min * 60 }, sone.bryter);
    },
    _stopp(id) {
      this._glem(id && this._soner().some((x) => x.bryter === id) ? id : null);
      if (this._ventilmodus()) return this._ki_tjeneste('stopp', {});
      return this._tjeneste('stop', {}, id || this._styring().aktiv);
    },
    _regn(t) {
      if (this._ventilmodus()) {
        return t > 0 ? this._ki_tjeneste('sett_regnpause', { timer: t })
          : this._ki_tjeneste('nullstill_regnpause', {});
      }
      return this._tjeneste('set_rain_delay', { rain_delay: t }, this._styring().aktiv);
    },
    /* Hovedbryteren: egen entitet i ventilmodus, ellers OpenSprinklers «enabled» (config `anlegg` overstyrer) */
    _anlegg() {
      if (this._c.anlegg) return this._c.anlegg;
      if (this._ventilmodus()) return this._kiEnt('anlegg');
      return this._c.vinter || this._styring().aktiv;
    },
    _veksleAnlegg() {
      const id = this._anlegg();
      if (id) return this._veksle(id);
      const ki = this._ki();
      const pa = !(ki && ki.anlegg === false);
      return this._ki_tjeneste('sett_anlegg', { pa: !pa });
    },
    _veksle(id) { this._haptikk('light'); return this._h.callService('homeassistant', 'toggle', { entity_id: id }); },
    /* Innstillingsradene («Mer»): anlegg, regnpause, knappene og varslene fra KI Vanning. Returnerer rader (id, navn, tekst,
       type bryter|knapp|mer) – tegnes i Tilpass → Avansert. */
    _panelInnstillinger() {
      const ki = this._ki();
      const rad = (id, navn, tekst) => {
        if (!id || !this._st(id)) return null;
        const st = this._st(id);
        const bryter = id.startsWith('switch.') || id.startsWith('input_boolean.');
        const knapp = id.startsWith('button.');
        return { id, navn, type: bryter ? 'bryter' : knapp ? 'knapp' : 'mer', pa: st.state === 'on', tekst: bryter ? (st.state === 'on' ? 'På' : 'Av') : tekst !== undefined ? tekst : st.state };
      };
      const regn = this._kiEnt('regnpause'), anlegg = this._kiEnt('anlegg');
      const igjen = ki && ki.regnpause_minutter
        ? (ki.regnpause_minutter >= 60 ? Math.round(ki.regnpause_minutter / 60) + ' t igjen'
          : ki.regnpause_minutter + ' min igjen') : 'Ingen pause';
      const deler = [
        rad(anlegg, 'Anlegget', undefined),
        rad(regn, 'Regnpause', igjen),
        rad(this._kiEnt('regn_24t'), 'Regnpause 24 timer', 'Kjør'),
        rad(this._kiEnt('regn_48t'), 'Regnpause 48 timer', 'Kjør'),
        rad(this._kiEnt('nullstill_regnpause'), 'Nullstill regnpause', 'Kjør'),
        rad(this._kiEnt('stopp_alt'), 'Stopp alt nå', 'Kjør'),
        rad(this._kiEnt('hent_plan'), 'Hent programplan på nytt', 'Kjør'),
        rad(this._kiEnt('nullstill_forbruk'), 'Nullstill forbruk', 'Kjør'),
        rad(this._kiEnt('nullstill_kalibrering'), 'Nullstill kalibrering', 'Kjør'),
      ].filter(Boolean);
      const varselNavn = { varsel_hoved: 'Alle vanningsvarsler', varsel_program: 'Program startet og ferdig',
        varsel_sone: 'Hver sone', varsel_regnpause: 'Regnpause', varsel_vann_renner: 'Vann renner uten sone',
        varsel_ingen_flyt: 'Sone uten vannføring', test_varsel: 'Send testvarsel' };
      const varsler = Object.keys(varselNavn).map((t) => {
        const id = this._kiEnt(t);
        return id ? rad(id, varselNavn[t], t === 'test_varsel' ? 'Send' : undefined) : null;
      }).filter(Boolean);
      const mangler = !anlegg && !regn && this._ventilmodus();
      return { deler, varsler, mangler, ki: !!ki };
    },
    /* Historikken hentes fra statistikk-API-et (endring per døgn), ikke fra tilstandshistorikken. */
    async _hentHistorikk() {
      const ki = this._kiEntitet();
      if (!ki || !this._h || !this._h.callWS) return null;
      const dager = Math.max(7, Math.min(400, Number(this._c.historikk_dager) || 30));
      const slutt = new Date();
      const start = new Date(slutt.getTime() - dager * 864e5);
      start.setHours(0, 0, 0, 0);
      try {
        const svar = await this._h.callWS({
          type: 'recorder/statistics_during_period',
          start_time: start.toISOString(),
          end_time: slutt.toISOString(),
          statistic_ids: [ki],
          period: 'day',
          types: ['change', 'sum'],
        });
        const rader = (svar && svar[ki]) || [];
        if (!rader.length) return { rader: [], feil: null };
        let forrige = null;
        const ut = rader.map((r) => {
          let v = r.change;
          if (v === undefined || v === null) {
            v = forrige === null ? null : Number(r.sum) - forrige;
            forrige = Number(r.sum);
          }
          return { dato: new Date(r.start), liter: v === null ? null : Math.max(0, Number(v)) };
        }).filter((r) => r.liter !== null);
        return { rader: ut, feil: null };
      } catch (e) {
        return { rader: [], feil: e && e.message ? e.message : String(e) };
      }
    },
    /* Månedskalender over vanning – data. Målte dager fra døgnstatistikken, planlagte fra programmenes ukedager.
       (this._mnd = måned-forskyvning, this._valgtDag = valgt dag.) */
    _manedskalender() {
      const naa = new Date(); naa.setHours(0, 0, 0, 0);
      const vist = new Date(naa.getFullYear(), naa.getMonth() + (this._mnd || 0), 1);
      const start = new Date(vist);
      start.setDate(1 - ((vist.getDay() + 6) % 7));
      const malt = {};
      for (const r of ((this._histData && this._histData.rader) || [])) {
        if (r.liter > 0.5) {
          const d = new Date(r.dato); d.setHours(0, 0, 0, 0);
          malt[d.toDateString()] = (malt[d.toDateString()] || 0) + r.liter;
        }
      }
      const ki = this._ki() || {};
      const oppsett = ki.program_historikk || [];
      const dagNokkel = ['man', 'tir', 'ons', 'tor', 'fre', 'lor', 'son'];
      const planlagt = {};
      for (const prog of oppsett) {
        if (prog.aktiv === false) continue;
        const dager = prog.dager && prog.dager.length ? prog.dager : null;
        if (!dager) continue;
        for (let i = 0; i < 42; i++) {
          const d = new Date(start); d.setDate(start.getDate() + i);
          if (d < naa) continue;
          if (!dager.includes(dagNokkel[(d.getDay() + 6) % 7])) continue;
          (planlagt[d.toDateString()] = planlagt[d.toDateString()] || []).push(
            { navn: prog.navn, tid: prog.tid, soner: prog.soner || [] });
        }
      }
      const ruter = [];
      for (let i = 0; i < 42; i++) {
        const dag = new Date(start); dag.setDate(start.getDate() + i);
        const n = dag.toDateString();
        ruter.push({ dag, n, utenfor: dag.getMonth() !== vist.getMonth(), malt: malt[n] || 0, plan: planlagt[n] || null, idag: dag.getTime() === naa.getTime() });
      }
      return { vist, ruter, malt, planlagt, valgt: this._valgtDag || naa.toDateString() };
    },
    /* Sist vannet: OpenSprinklers «last run», ellers siste dag med forbruk i statistikken fra KI Vanning. */
    _sistVannet() {
      const s = this._styring();
      const S = this._states || {};
      const p = this._prefiks();
      const id = [s.siste, ...Object.keys(S).filter((x) => x.startsWith('sensor.') && p && x.includes(p) && /last_run|siste_kjoring|sist_vannet/.test(x))]
        .find((x) => x && S[x] && !['unknown', 'unavailable', '', 'None'].includes(S[x].state));
      if (id) return { id, tekst: this._tidFlis(S[id].state) };
      const h = this._histData;
      const rad = h && h.rader ? [...h.rader].reverse().find((r) => r.liter > 0.5) : null;
      if (!rad) return null;
      const idag = new Date().toDateString(), igar = new Date(Date.now() - 864e5).toDateString();
      const dag = rad.dato.toDateString() === idag ? 'I dag' : rad.dato.toDateString() === igar ? 'I går'
        : rad.dato.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' });
      return { tekst: `${dag} <small>· ${this._litertekst(rad.liter)}</small>` };
    },
    /* Nedtellingen for sonen som vanner (fra _tegnScene): planleggeren, statussensoren, attributter eller husket tid.
       Setter this._slutt / this._total. */
    _nedtelling(z, s) {
      const ki = this._ki(), st = z ? this._st(z.status) : null;
      const pl = ki && ki.planlegger;
      const fraPlan = !!(pl && pl.kjorer && pl.sekunder_igjen > 0);
      if (fraPlan) {
        if (!this._total || Math.abs((this._slutt - Date.now()) / 1000 - pl.sekunder_igjen) > 3) {
          this._total = Math.max(this._total || 0, pl.sekunder_igjen);
          this._slutt = Date.now() + pl.sekunder_igjen * 1000;
        }
      }
      const rest = !fraPlan && z && st ? String(st.state).match(/(\d+):(\d\d)(?::(\d\d))?/) : null;
      const a = st ? st.attributes || {} : {};
      const sluttAttr = !fraPlan && z ? (a.end_time || a.slutt || a.ends_at || null) : null;
      const igjenAttr = !fraPlan && z ? Number(a.seconds_remaining ?? a.remaining ?? a.sekunder_igjen ?? NaN) : NaN;
      const husket = !fraPlan && z ? this._husket(z) : null;
      if (rest) {
        const sek = rest[3] ? (+rest[1]) * 3600 + (+rest[2]) * 60 + (+rest[3]) : (+rest[1]) * 60 + (+rest[2]);
        if (!this._total || Math.abs((this._slutt - Date.now()) / 1000 - sek) > 3) { this._total = husket ? husket.total : sek; this._slutt = Date.now() + sek * 1000; }
      } else if (!isNaN(igjenAttr) && igjenAttr > 0) {
        if (!this._total || Math.abs((this._slutt - Date.now()) / 1000 - igjenAttr) > 3) { this._total = husket ? husket.total : igjenAttr; this._slutt = Date.now() + igjenAttr * 1000; }
      } else if (sluttAttr && !isNaN(new Date(sluttAttr))) {
        this._slutt = new Date(sluttAttr).getTime(); this._total = husket ? husket.total : Math.max(this._total || 0, (this._slutt - Date.now()) / 1000);
      } else if (husket) {
        this._slutt = husket.slutt; this._total = husket.total;
      } else if (!fraPlan) { this._slutt = null; this._total = 0; }
      if (!z) this._soner().forEach((x) => { if (this._husket(x) && !this._on(x.gaar) && this._husket(x).slutt < Date.now()) this._glem(x.bryter); });
      return this._slutt ? Math.max(0, Math.round((this._slutt - Date.now()) / 1000)) : null;
    },

    /* ============================================================ KI Vann (ki-cards 71-ki-vann-card.js 1.1.0) */
    // Prefiks: config `vann_prefiks` (standard sensor.hjemme_). Finnes ikke <prefiks>vann_i_dag: første sensor.*_vann_i_dag
    // med `integrasjon`-attributt (KI Vann). Ellers null → toppkortet viser «–».
    _vannPrefiks() {
      const S = this._states || {};
      const p = this._c.vann_prefiks || 'sensor.hjemme_';
      if (S[p + 'vann_i_dag']) return p;
      const id = Object.keys(S).find((x) => /^sensor\..*vann_i_dag$/.test(x) && (S[x].attributes || {}).integrasjon);
      return id ? id.replace(/vann_i_dag$/, '') : null;
    },
    _vann() {
      const p = this._vannPrefiks(); if (!p) return null;
      const st = (s) => this._st(p + s);
      const tall = (s) => {
        const x = st(s);
        if (!x || ['unknown', 'unavailable', ''].includes(x.state)) return null;
        const n = parseFloat(x.state);
        return isNaN(n) ? null : n;
      };
      const hoved = st('vann_i_dag');
      if (!hoved) return null;
      const modellSt = this._c.vann_modell ? this._st(this._c.vann_modell) : st('modell');
      const storsteSt = st('storste_forbruker_i_dag');
      const A = hoved.attributes || {};
      const alle = KI_VN_KAT.map((k) => ({ ...k, ent: p + k.id + '_i_dag', liter: tall(`${k.id}_i_dag`) || 0 }));
      const deler = alle.filter((k) => k.liter > 0.05).sort((a, b) => b.liter - a.liter);
      const pp = A.per_person != null ? Number(typeof A.per_person === 'object' ? Object.values(A.per_person).reduce((t, v) => t + (Number(v) || 0), 0) / Math.max(1, Object.keys(A.per_person).length) : A.per_person) : null;
      const hend = [A.hendelser, A.events, A.siste_hendelser].find((x) => Array.isArray(x) && x.length) || [];
      return {
        p, id: p + 'vann_i_dag', totalt: tall('vann_i_dag') || 0, kr: tall('vannkostnad_i_dag'), forklart: tall('forklart_av_sensorene'),
        modell: modellSt && !['unknown', 'unavailable'].includes(modellSt.state) ? modellSt.state : null,
        timer: modellSt && modellSt.attributes ? modellSt.attributes.timer_i_vindu : null,
        storste: storsteSt && storsteSt.state && storsteSt.state !== 'unknown' ? storsteSt.state : null,
        per_person: pp != null && !isNaN(pp) ? pp : null, deler, alle, hendelser: hend,
      };
    },
    // Vannmåler totalt (vann-toppkortet): config `vannmaler`, ellers en vannmåler (device_class water, total_increasing),
    // helst med samme prefiks som KI Vann.
    _vannmaler() {
      if (this._c.vannmaler) return this._c.vannmaler;
      const S = this._states || {}, p = this._vannPrefiks();
      const L = Object.keys(S).filter((id) => id.startsWith('sensor.') && (S[id].attributes || {}).device_class === 'water' && (S[id].attributes || {}).state_class === 'total_increasing' && !/_i_dag$/.test(id));
      return (p && L.find((id) => id.startsWith(p))) || L[0] || null;
    },
  };
  /* Kategoriene fra KI Vann i den rekkefølgen de vises, med entitetssuffiks, ikon og farge. */
  const KI_VN_KAT = [
    { id: 'dusj', navn: 'Dusj', ikon: 'mdi:shower-head', farge: 'var(--blue, #4aa3e0)' },
    { id: 'toalett', navn: 'Toalett', ikon: 'mdi:toilet', farge: 'var(--purple, #a98fe0)' },
    { id: 'handvask', navn: 'Håndvask', ikon: 'mdi:hand-wash-outline', farge: 'var(--active-big, #ee95ff)' },
    { id: 'oppvask_og_matlaging', navn: 'Oppvask', ikon: 'mdi:silverware-clean', farge: 'var(--green, #5ad18b)' },
    { id: 'vaskemaskin', navn: 'Vaskemaskin', ikon: 'mdi:washing-machine', farge: 'var(--yellow, #f5c542)' },
    { id: 'oppvaskmaskin', navn: 'Oppvaskmaskin', ikon: 'mdi:dishwasher', farge: 'var(--orange, #f0a952)' },
    { id: 'utendors', navn: 'Utendørs', ikon: 'mdi:sprinkler-variant', farge: 'var(--teal, #3fbfb0)' },
    { id: 'basis_og_udefinert', navn: 'Udefinert', ikon: 'mdi:water-outline', farge: 'var(--gray600, #7a7a7d)' },
  ];
  M.KI_VN_KAT = KI_VN_KAT;
  // Standardverdier (ki-cards setConfig + KI Vann)
  const DEF = { varigheter: [5, 10, 15, 30], skjul_ubrukte: true, historikk_dager: 30, mal: 400 };
  // Logikk-objekt uten kort (Tilpass-arket / GUI-editoren): samme metoder, samme config.
  const logic = (hass, cfg) => { const o = {}; Object.defineProperties(o, Object.getOwnPropertyDescriptors(KV)); o.__h = hass; o.__c = { ...DEF, ...(cfg || {}) }; return o; };

  /* ============================================================ felles for kortet og Tilpass */
  const FANER = ['naa', 'soner', 'programmer', 'forbruk', 'historikk'];
  const FANE = { naa: ['Nå', 'mdi:water'], soner: ['Soner', 'mdi:sprinkler-variant'], programmer: ['Program', 'mdi:calendar-clock'], forbruk: ['Forbruk', 'mdi:chart-bar'], historikk: ['Historikk', 'mdi:chart-timeline-variant'] };
  const OLD_TAB = { now: 'naa', zones: 'soner', prog: 'programmer', use: 'forbruk', hist: 'historikk', innstillinger: null };
  const DAGK = ['man', 'tir', 'ons', 'tor', 'fre', 'lor', 'son'];
  const DAGN = { man: 'Ma', tir: 'Ti', ons: 'On', tor: 'To', fre: 'Fr', lor: 'Lø', son: 'Sø' };
  const nf1 = (n) => M.nf(n, Number(n) % 1 ? 1 : 0);
  const dagNavn = (dt) => { const idag = new Date(); idag.setHours(0, 0, 0, 0); const x = new Date(dt); x.setHours(0, 0, 0, 0); const diff = Math.round((x - idag) / 864e5); if (diff === 0) return 'I dag'; if (diff === 1) return 'I morgen'; const w = new Date(dt).toLocaleDateString('nb-NO', { weekday: 'long' }); return w.charAt(0).toUpperCase() + w.slice(1); };
  const relDag = (t) => { const diff = Math.round((d0(t) - d0()) / DAY); return (diff === 0 ? 'i dag' : diff === -1 ? 'i går' : diff === 1 ? 'i morgen' : new Date(t).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })) + ' ' + M.hm(t); };
  const dagerTekst = (o) => (o.intervall ? `Hver ${o.intervall}. dag` : o.dager && o.dager.length && o.dager.length < 7 ? o.dager.map((d) => DAGN[d] || d).join(' · ') : 'Hver dag');
  // Faner i config: `faner` = synlige i rekkefølge (ki-cards-nøklene). Gammel ki-msh-config (tabs/hidden_tabs) leses også.
  const fanerCfg = (c) => {
    if (Array.isArray(c.faner) && c.faner.length) { const l = c.faner.filter((k) => FANER.includes(k)); if (l.length) return l; }
    if (Array.isArray(c.tabs) && c.tabs.length) { const hid = new Set((c.hidden_tabs || []).map((k) => OLD_TAB[k] || k)); const l = c.tabs.map((k) => OLD_TAB[k] || k).filter((k) => FANER.includes(k) && !hid.has(k)); if (l.length) return l; }
    return FANER.slice();
  };
  const fanevisning = (c) => c.fanevisning || (c.vis_fanenavn === false ? 'ikoner' : 'begge');
  // Sonenøkkel: «S05» (OpenSprinkler/KI Vanning), ellers objekt-id-en (reserve).
  const zKey = (z) => z.kode || String(z.id || '').split('.').pop();
  // Sonelisten til Tilpass → Soner (samme kilde som kortet)
  function soneListe(h, c) {
    if (!h) return [];
    const L = logic(h, c);
    if (L._prefiks()) return L._soner().map((x) => ({ key: 'S' + x.nr, kode: 'S' + x.nr, navn: x.navn, boks: x.boks }));
    const e = M.vanEnts(h, c || {}), codes = (c || {}).codes !== false;
    let n = 0;
    return e.zoneIds.map((id) => M.vanZone(h, id, c || {})).filter(Boolean).map((z) => { const kode = codes && z.type !== 'slange' ? 'S' + pad(++n) : ''; return { key: kode || id2k(z.id), kode, navn: z.name, boks: (z.name.match(/\bB(\d)\b/i) || [])[1] || '' }; });
  }
  const id2k = (id) => String(id || '').split('.').pop();

  /* ============================================================ kortet */
  class Vanning extends M.Card {
    static get cardName() { return 'Vanning'; }
    static get defaults() { return { ...DEF }; }
    static get schema() { return editorSchema; }
    static get uiPersist() { return ['tab', 'fold', 'fvis', 'hvis']; }
    get cardSize() { return 12; }
    // ki-cards-metodene leser this._c / this._h
    get _c() { return this.config; }
    get _h() { return this.hass; }
    _st(id) { if (!id) return null; if (this.config.demo) { const S = this._states; return S[id] || null; } return this.s(id); }
    setConfig(c) {
      this._kiId = undefined; this._pref = undefined; this._kiEntCache = null; this._demo = null; this.__sig = null;
      super.setConfig(c);
    }
    // Hurtigbuffer i ki-cards-logikken nullstilles når entitetslisten endrer seg (ny integrasjon, nye soner).
    _reset() {
      const h = this.hass, sig = h ? Object.keys(h.states).length + '|' + (this.config.demo || '') : '';
      if (sig !== this.__sig) { this.__sig = sig; this._kiId = undefined; this._pref = undefined; this._kiEntCache = null; this._kiEnt2 = undefined; }
    }
    _toast(t) { M.toast(t, { enabled: this.config.toasts !== false }); }
    onOpen() { this._last = 0; this._load(); }
    onClose() { if (this._tick) { clearInterval(this._tick); this._tick = null; } }
    // Historikk/statistikk hentes bare når popupen er åpen (fallgruve 8), mellomlagret i 5 min.
    async _load(force) {
      if (!this.hass || (!this.isOpen && !force)) return;
      if (!force && this._last && Date.now() - this._last < 300000) return;
      this._last = Date.now();
      this._reset();
      const jobs = [];
      if (this._prefiks()) {
        if (this._kiEntitet() && !this._henterHist) { this._henterHist = true; jobs.push(this._hentHistorikk().then((r) => { this._henterHist = false; this._histData = r || { rader: [], feil: null }; })); }
      } else {
        const m = model(this);
        jobs.push(M.vanLoad(this.hass, m.e, m.all, force).then((d) => { this._data = d; }));
      }
      await Promise.all(jobs).catch(() => {});
      this.update();
    }
    // KI Vann-statistikk per døgn for én måned (Forbruk → Kalender): vann_i_dag + kategoriene. Cache 5 min per måned.
    _vannStat(v, y, mo) {
      const key = `${v.p}|${y}-${mo}`, c = (this._vs = this._vs || {})[key];
      if (c && (c.busy || Date.now() - c.t < 300000)) return c.map;
      if (!this.hass || !this.hass.callWS || this.config.demo) return null;
      const ids = [v.id, ...v.alle.map((k) => k.ent)];
      const s = new Date(y, mo, 1), e = new Date(y, mo + 1, 1);
      this._vs[key] = { t: Date.now(), busy: true, map: c ? c.map : null };
      this.hass.callWS({ type: 'recorder/statistics_during_period', start_time: s.toISOString(), end_time: e.toISOString(), statistic_ids: ids, period: 'day', types: ['change', 'max'] })
        .then((r) => {
          const map = {};
          ids.forEach((id) => ((r && r[id]) || []).forEach((x) => { const k = dkey(typeof x.start === 'number' ? x.start : new Date(x.start).getTime()); const val = x.max != null ? Number(x.max) : Number(x.change) || 0; (map[k] = map[k] || {})[id] = val; }));
          this._vs[key] = { t: Date.now(), map };
          this.update();
        }).catch(() => { this._vs[key] = { t: Date.now(), map: {} }; this.update(); });
      return c ? c.map : null;
    }

    /* ---------------------------------------------------------- felles modell (KI Vanning/OpenSprinkler eller reserve) */
    _vm() {
      this._reset();
      const c = this.config, ki = this._ki(), pref = this._prefiks();
      const V = { c, ki, pref, kiMode: !!pref, vent: this._ventilmodus() };
      V.redig = c.styring === 'ki_vanning' ? !!ki : c.styring === 'opensprinkler' ? false : V.vent;
      const vinterId = c.demo ? 'input_boolean.demo_vinter' : c.vinter;
      V.vinter = !!vinterId && this._on(vinterId);
      V.vann = this._vann();
      V.maler = this._vannmaler();
      if (V.kiMode) this._vmKi(V); else this._vmRes(V);
      V.aktiv = V.soner.find((z) => z.gaar) || null;
      V.harForbruk = !!V.vann || V.harFlyt;
      return V;
    }
    _vmKi(V) {
      const ki = V.ki, s = this._styring(), c = this.config;
      V.s = s;
      const kiSoner = (ki && ki.soner) || [];
      const rateOf = (nr, navn) => { const k = kiSoner.find((y) => Number(y.nr) === Number(nr) || y.navn === navn); return k && k.rate ? Number(k.rate) : null; };
      const plan = ((ki && ki.programmer) || []).filter((x) => (x.minutter_til ?? 0) >= 0)
        .map((x) => ({ ...x, d: x.start ? new Date(x.start) : null }))
        .sort((a, b) => (a.d ? a.d.getTime() : Infinity) - (b.d ? b.d.getTime() : Infinity));
      V.plan = plan;
      const oppsett = (ki && ki.program_historikk) || [];
      const treff = (y, x) => (y.nr != null && Number(y.nr) === Number(x.nr)) || (y.entity && y.entity === x.bryter) || String(y.navn || '').toLowerCase() === String(x.navn).toLowerCase();
      const aktivS = this._aktivSone();
      const igjen = this._nedtelling(aktivS, s);
      const alle = this._soner();
      V.soner = alle.map((x) => {
        const gaar = this._on(x.gaar), gs = this._st(x.gaar);
        const nx = plan.find((p) => (p.soner || []).some((y) => treff(y, x)));
        return {
          key: 'S' + x.nr, kode: 'S' + x.nr, navn: x.navn, metode: x.metode, boks: x.boks, bryter: x.bryter, kanAv: !V.vent,
          av: !(this._on(x.bryter) || V.vent), gaar, prog: [...plan, ...oppsett].some((p) => (p.soner || []).some((y) => treff(y, x))),
          sist: !gaar && gs && gs.last_changed ? new Date(gs.last_changed).getTime() : null,
          neste: nx ? { t: nx.d ? nx.d.getTime() : null, tid: nx.tid || (nx.d ? M.hm(nx.d) : ''), prog: nx.navn } : null,
          rate: rateOf(x.nr, x.navn), left: gaar && aktivS && aktivS.bryter === x.bryter ? igjen : null, total: this._total || 0, src: x,
        };
      });
      V.harFlyt = this._harFlyt();
      V.harHist = !!this._kiEntitet();
      // anlegg / regn / vinter (som _tegnResten)
      const anleggId = V.vent ? this._kiEnt('anlegg') : null;
      V.anleggId = this._anlegg();
      V.anleggNavn = c.vinter ? 'Vintermodus' : 'Anlegget';
      V.anleggPa = c.anlegg ? this._on(c.anlegg) : c.vinter ? this._on(c.vinter) : anleggId ? this._on(anleggId) : V.vent ? !(ki && ki.anlegg === false) : this._on(s.aktiv);
      V.klar = c.vinter ? !V.vinter : V.anleggPa;
      V.regnPa = this._on(s.regn) || !!(ki && ki.regnpause);
      const rt = this._st(s.regn_til);
      V.regnTil = rt && !['unknown', 'unavailable', ''].includes(rt.state) ? this._tidTekst(rt.state) : ki && ki.regnpause_minutter ? `${this._igjen(Date.now() + ki.regnpause_minutter * 60000)} igjen` : '';
      V.hv = ki && ki.hovedventil && ki.hovedventil.stengt_mens_sone_gaar ? ki.hovedventil : null;
      V.kanHoppe = !!(this.hass && this.hass.services && this.hass.services.ki_vanning && this.hass.services.ki_vanning.hopp_over);
      V.iDag = ki ? Number(ki.i_dag || 0) : null;
      V.estimat = ki ? Number(ki.estimat_i_dag || 0) : null;
      V.unit = 'L';
      // neste vanning
      const neste = plan[0] || null, n = (ki && ki.neste) || {};
      if (neste || n.navn) {
        const d = neste && neste.d, prog = (neste && neste.navn) || n.navn || '';
        const tid = (neste && neste.tid) || n.tid || (d ? M.hm(d) : '');
        const x = ((neste && neste.soner) || [])[0];
        let forste = null;
        if (x) {
          const y = alle.find((z) => (x.nr != null && Number(z.nr) === Number(x.nr)) || String(z.navn).toLowerCase() === String(x.navn || '').toLowerCase()) || {};
          const r = rateOf(x.nr, x.navn), L = r && x.min ? Number(x.min) * r : null;
          forste = { ikon: kiVaIkon(y.metode || x.navn || ''), navn: `${y.nr ? 'S' + y.nr + ' ' : ''}${x.navn || y.navn || ''}`, kind: [prog, (y.metode || '').replace(/\s*B\d\b/i, '').toLowerCase()].filter(Boolean).join(' · '), amount: [x.min ? `${x.min} min` : '', L ? `${nf(L)} L` : ''].filter(Boolean).join(' · ') };
        }
        const tot = (neste && neste.total_min) || n.total_min, L = (neste && neste.estimat_liter) || n.estimat_liter;
        V.neste = { naar: d ? `${dagNavn(d)} ${d.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })}` : (n.naar || ''), kort: `${d ? dagNavn(d).toLowerCase() : String(n.naar || '').toLowerCase()} ${tid}`.trim(), tid, prog, forste, sub: [tot ? `${tot} min` : '', L ? `ca. ${nf(L)} L` : ''].filter(Boolean).join(' · '), kjor: { prog } };
      } else {
        const ns = this._st(s.neste);
        const t = ns && !['unknown', 'unavailable', '', 'None'].includes(ns.state) ? this._tidTekst(ns.state) : '';
        const m = t.match(/^(.*?)\s+kl\.\s+(\d{2}[:.]\d{2})$/);
        V.neste = t ? { naar: m ? m[1].charAt(0).toUpperCase() + m[1].slice(1) : t, kort: m ? `${m[1]} ${m[2]}` : t, tid: m ? m[2] : '', prog: '', forste: null, sub: '', kjor: { os: true } } : null;
      }
      // neste 7 dager
      V.dager7 = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + i);
        const L = plan.filter((x) => x.d && x.d.toDateString() === d.toDateString());
        return { d, v: L.reduce((t, x) => t + (Number(x.estimat_liter) || 0), 0), n: L.length, navn: [...new Set(L.map((x) => x.navn))], tid: L[0] ? L[0].tid : '' };
      });
      // programmer
      const src = V.redig && ki && !V.vent ? oppsett.map((x) => ({ navn: x.navn, slug: x.slug, bryter: null, plan: x })) : this._programmer();
      const finnPlan = (navn) => plan.find((x) => String(x.navn).toLowerCase() === String(navn).toLowerCase()) || null;
      const finnOppsett = (navn) => oppsett.find((x) => String(x.navn).toLowerCase() === String(navn).toLowerCase()) || null;
      V.progKilde = V.redig ? 'ki' : V.vent ? 'ki' : 'os';
      V.progs = src.map((x) => {
        const o = x.plan || finnOppsett(x.navn) || {};
        const pl = finnPlan(x.navn);
        const ventilProg = !x.bryter;
        const gaar = ventilProg ? !!(ki && ki.planlegger && ki.planlegger.program === x.navn) : this._on(x.gaar);
        const venter = (this._venter || {})[x.navn];
        const ventende = venter && venter.til > Date.now() ? venter.aktiv : null;
        const fraSensor = ventilProg ? o.aktiv !== false : this._on(x.bryter);
        if (venter && (venter.til <= Date.now() || fraSensor === venter.aktiv)) delete this._venter[x.navn];
        const pa = ventende === null ? fraSensor : ventende;
        const tid = o.tid || (this._st(x.start) ? String(this._st(x.start).state).slice(0, 5) : '––:––');
        const soner = (o.soner && o.soner.length ? o.soner : (pl && pl.soner) || []).map((z) => ({ navn: z.navn || (alle.find((y) => y.bryter === z.entity) || {}).navn || z.entity, min: z.min }));
        const total = o.total_min || (pl && pl.total_min) || soner.reduce((a, b) => a + (b.min || 0), 0);
        const liter = pl ? pl.estimat_liter : null;
        const intv = !o.intervall && x.intervall && this._st(x.intervall) && M.isNum(this._st(x.intervall).state) ? Number(this._st(x.intervall).state) : 0;
        const dager = dagerTekst(intv > 1 ? { intervall: intv } : o);
        const sub = [dager, soner.length === 1 ? soner[0].navn : soner.length ? `${soner.length} soner` : '', total ? `${total} min` : '', liter ? `ca. ${Math.round(liter).toLocaleString('nb-NO')} L` : ''].filter(Boolean).join(' · ');
        return { key: x.slug || x.navn, navn: x.navn, tid, sub, pa, gaar, bryter: x.bryter || null, naar: pl ? (pl.i_dag ? 'I dag' : 'Neste') : '' };
      });
      // kommende vanninger (ki-cards _kalender)
      V.agenda = [];
      const dm = new Map();
      plan.slice(0, 20).forEach((x) => { const d = x.d || new Date(), k = d.toDateString(); if (!dm.has(k)) dm.set(k, { d, rader: [] }); dm.get(k).rader.push(x); });
      dm.forEach(({ d, rader }) => V.agenda.push({ k: d.toDateString(), dag: `${dagNavn(d)} ${d.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })}`, total: (() => { const L = rader.reduce((t, x) => t + (Number(x.estimat_liter) || 0), 0), a = rader.reduce((t, x) => t + ((x.soner && x.soner.length) || 1), 0); return `${a} ${a === 1 ? 'sone' : 'soner'}${L ? ` · ${nf(L)} L` : ''}`; })(), items: rader.map((x) => ({ tid: x.tid || '', navn: `${x.navn}${x.soner && x.soner.length > 1 ? ` · ${x.soner.length} soner` : ''}`, amount: [x.total_min ? x.total_min + ' min' : '', x.estimat_liter ? nf(x.estimat_liter) + ' L' : ''].filter(Boolean).join(' · ') })) }));
      V.strom = this._strom(s.strom);
      V.stromId = s.strom;
      V.sist = this._sistVannet();
    }
    _vmRes(V) {
      const m = model(this), h = this.hass, c = this.config;
      V.m = m;
      const inPlan = (z) => Object.values(m.plan).some((l) => l.some((it) => it.z && it.z.id === z.id));
      V.soner = m.all.map((z) => {
        const en = z.os && h.states[`switch.${z.base}_station_enabled`] ? `switch.${z.base}_station_enabled` : null;
        let nx = null;
        for (const d of m.upcoming) { const it = d.items.find((x) => x.z && x.z.id === z.id); if (it) { nx = { t: it.t, tid: M.hm(it.t), prog: (it.ev && it.ev.summary) || '' }; break; } }
        return { key: z.code || id2k(z.id), kode: z.code, navn: z.name, metode: zKind(z, m.flowCfg), boks: (z.name.match(/\bB(\d)\b/i) || [])[1] || '', bryter: en, kanAv: !!en, av: z.disabled, gaar: z.running, prog: inPlan(z), sist: !z.running && !isNaN(z.last) ? z.last : null, neste: nx, rate: m.flowCfg, left: z.running ? z.left : null, total: z.min * 60, src: z };
      });
      V.harFlyt = !!(m.e.water || m.e.flow || m.flowCfg);
      V.harHist = !!(m.e.water || m.all.length);
      V.anleggId = m.e.system; V.anleggNavn = 'Anlegget'; V.anleggPa = m.sysOn; V.klar = m.sysOn;
      V.regnPa = m.rainOn; V.regnTil = '';
      V.kanHoppe = !!m.e.skip;
      const used = m.dayUsed(m.today), planned = m.amountOf(m.plan[m.today] || []) || null;
      V.iDag = m.unitL ? used : null;
      V.estimat = m.pUnitL ? planned : null;
      V.unit = m.pUnitL ? 'L' : 'min';
      const nx = m.upcoming[m.skipOn ? 1 : 0];
      if (nx) {
        const it = nx.items[0], d = new Date(it.t);
        V.neste = { naar: `${dayName(nx.k)} ${dShort(nx.k)}`, kort: `${dayName(nx.k).toLowerCase()} ${M.hm(it.t)}`, tid: M.hm(it.t), prog: (it.ev && it.ev.summary) || it.name, forste: { ikon: it.z ? zIcon(it.z) : 'mdi:sprinkler', navn: it.name, kind: [(it.ev && it.ev.summary) || '', it.z ? zKind(it.z, m.flowCfg).toLowerCase() : ''].filter((x) => x && x !== it.name).join(' · '), amount: itemAmt(m, it.min) }, sub: '', kjor: { res: true }, d };
      } else V.neste = null;
      V.dager7 = Array.from({ length: 7 }, (_, i) => { const d = new Date(d0() + i * DAY + DAY / 2), k = dkey(d.getTime()); const L = (m.plan[k] || []).filter((it) => it.t >= Date.now() - 60000 || i > 0); return { d: new Date(d0(d.getTime())), v: m.amountOf(L), n: L.length, navn: [...new Set(L.map((it) => (it.ev && it.ev.summary) || it.name))], tid: L[0] ? M.hm(L[0].t) : '' }; });
      V.progKilde = m.e.progIds.some((id) => /_program_enabled$/.test(id)) ? 'os' : 'ha';
      V.progs = m.e.progIds.map((id) => {
        const s = this.s(id); if (!s) return null;
        const dom = id.split('.')[0], base = id.split('.')[1].replace(/_program_enabled$/, '');
        const name = cap((s.attributes.friendly_name || base).replace(/\s*program\s*(enabled|aktivert)?$/i, '').trim());
        const nm = name.toLowerCase();
        let nextIt = null;
        for (const d of m.upcoming) { nextIt = d.items.find((it) => (it.ev.summary || '').toLowerCase().includes(nm)); if (nextIt) break; }
        const matched = nextIt ? (m.plan[dkey(nextIt.t)] || []).filter((it) => it.ev === nextIt.ev) : [];
        const mins = matched.reduce((t, it) => t + it.min, 0);
        const runS = /_program_enabled$/.test(id) ? this.s(`binary_sensor.${base}_program_running`) : null;
        const lt = s.attributes.last_triggered;
        const sub = [nextIt ? dayName(dkey(nextIt.t)) : '', matched.length ? `${matched.length === 1 ? matched[0].name : matched.length + ' soner'} · ${mins} min` : dom === 'automation' ? `Automasjon${lt ? ' · sist ' + M.relTime(lt) : ''}` : dom === 'script' ? 'Skript' : 'OpenSprinkler-program'].filter(Boolean).join(' · ');
        return { key: id, navn: name, tid: nextIt ? M.hm(nextIt.t) : '–', sub, pa: dom === 'script' ? true : M.isOn(s), gaar: !!(runS && runS.state === 'on'), bryter: dom === 'script' ? null : id, naar: '' };
      }).filter(Boolean);
      V.agenda = m.upcoming.map((d) => ({ k: d.k, dag: `${dayName(d.k)} ${dShort(d.k)}`, total: `${d.items.length} ${d.items.length === 1 ? 'sone' : 'soner'} · ${pamt(m, m.amountOf(d.items))}`, items: d.items.map((it) => ({ tid: M.hm(it.t), navn: it.name, amount: itemAmt(m, it.min) })) }));
      const cur = this.n(m.e.current), pw = this.n(m.e.power);
      V.strom = cur != null ? { mA: cur, W: (cur / 1000) * (Number(c.spenning) || 24) } : null;
      V.stromW = pw;
      V.stromId = m.e.current || m.e.power;
      let lastTxt = null;
      for (let i = 0; i < 400; i++) {
        const k = dkey(Date.now() - i * DAY), u = m.dayUsed(k), r = m.D.run[k];
        if ((u != null && u > 0) || (r && Object.values(r).some((v) => v > 0))) { lastTxt = `${i === 0 ? 'I dag' : dShort(k)} <small>· ${esc(u != null ? amt(m, u) : nf(Object.values(r).reduce((t, v) => t + v, 0) / 60) + ' min')}</small>`; break; }
      }
      V.sist = lastTxt ? { tekst: lastTxt } : null;
    }

    /* ---------------------------------------------------------- tegning */
    render() {
      const c = this.config, V = this._vm();
      this.__V = V;
      const tabs = fanerCfg(c).filter((f) => (f !== 'forbruk' || V.harForbruk) && (f !== 'historikk' || V.harHist));
      if (!tabs.length) tabs.push('naa');
      const cur = tabs.includes(this.ui.tab) ? this.ui.tab : tabs[0];
      this.__cur = cur;
      const hero = cur === 'forbruk' || cur === 'historikk' ? this._heroVann(V) : this._heroHage(V);
      const body = cur === 'soner' ? this._pSoner(V) : cur === 'programmer' ? this._pProg(V) : cur === 'forbruk' ? this._pForbruk(V) : cur === 'historikk' ? this._pHist(V) : this._pNaa(V);
      let html = `<div class="wrap">${hero}${this._faneRad(tabs, cur)}<div class="body" data-key="b-${cur}">${body}</div></div>`;
      if (c.haptikk === false) html = html.replace(/\sdata-haptic="[^"]*"/g, '').replace(/data-act=/g, 'data-haptic="off" data-act=');
      return html;
    }
    _cog() { return `<button class="cog press" data-act="customize" data-haptic="light" aria-label="Tilpass Vanning" title="Tilpass Vanning">${M.icon('mdi:cog', 22)}</button>`; }
    // Toppkort · hagescenen (Nå/Soner/Program)
    _heroHage(V) {
      const z = V.aktiv, c = this.config;
      const cls = z ? 'vanner' : V.vinter ? 'vinter' : V.regnPa ? 'regn' : '';
      const tittel = z ? `Vanner ${z.kode ? z.kode + ' ' : ''}${z.navn}` : V.vinter ? 'Vintermodus' : !V.klar ? 'Anlegget er av' : V.regnPa ? 'Regnpause – hagen hviler' : 'Klar til vanning';
      let under;
      if (z) { const so = z.left != null && z.total ? Math.max(0, z.total - z.left) : null; const L = so != null && z.rate ? (so / 60) * z.rate : null; under = [z.left != null ? `${fmt(z.left)} igjen` : 'Vanner nå', L != null ? `${nf(L)} L så langt` : ''].filter(Boolean).join(' · '); }
      else if (V.vinter) under = 'All vanning er stengt for sesongen';
      else if (V.regnPa) under = V.regnTil ? `Til ${V.regnTil}` : 'Venter på oppholdsvær';
      else under = V.neste ? `Neste: ${[V.neste.prog, V.neste.kort].filter(Boolean).join(' · ')}` : 'Ingen planlagt vanning';
      const pct = V.iDag != null && V.estimat ? Math.min(100, (V.iDag / V.estimat) * 100) : z ? 100 : 0;
      const u = V.unit || 'L';
      const label = V.iDag != null ? `${nf(V.iDag)} L av ${V.estimat ? nf(V.estimat) + ' ' + u : '–'} i dag` : V.estimat ? `– av ${nf(V.estimat)} ${u} i dag` : '–';
      return `<section class="scene ${cls}" data-key="hero-hage" ${z ? `data-act="scene" data-haptic="warning" title="Trykk for å stoppe"` : ''}>${SCENE}${SKYER}
        <div class="tekst"><div class="tittel ell">${esc(tittel)}</div><div class="under ell">${esc(under)}</div></div>
        ${this._cog()}${c.demo ? '<div class="demo">DEMO</div>' : ''}
        <div class="bunn"><div class="sp"><i style="width:${pct.toFixed(1)}%"></i></div><div class="tall num">${esc(label)}</div></div>
      </section>`;
    }
    // Toppkort · vann (Forbruk/Historikk): fyll mot `mal` (maks ≈ 42 %), to bølger, 3 største kategorier, målerstand
    _heroVann(V) {
      const v = V.vann, c = this.config, mal = Number(c.mal) || 400;
      const L = v ? v.totalt : null;
      const fyll = L != null ? Math.max(4, Math.min(42, (L / mal) * 42)) : 4;
      const wave = (k) => `<div class="wave ${k}">${[0, 1].map(() => `<svg viewBox="0 0 400 18" preserveAspectRatio="none"><path d="M0 9 q50 -9 100 0 t100 0 t100 0 t100 0 V18 H0 Z" fill="rgba(115,185,242,.42)"/></svg>`).join('')}</div>`;
      const chips = v ? v.deler.slice(0, 3).map((k) => `<span class="vc" data-ent="${esc(k.ent)}">${M.icon(k.ikon, 16, `color:${k.farge}`)}<span class="num">${nf(k.liter)} L</span></span>`).join('') : '';
      let meter = '';
      if (c.vis_vannmaler !== false && V.maler) {
        const ms = this._st(V.maler);
        if (ms && M.isNum(ms.state)) { const u = String((ms.attributes || {}).unit_of_measurement || 'm³'); const m3 = /^l$/i.test(u) ? Number(ms.state) / 1000 : Number(ms.state); meter = `<div class="vm num" data-ent="${esc(V.maler)}">${esc(m3.toLocaleString('nb-NO', { maximumFractionDigits: 1 }))} m³ · målt ${esc(M.hm(ms.last_updated || ms.last_changed || Date.now()))}</div>`; }
      }
      return `<section class="vhero" data-key="hero-vann" style="--fyll:${fyll.toFixed(1)}%">
        <div class="vfill"></div>${wave('b2')}${wave('b1')}
        <div class="vt"><div class="vl">Vann i dag</div><div class="vv num">${L != null ? nf(L) : '–'}<span>L</span></div>
          ${v ? `<div class="vs">${nf((L / mal) * 100)} % av målet${v.kr != null ? ` · ${esc(M.nf(v.kr, 1))} kr` : ''}</div>` : `<button class="vs pick press" data-act="customize" data-section="entiteter">${M.icon('mdi:plus', 16)}Velg KI Vann-prefiks i Tilpass</button>`}</div>
        ${this._cog()}
        <div class="vb"><div class="vch">${chips}</div>${meter}</div>
      </section>`;
    }
    _faneRad(tabs, cur) {
      const vis = fanevisning(this.config);
      return `<div class="tbox" data-key="tbox"><div class="tabs v-${vis}" role="tablist" data-glass-drag="x" aria-label="Vanning-faner">${tabs.map((k) => {
        const [l, ic] = FANE[k], on = k === cur;
        return `<button class="tab${on ? ' on' : ''}" role="tab" aria-selected="${on}" ${on ? 'data-active' : ''} data-act="tab" data-t="${k}" data-haptic="selection" aria-label="${esc(l)}" data-key="t-${k}">${vis !== 'tekst' ? M.icon(ic, vis === 'ikoner' ? 22 : 20) : ''}${vis !== 'ikoner' ? `<span class="tl">${esc(l)}</span>` : ''}</button>`;
      }).join('')}</div></div>`;
    }
    _tg(on, act, attrs) { return `<button class="tg ${on ? 'on' : ''}" role="switch" aria-checked="${!!on}" data-act="${act}" data-haptic="selection" ${attrs || ''}><i></i></button>`; }

    /* ---------------- Nå */
    _pNaa(V) {
      let o = '';
      if (V.hv) {
        const hv = V.hv;
        const grunn = hv.siste === 'feil' ? `Feil: ${hv.feil || 'ukjent'}` : hv.siste === 'utilgjengelig' ? (hv.feil || 'Ventilen er utilgjengelig') : hv.siste === 'åpnet' ? 'Den ble åpnet, men har stengt seg igjen' : 'Den er ikke forsøkt åpnet ennå';
        o += `<div class="card warnc" data-key="hv" ${hv.entity ? `data-ent="${esc(hv.entity)}"` : ''}><div class="nr"><span class="nri or">${M.icon('mdi:valve-closed', 22)}</span><div class="sx"><b>Hovedventilen er stengt</b><span>${esc(grunn)}</span></div><button class="mini press" data-act="hv" data-haptic="success">Åpne</button></div></div>`;
      }
      const z = V.aktiv, u = V.unit || 'L';
      if (z) {
        const tot = z.total || 0, left = z.left, pct = tot && left != null ? Math.min(100, ((tot - left) / tot) * 100) : 0;
        const so = tot && left != null ? tot - left : null, L = so != null && z.rate ? (so / 60) * z.rate : null;
        o += `<div class="card nx run" data-key="nx-run"><div class="rf" style="width:${pct.toFixed(1)}%"></div>
          <div class="nh"><div class="col grow" style="gap:4px;min-width:0"><div class="lab blue">Vanner nå</div><div class="nwhen ell">${esc(`${z.kode ? z.kode + ' ' : ''}${z.navn}`)}</div></div><div class="big num">${left != null ? fmt(left) : '–'}</div></div>
          <div class="nr"><span class="nri">${M.icon(kiVaIkon(z.metode || z.navn), 20)}</span><div class="sx"><b class="ell">${esc(z.metode || 'Sone')}</b><span>${esc(L != null ? `${nf(L)} L så langt` : z.neste && z.neste.prog ? z.neste.prog : 'Manuell')}</span></div></div>
          <div class="brow"><button class="bigbtn stop press" data-act="stopp" data-k="${esc(z.key)}" data-haptic="warning">${M.icon('mdi:stop', 22)}Stopp</button></div></div>`;
      } else {
        const n = V.neste;
        o += `<div class="card nx" data-key="nx">
          <div class="nh"><div class="col grow" style="gap:4px;min-width:0"><div class="lab">Neste vanning</div><div class="nwhen ell">${esc(n ? n.naar + (V.regnPa ? ' · utsettes' : '') : 'Ingen planlagt')}</div></div><div class="big num">${esc(n && n.tid ? n.tid : '–')}</div></div>
          ${n && n.forste ? `<div class="nr"><span class="nri">${M.icon(n.forste.ikon, 20)}</span><div class="sx"><b class="ell">${esc(n.forste.navn)}</b><span class="ell">${esc(n.forste.kind || '–')}</span></div><div class="amt num">${esc(n.forste.amount || '')}</div></div>`
            : n && n.prog ? `<div class="nr"><span class="nri">${M.icon('mdi:calendar-clock', 20)}</span><div class="sx"><b class="ell">${esc(n.prog)}</b><span>${esc(n.sub || '–')}</span></div></div>`
              : !n ? `<button class="nr pick2 press" data-act="customize" data-section="entiteter"><span class="nri">${M.icon('mdi:calendar-clock', 20)}</span><div class="sx"><b>–</b><span>Velg entitet · KI Vanning, OpenSprinkler eller vanningskalender</span></div>${M.icon('mdi:chevron-right', 20, 'color:#979797')}</button>` : ''}
          <div class="brow"><button class="bigbtn press" data-act="kjorneste" data-haptic="success" style="${n || (V.m && V.m.zones.length) ? '' : 'opacity:.55'}">${M.icon('mdi:play', 22)}Kjør nå</button>${V.kanHoppe && n ? `<button class="bigbtn ghost press" data-act="hopp" data-haptic="selection">${M.icon('mdi:skip-next', 22)}${V.m && V.m.skipOn ? 'Angre hopp' : 'Hopp over'}</button>` : ''}</div>
        </div>`;
      }
      // Neste 7 dager
      const D = V.dager7 || [], max = Math.max(1, ...D.map((d) => d.v));
      const selI = this.ui.dag != null && D[this.ui.dag] ? this.ui.dag : Math.max(0, D.findIndex((d) => d.v > 0));
      const sd = D[selI], sum = D.reduce((t, d) => t + d.v, 0);
      const fmtV = (v) => (u === 'L' ? `${nf(v)} L` : `${nf(v)} min`);
      o += `<div class="card" data-key="d7" style="gap:12px;padding:16px 18px 14px">
        <div class="sp"><div class="col" style="gap:2px;min-width:0"><span class="lab">Neste 7 dager</span><span class="d7t ell">${esc(sd ? `${dagNavn(sd.d)}${sd.tid ? ' · ' + sd.tid : ''}` : '–')}</span></div>
          <div class="col" style="gap:2px;align-items:flex-end;min-width:0"><span class="lab num">${sum ? esc(fmtV(sum) + ' planlagt') : '–'}</span><span class="d7s ell">${esc(sd && sd.n ? `${sd.navn.join(', ')} · ${fmtV(sd.v)}` : 'Ingen vanning')}</span></div></div>
        <div class="wk">${D.map((d, i) => `<button class="wkc" data-act="dag7" data-i="${i}" data-haptic="selection" aria-pressed="${i === selI}"><span class="wkb ${d.v ? '' : 'tom'} ${i === selI ? 'sel' : ''}" style="height:${d.v ? Math.max(8, (d.v / max) * 64).toFixed(0) : 4}px"></span><span class="wkl ${i === selI ? 'sel' : ''}">${esc(i ? cap(d.d.toLocaleDateString('nb-NO', { weekday: 'short' }).replace('.', '')) : 'I dag')}</span></button>`).join('')}</div>
      </div>`;
      // Brytere: anlegg + regnpause
      o += `<div class="card sw2" data-key="sw2" style="padding:6px 16px;gap:0">
        <div class="srow" data-key="sw-anlegg"><span class="si">${M.icon(this.config.vinter ? 'mdi:snowflake' : V.anleggPa ? 'mdi:power' : 'mdi:power-off', 20)}</span><div class="sx"><b>${esc(V.anleggNavn)}</b><span>${esc(V.anleggId || V.kiMode ? (V.anleggPa ? 'På' : 'Av') : '– · Velg entitet')}</span></div>${this._tg(V.anleggPa, 'anlegg', V.anleggId ? `data-ent="${esc(V.anleggId)}"` : '')}</div>
        <div class="srow bt" data-key="sw-regn"><span class="si">${M.icon(V.regnPa ? 'mdi:weather-pouring' : 'mdi:weather-rainy', 20)}</span><div class="sx"><b>Regnpause</b><span class="ell">${esc(V.regnPa ? (V.regnTil ? 'Til ' + V.regnTil : 'På') : `Av · ${Number(this.config.rain_hours) || 24} t ved på`)}</span></div>${this._tg(V.regnPa, 'regn')}</div>
      </div>`;
      // Strøm + sist vannet
      const power = V.strom ? `${Math.round(V.strom.mA)} mA <small>· ca. ${esc(V.strom.W.toLocaleString('nb-NO', { maximumFractionDigits: 1 }))} W</small>` : V.stromW != null ? `${nf(V.stromW)} W` : '–';
      o += `<div class="g2" data-key="tiles">
        <div class="tile" ${V.stromId ? `data-ent="${esc(V.stromId)}"` : ''}><div class="th">${M.icon('mdi:lightning-bolt', 16, `color:${C.yellow}`)}Strøm</div><div class="tv num">${power}</div></div>
        <div class="tile" ${V.sist && V.sist.id ? `data-ent="${esc(V.sist.id)}"` : ''}><div class="th">${M.icon('mdi:history', 16, `color:${C.blue}`)}Sist vannet</div><div class="tv">${V.sist ? V.sist.tekst : '–'}</div></div>
      </div>`;
      return o;
    }

    /* ---------------- Soner */
    _pSoner(V) {
      if (!V.soner.length) return M.emptyState('Fant ingen soner (KI Vanning, OpenSprinkler, valve eller switch)', 'entiteter');
      const c = this.config, skjul = new Set(c.skjul_soner || []), orden = Array.isArray(c.soneorden) ? c.soneorden : [], navn = c.sonenavn || {};
      const list = V.soner.filter((z) => !skjul.has(z.key)).map((z, i) => ({ ...z, navn: navn[z.key] || z.navn, i }))
        .sort((a, b) => { const x = orden.indexOf(a.key), y = orden.indexOf(b.key); return (x < 0 ? 1e3 + a.i : x) - (y < 0 ? 1e3 + b.i : y); });
      let groups;
      const G = Array.isArray(c.grupper) ? c.grupper.filter((g) => g && g.id) : [];
      if (G.length) {
        const sg = c.sonegruppe || {};
        groups = G.map((g) => ({ id: g.id, navn: g.navn || 'Gruppe', list: [] }));
        const rest = { id: '_ingen', navn: 'Uten gruppe', list: [] };
        list.forEach((z) => { (groups.find((g) => g.id === sg[z.key]) || rest).list.push(z); });
        groups.push(rest);
      } else {
        const by = {};
        list.forEach((z) => { const b = z.boks || ''; (by[b] = by[b] || []).push(z); });
        const keys = Object.keys(by).sort((a, b) => (a === '') - (b === '') || a.localeCompare(b, 'nb', { numeric: true }));
        groups = keys.map((b) => ({ id: 'b' + (b || '_'), navn: b ? (/^\d+$/.test(b) ? 'Boks ' + b : b) : keys.length > 1 ? 'Uten boks' : 'Soner', list: by[b] }));
      }
      const fold = this.ui.fold || {}, std = Number(c.standard_min) || (c.varigheter && c.varigheter[1]) || 10;
      const open = this.ui.zo;
      const row = (z) => {
        const pct = z.gaar && z.total && z.left != null ? Math.min(100, ((z.total - z.left) / z.total) * 100) : 0;
        const st = z.av ? 'Deaktivert · hoppes over i programmer' : z.gaar ? `Vanner${z.left != null ? ' · ' + fmt(z.left) + ' igjen' : ''}` : z.prog ? 'I program' : 'Manuell';
        const ic = z.gaar
          ? `<span class="zi run" style="--p:${pct.toFixed(0)}"><span class="zin"><span class="wf" style="height:${Math.max(8, pct).toFixed(0)}%"></span><i class="dp"></i><i class="dp b"></i></span>${M.icon(kiVaIkon(z.metode || z.navn), 22, 'position:relative')}</span>`
          : `<span class="zi ${z.prog ? 'prog' : 'man'}">${M.icon(kiVaIkon(z.metode || z.navn), 24)}</span>`;
        const isO = open === z.key && !z.gaar && !z.av;
        const sel = Number((this.ui.zm || {})[z.key]) || std;
        const vr = (c.varigheter && c.varigheter.length ? c.varigheter : [5, 10, 15, 30]).slice(0, 5);
        return `<div class="zc ${z.av ? 'dis' : ''} ${z.gaar ? 'on' : ''}" data-key="z-${esc(z.key)}">
          <div class="zm" data-act="zexp" data-k="${esc(z.key)}" data-haptic="selection" role="button" tabindex="0" aria-expanded="${isO}">
            ${ic}
            <div class="zt"><div class="zk">${z.kode ? `<span class="kode num">${esc(z.kode)}</span>` : ''}${esc(z.navn)}</div><div class="zs ${z.gaar ? 'run' : ''} ell">${esc(st)}${!z.av && !z.gaar && z.sist ? ` · sist ${esc(relDag(z.sist))}` : ''}</div></div>
            ${z.neste && !z.av ? `<div class="zn"><span class="t num">${esc(z.neste.tid || '')}</span><span class="p ell">${esc(z.neste.prog || '')}</span></div>` : ''}
            ${z.av ? (z.kanAv ? `<button class="akt press" data-act="aktiver" data-k="${esc(z.key)}" data-haptic="success">Aktiver</button>` : '') : `<button class="zb ${z.gaar ? 'on' : ''} press" data-act="zrun" data-k="${esc(z.key)}" data-haptic="${z.gaar ? 'warning' : 'success'}" aria-label="${z.gaar ? 'Stopp' : `Start ${std} min`}">${M.icon(z.gaar ? 'mdi:stop' : 'mdi:play', 24)}</button>`}
          </div>
          ${isO ? `<div class="zx"><div class="seg" role="tablist" data-glass-drag="x">${vr.map((m) => `<button class="sg ${m === sel ? 'on' : ''}" role="tab" aria-selected="${m === sel}" ${m === sel ? 'data-active' : ''} data-act="zmin" data-k="${esc(z.key)}" data-m="${m}" data-haptic="selection">${m} min</button>`).join('')}</div>
            <button class="start press" data-act="zstart" data-k="${esc(z.key)}" data-haptic="success">${M.icon('mdi:play', 22)}Start ${sel} min${z.rate ? ` · ca ${nf(sel * z.rate)} L` : ''}</button>
            <div class="zline"><span class="ell">${esc([z.rate ? `${nf1(z.rate)} L/min` : '', z.sist ? 'sist vannet ' + relDag(z.sist) : 'ikke vannet nylig'].filter(Boolean).join(' · '))}</span>${z.kanAv ? `<button class="deakt press" data-act="deaktiver" data-k="${esc(z.key)}" data-haptic="warning">Deaktiver</button>` : ''}</div></div>` : ''}
        </div>`;
      };
      return groups.filter((g) => g.list.length).map((g) => {
        const av = g.list.filter((z) => z.av).length, f = !!fold[g.id];
        return `<div class="grp" data-key="g-${esc(g.id)}"><button class="gh" data-act="fold" data-g="${esc(g.id)}" data-haptic="selection" aria-expanded="${!f}"><span class="gn ell">${esc(g.navn)}</span><span class="gm">${g.list.length} ${g.list.length === 1 ? 'sone' : 'soner'}${av ? ` · ${av} av` : ''}</span>${M.icon('mdi:chevron-down', 20, `color:#979797;transition:transform .2s;transform:rotate(${f ? -90 : 0}deg)`)}</button>${f ? '' : g.list.map(row).join('')}</div>`;
      }).join('');
    }

    /* ---------------- Program */
    _pProg(V) {
      if (V.redig && this._nyttProgram) return this._skjema(V);
      let o = V.redig ? `<div class="sh"><span class="st">Programmer</span><button class="nyt press" data-act="nytt" data-haptic="light">${M.icon('mdi:plus', 18)}Nytt</button></div>`
        : `<div class="sh"><span class="st">${V.progKilde === 'os' ? 'Fra OpenSprinkler' : V.progKilde === 'ki' ? 'Fra KI Vanning' : 'Fra Home Assistant'}</span><span class="sm ell">${V.progKilde === 'os' ? 'endres i OpenSprinkler' : V.progKilde === 'ki' ? 'endres i KI Vanning' : 'automasjoner og skript'}</span></div>`;
      if (V.progs.length) {
        o += `<div class="col" style="gap:8px">${V.progs.map((p) => `<div class="pc ${p.pa ? '' : 'off'}" data-key="p-${esc(p.key)}" ${V.redig ? `data-act="rediger" data-n="${esc(p.navn)}" data-haptic="light" role="button" tabindex="0"` : p.bryter ? `data-ent="${esc(p.bryter)}"` : ''}>
          <div class="pt"><span class="num">${esc(p.tid)}</span>${p.naar ? `<span class="pd">${esc(p.naar)}</span>` : ''}</div>
          <div class="pm2"><div class="pn ell">${esc(p.navn)}${p.gaar ? ' · kjører' : ''}</div><div class="ps ell">${esc(p.sub || '–')}</div></div>
          ${p.bryter || V.redig ? this._tg(p.pa, 'ptog', `data-n="${esc(p.navn)}" data-b="${esc(p.bryter || '')}" aria-label="${esc(p.navn)} på"`) : ''}
        </div>`).join('')}</div>`;
      } else o += M.emptyState(V.redig ? 'Ingen programmer ennå – trykk «Nytt»' : 'Fant ingen vanningsprogrammer', 'entiteter');
      if (V.agenda && V.agenda.length) {
        o += `<div class="sh"><span class="st">Kommende vanninger</span></div><div class="card" style="padding:4px 16px;gap:0">${V.agenda.map((d, i) => `<div class="ag ${i ? 'bt' : ''}" data-key="ag-${esc(d.k)}"><div class="sp" style="padding-bottom:6px"><b class="agd">${esc(d.dag)}</b><span class="lab num">${esc(d.total)}</span></div>${d.items.map((it) => `<div class="agr"><span class="agt num">${esc(it.tid)}</span><i class="agdot"></i><span class="ell grow">${esc(it.navn)}</span><span class="lab num">${esc(it.amount)}</span></div>`).join('')}</div>`).join('')}</div>`;
      }
      // Reserve: tall/klokkeslett for vanningen (systemets velgere)
      const sets = V.m ? (V.m.e.setIds || []).filter((id) => this.s(id)) : [];
      if (sets.length) o += `<div class="sh"><span class="st">Innstillinger</span></div><div class="card stpl" data-key="innst" style="padding:0;gap:0">${sets.map((id) => M.stepperHTML(this.hass, id, { label: cap(M.name(this.hass, id, V.m.e.area ? M.areaName(this.hass, V.m.e.area) : '')), key: 'stp-' + id })).join('')}</div>`;
      return o;
    }
    // Programskjema (designets `ed`) – bare når KI Vanning styrer. Lagre/Slett = ki_vanning.lag_program / slett_program.
    _skjema(V) {
      const d = this._nyttProgram, soner = V.soner.filter((z) => z.bryter);
      const valgt = (e) => (d.soner || []).find((z) => z.entity === e);
      const tot = (d.soner || []).reduce((t, z) => t + (Number(z.min) || 0), 0);
      const L = (d.soner || []).reduce((t, z) => { const y = soner.find((x) => x.bryter === z.entity); return t + (y && y.rate ? (Number(z.min) || 0) * y.rate : 0); }, 0);
      const segB = (act, v, on, l) => `<button class="sg ${on ? 'on' : ''}" role="tab" aria-selected="${on}" ${on ? 'data-active' : ''} data-act="${act}" data-v="${v}" data-haptic="selection">${l}</button>`;
      return `<div class="card ed" data-key="ed">
        <div class="sp"><b style="font-size:17px;font-weight:600">${d._finnes ? 'Endre program' : 'Nytt program'}</b></div>
        <div class="fr2"><label class="fl">Navn<input class="fi" type="text" data-input="pnavn" value="${esc(d.navn || '')}" placeholder="Morgen"></label><label class="fl">Starter<input class="fi num" type="time" data-input="ptid" value="${esc(d.tid || '06:00')}"></label></div>
        <div class="frow"><span class="lab">Hyppighet</span><div class="seg" role="tablist" data-glass-drag="x">${segB('pmodus', 'dager', !d.intervall, 'Ukedager')}${segB('pmodus', 'intervall', !!d.intervall, 'Intervall')}</div>
          ${d.intervall ? `<div class="fr2"><label class="fl">Hver … dag<input class="fi" type="number" min="1" max="30" data-input="pint" value="${esc(d.intervall)}"></label><label class="fl">Første gang<input class="fi" type="date" data-input="pstart" value="${esc(d.start_dato || '')}"></label></div>`
            : `<div class="days">${DAGK.map((k) => `<button class="dy ${(d.dager || []).includes(k) ? 'on' : ''}" data-act="pdag" data-v="${k}" data-haptic="selection" aria-pressed="${(d.dager || []).includes(k)}">${DAGN[k]}</button>`).join('')}</div>`}</div>
        <div class="frow"><span class="lab">Sonene kjører</span><div class="seg" role="tablist" data-glass-drag="x">${segB('psam', 'etter', !d.samtidig, 'Etter hverandre')}${segB('psam', 'samtidig', !!d.samtidig, 'Samtidig')}</div></div>
        <div class="frow"><span class="lab">Soner og minutter</span><div class="zsel">${soner.map((z) => { const v = valgt(z.bryter); return `<div class="zs2" data-key="ps-${esc(z.key)}"><button class="cb ${v ? 'on' : ''}" data-act="pzone" data-e="${esc(z.bryter)}" data-haptic="selection" aria-pressed="${!!v}">${v ? M.icon('mdi:check', 18) : ''}</button><span class="ell grow">${esc(`${z.kode ? z.kode + ' ' : ''}${z.navn}`)}</span><button class="pmb press" data-act="pmin" data-e="${esc(z.bryter)}" data-d="-1" data-haptic="selection" aria-label="Færre minutter">−</button><span class="pv num">${v ? v.min : 10} min</span><button class="pmb press" data-act="pmin" data-e="${esc(z.bryter)}" data-d="1" data-haptic="selection" aria-label="Flere minutter">+</button></div>`; }).join('') || '<span class="lab">Fant ingen soner</span>'}</div></div>
        <div class="sum num">${tot} min totalt${L ? ` · ca ${nf(L)} L` : ''}</div>
        <div class="brow"><button class="bigbtn ghost press" data-act="pavbryt" data-haptic="light">Avbryt</button><button class="bigbtn pri press" data-act="plagre" data-haptic="success">Lagre</button></div>
        ${d._finnes ? `<button class="slett press" data-act="pslett" data-haptic="warning">${M.icon('mdi:delete-outline', 20)}Slett</button>` : ''}
      </div>`;
    }

    /* ---------------- Forbruk (KI Vann) */
    _seg(act, cur, opts) { return `<div class="seg top" role="tablist" data-glass-drag="x">${opts.map(([k, l]) => `<button class="sg ${k === cur ? 'on' : ''}" role="tab" aria-selected="${k === cur}" ${k === cur ? 'data-active' : ''} data-act="${act}" data-v="${k}" data-haptic="selection">${l}</button>`).join('')}</div>`; }
    _pForbruk(V) {
      const view = this.ui.fvis === 'kalender' ? 'kalender' : 'liste', v = V.vann, c = this.config, mal = Number(c.mal) || 400;
      let o = this._seg('fvis', view, [['liste', 'Liste'], ['kalender', 'Kalender']]);
      if (!v) {
        o += `<div class="card" data-key="vtom"><div class="b48 num">–<span>L</span></div><button class="nr pick2 press" data-act="customize" data-section="entiteter"><span class="nri">${M.icon('mdi:water-plus', 20)}</span><div class="sx"><b>Velg entitet</b><span>Velg KI Vann-prefiks i Tilpass</span></div>${M.icon('mdi:chevron-right', 20, 'color:#979797')}</button></div>`;
        return o + this._hagevanning(V);
      }
      if (view === 'kalender') return o + this._fKalender(V, v, mal);
      const pct = Math.round((v.totalt / mal) * 100), sum = v.deler.reduce((t, k) => t + k.liter, 0) || 1;
      o += `<div class="card" data-key="idag" data-ent="${esc(v.id)}">
        <div class="sp"><span class="lab">I dag</span><span class="chip ${pct > 100 ? 'over' : ''}">${pct} % av mål</span></div>
        <div class="b48 num">${nf(v.totalt)}<span>av ${nf(mal)} L</span></div>
        ${v.deler.length ? `<div class="band">${v.deler.map((k) => `<i style="flex:${(k.liter / sum).toFixed(4)};background:${k.farge}" title="${esc(k.navn)}"></i>`).join('')}</div>
        <div class="kl">${v.deler.map((k) => `<div class="kr" data-ent="${esc(k.ent)}"><span class="dot" style="background:${k.farge}"></span><span class="kn ell">${esc(k.navn)}</span><span class="kv num">${nf(k.liter)} L</span></div>`).join('')}</div>` : '<div class="lab">Ingen fordeling ennå i dag</div>'}
        <div class="hr"></div>
        <div class="sp foot"><span>${v.per_person != null ? `${nf(v.per_person)} L per person` : '– L per person'}</span><span class="${v.forklart != null && v.forklart < 50 ? 'warn' : ''}">${v.forklart != null ? `${nf(v.forklart)} % forklart` : '– forklart'}</span></div>
        ${v.forklart != null && v.forklart < 50 ? `<div class="warnrow">${M.icon('mdi:help-circle-outline', 20)}<span>Uforklart forbruk: under halvparten av vannet er forklart av sensorene i dag.</span></div>` : ''}
        ${v.modell || v.kr != null || v.storste ? `<div class="lab ell">${esc([v.modell ? `Modell ${v.modell}${v.timer ? ` · ${v.timer} t` : ''}` : '', v.kr != null ? `${M.nf(v.kr, 1)} kr i dag` : '', v.storste ? `mest til ${String(v.storste).toLowerCase()}` : ''].filter(Boolean).join(' · '))}</div>` : ''}
      </div>`;
      if (v.hendelser.length) {
        const kat = (x) => KI_VN_KAT.find((k) => k.id === x || k.navn.toLowerCase() === String(x || '').toLowerCase()) || KI_VN_KAT[7];
        o += `<div class="sh"><span class="st">Hvor gikk vannet</span></div><div class="card" data-key="hvor" style="padding:4px 16px;gap:0">${v.hendelser.slice(0, 12).map((h, i) => {
          const k = kat(h.kategori || h.type || h.category), t = h.tid || h.start || h.time || h.tidspunkt, L = h.liter != null ? h.liter : h.l != null ? h.l : h.volum;
          const tt = t ? (isNaN(new Date(t)) ? String(t) : M.hm(t)) : '';
          return `<div class="lr ${i ? 'bt' : ''}"><span class="agt num">${esc(tt)}</span>${M.icon(k.ikon, 18, `color:${k.farge}`)}<span class="ell grow">${esc(h.navn || h.name || k.navn)}</span><span class="num">${L != null ? esc(nf(L)) + ' L' : ''}</span></div>`;
        }).join('')}</div>`;
      }
      return o + this._hagevanning(V);
    }
    // Hagevanningen per sone i dag (KI Vanning: ki.soner, som _panelForbruk)
    _hagevanning(V) {
      const ki = V.ki;
      if (!ki || !Array.isArray(ki.soner) || !ki.soner.length || !V.harFlyt) return '';
      const soner = ki.soner.slice().sort((a, b) => (Number(b.i_dag) || 0) - (Number(a.i_dag) || 0)), maks = Math.max(1, ...soner.map((x) => Number(x.i_dag) || 0));
      return `<div class="sh"><span class="st">Hagevanning i dag</span><span class="sm num">${esc(this._litertekst(ki.i_dag || 0))}${ki.kostnad_i_dag ? ' · ' + esc(M.nf(ki.kostnad_i_dag, 2)) + ' kr' : ''}</span></div>
        <div class="card" data-key="hage" style="padding:4px 16px;gap:0">${soner.map((x, i) => `<div class="lr col ${i ? 'bt' : ''}" style="align-items:stretch;gap:6px"><div class="sp"><span class="ell">${esc(x.navn)}${x.kalibrert ? '' : ' <span class="lab">anslag</span>'}</span><span class="num">${esc(this._litertekst(x.i_dag || 0))}</span></div><div class="zbar"><i style="width:${(((Number(x.i_dag) || 0) / maks) * 100).toFixed(1)}%"></i></div></div>`).join('')}</div>`;
    }
    _mndHode(act, y, mo) {
      const f1 = new Date(y, mo, 1);
      return `<div class="mh"><button class="nb press" data-act="${act}" data-d="-1" data-haptic="selection" aria-label="Forrige måned">${M.icon('mdi:chevron-left', 22)}</button><b>${esc(cap(f1.toLocaleDateString('nb-NO', { month: 'long', year: 'numeric' })))}</b><button class="nb press" data-act="${act}" data-d="1" data-haptic="selection" aria-label="Neste måned">${M.icon('mdi:chevron-right', 22)}</button></div><div class="calg">${['M', 'T', 'O', 'T', 'F', 'L', 'S'].map((w) => `<div class="wd">${w}</div>`).join('')}`;
    }
    _fKalender(V, v, mal) {
      const now = new Date(), [y, mo] = this.ui.fmnd || [now.getFullYear(), now.getMonth()];
      const map = this._vannStat(v, y, mo) || {}, today = dkey(Date.now());
      const dayVal = (k) => (k === today ? v.totalt : map[k] ? map[k][v.id] : null);
      const off = (new Date(y, mo, 1).getDay() + 6) % 7, sel = this.ui.fdag || today;
      const cells = Array.from({ length: 42 }, (_, i) => {
        const d = new Date(y, mo, 1 - off + i), k = dkey(d.getTime()), val = dayVal(k), inM = d.getMonth() === mo;
        const bg = val != null && val > 0 ? (val <= mal ? M.alpha(C.green, 0.24) : M.alpha(C.orange, 0.3)) : 'transparent';
        return `<button class="cc ${inM ? '' : 'ut'} ${k === sel ? 'sel' : ''} ${k === today ? 'td' : ''}" data-act="fdag" data-k="${k}" data-haptic="selection" style="background:${bg}"><span class="cn num">${d.getDate()}</span><span class="cl num">${val != null && val > 0 ? nf(val) : ''}</span></button>`;
      }).join('');
      const sv = dayVal(sel), sd = new Date(sel + 'T12:00:00');
      const rows = v.alle.map((k) => ({ ...k, l: sel === today ? k.liter : map[sel] ? map[sel][k.ent] || 0 : 0 })).filter((k) => k.l > 0.05).sort((a, b) => b.l - a.l);
      return `<div class="card cal" data-key="fcal">${this._mndHode('fmnd', y, mo)}${cells}</div>
        <div class="row lg"><span><i style="background:${M.alpha(C.green, 0.5)}"></i>Under mål</span><span><i style="background:${M.alpha(C.orange, 0.55)}"></i>Over mål (${nf(mal)} L)</span></div>
        <div class="hr"></div><div class="sp"><b>${esc(cap(sd.toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' })))}</b><span class="lab num">${sv != null ? esc(nf(sv)) + ' L' : '–'}</span></div>
        ${rows.map((k) => `<div class="kr"><span class="dot" style="background:${k.farge}"></span><span class="kn ell">${esc(k.navn)}</span><span class="kv num">${nf(k.l)} L</span></div>`).join('') || `<div class="lab">${Object.keys(map).length || sel === today ? 'Ingen fordeling den dagen' : 'Henter statistikk …'}</div>`}</div>`;
    }

    /* ---------------- Historikk (vanning) */
    _pHist(V) {
      const view = this.ui.hvis === 'kalender' ? 'kalender' : 'liste';
      let o = this._seg('hvis', view, [['liste', 'Liste'], ['kalender', 'Kalender']]);
      // data per døgn: KI Vanning-statistikk eller reserve (vannmåler/kjøretid)
      let perDag = null, feil = null, laster = false;
      if (V.kiMode) {
        const h = this._histData;
        if (!h) { laster = true; if (this.isOpen && !this._henterHist) this._load(true); }
        else { feil = h.feil; perDag = {}; (h.rader || []).forEach((r) => { perDag[dkey(r.dato.getTime())] = (perDag[dkey(r.dato.getTime())] || 0) + r.liter; }); }
      } else if (V.m) { perDag = {}; for (let i = 0; i < 62; i++) { const k = dkey(Date.now() - i * DAY), u = V.m.dayUsed(k); if (u != null) perDag[k] = u; } }
      const unit = V.kiMode ? 'L' : V.m && V.m.unitL ? 'L' : 'min';
      if (view === 'kalender') return o + this._hKalender(V, perDag, unit);
      // Sist vannet
      const rader = [];
      if (V.kiMode) {
        V.soner.filter((z) => z.sist).sort((a, b) => b.sist - a.sist).slice(0, 6).forEach((z) => rader.push({ t: z.sist, navn: `${z.kode ? z.kode + ' ' : ''}${(this.config.sonenavn || {})[z.key] || z.navn}`, typ: z.prog ? 'Program' : 'Manuell', amount: '' }));
        if (!rader.length) ((V.ki && V.ki.program_historikk) || []).filter((x) => x.siste_liter || x.kjoringer).forEach((x) => rader.push({ t: null, navn: x.navn, typ: `Program${x.siste_minutter ? ' · ' + Math.round(x.siste_minutter) + ' min' : ''}`, amount: this._litertekst(x.siste_liter || 0) }));
      } else if (V.m) {
        const D = V.m.D;
        Object.keys(D.run || {}).sort().reverse().slice(0, 14).forEach((k) => Object.keys(D.run[k]).forEach((hid) => { const z = V.m.all.find((x) => x.hid === hid); if (!z || rader.length >= 6) return; const min = D.run[k][hid] / 60; rader.push({ t: new Date(k + 'T12:00:00').getTime(), dagOnly: true, navn: `${z.code ? z.code + ' ' : ''}${z.name}`, typ: V.m.plan[k] && V.m.plan[k].some((it) => it.z && it.z.id === z.id) ? 'Program' : 'Manuell', amount: V.m.flowCfg ? `${nf(min * V.m.flowCfg)} L` : `${nf(min)} min` }); }));
      }
      o += `<div class="sh"><span class="st">Sist vannet</span>${V.sist ? `<span class="sm">${V.sist.tekst}</span>` : ''}</div><div class="card" data-key="sist" style="padding:4px 16px;gap:0">${rader.length ? rader.map((r, i) => `<div class="lr ${i ? 'bt' : ''}"><div class="col" style="width:64px;flex:none;gap:1px"><span class="agd">${esc(r.t ? (r.dagOnly ? cap(dayName(dkey(r.t))) : cap(relDag(r.t).split(' ').slice(0, -1).join(' '))) : '–')}</span><span class="lab num">${esc(r.t && !r.dagOnly ? M.hm(r.t) : '')}</span></div><div class="col grow" style="gap:1px;min-width:0"><span class="ell">${esc(r.navn)}</span><span class="lab">${esc(r.typ)}</span></div><span class="num">${esc(r.amount || '')}</span></div>`).join('') : `<div class="lr"><span class="lab">${laster ? 'Henter historikk …' : 'Ingen kjøringer registrert ennå'}</span></div>`}</div>`;
      // Siste 14 dager
      const h14 = Array.from({ length: 14 }, (_, i) => { const k = dkey(Date.now() - (13 - i) * DAY); return { k, v: perDag ? perDag[k] || 0 : 0 }; });
      const hmax = Math.max(1, ...h14.map((x) => x.v)), hsum = h14.reduce((t, x) => t + x.v, 0), dg = h14.filter((x) => x.v > 0.5);
      const snitt = dg.length ? hsum / dg.length : 0;
      const pris = V.ki ? Number(V.ki.pris_m3 || 0) : Number(this.config.water_price) || 0;
      o += `<div class="card" data-key="h14" style="gap:14px">
        <div class="nh"><div class="col" style="gap:4px"><span class="lab">Siste 14 dager</span><div class="b34 num">${perDag ? nf(hsum) : '–'}<span> ${unit}</span></div></div><div class="col" style="gap:4px;align-items:flex-end"><span class="num" style="font-size:15px;font-weight:500">${pris && unit === 'L' && perDag ? `${(hsum / 1000 * pris).toFixed(2).replace('.', ',')} kr` : '–'}</span><span class="lab">${dg.length} av 14 døgn med vanning</span></div></div>
        ${feil ? `<div class="lab">Fikk ikke hentet statistikken: ${esc(feil)}</div>` : ''}
        <div class="h14">${snitt ? `<div class="mline" style="bottom:${((snitt / hmax) * 100).toFixed(1)}%"><span>snitt ${nf(snitt)} ${unit}</span></div>` : ''}${h14.map((x, i) => `<div class="b" title="${esc(x.k + ': ' + nf(x.v) + ' ' + unit)}" style="height:${x.v > 0.5 ? Math.max(6, (x.v / hmax) * 100).toFixed(1) + '%' : '4px'};background:${x.v > 0.5 ? C.blue : i === 13 ? C.inner : '#282828'}"></div>`).join('')}</div>
        <div class="sp lab"><span>${esc(dShort(h14[0].k))}</span><span>I dag</span></div>
      </div>`;
      return o;
    }
    // Kalender: målte dager fylles i blått etter mengde (3 trinn), planlagte får prikk. Trykk viser program + soner + liter.
    _hKalender(V, perDag, unit) {
      const now = new Date(), [y, mo] = this.ui.hmnd || [now.getFullYear(), now.getMonth()];
      let plan = {};
      if (V.kiMode) {
        this._mnd = (y - now.getFullYear()) * 12 + (mo - now.getMonth());
        this._valgtDag = null;
        const K = this._manedskalender();
        K.ruter.forEach((r) => { if (r.plan) plan[dkey(r.dag.getTime())] = r.plan.map((p) => ({ tid: p.tid || '', navn: p.navn, soner: (p.soner || []).map((z) => z.navn || z.entity).filter(Boolean) })); });
      } else if (V.m) {
        Object.keys(V.m.plan).forEach((k) => { plan[k] = V.m.plan[k].map((it) => ({ tid: M.hm(it.t), navn: it.name, soner: [], min: it.min })); });
      }
      const vals = Object.values(perDag || {}).filter((v) => v > 0.5), mx = Math.max(1, ...vals);
      const lvl = (v) => (v <= mx / 3 ? 0.3 : v <= (2 * mx) / 3 ? 0.55 : 0.85);
      const off = (new Date(y, mo, 1).getDay() + 6) % 7, today = dkey(Date.now()), sel = this.ui.hdag || today;
      const cells = Array.from({ length: 42 }, (_, i) => {
        const d = new Date(y, mo, 1 - off + i), k = dkey(d.getTime()), v = perDag ? perDag[k] || 0 : 0, p = plan[k], inM = d.getMonth() === mo;
        return `<button class="cc ${inM ? '' : 'ut'} ${k === sel ? 'sel' : ''} ${k === today ? 'td' : ''}" data-act="hdag" data-k="${k}" data-haptic="selection" style="background:${v > 0.5 ? M.alpha(C.blue, lvl(v)) : 'transparent'}"><span class="cn num">${d.getDate()}</span><span class="cdot" style="opacity:${p && !(v > 0.5) ? 1 : 0}"></span></button>`;
      }).join('');
      const sv = perDag ? perDag[sel] || 0 : 0, sp = plan[sel] || [], sd = new Date(sel + 'T12:00:00');
      return `<div class="card cal" data-key="hcal">${this._mndHode('hmnd', y, mo)}${cells}</div>
        <div class="row lg"><span><i style="background:${M.alpha(C.blue, 0.85)}"></i>Vannet</span><span><i class="pl"></i>Planlagt</span></div>
        <div class="hr"></div><div class="sp"><b>${esc(cap(sd.toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' })))}</b><span class="lab num">${sv > 0.5 ? esc(`${nf(sv)} ${unit} vannet`) : sp.length ? 'Planlagt' : 'Ingen vanning'}</span></div>
        ${sp.map((p) => `<div class="agr"><span class="agt num">${esc(p.tid)}</span><i class="agdot"></i><span class="ell grow">${esc(p.navn)}${p.soner.length ? ` · ${esc(p.soner.join(', '))}` : ''}</span><span class="lab num">${p.min ? esc(nf(p.min) + ' min') : ''}</span></div>`).join('')}</div>`;
    }

    /* ---------------------------------------------------------- handlinger */
    _sone(key) { const V = this.__V || this._vm(); return V.soner.find((z) => z.key === key) || null; }
    async _run(z, min) {
      const V = this.__V;
      if (!V.klar && !V.kiMode) return this._toast('Anlegget er av');
      if (V.kiMode) { await this._kjor(z.src, min); return this._toast(`${z.navn} startet · ${min} min`); }
      await M.vanRun(this.hass, z.src, min);
      return this._toast(`${z.navn} startet · ${min} min`);
    }
    async _stop(z) {
      const V = this.__V;
      if (V.kiMode) await this._stopp(z ? z.bryter : undefined);
      else if (z) await M.vanStop(this.hass, z.src);
      else { const m = V.m; if (m.e.os_controller && m.all.some((x) => x.os)) await M.call(this.hass, 'opensprinkler', 'stop', { entity_id: m.e.os_controller }); await Promise.all(m.all.filter((x) => x.running && !x.os).map((x) => M.vanStop(this.hass, x))); }
      return this._toast(z ? `${z.navn} stoppet` : 'All vanning stoppet');
    }
    onInput(name, el) {
      const d = this._nyttProgram; if (!d) return;
      if (name === 'pnavn') d.navn = el.value;
      else if (name === 'ptid') d.tid = el.value;
      else if (name === 'pint') d.intervall = Math.max(1, Number(el.value) || 1);
      else if (name === 'pstart') d.start_dato = el.value;
    }
    async onAction(name, el, ev) {
      const d = el.dataset, h = this.hass, V = this.__V || this._vm(), c = this.config;
      const ui = (p) => this.setUI(p);
      switch (name) {
        case 'tab': return ui({ tab: d.t });
        case 'fold': return ui({ fold: { ...(this.ui.fold || {}), [d.g]: !(this.ui.fold || {})[d.g] } });
        case 'zexp': return ui({ zo: this.ui.zo === d.k ? null : d.k });
        case 'zmin': return ui({ zm: { ...(this.ui.zm || {}), [d.k]: Number(d.m) } });
        case 'zstart': { const z = this._sone(d.k); if (!z) return; const min = Number((this.ui.zm || {})[d.k]) || Number(c.standard_min) || (c.varigheter && c.varigheter[1]) || 10; ui({ zo: null }); return this._run(z, min); }
        case 'zrun': { const z = this._sone(d.k); if (!z) return; if (z.gaar) return this._stop(z); return this._run(z, Number(c.standard_min) || (c.varigheter && c.varigheter[1]) || 10); }
        case 'aktiver': case 'deaktiver': { const z = this._sone(d.k); if (!z || !z.bryter) return; await M.call(h, 'homeassistant', 'toggle', { entity_id: z.bryter }); ui({ zo: null }); return this._toast(`${z.navn} ${name === 'aktiver' ? 'aktivert' : 'deaktivert'}`); }
        case 'stopp': return this._stop(d.k ? this._sone(d.k) : null);
        case 'scene': return V.aktiv ? this._stop(V.aktiv) : null;
        case 'kjorneste': {
          const n = V.neste;
          if (V.kiMode) {
            if (n && n.kjor && n.kjor.prog) { await this._ki_tjeneste('kjor_program', { program: n.kjor.prog }); return this._toast(`${n.kjor.prog} startet`); }
            const p = V.progs.find((x) => x.pa && x.bryter);
            if (p) { await M.call(h, 'opensprinkler', 'run', { entity_id: p.bryter }); return this._toast(`${p.navn} startet`); }
            return this._toast('Ingen planlagt vanning');
          }
          const m = V.m, nx = m.upcoming[m.skipOn ? 1 : 0];
          if (!m.sysOn) return this._toast('Anlegget er av');
          if (nx) {
            const zs = nx.items.filter((it) => it.z);
            if (!zs.length) return this._toast('Fant ingen soner i planen');
            const os = zs.filter((it) => it.z.os);
            for (const it of os) await M.vanRun(h, it.z, it.min);
            if (!os.length) await M.vanRun(h, zs[0].z, zs[0].min);
            return this._toast(os.length ? `${os.length} soner startet` : `${zs[0].name} startet`);
          }
          if (!m.zones.length) return this.customize('entiteter');
          const os = m.zones.filter((z) => z.os);
          for (const z of os) await M.vanRun(h, z);
          if (!os.length) await M.vanRun(h, m.zones[0]);
          return this._toast(os.length ? `${os.length} soner startet` : `${m.zones[0].name} startet`);
        }
        case 'hopp': {
          if (V.kiMode) { if (V.neste && V.neste.prog) { await this._ki_tjeneste('hopp_over', { program: V.neste.prog }); return this._toast('Neste vanning hoppes over'); } return; }
          if (!V.m.e.skip) return this.customize('entiteter');
          await M.toggle(h, V.m.e.skip);
          return this._toast(V.m.skipOn ? 'Neste vanning gjenopprettet' : 'Neste vanning hoppes over');
        }
        case 'anlegg': {
          if (V.kiMode) { await this._veksleAnlegg(); return this._toast(V.anleggPa ? `${V.anleggNavn} av` : `${V.anleggNavn} på`); }
          if (!V.m.e.system) return this.customize('entiteter');
          await M.toggle(h, V.m.e.system);
          return this._toast(V.anleggPa ? 'Anlegget er slått av' : 'Anlegget er slått på');
        }
        case 'regn': {
          const hrs = Number(c.rain_hours) || 24;
          if (V.kiMode) { await this._regn(V.regnPa ? 0 : hrs); return this._toast(V.regnPa ? 'Regnpause av' : `Regnpause ${hrs} t`); }
          const m = V.m;
          if (!m.e.rain) return this.customize('entiteter');
          if (m.e.rain.startsWith('binary_sensor.') && m.e.os_controller) await M.call(h, 'opensprinkler', 'set_rain_delay', { entity_id: m.e.os_controller, rain_delay: m.rainOn ? 0 : hrs });
          else await M.toggle(h, m.e.rain);
          return this._toast(m.rainOn ? 'Regnpause av' : `Regnpause ${hrs} t`);
        }
        case 'hv': return this._ki_tjeneste('apne_hovedventil', {});
        case 'dag7': return ui({ dag: Number(d.i) });
        // programmer
        case 'nytt': { const forste = V.soner.find((z) => z.bryter); this._nyttProgram = { navn: '', tid: '06:00', dager: ['man', 'tor'], intervall: 0, samtidig: false, soner: forste ? [{ entity: forste.bryter, min: 10 }] : [] }; return this.update(); }
        case 'rediger': {
          const ki = this._ki(), navn = d.n;
          const pl = ((ki && ki.program_historikk) || []).find((x) => x.navn === navn) || { navn };
          this._nyttProgram = { ...pl, _finnes: true, _opprinnelig: navn, soner: (pl.soner || []).map((z) => ({ entity: z.entity, min: z.min })) };
          return this.update();
        }
        case 'ptog': {
          ev && ev.stopPropagation && ev.stopPropagation();
          if (d.b) { const p = V.progs.find((x) => x.bryter === d.b); await M.toggle(h, d.b); return this._toast(`${p ? p.navn : 'Program'} ${p && p.pa ? 'av' : 'på'}`); }
          const navn = d.n, ki = this._ki();
          const o = ((ki && ki.program_historikk) || []).find((x) => x.navn === navn) || {};
          const ny = o.aktiv === false;
          this._venter = this._venter || {};
          this._venter[navn] = { aktiv: ny, til: Date.now() + 20000 };
          this.update();
          return this._ki_tjeneste('lag_program', { ...o, navn, aktiv: ny });
        }
        case 'pmodus': { const p = this._nyttProgram; if (!p) return; p.intervall = d.v === 'intervall' ? (p.intervall || 2) : 0; if (!p.intervall && !(p.dager || []).length) p.dager = ['man', 'tor']; return this.update(); }
        case 'pdag': { const p = this._nyttProgram; if (!p) return; p.dager = p.dager || []; p.dager = p.dager.includes(d.v) ? p.dager.filter((x) => x !== d.v) : [...p.dager, d.v]; return this.update(); }
        case 'psam': { const p = this._nyttProgram; if (!p) return; p.samtidig = d.v === 'samtidig'; return this.update(); }
        case 'pzone': { const p = this._nyttProgram; if (!p) return; const l = p.soner || []; p.soner = l.some((z) => z.entity === d.e) ? l.filter((z) => z.entity !== d.e) : [...l, { entity: d.e, min: 10 }]; return this.update(); }
        case 'pmin': { const p = this._nyttProgram; if (!p) return; const l = p.soner || []; let z = l.find((x) => x.entity === d.e); if (!z) { z = { entity: d.e, min: 10 }; l.push(z); p.soner = l; } z.min = M.clamp((Number(z.min) || 10) + Number(d.d), 1, 180); return this.update(); }
        case 'pavbryt': this._nyttProgram = null; return this.update();
        case 'pslett': { const p = this._nyttProgram; if (!p) return; await this._ki_tjeneste('slett_program', { navn: p._opprinnelig || p.navn }); this._nyttProgram = null; this.update(); return this._toast('Programmet er slettet'); }
        case 'plagre': {
          const p = this._nyttProgram; if (!p) return;
          const R = this.shadowRoot, nf2 = R.querySelector('[data-input="pnavn"]'), tf = R.querySelector('[data-input="ptid"]');
          await this._ki_tjeneste('lag_program', {
            navn: (nf2 && nf2.value) || p.navn || 'Nytt program', tid: (tf && tf.value) || p.tid || '06:00',
            dager: p.intervall ? [] : (p.dager || []), intervall: p.intervall || 0, start_dato: p.start_dato || '',
            soner: p.soner || [], samtidig: !!p.samtidig, aktiv: p.aktiv !== false,
          });
          this._nyttProgram = null; this.update();
          return this._toast('Programmet er lagret');
        }
        // forbruk / historikk
        case 'fvis': return ui({ fvis: d.v });
        case 'hvis': return ui({ hvis: d.v });
        case 'fdag': return ui({ fdag: d.k });
        case 'hdag': return ui({ hdag: d.k });
        case 'fmnd': case 'hmnd': {
          const now = new Date(), key = name, [y, mo] = this.ui[key] || [now.getFullYear(), now.getMonth()];
          const n = new Date(y, mo + Number(d.d), 1);
          return ui({ [key]: [n.getFullYear(), n.getMonth()] });
        }
        default: return super.onAction(name, el, ev);
      }
    }
    afterRender() {
      const running = !!(this.__V && this.__V.aktiv);
      if (running && this.isOpen && !this._tick) this._tick = setInterval(() => this.update(), 1000);
      if ((!running || !this.isOpen) && this._tick) { clearInterval(this._tick); this._tick = null; }
      if (this.isOpen && !this._last) this._load();
    }
    get styles() {
      const PINK = C.accent, INK = '#2a1720';
      return (M.STEPPER_CSS || '') + `
        .wrap{display:flex;flex-direction:column;gap:var(--msh-gap,8px)}
        .body{display:flex;flex-direction:column;gap:var(--msh-gap,8px);min-width:0}
        .num{font-variant-numeric:tabular-nums}
        .grow{flex:1;min-width:0}
        .ell{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
        .col{display:flex;flex-direction:column}
        .row{display:flex;align-items:center}
        .bt{border-top:1px solid rgba(255,255,255,0.06)}
        .lab{font-size:12px;color:#979797}
        .lab.blue{color:${C.blue}}
        .sp{display:flex;justify-content:space-between;align-items:center;gap:12px;min-width:0}
        .hr{height:1px;background:rgba(255,255,255,0.08);flex:none}
        /* ---- toppkort: hagescenen (kiVaScene, 184 px / r28) ---- */
        .scene{position:relative;height:184px;border-radius:28px;overflow:hidden;isolation:isolate;color:#eaf6ff;flex:none;background:linear-gradient(180deg,#1d2b3a 0%,#22415a 52%,#1d3a33 100%);transition:background .8s cubic-bezier(.2,.8,.2,1);box-shadow:${C.edge}}
        .scene.vanner{background:linear-gradient(180deg,#1b3550 0%,#1e5a7a 50%,#1c4a3c 100%);cursor:pointer}
        .scene.vinter{background:linear-gradient(180deg,#28303c 0%,#3b4655 55%,#5b6572 100%)}
        .scene.regn{background:linear-gradient(180deg,#1c232b 0%,#27333e 55%,#1f322e 100%)}
        .scene svg{position:absolute;inset:0;width:100%;height:100%;transition:filter .8s}
        .scene.regn svg{filter:brightness(.62) saturate(.75)}
        .scene .tekst{position:absolute;left:18px;right:72px;top:16px;z-index:3;pointer-events:none;display:flex;flex-direction:column;gap:3px}
        .scene .tittel{font-size:19px;font-weight:600;letter-spacing:-0.01em;text-shadow:0 1px 10px rgba(0,0,0,.45)}
        .scene .under{font-size:13px;color:#e1e1e1;text-shadow:0 1px 8px rgba(0,0,0,.45)}
        .scene .bunn{position:absolute;left:18px;right:18px;bottom:14px;z-index:3;display:flex;align-items:center;gap:12px}
        .scene .bunn .sp{display:block;flex:1;height:4px;border-radius:2px;background:rgba(255,255,255,.22);overflow:hidden}
        .scene .bunn .sp i{display:block;height:100%;background:#fff;opacity:.9;transition:width 1s linear}
        .scene .bunn .tall{font-size:12px;white-space:nowrap;text-shadow:0 1px 6px rgba(0,0,0,.4)}
        .demo{position:absolute;right:18px;bottom:34px;z-index:4;font-size:10px;font-weight:700;letter-spacing:.06em;padding:3px 8px;border-radius:6px;background:rgba(255,255,255,.2)}
        .cog{position:absolute;right:14px;top:14px;z-index:5;width:44px;height:44px;border-radius:22px;background:rgba(0,0,0,.35);display:grid;place-items:center;color:#fafafa}
        .sol{animation:va-sol 9s ease-in-out infinite alternate;transform-box:fill-box;transform-origin:center}
        @keyframes va-sol{from{transform:translateY(0)}to{transform:translateY(-6px)}}
        .scene.regn .sol,.scene.regn .sky2{opacity:0}
        .sky2{animation:va-sky 34s linear infinite alternate;transform-box:fill-box}
        .sky2.b{animation-duration:48s;animation-delay:-12s}
        @keyframes va-sky{from{transform:translateX(-6%)}to{transform:translateX(16%)}}
        .straa{transform-box:fill-box;transform-origin:50% 100%;animation:va-straa 3.4s ease-in-out infinite alternate}
        .scene.vanner .straa{animation-duration:2.1s}
        @keyframes va-straa{from{transform:rotate(-6deg)}to{transform:rotate(6deg)}}
        .spreder{transform-box:fill-box;transform-origin:50% 100%}
        .scene.vanner .spreder{animation:va-vipp 3.2s ease-in-out infinite alternate}
        @keyframes va-vipp{from{transform:rotate(-13deg)}to{transform:rotate(13deg)}}
        .stralegruppe{opacity:0;transform-box:view-box}
        .scene.vanner .stralegruppe{opacity:1;animation:va-sving 3.2s ease-in-out infinite alternate}
        @keyframes va-sving{from{transform:rotate(-13deg)}to{transform:rotate(13deg)}}
        .straale{opacity:.85}
        .sdrape{opacity:0;transform-box:view-box}
        .scene.vanner .sdrape{animation:va-sprut 1.4s ease-out infinite}
        @keyframes va-sprut{0%{opacity:0;transform:translate(0,0) scale(.45)}12%{opacity:.95}45%{transform:translate(calc(var(--dx,40px) * .55),calc(var(--dy,22px) * -1)) scale(.9)}100%{opacity:0;transform:translate(var(--dx,40px),calc(var(--dy,22px) * .9)) scale(.8)}}
        .vaatt{opacity:0;transition:opacity 1.4s ease}.scene.vanner .vaatt,.scene.regn .vaatt{opacity:.5}
        .snofnugg{opacity:0}.scene.vinter .snofnugg{animation:va-sno linear infinite}
        @keyframes va-sno{0%{opacity:0;transform:translateY(-10px)}15%{opacity:.9}100%{opacity:.2;transform:translate(10px,200px)}}
        .blomst{transform-box:fill-box;transform-origin:50% 100%;animation:va-straa 4.6s ease-in-out infinite alternate}
        .scene.vinter .blomst,.scene.vinter .straa{animation:none;opacity:.6}
        /* regnpause: 3 grå skyer som driver + skrå regndråper (designets scene.clouds / scene.rain) */
        .skyer{position:absolute;inset:0;z-index:2;pointer-events:none;opacity:0;transition:opacity .8s}
        .scene.regn .skyer{opacity:1}
        .sky{position:absolute;width:84px;height:24px;border-radius:12px;background:#7d8894;opacity:.9;transform:scale(var(--s));animation:va-drift 26s ease-in-out infinite alternate}
        .sky::before{content:'';position:absolute;left:14px;top:-15px;width:40px;height:34px;border-radius:50%;background:inherit}
        .sky::after{content:'';position:absolute;left:40px;top:-9px;width:30px;height:26px;border-radius:50%;background:inherit}
        @keyframes va-drift{from{transform:translateX(-14px) scale(var(--s))}to{transform:translateX(28px) scale(var(--s))}}
        .rd{position:absolute;top:44px;width:1.6px;height:12px;border-radius:1px;background:#9fd4ff;opacity:0}
        .scene.regn .rd{animation:va-rainfall linear infinite}
        @keyframes va-rainfall{0%{opacity:0;transform:translate(0,0) rotate(18deg)}15%{opacity:.85}100%{opacity:0;transform:translate(-44px,150px) rotate(18deg)}}
        /* ---- toppkort: vann (KI Vann) ---- */
        .vhero{position:relative;height:184px;border-radius:28px;overflow:hidden;background:${C.card};box-shadow:${C.edge};isolation:isolate;flex:none}
        .vfill{position:absolute;left:0;right:0;bottom:0;height:var(--fyll,4%);background:linear-gradient(180deg,rgba(115,185,242,.4),rgba(115,185,242,.18));transition:height 1.2s cubic-bezier(.2,.8,.2,1);z-index:0}
        .wave{position:absolute;left:0;width:200%;height:18px;bottom:calc(var(--fyll,4%) - 1px);z-index:0;display:flex;animation:vn-rull 9s linear infinite;pointer-events:none}
        .wave svg{width:50%;height:100%;display:block;flex:none}
        .wave.b2{animation-duration:14s;animation-direction:reverse;opacity:.55;bottom:calc(var(--fyll,4%) + 3px)}
        @keyframes vn-rull{from{transform:translateX(0)}to{transform:translateX(-50%)}}
        .vt{position:absolute;left:18px;right:72px;top:16px;z-index:2;display:flex;flex-direction:column;gap:2px;align-items:flex-start}
        .vl{font-size:13px;color:#afafaf}
        .vv{font-size:44px;font-weight:300;letter-spacing:-0.03em;line-height:1.05}
        .vv span{font-size:18px;color:#afafaf;margin-left:4px;letter-spacing:0}
        .vs{font-size:13px;color:#e1e1e1}
        .vs.pick{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 12px 0 8px;border-radius:15px;background:rgba(0,0,0,.28);margin-top:4px}
        .vb{position:absolute;left:14px;right:14px;bottom:12px;z-index:2;display:flex;align-items:center;gap:8px}
        .vch{display:flex;gap:6px;flex:1;min-width:0;overflow:hidden}
        .vc{height:30px;padding:0 10px 0 8px;border-radius:15px;background:rgba(0,0,0,.3);display:inline-flex;align-items:center;gap:5px;font-size:12px;white-space:nowrap;flex:none}
        .vm{font-size:11px;color:#e1e1e1;white-space:nowrap;flex:none}
        /* ---- faner (Liquid Glass-pille) ---- */
        .tbox{padding:4px;border-radius:30px;background:${C.card};box-shadow:${C.edge},0 8px 20px rgba(0,0,0,.3);position:sticky;top:8px;z-index:6}
        .tabs{display:flex;gap:2px;position:relative;border-radius:26px}
        .tab{flex:1 1 0;min-width:0;height:56px;padding:0 4px;border-radius:26px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;color:#979797;font-size:11px;font-weight:500;transition:background .25s,color .25s}
        .tab .tl{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .tab.on{background:${PINK};color:${INK};font-weight:600}
        .tabs.v-tekst .tab{height:44px;font-size:13px}
        .tabs.v-ikoner .tab{height:48px}
        /* ---- kort ---- */
        .card{position:relative;overflow:hidden;background:${C.card};box-shadow:${C.edge};border-radius:24px;padding:18px;display:flex;flex-direction:column;gap:14px;min-width:0}
        .card.run{box-shadow:inset 0 0 0 1px ${M.alpha(C.blue, 0.45)}}
        .card.warnc{box-shadow:inset 0 0 0 1px ${M.alpha(C.orange, 0.45)};padding:14px 16px}
        .rf{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(90deg,${M.alpha(C.blue, 0.05)},${M.alpha(C.blue, 0.18)});transition:width 1s linear;pointer-events:none}
        .nh{position:relative;display:flex;align-items:flex-end;justify-content:space-between;gap:12px}
        .nwhen{font-size:15px;font-weight:500}
        .big{font-size:52px;font-weight:300;letter-spacing:-0.04em;line-height:.9;white-space:nowrap}
        .nr{position:relative;display:flex;align-items:center;gap:12px;min-width:0;width:100%;text-align:left}
        .nri{width:40px;height:40px;border-radius:20px;display:grid;place-items:center;background:${M.alpha(C.blue, 0.16)};color:${C.blue};flex:none}
        .nri.or{background:${M.alpha(C.orange, 0.18)};color:${C.orange}}
        .sx{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
        .sx b{font-size:14px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .sx span{font-size:12px;color:#979797;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .amt{font-size:12px;color:#979797;white-space:nowrap;flex:none}
        .brow{position:relative;display:flex;gap:8px}
        .bigbtn{flex:1;min-width:0;height:52px;border-radius:26px;background:${C.inner};display:flex;align-items:center;justify-content:center;gap:8px;font-size:15px;font-weight:500;white-space:nowrap}
        .bigbtn.ghost{background:transparent;box-shadow:inset 0 0 0 1px rgba(255,255,255,.12);color:#afafaf}
        .bigbtn.stop{background:${C.blue};color:#141416;font-weight:600}
        .bigbtn.pri{background:${PINK};color:${INK};font-weight:600}
        .mini{height:36px;padding:0 14px;border-radius:18px;background:${C.inner};font-size:13px;font-weight:600;flex:none}
        .pick2{padding:4px 0}
        .d7t{font-size:14px;font-weight:500}
        .d7s{font-size:12px;color:#979797;max-width:100%}
        .wk{display:grid;grid-template-columns:repeat(7,1fr);gap:6px;align-items:end}
        .wkc{display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:6px;height:96px;min-width:0;padding:0}
        .wkb{width:100%;max-width:34px;border-radius:8px;background:${M.alpha(C.blue, 0.45)};transition:height .3s,background .2s}
        .wkb.tom{background:#282828}
        .wkb.sel{background:${C.blue}}
        .wkb.tom.sel{background:${C.inner}}
        .wkl{font-size:11px;color:#7f7f7f;white-space:nowrap}
        .wkl.sel{color:#fafafa;font-weight:600}
        .srow{display:flex;align-items:center;gap:12px;min-height:64px}
        .si{width:40px;height:40px;border-radius:20px;display:grid;place-items:center;background:${C.inner};flex:none}
        .sx b{font-size:15px}
        .tg{position:relative;width:44px;height:26px;border-radius:13px;background:${C.ctrl};flex:none;transition:background .2s}
        .tg i{position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:10px;background:#fafafa;box-shadow:0 1px 3px rgba(0,0,0,.3);transition:left .2s}
        .tg.on{background:${C.pink}}
        .tg.on i{left:21px}
        .g2{display:grid;grid-template-columns:1fr 1fr;gap:8px}
        .tile{background:${C.card};box-shadow:${C.edge};border-radius:20px;padding:14px 16px;display:flex;flex-direction:column;gap:4px;min-width:0}
        .th{display:flex;align-items:center;gap:6px;font-size:12px;color:#979797}
        .tv{font-size:16px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .tv small{font-size:12px;color:#979797;font-weight:400}
        /* ---- soner ---- */
        .grp{display:flex;flex-direction:column;gap:8px}
        .gh{display:flex;align-items:center;gap:8px;padding:8px 4px 0;width:100%;text-align:left;min-width:0}
        .gn{flex:1;font-size:12px;font-weight:500;letter-spacing:.08em;text-transform:uppercase;color:#979797}
        .gm{font-size:12px;color:#7f7f7f;white-space:nowrap}
        .zc{background:${C.card};box-shadow:${C.edge};border-radius:24px;padding:12px;display:flex;flex-direction:column;gap:12px;transition:opacity .2s;min-width:0}
        .zc.dis{opacity:.6}
        .zc.on{box-shadow:inset 0 0 0 1px ${M.alpha(C.blue, 0.45)}}
        .zm{display:flex;align-items:center;gap:12px;min-width:0;cursor:pointer}
        .zi{position:relative;width:52px;height:52px;border-radius:26px;display:grid;place-items:center;flex:none;overflow:hidden}
        .zi.prog{background:${M.alpha(C.green, 0.18)};color:${C.green}}
        .zi.man{background:rgba(255,255,255,.08);color:#afafaf}
        .zi.run{background:conic-gradient(${C.blue} calc(var(--p) * 1%),rgba(255,255,255,.12) 0);color:#fafafa}
        .zin{position:absolute;inset:4px;border-radius:50%;overflow:hidden;background:#1f3446}
        .wf{position:absolute;left:0;right:0;bottom:0;background:${M.alpha(C.blue, 0.55)};transition:height 1s linear}
        .dp{position:absolute;top:-6px;left:30%;width:4px;height:6px;border-radius:2px 2px 3px 3px;background:#bfe9ff;animation:va-dp 1.2s linear infinite}
        .dp.b{left:62%;animation-delay:-.6s}
        @keyframes va-dp{0%{transform:translateY(0);opacity:0}20%{opacity:1}100%{transform:translateY(46px);opacity:0}}
        .zt{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
        .zk{font-size:16px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .zk .kode{font-size:12px;color:#979797;font-weight:500;margin-right:5px}
        .zs{font-size:12px;color:#979797}
        .zs.run{color:${C.blue}}
        .zn{display:flex;flex-direction:column;align-items:flex-end;flex:none;max-width:26%;gap:2px}
        .zn .t{font-size:20px;font-weight:300;line-height:1}
        .zn .p{font-size:11px;color:#7f7f7f;max-width:100%}
        .zb{width:48px;height:48px;border-radius:24px;background:${C.inner};display:grid;place-items:center;flex:none}
        .zb.on{background:${C.blue};color:#141416}
        .akt{height:40px;padding:0 14px;border-radius:20px;background:${C.inner};font-size:13px;font-weight:600;flex:none}
        .zx{display:flex;flex-direction:column;gap:10px}
        .seg{display:flex;padding:3px;border-radius:18px;background:#282828;gap:2px;position:relative;min-width:0}
        .seg .sg{flex:1 1 0;min-width:0;height:36px;border-radius:15px;font-size:13px;font-weight:500;color:#afafaf;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 6px;transition:background .2s,color .2s}
        .seg .sg.on{background:${C.ctrl};color:#fafafa}
        .seg.top{background:${C.card};box-shadow:${C.edge};padding:4px;border-radius:20px}
        .seg.top .sg{height:40px}
        .start{height:52px;border-radius:26px;background:${PINK};color:${INK};font-size:15px;font-weight:600;display:flex;align-items:center;justify-content:center;gap:8px}
        .zline{display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:12px;color:#979797;min-width:0}
        .deakt{height:34px;padding:0 12px;border-radius:17px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.12);font-size:12px;font-weight:500;color:#afafaf;flex:none}
        /* ---- program ---- */
        .sh{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 4px 0;min-width:0}
        .st{font-size:12px;font-weight:500;letter-spacing:.08em;text-transform:uppercase;color:#979797;white-space:nowrap}
        .sm{font-size:12px;color:#7f7f7f;min-width:0}
        .sm small{font-size:12px}
        .nyt{height:36px;padding:0 14px 0 10px;border-radius:18px;background:${C.inner};font-size:13px;font-weight:600;display:inline-flex;align-items:center;gap:4px}
        .pc{display:flex;align-items:center;gap:12px;padding:14px 14px 14px 16px;border-radius:24px;background:${C.card};box-shadow:${C.edge};transition:opacity .2s;min-width:0}
        .pc.off{opacity:.55}
        .pt{display:flex;flex-direction:column;width:64px;flex:none;gap:4px}
        .pt .num{font-size:24px;font-weight:300;letter-spacing:-0.02em;line-height:1}
        .pd{font-size:11px;color:#7f7f7f}
        .pm2{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}
        .pn{font-size:15px;font-weight:500}
        .ps{font-size:12px;color:#7f7f7f}
        .ag{padding:12px 0}
        .agd{font-size:14px;font-weight:500}
        .agr{display:flex;align-items:center;gap:12px;padding:5px 0;font-size:13px;min-width:0}
        .agt{width:40px;flex:none;font-size:13px;color:#afafaf}
        .agdot{width:6px;height:6px;border-radius:3px;background:${C.blue};flex:none}
        .stpl>.msh-stp-row+.msh-stp-row{border-top:1px solid rgba(255,255,255,0.06)}
        .ed .fr2{display:grid;grid-template-columns:1fr 124px;gap:8px}
        .fl{display:flex;flex-direction:column;gap:6px;font-size:12px;color:#979797;min-width:0}
        .fi{height:44px;border-radius:14px;background:#282828;border:0;color:#fafafa;padding:0 12px;font:inherit;font-size:15px;width:100%;box-sizing:border-box;outline:none;color-scheme:dark}
        .frow{display:flex;flex-direction:column;gap:8px}
        .days{display:grid;grid-template-columns:repeat(7,1fr);gap:6px}
        .dy{height:40px;border-radius:20px;background:#282828;font-size:13px;font-weight:600;color:#979797}
        .dy.on{background:${PINK};color:${INK}}
        .zsel{display:flex;flex-direction:column}
        .zs2{display:flex;align-items:center;gap:10px;min-height:48px}
        .cb{width:26px;height:26px;border-radius:8px;box-shadow:inset 0 0 0 2px ${C.ctrl};display:grid;place-items:center;flex:none}
        .cb.on{background:${C.pink};box-shadow:none;color:${INK}}
        .pmb{width:34px;height:34px;border-radius:17px;background:#282828;font-size:18px;flex:none}
        .pv{width:56px;text-align:center;font-size:13px;flex:none}
        .sum{font-size:13px;color:#afafaf}
        .slett{height:44px;border-radius:22px;color:${C.red};box-shadow:inset 0 0 0 1px ${M.alpha(C.red, 0.35)};display:flex;align-items:center;justify-content:center;gap:6px;font-size:14px;font-weight:500}
        /* ---- forbruk / historikk ---- */
        .chip{height:26px;padding:0 10px;border-radius:13px;background:${M.alpha(C.green, 0.16)};color:${C.green};font-size:12px;font-weight:600;display:inline-flex;align-items:center;white-space:nowrap}
        .chip.over{background:${M.alpha(C.orange, 0.18)};color:${C.orange}}
        .b48{font-size:48px;font-weight:300;letter-spacing:-0.035em;line-height:1}
        .b48 span{font-size:15px;color:#979797;margin-left:8px;letter-spacing:0}
        .b34{font-size:34px;font-weight:300;letter-spacing:-0.025em;line-height:1}
        .b34 span{font-size:15px;color:#979797}
        .band{display:flex;gap:2px;height:10px;border-radius:5px;overflow:hidden}
        .band i{display:block;min-width:4px;border-radius:2px}
        .kl{display:flex;flex-direction:column;gap:2px}
        .kr{display:flex;align-items:center;gap:10px;font-size:14px;min-height:30px;min-width:0}
        .dot{width:10px;height:10px;border-radius:5px;flex:none}
        .kn{flex:1}
        .kv{color:#e1e1e1}
        .foot{font-size:13px;color:#afafaf}
        .warn{color:${C.orange}}
        .warnrow{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:16px;background:${M.alpha(C.orange, 0.14)};color:${C.orange};font-size:13px}
        .lr{display:flex;align-items:center;gap:12px;padding:10px 0;font-size:14px;min-width:0}
        .zbar{position:relative;height:4px;border-radius:2px;background:#282828;overflow:hidden}
        .zbar i{position:absolute;left:0;top:0;bottom:0;border-radius:2px;background:${C.blue}}
        .cal{padding:14px 12px 16px;gap:10px}
        .mh{display:flex;align-items:center;justify-content:space-between;grid-column:1/-1}
        .mh b{font-size:15px;font-weight:500}
        .nb{width:40px;height:40px;border-radius:20px;display:grid;place-items:center}
        .calg{display:grid;grid-template-columns:repeat(7,1fr);gap:3px}
        .wd{text-align:center;font-size:11px;color:#696969;padding:4px 0}
        .cc{height:48px;border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;min-width:0;padding:0}
        .cc .cn{font-size:14px}
        .cc .cl{font-size:9px;color:#e1e1e1;white-space:nowrap;min-height:10px}
        .cc.sel{box-shadow:inset 0 0 0 1.5px #fafafa}
        .cc.td .cn{font-weight:700}
        .cc.ut{opacity:.3}
        .cdot{width:5px;height:5px;border-radius:3px;background:${C.green}}
        .lg{gap:14px;font-size:11px;color:#979797;padding:0 6px;grid-column:1/-1}
        .lg span{display:inline-flex;align-items:center;gap:6px}
        .lg i{width:8px;height:8px;border-radius:4px;display:inline-block}
        .lg i.pl{box-shadow:inset 0 0 0 1.5px ${C.green}}
        .cal>.hr,.cal>.sp,.cal>.kr,.cal>.agr,.cal>.lab{grid-column:1/-1}
        .h14{position:relative;display:grid;grid-template-columns:repeat(14,1fr);gap:4px;height:110px;align-items:end}
        .h14 .b{border-radius:6px}
        .mline{position:absolute;left:0;right:0;border-top:1.5px dashed rgba(255,255,255,.4);pointer-events:none;z-index:1}
        .mline span{position:absolute;right:0;bottom:3px;font-size:10px;color:#afafaf;background:${C.card};padding:0 4px;border-radius:4px}
        @media (prefers-reduced-motion: reduce){.wave,.sky,.rd,.dp,.straa,.blomst,.sol,.sky2{animation:none !important}}
      `;
    }
  }
  // KI-cards-metodene inn i kortet (kortets egne _c/_h/_st vinner)
  Object.entries(Object.getOwnPropertyDescriptors(KV)).forEach(([k, dsc]) => { if (!Object.prototype.hasOwnProperty.call(Vanning.prototype, k)) Object.defineProperty(Vanning.prototype, k, { ...dsc, configurable: true }); });

  /* ============================================================ «Tilpass Vanning» (Faner · Soner · Entiteter · Avansert) */
  // Samme skjema i kortets eget ark (MSH.openEditor → utkast + Ferdig, portalt ut av popupen) og i HAs GUI-editor.
  const cidOf = (ed) => ((ed && ed._config && ed._config.card_id) || '_');
  const hdl = (list) => `<span class="vdrag" data-vdrag="${list}" title="Dra for rekkefølge" style="touch-action:none;cursor:grab;display:inline-flex;color:#979797;padding:8px 2px;flex:none">${M.icon('mdi:drag', 20)}</span>`;
  const sw = (on, attrs, label) => `<button class="sw ${on ? 'on' : ''}" role="switch" aria-checked="${!!on}" aria-label="${esc(label || '')}" ${attrs}></button>`;
  const rowCss = 'min-height:56px;border-radius:28px;background:#3a3a3a;display:flex;align-items:center;gap:8px;padding:0 12px 0 8px';
  // Rekkefølge-lister i arket
  const faneOrden = (c) => { const vis = fanerCfg(c); return [...vis, ...FANER.filter((k) => !vis.includes(k))]; };
  const soneOrden = (h, c) => { const L = soneListe(h, c), o = Array.isArray(c.soneorden) ? c.soneorden : []; return L.map((z, i) => ({ ...z, i })).sort((a, b) => { const x = o.indexOf(a.key), y = o.indexOf(b.key); return (x < 0 ? 1e3 + a.i : x) - (y < 0 ? 1e3 + b.i : y); }); };
  // Dra-håndtak (touch-action none + stopPropagation, fallgruve 2) og gruppenavn. Én gang per editor.
  function installEd(ed) {
    if (!ed || ed.__vanInst || !ed.shadowRoot) return;
    ed.__vanInst = true;
    const R = ed.shadowRoot;
    let d = null;
    const stop = (e) => { if (e.target.closest && e.target.closest('[data-vdrag]')) e.stopPropagation(); };
    R.addEventListener('touchstart', stop, { passive: true });
    R.addEventListener('touchmove', stop, { passive: true });
    // gruppenavn: lagres ved endring (change), listen er config `grupper: [{ id, navn }]`
    R.addEventListener('change', (e) => {
      const t = e.target; if (!t.dataset || t.dataset.vg == null) return;
      e.stopPropagation();
      const G = (Array.isArray((ed._config || {}).grupper) ? ed._config.grupper : []).map((g) => ({ ...g }));
      const g = G[Number(t.dataset.vg)]; if (!g) return;
      g.navn = t.value.trim() || g.navn; ed._set('grupper', G);
    }, true);
    R.addEventListener('pointerdown', (e) => {
      const hd = e.target.closest && e.target.closest('[data-vdrag]');
      if (!hd || e.button) return;
      const item = hd.closest('[data-vk]'); if (!item) return;
      e.stopPropagation(); e.preventDefault();
      d = { list: hd.dataset.vdrag, k: item.dataset.vk, item, y0: e.clientY, id: e.pointerId, over: null };
      try { hd.setPointerCapture(e.pointerId); } catch (x) { /* */ }
      item.style.position = 'relative'; item.style.zIndex = '2'; item.style.boxShadow = '0 6px 18px rgba(0,0,0,.4)';
      M.haptic('medium');
    });
    R.addEventListener('pointermove', (e) => {
      if (!d || e.pointerId !== d.id) return;
      e.stopPropagation(); e.preventDefault();
      d.item.style.transform = `translateY(${e.clientY - d.y0}px)`;
      d.item.style.pointerEvents = 'none';
      const el = R.elementFromPoint ? R.elementFromPoint(e.clientX, e.clientY) : null;
      d.item.style.pointerEvents = '';
      const ov = el && el.closest && el.closest('[data-vk]');
      const ok = ov && ov !== d.item && ov.dataset.vl === d.list ? ov : null;
      if (ok !== d.over) { if (d.over) d.over.style.outline = ''; d.over = ok; if (ok) { ok.style.outline = '2px solid rgba(242,133,201,.6)'; M.haptic('selection'); } }
    });
    const end = (e) => {
      if (!d || (e && e.pointerId !== d.id)) return;
      const D = d; d = null;
      D.item.style.transform = ''; D.item.style.zIndex = ''; D.item.style.boxShadow = '';
      if (D.over) D.over.style.outline = '';
      if (!D.over) { ed._render(); return; }
      const c = ed._config || {};
      const arr = D.list === 'fane' ? faneOrden(c) : soneOrden(ed._hass, c).map((z) => z.key);
      const to = D.over.dataset.vk, i = arr.indexOf(D.k), j0 = arr.indexOf(to);
      const o = arr.filter((x) => x !== D.k), j = o.indexOf(to);
      o.splice(i <= j0 ? j + 1 : j, 0, D.k);
      M.haptic('success');
      if (D.list === 'fane') { const vis = new Set(fanerCfg(c)); ed._set('faner', o.filter((k) => vis.has(k))); }
      else ed._set('soneorden', o);
    };
    R.addEventListener('pointerup', end);
    R.addEventListener('pointercancel', end);
  }

  function editorSchema(h, c) {
    c = c || {};
    // Faner: dra for rekkefølge, av/på per fane (minst én)
    const faner = { type: 'html', html: (hh, cc, key, ed) => {
      installEd(ed);
      const vis = new Set(fanerCfg(cc));
      return `<div class="f" style="gap:8px;padding:0;background:none;box-shadow:none">${faneOrden(cc).map((k) => {
        const [l, ic] = FANE[k], on = vis.has(k);
        return `<div class="ordrow" data-vk="${k}" data-vl="fane" data-key="vf-${k}" style="${rowCss};${on ? '' : 'opacity:.55'}">${hdl('fane')}
          <span style="width:36px;height:36px;border-radius:18px;display:grid;place-items:center;background:#404040;flex:none">${M.icon(ic, 20)}</span>
          <span style="flex:1;min-width:0;font-size:14px;font-weight:500">${esc(l)}</span>${sw(on, `data-a="fn" data-k="${key}" data-op="fane" data-v="${k}"`, 'Vis ' + l)}</div>`;
      }).join('')}<span class="help">Dra i håndtaket for rekkefølge. Forbruk vises når KI Vann eller en vannmåler finnes, Historikk når KI Vanning fører statistikk.</span></div>`;
    }, click: (dd, ed) => {
      const cc = ed._config || {}, vis = fanerCfg(cc);
      if (dd.op === 'fane') {
        if (vis.includes(dd.v)) { if (vis.length <= 1) { M.haptic('warning'); M.toast('Minst én fane må være synlig'); return; } M.haptic('selection'); return ed._set('faner', vis.filter((x) => x !== dd.v)); }
        const ord = faneOrden(cc); M.haptic('selection');
        return ed._set('faner', ord.filter((x) => x === dd.v || vis.includes(x)));
      }
    } };
    const fanevis = { type: 'select', name: 'fanevisning', label: 'Fanene viser', options: [['begge', 'Ikon + tekst'], ['tekst', 'Tekst'], ['ikoner', 'Ikoner']], default: 'begge' };
    // Soner · grupper (navn, pil opp, slett, + Ny gruppe)
    const grupper = { type: 'html', html: (hh, cc, key, ed) => {
      installEd(ed);
      const G = Array.isArray(cc.grupper) ? cc.grupper : [];
      return `<div class="f" style="gap:8px"><div class="line"><span style="flex:1;font-size:14px;font-weight:500">Grupper</span><span class="help" style="margin:0">${G.length ? '' : 'Standard: boks fra sonenavnet (B1 → Boks 1)'}</span></div>
        ${G.map((g, i) => `<div data-key="vg-${esc(g.id)}" style="display:flex;align-items:center;gap:6px"><input class="inp" data-vg="${i}" value="${esc(g.navn || '')}" placeholder="Gruppenavn" autocapitalize="sentences" style="flex:1;min-width:0">
          <button class="ib" data-a="fn" data-k="${key}" data-op="gup" data-v="${i}" aria-label="Flytt opp" ${i ? '' : 'disabled style="opacity:.3"'}>${M.icon('mdi:arrow-up', 20)}</button>
          <button class="ib" data-a="fn" data-k="${key}" data-op="gdel" data-v="${i}" aria-label="Slett gruppe">${M.icon('mdi:delete-outline', 20)}</button></div>`).join('')}
        <button class="btn" style="height:44px" data-a="fn" data-k="${key}" data-op="gny" data-v="">${M.icon('mdi:plus', 20)}Ny gruppe</button></div>`;
    }, click: (dd, ed) => {
      const cc = ed._config || {}, G = (Array.isArray(cc.grupper) ? cc.grupper : []).map((g) => ({ ...g }));
      if (dd.op === 'gny') { M.haptic('success'); G.push({ id: 'g' + Date.now().toString(36), navn: `Gruppe ${G.length + 1}` }); return ed._set('grupper', G); }
      const i = Number(dd.v);
      if (dd.op === 'gup' && i > 0) { [G[i - 1], G[i]] = [G[i], G[i - 1]]; M.haptic('selection'); return ed._set('grupper', G); }
      if (dd.op === 'gdel' && G[i]) {
        const id = G[i].id; G.splice(i, 1); M.haptic('warning');
        const sg = { ...(cc.sonegruppe || {}) }; Object.keys(sg).forEach((k) => { if (sg[k] === id) delete sg[k]; });
        ed._config = { ...cc, sonegruppe: Object.keys(sg).length ? sg : undefined };
        return ed._set('grupper', G.length ? G : undefined);
      }
    } };
    // Soner · alle soner: dra, eget navn (sonenavn), vis/skjul og gruppe-chips (inkl. «Ingen»)
    const soner = { type: 'html', html: (hh, cc, key, ed) => {
      installEd(ed);
      if (!hh) return '';
      const L = soneOrden(hh, cc), skj = new Set(cc.skjul_soner || []), G = Array.isArray(cc.grupper) ? cc.grupper : [], sg = cc.sonegruppe || {}, nv = cc.sonenavn || {};
      if (!L.length) return `<div class="f"><div class="line"><span style="flex:1;font-size:14px">–</span></div><span class="help">Fant ingen soner. Velg KI Vanning / OpenSprinkler under Entiteter.</span></div>`;
      return `<div class="f" style="gap:8px;padding:0;background:none;box-shadow:none"><span class="help" style="padding:0 6px">Soner (${L.length})</span>${L.map((z) => {
        const hid = skj.has(z.key);
        const chips = G.length ? `<div class="chips" style="padding:0 6px 10px 44px;flex-wrap:wrap">${[{ id: '', navn: 'Ingen' }, ...G].map((g) => { const on = (sg[z.key] || '') === g.id; return `<button class="chip ${on ? 'on' : ''}" aria-selected="${on}" data-a="fn" data-k="${key}" data-op="sgrp" data-v="${esc(z.key)}" data-g="${esc(g.id)}" style="height:30px;font-size:12px">${esc(g.navn || 'Gruppe')}</button>`; }).join('')}</div>` : '';
        return `<div data-vk="${esc(z.key)}" data-vl="sone" data-key="vs-${esc(z.key)}" style="border-radius:24px;background:#3a3a3a;${hid ? 'opacity:.55' : ''}">
          <div style="display:flex;align-items:center;gap:6px;min-height:56px;padding:0 10px 0 8px">${hdl('sone')}
            ${z.kode ? `<span style="font-size:12px;color:#979797;width:30px;flex:none;font-variant-numeric:tabular-nums">${esc(z.kode)}</span>` : ''}
            <input class="inp" data-name="sonenavn.${esc(z.key)}" value="${esc(nv[z.key] || '')}" placeholder="${esc(z.navn)}" style="flex:1;min-width:0;height:40px">
            <button class="ib" data-a="fn" data-k="${key}" data-op="eye" data-v="${esc(z.key)}" aria-label="${hid ? 'Vis' : 'Skjul'} ${esc(z.navn)}" style="width:40px;height:40px;border-radius:20px;display:grid;place-items:center;flex:none">${M.icon(hid ? 'mdi:eye-off-outline' : 'mdi:eye-outline', 20, `color:${hid ? '#696969' : '#fafafa'}`)}</button></div>${chips}</div>`;
      }).join('')}<span class="help">Dra for rekkefølge. Tomt navn = navnet fra anlegget. Uten egne grupper grupperes sonene etter boks.</span></div>`;
    }, click: (dd, ed) => {
      const cc = ed._config || {};
      if (dd.op === 'eye') { const s = new Set(cc.skjul_soner || []); if (s.has(dd.v)) s.delete(dd.v); else s.add(dd.v); M.haptic('selection'); return ed._set('skjul_soner', s.size ? [...s] : undefined); }
      if (dd.op === 'sgrp') { M.haptic('selection'); return ed._set('sonegruppe.' + dd.v, dd.g || undefined); }
    } };
    const stdMin = { type: 'select', name: 'standard_min', label: 'Standardvarighet', options: [[5, '5 min'], [10, '10 min'], [15, '15 min'], [30, '30 min']], default: 10 };
    // Entiteter (tomt = autokonfig)
    const L0 = (hh, cc) => logic(hh, cc);
    const ent = (name, label, domains, auto, dc) => ({ type: 'entity', name, label, domains, domain: domains, device_class: dc, auto: (hh, cc) => { try { return auto(L0(hh, cc), hh, cc) || null; } catch (e) { return null; } } });
    const entiteter = [
      { type: 'info', label: 'Tomt = automatisk (KI Vanning, OpenSprinkler og KI Vann finnes selv). Velg bare hvis det automatiske valget er feil.' },
      ent('ki_vanning', 'KI Vanning-oversikt', ['sensor'], (L) => { const k = L._ki(); return k && k.id; }),
      ent('anlegg', 'Anlegget (hovedbryter)', ['switch', 'input_boolean'], (L) => (L._ventilmodus() ? L._kiEnt('anlegg') : L._styring().aktiv)),
      ent('regnpause', 'Regnpause', ['number', 'binary_sensor', 'input_boolean', 'switch'], (L) => (L._ventilmodus() ? L._kiEnt('regnpause') : L._styring().regn)),
      ent('vinter', 'Vintermodus', ['input_boolean', 'switch'], () => null),
      ent('strom', 'Strømtrekk', ['sensor'], (L) => { const s = L._styring(); return s.strom && L._st(s.strom) ? s.strom : null; }),
      ent('vannmaler', 'Vannmåler totalt', ['sensor'], (L) => L._vannmaler(), 'water'),
      { type: 'text', name: 'vann_prefiks', label: 'KI Vann-prefiks', placeholder: 'sensor.hjemme_', auto: (hh, cc) => { try { return L0(hh, cc)._vannPrefiks(); } catch (e) { return null; } }, help: 'Slik KI Vann-sensorene heter, f.eks. sensor.hjemme_ (→ sensor.hjemme_vann_i_dag)' },
      ent('vann_modell', 'KI Vann-modell', ['sensor'], (L) => { const p = L._vannPrefiks(); return p && L._st(p + 'modell') ? p + 'modell' : null; }),
      { type: 'section', id: 'reserve', label: 'Uten KI Vanning (reserve)', icon: 'mdi:sprinkler', fields: SCHEMA_BASE },
    ];
    // Avansert · innstillingsradene fra KI Vanning (_panelInnstillinger) – virker rett mot Home Assistant
    const innst = { type: 'html', html: (hh, cc, key) => {
      if (!hh) return '';
      const P = L0(hh, cc)._panelInnstillinger();
      const rad = (r) => `<div class="line" data-key="vi-${esc(r.id)}" style="min-height:52px;border-radius:26px;background:#3a3a3a;padding:0 8px 0 16px;gap:10px"><span style="flex:1;min-width:0;display:flex;flex-direction:column"><span style="font-size:14px">${esc(r.navn)}</span><span style="font-size:11px;color:#979797">${esc(r.tekst != null ? String(r.tekst) : '')}</span></span>${r.type === 'bryter' ? sw(r.pa, `data-a="fn" data-k="${key}" data-op="inn" data-t="bryter" data-v="${esc(r.id)}"`, r.navn) : `<button class="btn" style="height:40px;padding:0 14px" data-a="fn" data-k="${key}" data-op="inn" data-t="${r.type}" data-v="${esc(r.id)}">${M.icon(r.type === 'knapp' ? 'mdi:play-circle-outline' : 'mdi:pencil', 18)}${r.type === 'knapp' ? esc(r.tekst || 'Kjør') : 'Endre'}</button>`}</div>`;
      if (!P.deler.length && !P.varsler.length) return `<div class="f"><span class="help">Installer KI Vanning for regnpause, stopp alt, programplan, kalibrering og varsler her.</span></div>`;
      return `<div class="f" style="gap:8px;padding:0;background:none;box-shadow:none">${P.deler.map(rad).join('')}${P.mangler ? '<span class="help">Fant ikke regnpause og hovedbryter – oppdater KI Vanning til 3.0.0 og last integrasjonen på nytt.</span>' : ''}
        ${P.varsler.length ? `<span class="help" style="padding:8px 6px 0">Varsler</span>${P.varsler.map(rad).join('')}` : ''}${P.ki ? '<span class="help">Regnpause og hovedbryter kommer fra KI Vanning – ingen entiteter å skrive inn.</span>' : ''}</div>`;
    }, click: (dd, ed) => {
      const hh = ed._hass; if (!hh) return;
      M.haptic(dd.t === 'bryter' ? 'selection' : 'light');
      if (dd.t === 'bryter') return hh.callService('homeassistant', 'toggle', { entity_id: dd.v });
      if (dd.t === 'knapp') return hh.callService('button', 'press', { entity_id: dd.v });
      ed.dispatchEvent(new CustomEvent('hass-more-info', { detail: { entityId: dd.v }, bubbles: true, composed: true }));
    } };
    const avansert = [
      { type: 'boolean', name: 'vis_vannmaler', label: 'Vis vannmåler i toppkortet', default: true },
      { type: 'boolean', name: 'haptikk', label: 'Haptikk', default: true },
      { type: 'select', name: 'styring', label: 'Styring av programmer', options: [['auto', 'Automatisk'], ['ki_vanning', 'KI Vanning'], ['opensprinkler', 'OpenSprinkler']], default: 'auto', help: 'KI Vanning: programmene kan lages og endres her. OpenSprinkler: bare av/på – endres i OpenSprinkler.' },
      { type: 'select', name: 'mal', label: 'Dagsmål (vann i huset)', options: [[250, '250 L'], [400, '400 L'], [600, '600 L']], default: 400 },
      { type: 'boolean', name: 'toasts', label: 'Bekreftelsesmeldinger', default: true },
      { type: 'section', id: 'innstillinger', label: 'KI Vanning', icon: 'mdi:tune-variant', fields: [innst] },
      M.spacingSchema(),
      { type: 'button', label: 'Tilbakestill til standard', icon: 'mdi:restore', run: (hh, cc, ed) => { M.haptic('warning'); const id = (cc && cc.card_id) || M.uid(); ed._config = { type: cc.type || 'custom:msh-vanning-card', card_id: id }; ed._set('card_id', id); } },
    ];
    return [
      { type: 'tabs', id: 'vanning', tabs: [
        { key: 'faner', label: 'Faner', icon: 'mdi:tab', focus: ['faner'], fields: [faner, fanevis] },
        { key: 'soner', label: 'Soner', icon: 'mdi:sprinkler-variant', focus: ['soner'], fields: [grupper, soner, stdMin] },
        { key: 'entiteter', label: 'Entiteter', icon: 'mdi:format-list-bulleted', focus: ['entiteter', 'overrides', 'reserve'], fields: entiteter },
        { key: 'avansert', label: 'Avansert', icon: 'mdi:tune-variant', focus: ['avansert', 'innstillinger', 'spacing'], fields: avansert },
      ] },
    ];
  }

  M.define('msh-vanning-card', Vanning, 'MSH Vanning', 'Vanning-popup (#vanning), ett kort: hagescene, Nå · Soner · Program · Forbruk (KI Vann) · Historikk. Setter seg opp selv fra KI Vanning, OpenSprinkler og KI Vann.');
})();
