// Fiks 52 · hakk i servervelgeren («Bytt sted») på Android: menyen skal åpnes i ÉN jevn tegning.
// msh-hjem-card (header inni), 390×844, touch, CDP CPU-struping 6× – både vanlig og Ytelsesmodus (Android-UA → data-ki-perf=lite).
//  · åpning/lukking tegner IKKE headeren på nytt (ingen _render/morph – bare pila og aria-expanded settes)
//  · én meny-host, menyen bygges én gang og gjenbrukes: samme <ha-icon>-noder ved neste åpning (ikonene lastes ikke på nytt)
//  · ingen nodebytter i menyen etter åpning (1 s), ingen lagring (ki-store / saveCardConfig / uiStore / localStorage)
//  · inn-animasjonen (kimeny) kjører én gang per åpning, ingen forsinkede rad-animasjoner; lukking = kiut én gang
//  · valg av sted: window.open uten ny tegning først; rask gjenåpning under utgangsanimasjonen gjenbruker menyen
// Kjør: node test/servervelger-check.mjs
import { createRequire } from 'node:module';
import { readdirSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
mkdirSync('test/.build', { recursive: true });
// SRV_BASE=<bundel> kjører samme måling mot en annen bundel (f.eks. før-koden) i stedet for å bygge
const bundle = process.env.SRV_BASE ? resolve(process.env.SRV_BASE) : resolve(`test/.build/srvvelger-${process.pid}.js`);
if (!process.env.SRV_BASE) execFileSync('node', ['build.mjs', bundle]);
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const mocks = readdirSync('test/mock').filter((f) => f.endsWith('.js')).sort().map((m) => resolve('test/mock/' + m));
let fails = 0;
const out = [];
const ok = (name, cond, info) => { if (!cond) fails++; out.push(`${cond ? '✔' : '✘'} ${name}${!cond && info !== undefined ? ' · ' + JSON.stringify(info).slice(0, 1200) : ''}`); };
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';

async function run(lite) {
  const tag = lite ? 'ytelsesmodus' : 'vanlig';
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, ...(lite ? { userAgent: ANDROID } : {}) });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + resolve('test/harness.html'));
  for (const m of mocks) await p.addScriptTag({ path: m });
  await p.addScriptTag({ path: bundle });
  await p.evaluate(async () => {
    window.__w = (ms) => new Promise((q) => setTimeout(q, ms));
    const c = document.createElement('msh-hjem-card');
    c.setConfig({ type: 'custom:msh-hjem-card', card_id: 'hjem-srvvelger' });
    c.hass = window.mockHass(); document.getElementById('dash').appendChild(c);
    await window.__w(1500);
  });
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
  const box = await p.evaluate(() => {
    const deep = (sel) => { const o = []; const x = (rt) => rt.querySelectorAll('*').forEach((e) => { if (e.matches(sel)) o.push(e); if (e.shadowRoot) x(e.shadowRoot); }); x(document); return o; };
    const hd = deep('msh-hjem-header-card')[0];
    const M = window.MSH, L = (window.__L = {});
    window.__reset = () => Object.assign(L, { renders: 0, morph: 0, store: 0, save: 0, ui: 0, ls: [], anim: [], kids: 0, lt: [], frames: [], opened: [], rAtOpen: null, t0: performance.now() });
    window.__reset();
    window.__menus = () => [...document.querySelector('ki-overlay-root').shadowRoot.querySelectorAll('.msh-servermeny')];
    let base = customElements.get('msh-hjem-header-card').prototype;
    while (base && !Object.prototype.hasOwnProperty.call(base, '_render')) base = Object.getPrototypeOf(base);
    const r0 = base._render; base._render = function () { if (this === hd) L.renders++; return r0.apply(this, arguments); };
    const m0 = M.morph; M.morph = function (t) { if (t === hd.shadowRoot) L.morph++; return m0.apply(this, arguments); };
    if (M.store) { const s0 = M.store.set; M.store.set = function () { L.store++; return s0.apply(this, arguments); }; }
    if (M.saveCardConfig) { const sc = M.saveCardConfig; M.saveCardConfig = function () { L.save++; return sc.apply(this, arguments); }; }
    const u0 = M.uiStore; M.uiStore = function () { L.ui++; return u0.apply(this, arguments); };
    const ls0 = Storage.prototype.setItem; Storage.prototype.setItem = function (k) { L.ls.push(k); return ls0.apply(this, arguments); };
    window.open = (u) => { L.opened.push(u); L.rAtOpen = L.renders; return null; };
    try { new PerformanceObserver((l) => l.getEntries().forEach((e) => L.lt.push(Math.round(e.duration)))).observe({ type: 'longtask' }); } catch (e) { /* */ }
    let last = performance.now();
    const loop = () => { const n = performance.now(); L.frames.push(Math.round(n - last)); last = n; requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    // menyens shadow root: animasjoner og nodebytter (lytterne kobles én gang – menyen gjenbrukes)
    const V = M.servervelger, mk = V.meny;
    V.meny = function () {
      const api = mk.apply(this, arguments), sr = api.root;
      if (!sr.__obs) {
        sr.__obs = 1;
        new MutationObserver((ms) => ms.forEach((x) => { if (x.type === 'childList') L.kids += x.addedNodes.length + x.removedNodes.length; })).observe(sr, { subtree: true, childList: true });
        sr.addEventListener('animationstart', (e) => L.anim.push(e.animationName));
      }
      L.icons = [...sr.querySelectorAll('ha-icon')];
      return api;
    };
    window.__hd = hd;
    const t = hd.shadowRoot.querySelector('.ttl .tx').getBoundingClientRect();
    return { x: t.left + t.width / 2, y: t.top + t.height / 2, perf: document.documentElement.getAttribute('data-ki-perf') };
  });
  ok(`[${tag}] modus: data-ki-perf=${box.perf}`, lite ? box.perf === 'lite' : box.perf !== 'lite', box.perf);
  const snap = () => p.evaluate(() => { const L = window.__L, h = window.__hd.shadowRoot; return { renders: L.renders, morph: L.morph, store: L.store, save: L.save, ui: L.ui, ls: L.ls.slice(), anim: L.anim.slice(), kids: L.kids, lt: L.lt.slice(), maxFrame: Math.max(0, ...L.frames), menus: window.__menus().length, pil: h.querySelector('.ttl .pil').classList.contains('apen'), aria: h.querySelector('.ttl').getAttribute('aria-expanded'), opened: L.opened.slice(), rAtOpen: L.rAtOpen }; });
  const tapTitle = () => p.touchscreen.tap(box.x, box.y);
  const tapOutside = () => p.touchscreen.tap(200, 760);
  const res = {};
  for (const n of [1, 2]) {
    await p.evaluate(() => window.__reset());
    await tapTitle();
    await p.waitForTimeout(80);
    await p.evaluate(() => { window.__L.kids = 0; }); // nodebytter ETTER åpning
    await p.waitForTimeout(1000);
    const o = await snap();
    o.iconsSame = await p.evaluate(() => { const L = window.__L, prev = window.__prevI; window.__prevI = L.icons; return { n: L.icons.length, same: prev ? L.icons.filter((i) => prev.includes(i)).length : null, connected: L.icons.every((i) => i.isConnected) }; });
    res['open' + n] = o;
    await p.evaluate(() => window.__reset());
    await tapOutside();
    await p.waitForTimeout(600);
    res['close' + n] = await snap();
  }
  for (const n of [1, 2]) {
    const o = res['open' + n], c = res['close' + n];
    ok(`[${tag}] åpning ${n}: headeren tegnes ikke på nytt (0 _render, 0 morph)`, o.renders === 0 && o.morph === 0, o);
    ok(`[${tag}] åpning ${n}: én meny, pila roterer, aria-expanded=true`, o.menus === 1 && o.pil && o.aria === 'true', o);
    ok(`[${tag}] åpning ${n}: inn-animasjonen kjører én gang (kimeny ×1, ingen rad-animasjoner)`, o.anim.length === 1 && o.anim[0] === 'kimeny', o.anim);
    ok(`[${tag}] åpning ${n}: ingen nodebytter i menyen innen 1 s`, o.kids === 0, o.kids);
    ok(`[${tag}] åpning ${n}: ingen lagring (ki-store, saveCardConfig, uiStore, localStorage)`, !o.store && !o.save && !o.ui && !o.ls.length, o);
    ok(`[${tag}] åpning ${n}: ${o.iconsSame.n} ikoner, tilkoblet${n > 1 ? ', samme noder som forrige åpning' : ''}`, o.iconsSame.n >= 4 && o.iconsSame.connected && (n === 1 || o.iconsSame.same === o.iconsSame.n), o.iconsSame);
    ok(`[${tag}] lukking ${n}: ingen ny tegning, kiut ×1, menyen fjernet, pila tilbake`, c.renders === 0 && c.morph === 0 && c.anim.join() === 'kiut' && c.menus === 0 && !c.pil && c.aria === 'false' && !c.store && !c.ls.length, c);
  }
  // Rask gjenåpning mens utgangsanimasjonen pågår → samme meny settes inn igjen (ikke ut-klassen, ikke to hosts)
  const re = await p.evaluate(async () => {
    const h = window.__hd;
    h._serverMenu(); await window.__w(400);
    const m1 = window.__menus()[0];
    h._srvClose(); await window.__w(40); // utgangsanimasjonen (150 ms) pågår
    const ut = !!(m1 && m1.isConnected && m1.shadowRoot.querySelector('.meny.ut'));
    h._serverMenu(); await window.__w(400);
    const ms = window.__menus();
    const r = { utUnderveis: ut, n: ms.length, same: ms[0] === m1, ut: ms[0] ? ms[0].shadowRoot.querySelector('.meny').classList.contains('ut') : null, pil: h.shadowRoot.querySelector('.ttl .pil').classList.contains('apen') };
    window.__hd._srvClose(true); await window.__w(50);
    return r;
  });
  ok(`[${tag}] gjenåpning under utgangsanimasjonen: én meny, samme host, ikke «ut», pila åpen`, re.utUnderveis && re.n === 1 && re.same && !re.ut && re.pil, re);
  // Valg av sted → window.open uten ny tegning først
  await p.evaluate(() => window.__reset());
  await tapTitle();
  await p.waitForTimeout(500);
  const rad = await p.evaluate(() => { const r = [...window.__menus()[0].shadowRoot.querySelectorAll('.rad')].find((x) => !x.classList.contains('na') && !x.classList.contains('tilpass')).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await p.touchscreen.tap(rad.x, rad.y);
  await p.waitForTimeout(500);
  const sel = await snap();
  ok(`[${tag}] valg: window.open(homeassistant://navigate/…) uten ny tegning, menyen lukket`, sel.opened.length === 1 && /^homeassistant:\/\/navigate\//.test(sel.opened[0]) && sel.rAtOpen === 0 && sel.renders === 0 && sel.menus === 0 && !sel.store && !sel.ls.length, sel);
  ok(`[${tag}] ingen sidefeil`, !errs.length, errs);
  out.push(`  · [${tag}] lange oppgaver ved åpning 1/2: ${JSON.stringify(res.open1.lt)} / ${JSON.stringify(res.open2.lt)} · lengste frame ${res.open1.maxFrame}/${res.open2.maxFrame} ms · lukking ${JSON.stringify(res.close1.lt)} (CPU 6×)`);
  ok(`[${tag}] ingen lang oppgave ≥ 100 ms ved andre åpning (CPU 6×)`, !res.open2.lt.some((x) => x >= 100), res.open2.lt);
  await ctx.close();
}

await run(false);
await run(true);
await b.close();
console.log(out.join('\n'));
console.log(fails ? `servervelger-check: ${fails} FEIL` : `servervelger-check: OK (${out.filter((l) => l.startsWith('✔')).length})`);
process.exit(fails ? 1 : 0);
