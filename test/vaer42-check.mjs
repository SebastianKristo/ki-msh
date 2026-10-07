// Fiks 42 · Del B · Vær: alle weather.*-entiteter blir steder automatisk (ingen config, ingen hardkodede ID-er).
//   node test/vaer42-check.mjs
// Injiserer weather-entiteter: timesduplikat (_hourly/_timer), samme config entry + lokasjon, «Forecast »-prefiks,
// områdebundet, utilgjengelig, fjernet (exclude), sortert (order), lagt til/omdøpt (places), og en ny entitet som dukker
// opp via simulert entity_registry_updated mens popupen er åpen. Sjekker også migrering av gamle places [{ name, entity }]
// og begge editorene («Tilpass Vær» + getConfigElement).
import { createRequire } from 'node:module';
import { readdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const bundle = resolve(`test/.build/vaer42-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const res = {}, fail = [];
const ok = (name, cond, info) => { res[name] = cond ? 'OK' : ['FEIL', info]; if (!cond) fail.push(name); };
const mocks = readdirSync('test/mock').sort().map((m) => resolve('test/mock/' + m));
const errs = [];
const p = await b.newPage({ viewport: { width: 390, height: 900 }, hasTouch: true });
p.on('pageerror', (e) => errs.push(e.message));
await p.goto('file://' + resolve('test/harness.html'));
for (const m of mocks) await p.addScriptTag({ path: m });
await p.addScriptTag({ path: bundle });

// Oppsett: hass med ekstra weather.* + fanget subscribeEvents, popup #vaer åpen, kort uten config
await p.evaluate(async () => {
  const w = (ms) => new Promise((q) => setTimeout(q, ms));
  const h = window.mockHass();
  const wx = (id, state, a, reg) => {
    h.states[id] = { entity_id: id, state, attributes: { temperature: 10, humidity: 70, wind_speed: 3, wind_bearing: 90, pressure: 1010, temperature_unit: '°C', wind_speed_unit: 'm/s', supported_features: 3, ...a }, last_changed: new Date().toISOString(), last_updated: new Date().toISOString(), context: {} };
    h.entities[id] = { entity_id: id, platform: 'met', area_id: null, device_id: null, hidden: false, entity_category: null, icon: null, name: null, ...(reg || {}) };
  };
  window.__wx = wx;
  wx('weather.home_hourly', 'sunny', { friendly_name: 'Hjem timebasert' });
  wx('weather.fjellet', 'cloudy', { friendly_name: 'Fjellet' });
  wx('weather.fjellet_timer', 'cloudy', { friendly_name: 'Fjellet timer' });
  wx('weather.yr_a', 'rainy', { friendly_name: 'Yr Bergen', latitude: 60.39, longitude: 5.32 }, { platform: 'yr', config_entry_id: 'ce_yr' });
  wx('weather.yr_b', 'rainy', { friendly_name: 'Yr Bergen 2', latitude: 60.39, longitude: 5.32 }, { platform: 'yr', config_entry_id: 'ce_yr' });
  wx('weather.forecast_strandhytta', 'sunny', { friendly_name: 'Forecast Strandhytta' });
  h.areas = { ...h.areas, sjohuset: { area_id: 'sjohuset', name: 'Sjøhuset', icon: null, floor_id: null, picture: null } };
  wx('weather.knmi', 'fog', { friendly_name: 'KNMI' }, { area_id: 'sjohuset' });
  wx('weather.nede', 'unavailable', { friendly_name: 'Nede' });
  window.__reg = { subs: 0, unsubs: 0, type: null, cb: null };
  h.connection.subscribeEvents = (cb, type) => { window.__reg.subs++; window.__reg.type = type; window.__reg.cb = cb; return Promise.resolve(() => { window.__reg.unsubs++; }); };
  window.__h = h;
  document.getElementById('dash').innerHTML = '';
  const bc = document.createElement('bubble-card');
  bc.setConfig({ type: 'custom:bubble-card', card_type: 'pop-up', hash: '#vaer' });
  bc.innerHTML = '<div class="pop bubble-pop-up is-popup-opened" style="overflow:hidden;display:flex;flex-direction:column"><div class="hdr bubble-header-container">Vær</div><div class="inner bubble-pop-up-container" style="overflow:auto;flex:1;min-height:0"></div></div>';
  document.getElementById('dash').appendChild(bc);
  location.hash = '#vaer';
  try { localStorage.clear(); } catch (e) { /* */ }
  const c = document.createElement('msh-vaer-card');
  c.setConfig({ type: 'custom:msh-vaer-card', card_id: 'pop-vaer42' });
  c.hass = h;
  bc.querySelector('.inner').appendChild(c);
  window.__c = c; window.__pop = bc.querySelector('.bubble-pop-up');
  // felles hjelpere
  window.__menu = async () => {
    const ctl = window.__c.shadowRoot.querySelector('.ctl-slot > .msh-vaer-ctl').shadowRoot;
    if (!ctl.querySelector('.mn')) { ctl.querySelector('.pl').click(); await w(60); }
    const items = [...ctl.querySelectorAll('.mi')].map((e) => ({ n: e.querySelector('.mnm').textContent.trim(), id: e.querySelector('.mid').textContent.trim(), on: e.classList.contains('on') }));
    const close = ctl.querySelector('[data-a="close"]'); if (close) close.click();
    await w(30);
    return items;
  };
  window.__newHass = (patch) => { const h0 = window.__c.hass, h2 = { ...h0, states: { ...h0.states, ...patch } }; window.__c.hass = h2; return h2; };
  await w(700);
});

/* 1 · uten config: alle weather.* (dedupet, uten utilgjengelige), navn, standardsted */
const A = await p.evaluate(async () => {
  const c = window.__c, m = await window.__menu();
  return { names: m.map((x) => x.n), ids: m.map((x) => x.id), on: (m.find((x) => x.on) || {}).n, ent: window.MSH.vaerAuto(c.hass, c.config).weather, raw: Object.keys(c._rawConfig).sort().join(), reg: { ...window.__reg, cb: !!window.__reg.cb } };
});
ok('42 uten config: alle weather.* som steder (Hjem først, resten etter navn)', A.names.join('|') === 'Hjem|Fjellet|Hytta|Jobb Oslo|Sjøhuset|Strandhytta|Yr Bergen' && A.raw === 'card_id,type', A);
ok('42 duplikater hoppes over: *_hourly, *_timer og samme config entry + lat/lon (én beholdes)', !A.ids.includes('weather.home_hourly') && !A.ids.includes('weather.fjellet_timer') && A.ids.filter((x) => /^weather\.yr_/.test(x)).length === 1, A.ids);
ok('42 navn: «Forecast »-prefiks fjernes, områdenavn for områdebundet entitet', A.names.includes('Strandhytta') && A.names.includes('Sjøhuset') && !A.names.some((x) => /^Forecast|KNMI/.test(x)), A.names);
ok('42 utilgjengelig (unavailable) vises ikke', !A.ids.includes('weather.nede'), A.ids);
ok('42 standardsted = weather.home (første fane, valgt uten ui-valg)', A.on === 'Hjem' && A.ent === 'weather.home', A);
ok('42 lytter på entity_registry_updated mens popupen er åpen', A.reg.subs === 1 && A.reg.type === 'entity_registry_updated' && A.reg.cb, A.reg);

/* 2 · utilgjengelig → tilgjengelig kommer tilbake av seg selv */
const B = await p.evaluate(async () => {
  const w = (ms) => new Promise((q) => setTimeout(q, ms));
  const h0 = window.__c.hass;
  window.__newHass({ 'weather.nede': { ...h0.states['weather.nede'], state: 'cloudy' } }); await w(150);
  const back = (await window.__menu()).map((x) => x.n);
  const h1 = window.__c.hass;
  window.__newHass({ 'weather.nede': { ...h1.states['weather.nede'], state: 'unavailable' } }); await w(150);
  const gone = (await window.__menu()).map((x) => x.n);
  return { back, gone };
});
ok('42 utilgjengelig sted kommer tilbake automatisk (og forsvinner igjen)', B.back.includes('Nede') && !B.gone.includes('Nede'), B);

/* 3 · ny weather.* via entity_registry_updated (samme hass-objekt – bare hendelsen sier fra) */
const C = await p.evaluate(async () => {
  const w = (ms) => new Promise((q) => setTimeout(q, ms));
  const h = window.__c.hass;
  h.states['weather.ny_by'] = { entity_id: 'weather.ny_by', state: 'sunny', attributes: { temperature: 20, friendly_name: 'Ny by', supported_features: 3 }, last_changed: '', last_updated: '', context: {} };
  h.entities['weather.ny_by'] = { entity_id: 'weather.ny_by', platform: 'met', area_id: null, device_id: null, hidden: false, entity_category: null };
  const before = window.MSH.vaerPlaces(h, window.__c._rawConfig).length;
  const ctl = window.__c.shadowRoot.querySelector('.ctl-slot > .msh-vaer-ctl').shadowRoot;
  ctl.querySelector('.pl').click(); await w(40); // menyen åpen mens hendelsen kommer
  window.__reg.cb({ event_type: 'entity_registry_updated', data: { action: 'create', entity_id: 'weather.ny_by' } });
  await w(120);
  const live = [...ctl.querySelectorAll('.mi .mnm')].map((e) => e.textContent.trim());
  ctl.querySelector('[data-a="close"]').click(); await w(30);
  return { before, live };
});
ok('42 ny weather.* dukker opp mens popupen er åpen (entity_registry_updated)', C.live.includes('Ny by') && C.live.length === C.before, C);

/* 4 · exclude + order: fjernet kommer ikke tilbake, rekkefølge bevares, nye auto-steder sist, standardsted */
const D = await p.evaluate(async () => {
  const w = (ms) => new Promise((q) => setTimeout(q, ms));
  const c = window.__c;
  c.setUI({ place: undefined });
  c.setConfig({ ...c._rawConfig, exclude: ['weather.oslo_sentrum', 'sensor.pollen_or_oslo_today'], order: ['weather.hytta', 'weather.knmi'] }); await w(150);
  const m1 = await window.__menu();
  window.__newHass({}); await w(150); // ny hass (oppdatering) → fortsatt ikke lagt til igjen
  const m2 = await window.__menu();
  const pollen = window.MSH.vaerAuto(c.hass, c.config).pollen;
  // full order (slik editorene lagrer den etter dra) → en ny weather.* (via entity_registry_updated) havner sist
  const full = window.MSH.vaerPlaces(c.hass, c._rawConfig).map((x) => x.id).reverse();
  c.setConfig({ ...c._rawConfig, order: full }); await w(120);
  const h = c.hass;
  h.states['weather.nyeste'] = { entity_id: 'weather.nyeste', state: 'cloudy', attributes: { temperature: 5, friendly_name: 'Aaa nyeste', supported_features: 3 }, last_changed: '', last_updated: '', context: {} };
  h.entities['weather.nyeste'] = { entity_id: 'weather.nyeste', platform: 'met', area_id: null, device_id: null, hidden: false, entity_category: null };
  window.__reg.cb({ event_type: 'entity_registry_updated', data: { action: 'create', entity_id: 'weather.nyeste' } }); await w(120);
  const m3 = await window.__menu();
  delete h.states['weather.nyeste']; delete h.entities['weather.nyeste'];
  window.__reg.cb({ event_type: 'entity_registry_updated', data: { action: 'remove', entity_id: 'weather.nyeste' } }); await w(60);
  c.setConfig({ ...c._rawConfig, order: ['weather.hytta', 'weather.knmi'] }); await w(120);
  return { n1: m1.map((x) => x.n), n2: m2.map((x) => x.n), n3: m3.map((x) => x.n), full, on: (m1.find((x) => x.on) || {}).n, ent: window.MSH.vaerAuto(c.hass, c.config).weather, pollenOk: !pollen.includes('sensor.pollen_or_oslo_today') && pollen.length > 0 };
});
ok('42 exclude: fjernet sted vises ikke og legges ikke til igjen ved oppdatering', !D.n1.includes('Jobb Oslo') && !D.n2.includes('Jobb Oslo'), D);
ok('42 order: rekkefølgen bevares, resten etter; nytt auto-sted legges sist', D.n1.slice(0, 3).join('|') === 'Hytta|Sjøhuset|Hjem' && D.n2.join('|') === D.n1.join('|') && D.n3[D.n3.length - 1] === 'Aaa nyeste' && D.n3.slice(0, -1).join('|') === [...D.n1].reverse().join('|'), D);
ok('42 standardsted = weather.home også når order setter et annet sted først', D.on === 'Hjem' && D.ent === 'weather.home', D);
ok('42 exclude deles med pollen-/varsellistene (begge virker)', D.pollenOk, D);

/* 5 · places: vises alltid (også om i exclude / duplikat), omdøping */
const E = await p.evaluate(async () => {
  const w = (ms) => new Promise((q) => setTimeout(q, ms));
  const c = window.__c;
  c.setConfig({ ...c._rawConfig, places: [{ id: 'weather.oslo_sentrum', name: 'Jobb' }, { id: 'weather.home', name: 'Huset' }, { id: 'weather.home_hourly', name: 'Hjem (time)' }] }); await w(150);
  const m = await window.__menu();
  return { n: m.map((x) => x.n), on: (m.find((x) => x.on) || {}).n };
});
ok('42 places: sted i places vises selv om det står i exclude, og selv om det er et duplikat', E.n.includes('Jobb') && E.n.includes('Hjem (time)'), E);
ok('42 places: omdøping (Huset) brukes i stedsvelgeren', E.n.includes('Huset') && !E.n.includes('Hjem') && E.on === 'Huset', E);

/* 6 · «Tilpass Vær» → Steder: søppelbøtte → exclude, «Legg til sted» → places (ut av exclude), Ferdig lagrer */
const F = await p.evaluate(async () => {
  const w = (ms) => new Promise((q) => setTimeout(q, ms));
  const c = window.__c;
  c.setConfig({ type: 'custom:msh-vaer-card', card_id: 'pop-vaer42' }); await w(120);
  c.customize(); await w(400);
  const R = c._sheet.ov.root, box = R.querySelector('.vaer-sheet');
  const rows = () => [...box.querySelectorAll('.plist [data-prow]')].map((r) => r.querySelector('.rl').textContent);
  const r0 = rows();
  const i = r0.indexOf('Fjellet');
  box.querySelector(`[data-a="rm"][data-k="${i}"]`).click(); await w(80);
  const r1 = rows(), ex1 = [...(c._sheet.box._config.exclude || [])];
  // legg Fjellet til igjen med eget navn
  box.querySelector('[data-a="openadd"]').click(); await w(60);
  const q = box.querySelector('[data-in="q"]'); q.value = 'fjell'; q.dispatchEvent(new Event('input', { bubbles: true })); await w(30);
  const cand = box.querySelector('.cd[data-k="weather.fjellet"]'), candDis = cand.disabled;
  cand.click(); await w(30);
  const autoNm = box.querySelector('[data-in="name"]').value;
  const inp = box.querySelector('[data-in="name"]'); inp.value = 'Fjellhytta'; inp.dispatchEvent(new Event('input', { bubbles: true })); await w(20);
  box.querySelector('[data-a="add"]').click(); await w(80);
  const r2 = rows(), d2 = { places: c._sheet.box._config.places, exclude: c._sheet.box._config.exclude };
  // fjern Strandhytta og lagre
  box.querySelector(`[data-a="rm"][data-k="${rows().indexOf('Strandhytta')}"]`).click(); await w(60);
  R.querySelector('[data-a="done"]').click(); await w(900);
  const raw = c._rawConfig;
  window.__newHass({}); await w(150);
  const m = await window.__menu();
  return { r0, r1, ex1, candDis, autoNm, r2, d2, saved: { places: raw.places, exclude: raw.exclude }, menu: m.map((x) => x.n), closed: !c._sheet };
});
ok('42 Tilpass Vær: listen viser alle weather.* (automatisk)', F.r0[0] === 'Hjem' && ['Fjellet', 'Hytta', 'Jobb Oslo', 'Sjøhuset', 'Strandhytta', 'Yr Bergen', 'Ny by', 'Nede'].every((x) => F.r0.includes(x)) && F.r0.length === 9, F.r0); // utilgjengelig «Nede» vises dimmet i editoren
ok('42 Tilpass Vær: søppelbøtte legger ID-en i exclude og fjerner raden', !F.r1.includes('Fjellet') && F.ex1.join() === 'weather.fjellet', F);
ok('42 Tilpass Vær: fjernet sted kan legges til igjen (navn fylles automatisk) → places, ut av exclude', !F.candDis && F.autoNm === 'Fjellet' && F.r2.includes('Fjellhytta') && F.d2.places.some((x) => x.id === 'weather.fjellet' && x.name === 'Fjellhytta') && !F.d2.exclude, F);
ok('42 Ferdig lagrer places/exclude i config; fjernet sted kommer ikke tilbake', F.closed && F.saved.exclude.join() === 'weather.forecast_strandhytta' && F.saved.places.some((x) => x.id === 'weather.fjellet') && !F.menu.includes('Strandhytta') && F.menu.includes('Fjellhytta'), F);

/* 7 · migrering av gamle places [{ name, entity }] (kortet + GUI-editoren) */
const G = await p.evaluate(async () => {
  const w = (ms) => new Promise((q) => setTimeout(q, ms));
  const old = { type: 'custom:msh-vaer-card', card_id: 'mig', places: [{ name: 'Hytta', entity: 'weather.hytta' }, { name: 'Hjem', entity: 'weather.home' }] };
  const n = window.MSH.vaerNormCfg(old);
  const c2 = document.createElement('msh-vaer-card'); c2.setConfig(old);
  const ed = customElements.get('msh-vaer-card').getConfigElement(); document.body.appendChild(ed);
  ed.hass = window.__c.hass; ed.setConfig(old); await w(150);
  const edc = ed._config; ed.remove();
  const L = window.MSH.vaerPlaces(window.__c.hass, n).map((x) => x.name);
  return { n, card: c2._rawConfig, edc, L };
});
ok('42 migrering: places [{ name, entity }] → places [{ id, name }] + order (kort og GUI-editor)', JSON.stringify(G.n.places) === JSON.stringify([{ id: 'weather.hytta', name: 'Hytta' }, { id: 'weather.home', name: 'Hjem' }]) && G.n.order.join() === 'weather.hytta,weather.home' && JSON.stringify(G.card.places) === JSON.stringify(G.n.places) && JSON.stringify(G.edc.places) === JSON.stringify(G.n.places) && G.L.slice(0, 2).join('|') === 'Hytta|Hjem', G);

/* 8 · GUI-editoren (getConfigElement): samme liste og valg */
const H = await p.evaluate(async () => {
  const w = (ms) => new Promise((q) => setTimeout(q, ms));
  const ed = customElements.get('msh-vaer-card').getConfigElement(); document.body.appendChild(ed);
  ed.hass = window.__c.hass; ed.setConfig({ type: 'custom:msh-vaer-card', card_id: 'gui42', exclude: ['weather.oslo_sentrum'] });
  let last = null; ed.addEventListener('config-changed', (e) => { last = e.detail.config; });
  await w(200);
  const R = ed.shadowRoot;
  const rows = () => [...R.querySelectorAll('[data-vpn]')].map((x) => x.dataset.vpn);
  const r0 = rows(), restore = !!R.querySelector('[data-op="restore"][data-id="weather.oslo_sentrum"]');
  // omdøp Hytta
  const inp = R.querySelector('[data-vpn="weather.hytta"]'); inp.value = 'Hytte'; inp.dispatchEvent(new Event('change', { bubbles: true })); await w(80);
  const c1 = last && { places: last.places, exclude: last.exclude };
  // ↓ på første rad (Hjem) → order
  R.querySelector('[data-op="down"][data-i="0"]').click(); await w(80);
  const c2 = last && last.order;
  // fjern (søppelbøtte) Fjellet → exclude
  R.querySelector('[data-op="rm"][data-id="weather.fjellet"]').click(); await w(80);
  const c3 = last && last.exclude, r3 = rows();
  // vis Jobb Oslo igjen
  R.querySelector('[data-op="restore"][data-id="weather.oslo_sentrum"]').click(); await w(80);
  const c4 = last && last.exclude, r4 = rows();
  ed.remove();
  return { r0, restore, c1, c2, c3, r3, c4, r4 };
});
ok('42 GUI: alle weather.* som rader (inkl. utilgjengelige), fjernede kan vises igjen', H.r0.length === 8 && H.r0.includes('weather.nede') && !H.r0.includes('weather.oslo_sentrum') && H.r0[0] === 'weather.home' && H.restore, H);
ok('42 GUI: omdøping → places [{ id, name }]', H.c1 && JSON.stringify(H.c1.places) === JSON.stringify([{ id: 'weather.hytta', name: 'Hytte' }]) && H.c1.exclude.join() === 'weather.oslo_sentrum', H);
ok('42 GUI: ↑/↓ → order, Fjern → exclude, «vis igjen» → ut av exclude', H.c2 && H.c2[0] === H.r0[1] && H.c2[1] === 'weather.home' && H.c3.includes('weather.fjellet') && !H.r3.includes('weather.fjellet') && !(H.c4 || []).includes('weather.oslo_sentrum') && H.r4.includes('weather.oslo_sentrum'), H);

/* 9 · uten weather.home → standardsted = første i rekkefølgen; lukking avslutter lyttingen */
const I = await p.evaluate(async () => {
  const w = (ms) => new Promise((q) => setTimeout(q, ms));
  const h = window.__c.hass, cfg = { exclude: ['weather.home'], order: ['weather.knmi'] };
  const d = window.MSH.vaerPlace(h, cfg), d2 = window.MSH.vaerPlace(h, { exclude: ['weather.home'] });
  const subs = window.__reg.subs;
  location.hash = ''; window.dispatchEvent(new Event('location-changed')); await w(200);
  return { d: d && d.id, d2: d2 && d2.id, unsubs: window.__reg.unsubs, subs };
});
ok('42 uten weather.home: standardsted = første i order (ellers første i listen)', I.d === 'weather.knmi' && I.d2 === 'weather.fjellet', I);
ok('42 lukket popup: entity_registry_updated-abonnementet avsluttes', I.unsubs >= 1, I);

ok('ingen sidefeil', !errs.length, errs);
await b.close();
try { rmSync(bundle); } catch (e) { /* */ }
console.log(JSON.stringify(res, null, 1));
if (fail.length) { console.log('FEIL: ' + fail.join(' · ')); process.exit(1); }
console.log('Alle Vær 42-sjekker OK');
