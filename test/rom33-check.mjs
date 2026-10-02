// Fiks 33.6 + 35.5 + 35.6 + 35.7 regel 7 + Del A · Rom-popup mot ekte Bubble Card:
//  · padT: standard 0 px fra Bubble-headeren til klima-toppkortet (pad_top −4, vist som «0 px»), forvalg
//    Standard 0 · Litt 10 · Luftig 24 · Ekstra 48, brukerens verdi overstyrer.
//  · Gardin-/markisenavn kuttes aldri (kolonne 112 px, line-height 1.2, overflow-wrap:anywhere, text-wrap:balance)
//    ved 360 og 390 px, i lys og mørk modus.
//  · Gardin-prosentknapper med tokens (--ki-surface-2 + --ki-text, aktiv = rosa + --ki-on-accent); kontrast ≥ 4,5:1 i lys.
//   node test/rom33-check.mjs        (SHOTS=<mappe> lagrer skjermbilder)
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { readdirSync, existsSync, mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const BC = resolve('test/.vendor/bubble-card.js');
if (!existsSync(BC)) execFileSync('curl', ['-sSL', '-o', BC, 'https://raw.githubusercontent.com/Clooos/Bubble-Card/main/dist/bubble-card.js']);
mkdirSync('test/.build', { recursive: true });
const bundle = resolve(`test/.build/rom33-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const shots = process.env.SHOTS || '';
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const res = {}, fail = [];
const ok = (name, cond, info) => { res[name] = cond ? 'OK' : ['FEIL', info]; if (!cond) fail.push(name); };
const errs = [];

const LONG = [
  ['cover.soverom_gardiner_venstre', 'Gardiner Venstre'],
  ['cover.soverom_markise', 'Markise terrassen mot hagen'],
  ['cover.soverom_lang', 'Rullegardinvenstrevinduetmothagen'],
];

async function page(vw, light) {
  const p = await b.newPage({ viewport: { width: vw, height: 900 }, hasTouch: true });
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + resolve('test/harness-bubble.html'));
  for (const m of readdirSync('test/mock').sort()) await p.addScriptTag({ path: resolve('test/mock/' + m) });
  await p.addScriptTag({ path: bundle });
  await p.addScriptTag({ path: BC, type: 'module' });
  await p.waitForFunction(() => customElements.get('bubble-card'));
  await p.evaluate(async ({ light, LONG }) => {
    const wait = (ms) => new Promise((q) => setTimeout(q, ms));
    const hass = window.mockHass();
    hass.themes = { darkMode: !light };
    const t = new Date().toISOString();
    LONG.forEach(([id, nm], i) => { hass.states[id] = { entity_id: id, state: 'open', attributes: { friendly_name: nm, current_position: [100, 50, 25][i], supported_features: 15 }, last_changed: t, last_updated: t }; hass.entities = { ...hass.entities, [id]: { entity_id: id, platform: 'demo', area_id: 'soverom', device_id: null } }; });
    window.__h = hass;
    if (window.MSH.theme && window.MSH.theme.update) window.MSH.theme.update(hass);
    if (light) document.documentElement.setAttribute('data-ki-theme', 'light');
    const mk = (hash, cards) => { const bc = document.createElement('bubble-card'); bc.setConfig({ type: 'custom:bubble-card', card_type: 'pop-up', hash, name: 'Rom', bg_color: light ? '#f0f0f0' : '#282828', bg_opacity: 100, bg_blur: 0, cards }); bc.hass = hass; document.getElementById('dash').appendChild(bc); return bc; };
    mk('#stue', [{ type: 'custom:msh-rom-card', card_id: 'r33a' }]);
    mk('#soverom', [{ type: 'custom:msh-rom-card', card_id: 'r33b', pad_top: 20 }]);
    await wait(400);
    // hjelpere
    window.allEls = () => { const o = []; const w = (r) => r.querySelectorAll('*').forEach((e) => { o.push(e); if (e.shadowRoot) w(e.shadowRoot); }); w(document); return o; };
    window.openHash = async (h) => { location.hash = h; await wait(1300); };
    window.romCard = () => window.allEls().find((e) => e.localName === 'msh-rom-card' && e.getBoundingClientRect().height > 0);
    window.hdrBottom = () => { const c = window.allEls().filter((e) => e.classList && e.classList.contains('bubble-header-container')).find((e) => e.getBoundingClientRect().height > 0); return c.getBoundingClientRect().bottom; };
    window.topDist = () => { const r = window.romCard(), k = r.shadowRoot.querySelector('msh-rom-klima-card'); return Math.round(k.getBoundingClientRect().top - window.hdrBottom()); };
    const parse = (s) => {
      s = String(s || '');
      let m = s.match(/color\(srgb\s+([\d.e-]+)\s+([\d.e-]+)\s+([\d.e-]+)(?:\s*\/\s*([\d.e-]+))?\)/);
      if (m) return [m[1] * 255, m[2] * 255, m[3] * 255, m[4] != null ? +m[4] : 1];
      m = s.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)/);
      if (!m) return null;
      return [+m[1], +m[2], +m[3], m[4] == null ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : +m[4]];
    };
    const over = (t, bt) => { const a = t[3]; return [t[0] * a + bt[0] * (1 - a), t[1] * a + bt[1] * (1 - a), t[2] * a + bt[2] * (1 - a), 1]; };
    const up = (e) => e.parentElement || (e.getRootNode && e.getRootNode().host) || null;
    const bgOf = (el) => {
      const L = [];
      for (let e = el; e; e = up(e)) {
        const cs = getComputedStyle(e), img = cs.backgroundImage && cs.backgroundImage !== 'none' ? parse(cs.backgroundImage) : null, c = img || parse(cs.backgroundColor);
        if (c && c[3] > 0) { L.push(c); if (c[3] >= 1) break; }
      }
      let o = light ? [240, 240, 240, 1] : [40, 40, 40, 1];
      for (let i = L.length - 1; i >= 0; i--) o = over(L[i], o);
      return o;
    };
    const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
    window.contrast = (el) => { const bg = bgOf(el), fg = over(parse(getComputedStyle(el).color) || [0, 0, 0, 1], bg), a = lum(fg), c = lum(bg); return (Math.max(a, c) + 0.05) / (Math.min(a, c) + 0.05); };
    // Linjer i et tekstelement (unike topp-posisjoner til tegnrektanglene) og om noe av teksten ligger utenfor elementet
    window.textInfo = (el) => {
      const rg = document.createRange(); rg.selectNodeContents(el);
      const rects = [...rg.getClientRects()].filter((r) => r.width > 0), box = el.getBoundingClientRect();
      const lines = new Set(rects.map((r) => Math.round(r.top))).size;
      const outside = rects.some((r) => r.right > box.right + 0.5 || r.left < box.left - 0.5 || r.bottom > box.bottom + 0.5);
      const cs = getComputedStyle(el);
      return { t: el.textContent, w: Math.round(box.width), lines, outside, sw: el.scrollWidth, cw: el.clientWidth, ws: cs.whiteSpace, to: cs.textOverflow, ow: cs.overflowWrap, tw: cs.textWrap || cs.textWrapStyle || '', lh: cs.lineHeight, fs: cs.fontSize, flex: cs.flex };
    };
  }, { light: !!light, LONG });
  return p;
}

/* ---------------------------------------------------------------- 33.6 · padT (390, mørk) */
{
  const p = await page(390, false);
  const S = await p.evaluate(async () => {
    const wait = (ms) => new Promise((q) => setTimeout(q, ms));
    const r0 = {};
    await window.openHash('#stue');
    const r = window.romCard();
    r0.def = window.topDist();
    r0.cfgTop = r.config.pad_top;
    for (const [v, k] of [[-4, 'v0'], [6, 'v10'], [20, 'v24'], [44, 'v48']]) { r.setConfig({ ...r._rawConfig, pad_top: v }); await wait(200); r0[k] = window.topDist(); }
    r.setConfig({ ...r._rawConfig, pad_top: undefined }); await wait(200);
    r0.back = window.topDist();
    // Skjema + mellomrom-editoren: forvalg og vist verdi
    const sch = customElements.get('msh-rom-card').schema(window.__h, r.config);
    const find = (L) => { for (const x of L || []) { if (!x || typeof x !== 'object') continue; if (x.id === 'spacing' && Array.isArray(x.fields)) return x; const y = find(x.fields) || find(x.tabs) || find(x.items); if (y) return y; } return null; };
    const sp = find(sch), f = sp.fields.find((x) => x.name === 'pad_top');
    r0.presets = f.presets.map((x) => x.join(':'));
    r0.def0 = f.default;
    const html = window.MSH.spacingEditorHTML(sp.fields, r.config, 'ksp-t');
    const host = document.createElement('div'); host.innerHTML = html; document.body.appendChild(host); await wait(50);
    const ed = host.querySelector('ki-spacing-editor');
    const row = ed.shadowRoot.querySelector('.r[data-spn="pad_top"]');
    r0.shown = row.querySelector('.v').textContent;
    r0.chips = [...row.querySelectorAll('.p')].map((x) => x.textContent + (x.classList.contains('on') ? '*' : ''));
    host.remove();
    await window.openHash('#soverom');
    r0.own = window.topDist(); // egen verdi pad_top: 20 → 24 px
    return r0;
  });
  ok('33.6 standard: 0 px fra Bubble-headeren til klima-toppkortet', Math.abs(S.def) <= 1 && S.cfgTop == null && S.def0 === -4, S);
  ok('33.6 forvalg gir 0 / 10 / 24 / 48 px', Math.abs(S.v0) <= 1 && Math.abs(S.v10 - 10) <= 1 && Math.abs(S.v24 - 24) <= 1 && Math.abs(S.v48 - 48) <= 1 && Math.abs(S.back) <= 1, S);
  ok('33.6 Mellomrom: forvalg «Standard 0 · Litt 10 · Luftig 24 · Ekstra 48», standard vist som «0 px»', S.presets.join() === '-4:Standard 0,6:Litt 10,20:Luftig 24,44:Ekstra 48' && S.shown === '0 px' && S.chips[0] === 'Standard 0*', S);
  ok('33.6 brukerens verdi overstyrer (pad_top 20 → 24 px)', Math.abs(S.own - 24) <= 1, S);
  await p.close();
}

/* ---------------------------------------------------------------- 35.5 / 35.6 · gardiner, 360 + 390, mørk + lys */
for (const light of [false, true]) {
  for (const vw of [360, 390]) {
    const tag = `${light ? 'lys' : 'mørk'} ${vw}px`;
    const p = await page(vw, light);
    const G = await p.evaluate(async (light) => {
      const wait = (ms) => new Promise((q) => setTimeout(q, ms));
      await window.openHash('#soverom');
      const r = window.romCard(), sr = r.shadowRoot;
      const x = sr.querySelector('.cvx');
      if (x) { x.click(); await wait(350); }
      const names = [...sr.querySelectorAll('.cvn, .cvn2')].map(window.textInfo);
      const pres = [...sr.querySelectorAll('.pre')];
      // forvalg 0 % → alle gardiner 0 → aktiv
      const before = pres.map((e) => e.classList.contains('on'));
      sr.querySelector('.pre[data-v="0"]').click(); await wait(400);
      const pre0 = sr.querySelector('.pre[data-v="0"]'), pre50 = sr.querySelector('.pre[data-v="50"]');
      const cs = (e) => getComputedStyle(e);
      const rows = [...sr.querySelectorAll('.cvr, .cvr2')].map((e) => ({ w: Math.round(e.getBoundingClientRect().width), sw: e.scrollWidth, cw: e.clientWidth }));
      const txt = [...sr.querySelectorAll('.cvn, .cvn2, .cvp, .cvp2, .pre')].map((e) => ({ t: e.textContent.trim().slice(0, 24), c: +window.contrast(e).toFixed(2) }));
      return {
        names, before, rows, txt, html: document.documentElement.getAttribute('data-ki-theme'),
        pre: { bg: cs(pre50).backgroundColor, fg: cs(pre50).color, onBg: cs(pre0).backgroundImage, onFg: cs(pre0).color, on: pre0.classList.contains('on'), pressed: pre0.getAttribute('aria-pressed') },
        box: cs(sr.querySelector('.cvbox')).backgroundColor, track: cs(sr.querySelector('.cvt')).backgroundColor, knob: cs(sr.querySelector('.knob')).backgroundColor,
        hostOver: sr.host.scrollWidth > sr.host.getBoundingClientRect().width + 1,
      };
    }, light);
    const want = ['Gardiner Venstre', 'Markise terrassen mot hagen', 'Rullegardinvenstrevinduetmothagen'];
    const N = G.names.filter((n) => want.includes(n.t));
    ok(`35.5 ${tag}: lange navn vises hele (ingen kutt/ellipsis/nowrap, ingen overflyt)`, N.length === 3 && G.names.every((n) => !n.outside && n.sw <= n.cw + 1 && n.ws !== 'nowrap' && n.to !== 'ellipsis'), G.names);
    ok(`35.7 regel 7 ${tag}: kolonne 112 px, line-height 1.2, overflow-wrap:anywhere, text-wrap:balance`, G.names.every((n) => n.w === 112 && /^0 0 112px/.test(n.flex) && Math.abs(parseFloat(n.lh) - 1.2 * parseFloat(n.fs)) < 0.6 && n.ow === 'anywhere' && /balance/.test(n.tw)), G.names);
    ok(`35.5 ${tag}: «Gardiner Venstre» på to linjer`, (G.names.find((n) => n.t === 'Gardiner Venstre') || {}).lines === 2, G.names);
    ok(`35.5 ${tag}: radene flyter ikke over`, G.rows.every((r) => r.sw <= r.cw + 1) && !G.hostOver, G.rows);
    ok(`35.6 ${tag}: forvalg 0 % blir aktiv (rosa + aria-pressed) når alle gardiner står der`, G.pre.on && G.pre.pressed === 'true' && /gradient/.test(G.pre.onBg) && !G.before.every(Boolean), G.pre);
    if (!light) ok(`Del A ${tag}: mørk som i dag (#3a3a3a boks, #2a2a2a knapper, #282828 spor, hvit tekst)`, G.box === 'rgb(58, 58, 58)' && G.pre.bg === 'rgb(42, 42, 42)' && G.pre.fg === 'rgb(250, 250, 250)' && G.track === 'rgb(40, 40, 40)', G);
    else {
      ok(`Del A ${tag}: lys – boks #fff, knapper --ki-surface-2 + mørk tekst, aktiv mørk tekst på rosa, spor --ki-surface-3, hvit knott`, G.html === 'light' && G.box === 'rgb(255, 255, 255)' && G.pre.bg === 'rgb(235, 235, 235)' && /rgb\((2[0-9]|1[0-9]), /.test(G.pre.fg) && /rgb\(42, 23, 32\)/.test(G.pre.onFg) && G.track === 'rgb(222, 222, 222)' && G.knob === 'rgb(255, 255, 255)', G);
      ok(`Del A ${tag}: gardin-tekst og knapper ≥ 4,5:1`, G.txt.every((t) => t.c >= 4.5), G.txt);
    }
    if (shots) await p.screenshot({ path: `${shots}/rom33-${light ? 'lys' : 'mork'}-${vw}.png` });
    await p.close();
  }
}

ok('ingen sidefeil', !errs.length, errs);
await b.close();
for (const [k, v] of Object.entries(res)) console.log(v === 'OK' ? 'OK  ' : 'FEIL', k, v === 'OK' ? '' : String(JSON.stringify(v[1])).slice(0, 1200));
console.log(fail.length ? `\n${fail.length} feil` : '\nAlt OK');
process.exit(fail.length ? 1 : 0);
