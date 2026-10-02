// Fiks 33.3 · Innstillinger (#settings): DASHBORD-, Utseende- og Enheter-delen + fotteksten er fjernet fra popupen.
//   A · popupen (ekte Bubble Card, 390 px og PC) slutter etter brytersettene: toppkort → faner → bryterlista, ingen
//       msh-settings-card, ingen «Tilpass Hjem/navbar/header», «Home Assistant», «Områder og etasjer», «Liquid Glass»,
//       «Enheter», «gjelder for deg … denne enheten»; gammel config `dashbord: true` gir heller ingen del; ingen
//       «Dashbordinnstillinger nederst» i Tilpass (skjemaet / GUI-editoren)
//   B · funksjonene finnes fortsatt: navbarens «Mer» → «Tilpass» → Tilpass Hjem / navbar / header åpner editorene;
//       «Tilpass navbar» har «Liquid Glass-tema»; eget oppsett per enhet ligger i Kamera/Person-arkene (msh-scope-bar,
//       MSH.PER_DEVICE_CARDS); lagringen er urørt (MSH.store, glassOn/glassSet, msh-settings-card finnes fortsatt)
//   C · lyst tema (Del A-tokens på containeren): faner/rader/tekst i popupen ≥ 4,5:1; mørk modus uendret
//   node test/innstillinger33-check.mjs
import { createRequire } from 'node:module';
import { readdirSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
mkdirSync('test/.build', { recursive: true });
const bundle = resolve(`test/.build/innst33-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const BC = resolve('test/.vendor/bubble-card.js');
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const res = {}, fail = [], errs = [];
const ok = (name, cond, info) => { res[name] = cond ? 'OK' : ['FEIL', info]; if (!cond) fail.push(name); };
const mocks = readdirSync('test/mock').filter((f) => f.endsWith('.js')).sort().map((m) => resolve('test/mock/' + m));
const LIGHT = { '--ki-bg': '#e6e6e6', '--ki-popup': '#f0f0f0', '--ki-surface': '#ffffff', '--ki-surface-2': '#ebebeb', '--ki-surface-3': '#dedede', '--ki-text': '#1c1c1c', '--ki-text-2': '#5c5c5c', '--ki-text-3': '#858585', '--ki-line': 'rgba(0,0,0,.08)', '--ki-pill-bg': '#1c1c1c', '--ki-pill-fg': '#fafafa', '--ki-on-accent': '#2a1720', '--ki-red-text': 'rgb(186 58 44)', '--ki-green-text': 'rgb(18 128 78)', '--ki-amber-text': 'rgb(168 98 24)', '--ki-blue-text': 'rgb(30 108 178)', '--ki-pink-text': 'rgb(176 48 128)', '--ki-yellow-text': 'rgb(140 108 0)' }; // Del A pkt. 6 (aksent som tekst)
const BANNED = /Tilpass Hjem|Tilpass navbar|Tilpass header|Home Assistant\s*Innstillinger|Områder og etasjer|Liquid Glass|Enheter|gjelder for deg|denne enheten|Dashbord/;

async function popup(vp, cfg, light) {
  const p = await b.newPage({ viewport: { width: vp.w, height: vp.h }, hasTouch: true });
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + resolve('test/harness-bubble.html'));
  for (const m of mocks) await p.addScriptTag({ path: m });
  await p.addScriptTag({ path: bundle });
  await p.addScriptTag({ path: BC, type: 'module' });
  await p.waitForFunction(() => customElements.get('bubble-card'), null, { timeout: 15000 });
  await p.evaluate(async ({ vp, cfg, light, LIGHT }) => {
    const wait = (ms) => new Promise((q) => setTimeout(q, ms));
    document.documentElement.style.setProperty('--sb', (vp.sb || 0) + 'px');
    const h = window.mockHass();
    if (light) { h.themes = { ...(h.themes || {}), darkMode: false }; const r = document.documentElement; if (!(window.MSH.theme && window.MSH.theme.update)) { r.setAttribute('data-ki-theme', 'light'); Object.entries(LIGHT).forEach(([k, v]) => r.style.setProperty(k, v)); } /* ellers: ekte MSH.theme (hass.themes.darkMode=false) */ }
    if (window.MSH.store && !window.MSH.store.loaded) await window.MSH.store.load(h);
    const pop = { type: 'custom:bubble-card', card_type: 'pop-up', name: 'Innstillinger', icon: 'mdi:cog', hash: '#settings', is_sidebar_hidden: true, bg_blur: '5', bg_opacity: '98', margin_top_mobile: '50px', margin_top_desktop: '50px', card_layout: 'large', cards: [{ type: 'custom:msh-innstillinger-card', card_id: 'pop-innstillinger', ...(cfg || {}) }] };
    const bc = document.createElement('bubble-card'); bc.setConfig(pop); bc.hass = h; document.getElementById('dash').appendChild(bc);
    await wait(400); location.hash = '#settings'; await wait(1800);
    const all = []; const walk = (root) => root.querySelectorAll('*').forEach((e) => { all.push(e); if (e.shadowRoot) walk(e.shadowRoot); }); walk(document);
    window.__c = all.find((e) => e.localName === 'msh-innstillinger-card');
    if (light) { const pe = all.find((e) => e.classList && e.classList.contains('bubble-pop-up')); if (pe) pe.style.background = '#f0f0f0'; }
  }, { vp, cfg, light, LIGHT });
  return p;
}
const inspect = (p) => p.evaluate(() => {
  const sr = window.__c.shadowRoot, w = sr.querySelector('.wrap');
  const kids = [...w.children].map((e) => e.className.split(' ')[0] || e.localName);
  const deepTxt = (r) => { let t = ''; r.querySelectorAll('*').forEach((e) => { if (e.shadowRoot) t += ' ' + deepTxt(e.shadowRoot); }); return (r.textContent || '') + t; };
  return { kids, settings: !!sr.querySelector('msh-settings-card, .dash'), txt: deepTxt(sr).replace(/\s+/g, ' '), rows: sr.querySelectorAll('.lst .pr').length };
});

/* ---------------- A */
for (const vp of [{ n: '390', w: 390, h: 844 }, { n: 'PC', w: 1400, h: 900, sb: 256 }]) {
  for (const cfg of [{}, { dashbord: true }]) {
    const p = await popup(vp, cfg);
    const r = await inspect(p);
    ok(`A · ${vp.n}${cfg.dashbord ? ' (gammel dashbord: true)' : ''}: popupen slutter etter brytersettene (… faner → bryterlista)`, r.kids[r.kids.length - 1] === 'pane' && r.rows > 0 && !r.settings, r.kids);
    ok(`A · ${vp.n}${cfg.dashbord ? ' (gammel dashbord: true)' : ''}: ingen DASHBORD/Utseende/Enheter/fottekst`, !BANNED.test(r.txt), (r.txt.match(BANNED) || [])[0]);
    await p.close();
  }
}
{
  const p = await popup({ w: 390, h: 844 });
  const S = await p.evaluate(() => { const C = customElements.get('msh-innstillinger-card'); let sc = C.schema; if (typeof sc === 'function') sc = sc(); let js = ''; try { js = JSON.stringify(sc); } catch (e) { js = String(sc); } return { dash: /"name":"dashbord"|Dashbordinnstillinger/.test(js), el: C.getConfigElement && C.getConfigElement().localName }; });
  ok('A · Tilpass/GUI-editoren har ikke lenger «Dashbordinnstillinger nederst»', !S.dash && S.el === 'msh-editor', S);
  await p.close();
}

/* ---------------- B · funksjonene finnes fortsatt */
{
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + resolve('test/harness.html'));
  for (const m of mocks) await p.addScriptTag({ path: m });
  await p.addScriptTag({ path: bundle });
  await p.evaluate(async () => {
    try { localStorage.clear(); } catch (e) { /* */ }
    window.deepAll = (sel, root) => { const out = []; const walk = (r) => r.querySelectorAll('*').forEach((e) => { if (e.matches(sel)) out.push(e); if (e.shadowRoot) walk(e.shadowRoot); }); walk(root || document); return out; };
    window.deep = (sel, root) => window.deepAll(sel, root)[0] || null;
    const H = window.mockHass(); window.H = H; window.MSH.lastHass = H;
    await window.MSH.store.load(H);
    const v = await window.MSH.generateDashboardView({}, H);
    const nc = v.cards[0].cards.find((c) => c.type === 'custom:msh-navbar-card');
    const nb = document.createElement('msh-navbar-card'); nb.setConfig(nc); nb.hass = H; document.getElementById('dash').append(nb);
    await new Promise((q) => setTimeout(q, 1500));
  });
  const B = await p.evaluate(async () => {
    const wait = (ms) => new Promise((q) => setTimeout(q, ms));
    const M = window.MSH, out = {};
    const more = window.deep('nav.nb [data-id="__more"]'); if (more) { more.click(); await wait(500); }
    const t = window.deep('.mbox .mi[data-id="__tilpass"]'); out.tilpass = !!t;
    if (t) { t.click(); await wait(500); }
    const sh = M.portals().find((x) => x.hasAttribute('data-tilpass'));
    out.rows = sh ? [...sh.shadowRoot.querySelectorAll('.tpr')].map((e) => e.dataset.v) : [];
    const ev = []; const on = (e) => ev.push(e.detail && e.detail.editor); window.addEventListener('ki-open-editor', on);
    if (sh) { sh.shadowRoot.querySelector('.tpr[data-v="navbar"]').click(); await wait(900); }
    window.removeEventListener('ki-open-editor', on);
    out.ev = ev;
    const deepTxt = (r) => { let s = ''; r.querySelectorAll('*').forEach((e) => { if (e.shadowRoot) s += ' ' + deepTxt(e.shadowRoot); }); return (r.textContent || '') + s; };
    out.glass = M.portals().some((x) => /Liquid Glass-tema/.test(deepTxt(x.shadowRoot || x)));
    out.store = !!(M.store && M.store.loaded && typeof M.glassOn === 'function' && M.store.deviceName != null);
    out.perDev = Array.isArray(M.PER_DEVICE_CARDS) ? M.PER_DEVICE_CARDS.slice() : M.PER_DEVICE_CARDS;
    out.scope = !!customElements.get('msh-scope-bar');
    out.settingsCard = !!customElements.get('msh-settings-card') && typeof M.innstEnheter === 'function';
    return out;
  });
  ok('B · «Mer» → «Tilpass» → arket har Tilpass Hjem · navbar · header', B.tilpass && ['home', 'navbar', 'header'].every((k) => B.rows.includes(k)), B);
  ok('B · «Tilpass navbar» åpnes fra arket og har «Liquid Glass-tema»', B.ev.includes('navbar') && B.glass, B);
  ok('B · eget oppsett per enhet: Kamera/Person (MSH.PER_DEVICE_CARDS + msh-scope-bar); lagringen urørt (ki-store, msh-settings-card, innstEnheter)', B.store && B.scope && B.settingsCard && JSON.stringify(B.perDev).includes('kamera') && JSON.stringify(B.perDev).includes('person'), B);
  await p.close();
}

/* ---------------- C · lyst tema */
{
  const lum = (c) => { const m = /rgba?\(([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/.exec(c) || /color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)/.exec(c); if (!m) return null; let v = [m[1], m[2], m[3]].map(Number); if (/color\(srgb/.test(c)) v = v.map((x) => x * 255); const f = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(v[0]) + 0.7152 * f(v[1]) + 0.0722 * f(v[2]); };
  const ratio = (a, bb) => { const A = lum(a), B = lum(bb); if (A == null || B == null) return 0; return (Math.max(A, B) + 0.05) / (Math.min(A, B) + 0.05); };
  const p = await popup({ w: 390, h: 844 }, {}, true);
  const L = await p.evaluate(() => {
    const sr = window.__c.shadowRoot, bgOf = (e) => { let n = e; while (n) { if (n.nodeType === 1) { const c = getComputedStyle(n).backgroundColor; if (c !== 'rgba(0, 0, 0, 0)' && !/, 0\)$/.test(c)) return c; } n = n.parentNode || n.host; } return 'rgb(240, 240, 240)'; };
    const pick = (sel) => [...sr.querySelectorAll(sel)].slice(0, 4).map((e) => [sel, getComputedStyle(e).color, bgOf(e), e.textContent.trim().slice(0, 20)]);
    return [...pick('.lst .pr .pt b'), ...pick('.lst .pr .pt i'), ...pick('.cnt .num'), ...pick('.srch input')];
  });
  const bad = L.filter(([, c, bg]) => ratio(c, bg) < 4.5).map((x) => [...x, ratio(x[1], x[2]).toFixed(2)]);
  ok('C · lys: radtitler, undertekster, telleren og søkefeltet ≥ 4,5:1 mot flaten', L.length > 4 && !bad.length, bad.length ? bad : L);
  await p.close();
}

ok('ingen sidefeil', !errs.length, errs.slice(0, 5));
console.log(JSON.stringify(res, null, 1));
await b.close();
console.log(fail.length ? `\nFEIL (${fail.length}): ${fail.join(' | ')}` : '\nInnstillinger 33: alt OK');
process.exit(fail.length ? 1 : 0);
