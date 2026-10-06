// Fiks 52 A · flimmer på Android når en popup åpnes fra «Mer»-menyen / navbaren.
// Hele det strategi-genererte dashbordet mot ekte Bubble Card, Android-UA (Pixel 6a), 390×844 touch, CPU-struping ×6,
// glass-navbar og Ytelsesmodus AV (A52_PERF=full, standard – verste tilfelle med blur; A52_PERF=auto = lite på Android).
// Åpner #server, #strom, #media, #vaer, #stue og #kjokken fra «Mer»-menyen og fra navbaren, A52_RUNS (5) ganger hver:
//  · rAF-sampler: rammer under åpningen (lengste pause, rammer > 50 ms), lange oppgaver (longtask) fra trykk til +800 ms
//  · «Mer»-menyen er borte og ingen blur-lag animerer når location.hash settes (MSH.openPopup + hashchange); aldri to
//    blur-lag som animerer i samme ramme (Android: ingen); Bubble-popupen åpner med bare transform (ingen opasitet, ingen
//    backdrop-filter mens den glir) og har ugjennomsiktig flate fra første ramme
//  · én haptic per trykk
//  · ingen _render av Hjem/navbar/header ved hash-byttet (unntak: navbaren når mini-spilleren skjules i #media)
//  · skjermbilder (CDP screencast, første runde per mål): ingen ramme der popup-flaten eller dashbord-bakgrunnen er ren
//    hvit/svart
//  · ki-android bare med Android-UA (<html>, dashbord-containeren, popup-røttene, ki-overlay-root); fonter på
//    dokumentnivå én gang; <img> i Server-popupen rapporteres
// Kjør: node test/android52-check.mjs   (A52_BUNDLE=<fil> måler en ferdig bundel uten krav · A52_RUNS=n · A52_OUT=<json>)
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { readdirSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from 'node:fs';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const R = resolve('.') + '/';
mkdirSync('test/.build', { recursive: true });
mkdirSync('test/.vendor', { recursive: true });
const BC = resolve('test/.vendor/bubble-card.js');
if (!existsSync(BC)) execFileSync('curl', ['-sSL', '-o', BC, 'https://raw.githubusercontent.com/Clooos/Bubble-Card/main/dist/bubble-card.js']);
const own = !process.env.A52_BUNDLE;
const bundle = own ? resolve(`test/.build/and52-${process.pid}.js`) : resolve(process.env.A52_BUNDLE);
if (own) execFileSync('node', ['build.mjs', bundle], { cwd: R, stdio: 'inherit' });
const RUNS = Number(process.env.A52_RUNS || 5);
const THROTTLE = Number(process.env.A52_THROTTLE || 6);
const PERF = process.env.A52_PERF || 'full';
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 13; Pixel 6a) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';
const TARGETS = [['server', '#server'], ['strom', '#strom'], ['media', '#media'], ['vaer', '#vaer'], ['stue', '#stue'], ['kjokken', '#kjokken']];
const WATCH = ['msh-hjem-card', 'msh-navbar-card', 'msh-hjem-header-card', 'msh-prosa-card', 'msh-hjem-faner-card'];
const mocks = readdirSync(R + 'test/mock').filter((f) => f.endsWith('.js')).sort().map((f) => R + 'test/mock/' + f);
const browser = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => pw.chromium.launch());

// Instrumentering før alt annet: lange oppgaver, haptic, hashchange (capture – før Bubble Card)
const INIT = () => {
  window.__lt = [];
  try { new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__lt.push([e.startTime, e.duration]))).observe({ type: 'longtask', buffered: true }); } catch (e) { /* */ }
  window.addEventListener('haptic', (e) => { const A = window.__a52; if (A) { A.hap++; A.hapLog.push([Math.round(performance.now() - A.t0), e.detail, A.dbg ? (new Error().stack || '').split('\n').slice(2, 7).join(' | ') : '']); } });
  window.addEventListener('click', () => { const A = window.__a52; if (A && A.click == null) A.click = performance.now() - A.t0; }, true);
  window.addEventListener('hashchange', () => { const A = window.__a52; if (A && !A.hc && window.__a52snap) A.hc = { t: performance.now() - A.t0, ...window.__a52snap() }; }, true);
};

async function setup(ua) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, ...(ua ? { userAgent: ua } : {}) });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.addInitScript(INIT);
  await page.addInitScript((v) => { try { if (v === 'auto') localStorage.removeItem('ki-perf'); else localStorage.setItem('ki-perf', v); } catch (e) { /* */ } }, PERF);
  await page.goto('file://' + R + 'test/harness-bubble.html');
  for (const m of mocks) await page.addScriptTag({ path: m });
  await page.addScriptTag({ path: bundle });
  await page.addScriptTag({ path: BC, type: 'module' });
  await page.waitForFunction(() => customElements.get('bubble-card'), null, { timeout: 30000 });
  await page.evaluate(async (WATCH) => {
    const M = window.MSH;
    const hass = window.mockHass();
    window.__H = hass;
    const S = customElements.get('ll-strategy-dashboard-ki-dashboard');
    const dash = await S.generate({}, hass);
    const stack = dash.views[0].cards[0];
    window.__pops = stack.cards.filter((c) => c.card_type === 'pop-up').map((c) => c.hash);
    const root = document.getElementById('dash');
    for (const c of stack.cards) { const el = document.createElement(c.type.replace('custom:', '')); el.setConfig(c); el.hass = hass; root.appendChild(el); }
    window.__navCfg = stack.cards.find((c) => c.type === 'custom:msh-navbar-card');
    // _render-telling (bare mens en måling pågår)
    const orig = M.Card.prototype._render;
    M.Card.prototype._render = function () {
      const A = window.__a52;
      if (A && A.live && this._config && this._hass) { A.renders[this.localName] = (A.renders[this.localName] || 0) + 1; if (A.dbg && WATCH.includes(this.localName)) A.rlog.push([this.localName, Math.round(performance.now() - A.t0), (new Error().stack || '').split('\n').slice(2, 9).join(' | ')]); }
      return orig.call(this);
    };
    const osch = M.Card.prototype._schedule;
    M.Card.prototype._schedule = function (f) { const A = window.__a52; if (A && A.live && A.dbg && WATCH.includes(this.localName) && !this._raf) A.rlog.push(['schedule ' + this.localName, Math.round(performance.now() - A.t0), (new Error().stack || '').split('\n').slice(2, 9).join(' | ')]); return osch.call(this, f); };
    const portal = () => { const p = document.querySelector('.msh-navbar-portal') || [...document.querySelectorAll('*')].find((e) => e.classList && e.classList.contains('msh-navbar-portal')); return p && p.shadowRoot; };
    window.__portal = portal;
    // Løpende animasjoner/overganger der målet (eller pseudo-elementet) har backdrop-filter, i de relevante røttene
    window.__blurAnims = () => {
      const A = window.__a52, roots = [document, ...(A ? A.roots : [])], out = [];
      const sr = portal(); if (sr && !roots.includes(sr)) roots.push(sr);
      for (const r of roots) {
        let list = []; try { list = r.getAnimations(); } catch (e) { /* */ }
        for (const an of list) {
          if (an.playState !== 'running' || !an.effect || !an.effect.target) continue;
          const tg = an.effect.target, ps = an.effect.pseudoElement || null;
          const cs = getComputedStyle(tg, ps), bf = cs.backdropFilter || cs.webkitBackdropFilter;
          if (bf && bf !== 'none') out.push(`${tg.localName}.${String(tg.className).split(' ').slice(0, 2).join('.')}${ps || ''}:${an.animationName || an.transitionProperty || 'anim'} [${bf}]`);
        }
      }
      return [...new Set(out)];
    };
    window.__a52snap = () => { const sr = portal(); return { menu: !!(sr && sr.querySelector('.mbox')), blur: window.__blurAnims() }; };
    const op = M.openPopup;
    M.openPopup = function (h) { const A = window.__a52; if (A && !A.open) A.open = { t: performance.now() - A.t0, ...window.__a52snap() }; return op.apply(this, arguments); };
    await new Promise((r) => setTimeout(r, 2500));
  }, WATCH);
  const cdp = await ctx.newCDPSession(page);
  return { ctx, page, cdp, errs };
}

// Navbar-oppsett: mål i «Mer» eller i selve navbaren (egne knapper for hashene som ikke er innebygde)
async function navMode(page, mode) {
  await page.evaluate(async ([mode, TARGETS]) => {
    const c = window.__navCfg, B = { ...(c.buttons || {}) };
    TARGETS.forEach(([id, h]) => { if (id !== 'media') B[id] = { ...(B[id] || {}), custom: true, icon: 'mdi:star', label: id, tap_action: { action: 'navigate', navigation_path: h } }; });
    const ids = TARGETS.map(([id]) => id);
    const nb = document.querySelector('msh-navbar-card');
    nb.setConfig({ ...c, style: 'glass', buttons: B, bar: mode === 'mer' ? ['vanning'] : ids, more: mode === 'mer' ? ids : ['gjoremal'], hidden: [] });
    await new Promise((r) => setTimeout(r, 900));
  }, [mode, TARGETS]);
}

const center = (page, sel) => page.evaluate((sel) => {
  const sr = window.__portal(); const el = sr && sr.querySelector(sel);
  if (!el) return null;
  const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}, sel);

// PNG-rammer fra screencast → piksel-statistikk (i en egen, ustrupet side)
let decoder = null;
async function analyse(frames) {
  if (!decoder) { const c = await browser.newContext(); decoder = await c.newPage(); }
  return decoder.evaluate(async (frames) => {
    const out = [];
    for (const f of frames) {
      const blob = await (await fetch('data:image/png;base64,' + f.data)).blob();
      const bm = await createImageBitmap(blob);
      const cv = new OffscreenCanvas(bm.width, bm.height), cx = cv.getContext('2d');
      cx.drawImage(bm, 0, 0);
      const sx = bm.width / 390;
      const stat = (x0, y0, x1, y1) => {
        const d = cx.getImageData(Math.round(x0 * sx), Math.round(y0 * sx), Math.round((x1 - x0) * sx), Math.round((y1 - y0) * sx)).data;
        let w = 0, b = 0, n = 0, sum = 0;
        for (let i = 0; i < d.length; i += 16) { const r = d[i], g = d[i + 1], bb = d[i + 2]; n++; sum += (r + g + bb) / 3; if (r >= 250 && g >= 250 && bb >= 250) w++; if (r <= 3 && g <= 3 && bb <= 3) b++; }
        return { white: w / n, black: b / n, mean: Math.round(sum / n) };
      };
      out.push({ ts: f.ts, pop: stat(20, 300, 370, 760), dash: stat(0, 4, 390, 44) });
    }
    return out;
  }, frames);
}

async function openOnce(S, mode, id, hash, shot) {
  const { page, cdp } = S;
  if (mode === 'mer') {
    const m = await center(page, 'nav.nb .it[data-id="__more"]');
    await page.touchscreen.tap(m.x, m.y);
    await page.waitForTimeout(500);
  }
  const sel = mode === 'mer' ? `.mbox .mi[data-id="${id}"]` : `nav.nb .it[data-id="${id}"]`;
  const p = await center(page, sel);
  if (!p) return { missing: sel };
  await page.evaluate(([hash, WATCH, dbg]) => {
    const roots = [];
    const all = (r, d) => { if (d > 12) return; r.querySelectorAll('*').forEach((e) => { if (e.shadowRoot) { if (e.localName === 'bubble-card' && ((e.config || e._config || {}).hash === hash)) roots.push(e.shadowRoot); if (e.shadowRoot.querySelector(':scope > .bubble-backdrop, .bubble-backdrop')) roots.push(e.shadowRoot); all(e.shadowRoot, d + 1); } }); };
    all(document, 0);
    const ov = document.querySelector('body > ki-overlay-root'); if (ov) roots.push(ov.shadowRoot);
    const A = (window.__a52 = { t0: performance.now(), live: true, hash, roots: [...new Set(roots)], renders: {}, hap: 0, hapLog: [], rlog: [], dbg, click: null, open: null, hc: null, frames: [], blurMax: 0, blurSeen: [], opening: [] });
    const popEl = () => { for (const r of A.roots) { const p = r.querySelector('.bubble-pop-up'); if (p && ((r.host.config || r.host._config || {}).hash === hash)) return p; } return null; };
    const tick = () => {
      const t = performance.now() - A.t0;
      A.frames.push(t);
      const b = window.__blurAnims();
      if (b.length > A.blurMax) A.blurMax = b.length;
      b.forEach((x) => { if (!A.blurSeen.includes(x)) A.blurSeen.push(x); });
      const pe = popEl();
      if (pe && pe.classList.contains('is-opening')) {
        const cs = getComputedStyle(pe), bg = pe.querySelector('.bubble-pop-up-background');
        A.opening.push({ t: Math.round(t), bdf: cs.backdropFilter, op: cs.opacity, tp: cs.transitionProperty, an: cs.animationName, bg: bg ? getComputedStyle(bg).backgroundColor : null, tf: cs.transform });
      }
      if (t < 1200) requestAnimationFrame(tick); else A.live = false;
    };
    requestAnimationFrame(tick);
  }, [hash, WATCH, !!process.env.A52_DEBUG]);
  const frames = [];
  const onFrame = (f) => { frames.push({ data: f.data, ts: f.metadata.timestamp }); cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {}); };
  if (shot) { cdp.on('Page.screencastFrame', onFrame); await cdp.send('Page.startScreencast', { format: 'png', everyNthFrame: 1 }); }
  await page.touchscreen.tap(p.x, p.y);
  await page.waitForTimeout(1500);
  if (shot) { await cdp.send('Page.stopScreencast'); cdp.off('Page.screencastFrame', onFrame); }
  const r = await page.evaluate(() => {
    const A = window.__a52; A.live = false;
    const lt = window.__lt.filter(([s, d]) => s + d >= A.t0 && s <= A.t0 + 800).map(([s, d]) => [Math.round(s - A.t0), Math.round(d)]);
    const gaps = A.frames.filter((t) => t <= 800).map((t, i, a) => (i ? t - a[i - 1] : t));
    const pe = (() => { for (const r of A.roots) { const p = r.querySelector('.bubble-pop-up'); if (p && ((r.host.config || r.host._config || {}).hash === A.hash)) return p; } return null; })();
    return { click: A.click, hapLog: A.hapLog, rlog: A.rlog, open: A.open, hc: A.hc, hap: A.hap, renders: A.renders, lt, maxGap: Math.round(Math.max(0, ...gaps.slice(1))), longFrames: gaps.slice(1).filter((g) => g > 50).length, frames: A.frames.filter((t) => t <= 800).length, blurMax: A.blurMax, blurSeen: A.blurSeen, opening: A.opening, opened: !!(pe && pe.classList.contains('is-popup-opened')), popAndroid: !!(pe && pe.classList.contains('ki-android')), hash: location.hash };
  });
  if (shot && frames.length) r.pix = await analyse(frames.slice(0, 80));
  if (hash === '#server') r.img = await page.evaluate(() => { const out = []; const w = (x) => x.querySelectorAll('*').forEach((e) => { if (e.localName === 'img' && /msh-server|server/.test((e.getRootNode().host || {}).localName || '')) out.push((e.getAttribute('src') || '').slice(0, 80)); if (e.shadowRoot) w(e.shadowRoot); }); w(document); return out; });
  await page.evaluate(() => { window.MSH.closePopup(); });
  await page.waitForTimeout(900);
  return r;
}

// --- Android
const S = await setup(ANDROID_UA);
await S.cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
const res = { mer: {}, nav: {} };
for (const mode of ['mer', 'nav']) {
  await navMode(S.page, mode);
  for (const [id, hash] of TARGETS) {
    res[mode][hash] = [];
    for (let i = 0; i < RUNS; i++) res[mode][hash].push(await openOnce(S, mode, id, hash, i === 0));
  }
}
await S.cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
const andCls = await S.page.evaluate(() => {
  const M = window.MSH; M.overlayRoot();
  const ov = document.querySelector('body > ki-overlay-root');
  const pops = []; const w = (x) => x.querySelectorAll('*').forEach((e) => { if (e.classList && e.classList.contains('bubble-pop-up')) pops.push(e); if (e.shadowRoot) w(e.shadowRoot); }); w(document);
  const adopted = pops.filter((p) => p.getAttribute('data-ki-theme'));
  return { html: document.documentElement.classList.contains('ki-android'), dash: document.getElementById('dash').classList.contains('ki-android'), overlay: ov.classList.contains('ki-android'), pops: `${adopted.filter((p) => p.classList.contains('ki-android')).length}/${adopted.length}`, perf: document.documentElement.getAttribute('data-ki-perf'), bodyBg: getComputedStyle(document.body).backgroundColor,
    fonts: document.querySelectorAll('link#msh-fonts').length, preconnect: document.querySelectorAll('link[rel=preconnect][href*="fonts.g"]').length, symbols: document.querySelectorAll('link[href*="Material+Symbols"],link[href*="material-symbols"]').length };
});
await S.ctx.close();
// --- standard-UA (iOS/PC): ingen ki-android, ingen Android-regler
const D = await setup(null);
const defCls = await D.page.evaluate(async () => {
  const M = window.MSH; M.overlayRoot();
  location.hash = '#server'; await new Promise((r) => setTimeout(r, 1200));
  const pops = []; const st = []; const w = (x) => x.querySelectorAll('*').forEach((e) => { if (e.classList && e.classList.contains('bubble-pop-up')) pops.push(e); if (e.id === 'ki-perf-pop') st.push(e.textContent); if (e.shadowRoot) w(e.shadowRoot); }); w(document);
  const pr = window.__portal();
  const r = { html: document.documentElement.classList.contains('ki-android'), dash: document.getElementById('dash').classList.contains('ki-android'), overlay: document.querySelector('body > ki-overlay-root').classList.contains('ki-android'), pops: pops.filter((p) => p.classList.contains('ki-android')).length, rules: st.some((t) => /ki-and-pop-in/.test(t)) || !!document.getElementById('msh-android') || !!(pr && /mshMenuIn/.test(pr.innerHTML)), android: !!(M.perf && M.perf.android) };
  M.closePopup(); return r;
});
await D.ctx.close();
await browser.close();
if (own) try { unlinkSync(bundle); } catch (e) { /* */ }

// --- rapport
const flat = (m) => Object.values(res[m]).flat();
const all = [...flat('mer'), ...flat('nav')];
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : 0; };
const pad = (s, n) => String(s).padEnd(n);
console.log(`\nFiks 52 · Android-UA · CPU ×${THROTTLE} · Ytelsesmodus ${PERF} · glass-navbar · ${RUNS} runder per mål`);
console.log(pad('mål', 16) + pad('lange oppg. (maks ms)', 24) + pad('maks rammepause', 18) + pad('rammer>50ms', 13) + pad('blur-anim maks', 16) + 'tegn. hjem/nav/hdr');
for (const m of ['mer', 'nav']) for (const [, h] of TARGETS) {
  const L = res[m][h].filter((r) => !r.missing);
  const lts = L.flatMap((r) => r.lt.map(([, d]) => d));
  const rw = (k) => L.reduce((a, r) => a + (r.renders[k] || 0), 0);
  console.log(pad(`${m === 'mer' ? 'Mer' : 'navbar'} ${h}`, 16) + pad(`${lts.length} (${Math.max(0, ...lts)})`, 24) + pad(`${Math.max(0, ...L.map((r) => r.maxGap))} ms`, 18) + pad(L.reduce((a, r) => a + r.longFrames, 0), 13) + pad(Math.max(0, ...L.map((r) => r.blurMax)), 16) + `${rw('msh-hjem-card') + rw('msh-hjem-header-card') + rw('msh-prosa-card') + rw('msh-hjem-faner-card')}/${rw('msh-navbar-card')}`);
}
const lt = all.flatMap((r) => r.lt.map(([, d]) => d));
console.log(`\nLange oppgaver under åpningen (trykk → +800 ms): ${lt.length} totalt i ${all.length} åpninger · maks ${Math.max(0, ...lt)} ms · p50 ${pct(lt, 0.5)} ms · p90 ${pct(lt, 0.9)} ms`);
console.log('Blur-lag sett animere:', [...new Set(all.flatMap((r) => r.blurSeen))]);
const pix = all.filter((r) => r.pix).flatMap((r) => r.pix);
const badPix = pix.filter((f) => f.pop.white > 0.5 || f.pop.black > 0.5 || f.dash.white > 0.5 || f.dash.black > 0.5);
console.log(`Skjermbilder (screencast): ${pix.length} rammer · ${badPix.length} med ren hvit/svart flate`, badPix.slice(0, 3));
const op1 = all.map((r) => r.opening[0]).filter(Boolean);
console.log('Bubble åpning (første ramme):', JSON.stringify(op1[0] || null));
console.log('Server <img>:', JSON.stringify([...new Set(all.flatMap((r) => r.img || []))]));
console.log('Android-klasser:', JSON.stringify(andCls), '· standard-UA:', JSON.stringify(defCls));
const outFile = process.env.A52_OUT || resolve(`test/.build/and52-${process.pid}.json`);
writeFileSync(outFile, JSON.stringify({ res, andCls, defCls }, null, 1));
console.log('JSON →', outFile);
if (process.env.A52_DEBUG) for (const r of all) { if (r.hap !== 1) console.log('haptic', r.hash, JSON.stringify(r.hapLog)); if (r.rlog.length) console.log('tegning', r.hash, JSON.stringify(r.rlog)); }
if (S.errs.length || D.errs.length) console.log('Sidefeil:', [...new Set([...S.errs, ...D.errs])].slice(0, 5));

if (own) {
  const out = [];
  const ok = (n, c, i) => out.push(`${c ? '✔' : '✘'} ${n}${i != null ? ' · ' + JSON.stringify(i).slice(0, 400) : ''}`);
  const miss = all.filter((r) => r.missing);
  ok('alle knapper/menypunkter fantes', !miss.length, miss.slice(0, 3));
  ok('popupen åpnet hver gang', all.every((r) => r.opened || r.missing), all.filter((r) => !r.opened).map((r) => r.hash).slice(0, 5));
  const merAll = flat('mer');
  ok('«Mer»: menyen er borte og ingen blur animerer når hashen settes (openPopup + hashchange)', merAll.every((r) => r.open && !r.open.menu && !r.open.blur.length && r.hc && !r.hc.menu && !r.hc.blur.length), merAll.filter((r) => !r.open || r.open.menu || r.open.blur.length).map((r) => r.open).slice(0, 2));
  ok('«Mer»: hashen settes innen 180 ms etter klikket', merAll.every((r) => r.open && r.click != null && r.open.t - r.click <= 180), merAll.map((r) => r.open && Math.round(r.open.t - r.click)).slice(0, 30));
  ok('navbar: ingen blur animerer når hashen settes', flat('nav').every((r) => r.open && !r.open.blur.length), flat('nav').filter((r) => !r.open || r.open.blur.length).map((r) => r.open).slice(0, 2));
  ok('aldri blur-lag som animerer under åpningen (Android)', all.every((r) => r.blurMax === 0), [...new Set(all.flatMap((r) => r.blurSeen))]);
  ok('én haptic per trykk', all.every((r) => r.hap === 1), all.map((r) => r.hap).join(''));
  ok('Bubble-popupen glir bare med transform: ingen backdrop-filter, opasitet 1, overgang = transform', op1.length > 0 && all.every((r) => r.opening.every((f) => f.bdf === 'none' && f.op === '1' && f.tp === 'transform' && !/fast-open/.test(f.an))), op1.slice(0, 2));
  ok('popupens flate er ugjennomsiktig (ikke svart) fra første åpne-ramme', op1.every((f) => { const m = /rgba?\(([\d.]+), ([\d.]+), ([\d.]+)(?:, ([\d.]+))?\)|color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)(?: \/ ([\d.]+))?\)/.exec(f.bg || ''); if (!m) return false; const a = m[4] != null ? +m[4] : m[8] != null ? +m[8] : 1; const v = m[1] != null ? +m[1] + +m[2] + +m[3] : (+m[5] + +m[6] + +m[7]) * 255; return a > 0.8 && v > 30; }), [...new Set(op1.map((f) => f.bg))]);
  ok('skjermbilder: ingen ramme med ren hvit/svart popup-flate eller dashbord-bakgrunn', pix.length > 0 && badPix.length === 0, { rammer: pix.length, feil: badPix.slice(0, 2) });
  const hj = all.filter((r) => ['msh-hjem-card', 'msh-hjem-header-card', 'msh-prosa-card', 'msh-hjem-faner-card'].some((k) => r.renders[k]));
  ok('hash-bytte tegner ikke Hjem/header på nytt', !hj.length, hj.map((r) => [r.hash, r.renders]).slice(0, 3));
  const nv = all.filter((r) => r.renders['msh-navbar-card'] && r.hash !== '#media');
  ok('hash-bytte tegner ikke navbaren på nytt (unntak #media: mini-spilleren skjules)', !nv.length, nv.map((r) => [r.hash, r.renders]).slice(0, 3));
  const LMAX = Number(process.env.A52_LT_MAX || 0);
  if (LMAX) ok(`ingen lang oppgave over ${LMAX} ms under åpningen`, Math.max(0, ...lt) <= LMAX, Math.max(0, ...lt));
  ok('Android: ki-android på <html>, dashbord-container, popup-røtter og ki-overlay-root', andCls.html && andCls.dash && andCls.overlay && all.every((r) => r.popAndroid || r.missing), { ...andCls, pops: all.filter((r) => !r.popAndroid).map((r) => r.hash) });
  ok('Android: dashbord-bakgrunn bak alt (#232323 på body)', andCls.bodyBg === 'rgb(35, 35, 35)', andCls.bodyBg);
  ok('standard-UA: ingen ki-android og ingen Android-regler (iOS/PC uendret)', !defCls.html && !defCls.dash && !defCls.overlay && !defCls.pops && !defCls.rules && !defCls.android, defCls);
  ok('fonter på dokumentnivå én gang (+ preconnect), ingen ikonfont', andCls.fonts === 1 && andCls.preconnect === 2 && andCls.symbols === 0, andCls);
  ok('Server-popupen har ingen <img>', ![...new Set(all.flatMap((r) => r.img || []))].length);
  ok('ingen sidefeil', !S.errs.length && !D.errs.length, [...S.errs, ...D.errs].slice(0, 3));
  console.log('\n' + out.join('\n'));
  if (out.some((x) => x.startsWith('✘'))) process.exit(1);
}
