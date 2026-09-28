// Fiks 21.1 (husscene) + 21.8 (ny garasje «Ved sjøen") · M.energiHus fra src/52-energi-hus.js.
// Rendrer alle fire stilene på mobil (390) og PC (900) og sjekker at ledelinjer og prikker ender i målpunktene
// (også i skjermkoordinater mot markørene i selve tegningen), justeringsreglene, kabel-pulsen (kW / flow / 0 W),
// vinduer som bare gløder med lys på, eget bilde + overstyrte målpunkter, og at examples/www/ki/*.svg er gyldige.
//   node test/energi-hus-check.mjs        (SHOT=1 → skjermbilder i scratchpad)
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
mkdirSync('test/.build', { recursive: true });
const bundle = resolve(`test/.build/energi-hus-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const shot = process.env.SHOT ? '/tmp/claude-0/-home-user/edde745c-687c-5d41-9673-062ed20f63c8/scratchpad/' : '';
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const res = {}, fail = [];
const ok = (name, cond, info) => { res[name] = cond ? 'OK' : ['FEIL', info]; if (!cond) fail.push(name); };
const errs = [];

for (const vp of [{ width: 390, height: 900, n: 'mobil' }, { width: 900, height: 900, n: 'PC' }]) {
  const p = await b.newPage({ viewport: vp });
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + resolve('test/harness.html'));
  await p.addScriptTag({ path: bundle });
  const r = await p.evaluate(() => {
    const E = window.MSH.energiHus, out = {};
    document.body.style.cssText = 'background:#282828;font-family:system-ui,sans-serif;margin:0';
    const near = (a, b, t = 0.6) => Math.abs(a - b) <= t;
    for (const s of E.STYLES) {
      const host = document.createElement('div');
      host.innerHTML = E.html({ style: s, lightsOn: true, flow: true, kw: 2, values: { ev: 7400, grid: 2400, home: 1830 } });
      document.body.appendChild(host);
      const ov = host.querySelector('.ehus-ov'), img = host.querySelector('svg.ehus-img'), H = E.HOUSES[s];
      const o = { lines: true, dots: true, screen: true, vb: ov.getAttribute('viewBox') === img.getAttribute('viewBox') };
      for (const k of ['ev', 'grid', 'home']) {
        const [x, y] = H[k];
        const line = ov.querySelector(`.ehus-line[data-k="${k}"]`), dot = ov.querySelector(`.ehus-dot[data-k="${k}"]`);
        const len = line.getTotalLength(), end = line.getPointAtLength(len), start = line.getPointAtLength(0);
        if (!(near(end.x, x) && near(end.y, y) && near(start.x, x) && near(start.y, 52))) o.lines = [k, end.x, end.y];
        if (!(near(+dot.getAttribute('cx'), x) && near(+dot.getAttribute('cy'), y) && dot.getAttribute('r') === '3')) o.dots = k;
        // Skjermkoordinater: linjeslutt i overlayet = markøren i husbildet
        const m = img.querySelector(`.ehus-t[data-t="${k}"]`).getBoundingClientRect();
        const pt = ov.createSVGPoint(); pt.x = end.x; pt.y = end.y; const sp = pt.matrixTransform(line.getScreenCTM());
        if (!(near(sp.x, m.x, 1) && near(sp.y, m.y, 1))) o.screen = [k, sp.x, m.x, sp.y, m.y];
        const grad = ov.querySelector(line.getAttribute('stroke').slice(4, -1));
        if (!grad || grad.getAttribute('gradientUnits') !== 'userSpaceOnUse') o.grad = 'mangler userSpaceOnUse';
      }
      const an = (k) => ov.querySelector(`.ehus-lab[data-k="${k}"]`).getAttribute('text-anchor');
      o.anchors = [an('ev'), an('grid'), an('home')].join(',');
      o.gridRule = an('grid') === (Math.abs(H.home[0] - H.grid[0]) < 70 ? 'end' : 'middle');
      // Etikettene overlapper ikke og holder seg inne i viewBox
      const bx = [...ov.querySelectorAll('.ehus-lab')].map((g) => g.getBBox());
      o.overlap = bx.some((a, i) => bx.some((c, j) => j > i && a.x < c.x + c.width && c.x < a.x + a.width));
      o.inside = bx.every((a) => a.x >= -1 && a.x + a.width <= 381);
      const pulse = ov.querySelector('.ehus-pulse');
      o.pulse = !!pulse && getComputedStyle(pulse).animationName === 'ehus-flow';
      o.lit = img.querySelectorAll('.ehus-win.lit').length;
      out[s] = o;
      host.remove();
    }
    // Lys av: ingen glød, vinduer #2a2c34
    const d = document.createElement('div'); d.innerHTML = E.html({ style: 'sjo', lightsOn: false, kw: 0, flow: true, values: {} }); document.body.appendChild(d);
    out.off = { lit: d.querySelectorAll('.ehus-win.lit').length, dark: d.querySelectorAll('rect[fill="#2a2c34"]').length, pulse0: !d.querySelector('.ehus-pulse'), dash: d.querySelector('.ehus-val').textContent };
    d.innerHTML = E.html({ style: 'sjo', kw: 3, flow: false }); out.flowOff = !d.querySelector('.ehus-pulse') && !d.querySelector('.ehus-cable');
    d.innerHTML = E.html({ style: 'sjo', kw: 8 }); const fast = parseFloat(d.querySelector('.ehus-pulse').style.animationDuration);
    d.innerHTML = E.html({ style: 'sjo', kw: 1 }); const slow = parseFloat(d.querySelector('.ehus-pulse').style.animationDuration);
    out.speed = fast < slow;
    // Eget bilde + overstyrte målpunkter
    d.innerHTML = E.html({ style: 'enebolig', custom_image: '/local/ki/mitt-hus.png', targets: { ev: [60, 250], home: [300, 120] } });
    const im = d.querySelector('img.ehus-img'), l = d.querySelector('.ehus-line[data-k="ev"]').getAttribute('d');
    out.custom = { fit: getComputedStyle(im).objectFit, src: im.getAttribute('src'), ev: l, grid: d.querySelector('.ehus-line[data-k="grid"]').getAttribute('d') };
    out.sjoEv = E.HOUSES.sjo.ev.join(',');
    out.thumb = E.STYLES.every((s) => /<svg class="ehus-thumb"/.test(E.thumb(s)));
    out.names = E.STYLES.map((s) => E.NAMES[s]).join(',');
    d.remove();
    return out;
  });
  for (const s of ['enebolig', 'rekkehus', 'gard', 'sjo']) {
    const o = r[s];
    ok(`${vp.n} ${s}: samme viewBox`, o.vb);
    ok(`${vp.n} ${s}: linjer M x,52 V y ender i målpunktene`, o.lines === true, o.lines);
    ok(`${vp.n} ${s}: prikker (3 px) i målpunktene`, o.dots === true, o.dots);
    ok(`${vp.n} ${s}: linjene treffer tegningen på skjermen`, o.screen === true, o.screen);
    ok(`${vp.n} ${s}: gradient userSpaceOnUse`, !o.grad, o.grad);
    ok(`${vp.n} ${s}: justering ev=end, home=start, grid etter 70-regelen`, /^end,(end|middle),start$/.test(o.anchors) && o.gridRule, o.anchors);
    ok(`${vp.n} ${s}: etiketter overlapper ikke og er innenfor`, !o.overlap && o.inside, o);
    ok(`${vp.n} ${s}: puls animert ved kW > 0`, o.pulse);
    ok(`${vp.n} ${s}: vinduer gløder med lys på`, o.lit > 0, o.lit);
  }
  ok(`${vp.n}: lys av → ingen glød, mørke vinduer`, r.off.lit === 0 && r.off.dark > 5, r.off);
  ok(`${vp.n}: 0 W → ingen puls, manglende verdi → «–»`, r.off.pulse0 && r.off.dash === '–', r.off);
  ok(`${vp.n}: flow=false → ingen kabel/puls`, r.flowOff);
  ok(`${vp.n}: pulshastighet ∝ kW`, r.speed);
  ok(`${vp.n}: 21.8 sjo.ev = [99, 279.4]`, r.sjoEv === '99,279.4', r.sjoEv);
  ok(`${vp.n}: eget bilde object-fit contain + ?v= + targets`, r.custom.fit === 'contain' && /\?v=/.test(r.custom.src) && r.custom.ev === 'M 60,52 V 250', r.custom);
  ok(`${vp.n}: thumb + navn`, r.thumb && r.names === 'Enebolig,Rekkehus,Gård,Ved sjøen', r.names);
  if (shot) {
    await p.evaluate(() => { const E = window.MSH.energiHus; document.body.innerHTML = E.STYLES.map((s) => E.html({ style: s, lightsOn: true, kw: 2.4, values: { ev: 7400, grid: 2400, home: 1830 } })).join(''); });
    await p.screenshot({ path: `${shot}energi-hus-${vp.n}.png`, fullPage: true });
  }
  await p.close();
}
// Filene for /local/ki/ er gyldig, frittstående SVG med samme viewBox
for (const f of ['energi-hus.svg', 'energi-hus-rekkehus.svg', 'energi-hus-gard.svg', 'energi-hus-sjo.svg']) {
  const t = readFileSync('examples/www/ki/' + f, 'utf8');
  ok(`fil ${f}`, /xmlns="http:\/\/www.w3.org\/2000\/svg" viewBox="0 0 380 340"/.test(t) && !/matrix\(1\.1 0 0 1\.35/.test(t));
}
ok('ingen sidefeil', !errs.length, errs);
await b.close();
for (const [k, v] of Object.entries(res)) console.log(v === 'OK' ? 'OK  ' : 'FEIL', k, v === 'OK' ? '' : JSON.stringify(v[1]));
console.log(fail.length ? `\n${fail.length} feil` : '\nAlt OK');
process.exit(fail.length ? 1 : 0);
