// Fiks 17.2 / 17.7 / 17.10 / 17.11 / 17.16 · Hjem-fliser og «Tilpass Hjem» → Kort.
//  · Dørlås: ett trykk låser opp direkte (ingen «trykk igjen»), flisen viser «Låser opp …».
//  · Kalender (sveip-kort): trykk = Navigate (pushState + location-changed), sveip utløser ikke trykk.
//  · Ruter: «Linje 17 om 3 min …» under tittelen, uten sensor «Velg stopp».
//  · Kamera: aktiv-tilstand fra egne utløsere (tonet, «Bevegelse nå»), stil Fylt/holdetid.
//  · Tilpass Hjem → Kort: fire soner med mini-kart, rader med bare ↑/↓ + chevron, editor med Plassering og «Fjern kortet».
import { createRequire } from 'node:module';
import { readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const bundle = resolve(`test/.build/hjemb1-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const shots = process.env.SHOTS || '';
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: 430, height: 1100 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto('file://' + resolve('test/harness.html'));
for (const m of readdirSync('test/mock').sort()) await p.addScriptTag({ path: resolve('test/mock/' + m) });
await p.addScriptTag({ path: bundle });
const res = {}, fail = [];
const ok = (name, cond, info) => { res[name] = cond ? 'OK' : ['FEIL', info]; if (!cond) fail.push(name); };

await p.evaluate(async () => {
  const S = window.mockHass().states, now = new Date();
  S['calendar.familie'].attributes.start_time = new Date(now.getTime() + 3600e3).toISOString().slice(0, 19).replace('T', ' ');
  S['calendar.familie'].attributes.end_time = new Date(now.getTime() + 7200e3).toISOString().slice(0, 19).replace('T', ' ');
  S['binary_sensor.inngang_person'] = { entity_id: 'binary_sensor.inngang_person', state: 'on', attributes: { device_class: 'occupancy', friendly_name: 'Inngang person' }, last_changed: new Date(Date.now() - 60e3).toISOString(), last_updated: new Date().toISOString() };
  window.__h = window.mockHass();
  window.__nav = [];
  // file:// tillater ikke pushState til /lovelace/… – registrer stien i stedet
  history.pushState = (st, t, url) => { window.__pushed = url; };
  window.addEventListener('location-changed', () => window.__nav.push(window.__pushed));
  const c = document.createElement('msh-hjem-faner-card');
  window.__cfg = { type: 'custom:msh-hjem-faner-card', card_id: 'ki-faner-test',
    tabs: { hjem: { auto_fill: false, cards: ['lock', 'cam', 'ruter', 'rom:stue', 'rom:kjokken'] } },
    tiles: { hjem: { cam: { stack: false }, ruter: { stack: false } } }, swipe: { hjem: { 'L-top': false } },
    slides: { hjem: { L: { cal: true } } },
    calendar: { tap_action: { action: 'navigate', navigation_path: '/lovelace/kalender' } },
    tile_cfg: { lock: { entity: 'lock.inngangsdor' }, cam: { active: { triggers: [{ entity: 'binary_sensor.inngang_person', op: '=', value: 'on' }] } } } };
  c.setConfig(window.__cfg); c.hass = window.__h;
  document.getElementById('dash').appendChild(c);
  window.__c = c;
  await new Promise((q) => setTimeout(q, 700));
});
const all = `(() => { const o = []; const w = (r) => r.querySelectorAll('*').forEach((e) => { o.push(e); if (e.shadowRoot) w(e.shadowRoot); }); w(document); return o; })()`;
const tile = (k) => p.evaluate((k) => { const el = window.__c.shadowRoot.querySelector(`.u.ht[data-k="${k}"]`); if (!el) return null; const r = el.getBoundingClientRect(); const n = el.querySelector('.u-n'), l = el.querySelector('.u-l'); return { x: r.left + r.width * 0.7, y: r.top + r.height / 2, ix: r.left + 30, title: l && l.textContent, sub: n && n.textContent, subHtml: n && n.innerHTML, bg: getComputedStyle(el).backgroundColor, sh: getComputedStyle(el).boxShadow, cls: el.className }; }, k);

/* 17.11 · Ruter */
const ru = await tile('ruter');
ok('17.11 ruter-flis finnes', !!ru, ru);
ok('17.11 undertekst «Linje N om N min»', ru && /^Linje \d+ (om \d+ min|nå)/.test(ru.sub || ''), ru && ru.sub);
ok('17.11 avvik rødt', ru && /avvik/.test(ru.sub) && /color:var\(--red/.test(ru.subHtml), ru && ru.subHtml);
ok('17.11 neste etter', ru && /deretter \d+ min/.test(ru.sub), ru && ru.sub);
const ruNo = await p.evaluate(async () => { const c = document.createElement('msh-hjem-faner-card'); c.hass = window.__h; c.setConfig({ ...window.__cfg, card_id: 'x2', tile_cfg: { ruter: { entity: 'sensor.finnes_ikke' } }, overrides: { ruter: 'sensor.finnes_ikke' } }); const m = c._tileModel('ruter', { ruter: 'sensor.finnes_ikke' }); return m && [m.title, m.sub]; });
ok('17.11 uten sensor: «Ruter / Velg stopp»', ruNo && ruNo[0] === 'Ruter' && ruNo[1] === 'Velg stopp', ruNo);

/* 17.16 · Kamera */
const cam = await tile('cam');
ok('17.16 kamera aktiv: «Bevegelse nå»', cam && cam.sub === 'Bevegelse nå', cam);
ok('17.16 tonet stil (kant + farget bakgrunn)', cam && cam.sh && cam.sh !== 'none' && !/rgba\(0, 0, 0, 0\)/.test(cam.bg), cam);
await p.evaluate(async () => {
  const h = window.mockHass(); h.states = { ...h.states, 'binary_sensor.inngang_person': { ...h.states['binary_sensor.inngang_person'], state: 'off', last_changed: new Date(Date.now() - 3 * 60e3).toISOString() } };
  window.__c.setConfig({ ...window.__cfg, tile_cfg: { lock: { entity: 'lock.inngangsdor' }, cam: { active: { triggers: [{ entity: 'binary_sensor.inngang_person' }], hold_min: 5, style: 'solid', pulse: true } } } });
  window.__c.hass = h; window.__c._camMem = {};
  await new Promise((q) => setTimeout(q, 300));
});
const cam2 = await tile('cam');
ok('17.16 holdetid: «Bevegelse for 3 min siden»', cam2 && cam2.sub === 'Bevegelse for 3 min siden', cam2 && cam2.sub);
ok('17.16 Fylt + puls', cam2 && /hpulse/.test(cam2.cls), cam2 && cam2.cls);
await p.evaluate(async () => {
  window.__c.setConfig({ ...window.__cfg, tile_cfg: { lock: { entity: 'lock.inngangsdor' }, cam: { active: { triggers: [{ entity: 'binary_sensor.inngang_person' }], hold_min: 1 } } } });
  await new Promise((q) => setTimeout(q, 300));
});
const cam3 = await tile('cam');
ok('17.16 etter holdetid: ikke aktiv', cam3 && cam3.sub !== 'Bevegelse nå' && !/siden/.test(cam3.sub), cam3 && cam3.sub);
await p.evaluate(async () => { window.__c.setConfig(window.__cfg); window.__c.hass = window.__h; await new Promise((q) => setTimeout(q, 300)); });

/* 17.2 · Dørlås */
const lk = await tile('lock');
await p.evaluate(() => { window.__calls.length = 0; });
await p.mouse.click(lk.ix, lk.y);
await p.waitForTimeout(250);
const lk2 = await tile('lock');
const calls = await p.evaluate(() => window.__calls.filter((c) => c[0] === 'lock'));
ok('17.2 ett trykk låser opp', calls.length === 1 && calls[0][1] === 'unlock', calls);
ok('17.2 flisen viser «Låser opp …»', lk2 && lk2.title === 'Låser opp …', lk2 && lk2.title);
ok('17.2 ingen «trykk igjen»', lk2 && !/igjen/i.test(lk2.sub || ''), lk2 && lk2.sub);

/* 17.7 · Kalender */
const cal = await p.evaluate(() => { const el = window.__c.shadowRoot.querySelector('.sl[data-s="cal"]'); if (!el) return null; const car = el.closest('.car'); const i = Number(car.dataset.n) - 1; return { i, key: car.dataset.sw, hasEnt: el.hasAttribute('data-ent') }; });
ok('17.7 kalender-kort finnes', !!cal, cal);
ok('17.7 hold standard = ingen (ingen data-ent)', cal && !cal.hasEnt, cal);
// gå til kalendersiden (sveip), sveip skal ikke navigere
const carBox = await p.evaluate(() => { const el = window.__c.shadowRoot.querySelector('.car'); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width }; });
for (let i = 0; i < (cal ? cal.i : 0); i++) {
  await p.mouse.move(carBox.x + 60, carBox.y); await p.mouse.down(); await p.mouse.move(carBox.x - 20, carBox.y, { steps: 6 }); await p.mouse.move(carBox.x - 80, carBox.y, { steps: 6 }); await p.mouse.up();
  await p.waitForTimeout(450);
}
const navAfterSwipe = await p.evaluate(() => window.__nav.slice());
ok('17.7 sveip utløser ikke trykk', navAfterSwipe.length === 0, navAfterSwipe);
const calVis = await p.evaluate(() => { const el = window.__c.shadowRoot.querySelector('.sl[data-s="cal"]'); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
await p.mouse.click(calVis.x, calVis.y);
await p.waitForTimeout(250);
const nav = await p.evaluate(() => ({ nav: window.__nav.slice(), path: location.pathname }));
ok('17.7 trykk = Navigate /lovelace/kalender', nav.nav.includes('/lovelace/kalender'), nav);

/* 17.10 · Tilpass Hjem → Kort */
await p.evaluate(async () => { window.MSH.openHomeEditor(); await new Promise((q) => setTimeout(q, 500)); });
const edRoot = `(${all}.find((e) => e.dataset && e.dataset.key === 'ed') || {}).getRootNode()`;
const clickA = async (sel) => { const r = await p.evaluate(`(() => { const R = ${edRoot}; const el = R.querySelector(${JSON.stringify(sel)}); if (!el) return null; el.scrollIntoView({ block: 'center' }); const b = el.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; })()`); if (r) { await p.mouse.click(r.x, r.y); await p.waitForTimeout(300); } return !!r; };
await clickA('[data-a="acc"][data-v="snar"]');
const zones = await p.evaluate(`(() => { const R = ${edRoot}; return [...R.querySelectorAll('.zn')].map((z) => ({ t: z.querySelector('.zt b').textContent, n: z.querySelector('.zt i').textContent, map: !!z.querySelector('.zm i.on'), sw: !!z.querySelector('.zsw'), add: !!z.querySelector('.zad'), rows: [...z.querySelectorAll('.zr')].map((r) => [...r.querySelectorAll('button')].map((x) => x.dataset.a)) })); })()`);
ok('17.10 fire soner', zones.length === 4 && zones[0].t.startsWith('Venstre · over') && zones[3].t.startsWith('Høyre · under'), zones);
ok('17.10 mini-kart og +', zones.every((z) => z.map && z.add), zones);
ok('17.10 rader: bare ↑/↓ + chevron', zones.every((z) => z.rows.every((r) => r.every((a) => ['tedit', 'tmove'].includes(a)))), zones);
ok('17.10 tom sone viser «Tom»', zones.some((z) => z.n === 'Tom'), zones.map((z) => z.n));
// åpne editoren for kamera
await clickA('.zr[data-key="zr-cam"] .zch');
const ed = await p.evaluate(`(() => { const R = ${edRoot}; const t = R.querySelector('[data-key="ted-cam"]'); if (!t) return null; return { pl: t.querySelectorAll('.zpg button').length, on: (t.querySelector('.zpg button.on') || {}).dataset, del: !!t.querySelector('.zdel'), akt: !!t.querySelector('[data-key$="-cam-cam"]') }; })()`);
ok('17.10 editor: Plassering (4) + «Fjern kortet»', ed && ed.pl === 4 && ed.del, ed);
ok('17.16 editor: «Aktiv-tilstand»', ed && ed.akt, ed);
if (shots) await p.screenshot({ path: shots + '/b1-zones.png', fullPage: true });
// flytt kameraet til Venstre · over
await clickA('[data-key="ted-cam"] .zpg button[data-v="L-top"]');
await p.waitForTimeout(700);
const slot = await p.evaluate(() => { const S = window.MSH.store, c = window.MSH.liveOf('msh-hjem-faner-card'); return c && c.config && c.config.tiles && c.config.tiles.hjem && c.config.tiles.hjem.cam && c.config.tiles.hjem.cam.slot; });
ok('17.10 Plassering flytter kortet', slot === 'L-top', slot);
// + i en tom sone → rutenett, velg Alarm → havner i sonen
const empty = zones.find((z) => z.n === 'Tom');
if (empty) {
  const sl = { 'Venstre · over rommene': 'L-top', 'Høyre · over rommene': 'R-top', 'Venstre · under rommene': 'L-bottom', 'Høyre · under rommene': 'R-bottom' }[empty.t];
  await clickA(`.zad[data-v="${sl}"]`);
  const grid = await p.evaluate(`(() => { const R = ${edRoot}; return [...R.querySelectorAll('.zgr button')].map((b) => b.textContent.trim()); })()`);
  ok('17.10 + viser typer', grid.length === 13 && grid[0] === 'Snarvei', grid);
  await clickA(`.zgr button[data-v="garage"]`);
  await p.waitForTimeout(700);
  const g = await p.evaluate(() => { const c = window.MSH.liveOf('msh-hjem-faner-card').config; return { slot: c.tiles && c.tiles.hjem && Object.keys(c.tiles.hjem).filter((k) => /^garage/.test(k)).map((k) => c.tiles.hjem[k].slot) }; });
  ok('17.10 nytt kort havner i sonen', g.slot && g.slot.includes(sl), { g, sl });
}
if (shots) await p.screenshot({ path: shots + '/b1-zones2.png', fullPage: true });
// 17.11 · layout-forhåndsvisningen har undertekst
const tsub = await p.evaluate(`(() => { const R = ${edRoot}; return [...R.querySelectorAll('.it .tsub')].map((x) => x.textContent); })()`);
ok('17.11 layout-forhåndsvisning viser undertekst', tsub.some((x) => /Linje/.test(x)), tsub);
// 17.7 · kalender-rad i Swipe-kort
await clickA('[data-a="acc"][data-v="swipe"]');
await clickA('[data-key="calrow"] .zch');
const calEd = await p.evaluate(`(() => { const R = ${edRoot}; const t = R.querySelector('[data-key="cal-ed"]'); return t ? { taps: t.querySelectorAll('msh-tap-picker').length, cals: t.querySelectorAll('[data-a="calent"]').length } : null; })()`);
ok('17.7 kalender-rad → editor (Trykk + Hold + kalendere)', calEd && calEd.taps === 2 && calEd.cals >= 1, calEd);

ok('ingen JS-feil', !errs.length, errs);
await b.close();
console.log(JSON.stringify(res, null, 1));
console.log(fail.length ? 'FEIL – ' + fail.join(', ') : 'OK – alle sjekker');
process.exit(fail.length ? 1 : 0);
