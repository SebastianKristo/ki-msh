// Fiks 18.4 / 18.7 / 18.8: Fold-oppsettet på Fold, iPad og PC (msh-hjem-card + msh-navbar-card sammen).
//  · < 600 px (og mus < 1000 px): telefon-oppsettet med bunn-navbar
//  · Fold (berøring ≥ 600 px, eller ≥ 1000 px): én kolonne i full bredde, fliser i to kolonner, vertikal navbar til venstre,
//    ingen bunn-navbar, padding-left = rail + 2 × avstand, ingen zoom
//  · mini-spilleren flukter med høyre fliskolonne (venstre- og høyrekant), også etter resize og bretting
//  · ark (MSH.overlay) og Bubble-popups sentreres på innholdsflaten til høyre for railen
// Kjør: node test/fold-check.mjs   (SHOT_DIR=… for skjermbilder)
import { createRequire } from 'node:module';
import { readdirSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
mkdirSync('test/.build', { recursive: true });
const bundle = resolve(`test/.build/fold-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const res = [];
const ok = (name, cond, info) => res.push(`${cond ? '✔' : '✘'} ${name}${info != null ? ' · ' + JSON.stringify(info) : ''}`);
const SHOT = process.env.SHOT_DIR;

async function setup(vp, touch, sb) {
  const p = await b.newPage({ viewport: vp, hasTouch: touch });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + resolve('test/harness.html'));
  for (const m of readdirSync('test/mock').sort()) await p.addScriptTag({ path: resolve('test/mock/' + m) });
  await p.addScriptTag({ path: bundle });
  await p.evaluate(async (sb) => {
    if (sb) document.documentElement.style.setProperty('--sb', sb + 'px');
    window.deepAll = (sel) => { const out = []; const walk = (root) => root.querySelectorAll('*').forEach((e) => { if (e.matches(sel)) out.push(e); if (e.shadowRoot) walk(e.shadowRoot); }); walk(document); return out; };
    window.deep = (sel) => window.deepAll(sel)[0] || null;
    window.rect = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { l: +r.left.toFixed(1), t: +r.top.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1), b: +r.bottom.toFixed(1), r: +r.right.toFixed(1) }; };
    const H = window.mockHass(), S = H.states;
    Object.keys(S).filter((k) => k.startsWith('media_player.')).forEach((k) => { S[k] = { ...S[k], state: 'off' }; });
    S['media_player.kjokken_radio'] = { ...S['media_player.kjokken_radio'], state: 'playing', last_changed: new Date().toISOString() };
    const d = document.getElementById('dash');
    const hj = document.createElement('msh-hjem-card'); hj.setConfig({ type: 'custom:msh-hjem-card', card_id: 'ki-home' }); hj.hass = H; d.appendChild(hj);
    const nb = document.createElement('msh-navbar-card'); nb.setConfig({ type: 'custom:msh-navbar-card', card_id: 'ki-navbar' }); nb.hass = H; d.appendChild(nb);
    await new Promise((q) => setTimeout(q, 1200));
  }, sb || 0);
  return { p, errs };
}
const measure = (p) => p.evaluate(() => {
  const g = deep('msh-hjem-card').shadowRoot.querySelector('.g'), F = deep('msh-hjem-faner-card');
  const cols = F && F.shadowRoot.querySelector('.cols'), col = cols ? [...cols.children].filter((c) => c.classList.contains('col')) : [];
  const nav = deep('nav.nb'), mini = deep('[data-mini]'), dash = document.getElementById('dash');
  const first = deep('msh-hjem-card').shadowRoot.querySelector('.s');
  return { g: g.className, padL: parseFloat(getComputedStyle(g).paddingLeft), zoom: getComputedStyle(g).zoom, gW: rect(g).w,
    dash: rect(dash), first: rect(first), nav: rect(nav), rail: nav.classList.contains('rail'), navTr: getComputedStyle(nav).transform,
    colL: rect(col[0]), colR: rect(col[1]), nCols: cols ? getComputedStyle(cols).gridTemplateColumns.split(' ').length : 0,
    mini: mini && !mini.classList.contains('off') ? rect(mini) : null, bub: dash.style.getPropertyValue('--bubble-content-inline-start') };
});
const close = (a, b, t = 1.5) => Math.abs(a - b) <= t;

for (const [name, w, h, touch, fold, sb] of [
  ['telefon412', 412, 915, true, false], ['b599', 599, 900, true, false], ['b700', 700, 900, true, true], ['fold884', 884, 1032, true, true],
  ['ipad1024', 1024, 1366, true, true], ['ipad1366', 1366, 1024, true, true], ['mus840', 840, 880, false, false], ['pc1440', 1440, 900, false, true],
  ['pc1920', 1920, 1080, false, true], ['pc1440sb', 1440, 900, false, true, 256]]) {
  const { p, errs } = await setup({ width: w, height: h }, touch, sb);
  const m = await measure(p);
  if (fold) {
    ok(`${name}: Fold-oppsett, én kolonne, ingen zoom`, /fold/.test(m.g) && (m.zoom === '1' || !m.zoom) && close(m.gW, m.dash.w, 2), { g: m.g, zoom: m.zoom, gW: m.gW });
    ok(`${name}: vertikal navbar til venstre (ytterst på dashbordflaten), ingen bunn-navbar, ingen zoom`, m.rail && close(m.nav.l, m.dash.l + 20) && close(m.nav.w, 80) && !/matrix\((?!1, 0, 0, 1)/.test(m.navTr), { nav: m.nav, tr: m.navTr });
    ok(`${name}: innholdet starter etter railen (rail + 2 × 20)`, close(m.first.l, m.dash.l + 120) && m.first.l >= m.nav.r + 19, { first: m.first.l, nav: m.nav.r });
    ok(`${name}: fliser i to kolonner à 50 %`, m.nCols === 2 && m.colL && m.colR && close(m.colL.w, m.colR.w), { L: m.colL, R: m.colR });
    ok(`${name}: mini-spilleren flukter med høyre fliskolonne`, m.mini && m.colR && close(m.mini.l, m.colR.l, 1) && close(m.mini.r, m.colR.r, 1) && m.mini.b <= h - 15, { mini: m.mini, col: m.colR });
    ok(`${name}: Bubble-popups sentreres på innholdsflaten`, m.bub === `${Math.round(m.dash.l + 120)}px`, m.bub);
  } else {
    ok(`${name}: telefon-oppsett med bunn-navbar`, !/fold/.test(m.g) && close(m.padL, 18) && !m.rail && m.bub === '', { g: m.g, padL: m.padL, rail: m.rail });
  }
  if (SHOT) await p.screenshot({ path: `${SHOT}/fold-${name}.png` });
  ok(`${name}: ingen sidefeil`, !errs.length, errs);
  // ark (MSH.overlay) på innholdsflaten
  if (name === 'fold884' || name === 'pc1440sb') {
    // (utenfor HA er MSH.dashRect hele vinduet – arket måles mot den)
    const o = await p.evaluate(async () => { const D = MSH.dashRect(), a = MSH.overlay({ html: '<p>x</p>' }); await new Promise((q) => setTimeout(q, 350)); const r = rect(a.host), s = rect(a.root.querySelector('.sh')); a.close(); return { D: { l: D.left, r: D.right }, r, s }; });
    // 26.16: arket dekker navbaren (hele dashbordflaten), men selve arket står midt på innholdsflaten
    ok(`${name}: arket dekker navbaren og står midt på innholdsflaten`, close(o.r.l, o.D.l) && close(o.r.r, o.D.r) && close(o.s.l + o.s.w / 2, (o.D.l + 120 + o.D.r) / 2), o);
  }
  // Bretting 884 → 412 → 884 uten reload, og resize på PC (scrollbar/sidebar)
  if (name === 'fold884') {
    await p.setViewportSize({ width: 412, height: 915 }); await p.waitForTimeout(700);
    const m2 = await measure(p);
    ok('bretting 884 → 412: telefon-oppsett, bunn-navbar', !/fold/.test(m2.g) && !m2.rail && close(m2.padL, 18) && m2.bub === '', { g: m2.g, rail: m2.rail });
    await p.setViewportSize({ width: 884, height: 1032 }); await p.waitForTimeout(700);
    const m3 = await measure(p);
    ok('bretting 412 → 884: Fold igjen, mini flukter', /fold/.test(m3.g) && m3.rail && m3.mini && close(m3.mini.l, m3.colR.l, 1) && close(m3.mini.r, m3.colR.r, 1), { mini: m3.mini, col: m3.colR });
  }
  if (name === 'pc1440') {
    await p.setViewportSize({ width: 1200, height: 800 }); await p.waitForTimeout(700);
    const m2 = await measure(p);
    ok('resize 1440 → 1200: mini flukter fortsatt', m2.mini && close(m2.mini.l, m2.colR.l, 1) && close(m2.mini.r, m2.colR.r, 1), { mini: m2.mini, col: m2.colR });
    await p.setViewportSize({ width: 1440, height: 900 }); await p.waitForTimeout(500);
    await p.evaluate(() => document.documentElement.style.setProperty('--sb', '256px')); await p.waitForTimeout(700);
    const m3 = await measure(p);
    ok('HA-sidebar åpnes: mini flukter fortsatt, rail til høyre for sidebaren', m3.mini && close(m3.mini.l, m3.colR.l, 1) && close(m3.mini.r, m3.colR.r, 1) && m3.nav.l >= 256, { mini: m3.mini, col: m3.colR, nav: m3.nav.l });
  }
  await p.close();
}
// Layout «Stor» = Fold også på telefonbredde med mus; «Mobil» = telefon på PC
{
  const { p } = await setup({ width: 1440, height: 900 }, false);
  const r = await p.evaluate(async () => {
    const hj = deep('msh-hjem-card'); hj.setConfig({ ...hj._rawConfig, layout_mode: 'mobil' }); await new Promise((q) => setTimeout(q, 500));
    const a = hj.shadowRoot.querySelector('.g').className;
    hj.setConfig({ ...hj._rawConfig, layout_mode: 'stor' }); await new Promise((q) => setTimeout(q, 500));
    return [a, hj.shadowRoot.querySelector('.g').className];
  });
  ok('layout Mobil → telefon, Stor → Fold', !/fold/.test(r[0]) && /fold/.test(r[1]), r);
  await p.close();
}
await b.close();
console.log(res.join('\n'));
process.exit(res.some((x) => x.startsWith('✘')) ? 1 : 0);
