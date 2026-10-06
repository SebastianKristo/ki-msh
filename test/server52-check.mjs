// Fiks 52 A3 · Server-popupen bygger ikke alt ved åpning (Android-flimmer). Ekte Bubble Card, 390×844 touch, Android-UA og
// CPU-struping ×6 (CDP) som en middels Android-telefon. Måler fra location.hash = '#server' til kortet har satt seg:
//   tid, lange oppgaver (antall / sum / lengste) under animasjonen og til ro, tegninger (render()) første 1 s og under
//   Bubbles åpne-animasjon, callWS (frame-nummer), DOM-noder i kortet før/etter, fanebytte (tegninger per bytte, blanke rammer).
// Krav (egen bygg):
//   · bare aktiv fane i DOM-en ved åpning (én .pane/.hero, bare aktiv verts _b_* og _metrics kalt)
//   · ingen callWS/historikk de to første rammene – og ingen før Bubbles åpne-animasjon er ferdig
//   · ≤ 1 tegning under åpne-animasjonen
//   · oppdatering av entiteter i skjulte faner → 0 tegninger (aktiv fane → 1)
//   · fanebytte: én tegning, bygges først når den velges (lazy), ingen blank ramme
//   · data kommer etter at popupen har satt seg (verdi i toppkortet, ingen skjelett, 24 t historikk hentet)
//   · ingen <img> / bildelasting ved åpning (ikoner er <ha-icon>)
// Kjør: node test/server52-check.mjs          (S52_BUNDLE=<fil> måler en ferdig bundel uten krav, f.eks. før-koden)
//       S52_THROTTLE=<n> (standard 6)
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { readdirSync, mkdirSync, existsSync } from 'node:fs';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const R = resolve('.') + '/';
mkdirSync('test/.build', { recursive: true });
mkdirSync('test/.vendor', { recursive: true });
const BC = resolve('test/.vendor/bubble-card.js');
if (!existsSync(BC)) execFileSync('curl', ['-sSL', '-o', BC, 'https://raw.githubusercontent.com/Clooos/Bubble-Card/main/dist/bubble-card.js']);
const own = !process.env.S52_BUNDLE;
const bundle = own ? resolve(`test/.build/s52-${process.pid}.js`) : resolve(process.env.S52_BUNDLE);
if (own) execFileSync('node', ['build.mjs', bundle], { cwd: R, stdio: 'inherit' });
const THROTTLE = Number(process.env.S52_THROTTLE || 6);
const mocks = readdirSync(R + 'test/mock').filter((f) => f.endsWith('.js')).sort().map((f) => R + 'test/mock/' + f);
const FIX = resolve('test/fixtures/server50-mock.js');
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 13; Pixel 6a) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';
const browser = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const res = [];
let fails = 0;
const ok = (name, cond, info) => { if (!cond) fails++; res.push(`${cond ? '✔' : '✘'} ${name}${info != null ? ' · ' + JSON.stringify(info) : ''}`); };

const INIT = () => {
  const P = (window.__s52 = { lt: [], ws: [], renders: [], bodies: [], metrics: [], frame: -1, frames: [] });
  try { new PerformanceObserver((l) => l.getEntries().forEach((e) => P.lt.push([e.startTime, e.duration]))).observe({ type: 'longtask', buffered: true }); } catch (e) { /* */ }
};

const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, userAgent: ANDROID_UA });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/fonts.googleapis|net::ERR|Failed to load resource|bubble-modules|CORS/.test(m.text())) errs.push(m.text()); });
await page.addInitScript(INIT);
await page.goto('file://' + R + 'test/harness-bubble.html');
for (const m of mocks) await page.addScriptTag({ path: m });
await page.addScriptTag({ path: FIX });
await page.addScriptTag({ path: bundle });
await page.addScriptTag({ path: BC, type: 'module' });
await page.waitForFunction(() => customElements.get('bubble-card') && customElements.get('msh-server-card'), null, { timeout: 30000 });
const cdp = await ctx.newCDPSession(page);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });

// Oppsett: Bubble-popup (mal A) med ETT msh-server-card; instrumentering av tegning, kropper (_b_*), _metrics og callWS
await page.evaluate(async () => {
  const P = window.__s52, wait = (ms) => new Promise((q) => setTimeout(q, ms));
  window.wait = wait;
  window.deepAll = (sel, root) => { const out = []; const walk = (r) => r.querySelectorAll('*').forEach((e) => { if (!sel || e.matches(sel)) out.push(e); if (e.shadowRoot) walk(e.shadowRoot); }); walk(root || document); return out; };
  const proto = customElements.get('msh-server-card').prototype;
  const r0 = proto.render;
  proto.render = function () { const t = performance.now(); const o = r0.call(this); P.renders.push({ t, ms: performance.now() - t, host: this.tab, skel: !!this._skel, frame: P.frame }); return o; };
  Object.getOwnPropertyNames(proto).filter((k) => /^_b_/.test(k)).forEach((k) => { const f = proto[k]; proto[k] = function (...a) { P.bodies.push({ t: performance.now(), k }); return f.apply(this, a); }; });
  const m0 = proto._metrics;
  proto._metrics = function (Rr, HA, host) { P.metrics.push(host); return m0.call(this, Rr, HA, host); };
  const H = window.mockHass();
  H.themes = { ...(H.themes || {}), darkMode: true };
  const ws = H.callWS;
  H.callWS = (m) => { P.ws.push({ t: performance.now(), type: m.type + (m.type === 'supervisor/api' ? ' ' + m.endpoint : ''), frame: P.frame }); return ws(m); };
  window.H = H;
  if (window.MSH.store && window.MSH.store.load) await window.MSH.store.load(H);
  const bc = document.createElement('bubble-card');
  bc.setConfig({ type: 'custom:bubble-card', card_type: 'pop-up', hash: '#server', name: 'Server', icon: 'mdi:server', margin_top_mobile: '50px', margin_top_desktop: '50px', card_layout: 'large', is_sidebar_hidden: true, bg_opacity: '98', bg_blur: '5', cards: [{ type: 'custom:msh-server-card', card_id: 'pop-server-52' }] });
  bc.hass = H; document.getElementById('dash').appendChild(bc);
  window.__bc = bc;
  await wait(800);
  window.card = () => deepAll('msh-server-card')[0] || null;
  window.setHass = (h) => { window.H = h; window.__bc.hass = h; const c = card(); if (c) c.hass = h; };
  window.patchStates = (ids) => { const S = { ...window.H.states }; ids.forEach((id) => { const o = S[id]; const v = o && /^-?\d/.test(o.state) ? String(Math.round((Number(o.state) || 0) * 1.03 + 1)) : o && o.state === 'on' ? 'off' : 'on'; S[id] = { ...(o || { entity_id: id, attributes: {} }), state: v, last_updated: new Date().toISOString(), last_changed: new Date().toISOString() }; }); setHass({ ...window.H, states: S }); };
});

/* ================================================================ åpning */
const open = await page.evaluate(async () => {
  const P = window.__s52, wait = window.wait;
  const nodes = (r) => (r ? deepAll(null, r).length : 0);
  const c0 = card();
  const before = { card: c0 && c0.shadowRoot ? nodes(c0.shadowRoot) : 0, doc: deepAll().length };
  const imgs0 = performance.getEntriesByType('resource').filter((e) => e.initiatorType === 'img' || /\.(png|jpe?g|svg|webp|gif)(\?|$)/.test(e.name)).length;
  P.lt.length = 0; P.ws.length = 0; P.renders.length = 0; P.bodies.length = 0; P.metrics.length = 0;
  let animEnd = null, lastMut = 0, popEl = null, blank = 0;
  const t0 = performance.now();
  P.frame = 0;
  let running = true;
  const tick = () => {
    if (!running) return;
    P.frame++;
    P.frames.push(performance.now() - t0);
    if (!popEl) popEl = deepAll('.bubble-pop-up').find((p) => p.classList.contains('is-popup-opened')) || null;
    if (popEl && animEnd == null && P.frame > 2 && !popEl.classList.contains('is-opening')) {
      const A = popEl.getAnimations({ subtree: true }).filter((a) => a.effect && a.effect.target === popEl && a.playState === 'running');
      if (!A.length) animEnd = performance.now() - t0;
    }
    requestAnimationFrame(tick);
  };
  let mo = null;
  const watch = () => { const c = card(); if (!c || !c.shadowRoot || mo) return; mo = new MutationObserver(() => { lastMut = performance.now() - t0; }); mo.observe(c.shadowRoot, { subtree: true, childList: true, characterData: true, attributes: true }); };
  watch();
  requestAnimationFrame(tick);
  location.hash = '#server';
  for (let i = 0; i < 40 && !mo; i++) { await wait(25); watch(); }
  await wait(4500);
  running = false;
  if (mo) mo.disconnect();
  const c = card(), sr = c && c.shadowRoot;
  const settle = lastMut;
  const lt = P.lt.map(([s, d]) => [s - t0, d]).filter(([s]) => s >= -5);
  const inAnim = lt.filter(([s]) => animEnd != null && s < animEnd);
  const toSettle = lt.filter(([s]) => s <= settle + 50);
  const R = P.renders.map((r) => ({ ...r, t: r.t - t0 }));
  return {
    animEnd: animEnd == null ? null : Math.round(animEnd), settle: Math.round(settle),
    ltAnim: { n: inAnim.length, sum: Math.round(inAnim.reduce((a, [, d]) => a + d, 0)), max: Math.round(Math.max(0, ...inAnim.map(([, d]) => d))) },
    ltSettle: { n: toSettle.length, sum: Math.round(toSettle.reduce((a, [, d]) => a + d, 0)), max: Math.round(Math.max(0, ...toSettle.map(([, d]) => d))), tbt: Math.round(toSettle.reduce((a, [, d]) => a + Math.max(0, d - 50), 0)) },
    renders1s: R.filter((r) => r.t < 1000).length, rendersAnim: R.filter((r) => animEnd != null && r.t < animEnd).length, renders: R.map((r) => `${Math.round(r.t)}ms${r.skel ? ' skjelett' : ''} ${r.host} (${Math.round(r.ms)} ms)`),
    ws: P.ws.map((w) => ({ t: Math.round(w.t - t0), f: w.frame, type: w.type })),
    bodies: [...new Set(P.bodies.map((b) => b.k))], metrics: [...new Set(P.metrics)],
    nodes: { before, after: { card: sr ? nodes(sr) : 0, doc: deepAll().length } },
    panes: sr ? [...sr.querySelectorAll('.pane')].map((p) => p.dataset.key) : [], heroes: sr ? [...sr.querySelectorAll('.hero')].map((p) => p.dataset.key) : [],
    big: sr && sr.querySelector('.hero .big') ? sr.querySelector('.hero .big').textContent.trim() : null, skel: sr ? sr.querySelectorAll('.skp, .prose.sk').length : -1,
    imgs: sr ? deepAll('img', sr).length : -1, imgLoads: performance.getEntriesByType('resource').filter((e) => e.initiatorType === 'img' || /\.(png|jpe?g|svg|webp|gif)(\?|$)/.test(e.name)).length - imgs0,
    tab: c && c.tab, frames: P.frames.length, blank,
  };
});

/* ================================================================ skjulte faner: hass-oppdateringer */
const hidden = await page.evaluate(async () => {
  const P = window.__s52, wait = window.wait, c = card();
  const Rr = c._R || {}, ents = Rr.ents || {};
  const pick = (L, n) => (L || []).filter((id) => window.H.states[id] && /^sensor\./.test(id)).slice(0, n);
  const hiddenIds = [...pick(ents.proxmox, 4), ...pick(ents.unraid, 4)];
  const hasQ = window.MSH.server && window.MSH.server.oppdagQB ? Object.values(window.MSH.server.oppdagQB(window.H, c.config).ids).filter(Boolean).slice(0, 3) : [];
  hiddenIds.push(...hasQ.filter((id) => /^sensor\./.test(id)));
  P.renders.length = 0;
  for (let i = 0; i < 10; i++) { window.patchStates(hiddenIds); await wait(60); }
  await wait(400);
  const hiddenRenders = P.renders.length;
  // aktiv fane (Nettverk): en av UniFi-sensorene
  const act = [...(c._deps || [])].filter((id) => /^sensor\./.test(id) && (ents.unifi || []).includes(id)).slice(0, 1);
  P.renders.length = 0;
  window.patchStates(act);
  await wait(500);
  return { tab: c.tab, hiddenIds, hiddenRenders, act, activeRenders: P.renders.length };
});

/* ================================================================ fanebytte */
const sw = await page.evaluate(async () => {
  const P = window.__s52, wait = window.wait, c = card(), sr = c.shadowRoot;
  const order = [...sr.querySelectorAll('.trow .tb')].map((b) => b.dataset.v);
  const out = [];
  const seq = [...order.slice(1), order[0]];
  for (const v of seq) {
    const builtBefore = P.bodies.some((b) => b.k.startsWith('_b_' + v + '_'));
    P.renders.length = 0; P.lt.length = 0; const b0 = P.bodies.length;
    let blank = 0, frames = 0, run = true, minH = 1e9;
    const chk = () => {
      if (!run) return;
      frames++;
      const card_ = sr.querySelector('ha-card'), pane = sr.querySelector('.pane') || sr.querySelector('.card.nf'), hero = sr.querySelector('.hero');
      const h = card_ ? card_.getBoundingClientRect().height : 0; minH = Math.min(minH, h);
      if (!pane || !hero || !pane.firstElementChild || pane.getBoundingClientRect().height < 20 || h < 300) blank++;
      requestAnimationFrame(chk);
    };
    requestAnimationFrame(chk);
    const t0 = performance.now();
    const btn = sr.querySelector(`.trow .tb[data-v="${v}"]`);
    btn.click();
    await wait(1400);
    run = false;
    const lt = P.lt.map(([s, d]) => [s - t0, d]).filter(([s]) => s >= -5);
    out.push({ v, active: c.tab, renders: P.renders.length, renderHosts: P.renders.map((r) => r.host), builtBefore, built: P.bodies.slice(b0).map((b) => b.k), blank, frames, minH: Math.round(minH),
      lt: { n: lt.length, max: Math.round(Math.max(0, ...lt.map(([, d]) => d))) }, panes: sr.querySelectorAll('.pane').length });
  }
  return out;
});
/* ================================================================ lukk + åpne igjen: forrige tegning står under animasjonen */
const reopen = await page.evaluate(async () => {
  const P = window.__s52, wait = window.wait;
  history.replaceState(null, '', location.pathname + location.search); window.dispatchEvent(new Event('hashchange')); window.dispatchEvent(new Event('location-changed'));
  await wait(1200);
  const prev = card(); window.__prevCard = prev;
  const closedInfo = { connected: prev && prev.isConnected, nodes: prev && prev.shadowRoot ? prev.shadowRoot.querySelectorAll('*').length : 0 };
  P.renders.length = 0; P.ws.length = 0;
  const t0 = performance.now();
  let animEnd = null, popEl = null, run = true, skelSeen = 0, frames = 0;
  const tick = () => {
    if (!run) return;
    frames++;
    const c = card(), sr = c && c.shadowRoot;
    if (sr && c.isConnected && sr.querySelector('.skp')) skelSeen++;
    if (!popEl) popEl = deepAll('.bubble-pop-up').find((p) => p.classList.contains('is-popup-opened')) || null;
    if (popEl && animEnd == null && frames > 2 && !popEl.classList.contains('is-opening') && !popEl.getAnimations({ subtree: true }).some((a) => a.effect && a.effect.target === popEl && a.playState === 'running')) animEnd = performance.now() - t0;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  location.hash = '#server';
  await wait(3000);
  run = false;
  const R = P.renders.map((r) => ({ ...r, t: r.t - t0 }));
  return { closedInfo, same: card() === window.__prevCard, animEnd: animEnd == null ? null : Math.round(animEnd), rendersAnim: R.filter((r) => animEnd != null && r.t < animEnd).length, renders: R.map((r) => `${Math.round(r.t)}ms${r.skel ? ' skjelett' : ''} ${r.host}`), skelSeen, firstWs: P.ws.length ? Math.round(P.ws[0].t - t0) : null };
});
console.log(`  gjenåpning: samme kort ${reopen.same} (lukket: ${JSON.stringify(reopen.closedInfo)}) · animasjon ${reopen.animEnd} ms · tegninger ${reopen.renders.join(' · ') || '–'} · skjelett-rammer ${reopen.skelSeen} · første callWS ${reopen.firstWs} ms`);

/* ================================================================ velger: kort – bare sammendrag for de andre vertene */
const cards = await page.evaluate(async () => {
  const P = window.__s52, wait = window.wait, c = card();
  c.setConfig({ ...(c._rawConfig || c.config), velger: 'kort' });
  await wait(600);
  P.bodies.length = 0; P.renders.length = 0;
  c.update(); await wait(400);
  const sr = c.shadowRoot, bodies = [...new Set(P.bodies.map((b) => b.k))];
  // Proxmox-disk er ikke i sammendraget (CPU + status) → ingen tegning
  P.renders.length = 0;
  const ents = (c._R && c._R.ents) || {};
  const nonSum = (ents.proxmox || []).filter((id) => /disk_usage$|temperature$/.test(id));
  for (let i = 0; i < 5; i++) { window.patchStates(nonSum); await wait(60); }
  await wait(400);
  const nonSumRenders = P.renders.length;
  return { hcards: sr.querySelectorAll('.hcards [data-v]').length, panes: sr.querySelectorAll('.pane').length, bodies, tab: c.tab, nonSum, nonSumRenders };
});
await ctx.close();
await browser.close();

/* ================================================================ rapport */
console.log(`\nServer #server · ${own ? 'denne koden' : bundle.replace(R, '')} · Android-UA · CPU ×${THROTTLE}`);
console.log(`  åpne-animasjon ferdig: ${open.animEnd} ms · rolig (siste DOM-endring): ${open.settle} ms`);
console.log(`  lange oppgaver under animasjonen: ${open.ltAnim.n} (sum ${open.ltAnim.sum} ms, lengste ${open.ltAnim.max} ms)`);
console.log(`  lange oppgaver til rolig: ${open.ltSettle.n} (sum ${open.ltSettle.sum} ms, lengste ${open.ltSettle.max} ms, TBT ${open.ltSettle.tbt} ms)`);
console.log(`  tegninger første 1 s: ${open.renders1s} · under animasjonen: ${open.rendersAnim}`);
console.log(`  tegninger: ${open.renders.join(' · ')}`);
console.log(`  callWS: ${open.ws.map((w) => `${w.t}ms/f${w.f} ${w.type}`).join(' · ')}`);
console.log(`  DOM-noder i kortet før/etter: ${open.nodes.before.card} → ${open.nodes.after.card} · hele dokumentet ${open.nodes.before.doc} → ${open.nodes.after.doc}`);
console.log(`  kropper bygget ved åpning: ${open.bodies.join(', ')} · _metrics for: ${open.metrics.join(', ')}`);
console.log(`  skjulte faner: ${hidden.hiddenIds.length} entiteter × 10 oppdateringer → ${hidden.hiddenRenders} tegninger · aktiv fane → ${hidden.activeRenders}`);
sw.forEach((s) => console.log(`  bytte → ${s.v}: ${s.renders} tegning(er) [${s.renderHosts.join(',')}] · bygget ${s.built.join(',') || '–'} · blanke rammer ${s.blank}/${s.frames} · lange oppgaver ${s.lt.n} (lengste ${s.lt.max} ms)`));

if (own) {
  ok('bare aktiv fane i DOM-en ved åpning (én .pane/.hero for aktiv vert)', open.panes.length === 1 && open.heroes.length === 1 && open.panes[0].startsWith('pane-' + open.tab + '-') && open.heroes[0] === 'hero-' + open.tab, { panes: open.panes, heroes: open.heroes, tab: open.tab });
  ok('bare aktiv verts innhold bygget (_b_*) og _metrics bare for aktiv vert', open.bodies.every((k) => k.startsWith('_b_' + open.tab + '_')) && open.bodies.length >= 1 && open.metrics.every((h) => h === open.tab), { bodies: open.bodies, metrics: open.metrics });
  ok('ingen callWS/historikk de to første rammene', open.ws.every((w) => w.f >= 2), open.ws.filter((w) => w.f < 2));
  ok('ingen callWS før Bubbles åpne-animasjon er ferdig', open.animEnd != null && open.ws.every((w) => w.t >= open.animEnd - 20), { animEnd: open.animEnd, ws: open.ws.slice(0, 3) });
  ok('≤ 1 tegning under åpne-animasjonen', open.rendersAnim <= 1, open.renders);
  ok('oppdateringer i skjulte faner → 0 tegninger', hidden.hiddenIds.length >= 4 && hidden.hiddenRenders === 0, hidden);
  ok('oppdatering i aktiv fane → 1 tegning', hidden.act.length === 1 && hidden.activeRenders === 1, hidden);
  ok('fanebytte: én tegning per bytte, aktiv vert', sw.length >= 3 && sw.every((s) => s.renders === 1 && s.active === s.v), sw.map((s) => [s.v, s.renders, s.active]));
  ok('fanebytte: bygges først når den velges (lazy)', sw.filter((s) => s.v !== 'net').every((s) => !s.builtBefore && s.built.length >= 1 && s.built.every((k) => k.startsWith('_b_' + s.v + '_'))), sw.map((s) => [s.v, s.builtBefore, s.built]));
  ok('fanebytte: ingen blank ramme (fane-innhold og toppkort finnes i hver ramme)', sw.every((s) => s.blank === 0), sw.map((s) => [s.v, s.blank, s.minH]));
  ok('data etter at popupen har satt seg: verdi i toppkortet, intet skjelett igjen', open.big && open.big !== '–' && open.skel === 0, { big: open.big, skel: open.skel });
  ok('24 t historikk og config entries hentes etter åpningen', open.ws.some((w) => /history_during_period/.test(w.type)) && open.ws.some((w) => /config_entries\/get/.test(w.type)), open.ws.map((w) => w.type));
  ok('ingen <img> og ingen bildelasting ved åpning (ikoner er <ha-icon>)', open.imgs === 0 && open.imgLoads === 0, { imgs: open.imgs, loads: open.imgLoads });
  ok('gjenåpning: ingen tegning under åpne-animasjonen (forrige innhold står, aldri skjelett)', reopen.animEnd != null && reopen.rendersAnim === 0 && reopen.skelSeen === 0, reopen);
  ok('gjenåpning: oppslag først etter animasjonen', reopen.firstWs == null || reopen.firstWs >= reopen.animEnd - 20, reopen);
  ok('velger: kort – kortrad for alle verter, men bare aktiv verts innhold bygget', cards.hcards >= 4 && cards.panes === 1 && cards.bodies.length >= 1 && cards.bodies.every((k) => k.startsWith('_b_' + cards.tab + '_')), cards);
  ok('velger: kort – endring utenfor sammendragene i skjulte verter → 0 tegninger', cards.nonSum.length >= 1 && cards.nonSumRenders === 0, cards);
  ok('ingen sidefeil', errs.length === 0, errs.slice(0, 5));
  console.log('\n' + res.join('\n'));
  console.log(fails ? `\n${fails} FEIL` : '\nserver52: alt OK');
  process.exit(fails ? 1 : 0);
}
