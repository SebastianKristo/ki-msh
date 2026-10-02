// Fiks 35 (Del A + 35.6/35.7) · lyst tema i popupene Ringeklokke, Lys, Søppel, Energi og Ruter (W4b), mot EKTE Bubble Card.
//  · hver popup (alle varianter i test/cases/<kort>.json) × hver fane i hovedfanelinja × mobil 390 + PC 1400 (256 px sidebar)
//  · lys modus (bytte uten reload via hass.themes.darkMode): all synlig tekst utenfor mørke øyer ≥ 4,5:1 (også SVG-tekst
//    via fill), ingen hvit/lys tekst på lys flate, ingen svart/nesten-svart flate med mørk tekst
//  · mørke øyer: kamerabildet i Ringeklokke er og forblir mørkt (data-ki-island), lys tekst beholdes
//  · mørk modus: med TEMA_BASE=<bundel bygd fra før-koden> sammenlignes ALLE beregnede farger (color/bakgrunn/kant/
//    skygge/fill/stroke) i kortene element for element (fargestrengene normaliseres: color-mix/color(srgb) = rgba)
// Kjør: node test/tema35-popups-b-check.mjs [navnefilter]   (SHOT_DIR=<mappe> gir skjermbilder lys/mørk)
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, mkdirSync, existsSync, unlinkSync } from 'node:fs';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const R = resolve('.') + '/';
mkdirSync('test/.build', { recursive: true });
mkdirSync('test/.vendor', { recursive: true });
const BC = resolve('test/.vendor/bubble-card.js');
if (!existsSync(BC)) execFileSync('curl', ['-sSL', '-o', BC, 'https://raw.githubusercontent.com/Clooos/Bubble-Card/main/dist/bubble-card.js']);
const bundle = resolve(`test/.build/tema35b-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle], { cwd: R, stdio: 'inherit' });
const BASE = process.env.TEMA_BASE ? resolve(process.env.TEMA_BASE) : null;
const SHOT = process.env.SHOT_DIR ? resolve(process.env.SHOT_DIR) : null;
if (SHOT) mkdirSync(SHOT, { recursive: true });
const ONLY = process.argv[2] || '';
const mocks = readdirSync(R + 'test/mock').filter((f) => f.endsWith('.js')).sort().map((f) => R + 'test/mock/' + f);
const CASES = ['50-ringeklokke', '43-lys', '59-avfall', '52-energi', '47-ruter']
  .flatMap((f) => JSON.parse(readFileSync(`test/cases/${f}.json`, 'utf8')))
  .filter((c) => !ONLY || c.name.toLowerCase().includes(ONLY.toLowerCase()));
const VPS = [{ w: 390, h: 844, sb: 0, n: 'mobil' }, { w: 1400, h: 900, sb: 256, n: 'PC' }].map((v) => (SHOT ? { ...v, h: 2600 } : v)); // høy flate for hele popupen i skjermbildene
const browser = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => pw.chromium.launch());
const res = [];
const ok = (name, cond, info) => { res.push(`${cond ? '✔' : '✘'} ${name}${info != null && !cond ? ' · ' + JSON.stringify(info) : ''}`); };

async function open(bundlePath, c, vp) {
  const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h }, hasTouch: vp.n === 'mobil', isMobile: vp.n === 'mobil' });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('file://' + R + 'test/harness-bubble.html');
  for (const m of mocks) await page.addScriptTag({ path: m });
  await page.evaluate((sb) => {
    document.documentElement.style.setProperty('--sb', sb + 'px');
    const ha = document.createElement('home-assistant'); ha.attachShadow({ mode: 'open' });
    const panel = document.createElement('ha-panel-lovelace'); panel.attachShadow({ mode: 'open' }); ha.shadowRoot.appendChild(panel);
    const root = document.createElement('hui-root'); root.attachShadow({ mode: 'open' }); panel.shadowRoot.appendChild(root);
    const view = document.createElement('div'); view.id = 'view'; root.shadowRoot.appendChild(view);
    document.getElementById('dash').appendChild(ha);
    window.VIEW = view;
    document.documentElement.style.background = document.body.style.background = 'var(--ki-bg, #232323)';
  }, vp.sb);
  await page.addScriptTag({ path: bundlePath });
  await page.addScriptTag({ path: BC, type: 'module' });
  await page.waitForFunction(() => customElements.get('bubble-card'), null, { timeout: 10000 });
  await page.evaluate(async (c) => {
    window.deepAll = (sel, root) => { const out = []; const walk = (r) => r.querySelectorAll('*').forEach((e) => { if (e.matches(sel)) out.push(e); if (e.shadowRoot) walk(e.shadowRoot); }); walk(root || document); return out; };
    window.deep = (sel, root) => window.deepAll(sel, root)[0] || null;
    window.H = window.mockHass();
    const cfg = MSH.popupTemplateA({ name: c.name, icon: 'mdi:star', hash: c.hash, card: c.cards[0] });
    const bc = document.createElement('bubble-card'); bc.setConfig(cfg); bc.hass = H; VIEW.appendChild(bc);
    await new Promise((r) => setTimeout(r, 500));
    location.hash = c.hash;
    await new Promise((r) => setTimeout(r, 1300));
    window.CARD = () => deep(c.cards[0].type.replace('custom:', ''));
    window.setMode = async (dark) => {
      const h2 = { ...window.H, themes: { ...(window.H.themes || {}), darkMode: dark } };
      window.H = h2;
      deepAll('*').filter((e) => e.localName.startsWith('msh-') || e.localName === 'bubble-card').forEach((e) => { try { e.hass = h2; } catch (x) { /* */ } });
      await new Promise((r) => setTimeout(r, 900));
    };
    // Hovedfanelinja i kortet (felles MSH.tabBar / .tabs / første tablist)
    window.TABS = () => {
      const sr = CARD() && CARD().shadowRoot; if (!sr) return [];
      const list = sr.querySelector('.mtb-tabs[role=tablist]') || sr.querySelector('.tabs[role=tablist]') || sr.querySelector('[role=tablist]');
      return list ? [...list.querySelectorAll('[role=tab]')].filter((b) => !b.disabled) : [];
    };
  }, c);
  return { page, errs };
}

// Alle beregnede farger i kortet (element for element, gjennom shadow roots), normalisert
const ALLCOL = () => {
  const norm = (s) => String(s)
    .replace(/color\(srgb ([\d.e-]+) ([\d.e-]+) ([\d.e-]+)(?: \/ ([\d.e-]+))?\)/g, (m, r, g, b, a) => `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${+(+(a == null ? 1 : a)).toFixed(2)})`)
    .replace(/rgba?\((\d+(?:\.\d+)?), (\d+(?:\.\d+)?), (\d+(?:\.\d+)?)(?:, ([\d.]+))?\)/g, (m, r, g, b, a) => `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${+(+(a == null ? 1 : a)).toFixed(2)})`)
    .replace(/url\("#[^"]*"\)/g, 'url(#id)');
  const out = [];
  const props = ['color', 'backgroundColor', 'backgroundImage', 'borderTopColor', 'borderBottomColor', 'boxShadow', 'fill', 'stroke', 'outlineColor', 'stopColor', 'textShadow', 'filter'];
  const walk = (r, path) => {
    [...r.children].forEach((e, i) => {
      const p = path + '/' + e.localName + i;
      if (e.localName !== 'style' && e.localName !== 'script') {
        const c = getComputedStyle(e);
        out.push([p, norm(props.map((k) => c[k]).join('|'))]);
      }
      if (e.shadowRoot) walk(e.shadowRoot, p + '#');
      walk(e, p);
    });
  };
  const card = CARD(); if (card) walk(card.shadowRoot || card, 'card');
  return out;
};

// Lys modus: tekstkontrast + «hvit på lys» + «svart flate med mørk tekst» (mørke øyer hoppes over)
const SCAN = () => {
  const bad = [], white = [], blackBg = [], seen = { n: 0 };
  const P = (s) => {
    const c = /color\(srgb ([\d.e-]+) ([\d.e-]+) ([\d.e-]+)(?: \/ ([\d.e-]+))?\)/.exec(s || ''); // color-mix() → color(srgb …)
    if (c) return [c[1] * 255, c[2] * 255, c[3] * 255, c[4] == null ? 1 : +c[4]];
    const m = /rgba?\(([^)]+)\)/.exec(s || ''); if (!m) return null; return m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
  };
  const L = (p) => { const f = (u) => { u /= 255; return u <= 0.03928 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4); }; return 0.2126 * f(p[0]) + 0.7152 * f(p[1]) + 0.0722 * f(p[2]); };
  const bgOf = (el) => {
    let n = el;
    if (!n) return [240, 240, 240];
    for (let i = 0; n && i < 80; i++) {
      if (n.nodeType === 1) {
        const c = getComputedStyle(n);
        if (c.backgroundImage && c.backgroundImage !== 'none') { const m = c.backgroundImage.match(/rgba?\([^)]*\)/g); if (m && m.length) { const ps = m.map(P).filter((p) => p && (p[3] == null || p[3] > 0.4)); if (ps.length) return ps.reduce((a, p) => [a[0] + p[0] / ps.length, a[1] + p[1] / ps.length, a[2] + p[2] / ps.length], [0, 0, 0]); } }
        const p = P(c.backgroundColor);
        if (p && (p[3] == null || p[3] > 0.5)) return p;
        if (p && p[3] > 0.04) { const u = bgOf(n.parentNode || n.host); return [p[0] * p[3] + u[0] * (1 - p[3]), p[1] * p[3] + u[1] * (1 - p[3]), p[2] * p[3] + u[2] * (1 - p[3])]; } // tone-flate
      }
      n = n.parentNode || n.host;
    }
    return [240, 240, 240];
  };
  const opac = (el) => { let o = 1, n = el; for (let i = 0; n && i < 80; i++) { if (n.nodeType === 1) o *= Number(getComputedStyle(n).opacity); n = n.parentNode || n.host; } return o; };
  const inIsland = (e) => { let n = e; for (let i = 0; n && i < 80; i++) { if (n.nodeType === 1 && (n.hasAttribute('data-ki-island') || n.getAttribute('data-theme') === 'dark')) return true; n = n.parentNode || n.host; } return false; };
  const walk = (r) => r.querySelectorAll('*').forEach((e) => {
    if (e.shadowRoot) walk(e.shadowRoot);
    if (e.localName === 'style' || e.localName === 'script') return;
    const txt = [...e.childNodes].filter((t) => t.nodeType === 3 && t.textContent.trim()).map((t) => t.textContent.trim()).join(' ');
    if (!txt) return;
    const rc = e.getBoundingClientRect(); if (!rc.width || !rc.height) return;
    const c = getComputedStyle(e); if (c.visibility === 'hidden' || c.display === 'none') return;
    if (opac(e) < 0.6) return; // bevisst nedtonet (deaktivert)
    if (inIsland(e)) return;
    const svgText = e instanceof SVGElement;
    const fg = P(svgText ? c.fill : c.color); if (!fg) return;
    const bg = bgOf(e);
    const a = (fg[3] == null ? 1 : fg[3]) * (svgText ? Number(c.fillOpacity || 1) : 1);
    const mix = [fg[0] * a + bg[0] * (1 - a), fg[1] * a + bg[1] * (1 - a), fg[2] * a + bg[2] * (1 - a)];
    const k = (Math.max(L(mix), L(bg)) + 0.05) / (Math.min(L(mix), L(bg)) + 0.05);
    seen.n++;
    const info = { t: txt.slice(0, 22), k: +k.toFixed(2), fg: svgText ? c.fill : c.color, bg: `rgb(${bg.map(Math.round).join(',')})`, cls: String((e.className && e.className.baseVal != null ? e.className.baseVal : e.className) || e.localName).slice(0, 26) };
    if (k < 4.5) bad.push(info);
    if (L(mix) > 0.75 && L(bg) > 0.45) white.push(info);
    if (L(bg) < 0.03 && L(mix) < 0.2) blackBg.push(info);
  });
  const card = CARD(); if (card) walk(card.shadowRoot || card);
  return { n: seen.n, bad, white, blackBg };
};

const clickTab = (page, i) => page.evaluate(async (i) => { const t = TABS()[i]; if (t) t.click(); await new Promise((r) => setTimeout(r, 700)); return t ? (t.textContent || t.getAttribute('aria-label') || '').trim().slice(0, 20) : null; }, i);
const nTabs = (page) => page.evaluate(() => TABS().length);
const fname = (s) => s.replace(/[^\wæøå]+/gi, '_');

for (const vp of VPS) {
  for (const c of CASES) {
    const tag = `[${vp.n}] ${c.name}`;
    // --- ny kode: mørk (alle faner) → lys (alle faner, uten reload) ---
    const { page, errs } = await open(bundle, c, vp);
    const n = Math.max(1, await nTabs(page));
    const darkNew = [];
    for (let i = 0; i < n; i++) {
      const label = n > 1 ? await clickTab(page, i) : 'standard';
      darkNew.push({ label, col: await page.evaluate(ALLCOL) });
      if (SHOT) await page.screenshot({ path: `${SHOT}/${vp.n}-${fname(c.name)}-${i}-mork.png` });
    }
    if (n > 1) await clickTab(page, 0);
    await page.evaluate(() => setMode(false));
    const attr = await page.evaluate(() => ({ html: document.documentElement.getAttribute('data-ki-theme'), pop: (deep('.bubble-pop-up.is-popup-opened') || {}).getAttribute && deep('.bubble-pop-up.is-popup-opened').getAttribute('data-ki-theme') }));
    ok(`${tag}: lys modus satt uten reload (html + popup-rot)`, attr.html === 'light' && attr.pop === 'light', attr);
    for (let i = 0; i < n; i++) {
      const label = n > 1 ? await clickTab(page, i) : 'standard';
      await page.waitForTimeout(250);
      const s = await page.evaluate(SCAN);
      const where = `${tag} · ${label}`;
      ok(`${where}: lys kontrast ≥ 4,5:1 (${s.n} tekster)`, s.bad.length === 0, s.bad.slice(0, 8));
      ok(`${where}: ingen hvit tekst på lys flate`, s.white.length === 0, s.white.slice(0, 5));
      ok(`${where}: ingen svart flate med mørk tekst`, s.blackBg.length === 0, s.blackBg.slice(0, 5));
      if (SHOT) await page.screenshot({ path: `${SHOT}/${vp.n}-${fname(c.name)}-${i}-lys.png` });
    }
    // Ringeklokke: kamerabildet forblir mørkt i lys modus
    if (/ringeklokke/.test(c.cards[0].type)) {
      if (n > 1) await clickTab(page, 0);
      const cam = await page.evaluate(() => {
        const sr = CARD().shadowRoot, v = sr.querySelector('.cam, .vid, .video, [data-cam]');
        if (!v) return null;
        let bgEl = v, bg = 'rgba(0, 0, 0, 0)';
        for (let i = 0; bgEl && i < 6; i++) { bg = getComputedStyle(bgEl).backgroundColor; if (!/rgba\(0, 0, 0, 0\)/.test(bg)) break; bgEl = bgEl.parentElement; }
        let isl = false; for (let x = v; x; x = x.parentElement) if (x.hasAttribute('data-ki-island') || x.getAttribute('data-theme') === 'dark') isl = true;
        return { bg, isl, cls: v.className };
      });
      ok(`${tag}: kamerabildet er mørk øy (mørk flate i lys modus)`, cam == null || (cam.isl && /rgba?\((\d+), \1, \1/.test(cam.bg) && +/\d+/.exec(cam.bg)[0] < 60), cam);
    }
    // tilbake til mørk uten reload
    await page.evaluate(() => setMode(true));
    if (n > 1) await clickTab(page, 0);
    const back = await page.evaluate(ALLCOL);
    const firstDark = new Map(darkNew[0].col);
    const backDiff = back.filter(([k, v]) => firstDark.has(k) && firstDark.get(k) !== v);
    ok(`${tag}: mørk igjen etter lys = som før byttet`, backDiff.length === 0, backDiff.slice(0, 4));
    ok(`${tag}: ingen sidefeil`, errs.length === 0, errs.slice(0, 3));
    await page.close();
    // --- før-koden (TEMA_BASE): mørk element for element ---
    if (BASE) {
      const b = await open(BASE, c, vp);
      const nb = Math.max(1, await nTabs(b.page));
      for (let i = 0; i < Math.min(n, nb); i++) {
        const label = nb > 1 ? await clickTab(b.page, i) : 'standard';
        const OLD = new Map(await b.page.evaluate(ALLCOL));
        const NEW = darkNew[i].col, diff = [];
        let same = 0;
        for (const [k, v] of NEW) { if (!OLD.has(k)) continue; if (OLD.get(k) === v) same++; else diff.push({ k: k.slice(-70), før: OLD.get(k), nå: v }); }
        ok(`${tag} · ${label}: mørk = før-koden (${same} like, ${NEW.length} nå / ${OLD.size} før)`, diff.length === 0 && NEW.length === OLD.size, diff.slice(0, 5));
        if (process.env.TEMA_DIFF && diff.length) diff.slice(0, 30).forEach((d) => console.log('DIFF', tag, label, d.k, '\n  før', d.før, '\n  nå ', d.nå));
      }
      await b.page.close();
    }
  }
}
await browser.close();
try { unlinkSync(bundle); } catch (e) { /* */ }
console.log(res.join('\n'));
const fails = res.filter((r) => r.startsWith('✘')).length;
console.log(fails ? `\n${fails} feilet` : '\nAlle bestod');
process.exit(fails ? 1 : 0);
