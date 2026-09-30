// Fiks 24.9 + 26.11/26.12 · Sir Sweeps (#rolf, msh-stovsuger-card): toppkort med animert robot, tank-varsel, faner + tannhjul,
// Renhold (romgrid, start, pause/hjem, soner-scroll), Kontroll (fremdrift teller), Info, Kart, «Tilpass» (Rom/Faner/
// Entiteter/Avansert, dra-rekkefølge) ↔ GUI-editor, «–» uten entiteter og popup-registreringen (sub_button, vilkår).
//   node test/stovsuger-check.mjs   (SHOTS=<mappe> for skjermbilder)
import { createRequire } from 'node:module';
import { readdirSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
mkdirSync('test/.build', { recursive: true });
const bundle = resolve(`test/.build/stovsuger-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const shots = process.env.SHOTS || '';
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const res = {}, fail = [];
const ok = (name, cond, info) => { res[name] = cond ? 'OK' : ['FEIL', info]; if (!cond) fail.push(name); };
const mocks = readdirSync('test/mock').sort().map((m) => resolve('test/mock/' + m));
const errs = [];
async function page(cfg, vp) {
  const p = await b.newPage({ viewport: vp || { width: 390, height: 900 }, hasTouch: true });
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + resolve('test/harness.html'));
  for (const m of mocks) await p.addScriptTag({ path: m });
  await p.addScriptTag({ path: bundle });
  await p.evaluate(async (cfg) => {
    window.__h = window.mockHass();
    const bc = document.createElement('bubble-card');
    bc.setConfig({ type: 'custom:bubble-card', card_type: 'pop-up', hash: '#rolf' });
    bc.innerHTML = '<div class="pop"><div class="hdr">Sir Sweeps</div><div class="inner"></div></div>';
    document.getElementById('dash').appendChild(bc);
    window.__popEv = 0;
    ['touchstart', 'touchmove', 'pointerdown'].forEach((t) => bc.querySelector('.pop').addEventListener(t, () => { window.__popEv++; }));
    location.hash = '#rolf';
    const c = document.createElement('msh-stovsuger-card');
    c.setConfig({ type: 'custom:msh-stovsuger-card', card_id: 'pop-rolf', ...(cfg || {}) });
    c.hass = window.__h;
    bc.querySelector('.inner').appendChild(c);
    window.__c = c;
    window.__set = (id, state, attrs) => { const h = window.__h, o = h.states[id]; const s = { ...o, state, attributes: { ...o.attributes, ...(attrs || {}) }, last_changed: attrs && attrs.__lc ? attrs.__lc : new Date().toISOString() }; delete s.attributes.__lc; window.__h = { ...h, states: { ...h.states, [id]: s } }; c.hass = window.__h; };
    await new Promise((q) => setTimeout(q, 700));
  }, cfg);
  return p;
}
const wait = (p, ms) => p.evaluate((ms) => new Promise((q) => setTimeout(q, ms)), ms);
const shot = async (p, n) => { if (shots) await p.screenshot({ path: `${shots}/rolf-${n}.png`, fullPage: true }); };
const calls = (p) => p.evaluate(() => window.__calls.filter((c) => c[0] !== 'ws').map((c) => [c[0], c[1], c[2] && c[2].entity_id, c[2] && (c[2].fan_speed || c[2].option)].filter(Boolean).join(' ')));
const clear = (p) => p.evaluate(() => { window.__calls.length = 0; });
const click = (p, sel) => p.evaluate((sel) => { const e = window.__c.shadowRoot.querySelector(sel); if (!e) return false; e.click(); return true; }, sel);

const p = await page();
// ---------------------------------------------------------------- toppkort + varsel + faner
const T = await p.evaluate(() => {
  const sr = window.__c.shadowRoot, hero = sr.querySelector('.hero'), r = hero.getBoundingClientRect();
  return { h: Math.round(r.height), w: Math.round(r.width), cw: Math.round(window.__c.getBoundingClientRect().width), pill: sr.querySelector('.spill').textContent.trim(), chipIcon: !!sr.querySelector('.spill ha-icon'), dot: !!sr.querySelector('.spill i'), name: sr.querySelector('.hn').textContent, nameFs: getComputedStyle(sr.querySelector('.hn')).fontSize, sub: sr.querySelector('.hero').textContent.includes('Vifte'), bl: sr.querySelector('.bl') && sr.querySelector('.bl').textContent, bbar: sr.querySelector('.bbar i') && sr.querySelector('.bbar i').style.width, scw: Math.round(sr.querySelector('.scw').getBoundingClientRect().height), zone: !!sr.querySelector('.scene .zone'), tabW: [...sr.querySelectorAll('.tabs [data-act="tab"]')].map((t) => Math.round(t.getBoundingClientRect().width)), tabIcons: sr.querySelectorAll('.tabs ha-icon').length, tabsH: Math.round(sr.querySelector('.tabs').getBoundingClientRect().height), onW: Math.round(sr.querySelector('.tabs .on').getBoundingClientRect().width), bat: sr.querySelector('.bv').textContent, bolt: !!sr.querySelector('.bolt'), docked: !!sr.querySelector('.bot.docked'), tank: sr.querySelector('.tank') && sr.querySelector('.tank').textContent.replace(/\s+/g, ' ').trim(), tabs: [...sr.querySelectorAll('.tabs [data-act="tab"]')].map((t) => t.getAttribute('aria-label')), gear: !!sr.querySelector('.top .gear[data-act="customize"]'), first: sr.querySelector('.wrap').firstElementChild.className };
});
ok('toppkort 200 px først, fyller bredden', T.h === 200 && T.w === T.cw && /hero/.test(T.first), T);
ok('status-chip «Lader i dokken» med ikon (ingen prikk), batteri 87, lyn i dokken', T.pill === 'Lader i dokken' && T.chipIcon && !T.dot && T.bat === '87' && T.bolt && T.docked, T);
ok('26.11 toppkort: navn 15 px, ingen «Vifte …»-undertekst, «batteri» + grønn stolpe 87 %, kart = høyde − 12 med lilla sone', T.name === 'Sir Sweeps a lot' && T.nameFs === '15px' && !T.sub && T.bl === 'batteri' && T.bbar === '87%' && T.scw === 188 && T.zone, T);
ok('26.11 faner: bare tekst, like brede, 48 px høy, boblen = aktiv fane', T.tabIcons === 0 && new Set(T.tabW).size === 1 && T.tabsH === 48 && T.onW === T.tabW[0], T);
ok('varsel «Vanntanken er tom» med «Tøm»', /Vanntanken er tom/.test(T.tank || '') && /Tøm/.test(T.tank || ''), T.tank);
ok('faner Renhold/Kontroll/Info/Kart + tannhjul', T.tabs.join('|') === 'Renhold|Kontroll|Info|Kart' && T.gear, T);
await shot(p, '1-renhold');
// ---------------------------------------------------------------- Renhold
const R = await p.evaluate(() => {
  const sr = window.__c.shadowRoot, t = [...sr.querySelectorAll('.rt')];
  const rc = t.map((e) => e.getBoundingClientRect()); return { names: t.map((e) => e.querySelector('.rn').textContent), big: t.map((e) => e.classList.contains('big')), on: t.filter((e) => e.classList.contains('on')).map((e) => e.querySelector('.rn').textContent), rows: rc.map((r) => Math.round(r.top)), wid: rc.map((r) => Math.round(r.width)), card: t.every((e) => e.closest('.rcard')), cardBg: getComputedStyle(sr.querySelector('.rcard')).backgroundColor, radio: !!sr.querySelector('.rt .rc'), tint: getComputedStyle(t[2]).backgroundColor, hdr: sr.querySelector('.rct').textContent, lnkBg: getComputedStyle(sr.querySelector('.lnk')).backgroundColor, go: sr.querySelector('.gobtn .gt b').textContent.trim(), goSub: sr.querySelector('.gobtn .gt span') && sr.querySelector('.gobtn .gt span').textContent, goH: Math.round(sr.querySelector('.gobtn').getBoundingClientRect().height), zh: Math.round(sr.querySelector('.zc').getBoundingClientRect().height), sel: sr.querySelector('[data-act="selall"]').textContent, zones: [...sr.querySelectorAll('.zc')].map((e) => e.textContent.trim()), zta: getComputedStyle(sr.querySelector('.zones')).touchAction, sum: sr.querySelector('.sum').textContent.replace(/\s+/g, ' ') };
});
ok('romgrid: 5 rom i standard-rekkefølge, plass 1–2 store', R.names.join('|') === 'Soverom|Pappa|Mamma|Kontor|Trapp' && R.big.join() === 'true,true,false,false,false', R);
ok('26.11 rom i ETT kort #3a3a3a, header + «Velg alle» som tekst, 2 + 3 (1fr 2fr 1fr), fargetonet, ingen radio', R.card && R.cardBg === 'rgb(58, 58, 58)' && R.lnkBg === 'rgba(0, 0, 0, 0)' && R.rows[0] === R.rows[1] && R.rows[2] === R.rows[3] && R.rows[3] === R.rows[4] && R.rows[2] > R.rows[0] && R.wid[0] === R.wid[1] && Math.abs(R.wid[3] - (2 * R.wid[2] + 8)) <= 2 && R.wid[2] === R.wid[4] && !R.radio && R.tint !== 'rgb(58, 58, 58)', R);
ok('26.11 sum uten areal: bare «2 rom» (aldri «– m²»)', R.sum.trim() === '2 rom' && !/–/.test(R.sum), R.sum);
ok('valgte rom = input_boolean på (Soverom, Pappa)', R.on.join('|') === 'Soverom|Pappa', R.on);
ok('«Støvsug 2 rom» (sensor.rolf_all = True), «Velg alle», pill 64 px, soner 52 px', R.go === 'Støvsug 2 rom' && !R.goSub && R.goH === 64 && R.zh === 52 && R.sel === 'Velg alle', R);
ok('soner: 5 chips, touch-action pan-x', R.zones.join('|') === 'Spisebord lite|Spisebord mye|Stue uten spisebord|Teppe stue|Kjøkkenbord' && R.zta === 'pan-x', R);
await clear(p);
await click(p, '.rt[data-k="mamma_soverom"]');
await click(p, '.gobtn');
await click(p, '.zc');
let cl = await calls(p);
ok('trykk rom = toggle, start = script.start_sir_sweeps_a_lot_room_select, sone = skript', cl.includes('input_boolean toggle input_boolean.sir_sweeps_a_lot_mamma_soverom') && cl.includes('script turn_on script.start_sir_sweeps_a_lot_room_select') && cl.includes('script turn_on script.rolf_zone_stuebord'), cl);
// soner-scroll lukker ikke popupen
const Z = await p.evaluate(async () => {
  window.__popEv = 0;
  const z = window.__c.shadowRoot.querySelector('.zones'), chip = z.querySelector('.zc');
  const tp = (t) => { try { const T = new Touch({ identifier: 1, target: chip, clientX: 100, clientY: 600 }); chip.dispatchEvent(new TouchEvent(t, { bubbles: true, composed: true, touches: [T], changedTouches: [T] })); } catch (e) { chip.dispatchEvent(new Event(t, { bubbles: true, composed: true })); } };
  tp('touchstart'); tp('touchmove');
  chip.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true, pointerId: 3 }));
  const n = window.__popEv;
  chip.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, composed: true, pointerId: 3 }));
  return n;
});
ok('soner: touch/pointer bobler ikke til popupen', Z === 0, Z);
// ---------------------------------------------------------------- rengjøring: robot animerer, fremdrift teller, pause/hjem
await p.evaluate(() => { window.__set('vacuum.sir_sweeps_a_lot', 'cleaning', { __lc: new Date(Date.now() - 12 * 60000).toISOString() }); window.__set('binary_sensor.sir_sweeps_a_lot_charging', 'off'); });
await p.evaluate(() => { const c = window.__c; c.setConfig({ ...c._rawConfig, rooms: { sebsatian_soverom: { m2: 14 }, pappa_soverom: { m2: 16 } } }); });
await wait(p, 400);
const A = await p.evaluate(() => { const sr = window.__c.shadowRoot; return { pill: sr.querySelector('.spill').textContent.trim(), motion: !!sr.querySelector('.bot.cleaning animateMotion'), trail: !!sr.querySelector('.trail animate'), act: [...sr.querySelectorAll('.actrow .ab')].map((b) => b.textContent.trim()), sum: sr.querySelector('.sum').textContent.replace(/\s+/g, ' ') }; });
ok('rengjør: pille «Rengjør», robot følger ruten (animateMotion) med spor', A.pill === 'Rengjør' && A.motion && A.trail, A);
ok('Renhold aktiv: Pause + Hjem i stedet for start, sum «2 rom · 30 m² · ca N min»', A.act.join('|') === 'Pause|Hjem' && /^2 rom · 30 m² · ca \d+ min$/.test(A.sum.trim()), A);
await shot(p, '2-rengjor');
await clear(p);
await click(p, '.actrow [data-act="pause"]');
await click(p, '.actrow [data-act="home"]');
cl = await calls(p);
ok('pause = script.stovsuger_pause, hjem = script.stovsuger_retuner_hjem', cl.includes('script turn_on script.stovsuger_pause') && cl.includes('script turn_on script.stovsuger_retuner_hjem'), cl);
await click(p, '[data-act="tab"][data-v="kontroll"]');
await wait(p, 300);
const K1 = await p.evaluate(() => { const sr = window.__c.shadowRoot; return { pct: sr.querySelector('.pv').textContent, left: sr.querySelector('.pl span').textContent, bar: sr.querySelector('.bar i').style.width, segs: [...sr.querySelectorAll('.segc .sgh span:first-of-type')].map((e) => e.textContent), fan: [...sr.querySelectorAll('.seg .sg')].slice(0, 4).map((e) => e.textContent), glass: sr.querySelectorAll('.seg[data-glass-drag]').length }; });
await p.evaluate(() => window.__set('vacuum.sir_sweeps_a_lot', 'cleaning', { __lc: new Date(Date.now() - 20 * 60000).toISOString() }));
await wait(p, 300);
const K2 = await p.evaluate(() => window.__c.shadowRoot.querySelector('.pv').textContent);
ok('Kontroll: fremdrift % + min igjen, teller oppover', parseInt(K1.pct) > 0 && /min igjen/.test(K1.left) && parseInt(K2) > parseInt(K1.pct), { K1, K2 });
ok('Kontroll: segmenter Vifte/Moppmodus/Moppintensitet (glass-drag)', K1.segs.join('|') === 'Vifte|Moppmodus|Moppintensitet' && K1.fan.join('|') === 'quiet|balanced|turbo|max' && K1.glass === 3, K1);
await clear(p);
await click(p, '.seg .sg[data-v="turbo"]');
await click(p, '.seg .sg[data-v="Høy"]');
await click(p, '.cb[data-act="empty"]');
cl = await calls(p);
ok('vifte = vacuum.set_fan_speed, mopp = select_option, tøm = script.rolf_empty', cl.includes('vacuum set_fan_speed vacuum.sir_sweeps_a_lot turbo') && cl.includes('input_select select_option input_select.vacuum_fan_speed Høy') && cl.includes('script turn_on script.rolf_empty'), cl);
await shot(p, '3-kontroll');
// retur → robot kjører hjem
await p.evaluate(() => window.__set('vacuum.sir_sweeps_a_lot', 'returning'));
await wait(p, 300);
const H = await p.evaluate(() => { const sr = window.__c.shadowRoot; return { pill: sr.querySelector('.spill').textContent.trim(), home: !!sr.querySelector('.bot.returning animateMotion'), path: !!sr.querySelector('.homep') }; });
ok('retur: «På vei hjem», robot animerer mot dokken', H.pill === 'På vei hjem' && H.home && H.path, H);
// ---------------------------------------------------------------- Info + Kart
await click(p, '[data-act="tab"][data-v="info"]');
await wait(p, 300);
const I = await p.evaluate(() => { const sr = window.__c.shadowRoot; return { stats: [...sr.querySelectorAll('.stat')].map((e) => e.textContent.replace(/\s+/g, ' ').trim()), rows: [...sr.querySelectorAll('.vrow')].map((e) => [e.querySelector('b').textContent, e.classList.contains('low'), !!e.querySelector('[data-act="reset"]')]) }; });
ok('Info: vasket totalt m² + fotballbaner, tid brukt dager + timer', /2[\s ]531 m²/.test(I.stats[0]) && /0,4 fotballbaner/.test(I.stats[0]) && /7 dager 19 timer/.test(I.stats[1]), I.stats);
ok('Info: vedlikehold ≤ 30 t oransje + «Nullstill» (filter, sensorer)', JSON.stringify(I.rows) === JSON.stringify([['Hovedbørste', false, false], ['Sidebørste', false, false], ['Filter', true, true], ['Sensorer', true, true]]), I.rows);
await shot(p, '4-info');
await click(p, '[data-act="tab"][data-v="kart"]');
await wait(p, 300);
const Kt = await p.evaluate(() => { const sr = window.__c.shadowRoot, m = sr.querySelector('.map'); const r = m && m.getBoundingClientRect(); return { img: m && m.querySelector('img').getAttribute('src'), ratio: r && +(r.width / r.height).toFixed(2), legend: [...sr.querySelectorAll('.legend .lg')].map((e) => e.textContent.trim()) }; });
ok('Kart: image-entiteten (3:4) + romforklaring', /image_proxy\/image\.sir_sweeps_a_lot_hjemme_andre_etasje/.test(Kt.img || '') && Kt.ratio === 0.75 && Kt.legend.length === 5, Kt);
await clear(p);
await click(p, '.legend .lg[data-k="trappegang"]');
cl = await calls(p);
ok('Kart: trykk på rom i forklaringen velger rommet', cl.includes('input_boolean toggle input_boolean.sir_sweeps_a_lot_trappegang'), cl);
await shot(p, '5-kart');
// ---------------------------------------------------------------- 26.12 · kart: touch (CDP), dobbelttrykk, hjul, grenser
const cdp = await p.context().newCDPSession(p);
const mapBox = () => p.evaluate(() => { const r = window.__c.shadowRoot.querySelector('.map').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
const mv = () => p.evaluate(() => { const c = window.__c, t = c._mv || { s: 1, x: 0, y: 0 }, m = c.shadowRoot.querySelector('.mapin'), rb = c.shadowRoot.querySelector('.mreset'); return { s: +t.s.toFixed(3), x: Math.round(t.x), y: Math.round(t.y), tf: m && m.style.transform, reset: rb && !rb.classList.contains('hid'), pop: window.__popEv }; });
const touch = async (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i + 1, radiusX: 4, radiusY: 4, force: 1 })) });
async function drag(pts0, pts1, steps = 8) {
  await touch('touchStart', pts0);
  for (let i = 1; i <= steps; i++) await touch('touchMove', pts0.map(([x, y], j) => [x + ((pts1[j][0] - x) * i) / steps, y + ((pts1[j][1] - y) * i) / steps]));
  await touch('touchEnd', []);
  await wait(p, 120);
}
const mb = await mapBox(), cx = mb.x + mb.w / 2, cy = mb.y + mb.h / 2;
const css = await p.evaluate(() => { const cs = getComputedStyle(window.__c.shadowRoot.querySelector('.map')); return { ta: cs.touchAction, ob: cs.overscrollBehaviorY || cs.overscrollBehavior, us: cs.userSelect || cs.webkitUserSelect }; });
ok('26.12 kartflate: touch-action none, overscroll contain, user-select none', css.ta === 'none' && css.ob === 'contain' && css.us === 'none', css);
await p.evaluate(() => { window.__popEv = 0; });
await drag([[cx, cy]], [[cx + 80, cy + 60]]);
const G0 = await mv();
ok('26.12 én finger ved 1×: kartet kan ikke dras ut av rammen', G0.s === 1 && G0.x === 0 && G0.y === 0 && !G0.reset, G0);
await drag([[cx - 40, cy], [cx + 40, cy]], [[cx - 100, cy], [cx + 100, cy]], 10);
const G1 = await mv();
ok('26.12 pinch med to fingre zoomer rundt midtpunktet (≈2,5×), «Tilbakestill visning» vises', G1.s > 2.2 && G1.s < 2.8 && Math.abs(G1.x - Math.round(-(mb.w / 2) * (G1.s - 1))) <= 6 && G1.reset, { G1, mb });
await drag([[cx, cy]], [[cx + 50, cy + 30]]);
const G2 = await mv();
ok('26.12 én finger panorerer', Math.abs(G2.x - G1.x - 50) <= 3 && Math.abs(G2.y - G1.y - 30) <= 3 && G2.s === G1.s, { G1, G2 });
await drag([[cx, cy]], [[cx + 900, cy + 900]], 12);
const G3 = await mv();
ok('26.12 pan begrenses (kartet kan ikke dras helt ut av rammen)', G3.x === 0 && G3.y === 0, G3);
ok('26.12 ingen touch/pointer-hendelser når popupen (ingen scroll/swipe-to-close)', G3.pop === 0, G3.pop);
await drag([[cx - 20, cy], [cx + 20, cy]], [[cx - 200, cy], [cx + 200, cy]], 10);
ok('26.12 zoom begrenses til 4×', (await mv()).s === 4, await mv());
// hass-oppdatering: transform består
const before = await mv();
await p.evaluate(() => { window.__set('sensor.sir_sweeps_a_lot_battery', '55'); window.__set('vacuum.sir_sweeps_a_lot', 'cleaning'); });
await wait(p, 300);
const after = await mv();
ok('26.12 zoom/pan overlever hass-oppdateringer', after.s === before.s && after.x === before.x && after.tf === before.tf && after.reset, { before, after });
// dobbelttrykk: zoomet → tilbakestill; 1× → zoom inn
const tapAt = async (x, y) => { await touch('touchStart', [[x, y]]); await touch('touchEnd', []); };
await p.evaluate(() => { window.__hap = []; window.addEventListener('haptic', (e) => window.__hap.push(e.detail)); });
await tapAt(cx, cy); await wait(p, 60); await tapAt(cx, cy); await wait(p, 400);
const D1 = await mv();
await tapAt(cx, cy); await wait(p, 60); await tapAt(cx, cy); await wait(p, 400);
const D2 = await mv();
const hap = await p.evaluate(() => window.__hap.length);
ok('26.12 dobbelttrykk: tilbakestill når zoomet, zoom inn (2×) ellers, haptic', D1.s === 1 && !D1.reset && D2.s === 2 && D2.reset && hap >= 2, { D1, D2, hap });
const rbInfo = await p.evaluate(() => { const b = window.__c.shadowRoot.querySelector('.mreset'), r = b.getBoundingClientRect(), m = window.__c.shadowRoot.querySelector('.map').getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), icon: b.querySelector('ha-icon').getAttribute('icon'), right: Math.round(m.right - r.right), top: Math.round(r.top - m.top) }; });
ok('26.12 reset-knapp øverst til høyre', rbInfo.w === 44 && rbInfo.h === 44 && rbInfo.icon === 'mdi:fit-to-screen' && rbInfo.right < 20 && rbInfo.top < 20, rbInfo);
await click(p, '.mreset');
await wait(p, 350);
const Rz = await mv();
ok('26.12 «Tilbakestill visning» (44×44, fit-to-screen) nullstiller', Rz.s === 1 && Rz.x === 0 && !Rz.reset, Rz);
// hjul (PC)
await p.mouse.move(cx, cy);
await p.mouse.wheel(0, -200); await wait(p, 120);
const W1 = await mv();
for (let i = 0; i < 12; i++) await p.mouse.wheel(0, -400);
await wait(p, 150);
const W2 = await mv();
ok('26.12 hjul-zoom (PC), maks 4×', W1.s > 1.2 && W2.s === 4, { W1, W2 });
await click(p, '.mreset'); await wait(p, 350);
// rom i kartet (kalibrerte rom): trykk velger, drag velger aldri
const svg = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#555"/></svg>');
await p.evaluate((svg) => window.__set('image.sir_sweeps_a_lot_hjemme_andre_etasje', 'x', { entity_picture: svg, calibration_points: [{ vacuum: { x: 0, y: 0 }, map: { x: 0, y: 0 } }, { vacuum: { x: 1000, y: 0 }, map: { x: 100, y: 0 } }, { vacuum: { x: 0, y: 1000 }, map: { x: 0, y: 100 } }], rooms: { 16: { x0: 0, y0: 0, x1: 2000, y1: 1500, name: 'Mamma' } } }), svg);
await wait(p, 600);
const MR = await p.evaluate(() => { const r = window.__c.shadowRoot.querySelector('.mimg .mr'); if (!r) return null; const b = r.getBoundingClientRect(); return { k: r.dataset.k, x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
ok('26.12 rom-lag fra kartets attributter (kalibrering)', MR && MR.k === 'mamma_soverom', MR);
if (MR) {
  await clear(p);
  await drag([[MR.x, MR.y]], [[MR.x + 40, MR.y + 30]]);
  await wait(p, 400);
  const c1 = await calls(p);
  await tapAt(MR.x, MR.y); await wait(p, 450);
  const c2 = await calls(p);
  ok('26.12 trykk på rom i kartet velger rommet, drag gjør det aldri', c1.length === 0 && c2.includes('input_boolean toggle input_boolean.sir_sweeps_a_lot_mamma_soverom'), { c1, c2 });
}
await shot(p, '5b-kart-rom');
await cdp.detach();
// ---------------------------------------------------------------- Tilpass (tannhjul)
await click(p, '[data-act="tab"][data-v="renhold"]');
await click(p, '.gear');
await wait(p, 500);
const E1 = await p.evaluate(() => { const portal = window.MSH.portals().pop(), ed = portal && portal.shadowRoot.querySelector('msh-editor'); if (!ed) return null; const R = ed.shadowRoot; return { tabs: [...R.querySelectorAll('.chips.tabs [role="tab"]')].map((t) => t.getAttribute('aria-label') || t.textContent.trim()), rooms: [...R.querySelectorAll('.vroom')].map((e) => e.dataset.edk), zones: R.querySelectorAll('.vzone').length, hdl: R.querySelector('.vroom [data-edrag]') && getComputedStyle(R.querySelector('.vroom [data-edrag]')).touchAction }; });
ok('Tilpass: Rom/Faner/Entiteter/Avansert, rom- og sone-lister med dra-håndtak (touch-action none)', E1 && E1.tabs.join('|') === 'Rom|Faner|Entiteter|Avansert' && E1.rooms.length === 5 && E1.zones === 5 && E1.hdl === 'none', E1);
if (shots) await p.screenshot({ path: `${shots}/rolf-6-tilpass-rom.png` });
// dra Trapp (5) over Soverom (1) → room_order, og kortet oppdateres straks
const D = await p.evaluate(async () => {
  const portal = window.MSH.portals().pop(), ed = portal.shadowRoot.querySelector('msh-editor'), R = ed.shadowRoot;
  const from = R.querySelector('.vroom[data-edk="trappegang"] [data-edrag]'), to = R.querySelector('.vroom[data-edk="sebsatian_soverom"]');
  const fr = from.getBoundingClientRect(), tr = to.getBoundingClientRect();
  const ev = (t, el, x, y) => el.dispatchEvent(new PointerEvent(t, { bubbles: true, composed: true, cancelable: true, pointerId: 7, clientX: x, clientY: y, button: 0 }));
  ev('pointerdown', from, fr.left + 5, fr.top + 5);
  ev('pointermove', from, fr.left + 5, tr.top + 10);
  ev('pointerup', from, fr.left + 5, tr.top + 10);
  await new Promise((q) => setTimeout(q, 300));
  return { order: ed._config.room_order, card: [...window.__c.shadowRoot.querySelectorAll('.rt .rn')].map((e) => e.textContent) };
});
ok('dra-og-slipp rom → room_order, romgridet endres umiddelbart', Array.isArray(D.order) && D.order[0] === 'trappegang' && D.card[0] === 'Trapp', D);
// skjul Kontor + gi farge + skjul sone
const S = await p.evaluate(async () => {
  const portal = window.MSH.portals().pop(), ed = portal.shadowRoot.querySelector('msh-editor'), R = ed.shadowRoot;
  R.querySelector('.vroom[data-edk="pappa_kontor"] [data-op="reye"]').click(); await new Promise((q) => setTimeout(q, 150));
  R.querySelector('.vroom[data-edk="mamma_soverom"] [data-op="col"]').click(); await new Promise((q) => setTimeout(q, 150));
  R.querySelector('.vzone [data-op="zeye"]').click(); await new Promise((q) => setTimeout(q, 250));
  const sr = window.__c.shadowRoot;
  return { rooms: ed._config.rooms, card: [...sr.querySelectorAll('.rt .rn')].map((e) => e.textContent), zones: sr.querySelectorAll('.zc').length };
});
ok('Rom: skjul rom/sone og bytt farge → kortet oppdateres straks', S.rooms.pappa_kontor.hidden === true && !!S.rooms.mamma_soverom.color && !S.card.includes('Kontor') && S.zones === 4, S);
// Faner: skjul Info, stil Navn
const F = await p.evaluate(async () => {
  const portal = window.MSH.portals().pop(), ed = portal.shadowRoot.querySelector('msh-editor'), R = ed.shadowRoot;
  [...R.querySelectorAll('[data-a="tab"]')].find((t) => t.dataset.v === 'faner').click(); await new Promise((q) => setTimeout(q, 150));
  const rows = [...R.querySelectorAll('.vtab')].map((e) => e.dataset.edk);
  R.querySelector('.vtab[data-edk="info"] [data-op="eye"]').click(); await new Promise((q) => setTimeout(q, 150));
  R.querySelector('.vtab[data-edk="kontroll"] [data-op="exp"]').click(); await new Promise((q) => setTimeout(q, 150));
  const parts = [...R.querySelectorAll('.vpart')].map((e) => e.textContent.trim());
  [...R.querySelectorAll('[data-a="sel"][data-name="tab_labels"]')].find((b) => b.dataset.v === 'name').click(); await new Promise((q) => setTimeout(q, 250));
  const sr = window.__c.shadowRoot;
  return { rows, parts, cfg: ed._config, tabs: [...sr.querySelectorAll('.tabs [data-act="tab"]')].map((t) => t.textContent.trim()) };
});
ok('Faner: dra-liste, innhold per fane, skjul/stil → kortet oppdateres straks', F.rows.join('|') === 'renhold|kontroll|info|kart' && F.parts.length === 5 && (F.cfg.tab_hidden || []).includes('info') && F.tabs.join('|') === 'Renhold|Kontroll|Kart', F);
if (shots) await p.screenshot({ path: `${shots}/rolf-7-tilpass-faner.png` });
// Entiteter: standard-entitetene vises som automatisk valg
const En = await p.evaluate(async () => {
  const portal = window.MSH.portals().pop(), ed = portal.shadowRoot.querySelector('msh-editor'), R = ed.shadowRoot;
  [...R.querySelectorAll('[data-a="tab"]')].find((t) => t.dataset.v === 'entiteter').click(); await new Promise((q) => setTimeout(q, 250));
  const pk = [...R.querySelectorAll('msh-entity-picker')];
  return { n: pk.length, vac: pk.find((x) => x.dataset.name === 'entities.vacuum') && pk.find((x) => x.dataset.name === 'entities.vacuum').getAttribute('auto'), empty: pk.find((x) => x.dataset.name === 'entities.empty') && pk.find((x) => x.dataset.name === 'entities.empty').getAttribute('auto'), mopi: pk.find((x) => x.dataset.name === 'entities.mop_intensity') && pk.find((x) => x.dataset.name === 'entities.mop_intensity').getAttribute('auto') };
});
ok('Entiteter: søkevelger per felt, standard + prefiks-autofunn', En.n >= 20 && En.vac === 'vacuum.sir_sweeps_a_lot' && En.empty === 'script.rolf_empty' && En.mopi === 'select.sir_sweeps_a_lot_mop_intensity', En);
if (shots) await p.screenshot({ path: `${shots}/rolf-8-tilpass-entiteter.png` });
// Avansert: bekreft før start → Ferdig
const Av = await p.evaluate(async () => {
  const portal = window.MSH.portals().pop(), ed = portal.shadowRoot.querySelector('msh-editor'), R = ed.shadowRoot;
  [...R.querySelectorAll('[data-a="tab"]')].find((t) => t.dataset.v === 'avansert').click(); await new Promise((q) => setTimeout(q, 150));
  const labels = R.textContent;
  R.querySelector('[data-a="bool"][data-name="confirm_start"]').click(); await new Promise((q) => setTimeout(q, 150));
  R.querySelector('[data-a="save"]').click(); await new Promise((q) => setTimeout(q, 900));
  return { labels: ['Bekreft før start', 'Tøm automatisk', 'Tilbakestill til standard', 'Mellom seksjonene'].filter((l) => labels.includes(l)).length, cfg: window.__c.config };
});
ok('Avansert: bekreft/tøm automatisk/tilbakestill/mellomrom; Ferdig lagrer i kortets config', Av.labels === 4 && Av.cfg.confirm_start === true && (Av.cfg.tab_hidden || []).includes('info') && Av.cfg.room_order[0] === 'trappegang', Av);
await p.evaluate(() => window.__set('vacuum.sir_sweeps_a_lot', 'docked'));
await wait(p, 300);
await clear(p);
await click(p, '.gobtn');
await wait(p, 100);
const armed = await p.evaluate(() => window.__c.shadowRoot.querySelector('.gobtn .gt b').textContent.trim());
const c0 = (await calls(p)).length;
await click(p, '.gobtn');
cl = await calls(p);
ok('bekreft før start: første trykk ber om nytt trykk, andre starter', armed === 'Trykk igjen for å starte' && c0 === 0 && cl.includes('script turn_on script.start_sir_sweeps_a_lot_room_select'), { armed, cl });
await p.close();

// ---------------------------------------------------------------- GUI-editoren (samme skjema)
const g = await page();
const G = await g.evaluate(async () => {
  const cls = customElements.get('msh-stovsuger-card');
  const stub = cls.getStubConfig();
  const ed = cls.getConfigElement(); document.body.appendChild(ed); ed.hass = window.__h; ed.setConfig({ type: 'custom:msh-stovsuger-card', ...stub });
  await new Promise((q) => setTimeout(q, 300));
  let got = null; ed.addEventListener('config-changed', (e) => { got = e.detail.config; });
  const R = ed.shadowRoot;
  const tabs = [...R.querySelectorAll('.chips.tabs [role="tab"]')].map((t) => t.getAttribute('aria-label') || t.textContent.trim());
  R.querySelector('.vroom[data-edk="trappegang"] [data-op="reye"]').click(); await new Promise((q) => setTimeout(q, 150));
  return { tabs, stub, got: got && got.rooms };
});
ok('GUI-editor: samme fire faner; getStubConfig har brukerens standard-entiteter', G.tabs.join('|') === 'Rom|Faner|Entiteter|Avansert' && G.stub.entities.vacuum === 'vacuum.sir_sweeps_a_lot' && G.stub.entities.tank === 'binary_sensor.sir_sweeps_a_lot_water_shortage' && G.stub.name === 'Sir Sweeps', G);
ok('GUI-editor: endring sendes som config-changed', G.got && G.got.trappegang && G.got.trappegang.hidden === true, G.got);
await g.close();

// ---------------------------------------------------------------- uten entiteter → «–»
const n = await page({ entities: { vacuum: 'vacuum.finnes_ikke', map: 'none', tank: 'none' } });
const N = await n.evaluate(async () => { const sr = window.__c.shadowRoot; const o = { hero: !!sr.querySelector('.hero'), pill: sr.querySelector('.spill').textContent.trim(), bat: sr.querySelector('.bv').textContent, pick: !!sr.querySelector('.hero .pick'), tank: !!sr.querySelector('.tank') }; sr.querySelector('[data-act="tab"][data-v="kart"]').click(); await new Promise((q) => setTimeout(q, 300)); o.map = sr.querySelector('.miss') && sr.querySelector('.miss').textContent.replace(/\s+/g, ' ').trim(); return o; });
ok('uten entiteter: toppkortet vises med «–» + «Velg entitet», ingen mock', N.hero && N.pill === '–' && N.bat === '–' && N.pick && !N.tank && /–\s*·\s*Velg entitet/.test(N.map || ''), N);
await n.close();

// ---------------------------------------------------------------- popup-registrering
const r = await page();
const P = await r.evaluate(() => {
  const M = window.MSH, h = window.__h;
  const fn = M.FUNCTION_POPUPS.find((x) => x[0] === '#rolf');
  const tpl = M.popupTemplateA({ name: 'Sir Sweeps', icon: 'mdi:robot-vacuum', hash: '#rolf', card: { type: 'custom:msh-stovsuger-card', card_id: 'pop-rolf' } });
  const forced = M.POPUP_FORCE['#rolf']({ ...tpl, sub_button: { main: [], bottom: [] } });
  const own = M.POPUP_FORCE['#rolf']({ ...tpl, sub_button: { main: [{ entity: 'vacuum.x' }], bottom: [] } });
  const noVac = { ...h, states: Object.fromEntries(Object.entries(h.states).filter(([k]) => !k.startsWith('vacuum.'))) };
  const sup = M.POPUP_SUPERSEDE['#rolf'].test({ cards: [{ type: 'custom:gap-card' }, { type: 'custom:ki-robot-card', modell: 'stovsuger', entity: 'vacuum.sir_sweeps_a_lot' }] });
  return { fn, tplSub: tpl.sub_button, forced: forced && forced.sub_button, own, needs: [M.popupNeeds['#rolf'](h), M.popupNeeds['#rolf'](noVac)], sup, all: M.allPopups(h).some((x) => x.hash === '#rolf'), allNo: M.allPopups(noVac).some((x) => x.hash === '#rolf') };
});
ok('FUNCTION_POPUPS: #rolf → msh-stovsuger-card, Sir Sweeps, mdi:robot-vacuum', P.fn && P.fn.join('|') === '#rolf|Sir Sweeps|mdi:robot-vacuum|msh-stovsuger-card', P.fn);
ok('Bubble-header: sub_button med vacuum state + batteri (mal og FORCE), egen sub_button beholdes', P.tplSub.main[0].entity === 'vacuum.sir_sweeps_a_lot' && P.tplSub.main[0].state_content.join() === 'state,battery_level' && P.forced && P.forced.main.length === 1 && P.own === null, P);
ok('vilkår: bare når vacuum.* finnes', P.needs.join() === 'true,false' && P.all && !P.allNo, P);
ok('importert #rolf (ki-robot-card) erstattes av Sir Sweeps', P.sup === true, P.sup);
await r.close();

// PC-bredde: fyller bredden
const w = await page(null, { width: 1400, height: 900 });
const W = await w.evaluate(() => { const c = window.__c, hero = c.shadowRoot.querySelector('.hero'); return [Math.round(c.getBoundingClientRect().width), Math.round(hero.getBoundingClientRect().width), Math.round(c.parentElement.getBoundingClientRect().width - 36)]; });
ok('PC: kortet og toppkortet fyller popup-bredden', W[0] === W[1] && W[0] === W[2], W);
await shot(w, '9-pc');
await w.close();

ok('ingen sidefeil', !errs.length, errs);
await b.close();
for (const [k, v] of Object.entries(res)) console.log(v === 'OK' ? 'OK  ' : 'FEIL', k, v === 'OK' ? '' : JSON.stringify(v[1]).slice(0, 600));
console.log(fail.length ? `\n${fail.length} feil` : '\nAlt OK');
try { (await import('node:fs')).unlinkSync(bundle); } catch (e) { /* */ }
process.exit(fail.length ? 1 : 0);
