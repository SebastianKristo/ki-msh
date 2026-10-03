// Fiks 36.9 · volumknappen: trykk = volum, hold = demp (fasit Hjem v3 volToggle/volHoldDown/volHoldUp). Uavhengig av dato/klokkeslett.
//  Mini-spilleren (navbar, standard + glass, mørk + lys), touch (CDP) og mus:
//  · trykk → volum-pillen åpnes/lukkes, haptic light, ALDRI volume_mute; lukkes selv etter 3 s uten bruk
//  · hold 500 ms → volume_mute (is_volume_muted: !muted), haptic medium, toast «Dempet»/«Lyd på» (1,4 s), pillen åpnes IKKE
//    (også når man holder lenge før slipp); bevegelse > 8 px / pointerleave avbryter; contextmenu blokkert, user-select none
//  · dempet: volume_off i rødt, trykk åpner fortsatt pillen, dra pillen → volume_mute false + volume_set
//  Media-popupens Now playing (volum-raden «Trinn», ikon + tall): trykk demper aldri, hold = demp/lyd på + toast,
//  dra trinn-baren mens dempet → slå av demping
// Kjør: node test/volum36-check.mjs
import { createRequire } from 'node:module';
import { readdirSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
mkdirSync('test/.build', { recursive: true });
const bundle = resolve(`test/.build/volum36-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const res = [];
const ok = (name, cond, info) => res.push(`${cond ? '✔' : '✘'} ${name}${info != null && !cond ? ' · ' + JSON.stringify(info) : ''}`);
const SHOT = process.env.SHOT_DIR;
const PID = 'media_player.kjokken_radio';

const common = async (p) => p.evaluate(() => {
  window.deepAll = (sel) => { const out = []; const walk = (root) => root.querySelectorAll('*').forEach((e) => { if (e.matches(sel)) out.push(e); if (e.shadowRoot) walk(e.shadowRoot); }); walk(document); return out; };
  window.deep = (sel) => window.deepAll(sel).find((x) => { const r = x.getBoundingClientRect(); return r.width && r.left >= -1 && r.right <= innerWidth + 1; }) || window.deepAll(sel)[0] || null;
  window.__hap = []; window.addEventListener('haptic', (e) => window.__hap.push(e.detail));
  window.__toasts = []; const T = window.MSH.toast; window.MSH.toast = (t, o) => { window.__toasts.push([t, (o && o.duration) || null]); return T(t, o); };
});

async function setupMini(cfg, { dark = true } = {}) {
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + resolve('test/harness.html'));
  for (const m of readdirSync('test/mock').sort()) await p.addScriptTag({ path: resolve('test/mock/' + m) });
  await p.addScriptTag({ path: bundle });
  await common(p);
  await p.evaluate(async ({ cfg, dark, PID }) => {
    try { sessionStorage.clear(); } catch (e) { /* */ }
    const H = window.mockHass(); H.themes = { ...(H.themes || {}), darkMode: dark }; window.H = H;
    const S = H.states;
    Object.keys(S).filter((k) => k.startsWith('media_player.')).forEach((k) => { S[k] = { ...S[k], state: 'off' }; });
    S[PID] = { ...S[PID], state: 'playing', last_changed: new Date().toISOString(), attributes: { ...S[PID].attributes, volume_level: 0.3, is_volume_muted: false, supported_features: 152461 | 4 | 8 } };
    // volume_mute oppdaterer mock-tilstanden (som HA)
    const cs = H.callService;
    H.callService = (d, s, data) => {
      const r = cs(d, s, data);
      if (d === 'media_player' && s === 'volume_mute') window.__setMuted(data.entity_id, !!data.is_volume_muted);
      return r;
    };
    // ny states-kopi (som HA), så kortet ser endringen
    window.__setMuted = (id, v) => { const o = window.H.states[id]; window.H = { ...window.H, states: { ...window.H.states, [id]: { ...o, attributes: { ...o.attributes, is_volume_muted: v } } } }; const c = deep('msh-navbar-card'); if (c) c.hass = window.H; };
    window.__mute = (v) => window.__setMuted(PID, v);
    const c = document.createElement('msh-navbar-card'); c.setConfig({ type: 'custom:msh-navbar-card', card_id: 'ki-navbar', ...cfg }); c.hass = H;
    document.getElementById('dash').appendChild(c);
    await new Promise((q) => setTimeout(q, 800));
  }, { cfg, dark, PID });
  const cdp = await p.context().newCDPSession(p);
  return { p, errs, cdp };
}
const pt = (p, sel) => p.evaluate((s) => { const e = deep(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, l: r.left, w: r.width }; }, sel);
const touchHold = async (S, x, y, ms, move) => {
  await S.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  if (move) { await S.p.waitForTimeout(60); for (let i = 1; i <= 3; i++) { await S.cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + move * i / 3, y }] }); await S.p.waitForTimeout(20); } }
  await S.p.waitForTimeout(ms);
  await S.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await S.p.waitForTimeout(350);
};
const tapAt = async (S, x, y) => { await S.p.touchscreen.tap(x, y); await S.p.waitForTimeout(350); };
const take = (p) => p.evaluate(() => { const o = { calls: window.__calls.filter((c) => c[0] === 'media_player').map((c) => [c[1], c[2]]), hap: window.__hap.slice(), toasts: window.__toasts.slice() }; window.__calls.length = 0; window.__hap.length = 0; window.__toasts.length = 0; return o; });
const pill = (p) => p.evaluate(() => !!deep('[data-mini] .mvp'));
const mutes = (o) => o.calls.filter((c) => c[0] === 'volume_mute');

for (const [style, dark] of [['white', true], ['glass', true], ['white', false], ['glass', false]]) {
  const tag = `${dark ? 'mørk' : 'lys'} ${style}`;
  const S = await setupMini(style === 'glass' ? { style: 'glass' } : {}, { dark });
  const { p } = S;
  const vb = await pt(p, '[data-mini] .mvb[data-act="mvol"]');
  ok(`${tag}: volumknappen finnes`, !!vb);
  if (!vb) { await p.close(); continue; }
  await take(p);
  // trykk → åpner, haptic light, ingen demping
  await tapAt(S, vb.x, vb.y);
  let o = await take(p);
  ok(`${tag}: trykk → volum-pillen åpnes`, await pill(p));
  ok(`${tag}: trykk demper aldri`, !mutes(o).length, o.calls);
  ok(`${tag}: trykk → haptic light`, o.hap.includes('light') && !o.hap.includes('medium'), o.hap);
  // trykk igjen → lukker
  await tapAt(S, vb.x, vb.y);
  o = await take(p);
  ok(`${tag}: trykk igjen → lukker`, !(await pill(p)) && !mutes(o).length, o.calls);
  // auto-lukk etter 3 s
  await tapAt(S, vb.x, vb.y);
  await p.waitForTimeout(2500);
  const still = await pill(p);
  await p.waitForTimeout(900);
  ok(`${tag}: lukkes automatisk etter 3 s uten bruk`, still && !(await pill(p)), { still });
  await take(p);
  // hold 700 ms (touch) → demp + toast, ingen pille
  await touchHold(S, vb.x, vb.y, 700);
  o = await take(p);
  ok(`${tag}: hold 500 ms → volume_mute true`, mutes(o).length === 1 && mutes(o)[0][1].is_volume_muted === true && mutes(o)[0][1].entity_id === PID, o.calls);
  ok(`${tag}: hold → haptic medium`, o.hap.includes('medium'), o.hap);
  ok(`${tag}: hold → toast «Dempet» 1,4 s`, o.toasts.some((t) => t[0] === 'Dempet' && t[1] === 1400), o.toasts);
  ok(`${tag}: ingen volum-pille etter hold`, !(await pill(p)));
  // dempet: rødt volume_off
  const ic = await p.evaluate(() => { const i = deep('[data-mini] .mvb[data-act="mvol"] ha-icon'); return i ? { icon: i.getAttribute('icon'), col: getComputedStyle(i).color } : null; });
  const red = dark ? 'rgb(242, 128, 115)' : null;
  ok(`${tag}: dempet → volume-off i rødt`, ic && ic.icon === 'mdi:volume-off' && (red ? ic.col === red : /^rgb\((\d+), (\d+), (\d+)\)$/.test(ic.col) && (() => { const [r, g, bb] = ic.col.match(/\d+/g).map(Number); return r > g + 40 && r > bb + 40; })()), ic);
  if (SHOT) await p.screenshot({ path: `${SHOT}/volum36-${dark ? 'mork' : 'lys'}-${style}-dempet.png` });
  // dempet: trykk åpner fortsatt pillen
  await tapAt(S, vb.x, vb.y);
  o = await take(p);
  ok(`${tag}: dempet → trykk åpner pillen (demper ikke)`, (await pill(p)) && !mutes(o).length, o.calls);
  // dra pillen mens dempet → lyd på + volume_set
  const vp = await pt(p, '[data-mini] .mvp');
  await S.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: vp.l + vp.w * 0.3, y: vp.y }] });
  for (let i = 1; i <= 4; i++) { await S.cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: vp.l + vp.w * (0.3 + i * 0.1), y: vp.y }] }); await p.waitForTimeout(50); }
  await S.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(300);
  o = await take(p);
  ok(`${tag}: dra pillen mens dempet → volume_mute false`, mutes(o).length === 1 && mutes(o)[0][1].is_volume_muted === false, o.calls);
  ok(`${tag}: dra pillen → volume_set`, o.calls.some((c) => c[0] === 'volume_set'), o.calls);
  await p.waitForTimeout(3300);
  ok(`${tag}: pillen lukkes 3 s etter siste dra`, !(await pill(p)));
  // hold når dempet → «Lyd på»
  await p.evaluate(() => window.__mute(true)); await p.waitForTimeout(200); await take(p);
  await touchHold(S, vb.x, vb.y, 650);
  o = await take(p);
  ok(`${tag}: hold dempet → volume_mute false + «Lyd på»`, mutes(o).length === 1 && mutes(o)[0][1].is_volume_muted === false && o.toasts.some((t) => t[0] === 'Lyd på' && t[1] === 1400), o);
  ok(`${tag}: ikke-dempet ikon igjen`, await p.evaluate(() => deep('[data-mini] .mvb[data-act="mvol"] ha-icon').getAttribute('icon') !== 'mdi:volume-off'));
  // langt hold (1,6 s) → klikket svelges likevel
  await touchHold(S, vb.x, vb.y, 1600);
  o = await take(p);
  ok(`${tag}: langt hold (1,6 s) → én demping, ingen pille`, mutes(o).length === 1 && !(await pill(p)), o.calls);
  await p.evaluate(() => window.__mute(false)); await p.waitForTimeout(200); await take(p);
  // bevegelse > 8 px avbryter holdet
  await touchHold(S, vb.x, vb.y, 700, 14);
  o = await take(p);
  ok(`${tag}: bevegelse > 8 px avbryter holdet`, !mutes(o).length, o.calls);
  // kort hold (300 ms) = trykk
  await touchHold(S, vb.x, vb.y, 300);
  o = await take(p);
  ok(`${tag}: 300 ms = trykk (pille, ingen demping)`, (await pill(p)) && !mutes(o).length, o.calls);
  await tapAt(S, vb.x, vb.y); await take(p);
  // contextmenu blokkert + CSS
  const cm = await p.evaluate(() => { const e = deep('[data-mini] .mvb[data-act="mvol"]'), ev = new MouseEvent('contextmenu', { bubbles: true, composed: true, cancelable: true }); e.dispatchEvent(ev); const cs = getComputedStyle(e); return { prevented: ev.defaultPrevented, us: cs.userSelect || cs.webkitUserSelect, ta: cs.touchAction, title: e.title }; });
  ok(`${tag}: contextmenu blokkert, user-select none, touch-action manipulation`, cm.prevented && cm.us === 'none' && /manipulation/.test(cm.ta), cm);
  ok(`${tag}: ingen sidefeil`, !S.errs.length, S.errs);
  await p.close();
}

/* ---------------- mus (mini-spiller) */
{
  const S = await setupMini({});
  const { p } = S;
  const vb = await pt(p, '[data-mini] .mvb[data-act="mvol"]');
  await take(p);
  await p.mouse.click(vb.x, vb.y); await p.waitForTimeout(300);
  let o = await take(p);
  ok('mus: klikk → pille, ingen demping', (await pill(p)) && !mutes(o).length, o.calls);
  await p.mouse.click(vb.x, vb.y); await p.waitForTimeout(300); await take(p);
  await p.mouse.move(vb.x, vb.y); await p.mouse.down(); await p.waitForTimeout(700); await p.mouse.up(); await p.waitForTimeout(300);
  o = await take(p);
  ok('mus: hold → volume_mute + «Dempet», ingen pille', mutes(o).length === 1 && o.toasts.some((t) => t[0] === 'Dempet') && !(await pill(p)), o);
  // flytt ut av knappen (pointerleave) før 500 ms → avbrutt
  await p.evaluate(() => window.__mute(false)); await take(p);
  await p.mouse.move(vb.x, vb.y); await p.mouse.down(); await p.waitForTimeout(150);
  await p.mouse.move(vb.x, vb.y - 30, { steps: 3 }); await p.waitForTimeout(600); await p.mouse.up(); await p.waitForTimeout(300);
  o = await take(p);
  ok('mus: dra ut av knappen avbryter holdet', !mutes(o).length, o.calls);
  ok('mus: ingen sidefeil', !S.errs.length, S.errs);
  await p.close();
}

/* ---------------- Media-popupens Now playing (volum-raden «Trinn») */
for (const dark of [true, false]) {
  const tag = `Media ${dark ? 'mørk' : 'lys'}`;
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + resolve('test/harness.html'));
  for (const m of readdirSync('test/mock').sort()) await p.addScriptTag({ path: resolve('test/mock/' + m) });
  await p.addScriptTag({ path: bundle });
  await common(p);
  await p.evaluate(async ({ dark }) => {
    try { localStorage.clear(); } catch (e) { /* */ }
    const h = window.mockHass(); h.themes = { ...(h.themes || {}), darkMode: dark }; window.__h = h;
    const cs = h.callService;
    h.callService = (d, s, data) => {
      const r = cs(d, s, data);
      if (d === 'media_player' && s === 'volume_mute') { const id = data.entity_id, H0 = window.__main.hass, o = H0.states[id]; window.__main.hass = { ...H0, states: { ...H0.states, [id]: { ...o, attributes: { ...o.attributes, is_volume_muted: !!data.is_volume_muted } } } }; }
      return r;
    };
    if (window.MSH.theme && window.MSH.theme.set) window.MSH.theme.set(dark ? 'dark' : 'light');
    const bc = document.createElement('bubble-card');
    bc.setConfig({ type: 'custom:bubble-card', card_type: 'pop-up', hash: '#media' });
    bc.innerHTML = '<div class="pop"><div class="hdr">Media</div><div class="inner"></div></div>';
    document.getElementById('dash').appendChild(bc);
    location.hash = '#media';
    const el = document.createElement('msh-media-card'); el.setConfig({ type: 'custom:msh-media-card', vol_style: 'trinn', vol_style_tv: 'trinn', now_playing: { style: 'detailed' } }); el.hass = h; bc.querySelector('.inner').appendChild(el);
    window.__main = el;
    await new Promise((q) => setTimeout(q, 800));
  }, { dark });
  const cdp = await p.context().newCDPSession(p);
  const S = { p, cdp };
  const q = (sel) => p.evaluate((s) => { const e = window.__main.shadowRoot.querySelector(s); if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, l: r.left, w: r.width }; }, sel);
  const nb = await q('.mvnum[data-vhold]');
  ok(`${tag}: volumknapp (ikon + tall) i Now playing`, !!nb);
  if (!nb) { await p.close(); continue; }
  const pid = await p.evaluate(() => window.__main.shadowRoot.querySelector('.mvr').dataset.vkey);
  await p.waitForTimeout(300); await take(p);
  await tapAt(S, nb.x, nb.y);
  let o = await take(p);
  ok(`${tag}: trykk demper aldri (haptic light)`, !mutes(o).length && o.hap.includes('light'), o);
  await touchHold(S, nb.x, nb.y, 700);
  o = await take(p);
  ok(`${tag}: hold → volume_mute true, haptic medium, «Dempet» 1,4 s`, mutes(o).length === 1 && mutes(o)[0][1].is_volume_muted === true && o.hap.includes('medium') && o.toasts.some((t) => t[0] === 'Dempet' && t[1] === 1400), o);
  await p.waitForTimeout(200);
  const ic = await p.evaluate(() => { const i = window.__main.shadowRoot.querySelector('.mvnum ha-icon'); return i ? { icon: i.getAttribute('icon'), col: getComputedStyle(i).color, muted: window.__main.shadowRoot.querySelector('.mvr').dataset.muted } : null; });
  ok(`${tag}: dempet → volume-off i rødt`, ic && ic.icon === 'mdi:volume-off' && ic.muted === '1' && (() => { const [r, g, bb] = ic.col.match(/\d+/g).map(Number); return r > g + 40 && r > bb + 40; })(), ic);
  if (SHOT) await p.screenshot({ path: `${SHOT}/volum36-media-${dark ? 'mork' : 'lys'}.png` });
  // dra trinn-baren mens dempet → lyd på
  const bars = await q('.mvbars');
  await S.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: bars.l + bars.w * 0.4, y: bars.y }] });
  for (let i = 1; i <= 3; i++) { await S.cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: bars.l + bars.w * (0.4 + i * 0.1), y: bars.y }] }); await p.waitForTimeout(60); }
  await S.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(300);
  o = await take(p);
  ok(`${tag}: dra mens dempet → volume_mute false + volume_set`, mutes(o).length === 1 && mutes(o)[0][1].is_volume_muted === false && mutes(o)[0][1].entity_id === pid && o.calls.some((c) => c[0] === 'volume_set'), o.calls);
  // bevegelse > 8 px avbryter
  await touchHold(S, nb.x, nb.y, 700, 14);
  o = await take(p);
  ok(`${tag}: bevegelse > 8 px avbryter holdet`, !mutes(o).length, o.calls);
  // langt hold → én demping, påfølgende klikk svelges
  await touchHold(S, nb.x, nb.y, 1500);
  o = await take(p);
  ok(`${tag}: langt hold → én demping`, mutes(o).length === 1, o.calls);
  // mus
  await p.mouse.click(nb.x, nb.y); await p.waitForTimeout(250);
  o = await take(p);
  ok(`${tag}: mus-klikk demper ikke`, !mutes(o).length, o.calls);
  await p.mouse.move(nb.x, nb.y); await p.mouse.down(); await p.waitForTimeout(700); await p.mouse.up(); await p.waitForTimeout(300);
  o = await take(p);
  ok(`${tag}: mus-hold → «Lyd på»`, mutes(o).length === 1 && mutes(o)[0][1].is_volume_muted === false && o.toasts.some((t) => t[0] === 'Lyd på'), o);
  const cm = await p.evaluate(() => { const e = window.__main.shadowRoot.querySelector('.mvnum'), ev = new MouseEvent('contextmenu', { bubbles: true, composed: true, cancelable: true }); e.dispatchEvent(ev); const cs = getComputedStyle(e); return { prevented: ev.defaultPrevented, us: cs.userSelect || cs.webkitUserSelect }; });
  ok(`${tag}: contextmenu blokkert, user-select none`, cm.prevented && cm.us === 'none', cm);
  ok(`${tag}: ingen sidefeil`, !errs.length, errs);
  await p.close();
}

await b.close();
res.forEach((r) => console.log(r));
const bad = res.filter((r) => r.startsWith('✘')).length;
console.log(bad ? `volum36-check: ${bad} FEIL` : `volum36-check: OK (${res.length})`);
process.exit(bad ? 1 : 0);
