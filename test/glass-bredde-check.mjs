// Fiks 24.2 · Liquid Glass-boblen lander på den NYE (bredere) fanen: aktiv fane blir ikon + navn, boblen skal ende med
// samme bredde/posisjon som den ekte aktive fanen (±2 px), ingen flex/padding/width-overgang på fanene, og ingen linse
// eller skjult pille igjen etterpå. Kalender (#kalender, fane-pillen) og Tilpass energi (msh-editor type:'tabs').
// Trykk, raske dobbelttrykk (80 ms) og dra.   node test/glass-bredde-check.mjs
import { createRequire } from 'node:module';
import { readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const bundle = resolve(`test/.build/glassbredde-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const BC = resolve('test/.vendor/bubble-card.js');
if (!existsSync(BC)) execFileSync('curl', ['-sSL', '-o', BC, 'https://raw.githubusercontent.com/Clooos/Bubble-Card/main/dist/bubble-card.js']);
const yml = (py) => JSON.parse(execFileSync('python3', ['-c', `import yaml,json;d=yaml.safe_load(open('examples/dashboard.yaml'));cs=[c for s in d['views'][0]['sections'] for c in s['cards']];print(json.dumps(${py}))`]).toString());
const popup = yml("[c for c in cs if c.get('hash')=='#energi'][0]");
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const res = {}, fail = [];
const ok = (name, cond, info) => { res[name] = cond ? 'OK' : ['FEIL', info]; if (!cond) fail.push(name); };
const mocks = readdirSync('test/mock').filter((f) => f.endsWith('.js')).sort().map((m) => resolve('test/mock/' + m));
const errs = [];

const HELP = () => {
  window.__deep = () => { const out = []; const walk = (r) => r.querySelectorAll('*').forEach((e) => { out.push(e); if (e.shadowRoot) walk(e.shadowRoot); }); walk(document); return out; };
  window.__w = (ms) => new Promise((q) => setTimeout(q, ms));
  const rect = (el) => { const r = el.getBoundingClientRect(); return { x: +r.left.toFixed(1), w: +r.width.toFixed(1) }; };
  // Én måling per frame: synlig linse (opacity) + ekte aktiv fane
  window.__sample = (ms) => new Promise((res) => {
    const out = [], t0 = performance.now();
    const f = () => {
      const t = performance.now() - t0, row = window.ROW(), l = row.querySelector('.gd-lens'), a = row.querySelector('[aria-selected="true"]');
      out.push({ t: Math.round(t), lens: l ? { ...rect(l), op: +getComputedStyle(l).opacity } : null, act: a ? rect(a) : null });
      if (t < ms) requestAnimationFrame(f); else res(out);
    };
    requestAnimationFrame(f);
  });
  window.__tr = () => [...window.ROW().querySelectorAll('button')].map((x) => getComputedStyle(x).transitionProperty).join('|');
  window.__after = () => { const row = window.ROW(); return { lens: row.querySelectorAll('.gd-lens').length, hid: row.querySelectorAll('[data-gd-hide]').length }; };
};

// Siste frame der linsen er helt synlig (rett før uttoningen) mot den ekte aktive fanen til slutt
const judge = (S, want) => {
  const vis = S.filter((f) => f.lens && f.lens.op >= 0.99);
  const last = vis[vis.length - 1], end = S[S.length - 1].act;
  const d = last && end ? { dx: +(last.lens.x - end.x).toFixed(1), dw: +(last.lens.w - end.w).toFixed(1) } : null;
  // «ingen rosa kant over teksten»: mens linsen er synlig etter animasjonen (t > 340 ms) har den fanens mål
  const i0 = S.indexOf(last), fade = S.slice(Math.max(0, i0 - 1)).filter((f) => f.lens && f.lens.op > 0.02 && f.act);
  const late = fade.every((f) => Math.abs(f.lens.x - f.act.x) <= 2 && Math.abs(f.lens.w - f.act.w) <= 2);
  return { ok: !!d && Math.abs(d.dx) <= 2 && Math.abs(d.dw) <= 2 && late && (want == null || S[S.length - 1].sel === want), d, frames: vis.length, lensEnd: last && last.lens, act: end };
};

async function run(name, p, idx) {
  const cdp = await p.context().newCDPSession(p);
  const ctr = (i) => p.evaluate((i) => { const r = window.ROW().querySelectorAll('button')[i].getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, i);
  const tap = async (i) => { const c = await ctr(i); await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [c] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); };
  const sel = () => p.evaluate(() => [...window.ROW().querySelectorAll('button')].findIndex((x) => x.getAttribute('aria-selected') === 'true'));
  const tr = await p.evaluate(() => window.__tr());
  ok(`${name}: fanene har ingen flex/padding/width-overgang`, !/flex|padding|width|\ball\b/.test(tr), tr);
  // 1) trykk: 0 → idx[0]
  let sp = p.evaluate(() => window.__sample(650));
  await tap(idx[0]);
  let S = await sp; let J = judge(S);
  ok(`${name} · trykk: boblen ender på aktiv fanes bredde/posisjon (±2 px)`, J.ok && (await sel()) === idx[0], J);
  await p.waitForTimeout(250);
  ok(`${name} · trykk: ingen linse / skjult pille igjen`, JSON.stringify(await p.evaluate(() => window.__after())) === '{"lens":0,"hid":0}');
  // 2) raskt dobbelttrykk: idx[1] og 80 ms senere idx[2]
  sp = p.evaluate(() => window.__sample(750));
  await tap(idx[1]); await p.waitForTimeout(80); await tap(idx[2]);
  S = await sp; J = judge(S);
  ok(`${name} · dobbelttrykk: boblen ender på den siste fanen (±2 px)`, J.ok && (await sel()) === idx[2], J);
  await p.waitForTimeout(250);
  ok(`${name} · dobbelttrykk: ingen linse / skjult pille igjen`, JSON.stringify(await p.evaluate(() => window.__after())) === '{"lens":0,"hid":0}');
  // 3) enda raskere: to trykk i samme frame-vindu (20 ms)
  sp = p.evaluate(() => window.__sample(750));
  await tap(idx[0]); await p.waitForTimeout(20); await tap(idx[1]);
  S = await sp; J = judge(S);
  ok(`${name} · dobbelttrykk 20 ms: boblen ender på den siste fanen (±2 px)`, J.ok && (await sel()) === idx[1], J);
  await p.waitForTimeout(250);
  // 4) dra fra aktiv fane til idx[3]
  const a = await ctr(await sel()), z = await ctr(idx[3]);
  sp = p.evaluate(() => window.__sample(1400));
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [a] });
  for (let k = 1; k <= 10; k++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: a.x + ((z.x - a.x) * k) / 10, y: a.y }] }); await p.waitForTimeout(16); }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  S = await sp;
  const vis = S.filter((f) => f.lens && f.lens.op >= 0.99), last = vis[vis.length - 1], end = S[S.length - 1].act;
  const D = last && end ? { dx: +(last.lens.x - end.x).toFixed(1), dw: +(last.lens.w - end.w).toFixed(1), frames: vis.length, tail: S.slice(-6) } : null;
  ok(`${name} · dra: fanen velges og boblen ender på dens mål (±2 px)`, (await sel()) === idx[3] && D && Math.abs(D.dx) <= 2 && Math.abs(D.dw) <= 2, D);
  await p.waitForTimeout(300);
  ok(`${name} · dra: ingen linse / skjult pille igjen`, JSON.stringify(await p.evaluate(() => window.__after())) === '{"lens":0,"hid":0}');
  // 5) glass_anim av → ingen linse, fanen byttes likevel
  await p.evaluate(() => window.MSH.setGlassAnim(false));
  sp = p.evaluate(() => window.__sample(400));
  await tap(idx[0]);
  S = await sp;
  ok(`${name} · glass_anim av: ingen linse, fanen byttes`, !S.some((f) => f.lens) && (await sel()) === idx[0]);
  await p.evaluate(() => window.MSH.setGlassAnim(true));
}

/* ---------------------------------------------------------------- Kalender */
{
  const p = await b.newPage({ viewport: { width: 400, height: 900 }, hasTouch: true, isMobile: true });
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + resolve('test/harness.html'));
  for (const m of mocks) await p.addScriptTag({ path: m });
  await p.addScriptTag({ path: bundle });
  await p.evaluate(HELP);
  await p.evaluate(async () => {
    window.__h = window.mockHass();
    const bc = document.createElement('bubble-card');
    bc.setConfig({ type: 'custom:bubble-card', card_type: 'pop-up', hash: '#kalender' });
    bc.innerHTML = '<div class="pop"><div class="hdr">Kalender</div><div class="inner"></div></div>';
    document.getElementById('dash').appendChild(bc);
    location.hash = '#kalender';
    const c = document.createElement('msh-kalender-card');
    c.setConfig({ type: 'custom:msh-kalender-card', card_id: 'gb-kalender' });
    c.hass = window.__h;
    bc.querySelector('.inner').appendChild(c);
    window.ROW = () => c.shadowRoot.querySelector('.tabs');
    await window.__w(800);
  });
  const n = await p.evaluate(() => (window.ROW() ? window.ROW().querySelectorAll('button').length : 0));
  ok('Kalender: fane-pille med 4+ faner', n >= 4, n);
  if (n >= 4) await run('Kalender', p, [2, 1, 3, n - 1]);
  await p.close();
}

/* ---------------------------------------------------------------- Tilpass energi */
{
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + resolve('test/harness-bubble.html'));
  for (const m of mocks) await p.addScriptTag({ path: m });
  await p.addScriptTag({ path: bundle });
  await p.addScriptTag({ path: BC, type: 'module' });
  await p.waitForFunction(() => customElements.get('bubble-card'), null, { timeout: 15000 });
  await p.evaluate(HELP);
  const ready = await p.evaluate(async (popup) => {
    const h = (window.__h = window.mockHass());
    const bc = document.createElement('bubble-card'); bc.setConfig(popup); bc.hass = h; document.getElementById('dash').appendChild(bc);
    await window.__w(400);
    location.hash = '#energi'; await window.__w(1300);
    const c = window.__deep().find((e) => e.localName === 'msh-energi-card');
    c.shadowRoot.querySelector('.prow .gear').click(); await window.__w(800);
    const ed = window.__deep().find((e) => e.localName === 'msh-editor' && e._inline);
    if (!ed) return false;
    window.ROW = () => ed.shadowRoot.querySelector('.chips.tabs');
    window.ROW().scrollIntoView({ block: 'center' }); await window.__w(300);
    return true;
  }, popup);
  ok('Tilpass energi: arket åpnet med faner', ready);
  if (ready) await run('Tilpass energi', p, [2, 1, 3, 4]);
  await p.close();
}

await b.close();
ok('ingen sidefeil', !errs.length, errs.slice(0, 5));
for (const [k, v] of Object.entries(res)) console.log(v === 'OK' ? '✔' : '✘', k, v === 'OK' ? '' : JSON.stringify(v[1]));
console.log(fail.length ? `\n${fail.length} feilet` : '\nAlt OK');
process.exit(fail.length ? 1 : 0);
