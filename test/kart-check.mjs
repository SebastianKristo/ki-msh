// Fiks 20.22 · Kart (#kart, msh-kart-card) mot EKTE Bubble Card: fullskjerm uten Bubble-header, × / Esc / tilbake lukker,
// navbar synlig og mini-spiller skjult, lag + filter-chips, detaljkort, drag lekker ikke, henting bare mens åpen,
// navbar-knappen «Kart», trykk på personbilde i headeren → #kart (hold = hurtigark), GUI-editoren.
//   node test/kart-check.mjs      (Leaflet og Entur er stubbet i test/mock/51-kart.js)
import { createRequire } from 'node:module';
import { readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const bundle = resolve(`test/.build/kart-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const BC = resolve('test/.vendor/bubble-card.js');
if (!existsSync(BC)) execFileSync('curl', ['-sSL', '-o', BC, 'https://raw.githubusercontent.com/Clooos/Bubble-Card/main/dist/bubble-card.js']);
const yml = (py) => JSON.parse(execFileSync('python3', ['-c', `import yaml,json;d=yaml.safe_load(open('examples/dashboard.yaml'));cs=[c for s in d['views'][0]['sections'] for c in s['cards']];print(json.dumps(${py}))`]).toString());
const popup = yml("[c for c in cs if c.get('hash')=='#kart'][0]");
const navbarCfg = yml("[c for c in cs if c['type']=='custom:msh-navbar-card'][0]");
const shot = process.env.SHOT ? '/tmp/claude-0/-home-user/edde745c-687c-5d41-9673-062ed20f63c8/scratchpad/' : '';
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const res = {}, fail = [];
const ok = (name, cond, info) => { res[name] = cond ? 'OK' : ['FEIL', info]; if (!cond) fail.push(name); };
const mocks = readdirSync('test/mock').filter((f) => f.endsWith('.js')).sort().map((m) => resolve('test/mock/' + m));
const errs = [];
async function page(vp, file) {
  const p = await b.newPage({ viewport: vp, hasTouch: true });
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/ERR_|Failed to load resource|bubble-modules|Failed to fetch/.test(m.text())) errs.push(m.text().slice(0, 200)); });
  await p.goto('file://' + resolve(file || 'test/harness-bubble.html'));
  for (const m of mocks) await p.addScriptTag({ path: m });
  await p.addScriptTag({ path: bundle });
  if (!file) { await p.addScriptTag({ path: BC, type: 'module' }); await p.waitForFunction(() => customElements.get('bubble-card'), null, { timeout: 15000 }); }
  return p;
}
const SETUP = async ({ popup, navbarCfg, sb }) => {
  const w = (ms) => new Promise((q) => setTimeout(q, ms));
  document.documentElement.style.setProperty('--sb', sb + 'px');
  const h = (window.__h = window.mockHass());
  const dash = document.getElementById('dash');
  const nav = document.createElement('msh-navbar-card'); nav.setConfig({ ...navbarCfg, mini: { on: true, cond: 'always' } }); nav.hass = h; dash.appendChild(nav);
  const bc = document.createElement('bubble-card'); bc.setConfig(popup); bc.hass = h; dash.appendChild(bc);
  window.__nav = nav;
  window.__hap = []; window.addEventListener('haptic', (e) => window.__hap.push(e.detail));
  await w(400);
};
const HELP = () => {
  window.__deep = () => { const out = []; const walk = (r) => r.querySelectorAll('*').forEach((e) => { out.push(e); if (e.shadowRoot) walk(e.shadowRoot); }); walk(document); return out; };
  window.__pop = () => window.__deep().find((e) => e.classList && e.classList.contains('bubble-pop-up'));
  window.__card = () => window.__deep().find((e) => e.localName === 'msh-kart-card');
  window.__w = (ms) => new Promise((q) => setTimeout(q, ms));
};

/* ---------------------------------------------------------------- mal/strategi */
const p0 = await page({ width: 390, height: 844 });
const tpl = await p0.evaluate(() => {
  const M = window.MSH, t = M.popupTemplateA({ name: 'Kart', icon: 'mdi:map', hash: '#kart', card: { type: 'custom:msh-kart-card' } });
  return { t, fn: M.FUNCTION_POPUPS.some((f) => f[0] === '#kart' && f[3] === 'msh-kart-card'), all: M.allPopups(window.mockHass()).some((x) => x.hash === '#kart') };
});
ok('20.22 Mal A + POPUP_LOOK: show_header false, width_desktop = hele flaten, margin_top 0, bg_opacity 100, ett kort', tpl.t.show_header === false && /^calc\(100% - var\(--bubble-pop-up-content-inline-start/.test(tpl.t.width_desktop) && tpl.t.margin_top_mobile === '0px' && tpl.t.margin_top_desktop === '0px' && tpl.t.bg_opacity === '100' && /border-radius:0/.test(tpl.t.styles) && tpl.t.cards.length === 1 && tpl.t.is_sidebar_hidden, tpl.t);
ok('20.22 #kart i FUNCTION_POPUPS og popup-listen (navbar/Hjem-mål)', tpl.fn && tpl.all, tpl);
ok('20.22 examples/dashboard.yaml: #kart med msh-kart-card og show_header false', popup.show_header === false && popup.cards.length === 1 && popup.cards[0].type === 'custom:msh-kart-card', popup);
await p0.close();

/* ---------------------------------------------------------------- mobil: åpne, lag, detaljer, lukk */
for (const vp of [{ n: 'mobil', width: 390, height: 844, sb: 0 }, { n: 'PC', width: 1400, height: 900, sb: 256 }]) {
  const p = await page({ width: vp.width, height: vp.height });
  await p.evaluate(HELP);
  await p.evaluate(SETUP, { popup, navbarCfg, sb: vp.sb });
  const before = await p.evaluate(() => ({ veh: window.__kartFetch.veh, jp: window.__kartFetch.jp, maps: window.__leaf.maps.length }));
  ok(`20.22 [${vp.n}] ingen henting / kart før #kart åpnes`, before.veh === 0 && before.jp === 0 && before.maps === 0, before);
  await p.evaluate(async () => { location.hash = '#kart'; await window.__w(1600); });
  const O = await p.evaluate(() => {
    const P = window.__pop(), c = window.__card(), sr = c && c.shadowRoot, all = window.__deep();
    const hdr = all.find((e) => e.classList && e.classList.contains('bubble-header-container'));
    const pr = P.getBoundingClientRect(), cr = c.getBoundingClientRect(), x = sr.querySelector('[data-act="close"]').getBoundingClientRect();
    const np = document.querySelector('.msh-navbar-portal'), nav = np && np.shadowRoot.querySelector('[data-nav]'), mini = np && np.shadowRoot.querySelector('.mini');
    const nr = nav && nav.getBoundingClientRect();
    const top = nr ? document.elementFromPoint(nr.left + nr.width / 2, nr.top + nr.height / 2) : null;
    const pts = { persons: sr.querySelectorAll('.msh-mk').length };
    return { open: P.classList.contains('is-popup-opened'), hdrH: hdr ? hdr.getBoundingClientRect().height : 0, pop: [pr.left, pr.top, pr.width, pr.height].map(Math.round), card: [cr.left, cr.top, cr.width, cr.height].map(Math.round), radius: getComputedStyle(P).borderTopLeftRadius, crad: (() => { const cc = getComputedStyle(all.find((e) => e.classList && e.classList.contains('bubble-pop-up-container'))); return cc.borderTopLeftRadius + '/' + cc.clipPath; })(),
      x: [Math.round(x.right), Math.round(x.top), Math.round(x.width)], navOp: nav ? getComputedStyle(nav).opacity : null, navOnTop: !!top && (top === np || np.contains(top)), miniOp: mini ? getComputedStyle(mini).opacity : 'ingen', kartAttr: np && np.hasAttribute('data-kart'),
      rail: nav && nav.classList.contains('rail'), navR: nr ? Math.round(nr.right) : null, ...pts, maps: window.__leaf.maps.length, tiles: window.__leaf.calls.filter((k) => k[0] === 'tileLayer').map((k) => k[2]), urls: window.__leaf.calls.filter((k) => k[0] === 'tileLayer').map((k) => k[1] + ' ' + k[3]), mapOpt: window.__leaf.maps[0] && window.__leaf.maps[0].o, filt: (() => { const t = document.querySelector('msh-kart-card'); const e = t && t.shadowRoot.querySelector('.msh-tiles'); return e ? getComputedStyle(e).filter : 'none'; })() };
  });
  ok(`20.22 [${vp.n}] #kart åpnes (Bubble pop-up) uten Bubble-header`, O.open && O.hdrH === 0, O);
  ok(`20.22 [${vp.n}] fullskjerm: kortet fyller popupen (bredde og høyde), ingen avrunding`, Math.abs(O.card[2] - O.pop[2]) <= 1 && Math.abs(O.card[3] - O.pop[3]) <= 2 && Math.abs(O.card[1] - O.pop[1]) <= 1 && O.pop[1] <= 57 && O.pop[1] + O.pop[3] >= vp.height - 1 && O.radius === '0px' && O.crad === '0px/none', O);
  ok(`20.22 [${vp.n}] × øverst til høyre (48 px)`, O.x[2] === 48 && O.x[0] >= O.pop[0] + O.pop[2] - 30 && O.x[1] < 80, O);
  ok(`20.22 [${vp.n}] navbaren synlig over kartet, mini-spilleren skjult`, O.navOp === '1' && O.navOnTop && O.kartAttr && (O.miniOp === '0' || O.miniOp === 'ingen'), O);
  if (vp.n === 'PC') ok('20.22 [PC] popupen dekker ikke navbar-railen/HA-sidebaren', O.rail && O.pop[0] >= O.navR - 1 && O.pop[0] + O.pop[2] <= vp.width + 1, O);
  ok(`20.22 [${vp.n}] Leaflet-kart laget én gang, mørk flis (msh-dark)`, O.maps === 1 && O.tiles.some((t) => /msh-dark/.test(t || '')), O);
  ok(`22.4 [${vp.n}] CARTO dark_all med attribusjon, ingen OSM-fliser, ingen invert`, O.urls.some((u) => /basemaps\.cartocdn\.com\/dark_all.*CARTO/.test(u)) && !O.urls.some((u) => /tile\.openstreetmap\.org/.test(u)) && O.filt === 'none', O);
  ok(`22.2 [${vp.n}] Leaflet: dragging/touchZoom/scrollWheelZoom/doubleClickZoom på, tap av`, O.mapOpt && O.mapOpt.dragging && O.mapOpt.touchZoom && O.mapOpt.scrollWheelZoom && O.mapOpt.doubleClickZoom && O.mapOpt.tap === false, O.mapOpt);
  await p.evaluate(() => window.__w(600)); // Entur (stub) + rutelinjer
  const Ly = await p.evaluate(() => {
    const c = window.__card(), sr = c.shadowRoot, m = window.__leaf.maps[0];
    const mk = [...sr.querySelectorAll('.msh-mk')].map((e) => e.textContent.replace(/\s+/g, ' ').trim());
    const lay = [...m.layers];
    const circles = lay.flatMap((g) => [...(g.items || [])]).filter((l) => l.kind === 'circle').map((l) => [l.options.radius, l.options.dashArray, l.options.fillOpacity]);
    const lines = lay.flatMap((g) => [...(g.items || [])]).filter((l) => l.kind === 'polyline').length;
    const chips = [...sr.querySelectorAll('.chip')].map((e) => e.textContent.replace(/\s+/g, ' ').trim() + (e.classList.contains('on') ? '*' : ''));
    const sum = sr.querySelector('.sm').textContent;
    const pills = [...sr.querySelectorAll('.pl')].map((e) => e.textContent.replace(/\s+/g, ' ').trim());
    const pulse = [...sr.querySelectorAll('.msh-mk')].some((e) => /mshKartPulse/.test(e.innerHTML));
    const ring = [...sr.querySelectorAll('.msh-mk')].map((e) => (e.innerHTML.match(/border:3px solid ([^;]+);/) || [])[1]).filter(Boolean);
    return { mk, circles, lines, chips, sum, pills, pulse, ring, fetch: { ...window.__kartFetch, bodies: undefined } };
  });
  ok(`20.22 [${vp.n}] personer (bilde + navnelapp), bil og soner på kartet`, ['Sebastian', 'Cybele', 'Rune'].every((n) => Ly.mk.some((t) => t.includes(n))) && Ly.circles.length >= 3 && Ly.mk.some((t) => /Marka/.test(t)), Ly);
  ok(`20.22 [${vp.n}] soner: fyll 12 %, stiplet når radius > 500 m`, Ly.circles.every((c) => c[2] === 0.12) && Ly.circles.some((c) => c[0] > 500 && c[1]) && Ly.circles.filter((c) => c[0] <= 500).every((c) => !c[1]), Ly.circles);
  ok(`20.22 [${vp.n}] statusring: hjemme grønn, borte lilla, i bevegelse oransje med puls`, Ly.ring.some((r) => /green/.test(r)) && Ly.ring.some((r) => /purple/.test(r)) && Ly.ring.some((r) => /orange/.test(r)) && Ly.pulse, Ly.ring);
  ok(`20.22 [${vp.n}] kollektiv: busser/trikker fra Entur (linje-badge) + rutelinjer`, Ly.mk.filter((t) => /^(17|45)$/.test(t)).length === 4 && Ly.lines >= 2 && Ly.fetch.veh >= 1, Ly);
  ok(`20.22 [${vp.n}] topp: oppsummering + filter-chips med antall (på = rosa)`, /hjemme · \d+ borte · \d+ kollektiv i nærheten/.test(Ly.sum) && Ly.chips.length === 4 && Ly.chips.every((c) => c.endsWith('*')) && /Kollektiv\s*4\*/.test(Ly.chips.join('|')), Ly);
  ok(`20.22 [${vp.n}] bunnrad: personer og bil («● … · siden», «Parkert · 68 %»)`, Ly.pills.some((t) => /Sebastian.*● .* · siden \d\d:\d\d/.test(t)) && Ly.pills.some((t) => /Tesla.*Parkert · 68 %/.test(t)) && Ly.pills.some((t) => /Rune.*Kjører · 41 km\/t/.test(t)), Ly.pills);
  const V5 = await p.evaluate(() => ({ b: window.__kartFetch.bodies[0] || '', chip: window.__card().shadowRoot.querySelector('[data-v="transit"]').textContent }));
  ok(`22.5 [${vp.n}] vehicles-spørring med codespaceId RUT + lineRef fra Journey Planner`, /codespaceId:\\?"RUT\\?",lineRef:\\?"RUT:Line:17/.test(V5.b), V5);
  if (shot) await p.screenshot({ path: shot + `kart-${vp.n}.png` });
  // Filter: Kollektiv av → trikker/busser borte; på igjen → tilbake
  const F = await p.evaluate(async () => {
    const sr = window.__card().shadowRoot, n = () => [...sr.querySelectorAll('.msh-mk')].filter((e) => /^(17|45)$/.test(e.textContent.trim())).length, np = () => sr.querySelectorAll('.msh-mk').length;
    const a = n(), hp0 = window.__hap.length;
    sr.querySelector('[data-act="layer"][data-v="transit"]').click(); await window.__w(250);
    const b = n(), on = sr.querySelector('[data-act="layer"][data-v="transit"]').classList.contains('on');
    sr.querySelector('[data-act="layer"][data-v="persons"]').click(); await window.__w(250);
    const pers = [...sr.querySelectorAll('.msh-mk')].some((e) => /Sebastian/.test(e.textContent));
    sr.querySelector('[data-act="layer"][data-v="transit"]').click(); sr.querySelector('[data-act="layer"][data-v="persons"]').click(); await window.__w(300);
    return { a, b, on, pers, c: n(), all: np(), hap: window.__hap.length - hp0 };
  });
  ok(`20.22 [${vp.n}] filter-chips slår lag av og på (haptic)`, F.a === 4 && F.b === 0 && !F.on && !F.pers && F.c === 4 && F.hap >= 2, F);
  // Trykk på et kort (pille) → flyr dit + detaljkort; trykk på kartet lukker
  const D = await p.evaluate(async () => {
    const sr = window.__card().shadowRoot, L = window.__leaf.calls, n0 = L.length, hp0 = window.__hap.length;
    sr.querySelector('.pl[data-id="person.sebastian"]').click(); await window.__w(200);
    const fly = L.slice(n0).find((k) => k[0] === 'flyTo' || k[0] === 'flyToBounds');
    const det = sr.querySelector('.det'), txt = det ? det.textContent.replace(/\s+/g, ' ') : '';
    const cr = window.__card().getBoundingClientRect(), dr = det && det.getBoundingClientRect(), rr = sr.querySelector('.row').getBoundingClientRect();
    const np = document.querySelector('.msh-navbar-portal'), nav = np.shadowRoot.querySelector('[data-nav]'), nr = nav.getBoundingClientRect();
    const out = { fly, txt, above: dr && dr.bottom <= rr.top + 1, rowAboveNav: nav.classList.contains('rail') || rr.bottom <= nr.top + 1, hap: window.__hap.length - hp0 };
    window.__leaf.maps[0].el.dispatchEvent(new MouseEvent('click', { bubbles: true })); await window.__w(200);
    out.closedByMap = !sr.querySelector('.det');
    // bil
    sr.querySelector('.pl[data-id="device_tracker.tesla_location"]').click(); await window.__w(200);
    out.car = (sr.querySelector('.det') || {}).textContent;
    // samme markør igjen lukker: klikk bilmarkøren to ganger
    const carMk = [...sr.querySelectorAll('.msh-mk')].find((e) => e.querySelector('ha-icon[icon="mdi:car"]'));
    carMk.click(); await window.__w(200); out.carToggle = !sr.querySelector('.det');
    // sone
    const zm = [...sr.querySelectorAll('.msh-mk')].find((e) => /Hjem/.test(e.textContent) && !/Sebastian/.test(e.textContent)); zm.click(); await window.__w(200);
    out.zone = (sr.querySelector('.det') || {}).textContent;
    // kollektiv
    const vm = [...sr.querySelectorAll('.msh-mk')].find((e) => e.textContent.trim() === '17'); vm.click(); await window.__w(500);
    out.veh = (sr.querySelector('.det') || {}).textContent;
    const ru = sr.querySelector('[data-act="ruter"]'); out.ruterBtn = !!ru;
    return out;
  });
  ok(`20.22 [${vp.n}] trykk på kort → flyr dit + detaljkort over raden (person: batteri, fart, nøyaktighet, oppdatert, Veibeskrivelse)`, D.fly && D.above && /Batteri.*81 %/.test(D.txt) && /Nøyaktighet/.test(D.txt) && /Oppdatert/.test(D.txt) && /Veibeskrivelse/.test(D.txt) && D.hap >= 1, D);
  ok(`20.22 [${vp.n}] bunnraden ligger over navbaren`, D.rowAboveNav, D);
  // 22.1: navbaren målt → --nav-*; topp/bunn/detaljkort innenfor ledig flate; Leaflet-padding tar med navbar + detaljkort
  const N1 = await p.evaluate(async () => {
    const c = window.__card(), sr = c.shadowRoot, cs = getComputedStyle(c), v = (k) => parseFloat(cs.getPropertyValue('--nav-' + k)) || 0;
    const nav = document.querySelector('.msh-navbar-portal').shadowRoot.querySelector('[data-nav]').getBoundingClientRect();
    const L = window.__leaf.calls, n0 = L.length;
    sr.querySelector('.pl[data-id="person.sebastian"]').click(); await window.__w(250);
    const fly = L.slice(n0).find((k) => k[0] === 'flyToBounds');
    const hit = (r) => r.right > nav.left + 1 && r.left < nav.right - 1 && r.bottom > nav.top + 1 && r.top < nav.bottom - 1;
    const tr = sr.querySelector('.chips').getBoundingClientRect(), det = sr.querySelector('.det'), dr = det && det.getBoundingClientRect(), br = sr.querySelector('.bot').getBoundingClientRect();
    const out = { nav: { top: v('top'), right: v('right'), bottom: v('bottom'), left: v('left') }, fly, chipsHit: hit(tr), detHit: dr ? hit(dr) : null, botHit: hit(br), dh: dr ? Math.round(dr.height) : 0, detMax: det ? getComputedStyle(det).maxHeight : '', detOv: det ? getComputedStyle(det).overflowY : '' };
    sr.querySelector('.pl[data-id="person.sebastian"]').click(); await window.__w(150);
    return out;
  });
  ok(`22.1 [${vp.n}] navbar målt (--nav-*), chips/bunnrad/detaljkort ikke bak navbaren`, (vp.n === "PC" ? true : N1.nav.bottom > 0) && !N1.chipsHit && !N1.detHit && !N1.botHit && N1.detOv === 'auto' && N1.detMax !== 'none', N1);
  const F7 = await p.evaluate(async () => {
    const L = window.__leaf.calls, n0 = L.length;
    window.dispatchEvent(new CustomEvent('msh-kart-focus', { detail: { entity_id: 'person.rune' } })); await window.__w(700);
    const f = L.slice(n0).find((k) => k[0] === 'flyToBounds'), sel = window.__card().ui.sel;
    window.__card().setUI({ sel: null }); await window.__w(100);
    return { f, sel };
  });
  ok(`22.7 [${vp.n}] msh-kart-focus → velger personen og flyr dit med nav-padding`, F7.f && F7.sel && F7.sel.id === 'person.rune' && Array.isArray(F7.f[2]), F7);
  ok(`22.1 [${vp.n}] flyTo med padding fra navbar + detaljkort`, N1.fly && N1.fly[2][0] === N1.nav.left + 16 && N1.fly[2][1] === N1.nav.top + 120 && N1.fly[3][1] >= N1.nav.bottom + 16 + Math.min(N1.dh, 60), N1);
  ok(`20.22 [${vp.n}] trykk på kartet lukker detaljkortet, samme markør lukker også`, D.closedByMap && D.carToggle, D);
  ok(`20.22 [${vp.n}] detaljer: bil (batteri/rekkevidde/låst), sone (hvem er der), kollektiv (linje, retning, neste stopp, tid, belegg, Åpne Ruter)`, /Batteri.*68 %/.test(D.car || '') && /Rekkevidde/.test(D.car || '') && /Sebastian/.test(D.zone || '') && /Trikk 17/.test(D.veh || '') && /mot Grefsen/.test(D.veh || '') && /Neste stopp.*Bislett/.test(D.veh || '') && /Tid\s*\d\d:\d\d/.test(D.veh || '') && /God plass/.test(D.veh || '') && D.ruterBtn, D);
  // Side-knapper
  const S = await p.evaluate(async () => {
    const sr = window.__card().shadowRoot, L = window.__leaf.calls, n0 = L.length;
    ['zin', 'zout', 'fit', 'home'].forEach((a) => sr.querySelector(`[data-act="${a}"]`).click());
    await window.__w(100);
    return L.slice(n0).map((k) => k[0]);
  });
  ok(`20.22 [${vp.n}] høyre side: zoom +/−, Vis alle, Hjem`, S.join(',') === 'zoomIn,zoomOut,flyToBounds,flyToBounds', S);
  // Drag på kartet / raden / chipsene når ikke popupen
  const G = await p.evaluate(async () => {
    const P = window.__pop(), sr = window.__card().shadowRoot; let leaked = 0; const spy = () => leaked++;
    ['pointerdown', 'touchstart', 'touchmove', 'wheel'].forEach((t) => P.addEventListener(t, spy));
    const els = [sr.querySelector('.map'), sr.querySelector('.map .msh-mk') || sr.querySelector('.map > *'), sr.querySelector('.row'), sr.querySelector('.chips'), sr.querySelector('.side')];
    const per = [];
    for (const d of els) {
      const l0 = leaked;
      const r = d.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
      d.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true, clientX: x, clientY: y, pointerId: 7 }));
      const t = new Touch({ identifier: 7, target: d, clientX: x, clientY: y + 60 });
      d.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, composed: true, touches: [t] })); d.dispatchEvent(new TouchEvent('touchmove', { bubbles: true, composed: true, touches: [t] }));
      d.dispatchEvent(new WheelEvent('wheel', { bubbles: true, composed: true, deltaY: 100 }));
      d.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, composed: true, clientX: x, clientY: y, pointerId: 7 }));
      per.push((d.className || d.localName) + ':' + (leaked - l0));
    }
    ['pointerdown', 'touchstart', 'touchmove', 'wheel'].forEach((t) => P.removeEventListener(t, spy));
    await window.__w(200);
    return { leaked, per, hash: location.hash, ta: getComputedStyle(sr.querySelector('.map')).touchAction };
  });
  ok(`20.22 [${vp.n}] pan/zoom lukker ikke popupen (touch-action none + stopPropagation)`, G.leaked === 0 && G.hash === '#kart' && G.ta === 'none', G);
  // Lukk: ×, Esc, tilbake – og henting stopper
  const C = await p.evaluate(async () => {
    const c = window.__card(), sr = c.shadowRoot, out = {};
    out.poll = !!c._poll;
    sr.querySelector('[data-act="close"]').click(); await window.__w(900);
    out.x = location.hash === '' && !(window.__pop() && window.__pop().classList.contains('is-popup-opened'));
    out.pollOff = !c._poll;
    const np = document.querySelector('.msh-navbar-portal'); out.kartAttr = np.hasAttribute('data-kart');
    location.hash = '#kart'; await window.__w(900);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); await window.__w(900);
    out.esc = location.hash === '' && !(window.__pop() && window.__pop().classList.contains('is-popup-opened'));
    location.hash = '#kart'; await window.__w(900);
    history.back(); await window.__w(900);
    out.back = location.hash !== '#kart' && !(window.__pop() && window.__pop().classList.contains('is-popup-opened'));
    out.veh = window.__kartFetch.veh;
    return out;
  });
  ok(`20.22 [${vp.n}] ×, Esc og tilbake lukker; polling stoppes, mini-spilleren tilbake`, C.poll && C.x && C.pollOff && !C.kartAttr && C.esc && C.back, C);
  if (vp.n === 'mobil') {
    await p.waitForTimeout(16000);
    const v2 = await p.evaluate(() => window.__kartFetch.veh);
    ok('20.22 ingen henting i bakgrunnen når #kart er lukket (15 s-polling bare mens åpen)', v2 === C.veh, { v2, v1: C.veh });
    await p.evaluate(() => { location.hash = '#kart'; });
    await p.waitForTimeout(16500);
    const v3 = await p.evaluate(() => window.__kartFetch.veh);
    ok('20.22 henter på nytt hvert 15. s mens #kart er åpen', v3 >= C.veh + 2, { v3, v1: C.veh });
  }
  await p.close();
}

/* ---------------------------------------------------------------- navbar-knappen «Kart» + header-trykk + editor */
const q = await page({ width: 390, height: 844 }, 'test/harness.html');
const N = await q.evaluate(async () => {
  const w = (ms) => new Promise((r) => setTimeout(r, ms)), h = window.mockHass(), out = {};
  const dash = document.body.appendChild(document.createElement('div')); // ikke #dash: navbar-selvtesten (mock/10-navbar.js) kjører bare der
  const mk = (cfg) => { const n = document.createElement('msh-navbar-card'); n.setConfig({ type: 'custom:msh-navbar-card', ...cfg }); n.hass = h; dash.appendChild(n); return n; };
  const ids = (n) => [...n._portal.shadowRoot.querySelectorAll('[data-nav] [data-id]')].map((e) => e.dataset.id);
  const n1 = mk({}); await w(300); out.def = ids(n1); n1.remove();
  const n2 = mk({ bar: ['vanning', 'media', 'kart'] }); await w(300); out.withKart = ids(n2);
  const np = n2._portal, btn = np.shadowRoot.querySelector('[data-nav] [data-id="kart"]');
  out.icon = btn && btn.querySelector('ha-icon') && btn.querySelector('ha-icon').getAttribute('icon');
  if (btn) btn.click(); await w(200); out.hash = location.hash; location.hash = '';
  n2.remove();
  // Tilpass navbar: «Kart» står som skjult knapp og kan slås på (nbhide) → lagres i more
  const ed = document.createElement('msh-navbar-card').constructor.getConfigElement();
  ed.hass = h; ed.setConfig({ type: 'custom:msh-navbar-card' }); document.body.appendChild(ed); await w(150);
  let got = null; ed.addEventListener('config-changed', (e) => { got = e.detail.config; });
  const hb = ed.shadowRoot.querySelector('[data-a="nbhide"][data-id="kart"]');
  out.edRow = !!hb;
  if (hb) { hb.click(); await w(100); }
  out.saved = got && { more: got.more, hidden: got.hidden };
  ed.remove();
  // Header: trykk på personbilde → #kart, hold → hurtigark
  const hd = document.createElement('msh-hjem-header-card'); hd.setConfig({ type: 'custom:msh-hjem-header-card', card_id: 'ki-home-header' }); hd.hass = h; dash.appendChild(hd); await w(400);
  const face = hd.shadowRoot.querySelector('.face[data-act="person"]');
  out.face = !!face;
  if (face) { face.click(); await w(150); }
  out.tap = location.hash; location.hash = ''; await w(100);
  if (face) {
    const r = face.getBoundingClientRect();
    face.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true, clientX: r.left + 5, clientY: r.top + 5, pointerId: 3 }));
    await w(700);
    face.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, composed: true, clientX: r.left + 5, clientY: r.top + 5, pointerId: 3 }));
    await w(300);
  }
  out.holdHash = location.hash;
  out.quick = window.MSH.portals().length > 0 || !!document.querySelector('ki-overlay-root, .msh-overlay-root');
  out.moreInfo = (window.__calls || []).some((c) => c[0] === 'hass-more-info');
  // GUI-editoren for kartet: seksjoner og lagring
  const ke = customElements.get('msh-kart-card').getConfigElement(); ke.hass = h; ke.setConfig({ type: 'custom:msh-kart-card', card_id: 'pop-kart' }); document.body.appendChild(ke); await w(150);
  const txt = ke.shadowRoot.textContent;
  out.edTxt = ['Personer og biler', 'Soner', 'Kollektiv', 'Startvisning', 'Kartstil', 'Satellitt', 'Meg'].filter((x) => !txt.includes(x));
  let kc = null; ke.addEventListener('config-changed', (e) => { kc = e.detail.config; });
  const st = [...ke.shadowRoot.querySelectorAll('[data-a="sel"][data-name="start"]')].find((e) => e.dataset.v === 'home'); if (st) st.click(); await w(80);
  out.kc = kc;
  return out;
});
ok('20.22 navbar: «Kart» er ikke på som standard', !N.def.includes('kart'), N.def);
ok('20.22 navbar: «Kart» lagt til i bar → ikon mdi:map og åpner #kart', N.withKart.includes('kart') && /map/.test(N.icon || '') && N.hash === '#kart', N);
ok('20.22 Tilpass navbar: «Kart» kan slås på (lagres i more)', N.edRow && N.saved && Array.isArray(N.saved.more) && N.saved.more.includes('kart') && !(N.saved.hidden || []).includes('kart'), N);
// 22.7 erstatter 20.22: trykk på personbilde = person-popup (#person-<id>), hold = hurtigark
ok('22.7 header: trykk på personbilde → #person-…, hold → hurtigark', N.face && /^#person-/.test(N.tap || '') && N.holdHash !== '#kart' && N.quick, N);
ok('20.22 GUI-editor: personer/biler, soner, kollektiv-linjer, startvisning, kartstil – lagrer', !N.edTxt.length && N.kc && N.kc.start === 'home', N);
await q.close();

await b.close();
try { (await import('node:fs')).unlinkSync(bundle); } catch (e) { /* */ }
console.log(JSON.stringify(res, null, 1));
if (errs.length) console.log('Sidefeil:', [...new Set(errs)].slice(0, 8));
console.log(fail.length || errs.length ? `\n${fail.length} feilet${errs.length ? ` · ${errs.length} sidefeil` : ''}` : '\nAlle bestod');
process.exit(fail.length || errs.length ? 1 : 0);
