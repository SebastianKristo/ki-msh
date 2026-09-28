// Fiks 17 · gruppe D: 17.8 (ikonvelger + popup-velger), 17.9 (prosa-seksjoner + KI Planter), 17.14 (rosa søppelkort).
// Kjør: node test/fiks17-d-check.mjs  (skjermbilder: SHOTS=<mappe>)
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { readdirSync, mkdirSync, unlinkSync } from 'node:fs';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const R = resolve('.') + '/';
mkdirSync('test/.build', { recursive: true });
const bundle = resolve(`test/.build/f17d-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle], { cwd: R, stdio: 'inherit' });
const mocks = readdirSync(R + 'test/mock').filter((f) => f.endsWith('.js')).sort().map((f) => R + 'test/mock/' + f);
const SHOTS = process.env.SHOTS || '';
process.on('exit', () => { if (res.length && !globalThis.__done) console.log(res.join('\n')); });
const browser = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const res = [];
const ok = (name, cond, info) => { res.push(`${cond ? '✔' : '✘'} ${name}${info != null ? ' · ' + JSON.stringify(info) : ''}`); };
const page = await browser.newPage({ viewport: { width: 430, height: 900 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto('file://' + R + 'test/harness.html');
for (const m of mocks) await page.addScriptTag({ path: m });
await page.addScriptTag({ path: bundle });
const wait = (ms) => page.waitForTimeout(ms);
const mk = (tag, cfg) => page.evaluate(async ([tag, cfg]) => {
  window.H = window.H || window.mockHass();
  const el = document.createElement(tag); el.setConfig(cfg); el.hass = window.H;
  const d = document.createElement('div'); d.style.cssText = 'width:398px;padding:16px'; d.appendChild(el);
  document.getElementById('dash').appendChild(d);
  await new Promise((r) => setTimeout(r, 300));
  window.__last = el; return true;
}, [tag, cfg]);
const setState = (id, state, attrs) => page.evaluate(async ([id, state, attrs]) => {
  const S = { ...H.states, [id]: { ...(H.states[id] || { entity_id: id, attributes: {} }), state: String(state), attributes: { ...((H.states[id] || {}).attributes || {}), ...(attrs || {}) } } };
  window.H = { ...H, states: S };
  document.querySelectorAll('#dash > div > *').forEach((c) => { c.hass = window.H; });
  await new Promise((r) => setTimeout(r, 250));
}, [id, state, attrs]);

/* ---------------- 17.14 · søppelkortet */
await mk('msh-soppel-card', { type: 'custom:msh-soppel-card', card_id: 'sop1' });
let t = await page.evaluate(() => { const r = __last.shadowRoot, s = r.querySelector('.tr'); const cs = getComputedStyle(s); return { pink: s.classList.contains('pink'), n: r.querySelector('.n').textContent, l1: r.querySelector('.l1').textContent, l2: (r.querySelector('.l2') || {}).textContent, bg: cs.backgroundImage, rad: cs.borderRadius, h: Math.round(s.getBoundingClientRect().height), nfs: getComputedStyle(r.querySelector('.n')).fontSize, nfw: getComputedStyle(r.querySelector('.n')).fontWeight, ent: s.dataset.ent }; });
ok('17.14 tømmedag (0,Restavfall,Plastavfall) → rosa kort', t.pink && t.n === '0' && /242, 146, 204/.test(t.bg) && t.rad === '30px', t);
ok('17.14 tittel + avfallstyper', t.l1 === 'Søppel tømmes i dag' && t.l2 === 'Restavfall og Plastavfall', { l1: t.l1, l2: t.l2 });
ok('19.10 tall 60px/600 og høyde ≈ 120', t.nfs === '60px' && t.nfw === '600' && t.h >= 100 && t.h <= 145, { nfs: t.nfs, h: t.h });
ok('17.14 standard-entitet sensor.neste_tomming (hold → more-info)', t.ent === 'sensor.neste_tomming', t.ent);
if (SHOTS) await page.locator('msh-soppel-card').first().screenshot({ path: SHOTS + '/soppel-rosa.png' });
await setState('sensor.neste_tomming', '3,Papir');
t = await page.evaluate(() => { const r = __last.shadowRoot; return { pink: r.querySelector('.tr').classList.contains('pink'), n: r.querySelector('.n').textContent, l1: r.querySelector('.l1').textContent, l2: (r.querySelector('.l2') || {}).textContent }; });
ok('17.14 andre dager: vanlig kort', !t.pink && t.n === '3' && t.l1 === 'Dager til neste søppeltømming' && t.l2 === 'Papir', t);
if (SHOTS) await page.locator('msh-soppel-card').first().screenshot({ path: SHOTS + '/soppel-vanlig.png' });
await setState('sensor.neste_tomming', '1,Papir');
t = await page.evaluate(async () => { const r = __last.shadowRoot; const a = r.querySelector('.tr').classList.contains('pink'); __last.setConfig({ ...__last._yamlConfig, rosa_dager: 1, tekst_en: 'I morgen!' }); await new Promise((q) => setTimeout(q, 200)); return { before: a, after: r.querySelector('.tr').classList.contains('pink'), l1: r.querySelector('.l1').textContent }; });
ok('17.14 rosa_dager: 1 gir rosa dagen før + egen tekst', !t.before && t.after && t.l1 === 'I morgen!', t);
await setState('sensor.neste_tomming', '0,Restavfall');
t = await page.evaluate(async () => { const r = __last.shadowRoot; __last.setConfig({ ...__last._yamlConfig, rosa: false }); await new Promise((q) => setTimeout(q, 200)); return r.querySelector('.tr').classList.contains('pink'); });
ok('17.14 «Rosa på tømmedagen» av → vanlig', t === false, t);
await mk('msh-soppel-card', { type: 'custom:msh-soppel-card', sensor: 'sensor.finnes_ikke' });
t = await page.evaluate(() => { const r = __last.shadowRoot; return { n: r.querySelector('.n').textContent, pick: (r.querySelector('.pick') || {}).textContent, pink: r.querySelector('.tr').classList.contains('pink') }; });
ok('17.14 mangler sensoren: «–» og «Velg entitet»', t.n === '–' && /Velg entitet/.test(t.pick || '') && !t.pink, t);
const sch = await page.evaluate(() => { const C = customElements.get('msh-soppel-card'); return C.schema.map((f) => f.name).filter(Boolean); });
ok('17.14 editor-felt (begge editorene bruker skjemaet)', ['sensor', 'rosa', 'rosa_dager', 'tekst_i_dag', 'tekst_en', 'tekst_flere'].every((k) => sch.includes(k)), sch);

/* ---------------- 17.9 · prosa-seksjoner */
const stub = await page.evaluate(() => customElements.get('msh-prosa-card').getStubConfig());
ok('17.9 getStubConfig har standard-configen', stub.vaer && stub.vaer.entity === 'sensor.dashboard_index' && stub.planter && stub.planter.auto === true && Array.isArray(stub.apparater) && stub.hjemkomst[0].navn === 'Mamma' && stub.pris.entity && stub.bursdag.vis && stub.ringeklokke.entity, Object.keys(stub));
await setState('sensor.neste_tomming', '0,Restavfall,Plastavfall');
await mk('msh-prosa-card', { type: 'custom:msh-prosa-card', card_id: 'prosa1' });
const txt = () => page.evaluate(() => __last.shadowRoot.querySelector('.pz').textContent.replace(/\s+/g, ' ').trim());
let p = await txt();
ok('17.9 vær fra sensor.dashboard_index (attributt weather, små bokstaver)', /Ute er det delvis skyet og 12°?\s*\./.test(p), p);
ok('17.9 hjemkomst: «Mamma kommer hjem ca. kl HH:MM.»', /Mamma kommer hjem ca\. kl \S*\d\d:\d\d\./.test(p), p);
ok('17.9 apparat: «Vaskemaskinen vasker 1180W nå.»', /Vaskemaskinen vasker 1180W nå\./.test(p), p);
ok('17.9 planter fra KI Planter (registry platform)', /Arekapalme og Palmelilje trenger vann\./.test(p), p);
ok('17.9 pris fra norgespris', /Strømmen koster 1,16 kr( og vi bruker|\.)/.test(p), p);
ok('17.9 rekkefølge vær → hjemkomst → apparater → planter → pris', ['Ute er det', 'Mamma kommer', 'Vaskemaskinen', 'Arekapalme', 'Strømmen koster'].map((s) => p.indexOf(s)).every((v, i, a) => v >= 0 && (!i || v > a[i - 1])), p);
ok('17.9 ingen dobbel vær/pris fra standardprosaen', (p.match(/Ute er det/g) || []).length === 1 && (p.match(/Strømmen koster/g) || []).length === 1, p);
const hasAppl = await page.evaluate(() => !!__last.shadowRoot.querySelector('.chip svg.ma-washer'));
ok('17.9 ki:vaskemaskin rendres som animert hvitevare-ikon', hasAppl, hasAppl);
if (SHOTS) await page.locator('msh-prosa-card').first().screenshot({ path: SHOTS + '/prosa.png' });
// ringeklokke og bursdag vises når de slås på
await setState('input_boolean.ki_ringeklokke_varsel_aktiv', 'on');
await setState('binary_sensor.vis_bursdagskort', 'on');
p = await txt();
ok('17.9 ringeklokke + bursdag vises når de er på', /Noen ringer på døren!/.test(p) && /I dag har \S*noen bursdag!/.test(p), p);
await setState('input_boolean.ki_ringeklokke_varsel_aktiv', 'off');
// testvisning: integrasjonen melder alle som trenger vann (> 3 → «4 planter»)
await setState('switch.hjemme_planter_testvisning', 'on');
await setState('sensor.hjemme_planter_trenger_vann', 4, { trenger_vann: ['Arekapalme', 'Palmelilje', 'Monstera', 'Fiken'], trenger_vann_tekst: 'Arekapalme og Palmelilje og Monstera og Fiken', testvisning: true });
p = await txt();
ok('17.9 testvisning: over 3 planter → «4 planter trenger vann.»', /4 planter trenger vann\./.test(p), p);
await setState('sensor.hjemme_planter_trenger_vann', 0, { trenger_vann: [], trenger_vann_tekst: '' });
p = await txt();
ok('17.9 ingen trenger vann → ingen plante-setning', !/trenger vann/.test(p), p);
await setState('sensor.hjemme_planter_trenger_vann', 2, { trenger_vann: ['Arekapalme', 'Palmelilje'], trenger_vann_tekst: 'Arekapalme og Palmelilje' });
// trykk → #planter
await page.evaluate(() => { location.hash = ''; });
await page.evaluate(() => __last.shadowRoot.querySelector('.chip[data-s="planter"]').click());
await wait(100);
ok('17.9 trykk på plante-pillen → #planter', await page.evaluate(() => location.hash) === '#planter', await page.evaluate(() => location.hash));
// hold → bekreftelse → button.press + haptic success
await page.evaluate(() => { window.__calls.length = 0; window.__hap = []; window.addEventListener('haptic', (e) => window.__hap.push(e.detail), { once: false }); });
const chip = page.locator('msh-prosa-card').first().locator('.chip[data-s="planter"]');
const bb = await chip.boundingBox();
await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await page.mouse.down(); await wait(700); await page.mouse.up();
await wait(300);
const conf = await page.evaluate(() => { const hosts = MSH.portals(); const h = hosts[hosts.length - 1]; return h ? h.shadowRoot.textContent.replace(/\s+/g, ' ') : ''; });
ok('17.9 hold → «Merk alle som vannet?»', /Merk alle som vannet\?/.test(conf), conf.slice(0, 120));
if (SHOTS) await page.screenshot({ path: SHOTS + '/prosa-hold.png' });
await page.evaluate(() => { const hosts = MSH.portals(); const b = hosts.length && hosts[hosts.length - 1].shadowRoot.querySelector('[data-a="ok"]'); if (b) b.click(); });
await wait(200);
const pressed = await page.evaluate(() => window.__calls.filter((c) => c[0] === 'button' && c[1] === 'press').map((c) => c[2].entity_id));
ok('17.9 «Alle vannet» → button.hjemme_planter_alle_vannet', pressed.includes('button.hjemme_planter_alle_vannet'), { pressed, hap: await page.evaluate(() => window.__hap) });
// manglende entiteter hoppes over uten feil
await page.evaluate(async () => {
  const S = { ...H.states };
  ['sensor.dashboard_index', 'input_select.vaskemaskin_status', 'sensor.vaskemaskin_power', 'sensor.norgespris_total_strompris_norgespris', 'input_boolean.ki_cybele_pa_vei_hjem_fra_jobb', 'sensor.cybele_reisetid_fra_job', 'binary_sensor.vis_bursdagskort', 'input_boolean.ki_ringeklokke_varsel_aktiv', 'sensor.hjemme_planter_trenger_vann'].forEach((k) => delete S[k]);
  window.H2 = { ...H, states: S };
  const el = document.createElement('msh-prosa-card'); el.setConfig({ type: 'custom:msh-prosa-card', card_id: 'prosa2' }); el.hass = window.H2;
  document.getElementById('dash').appendChild(el); window.__p2 = el;
  await new Promise((r) => setTimeout(r, 300));
});
p = await page.evaluate(() => __p2.shadowRoot.querySelector('.pz').textContent.replace(/\s+/g, ' ').trim());
ok('17.9 manglende entiteter hoppes over (standardprosa som før)', /Ute er det/.test(p) && /Strømmen koster/.test(p) && !/Vaskemaskinen|Mamma|trenger vann/.test(p), p);
// exclude: [pris] → ikke lagt inn igjen
await mk('msh-prosa-card', { type: 'custom:msh-prosa-card', card_id: 'prosa3', exclude: ['pris', 'planter'], rekkefolge: ['planter', 'pris', 'vaer'] });
p = await txt();
ok('17.9 exclude: [pris, planter] → seksjonene vises ikke', !/Strømmen koster 1,16/.test(p) && !/trenger vann/.test(p) && /Ute er det/.test(p), p);
// editoren: seksjonene finnes i skjemaet (kortets egen + GUI)
const secs = await page.evaluate(() => { const s = customElements.get('msh-prosa-card').schema(window.H); return s.map((f) => f.id || f.name || f.type); });
ok('17.9 editor: Seksjoner (rekkefølge) + Vær/Hjemkomst/Ringeklokke/Apparater/Planter/Pris/Bursdag', ['rekkefolge', 'sek-vaer', 'sek-hjemkomst', 'sek-ringeklokke', 'sek-apparater', 'sek-planter', 'sek-pris', 'sek-bursdag'].every((k) => secs.includes(k)), secs);
// GUI-editoren tegner Planter-seksjonen med stedsvelgeren
const ed = await page.evaluate(async () => {
  const C = customElements.get('msh-prosa-card'); const e = C.getConfigElement(); e.hass = H; e.setConfig({ type: 'custom:msh-prosa-card' });
  document.body.appendChild(e); await new Promise((r) => setTimeout(r, 300));
  const d = e.shadowRoot.querySelector('[data-focus="sek-planter"]'); if (d) d.open = true; e._open = { ...(e._open || {}), 'id:sek-planter': true }; e._render && e._render();
  await new Promise((r) => setTimeout(r, 200));
  let got = null; e.addEventListener('config-changed', (ev) => { got = ev.detail.config; });
  const b = e.shadowRoot.querySelector('[data-a="hid"][data-name="planter.sted"]'); if (b) b.click();
  await new Promise((r) => setTimeout(r, 900));
  const out = { chip: b && b.textContent, sted: got && got.planter && got.planter.sted }; e.remove(); return out;
});
ok('17.9 GUI-editor: stedsvelger (flervalg) lagrer planter.sted', ed.chip === 'Hjemme' && Array.isArray(ed.sted) && ed.sted[0] === 'sensor.hjemme_planter_trenger_vann', ed);

/* ---------------- 17.8 · ikonvelger */
await page.evaluate(() => { window.__ip = MSH.iconPicker.open({ value: 'mdi:bus' }); });
await wait(400);
const ip = await page.evaluate(() => { const r = window.__ip.sheet.root; return { chips: [...r.querySelectorAll('.chip')].map((c) => c.textContent), on: (r.querySelector('.chip.on') || {}).textContent, cell: (() => { const c = r.querySelector('.ic'); return c ? Math.round(c.getBoundingClientRect().width) : 0; })(), manl: (r.querySelector('.manl') || {}).textContent, man: !!r.querySelector('.man:not([hidden]) .mi') }; });
ok('17.8 ikonvelger: faner (MDI først, Alle sist), MDI valgt', ip.chips[0] === 'MDI' && ip.chips[ip.chips.length - 1] === 'Alle' && ip.on === 'MDI', ip);
ok('17.8 ikonvelger: 48 px-ruter', ip.cell === 48, ip.cell);
ok('17.8 ikonvelger: «Skriv inn selv» alltid synlig', ip.manl === 'Skriv inn selv' && ip.man, ip);
const pv = await page.evaluate(async () => { const r = window.__ip.sheet.root, i = r.querySelector('.mi'); i.value = 'phu:tesla'; i.dispatchEvent(new Event('input')); await new Promise((q) => setTimeout(q, 50)); return r.querySelector('.man .pv ha-icon').getAttribute('icon'); });
ok('17.8 ikonvelger: live forhåndsvisning av egen verdi', pv === 'phu:tesla', pv);
if (SHOTS) await page.screenshot({ path: SHOTS + '/ikonvelger.png' });
await page.evaluate(() => { window.__ip.sheet.root.querySelector('[data-p="manok"]').click(); });
const ipv = await page.evaluate(() => window.__ip);
await wait(150);
const rec = await page.evaluate(() => MSH.iconPicker.recent());
ok('17.8 ikonvelger: egen verdi lagres + «Nylig brukt» (maks 12)', rec[0] === 'phu:tesla' && rec.length <= 12, rec);

/* ---------------- 17.8 · popup-velger */
await page.evaluate(() => { window.__pv = null; window.__pp = MSH.popupPicker.open({ value: '#ruter', onPick: (v) => { window.__pv = v; } }); });
await wait(200);
const pp = await page.evaluate(() => { const r = window.__pp.sheet.root; return { groups: [...r.querySelectorAll('.sc .lb')].map((x) => x.textContent), rows: r.querySelectorAll('.pr').length, on: (r.querySelector('.pr.on .h') || {}).textContent, own: !!r.querySelector('.oh'), test: !!r.querySelector('[data-p="test"]') }; });
ok('17.8 popup-velger: grupper Rom · Funksjoner, rader med #hash, valgt markert', pp.groups[0] === 'Rom' && pp.groups.includes('Funksjoner') && pp.rows > 5 && pp.on === '#ruter' && pp.own && pp.test, pp);
if (SHOTS) await page.screenshot({ path: SHOTS + '/popupvelger.png' });
const warn = await page.evaluate(async () => { const r = window.__pp.sheet.root, i = r.querySelector('.oh'); i.value = 'tesla'; i.dispatchEvent(new Event('input')); await new Promise((q) => setTimeout(q, 30)); const w = r.querySelector('.wr').textContent; r.querySelector('[data-p="own"]').click(); return w; });
await wait(100);
ok('17.8 popup-velger: egen hash med advarsel, lagres likevel', /finnes ikke i dette dashbordet/.test(warn) && (await page.evaluate(() => window.__pv)) === '#tesla', { warn, v: await page.evaluate(() => window.__pv) });
// felt i msh-editor (inline) → msh-popup-field; velg fra listen → config
const fe = await page.evaluate(async () => {
  const e = document.createElement('msh-editor'); e.cardClass = customElements.get('msh-soppel-card'); e.inline = true; e.hass = H; e.setConfig({ type: 'custom:msh-soppel-card', popup_hash: '#soppel' });
  document.body.appendChild(e); await new Promise((r) => setTimeout(r, 200));
  const f = e.shadowRoot.querySelector('msh-popup-field[data-name="popup_hash"]');
  const shown = f && f.shadowRoot.textContent;
  f.shadowRoot.querySelector('[data-p="open"]').click(); await new Promise((r) => setTimeout(r, 200));
  const hosts = MSH.portals();
  const sh = hosts[hosts.length - 1].shadowRoot; sh.querySelector('.pr[data-v="#vaer"]').click(); await new Promise((r) => setTimeout(r, 200));
  const out = { shown, cfg: e._config.popup_hash, attr: f.getAttribute('value') }; e.remove(); return out;
});
ok('17.8 editor-felt «hash» → popup-felt (ikon, navn, #hash) og valg lagres', fe.shown && /#soppel/.test(fe.shown) && fe.cfg === '#vaer', fe);
// tap-velgeren: Popup-modus åpner arket, Test-knapp
const tp = await page.evaluate(async () => {
  const d = document.createElement('div'); d.innerHTML = MSH.tap.html({ value: { action: 'navigate', navigation_path: '#lys' }, modes: ['popup', 'hash', 'path', 'more'] }); document.body.appendChild(d);
  const el = d.firstElementChild; await new Promise((r) => setTimeout(r, 100));
  const test = !!el.shadowRoot.querySelector('[data-p="test"]');
  let v = null; el.addEventListener('value-changed', (e) => { if (!v) v = e.detail.value; });
  el.shadowRoot.querySelector('[data-p="open"]').click(); await new Promise((r) => setTimeout(r, 200));
  const hosts = MSH.portals();
  const sh = hosts[hosts.length - 1].shadowRoot; sh.querySelector('.pr[data-v="#klima"]').click(); await new Promise((r) => setTimeout(r, 200));
  // More-info → entitet-velger
  el.shadowRoot.querySelector('[data-p="mode"][data-v="more"]').click(); await new Promise((r) => setTimeout(r, 100));
  const ent = !!el.shadowRoot.querySelector('msh-entity-picker');
  el.shadowRoot.querySelector('[data-p="mode"][data-v="path"]').click(); await new Promise((r) => setTimeout(r, 100));
  const dl = !!el.shadowRoot.querySelector('datalist#tp-views');
  d.remove(); return { test, v, ent, dl };
});
ok('17.8 handlingsvalg: Popup → arket, Test-knapp; More-info → entitet-velger; Sti → forslag', tp.test && tp.v && tp.v.navigation_path === '#klima' && tp.ent && tp.dl, tp);

await wait(100);
const bad = errs.filter((e) => !/favicon|ERR_FILE_NOT_FOUND|net::|seb\.jpg|Failed to load resource/.test(e));
ok('ingen JS-feil', bad.length === 0, bad.slice(0, 5));
await browser.close();
try { unlinkSync(bundle); } catch (e) { /* */ }
globalThis.__done = 1; console.log(res.join('\n'));
const fail = res.filter((r) => r.startsWith('✘')).length;
console.log(fail ? `\n${fail} feil` : '\nAlt OK');
process.exit(fail ? 1 : 0);
