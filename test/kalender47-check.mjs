// Fiks 47 E + K · Kalender: fanetrykk (felles MSH.tabPress) og plakater for Sonarr/Radarr/Plex (M.arrMedia, 06-arr-media.js).
//   K: plakat fra upcoming_media-sensoren (Sonarr) og Radarr-sensoren (kalender-event uten bilde), Plex via HA-proxy
//      (media_player entity_picture → hass.hassUrl), http:// avvist på https, plassholder ved lastefeil, 24 t-cache per tittel,
//      «Plakater: Skjul», feltene i Tilpass → Kilder → Framover og GUI-editoren, mål (rad 44×64 r8, hero 88×128 r12),
//      hero-bakgrunn = fanart, ingen API-nøkler.  sessionStorage 'ki-cal-tab' = 'fram' → Framover ved åpning (og fjernet).
//   E: trykk med liten bevegelse bytter, pointercancel innen 250 ms bytter, stor bevegelse bytter ikke, ingen bytte under
//      window.__tabReorder, mus-klikk = ett bytte og én haptic (click ignoreres 400 ms), trykk på aktiv fane = ingen haptic,
//      tastatur (Enter) bytter fortsatt, fanene har touch-action pan-x, padding-treff i sporet velger nærmeste fane.
//   node test/kalender47-check.mjs
import { createRequire } from 'node:module';
import { readdirSync, mkdirSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
mkdirSync('test/.build', { recursive: true });
const bundle = resolve(`test/.build/kalender47-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
let fails = 0;
const ok = (name, cond, info) => { if (!cond) fails++; console.log(`${cond ? '✔' : '✘'} ${name}${info != null && !cond ? ' · ' + JSON.stringify(info).slice(0, 1200) : ''}`); };
const mocks = readdirSync('test/mock').filter((f) => f.endsWith('.js')).sort().map((m) => resolve('test/mock/' + m));
const errs = [];
// 1×1 PNG for «ekte» bilder (https://img.test/… og HA-proxyen https://ha.test/api/…); /broken → 404
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const REQ = [];

async function page(cfg, prep) {
  const p = await b.newPage({ viewport: { width: 400, height: 1000 }, hasTouch: true });
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await p.route(/^https:\/\/(img|ha)\.test\//, (r) => { REQ.push(r.request().url()); return /broken/.test(r.request().url()) ? r.fulfill({ status: 404, body: 'nei' }) : r.fulfill({ status: 200, contentType: 'image/png', body: PNG }); });
  await p.goto('file://' + resolve('test/harness.html'));
  for (const m of mocks) await p.addScriptTag({ path: m });
  await p.addScriptTag({ path: bundle });
  await p.evaluate(async ({ cfg, prep }) => {
    const H = window.__h = window.mockHass();
    window.HP = []; window.addEventListener('haptic', (e) => window.HP.push(e.detail));
    // HA på https (blandet innhold blokkeres) + hassUrl som i HA-frontend
    H.auth = { data: { hassUrl: 'https://ha.test' } };
    H.hassUrl = (path) => new URL(path || '', 'https://ha.test').toString();
    const S = (id, patch) => { const st = H.states[id]; H.states[id] = { ...st, attributes: { ...st.attributes, ...patch } }; };
    window.S = S;
    if (prep) (new Function('H', 'S', prep))(H, S);
    const bc = document.createElement('bubble-card');
    bc.setConfig({ type: 'custom:bubble-card', card_type: 'pop-up', hash: '#kalender' });
    bc.innerHTML = '<div class="pop"><div class="hdr">Kalender</div><div class="inner"></div></div>';
    document.getElementById('dash').appendChild(bc);
    location.hash = '#kalender';
    const c = document.createElement('msh-kalender-card');
    c.setConfig({ type: 'custom:msh-kalender-card', card_id: 'k47', ...(cfg || {}) });
    c.hass = H;
    bc.querySelector('.inner').appendChild(c);
    window.__c = c;
    await new Promise((q) => setTimeout(q, 600));
  }, { cfg, prep: prep || '' });
  return p;
}
const wait = (p, ms) => p.evaluate((ms) => new Promise((q) => setTimeout(q, ms)), ms);
const goFram = (p) => p.evaluate(async () => { const c = window.__c; c.setUI({ tab: 'framover' }); await new Promise((q) => setTimeout(q, 900)); });

/* =============================================================== K · plakater */
// Sonarr: https-plakat på «Slow Horses», http (lokal MediaCover) på «The Last of Us», plakat som feiler på «Severance».
// Radarr: upcoming_media-sensor med plakat + fanart for «Superman» (kalender-eventen har ingen bilder).
// Plex: «Oppenheimer» uten plakat i sensoren – spilleren har den (entity_picture via HA-proxy).
const PREP = `
  localStorage.clear();
  const d = H.states['sensor.sonarr_sonarr_upcoming_media'].attributes.data.map((x) => ({ ...x }));
  d.forEach((x) => {
    if (x.title === 'Slow Horses') { x.poster = 'https://img.test/slow-poster.jpg'; x.fanart = 'https://img.test/slow-fanart.jpg'; }
    if (x.title === 'The Last of Us') { x.poster = 'http://192.168.1.5:8989/MediaCover/7/poster.jpg'; x.fanart = ''; }
    if (x.title === 'Severance') x.poster = 'https://img.test/broken/severance.jpg';
  });
  S('sensor.sonarr_sonarr_upcoming_media', { data: d });
  H.states['sensor.radarr_radarr_upcoming_media'] = { entity_id: 'sensor.radarr_radarr_upcoming_media', state: '1', attributes: { friendly_name: 'Radarr kommende', data: JSON.stringify([{ title_default: '$title' }, { title: 'Superman', airdate: new Date(Date.now() + 8 * 864e5).toISOString().slice(0, 10), poster: 'https://img.test/superman-poster.jpg', fanart: 'https://img.test/superman-fanart.jpg' }]) }, last_changed: '', last_updated: '', context: {} };
  S('media_player.plex_stue', { media_title: 'Oppenheimer', entity_picture: '/api/media_player_proxy/media_player.plex_stue?token=abc&cache=1' });
`;
let p = await page({}, PREP);
await goFram(p);
const K1 = await p.evaluate(() => {
  const sr = window.__c.shadowRoot, rows = [...sr.querySelectorAll('.mr')];
  const row = (t) => rows.find((r) => r.textContent.includes(t)) || sr.querySelector('.hero');
  const info = (el) => { if (!el) return null; const box = el.querySelector('.pst'), im = box && box.querySelector('img'); const r = box && box.getBoundingClientRect(); return { box: !!box, ph: box && box.classList.contains('ph'), src: im && im.getAttribute('src'), ok: !!(im && im.classList.contains('ok')), vis: im ? getComputedStyle(im).opacity : null, err: box && box.classList.contains('err'), lazy: im && im.getAttribute('loading'), dec: im && im.getAttribute('decoding'), ref: im && im.getAttribute('referrerpolicy'), fit: im && getComputedStyle(im).objectFit, wh: r && [Math.round(r.width), Math.round(r.height), getComputedStyle(box).borderRadius], bg: box && getComputedStyle(box).backgroundImage.slice(0, 40) }; };
  const hero = sr.querySelector('.hero'), hb = hero && hero.querySelector('.bdrop'), hbi = hb && hb.querySelector('img');
  return { slow: info(row('Slow Horses')), tlou: info(row('The Last of Us')), sev: info(row('Severance')), sup: info(row('Superman')), hero: info(hero), heroBg: hbi && hbi.getAttribute('src'), heroTitle: hero && hero.querySelector('.htl').textContent, html: sr.innerHTML.length };
});
const K1plex = await p.evaluate(async () => { const c = window.__c; c.setUI({ ff: 'plex' }); await new Promise((q) => setTimeout(q, 700)); const sr = c.shadowRoot; const pc = [...sr.querySelectorAll('.pc')].find((x) => x.textContent.includes('Oppenheimer')); const im = pc && pc.querySelector('.pst img'); return { src: im && im.getAttribute('src'), ok: !!(im && im.classList.contains('ok')), dune: !!([...sr.querySelectorAll('.pc')].find((x) => x.textContent.includes('Dune')) || {}).querySelector }; });
const heroIs = K1.heroTitle;
ok('K Sonarr: plakat fra upcoming_media-sensoren vises (https, lastet)', (K1.slow && K1.slow.src === 'https://img.test/slow-poster.jpg' && K1.slow.ok && K1.slow.vis === '1'), K1.slow);
ok('K <img loading=lazy decoding=async referrerpolicy=no-referrer>, object-fit cover', K1.slow && K1.slow.lazy === 'lazy' && K1.slow.dec === 'async' && K1.slow.ref === 'no-referrer' && K1.slow.fit === 'cover', K1.slow);
ok('K hero: plakat 88×128 r12 + fanart som bakgrunn', heroIs === 'Slow Horses' ? K1.hero.wh.join() === '88,128,12px' && K1.heroBg === 'https://img.test/slow-fanart.jpg' : K1.hero && K1.hero.wh.join() === '88,128,12px', { heroIs, hero: K1.hero, bg: K1.heroBg });
ok('K Radarr: kalender-event uten bilde får plakat fra Radarr-sensoren (rad 44×64 r8)', K1.sup && K1.sup.src === 'https://img.test/superman-poster.jpg' && K1.sup.wh.join() === '44,64,8px', K1.sup);
ok('K http://-plakat avvist på https (ingen img, stripet plassholder)', K1.tlou && K1.tlou.box && !K1.tlou.src && K1.tlou.ph && /repeating-linear-gradient/.test(K1.tlou.bg), K1.tlou);
ok('K bilde som feiler → plassholderen blir stående (img skjult)', K1.sev && K1.sev.src && K1.sev.err && !K1.sev.ok && /repeating-linear-gradient/.test(K1.sev.bg), K1.sev);
ok('K Plex: spillerens entity_picture via HA-proxy (hass.hassUrl, https)', K1plex.src === 'https://ha.test/api/media_player_proxy/media_player.plex_stue?token=abc&cache=1' && K1plex.ok, K1plex);
ok('K ingen forespørsel mot http:// eller lokal MediaCover', !REQ.some((u) => /^http:|MediaCover/.test(u)), REQ);
// 24 t-cache per tittel: plakaten forsvinner fra sensoren → vises fortsatt fra cachen (localStorage ki-arr:<tittel>)
const K2 = await p.evaluate(async () => {
  const H = window.__h, c = window.__c;
  const raw = localStorage.getItem('ki-arr:slow horses');
  const d = H.states['sensor.sonarr_sonarr_upcoming_media'].attributes.data.map((x) => (x.title === 'Slow Horses' ? { ...x, poster: '', fanart: '' } : x));
  window.S('sensor.sonarr_sonarr_upcoming_media', { data: d });
  c.hass = { ...H, states: { ...H.states } };
  c.setUI({ ff: 'alle' }); await new Promise((q) => setTimeout(q, 700));
  const sr = c.shadowRoot, el = [...sr.querySelectorAll('.mr'), sr.querySelector('.hero')].find((r) => r && r.textContent.includes('Slow Horses'));
  const im = el && el.querySelector('.pst img');
  // utløpt cache (> 24 t) gir ingen plakat
  const o = JSON.parse(raw); localStorage.setItem('ki-arr:slow horses', JSON.stringify({ ...o, t: Date.now() - 25 * 3600e3 }));
  const exp = MSH.arrMedia.cached('Slow Horses');
  return { raw, src: im && im.getAttribute('src'), exp };
});
ok('K cache: plakat-URL lagret per tittel i 24 t og brukt når kilden mangler', K2.raw && /slow-poster/.test(K2.raw) && K2.src === 'https://img.test/slow-poster.jpg' && K2.exp === null, K2);
// M.arrMedia.img – regler
const K3 = await p.evaluate(() => { const A = MSH.arrMedia, H = window.__h; return [A.img(H, 'https://a.b/x.jpg'), A.img(H, 'http://10.0.0.2:7878/x.jpg'), A.img(H, '/MediaCover/1/poster.jpg'), A.img(H, '/api/image_proxy/image.x'), A.img(H, '//cdn.x/y.jpg'), A.img(H, 'javascript:alert(1)'), A.img({ ...H, auth: { data: { hassUrl: 'http://ha.local:8123' } }, hassUrl: (q) => 'http://ha.local:8123' + q }, 'http://10.0.0.2/x.jpg')]; });
ok('K M.arrMedia.img: https ok, http/relativ MediaCover/javascript avvist på https, /api → hassUrl, http ok på http-HA', K3[0] === 'https://a.b/x.jpg' && K3[1] === null && K3[2] === null && K3[3] === 'https://ha.test/api/image_proxy/image.x' && K3[4] === 'https://cdn.x/y.jpg' && K3[5] === null && K3[6] === 'http://10.0.0.2/x.jpg', K3);
// M.arrMedia.items (Hjem «Kommer i dag» bruker den)
const K4 = await p.evaluate(async () => { const L = await MSH.arrMedia.items(window.__h, { from: Date.now() - 864e5, to: Date.now() + 20 * 864e5 }); return L.map((x) => [x.source, x.title, !!x.poster, typeof x.time, x.start instanceof Date]); });
ok('K M.arrMedia.items: Sonarr + Radarr (+ Plex) med sikre plakater, sortert', K4.some((x) => x[0] === 'sonarr' && x[1] === 'Slow Horses') && K4.some((x) => x[0] === 'radarr' && x[1] === 'Superman' && x[2]) && K4.every((x) => x[3] === 'string' && x[4]), K4);
await p.close();

// «Plakater: Skjul»
p = await page({ posters: 'hide' }, PREP);
await goFram(p);
const K5 = await p.evaluate(() => { const sr = window.__c.shadowRoot; return { rows: sr.querySelectorAll('.mr').length, pst: sr.querySelectorAll('.mr .pst, .hero .pst').length, img: sr.querySelectorAll('.mr img, .hero img').length }; });
ok('K «Plakater: Skjul» → ingen plakater/bilder i listen og hero', K5.rows > 0 && K5.pst === 0 && K5.img === 0, K5);
// Editorene: Tilpass → Kilder → Framover og GUI-editoren har samme felt
const K6 = await p.evaluate(async () => {
  const C = customElements.get('msh-kalender-card'), el = C.getConfigElement ? C.getConfigElement() : document.createElement('msh-kalender-card-editor');
  el.setConfig({ type: 'custom:msh-kalender-card', card_id: 'k47', posters: 'hide' }); el.hass = window.__h; document.body.appendChild(el);
  await new Promise((q) => setTimeout(q, 300));
  const r = el.shadowRoot; const tab = [...r.querySelectorAll('[data-a="tab"]')].find((t) => t.dataset.v === 'kilder'); if (tab) tab.click();
  await new Promise((q) => setTimeout(q, 300));
  r.querySelectorAll('details[data-focus="framover"]').forEach((d) => { d.open = true; });
  await new Promise((q) => setTimeout(q, 200));
  const names = [...r.querySelectorAll('[data-name]')].map((x) => x.dataset.name);
  // kortets eget Tilpass-ark
  window.__c.openEditor ? window.__c.openEditor('framover') : null;
  return { gui: ['sonarr_entity', 'radarr_entity', 'plex_entity', 'posters'].filter((n) => names.includes(n)), html: r.innerHTML.includes('Plakater'), det: MSH.arrMedia.detect(window.__h) };
});
ok('K GUI-editor: sonarr_entity, radarr_entity, plex_entity, Plakater (Vis/Skjul)', K6.gui.length === 4 && K6.html, K6);
ok('K autodetekt: upcoming_media-sensorene og Plex', K6.det.sonarr === 'sensor.sonarr_sonarr_upcoming_media' && K6.det.radarr === 'sensor.radarr_radarr_upcoming_media' && K6.det.radarr_cal === 'calendar.radarr' && K6.det.plex === 'sensor.plex_recently_added', K6.det);
await p.close();

/* =============================================================== ki-cal-tab */
p = await page({ start_tab: 'kalender' });
const T1 = await p.evaluate(async () => {
  const c = window.__c, out = { før: c.tab };
  location.hash = ''; await new Promise((q) => setTimeout(q, 400));
  sessionStorage.setItem('ki-cal-tab', 'fram');
  location.hash = '#kalender'; await new Promise((q) => setTimeout(q, 700));
  out.etter = c.tab; out.left = sessionStorage.getItem('ki-cal-tab');
  out.aktiv = (c.shadowRoot.querySelector('.top>.tabs [aria-selected="true"]') || {}).dataset;
  out.aktiv = out.aktiv && out.aktiv.v;
  // allerede åpen: hashchange til #kalender igjen
  c.setUI({ tab: 'kalender' }); await new Promise((q) => setTimeout(q, 200));
  sessionStorage.setItem('ki-cal-tab', 'posten'); window.dispatchEvent(new HashChangeEvent('hashchange')); await new Promise((q) => setTimeout(q, 300));
  out.open2 = c.tab; out.left2 = sessionStorage.getItem('ki-cal-tab');
  return out;
});
ok("ki-cal-tab 'fram' → Framover åpnes ved #kalender (vinner over startfanen), verdien fjernes", T1.etter === 'framover' && T1.aktiv === 'framover' && T1.left === null, T1);
ok('ki-cal-tab mens popupen er åpen (hashchange) → fanen byttes', T1.open2 === 'posten' && T1.left2 === null, T1);
await p.close();

/* =============================================================== E · fanetrykk */
p = await page({ tab_labels: 'name' });
const cdp = await p.context().newCDPSession(p);
const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
const tabs = () => p.evaluate(() => { const row = window.__c.shadowRoot.querySelector('.top>.tabs'); return [...row.children].filter((x) => x.tagName === 'BUTTON').map((x) => { const r = x.getBoundingClientRect(); return { v: x.dataset.v, x: r.left + r.width / 2, y: r.top + r.height / 2, l: r.left, r: r.right, t: r.top, b: r.bottom, ta: getComputedStyle(x).touchAction, th: x.style.webkitTapHighlightColor }; }); });
const state = () => p.evaluate(() => ({ tab: window.__c.tab, hp: window.HP.slice() }));
const reset = () => p.evaluate(() => { window.HP.length = 0; });
let T = await tabs();
ok('E fanene: touch-action pan-x, ingen tap-highlight, felles MSH.tabPress på raden', T.every((t) => t.ta === 'pan-x' && /transparent|rgba\(0, 0, 0, 0\)/.test(t.th)) && await p.evaluate(() => !!window.__c.shadowRoot.querySelector('.top>.tabs').__tabPress), T);
// 1) touch med liten bevegelse (10 px) bytter likevel – én haptic «light»
await reset();
let t1 = T[1];
await touch('touchStart', [{ x: t1.x, y: t1.y }]); await wait(p, 40);
await touch('touchMove', [{ x: t1.x + 4, y: t1.y + 3 }]); await wait(p, 30);
await touch('touchMove', [{ x: t1.x + 8, y: t1.y + 6 }]); await wait(p, 30);
await touch('touchEnd', []); await wait(p, 600);
let s = await state();
ok('E touch med liten bevegelse (10 px) bytter fane', s.tab === t1.v, s);
ok('E én haptic «light» per trykk', s.hp.length === 1 && s.hp[0] === 'light', s.hp);
// 2) pointercancel innen 250 ms bytter likevel
await reset();
T = await tabs();
let t2 = T[2];
await p.evaluate(({ x, y }) => { const row = window.__c.shadowRoot.querySelector('.top>.tabs'), btn = [...row.children][2]; const o = { pointerId: 77, pointerType: 'touch', isPrimary: true, bubbles: true, composed: true, clientX: x, clientY: y }; btn.dispatchEvent(new PointerEvent('pointerdown', o)); return new Promise((q) => setTimeout(() => { btn.dispatchEvent(new PointerEvent('pointercancel', o)); q(); }, 80)); }, t2);
await wait(p, 500);
s = await state();
ok('E pointercancel innen 250 ms bytter fane (én haptic)', s.tab === t2.v && s.hp.length === 1, s);
// 3) pointercancel etter 300 ms og stor bevegelse (30 px) bytter IKKE
await reset();
T = await tabs();
const t3 = T[3];
await p.evaluate(({ x, y }) => { const row = window.__c.shadowRoot.querySelector('.top>.tabs'), btn = [...row.children][3]; const o = (dx) => ({ pointerId: 78, pointerType: 'touch', isPrimary: true, bubbles: true, composed: true, clientX: x + dx, clientY: y }); btn.dispatchEvent(new PointerEvent('pointerdown', o(0))); return new Promise((q) => setTimeout(() => { btn.dispatchEvent(new PointerEvent('pointercancel', o(0))); btn.dispatchEvent(new PointerEvent('pointerdown', o(0))); btn.dispatchEvent(new PointerEvent('pointerup', o(30))); q(); }, 300)); }, t3);
await wait(p, 400);
s = await state();
ok('E sen pointercancel (> 250 ms) og bevegelse ≥ 14 px bytter ikke', s.tab === t2.v && s.hp.length === 0, s);
// 4) under hold-for-å-omorganisere (window.__tabReorder) → ikke bytte
await p.evaluate(({ x, y }) => { window.__tabReorder = true; const btn = [...window.__c.shadowRoot.querySelector('.top>.tabs').children][3]; const o = { pointerId: 79, pointerType: 'touch', isPrimary: true, bubbles: true, composed: true, clientX: x, clientY: y }; btn.dispatchEvent(new PointerEvent('pointerdown', o)); btn.dispatchEvent(new PointerEvent('pointerup', o)); window.__tabReorder = false; }, t3);
await wait(p, 300);
s = await state();
ok('E ikke bytte under window.__tabReorder', s.tab === t2.v && s.hp.length === 0, s);
// 5) mus: ett klikk = ett bytte, én haptic (pekerens eget click ignoreres)
await reset();
T = await tabs();
await p.evaluate(() => { const c = window.__c; c.__acts = 0; const o = c.onAction.bind(c); c.onAction = (n, el, e) => { if (n === 'tab') c.__acts++; return o(n, el, e); }; });
await p.mouse.click(T[0].x, T[0].y);
await wait(p, 500);
s = await state();
const acts = await p.evaluate(() => window.__c.__acts);
ok('E mus-klikk: ett bytte og én haptic (ingen dobbel)', s.tab === T[0].v && s.hp.length === 1 && acts === 1, { s, acts });
// 6) trykk på aktiv fane → ingen haptic
await reset();
await p.mouse.click(T[0].x, T[0].y);
await wait(p, 300);
s = await state();
ok('E trykk på aktiv fane: ingen haptic', s.tab === T[0].v && s.hp.length === 0, s);
// 7) tastatur (Enter) bytter fortsatt (click som reserve)
await wait(p, 450);
await reset();
await p.evaluate(() => { [...window.__c.shadowRoot.querySelector('.top>.tabs').children][1].focus(); });
await p.keyboard.press('Enter');
await wait(p, 400);
s = await state();
ok('E tastatur (Enter → click) bytter fane', s.tab === T[1].v && s.hp.length === 1, s);
// 8) treff i sporets padding (under fanen) velger nærmeste fane
await reset();
T = await tabs();
const rowR = await p.evaluate(() => { const r = window.__c.shadowRoot.querySelector('.top>.tabs').getBoundingClientRect(); return { t: r.top, b: r.bottom }; });
await wait(p, 450);
await p.mouse.click(T[2].x, rowR.b - 1.5);
await wait(p, 400);
s = await state();
ok('E trykk i sporets padding (utenfor knappen) velger nærmeste fane', s.tab === T[2].v && s.hp.length === 1, { s, rowR, t: T[2] });
await p.close();

ok('Ingen sidefeil', !errs.length, errs.slice(0, 5));
await b.close();
try { unlinkSync(bundle); } catch (e) { /* */ }
console.log(fails ? `\n${fails} feilet` : '\nAlle bestod');
process.exit(fails ? 1 : 0);
