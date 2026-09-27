// Fiks 17 (gruppe A · Rom): 17.1 romkort-stepper, 17.3 klima-stepper, 17.4 rosa media-kort, 17.5 lux-rad, 17.6 enhetsfarger.
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { readdirSync, mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
mkdirSync('test/.build', { recursive: true });
const bundle = resolve(`test/.build/rom17-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const shots = process.env.SHOTS || '';
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto('file://' + resolve('test/harness.html'));
for (const m of readdirSync('test/mock').sort()) await p.addScriptTag({ path: resolve('test/mock/' + m) });
await p.addScriptTag({ path: bundle });
const out = await p.evaluate(async () => {
  const wait = (ms) => new Promise((q) => setTimeout(q, ms));
  const hass = window.mockHass();
  const add = (id, state, attributes) => { hass.states[id] = { entity_id: id, state, attributes: { friendly_name: id.split('.')[1], ...attributes }, last_changed: new Date().toISOString(), last_updated: new Date().toISOString(), context: {} }; };
  ['a', 'b', 'c', 'd'].forEach((x, i) => add('switch.stue_' + x, i === 1 ? 'off' : 'on', { friendly_name: 'Bryter ' + x }));
  add('sensor.stue_lux2', '6.34', { unit_of_measurement: 'lx', device_class: 'illuminance', friendly_name: 'Lux' });
  add('sensor.stue_lux3', 'unavailable', { unit_of_measurement: 'lx', device_class: 'illuminance', friendly_name: 'Lux borte' });
  hass.states['climate.stue'].attributes = { ...hass.states['climate.stue'].attributes, hvac_action: 'idle' };
  hass.states['media_player.stue_sonos'].attributes.entity_picture = 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
  const res = {};
  const dash = document.getElementById('dash');
  const r = document.createElement('msh-rom-card');
  r.setConfig({ type: 'custom:msh-rom-card', card_id: 'r17', area: 'stue', klima_heat_w: { stue: 5000 }, include: { enheter: ['switch.stue_a', 'switch.stue_b', 'switch.stue_c', 'switch.stue_d'], sensorer: ['sensor.stue_lux2', 'sensor.stue_lux3'] } });
  r.hass = hass; dash.appendChild(r);
  await wait(300);
  r.setUI({ acc: { klima: true, media: true, dev: true, sens: true } });
  await wait(400);
  const R = r.shadowRoot, cs = (el) => getComputedStyle(el);
  // 17.3
  const kctl = R.querySelector('.kc:not(.heat) .kctl');
  res.k_bg = kctl && cs(kctl).backgroundColor; res.k_shadow = kctl && cs(kctl).boxShadow; res.k_sub = R.querySelector('.kc .ks') && R.querySelector('.kc .ks').textContent;
  res.k_name = R.querySelector('.kc .kn') && cs(R.querySelector('.kc .kn')).fontSize;
  // 17.4
  const mt = [...R.querySelectorAll('.mt')];
  res.m = mt.map((e) => ({ pk: e.classList.contains('pk'), name: e.querySelector('.mn').textContent, t: e.querySelector('.ms').textContent, img: !!e.querySelector('.art img'), op: cs(e.querySelector('.mpk')).opacity }));
  res.m_dots = [...R.querySelectorAll('.mcw .msh-dot')].map((d) => getComputedStyle(d, '::after').backgroundColor);
  res.m_track = R.querySelector('.vs .cvt') && cs(R.querySelector('.vs .cvt')).height;
  // 17.5
  const lux = R.querySelector('[data-key="s-sensor.stue_lux2"]');
  res.lux = lux && { cls: lux.className, bg: cs(lux).backgroundColor, l: lux.querySelector('.u-l').textContent, n: lux.querySelector('.u-n').textContent, nfs: cs(lux.querySelector('.u-n')).fontSize, icon: lux.querySelector('ha-icon').getAttribute('icon') };
  const lux3 = R.querySelector('[data-key="s-sensor.stue_lux3"]');
  res.lux3 = lux3 && { cls: lux3.className, l: lux3.querySelector('.u-l').textContent };
  // 17.6
  res.dev = [...R.querySelectorAll('[data-key^="d-switch.stue_"]')].map((e) => `${e.dataset.key.slice(2)} ${e.classList.contains('d-on') ? 'on' : '-'} ${e.style.getPropertyValue('--u-bg')}`);
  // 17.1 romkort
  const rk = document.createElement('msh-romkort-card');
  rk.setConfig({ type: 'custom:msh-romkort-card', card_id: 'rk17', area: 'stue', variant: 'karusell' });
  rk.hass = hass; dash.prepend(rk); await wait(300);
  const kv = rk.shadowRoot.querySelector('.rk-kv'), ic = rk.shadowRoot.querySelector('.rk-ic');
  res.rk = kv && { gap: Math.round(kv.getBoundingClientRect().top - ic.getBoundingClientRect().bottom), w: kv.getBoundingClientRect().width, bg: cs(kv).backgroundImage, sh: cs(kv).boxShadow, t: cs(kv.querySelector('.rk-kt')).fontSize };
  return res;
});
if (shots) { await p.screenshot({ path: shots + '/rom17-top.png', fullPage: true }); }
console.log(JSON.stringify(out, null, 1));
console.log('pageerrors', errs);
await b.close();
