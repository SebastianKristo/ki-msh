// Fiks 24.8 · Tesla (#tesla, msh-tesla-card): bilscenen som toppkort (msh-tesla-scene, tap none), hurtigknapper med
// bekreftelse, faner + tannhjul, Lading (dra ladegrense uten at popupen lukkes), Kjøring, Sparing, «Tilpass Tesla»
// (live forhåndsvisning, dra-og-slipp, lakk) ↔ GUI-editor, autofunn og popup-vilkåret.
//   node test/tesla-check.mjs   (SHOTS=<mappe> for skjermbilder)
import { createRequire } from 'node:module';
import { readdirSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
mkdirSync('test/.build', { recursive: true });
const bundle = resolve(`test/.build/tesla-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const shots = process.env.SHOTS || '';
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const res = {}, fail = [];
const ok = (name, cond, info) => { res[name] = cond ? 'OK' : ['FEIL', info]; if (!cond) fail.push(name); };
const mocks = readdirSync('test/mock').sort().map((m) => resolve('test/mock/' + m));
const errs = [];
async function page(cfg, vp) {
  const p = await b.newPage({ viewport: vp || { width: 400, height: 900 }, hasTouch: true });
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + resolve('test/harness.html'));
  for (const m of mocks) await p.addScriptTag({ path: m });
  await p.addScriptTag({ path: bundle });
  await p.evaluate(async (cfg) => {
    window.__h = window.mockHass();
    const bc = document.createElement('bubble-card');
    bc.setConfig({ type: 'custom:bubble-card', card_type: 'pop-up', hash: '#tesla' });
    bc.innerHTML = '<div class="pop"><div class="hdr">Tesla Model Y</div><div class="inner"></div></div>';
    document.getElementById('dash').appendChild(bc);
    location.hash = '#tesla';
    const c = document.createElement('msh-tesla-card');
    c.setConfig({ type: 'custom:msh-tesla-card', card_id: 'pop-tesla', ...(cfg || {}) });
    c.hass = window.__h;
    bc.querySelector('.inner').appendChild(c);
    window.__c = c;
    window.__hp = []; window.addEventListener('haptic', (e) => window.__hp.push(e.detail));
    await new Promise((q) => setTimeout(q, 800));
  }, cfg || {});
  return p;
}
const wait = (p, ms) => p.evaluate((ms) => new Promise((q) => setTimeout(q, ms)), ms);
const shot = async (p, n) => { if (shots) await p.screenshot({ path: `${shots}/tesla-${n}.png`, fullPage: true }); };
const tab = async (p, k) => { await p.evaluate((k) => window.__c.shadowRoot.querySelector(`.tabs [data-v="${k}"]`).click(), k); await wait(p, 400); };

const p = await page();
// ---------------------------------------------------------------- autofunn
const A = await p.evaluate(() => window.MSH.teslaAuto(window.__h, {}));
ok('Autofunn: batteri, rekkevidde, ladegrense, lås, tut, frunk/bagasje, lader, KI Tesla og KI Drivstoff', A.battery === 'sensor.tesla_model_y_batteri_batteriniva' && A.range === 'sensor.tesla_model_y_batteri_estimert_batterirekkevidde' && A.charge_limit === 'input_number.tesla_model_y_ladegrense' && A.lock === 'switch.tesla_model_y_car_doors_locked' && A.honk === 'button.folkevogn_honk_horn' && A.frunk === 'switch.tesla_model_y_car_trunk_front' && A.trunk === 'switch.tesla_model_y_car_trunk_rear' && A.charger === 'switch.elbillader_charging' && A.time_left === 'sensor.ki_tesla_ladetid_gjenstaende' && A.cost_ev === 'sensor.ki_drivstoff_kostnad_per_mil_tesla_model_y' && A.cost_diesel === 'sensor.ki_drivstoff_kostnad_per_mil_audi_a6_avant_2011' && A.daily === 'sensor.tesla_model_y_daglig_kjoring' && A.climate === null, A);
const has = await p.evaluate(() => { const M = window.MSH, h = window.mockHass(); const a = M.teslaHas(h); const h2 = window.mockHass(); const S = {}; Object.keys(h2.states).filter((id) => !/tesla|folkevogn|ki_drivstoff|elbillader/.test(id)).forEach((id) => { S[id] = h2.states[id]; }); return { a, b: M.teslaHas({ ...h2, states: S }), needs: !!M.popupNeeds['#tesla'], fn: M.FUNCTION_POPUPS.some((f) => f[0] === '#tesla' && f[3] === 'msh-tesla-card') }; });
ok('Popup-vilkår: #tesla bare når Tesla-entiteter finnes (FUNCTION_POPUPS + popupNeeds)', has.a && !has.b && has.needs && has.fn, has);

// ---------------------------------------------------------------- toppkort: bilscenen
const T = await p.evaluate(() => {
  const sr = window.__c.shadowRoot, sc = sr.querySelector('.scene-slot msh-tesla-scene'), tc = sc && sc.shadowRoot.querySelector('.tc');
  const r = tc && tc.getBoundingClientRect();
  return { first: sr.querySelector('.wrap').firstElementChild.classList.contains('scene-slot'), has: !!tc, h: r && Math.round(r.height), w: r && Math.round(r.width), cw: Math.round(window.__c.getBoundingClientRect().width), rad: tc && getComputedStyle(tc).borderRadius, cls: tc && [...tc.classList], pille: tc && sc.shadowRoot.querySelector('.pt').textContent, stor: tc && sc.shadowRoot.querySelector('.stor').textContent, lakk: tc && tc.style.getPropertyValue('--lakk'), tap: sc && sc._c.tap_action };
});
ok('Toppkort: msh-tesla-scene først, 180 px, r28, full bredde', T.first && T.has && T.h === 180 && T.rad === '28px' && T.w === T.cw, T);
ok('Bilscenen animerer: lader, bagasjerom åpent, defrost (klasser fra popupens entiteter)', T.cls.includes('lader') && T.cls.includes('bak-apen') && T.cls.includes('defrost') && T.cls.includes('ulast') && T.stor === '64%', T);
ok('Bilscenen: tap_action none, lakk fra config', T.tap && T.tap.action === 'none' && T.lakk === '#7b92ac', T);
const tapScene = await p.evaluate(async () => { const h0 = location.hash; const sc = window.__c.shadowRoot.querySelector('msh-tesla-scene'); window.__calls.length = 0; sc.shadowRoot.querySelector('.tc').click(); await new Promise((q) => setTimeout(q, 200)); return { hash: location.hash === h0, calls: window.__calls.length }; });
ok('Trykk på bilscenen gjør ingenting (tap none)', tapScene.hash && tapScene.calls === 0, tapScene);
await shot(p, '1-lading');

// ---------------------------------------------------------------- hurtigknapper
const Q = await p.evaluate(() => { const sr = window.__c.shadowRoot; return [...sr.querySelectorAll('.qbtn')].map((b) => { const r = b.getBoundingClientRect(); return { k: b.dataset.v, cls: b.className, w: Math.round(r.width), h: Math.round(r.height), rad: getComputedStyle(b).borderRadius, ent: b.dataset.ent || '' }; }); });
ok('Hurtigknapper: 5 kvadratiske, r24', Q.length === 5 && Q.every((x) => Math.abs(x.w - x.h) <= 1 && x.rad === '24px'), Q);
ok('Lås oransje + rist (ulåst, lås omvendt), Defrost rosa + pust, Bagasje rosa (åpen), Frunk normal', /warn/.test(Q[0].cls) && /shake/.test(Q[0].cls) && /pink/.test(Q[2].cls) && /breathe/.test(Q[2].cls) && /pink/.test(Q[4].cls) && !/pink/.test(Q[3].cls), Q);
// Lås: bekreftelse (standard på) → Lås → switch toggle
const lk = await p.evaluate(async () => {
  window.__calls.length = 0;
  window.__c.shadowRoot.querySelector('.qbtn[data-v="lock"]').click(); await new Promise((q) => setTimeout(q, 300));
  const portal = window.MSH.portals().pop(); const cf = portal && portal.shadowRoot.querySelector('.cf');
  const txt = cf && cf.textContent.replace(/\s+/g, ' ').trim(), before = window.__calls.length;
  portal.shadowRoot.querySelector('[data-k="ok"]').click(); await new Promise((q) => setTimeout(q, 300));
  return { txt, before, calls: window.__calls.slice(), inPop: !!(portal && portal.closest('.pop')) };
});
ok('Lås: bekreftelsesdialog (portalt) «Låse bilen?» → først etter OK kalles tjenesten', /Låse bilen\?/.test(lk.txt) && lk.before === 0 && lk.calls.some((c) => c[0] === 'homeassistant' && c[2].entity_id === 'switch.tesla_model_y_car_doors_locked') && !lk.inPop, lk);
const honk = await p.evaluate(async () => { window.__calls.length = 0; window.__hp.length = 0; window.__c.shadowRoot.querySelector('.qbtn[data-v="honk"]').click(); await new Promise((q) => setTimeout(q, 200)); return { calls: window.__calls.slice(), hp: window.__hp.slice() }; });
ok('Tut: button.press uten bekreftelse, én haptic', honk.calls.some((c) => c[0] === 'button' && c[1] === 'press' && c[2].entity_id === 'button.folkevogn_honk_horn') && honk.hp.length === 1, honk);
// hold → more-info
const hold = await p.evaluate(async () => {
  let mi = null; window.addEventListener('hass-more-info', (e) => { mi = e.detail.entityId; });
  const b = window.__c.shadowRoot.querySelector('.qbtn[data-v="frunk"]'), r = b.getBoundingClientRect(), o = { bubbles: true, composed: true, clientX: r.left + 10, clientY: r.top + 10, pointerId: 3, pointerType: 'touch' };
  b.dispatchEvent(new PointerEvent('pointerdown', o)); await new Promise((q) => setTimeout(q, 650)); b.dispatchEvent(new PointerEvent('pointerup', o)); await new Promise((q) => setTimeout(q, 100));
  return mi;
});
ok('Hold på knapp → more-info', hold === 'switch.tesla_model_y_car_trunk_front', hold);

// ---------------------------------------------------------------- faner + tannhjul
const F = await p.evaluate(() => { const sr = window.__c.shadowRoot, g = sr.querySelector('.trow .gear'), r = g.getBoundingClientRect(); return { tabs: [...sr.querySelectorAll('.tabs .tab')].map((t) => t.textContent.trim()), on: sr.querySelector('.tabs .tab.on').textContent.trim(), gear: [Math.round(r.width), Math.round(r.height)], same: sr.querySelector('.trow').contains(sr.querySelector('.tabs')) }; });
ok('Faner Lading/Kjøring/Sparing + 48 px tannhjul i samme rad', F.tabs.join('|') === 'Lading|Kjøring|Sparing' && F.on === 'Lading' && F.gear.join('x') === '48x48' && F.same, F);

// ---------------------------------------------------------------- Lading
const L = await p.evaluate(() => { const sr = window.__c.shadowRoot, lim = sr.querySelector('.lim'); return { st: sr.querySelector('.cs').textContent.replace(/\s+/g, ' ').trim(), ss: sr.querySelector('.ss') && sr.querySelector('.ss').textContent.trim(), lv: sr.querySelector('.lv').textContent, ta: getComputedStyle(lim).touchAction, chips: [...sr.querySelectorAll('.lchip')].map((c) => c.textContent + (c.classList.contains('on') ? '*' : '')), sum: [...sr.querySelectorAll('.sum .st')].map((s) => s.textContent.replace(/\s+/g, ' ').trim()), bars: sr.querySelectorAll('.pb i').length, cheap: sr.querySelectorAll('.pb i.c').length }; });
ok('Lading: status «Lader» + 7,4 kW + Stopp', /Lader/.test(L.st) && /7,4\s*kW/.test(L.st) && L.ss === 'Stopp', L);
ok('Ladegrense: 80 %, touch-action none, knapper 50/60/70/80/100 med 80 aktiv', L.lv === '80 %' && L.ta === 'none' && L.chips.join() === '50 %,60 %,70 %,80 %*,100 %', L);
ok('Oppsummering: tid til grense · pris · sist lading', /1 t 35 m/.test(L.sum[0]) && /38 kr/.test(L.sum[1]) && /112 kr/.test(L.sum[2]), L.sum);
ok('Smartlading: timepriser med billigste timer uthevet', L.bars > 0 && L.cheap >= 1 && L.cheap < L.bars, L);
// dra ladegrensen: popupen skal ikke få touch/pointer (stopPropagation), verdi 95 → input_number.set_value
const drag = await p.evaluate(async () => {
  const sr = window.__c.shadowRoot, lim = sr.querySelector('.lim'), r = lim.getBoundingClientRect();
  let leaked = 0; const pop = document.querySelector('.pop'); const lk = () => leaked++;
  pop.addEventListener('touchmove', lk); pop.addEventListener('pointermove', lk); pop.addEventListener('pointerdown', lk);
  window.__calls.length = 0;
  const y = r.top + r.height / 2, o = (x) => ({ bubbles: true, composed: true, clientX: x, clientY: y, pointerId: 11, pointerType: 'touch' });
  const t = (x) => { const tt = new Touch({ identifier: 11, target: lim, clientX: x, clientY: y }); return new TouchEvent('touchmove', { bubbles: true, composed: true, cancelable: true, touches: [tt], targetTouches: [tt], changedTouches: [tt] }); };
  lim.dispatchEvent(new PointerEvent('pointerdown', o(r.left + r.width * 0.5)));
  for (const f of [0.6, 0.75, 0.9]) { lim.dispatchEvent(new PointerEvent('pointermove', o(r.left + r.width * f))); lim.dispatchEvent(t(r.left + r.width * f)); await new Promise((q) => setTimeout(q, 30)); }
  const mid = sr.querySelector('.lv').textContent;
  lim.dispatchEvent(new PointerEvent('pointerup', o(r.left + r.width * 0.9)));
  await new Promise((q) => setTimeout(q, 300));
  pop.removeEventListener('touchmove', lk); pop.removeEventListener('pointermove', lk); pop.removeEventListener('pointerdown', lk);
  return { leaked, mid, calls: window.__calls.slice(), lv: sr.querySelector('.lv').textContent, hash: location.hash };
});
ok('Dra ladegrense: lukker ikke popupen (ingen hendelser når popupen), set_value 95', drag.leaked === 0 && drag.hash === '#tesla' && drag.mid === '95 %' && drag.calls.some((c) => c[0] === 'input_number' && c[1] === 'set_value' && c[2].value === 95) && drag.lv === '95 %', drag);
const lchip = await p.evaluate(async () => { window.__calls.length = 0; window.__c.shadowRoot.querySelector('.lchip[data-v="60"]').click(); await new Promise((q) => setTimeout(q, 200)); return window.__calls.find((c) => c[1] === 'set_value'); });
ok('Grenseknapp 60 % → set_value 60', lchip && lchip[2].value === 60, lchip);
const stop = await p.evaluate(async () => { window.__calls.length = 0; window.__c.shadowRoot.querySelector('.ss').click(); await new Promise((q) => setTimeout(q, 200)); return window.__calls.slice(); });
ok('Start/Stopp → switch.turn_off på laderen', stop.some((c) => c[0] === 'switch' && c[1] === 'turn_off' && c[2].entity_id === 'switch.elbillader_charging'), stop);

// ---------------------------------------------------------------- Kjøring
await tab(p, 'kjoring');
await wait(p, 300);
const K = await p.evaluate(() => { const sr = window.__c.shadowRoot; return { rc: sr.querySelector('.rc').textContent.replace(/\s+/g, ' ').trim(), marker: !!sr.querySelector('.rb b'), bars: [...sr.querySelectorAll('.dbar')].map((b) => b.getAttribute('aria-label')), sel: sr.querySelector('.dc .smt').textContent.replace(/\s+/g, ' ').trim(), tiles: [...sr.querySelectorAll('.sum .st')].map((s) => s.textContent.replace(/\s+/g, ' ').trim()), ws: window.__calls.filter((c) => c[1] === 'recorder/statistics_during_period').length }; });
ok('Kjøring: rekkevidde 312 km med grensemarkør og «ved ladegrensen»', /312\s*km/.test(K.rc) && K.marker && /Ved ladegrensen/.test(K.rc), K);
ok('Kjøring: 7 søyler fra statistikk, i dag = live 23 km', K.bars.length === 7 && K.bars.some((x) => /54 km/.test(x)) && /23 km/.test(K.sel), K);
const dsel = await p.evaluate(async () => { window.__c.shadowRoot.querySelectorAll('.dbar')[3].click(); await new Promise((q) => setTimeout(q, 250)); return window.__c.shadowRoot.querySelector('.dc .smt').textContent.replace(/\s+/g, ' ').trim(); });
ok('Trykk på søyle velger dagen', /54 km/.test(dsel), dsel);
ok('Kilometerstand + snitt per dag', /48\s?213 km/.test(K.tiles[0].replace(/ /g, ' ')) && /km/.test(K.tiles[1]), K.tiles);
await shot(p, '2-kjoring');

// ---------------------------------------------------------------- Sparing
await tab(p, 'sparing');
await wait(p, 400);
const S = await p.evaluate(() => { const sr = window.__c.shadowRoot; return { pump: sr.querySelector('.pump') && sr.querySelector('.pump').textContent.replace(/\s+/g, ' ').trim(), head: sr.querySelector('.sv0').textContent.replace(/\s+/g, ' ').trim(), tiles: [...sr.querySelectorAll('.sum .st')].map((s) => s.textContent.replace(/\s+/g, ' ').trim()), scrub: sr.querySelectorAll('.scrub i').length, ta: sr.querySelector('.scrub') && getComputedStyle(sr.querySelector('.scrub')).touchAction, line: sr.querySelector('.line2').textContent.replace(/\s+/g, ' ').trim() }; });
ok('Sparing: spart måned 612 kr, diesel vs strøm, 59 % billigere', /612\s*kr/.test(S.head) && /Diesel/.test(S.head) && /Strøm/.test(S.head) && /59 %/.test(S.head), S);
ok('Sparing: kr/mil Tesla vs Audi, liter og CO₂', /5,04/.test(S.tiles[0]) && /Tesla Model Y/.test(S.tiles[0]) && /12,60/.test(S.tiles[1]) && /695/.test(S.tiles[2]) && /1\s?840/.test(S.tiles[3].replace(/ /g, ' ')), S.tiles);
ok('Sparing: 30 dager scrub (touch-action none) + prislinje', S.scrub === 30 && S.ta === 'none' && /Diesel – · Strøm 1,12 kr\/kWh/.test(S.line), S);
ok('Dieselpris mangler → oransje «Pumpepris mangler»', /Pumpepris mangler/.test(S.pump || ''), S.pump);
const fuel = await p.evaluate(async () => { window.__calls.length = 0; window.__c.shadowRoot.querySelector('.pump').click(); await new Promise((q) => setTimeout(q, 200)); return window.__calls.slice(); });
ok('Trykk → ki_drivstoff.hent_pris', fuel.some((c) => c[0] === 'ki_drivstoff' && c[1] === 'hent_pris'), fuel);
const yr = await p.evaluate(async () => { window.__c.shadowRoot.querySelector('.sg[data-v="aar"]').click(); await new Promise((q) => setTimeout(q, 250)); return window.__c.shadowRoot.querySelector('.sv0').textContent.replace(/\s+/g, ' ').trim(); });
ok('Segment År → spart i år', /8\s?450/.test(yr.replace(/ /g, ' ')) && /i år/.test(yr), yr);
const scr = await p.evaluate(async () => {
  const el = window.__c.shadowRoot.querySelector('.scrub'), r = el.getBoundingClientRect(); let leaked = 0; const pop = document.querySelector('.pop'), lk = () => leaked++; pop.addEventListener('pointermove', lk);
  const o = (x) => ({ bubbles: true, composed: true, clientX: x, clientY: r.top + 20, pointerId: 12, pointerType: 'touch' });
  el.dispatchEvent(new PointerEvent('pointerdown', o(r.left + 5))); await new Promise((q) => setTimeout(q, 60));
  el.dispatchEvent(new PointerEvent('pointermove', o(r.left + r.width * 0.5))); await new Promise((q) => setTimeout(q, 80));
  el.dispatchEvent(new PointerEvent('pointerup', o(r.left + r.width * 0.5))); await new Promise((q) => setTimeout(q, 120));
  pop.removeEventListener('pointermove', lk);
  return { sd: window.__c.ui.sd, leaked };
});
ok('Scrub i «spart per dag» velger dag uten å slippe til popupen', scr.sd >= 13 && scr.sd <= 16 && scr.leaked === 0, scr);
await shot(p, '3-sparing');

// ---------------------------------------------------------------- «Tilpass Tesla» (tannhjul)
await tab(p, 'lading');
const E1 = await p.evaluate(async () => {
  window.__c.shadowRoot.querySelector('.trow .gear').click(); await new Promise((q) => setTimeout(q, 500));
  const portal = window.MSH.portals().pop(), ed = portal && portal.shadowRoot.querySelector('msh-editor');
  return ed ? { title: ed.shadowRoot.querySelector('.ttl .tt').textContent, tabs: [...ed.shadowRoot.querySelectorAll('.chips.tabs [role="tab"]')].map((t) => t.getAttribute('aria-label') || t.textContent.trim()), inPop: !!portal.closest('.pop') } : null;
});
ok('Tannhjul → «Tilpass · Tesla» (portalt) med Bil/Faner/Entiteter/Avansert', E1 && E1.title === 'Tilpass · Tesla' && E1.tabs.join('|') === 'Bil|Faner|Entiteter|Avansert' && !E1.inPop, E1);
// Bil: lakk-swatch + skjul Tut → kortet oppdateres straks
const E2 = await p.evaluate(async () => {
  const ed = window.MSH.portals().pop().shadowRoot.querySelector('msh-editor'), R = ed.shadowRoot;
  R.querySelector('[data-op="paint"][data-v="#a3161f"]').click(); await new Promise((q) => setTimeout(q, 250));
  const names = [...R.querySelectorAll('[data-name]')].map((x) => x.dataset.name);
  // Hurtigknapper → Tut → «Vis knappen»
  const sw = R.querySelector('[data-a="bool"][data-name="buttons.honk.show"]'); sw.click(); await new Promise((q) => setTimeout(q, 300));
  const sc = window.__c.shadowRoot.querySelector('msh-tesla-scene').shadowRoot.querySelector('.tc');
  return { names, lakk: sc.style.getPropertyValue('--lakk'), btns: [...window.__c.shadowRoot.querySelectorAll('.qbtn')].map((b) => b.dataset.v), draft: ed._config };
});
ok('Bil: navn, lakk-swatcher, egen hex, kapasitet + per knapp vis/entitet/bekreftelse', ['name', 'paint', 'capacity', 'button_text', 'buttons.lock.entity', 'buttons.honk.confirm'].every((n) => E2.names.includes(n)), E2.names);
ok('Lakk og skjult Tut oppdateres straks i popupen (live utkast)', E2.lakk === '#a3161f' && E2.btns.join() === 'lock,defrost,frunk,trunk', E2);
// Faner: forhåndsvisning + dra Sparing øverst + skjul Kjøring + Kontur
const E3 = await p.evaluate(async () => {
  const ed = window.MSH.portals().pop().shadowRoot.querySelector('msh-editor'), R = ed.shadowRoot;
  [...R.querySelectorAll('[data-a="tab"]')].find((t) => t.dataset.v === 'faner').click(); await new Promise((q) => setTimeout(q, 200));
  const prev0 = [...R.querySelectorAll('.tsp .tab')].map((t) => t.textContent.trim());
  const gear = !!R.querySelector('.tsp .gear');
  const row = (k) => R.querySelector(`[data-tdk="${k}"]`), hd = row('sparing').querySelector('[data-tdrag]');
  const r = hd.getBoundingClientRect(), x = r.left + r.width / 2; let y = r.top + r.height / 2;
  const hp = []; const on = (e) => hp.push(e.detail); window.addEventListener('haptic', on);
  const o = (yy) => ({ bubbles: true, composed: true, clientX: x, clientY: yy, pointerId: 21, pointerType: 'touch' });
  hd.dispatchEvent(new PointerEvent('pointerdown', o(y)));
  const flag = window.__tabReorder;
  for (let i = 1; i <= 14; i++) { hd.dispatchEvent(new PointerEvent('pointermove', o(y - i * 10))); await new Promise((q) => setTimeout(q, 16)); }
  const lifted = getComputedStyle(row('sparing')).backgroundColor;
  hd.dispatchEvent(new PointerEvent('pointerup', o(y - 140))); await new Promise((q) => setTimeout(q, 250));
  window.removeEventListener('haptic', on);
  const order = ed._config.tabs && ed._config.tabs.order;
  R.querySelector('[data-tdk="kjoring"] [data-op="eye"]').click(); await new Promise((q) => setTimeout(q, 200));
  [...R.querySelectorAll('[data-a="sel"][data-name="tabs.style"]')].find((b) => b.dataset.v === 'outline').click(); await new Promise((q) => setTimeout(q, 200));
  const prev1 = [...R.querySelectorAll('.tsp .tab')].map((t) => t.textContent.trim());
  const card = [...window.__c.shadowRoot.querySelectorAll('.tabs .tab')].map((t) => t.textContent.trim());
  const onTab = window.__c.shadowRoot.querySelector('.tabs .tab.on');
  return { prev0, gear, flag, flagAfter: window.__tabReorder, lifted, hp, order, prev1, card, outline: onTab && onTab.getAttribute('style') };
});
ok('Faner: live forhåndsvisning (med tannhjul) øverst', E3.prev0.join('|') === 'Lading|Kjøring|Sparing' && E3.gear, E3);
ok('Faner: dra-og-slipp (håndtak, løftet #404040, medium + selection, __tabReorder) → Sparing først', E3.flag === true && E3.flagAfter === false && E3.lifted === 'rgb(64, 64, 64)' && E3.hp[0] === 'medium' && E3.hp.includes('selection') && E3.order && E3.order[0] === 'sparing', E3);
ok('Faner: skjul Kjøring + Kontur → forhåndsvisning og popup oppdateres straks', E3.prev1.join('|') === 'Sparing|Lading' && E3.card.join('|') === 'Sparing|Lading' && /inset/.test(E3.outline || ''), E3);
// Entiteter: gruppert, felles søkevelger
const E4 = await p.evaluate(async () => {
  const ed = window.MSH.portals().pop().shadowRoot.querySelector('msh-editor'), R = ed.shadowRoot;
  [...R.querySelectorAll('[data-a="tab"]')].find((t) => t.dataset.v === 'entiteter').click(); await new Promise((q) => setTimeout(q, 250));
  const pk = [...R.querySelectorAll('msh-entity-picker')];
  return { n: pk.length, names: pk.map((x) => x.dataset.name), autoBat: (pk.find((x) => x.dataset.name === 'entities.battery') || {}).getAttribute && pk.find((x) => x.dataset.name === 'entities.battery').getAttribute('auto'), secs: R.textContent.match(/Batteri og lading|Kjøring og status|Sparing/g) };
});
ok('Entiteter: tre grupper med søkevelger per felt, autoutfylt', E4.n >= 30 && E4.names.includes('entities.lock') && E4.names.includes('entities.diesel_price') && E4.autoBat === 'sensor.tesla_model_y_batteri_batteriniva' && E4.secs && E4.secs.includes('Kjøring og status'), E4);
// Ferdig → lagret
const done = await p.evaluate(async () => { const ed = window.MSH.portals().pop().shadowRoot.querySelector('msh-editor'); ed.shadowRoot.querySelector('[data-a="save"]').click(); await new Promise((q) => setTimeout(q, 900)); const c = window.__c.config; return { paint: c.paint, hid: c.tabs && c.tabs.hidden, order: c.tabs && c.tabs.order, honk: c.buttons && c.buttons.honk }; });
ok('Ferdig: config har lakk, skjult fane, rekkefølge og skjult Tut', done.paint === '#a3161f' && (done.hid || []).includes('kjoring') && done.order[0] === 'sparing' && done.honk && done.honk.show === false, done);
await shot(p, '4-etter-tilpass');
await p.close();

// ---------------------------------------------------------------- GUI-editor (getConfigElement) = samme valg
const g = await page();
const G = await g.evaluate(async () => {
  const ed = customElements.get('msh-tesla-card').getConfigElement(); ed.hass = window.mockHass(); ed.setConfig({ type: 'custom:msh-tesla-card', card_id: 'gui1' }); document.body.appendChild(ed);
  await new Promise((q) => setTimeout(q, 150));
  const R = ed.shadowRoot, tabs = [...R.querySelectorAll('.chips.tabs [role="tab"]')].map((t) => t.getAttribute('aria-label') || t.textContent.trim());
  let last = null; ed.addEventListener('config-changed', (x) => { last = x.detail.config; });
  R.querySelector('[data-op="paint"][data-v="#233f8c"]').click(); await new Promise((q) => setTimeout(q, 100));
  const paint = last && last.paint;
  const bil = [...new Set([...R.querySelectorAll('[data-name]')].map((s) => s.dataset.name))];
  [...R.querySelectorAll('[data-a="tab"]')].find((t) => t.dataset.v === 'faner').click(); await new Promise((q) => setTimeout(q, 100));
  R.querySelector('[data-tdk="sparing"] [data-op="eye"]').click(); await new Promise((q) => setTimeout(q, 100));
  const hid = last && last.tabs && last.tabs.hidden;
  const faner = [...new Set([...R.querySelectorAll('[data-name]')].map((s) => s.dataset.name))];
  const prev = !!R.querySelector('.tsp');
  [...R.querySelectorAll('[data-a="tab"]')].find((t) => t.dataset.v === 'entiteter').click(); await new Promise((q) => setTimeout(q, 100));
  const ents = [...R.querySelectorAll('ha-selector,msh-entity-picker')].map((s) => s.dataset.name);
  [...R.querySelectorAll('[data-a="tab"]')].find((t) => t.dataset.v === 'avansert').click(); await new Promise((q) => setTimeout(q, 100));
  const adv = [...new Set([...R.querySelectorAll('[data-name]')].map((s) => s.dataset.name))];
  ed.remove();
  return { tabs, paint, hid, bil, faner, prev, ents, adv };
});
ok('GUI-editor: samme faner (Bil/Faner/Entiteter/Avansert)', G.tabs.join('|') === 'Bil|Faner|Entiteter|Avansert', G.tabs);
ok('GUI-editor: lakk og skjul fane → config-changed', G.paint === '#233f8c' && (G.hid || []).includes('sparing'), G);
ok('GUI-editor: Bil (navn/lakk/kapasitet/knapper), Faner (stil/innhold/start + forhåndsvisning), Entiteter, Avansert', ['name', 'paint', 'button_text'].every((n) => G.bil.includes(n)) && ['tabs.style', 'tabs.content', 'tabs.start'].every((n) => G.faner.includes(n)) && G.prev && G.ents.includes('entities.battery') && G.ents.includes('entities.co2') && ['lock_inverted', 'confirm', 'prefix'].every((n) => G.adv.includes(n)), G);
// Samme lagring ↔ popupen: config fra GUI-editoren vises likt i kortet
const G2 = await g.evaluate(async () => { window.__c.setConfig({ type: 'custom:msh-tesla-card', card_id: 'pop-tesla', paint: '#233f8c', tabs: { hidden: ['sparing'] } }); await new Promise((q) => setTimeout(q, 300)); return { lakk: window.__c.shadowRoot.querySelector('msh-tesla-scene').shadowRoot.querySelector('.tc').style.getPropertyValue('--lakk'), tabs: [...window.__c.shadowRoot.querySelectorAll('.tabs .tab')].map((t) => t.textContent.trim()) }; });
ok('GUI-config → popupen viser samme lakk og faner', G2.lakk === '#233f8c' && G2.tabs.join('|') === 'Lading|Kjøring', G2);
// Uten entiteter: «–» + «Velg entitet», toppkortet vises likevel
const N = await g.evaluate(async () => { const h = window.mockHass(); const S = {}; Object.keys(h.states).filter((id) => !/tesla|folkevogn|ki_drivstoff|elbillader/.test(id)).forEach((id) => { S[id] = h.states[id]; }); window.__c.setConfig({ type: 'custom:msh-tesla-card', card_id: 'pop-tesla' }); window.__c.hass = { ...h, states: S }; await new Promise((q) => setTimeout(q, 300)); const sr = window.__c.shadowRoot; const tc = sr.querySelector('msh-tesla-scene').shadowRoot; return { miss: sr.querySelectorAll('.miss').length, stor: tc.querySelector('.stor').textContent, none: sr.querySelectorAll('.qbtn.none').length, pick: [...sr.querySelectorAll('.miss .pick')].map((x) => x.textContent.trim()) }; });
ok('Uten entiteter: toppkort med «--», knapper nedtonet, «– · Velg entitet»', N.stor === '--' && N.none === 5 && N.miss >= 1 && N.pick.every((x) => /Velg entitet/.test(x)), N);
// Bred skjerm (PC): fyller bredden
await g.setViewportSize({ width: 1400, height: 900 });
await wait(g, 300);
const W = await g.evaluate(() => { const c = window.__c.getBoundingClientRect(), i = document.querySelector('.pop .inner').getBoundingClientRect(); return { c: Math.round(c.width), i: Math.round(i.width - 36) }; });
ok('Fyller bredden på PC', Math.abs(W.c - W.i) <= 1, W);
await g.close();

ok('Ingen sidefeil', !errs.length, errs);
await b.close();
for (const [k, v] of Object.entries(res)) console.log(v === 'OK' ? 'OK  ' : 'FEIL', k, v === 'OK' ? '' : JSON.stringify(v[1]).slice(0, 600));
console.log(fail.length ? `\n${fail.length} feil` : '\nAlle Tesla-sjekker OK');
process.exit(fail.length ? 1 : 0);
