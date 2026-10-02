// Fiks 34/35 (Del A + 35.6/35.7) · lyst tema i popupene Vær, Kamera, Kart, Kalender og Sir Sweeps (Støvsuger) mot EKTE
// Bubble Card, mobil 390 px og PC 1400 px. Uavhengig av dato/klokkeslett.
//  · popupene fra examples/dashboard.yaml (+ M.POPUP_FORCE som strategien), åpnet via hash; hver tilstand (faner, visninger,
//    utvidede rader, menyer, «Tilpass …»-arket) sjekkes i lys modus:
//      – all synlig tekst utenfor mørke øyer ≥ 4,5:1 mot flaten den ligger på
//      – ingen hvit tekst på lys flate, ingen svart flate med mørk tekst
//      – Bubble-headeren lys (navn mørkt, lukk-knapp lys) – unntak: Vær «Scene» (mørk øy bak hele popupen, lys header-tekst)
//      – mørke øyer: Vær-scenen (data-ki-island, lys tekst), kamerabilder/-plassholdere mørke
//  · mørk modus: tilbake fra lys uten reload = samme farger; med TEMA_BASE=<bundel bygd fra før-koden> sammenlignes ALLE
//    beregnede farger (color/bakgrunn/kant/skygge/fill/stroke) element for element i popupen og arkene (som tema34-check)
// Kjør: node test/tema35-popups-a-check.mjs   (ONLY=vaer|kamera|kart|kalender|rolf, VP=mobil|PC, SHOT_DIR=<mappe>)
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { readdirSync, existsSync, mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const R = resolve('.') + '/';
mkdirSync('test/.build', { recursive: true });
mkdirSync('test/.vendor', { recursive: true });
const BC = resolve('test/.vendor/bubble-card.js');
if (!existsSync(BC)) execFileSync('curl', ['-sSL', '-o', BC, 'https://raw.githubusercontent.com/Clooos/Bubble-Card/main/dist/bubble-card.js']);
const bundle = resolve(`test/.build/tema35a-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle], { cwd: R });
const BASE = process.env.TEMA_BASE ? resolve(process.env.TEMA_BASE) : null;
const SHOT = process.env.SHOT_DIR ? resolve(process.env.SHOT_DIR) : null;
if (SHOT) mkdirSync(SHOT, { recursive: true });
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const VPS = [{ n: 'mobil', width: 390, height: 844, mobile: true }, { n: 'PC', width: 1400, height: 900, mobile: false }].filter((v) => !process.env.VP || process.env.VP === v.n);
const mocks = readdirSync(R + 'test/mock').filter((f) => f.endsWith('.js')).sort().map((f) => R + 'test/mock/' + f);
const yml = (py) => JSON.parse(execFileSync('python3', ['-c', `import yaml,json;d=yaml.safe_load(open('examples/dashboard.yaml'));cs=[c for s in d['views'][0]['sections'] for c in s['cards']];print(json.dumps(${py}))`]).toString());
const POPS = yml("{c['hash']:c for c in cs if c.get('hash') in ('#vaer','#kamera','#kart','#kalender','#rolf')}");

// Tilstander per popup. Hver tilstand er en funksjon (kjøres i siden) som setter kortet opp; samme rekkefølge i før/etter.
const STATES = {
  vaer: [
    ['scene', { style: 'scene' }, null],
    ['scene · nedbør', { style: 'scene' }, 'seg:rain'],
    ['scene · vind', { style: 'scene' }, 'seg:wind'],
    ['scene · varsel + dag åpen', { style: 'scene' }, 'open:.sal,.dr'],
    ['scene · stedsmeny', { style: 'scene', places: [{ name: 'Hjem', entity: 'weather.home' }, { name: 'Hytta', entity: 'weather.hytta' }] }, 'ctl:place'],
    ['klassisk', { style: 'klassisk', show_graph: true }, null],
    ['klassisk · varsel + dag åpen', { style: 'klassisk', show_graph: true }, 'open:.al,.day'],
    ['klassisk · toppkort side 2/3', { style: 'klassisk' }, 'hero'],
    ['klassisk · stedsmeny', { style: 'klassisk', places: [{ name: 'Hjem', entity: 'weather.home' }, { name: 'Hytta', entity: 'weather.hytta' }] }, 'ctl:place'],
    ['Tilpass Vær', { style: 'scene' }, 'sheet'],
    ['Tilpass Vær · legg til sted', { style: 'klassisk' }, 'sheet:add'],
  ],
  kamera: [
    ['alle', {}, null],
    ['hendelser', {}, 'view:events'],
    ['enkeltkamera', {}, 'view:cam'],
    ['frigate', {}, 'mode:frigate'],
    ['visning-meny', {}, 'drop'],
    ['fullskjerm', {}, 'full'],
    ['Tilpass kameraer', {}, 'sheet'],
  ],
  kart: [
    ['kart', {}, null],
    ['person valgt', {}, 'sel:p'],
    ['bil valgt', {}, 'sel:c'],
    ['sone valgt', {}, 'sel:z'],
  ],
  kalender: [
    ['faner', {}, 'tabs'],
    ['måned', { defaultView: 'maned' }, null],
    ['kalender-meny', {}, 'calmenu'],
    ['Tilpass', {}, 'sheet'],
  ],
  rolf: [
    ['faner', {}, 'tabs'],
    ['Tilpass', {}, 'sheet'],
  ],
};
const CARD = { vaer: 'msh-vaer-card', kamera: 'msh-kamera-card', kart: 'msh-kart-card', kalender: 'msh-kalender-card', rolf: 'msh-stovsuger-card' };

const browser = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => pw.chromium.launch());
const res = [];
let nFail = 0;
const ok = (name, cond, info) => { if (!cond) nFail++; res.push(`${cond ? '✔' : '✘'} ${name}${!cond && info != null ? ' · ' + JSON.stringify(info).slice(0, 900) : ''}`); };

async function setup(bundlePath, vp, key) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.mobile, isMobile: vp.mobile });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('file://' + R + 'test/harness-bubble.html');
  for (const m of mocks) await page.addScriptTag({ path: m });
  await page.addScriptTag({ path: bundlePath });
  await page.addScriptTag({ path: BC, type: 'module' });
  await page.waitForFunction(() => customElements.get('bubble-card'), null, { timeout: 15000 });
  await page.evaluate(() => {
    const wait = (ms) => new Promise((q) => setTimeout(q, ms));
    window.__wait = wait;
    const H = window.mockHass();
    H.themes = { ...(H.themes || {}), darkMode: true };
    window.__hass = H;
    window.__all = () => { const o = []; const w = (r) => r.querySelectorAll('*').forEach((e) => { o.push(e); if (e.shadowRoot) w(e.shadowRoot); }); w(document); return o; };
    window.__theme = async (light) => {
      window.__hass = { ...window.__hass, themes: { ...(window.__hass.themes || {}), darkMode: !light } };
      window.__all().filter((e) => e.localName === 'bubble-card' || /^msh-/.test(e.localName)).forEach((e) => { try { e.hass = window.__hass; } catch (x) { /* */ } });
      window.MSH.theme.set(light ? 'light' : 'dark');
      await wait(700);
    };
    // Alle beregnede farger under røttene (element for element, gjennom shadow roots; style/script/ha-icon-innmat utelatt)
    window.__cols = (roots) => {
      const out = [];
      const props = ['color', 'backgroundColor', 'backgroundImage', 'borderTopColor', 'borderBottomColor', 'boxShadow', 'fill', 'stroke', 'outlineColor', 'textShadow'];
      const walk = (r, path) => {
        let i = 0;
        [...r.children].forEach((e) => {
          if (e.localName === 'style' || e.localName === 'script' || e.localName === 'link') return;
          const p = path + '/' + e.localName + (i++);
          const c = getComputedStyle(e);
          out.push([p, props.map((k) => c[k]).join('|').replace(/url\("#[^"]*"\)/g, 'url(#id)')]);
          if (e.shadowRoot && e.localName !== 'ha-icon') walk(e.shadowRoot, p + '#');
          walk(e, p);
        });
      };
      roots.forEach((r, i) => r && walk(r, 'r' + i));
      return out;
    };
  });
  return { page, errs };
}

// Mount popupen (+ eventuelt egen kort-config) og åpne via hash
async function mount(page, key, extra) {
  await page.evaluate(async ({ pop, tag, extra, key }) => {
    const M = window.MSH, wait = window.__wait;
    document.getElementById('dash').innerHTML = '';
    const ov = document.querySelector('body > ki-overlay-root'); if (ov && ov.shadowRoot) { const s = ov.shadowRoot.querySelector('.slot'); if (s) s.innerHTML = ''; }
    history.replaceState(null, '', location.pathname); window.dispatchEvent(new HashChangeEvent('hashchange'));
    let cfg = JSON.parse(JSON.stringify(pop));
    const card = { ...(cfg.cards && cfg.cards[0]) || { type: 'custom:' + tag }, ...extra, card_id: 't35-' + key + '-' + Math.random().toString(36).slice(2, 7) };
    cfg.cards = [card];
    if (M.POPUP_FORCE && M.POPUP_FORCE[cfg.hash]) cfg = M.POPUP_FORCE[cfg.hash](cfg) || cfg;
    const bc = document.createElement('bubble-card');
    bc.setConfig(cfg);
    bc.hass = window.__hass;
    document.getElementById('dash').appendChild(bc);
    await wait(400);
    location.hash = cfg.hash;
    await wait(1600);
    window.__card = () => window.__all().find((e) => e.localName === tag && e.getBoundingClientRect().height > 0) || window.__all().find((e) => e.localName === tag);
    window.__pop = () => window.__all().find((e) => e.classList && e.classList.contains('bubble-pop-up') && e.classList.contains('is-popup-opened')) || window.__all().find((e) => e.classList && e.classList.contains('bubble-pop-up'));
  }, { pop: POPS['#' + key], tag: CARD[key], extra, key });
}

// Utfør tilstanden (samme i før/etter). Returnerer liste av del-tilstander (faner) som egne navn.
const ACT = async (page, act) => page.evaluate(async (act) => {
  const wait = window.__wait, C = window.__card(), R = C && C.shadowRoot, M = window.MSH;
  if (!act || !C) return;
  const [k, v] = act.split(':');
  const click = (el) => { if (el) el.click(); };
  if (k === 'seg') click(R.querySelector(`.mb.sg[data-k="${v}"]`));
  else if (k === 'open') { for (const s of v.split(',')) { click(R.querySelector(s)); await wait(300); } }
  else if (k === 'ctl') { const ctl = R.querySelector('.msh-vaer-ctl'); click(ctl && ctl.shadowRoot.querySelector(`[data-a="${v}"]`)); }
  else if (k === 'hero') { const he = R.querySelector('msh-vaer-hero-card'); if (he && he.showSlide) he.showSlide(1); }
  else if (k === 'sheet') {
    if (C.customize) C.customize();
    await wait(700);
    if (v === 'add') { const o = M.portals ? M.portals().pop() : null; const r = o && o.shadowRoot; click(r && r.querySelector('[data-a="openadd"]')); }
  } else if (k === 'view') {
    if (v === 'events') click(R.querySelector('.ch[data-v="events"]'));
    else click([...R.querySelectorAll('.ch')].find((b) => b.dataset.v && b.dataset.v.startsWith('camera.')));
  } else if (k === 'mode') click(R.querySelector(`.md[data-v="${v}"]`));
  else if (k === 'drop') click(R.querySelector('.tune[data-act="drop"]'));
  else if (k === 'full') click(R.querySelector('.full[data-act="full"]'));
  else if (k === 'sel') { const b = R.querySelector(`.pl[data-k="${v}"]`); if (b) b.click(); else if (v === 'z' && C._D && C._D.Z[0]) C._select({ k: 'z', id: C._D.Z[0].id }); }
  else if (k === 'calmenu') { if (C._calMenu) C._calMenu(R.querySelector('.mb')); else click(R.querySelector('[data-act="calmenu"]')); }
  await wait(700);
}, act);

const TABS = (page) => page.evaluate(() => { const C = window.__card(); return C ? [...C.shadowRoot.querySelectorAll('[data-act="tab"]')].map((b) => b.dataset.v) : []; });
const TAB = (page, v) => page.evaluate(async (v) => { const C = window.__card(); const b = C.shadowRoot.querySelector(`[data-act="tab"][data-v="${v}"]`); if (b) b.click(); await window.__wait(700); }, v);

// Røtter for fargesammenligningen: popupen (inkl. kortet, scenelaget, headeren) + ark/menyer i ki-overlay-root
const SNAP = (page) => page.evaluate(() => { const ov = document.querySelector('body > ki-overlay-root'); return window.__cols([window.__pop(), ov && ov.shadowRoot]); });

// Lys modus: tekstkontrast, hvit-på-lys, svart-flate-med-mørk-tekst, Bubble-header
const LIGHT = (page, opt) => page.evaluate((opt) => {
  const T = window.MSH.theme;
  const up = (n) => n.parentElement || (n.getRootNode && n.getRootNode().host) || null;
  const island = (el) => { for (let n = el; n; n = up(n)) if (n.nodeType === 1 && (n.hasAttribute('data-ki-island') || n.getAttribute('data-ki-island-auto') === '1')) return n; return null; };
  const P = (s) => T.parse(s);
  const bgOf = (el) => {
    for (let n = el; n; n = up(n)) {
      if (n.nodeType !== 1) continue;
      if (n.classList.contains('bubble-pop-up')) { // popupens flate er et eget lag (.bubble-pop-up-background), ikke en forelder
        const bl = n.querySelector('.bubble-pop-up-background'), pb = bl && P(getComputedStyle(bl).backgroundColor);
        return pb && pb[3] > 0.5 ? pb : P('rgb(240, 240, 240)');
      }
      const c = getComputedStyle(n);
      if (c.backgroundImage && c.backgroundImage !== 'none' && !/url\(/.test(c.backgroundImage)) {
        const m = c.backgroundImage.match(/(rgba?|color)\([^)]*\)/g);
        if (m) { const ps = m.map(P).filter((p) => p && p[3] > 0.4); if (ps.length) return [ps.reduce((a, p) => a + p[0], 0) / ps.length, ps.reduce((a, p) => a + p[1], 0) / ps.length, ps.reduce((a, p) => a + p[2], 0) / ps.length, 1]; }
      }
      const p = P(c.backgroundColor); if (p && p[3] > 0.5) return p;
    }
    return P('rgb(240, 240, 240)');
  };
  const roots = [window.__pop()];
  const ov = document.querySelector('body > ki-overlay-root'); if (ov && ov.shadowRoot) roots.push(ov.shadowRoot);
  const els = []; const walk = (r) => r.querySelectorAll('*').forEach((e) => { els.push(e); if (e.shadowRoot && e.localName !== 'ha-icon') walk(e.shadowRoot); });
  roots.forEach((r) => r && walk(r));
  const bad = [], white = [], blackDark = [];
  let n = 0;
  for (const e of els) {
    if (!e.getBoundingClientRect) continue;
    const rc = e.getBoundingClientRect(); if (rc.width < 1 || rc.height < 1) continue;
    if (rc.bottom < 0 || rc.top > innerHeight * 3) continue;
    if (!e.checkVisibility || !e.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
    if (!/\S/.test([...e.childNodes].filter((x) => x.nodeType === 3).map((x) => x.textContent).join(''))) continue;
    if (island(e)) continue;
    if (e.closest('.bubble-header-container,#header-container')) continue; // headeren sjekkes for seg
    const cs = getComputedStyle(e), fg = P(cs.color); if (!fg || fg[3] < 0.3) continue;
    let op = 1; for (let x = e; x; x = up(x)) if (x.nodeType === 1) op *= Number(getComputedStyle(x).opacity); if (op < 0.45) continue; // dimmet/deaktivert med vilje
    const bg = bgOf(e), cr = T.contrast(cs.color, `rgb(${bg[0]}, ${bg[1]}, ${bg[2]})`);
    n++;
    const id = (e.localName + '.' + String(e.getAttribute('class') || '').split(' ')[0]) + ' «' + e.textContent.trim().slice(0, 18) + '»';
    if (cr < 4.5) bad.push([id, cs.color, `rgb(${bg.slice(0, 3).map(Math.round)})`, +cr.toFixed(2)]);
    if (T.lum(fg) > 0.8 && T.lum(bg) > 0.5) white.push(id);
    if (T.lum(bg) < 0.03 && T.lum(fg) < 0.2) blackDark.push(id);
  }
  const pop = window.__pop(), q = (s) => pop.querySelector(s);
  const name = q('.bubble-name'), close = q('.bubble-close-button'), hdr = q('#header-container > div > div');
  const hd = { name: name && getComputedStyle(name).color, close: close && getComputedStyle(close).backgroundColor, hdr: hdr && getComputedStyle(hdr).backgroundColor, theme: pop.getAttribute('data-ki-theme'), vaer: pop.getAttribute('data-ki-vaer') };
  return { n, bad, white, blackDark, hd };
}, opt);

const results = {};
for (const vp of VPS) {
  for (const key of Object.keys(STATES)) {
    if (ONLY && !ONLY.includes(key)) continue;
    const A = await setup(bundle, vp, key);
    const B = BASE ? await setup(BASE, vp, key) : null;
    for (const [sname, extra, act] of STATES[key]) {
      const label = `${vp.n} · #${key} · ${sname}`;
      await mount(A.page, key, extra); if (B) await mount(B.page, key, extra);
      // Faner: hver fane er en egen deltilstand
      const subs = act === 'tabs' ? await TABS(A.page) : [null];
      if (act !== 'tabs') { await ACT(A.page, act); if (B) await ACT(B.page, act); }
      for (const tab of subs) {
        const lb = tab ? `${label} · ${tab}` : label;
        if (tab) { await TAB(A.page, tab); if (B) await TAB(B.page, tab); }
        const d0 = await SNAP(A.page);
        if (B) {
          const b0 = await SNAP(B.page), mb = new Map(b0);
          const diff = d0.filter(([p, v]) => mb.has(p) && mb.get(p) !== v).map(([p, v]) => [p.slice(-90), mb.get(p).slice(0, 160), v.slice(0, 160)]);
          ok(`${lb} · mørk = før (element for element, ${d0.length} el.)`, !diff.length && Math.abs(d0.length - b0.length) <= 2, { n: [d0.length, b0.length], diff: diff.slice(0, 4) });
        }
        await A.page.evaluate(() => window.__theme(true));
        const L = await LIGHT(A.page, {});
        if (SHOT) await A.page.screenshot({ path: `${SHOT}/${vp.n}-${key}-${(sname + (tab ? '-' + tab : '')).replace(/[^a-zæøå0-9]+/gi, '_')}-lys.png` });
        ok(`${lb} · lys: all tekst ≥ 4,5:1 (${L.n} tekster)`, !L.bad.length, L.bad.slice(0, 8));
        ok(`${lb} · lys: ingen hvit tekst på lys flate / svart flate med mørk tekst`, !L.white.length && !L.blackDark.length, { white: L.white.slice(0, 5), black: L.blackDark.slice(0, 5) });
        const sceneHdr = L.hd.vaer === 'scene';
        const T = (s) => { const m = /rgba?\(([^)]+)\)/.exec(s || ''); if (!m) return null; const p = m[1].split(/[ ,/]+/).map(Number); return (0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2]) / 255; };
        ok(`${lb} · lys: Bubble-header ${sceneHdr ? 'over værscenen: lys tekst (mørk øy)' : 'lys (mørkt navn, lys lukk-knapp)'}`, L.hd.theme === 'light' && (sceneHdr ? T(L.hd.name) > 0.8 : T(L.hd.name) < 0.2 && (L.hd.close == null || T(L.hd.close) > 0.7 || /rgba\(0, 0, 0, 0\)/.test(L.hd.close))), L.hd);
        await A.page.evaluate(() => window.__theme(false));
        let d1 = await SNAP(A.page);
        for (let i = 0; i < 8; i++) { await A.page.waitForTimeout(400); const d2 = await SNAP(A.page); if (JSON.stringify(d2) === JSON.stringify(d1)) break; d1 = d2; } // overganger (Bubble-headeren) ferdige
        const m0 = new Map(d0);
        const back = d1.filter(([p, v]) => m0.has(p) && m0.get(p) !== v).map(([p, v]) => [p.slice(-90), m0.get(p).slice(0, 140), v.slice(0, 140)]);
        ok(`${lb} · mørk igjen uten reload = samme farger`, !back.length, back.slice(0, 4));
      }
    }
    ok(`${vp.n} · #${key} · ingen sidefeil`, !A.errs.length, A.errs.slice(0, 3));
    await A.page.close(); if (B) await B.page.close();
  }
}
await browser.close();
console.log(res.join('\n'));
console.log(nFail ? `\n${nFail} feilet` : '\nAlle bestod');
process.exit(nFail ? 1 : 0);
