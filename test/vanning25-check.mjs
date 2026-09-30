// Fiks 25.1–25.3/25.6 · Vanning (#vanning, ETT kort msh-vanning-card): autokonfig fra OpenSprinkler (prefiks), KI Vanning
// (ventilmodus) og KI Vann (mock under), reserve (ki-msh-autokonfig), hagescene/regnpause, soner (boks + egne grupper,
// deaktiverte), programredigering bare med KI Vanning-styring, Forbruk/Historikk Liste|Kalender, «Tilpass Vanning» ↔
// GUI-editor, faner ved 360 px og dra i tilpass.   node test/vanning25-check.mjs   (SHOTS=<mappe> for skjermbilder)
import { createRequire } from 'node:module';
import { readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const bundle = resolve(`test/.build/vanning25-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const shots = process.env.SHOTS || '';
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const res = {}, fail = [];
const ok = (name, cond, info) => { res[name] = cond ? 'OK' : ['FEIL', info]; if (!cond) fail.push(name); };
const mocks = readdirSync('test/mock').filter((f) => f.endsWith('.js')).sort().map((m) => resolve('test/mock/' + m));
const errs = [];

// ---------------------------------------------------------------- mock: OpenSprinkler (prefiks os_hage) og KI Vanning
const MOCK = {
  // OpenSprinkler med sonenavn «S01 Veranda Bed · Drypp B1» – ki-cards _prefiks()/_soner()/_programmer()
  os: (running, regn) => {
    const S = {}, p = 'os_hage', add = (id, state, attributes) => { S[id] = { entity_id: id, state: String(state), attributes: attributes || {}, last_changed: new Date(Date.now() - 86400000).toISOString(), last_updated: new Date().toISOString() }; };
    [['01', 'Veranda Bed', 'Drypp B1', 'on'], ['02', 'Lavendel', 'Drypp B1', 'on'], ['05', 'Plen nord', 'Spreder B2', 'on'], ['06', 'Hekk', 'Drypp B2', 'off']].forEach(([nr, navn, met, en]) => {
      const t = '_' + navn.toLowerCase().replace(/[^a-z0-9]+/g, '_');
      add(`switch.${p}_s${nr}${t}_station_enabled`, en, { friendly_name: `S${nr} ${navn} · ${met} Station Enabled` });
      add(`binary_sensor.${p}_s${nr}${t}_station_running`, running === nr ? 'on' : 'off', {});
      add(`sensor.${p}_s${nr}${t}_station_status`, running === nr ? '4:30' : 'idle', {});
    });
    add(`switch.${p}_enabled`, 'on', { friendly_name: 'OpenSprinkler Enabled' });
    add(`binary_sensor.${p}_rain_delay_active`, regn ? 'on' : 'off', {});
    add(`sensor.${p}_rain_delay_stop_time`, new Date(Date.now() + 20 * 3600000).toISOString(), {});
    add(`sensor.${p}_current_draw`, 280, { unit_of_measurement: 'mA' });
    add(`switch.${p}_morgen_program_enabled`, 'on', { friendly_name: 'Morgen Program Enabled' });
    add(`binary_sensor.${p}_morgen_program_running`, 'off', {});
    add(`time.${p}_morgen_start_time`, '06:00:00', {});
    return S;
  },
  // KI Vanning i ventilmodus (egne ventiler): soner, programmer og plan i oversiktssensoren
  ki: () => {
    const S = {}, add = (id, state, attributes) => { S[id] = { entity_id: id, state: String(state), attributes: attributes || {}, last_changed: new Date(Date.now() - 2 * 3600000).toISOString(), last_updated: new Date().toISOString() }; };
    const imorgen = new Date(); imorgen.setDate(imorgen.getDate() + 1); imorgen.setHours(6, 0, 0, 0);
    add('switch.kv_s01', 'off', { friendly_name: 'Veranda Bed' }); add('switch.kv_s02', 'off', { friendly_name: 'Plen' }); add('switch.kv_s03', 'off', { friendly_name: 'Hekk' });
    add('sensor.ki_vanning_oversikt', '3 soner', {
      integrasjon: 'ki_vanning', ki_type: 'oversikt', modus: 'ventiler', prefiks: 'kv', pris_m3: 40, i_dag: 120, estimat_i_dag: 300, anlegg: true, regnpause: false, har_flyt: true,
      soner: [{ nr: 1, navn: 'Veranda Bed', metode: 'Drypp B1', boks: '1', bryter: 'switch.kv_s01', rate: 8, i_dag: 80 }, { nr: 2, navn: 'Plen', metode: 'Spreder B2', boks: '2', bryter: 'switch.kv_s02', rate: 12, i_dag: 40 }, { nr: 3, navn: 'Hekk', metode: 'Drypp B2', boks: '2', bryter: 'switch.kv_s03' }],
      programmer: [{ navn: 'Morgen', start: imorgen.toISOString(), tid: '06:00', minutter_til: 600, total_min: 20, estimat_liter: 160, soner: [{ nr: 1, navn: 'Veranda Bed', min: 10 }, { nr: 2, navn: 'Plen', min: 10 }] }],
      program_historikk: [{ navn: 'Morgen', tid: '06:00', dager: ['man', 'tor'], aktiv: true, total_min: 20, siste_liter: 150, kjoringer: 4, soner: [{ entity: 'switch.kv_s01', navn: 'Veranda Bed', min: 10 }, { entity: 'switch.kv_s02', navn: 'Plen', min: 10 }] }],
    });
    add('switch.ki_vanning_anlegg', 'on', { integrasjon: 'ki_vanning', ki_type: 'anlegg', friendly_name: 'Vanning anlegg' });
    add('number.ki_vanning_regnpause', '0', { integrasjon: 'ki_vanning', ki_type: 'regnpause' });
    add('button.ki_vanning_stopp_alt', 'unknown', { integrasjon: 'ki_vanning', ki_type: 'stopp_alt', friendly_name: 'Stopp alt' });
    add('switch.ki_vanning_varsel_hoved', 'on', { integrasjon: 'ki_vanning', ki_type: 'varsel_hoved' });
    add('sensor.ki_vanning_forbruk_totalt', 5230, { integrasjon: 'ki_vanning', ki_type: 'total', state_class: 'total_increasing', unit_of_measurement: 'L' });
    return S;
  },
};

async function page(cfg, extra, vp) {
  const p = await b.newPage({ viewport: vp || { width: 400, height: 900 }, hasTouch: true });
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + resolve('test/harness.html'));
  for (const m of mocks) await p.addScriptTag({ path: m });
  await p.addScriptTag({ path: bundle });
  await p.evaluate(async ({ cfg, extra }) => {
    const h = window.mockHass();
    if (extra) { h.states = { ...h.states, ...extra }; }
    // KI Vanning-statistikk (Historikk) – døgnendring på «Forbruk totalt»
    const old = h.callWS;
    h.callWS = (m) => {
      if (m.type === 'recorder/statistics_during_period' && (m.statistic_ids || []).includes('sensor.ki_vanning_forbruk_totalt')) {
        const rows = Array.from({ length: 20 }, (_, i) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - 19 + i); return { start: d.getTime(), change: [0, 150, 0, 0, 320, 0, 90, 0, 0, 0, 410, 0, 0, 160, 0, 0, 250, 0, 0, 120][i] }; });
        return Promise.resolve({ 'sensor.ki_vanning_forbruk_totalt': rows });
      }
      return old(m);
    };
    window.__h = h;
    const bc = document.createElement('bubble-card');
    bc.setConfig({ type: 'custom:bubble-card', card_type: 'pop-up', hash: '#vanning' });
    bc.innerHTML = '<div class="pop"><div class="hdr">Vanning</div><div class="inner"></div></div>';
    document.getElementById('dash').appendChild(bc);
    location.hash = '#vanning';
    const c = document.createElement('msh-vanning-card');
    c.setConfig({ type: 'custom:msh-vanning-card', card_id: 'pop-vanning', ...(cfg || {}) });
    c.hass = h;
    bc.querySelector('.inner').appendChild(c);
    window.__c = c;
    await new Promise((q) => setTimeout(q, 700));
  }, { cfg, extra });
  return p;
}
const wait = (p, ms) => p.evaluate((ms) => new Promise((q) => setTimeout(q, ms)), ms);
const click = async (p, sel) => { await p.evaluate((sel) => { const e = window.__c.shadowRoot.querySelector(sel); if (!e) throw new Error('fant ikke ' + sel); e.click(); }, sel); await wait(p, 250); };
const tab = (p, k) => click(p, `[data-act="tab"][data-t="${k}"]`);
const txt = (p, sel) => p.evaluate((sel) => [...window.__c.shadowRoot.querySelectorAll(sel)].map((e) => e.textContent.replace(/\s+/g, ' ').trim()), sel);
const calls = (p) => p.evaluate(() => window.__calls.filter((c) => c[0] !== 'ws').slice());
const clearCalls = (p) => p.evaluate(() => { window.__calls.length = 0; });
const shot = async (p, n) => { if (shots) await p.screenshot({ path: `${shots}/van-${n}.png`, fullPage: true }); };
const one = (p) => p.evaluate(() => { const inner = document.querySelector('.inner'); return [...inner.children].map((e) => e.localName); });

// ================================================================ A · OpenSprinkler via prefiks (ki-cards-logikken)
let p = await page({}, MOCK.os());
ok('ett kort i popupen (ingen hero-kort ved siden av)', (await one(p)).join() === 'msh-vanning-card', await one(p));
let H = await p.evaluate(() => { const sr = window.__c.shadowRoot, s = sr.querySelector('.scene'), r = s.getBoundingClientRect(), g = sr.querySelector('.scene .cog').getBoundingClientRect(); return { h: Math.round(r.height), rad: getComputedStyle(s).borderRadius, cog: [Math.round(g.width), Math.round(g.height)], t: sr.querySelector('.tittel').textContent, u: sr.querySelector('.under').textContent, first: sr.querySelector('.wrap').firstElementChild.className }; });
ok('A · toppkort først: hagescene 184 px, r28, tannhjul 44×44', H.h === 184 && H.rad === '28px' && H.cog.join('x') === '44x44' && /scene/.test(H.first), H);
ok('A · «Klar til vanning» fra OpenSprinkler (prefiks os_hage)', H.t === 'Klar til vanning', H);
let T = await txt(p, '.tabs .tab');
ok('A · faner Nå · Soner · Program · Historikk skjult uten KI-statistikk', T.join('|').startsWith('Nå|Soner|Program') && !T.includes('Historikk'), T);
await tab(p, 'soner');
let Z = await p.evaluate(() => { const sr = window.__c.shadowRoot; return { g: [...sr.querySelectorAll('.gh .gn')].map((e) => e.textContent), z: [...sr.querySelectorAll('.zc')].map((e) => e.querySelector('.zk').textContent.trim() + '|' + (e.classList.contains('dis') ? 'dis' : '') + '|' + (e.querySelector('[data-act="aktiver"]') ? 'aktiver' : '')), sz: getComputedStyle(sr.querySelector('.zi')).width }; });
ok('A · soner gruppert på boks (Boks 1, Boks 2)', Z.g.join() === 'Boks 1,Boks 2', Z);
ok('A · deaktivert sone dimmet med «Aktiver»', Z.z.some((x) => /S06/.test(x) && /dis\|aktiver/.test(x)), Z);
ok('A · ikonsirkel 52 px', Z.sz === '52px', Z);
await shot(p, 'a-soner');
await click(p, '.zc[data-key="z-S01"] [data-act="zexp"]');
let X = await p.evaluate(() => { const sr = window.__c.shadowRoot, x = sr.querySelector('.zx'); return x ? { seg: [...x.querySelectorAll('.sg')].map((e) => e.textContent), start: x.querySelector('.start').textContent.trim(), deakt: !!x.querySelector('[data-act="deaktiver"]') } : null; });
ok('A · trykk på sone åpner varighet 5/10/15/30, Start og Deaktiver', X && X.seg.join() === '5 min,10 min,15 min,30 min' && /Start 10 min/.test(X.start) && X.deakt, X);
await clearCalls(p);
await click(p, '[data-act="zmin"][data-m="15"]');
await click(p, '[data-act="zstart"]');
let CA = await calls(p);
ok('A · Start 15 min → opensprinkler.run_station (900 s) på sonen', CA.some((c) => c[0] === 'opensprinkler' && c[1] === 'run_station' && c[2].run_seconds === 900), CA);
await clearCalls(p);
await click(p, '[data-act="aktiver"]');
CA = await calls(p);
ok('A · Aktiver = homeassistant.toggle på station_enabled', CA.some((c) => c[1] === 'toggle' && /s06_hekk_station_enabled/.test(c[2].entity_id)), CA);
await tab(p, 'programmer');
let P = await p.evaluate(() => { const sr = window.__c.shadowRoot; return { sh: sr.querySelector('.sh').textContent.replace(/\s+/g, ' ').trim(), pc: [...sr.querySelectorAll('.pc')].map((e) => ({ t: e.textContent.replace(/\s+/g, ' ').trim(), rediger: e.getAttribute('data-act') === 'rediger' })), nytt: !!sr.querySelector('[data-act="nytt"]') }; });
ok('A · Program: «Fra OpenSprinkler · endres i OpenSprinkler», ingen redigering', /Fra OpenSprinkler/.test(P.sh) && /endres i OpenSprinkler/.test(P.sh) && P.pc.length === 1 && !P.pc[0].rediger && !P.nytt && /06:00/.test(P.pc[0].t), P);
await clearCalls(p);
await click(p, '.pc [data-act="ptog"]');
CA = await calls(p);
ok('A · programbryter = x.bryter (toggle)', CA.some((c) => c[1] === 'toggle' && /morgen_program_enabled/.test(c[2].entity_id)), CA);
await tab(p, 'naa');
await clearCalls(p);
await click(p, '[data-act="regn"]');
CA = await calls(p);
ok('A · Regnpause-bryter → opensprinkler.set_rain_delay 24 t', CA.some((c) => c[0] === 'opensprinkler' && c[1] === 'set_rain_delay' && c[2].rain_delay === 24), CA);
await p.close();

// ---------------- regnpause: skyer og regn
p = await page({}, MOCK.os(null, true));
H = await p.evaluate(() => { const sr = window.__c.shadowRoot, s = sr.querySelector('.scene'); return { cls: s.className, t: sr.querySelector('.tittel').textContent, sky: sr.querySelectorAll('.skyer .sky').length, rd: sr.querySelectorAll('.skyer .rd').length, op: getComputedStyle(sr.querySelector('.skyer')).opacity, anim: getComputedStyle(sr.querySelector('.rd')).animationName, filter: getComputedStyle(s.querySelector('svg')).filter }; });
ok('Regnpause: dimmet scene, 3 skyer og skrå regndråper', /regn/.test(H.cls) && H.t === 'Regnpause – hagen hviler' && H.sky === 3 && H.rd > 10 && H.anim === 'va-rainfall' && /brightness/.test(H.filter), H);
await shot(p, 'b-regn');
await p.close();

// ---------------- sone som vanner: nedtelling, ring og Stopp
p = await page({}, MOCK.os('05'));
H = await p.evaluate(() => { const sr = window.__c.shadowRoot; return { t: sr.querySelector('.tittel').textContent, u: sr.querySelector('.under').textContent, run: !!sr.querySelector('.card.run [data-act="stopp"]') }; });
ok('Vanner: «Vanner S05 Plen nord», «x:xx igjen» og Stopp', /^Vanner S05 Plen nord$/.test(H.t) && /\d:\d\d igjen/.test(H.u) && H.run, H);
await tab(p, 'soner');
H = await p.evaluate(() => { const sr = window.__c.shadowRoot, z = sr.querySelector('.zc.on'); return z ? { ring: getComputedStyle(z.querySelector('.zi')).backgroundImage.slice(0, 16), st: z.querySelector('.zs').textContent } : null; });
ok('Vanner: sonen har blå conic-gradient-ring og «Vanner · x:xx igjen»', H && /conic-gradient/.test(H.ring) && /Vanner · \d:\d\d igjen/.test(H.st), H);
await shot(p, 'c-vanner');
await p.close();

// ================================================================ B · KI Vanning (ventilmodus)
p = await page({}, MOCK.ki());
H = await p.evaluate(() => { const sr = window.__c.shadowRoot; return { t: sr.querySelector('.tittel').textContent, u: sr.querySelector('.under').textContent, bunn: sr.querySelector('.bunn .tall').textContent, nx: sr.querySelector('.card.nx').textContent.replace(/\s+/g, ' ').trim(), tabs: [...sr.querySelectorAll('.tabs .tab')].map((e) => e.textContent.trim()) }; });
ok('B · KI Vanning: neste vanning og «120 L av 300 L i dag»', /Neste: Morgen · i morgen 06:00/.test(H.u) && /120 L av 300 L i dag/.test(H.bunn) && /I morgen/.test(H.nx) && /06:00/.test(H.nx) && /S01 Veranda Bed/.test(H.nx) && /10 min · 80 L/.test(H.nx), H);
ok('B · Historikk-fanen finnes (KI-statistikk)', H.tabs.includes('Historikk'), H.tabs);
await clearCalls(p);
await click(p, '[data-act="kjorneste"]');
CA = await calls(p);
ok('B · Kjør nå → ki_vanning.kjor_program Morgen', CA.some((c) => c[0] === 'ki_vanning' && c[1] === 'kjor_program' && c[2].program === 'Morgen'), CA);
await tab(p, 'programmer');
P = await p.evaluate(() => { const sr = window.__c.shadowRoot; return { nytt: !!sr.querySelector('[data-act="nytt"]'), pc: [...sr.querySelectorAll('.pc')].map((e) => e.textContent.replace(/\s+/g, ' ').trim()) }; });
ok('B · Program: «+ Nytt» og kort «Ma · To · 2 soner · 20 min»', P.nytt && P.pc.some((x) => /06:00/.test(x) && /Ma · To · 2 soner · 20 min/.test(x)), P);
await click(p, '.pc[data-act="rediger"]');
let E = await p.evaluate(() => { const sr = window.__c.shadowRoot, e = sr.querySelector('.ed'); return e ? { navn: e.querySelector('[data-input="pnavn"]').value, dager: [...e.querySelectorAll('.dy.on')].map((x) => x.textContent), soner: e.querySelectorAll('.cb.on').length, sum: e.querySelector('.sum').textContent, slett: !!e.querySelector('[data-act="pslett"]') } : null; });
ok('B · trykk på program åpner skjemaet (navn, Ma+To, 2 soner, 20 min · ca 200 L, Slett)', E && E.navn === 'Morgen' && E.dager.join() === 'Ma,To' && E.soner === 2 && /20 min totalt · ca 200 L/.test(E.sum) && E.slett, E);
await shot(p, 'd-skjema');
await click(p, '[data-act="pdag"][data-v="fre"]');
await click(p, '[data-act="pmin"][data-d="1"]');
await clearCalls(p);
await click(p, '[data-act="plagre"]');
CA = await calls(p);
const lag = CA.find((c) => c[0] === 'ki_vanning' && c[1] === 'lag_program');
ok('B · Lagre → ki_vanning.lag_program med dager og minutter', lag && lag[2].navn === 'Morgen' && lag[2].dager.join() === 'man,tor,fre' && lag[2].soner[0].min === 11, lag);
await click(p, '.pc[data-act="rediger"]');
await clearCalls(p);
await click(p, '[data-act="pslett"]');
CA = await calls(p);
ok('B · Slett → ki_vanning.slett_program', CA.some((c) => c[1] === 'slett_program' && c[2].navn === 'Morgen'), CA);
await click(p, '[data-act="nytt"]');
E = await p.evaluate(() => !!window.__c.shadowRoot.querySelector('.ed [data-act="pavbryt"]'));
await click(p, '[data-act="pavbryt"]');
ok('B · «+ Nytt» åpner tomt skjema, Avbryt lukker', E && !(await p.evaluate(() => !!window.__c.shadowRoot.querySelector('.ed'))), E);
await tab(p, 'historikk');
await wait(p, 400);
let HI = await p.evaluate(() => { const sr = window.__c.shadowRoot; return { hero: !!sr.querySelector('.vhero'), seg: [...sr.querySelectorAll('.seg.top .sg')].map((e) => e.textContent), bars: sr.querySelectorAll('.h14 .b').length, mline: !!sr.querySelector('.mline'), sum: sr.querySelector('[data-key="h14"] .b34').textContent }; });
ok('B · Historikk: vann-toppkort, Liste|Kalender, 14 søyler med stiplet linje', HI.hero && HI.seg.join() === 'Liste,Kalender' && HI.bars === 14 && HI.mline && /\d/.test(HI.sum), HI);
await click(p, '[data-act="hvis"][data-v="kalender"]');
HI = await p.evaluate(() => { const sr = window.__c.shadowRoot; return { cells: sr.querySelectorAll('.cal .cc').length, filled: [...sr.querySelectorAll('.cal .cc')].filter((e) => /color-mix/.test(e.getAttribute('style'))).length, dots: [...sr.querySelectorAll('.cal .cdot')].filter((e) => e.style.opacity === '1').length }; });
ok('B · Historikk-kalender: 42 dager, målte dager fylt, planlagte (Ma/To) med prikk', HI.cells === 42 && HI.filled >= 3 && HI.dots >= 2, HI);
await shot(p, 'e-hist-kal');
await p.close();
// egne grupper + sonenavn + skjult sone
p = await page({ grupper: [{ id: 'g1', navn: 'Foran' }, { id: 'g2', navn: 'Bak' }], sonegruppe: { S01: 'g2', S02: 'g1' }, sonenavn: { S02: 'Gressplen' }, skjul_soner: ['S03'] }, MOCK.ki());
await tab(p, 'soner');
Z = await p.evaluate(() => { const sr = window.__c.shadowRoot; return { g: [...sr.querySelectorAll('.gh .gn')].map((e) => e.textContent), z: [...sr.querySelectorAll('.zc .zk')].map((e) => e.textContent.trim()) }; });
ok('B · egne grupper overstyrer boks, eget sonenavn, skjult sone borte', Z.g.join() === 'Foran,Bak' && Z.z.join('|') === 'S02Gressplen|S01Veranda Bed', Z);
await click(p, '[data-act="fold"][data-g="g1"]');
Z = await p.evaluate(() => window.__c.shadowRoot.querySelectorAll('.zc').length);
ok('B · chevron folder gruppen', Z === 1, Z);
await p.close();
// styring = OpenSprinkler → ingen redigering selv med KI Vanning
p = await page({ styring: 'opensprinkler' }, MOCK.ki());
await tab(p, 'programmer');
P = await p.evaluate(() => { const sr = window.__c.shadowRoot; return { nytt: !!sr.querySelector('[data-act="nytt"]'), red: !!sr.querySelector('.pc[data-act="rediger"]') }; });
ok('B · «Styring av programmer: OpenSprinkler» slår av redigering', !P.nytt && !P.red, P);
await p.close();

// ================================================================ C · KI Vann (Forbruk) + reserve
p = await page({ flow_rate: 8 });
await tab(p, 'forbruk');
let F = await p.evaluate(() => { const sr = window.__c.shadowRoot, v = sr.querySelector('.vhero'); return { vv: v.querySelector('.vv').textContent, vs: v.querySelector('.vs').textContent, chips: v.querySelectorAll('.vc').length, fyll: v.style.getPropertyValue('--fyll'), waves: v.querySelectorAll('.wave').length, idag: sr.querySelector('[data-key="idag"]').textContent.replace(/\s+/g, ' ').trim(), band: sr.querySelectorAll('.band i').length, hvor: !!sr.querySelector('[data-key="hvor"]'), meter: (v.querySelector('.vm') || {}).textContent || '' }; });
ok('C · vann-toppkort: 286 L, 72 % av målet, fyll ≤ 42 %, 2 bølger, 3 chips', F.vv === '286L' && /72 % av målet/.test(F.vs) && parseFloat(F.fyll) <= 42 && parseFloat(F.fyll) > 25 && F.waves === 2 && F.chips === 3, F);
ok('C · målerstand «m³ · målt hh:mm»', /m³ · målt \d\d:\d\d/.test(F.meter), F.meter);
ok('C · «I dag»: % av mål, fordelingsbånd, kategorier, per person og forklart', /72 % av mål/.test(F.idag) && /av 400 L/.test(F.idag) && F.band === 7 && /Dusj\s*118 L/.test(F.idag) && /143 L per person/.test(F.idag) && /72 % forklart/.test(F.idag), F.idag);
ok('C · «Hvor gikk vannet» fra hendelsene', F.hvor, F);
await shot(p, 'f-forbruk');
await click(p, '[data-act="fvis"][data-v="kalender"]');
await wait(p, 400);
F = await p.evaluate(() => { const sr = window.__c.shadowRoot; const cc = [...sr.querySelectorAll('.cal .cc')]; return { n: cc.length, med: cc.filter((e) => e.querySelector('.cl').textContent).length, farger: [...new Set(cc.map((e) => (e.getAttribute('style').match(/var\(--(green|orange)/) || [])[1]).filter(Boolean))] }; });
ok('C · Forbruk-kalender: liter i cellene, grønn under / oransje over mål', F.n === 42 && F.med >= 5 && F.farger.includes('green') && F.farger.includes('orange'), F);
await click(p, '[data-act="fdag"]');
await shot(p, 'g-forbruk-kal');
await tab(p, 'naa');
H = await p.evaluate(() => { const sr = window.__c.shadowRoot; return { t: sr.querySelector('.tittel').textContent, nx: sr.querySelector('.card.nx').textContent.replace(/\s+/g, ' ').trim(), d7: sr.querySelectorAll('.wk .wkc').length, sw: sr.querySelectorAll('.sw2 .tg').length }; });
ok('C · reserve (valve/switch + OpenSprinkler via plattform + kalender): Nå med «Vanner nå» (valve åpen), 7 dager og to brytere', /Vanner nå/.test(H.nx) && /Stopp/.test(H.nx) && /Vanner/.test(H.t) && H.d7 === 7 && H.sw === 2, H);
await p.close();
// tomt: ingen mock-verdier
p = await page({ area: 'finnes_ikke', opensprinkler: false, vann_prefiks: 'sensor.x_' });
await p.evaluate(() => { const h = { ...window.__h, states: { ...window.__h.states } }; Object.keys(h.states).filter((k) => /hjemme_/.test(k)).forEach((k) => delete h.states[k]); window.__c.hass = h; });
await wait(p, 300);
H = await p.evaluate(() => { const sr = window.__c.shadowRoot; return { bunn: sr.querySelector('.bunn .tall').textContent, nx: sr.querySelector('.card.nx').textContent.replace(/\s+/g, ' ').trim(), tabs: [...sr.querySelectorAll('.tabs .tab')].map((e) => e.textContent.trim()) }; });
ok('Tomt: «–» og «Velg entitet», ingen tall fra designet', H.bunn === '–' && /Ingen planlagt/.test(H.nx) && /Velg entitet/.test(H.nx) && !/242|962/.test(H.nx), H);
await p.close();

// ================================================================ D · Tilpass Vanning ↔ GUI-editor, faner 360 px, dra
p = await page({}, MOCK.ki(), { width: 360, height: 800 });
T = await p.evaluate(() => [...window.__c.shadowRoot.querySelectorAll('.tabs .tab .tl')].map((e) => [e.textContent, e.scrollWidth <= e.clientWidth + 1]));
ok('D · 360 px: ingen avkuttet fanetekst', T.length === 5 && T.every((x) => x[1]), T);
await shot(p, 'h-360');
let S = await p.evaluate(async () => {
  const ui = window.__c.customize(); window.__ui = ui; await new Promise((q) => setTimeout(q, 300));
  const ed = ui.editor, R = ed.shadowRoot;
  const tabs = [...R.querySelectorAll('.tabs [role="tab"]')].map((e) => e.getAttribute('aria-label') || e.textContent.trim());
  const inPortal = !window.__c.shadowRoot.contains(ed) && ed.getRootNode() !== window.__c.shadowRoot;
  // skru av Program-fanen
  R.querySelector('[data-op="fane"][data-v="programmer"]').click(); await new Promise((q) => setTimeout(q, 250));
  const live = [...window.__c.shadowRoot.querySelectorAll('.tabs .tab')].map((e) => e.getAttribute('aria-label'));
  // dra-håndtak: touch-action none og stopPropagation (når ikke dokumentet)
  let leaked = 0; const spy = () => leaked++; document.addEventListener('pointerdown', spy); document.addEventListener('touchstart', spy);
  const hd = R.querySelector('[data-vdrag="fane"]'), r = hd.getBoundingClientRect(), ta0 = [getComputedStyle(hd).touchAction, hd.isConnected, hd.style.touchAction];
  hd.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true, clientX: r.left + 4, clientY: r.top + 4, pointerId: 3 }));
  try { const t = new Touch({ identifier: 3, target: hd, clientX: r.left + 4, clientY: r.top + 4 }); hd.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, composed: true, touches: [t] })); } catch (e) { /* */ }
  hd.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, composed: true, pointerId: 3 }));
  document.removeEventListener('pointerdown', spy); document.removeEventListener('touchstart', spy);
  // Soner-fanen: grupper + soner
  R.querySelector('.tabs [role="tab"][data-v="soner"]').click(); await new Promise((q) => setTimeout(q, 200));
  R.querySelector('[data-op="gny"]').click(); await new Promise((q) => setTimeout(q, 200));
  const soner = R.querySelectorAll('[data-vl="sone"]').length, gr = R.querySelectorAll('[data-vg]').length;
  R.querySelector('.tabs [role="tab"][data-v="entiteter"]').click(); await new Promise((q) => setTimeout(q, 200));
  const ents = R.textContent;
  R.querySelector('.tabs [role="tab"][data-v="avansert"]').click(); await new Promise((q) => setTimeout(q, 200));
  const av = R.textContent;
  const draft = { ...ed._config };
  return { tabs, inPortal, live, ta: ta0[0], ta0, leaked, soner, gr, draft, ents: ['KI Vanning-oversikt', 'Anlegget', 'Regnpause', 'Vintermodus', 'Strømtrekk', 'Vannmåler totalt', 'KI Vann-prefiks', 'KI Vann-modell'].filter((x) => !ents.includes(x)), av: ['Vis vannmåler', 'Haptikk', 'Styring av programmer', 'Dagsmål', 'Stopp alt nå', 'Tilbakestill til standard'].filter((x) => !av.includes(x)) };
});
ok('D · Tilpass Vanning: fire faner Faner · Soner · Entiteter · Avansert, portalt ut av kortet', S.tabs.join() === 'Faner,Soner,Entiteter,Avansert' && S.inPortal, S);
ok('D · av/på for fane vises straks i kortet (utkast)', !S.live.includes('Program') && S.live.includes('Soner'), S.live);
ok('D · dra-håndtak: touch-action none, pointerdown/touchstart når ikke dokumentet', S.ta === 'none' && S.leaked === 0, S);
ok('D · Soner: grupper (+ Ny gruppe) og alle soner', S.gr === 1 && S.soner === 3 && Array.isArray(S.draft.grupper), S);
ok('D · Entiteter og Avansert har alle radene', !S.ents.length && !S.av.length, { ents: S.ents, av: S.av });
await shot(p, 'i-tilpass');
// GUI-editoren: samme skjema, lagrer til config
await p.evaluate(() => window.__ui.overlay.close()); await wait(p, 500);
const G = await p.evaluate(async () => {
  const ed = window.__c.constructor.getConfigElement(); ed.hass = window.__h; ed.setConfig({ type: 'custom:msh-vanning-card', card_id: 'pop-vanning' }); document.body.appendChild(ed);
  await new Promise((q) => setTimeout(q, 200));
  let got = null; ed.addEventListener('config-changed', (e) => { got = e.detail.config; });
  const tabs = [...ed.shadowRoot.querySelectorAll('.tabs [role="tab"]')].map((e) => e.getAttribute('aria-label') || e.textContent.trim());
  ed.shadowRoot.querySelector('[data-a="sel"][data-name="fanevisning"][data-v="ikoner"]').click(); await new Promise((q) => setTimeout(q, 150));
  const c = window.__c; c.setConfig(got); await new Promise((q) => setTimeout(q, 200));
  const labels = c.shadowRoot.querySelectorAll('.tabs .tab .tl').length;
  ed.remove();
  return { tabs, got, labels };
});
ok('D · GUI-editor: samme fire faner, fanevisning → config, kortet viser bare ikoner', G.tabs.join() === 'Faner,Soner,Entiteter,Avansert' && G.got && G.got.fanevisning === 'ikoner' && G.labels === 0, G);
await p.close();

// ================================================================ demo av/på (ki-cards `demo:`)
p = await page({ demo: true, faner: ['soner', 'naa'] });
Z = await p.evaluate(() => { const sr = window.__c.shadowRoot; return { g: [...sr.querySelectorAll('.gh .gn')].map((e) => e.textContent), t: sr.querySelector('.tittel').textContent, demo: !!sr.querySelector('.demo') }; });
ok('demo: true → DEMO-merke, boks 1–3 og «Vanner S05 Plen nord»', Z.demo && Z.g.join() === 'Boks 1,Boks 2,Boks 3' && /Vanner S05 Plen nord/.test(Z.t), Z);
await p.close();

await b.close();
try { (await import('node:fs')).unlinkSync(bundle); } catch (e) { /* */ }
console.log(JSON.stringify(res, null, 1));
if (errs.length) console.log('Sidefeil:', errs.slice(0, 5));
console.log(fail.length || errs.length ? `\n${fail.length} feilet${errs.length ? ` · ${errs.length} sidefeil` : ''}` : '\nAlle bestod');
process.exit(fail.length || errs.length ? 1 : 0);
