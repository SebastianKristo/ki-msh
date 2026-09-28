// Fiks 19 · Hjem: 19.3 (Kamera-flis → /dashboard-kamera), 19.10 (søppel på tømmedagen), 19.11 (Fold-logg, ingen bred grid/zoom),
// 19.14 (ingen grå tap-highlight / ripple). Kjør: node test/fiks19-hjem-check.mjs  (SHOTS=<mappe> for skjermbilder)
import { createRequire } from 'node:module';
import { readdirSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
mkdirSync('test/.build', { recursive: true });
const bundle = resolve(`test/.build/f19h-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const res = [];
const ok = (name, cond, info) => res.push(`${cond ? '✔' : '✘'} ${name}${info != null ? ' · ' + JSON.stringify(info) : ''}`);
const SHOTS = process.env.SHOTS || '';

async function page(vp, touch) {
  const p = await b.newPage({ viewport: vp, hasTouch: touch });
  const errs = [], logs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); logs.push(m.text()); });
  await p.goto('file://' + resolve('test/harness.html'));
  for (const m of readdirSync('test/mock').sort()) await p.addScriptTag({ path: resolve('test/mock/' + m) });
  await p.addScriptTag({ path: bundle });
  await p.evaluate(() => {
    window.deepAll = (sel) => { const out = []; const walk = (root) => root.querySelectorAll('*').forEach((e) => { if (e.matches(sel)) out.push(e); if (e.shadowRoot) walk(e.shadowRoot); }); walk(document); return out; };
    window.deep = (sel) => window.deepAll(sel)[0] || null;
  });
  return { p, errs, logs };
}

/* ---------- 19.3 · Kamera-flisen */
{
  const { p, errs } = await page({ width: 430, height: 900 }, true);
  const r = await p.evaluate(async () => {
    const H = window.mockHass();
    const F = document.createElement('msh-hjem-faner-card'); F.setConfig({ type: 'custom:msh-hjem-faner-card', card_id: 'f19' }); F.hass = H;
    document.getElementById('dash').appendChild(F);
    await new Promise((q) => setTimeout(q, 800));
    const stub = customElements.get('msh-hjem-faner-card').getStubConfig(), hstub = customElements.get('msh-hjem-card').getStubConfig();
    const t = F._tileModel('cam', F._E), tap = F._tapFor('cam', 'card', t), ic = F._tapFor('cam', 'ic', t), hold = F._tapFor('cam', 'hold_card', t);
    // brukerens egen handling beholdes
    const keep = { ...F.config, tile_cfg: { cam: { tap_card: { action: 'navigate', navigation_path: '#kamera' } } } }, k0 = F._config; F._config = keep;
    const own = F._tapFor('cam', 'card', t); F._config = k0;
    // trykk: pushState + location-changed
    const nav = []; const ps = history.pushState.bind(history);
    history.pushState = (s, ti, u) => nav.push(u);
    let lc = 0; window.addEventListener('location-changed', () => lc++);
    const el = F.shadowRoot.querySelector('.u.ht[data-k="cam"]');
    const rc = el.getBoundingClientRect();
    const click = (dx) => { el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true, clientX: rc.left + 100, clientY: rc.top + 30 })); el.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, detail: 1, clientX: rc.left + 100 + dx, clientY: rc.top + 30 })); };
    click(0); const n1 = nav.length;
    click(30); const n2 = nav.length; // sveip ≥ 8 px → ikke trykk
    history.pushState = ps;
    const T = window.MSH.hjemTiles, shown = [T.camTapShown({}, 'cam'), T.camTapShown({ tile_cfg: { cam: { tap_card: { action: 'none' } } } }, 'cam'), T.camTapShown({ tap: { cam: { card_hash: '#kamera' } } }, 'cam')];
    return { shown, tap, ic, hold, own, stub: stub.tile_cfg, hstub: (hstub.cards.faner || {}).tile_cfg, nav, n1, n2, lc, label: M_lbl() };
    function M_lbl() { return window.MSH.hjemTiles.tapLabel(tap, 'card'); }
  });
  ok('19.3 standard trykk (kort og ikon) = navigate /dashboard-kamera', r.tap.navigation_path === '/dashboard-kamera' && r.ic.navigation_path === '/dashboard-kamera', { tap: r.tap, ic: r.ic });
  ok('19.3 hold = more-info (uendret)', r.hold.action === 'more-info', r.hold);
  ok('19.3 egen tap_card beholdes', r.own.navigation_path === '#kamera', r.own);
  ok('19.3 getStubConfig (faner + hjem) har tap_card', r.stub.cam.tap_card.navigation_path === '/dashboard-kamera' && r.hstub.cam.tap_card.navigation_path === '/dashboard-kamera', { s: r.stub, h: r.hstub });
  ok('19.3 trykk → pushState(/dashboard-kamera) + location-changed; sveip utløser ikke', r.n1 === 1 && r.nav[0] === '/dashboard-kamera' && r.n2 === 1 && r.lc >= 1, { nav: r.nav, lc: r.lc });
  ok('19.3 etikett «Navigate · /dashboard-kamera»', r.label === 'Navigate · /dashboard-kamera', r.label);
  ok('19.3 editorene viser Navigate /dashboard-kamera som valgt (uten egen handling), ellers brukerens', r.shown[0] && r.shown[0].navigation_path === '/dashboard-kamera' && r.shown[1] === null && r.shown[2] === null, r.shown);
  ok('19.3 ingen feil', !errs.length, errs.slice(0, 3));
  await p.close();
}

/* ---------- 19.10 · søppel på tømmedagen */
for (const w of [360, 390, 430]) {
  const { p, errs } = await page({ width: w, height: 800 }, true);
  const r = await p.evaluate(async (w) => {
    const H = window.mockHass();
    H.states['sensor.neste_tomming'] = { entity_id: 'sensor.neste_tomming', state: '0,Restavfall,Plastavfall', attributes: {} };
    const d = document.createElement('div'); d.style.cssText = `width:${w - 36}px;padding:0 18px`;
    const S = document.createElement('msh-soppel-card'); S.setConfig({ type: 'custom:msh-soppel-card', card_id: 'sop' }); S.hass = H; d.appendChild(S);
    document.getElementById('dash').appendChild(d);
    await new Promise((q) => setTimeout(q, 900));
    const R = S.shadowRoot, tr = R.querySelector('.tr'), a = tr.getBoundingClientRect();
    const inside = [...R.querySelectorAll('.l1,.l2,.n')].every((e) => { const q = e.getBoundingClientRect(); return q.left >= a.left - 0.5 && q.right <= a.right + 0.5 && e.scrollWidth <= e.clientWidth + 1; });
    const cs = getComputedStyle(tr);
    return { h: Math.round(a.height), w: Math.round(a.width), inside, l1: R.querySelector('.l1').textContent, fs: getComputedStyle(R.querySelector('.l1')).fontSize, pad: cs.padding, rad: cs.borderRadius, col: cs.color, bg: cs.backgroundImage };
  }, w);
  ok(`19.10 ${w}px: ca. 120 px høyt, tekst inni`, r.h >= 100 && r.h <= 140 && r.inside && r.l1 === 'Søppel tømmes i dag' && r.fs === '19px' && r.pad === '24px 20px' && r.rad === '30px' && r.col === 'rgb(42, 23, 32)', r);
  if (SHOTS) await p.locator('msh-soppel-card').screenshot({ path: `${SHOTS}/soppel-${w}.png` });
  ok(`19.10 ${w}px ingen feil`, !errs.length, errs.slice(0, 3));
  await p.close();
}

/* ---------- 19.11 · Fold-oppsettet + logg, 19.14 · tap-highlight */
for (const [name, w, touch, fold] of [['fold840', 840, true, true], ['telefon412', 412, true, false]]) {
  const { p, errs, logs } = await page({ width: w, height: 1000 }, touch);
  const r = await p.evaluate(async () => {
    const H = window.mockHass(), d = document.getElementById('dash');
    const hj = document.createElement('msh-hjem-card'); hj.setConfig({ type: 'custom:msh-hjem-card', card_id: 'ki-home' }); hj.hass = H; d.appendChild(hj);
    await new Promise((q) => setTimeout(q, 1200));
    const g = hj.shadowRoot.querySelector('.g'), F = deep('msh-hjem-faner-card'), hf = F.shadowRoot.querySelector('.hf');
    const tile = F.shadowRoot.querySelector('.u.ht'), rk = F.shadowRoot.querySelector('.rk');
    const tp = (e) => (e ? getComputedStyle(e).webkitTapHighlightColor : null);
    return { g: g.className, hf: hf.className, hfStyle: hf.getAttribute('style'), zoom: getComputedStyle(g).zoom, hfZoom: getComputedStyle(hf).zoom,
      tile: tp(tile), rk: tp(rk), html: tp(document.documentElement), body: tp(document.body), ripple: getComputedStyle(F).getPropertyValue('--ha-ripple-color').trim(),
      wide: typeof window.MSH.isWide, hwide: /wide/.test(hf.className) };
  });
  const log = logs.filter((l) => /^\[ki-home\] layout=/.test(l));
  ok(`19.11 ${name}: ${fold ? 'Fold' : 'mobil'}-oppsett, ingen zoom/bred`, (fold ? /fold/.test(r.g) && /fold/.test(r.hf) : !/fold/.test(r.g)) && r.zoom === '1' && r.hfZoom === '1' && !r.hfStyle && !r.hwide && r.wide === 'undefined', r);
  ok(`19.11 ${name}: konsoll «[ki-home] layout=${fold ? 'fold' : 'mobil'} NNNpx» én gang`, log.length === 1 && new RegExp(`layout=${fold ? 'fold' : 'mobil'} \\d+px`).test(log[0]), log);
  const T = 'rgba(0, 0, 0, 0)';
  ok(`19.14 ${name}: tap-highlight transparent (flis, romkort, dokument) og ripple av`, r.tile === T && (r.rk == null || r.rk === T) && r.html === T && r.body === T && r.ripple === 'transparent', r);
  ok(`19.11/19.14 ${name}: ingen feil`, !errs.length, errs.slice(0, 3));
  await p.close();
}
await b.close();
console.log(res.join('\n'));
process.exit(res.some((x) => x.startsWith('✘')) ? 1 : 0);
