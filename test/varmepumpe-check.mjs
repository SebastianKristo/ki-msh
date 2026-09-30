// Fiks 26.20 · Varmepumpe (#varmepumpe, msh-varmepumpe-card): autokonfig fra NIBE-enheten (mock: F730 via myUplink, parameter-ID-
// suffikser), toppkort 176 px med animert pumpe, 3 KPI-kort, hurtigknapper, faner Info · Varme · Varmtvann · Luft + tannhjul,
// akkordeonene Kostnad/Systemdrift/Strøm/Diagnostikk, −/+ (number.set_value), graf-scrub (stopPropagation), «Tilpass varmepumpe»
// (Knapper · Faner · Entiteter · Visning) ↔ GUI-editor, strategi-vilkår + POPUP_SUPERSEDE, og «–»/«Velg entitet» uten NIBE.
//   node test/varmepumpe-check.mjs   (SHOTS=<mappe> for skjermbilder)
import { createRequire } from 'node:module';
import { readdirSync, mkdirSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
mkdirSync('test/.build', { recursive: true });
const bundle = process.env.VP_BUNDLE || resolve(`test/.build/varmepumpe-${process.pid}.js`);
if (!process.env.VP_BUNDLE) execFileSync('node', ['build.mjs', bundle]);
const shots = process.env.SHOTS || '';
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const res = {}, fail = [];
const ok = (name, cond, info) => { res[name] = cond ? 'OK' : ['FEIL', info]; if (!cond) fail.push(name); };
const mocks = readdirSync('test/mock').sort().map((m) => resolve('test/mock/' + m));
const errs = [];
async function page(cfg, vp, pre) {
  const p = await b.newPage({ viewport: vp || { width: 400, height: 900 }, hasTouch: true });
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/fonts.googleapis|net::ERR/.test(m.text())) errs.push(m.text()); });
  await p.goto('file://' + resolve('test/harness.html'));
  for (const m of mocks) await p.addScriptTag({ path: m });
  if (pre) await p.evaluate(pre);
  await p.addScriptTag({ path: bundle });
  await p.evaluate(async (cfg) => {
    window.__h = window.mockHass();
    window.__haptics = [];
    window.addEventListener('haptic', (e) => window.__haptics.push(e.detail));
    const bc = document.createElement('bubble-card');
    bc.setConfig({ type: 'custom:bubble-card', card_type: 'pop-up', hash: '#varmepumpe' });
    bc.innerHTML = '<div class="pop"><div class="hdr">Varmepumpe</div><div class="inner"></div></div>';
    document.getElementById('dash').appendChild(bc);
    location.hash = '#varmepumpe';
    const c = document.createElement('msh-varmepumpe-card');
    c.setConfig({ type: 'custom:msh-varmepumpe-card', card_id: 'varmepumpe', ...(cfg || {}) });
    c.hass = window.__h;
    bc.querySelector('.inner').appendChild(c);
    window.__c = c;
    await new Promise((q) => setTimeout(q, 900));
  }, cfg);
  return p;
}
const wait = (p, ms) => p.evaluate((ms) => new Promise((q) => setTimeout(q, ms)), ms);
const shot = async (p, n) => { if (shots) await p.screenshot({ path: `${shots}/varmepumpe-${n}.png`, fullPage: true }); };
const state = (p) => p.evaluate(() => {
  const sr = window.__c.shadowRoot, t = (sel) => [...sr.querySelectorAll(sel)].map((e) => e.textContent.replace(/\s+/g, ' ').trim());
  const tabs = [...sr.querySelectorAll('.tabs [data-act="tab"]')];
  const top = sr.querySelector('.top');
  return {
    topH: top ? Math.round(top.getBoundingClientRect().height) : 0, kw: t('.top .tv')[0], ts: t('.top .ts')[0], chip: t('.top .chip')[0], hz: t('.top .hzt')[0],
    fan: !!sr.querySelector('.vifte.spin'), flow: sr.querySelectorAll('.ror.flow').length, tankFill: !!sr.querySelector('.pumpe rect[fill="url(#vp-vann)"]'),
    kpis: t('.kp .kh'), kpv: t('.kp .kv'), glod: !!sr.querySelector('.kp.glod'),
    btns: [...sr.querySelectorAll('.qb')].map((q) => (q.getAttribute('aria-label') || '') + (q.classList.contains('miss') ? ':miss' : '')), btnCls: [...sr.querySelectorAll('.qb')].map((q) => q.className),
    tabs: tabs.map((x) => x.dataset.v), active: tabs.filter((x) => x.getAttribute('aria-selected') === 'true').map((x) => x.dataset.v)[0],
    gear: !!sr.querySelector('.gear[data-act="customize"]'), rows: t('.pane .rw .col>span:first-child, .pane .rw .grow.ell'), miss: t('.pane .rw.miss .grow'),
    prosa: t('.prosa')[0], accs: t('.acc .ah .grow'), segs: t('.seg .sg.on'), steppers: sr.querySelectorAll('.pane .stp').length,
    graph: sr.querySelectorAll('.pane .gr polyline').length, empty: t('.empty b').join('|'), accRows: sr.querySelectorAll('.acc .ab .rw').length,
  };
});

try {
// ---------------------------------------------------------------- strategi-vilkår + supersede
const p = await page();
const strat = await p.evaluate(() => ({
  has: window.MSH.varmepumpeHas(window.__h), need: window.MSH.popupNeeds['#varmepumpe'](window.__h),
  fn: window.MSH.FUNCTION_POPUPS.find((f) => f[0] === '#varmepumpe'),
  sup: window.MSH.POPUP_SUPERSEDE['#varmepumpe'].test({ type: 'custom:bubble-card', hash: '#varmepumpe', cards: [{ type: 'custom:gap-card' }, { type: 'custom:button-card', entity: 'sensor.vaskerom_nibe_bt7_hw_top_40013' }, { type: 'custom:ki-varmepumpe-card' }] }),
  supNo: window.MSH.POPUP_SUPERSEDE['#varmepumpe'].test({ type: 'custom:bubble-card', hash: '#varmepumpe', cards: [{ type: 'markdown', content: 'hei' }] }),
  extra: window.MSH.POPUP_EXTRA['#varmepumpe'](),
  roles: Object.keys(window.MSH.varmepumpe.oppdag(window.__h, {}).roles).length,
  hard: /vaskerom_/.test(customElements.get('msh-varmepumpe-card').toString()),
}));
ok('strategi: NIBE-enhet funnet → popup #varmepumpe (mdi:heat-pump, msh-varmepumpe-card, card_id varmepumpe)', strat.has && strat.need && strat.fn && strat.fn[2] === 'mdi:heat-pump' && strat.fn[3] === 'msh-varmepumpe-card' && strat.extra.card_id === 'varmepumpe', strat);
ok('POPUP_SUPERSEDE: importert #varmepumpe (ki-varmepumpe-card/NIBE-entiteter) erstattes, andre ikke', strat.sup && !strat.supNo, strat);
ok('autokonfig: roller funnet på parameter-ID/navn (≥ 60), ingen hardkodede vaskerom_-ID-er', strat.roles >= 60 && !strat.hard, strat);
const R = await p.evaluate(() => window.MSH.varmepumpe.oppdag(window.__h, {}).roles);
ok('roller: BT7 _40013, BT1 _40004, kompressor _41778, driftsstilling _47137, Boost _50004, GP1 _49995, varsler, tilkobling, kostnad',
  R.vv === 'sensor.vaskerom_nibe_hot_water_top_bt7_40013' && R.ute === 'sensor.vaskerom_nibe_current_outd_temp_bt1_40004' && R.freq === 'sensor.vaskerom_nibe_current_compressor_frequency_41778'
  && R.driftsstilling === 'select.vaskerom_nibe_operating_mode_47137' && R.boost === 'switch.vaskerom_nibe_temporary_lux_50004' && R.pump === 'binary_sensor.vaskerom_nibe_pump_gp1_49995'
  && R.alarm === 'sensor.vaskerom_nibe_varsler' && R.wifi === 'binary_sensor.vaskerom_nibe_tilkoblingstilstand' && R.cost_day === 'sensor.vaskerom_nibe_daily_energy_cost'
  && R.power === 'sensor.vaskerom_nibe_current_power' && R.energy === 'sensor.vaskerom_nibe_energy' && R.smart === 'select.vaskerom_nibe_smart_home_mode' && R.onsket === 'number.vaskerom_nibe_target_temperature_room'
  && R.inne === 'sensor.vaskerom_nibe_indoor_temperature_50225' && R.add_power === 'sensor.vaskerom_nibe_internal_addition_power' && R.legionella === 'sensor.vaskerom_nibe_next_periodic_increase' && R.fastvare === 'update.vaskerom_nibe_fastvare', R);

// ---------------------------------------------------------------- toppkort, KPI, knapper, faner
let S = await state(p);
ok('toppkort 176 px: kW, «Ute · kr i dag», status-chip, Hz-merke', S.topH === 176 && S.kw === '1,24kW' && /Ute −3,2° · 14,82 kr i dag/.test(S.ts) && S.chip === 'Varme' && S.hz === '52 Hz', S);
ok('toppkort animert: vifte snurrer, rør med flyt, tank-fylling', S.fan && S.flow === 2 && S.tankFill, S);
ok('3 KPI-kort: Ute, Kompressor (glød når den går), Varmtvann', S.kpis.join() === 'Ute,Kompressor,Varmtvann' && S.kpv.join() === '−3,2°,52Hz,48,6°' && S.glod, S);
ok('hurtigknapper: Boost, Ventilasjon, Pumpe, Eco, Alarm, Wi-Fi (alle funnet)', S.btns.join() === 'Boost,Ventilasjon,Pumpe,Eco,Alarm,Wi-Fi', S.btns);
ok('GP1-pumpe går → vibrerer; alarm/Wi-Fi rolige', /vib/.test(S.btnCls[2]) && !/rist/.test(S.btnCls[4]) && !/blink/.test(S.btnCls[5]), S.btnCls);
ok('faner Info · Varme · Varmtvann · Luft + tannhjul', S.tabs.join() === 'info,varme,vv,luft' && S.active === 'info' && S.gear, S);
ok('Info: prosasetning med piller (Hz, inne, varmtvann)', /Varmepumpa går på 52 Hz og holder 21,3° inne\. Varmtvannet er 48,6°/.test(S.prosa), S.prosa);
ok('Info: rader energi/kostnad/tur/retur/rom/elkolbe, graf tur/retur, akkordeonene Kostnad · Systemdrift · Strøm + Diagnostikk', S.miss.length === 0 && S.graph >= 2 && S.accs.join() === 'Kostnad,Systemdrift,Strøm,Diagnostikk', S);
await shot(p, '1-info');
// akkordeon
await p.evaluate(() => window.__c.shadowRoot.querySelector('.acc [data-v="sys"]').click()); await wait(p, 300);
S = await state(p);
ok('Systemdrift-akkordeon åpnes (6 rader)', S.accRows === 6, S.accRows);
// Varme
await p.evaluate(() => window.__c.shadowRoot.querySelector('[data-act="tab"][data-v="varme"]').click()); await wait(p, 300);
S = await state(p);
ok('Varme: Driftsstilling Auto, Smart Home Normal, 5 −/+ og beregnet turtemperatur', S.active === 'varme' && S.segs.join() === 'Auto,Normal' && S.steppers === 5 && S.rows.some((r) => /Beregnet turtemperatur/.test(r)), S);
const c0 = await p.evaluate(() => window.__calls.length);
const stop = await p.evaluate(async () => {
  const b = window.__c.shadowRoot.querySelector('.stp [data-act="step"][data-d="1"][data-id="number.vaskerom_nibe_heating_curve_47007"]');
  let reached = false; const l = () => { reached = true; }; document.addEventListener('pointerdown', l);
  b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
  document.removeEventListener('pointerdown', l);
  b.click(); await new Promise((q) => setTimeout(q, 800));
  return reached;
});
const sv = await p.evaluate((n) => window.__calls.slice(n).filter((c) => c[0] === 'number'), c0);
ok('−/+: varmekurve 7 → 8 via number.set_value, pointerdown stoppes (fallgruve 2)', !stop && sv.length === 1 && sv[0][1] === 'set_value' && sv[0][2].value === 8, { stop, sv });
const c1 = await p.evaluate(() => window.__calls.length);
await p.evaluate(() => [...window.__c.shadowRoot.querySelectorAll('.sg')].find((x) => x.textContent === 'Borte').click());
const so = await p.evaluate((n) => window.__calls.slice(n).filter((c) => c[0] === 'select'), c1);
ok('Smart Home «Borte» → select.select_option Away', so.length === 1 && so[0][2].option === 'Away', so);
await shot(p, '2-varme');
// Varmtvann
await p.evaluate(() => window.__c.shadowRoot.querySelector('[data-act="tab"][data-v="vv"]').click()); await wait(p, 500);
S = await state(p);
const vv = await p.evaluate(() => { const r = window.__c.shadowRoot; return { fyll: r.querySelector('.fyll b').textContent, boost: r.querySelector('.boost').textContent.trim(), leg: [...r.querySelectorAll('.rw')].some((x) => /legionella/i.test(x.textContent) && /om 3 dager/.test(x.textContent)) }; });
ok('Varmtvann: graf BT7+BT6, fyllingsgrad 72 %, behov Normal, Boost-knapp, rader med legionella', S.graph === 2 && vv.fyll === '72 %' && S.segs.join() === 'Normal' && /Boost varmtvann/.test(vv.boost) && vv.leg && S.miss.length === 0, { g: S.graph, segs: S.segs, miss: S.miss, vv });
// graf-scrub
const scrub = await p.evaluate(async () => {
  const svg = window.__c.shadowRoot.querySelector('.gr[data-g="vv"] .gs'), r = svg.getBoundingClientRect();
  let reached = false; const l = () => { reached = true; }; document.addEventListener('pointerdown', l);
  svg.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true, clientX: r.left + r.width * 0.25, clientY: r.top + 20, pointerId: 3 }));
  document.removeEventListener('pointerdown', l);
  await new Promise((q) => setTimeout(q, 200));
  const t = window.__c.shadowRoot.querySelector('.gr[data-g="vv"] .gt').textContent;
  svg.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, composed: true, pointerId: 3 }));
  return { reached, t, ta: getComputedStyle(svg).touchAction };
});
ok('graf-scrub viser historisk tid, touch-action none, stopPropagation', !scrub.reached && /^−\d/.test(scrub.t) && scrub.ta === 'none', scrub);
const c2 = await p.evaluate(() => window.__calls.length);
await p.evaluate(() => window.__c.shadowRoot.querySelector('.boost').click());
const bo = await p.evaluate((n) => window.__calls.slice(n).filter((c) => c[0] !== 'ws'), c2);
ok('Boost varmtvann slår på midlertidig luksus (switch _50004)', bo.length === 1 && bo[0][2].entity_id === 'switch.vaskerom_nibe_temporary_lux_50004', bo);
await shot(p, '3-varmtvann');
// Luft
await p.evaluate(() => window.__c.shadowRoot.querySelector('[data-act="tab"][data-v="luft"]').click()); await wait(p, 500);
S = await state(p);
const luft = await p.evaluate(() => { const r = window.__c.shadowRoot; return { spin: !!r.querySelector('.pane .ri.spin-i'), sws: [...r.querySelectorAll('.pane .sw')].map((s) => s.getAttribute('aria-label')) }; });
ok('Luft: graf BT20/BT21, vifte snurrer, brytere Økt ventilasjon + Nattkjøling', S.graph === 2 && luft.spin && luft.sws.join() === 'Økt ventilasjon,Nattkjøling', { S, luft });
// Eco-knapp
const c3 = await p.evaluate(() => window.__calls.length);
await p.evaluate(() => [...window.__c.shadowRoot.querySelectorAll('.qb')].find((q) => q.getAttribute('aria-label') === 'Eco').click());
const eco = await p.evaluate((n) => window.__calls.slice(n).filter((c) => c[0] === 'select'), c3);
ok('Eco-knapp: Smart Home-modus Normal → Borte (Away)', eco.length === 1 && eco[0][2].option === 'Away', eco);
await wait(p, 200);
const hp0 = await p.evaluate(() => window.__haptics.length);
await p.evaluate(() => [...window.__c.shadowRoot.querySelectorAll('.qb')].find((q) => q.getAttribute('aria-label') === 'Ventilasjon').click());
const hp1 = await p.evaluate(() => window.__haptics.length);
ok('én haptic per trykk på hurtigknapp', hp1 - hp0 === 1, [hp0, hp1]);
// alarm aktiv + Wi-Fi frakoblet + ventilasjon på → rist/blink/snurr
await p.evaluate(async () => {
  const h = window.__h, st = { ...h.states };
  st['sensor.vaskerom_nibe_varsler'] = { ...st['sensor.vaskerom_nibe_varsler'], state: '2' };
  st['binary_sensor.vaskerom_nibe_tilkoblingstilstand'] = { ...st['binary_sensor.vaskerom_nibe_tilkoblingstilstand'], state: 'off' };
  st['switch.vaskerom_nibe_increased_ventilation_50005'] = { ...st['switch.vaskerom_nibe_increased_ventilation_50005'], state: 'on' };
  st['sensor.vaskerom_nibe_current_compressor_frequency_41778'] = { ...st['sensor.vaskerom_nibe_current_compressor_frequency_41778'], state: '0' };
  window.__h = { ...h, states: st }; window.__c.hass = window.__h;
  await new Promise((q) => setTimeout(q, 400));
});
S = await state(p);
ok('alarm aktiv = rød + rist, Wi-Fi av = rød + blink, ventilasjon på = snurr', /red rist/.test(S.btnCls[4]) && /red blink/.test(S.btnCls[5]) && /spin-i/.test(S.btnCls[1]), S.btnCls);
ok('kompressor 0 Hz → animasjonene stopper (ingen flyt, ingen glød)', S.flow === 0 && !S.glod, S);
await shot(p, '4-luft-alarm');

// ---------------------------------------------------------------- Tilpass varmepumpe
await p.evaluate(() => window.__c.shadowRoot.querySelector('.gear').click()); await wait(p, 900);
const ED = await p.evaluate(() => {
  const port = window.MSH.portals().pop(), ed = port && port.shadowRoot.querySelector('msh-editor');
  if (!ed) return null;
  const r = ed.shadowRoot;
  return { tabs: [...r.querySelectorAll('.tabs [data-a="tab"]')].map((x) => x.getAttribute('aria-label') || x.textContent.trim()), rows: [...r.querySelectorAll('[data-vpk]')].map((x) => x.dataset.vpl + ':' + x.dataset.vpk), handles: [...r.querySelectorAll('[data-vpdrag]')].map((x) => getComputedStyle(x).touchAction), prev: /Forhåndsvisning/.test(r.textContent), done: !!(r.querySelector('[data-a="save"]')) };
});
ok('Tilpass varmepumpe: faner Knapper · Faner · Entiteter · Visning, forhåndsvisning, dra-håndtak', ED && ED.tabs.join() === 'Knapper,Faner,Entiteter,Visning' && ED.prev && ED.rows.join() === 'buttons:boost,buttons:vent,buttons:pump,buttons:eco,buttons:alarm,buttons:wifi' && ED.handles.every((t) => t === 'none'), ED);
// dra Wi-Fi øverst
const drag = await p.evaluate(async () => {
  const ed = window.MSH.portals().pop().shadowRoot.querySelector('msh-editor'), r = ed.shadowRoot;
  const hd = r.querySelector('[data-vpk="wifi"] [data-vpdrag]'), tgt = r.querySelector('[data-vpk="boost"]');
  const a = hd.getBoundingClientRect(), t = tgt.getBoundingClientRect();
  const ev = (type, x, y, el) => el.dispatchEvent(new PointerEvent(type, { bubbles: true, composed: true, pointerId: 7, clientX: x, clientY: y, button: 0, pointerType: 'touch' }));
  ev('pointerdown', a.left + 5, a.top + 5, hd);
  for (let i = 1; i <= 6; i++) ev('pointermove', a.left + 5, a.top + 5 + ((t.top + t.height / 2) - (a.top + 5)) * (i / 6), hd);
  ev('pointerup', a.left + 5, t.top + t.height / 2, hd);
  await new Promise((q) => setTimeout(q, 500));
  return [...ed.shadowRoot.querySelectorAll('[data-vpk]')].map((x) => x.dataset.vpk).join();
});
await wait(p, 300);
S = await state(p);
ok('Tilpass · Knapper: dra-og-slipp sorterer (Wi-Fi først), kortet følger live', drag === 'wifi,boost,vent,pump,eco,alarm' && S.btns[0] === 'Wi-Fi', { drag, btns: S.btns });
// skjul Pumpe + «Bare ikon»
await p.evaluate(() => { const ed = window.MSH.portals().pop().shadowRoot.querySelector('msh-editor'); ed.shadowRoot.querySelector('[data-vpk="pump"] [data-a="fn"]').click(); });
await wait(p, 300);
await p.evaluate(() => { const ed = window.MSH.portals().pop().shadowRoot.querySelector('msh-editor'); ed._set('button_style', 'icon'); });
await wait(p, 400);
const ic = await p.evaluate(() => ({ n: window.__c.shadowRoot.querySelectorAll('.qb').length, lbl: window.__c.shadowRoot.querySelectorAll('.qb .ql').length, cls: window.__c.shadowRoot.querySelector('.qbs').className }));
ok('Tilpass: skjul Pumpe + «Bare ikon» → 5 knapper uten tekst', ic.n === 5 && ic.lbl === 0 && /ic/.test(ic.cls), ic);
// Faner-fanen: skjul Info, stil bare ikon
await p.evaluate(() => { const ed = window.MSH.portals().pop().shadowRoot.querySelector('msh-editor'); ed.shadowRoot.querySelector('[data-a="tab"][data-v="faner"]').click(); });
await wait(p, 300);
await p.evaluate(() => { const ed = window.MSH.portals().pop().shadowRoot.querySelector('msh-editor'); ed.shadowRoot.querySelector('[data-vpk="info"] [data-a="fn"]').click(); });
await wait(p, 400);
S = await state(p);
ok('Tilpass · Faner: skjul Info → fanen borte', S.tabs.join() === 'varme,vv,luft', S.tabs);
// Entiteter: seksjoner med «x av y funnet»
await p.evaluate(() => { const ed = window.MSH.portals().pop().shadowRoot.querySelector('msh-editor'); ed.shadowRoot.querySelector('[data-a="tab"][data-v="entiteter"]').click(); });
await wait(p, 400);
const ent = await p.evaluate(() => { const r = window.MSH.portals().pop().shadowRoot.querySelector('msh-editor').shadowRoot; return { txt: r.textContent, pickers: r.querySelectorAll('msh-entity-picker, .pk, [data-name^="overrides."]').length }; });
ok('Tilpass · Entiteter: NIBE-enhet + grupper med «x av y funnet» og entitetsvelgere', /Vaskerom NIBE/.test(ent.txt) && /Diagnostikk/.test(ent.txt) && /av \d+ funnet/.test(ent.txt) && ent.pickers > 10, { p: ent.pickers });
await shot(p, '5-tilpass');
// Ferdig → config
await p.evaluate(async () => { const port = window.MSH.portals().pop(); const ed = port.shadowRoot.querySelector('msh-editor'); const btn = ed.shadowRoot.querySelector('[data-a="save"]') || port.shadowRoot.querySelector('[data-a="save"]'); if (btn) btn.click(); await new Promise((q) => setTimeout(q, 1200)); });
const saved = await p.evaluate(() => { const c = window.__c._rawConfig || {}; return { buttons: c.buttons, bh: c.buttons_hidden, bs: c.button_style, th: c.tabs_hidden }; });
ok('Ferdig: config lagret (buttons, buttons_hidden, button_style, tabs_hidden)', saved.buttons && saved.buttons[0] === 'wifi' && JSON.stringify(saved.bh) === '["pump"]' && saved.bs === 'icon' && JSON.stringify(saved.th) === '["info"]', saved);
const gui = await p.evaluate(async () => {
  const el = customElements.get('msh-varmepumpe-card').getConfigElement();
  el.hass = window.__h; el.setConfig(window.__c._rawConfig);
  document.body.appendChild(el);
  await new Promise((q) => setTimeout(q, 400));
  const r = el.shadowRoot;
  const rows = [...r.querySelectorAll('[data-vpk]')].map((x) => x.dataset.vpk + (x.style.opacity ? ':av' : ''));
  el.remove();
  return rows;
});
ok('GUI-editor (getConfigElement) viser samme rekkefølge og skjult knapp', gui.join() === 'wifi,boost,vent,pump:av,eco,alarm', gui);
const stub = await p.evaluate(() => { const C = customElements.get('msh-varmepumpe-card'); const s = C.getStubConfig(); const c = document.createElement('msh-varmepumpe-card'); return { s: !!s.card_id, g: JSON.stringify(c.getGridOptions()) }; });
ok('getStubConfig + getGridOptions full bredde', stub.s && stub.g === '{"columns":"full"}', stub);

// ---------------------------------------------------------------- testcase 2: startfane, uten KPI/diagnostikk/animasjon
const p2 = await page({ tab_style: 'icon', button_style: 'icon', tabs: ['vv', 'info', 'varme', 'luft'], start_tab: 'vv', kpi: false, diag: false, anim: false });
S = await state(p2);
const na = await p2.evaluate(() => getComputedStyle(window.__c.shadowRoot.querySelector('.vifte')).animationName);
ok('startfane Varmtvann, ikonfaner, uten KPI/diagnostikk, animasjoner av', S.active === 'vv' && S.tabs[0] === 'vv' && !S.kpis.length && !S.accs.includes('Diagnostikk') && na === 'none', { S, na });

// ---------------------------------------------------------------- uten BT20/BT21 → Luft skjult; uten NIBE → «–»
const p3 = await page({}, null, () => { const h0 = window.mockHass; window.mockHass = () => { const h = h0(); ['sensor.vaskerom_nibe_exhaust_air_bt20_40025', 'sensor.vaskerom_nibe_extract_air_bt21_40026'].forEach((id) => { delete h.states[id]; delete h.entities[id]; }); return h; }; });
S = await state(p3);
ok('uten BT20/BT21 → Luft-fanen skjules', S.tabs.join() === 'info,varme,vv', S.tabs);
const p4 = await page({}, null, () => { const h0 = window.mockHass; window.mockHass = () => { const h = h0(); const d = h.devices; const st = { ...h.states }, en = { ...h.entities }; Object.keys(en).forEach((id) => { if (/nibe/.test(id)) { delete st[id]; delete en[id]; } }); const dv = { ...d }; delete dv.dev_nibe_f730; return { ...h, states: st, entities: en, devices: dv }; }; });
S = await state(p4);
const p4s = await p4.evaluate(() => ({ has: window.MSH.varmepumpeHas(window.__h), vs: window.__c.shadowRoot.querySelectorAll('[data-section^="vp-"], [data-section="entiteter"]').length }));
ok('uten NIBE: ingen popup (vilkår usant), kortet viser toppkort med «–» og «Velg entitet»', !p4s.has && S.topH === 176 && /Fant ingen NIBE-varmepumpe/.test(S.empty) && S.kw === '–kW' && S.miss.length > 3 && p4s.vs > 5, { S, p4s });
await shot(p4, '6-uten-nibe');
// mobil 360 og PC-bredde: fyller bredden
for (const vp of [{ width: 360, height: 800 }, { width: 1200, height: 900 }]) {
  const pp = await page({}, vp);
  const w = await pp.evaluate(() => { const c = window.__c, t = c.shadowRoot.querySelector('.top'); const sc = document.documentElement.scrollWidth; return { c: Math.round(c.getBoundingClientRect().width), p: (() => { const e = c.parentElement, cs = getComputedStyle(e); return Math.round(e.getBoundingClientRect().width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth)); })(), t: Math.round(t.getBoundingClientRect().width), sc, vw: innerWidth }; });
  ok(`fyller bredden (${vp.width} px), ingen horisontal scroll`, w.c === w.p && w.t === w.c && w.sc <= w.vw, w);
  await pp.close();
}
} catch (e) { fail.push('krasj: ' + e.message); console.error(e); }
ok('ingen JS-feil', !errs.length, errs.slice(0, 5));
await b.close();
if (!process.env.VP_BUNDLE) try { unlinkSync(bundle); } catch (e) { /* */ }
for (const [k, v] of Object.entries(res)) console.log(v === 'OK' ? '  OK  ' : '  FEIL', k, v === 'OK' ? '' : JSON.stringify(v[1]).slice(0, 600));
console.log(fail.length ? `\n${fail.length} feil` : '\nAlt OK');
process.exit(fail.length ? 1 : 0);
