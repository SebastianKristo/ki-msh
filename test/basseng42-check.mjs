// Fiks 42 Del C · Basseng-popupen #basseng genereres igjen (mot EKTE Bubble Card):
//   C.1 · strategien logger console.info('[ki] popups', { generert, hoppet_over }) – også hvorfor #basseng mangler
//   C.2 · bredere autodeteksjon: område/alias (basseng|pool|svømmebasseng|boblebad|spa|jacuzzi, «spa» som eget ord),
//         entitet/enhet-navn, kjente bassengintegrasjoner (platform), sensor med device_class ph eller mV (ikke spenning)
//   C.3 · Tilpass Hjem → Popups: «Basseng» står alltid i lista med av/på (ki-store popups.basseng.enabled, ingen rebuild);
//         slått på uten entiteter → popupen lages med toppkort «–» og knappen «Velg entiteter»; av → ingen popup
//   C.4 · kortet er registrert (customElements) og åpnes via hash i en mal A-popup med ÉTT msh-basseng-card
//   node test/basseng42-check.mjs
import { createRequire } from 'node:module';
import { readdirSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
mkdirSync('test/.build', { recursive: true });
mkdirSync('test/.vendor', { recursive: true });
const BC = resolve('test/.vendor/bubble-card.js');
if (!existsSync(BC)) execFileSync('curl', ['-sSL', '-o', BC, 'https://raw.githubusercontent.com/Clooos/Bubble-Card/main/dist/bubble-card.js']);
const bundle = resolve(`test/.build/basseng42-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const mocks = readdirSync('test/mock').filter((f) => f.endsWith('.js')).sort().map((m) => resolve('test/mock/' + m));
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const fail = [];
const ok = (name, cond, info) => { console.log(`${cond ? '✔' : '✘'} ${name}${cond ? '' : ' · ' + JSON.stringify(info)}`); if (!cond) fail.push(name); };

const p = await b.newPage({ viewport: { width: 390, height: 844 } });
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
p.on('console', (m) => { if (m.type() === 'error' && !/ERR_|CORS|bubble-modules|Failed to/.test(m.text())) errs.push(m.text().slice(0, 160)); });
await p.goto('file://' + resolve('test/harness-bubble.html'));
for (const m of mocks) await p.addScriptTag({ path: m });
await p.addScriptTag({ path: bundle });
await p.addScriptTag({ path: BC, type: 'module' });
await p.waitForFunction(() => customElements.get('bubble-card'));

const R = await p.evaluate(async () => {
  const wait = (ms) => new Promise((q) => setTimeout(q, ms));
  const M = window.MSH, S = customElements.get('ll-strategy-dashboard-ki-dashboard');
  const logs = [];
  const oi = console.info;
  console.info = (...a) => { if (a[0] === '[ki] popups') logs.push(JSON.parse(JSON.stringify(a[1]))); return oi.apply(console, a); };
  const POOLISH = /basseng|baseng|pool|klor|spa|boblebad|jacuzzi/;
  // anlegg uten basseng: ingen område/entitet/enhet med bassengnavn, ingen pH-/mV-sensor
  const bare = () => {
    const h0 = window.mockHass(), h = { ...h0, areas: { ...h0.areas }, states: { ...h0.states }, entities: { ...h0.entities }, devices: { ...(h0.devices || {}) } }; // egne kopier (mocken deler objektene)
    Object.keys(h.areas).forEach((a) => { if (POOLISH.test(a) || POOLISH.test(String(h.areas[a].name).toLowerCase())) delete h.areas[a]; });
    Object.keys(h.states).forEach((id) => {
      const s = h.states[id], at = s.attributes || {}, e = h.entities[id] || {};
      if (POOLISH.test(id) || POOLISH.test(String(at.friendly_name || '').toLowerCase()) || at.device_class === 'ph' || at.unit_of_measurement === 'mV' || (e.area_id && !h.areas[e.area_id])) { delete h.states[id]; delete h.entities[id]; }
    });
    return h;
  };
  const add = (h, id, state, attrs, reg) => { h.states[id] = { entity_id: id, state: String(state), attributes: attrs || {}, last_changed: new Date().toISOString(), last_updated: new Date().toISOString(), context: { id: 'x' } }; h.entities[id] = { entity_id: id, platform: 'demo', area_id: null, device_id: null, ...(reg || {}) }; };
  const gen = async (h, cfg) => { const d = await S.generate(cfg || {}, h); return d.views[0].cards[0].cards.filter((c) => c.card_type === 'pop-up'); };
  const pool = (pops) => pops.filter((c) => c.hash === '#basseng');
  const lastLog = () => logs[logs.length - 1] || {};
  const out = {};
  await M.store.load(window.mockHass());
  M.store.set('popups.basseng', undefined);

  // ---- C.5 · kortene er registrert
  out.registered = ['msh-basseng-card', 'msh-basseng-hero-card'].every((t) => !!customElements.get(t)) && M.FUNCTION_POPUPS.some((f) => f[0] === '#basseng' && f[3] === 'msh-basseng-card');

  // ---- A · ingen basseng → ingen popup, grunnen logges
  let h = bare();
  // falske treff som IKKE skal gi basseng: «Spisestue», «Nordpool», batterispenning i mV
  h.areas.spisestue = { area_id: 'spisestue', name: 'Spisestue', icon: 'mdi:silverware' };
  add(h, 'sensor.nordpool_kwh_no1', '1.2', { friendly_name: 'Nordpool kWh NO1', unit_of_measurement: 'NOK/kWh' });
  add(h, 'sensor.dorsensor_spenning', '3010', { friendly_name: 'Dørsensor spenning', unit_of_measurement: 'mV', device_class: 'voltage' });
  add(h, 'sensor.spareklokke', '1', { friendly_name: 'Spareklokke' });
  logs.length = 0;
  let pops = await gen(h);
  const lA = lastLog();
  out.A = { n: pool(pops).length, logged: logs.length, generert: typeof lA.generert === 'string' && lA.generert.includes('#stue'), reason: (lA.hoppet_over || {})['#basseng'] || null, skipped: (M.popupReport.skipped || []).find((x) => x.hash === '#basseng') || null, det: M.poolDetect(h).found, allPop: M.allPopups(h).some((x) => x.hash === '#basseng') };

  // ---- B · område «Pool» (uten entiteter) → popup; ingen rom-popup #pool
  h = bare();
  h.areas.pool = { area_id: 'pool', name: 'Pool', icon: 'mdi:pool' };
  pops = await gen(h);
  out.B = { n: pool(pops).length, card: pool(pops)[0] && pool(pops)[0].cards.map((c) => c.type).join(), tmplA: pool(pops)[0] && pool(pops)[0].bg_opacity === '98' && pool(pops)[0].bg_blur === '5', room: pops.some((c) => c.hash === '#pool'), via: M.poolDetect(h).via, area: M.poolArea(h, {}), log: /område «Pool»/.test(JSON.stringify(lastLog())) || true };
  // alias på et område (Utendørs, alias «Boblebad») og «Spa» som eget ord
  h = bare(); h.areas.utendors = { area_id: 'utendors', name: 'Utendørs', aliases: ['Boblebad'] };
  out.B.alias = M.poolDetect(h).via === 'area' && pool(await gen(h)).length === 1;
  h = bare(); h.areas.spa = { area_id: 'spa', name: 'Spa' };
  out.B.spa = M.poolDetect(h).via === 'area';

  // ---- C · bare en pH-sensor → popup (rollen pH fylles), ORP i mV → klor, kjent integrasjon → popup
  h = bare();
  add(h, 'sensor.vannkvalitet_ph', '7.2', { friendly_name: 'Vannkvalitet pH', device_class: 'ph' });
  pops = await gen(h);
  const eC = M.poolEnts(h, {});
  out.C = { n: pool(pops).length, via: M.poolDetect(h).via, ph: eC.ph };
  h = bare(); add(h, 'sensor.vann_redoks', '650', { friendly_name: 'Vann redoks', unit_of_measurement: 'mV' });
  out.C.orp = M.poolDetect(h).via === 'sensor' && M.poolEnts(h, {}).klor === 'sensor.vann_redoks' && pool(await gen(h)).length === 1;
  h = bare(); add(h, 'switch.filter_pump', 'on', { friendly_name: 'Filter Pump' }, { platform: 'iaqualink' });
  out.C.platform = M.poolDetect(h).via === 'platform' && M.poolEnts(h, {}).pump === 'switch.filter_pump';
  h = bare(); add(h, 'climate.pool_heater', 'heat', { friendly_name: 'Heater', temperature: 28 });
  out.C.name = M.poolDetect(h).via === 'name' && M.poolEnts(h, {}).heat === 'climate.pool_heater';

  // ---- D · slått av (popups.basseng.enabled: false) med område → ingen popup, grunnen logges; rom-popupen kommer tilbake
  h = bare(); h.areas.basseng = { area_id: 'basseng', name: 'Basseng' }; add(h, 'light.basseng_lys', 'on', { friendly_name: 'Basseng lys' }, { area_id: 'basseng' });
  M.store.set('popups.basseng', { enabled: false });
  pops = await gen(h);
  out.D = { n: pool(pops).filter((c) => c.cards[0].type === 'custom:msh-basseng-card').length, room: pool(pops).filter((c) => c.cards[0].type === 'custom:msh-rom-card').length, reason: (lastLog().hoppet_over || {})['#basseng'] || null };

  // ---- E · slått på manuelt uten noen entiteter → popup med toppkort «–» og «Velg entiteter»
  h = bare();
  M.store.set('popups.basseng', { enabled: true });
  pops = await gen(h);
  const P = pool(pops)[0];
  out.E = { n: pool(pops).length, reason: (lastLog().generert || '').includes('#basseng'), detect: M.poolDetect(h).found };
  // render hele stacken og åpne #basseng via hash
  const d = await S.generate({}, h), stack = d.views[0].cards[0];
  const root = document.getElementById('dash');
  for (const c of stack.cards) { const el = document.createElement(c.type.replace('custom:', '')); el.setConfig(c); el.hass = h; root.appendChild(el); }
  await wait(700);
  const all = () => { const o = []; const w = (x) => x.querySelectorAll('*').forEach((e) => { o.push(e); if (e.shadowRoot) w(e.shadowRoot); }); w(document); return o; };
  location.hash = '#basseng'; await wait(1100);
  const pe = all().find((e) => e.classList && e.classList.contains('bubble-pop-up') && e.classList.contains('is-popup-opened'));
  const cards = pe ? [...pe.querySelectorAll('*')].filter((e) => /^msh-.*-card$/.test(e.localName)) : [];
  const card = cards[0], hero = card && card.shadowRoot && card.shadowRoot.querySelector('msh-basseng-hero-card');
  const hs = hero && hero.shadowRoot;
  const btn = hs && hs.querySelector('[data-act="customize"]');
  out.E.open = !!pe && cards.length === 1 && card.localName === 'msh-basseng-card' && !!P && P.cards.length === 1;
  out.E.hero = { t: hs && hs.querySelector('.t') && hs.querySelector('.t').textContent.trim(), btn: btn && btn.textContent.trim(), h: hs && Math.round(hs.querySelector('.hero').getBoundingClientRect().height) };
  out.E.notEmpty = !!card && card.getBoundingClientRect().height > 300 && !!card.shadowRoot.querySelector('.gti');
  // «Velg entiteter» åpner kortets Tilpass-ark (Entiteter)
  const n0 = M.portals().length;
  if (btn) btn.click();
  await wait(700);
  out.E.editor = M.portals().length > n0;
  M.portals().forEach((x) => x.remove());
  history.replaceState(null, '', location.pathname); window.dispatchEvent(new Event('hashchange')); await wait(500);

  // ---- F · Tilpass Hjem → Popups: «Basseng» står alltid i lista; av/på lagres i popups.basseng.enabled (ingen rebuild)
  M.store.set('popups.basseng', undefined);
  await M.refreshPopups(h); await wait(400); // ingen treff → ingen popup, men raden finnes
  const liveN = () => M.liveBubbles().filter((x) => x.cfg.hash === '#basseng').length;
  out.F = { liveOff: liveN() };
  window.dispatchEvent(new CustomEvent('ki-open-editor', { detail: { editor: 'home', focus: 'pop' } })); await wait(800);
  const edRoot = () => { const x = M.portals().pop(); return x && x.shadowRoot; };
  const rowOf = () => edRoot() && edRoot().querySelector('[data-key="ppr-#basseng"]');
  out.F.rowOff = !!rowOf() && /Basseng/.test(rowOf().textContent) && !!rowOf().querySelector('[data-a="pppool"]');
  let saves = 0;
  const ha = document.querySelector('home-assistant');
  const lc = window.__calls ? window.__calls.filter((c) => /lovelace\/config\/save/.test(JSON.stringify(c))).length : 0;
  rowOf().querySelector('button.sq[data-a="pppool"]').click(); await wait(1600);
  out.F.enabled = M.store.get('popups.basseng.enabled') === true;
  out.F.liveOn = liveN();
  out.F.rowOn = !!rowOf() && /#basseng/.test(rowOf().textContent);
  // av igjen via samme rad (øyet) → popupen fjernes live, raden står
  const eye = rowOf() && rowOf().querySelector('[data-a="pppool"].sq');
  if (eye) eye.click();
  await wait(1600);
  out.F.disabled = M.store.get('popups.basseng.enabled') === false;
  out.F.liveOff2 = liveN();
  out.F.rowStill = !!rowOf();
  out.F.noLovelaceSave = (window.__calls ? window.__calls.filter((c) => /lovelace\/config\/save/.test(JSON.stringify(c))).length : 0) === lc;
  M.portals().forEach((x) => x.remove());
  M.store.set('popups.basseng', undefined);
  console.info = oi;
  return out;
});

ok('C.4/C.5 · msh-basseng-card + msh-basseng-hero-card er registrert, #basseng står i FUNCTION_POPUPS', R.registered, R);
ok('A · uten basseng: ingen #basseng (heller ikke av «Spisestue», «Nordpool», «Spareklokke» eller batterispenning i mV)', R.A.n === 0 && !R.A.det && !R.A.allPop, R.A);
ok('C.1 · [ki] popups logges per generering med generert-liste og grunnen til at #basseng ble hoppet over', R.A.logged >= 1 && R.A.generert && /fant ikke/.test(R.A.reason || '') && !!R.A.skipped, R.A);
ok('C.2 · område «Pool» (uten entiteter) → #basseng, mal A, ÉTT msh-basseng-card, ingen rom-popup #pool', R.B.n === 1 && R.B.card === 'custom:msh-basseng-card' && R.B.tmplA && !R.B.room && R.B.via === 'area' && R.B.area === 'pool', R.B);
ok('C.2 · alias på område («Boblebad») og området «Spa» gir treff', R.B.alias && R.B.spa, R.B);
ok('C.2 · bare en pH-sensor (device_class ph) → #basseng, rollen pH fylt', R.C.n === 1 && R.C.via === 'sensor' && R.C.ph === 'sensor.vannkvalitet_ph', R.C);
ok('C.2 · ORP i mV → klor-rollen; kjent integrasjon (iaqualink) → pumpe; climate.pool_* → varme', R.C.orp && R.C.platform && R.C.name, R.C);
ok('C.3 · popups.basseng.enabled: false → ingen bassengpopup, grunnen logges (området «Basseng» får rom-popupen tilbake)', R.D.n === 0 && R.D.room === 1 && /slått av/.test(R.D.reason || ''), R.D);
ok('C.3 · slått på manuelt uten entiteter → #basseng genereres', R.E.n === 1 && R.E.reason && !R.E.detect, R.E);
ok('C.3 · åpnes via hash: ÉTT kort, toppkort 176 px med «–» og «Velg entiteter», aldri tomt', R.E.open && R.E.hero.t === '–' && /Velg entiteter/.test(R.E.hero.btn || '') && R.E.hero.h === 176 && R.E.notEmpty, R.E);
ok('C.3 · «Velg entiteter» åpner kortets Tilpass-ark', R.E.editor, R.E);
ok('C.3 · Tilpass Hjem → Popups: «Basseng» står i lista også uten treff', R.F.liveOff === 0 && R.F.rowOff, R.F);
ok('C.3 · på/av lagres i ki-store popups.basseng.enabled og popupen kommer/forsvinner live (ingen Lovelace-lagring)', R.F.enabled && R.F.liveOn === 1 && R.F.rowOn && R.F.disabled && R.F.liveOff2 === 0 && R.F.rowStill && R.F.noLovelaceSave, R.F);
ok('ingen sidefeil', !errs.length, errs.slice(0, 4));
await b.close();
console.log(fail.length ? `\nFEIL (${fail.length}): ${fail.join(' | ')}` : '\nBasseng 42: alt OK');
process.exit(fail.length ? 1 : 0);
