// Fiks 53 A · flimmer på Android når man sveiper mellom spillerne i Now Playing-baren (mini-spilleren).
// Android-UA (Pixel 6a), 390×844 touch, CPU-struping ×6, glass-navbar, Ytelsesmodus AV (blur på – verste tilfelle),
// 4 spillere som spiller. A53_SWIPES (20) sveip mellom spillerne (venstre = neste, rundt; høyre er «Fjern»-gesten fra
// Fiks 35/50, så «frem og tilbake» = hele runden flere ganger) med ekte berøring (CDP touch):
//  · ingen _render av navbaren/mini-spilleren og ingen DOM-endring (innerHTML/childList, <img>/art) fra berøring til
//    sveipet er ferdig animert – tilstanden (aktiv spiller, prikker) skrives først etterpå
//  · blur-laget står stille: .mini har ikke backdrop-filter (blur ligger på .mini::before med translateZ(0)), raden
//    (.msw) er gjennomsiktig uten blur, og .mini (blur-laget) flytter seg ikke under sveipet; navbar og mini-spiller er
//    egne lag (isolation: isolate; contain: paint)
//  · prikkene animerer bare transform/opasitet (ikke width)
//  · <img> i mini-spilleren har faste width/height og decoding="async"
//  · skjermbilder (screencast): ingen ramme der mini-spilleren er blank (ren hvit/svart eller uten innhold)
//  · etter alle sveipene står riktig spiller fremme (prikk + scrollLeft)
//  · standard-UA (iOS/PC): ingen ::before-blur, .mini har backdrop-filter som før
// Kjør: node test/android53-check.mjs   (A53_BUNDLE=<fil> måler en ferdig bundel uten krav)
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { readdirSync, mkdirSync, unlinkSync } from 'node:fs';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const R = resolve('.') + '/';
mkdirSync('test/.build', { recursive: true });
const own = !process.env.A53_BUNDLE;
const bundle = own ? resolve(`test/.build/and53-${process.pid}.js`) : resolve(process.env.A53_BUNDLE);
if (own) execFileSync('node', ['build.mjs', bundle], { cwd: R, stdio: 'inherit' });
const SWIPES = Number(process.env.A53_SWIPES || 20);
const THROTTLE = Number(process.env.A53_THROTTLE || 6);
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 13; Pixel 6a) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';
const mocks = readdirSync(R + 'test/mock').filter((f) => f.endsWith('.js')).sort().map((f) => R + 'test/mock/' + f);
const browser = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => pw.chromium.launch());
const ART = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#5a7"/><circle cx="32" cy="32" r="14" fill="#fff"/></svg>');

async function setup(ua) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, ...(ua ? { userAgent: ua } : {}) });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.addInitScript(() => { try { localStorage.setItem('ki-perf', 'full'); sessionStorage.clear(); } catch (e) { /* */ } });
  await page.goto('file://' + R + 'test/harness.html');
  for (const m of mocks) await page.addScriptTag({ path: m });
  await page.addScriptTag({ path: bundle });
  await page.evaluate(async (ART) => {
    const M = window.MSH, hass = window.mockHass(), S = hass.states, now = Date.now();
    const ids = Object.keys(S).filter((k) => k.startsWith('media_player.'));
    ids.forEach((k) => { S[k] = { ...S[k], state: 'off' }; });
    const P = ids.slice(0, 4);
    P.forEach((k, i) => { S[k] = { ...S[k], state: 'playing', last_changed: new Date(now - i * 1000).toISOString(), attributes: { ...S[k].attributes, media_title: 'Spor ' + (i + 1), media_artist: 'Artist ' + (i + 1), ...(i % 2 ? { entity_picture: ART } : {}) } }; });
    window.__P = P;
    const nb = document.createElement('msh-navbar-card');
    nb.setConfig({ type: 'custom:msh-navbar-card', card_id: 'nav53', style: 'glass', layout: 'mobil' });
    nb.hass = hass; document.getElementById('dash').appendChild(nb);
    window.__nb = nb;
    const T = (window.__t = { live: false, renders: 0, muts: 0, imgMuts: 0, log: [] });
    const orig = M.Card.prototype._render;
    M.Card.prototype._render = function () { if (T.live && this.localName === 'msh-navbar-card') { T.renders++; T.log.push(['render', Math.round(performance.now() - T.t0)]); } return orig.call(this); };
    await new Promise((r) => setTimeout(r, 1200));
    const sr = document.querySelector('.msh-navbar-portal').shadowRoot;
    window.__sr = sr;
    new MutationObserver((list) => {
      if (!T.live) return;
      for (const m of list) {
        if (m.type !== 'childList') continue;
        T.muts++;
        if ([...m.addedNodes, ...m.removedNodes].some((n) => n.nodeType === 1 && (n.localName === 'img' || (n.querySelector && n.querySelector('img'))))) T.imgMuts++;
        T.log.push(['dom', Math.round(performance.now() - T.t0), (m.target.className || m.target.localName || '') + '']);
      }
    }).observe(sr, { childList: true, subtree: true });
  }, ART);
  const cdp = await ctx.newCDPSession(page);
  return { ctx, page, cdp, errs };
}

let decoder = null;
async function analyse(frames, box) {
  if (!decoder) { const c = await browser.newContext(); decoder = await c.newPage(); }
  return decoder.evaluate(async ([frames, box]) => {
    const out = [];
    for (const f of frames) {
      const bm = await createImageBitmap(await (await fetch('data:image/png;base64,' + f)).blob());
      const cv = new OffscreenCanvas(bm.width, bm.height), cx = cv.getContext('2d'); cx.drawImage(bm, 0, 0);
      const k = bm.width / 390, d = cx.getImageData(Math.round(box.x * k), Math.round(box.y * k), Math.round(box.w * k), Math.round(box.h * k)).data;
      let w = 0, b = 0, n = 0, s = 0, s2 = 0;
      for (let i = 0; i < d.length; i += 8) { const v = (d[i] + d[i + 1] + d[i + 2]) / 3; n++; s += v; s2 += v * v; if (d[i] >= 250 && d[i + 1] >= 250 && d[i + 2] >= 250) w++; if (d[i] <= 3 && d[i + 1] <= 3 && d[i + 2] <= 3) b++; }
      const m = s / n; out.push({ white: w / n, black: b / n, std: Math.sqrt(Math.max(0, s2 / n - m * m)) });
    }
    return out;
  }, [frames, box]);
}

async function swipe(S, x0, y, dx) {
  const { cdp } = S, steps = 8;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y }] });
  for (let i = 1; i <= steps; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + (dx * i) / steps, y }] }); }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

// --- Android
const S = await setup(ANDROID_UA);
const st0 = await S.page.evaluate(() => {
  const sr = window.__sr, mini = sr.querySelector('.mini'), sw = sr.querySelector('.msw'), nav = sr.querySelector('nav.nb');
  const cs = getComputedStyle(mini), b4 = getComputedStyle(mini, '::before'), ns = getComputedStyle(nav), ws = getComputedStyle(sw);
  const dot = sr.querySelector('.mdots button span'), ds = dot && getComputedStyle(dot);
  const imgs = [...mini.querySelectorAll('img')].map((i) => ({ w: i.getAttribute('width'), h: i.getAttribute('height'), dec: i.getAttribute('decoding') }));
  const r = mini.getBoundingClientRect();
  return { rows: sw.children.length, miniBdf: cs.backdropFilter, beforeBdf: b4.backdropFilter, beforeTf: b4.transform, miniIso: cs.isolation, miniContain: cs.contain, navIso: ns.isolation, navContain: ns.contain, rowBdf: ws.backdropFilter, rowBg: ws.backgroundColor, dotTp: ds ? ds.transitionProperty : null, imgs, box: { x: r.left, y: r.top, w: r.width, h: r.height }, android: document.documentElement.classList.contains('ki-android') };
});
await S.cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
const per = [];
const frames = [];
const onFrame = (f) => { frames.push(f.data); S.cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {}); };
S.cdp.on('Page.screencastFrame', onFrame);
await S.cdp.send('Page.startScreencast', { format: 'png', everyNthFrame: 2 });
for (let i = 0; i < SWIPES; i++) {
  await S.page.evaluate(() => {
    const T = window.__t, mini = window.__sr.querySelector('.mini');
    T.t0 = performance.now(); T.live = true; T.renders = 0; T.muts = 0; T.imgMuts = 0; T.log = []; T.moves = 0; T.done = false;
    const r0 = mini.getBoundingClientRect(); T.r0 = [r0.left, r0.top];
    // blur-laget (.mini) skal stå stille mens raden flytter seg
    const tick = () => { if (!T.live) return; const r = mini.getBoundingClientRect(); if (Math.abs(r.left - T.r0[0]) > 0.5 || Math.abs(r.top - T.r0[1]) > 0.5) T.moves++; requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
  await swipe(S, 300, st0.box.y + st0.box.h / 2, -160);
  // målevindu: berøring → slipp + 120 ms (glidningen etter slipp går med transform; tilstanden skrives etter 270 ms)
  await S.page.waitForTimeout(120);
  const mid = await S.page.evaluate(() => { const T = window.__t; return { renders: T.renders, muts: T.muts, imgMuts: T.imgMuts, moves: T.moves, log: T.log.slice(0, 6) }; });
  await S.page.evaluate(() => { window.__t.live = false; });
  await S.page.waitForTimeout(900);
  const after = await S.page.evaluate(() => { const sr = window.__sr, sw = sr.querySelector('.msw'), on = [...sr.querySelectorAll('.mdots button')].findIndex((b) => b.classList.contains('on')); return { idx: Math.round(sw.scrollLeft / (sw.clientWidth || 1)), dot: on, cur: window.__nb._mCur, tf: getComputedStyle(sw).transform }; });
  per.push({ ...mid, ...after });
}
await S.cdp.send('Page.stopScreencast');
await S.cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
const order = await S.page.evaluate(() => [...window.__sr.querySelectorAll('.msw .mrow')].map((r) => r.dataset.mid));
const pix = await analyse(frames.slice(0, 160), { x: st0.box.x + 4, y: st0.box.y + 4, w: st0.box.w - 8, h: st0.box.h - 8 });
await S.ctx.close();
// --- standard-UA
const D = await setup(null);
const def = await D.page.evaluate(() => { const sr = window.__sr, mini = sr.querySelector('.mini'); const b4 = getComputedStyle(mini, '::before'); return { miniBdf: getComputedStyle(mini).backdropFilter, before: b4.content, beforeBdf: b4.backdropFilter, android: document.documentElement.classList.contains('ki-android') }; });
await D.ctx.close();
await browser.close();
if (own) try { unlinkSync(bundle); } catch (e) { /* */ }

const sum = (k) => per.reduce((a, r) => a + r[k], 0);
console.log(`\nFiks 53 · Android-UA · CPU ×${THROTTLE} · ${st0.rows} spillere · ${SWIPES} sveip`);
console.log('Oppsett (Android):', JSON.stringify(st0));
console.log(`Under sveip: navbar-tegninger ${sum('renders')} · DOM-endringer ${sum('muts')} (art/<img> ${sum('imgMuts')}) · rammer der blur-laget flyttet seg ${sum('moves')}`);
console.log('Etter hvert sveip (indeks/prikk):', per.map((r) => `${r.idx}/${r.dot}`).join(' '));
const blank = pix.filter((f) => f.white > 0.5 || f.black > 0.5 || f.std < 4);
console.log(`Skjermbilder: ${pix.length} rammer · ${blank.length} blanke`, blank.slice(0, 3));
console.log('Standard-UA:', JSON.stringify(def));
if (per.some((r) => r.log.length)) console.log('Logg (første):', JSON.stringify(per.find((r) => r.log.length).log));
if (S.errs.length || D.errs.length) console.log('Sidefeil:', [...S.errs, ...D.errs].slice(0, 5));

if (own) {
  const out = [];
  const ok = (n, c, i) => out.push(`${c ? '✔' : '✘'} ${n}${i != null ? ' · ' + JSON.stringify(i).slice(0, 400) : ''}`);
  ok('3+ spillere i mini-spilleren', st0.rows >= 3, st0.rows);
  ok('ki-android', st0.android);
  ok('ingen tegning av navbaren/mini-spilleren under sveipet', sum('renders') === 0, per.map((r) => r.renders));
  ok('ingen DOM-endring (innerHTML/art) under sveipet', sum('muts') === 0, per.filter((r) => r.muts).map((r) => r.log).slice(0, 2));
  ok('blur-laget står stille (.mini flytter seg ikke under sveipet)', sum('moves') === 0, per.map((r) => r.moves));
  ok('blur på eget fast lag: .mini uten backdrop-filter, ::before med blur + translateZ(0)', st0.miniBdf === 'none' && st0.beforeBdf !== 'none' && /matrix|translateZ|matrix3d/.test(st0.beforeTf), st0);
  ok('raden er gjennomsiktig uten backdrop-filter', st0.rowBdf === 'none' && /rgba\(0, 0, 0, 0\)|transparent/.test(st0.rowBg), [st0.rowBdf, st0.rowBg]);
  ok('navbar og mini-spiller er egne lag (isolation: isolate; contain: paint)', st0.miniIso === 'isolate' && /paint/.test(st0.miniContain) && st0.navIso === 'isolate' && /paint/.test(st0.navContain), st0);
  ok('prikkene animerer bare transform/opasitet', !!st0.dotTp && st0.dotTp.split(',').every((p) => /^\s*(opacity|transform)\s*$/.test(p)), st0.dotTp);
  ok('<img> med faste width/height og decoding="async"', st0.imgs.length > 0 && st0.imgs.every((i) => i.w && i.h && i.dec === 'async'), st0.imgs);
  const n = st0.rows, exp = per.map((_, i) => (i + 1) % n);
  ok('riktig spiller fremme etter hvert sveip (scrollLeft + prikk + _mCur)', per.every((r, i) => r.idx === exp[i] && r.dot === exp[i] && r.cur === order[exp[i]] && (r.tf === 'none' || /matrix\(1, 0, 0, 1, 0, 0\)/.test(r.tf))), per.map((r) => [r.idx, r.dot, r.tf]));
  ok('skjermbilder: ingen blank ramme i mini-spilleren', pix.length > 0 && !blank.length, { rammer: pix.length, blanke: blank.length });
  ok('standard-UA uendret: .mini har backdrop-filter, ingen ::before-blur', !def.android && def.miniBdf !== 'none' && (def.before === 'none' || def.beforeBdf === 'none'), def);
  ok('ingen sidefeil', !S.errs.length && !D.errs.length, [...S.errs, ...D.errs].slice(0, 3));
  console.log('\n' + out.join('\n'));
  if (out.some((x) => x.startsWith('✘'))) process.exit(1);
}
