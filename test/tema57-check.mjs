// Fiks 57 A/B/D · Søppel-kortet uten skjøt, jevn dashbordbakgrunn, <meta name="theme-color"> (statuslinjen på Android).
//   A: lys/mørk – Søppel-kortet er ÉN dekkende flate (lys: --ki-surface + --ki-card-sh, ingen alfa/backdrop-filter, ha-card
//      uten flate), pikselrader på tvers av kortet er like (ingen vannrett skjøt) også når bakgrunnen bak har to lag
//      (simulert HA: hui-root #view + et bakgrunnslag med fast høyde); dashbordbakgrunnen er én jevn farge; Strømpris dekkende
//   B: theme-color = dashbordets faktiske bakgrunn ved oppstart, etter bytte lys/mørk, etter at HA skriver over taggen
//      (temabytte/settheme) og etter visibilitychange; åpen Bubble-popup → fargen øverst (dimming over dashbordet), lukket →
//      tilbake; Android: header i dashbordfargen, skjult header → padding-top = safe area; standard-UA: ingen layoutendring
//   D: Vær åpen → C.bg[0] for værtypen (cloudy/sunny/rainy/clear-night), satt i samme hashchange som åpner popupen,
//      ny værtype/nytt sted følger med, lukking gir dashbordfargen tilbake
// Kjør: node test/tema57-check.mjs   (SHOTS=<mappe> gir skjermbilder)
import { createRequire } from 'node:module';
import { readdirSync, existsSync, rmSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
mkdirSync('test/.build', { recursive: true });
const bundle = resolve(`test/.build/tema57-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const BC = resolve('test/.vendor/bubble-card.js');
if (!existsSync(BC)) { mkdirSync('test/.vendor', { recursive: true }); execFileSync('curl', ['-sSL', '-o', BC, 'https://raw.githubusercontent.com/Clooos/Bubble-Card/main/dist/bubble-card.js']); }
const shots = process.env.SHOTS || '';
if (shots) mkdirSync(shots, { recursive: true });
const mocks = readdirSync('test/mock').filter((f) => f.endsWith('.js')).sort().map((m) => resolve('test/mock/' + m));
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => pw.chromium.launch());
const res = {}, fail = [], errs = [];
const ok = (name, cond, info) => { res[name] = cond ? 'OK' : ['FEIL', info]; if (!cond) fail.push(name); };
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36 Home Assistant/2024.10';
const near = (a, b2, t = 3) => { const p = (h) => [1, 3, 5].map((i) => parseInt(String(h).slice(i, i + 2), 16)); if (!a || !b2) return false; const x = p(a), y = p(b2); return x.every((v, i) => Math.abs(v - y[i]) <= t); };

// Piksler fra et skjermbilde (klipp) → [[r,g,b] …] for gitte punkter (relativt til klippet)
async function pixels(p, clip, pts) {
  const buf = await p.screenshot({ clip });
  return p.evaluate(async ({ b64, pts }) => {
    const bl = await (await fetch('data:image/png;base64,' + b64)).blob();
    const img = await createImageBitmap(bl);
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const k = img.width / Math.max(1, Math.round(img.width / (window.devicePixelRatio || 1))) || 1;
    return pts.map(([x, y]) => Array.from(g.getImageData(Math.round(x * k), Math.round(y * k), 1, 1).data.slice(0, 3)));
  }, { b64: buf.toString('base64'), pts });
}
const spread = (px) => { let m = 0; for (const a of px) for (const c of px) m = Math.max(m, ...a.map((v, i) => Math.abs(v - c[i]))); return m; };

/* ------------------------------------------------------------------ simulert HA (home-assistant › hui-root › #view) */
async function haPage({ ua, dark = false, hideHeader = false, w = 390, h = 1500 } = {}) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, ...(ua ? { userAgent: ua } : {}) });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + resolve('test/harness.html'));
  await p.evaluate(({ hideHeader }) => {
    // HA-strukturen dashEl() leter etter. Bakgrunnen bak har TO lag: <body> #e1e1e1 og et «view-bakgrunn»-lag med fast
    // høyde (#e8e8e8, 520 px) som slutter midt i Søppel-kortet – slik skjøten i skjermbildet oppstår gjennom en gjennomsiktig flate.
    document.documentElement.style.background = document.body.style.background = '';
    const st = document.createElement('style'); st.textContent = 'html,body{background:#e1e1e1!important}'; // ki-hex-ok: test
    document.head.appendChild(st);
    const meta = document.createElement('meta'); meta.name = 'theme-color'; meta.content = '#03a9f4'; document.head.appendChild(meta); // HAs standard
    const ha = document.createElement('home-assistant'); document.body.prepend(ha);
    const panel = document.createElement('ha-panel-lovelace'); ha.attachShadow({ mode: 'open' }).appendChild(panel);
    const root = document.createElement('hui-root'); panel.attachShadow({ mode: 'open' }).appendChild(root);
    const rs = root.attachShadow({ mode: 'open' });
    rs.innerHTML = `<style>.header{position:fixed;top:0;left:0;right:0;height:56px;z-index:3;background:var(--app-header-background-color,#03a9f4)}
      .header.hidden{display:none}
      #view{position:relative;min-height:100vh;box-sizing:border-box;padding-top:56px}
      #view.nohdr{padding-top:0}
      .vbg{position:absolute;left:0;right:0;top:0;height:520px;z-index:-1;background:var(--view-background,var(--lovelace-background,#e8e8e8))}
      .content{padding:12px 18px;display:flex;flex-direction:column;gap:22px}</style>
      <div class="header${hideHeader ? ' hidden' : ''}"></div><div id="view" class="${hideHeader ? 'nohdr' : ''}"><div class="vbg"></div><div class="content"></div></div>`;
    window.__view = rs.querySelector('#view');
    window.__content = rs.querySelector('.content');
  }, { hideHeader });
  for (const m of mocks) await p.addScriptTag({ path: m });
  await p.addScriptTag({ path: bundle });
  await p.evaluate(async (dark) => {
    const wait = (ms) => new Promise((q) => setTimeout(q, ms));
    const H = window.mockHass();
    H.states = { ...H.states, 'sensor.neste_tomming': { ...H.states['sensor.neste_tomming'], state: '1,Papir & Papp,Glass & Metall' } };
    H.themes = { ...(H.themes || {}), darkMode: dark };
    window.__H = H;
    const mk = (cfg) => { const el = document.createElement(cfg.type.replace('custom:', '')); el.setConfig(cfg); el.hass = H; window.__content.appendChild(el); return el; };
    mk({ type: 'custom:msh-strompris-card', card_id: 't57-strom' });
    window.__sop = mk({ type: 'custom:msh-soppel-card', card_id: 't57-sop' });
    mk({ type: 'custom:msh-hjem-gjoremal-card', card_id: 't57-gj' });
    await wait(900);
    window.setMode = async (d) => {
      const h2 = { ...window.__H, themes: { ...(window.__H.themes || {}), darkMode: d } };
      window.__H = h2;
      [...window.__content.children].forEach((e) => { e.hass = h2; });
      await wait(500);
    };
    window.metaTC = () => document.querySelector('meta[name="theme-color"]').getAttribute('content');
  }, dark);
  return { p, ctx };
}

/* ================================================================== A · Søppel-kortet + dashbordbakgrunnen */
for (const dark of [false, true]) {
  const M = dark ? 'mørk' : 'lys';
  const { p, ctx } = await haPage({ dark });
  const I = await p.evaluate(() => {
    const sr = window.__sop.shadowRoot, tr = sr.querySelector('.tr'), hc = sr.querySelector('ha-card');
    const cs = getComputedStyle(tr), hcs = getComputedStyle(hc), r = tr.getBoundingClientRect();
    const strom = window.__content.querySelector('msh-strompris-card').shadowRoot.querySelector('.srf');
    return { bg: cs.backgroundColor, sh: cs.boxShadow, bf: cs.backdropFilter, rad: cs.borderTopLeftRadius, pad: cs.padding, hc: [hcs.backgroundColor, hcs.boxShadow, hcs.borderTopStyle], rect: { x: r.left, y: r.top, w: r.width, h: r.height }, pink: tr.classList.contains('pink'),
      view: getComputedStyle(window.__view).backgroundColor, html: getComputedStyle(document.documentElement).backgroundColor, theme: document.documentElement.dataset.kiTheme,
      strom: strom ? getComputedStyle(strom).backgroundColor : null, dashBg: MSH.theme.dashBg() };
  });
  if (!dark) {
    ok(`57 A ${M}: Søppel-kortet er én dekkende flate (#fff = --ki-surface), radius 28, kant inset 1px rgba(0,0,0,.05) + svak skygge (--ki-card-sh), ingen backdrop-filter`,
      I.theme === 'light' && !I.pink && I.bg === 'rgb(255, 255, 255)' && I.rad === '28px' && /rgba\(0, 0, 0, 0\.05\) 0px 0px 0px 1px inset/.test(I.sh) && /0px 1px 3px/.test(I.sh) && I.bf === 'none', I);
    ok(`57 A ${M}: Strømpris-flaten er dekkende`, I.strom === 'rgb(255, 255, 255)', I.strom);
    ok(`57 A ${M}: dashbord-containeren har --ki-bg (#e6e6e6) – dekker temaets/HAs lag bak (simulert <html> #e1e1e1 + lag #e8e8e8)`, I.view === 'rgb(230, 230, 230)' && I.dashBg === '#e6e6e6', I);
  } else {
    ok(`57 A ${M}: Søppel-kortet uendret (transparent, ingen skygge, padding 40px 8px)`, I.bg === 'rgba(0, 0, 0, 0)' && I.sh === 'none' && I.pad === '40px 8px', I);
    ok(`57 A ${M}: dashbord-containeren #232323`, I.view === 'rgb(35, 35, 35)' && I.dashBg === '#232323', I);
  }
  ok(`57 A ${M}: ha-card uten flate (background none, ingen skygge/kant)`, I.hc[0] === 'rgba(0, 0, 0, 0)' && I.hc[1] === 'none' && I.hc[2] === 'none', I.hc);
  // Pikselrader på tvers av kortet: to loddrette søyler (innenfor kanten, utenfor tekst), fra topp til bunn – ingen skjøt
  const R = I.rect, xs = [10, R.w / 2], ys = []; // venstre kant og mellomrommet mellom tall- og tekstkolonnen
  for (let y = 30; y < R.h - 30; y += 3) ys.push(y); // innenfor hjørneradien (28)
  const col = await pixels(p, { x: R.x, y: R.y, width: R.w, height: R.h }, ys.flatMap((y) => xs.map((x) => [x, y])));
  ok(`57 A ${M}: ingen vannrett skjøt i Søppel-kortet (${ys.length} rader × 2 søyler, maks avvik ≤ 2)`, spread(col) <= 2, { spread: spread(col), first: col[0], last: col[col.length - 1] });
  // Dashbordbakgrunnen: søyle helt til venstre (utenfor kortene) over hele siden
  const H = await p.evaluate(() => Math.min(document.documentElement.scrollHeight, innerHeight));
  const bgPts = []; for (let y = 60; y < H - 4; y += 20) bgPts.push([4, y]);
  const bgc = await pixels(p, { x: 0, y: 0, width: 12, height: H }, bgPts);
  ok(`57 A ${M}: dashbordbakgrunnen er én jevn farge over hele høyden (ingen lag som slutter midt på siden)`, spread(bgc) <= 1 && near('#' + bgc[0].map((v) => v.toString(16).padStart(2, '0')).join(''), dark ? '#232323' : '#e6e6e6', 2), { spread: spread(bgc), c: bgc[0] });
  if (shots) await p.screenshot({ path: `${shots}/tema57-hjem-${dark ? 'dark' : 'light'}.png` });

  /* -------------------------------------------- B · theme-color: oppstart, modusbytte, HA overskriver, visibilitychange */
  const B = await p.evaluate(async (dark) => {
    const wait = (ms) => new Promise((q) => setTimeout(q, ms));
    const o = { start: [window.metaTC(), MSH.theme.dashBg()] };
    await window.setMode(!dark); o.switched = [window.metaTC(), MSH.theme.dashBg(), document.documentElement.dataset.kiTheme];
    await window.setMode(dark); o.back = [window.metaTC(), MSH.theme.dashBg()];
    // HA bytter tema → skriver sin egen verdi (applyThemesOnElement) + settheme
    document.querySelector('meta[name="theme-color"]').setAttribute('content', '#03a9f4');
    window.dispatchEvent(new CustomEvent('settheme', { detail: {} }));
    await wait(80); o.haWrite = window.metaTC();
    // ny hass.themes (HA temabytte): verdien settes på nytt
    const h2 = { ...window.__H, themes: { ...window.__H.themes } }; window.__H = h2; [...window.__content.children].forEach((e) => { e.hass = h2; });
    document.querySelector('meta[name="theme-color"]').setAttribute('content', '#123456');
    await wait(400); o.themes = window.metaTC();
    // visibilitychange (appbytte og retur): taggen fjernet mens appen var i bakgrunnen → opprettes og settes
    document.querySelector('meta[name="theme-color"]').remove();
    document.dispatchEvent(new Event('visibilitychange'));
    await wait(30); o.vis = [window.metaTC(), document.querySelectorAll('meta[name="theme-color"]').length];
    return o;
  }, dark);
  const D0 = dark ? '#232323' : '#e6e6e6', D1 = dark ? '#e6e6e6' : '#232323';
  ok(`57 B ${M}: theme-color = dashbordets bakgrunn ved oppstart (${D0})`, B.start[0] === D0 && B.start[1] === D0, B.start);
  ok(`57 B ${M}: bytte modus → theme-color følger straks (${D1}) og tilbake`, B.switched[0] === D1 && B.switched[1] === D1 && B.back[0] === D0, B);
  ok(`57 B ${M}: HA skriver over taggen (settheme) → vår verdi settes tilbake`, B.haWrite === D0, B.haWrite);
  ok(`57 B ${M}: nytt hass.themes → vår verdi settes tilbake`, B.themes === D0, B.themes);
  ok(`57 B ${M}: visibilitychange → taggen opprettes og settes (én tagg)`, B.vis[0] === D0 && B.vis[1] === 1, B.vis);
  // standard-UA: ingen layoutendring (ingen padding-top, headerfarge urørt)
  const L = await p.evaluate(() => ({ pt: getComputedStyle(window.__view).paddingTop, inl: window.__view.style.paddingTop, hdr: window.__view.getRootNode().host.style.getPropertyValue('--app-header-background-color'), cls: document.documentElement.classList.contains('ki-android') }));
  ok(`57 B ${M}: standard-UA (iOS/PC) – ingen layoutendring: padding-top 56px fra HA, ingen safe-area-padding, headerfarge urørt`, L.pt === '56px' && !L.inl && !L.hdr && !L.cls, L);
  await ctx.close();
}

/* ================================================================== B · Android: header i dashbordfargen, skjult header → safe area */
{
  const { p, ctx } = await haPage({ ua: ANDROID_UA, dark: false });
  const A1 = await p.evaluate(() => { const hd = window.__view.getRootNode().querySelector('.header'); return { hdr: getComputedStyle(hd).backgroundColor, tc: window.metaTC(), pt: getComputedStyle(window.__view).paddingTop, inl: window.__view.style.paddingTop }; });
  ok('57 B Android (lys): HA-headeren har dashbordets farge (ingen annen stripe), theme-color = samme, padding-top uendret med synlig header', A1.hdr === 'rgb(230, 230, 230)' && A1.tc === '#e6e6e6' && A1.pt === '56px' && !A1.inl, A1);
  await ctx.close();
  const { p: p2, ctx: c2 } = await haPage({ ua: ANDROID_UA, dark: true, hideHeader: true });
  const A2 = await p2.evaluate(() => ({ inl: window.__view.style.getPropertyValue('padding-top'), bg: getComputedStyle(window.__view).backgroundColor, tc: window.metaTC() }));
  ok('57 B Android (mørk, header skjult/kiosk): dashbord-containeren får padding-top env(safe-area-inset-top) med samme bakgrunn', /env\(safe-area-inset-top/.test(A2.inl) && A2.bg === 'rgb(35, 35, 35)' && A2.tc === '#232323', A2);
  await c2.close();
}

/* ================================================================== B · popup (ekte Bubble Card) og D · Vær */
async function bubble({ light = false, hash = '#test57', card, ua } = {}) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, ...(ua ? { userAgent: ua } : {}) });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + resolve('test/harness-bubble.html'));
  for (const m of mocks) await p.addScriptTag({ path: m });
  await p.addScriptTag({ path: bundle });
  await p.addScriptTag({ path: BC, type: 'module' });
  await p.waitForFunction(() => customElements.get('bubble-card'), null, { timeout: 15000 });
  await p.evaluate(async ({ light, hash, card }) => {
    const wait = (ms) => new Promise((q) => setTimeout(q, ms));
    const H = window.mockHass(); H.themes = { ...(H.themes || {}), darkMode: !light };
    H.states = { ...H.states };
    window.__h = H;
    await MSH.store.load(H);
    // et vanlig kort på dashbordet (gir MSH.theme hass)
    const dc = document.createElement('msh-soppel-card'); dc.setConfig({ type: 'custom:msh-soppel-card', card_id: 'd57' }); dc.hass = H; document.getElementById('dash').appendChild(dc);
    const base = MSH.popupTemplateA({ name: 'Test', icon: 'mdi:home', hash, card });
    const pop = (MSH.POPUP_FORCE && MSH.POPUP_FORCE[hash] && MSH.POPUP_FORCE[hash](base)) || base;
    const bc = document.createElement('bubble-card'); bc.setConfig(pop); bc.hass = H; document.getElementById('dash').appendChild(bc);
    window.__bc = bc;
    await wait(500);
    window.metaTC = () => { const m = document.querySelector('meta[name="theme-color"]'); return m && m.getAttribute('content'); };
    window.findDeep = (pred) => { const all = []; const walk = (r) => r.querySelectorAll('*').forEach((e) => { all.push(e); if (e.shadowRoot && e.localName !== 'ha-icon') walk(e.shadowRoot); }); walk(document); return all.find(pred); };
    window.setH = async (patch) => {
      const H2 = { ...window.__h, states: { ...window.__h.states } };
      Object.entries(patch).forEach(([id, st]) => { H2.states[id] = { ...(H2.states[id] || { entity_id: id, attributes: {} }), ...st, last_updated: new Date().toISOString() }; });
      window.__h = H2; window.__bc.hass = H2; dc.hass = H2;
      const vc = window.findDeep((e) => e.localName === 'msh-vaer-card'); if (vc) vc.hass = H2;
      await wait(400);
    };
    // Registrert ETTER temamodulen og Bubble: måler theme-color i samme hashchange-hendelse som åpner popupen
    window.__atHash = [];
    window.addEventListener('hashchange', () => { window.__atHash.push([location.hash, window.metaTC()]); });
  }, { light, hash, card });
  return { p, ctx };
}
const toHex = (c) => '#' + c.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

for (const light of [false, true]) {
  const M = light ? 'lys' : 'mørk';
  const { p, ctx } = await bubble({ light, card: { type: 'custom:msh-hjem-gjoremal-card', card_id: 'pop57' } });
  const P = await p.evaluate(async () => {
    const wait = (ms) => new Promise((q) => setTimeout(q, ms));
    const o = { dash: MSH.theme.dashBg(), before: window.metaTC() };
    location.hash = '#test57'; await wait(30); o.at = window.__atHash.slice(-1)[0];
    await wait(800);
    o.open = window.metaTC();
    // forventet: bakteppet (dimmingen) lagt over dashbordets bakgrunn – det som ligger rett under statuslinjen
    const host = document.querySelector('body > .bubble-backdrop-host'), bd = host && host.shadowRoot.querySelector('.bubble-backdrop');
    o.dim = bd ? getComputedStyle(bd).backgroundColor : null;
    const pop = window.findDeep((e) => e.classList && e.classList.contains('bubble-pop-up') && !e.classList.contains('editor'));
    o.popTop = pop ? Math.round(pop.getBoundingClientRect().top) : null;
    o.exp = MSH.theme.popupTopColor('#test57');
    const p1 = MSH.theme.parse(o.dim), p0 = MSH.theme.parse(o.dash);
    o.calc = p1 ? [0, 1, 2].map((i) => p1[i] * p1[3] + p0[i] * (1 - p1[3])) : null;
    history.replaceState(null, '', location.pathname); window.dispatchEvent(new HashChangeEvent('hashchange')); // lukk (som Bubble: hash fjernes)
    await wait(30); o.closed = window.metaTC();
    await wait(600); o.closed2 = window.metaTC();
    return o;
  });
  const calc = P.calc ? toHex(P.calc) : null;
  ok(`57 B ${M}: popup åpen → theme-color = dimmingen over dashbordet (${calc}), satt i samme hashchange som åpner popupen`, P.before === P.dash && P.at && P.at[1] === P.open && near(P.open, calc, 2) && P.open !== P.dash && P.popTop > 20, P);
  ok(`57 B ${M}: popup lukket → tilbake til dashbordets farge straks (ingen blink)`, P.closed === P.dash && P.closed2 === P.dash, P);
  await ctx.close();
}

// D · Vær (ekte Bubble Card, scene-stil, fullskjerm)
const SCB = { cloudy: '#4a525e', sunny: '#2f6fb0', rainy: '#323a46', 'clear-night': '#0b1224' };
for (const light of [true, false]) {
  const M = light ? 'lys' : 'mørk';
  const { p, ctx } = await bubble({ light, hash: '#vaer', card: { type: 'custom:msh-vaer-card', card_id: 'pop-vaer57' }, ua: light ? ANDROID_UA : undefined });
  const V = await p.evaluate(async (SCB) => {
    const wait = (ms) => new Promise((q) => setTimeout(q, ms));
    const o = { dash: MSH.theme.dashBg(), conds: {} };
    // første åpning (kortet tegnes) og lukking
    location.hash = '#vaer'; await wait(1500);
    o.first = window.metaTC();
    history.replaceState(null, '', location.pathname); window.dispatchEvent(new HashChangeEvent('hashchange')); await wait(700);
    o.closedFirst = window.metaTC();
    for (const k of Object.keys(SCB)) {
      await window.setH({ 'weather.home': { state: k } });
      location.hash = '#vaer'; await wait(30);
      const at = window.__atHash.slice(-1)[0];
      await wait(900);
      o.conds[k] = { at: at && at[1], open: window.metaTC() };
      history.replaceState(null, '', location.pathname); window.dispatchEvent(new HashChangeEvent('hashchange')); await wait(30);
      o.conds[k].closed = window.metaTC();
      await wait(600);
    }
    // værtypen endres mens popupen er åpen
    await window.setH({ 'weather.home': { state: 'cloudy' } });
    location.hash = '#vaer'; await wait(900);
    o.live0 = window.metaTC();
    await window.setH({ 'weather.home': { state: 'rainy' } });
    o.live1 = window.metaTC();
    // bytt sted (stedsvelgeren nederst) mens popupen er åpen
    const vc = window.findDeep((e) => e.localName === 'msh-vaer-card');
    const ctl = vc && vc._ctl && vc._ctl.shadowRoot;
    o.place = null;
    if (ctl) {
      ctl.querySelector('[data-a="place"]').click(); await wait(200);
      const items = [...vc._ctl.shadowRoot.querySelectorAll('[data-a="pick"]')];
      const it = items.find((x) => !x.classList.contains('on') && /weather\.(hytta|oslo_sentrum)/.test(x.textContent));
      if (it) {
        const ent = /weather\.[\w]+/.exec(it.textContent)[0];
        it.click(); await wait(700);
        const st = window.__h.states[ent].state;
        o.place = { ent, st, tc: window.metaTC() };
      }
    }
    // full-skjerm: værbakgrunnen dekker toppen (under statuslinjen), headeren rett under safe area
    const pop = window.findDeep((e) => e.classList && e.classList.contains('bubble-pop-up') && !e.classList.contains('editor'));
    o.full = pop ? { top: Math.round(pop.getBoundingClientRect().top), attr: pop.hasAttribute('data-ki-vaer-full'), hpt: getComputedStyle(pop.querySelector('.bubble-header-container')).paddingTop } : null;
    history.replaceState(null, '', location.pathname); window.dispatchEvent(new HashChangeEvent('hashchange')); await wait(30);
    o.closed = window.metaTC();
    return o;
  }, SCB);
  const bad = Object.entries(SCB).filter(([k, c]) => !V.conds[k] || V.conds[k].at !== c || V.conds[k].open !== c || V.conds[k].closed !== V.dash);
  ok(`57 D ${M}: Vær åpen → theme-color = C.bg[0] (cloudy ${SCB.cloudy}, sunny ${SCB.sunny}, rainy ${SCB.rainy}, clear-night ${SCB['clear-night']}) satt i samme hashchange som åpner popupen; lukket → dashbordfargen`, !bad.length, { bad, V });
  ok(`57 D ${M}: første åpning (kortet tegnes underveis) gir værfargen, lukking gir dashbordfargen`, /^#[0-9a-f]{6}$/.test(V.first || '') && V.first !== V.dash && V.closedFirst === V.dash, { first: V.first, closed: V.closedFirst });
  ok(`57 D ${M}: ny værtype mens Vær er åpen → statuslinjen følger med (cloudy → rainy)`, V.live0 === SCB.cloudy && V.live1 === SCB.rainy, { live0: V.live0, live1: V.live1 });
  const SCALL = { snowy: '#56627a', rainy: '#323a46', cloudy: '#4a525e', sunny: '#2f6fb0' };
  ok(`57 D ${M}: bytt sted mens Vær er åpen → statuslinjen følger stedets værtype`, V.place && V.place.tc === SCALL[V.place.st], V.place);
  ok(`57 D ${M}: fullskjerm – værbakgrunnen går helt til toppen (under statuslinjen), lukket → dashbordfargen`, V.full && V.full.attr && V.full.top === 0 && V.closed === V.dash, { full: V.full, closed: V.closed });
  if (shots) { await p.evaluate(async () => { location.hash = '#vaer'; await new Promise((q) => setTimeout(q, 1200)); }); await p.screenshot({ path: `${shots}/tema57-vaer-${light ? 'light' : 'dark'}.png` }); }
  await ctx.close();
}

await b.close();
try { rmSync(bundle); } catch (e) { /* */ }
ok('ingen sidefeil', !errs.length, errs.slice(0, 5));
console.log(JSON.stringify(res, null, 1));
console.log(fail.length ? `${fail.length} FEIL: ${fail.join(' · ')}` : 'Alle tema 57-sjekker OK');
process.exit(fail.length ? 1 : 0);
