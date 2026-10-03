/* KI MSH · Strøm-popup v3 (#strom) · undersidene Norgespris, Strømregning og Strøminnstillinger (Del 45 §6).
 * Fasit: design/Strøm popup v3.dc.html (isNorge / isBill / isSet). Vertskortet (src/61-strom.js, msh-strom-card) kaller
 *   M.stromSider.html(host, page) inne i sin render og M.stromSider.bind(host, el, page) etter render (delegerte lyttere,
 *   idempotent). page = 'norgespris' | 'stromregning' | 'innstillinger'. Attributter data-ss-*, klasser ss-*.
 * host: hass, config, ui (UI-tilstand), ent(role), setCfg(patch), render(), go(page|null), anim, haptic(type).
 *
 * Data (aldri mock – mangler → «–» og flate grafer):
 *   Timeforbruk: recorder/statistics_during_period (period hour, types change+mean) for host.ent('forbruk')
 *     (ellers Energi-oppsettets nett-import, MSH.energiSources), spotpris host.ent('spot'), Norgespris host.ent('norge')
 *     og Nord Pool-sensoren (MSH.powerPrice). Hentes bare når en underside åpnes, fra 1. januar (eller mandag denne uken),
 *     mellomlagres 5 min. Dagens priser uten statistikk fylles fra prislistene (MSH.priceSeries); Norgespris er fast
 *     sats → nåverdien brukes for timer uten statistikk. Inneværende time = dagssensorens tilstand − dagens timesum.
 *   Norgespris: «Med spotpris» = Σ kWh × spot, «Med Norgespris» = Σ kWh × Norgespris for timer der begge er kjent.
 *     Grønt toppkort når Norgespris har vært billigst, rødt når dyrest. Timegraf = spot − Norgespris per time i dag.
 *   Strømregning (estimat): Strøm = Σ kWh × (Nord Pool + påslag), Nettleie = Σ kWh × dag-/nattsats (+ effektledd når
 *     config sider.effektledd = [kr/mnd for trinn 0–2, 2–5, 5–10, 10–15, 15–20 kW] finnes), Norgespris-fratrekk =
 *     Σ kWh × (Norgespris − spot), Avgifter = moms. Total = «Kostnad i dag»/«Regning måned»-sensoren for Dag/Måned
 *     når den finnes, ellers summen. Effekttrinn = snitt av de 3 høyeste døgnmaksimumene (kWh/t) denne måneden.
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
  function fetchStats(host, ids) {
    const h = host.hass;
    const all = [...ids.energy, ids.spot, ids.norge, ids.nord].filter((x, i, a) => x && a.indexOf(x) === i);
    if (!all.length || !h || !h.callWS) return null;
    const now = new Date(), start = new Date(Math.min(new Date(now.getFullYear(), 0, 1).getTime(), monday(now).getTime()));
    const key = all.join(',') + '|' + start.getTime();
    let c = CACHE.get(key);
    if (!c) CACHE.set(key, (c = { t: 0, busy: false, data: null, hosts: new Set() }));
    c.hosts.add(host);
    if (!c.busy && Date.now() - c.t > TTL) {
      c.busy = true;
      Promise.resolve().then(() => h.callWS({ type: 'recorder/statistics_during_period', start_time: start.toISOString(), end_time: new Date(now.getTime() + HR).toISOString(), statistic_ids: all, period: 'hour', types: ['change', 'mean'], units: { energy: 'kWh' } }))
        .then((r) => { c.data = r || {}; }).catch(() => { c.data = c.data || {}; })
        .finally(() => { c.busy = false; c.t = Date.now(); c.hosts.forEach((x) => { if (x.isConnected !== false) { try { x.render(); } catch (e) { /* */ } } }); c.hosts.clear(); });
    }
    return c.data;
  }
  // Timeserier: E (kWh), SP (spot kr/kWh), NG (Norgespris), NP (Nord Pool) – nøkkel = hk(ts)
  function dataOf(host) {
    const h = host.hass, ids = srcIds(host), raw = fetchStats(host, ids);
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
    D.kNow = kNow; D.kDay = kDay;
    return D;
  }
  const ng = (D, k) => (D.NG.has(k) ? D.NG.get(k) : D.norgeNow);
  // Sum for [from, to) (timenøkler): kWh, kostnad med spot og med Norgespris (timer der begge er kjent)
  function cmpSum(D, from, to) {
    let sp = 0, n = 0, g = 0;
    D.E.forEach((kwh, k) => { if (k < from || k >= to) return; const s = D.SP.get(k), q = ng(D, k); if (s == null || q == null) return; sp += kwh * s; g += kwh * q; n++; });
    return n ? { sp, ng: g, n } : null;
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
  const pills = (list, cur, cls, act) => `<div class="ss-seg ${cls}" data-glass-drag="x">${list.map((l) => `<button class="ss-pill${l === cur ? ' on' : ''}" data-ss-act="${act}:${esc(l)}">${esc(l)}</button>`).join('')}</div>`;

  /* ------------------------------------------------------------ Norgespris */
  function norgespris(host) {
    const D = dataOf(host), u = ui(host);
    const np = NP_PER.some((p) => p[0] === u.ssNp) ? u.ssNp : 'Måned', nWhen = NP_PER.find((p) => p[0] === np)[1];
    const [a, b] = rangeOf(np), R = cmpSum(D, a, b);
    const sp = R ? R.sp : null, g = R ? R.ng : null;
    const has = sp != null && g != null, won = has && sp >= g, diff = has ? Math.abs(sp - g) : null;
    const state = !has ? 'none' : won ? 'won' : 'lost';
    const npTxt = D.norgeNow != null ? fx(D.norgeNow, 2) + ' kr/kWh' : 'Norgespris';
    const title = has ? `${won ? 'Spart' : 'Tapt'} med Norgespris · ${nWhen}` : `Norgespris · ${nWhen}`;
    const pct = has && Math.max(sp, g) > 0 ? `${Math.round(diff / Math.max(sp, g) * 100)} % ${won ? 'billigere' : 'dyrere'}` : '–';
    const big = has ? (won ? '' : '−') + fmt1(diff) : '–';
    const sub = !has ? (D.loaded ? 'Mangler forbruk eller spotpris for perioden' : 'Henter statistikk …') : won ? `Fast ${npTxt} var billigere enn spotpris ${nWhen}` : `Spotpris var billigere enn ${npTxt} ${nWhen}`;
    const nmax = has ? Math.max(sp, g, 1e-9) : 1;
    const cmp = [['Med spotpris', sp, ORANGE], ['Med Norgespris', g, BLUE]].map(([l, v, c]) => `<div class="ss-cmp"><span class="ss-cmp-h"><span class="ss-cmp-l"><span class="ss-dot" style="background:${c}"></span>${l}</span><span class="ss-cmp-v">${v == null ? '–' : fmt1(v)} kr</span></span><span class="ss-track"><span class="ss-bar" style="width:${v == null ? 0 : (v / nmax * 100).toFixed(2)}%;background:${c}"></span></span></div>`).join('');
    // Timegraf i dag: spot − Norgespris per time (opp = Norgespris billigst)
    const hrs = Array.from({ length: 24 }, (_, i) => { const k = D.kDay + i, s = D.SP.get(k), q = ng(D, k); return s == null || q == null ? null : s - q; });
    const dmax = Math.max(1e-9, ...hrs.filter((x) => x != null).map(Math.abs));
    let saved = 0, nS = 0; hrs.forEach((d, i) => { const e = D.E.get(D.kDay + i); if (d != null && e != null) { saved += d * e; nS++; } });
    const hNow = new Date().getHours(), sc = sOf(host).scrub;
    const hrsSum = nS ? `${saved >= 0 ? 'spart' : 'tapt'} ${fx(Math.abs(saved), 0)} kr i dag` : '–';
    const bars = hrs.map((d, i) => { const hgt = d == null ? 0 : (Math.abs(d) / dmax * 100).toFixed(1); return `<span class="ss-hcol${i > hNow ? ' fut' : ''}${sc === i ? ' sel' : ''}" data-h="${i}" data-d="${d == null ? '' : d}"><span class="ss-hup"><span style="height:${d != null && d > 0 ? hgt : 0}%;background:${GREEN}"></span></span><span class="ss-hdn"><span style="height:${d != null && d < 0 ? hgt : 0}%;background:${RED}"></span></span></span>`; }).join('');
    // Fliser: denne timen · i dag · denne uken (positiv = spart)
    const dNow = hrs[hNow], eNow = D.E.get(D.kNow);
    const tNow = dNow != null && eNow != null ? dNow * eNow : null;
    const [da, db] = rangeOf('I dag'), [wa, wb] = rangeOf('Uke');
    const rd = cmpSum(D, da, db), rw = cmpSum(D, wa, wb);
    const tiles = [['Denne timen', tNow], ['I dag', rd ? rd.sp - rd.ng : null], ['Denne uken', rw ? rw.sp - rw.ng : null]].map(([l, v]) => `<span class="ss-tile"><span class="ss-tile-l">${l}</span><span class="ss-tile-v${v != null && v < 0 ? ' neg' : ''}">${v == null ? '–' : fx(v, Math.abs(v) < 1 ? 2 : 0) + ' kr'}</span></span>`).join('');
    return `${head('Norgespris', 'savings')}
<div class="ss-nx ${state}" data-ss-hero="${state}"><span class="ss-nx-glow"></span>
  <span class="ss-row"><span class="ss-nx-title">${esc(title)}</span><span class="ss-nx-chip">${esc(pct)}</span></span>
  <span class="ss-big-row"><span class="ss-nx-big">${big}</span><span class="ss-nx-kr">kr</span></span>
  <span class="ss-nx-sub">${esc(sub)}</span>
  ${pills(NP_PER.map((p) => p[0]), np, 'ss-seg-n', 'np')}
</div>
<div class="ss-card ss-gap14"><span class="ss-h">${ic('balance', 18, 'color:var(--ki-text-2, #b8b8b8)')}Hva du hadde betalt</span>${cmp}</div>
<div class="ss-card ss-gap12"><span class="ss-row"><span class="ss-h">${ic('schedule', 18, 'color:var(--ki-text-2, #b8b8b8)')}Time for time i dag</span><span class="ss-sm ss-hrs-sum" data-sum="${esc(hrsSum)}">${esc(sc != null ? scrubTxt(sc, hrs[sc]) : hrsSum)}</span></span>
  <div class="ss-hrs" data-ss-scrub><span class="ss-mid"></span>${bars}</div>
  <div class="ss-axis"><span>00</span><span>06</span><span>12</span><span>18</span><span>23</span></div>
  <div class="ss-legend"><span><i style="background:${GREEN}"></i>Norgespris billigst</span><span><i style="background:${RED}"></i>Spot billigst</span></div>
</div>
<div class="ss-tiles">${tiles}</div>`;
  }
  const scrubTxt = (h, d) => `kl. ${String(h).padStart(2, '0')} · ${d == null ? '–' : (d >= 0 ? '+' : '') + fx(d, 2) + ' kr/kWh'}`;

  /* ------------------------------------------------------------ Strømregning */
  function stromregning(host) {
    const D = dataOf(host), u = ui(host), h = host.hass, V = settings(host), sider = cfgS(host);
    const bp = BP_PER.includes(u.ssBp) ? u.ssBp : 'Måned', now = new Date();
    const [a, b, aD] = rangeOf(bp, now);
    const vat = V.vat.v != null ? V.vat.v / 100 : null;
    let kwh = 0, nE = 0, strom = 0, nStrom = 0, grid = 0, gridOk = V.grid.v != null && V.night.v != null, fr = 0, nFr = 0, eDay = 0, eNight = 0;
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
    // Effekttrinn: døgnmaks (kWh/t ≈ kW) per måned
    const peaksOf = (y, m) => { const md = new Map(); D.E.forEach((e, k) => { const d = new Date(k * HR); if (d.getFullYear() !== y || d.getMonth() !== m || k === D.kNow) return; const key = d.getDate(); if (!md.has(key) || md.get(key) < e) md.set(key, e); }); return [...md.entries()].sort((x, y2) => y2[1] - x[1]).slice(0, 3); };
    const stepOf = (kw) => (kw == null ? -1 : Math.min(STEPS.length - 1, STEPS.findIndex((s) => kw < s[2]) < 0 ? STEPS.length - 1 : STEPS.findIndex((s) => kw < s[2])));
    const EL = Array.isArray(sider.effektledd) && sider.effektledd.length >= STEPS.length && sider.effektledd.every(isNum) ? sider.effektledd.map(Number) : null;
    const monthAvg = Array.from({ length: 12 }, (_, m) => { if (m > now.getMonth()) return null; const p = peaksOf(now.getFullYear(), m); return p.length ? p.reduce((s, x) => s + x[1], 0) / p.length : null; });
    const monthKr = monthAvg.map((v) => (v == null || !EL ? null : EL[stepOf(v)]));
    // Effektledd i perioden (andel av måned for Dag/Uke)
    let eff = null;
    if (EL) {
      eff = 0;
      for (let t = d0(aD); t <= now; t = new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1)) { const m = t.getMonth(), dim = new Date(t.getFullYear(), m + 1, 0).getDate(); if (t.getFullYear() === now.getFullYear() && monthKr[m] != null) eff += monthKr[m] / dim; }
    }
    const gridT = gridOk ? grid + (eff || 0) : null;
    const stromT = nStrom ? strom : null, frT = nFr ? fr : null;
    const avg = vat != null && stromT != null ? (stromT + (gridT || 0) + (frT || 0)) * vat : null;
    const sumParts = stromT != null ? stromT + (gridT || 0) + (frT || 0) + (avg || 0) : null;
    const entTot = bp === 'Dag' ? numOf(h, ent(host, 'dag')) : bp === 'Måned' ? numOf(h, ent(host, 'maned')) : null;
    const total = entTot != null ? entTot : sumParts;
    const dagKr = numOf(h, ent(host, 'dag'));
    const period = { Dag: 'i dag', Uke: `uke ${isoWeek(now)}`, Måned: MN[now.getMonth()].toLowerCase(), År: String(now.getFullYear()) }[bp];
    const when = { Dag: 'i dag', Uke: 'denne uken', Måned: 'denne måneden', År: 'i år' }[bp];
    const sub = { Dag: 'I dag, så langt', Uke: `Uke ${isoWeek(now)}, så langt`, Måned: `Hittil i ${MN[now.getMonth()].toLowerCase()}${dagKr != null ? ` · i dag ${fx(dagKr, 0)} kr` : ''}`, År: 'Hittil i år' }[bp];
    const s1 = stromT || 0, s2 = gridT || 0, s3 = avg || 0, ssum = s1 + s2 + s3;
    const stripe = ssum > 0 ? [[s1, BLUE], [s2, ORANGE], [s3, PURPLE]].map(([v, c]) => `<span style="flex:${(v / ssum).toFixed(4)};background:${c}"></span>`).join('') : '';
    const parts = [['Strøm', 'bolt', stromT, BLUE, 'Energi etter Norgespris'], ['Nettleie', 'home_work', gridT, ORANGE, EL ? 'Energiledd + effektledd' : 'Energiledd'], ['Avgifter', 'account_balance', avg, PURPLE, vat != null ? `Moms ${nb(V.vat.v, 1)} %` : 'Moms'], ['Norgespris', 'savings', frT, GREENF, 'Fratrekk mot spotpris']]
      .map(([l, icon, v, c, s]) => `<div class="ss-part" data-ss-part="${l}"><span class="ss-part-ic" style="background:color-mix(in oklab, ${c} 22%, var(--ki-surface-2, #2e2e2e));color:${AT(c)}">${ic(icon, 20)}</span><span class="ss-part-t"><span class="ss-part-l">${l}</span><span class="ss-part-s">${esc(s)}</span></span><span class="ss-part-v${v != null && v < 0 ? ' neg' : ''}">${v == null ? '–' : fx(v, 0)} kr</span></div>`).join('');
    const savedV = frT != null ? -frT : null;
    const savedTxt = savedV == null ? `Norgespris · ${D.loaded ? 'mangler spotpris eller forbruk' : 'henter statistikk …'}` : savedV >= 0 ? `Norgespris har spart deg ${fx(savedV, 0)} kr ${when}` : `Norgespris har kostet deg ${fx(-savedV, 0)} kr mer ${when}`;
    const dn = eDay + eNight, pDay = dn > 0 ? Math.round(eDay / dn * 100) : null;
    // Effekttrinn (denne måneden)
    const pk = peaksOf(now.getFullYear(), now.getMonth()), cur = monthAvg[now.getMonth()], ci = stepOf(cur);
    const steps = STEPS.map(([l], i) => `<span class="ss-step"><span class="ss-step-b${i === ci ? ' on' : i < ci ? ' past' : ''}" style="height:${14 + i * 9}px"></span><span class="ss-step-l${i === ci ? ' on' : ''}">${l}</span></span>`).join('');
    const stepTxt = cur == null ? 'Ingen timeforbruk denne måneden ennå.' : ci === STEPS.length - 1 && cur >= STEPS[ci][2] ? `Du er over trinn ${STEPS[ci][0]} kW.` : `Du er på trinn ${STEPS[ci][0]} kW. ${fx(STEPS[ci][2] - cur, 1)} kW margin før neste trinn${EL && EL[ci + 1] != null ? ` (+${fx(EL[ci + 1] - EL[ci], 0)} kr/mnd)` : ''}.`;
    const PC = [RED_T, `var(--ki-orange-text, ${ORANGE})`, `var(--ki-blue-text, ${BLUE})`];
    const peaks = [0, 1, 2].map((i) => { const p = pk[i]; return `<span class="ss-peak"><span class="ss-peak-n" style="color:${PC[i]}">#${i + 1} · ${p ? `${p[0]}. ${MS[now.getMonth()]}` : '–'}</span><span class="ss-peak-v">${p ? fx(p[1], 2) : '–'} kW</span></span>`; }).join('');
    // Effektledd per måned
    const em = isNum(u.ssEm) && u.ssEm >= 0 && u.ssEm < 12 ? Number(u.ssEm) : now.getMonth();
    const colV = EL ? monthKr : monthAvg, unit = EL ? 'kr' : 'kW';
    const known = colV.filter((v) => v != null), cmax = Math.max(1e-9, ...known), snitt = known.length ? known.reduce((s, v) => s + v, 0) / known.length : null;
    const ev = colV[em];
    const effV = ev == null ? '–' : EL ? fx(ev, 0) : fx(ev, 2);
    const effSub = ev == null ? `${MN[em]} · ${em > now.getMonth() ? 'ikke startet' : 'ingen data'}` : `${MN[em]}${em === now.getMonth() ? ' (nå)' : ''}${snitt != null && known.length > 1 ? ` · ${EL ? fx(Math.abs(snitt - ev), 0) : fx(Math.abs(snitt - ev), 2)} ${unit} ${ev < snitt ? 'under' : 'over'} snittet` : ''}`;
    const effHead = EL ? `i år ${known.length ? fx(known.reduce((s, v) => s + v, 0), 0) : '–'} kr` : 'snitt av 3 topper';
    const cols = colV.map((v, i) => `<button class="ss-ecol" data-ss-act="em:${i}" title="${MN[i]}"><span class="ss-ebar${i === em ? ' on' : v == null ? ' nil' : ''}" style="height:${v == null ? '2px' : v === 0 ? '3px' : (v / cmax * 70).toFixed(1) + 'px'}"></span><span class="ss-el${i === em ? ' on' : ''}">${ML[i]}</span></button>`).join('');
    return `${head('Strømregning', 'receipt_long')}
<div class="ss-bill">
  <span class="ss-row"><span class="ss-bill-p">Strømregning · ${esc(period)}</span><span class="ss-est">estimat</span></span>
  <span class="ss-big-row"><span class="ss-bill-big">${total == null ? '–' : Math.round(total).toLocaleString('nb-NO')}</span><span class="ss-bill-kr">kr</span></span>
  <span class="ss-bill-sub">${esc(sub)}</span>
  <span class="ss-stripe">${stripe}</span>
  ${pills(BP_PER, bp, 'ss-seg-b', 'bp')}
</div>
<div class="ss-card ss-parts">${parts}</div>
<div class="ss-saved${savedV != null && savedV < 0 ? ' lost' : ''}">${ic('savings', 22, `color:${savedV != null && savedV < 0 ? RED_T : `var(--ki-green-text, ${GREEN})`}`)}<span>${esc(savedTxt)}</span></div>
<div class="ss-card ss-gap10"><span class="ss-row ss-base"><span class="ss-h">${ic('bolt', 18, 'color:var(--ki-text-2, #b8b8b8)')}Forbruk ${esc(when)}</span><span class="ss-v17">${nE ? fx(kwh, 1) : '–'} kWh</span></span>
  <span class="ss-dn">${pDay == null ? '' : `<span style="flex:${pDay};background:#f2d26f"></span><span style="flex:${100 - pDay};background:rgb(100 150 200)"></span>`}</span>
  <span class="ss-dn-l"><span>${ic('light_mode', 15, `color:${AT('#f2d26f')}`)}Dag · ${pDay == null ? '–' : pDay} %</span><span>${ic('bedtime', 15, `color:${AT('#73b9f2')}`)}Natt/helg · ${pDay == null ? '–' : 100 - pDay} %</span></span>
</div>
<div class="ss-card ss-gap14"><span class="ss-row"><span class="ss-h">${ic('stairs', 18, 'color:var(--ki-text-2, #b8b8b8)')}Effekttrinn</span><span class="ss-sm">snitt av 3 topper · ${cur == null ? '–' : fx(cur, 2)} kW</span></span>
  <div class="ss-steps">${steps}</div>
  <span class="ss-step-t">${esc(stepTxt)}</span>
  <div class="ss-peaks">${peaks}</div>
</div>
<div class="ss-card ss-gap10"><span class="ss-row"><span class="ss-h">${ic('bar_chart', 18, 'color:var(--ki-text-2, #b8b8b8)')}Effektledd per måned</span><span class="ss-sm">${esc(effHead)}</span></span>
  <div class="ss-row ss-base"><span class="ss-big-row"><span class="ss-eff-v">${effV}</span><span class="ss-sm">${unit}</span></span><span class="ss-eff-s">${esc(effSub)}</span></div>
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
    if (el.__ssBound) return;
    el.__ssBound = true;
    const H = () => el.__ssHost;
    el.addEventListener('click', (ev) => {
      const host2 = H(), t = ev.target.closest && ev.target.closest('[data-ss-act]');
      if (!t || !el.contains(t) || (ev.target.closest && ev.target.closest('input'))) return;
      const [act, arg] = String(t.getAttribute('data-ss-act')).split(/:(.*)/);
      const u = ui(host2), s2 = sOf(host2);
      if (act === 'back') { hp(host2, 'light'); s2.edit = null; s2.scrub = null; host2.go && host2.go(null); return; }
      if (act === 'np') { if (u.ssNp === arg) return; hp(host2, 'selection'); u.ssNp = arg; host2.render(); return; }
      if (act === 'bp') { if (u.ssBp === arg) return; hp(host2, 'selection'); u.ssBp = arg; host2.render(); return; }
      if (act === 'em') { hp(host2, 'selection'); u.ssEm = Number(arg); host2.render(); return; }
      if (act === 'edit') {
        if (s2.edit === arg) return;
        if (s2.edit) commit(host2, s2.edit);
        hp(host2, 'light'); s2.edit = arg; s2.draft = null; s2.focused = null; host2.render(); return;
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
    // Scrub i timegrafen (fallgruve 2: touch-action none + stopPropagation)
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
      const lab = el.querySelector('.ss-hrs-sum'), d = cols[i].getAttribute('data-d');
      if (lab) lab.textContent = scrubTxt(i, d === '' ? null : Number(d));
    };
    const stop = (ev) => { if (ev.target.closest && ev.target.closest('[data-ss-scrub]')) ev.stopPropagation(); };
    el.addEventListener('pointerdown', (ev) => {
      const g = ev.target.closest && ev.target.closest('[data-ss-scrub]');
      if (!g) return;
      ev.stopPropagation();
      try { g.setPointerCapture(ev.pointerId); } catch (e) { /* */ }
      pick(ev);
      const mv = (e2) => { e2.stopPropagation(); pick(e2); };
      const up = () => { g.removeEventListener('pointermove', mv); g.removeEventListener('pointerup', up); g.removeEventListener('pointercancel', up); };
      g.addEventListener('pointermove', mv); g.addEventListener('pointerup', up); g.addEventListener('pointercancel', up);
    });
    el.addEventListener('touchstart', stop, { passive: true });
    el.addEventListener('touchmove', stop, { passive: true });
  }

  function html(host, page) {
    if (!host) return '';
    let body = '';
    try {
      body = page === 'norgespris' ? norgespris(host) : page === 'stromregning' ? stromregning(host) : page === 'innstillinger' ? innstillinger(host) : '';
    } catch (e) { console.error('[ki-msh] strøm-underside', e); body = `${head('Strøm', 'bolt')}<div class="ss-card">–</div>`; }
    return `<div class="ss-page ss-p-${esc(page)}${host.anim === false ? ' ss-noanim' : ''}" data-ss-page="${esc(page)}">${body}</div>`;
  }

  const css = `
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
.ss-seg{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:2px;padding:3px;margin-top:10px;border-radius:999px;position:relative}
.ss-pill{white-space:nowrap;border-radius:999px;font-size:13px!important;font-weight:500!important;transition:background .25s,color .25s}
.ss-pill.on{background:${PINK}!important;color:${INK}!important}
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
.ss-seg-n{background:${KA(0.25)}}
.ss-seg-n .ss-pill{height:36px;padding:0 14px;color:var(--ki-text-1, #e1e1e1)}
.ss-cmp{display:flex;flex-direction:column;gap:6px}
.ss-cmp-h{display:flex;justify-content:space-between;align-items:baseline;font-size:13px}
.ss-cmp-l{display:flex;align-items:center;gap:8px;color:var(--ki-text-1, #d6d6d6)}
.ss-cmp-v{font-size:17px;font-weight:500;font-variant-numeric:tabular-nums}
.ss-dot{width:8px;height:8px;border-radius:2px;flex:none}
.ss-track{height:10px;border-radius:5px;background:var(--ki-surface-3, #2f2f2f);overflow:hidden;display:block}
.ss-bar{display:block;height:100%;border-radius:5px;transition:width .4s cubic-bezier(.2,.8,.2,1)}
.ss-hrs{position:relative;height:110px;display:flex;align-items:center;gap:2px;touch-action:none;cursor:crosshair;user-select:none}
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
.ss-tile-v.neg{color:${RED_T}}
/* Strømregning */
.ss-bill{border-radius:28px;padding:18px;background:${PINK};color:${INK};display:flex;flex-direction:column;gap:6px;animation:ss-fade .3s ease}
.ss-bill-p{font-size:13px}
.ss-est{height:24px;padding:0 10px;border-radius:12px;background:rgba(60,40,50,.16);font-size:12px;font-weight:600;display:flex;align-items:center}
.ss-bill-big{font-size:46px;font-weight:300;line-height:1.05;letter-spacing:-0.02em;font-variant-numeric:tabular-nums}
.ss-bill-kr{font-size:15px;font-weight:500}
.ss-bill-sub{font-size:13px;opacity:.8}
.ss-stripe{display:flex;gap:2px;height:12px;border-radius:999px;overflow:hidden;margin-top:10px;background:rgba(60,40,50,.12)}
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
