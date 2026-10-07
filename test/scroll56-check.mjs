// Fiks 56 G (resten) · vertikal scroll skal virke uansett hvor sveipet starter – Strøm, Media, Server, Kalender, Rom.
// Ekte Bubble Card-popup (examples/dashboard.yaml + mal fra strategien), ekte touch-input via CDP (Input.dispatchTouchEvent):
//   · vertikalt sveip som starter på en fane (Strøm, Media, Server, Kalender) scroller popupen, lukker den ikke og bytter ikke fane
//   · raskt vertikalt «flikk» på en fane bytter ikke fane (pointercancel-regelen fra Fiks 47 E gjelder bare ikke-loddrett)
//   · vertikalt sveip på Server-kortvelgeren (.hcards), Strøm-prisgrafen, Kalender-karusellen og Rom-scenene scroller popupen
//   · horisontalt: Server-karusellen (faner og kort) scroller sidelengs, prisgrafen scrubber (retningslås «h»), popupen står i ro
//   · kort trykk bytter fane; hold 400 ms + dra omorganiserer fortsatt; swipe-to-close fra headeren virker
//   · touch-action: faner pan-x pan-y (effektivt pan-y i .msh-tr), Server .tabs/.hcards pan-x pan-y, prisgrafen pan-y
// Kjør: node test/scroll56-check.mjs
import { createRequire } from 'node:module';
import { readdirSync, existsSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
mkdirSync('test/.build', { recursive: true });
const bundle = resolve(`test/.build/scroll56-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const BC = resolve('test/.vendor/bubble-card.js');
if (!existsSync(BC)) { mkdirSync('test/.vendor', { recursive: true }); execFileSync('curl', ['-sSL', '-o', BC, 'https://raw.githubusercontent.com/Clooos/Bubble-Card/main/dist/bubble-card.js']); }
const popups = JSON.parse(execFileSync('python3', ['-c', "import yaml,json;d=yaml.safe_load(open('examples/dashboard.yaml'));print(json.dumps([c for s in d['views'][0]['sections'] for c in s['cards'] if c.get('card_type')=='pop-up']))"]).toString());
const mocks = readdirSync('test/mock').filter((f) => f.endsWith('.js')).sort().map((m) => resolve('test/mock/' + m));
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const res = {}, fail = [], errs = [];
const ok = (name, cond, info) => { res[name] = cond ? 'OK' : ['FEIL', info]; if (!cond) fail.push(name); };

async function open(hash, card = {}, vp = { w: 390, h: 844 }) {
  const ctx = await b.newContext({ viewport: { width: vp.w, height: vp.h }, hasTouch: true, isMobile: true });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(hash + ': ' + e.message));
  await p.goto('file://' + resolve('test/harness-bubble.html'));
  for (const m of mocks) await p.addScriptTag({ path: m });
  await p.addScriptTag({ path: bundle });
  await p.addScriptTag({ path: BC, type: 'module' });
  await p.waitForFunction(() => customElements.get('bubble-card'), null, { timeout: 15000 });
  const pop = popups.find((x) => x.hash === hash);
  const info = await p.evaluate(async ({ pop, card }) => {
    const wait = (ms) => new Promise((q) => setTimeout(q, ms));
    const H = window.mockHass(); window.__h = H;
    await MSH.store.load(H);
    const cfg = JSON.parse(JSON.stringify(pop));
    cfg.cards[0] = { ...cfg.cards[0], ...card };
    const bc = document.createElement('bubble-card'); bc.setConfig(cfg); bc.hass = H; document.getElementById('dash').appendChild(bc);
    window.__haps = []; window.addEventListener('haptic', (e) => window.__haps.push(e.detail));
    await wait(400); location.hash = pop.hash; await wait(1800);
    const all = []; const walk = (r) => r.querySelectorAll('*').forEach((e) => { all.push(e); if (e.shadowRoot && e.localName !== 'ha-icon') walk(e.shadowRoot); }); walk(document);
    window.__card = all.find((e) => /^msh-.*-card$/.test(e.localName) && e.localName !== 'msh-navbar-card');
    window.__pop = all.find((e) => e.classList && e.classList.contains('bubble-pop-up') && !e.classList.contains('editor'));
    window.__C = window.__pop.querySelector('.bubble-pop-up-container');
    // nok innhold til å scrolle: luft i bunnen (som navbar + pad_bottom i HA)
    window.__C.style.paddingBottom = '900px';
    await wait(200);
    return { card: window.__card && window.__card.localName, sh: window.__C.scrollHeight, ch: window.__C.clientHeight };
  }, { pop, card });
  const cdp = await ctx.newCDPSession(p);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
  const drag = async (x, y, dx, dy, steps = 16, dt = 16, hold = 0) => {
    await touch('touchStart', [{ x, y }]);
    if (hold) await p.waitForTimeout(hold);
    for (let i = 1; i <= steps; i++) { await touch('touchMove', [{ x: x + (dx * i) / steps, y: y + (dy * i) / steps }]); if (dt) await p.waitForTimeout(dt); }
    await touch('touchEnd', []);
  };
  // sel: CSS-velger i kortets shadow root (eller funksjonstekst som returnerer elementet)
  const pt = (sel, o = {}) => p.evaluate(({ sel, o }) => {
    const sr = window.__card.shadowRoot, el = sel.startsWith('=>') ? (0, eval)('(sr) ' + sel)(sr) : sr.querySelector(sel);
    if (!el) return null;
    if (o.top) { window.__C.scrollTop = 0; } else if (o.center) el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.left + r.width * (o.fx != null ? o.fx : 0.5)), y: Math.round(r.top + r.height * (o.fy != null ? o.fy : 0.5)), w: r.width, h: r.height };
  }, { sel, o });
  const state = (extra) => p.evaluate((extra) => {
    const sr = window.__card.shadowRoot;
    const on = [...sr.querySelectorAll('[aria-selected="true"],.on[data-act="tab"],[data-tabbar] .on,.seg .tab.on,.tabs .tb.on,.hcards .hc.on,.itab.on')].map((e) => e.dataset.v || e.dataset.t || e.textContent.trim()).filter(Boolean)[0] || null;
    const out = { st: Math.round(window.__C.scrollTop), hash: location.hash, open: window.__pop.classList.contains('is-popup-opened') && !window.__pop.classList.contains('is-popup-closed'), tab: on };
    if (extra) Object.assign(out, (0, eval)('(sr) => (' + extra + ')')(sr));
    return out;
  }, extra || null);
  const swipe = async (sel, dx, dy, o = {}) => {
    const q = await pt(sel, o);
    if (!q) return { err: 'fant ikke ' + sel };
    if (q.y < 2 || q.y > 840) return { err: 'utenfor', q };
    await p.waitForTimeout(250);
    const s0 = await state(o.extra);
    await drag(q.x, q.y, dx, dy, o.steps || 16, o.dt != null ? o.dt : 16);
    await p.waitForTimeout(700);
    const s1 = await state(o.extra);
    return { dSt: s1.st - s0.st, s0, s1, x: q.x, y: q.y };
  };
  return { p, ctx, cdp, touch, drag, pt, state, swipe, info };
}
const vOk = (r, tabSame = true) => r && !r.err && r.dSt > 60 && r.s1.hash === r.s0.hash && r.s1.open && (!tabSame || r.s1.tab === r.s0.tab);
const tapAt = async (T, q) => { await T.touch('touchStart', [{ x: q.x, y: q.y }]); await T.p.waitForTimeout(60); await T.touch('touchEnd', []); await T.p.waitForTimeout(500); };

/* ================================================================== Strøm */
{
  const T = await open('#strom');
  const TA = await T.p.evaluate(() => { const sr = window.__card.shadowRoot, row = sr.querySelector('[data-tabbar]'), btn = row && row.querySelector('button:not(.gear)'), sc = sr.querySelector('[data-scrub]'); return { row: row && getComputedStyle(row).touchAction, btn: btn && getComputedStyle(btn).touchAction, scrub: sc && getComputedStyle(sc).touchAction }; });
  ok('Strøm touch-action: faneraden tillater pan-y, fanene pan-x pan-y, prisgrafen pan-y', /auto|pan-y/.test(TA.row) && TA.btn === 'pan-x pan-y' && TA.scrub === 'pan-y', { ...TA, info: T.info });
  const tabSel = '=> [...sr.querySelector("[data-tabbar]").querySelectorAll("button")].find((b) => !b.classList.contains("on") && !b.matches(".gear,[data-act=customize]"))';
  const down = await T.swipe(tabSel, 0, -320, { top: true });
  ok('Strøm vertikalt sveip fra en fane scroller popupen, lukker den ikke, bytter ikke fane', vOk(down), down);
  const flick = await T.swipe(tabSel, 0, -260, { top: true, steps: 4, dt: 8 });
  ok('Strøm raskt vertikalt flikk på en fane bytter ikke fane (og scroller)', flick && !flick.err && flick.s1.tab === flick.s0.tab && flick.dSt > 20 && flick.s1.hash === '#strom', flick);
  // prisgrafen: vertikalt → scroll, ingen time valgt; horisontalt → scrub
  const g0 = await T.p.evaluate(() => window.__card._ui.selH);
  const gv = await T.swipe('[data-scrub]', 0, -300, { center: true, extra: '{ selH: window.__card._ui.selH, lock: sr.querySelector("[data-scrub]")._lock }' });
  ok('Strøm vertikalt sveip fra prisgrafen scroller popupen (retningslås «v», ingen time valgt)', vOk(gv) && gv.s1.lock === 'v' && gv.s1.selH === g0, gv);
  const gu = await T.swipe('[data-scrub]', 0, 200, { center: true });
  ok('Strøm vertikalt sveip opp fra prisgrafen scroller popupen tilbake', gu && !gu.err && gu.dSt < -60 && gu.s1.hash === '#strom', gu);
  const q = await T.pt('[data-scrub]', { center: true, fx: 0.2 });
  await T.p.waitForTimeout(250);
  const st0 = (await T.state()).st;
  await T.touch('touchStart', [{ x: q.x, y: q.y }]);
  for (let i = 1; i <= 10; i++) { await T.touch('touchMove', [{ x: q.x + i * 12, y: q.y + (i % 2) }]); await T.p.waitForTimeout(16); }
  const mid = await T.state('{ selH: window.__card._ui.selH, lock: sr.querySelector("[data-scrub]")._lock }');
  await T.touch('touchEnd', []);
  await T.p.waitForTimeout(300);
  ok('Strøm horisontalt dra på prisgrafen = scrub (retningslås «h», time valgt), popupen scroller ikke', mid.lock === 'h' && mid.selH != null && Math.abs(mid.st - st0) <= 1 && mid.hash === '#strom', { mid, st0 });
  // trykk på grafen velger fortsatt timen
  await T.p.evaluate(() => window.__card.setUI({ selH: null }));
  const q2 = await T.pt('[data-scrub]', { fx: 0.8 });
  await tapAt(T, q2);
  const tapH = await T.p.evaluate(() => window.__card._ui.selH);
  ok('Strøm trykk på prisgrafen velger timen', tapH != null && tapH >= 17, tapH);
  // trykk bytter fane
  const tq = await T.pt(tabSel, { top: true });
  const before = (await T.state()).tab;
  await T.p.waitForTimeout(300);
  await tapAt(T, tq);
  const after = await T.state();
  ok('Strøm kort trykk på en fane bytter fane', after.tab && after.tab !== before && after.hash === '#strom', { before, after });
  // hold 400 ms + dra omorganiserer fortsatt
  const ord0 = await T.p.evaluate(() => [...window.__card.shadowRoot.querySelector('[data-tabbar]').querySelectorAll('button')].filter((b) => !b.matches('.gear,[data-act=customize]')).map((b) => b.dataset.v));
  const f = await T.pt('=> sr.querySelector("[data-tabbar]").querySelector("button")', { top: true, fx: 0.5 });
  const last = await T.pt('=> [...sr.querySelector("[data-tabbar]").querySelectorAll("button")].filter((b) => !b.matches(".gear,[data-act=customize]")).pop()', { fx: 0.8 });
  await T.drag(f.x, f.y, last.x - f.x, 0, 14, 30, 560);
  await T.p.waitForTimeout(900);
  const ord1 = await T.p.evaluate(() => [...window.__card.shadowRoot.querySelector('[data-tabbar]').querySelectorAll('button')].filter((b) => !b.matches('.gear,[data-act=customize]')).map((b) => b.dataset.v));
  ok('Strøm hold 400 ms + dra omorganiserer fanene fortsatt', ord1.join() !== ord0.join() && ord1[ord1.length - 1] === ord0[0], { ord0, ord1 });
  // swipe-to-close fra headeren
  await T.p.evaluate(async () => { window.__C.scrollTop = 0; await new Promise((q) => setTimeout(q, 300)); });
  const hd = await T.p.evaluate(() => { const r = window.__pop.querySelector('.bubble-header-container').getBoundingClientRect(); return { x: Math.round(r.left + r.width / 3), y: Math.round(r.top + r.height / 2) }; });
  await T.drag(hd.x, hd.y, 0, 420, 14, 12);
  await T.p.waitForTimeout(900);
  const closed = await T.p.evaluate(() => location.hash);
  ok('Strøm swipe-to-close fra headeren virker fortsatt', closed !== '#strom', closed);
  await T.ctx.close();
}

/* ================================================================== Media */
{
  const T = await open('#media');
  const tabSel = '=> [...sr.querySelectorAll(".seg .tab")].find((b) => !b.classList.contains("on"))';
  const TA = await T.p.evaluate(() => { const b = [...window.__card.shadowRoot.querySelectorAll('.seg .tab')][0]; return b && getComputedStyle(b).touchAction; });
  ok('Media fanene: touch-action pan-x pan-y (raden pan-y)', TA === 'pan-x pan-y', TA);
  const down = await T.swipe(tabSel, 0, -320, { top: true });
  ok('Media vertikalt sveip fra en fane scroller popupen, lukker den ikke, bytter ikke fane', vOk(down), down);
  const flick = await T.swipe(tabSel, 0, -260, { top: true, steps: 4, dt: 8 });
  ok('Media raskt vertikalt flikk på en fane bytter ikke fane', flick && !flick.err && flick.s1.tab === flick.s0.tab && flick.s1.hash === '#media', flick);
  const tq = await T.pt(tabSel, { top: true });
  const before = (await T.state()).tab;
  await T.p.waitForTimeout(300);
  await tapAt(T, tq);
  const after = await T.state();
  ok('Media kort trykk på en fane bytter fane', after.tab && after.tab !== before, { before, after });
  await T.ctx.close();
}

/* ================================================================== Server (faner + kortvelger) */
for (const [tag, card, vp] of [['faner', {}, { w: 340, h: 760 }], ['kort', { velger: 'kort' }, { w: 390, h: 844 }]]) {
  const T = await open('#server', card, vp);
  const sel = tag === 'faner' ? '.trow .tabs[role="tablist"]' : '.hcards';
  const item = tag === 'faner' ? '.trow .tabs .tb' : '.hcards .hc';
  const C = await T.p.evaluate(({ sel, item }) => { const sr = window.__card.shadowRoot, sc = sr.querySelector(sel), b = sc && sc.querySelector(item.split(' ').pop()); return sc ? { ta: getComputedStyle(sc).touchAction, bta: b && getComputedStyle(b).touchAction, sw: sc.scrollWidth, cw: sc.clientWidth } : null; }, { sel, item });
  ok(`Server ${tag}: karusellen touch-action pan-x pan-y (fanene pan-x pan-y), flyter over`, C && C.ta === 'pan-x pan-y' && C.bta === 'pan-x pan-y' && C.sw > C.cw, C);
  const nonOn = `=> [...sr.querySelectorAll("${item}")].find((b) => !b.classList.contains("on"))`;
  const down = await T.swipe(nonOn, 0, -320, { top: true });
  ok(`Server ${tag}: vertikalt sveip fra vertvelgeren scroller popupen, lukker den ikke, bytter ikke vert`, vOk(down), down);
  const flick = await T.swipe(nonOn, 0, -260, { top: true, steps: 4, dt: 8 });
  ok(`Server ${tag}: raskt vertikalt flikk bytter ikke vert`, flick && !flick.err && flick.s1.tab === flick.s0.tab && flick.s1.hash === '#server', flick);
  // horisontalt: karusellen scroller sidelengs, popupen står i ro
  await T.p.evaluate(({ sel }) => { window.__C.scrollTop = 0; window.__card.shadowRoot.querySelector(sel).scrollLeft = 0; }, { sel });
  await T.p.waitForTimeout(300);
  const h = await T.swipe(sel, -200, 0, { fx: 0.75, extra: `{ sl: Math.round(sr.querySelector('${sel}').scrollLeft) }` });
  ok(`Server ${tag}: horisontalt sveip scroller karusellen, popupen står i ro, ingen vertbytte`, h && !h.err && h.s1.sl - h.s0.sl > 30 && Math.abs(h.dSt) <= 2 && h.s1.tab === h.s0.tab && h.s1.hash === '#server', h);
  // trykk bytter vert
  const tq = await T.pt(nonOn, { top: true });
  const before = (await T.state()).tab;
  await T.p.waitForTimeout(300);
  await tapAt(T, tq);
  const after = await T.state();
  ok(`Server ${tag}: kort trykk bytter vert`, after.tab && after.tab !== before, { before, after });
  await T.ctx.close();
}

/* ================================================================== Kalender (faner + Hytta-karusellen) */
{
  const T = await open('#kalender');
  const tabSel = '=> [...sr.querySelector(".top>.tabs").querySelectorAll("button")].find((b) => !b.classList.contains("on"))';
  const down = await T.swipe(tabSel, 0, -320, { top: true });
  ok('Kalender vertikalt sveip fra en fane scroller popupen, lukker den ikke, bytter ikke fane', vOk(down), down);
  const flick = await T.swipe(tabSel, 0, -260, { top: true, steps: 4, dt: 8 });
  ok('Kalender raskt vertikalt flikk på en fane bytter ikke fane', flick && !flick.err && flick.s1.tab === flick.s0.tab && flick.s1.hash === '#kalender', flick);
  // navnefaner (tab_labels: name → .tabs.names, pan-x pan-y)
  await T.p.evaluate(async () => { window.__card.setConfig({ ...window.__card._rawConfig, tab_labels: 'name' }); await new Promise((q) => setTimeout(q, 400)); });
  const nta = await T.p.evaluate(() => { const r = window.__card.shadowRoot.querySelector('.top>.tabs'); return { cls: r.className, ta: getComputedStyle(r).touchAction }; });
  const dn = await T.swipe(tabSel, 0, -320, { top: true });
  ok('Kalender navnefaner (.tabs.names pan-x pan-y): vertikalt sveip scroller popupen, bytter ikke fane', (!/names/.test(nta.cls) || nta.ta === 'pan-x pan-y') && vOk(dn), { nta, dn });
  // Hytta-karusellen
  const hy = await T.p.evaluate(async () => { const b = [...window.__card.shadowRoot.querySelector('.top>.tabs').querySelectorAll('button')].find((x) => x.dataset.v === 'hytta'); if (b) { b.click(); await new Promise((q) => setTimeout(q, 500)); } const c = window.__card.shadowRoot.querySelector('.hcar'); return c ? getComputedStyle(c).touchAction : null; });
  if (hy) {
    const hc = await T.swipe('.hcar', 0, -300, { center: true });
    ok('Kalender Hytta-karusellen (pan-x pan-y): vertikalt sveip scroller popupen', hy === 'pan-x pan-y' && vOk(hc), { hy, hc });
  } else res['Kalender Hytta-karusellen'] = 'ikke i mock-oppsettet (hoppet over)';
  await T.ctx.close();
}

/* ================================================================== Rom (scener, lysrader) */
{
  const T = await open('#stue');
  const sc = await T.p.evaluate(() => { const e = window.__card.shadowRoot.querySelector('[data-hs]'); return e ? getComputedStyle(e).touchAction : null; });
  if (sc) {
    const r = await T.swipe('[data-hs]', 0, -300, { center: true });
    ok('Rom vertikalt sveip fra scenene scroller popupen', sc === 'pan-x pan-y' && vOk(r, false), { sc, r });
  } else res['Rom scener'] = 'ingen scener i mock (hoppet over)';
  const lr = await T.p.evaluate(() => !!window.__card.shadowRoot.querySelector('.lr-sl'));
  if (lr) {
    const r = await T.swipe('.lr-sl', 0, -300, { center: true });
    ok('Rom vertikalt sveip fra en lysrad (dimmer, pan-y) scroller popupen', vOk(r, false), r);
  }
  await T.ctx.close();
}

await b.close();
for (const [k, v] of Object.entries(res)) console.log((v === 'OK' ? 'OK   ' : Array.isArray(v) ? 'FEIL ' : 'INFO ') + k + (Array.isArray(v) ? '  ' + JSON.stringify(v[1]).slice(0, 600) : typeof v === 'string' && v !== 'OK' ? '  ' + v : ''));
if (errs.length) console.log('Sidefeil:', errs.slice(0, 5));
console.log(fail.length ? `\n${fail.length} FEIL` : '\nAlle OK');
process.exit(fail.length || errs.length ? 1 : 0);
