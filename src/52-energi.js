/* msh-energi-card · Energi-popup #energi (fiks 21.1, 21.3, 21.5, 21.9, 21.10 – promptets «ki-energy-card»).
 * Fasit «Energi.dc.html» finnes ikke i repoet: bygget etter prompt-teksten. Funksjons-popup (Mal A), ingen toppkort.
 * Seksjoner (config.order, standard): house · tiles · power · price · top · water. Periode-raden (I dag · Uke · Måned · År,
 *   ‹ ›, tannhjul 44 px ytterst til høyre – Bubble Cards × ligger øverst til høyre) står fast øverst (23.2), ikke en del av order; 14 px til første seksjon.
 * Husscenen: M.energiHus.html(...) fra src/52-energi-hus.js (egen fil, laget separat); mangler den → enkel plassholder.
 * Data (21.3): HAs Energi-oppsett. energy/get_prefs (+ energy/info → cost_sensors) gir statistikk-IDene; tall fra
 *   recorder/statistics_during_period (types ['change'], period hour | day | month, units kWh/L). Hjem = import + sol +
 *   batteri ut − eksport − batteri inn (samme formel som HA). Effekt nå = strømmålerens effektsensor (enhet med
 *   import-statistikken) eller KI Rom sensor.hele_huset_effekt. Dagsgraf: 5-minutters middel (15-min-bøtter), ellers historikk.
 *   Hentes bare når popupen er åpen, mellomlagres 5 min per periode (fallgruve 8). Aldri mock: mangler → «–».
 * Strømpris (21.9/21.10): prissensor = Kilder → Strømpris (overstyring) → entity_energy_price fra Energi → felles
 *   MSH.powerPrice-sensor (15-strompris-kilde.js, som også gir Nord Pool/Tibber/Strømpris-serier for i dag/i morgen).
 * Config (21.5):
 *   order: [house, tiles, power, price, top, water], hidden: { top: true }, house_style: enebolig|rekkehus|gard|sjo,
 *   labels: { ev, grid, home }, flow: true, custom_image, targets: { ev: 'x,y', grid, home }, period: dag|uke|mnd|aar,
 *   day_chart: linje|soyler, top_n: 3|5|8|0 (0 = alle), show_cost: true, water_price (kr/L),
 *   sources: { grid_in, grid_out, price, ev, solar, battery, water, power } (bare overstyringer),
 *   tiles: [{ id, name, icon, entity, color, hidden }], tiles_removed: [id] (innebygde snarveier brukeren har slettet)
 */
(function () {
  const M = window.MSH;
  if (!M || customElements.get('msh-energi-card')) return;
  const esc = M.esc, C = M.C;
  const HASH = '#energi';
  const CYAN = 'var(--cyan-color, #4dd0e1)';
  // Fiks 35 (tema): aksent som tekst mørknes i lys modus (AT), tone-bakgrunner .12→.18 (TONE), gjennomsiktig hvit/svart
  // etter regel 4/3 (WA/KA). Grafer: linje/fyll i aksent, markør --ki-text-2, tomme spor --ki-surface-3. Mørk = som før.
  const TH = M.theme || {};
  const AT = (c) => (TH.accentText ? TH.accentText(c) : c);
  const TONE = (c, a) => (TH.tone ? TH.tone(c, undefined, a).bg : M.alpha(c, a));
  const WA = (a) => (TH.whiteA ? TH.whiteA(a) : `rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(${a}*var(--ki-wa-k,1)),var(--ki-wa-max,1)))`);
  const SECS = [['house', 'Huset'], ['tiles', 'Snarveier'], ['power', 'Strøm'], ['price', 'Strømpriser'], ['top', 'Toppforbrukere'], ['water', 'Vann']];
  const SECL = Object.fromEntries(SECS);
  const PERIODS = [['dag', 'I dag'], ['uke', 'Uke'], ['mnd', 'Måned'], ['aar', 'År']];
  const STYLES = [['enebolig', 'Enebolig'], ['rekkehus', 'Rekkehus'], ['gard', 'Gård på landet'], ['sjo', 'Ved sjøen']];
  const DEF_TILES = [
    { id: 'meter', name: 'Strømmåler', icon: 'mdi:flash', color: 'var(--blue, #73b9f2)' },
    { id: 'price', name: 'Strømpris', icon: 'mdi:cash', color: 'var(--yellow, #f2d26f)' },
    { id: 'car', name: 'Bil', icon: 'mdi:car-electric', color: 'var(--green, #66d19e)' },
    { id: 'charger', name: 'Elbillader', icon: 'mdi:ev-station', color: 'var(--orange, #f2b573)' },
    { id: 'vvb', name: 'Varmtvann', icon: 'mdi:water-boiler', color: 'var(--red, #f28073)' },
  ];
  const DEF = { order: SECS.map((s) => s[0]), house_style: 'enebolig', flow: true, period: 'dag', day_chart: 'linje', top_n: 3, show_cost: true };
  // Kilder (Tilpass energi → Kilder): nøkkel, navn, ikon, domener for overstyring
  const SRC = [
    ['grid_in', 'Nett import', 'mdi:transmission-tower-import', ['sensor']],
    ['grid_out', 'Nett eksport', 'mdi:transmission-tower-export', ['sensor']],
    ['price', 'Strømpris', 'mdi:cash', ['sensor', 'input_number']],
    ['ev', 'Elbillader', 'mdi:ev-station', ['sensor']],
    ['solar', 'Sol', 'mdi:solar-power', ['sensor']],
    ['battery', 'Batteri', 'mdi:home-battery', ['sensor']],
    ['water', 'Vann', 'mdi:water', ['sensor']],
    ['power', 'Live effekt', 'mdi:flash', ['sensor']],
  ];
  const LEVELS = [['Lav', C.green], ['Normal', C.yellow], ['Høy', C.orange], ['Svært høy', C.red]];
  const EV_RX = /charger|lader|(^|[_\s.])ev([_\s]|$)|elbil|easee|zaptec|wallbox|go-?e|ctek|zappi/i;
  const CAR_RX = /tesla|(^|_)bil(_|$)|(^|_)car(_|$)|vehicle|kjoretoy|volvo|polestar|(^|_)kia(_|$)|hyundai|ioniq|(^|_)leaf(_|$)|audi|bmw|mercedes|skoda|enyaq|volkswagen|(^|_)id_?[3457](_|$)|peugeot|toyota|nissan|renault|zoe/i;
  const VVB_RX = /varmtvann|vvb|bereder|water_?heater|hot_?water|varmtvannstank/i;
  const TTL = 300000;
  const uniq = (a) => [...new Set(a.filter(Boolean))];
  const sum = (a) => (a || []).reduce((s, v) => s + (v || 0), 0);
  const any = (a) => (a || []).some((v) => v != null);
  const avgOf = (a) => { const v = (a || []).filter((x) => x != null); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
  const fKwh = (v) => (v == null ? '–' : M.nf(v, Math.abs(v) >= 100 ? 0 : 1));
  const fKr = (v) => (v == null ? '–' : M.nf(v, Math.abs(v) >= 100 ? 0 : 2) + ' kr');
  const fW = (w) => (w == null ? '–' : Math.abs(w) >= 1000 ? M.nf(w / 1000, 1) + ' kW' : Math.round(w) + ' W');
  const fL = (v) => (v == null ? '–' : M.nf(v, v >= 100 ? 0 : 1));
  const MND = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des'];
  const MND_L = ['januar', 'februar', 'mars', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'desember'];
  const DAG = ['søn', 'man', 'tir', 'ons', 'tor', 'fre', 'lør'];

  /* ------------------------------------------------------------ Energi-oppsettet (energy/get_prefs + energy/info) */
  const PR = { data: undefined, info: null, busy: false, t: 0 };
  // undefined = ikke hentet ennå · null = Energi er ikke satt opp. Hentes på nytt etter 5 min (bare når noen spør).
  M.energiPrefs = function (hass, force) {
    if (!hass || !hass.callWS) return PR.data;
    if (!PR.busy && (force || Date.now() - PR.t > TTL)) {
      PR.busy = true;
      Promise.all([hass.callWS({ type: 'energy/get_prefs' }).catch(() => null), hass.callWS({ type: 'energy/info' }).catch(() => null)])
        .then(([p, i]) => {
          const ok = p && ((Array.isArray(p.energy_sources) && p.energy_sources.length) || (Array.isArray(p.device_consumption) && p.device_consumption.length));
          PR.data = ok ? p : null; PR.info = i || null; PR.t = Date.now(); PR.busy = false;
          window.dispatchEvent(new CustomEvent('msh-energi-prefs'));
        });
    }
    return PR.data;
  };
  const regOf = (hass, id) => (hass && hass.entities && hass.entities[id]) || null;
  const devOf = (hass, id) => { const e = regOf(hass, id); return e && e.device_id; };
  // Sensor på samme enhet som id med gitt device_class (f.eks. effekt ved siden av energimåleren)
  const sibling = (hass, id, dc) => {
    const d = devOf(hass, id);
    if (!d || !hass.entities) return null;
    return Object.keys(hass.entities).find((x) => x !== id && x.startsWith('sensor.') && hass.entities[x].device_id === d && hass.states[x] && hass.states[x].attributes.device_class === dc) || null;
  };
  const powerW = (hass, id) => {
    const s = id && hass && hass.states[id];
    if (!s || !M.isNum(s.state)) return null;
    const u = String(s.attributes.unit_of_measurement || 'W');
    return Number(s.state) * (/^kW$/i.test(u) ? 1000 : /^MW$/i.test(u) ? 1e6 : 1);
  };
  // Alle kilder, med overstyringer (config.sources) og merke per kilde: energi | auto | overstyrt | mangler
  function sourcesOf(hass, c) {
    const P = PR.data || null, ov = (c && c.sources) || {}, info = PR.info || {};
    const es = (P && P.energy_sources) || [];
    const grid = es.filter((s) => s.type === 'grid');
    const from = grid.flatMap((g) => (Array.isArray(g.flow_from) ? g.flow_from : g.stat_energy_from ? [g] : []));
    const to = grid.flatMap((g) => (Array.isArray(g.flow_to) ? g.flow_to : g.stat_energy_to ? [g] : []));
    const cs = info.cost_sensors || {};
    const bat = es.filter((s) => s.type === 'battery'), wat = es.filter((s) => s.type === 'water');
    const devs = ((P && P.device_consumption) || []).filter((d) => d && d.stat_consumption).map((d) => ({ id: d.stat_consumption, name: d.name || null, parent: d.included_in_stat || null }));
    const E = {
      grid_in: from.map((f) => f.stat_energy_from).filter(Boolean),
      grid_out: to.map((f) => f.stat_energy_to).filter(Boolean),
      solar: es.filter((s) => s.type === 'solar').map((s) => s.stat_energy_from).filter(Boolean),
      battery: bat.map((b) => b.stat_energy_from).filter(Boolean),
      water: wat.map((w) => w.stat_energy_from).filter(Boolean),
    };
    const R = {
      prefs: P, loaded: PR.data !== undefined, devices: devs, from: {}, auto: {},
      cost_in: from.map((f) => f.stat_cost || cs[f.stat_energy_from]).filter(Boolean),
      batt_in: bat.map((b) => b.stat_energy_to).filter(Boolean),
      water_cost: wat.map((w) => w.stat_cost || cs[w.stat_energy_from]).filter(Boolean),
    };
    ['grid_in', 'grid_out', 'solar', 'battery', 'water'].forEach((k) => {
      R.auto[k] = E[k].join(', ') || null;
      R[k] = ov[k] ? [ov[k]] : E[k];
      R.from[k] = ov[k] ? 'overstyrt' : E[k].length ? 'energi' : 'mangler';
    });
    if (ov.grid_in) R.cost_in = []; // kostnaden i Energi hører til den opprinnelige måleren
    if (ov.water) R.water_cost = [];
    R.batt_out = R.battery;
    // Elbillader: enheten i device_consumption som ligner på en lader (21.3)
    const evA = devs.find((d) => EV_RX.test(d.id + ' ' + (d.name || '') + ' ' + M.name(hass, d.id)));
    R.auto.ev = evA ? evA.id : null;
    R.ev = ov.ev || R.auto.ev;
    R.from.ev = ov.ev ? 'overstyrt' : R.ev ? 'energi' : 'mangler';
    // Strømpris: Energi (entity_energy_price) → felles prissensor (MSH.powerPrice)
    const pE = (from.find((f) => f.entity_energy_price) || {}).entity_energy_price || null;
    let pA = null; try { pA = !pE && M.powerPrice ? M.powerPrice(hass).entity : null; } catch (e) { /* */ }
    R.auto.price = pE || pA;
    R.price = ov.price || R.auto.price;
    R.from.price = ov.price ? 'overstyrt' : pE ? 'energi' : pA ? 'auto' : 'mangler';
    // Live effekt: effektsensor på strømmåleren (samme enhet som import) → KI Rom hele_huset_effekt
    const pw = (E.grid_in[0] && sibling(hass, E.grid_in[0], 'power')) || (M.kiRomId && M.kiRomId(hass, null, 'effekt')) || null;
    R.auto.power = pw;
    R.power = ov.power || pw;
    R.from.power = ov.power ? 'overstyrt' : pw ? 'auto' : 'mangler';
    return R;
  }
  M.energiSources = sourcesOf;

  /* ------------------------------------------------------------ snarveier (status-fliser, 21.1/21.9) */
  function tilesOf(c) {
    const rm = new Set(Array.isArray(c.tiles_removed) ? c.tiles_removed : []);
    if (!Array.isArray(c.tiles)) return DEF_TILES.filter((t) => !rm.has(t.id)).map((t) => ({ ...t }));
    const L = c.tiles.filter((t) => t && t.id).map((t) => ({ ...(DEF_TILES.find((d) => d.id === t.id) || {}), ...t }));
    // 21.9: eldre config uten Strømpris-kortet → legg det inn etter Strømmåler (med mindre brukeren har slettet det)
    if (!L.some((t) => t.id === 'price') && !rm.has('price')) { const i = L.findIndex((t) => t.id === 'meter'); L.splice(i < 0 ? 0 : i + 1, 0, { ...DEF_TILES[1] }); }
    return L;
  }
  function tileAuto(hass, R, id) {
    if (!hass) return null;
    if (id === 'meter') return R && R.power;
    if (id === 'price') return R && R.price;
    if (id === 'car') return M.all(hass, 'sensor', (s, x) => s.attributes.device_class === 'battery' && CAR_RX.test(x + ' ' + (s.attributes.friendly_name || '')))[0] || null;
    if (id === 'charger') {
      const s = R && R.ev && sibling(hass, R.ev, 'power');
      return s || M.all(hass, 'sensor', (st, x) => st.attributes.device_class === 'power' && EV_RX.test(x + ' ' + (st.attributes.friendly_name || '')))[0] || null;
    }
    if (id === 'vvb') return M.all(hass, 'sensor', (s, x) => s.attributes.device_class === 'power' && VVB_RX.test(x + ' ' + (s.attributes.friendly_name || '')))[0] || M.all(hass, 'water_heater')[0] || null;
    return null;
  }
  const carPlug = (hass, bat) => {
    const d = devOf(hass, bat);
    const ids = d ? Object.keys(hass.entities || {}).filter((x) => x.startsWith('binary_sensor.') && hass.entities[x].device_id === d && hass.states[x]) : [];
    return ids.find((x) => hass.states[x].attributes.device_class === 'plug' || /plug|kabel|tilkobl|connected|charg/i.test(x)) || null;
  };

  /* ------------------------------------------------------------ strømpris */
  function priceOf(hass, ent, card) {
    if (!ent || !hass || !hass.states[ent] || !M.powerPrice) return null;
    let P = null;
    try { P = M.powerPrice(hass, M.powerPriceCfg(null, { spot_entity: ent, se_entity: ent, mode: 'spot', unit: 'kr', source: '' }), card); } catch (e) { return null; }
    const st = hass.states[ent], lvlAttr = st.attributes.price_level || st.attributes.level || null;
    const avg = avgOf(P.today);
    return { P, ent, now: P.now, avg, level: levelOf(P.now, avg, lvlAttr) };
  }
  function levelOf(v, avg, attr) {
    const t = String(attr || '').toUpperCase();
    if (t === 'VERY_CHEAP' || t === 'CHEAP') return 0;
    if (t === 'NORMAL') return 1;
    if (t === 'EXPENSIVE') return 2;
    if (t === 'VERY_EXPENSIVE') return 3;
    if (v == null || !avg) return null;
    const r = v / avg;
    return r < 0.85 ? 0 : r < 1.15 ? 1 : r < 1.4 ? 2 : 3;
  }

  /* ------------------------------------------------------------ perioder og statistikk */
  function rangeOf(per, off) {
    const n0 = new Date(), d0 = new Date(n0.getFullYear(), n0.getMonth(), n0.getDate());
    let s, e, p, n, idx, lab, title;
    if (per === 'uke') {
      const wd = (d0.getDay() + 6) % 7;
      s = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() - wd + 7 * off); e = new Date(s.getFullYear(), s.getMonth(), s.getDate() + 7);
      p = 'day'; n = 7;
      idx = (t) => Math.round((new Date(new Date(t).getFullYear(), new Date(t).getMonth(), new Date(t).getDate()) - s) / 86400000);
      lab = (i) => { const d = new Date(s.getFullYear(), s.getMonth(), s.getDate() + i); return `${DAG[d.getDay()]} ${d.getDate()}.`; };
      const l = new Date(e.getTime() - 86400000), th = new Date(s.getFullYear(), s.getMonth(), s.getDate() + 3), y1 = new Date(th.getFullYear(), 0, 1);
      title = `Uke ${Math.ceil(((th - y1) / 86400000 + 1) / 7)} · ${s.getDate()}.${s.getMonth() !== l.getMonth() ? ' ' + MND[s.getMonth()] : ''}–${l.getDate()}. ${MND[l.getMonth()]}`;
    } else if (per === 'mnd') {
      s = new Date(n0.getFullYear(), n0.getMonth() + off, 1); e = new Date(s.getFullYear(), s.getMonth() + 1, 1);
      p = 'day'; n = Math.round((e - s) / 86400000);
      idx = (t) => { const d = new Date(t); return d.getDate() - 1; };
      lab = (i) => `${i + 1}. ${MND[s.getMonth()]}`;
      title = `${MND_L[s.getMonth()][0].toUpperCase()}${MND_L[s.getMonth()].slice(1)} ${s.getFullYear()}`;
    } else if (per === 'aar') {
      s = new Date(n0.getFullYear() + off, 0, 1); e = new Date(s.getFullYear() + 1, 0, 1);
      p = 'month'; n = 12;
      idx = (t) => new Date(t).getMonth();
      lab = (i) => `${MND_L[i]} ${s.getFullYear()}`;
      title = String(s.getFullYear());
    } else {
      s = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() + off); e = new Date(s.getFullYear(), s.getMonth(), s.getDate() + 1);
      p = 'hour'; n = 24;
      idx = (t) => new Date(t).getHours();
      lab = (i) => `kl ${M.pad(i)}–${M.pad((i + 1) % 24)}`;
      title = off === 0 ? 'I dag' : off === -1 ? 'I går' : `${DAG[s.getDay()]} ${s.getDate()}. ${MND[s.getMonth()]}`;
    }
    return { s, e, p, n, idx, lab, title, cur: off === 0 };
  }
  const tOf = (r) => (typeof r.start === 'number' ? r.start : Date.parse(r.start));
  const CACHE = new Map();
  async function loadData(hass, R, c, per, off) {
    const rg = rangeOf(per, off);
    const devIds = R.devices.map((d) => d.id);
    const ids = uniq([...R.grid_in, ...R.grid_out, ...R.cost_in, ...R.solar, ...R.batt_out, ...R.batt_in, ...R.water, ...R.water_cost, ...devIds, R.ev]);
    const st = ids.length ? (await hass.callWS({ type: 'recorder/statistics_during_period', start_time: rg.s.toISOString(), end_time: rg.e.toISOString(), statistic_ids: ids, period: rg.p, types: ['change'], units: { energy: 'kWh', volume: 'L' } }).catch(() => null)) || {} : {};
    const ser = (list) => {
      const out = Array(rg.n).fill(null);
      list.forEach((id) => (st[id] || []).forEach((r) => { const i = rg.idx(tOf(r)); if (i < 0 || i >= rg.n || r.change == null) return; out[i] = (out[i] || 0) + Number(r.change); }));
      return out;
    };
    const imp = ser(R.grid_in), exp = ser(R.grid_out), sol = ser(R.solar), bo = ser(R.batt_out), bi = ser(R.batt_in);
    const home = imp.map((v, i) => ([v, exp[i], sol[i], bo[i], bi[i]].every((x) => x == null) ? null : Math.max(0, (v || 0) + (sol[i] || 0) + (bo[i] || 0) - (exp[i] || 0) - (bi[i] || 0))));
    let cost = R.cost_in.length ? ser(R.cost_in) : null;
    if (cost && !any(cost)) cost = null;
    // Uten kostnadsstatistikk: import × timepris (bare i dag – prissensoren har ikke eldre timepriser)
    if (!cost && per === 'dag' && off === 0 && R.price) {
      const pr = priceOf(hass, R.price);
      if (pr && any(pr.P.today)) cost = imp.map((v, i) => (v == null || pr.P.today[i] == null ? null : v * pr.P.today[i]));
    }
    const devs = R.devices.map((d) => ({ ...d, kwh: sum(ser([d.id])), has: any(ser([d.id])) })).filter((d) => d.has);
    const water = ser(R.water);
    let wcost = R.water_cost.length ? ser(R.water_cost) : null;
    if (wcost && !any(wcost)) wcost = null;
    if (!wcost && Number(c.water_price) > 0) wcost = water.map((v) => (v == null ? null : v * Number(c.water_price)));
    const ev = R.ev ? sum(ser([R.ev])) : null;
    // Dagsgraf: effekt (kW) i 15-minuttersbøtter – 5-minutters middel fra statistikken, ellers historikk
    let pw = null;
    if (per === 'dag' && R.power) {
      const bins = Array.from({ length: 96 }, () => [0, 0]);
      const put = (t, kw) => { const i = Math.floor((t - rg.s.getTime()) / 900000); if (i >= 0 && i < 96 && kw != null && !isNaN(kw)) { bins[i][0] += kw; bins[i][1]++; } };
      const ps = (await hass.callWS({ type: 'recorder/statistics_during_period', start_time: rg.s.toISOString(), end_time: rg.e.toISOString(), statistic_ids: [R.power], period: '5minute', types: ['mean'], units: { power: 'kW' } }).catch(() => null)) || {};
      (ps[R.power] || []).forEach((r) => put(tOf(r), r.mean != null ? Number(r.mean) : null));
      if (!bins.some((b) => b[1])) {
        const hh = (await hass.callWS({ type: 'history/history_during_period', start_time: rg.s.toISOString(), end_time: rg.e.toISOString(), entity_ids: [R.power], minimal_response: true, no_attributes: true, significant_changes_only: false }).catch(() => null)) || {};
        const s = hass.states[R.power], k = /^kW$/i.test(String((s && s.attributes.unit_of_measurement) || 'W')) ? 1 : 0.001;
        const rows = (hh[R.power] || []).map((r) => [(r.lu || r.last_updated || 0) * (r.lu ? 1000 : 1), Number(r.s != null ? r.s : r.state)]).filter((r) => !isNaN(r[1]));
        rows.forEach(([t, v]) => put(t, v * k));
        // fyll bøtter uten målinger med forrige verdi (sensoren endres bare ved endring), fram til nå
        let last = null; const nowI = Math.floor((Date.now() - rg.s.getTime()) / 900000);
        bins.forEach((b, i) => { if (b[1]) last = b[0] / b[1]; else if (last != null && i <= nowI) { b[0] = last; b[1] = 1; } });
      }
      if (bins.some((b) => b[1])) pw = bins.map((b) => (b[1] ? b[0] / b[1] : null));
    }
    return { rg, imp, exp, sol, bo, bi, home, cost, devs, water, wcost, ev, pw, t: Date.now() };
  }

  /* ------------------------------------------------------------ grafer */
  // Graf i SVG (viewBox W×H, preserveAspectRatio none) + markører i HTML (sirkler blir ikke strukket).
  // o: { kind: 'area'|'bars', color, h, sel, now, ticks: [[i, tekst]] }
  function plotHTML(key, vals, o) {
    const W = 300, H = o.h || 120, n = vals.length || 1;
    const mx = Math.max(0, ...vals.filter((v) => v != null));
    const top = mx > 0 ? mx * 1.12 : 1;
    const y = (v) => H - (Math.max(0, v) / top) * (H - 2);
    const x = (i) => ((i + 0.5) / n) * W;
    let svg = '', marks = '';
    if (o.kind === 'area') {
      let last = -1; vals.forEach((v, i) => { if (v != null) last = i; });
      const pts = []; for (let i = 0; i <= last; i++) pts.push([x(i), y(vals[i] != null ? vals[i] : 0)]);
      if (pts.length) {
        const line = 'M' + pts.map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' L');
        svg += `<path d="${line} L${pts[pts.length - 1][0].toFixed(1)},${H} L${pts[0][0].toFixed(1)},${H} Z" fill="${o.color}" fill-opacity=".2"/><path d="${line}" fill="none" stroke="${o.color}" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>`;
        if (o.now != null && o.now <= last) {
          const L = ((o.now + 0.5) / n) * 100, T = (y(vals[o.now] || 0) / H) * 100;
          marks += `<i class="vl dash" style="left:${L.toFixed(2)}%"></i><i class="dot ring" style="left:${L.toFixed(2)}%;top:${T.toFixed(2)}%;border-color:${o.color}"></i>`;
        }
      }
    } else {
      const bw = (W / n) * (n > 20 ? 0.64 : 0.56);
      vals.forEach((v, i) => {
        if (v == null) return;
        const hh = Math.max(v > 0 ? 2 : 0, (Math.max(0, v) / top) * (H - 2));
        svg += `<rect x="${(x(i) - bw / 2).toFixed(1)}" y="${(H - hh).toFixed(1)}" width="${bw.toFixed(1)}" height="${hh.toFixed(1)}" fill="${o.color}" fill-opacity="${o.sel === i ? 1 : o.sel != null ? 0.4 : o.now === i ? 1 : 0.78}"/>`;
      });
    }
    if (o.sel != null && vals[o.sel] != null) {
      const L = ((o.sel + 0.5) / n) * 100;
      marks += `<i class="vl" style="left:${L.toFixed(2)}%"></i>${o.kind === 'area' ? `<i class="dot" style="left:${L.toFixed(2)}%;top:${((y(vals[o.sel]) / H) * 100).toFixed(2)}%;background:${o.color}"></i>` : ''}`;
    }
    const ticks = (o.ticks || []).map(([i, t]) => `<span style="left:${((i / n) * 100).toFixed(2)}%">${esc(t)}</span>`).join('');
    return `<div class="plot" data-plot="${key}" data-n="${n}" style="height:${H}px"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">${svg}</svg>${marks}</div>${ticks ? `<div class="xax">${ticks}</div>` : ''}`;
  }
  const ticksOf = (rg, n) => {
    if (n === 96) return [[0, '00'], [24, '06'], [48, '12'], [72, '18'], [96, '24']];
    if (rg.p === 'hour') return [[0, '00'], [6, '06'], [12, '12'], [18, '18'], [24, '24']];
    if (rg.n === 7) return Array.from({ length: 7 }, (_, i) => [i + 0.5, rg.lab(i).split(' ')[0]]);
    if (rg.n === 12) return [0, 3, 6, 9].map((i) => [i + 0.5, MND[i]]);
    return [0, 7, 14, 21, 28].filter((i) => i < rg.n).map((i) => [i + 0.5, String(i + 1)]);
  };

  // Strømpriser: trappekurve med vertikal fargeovergang etter nivå (userSpaceOnUse), markert inneværende time
  function priceChartHTML(vals, avg, o) {
    const W = 300, H = 180, n = vals.length || 24;
    const V = vals.filter((v) => v != null);
    if (!V.length) return `<div class="plot pplot empty-plot" data-plot="price" data-n="${n}" style="height:${H}px"><span>–</span></div>`;
    const mx = Math.max(...V), mn = Math.min(0, ...V), top = mx > 0 ? mx * 1.12 : 1, rng = top - mn || 1;
    const y = (v) => H - ((v - mn) / rng) * (H - 4);
    const x = (i) => (i / n) * W;
    let d = '';
    vals.forEach((v, i) => { if (v == null) return; const yy = y(v).toFixed(1); d += d ? ` H${x(i).toFixed(1)} V${yy}` : `M${x(i).toFixed(1)},${yy}`; d += ` H${x(i + 1).toFixed(1)}`; });
    const a = avg || avgOf(V) || 1, off = (v) => M.clamp((v - mn) / rng, 0, 1).toFixed(3);
    const grad = `<linearGradient id="pg" x1="0" y1="${H}" x2="0" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${C.green}"/><stop offset="${off(a * 0.85)}" stop-color="${C.green}"/><stop offset="${off(a)}" stop-color="${C.yellow}"/><stop offset="${off(a * 1.27)}" stop-color="${C.orange}"/><stop offset="${off(a * 1.4)}" stop-color="${C.red}"/><stop offset="1" stop-color="${C.red}"/></linearGradient>`;
    const lastI = vals.reduce((l, v, i) => (v != null ? i : l), 0), firstI = vals.findIndex((v) => v != null);
    const fill = `${d} V${H} H${x(firstI).toFixed(1)} Z`;
    let hl = '', marks = '';
    const mark = o.sel != null ? o.sel : o.now;
    if (mark != null && vals[mark] != null) {
      hl = `<rect x="${x(mark).toFixed(1)}" y="0" width="${(W / n).toFixed(1)}" height="${H}" fill="var(--ki-text-2, #fff)" fill-opacity=".08"/>`;
      const L = ((mark + 0.5) / n) * 100, T = (y(vals[mark]) / H) * 100, lv = levelOf(vals[mark], a);
      marks = `<i class="dot" style="left:${L.toFixed(2)}%;top:${T.toFixed(2)}%;background:${lv != null ? LEVELS[lv][1] : 'var(--ki-text-2, #fafafa)'}"></i>`;
    }
    const yl = [top, (top + mn) / 2, mn].map((v) => `<span style="top:${((y(v) / H) * 100).toFixed(2)}%">${M.nf(v, v >= 10 ? 0 : 2)}</span>`).join('');
    const xt = [[0, '00'], [6, '06'], [12, '12'], [18, '18'], [24, '00']].map(([i, t]) => `<span style="left:${((i / 24) * 100).toFixed(2)}%">${t}</span>`).join('');
    return `<div class="pwrap"><div class="yax">${yl}</div><div class="pcol"><div class="plot pplot" data-plot="price" data-n="${n}" style="height:${H}px"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><defs>${grad}</defs>${hl}<path d="${fill}" fill="url(#pg)" fill-opacity=".18"/><path d="${d}" fill="none" stroke="url(#pg)" stroke-width="2.5" vector-effect="non-scaling-stroke" stroke-linejoin="round"/></svg>${marks}</div><div class="xax">${xt}</div></div></div>${lastI < 0 ? '' : ''}`;
  }

  /* ------------------------------------------------------------ editor (Tilpass energi, 21.5) */
  const EXP = new Map(); // utvidet snarvei per kort (card_id → tile-id), felles for arket og GUI-editoren
  const BADGE = { energi: ['Energi', C.green], auto: ['Auto', C.purple], overstyrt: ['Overstyrt', C.blue], mangler: ['Mangler', C.orange], henter: ['Henter …', 'var(--ki-text-3, var(--gray600, #7f7f7f))'] };
  const badge = (k) => { const [t, col] = BADGE[k] || BADGE.mangler; return `<span style="flex:none;height:22px;padding:0 9px;border-radius:11px;display:inline-flex;align-items:center;font-size:11px;font-weight:600;color:var(--ki-on-accent, #232323);background:${col}">${t}</span>`; };
  const orderOf = (c) => { const keys = SECS.map((s) => s[0]); const o = (Array.isArray(c.order) ? c.order : []).filter((k) => keys.includes(k)); keys.forEach((k) => { if (!o.includes(k)) o.push(k); }); return o; };
  // Dra-håndtak i editoren (touch-action none + stopPropagation, fallgruve 2). Én gang per editor-element.
  function installEd(ed) {
    if (!ed || ed.__enInst || !ed.shadowRoot) return;
    ed.__enInst = true;
    window.addEventListener('msh-energi-prefs', () => { if (ed.isConnected && ed._render) ed._render(); });
    const R = ed.shadowRoot;
    let d = null;
    const stop = (e) => { if (e.target.closest && e.target.closest('[data-edrag]')) e.stopPropagation(); };
    R.addEventListener('touchstart', stop, { passive: true });
    R.addEventListener('touchmove', stop, { passive: true });
    R.addEventListener('pointerdown', (e) => {
      const hd = e.target.closest && e.target.closest('[data-edrag]');
      if (!hd || e.button) return;
      const item = hd.closest('[data-edk]');
      if (!item) return;
      e.stopPropagation(); e.preventDefault();
      d = { list: hd.dataset.edrag, k: item.dataset.edk, item, y0: e.clientY, id: e.pointerId, over: null };
      try { hd.setPointerCapture(e.pointerId); } catch (x) { /* */ }
      item.style.position = 'relative'; item.style.zIndex = '2'; item.style.boxShadow = '0 6px 18px ' + (TH.blackA ? TH.blackA(0.4, TH.mode()) : 'rgb(0 0 0 / .4)'); // konkret (regel 3) – bare under draget
      M.haptic('medium');
    });
    R.addEventListener('pointermove', (e) => {
      if (!d || e.pointerId !== d.id) return;
      e.stopPropagation(); e.preventDefault();
      d.item.style.transform = `translateY(${e.clientY - d.y0}px)`;
      d.item.style.pointerEvents = 'none';
      const el = R.elementFromPoint ? R.elementFromPoint(e.clientX, e.clientY) : null;
      d.item.style.pointerEvents = '';
      const ov = el && el.closest && el.closest('[data-edk]');
      const ok = ov && ov !== d.item && ov.dataset.elist === d.list ? ov : null;
      if (ok !== d.over) { if (d.over) d.over.style.outline = ''; d.over = ok; if (ok) { ok.style.outline = '2px solid rgba(242,133,201,.6)'; M.haptic('selection'); } }
    });
    const end = (e) => {
      if (!d || (e && e.pointerId !== d.id)) return;
      const D = d; d = null;
      D.item.style.transform = ''; D.item.style.zIndex = ''; D.item.style.boxShadow = '';
      if (D.over) D.over.style.outline = '';
      if (!D.over) return;
      const c = ed._config || {};
      const arr = D.list === 'sec' ? orderOf(c) : tilesOf(c).map((t) => t.id), to = D.over.dataset.edk, i = arr.indexOf(D.k), j0 = arr.indexOf(to);
      const o = arr.filter((x) => x !== D.k), j = o.indexOf(to);
      o.splice(i <= j0 ? j + 1 : j, 0, D.k); // dra nedover → etter målet, oppover → før
      M.haptic('success');
      if (D.list === 'sec') ed._set('order', o);
      else { const T = tilesOf(c); ed._set('tiles', o.map((id) => T.find((t) => t.id === id))); }
    };
    R.addEventListener('pointerup', end);
    R.addEventListener('pointercancel', end);
  }
  const rowCss = 'height:48px;gap:10px';
  const hdl = (list) => `<span data-edrag="${list}" title="Dra for rekkefølge" style="touch-action:none;cursor:grab;display:inline-flex;color:var(--ki-text-mid, #979797);padding:6px 0">${M.icon('mdi:drag', 20)}</span>`;

  function editorSchema(h, c) {
    c = c || {};
    if (h) M.energiPrefs(h);
    const R = h ? sourcesOf(h, c) : null;
    const loading = !R || !R.loaded;
    // Kilder: én rad per kilde med merke + overstyring
    const kilde = ([k, label, icon, doms]) => [
      { type: 'html', html: (hh, cc, key, ed) => {
        installEd(ed);
        const RR = hh ? sourcesOf(hh, cc) : null, ov = (cc.sources || {})[k];
        const kind = ov ? 'overstyrt' : !RR || !RR.loaded ? 'henter' : RR.from[k];
        const cur = RR ? (k === 'ev' || k === 'price' || k === 'power' ? RR[k] : (RR[k] || []).join(', ')) : null;
        return `<div class="f" style="gap:4px"><div class="line">${M.icon(icon, 20, 'color:var(--ki-text-2, #afafaf)')}<span style="flex:1;font-size:14px;font-weight:500">${esc(label)}</span>${badge(kind)}</div>
          <span class="help">${esc(cur || (kind === 'henter' ? 'Leser Energi-oppsettet …' : 'Ikke satt opp i Energi'))}</span>
          ${ov ? `<button class="btn" style="height:36px;border-radius:18px;font-size:13px;background:var(--ki-surface-3, #2f2f2f)" data-a="fn" data-k="${key}" data-v="${k}">${M.icon('mdi:restore', 18)}Fra Energi-oppsettet</button>` : ''}</div>`;
      }, click: (dd, ed) => { M.haptic('selection'); ed._set('sources.' + dd.v, undefined); } },
      { type: 'entity', name: 'sources.' + k, label: k === 'power' ? 'Effektsensor (overstyr)' : 'Overstyr med annen entitet', domains: doms, domain: doms.length === 1 ? doms[0] : undefined, device_class: k === 'power' ? 'power' : undefined,
        auto: (hh, cc) => { const RR = hh ? sourcesOf(hh, cc) : null; return RR ? (RR.auto[k] || null) : null; } },
    ];
    const kilder = [...SRC.flatMap(kilde),
      { type: 'number', name: 'water_price', label: 'Vannpris (kr per liter) · brukes når Energi ikke har vannkostnad', step: 0.001, min: 0, placeholder: '0,05' },
      { type: 'button', label: 'Åpne Energi-oppsett i Home Assistant', icon: 'mdi:open-in-new', run: () => { M.haptic('light'); M.navigate('/config/energy'); } }];
    // Seksjoner: dra-håndtak + øye
    const seksjoner = [{ type: 'html', html: (hh, cc, key, ed) => {
      installEd(ed);
      const hid = cc.hidden || {};
      return `<div class="f" style="gap:6px">${orderOf(cc).map((k) => `<div class="ordrow" data-edk="${k}" data-elist="sec" style="${rowCss};${hid[k] ? 'opacity:.5' : ''}">${hdl('sec')}<span style="flex:1;font-size:14px">${esc(SECL[k])}</span><button class="ib" data-a="fn" data-k="${key}" data-v="${k}" aria-label="${hid[k] ? 'Vis' : 'Skjul'} ${esc(SECL[k])}">${M.icon(hid[k] ? 'mdi:eye-off' : 'mdi:eye', 18)}</button></div>`).join('')}
        <span class="help">Dra i håndtaket for rekkefølge. Øyet skjuler seksjonen.</span></div>`;
    }, click: (dd, ed) => { const hh = { ...(ed._config.hidden || {}) }; if (hh[dd.v]) delete hh[dd.v]; else hh[dd.v] = true; M.haptic('selection'); ed._set('hidden', Object.keys(hh).length ? hh : undefined); } }];
    // Snarveier: rad per kort (dra, øye, utvid) + felt for den utvidede
    const T = tilesOf(c), ek = EXP.get(c.card_id || '_');
    const mat = (ed) => tilesOf(ed._config || {});
    const tClick = (dd, ed) => {
      const L = mat(ed), i = L.findIndex((t) => t.id === dd.v), cid = (ed._config && ed._config.card_id) || '_';
      M.haptic('selection');
      if (dd.op === 'eye' && i >= 0) { L[i] = { ...L[i], hidden: !L[i].hidden || undefined }; return ed._set('tiles', L); }
      if (dd.op === 'exp') { if (EXP.get(cid) === dd.v) { EXP.delete(cid); return ed._render(); } EXP.set(cid, dd.v); return Array.isArray(ed._config.tiles) ? ed._render() : ed._set('tiles', L); }
      if (dd.op === 'rm' && i >= 0) {
        L.splice(i, 1); EXP.delete(cid);
        const rm = new Set(ed._config.tiles_removed || []); if (DEF_TILES.some((t) => t.id === dd.v)) rm.add(dd.v);
        ed._config = { ...ed._config, tiles_removed: rm.size ? [...rm] : undefined };
        return ed._set('tiles', L);
      }
      if (dd.op === 'add') { const id = 'egen_' + Math.random().toString(36).slice(2, 7); L.push({ id, name: 'Snarvei', icon: 'mdi:flash', color: 'var(--blue, #73b9f2)' }); EXP.set(cid, id); return ed._set('tiles', L); }
    };
    const snarveier = [];
    T.forEach((t, i) => {
      snarveier.push({ type: 'html', html: (hh, cc, key, ed) => {
        installEd(ed);
        const RR = hh ? sourcesOf(hh, cc) : null, ent = t.entity || tileAuto(hh, RR, t.id), open = EXP.get(cc.card_id || '_') === t.id;
        return `<div class="ordrow" data-edk="${esc(t.id)}" data-elist="tile" style="${rowCss};${t.hidden ? 'opacity:.5' : ''}">${hdl('tile')}
          <span style="width:30px;height:30px;border-radius:15px;display:grid;place-items:center;flex:none;background:${esc(M.color(t.color, C.blue))};color:var(--ki-on-accent, #232323)">${M.icon(t.icon || 'mdi:flash', 18)}</span>
          <span style="flex:1;min-width:0;display:flex;flex-direction:column"><span style="font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(t.name || 'Snarvei')}</span><span style="font-size:11px;color:var(--ki-text-mid, #979797);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(ent || 'Velg entitet')}</span></span>
          <button class="ib" data-a="fn" data-k="${key}" data-op="eye" data-v="${esc(t.id)}" aria-label="${t.hidden ? 'Vis' : 'Skjul'}">${M.icon(t.hidden ? 'mdi:eye-off' : 'mdi:eye', 18)}</button>
          <button class="ib" data-a="fn" data-k="${key}" data-op="exp" data-v="${esc(t.id)}" aria-expanded="${open}" aria-label="Rediger">${M.icon(open ? 'mdi:chevron-up' : 'mdi:chevron-down', 20)}</button></div>`;
      }, click: tClick });
      if (ek === t.id && Array.isArray(c.tiles)) {
        const p = 'tiles.' + i + '.';
        snarveier.push(
          { type: 'text', name: p + 'name', label: 'Navn', placeholder: (DEF_TILES.find((d) => d.id === t.id) || {}).name || 'Snarvei' },
          { type: 'entity', name: p + 'entity', label: 'Entitet', auto: (hh, cc) => tileAuto(hh, hh ? sourcesOf(hh, cc) : null, t.id) },
          { type: 'icon', name: p + 'icon', label: 'Ikon' },
          { type: 'color', name: p + 'color', label: 'Farge' },
          { type: 'html', html: (hh, cc, key) => `<button class="btn" style="height:44px;color:var(--ki-red-text, var(--red,#f28073))" data-a="fn" data-k="${key}" data-op="rm" data-v="${esc(t.id)}">${M.icon('mdi:delete-outline', 20)}Fjern snarvei</button>`, click: tClick },
        );
      }
    });
    snarveier.push({ type: 'html', html: (hh, cc, key) => `<button class="btn" style="height:48px" data-a="fn" data-k="${key}" data-op="add" data-v="">${M.icon('mdi:plus', 20)}Legg til snarvei</button>`, click: tClick });
    // Hus
    const hus = [
      { type: 'boolean', label: 'Vis huset', get: (hh, cc) => !(cc.hidden || {}).house, set: (v, hh, cc, ed) => { const x = { ...(ed._config.hidden || {}) }; if (v) delete x.house; else x.house = true; ed._set('hidden', Object.keys(x).length ? x : undefined); } },
      { type: 'html', html: (hh, cc, key, ed) => {
        installEd(ed);
        const H = M.energiHus, cur = cc.house_style || 'enebolig';
        return `<div class="f"><label>Hustype</label><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${STYLES.map(([k, l]) => {
          let th = ''; try { th = H && H.thumb ? H.thumb(k) : ''; } catch (e) { th = ''; }
          return `<button data-a="fn" data-k="${key}" data-v="${k}" aria-pressed="${k === cur}" style="display:flex;flex-direction:column;align-items:center;gap:6px;padding:8px;border-radius:16px;background:var(--ki-surface-3, #2f2f2f);box-shadow:${k === cur ? 'inset 0 0 0 2px var(--pink, #f285c9)' : 'none'};font-size:12px;color:${k === cur ? 'var(--ki-text, #fafafa)' : 'var(--ki-text-2, #afafaf)'}"><span style="width:100%;aspect-ratio:16/10;border-radius:10px;overflow:hidden;display:grid;place-items:center;background:var(--ki-bg, #232323)">${th || M.icon('mdi:home-lightning-bolt', 28, 'color:var(--ki-text-3, #7f7f7f)')}</span>${esc(l)}</button>`;
        }).join('')}</div></div>`;
      }, click: (dd, ed) => { M.haptic('selection'); ed._set('house_style', dd.v); } },
      { type: 'boolean', name: 'labels.ev', label: 'Etikett: Elbillader', default: true },
      { type: 'boolean', name: 'labels.grid', label: 'Etikett: Nett', default: true },
      { type: 'boolean', name: 'labels.home', label: 'Etikett: Hjem', default: true },
      { type: 'boolean', name: 'flow', label: 'Animert strømflyt', default: true },
      { type: 'text', name: 'custom_image', label: 'Eget husbilde (PNG/SVG med gjennomsiktig bakgrunn) · tomt = hustypen', placeholder: '/local/ki/mitt-hus.png' },
      ...(c.custom_image ? [['ev', 'Elbillader'], ['grid', 'Nett'], ['home', 'Hjem']].map(([k, l]) => ({ type: 'text', name: 'targets.' + k, label: `Målpunkt ${l} (x,y i bildets koordinater)`, placeholder: 'f.eks. 120,260' })) : []),
    ];
    const visning = [
      { type: 'select', name: 'period', label: 'Standardperiode', options: PERIODS, default: 'dag' },
      { type: 'select', name: 'day_chart', label: 'Dagsgraf', options: [['linje', 'Linje'], ['soyler', 'Søyler per time']], default: 'linje' },
      { type: 'select', name: 'top_n', label: 'Toppforbrukere sammenslått', options: [[3, '3'], [5, '5'], [8, '8'], [0, 'Alle']], default: 3, help: '«Alle» skjuler «Vis alt».' },
      { type: 'boolean', name: 'show_cost', label: 'Vis kostnad i kr', default: true },
      M.spacingSchema(),
    ];
    return [
      ...(loading ? [{ type: 'info', label: 'Leser Energi-oppsettet i Home Assistant …' }] : !R.prefs ? [{ type: 'info', label: 'Energi er ikke satt opp i Home Assistant (Innstillinger → Dashbord → Energi). Kildene kan overstyres her.' }] : []),
      { type: 'tabs', id: 'energi', tabs: [
        { key: 'kilder', label: 'Kilder', icon: 'mdi:meter-electric', fields: kilder },
        { key: 'seksjoner', label: 'Seksjoner', icon: 'mdi:view-agenda', focus: ['sections'], fields: seksjoner },
        { key: 'snarveier', label: 'Snarveier', icon: 'mdi:view-grid', focus: ['tiles'], fields: snarveier },
        { key: 'hus', label: 'Hus', icon: 'mdi:home', focus: ['house'], fields: hus },
        { key: 'visning', label: 'Visning', icon: 'mdi:tune', focus: ['spacing'], fields: visning },
      ] },
      { type: 'button', label: 'Nullstill', icon: 'mdi:restore', run: (hh, cc, ed) => { M.haptic('warning'); const id = (cc && cc.card_id) || M.uid(); EXP.delete(id); ed._config = { type: cc.type || 'custom:msh-energi-card', card_id: id }; ed._set('card_id', id); } },
    ];
  }

  /* ============================================================ kortet */
  class Energi extends M.Card {
    static get cardName() { return 'Energi'; }
    static get defaults() { return { ...DEF }; }
    static getStubConfig() { return { card_id: M.uid() }; }
    static get schema() { return editorSchema; }
    get cardSize() { return 14; }
    constructor() {
      super();
      this._pp = () => { if (this.isConnected) this.update(); };
    }
    connectedCallback() { super.connectedCallback(); window.addEventListener('msh-energi-prefs', this._pp); }
    disconnectedCallback() { super.disconnectedCallback(); window.removeEventListener('msh-energi-prefs', this._pp); clearInterval(this._tick); }
    onOpen() {
      M.energiPrefs(this.hass);
      clearInterval(this._tick);
      // Nåpris og «minutter igjen» hvert minutt – bare mens popupen er åpen
      this._tick = setInterval(() => { if (this.isOpen && location.hash === HASH) this.update(); }, 60000);
      this.update();
    }
    onClose() {
      clearInterval(this._tick); this._tick = null;
      this._ui = { ...this._ui, per: null, off: 0, sel: null, pday: 'today', all: false }; // nullstilles til standardperioden
    }
    get per() { return this.ui.per || this.config.period || 'dag'; }
    get off() { return Number(this.ui.off) || 0; }
    _data(R) {
      const per = this.per, off = this.off, c = this.config;
      const key = JSON.stringify([per, off, R.grid_in, R.grid_out, R.cost_in, R.solar, R.batt_out, R.batt_in, R.water, R.water_cost, R.devices.map((d) => d.id), R.ev, R.power, c.water_price, R.price]);
      const e = CACHE.get(key);
      const stale = !e || (!e.busy && Date.now() - e.t > TTL);
      if (stale && this.isOpen && this.hass && this.hass.callWS) {
        const ent = { busy: true, t: e ? e.t : 0, D: e ? e.D : null };
        CACHE.set(key, ent);
        loadData(this.hass, R, c, per, off).then((D) => { CACHE.set(key, { busy: false, t: Date.now(), D }); this.update(); })
          .catch((err) => { console.error('msh-energi-card', err); CACHE.set(key, { busy: false, t: Date.now(), D: null }); this.update(); });
      }
      const cur = CACHE.get(key);
      return cur ? cur.D : null;
    }
    render() {
      const h = this.hass, c = this.config;
      if (this.isOpen) M.energiPrefs(h);
      const R = sourcesOf(h, c);
      const D = R.loaded ? this._data(R) : null;
      const hid = c.hidden || {};
      const order = orderOf(c).filter((k) => !hid[k] && (k !== 'water' || R.water.length));
      const parts = [];
      // 23.2: periodelinjen er ikke en seksjon – den står fast øverst (rett under Bubble-headeren), seksjonene følger i config-rekkefølge
      order.forEach((k) => {
        try { parts.push(this['_s_' + k](R, D)); } catch (e) { parts.push(this._failHTML(e)); }
      });
      const setup = R.loaded && !R.prefs ? `<button class="setup press" data-act="setup">${M.icon('mdi:lightning-bolt-outline', 20)}<span class="grow">Sett opp Energi i Home Assistant</span>${M.icon('mdi:open-in-new', 18)}</button>` : '';
      return `<div class="wrap">${this._periodRow()}${setup}${parts.join('')}</div>`;
    }
    _periodRow() {
      const per = this.per, off = this.off;
      return `<div class="prow">
        <div class="seg" role="tablist" data-glass-drag="x">${PERIODS.map(([k, l]) => `<button class="sg ${k === per ? 'on' : ''}" role="tab" aria-selected="${k === per}" ${k === per ? 'data-active="1"' : ''} data-act="per" data-v="${k}">${l}</button>`).join('')}</div>
        <button class="nb press" data-act="step" data-d="-1" aria-label="Forrige periode">${M.icon('mdi:chevron-left', 22)}</button>
        <button class="nb press" data-act="step" data-d="1" aria-label="Neste periode" ${off >= 0 ? 'disabled' : ''}>${M.icon('mdi:chevron-right', 22)}</button>
        <button class="gear press" data-act="customize" aria-label="Tilpass energi">${M.icon('mdi:cog', 22)}</button>
      </div>`;
    }
    // Husscenen (21.1): M.energiHus fra src/52-energi-hus.js, ellers enkel plassholder
    _s_house(R, D) {
      const h = this.hass, c = this.config;
      const lab = { ev: true, grid: true, home: true, ...(c.labels || {}) };
      const imp = D ? sum(D.imp) : null, home = D && any(D.home) ? sum(D.home) : null, ev = D && R.ev ? D.ev : null;
      const values = { ev: R.ev ? (ev != null ? fKwh(ev) + ' kWh' : '–') : null, grid: R.grid_in.length ? (imp != null && D && any(D.imp) ? fKwh(imp) + ' kWh' : '–') : '–', home: home != null ? fKwh(home) + ' kWh' : '–' };
      if (R.solar.length) values.solar = D ? fKwh(sum(D.sol)) + ' kWh' : '–';
      if (R.batt_out.length) values.battery = D ? fKwh(sum(D.bo) - sum(D.bi)) + ' kWh' : '–';
      const lights = M.all(h, 'light').filter((id) => { const s = this.s(id); return s && s.state === 'on'; });
      const w = R.power ? powerW(h, R.power) : null;
      if (R.power) this.s(R.power);
      const targets = {};
      Object.entries(c.targets || {}).forEach(([k, v]) => { const m = /^\s*(-?[\d.]+)\s*[,; ]\s*(-?[\d.]+)\s*$/.exec(String(v || '')); if (m) targets[k] = [Number(m[1]), Number(m[2])]; });
      const H = M.energiHus;
      const style = STYLES.some((s) => s[0] === c.house_style) ? c.house_style : 'enebolig';
      if (H && H.html) {
        let inner = '';
        try {
          // labels i M.energiHus = etikett-tekster; brytere (labels.ev/grid/home = false) → hide (ingen etikett, linje eller prikk)
          const hide = {}; Object.keys(lab).forEach((k) => { if (lab[k] === false) hide[k] = true; });
          inner = H.html({ style, values, labels: {}, hide, flow: c.flow !== false, lightsOn: lights.length > 0, kw: w != null ? w / 1000 : 0, custom_image: c.custom_image || null, targets });
        } catch (e) { inner = this._failHTML(e); }
        return `<div class="house">${inner}</div>`;
      }
      const L = [['ev', 'Elbillader', C.orange], ['grid', 'Nett', C.blue], ['home', 'Hjem', C.yellow]].filter(([k]) => lab[k] !== false && values[k] != null);
      return `<div class="house ph"><div class="phl">${L.map(([k, l, col]) => `<div class="hl"><b class="num">${esc(values[k])}</b><span><i style="background:${col}"></i>${l}</span></div>`).join('')}</div>${M.icon('mdi:home-lightning-bolt-outline', 96, 'color:var(--ki-ctrl, #545454)')}<span class="phs">${w != null ? fW(w) + ' nå' : ''}</span></div>`;
    }
    // Snarveier / status-fliser (21.1, 21.9)
    _s_tiles(R) {
      const h = this.hass;
      const T = tilesOf(this.config).filter((t) => !t.hidden);
      if (!T.length) return '';
      const pill = (t) => {
        const ent = t.entity || tileAuto(h, R, t.id), s = ent ? this.s(ent) : null, col = M.color(t.color, C.blue);
        let sub = '–', act = ent;
        if (!ent || !s) sub = ent ? '–' : 'Velg entitet';
        else if (t.id === 'meter') { const w = powerW(h, ent); sub = w != null ? `${fW(w)} · Nå` : '–'; }
        else if (t.id === 'price') {
          const pr = priceOf(h, ent, this);
          sub = pr && pr.now != null ? `${M.nf(pr.now, 2)} kr/kWh${pr.level != null ? ' · ' + LEVELS[pr.level][0] : ''}` : '–';
        } else if (t.id === 'car') {
          const plug = carPlug(h, ent), ps = plug ? this.s(plug) : null;
          sub = `${M.isNum(s.state) ? Math.round(Number(s.state)) + ' %' : '–'}${ps ? ' · ' + (ps.state === 'on' ? 'Tilkoblet' : 'Frakoblet') : ''}`;
        } else if (t.id === 'charger' || t.id === 'vvb') {
          const w = powerW(h, ent);
          if (w != null) sub = `${fW(w)} · ${w > 30 ? (t.id === 'charger' ? 'Lader' : 'Varmer') : t.id === 'charger' ? 'Inaktiv' : 'Av'}`;
          else sub = M.fmtState(h, ent);
        } else sub = M.fmtState(h, ent);
        return `<button class="tile press" ${act && s ? `data-act="more" data-id="${esc(act)}" data-ent="${esc(act)}"` : 'data-act="customize" data-section="tiles"'}>
          <span class="ti" style="background:${esc(col)}">${M.icon(t.icon || 'mdi:flash', 24)}</span>
          <span class="tt"><b class="ell">${esc(t.name || 'Snarvei')}</b><i class="ell num">${esc(sub)}</i></span></button>`;
      };
      return `<div class="tiles">${T.map(pill).join('')}</div>`;
    }
    _sel(k) { const s = this.ui.sel; return s && s.k === k ? s.i : null; }
    // Strøm (21.1): import + kostnad, arealgraf (I dag) eller stolper (Uke/Måned/År), scrub
    _s_power(R, D) {
      const c = this.config, cost = c.show_cost !== false;
      const rg = D ? D.rg : rangeOf(this.per, this.off);
      const imp = D && any(D.imp) ? sum(D.imp) : null, kr = D && D.cost ? sum(D.cost) : null;
      const line = this.per === 'dag' && c.day_chart !== 'soyler' && D && D.pw;
      const sel = this._sel('power');
      let chart, read = '';
      if (line) {
        const nowI = rg.cur ? Math.floor((Date.now() - rg.s.getTime()) / 900000) : null;
        chart = plotHTML('power', D.pw, { kind: 'area', color: C.blue, h: 120, sel, now: sel == null ? nowI : null, ticks: ticksOf(rg, 96) });
        if (sel != null && D.pw[sel] != null) read = `kl ${M.pad(Math.floor(sel / 4))}:${M.pad((sel % 4) * 15)} · ${M.nf(D.pw[sel], 1)} kW`;
      } else {
        const vals = D ? D.imp : Array(rg.n).fill(null);
        chart = plotHTML('power', vals, { kind: 'bars', color: C.blue, h: 120, sel, now: rg.cur && rg.p === 'hour' ? new Date().getHours() : null, ticks: ticksOf(rg, rg.n) });
        if (sel != null && vals[sel] != null) read = `${rg.lab(sel)} · ${fKwh(vals[sel])} kWh${cost && D.cost && D.cost[sel] != null ? ' · ' + fKr(D.cost[sel]) : ''}`;
      }
      const busy = !D && R.loaded && (R.grid_in.length || R.power);
      return `<section class="sec">
        <div class="sh"><span class="st">Strøm</span>${cost && kr != null ? `<span class="cp" style="background:${TONE(C.blue, 0.16)};color:${AT(C.blue)}">${fKr(kr)}</span>` : ''}</div>
        <div class="card pc">
          <div class="ph2"><div class="big">${M.icon('mdi:flash', 22, `color:${C.blue}`)}<span class="num"><b>${fKwh(imp)}</b> kWh</span></div><span class="rd num">${esc(read || rg.title)}</span></div>
          <span class="lb">Importert${busy ? ' · henter …' : ''}</span>
          ${chart}
        </div></section>`;
    }
    // Strømpriser (21.10): I dag / I morgen, trappekurve, nåpris, nivå, lavest/høyest
    _s_price(R) {
      const h = this.hass, ent = R.price;
      const pr = ent ? priceOf(h, ent, this) : null;
      const hasM = !!(pr && pr.P.hasTomorrow);
      const day = this.ui.pday === 'tomorrow' && hasM ? 'tomorrow' : 'today';
      const seg = `<div class="seg sm" role="tablist" data-glass-drag="x">${[['today', 'I dag', true], ['tomorrow', 'I morgen', hasM]].map(([k, l, ok]) => `<button class="sg ${k === day ? 'on' : ''}" role="tab" aria-selected="${k === day}" ${k === day ? 'data-active="1"' : ''} data-act="pday" data-v="${k}" ${ok ? '' : 'disabled title="Kommer ca. kl 13"'}>${l}</button>`).join('')}</div>`;
      const hdr = `<div class="sh"><span class="st">Strømpriser</span>${seg}</div>`;
      if (!pr) return `<section class="sec">${hdr}<div class="card pr"><div class="empty0">${M.icon('mdi:cash', 22)}<span>–</span><button class="pick press" data-act="customize" data-section="price">Velg entitet</button></div></div></section>`;
      const vals = day === 'tomorrow' ? pr.P.tomorrow : pr.P.today;
      const avg = avgOf(vals), now = new Date(), hr = now.getHours();
      const sel = this._sel('price');
      const showI = sel != null ? sel : day === 'today' ? hr : null;
      const v = showI != null ? vals[showI] : avg;
      const lv = levelOf(v, avgOf(pr.P.today), sel == null && day === 'today' ? (h.states[ent].attributes.price_level || null) : null);
      const col = lv != null ? AT(LEVELS[lv][1]) : 'var(--ki-text, #fafafa)'; // tekst/ikon: aksent mørknet i lys modus
      const sub = sel != null ? `kl ${M.pad(sel)}–${M.pad((sel + 1) % 24)} · snitt ${M.nf(avg, 2)} kr` : day === 'today' ? `${60 - now.getMinutes()} minutter igjen · snitt ${M.nf(avg, 2)} kr` : `Snitt i morgen · ${M.nf(avg, 2)} kr`;
      const L = vals.map((x, i) => [x, i]).filter(([x]) => x != null);
      const lo = L.length ? L.reduce((a, b) => (b[0] < a[0] ? b : a)) : null, hi = L.length ? L.reduce((a, b) => (b[0] > a[0] ? b : a)) : null;
      const chip = (dot, t, p) => (p ? `<span class="pchip num"><i style="background:${dot}"></i>${t} kl ${M.pad(p[1])}–${M.pad((p[1] + 1) % 24)} · ${M.nf(p[0], 2)} kr</span>` : '');
      return `<section class="sec">${hdr}
        <div class="card pr">
          <div class="ptop" data-ent="${esc(ent)}">
            <span class="pic" style="color:${col}">${M.icon('mdi:cash', 22)}</span>
            <div class="grow"><div class="pv num"><b style="color:${col}">${v != null ? M.nf(v, 2) : '–'}</b> kr/kWh</div><span class="lb num">${esc(sub)}</span></div>
            ${lv != null ? `<span class="lvl" style="color:${AT(LEVELS[lv][1])};background:color-mix(in srgb, ${LEVELS[lv][1]} 16%, transparent)">${LEVELS[lv][0]}</span>` : ''}
          </div>
          ${priceChartHTML(vals, avgOf(pr.P.today), { now: day === 'today' ? hr : null, sel })}
          <div class="pchips">${chip(C.green, 'Lavest', lo)}${chip(C.red, 'Høyest', hi)}</div>
        </div></section>`;
    }
    // Toppforbrukere (21.1): device_consumption sortert etter forbruk i perioden
    _s_top(R, D) {
      const h = this.hass, c = this.config, cost = c.show_cost !== false;
      const devs = D ? [...D.devs].sort((a, b) => b.kwh - a.kwh) : [];
      const homeT = D && any(D.home) ? sum(D.home) : null, impT = D && any(D.imp) ? sum(D.imp) : null;
      const kr = D && D.cost ? sum(D.cost) : null, avgKr = kr != null && impT ? kr / impT : null;
      const measured = sum(devs.filter((d) => !d.parent).map((d) => d.kwh));
      const pct = homeT ? Math.round((measured / homeT) * 100) : null;
      const n = Number(c.top_n != null ? c.top_n : 3), all = n === 0 || this.ui.all;
      const show = all ? devs : devs.slice(0, n);
      const mx = devs.length ? devs[0].kwh || 1 : 1;
      const RANK = ['#b8e674', '#d5dc72', '#f2d26f']; // ki-hex-ok: medaljefarger (fyll), tekst = --ki-on-accent
      const meta = devs.length ? `${devs.length} målt${pct != null ? ` · ${M.clamp(pct, 0, 100)} % av forbruket` : ''}` : '';
      const row = (d, i) => {
        const s = this.s(d.id), ic = (s && s.attributes.icon) || (EV_RX.test(d.id + ' ' + (d.name || '')) ? 'mdi:ev-station' : VVB_RX.test(d.id) ? 'mdi:water-boiler' : 'mdi:power-plug');
        const nm = d.name || (s ? M.name(h, d.id).replace(/\s+(energi|energy|forbruk|consumption)$/i, '') : d.id);
        return `<button class="trow press" data-act="more" data-id="${esc(d.id)}" data-ent="${esc(d.id)}">
          <span class="tic">${M.icon(ic, 22)}${i < 3 ? `<i class="rk" style="background:${RANK[i]}">${i + 1}</i>` : ''}</span>
          <span class="grow tcol"><span class="tl"><b class="ell">${esc(nm)}</b><span class="num tk">${fKwh(d.kwh)} kWh</span>${cost && avgKr != null ? `<span class="cp sm num">${fKr(d.kwh * avgKr)}</span>` : ''}</span>
          <span class="bar"><i style="width:${Math.max(2, (d.kwh / mx) * 100).toFixed(1)}%"></i></span></span></button>`;
      };
      const body = !R.loaded || (!D && R.devices.length) ? `<div class="empty0"><span>${R.loaded ? 'Henter …' : 'Leser Energi-oppsettet …'}</span></div>`
        : !devs.length ? `<div class="empty0">${M.icon('mdi:power-plug-off-outline', 22)}<span>${R.devices.length ? 'Ingen målinger i perioden' : 'Ingen enheter i Energi-oppsettet (Individuelle enheter)'}</span></div>`
          : show.map(row).join('');
      return `<section class="sec">
        <div class="sh"><span class="st">Toppforbrukere</span><span class="meta num">${esc(meta)}</span></div>
        <div class="card tops">${body}
          ${n !== 0 && devs.length > n ? `<button class="more press" data-act="all">${this.ui.all ? 'Vis færre' : 'Vis alt'}</button>` : ''}</div></section>`;
    }
    // Vann (21.1): liter + kostnad, stolper per time/dag/måned
    _s_water(R, D) {
      const c = this.config, cost = c.show_cost !== false;
      const rg = D ? D.rg : rangeOf(this.per, this.off);
      const vals = D ? D.water : Array(rg.n).fill(null);
      const tot = D && any(D.water) ? sum(D.water) : null, kr = D && D.wcost ? sum(D.wcost) : null;
      const sel = this._sel('water');
      const read = sel != null && vals[sel] != null ? `${rg.lab(sel)} · ${fL(vals[sel])} L${cost && D.wcost && D.wcost[sel] != null ? ' · ' + fKr(D.wcost[sel]) : ''}` : '';
      return `<section class="sec">
        <div class="sh"><span class="st">Vann</span>${cost && kr != null ? `<span class="cp" style="background:${TONE(CYAN, 0.16)};color:${AT(CYAN)}">${fKr(kr)}</span>` : ''}</div>
        <div class="card pc">
          <div class="ph2"><div class="big">${M.icon('mdi:water', 22, `color:${AT(CYAN)}`)}<span class="num"><b>${fL(tot)}</b> L</span></div><span class="rd num">${esc(read || rg.title)}</span></div>
          <span class="lb">Forbrukt</span>
          ${plotHTML('water', vals, { kind: 'bars', color: CYAN, h: 96, sel, now: rg.cur && rg.p === 'hour' ? new Date().getHours() : null, ticks: ticksOf(rg, rg.n) })}
        </div></section>`;
    }
    onAction(name, el, ev) {
      const d = el.dataset;
      if (name === 'per') { if (d.v === this.per) return; return this.setUI({ per: d.v, off: 0, sel: null }); }
      if (name === 'step') { const o = Math.min(0, this.off + Number(d.d)); if (o === this.off) return; return this.setUI({ off: o, sel: null }); }
      if (name === 'pday') return this.setUI({ pday: d.v, sel: null });
      if (name === 'all') return this.setUI({ all: !this.ui.all });
      if (name === 'setup') return M.navigate('/config/energy');
      return super.onAction(name, el, ev);
    }
    afterRender() {
      const root = this.shadowRoot;
      if (M.glassDrag) root.querySelectorAll('.seg').forEach((s) => M.glassDrag(s, { axis: 'x' }));
      // Scrub i grafene: touch-action pan-y + stopPropagation (fallgruve 2)
      root.querySelectorAll('.plot').forEach((p) => {
        if (p.__sc) return;
        p.__sc = true;
        M.guardDrag(p, 'x');
        let down = false;
        const pick = (e) => {
          const r = p.getBoundingClientRect(), n = Number(p.dataset.n) || 1;
          if (!r.width) return;
          const i = M.clamp(Math.floor(((e.clientX - r.left) / r.width) * n), 0, n - 1), k = p.dataset.plot, cur = this.ui.sel;
          if (!cur || cur.k !== k || cur.i !== i) { if (cur && cur.k === k) M.haptic('selection'); this.setUI({ sel: { k, i } }); }
        };
        p.addEventListener('pointerdown', (e) => { if (e.button) return; down = true; clearTimeout(this._selT); try { p.setPointerCapture(e.pointerId); } catch (x) { /* */ } pick(e); });
        p.addEventListener('pointermove', (e) => { if (!down) return; e.stopPropagation(); pick(e); });
        const up = () => { if (!down) return; down = false; clearTimeout(this._selT); this._selT = setTimeout(() => this.setUI({ sel: null }), 2500); };
        p.addEventListener('pointerup', up);
        p.addEventListener('pointercancel', up);
      });
    }
    get styles() {
      return `
        :host{display:block;width:100%}
        .wrap{display:flex;flex-direction:column;gap:var(--msh-gap,8px)}
        .setup{display:flex;align-items:center;gap:10px;height:52px;padding:0 16px;border-radius:26px;background:${TONE(C.orange, 0.14)};color:${AT(C.orange)};font-size:14px;font-weight:500;text-align:left}
        .house{position:relative;width:100%;min-height:340px;border-radius:28px;overflow:hidden}
        .house.ph{height:340px;display:grid;place-items:center;background:var(--ki-surface, var(--gray200,#3a3a3a));box-shadow:${C.edge}}
        .phl{position:absolute;top:16px;left:16px;right:16px;display:flex;justify-content:space-between;gap:8px}
        .hl{display:flex;flex-direction:column;gap:2px}
        .hl b{font-size:17px;font-weight:600}
        .hl span{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--ki-text-2, var(--gray800,#afafaf))}
        .hl i{width:8px;height:8px;border-radius:50%}
        .phs{position:absolute;bottom:14px;font-size:12px;color:var(--ki-text-mid, var(--gray700,#979797))}
        .prow{display:flex;align-items:center;gap:8px;min-width:0;margin-bottom:calc(14px - var(--msh-gap,8px))}
        .seg{display:flex;gap:2px;padding:4px;border-radius:22px;flex:1;min-width:0;position:relative;touch-action:pan-y;background:var(--ki-surface-3, var(--gray200,#3a3a3a))}
        .seg .sg{flex:1 1 0;min-width:0;height:36px;padding:0 4px;border-radius:18px;font-size:13px;white-space:nowrap;color:var(--ki-text-2, var(--gray800,#afafaf));background:transparent;transition:background .25s,color .25s}
        .seg .sg.on{background:${C.accent};color:var(--ki-on-accent, #2a1720);font-weight:500}
        .seg .sg:disabled{opacity:.4;cursor:default}
        .seg.sm{flex:none}
        .seg.sm .sg{height:30px;padding:0 12px;flex:none}
        .nb{width:44px;height:44px;border-radius:22px;display:grid;place-items:center;color:var(--ki-text, var(--white,#fafafa));flex:none}
        .nb:disabled{opacity:.3;cursor:default}
        .gear{width:44px;height:44px;border-radius:50%;display:grid;place-items:center;background:var(--ki-surface, var(--gray200,#3a3a3a));color:var(--ki-text, var(--white,#fafafa));flex:none}
        .tiles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
        .tile{display:flex;align-items:center;gap:8px;height:66px;padding:0 10px 0 5px;border-radius:33px;background:var(--ki-surface, var(--gray200,#3a3a3a));box-shadow:${C.edge};text-align:left;min-width:0}
        .ti{width:56px;height:56px;border-radius:50%;display:grid;place-items:center;flex:none;color:var(--ki-on-accent, #232323)}
        .tt{display:flex;flex-direction:column;gap:2px;min-width:0}
        .tt b{font-size:14px;font-weight:600}
        .tt i{font-style:normal;font-size:12px;color:var(--ki-text-2, var(--gray800,#afafaf))}
        .sec{display:flex;flex-direction:column;gap:8px}
        .sh{display:flex;align-items:center;gap:8px;min-height:36px;padding:0 4px}
        .st{flex:1;font-size:18px;font-weight:500}
        .meta{font-size:12px;color:var(--ki-text-mid, var(--gray700,#979797))}
        .cp{height:26px;padding:0 10px;border-radius:13px;display:inline-flex;align-items:center;font-size:13px;font-weight:600;flex:none}
        .cp.sm{height:22px;padding:0 8px;font-size:11px;background:${WA(0.08)};color:var(--ki-text-1, var(--gray900,#c7c7c7))}
        .card.pc,.card.pr,.card.tops{padding:16px;display:flex;flex-direction:column;gap:6px}
        .ph2{display:flex;align-items:center;gap:8px}
        .big{flex:1;display:flex;align-items:center;gap:8px;font-size:15px;color:var(--ki-text-2, var(--gray800,#afafaf))}
        .big b{font-size:26px;font-weight:500;color:var(--ki-text, var(--white,#fafafa))}
        .rd{font-size:12px;color:var(--ki-text-2, var(--gray800,#afafaf));text-align:right}
        .lb{font-size:12px;color:var(--ki-text-mid, var(--gray700,#979797))}
        .plot{position:relative;width:100%;margin-top:6px;touch-action:pan-y;cursor:crosshair}
        .plot svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
        .plot .vl{position:absolute;top:0;bottom:0;width:0;border-left:1px solid var(--ki-text-2, rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(.55*var(--ki-wa-k,1)),var(--ki-wa-max,1))));transform:translateX(-.5px);pointer-events:none}
        .plot .vl.dash{border-left:1px dashed var(--ki-text-2, rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(.45*var(--ki-wa-k,1)),var(--ki-wa-max,1))))}
        .plot .dot{position:absolute;width:10px;height:10px;border-radius:50%;transform:translate(-50%,-50%);pointer-events:none;box-shadow:0 0 0 3px var(--ki-surface, rgba(40,40,40,.9))}
        .plot .dot.ring{background:var(--ki-surface, #282828);border:2px solid;box-sizing:border-box}
        .empty-plot{display:grid;place-items:center;color:var(--ki-text-3, var(--gray600,#7f7f7f))}
        .xax{position:relative;height:16px;margin-top:4px}
        .xax span{position:absolute;transform:translateX(-50%);font-size:11px;color:var(--ki-text-3, var(--gray600,#7f7f7f));white-space:nowrap}
        .xax span:first-child{transform:none}
        .xax span:last-child:not(:first-child){transform:translateX(-100%)}
        .ptop{display:flex;align-items:center;gap:12px}
        .pic{width:44px;height:44px;border-radius:50%;display:grid;place-items:center;background:var(--ki-surface-2, var(--gray300,#404040));flex:none}
        .pv{font-size:13px;color:var(--ki-text-2, var(--gray800,#afafaf))}
        .pv b{font-size:24px;font-weight:500}
        .lvl{height:28px;padding:0 12px;border-radius:14px;display:inline-flex;align-items:center;font-size:13px;font-weight:600;flex:none}
        .pwrap{display:flex;gap:6px;margin-top:4px}
        .yax{position:relative;width:30px;flex:none;height:180px;margin-top:6px}
        .yax span{position:absolute;right:0;transform:translateY(-50%);font-size:10px;color:var(--ki-text-3, var(--gray600,#7f7f7f))}
        .pcol{flex:1;min-width:0}
        .pchips{display:flex;flex-wrap:wrap;gap:8px;margin-top:4px}
        .pchip{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 12px;border-radius:15px;background:var(--ki-surface-2, var(--gray300,#404040));font-size:12px;color:var(--ki-text-1, var(--gray900,#c7c7c7))}
        .pchip i{width:8px;height:8px;border-radius:50%}
        .empty0{display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;padding:14px 8px;color:var(--ki-text-mid, var(--gray700,#979797));font-size:13px;text-align:center}
        .tops{gap:4px}
        .trow{display:flex;align-items:center;gap:12px;padding:6px 0;text-align:left;width:100%}
        .tic{position:relative;width:48px;height:48px;border-radius:50%;display:grid;place-items:center;background:var(--ki-surface-2, var(--gray300,#404040));flex:none}
        .rk{position:absolute;top:-2px;right:-4px;width:18px;height:18px;border-radius:9px;display:grid;place-items:center;font-style:normal;font-size:11px;font-weight:700;color:var(--ki-on-accent, #232323)}
        .tcol{display:flex;flex-direction:column;gap:6px}
        .tl{display:flex;align-items:center;gap:8px;min-width:0}
        .tl b{flex:1;min-width:0;font-size:14px;font-weight:500}
        .tk{font-size:13px;color:var(--ki-text-2, var(--gray800,#afafaf));flex:none}
        .bar{height:6px;border-radius:3px;background:var(--ki-surface-3, var(--gray300,#404040));overflow:hidden}
        .bar i{display:block;height:100%;border-radius:3px;background:${C.lime}}
        .more{height:40px;border-radius:20px;background:var(--ki-surface-2, var(--gray300,#404040));font-size:13px;font-weight:500;margin-top:6px}
      `;
    }
  }
  M.POPUP_CARDS = M.POPUP_CARDS || [];
  if (!M.POPUP_CARDS.includes('msh-energi-card')) M.POPUP_CARDS.push('msh-energi-card'); // «Mellomrom» (ligger i Visning-fanen)
  M.REF_POPUPS = M.REF_POPUPS || {};
  if (!M.REF_POPUPS[HASH]) M.REF_POPUPS[HASH] = { nav: 'energi' };
  M.define('msh-energi-card', Energi, 'MSH Energi', 'Energi-popup (#energi): hus med strømflyt, snarveier, strøm, strømpriser, toppforbrukere og vann fra HAs Energi-oppsett.');
})();
