// Fiks 19 · Rom: 19.16 TV-variant av det rosa spillerkortet, 19.20 «Tilpass rom» i fire faner, 19.21 effektsensor/terskel/tekst per enhet.
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { readdirSync, mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
mkdirSync('test/.build', { recursive: true });
const bundle = resolve(`test/.build/rom19-${process.pid}.js`);
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
  const add = (id, state, attributes, area) => { hass.states[id] = { entity_id: id, state, attributes: { friendly_name: id.split('.')[1], ...attributes }, last_changed: new Date().toISOString(), last_updated: new Date().toISOString(), context: {} }; hass.entities[id] = { entity_id: id, platform: 'demo', area_id: area || null, device_id: null }; };
  const pic = 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
  const tvA = hass.states['media_player.stue_tv'].attributes;
  Object.assign(tvA, { device_class: 'tv', media_title: 'REX', media_series_title: 'Dagsrevyen', entity_picture: pic, supported_features: 16 | 32 | 1 | 4 });
  delete tvA.volume_level;
  add('switch.stue_kaffe', 'on', { friendly_name: 'Kaffemaskin' }, 'stue');
  add('sensor.stue_stikk_1', '1450', { friendly_name: 'Stue stikk 1', device_class: 'power', unit_of_measurement: 'W' }, 'stue');
  const res = {};
  const dash = document.getElementById('dash');
  const r = document.createElement('msh-rom-card');
  const cfg = { type: 'custom:msh-rom-card', card_id: 'r19', area: 'stue', include: { enheter: ['switch.stue_kaffe'] },
    overrides: { switch: { stue_kaffe: { power: 'sensor.stue_stikk_1', threshold_w: 5, on_text: 'Brygger · {w} W', off_text: 'Standby' } } } };
  r.setConfig(cfg);
  r.hass = hass; dash.appendChild(r);
  await wait(300);
  r.setUI({ acc: { media: true, dev: true } });
  await wait(400);
  const R = r.shadowRoot, cs = (el) => getComputedStyle(el);
  // 19.16
  const tv = R.querySelector('.mc.tvc');
  res.tv = tv && {
    name: tv.querySelector('.mn').textContent, title: tv.querySelector('.ms').textContent, sub: (tv.querySelector('.ms2') || {}).textContent,
    slider: !!tv.querySelector('[data-slide="vol"]'), pill: !!tv.querySelector('.tvv'), pct: tv.querySelector('.tvl').textContent.trim(),
    pillH: cs(tv.querySelector('.tvv')).height, pillBg: cs(tv.querySelector('.tvv')).backgroundColor, btn: cs(tv.querySelector('.tvb')).width,
    art: (() => { const a = tv.querySelector('.art'); const i = a.querySelector('img'); return { cls: a.className, w: cs(a).width, r: cs(a).borderRadius, bg: cs(a).backgroundColor, pad: cs(a).padding, fit: i && cs(i).objectFit }; })(),
    ctl: [...tv.querySelectorAll('.mctl button')].map((x) => x.title || x.dataset.cmd || x.dataset.act),
  };
  const mus = [...R.querySelectorAll('.mc:not(.tvc)')];
  res.music = mus.map((m) => ({ slider: !!m.querySelector('[data-slide="vol"]'), ctl: [...m.querySelectorAll('.mctl button')].map((x) => x.dataset.cmd || x.dataset.act) }));
  // volum +: trykk = ett trinn; hold = gjentar
  window.__calls.length = 0;
  const plus = tv && tv.querySelector('[data-tvvol="1"]');
  plus.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true, pointerId: 1 }));
  plus.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, composed: true, pointerId: 1 }));
  res.vol_tap = window.__calls.filter((c) => c[1] === 'volume_up').length;
  window.__calls.length = 0;
  plus.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true, pointerId: 2 }));
  await wait(1000);
  plus.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, composed: true, pointerId: 2 }));
  res.vol_hold = window.__calls.filter((c) => c[1] === 'volume_up').length;
  // 19.21: flisen
  const k = R.querySelector('[data-key="d-switch.stue_kaffe"]');
  res.kaffe_on = k && k.textContent.replace(/\s+/g, ' ').trim();
  const st2 = { ...hass.states, 'sensor.stue_stikk_1': { ...hass.states['sensor.stue_stikk_1'], state: '2' } };
  r.hass = { ...hass, states: st2 }; await wait(300);
  const k2 = R.querySelector('[data-key="d-switch.stue_kaffe"]');
  res.kaffe_low = k2 && k2.textContent.replace(/\s+/g, ' ').trim();
  res.devhead = (R.querySelector('[data-key="sec-dev"]') || {}).textContent.replace(/\s+/g, ' ').trim().slice(0, 60);
  // 19.20: editor
  const ed = document.createElement('msh-editor');
  ed.inline = true;
  ed.cardClass = customElements.get('msh-rom-card');
  dash.appendChild(ed);
  ed.hass = { ...hass, states: st2 }; ed.setConfig({ ...cfg });
  await wait(300);
  const E = ed.shadowRoot;
  const tabs = () => [...E.querySelectorAll('.chips.sg.tabs .chip')].map((x) => (x.classList.contains('on') ? '*' : '') + x.textContent.trim());
  const secs = () => [...E.querySelectorAll('.tpane .fsh')].map((x) => x.textContent.replace(/\s+/g, ' ').trim()).slice(0, 12);
  res.ed_tabs = tabs(); res.ed_oppsett = secs(); res.ed_details = E.querySelectorAll('.tpane > details').length;
  const click = (sel) => { const el = E.querySelector(sel); el.click(); return wait(150); };
  await click('.chips.sg.tabs .chip[data-v="ent"]');
  res.ed_sub = [...E.querySelectorAll('.chips.sg.tsub .chip')].map((x) => (x.classList.contains('on') ? '*' : '') + x.textContent.replace(/\s+/g, ' ').trim());
  res.ed_ent = secs();
  await click('.chips.sg.tsub .chip[data-v="dev"]');
  res.ed_ent_dev = secs();
  await click('.chips.sg.tabs .chip[data-v="klima"]'); res.ed_klima = secs();
  await click('.chips.sg.tabs .chip[data-v="kort"]'); res.ed_kort = secs();
  if (window.__shot) await window.__shot();
  // enhetens felt (åpne «Kaffemaskin · Enhet»)
  const d = [...E.querySelectorAll('details.sec')].find((x) => /Kaffemaskin/.test(x.querySelector('summary').textContent));
  if (d) { d.open = true; await wait(100); }
  res.dev_fields = d ? [...d.querySelectorAll(':scope > .in > .f > label, :scope > .in > .f .line > span:first-child')].map((x) => x.textContent.trim()).slice(0, 8) : null;
  res.dev_preview = d ? [...d.querySelectorAll('.f')].map((x) => x.textContent.replace(/\s+/g, ' ').trim()).find((t) => /Forhåndsvisning/.test(t)) : null;
  const plusT = d && [...d.querySelectorAll('button[data-a="fn"]')].find((x) => x.dataset.d === '1');
  if (plusT) { plusT.click(); await wait(100); }
  res.thr_after = ed._config.overrides.switch.stue_kaffe.threshold_w;
  res.hjem_delta = window.MSH.roomPowerDelta({ ...hass, states: st2 }, 'stue', ed._config);
  return res;
});
if (shots) { await p.locator('msh-rom-card').screenshot({ path: shots + '/rom19-card.png' }); const bb = await p.locator('msh-editor').boundingBox(); await p.screenshot({ path: shots + '/rom19-ed.png', fullPage: true, clip: { x: 0, y: bb.y, width: 390, height: 700 } }); }
console.log(JSON.stringify(out, null, 1));
console.log('pageerrors', errs);
await b.close();
