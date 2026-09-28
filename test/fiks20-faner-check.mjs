// Fiks 20 · 20.3 (fane-rader bredere enn skjermen scrolles med touch: pending/scroll/drag), 20.8 (Tilpass Hjem → Faner:
// Fanestil øverst, jevn scroll-oppsett i arket), 20.18 (aktiv fane rosa fra første frame, glass-linsen henger aldri igjen).
// Touch via CDP (Input.dispatchTouchEvent, hasTouch) i smal viewport (320 px). Kjør: node test/fiks20-faner-check.mjs
import { createRequire } from 'node:module';
import { readdirSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
mkdirSync('test/.build', { recursive: true });
const bundle = resolve(`test/.build/f20f-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const res = [];
const ok = (name, cond, info) => res.push(`${cond ? '✔' : '✘'} ${name}${info != null ? ' · ' + JSON.stringify(info) : ''}`);
const SHOTS = process.env.SHOTS || '';

const p = await b.newPage({ viewport: { width: 320, height: 640 }, hasTouch: true, isMobile: true });
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
await p.goto('file://' + resolve('test/harness.html'));
for (const m of readdirSync('test/mock').sort()) await p.addScriptTag({ path: resolve('test/mock/' + m) });
await p.addScriptTag({ path: bundle });
const cdp = await p.context().newCDPSession(p);
const touch = async (pts) => { // pts: [[x,y], …] – start, bevegelse, slipp
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pts[0][0], y: pts[0][1] }] });
  for (const [x, y] of pts.slice(1)) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] }); await p.waitForTimeout(16); }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await p.waitForTimeout(450);
};
const line = (x0, y, x1, n = 12) => Array.from({ length: n + 1 }, (_, i) => [x0 + ((x1 - x0) * i) / n, y]);

/* ---------- 20.18 · aktiv fane rosa fra første frame (før .ind er målt) */
const first = await p.evaluate(async () => {
  window.deepAll = (sel) => { const out = []; const walk = (root) => root.querySelectorAll('*').forEach((e) => { if (e.matches(sel)) out.push(e); if (e.shadowRoot) walk(e.shadowRoot); }); walk(document); return out; };
  const H = (window.H = window.mockHass());
  H.floors = { a: { floor_id: 'a', name: '1. etasje', level: 1 }, b: { floor_id: 'b', name: '2. etasje', level: 2 }, c: { floor_id: 'c', name: 'Kjeller', level: -1 }, d: { floor_id: 'd', name: 'Ute', level: 9 } };
  // kortet i en skjult boks (display:none → bredde 0) som vises etter 300 ms (som HA som legger ut visningen sent)
  const box = document.createElement('div'); box.style.cssText = 'display:none;width:284px;padding:0 18px';
  const F = (window.F = document.createElement('msh-hjem-faner-card'));
  F.setConfig({ type: 'custom:msh-hjem-faner-card', card_id: 'f20', tab_order: ['hjem', 'aktuelt'] }); F.hass = H;
  box.appendChild(F); document.getElementById('dash').appendChild(box);
  await new Promise((q) => setTimeout(q, 300));
  const bgOn = () => { const on = F.shadowRoot.querySelector('.tab.on'); return on ? getComputedStyle(on).backgroundImage : null; };
  const hidden = { ip: F.shadowRoot.querySelector('.tg').hasAttribute('data-ip'), bg: bgOn() };
  box.style.display = 'block';
  const frames = [];
  await new Promise((q) => { let n = 0; const f = () => { const ind = F.shadowRoot.querySelector('.ind'), on = F.shadowRoot.querySelector('.tab.on'), cs = getComputedStyle(ind); frames.push({ indW: ind.offsetWidth, indO: +cs.opacity, onBg: getComputedStyle(on).backgroundImage !== 'none', ip: F.shadowRoot.querySelector('.tg').hasAttribute('data-ip') }); if (++n < 20) requestAnimationFrame(f); else q(); }; requestAnimationFrame(f); });
  const on = F.shadowRoot.querySelector('.tab.on'), ind = F.shadowRoot.querySelector('.ind');
  return { hidden, frames, final: { indW: ind.offsetWidth, onW: on.offsetWidth, indL: ind.offsetLeft, onL: on.offsetLeft } };
});
ok('20.18 skjult kort (bredde 0): aktiv fane bærer rosa selv (ingen data-ip)', !first.hidden.ip && /gradient/.test(first.hidden.bg || ''), first.hidden);
ok('20.18 hver frame etter visning: rosa (fane-bakgrunn eller målt linse)', first.frames.every((f) => f.onBg || (f.indW > 0 && f.indO > 0.5)), first.frames.slice(0, 4));
ok('20.18 linsen måles uten ny hass-render (ResizeObserver)', Math.abs(first.final.indW - first.final.onW) < 1.5 && Math.abs(first.final.indL - first.final.onL) < 1.5, first.final);

/* ---------- 20.3 · Hjem-fanelinjen flyter over → touch-drag scroller, velger ikke; trykk velger */
const rowInfo = () => p.evaluate(() => { const row = F.shadowRoot.querySelector('.tg'), r = row.getBoundingClientRect(); return { sl: row.scrollLeft, sw: row.scrollWidth, cw: row.clientWidth, x: r.left, y: r.top + r.height / 2, w: r.width, ta: getComputedStyle(row).touchAction, cur: F._cur && F._cur.id, tabs: [...row.querySelectorAll('.tab')].map((t) => t.dataset.id) }; });
let ri = await rowInfo();
ok('20.3 fanelinjen flyter over i 320 px', ri.sw > ri.cw + 1, ri);
ok('20.3 fanelinjen: touch-action pan-y', ri.ta === 'pan-y', ri.ta);
const cur0 = ri.cur;
await touch(line(ri.x + ri.w - 20, ri.y, ri.x + 30));
let r2 = await rowInfo();
ok('20.3 dra sideveis scroller raden', r2.sl > 20, { før: ri.sl, etter: r2.sl });
ok('20.3 dra velger ingen fane', r2.cur === cur0, { cur0, cur: r2.cur });
// trykk på en fane (ingen bevegelse) velger den
const tapT = await p.evaluate(() => { const row = F.shadowRoot.querySelector('.tg'), rr = row.getBoundingClientRect(), t = [...row.querySelectorAll('.tab')].filter((x) => !x.classList.contains('on')).find((x) => { const r = x.getBoundingClientRect(); return r.left >= rr.left && r.right <= rr.right; }); const r = t.getBoundingClientRect(); return { id: t.dataset.id, x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
await touch([[tapT.x, tapT.y]]);
r2 = await rowInfo();
ok('20.3 trykk velger fanen', r2.cur === tapT.id, { want: tapT.id, cur: r2.cur });
// loddrett bevegelse på raden velger ikke
const cur1 = r2.cur;
await touch(Array.from({ length: 10 }, (_, i) => [ri.x + 60, ri.y + i * 12]));
r2 = await rowInfo();
ok('20.3 loddrett bevegelse velger ikke', r2.cur === cur1, r2.cur);

/* ---------- 20.3 · MSH.glassDrag: rad som flyter over (pending/scroll) og rad som passer (glass-drag som før) */
const gd = await p.evaluate(() => {
  const mk = (w, n) => {
    const host = document.createElement('div'); host.style.cssText = `width:${w}px;margin:10px 18px`;
    host.innerHTML = `<div class="seg" style="display:flex;gap:2px;overflow-x:auto;scrollbar-width:none">${Array.from({ length: n }, (_, i) => `<button style="flex:0 0 auto;height:36px;padding:0 16px;border-radius:18px;${i === 0 ? 'background:#f285c9' : ''}" ${i === 0 ? 'aria-selected="true"' : ''} data-i="${i}">Fane ${i + 1}</button>`).join('')}</div>`;
    document.getElementById('dash').prepend(host);
    const seg = host.firstChild;
    seg.addEventListener('click', (e) => { const bt = e.target.closest('button'); if (!bt) return; seg.querySelectorAll('button').forEach((x) => { const on = x === bt; x.style.background = on ? '#f285c9' : ''; x.setAttribute('aria-selected', on); }); seg.dataset.sel = bt.dataset.i; });
    window.MSH.glassDrag(seg, { axis: 'x' });
    return seg;
  };
  window.segO = mk(284, 8); window.segF = mk(284, 2);
  window.scrollTo(0, 0);
  const i = (s) => { const r = s.getBoundingClientRect(); return { x: r.left, y: r.top + r.height / 2, w: r.width, sw: s.scrollWidth, cw: s.clientWidth, ta: getComputedStyle(s).touchAction }; };
  return { o: i(window.segO), f: i(window.segF) };
});
ok('20.3 glassDrag: raden flyter over og har touch-action pan-y', gd.o.sw > gd.o.cw && gd.o.ta === 'pan-y', gd.o);
await touch(line(gd.o.x + gd.o.w - 20, gd.o.y, gd.o.x + 20));
let gs = await p.evaluate(() => ({ sl: segO.scrollLeft, sel: segO.dataset.sel || null, lens: !!segO.querySelector('.gd-lens') }));
ok('20.3 glassDrag: dra scroller (scrollLeft), ingen valg, ingen linse', gs.sl > 20 && gs.sel == null && !gs.lens, gs);
const tb = await p.evaluate(() => { const r = segO.getBoundingClientRect(), bt = [...segO.querySelectorAll('button')].find((x) => { const q = x.getBoundingClientRect(); return q.left > r.left + 4 && q.right < r.right - 4 && x.dataset.i !== '0'; }), q = bt.getBoundingClientRect(); return { i: bt.dataset.i, x: q.left + q.width / 2, y: q.top + q.height / 2 }; });
await touch([[tb.x, tb.y]]);
gs = await p.evaluate(() => segO.dataset.sel || null);
ok('20.3 glassDrag: trykk velger fanen', gs === tb.i, { want: tb.i, got: gs });
// rad som passer: glass-drag velger fanen under fingeren, med linse
const fo = await p.evaluate(() => { const bs = segF.querySelectorAll('button'), a = bs[0].getBoundingClientRect(), c = bs[1].getBoundingClientRect(); return { x0: a.left + a.width / 2, x1: c.left + c.width / 2, y: a.top + a.height / 2 }; });
let lensSeen = false;
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: fo.x0, y: fo.y }] });
for (const [x, y] of line(fo.x0, fo.y, fo.x1, 8)) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] }); await p.waitForTimeout(16); if (!lensSeen) lensSeen = await p.evaluate(() => !!segF.querySelector('.gd-lens')); }
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
await p.waitForTimeout(600);
gs = await p.evaluate(() => ({ sel: segF.dataset.sel || null, lens: !!segF.querySelector('.gd-lens'), hid: segF.querySelectorAll('[data-gd-hide]').length }));
ok('20.3 glassDrag: rad som passer har fortsatt glass-drag (linse, velger fanen)', lensSeen && gs.sel === '1', { lensSeen, ...gs });
ok('20.18 linsen er borte og ingen pille skjult etter slipp', !gs.lens && !gs.hid, gs);

/* ---------- 20.18 · glassMorph: avbrutt animasjon → linsen fjernes (oncancel / 400 ms) */
const gm = await p.evaluate(async () => {
  const bs = segF.querySelectorAll('button'), an = window.MSH.glassMorph(segF, bs[1], bs[0], { axis: 'x' });
  an.onfinish = null; // «onfinish kommer aldri»
  await new Promise((q) => setTimeout(q, 80));
  const mid = !!segF.querySelector('.gd-lens');
  await new Promise((q) => setTimeout(q, 650));
  const a = { mid, after: !!segF.querySelector('.gd-lens'), hid: segF.querySelectorAll('[data-gd-hide]').length };
  const an2 = window.MSH.glassMorph(segF, bs[0], bs[1], { axis: 'x' });
  await new Promise((q) => setTimeout(q, 50));
  an2.cancel();
  await new Promise((q) => setTimeout(q, 400));
  a.cancel = !!segF.querySelector('.gd-lens'); a.hid2 = segF.querySelectorAll('[data-gd-hide]').length;
  return a;
});
ok('20.18 glassMorph uten onfinish: sikkerhets-timeout fjerner linsen', gm.mid && !gm.after && !gm.hid, gm);
ok('20.18 glassMorph avbrutt (cancel): linsen fjernes, pillen vises', !gm.cancel && !gm.hid2, gm);

/* ---------- 20.3 / 20.8 · Tilpass Hjem */
await p.evaluate(async () => { document.querySelectorAll('#dash > div:not(:last-child)').forEach((d) => d.remove()); window.MSH.openHomeEditor(); await new Promise((q) => setTimeout(q, 700)); });
const edR = `(window.deepAll('[data-key="ed"]')[0] || window.deepAll('.body')[0]).getRootNode()`;
const ct = await p.evaluate(`(() => { const R = ${edR}, ct = R.querySelector('.ct'); if (!ct) return null; ct.scrollIntoView({ block: 'center' }); const r = ct.getBoundingClientRect(); return { x: r.left, y: r.top + r.height / 2, w: r.width, sw: ct.scrollWidth, cw: ct.clientWidth, sl: ct.scrollLeft, on: (R.querySelector('.ct .tb.on') || {}).dataset.v }; })()`);
ok('20.3 Tilpass Hjem → Kort: fanevelgeren flyter over', ct && ct.sw > ct.cw + 1, ct);
if (ct) {
  const rev = ct.sl > 0; // står allerede til høyre (aktiv fane rullet inn) → dra mot høyre
  await touch(rev ? line(ct.x + 16, ct.y, ct.x + ct.w - 16) : line(ct.x + ct.w - 16, ct.y, ct.x + 16));
  const c2 = await p.evaluate(`(() => { const R = ${edR}, ct = R.querySelector('.ct'); return { sl: ct.scrollLeft, on: (R.querySelector('.ct .tb.on') || {}).dataset.v }; })()`);
  ok('20.3 Kort-fanevelgeren: dra scroller, velger ikke', Math.abs(c2.sl - ct.sl) > 20 && c2.on === ct.on, { før: ct, etter: c2 });
  const t2 = await p.evaluate(`(() => { const R = ${edR}, ct = R.querySelector('.ct'), cr = ct.getBoundingClientRect(), t = [...ct.querySelectorAll('.tb:not(.on)')].find((x) => { const r = x.getBoundingClientRect(); return r.left > cr.left + 4 && r.right < cr.right - 4; }); const r = t.getBoundingClientRect(); return { v: t.dataset.v, x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  await touch([[t2.x, t2.y]]);
  const c3 = await p.evaluate(`(() => { const R = ${edR}; return (R.querySelector('.ct .tb.on') || {}).dataset.v; })()`);
  ok('20.3 Kort-fanevelgeren: trykk velger fanen', c3 === t2.v, { want: t2.v, got: c3 });
}
// Faner-fanen: Fanestil øverst
await p.evaluate(`(() => { const R = ${edR}, b = R.querySelector('[data-a="sec"][data-v="faner"]') || [...R.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Faner'); b && b.click(); })()`);
await p.waitForTimeout(500);
const fan = await p.evaluate(`(() => { const R = ${edR}, body = R.querySelector('.tset') && R.querySelector('.tset').parentElement; if (!body) return null; const kids = [...body.children].map((e) => e.classList.contains('tset') ? 'stil:' + e.querySelector('.lb').textContent : e.dataset.key === 'glassanim' ? 'glass' : e.classList.contains('tabr') ? 'fane' : e.dataset.a === 'tabnew' ? 'ny' : e.dataset.key || e.className); const sh = R.querySelector('.sh'), cs = getComputedStyle(sh), bg = getComputedStyle(R.querySelector('.bg')); return { kids, ob: cs.overscrollBehaviorY, ta: cs.touchAction, contain: cs.contain, tf: cs.transform, scrimBlur: bg.backdropFilter, tabrTA: getComputedStyle(R.querySelector('.tabr')).touchAction }; })()`);
const order = fan && fan.kids.filter((k) => /^(stil:|glass|fane|ny)/.test(k)).map((k) => (k.startsWith('fane') ? 'fane' : k)).filter((k, i, a) => k !== 'fane' || a[i - 1] !== 'fane');
ok('20.8 Faner: Fanestil → Liquid Glass-animasjon → faner → Ny fane', order && order.join(',') === 'stil:Fanestil,glass,fane,ny', order);
ok('20.8 arket: overscroll contain, touch-action pan-y, contain paint, eget lag', fan && fan.ob === 'contain' && fan.ta === 'pan-y' && /paint/.test(fan.contain) && fan.tf !== 'none', fan);
ok('20.8 bakteppe uten backdrop-filter', fan && (fan.scrimBlur === 'none' || !fan.scrimBlur), fan && fan.scrimBlur);
ok('20.8 faneradene: touch-action pan-y (nettleseren scroller arket, ikke JS)', fan && fan.tabrTA === 'pan-y', fan && fan.tabrTA);
// touch-scroll i arket starter på en fanerad → arket scroller (native), ingen dra
const sc = await p.evaluate(`(() => { const R = ${edR}, sh = R.querySelector('.sh'); sh.scrollTop = 0; const t = R.querySelector('.tabr'); const r = t.getBoundingClientRect(); return { x: r.left + 40, y: Math.min(r.top + 30, innerHeight - 40), st: sh.scrollTop, max: sh.scrollHeight - sh.clientHeight }; })()`);
await touch(Array.from({ length: 12 }, (_, i) => [sc.x, sc.y - i * 20]));
const sc2 = await p.evaluate(`(() => { const R = ${edR}; return { st: R.querySelector('.sh').scrollTop, ghost: !!R.querySelector('.ghost'), win: scrollY }; })()`);
ok('20.8 touch-scroll fra en fanerad ruller arket (native), ingen dra, dashbordet står', sc.max <= 0 || (sc2.st > 30 && !sc2.ghost && sc2.win === 0), { før: sc, etter: sc2 });
if (SHOTS) await p.screenshot({ path: SHOTS + '/f20-faner.png' });

ok('ingen JS-feil', !errs.length, errs.slice(0, 3));
await b.close();
console.log(res.join('\n'));
const bad = res.filter((r) => r.startsWith('✘')).length;
console.log(bad ? `\n${bad} feil` : '\nAlt OK');
process.exit(bad ? 1 : 0);
