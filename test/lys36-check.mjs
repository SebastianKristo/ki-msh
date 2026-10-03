// Fiks 36.8 · ny «Tilpass lys» (fasit Lys v5.dc.html → data-screen-label="Tilpass lys") mot EKTE Bubble Card, 390 px, touch.
//   · arket (38.2): åpner i FULL høyde som de andre Tilpass-arkene (dashbordflaten − 52 px, bunnforankret, maks 440 px
//     sentrert), helt dekkende --ki-popup (#282828 / lys #f0f0f0), radius 38 øverst, ingen bakteppe, portalet ut av popupen
//     (ki-overlay-root); håndtaket → halv (58 %): popupen synlig/trykkbar/scrollbar bak med ekstra bunnluft; → full igjen;
//     tilstanden huskes ikke (åpner i full høyde igjen etter Ferdig)
//   · header «Tilpass lys» + «Endringer vises live bak arket», Nullstill (#3a3a3a) + rosa Ferdig; faner Faner · Rom ·
//     Scener · Utelys · Design · Visning (aktiv viser navn, rosa)
//   · Faner: Startfane-chips (MSH.startTab) + «Start»-pille, touch-dra på håndtaket → tab_order live i popupen uten at
//     popupen lukkes, øye skjuler (minst én synlig)
//   · Rom: navn → popupen, gruppe (lenke 2 lys → «Gang · alle · 2 lys», gul kant, slider styrer begge), flytt lys til
//     annet rom (light_room), skjul lys (hide_lights)
//   · Scener: ikon/farge → popupen, legg til fra HA (extra_scenes), aldri aktiv-tilstand etter trykk
//   · Design: fanestil (5), etiketter, tannhjul venstre, fanehøyde 56 (tannhjul 64), scenestil, romoverskrift, brytere
//   · Visning: kolonner 3, slider-høyde 64, av-farge, Én farge, fargetemperatur, Mellomrom-kortet dekkende
//   · Ferdig lagrer nye nøkler (én gang, haptic success); eldre v4-nøkler migreres; GUI-editoren har samme nøkler
//   · lys modus: arket #f0f0f0, kort hvite, tekst ≥ 4,5:1
// Kjør: node test/lys36-check.mjs   (SHOTS=dir → skjermbilder)
import { createRequire } from 'node:module';
import { readdirSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const R = resolve('.') + '/';
mkdirSync('test/.build', { recursive: true });
mkdirSync('test/.vendor', { recursive: true });
const BC = resolve('test/.vendor/bubble-card.js');
if (!existsSync(BC)) execFileSync('curl', ['-sSL', '-o', BC, 'https://raw.githubusercontent.com/Clooos/Bubble-Card/main/dist/bubble-card.js']);
const bundle = resolve(`test/.build/l36-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const mocks = readdirSync(R + 'test/mock').filter((f) => f.endsWith('.js')).sort().map((f) => R + 'test/mock/' + f);
const SHOTS = process.env.SHOTS || '';
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const browser = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const res = [];
let fails = 0;
const ok = (name, cond, info) => { if (!cond) fails++; res.push(`${cond ? '✔' : '✘'} ${name}${info != null && !cond ? ' · ' + JSON.stringify(info) : ''}`); };

async function boot(cfg, dark = true) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('file://' + R + 'test/harness-bubble.html');
  for (const m of mocks) await page.addScriptTag({ path: m });
  await page.addScriptTag({ path: bundle });
  await page.addScriptTag({ path: BC, type: 'module' });
  await page.waitForFunction(() => customElements.get('bubble-card'), null, { timeout: 15000 });
  await page.evaluate(async ({ cfg, dark }) => {
    try { localStorage.clear(); } catch (e) { /* */ }
    const wait = (window.wait = (ms) => new Promise((q) => setTimeout(q, ms)));
    window.deepAll = (sel, root) => { const out = []; const walk = (r) => r.querySelectorAll('*').forEach((e) => { if (e.matches(sel)) out.push(e); if (e.shadowRoot) walk(e.shadowRoot); }); walk(root || document); return out; };
    const H = (window.H = window.mockHass()); H.themes = { ...(H.themes || {}), darkMode: dark };
    H.floors.forste = { ...H.floors.forste, name: '1. etasje' }; H.floors.andre = { ...H.floors.andre, name: '2. etasje' };
    window.HAP = []; window.addEventListener('haptic', (e) => window.HAP.push(e.detail));
    window.CALLS = []; const cs = H.callService; H.callService = (d, s, data) => { window.CALLS.push([d, s, data]); return cs ? cs.call(H, d, s, data) : Promise.resolve(); };
    if (window.MSH.store && window.MSH.store.load) await window.MSH.store.load(H);
    const bc = document.createElement('bubble-card');
    bc.setConfig({ type: 'custom:bubble-card', card_type: 'pop-up', hash: '#lys', name: 'Lys', icon: 'mdi:lightbulb', margin_top_mobile: '50px', bg_opacity: 100, bg_blur: 0, cards: [{ type: 'custom:msh-lys-card', card_id: 'l36', ...cfg }] });
    bc.hass = H; document.getElementById('dash').appendChild(bc);
    await wait(400); location.hash = '#lys'; await wait(1300);
    window.L = () => deepAll('msh-lys-card').find((e) => e.getClientRects().length) || deepAll('msh-lys-card')[0];
    window.SR = () => L().shadowRoot;
    window.SHR = () => L()._sheet && L()._sheet.ov.root;
    window.D = () => L()._sheet.st.draft;
    window.rect = (el) => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2, b: r.bottom }; };
    window.popOpen = () => location.hash === '#lys' && deepAll('.bubble-pop-up').some((p) => p.classList.contains('is-popup-opened'));
    window.labels = () => [...SR().querySelectorAll('.mtb-t')].map((b) => b.textContent.trim());
    window.tabIds = () => [...SR().querySelectorAll('.mtb-t')].map((b) => b.dataset.v);
    window.go = async (t) => { SHR().querySelector(`[data-a="page"][data-p="${t}"]`).click(); await wait(250); };
    window.lum = (c) => { const m = /rgba?\(([^)]+)\)/.exec(c); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return { l: 0.2126 * f(p[0]) + 0.7152 * f(p[1]) + 0.0722 * f(p[2]), a: p.length > 3 ? p[3] : 1 }; };
  }, { cfg, dark });
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
  const tap = async (p) => { await touch('touchStart', [{ x: p.cx, y: p.cy }]); await page.waitForTimeout(40); await touch('touchEnd', []); await page.waitForTimeout(350); };
  return { page, errs, touch, tap, wait: (ms) => page.waitForTimeout(ms) };
}

/* ================================================================ mørk modus: hele arket */
{
  const { page, errs, touch, tap, wait } = await boot({});
  // åpne med tannhjulet (touch)
  const g = await page.evaluate(() => rect(SR().querySelector('.mtb-g')));
  await tap(g); await wait(600);
  const sh = await page.evaluate(() => {
    const S = L()._sheet; if (!S) return null;
    const host = S.ov.host, sh0 = S.ov.root.querySelector('.sh'), cs = getComputedStyle(sh0), bg = S.ov.root.querySelector('.bg');
    const inPopup = !!host.closest('.bubble-pop-up') || deepAll('.bubble-pop-up').some((p) => p.contains(host));
    const hdr = S.ov.root.querySelector('.hdr'), tt = hdr.querySelector('.tt'), ts = hdr.querySelector('.ts');
    const rst = S.ov.root.querySelector('[data-a="reset"]'), done = S.ov.root.querySelector('[data-a="done"]');
    const tabs = [...S.ov.root.querySelectorAll('.et [data-a="page"]')];
    return {
      root: host.getRootNode() && host.getRootNode().host && host.getRootNode().host.localName, inPopup, hostPE: getComputedStyle(host).pointerEvents,
      bg: cs.backgroundColor, bf: cs.backdropFilter, r: cs.borderTopLeftRadius + ' ' + cs.borderTopRightRadius + ' ' + cs.borderBottomLeftRadius,
      h: Math.round(sh0.getBoundingClientRect().height), hostH: Math.round(host.getBoundingClientRect().height), scrim: bg ? getComputedStyle(bg).display : 'none',
      geo: (() => { const a = sh0.getBoundingClientRect(), b = host.getBoundingClientRect(); return { top: Math.round(a.top - b.top), bot: Math.round(b.bottom - a.bottom), w: Math.round(a.width), cx: Math.round(a.left + a.width / 2 - (b.left + b.width / 2)), full: sh0.classList.contains('full'), half: sh0.classList.contains('half'), anim: getComputedStyle(sh0).transitionProperty }; })(),
      title: tt.textContent.trim(), tfs: getComputedStyle(tt).fontSize, tfw: getComputedStyle(tt).fontWeight, sub: ts.textContent.trim(),
      rst: [rst.textContent.trim(), getComputedStyle(rst).backgroundColor], done: [done.textContent.trim(), getComputedStyle(done).backgroundImage.slice(0, 15)],
      tabs: tabs.map((b) => [b.dataset.p, b.classList.contains('on'), b.textContent.trim()]),
      onBg: getComputedStyle(tabs.find((b) => b.classList.contains('on'))).backgroundImage.slice(0, 15),
      draftOk: S.ov.body.querySelector('.lys-sheet') && JSON.stringify(S.ov.body.querySelector('.lys-sheet')._config) === JSON.stringify(L()._sheet.st.draft),
    };
  });
  ok('arket åpnes fra tannhjulet (touch) og er portalet til ki-overlay-root, ikke i popupen', sh && sh.root === 'ki-overlay-root' && !sh.inPopup, sh);
  if (sh) {
    ok('arket: helt dekkende #282828, ingen backdrop-filter, radius 38 38 0', sh.bg === 'rgb(40, 40, 40)' && sh.bf === 'none' && sh.r === '38px 38px 0px', sh);
    ok('38.2 · arket åpner i FULL høyde (dashbordflaten − 52 px), bunnforankret, maks 440 px sentrert, glir inn (transform)', sh.geo.full && !sh.geo.half && Math.abs(sh.h - (sh.hostH - 52)) <= 2 && sh.geo.top === 52 && sh.geo.bot === 0 && sh.geo.w <= 440 && Math.abs(sh.geo.cx) <= 1 && /transform/.test(sh.geo.anim), { h: sh.h, H: sh.hostH, geo: sh.geo });
    ok('arket: ingen bakteppe, verten slipper trykk gjennom', sh.scrim === 'none' && sh.hostPE === 'none', sh);
    ok('header: «Tilpass lys» 24/600 + «Endringer vises live bak arket», Nullstill #3a3a3a + rosa Ferdig', sh.title === 'Tilpass lys' && sh.tfs === '24px' && sh.tfw === '600' && sh.sub === 'Endringer vises live bak arket' && sh.rst[0] === 'Nullstill' && sh.rst[1] === 'rgb(58, 58, 58)' && sh.done[0] === 'Ferdig' && /gradient/.test(sh.done[1]), sh);
    ok('faner i arket: Faner · Rom · Scener · Utelys · Design · Visning, aktiv viser navn (rosa)', JSON.stringify(sh.tabs.map((t) => t[0])) === JSON.stringify(['tabs', 'rooms', 'scenes', 'out', 'design', 'vis']) && sh.tabs[0][1] && sh.tabs[0][2] === 'Faner' && sh.tabs.slice(1).every((t) => !t[2]) && /gradient/.test(sh.onBg), sh.tabs);
    ok('utkastet ligger på .lys-sheet._config (samme config som GUI-editoren)', sh.draftOk);
  }
  // full høyde: ingen ekstra bunnluft i popupen
  const pb0 = await page.evaluate(() => L().style.paddingBottom);
  ok('full høyde ved åpning: popupen har vanlig bunnluft (ikke arkets høyde i tillegg)', !/^calc\(calc\(/.test(pb0), pb0);
  // håndtaket → halv høyde (58 %)
  await tap(await page.evaluate(() => rect(SHR().querySelector('[data-a="height"]')))); await wait(500);
  const hv = await page.evaluate(() => { const s = SHR().querySelector('.sh'); return { full: s.classList.contains('full'), half: s.classList.contains('half'), h: Math.round(s.getBoundingClientRect().height), H: Math.round(L()._sheet.ov.host.getBoundingClientRect().height), pressed: SHR().querySelector('[data-a="height"]').getAttribute('aria-pressed') }; });
  ok('håndtaket bytter til halv høyde (58 % av dashbordflaten)', !hv.full && hv.half && Math.abs(hv.h - hv.H * 0.58) <= 2 && hv.pressed === 'true', hv);
  // popupen bak: synlig, trykkbar og scrollbar, med ekstra bunnluft
  const behind = await page.evaluate(async () => {
    const c = L(), t = SR().querySelector('.mtb-t:not(.on)'), r = rect(t);
    const hit = document.elementFromPoint(r.cx, r.cy);
    const inPopup = !!hit && (hit === c || deepAll('*', document).includes(hit)) && !!hit.closest && !hit.closest('ki-overlay-root');
    const pb = c.style.paddingBottom;
    let sc = c; while (sc && sc !== document.body) { const cs = getComputedStyle(sc); if (/(auto|scroll)/.test(cs.overflowY) && sc.scrollHeight > sc.clientHeight + 2) break; sc = sc.parentElement || (sc.getRootNode && sc.getRootNode().host); }
    return { inPopup, hit: hit && hit.localName, pb, scroll: sc && sc !== document.body ? { sh: sc.scrollHeight, ch: sc.clientHeight } : null, x: r.cx, y: r.cy };
  });
  ok('popupen bak arket er synlig og trykkbar (ingen bakteppe over)', behind.inPopup, behind);
  ok('popupen får ekstra bunnluft mens arket er halvt (og kan scrolles)', /^calc\(calc\(/.test(behind.pb) && /\+ \d{3}px\)$/.test(behind.pb) && behind.scroll && behind.scroll.sh > behind.scroll.ch, behind);
  // trykk på en fane i popupen bak arket bytter fane, arket står
  await page.mouse.click(behind.x, behind.y); await wait(500);
  const t2 = await page.evaluate(() => ({ cur: L()._curTab(), open: !!(L()._sheet && !L()._sheet.ov.closed), pop: popOpen() }));
  ok('trykk i popupen bak bytter fane, arket og popupen står åpne', t2.open && t2.pop, t2);
  // håndtaket: halv → full → halv
  const hd = await page.evaluate(() => rect(SHR().querySelector('[data-a="height"]')));
  await tap(hd); await wait(500);
  const full = await page.evaluate(() => { const s = SHR().querySelector('.sh'); return { full: s.classList.contains('full'), h: Math.round(s.getBoundingClientRect().height), H: Math.round(L()._sheet.ov.host.getBoundingClientRect().height), pb: L().style.paddingBottom }; });
  ok('håndtaket bytter tilbake til full høyde (100 % − 52 px), bunnluften tilbake til normal', full.full && Math.abs(full.h - (full.H - 52)) <= 2 && !/^calc\(calc\(/.test(full.pb) && !full.pb.includes(Math.round(full.H * 0.58) + 'px'), full);
  await tap(await page.evaluate(() => rect(SHR().querySelector('[data-a="height"]')))); await wait(500);
  const half = await page.evaluate(() => { const s = SHR().querySelector('.sh'); return { full: s.classList.contains('full'), h: Math.round(s.getBoundingClientRect().height) }; });
  ok('… og tilbake til halv høyde', !half.full && half.h < full.h - 100, half);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/lys36-faner.png` });

  /* ---------- Faner */
  const fa = await page.evaluate(() => {
    const r = SHR();
    return { chips: [...r.querySelectorAll('[data-mst-field] [data-mst]')].map((b) => b.dataset.mst), pill: [...r.querySelectorAll('[data-mst-pill]')].map((p) => p.dataset.mstPill), rows: [...r.querySelectorAll('[data-row="tab"]')].map((x) => x.dataset.id), ta: getComputedStyle(r.querySelector('[data-drag="tab"]')).touchAction };
  });
  ok('Faner: Startfane-chips + «Sist brukte», «Start»-pille på startfanen, radliste med håndtak (touch-action none)', fa.chips.includes('last') && fa.chips.length === fa.rows.length + 1 && fa.pill.length === 1 && fa.rows.length === 4 && fa.ta === 'none', fa);
  // velg startfane «2. etg»
  await page.evaluate(() => SHR().querySelector('[data-mst="f:andre"]').click()); await wait(300);
  const st1 = await page.evaluate(() => ({ st: D().start_tab, pill: [...SHR().querySelectorAll('[data-mst-pill]')].map((p) => p.dataset.mstPill), cur: L()._curTab() }));
  ok('Startfane-valg → start_tab, «Start»-pillen flytter seg, popupen viser fanen', st1.st === 'f:andre' && st1.pill.join() === 'f:andre' && st1.cur === 'f:andre', st1);
  // touch-dra første rad nederst
  const before = await page.evaluate(() => tabIds());
  const dd = await page.evaluate(() => { const rows = [...SHR().querySelectorAll('[data-row="tab"]')]; return { a: rect(rows[0].querySelector('[data-drag]')), z: rect(rows[rows.length - 1]) }; });
  await page.evaluate(() => { window.HAP = []; });
  await touch('touchStart', [{ x: dd.a.cx, y: dd.a.cy }]);
  for (let i = 1; i <= 12; i++) { await touch('touchMove', [{ x: dd.a.cx, y: dd.a.cy + ((dd.z.cy + 10 - dd.a.cy) * i) / 12 }]); await wait(20); }
  await touch('touchEnd', []); await wait(600);
  const dr = await page.evaluate(() => ({ ord: D().tab_order, ids: tabIds(), pop: popOpen(), open: !!(L()._sheet && !L()._sheet.ov.closed), hap: window.HAP.slice() }));
  ok('Faner: touch-dra på håndtaket → tab_order (fane-id) live i popupens fanelinje, popupen lukkes ikke', dr.ord && dr.ord[dr.ord.length - 1] === before[0] && JSON.stringify(dr.ids) === JSON.stringify(dr.ord) && dr.pop && dr.open && dr.hap.includes('medium'), { before, ...dr });
  // øye: skjul «Lys på» → borte fra popupen; minst én synlig
  await page.evaluate(() => SHR().querySelector('[data-a="teye"][data-k="on"]').click()); await wait(300);
  const e1 = await page.evaluate(() => ({ hid: D().hide_tabs, ids: tabIds() }));
  ok('Faner: øyet skjuler fanen (hide_tabs) live i popupen', JSON.stringify(e1.hid) === '["on"]' && !e1.ids.includes('on'), e1);
  await page.evaluate(async () => { for (const k of ['out', 'f:forste', 'f:andre']) { SHR().querySelector(`[data-a="teye"][data-k="${k}"]`).click(); await wait(150); } });
  const e2 = await page.evaluate(() => ({ hid: D().hide_tabs, ids: tabIds() }));
  ok('Faner: minst én fane forblir synlig', e2.ids.length === 1 && e2.hid.length === 3, e2);
  await page.evaluate(async () => { for (const k of ['out', 'f:forste', 'on']) { const b = SHR().querySelector(`[data-a="teye"][data-k="${k}"]`); if (b && b.classList.contains('hid')) { b.click(); await wait(150); } } });

  /* ---------- Rom */
  await page.evaluate(() => go('rooms'));
  await page.evaluate(async () => { L().setUI({ tab: 'f:forste' }); await wait(300); SHR().querySelector('[data-a="rtog"][data-k="gang"]').click(); await wait(300); });
  const rm = await page.evaluate(() => ({ floors: [...SHR().querySelectorAll('.capf')].map((x) => x.textContent.trim()), rows: [...SHR().querySelectorAll('[data-row="room"]')].map((x) => x.dataset.id), lights: [...SHR().querySelectorAll('[data-row="light"]')].map((x) => x.dataset.id), meta: SHR().querySelector('[data-row="room"][data-id="gang"] .meta').textContent }));
  ok('Rom: per etasje, rader med navn/«N lys»/øye, utvidet viser lysene', rm.floors.length >= 2 && rm.rows.includes('gang') && rm.lights.length === 2 && rm.meta === '2 lys', rm);
  // gruppe: lenk begge lysene i Gang
  await page.evaluate(async () => { for (let i = 0; i < 2; i++) { SHR().querySelectorAll('[data-a="grp"][data-room="gang"]')[i].click(); await wait(200); } });
  const gr = await page.evaluate(() => { const g = SR().querySelector('.lgr[data-grp="gang"]'), ls = g && g.querySelector('msh-light-slider'); return { cfg: D().groups, box: !!SHR().querySelector('.gbox'), row: ls && ls.shadowRoot ? [...ls.shadowRoot.querySelectorAll('.n, .v')].map((e) => e.textContent).join(' ').replace(/\s+/g, ' ').trim() : null, ents: ls && ls.config.entities, sh: g && getComputedStyle(g).boxShadow, rows: [...SR().querySelectorAll('[data-key="r-gang"] .lsl:not([data-lc^="grp:"])')].length }; });
  ok('Rom: 2 lenkede lys = gruppe → ÉN rad i popupen «Gang · alle · 2 lys» med gul kant', gr.cfg && gr.cfg.gang && gr.cfg.gang.members.length === 2 && gr.box && /Gang · alle/.test(gr.row) && /· 2 lys/.test(gr.row) && /242, 210, 111|0\.949\d* 0\.823\d* 0\.435/.test(gr.sh) && gr.rows === 0, gr);
  // gruppe-slideren styrer begge (touch-dra)
  // Fiks 39: gruppe-raden er den felles msh-light-slider (entities = gruppen); dras i popupen over det halve arket
  const gb = await page.evaluate(async () => { const ls = SR().querySelector('.lgr[data-grp="gang"] msh-light-slider'), t = ls && ls.shadowRoot.querySelector('.bar'); if (!t) return { y: -1 }; t.scrollIntoView({ block: 'center' }); await wait(150); let sc = L(); while (sc && sc !== document.body) { const cs = getComputedStyle(sc); if (/(auto|scroll)/.test(cs.overflowY) && sc.scrollHeight > sc.clientHeight + 2) break; sc = sc.parentElement || (sc.getRootNode && sc.getRootNode().host); } if (sc && sc !== document.body) sc.scrollTop += t.getBoundingClientRect().top - 250; await wait(250); const sh = SHR().querySelector('.sh').getBoundingClientRect(); window.CALLS = []; return { ...rect(t), shTop: sh.top }; });
  if (gb.y > 60 && gb.y < 420) {
    await touch('touchStart', [{ x: gb.x + gb.w * 0.2, y: gb.cy }]);
    for (let i = 1; i <= 8; i++) { await touch('touchMove', [{ x: gb.x + gb.w * (0.2 + 0.05 * i), y: gb.cy }]); await wait(20); }
    await touch('touchEnd', []); await wait(400);
  }
  const gc = await page.evaluate(() => ({ calls: window.CALLS.filter((c) => c[0] === 'light'), pop: popOpen() }));
  ok('Rom: gruppe-slideren (touch, over det halve arket) styrer alle lysene i gruppen, popupen står', gb.y > 60 && gb.b < gb.shTop && gc.calls.some((c) => [].concat(c[2].entity_id).includes('light.gang_tak')) && gc.calls.some((c) => [].concat(c[2].entity_id).includes('light.gang_speil')) && gc.pop, { gb, gc });
  // gi navn til rommet
  await page.evaluate(async () => { const i = SHR().querySelector('[data-rname="gang"]'); i.value = 'Entré'; i.dispatchEvent(new Event('change', { bubbles: true, composed: true })); await wait(300); });
  const rn = await page.evaluate(() => ({ cfg: D().room_names, head: SR().querySelector('[data-key="r-gang"] .rh') && SR().querySelector('[data-key="r-gang"] .rh').textContent }));
  ok('Rom: nytt navn (room_names) vises i popupen', rn.cfg && rn.cfg.gang === 'Entré' && /Entré/.test(rn.head || ''), rn);
  // flytt «light.bad_tak» til Gang (light_room) – også ut av gruppen i rommet det forlater
  await page.evaluate(async () => { SHR().querySelector('[data-a="rtog"][data-k="bad"]').click(); await wait(300); const s = SHR().querySelector('select[data-mv="light.bad_tak"]'); s.value = 'gang'; s.dispatchEvent(new Event('change', { bubbles: true, composed: true })); await wait(400); });
  const mv = await page.evaluate(() => ({ lr: D().light_room, inGang: !!SR().querySelector('[data-key="r-gang"] [data-lc="light.bad_tak"]'), inBad: !!SR().querySelector('[data-key="r-bad"] [data-lc="light.bad_tak"]') }));
  ok('Rom: flytt lys til annet rom (light_room.<objekt-id>) vises live i popupen', mv.lr && mv.lr.bad_tak === 'gang' && mv.inGang && !mv.inBad, mv);
  await page.evaluate(async () => { SHR().querySelector('[data-a="rtog"][data-k="gang"]').click(); await wait(300); });
  const sub = await page.evaluate(() => { const r = SHR().querySelector('[data-row="light"][data-id="light.bad_tak"] .ln i'); return r && r.textContent; });
  ok('Rom: flyttet lys viser «Flyttet fra Bad»', /Flyttet fra Bad/.test(sub || ''), sub);
  // skjul et lys
  await page.evaluate(async () => { SHR().querySelector('[data-a="leye"][data-k="light.bad_tak"]').click(); await wait(300); });
  const hl = await page.evaluate(() => ({ hid: D().hide_lights, shown: !!SR().querySelector('[data-lc="light.bad_tak"]') }));
  ok('Rom: øyet skjuler lyset (hide_lights)', JSON.stringify(hl.hid) === '["light.bad_tak"]' && !hl.shown, hl);
  // «Del opp» fjerner gruppen
  await page.evaluate(async () => { SHR().querySelector('[data-a="ungroup"][data-k="gang"]').click(); await wait(300); });
  const ug = await page.evaluate(() => ({ g: D().groups, row: !!SR().querySelector('.lgr') }));
  ok('Rom: «Del opp» fjerner gruppen', !ug.g && !ug.row, ug);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/lys36-rom.png` });

  /* ---------- Scener */
  await page.evaluate(() => go('scenes'));
  const sc0 = await page.evaluate(() => ({ rows: [...SHR().querySelectorAll('[data-row="scene"]')].map((x) => x.dataset.id), avail: [...SHR().querySelectorAll('[data-a="sadd"]')].map((x) => x.dataset.k) }));
  ok('Scener: rader med håndtak + «Legg til scene fra Home Assistant» (scene.*/script.*)', sc0.rows.length >= 2 && sc0.avail.length >= 1 && sc0.avail.every((k) => /^(scene|script)\./.test(k)), sc0);
  const first = sc0.rows[0];
  await page.evaluate(async (k) => { SHR().querySelector(`[data-a="stog"][data-k="${k}"]`).click(); await wait(250); SHR().querySelector(`[data-a="sicon"][data-k="${k}"][data-v="mdi:party-popper"]`).click(); await wait(250); SHR().querySelector(`[data-a="set"][data-k="scene_color:${k}"][data-v="var(--blue)"]`).click(); await wait(300); }, first);
  const sc1 = await page.evaluate((k) => { const b = SR().querySelector(`.sc [data-k="${k}"]`); const ic = b && b.querySelector('ha-icon'); return { icon: D().scene_icon, col: D().scene_color, pic: ic && ic.getAttribute('icon'), pcol: b && getComputedStyle(b.querySelector('.scbb,.scxi')).color }; }, first);
  ok('Scener: ikon og farge (temafarge var(--navn)) vises live i popupen', sc1.pic === 'mdi:party-popper' && /115, 185, 242/.test(sc1.pcol || '') && Object.values(sc1.col || {}).includes('var(--blue)'), sc1);
  const add = sc0.avail[0];
  await page.evaluate(async (k) => { SHR().querySelector(`[data-a="sadd"][data-k="${k}"]`).click(); await wait(300); }, add);
  const sc2 = await page.evaluate((k) => ({ extra: D().extra_scenes, row: !!SHR().querySelector(`[data-row="scene"][data-id="${k}"]`), del: (() => { const b = SHR().querySelector(`[data-a="stog"][data-k="${k}"]`); if (b) b.click(); return true; })() }), add);
  await page.evaluate(() => wait(250));
  const sc3 = await page.evaluate((k) => !!SHR().querySelector(`[data-a="sdel"][data-k="${k}"]`), add);
  ok('Scener: legg til fra HA → extra_scenes, egen scene kan fjernes', JSON.stringify(sc2.extra) === JSON.stringify([add]) && sc2.row && sc3, { sc2, sc3 });
  // aldri aktiv-tilstand: trykk på en scene i popupen
  const sa = await page.evaluate(async () => {
    const b = SR().querySelector('.sc .scb'); const bb = b.querySelector('.scbb,.scx') || b;
    const before = getComputedStyle(b.querySelector('.scbb') || b).backgroundColor;
    b.click(); await wait(500);
    const b2 = SR().querySelector(`.sc [data-k="${b.dataset.k}"]`);
    return { before, after: getComputedStyle(b2.querySelector('.scbb') || b2).backgroundColor, cls: b2.className, pressed: b2.getAttribute('aria-pressed') };
  });
  ok('Scener: ingen aktiv-tilstand etter trykk (samme hvileflate #3a3a3a)', sa.before === sa.after && sa.before === 'rgb(58, 58, 58)' && !/\bon\b|active/.test(sa.cls) && sa.pressed == null, sa);

  /* ---------- Utelys (som før) */
  await page.evaluate(() => go('out'));
  const ut = await page.evaluate(() => ({ stp: SHR().querySelectorAll('.msh-stp-row').length, sec: SHR().querySelectorAll('[data-a="usec"]').length, find: !!SHR().querySelector('.fsq'), ents: SHR().querySelectorAll('msh-entity-picker[data-f]').length }));
  ok('Utelys: tider/terskler (7), seksjoner (4), entiteter og lampesøk som før', ut.stp === 7 && ut.sec === 4 && ut.find && ut.ents >= 10, ut);

  /* ---------- Design */
  await page.evaluate(() => go('design'));
  await page.evaluate(() => L().setUI({ tab: 'f:forste' }));
  const dz = await page.evaluate(() => ({ pv: !!SHR().querySelector('.pv .mtb') && !!SHR().querySelector('.pv .sc'), groups: [...SHR().querySelectorAll('.dg .dgh')].map((x) => x.textContent.trim()), th: !!SHR().querySelector('[data-mth-field="tab_height"] input[min="40"][max="56"]') }));
  ok('Design: forhåndsvisning (fanelinje + scener) + kort for Fanestil/Faneetiketter/Tannhjul/Scenestil/Romoverskrift + Fanehøyde 40–56', dz.pv && JSON.stringify(dz.groups) === JSON.stringify(['Fanestil', 'Faneetiketter', 'Tannhjul', 'Scenestil', 'Romoverskrift']) && dz.th, dz);
  const styles = await page.evaluate(async () => {
    const out = {};
    for (const v of ['icon', 'iconText', 'underline', 'segment', 'pill']) {
      SHR().querySelector(`[data-a="dopt"][data-k="tab_style"][data-v="${v}"]`).click(); await wait(300);
      const bar = SR().querySelector('.mtb'), on = SR().querySelector('.mtb-t.on'), cs = getComputedStyle(on), pv = SHR().querySelector('.pv .mtb');
      out[v] = { cls: bar.className, pv: pv && pv.className.includes('lys-ts-' + v), bg: cs.backgroundColor, img: cs.backgroundImage.slice(0, 15), sh: cs.boxShadow, h: Math.round(on.getBoundingClientRect().height), icon: !!on.querySelector('.mtb-ic'), label: !!on.querySelector('.mtb-l'), offLabel: !!SR().querySelector('.mtb-t:not(.on) .mtb-l') };
    }
    return out;
  });
  ok('Design · Fanestil Ikoner: ikoner, bare aktiv viser navn', /mtb-pop/.test(styles.icon.cls) && styles.icon.icon && styles.icon.label && !styles.icon.offLabel && styles.icon.pv, styles.icon);
  ok('Design · Fanestil Ikon + tekst: ikon over navnet (høyere fane)', /mtb-m-b/.test(styles.iconText.cls) && styles.iconText.icon && styles.iconText.label && styles.iconText.h > 48, styles.iconText);
  ok('Design · Fanestil Understrek: ingen flate, rosa strek under aktiv', /lys-ts-underline/.test(styles.underline.cls) && styles.underline.img === 'none' && /242, 133, 201/.test(styles.underline.sh), styles.underline);
  ok('Design · Fanestil Segment: nøytral grå aktiv', /lys-ts-segment/.test(styles.segment.cls) && styles.segment.bg === 'rgb(84, 84, 84)' && styles.segment.img === 'none', styles.segment);
  ok('Design · Fanestil Piller (standard): rosa aktiv 48 px', /mtb-gear/.test(styles.pill.cls) && /gradient/.test(styles.pill.img) && styles.pill.h === 48, styles.pill);
  const more = await page.evaluate(async () => {
    const c = (k, v) => SHR().querySelector(`[data-a="dopt"][data-k="${k}"][data-v="${v}"]`).click();
    const o = {};
    c('tab_label', 'long'); await wait(250); o.long = labels();
    c('gear_position', 'left'); await wait(250); o.gear = rect(SR().querySelector('.mtb-g')).x < rect(SR().querySelector('.mtb-tabs')).x;
    SHR().querySelector('[data-mth-field="tab_height"] [data-mth="56"]').click(); await wait(300); o.th = [Math.round(rect(SR().querySelector('.mtb-t.on')).h), Math.round(rect(SR().querySelector('.mtb-g')).h), D().tab_height];
    c('scene_style', 'grid'); await wait(250); const g = SR().querySelector('.sc'); o.grid = g && g.className.includes('sc-grid') && getComputedStyle(g).gridTemplateColumns.split(' ').length === 3;
    c('scene_style', 'pill'); await wait(250); const p = SR().querySelector('.sc'); o.pill = p && p.className.includes('sc-pill') && Math.round(rect(p.querySelector('.scb')).h) === 44;
    c('room_header', 'text'); await wait(250); const rh = SR().querySelector('.rh'); o.text = !!rh && !rh.querySelector(':scope > ha-icon');
    c('room_header', 'hidden'); await wait(250); o.hidden = !SR().querySelector('.rh');
    c('room_header', 'icon'); await wait(250);
    const sw = (k) => SHR().querySelector(`[data-a="dsw"][data-k="${k}"]`).click();
    sw('tab_count'); await wait(250); o.count = labels();
    sw('room_toggle'); await wait(250); o.toggle = !SR().querySelector('.rh .all');
    sw('show_scenes'); await wait(250); o.scenes = !SR().querySelector('.sc');
    o.cfg = (({ tab_style, tab_label, gear_position, tab_height, scene_style, room_header, tab_count, show_scenes, room_toggle }) => ({ tab_style, tab_label, gear_position, tab_height, scene_style, room_header, tab_count, show_scenes, room_toggle }))(D());
    return o;
  });
  ok('Design · Faneetiketter Lang: «1. etasje»', more.long.some((l) => /etasje/.test(l)), more.long);
  ok('Design · Tannhjul venstre', more.gear);
  ok('Design · Fanehøyde 56 → fane 56, tannhjul 64 (= høyden + 8), tab_height', more.th[0] === 56 && more.th[1] === 64 && more.th[2] === 56, more.th);
  ok('Design · Scenestil Rutenett (3 per rad) og Piller (44 px)', more.grid && more.pill, more);
  ok('Design · Romoverskrift Kun navn / Skjult', more.text && more.hidden, more);
  ok('Design · brytere: antall lys i fanene («· N»), Av/På per rom av, Vis scener av', more.count.some((l) => /· \d/.test(l)) && more.toggle && more.scenes, more);
  ok('Design · config-nøkler', more.cfg.tab_label === 'long' && more.cfg.gear_position === 'left' && more.cfg.scene_style === 'pill' && more.cfg.tab_count === true && more.cfg.show_scenes === false && more.cfg.room_toggle === false, more.cfg);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/lys36-design.png` });

  /* ---------- Visning */
  await page.evaluate(() => go('vis'));
  const vis = await page.evaluate(async () => {
    const o = {};
    SHR().querySelector('[data-a="seg"][data-k="cols"][data-v="3"]').click(); await wait(250);
    o.cols = getComputedStyle(SR().querySelector('.lbox')).gridTemplateColumns.split(' ').length;
    SHR().querySelector('[data-a="seg"][data-k="slider_height"][data-v="64"]').click(); await wait(250);
    o.lr = getComputedStyle(SR().querySelector('.wrap')).getPropertyValue('--lr-h').trim();
    SHR().querySelector('[data-a="set"][data-k="off_color"][data-v="var(--gray100)"]').click(); await wait(250);
    o.off = getComputedStyle(SR().querySelector('.lbox')).backgroundColor;
    SHR().querySelector('[data-a="seg"][data-k="color_mode"][data-v="single"]').click(); await wait(250);
    SHR().querySelector('[data-a="set"][data-k="on_color"][data-v="var(--green)"]').click(); await wait(250);
    SHR().querySelector('[data-a="dsw"][data-k="show_kelvin"]').click(); await wait(300);
    const rec = [...(L()._lc || new Map()).values()][0];
    o.row = rec && rec.el.config ? { c: rec.el.config.color, k: rec.el.config.kelvin, h: rec.el.config.height, tag: rec.el.localName } : null;
    const mm = SHR().querySelector('[data-key="vis-mellomrom"]'), cs = getComputedStyle(mm);
    o.mm = { bg: cs.backgroundColor, r: cs.borderRadius, pre: [...mm.querySelectorAll('.mini:not(.on)')].map((b) => getComputedStyle(b).backgroundColor), on: [...mm.querySelectorAll('.mini.on')].map((b) => getComputedStyle(b).backgroundImage.slice(0, 15)) };
    SHR().querySelector('[data-a="seg"][data-k="bottom"][data-v="220"]').click(); await wait(300);
    o.pb = L().style.paddingBottom;
    o.cfg = (({ cols, slider_height, off_color, color_mode, on_color, show_kelvin, bottom }) => ({ cols, slider_height, off_color, color_mode, on_color, show_kelvin, bottom }))(D());
    return o;
  });
  ok('Visning: kolonner 3, slider-høyde 64, av-farge (kortbakgrunn) live i popupen', vis.cols === 3 && vis.lr === '64px' && vis.off === 'rgb(47, 47, 47)', vis);
  ok('Visning: Én farge + på-farge og «Vis fargetemperatur» når lys-radene (msh-light-slider)', vis.row && vis.row.tag === 'msh-light-slider' && /green/.test(vis.row.c || '') && vis.row.k === true && vis.row.h === 64, vis.row);
  ok('Visning: Mellomrom-kortet helt dekkende #3a3a3a r24, forvalg #404040 / rosa', vis.mm.bg === 'rgb(58, 58, 58)' && vis.mm.r === '24px' && vis.mm.pre.every((x) => x === 'rgb(64, 64, 64)') && vis.mm.on.every((x) => /gradient/.test(x)), vis.mm);
  ok('Visning: «Luft i bunnen» 220 → popupens bunnluft (bottom)', /220px/.test(vis.pb) && vis.cfg.bottom === 220, { pb: vis.pb, cfg: vis.cfg });
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/lys36-visning.png` });

  /* ---------- Nullstill + Ferdig */
  const fin = await page.evaluate(async () => {
    window.HAP = [];
    const done = SHR().querySelector('[data-a="done"]'); done.click(); done.click(); await wait(1200);
    const raw = L()._rawConfig;
    return { closed: !L()._sheet, hap: window.HAP.slice(), keys: Object.keys(raw).sort(), tab_style: raw.tab_style, hide_tabs: raw.hide_tabs, pop: popOpen(), pb: L().style.paddingBottom };
  });
  ok('Ferdig: lagrer nye nøkler (én gang), lukker arket, haptic success, popupen står', fin.closed && fin.hap.includes('success') && fin.keys.includes('scene_style') && fin.keys.includes('cols') && fin.keys.includes('light_room') && fin.keys.includes('hide_lights') && fin.pop, fin);
  ok('etter Ferdig: popupens bunnluft tilbake til normal (bottom 220, uten arkets høyde)', !/^calc\(calc\(/.test(fin.pb) && /\+ 220px\)$/.test(fin.pb.trim()), fin.pb);
  // Nullstill (medium) i et nytt ark tilbakestiller utkastet
  const rs = await page.evaluate(async () => { L().customize('design'); await wait(500); const s0 = SHR().querySelector('.sh'); const re = { full: s0.classList.contains('full'), half: s0.classList.contains('half'), h: Math.round(s0.getBoundingClientRect().height), H: Math.round(L()._sheet.ov.host.getBoundingClientRect().height) }; window.HAP = []; SHR().querySelector('[data-a="reset"]').click(); await wait(300); const d = D(); const o = { keys: Object.keys(d).sort(), hap: window.HAP.slice(), tab: L()._sheet.st.tab, re }; L()._sheet.close(); await wait(300); return o; });
  ok('38.2 · halv høyde huskes ikke: arket (lukket halvt) åpner i full høyde igjen', rs.re.full && !rs.re.half && Math.abs(rs.re.h - (rs.re.H - 52)) <= 2, rs.re);
  ok('Nullstill (haptic medium) → utkast = standard; Esc/lukk forkaster', JSON.stringify(rs.keys) === JSON.stringify(['card_id', 'type']) && rs.hap.includes('medium') && rs.tab === 'design', rs);
  const after = await page.evaluate(() => ({ style: L()._rawConfig.tab_style }));
  ok('lukket uten Ferdig: lagret config står', after.style === 'pill', after);
  ok('ingen sidefeil (mørk)', errs.length === 0, errs);
  await page.close();
}

/* ================================================================ migrering av v4-nøkler */
{
  const legacy = { hidden_tabs: ['on'], hidden_rooms: ['bad'], hidden_scenes: ['p:av'], columns: 2, pad_top: 6, pad_bottom: 100, include: { scener_lys: ['scene.soverom_natt'] } };
  const { page, errs } = await boot(legacy);
  const r = await page.evaluate(async () => {
    const o = { ids: tabIds(), cols: getComputedStyle(SR().querySelector('.wrap')).getPropertyValue('--lt-cols').trim(), pb: L().style.paddingBottom };
    L().customize(); await wait(500);
    o.draft = D();
    SHR().querySelector('[data-a="done"]').click(); await wait(1200);
    o.saved = L()._rawConfig;
    return o;
  });
  ok('v4-nøkler leses (hidden_tabs, columns, pad_bottom)', !r.ids.includes('on') && r.cols === '2' && /100px/.test(r.pb), r);
  const s = r.saved;
  ok('v4-nøkler migreres ved Ferdig → hide_tabs/hide_rooms/hide_scenes/cols/top/bottom/extra_scenes', JSON.stringify(s.hide_tabs) === '["on"]' && JSON.stringify(s.hide_rooms) === '["bad"]' && JSON.stringify(s.hide_scenes) === '["p:av"]' && s.cols === 2 && s.top === 6 && s.bottom === 100 && JSON.stringify(s.extra_scenes) === '["scene.soverom_natt"]' && !('hidden_tabs' in s) && !('columns' in s) && !('pad_bottom' in s) && !s.include, s);
  // GUI-editoren: samme nøkler
  const gui = await page.evaluate(async () => {
    const ed = L().constructor.getConfigElement(); ed.hass = H; ed.setConfig({ ...L()._rawConfig }); document.body.appendChild(ed); await wait(300);
    const R0 = ed.shadowRoot, names = [...R0.querySelectorAll('[data-name]')].map((e) => e.dataset.name);
    let got = null; ed.addEventListener('config-changed', (e) => { got = e.detail.config; });
    const b = R0.querySelector('[data-a="sel"][data-name="tab_style"][data-v="segment"]'); if (b) b.click(); await wait(200);
    ed.remove();
    return { names: [...new Set(names)], got: got && got.tab_style };
  });
  const need = ['cols', 'size', 'slider_height', 'color_mode', 'on_color', 'off_color', 'show_kelvin', 'gap', 'top', 'bottom', 'tab_order', 'hide_tabs', 'tab_style', 'tab_label', 'gear_position', 'scene_style', 'room_header', 'tab_count', 'show_scenes', 'room_toggle', 'scene_order', 'hide_scenes', 'extra_scenes', 'hide_rooms', 'hide_lights'];
  const miss = need.filter((n) => !gui.names.some((x) => x === n || x.startsWith(n + '.')));
  ok('GUI-editoren (getConfigElement) har de samme nøklene og skriver dem', miss.length === 0 && gui.got === 'segment' && gui.names.some((x) => x.startsWith('light_room.')) && gui.names.some((x) => x.startsWith('room_names.')) && gui.names.some((x) => /^groups\./.test(x)) && gui.names.some((x) => x.startsWith('scene_icon.')), { miss, got: gui.got });
  ok('ingen sidefeil (migrering)', errs.length === 0, errs);
  await page.close();
}

/* ================================================================ lys modus */
{
  const { page, errs } = await boot({ groups: { gang: { name: '', members: ['light.gang_tak', 'light.gang_speil'] } }, start_tab: 'f:forste' }, false);
  const r = await page.evaluate(async () => {
    const o = { theme: document.documentElement.dataset.kiTheme };
    L().customize(); await wait(500);
    const sh = SHR().querySelector('.sh'); o.bg = getComputedStyle(sh).backgroundColor;
    o.card = getComputedStyle(SHR().querySelector('.card')).backgroundColor;
    const bad = [];
    for (const t of ['tabs', 'rooms', 'scenes', 'design', 'vis']) {
      await go(t);
      if (t === 'rooms') { SHR().querySelector('[data-a="rtog"]').click(); await wait(250); }
      const els = [...SHR().querySelectorAll('.lys-sheet *')].filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && e.getClientRects().length);
      for (const e of els) {
        const fg = lum(getComputedStyle(e).color); let n = e, bg = null;
        while (n && n !== SHR()) { if (n.nodeType === 1) { const cs = getComputedStyle(n); if (cs.backgroundImage !== 'none' && /gradient/.test(cs.backgroundImage)) { bg = { l: 0.55, a: 1 }; break; } const b = lum(cs.backgroundColor); if (b && b.a > 0.5) { bg = b; break; } } n = n.parentNode && n.parentNode.nodeType === 11 ? n.parentNode.host : n.parentNode; }
        if (!fg || !bg) continue;
        const cr = (Math.max(fg.l, bg.l) + 0.05) / (Math.min(fg.l, bg.l) + 0.05);
        if (cr < 4.5) bad.push([t, e.className || e.localName, e.textContent.trim().slice(0, 20), cr.toFixed(2)]);
      }
    }
    o.bad = bad;
    const g = SR().querySelector('.lgr msh-light-slider'); o.group = g && g.shadowRoot && [...g.shadowRoot.querySelectorAll('.n, .v')].map((e) => e.textContent).join(' ').replace(/\s+/g, ' ').trim();
    return o;
  });
  ok('lys modus: arket #f0f0f0 (helt dekkende), kort hvite', r.theme === 'light' && r.bg === 'rgb(240, 240, 240)' && r.card === 'rgb(255, 255, 255)', r);
  ok('lys modus: all tekst i arket ≥ 4,5:1', r.bad.length === 0, r.bad.slice(0, 8));
  ok('gruppe fra config vises som én rad (lys modus)', /Gang · alle/.test(r.group || '') && /· 2 lys/.test(r.group || ''), r.group);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/lys36-lys.png` });
  ok('ingen sidefeil (lys)', errs.length === 0, errs);
  await page.close();
}

await browser.close();
console.log(res.join('\n'));
console.log(fails ? `\n${fails} feil` : '\nAlt OK');
process.exit(fails ? 1 : 0);
