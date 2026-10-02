// Fiks 31.5 · Lys-popupen: fanelinje + tannhjul som Innstillinger (fasit Lys v4.dc.html, rettet fanelinje), samme
// komponent som tab_style gear på Hjem (MSH.tabBar, 05-tab-bar.js). Ekte Bubble Card-popup (test/harness-bubble.html), 390 px.
//   · flate #3a3a3a + inset 0 0 0 1px rgba(255,255,255,.05), r28, pad 4, gap 2
//   · faner 48 px r24, 14/500 #c7c7c7, bredde etter teksten (flex 1 1 auto, padding 0 8px), ingen etikett kuttet ved 390 px
//   · aktiv: rosa gradient + tekst #2f2f2f; tannhjul 56 × 56 #3a3a3a (samme inset) med settings 24 px → «Tilpass lys»
//   · kortnavn som på Hjem («1. etasje» → «1. etg», Hjem-fanens eget navn vinner)
//   · hold + dra omorganiserer fortsatt (MSH.tabRow), trykk bytter fane med haptic selection
// Kjør: node test/lys31-check.mjs   (SHOTS=dir → skjermbilde)
import { createRequire } from 'node:module';
import { readdirSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const R = resolve('.') + '/';
mkdirSync('test/.build', { recursive: true });
mkdirSync('test/.vendor', { recursive: true });
const BC = resolve('test/.vendor/bubble-card.js');
if (!existsSync(BC)) execFileSync('curl', ['-sSL', '-o', BC, 'https://raw.githubusercontent.com/Clooos/Bubble-Card/main/dist/bubble-card.js']);
const bundle = resolve(`test/.build/l31-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const mocks = readdirSync(R + 'test/mock').filter((f) => f.endsWith('.js')).sort().map((f) => R + 'test/mock/' + f);
const SHOTS = process.env.SHOTS || '';
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const browser = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const res = [];
let fails = 0;
const ok = (name, cond, info) => { if (!cond) fails++; res.push(`${cond ? '✔' : '✘'} ${name}${info != null ? ' · ' + JSON.stringify(info) : ''}`); };

const page = await browser.newPage({ viewport: { width: 390, height: 800 }, hasTouch: true });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto('file://' + R + 'test/harness-bubble.html');
for (const m of mocks) await page.addScriptTag({ path: m });
await page.addScriptTag({ path: bundle });
await page.addScriptTag({ path: BC, type: 'module' });
await page.waitForFunction(() => customElements.get('bubble-card'), null, { timeout: 15000 });
const wait = (ms) => page.waitForTimeout(ms);
await page.evaluate(async () => {
  window.deepAll = (sel, root) => { const out = []; const walk = (r) => r.querySelectorAll('*').forEach((e) => { if (e.matches(sel)) out.push(e); if (e.shadowRoot) walk(e.shadowRoot); }); walk(root || document); return out; };
  const H = (window.H = window.mockHass());
  // HA-etasjene med lange navn: Lys skal vise kortnavnet som på Hjem
  H.floors.forste = { ...H.floors.forste, name: '1. etasje' };
  H.floors.andre = { ...H.floors.andre, name: '2. etasje' };
  window.HAP = []; window.addEventListener('haptic', (e) => window.HAP.push(e.detail));
  const bc = document.createElement('bubble-card');
  bc.setConfig({ type: 'custom:bubble-card', card_type: 'pop-up', hash: '#lys', name: 'Lys', icon: 'mdi:lightbulb', margin_top_mobile: '50px', cards: [{ type: 'custom:msh-lys-card', card_id: 'l31' }] });
  bc.hass = H; document.getElementById('dash').appendChild(bc);
  await new Promise((r) => setTimeout(r, 400));
  location.hash = '#lys';
  await new Promise((r) => setTimeout(r, 1400));
  window.LC = deepAll('msh-lys-card')[0];
  window.L = () => deepAll('msh-lys-card')[0] || window.LC;
  window.SR = () => L().shadowRoot;
  window.rect = (el) => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 }; };
});

let x = await page.evaluate(() => {
  const bar = SR().querySelector('.mtb.mtb-gear'), row = bar && bar.querySelector('.mtb-tabs'), bs = row ? [...row.querySelectorAll('.mtb-t')] : [], g = bar && bar.querySelector('.mtb-g');
  if (!bar) return null;
  const on = bs.find((b) => b.classList.contains('on')), off = bs.find((b) => !b.classList.contains('on')), C = (el) => getComputedStyle(el);
  return {
    labels: bs.map((b) => b.textContent.trim()),
    row: { bg: C(row).backgroundColor, sh: C(row).boxShadow, r: C(row).borderRadius, pad: C(row).paddingTop, gap: C(row).columnGap, ta: C(row).touchAction, sw: row.scrollWidth, cw: row.clientWidth },
    tab: { h: bs.map((b) => Math.round(rect(b).h)), r: C(off).borderRadius, fs: C(off).fontSize, fw: C(off).fontWeight, c: C(off).color, pl: C(off).paddingLeft, pr: C(off).paddingRight, flex: [C(off).flexGrow, C(off).flexShrink, C(off).flexBasis].join(' '), w: bs.map((b) => Math.round(rect(b).w)) },
    on: { bg: C(on).backgroundImage, c: C(on).color },
    cut: bs.filter((b) => { const l = b.querySelector('.mtb-l'); return b.scrollWidth > b.clientWidth + 0.5 || (l && l.scrollWidth > l.clientWidth + 0.5); }).map((b) => b.textContent.trim()),
    gear: { w: Math.round(rect(g).w), h: Math.round(rect(g).h), bg: C(g).backgroundColor, sh: C(g).boxShadow, r: C(g).borderRadius, ic: (g.querySelector('ha-icon') && g.querySelector('ha-icon').getAttribute('icon')) || '', is: g.querySelector('ha-icon') ? getComputedStyle(g.querySelector('ha-icon')).getPropertyValue('--mdc-icon-size').trim() : '' },
    vw: innerWidth, barW: Math.round(rect(bar).w),
  };
});
ok('Lys: fanelinjen er felles MSH.tabBar (variant gear)', !!x, x);
if (x) {
  ok('Lys: faner Utelys · 1. etg · 2. etg · Lys på (kortnavn som på Hjem)', JSON.stringify(x.labels) === JSON.stringify(['Utelys', '1. etg', '2. etg', 'Lys på']), x.labels);
  ok('Lys: flate #3a3a3a + inset 1px rgba(255,255,255,.05), r28, pad 4, gap 2, touch-action pan-y', x.row.bg === 'rgb(58, 58, 58)' && x.row.sh === 'rgba(255, 255, 255, 0.05) 0px 0px 0px 1px inset' && x.row.r === '28px' && x.row.pad === '4px' && x.row.gap === '2px' && x.row.ta === 'pan-y', x.row);
  ok('Lys: faner 48 px r24, 14/500 #c7c7c7, padding 0 8px, flex 1 1 auto', x.tab.h.every((h) => h === 48) && x.tab.r === '24px' && x.tab.fs === '14px' && x.tab.fw === '500' && x.tab.c === 'rgb(199, 199, 199)' && x.tab.pl === '8px' && x.tab.pr === '8px' && x.tab.flex === '1 1 auto', x.tab);
  ok('Lys: fanebredde etter teksten (ulike bredder)', new Set(x.tab.w).size > 1, x.tab.w);
  ok('Lys: ingen etikett kuttet ved 390 px, raden scroller ikke', x.vw === 390 && x.cut.length === 0 && x.row.sw <= x.row.cw + 1, { cut: x.cut, sw: x.row.sw, cw: x.row.cw, barW: x.barW });
  ok('Lys: aktiv fane rosa gradient + tekst #2f2f2f', /linear-gradient/.test(x.on.bg) && x.on.c === 'rgb(47, 47, 47)', x.on);
  ok('Lys: tannhjul 56 × 56 #3a3a3a, samme inset, settings 24 px', x.gear.w === 56 && x.gear.h === 56 && x.gear.r === '28px' && x.gear.bg === 'rgb(58, 58, 58)' && x.gear.sh === x.row.sh && /cog|settings/.test(x.gear.ic) && x.gear.is === '24px', x.gear);
}
if (SHOTS) await page.screenshot({ path: `${SHOTS}/lys31-390.png`, clip: { x: 0, y: 0, width: 390, height: 360 } });

// trykk bytter fane + haptic selection
{
  const t = await page.evaluate(() => { const b = [...SR().querySelectorAll('.mtb-t')].find((x) => !x.classList.contains('on')); window.HAP = []; return { v: b.dataset.v, ...rect(b) }; });
  await page.mouse.click(t.cx, t.cy); await wait(500);
  const r = await page.evaluate(() => ({ cur: L()._curTab(), on: (SR().querySelector('.mtb-t.on') || {}).dataset.v, hap: window.HAP.slice() }));
  ok('Lys: trykk bytter fane + haptic selection', r.cur === t.v && r.on === t.v && r.hap.includes('selection'), { want: t.v, ...r });
}
// hold + dra (mus) flytter fanen, lagres i tab_order
{
  const [a, z, o0] = await page.evaluate(() => { const L2 = [...SR().querySelectorAll('.mtb-t')]; return [rect(L2[0]), rect(L2[2]), L2.map((b) => b.dataset.v)]; });
  await page.mouse.move(a.cx, a.cy); await page.mouse.down(); await wait(560);
  for (let k = 1; k <= 14; k++) { await page.mouse.move(a.cx + ((z.cx + 6 - a.cx) * k) / 14, a.cy); await wait(16); }
  await page.mouse.up(); await wait(1200);
  const r = await page.evaluate(() => ({ ids: [...SR().querySelectorAll('.mtb-t')].map((b) => b.dataset.v), saved: L()._rawConfig.tab_order || null, open: location.hash === '#lys' }));
  ok('Lys: hold + dra flytter fanen og lagrer tab_order, popupen er åpen', r.saved && r.ids.indexOf(o0[0]) === 2 && JSON.stringify(r.saved.filter((k) => r.ids.includes(k))) === JSON.stringify(r.ids) && r.open, { før: o0, ...r });
}
// tannhjulet åpner «Tilpass lys»
{
  const g = await page.evaluate(() => rect(SR().querySelector('.mtb-g')));
  await page.mouse.click(g.cx, g.cy); await wait(900);
  const t = await page.evaluate(() => { const ov = deepAll('*').filter((e) => e.shadowRoot).map((e) => e.shadowRoot.textContent || '').join(' ') + document.body.innerText; return /Tilpass lys/.test(ov); });
  ok('Lys: tannhjulet åpner «Tilpass lys»', t);
  await page.evaluate(() => { const L0 = L(); if (L0 && L0._sheet && L0._sheet.close) L0._sheet.close(); document.querySelectorAll('ki-overlay-root').forEach((n) => n.remove()); }); await wait(300);
}
// Hjem-fanens eget navn vinner (kortnavn «som på Hjem»)
{
  const r = await page.evaluate(async () => {
    const F = document.createElement('msh-hjem-faner-card');
    F.setConfig({ type: 'custom:msh-hjem-faner-card', card_id: 'ki-home-faner', tab_labels: { forste: 'Nede' } }); F.hass = H;
    document.getElementById('dash').appendChild(F);
    await new Promise((q) => setTimeout(q, 500));
    L().hass = { ...H }; L().update();
    await new Promise((q) => setTimeout(q, 500));
    const out = [...SR().querySelectorAll('.mtb-t')].map((b) => b.textContent.trim());
    F.remove();
    return out;
  });
  ok('Lys: etasjen bruker Hjem-fanens navn (tab_labels på Hjem)', r.includes('Nede') && !r.includes('1. etg'), r);
}
ok('ingen sidefeil', errs.length === 0, errs);
console.log(res.join('\n'));
console.log(fails ? `\n${fails} feil` : '\nAlt OK');
await browser.close();
process.exit(fails ? 1 : 0);
