/* KI-MSH · PC-dashbord – data (Fiks 64, prompt v8, designet: PC-dashbord.dc.html).
 * Alle tall hentes fra de samme HA-entitetene som mobilkortene bruker (aldri eksempeldata – mangler noe: «–»):
 *   rom/klima: MSH.areas + MSH.roomClimate · vær: MSH.vaerAuto (+ MSH.wxForecast) · strøm: MSH.powerPrice + HAs
 *   Energi-oppsett (MSH.energiPrefs/energiSources, recorder/statistics_during_period) · alarm: MSH.alarmState ·
 *   personer: MSH.hjemPersons/personStatus · kamera: MSH.cameraList · varmepumpe: climate.* (heat/cool) ·
 *   resten (dører/vinduer, røyk/vann/gass, bevegelse, batteri, oppdateringer, nett) fra device_class/plattform.
 * Historikk/statistikk hentes bare mens PC-dashbordet vises og mellomlagres 5 min (fallgruve 8).
 *   MSH.pcData.collect(hass, card) → D (synkront, memo per states-objekt)
 *   MSH.pcData.load(hass, card, tab) → henter historikk/statistikk for fanen (async, kaller card.update())
 *   MSH.pcData.analyse(hass, card, tab, nDays) → [{ n, u, kind, vals, sum, avg }] fra statistikken (async-cache)
 */
(function () {
  const M = window.MSH;
  if (!M) return;
  const kiT = (no, en) => (window.kiT ? window.kiT(no, en) : no);
  const TTL = 300000;
  const BAD = ['unavailable', 'unknown', '', 'none', null, undefined];
  const okS = (s) => !!s && !BAD.includes(s.state);
  const num = (hass, id) => { const s = id && hass.states[id]; if (!okS(s)) return null; const v = parseFloat(String(s.state).replace(',', '.')); return isNaN(v) ? null : v; };
  const dom = (id) => String(id).split('.')[0];
  const avg = (a) => { const v = a.filter((x) => x != null && !isNaN(x)); return v.length ? v.reduce((s, x) => s + Number(x), 0) / v.length : null; };
  const sum = (a) => a.filter((x) => x != null && !isNaN(x)).reduce((s, x) => s + Number(x), 0);
  const name = (hass, id) => (M.name ? M.name(hass, id) : (hass.states[id] && hass.states[id].attributes.friendly_name) || id);
  const regOk = (hass, id) => { const e = hass.entities && hass.entities[id]; return !e || (!e.hidden && !e.disabled_by && !e.entity_category); };
  const byDc = (hass, domains, dcs) => Object.keys(hass.states).filter((id) => domains.includes(dom(id)) && dcs.includes(hass.states[id].attributes.device_class) && regOk(hass, id));
  const CTRL = ['light', 'switch', 'fan', 'media_player', 'climate', 'cover', 'lock', 'vacuum', 'humidifier', 'water_heater'];
  const isOn = (s) => !!s && ['on', 'open', 'playing', 'heat', 'cool', 'heat_cool', 'auto', 'dry', 'fan_only', 'unlocked', 'cleaning'].includes(s.state);

  /* ------------------------------------------------------------ cache for async data */
  const H = {}; // nøkkel → { t, d, busy }
  const cached = (k) => H[k] && H[k].d;
  function fetchOnce(k, fn, done) {
    const c = H[k];
    if (c && (c.busy || Date.now() - c.t < TTL)) return;
    H[k] = { t: Date.now(), d: c ? c.d : null, busy: true };
    Promise.resolve().then(fn).catch(() => null).then((d) => { H[k] = { t: Date.now(), d: d == null ? (c ? c.d : null) : d, busy: false }; if (done) done(); });
  }
  const stats = (hass, ids, start, end, period, types, units) => (ids.length && hass.callWS ? hass.callWS({ type: 'recorder/statistics_during_period', start_time: start.toISOString(), end_time: end.toISOString(), statistic_ids: ids, period, types, ...(units ? { units } : {}) }) : Promise.resolve({}));
  const day0 = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

  /* ------------------------------------------------------------ oppdagelse (memo per states-objekt) */
  let MEMO = null;
  function collect(hass, card) {
    if (!hass || !hass.states) return null;
    const cfg = (card && card.config) || {};
    if (MEMO && MEMO.S === hass.states && MEMO.cfg === cfg && MEMO.lang === (window.kiLang ? window.kiLang() : 'no')) return MEMO.D;
    const D = build(hass, cfg);
    MEMO = { S: hass.states, cfg, lang: window.kiLang ? window.kiLang() : 'no', D };
    return D;
  }
  function build(hass, cfg) {
    const ex = new Set(cfg.exclude || []);
    // Rom: HA-områder (samme som rom-popupene), klima via MSH.roomClimate (overrides fra «Tilpass rom»)
    const areas = (M.areas ? M.areas(hass) : []).filter((a) => !(M.roomBlocked && M.roomBlocked(hass, a.id)));
    const rooms = areas.map((a) => {
      let rc = null; try { rc = M.roomClimate ? M.roomClimate(hass, a.id, {}) : null; } catch (e) { rc = null; }
      const clim = rc && rc.climate && hass.states[rc.climate];
      const target = clim && clim.attributes && M.isNum(clim.attributes.temperature) ? Number(clim.attributes.temperature) : null;
      const ents = M.areaEntities ? M.areaEntities(hass, a.id).filter((id) => CTRL.includes(dom(id)) && regOk(hass, id) && !ex.has(id)) : [];
      return { id: a.id, name: a.name, icon: a.icon || 'mdi:texture-box', picture: a.picture || null, temp: rc ? rc.temp.v : null, tempId: rc ? rc.temp.id : null, hum: rc ? rc.hum.v : null, humId: rc ? rc.hum.id : null,
        climate: rc ? rc.climate : null, target, ents, on: ents.filter((id) => isOn(hass.states[id])).length };
    });
    const tRooms = rooms.filter((r) => r.temp != null);
    const inside = avg(tRooms.map((r) => r.temp)), hum = avg(rooms.map((r) => r.hum));
    // Ute: værentiteten (som Vær-popupen), ellers en utetemperatursensor
    const W = M.vaerAuto ? M.vaerAuto(hass, {}) : { weather: null };
    const ws = W.weather && hass.states[W.weather];
    const outId = cfg.outdoor_temp || Object.keys(hass.states).find((id) => dom(id) === 'sensor' && hass.states[id].attributes.device_class === 'temperature' && /(^|_)(ute|outdoor|outside|utendors|utendørs)(_|$)/.test(id.split('.')[1]) && regOk(hass, id)) || null;
    const outside = outId ? num(hass, outId) : ws && M.isNum(ws.attributes.temperature) ? Number(ws.attributes.temperature) : null;
    // Strøm: effekt nå (HAs Energi-oppsett → grid-sensor med device_class power, ellers største effektsensor uten område)
    const powerIds = Object.keys(hass.states).filter((id) => dom(id) === 'sensor' && hass.states[id].attributes.device_class === 'power' && regOk(hass, id));
    const mainPow = cfg.power || powerIds.find((id) => /(^|_)(ams|han|tibber_pulse|pulse|maler|måler|grid|nett|power_consumption|effekt_hus|husets)/.test(id)) || null;
    const powW = mainPow ? num(hass, mainPow) : null;
    const pu = mainPow && hass.states[mainPow] && String(hass.states[mainPow].attributes.unit_of_measurement || 'W');
    const powKw = powW == null ? null : /kw/i.test(pu || '') ? powW : powW / 1000;
    // Strømpris
    let P = null; try { P = M.powerPrice ? M.powerPrice(hass) : null; } catch (e) { P = null; }
    // Alarm
    const A = M.alarmState ? M.alarmState(hass, (M.sikCfg && M.sikCfg()) || {}) : { text: '–', mode: null };
    // Personer
    const hc = (M.hjemHeaderCfg && M.hjemHeaderCfg()) || {};
    const PL = M.hjemPersons ? M.hjemPersons(hass, hc).visible : Object.keys(hass.states).filter((id) => dom(id) === 'person');
    const persons = PL.map((id) => { const s = hass.states[id]; let st = null; try { st = M.personStatus ? M.personStatus(hass, id) : null; } catch (e) { st = null; }
      const home = st ? st.kind === 'home' : !!s && s.state === 'home';
      return { id, name: name(hass, id), home, label: st && st.label ? st.label : s ? (s.state === 'home' ? 'Hjemme' : s.state === 'not_home' ? 'Borte' : s.state) : '–', pic: s && s.attributes.entity_picture }; });
    // Dører og vinduer, låser
    const doors = byDc(hass, ['binary_sensor'], ['door', 'garage_door', 'opening']).filter((id) => !ex.has(id));
    const wins = byDc(hass, ['binary_sensor'], ['window']).filter((id) => !ex.has(id));
    const locks = Object.keys(hass.states).filter((id) => dom(id) === 'lock' && regOk(hass, id) && !ex.has(id));
    const garages = Object.keys(hass.states).filter((id) => dom(id) === 'cover' && ['garage', 'gate'].includes(hass.states[id].attributes.device_class) && regOk(hass, id));
    const openDoors = doors.filter((id) => hass.states[id].state === 'on'), openWins = wins.filter((id) => hass.states[id].state === 'on');
    const unlocked = locks.filter((id) => hass.states[id].state === 'unlocked');
    // Kamera
    const cams = M.cameraList ? M.cameraList(hass, {}).map((c) => c.id) : Object.keys(hass.states).filter((id) => dom(id) === 'camera');
    // Røyk, vann, gass
    const smoke = byDc(hass, ['binary_sensor'], ['smoke']), water = byDc(hass, ['binary_sensor'], ['moisture']), gas = byDc(hass, ['binary_sensor'], ['gas', 'carbon_monoxide']);
    const motion = byDc(hass, ['binary_sensor'], ['motion', 'occupancy', 'presence']).filter((id) => !ex.has(id));
    // CO₂ / luftkvalitet
    const co2Id = cfg.co2 || byDc(hass, ['sensor'], ['carbon_dioxide'])[0] || null, co2 = co2Id ? num(hass, co2Id) : null;
    // Batteri, oppdateringer, nett
    const batt = byDc(hass, ['sensor'], ['battery']).map((id) => ({ id, v: num(hass, id) })).filter((x) => x.v != null && !ex.has(x.id)).sort((a, b) => a.v - b.v);
    const upd = Object.keys(hass.states).filter((id) => dom(id) === 'update' && hass.states[id].state === 'on' && !ex.has(id));
    const devs = Object.values(hass.devices || {});
    const E = hass.entities || {}, devPlat = {};
    Object.values(E).forEach((e) => { if (e && e.device_id && e.platform) (devPlat[e.device_id] = devPlat[e.device_id] || new Set()).add(e.platform); });
    const isZb = (d) => (devPlat[d.id] && devPlat[d.id].has('zha')) || (d.identifiers || []).some((x) => /zigbee|zha/i.test(String(x && x[0]) + String(x && x[1])));
    const isZw = (d) => (devPlat[d.id] && devPlat[d.id].has('zwave_js')) || (d.identifiers || []).some((x) => /zwave/i.test(String(x && x[0])));
    const isWifi = (d) => !isZb(d) && !isZw(d) && (d.connections || []).some((x) => x && x[0] === 'mac');
    const net = [['Zigbee', devs.filter(isZb).length, 'mdi:zigbee'], ['Z-Wave', devs.filter(isZw).length, 'mdi:z-wave'], ['Wi-Fi', devs.filter(isWifi).length, 'mdi:wifi']];
    // Varmepumpe: config → varmepumpe-popupens climate → første climate med varme og kjøling
    const pumpId = cfg.heat_pump || Object.keys(hass.states).find((id) => dom(id) === 'climate' && regOk(hass, id) && (() => { const m = hass.states[id].attributes.hvac_modes || []; return m.includes('heat') && (m.includes('cool') || m.includes('heat_cool') || m.includes('auto')); })()) || null;
    const pump = pumpId && hass.states[pumpId];
    const pumpPow = pumpId && M.powerOf ? M.powerOf(hass, pumpId) : null;
    // Gulvvarme: climate.* med gulv/floor i navn eller ID
    const floor = Object.keys(hass.states).filter((id) => dom(id) === 'climate' && id !== pumpId && regOk(hass, id) && /gulv|floor|varmekabel/i.test(id + ' ' + (hass.states[id].attributes.friendly_name || '')));
    // Ventilasjon: fan.* (balansert ventilasjon) – prosent
    const fanId = cfg.ventilation || Object.keys(hass.states).find((id) => dom(id) === 'fan' && regOk(hass, id) && /vent|flexit|nilan|systemair|ftx|aggregat/i.test(id + ' ' + (hass.states[id].attributes.friendly_name || ''))) || null;
    const fan = fanId && hass.states[fanId];
    const fanPct = fan && M.isNum(fan.attributes.percentage) ? Number(fan.attributes.percentage) : null;
    // Hjemmescore: 100 minus trekk (åpne vinduer/dører, ulåst, lavt batteri, oppdateringer, røyk/vann, utilgjengelige)
    const unavail = Object.keys(hass.states).filter((id) => CTRL.includes(dom(id)) && hass.states[id].state === 'unavailable' && regOk(hass, id)).length;
    const alarmOn = [...smoke, ...water, ...gas].filter((id) => hass.states[id].state === 'on').length;
    let score = 100 - openWins.length * 3 - openDoors.length * 4 - unlocked.length * 4 - batt.filter((b) => b.v < 20).length * 3 - Math.min(10, upd.length * 2) - alarmOn * 25 - Math.min(10, unavail);
    if (A && A.triggered) score -= 30;
    score = Math.max(0, Math.min(100, Math.round(score)));
    scoreLog(score);
    const ctrlAll = rooms.reduce((t, r) => t + r.ents.length, 0), onAll = rooms.reduce((t, r) => t + r.on, 0);
    return { rooms, inside, hum, outside, outId, weather: W.weather, ws, powKw, mainPow, P, A, persons, doors, wins, locks, garages, openDoors, openWins, unlocked, cams,
      smoke, water, gas, motion, co2, co2Id, batt, upd, net, pumpId, pump, pumpPow, floor, fanId, fanPct, score, ctrlAll, onAll,
      tempIds: tRooms.map((r) => r.tempId).filter(Boolean).slice(0, 8), humIds: rooms.map((r) => r.humId).filter(Boolean).slice(0, 8) };
  }
  // Hjemmescore-historikk (ett punkt per time, 20 siste) – lokal logg på denne maskinen
  function scoreLog(v) {
    try {
      const L = JSON.parse(localStorage.getItem('ki-pc-score') || '[]'), h = Math.floor(Date.now() / 3600000);
      if (!L.length || L[L.length - 1][0] !== h) { L.push([h, v]); while (L.length > 20) L.shift(); localStorage.setItem('ki-pc-score', JSON.stringify(L)); }
      else if (L[L.length - 1][1] !== v) { L[L.length - 1][1] = v; localStorage.setItem('ki-pc-score', JSON.stringify(L)); }
    } catch (e) { /* */ }
  }
  const scoreHist = () => { try { return JSON.parse(localStorage.getItem('ki-pc-score') || '[]').map((x) => x[1]); } catch (e) { return []; } };

  /* ------------------------------------------------------------ historikk + statistikk (bare når fanen vises) */
  function energyIds(hass) {
    if (M.energiPrefs) M.energiPrefs(hass);
    const S = M.energiSources ? M.energiSources(hass, {}) : null;
    return S ? { grid: S.grid_in || [], solar: S.solar || [], cost: S.cost_in || [], devices: S.devices || [] } : { grid: [], solar: [], cost: [], devices: [] };
  }
  function load(hass, card, tab) {
    const D = collect(hass, card); if (!D || !hass.callWS) return;
    const up = () => { if (card && card.isConnected) card.update(); };
    const now = new Date(), t0 = day0(now), y0 = new Date(t0); y0.setDate(y0.getDate() - 1);
    const m0 = new Date(now.getFullYear(), now.getMonth(), 1);
    // 24 t historikk (snitt inne, fukt, CO₂, ute, ventilasjon)
    const hIds = [...D.tempIds, ...D.humIds, D.co2Id, D.outId].filter(Boolean);
    if (hIds.length) fetchOnce('h24|' + hIds.join(','), () => M.history(hass, hIds, 24), up);
    if (tab === 'oversikt' || tab === 'energi') {
      const E = energyIds(hass);
      const ids = [...E.grid, ...E.solar, ...E.cost];
      if (ids.length) {
        fetchOnce('e-today|' + ids.join(','), () => stats(hass, ids, t0, new Date(t0.getTime() + 86400000), 'hour', ['change'], { energy: 'kWh' }), up);
        fetchOnce('e-yest|' + ids.join(','), () => stats(hass, ids, y0, t0, 'day', ['change'], { energy: 'kWh' }), up);
        fetchOnce('e-month|' + ids.join(','), () => stats(hass, ids, m0, new Date(now.getTime() + 3600000), 'month', ['change'], { energy: 'kWh' }), up);
      }
      const dv = E.devices.map((d) => d.id);
      if (dv.length && tab === 'energi') fetchOnce('e-dev|' + dv.join(','), () => stats(hass, dv, y0, new Date(now.getTime() + 3600000), 'day', ['change'], { energy: 'kWh' }), up);
      if (D.mainPow && tab === 'energi') fetchOnce('p-max|' + D.mainPow, () => stats(hass, [D.mainPow], t0, new Date(now.getTime() + 3600000), 'hour', ['mean'], null), up);
    }
    if (tab === 'sikkerhet' && D.motion.length && M.stateHistory) fetchOnce('motion|' + D.motion.join(','), () => M.stateHistory(hass, D.motion, Date.now() - 86400000, Date.now()), up);
    if (tab === 'klima' && D.fanId) fetchOnce('fan|' + D.fanId, () => M.stateHistory ? M.stateHistory(hass, [D.fanId], Date.now() - 86400000, Date.now()) : null, up);
  }
  // Serier fra hurtigbufferen (samplet), tomme når ikke hentet
  function series(hass, card) {
    const D = collect(hass, card); if (!D) return {};
    const hIds = [...D.tempIds, ...D.humIds, D.co2Id, D.outId].filter(Boolean), h = cached('h24|' + hIds.join(',')) || {};
    const sm = (id, n) => (h[id] && h[id].length ? M.sample(h[id], n, 24) : []);
    const avgS = (ids, n) => { const L = ids.map((id) => sm(id, n)).filter((x) => x.length); return L.length ? Array.from({ length: n }, (_, i) => avg(L.map((x) => x[i]))) : []; };
    const E = energyIds(hass), eT = cached('e-today|' + [...E.grid, ...E.solar, ...E.cost].join(',')) || {}, eY = cached('e-yest|' + [...E.grid, ...E.solar, ...E.cost].join(',')) || {}, eM = cached('e-month|' + [...E.grid, ...E.solar, ...E.cost].join(',')) || {};
    const hourly = (ids, R) => { const out = Array(24).fill(null); ids.forEach((id) => (R[id] || []).forEach((r) => { const hh = new Date(r.start).getHours(); if (r.change != null) out[hh] = (out[hh] || 0) + r.change; })); return out; };
    const total = (ids, R) => { let t = null; ids.forEach((id) => (R[id] || []).forEach((r) => { if (r.change != null) t = (t || 0) + r.change; })); return t; };
    const kwhH = hourly(E.grid, eT), solarH = hourly(E.solar, eT), costT = E.cost.length ? total(E.cost, eT) : null;
    const today = E.grid.length && Object.keys(eT).length ? sum(kwhH) : null;
    const yest = E.grid.length ? total(E.grid, eY) : null;
    const month = E.grid.length ? total(E.grid, eM) : null, monthCost = E.cost.length ? total(E.cost, eM) : null;
    const solarT = E.solar.length && Object.keys(eT).length ? sum(solarH) : null;
    // kostnad i dag: kostnadssensor, ellers kWh per time × timepris
    let cost = costT;
    if (cost == null && today != null && D.P && D.P.today) cost = kwhH.reduce((t, v, i) => t + (v || 0) * (D.P.today[i] != null ? D.P.today[i] : 0), 0);
    const dv = cached('e-dev|' + E.devices.map((d) => d.id).join(',')) || {};
    const top = E.devices.map((d) => { const L = (dv[d.id] || []).filter((r) => new Date(r.start) >= day0(new Date())); return { n: d.name || name(hass, d.id), v: sum(L.map((r) => r.change)) }; }).filter((x) => x.v > 0).sort((a, b) => b.v - a.v).slice(0, 4);
    const pm = cached('p-max|' + D.mainPow) || {}, pmL = (pm[D.mainPow] || []).map((r) => r.mean).filter((x) => x != null);
    const pu = D.mainPow && hass.states[D.mainPow] ? String(hass.states[D.mainPow].attributes.unit_of_measurement || 'W') : 'W';
    const peakKw = pmL.length ? Math.max(...pmL) / (/kw/i.test(pu) ? 1 : 1000) : null;
    // bevegelse per time (antall «på»)
    const mh = cached('motion|' + D.motion.join(',')) || null, mot = Array(24).fill(0);
    let motN = null;
    if (mh) { motN = 0; const s0 = Date.now() - 86400000; Object.values(mh).forEach((L) => { let prev = null; L.forEach((p) => { if (p.s === 'on' && prev !== 'on') { const i = Math.min(23, Math.max(0, Math.floor((p.t - s0) / 3600000))); mot[i]++; motN++; } prev = p.s; }); }); }
    const fh = D.fanId ? cached('fan|' + D.fanId) : null;
    return {
      temp24: avgS(D.tempIds, 26), hum28: avgS(D.humIds, 28), co2: D.co2Id ? sm(D.co2Id, 22) : [], inne24: avgS(D.tempIds, 24), ute24: D.outId ? sm(D.outId, 24) : [],
      kwhH, solarH, today, yest, cost, month, monthCost, solarT, top, peakKw, mot: mh ? mot : null, motN, score: scoreHist(), fanHist: fh && fh[D.fanId] ? fh[D.fanId].length : null,
    };
  }

  /* ------------------------------------------------------------ Analyse (Tilpass → «Analyser» / «I dag») */
  // Per fane: [navn, enhet, statistikk-IDer, 'sum'|'snitt', farge]
  function anaDefs(hass, card, tab) {
    const D = collect(hass, card), E = energyIds(hass), C = M.C || {};
    const PK = C.pink || '#f285c9', OR = C.orange || '#f2b573', GR = C.green || '#66d19e', BL = C.blue || '#73b9f2'; // ki-hex-ok (fallback for aksentene)
    const T = {
      oversikt: [['Temperatur', '°C', D.tempIds, 'snitt', PK], ['Strømforbruk', 'kWh', E.grid, 'sum', OR], ['Luftfuktighet', '%', D.humIds, 'snitt', BL]],
      klima: [['Temperatur inne', '°C', D.tempIds, 'snitt', PK], ['Temperatur ute', '°C', D.outId ? [D.outId] : [], 'snitt', BL], ['Luftfuktighet', '%', D.humIds, 'snitt', BL]],
      energi: [['Forbruk', 'kWh', E.grid, 'sum', PK], ['Kostnad', (D.P && D.P.cur) || 'kr', E.cost, 'sum', OR], ['Solceller', 'kWh', E.solar, 'sum', GR]],
      sikkerhet: [['Luftkvalitet (CO₂)', 'ppm', D.co2Id ? [D.co2Id] : [], 'snitt', BL], ['Temperatur inne', '°C', D.tempIds, 'snitt', PK], ['Strømforbruk', 'kWh', E.grid, 'sum', OR]],
      enheter: [['Batteri (snitt)', '%', D.batt.slice(0, 12).map((b) => b.id), 'snitt', GR], ['Strømforbruk', 'kWh', E.grid, 'sum', OR], ['Temperatur inne', '°C', D.tempIds, 'snitt', PK]],
      apper: [['Temperatur inne', '°C', D.tempIds, 'snitt', PK], ['Strømforbruk', 'kWh', E.grid, 'sum', OR], ['Luftfuktighet', '%', D.humIds, 'snitt', BL]],
    };
    return (T[tab] || T.oversikt).filter((x) => x[2].length);
  }
  function analyse(hass, card, tab, nDays) {
    const defs = anaDefs(hass, card, tab), now = new Date(), t0 = day0(now), start = new Date(t0); start.setDate(start.getDate() - (nDays - 1));
    const sumIds = [...new Set(defs.filter((d) => d[3] === 'sum').flatMap((d) => d[2]))], avgIds = [...new Set(defs.filter((d) => d[3] === 'snitt').flatMap((d) => d[2]))];
    const key = 'ana|' + nDays + '|' + sumIds.join(',') + '|' + avgIds.join(',');
    fetchOnce(key, () => Promise.all([stats(hass, sumIds, start, new Date(t0.getTime() + 86400000), 'day', ['change'], { energy: 'kWh' }), stats(hass, avgIds, start, new Date(t0.getTime() + 86400000), 'day', ['mean'], null)]).then(([a, b]) => ({ ...(a || {}), ...(b || {}) })), () => { if (card && card.isConnected) card.update(); });
    const R = cached(key) || null;
    return defs.map(([n, u, ids, kind, c]) => {
      const days = Array(nDays).fill(null), cnt = Array(nDays).fill(0);
      if (R) ids.forEach((id) => (R[id] || []).forEach((r) => { const i = Math.round((day0(new Date(r.start)) - start) / 86400000); if (i < 0 || i >= nDays) return; const v = kind === 'sum' ? r.change : r.mean; if (v == null) return; days[i] = (days[i] || 0) + v; cnt[i]++; }));
      if (kind === 'snitt') days.forEach((v, i) => { if (v != null) days[i] = v / cnt[i]; });
      let vals = days;
      if (nDays > 90) { vals = []; for (let w = 0; w < 52; w++) { const seg = days.slice(w * 7, w * 7 + 7).filter((x) => x != null); vals.push(seg.length ? (kind === 'sum' ? sum(seg) : avg(seg)) : null); } }
      const have = days.filter((x) => x != null), tot = sum(have);
      return { n, u, kind, c, vals, loaded: !!R, sum: have.length ? (kind === 'sum' ? tot : tot / have.length) : null, avg: have.length ? tot / (kind === 'sum' ? nDays : have.length) : null };
    });
  }

  M.pcData = { collect, load, series, analyse, num, isOn, CTRL, cacheClear: () => { Object.keys(H).forEach((k) => delete H[k]); MEMO = null; } };
})();
