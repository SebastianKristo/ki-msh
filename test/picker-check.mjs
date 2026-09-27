// Systemets velgere (fiks-4 4.5, src/09-pickers.js): trykk på verdien fokuserer riktig native felt, valg og −/+ skriver
// riktig tjeneste, ingen re-render mens feltet har fokus, Utelys-arket (lokal modus) og editorens «stepper»-felt.
// Kjør: node test/picker-check.mjs
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { readdirSync, mkdirSync, unlinkSync } from 'node:fs';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const R = resolve('.') + '/';
mkdirSync('test/.build', { recursive: true });
const bundle = resolve(`test/.build/picker-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle], { cwd: R, stdio: 'inherit' });
const mocks = readdirSync(R + 'test/mock').filter((f) => f.endsWith('.js')).sort().map((f) => R + 'test/mock/' + f);
const browser = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const res = [];
const ok = (name, cond, info) => { res.push(`${cond ? '✔' : '✘'} ${name}${info != null ? ' · ' + JSON.stringify(info) : ''}`); };
for (const touch of [false, true]) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: touch });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('file://' + R + 'test/harness-bubble.html');
  for (const m of mocks) await page.addScriptTag({ path: m });
  await page.addScriptTag({ path: bundle });
  await page.evaluate(async () => {
    window.H = window.mockHass();
    const el = document.createElement('msh-vanning-card');
    el.setConfig({ type: 'custom:msh-vanning-card', tabs: ['prog'] }); el.hass = H;
    document.getElementById('dash').appendChild(el);
    window.V = el;
    await new Promise((r) => setTimeout(r, 400));
  });
  const sel = (id) => `msh-vanning-card .msh-stp[data-stp="${id}"]`;
  const T = touch ? 'touch' : 'mus';
  const n = await page.locator('msh-vanning-card .msh-stp-row').count();
  ok(`[${T}] Vanning: steppere i Program`, n === 4, n);
  // trykk på verdien fokuserer riktig native felt
  for (const [id, tag, type] of [['number.vanning_regnpause', 'SELECT', ''], ['time.vanning_start', 'INPUT', 'time'], ['input_datetime.vanning_neste', 'INPUT', 'datetime-local'], ['input_number.vanning_kjoretid', 'SELECT', '']]) {
    const box = await page.locator(sel(id) + ' .msh-stp-v').boundingBox();
    await page.locator(sel(id) + ' .msh-stp-v').scrollIntoViewIfNeeded();
    const b2 = await page.locator(sel(id) + ' .msh-stp-v').boundingBox();
    if (touch) await page.touchscreen.tap(b2.x + b2.width / 2, b2.y + b2.height / 2); else await page.mouse.click(b2.x + b2.width / 2, b2.y + b2.height / 2);
    await page.waitForTimeout(80);
    const a = await page.evaluate((id) => { const a = V.shadowRoot.activeElement; return a && { tag: a.tagName, type: a.type, ent: a.closest('.msh-stp').dataset.stp, flag: V._pickerFocus }; }, id);
    ok(`[${T}] trykk på verdi fokuserer ${id}`, a && a.tag === tag && (!type || a.type === type) && a.ent === id && a.flag === true, a);
    if (touch) await page.keyboard.press('Escape');
    await page.evaluate(() => { V.shadowRoot.activeElement && V.shadowRoot.activeElement.blur(); });
    await page.waitForTimeout(50);
  }
  // ingen re-render mens feltet har fokus
  const rr = await page.evaluate(async () => {
    let n = 0; const orig = V.render.bind(V); V.render = () => { n++; return orig(); };
    const s = V.shadowRoot.querySelector('.msh-stp[data-stp="number.vanning_regnpause"] select'); s.focus();
    const h2 = { ...H, states: { ...H.states, 'number.vanning_regnpause': { ...H.states['number.vanning_regnpause'], state: '48' } } };
    V.hass = h2; V.setUI({ x: 1 });
    await new Promise((r) => setTimeout(r, 150));
    const during = n, txtDuring = s.closest('.msh-stp').querySelector('.msh-stp-t').textContent;
    s.blur();
    await new Promise((r) => setTimeout(r, 150));
    const txtAfter = V.shadowRoot.querySelector('.msh-stp[data-stp="number.vanning_regnpause"] .msh-stp-t').textContent;
    V.hass = H; await new Promise((r) => setTimeout(r, 100));
    return { during, after: n, txtDuring, txtAfter };
  });
  ok(`[${T}] ingen render mens fokus, render etter blur`, rr.during === 0 && rr.after >= 1 && rr.txtAfter === '48 h', rr);
  // valg skriver riktig tjeneste
  const calls = async () => page.evaluate(() => { const c = window.__calls.filter((x) => x[0] !== 'ws').map((x) => [x[0], x[1], x[2]]); window.__calls.length = 0; return c; });
  await calls();
  await page.locator(sel('number.vanning_regnpause') + ' select').selectOption('30');
  let c = await calls(); ok(`[${T}] select → number.set_value`, JSON.stringify(c) === JSON.stringify([['number', 'set_value', { entity_id: 'number.vanning_regnpause', value: 30 }]]), c);
  await page.locator(sel('input_number.vanning_kjoretid') + ' select').selectOption('20.5');
  c = await calls(); ok(`[${T}] select → input_number.set_value`, c.length === 1 && c[0][0] === 'input_number' && c[0][2].value === 20.5, c);
  await page.locator(sel('time.vanning_start') + ' input').fill('07:45');
  c = await calls(); ok(`[${T}] time → time.set_value`, c.length === 1 && c[0][0] === 'time' && c[0][1] === 'set_value' && c[0][2].time === '07:45:00', c);
  await page.locator(sel('input_datetime.vanning_neste') + ' input').fill('2026-10-03T07:00');
  c = await calls(); ok(`[${T}] datetime-local → input_datetime.set_datetime`, c.length === 1 && c[0][1] === 'set_datetime' && c[0][2].datetime === '2026-10-03 07:00:00', c);
  await page.evaluate(() => { V.shadowRoot.activeElement && V.shadowRoot.activeElement.blur(); });
  await page.waitForTimeout(2100); // optimistisk verdi utløper
  await page.evaluate(async () => { V.update(); await new Promise((r) => setTimeout(r, 100)); });
  // −/+
  let hp = 0; await page.exposeFunction('hp' + (touch ? 1 : 0), () => { hp++; });
  await page.evaluate((f) => window.addEventListener('haptic', () => window[f]()), 'hp' + (touch ? 1 : 0));
  const tap = async (s) => { const l = page.locator(s); await l.scrollIntoViewIfNeeded(); if (touch) await l.tap(); else await l.click(); await page.waitForTimeout(60); };
  await tap(sel('input_number.vanning_kjoretid') + ' [data-stp-d="1"]');
  c = await calls(); ok(`[${T}] + → input_number.set_value 13`, c.length === 1 && c[0][2].value === 13, c);
  await tap(sel('time.vanning_start') + ' [data-stp-d="-1"]');
  c = await calls(); ok(`[${T}] − → time.set_value 05:15:00`, c.length === 1 && c[0][2].time === '05:15:00', c);
  await tap(sel('number.vanning_regnpause') + ' [data-stp-d="-1"]');
  await tap(sel('number.vanning_regnpause') + ' [data-stp-d="-1"]');
  c = await calls(); ok(`[${T}] − − → 23 så 22 (optimistisk)`, c.length === 2 && c[0][2].value === 23 && c[1][2].value === 22, c);
  ok(`[${T}] haptic på −/+`, hp >= 3, hp);
  // Lys · Utelys-arket (lokal modus → config)
  const lys = await page.evaluate(async () => {
    const el = document.createElement('msh-lys-card'); el.setConfig({ type: 'custom:msh-lys-card', card_id: 'lys1' }); el.hass = H;
    document.getElementById('dash').appendChild(el); window.L = el;
    await new Promise((r) => setTimeout(r, 300));
    el.customize();
    await new Promise((r) => setTimeout(r, 300));
    const root = el._sheet.ov.root;
    root.querySelector('[data-a="page"][data-p="out"]').click();
    await new Promise((r) => setTimeout(r, 100));
    return { rows: root.querySelectorAll('.msh-stp-row').length, labels: [...root.querySelectorAll('.msh-stp-row .msh-stp-t')].map((x) => x.textContent) };
  });
  ok(`[${T}] Utelys: 7 steppere`, lys.rows === 7, lys);
  const lysR = await page.evaluate(async () => {
    const root = L._sheet.ov.root, st = L._sheet.st;
    const w = (f) => root.querySelector(`.msh-stp [data-f="${f}"]`).closest('.msh-stp');
    w('outdoor.lux_on').querySelector('[data-stp-d="1"]').click();
    await new Promise((r) => setTimeout(r, 50));
    w('outdoor.morning').querySelector('[data-stp-d="-1"]').click();
    await new Promise((r) => setTimeout(r, 50));
    return { lux: st.draft.outdoor && st.draft.outdoor.lux_on, morning: st.draft.outdoor && st.draft.outdoor.morning };
  });
  ok(`[${T}] Utelys −/+ → utkast (lux 45, morgen 05:45)`, lysR.lux === 45 && lysR.morning === '05:45', lysR);
  const selOff = page.locator('.msh-portal .msh-stp select[data-f="outdoor.offset"]');
  await selOff.selectOption('-30');
  const tOn = page.locator('.msh-portal .msh-stp input[data-f="outdoor.on"]');
  await tOn.fill('20:15');
  const lysN = await page.evaluate(() => { const d = L._sheet.st.draft.outdoor; return { offset: d.offset, on: d.on }; });
  ok(`[${T}] Utelys native velger → utkast`, lysN.offset === -30 && lysN.on === '20:15', lysN);
  // Editor: type 'stepper'
  const ed = await page.evaluate(async () => {
    await new Promise((r) => setTimeout(r, 2100));
    const e = document.createElement('msh-editor');
    e.cardClass = class { static get schema() { return [{ type: 'stepper', entity: 'number.vanning_regnpause', label: 'Regnpause' }, { type: 'stepper', entity: 'number.finnes_ikke', label: 'Mangler' }]; } };
    e.hass = H; e.setConfig({ type: 'custom:x' }); document.body.appendChild(e); window.E = e;
    await new Promise((r) => setTimeout(r, 100));
    window.__calls.length = 0;
    e.shadowRoot.querySelector('.msh-stp [data-stp-d="1"]').click();
    await new Promise((r) => setTimeout(r, 50));
    const miss = e.shadowRoot.querySelectorAll('.msh-stp')[1];
    return { calls: window.__calls.map((x) => [x[0], x[1], x[2].value]), missTxt: miss.querySelector('.msh-stp-t').textContent, missDis: miss.querySelector('button').disabled, missField: !!miss.querySelector('.msh-stp-n') };
  });
  ok(`[${T}] Editor stepper + → number.set_value 25, mangler → «–» deaktivert`, ed.calls.length === 1 && ed.calls[0][2] === 25 && ed.missTxt === '–' && ed.missDis && !ed.missField, ed);
  ok(`[${T}] ingen sidefeil`, !errs.length, errs);
  await page.close();
}
await browser.close();
try { unlinkSync(bundle); } catch (e) { /* */ }
console.log(res.join('\n'));
process.exit(res.some((r) => r.startsWith('✘')) ? 1 : 0);
