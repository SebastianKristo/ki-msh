// Fiks 35.3 · mini-spilleren: sveip for å fjerne (i tillegg til hold på play + kryss), med touch (CDP).
//  · sveip ned < 56 px fjærer tilbake, > 56 px / rask fling → glir ut og skjules (alle spillere) + «Angre»
//  · venstre → høyre (første spiller): > 40 px → 1/3 ut + rødt felt (søppel + «Fjern») + toast; trykk «Fjern» / sveip igjen
//    > 24 px → skjult; trykk på spilleren / sveip tilbake → lukker; langt sveip (> 60 %) → skjult direkte
//  · sveip venstre = neste spiller; på spiller 2 (pan-x) gir sveip høyre vanlig rulling, ikke «Fjern»
//  · utvidet spiller: sveip ned lukker utvidelsen, skjuler ikke
//  · siden scroller ikke under sveipet; haptic selection/medium; mørk + lys, standard + glass
// Kjør: node test/mini35-check.mjs
import { createRequire } from 'node:module';
import { readdirSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
mkdirSync('test/.build', { recursive: true });
const bundle = resolve(`test/.build/mini35-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const res = [];
const ok = (name, cond, info) => res.push(`${cond ? '✔' : '✘'} ${name}${info != null ? ' · ' + JSON.stringify(info) : ''}`);
const SHOT = process.env.SHOT_DIR;

async function setup(cfg, { dark = true, two = false } = {}) {
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + resolve('test/harness.html'));
  for (const m of readdirSync('test/mock').sort()) await p.addScriptTag({ path: resolve('test/mock/' + m) });
  await p.addScriptTag({ path: bundle });
  await p.evaluate(async ({ cfg, dark, two }) => {
    try { sessionStorage.clear(); } catch (e) { /* */ }
    window.deepAll = (sel) => { const out = []; const walk = (root) => root.querySelectorAll('*').forEach((e) => { if (e.matches(sel)) out.push(e); if (e.shadowRoot) walk(e.shadowRoot); }); walk(document); return out; };
    window.deep = (sel) => window.deepAll(sel)[0] || null;
    window.__hap = []; window.addEventListener('haptic', (e) => window.__hap.push(e.detail));
    window.__toasts = []; const T = window.MSH.toast; window.MSH.toast = (t, o) => { window.__toasts.push(t); return T(t, o); };
    const H = window.mockHass(); H.themes = { ...(H.themes || {}), darkMode: dark }; window.H = H;
    const S = H.states;
    Object.keys(S).filter((k) => k.startsWith('media_player.')).forEach((k) => { S[k] = { ...S[k], state: 'off' }; });
    S['media_player.kjokken_radio'] = { ...S['media_player.kjokken_radio'], state: 'playing', last_changed: new Date().toISOString() };
    if (two) S['media_player.stue_sonos'] = { ...S['media_player.stue_sonos'], state: 'playing', last_changed: new Date(Date.now() - 60000).toISOString() };
    document.getElementById('dash').style.height = '3000px';
    const c = document.createElement('msh-navbar-card'); c.setConfig({ type: 'custom:msh-navbar-card', card_id: 'ki-navbar', ...cfg }); c.hass = H;
    document.getElementById('dash').appendChild(c);
    await new Promise((q) => setTimeout(q, 800));
  }, { cfg, dark, two });
  const cdp = await p.context().newCDPSession(p);
  return { p, errs, cdp };
}
const st = (p) => p.evaluate(() => {
  const m = deep('[data-mini]'), f = deep('[data-mrmf]'), u = deep('[data-mundo] button'), sw = m && m.querySelector('.msw');
  const cs = m && getComputedStyle(m);
  return { off: !m || m.classList.contains('off'), mx: m ? parseFloat(m.style.getPropertyValue('--mx')) || 0 : 0, my: m ? parseFloat(m.style.getPropertyValue('--my')) || 0 : 0, w: m ? m.offsetWidth : 0,
    field: !!(f && f.classList.contains('on')), fop: f ? getComputedStyle(f).opacity : null, undo: u ? u.textContent : null, exp: !!(m && m.classList.contains('exp')),
    sl: sw ? Math.round(sw.scrollLeft) : 0, cw: sw ? sw.clientWidth : 0, ta: sw ? getComputedStyle(sw).touchAction : null, hid: !!sessionStorage.getItem('ki:mini:hidden'), op: cs && cs.opacity,
    scrollY: window.scrollY, hash: location.hash };
});
// første synlige treff (radene i sporet ligger ved siden av hverandre)
const box = (p, sel) => p.evaluate((s) => { const e = deepAll(s).find((x) => { const r = x.getBoundingClientRect(); return r.width && r.left >= -1 && r.right <= innerWidth + 1; }) || deep(s); if (!e) return null; const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height }; }, sel);
// sveip med touch: fra (x,y) med (dx,dy) i n steg à ms
const swipe = async (S, x, y, dx, dy, n = 8, ms = 25, wait = 450) => {
  await S.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  for (let i = 1; i <= n; i++) { await S.cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + (dx * i) / n, y: y + (dy * i) / n }] }); await S.p.waitForTimeout(ms); }
  await S.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await S.p.waitForTimeout(wait);
};
const tapAt = async (S, x, y) => { await S.p.touchscreen.tap(x, y); await S.p.waitForTimeout(400); };
const undo = async (S) => { const u = await box(S.p, '[data-mundo] button'); if (u) await tapAt(S, u.l + u.w / 2, u.t + u.h / 2); await S.p.waitForTimeout(300); };
const hap = (p) => p.evaluate(() => { const h = window.__hap.slice(); window.__hap.length = 0; return h; });
// midten av teksten i raden (ikke knappene)
const rowPt = async (p) => { const r = await box(p, '[data-mini] .mtx'); return { x: r.l + 10, y: r.t + r.h / 2 }; };

/* ---------------- én spiller · mørk · standard */
{
  const S = await setup({});
  const { p } = S;
  let s = await st(p);
  ok('vises når noe spiller', !s.off, s);
  ok('sporet: touch-action none ved scroll-start', s.ta === 'none', s.ta);
  let pt = await rowPt(p);
  await p.evaluate(() => window.scrollTo(0, 200)); await p.waitForTimeout(800);
  const y0 = (await st(p)).scrollY;
  pt = await rowPt(p);
  // kort sveip ned → fjærer tilbake
  await hap(p);
  await swipe(S, pt.x, pt.y, 0, 40, 8, 30);
  s = await st(p);
  ok('ned 40 px → fjærer tilbake', !s.off && s.my === 0 && !s.hid, s);
  ok('siden scroller ikke under sveipet', s.scrollY === y0, { y0, y: s.scrollY });
  // langt sveip ned → skjult + Angre
  await swipe(S, pt.x, pt.y, 0, 90, 8, 30);
  s = await st(p);
  let h = await hap(p);
  ok('ned 90 px → skjult (sessionStorage)', s.off && s.hid, s);
  ok('haptic selection ved terskel + medium ved fjern', h.includes('selection') && h.includes('medium'), h);
  ok('«Mini-spilleren er skjult · Angre»', /Mini-spilleren er skjult/.test(s.undo || '') && /Angre/.test(s.undo || ''), s.undo);
  ok('siden scroller ikke (ned)', s.scrollY === y0, s.scrollY);
  await undo(S);
  s = await st(p);
  ok('Angre → tilbake', !s.off && !s.hid && !s.undo, s);
  // fling: 30 px på ~20 ms
  pt = await rowPt(p);
  await swipe(S, pt.x, pt.y, 0, 34, 2, 8);
  s = await st(p);
  ok('rask fling ned (34 px) → skjult', s.off && s.hid, s);
  await undo(S);
  // delvis høyre → rødt felt + toast
  pt = await rowPt(p);
  await p.evaluate(() => { window.__toasts.length = 0; window.__calls.length = 0; });
  await swipe(S, pt.x, pt.y, 70, 0, 8, 30);
  s = await st(p);
  h = await hap(p);
  const toasts = await p.evaluate(() => window.__toasts.slice());
  ok('høyre 70 px → 1/3 ut + rødt felt', !s.off && Math.abs(s.mx - s.w / 3) < 2 && s.field && s.fop === '1', s);
  ok('toast «Vil du fjerne? Sveip igjen eller trykk Fjern»', toasts.includes('Vil du fjerne? Sveip igjen eller trykk Fjern'), toasts);
  ok('haptic selection ved 40 px', h.includes('selection'), h);
  const fld = await p.evaluate(() => { const f = deep('[data-mrmf]'), bt = f.querySelector('.mrmb'), cs = getComputedStyle(f); return { bg: cs.backgroundColor, fg: getComputedStyle(bt).color, txt: bt.textContent.trim(), icon: !!bt.querySelector('ha-icon[icon*="trash"]') }; });
  ok('rødt felt: var(--red), søppel-ikon + «Fjern»', fld.bg === 'rgb(242, 128, 115)' && fld.txt === 'Fjern' && fld.icon, fld);
  if (SHOT) await p.screenshot({ path: SHOT + '/mini35-fjern.png' });
  // trykk på spilleren → lukker (ingen #media, ingen play/pause)
  const mb = await box(p, '[data-mini]');
  await tapAt(S, mb.l + 40, mb.t + mb.h / 2);
  s = await st(p);
  ok('trykk på spilleren → lukker (ikke #media)', !s.off && s.mx === 0 && !s.field && s.hash !== '#media', s);
  // åpne igjen → trykk «Fjern»
  pt = await rowPt(p);
  await swipe(S, pt.x, pt.y, 60, 0, 8, 30);
  const fb = await box(p, '[data-mrmf] .mrmb');
  await tapAt(S, fb.l + fb.w / 2, fb.t + fb.h / 2);
  await p.waitForTimeout(200);
  s = await st(p); h = await hap(p);
  ok('«Fjern» → skjult', s.off && s.hid && !s.field, s);
  ok('haptic medium ved fjern', h.includes('medium'), h);
  await undo(S);
  // åpne → sveip igjen > 24 px
  pt = await rowPt(p);
  await swipe(S, pt.x, pt.y, 60, 0, 8, 30);
  pt = await rowPt(p);
  await swipe(S, pt.x, pt.y, 40, 0, 6, 30);
  s = await st(p);
  ok('sveip igjen (40 px) → skjult', s.off && s.hid, s);
  await undo(S);
  // åpne → sveip tilbake → lukker
  pt = await rowPt(p);
  await swipe(S, pt.x, pt.y, 60, 0, 8, 30);
  pt = await rowPt(p);
  await swipe(S, pt.x, pt.y, -50, 0, 6, 30);
  s = await st(p);
  ok('sveip tilbake → lukker', !s.off && s.mx === 0 && !s.field && !s.hid, s);
  // langt sveip > 60 % → skjult direkte
  pt = await rowPt(p);
  await swipe(S, pt.x, pt.y, Math.round(s.w * 0.7), 0, 10, 25);
  s = await st(p);
  ok('langt sveip (70 %) → skjult direkte', s.off && s.hid, s);
  await undo(S);
  // hold på play + kryss finnes fortsatt (19.7: hold → skjult)
  const pp = await box(p, '[data-mini] .mpp');
  await S.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pp.l + pp.w / 2, y: pp.t + pp.h / 2 }] }); await p.waitForTimeout(800);
  await S.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(400);
  s = await st(p);
  ok('hold på play skjuler fortsatt (som før)', s.off && s.hid, s);
  await p.evaluate(() => { sessionStorage.clear(); const nb = deep('msh-navbar-card'); nb._schedule(true); }); await p.waitForTimeout(500);
  ok('tilbake etter at skjulingen er nullstilt', !(await st(p)).off);
  // sveip ned på play-knappen = samme som ned ellers
  const pp2 = await box(p, '[data-mini] .mpp');
  await swipe(S, pp2.l + pp2.w / 2, pp2.t + pp2.h / 2, 0, 90, 8, 30);
  s = await st(p);
  ok('sveip ned fra play-knappen → skjult', s.off && s.hid, s);
  ok('ingen sidefeil (mørk)', !S.errs.length, S.errs);
  await p.close();
}

/* ---------------- to spillere: venstre = neste, utvidet + ned */
{
  const S = await setup({}, { two: true });
  const { p } = S;
  let s = await st(p);
  const pt = await rowPt(p);
  await swipe(S, pt.x + 150, pt.y, -140, 0, 8, 30, 700);
  s = await st(p);
  ok('sveip venstre → neste spiller', s.cw && Math.round(s.sl / s.cw) === 1 && !s.field && !s.off, s);
  ok('spiller 2: touch-action pan-x', /pan-x/.test(s.ta || ''), s.ta);
  await swipe(S, pt.x, pt.y, 140, 0, 8, 30, 700);
  s = await st(p);
  // pan-x: nettleseren ruller selv (CDP-touch ruller ikke alltid i hodeløs Chromium) – kravet er at «Fjern» ikke åpnes
  ok('spiller 2: sveip høyre gir ikke «Fjern» (vanlig rulling)', !s.field && !s.off && !s.hid && s.mx === 0, s);
  await p.evaluate(() => { const sw = deep('.msw'); sw.scrollLeft = 0; }); await p.waitForTimeout(400);
  // utvid (sveip opp på play), sveip ned lukker utvidelsen uten å skjule
  let pp = await box(p, '[data-mini] .mpp');
  await swipe(S, pp.l + pp.w / 2, pp.t + pp.h / 2, 0, -60, 6, 30);
  s = await st(p);
  ok('sveip opp på play → utvidet', s.exp, s);
  const xt = await box(p, '[data-mini] .mxt .mtx');
  if (xt) await swipe(S, xt.l + 10, xt.t + xt.h / 2, 0, 80, 8, 30);
  s = await st(p);
  ok('utvidet: sveip ned lukker utvidelsen, skjuler ikke', !s.exp && !s.off && !s.hid, s);
  ok('ingen sidefeil (to spillere)', !S.errs.length, S.errs);
  await p.close();
}

/* ---------------- lys modus · standard og glass */
const lum = (c) => { const m = c.match(/[\d.]+/g).map(Number); const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]); };
const cr = (a, b2) => { const x = lum(a), y = lum(b2); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
for (const style of ['white', 'glass']) {
  const S = await setup(style === 'glass' ? { style: 'glass' } : {}, { dark: false });
  const { p } = S;
  const theme = await p.evaluate(() => document.documentElement.getAttribute('data-ki-theme'));
  let pt = await rowPt(p);
  await swipe(S, pt.x, pt.y, 60, 0, 8, 30);
  let s = await st(p);
  const c = await p.evaluate(() => { const f = deep('[data-mrmf]'), bt = f.querySelector('.mrmb'), m = deep('[data-mini]'); return { fbg: getComputedStyle(f).backgroundColor, ffg: getComputedStyle(bt).color, mfg: getComputedStyle(m).color, mbg: getComputedStyle(m).backgroundColor }; });
  ok(`lys ${style}: «Fjern» avdekket`, theme === 'light' && s.field && Math.abs(s.mx - s.w / 3) < 2, { theme, s });
  ok(`lys ${style}: tekst på rødt ≥ 4,5:1 (--ki-on-accent)`, cr(c.fbg, c.ffg) >= 4.5, { ...c, cr: cr(c.fbg, c.ffg).toFixed(2) });
  ok(`lys ${style}: mini-spillerens tekst er mørk`, lum(c.mfg) < 0.05, c);
  if (SHOT) await p.screenshot({ path: SHOT + `/mini35-lys-${style}.png` });
  const fb = await box(p, '[data-mrmf] .mrmb');
  await tapAt(S, fb.l + fb.w / 2, fb.t + fb.h / 2);
  await p.waitForTimeout(200);
  s = await st(p);
  const u = await p.evaluate(() => { const bt = deep('[data-mundo] button'); if (!bt) return null; const cs = getComputedStyle(bt); return { bg: cs.backgroundColor, fg: cs.color, a: getComputedStyle(bt.querySelector('b')).color }; });
  ok(`lys ${style}: skjult + Angre-pille`, s.off && !!u, { s, u });
  if (u && style === 'white') ok('lys: Angre-pille lys flate, mørk tekst, rosa «Angre» ≥ 4,5:1', cr(u.bg, u.fg) >= 4.5 && cr(u.bg, u.a) >= 4.5, { ...u, t: cr(u.bg, u.fg).toFixed(2), a: cr(u.bg, u.a).toFixed(2) });
  if (u && style === 'glass') ok('lys glass: Angre-pille mørk tekst', lum(u.fg) < 0.05, u);
  if (SHOT) await p.screenshot({ path: SHOT + `/mini35-lys-${style}-angre.png` });
  await undo(S);
  pt = await rowPt(p);
  await swipe(S, pt.x, pt.y, 0, 90, 8, 30);
  s = await st(p);
  ok(`lys ${style}: sveip ned skjuler`, s.off && s.hid, s);
  ok(`lys ${style}: ingen sidefeil`, !S.errs.length, S.errs);
  await p.close();
}
await b.close();
res.forEach((r) => console.log(r));
const bad = res.filter((r) => r.startsWith('✘')).length;
console.log(bad ? `mini35-check: ${bad} FEIL` : `mini35-check: OK (${res.length})`);
process.exit(bad ? 1 : 0);
