// Fiks 19.1 · #ruter mot ekte Bubble Card: toppkort (nedtelling, «Gå nå», tidslinje), Reise (Til skolen / Hjem, raskest først),
// avvik, stopp som nedtrekksliste (Neste avgang / Senere / Vis flere), «oppdatert»-linjen og at Entur bare hentes mens
// popupen er åpen. Entur (journey-planner/geocoder) er ikke nåbar fra testen – fetch mockes; uten mock → sensorene.
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { readdirSync, existsSync, mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const BC = resolve('test/.vendor/bubble-card.js');
if (!existsSync(BC)) execFileSync('curl', ['-sSL', '-o', BC, 'https://raw.githubusercontent.com/Clooos/Bubble-Card/main/dist/bubble-card.js']);
mkdirSync(resolve('test/.build'), { recursive: true });
const bundle = resolve(`test/.build/ruter19-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const SHOTS = process.env.SHOTS || '';
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); };

async function page(mockEntur) {
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + resolve('test/harness-bubble.html'));
  await p.evaluate((mock) => {
    window.__fetches = [];
    const iso = (m) => new Date(Date.now() + m * 60000).toISOString();
    const call = (m, line, mode, dest, plat, occ, delay = 0) => ({ aimedDepartureTime: iso(m - delay), expectedDepartureTime: iso(m), realtime: true, occupancyStatus: occ, quay: { publicCode: plat, name: 'x' }, destinationDisplay: { frontText: dest }, serviceJourney: { line: { publicCode: line, transportMode: mode } } });
    const GEO = { amagerveien: 'NSR:StopPlace:1001', majorstuen: 'NSR:StopPlace:58381', 'holbergs plass': 'NSR:StopPlace:6531', holmen: 'NSR:StopPlace:1004', frydenlund: 'NSR:StopPlace:1005', hovseter: 'NSR:StopPlace:1006' };
    // Etapper: [fra, til] → [linje, modus, avganger (min), reisetid]
    const LEGS = { '1001>58381': ['45', 'bus', [3, 13, 23], 9], '1004>58381': ['1', 'metro', [6, 21], 8], '58381>6531': ['11', 'tram', [14, 16, 22, 29, 37], 7],
      '6531>58381': ['11', 'tram', [2, 9, 17], 7], '1005>58381': ['19', 'tram', [4, 12], 6], '58381>1001': ['45', 'bus', [14, 24], 9], '58381>1004': ['1', 'metro', [15, 30], 8], '58381>1006': ['2', 'metro', [13, 28], 7] };
    window.fetch = async (url, opts) => {
      url = String(url);
      if (!url.includes('api.entur.io')) return { ok: false, status: 404, json: async () => ({}), text: async () => '' }; // Bubble Cards egne filer
      window.__fetches.push({ url, t: Date.now(), hdr: opts && opts.headers && opts.headers['ET-Client-Name'], body: opts && opts.body ? JSON.parse(opts.body) : null });
      if (!mock) throw new TypeError('Failed to fetch');
      const J = (o) => ({ ok: true, status: 200, json: async () => o });
      if (url.includes('/geocoder/')) {
        const t = new URL(url).searchParams.get('text').toLowerCase(), id = GEO[t];
        return J({ features: id ? [{ properties: { id, name: t.replace(/^./, (c) => c.toUpperCase()) } }] : [] });
      }
      const body = JSON.parse(opts.body), v = body.variables || {};
      if (/stopPlace/.test(body.query)) {
        if (v.id === 'NSR:StopPlace:6488') return J({ data: { stopPlace: { id: v.id, name: 'Bislett', estimatedCalls: [
          call(2, '17', 'tram', 'Grefsen st.', '1', 'manySeatsAvailable'), call(8, '18', 'tram', 'Rikshospitalet', '2', 'fewSeatsAvailable', 3), call(12, '17', 'tram', 'Grefsen st.', '1', 'full'),
          call(16, '18', 'tram', 'Rikshospitalet', '2', 'noData'), call(22, '17', 'tram', 'Grefsen st.', '1', null), call(27, '18', 'tram', 'Rikshospitalet', '2', null),
          call(33, '17', 'tram', 'Grefsen st.', '1', null), call(41, '18', 'tram', 'Rikshospitalet', '2', null), call(48, '17', 'tram', 'Grefsen st.', '1', null), call(55, '18', 'tram', 'Rikshospitalet', '2', null), call(70, '17', 'tram', 'Grefsen st.', '1', null)] } } });
        const legs = Object.entries(LEGS).filter(([k]) => k.startsWith(v.id.split(':').pop() + '>'));
        return J({ data: { stopPlace: { id: v.id, name: 'x', estimatedCalls: legs.flatMap(([, [l, m, D]]) => D.map((d) => call(d, l, m, 'Mot sentrum', 'B', 'standingRoomOnly'))) } } });
      }
      if (/trip\(/.test(body.query)) {
        const L = LEGS[`${v.from.split(':').pop()}>${v.to.split(':').pop()}`];
        const pats = L ? L[2].map((d) => ({ legs: [{ mode: 'foot', line: null, expectedStartTime: iso(d - 1), expectedEndTime: iso(d) },
          { mode: L[1], realtime: true, aimedStartTime: iso(d), expectedStartTime: iso(d), expectedEndTime: iso(d + L[3]), fromPlace: { name: 'a', quay: { publicCode: 'C' } }, toPlace: { name: 'Mål' }, line: { publicCode: L[0], transportMode: L[1] }, fromEstimatedCall: { occupancyStatus: 'fewSeatsAvailable' } }] })) : [];
        return J({ data: { trip: { tripPatterns: pats } } });
      }
      return { ok: false, status: 404, json: async () => ({}) };
    };
    try { localStorage.removeItem('ki-msh:entur-geo'); } catch (e) { /* */ }
  }, mockEntur);
  for (const m of readdirSync('test/mock').sort()) await p.addScriptTag({ path: resolve('test/mock/' + m) });
  await p.addScriptTag({ path: bundle });
  await p.addScriptTag({ path: BC, type: 'module' });
  await p.waitForFunction(() => customElements.get('bubble-card'));
  await p.evaluate(async () => {
    const wait = (ms) => new Promise((q) => setTimeout(q, ms));
    window.__hass = window.mockHass();
    const cfg = window.customElements.get('msh-ruter-card').getStubConfig();
    cfg.card_id = 'r1';
    cfg.stops = { entur_bislett: { walk: '4 min gange' } };
    cfg.trips.auto_switch = '24:00'; // alltid «Til skolen» først (uavhengig av klokken)
    const bc = document.createElement('bubble-card');
    bc.setConfig({ type: 'custom:bubble-card', card_type: 'pop-up', hash: '#ruter', name: 'Ruter', bg_color: '#282828', bg_opacity: 100, bg_blur: 0, cards: [{ type: 'custom:msh-ruter-card', ...cfg }] });
    bc.hass = window.__hass; document.getElementById('dash').appendChild(bc);
    await wait(400);
  });
  return { p, errs };
}
const all = `(() => { const o = []; const w = (r) => r.querySelectorAll('*').forEach((e) => { o.push(e); if (e.shadowRoot) w(e.shadowRoot); }); w(document); return o; })()`;

// ---- 1: med Entur-mock
{
  const { p, errs } = await page(true);
  const before = await p.evaluate(() => window.__fetches.length);
  ok(before === 0, `henting før popupen er åpnet: ${before}`);
  await p.evaluate(() => { location.hash = '#ruter'; });
  await p.waitForTimeout(2200);
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/ruter19-topp.png` });
  const r = await p.evaluate(async (ALL) => {
    const wait = (ms) => new Promise((q) => setTimeout(q, ms));
    const k = eval(ALL).find((e) => e.localName === 'msh-ruter-card' && e.getBoundingClientRect().height > 0);
    window.__k = k;
    const sr = k.shadowRoot, q = (s) => sr.querySelector(s), txt = (e) => (e ? e.textContent.replace(/\s+/g, ' ').trim() : null);
    const out = {};
    out.order = [...sr.querySelector('.wrap').children].map((e) => e.className.split(' ')[0]);
    const hero = q('.hero'); out.heroH = Math.round(hero.getBoundingClientRect().height); out.heroW = Math.round(hero.getBoundingClientRect().width); out.cardW = Math.round(k.getBoundingClientRect().width);
    out.hero = txt(hero); out.heroChip = txt(q('.hero .go'));
    out.dots = sr.querySelectorAll('.tdot').length; out.tlTouch = getComputedStyle(q('.tl')).touchAction;
    out.fetches = window.__fetches.length; out.client = window.__fetches.find((f) => f.hdr) && window.__fetches.find((f) => f.hdr).hdr;
    out.jpUrl = window.__fetches.some((f) => f.url === 'https://api.entur.io/journey-planner/v3/graphql');
    // Reise
    out.seg = [...sr.querySelectorAll('.seg .sg')].map((e) => [txt(e), e.classList.contains('on')]);
    out.alts = [...sr.querySelectorAll('.alt')].map((e) => [txt(e), e.classList.contains('fast')]);
    // trykk på en prikk (ikke den valgte) → toppkortet bytter
    const d2 = [...sr.querySelectorAll('.tdot')].find((e) => !e.classList.contains('on'));
    const bigBefore = txt(q('.hbig'));
    d2.click(); await wait(200);
    out.dotSel = { before: bigBefore, after: txt(q('.hbig')), lab: txt(q('.hlab')), on: d2.classList.contains('on') || !!sr.querySelector('.tdot.on[data-k="' + d2.dataset.k + '"]') };
    q('.hlab').click(); await wait(200); out.reset = txt(q('.hlab'));
    // stopp: lukket → åpen
    const st = q('.stop[data-k="sensor.entur_bislett"]');
    out.closed = { aria: st.getAttribute('aria-expanded'), txt: txt(st) };
    st.click(); await wait(200);
    const st2 = q('.stop[data-k="sensor.entur_bislett"]');
    out.open = { aria: st2.getAttribute('aria-expanded'), nx: txt(st2.querySelector('.nx')), lk: txt(st2.querySelector('.lk')), rows: st2.querySelectorAll('.dep').length, occ: st2.querySelectorAll('.occ').length, vm: txt(st2.querySelector('.vm')) };
    st2.querySelector('.vm').click(); await wait(200);
    const st3 = q('.stop[data-k="sensor.entur_bislett"]');
    out.more = { lk: txt(st3.querySelector('.lk')), rows: st3.querySelectorAll('.dep').length, vm: txt(st3.querySelector('.vm')), aria: st3.getAttribute('aria-expanded') };
    out.upd = txt(q('.upd'));
    // 20.11 · én Tilpass-inngang, reise-kortet kan åpnes
    out.cust = [...sr.querySelectorAll('[data-act="customize"]')].map((e) => e.className);
    out.hdrBtn = !!q('.hdr button'); out.oppsett = /Tilpass oppsett/.test(txt(sr.querySelector('.wrap')));
    const a0 = sr.querySelectorAll('.alt')[0];
    out.a0 = { role: a0.getAttribute('role'), aria: a0.getAttribute('aria-expanded'), chev: !!a0.querySelector('ha-icon[icon="mdi:chevron-down"]') };
    window.__hap = []; window.addEventListener('haptic', (e) => window.__hap.push(e.detail));
    a0.click(); await wait(200);
    const b0 = sr.querySelectorAll('.alt')[0], pl = b0.querySelector('.plan');
    out.plan = pl ? { aria: b0.getAttribute('aria-expanded'), steps: [...pl.querySelectorAll('.ps')].map((e) => e.className.replace('ps ', '') + ':' + txt(e)), grid: getComputedStyle(pl.querySelector('.ps')).gridTemplateColumns,
      rot: b0.querySelector('ha-icon[icon="mdi:chevron-down"]').style.transform, ft: txt(pl.querySelector('.pnx')), pv: !!pl.querySelector('[data-act="tripHero"]'),
      dash: getComputedStyle(pl.querySelector('.ps.walk .pl')).borderLeftStyle, legRail: pl.querySelector('.ps.leg .pl').style.background } : null;
    out.hap = window.__hap.slice();
    pl && pl.click(); await wait(150);
    out.planStay = sr.querySelectorAll('.alt')[0].getAttribute('aria-expanded');
    sr.querySelectorAll('.alt')[1].click(); await wait(200);
    out.nOpen = sr.querySelectorAll('.alt[aria-expanded="true"] .plan').length;
    const hn0 = txt(q('.hname'));
    sr.querySelectorAll('.alt')[1].querySelector('[data-act="tripHero"]').click(); await wait(250);
    out.heroAlt = { before: hn0, after: txt(q('.hname')), lab: txt(q('.hlab')), stillOpen: sr.querySelectorAll('.alt[aria-expanded="true"]').length };
    // toppkortet av → «Tilpass» over Avganger
    const cfg0 = k.config;
    k.setConfig({ ...cfg0, hero: false }); await wait(200);
    out.noHero = { btn: txt(q('.hdr .ed')), icon: q('.hdr .ed ha-icon') && q('.hdr .ed ha-icon').getAttribute('icon') };
    k.setConfig(cfg0); await wait(200);
    // retning Hjem
    const hjem = [...sr.querySelectorAll('.seg .sg')].find((e) => txt(e) === 'Hjem') || [...sr.querySelectorAll('.seg .sg')][1];
    hjem.click(); await wait(1200);
    out.home = [...sr.querySelectorAll('.alt')].map((e) => [txt(e), e.classList.contains('fast')]);
    out.homeHero = txt(q('.hname'));
    return out;
  }, all);
  if (SHOTS) {
    await p.evaluate((ALL) => { const k = eval(ALL).find((e) => e.localName === 'msh-ruter-card' && e.getBoundingClientRect().height > 0); k.shadowRoot.querySelector('.stop').scrollIntoView(); }, all);
    await p.waitForTimeout(300); await p.screenshot({ path: `${SHOTS}/ruter19-stopp.png` });  await p.evaluate(async (ALL) => { const k = eval(ALL).find((e) => e.localName === 'msh-ruter-card' && e.getBoundingClientRect().height > 0); const a = k.shadowRoot.querySelector('.alt'); a.click(); await new Promise((q) => setTimeout(q, 300)); k.shadowRoot.querySelector('.alt').scrollIntoView(); }, all);
    await p.waitForTimeout(300); await p.screenshot({ path: `${SHOTS}/ruter20-reise.png` });
  }
  console.log(JSON.stringify(r, null, 1));
  ok(r.order.join(',') === 'hero,dis,trip,hdr,stop,stop,stop,upd', 'rekkefølge ' + r.order);
  ok(r.heroH === 184, 'toppkort-høyde ' + r.heroH);
  ok(r.heroW === r.cardW, 'toppkort full bredde');
  ok(r.jpUrl && r.client === 'sebastian-ki-dashboard', 'Entur-kall/klientnavn ' + r.client);
  ok(r.dots >= 3 && r.tlTouch === 'pan-y', 'tidslinje ' + r.dots + ' ' + r.tlTouch);
  ok(/Gå (nå|om)/.test(r.heroChip || ''), 'Gå nå-chip i toppkort');
  ok(r.seg.length === 2, 'segment');
  ok(r.alts.length === 2 && r.alts[0][1] && /Raskest/.test(r.alts[0][0]) && /fremme \d\d:\d\d/.test(r.alts[0][0]) && /bytte Majorstuen \(\d+ min\)/.test(r.alts[0][0]), 'reise-kort ' + JSON.stringify(r.alts));
  ok(r.dotSel.before !== r.dotSel.after && /Valgt avgang/.test(r.dotSel.lab), 'prikk bytter avgang ' + JSON.stringify(r.dotSel));
  ok(/Neste du rekker/.test(r.reset), 'tilbakestill valgt avgang');
  ok(r.closed.aria === 'false' && /så /.test(r.closed.txt) && /Spor \d/.test(r.closed.txt), 'lukket stopp ' + r.closed.txt);
  ok(r.open.aria === 'true' && /NESTE AVGANG/.test(r.open.nx) && /→/.test(r.open.nx) && /så \d+ min/.test(r.open.nx) && /\+3 min/.test(r.open.nx) && /Senere/i.test(r.open.lk) && r.open.rows === 3, 'åpent stopp ' + JSON.stringify(r.open));
  ok(/Vis \d+ flere/.test(r.open.vm), 'Vis flere');
  ok(/neste time/i.test(r.more.lk) && r.more.rows > 3 && r.more.vm === 'Vis færre', 'Vis flere → neste time ' + JSON.stringify(r.more));
  ok(/Sanntid fra Entur · oppdatert \d\d:\d\d:\d\d/.test(r.upd), 'oppdatert-linje ' + r.upd);
  // 20.11
  ok(r.cust.length === 1 && /hset/.test(r.cust[0]) && !r.hdrBtn && !r.oppsett, '20.11 bare tannhjulet som Tilpass-inngang ' + JSON.stringify([r.cust, r.hdrBtn, r.oppsett]));
  ok(r.a0.role === 'button' && r.a0.aria === 'false' && r.a0.chev, '20.11 reise-kort role=button + chevron ' + JSON.stringify(r.a0));
  const S = (r.plan && r.plan.steps) || [];
  ok(r.plan && r.plan.aria === 'true' && /rotate\(180deg\)/.test(r.plan.rot) && /^44px 22px /.test(r.plan.grid), '20.11 åpnet: aria/chevron/rutenett ' + JSON.stringify(r.plan && [r.plan.aria, r.plan.rot, r.plan.grid]));
  ok(S.map((x) => x.split(':')[0]).join(',') === 'walk,leg,swap,leg,end', '20.11 steg gå → buss → bytte → trikk → fremme ' + JSON.stringify(S));
  ok(/^walk:\d\d:\d\d Gå til Amagerveien\s*.*(Gå nå|Gå om \d+ min|Rekker ikke)/.test(S[0] || ''), '20.11 gå-steg ' + S[0]);
  ok(/^leg:\d\d:\d\d 45\s*Amagerveien\s*Plf\. C · mot Mål · 9 min · Noe folk/.test(S[1] || ''), '20.11 påstigning buss 45 ' + S[1]);
  ok(/^swap:\d\d:\d\d Bytte på Majorstuen\s*(Kort bytte · )?\d+ min til neste · Plf\. C/.test(S[2] || ''), '20.11 bytte ' + S[2]);
  ok(/^leg:\d\d:\d\d 11\s*Majorstuen\s*Plf\. C · mot Mål · 7 min/.test(S[3] || ''), '20.11 trikk ' + S[3]);
  ok(/^end:\d\d:\d\d Holbergs plass\s*Fremme · \d+ min totalt/.test(S[4] || ''), '20.11 fremme ' + S[4]);
  ok(r.plan && r.plan.dash === 'dashed' && /oklch|rgb/.test(r.plan.legRail || ''), '20.11 stiplet gå-skinne + heltrukket linjefarge ' + JSON.stringify(r.plan && [r.plan.dash, r.plan.legRail]));
  ok(r.plan && /^Neste mulighet: 45 kl \d\d:\d\d · deretter \d\d:\d\d$/.test(r.plan.ft) && r.plan.pv, '20.11 Neste mulighet + Vis i toppkortet ' + (r.plan && r.plan.ft));
  ok(r.hap.includes('light'), '20.11 haptic light ' + r.hap);
  ok(r.planStay === 'true' && r.nOpen === 2, '20.11 flere kan være åpne ' + r.nOpen);
  ok(r.heroAlt.after === 'Holmen' && r.heroAlt.before !== r.heroAlt.after && /Valgt avgang/.test(r.heroAlt.lab) && r.heroAlt.stillOpen === 2, '20.11 Vis i toppkortet ' + JSON.stringify(r.heroAlt));
  ok(r.noHero.btn === 'Tilpass' && r.noHero.icon === 'mdi:cog', '20.11 toppkort av → Tilpass over Avganger ' + JSON.stringify(r.noHero));
  ok(r.home.length === 4 && r.home[0][1], 'Hjem-alternativer ' + r.home.length);
  // Lukk popupen → ingen flere hentinger; tilstanden nullstilles
  const n0 = await p.evaluate(async () => { history.replaceState(null, '', location.pathname); window.dispatchEvent(new Event('hashchange')); await new Promise((q) => setTimeout(q, 600)); return window.__fetches.length; });
  const tick = await p.evaluate(() => { const k = window.__k; return { tick: k._tick, open: k.isOpen, ui: k.ui }; });
  ok(!tick.tick && !tick.open && !tick.ui.dir && !Object.keys(tick.ui.open || {}).length && !Object.keys(tick.ui.trips || {}).length && !tick.ui.heroAlt, 'lukket: timer stoppet + tilstand nullstilt ' + JSON.stringify(tick));
  await p.evaluate(async () => {
    // spol klokken fram (setInterval ville kjørt): ingen nye kall når popupen er lukket
    await new Promise((q) => setTimeout(q, 1000));
  });
  const n1 = await p.evaluate(() => window.__fetches.length);
  ok(n1 === n0, `hentet mens popupen var lukket (${n0} → ${n1})`);
  ok(!errs.length, 'sidefeil: ' + errs.join(' | '));
  await p.close();
}

// ---- 2: Entur feiler → sensorene (toppkort, stopp og «oppdatert» fra sensorene)
{
  const { p, errs } = await page(false);
  await p.evaluate(() => { location.hash = '#ruter'; });
  await p.waitForTimeout(1800);
  const r = await p.evaluate((ALL) => {
    const k = eval(ALL).find((e) => e.localName === 'msh-ruter-card' && e.getBoundingClientRect().height > 0);
    const sr = k.shadowRoot, txt = (e) => (e ? e.textContent.replace(/\s+/g, ' ').trim() : null);
    return { order: [...sr.querySelector('.wrap').children].map((e) => e.className.split(' ')[0]), hero: txt(sr.querySelector('.hero')), stops: [...sr.querySelectorAll('.stop')].map(txt), upd: txt(sr.querySelector('.upd')), alts: [...sr.querySelectorAll('.alt')].map(txt), fetches: window.__fetches.length };
  }, all);
  console.log(JSON.stringify(r, null, 1));
  ok(r.fetches > 0, 'forsøkte Entur');
  ok(r.order[0] === 'hero' && /\d+|Nå/.test(r.hero), 'toppkort fra sensorene ' + r.hero);
  ok(r.stops.length === 3 && /Bislett.*\d+ min/.test(r.stops[0]) && /Holbergs plass.*(Nå|min)/.test(r.stops[2]), 'stopp fra sensorene');
  ok(/Entur-sensorene/.test(r.upd || ''), 'oppdatert fra sensorene ' + r.upd);
  ok(!errs.length, 'sidefeil: ' + errs.join(' | '));
  await p.close();
}
// ---- 3: GUI-editoren (getConfigElement) og kortets egen «Rediger»: Visning-brytere + Reiser
{
  const { p, errs } = await page(false);
  const r = await p.evaluate(async () => {
    const wait = (ms) => new Promise((q) => setTimeout(q, ms));
    const Cls = customElements.get('msh-ruter-card'), ed = Cls.getConfigElement(), out = {};
    let last = null;
    ed.addEventListener('config-changed', (e) => { last = e.detail.config; });
    ed.hass = window.__hass; ed.setConfig({ type: 'custom:msh-ruter-card', ...Cls.getStubConfig(), card_id: 'r9' });
    document.body.appendChild(ed); await wait(200);
    const sr = ed.shadowRoot, txt = (e) => (e ? e.textContent.replace(/\s+/g, ' ').trim() : '');
    out.view = ['Toppkort', 'Tidslinje', '«Gå nå»', 'Reise', 'Perrong', 'Forsinkelse og rutetid', 'Neste etter', 'Belegg', 'Sist oppdatert', 'Toppkort-stopp'].filter((l) => !txt(sr).includes(l));
    out.alts = sr.querySelectorAll('.ruter-alt').length;
    sr.querySelector('.ruter-alt [data-op="toggle"]').click(); await wait(100);
    out.toggled = last && last.trips.school.alts[0].enabled;
    sr.querySelector('.ruter-alt [data-op="edit"]').click(); await wait(100);
    const w = sr.querySelector('input[data-trip="school.alts.0.walk_min"]');
    w.value = '5'; w.dispatchEvent(new Event('change', { bubbles: true })); await wait(100);
    out.walk = last && last.trips.school.alts[0].walk_min;
    const ln = sr.querySelector('input[data-trip="school.alts.0.legs.1.lines"]');
    ln.value = '11, 12'; ln.dispatchEvent(new Event('change', { bubbles: true })); await wait(100);
    out.lines = last && last.trips.school.alts[0].legs[1].lines;
    sr.querySelector('[data-op="addalt"][data-dir="home"]').click(); await wait(100);
    out.homeN = last && last.trips.home.alts.length;
    ed.remove();
    // kortets egen «Rediger» (tannhjulet i toppkortet) → samme skjema
    location.hash = '#ruter'; await wait(1200);
    const all = []; const wk = (x) => x.querySelectorAll('*').forEach((e) => { all.push(e); if (e.shadowRoot) wk(e.shadowRoot); }); wk(document);
    const k = all.find((e) => e.localName === 'msh-ruter-card' && e.getBoundingClientRect().height > 0);
    k.shadowRoot.querySelector('.hset').click(); await wait(500);
    const all2 = []; const w2 = (x) => x.querySelectorAll('*').forEach((e) => { all2.push(e); if (e.shadowRoot) w2(e.shadowRoot); }); w2(document);
    const inl = all2.find((e) => e.localName === 'msh-editor' && e !== ed);
    out.sheet = !!inl && txt(inl.shadowRoot).includes('Reiser') && inl.shadowRoot.querySelectorAll('.ruter-alt').length > 0;
    return out;
  });
  console.log(JSON.stringify(r));
  ok(!r.view.length, 'Visning mangler ' + r.view);
  ok(r.alts === 6 && r.toggled === false && r.walk === 5 && JSON.stringify(r.lines) === '["11","12"]' && r.homeN === 5, 'Reiser-editor ' + JSON.stringify(r));
  ok(r.sheet, 'kortets egen Rediger har Reiser');
  ok(!errs.length, 'sidefeil: ' + errs.join(' | '));
  await p.close();
}
await b.close();
if (fails.length) { console.log('FEIL:\n- ' + fails.join('\n- ')); process.exit(1); }
console.log('ruter19: alt OK');
