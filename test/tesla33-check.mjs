// Fiks 33.5 + 35.8 · Tesla (#bil): ingen skravering i ladestaven, ladebølge under lading, grense-markør uendret; Del A-tokens.
//   A · lader: feltet batteri → grense er en jevn flate rgb(102 209 158 / .18) (ingen repeating-linear-gradient), ladebølgen
//       chgFlow (grønn → .55 → 0, 40 % av feltet, 1,8 s cubic-bezier(.4,0,.2,1), uendelig, background-position −70 % → 170 %)
//       ligger inne i feltet (overflow hidden, samme rektangel som feltet), grense-markør hvit 4 px + 0 0 0 3px rgba(0,0,0,.25)
//   B · lader ikke: samme jevne flate, ingen bølge og ingen animasjon
//   C · prefers-reduced-motion: ingen animasjon og ingen bølge – også mens den lader
//   D · lyst tema (Del A-tokens på <html>): ladekortets tekst ≥ 4,5:1, stav-sporet er lyst (ikke #282828), prosent-teksten på
//       grønt mørk (on-accent); toppkortet (bilscenen) er en mørk øy med lys tekst; mørk modus uendret (#282828-spor)
//   node test/tesla33-check.mjs   – uavhengig av dato/klokkeslett
import { createRequire } from 'node:module';
import { readdirSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
mkdirSync('test/.build', { recursive: true });
const bundle = resolve(`test/.build/tesla33-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const res = {}, fail = [], errs = [];
const ok = (name, cond, info) => { res[name] = cond ? 'OK' : ['FEIL', info]; if (!cond) fail.push(name); };
const mocks = readdirSync('test/mock').sort().map((m) => resolve('test/mock/' + m));
const LIGHT = { '--ki-bg': '#e6e6e6', '--ki-popup': '#f0f0f0', '--ki-surface': '#ffffff', '--ki-surface-2': '#ebebeb', '--ki-surface-3': '#dedede', '--ki-ctrl': '#cfcfcf', '--ki-text': '#1c1c1c', '--ki-text-1': '#333333', '--ki-text-2': '#565656', '--ki-text-mid': '#606060', '--ki-text-3': '#757575', '--ki-text-lo': '#767676', '--ki-pill-bg': '#1c1c1c', '--ki-pill-fg': '#fafafa', '--ki-on-accent': '#2a1720', '--ki-knob': '#ffffff', '--ki-red-text': 'rgb(186 58 44)', '--ki-green-text': 'rgb(18 128 78)', '--ki-orange-text': 'rgb(168 98 24)', '--ki-pink-text': 'rgb(176 48 128)' };
const CHG = { 'switch.elbillader_charging': 'on', 'sensor.elbillader_charge_power': 7.2, 'select.tesla_model_y_batteri_charging_state': 'charging', 'sensor.tesla_model_y_batteri_batteriniva': 64 };
const IDLE = { 'switch.elbillader_charging': 'off', 'sensor.elbillader_charge_power': 0, 'sensor.tesla_model_y_batteri_charge_power': 0, 'select.tesla_model_y_batteri_charging_state': 'stopped', 'sensor.tesla_model_y_batteri_batteriniva': 64 };

async function page({ reduced, light } = {}) {
  const p = await b.newPage({ viewport: { width: 390, height: 900 }, hasTouch: true, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + resolve('test/harness.html'));
  for (const m of mocks) await p.addScriptTag({ path: m });
  await p.addScriptTag({ path: bundle });
  await p.evaluate(async ({ light, LIGHT }) => {
    const h = window.mockHass();
    if (light) { h.themes = { ...(h.themes || {}), darkMode: false }; const r = document.documentElement; if (!(window.MSH.theme && window.MSH.theme.update)) { r.setAttribute('data-ki-theme', 'light'); Object.entries(LIGHT).forEach(([k, v]) => r.style.setProperty(k, v)); } /* ellers: ekte MSH.theme (hass.themes.darkMode=false) */ document.body.style.background = '#f0f0f0'; }
    window.__h = h;
    const bc = document.createElement('bubble-card');
    bc.setConfig({ type: 'custom:bubble-card', card_type: 'pop-up', hash: '#tesla' });
    bc.innerHTML = '<div class="pop"><div class="hdr">Tesla</div><div class="inner"></div></div>';
    document.getElementById('dash').appendChild(bc);
    if (light) bc.querySelector('.pop').style.background = '#f0f0f0';
    location.hash = '#tesla';
    const c = document.createElement('msh-tesla-card');
    c.setConfig({ type: 'custom:msh-tesla-card', card_id: 'pop-tesla33' });
    c.hass = h; bc.querySelector('.inner').appendChild(c); window.__c = c;
    window.__setS = (o) => { const hh = window.__c.hass, st = { ...hh.states }; for (const [k, v] of Object.entries(o)) st[k] = { ...(st[k] || { entity_id: k, attributes: {} }), state: String(v) }; window.__c.hass = { ...hh, states: st }; };
    await new Promise((q) => setTimeout(q, 900));
  }, { light, LIGHT });
  return p;
}
const set = async (p, o) => { await p.evaluate((o) => window.__setS(o), o); await p.waitForTimeout(350); };
const bar = (p) => p.evaluate(() => {
  const sr = window.__c.shadowRoot, q = (s) => sr.querySelector(s), cs = (e) => getComputedStyle(e), R = (e) => e && e.getBoundingClientRect();
  const lim = q('.lim'), gap = q('.lgap'), mk = q('.lmk'), L = R(lim), G = gap && R(gap);
  return {
    lim: { bg: cs(lim).backgroundColor, h: Math.round(L.height) },
    gap: gap && { bg: cs(gap).backgroundColor, img: cs(gap).backgroundImage, size: cs(gap).backgroundSize, rep: cs(gap).backgroundRepeat, anim: cs(gap).animationName, dur: cs(gap).animationDuration, ease: cs(gap).animationTimingFunction, it: cs(gap).animationIterationCount, ov: cs(gap).overflow, l: (G.left - L.left) / L.width * 100, w: G.width / L.width * 100, cls: gap.className },
    mk: mk && { bg: cs(mk).backgroundColor, w: Math.round(R(mk).width), sh: cs(mk).boxShadow, x: Math.round((R(mk).left + R(mk).width / 2 - L.left) / L.width * 100) },
    kf: [...sr.querySelectorAll('style')].map((s) => s.textContent).join('').match(/@keyframes chgFlow\{[^}]*\}[^}]*\}/), lpct: cs(q('.lpct')).color, txt: [cs(q('.lt2')).color, cs(q('.lc .big')).color, cs(q('.ll')).color], card: cs(q('.lc')).backgroundColor,
  };
});

/* ---------------- A · lader */
{
  const p = await page();
  await set(p, CHG);
  const x = await bar(p);
  ok('A · ingen skravering: jevn flate rgb(102 209 158 / .18) mellom fylling og grense', x.gap && x.gap.bg === 'rgba(102, 209, 158, 0.18)' && !/repeating/.test(x.gap.img), x.gap);
  ok('A · ladebølge: grønn → .55 → 0, 40 % av feltet, no-repeat', x.gap && /^linear-gradient\(90deg, rgb\(102, 209, 158\), rgba\(102, 209, 158, 0\.55\), rgba\(102, 209, 158, 0\)\)$/.test(x.gap.img) && /^40% 100%$/.test(x.gap.size) && x.gap.rep === 'no-repeat', x.gap);
  ok('A · chgFlow 1,8 s cubic-bezier(.4,0,.2,1) uendelig, background-position −70 % → 170 %', x.gap && x.gap.anim === 'chgFlow' && x.gap.dur === '1.8s' && x.gap.ease === 'cubic-bezier(0.4, 0, 0.2, 1)' && x.gap.it === 'infinite' && x.kf && /-70%/.test(x.kf[0]) && /170%/.test(x.kf[0]), { gap: x.gap, kf: x.kf && x.kf[0] });
  ok('A · bølgen holder seg inne i feltet (overflow hidden; feltet = batteri 64 % → grense)', x.gap && x.gap.ov === 'hidden' && Math.abs(x.gap.l - 64) <= 1 && x.gap.w > 1 && x.mk && Math.abs(x.gap.l + x.gap.w - x.mk.x) <= 1.5, { gap: x.gap, mk: x.mk });
  ok('A · grense-markør uendret: hvit 4 px, 0 0 0 3px rgba(0,0,0,.25)', x.mk && x.mk.bg === 'rgb(250, 250, 250)' && x.mk.w === 4 && x.mk.sh === 'rgba(0, 0, 0, 0.25) 0px 0px 0px 3px', x.mk);
  ok('A · mørk modus uendret: spor #282828, prosent #282828 på grønt, kort #3a3a3a', /rgb\(40, 40, 40\)|0\.15[67]\d* 0\.15[67]/.test(x.lim.bg) && x.lpct === 'rgb(40, 40, 40)' && x.card === 'rgb(58, 58, 58)', x);
  /* ---------------- B · lader ikke */
  await set(p, IDLE);
  const y = await bar(p);
  ok('B · lader ikke: samme jevne flate, ingen bølge, ingen animasjon', y.gap && y.gap.bg === 'rgba(102, 209, 158, 0.18)' && y.gap.img === 'none' && y.gap.anim === 'none' && !/chg/.test(y.gap.cls), y.gap);
  await p.close();
}
/* ---------------- C · prefers-reduced-motion */
{
  const p = await page({ reduced: true });
  await set(p, CHG);
  const x = await bar(p);
  ok('C · prefers-reduced-motion: ingen chgFlow og ingen bølge mens den lader (flaten står)', x.gap && x.gap.anim === 'none' && x.gap.img === 'none' && x.gap.bg === 'rgba(102, 209, 158, 0.18)', x.gap);
  await p.close();
}
/* ---------------- D · lyst tema */
{
  const lum = (c) => { const m = /rgba?\(([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/.exec(c) || /color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)/.exec(c); if (!m) return null; let v = [m[1], m[2], m[3]].map(Number); if (/color\(srgb/.test(c)) v = v.map((q) => q * 255); const f = (q) => { q /= 255; return q <= 0.03928 ? q / 12.92 : ((q + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(v[0]) + 0.7152 * f(v[1]) + 0.0722 * f(v[2]); };
  const ratio = (a, c) => { const A = lum(a), B = lum(c); if (A == null || B == null) return 0; return (Math.max(A, B) + 0.05) / (Math.min(A, B) + 0.05); };
  const p = await page({ light: true });
  await set(p, CHG);
  const x = await bar(p);
  const sc = await p.evaluate(() => { const s = window.__c.shadowRoot.querySelector('msh-tesla-scene'); const tc = s && s.shadowRoot && s.shadowRoot.querySelector('.tc'); return tc ? { island: tc.hasAttribute('data-ki-island'), col: getComputedStyle(tc).color, n: getComputedStyle(tc.querySelector('.n')).color } : null; });
  ok('D · lys: ladekortet hvitt, tekst (status/effekt/ladegrense) ≥ 4,5:1', x.card === 'rgb(255, 255, 255)' && x.txt.every((c) => ratio(c, x.card) >= 4.5), x);
  ok('D · lys: stav-sporet lyst (ikke #282828), prosent-tekst mørk på grønt (≥ 4,5:1)', lum(x.lim.bg) > 0.5 && ratio(x.lpct, 'rgb(102, 209, 158)') >= 4.5, { lim: x.lim, lpct: x.lpct });
  ok('D · lys: bilscenen er en mørk øy (data-ki-island) med lys tekst', sc && sc.island && lum(sc.col) > 0.7 && lum(sc.n) > 0.35, sc);
  await p.close();
}

ok('ingen sidefeil', !errs.length, errs.slice(0, 5));
console.log(JSON.stringify(res, null, 1));
await b.close();
console.log(fail.length ? `\nFEIL (${fail.length}): ${fail.join(' | ')}` : '\nTesla 33: alt OK');
process.exit(fail.length ? 1 : 0);
