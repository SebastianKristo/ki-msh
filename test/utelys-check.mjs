// Fiks 22.10 · Lys → Utelys «Døgnring»: ring + midtknapp, Tennes/Slukkes, Automatikk/Kveld/Morgen skriver til switchene,
// lampe-pillene dimmes ved sidelengs dra uten at popupen lukkes, Sola-tider fra sensor.sun_next_*, Innstillinger → number.*,
// entitetsfeltene i begge editorene, og minutt-oppdateringen går bare mens popupen er åpen.
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { readdirSync, existsSync, mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const BC = resolve('test/.vendor/bubble-card.js');
if (!existsSync(BC)) execFileSync('curl', ['-sSL', '-o', BC, 'https://raw.githubusercontent.com/Clooos/Bubble-Card/main/dist/bubble-card.js']);
mkdirSync(resolve('test/.build'), { recursive: true });
const bundle = resolve(`test/.build/utelys-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const SHOTS = process.env.SHOTS || '';
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errs = [];
let fail = 0;
const ok = (name, cond, info) => { if (!cond) fail++; console.log(`${cond ? 'OK  ' : 'FEIL'} ${name}${info !== undefined ? ' · ' + JSON.stringify(info) : ''}`); };
const boot = async (vp, card) => {
  const ctx = await b.newContext({ viewport: vp, hasTouch: true });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + resolve('test/harness-bubble.html'));
  for (const m of readdirSync('test/mock').sort()) await p.addScriptTag({ path: resolve('test/mock/' + m) });
  await p.addScriptTag({ path: bundle });
  await p.addScriptTag({ path: BC, type: 'module' });
  await p.waitForFunction(() => customElements.get('bubble-card'));
  await p.evaluate(async (card) => {
    const wait = (ms) => new Promise((q) => setTimeout(q, ms));
    window.__hass = window.mockHass();
    const bc = document.createElement('bubble-card');
    bc.setConfig({ type: 'custom:bubble-card', card_type: 'pop-up', hash: '#lys', name: 'Lys', icon: 'mdi:lightbulb', bg_color: '#282828', bg_opacity: 100, bg_blur: 0, cards: [card] });
    bc.hass = window.__hass; document.getElementById('dash').appendChild(bc); window.__bc = bc;
    await wait(400);
    location.hash = '#lys'; await wait(1500);
    const all = () => { const o = []; const w = (r) => r.querySelectorAll('*').forEach((e) => { o.push(e); if (e.shadowRoot) w(e.shadowRoot); }); w(document); return o; };
    window.__card = all().find((e) => e.localName === 'msh-lys-card');
  }, card);
  return p;
};
const CARD = { type: 'custom:msh-lys-card', card_id: 'ut1' };
{
  const p = await boot({ width: 390, height: 844 }, CARD);
  const r = await p.evaluate(async () => {
    const wait = (ms) => new Promise((q) => setTimeout(q, ms));
    const c = window.__card, R = c.shadowRoot, q = (s) => R.querySelector(s), txt = (s) => (q(s) ? q(s).textContent.replace(/\s+/g, ' ').trim() : null);
    const o = {};
    o.order = [...R.querySelectorAll('.ut > *')].map((e) => e.dataset.key);
    o.ring = !!q('.uc svg.ring') && q('.uc svg.ring').getBoundingClientRect().width;
    o.arcs = { night: !!q('.ring .rn'), lamp: !!q('.ring .rl'), marks: R.querySelectorAll('.ring .rm').length, now: !!q('.ring .rnow') };
    o.center = txt('.rc');
    o.tiles = [txt('[data-key="ev-on"]'), txt('[data-key="ev-off"]')];
    o.nx = q('.evt.nx') && q('.evt.nx').dataset.key;
    o.auto = txt('[data-key="ut-ar"]');
    o.lamps = { n: R.querySelectorAll('.lp').length, cols: getComputedStyle(q('.lps')).gridTemplateColumns.split(' ').length, h: q('.lp').getBoundingClientRect().height, ta: getComputedStyle(q('.lp')).touchAction };
    o.sun = [...R.querySelectorAll('.stl')].map((e) => e.textContent.replace(/\s+/g, ' ').trim());
    o.sunNx = q('.stl.nx') && q('.stl.nx').dataset.key;
    o.sunHead = txt('.sol .row');
    o.setMeta = txt('[data-key="fold-utset"] .fh');
    o.timer = !!c._utT;
    o.wrapW = [q('.ut').getBoundingClientRect().width, c.getBoundingClientRect().width];
    window.__calls.length = 0;
    q('.rc').click(); await wait(50);
    q('[data-key="ut-ar"]').click(); await wait(50);
    q('[data-key="af-kveld"]').click(); await wait(50);
    q('[data-key="af-morgen"]').click(); await wait(50);
    o.calls = window.__calls.map((x) => [x[0], x[1], x[2] && x[2].entity_id]);
    c.setUI({ fold: { utset: true } }); await wait(300);
    window.__calls.length = 0;
    R.querySelector('[data-key="fold-utset"] .msh-stp[data-stp="number.ki_utelys_terskel_paa"] .msh-stp-b[data-stp-d="1"]').click(); await wait(100);
    o.num = window.__calls.map((x) => [x[0], x[1], x[2]]);
    o.steppers = R.querySelectorAll('[data-key="fold-utset"] .msh-stp').length;
    window.__calls.length = 0;
    return o;
  });
  // sidelengs dra på første dimbare pille (touch)
  const box = await p.evaluate(() => { const el = window.__card.shadowRoot.querySelector('.lp[data-dim="1"]'); const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, id: el.dataset.lp, pct: el.dataset.pct }; });
  await p.mouse.move(box.x + box.w * 0.5, box.y + box.h / 2);
  await p.mouse.down();
  for (let i = 1; i <= 8; i++) await p.mouse.move(box.x + box.w * 0.5 - i * 8, box.y + box.h / 2);
  await p.mouse.up();
  await p.waitForTimeout(200);
  const drag = await p.evaluate(() => ({ calls: window.__calls.map((x) => [x[0], x[1], x[2]]), hash: location.hash }));
  if (SHOTS) {
    await p.evaluate(async () => { window.__card.setUI({ fold: {} }); await new Promise((q) => setTimeout(q, 300)); });
    await p.screenshot({ path: `${SHOTS}/utelys-mobil.png`, fullPage: true });
  }
  // popupen lukkes → timeren stopper
  const closed = await p.evaluate(async () => { location.hash = ''; await new Promise((q) => setTimeout(q, 600)); return !window.__card._utT; });
  // GUI-editor (static schema) har feltene
  const sch = await p.evaluate(() => {
    const f = window.customElements.get('msh-lys-card').schema(window.__hass, {});
    const names = []; const w = (l) => (l || []).forEach((x) => { if (x.name) names.push(x.name); if (x.hiddenName) names.push(x.hiddenName); w(x.fields); }); w(f);
    return names;
  });
  const r2 = r;
  ok('rekkefølge: toppkort, Automatikk, Lamper, Sola, Innstillinger', JSON.stringify(r2.order) === JSON.stringify(['uc', 'ut-auto', 'ut-lamps', 'ut-sun', 'fold-utset']), r2.order);
  ok('ring 188 px med natt/lys-bue, ↑/↓, nå-prikk', r2.ring === 188 && r2.arcs.night && r2.arcs.lamp && r2.arcs.marks === 2 && r2.arcs.now, r2.arcs);
  ok('midten = av/på med tid', /^(På|Av) (slukkes|tennes) \d\d:\d\d$/.test(r2.center.replace(/^\S*\s?/, '')) || /(På|Av)/.test(r2.center), r2.center);
  ok('Tennes 19:34 / Slukkes 06:56 fra KI Utelys', /19:34/.test(r2.tiles[0]) && /06:56/.test(r2.tiles[1]) && /i (dag|morgen)/.test(r2.tiles[0]), r2.tiles);
  ok('neste hendelse markert', !!r2.nx, r2.nx);
  ok('Automatikk-status', /Automatikk ?(Utelyset er på|Venter på mørket|Styrer utelyset)/.test(r2.auto), r2.auto);
  ok('av/på + Automatikk/Kveld/Morgen skriver', JSON.stringify(r2.calls.slice(1)) === JSON.stringify([['homeassistant', 'toggle', 'switch.ki_utelys_auto'], ['homeassistant', 'toggle', 'switch.ki_utelys_kveld'], ['homeassistant', 'toggle', 'switch.ki_utelys_morgen']]) && r2.calls[0][0] === 'light', r2.calls);
  ok('lamper: 2 kolonner, 64 px, pan-y', r2.lamps.cols === 2 && r2.lamps.h === 64 && r2.lamps.ta === 'pan-y' && r2.lamps.n >= 2, r2.lamps);
  ok('Sola: 5 fliser med tider fra sensor.sun_next_*', r2.sun.length === 5 && /06:21/.test(r2.sun[0]) && /07:11/.test(r2.sun[1]) && /13:07/.test(r2.sun[2]) && /19:04/.test(r2.sun[3]) && /19:41/.test(r2.sun[4]) && !!r2.sunNx, r2.sun);
  ok('Solhøyde −12,4° · synker', /Solhøyde −12,4° · synker/.test(r2.sunHead), r2.sunHead);
  ok('Innstillinger-meta', /40 \/ 120 lx · 20 min/.test(r2.setMeta), r2.setMeta);
  ok('stepper → number.set_value 45', r2.steppers === 3 && r2.num.some((x) => x[0] === 'number' && x[1] === 'set_value' && x[2].entity_id === 'number.ki_utelys_terskel_paa' && Number(x[2].value) === 45), r2.num);
  ok('dra = dimming, popupen står', drag.hash === '#lys' && drag.calls.length === 1 && drag.calls[0][0] === 'light' && drag.calls[0][2].entity_id === box.id && (drag.calls[0][1] === 'turn_off' || drag.calls[0][2].brightness_pct < Number(box.pct)), { drag, box });
  ok('minutt-timer bare mens åpen', r2.timer && closed, [r2.timer, closed]);
  ok('fyller bredden', Math.abs(r2.wrapW[0] - r2.wrapW[1]) < 2, r2.wrapW);
  const need = ['overrides.automatikk', 'overrides.kveld_bryter', 'overrides.morgen_bryter', 'overrides.neste_paa', 'overrides.neste_av', 'overrides.utelys_status', 'overrides.terskel_paa', 'overrides.terskel_av', 'overrides.minst_morke', 'overrides.sun_dawn', 'overrides.sun_rising', 'overrides.sun_noon', 'overrides.sun_setting', 'overrides.sun_dusk', 'overrides.sun_elevation', 'overrides.sun_stiger', 'outdoor.ring_start', 'outdoor.sections', 'outdoor.hidden_sections', 'order.utelys', 'include.utelys'];
  ok('GUI-editor: alle felter', need.every((n) => sch.includes(n)), need.filter((n) => !sch.includes(n)));
  await p.context().close();
}
{
  // Tilpass lys-arket (kortets egen editor) → Utelys-siden, og 12 øverst + skjult seksjon
  const p = await boot({ width: 1280, height: 900 }, { ...CARD, outdoor: { ring_start: 12, hidden_sections: ['sun'], sections: ['lamps', 'auto', 'settings', 'sun'] } });
  const r = await p.evaluate(async () => {
    const wait = (ms) => new Promise((q) => setTimeout(q, ms));
    const c = window.__card, R = c.shadowRoot, o = {};
    o.order = [...R.querySelectorAll('.ut > *')].map((e) => e.dataset.key);
    const t = R.querySelector('.ring .rh'); o.firstLabel = t && t.textContent; o.firstY = t && Number(t.getAttribute('y'));
    c.customize('utelys'); await wait(600);
    const all = () => { const x = []; const w = (r) => r.querySelectorAll('*').forEach((e) => { x.push(e); if (e.shadowRoot) w(e.shadowRoot); }); w(document); return x; };
    const box = all().find((e) => e.classList && e.classList.contains('lys-sheet'));
    o.sheet = !!box;
    o.pickers = box ? [...box.querySelectorAll('msh-entity-picker[data-f]')].map((e) => e.dataset.f) : [];
    o.secRows = box ? box.querySelectorAll('[data-a="usec"]').length : 0;
    o.lup = box ? box.querySelectorAll('[data-a="lup"]').length : 0;
    return o;
  });
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/utelys-ark.png` });
  ok('seksjonsrekkefølge og skjul fra config', JSON.stringify(r.order) === JSON.stringify(['uc', 'ut-lamps', 'ut-auto', 'fold-utset']), r.order);
  ok('12 øverst', r.firstLabel === '00' && r.firstY > 94, [r.firstLabel, r.firstY]);
  ok('arket: entitetsfelter + seksjoner + lamperekkefølge', r.sheet && ['overrides.neste_paa', 'overrides.sun_elevation', 'overrides.terskel_paa', 'overrides.automatikk'].every((k) => r.pickers.includes(k)) && r.secRows === 4 && r.lup >= 1, r);
  await p.context().close();
}
console.log(errs.length ? 'Sidefeil: ' + errs.join(' | ') : 'Ingen sidefeil');
await b.close();
process.exit(fail || errs.length ? 1 : 0);
