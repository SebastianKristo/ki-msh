// Fiks 34 (Del A) + 35.7 · lyst/mørkt tema (ki-theme, src/00-a-theme.js) mot EKTE Bubble Card, mobil 390 px.
//  · bytter hass.themes.darkMode i mock-hass UTEN reload → data-ki-theme på <html>, dashbord-containeren (hui-root #view),
//    ki-overlay-root (ark/toast) og hver Bubble popup-rot (.bubble-pop-up)
//  · beregnede farger i begge moduser: prosa (løpetekst + pille), fanelinje (spor/inaktiv/aktiv), Hjem-kort (rom-flis,
//    ikonsirkel, badge-ring, termostat-stepper), navbar, mini-spiller (+ play), ark, toast, Bubble-header (bakgrunn, navn,
//    lukk-knapp, ikon-sirkel) og bakteppe
//  · lys modus: tekstkontrast ≥ 4,5:1 (også en bred skanning av all tekst i Hjem/navbar/mini/ark/toast/header)
//  · mørk modus: dagens hex (fasit i EXPECT_DARK) – og med TEMA_BASE=<bundel bygd fra før-koden> sammenlignes ALLE
//    beregnede farger (color/bakgrunn/kant/skygge/fill) i Hjem, navbar, popup og ark element for element
//  · mørke øyer (regel 2): mørk gradient → data-theme="dark" + tokens nullstilt; [data-ki-island] eksplisitt
//  · hjelperne tone/accentText/whiteA/blackA/grayText
// Kjør: node test/tema34-check.mjs   (SHOT_DIR=<mappe> gir skjermbilder lys/mørk)
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { readdirSync, mkdirSync, existsSync, unlinkSync } from 'node:fs';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const R = resolve('.') + '/';
mkdirSync('test/.build', { recursive: true });
mkdirSync('test/.vendor', { recursive: true });
const BC = resolve('test/.vendor/bubble-card.js');
if (!existsSync(BC)) execFileSync('curl', ['-sSL', '-o', BC, 'https://raw.githubusercontent.com/Clooos/Bubble-Card/main/dist/bubble-card.js']);
const bundle = resolve(`test/.build/tema34-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle], { cwd: R, stdio: 'inherit' });
const BASE = process.env.TEMA_BASE ? resolve(process.env.TEMA_BASE) : null;
const SHOT = process.env.SHOT_DIR ? resolve(process.env.SHOT_DIR) : null;
if (SHOT) mkdirSync(SHOT, { recursive: true });
const mocks = readdirSync(R + 'test/mock').filter((f) => f.endsWith('.js')).sort().map((f) => R + 'test/mock/' + f);
const browser = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => pw.chromium.launch());
const res = [];
const ok = (name, cond, info) => { res.push(`${cond ? '✔' : '✘'} ${name}${info != null ? ' · ' + JSON.stringify(info) : ''}`); };

// Dagens farger i mørk modus (fasit fra før token-byttet)
const EXPECT_DARK = {
  prosaText: 'rgb(250, 250, 250)', prosaPillBg: 'rgb(250, 250, 250)', prosaPillFg: 'rgb(47, 47, 47)',
  rkBg: 'rgb(47, 47, 47)', rkFg: 'rgb(250, 250, 250)', rkIcOff: 'rgb(64, 64, 64)',
  navBg: 'rgb(225, 225, 225)', navFg: 'rgb(35, 35, 35)', miniBg: 'rgb(225, 225, 225)', miniFg: 'rgb(35, 35, 35)', playBg: 'rgb(250, 250, 250)', playFg: 'rgb(35, 35, 35)',
  sheetBg: 'rgb(40, 40, 40)', sheetFg: 'rgb(250, 250, 250)', toastBg: 'rgb(225, 225, 225)', toastFg: 'rgb(35, 35, 35)',
};

async function setup(bundlePath) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('file://' + R + 'test/harness-bubble.html');
  for (const m of mocks) await page.addScriptTag({ path: m });
  // Falsk HA-struktur: home-assistant → ha-panel-lovelace → hui-root → #view (dashbord-containeren)
  await page.evaluate(() => {
    const ha = document.createElement('home-assistant'); ha.attachShadow({ mode: 'open' });
    const panel = document.createElement('ha-panel-lovelace'); panel.attachShadow({ mode: 'open' }); ha.shadowRoot.appendChild(panel);
    const root = document.createElement('hui-root'); root.attachShadow({ mode: 'open' }); panel.shadowRoot.appendChild(root);
    const view = document.createElement('div'); view.id = 'view'; view.style.cssText = 'display:flex;flex-direction:column;gap:8px;padding:0 0 200px'; root.shadowRoot.appendChild(view);
    document.getElementById('dash').appendChild(ha);
    window.VIEW = view;
    document.documentElement.style.background = document.body.style.background = 'var(--ki-bg, #232323)';
  });
  await page.addScriptTag({ path: bundlePath });
  await page.addScriptTag({ path: BC, type: 'module' });
  await page.waitForFunction(() => customElements.get('bubble-card'), null, { timeout: 10000 });
  await page.evaluate(async () => {
    window.deepAll = (sel, root) => { const out = []; const walk = (r) => r.querySelectorAll('*').forEach((e) => { if (e.matches(sel)) out.push(e); if (e.shadowRoot) walk(e.shadowRoot); }); walk(root || document); return out; };
    window.deep = (sel, root) => window.deepAll(sel, root)[0] || null;
    const H = window.mockHass();
    const S = H.states;
    Object.keys(S).filter((k) => k.startsWith('media_player.')).forEach((k) => { S[k] = { ...S[k], state: 'off' }; });
    S['media_player.kjokken_radio'] = { ...S['media_player.kjokken_radio'], state: 'playing', last_changed: new Date().toISOString() };
    window.H = H;
    const mk = (cfg) => { const el = document.createElement(cfg.type.replace('custom:', '')); el.setConfig(cfg); el.hass = H; return el; };
    VIEW.appendChild(mk({ type: 'custom:msh-hjem-card', card_id: 'hjem1' }));
    VIEW.appendChild(mk({ type: 'custom:msh-navbar-card', card_id: 'ki-navbar' }));
    // Bubble-popup (mal A) med Lys-kortet + mal B rom-popup
    const pa = MSH.popupTemplateA({ name: 'Lys', icon: 'mdi:lightbulb', hash: '#lys', card: { type: 'custom:msh-lys-card', card_id: 'pop-lys' } });
    const pb = MSH.popupTemplateB({ name: 'Stue', icon: 'mdi:sofa', hash: '#stue', color: 'var(--orange)', card: { type: 'custom:msh-rom-card', card_id: 'rom-stue', area: 'stue' } });
    for (const cfg of [pa, pb]) { const bc = document.createElement('bubble-card'); bc.setConfig(cfg); bc.hass = H; VIEW.appendChild(bc); }
    await new Promise((r) => setTimeout(r, 900));
    // Bytt modus som HA: nytt hass-objekt med themes.darkMode
    window.setMode = async (dark) => {
      const h2 = { ...window.H, themes: { ...window.H.themes, darkMode: dark } };
      window.H = h2;
      deepAll('*').filter((e) => e.localName.startsWith('msh-') || e.localName === 'bubble-card').forEach((e) => { try { if ('hass' in e || e._hass) e.hass = h2; } catch (x) { /* */ } });
      await new Promise((r) => setTimeout(r, 600));
    };
  });
  return { page, errs };
}

// Beregnede farger for nøkkelelementene (null = finnes ikke)
const SNAP = () => {
  const cs = (el) => (el ? getComputedStyle(el) : null);
  const g = (el, p) => (el ? getComputedStyle(el)[p] : null);
  const pz = deep('.pz'), chip = deep('.pz .chip');
  const track = deep('.hts-glide') || deep('.hts-top') || deep('.mtb-tabs') || deep('.tabs .tg') || deep('.tabs');
  const tIn = track && [...track.querySelectorAll('button,span')].find((b) => /hts-gt|hts-tt|mtb-t|(^|\s)tab(\s|$)/.test(b.className) && !b.classList.contains('on'));
  const tOn = track && track.querySelector('.on');
  const rk = deep('.rk:not(.rk-s)') || deep('.rk');
  const ic = deep('.rk-ic');
  const icOff = deepAll('.rk-ic').find((e) => /64, 64, 64|235, 235, 235/.test(getComputedStyle(e).backgroundColor)) || null;
  const kv = deep('.rk-kv');
  const bang = deep('.rk-bang');
  const nav = deep('nav.nb'), mini = deep('[data-mini]'), mpp = deep('.mpp');
  const pop = deep('.bubble-pop-up.is-popup-opened') || null;
  const pr = (sel) => (pop ? pop.querySelector(sel) : null);
  const bd = deep('.bubble-backdrop');
  const portal = deep('.msh-portal'); const sheet = portal && portal.shadowRoot ? portal.shadowRoot.querySelector('.sh') : null;
  const toast = deep('#msh-toast');
  const ov = document.querySelector('body > ki-overlay-root');
  return {
    attr: { html: document.documentElement.getAttribute('data-ki-theme'), view: VIEW.getAttribute('data-ki-theme'), overlay: ov && ov.getAttribute('data-ki-theme'), pops: deepAll('.bubble-pop-up').map((p) => p.getAttribute('data-ki-theme')) },
    prosaText: g(pz, 'color'), prosaPillBg: g(chip, 'backgroundColor'), prosaPillFg: g(chip, 'color'), prosaPillSh: g(chip, 'boxShadow'),
    trackBg: g(track, 'backgroundColor'), tabIn: g(tIn, 'color'), tabOn: g(tOn, 'color'), tabOnBg: g(tOn, 'backgroundImage'),
    rkBg: g(rk, 'backgroundColor'), rkFg: g(rk, 'color'), rkSh: g(rk, 'boxShadow'), rkIc: g(ic, 'backgroundColor'), rkIcFg: g(ic, 'color'), rkIcOff: g(icOff, 'backgroundColor'), rkIcOffFg: g(icOff, 'color'),
    kvBg: g(kv, 'backgroundImage'), kvFg: g(kv, 'color'), bangRing: g(bang, 'boxShadow'),
    navBg: g(nav, 'backgroundColor'), navFg: g(nav, 'color'), miniBg: g(mini, 'backgroundColor'), miniFg: g(mini, 'color'), playBg: g(mpp, 'backgroundColor'), playFg: g(mpp, 'color'),
    popBg: g(pr('.bubble-pop-up-background'), 'backgroundColor'), popName: g(pr('.bubble-name'), 'color'), popClose: g(pr('.bubble-close-button'), 'backgroundColor'), popCloseFg: g(pr('.bubble-close-button svg'), 'fill'),
    popIcon: g(pr('.icon-container'), 'backgroundColor'), popIconFg: g(pr('.icon-container > ha-icon'), 'color'), popHdr: g(pr('#header-container > div > div'), 'backgroundColor'),
    backdrop: g(bd, 'backgroundColor'),
    sheetBg: g(sheet, 'backgroundColor'), sheetFg: g(sheet, 'color'), toastBg: g(toast, 'backgroundColor'), toastFg: g(toast, 'color'),
  };
};

// Alle beregnede farger under en rot (element for element, gjennom shadow roots) – for mørk-sammenligningen
const ALLCOL = (sel) => {
  const out = [];
  const props = ['color', 'backgroundColor', 'backgroundImage', 'borderTopColor', 'boxShadow', 'fill', 'stroke', 'outlineColor'];
  const walk = (r, path) => {
    [...r.children].forEach((e, i) => {
      const p = path + '/' + e.localName + i;
      if (e.localName !== 'style' && e.localName !== 'script') {
        const c = getComputedStyle(e);
        out.push([p, props.map((k) => c[k]).join('|').replace(/url\("#[^"]*"\)/g, 'url(#id)')]);
      }
      if (e.shadowRoot) walk(e.shadowRoot, p + '#');
      walk(e, p);
    });
  };
  document.querySelectorAll(sel).forEach((r, i) => walk(r.shadowRoot || r, sel + i));
  return out;
};

const openSheetToast = (page) => page.evaluate(async () => {
  window.dispatchEvent(new CustomEvent('ki-open-editor', { detail: { editor: 'navbar' } })); // ekte «Tilpass navbar»-ark
  MSH.toast('Lagret', { type: 'ok', ms: 20000 });
  await new Promise((r) => setTimeout(r, 900));
});
const closeSheets = (page) => page.evaluate(async () => { const s = document.querySelector('body > ki-overlay-root'); if (s) s.shadowRoot.querySelector('.slot').innerHTML = ''; await new Promise((r) => setTimeout(r, 100)); });

/* ------------------------------------------------------------ hoveddel */
const { page, errs } = await setup(bundle);
const lum = (s) => { const m = /rgba?\(([^)]+)\)/.exec(s || ''); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); const f = (u) => { u /= 255; return u <= 0.03928 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4); }; return 0.2126 * f(p[0]) + 0.7152 * f(p[1]) + 0.0722 * f(p[2]); };
const cr = (a, b) => { const x = lum(a), y = lum(b); if (x == null || y == null) return null; return +((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)).toFixed(2); };

// --- mørk (standard) ---
let dark = await page.evaluate(SNAP);
ok('mørk: data-ki-theme="dark" på html/dashbord', dark.attr.html === 'dark' && dark.attr.view === 'dark', dark.attr);
for (const [k, v] of Object.entries(EXPECT_DARK)) ok(`mørk: ${k} = dagens farge`, dark[k] === v || dark[k] == null, { er: dark[k], fasit: v });
// popup åpen i mørk modus
await page.evaluate(async () => { location.hash = '#lys'; await new Promise((r) => setTimeout(r, 1300)); });
await openSheetToast(page);
dark = await page.evaluate(SNAP);
ok('mørk: popup-rot + overlay-rot merket dark', dark.attr.pops.includes('dark') && dark.attr.overlay === 'dark', dark.attr);
for (const k of ['sheetBg', 'sheetFg', 'toastBg', 'toastFg']) ok(`mørk: ${k} = dagens farge`, dark[k] === EXPECT_DARK[k], { er: dark[k], fasit: EXPECT_DARK[k] });
const darkHdr = { popName: dark.popName, popClose: dark.popClose, popIcon: dark.popIcon, popHdr: dark.popHdr, popBg: dark.popBg, backdrop: dark.backdrop };
if (SHOT) await page.screenshot({ path: `${SHOT}/mork-popup-ark.png` });
await closeSheets(page);
await page.evaluate(async () => { history.replaceState(null, '', location.pathname); window.dispatchEvent(new HashChangeEvent('hashchange')); await new Promise((r) => setTimeout(r, 900)); });
if (SHOT) await page.screenshot({ path: `${SHOT}/mork-hjem.png`, fullPage: true });

// --- lys (uten reload) ---
await page.evaluate(() => setMode(false));
let light = await page.evaluate(SNAP);
ok('lys: data-ki-theme="light" på html og dashbord-containeren (uten reload)', light.attr.html === 'light' && light.attr.view === 'light', light.attr);
ok('lys: popup-røtter i DOM merket light', light.attr.pops.every((x) => x === 'light'), light.attr.pops);
ok('lys: prosa løpetekst = --ki-text-2 (#565656)', light.prosaText === 'rgb(86, 86, 86)', light.prosaText);
ok('lys: prosa-pille hvit flate + mørk tekst + skygge', light.prosaPillBg === 'rgb(255, 255, 255)' && lum(light.prosaPillFg) < 0.05 && /rgba\(0, 0, 0, 0.08\)/.test(light.prosaPillSh), { bg: light.prosaPillBg, fg: light.prosaPillFg, sh: light.prosaPillSh });
ok('lys: fanespor = --ki-surface-3, inaktiv = --ki-text-2, aktiv tekst mørk på rosa', (light.trackBg === 'rgb(222, 222, 222)' || light.trackBg === 'rgba(0, 0, 0, 0)') && light.tabIn === 'rgb(86, 86, 86)' && (light.tabOn == null || lum(light.tabOn) < 0.05), { spor: light.trackBg, inaktiv: light.tabIn, aktiv: light.tabOn });
ok('lys: Hjem-kort hvitt + mørk tittel + skygge', light.rkBg === 'rgb(255, 255, 255)' && lum(light.rkFg) < 0.05 && /0px 1px 3px/.test(light.rkSh || ''), { bg: light.rkBg, fg: light.rkFg, sh: light.rkSh });
ok('lys: inaktiv ikonsirkel --ki-surface-2 + ikon --ki-text-2', light.rkIcOff == null || (light.rkIcOff === 'rgb(235, 235, 235)' && light.rkIcOffFg === 'rgb(86, 86, 86)'), { bg: light.rkIcOff, fg: light.rkIcOffFg });
ok('lys: termostat-stepper lys gradient + mørk tekst', light.kvBg == null || (/rgb\(255, 255, 255\)/.test(light.kvBg) && lum(light.kvFg) < 0.05), { bg: light.kvBg, fg: light.kvFg });
ok('lys: badge-ring = --ki-bg', light.bangRing == null || /rgb\(230, 230, 230\)/.test(light.bangRing), light.bangRing);
ok('lys: navbar hvit + mørk tekst', light.navBg === 'rgb(255, 255, 255)' && lum(light.navFg) < 0.05, { bg: light.navBg, fg: light.navFg });
ok('lys: mini-spiller hvit + mørk tekst, play invers', light.miniBg === 'rgb(255, 255, 255)' && lum(light.miniFg) < 0.05 && light.playBg === 'rgb(28, 28, 28)' && light.playFg === 'rgb(250, 250, 250)', { bg: light.miniBg, fg: light.miniFg, play: [light.playBg, light.playFg] });
if (SHOT) await page.screenshot({ path: `${SHOT}/lys-hjem.png`, fullPage: true });

// Kontrast-skanning (lys): all synlig tekst i Hjem, navbar og mini-spiller
const SCAN = ([rootSel, skip]) => {
  skip = skip || [];
  const bad = [], seen = { n: 0 };
  const lumOf = (s) => { const m = /rgba?\(([^)]+)\)/.exec(s || ''); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return p; };
  const bgOf = (el) => {
    let n = el;
    for (let i = 0; n && i < 80; i++) {
      if (n.nodeType === 1) {
        const c = getComputedStyle(n);
        if (c.backgroundImage && c.backgroundImage !== 'none') { const m = c.backgroundImage.match(/rgba?\([^)]*\)/g); if (m && m.length) { const ps = m.map(lumOf).filter((p) => p && (p[3] == null || p[3] > 0.4)); if (ps.length) return ps.reduce((a, p) => [a[0] + p[0] / ps.length, a[1] + p[1] / ps.length, a[2] + p[2] / ps.length], [0, 0, 0]); } }
        const p = lumOf(c.backgroundColor); if (p && (p[3] == null || p[3] > 0.5)) return p;
      }
      n = n.parentNode || n.host;
    }
    return [230, 230, 230];
  };
  const L = (p) => { const f = (u) => { u /= 255; return u <= 0.03928 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4); }; return 0.2126 * f(p[0]) + 0.7152 * f(p[1]) + 0.0722 * f(p[2]); };
  const opac = (el) => { let o = 1, n = el; for (let i = 0; n && i < 80; i++) { if (n.nodeType === 1) o *= Number(getComputedStyle(n).opacity); n = n.parentNode || n.host; } return o; };
  const walk = (r) => r.querySelectorAll('*').forEach((e) => {
    if (skip.includes(e.localName) || (e.closest && skip.some((t) => e.closest(t)))) return;
    if (e.shadowRoot) walk(e.shadowRoot);
    const txt = [...e.childNodes].filter((t) => t.nodeType === 3 && t.textContent.trim()).map((t) => t.textContent.trim()).join(' ');
    if (!txt) return;
    const rc = e.getBoundingClientRect(); if (!rc.width || !rc.height) return;
    const c = getComputedStyle(e); if (c.visibility === 'hidden' || c.display === 'none') return;
    if (opac(e) < 0.6) return; // bevisst nedtonet (deaktivert/skjult rad)
    if (e.closest && e.closest('[data-theme=dark],[data-ki-island]')) return; // mørk øy
    const fg = lumOf(c.color); if (!fg) return;
    const bg = bgOf(e);
    const a = fg[3] == null ? 1 : fg[3];
    const mix = [fg[0] * a + bg[0] * (1 - a), fg[1] * a + bg[1] * (1 - a), fg[2] * a + bg[2] * (1 - a)];
    const k = (Math.max(L(mix), L(bg)) + 0.05) / (Math.min(L(mix), L(bg)) + 0.05);
    seen.n++;
    if (k < 4.5) bad.push({ t: txt.slice(0, 24), k: +k.toFixed(2), fg: c.color, bg: `rgb(${bg.map(Math.round).join(',')})`, cls: String(e.className || e.localName).slice(0, 30) });
  });
  deepAll(rootSel).forEach((r) => walk(r.shadowRoot || r));
  return { n: seen.n, bad };
};
// Kortene i Hjem som andre filer eier (strømpris, gjøremål, søppel) byttes til tokens av egne oppgaver – rapporteres bare
const OTHERS = ['msh-strompris-card', 'msh-hjem-gjoremal-card', 'msh-soppel-card'];
const scanHjem = await page.evaluate(SCAN, ['msh-hjem-card', OTHERS]);
ok(`lys: kontrast ≥ 4,5:1 for all tekst i Hjem-header/prosa/faner/rom-/flis-kort (${scanHjem.n} tekster)`, scanHjem.bad.length === 0, scanHjem.bad.slice(0, 40));
const scanOther = await page.evaluate(SCAN, [OTHERS.join(','), []]);
res.push(`ℹ lys: kontrast i ${OTHERS.join(', ')} (ikke i denne oppgaven): ${scanOther.bad.length} av ${scanOther.n} tekster under 4,5:1`);
const scanNav = await page.evaluate(SCAN, ['msh-navbar-card', []]);
ok(`lys: kontrast ≥ 4,5:1 i navbar + mini-spiller (${scanNav.n} tekster)`, scanNav.bad.length === 0, scanNav.bad.slice(0, 8));

// popup i lys modus (åpnes etter byttet → MutationObserver/hash-skanning merker roten)
await page.evaluate(async () => { location.hash = '#lys'; await new Promise((r) => setTimeout(r, 1300)); });
await openSheetToast(page);
light = await page.evaluate(SNAP);
ok('lys: overlay-rot merket light', light.attr.overlay === 'light', light.attr);
ok('lys: Bubble-popup bakgrunn = --ki-popup (#f0f0f0 · 98 %)', /rgba?\(240, 240, 240|srgb 0\.94117\d* 0\.94117\d* 0\.94117\d* \/ 0\.98/.test(light.popBg || ''), light.popBg);
ok('lys: Bubble-header navn --ki-text', lum(light.popName) < 0.05, light.popName);
ok('lys: Bubble lukk-knapp --ki-surface-2 + mørkt ikon', light.popClose === 'rgb(235, 235, 235)' && lum(light.popCloseFg) < 0.05, { bg: light.popClose, fg: light.popCloseFg });
ok('lys: Bubble ikon-sirkel (mal A) --ki-surface + mørkt ikon', light.popIcon === 'rgb(255, 255, 255)' && lum(light.popIconFg) < 0.05, { bg: light.popIcon, fg: light.popIconFg });
ok('lys: ingen mørk stripe i headeren', light.popHdr == null || lum(light.popHdr) > 0.7, light.popHdr);
ok('lys: bakteppe rgba(0,0,0,.2)', light.backdrop === 'rgba(0, 0, 0, 0.2)', light.backdrop);
ok('lys: ark = --ki-popup + mørk tekst', light.sheetBg === 'rgb(240, 240, 240)' && lum(light.sheetFg) < 0.05, { bg: light.sheetBg, fg: light.sheetFg });
ok('lys: toast invers (mørk pille, lys tekst)', light.toastBg === 'rgb(28, 28, 28)' && light.toastFg === 'rgb(250, 250, 250)' && cr(light.toastBg, light.toastFg) >= 4.5, { bg: light.toastBg, fg: light.toastFg });
const scanSheet = await page.evaluate(SCAN, ['ki-overlay-root', []]);
ok(`lys: kontrast ≥ 4,5:1 i ark + toast (${scanSheet.n} tekster)`, scanSheet.bad.length === 0, scanSheet.bad.slice(0, 8));
if (SHOT) await page.screenshot({ path: `${SHOT}/lys-popup-ark.png` });
await closeSheets(page);

// Mal B (rom-popup): ikon-sirkelen beholder romfargen, ikon mørkt
await page.evaluate(async () => { location.hash = '#stue'; await new Promise((r) => setTimeout(r, 1300)); });
const romB = await page.evaluate(() => { const p = deep('.bubble-pop-up.is-popup-opened'); const i = p && p.querySelector('.icon-container'); return { kind: p && p.getAttribute('data-ki-pop-icon'), bg: i && getComputedStyle(i).backgroundColor, theme: p && p.getAttribute('data-ki-theme') }; });
ok('lys: rom-popup (mal B) ikon-sirkel i romfarge', romB.kind === 'accent' && romB.bg === 'rgb(242, 181, 115)' && romB.theme === 'light', romB);

// Mørke øyer (regel 2) – mørk gradient i en popup + eksplisitt [data-ki-island]
const isl = await page.evaluate(async () => {
  const pop = deep('.bubble-pop-up.is-popup-opened');
  const host = pop.querySelector('.bubble-pop-up-container');
  const d = document.createElement('div'); d.id = 'isl-test';
  d.style.cssText = 'height:120px;border-radius:24px;background:linear-gradient(160deg,#1d3346,#0f1c26);color:var(--ki-text, #fafafa)';
  d.innerHTML = '<span id="isl-t" style="color:var(--ki-text, #fafafa)">Mørk øy</span>';
  const e = document.createElement('div'); e.setAttribute('data-ki-island', ''); e.innerHTML = '<span id="isl-e" style="color:var(--ki-text, #fafafa)">Eksplisitt</span>';
  const l = document.createElement('div'); l.id = 'isl-no'; l.style.cssText = 'height:80px;background:linear-gradient(#ffffff,#f2f2f2)'; l.innerHTML = '<span id="isl-n" style="color:var(--ki-text, #fafafa)">Lys</span>';
  host.prepend(d, e, l);
  await new Promise((r) => setTimeout(r, 450)); // MutationObserver (debounce 150 ms)
  const c = (id) => getComputedStyle(pop.querySelector('#' + id)).color;
  return { theme: d.getAttribute('data-theme'), auto: d.getAttribute('data-ki-island-auto'), t: c('isl-t'), e: c('isl-e'), lightT: c('isl-n'), lightIsl: pop.querySelector('#isl-no').getAttribute('data-theme') };
});
ok('regel 2: mørk gradient → data-theme="dark", lys tekst beholdes', isl.theme === 'dark' && isl.t === 'rgb(250, 250, 250)', isl);
ok('regel 2: [data-ki-island] eksplisitt → mørke tokens', isl.e === 'rgb(250, 250, 250)', isl.e);
ok('regel 2: lys gradient er ikke øy', !isl.lightIsl && lum(isl.lightT) < 0.05, { theme: isl.lightIsl, c: isl.lightT });

// Hjelperne
const H = await page.evaluate(() => {
  const T = MSH.theme;
  const probe = (css) => { const d = document.createElement('div'); d.style.color = css; document.body.appendChild(d); const v = getComputedStyle(d).color; d.remove(); return v; };
  const bgp = (css) => { const d = document.createElement('div'); d.style.background = css; document.body.appendChild(d); const v = getComputedStyle(d).backgroundColor; d.remove(); return v; };
  return {
    toneL: T.tone('var(--blue, #73b9f2)', 'light'), toneD: T.tone('var(--blue, #73b9f2)', 'dark'),
    accL: T.accentText('rgb(242 181 115)', 'light'), accCss: probe(T.accentText('var(--red, #f28073)')), accCssU: probe(T.accentText('#3f88c5')),
    wL: T.whiteA(0.06, 'light'), wCss: bgp(T.whiteA(0.06)), kL: T.blackA(0.5, 'light'), kCss: bgp(T.blackA(0.5)), kKeep: T.blackA(0.1, 'light'),
    gray: [T.grayText('#c9c7c2', 'light'), T.grayText('#f2f1ee', 'light'), T.grayText('#a8a8a8', 'light'), T.grayText('#696969', 'light')],
    toneCss: bgp(T.tone('rgb(115 185 242)').bg), contr: +T.contrast('#565656', '#ffffff').toFixed(2),
  };
});
ok('tone(): lys .18 + mørknet tekst, mørk .12 + original', /0\.18\)$/.test(H.toneL.bg) && H.toneL.fg === 'rgb(30 108 178)' && /0\.12\)$/.test(H.toneD.bg), { lys: H.toneL, mork: H.toneD });
ok('accentText(): tabell (amber → 168 98 24) + CSS-variabel i lys modus', H.accL === 'rgb(168 98 24)' && H.accCss === 'rgb(186, 58, 44)', { accL: H.accL, css: H.accCss, ukjent: H.accCssU });
ok('regel 4: whiteA(.06) lys → svart .066', H.wL === 'rgba(0, 0, 0, 0.066)' && /^rgba\(0, 0, 0, 0\.06[67]\)$/.test(H.wCss), { js: H.wL, css: H.wCss });
ok('regel 3: blackA(.5) lys → .2, a < .2 beholdes', H.kL === 'rgba(0, 0, 0, 0.2)' && H.kCss === 'rgba(0, 0, 0, 0.2)' && H.kKeep === 'rgb(0 0 0 / 0.1)', { js: H.kL, css: H.kCss, keep: H.kKeep });
ok('regel 5: gråskala-tekst → lys', H.gray[0] === '#333333' && H.gray[1] === '#1c1c1c' && H.gray[2] === '#5b5b5b' && H.gray[3] === '#626262', H.gray);
ok('pkt. 5: tone-CSS i lys = .18', /0\.18\)$/.test(H.toneCss), H.toneCss);

// --- tilbake til mørk uten reload: identisk med før ---
await page.evaluate(async () => { history.replaceState(null, '', location.pathname); window.dispatchEvent(new HashChangeEvent('hashchange')); await new Promise((r) => setTimeout(r, 700)); });
await page.evaluate(() => setMode(true));
await page.evaluate(async () => { location.hash = '#lys'; await new Promise((r) => setTimeout(r, 1300)); });
const back = await page.evaluate(SNAP);
ok('mørk igjen: alle røtter dark', back.attr.html === 'dark' && back.attr.view === 'dark' && back.attr.pops.every((x) => x === 'dark'), back.attr);
ok('mørk igjen: Bubble-header/bakteppe som før byttet', JSON.stringify({ popName: back.popName, popClose: back.popClose, popIcon: back.popIcon, popHdr: back.popHdr, popBg: back.popBg, backdrop: back.backdrop }) === JSON.stringify(darkHdr), { før: darkHdr, nå: { popName: back.popName, popClose: back.popClose, popIcon: back.popIcon, popHdr: back.popHdr, popBg: back.popBg, backdrop: back.backdrop } });
ok('mørk igjen: øyene ryddet', await page.evaluate(() => deepAll('[data-ki-island-auto]').length === 0));
ok('ingen sidefeil', errs.length === 0, errs.slice(0, 3));
const NEWALL = await page.evaluate(ALLCOL, '#dash');
await page.close();

// --- mørk modus element for element mot før-koden (TEMA_BASE) ---
if (BASE) {
  const b = await setup(BASE);
  await b.page.evaluate(async () => { location.hash = '#lys'; await new Promise((r) => setTimeout(r, 1300)); });
  const OLD = await b.page.evaluate(ALLCOL, '#dash');
  const mOld = new Map(OLD), diff = [];
  let same = 0;
  for (const [k, v] of NEWALL) { if (!mOld.has(k)) continue; if (mOld.get(k) === v) same++; else diff.push({ k: k.slice(-80), før: mOld.get(k), nå: v }); }
  ok(`mørk: alle beregnede farger = før-koden (${same} like elementer, ${NEWALL.length} nå / ${OLD.length} før)`, diff.length === 0, diff.slice(0, 6));
  if (process.env.TEMA_DIFF) { const seenD = new Set(); diff.forEach((d) => { const key = d.før + '→' + d.nå; if (!seenD.has(key)) { seenD.add(key); console.log('DIFF', d.k, '\n  før', d.før, '\n  nå ', d.nå); } }); }
  await b.page.close();
}
await browser.close();
try { unlinkSync(bundle); } catch (e) { /* */ }
console.log(res.join('\n'));
const fails = res.filter((r) => r.startsWith('✘')).length;
console.log(fails ? `\n${fails} feilet` : '\nAlle bestod');
process.exit(fails ? 1 : 0);
