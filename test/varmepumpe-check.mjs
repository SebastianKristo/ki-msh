// Fiks 26.20 / 31.2 · Varmepumpe (#varmepumpe, msh-varmepumpe-card) – funksjon: autokonfig fra NIBE-enheten (mock: F730 via
// myUplink, parameter-ID-suffikser), toppkort med verdier, KPI, hurtigknapper (handlinger, aktive tilstander, animasjoner),
// faner Info · Varme · Varmtvann · Luft, −/+ (number.set_value, stopPropagation), graf-scrub (stopPropagation), Boost,
// historikk bare når popupen er åpen, Luft skjult uten BT20/BT21, «–»/«Velg entitet» uten NIBE og full bredde.
// Design (mål/farger/keyframes), rydding (#nibe-alias, migrering) og «Tilpass varmepumpe»: test/varmepumpe31-check.mjs.
//   node test/varmepumpe-check.mjs   (SHOTS=<mappe> for skjermbilder) – uavhengig av dato/klokkeslett
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
async function page(cfg, vp, pre, open = true) {
  const p = await b.newPage({ viewport: vp || { width: 400, height: 900 }, hasTouch: true });
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/fonts.googleapis|net::ERR/.test(m.text())) errs.push(m.text()); });
  await p.goto('file://' + resolve('test/harness.html'));
  for (const m of mocks) await p.addScriptTag({ path: m });
  if (pre) await p.evaluate(pre);
  await p.addScriptTag({ path: bundle });
  await p.evaluate(async ({ cfg, open }) => {
    window.__h = window.mockHass();
    window.__haptics = [];
    window.addEventListener('haptic', (e) => window.__haptics.push(e.detail));
    const bc = document.createElement('bubble-card');
    bc.setConfig({ type: 'custom:bubble-card', card_type: 'pop-up', hash: '#varmepumpe' });
    bc.innerHTML = '<div class="pop"><div class="hdr">Varmepumpe</div><div class="inner"></div></div>';
    document.getElementById('dash').appendChild(bc);
    if (open) location.hash = '#varmepumpe';
    const c = document.createElement('msh-varmepumpe-card');
    c.setConfig({ type: 'custom:msh-varmepumpe-card', card_id: 'varmepumpe', ...(cfg || {}) });
    c.hass = window.__h;
    bc.querySelector('.inner').appendChild(c);
    window.__c = c;
    await new Promise((q) => setTimeout(q, 900));
  }, { cfg, open });
  return p;
}
const wait = (p, ms) => p.evaluate((ms) => new Promise((q) => setTimeout(q, ms)), ms);
const shot = async (p, n) => { if (shots) await p.screenshot({ path: `${shots}/varmepumpe-${n}.png`, fullPage: true }); };
const txt = (s) => s.replace(/\s+/g, ' ').trim();
const state = (p) => p.evaluate(() => {
  const sr = window.__c.shadowRoot, t = (sel) => [...sr.querySelectorAll(sel)].map((e) => e.textContent.replace(/\s+/g, ' ').trim());
  const tabs = [...sr.querySelectorAll('.tabs [data-act="tab"]')];
  const top = sr.querySelector('.top');
  const an = (sel) => { const e = sr.querySelector(sel); return e ? getComputedStyle(e).animationName : null; };
  return {
    topH: top ? Math.round(top.getBoundingClientRect().height) : 0, kw: t('.top .kwr')[0], ts: t('.top .ts')[0], chip: t('.top .chip')[0], hz: t('.top .hz')[0], tank: t('.top .tank')[0], sup: t('.top .sup')[0],
    fan: an('.top .fan'), fanDur: (() => { const e = sr.querySelector('.top .fan'); return e ? getComputedStyle(e).animationDuration : null; })(), flow: an('.top .ph'), heatOp: [...sr.querySelectorAll('.top .hr')].map((e) => getComputedStyle(e).opacity),
    fill: (() => { const e = sr.querySelector('.top .tank .fill'); return e ? e.style.height : null; })(),
    kpis: t('.kp .kl'), kpv: t('.kp .kvr'), kps: t('.kp .ks'), pust: !!sr.querySelector('.kp .ki.pust'),
    btns: [...sr.querySelectorAll('.qb')].map((q) => q.getAttribute('aria-label')), btnCls: [...sr.querySelectorAll('.qb')].map((q) => q.className.replace(/\s+/g, ' ').trim()),
    tabs: tabs.map((x) => x.dataset.v), active: tabs.filter((x) => x.getAttribute('aria-selected') === 'true').map((x) => x.dataset.v)[0],
    gear: !!sr.querySelector('.gear[data-act="customize"]'), rows: t('.pane .rw .rl, .pane .sr .sl'), miss: t('.pane .rw.miss .rl, .pane .sr.miss .sl'),
    prosa: t('.prosa')[0], accs: t('.acc .ah .at'), segs: t('.seg .sg.on'), chips: t('.chips .ch.on'), steppers: sr.querySelectorAll('.pane .stp').length,
    graph: [...sr.querySelectorAll('.pane svg.gs path')].filter((x) => (x.getAttribute('d') || '').length > 40).length, nf: t('.nf b').join('|'), accRows: sr.querySelectorAll('.acc .ab .rw, .acc .ab .dr2').length,
  };
});

try {
// ---------------------------------------------------------------- strategi-vilkår + roller
const p = await page();
const strat = await p.evaluate(() => ({
  has: window.MSH.varmepumpeHas(window.__h), need: window.MSH.popupNeeds['#varmepumpe'](window.__h),
  fn: window.MSH.FUNCTION_POPUPS.find((f) => f[0] === '#varmepumpe'), extra: window.MSH.POPUP_EXTRA['#varmepumpe'](),
  roles: Object.keys(window.MSH.varmepumpe.oppdag(window.__h, {}).roles).length,
  hard: /vaskerom_/.test(customElements.get('msh-varmepumpe-card').toString()),
}));
ok('strategi: NIBE-enhet funnet → popup #varmepumpe (mdi:heat-pump, msh-varmepumpe-card, card_id varmepumpe, ingen entiteter)', strat.has && strat.need && strat.fn && strat.fn[2] === 'mdi:heat-pump' && strat.fn[3] === 'msh-varmepumpe-card' && JSON.stringify(strat.extra) === '{"card_id":"varmepumpe"}', strat);
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
ok('toppkort 176 px: kW, «Ute … · … kr», chip Varme, Hz-merke, tank 49° (BT7) fylt 72 %, tur 35°', S.topH === 176 && txt(S.kw) === '1,24kW' && S.ts === 'Ute −3,2° · 14,82 kr' && S.chip === 'Varme' && S.hz === '52 Hz' && S.tank === '49°' && S.fill === '72%' && S.sup === '35°', S);
ok('toppkort animert: vifte snurrer (spin), rør med flyt (flow), varme stiger', S.fan === 'spin' && S.flow === 'flow' && S.heatOp.length === 3, S);
ok('3 KPI-kort: Ute, Kompressor (pust når den går), Varmtvann', S.kpis.join() === 'Ute,Kompressor,Varmtvann' && S.kpv.map(txt).join('|') === '−3,2°|52Hz|48,6°' && S.kps.join('|') === 'snitt −1,8°|inne 21,3°|lading 44,1°' && S.pust, S);
ok('hurtigknapper (v3-standard): Boost, Vifte, Eco, Alarm, Wi-Fi – Pumpe skjult som standard', S.btns.join() === 'Boost,Vifte,Eco,Alarm,Wi-Fi', S.btns);
ok('Wi-Fi tilkoblet = aktiv (rosa); alarm/boost/vifte rolige', /\bon\b/.test(S.btnCls[4]) && !/rist|red/.test(S.btnCls[3]) && !/\bon\b/.test(S.btnCls[0]), S.btnCls);
ok('faner Info · Varme · Varmtvann · Luft + tannhjul', S.tabs.join() === 'info,varme,vv,luft' && S.active === 'info' && S.gear, S);
ok('Info: prosasetning med piller (Hz, inne) og varmtvann', S.prosa === 'Kompressoren går på 52 Hz og holder inne på 21,3°. Varmtvannet er 48,6 °C.', S.prosa);
ok('Info: rader energi/kostnad/tur/retur/rom/elkolbe, graf tur/retur, akkordeonene Kostnad · Systemdrift · Strøm + Diagnostikk', S.rows.join() === 'Energi totalt,Kostnad i dag,Tur (BT2),Retur (BT3),Rom (BT50),Elkolbe' && !S.miss.length && S.graph >= 2 && S.accs.join() === 'Kostnad,Systemdrift,Strøm,Diagnostikk', S);
await shot(p, '1-info');
await p.evaluate(() => window.__c.shadowRoot.querySelector('.ah[data-v="sys"]').click()); await wait(p, 300);
S = await state(p);
ok('Systemdrift-akkordeon åpnes (6 rader)', S.accRows === 6, S.accRows);
await p.evaluate(() => window.__c.shadowRoot.querySelector('.ah[data-v="diag"]').click()); await wait(p, 300);
const dg = await p.evaluate(() => [...window.__c.shadowRoot.querySelectorAll('.acc[data-key="acc-diag"] .dr2')].map((x) => x.innerText.replace(/\s+/g, ' ').trim()));
ok('Diagnostikk: 8 verdier i rutenett (sugegass … GP1)', dg.length === 8 && /Hetgass 78,2 °C/.test(dg.join('|')), dg);
// Varme
await p.evaluate(() => window.__c.shadowRoot.querySelector('[data-act="tab"][data-v="varme"]').click()); await wait(p, 300);
S = await state(p);
const calc = await p.evaluate(() => window.__c.shadowRoot.querySelector('.calc').textContent);
ok('Varme: Driftsstilling Auto, Smart Home Normal, 4 −/+ og beregnet turtemperatur + start GM', S.active === 'varme' && S.segs.join() === 'Auto' && S.chips.join() === 'Normal' && S.steppers === 4 && calc === 'Beregnet turtemperatur 35,2 °C · start GM −60', { S, calc });
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
await p.evaluate(() => [...window.__c.shadowRoot.querySelectorAll('.chips .ch')].find((x) => /Borte/.test(x.textContent)).click());
const so = await p.evaluate((n) => window.__calls.slice(n).filter((c) => c[0] === 'select'), c1);
ok('Smart Home «Borte» → select.select_option Away', so.length === 1 && so[0][2].option === 'Away', so);
await shot(p, '2-varme');
// Varmtvann
await p.evaluate(() => window.__c.shadowRoot.querySelector('[data-act="tab"][data-v="vv"]').click()); await wait(p, 500);
S = await state(p);
const vv = await p.evaluate(() => { const r = window.__c.shadowRoot; return { big: r.querySelector('.gc .gv').textContent, leg: r.querySelector('.leg').innerText.replace(/\s+/g, ' ').trim(), bar: r.querySelector('.fb div').style.width, boost: r.querySelector('.boost').textContent.trim(), rows: [...r.querySelectorAll('.lst.sm .sr')].map((x) => x.innerText.replace(/\s+/g, ' ').trim()) }; });
ok('Varmtvann: BT7 48,6, graf BT7+BT6, fylt 72 %, behov Normal, Boost-knapp, rader med legionella «om 3 d»', vv.big === '48,6' && S.graph === 3 && /Tilførsel BT6 44,1°/.test(vv.leg) && /Fylt 72 %/.test(vv.leg) && vv.bar === '72%' && S.segs.join() === 'Normal' && vv.boost === 'Varmtvann boost' && vv.rows.some((r) => r === 'Neste legionellaheving om 3 d') && !S.miss.length, { g: S.graph, segs: S.segs, miss: S.miss, vv });
const scrub = await p.evaluate(async () => {
  const svg = window.__c.shadowRoot.querySelector('svg.gs[data-g="vv"]'), r = svg.getBoundingClientRect();
  let reached = false; const l = () => { reached = true; }; document.addEventListener('pointerdown', l);
  svg.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true, clientX: r.left + r.width * 0.25, clientY: r.top + 20, pointerId: 3 }));
  document.removeEventListener('pointerdown', l);
  await new Promise((q) => setTimeout(q, 200));
  const t = window.__c.shadowRoot.querySelector('.gc[data-key="g-vv"] .gsub').textContent;
  const svg2 = window.__c.shadowRoot.querySelector('svg.gs[data-g="vv"]');
  svg2.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, composed: true, pointerId: 3 }));
  return { reached, t, ta: getComputedStyle(svg2).touchAction };
});
ok('graf-scrub viser historisk tid, touch-action none, stopPropagation', !scrub.reached && /^−\d/.test(scrub.t) && scrub.ta === 'none', scrub);
const c2 = await p.evaluate(() => window.__calls.length);
await p.evaluate(() => window.__c.shadowRoot.querySelector('.boost').click());
const bo = await p.evaluate((n) => window.__calls.slice(n).filter((c) => c[0] !== 'ws'), c2);
ok('Varmtvann boost slår på midlertidig luksus (switch _50004)', bo.length === 1 && bo[0][2].entity_id === 'switch.vaskerom_nibe_temporary_lux_50004', bo);
await shot(p, '3-varmtvann');
// Luft
await p.evaluate(() => window.__c.shadowRoot.querySelector('[data-act="tab"][data-v="luft"]').click()); await wait(p, 500);
S = await state(p);
const luft = await p.evaluate(() => { const r = window.__c.shadowRoot; return { two: [...r.querySelectorAll('.two .lc')].map((x) => x.innerText.replace(/\s+/g, ' ').trim()), fan: r.querySelector('.fanbox').innerText.replace(/\s+/g, ' ').trim(), bar: r.querySelector('.fbb span').style.width, sws: [...r.querySelectorAll('.pane .sw')].map((s) => s.getAttribute('aria-label')) }; });
ok('Luft: BT20/BT21 med differanse, graf, viftehastighet 60 %, brytere Økt ventilasjon + Nattkjøling', S.graph === 3 && luft.two[0] === 'Avtrekk inn (BT20) 22,4 °C' && /Avkast ut \(BT21\) 6,1 °C · −16,3°/.test(luft.two[1]) && luft.fan === 'Viftehastighet avtrekk 60 %' && luft.bar === '60%' && luft.sws.join() === 'Økt ventilasjon,Nattkjøling', { S, luft });
const c3 = await p.evaluate(() => window.__calls.length);
await p.evaluate(() => [...window.__c.shadowRoot.querySelectorAll('.qb')].find((q) => q.getAttribute('aria-label') === 'Eco').click());
const eco = await p.evaluate((n) => window.__calls.slice(n).filter((c) => c[0] === 'select'), c3);
ok('Eco-knapp: Smart Home-modus Normal → Borte (Away)', eco.length === 1 && eco[0][2].option === 'Away', eco);
await wait(p, 200);
const hp0 = await p.evaluate(() => window.__haptics.length);
await p.evaluate(() => [...window.__c.shadowRoot.querySelectorAll('.qb')].find((q) => q.getAttribute('aria-label') === 'Vifte').click());
const hp1 = await p.evaluate(() => window.__haptics.length);
ok('én haptic per trykk på hurtigknapp', hp1 - hp0 === 1, [hp0, hp1]);
// alarm aktiv + Wi-Fi frakoblet + ventilasjon på + Boost på → rist/blink/snurr, vifta raskt
await p.evaluate(async () => {
  const h = window.__h, st = { ...h.states };
  const set = (id, v) => { st[id] = { ...st[id], state: v }; };
  set('sensor.vaskerom_nibe_varsler', '2'); set('binary_sensor.vaskerom_nibe_tilkoblingstilstand', 'off'); set('switch.vaskerom_nibe_increased_ventilation_50005', 'on'); set('switch.vaskerom_nibe_temporary_lux_50004', 'on');
  window.__h = { ...h, states: st }; window.__c.hass = window.__h;
  await new Promise((q) => setTimeout(q, 400));
});
S = await state(p);
ok('alarm aktiv = rød + rist, Wi-Fi av = rød + blink, Vifte på = snurr, Boost på = aktiv; vifta i toppkortet 0,5 s', /red rist/.test(S.btnCls[3]) && /red blink/.test(S.btnCls[4]) && /\bon\b.*spin-i/.test(S.btnCls[1]) && /\bon\b/.test(S.btnCls[0]) && S.fanDur === '0.5s', S.btnCls.concat(S.fanDur));
const warn = await p.evaluate(() => { window.__c.setUI({ tab: 'vv' }); return new Promise((q) => setTimeout(() => q([...window.__c.shadowRoot.querySelectorAll('.varsel .vl')].map((x) => x.textContent.trim())), 400)); });
ok('Varmtvann: varsel-linja (varsel fra varmepumpa, frakoblet)', warn.join('|') === 'Varsel fra varmepumpa|Varmepumpa er frakoblet', warn);
await p.evaluate(async () => { const h = window.__h, st = { ...h.states }; st['sensor.vaskerom_nibe_current_compressor_frequency_41778'] = { ...st['sensor.vaskerom_nibe_current_compressor_frequency_41778'], state: '0' }; window.__h = { ...h, states: st }; window.__c.hass = window.__h; await new Promise((q) => setTimeout(q, 400)); });
S = await state(p);
ok('kompressor 0 Hz → rør/varme stopper, ingen pust; chip følger tilstanden', S.flow === 'none' && S.heatOp.every((o) => o === '0') && !S.pust && /Varmtvann|Hviler/.test(S.chip), S);
await shot(p, '4-alarm');

// ---------------------------------------------------------------- historikk bare når popupen er åpen (fallgruve 8)
const pc = await page({}, null, null, false);
const hc = await pc.evaluate(async () => { const n = () => window.__calls.filter((c) => c[0] === 'ws' && c[1] === 'history/history_during_period').length; const a = n(); location.hash = '#varmepumpe'; await new Promise((q) => setTimeout(q, 900)); return [a, n()]; });
ok('historikk hentes ikke når popupen er lukket, men når den åpnes', hc[0] === 0 && hc[1] >= 1, hc);
await pc.close();

// ---------------------------------------------------------------- testcase 2: startfane, ikonfaner, uten KPI/diagnostikk/animasjon
const p2 = await page({ tab_style: 'icon', button_style: 'icon', tabs: ['vv', 'info', 'varme', 'luft'], start_tab: 'vv', kpi: false, diag: false, anim: false, sentence: false });
S = await state(p2);
const na = await p2.evaluate(() => ({ fan: getComputedStyle(window.__c.shadowRoot.querySelector('.top .fan')).animationName, lbl: window.__c.shadowRoot.querySelectorAll('.qb .ql').length, tlb: window.__c.shadowRoot.querySelectorAll('.tb span').length }));
ok('startfane Varmtvann, ikonfaner, bare ikon på knapper, uten KPI/diagnostikk, animasjoner av', S.active === 'vv' && S.tabs[0] === 'vv' && !S.kpis.length && !S.accs.includes('Diagnostikk') && na.fan === 'none' && na.lbl === 0 && na.tlb === 0, { S, na });
await p2.evaluate(() => window.__c.setUI({ tab: 'info' })); await wait(p2, 300);
ok('sentence: false → ingen prosasetning i Info', !(await state(p2)).prosa);

// ---------------------------------------------------------------- uten BT20/BT21 → Luft skjult; uten NIBE → «–»
const p3 = await page({}, null, () => { const h0 = window.mockHass; window.mockHass = () => { const h = h0(); ['sensor.vaskerom_nibe_exhaust_air_bt20_40025', 'sensor.vaskerom_nibe_extract_air_bt21_40026'].forEach((id) => { delete h.states[id]; delete h.entities[id]; }); return h; }; });
S = await state(p3);
ok('uten BT20/BT21 → Luft-fanen skjules', S.tabs.join() === 'info,varme,vv', S.tabs);
const p4 = await page({}, null, () => { const h0 = window.mockHass; window.mockHass = () => { const h = h0(); const d = h.devices; const st = { ...h.states }, en = { ...h.entities }; Object.keys(en).forEach((id) => { if (/nibe/.test(id)) { delete st[id]; delete en[id]; } }); const dv = { ...d }; delete dv.dev_nibe_f730; return { ...h, states: st, entities: en, devices: dv }; }; });
S = await state(p4);
const p4s = await p4.evaluate(() => ({ has: window.MSH.varmepumpeHas(window.__h), vs: window.__c.shadowRoot.querySelectorAll('[data-section="entiteter"]').length, pk: [...window.__c.shadowRoot.querySelectorAll('.pk')].map((x) => x.textContent) }));
ok('uten NIBE: ingen popup (vilkår usant), toppkort med «–», KPI «Velg entitet», ingen knapper (uten entitet), rader «–»', !p4s.has && S.topH === 176 && /Fant ingen NIBE-varmepumpe/.test(S.nf) && txt(S.kw) === '–kW' && S.hz === '– Hz' && S.kpv.map(txt).join() === '–,–,–' && !S.btns.length && S.miss.length >= 6 && p4s.vs > 5 && p4s.pk.every((x) => x === 'Velg entitet'), { S, p4s });
await shot(p4, '6-uten-nibe');
// mobil 360 og PC-bredde: fyller bredden
for (const vp of [{ width: 360, height: 800 }, { width: 1200, height: 900 }]) {
  const pp = await page({}, vp);
  const w = await pp.evaluate(() => { const c = window.__c, t = c.shadowRoot.querySelector('.top'); const sc = document.documentElement.scrollWidth; return { c: Math.round(c.getBoundingClientRect().width), p: (() => { const e = c.parentElement, cs = getComputedStyle(e); return Math.round(e.getBoundingClientRect().width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth)); })(), t: Math.round(t.getBoundingClientRect().width), sc, vw: innerWidth, tabsOver: (() => { const r = c.shadowRoot.querySelector('.tabs'); return r.scrollWidth - r.clientWidth; })() }; });
  ok(`fyller bredden (${vp.width} px), ingen horisontal scroll`, w.c === w.p && w.t === w.c && w.sc <= w.vw && w.tabsOver <= 1, w);
  await pp.close();
}
const stub = await p.evaluate(() => { const C = customElements.get('msh-varmepumpe-card'); const s = C.getStubConfig(); const c = document.createElement('msh-varmepumpe-card'); return { s: !!s.card_id, g: JSON.stringify(c.getGridOptions()) }; });
ok('getStubConfig + getGridOptions full bredde', stub.s && stub.g === '{"columns":"full"}', stub);
} catch (e) { fail.push('krasj: ' + e.message); console.error(e); }
ok('ingen JS-feil', !errs.length, errs.slice(0, 5));
await b.close();
if (!process.env.VP_BUNDLE) try { unlinkSync(bundle); } catch (e) { /* */ }
for (const [k, v] of Object.entries(res)) console.log(v === 'OK' ? '  OK  ' : '  FEIL', k, v === 'OK' ? '' : JSON.stringify(v[1]).slice(0, 700));
console.log(fail.length ? `\n${fail.length} feil` : '\nAlt OK');
process.exit(fail.length ? 1 : 0);
