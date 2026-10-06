// Fiks 54 A · Android-flimmer sett i skjermopptak (HA Companion-appen): stedvelgeren («Bytt sted») og Now Playing/navbar.
// Android-UA (Pixel 6a), 390×844 touch, CPU-struping ×6 (A54_THROTTLE), Ytelsesmodus «auto» (= på for Android).
//
// A1 · stedvelgeren på Hjem (msh-hjem-card → msh-hjem-header-card → MSH.servervelger.meny), rAF-sampling hver ramme:
//  · åpning: bakgrunnslaget (.meny) scale(.96) → 1 og det indre laget (.lag) opasitet 0 → 1, ~160 ms (ikke ett bilde)
//  · bakgrunnslaget er helt dekkende i HVER ramme menyen finnes: var(--ki-surface-2, #3a3a3a), alfa 1, ingen
//    backdrop-filter, egen opasitet 1 (aldri halvgjennomsiktig meny → ingen dobbel tekst)
//  · lukking: bare det indre laget fades; verten fjernes først etter transitionend (aldri midt i fadingen)
//  · velg Toten og Strømstad: msh-hjem-card (og headeren) tegnes ikke på nytt (0 _render); stedsbyttet (window.open) og
//    ki-sted-valgt kommer først når menyen er fjernet
// A2 · Now Playing (mini-spilleren) + navbaren, 2 spillere «Kjøkken Radio» ↔ «Squeezebox Radio», A54_SWIPES (20 = 10
//    ganger frem og tilbake) sveip med ekte berøring (CDP touch), media-hass-oppdateringer underveis + nytt omslag:
//  · navbaren: samme node hele tiden, 0 tegninger (_navRenders) og 0 DOM-endringer (MutationObserver på hele navbaren)
//  · navbaren finnes og er synlig i HVER ramme (rAF); mini-kortet er aldri tomt (art eller tekst i hver ramme)
//  · ingen opasitet < 1 på kortet / radene / scroll-containeren; høyden er 64 px i hver ramme
//  · spillerkortene (.mrow) og omslagene (<img>) erstattes ikke; ny art-src settes først etter img.decode()
//  · prikkene og aktiv spiller endres ikke mens fingeren er nede (bare ved slutten av gesten)
//  · iOS/PC (standard-UA): menyen har keyframe-animasjonen som før, ingen translateZ(0) på navbaren
// Kjør: node test/android54-check.mjs   (A54_BUNDLE=<fil> måler en ferdig bundel uten krav)
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { readdirSync, mkdirSync, unlinkSync } from 'node:fs';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const R = resolve('.') + '/';
mkdirSync('test/.build', { recursive: true });
const own = !process.env.A54_BUNDLE;
const bundle = own ? resolve(`test/.build/and54-${process.pid}.js`) : resolve(process.env.A54_BUNDLE);
if (own) execFileSync('node', ['build.mjs', bundle], { cwd: R, stdio: 'inherit' });
const SWIPES = Number(process.env.A54_SWIPES || 20);
const THROTTLE = Number(process.env.A54_THROTTLE || 6);
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 13; Pixel 6a) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';
const mocks = readdirSync(R + 'test/mock').filter((f) => f.endsWith('.js')).sort().map((f) => R + 'test/mock/' + f);
const browser = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => pw.chromium.launch());
const svg = (fill) => 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="${fill}"/><circle cx="32" cy="32" r="14" fill="#fff"/></svg>`);
const ART = [svg('#5a7'), svg('#a57'), svg('#57a')];

async function page(ua) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, ...(ua ? { userAgent: ua } : {}) });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.addInitScript(() => { try { localStorage.removeItem('ki-perf'); sessionStorage.clear(); } catch (e) { /* */ } });
  await p.goto('file://' + R + 'test/harness.html');
  for (const m of mocks) await p.addScriptTag({ path: m });
  await p.addScriptTag({ path: bundle });
  const cdp = await ctx.newCDPSession(p);
  return { ctx, p, cdp, errs };
}

/* ------------------------------------------------------------------ A1 · stedvelgeren */
async function stedvelger(ua) {
  const S = await page(ua);
  const box = await S.p.evaluate(async () => {
    const w = (ms) => new Promise((q) => setTimeout(q, ms));
    const c = document.createElement('msh-hjem-card');
    c.setConfig({ type: 'custom:msh-hjem-card', card_id: 'hjem-a54' });
    c.hass = window.mockHass(); document.getElementById('dash').appendChild(c);
    await w(1500);
    const deep = (sel) => { const o = []; const x = (rt) => rt.querySelectorAll('*').forEach((e) => { if (e.matches(sel)) o.push(e); if (e.shadowRoot) x(e.shadowRoot); }); x(document); return o; };
    const hd = deep('msh-hjem-header-card')[0];
    const M = window.MSH, L = (window.__L = { renders: {}, opened: [], sted: [], removed: [], tEnd: [] });
    const orig = M.Card.prototype._render;
    M.Card.prototype._render = function () { if (L.live) L.renders[this.localName] = (L.renders[this.localName] || 0) + 1; return orig.apply(this, arguments); };
    // msh-hjem-card kan ha egen _render i kjeden – tell den også
    let base = customElements.get('msh-hjem-card').prototype;
    while (base && !Object.prototype.hasOwnProperty.call(base, '_render')) base = Object.getPrototypeOf(base);
    if (base && base !== M.Card.prototype) { const r0 = base._render; base._render = function () { if (L.live && this.localName === 'msh-hjem-card') L.renders['msh-hjem-card*'] = (L.renders['msh-hjem-card*'] || 0) + 1; return r0.apply(this, arguments); }; }
    window.open = (u) => { L.opened.push([u, performance.now(), !!window.__host()]); return null; };
    window.addEventListener('ki-sted-valgt', (e) => L.sted.push([e.detail.navn, performance.now(), !!window.__host()]));
    const ov = M.overlayRoot();
    new MutationObserver((ms) => ms.forEach((m) => m.removedNodes.forEach((n) => { if (n.classList && n.classList.contains('msh-servermeny')) L.removed.push(performance.now()); }))).observe(ov.shadowRoot || ov, { childList: true });
    window.__host = () => (ov.shadowRoot || ov).querySelector('.msh-servermeny');
    // rAF-sampler: menyens lag i hver ramme
    L.frames = [];
    const alpha = (c) => { const m = /rgba?\(([^)]+)\)/.exec(c) || /color\(srgb ([^)]+)\)/.exec(c); if (!m) return 1; const p = m[1].split(/[ ,/]+/).filter(Boolean); return p.length > 3 ? Number(p[3]) : 1; };
    const tick = () => {
      if (L.live) {
        const h = window.__host(), sr = h && h.shadowRoot, me = sr && sr.querySelector('.meny'), lag = sr && sr.querySelector('.lag');
        if (h && me) {
          const cm = getComputedStyle(me), cl = getComputedStyle(lag || me);
          const tf = cm.transform && cm.transform !== 'none' ? new DOMMatrix(cm.transform).a : 1;
          L.frames.push({ t: performance.now(), scale: +tf.toFixed(3), lagOp: +Number(cl.opacity).toFixed(3), menyOp: Number(cm.opacity), bg: cm.backgroundColor, bgA: alpha(cm.backgroundColor), bdf: cm.backdropFilter, an: cm.animationName, ut: me.classList.contains('ut') });
        } else L.frames.push({ t: performance.now(), none: true });
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    window.__hd = hd;
    const t = hd.shadowRoot.querySelector('.ttl .tx').getBoundingClientRect();
    return { x: t.left + t.width / 2, y: t.top + t.height / 2, perf: document.documentElement.getAttribute('data-ki-perf'), android: document.documentElement.classList.contains('ki-android') };
  });
  await S.cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
  const reset = () => S.p.evaluate(() => { const L = window.__L; Object.assign(L, { renders: {}, opened: [], sted: [], removed: [], frames: [], live: true, t0: performance.now() }); const h = window.__host(); if (h && h.shadowRoot && !h.shadowRoot.__te) { h.shadowRoot.__te = 1; h.shadowRoot.addEventListener('transitionend', (e) => { if (e.target.classList.contains('lag')) L.tEnd.push(performance.now()); }); } });
  const grab = () => S.p.evaluate(() => { const L = window.__L; L.live = false; return JSON.parse(JSON.stringify({ renders: L.renders, opened: L.opened, sted: L.sted, removed: L.removed, frames: L.frames, tEnd: L.tEnd, t0: L.t0 })); });
  const hookTE = () => S.p.evaluate(() => { const L = window.__L, h = window.__host(); if (h && h.shadowRoot && !h.shadowRoot.__te) { h.shadowRoot.__te = 1; h.shadowRoot.addEventListener('transitionend', (e) => { if (e.target.classList.contains('lag') && e.propertyName === 'opacity') L.tEnd.push(performance.now()); }); } L.tEnd = []; });
  const res = { box };
  // åpne
  await reset();
  await S.p.touchscreen.tap(box.x, box.y);
  await S.p.waitForTimeout(700);
  await hookTE();
  res.open = await grab();
  // lukk (trykk utenfor)
  await reset();
  await S.p.touchscreen.tap(200, 790);
  await S.p.waitForTimeout(700);
  res.close = await grab();
  // velg Toten, så Strømstad
  for (const navn of ['Toten', 'Strømstad']) {
    await S.p.touchscreen.tap(box.x, box.y);
    await S.p.waitForTimeout(600);
    await hookTE();
    const rad = await S.p.evaluate((navn) => { const r = [...window.__host().shadowRoot.querySelectorAll('.rad')].find((x) => x.textContent.includes(navn)); if (!r) return null; const b = r.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2, na: r.classList.contains('na') }; }, navn);
    await reset();
    if (rad) await S.p.touchscreen.tap(rad.x, rad.y);
    await S.p.waitForTimeout(1000);
    res['velg_' + navn] = { rad, ...(await grab()) };
  }
  await S.cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  res.errs = S.errs;
  await S.ctx.close();
  return res;
}

/* ------------------------------------------------------------------ A2 · Now Playing + navbar */
async function miniNav(ua) {
  const S = await page(ua);
  const st0 = await S.p.evaluate(async (ART) => {
    const w = (ms) => new Promise((q) => setTimeout(q, ms));
    const M = window.MSH, hass = window.mockHass(), now = Date.now();
    let St = { ...hass.states };
    Object.keys(St).filter((k) => k.startsWith('media_player.')).forEach((k) => { St[k] = { ...St[k], state: 'off' }; });
    const mk = (id, name, title, pic, ago) => ({ entity_id: id, state: 'playing', last_changed: new Date(now - ago).toISOString(), last_updated: new Date(now - ago).toISOString(), attributes: { friendly_name: name, media_title: title, media_artist: 'NRK', entity_picture: pic, volume_level: 0.3, supported_features: 152461, media_duration: 300, media_position: 10, media_position_updated_at: new Date().toISOString() } });
    St['media_player.kjokken_radio'] = mk('media_player.kjokken_radio', 'Kjøkken Radio', 'Randi Hansen - Søt sommer', ART[0], 1000);
    St['media_player.squeezebox_radio'] = mk('media_player.squeezebox_radio', 'Squeezebox Radio', 'Pour Some Sugar On Me', ART[1], 2000);
    const H = { ...hass, states: St };
    const nb = document.createElement('msh-navbar-card');
    nb.setConfig({ type: 'custom:msh-navbar-card', card_id: 'nav54', style: 'white', layout: 'mobil', mini: { players: ['media_player.kjokken_radio', 'media_player.squeezebox_radio'] } });
    nb.hass = H; document.getElementById('dash').appendChild(nb);
    window.__nb = nb;
    await w(1500);
    // media-hass-oppdateringer (som squeezebox' posisjon) og nytt omslag underveis
    window.__bump = (art) => {
      St = { ...St };
      ['media_player.kjokken_radio', 'media_player.squeezebox_radio'].forEach((id) => {
        const s = St[id], a = { ...s.attributes, media_position: (s.attributes.media_position || 0) + 1, media_position_updated_at: new Date().toISOString() };
        if (art && id === 'media_player.squeezebox_radio') a.entity_picture = art;
        St[id] = { ...s, attributes: a, last_updated: new Date().toISOString() };
      });
      nb.hass = { ...H, states: St };
    };
    const sr = document.querySelector('.msh-navbar-portal').shadowRoot;
    window.__sr = sr;
    const nav = sr.querySelector('nav.nb'), mini = sr.querySelector('.mini');
    const T = (window.__t = { live: false, navMuts: 0, navLog: [], rowMuts: 0, imgRepl: 0, dotChanges: [], srcChanges: [], decoded: new Map(), down: false, downs: [], ups: [], frames: 0, noNav: [], empty: [], lowOp: [], hBad: [], curFlip: [], cur0: null });
    window.__nav0 = nav;
    new MutationObserver((ms) => { if (!T.live) return; T.navMuts += ms.length; ms.slice(0, 3).forEach((m) => T.navLog.push([m.type, m.attributeName || '', (m.target.className || '') + ''])); }).observe(nav, { subtree: true, childList: true, attributes: true, characterData: true });
    new MutationObserver((ms) => {
      if (!T.live) return;
      for (const m of ms) {
        if (m.type === 'childList') {
          const nodes = [...m.addedNodes, ...m.removedNodes].filter((n) => n.nodeType === 1);
          if (nodes.some((n) => n.classList && n.classList.contains('mrow'))) T.rowMuts++;
          // et omslag som ble fjernet/erstattet (første innsetting i en tom .mimgw teller ikke)
          if ([...m.removedNodes].some((n) => n.localName === 'img' || (n.querySelector && n.querySelector('img')))) T.imgRepl++;
        } else if (m.type === 'attributes' && m.attributeName === 'class' && m.target.parentNode && m.target.parentNode.classList && m.target.parentNode.classList.contains('mdots')) {
          T.dotChanges.push({ t: performance.now(), down: T.down });
        } else if (m.type === 'attributes' && m.attributeName === 'src' && m.target.localName === 'img') {
          const src = m.target.getAttribute('src');
          T.srcChanges.push({ t: performance.now(), ok: T.decoded.has(src) && T.decoded.get(src) <= performance.now() });
        }
      }
    }).observe(mini, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'src'] });
    // decode() – når et bilde er ferdig dekodet
    const d0 = HTMLImageElement.prototype.decode;
    HTMLImageElement.prototype.decode = function () { const src = this.getAttribute('src'); return d0.call(this).then((v) => { T.decoded.set(src, performance.now()); return v; }); };
    window.addEventListener('pointerdown', () => { T.down = true; T.downs.push(performance.now()); T.cur0 = window.__nb._mCur; }, true);
    const up = () => { T.down = false; T.ups.push(performance.now()); };
    window.addEventListener('pointerup', up, true); window.addEventListener('pointercancel', up, true);
    // rAF-sampler
    const tick = () => {
      if (T.live) {
        T.frames++;
        const n = sr.querySelector('nav.nb'), mi = sr.querySelector('.mini');
        const nr = n && n.getBoundingClientRect(), ns = n && getComputedStyle(n);
        if (!n || n !== window.__nav0 || !n.isConnected || nr.height < 40 || ns.display === 'none' || ns.visibility === 'hidden' || Number(ns.opacity) < 1) T.noNav.push(Math.round(performance.now()));
        if (mi) {
          const mr = mi.getBoundingClientRect(), sw = mi.querySelector('.msw');
          // synlig innhold: en tittel med tekst eller et omslag som ligger (minst 24 px) innenfor kortet
          // klippet av både kortet (.mini) og scroll-containeren (.msw – den klipper der den står, også når den er flyttet)
          const wr = sw.getBoundingClientRect(), L0 = Math.max(mr.left, wr.left), R0 = Math.min(mr.right, wr.right);
          const inside = (e) => { const b = e.getBoundingClientRect(); return Math.min(b.right, R0) - Math.max(b.left, L0) >= 24 && b.width > 0; };
          const full = [...sw.querySelectorAll('.mtx b')].some((t) => t.textContent.trim() && inside(t)) || [...sw.querySelectorAll('img[src]')].some(inside);
          if (!full) T.empty.push(Math.round(performance.now()));
          const ops = [mi, sw, ...sw.children].map((e) => Number(getComputedStyle(e).opacity));
          if (ops.some((o) => o < 1)) T.lowOp.push(Math.round(performance.now()));
          if (Math.round(mi.offsetHeight) !== 64) T.hBad.push(mi.offsetHeight);
          if (T.down && T.cur0 != null && window.__nb._mCur !== T.cur0) T.curFlip.push(Math.round(performance.now()));
        }
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    const r = mini.getBoundingClientRect(), ns = getComputedStyle(nav), ms = getComputedStyle(mini);
    return { rows: mini.querySelectorAll('.mrow').length, names: [...mini.querySelectorAll('.mtx b')].map((b) => b.textContent), box: { x: r.left, y: r.top, w: r.width, h: r.height }, navTf: nav.style.transform, miniTf: mini.style.transform, navContain: ns.contain, miniContain: ms.contain, sib: nav.parentNode !== mini && !mini.contains(nav) && !nav.contains(mini), navR0: nb._navRenders, android: document.documentElement.classList.contains('ki-android'), perf: document.documentElement.getAttribute('data-ki-perf') };
  }, ART);
  if (!st0.android) { const out = { st0, errs: S.errs }; await S.ctx.close(); return out; }
  await S.cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
  const rows0 = await S.p.evaluate(() => { window.__rows0 = [...window.__sr.querySelectorAll('.mrow')]; window.__imgs0 = window.__rows0.map((r) => r.querySelector('img')); window.__t.live = true; return window.__rows0.length; });
  const per = [];
  const y = st0.box.y + st0.box.h / 2;
  for (let i = 0; i < SWIPES; i++) {
    const { cdp } = S, steps = 8, x0 = 300, dx = -160;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y }] });
    for (let k = 1; k <= steps; k++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + (dx * k) / steps, y }] });
      if (k === 4) await S.p.evaluate((a) => window.__bump(a), i === 6 ? ART[2] : i === 13 ? ART[1] : null); // media-oppdatering midt i sveipet
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await S.p.waitForTimeout(150);
    await S.p.evaluate(() => window.__bump());
    await S.p.waitForTimeout(500);
    per.push(await S.p.evaluate(() => { const sr = window.__sr, sw = sr.querySelector('.msw'), on = [...sr.querySelectorAll('.mdots button')].findIndex((b) => b.classList.contains('on')); return { idx: Math.round(sw.scrollLeft / (sw.clientWidth || 1)), dot: on, cur: window.__nb._mCur }; }));
  }
  await S.cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await S.p.waitForTimeout(400);
  const T = await S.p.evaluate(() => {
    const T = window.__t; T.live = false; 
    const rows = [...window.__sr.querySelectorAll('.mrow')];
    return { ...T, decoded: [...T.decoded.keys()].length, sameRows: rows.length === window.__rows0.length && rows.every((r, i) => r === window.__rows0[i]), sameImgs: rows.map((r) => r.querySelector('img')).every((im, i) => !window.__imgs0[i] || im === window.__imgs0[i]), navSame: window.__sr.querySelector('nav.nb') === window.__nav0 && window.__nav0.isConnected, navR: window.__nb._navRenders, order: rows.map((r) => r.dataset.mid), sqArt: (rows.find((r) => r.dataset.mid === 'media_player.squeezebox_radio').querySelector('img') || {}).src || '' };
  });
  const out = { st0, rows0, per, T, errs: S.errs };
  await S.ctx.close();
  return out;
}

const A1 = await stedvelger(ANDROID_UA);
const A2 = await miniNav(ANDROID_UA);
const D1 = await stedvelger(null);
const D2 = await miniNav(null);
await browser.close();
if (own) try { unlinkSync(bundle); } catch (e) { /* */ }

// ------------------------------------------------------------------ analyse
const o = A1.open.frames.filter((f) => !f.none), c = A1.close.frames;
const first = o[0] || {}, lastOpen = o[o.length - 1] || {};
const tFull = o.find((f) => f.lagOp >= 0.999 && f.scale >= 0.999);
const openMs = tFull && first.t ? Math.round(tFull.t - first.t) : null;
const allMenuFrames = [A1.open, A1.close, A1.velg_Toten, A1['velg_Strømstad']].flatMap((r) => r.frames.filter((f) => !f.none));
const notOpaque = allMenuFrames.filter((f) => f.bgA < 1 || f.bdf !== 'none' || f.menyOp < 1);
const cm = c.filter((f) => !f.none);
const closeFade = cm.some((f) => f.lagOp > 0.02 && f.lagOp < 0.98);
const rem = A1.close.removed[0], te = A1.close.tEnd[A1.close.tEnd.length - 1];
const vel = ['Toten', 'Strømstad'].map((n) => { const r = A1['velg_' + n]; return { n, rad: r.rad, renders: r.renders, opened: r.opened.length, sted: r.sted.map((x) => x[0]), removed: r.removed[0], openAt: r.opened[0] && r.opened[0][1], stedAt: r.sted[0] && r.sted[0][1], menyVedBytte: !!(r.opened[0] && r.opened[0][2]) || !!(r.sted[0] && r.sted[0][2]),  tEnd: r.tEnd[r.tEnd.length - 1] }; });
console.log(`\nFiks 54 · Android-UA · CPU ×${THROTTLE} · Ytelsesmodus ${A1.box.perf || 'av'}`);
console.log('A1 åpning (scale/lagOp per ramme):', o.slice(0, 12).map((f) => `${f.scale}/${f.lagOp}`).join(' '), '… varighet', openMs, 'ms');
console.log('A1 lukking (lagOp per ramme):', cm.map((f) => f.lagOp).join(' '), '· transitionend', te && rem ? `${Math.round(rem - te)} ms før fjerning` : '–');
console.log('A1 bakgrunnslag:', JSON.stringify({ bg: first.bg, bdf: first.bdf, menyOp: first.menyOp }));
console.log('A1 valg:', JSON.stringify(vel));
console.log('A2:', JSON.stringify(A2.st0));
const T = A2.T || {};
console.log(`A2 · ${SWIPES} sveip · ${T.frames} rammer · navbar: tegninger ${(T.navR || 0) - (A2.st0.navR0 || 0)} (etter oppstart), DOM-endringer ${T.navMuts}, borte i ${(T.noNav || []).length} rammer · tomt kort ${(T.empty || []).length} · opasitet<1 ${(T.lowOp || []).length} · høyde≠64 ${(T.hBad || []).length}`);
console.log(`A2 · rader byttet ${T.rowMuts} · omslag byttet ut ${T.imgRepl} · src-endringer ${(T.srcChanges || []).length} (før decode: ${(T.srcChanges || []).filter((x) => !x.ok).length}) · prikker endret mens fingeren var nede ${(T.dotChanges || []).filter((d) => d.down).length}/${(T.dotChanges || []).length} · aktiv spiller byttet under gesten ${(T.curFlip || []).length}`);
console.log('A2 etter hvert sveip (indeks/prikk):', (A2.per || []).map((r) => `${r.idx}/${r.dot}`).join(' '));
if (T.navLog && T.navLog.length) console.log('Navbar-endringer:', JSON.stringify(T.navLog.slice(0, 6)));
console.log('Standard-UA:', JSON.stringify({ an: (D1.open.frames.find((f) => !f.none) || {}).an, navTf: D2.st0.navTf, android: D2.st0.android }));
const errs = [...A1.errs, ...A2.errs, ...D1.errs, ...D2.errs];
if (errs.length) console.log('Sidefeil:', errs.slice(0, 5));

if (own) {
  const out = [];
  const ok = (n, cond, i) => out.push(`${cond ? '✔' : '✘'} ${n}${i != null ? ' · ' + JSON.stringify(i).slice(0, 400) : ''}`);
  ok('Android: ki-android', A1.box.android && A2.st0.android);
  ok('A1 åpning: bakgrunnslaget scale(.96) → 1 og indre lag opasitet 0 → 1 (ikke ett bilde)', first.scale <= 0.985 && first.lagOp <= 0.6 && lastOpen.scale === 1 && lastOpen.lagOp === 1 && o.filter((f) => f.lagOp < 1).length >= 2, o.slice(0, 6));
  ok('A1 åpning varer ~160 ms (110–320 ms med CPU ×6)', openMs != null && openMs >= 110 && openMs <= 320, openMs);
  ok('A1 bakgrunnslaget er helt dekkende i hver ramme: alfa 1, ingen backdrop-filter, egen opasitet 1', allMenuFrames.length > 10 && !notOpaque.length, notOpaque.slice(0, 3));
  ok('A1 bakgrunn = var(--ki-surface-2, #3a3a3a)', /rgb\(58, 58, 58\)/.test(first.bg), first.bg);
  ok('A1 ingen keyframe-animasjon på Android (overganger på lagene)', allMenuFrames.every((f) => f.an === 'none'), [...new Set(allMenuFrames.map((f) => f.an))]);
  ok('A1 lukking: bare det indre laget fades', closeFade && cm.every((f) => f.menyOp === 1 && f.bgA === 1), cm.map((f) => f.lagOp));
  ok('A1 lukking: verten fjernes først etter transitionend', !!rem && !!te && rem >= te - 1, { rem, te });
  ok('A1 lukking: ingen ramme med meny etter fjerning / menyen borte', c.length > 0 && c[c.length - 1].none, c.slice(-2));
  vel.forEach((v) => {
    const full = (v.renders['msh-hjem-card'] || 0) + (v.renders['msh-hjem-card*'] || 0) + (v.renders['msh-hjem-header-card'] || 0);
    ok(`A1 velg ${v.n}: msh-hjem-card/headeren tegnes ikke på nytt (0 _render)`, !!v.rad && !v.rad.na && full === 0, v.renders);
    ok(`A1 velg ${v.n}: stedsbyttet (window.open) og ki-sted-valgt først etter at menyen er fjernet`, v.opened === 1 && v.sted[0] === v.n && !!v.removed && !v.menyVedBytte && v.openAt >= v.tEnd - 1, v);
  });
  ok('A2 2 spillere: Kjøkken Radio + Squeezebox Radio', A2.st0.rows === 2 && A2.st0.names.join() === 'Kjøkken Radio,Squeezebox Radio', A2.st0.names);
  ok('A2 navbar og mini-spiller er søsken, hver med contain: layout paint + translateZ(0)', A2.st0.sib && /layout/.test(A2.st0.navContain) && /paint/.test(A2.st0.navContain) && /layout/.test(A2.st0.miniContain) && /paint/.test(A2.st0.miniContain) && /translateZ\(0(px)?\)/.test(A2.st0.navTf) && /translateZ\(0(px)?\)/.test(A2.st0.miniTf), A2.st0);
  ok('A2 navbaren: samme node og 0 tegninger under sveip + media-oppdateringer', T.navSame && T.navR === A2.st0.navR0, { same: T.navSame, r0: A2.st0.navR0, r: T.navR });
  ok('A2 navbaren: 0 DOM-endringer (attributter/noder)', T.navMuts === 0, T.navLog);
  ok('A2 navbaren finnes og er synlig i hver ramme', T.frames > 100 && !T.noNav.length, { frames: T.frames, borte: T.noNav.slice(0, 5) });
  ok('A2 mini-kortet er aldri tomt (art eller tekst i hver ramme)', !T.empty.length, T.empty.slice(0, 5));
  ok('A2 ingen opasitet < 1 på kortet/radene', !T.lowOp.length, T.lowOp.slice(0, 5));
  ok('A2 høyden er 64 px i hver ramme', !T.hBad.length, T.hBad.slice(0, 5));
  ok('A2 spillerkortene og omslagene erstattes ikke', T.rowMuts === 0 && T.sameRows && T.imgRepl === 0 && T.sameImgs, { rowMuts: T.rowMuts, sameRows: T.sameRows, imgRepl: T.imgRepl, sameImgs: T.sameImgs });
  ok('A2 ny art-src settes først etter img.decode()', T.srcChanges.length >= 2 && T.srcChanges.every((x) => x.ok) && T.sqArt.startsWith('data:image/svg'), { n: T.srcChanges.length, bad: T.srcChanges.filter((x) => !x.ok).length });
  ok('A2 prikkene endres bare ved slutten av gesten', T.dotChanges.length >= SWIPES && !T.dotChanges.some((d) => d.down), { n: T.dotChanges.length, down: T.dotChanges.filter((d) => d.down).length });
  ok('A2 aktiv spiller byttes ikke mens fingeren er nede', !T.curFlip.length, T.curFlip.slice(0, 3));
  const exp = (A2.per || []).map((_, i) => (i + 1) % 2);
  ok('A2 riktig spiller fremme etter hvert sveip (scrollLeft + prikk + _mCur)', A2.per.every((r, i) => r.idx === exp[i] && r.dot === exp[i] && r.cur === T.order[exp[i]]), A2.per.map((r) => [r.idx, r.dot]));
  ok('standard-UA (iOS/PC): menyen har keyframe-animasjonen som før, ingen ki-android/translateZ(0)', !D2.st0.android && (D1.open.frames.find((f) => !f.none) || {}).an === 'kimeny' && !/translateZ/.test(D2.st0.navTf || ''), { an: (D1.open.frames.find((f) => !f.none) || {}).an, navTf: D2.st0.navTf });
  ok('ingen sidefeil', !errs.length, errs.slice(0, 3));
  console.log('\n' + out.join('\n'));
  if (out.some((x) => x.startsWith('✘'))) process.exit(1);
}
