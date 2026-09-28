// Fiks 22.9 · Kiosk-modus-arket: standardoppsett, bryter, grupper, enheter (Browser Mod), YAML-forhåndsvisning,
// strategiens kiosk_mode og valg per enhet (MSH.kioskDeviceWant).
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { readdirSync, mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
mkdirSync('test/.build', { recursive: true });
const bundle = resolve(`test/.build/kiosk-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto('file://' + resolve('test/harness.html'));
for (const m of readdirSync('test/mock').sort()) await p.addScriptTag({ path: resolve('test/mock/' + m) });
await p.addScriptTag({ path: bundle });
const out = await p.evaluate(async () => {
  const wait = (ms) => new Promise((q) => setTimeout(q, ms));
  const M = window.MSH, hass = window.mockHass(), ws0 = hass.callWS, calls = [];
  hass.states['input_boolean.kiosk_mode'] = { entity_id: 'input_boolean.kiosk_mode', state: 'off', attributes: { friendly_name: 'Kiosk' } };
  hass.callWS = (m) => {
    if (m.type === 'config/auth/list') return Promise.resolve([{ name: 'Sebastian', id: 'u1' }, { name: 'Gjest', id: 'u2' }, { name: 'Supervisor', system_generated: true }]);
    if (m.type === 'config/device_registry/list') return Promise.resolve([{ id: 'd1', name: 'Pixel Fold', identifiers: [['browser_mod', 'fold-123']] }, { id: 'd2', name: 'Stue-nettbrett', identifiers: [['browser_mod', 'tab-9']] }]);
    return ws0(m);
  };
  hass.callService = (d, s, data) => { calls.push([d, s, data.entity_id]); return Promise.resolve(); };
  localStorage.setItem('browser_mod-browser-id', 'fold-123');
  localStorage.setItem('ki_kiosk_applied', '');
  await M.store.load(hass);
  const res = {};
  res.def = M.kioskConfig();
  const ov = M.kioskSheet({ hass });
  await wait(400);
  const R = ov.root, q = (s) => R.querySelector(s), yaml = () => q('pre').textContent;
  res.top = q('.top').textContent.replace(/\s+/g, ' ').trim();
  res.yaml0 = yaml();
  q('[data-a="master"]').click(); res.calls = calls.slice();
  // mobil: +50 px, legg til Sidebar, «Alltid»
  q('[data-a="exp"][data-s="mobile"]').click(); await wait(50);
  q('[data-a="w"][data-v="50"]').click();
  q('[data-a="hide"][data-s="mobile"][data-v="hide_sidebar"]').click();
  await wait(50);
  res.yaml1 = yaml();
  // brukere på, velg Gjest
  q('[data-a="row"][data-s="users"]').click(); await wait(50);
  q('[data-a="user"][data-v="Gjest"]').click(); await wait(50);
  res.yaml2 = yaml();
  // «Alt» utelukker de andre, og siste valg kan ikke fjernes
  q('[data-a="hide"][data-s="users"][data-v="hide_header"]').click(); await wait(30);
  q('[data-a="hide"][data-s="users"][data-v="kiosk"]').click(); await wait(30);
  q('[data-a="hide"][data-s="users"][data-v="kiosk"]').click(); await wait(30);
  res.usersHide = M.store.get('kiosk.rows.users.hide');
  // enheter
  res.devs = [...R.querySelectorAll('[data-a="row"][data-s^="dev:"]')].map((e) => e.dataset.s);
  res.me = !!q('.me');
  q('[data-a="row"][data-s="dev:fold-123"]').click(); await wait(30);
  q('[data-a="hide"][data-s="dev:fold-123"][data-v="hide_header"]').click(); await wait(30);
  res.wantOff = M.kioskDeviceWant(hass, 'fold-123');
  hass.states['input_boolean.kiosk_mode'].state = 'on';
  res.wantOn = M.kioskDeviceWant(hass, 'fold-123');
  res.wantOther = M.kioskDeviceWant(hass, 'tab-9');
  res.reload = !!q('[data-a="reload"]');
  res.sub = [...R.querySelectorAll('.rh')].map((e) => e.textContent.replace(/\s+/g, ' ').trim()).slice(0, 3);
  // strategien
  const cfg = await customElements.get('ll-strategy-dashboard-ki-dashboard').generate({}, hass).catch((e) => ({ err: e.message }));
  res.strat = cfg.kiosk_mode || cfg.err || null;
  ov.close();
  return res;
});
await b.close();
let fail = 0;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FEIL ') + m); if (!c) fail++; };
const T = '{{ is_state("input_boolean.kiosk_mode", "on") }}';
ok(out.def && out.def.mobile_settings.hide_header === T && out.def.mobile_settings.custom_width === 1000 && out.def.non_admin_settings.kiosk === true, 'standardoppsett ' + JSON.stringify(out.def));
ok(/Kiosk-modus er av/.test(out.top) && /påvirker 2 valg/.test(out.top), 'toppkort: ' + out.top);
ok(out.calls.some((c) => c[0] === 'input_boolean' && c[1] === 'toggle' && c[2] === 'input_boolean.kiosk_mode'), 'bryter kaller input_boolean.toggle');
ok(/custom_width: 1050/.test(out.yaml1) && /hide_sidebar/.test(out.yaml1), 'YAML live etter −/+ og Sidebar');
ok(/user_settings/.test(out.yaml2) && /Gjest/.test(out.yaml2), 'YAML: user_settings med Gjest');
ok(JSON.stringify(out.usersHide) === '["kiosk"]', '«Alt» utelukker andre, minst ett valg: ' + JSON.stringify(out.usersHide));
ok(out.devs.join() === 'dev:fold-123,dev:tab-9' && out.me, 'Browser Mod-enheter + «Denne enheten»');
ok(out.wantOff === '' && out.wantOn === 'hide_header' && out.wantOther === '', `per enhet: av=${out.wantOff} på=${out.wantOn} annen=${out.wantOther}`);
ok(out.reload, '«Last inn på nytt»-knapp etter endring');
ok(out.strat && out.strat.mobile_settings && out.strat.user_settings, 'strategien skriver kiosk_mode: ' + JSON.stringify(out.strat).slice(0, 120));
console.log('undertekster:', out.sub.join(' | '));
if (errs.length) { console.log('sidefeil:', errs); }
console.log(fail ? `${fail} feil` : 'Alt OK');
process.exit(fail ? 1 : 0);
