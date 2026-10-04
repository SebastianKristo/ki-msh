/* KI MSH · Fiks 47 S.2 / U · felles datakilder for Strømregning og Norgespris (M.stromRegning, «strom-regning.js»).
 *
 * Portert fra ki-cards/src/89-ki-strom-detaljer-card.js (ki-strom-detaljer-card, brukerens fungerende #stromregning):
 *   STANDARD (samme nøkler), _regningId, _regningMaaned, _regningPeriode, _postStolpe, _postRutenett, _dagerFor.
 *   Forskjellen: her returneres DATA (rader/segmenter/søyler), ikke HTML – undersidene i 63-strom-sider.js tegner dem
 *   med det nye designet (Strøm popup v3.dc.html).
 *
 * Kilder (overstyres i kortets config under `sensorer:` med de samme nøklene, f.eks. `sensorer: { estimat: sensor.x }`):
 *   STANDARD er det gamle kortets standardoppsett (Strømkalkulator `sensor.manedlig_forbruk_*`, Elvia `sensor.nettleie_elvia_*`,
 *   `sensor.norgespris_besparelse_*`, powercalc-kostnadene, `input_number.fastledd_<måned>`). En ID brukes BARE når entiteten
 *   finnes i hass.states – ellers er verdien null og siden viser «–». Ingenting gjettes.
 *   Oversiktssensoren fra ki_enhetsforbruk (`regning`) finnes på attributtene integrasjon: ki_enhetsforbruk + type: regning.
 *   Eldre måneder (kalender): tjenesten ki_enhetsforbruk.historikk med return_response (hass.callWS call_service), 5 min cache.
 *
 * Fortegn («regningsbidrag»): rad.v > 0 øker regningen, rad.v < 0 trekkes fra. Total = summen av radene (samme periode).
 *   Strømstøtte = −|støtte|. Norgespris: boka (poster.norgespris) er allerede med fortegn (negativ = fratrekk);
 *   Strømkalkulator (norgespris_kompensasjon) er kompensasjonen → rad = −kompensasjon.
 *   Norgespris-siden: spart = spot − Norgespris (positiv = spart, negativ = tapt).
 * Feilsøking: window.KI_STROM_DEBUG = true (eller localStorage 'ki-strom-debug' = 1) logger kildene og avvik > 1 kr.
 */
(function () {
  const M = window.MSH = window.MSH || {};
  if (M.stromRegning) return;
  const P = 'sensor.manedlig_forbruk_', PC = 'sensor.strommaler_strommaler_powercalc_', E = 'sensor.nettleie_elvia_';
  // Standardkildene fra ki-strom-detaljer-card (samme nøkler). Brukes bare når entiteten finnes.
  const STANDARD = {
    maned: 'sensor.maned',
    regning: '', // tom → finnes på attributtene integrasjon/type
    estimat: P + 'estimert_manedskostnad', akkumulert: P + 'akkumulert_stromkostnad', idag: P + 'dagens_kostnad',
    nettleie: P + 'manedlig_nettleie_total', avgifter: P + 'manedlig_avgifter', stromstotte: P + 'manedlig_stromstotte',
    kompensasjon: P + 'norgespris_kompensasjon', besparelse_mnd: P + 'norgespris_besparelse',
    forbruk_totalt: P + 'manedlig_forbruk_totalt', forbruk_dag: P + 'manedlig_forbruk_dagtariff', forbruk_natt: P + 'manedlig_forbruk_natt_helg',
    snitt: E + 'snitt_toppforbruk', topp1: E + 'toppforbruk', topp2: E + 'toppforbruk_2', topp3: E + 'toppforbruk_3',
    margin: E + 'margin_til_neste_trinn', terskel: 'sensor.neste_effektledd_terskel', trinn: E + 'kapasitetstrinn_intervall',
    maned_prefiks: 'input_number.fastledd_',
    spart_time: 'sensor.norgespris_besparelse_time', spart_dag: 'sensor.norgespris_besparelse_dag', spart_uke: 'sensor.norgespris_besparelse_uke',
    spart_maned: 'sensor.norgespris_besparelse_maned', spart_ar: 'sensor.norgespris_besparelse_ar',
    spot_dag: PC + 'daily_energy_cost_2', np_dag: PC + 'daily_energy_cost_3', spot_uke: PC + 'weekly_energy_cost_2', np_uke: PC + 'weekly_energy_cost_3',
    spot_maned: PC + 'monthly_energy_cost_2', np_maned: PC + 'monthly_energy_cost_3', spot_ar: PC + 'yearly_energy_cost_2', np_ar: PC + 'yearly_energy_cost_3',
  };
  const MND = ['januar', 'februar', 'mars', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'desember'];
  const isNum = (v) => v != null && v !== '' && !isNaN(Number(v));
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const d0 = (d) => { const x = new Date(d || Date.now()); x.setHours(0, 0, 0, 0); return x; };
  const debugOn = () => { try { return !!(window.KI_STROM_DEBUG || (window.localStorage && localStorage.getItem('ki-strom-debug'))); } catch (e) { return !!window.KI_STROM_DEBUG; } };
  const LOGGED = new Map(); // samme melding logges bare én gang per minutt
  const dbg = (msg, data) => { if (!debugOn()) return; const k = msg + JSON.stringify(data || ''); const t = LOGGED.get(k); if (t && Date.now() - t < 60000) return; LOGGED.set(k, Date.now()); console.info('[ki-msh strøm]', msg, data || ''); };

  /* ------------------------------------------------------------ kilder */
  const sensors = (cfg) => ({ ...STANDARD, ...((cfg && cfg.sensorer && typeof cfg.sensorer === 'object') ? cfg.sensorer : {}) });
  const has = (h, id) => !!(h && h.states && id && h.states[id]);
  const idOf = (h, S, k) => (has(h, S[k]) ? S[k] : null);
  const numId = (h, id) => { if (!has(h, id)) return null; const n = parseFloat(h.states[id].state); return isNaN(n) ? null : n; };
  const num = (h, S, k) => numId(h, S[k]);
  const FOUND = new WeakMap(); // hass.states → funnet oversikts-ID
  // _regningId: config → markørene integrasjon: ki_enhetsforbruk + type: regning (aldri gjettet)
  function regningId(h, S) {
    if (!h || !h.states) return null;
    if (S.regning) return has(h, S.regning) ? S.regning : null;
    if (FOUND.has(h.states)) return FOUND.get(h.states);
    const id = Object.keys(h.states).find((x) => { const a = h.states[x] && h.states[x].attributes; return a && a.integrasjon === 'ki_enhetsforbruk' && a.type === 'regning'; }) || null;
    FOUND.set(h.states, id);
    return id;
  }
  const book = (h, S) => { const id = regningId(h, S); return id ? { id, a: h.states[id].attributes || {} } : null; };

  /* ------------------------------------------------------------ poster → rader / stolpe (_postRutenett / _postStolpe) */
  const FELT = [
    ['kostnad', 'Strøm'], ['nettleie', 'Nettleie'], ['avgifter', 'Avgifter'], ['stromstotte', 'Strømstøtte'], ['norgespris', 'Norgespris'],
  ];
  // Rader med regningsfortegn. Strøm/Nettleie/Avgifter/Norgespris er alltid med (null → «–»), Strømstøtte bare når ≠ 0.
  function postRutenett(poster, id) {
    const p = poster || {};
    return FELT.map(([k, l]) => {
      const raw = isNum(p[k]) ? Number(p[k]) : null;
      const v = raw == null ? null : k === 'stromstotte' ? -Math.abs(raw) : raw;
      return { k, l, v, id: id || null };
    }).filter((r) => r.k !== 'stromstotte' || (r.v != null && Math.abs(r.v) > 0.004));
  }
  // Fordelingen i toppkortet: bare postene som koster noe (Strøm / Nettleie / Avgifter)
  function postStolpe(rows) {
    const deler = (rows || []).filter((r) => ['kostnad', 'nettleie', 'avgifter'].includes(r.k) && r.v != null && r.v > 0);
    const sum = deler.reduce((t, r) => t + r.v, 0);
    return sum > 0 ? deler.map((r) => ({ k: r.k, l: r.l, v: r.v, f: r.v / sum, id: r.id })) : [];
  }
  // Total = summen av radene (null når Strøm mangler – da er regningen ukjent)
  function sumRows(rows) {
    const s = (rows || []).find((r) => r.k === 'kostnad');
    if (!s || s.v == null) return null;
    return rows.reduce((t, r) => t + (r.v || 0), 0);
  }
  const addInto = (acc, obj) => { Object.entries(obj || {}).forEach(([k, v]) => { if (isNum(v)) acc[k] = (acc[k] || 0) + Number(v); }); return acc; };

  /* ------------------------------------------------------------ måneden fra Strømkalkulator (_regningMaaned) */
  function maaned(h, S) {
    const akk = num(h, S, 'akkumulert');
    if (akk == null) return null;
    const komp = num(h, S, 'kompensasjon'), stotte = num(h, S, 'stromstotte');
    const rows = [
      { k: 'kostnad', l: 'Strøm', v: akk, id: idOf(h, S, 'akkumulert') },
      { k: 'nettleie', l: 'Nettleie', v: num(h, S, 'nettleie'), id: idOf(h, S, 'nettleie') },
      { k: 'avgifter', l: 'Avgifter', v: num(h, S, 'avgifter'), id: idOf(h, S, 'avgifter') },
    ];
    if (stotte) rows.push({ k: 'stromstotte', l: 'Strømstøtte', v: -Math.abs(stotte), id: idOf(h, S, 'stromstotte') });
    rows.push({ k: 'norgespris', l: 'Norgespris', v: komp == null ? null : -komp, id: idOf(h, S, 'kompensasjon') });
    const dag = num(h, S, 'forbruk_dag'), natt = num(h, S, 'forbruk_natt'), tot = num(h, S, 'forbruk_totalt');
    const R = {
      src: 'strømkalkulator', rows, sum: sumRows(rows),
      estimat: { v: num(h, S, 'estimat'), id: idOf(h, S, 'estimat') }, idag: { v: num(h, S, 'idag'), id: idOf(h, S, 'idag') },
      spart: { v: num(h, S, 'besparelse_mnd'), id: idOf(h, S, 'besparelse_mnd') },
      energi: dag != null || natt != null || tot != null ? { forbruk_dag: dag, forbruk_natt: natt, forbruk_totalt: tot != null ? tot : (dag || 0) + (natt || 0), ids: { dag: idOf(h, S, 'forbruk_dag'), natt: idOf(h, S, 'forbruk_natt'), tot: idOf(h, S, 'forbruk_totalt') } } : null,
    };
    dbg('Måned (Strømkalkulator)', { rader: rows.map((r) => [r.l, r.v, r.id]), sum: R.sum, estimat: R.estimat.v });
    return R;
  }

  /* ------------------------------------------------------------ dag / uke / måned / år fra boka (_regningPeriode) */
  // per: 0 dag (14 døgn bakover som søyler) · 1 uke (fra mandag) · 2 måned (døgnene i måneden) · 3 år (månedene)
  function periode(h, S, per, valgtId) {
    const B = book(h, S);
    if (!B) return null;
    const a = B.a, na = d0();
    let rader;
    if (per === 3) {
      rader = (Array.isArray(a.maneder) ? a.maneder : []).map((m, i) => ({
        id: 'm' + i, sum: isNum(m && m.sum) ? Number(m.sum) : null, poster: m && m.poster, energi: m && m.energi, fremtid: !!(m && m.fremtid),
        navn: m && m.navn ? String(m.navn)[0].toUpperCase() + String(m.navn).slice(1) : (MND[i] ? MND[i][0].toUpperCase() + MND[i].slice(1) : ''),
        merke: String((m && m.navn) || MND[i] || '·')[0].toUpperCase(), pagaende: !!(m && m.pagaende), mnd: i,
      }));
    } else {
      const alle = Array.isArray(a.dager) ? a.dager : [];
      const fra = new Date(na);
      if (per === 0) fra.setDate(na.getDate() - 13);
      else if (per === 1) fra.setDate(na.getDate() - ((na.getDay() + 6) % 7));
      else fra.setDate(1);
      rader = [];
      for (const d = new Date(fra); d <= na; d.setDate(d.getDate() + 1)) {
        const dato = iso(d), funn = alle.find((x) => x && x.dato === dato);
        rader.push({
          id: dato, dato, sum: funn && isNum(funn.sum) ? Number(funn.sum) : null, poster: funn && funn.poster, energi: funn && funn.energi, timer: funn && funn.timer,
          navn: d.toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' }),
          merke: per === 1 ? ['S', 'M', 'T', 'O', 'T', 'F', 'L'][d.getDay()] : (d.getDate() % 2 ? '' : String(d.getDate())),
          pagaende: dato === iso(na), helg: d.getDay() % 6 === 0,
        });
      }
    }
    const valgt = valgtId ? rader.find((r) => r.id === valgtId) || null : null;
    let poster, energi = null, sensorSum, tittel, undertekst, ekstra = null;
    if (valgt) {
      poster = valgt.poster; energi = valgt.energi || null; sensorSum = valgt.sum; tittel = valgt.navn;
      undertekst = valgt.pagaende ? 'Så langt' : per === 3 ? 'Hele måneden' : 'Hele døgnet';
    } else if (per === 0) {
      const today = rader.find((r) => r.pagaende);
      poster = a.poster_i_dag || (today && today.poster); energi = (today && today.energi) || null; sensorSum = isNum(a.i_dag) ? Number(a.i_dag) : null; tittel = 'i dag';
      undertekst = 'Så langt i dag'; if (isNum(a.dagens_energikostnad)) ekstra = { l: 'strøm', v: Number(a.dagens_energikostnad) };
    } else if (per === 1) {
      poster = {}; energi = {};
      rader.forEach((r) => { addInto(poster, r.poster); addInto(energi, r.energi); });
      sensorSum = isNum(a.denne_uken) ? Number(a.denne_uken) : null; tittel = 'denne uken'; undertekst = 'Fra mandag til i dag';
    } else if (per === 2) {
      poster = {}; energi = {};
      rader.forEach((r) => { addInto(poster, r.poster); addInto(energi, r.energi); });
      sensorSum = rader.some((r) => r.sum != null) ? rader.reduce((t, r) => t + (r.sum || 0), 0) : null; tittel = MND[na.getMonth()]; undertekst = 'Hittil i måneden';
    } else {
      poster = {}; energi = {};
      rader.forEach((r) => { addInto(poster, r.poster); addInto(energi, r.energi); });
      sensorSum = isNum(a.i_ar) ? Number(a.i_ar) : null; tittel = String(a.ar || na.getFullYear()); undertekst = 'Hittil i år';
      if (isNum(a.i_fjor)) ekstra = { l: 'i fjor', v: Number(a.i_fjor) };
    }
    if (energi && !Object.keys(energi).length) energi = null;
    const havePoster = poster && Object.keys(poster).some((k) => isNum(poster[k]));
    const rows = havePoster ? postRutenett(poster, B.id) : null;
    const sum = rows ? sumRows(rows) : null;
    if (sum != null && sensorSum != null && Math.abs(sum - sensorSum) > 1) dbg(`Avvik > 1 kr: sum av radene ${sum.toFixed(2)} ≠ boka ${sensorSum.toFixed(2)} (${tittel})`, { kilde: B.id, poster });
    dbg('Periode (ki_enhetsforbruk)', { kilde: B.id, per, tittel, rader: rows && rows.map((r) => [r.l, r.v]), sum, energi });
    return { src: 'ki_enhetsforbruk', id: B.id, a, rader, valgt, rows, sum, sensorSum, energi, tittel, undertekst, ekstra };
  }

  /* ------------------------------------------------------------ døgnene for én måned (_dagerFor) – kalender */
  const HENTET = new Map(); // `${id}|${yyyy-mm}` → { t, dager, busy }
  const TTL = 300000;
  function dagerFor(h, B, nokkel, onDone) {
    if (!B) return [];
    const fra = (Array.isArray(B.a.dager) ? B.a.dager : []).filter((d) => String((d && d.dato) || '').startsWith(nokkel));
    if (fra.length) return fra;
    const key = B.id + '|' + nokkel;
    const c = HENTET.get(key);
    if (c && (c.busy || Date.now() - c.t < TTL)) return c.dager;
    if (!h || !h.callWS) return [];
    const x = { t: Date.now(), dager: c ? c.dager : [], busy: true };
    HENTET.set(key, x);
    Promise.resolve().then(() => h.callWS({ type: 'call_service', domain: 'ki_enhetsforbruk', service: 'historikk', service_data: { maned: nokkel }, return_response: true }))
      .then((svar) => {
        const regninger = (svar && svar.response && svar.response.regninger) || {};
        const forste = regninger[B.id] || Object.values(regninger)[0];
        x.dager = (forste && Array.isArray(forste.dager)) ? forste.dager : [];
      })
      .catch(() => { /* eldre integrasjon uten tjenesten: tom måned */ })
      .finally(() => { x.busy = false; x.t = Date.now(); if (onDone) try { onDone(); } catch (e) { /* */ } });
    return x.dager;
  }

  /* ------------------------------------------------------------ Norgespris: spot / Norgespris / spart per periode */
  const NPK = { 'I dag': 'dag', Uke: 'uke', Måned: 'maned', År: 'ar' };
  function np(h, S, k) {
    const spot = { v: num(h, S, 'spot_' + k), id: idOf(h, S, 'spot_' + k) };
    const ng = { v: num(h, S, 'np_' + k), id: idOf(h, S, 'np_' + k) };
    const sens = { v: num(h, S, 'spart_' + k), id: idOf(h, S, 'spart_' + k) };
    const diff = spot.v != null && ng.v != null ? spot.v - ng.v : null;
    if (sens.v != null && diff != null && Math.abs(sens.v - diff) > 1) dbg(`Avvik > 1 kr (${k}): ${sens.id} = ${sens.v.toFixed(2)} ≠ spot − Norgespris = ${diff.toFixed(2)}`);
    const spart = sens.v != null ? sens.v : diff;
    dbg('Norgespris ' + k, { spot: [spot.id, spot.v], norgespris: [ng.id, ng.v], spart: [sens.id || 'spot − NP', spart] });
    return { spot, np: ng, spart: { v: spart, id: sens.id || spot.id || ng.id, sensor: sens.v != null } };
  }

  /* ------------------------------------------------------------ effekttrinn (Elvia) og effektledd per måned */
  function effekt(h, S) {
    const snitt = num(h, S, 'snitt');
    const topp = ['topp1', 'topp2', 'topp3'].map((k) => {
      const id = idOf(h, S, k), a = id ? h.states[id].attributes || {} : {};
      const t = a.tidspunkt || a.dato || a.time || a.timestamp || a.start || null;
      const dt = t ? new Date(t) : null;
      return { v: num(h, S, k), id, dato: dt && !isNaN(dt) ? dt : null };
    });
    const trinnId = idOf(h, S, 'trinn'), terskelId = idOf(h, S, 'terskel');
    const R = {
      snitt: { v: snitt, id: idOf(h, S, 'snitt') }, topp,
      margin: { v: num(h, S, 'margin'), id: idOf(h, S, 'margin') },
      terskel: { v: num(h, S, 'terskel'), id: terskelId, neste: terskelId ? h.states[terskelId].attributes || {} : {} },
      trinn: { s: trinnId ? String(h.states[trinnId].state) : null, id: trinnId },
    };
    R.any = snitt != null || topp.some((t) => t.v != null) || R.trinn.s != null;
    return R;
  }
  function effektledd(h, S) {
    const pre = S.maned_prefiks || '';
    const L = MND.map((m) => { const id = pre + m; return { id: has(h, id) ? id : null, v: numId(h, id) }; });
    return L.some((x) => x.id) ? L : null;
  }

  /* ------------------------------------------------------------ timeforbruk i dag fra boka (dager[].timer) */
  // timer: [kWh × 24] eller [{ time|t|start|h, forbruk|kwh|v|value }] → Map(time → kWh)
  function timerI(dag) {
    const T = dag && dag.timer, out = new Map();
    if (!T) return out;
    const arr = Array.isArray(T) ? T : typeof T === 'object' ? Object.entries(T).map(([k, v]) => ({ h: k, v })) : [];
    arr.forEach((x, i) => {
      if (isNum(x)) { out.set(i, Number(x)); return; }
      if (!x || typeof x !== 'object') return;
      let hr = isNum(x.h) ? Number(x.h) : isNum(x.time) ? Number(x.time) : null;
      const ts = x.start || x.t || (typeof x.time === 'string' && !isNum(x.time) ? x.time : null) || (typeof x.h === 'string' && !isNum(x.h) ? x.h : null);
      if (hr == null && ts) { const d = new Date(String(ts).length <= 5 ? `1970-01-01T${ts}` : ts); if (!isNaN(d)) hr = d.getHours(); }
      const v = [x.forbruk, x.kwh, x.v, x.value, x.energi].find(isNum);
      if (hr != null && v != null && hr >= 0 && hr < 24) out.set(hr, Number(v));
    });
    return out;
  }

  // Etiketter for editorene (Tilpass → Kilder / getConfigElement): config sensorer.<nøkkel>
  const FIELDS = [
    ['regning', 'Strømregning-oversikt (ki_enhetsforbruk)'], ['estimat', 'Estimert månedskostnad'], ['akkumulert', 'Strøm hittil (måned)'], ['idag', 'Dagens kostnad'],
    ['nettleie', 'Nettleie (måned)'], ['avgifter', 'Avgifter (måned)'], ['stromstotte', 'Strømstøtte (måned)'], ['kompensasjon', 'Norgespris-kompensasjon (måned)'], ['besparelse_mnd', 'Norgespris spart (måned)'],
    ['forbruk_totalt', 'Forbruk måned'], ['forbruk_dag', 'Forbruk dagtariff'], ['forbruk_natt', 'Forbruk natt/helg'],
    ['snitt', 'Effekt snitt av 3 topper'], ['topp1', 'Toppforbruk #1'], ['topp2', 'Toppforbruk #2'], ['topp3', 'Toppforbruk #3'], ['margin', 'Margin til neste trinn'], ['terskel', 'Neste effektledd-terskel'], ['trinn', 'Kapasitetstrinn'],
    ['spart_time', 'Spart denne timen'], ['spart_dag', 'Spart i dag'], ['spart_uke', 'Spart denne uken'], ['spart_maned', 'Spart denne måneden'], ['spart_ar', 'Spart i år'],
    ['spot_dag', 'Kostnad spot i dag'], ['np_dag', 'Kostnad Norgespris i dag'], ['spot_uke', 'Kostnad spot uke'], ['np_uke', 'Kostnad Norgespris uke'],
    ['spot_maned', 'Kostnad spot måned'], ['np_maned', 'Kostnad Norgespris måned'], ['spot_ar', 'Kostnad spot år'], ['np_ar', 'Kostnad Norgespris år'],
  ];
  M.stromRegning = { STANDARD, FIELDS, MND, NPK, sensors, has, idOf, num, numId, regningId, book, postRutenett, postStolpe, sumRows, maaned, periode, dagerFor, np, effekt, effektledd, timerI, iso, dbg, debugOn };
})();
