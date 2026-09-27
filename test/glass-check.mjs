// Fiks 16.10: Liquid Glass-indikatoren i segmentet «TV / Musikk» (msh-media-card) mot EKTE Bubble Card, mobil 390 px.
//  · bytter TV ↔ Musikk med trykk (CDP touch-tap) og med dra (CDP touch) – også når innholdet (hero + TV-fjernkontroll
//    vs. musikk-transport) endrer høyde og når popupen er scrollet til bunns (scroll-posisjonen klemmes ved bytte)
//  · måler hver frame: indikatoren (.ind / rosa .tab.on), trykk-linsen (glassTap/glassMorph) og dra-linsen
//  · krav: indikatoren ender innenfor 2 px av valgt knapp etter animasjonen, linsen lander på valgt knapp (≤ 2 px)
//    før den tones ut, og popupen lukkes ikke
// Kjør: node test/glass-check.mjs   (npm run glass)
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
// GLASS_BUNDLE=<fil> kjører sjekken mot en ferdig bygd pakke (f.eks. før/etter-sammenligning) i stedet for å bygge src/
const bundle = process.env.GLASS_BUNDLE ? resolve(process.env.GLASS_BUNDLE) : resolve(`test/.build/glass-${process.pid}.js`);
if (!process.env.GLASS_BUNDLE) execFileSync('node', ['build.mjs', bundle], { cwd: R, stdio: 'inherit' });
const mocks = readdirSync(R + 'test/mock').filter((f) => f.endsWith('.js')).sort().map((f) => R + 'test/mock/' + f);
const browser = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => pw.chromium.launch());
const res = [];
const ok = (name, cond, info) => { res.push(`${cond ? '✔' : '✘'} ${name}${info != null ? ' · ' + JSON.stringify(info) : ''}`); };

const page = await browser.newPage({ viewport: { width: 390, height: 600 }, hasTouch: true, isMobile: true });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
if (process.env.GDBG) { page.on('console', (m) => console.log('C', m.text())); await page.addInitScript(() => { for (const k of ['back', 'go', 'pushState', 'replaceState']) { const o = history[k].bind(history); history[k] = (...a) => { console.log('H', k, JSON.stringify(a).slice(0, 80), new Error().stack.split('\n').slice(2, 5).join(' ')); return o(...a); }; } window.addEventListener('touchend', (e) => console.log('TEND', e.changedTouches[0].clientX, e.changedTouches[0].clientY), true); window.addEventListener('click', (e) => console.log('CLICK', e.isTrusted, e.clientX, e.clientY, e.composedPath().slice(0, 12).map((n) => (n.tagName || n.nodeName || '') + '.' + ((n.className && n.className.baseVal == null ? n.className : '') + '').slice(0, 30)).join(' > ')), true); window.addEventListener('beforeunload', () => console.log('UNLOAD', new Error().stack)); }); }
await page.goto('file://' + R + 'test/harness-bubble.html');
for (const m of mocks) await page.addScriptTag({ path: m });
await page.addScriptTag({ path: bundle });
await page.addScriptTag({ path: BC, type: 'module' });
await page.waitForFunction(() => customElements.get('bubble-card'), null, { timeout: 10000 });
const cdp = await page.context().newCDPSession(page);
const wait = (ms) => page.waitForTimeout(ms);

await page.evaluate(async () => {
  window.deepAll = (sel) => { const out = []; const walk = (root) => root.querySelectorAll('*').forEach((e) => { if (e.matches(sel)) out.push(e); if (e.shadowRoot) walk(e.shadowRoot); }); walk(document); return out; };
  window.deep = (sel) => window.deepAll(sel)[0] || null;
  window.H = window.mockHass();
  const bc = document.createElement('bubble-card');
  // Som strategien: ett kort (msh-media-card, hero innebygd via MSH.HEROES)
  bc.setConfig({ type: 'custom:bubble-card', card_type: 'pop-up', hash: '#media', name: 'Media', icon: 'mdi:cast', margin_top_mobile: '50px', cards: [{ type: 'custom:msh-media-card', card_id: 'glass_media', default_tab: 'tv' }] });
  bc.hass = H; document.getElementById('dash').appendChild(bc);
  await new Promise((r) => setTimeout(r, 400));
  location.hash = '#media';
  await new Promise((r) => setTimeout(r, 900));
  // Sampler: hver frame – valgt knapp, indikator, linser og segmentets plass på skjermen
  window.rectOf = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: +r.left.toFixed(1), y: +r.top.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) }; };
  window.card = () => deep('msh-media-card');
  window.seg = () => card().shadowRoot.querySelector('.seg');
  window.tabBtn = (t) => seg().querySelector(`.tab[data-t="${t}"]`);
  window.indEl = () => seg().querySelector('.ind') || seg().querySelector('.tab.on');
  window.lenses = () => [...deepAll('.gt-lens,.gd-lens'), ...[...document.body.children].filter((e) => e.tagName === 'SPAN' && e.style.zIndex === '9998')]
    .filter((l) => l.isConnected).map((l) => ({ r: rectOf(l), o: +getComputedStyle(l).opacity }));
  window.sample = (ms) => new Promise((res) => {
    const out = [], t0 = performance.now();
    const f = () => { const t = performance.now() - t0; out.push({ t: Math.round(t), seg: rectOf(seg()), ind: rectOf(indEl()), tv: rectOf(tabBtn('tv')), mu: rectOf(tabBtn('musikk')), lens: lenses(), h: card().getBoundingClientRect().height }); if (t < ms) requestAnimationFrame(f); else res(out); };
    requestAnimationFrame(f);
  });
});

const popOpen = () => page.evaluate(() => location.hash === '#media' && deepAll('.bubble-pop-up').some((p) => p.classList.contains('is-popup-opened')));
const center = (t) => page.evaluate((t) => { const r = tabBtn(t).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, t);
const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
const tap = async (t) => { const p = await center(t); await touch('touchStart', [{ x: p.x, y: p.y }]); await wait(60); await touch('touchEnd', []); };
const drag = async (from, to) => {
  const a = await center(from), b = await center(to);
  await touch('touchStart', [{ x: a.x, y: a.y }]);
  const n = 14;
  for (let i = 1; i <= n; i++) { await touch('touchMove', [{ x: a.x + (b.x - a.x) * i / n, y: a.y + (i % 2) }]); await wait(16); }
  await wait(40);
  await touch('touchEnd', []);
};
const d = (a, b) => (a && b ? +Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.w - b.w), Math.abs(a.h - b.h)).toFixed(1) : 999);
// Siste frame der linsen er tydelig synlig (> .5): den skal ligge på valgt knapp (etter at den har satt seg)
const lensLand = (S, key) => {
  let last = null;
  S.forEach((s) => { const l = s.lens.find((x) => x.o > 0.5); if (l) last = { l: l.r, b: s[key], t: s.t }; });
  return last ? { d: d(last.l, last.b), t: last.t } : { d: null };
};

// shift: ms etter start → 64 px ekstra over fanene (hero som vokser) midt i animasjonen/draget – layouten flytter seg under
async function run(name, act, to, scrollBottom, shift) {
  if (scrollBottom) await page.evaluate(() => { const c = deepAll('.bubble-pop-up-container').find((x) => x.scrollHeight > x.clientHeight); if (c) c.scrollTop = Math.min(c.scrollHeight - c.clientHeight, c.scrollTop + seg().getBoundingClientRect().top - c.getBoundingClientRect().top - 12); });
  await wait(150);
  const before = await page.evaluate(() => ({ seg: rectOf(seg()), h: card().getBoundingClientRect().height }));
  const sp = page.evaluate(() => sample(900));
  // Utenfor kortet (morph fjerner fremmede noder i kortet), uten scroll-anchoring (ellers kompenserer Chrome skiftet)
  if (shift != null) page.evaluate((ms) => setTimeout(() => { deepAll('.bubble-pop-up-container').forEach((c) => { c.style.overflowAnchor = 'none'; }); const hc = card().closest('hui-card') || card(); const s = document.createElement('div'); s.className = 'gc-shift'; s.style.height = '64px'; hc.parentNode.insertBefore(s, hc); }, ms), shift);
  await act();
  const S = await sp;
  await wait(250);
  const key = to === 'tv' ? 'tv' : 'mu';
  const end = await page.evaluate((to) => ({ ind: rectOf(indEl()), btn: rectOf(tabBtn(to)), on: seg().querySelector('.tab.on') && seg().querySelector('.tab.on').dataset.t, seg: rectOf(seg()), h: card().getBoundingClientRect().height }), to);
  await page.evaluate(() => deepAll('.gc-shift').forEach((x) => x.remove()));
  const L = lensLand(S, key);
  const info = { seg0: before.seg.y, seg1: end.seg.y, h0: Math.round(before.h), h1: Math.round(end.h), indD: d(end.ind, end.btn), lensD: L.d, lensT: L.t };
  ok(`${name}: valgt «${to}»`, end.on === to, info);
  ok(`${name}: indikatoren ≤ 2 px fra valgt knapp etter animasjon`, info.indD <= 2, { ind: end.ind, btn: end.btn });
  ok(`${name}: linsen lander på valgt knapp (≤ 2 px) før den tones ut`, L.d == null || L.d <= 2, L);
  ok(`${name}: popupen er fortsatt åpen`, await popOpen());
  return { info, S };
}

ok('popup #media åpen', await popOpen());
if (process.env.GDBG) { page.on('framenavigated', (f) => console.log('NAV', f.url())); page.on('console', (m) => console.log('C', m.text())); }
// Første bytte: innholdet har ulik høyde (TV med fjernkontroll ≈ 100 px høyere enn Musikk med transport)
const first = (await run('trykk TV→Musikk', () => tap('musikk'), 'musikk')).info;
const hInfo = [];
hInfo.push((await run('trykk Musikk→TV', () => tap('tv'), 'tv')).info);
hInfo.push((await run('trykk TV→Musikk (scrollet ned)', () => tap('musikk'), 'musikk', true)).info);
hInfo.push((await run('trykk Musikk→TV (scrollet ned)', () => tap('tv'), 'tv', true)).info);
hInfo.push((await run('dra TV→Musikk', () => drag('tv', 'musikk'), 'musikk')).info);
hInfo.push((await run('dra Musikk→TV', () => drag('musikk', 'tv'), 'tv')).info);
hInfo.push((await run('dra TV→Musikk (scrollet ned)', () => drag('tv', 'musikk'), 'musikk', true)).info);
hInfo.push((await run('dra Musikk→TV (scrollet ned)', () => drag('musikk', 'tv'), 'tv', true)).info);
ok('innholdsflaten holder høyden ved bytte (min-høyde = høyeste av TV/Musikk) – segmentet flytter seg ikke', hInfo.every((i) => Math.abs(i.h0 - i.h1) <= 1 && Math.abs(i.seg0 - i.seg1) <= 1), { first: [first.h0, first.h1], rest: hInfo.map((i) => [i.h0, i.h1, i.seg0, i.seg1]) });
// Layout-skift UNDER animasjonen/draget (64 px over fanene): indikatoren lander likevel på valgt knapp
const sh = [];
sh.push((await run('trykk TV→Musikk + layout-skift under animasjonen', () => tap('musikk'), 'musikk', false, 120)).info);
sh.push((await run('trykk Musikk→TV + layout-skift under animasjonen', () => tap('tv'), 'tv', false, 120)).info);
sh.push((await run('dra TV→Musikk + layout-skift midt i draget', () => drag('tv', 'musikk'), 'musikk', false, 120)).info);
sh.push((await run('dra Musikk→TV + layout-skift midt i draget', () => drag('musikk', 'tv'), 'tv', false, 120)).info);
ok('layout-skift-testene flyttet faktisk segmentet (≥ 60 px)', sh.every((i) => Math.abs(i.seg1 - i.seg0) >= 60), sh.map((i) => [i.seg0, i.seg1]));
// Dra: indikatoren følger fingeren (midt i draget ligger den mellom knappene)
{
  const a = await center('tv'), b = await center('musikk');
  await touch('touchStart', [{ x: a.x, y: a.y }]);
  for (let i = 1; i <= 7; i++) { await touch('touchMove', [{ x: a.x + (b.x - a.x) * i / 14, y: a.y }]); await wait(16); }
  await wait(250);
  const mid = await page.evaluate(() => ({ ind: rectOf(indEl()), tv: rectOf(tabBtn('tv')), mu: rectOf(tabBtn('musikk')), lens: lenses(), on: seg().querySelector('.tab.on').dataset.t }));
  await touch('touchMove', [{ x: a.x, y: a.y }]); await wait(30);
  await touch('touchEnd', []);
  await wait(500);
  const vis = [mid.ind, ...mid.lens.filter((l) => l.o > 0.5).map((l) => l.r)];
  const between = vis.some((r) => r && r.x > mid.tv.x + 4 && r.x < mid.mu.x - 4);
  ok('dra: indikator/linse følger fingeren (mellom knappene midt i draget), ikke byttet før slipp', between && mid.on === 'tv', mid);
  ok('dra tilbake og slipp på TV: TV fortsatt valgt, popup åpen', (await page.evaluate(() => seg().querySelector('.tab.on').dataset.t)) === 'tv' && await popOpen());
}
// Felles hjelpere (alle segmenter): MSH.glassDrag (+ glassTap/glassMorph) og MSH.tabReorder-standardlinsen – med
// layout-skift (64 px over segmentet) midt i animasjonen/draget. Linsen skal lande på valgt knapp (≤ 2 px).
await page.evaluate(() => {
  const M = window.MSH, host = card().closest('hui-card') || card();
  const mk = (id) => {
    const w = document.createElement('div');
    w.id = id; w.style.cssText = 'display:flex;gap:2px;padding:4px;margin:8px 0;border-radius:22px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.14)';
    w.innerHTML = ['A', 'Bbbbbb', 'C'].map((t, i) => `<button data-t="${t}" style="flex:1;height:38px;border-radius:19px;border:0;color:#fff;background:${i ? 'transparent' : '#f285c9'}" ${i ? '' : 'class="on" aria-selected="true"'}>${t}</button>`).join('');
    const sel = (b) => w.querySelectorAll('button').forEach((x) => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-selected', on); x.style.background = on ? '#f285c9' : 'transparent'; });
    w.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) sel(b); });
    host.parentNode.insertBefore(w, host);
    return { w, sel };
  };
  const g = mk('gc-gd'); M.glassDrag(g.w, { axis: 'x' });
  const t = mk('gc-tr'); M.tabReorder(t.w, { glass: true, glassTap: false, idOf: (b) => b.dataset.t, onSelect: (k) => t.sel(t.w.querySelector(`[data-t="${k}"]`)) });
  deepAll('.bubble-pop-up-container').forEach((c) => { c.scrollTop = 0; });
});
const gc = async (name, id, act, to) => {
  await wait(200);
  const sp = page.evaluate((id) => new Promise((res) => {
    const out = [], t0 = performance.now(), w = deep('#' + id);
    const f = () => { const t = performance.now() - t0; out.push({ t: Math.round(t), lens: lenses(), btns: [...w.querySelectorAll('button')].map((b) => rectOf(b)) }); if (t < 1000) requestAnimationFrame(f); else res(out); };
    requestAnimationFrame(f);
  }), id);
  page.evaluate(() => setTimeout(() => { deepAll('.bubble-pop-up-container').forEach((c) => { c.style.overflowAnchor = 'none'; }); const hc = card().closest('hui-card') || card(); const s = document.createElement('div'); s.className = 'gc-shift'; s.style.height = '64px'; const w = deep('#gc-gd'); w.parentNode.insertBefore(s, w); }, 150));
  await act();
  const S = await sp;
  await wait(300);
  await page.evaluate(() => deepAll('.gc-shift').forEach((x) => x.remove()));
  let last = null;
  S.forEach((f) => { const l = f.lens.find((x) => x.o > 0.5); if (l) last = { l: l.r, b: f.btns[to], t: f.t }; });
  const on = await page.evaluate((id) => [...deep('#' + id).querySelectorAll('button')].findIndex((b) => b.classList.contains('on')), id);
  ok(`${name}: valgt knapp ${to}, linsen lander ≤ 2 px fra den selv om layouten flyttet seg`, on === to && last && d(last.l, last.b) <= 2, last ? { d: d(last.l, last.b), t: last.t, on } : { on, lens: 'ingen' });
  ok(`${name}: popupen er fortsatt åpen`, await popOpen());
};
const ctr = (id, i) => page.evaluate(({ id, i }) => { const r = deep('#' + id).querySelectorAll('button')[i].getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, { id, i });
const tapAt = async (id, i) => { const p = await ctr(id, i); await touch('touchStart', [{ x: p.x, y: p.y }]); await wait(60); await touch('touchEnd', []); };
const dragAt = async (id, i, j) => {
  const a = await ctr(id, i), b = await ctr(id, j);
  await touch('touchStart', [{ x: a.x, y: a.y }]);
  for (let k = 1; k <= 14; k++) { await touch('touchMove', [{ x: a.x + (b.x - a.x) * k / 14, y: a.y }]); await wait(16); }
  await wait(40); await touch('touchEnd', []);
};
await gc('glassTap/glassMorph (trykk 0→2)', 'gc-gd', () => tapAt('gc-gd', 2), 2);
await gc('glassDrag (dra 2→0)', 'gc-gd', () => dragAt('gc-gd', 2, 0), 0);
await gc('tabReorder glass-linse (dra 0→2)', 'gc-tr', () => dragAt('gc-tr', 0, 2), 2);
ok('ingen sidefeil', errs.length === 0, errs);
await browser.close();
if (!process.env.GLASS_BUNDLE) { try { unlinkSync(bundle); } catch (e) { /* */ } }
console.log(res.join('\n'));
const bad = res.filter((r) => r.startsWith('✘')).length;
console.log(`\n${res.length - bad}/${res.length} OK`);
process.exit(bad ? 1 : 0);
