// Fiks 25 · 24.3 / 24.4 / 24.5 (Hjem og navbar):
//  · 24.3 strømpris-kortet: dra i «I dag | I morgen» og scrub i grafen åpner aldri #energi (mus og touch, også > 520 ms),
//    > 8 px bevegelse på flaten er aldri et tap; rent trykk på flaten åpner #energi, trykk på segmentet bytter bare dag.
//  · 24.4 Tilpass Hjem → Kort → Søppel: fullt panel (Trykk/Hold, sensor, type-sensor, autoforslag), lagres i søppelkortets
//    config (ki-store cards.<card_id>) og vises i kortet og i GUI-editoren.
//  · 24.5 «Mer»: én «Tilpass»-knapp → bunnark med fem rader i riktig rekkefølge, innenfor ledig flate, som åpner editorene.
import { createRequire } from 'node:module';
import { readdirSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
mkdirSync(resolve('test/.build'), { recursive: true });
const bundle = resolve(`test/.build/f25hjem-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const SHOTS = process.env.SHOTS || '';
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
let fail = 0;
const ok = (c, m, info) => { console.log((c ? 'OK   ' : 'FEIL ') + m + (info != null && !c ? ' · ' + JSON.stringify(info).slice(0, 400) : '')); if (!c) fail++; };

/* ---------------- 24.3 · strømpris-kortet */
{
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + resolve('test/harness.html'));
  for (const m of readdirSync('test/mock').sort()) await p.addScriptTag({ path: resolve('test/mock/' + m) });
  await p.addScriptTag({ path: bundle });
  await p.evaluate(async () => {
    try { localStorage.clear(); } catch (e) { /* */ }
    const h = window.mockHass();
    const el = document.createElement('msh-strompris-card');
    el.setConfig({ type: 'custom:msh-strompris-card', card_id: 'strom_f25' });
    el.hass = h;
    document.getElementById('dash').appendChild(el);
    window.__c = el;
    window.__pops = [];
    const o = window.MSH.openPopup; window.MSH.openPopup = (x) => { window.__pops.push(x); return o ? undefined : undefined; };
    await new Promise((q) => setTimeout(q, 500));
  });
  const R = (sel) => p.evaluate((sel) => { const e = window.__c.shadowRoot.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, cx: r.left + r.width / 2, cy: r.top + r.height / 2 }; }, sel);
  const pops = () => p.evaluate(() => { const x = window.__pops.slice(); window.__pops.length = 0; return x; });
  const day = () => p.evaluate(() => (window.__c.shadowRoot.querySelector('.sg.on') || {}).dataset.d);
  const cdp = await p.context().newCDPSession(p);
  const T = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  const mdrag = async (a, bx, by, ms) => { await p.mouse.move(a.x, a.y); await p.mouse.down(); const n = 10; for (let i = 1; i <= n; i++) { await p.mouse.move(a.x + (bx - a.x) * i / n, a.y + (by - a.y) * i / n); await p.waitForTimeout(ms / n); } await p.mouse.up(); await p.waitForTimeout(250); };
  const tdrag = async (a, bx, by, ms) => { await T('touchStart', a.x, a.y); const n = 10; for (let i = 1; i <= n; i++) { await T('touchMove', a.x + (bx - a.x) * i / n, a.y + (by - a.y) * i / n); await p.waitForTimeout(ms / n); } await T('touchEnd'); await p.waitForTimeout(250); };

  const seg = await R('.seg'), td = await R('.sg[data-d="today"]'), tm = await R('.sg[data-d="tomorrow"]'), plot = await R('.plot'), lg = await R('.lg');
  ok(!!(seg && plot && lg), '24.3 kortet har segment, graf og legende', { seg, plot, lg });
  ok(await p.evaluate(() => { const r = window.__c.shadowRoot; return r.querySelector('.seg').hasAttribute('data-glass-drag') && r.querySelector('.plot').hasAttribute('data-scrub') && getComputedStyle(r.querySelector('.seg')).touchAction === 'pan-y' && getComputedStyle(r.querySelector('.plot')).touchAction === 'pan-y'; }), '24.3 segment [data-glass-drag] og graf [data-scrub], touch-action pan-y');
  // mus: dra I dag → I morgen, sakte (> 520 ms: den gamle hold-feilen)
  await mdrag({ x: td.cx, y: td.cy }, tm.cx, tm.cy, 800);
  ok((await pops()).length === 0, '24.3 mus: dra i segmentet (800 ms) åpner ikke #energi');
  await mdrag({ x: tm.cx, y: tm.cy }, td.cx, td.cy, 200);
  ok((await pops()).length === 0, '24.3 mus: dra tilbake (rask) åpner ikke #energi');
  // touch: dra i segmentet
  await tdrag({ x: td.cx, y: td.cy }, tm.cx, tm.cy, 700);
  ok((await pops()).length === 0, '24.3 touch: dra i segmentet åpner ikke #energi');
  // scrub i grafen (mus og touch), også langsomt
  await mdrag({ x: plot.l + 30, y: plot.cy }, plot.r - 30, plot.cy, 900);
  ok((await pops()).length === 0, '24.3 mus: scrub i grafen åpner ikke #energi');
  await tdrag({ x: plot.l + 30, y: plot.cy }, plot.r - 40, plot.cy + 4, 900);
  ok((await pops()).length === 0, '24.3 touch: scrub i grafen åpner ikke #energi');
  // stille hold i grafen (scrub på stedet) → ingen popup
  await T('touchStart', plot.cx, plot.cy); await p.waitForTimeout(800); await T('touchEnd'); await p.waitForTimeout(250);
  ok((await pops()).length === 0, '24.3 touch: hold i grafen åpner ikke #energi');
  // > 8 px på selve flaten = aldri tap
  await mdrag({ x: lg.l + 20, y: lg.cy }, lg.l + 60, lg.cy + 2, 150);
  ok((await pops()).length === 0, '24.3 flaten: bevegelse > 8 px er ikke et tap');
  // rent trykk på segmentet bytter kun dag
  const d0 = await day();
  const tgt = d0 === 'today' ? tm : td;
  await p.mouse.click(tgt.cx, tgt.cy); await p.waitForTimeout(300);
  const d1 = await day();
  ok((await pops()).length === 0 && (d1 !== d0 || (await p.evaluate(() => window.__c.shadowRoot.querySelector('.sg[data-d="tomorrow"]').disabled))), '24.3 trykk på segmentet bytter dag, åpner ikke #energi', { d0, d1 });
  // rent trykk på flaten → #energi (mus og touch), med litt skjelv (< 8 px)
  await p.mouse.click(lg.l + 20, lg.cy); await p.waitForTimeout(250);
  let P = await pops();
  ok(P.length === 1 && P[0] === '#energi', '24.3 mus: trykk på kortflaten åpner #energi', P);
  await T('touchStart', lg.l + 20, lg.cy); await T('touchMove', lg.l + 24, lg.cy + 2); await T('touchEnd'); await p.waitForTimeout(300);
  P = await pops();
  ok(P.length === 1 && P[0] === '#energi', '24.3 touch: trykk (4 px skjelv) på flaten åpner #energi', P);
  // hold på flaten åpner fortsatt #energi (21.1)
  await T('touchStart', lg.l + 20, lg.cy); await p.waitForTimeout(800); await T('touchEnd'); await p.waitForTimeout(300);
  P = await pops();
  ok(P.length === 1 && P[0] === '#energi', '24.3 hold på flaten åpner #energi én gang (21.1)', P);
  ok(!errs.length, '24.3 ingen sidefeil', errs);
  await p.close();
}

/* ---------------- 24.4 og 24.5 · Tilpass Hjem → Søppel, «Mer» → Tilpass */
{
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + resolve('test/harness.html'));
  await p.evaluate(() => { localStorage.clear(); localStorage.setItem('ki-device-id', 'testenhet'); window.__userData = { ki_dashboard: { onboarded: true } }; });
  for (const m of readdirSync('test/mock').sort()) await p.addScriptTag({ path: resolve('test/mock/' + m) });
  await p.addScriptTag({ path: bundle });
  await p.evaluate(async () => {
    window.deepAll = (sel, root) => { const out = []; const walk = (r) => r.querySelectorAll('*').forEach((e) => { if (e.matches(sel)) out.push(e); if (e.shadowRoot) walk(e.shadowRoot); }); walk(root || document); return out; };
    window.deep = (sel, root) => window.deepAll(sel, root)[0] || null;
    const H = window.mockHass(); window.H = H;
    window.MSH.lastHass = H;
    await window.MSH.store.load(H);
    window.__view = await window.MSH.generateDashboardView({}, H);
    const hc = window.__view.cards[0].cards.find((c) => c.type === 'custom:msh-hjem-card');
    const hj = document.createElement('msh-hjem-card'); hj.setConfig(hc); hj.hass = H;
    const nb = document.createElement('msh-navbar-card'); const nc = window.__view.cards[0].cards.find((c) => c.type === 'custom:msh-navbar-card'); nb.setConfig(nc); nb.hass = H;
    document.getElementById('dash').append(hj, nb);
    await new Promise((q) => setTimeout(q, 1500));
  });
  const top = () => p.evaluate(() => { const P = window.MSH.portals(); return P.length ? P.length - 1 : -1; });
  const q = (sel) => p.evaluate((sel) => { const P = window.MSH.portals(), r = P[P.length - 1].shadowRoot; return !!r.querySelector(sel); }, sel);
  const click = (sel) => p.evaluate((sel) => { const P = window.MSH.portals(), r = P[P.length - 1].shadowRoot, el = r.querySelector(sel); if (!el) return false; el.click(); return true; }, sel);

  /* 24.4 */
  await p.evaluate(() => window.MSH.openHomeEditor({ focus: 'kort' })); await p.waitForTimeout(600);
  ok(await q('[data-a="blked"][data-v="soppel"]'), '24.4 Kort på Hjem: Søppel-raden har oppsett (chevron)');
  await click('button[data-a="blked"][data-v="soppel"]'); await p.waitForTimeout(400);
  const pan = await p.evaluate(() => { const P = window.MSH.portals(), r = P[P.length - 1].shadowRoot, t = r.querySelector('[data-key="tr-ed"]'); if (!t) return null; return { txt: t.innerText.replace(/\s+/g, ' '), taps: t.querySelectorAll('msh-tap-picker[data-in="trtap"]').length, pk: [...t.querySelectorAll('msh-entity-picker[data-in="trent"]')].map((e) => e.dataset.f), sug: [...t.querySelectorAll('[data-a="trsug"]')].map((e) => e.dataset.f + ':' + e.dataset.v) }; });
  ok(pan && /Søppelkort på Hjem/.test(pan.txt) && !/Ingen oppsett/.test(pan.txt), '24.4 panelet «Søppelkort på Hjem» vises (ikke «Ingen oppsett»)', pan);
  ok(pan && pan.taps === 2 && /Trykk/.test(pan.txt) && /Hold/.test(pan.txt), '24.4 handlinger for Trykk og Hold (20.2-valgene)', pan);
  ok(pan && pan.pk.join() === 'sensor,type_sensor', '24.4 sensor (dager) og type-sensor med entitetsvelger', pan);
  ok(pan && pan.sug.includes('type_sensor:sensor.soppel_type'), '24.4 autoforslag fra søppel/avfall-entiteter', pan);
  // velg forslag + endre trykk-handlingen → Ferdig
  await click('[data-a="trsug"][data-f="type_sensor"][data-v="sensor.soppel_type"]'); await p.waitForTimeout(200);
  await p.evaluate(() => { const P = window.MSH.portals(), r = P[P.length - 1].shadowRoot, el = r.querySelector('msh-tap-picker[data-w="tap_action"]'); el.dispatchEvent(new CustomEvent('value-changed', { detail: { value: { action: 'navigate', navigation_path: '#avfall' } }, bubbles: true, composed: true })); });
  await p.waitForTimeout(300);
  const pv = await p.evaluate(() => { const c = window.deep('msh-soppel-card'); return c && c.config ? { ts: c.config.type_sensor, tap: c.config.tap_action } : null; });
  ok(pv && pv.ts === 'sensor.soppel_type' && pv.tap && pv.tap.navigation_path === '#avfall', '24.4 forhåndsvisning: søppelkortet får endringene', pv);
  await click('[data-a="done"]'); await p.waitForTimeout(1500);
  const saved = await p.evaluate(() => { const d = (window.__userData || {}).ki_dashboard || {}, id = (window.MSH.CARD_IDS || {}).soppel; return JSON.parse(JSON.stringify(((d.cards || {})[id]) || null)); });
  ok(saved && saved.type_sensor === 'sensor.soppel_type' && saved.tap_action && saved.tap_action.navigation_path === '#avfall', '24.4 Ferdig: lagret i søppelkortets config (ki-store)', saved);
  // kortet: trykk kjører handlingen (#avfall)
  const run = await p.evaluate(async () => { const c = window.deep('msh-soppel-card'); const a = window.MSH.hjemTrashAct(c.config, 'tap_action'); return a; });
  ok(run && run.action === 'popup' && run.hash === '#avfall', '24.4 kortet: trykk = popup #avfall', run);
  // GUI-editoren (getConfigElement) viser samme valg
  const gui = await p.evaluate(async () => {
    const C = customElements.get('msh-soppel-card'), e = C.getConfigElement(), live = window.deep('msh-soppel-card');
    e.hass = window.H; e.setConfig(live._rawConfig || live.config);
    document.getElementById('dash').appendChild(e);
    await new Promise((q) => setTimeout(q, 400));
    // 30.3: felles handlingsvelger (msh-tap-picker) i stedet for nedtrekksliste + hash-felt
    const R = e.shadowRoot, tp = R.querySelector('msh-tap-picker[data-name="tap_action"]'), ts = R.querySelector('[data-name="type_sensor"]');
    const out = { tap: tp && tp.mode, hash: tp && tp.value && tp.value.navigation_path, ts: ts && (ts.value || ts.getAttribute('value')) };
    e.remove();
    return out;
  });
  ok((gui.tap === 'popup' || gui.tap === 'hash') && gui.hash === '#avfall' && gui.ts === 'sensor.soppel_type', '24.4 GUI-editoren viser de lagrede valgene', gui);

  /* 24.5 */
  await p.evaluate(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); await new Promise((q) => setTimeout(q, 350)); });
  const openMenu = () => p.evaluate(async () => { const btn = window.deep('nav.nb [data-id="__more"]'); if (!btn) return null; btn.click(); await new Promise((q) => setTimeout(q, 500)); return window.deepAll('.mbox .mi').map((e) => e.dataset.id).filter((x) => x.startsWith('__')); });
  const tools = await openMenu();
  ok(tools && tools.length === 1 && tools[0] === '__tilpass', '24.5 «Mer» har én «Tilpass»-knapp (ingen Kiosk/Tilpass navbar/header/Hjem/alt)', tools);
  const menuTxt = await p.evaluate(() => (window.deep('.mbox') || {}).innerText || '');
  ok(!/Tilpass navbar|Tilpass header|Tilpass Hjem|Tilpass alt|Kiosk/.test(menuTxt) && /Tilpass/.test(menuTxt), '24.5 menyteksten', menuTxt);
  const openSheet = async () => { if (!(await p.evaluate(() => !!window.deep('.mbox .mi[data-id="__tilpass"]')))) await openMenu(); await p.evaluate(async () => { window.__hap = []; window.deep('.mbox .mi[data-id="__tilpass"]').click(); await new Promise((q) => setTimeout(q, 450)); }); };
  await openSheet();
  const sh = await p.evaluate(() => {
    const h = window.MSH.portals().find((x) => x.hasAttribute('data-tilpass')); if (!h) return null;
    const r = h.shadowRoot, s = r.querySelector('.sh'), sr = s.getBoundingClientRect(), cs = getComputedStyle(s), nav = window.deep('nav.nb'), nr = nav && nav.getBoundingClientRect();
    const rows = [...r.querySelectorAll('.tpr')], row0 = rows[0] && rows[0].getBoundingClientRect(), ic = r.querySelector('.tpi'), card = r.querySelector('.tpc');
    return { rows: rows.map((e) => e.dataset.v), titles: rows.map((e) => e.querySelector('b').textContent), subs: rows.map((e) => e.querySelector('i').textContent), h0: row0 && Math.round(row0.height),
      title: (r.querySelector('.tpt') || {}).textContent, done: (r.querySelector('.tpd') || {}).textContent, rad: cs.borderTopLeftRadius, bg: cs.backgroundColor, cardBg: card && getComputedStyle(card).backgroundColor, cardR: card && getComputedStyle(card).borderTopLeftRadius,
      ic: ic && [Math.round(ic.getBoundingClientRect().width), getComputedStyle(ic).backgroundColor], sheetB: sr.bottom, sheetT: sr.top, navT: nr && nr.top, navB: nr && nr.bottom,
      hostZ: +getComputedStyle(h).zIndex || 0, overNav: !!nr && window.MSH.overlayRoot().getRootNode().elementFromPoint(nr.left + nr.width / 2, nr.top + nr.height / 2) === h, navZ: (() => { let e = nav, z = 0; while (e) { const zz = +getComputedStyle(e).zIndex; if (zz) z = zz; e = e.parentElement || (e.getRootNode() && e.getRootNode().host); } return z; })(), occB: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ki-nav-occ-bottom')) || 0, vh: innerHeight, left: sr.left, D: window.MSH.dashRect() };
  });
  ok(sh && sh.rows.join().replace(/,devices$/, '') === 'alt,home,navbar,header,kiosk', '24.5 arket: Tilpass alt · Hjem · navbar · header · Kiosk-modus (+ Enheter, fiks 35)', sh && sh.rows);
  ok(sh && sh.title === 'Tilpass' && /Ferdig/.test(sh.done) && sh.rad === '28px' && sh.cardR === '24px' && sh.cardBg === 'rgb(58, 58, 58)' && sh.h0 === 64 && sh.ic && sh.ic[0] === 40 && sh.ic[1] === 'rgb(64, 64, 64)', '24.5 arket: tittel/Ferdig, radius 28 (28.8/28.11), kort #3a3a3a r24, rader 64 px, ikon-sirkel 40 #404040', sh);
  ok(sh && sh.subs[0] === 'Veiviser for hele dashbordet' && /^(På|Av)$/.test(sh.subs[4]), '24.5 underteksten (Kiosk På/Av)', sh && sh.subs);
  // 28.8/28.11: arket går helt til bunnen (top 50 px) og ligger OVER navbaren (dekker den)
  ok(sh && sh.navT != null && Math.abs(sh.sheetB - sh.vh) <= 1 && Math.abs(sh.sheetT - 52) <= 1 && sh.sheetB >= sh.navB - 1 && sh.hostZ > sh.navZ && sh.overNav, '28.8 arket går til bunnen (top 52, Fiks 40) og dekker navbaren', sh && { sheetT: sh.sheetT, sheetB: sh.sheetB, vh: sh.vh, navT: sh.navT, navB: sh.navB, hostZ: sh.hostZ, navZ: sh.navZ, overNav: sh.overNav });
  ok(sh && sh.left >= sh.D.left - 1, '24.5 arket holder seg innenfor dashbordflaten (HA-sidebaren)', sh);
  if (SHOTS) await p.screenshot({ path: SHOTS + '/f25-tilpass.png' });
  // hver rad lukker arket og åpner riktig editor
  const got = {};
  for (const k of ['alt', 'home', 'navbar', 'header', 'kiosk']) {
    if (k !== 'alt') await openSheet();
    const r = await p.evaluate(async (k) => {
      const ev = []; const on = (e) => ev.push(e.detail && e.detail.editor); window.addEventListener('ki-open-editor', on);
      const M = window.MSH, ks = M.kioskSheet; let kiosk = 0; M.kioskSheet = (...a) => { kiosk++; return ks ? ks(...a) : null; };
      const h = M.portals().find((x) => x.hasAttribute('data-tilpass'));
      h.shadowRoot.querySelector(`.tpr[data-v="${k}"]`).click();
      await new Promise((q) => setTimeout(q, 500));
      window.removeEventListener('ki-open-editor', on); M.kioskSheet = ks;
      const still = M.portals().some((x) => x.hasAttribute('data-tilpass'));
      const n = M.portals().length;
      return { ev, kiosk, still, n };
    }, k);
    got[k] = r;
    await p.evaluate(async () => { for (let i = 0; i < 3; i++) { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); await new Promise((q) => setTimeout(q, 300)); } document.querySelectorAll('msh-navbar-editor,.msh-sheet').forEach((e) => e.remove()); });
  }
  const want = { alt: 'tilpass-alt', home: 'home', navbar: 'navbar', header: 'header' };
  ok(Object.keys(want).every((k) => got[k].ev.includes(want[k]) && !got[k].still && got[k].n >= 1) && got.kiosk.kiosk === 1 && !got.kiosk.still, '24.5 radene lukker arket og åpner Tilpass alt / Hjem / navbar / header / Kiosk', got);
  ok(!errs.length, '24.4/24.5 ingen sidefeil', errs);
  await p.close();
}
await b.close();
console.log(fail ? `fiks25-hjem-check: ${fail} FEIL` : 'fiks25-hjem-check: OK');
process.exit(fail ? 1 : 0);
