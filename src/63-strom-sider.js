/* KI MSH · Strøm-popup v3 (#strom) · undersidene Norgespris, Strømregning og Strøminnstillinger (Del 45 §6).
 * Fasit: design/Strøm popup v3.dc.html (isNorge / isBill / isSet). Vertskortet (src/61-strom.js, msh-strom-card) kaller
 *   M.stromSider.html(host, page) inne i sin render og M.stromSider.bind(host, el, page) etter render (delegerte lyttere,
 *   idempotent). page = 'norgespris' | 'stromregning' | 'innstillinger'. Attributter data-ss-*, klasser ss-*.
 * host: hass, config, ui (UI-tilstand), ent(role), setCfg(patch), render(), go(page|null), anim, haptic(type).
 *
 * Data (aldri mock – mangler → «–» og flate grafer):
 *   Timeforbruk: recorder/statistics_during_period (period hour, types change+mean) for host.ent('forbruk')
 *     (ellers Energi-oppsettets nett-import, MSH.energiSources), spotpris host.ent('spot'), Norgespris host.ent('norge')
 *     og Nord Pool-sensoren (MSH.powerPrice). Hentes bare mens en underside er åpen. Timer (period hour) bare fra
 *     min(mandag, 1. i måneden) – i dag, Uke, Måned og effekttrinn; År: tidligere måneder med period month (bare når År
 *     er valgt); effektledd for en tidligere måned: timer for den ene måneden når den velges. Alt
 *     mellomlagres 5 min. Dagens priser uten statistikk fylles fra prislistene (MSH.priceSeries); Norgespris er fast
 *     sats → nåverdien brukes for timer uten statistikk. Inneværende time = dagssensorens tilstand − dagens timesum.
 *   Fiks 47 S.2/U: kildene fra det gamle ki-strom-detaljer-card via M.stromRegning (src/60-strom-regning.js, overstyres i
 *     config `sensorer:` med de samme nøklene). Bare entiteter som finnes brukes; mangler → «–». Statistikk hentes bare når
 *     en kilde mangler (estimatet under) eller for timegrafen i Norgespris.
 *   Norgespris: spot = powercalc *_energy_cost_2, Norgespris = *_energy_cost_3, spart = norgespris_besparelse_<periode>
 *     (sensoren foretrekkes, ellers spot − Norgespris; ellers statistikk-estimat). spart > 0 = grønt/«Spart», < 0 = rødt,
 *     «Tapt» og «−». Merket = |spart| / spot. Timegraf = (spot − Norgespris) × kWh per time (kWh fra ki_enhetsforbruk
 *     dager[].timer, ellers statistikk); fremtidige timer dempet (prisforskjell × dagens snittforbruk). Fliser: besparelse
 *     time/dag/uke. Trykk → more-info (data-ss-mer).
 *   Strømregning: Måned = Strømkalkulator (manedlig_forbruk_*: akkumulert, nettleie, avgifter, støtte, kompensasjon,
 *     forbruk dag/natt), Dag/Uke/År/valgt døgn/kalender = ki_enhetsforbruk-oversikten (poster/energi, maneder[], tjenesten
 *     historikk for eldre måneder). Total = summen av radene. Effekttrinn = nettleie_elvia_*, effektledd =
 *     input_number.fastledd_<måned>. Uten disse: estimatet under (statistikk × satsene i Strøminnstillinger).
 *   Estimat: Strøm = Σ kWh × (Nord Pool + påslag), Nettleie = Σ kWh × dag-/nattsats (+ effektledd når
 *     config sider.effektledd = [kr/mnd for trinn 0–2, 2–5, 5–10, 10–15, 15–20 kW] finnes), Norgespris-fratrekk =
 *     Σ kWh × (Norgespris − spot), Avgifter = moms. Effekttrinn = snitt av de 3 høyeste døgnmaksimumene (kWh/t).
 *   Strøminnstillinger: verdiene (øre/kWh uten moms, %) leses fra input_number/number som finnes (config sider.ent.<k>
 *     eller funnet på navn), ellers config sider.<k>. Trykk → rediger tallet → input_number/number.set_value eller
 *     host.setCfg({ sider }). Terskel 77 øre, 90 % og moms 25 % er satsene fra myndighetene (standard), resten «–».
 */
(function () {
  const M = window.MSH;
  if (!M || M.stromSider) return;
  const esc = M.esc, TH = M.theme || {};
  const AT = (c) => (TH.accentText ? TH.accentText(c) : c);
  const WA = (a) => (TH.whiteA ? TH.whiteA(a) : `rgb(255 255 255 / ${a})`);
  const KA = (a) => (TH.blackA ? TH.blackA(a) : `rgb(0 0 0 / ${a})`);
  const ic = (n, s, st) => M.icon(n, s, st);
  const TTL = 300000, HR = 3600000;
  // Aksentene i designet (flater/fyll beholder aksenten; tekst/ikon via AT)
  const PINK = 'linear-gradient(160deg,#f28ac9,#f6c9c4)';
  const INK = 'var(--ki-on-accent, rgba(50,38,44,.95))';
  const BLUE = '#73b8f2', ORANGE = '#f2b46f', PURPLE = '#a98ff0', GREENF = 'rgb(110 200 160)', AMBER = '#f2b04f';
  const GREEN = 'rgb(120 210 165)', RED = 'rgb(240 120 100)';
  const GREEN_T = 'var(--ki-green-text, rgb(140 225 180))', RED_T = 'var(--ki-red-text, rgb(240 120 100))';
  const MN = ['Januar', 'Februar', 'Mars', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Desember'];
  const ML = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
  const MS = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des'];
  const STEPS = [['0–2', 0, 2], ['2–5', 2, 5], ['5–10', 5, 10], ['10–15', 10, 15], ['15–20', 15, 20]];
  const NP_PER = [['I dag', 'i dag'], ['Uke', 'denne uken'], ['Måned', 'denne måneden'], ['År', 'i år']];
  const BP_PER = ['Dag', 'Uke', 'Måned', 'År'];

  const fx = (n, d) => (n == null || isNaN(n) ? '–' : (n < 0 ? '−' : '') + Math.abs(n).toLocaleString('nb-NO', { minimumFractionDigits: d, maximumFractionDigits: d }));
  const nb = (n, d) => (n == null || isNaN(n) ? '–' : (n < 0 ? '−' : '') + Math.abs(n).toLocaleString('nb-NO', { maximumFractionDigits: d }));
  const fmt1 = (v) => fx(v, Math.abs(v) >= 100 ? 0 : 1);
  const isNum = (v) => v != null && v !== '' && !isNaN(Number(v));
  const st = (h, id) => (h && id && h.states && h.states[id]) || null;
  const numOf = (h, id) => { const s = st(h, id); return s && isNum(s.state) ? Number(s.state) : null; };
  const priceOf = (h, id) => { const s = st(h, id); return s && isNum(s.state) ? Number(s.state) * (M.priceScale ? M.priceScale(s) : 1) : null; };
  const hk = (t) => Math.floor(t / HR); // timenøkkel (hele timer – norsk tidssone har hele-time-forskyvning)
  const d0 = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  const isoWeek = (d) => { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const n = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - n); const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return Math.ceil(((t - y0) / 86400000 + 1) / 7); };
  const monday = (d) => { const x = d0(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
  const S = new WeakMap(); // ren, ikke-persistert tilstand per vert: { edit, draft, scrub, focused }
  const sOf = (host) => { let s = S.get(host); if (!s) S.set(host, (s = { edit: null, draft: null, scrub: null, focused: null })); return s; };
  const hp = (host, t) => { try { if (host && host.haptic) host.haptic(t || 'light'); else M.haptic(t || 'light'); } catch (e) { /* */ } };
  const ui = (host) => host.ui || (host.ui = {});
  const ent = (host, r) => { try { return host.ent ? host.ent(r) : null; } catch (e) { return null; } };
  const cfgS = (host) => ((host.config && host.config.sider) || {});

  /* ------------------------------------------------------------ statistikk (hentes når undersiden åpnes, 5 min) */
  const CACHE = new Map(); // key → { t, busy, data, hosts:Set }
  const tsOf = (v) => (typeof v === 'number' ? v : Date.parse(v));
  function srcIds(host) {
    const h = host.hass;
    let pp = null; try { pp = M.powerPrice ? M.powerPrice(h) : null; } catch (e) { /* */ }
    let gin = [];
    try { if (M.energiPrefs) M.energiPrefs(h); const R = M.energiSources ? M.energiSources(h, {}) : null; gin = (R && R.grid_in) || []; } catch (e) { /* */ }
    const forbruk = ent(host, 'forbruk');
    return { energy: [forbruk, ...gin].filter((x, i, a) => x && a.indexOf(x) === i), spot: ent(host, 'spot'), norge: ent(host, 'norge') || (pp && pp.norgespris && pp.norgespris.entity) || null, nord: (pp && pp.entity) || null, pp, forbruk };
  }
  // Felles WS-hent med 5 min mellomlager; vertene tegnes på nytt når svaret kommer
  function ws(host, key, req) {
    const h = host.hass;
    if (!h || !h.callWS) return null;
    let c = CACHE.get(key);
    if (!c) CACHE.set(key, (c = { t: 0, busy: false, data: null, hosts: new Set() }));
    c.hosts.add(host);
    if (!c.busy && Date.now() - c.t > TTL) {
      c.busy = true;
      Promise.resolve().then(() => h.callWS({ type: 'recorder/statistics_during_period', ...req }))
        .then((r) => { c.data = r || {}; }).catch(() => { c.data = c.data || {}; })
        .finally(() => { c.busy = false; c.t = Date.now(); c.hosts.forEach((x) => { if (x.isConnected !== false) { try { x.render(); } catch (e) { /* */ } } }); c.hosts.clear(); });
    }
    return c.data;
  }
  const allIds = (ids) => [...ids.energy, ids.spot, ids.norge, ids.nord].filter((x, i, a) => x && a.indexOf(x) === i);
  // Timedata bare for det som trenger timer: i dag, denne uken og denne måneden (effekttrinn) → fra min(mandag, 1. i mnd)
  function fetchHourly(host, ids) {
    const all = allIds(ids);
    if (!all.length) return null;
    const now = new Date(), start = new Date(Math.min(new Date(now.getFullYear(), now.getMonth(), 1).getTime(), monday(now).getTime()));
    return ws(host, 'h|' + all.join(',') + '|' + start.getTime(), { start_time: start.toISOString(), end_time: new Date(now.getTime() + HR).toISOString(), statistic_ids: all, period: 'hour', types: ['change', 'mean'], units: { energy: 'kWh' } });
  }
  // År: tidligere måneder i år som månedsstatistikk (period month) – hentes bare når År er valgt
  function fetchMonths(host, ids) {
    const all = allIds(ids), now = new Date(), y0 = new Date(now.getFullYear(), 0, 1), m0 = new Date(now.getFullYear(), now.getMonth(), 1);
    if (!all.length || m0 <= y0) return {};
    return ws(host, 'm|' + all.join(',') + '|' + y0.getTime() + '|' + m0.getTime(), { start_time: y0.toISOString(), end_time: m0.toISOString(), statistic_ids: all, period: 'month', types: ['change', 'mean'], units: { energy: 'kWh' } });
  }
  // Effektledd for en tidligere måned: timeforbruk for den ene måneden, hentes når måneden velges
  function fetchMonthHours(host, id, y, m) {
    if (!id) return null;
    const a = new Date(y, m, 1), b = new Date(y, m + 1, 1);
    return ws(host, 'p|' + id + '|' + a.getTime(), { start_time: a.toISOString(), end_time: b.toISOString(), statistic_ids: [id], period: 'hour', types: ['change'], units: { energy: 'kWh' } });
  }
  // Timeserier: E (kWh), SP (spot kr/kWh), NG (Norgespris), NP (Nord Pool) – nøkkel = hk(ts)
  function dataOf(host, o) {
    const h = host.hass, ids = srcIds(host), raw = fetchHourly(host, ids);
    const D = { loaded: raw != null, ids, E: new Map(), SP: new Map(), NG: new Map(), NP: new Map(), eId: null };
    const now = new Date(), kNow = hk(now.getTime()), kDay = hk(d0(now).getTime());
    const rows = (id) => (raw && id && Array.isArray(raw[id]) ? raw[id] : []);
    for (const id of ids.energy) {
      const L = rows(id).filter((r) => r && isNum(r.change));
      if (!L.length) continue;
      D.eId = id; L.forEach((r) => D.E.set(hk(tsOf(r.start)), Number(r.change)));
      break;
    }
    const fill = (map, id) => { const sc = M.priceScale ? M.priceScale(st(h, id)) : 1; rows(id).forEach((r) => { if (r && isNum(r.mean)) map.set(hk(tsOf(r.start)), Number(r.mean) * sc); }); };
    fill(D.SP, ids.spot); fill(D.NG, ids.norge); fill(D.NP, ids.nord);
    // Dagens priser fra prislisten (attributter) der statistikk mangler
    const series = (map, id) => { if (!id || !M.priceSeries) return; M.priceSeries(h, id).slice(0, 24).forEach((v, i) => { if (v != null && !map.has(kDay + i)) map.set(kDay + i, v); }); };
    series(D.SP, ids.spot); series(D.NP, ids.nord);
    const spNow = priceOf(h, ids.spot); if (spNow != null) D.SP.set(kNow, spNow);
    const npNow = priceOf(h, ids.nord); if (npNow != null) D.NP.set(kNow, npNow);
    D.norgeNow = priceOf(h, ids.norge);
    if (D.norgeNow == null && ids.pp && ids.pp.norgespris && ids.pp.norgespris.entity) D.norgeNow = ids.pp.norgespris.v;
    if (D.norgeNow != null) D.NG.set(kNow, D.norgeNow);
    // Inneværende time: dagssensoren (kWh) − dagens timesum (bare når det gir et rimelig tall)
    if (D.eId && D.eId === ids.forbruk) {
      const s = st(h, ids.forbruk), u = String((s && s.attributes && s.attributes.unit_of_measurement) || 'kWh');
      const v = s && isNum(s.state) ? Number(s.state) * (/^Wh$/i.test(u) ? 0.001 : /^MWh$/i.test(u) ? 1000 : 1) : null;
      if (v != null) { let sum = 0; D.E.forEach((x, k) => { if (k >= kDay && k < kNow) sum += x; }); const rem = v - sum; if (rem >= 0 && rem < 60 && !D.E.has(kNow)) D.E.set(kNow, rem); }
    }
    D.kNow = kNow; D.kDay = kDay; D.kMon = hk(new Date(now.getFullYear(), now.getMonth(), 1).getTime());
    // År: tidligere måneder (månedsstatistikk) → D.Mo[m] = { kwh, sp, ng, np }
    D.Mo = []; D.moLoaded = true;
    if (o && o.year) {
      const mr = fetchMonths(host, ids); D.moLoaded = mr != null;
      const rowsM = (id) => (mr && id && Array.isArray(mr[id]) ? mr[id] : []);
      const mOf = (r) => new Date(tsOf(r.start)).getMonth();
      const eM = rowsM(D.eId || ids.energy[0]);
      eM.forEach((r) => { if (r && isNum(r.change)) D.Mo[mOf(r)] = { kwh: Number(r.change), sp: null, ng: null, np: null }; });
      const put = (id, f) => { const sc = M.priceScale ? M.priceScale(st(h, id)) : 1; rowsM(id).forEach((r) => { const x = D.Mo[mOf(r)]; if (x && r && isNum(r.mean)) x[f] = Number(r.mean) * sc; }); };
      put(ids.spot, 'sp'); put(ids.norge, 'ng'); put(ids.nord, 'np');
      D.Mo.forEach((x) => { if (x && x.ng == null) x.ng = D.norgeNow; });
    }
    return D;
  }
  const ng = (D, k) => (D.NG.has(k) ? D.NG.get(k) : D.norgeNow);
  // Sum for [from, to) (timenøkler): kWh, kostnad med spot og med Norgespris (timer der begge er kjent)
  function cmpSum(D, from, to) {
    let sp = 0, n = 0, g = 0;
    D.E.forEach((kwh, k) => { if (k < from || k >= to) return; const s = D.SP.get(k), q = ng(D, k); if (s == null || q == null) return; sp += kwh * s; g += kwh * q; n++; });
    return n ? { sp, ng: g, n } : null;
  }
  // År = denne måneden (timer) + tidligere måneder (månedssnitt × månedsforbruk)
  function yearSum(D) {
    const R = cmpSum(D, D.kMon, D.kNow + 1) || { sp: 0, ng: 0, n: 0 };
    D.Mo.forEach((x) => { if (x && x.sp != null && x.ng != null) { R.sp += x.kwh * x.sp; R.ng += x.kwh * x.ng; R.n++; } });
    return R.n ? R : null;
  }
  const rangeOf = (key, now) => {
    const n = now || new Date(); let a;
    if (key === 'I dag' || key === 'Dag') a = d0(n);
    else if (key === 'Uke') a = monday(n);
    else if (key === 'Måned') a = new Date(n.getFullYear(), n.getMonth(), 1);
    else a = new Date(n.getFullYear(), 0, 1);
    return [hk(a.getTime()), hk(n.getTime()) + 1, a];
  };

  /* ------------------------------------------------------------ innstillinger (verdier + bakenforliggende entitet) */
  const SET = [
    ['nord', 'bolt', 'Nordpool', 'øre/kWh', false],
    ['total', 'visibility', 'Totalpris', 'øre/kWh', false],
    ['grid', 'home_work', 'Nettleie dag', 'øre/kWh', true],
    ['night', 'home_work', 'Nettleie natt', 'øre/kWh', true],
    ['surch', 'home_work', 'Påslag strømselskap', 'øre/kWh', true],
    ['gov', 'show_chart', 'Terskel strømstøtte', 'øre/kWh', true],
    ['govPct', 'percent', 'Strømstøtte dekker', '%', true],
    ['vat', 'percent', 'Moms', '%', true],
  ];
  const STD = { gov: 77, govPct: 90, vat: 25 }; // offentlige satser (strømstøtte-terskel uten moms, dekning, moms)
  const RX = {
    govPct: /(andel|prosent|dekning|dekker|percent|pct).*st(o|ø|oe)tte|st(o|ø|oe)tte.*(andel|prosent|dekning|dekker|percent|pct)/i,
    gov: /terskel|threshold|st(o|ø|oe)tte.*grense|grense.*st(o|ø|oe)tte/i,
    night: /nettleie.*natt|natt.*nettleie|grid.*night|night.*grid|energiledd.*natt/i,
    grid: /nettleie.*dag|dag.*nettleie|grid.*day|day.*grid|energiledd.*dag/i,
    surch: /p(a|å|aa)slag|surcharge|markup/i,
    vat: /(^|[^a-z])(moms|mva|vat)([^a-z]|$)/i,
  };
  function backing(h, k, sider) {
    const o = (sider && sider.ent && sider.ent[k]) || null;
    if (o) return st(h, o) ? o : null;
    if (!h || !h.states) return null;
    const cand = Object.keys(h.states).filter((id) => /^(input_number|number)\./.test(id) && isNum(h.states[id].state)).sort();
    const txt = (id) => id + ' ' + ((h.states[id].attributes || {}).friendly_name || '');
    return cand.find((id) => RX[k].test(txt(id)) && !(k === 'gov' && RX.govPct.test(txt(id)))) || null;
  }
  function settings(host) {
    const h = host.hass, sider = cfgS(host), V = {};
    ['grid', 'night', 'surch', 'gov', 'govPct', 'vat'].forEach((k) => {
      const e = backing(h, k, sider), ev = e ? numOf(h, e) : null;
      V[k] = { v: ev != null ? ev : isNum(sider[k]) ? Number(sider[k]) : STD[k] != null ? STD[k] : null, ent: e };
    });
    let pp = null; try { pp = M.powerPrice ? M.powerPrice(h) : null; } catch (e) { /* */ }
    const nord = pp && pp.spotNow != null ? pp.spotNow * 100 : null;
    const now = new Date(), day = now.getDay() % 6 !== 0 && now.getHours() >= 6 && now.getHours() < 22;
    const g = day ? V.grid.v : V.night.v;
    const support = nord != null && V.gov.v != null && V.govPct.v != null ? Math.max(0, nord - V.gov.v) * V.govPct.v / 100 : null;
    const total = nord != null && g != null && V.surch.v != null && support != null && V.vat.v != null ? (nord + g + V.surch.v - support) * (1 + V.vat.v / 100) : null;
    V.nord = { v: nord, ent: null }; V.total = { v: total, ent: null };
    return V;
  }
  const isDayH = (t) => { const d = new Date(t); return d.getDay() % 6 !== 0 && d.getHours() >= 6 && d.getHours() < 22; };

  /* ------------------------------------------------------------ felles markup */
  const head = (title, icon) => `<div class="ss-head"><button class="ss-back" data-ss-act="back" title="Tilbake" aria-label="Tilbake">${ic('arrow_back', 22)}</button><span class="ss-title">${esc(title)}</span><span class="ss-badge">${ic(icon, 22)}</span></div>`;
  // Periodevelger: felles M.segment (Fiks 47 P/S.1/U.1 – like brede kolonner, sentrert, 4 px luft). data-act fjernes så
  // vertskortets (MSH.Card) klikk-/haptic-lytter ikke reagerer i tillegg – bind() under håndterer valget (én haptic).
  const seg = (list, cur, key, o) => {
    const SG = M.segment;
    if (!SG || !SG.html) return `<div class="ss-seg ${o.cls}" data-glass-drag="x">${list.map((l) => `<button class="ss-pill${l === cur ? ' on' : ''} ki-seg-b" data-seg-key="${key}" data-v="${esc(l)}">${esc(l)}</button>`).join('')}</div>`;
    return SG.html(list.map((l) => [l, l]), cur, { key, height: o.h, font: 13, variant: o.variant, haptic: false, cls: 'ss-kseg ' + o.cls, label: o.label }).replace(/ data-act="[^"]*"/g, '');
  };
  const SR = () => M.stromRegning || null;
  const SRC = (host) => (SR() ? SR().sensors(host.config) : {});
  // more-info-attributt bare for entiteter som finnes (ellers ingen trykkflate og ingen animasjon)
  const mer = (host, id) => (id && host.hass && host.hass.states && host.hass.states[id] ? ` data-ss-mer="${esc(id)}"` : '');
  const kr0 = (v) => (v == null || isNaN(v) ? '–' : (v < 0 ? '−' : '') + Math.round(Math.abs(v)).toLocaleString('nb-NO'));
  const sgnCls = (v) => (v == null || Math.abs(v) < 0.005 ? '' : v > 0 ? ' pos' : ' neg');
  // Moms-bryteren («Inkludert i prisen»): config sensorer.moms_bryter / ent.tg_moms (61-strom) / ent.moms, ellers input_boolean/switch med moms/mva/vat
  function momsOn(host) {
    const h = host.hass, c = host.config || {};
    if (!h || !h.states) return null;
    const o = (c.sensorer && c.sensorer.moms_bryter) || (c.ent && (c.ent.tg_moms || c.ent.moms || c.ent.tog_moms)) || null;
    const id = o || Object.keys(h.states).find((x) => /^(input_boolean|switch)\./.test(x) && /(^|[._])(include_)?(moms|mva|vat)([._]|$)/.test(x)) || null;
    return id && h.states[id] ? h.states[id].state === 'on' : null;
  }

  /* ------------------------------------------------------------ Norgespris (U) */
  const NPK = { 'I dag': 'dag', Uke: 'uke', Måned: 'maned', År: 'ar' };
  function norgespris(host) {
    const u = ui(host), h = host.hass, S = SRC(host), R0 = SR();
    const np = NP_PER.some((p) => p[0] === u.ssNp) ? u.ssNp : 'Måned', nWhen = NP_PER.find((p) => p[0] === np)[1];
    const D = dataOf(host, { year: np === 'År' }); // timepriser/-forbruk (statistikk bare mens siden er åpen, 5 min cache)
    // Kilder: powercalc spot (_2) / Norgespris (_3) + norgespris_besparelse_* (S.2) → ellers statistikk-estimat
    const K = R0 ? R0.np(h, S, NPK[np]) : { spot: {}, np: {}, spart: {} };
    let sp = K.spot.v, g = K.np.v, spart = K.spart.v;
    if (spart == null && sp == null && g == null) {
      const [a, b] = rangeOf(np), C = np === 'År' ? yearSum(D) : cmpSum(D, a, b);
      if (C) { sp = C.sp; g = C.ng; spart = C.sp - C.ng; }
    }
    const state = spart == null ? 'none' : spart >= 0 ? 'won' : 'lost';
    const npTxt = D.norgeNow != null ? fx(D.norgeNow, 2) + ' kr/kWh' : 'Norgespris';
    const title = spart != null ? `${spart >= 0 ? 'Spart' : 'Tapt'} med Norgespris · ${nWhen}` : `Norgespris · ${nWhen}`;
    // Merket: |spart| / spot (= (NP − spot) / spot), «dyrere» når tapt, «billigere» når spart
    const pct = spart != null && sp != null && sp > 0 ? `${Math.round(Math.abs(spart) / sp * 100)} % ${spart >= 0 ? 'billigere' : 'dyrere'}` : '–';
    const big = spart == null ? '–' : (spart < 0 ? '−' : '') + fmt1(Math.abs(spart));
    const sub = spart == null ? (D.loaded && D.moLoaded ? 'Mangler forbruk eller spotpris for perioden' : 'Henter statistikk …') : spart >= 0 ? `Norgespris var billigere enn spotpris ${nWhen}` : `Spotpris var billigere enn ${npTxt} ${nWhen}`;
    const nmax = Math.max(sp || 0, g || 0, 1e-9);
    const cmp = [['Med spotpris', sp, ORANGE, K.spot.id], ['Med Norgespris', g, BLUE, K.np.id]].map(([l, v, c, id]) => `<div class="ss-cmp"${mer(host, id)}><span class="ss-cmp-h"><span class="ss-cmp-l"><span class="ss-dot" style="background:${c}"></span>${l}</span><span class="ss-cmp-v">${v == null ? '–' : fmt1(v)} kr</span></span><span class="ss-track"><span class="ss-bar" style="width:${v == null ? 0 : (Math.max(0, v) / nmax * 100).toFixed(2)}%;background:${c}"></span></span></div>`).join('');
    // Time for time i dag: spart/tapt per time = (spot − Norgespris) × kWh (grønn over null = Norgespris billigst)
    const hNow = new Date().getHours(), sc = sOf(host).scrub;
    let bookH = new Map();
    try { const B = R0 && R0.book(h, S); if (B && Array.isArray(B.a.dager)) bookH = R0.timerI(B.a.dager.find((x) => x && x.dato === R0.iso(new Date()))); } catch (e) { /* */ }
    const hrs = Array.from({ length: 24 }, (_, i) => {
      const k = D.kDay + i, s = D.SP.get(k), q = ng(D, k), dp = s == null || q == null ? null : s - q;
      const e = bookH.has(i) ? bookH.get(i) : D.E.has(k) ? D.E.get(k) : null, fut = i > hNow;
      return { i, s, q, dp, e, fut, kr: dp != null && e != null && !fut ? dp * e : null };
    });
    const pastE = hrs.filter((x) => !x.fut && x.e != null), avgE = pastE.length ? pastE.reduce((t, x) => t + x.e, 0) / pastE.length : 1;
    hrs.forEach((x) => { x.hv = x.fut ? (x.dp == null ? null : x.dp * avgE) : x.kr; }); // fremtid: bare prisforskjell (× snittforbruk i dag), dempet
    const hmax = Math.max(1e-9, ...hrs.filter((x) => x.hv != null).map((x) => Math.abs(x.hv)));
    const hourSum = pastE.length && hrs.some((x) => x.kr != null) ? hrs.reduce((t, x) => t + (x.kr || 0), 0) : null;
    // Fliser: denne timen · i dag · denne uken (spart-sensorene; ellers beregnet)
    const Kd = R0 ? R0.np(h, S, 'dag') : { spart: {} }, Ku = R0 ? R0.np(h, S, 'uke') : { spart: {} };
    const tId = R0 ? R0.idOf(h, S, 'spart_time') : null, tSens = R0 ? R0.num(h, S, 'spart_time') : null;
    const [da, db] = rangeOf('I dag'), [wa, wb] = rangeOf('Uke');
    const rd = cmpSum(D, da, db), rw = cmpSum(D, wa, wb);
    const vDag = Kd.spart.v != null ? Kd.spart.v : hourSum != null ? hourSum : rd ? rd.sp - rd.ng : null;
    const vUke = Ku.spart.v != null ? Ku.spart.v : rw ? rw.sp - rw.ng : null;
    const vTime = tSens != null ? tSens : hrs[hNow].kr;
    const hrsSum = vDag == null ? '–' : `${vDag >= 0 ? 'spart' : 'tapt'} ${fx(Math.abs(vDag), Math.abs(vDag) < 10 ? 1 : 0)} kr i dag`;
    const bars = hrs.map((x) => { const hgt = x.hv == null ? 0 : (Math.abs(x.hv) / hmax * 100).toFixed(1); return `<span class="ss-hcol${x.fut ? ' fut' : ''}${sc === x.i ? ' sel' : ''}" data-h="${x.i}" data-d="${x.dp == null ? '' : x.dp}" data-s="${x.s == null ? '' : x.s}" data-q="${x.q == null ? '' : x.q}" data-e="${x.e == null || x.fut ? '' : x.e}" data-kr="${x.kr == null ? '' : x.kr}"><span class="ss-hup"><span style="height:${x.hv != null && x.hv > 0 ? hgt : 0}%;background:${GREEN}"></span></span><span class="ss-hdn"><span style="height:${x.hv != null && x.hv < 0 ? hgt : 0}%;background:${RED}"></span></span></span>`; }).join('');
    const tile = (l, v, d, id) => `<span class="ss-tile"${mer(host, id)}><span class="ss-tile-l">${l}</span><span class="ss-tile-v${sgnCls(v)}">${v == null ? '–' : fx(v, d) + ' kr'}</span></span>`;
    const dd = (v) => (v != null && Math.abs(v) < 10 ? 1 : 0);
    const tiles = tile('Denne timen', vTime, 2, tId) + tile('I dag', vDag, dd(vDag), Kd.spart.sensor ? Kd.spart.id : null) + tile('Denne uken', vUke, dd(vUke), Ku.spart.sensor ? Ku.spart.id : null);
    const heroId = K.spart.sensor ? K.spart.id : K.spot.id || K.np.id;
    return `${head('Norgespris', 'savings')}
<div class="ss-nx ${state}" data-ss-hero="${state}"${mer(host, heroId)}><span class="ss-nx-glow"></span>
  <span class="ss-row"><span class="ss-nx-title">${esc(title)}</span><span class="ss-nx-chip">${esc(pct)}</span></span>
  <span class="ss-big-row"><span class="ss-nx-big">${big}</span><span class="ss-nx-kr">kr</span></span>
  <span class="ss-nx-sub">${esc(sub)}</span>
  ${seg(NP_PER.map((p) => p[0]), np, 'np', { cls: 'ss-seg-n', h: 36, label: 'Periode' })}
</div>
<div class="ss-card ss-gap14"><span class="ss-h">${ic('balance', 18, 'color:var(--ki-text-2, #b8b8b8)')}Hva du hadde betalt</span>${cmp}</div>
<div class="ss-card ss-gap12"><span class="ss-row"><span class="ss-h">${ic('schedule', 18, 'color:var(--ki-text-2, #b8b8b8)')}Time for time i dag</span><span class="ss-sm ss-hrs-sum${sgnCls(vDag)}" data-sum="${esc(hrsSum)}">${esc(sc != null && hrs[sc] ? scrubTxt(sc, hrs[sc].kr, hrs[sc].dp) : hrsSum)}</span></span>
  <div class="ss-hrs" data-ss-scrub><span class="ss-mid"></span>${bars}</div>
  <div class="ss-axis"><span>00</span><span>06</span><span>12</span><span>18</span><span>23</span></div>
  <div class="ss-hdet">${sc != null && hrs[sc] ? esc(detTxt(hrs[sc])) : ''}</div>
  <div class="ss-legend"><span><i style="background:${GREEN}"></i>Norgespris billigst</span><span><i style="background:${RED}"></i>Spot billigst</span></div>
</div>
<div class="ss-tiles">${tiles}</div>`;
  }
  // Trykk/scrub på en time: «kl. 14 · spart 0,52 kr» (fremtid: prisforskjell) + detaljlinje (pris, kWh)
  const scrubTxt = (hh, kr, dp) => `kl. ${String(hh).padStart(2, '0')} · ${kr != null ? `${kr >= 0 ? 'spart' : 'tapt'} ${fx(Math.abs(kr), 2)} kr` : dp != null ? `${dp >= 0 ? '+' : ''}${fx(dp, 2)} kr/kWh` : '–'}`;
  const detTxt = (x) => `Spot ${x.s == null ? '–' : fx(x.s, 2)} · Norgespris ${x.q == null ? '–' : fx(x.q, 2)} kr/kWh · ${x.e == null || x.fut ? (x.fut ? 'ikke brukt ennå' : '– kWh') : fx(x.e, 2) + ' kWh'}`;

  /* ------------------------------------------------------------ Strømregning (S + S.2) */
  const PART = {
    kostnad: ['Strøm', 'bolt', BLUE, 'Spotpris og påslag'],
    nettleie: ['Nettleie', 'mdi:transmission-tower', ORANGE, 'Energiledd + effektledd'],
    avgifter: ['Avgifter', 'mdi:bank', PURPLE, 'Elavgift og Enova'],
    stromstotte: ['Strømstøtte', 'mdi:hand-coin-outline', GREENF, 'Fratrekk'],
    norgespris: ['Norgespris', 'mdi:piggy-bank', GREENF, 'Fratrekk mot spotpris'],
  };
  const BPI = { Dag: 0, Uke: 1, Måned: 2, År: 3 };
  // Estimat fra timestatistikk (bare når ingen av kildene i S.2 finnes): Strøm = Σ kWh × (Nord Pool + påslag),
  // Nettleie = Σ kWh × dag-/nattsats (+ effektledd), Norgespris = Σ kWh × (Norgespris − spot), Avgifter = moms.
  function estimate(host, bp, D, V, EL, monthKr, moms) {
    const now = new Date(), [a, b, aD] = rangeOf(bp, now);
    const vat = moms === false ? 0 : V.vat.v != null ? (V.vat.v > 0 ? V.vat.v : moms ? 25 : 0) / 100 : moms ? 0.25 : null;
    let strom = 0, nStrom = 0, grid = 0, fr = 0, nFr = 0, eDay = 0, eNight = 0, kwh = 0, nE = 0;
    const gridOk = V.grid.v != null && V.night.v != null;
    D.E.forEach((e, k) => {
      if (k < a || k >= b) return;
      kwh += e; nE++;
      const day = isDayH(k * HR); if (day) eDay += e; else eNight += e;
      const p = D.NP.has(k) ? D.NP.get(k) : D.SP.get(k);
      if (p != null) { strom += e * (p + (V.surch.v || 0) / 100); nStrom++; }
      if (gridOk) grid += e * (day ? V.grid.v : V.night.v) / 100;
      const s = D.SP.get(k), q = ng(D, k);
      if (s != null && q != null) { fr += e * (q - s); nFr++; }
    });
    const dayShare = eDay + eNight > 0 ? eDay / (eDay + eNight) : 0.5;
    if (bp === 'År') D.Mo.forEach((x) => {
      if (!x) return;
      kwh += x.kwh; nE++;
      const pr = x.np != null ? x.np : x.sp;
      if (pr != null) { strom += x.kwh * (pr + (V.surch.v || 0) / 100); nStrom++; }
      if (gridOk) grid += x.kwh * (dayShare * V.grid.v + (1 - dayShare) * V.night.v) / 100;
      if (x.sp != null && x.ng != null) { fr += x.kwh * (x.ng - x.sp); nFr++; }
    });
    let eff = null;
    if (EL) { eff = 0; for (let t = d0(aD); t <= now; t = new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1)) { const m = t.getMonth(), dim = new Date(t.getFullYear(), m + 1, 0).getDate(); if (t.getFullYear() === now.getFullYear() && monthKr[m] != null) eff += monthKr[m] / dim; } }
    const gridT = gridOk ? grid + (eff || 0) : null, stromT = nStrom ? strom : null, frT = nFr ? fr : null;
    const avg = vat != null && stromT != null ? (stromT + (gridT || 0) + (frT || 0)) * vat : null;
    const rows = [{ k: 'kostnad', v: stromT }, { k: 'nettleie', v: gridT }, { k: 'avgifter', v: avg }, { k: 'norgespris', v: frT }].map((r) => ({ ...r, l: PART[r.k][0], id: null }));
    return { rows, energi: nE && bp !== 'År' ? { forbruk_dag: eDay, forbruk_natt: eNight, forbruk_totalt: kwh } : nE ? { forbruk_totalt: kwh } : null, est: true };
  }

  function stromregning(host) {
    const u = ui(host), h = host.hass, V = settings(host), sider = cfgS(host), R0 = SR(), S = SRC(host);
    const bp = BP_PER.includes(u.ssBp) ? u.ssBp : 'Måned', now = new Date(), per = BPI[bp];
    // Ny periode utenfra (flisene på hovedsiden setter ui.ssBp) → lukk kalender/valgt døgn
    if (u._ssBpLast !== bp) { if (u._ssBpLast != null) { u.ssKal = false; u.ssDag = null; u.ssKdag = null; u.ssLsel = null; } u._ssBpLast = bp; }
    const B = R0 ? R0.book(h, S) : null;
    const kal = !!u.ssKal;
    const moms = momsOn(host);
    let Dm = null; const getD = () => Dm || (Dm = dataOf(host, { year: bp === 'År' })); // statistikk bare når en kilde mangler
    const when = { Dag: 'i dag', Uke: 'denne uken', Måned: 'denne måneden', År: 'i år' }[bp];
    // ---- Effektledd per måned: input_number.fastledd_<måned> (S.2) → ellers config sider.effektledd × beregnet trinn
    const ELs = R0 ? R0.effektledd(h, S) : null;
    const EL = Array.isArray(sider.effektledd) && sider.effektledd.length >= STEPS.length && sider.effektledd.every(isNum) ? sider.effektledd.map(Number) : null;
    // ---- Kilde for regningen (rader, total, tekst, søyler)
    let X = null; // { rows, energi, tittel, sub, chip, bars, valgt, heroId, ekstra, helg }
    if (kal) {
      const vist = new Date(now.getFullYear(), now.getMonth() + (Number(u.ssBla) || 0), 1);
      const key = `${vist.getFullYear()}-${String(vist.getMonth() + 1).padStart(2, '0')}`;
      const dager = B ? R0.dagerFor(h, B, key, () => { try { host.render(); } catch (e) { /* */ } }) : [];
      const valgt = u.ssKdag ? dager.find((d) => d && d.dato === u.ssKdag) : null;
      const poster = {}, energi = {};
      (valgt ? [valgt] : dager).forEach((d) => { Object.entries((d && d.poster) || {}).forEach(([k, v]) => { if (isNum(v)) poster[k] = (poster[k] || 0) + Number(v); }); Object.entries((d && d.energi) || {}).forEach(([k, v]) => { if (isNum(v)) energi[k] = (energi[k] || 0) + Number(v); }); });
      const rows = Object.keys(poster).length ? R0.postRutenett(poster, B && B.id) : null;
      const vd = valgt ? new Date(valgt.dato + 'T12:00') : null;
      X = { rows, energi: Object.keys(energi).length ? energi : null, kal: { vist, dager, valgt },
        tittel: valgt ? vd.toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' }) : vist.toLocaleDateString('nb-NO', { month: 'long', year: 'numeric' }),
        sub: valgt ? (valgt.pagaende ? 'Så langt' : 'Hele døgnet') : dager.length ? `${dager.length} døgn ført` : B ? 'Ingen døgn ført for denne måneden' : 'Kalenderen kommer fra KI Enhetsforbruk',
        chip: valgt ? 'trykk igjen' : 'kalender', heroId: B && B.id, when: valgt ? 'dette døgnet' : 'denne måneden', helg: vd ? vd.getDay() % 6 === 0 : false };
    } else {
      const Pd = R0 ? R0.periode(h, S, per, u.ssDag || null) : null;
      const Mn = per === 2 && !(Pd && Pd.valgt) && R0 ? R0.maaned(h, S) : null;
      const bars = Pd ? Pd.rader : null, valgt = Pd && Pd.valgt;
      if (Mn) {
        const est = Mn.estimat.v, idag = Mn.idag.v;
        X = { rows: Mn.rows, energi: Mn.energi, tittel: MN[now.getMonth()].toLowerCase(), chip: 'hittil', heroId: Mn.estimat.id || Mn.rows[0].id, spart: Mn.spart,
          subH: [`Hittil i ${MN[now.getMonth()].toLowerCase()}`, est != null ? `<span${mer(host, Mn.estimat.id)}>hele måneden anslått ${kr0(est)} kr</span>` : '', idag != null ? `<span${mer(host, Mn.idag.id)}>i dag ${kr0(idag)} kr</span>` : ''].filter(Boolean).join(' · ') };
      } else if (Pd && (Pd.rows || Pd.valgt)) {
        X = { rows: Pd.rows, energi: Pd.energi, tittel: per === 1 && !valgt ? `uke ${isoWeek(now)}` : Pd.tittel, chip: valgt ? 'trykk igjen' : 'hittil', heroId: Pd.id,
          sub: Pd.undertekst + (Pd.ekstra ? ` · ${Pd.ekstra.l} ${kr0(Pd.ekstra.v)} kr` : ''), helg: valgt ? !!valgt.helg : per === 0 && now.getDay() % 6 === 0, valgtHour: valgt && valgt.timer };
      }
      if (!X) { // ingen S.2-kilde → estimat fra timestatistikk og satsene i Strøminnstillinger
        const D = getD();
        const monthKr = effMonths(host, D, EL).monthKr;
        const Est = estimate(host, bp, D, V, EL, monthKr, moms);
        const dagKr = numOf(h, ent(host, 'dag'));
        X = { rows: Est.rows, energi: Est.energi, est: true, tittel: { Dag: 'i dag', Uke: `uke ${isoWeek(now)}`, Måned: MN[now.getMonth()].toLowerCase(), År: String(now.getFullYear()) }[bp], chip: 'estimat',
          sub: { Dag: 'I dag, så langt', Uke: `Uke ${isoWeek(now)}, så langt`, Måned: `Hittil i ${MN[now.getMonth()].toLowerCase()}${dagKr != null ? ` · i dag ${fx(dagKr, 0)} kr` : ''}`, År: 'Hittil i år' }[bp],
          loaded: D.loaded && D.moLoaded, helg: per === 0 && now.getDay() % 6 === 0 };
      }
      X.bars = bars; X.valgt = valgt;
      if (valgt) X.when = per === 3 ? 'denne måneden' : 'dette døgnet';
    }
    const W = X.when || when;
    // ---- rader (Strøm, Nettleie, Avgifter, [Strømstøtte], Norgespris) – total = summen av radene
    const rows = X.rows || ['kostnad', 'nettleie', 'avgifter', 'norgespris'].map((k) => ({ k, l: PART[k][0], v: null, id: null }));
    const total = R0 ? R0.sumRows(rows) : null;
    const vatPct = moms === false ? null : V.vat.v != null && V.vat.v > 0 ? V.vat.v : 25;
    const subOf = (r) => r.k === 'avgifter' ? (moms === false ? 'Elavgift og Enova · uten moms' : `Elavgift og Enova · moms ${nb(vatPct, 1)} %`)
      : r.k === 'norgespris' ? (r.v != null && r.v > 0 ? 'Tillegg mot spotpris' : 'Fratrekk mot spotpris') : r.k === 'nettleie' && X.est && !EL ? 'Energiledd' : PART[r.k][3];
    const parts = rows.map((r) => { const [l, icon, c] = PART[r.k]; return `<div class="ss-part" data-ss-part="${l}"${mer(host, r.id)}><span class="ss-part-ic" style="background:color-mix(in srgb, ${c} 18%, transparent);color:${AT(c)}">${ic(icon, 20)}</span><span class="ss-part-t"><span class="ss-part-l">${l}</span><span class="ss-part-s">${esc(subOf(r))}</span></span><span class="ss-part-v${r.v != null && r.v < 0 ? ' neg' : ''}">${r.v == null ? '–' : kr0(r.v)} kr</span></div>`; }).join('');
    // ---- fordelingsstripe (Strøm / Nettleie / Avgifter) + forklaring (som Kurser Q)
    const stolpe = R0 ? R0.postStolpe(rows) : [];
    const lsel = stolpe.some((s) => s.k === u.ssLsel) ? u.ssLsel : null, lopen = !!u.ssLeg;
    const stripe = stolpe.map((s) => `<span class="ss-sg${lsel && lsel !== s.k ? ' dim' : ''}" data-ss-act="lsel:${s.k}" style="flex:${s.f.toFixed(4)};background:${PART[s.k][2]}"></span>`).join('');
    const legend = lopen && stolpe.length ? `<div class="ss-leg">${stolpe.map((s) => `<button class="ss-leg-r${lsel === s.k ? ' on' : lsel ? ' dim' : ''}" data-ss-act="lsel:${s.k}"><span class="ss-leg-d" style="background:${PART[s.k][2]}"></span><span class="ss-leg-l">${esc(s.l)}</span><span class="ss-leg-p">${Math.round(s.f * 100)} %</span></button>`).join('')}</div>` : '';
    const selS = lsel && stolpe.find((s) => s.k === lsel);
    const subHtml = selS ? esc(`${selS.l} står for ${Math.round(selS.f * 100)} % av regningen · ${kr0(selS.v)} kr`) : X.subH || esc(X.sub || '');
    // ---- spart-linje (samme fortegn som Norgespris-raden; ellers spart-sensoren for perioden)
    const npRow = rows.find((r) => r.k === 'norgespris');
    let savedV = npRow && npRow.v != null ? -npRow.v : null, savedId = npRow && npRow.id;
    if (savedV == null && R0 && !kal && !X.valgt) { const K = R0.np(h, S, { Dag: 'dag', Uke: 'uke', Måned: 'maned', År: 'ar' }[bp]); if (K.spart.v != null) { savedV = K.spart.v; savedId = K.spart.id; } }
    const savedTxt = savedV == null ? `Norgespris · ${X.est && !X.loaded ? 'henter statistikk …' : 'mangler data for perioden'}` : savedV >= 0 ? `Norgespris har spart deg ${kr0(savedV)} kr ${W}` : `Norgespris har kostet deg ${kr0(-savedV)} kr mer ${W}`;
    // ---- forbruk: dag/natt fra kildene (energi), ellers timeforbruk mot nettleiens dagvindu (06–22 hverdag)
    let en = X.energi;
    if ((!en || (en.forbruk_dag == null && en.forbruk_natt == null)) && !kal && bp !== 'År') {
      const D = getD(), [a, b] = X.valgt ? [hk(new Date(X.valgt.dato + 'T00:00').getTime()), hk(new Date(X.valgt.dato + 'T00:00').getTime()) + 24] : rangeOf(bp, now);
      let eD = 0, eN = 0, n = 0; D.E.forEach((e, k) => { if (k < a || k >= b) return; n++; if (isDayH(k * HR)) eD += e; else eN += e; });
      if (n) en = { ...(en || {}), forbruk_dag: eD, forbruk_natt: eN, forbruk_totalt: en && en.forbruk_totalt != null ? en.forbruk_totalt : eD + eN };
    }
    const kwh = en ? (isNum(en.forbruk_totalt) ? Number(en.forbruk_totalt) : (Number(en.forbruk_dag) || 0) + (Number(en.forbruk_natt) || 0)) : null;
    const eDay = en && isNum(en.forbruk_dag) ? Number(en.forbruk_dag) : null, eNight = en && isNum(en.forbruk_natt) ? Number(en.forbruk_natt) : null;
    const dn = (eDay || 0) + (eNight || 0), pDay = eDay != null && eNight != null && dn > 0 ? Math.round(eDay / dn * 100) : null;
    const helg = !!X.helg;
    const eIds = (en && en.ids) || {};
    const dnLabel = helg ? `<span class="ss-dn-l ss-helg">${ic('bedtime', 15, `color:${AT('#73b9f2')}`)}Helg – lavere sats hele døgnet</span>`
      : `<span class="ss-dn-l"><span${mer(host, eIds.dag)}>${ic('light_mode', 15, `color:${AT('#f2d26f')}`)}Dag${eDay != null ? ` ${fx(eDay, 1)} kWh` : ''} · ${pDay == null ? '–' : pDay} %</span><span${mer(host, eIds.natt)}>${ic('bedtime', 15, `color:${AT('#73b9f2')}`)}Natt/helg${eNight != null ? ` ${fx(eNight, 1)} kWh` : ''} · ${pDay == null ? '–' : 100 - pDay} %</span></span>`;
    const dnBar = helg && dn > 0 ? `<span style="flex:1;background:rgb(100 150 200)"></span>` : pDay == null ? '' : `<span style="flex:${pDay};background:#f2d26f"></span><span style="flex:${100 - pDay};background:rgb(100 150 200)"></span>`; // ki-hex-ok datafarger (fasit)
    // ---- søyler per døgn / måned under postene (trykk → hele blokka viser det døgnet; trykk igjen → tilbake)
    let barsHtml = '';
    if (X.bars && X.bars.length) {
      const mx = Math.max(1, ...X.bars.map((r) => Math.abs(r.sum) || 0));
      barsHtml = `<div class="ss-bars" role="group" aria-label="Søyler">${X.bars.map((r) => { const v = Math.abs(r.sum) || 0, hh = r.fremtid || !v ? 4 : Math.max(8, v / mx * 100); return `<button class="ss-bc${r.fremtid || r.sum == null ? ' fut' : ''}${u.ssDag === r.id ? ' on' : ''}" data-ss-act="dag:${esc(r.id)}" title="${esc(r.navn || '')}"><span class="ss-bt" style="bottom:calc(${hh}% + 3px)">${r.sum == null ? '' : kr0(r.sum)}</span><span class="ss-bf" style="height:${hh}%"></span></button>`; }).join('')}</div>
<div class="ss-bl">${X.bars.map((r) => `<span class="${u.ssDag === r.id ? 'on' : ''}" data-ss-act="dag:${esc(r.id)}">${esc(r.merke || '')}</span>`).join('')}</div>`;
    }
    // ---- kalender (varmekart, bla måneder)
    let kalHtml = '';
    if (kal) kalHtml = calendar(host, X.kal, !!B);
    // ---- Effekttrinn: Elvia-sensorene (S.2) → ellers døgnmaks fra timestatistikk
    const EF = R0 ? R0.effekt(h, S) : { any: false };
    const effHtml = EF.any ? effektSensor(host, EF) : effektStat(host, getD(), EL);
    // ---- Effektledd per måned
    const eledHtml = effektledd(host, ELs, ELs ? null : effMonths(host, getD(), EL), EL);
    return `${head('Strømregning', 'receipt_long')}
<div class="ss-bill">
  <span class="ss-row"><span class="ss-bill-p">Strømregning · ${esc(X.tittel)}</span><span class="ss-est">${esc(X.chip)}</span></span>
  <span class="ss-big-row"${mer(host, X.heroId)}><span class="ss-bill-big">${total == null ? '–' : kr0(total)}</span><span class="ss-bill-kr">kr</span></span>
  <span class="ss-bill-sub">${subHtml}</span>
  <button class="ss-stripe${lopen ? ' open' : ''}" data-ss-act="leg" title="Vis fordeling" aria-expanded="${lopen}">${stripe}</button>
  ${legend}
  <div class="ss-perrow">${seg(BP_PER, kal ? '' : bp, 'bp', { cls: 'ss-seg-b', h: 38, variant: 'light', label: 'Periode' })}<button class="ss-kal${kal ? ' on' : ''}" data-ss-act="kal" title="Kalender" aria-pressed="${kal}">${ic('mdi:calendar-month', 20)}</button></div>
</div>
<div class="ss-card ss-parts">${parts}${barsHtml ? `<div class="ss-bwrap">${barsHtml}</div>` : ''}</div>
${kalHtml}
<div class="ss-saved${savedV != null && savedV < 0 ? ' lost' : ''}"${mer(host, savedId)}>${ic('savings', 22, `color:${savedV != null && savedV < 0 ? RED_T : `var(--ki-green-text, ${GREEN})`}`)}<span>${esc(savedTxt)}</span></div>
<div class="ss-card ss-gap10"><span class="ss-row ss-base"><span class="ss-h">${ic('bolt', 18, 'color:var(--ki-text-2, #b8b8b8)')}Forbruk ${esc(W)}</span><span class="ss-v17"${mer(host, eIds.tot)}>${kwh == null ? '–' : fx(kwh, 1)} kWh</span></span>
  <span class="ss-dn">${dnBar}</span>
  ${dnLabel}
</div>
${effHtml}
${eledHtml}`;
  }

  // Kalender: én rute per dag med kronene for døgnet; sterkere farge jo dyrere (varmekart). Bla måneder (ikke fram forbi nå).
  function calendar(host, K, haveBook) {
    const u = ui(host), na = d0(new Date()), vist = K.vist;
    const per = {}; K.dager.forEach((d) => { if (d && d.dato) per[d.dato] = d; });
    const mx = Math.max(1, ...K.dager.map((d) => Math.abs(Number(d && d.sum) || 0)));
    const start = new Date(vist); start.setDate(1 - ((vist.getDay() + 6) % 7));
    const isoD = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const cells = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const out = d.getMonth() !== vist.getMonth(), r = per[isoD(d)], v = r && isNum(r.sum) ? Number(r.sum) : null;
      const a = v == null ? 0 : Math.min(0.85, 0.12 + Math.abs(v) / mx * 0.7);
      cells.push(`<button class="ss-cd${out ? ' out' : ''}${v == null ? ' nil' : ''}${d.getTime() === na.getTime() ? ' now' : ''}${u.ssKdag === isoD(d) ? ' on' : ''}" ${!out && r ? `data-ss-act="kdag:${isoD(d)}"` : 'disabled'} style="${v == null ? '' : `background:rgba(242,180,111,${a.toFixed(2)})`}"><span class="ss-cdn">${d.getDate()}</span>${v == null ? '' : `<span class="ss-cdv">${kr0(v)}</span>`}</button>`);
    }
    const sum = K.dager.reduce((t, d) => t + (Number(d && d.sum) || 0), 0);
    const fwd = (Number(u.ssBla) || 0) < 0;
    return `<div class="ss-card ss-cal" data-ss-cal>
  <div class="ss-cal-h"><button class="ss-pil" data-ss-act="bla:-1" title="Forrige måned">${ic('mdi:chevron-left', 22)}</button><span class="ss-cal-m">${esc(vist.toLocaleDateString('nb-NO', { month: 'long', year: 'numeric' }))}</span><button class="ss-pil" ${fwd ? 'data-ss-act="bla:1"' : 'disabled'} title="Neste måned">${ic('mdi:chevron-right', 22)}</button></div>
  <div class="ss-wd">${['M', 'T', 'O', 'T', 'F', 'L', 'S'].map((x) => `<span>${x}</span>`).join('')}</div>
  <div class="ss-cg">${cells.join('')}</div>
  <span class="ss-sm">${!haveBook ? 'Legg til en «Strømregning» i KI Enhetsforbruk for kalenderen' : K.dager.length ? `${K.dager.length} døgn ført · ${kr0(sum)} kr til sammen` : 'Ingen døgn ført for denne måneden'}</span>
</div>`;
  }

  // Døgnmaks per måned fra timestatistikk (estimat) → { monthAvg, monthKr, peaksOf }
  function effMonths(host, D, EL) {
    const u = ui(host), now = new Date();
    const em0 = isNum(u.ssEm) && u.ssEm >= 0 && u.ssEm < 12 ? Number(u.ssEm) : now.getMonth();
    const eId = D.eId || D.ids.energy[0];
    const pastE = (m) => {
      if (!eId) return null;
      const c = m === em0 ? fetchMonthHours(host, eId, now.getFullYear(), m) : (CACHE.get('p|' + eId + '|' + new Date(now.getFullYear(), m, 1).getTime()) || {}).data;
      const L = c && Array.isArray(c[eId]) ? c[eId] : null;
      if (!L) return null;
      const mp = new Map(); L.forEach((r) => { if (r && isNum(r.change)) mp.set(hk(tsOf(r.start)), Number(r.change)); });
      return mp;
    };
    const peaksOf = (y, m) => { const md = new Map(); (m === now.getMonth() ? D.E : pastE(m) || new Map()).forEach((e, k) => { const d = new Date(k * HR); if (d.getFullYear() !== y || d.getMonth() !== m || k === D.kNow) return; const key = d.getDate(); if (!md.has(key) || md.get(key) < e) md.set(key, e); }); return [...md.entries()].sort((x, y2) => y2[1] - x[1]).slice(0, 3); };
    const monthAvg = Array.from({ length: 12 }, (_, m) => { if (m > now.getMonth()) return null; const p = peaksOf(now.getFullYear(), m); return p.length ? p.reduce((s, x) => s + x[1], 0) / p.length : null; });
    const monthKr = monthAvg.map((v) => (v == null || !EL ? null : EL[stepOf(v)]));
    return { monthAvg, monthKr, peaksOf };
  }
  const stepOf = (kw) => { if (kw == null) return -1; const i = STEPS.findIndex((s) => kw < s[2]); return i < 0 ? STEPS.length - 1 : i; };
  const PCOL = [RED_T, `var(--ki-orange-text, ${ORANGE})`, `var(--ki-blue-text, ${BLUE})`];
  const stepsHtml = (ci) => STEPS.map(([l], i) => `<span class="ss-step"><span class="ss-step-b${i === ci ? ' on' : i < ci ? ' past' : ''}" style="height:${14 + i * 9}px"></span><span class="ss-step-l${i === ci ? ' on' : ''}">${l}</span></span>`).join('');
  // Effekttrinn fra Elvia-sensorene (snitt/topper/margin/terskel/trinn) – trykk → more-info
  function effektSensor(host, EF) {
    const now = new Date();
    const m = EF.trinn.s && String(EF.trinn.s).replace(',', '.').match(/(\d+(?:\.\d+)?)/);
    let ci = m ? STEPS.findIndex((s) => s[1] === Number(m[1])) : -1;
    if (ci < 0) ci = stepOf(EF.snitt.v);
    const nx = EF.terskel.neste || {};
    const txt = ci < 0 ? 'Ingen effektdata denne måneden ennå.' : `Du er på trinn ${STEPS[ci][0]} kW.${EF.margin.v != null ? ` ${fx(EF.margin.v, 1)} kW margin før neste trinn` : ''}${isNum(nx.kostnad) ? ` (neste trinn ${kr0(Number(nx.kostnad))} kr/mnd)` : ''}${EF.margin.v != null || isNum(nx.kostnad) ? '.' : ''}`;
    const peaks = EF.topp.map((p, i) => `<span class="ss-peak"${mer(host, p.id)}><span class="ss-peak-n" style="color:${PCOL[i]}">#${i + 1}${p.dato ? ` · ${p.dato.getDate()}. ${MS[p.dato.getMonth()]}` : ''}</span><span class="ss-peak-v">${p.v == null ? '–' : fx(p.v, 2)} kW</span></span>`).join('');
    void now;
    return `<div class="ss-card ss-gap14"><span class="ss-row"><span class="ss-h">${ic('stairs', 18, 'color:var(--ki-text-2, #b8b8b8)')}Effekttrinn</span><span class="ss-sm"${mer(host, EF.snitt.id)}>snitt av 3 topper · ${EF.snitt.v == null ? '–' : fx(EF.snitt.v, 2)} kW</span></span>
  <div class="ss-steps"${mer(host, EF.trinn.id)}>${stepsHtml(ci)}</div>
  <span class="ss-step-t"${mer(host, EF.margin.id || EF.terskel.id)}>${esc(txt)}</span>
  <div class="ss-peaks">${peaks}</div>
</div>`;
  }
  // Effekttrinn beregnet fra timestatistikk (når Elvia-sensorene ikke finnes)
  function effektStat(host, D, EL) {
    const now = new Date(), E2 = effMonths(host, D, EL);
    const pk = E2.peaksOf(now.getFullYear(), now.getMonth()), cur = E2.monthAvg[now.getMonth()], ci = stepOf(cur);
    const txt = cur == null ? 'Ingen timeforbruk denne måneden ennå.' : ci === STEPS.length - 1 && cur >= STEPS[ci][2] ? `Du er over trinn ${STEPS[ci][0]} kW.` : `Du er på trinn ${STEPS[ci][0]} kW. ${fx(STEPS[ci][2] - cur, 1)} kW margin før neste trinn${EL && EL[ci + 1] != null ? ` (+${fx(EL[ci + 1] - EL[ci], 0)} kr/mnd)` : ''}.`;
    const peaks = [0, 1, 2].map((i) => { const p = pk[i]; return `<span class="ss-peak"><span class="ss-peak-n" style="color:${PCOL[i]}">#${i + 1} · ${p ? `${p[0]}. ${MS[now.getMonth()]}` : '–'}</span><span class="ss-peak-v">${p ? fx(p[1], 2) : '–'} kW</span></span>`; }).join('');
    return `<div class="ss-card ss-gap14"><span class="ss-row"><span class="ss-h">${ic('stairs', 18, 'color:var(--ki-text-2, #b8b8b8)')}Effekttrinn</span><span class="ss-sm">snitt av 3 topper · ${cur == null ? '–' : fx(cur, 2)} kW</span></span>
  <div class="ss-steps">${stepsHtml(ci)}</div>
  <span class="ss-step-t">${esc(txt)}</span>
  <div class="ss-peaks">${peaks}</div>
</div>`;
  }
  // Effektledd per måned: input_number.fastledd_<måned> (kr) eller beregnet (kr med sider.effektledd, ellers kW)
  function effektledd(host, ELs, E2, EL) {
    const u = ui(host), now = new Date();
    const em = isNum(u.ssEm) && u.ssEm >= 0 && u.ssEm < 12 ? Number(u.ssEm) : now.getMonth();
    const kr = !!(ELs || EL);
    const colV = ELs ? ELs.map((x, i) => (i > now.getMonth() ? null : x.v)) : EL ? E2.monthKr : E2.monthAvg, unit = kr ? 'kr' : 'kW';
    const known = colV.filter((v) => v != null), cmax = Math.max(1e-9, ...known), snitt = known.length ? known.reduce((s, v) => s + v, 0) / known.length : null;
    const ev = colV[em];
    const effV = ev == null ? '–' : kr ? fx(ev, 0) : fx(ev, 2);
    const effSub = ev == null ? `${MN[em]} · ${em > now.getMonth() ? 'ikke startet' : 'ingen data'}` : `${MN[em]}${em === now.getMonth() ? ' (nå)' : ''}${snitt != null && known.length > 1 ? ` · ${kr ? fx(Math.abs(snitt - ev), 0) : fx(Math.abs(snitt - ev), 2)} ${unit} ${ev < snitt ? 'under' : 'over'} snittet` : ''}`;
    const effHead = kr ? `i år ${known.length ? fx(known.reduce((s, v) => s + v, 0), 0) : '–'} kr` : 'snitt av 3 topper';
    const cols = colV.map((v, i) => `<button class="ss-ecol" data-ss-act="em:${i}" title="${MN[i]}"><span class="ss-ebar${i === em ? ' on' : v == null ? ' nil' : ''}" style="height:${v == null ? '2px' : v === 0 ? '3px' : (v / cmax * 70).toFixed(1) + 'px'}"></span><span class="ss-el${i === em ? ' on' : ''}">${ML[i]}</span></button>`).join('');
    return `<div class="ss-card ss-gap10"><span class="ss-row"><span class="ss-h">${ic('bar_chart', 18, 'color:var(--ki-text-2, #b8b8b8)')}Effektledd per måned</span><span class="ss-sm">${esc(effHead)}</span></span>
  <div class="ss-row ss-base"><span class="ss-big-row"${ELs ? mer(host, ELs[em].id) : ''}><span class="ss-eff-v">${effV}</span><span class="ss-sm">${unit}</span></span><span class="ss-eff-s">${esc(effSub)}</span></div>
  <div class="ss-ecols">${cols}</div>
</div>`;
  }

  /* ------------------------------------------------------------ Strøminnstillinger */
  function innstillinger(host) {
    const V = settings(host), s = sOf(host);
    const tiles = SET.map(([k, icon, l, unit, ed]) => {
      const v = V[k].v, editing = s.edit === k;
      const raw = s.draft != null && editing ? s.draft : v == null ? '' : String(+v.toFixed(4)).replace('.', ',');
      const val = v == null ? '–' : unit === '%' ? `${nb(v, 2)} %` : `${nb(v, 2)} ${unit}`;
      const inner = editing
        ? `<span class="ss-in-row"><input class="ss-in" data-ss-in="${k}" value="${esc(raw)}" inputmode="decimal" enterkeyhint="done" aria-label="${esc(l)}"><span class="ss-in-u">${esc(unit)}</span></span>`
        : `<span class="ss-set-v">${esc(val)}</span>`;
      return `<div class="ss-set${editing ? ' editing' : ''}${ed ? ' ed' : ''}" data-ss-set="${k}" ${ed ? `data-ss-act="edit:${k}" role="button" tabindex="0"` : ''} title="${esc(V[k].ent || l)}"><span class="ss-set-ic">${ic(icon, 22)}</span><span class="ss-set-t">${inner}<span class="ss-set-l">${esc(l)}</span></span></div>`;
    }).join('');
    return `<div class="ss-head"><span class="ss-badge ss-b36">${ic('tune', 22)}</span><span class="ss-title ss-t28">Strøminnstillinger</span><button class="ss-close" data-ss-act="back" title="Lukk" aria-label="Lukk">${ic('close', 24)}</button></div>
<div class="ss-intro"><span class="ss-intro-h">Oppsett for strøm</span><span class="ss-intro-t">Sett inn verdier for kalkulering av total pris for strøm. Alle verdier skal være uten moms (MVA). Moms regnes ut til slutt.</span></div>
<div class="ss-sets">${tiles}</div>`;
  }

  function commit(host, k) {
    const s = sOf(host);
    if (s.edit !== k) return;
    const txt = s.draft; s.edit = null; s.draft = null; s.focused = null;
    const n = txt == null ? NaN : parseFloat(String(txt).replace(/\s/g, '').replace(',', '.'));
    if (!isNaN(n)) {
      const h = host.hass, e = backing(h, k, cfgS(host));
      if (e && h && h.callService) {
        const dom = e.split('.')[0], a = (st(h, e) || {}).attributes || {};
        const v = Math.max(isNum(a.min) ? Number(a.min) : -Infinity, Math.min(isNum(a.max) ? Number(a.max) : Infinity, n));
        try { const r = h.callService(dom, 'set_value', { entity_id: e, value: v }); if (r && r.catch) r.catch(() => {}); } catch (err) { /* */ }
      } else if (host.setCfg) {
        host.setCfg({ sider: { ...cfgS(host), [k]: n } });
      }
      hp(host, 'success');
    }
    try { host.render(); } catch (err) { /* */ }
  }

  /* ------------------------------------------------------------ bind (delegert, idempotent) */
  function bind(host, el) {
    if (!el) return;
    el.__ssHost = host;
    const s = sOf(host);
    if (s.edit) { // fokus på feltet én gang per redigering
      const inp = el.querySelector(`input[data-ss-in="${s.edit}"]`);
      const rn = inp && inp.getRootNode && inp.getRootNode();
      if (inp && (!rn || rn.activeElement !== inp)) {
        const first = s.focused !== s.edit; s.focused = s.edit;
        try { inp.focus(); if (first) inp.select(); else inp.setSelectionRange(inp.value.length, inp.value.length); } catch (e) { /* */ }
      }
    }
    try { if (M.segment && M.segment.glass) M.segment.glass(el); } catch (e) { /* */ } // Liquid Glass-drag på periodevelgerne
    // Fiks 56 G: scrub i timegrafen med retningslås (MSH.dirLock): pan-y, vertikalt sveip scroller popupen, horisontalt = scrub
    const g0 = el.querySelector('[data-ss-scrub]');
    if (g0 && M.dirLock) { const pk = (e) => { if (el.__ssPick) el.__ssPick(e); }; M.dirLock(g0, { onStart: pk, onMove: pk, onTap: pk }); }
    if (el.__ssBound) return;
    el.__ssBound = true;
    const H = () => el.__ssHost;
    el.addEventListener('click', (ev) => {
      const host2 = H();
      if (ev.target.closest && ev.target.closest('input')) return;
      const u = ui(host2), s2 = sOf(host2);
      // Periodevelger (M.segment): data-seg-key np | bp
      const sb = ev.target.closest && ev.target.closest('.ki-seg-b[data-seg-key]');
      if (sb && el.contains(sb)) {
        ev.stopPropagation();
        const key = sb.getAttribute('data-seg-key'), v = sb.getAttribute('data-v');
        if (key === 'np') { if (u.ssNp === v) return; hp(host2, 'selection'); u.ssNp = v; s2.scrub = null; host2.render(); return; }
        if (key === 'bp') { if (u.ssBp === v && !u.ssKal) return; hp(host2, 'selection'); u.ssBp = v; u.ssKal = false; u.ssDag = null; u.ssKdag = null; u.ssLsel = null; host2.render(); return; }
        return;
      }
      const t = ev.target.closest && ev.target.closest('[data-ss-act]');
      if (t && el.contains(t)) {
        const [act, arg] = String(t.getAttribute('data-ss-act')).split(/:(.*)/);
        if (act === 'back') { hp(host2, 'light'); s2.edit = null; s2.scrub = null; host2.go && host2.go(null); return; }
        if (act === 'np') { if (u.ssNp === arg) return; hp(host2, 'selection'); u.ssNp = arg; host2.render(); return; }
        if (act === 'bp') { if (u.ssBp === arg) return; hp(host2, 'selection'); u.ssBp = arg; host2.render(); return; }
        if (act === 'em') { hp(host2, 'selection'); u.ssEm = Number(arg); host2.render(); return; }
        // Fordelingsstripen (som Kurser Q): trykk på baren = vis/skjul forklaringen, trykk på et segment/en rad = velg delen
        if (act === 'leg') { hp(host2, 'light'); u.ssLeg = !u.ssLeg; if (!u.ssLeg) u.ssLsel = null; host2.render(); return; }
        if (act === 'lsel') { ev.stopPropagation(); hp(host2, 'selection'); u.ssLeg = true; u.ssLsel = u.ssLsel === arg ? null : arg; host2.render(); return; }
        // Søyler per døgn/måned: trykk → hele blokka viser det døgnet; trykk igjen → tilbake til perioden
        if (act === 'dag') { hp(host2, 'selection'); u.ssDag = u.ssDag === arg ? null : arg; u.ssLsel = null; host2.render(); return; }
        // Kalender (varmekart): av/på, bla måneder, velg døgn
        if (act === 'kal') { hp(host2, 'selection'); u.ssKal = !u.ssKal; u.ssKdag = null; u.ssDag = null; u.ssLsel = null; if (u.ssKal) u.ssBla = 0; host2.render(); return; }
        if (act === 'bla') { hp(host2, 'light'); u.ssBla = Math.min(0, (Number(u.ssBla) || 0) + Number(arg)); u.ssKdag = null; host2.render(); return; }
        if (act === 'kdag') { hp(host2, 'selection'); u.ssKdag = u.ssKdag === arg ? null : arg; u.ssLsel = null; host2.render(); return; }
        if (act === 'edit') {
          if (s2.edit === arg) return;
          if (s2.edit) commit(host2, s2.edit);
          hp(host2, 'light'); s2.edit = arg; s2.draft = null; s2.focused = null; host2.render(); return;
        }
        return;
      }
      // Trykk på tall/rader/fliser → more-info for kilden (data-ss-mer finnes bare når entiteten finnes)
      const m = ev.target.closest && ev.target.closest('[data-ss-mer]');
      if (m && el.contains(m)) {
        ev.stopPropagation();
        hp(host2, 'light');
        const id = m.getAttribute('data-ss-mer');
        if (M.moreInfo) M.moreInfo(host2, id);
        else host2.dispatchEvent(new CustomEvent('hass-more-info', { detail: { entityId: id }, bubbles: true, composed: true }));
      }
    });
    el.addEventListener('keydown', (ev) => {
      const host2 = H(), inp = ev.target.closest && ev.target.closest('input[data-ss-in]');
      if (inp) {
        ev.stopPropagation();
        if (ev.key === 'Enter') { ev.preventDefault(); sOf(host2).draft = inp.value; commit(host2, inp.getAttribute('data-ss-in')); }
        else if (ev.key === 'Escape') { ev.preventDefault(); const s2 = sOf(host2); s2.edit = null; s2.draft = null; s2.focused = null; host2.render(); }
        return;
      }
      const t = ev.target.closest && ev.target.closest('[data-ss-act^="edit:"]');
      if (t && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); t.click(); }
    });
    el.addEventListener('input', (ev) => { const inp = ev.target.closest && ev.target.closest('input[data-ss-in]'); if (inp) sOf(H()).draft = inp.value; });
    el.addEventListener('focusout', (ev) => {
      const inp = ev.target.closest && ev.target.closest('input[data-ss-in]');
      if (!inp) return;
      const host2 = H(), k = inp.getAttribute('data-ss-in');
      sOf(host2).draft = inp.value;
      // Ny render (feltet byttes ut) → ingen lagring, bind() gir det nye feltet fokus; ellers = brukeren gikk ut av feltet
      setTimeout(() => { if (sOf(host2).edit === k && inp.isConnected && !inp.matches(':focus')) commit(host2, k); }, 0);
    });
    // Scrub i timegrafen (Fiks 56 G: MSH.dirLock på [data-ss-scrub] over – touch-action pan-y + retningslås)
    const pick = (ev) => {
      const g = el.querySelector('[data-ss-scrub]');
      if (!g) return;
      const cols = [...g.querySelectorAll('.ss-hcol')], r = g.getBoundingClientRect();
      if (!cols.length || !r.width) return;
      const i = Math.max(0, Math.min(cols.length - 1, Math.floor((ev.clientX - r.left) / r.width * cols.length)));
      const s2 = sOf(H());
      if (s2.scrub === i) return;
      s2.scrub = i; hp(H(), 'selection');
      cols.forEach((c, j) => c.classList.toggle('sel', j === i));
      const c = cols[i], nv = (k) => { const x = c.getAttribute('data-' + k); return x == null || x === '' ? null : Number(x); };
      const lab = el.querySelector('.ss-hrs-sum'), det = el.querySelector('.ss-hdet');
      if (lab) { lab.textContent = scrubTxt(i, nv('kr'), nv('d')); lab.classList.remove('pos', 'neg'); const k = nv('kr'); if (k != null && Math.abs(k) >= 0.005) lab.classList.add(k > 0 ? 'pos' : 'neg'); }
      if (det) det.textContent = detTxt({ s: nv('s'), q: nv('q'), e: nv('e'), fut: c.classList.contains('fut') });
    };
    el.__ssPick = pick;
  }

  function html(host, page) {
    if (!host) return '';
    let body = '';
    try {
      body = page === 'norgespris' ? norgespris(host) : page === 'stromregning' ? stromregning(host) : page === 'innstillinger' ? innstillinger(host) : '';
    } catch (e) { console.error('[ki-msh] strøm-underside', e); body = `${head('Strøm', 'bolt')}<div class="ss-card">–</div>`; }
    return `<div class="ss-page ss-p-${esc(page)}${host.anim === false ? ' ss-noanim' : ''}" data-ss-page="${esc(page)}">${body}</div>`;
  }

  const css = `${(M.segment && M.segment.css) || ''}
.ss-page{display:flex;flex-direction:column;gap:12px;color:var(--ki-text, #fafafa);font-family:inherit}
.ss-page button{font:inherit;color:inherit;border:0;background:none;padding:0;cursor:pointer;-webkit-tap-highlight-color:transparent}
.ss-page ha-icon{color:inherit}
.ss-head{display:flex;align-items:center;gap:10px;padding:0 4px}
.ss-back{width:40px;height:40px;border-radius:50%;background:var(--ki-surface, #3d3d3d)!important;display:flex;align-items:center;justify-content:center;flex:none;transition:transform .15s}
.ss-back:active,.ss-close:active{transform:scale(.92)}
.ss-close{width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex:none}
@media (hover:hover){.ss-close:hover{background:${WA(0.08)}!important}}
.ss-title{flex:1;min-width:0;font-size:24px;font-weight:500}
.ss-t28{font-size:28px}
.ss-badge{width:40px;height:40px;border-radius:50%;background:var(--ki-pill-bg, #e8e8e8);color:var(--ki-pill-fg, #2a2a2a);display:flex;align-items:center;justify-content:center;flex:none}
.ss-b36{width:36px;height:36px}
.ss-row{display:flex;align-items:center;justify-content:space-between;gap:8px}
.ss-row.ss-base{align-items:baseline}
.ss-big-row{display:flex;align-items:baseline;gap:6px}
.ss-card{background:var(--ki-surface, #3d3d3d);border-radius:26px;padding:16px;display:flex;flex-direction:column;gap:12px}
.ss-gap14{gap:14px}.ss-gap10{gap:10px}
.ss-h{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:500}
.ss-sm{font-size:12px;color:var(--ki-text-2, #b8b8b8)}
.ss-v17{font-size:17px;font-weight:500;font-variant-numeric:tabular-nums}
.ss-seg{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:2px;padding:4px;margin-top:10px;border-radius:999px;position:relative}
.ss-pill{display:flex;align-items:center;justify-content:center;min-width:0;white-space:nowrap;border-radius:999px;font-size:13px!important;font-weight:500!important;transition:background .25s,color .25s}
.ss-pill.on{background:${PINK}!important;color:${INK}!important}
/* Periodevelgerne (M.segment, Fiks 47 P/S.1/U.1): like brede kolonner, sentrert tekst, 4 px luft rundt aktiv pille */
.ss-kseg.ki-seg{margin-top:10px}
.ss-seg-n.ki-seg{background:${KA(0.25)}}
.ss-seg-n.ki-seg>.ki-seg-b{padding:0 6px;color:var(--ki-text-1, #e1e1e1)}
.ss-seg-n.ki-seg>.ki-seg-b.on{color:${INK}}
.ss-seg-b.ki-seg{background:rgba(60,40,50,.12);margin-top:0;flex:1;min-width:0}
.ss-seg-b.ki-seg>.ki-seg-b{padding:0 6px;color:rgba(50,38,44,.72)}
.ss-seg-b.ki-seg>.ki-seg-b.on{color:${INK};box-shadow:0 1px 4px rgba(60,40,50,.18)}
.ss-perrow{display:flex;align-items:center;gap:8px;margin-top:10px;min-width:0}
.ss-perrow>.ss-seg{margin-top:0;flex:1}
.ss-page .ss-kal{width:46px;height:46px;flex:none;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(60,40,50,.12);color:rgba(50,38,44,.8);transition:background .2s,transform .15s}
.ss-page .ss-kal.on{background:var(--ki-knob, #fafafa);color:${INK};box-shadow:0 1px 4px rgba(60,40,50,.18)}
.ss-kal:active{transform:scale(.92)}
/* Trykk → more-info */
[data-ss-mer]{cursor:pointer;-webkit-tap-highlight-color:transparent;transition:transform .15s}
[data-ss-mer]:not(.ss-nx):not(.ss-card):active{transform:scale(.97)}
.ss-nx[data-ss-mer]:active{transform:scale(.99)}
/* Norgespris-toppkort: grønt (spart) / rødt (tapt); lys modus: tonet flate (--ss-l* bare gyldige når --ki-surface finnes) */
.ss-nx{position:relative;overflow:hidden;border-radius:28px;padding:18px;display:flex;flex-direction:column;gap:6px;animation:ss-fade .3s ease;transition:background .4s;
  --ss-c:120,210,165;background:linear-gradient(160deg,var(--ss-l0, #2f4a3f) 0%,var(--ss-l1, #26332e) 60%,var(--ss-l2, #2a2a2a) 100%);box-shadow:inset 0 0 0 1px rgba(var(--ss-c),.2);
  --ss-l0:color-mix(in srgb,rgb(var(--ss-c)) 16%,var(--ki-surface));--ss-l1:color-mix(in srgb,rgb(var(--ss-c)) 8%,var(--ki-surface));--ss-l2:var(--ki-surface)}
.ss-nx.lost{--ss-c:240,120,100;background:linear-gradient(160deg,var(--ss-l0, #4a3230) 0%,var(--ss-l1, #33292a) 60%,var(--ss-l2, #2a2a2a) 100%)}
.ss-nx.none{--ss-c:160,160,160;background:linear-gradient(160deg,var(--ss-l0, #3d3d3d) 0%,var(--ss-l1, #333) 60%,var(--ss-l2, #2a2a2a) 100%)}
.ss-nx-glow{position:absolute;right:-30px;top:-40px;width:160px;height:160px;border-radius:50%;background:radial-gradient(circle,rgba(var(--ss-c),.28),transparent 70%);pointer-events:none}
.ss-nx-title{font-size:13px;color:var(--ki-text-1, #e6e6e6);position:relative}
.ss-nx-chip{height:24px;padding:0 10px;border-radius:12px;background:rgba(var(--ss-c),.2);color:${GREEN_T};font-size:12px;font-weight:600;display:flex;align-items:center;white-space:nowrap;position:relative}
.ss-nx.lost .ss-nx-chip{color:var(--ki-red-text, rgb(250 160 145))}
.ss-nx.none .ss-nx-chip{color:var(--ki-text-2, #b8b8b8)}
.ss-nx-big{font-size:52px;font-weight:300;line-height:1;letter-spacing:-0.02em;font-variant-numeric:tabular-nums;color:${GREEN_T}}
.ss-nx.lost .ss-nx-big{color:${RED_T}}
.ss-nx.none .ss-nx-big{color:var(--ki-text, #fafafa)}
.ss-nx-kr{font-size:15px;color:var(--ki-text-2, #c9e9d9)}
.ss-nx-sub{font-size:13px;color:var(--ki-text-2, #b5cfc2)}
.ss-nx.lost .ss-nx-sub{color:var(--ki-text-2, #d0c2bf)}
.ss-nx.none .ss-nx-sub{color:var(--ki-text-2, #b8b8b8)}
.ss-seg-n{background:${KA(0.25)}}
.ss-seg-n .ss-pill{height:36px;padding:0 14px;color:var(--ki-text-1, #e1e1e1)}
.ss-cmp{display:flex;flex-direction:column;gap:6px}
.ss-cmp-h{display:flex;justify-content:space-between;align-items:baseline;font-size:13px}
.ss-cmp-l{display:flex;align-items:center;gap:8px;color:var(--ki-text-1, #d6d6d6)}
.ss-cmp-v{font-size:17px;font-weight:500;font-variant-numeric:tabular-nums}
.ss-dot{width:8px;height:8px;border-radius:2px;flex:none}
.ss-track{height:10px;border-radius:5px;background:var(--ki-surface-3, #2f2f2f);overflow:hidden;display:block}
.ss-bar{display:block;height:100%;border-radius:5px;transition:width .4s cubic-bezier(.2,.8,.2,1)}
.ss-hrs{position:relative;height:110px;display:flex;align-items:center;gap:2px;touch-action:pan-y;cursor:crosshair;user-select:none}
.ss-mid{position:absolute;left:0;right:0;top:50%;border-top:1px solid ${WA(0.25)};pointer-events:none}
.ss-hcol{flex:1;min-width:0;height:100%;display:flex;flex-direction:column;border-radius:3px}
.ss-hcol.sel{background:${WA(0.08)}}
.ss-hup,.ss-hdn{flex:1;display:flex}
.ss-hup{align-items:flex-end}.ss-hdn{align-items:flex-start}
.ss-hup>span,.ss-hdn>span{display:block;width:100%;border-radius:3px;transform-origin:50% 100%;animation:ss-grow .5s cubic-bezier(.2,.8,.2,1) both}
.ss-hdn>span{transform-origin:50% 0}
.ss-hcol.fut .ss-hup>span,.ss-hcol.fut .ss-hdn>span{opacity:.4}
.ss-axis{display:flex;justify-content:space-between;font-size:10px;color:var(--ki-text-mid, #979797);font-variant-numeric:tabular-nums}
.ss-legend{display:flex;gap:14px;font-size:11px;color:var(--ki-text-2, #b8b8b8)}
.ss-legend span{display:flex;align-items:center;gap:6px}
.ss-legend i{width:8px;height:8px;border-radius:2px;display:block}
.ss-tiles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.ss-tile{display:flex;flex-direction:column;gap:6px;padding:14px 12px;border-radius:20px;background:var(--ki-surface, #3d3d3d);min-width:0}
.ss-tile-l{font-size:12px;color:var(--ki-text-2, #b8b8b8)}
.ss-tile-v{font-size:15px;font-weight:500;color:var(--ki-text, #fafafa);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ss-tile-v.neg,.ss-hrs-sum.neg{color:${RED_T}}
.ss-tile-v.pos,.ss-hrs-sum.pos{color:var(--ki-green-text, ${GREEN})}
.ss-hdet{min-height:15px;font-size:12px;color:var(--ki-text-1, #d6d6d6);font-variant-numeric:tabular-nums}
.ss-hdet:empty{display:none}
/* Strømregning */
.ss-bill{border-radius:28px;padding:18px;background:${PINK};color:${INK};display:flex;flex-direction:column;gap:6px;animation:ss-fade .3s ease}
.ss-bill-p{font-size:13px}
.ss-est{height:24px;padding:0 10px;border-radius:12px;background:rgba(60,40,50,.16);font-size:12px;font-weight:600;display:flex;align-items:center}
.ss-bill-big{font-size:46px;font-weight:300;line-height:1.05;letter-spacing:-0.02em;font-variant-numeric:tabular-nums}
.ss-bill-kr{font-size:15px;font-weight:500}
.ss-bill-sub{font-size:13px;opacity:.8}
.ss-page .ss-stripe{position:relative;display:flex;gap:2px;width:100%;height:12px;border-radius:999px;margin-top:10px;background:rgba(60,40,50,.12);padding:0;cursor:pointer}
.ss-stripe::before{content:'';position:absolute;left:0;right:0;top:-16px;bottom:-16px}
.ss-sg{position:relative;display:block;height:100%;min-width:3px;transition:opacity .2s}
.ss-sg:first-child{border-radius:999px 0 0 999px}.ss-sg:last-child{border-radius:0 999px 999px 0}.ss-sg:only-child{border-radius:999px}
.ss-sg.dim{opacity:.35}
.ss-leg{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:6px 12px;margin-top:10px}
.ss-page .ss-leg-r{display:flex;align-items:center;gap:8px;min-width:0;height:32px;padding:0 10px;border-radius:16px;font-size:13px;color:${INK};background:rgba(60,40,50,.08);text-align:left;transition:background .2s,opacity .2s}
.ss-page .ss-leg-r.on{background:rgba(60,40,50,.18)}
.ss-leg-r.dim{opacity:.6}
.ss-leg-d{width:10px;height:10px;border-radius:5px;flex:none}
.ss-leg-r.on .ss-leg-d{box-shadow:0 0 0 2px rgba(50,38,44,.5)}
.ss-leg-l{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ss-leg-p{font-weight:600;font-variant-numeric:tabular-nums}
.ss-seg-b{background:rgba(60,40,50,.14)}
.ss-seg-b .ss-pill{height:38px;padding:0 6px;color:rgba(50,38,44,.72)}
.ss-seg-b .ss-pill.on{color:${INK}!important;box-shadow:0 1px 4px rgba(60,40,50,.18)}
.ss-parts{padding:6px 16px;gap:0}
.ss-part{display:flex;align-items:center;gap:12px;min-height:62px}
.ss-part+.ss-part{border-top:1px solid ${WA(0.08)}}
.ss-part-ic{width:40px;height:40px;border-radius:50%;flex:none;display:flex;align-items:center;justify-content:center}
.ss-part-t{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.ss-part-l{font-size:15px;font-weight:500}
.ss-part-s{font-size:12px;color:var(--ki-text-2, #a8a8a8)}
.ss-part-v{font-size:17px;font-weight:500;font-variant-numeric:tabular-nums;white-space:nowrap;color:var(--ki-text, #fafafa)}
.ss-part-v.neg{color:var(--ki-green-text, ${GREEN})}
/* Søyler per døgn/måned under postene (fra det gamle kortet) */
.ss-bwrap{border-top:1px solid ${WA(0.08)};padding:14px 0 10px}
.ss-bars{display:flex;align-items:flex-end;gap:4px;height:64px}
.ss-page .ss-bc{flex:1;min-width:0;height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;position:relative}
.ss-bf{width:100%;max-width:18px;border-radius:4px 4px 1px 1px;background:var(--ki-ctrl, #6a6a6a);transition:background .25s,height .5s ease}
.ss-bc.fut .ss-bf{background:var(--ki-surface-3, #4a4a4a)}
.ss-bc.on .ss-bf{background:${ORANGE}}
.ss-bt{position:absolute;font-size:11px;color:var(--ki-orange-text, ${ORANGE});white-space:nowrap;opacity:0;transition:opacity .25s;pointer-events:none}
.ss-bc.on .ss-bt{opacity:1}
.ss-bl{display:flex;gap:4px;margin-top:6px;font-size:11px}
.ss-bl span{flex:1;min-width:0;text-align:center;color:var(--ki-text-mid, #979797);cursor:pointer}
.ss-bl span.on{color:var(--ki-orange-text, ${ORANGE});font-weight:600}
/* Kalender (varmekart) */
.ss-cal{gap:8px}
.ss-cal-h{display:grid;grid-template-columns:40px 1fr 40px;align-items:center}
.ss-cal-m{text-align:center;font-size:15px;font-weight:600;text-transform:capitalize}
.ss-page .ss-pil{width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:var(--ki-text-2, #b8b8b8)}
.ss-page .ss-pil[disabled]{opacity:.25;cursor:default}
.ss-wd{display:grid;grid-template-columns:repeat(7,1fr);gap:5px}
.ss-wd span{text-align:center;font-size:11px;font-weight:600;color:var(--ki-text-mid, #979797)}
.ss-cg{display:grid;grid-template-columns:repeat(7,1fr);gap:5px}
.ss-page .ss-cd{aspect-ratio:1;border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;min-width:0;font-size:13px;font-weight:500;background:var(--ki-surface-2, #454545);transition:transform .14s;overflow:hidden;font-variant-numeric:tabular-nums}
.ss-page .ss-cd[disabled]{cursor:default}
.ss-cd.out{opacity:.2}
.ss-cd.nil{color:var(--ki-text-3, #7f7f7f)}
.ss-cd.now{box-shadow:inset 0 0 0 2px ${WA(0.35)}}
.ss-cd.on{transform:scale(1.06);box-shadow:inset 0 0 0 2px ${ORANGE}}
.ss-cdn{font-size:10px;opacity:.6;line-height:1}
.ss-cdv{font-size:12px;line-height:1.1}
.ss-helg{justify-content:flex-start;gap:4px;align-items:center}
.ss-saved{display:flex;align-items:center;gap:12px;padding:14px 16px;border-radius:22px;background:rgba(110,200,160,.12);box-shadow:inset 0 0 0 1px rgba(110,200,160,.22);font-size:14px;color:var(--ki-text-1, #d8efe3)}
.ss-saved>span{flex:1}
.ss-saved.lost{background:rgba(240,120,100,.12);box-shadow:inset 0 0 0 1px rgba(240,120,100,.22);color:var(--ki-text-1, #f2dcd8)}
.ss-dn{display:flex;gap:2px;height:10px;border-radius:999px;overflow:hidden;background:var(--ki-surface-3, #2f2f2f)}
.ss-dn-l{display:flex;justify-content:space-between;font-size:12px;color:var(--ki-text-1, #d6d6d6)}
.ss-dn-l>span{display:flex;align-items:center;gap:4px}
.ss-steps{display:flex;align-items:flex-end;gap:4px;height:70px}
.ss-step{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;gap:6px}
.ss-step-b{width:100%;flex:none;border-radius:6px;background:var(--ki-surface-3, #4a4a4a)}
.ss-step-b.past{background:rgba(242,176,79,.35)}
.ss-step-b.on{background:${AMBER};box-shadow:0 0 0 2px rgba(242,176,79,.35)}
.ss-step-l{font-size:11px;color:var(--ki-text-2, #b8b8b8);white-space:nowrap}
.ss-step-l.on{color:var(--ki-orange-text, ${AMBER});font-weight:600}
.ss-step-t{font-size:13px;color:var(--ki-text-1, #d6d6d6)}
.ss-peaks{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
.ss-peak{display:flex;flex-direction:column;gap:2px;padding:10px 12px;border-radius:14px;background:var(--ki-surface-2, #333);min-width:0}
.ss-peak-n{font-size:11px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ss-peak-v{font-size:16px;font-weight:500}
.ss-eff-v{font-size:30px;font-weight:300;line-height:1.1}
.ss-eff-s{font-size:12px;color:var(--ki-text-1, #d6d6d6);text-align:right}
.ss-ecols{display:flex;gap:6px;align-items:flex-end;height:90px;margin-top:6px}
.ss-ecol{flex:1;min-width:0;height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:4px}
.ss-ebar{width:100%;max-width:22px;border-radius:4px;background:var(--ki-ctrl, #7a7a7a);transition:background .2s,height .4s cubic-bezier(.2,.8,.2,1)}
.ss-ebar.nil{background:var(--ki-surface-3, #555)}
.ss-ebar.on{background:${ORANGE}}
.ss-el{font-size:11px;color:var(--ki-text-2, #b8b8b8)}
.ss-el.on{color:var(--ki-orange-text, ${ORANGE});font-weight:600}
/* Strøminnstillinger */
.ss-intro{display:flex;flex-direction:column;gap:6px;padding:8px 8px 4px;animation:ss-fade .3s ease}
.ss-intro-h{font-size:22px;font-weight:500}
.ss-intro-t{font-size:14px;line-height:1.5;color:var(--ki-text-2, #a8a8a8);text-wrap:pretty}
.ss-sets{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.ss-set{display:flex;align-items:center;gap:12px;min-height:66px;padding:0 14px 0 8px;border-radius:999px;text-align:left;background:var(--ki-surface, #3d3d3d);cursor:default;min-width:0;box-sizing:border-box;transition:background .2s,transform .15s;-webkit-tap-highlight-color:transparent;outline:none}
.ss-set.ed{cursor:pointer}
.ss-set.ed:active{transform:scale(.97)}
.ss-set.editing{background:var(--ki-surface-2, #4a4a4a)}
.ss-set:focus-visible{box-shadow:0 0 0 2px rgb(242 133 201)}
.ss-set-ic{width:50px;height:50px;border-radius:50%;background:var(--ki-surface-2, #4f4f4f);display:flex;align-items:center;justify-content:center;flex:none}
.ss-set-t{flex:1;min-width:0;display:flex;flex-direction:column;align-items:flex-start;line-height:1.3}
.ss-set-v{font-size:15px;font-weight:500;white-space:nowrap}
.ss-set-l{font-size:13px;color:var(--ki-text-2, #b8b8b8);max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ss-in-row{display:flex;align-items:baseline;gap:4px;width:100%}
.ss-in{width:70px;min-width:0;background:var(--ki-surface-3, #2a2a2a);border:1px solid rgb(242 133 201);border-radius:8px;color:var(--ki-text, #fafafa);font:inherit;font-size:15px;font-weight:500;padding:2px 6px;outline:none;box-sizing:border-box}
.ss-in-u{font-size:13px;color:var(--ki-text-2, #b8b8b8)}
@keyframes ss-fade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@keyframes ss-grow{from{transform:scaleY(0)}to{transform:scaleY(1)}}
.ss-noanim *,.ss-noanim{animation:none!important;transition:none!important}
`;

  M.stromSider = { css, html, bind, _settings: settings, _backing: backing };
})();
