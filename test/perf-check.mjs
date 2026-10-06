// Ytelsesmåling (Android-ytelse): hele det strategi-genererte dashbordet mot ekte Bubble Card på mobil (390×844, touch),
// med CPU-struping ×6 (CDP) som en middels Android-telefon. Måler:
//  · bundelstørrelse (rå/gzip), parse+kompilering+kjøring av bundelen, tid til Hjem er tegnet, første maling av det synlige
//    av Hjem (header+prosa+faner) og antall tegninger per kort under oppstarten (krav: Hjem/navbar 1, ingen kort > 2)
//  · lange oppgaver / total blocking time under lasting
//  · hass-byrst (50 endringer i urelaterte entiteter + 20 i ekte strømsensorer, 10 Hz): _render-kall per kort
//  · åpne/lukke popups (#stue, #lys, #strom, #kalender, #server): tid til innhold + blokkering
//  · tomgang på Hjem (10 s uten input): aktive intervaller, rAF-løkker, observere, løpende CSS-animasjoner, maling
//  · ytelsesmodus (Android-UA): data-ki-perf="lite" og ingen backdrop-filter / uendelige animasjoner
// Kjør: node test/perf-check.mjs            (bygger src/ med build.mjs, skriver tabell + JSON, kjører krav)
//       PERF_BUNDLE=<fil> node test/perf-check.mjs   (mål en ferdig bundel, f.eks. før-versjonen; ingen krav)
//       PERF_OUT=<fil.json>  lagre resultatet;  PERF_THROTTLE=<n> (standard 6);  PERF_NOASSERT=1 hopper over kravene
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, statSync, unlinkSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const R = resolve('.') + '/';
mkdirSync('test/.build', { recursive: true });
mkdirSync('test/.vendor', { recursive: true });
const BC = resolve('test/.vendor/bubble-card.js');
if (!existsSync(BC)) execFileSync('curl', ['-sSL', '-o', BC, 'https://raw.githubusercontent.com/Clooos/Bubble-Card/main/dist/bubble-card.js']);
const own = !process.env.PERF_BUNDLE;
const bundle = own ? resolve(`test/.build/perfchk-${process.pid}.js`) : resolve(process.env.PERF_BUNDLE);
if (own) execFileSync('node', ['build.mjs', bundle], { cwd: R, stdio: 'inherit' });
const THROTTLE = Number(process.env.PERF_THROTTLE || 6);
const src = readFileSync(bundle);
// Tidsstempel-innpakning: __pfA settes rett før <script> legges inn, __pfB er siste setning i bundelen
const timed = resolve(`test/.build/perfchk-t-${process.pid}.js`);
writeFileSync(timed, src.toString() + '\n;window.__pfB = performance.now();\n');
const mocks = readdirSync(R + 'test/mock').filter((f) => f.endsWith('.js')).sort().map((f) => R + 'test/mock/' + f);
const browser = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => pw.chromium.launch());
const POPS = ['#stue', '#lys', '#strom', '#kalender', '#server'];
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 13; Pixel 6a) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';

// Instrumentering før alt annet: timere, rAF, observere, lange oppgaver
const INIT = () => {
  const P = (window.__pf = { iv: new Map(), ivSeq: 0, raf: 0, rafIds: new Set(), obs: { mo: 0, ro: 0, io: 0 }, live: { mo: new Set(), ro: new Set(), io: new Set() }, lt: [], to: 0 });
  const si = window.setInterval, ci = window.clearInterval, st = window.setTimeout, raf = window.requestAnimationFrame;
  window.setInterval = function (fn, ms, ...a) { const id = si.call(window, fn, ms, ...a); P.iv.set(id, { ms, stack: (new Error().stack || '').split('\n').slice(2, 4).join(' | ') }); return id; };
  window.clearInterval = function (id) { P.iv.delete(id); return ci.call(window, id); };
  window.setTimeout = function (fn, ms, ...a) { P.to++; return st.call(window, fn, ms, ...a); };
  window.requestAnimationFrame = function (fn) { P.raf++; return raf.call(window, fn); };
  for (const [k, C] of [['mo', 'MutationObserver'], ['ro', 'ResizeObserver'], ['io', 'IntersectionObserver']]) {
    const O = window[C]; if (!O) continue;
    window[C] = class extends O {
      constructor(...a) { super(...a); P.obs[k]++; }
      observe(...a) { P.live[k].add(this); return super.observe(...a); }
      disconnect() { P.live[k].delete(this); return super.disconnect(); }
    };
  }
  try { new PerformanceObserver((l) => l.getEntries().forEach((e) => P.lt.push([e.startTime, e.duration]))).observe({ type: 'longtask', buffered: true }); } catch (e) { /* */ }
};

async function run({ android, lite } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, ...(android ? { userAgent: ANDROID_UA } : {}) });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.addInitScript(INIT);
  if (lite) await page.addInitScript((v) => { try { localStorage.setItem('ki-perf', v); } catch (e) { /* */ } }, lite);
  await page.goto('file://' + R + 'test/harness-bubble.html');
  for (const m of mocks) await page.addScriptTag({ path: m });
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Performance.enable');
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
  const metrics = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
  const out = { errs };
  // --- bundel: parse + kompilering + kjøring
  const m0 = await metrics();
  await page.evaluate(() => { window.__pfA = performance.now(); });
  await page.addScriptTag({ url: 'file://' + timed });
  const m1 = await metrics();
  out.evalMs = await page.evaluate(() => window.__pfB - window.__pfA);
  out.loadScriptMs = (m1.ScriptDuration - m0.ScriptDuration) * 1000;
  await page.addScriptTag({ path: BC, type: 'module' });
  await page.waitForFunction(() => customElements.get('bubble-card'), null, { timeout: 30000 });
  // --- dashbordet (som strategy-check) + _render-telling per kort
  out.first = await page.evaluate(async () => {
    const M = window.MSH, P = window.__pf;
    P.renders = {}; P.renderMs = {}; P.closedRenders = {};
    const orig = M.Card.prototype._render;
    M.Card.prototype._render = function () {
      if (!this._config || !this._hass) return orig.call(this);
      const t = performance.now(); const r = orig.call(this); const d = performance.now() - t;
      const k = this.localName; P.renders[k] = (P.renders[k] || 0) + 1; P.renderMs[k] = (P.renderMs[k] || 0) + d;
      if (!this.isConnected || !M.isPopupOpen(this)) P.closedRenders[k] = (P.closedRenders[k] || 0) + 1;
      return r;
    };
    const hass = window.mockHass();
    // 50 urelaterte entiteter (finnes fra start, så antallet states er stabilt under byrsten)
    for (let i = 0; i < 50; i++) hass.states['sensor.perf_dummy_' + i] = { entity_id: 'sensor.perf_dummy_' + i, state: '0', attributes: {}, last_changed: '', last_updated: '' };
    window.__H = hass;
    const S = customElements.get('ll-strategy-dashboard-ki-dashboard');
    const dash = await S.generate({}, hass);
    const stack = dash.views[0].cards[0];
    window.__pops = stack.cards.filter((c) => c.card_type === 'pop-up').map((c) => c.hash);
    const root = document.getElementById('dash');
    const t0 = performance.now();
    for (const c of stack.cards) { const el = document.createElement(c.type.replace('custom:', '')); el.setConfig(c); el.hass = hass; root.appendChild(el); }
    const hjem = root.querySelector('msh-hjem-card');
    // Første maling med innhold i det synlige av Hjem (header, prosa og faner har tegnet): sjekkes i hver rAF; når det er
    // sant, er innholdet malt ved slutten av denne rammen → tiden tas i neste rAF.
    const vis = () => ['msh-hjem-header-card', 'msh-prosa-card', 'msh-hjem-faner-card'].every((t) => { const e = hjem.shadowRoot && hjem.shadowRoot.querySelector(t); return e && e.shadowRoot && e.shadowRoot.querySelector('ha-card') && e.getBoundingClientRect().height > 20; });
    const paintP = new Promise((res) => { const tick = () => { if (vis()) requestAnimationFrame(() => res(performance.now() - t0)); else requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
    await new Promise((res) => { const tick = () => { if (hjem.shadowRoot && hjem.shadowRoot.querySelector('ha-card') && hjem.getBoundingClientRect().height > 100) res(); else requestAnimationFrame(tick); }; tick(); });
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const hjemMs = performance.now() - t0;
    const paintMs = await Promise.race([paintP, new Promise((r) => setTimeout(() => r(null), 20000))]);
    return { hjemMs, paintMs, pops: window.__pops.length };
  });
  await page.waitForTimeout(3000);
  out.load = await page.evaluate(() => { const lt = window.__pf.lt; return { longTasks: lt.length, tbt: lt.reduce((a, [, d]) => a + Math.max(0, d - 50), 0), longest: Math.max(0, ...lt.map(([, d]) => d)) }; });
  out.rendersLoad = await page.evaluate(() => Object.fromEntries(Object.entries(window.__pf.renders).map(([k, n]) => [k, `${n}× ${Math.round(window.__pf.renderMs[k])} ms`])));
  out.rendersStart = await page.evaluate(() => ({ ...window.__pf.renders })); // antall _render per kort de første 3 s
  // Hvor mange msh-kort finnes i DOM-en når alle popups er lukket?
  out.connected = await page.evaluate(() => {
    const o = { total: 0, connected: 0 };
    const walk = (r) => r.querySelectorAll('*').forEach((e) => { if (/^msh-.*-card$/.test(e.localName)) { o.total++; if (e.isConnected) o.connected++; } if (e.shadowRoot) walk(e.shadowRoot); });
    walk(document); return o;
  });
  // --- hass-byrst
  const burst = async (ids, n, label) => page.evaluate(async ([ids, n]) => {
    const P = window.__pf; P.renders = {}; P.renderMs = {}; P.closedRenders = {}; P.lt.length = 0;
    const els = [...document.getElementById('dash').children];
    const t0 = performance.now();
    for (let i = 0; i < n; i++) {
      const id = ids[i % ids.length], old = window.__H.states[id];
      const v = old && /^-?\d/.test(old.state) ? String(Math.round((Number(old.state) || 0) * 1.01 + 1)) : String(i);
      const h = { ...window.__H, states: { ...window.__H.states, [id]: { ...(old || { entity_id: id, attributes: {} }), state: v, last_updated: new Date().toISOString() } } };
      window.__H = h; els.forEach((e) => { e.hass = h; });
      await new Promise((r) => setTimeout(r, 100));
    }
    await new Promise((r) => setTimeout(r, 300));
    const lt = P.lt;
    const ms = Object.values(P.renderMs).reduce((a, b) => a + b, 0);
    return { ms: performance.now() - t0, renders: { ...P.renders }, closed: { ...P.closedRenders }, renderMs: Math.round(ms), tbt: lt.reduce((a, [, d]) => a + Math.max(0, d - 50), 0) };
  }, [ids, n]);
  out.burstUnrelated = await burst(Array.from({ length: 50 }, (_, i) => 'sensor.perf_dummy_' + i), 50);
  const powerIds = await page.evaluate(() => Object.keys(window.__H.states).filter((id) => /^sensor\..*(power|effekt)/.test(id) && /^\d/.test(window.__H.states[id].state)).slice(0, 5));
  out.burstPower = await burst(powerIds.length ? powerIds : ['sensor.perf_dummy_0'], 20);
  out.powerIds = powerIds;
  // --- tomgang på Hjem
  const idle = async () => {
    await page.evaluate(() => { const P = window.__pf; P.raf = 0; P.to = 0; P.renders = {}; });
    const a = await metrics();
    await cdp.send('Tracing.start', { categories: 'devtools.timeline,disabled-by-default-devtools.timeline', transferMode: 'ReturnAsStream' }).catch(() => null);
    await page.waitForTimeout(10000);
    const evs = await new Promise((res) => {
      cdp.once('Tracing.tracingComplete', async (e) => {
        try { let data = ''; for (;;) { const r = await cdp.send('IO.read', { handle: e.stream }); data += r.data; if (r.eof) break; } await cdp.send('IO.close', { handle: e.stream }); res(JSON.parse(data).traceEvents || []); } catch (x) { res([]); }
      });
      cdp.send('Tracing.end').catch(() => res([]));
    });
    const b = await metrics();
        const st = await page.evaluate(() => {
      const P = window.__pf;
      const anims = []; let infinite = 0;
      const roots = [document]; const walk = (r) => r.querySelectorAll('*').forEach((e) => { if (e.shadowRoot) { roots.push(e.shadowRoot); walk(e.shadowRoot); } }); walk(document);
      for (const r of roots) for (const an of (r.getAnimations ? r.getAnimations() : [])) {
        if (an.playState !== 'running') continue;
        const t = an.effect && an.effect.getTiming ? an.effect.getTiming() : {};
        if (t.iterations === Infinity) { infinite++; const tg = an.effect.target; anims.push((an.animationName || an.id || 'anim') + '@' + (tg ? (tg.getRootNode().host ? tg.getRootNode().host.localName + ' ' : '') + tg.localName + '.' + String(tg.className && tg.className.baseVal != null ? tg.className.baseVal : tg.className).split(' ')[0] : '?')); }
      }
      let bdf = 0; const bdl = [];
      for (const r of roots) r.querySelectorAll('*').forEach((e) => { for (const ps of [null, '::before', '::after']) { const cs = getComputedStyle(e, ps); if ((cs.backdropFilter && cs.backdropFilter !== 'none') || (cs.webkitBackdropFilter && cs.webkitBackdropFilter !== 'none')) { bdf++; bdl.push((e.getRootNode().host ? e.getRootNode().host.localName + ' ' : '') + e.localName + '.' + String(e.className && e.className.baseVal != null ? e.className.baseVal : e.className).split(' ')[0] + (ps || '') + ' ' + cs.backdropFilter); } } });
      return { intervals: [...P.iv.values()].map((x) => x.ms + 'ms ' + x.stack.replace(/\s+/g, ' ').replace(/file:\/\/\S*\//g, '').slice(0, 140)), rafPerS: P.raf / 10, timeoutsPerS: P.to / 10, observers: { mo: P.live.mo.size, ro: P.live.ro.size, io: P.live.io.size }, infinite, anims: [...new Set(anims)].slice(0, 30), backdrop: bdf, backdropList: bdl.slice(0, 10), renders: { ...P.renders }, perf: document.documentElement.getAttribute('data-ki-perf') };
    });
    const tasks = evs.filter((e) => e.name === 'RunTask' && e.ph === 'X');
    return { ...st, cpuMs: Math.round((b.TaskDuration - a.TaskDuration) * 1000), scriptMs: Math.round((b.ScriptDuration - a.ScriptDuration) * 1000), styleRecalcs: b.RecalcStyleCount - a.RecalcStyleCount, layouts: b.LayoutCount - a.LayoutCount, tasks: tasks.length, taskMs: Math.round(tasks.reduce((x, e) => x + (e.dur || 0), 0) / 1000) };
  };
  out.idleHjem = await idle();
  // --- popups
  out.popups = {};
  for (const h of POPS) {
    const r = await page.evaluate(async (h) => {
      const P = window.__pf; P.lt.length = 0; P.renders = {};
      const all = () => { const o = []; const w = (x) => x.querySelectorAll('*').forEach((e) => { o.push(e); if (e.shadowRoot) w(e.shadowRoot); }); w(document); return o; };
      if (!window.__pops.includes(h)) return { missing: true };
      const t0 = performance.now();
      location.hash = h;
      let content = null;
      for (let i = 0; i < 300 && !content; i++) {
        await new Promise((r) => requestAnimationFrame(r));
        const pe = all().find((e) => e.classList && e.classList.contains('bubble-pop-up') && e.classList.contains('is-popup-opened'));
        const c = pe && [...pe.querySelectorAll('*')].find((e) => /^msh-.*-card$/.test(e.localName) && e.shadowRoot && e.shadowRoot.querySelector('ha-card') && e.getBoundingClientRect().height > 40);
        if (c) content = performance.now() - t0;
      }
      await new Promise((r) => setTimeout(r, 1500));
      const raf0 = P.raf; await new Promise((r) => setTimeout(r, 1000)); const openRaf = P.raf - raf0;
      // backdrop-filter mens popupen er åpen (Bubble bg_blur på .bubble-pop-up / ::before + egne flater)
      let bdf = 0;
      for (const e of all()) for (const ps of [null, '::before']) { const cs = getComputedStyle(e, ps); const v = cs.backdropFilter || cs.webkitBackdropFilter; if (v && v !== 'none' && e.getClientRects().length) bdf++; }
      const openTbt = P.lt.reduce((a, [, d]) => a + Math.max(0, d - 50), 0);
      const openRenders = { ...P.renders };
      P.lt.length = 0;
      const t1 = performance.now();
      history.replaceState(null, '', location.pathname); window.dispatchEvent(new Event('hashchange'));
      await new Promise((r) => setTimeout(r, 1200));
      return { contentMs: content == null ? null : Math.round(content), openRaf, bdf, openTbt: Math.round(openTbt), closeTbt: Math.round(P.lt.reduce((a, [, d]) => a + Math.max(0, d - 50), 0)), renders: openRenders };
    }, h);
    out.popups[h] = r;
  }
  // tomgang etter at popups har vært åpnet (lukkede popups skal ikke fortsette å jobbe)
  await page.waitForTimeout(2000);
  out.idleAfter = await idle();
  await ctx.close();
  return out;
}

// Ytelsesmodus av/på uten omlasting + valget i Innstillinger → Enheter (uten struping)
async function toggleCheck() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, userAgent: ANDROID_UA });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.addInitScript(() => { try { localStorage.setItem('ki-perf', 'full'); } catch (e) { /* */ } });
  await page.goto('file://' + R + 'test/harness-bubble.html');
  for (const m of mocks) await page.addScriptTag({ path: m });
  await page.addScriptTag({ path: bundle });
  const r = await page.evaluate(async () => {
    const wait = (ms) => new Promise((q) => setTimeout(q, ms));
    const hass = window.mockHass(), dash = document.getElementById('dash');
    const nav = document.createElement('msh-navbar-card'); nav.setConfig({ type: 'custom:msh-navbar-card', card_id: 'pf_nav', style: 'glass' }); nav.hass = hass; dash.appendChild(nav);
    const st = document.createElement('msh-settings-card'); st.setConfig({ type: 'custom:msh-settings-card', card_id: 'pf_set', view: 'devices' }); st.hass = hass; dash.appendChild(st);
    await wait(500);
    const navEl = () => document.querySelector('.msh-navbar-portal').shadowRoot.querySelector('nav.nb');
    const o = { full: { attr: document.documentElement.getAttribute('data-ki-perf'), bdf: getComputedStyle(navEl()).backdropFilter, bg: getComputedStyle(navEl()).backgroundColor } };
    const btns = () => [...st.shadowRoot.querySelectorAll('[data-act="perf"]')];
    o.buttons = btns().map((b) => b.textContent + (b.classList.contains('on') ? '*' : ''));
    btns().find((b) => b.dataset.v === 'lite').click();
    await wait(400);
    o.lite = { attr: document.documentElement.getAttribute('data-ki-perf'), bdf: getComputedStyle(navEl()).backdropFilter, bg: getComputedStyle(navEl()).backgroundColor, ls: localStorage.getItem('ki-perf'), label: st.shadowRoot.querySelector('.pf i').textContent };
    btns().find((b) => b.dataset.v === 'auto').click();
    await wait(400);
    o.auto = { attr: document.documentElement.getAttribute('data-ki-perf'), ls: localStorage.getItem('ki-perf'), label: st.shadowRoot.querySelector('.pf i').textContent };
    return o;
  });
  await ctx.close();
  return { ...r, errs };
}
const size = { raw: src.length, gzip: gzipSync(src).length };
const base = await run();
const lite = await run({ android: true });
const toggle = own ? await toggleCheck() : null;
const result = { bundle, throttle: THROTTLE, size, base, lite, toggle };
const pad = (s, n) => String(s).padEnd(n);
const sum = (o) => Object.values(o || {}).reduce((a, b) => a + b, 0);
console.log(`\nBundel ${bundle.replace(R, '')}: ${(size.raw / 1024).toFixed(0)} KB rå · ${(size.gzip / 1024).toFixed(0)} KB gzip · CPU ×${THROTTLE}`);
const rows = [
  ['parse+kompiler+kjør bundel (ms)', (r) => Math.round(r.evalMs)],
  ['ScriptDuration ved lasting (ms)', (r) => Math.round(r.loadScriptMs)],
  ['Hjem tegnet (ms)', (r) => Math.round(r.first.hjemMs)],
  ['Hjem malt: header+prosa+faner (ms)', (r) => (r.first.paintMs == null ? '–' : Math.round(r.first.paintMs))],
  ['tegninger ved oppstart: sum / maks per kort', (r) => `${sum(r.rendersStart)} / ${Math.max(0, ...Object.values(r.rendersStart))}`],
  ['lange oppgaver / TBT lasting (ms)', (r) => `${r.load.longTasks} / ${Math.round(r.load.tbt)}`],
  ['msh-kort i DOM (koblet/totalt)', (r) => `${r.connected.connected}/${r.connected.total}`],
  ['byrst urelatert: _render-kall', (r) => sum(r.burstUnrelated.renders)],
  ['byrst urelatert: render-ms / TBT', (r) => `${r.burstUnrelated.renderMs} / ${Math.round(r.burstUnrelated.tbt)}`],
  ['byrst effekt: _render-kall', (r) => sum(r.burstPower.renders)],
  ['byrst effekt: render-ms / TBT', (r) => `${r.burstPower.renderMs} / ${Math.round(r.burstPower.tbt)}`],
  ...POPS.map((h) => [`popup ${h}: innhold ms / TBT / rAF/s`, (r) => (r.popups[h].missing ? '–' : `${r.popups[h].contentMs} / ${r.popups[h].openTbt} / ${r.popups[h].openRaf}`)]),
  ['popups åpne: elementer med backdrop-filter', (r) => POPS.map((h) => r.popups[h].bdf).join(' ')],
  ['tomgang Hjem: CPU ms per 10 s', (r) => r.idleHjem.cpuMs],
  ['tomgang Hjem: rAF/s · timeout/s', (r) => `${r.idleHjem.rafPerS} · ${r.idleHjem.timeoutsPerS}`],
  ['tomgang Hjem: intervaller', (r) => r.idleHjem.intervals.length],
  ['tomgang Hjem: observere mo/ro/io', (r) => `${r.idleHjem.observers.mo}/${r.idleHjem.observers.ro}/${r.idleHjem.observers.io}`],
  ['tomgang Hjem: uendelige animasjoner', (r) => r.idleHjem.infinite],
  ['tomgang Hjem: oppgaver / oppgave-ms', (r) => `${r.idleHjem.tasks} / ${r.idleHjem.taskMs}`],
  ['tomgang Hjem: stil / layout', (r) => `${r.idleHjem.styleRecalcs} / ${r.idleHjem.layouts}`],
  ['tomgang Hjem: backdrop-filter-elementer', (r) => r.idleHjem.backdrop],
  ['tomgang etter popups: CPU ms / rAF/s', (r) => `${r.idleAfter.cpuMs} / ${r.idleAfter.rafPerS}`],
  ['tomgang etter popups: oppgaver / ms', (r) => `${r.idleAfter.tasks} / ${r.idleAfter.taskMs}`],
  ['tomgang etter popups: uendelige anim.', (r) => r.idleAfter.infinite],
  ['data-ki-perf', (r) => r.idleHjem.perf || '–'],
];
console.log(pad('', 40) + pad('standard', 16) + 'Android-UA');
for (const [n, f] of rows) console.log(pad(n, 40) + pad(f(base), 16) + f(lite));
console.log('\nTegning ved lasting (standard):', JSON.stringify(base.rendersLoad));
console.log('Render-kall byrst urelatert:', JSON.stringify(base.burstUnrelated.renders), '· i lukket popup:', JSON.stringify(base.burstUnrelated.closed));
console.log('Render-kall byrst effekt (' + base.powerIds.join(',') + '):', JSON.stringify(base.burstPower.renders), '· i lukket popup:', JSON.stringify(base.burstPower.closed));
console.log('Intervaller i tomgang:', base.idleHjem.intervals);
console.log('Tegninger ved popup-åpning:', JSON.stringify(Object.fromEntries(POPS.map((h) => [h, base.popups[h].renders]))));
console.log('Uendelige animasjoner i tomgang (standard):', base.idleHjem.anims);
console.log('Uendelige animasjoner i tomgang (Android):', lite.idleHjem.anims);
console.log('backdrop-filter (standard / Android):', base.idleAfter.backdropList, lite.idleAfter.backdropList);
if (base.errs.length || lite.errs.length) console.log('Sidefeil:', [...new Set([...base.errs, ...lite.errs])].slice(0, 10));
const outFile = process.env.PERF_OUT || resolve(`test/.build/perfchk-${process.pid}.json`);
writeFileSync(outFile, JSON.stringify(result, null, 1));
console.log('JSON →', outFile);
await browser.close();
try { unlinkSync(timed); if (own) unlinkSync(bundle); } catch (e) { /* */ }

// --- krav (bare når src/ er bygd her)
if (own && !process.env.PERF_NOASSERT) {
  const res = [];
  const ok = (name, cond, info) => res.push(`${cond ? '✔' : '✘'} ${name}${info != null ? ' · ' + JSON.stringify(info) : ''}`);
  ok('dist/ki-msh.js er minifisert (< 4 MB rå, var 5,1 MB)', statSync('dist/ki-msh.js').size < 4e6 && !/\n\s*\/\/ /.test(readFileSync('dist/ki-msh.js', 'utf8').slice(3000, 200000)), statSync('dist/ki-msh.js').size);
  // Oppstart (Hjem på Android): container og navbar tegnes én gang; ingen delkort mer enn to ganger (andre = data som kom
  // etterpå: kalender/Sonarr-henting, gjøremål-abonnement); første maling av det synlige av Hjem innen PERF_PAINT_MAX ms
  // (standard 1800 ved ×6 – var ~2100 før oppstartsoptimaliseringen, nå ~1300–1500).
  const RS = base.rendersStart, PMAX = Number(process.env.PERF_PAINT_MAX || 1800);
  ok('oppstart: msh-hjem-card og navbar tegnes én gang', RS['msh-hjem-card'] === 1 && RS['msh-navbar-card'] === 1, RS);
  ok('oppstart: ingen Hjem-kort tegnes mer enn to ganger', Math.max(0, ...Object.values(RS)) <= 2, RS);
  ok(`oppstart: Hjem (header+prosa+faner) malt innen ${PMAX} ms (×${THROTTLE})`, THROTTLE !== 6 || (base.first.paintMs != null && base.first.paintMs <= PMAX), Math.round(base.first.paintMs));
  ok('urelaterte endringer tegner ikke Hjem/navbar på nytt', !base.burstUnrelated.renders['msh-hjem-card'] && !base.burstUnrelated.renders['msh-navbar-card'], base.burstUnrelated.renders);
  ok('urelaterte endringer: ≤ 5 _render totalt', sum(base.burstUnrelated.renders) <= 5, sum(base.burstUnrelated.renders));
  ok('ingen tegning i lukkede popups under byrst', sum(base.burstUnrelated.closed) + sum(base.burstPower.closed) === 0, { ...base.burstUnrelated.closed, ...base.burstPower.closed });
  ok('alle popups åpner med innhold', POPS.every((h) => base.popups[h].missing || base.popups[h].contentMs != null), Object.fromEntries(POPS.map((h) => [h, base.popups[h].contentMs])));
  ok('ingen rAF-løkke i tomgang etter popups (≤ 2 rAF/s)', base.idleAfter.rafPerS <= 2, base.idleAfter.rafPerS);
  ok('standard: data-ki-perf ikke satt (iPhone/PC uendret)', !base.idleHjem.perf, base.idleHjem.perf);
  ok('Android: data-ki-perf="lite"', lite.idleHjem.perf === 'lite', lite.idleHjem.perf);
  ok('Android: ingen backdrop-filter', lite.idleHjem.backdrop === 0 && lite.idleAfter.backdrop === 0, [lite.idleHjem.backdrop, lite.idleAfter.backdrop]);
  ok('Android: ingen uendelige animasjoner i tomgang', lite.idleHjem.infinite === 0 && lite.idleAfter.infinite === 0, [lite.idleHjem.anims, lite.idleAfter.anims]);
  ok('Android: Bubble-popupene uten blur når de er åpne (standard har blur)', POPS.every((h) => lite.popups[h].bdf === 0) && POPS.some((h) => base.popups[h].bdf > 0), POPS.map((h) => `${h} ${base.popups[h].bdf}/${lite.popups[h].bdf}`));
  const T = toggle;
  ok('Ytelsesmodus «Av» på Android: ingen data-ki-perf, glass-navbaren har blur', T.full.attr === null && T.full.bdf !== 'none', T.full);
  ok('Innstillinger → Enheter: Auto/På/Av, «Av» valgt', T.buttons.join() === 'Auto,På,Av*', T.buttons);
  ok('«På» uten omlasting: data-ki-perf=lite, navbaren uten blur og med ugjennomsiktig reserve', T.lite.attr === 'lite' && T.lite.bdf === 'none' && T.lite.ls === 'lite' && !/, 0\.\d+\)$/.test(T.lite.bg) && T.lite.bg !== T.full.bg, T.lite);
  ok('«Auto» på Android = på, valget fjernes fra localStorage', T.auto.attr === 'lite' && T.auto.ls === null && /Auto · på \(Android\)/.test(T.auto.label), T.auto);
  ok('ingen sidefeil', !base.errs.length && !lite.errs.length && !T.errs.length, [...base.errs, ...lite.errs, ...T.errs].slice(0, 3));
  console.log('\n' + res.join('\n'));
  if (res.some((r) => r.startsWith('✘'))) process.exit(1);
}
