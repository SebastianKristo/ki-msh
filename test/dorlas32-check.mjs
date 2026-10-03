// Fiks 32.1 + 32.3 · Dørlås (#dorlas, msh-las-card) – «Sjekk før levering» (uavhengig av dato/klokkeslett).
//   node test/dorlas32-check.mjs            (SHOTS=<mappe> gir skjermbilder)
import { createRequire } from 'node:module';
import { readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const bundle = resolve(`test/.build/dorlas32-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const shots = process.env.SHOTS || '';
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const res = {}, fail = [];
const ok = (name, cond, info) => { res[name] = cond ? 'OK' : ['FEIL', info]; if (!cond) fail.push(name); };
const mocks = readdirSync('test/mock').sort().map((m) => resolve('test/mock/' + m));
const errs = [];
// Popup med kortet. prep = JS som kjøres før mockHass() (window.mockLas(n), mockLasBrytere()). open=false: popupen er lukket.
async function mount({ vp, cfg = {}, prep = '', open = true, id = 'pop-dorlas' } = {}) {
  const p = await b.newPage({ viewport: vp || { width: 390, height: 1400 }, hasTouch: true, isMobile: !!(vp && vp.mobile) });
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + resolve('test/harness.html'));
  for (const m of mocks) await p.addScriptTag({ path: m });
  await p.addScriptTag({ path: bundle });
  await p.evaluate(async ({ cfg, prep, open, id }) => {
    try { localStorage.clear(); } catch (e) { /* */ }
    if (prep) (0, eval)(prep);
    window.__h = window.mockHass();
    const bc = document.createElement('bubble-card');
    bc.setConfig({ type: 'custom:bubble-card', card_type: 'pop-up', hash: '#dorlas' });
    bc.innerHTML = '<div class="pop" style="top:0"><div class="hdr">Dørlås</div><div class="inner"></div></div>';
    document.getElementById('dash').appendChild(bc);
    // Bubble Card lukker ved dra ned: tell alt som når popup-flaten (skal være 0 når sporet dras)
    window.__reach = 0;
    ['touchstart', 'touchmove', 'pointerdown', 'pointermove'].forEach((t) => bc.querySelector('.pop').addEventListener(t, () => { window.__reach++; }, { passive: true }));
    location.hash = open ? '#dorlas' : '#annet';
    const c = document.createElement('msh-las-card');
    c.setConfig({ type: 'custom:msh-las-card', card_id: id, ...cfg });
    c.hass = window.__h;
    bc.querySelector('.inner').appendChild(c);
    window.__c = c;
    await new Promise((q) => setTimeout(q, 700));
  }, { cfg, prep, open, id });
  return p;
}
const wait = (p, ms) => p.evaluate((ms) => new Promise((q) => setTimeout(q, ms)), ms);
const sel = (p, id) => p.evaluate(async (id) => { window.__c.setUI({ sel: id }); await new Promise((q) => setTimeout(q, 250)); }, id);
const info = (p) => p.evaluate(() => {
  const c = window.__c, sr = c.shadowRoot, q = (s) => sr.querySelector(s), qa = (s) => [...sr.querySelectorAll(s)], r = (e) => e && e.getBoundingClientRect();
  const host = c.parentElement, hcs = getComputedStyle(host);
  return {
    width: Math.round(r(c).width), host: Math.round(host.clientWidth - parseFloat(hcs.paddingLeft) - parseFloat(hcs.paddingRight)), vw: innerWidth,
    cards: [...host.children].length, hero: !!q('.sk-hero') && r(q('.sk-hero')).height > 100,
    picks: qa('.sk-pc').map((e) => ({ name: e.querySelector('.sk-pcn').textContent, cut: e.querySelector('.sk-pcn').scrollWidth > e.querySelector('.sk-pcn').clientWidth + 1, w: Math.round(r(e).width), h: Math.round(r(e).height), on: e.classList.contains('on'), sh: getComputedStyle(e).boxShadow })),
    mode: q('.sk-prow') ? [...q('.sk-prow').classList].filter((x) => x !== 'sk-prow').join() : 'none', snap: q('.sk-prow') ? getComputedStyle(q('.sk-prow')).scrollSnapType : '', mask: q('.sk-prow') ? getComputedStyle(q('.sk-prow')).maskImage || getComputedStyle(q('.sk-prow')).webkitMaskImage : '',
    gear: q('.sk-gear') && { w: Math.round(r(q('.sk-gear')).width), right: Math.round(r(q('.sk-gear')).right), left: Math.round(r(q('.sk-gear')).left), bg: getComputedStyle(q('.sk-gear')).backgroundColor },
    state: q('.sk-hstate') && q('.sk-hstate').textContent, sub: q('.sk-hsub') && q('.sk-hsub').textContent, name: q('.sk-hname') && q('.sk-hname').textContent, chip: q('.sk-chip') && q('.sk-chip').textContent.trim(),
    badge: q('.sk-badge') && { w: Math.round(r(q('.sk-badge')).width), spin: q('.sk-badge').classList.contains('spin') },
    track: q('.lk-track') && { h: Math.round(r(q('.lk-track')).height), ta: getComputedStyle(q('.lk-track')).touchAction, label: q('.lk-label').textContent, cls: q('.lk-track').className, f: q('.lk-track').style.getPropertyValue('--f'), shim: getComputedStyle(q('.lk-label')).animationName, nudge: getComputedStyle(q('.lk-knob')).animationName },
    tiles: qa('.sk-tile').map((e) => e.querySelector('.sk-tv').textContent + '|' + e.querySelector('.sk-tl').textContent),
    heroBox: q('.sk-hero') && { r: getComputedStyle(q('.sk-hero')).borderRadius, bg: getComputedStyle(q('.sk-hero')).backgroundColor }, stateFont: q('.sk-hstate') && [getComputedStyle(q('.sk-hstate')).fontSize, getComputedStyle(q('.sk-hstate')).fontWeight],
    auto: q('.sk-auto') && { open: !!q('.sk-alist'), sub: q('.sk-ats').textContent, master: q('.sk-master').classList.contains('on'), rows: qa('.sk-ar').map((e) => e.querySelector('.sk-arl').textContent + (e.querySelector('.sk-sw.on') ? ':på' : e.querySelector('.sk-sw') ? ':av' : ':–')), op: q('.sk-alist') ? getComputedStyle(q('.sk-alist')).opacity : null, pe: q('.sk-alist') ? getComputedStyle(q('.sk-alist')).pointerEvents : null, chev: q('.sk-chev') && q('.sk-chev').classList.contains('up'), rowH: q('.sk-atog') && Math.round(r(q('.sk-atog')).height), mins: qa('.sk-mins button').map((e) => e.textContent + (e.classList.contains('on') ? '*' : '')) },
    hist: q('.sk-hist') && { sum: q('.sk-hs').textContent, filters: qa('.sk-fc').map((e) => e.textContent.trim().replace(/\s+/g, ' ') + (e.classList.contains('on') ? '*' : '') + (e.classList.contains('warn') ? '!' : '')), days: qa('.sk-dl').map((e) => e.textContent), rows: qa('.sk-hr').map((e) => e.querySelector('.sk-htt').textContent + ' | ' + (e.querySelector('.sk-hm') ? e.querySelector('.sk-hm').textContent.trim().replace(/\s+/g, ' ') : '')), avatars: qa('.sk-av').map((e) => e.textContent), more: q('.sk-more') && q('.sk-more').textContent.trim(), none: q('.sk-hnone') && q('.sk-hnone').textContent },
    sections: qa('.sk-wrap > *').map((e) => e.className.split(' ')[0]),
  };
});
const calls = (p, dom) => p.evaluate((dom) => window.__calls.filter((c) => c[0] === dom).map((c) => [c[1], c[2] && c[2].entity_id]), dom);
const clearCalls = (p) => p.evaluate(() => { window.__calls.length = 0; window.__reach = 0; });

/* ---------------------------------------------------------------- åpnes, fyller bredden, ett kort, toppkortet, rekkefølge */
let p = await mount({ prep: 'window.mockLasBrytere()' });
let I = await info(p);
ok('32.1 fyller bredden (ett kort i popupen)', Math.abs(I.width - I.host) <= 1 && I.cards === 1, [I.width, I.host, I.cards]);
ok('32.1 toppkortet synlig (r 28, #3a3a3a, tilstand 44/300)', I.hero && I.heroBox.r === '28px' && I.heroBox.bg === 'rgb(58, 58, 58)' && I.stateFont[0] === '44px' && I.stateFont[1] === '300', [I.heroBox, I.stateFont]);
ok('32.1 rekkefølge: velger → toppkort → status → automatikk → historikk', I.sections.join() === 'sk-pick,sk-hero,sk-tiles,sk-auto,sk-hist', I.sections);
if (shots) await p.screenshot({ path: shots + '/dorlas-2.png', fullPage: true });

/* ---------------------------------------------------------------- velger med 2 låser */
ok('32.1 2 låser: kortene deler bredden, 56 px, ingen navn kuttet', I.picks.length === 2 && I.picks.every((x) => x.h === 56 && !x.cut) && /^(eq|fit)$/.test(I.mode), [I.mode, I.picks]);
ok('32.1 valgt kort #404040 + rosa kant 1.5 px', I.picks.some((x) => x.on && /242, 133, 201/.test(x.sh)), I.picks);
ok('32.1 tannhjul 56 px fast til høyre, synlig', I.gear && I.gear.w === 56 && I.gear.right <= I.vw && I.gear.bg === 'rgb(58, 58, 58)', I.gear);

/* ---------------------------------------------------------------- toppkortet, chip og sporet (låst lås) */
await sel(p, 'lock.inngangsdor');
I = await info(p);
ok('32.1 låst: «Låst», chip «Sikret», «Låst av … · tid», badge 56', I.state === 'Låst' && I.chip === 'Sikret' && /^Låst av .+ · /.test(I.sub) && I.badge.w === 56 && !I.badge.spin, [I.state, I.chip, I.sub, I.badge]);
ok('32.1 sporet 64 px, touch-action none, «Dra for å låse opp» med shimmer + dytt', I.track.h === 64 && I.track.ta === 'none' && I.track.label === 'Dra for å låse opp' && I.track.shim === 'lk-shimmer' && I.track.nudge === 'lk-nudge', I.track);
ok('32.1 statusfliser: Dør, Batteri, Autolås', I.tiles.length === 3 && /\|Dør$/.test(I.tiles[0]) && I.tiles[0].startsWith('Lukket') && /\|Batteri$/.test(I.tiles[1]) && /\|Autolås$/.test(I.tiles[2]), I.tiles);

/* ---------------------------------------------------------------- dra for å låse opp (touch, iPhone + iPad) */
async function touchDrag(p, frac) {
  const box = await p.evaluate(() => { const r = window.__c.shadowRoot.querySelector('.lk-track').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  const cdp = await p.context().newCDPSession(p);
  const y = box.y + box.h / 2, x0 = box.x + 32, x1 = box.x + 32 + (box.w - 64) * frac;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y }] });
  for (let i = 1; i <= 12; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + (x1 - x0) * i / 12, y: y + i }] }); await new Promise((q) => setTimeout(q, 16)); }
  const mid = await p.evaluate(() => window.__c.shadowRoot.querySelector('.lk-track').style.getPropertyValue('--f'));
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await new Promise((q) => setTimeout(q, 350));
  return Number(mid);
}
for (const dev of [{ n: 'iPhone', vp: { width: 390, height: 844, mobile: true } }, { n: 'iPad', vp: { width: 820, height: 1180, mobile: true } }]) {
  const q = await mount({ vp: dev.vp });
  await sel(q, 'lock.inngangsdor');
  await clearCalls(q);
  const fHalf = await touchDrag(q, 0.5);
  const half = await calls(q, 'lock'), halfReach = await q.evaluate(() => window.__reach), Ih = await info(q);
  ok(`32.1 ${dev.n}: halvveis dra → ingen opplåsing, knotten tilbake`, fHalf > 0.3 && fHalf < 0.7 && half.length === 0 && Ih.track.f === '0', [fHalf, half, Ih.track.f]);
  await clearCalls(q);
  const fFull = await touchDrag(q, 1);
  const full = await calls(q, 'lock'), reach = await q.evaluate(() => window.__reach), I2 = await info(q);
  ok(`32.1 ${dev.n}: dra helt til høyre (≥ 92 %) → lock.unlock`, fFull >= 0.92 && full.length === 1 && full[0][0] === 'unlock' && full[0][1] === 'lock.inngangsdor', [fFull, full]);
  ok(`32.1 ${dev.n}: popupen får ingen touch/pointer-hendelser (lukkes ikke)`, reach === 0 && halfReach === 0, [halfReach, reach]);
  ok(`32.1 ${dev.n}: optimistisk «Låser opp …», chip Jobber, badge snurrer`, I2.state === 'Låser opp …' && I2.chip === 'Jobber' && I2.badge.spin && I2.sub === 'Venter på låsen', [I2.state, I2.chip, I2.badge]);
  if (shots) await q.screenshot({ path: `${shots}/dorlas-${dev.n}.png` });
  await q.close();
}

/* ---------------------------------------------------------------- tilbakerulling etter 10 s (27.6, forkortet), success når låsen svarer */
const rb = await mount();
await sel(rb, 'lock.inngangsdor');
const RB = await rb.evaluate(async () => {
  const M = window.MSH, c = window.__c, w = (ms) => new Promise((q) => setTimeout(q, ms));
  M.sik.SYNC_MS = 400;
  let hs = []; window.addEventListener('haptic', (e) => hs.push(e.detail));
  c._unlock('lock.inngangsdor'); await w(100);
  const during = c.shadowRoot.querySelector('.sk-hstate').textContent;
  await w(600);
  const after = c.shadowRoot.querySelector('.sk-hstate').textContent, warn = hs.includes('warning');
  hs = [];
  c._unlock('lock.inngangsdor'); await w(100);
  const S = window.__h.states; window.__h = { ...window.__h, states: { ...S, 'lock.inngangsdor': { ...S['lock.inngangsdor'], state: 'unlocked', last_changed: new Date().toISOString() } } };
  c.hass = window.__h; await w(250);
  return { during, after, warn, done: c.shadowRoot.querySelector('.sk-hstate').textContent, success: hs.includes('success'), medium: hs.includes('medium') };
});
ok('32.1 optimistisk UI: «Låser opp …» → tilbakerullet (warning) uten svar', RB.during === 'Låser opp …' && RB.after === 'Låst' && RB.warn, RB);
ok('32.3 haptic: medium ved lås opp, success når låsen svarer', RB.medium && RB.success && RB.done === 'Ulåst', RB);
const R2 = await rb.evaluate(async () => { const c = window.__c; window.__calls.length = 0; c.shadowRoot.querySelector('.lk-track').click(); await new Promise((q) => setTimeout(q, 200)); return { calls: window.__calls.filter((x) => x[0] === 'lock').map((x) => x[1]), state: c.shadowRoot.querySelector('.sk-hstate').textContent }; });
ok('32.1 ulåst: ett trykk på sporet låser («Låser …»)', R2.calls.join() === 'lock' && R2.state === 'Låser …', R2);
await rb.close();

/* ---------------------------------------------------------------- Hold og Trykk */
const ph = await mount({ cfg: { unlock: 'hold' } });
await sel(ph, 'lock.inngangsdor');
const H1 = await ph.evaluate(() => window.__c.shadowRoot.querySelector('.lk-label').textContent);
const tb = await ph.evaluate(() => { const r = window.__c.shadowRoot.querySelector('.lk-track').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
await clearCalls(ph);
await ph.mouse.move(tb.x, tb.y); await ph.mouse.down(); await wait(ph, 350); await ph.mouse.up(); await wait(ph, 200);
const hShort = await calls(ph, 'lock');
await ph.mouse.down(); await wait(ph, 450);
const hMid = await ph.evaluate(() => Number(window.__c.shadowRoot.querySelector('.lk-track').style.getPropertyValue('--f')));
await wait(ph, 700); await ph.mouse.up(); await wait(ph, 200);
const hLong = await calls(ph, 'lock');
ok('32.1 Hold: «Hold for å låse opp», sporet fylles, 0,9 s låser opp – kort hold gjør ingenting', H1 === 'Hold for å låse opp' && hShort.length === 0 && hMid > 0.3 && hMid < 0.8 && hLong.length === 1 && hLong[0][0] === 'unlock', [H1, hShort, hMid, hLong]);
await ph.close();
const pt = await mount({ cfg: { unlock: 'trykk' } });
await sel(pt, 'lock.inngangsdor');
await clearCalls(pt);
const T1 = await pt.evaluate(() => window.__c.shadowRoot.querySelector('.lk-label').textContent);
await pt.evaluate(() => window.__c.shadowRoot.querySelector('.lk-track').click()); await wait(pt, 200);
const tc = await calls(pt, 'lock');
ok('32.1 Trykk: «Trykk for å låse opp», ett trykk låser opp', T1 === 'Trykk for å låse opp' && tc.length === 1 && tc[0][0] === 'unlock', [T1, tc]);
await pt.close();

/* ---------------------------------------------------------------- PIN når låsen krever kode */
const pp = await mount({ cfg: { unlock: 'trykk' } });
await sel(pp, 'lock.bod');
const PIN = await pp.evaluate(async () => { const S = window.__h.states; window.__h = { ...window.__h, states: { ...S, 'lock.bod': { ...S['lock.bod'], state: 'locked' } } }; window.__c.hass = window.__h; await new Promise((q) => setTimeout(q, 250)); window.__c.shadowRoot.querySelector('.lk-track').click(); await new Promise((q) => setTimeout(q, 250)); const pad = window.MSH.portals().find((x) => x.shadowRoot.querySelector('.keys')); return !!pad; });
ok('32.1 lås med code_format → PIN-tastatur (portalt ut av popupen)', PIN, PIN);
await pp.close();

/* ---------------------------------------------------------------- velger med 1 og 4 låser */
const p1 = await mount({ prep: 'window.mockLas(1)' });
const I1 = await info(p1);
ok('32.1 1 lås: ingen velger, bare tannhjulet (høyrestilt)', I1.picks.length === 0 && I1.mode === 'none' && I1.gear && Math.abs(I1.gear.right - (I1.vw - 18)) <= 2, [I1.mode, I1.gear]);
await p1.close();
const p4 = await mount({ prep: 'window.mockLas(4)' });
const I4 = await info(p4);
ok('32.1 4 låser: raden scroller (≥ 164 px, scroll-snap, fade mot høyre), ingen navn kuttet', I4.picks.length === 4 && I4.mode === 'many' && I4.picks.every((x) => x.w >= 164 && !x.cut) && /x mandatory/.test(I4.snap) && /linear-gradient/.test(I4.mask), [I4.mode, I4.picks, I4.snap, I4.mask]);
ok('32.1 4 låser: tannhjulet alltid synlig', I4.gear && I4.gear.right <= I4.vw && I4.gear.left > I4.vw / 2, I4.gear);
if (shots) await p4.screenshot({ path: shots + '/dorlas-4.png' });
await p4.close();

/* ---------------------------------------------------------------- automatikk */
I = await info(p);
ok('32.1 automatikk lukket som standard, rad 72 px, «3 av 4 på · autolås …»', I.auto && !I.auto.open && I.auto.rowH === 72 && /^3 av 4 på/.test(I.auto.sub), I.auto);
const A1 = await p.evaluate(async () => {
  const c = window.__c, M = window.MSH, A = M.lasAutos(window.__h, c.config);
  c.shadowRoot.querySelector('.sk-atog').click(); await new Promise((q) => setTimeout(q, 250));
  return { A, ui: JSON.parse(localStorage.getItem('ki:pop-dorlas:ui') || '{}') };
});
I = await info(p);
ok('32.1 kilde: KI Varslinger og sikkerhet (finnBrytere: Autolås, Lås når alle drar, Nattlås, Fastkjørt lås)', A1.A.auto === 'switch.autolas_aktivert' && A1.A.away === 'switch.las_nar_alle_drar' && A1.A.night === 'switch.nattlas' && /fastkjort/.test(A1.A.jam), A1.A);
ok('32.1 utfoldet: Autolås (1/2/5/10 min), Lås når alle drar, Nattlås, Varsle ved fastkjørt lås · pil roterer', I.auto.open && I.auto.chev && I.auto.rows.join() === 'Autolås:på,Lås når alle drar:på,Nattlås:av,Varsle ved fastkjørt lås:på' && I.auto.mins.join() === '1 min,2 min*,5 min,10 min', I.auto);
ok('32.1 utfoldingen huskes per kort (ui amOpen)', A1.ui.amOpen === true, A1.ui);
await clearCalls(p);
await p.evaluate(async () => { window.__c.shadowRoot.querySelector('.sk-master').click(); await new Promise((q) => setTimeout(q, 250)); });
I = await info(p);
const offCalls = await calls(p, 'homeassistant');
ok('32.1 hovedbryter av: slår alle av, demper radene (.4, ingen trykk), utfoldingen uendret', !I.auto.master && I.auto.open && I.auto.op === '0.4' && I.auto.pe === 'none' && /^Av · ingen automatikk kjører$/.test(I.auto.sub) && offCalls.length === 3 && offCalls.every((x) => x[0] === 'turn_off'), [I.auto, offCalls]);
ok('32.1 hovedbryter av: valgene beholdes (dempet)', I.auto.rows.join() === 'Autolås:på,Lås når alle drar:på,Nattlås:av,Varsle ved fastkjørt lås:på', I.auto.rows);
await clearCalls(p);
await p.evaluate(async () => { window.__c.shadowRoot.querySelector('.sk-master').click(); await new Promise((q) => setTimeout(q, 250)); });
I = await info(p);
const onCalls = await calls(p, 'homeassistant');
ok('32.1 hovedbryter på: de samme tre slås på igjen', I.auto.master && I.auto.op === '1' && onCalls.length === 3 && onCalls.every((x) => x[0] === 'turn_on') && onCalls.map((x) => x[1]).sort().join() === offCalls.map((x) => x[1]).sort().join() && onCalls.some((x) => x[1] === 'switch.las_nar_alle_drar'), onCalls);
const reopen = await p.evaluate(async () => { const c2 = document.createElement('msh-las-card'); c2.setConfig({ type: 'custom:msh-las-card', card_id: 'pop-dorlas' }); c2.hass = window.__h; document.querySelector('.inner').appendChild(c2); await new Promise((q) => setTimeout(q, 400)); const o = !!c2.shadowRoot.querySelector('.sk-alist'); c2.remove(); return o; });
ok('32.1 nytt kort med samme card_id åpner utfoldet', reopen, reopen);
await clearCalls(p);
await p.evaluate(async () => { window.__c.shadowRoot.querySelector('.sk-mins button[data-v="5"]').click(); await new Promise((q) => setTimeout(q, 150)); });
const mc = await p.evaluate(() => window.__calls.filter((c) => c[0] === 'number').map((c) => [c[1], c[2].entity_id, c[2].value]));
ok('32.1 Autolås 5 min → number.set_value', mc.length === 1 && mc[0][0] === 'set_value' && mc[0][2] === 5, mc);

/* ---------------------------------------------------------------- historikk (logbook bare når popupen er åpen) */
I = await info(p);
ok('32.1 historikk: «3 opplåsinger i dag», filtre med riktige tall, Varsler rød', I.hist.sum === '3 opplåsinger i dag' && I.hist.filters.join() === 'Alle10*,Låst4,Opplåst4,Varsler1!', I.hist);
ok('32.1 gruppert per dag (I dag først), 6 hendelser + «Vis 4 til»', I.hist.days[0] === 'I dag' && I.hist.rows.length === 6 && I.hist.more === 'Vis 4 til', I.hist);
ok('32.1 person + metode: «Sebastian · Kode» (code_slot/method) med initial, «Autolås»/«Alle dro» fra automasjonen, dør åpnet = Sensor', I.hist.rows.some((r) => /^Låst opp \| S ?Sebastian · Kode/.test(r)) && I.hist.rows.some((r) => /^Låst \| Autolås/.test(r)) && I.hist.rows.some((r) => /^Låst \| Alle dro/.test(r)) && I.hist.rows.some((r) => /^Døra åpnet \| Sensor/.test(r)) && I.hist.avatars.includes('S'), I.hist.rows);
ok('32.1 «· Lås-navn» når flere låser er med', I.hist.rows.some((r) => /· Boddør$/.test(r)) && I.hist.rows.some((r) => /· Inngangsdør$/.test(r)), I.hist.rows);
await p.evaluate(async () => { window.__c.shadowRoot.querySelector('.sk-more').click(); await new Promise((q) => setTimeout(q, 200)); });
I = await info(p);
ok('32.1 «Vis 4 til» → alle 10, I går med, «Vis færre»', I.hist.rows.length === 10 && I.hist.days.join() === 'I dag,I går' && I.hist.more === 'Vis færre', I.hist);
for (const [k, n] of [['jam', 1], ['unlock', 4], ['lock', 4]]) {
  await p.evaluate(async (k) => { window.__c.shadowRoot.querySelector(`.sk-fc[data-k="${k}"]`).click(); await new Promise((q) => setTimeout(q, 200)); }, k);
  I = await info(p);
  ok(`32.1 filter ${k}: ${n} hendelser`, I.hist.rows.length === n, I.hist.rows);
}
I = await info(p);
ok('32.1 Fastkjørt: rød prikk med glorie', await p.evaluate(async () => { const c = window.__c; c.setUI({ hf: 'jam' }); await new Promise((q) => setTimeout(q, 150)); const d = c.shadowRoot.querySelector('.sk-hr .sk-dot'); return d && /242, 128, 115/.test(getComputedStyle(d).backgroundColor) && /0px 0px 0px 6px/.test(getComputedStyle(d).boxShadow); }), '');
const lazy = await mount({ open: false, id: 'pop-dorlas-lazy' });
const lz0 = await lazy.evaluate(() => window.__calls.filter((c) => c[1] === 'logbook/get_events').length);
await lazy.evaluate(async () => { location.hash = '#dorlas'; await new Promise((q) => setTimeout(q, 500)); });
const lz1 = await lazy.evaluate(() => window.__calls.filter((c) => c[1] === 'logbook/get_events').map((c) => c[2].entity_ids.join(',')));
ok('32.1 logbook/get_events bare når popupen er åpen (lås + dørsensor)', lz0 === 0 && lz1.length === 1 && /lock\.inngangsdor/.test(lz1[0]) && /binary_sensor\.inngangsdor/.test(lz1[0]), [lz0, lz1]);
await lazy.close();

/* ---------------------------------------------------------------- Tilpass dørlås → config → GUI-editoren */
const TP = await p.evaluate(async () => {
  const w = (ms) => new Promise((q) => setTimeout(q, ms)), M = window.MSH, c = window.__c;
  c.shadowRoot.querySelector('.sk-gear').click(); await w(500);
  const pr = M.portals().find((x) => x.shadowRoot.querySelector('.sk-sheet')), R = pr.shadowRoot, q = (s) => R.querySelector(s), qa = (s) => [...R.querySelectorAll(s)];
  const sh = q('.sh').getBoundingClientRect();
  const out = { top: Math.round(sh.top), bottom: Math.round(sh.bottom), vh: innerHeight, title: q('.sk-sh-tt').textContent, done: q('.sk-ok').textContent, tabs: qa('.sk-sh-tab').map((e) => e.textContent) };
  out.locks = qa('.sk-sec .sk-in').map((e) => e.value);
  out.chips = qa('.sk-echip').map((e) => e.textContent);
  out.h = [Math.round(sh.height)];
  q('.sk-in[data-obj="inngangsdor"]').value = 'Hoveddør'; q('.sk-in[data-obj="inngangsdor"]').dispatchEvent(new Event('change', { bubbles: true, composed: true })); await w(100);
  q('[data-a="vis"][data-obj="bod"]').click(); await w(100);
  q('[data-a="tab"][data-k="secs"]').click(); await w(150);
  out.h.push(Math.round(q('.sh').getBoundingClientRect().height));
  q('[data-a="bool"][data-k="show_status"]').click(); await w(100);
  q('[data-a="unl"][data-v="hold"]').click(); await w(100);
  out.note = q('.sk-note').textContent;
  out.previewTiles = !!c.shadowRoot.querySelector('.sk-tiles');
  q('[data-a="tab"][data-k="hist"]').click(); await w(150);
  out.h.push(Math.round(q('.sh').getBoundingClientRect().height));
  q('[data-a="cnt"][data-v="4"]').click(); await w(100);
  q('[data-a="bool"][data-k="hist_door"]').click(); await w(100);
  q('[data-a="done"]').click(); await w(900);
  out.stored = M.store.get('cards.pop-dorlas');
  out.cfg = { unlock: c.config.unlock, hist_count: c.config.hist_count, show_status: c.config.show_status, hist_door: c.config.hist_door, name: (c.config.locks_cfg || {}).inngangsdor, bod: (c.config.locks_cfg || {}).bod };
  out.picks = [...c.shadowRoot.querySelectorAll('.sk-pc')].length;
  out.label = c.shadowRoot.querySelector('.lk-label') && c.shadowRoot.querySelector('.lk-label').textContent;
  // GUI-editoren viser de samme valgene
  const ed = c.constructor.getConfigElement(); ed.hass = window.__h; ed.setConfig(c._rawConfig); document.body.appendChild(ed); await w(300);
  const E = ed.shadowRoot;
  out.gui = { unlock: [...E.querySelectorAll('[data-name="unlock"].on')].map((e) => e.dataset.v), cnt: [...E.querySelectorAll('[data-name="hist_count"].on')].map((e) => e.dataset.v), status: (E.querySelector('[data-name="show_status"]') || {}).className, door: (E.querySelector('[data-name="hist_door"]') || {}).className, name: (E.querySelector('[data-name="locks_cfg.inngangsdor.name"]') || {}).value, hidden: (E.querySelector('[data-name="locks_cfg.bod.hidden"]') || {}).className };
  ed.remove();
  return out;
});
ok('32.1 Tilpass dørlås: 52 px fra toppen (Fiks 40) til bunnen, Ferdig, fanene Låser · Seksjoner · Historikk, samme høyde i alle faner', TP.top === 52 && TP.bottom === TP.vh && TP.title === 'Tilpass dørlås' && TP.done === 'Ferdig' && TP.tabs.join() === 'Låser,Seksjoner,Historikk' && new Set(TP.h).size === 1, TP);
ok('32.1 Låser: navnefelt per lås + Lås/Dørsensor med Auto/Mangler', TP.locks.join() === 'Boddør,Inngangsdør' && TP.chips.join() === 'Auto,Mangler,Auto,Auto', TP);
ok('32.1 forhåndsvisning: Status av skjuler flisene straks; forklaring for Hold', !TP.previewTiles && /0,9 s/.test(TP.note), TP);
ok('32.1 Ferdig lagrer i config (ki-store) og kortet følger', TP.stored && TP.stored.unlock === 'hold' && TP.stored.hist_count === 4 && TP.stored.show_status === false && TP.stored.hist_door === false && TP.cfg.name.name === 'Hoveddør' && TP.cfg.bod.hidden === true && TP.picks === 0 && TP.label === 'Hold for å låse opp', TP);
ok('32.1 GUI-editoren viser de samme valgene', TP.gui.unlock.join() === 'hold' && TP.gui.cnt.join() === '4' && !/\bon\b/.test(TP.gui.status) && !/\bon\b/.test(TP.gui.door) && TP.gui.name === 'Hoveddør' && /\bon\b/.test(TP.gui.hidden), TP.gui);
const minOne = await p.evaluate(async () => { const w = (ms) => new Promise((q) => setTimeout(q, ms)), M = window.MSH, c = window.__c; c.shadowRoot.querySelector('.sk-gear').click(); await w(500); const R = M.portals().find((x) => x.shadowRoot.querySelector('.sk-sheet')).shadowRoot; R.querySelector('[data-a="vis"][data-obj="inngangsdor"]').click(); await w(150); const on = R.querySelector('[data-a="vis"][data-obj="inngangsdor"]').classList.contains('on'); R.querySelector('[data-a="done"]').click(); await w(600); return on; });
ok('32.1 minst én lås må være synlig', minOne, minOne);
await p.close();

/* ---------------------------------------------------------------- én dørlås-popup: gammel popup migreres */
const pm = await mount();
const MIG = await pm.evaluate(() => {
  const M = window.MSH;
  const old = { type: 'custom:bubble-card', card_type: 'pop-up', hash: '#dorlas', cards: [{ type: 'custom:ki-lock-card', entity: 'lock.inngangsdor' }, { type: 'custom:gap-card', height: 0 }] };
  const oldHash = { ...old, hash: '#las' };
  const gen = { cards: [{ type: 'custom:msh-las-card', card_id: 'pop-dorlas' }] };
  const r = M.mergePopups({ auto: [{ config: { type: 'custom:bubble-card', card_type: 'pop-up', hash: '#dorlas', name: 'Dørlås', cards: gen.cards } }], custom: [oldHash] });
  return { test: M.lasLegacyTest(old), one: M.lasLegacyTest({ cards: [{ type: 'custom:msh-las-card' }] }), mig: M.POPUP_MIGRATE['#dorlas'](old, gen), n: r.popups.filter((x) => x.hash === '#dorlas').length, las: r.popups.filter((x) => x.hash === '#las').length, cards: r.popups.find((x) => x.hash === '#dorlas').cards.map((c) => c.type), inactive: (r.report.inactive || []).map((x) => x.hash + ':' + x.by) };
});
ok('32.1 nøyaktig én dørlås-popup: gammel #las/#dorlas med lås-kort → generert #dorlas med ÉTT msh-las-card', MIG.test && !MIG.one && MIG.mig && MIG.mig.cards.length === 1 && MIG.mig.cards[0].type === 'custom:msh-las-card' && MIG.n === 1 && MIG.las === 0 && MIG.cards.join() === 'custom:msh-las-card' && MIG.inactive.join() === '#dorlas:Dørlås', MIG);
await pm.close();

/* ---------------------------------------------------------------- Hjem-flisen åpner #dorlas */
const pj = await mount();
const HJ = await pj.evaluate(() => {
  const M = window.MSH, F = document.createElement('msh-hjem-faner-card');
  F.setConfig({ type: 'custom:msh-hjem-faner-card', card_id: 'f', tile_cfg: { lock: { entity: 'lock.inngangsdor' }, garage: {} } }); F.hass = window.__h;
  const t = F._tileModel ? F._tileModel('lock', F._E || {}) : null;
  const a = F._tapFor('lock', 'card', t), g = F._tapFor('garage', 'card', null);
  F.setConfig({ type: 'custom:msh-hjem-faner-card', card_id: 'f', tile_cfg: { lock: { popup_hash: '#sikkerhet' } } });
  const own = F._tapFor('lock', 'card', null);
  return { a, g, own };
});
ok('32.3 Hjem-flisene: Dørlås → #dorlas, Garasjeport → #garasje, popup_hash overstyrer', HJ.a.navigation_path === '#dorlas' && HJ.g.navigation_path === '#garasje' && HJ.own.navigation_path === '#sikkerhet', HJ);
await pj.close();

ok('ingen sidefeil', !errs.length, errs.slice(0, 5));
await b.close();
for (const [k, v] of Object.entries(res)) console.log(v === 'OK' ? '✔' : '✘', k, v === 'OK' ? '' : JSON.stringify(v[1]).slice(0, 600));
console.log(fail.length ? `\n${fail.length} feilet` : '\nAlle bestod');
process.exit(fail.length ? 1 : 0);
