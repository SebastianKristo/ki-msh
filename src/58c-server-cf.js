/* KI-MSH · Server → arildkristo.com (Cloudflare) – Fiks 62 (prompt v6, designet: Server v6.dc.html · CF/CFX/cfx/cfh).
 *
 * Kilden er packages/ki_cloudflare.yaml: 7 REST-spørringer mot Cloudflare GraphQL (scan_interval 1800), hver med egen
 * status-sensor («ok» eller feiltekst). Entitetene finnes via unique_id «ki_arildkristo_<nøkkel>» (entitetsregisteret –
 * hass.entities, ellers config/entity_registry/list én gang), deretter standard-ID-en sensor.ki_arild_kristo_<suffiks>
 * (også med HAs kollisjonssuffiks _2 …). Overstyres per nøkkel i overrides.cf_<nøkkel>. Ingen eksempeldata.
 *
 *   Underfaner: Trafikk (veksler «Siste 24 t / I dag») · Besøk (Besøkende + Toppland + Mest besøkte sider) ·
 *   Ytelse (Svartid og feil + Hurtiglager) · Sikkerhet (Sikkerhet + DNS). Fliser i 2 kolonner (etiketten brytes),
 *   målere 0–100 %, «–» for unavailable/none, kort uten tilgjengelige sensorer skjules.
 *   Historikk-kort per underfane: recorder/statistics_during_period (period day, tellere ['max'], ms/% ['mean','max']),
 *   7 d / 30 d / 90 d / 1 år (52 uker), valget i localStorage 'ki-cf-periode' (UI-tilstand per enhet), mellomlagret 5 min,
 *   hentes bare når fanen vises (fallgruve 8).
 *   Statuslinje nederst: status-sensorene for gruppene fanen viser.
 */
(function () {
  const M = window.MSH;
  if (!M) return;
  const esc = M.esc, C = M.C;
  const GR = C.green, BL = C.blue, OR = C.orange, RD = C.red, PU = C.purple, PK = C.pink;
  const PRE = 'sensor.ki_arild_kristo_', UID = 'ki_arildkristo_';
  // [nøkkel, entity_id-suffiks, unique_id-suffiks, etikett i editoren]
  const K = [
    ['besok24', 'besok_siste_24_timer', 'besok_24t', 'Besøk siste 24 timer'],
    ['req24', 'foresporsler_siste_24_timer', 'foresporsler_24t', 'Forespørsler siste 24 timer'],
    ['data24', 'dataoverforing_siste_24_timer', 'data_24t', 'Dataoverføring siste 24 timer'],
    ['besokIdag', 'besok_i_dag', 'besok_idag', 'Besøk i dag'],
    ['reqIdag', 'foresporsler_i_dag', 'foresporsler_idag', 'Forespørsler i dag'],
    ['sidev', 'sidevisninger_siste_24_timer', 'sidevisninger_24t', 'Sidevisninger'],
    ['unike', 'unike_besokende_siste_24_timer', 'unike_24t', 'Unike besøkende'],
    ['cacheReq', 'hurtiglagrede_foresporsler_siste_24_timer', 'cache_foresporsler_24t', 'Fra hurtiglager'],
    ['treff', 'hurtiglager_treffrate', 'cache_treffrate', 'Treffrate'],
    ['cacheData', 'data_fra_hurtiglager_siste_24_timer', 'cache_data_24t', 'Data fra hurtiglager'],
    ['spart', 'bandbredde_spart', 'cache_spart', 'Båndbredde spart'],
    ['p50', 'svartid_p50', 'svartid_p50', 'Svartid p50'],
    ['p95', 'svartid_p95', 'svartid_p95', 'Svartid p95'],
    ['e4', '4xx_andel', 'andel_4xx', '4xx-andel'],
    ['e5', '5xx_andel', 'andel_5xx', '5xx-andel'],
    ['land', 'toppland_siste_24_timer', 'toppland_24t', 'Toppland'],
    ['sider', 'mest_besokte_sider_siste_24_timer', 'toppsider_24t', 'Mest besøkte sider'],
    ['stoppet', 'stoppede_foresporsler_siste_24_timer', 'stoppet_24t', 'Stoppede forespørsler'],
    ['andelStoppet', 'andel_stoppet', 'andel_stoppet', 'Andel stoppet'],
    ['dns', 'dns_oppslag_siste_24_timer', 'dns_24t', 'DNS-oppslag'],
    ['nx', 'dns_nxdomain_andel', 'dns_nxdomain', 'NXDOMAIN-andel'],
  ];
  // Status-sensorene (én per REST-spørring): cloudflare_status + _besokende/_ytelse/_land/_sider/_sikkerhet/_dns
  const STS = ['', '_besokende', '_ytelse', '_land', '_sider', '_sikkerhet', '_dns'];
  const STL = { '': 'Trafikk', _besokende: 'Besøkende', _ytelse: 'Ytelse', _land: 'Land', _sider: 'Sider', _sikkerhet: 'Sikkerhet', _dns: 'DNS' };
  const SK = STS.map((x) => ['st' + x, 'cloudflare_status' + x, 'cloudflare_status' + x, 'Status · ' + STL[x]]);
  const ALL = [...K, ...SK];

  /* ------------------------------------------------------------ oppdagelse */
  const REG = { list: null, asked: false };
  const bump = () => window.dispatchEvent(new CustomEvent('msh-server-entries', { detail: { src: 'cf' } }));
  function askReg(hass) {
    if (REG.asked || !hass || typeof hass.callWS !== 'function') return;
    REG.asked = true;
    Promise.resolve().then(() => hass.callWS({ type: 'config/entity_registry/list' }))
      .then((r) => { if (Array.isArray(r)) { REG.list = r.filter((e) => e && typeof e.unique_id === 'string' && e.unique_id.startsWith(UID) && !e.disabled_by); MEMO = null; bump(); } })
      .catch(() => { /* ikke admin – standard-ID-ene brukes */ });
  }
  let MEMO = null;
  // { found, ids: {nøkkel → entity_id}, auto }
  function discover(hass, cfg) {
    cfg = cfg || {};
    if (!hass || !hass.states) return { found: false, ids: {}, auto: {} };
    const E = hass.entities || {}, S = hass.states, o = cfg.overrides || {};
    const sig = JSON.stringify(ALL.map((k) => o['cf_' + k[0]] || '')), n = M.stateCount ? M.stateCount(S) : Object.keys(S).length;
    if (MEMO && MEMO.E === E && MEMO.n === n && MEMO.sig === sig && MEMO.reg === REG.list) return MEMO.R;
    // 1) unique_id (hass.entities hvis frontenden har det, ellers registeret over WS)
    const byUid = {};
    Object.keys(E).forEach((id) => { const e = E[id], u = e && e.unique_id; if (typeof u === 'string' && u.startsWith(UID) && S[e.entity_id || id]) byUid[u] = e.entity_id || id; });
    (REG.list || []).forEach((e) => { if (!byUid[e.unique_id] && S[e.entity_id]) byUid[e.unique_id] = e.entity_id; });
    const auto = {}, ids = {};
    ALL.forEach(([k, suf, uid]) => {
      let id = byUid[UID + uid];
      if (!id) { const b = PRE + suf; id = S[b] ? b : [2, 3].map((x) => b + '_' + x).find((x) => S[x]); }
      if (id) auto[k] = id;
      ids[k] = o['cf_' + k] || auto[k];
    });
    const found = Object.values(ids).some((id) => id && S[id]);
    // Avvikende ID-er (omdøpt) finnes bare via registeret – spør én gang når noe mangler
    if (!REG.asked && ALL.some(([k]) => !auto[k]) && Object.keys(S).some((id) => id.startsWith(PRE) || id.startsWith('sensor.ki_arildkristo'))) askReg(hass);
    const R = { found, ids, auto };
    MEMO = { E, n, sig, reg: REG.list, R };
    return R;
  }
  const BAD = ['unavailable', 'unknown', '', 'none', 'None', null, undefined];
  const okS = (s) => !!s && !BAD.includes(s.state);
  const num = (h, id) => { const s = id && h.states[id]; if (!okS(s)) return null; const v = parseFloat(String(s.state).replace(',', '.')); return isNaN(v) ? null : v; };
  // Status: «ok» (store/små bokstaver) = ok, alt annet (også unavailable) = feiltekst
  const stOk = (s) => !!s && String(s.state).trim().toLowerCase() === 'ok';
  function status(h, cfg, keys) {
    const I = discover(h, cfg).ids, L = (keys || SK.map((k) => k[0])).map((k) => I[k]).filter((id) => id && h.states[id]);
    const bad = L.filter((id) => !stOk(h.states[id]));
    return { ids: L, bad, n: L.length, ok: L.length > 0 && !bad.length };
  }
  // Chip i toppkortet / statusprikken i kort-velgeren
  function chip(h, cfg) {
    const D = discover(h, cfg);
    if (!D.found) return { t: 'Ikke koblet', ok: false, none: true };
    const st = status(h, cfg);
    if (!st.n) return Object.entries(D.ids).some(([k, id]) => !k.startsWith('st') && okS(id && h.states[id])) ? { t: 'Tilkoblet', ok: true } : { t: '–', ok: false, none: true };
    return st.ok ? { t: 'Tilkoblet', ok: true } : { t: 'Feil i spørring', ok: false };
  }

  /* ------------------------------------------------------------ format */
  // «5 840», «214,37», «1,82» (designet: nf / fmt)
  const dec = (v) => (Number.isInteger(v) ? 0 : Number.isInteger(Math.round(v * 1e6) / 1e5) ? 1 : 2);
  const nfv = (v, u) => {
    if (v == null || isNaN(v)) return '–';
    if (u === '%') return M.nf(v, Math.abs(v) >= 100 ? 0 : dec(v));
    return Number.isInteger(v) ? M.nf(v, 0) : M.nf(v, Math.abs(v) >= 1000 ? 0 : 2);
  };
  // «Norway 3120 · United States 980» → [['Norway', 3120], …] (siste ord = antall)
  function parseList(state) {
    if (state == null || BAD.includes(state)) return [];
    return String(state).split(' · ').map((p) => p.trim()).filter(Boolean).map((p) => {
      const m = /^(.*\S)\s+([\d\s.,]+)$/.exec(p);
      if (!m) return [p, null];
      const v = parseFloat(m[2].replace(/[\s.]/g, '').replace(',', '.'));
      return [m[1], isNaN(v) ? null : v];
    });
  }
  const ICO = { group: 'mdi:account-group', swap_vert: 'mdi:swap-vertical', cloud_download: 'mdi:cloud-download-outline', visibility: 'mdi:eye-outline', person: 'mdi:account-outline',
    timer: 'mdi:timer-outline', error: 'mdi:alert-circle-outline', dangerous: 'mdi:alert-octagon-outline', bolt: 'mdi:lightning-bolt', cloud_done: 'mdi:cloud-check-outline', block: 'mdi:cancel',
    travel_explore: 'mdi:search-web', public: 'mdi:earth', article: 'mdi:file-document-outline', shield: 'mdi:shield-outline', dns: 'mdi:dns', language: 'mdi:web', bar_chart: 'mdi:chart-bar',
    database: 'mdi:database-outline', check: 'mdi:check-circle', warn: 'mdi:alert' };

  /* ------------------------------------------------------------ underfanene (designet: CFX) */
  // fliser: [etikett, enhet, nøkkel, ikon, farge] · målere: [etikett, nøkkel, farge] · historikk: [etikett, enhet, nøkkel, farge, 'sum'|'avg']
  const SUBS = [['trafikk', 'Trafikk'], ['besok', 'Besøk'], ['ytelse', 'Ytelse'], ['sikkerhet', 'Sikkerhet']];
  const DOGN = [['Besøk', 'besøk', 'besok24', 'group', PK], ['Forespørsler', '', 'req24', 'swap_vert', BL], ['Dataoverføring', 'MB', 'data24', 'cloud_download', OR]];
  const IDAG = [['Besøk', 'besøk', 'besokIdag', 'group', PK], ['Forespørsler', '', 'reqIdag', 'swap_vert', BL]];
  const CFX = {
    trafikk: { st: ['st'], hist: [['Besøk', 'besøk', 'besok24', PK, 'sum'], ['Forespørsler', '', 'req24', BL, 'sum'], ['Dataoverføring', 'MB', 'data24', OR, 'sum']] },
    besok: { st: ['st_besokende', 'st_land', 'st_sider'],
      cards: [{ key: 'besokende', title: 'Besøkende', icon: 'group', tiles: [['Sidevisninger', 'visninger', 'sidev', 'visibility', PK], ['Unike besøkende', 'besøkende', 'unike', 'person', PU]] }],
      lists: [{ key: 'land', title: 'Toppland', icon: 'public', c: BL }, { key: 'sider', title: 'Mest besøkte sider', icon: 'article', c: PK }],
      hist: [['Sidevisninger', 'visninger', 'sidev', PK, 'sum'], ['Unike besøkende', 'besøkende', 'unike', PU, 'sum']] },
    ytelse: { st: ['st_ytelse', 'st_besokende'],
      cards: [{ key: 'svartid', title: 'Svartid og feil', icon: 'timer', tiles: [['Svartid p50', 'ms', 'p50', 'timer', GR], ['Svartid p95', 'ms', 'p95', 'timer', OR], ['4xx-andel', '%', 'e4', 'error', OR], ['5xx-andel', '%', 'e5', 'dangerous', RD]] },
        { key: 'cache', title: 'Hurtiglager', icon: 'bolt', meters: [['Treffrate', 'treff', GR], ['Båndbredde spart', 'spart', BL]], tiles: [['Fra hurtiglager', 'forespørsler', 'cacheReq', 'bolt', GR], ['Data fra hurtiglager', 'MB', 'cacheData', 'cloud_done', BL]] }],
      hist: [['Svartid p95', 'ms', 'p95', OR, 'avg'], ['Hurtiglager-treffrate', '%', 'treff', GR, 'avg']] },
    sikkerhet: { st: ['st_sikkerhet', 'st_dns'],
      cards: [{ key: 'sikkerhet', title: 'Sikkerhet', icon: 'shield', tiles: [['Stoppede forespørsler', 'forespørsler', 'stoppet', 'block', RD]], meters: [['Andel stoppet', 'andelStoppet', RD]] },
        { key: 'dns', title: 'DNS', icon: 'dns', tiles: [['DNS-oppslag', 'oppslag', 'dns', 'travel_explore', BL]], meters: [['NXDOMAIN-andel', 'nx', OR]] }],
      hist: [['Stoppede forespørsler', 'forespørsler', 'stoppet', RD, 'sum'], ['DNS-oppslag', 'oppslag', 'dns', BL, 'sum']] },
  };

  /* ------------------------------------------------------------ historikk (HA long-term statistics) */
  const RG = [['7 d', 7], ['30 d', 30], ['90 d', 90], ['1 år', 364]]; // 1 år = 52 hele uker
  const LS_R = 'ki-cf-periode';
  const rangeI = () => { try { const v = localStorage.getItem(LS_R); const i = v == null ? 1 : parseInt(v, 10); return i >= 0 && i < RG.length ? i : 1; } catch (e) { return 1; } };
  const setRange = (i) => { try { localStorage.setItem(LS_R, String(i)); } catch (e) { /* */ } };
  const STATS = {}; // nøkkel (ids|dager|dag) → { t, r, busy }
  const TTL = 300000;
  const day0 = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dKey = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  function statKey(ids, nD) { return ids.join(',') + '|' + nD + '|' + dKey(new Date()); }
  function loadStats(card, sub) {
    const h = card.hass, X = CFX[sub]; if (!h || !X || typeof h.callWS !== 'function') return;
    const I = discover(h, card.config).ids, nD = RG[rangeI()][1];
    const sumIds = X.hist.filter((x) => x[4] === 'sum').map((x) => I[x[2]]).filter(Boolean), avgIds = X.hist.filter((x) => x[4] === 'avg').map((x) => I[x[2]]).filter(Boolean);
    const all = [...sumIds, ...avgIds]; if (!all.length) return;
    const key = statKey(all, nD), S = STATS[key];
    if (S && (S.busy || Date.now() - S.t < TTL)) return;
    STATS[key] = { t: Date.now(), r: S ? S.r : null, busy: true };
    const today = day0(new Date()), start = new Date(today); start.setDate(start.getDate() - (nD - 1));
    const end = new Date(today); end.setDate(end.getDate() + 1);
    const q = (ids, types) => (ids.length ? h.callWS({ type: 'recorder/statistics_during_period', start_time: start.toISOString(), end_time: end.toISOString(), statistic_ids: ids, period: 'day', types }).catch(() => null) : Promise.resolve({}));
    Promise.all([q(sumIds, ['max']), q(avgIds, ['mean', 'max'])]).then(([a, b]) => {
      STATS[key] = { t: Date.now(), r: { ...(a || {}), ...(b || {}) }, busy: false };
      if (card.isConnected && card.tab === 'cf') card.update();
    });
  }
  // Én verdi per dag (null = mangler), eldste først. kind 'sum' → max, 'avg' → mean (+ max for «maks»)
  function daySeries(rows, nD, kind) {
    const today = day0(new Date()), idx = {};
    for (let i = 0; i < nD; i++) { const d = new Date(today); d.setDate(d.getDate() - (nD - 1 - i)); idx[dKey(d)] = i; }
    const v = Array(nD).fill(null), mx = Array(nD).fill(null);
    (rows || []).forEach((r) => {
      const t = typeof r.start === 'number' ? new Date(r.start) : new Date(r.start), i = idx[dKey(t)];
      if (i == null) return;
      const val = kind === 'avg' ? (r.mean != null ? r.mean : r.max) : r.max;
      if (val != null && !isNaN(val)) v[i] = Number(val);
      if (r.max != null && !isNaN(r.max)) mx[i] = Number(r.max);
    });
    return { v, mx };
  }
  // Stolper: dager (7/30/90) eller 52 uker (1 år). Teller-uke = sum, ms/%-uke = snitt.
  function bars(S, nD, kind) {
    if (nD <= 90) return S.v.map((x, i) => ({ v: x, i0: i, i1: i }));
    const out = [];
    for (let w = 0; w < 52; w++) {
      const seg = S.v.slice(w * 7, w * 7 + 7).filter((x) => x != null);
      out.push({ v: seg.length ? (kind === 'avg' ? seg.reduce((a, x) => a + x, 0) / seg.length : seg.reduce((a, x) => a + x, 0)) : null, i0: w * 7, i1: w * 7 + 6 });
    }
    return out;
  }
  // Oppsummering: tellere = sum + snitt/dag (MB > 1000 → GB) · ms/% = snitt + maks (maks av dagenes max)
  function summary(S, nD, kind, u) {
    const have = S.v.filter((x) => x != null);
    if (!have.length) return { tot: '–', u, avg: kind === 'avg' ? kiT('maks §', 'max §').replace('§', '–') : kiT('snitt § / dag', 'avg § / day').replace('§', '–') };
    const f = (x) => (u === '%' ? M.nf(Math.min(100, x), 1) : u === 'MB' ? nfv(Math.round(x * 100) / 100, 'MB') : M.nf(Math.round(x), 0));
    if (kind === 'avg') {
      const mean = have.reduce((a, x) => a + x, 0) / have.length, mxs = S.mx.filter((x) => x != null), mx = mxs.length ? Math.max(...mxs) : Math.max(...have);
      return { tot: f(mean), u, avg: kiT('maks §', 'max §').replace('§', f(mx)), mean, max: mx };
    }
    const tot = have.reduce((a, x) => a + x, 0), gb = u === 'MB' && tot > 1000;
    return { tot: gb ? M.nf(tot / 1000, 2) : f(tot), u: gb ? 'GB' : u, avg: kiT('snitt § / dag', 'avg § / day').replace('§', f(tot / nD)), sum: tot, perDay: tot / nD };
  }
  const kiT = (no, en) => (window.kiT ? window.kiT(no, en) : no);
  const dLabel = (i, nD) => { const d = day0(new Date()); d.setDate(d.getDate() - (nD - 1 - i)); return `${d.getDate()}.${d.getMonth() + 1}.`; };
  const isoWeek = (d) => { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const n = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - n); const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return Math.ceil(((t - y0) / 86400000 + 1) / 7); };

  function histHTML(card, sub) {
    const h = card.hass, X = CFX[sub], I = discover(h, card.config).ids, ri = rangeI(), nD = RG[ri][1];
    const L = X.hist.filter((x) => I[x[2]]);
    if (!L.length) return '';
    const sumIds = X.hist.filter((x) => x[4] === 'sum').map((x) => I[x[2]]).filter(Boolean), avgIds = X.hist.filter((x) => x[4] === 'avg').map((x) => I[x[2]]).filter(Boolean);
    const St = STATS[statKey([...sumIds, ...avgIds], nD)], R = (St && St.r) || {};
    const ranges = RG.map(([l], i) => `<button class="cfr${i === ri ? ' on' : ''}" data-act="cfr" data-v="${i}" data-haptic="selection" aria-pressed="${i === ri}">${esc(l)}</button>`).join('');
    const charts = L.map(([l, u, k, c, kind]) => {
      const S = daySeries(R[I[k]], nD, kind), B = bars(S, nD, kind), sm = summary(S, nD, kind, u);
      const mxv = Math.max(0, ...B.map((b) => b.v || 0)) || 1, n = B.length;
      const fv = (x) => (x == null ? '–' : u === '%' ? M.nf(Math.min(100, x), 1) : u === 'MB' ? nfv(Math.round(x * 100) / 100, 'MB') : M.nf(Math.round(x), 0));
      const bs = B.map((b, i) => {
        const when = nD > 90 ? (() => { const d = day0(new Date()); d.setDate(d.getDate() - (nD - 1 - b.i0)); return kiT('Uke §', 'Week §').replace('§', isoWeek(d)); })() : dLabel(b.i0, nD);
        const pct = b.v == null ? 0 : Math.max(3, (b.v / mxv) * 100);
        return `<button class="cfb${i === n - 1 ? ' last' : ''}${b.v == null ? ' nil' : ''}" data-act="cfbar" data-msg="${esc(when + ' · ' + fv(b.v) + (b.v != null && u ? ' ' + u : ''))}" data-haptic="selection" title="${esc(fv(b.v))}" style="height:${b.v == null ? 3 : pct.toFixed(1)}%;--c:${c}${n > 40 ? ';border-radius:2px' : ''}"></button>`;
      }).join('');
      return `<div class="cfc" data-key="cfc-${k}" data-n="${n}" data-sum="${sm.sum != null ? sm.sum : ''}" data-mean="${sm.mean != null ? sm.mean : ''}" data-max="${sm.max != null ? sm.max : ''}">
        <div class="cfch"><span class="grow">${esc(l)}</span><span class="cft num">${esc(sm.tot)}</span><span class="cfu">${esc(sm.u)}</span></div>
        <div class="cfbars">${bs}</div>
        <div class="cfax"><span>${nD > 90 ? esc(kiT('for 1 år siden', '1 year ago')) : esc(dLabel(0, nD))}</span><span class="cfavg">${esc(sm.avg)}</span><span>${esc(kiT('i dag', 'today'))}</span></div></div>`;
    }).join('');
    return `<section class="card cfh" data-key="cfh-${sub}"><div class="cfhd">${M.icon(ICO.bar_chart, 20, 'color:var(--ki-text-1, #c7c7c7)')}<span class="ct">Historikk</span></div>
      <div class="cfrg" role="tablist">${ranges}</div>${charts}
      <span class="cfft">${M.icon(ICO.database, 14)}Fra Home Assistant-statistikk · ett punkt per dag</span></section>`;
  }

  /* ------------------------------------------------------------ tegning */
  function tileHTML(h, I, [l, u, k, ic, c]) {
    const id = I[k], s = id && h.states[id], v = num(h, id), unit = s && s.attributes && s.attributes.unit_of_measurement;
    const uu = u === '%' || u === 'ms' || u === 'MB' ? (unit && u === 'MB' ? unit : u) : u;
    return `<button class="cft1 press" ${id ? `data-act="more" data-id="${esc(id)}" data-ent="${esc(id)}"` : 'tabindex="-1"'} data-key="cft-${k}">
      <span class="cfl">${M.icon(ICO[ic] || M.iconName(ic), 16, `color:${c}`)}<span>${esc(l)}</span></span>
      <span class="cfv"><span class="num">${esc(nfv(v, u))}</span><span class="cfu">${esc(uu)}</span></span></button>`;
  }
  function meterHTML(h, I, [l, k, c]) {
    const id = I[k], v = num(h, id);
    return `<button class="cfm press" ${id ? `data-act="more" data-id="${esc(id)}" data-ent="${esc(id)}"` : 'tabindex="-1"'} data-key="cfm-${k}">
      <span class="cfmh"><span class="grow">${esc(l)}</span><span class="cfmv num">${v == null ? '–' : esc(nfv(v, '%')) + ' %'}</span></span>
      <span class="cfmt"><span style="width:${v == null ? 0 : M.clamp(v, 0, 100)}%;background:${c}"></span></span></button>`;
  }
  const avail = (h, I, keys) => keys.some((k) => num(h, I[k]) != null);
  function cardHTML(card, k, extra) {
    const h = card.hass, I = discover(h, card.config).ids;
    const tiles = k.tiles || [], meters = k.meters || [];
    if (!avail(h, I, [...tiles.map((t) => t[2]), ...meters.map((m) => m[1])])) return '';
    return `<section class="card cfk" data-key="cfk-${k.key}"><div class="cfhd">${M.icon(ICO[k.icon], 20, 'color:var(--ki-text-1, #c7c7c7)')}<span class="ct grow">${esc(k.title)}</span>${extra || '<span class="cs">Siste 24 timer</span>'}</div>
      ${tiles.length ? `<div class="cfg">${tiles.map((t) => tileHTML(h, I, t)).join('')}</div>` : ''}
      ${meters.length ? `<div class="cfms">${meters.map((m) => meterHTML(h, I, m)).join('')}</div>` : ''}</section>`;
  }
  function listHTML(card, L) {
    const h = card.hass, I = discover(h, card.config).ids, id = I[L.key], s = id && h.states[id];
    if (!okS(s)) return '';
    const rows = parseList(s.state), mx = Math.max(1, ...rows.map((r) => r[1] || 0));
    return `<section class="card cfl2" data-key="cfl-${L.key}"><button class="cfhd" data-act="more" data-id="${esc(id)}" data-ent="${esc(id)}">${M.icon(ICO[L.icon], 20, 'color:var(--ki-text-1, #c7c7c7)')}<span class="ct grow">${esc(L.title)}</span><span class="cs">Siste 24 timer</span></button>
      ${rows.length ? rows.map(([n, v], i) => `<div class="cflr" data-key="cflr-${L.key}-${i}"><span class="ell" data-noi18n>${esc(n)}</span><span class="cflt"><span style="width:${v == null ? 0 : ((v / mx) * 100).toFixed(1)}%;background:${L.c}"></span></span><span class="num">${v == null ? '–' : esc(nfv(v))}</span></div>`).join('') : '<div class="none">–</div>'}</section>`;
  }
  function statusHTML(card, sub) {
    const h = card.hass, st = status(h, card.config, CFX[sub].st);
    if (!st.n) return '';
    if (st.ok) {
      const txt = st.n === 1 ? kiT('Cloudflare · 1 spørring ok · oppdateres hvert 30. min', 'Cloudflare · 1 query ok · updated every 30 min')
        : kiT('Cloudflare · § spørringer ok · oppdateres hvert 30. min', 'Cloudflare · § queries ok · updated every 30 min').replace('§', st.n);
      return `<button class="cfst ok" data-act="more" data-id="${esc(st.ids[0])}" data-key="cfst-${sub}">${M.icon(ICO.check, 14)}<span>${esc(txt)}</span></button>`;
    }
    const msg = st.bad.map((id) => { const s = h.states[id]; return BAD.includes(s.state) ? kiT('ingen svar', 'no response') : String(s.state); }).filter((x, i, a) => a.indexOf(x) === i).join(' · ');
    return `<button class="cfst warn" data-act="more" data-id="${esc(st.bad[0])}" data-key="cfst-${sub}">${M.icon(ICO.warn, 14)}<span><span>${esc(kiT('Feil i spørring', 'Query error'))}: </span><span data-noi18n>${esc(msg)}</span></span></button>`;
  }
  function body(card, sub) {
    const X = CFX[sub]; if (!X) return '';
    let cards = '';
    if (sub === 'trafikk') {
      const p = card.ui.cfP === 'idag' ? 'idag' : 'dogn';
      const seg = `<div class="cfseg" role="tablist">${[['dogn', 'Siste 24 t'], ['idag', 'I dag']].map(([k, l]) => `<button class="${k === p ? 'on' : ''}" data-act="cfp" data-v="${k}" data-haptic="selection" aria-pressed="${k === p}"${k === 'idag' ? ' title="Siden midnatt"' : ''}>${esc(l)}</button>`).join('')}</div>`;
      cards = cardHTML(card, { key: 'trafikk', title: 'Trafikk', icon: 'language', tiles: p === 'idag' ? IDAG : DOGN }, seg)
        || `<section class="card cfk" data-key="cfk-trafikk"><div class="cfhd">${M.icon(ICO.language, 20, 'color:var(--ki-text-1, #c7c7c7)')}<span class="ct grow">Trafikk</span>${seg}</div><div class="none">–</div></section>`;
    } else cards = (X.cards || []).map((k) => cardHTML(card, k)).join('');
    const lists = (X.lists || []).map((L) => listHTML(card, L)).join('');
    return cards + lists + histHTML(card, sub) + statusHTML(card, sub);
  }
  function onAction(card, name, el) {
    const d = el.dataset;
    if (name === 'cfp') { card.setUI({ cfP: d.v }); return true; }
    if (name === 'cfr') { setRange(+d.v); card.update(); loadStats(card, card._sub('cf')); return true; }
    if (name === 'cfbar') { M.toast(d.msg || '–'); return true; }
    return false;
  }
  // Toppkortets målinger: [verdi, entitet]
  const heroIds = (h, c) => { const I = discover(h, c).ids; return [I.besok24, I.req24, I.data24]; };
  const deps = (h, c) => Object.values(discover(h, c).ids).filter(Boolean);

  const css = () => {
    const S = 'var(--ki-surface, #3a3a3a)', S2 = 'var(--ki-surface-2, #404040)', S3 = 'var(--ki-surface-3, #2f2f2f)';
    const T2 = 'var(--ki-text-2, #afafaf)', TM = 'var(--ki-text-mid, #979797)', T1b = 'var(--ki-text-1, #c7c7c7)', T3t = 'var(--ki-text-mid, #7f7f7f)';
    return `
      .cfk,.cfl2,.cfh{background:${S};border-radius:28px;padding:14px;display:flex;flex-direction:column;gap:12px}
      .cfl2{gap:10px}.cfh{gap:14px}
      .cfhd{display:flex;align-items:center;gap:10px;padding:0 2px;min-height:36px;width:100%;text-align:left;box-sizing:border-box}
      .cfl2 .cfhd,.cfh .cfhd{min-height:0}
      .cfhd .ct{font-size:15px;font-weight:600;min-width:0}.cfhd .cs{font-size:12px;color:${TM};white-space:nowrap}
      .cfseg{display:flex;gap:2px;padding:3px;border-radius:18px;background:${S3};flex:none}
      .cfseg button{height:30px;padding:0 12px;border-radius:15px;font-size:12px;font-weight:600;white-space:nowrap;color:${T1b};transition:background .2s,color .2s}
      .cfseg button.on{background:${C.accent};color:var(--ki-on-accent, #3a3a3a)}
      .cfg{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}
      .cft1{display:flex;flex-direction:column;align-items:flex-start;gap:6px;padding:12px 14px;border-radius:18px;background:${S2};min-width:0;text-align:left}
      .cft1:active,.cfm:active{transform:scale(.97)}
      .cfl{display:flex;align-items:flex-start;gap:6px;font-size:12px;line-height:1.3;color:${T2};min-width:0;max-width:100%}
      .cfl ha-icon{flex:none}.cfl>span{text-wrap:pretty;overflow-wrap:anywhere;white-space:normal}
      .cfv{display:flex;align-items:baseline;gap:3px;min-width:0;max-width:100%}.cfv .num{font-size:26px;font-weight:300;line-height:1}
      .cfu{font-size:12px;color:${TM}}
      .cfms{display:flex;flex-direction:column;gap:4px}
      .cfm{display:flex;flex-direction:column;gap:8px;padding:12px 14px;border-radius:18px;background:${S2};text-align:left;width:100%;box-sizing:border-box}
      .cfmh{display:flex;align-items:baseline;gap:8px;width:100%}.cfmh .grow{font-size:13px;color:${T2};min-width:0}.cfmv{font-size:20px;font-weight:300}
      .cfmt{display:flex;height:8px;border-radius:4px;background:${S3};overflow:hidden;width:100%}
      .cfmt>span{min-width:4px;height:100%;border-radius:4px;transition:width .4s}
      .cflr{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr) 52px;align-items:center;gap:10px;min-height:28px;padding:0 2px}
      .cflr>span:first-child{font-size:13px}.cflr>.num{font-size:13px;color:${T1b};text-align:right}
      .cflt{display:flex;height:6px;border-radius:3px;background:${S3};overflow:hidden}.cflt>span{height:100%;border-radius:3px}
      .cfrg{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);gap:2px;padding:3px;border-radius:22px;background:${S3}}
      .cfr{height:34px;min-width:0;border-radius:17px;font-size:13px;font-weight:600;white-space:nowrap;color:${T1b};transition:background .2s,color .2s}
      .cfr.on{background:${C.accent};color:var(--ki-on-accent, #3a3a3a)}
      .cfc{display:flex;flex-direction:column;gap:8px;padding:12px;border-radius:20px;background:${S2}}
      .cfch{display:flex;align-items:baseline;gap:8px}.cfch .grow{font-size:13px;color:${T2}}.cfch .cft{font-size:20px;font-weight:300}.cfch .cfu{font-size:11px}
      .cfbars{display:flex;align-items:flex-end;gap:2px;height:72px}
      .cfb{flex:1;min-width:0;padding:0;border-radius:3px;background:color-mix(in srgb, var(--c) 55%, transparent)}
      .cfb.last{background:var(--c)}.cfb.nil{background:${S3}}
      .cfax{display:flex;justify-content:space-between;gap:6px;font-size:11px;color:${T3t}}
      .cfft{display:flex;align-items:center;gap:6px;padding:0 2px;font-size:12px;color:${T3t}}
      .cfst{display:flex;align-items:center;gap:6px;padding:2px 8px;font-size:12px;color:${T3t};text-align:left}
      .cfst.ok ha-icon{color:var(--ki-green-text, var(--green, #66d19e))}.cfst.warn{color:var(--ki-orange-text, var(--orange, #f2b573))}
      .cfst ha-icon{flex:none}`;
  };

  M.serverCF = { K, SK, ALL, SUBS, CFX, RG, LS_R, discover, status, chip, parseList, body, onAction, loadStats, heroIds, deps, css, rangeI, daySeries, bars, summary, nfv, PRE, UID };
})();
