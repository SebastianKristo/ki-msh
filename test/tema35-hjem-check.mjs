// Fiks 35 (Del A, W3) · lyst/mørkt tema i Hjem-kortene strømpris (inkl. «I dag / I morgen»-fanene), gjøremål og søppel,
// den felles stepperen (M.STEPPER_CSS: .msh-stp-t / .msh-stp-ln) og klima-toppkortet i Rom (msh-rom-klima-card).
//  · lys modus: all synlig tekst ≥ 4,5:1 mot flaten bak, ingen hvit tekst på lys flate; Strømpriser-fanene: inaktiv
//    tekst = --ki-text-2 (#565656), sporet mørkere enn flaten rundt; klima-toppkortet er IKKE en mørk øy (lys flate)
//  · mørk modus: dagens farger (fasit) – og med TEMA_BASE=<bundel bygd fra før-koden> sammenlignes ALLE beregnede
//    farger element for element (piksel-lik før)
//  · bytte lys ↔ mørk uten reload
// Kjør: node test/tema35-hjem-check.mjs   (TEMA_BASE=<før-bundel> for sammenligning, SHOT_DIR=<mappe> for skjermbilder)
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { readdirSync, mkdirSync, unlinkSync } from 'node:fs';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const R = resolve('.') + '/';
mkdirSync('test/.build', { recursive: true });
const bundle = resolve(`test/.build/tema35h-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle], { cwd: R });
const BASE = process.env.TEMA_BASE ? resolve(process.env.TEMA_BASE) : null;
const SHOT = process.env.SHOT_DIR ? resolve(process.env.SHOT_DIR) : null;
if (SHOT) mkdirSync(SHOT, { recursive: true });
const mocks = readdirSync(R + 'test/mock').filter((f) => f.endsWith('.js')).sort().map((f) => R + 'test/mock/' + f);
const browser = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => pw.chromium.launch());
const res = [];
const ok = (name, cond, info) => { res.push(`${cond ? '✔' : '✘'} ${name}${!cond && info != null ? ' · ' + JSON.stringify(info) : ''}`); };

async function setup(bundlePath) {
  const page = await browser.newPage({ viewport: { width: 390, height: 1600 } });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('file://' + R + 'test/harness.html');
  for (const m of mocks) await page.addScriptTag({ path: m });
  await page.addScriptTag({ path: bundlePath });
  await page.evaluate(async () => {
    document.documentElement.style.background = document.body.style.background = 'var(--ki-bg, #232323)';
    window.deepAll = (sel, root) => { const out = []; const walk = (r) => r.querySelectorAll('*').forEach((e) => { if (e.matches(sel)) out.push(e); if (e.shadowRoot) walk(e.shadowRoot); }); walk(root || document); return out; };
    window.deep = (sel, root) => window.deepAll(sel, root)[0] || null;
    const H = window.mockHass();
    window.H = H;
    const dash = document.getElementById('dash');
    const mk = (cfg, wrapCss, id) => { const w = document.createElement('div'); w.id = id; w.style.cssText = 'padding:12px;' + (wrapCss || ''); const el = document.createElement(cfg.type.replace('custom:', '')); el.setConfig(cfg); el.hass = H; w.appendChild(el); dash.appendChild(w); return el; };
    // Hjem-kortene (ligger rett på dashbordflaten)
    mk({ type: 'custom:msh-strompris-card', card_id: 't35-strom' }, '', 't-strom');
    mk({ type: 'custom:msh-hjem-gjoremal-card', card_id: 't35-gj' }, '', 't-gj');
    mk({ type: 'custom:msh-soppel-card', card_id: 't35-sop' }, '', 't-sop'); // tømmedag (rosa)
    // Stepperen (rader i en popup: --ki-surface på --ki-popup)
    const st = document.createElement('div'); st.id = 't-stp'; st.style.cssText = 'padding:12px;background:var(--ki-popup, #282828)';
    const inner = document.createElement('div'); inner.style.cssText = 'border-radius:20px;background:var(--ki-surface, var(--gray200,#3a3a3a));color:var(--ki-text, #fafafa);font-family:sans-serif';
    const sr = inner.attachShadow({ mode: 'open' });
    sr.innerHTML = `<style>${MSH.STEPPER_CSS}</style>${MSH.stepperHTML(H, 'input_number.klima_komfortvekt', { label: 'Komfortvekt', sub: 'Vekting' })}${MSH.stepperHTML(H, null, { label: 'Tom verdi', sub: 'plassholder', placeholder: 5, value: '' })}`;
    st.appendChild(inner); dash.appendChild(st);
    // Klima-toppkortet i Rom (i popupen: --ki-popup)
    mk({ type: 'custom:msh-rom-klima-card', card_id: 't35-klima', area: 'stue' }, 'background:var(--ki-popup, #282828)', 't-klima');
    await new Promise((r) => setTimeout(r, 1200));
    window.setMode = async (dark) => {
      const h2 = { ...window.H, themes: { ...(window.H.themes || {}), darkMode: dark } };
      window.H = h2;
      deepAll('*').filter((e) => e.localName.startsWith('msh-')).forEach((e) => { try { e.hass = h2; } catch (x) { /* */ } });
      if (MSH.theme && MSH.theme.update) MSH.theme.update(h2);
      await new Promise((r) => setTimeout(r, 600));
    };
  });
  return { page, errs };
}

const ROOTS = ['#t-strom', '#t-gj', '#t-sop', '#t-stp', '#t-klima'];
const ALLCOL = (sels) => {
  const out = [];
  const props = ['color', 'backgroundColor', 'backgroundImage', 'borderTopColor', 'boxShadow', 'fill', 'stroke', 'outlineColor'];
  const walk = (r, path) => {
    [...r.children].forEach((e, i) => {
      const p = path + '/' + e.localName + i;
      if (e.localName !== 'style' && e.localName !== 'script') { const c = getComputedStyle(e); out.push([p, props.map((k) => c[k]).join('|').replace(/url\("#[^"]*"\)/g, 'url(#id)')]); }
      if (e.shadowRoot) walk(e.shadowRoot, p + '#');
      walk(e, p);
    });
  };
  sels.forEach((s) => { const r = document.querySelector(s); if (r) walk(r, s); });
  return out;
};
// Tekstkontrast (lys): hver synlig tekst mot første ugjennomsiktige flate bak (gradient = snitt), alfa blandes inn
const SCAN = (sels) => {
  const bad = [], seen = { n: 0 };
  const P = (s) => { const c = /color\(srgb ([^)]+)\)/.exec(s || ''); if (c) { const q = c[1].split(/[ /]+/).filter(Boolean).map(Number); return [q[0] * 255, q[1] * 255, q[2] * 255, q[3] == null ? 1 : q[3]]; } const m = /rgba?\(([^)]+)\)/.exec(s || ''); if (!m) return null; return m[1].split(/[ ,/]+/).filter(Boolean).map(Number); };
  const bgOf = (el) => {
    let n = el;
    const layers = [];
    for (let i = 0; n && i < 80; i++) {
      if (n.nodeType === 1) {
        const c = getComputedStyle(n);
        if (c.backgroundImage && c.backgroundImage !== 'none') { const m = c.backgroundImage.match(/(rgba?|color)\([^)]*\)/g); if (m && m.length) { const ps = m.map(P).filter((p) => p && (p[3] == null || p[3] > 0.4)); if (ps.length) { layers.push([...ps.reduce((a, p) => [a[0] + p[0] / ps.length, a[1] + p[1] / ps.length, a[2] + p[2] / ps.length], [0, 0, 0]), 1]); break; } } }
        const p = P(c.backgroundColor); if (p && (p[3] == null ? 1 : p[3]) > 0) { layers.push([p[0], p[1], p[2], p[3] == null ? 1 : p[3]]); if ((p[3] == null ? 1 : p[3]) >= 0.98) break; }
      }
      n = n.parentNode || n.host;
    }
    let bg = [230, 230, 230];
    for (let i = layers.length - 1; i >= 0; i--) { const [r, g, b, a] = layers[i]; bg = [r * a + bg[0] * (1 - a), g * a + bg[1] * (1 - a), b * a + bg[2] * (1 - a)]; }
    return bg;
  };
  const L = (p) => { const f = (u) => { u /= 255; return u <= 0.03928 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4); }; return 0.2126 * f(p[0]) + 0.7152 * f(p[1]) + 0.0722 * f(p[2]); };
  const opac = (el) => { let o = 1, n = el; for (let i = 0; n && i < 80; i++) { if (n.nodeType === 1) o *= Number(getComputedStyle(n).opacity); n = n.parentNode || n.host; } return o; };
  const walk = (r) => r.querySelectorAll('*').forEach((e) => {
    if (e.shadowRoot) walk(e.shadowRoot);
    const txt = [...e.childNodes].filter((t) => t.nodeType === 3 && t.textContent.trim()).map((t) => t.textContent.trim()).join(' ');
    if (!txt || ['style', 'script', 'option', 'select'].includes(e.localName)) return;
    const rc = e.getBoundingClientRect(); if (!rc.width || !rc.height) return;
    const c = getComputedStyle(e); if (c.visibility === 'hidden' || c.display === 'none') return;
    if (opac(e) < 0.6) return;
    if (e.closest && e.closest('[data-theme=dark],[data-ki-island]')) return;
    const fg = P(c.color); if (!fg) return;
    const bg = bgOf(e), a = fg[3] == null ? 1 : fg[3];
    const mix = [fg[0] * a + bg[0] * (1 - a), fg[1] * a + bg[1] * (1 - a), fg[2] * a + bg[2] * (1 - a)];
    const k = (Math.max(L(mix), L(bg)) + 0.05) / (Math.min(L(mix), L(bg)) + 0.05);
    seen.n++;
    if (k < 4.5 || (L(mix) > 0.8 && L(bg) > 0.6)) bad.push({ t: txt.slice(0, 24), k: +k.toFixed(2), fg: c.color, bg: `rgb(${bg.map(Math.round).join(',')})`, cls: String(e.className || e.localName).slice(0, 30) });
  });
  sels.forEach((s) => { const r = document.querySelector(s); if (r) walk(r); });
  return { n: seen.n, bad };
};
const lum = (s) => { const m = /rgba?\(([^)]+)\)/.exec(s || ''); if (!m) return null; const q = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); const f = (u) => { u /= 255; return u <= 0.03928 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4); }; return 0.2126 * f(q[0]) + 0.7152 * f(q[1]) + 0.0722 * f(q[2]); };
const KEY = () => {
  const g = (el, p) => (el ? getComputedStyle(el)[p] : null);
  const seg = deep('.seg', document.querySelector('#t-strom')), sgIn = seg && seg.querySelector('.sg:not(.on)'), sgOn = seg && seg.querySelector('.sg.on');
  const srf = deep('.srf', document.querySelector('#t-strom'));
  const stpT = deep('.msh-stp-t', document.querySelector('#t-stp')), stpLn = deep('.msh-stp-ln', document.querySelector('#t-stp')), stpB = deep('.msh-stp-b', document.querySelector('#t-stp'));
  const hero = deep('.hero', document.querySelector('#t-klima')), nm = deep('.hero .nm', document.querySelector('#t-klima')), big = deep('.hero .t', document.querySelector('#t-klima'));
  const gjNm = deep('.nm', document.querySelector('#t-gj')), sopN = deep('.n', document.querySelector('#t-sop'));
  return { segBg: g(seg, 'backgroundColor'), sgIn: g(sgIn, 'color'), sgOn: g(sgOn, 'color'), srfBg: g(srf, 'backgroundColor'), stpT: g(stpT, 'color'), stpLn: g(stpLn, 'color'), stpB: g(stpB, 'backgroundColor'), stpBfg: g(stpB, 'color'),
    heroBg: g(hero, 'backgroundColor'), heroIsl: hero ? (hero.closest('[data-ki-island],[data-theme=dark]') ? 'øy' : 'nei') : null, heroNm: g(nm, 'color'), heroT: g(big, 'color'), gjNm: g(gjNm, 'color'), sopN: g(sopN, 'color'), page: g(document.body, 'backgroundColor') };
};
// Dagens farger i mørk modus (fasit fra før token-byttet)
const EXPECT_DARK = { segBg: 'rgb(47, 47, 47)', sgIn: 'rgb(175, 175, 175)', sgOn: 'rgb(47, 47, 47)', srfBg: 'rgb(48, 48, 48)', stpT: 'rgb(250, 250, 250)', stpLn: 'rgb(225, 225, 225)', stpB: 'rgb(47, 47, 47)', stpBfg: 'rgb(250, 250, 250)', heroBg: 'rgb(58, 58, 58)', heroNm: 'rgb(175, 175, 175)', heroT: 'rgb(250, 250, 250)', gjNm: 'rgb(250, 250, 250)' };

const { page, errs } = await setup(bundle);
const dark = await page.evaluate(KEY);
for (const [k, v] of Object.entries(EXPECT_DARK)) ok(`mørk: ${k} = dagens farge`, dark[k] === v || dark[k] == null, { er: dark[k], fasit: v });
const NEWALL = await page.evaluate(ALLCOL, ROOTS);
if (SHOT) await page.screenshot({ path: `${SHOT}/tema35-mork.png`, fullPage: true });

await page.evaluate(() => setMode(false));
const light = await page.evaluate(KEY);
ok('lys: data-ki-theme="light" (uten reload)', await page.evaluate(() => document.documentElement.getAttribute('data-ki-theme')) === 'light');
ok('lys: Strømpriser-fanene – inaktiv tekst --ki-text-2 (#565656)', light.sgIn === 'rgb(86, 86, 86)', light.sgIn);
ok('lys: Strømpriser-fanene – sporet mørkere enn flaten (--ki-surface-3)', light.segBg === 'rgb(222, 222, 222)' && lum(light.segBg) < lum(light.page), { spor: light.segBg, flate: light.page });
ok('lys: Strømpriser-fanene – aktiv tekst mørk på rosa', lum(light.sgOn) < 0.05, light.sgOn);
ok('lys: strømpris-flaten hvit (--ki-surface)', light.srfBg === 'rgb(255, 255, 255)', light.srfBg);
ok('lys: stepper – verdi og etikett mørk tekst (ikke hvit på hvit)', lum(light.stpT) < 0.05 && lum(light.stpLn) < 0.1, { t: light.stpT, ln: light.stpLn });
ok('lys: stepper-knapper lys flate + mørkt ikon', lum(light.stpB) > 0.6 && lum(light.stpBfg) < 0.05, { bg: light.stpB, fg: light.stpBfg });
ok('lys: klima-toppkortet lys flate (ikke mørk øy)', light.heroBg === 'rgb(255, 255, 255)' && light.heroIsl === 'nei', { bg: light.heroBg, øy: light.heroIsl });
ok('lys: klima-toppkortet romnavn/temperatur mørk tekst', lum(light.heroNm) < 0.15 && lum(light.heroT) < 0.05, { nm: light.heroNm, t: light.heroT });
ok('lys: gjøremål mørk tekst', lum(light.gjNm) < 0.05, light.gjNm);
for (const [id, name] of [['#t-strom', 'strømpris'], ['#t-gj', 'gjøremål'], ['#t-sop', 'søppel'], ['#t-stp', 'stepper'], ['#t-klima', 'klima-toppkort']]) {
  const s = await page.evaluate(SCAN, [id]);
  ok(`lys: kontrast ≥ 4,5:1 i ${name} (${s.n} tekster)`, s.n > 0 && s.bad.length === 0, s.bad.slice(0, 8));
}
// søppel også på en vanlig dag (ikke rosa)
await page.evaluate(async () => { const h = { ...window.H, states: { ...window.H.states, 'sensor.neste_tomming': { ...window.H.states['sensor.neste_tomming'], state: '3,Restavfall' } } }; window.H = h; deepAll('msh-soppel-card').forEach((e) => { e.hass = h; }); await new Promise((r) => setTimeout(r, 900)); });
const s2 = await page.evaluate(SCAN, ['#t-sop']);
ok(`lys: kontrast ≥ 4,5:1 i søppel (vanlig dag, ${s2.n} tekster)`, s2.n > 0 && s2.bad.length === 0, s2.bad.slice(0, 8));
if (SHOT) await page.screenshot({ path: `${SHOT}/tema35-lys.png`, fullPage: true });
await page.evaluate(async () => { const h = { ...window.H, states: { ...window.H.states, 'sensor.neste_tomming': { ...window.H.states['sensor.neste_tomming'], state: '0,Restavfall,Plastavfall' } } }; window.H = h; deepAll('msh-soppel-card').forEach((e) => { e.hass = h; }); await new Promise((r) => setTimeout(r, 300)); });

await page.evaluate(() => setMode(true));
const back = await page.evaluate(KEY);
ok('tilbake til mørk uten reload: samme farger', Object.keys(EXPECT_DARK).every((k) => back[k] === dark[k]), Object.keys(EXPECT_DARK).filter((k) => back[k] !== dark[k]));
ok('ingen sidefeil', !errs.length, errs);

if (BASE) {
  const b = await setup(BASE);
  const OLD = await b.page.evaluate(ALLCOL, ROOTS);
  const mOld = new Map(OLD), diff = [];
  let same = 0;
  for (const [k, v] of NEWALL) { if (!mOld.has(k)) continue; if (mOld.get(k) === v) same++; else diff.push({ k: k.slice(-70), før: mOld.get(k), nå: v }); }
  ok(`mørk: alle beregnede farger = før-koden (${same} like elementer, ${NEWALL.length} nå / ${OLD.length} før)`, diff.length === 0 && same > 50, diff.slice(0, 6));
  await b.page.close();
}
await browser.close();
try { unlinkSync(bundle); } catch (e) { /* */ }
console.log(res.join('\n'));
const fails = res.filter((r) => r.startsWith('✘')).length;
console.log(fails ? `\n${fails} feilet` : '\nAlle bestod');
process.exit(fails ? 1 : 0);
