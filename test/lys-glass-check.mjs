// Fiks 17.18 + 17.19: Liquid Glass-linsen = den rosa pillen (Lys-popupen + Klima-popupen) mot EKTE Bubble Card, mobil 390 px.
//  · trykk: linsen morfer fra → til på 300 ms; aldri to rosa piller samtidig (linse + ekte pille på ulike steder)
//  · dra: linsen følger fingeren 1:1 (≤ 2 px), aldri to piller; slipp → valgt fane, linsen borte
//  · MSH.setGlassAnim(false) (ki-store ui.glass_anim): ingen linse ved trykk eller dra, pillen bytter likevel; localStorage-speil
//  · bryteren «Liquid Glass-animasjon» i «Tilpass Hjem» → Faner og i GUI-editoren (msh-hjem-card → Faner)
// Kjør: node test/lys-glass-check.mjs
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
const bundle = resolve(`test/.build/lysglass-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle], { cwd: R, stdio: 'inherit' });
const mocks = readdirSync(R + 'test/mock').filter((f) => f.endsWith('.js')).sort().map((f) => R + 'test/mock/' + f);
const browser = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => pw.chromium.launch());
const res = [];
const ok = (name, cond, info) => { res.push(`${cond ? '✔' : '✘'} ${name}${info != null ? ' · ' + JSON.stringify(info) : ''}`); };
const page = await browser.newPage({ viewport: { width: 390, height: 700 }, hasTouch: true, isMobile: true });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto('file://' + R + 'test/harness-bubble.html');
for (const m of mocks) await page.addScriptTag({ path: m });
await page.addScriptTag({ path: bundle });
await page.addScriptTag({ path: BC, type: 'module' });
await page.waitForFunction(() => customElements.get('bubble-card'), null, { timeout: 10000 });
const cdp = await page.context().newCDPSession(page);
const wait = (ms) => page.waitForTimeout(ms);
const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });

await page.evaluate(async () => {
  window.deepAll = (sel) => { const out = []; const walk = (root) => root.querySelectorAll('*').forEach((e) => { if (e.matches(sel)) out.push(e); if (e.shadowRoot) walk(e.shadowRoot); }); walk(document); return out; };
  window.deep = (sel) => window.deepAll(sel)[0] || null;
  window.H = window.mockHass();
  const mk = (hash, cards) => { const bc = document.createElement('bubble-card'); bc.setConfig({ type: 'custom:bubble-card', card_type: 'pop-up', hash, name: hash.slice(1), icon: 'mdi:lightbulb', margin_top_mobile: '50px', cards }); bc.hass = H; document.getElementById('dash').appendChild(bc); };
  mk('#lys', [{ type: 'custom:msh-lys-card', card_id: 'lg_lys' }]);
  mk('#klima', [{ type: 'custom:msh-klima-card', card_id: 'lg_klima' }]);
  await new Promise((r) => setTimeout(r, 400));
  window.rectOf = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: +r.left.toFixed(1), y: +r.top.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) }; };
  const alpha = (c) => { const m = /rgba?\(([^)]+)\)/.exec(c); if (!m) return 0; const p = m[1].split(',').map(Number); return p.length > 3 ? p[3] : 1; };
  // Rosa flater i raden: ekte piller (bakgrunn synlig) + linser (opacity > .5). Linse oppå en synlig pille = én pille.
  window.pinks = (row) => {
    const tabs = [...row.querySelectorAll('button')].filter((b) => { const cs = getComputedStyle(b); return alpha(cs.backgroundColor) > 0.5 || (cs.backgroundImage !== 'none'); }).map(rectOf);
    const lens = [...row.querySelectorAll('.gd-lens')].filter((l) => +getComputedStyle(l).opacity > 0.5).map(rectOf);
    const same = (a, b) => Math.abs(a.x - b.x) <= 2 && Math.abs(a.w - b.w) <= 2;
    const n = tabs.length + lens.filter((l) => !tabs.some((t) => same(l, t))).length;
    return { n, tabs, lens, anyLens: row.querySelectorAll('.gd-lens').length };
  };
  window.sampleRow = (getRow, ms) => new Promise((res) => {
    const out = [], t0 = performance.now();
    const f = () => { const t = performance.now() - t0, row = getRow(); out.push({ t: Math.round(t), ...pinks(row) }); if (t < ms) requestAnimationFrame(f); else res(out); };
    requestAnimationFrame(f);
  });
});

async function suite(name, hash, cardSel) {
  await page.evaluate((h) => { location.hash = h; }, hash);
  await wait(1200);
  await page.evaluate((s) => { window.C = () => deep(s); window.ROW = () => C().shadowRoot.querySelector('.tabs'); window.TABS = () => [...ROW().querySelectorAll('button')]; window.ONI = () => TABS().findIndex((b) => b.getAttribute('aria-selected') === 'true'); }, cardSel);
  const n = await page.evaluate(() => TABS().length);
  ok(`${name}: popup åpen med faner`, n >= 2, { n });
  if (n < 2) return;
  // Får fanene plass? (glass-dra bare når raden ikke scroller)
  const fits = await page.evaluate(() => ROW().scrollWidth <= ROW().clientWidth + 1);
  const ctr = (i) => page.evaluate((i) => { const r = TABS()[i].getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, i);
  const tapI = async (i) => { const p = await ctr(i); await touch('touchStart', [{ x: p.x, y: p.y }]); await wait(50); await touch('touchEnd', []); };
  const tgt = (await page.evaluate(() => ONI())) === 0 ? 1 : 0;
  // --- trykk
  let sp = page.evaluate(() => sampleRow(ROW, 700));
  await tapI(tgt);
  let S = await sp;
  await wait(200);
  let lensFrames = S.filter((f) => f.lens.length);
  const lensDur = lensFrames.length ? lensFrames[lensFrames.length - 1].t - lensFrames[0].t : 0;
  ok(`${name} · trykk: fane ${tgt} valgt`, (await page.evaluate(() => ONI())) === tgt);
  ok(`${name} · trykk: linsen morfer (synlig ~300 ms, ikke 560)`, lensFrames.length > 3 && lensDur >= 200 && lensDur <= 520, { lensDur, frames: lensFrames.length, t: lensFrames.map((f) => f.t) });
  ok(`${name} · trykk: aldri to rosa piller samtidig`, S.every((f) => f.n <= 1), S.filter((f) => f.n > 1).slice(0, 3));
  ok(`${name} · trykk: pillen alltid synlig (linse eller ekte)`, S.every((f) => f.n === 1), S.filter((f) => f.n !== 1).slice(0, 3));
  ok(`${name} · trykk: linsen ryddet etterpå`, (await page.evaluate(() => pinks(ROW()).anyLens)) === 0);
  // --- dra (bare når fanene får plass)
  if (fits) {
    const back = tgt === 0 ? 1 : 0, a = await ctr(tgt), b = await ctr(back);
    await touch('touchStart', [{ x: a.x, y: a.y }]);
    const follow = [];
    for (let k = 1; k <= 12; k++) {
      const x = a.x + (b.x - a.x) * k / 12;
      await touch('touchMove', [{ x, y: a.y }]);
      await wait(20);
      const f = await page.evaluate(() => pinks(ROW()));
      const L = f.lens[0];
      follow.push({ x: +x.toFixed(1), lc: L ? +(L.x + L.w / 2).toFixed(1) : null, n: f.n });
    }
    const rr = await page.evaluate(() => rectOf(ROW()));
    // 1:1 med fingeren (når linsen ikke er klemt mot kanten)
    const free = follow.filter((f) => f.lc != null && f.x > rr.x + 60 && f.x < rr.x + rr.w - 60);
    ok(`${name} · dra: linsen følger fingeren 1:1 (≤ 2 px)`, free.length > 2 && free.every((f) => Math.abs(f.lc - f.x) <= 2), follow);
    ok(`${name} · dra: aldri to rosa piller`, follow.every((f) => f.n <= 1), follow);
    sp = page.evaluate(() => sampleRow(ROW, 500));
    await touch('touchEnd', []);
    S = await sp;
    await wait(200);
    ok(`${name} · dra: slipp velger fane ${back}`, (await page.evaluate(() => ONI())) === back);
    ok(`${name} · slipp: aldri to piller, pillen alltid synlig`, S.every((f) => f.n === 1), S.filter((f) => f.n !== 1).slice(0, 3));
    ok(`${name} · slipp: linsen ryddet`, (await page.evaluate(() => pinks(ROW()).anyLens)) === 0);
  } else ok(`${name} · dra: fanene scroller (ingen glass-dra) – hoppet over`, true);
  // --- animasjon av (17.18)
  await page.evaluate(() => MSH.setGlassAnim(false));
  const ls = await page.evaluate(() => localStorage.getItem('ki:glass_anim'));
  ok(`${name} · setGlassAnim(false): ki-store ui.glass_anim=false + localStorage-speil`, (await page.evaluate(() => MSH.store.get('ui.glass_anim'))) === false && ls === '0' && (await page.evaluate(() => MSH.animOff())) === true);
  const cur = await page.evaluate(() => ONI()), t2 = cur === 0 ? 1 : 0;
  sp = page.evaluate(() => sampleRow(ROW, 500));
  await tapI(t2);
  S = await sp;
  ok(`${name} · av: trykk bytter fane uten linse`, (await page.evaluate(() => ONI())) === t2 && S.every((f) => f.anyLens === 0));
  if (fits) {
    const a = await ctr(t2), b = await ctr(cur);
    sp = page.evaluate(() => sampleRow(ROW, 700));
    await touch('touchStart', [{ x: a.x, y: a.y }]);
    for (let k = 1; k <= 12; k++) { await touch('touchMove', [{ x: a.x + (b.x - a.x) * k / 12, y: a.y }]); await wait(16); }
    await touch('touchEnd', []);
    S = await sp;
    await wait(150);
    ok(`${name} · av: dra gir ingen linse, slipp bytter direkte`, (await page.evaluate(() => ONI())) === cur && S.every((f) => f.anyLens === 0), { on: await page.evaluate(() => ONI()) });
  }
  await page.evaluate(() => MSH.setGlassAnim(true));
  ok(`${name} · på igjen: animOff() = false`, (await page.evaluate(() => MSH.animOff())) === false);
  ok(`${name} · popupen er fortsatt åpen`, await page.evaluate((h) => location.hash === h, hash));
  await page.evaluate(() => { history.back(); });
  await wait(600);
}

await suite('Lys', '#lys', 'msh-lys-card');
await suite('Klima', '#klima', 'msh-klima-card');

// --- bryteren i «Tilpass Hjem» → Faner (ki-overlay-root) og i GUI-editoren (msh-hjem-card → Faner)
await page.evaluate(() => { location.hash = ''; });
await wait(300);
const th = await page.evaluate(async () => {
  MSH.openHomeEditor({ focus: 'faner' });
  await new Promise((r) => setTimeout(r, 800));
  const b = deep('[data-a="glassanim"]');
  if (!b) return { found: false };
  const before = b.getAttribute('aria-checked');
  b.click();
  await new Promise((r) => setTimeout(r, 200));
  const after = MSH.glassAnimOn();
  const b2 = deep('[data-a="glassanim"]');
  const tr = b2 && b2.getRootNode().querySelector('.tabr'), first = !!b2 && (!tr || !!(b2.compareDocumentPosition(tr) & Node.DOCUMENT_POSITION_FOLLOWING));
  b2.click();
  await new Promise((r) => setTimeout(r, 200));
  return { found: true, before, after, back: MSH.glassAnimOn(), first };
});
ok('Tilpass Hjem → Faner: bryteren «Liquid Glass-animasjon» finnes øverst og slår av/på', th.found && th.before === 'true' && th.after === false && th.back === true && th.first, th);
const gui = await page.evaluate(async () => {
  const ed = await customElements.get('msh-hjem-card').getConfigElement();
  ed.hass = H; ed.setConfig({ type: 'custom:msh-hjem-card' });
  document.body.appendChild(ed);
  await new Promise((r) => setTimeout(r, 300));
  const sw = [...ed.shadowRoot.querySelectorAll('[data-a="boolfn"]')][0];
  if (!sw) return { found: false };
  const a = sw.getAttribute('aria-checked');
  sw.click();
  await new Promise((r) => setTimeout(r, 100));
  const off = MSH.glassAnimOn(), sw2 = ed.shadowRoot.querySelector('[data-a="boolfn"]');
  const a2 = sw2.getAttribute('aria-checked');
  sw2.click();
  return { found: true, a, off, a2, on: MSH.glassAnimOn() };
});
ok('GUI-editor msh-hjem-card → Faner: samme bryter (ki-store)', gui.found && gui.a === 'true' && gui.off === false && gui.a2 === 'false' && gui.on === true, gui);
ok('ingen sidefeil', errs.length === 0, errs);
await browser.close();
try { unlinkSync(bundle); } catch (e) { /* */ }
console.log(res.join('\n'));
const bad = res.filter((r) => r.startsWith('✘')).length;
console.log(`\n${res.length - bad}/${res.length} OK`);
process.exit(bad ? 1 : 0);
