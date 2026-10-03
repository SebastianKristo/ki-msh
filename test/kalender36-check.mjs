// Fiks 36.6 / 36.7 · Kalender (#kalender, msh-kalender-card) i ekte Bubble Card-popup (test/harness-bubble.html), touch,
// lys + mørk modus:
//   36.6 Startvisning (default_view: list|month, også GUI): gjelder Kalender og Framover ved hver åpning; knappen bytter
//        bare i økten (lagret verdi og ki-store uendret). Hytta/Bursdager/Posten: knappen er KUN tannhjul (ingen prikker,
//        ingen vipp/sveip), trykk → Tilpass. Framover-filteret gjelder også i måned (merker + dagspanel), beholdes ved
//        Liste ⇄ Måned, chipsene står rett under fanelinjen og over månedsnavigasjonen, nytt filter → hopp til første dag
//        med treff. Posten: dagene er knapper (overskrift/undertekst, hvit ring, trykk igjen → neste utdeling, scale .94,
//        haptic selection).
//   36.7 «Tilpass kalender»: portalt ut av popupen, helt dekkende --ki-popup (#282828 / lys #f0f0f0), ingen blur/opasitet
//        (også med Liquid Glass på), radius 38 38 0 0, høyde = dashbordflaten − 52, maks 440 sentrert nederst, bakteppe
//        rgba(0,0,0,.5) + blur(4px) over dashbordflaten (ikke HA-sidebaren), trykk lukker; header: håndtak 40×5, «Tilpass
//        kalender» 24/600, «Nullstill» #3a3a3a + rosa «Ferdig», ingen X; Mellomrom = dekkende kort #3a3a3a r24, forvalg #404040.
//   node test/kalender36-check.mjs
import { createRequire } from 'node:module';
import { readdirSync, mkdirSync, existsSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const R = resolve('.') + '/';
mkdirSync('test/.build', { recursive: true });
mkdirSync('test/.vendor', { recursive: true });
const BC = resolve('test/.vendor/bubble-card.js');
if (!existsSync(BC)) execFileSync('curl', ['-sSL', '-o', BC, 'https://raw.githubusercontent.com/Clooos/Bubble-Card/main/dist/bubble-card.js']);
const bundle = resolve(`test/.build/kal36-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const mocks = readdirSync(R + 'test/mock').filter((f) => f.endsWith('.js')).sort().map((f) => R + 'test/mock/' + f);
const browser = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
let fails = 0;
const ok = (name, cond, info) => { if (!cond) fails++; console.log(`${cond ? '✔' : '✘'} ${name}${info != null && !cond ? ' · ' + JSON.stringify(info).slice(0, 700) : ''}`); };
const errs = [];

async function setup(theme, vp, extra) {
  const page = await browser.newPage({ viewport: vp || { width: 390, height: 844 }, hasTouch: true, isMobile: !vp || vp.width < 700 });
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('file://' + R + 'test/harness-bubble.html');
  for (const m of mocks) await page.addScriptTag({ path: m });
  await page.addScriptTag({ path: bundle });
  await page.addScriptTag({ path: BC, type: 'module' });
  await page.waitForFunction(() => customElements.get('bubble-card'), null, { timeout: 15000 });
  await page.evaluate(async ({ theme, extra }) => {
    try { localStorage.clear(); } catch (e) { /* */ }
    window.deepAll = (sel, root) => { const out = []; const walk = (r) => r.querySelectorAll('*').forEach((e) => { if (e.matches(sel)) out.push(e); if (e.shadowRoot) walk(e.shadowRoot); }); walk(root || document); return out; };
    window.H = window.mockHass();
    H.themes = { ...(H.themes || {}), darkMode: theme === 'dark' };
    await MSH.store.load(H);
    window.HP = []; window.addEventListener('haptic', (e) => window.HP.push(e.detail));
    window.BASE = { type: 'custom:msh-kalender-card', card_id: 'kal36', ...(extra || {}) };
    const bc = document.createElement('bubble-card');
    window.BCFG = { type: 'custom:bubble-card', card_type: 'pop-up', hash: '#kalender', name: 'Kalender', icon: 'mdi:calendar-month', margin_top_mobile: '50px', bg_opacity: '88', bg_blur: '20' };
    bc.setConfig({ ...BCFG, cards: [BASE] });
    window.bc = bc; bc.hass = H; document.getElementById('dash').appendChild(bc);
    await new Promise((r) => setTimeout(r, 400));
    location.hash = '#kalender';
    await new Promise((r) => setTimeout(r, 1300));
    window.card = () => deepAll('msh-kalender-card')[0];
    window.sr = () => card().shadowRoot;
    window.reopen = async () => { location.hash = ''; await new Promise((r) => setTimeout(r, 700)); location.hash = '#kalender'; await new Promise((r) => setTimeout(r, 1200)); };
    window.setCfg = async (patch) => { const cfg = { ...BASE, ...patch }; window.BASE = cfg; try { MSH.store.set('cards.kal36', undefined); } catch (e) { /* */ } bc.setConfig({ ...BCFG, cards: [cfg] }); const c = card(); if (c) c.setConfig(cfg); await new Promise((r) => setTimeout(r, 300)); };
    window.tabTo = async (k) => { sr().querySelector(`.top [data-act="tab"][data-v="${k}"]`).click(); await new Promise((r) => setTimeout(r, 400)); };
    window.view = () => ({ tab: card().tab, month: !!sr().querySelector('.pane .mv7'), list: !!sr().querySelector('.pane .day, .pane .hero, .pane .evl') });
  }, { theme, extra });
  const cdp = await page.context().newCDPSession(page);
  const touchTap = async (sel) => {
    const p = await page.evaluate((s) => { const e = sr().querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, sel);
    if (!p) return false;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p.x, y: p.y }] });
    await page.waitForTimeout(60);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(450);
    return true;
  };
  const swipe = async (sel, dy) => {
    const p = await page.evaluate((s) => { const r = sr().querySelector(s).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, sel);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p.x, y: p.y }] });
    for (let i = 1; i <= 5; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: p.x, y: p.y + (dy * i) / 5 }] }); await page.waitForTimeout(16); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(400);
  };
  return { page, touchTap, swipe };
}

for (const theme of ['dark', 'light']) {
  const T = (n) => `${n} (${theme})`;
  /* ------------------------------------------------ 36.6 · Startvisning */
  const { page, touchTap, swipe } = await setup(theme, null, { default_view: 'month' });
  const thm = await page.evaluate(() => document.documentElement.dataset.kiTheme);
  ok(T('tema satt på <html>'), thm === theme, thm);
  let v = await page.evaluate(() => view());
  ok(T('default_view: month → Kalender åpner i måned'), v.tab === 'kalender' && v.month, v);
  await touchTap('.mb');
  v = await page.evaluate(() => ({ ...view(), cfg: card()._rawConfig.default_view, store: MSH.store.get('kalender.view') }));
  ok(T('trykk på knappen → liste, lagret Startvisning og ki-store uendret'), !v.month && v.cfg === 'month' && !(v.store && v.store.kalender), v);
  await page.evaluate(() => tabTo('framover'));
  v = await page.evaluate(() => view());
  ok(T('Framover åpner også i Startvisning (måned)'), v.month, v);
  await page.evaluate(() => reopen());
  v = await page.evaluate(() => view());
  ok(T('lukk/åpne via hash → Startvisning igjen (måned)'), v.month, v);
  await page.evaluate(() => setCfg({ default_view: 'list' }));
  await page.evaluate(() => reopen());
  v = await page.evaluate(() => ({ ...view(), dv: card().config.defaultView }));
  ok(T('default_view: list → liste ved åpning'), !v.month && v.dv === 'liste', v);
  // GUI-editoren: Startvisning (ha-selector) og Tilpass-arket (chips) skriver default_view
  const gui = await page.evaluate(async () => {
    const El = customElements.get('msh-kalender-card').getConfigElement(); document.body.appendChild(El); El.hass = H; const C0 = { ...BASE, defaultView: 'maned' }; delete C0.default_view; El.setConfig(C0);
    let last = null; El.addEventListener('config-changed', (e) => { last = e.detail.config; });
    await new Promise((r) => setTimeout(r, 200));
    const R0 = El.shadowRoot; [...R0.querySelectorAll('[data-a="tab"]')].find((t) => t.dataset.v === 'visning').click(); await new Promise((r) => setTimeout(r, 200));
    const hs = R0.querySelector('ha-selector[data-name="default_view"]');
    let out;
    if (hs) { // ekte HA: ha-selector select
      out = { has: true, val: hs.value || hs.dataset.sdef, opts: JSON.parse(hs.dataset.selector).select.options.map((o) => o.value) };
      hs.dispatchEvent(new CustomEvent('value-changed', { detail: { value: 'list' }, bubbles: true, composed: true })); await new Promise((r) => setTimeout(r, 100));
    } else { // uten ha-selector (harness): samme valg som chips
      const B = [...R0.querySelectorAll('[data-op="dv"]')];
      out = { has: B.length === 2, val: (B.find((b) => b.classList.contains('on')) || {}).dataset?.v, opts: B.map((b) => b.dataset.v) };
      B.find((b) => b.dataset.v === 'list').click(); await new Promise((r) => setTimeout(r, 100));
    }
    out.out = last && last.default_view; out.legacy = last && last.defaultView; El.remove();
    return out;
  });
  ok(T('GUI-editor: «Startvisning» (Liste/Måned) leser gamle defaultView og skriver default_view'), gui.has && gui.val === 'month' && gui.opts.join() === 'list,month' && gui.out === 'list' && gui.legacy === undefined, gui);

  /* ------------------------------------------------ 36.6 · knappen: kun tannhjul på Hytta/Bursdager/Posten */
  await page.evaluate(() => reopen()); // GUI-editoren ligger utenfor popupen – Bubble lukker ved klikk utenfor
  for (const t of ['hytta', 'bursdager', 'posten']) {
    await page.evaluate((k) => tabTo(k), t);
    const b0 = await page.evaluate(() => { const mb = sr().querySelector('.mb'); return { mode: mb.dataset.mode, dots: sr().querySelectorAll('.mdots, .mdots i').length, icons: [...mb.querySelectorAll('ha-icon')].map((i) => i.getAttribute('icon')), w: Math.round(mb.getBoundingClientRect().width) }; });
    ok(T(`${t}: knappen er KUN tannhjul (ingen prikker, ett ikon mdi:cog)`), b0.mode === 'gear' && b0.dots === 0 && b0.icons.join() === 'mdi:cog' && b0.w === 48, b0);
    await page.evaluate(() => { HP.length = 0; });
    await swipe('.mb', -30);
    const b1 = await page.evaluate(() => ({ mode: sr().querySelector('.mb').dataset.mode, btn: card().ui.btn, hp: [...HP], portals: MSH.portals().filter((p) => p.isConnected).length, hash: location.hash }));
    ok(T(`${t}: sveip gjør ingenting (ingen vipp, ingen haptic, popupen blir)`), b1.mode === 'gear' && b1.btn !== 'gear' && !b1.hp.includes('selection') && b1.hash === '#kalender', b1);
    if (b1.portals) await page.evaluate(() => MSH.portals().forEach((p) => p.shadowRoot.querySelector('.bg').click()));
    await page.waitForTimeout(400);
    await touchTap('.mb');
    const b2 = await page.evaluate(() => { const P = MSH.portals().filter((p) => p.isConnected && p.classList.contains('on')); const ed = P.length && P[P.length - 1].shadowRoot.querySelector('msh-editor'); return { n: P.length, title: ed && ed.shadowRoot.querySelector('.ttl .tt').textContent }; });
    ok(T(`${t}: trykk på tannhjulet → «Tilpass kalender»`), b2.n === 1 && b2.title === 'Tilpass kalender', b2);
    await page.evaluate(() => MSH.portals().forEach((p) => p.shadowRoot.querySelector('.bg').click()));
    await page.waitForTimeout(500);
  }
  await page.evaluate(() => tabTo('kalender'));
  const kd = await page.evaluate(() => ({ dots: sr().querySelectorAll('.mdots i').length, mode: sr().querySelector('.mb').dataset.mode }));
  ok(T('Kalender beholder skinne med to prikker (Liste/Måned ⇄ tannhjul)'), kd.dots === 2 && kd.mode === 'view', kd);

  /* ------------------------------------------------ 36.6 · Framover-filter i månedsvisning */
  await page.evaluate(() => tabTo('framover'));
  await touchTap('.mb'); // liste → måned
  const kinds = (f) => page.evaluate(() => { const c = card(), I = c._mItems(); return { rows: [...sr().querySelectorAll('.dp .mr')].map((e) => (I[Number(e.dataset.i)] || {}).kind), badges: [...sr().querySelectorAll('.mvn')].reduce((a, e) => a + Number(e.textContent), 0), sel: sr().querySelector('.mvd.sel') && sr().querySelector('.mvd.sel').dataset.v, ff: c.ui.ff || 'alle', on: (sr().querySelector('.fc.on') || {}).dataset?.v, month: !!sr().querySelector('.mv7') }; });
  const pos = await page.evaluate(() => { const top = sr().querySelector('.top').getBoundingClientRect(), ch = sr().querySelector('.pane > .fchips'), mv = sr().querySelector('.mvc'), first = sr().querySelector('.pane').firstElementChild; const c = ch && ch.getBoundingClientRect(), m = mv && mv.getBoundingClientRect(); return { first: first && first.className, chipsUnderTabs: c && c.top >= top.bottom - 1, chipsOverNav: c && m && c.bottom <= m.top + 1, labels: ch && [...ch.querySelectorAll('.fc')].map((b) => b.textContent) }; });
  ok(T('Framover · måned: filter-chipsene øverst – rett under fanelinjen, over månedsnavigasjonen'), /fchips/.test(pos.first) && pos.chipsUnderTabs && pos.chipsOverNav && pos.labels.join() === 'Alle,Serier,Filmer,Plex', pos);
  const exp = async (f) => page.evaluate((f) => { const c = card(), now = new Date(), off = Number(c.ui.fOff) || 0, mf = new Date(now.getFullYear(), now.getMonth() + off, 1); const P = c._fPool(f).filter((x) => x.date.getFullYear() === mf.getFullYear() && x.date.getMonth() === mf.getMonth()); return { n: P.length, kinds: [...new Set(P.map((x) => x.kind))].sort() }; }, f);
  const a0 = await kinds(), e0 = await exp('alle');
  ok(T('Alle: merkene teller Sonarr + Radarr + Plex (Plex på)'), a0.badges === e0.n && e0.kinds.join() === 'film,plex,serie', { a0, e0 });
  for (const [f, k] of [['plex', 'plex'], ['serier', 'serie'], ['filmer', 'film']]) {
    await page.evaluate(() => { HP.length = 0; });
    await touchTap(`.fc[data-v="${f}"]`);
    const r = await kinds(), e = await exp(f), hp = await page.evaluate(() => [...HP]);
    ok(T(`${f}: merker og dagspanel KUN ${k} (${e.n} i måneden), valgt dag har treff (hopp), haptic selection`), r.month && r.ff === f && r.on === f && r.badges === e.n && r.rows.length > 0 && r.rows.every((x) => x === k) && hp.includes('selection'), { r, e, hp });
  }
  // filteret beholdes Liste ⇄ Måned
  await touchTap('.mb');
  const l1 = await page.evaluate(() => ({ month: !!sr().querySelector('.mv7'), on: (sr().querySelector('.fc.on') || {}).dataset?.v, first: sr().querySelector('.pane').firstElementChild.className, rows: [...sr().querySelectorAll('.pane .mr, .pane .hero')].map((e) => (card()._mItems()[Number(e.dataset.i)] || {}).kind) }));
  ok(T('Måned → Liste: filteret (Filmer) beholdes, chipsene øverst'), !l1.month && l1.on === 'filmer' && /fchips/.test(l1.first) && l1.rows.length && l1.rows.every((x) => x === 'film'), l1);
  await touchTap('.mb');
  const m2 = await kinds();
  ok(T('Liste → Måned: fortsatt Filmer'), m2.month && m2.ff === 'filmer' && m2.rows.every((x) => x === 'film'), m2);
  // hopp: Plex (alle i fortiden) fra en dag uten Plex → valgt dag = en dag med Plex
  await page.evaluate(async () => { const t = new Date(); t.setDate(t.getDate() + 1); card().setUI({ fSel: `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}` }); await new Promise((r) => setTimeout(r, 200)); });
  await touchTap('.fc[data-v="plex"]');
  const j = await kinds();
  const jd = await page.evaluate(() => card()._fPool('plex').map((x) => { const d = x.date; return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }));
  ok(T('Plex fra en dag uten treff → hopper til en dag med Plex (dagspanelet viser Plex)'), jd.includes(j.sel) && j.rows.length > 0 && j.rows.every((x) => x === 'plex'), { j, jd });
  await touchTap('.fc[data-v="alle"]');
  const j2 = await kinds();
  ok(T('Alle igjen: valgt dag har treff → blir stående'), j2.sel === j.sel, { j, j2 });

  /* ------------------------------------------------ 36.6 · Posten: trykk på dag */
  await page.evaluate(() => tabTo('posten'));
  const P0 = await page.evaluate(() => { const s = sr(); return { rel: s.querySelector('.prel').textContent, sub: s.querySelector('.psub').textContent, btn: [...s.querySelectorAll('.pg .pd')].every((b) => b.tagName === 'BUTTON' && b.dataset.act === 'psel'), n: s.querySelectorAll('.pg .pd').length, css: [...s.querySelectorAll('style')].some((st) => /\.pd:active\{transform:scale\(\.94\)\}/.test(st.textContent)) }; });
  ok(T('Posten: dagene er knapper (10), trykk-animasjon scale(.94)'), P0.btn && P0.n === 10 && P0.css, P0);
  // dag UTEN utdeling (ikke i dag)
  const pick = (on) => page.evaluate((on) => { const b = [...sr().querySelectorAll('.pg .pd')].filter((x) => !x.classList.contains('today')).find((x) => x.classList.contains('on') === on); return b && b.dataset.v; }, on);
  const kOff = await pick(false), kOn = await pick(true);
  const relOf = (k) => { const d = new Date(k + 'T00:00:00'), n = Math.round((d - new Date(new Date().toDateString())) / 864e5); return n === 0 ? 'I dag' : n === 1 ? 'I morgen' : `Om ${n} dager`; };
  const DAG = ['søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag'], MND = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des'];
  const subOf = (k, on) => { const d = new Date(k + 'T00:00:00'); return `${DAG[d.getDay()]} ${d.getDate()}. ${MND[d.getMonth()]} · ${on ? 'posten kommer' : 'ingen utdeling'}`; };
  for (const [k, on] of [[kOff, false], [kOn, true]]) {
    if (!k) { ok(T(`Posten: fant dag (${on ? 'med' : 'uten'} utdeling)`), false); continue; }
    await page.evaluate(() => { HP.length = 0; });
    await touchTap(`.pg .pd[data-v="${k}"]`);
    const r = await page.evaluate((k) => { const s = sr(), b = s.querySelector(`.pg .pd[data-v="${k}"]`); return { rel: s.querySelector('.prel').textContent, sub: s.querySelector('.psub').textContent, ring: getComputedStyle(b).boxShadow, pressed: b.getAttribute('aria-pressed'), others: s.querySelectorAll('.pg .pd.sel').length, hp: [...HP] }; }, k);
    const ringCol = theme === 'dark' ? 'rgb(250, 250, 250)' : 'rgb(28, 28, 28)';
    ok(T(`Posten: trykk ${k} → «${relOf(k)}» + «${subOf(k, on)}», ring inset 2px, haptic selection`), r.rel === relOf(k) && r.sub === subOf(k, on) && r.ring.includes(ringCol) && /inset/.test(r.ring) && /2px/.test(r.ring) && r.pressed === 'true' && r.others === 1 && r.hp.includes('selection'), { r, want: [relOf(k), subOf(k, on)] });
  }
  await touchTap(`.pg .pd[data-v="${kOn}"]`);
  const P1 = await page.evaluate(() => ({ rel: sr().querySelector('.prel').textContent, sub: sr().querySelector('.psub').textContent, sel: sr().querySelectorAll('.pg .pd.sel').length }));
  ok(T('Posten: trykk samme dag igjen → tilbake til neste utdeling'), P1.rel === P0.rel && P1.sub === P0.sub && P1.sel === 0, { P0, P1 });

  /* ------------------------------------------------ 36.7 · «Tilpass kalender»-arket */
  for (const glass of [false, true]) {
    await page.evaluate((g) => { MSH.setGlassTheme(g); document.documentElement.dataset.kiGlass = g ? '1' : '0'; }, glass);
    await page.evaluate(() => card().customize());
    await page.waitForTimeout(700);
    const G = await page.evaluate(() => {
      const P = MSH.portals().filter((p) => p.isConnected && p.classList.contains('on')), host = P[P.length - 1];
      const sh = host.shadowRoot.querySelector('.sh'), bg = host.shadowRoot.querySelector('.bg'), cs = getComputedStyle(sh), bcs = getComputedStyle(bg);
      const r = sh.getBoundingClientRect(), br = bg.getBoundingClientRect(), D = MSH.dashRect();
      const ed = sh.querySelector('msh-editor'), E = ed.shadowRoot, ttl = E.querySelector('.ttl'), tt = E.querySelector('.ttl .tt'), grab = sh.querySelector('.gz .grab');
      const btn = [...ttl.querySelectorAll('button')].map((b) => ({ t: b.textContent.trim(), a: b.dataset.a, bg: getComputedStyle(b).backgroundColor, img: getComputedStyle(b).backgroundImage }));
      // opasitet i hele kjeden fra arket opp til dokumentet (arvet opasitet/transform fra popupen = ikke portalt)
      let op = 1, n = sh, inPop = false; while (n) { if (n.nodeType === 1) { op *= Number(getComputedStyle(n).opacity); if (n.classList && n.classList.contains('bubble-pop-up')) inPop = true; } n = n.parentNode || n.host; }
      return { bg: cs.backgroundColor, img: cs.backgroundImage, bf: cs.backdropFilter, op, inPop, rad: cs.borderRadius, top: Math.round(r.top), h: Math.round(r.height), w: Math.round(r.width), cx: Math.round(r.left + r.width / 2), bottom: Math.round(r.bottom), vh: innerHeight,
        D: { l: Math.round(D.left), w: Math.round(D.width), h: Math.round(D.height || innerHeight) }, scrim: bcs.backgroundColor, sbf: bcs.backdropFilter, sl: Math.round(br.left), sw: Math.round(br.width), sh2: Math.round(br.height),
        title: tt.textContent, tfs: getComputedStyle(tt).fontSize, tfit: tt.scrollWidth <= tt.clientWidth + 1, tfw: getComputedStyle(tt).fontWeight, btn, grab: grab && [Math.round(grab.getBoundingClientRect().width), Math.round(grab.getBoundingClientRect().height), getComputedStyle(grab).backgroundColor], glassHost: host.hasAttribute('data-glass'), edGlass: ed.hasAttribute('glass') };
    });
    const opaque = (c) => /^rgb\(/.test(c) || /^rgba\(.*,\s*1\)$/.test(c);
    const sheetBg = theme === 'dark' ? 'rgb(40, 40, 40)' : 'rgb(240, 240, 240)';
    const tag = `${glass ? 'Liquid Glass på' : 'standard'}`;
    ok(T(`36.7 [${tag}] ark helt dekkende ${sheetBg}, ingen blur/opasitet, portalt (ikke i popupen)`), G.bg === sheetBg && opaque(G.bg) && G.img === 'none' && (G.bf === 'none' || !G.bf) && G.op === 1 && !G.inPop && !G.glassHost && !G.edGlass, G);
    ok(T(`36.7 [${tag}] radius 38 38 0 0, høyde = dashbordflaten − 52, maks 440 sentrert nederst`), G.rad === '38px 38px 0px 0px' && G.top === 52 && G.h === G.vh - 52 && G.bottom === G.vh && G.w === Math.min(440, G.D.w) && Math.abs(G.cx - (G.D.l + G.D.w / 2)) <= 1, G);
    const scrimA = theme === 'dark' ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.2)';
    ok(T(`36.7 [${tag}] bakteppe ${scrimA} + blur(4px) over hele dashbordflaten`), G.scrim === scrimA && /blur\(4px\)/.test(G.sbf) && G.sl === G.D.l && G.sw === G.D.w && G.sh2 === G.vh, G);
    ok(T(`36.7 [${tag}] header: håndtak 40×5, «Tilpass kalender» 24/600 (krympes til den får plass), «Nullstill» dekkende + rosa «Ferdig», ingen X`), G.title === 'Tilpass kalender' && parseFloat(G.tfs) >= 16 && parseFloat(G.tfs) <= 24 && G.tfit && G.tfw === '600' && G.grab && G.grab[0] === 40 && G.grab[1] === 5 && G.btn.length === 2 && G.btn[0].t === 'Nullstill' && opaque(G.btn[0].bg) && G.btn[0].bg !== 'rgba(0, 0, 0, 0)' && G.btn[1].t === 'Ferdig' && /gradient/.test(G.btn[1].img) && !G.btn.some((b) => b.a === 'cancel'), G);
    // seksjonskort/rader og Mellomrom
    const S = await page.evaluate(async () => {
      const P = MSH.portals().filter((p) => p.isConnected && p.classList.contains('on')), host = P[P.length - 1], E = host.shadowRoot.querySelector('msh-editor').shadowRoot;
      const tr = (c) => { const m = /rgba?\(([^)]+)\)/.exec(c); if (!m) return 1; const p = m[1].split(/[ ,/]+/).filter(Boolean); return p.length > 3 ? Number(p[3]) : 1; };
      const vis = (e) => { for (let n = e; n && n.nodeType === 1; n = n.parentElement) { const c = getComputedStyle(n); if (c.display === 'none' || c.visibility === 'hidden' || Number(c.opacity) === 0) return false; } return !!e.getClientRects().length; };
      const scan = () => { const bad = []; const walk = (root) => root.querySelectorAll('*').forEach((e) => { if (!vis(e)) return; const cs = getComputedStyle(e); if (cs.backdropFilter && cs.backdropFilter !== 'none') bad.push(['bf', e.className || e.localName, cs.backdropFilter]); const r = e.getBoundingClientRect(), surf = (tr(cs.backgroundColor) > 0 && cs.backgroundColor !== 'rgba(0, 0, 0, 0)') || cs.backgroundImage !== 'none'; if (Number(cs.opacity) < 1 && surf && r.width >= 40 && r.height >= 32) bad.push(['op', String(e.className || e.localName).slice(0, 30), cs.opacity]); const a = tr(cs.backgroundColor); if (a > 0 && a < 1 && /\b(sec|f|ordrow|ktab|kpart|ksrc|btn|box|chips|ent)\b/.test(String(e.className))) bad.push(['bg', String(e.className).slice(0, 30), cs.backgroundColor]); if (e.shadowRoot && e.localName !== 'ha-icon') walk(e.shadowRoot); }); walk(E); return bad; }; // ha-icon = teststub
      const out = { faner: scan() };
      [...E.querySelectorAll('[data-a="tab"]')].find((t) => t.dataset.v === 'visning').click(); await new Promise((r) => setTimeout(r, 700)); // glass-linsen ved fanetrykk er borte etter morfen
      out.visning = scan();
      const ks = E.querySelector('ki-spacing-editor'), box = ks && ks.shadowRoot.querySelector('.box'), bcs = box && getComputedStyle(box);
      const ps = ks ? [...ks.shadowRoot.querySelectorAll('.p')] : [];
      out.sp = box && { bg: bcs.backgroundColor, rad: bcs.borderRadius, sh: bcs.boxShadow, bf: bcs.backdropFilter, op: bcs.opacity, off: [...new Set(ps.filter((p) => !p.classList.contains('on')).map((p) => getComputedStyle(p).backgroundColor))], on: ps.filter((p) => p.classList.contains('on')).map((p) => getComputedStyle(p).backgroundImage.slice(0, 16)), wrapBg: getComputedStyle(ks.closest('.sec') || ks).backgroundColor };
      out.labels = [...E.querySelectorAll('label')].map((l) => l.textContent);
      out.dv = [...E.querySelectorAll('[data-op="dv"]')].map((b) => [b.dataset.v, b.classList.contains('on')]);
      return out;
    });
    const surf = theme === 'dark' ? 'rgb(58, 58, 58)' : 'rgb(255, 255, 255)', surf2 = theme === 'dark' ? 'rgb(64, 64, 64)' : 'rgb(235, 235, 235)';
    ok(T(`36.7 [${tag}] Faner/Visning: ingen backdrop-filter, opasitet < 1 eller gjennomsiktige seksjonskort/rader`), !S.faner.length && !S.visning.length, { f: S.faner.slice(0, 6), v: S.visning.slice(0, 6) });
    ok(T(`36.7 [${tag}] Mellomrom = dekkende kort ${surf} r24 inset, forvalg ${surf2}, aktiv rosa`), S.sp && S.sp.bg === surf && S.sp.rad === '24px' && /inset/.test(S.sp.sh) && S.sp.bf === 'none' && S.sp.op === '1' && S.sp.off.length === 1 && S.sp.off[0] === surf2 && S.sp.on.length && S.sp.on.every((x) => /gradient/.test(x)), S.sp);
    ok(T(`36.6 [${tag}] Tilpass → Visning: Startvisning (Liste/Måned) med aktivt valg`), S.labels.includes('Startvisning') && S.dv.length === 2 && S.dv.filter((x) => x[1]).length === 1, S);
    // trykk på bakteppet lukker
    await page.evaluate(() => { const P = MSH.portals().filter((p) => p.isConnected && p.classList.contains('on')); P[P.length - 1].shadowRoot.querySelector('.bg').click(); });
    await page.waitForTimeout(500);
    const cl = await page.evaluate(() => ({ open: MSH.portals().filter((p) => p.isConnected && p.classList.contains('on')).length, hash: location.hash }));
    ok(T(`36.7 [${tag}] trykk på bakteppet lukker, popupen blir`), cl.open === 0 && cl.hash === '#kalender', cl);
  }
  await page.close();
}

// PC med HA-sidebar: bakteppet dekker dashbordflaten (ikke sidebaren), arket 440 sentrert i flaten
{
  const { page } = await setup('dark', { width: 1280, height: 900 });
  await page.evaluate(async () => { document.documentElement.style.setProperty('--sb', '256px'); const D0 = MSH.dashRect; MSH.dashRect = () => ({ left: 256, top: 0, width: innerWidth - 256, height: innerHeight, right: innerWidth }); /* HAs hui-root #view til høyre for sidebaren */ window.dispatchEvent(new Event('resize')); await new Promise((r) => setTimeout(r, 200)); card().customize(); });
  await page.waitForTimeout(700);
  const G = await page.evaluate(() => { const P = MSH.portals().filter((p) => p.isConnected && p.classList.contains('on')), host = P[P.length - 1], sh = host.shadowRoot.querySelector('.sh'), bg = host.shadowRoot.querySelector('.bg'), r = sh.getBoundingClientRect(), b = bg.getBoundingClientRect(), D = MSH.dashRect(); const tt = sh.querySelector('msh-editor').shadowRoot.querySelector('.ttl .tt'); return { tfs: getComputedStyle(tt).fontSize, w: Math.round(r.width), cx: Math.round(r.left + r.width / 2), top: Math.round(r.top), bl: Math.round(b.left), bw: Math.round(b.width), D: [Math.round(D.left), Math.round(D.width)] }; });
  ok('36.7 PC + sidebar: ark 440 sentrert i dashbordflaten, top 52, tittel ≈ 24 px (≥ 22 med testfonten), bakteppet starter ved sidebaren', G.w === 440 && Math.abs(G.cx - (G.D[0] + G.D[1] / 2)) <= 1 && G.top === 52 && parseFloat(G.tfs) >= 22 && G.bl === G.D[0] && G.bl >= 256 && G.bw === G.D[1], G);
  await page.close();
}

await browser.close();
try { unlinkSync(bundle); } catch (e) { /* */ }
if (errs.length) { console.log('Sidefeil:', [...new Set(errs)].slice(0, 5)); }
console.log(fails || errs.length ? `\n${fails} feilet` : '\nAlle bestod');
process.exit(fails || errs.length ? 1 : 0);
