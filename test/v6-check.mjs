// Fiks 62 (prompt v6): Server → arildkristo.com (Cloudflare) · ikon i vert-fanene · «Tilpass server».
// Cloudflare-sensorene legges bare inn her (ikke i test/mock), så de andre server-testene ser samme verter som før.
//   node test/v6-check.mjs   (SHOTS=<mappe> for skjermbilder)
import { createRequire } from 'node:module';
import { readdirSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
mkdirSync('test/.build', { recursive: true });
const bundle = resolve(`test/.build/v6-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const shots = process.env.SHOTS || '';
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const res = [];
const ok = (name, cond, info) => res.push(`${cond ? '✔' : '✘'} ${name}${info != null && !cond ? ' · ' + JSON.stringify(info) : ''}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Cloudflare-sensorene (unique_id som i packages/ki_cloudflare.yaml). «besok_siste_24_timer» er omdøpt → finnes via unique_id.
const CF = () => window.mockExtend(({ add, E }) => {
  const R = (id, uid, st, at) => { add(id, st, at || {}, { platform: 'rest' }); E[id].unique_id = 'ki_arildkristo_' + uid; };
  const P = 'sensor.ki_arild_kristo_';
  R('sensor.arildkristo_besok_omdopt', 'besok_24t', 312, { unit_of_measurement: 'besøk', state_class: 'measurement' });
  R(P + 'foresporsler_siste_24_timer', 'foresporsler_24t', 5840, { unit_of_measurement: 'forespørsler', state_class: 'measurement' });
  R(P + 'dataoverforing_siste_24_timer', 'data_24t', 214.37, { unit_of_measurement: 'MB', state_class: 'measurement' });
  R(P + 'besok_i_dag', 'besok_idag', 187, { unit_of_measurement: 'besøk' });
  R(P + 'foresporsler_i_dag', 'foresporsler_idag', 3412, { unit_of_measurement: 'forespørsler' });
  R(P + 'sidevisninger_siste_24_timer', 'sidevisninger_24t', 1240, { unit_of_measurement: 'visninger', state_class: 'measurement' });
  R(P + 'unike_besokende_siste_24_timer', 'unike_24t', 268, { unit_of_measurement: 'besøkende', state_class: 'measurement' });
  R(P + 'hurtiglagrede_foresporsler_siste_24_timer', 'cache_foresporsler_24t', 3644, { unit_of_measurement: 'forespørsler' });
  R(P + 'hurtiglager_treffrate', 'cache_treffrate', 62.4, { unit_of_measurement: '%', state_class: 'measurement' });
  R(P + 'data_fra_hurtiglager_siste_24_timer', 'cache_data_24t', 141.2, { unit_of_measurement: 'MB' });
  R(P + 'bandbredde_spart', 'cache_spart', 65.9, { unit_of_measurement: '%' });
  R(P + 'svartid_p50', 'svartid_p50', 42, { unit_of_measurement: 'ms' });
  R(P + 'svartid_p95', 'svartid_p95', 186, { unit_of_measurement: 'ms', state_class: 'measurement' });
  R(P + '4xx_andel', 'andel_4xx', 1.82, { unit_of_measurement: '%' });
  R(P + '5xx_andel', 'andel_5xx', 0.04, { unit_of_measurement: '%' });
  R(P + 'toppland_siste_24_timer', 'toppland_24t', 'Norway 3120 · United States 980 · Sweden 410 · Germany 220 · Netherlands 140');
  R(P + 'mest_besokte_sider_siste_24_timer', 'toppsider_24t', '/ 820 · /prosjekter 214 · /om 96 · /blogg/ki-hjem 71 · /kontakt 38');
  R(P + 'stoppede_foresporsler_siste_24_timer', 'stoppet_24t', 186, { unit_of_measurement: 'forespørsler', state_class: 'measurement' });
  R(P + 'andel_stoppet', 'andel_stoppet', 3.1, { unit_of_measurement: '%' });
  R(P + 'dns_oppslag_siste_24_timer', 'dns_24t', 4820, { unit_of_measurement: 'oppslag', state_class: 'measurement' });
  R(P + 'dns_nxdomain_andel', 'dns_nxdomain', 'unavailable', { unit_of_measurement: '%' });
  ['', '_besokende', '_ytelse', '_land', '_sider', '_sikkerhet', '_dns'].forEach((x) => R(P + 'cloudflare_status' + x, 'cloudflare_status' + x, 'ok'));
});

async function page(cfg, o = {}) {
  const ctx = o.ctx || await b.newContext({ viewport: o.vp || { width: 412, height: 900 }, hasTouch: true });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/net::ERR|fonts\.googleapis|Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await p.goto('file://' + resolve('test/harness.html'));
  for (const m of readdirSync('test/mock').sort()) await p.addScriptTag({ path: resolve('test/mock/' + m) });
  if (o.cf !== false) await p.evaluate(CF);
  await p.addScriptTag({ path: bundle });
  await p.evaluate(async (cfg) => {
    const H = (window.__h = window.mockHass());
    // recorder/statistics_during_period: én rad per dag, max = 100 + dag-indeks (tellere), mean = 50 (ms/%), max = 80
    const ws = H.callWS;
    window.__stats = [];
    H.callWS = (m) => {
      if (m.type !== 'recorder/statistics_during_period') return ws(m);
      window.__stats.push(m);
      const s = new Date(m.start_time), e = new Date(m.end_time), r = {};
      m.statistic_ids.forEach((id) => { r[id] = []; for (let t = new Date(s), i = 0; t < e; t.setDate(t.getDate() + 1), i++) r[id].push({ start: t.getTime(), end: t.getTime() + 86400000, max: m.types.includes('mean') ? 80 : 100 + i, mean: 50 }); });
      return Promise.resolve(r);
    };
    MSH.lastHass = H; if (MSH.store && !MSH.store.loaded) MSH.store.load(H);
    const bc = document.createElement('bubble-card');
    bc.setConfig({ type: 'custom:bubble-card', card_type: 'pop-up', hash: '#server' });
    bc.innerHTML = '<div class="pop"><div class="hdr">Server</div><div class="inner"></div></div>';
    document.getElementById('dash').appendChild(bc);
    location.hash = '#server';
    const c = document.createElement('msh-server-card');
    c.setConfig({ type: 'custom:msh-server-card', card_id: 'pop-server', ...(cfg || {}) });
    c.hass = H;
    bc.querySelector('.inner').appendChild(c);
    window.__c = c;
    window.__R = (s) => c.shadowRoot.querySelector(s); window.__A = (s) => [...c.shadowRoot.querySelectorAll(s)];
    window.__t = (e) => (e ? e.textContent.replace(/\s+/g, ' ').trim() : null);
    window.deepAll = (sel) => { const out = []; const walk = (root) => root.querySelectorAll('*').forEach((e) => { if (e.matches(sel)) out.push(e); if (e.shadowRoot) walk(e.shadowRoot); }); walk(document); return out; };
    window.deep = (sel) => window.deepAll(sel)[0] || null;
    await new Promise((q) => setTimeout(q, 1200));
  }, cfg);
  return { p, ctx, errs };
}
const click = async (p, sel, ms = 300) => { const r = await p.evaluate((sel) => { const e = window.__R(sel); if (!e) return false; e.click(); return true; }, sel); await sleep(ms); return r; };
const shot = async (p, n) => { if (shots) await p.screenshot({ path: `${shots}/v6-${n}.png`, fullPage: true }); };
const tabs = (p) => p.evaluate(() => __A('.trow .tb').map((x) => x.dataset.v));

/* ---------------- 1 · uten sensorene: ingen arildkristo.com */
{
  const { p, ctx, errs } = await page(null, { cf: false });
  const T = await tabs(p);
  ok('1 uten Cloudflare-sensorer: ingen arildkristo.com-fane', !T.includes('cf'), T);
  ok('1 ingen sidefeil', !errs.length, errs);
  await ctx.close();
}

/* ---------------- 2 · med sensorene: fane, chip, toppkort, prosa, underfaner */
{
  const { p, ctx, errs } = await page();
  const T = await tabs(p);
  ok('2 arildkristo.com-fanen vises (sist, etter qBittorrent-plassen)', T[T.length - 1] === 'cf', T);
  const ic = await p.evaluate(() => __A('.trow .tb').map((x) => { const i = x.querySelector('ha-icon'), r = i && i.getBoundingClientRect(); return { v: x.dataset.v, icon: i && i.getAttribute('icon'), w: r && Math.round(r.width), gap: getComputedStyle(x).gap, col: i && getComputedStyle(i).color === getComputedStyle(x).color }; }));
  const want = { net: 'mdi:router-network', proxmox: 'mdi:cube-outline', unraid: 'mdi:dns', ha: 'mdi:home', cf: 'mdi:web' };
  ok('2 alle faner har ikon (18 px, 6 px mellomrom, tekstfargen) – standardikonene', ic.every((x) => x.icon === want[x.v] && x.w === 18 && x.gap === '6px' && x.col), ic);
  const snap = await p.evaluate(() => { const s = getComputedStyle(__R('.trow .tabs')); return { snap: s.scrollSnapType, ov: s.overflowX, al: getComputedStyle(__R('.trow .tb')).scrollSnapAlign }; });
  ok('2 fanelinjen scroller fortsatt med senter-snapping', /x/.test(snap.snap) && snap.ov === 'auto' && snap.al === 'center', snap);
  await p.evaluate(() => __A('.trow .tb').find((x) => x.dataset.v === 'cf').click()); await sleep(900);
  const S = await p.evaluate(() => ({ title: __t(__R('.hero .hn')), chip: __t(__R('.hero .chip')), cls: __R('.hero .chip').className, big: __t(__R('.hero .big')), sv: __A('.hero .sv').map(__t), prose: __t(__R('.prose')), subs: __A('.subs .sb').map(__t) }));
  ok('2 toppkort: arildkristo.com, «Tilkoblet», Besøk 312 (funnet via unique_id) + Forespørsler/Data', S.title === 'arildkristo.com' && S.chip === 'Tilkoblet' && /ok/.test(S.cls) && S.big === '312' && /5\s?840/.test(S.sv[0]) && /214 MB/.test(S.sv[1]), S);
  ok('2 prosa: «arildkristo.com har hatt 312 besøk og 5 840 forespørsler siste 24 timer.»', /^arildkristo\.com har hatt 312 besøk og 5\s840 forespørsler siste 24 timer\.$/.test(S.prose), S.prose);
  ok('2 underfaner Trafikk · Besøk · Ytelse · Sikkerhet', S.subs.join() === 'Trafikk,Besøk,Ytelse,Sikkerhet', S.subs);
  // Trafikk
  let X = await p.evaluate(() => ({ tiles: __A('.cfk .cft1').map((t) => __t(t)), seg: __A('.cfseg button').map(__t), on: __t(__R('.cfseg button.on')) }));
  ok('2 Trafikk · Siste 24 t: besøk, forespørsler, dataoverføring', X.tiles.length === 3 && /Besøk 312/.test(X.tiles[0]) && /5\s840/.test(X.tiles[1]) && /214,37\s*MB/.test(X.tiles[2]) && X.seg.join() === 'Siste 24 t,I dag' && X.on === 'Siste 24 t', X);
  await click(p, '.cfseg button[data-v="idag"]');
  X = await p.evaluate(() => __A('.cfk .cft1').map((t) => __t(t)));
  ok('2 Trafikk · «I dag» viser to fliser (187 besøk, 3 412 forespørsler)', X.length === 2 && /187/.test(X[0]) && /3\s412/.test(X[1]), X);
  await shot(p, 'trafikk');
  // tap → more-info
  await p.evaluate(() => { window.__mi = []; window.addEventListener('hass-more-info', (e) => window.__mi.push(e.detail.entityId), true); __c.shadowRoot.addEventListener('hass-more-info', (e) => window.__mi.push(e.detail.entityId)); });
  await click(p, '.cfk .cft1');
  const mi = await p.evaluate(() => window.__mi);
  ok('2 trykk på en flis åpner more-info', mi.includes('sensor.ki_arild_kristo_besok_i_dag'), mi);
  // Status
  X = await p.evaluate(() => ({ t: __t(__R('.cfst')), ok: __R('.cfst').classList.contains('ok') }));
  ok('2 statuslinje: «Cloudflare · 1 spørring ok · oppdateres hvert 30. min»', X.ok && X.t === 'Cloudflare · 1 spørring ok · oppdateres hvert 30. min', X);
  // Besøk
  await click(p, '.subs .sb[data-v="besok"]', 600);
  X = await p.evaluate(() => ({ titles: __A('.pane .ct').map(__t), tiles: __A('.cfk .cft1').map(__t),
    lists: __A('.cfl2').map((l) => __A('.cfl2').indexOf(l) >= 0 && [...l.querySelectorAll('.cflr')].map((r) => [r.children[0].textContent, r.children[2].textContent, parseFloat(r.querySelector('.cflt>span').style.width), r.children[0].hasAttribute('data-noi18n')])), st: __t(__R('.cfst')) }));
  ok('2 Besøk: «Besøkende» (sidevisninger 1 240, unike 268) + Toppland + Mest besøkte sider + Historikk', X.titles.join() === 'Besøkende,Toppland,Mest besøkte sider,Historikk' && /1\s240/.test(X.tiles[0]) && /268/.test(X.tiles[1]), X);
  const L0 = X.lists[0], L1 = X.lists[1];
  ok('2 Toppland leses riktig (navn · antall · søyle relativt til største, navn data-noi18n)', L0.length === 5 && L0[0][0] === 'Norway' && /3\s120/.test(L0[0][1]) && L0[0][2] === 100 && L0[1][0] === 'United States' && Math.abs(L0[1][2] - 31.4) < 0.1 && L0.every((r) => r[3]), L0);
  ok('2 Mest besøkte sider leses riktig («/» og stier)', L1.length === 5 && L1[0][0] === '/' && L1[0][1] === '820' && L1[3][0] === '/blogg/ki-hjem' && L1[4][1] === '38', L1);
  ok('2 Besøk-status: 3 spørringer ok', X.st === 'Cloudflare · 3 spørringer ok · oppdateres hvert 30. min', X.st);
  // Ytelse
  await click(p, '.subs .sb[data-v="ytelse"]', 600);
  X = await p.evaluate(() => ({ titles: __A('.pane .ct').map(__t), tiles: __A('.cfk .cft1').map(__t), meters: __A('.cfm').map((m) => [__t(m), parseFloat(m.querySelector('.cfmt>span').style.width)]) }));
  ok('2 Ytelse: «Svartid og feil» (p50 42 ms, p95 186 ms, 4xx 1,82 %, 5xx 0,04 %) + «Hurtiglager»', X.titles.slice(0, 2).join() === 'Svartid og feil,Hurtiglager' && /42\s*ms/.test(X.tiles[0]) && /186\s*ms/.test(X.tiles[1]) && /1,82\s*%/.test(X.tiles[2]) && /0,04\s*%/.test(X.tiles[3]) && X.tiles.length === 6, X);
  ok('2 Hurtiglager: målere Treffrate 62,4 % og Båndbredde spart 65,9 % (stolpe 0–100)', X.meters.length === 2 && /Treffrate\s*62,4 %/.test(X.meters[0][0]) && X.meters[0][1] === 62.4 && /65,9 %/.test(X.meters[1][0]), X.meters);
  // Sikkerhet (NXDOMAIN unavailable → «–»)
  await click(p, '.subs .sb[data-v="sikkerhet"]', 600);
  X = await p.evaluate(() => ({ titles: __A('.pane .ct').map(__t), meters: __A('.cfm').map(__t), tiles: __A('.cfk .cft1').map(__t) }));
  ok('2 Sikkerhet: «Sikkerhet» (stoppede + Andel stoppet) og «DNS» (oppslag + NXDOMAIN «–»)', X.titles.slice(0, 2).join() === 'Sikkerhet,DNS' && /186/.test(X.tiles[0]) && /4\s820/.test(X.tiles[1]) && /Andel stoppet\s*3,1 %/.test(X.meters[0]) && /NXDOMAIN-andel\s*–/.test(X.meters[1]), X);
  await shot(p, 'sikkerhet');
  ok('2 ingen sidefeil', !errs.length, errs);

  /* ---------------- 3 · feiltekst i en status-sensor */
  await p.evaluate(async () => { const H = window.__h, id = 'sensor.ki_arild_kristo_cloudflare_status_dns'; const nh = { ...H, states: { ...H.states, [id]: { ...H.states[id], state: 'GraphQL: rate limited', last_updated: new Date().toISOString() } } }; window.__h = nh; __c.hass = nh; await new Promise((q) => setTimeout(q, 500)); });
  X = await p.evaluate(() => ({ chip: __t(__R('.hero .chip')), cls: __R('.hero .chip').className, st: __t(__R('.cfst')), warn: __R('.cfst').classList.contains('warn'), col: getComputedStyle(__R('.cfst')).color, chipCol: getComputedStyle(__R('.hero .chip')).color }));
  ok('3 feiltekst → oransje chip «Feil i spørring» og oransje varsel med feilteksten', X.chip === 'Feil i spørring' && /warn/.test(X.cls) && X.warn && /GraphQL: rate limited/.test(X.st) && X.col === 'rgb(242, 181, 115)', X);
  await shot(p, 'feil');
  await ctx.close();
}

/* ---------------- 4 · historikk (7/30/90/52, sum/snitt/maks, periode beholdes etter reload) */
{
  const ctx = await b.newContext({ viewport: { width: 412, height: 900 }, hasTouch: true });
  let { p, errs } = await page({ start_tab: 'cf' }, { ctx });
  await sleep(500);
  let H = await p.evaluate(() => ({ on: __t(__R('.cfr.on')), n: __A('.cfc').map((c) => c.querySelectorAll('.cfb').length), last: __A('.cfc')[0] && getComputedStyle(__A('.cfc')[0].querySelector('.cfb.last')).backgroundColor, prev: __A('.cfc')[0] && getComputedStyle(__A('.cfc')[0].querySelector('.cfb')).backgroundColor, foot: __t(__R('.cfft')), q: window.__stats.map((m) => [m.period, m.types.join('+'), m.statistic_ids.length]) }));
  ok('4 Historikk: 30 d som standard, 30 søyler per graf, 3 grafer på Trafikk, siste søyle full farge (resten 55 %)', H.on === '30 d' && H.n.join() === '30,30,30' && H.last !== H.prev, H);
  ok('4 data fra recorder/statistics_during_period (period day, tellere [max])', H.q.some((x) => x[0] === 'day' && x[1] === 'max' && x[2] === 3), H.q);
  ok('4 bunntekst «Fra Home Assistant-statistikk · ett punkt per dag»', H.foot === 'Fra Home Assistant-statistikk · ett punkt per dag', H.foot);
  const counts = {};
  for (const i of [0, 1, 2, 3]) { await click(p, `.cfr[data-v="${i}"]`, 500); counts[i] = await p.evaluate(() => ({ n: __A('.cfc')[0].querySelectorAll('.cfb').length, sum: +__A('.cfc')[0].dataset.sum, tot: __t(__A('.cfc')[0].querySelector('.cft')), avg: __t(__A('.cfc')[0].querySelector('.cfavg')), t0: __t(__A('.cfc')[0].querySelector('.cfax span')) })); }
  // mock: dag i (0 = eldste) har max 100 + i → sum = n·100 + n(n−1)/2
  const sumOf = (n) => n * 100 + (n * (n - 1)) / 2;
  ok('4 søyleantall 7 / 30 / 90 / 52', [counts[0].n, counts[1].n, counts[2].n, counts[3].n].join() === '7,30,90,52', counts);
  ok('4 sum og «snitt § / dag» stemmer (7 d: 721, snitt 103)', counts[0].sum === sumOf(7) && counts[0].tot === '721' && counts[0].avg === 'snitt 103 / dag', counts[0]);
  ok('4 1 år: 52 uker (uke = sum), sum over 364 dager, «for 1 år siden»', counts[3].sum === sumOf(364) && counts[3].t0 === 'for 1 år siden', counts[3]);
  const gb = await p.evaluate(() => ({ u: __t(__A('.cfc')[2].querySelector('.cfu')), tot: __t(__A('.cfc')[2].querySelector('.cft')) }));
  ok('4 data over 1000 MB vises som GB', gb.u === 'GB', gb);
  // ms/% = snitt + maks
  await click(p, '.subs .sb[data-v="ytelse"]', 700);
  H = await p.evaluate(() => __A('.cfc').map((c) => ({ l: __t(c.querySelector('.grow')), tot: __t(c.querySelector('.cft')), avg: __t(c.querySelector('.cfavg')), mean: +c.dataset.mean, max: +c.dataset.max, n: c.querySelectorAll('.cfb').length })));
  ok('4 Ytelse: svartid p95 og treffrate – snitt 50 og «maks 80», uke = snitt (52 søyler)', H.length === 2 && H[0].mean === 50 && H[0].max === 80 && H[0].tot === '50' && H[0].avg === 'maks 80' && /50,0/.test(H[1].tot) && H[0].n === 52, H);
  // trykk på en søyle → dato og verdi
  await p.evaluate(() => { window.__toast = []; const o = MSH.toast; MSH.toast = (t, x) => { window.__toast.push(t); return o(t, x); }; });
  await click(p, '.cfr[data-v="0"]', 500);
  await p.evaluate(() => __A('.cfc')[0].querySelector('.cfb.last').click()); await sleep(200);
  const tst = await p.evaluate(() => window.__toast);
  ok('4 trykk på en søyle viser dato og verdi', tst.some((t) => /^\d+\.\d+\. · 50 ms$/.test(t)), tst);
  await click(p, '.cfr[data-v="2"]', 400);
  const ls = await p.evaluate(() => localStorage.getItem('ki-cf-periode'));
  await p.close();
  ({ p, errs } = await page({ start_tab: 'cf' }, { ctx }));
  await sleep(400);
  const after = await p.evaluate(() => ({ on: __t(__R('.cfr.on')), n: __A('.cfc')[0] && __A('.cfc')[0].querySelectorAll('.cfb').length }));
  ok('4 perioden beholdes etter reload (localStorage ki-cf-periode)', ls === '2' && after.on === '90 d' && after.n === 90, { ls, after });
  ok('4 ingen sidefeil', !errs.length, errs);
  await ctx.close();
}

/* ---------------- 5 · fliser på 360 px: ingen avkuttede etiketter */
{
  const { p, ctx, errs } = await page({ start_tab: 'cf' }, { vp: { width: 360, height: 800 } });
  const cut = [];
  for (const sub of ['trafikk', 'besok', 'ytelse', 'sikkerhet']) {
    await click(p, `.subs .sb[data-v="${sub}"]`, 500);
    cut.push(...await p.evaluate((sub) => __A('.cft1 .cfl>span, .cfm .cfmh .grow').filter((s) => s.scrollWidth > s.clientWidth + 1 || getComputedStyle(s).textOverflow === 'ellipsis' || s.getBoundingClientRect().right > s.closest('button').getBoundingClientRect().right + 0.5).map((s) => sub + ':' + s.textContent), sub));
  }
  const wrap = await p.evaluate(() => { const s = __A('.cft1 .cfl>span').find((x) => /Stoppede/.test(x.textContent)); return s ? Math.round(s.getBoundingClientRect().height) : null; });
  ok('5 360 px: ingen avkuttede flis-/måler-etiketter (brytes over flere linjer)', !cut.length && wrap > 16, { cut, wrap });
  const page360 = await p.evaluate(() => document.documentElement.scrollWidth <= 360);
  ok('5 360 px: ingen sideveis side-scroll', page360);
  await shot(p, '360');
  ok('5 ingen sidefeil', !errs.length, errs);
  await ctx.close();
}

/* ---------------- 6 · «Tilpass server» */
{
  const ctx = await b.newContext({ viewport: { width: 412, height: 900 }, hasTouch: true });
  let { p, errs } = await page(null, { ctx });
  await click(p, '.trow .gear', 700);
  let X = await p.evaluate(() => { const o = MSH.portals().pop(), r = o.shadowRoot; return { title: __t(r.querySelector('.tt')), modes: [...r.querySelectorAll('.md .ml')].map(__t), on: __t(r.querySelector('.md.on .ml')), hosts: [...r.querySelectorAll('.hb .hn')].map(__t), x: !!r.querySelector('.x'), bg: getComputedStyle(r.querySelector('.bg')).backgroundColor, top: Math.round(r.querySelector('.sh').getBoundingClientRect().top) }; });
  ok('6 tannhjulet åpner «Tilpass server» øverst med mørk bakgrunn: Faner viser (3 valg) + Ikon per server', X.title === 'Tilpass server' && X.modes.join() === 'Ikon og navn,Navn på valgt fane,Bare ikoner' && X.on === 'Ikon og navn' && X.hosts.includes('arildkristo.com') && X.x && X.top < 120, X);
  const mode = async (v) => { await p.evaluate((v) => MSH.portals().pop().shadowRoot.querySelector(`.md[data-v="${v}"]`).click(), v); await sleep(400); return p.evaluate(() => __A('.trow .tb').map((t) => ({ v: t.dataset.v, on: t.classList.contains('on'), name: !!t.querySelector('.tbn'), io: t.classList.contains('io'), title: t.title, mw: getComputedStyle(t).minWidth, pad: getComputedStyle(t).padding }))); };
  let T = await mode('ikon');
  ok('6 «Bare ikoner»: ingen navn, min-bredde fanehøyde + 8 (52 px), padding 0 12px, title = navnet', T.every((t) => !t.name && t.io && t.mw === '52px' && t.pad === '0px 12px' && t.title), T);
  T = await mode('aktiv');
  ok('6 «Navn på valgt fane»: bare aktiv fane viser navnet', T.every((t) => t.name === t.on), T);
  await p.evaluate(() => { const r = MSH.portals().pop().shadowRoot; r.querySelector('.hb[data-v="net"]').click(); });
  await sleep(250);
  X = await p.evaluate(() => { const r = MSH.portals().pop().shadowRoot; return { n: r.querySelectorAll('.ig .io').length, cols: getComputedStyle(r.querySelector('.ig')).gridTemplateColumns.split(' ').length }; });
  ok('6 Ikon per server: trykk utvider rutenett med 18 ikoner i 6 kolonner', X.n === 18 && X.cols === 6, X);
  await p.evaluate(() => MSH.portals().pop().shadowRoot.querySelector('.io[data-v="wifi"]').click()); await sleep(400);
  X = await p.evaluate(() => ({ tab: __A('.trow .tb').find((t) => t.dataset.v === 'net').querySelector('ha-icon').getAttribute('icon'), reset: !!MSH.portals().pop().shadowRoot.querySelector('.rs[data-v="net"]'), cfg: __c.config.host_icons, mode: __c.config.tab_mode, ls: JSON.parse(localStorage.getItem('ki-server-tilpass') || '{}') }));
  ok('6 nytt ikon oppdaterer fanen med en gang, «Tilbakestill» vises, lagres i config (+ speil i localStorage)', X.tab === 'mdi:wifi' && X.reset && X.cfg && X.cfg.net === 'wifi' && X.mode === 'aktiv' && X.ls.icons.net === 'wifi' && X.ls.tabMode === 'aktiv', X);
  // kort-velgeren bruker samme ikon
  await sleep(1200); // lagringen fra arket (debounce 600 ms) er ferdig
  await p.evaluate(async () => { __c.setConfig({ ...__c.config, velger: 'kort' }); await new Promise((q) => setTimeout(q, 500)); });
  X = await p.evaluate(() => ({ hc: __A('.hcards .hc').map((h) => [h.dataset.v, h.querySelector('.ring ha-icon').getAttribute('icon'), __t(h.querySelector('.hcb span'))]) }));
  ok('6 kort-velgeren bruker samme ikon + «N besøk · 24 t» for arildkristo.com', (X.hc.find((h) => h[0] === 'net') || [])[1] === 'mdi:wifi' && (X.hc.find((h) => h[0] === 'cf') || [])[2] === '312 besøk · 24 t', X);
  await p.evaluate(async () => { const c = { ...__c.config }; delete c.velger; __c.setConfig(c); await new Promise((q) => setTimeout(q, 400)); });
  // Tilbakestill
  await p.evaluate(() => MSH.portals().pop().shadowRoot.querySelector('.rs[data-v="net"]').click()); await sleep(400);
  X = await p.evaluate(() => ({ ic: __c.config.host_icons, reset: !!MSH.portals().pop().shadowRoot.querySelector('.rs[data-v="net"]') }));
  ok('6 «Tilbakestill» gir standardikonet tilbake', !X.ic && !X.reset, X);
  await p.evaluate(() => MSH.portals().pop().shadowRoot.querySelector('.io[data-v="cloud"]').click()); await sleep(400);
  // lukk med ✕
  await p.evaluate(() => MSH.portals().pop().shadowRoot.querySelector('.x').click()); await sleep(400);
  X = await p.evaluate(() => MSH.portals().filter((o) => o.isConnected && o.shadowRoot.querySelector('.tt')).length);
  ok('6 ✕ lukker arket', X === 0, X);
  // «Flere innstillinger» → hele Tilpass-arket
  await click(p, '.trow .gear', 600);
  await p.evaluate(() => MSH.portals().pop().shadowRoot.querySelector('.more').click()); await sleep(900);
  X = await p.evaluate(() => { const o = MSH.portals().pop(); return o && o.dataset.tpSheet === '1' && !!o.shadowRoot.querySelector('msh-editor'); });
  ok('6 «Flere innstillinger» åpner hele «Tilpass Server»-arket', X, X);
  await p.close();
  // valgene beholdes etter reload (config i ki-store; ny side uten config leser speilet)
  ({ p, errs } = await page(null, { ctx }));
  X = await p.evaluate(() => ({ io: __A('.trow .tb').filter((t) => !t.querySelector('.tbn')).length, n: __A('.trow .tb').length, net: __A('.trow .tb').find((t) => t.dataset.v === 'net').querySelector('ha-icon').getAttribute('icon') }));
  ok('6 valgene beholdes etter reload («Navn på valgt fane», nytt ikon)', X.io === X.n - 1 && X.net === 'mdi:cloud-outline', X);
  ok('6 ingen sidefeil', !errs.length, errs);
  await ctx.close();
}

/* ---------------- 7 · engelsk */
{
  const { p, ctx, errs } = await page({ start_tab: 'cf' });
  await p.evaluate(async () => { window.kiSetLang('en'); await new Promise((q) => setTimeout(q, 600)); });
  const seen = [];
  for (const sub of ['trafikk', 'besok', 'ytelse', 'sikkerhet']) {
    await click(p, `.subs .sb[data-v="${sub}"]`, 600);
    seen.push(await p.evaluate(() => __R('.wrap').innerText));
  }
  await p.evaluate(async () => { __c.shadowRoot.querySelector('.trow .gear').click(); await new Promise((q) => setTimeout(q, 600)); });
  seen.push(await p.evaluate(() => MSH.portals().pop().shadowRoot.querySelector('.body').innerText));
  const all = seen.join('\n');
  const NO = ['Trafikk', 'Besøkende', 'Sidevisninger', 'Unike besøkende', 'Toppland', 'Mest besøkte sider', 'Svartid og feil', 'Hurtiglager', 'Treffrate', 'Båndbredde spart', 'Stoppede forespørsler', 'Andel stoppet', 'DNS-oppslag', 'Historikk', 'snitt', 'maks', 'Siste 24', 'spørring', 'oppdateres', 'Tilpass server', 'Faner viser', 'Ikon og navn', 'Navn på valgt fane', 'Bare ikoner', 'Ikon per server', 'Fra Home Assistant-statistikk', 'har hatt', 'besøk', 'forespørsler', 'i dag', 'Flere innstillinger', 'Tilkoblet', 'Dataoverføring', 'Fra hurtiglager', 'Data fra hurtiglager', 'Svartid'];
  const left = NO.filter((w) => all.includes(w));
  ok('7 engelsk: alle nye tekster er oversatt', !left.length, { left, sample: all.slice(0, 600) });
  ok('7 engelsk: landnavn og stier uendret', all.includes('Norway') && all.includes('/prosjekter'), null);
  ok('7 engelsk: «Traffic · Visits · Performance · Security»', /Traffic/.test(all) && /Visits/.test(all) && /Performance/.test(all) && /Security/.test(all), null);
  await p.evaluate(() => window.kiSetLang('no'));
  ok('7 ingen sidefeil', !errs.length, errs);
  await ctx.close();
}

await b.close();
console.log(res.join('\n'));
const bad = res.filter((r) => r.startsWith('✘')).length;
console.log(`\n${res.length - bad}/${res.length} OK`);
process.exit(bad ? 1 : 0);
