/* KI MSH · strømpris-kilde (fiks-4 punkt 5–6). ÉN felles kilde for strømpriskortet (26), prosa-boblen «Strømpris» (21),
 * strøm-sliden på Hjem (24), romvarsler (32) og «billigst kl.» i Klima.
 *
 *   MSH.powerPriceCfg(base?, over?) → normalisert config: standardverdier ← base (kortets YAML power_price / gamle felt)
 *                               ← ki-store `power_price` (én felles config, «Tilpass Hjem» → Popups → Strømpris) ← over.
 *   Config: { profile: no|se, source: nordpool|tibber|strompris|custom ('' = auto), spot_entity (alias entity),
 *     norgespris_entity, norgespris (kr/kWh, 0,50), grid_entity, area NO1–5, se_entity, se_area SE1–4, se_unit auto|ore|kr,
 *     mode spot|total|norgespris, unit kr|ore, tab: { style glass|standard, font 11–18, height 24–48, padding 8–40 } }
 *   MSH.powerPrice(hass, cfg?, card?) → {
 *     profile 'no'|'se', source, area, mode 'spot'|'total'|'norgespris', currency 'NOK'|'SEK',
 *     entity (pris-/spot-sensoren som brukes), auto (om den er autokonfigurert),
 *     now (valgt pris nå, kr/kWh), spotNow, today[24] / tomorrow[24] (valgt pris per time, kr/kWh eller null),
 *     spotToday / spotTomorrow (spot per time – referanselinje), ref { label, now, today, tomorrow } | null,
 *     grid { entity, now, today, tomorrow, todayAvg, tomorrowAvg, diff (kr/kWh, i morgen − i dag) } | null,
 *     norgespris { v, entity } | null (Sverige: null), hasToday, hasTomorrow, nToday, nTomorrow,
 *     unit 'kr/kWh'|'øre/kWh' (visning), k (1 | 100), status (tekst), statusKind 'ok'|'warn'|'err',
 *     fmt(v, { unit: true|false }) → «1,47 kr» / «147 øre» (/kWh med unit), cheapest({ day, fromNow }) → { h, v } | null }
 *   Alle tall i kr/kWh (SEK-sensor i öre → kr). Visningsenheten (kr/øre) brukes bare i fmt() / unit / k.
 *   card (valgfri): registrerer entitetene som avhengigheter (card.s) og oppdaterer kortet når power_price endres i
 *   ki-store eller Tibber-prisene er hentet (MSH.powerPriceWatch).
 *
 * Kilder (timepriser normaliseres til 24 per døgn; 96 kvarter → snitt per time):
 *   Nord Pool  today/tomorrow (tall) eller raw_today/raw_tomorrow ({start, value})
 *   Strømpris  (hvakosterstrommen) prices_today/prices_tomorrow ({start, price})
 *   Tibber     nåpris fra sensoren, timepriser via tibber.get_prices (response, mellomlagret per døgn, fornyes etter 13)
 *   Egen       tilstand + valgfritt today/tomorrow
 * Enhet: «øre/öre/cent» eller price_in_cents → ÷100. Sverige: se_unit auto|ore|kr (auto leser unit_of_measurement/currency).
 * Autokonfig (entiteter.md «Strøm»): beste kjente pris-sensor for kilde/profil/område (nordpool → tibber → strompris →
 * energi_data_service → sensor med …/kWh). Ingenting gjettes inn i config; mangler data → «–» (aldri mock).
 */
(function () {
  const M = window.MSH;
  if (!M || M.powerPrice) return;
  const HOUR = 3600000;
  const PER_KWH = /\/\s*kwh/i;
  const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
  const num = (v) => (v === '' || v == null || isNaN(Number(v)) ? null : Number(v));

  /* ------------------------------------------------------------ grunnhjelpere (også brukt av eldre kode) */
  const CENT_RX = /øre|öre|\bore\b|cent/i;
  M.priceScale = function (st) {
    const a = (st && st.attributes) || {};
    return a.price_in_cents === true || CENT_RX.test(String(a.unit_of_measurement || '')) ? 0.01 : 1;
  };
  const hasSeries = (a) => ['raw_today', 'today', 'prices_today'].some((k) => Array.isArray(a[k]) && a[k].length);
  // En pris-sensor: enhet «…/kWh» (NOK/kWh, kr/kWh, øre/kWh), eller uten enhet men med timesprislister.
  // Kostnad (kr/NOK uten /kWh, device_class monetary), energi (kWh) og effekt (W) velges aldri.
  M.isPriceSensor = function (hass, id) {
    const s = hass && id && hass.states[id];
    if (!s || !/^(sensor|input_number)\./.test(id)) return false;
    const a = s.attributes || {}, u = String(a.unit_of_measurement || ''), dc = a.device_class;
    if (dc === 'energy' || dc === 'power' || dc === 'energy_storage') return false;
    if (PER_KWH.test(u)) return true;
    if (dc === 'monetary' || u) return false;
    return hasSeries(a);
  };

  // 48 timer (i dag 0–23, i morgen 24–47) × skala. Tåler raw_*, today/tomorrow (tall – også 96 kvarter – eller objekter),
  // prices_* og Tibber-svar ({start_time, price}). Kvarterpriser → timesnitt.
  function seriesOf(lists, k) {
    const out = Array(48).fill(null);
    const d0 = new Date(); d0.setHours(0, 0, 0, 0);
    const sum = Array.from({ length: 48 }, () => [0, 0]);
    const put = (t, v) => {
      if (v == null || v === '' || isNaN(Number(v)) || isNaN(t)) return;
      const d = new Date(t), day = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - d0) / 86400000);
      if (day < 0 || day > 1) return;
      const i = day * 24 + d.getHours();
      sum[i][0] += Number(v) * k; sum[i][1]++;
    };
    lists.forEach((list, day) => {
      if (!Array.isArray(list) || !list.length) return;
      if (list[0] != null && typeof list[0] === 'object') {
        list.forEach((p) => {
          if (!p) return;
          const st = p.start || p.startsAt || p.start_time || p.time || p.hour;
          const v = p.value !== undefined ? p.value : p.price !== undefined ? p.price : p.total;
          put(new Date(st).getTime(), v);
        });
      } else {
        const base = d0.getTime() + day * 86400000, step = HOUR * (24 / list.length);
        list.forEach((v, i) => put(base + i * step + 1, v));
      }
    });
    sum.forEach(([t, n], i) => { if (n) out[i] = t / n; });
    return out;
  }
  const attrLists = (a) => [0, 1].map((day) => {
    const [rk, tk, pk] = day ? ['raw_tomorrow', 'tomorrow', 'prices_tomorrow'] : ['raw_today', 'today', 'prices_today'];
    return [a[tk], a[rk], a[pk]].find((x) => Array.isArray(x) && x.length) || null;
  });
  M.priceSeries = function (hass, id, k) {
    const s = hass && id && hass.states[id];
    if (!s) return Array(48).fill(null);
    return seriesOf(attrLists(s.attributes || {}), k != null ? k : M.priceScale(s));
  };
  M.priceNow = function (hass, id, k) {
    const s = hass && id && hass.states[id];
    if (!s || !M.isNum(s.state)) return null;
    return Number(s.state) * (k != null ? k : M.priceScale(s));
  };

  /* ------------------------------------------------------------ config */
  const DEF = { profile: 'no', source: '', spot_entity: '', norgespris_entity: '', norgespris: 0.5, grid_entity: '', area: '', se_entity: '', se_area: '', se_unit: 'auto', mode: 'spot', unit: 'kr', tab: { style: 'glass', font: 14, height: 30, padding: 20 } };
  M.POWER_PRICE_DEF = DEF;
  M.POWER_SOURCES = [['nordpool', 'Nord Pool'], ['tibber', 'Tibber'], ['strompris', 'Strømpris'], ['custom', 'Egen sensor']];
  M.POWER_AREAS = { no: ['NO1', 'NO2', 'NO3', 'NO4', 'NO5'], se: ['SE1', 'SE2', 'SE3', 'SE4'] };
  const clampN = (v, a, b, d) => { const n = num(v); return n == null ? d : Math.max(a, Math.min(b, n)); };
  // base: kortets YAML ({ power_price } og/eller gamle felt entity / norgespris_entity / norgespris)
  // over: overstyring over ki-store (f.eks. prosa-boblens egen entitet)
  M.powerPriceCfg = function (base, over) {
    const b = base || {}, legacy = {};
    if (b.entity) legacy.spot_entity = b.entity;
    if (b.norgespris_entity) legacy.norgespris_entity = b.norgespris_entity;
    if (num(b.norgespris) != null) legacy.norgespris = num(b.norgespris);
    const yaml = isObj(b.power_price) ? b.power_price : {};
    const st = (M.store && M.store.get('power_price')) || {};
    const c = { ...DEF, ...legacy, ...yaml, ...(isObj(st) ? st : {}), ...(isObj(over) ? over : {}) };
    if (!c.spot_entity && c.entity) c.spot_entity = c.entity; // «entity» (punkt 5) = spot-sensoren
    c.tab = { ...DEF.tab, ...(isObj(yaml.tab) ? yaml.tab : {}), ...(isObj(st.tab) ? st.tab : {}) };
    c.tab.style = c.tab.style === 'standard' ? 'standard' : 'glass';
    c.tab.font = clampN(c.tab.font, 11, 18, 14); c.tab.height = clampN(c.tab.height, 24, 48, 30); c.tab.padding = clampN(c.tab.padding, 8, 40, 20);
    c.profile = c.profile === 'se' ? 'se' : 'no';
    if (!['spot', 'total', 'norgespris'].includes(c.mode)) c.mode = 'spot';
    if (c.profile === 'se' && c.mode === 'norgespris') c.mode = 'spot';
    c.unit = c.profile === 'se' ? 'kr' : c.unit === 'ore' ? 'ore' : 'kr';
    if (!['auto', 'ore', 'kr'].includes(c.se_unit)) c.se_unit = 'auto';
    if (!M.POWER_SOURCES.some((x) => x[0] === c.source) || (c.profile === 'se' && c.source === 'strompris')) c.source = '';
    const np = num(c.norgespris); c.norgespris = np == null ? 0.5 : np;
    Object.defineProperty(c, '__pp', { value: true });
    return c;
  };

  /* ------------------------------------------------------------ autokonfig */
  const platOf = (hass, id) => (hass.entities && hass.entities[id] && hass.entities[id].platform) || '';
  const currencyOf = (hass, id) => {
    const s = hass.states[id], a = (s && s.attributes) || {}, t = `${a.currency || ''} ${a.unit_of_measurement || ''} ${id}`;
    if (/SEK|öre|_se[1-4](_|$)/i.test(t)) return 'SEK';
    if (/NOK|øre|kr\/|_no[1-5](_|$)/i.test(t)) return 'NOK';
    if (/EUR|DKK|cent/i.test(t)) return 'X';
    return '';
  };
  const areaOfSensor = (hass, id) => {
    const a = (hass.states[id] || {}).attributes || {};
    const t = `${a.region || ''} ${a.area || ''} ${a.price_area || ''} ${a.price_region || ''} ${id}`;
    const m = /(?:^|[^a-z])((?:no|se)[1-5])(?:[^0-9]|$)/i.exec(t);
    return m ? m[1].toUpperCase() : '';
  };
  const SRC_OK = {
    nordpool: (hass, id) => platOf(hass, id) === 'nordpool' || /nordpool/i.test(id),
    tibber: (hass, id) => platOf(hass, id) === 'tibber' || /tibber/i.test(id),
    strompris: (hass, id) => ['strompris', 'hvakosterstrommen'].includes(platOf(hass, id)) || /strompris|hvakoster/i.test(id) || Array.isArray(((hass.states[id] || {}).attributes || {}).prices_today),
    custom: () => true,
  };
  const SRC_ORDER = ['nordpool', 'tibber', 'strompris', 'energi_data_service'];
  // Kandidater for kilde/profil/område, beste først (brukes også som forslag i editoren)
  M.powerPriceCandidates = function (hass, cfg) {
    if (!hass || !hass.states) return [];
    const c = cfg || M.powerPriceCfg(), se = c.profile === 'se', area = (se ? c.se_area : c.area) || '';
    const ids = Object.keys(hass.states).filter((id) => id.startsWith('sensor.') && M.isPriceSensor(hass, id) && !/norgespris|nettleie|grid|tariff/i.test(id));
    const okCur = (id) => { const cu = currencyOf(hass, id); return se ? cu === 'SEK' : cu !== 'SEK' && cu !== 'X'; };
    const okSrc = (id) => !c.source || c.source === 'custom' || SRC_OK[c.source](hass, id);
    const rank = (id) => {
      const s = hass.states[id], a = s.attributes || {}, p = platOf(hass, id);
      const pi = SRC_ORDER.indexOf(p) >= 0 ? SRC_ORDER.indexOf(p) : SRC_OK.nordpool(hass, id) ? 0 : SRC_OK.tibber(hass, id) ? 1 : 5;
      const ar = areaOfSensor(hass, id);
      return (area && ar ? (ar === area ? 0 : 40) : 10) + (hasSeries(a) ? 0 : 4) + (M.isNum(s.state) ? 0 : 20) + pi;
    };
    return ids.filter((id) => okCur(id) && okSrc(id)).sort((x, y) => rank(x) - rank(y) || (x < y ? -1 : 1));
  };
  M.powerPriceAuto = (hass, cfg) => (cfg && cfg.source === 'custom' ? null : M.powerPriceCandidates(hass, cfg)[0] || null);
  // Norgespris-sensor: config → første sensor.*norgespris* med tallverdi og enhet …/kWh (eller uten enhet)
  M.norgesprisAuto = function (hass) {
    if (!hass || !hass.states) return null;
    return Object.keys(hass.states).filter((id) => {
      if (!/^sensor\..*norgespris/i.test(id)) return false;
      const s = hass.states[id], u = String((s.attributes || {}).unit_of_measurement || '');
      return M.isNum(s.state) && (!u || PER_KWH.test(u));
    }).sort()[0] || null;
  };
  // Forslag til nettleie-sensor (velges aldri automatisk – bare foreslått i editoren)
  M.gridCandidates = (hass) => (hass && hass.states ? Object.keys(hass.states).filter((id) => id.startsWith('sensor.') && /nettleie|grid_?(fee|tariff|price)|energiledd|tariff/i.test(id) && M.isNum(hass.states[id].state)).sort() : []);

  /* ------------------------------------------------------------ Tibber: tibber.get_prices (response), mellomlagret */
  const TIB = { key: '', today: null, tomorrow: null, t: 0, busy: false, err: '' };
  function tibberFetch(hass, ent) {
    const d0 = new Date(); d0.setHours(0, 0, 0, 0);
    const key = d0.toDateString() + '|' + (ent || '');
    const needTmr = new Date().getHours() >= 13 && !(TIB.tomorrow && TIB.tomorrow.length);
    if (TIB.busy || !hass || !hass.callService) return;
    if (TIB.key === key && (!needTmr || Date.now() - TIB.t < 30 * 60000) && (TIB.today || Date.now() - TIB.t < 10 * 60000)) return;
    TIB.busy = true;
    const end = new Date(d0.getTime() + 2 * 86400000);
    const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} 00:00:00`;
    Promise.resolve().then(() => hass.callService('tibber', 'get_prices', { start: fmt(d0), end: fmt(end) }, undefined, false, true)).then((r) => {
      const P = (r && (r.response || r).prices) || {};
      const homes = Object.keys(P);
      const fn = ent && hass.states[ent] ? String(hass.states[ent].attributes.friendly_name || '') : '';
      const home = homes.find((h) => fn && fn.toLowerCase().includes(h.toLowerCase())) || homes[0];
      const list = (home && P[home]) || [];
      const t1 = d0.getTime() + 86400000;
      TIB.today = list.filter((p) => new Date(p.start_time || p.start).getTime() < t1);
      TIB.tomorrow = list.filter((p) => new Date(p.start_time || p.start).getTime() >= t1);
      TIB.err = homes.length ? '' : 'tibber.get_prices ga ingen priser';
    }).catch((e) => { TIB.err = 'tibber.get_prices feilet' + (e && e.message ? ': ' + e.message : ''); })
      .finally(() => { TIB.busy = false; TIB.t = Date.now(); TIB.key = key; memo = null; notify(); });
  }

  /* ------------------------------------------------------------ oppdatering av kort */
  const watchers = new Set();
  function notify() {
    watchers.forEach((el) => {
      if (!el.isConnected) { watchers.delete(el); return; }
      try { if (el.update) el.update(); else if (el._schedule) el._schedule(true); } catch (e) { /* */ }
    });
    try { window.dispatchEvent(new CustomEvent('msh-power-price')); } catch (e) { /* */ }
  }
  M.powerPriceWatch = (el) => { if (el) watchers.add(el); };
  let subbed = false;
  const sub = () => {
    if (subbed || !M.store) return;
    subbed = true;
    M.store.subscribe((d, path) => { if (!path || path === 'power_price' || String(path).startsWith('power_price.')) { memo = null; notify(); } });
  };
  sub();

  /* ------------------------------------------------------------ hovedfunksjonen */
  let memo = null;
  const avg = (a) => { const v = (a || []).filter((x) => x != null); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
  const cnt = (a) => (a || []).filter((x) => x != null).length;
  const addS = (a, b) => a.map((v, i) => (v == null ? null : v + (b ? (b[i] != null ? b[i] : 0) : 0)));
  M.powerPrice = function (hass, cfg, card) {
    sub();
    if (card) M.powerPriceWatch(card);
    const c = cfg && cfg.__pp ? cfg : cfg ? M.powerPriceCfg(cfg) : M.powerPriceCfg();
    const se = c.profile === 'se';
    const auto = se ? !c.se_entity : !c.spot_entity;
    const entity = (se ? c.se_entity : c.spot_entity) || M.powerPriceAuto(hass, c);
    const npEnt = se ? null : c.norgespris_entity || M.norgesprisAuto(hass);
    const gEnt = c.grid_entity || null;
    if (card && card.s) [entity, npEnt, gEnt].forEach((id) => id && card.s(id));
    const h = new Date().getHours();
    const key = JSON.stringify(c) + '|' + h + '|' + (entity || '') + '|' + (npEnt || '');
    if (memo && memo.states === (hass && hass.states) && memo.key === key && memo.tib === TIB.t) return memo.P;

    const st = entity && hass && hass.states ? hass.states[entity] : null;
    const kOf = (s) => (se && c.se_unit === 'ore' ? 0.01 : se && c.se_unit === 'kr' ? 1 : (s && CENT_RX.test(String((s.attributes || {}).currency || ''))) ? 0.01 : M.priceScale(s));
    const k = st ? kOf(st) : 1;
    let s48 = st ? seriesOf(attrLists(st.attributes || {}), k) : Array(48).fill(null);
    const src = c.source || (entity && hass ? (SRC_OK.nordpool(hass, entity) ? 'nordpool' : SRC_OK.tibber(hass, entity) ? 'tibber' : !se && SRC_OK.strompris(hass, entity) ? 'strompris' : 'custom') : '');
    let tibNote = '';
    if (st && src === 'tibber' && !s48.some((v) => v != null)) {
      tibberFetch(hass, entity);
      if (TIB.today || TIB.tomorrow) s48 = seriesOf([TIB.today, TIB.tomorrow], 1);
      tibNote = TIB.busy && !TIB.today ? 'henter priser (tibber.get_prices) …' : TIB.err;
    }
    const spotToday = s48.slice(0, 24), spotTomorrow = s48.slice(24);
    let spotNow = st && M.isNum(st.state) ? Number(st.state) * k : null;
    if (spotNow == null) spotNow = spotToday[h];

    // Nettleie (kr/kWh): tilstand + today/tomorrow
    let grid = null;
    if (gEnt && hass && hass.states[gEnt]) {
      const gs = hass.states[gEnt], gk = M.priceScale(gs), g48 = seriesOf(attrLists(gs.attributes || {}), gk);
      const gNow = M.isNum(gs.state) ? Number(gs.state) * gk : g48[h];
      let gT = g48.slice(0, 24), gM = g48.slice(24);
      if (!gT.some((v) => v != null) && gNow != null) gT = Array(24).fill(gNow);
      const hasM = gM.some((v) => v != null);
      const ta = avg(gT), ma = hasM ? avg(gM) : null;
      grid = { entity: gEnt, now: gNow, today: gT, tomorrow: hasM ? gM : null, todayAvg: ta, tomorrowAvg: ma, diff: ta != null && ma != null ? ma - ta : null };
    }
    // Norgespris (kr/kWh): sensor, ellers fast sats
    let norgespris = null;
    if (!se) {
      const ns = npEnt && hass && hass.states[npEnt];
      norgespris = ns && M.isNum(ns.state) ? { v: Number(ns.state) * M.priceScale(ns), entity: npEnt } : { v: c.norgespris, entity: null };
    }
    const gT = grid ? grid.today : null, gM = grid ? grid.tomorrow : null;
    const flat = (arr, v) => arr.map((x) => (x == null ? null : v));
    let today, tomorrow, now, ref = null;
    if (c.mode === 'total') {
      today = addS(spotToday, gT); tomorrow = addS(spotTomorrow, gM || gT);
      now = spotNow == null ? null : spotNow + (grid && grid.now != null ? grid.now : 0);
      if (norgespris) {
        const nT = spotToday.map((x, i) => (x == null ? null : norgespris.v + (gT && gT[i] != null ? gT[i] : 0)));
        const nM = spotTomorrow.map((x, i) => (x == null ? null : norgespris.v + ((gM || gT) && (gM || gT)[i] != null ? (gM || gT)[i] : 0)));
        ref = { label: grid ? 'Norgespris m/ nettleie' : 'Norgespris', now: norgespris.v + (grid && grid.now != null ? grid.now : 0), today: nT, tomorrow: nM };
      }
    } else if (c.mode === 'norgespris' && norgespris) {
      const base = grid ? addS(Array(24).fill(norgespris.v), gT) : Array(24).fill(norgespris.v);
      const baseM = grid ? addS(Array(24).fill(norgespris.v), gM || gT) : Array(24).fill(norgespris.v);
      today = base; tomorrow = spotTomorrow.some((v) => v != null) ? baseM : Array(24).fill(null);
      now = norgespris.v + (grid && grid.now != null ? grid.now : 0);
      ref = { label: grid ? 'Spot m/ nettleie' : 'Spot', now: spotNow == null ? null : spotNow + (grid && grid.now != null ? grid.now : 0), today: addS(spotToday, gT), tomorrow: addS(spotTomorrow, gM || gT) };
    } else {
      today = spotToday; tomorrow = spotTomorrow; now = spotNow;
      if (norgespris) ref = { label: 'Norgespris', now: norgespris.v, today: flat(Array(24).fill(0), norgespris.v), tomorrow: flat(spotTomorrow, norgespris.v) };
    }
    const nT = cnt(spotToday), nM = cnt(spotTomorrow);

    // Status
    let status, kind = 'ok';
    if (!entity) { status = se ? 'Fant ingen Nord Pool-sensor i SEK – velg entitet' : 'Fant ingen pris-sensor – velg entitet'; kind = 'err'; }
    else if (!st) { status = `${entity} finnes ikke`; kind = 'err'; }
    else if (!M.isNum(st.state)) { status = `${entity} har ingen tallverdi (${st.state})`; kind = 'err'; }
    else if (!nT) { status = `${entity} · ${tibNote || 'ingen timepriser – bare nåpris'}`; kind = 'warn'; }
    else if (!nM) { status = `${entity} · ${nT} timer i dag · Mangler i morgen-priser`; kind = 'warn'; }
    else status = `${entity} · ${nT} timer i dag, ${nM} i morgen`;
    if (kind !== 'err' && gEnt && !(hass && hass.states[gEnt])) { status += ` · nettleie ${gEnt} finnes ikke`; kind = 'warn'; }

    const ore = c.unit === 'ore';
    const P = {
      cfg: c, profile: c.profile, source: src, area: (se ? c.se_area : c.area) || (entity && hass ? areaOfSensor(hass, entity) : '') || '',
      mode: c.mode, currency: se ? 'SEK' : 'NOK', entity: entity || null, auto, state: st,
      now, spotNow, today, tomorrow, spotToday, spotTomorrow, ref, grid, norgespris,
      hasToday: today.some((v) => v != null), hasTomorrow: tomorrow.some((v) => v != null), nToday: nT, nTomorrow: nM,
      unit: ore ? 'øre/kWh' : 'kr/kWh', k: ore ? 100 : 1, graphUnit: se ? 'öre/kWh' : 'øre/kWh',
      status, statusKind: kind,
      fmt(v, o) {
        if (v == null || isNaN(v)) return '–';
        const u = o && o.unit ? (ore ? ' øre/kWh' : ' kr/kWh') : ore ? ' øre' : ' kr';
        return (ore ? M.nf(v * 100, Math.abs(v) < 0.1 ? 1 : 0) : M.nf(v, 2)) + u;
      },
      val(v) { return v == null || isNaN(v) ? '–' : ore ? M.nf(v * 100, Math.abs(v) < 0.1 ? 1 : 0) : M.nf(v, 2); },
      cheapest(o) {
        const day = o && o.day === 'tomorrow' ? tomorrow : today, from = o && o.fromNow === false ? 0 : o && o.day === 'tomorrow' ? 0 : h;
        const L = day.map((v, i) => [v, i]).filter(([v, i]) => v != null && i >= from);
        if (!L.length) return null;
        const m = L.reduce((a, b) => (b[0] < a[0] ? b : a));
        return { h: m[1], v: m[0] };
      },
    };
    memo = { states: hass && hass.states, key, tib: TIB.t, P };
    return P;
  };

  /* ------------------------------------------------------------ bakoverkompatible tynne wrappere */
  // Samme sensor for prosa-boblen, sliden, romvarsler og strømpriskortet: overrides.price → power_price (ki-store) → auto.
  M.priceSensor = function (hass, cfg) {
    const o = (cfg && cfg.overrides) || {};
    if (o.price) return o.price;
    return M.powerPrice(hass).entity;
  };
  M.norgesprisSensor = function (hass, cfg) {
    if (cfg && cfg.norgespris_entity) return cfg.norgespris_entity;
    const c = M.powerPriceCfg();
    return c.norgespris_entity || M.norgesprisAuto(hass);
  };
})();
