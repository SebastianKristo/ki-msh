// Fiks 56 G–L · Vær-popupen (#vaer, msh-vaer-card).   node test/vaer56-check.mjs   (SHOTS=<mappe> gir skjermbilder)
//   G: vertikalt sveip fra «Neste timer», døgnlisten og grafene scroller popupen (ekte touch-gester via CDP mot ekte Bubble Card)
//      og lukker den ikke; horisontalt sveip scroller timestripen; swipe-to-close fra headeren virker; touch-action per element
//   H: «Føles som» og «Sikt» – kilder i prioritert rekkefølge (config → attributt → autofunnet sensor → utregning/«Velg entitet»),
//      vindavkjøling/heat index, live oppdatering uten ny tegning av popupen, editorfeltene
//   I: fullskjerm innenfor dashbordflaten (mobil og PC med HA-sidebar), Bubble-oppsettet, header, innholdskolonne, bunnluft over
//      navbaren, «Skjul navbar i fullskjerm», «Ark» gir det gamle oppsettet
//   J/K: like høye fliser (minst 148 px), kompass 96 px, solkurve 44 px, bunnlinjene, måne (belysning/oppgang beregnet)
//   L: kortflaten per værtype (ett lag, blur 18 px), Android dekkende, fylte ikoner, døgnlistens gradient/skinne
//   G (lys modus): tekstkontrast på værflatene (sol, sky, regn, natt)
import { createRequire } from 'node:module';
import { readdirSync, existsSync, rmSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
mkdirSync('test/.build', { recursive: true });
const bundle = resolve(`test/.build/vaer56-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const BC = resolve('test/.vendor/bubble-card.js');
if (!existsSync(BC)) { mkdirSync('test/.vendor', { recursive: true }); execFileSync('curl', ['-sSL', '-o', BC, 'https://raw.githubusercontent.com/Clooos/Bubble-Card/main/dist/bubble-card.js']); }
const shots = process.env.SHOTS || '';
const mocks = readdirSync('test/mock').filter((f) => f.endsWith('.js')).sort().map((m) => resolve('test/mock/' + m));
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const res = {}, fail = [], errs = [];
const ok = (name, cond, info) => { res[name] = cond ? 'OK' : ['FEIL', info]; if (!cond) fail.push(name); };
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36 Home Assistant/2024.10';

/* ------------------------------------------------------------------ sider */
// Ekte Bubble Card (harness-bubble): popupen fra mal A + M.POPUP_FORCE['#vaer'] (som strategien), valgfritt navbar
async function bubble({ w = 390, h = 844, sb = 0, light = false, card = {}, nav = false, ua } = {}) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: w < 900, ...(ua ? { userAgent: ua } : {}) });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + resolve('test/harness-bubble.html'));
  for (const m of mocks) await p.addScriptTag({ path: m });
  await p.addScriptTag({ path: bundle });
  await p.addScriptTag({ path: BC, type: 'module' });
  await p.waitForFunction(() => customElements.get('bubble-card'), null, { timeout: 15000 });
  const cfg = await p.evaluate(async ({ sb, light, card, nav }) => {
    const wait = (ms) => new Promise((q) => setTimeout(q, ms));
    document.documentElement.style.setProperty('--sb', sb + 'px');
    const H = window.mockHass(); H.themes = { ...(H.themes || {}), darkMode: !light };
    window.__h = H;
    await MSH.store.load(H);
    if (nav) { const nb = document.createElement('msh-navbar-card'); const wr = document.createElement('div'); document.getElementById('dash').appendChild(wr); nb.setConfig({ type: 'custom:msh-navbar-card', card_id: 'nb' }); nb.hass = H; wr.appendChild(nb); window.__nb = nb; await wait(400); }
    const base = MSH.popupTemplateA({ name: 'Vær', icon: 'mdi:weather-partly-cloudy', hash: '#vaer', card: { type: 'custom:msh-vaer-card', card_id: 'pop-vaer', ...card } });
    const pop = MSH.POPUP_FORCE['#vaer'](base) || base;
    const bc = document.createElement('bubble-card'); bc.setConfig(pop); bc.hass = H; document.getElementById('dash').appendChild(bc);
    await wait(400); location.hash = '#vaer'; await wait(1700);
    if (MSH.theme && MSH.theme.update) MSH.theme.update(H);
    const all = []; const walk = (r) => r.querySelectorAll('*').forEach((e) => { all.push(e); if (e.shadowRoot && e.localName !== 'ha-icon') walk(e.shadowRoot); }); walk(document);
    window.__card = all.find((e) => e.localName === 'msh-vaer-card');
    window.__pop = all.find((e) => e.classList && e.classList.contains('bubble-pop-up') && !e.classList.contains('editor'));
    window.__C = window.__pop.querySelector('.bubble-pop-up-container');
    await wait(300);
    return { margin: pop.margin_top_mobile, md: pop.margin_top_desktop, wd: pop.width_desktop, op: pop.bg_opacity, blur: pop.bg_blur };
  }, { sb, light, card, nav });
  return { p, ctx, cfg };
}
// Enkel harness (falsk popup, raskere): kort med config, valgfritt endret weather-state
async function simple({ w = 390, h = 900, ua, light = false } = {}) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: true, ...(ua ? { userAgent: ua } : {}) });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + resolve('test/harness.html'));
  for (const m of mocks) await p.addScriptTag({ path: m });
  await p.addScriptTag({ path: bundle });
  await p.evaluate((light) => {
    window.__mk = async (cfg, patch, attrs) => {
      const wait = (ms) => new Promise((q) => setTimeout(q, ms));
      document.getElementById('dash').innerHTML = '';
      const H = window.mockHass(); H.themes = { ...(H.themes || {}), darkMode: !light };
      Object.entries(patch || {}).forEach(([id, st]) => { if (st === null) delete H.states[id]; else H.states[id] = { entity_id: id, last_changed: new Date().toISOString(), last_updated: new Date().toISOString(), context: {}, ...(H.states[id] || {}), ...st, attributes: { ...((H.states[id] || {}).attributes || {}), ...(st.attributes || {}) } }; });
      if (attrs) H.states['weather.home'] = { ...H.states['weather.home'], attributes: attrs(H.states['weather.home'].attributes) };
      window.__h = H;
      const bc = document.createElement('bubble-card');
      bc.setConfig({ type: 'custom:bubble-card', card_type: 'pop-up', hash: '#vaer' });
      bc.innerHTML = '<div class="pop bubble-pop-up is-popup-opened" style="overflow:hidden;display:flex;flex-direction:column"><div class="hdr bubble-header-container">Vær</div><div class="inner bubble-pop-up-container" style="overflow:auto;flex:1;min-height:0"></div></div>';
      document.getElementById('dash').appendChild(bc);
      location.hash = '#vaer';
      const c = document.createElement('msh-vaer-card');
      c.setConfig({ type: 'custom:msh-vaer-card', card_id: 'pop-vaer56', ...(cfg || {}) });
      c.hass = H;
      bc.querySelector('.inner').appendChild(c);
      window.__c = c; window.__pop = bc.querySelector('.bubble-pop-up');
      if (window.MSH.theme && window.MSH.theme.update) window.MSH.theme.update(H);
      await wait(900);
      return true;
    };
  }, light);
  return { p, ctx };
}

/* ================================================================== G · gester (ekte Bubble Card, ekte touch via CDP) */
{
  const { p, ctx } = await bubble({ card: { view: 'sheet' } });
  const cdp = await ctx.newCDPSession(p);
  const swipe = async (sel, dx, dy, at) => {
    const pt = await p.evaluate(({ sel, at }) => {
      const sr = window.__card.shadowRoot, el = typeof sel === 'string' ? sr.querySelector(sel) : null;
      if (!el) return null;
      if (at !== 'keep') el.scrollIntoView({ block: 'center' });
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), st: window.__C.scrollTop, sl: (sr.querySelector('.hsc') || {}).scrollLeft };
    }, { sel, at });
    if (!pt) return { err: 'fant ikke ' + sel };
    if (pt.y < 2 || pt.y > 840 || pt.x < 2) return { err: 'utenfor', pt };
    await p.waitForTimeout(250);
    const p0 = await p.evaluate(() => ({ st: window.__C.scrollTop, sl: (window.__card.shadowRoot.querySelector('.hsc') || {}).scrollLeft }));
    try { await cdp.send('Input.synthesizeScrollGesture', { x: pt.x, y: pt.y, xDistance: dx, yDistance: dy, gestureSourceType: 'touch', speed: 600, preventFling: true }); } catch (e) { return { err: e.message, pt }; }
    await p.waitForTimeout(700);
    const p1 = await p.evaluate(() => ({ st: window.__C.scrollTop, sl: (window.__card.shadowRoot.querySelector('.hsc') || {}).scrollLeft, hash: location.hash, open: window.__pop.classList.contains('is-popup-opened') && !window.__pop.classList.contains('is-popup-closed') }));
    return { dSt: Math.round(p1.st - p0.st), dSl: Math.round((p1.sl || 0) - (p0.sl || 0)), hash: p1.hash, open: p1.open, x: pt.x, y: pt.y };
  };
  const TA = await p.evaluate(() => { const sr = window.__card.shadowRoot, ta = (s) => { const e = sr.querySelector(s); return e ? getComputedStyle(e).touchAction : null; }; return { hsc: ta('.hsc'), d3: ta('.d3'), mpill: ta('.mpill'), tw: ta('.tw'), wd: (() => { const e = sr.querySelector('.hsc'); return e ? getComputedStyle(e).overscrollBehaviorX + '/' + getComputedStyle(e).overflowX : null; })() }; });
  ok('56 G touch-action: timestripen pan-x pan-y (overflow-x auto, overscroll-behavior-x contain), pillen pan-y, fliser pan-y', TA.hsc === 'pan-x pan-y' && TA.mpill === 'pan-y' && TA.tw === 'pan-y' && TA.wd === 'contain/auto', TA);
  const G = {};
  G.hoursDown = await swipe('.hsc', 0, -320);
  G.hoursUp = await swipe('.hsc', 0, 160, 'keep');
  G.daysDown = await swipe('.dl .dw:nth-child(3) .dr', 0, -320);
  G.horiz = await swipe('.hsc', -220, 0);
  // grafene: Vind (scrub i timestripen) og nedbør per dag (scrub)
  await p.evaluate(async () => { window.__card.shadowRoot.querySelector('.mb[data-k="wind"]').click(); await new Promise((q) => setTimeout(q, 250)); });
  const TA2 = await p.evaluate(() => getComputedStyle(window.__card.shadowRoot.querySelector('.wsc')).touchAction);
  G.windDown = await swipe('.wsc', 0, -320);
  await p.evaluate(async () => { window.__card.shadowRoot.querySelector('.mb[data-k="rain"]').click(); await new Promise((q) => setTimeout(q, 250)); });
  const TA3 = await p.evaluate(() => getComputedStyle(window.__card.shadowRoot.querySelector('.rsg')).touchAction);
  G.rainDown = await swipe('.rsg', 0, -300);
  G.rainUp = await swipe('.rsg', 0, 150, 'keep');
  G.tilesDown = await swipe('[data-tiles] .tw', 0, -300);
  const vOk = (r) => r && !r.err && r.dSt > 60 && r.hash === '#vaer' && r.open;
  ok('56 G vertikalt sveip fra «Neste timer» scroller popupen (ned og opp) og lukker den ikke', vOk(G.hoursDown) && G.hoursUp.dSt < -40 && G.hoursUp.hash === '#vaer', { down: G.hoursDown, up: G.hoursUp });
  ok('56 G vertikalt sveip fra døgnlisten scroller popupen', vOk(G.daysDown), G.daysDown);
  ok('56 G horisontalt sveip scroller timestripen, popupen står i ro', G.horiz.dSl > 60 && Math.abs(G.horiz.dSt) <= 2 && G.horiz.hash === '#vaer', G.horiz);
  ok('56 G vertikalt sveip fra vindgrafen (scrub, touch-action pan-y) scroller popupen', TA2 === 'pan-y' && vOk(G.windDown), { TA2, r: G.windDown });
  ok('56 G vertikalt sveip fra nedbørsgrafen per dag (scrub, pan-y) scroller popupen ned og opp', TA3 === 'pan-y' && vOk(G.rainDown) && G.rainUp.dSt < -40 && G.rainUp.hash === '#vaer', { TA3, down: G.rainDown, up: G.rainUp });
  ok('56 G vertikalt sveip fra flisene scroller popupen', vOk(G.tilesDown), G.tilesDown);
  // horisontalt dra på vindgrafen = scrub (retningslås), ikke scroll av popupen
  await p.evaluate(async () => { window.__card.shadowRoot.querySelector('.mb[data-k="wind"]').click(); await new Promise((q) => setTimeout(q, 250)); window.__card.shadowRoot.querySelector('.wsc').scrollIntoView({ block: 'center' }); await new Promise((q) => setTimeout(q, 200)); });
  const sc = await p.evaluate(() => { const r = window.__card.shadowRoot.querySelector('.wsc').getBoundingClientRect(); return { x: Math.round(r.left + 40), y: Math.round(r.top + 30), st: window.__C.scrollTop }; });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: sc.x, y: sc.y }] });
  for (let i = 1; i <= 6; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: sc.x + i * 8, y: sc.y }] }); await p.waitForTimeout(16); }
  const S1 = await p.evaluate(() => ({ tip: !!window.__card.shadowRoot.querySelector('.wtip'), lock: window.__card.shadowRoot.querySelector('.wsc').dataset.lock, st: window.__C.scrollTop }));
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await p.waitForTimeout(200);
  const S2 = await p.evaluate(() => ({ tip: !!window.__card.shadowRoot.querySelector('.wtip') }));
  ok('56 G horisontalt dra på grafen → retningslås «h», scrub-boble vises, popupen scroller ikke; slipp → borte', S1.tip && S1.lock === 'h' && Math.abs(S1.st - sc.st) <= 1 && !S2.tip, { S1, S2, st0: sc.st });
  // swipe-to-close fra headeren virker fortsatt (popupen scrollet til toppen)
  await p.evaluate(async () => { window.__C.scrollTop = 0; await new Promise((q) => setTimeout(q, 300)); });
  const hd = await p.evaluate(() => { const r = window.__pop.querySelector('.bubble-header-container').getBoundingClientRect(); return { x: Math.round(r.left + r.width / 3), y: Math.round(r.top + r.height / 2) }; });
  await cdp.send('Input.synthesizeScrollGesture', { x: hd.x, y: hd.y, xDistance: 0, yDistance: 420, gestureSourceType: 'touch', speed: 1400, preventFling: false });
  await p.waitForTimeout(900);
  const closed = await p.evaluate(() => location.hash);
  ok('56 G swipe-to-close fra headeren virker fortsatt', closed !== '#vaer', closed);
  if (shots) await p.screenshot({ path: `${shots}/vaer56-g.png` });
  await ctx.close();
}

/* ================================================================== I · fullskjerm (ekte Bubble Card) */
for (const vp of [{ w: 390, h: 844, sb: 0, tag: 'mobil' }, { w: 1400, h: 900, sb: 256, tag: 'PC (HA-sidebar 256 px)' }, { w: 884, h: 1104, sb: 0, tag: 'Fold åpen' }]) {
  const { p, ctx, cfg } = await bubble({ w: vp.w, h: vp.h, sb: vp.sb, nav: true });
  const R = await p.evaluate(() => {
    const pop = window.__pop, pr = pop.getBoundingClientRect(), dash = document.getElementById('dash').getBoundingClientRect(), sbr = document.getElementById('sidebar').getBoundingClientRect();
    const sr = window.__card.shadowRoot, wrap = sr.querySelector('.wrap'), wr = wrap.getBoundingClientRect(), hd = pop.querySelector('.bubble-header-container');
    const lay = pop.querySelector(':scope > .msh-vaer-scene'), lr = lay && lay.getBoundingClientRect();
    const nowS = sr.querySelector('[data-sec="now"] .snw'), nr = nowS && nowS.getBoundingClientRect();
    const pt = window.__nb && (window.__nb._portal || document.querySelector('.msh-navbar-portal'));
    const nav = pt && pt.shadowRoot && pt.shadowRoot.querySelector('nav.nb'), navR = nav && nav.getBoundingClientRect();
    const ctl = sr.querySelector('.ctl-slot').getBoundingClientRect();
    return { pop: [pr.left, pr.top, pr.width, pr.height].map(Math.round), dash: [dash.left, dash.top, dash.width, window.innerHeight - dash.top].map(Math.round), sbR: Math.round(sbr.right), radius: getComputedStyle(pop).borderTopLeftRadius,
      full: pop.hasAttribute('data-ki-vaer-full'), wrap: [Math.round(wr.left - pr.left), Math.round(pr.right - wr.right), Math.round(wr.width)], cls: wrap.className, pad: getComputedStyle(wrap).paddingLeft,
      hdBg: getComputedStyle(hd).backgroundColor, hdPos: getComputedStyle(hd).position, layer: lr && [Math.round(lr.top - pr.top), Math.round(lr.height - pr.height), Math.round(lr.width - pr.width)], layerPos: lay && getComputedStyle(lay).position,
      hero: nr && Math.round(nr.height), dashH: window.innerHeight, navVis: pt ? !pt.hasAttribute('data-vaer') : null, navOp: nav && getComputedStyle(nav).opacity, navTop: navR && Math.round(navR.top), ctlB: Math.round(ctl.bottom), cardPb: window.__card.style.paddingBottom };
  });
  const T = vp.tag;
  ok(`${T} 56 I Bubble-oppsett (Fullskjerm): margin_top 0, bredde = dashbordflaten, bg_opacity 100, bg_blur 0`, cfg.margin === '0px' && cfg.md === '0px' && /100%/.test(cfg.wd) && cfg.op === '100' && cfg.blur === '0', cfg);
  ok(`${T} 56 I popupen dekker hele dashbordflaten (ingen margin, radius 0), aldri over HA-sidebaren`, R.full && Math.abs(R.pop[0] - R.dash[0]) <= 1 && Math.abs(R.pop[1] - R.dash[1]) <= 1 && Math.abs(R.pop[2] - R.dash[2]) <= 1 && Math.abs(R.pop[3] - R.dash[3]) <= 1 && R.radius === '0px' && R.pop[0] >= R.sbR, R);
  ok(`${T} 56 I værbakgrunnen (fx-laget) dekker hele flaten, absolutt (ikke fixed), scroller ikke`, R.layer && R.layer.every((x) => Math.abs(x) <= 1) && R.layerPos === 'absolute', R);
  ok(`${T} 56 I headeren gjennomsiktig over værbakgrunnen`, /rgba\(0, 0, 0, 0\)|transparent/.test(R.hdBg), R.hdBg);
  const col = vp.w >= 768 ? R.wrap[2] <= 752 && Math.abs(R.wrap[0] - R.wrap[1]) <= 2 : R.pad === '16px' && Math.abs(R.wrap[0]) <= 1;
  ok(`${T} 56 I innhold: padding 0 16px (telefon) / sentrert kolonne maks 720 px (nettbrett/PC)`, /full/.test(R.cls) && col, R);
  ok(`${T} 56 I heroen ~30 % av dashbordhøyden`, R.hero >= R.dashH * 0.3 - 2, R);
  ok(`${T} 56 I navbar synlig over været (standard), stedsvelgeren står over navbaren, bunnluft = navbar + Now Playing + safe-area + 16`, R.navVis === true && R.navOp === '1' && R.ctlB <= R.navTop && /ki-nav-h/.test(R.cardPb) && /ki-mini-h/.test(R.cardPb) && /16px/.test(R.cardPb), R);
  if (shots) await p.screenshot({ path: `${shots}/vaer56-full-${vp.w}.png` });
  // scroll: headeren står fast, siste kort er over navbaren
  const S = await p.evaluate(async () => { const C = window.__C, hd = window.__pop.querySelector('.bubble-header-container'); const h0 = hd.getBoundingClientRect().top; C.scrollTop = 1e6; await new Promise((q) => setTimeout(q, 300)); const sr = window.__card.shadowRoot, at = sr.querySelector('.attr') || sr.querySelector('[data-tiles]'); return { hd: Math.round(hd.getBoundingClientRect().top - h0), last: Math.round(at.getBoundingClientRect().bottom) }; });
  ok(`${T} 56 I headeren er fast ved scrolling, siste innhold vises over navbaren`, S.hd === 0 && S.last <= R.navTop, { S, navTop: R.navTop });
  await ctx.close();
}
{ // «Skjul navbar i fullskjerm» + «Ark»
  const { p, ctx } = await bubble({ nav: true, card: { hide_navbar: true } });
  const N = await p.evaluate(() => { const pt = window.__nb._portal || document.querySelector('.msh-navbar-portal'); return { hidden: pt.hasAttribute('data-vaer'), pb: window.__card.style.paddingBottom, full: window.__pop.hasAttribute('data-ki-vaer-full') }; });
  ok('56 I «Skjul navbar i fullskjerm» på → navbaren skjules, bunnluft 16 px + safe-area', N.hidden && N.full && /^calc\(16px/.test(N.pb) && !/ki-nav-h/.test(N.pb), N);
  await ctx.close();
  const A = await bubble({ card: { view: 'sheet' } });
  const Sh = await A.p.evaluate(() => { const pr = window.__pop.getBoundingClientRect(); return { full: window.__pop.hasAttribute('data-ki-vaer-full'), top: Math.round(pr.top), radius: getComputedStyle(window.__pop).borderTopLeftRadius, cls: window.__card.shadowRoot.querySelector('.wrap').className }; });
  ok('56 I «Ark»: det gamle oppsettet (mal A: margin over, runde hjørner, bg 98)', !Sh.full && Sh.top >= 40 && Sh.radius !== '0px' && !/full/.test(Sh.cls) && A.cfg.op === '98' && A.cfg.margin === '50px', { Sh, cfg: A.cfg });
  // bytt live via Tilpass Hjem → Popups → Vær (samme verdi som GUI-editoren)
  const L = await A.p.evaluate(async () => {
    const wait = (ms) => new Promise((q) => setTimeout(q, ms));
    const html = MSH.vaerStilHTML('ppvaer');
    const before = MSH.vaerView();
    await MSH.setVaerStil('view:fullscreen'); await wait(500);
    const pr = window.__pop.getBoundingClientRect();
    const r = { html: /data-v="view:fullscreen"/.test(html) && /data-v="view:sheet"/.test(html) && /Skjul navbar i fullskjerm/.test(html), before, after: MSH.vaerView(), cfg: window.__card._rawConfig.view, full: window.__pop.hasAttribute('data-ki-vaer-full'), top: Math.round(pr.top), radius: getComputedStyle(window.__pop).borderTopLeftRadius };
    await MSH.setVaerStil('nav:on'); await wait(200); r.nav = window.__card._rawConfig.hide_navbar;
    await MSH.setVaerStil('nav:off'); await wait(200); r.nav2 = window.__card._rawConfig.hide_navbar;
    return r;
  });
  ok('56 I Tilpass Hjem → Popups → Vær: «Visning: Fullskjerm / Ark» + «Skjul navbar i fullskjerm», lagres i kortets config, live', L.html && L.before === 'sheet' && L.after === 'fullscreen' && L.cfg === 'fullscreen' && L.full && L.top === 0 && L.radius === '0px' && L.nav === true && L.nav2 === false, L);
  // GUI-editoren har de samme valgene
  const E = await A.p.evaluate(async () => {
    const C = customElements.get('msh-vaer-card'), ed = C.getConfigElement(); document.body.appendChild(ed); ed.hass = window.__h; ed.setConfig({ type: 'custom:msh-vaer-card', card_id: 'gui56' });
    await new Promise((q) => setTimeout(q, 300));
    const t = ed.shadowRoot.innerHTML; ed.remove();
    return { view: /data-name="view"/.test(t), nav: /Skjul navbar i fullskjerm/.test(t), feels: /feels_like_entity/.test(t), vis: /visibility_entity/.test(t), calc: /Beregn føles som når sensor mangler/.test(t) };
  });
  ok('56 H/I GUI-editoren: Visning, Skjul navbar, Føles som-entitet, Sikt-entitet, «Beregn føles som når sensor mangler»', Object.values(E).every(Boolean), E);
  await A.ctx.close();
}

/* ================================================================== H · «Føles som» og «Sikt» */
{
  const { p, ctx } = await simple();
  const F = await p.evaluate(async () => {
    const M = window.MSH, wait = (ms) => new Promise((q) => setTimeout(q, ms));
    const tiles = () => { const sr = window.__c.shadowRoot, f = sr.querySelector('.tfl'), v = sr.querySelector('.tvs'); return { fSrc: f && f.dataset.src, fVal: f && f.querySelector('.tvb').textContent, fK: f && f.querySelector('.tk').textContent, calc: !!(f && f.querySelector('.tcalc')), calcCss: f && f.querySelector('.tcalc') ? getComputedStyle(f.querySelector('.tcalc')).fontSize : null, fPick: !!(f && f.querySelector('.tpick')), vSrc: v && v.dataset.src, vVal: v && v.querySelector('.tvb').textContent, vU: v && v.querySelector('.tvu').textContent, vK: v && v.querySelector('.tk') && v.querySelector('.tk').textContent, vScale: !!(v && v.querySelector('.ttr .tdot')), vPick: !!(v && v.querySelector('.tpick[data-section="sensors"]')) }; };
    const out = {};
    // Met.no alene: ingen apparent_temperature/visibility, ingen sensorer → beregnet + «Velg entitet»
    const strip = (a) => { const { apparent_temperature, visibility, visibility_unit, ...r } = a; return { ...r, temperature: 4, humidity: 80, wind_speed: 6, wind_speed_unit: 'm/s', temperature_unit: '°C' }; };
    await window.__mk({}, {}, strip); out.met = tiles();
    out.metExpect = Math.round(M.vaerFeelsCalc(4, 80, 6 * 3.6).v);
    // integrasjon med begge attributtene (sikt i meter)
    await window.__mk({}, {}, (a) => ({ ...strip(a), apparent_temperature: 1.2, visibility: 7400, visibility_unit: 'm' })); out.attr = tiles();
    // autofunnet sensor (ingen attributter)
    await window.__mk({}, { 'sensor.pirate_apparent_temperature': { state: '-1.6', attributes: { device_class: 'temperature', unit_of_measurement: '°C', friendly_name: 'Pirate Feels like' } }, 'sensor.pirate_visibility': { state: '24.1', attributes: { unit_of_measurement: 'km', friendly_name: 'Pirate Visibility' } } }, strip); out.auto = tiles();
    // config-overstyring vinner over attributtet
    await window.__mk({ feels_like_entity: 'sensor.mine_feels', visibility_entity: 'sensor.mine_sikt' }, { 'sensor.mine_feels': { state: '-8', attributes: { device_class: 'temperature', unit_of_measurement: '°C' } }, 'sensor.mine_sikt': { state: '800', attributes: { unit_of_measurement: 'm' } } }, (a) => ({ ...strip(a), apparent_temperature: 1.2, visibility: 12 })); out.cfg = tiles();
    // «Beregn føles som når sensor mangler» av
    await window.__mk({ compute_feels: false }, {}, strip); out.off = tiles();
    // live: sensorverdien endres → bare flisen oppdateres (samme DOM-noder i resten av popupen)
    await window.__mk({ feels_like_entity: 'sensor.mine_feels' }, { 'sensor.mine_feels': { state: '-8', attributes: { device_class: 'temperature', unit_of_measurement: '°C' } } }, strip);
    const hc = window.__c.shadowRoot.querySelector('.hcard'), tw = window.__c.shadowRoot.querySelector('.tw[data-tile="feels"]');
    const h0 = window.__c.hass, h2 = { ...h0, states: { ...h0.states, 'sensor.mine_feels': { ...h0.states['sensor.mine_feels'], state: '-11' } } };
    window.__c.hass = h2; await wait(300);
    out.live = { val: tiles().fVal, sameHours: window.__c.shadowRoot.querySelector('.hcard') === hc, sameTile: window.__c.shadowRoot.querySelector('.tw[data-tile="feels"]') === tw };
    // formler
    out.chill = M.vaerFeelsCalc(0, 80, 20).v; out.heat = M.vaerFeelsCalc(30, 70, 5).v; out.mild = M.vaerFeelsCalc(15, 50, 30);
    return out;
  });
  ok('56 H Met.no alene: «Føles som» = beregnet (vindavkjøling), «beregnet» 11 px; «Sikt» = «–» + «Velg entitet»', F.met.fSrc === 'calc' && F.met.fVal === String(F.metExpect) && F.met.calc && F.met.calcCss === '11px' && /Kaldere enn faktisk pga\. vind/.test(F.met.fK) && F.met.vSrc === 'none' && F.met.vVal === '–' && F.met.vPick, F.met);
  ok('56 H integrasjon med begge: apparent_temperature + visibility (m → km, 1 desimal under 10 km), beskrivelse og skala', F.attr.fSrc === 'attr' && F.attr.fVal === '1' && !F.attr.calc && F.attr.vSrc === 'attr' && F.attr.vVal === '7,4' && F.attr.vU === 'km' && F.attr.vK === 'Moderat' && F.attr.vScale, F.attr);
  ok('56 H autofunnet sensor (feels/apparent · visibility) brukes når attributtene mangler', F.auto.fSrc === 'auto' && F.auto.fVal === '-2' && F.auto.vSrc === 'auto' && F.auto.vVal === '24' && F.auto.vK === 'Svært god', F.auto);
  ok('56 H config feels_like_entity / visibility_entity vinner (800 m → 0,8 km «Tåke»)', F.cfg.fSrc === 'cfg' && F.cfg.fVal === '-8' && F.cfg.vSrc === 'cfg' && F.cfg.vVal === '0,8' && F.cfg.vK === 'Tåke', F.cfg);
  ok('56 H «Beregn føles som når sensor mangler» av → «–» + «Velg entitet» (aldri tom flis)', F.off.fSrc === 'none' && F.off.fVal === '–' && F.off.fPick, F.off);
  ok('56 H live: ny sensorverdi oppdaterer flisen uten å tegne popupen på nytt', F.live.val === '-11' && F.live.sameHours && F.live.sameTile, F.live);
  ok('56 H formler: vindavkjøling 0 °C/20 km/t ≈ −5,2 · heat index 30 °C/70 % ≈ 35 · ellers temperaturen', Math.abs(F.chill + 5.2) < 0.2 && Math.abs(F.heat - 35) < 1 && F.mild.kind === 'temp' && F.mild.v === 15, F);
  await ctx.close();
}

/* ================================================================== J/K · flisene */
for (const w of [390, 600, 1280]) {
  const { p, ctx } = await simple({ w });
  const J = await p.evaluate(async () => {
    await window.__mk({});
    const sr = window.__c.shadowRoot, tw = [...sr.querySelectorAll('[data-tiles] > .tw')];
    const hs = tw.map((e) => Math.round(e.getBoundingClientRect().height)), g = getComputedStyle(sr.querySelector('[data-tiles]'));
    const clip = tw.some((e) => { const r = e.getBoundingClientRect(); return [...e.querySelectorAll('.tl2 > *')].some((x) => x.getBoundingClientRect().bottom > r.bottom + 0.5); });
    const cmp = sr.querySelector('.cmp').getBoundingClientRect(), scv = sr.querySelector('.scv'), sday = sr.querySelector('.scv .sday'), dot = sr.querySelector('.scv .sdot');
    const ticks = sr.querySelectorAll('.cmp .tk2'), long = sr.querySelectorAll('.cmp .tk2.c'), L = [...sr.querySelectorAll('.cmpl')].map((e) => [e.textContent, getComputedStyle(e).fontSize, getComputedStyle(e).color, getComputedStyle(e).fontWeight]);
    const ndl = sr.querySelector('.ndl'), bear = window.__c.hass.states['weather.home'].attributes.wind_bearing;
    const ctr = sr.querySelector('.cmpc'), brs = [...sr.querySelectorAll('.tbr')].map((e) => ({ l: e.firstElementChild.textContent, r: e.lastElementChild.textContent, fs: getComputedStyle(e).fontSize, w: getComputedStyle(e.firstElementChild).fontWeight, c: getComputedStyle(e.lastElementChild).color, mt: getComputedStyle(e).marginTop }));
    return { hs, rows: g.gridAutoRows, clip, cmp: [Math.round(cmp.width), Math.round(cmp.height)], scvH: scv && Math.round(scv.getBoundingClientRect().height), sday: sday && sday.getAttribute('stroke'), dot: !!dot, ticks: ticks.length, long: long.length, L, rot: ndl.style.transform, bear, ctr: getComputedStyle(ctr).backgroundColor, cv: getComputedStyle(sr.querySelector('.cmpv')).fontSize, cu: getComputedStyle(sr.querySelector('.cmpu')).fontSize, brs, sunT: sr.querySelector('.tsn .th2').textContent.trim(), sunBig: sr.querySelector('.tsn .sbig').textContent };
  });
  ok(`${w}px 56 J alle fliser like høye (≥ 148 px), grid-auto-rows minmax(148px, …), ingen tekst kuttes`, J.hs.length === 9 && J.hs.every((x) => x === J.hs[0]) && J.hs[0] >= 148 && /^minmax\(148px/.test(J.rows) && !J.clip, J);
  ok(`${w}px 56 K Vind: kompass 96 px, 36 streker (4 lange), N/Ø/S/V 9 px (N hvit/fet), nål etter wind_bearing, glass-midte 17/11 px`, J.cmp[0] === 96 && J.cmp[1] === 96 && J.ticks === 36 && J.long === 4 && J.L.map((x) => x[0]).join('') === 'NØSV' && J.L.every((x) => x[1] === '9px') && J.L[0][2] === 'rgb(255, 255, 255)' && Number(J.L[0][3]) >= 600 && J.rot === `rotate(${(J.bear + 180) % 360}deg)` && /rgba\(20, 22, 28, 0\.55\)/.test(J.ctr) && J.cv === '17px' && J.cu === '11px', J);
  ok(`${w}px 56 J/K Soloppgang: solkurve 44 px (gul dagdel), solprikk, tittel Soloppgang/Solnedgang`, J.scvH === 44 && J.sday === 'rgb(242 210 111)' && J.dot && /^Sol(oppgang|nedgang)$/.test(J.sunT) && /^\d\d:\d\d$/.test(J.sunBig), J);
  ok(`${w}px 56 K bunnlinjer (Vind/Soloppgang/Måne): 12 px, primær 500, sekundær #a8a8a8, festet nederst`, J.brs.length === 3 && J.brs.every((x) => x.fs === '12px' && x.w === '500' && x.c === 'rgb(168, 168, 168)') && /^Fra /.test(J.brs[0].l) && /^Kast /.test(J.brs[0].r) && /^[↓↑] \d\d:\d\d$/.test(J.brs[1].l) && /^\d+ t \d+ min$/.test(J.brs[1].r) && /^↑ (\d\d:\d\d|–)$/.test(J.brs[2].l) && /^\d+ % lys$/.test(J.brs[2].r), J.brs);
  await ctx.close();
}
{ // Måne: beregnet belysning/oppgang (SunCalc) mot kjente verdier · solkurven etter solnedgang
  const { p, ctx } = await simple();
  const K = await p.evaluate(async () => {
    const M = window.MSH;
    const full = M.vaerMoonIllum(new Date('2024-01-25T17:54:00Z')).fraction, nw = M.vaerMoonIllum(new Date('2024-01-11T11:57:00Z')).fraction;
    const mt = M.vaerMoonTimes(new Date('2024-01-25T12:00:00Z'), 59.91, 10.75);
    // etter solnedgang: neste soloppgang i morgen, neste solnedgang i morgen kveld
    const now = Date.now(), H = 3600000, d1 = new Date(); d1.setHours(24, 0, 0, 0);
    await window.__mk({}, { 'sun.sun': { state: 'below_horizon', attributes: { next_rising: new Date(d1.getTime() + 7 * H).toISOString(), next_setting: new Date(d1.getTime() + 19 * H).toISOString(), elevation: -10 } } });
    const sr = window.__c.shadowRoot, t = sr.querySelector('.tsn');
    const late = new Date().getHours() >= 1; // (tid etter midnatt – rekkefølgen er uansett etter solnedgang)
    return { full, nw, rise: mt.rise && new Date(mt.rise).toISOString(), set: mt.set && new Date(mt.set).toISOString(), title: t.querySelector('.th2').textContent.trim(), phase: t.dataset.phase, br: t.querySelector('.tbr b').textContent, late, now };
  });
  ok('56 K Måne: belysning beregnet (fullmåne ≈ 100 %, nymåne ≈ 0 %) og måneoppgang (SunCalc)', K.full > 0.98 && K.nw < 0.02 && !!K.rise, K);
  ok('56 K etter solnedgang: tittelen «Solnedgang», bunnlinjen «↑ <neste soloppgang>»', K.title === 'Solnedgang' && K.phase === 'post' && /^↑ 07:00$/.test(K.br), K);
  await ctx.close();
}

/* ================================================================== L · kortflate, Android, ikoner, døgnliste */
const KEYS = ['clear-night', 'cloudy', 'fog', 'hail', 'lightning', 'lightning-rainy', 'partlycloudy', 'pouring', 'rainy', 'snowy', 'snowy-rainy', 'sunny', 'windy', 'windy-variant', 'exceptional'];
const TABLE = { 'clear-night': 'rgba(12, 18, 36, 0.5)', cloudy: 'rgba(40, 46, 56, 0.38)', fog: 'rgba(46, 50, 56, 0.38)', hail: 'rgba(26, 30, 40, 0.45)', lightning: 'rgba(18, 20, 30, 0.5)', 'lightning-rainy': 'rgba(20, 22, 32, 0.48)', partlycloudy: 'rgba(26, 52, 84, 0.34)', pouring: 'rgba(22, 26, 34, 0.48)', rainy: 'rgba(30, 36, 46, 0.42)', snowy: 'rgba(40, 48, 66, 0.36)', 'snowy-rainy': 'rgba(36, 42, 54, 0.4)', sunny: 'rgba(20, 50, 90, 0.32)', windy: 'rgba(34, 48, 64, 0.36)', 'windy-variant': 'rgba(38, 44, 54, 0.4)', exceptional: 'rgba(30, 18, 22, 0.5)' };
for (const [tag, ua] of [['iOS/PC', null], ['Android', ANDROID_UA]]) {
  const { p, ctx } = await simple({ ua });
  const L = await p.evaluate(async (KEYS) => {
    const out = {};
    for (const k of KEYS) {
      const night = k === 'clear-night';
      await window.__mk({}, { 'weather.home': { state: night ? 'sunny' : k }, ...(night ? { 'sun.sun': { state: 'below_horizon' } } : {}) });
      const sr = window.__c.shadowRoot, g = [...sr.querySelectorAll('.g')], cs = getComputedStyle(g[0]);
      // ett lag: ingen bakgrunn mellom kortet og vertselementet (ha-card, .wrap, .blk)
      const extra = []; for (let n = g[0].parentElement; n; n = n.parentElement) { const c = getComputedStyle(n); if (c.backgroundColor !== 'rgba(0, 0, 0, 0)' || c.backgroundImage !== 'none') extra.push(n.className || n.localName); }
      out[k] = { bg: cs.backgroundColor, bf: cs.backdropFilter, same: g.every((e) => getComputedStyle(e).backgroundColor === cs.backgroundColor), extra, ha: getComputedStyle(sr.querySelector('ha-card')).backgroundColor, exp: window.MSH.vaerCardOver(k) };
    }
    return { out, android: !!(window.MSH.perf && window.MSH.perf.android) };
  }, KEYS);
  const hex2rgb = (h) => `rgb(${parseInt(h.slice(1, 3), 16)}, ${parseInt(h.slice(3, 5), 16)}, ${parseInt(h.slice(5, 7), 16)})`;
  if (tag === 'Android') {
    const bad = KEYS.filter((k) => L.out[k].bg !== hex2rgb(L.out[k].exp) || (L.out[k].bf && L.out[k].bf !== 'none') || !L.out[k].same);
    ok('56 L Android (ki-android): dekkende kortflate = --card over C.bg[1] (rainy ≈ #38404d), ingen blur', L.android && !bad.length && L.out.rainy.exp === '#38404d', { bad, rainy: L.out.rainy });
  } else {
    const bad = KEYS.filter((k) => L.out[k].bg !== TABLE[k] || !/blur\(18px\)/.test(L.out[k].bf) || !L.out[k].same || L.out[k].extra.length || L.out[k].ha !== 'rgba(0, 0, 0, 0)');
    ok('56 L kortflaten = var(--card) per værtype (tabellen C) + blur(18px), ett lag (ha-card/wrap uten bakgrunn)', !L.android && !bad.length, bad.map((k) => [k, L.out[k]]));
  }
  await ctx.close();
}
{
  const { p, ctx } = await simple();
  const I = await p.evaluate(async () => {
    await window.__mk({}, { 'weather.home': { state: 'sunny' } });
    const sr = window.__c.shadowRoot;
    const hic = [...sr.querySelectorAll('.hc .hic')], day = [...sr.querySelectorAll('.dr .di')];
    const outl = [...sr.querySelectorAll('.hcard ha-icon, .dcard ha-icon')].map((e) => e.getAttribute('icon')).filter((i) => /outline/.test(i));
    const svgs = [...sr.querySelectorAll('.hic svg.wxi, .di svg.wxi')];
    const sun = svgs.find((s) => s.dataset.wx === 'sunny'), other = svgs.find((s) => !/sunny|partly/.test(s.dataset.wx));
    const cs = (e) => getComputedStyle(e).color;
    const dtr = sr.querySelector('.dtr'), dbar = sr.querySelector('.dbar'), ddot = sr.querySelector('.ddot');
    const forms = window.MSH.VAER_SCENES.map((k) => window.MSH.vaerWxSvg(k, 24)).every((s) => /<path|<circle|<rect/.test(s) && !/outline/.test(s));
    return { hic: hic.length, hicSvg: hic.every((e) => e.querySelector('svg.wxi') && !e.querySelector('ha-icon')), day: day.length, daySvg: day.every((e) => e.querySelector('svg.wxi')), outl, sunCol: sun && sun.querySelector('path').getAttribute('fill'), otherCol: other && cs(other), otherKey: other && other.dataset.wx, rail: dtr && getComputedStyle(dtr).backgroundColor, grad: dbar && dbar.style.background, dot: ddot && getComputedStyle(ddot).backgroundColor, forms };
  });
  const lum = (c) => { const m = /(\d+), (\d+), (\d+)/.exec(c || ''); if (!m) return 0; const f = (u) => { u /= 255; return u <= 0.04045 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4); }; return 0.2126 * f(+m[1]) + 0.7152 * f(+m[2]) + 0.0722 * f(+m[3]); };
  ok('56 L fylte værikoner i timestripen og døgnlisten (ingen -outline / kontur-ha-icon), sol gul rgb(242 210 111), andre hvite', I.hic >= 12 && I.hicSvg && I.day >= 7 && I.daySvg && !I.outl.length && I.sunCol === 'rgb(242 210 111)' && (!I.otherKey || lum(I.otherCol) > 0.75) && I.forms, I);
  ok('56 L døgnlisten: temperaturgradient (grønn → gul), hvit «nå»-prikk, skinne rgba(0,0,0,.35)', I.rail === 'rgba(0, 0, 0, 0.35)' && /linear-gradient/.test(I.grad || '') && I.dot === 'rgb(250, 250, 250)', I);
  if (shots) { await p.evaluate(() => window.__c.shadowRoot.querySelector('.hcard').scrollIntoView()); await p.screenshot({ path: `${shots}/vaer56-icons.png` }); }
  await ctx.close();
}

/* ================================================================== G · lys modus: kontrast på værflatene */
{
  const { p, ctx } = await simple({ light: true });
  const C = await p.evaluate(async () => {
    const out = {};
    for (const [k, st, sun] of [['sunny', 'sunny', 'above_horizon'], ['cloudy', 'cloudy', 'above_horizon'], ['rainy', 'rainy', 'above_horizon'], ['clear-night', 'sunny', 'below_horizon'], ['partlycloudy', 'partlycloudy', 'above_horizon'], ['snowy', 'snowy', 'above_horizon']]) {
      await window.__mk({}, { 'weather.home': { state: st }, 'sun.sun': { state: sun } });
      const sr = window.__c.shadowRoot, surf = window.MSH.vaerCardOver(k);
      const blend = (c) => { const m = /rgba?\(([^)]+)\)/.exec(c); const q = m[1].split(/[\s,/]+/).filter(Boolean).map(Number); const a = q.length > 3 ? q[3] : 1, s = [1, 3, 5].map((i) => parseInt(surf.slice(i, i + 2), 16)); return `rgb(${[0, 1, 2].map((i) => Math.round(q[i] * a + s[i] * (1 - a))).join(', ')})`; };
      const rat = (sel) => { const e = sr.querySelector(sel); if (!e) return null; return +window.MSH.vaerContrast(blend(getComputedStyle(e).color), surf).toFixed(2); };
      out[k] = { theme: document.documentElement.dataset.kiTheme, lum: sr.querySelector('.wrap').dataset.lum, htt: rat('.htt'), now: rat('.ht.now'), hv: rat('.hv'), hp: rat('.hp:not(:empty)'), tvb: rat('.tvb'), th2: rat('.th2'), hsub: rat('.hsub'), brs: rat('.tbr span'), stp: rat('.stp') };
    }
    return out;
  });
  const bad = Object.entries(C).filter(([, r]) => r.theme !== 'light' || r.lum !== 'dark' || ['htt', 'now', 'hv', 'tvb', 'stp'].some((k) => !(r[k] >= 4.5)) || (r.hp != null && r.hp < 4.5) || ['th2', 'hsub', 'brs'].some((k) => !(r[k] >= 3)));
  ok('56 G lys modus: værflatene er mørke → lys tekst; «Neste timer», «Nå», temperaturer og verdier ≥ 4,5:1, nedbørsblå ≥ 4,5:1, sekundær ≥ 3:1 (sol, sky, regn, natt, delvis skyet, snø)', !bad.length, bad.length ? bad : C);
  await ctx.close();
}

await b.close();
try { rmSync(bundle); } catch (e) { /* */ }
ok('ingen sidefeil', !errs.length, errs.slice(0, 5));
console.log(JSON.stringify(res, null, 1));
console.log(fail.length ? `${fail.length} FEIL: ${fail.join(' · ')}` : 'Alle Vær 56-sjekker OK');
process.exit(fail.length ? 1 : 0);
