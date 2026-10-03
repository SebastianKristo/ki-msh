// Fiks 31.2 · Varmepumpe 1:1 etter «design/Varmepumpe v3.dc.html» + rydding (samme metode som 30.1).
//   A · design: mål, farger og tekster i toppkort/KPI/knapper/fanelinje/faneinnhold mot v3, og keyframes fade/spin/flow/flowv/rise
//       (tekstene hentes fra designfilen og sammenlignes som CSS-regler i nettleseren – designfilen kan ikke rendres her)
//   B · rydding: nøyaktig ÉN popup på #varmepumpe (ÉTT msh-varmepumpe-card, card_id varmepumpe), #nibe = alias (replaceState),
//       gamle importerte popups erstattes/migreres, engangsmigrering av ki-store (logget, kjører ikke igjen), Lovelace-
//       ressursen ki-varmepumpe-card.js fjernes, alias-elementet ki-varmepumpe-card
//   C · «Tilpass varmepumpe» (v3-arket): tilpass-geometri (50 px fra toppen, til bunnen, samme høyde i alle faner), fast
//       forhåndsvisning + fanene Knapper · Faner · Entiteter · Visning, dra-håndtak, navn, synlighet, «Knappene viser»/«Fanene
//       viser», entitetsvalg med søk (Alle/Enheter/Entiteter) og Auto, Visning-brytere, Tilbakestill, Ferdig → config,
//       speilet i getConfigElement()
//   node test/varmepumpe31-check.mjs   (SHOTS=<mappe> for skjermbilder) – uavhengig av dato/klokkeslett
import { createRequire } from 'node:module';
import { readdirSync, readFileSync, mkdirSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
mkdirSync('test/.build', { recursive: true });
const bundle = resolve(`test/.build/varmepumpe31-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const shots = process.env.SHOTS || '';
const DESIGN = readFileSync('design/Varmepumpe v3.dc.html', 'utf8');
const KF = Object.fromEntries([...DESIGN.matchAll(/@keyframes (\w+)\{(.*?\})\}/g)].map((m) => [m[1], m[0]]));
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const res = {}, fail = [];
const ok = (name, cond, info) => { res[name] = cond ? 'OK' : ['FEIL', info]; if (!cond) fail.push(name); };
const mocks = readdirSync('test/mock').filter((f) => f.endsWith('.js')).sort().map((m) => resolve('test/mock/' + m));
const errs = [];
async function page(cfg, opt = {}) {
  const p = await b.newPage({ viewport: opt.vp || { width: 420, height: 900 }, hasTouch: true });
  p.on('pageerror', (e) => errs.push(e.message));
  if (opt.logs) p.on('console', (m) => { if (/ki-msh/.test(m.text())) opt.logs.push([m.type(), m.text()]); });
  await p.goto('file://' + resolve('test/harness.html'));
  for (const m of mocks) await p.addScriptTag({ path: m });
  await p.addScriptTag({ path: bundle });
  await p.evaluate(async ({ cfg, card }) => {
    const h = window.mockHass();
    window.__h = h;
    window.__res = [{ id: 'r1', url: '/hacsfiles/ki-cards/ki-varmepumpe-card.js?v=2', res_type: 'module' }, { id: 'r2', url: '/hacsfiles/ki-msh/ki-msh.js?v=1.4.0', res_type: 'module' }, { id: 'r3', url: '/local/min-varmepumpe-ting.js', res_type: 'module' }];
    window.__del = [];
    const ws = h.callWS;
    h.callWS = (m) => {
      if (m.type === 'lovelace/resources') return Promise.resolve(window.__res);
      if (m.type === 'lovelace/resources/delete') { window.__del.push(m.resource_id); return Promise.resolve(null); }
      return ws(m);
    };
    const M = window.MSH;
    if (M.store && !M.store.loaded) await M.store.load(h);
    if (!card) return;
    const bc = document.createElement('bubble-card');
    bc.setConfig({ type: 'custom:bubble-card', card_type: 'pop-up', hash: '#varmepumpe' });
    bc.innerHTML = '<div class="pop"><div class="hdr">Varmepumpe</div><div class="inner"></div></div>';
    document.getElementById('dash').appendChild(bc);
    location.hash = '#varmepumpe';
    const c = document.createElement('msh-varmepumpe-card');
    c.setConfig({ type: 'custom:msh-varmepumpe-card', card_id: 'varmepumpe', ...(cfg || {}) });
    c.hass = h;
    bc.querySelector('.inner').appendChild(c);
    window.__c = c;
    await new Promise((q) => setTimeout(q, 900));
  }, { cfg, card: opt.card !== false });
  return p;
}
const wait = (p, ms) => p.evaluate((ms) => new Promise((q) => setTimeout(q, ms)), ms);
const shot = async (p, n, full = true) => { if (shots) await p.screenshot({ path: `${shots}/varmepumpe31-${n}.png`, fullPage: full }); };

try {
/* ================================================================ A · design */
let p = await page();
const A = await p.evaluate((KF) => {
  const sr = window.__c.shadowRoot, q = (s) => sr.querySelector(s), cs = (s) => (q(s) ? getComputedStyle(q(s)) : {}), r = (s) => { const e = q(s); if (!e) return null; const b = e.getBoundingClientRect(); return { w: Math.round(b.width), h: Math.round(b.height) }; };
  // keyframes: kortets regler vs. designfilens (samme parser – serialisert likt)
  const rules = (sheets) => { const out = {}; sheets.forEach((sh) => { try { [...sh.cssRules].forEach((ru) => { if (ru.type === 7) out[ru.name] = ru.cssText; }); } catch (e) { /* */ } }); return out; };
  const mine = rules([...sr.styleSheets, ...(sr.adoptedStyleSheets || [])]);
  const host = document.createElement('div'); document.body.appendChild(host); const s2 = host.attachShadow({ mode: 'open' }); s2.innerHTML = `<style>${Object.values(KF).join('\n')}</style>`;
  const des = rules([...s2.styleSheets]); host.remove();
  const kf = Object.keys(des).map((k) => [k, mine[k] === des[k]]);
  const top = cs('.top'), cab = cs('.cab'), hz = cs('.hz'), fan = cs('.top .fan'), ph = cs('.top .ph'), phv = cs('.top .phv'), pc = cs('.top .pc');
  const heat = [...sr.querySelectorAll('.top .hr')].map((e) => { const c = getComputedStyle(e); return [c.animationName, c.animationDuration, c.animationDelay, c.animationTimingFunction, c.right]; });
  const fins = [...sr.querySelectorAll('.top .fins span')].map((e) => { const c = getComputedStyle(e); return [Math.round(e.getBoundingClientRect().width), Math.round(e.getBoundingClientRect().height), c.backgroundColor, c.borderRadius].join(' '); });
  const kp = cs('.kp'), kv = cs('.kp .kv'), qb = [...sr.querySelectorAll('.qb')].map((e) => getComputedStyle(e)), tabs = cs('.tabs'), tbOn = cs('.tb.on'), tb = cs('.tb:not(.on)'), gear = cs('.gear'), ah = cs('.ah'), pane = cs('.pane');
  return {
    kf, kfMine: Object.keys(mine),
    top: { ...r('.top'), bg: top.backgroundImage, rad: top.borderRadius }, unit: r('.unit'), cab: { ...r('.cab'), bg: cab.backgroundColor, rad: cab.borderRadius },
    fanc: { ...r('.fanc'), bg: cs('.fanc').backgroundColor }, hz: { ...r('.hz'), bg: hz.backgroundColor, col: hz.color, fs: hz.fontSize }, tank: r('.tank'),
    fan: [fan.animationName, fan.animationTimingFunction, fan.animationIterationCount], pipes: [[ph.animationName, ph.animationDuration], [phv.animationName, phv.animationDuration], [pc.animationName, pc.animationDirection], [ph.height, phv.width]], heat, fins,
    chip: { bg: cs('.chip').backgroundColor, h: r('.chip').h }, kw: { fs: cs('.kw').fontSize, fw: cs('.kw').fontWeight }, ts: { fs: cs('.ts').fontSize, col: cs('.ts').color, t: q('.ts').textContent }, tn: q('.tn').textContent,
    kp: { bg: kp.backgroundColor, rad: kp.borderRadius, pad: kp.padding, fs: kv.fontSize, fw: kv.fontWeight, n: sr.querySelectorAll('.kp').length },
    qb: qb.map((c) => [c.height, c.borderRadius, c.backgroundImage !== 'none' ? 'rosa' : c.boxShadow]), qbN: qb.length,
    tabs: { rad: tabs.borderRadius, bg: tabs.backgroundColor, pad: tabs.padding }, tb: { h: tb.height, rad: tb.borderRadius, fs: tb.fontSize, fw: tb.fontWeight, col: tb.color }, tbOn: { bg: tbOn.backgroundImage, col: tbOn.color },
    gear: { w: r('.gear').w, h: r('.gear').h, rad: gear.borderRadius, bg: gear.backgroundColor }, ah: { h: r('.ah').h, rad: ah.borderRadius, bg: ah.backgroundColor }, pane: [pane.animationName, pane.animationDuration],
    tabTxt: [...sr.querySelectorAll('.tb')].map((e) => e.textContent.trim()), btnTxt: [...sr.querySelectorAll('.qb')].map((e) => e.textContent.trim()), kpTxt: [...sr.querySelectorAll('.kp .kl')].map((e) => e.textContent.trim()),
    prosa: getComputedStyle(q('.prosa')).fontSize + ' ' + getComputedStyle(q('.prosa')).lineHeight, pill: [getComputedStyle(q('.pl')).backgroundColor, getComputedStyle(q('.pl')).color],
  };
}, KF);
ok('A · keyframes fade/spin/flow/flowv/rise er identiske med designfilen', A.kf.length === 5 && A.kf.every(([, s]) => s), A.kf);
ok('A · toppkort 176 px, radius 28, gradient 165° (#2a1d17 → #3a2418 55 % → #5a3019)', A.top.h === 176 && A.top.rad === '28px' && A.top.bg === 'linear-gradient(165deg, rgb(42, 29, 23) 0%, rgb(58, 36, 24) 55%, rgb(90, 48, 25) 100%)', A.top);
ok('A · pumpe 170×150, skap 62×128 #e9e4de r10 10 0 0, vifte-sirkel 40 #2d2d2d, Hz-merke 34×14 #f0a36b 9 px, tank 38 px', A.unit.w === 170 && A.unit.h === 150 && A.cab.w === 62 && A.cab.h === 128 && A.cab.bg === 'rgb(233, 228, 222)' && A.cab.rad === '10px 10px 0px 0px' && A.fanc.w === 40 && A.fanc.bg === 'rgb(45, 45, 45)' && A.hz.w === 34 && A.hz.h === 14 && A.hz.bg === 'rgb(240, 163, 107)' && A.hz.col === 'rgb(43, 22, 8)' && A.hz.fs === '9px' && A.tank.h === 38, A);
ok('A · animasjoner som v3: vifte spin linear infinite, rør flow/flowv 1,2 s (kald: reverse), 3 varmestriper rise 2,4 s ease-in med 0/0,6/1,2 s', A.fan.join() === 'spin,linear,infinite' && A.pipes[0].join() === 'flow,1.2s' && A.pipes[1].join() === 'flowv,1.2s' && A.pipes[2].join() === 'flow,reverse' && A.pipes[3].join() === '3px,3px'
  && A.heat.map((x) => x.slice(0, 4).join(' ')).join('|') === 'rise 2.4s 0s ease-in|rise 2.4s 0.6s ease-in|rise 2.4s 1.2s ease-in' && A.heat.map((x) => x[4]).join() === '10px,23px,36px', A);
ok('A · 5 ribber 9×62 #e8805a r4', A.fins.length === 5 && A.fins.every((f) => f === '9 62 rgb(232, 128, 90) 4px'), A.fins);
ok('A · tekst i toppkortet: «Varmepumpe», chip rgba(240,138,93,.3) 24 px, kW 40/300, «Ute … · … kr» 12 px #cdbfb5', A.tn === 'Varmepumpe' && A.chip.bg === 'rgba(240, 138, 93, 0.3)' && A.chip.h === 24 && A.kw.fs === '40px' && A.kw.fw === '300' && A.ts.fs === '12px' && A.ts.col === 'rgb(205, 191, 181)' && /^Ute .+° · .+ kr$/.test(A.ts.t), A);
ok('A · 3 KPI-kort #3d3d3d r22 padding 12 14, verdi 24/300: Ute · Kompressor · Varmtvann', A.kp.n === 3 && A.kp.bg === 'rgb(61, 61, 61)' && A.kp.rad === '22px' && A.kp.pad === '12px 14px' && A.kp.fs === '24px' && A.kp.fw === '300' && A.kpTxt.join() === 'Ute,Kompressor,Varmtvann', A.kp);
ok('A · hurtigknapper 72 px r22: aktiv rosa gradient, ellers kontur inset 1,5 px #4a4a4a; Boost · Vifte · Eco · Alarm · Wi-Fi', A.qbN === 5 && A.qb.every((x) => x[0] === '72px' && x[1] === '22px') && A.qb.slice(0, 4).every((x) => x[2] === 'rgb(74, 74, 74) 0px 0px 0px 1.5px inset') && A.qb[4][2] === 'rosa' && A.btnTxt.join() === 'Boost,Vifte,Eco,Alarm,Wi-Fi', A.qb);
ok('A · fanelinje #3a3a3a r26 p4, faner 44 px r22 13/500 #afafaf, aktiv rosa (160°) med blekk; Info · Varme · Varmtvann · Luft', A.tabs.rad === '26px' && A.tabs.bg === 'rgb(58, 58, 58)' && A.tabs.pad === '4px' && A.tb.h === '44px' && A.tb.rad === '22px' && A.tb.fs === '13px' && A.tb.fw === '500' && A.tb.col === 'rgb(175, 175, 175)' && A.tbOn.bg === 'linear-gradient(160deg, rgb(242, 138, 201), rgb(246, 201, 196))' && A.tbOn.col === 'rgba(70, 58, 64, 0.95)' && A.tabTxt.join() === 'Info,Varme,Varmtvann,Luft', A);
ok('A · tannhjul 52×52 r26 #3a3a3a; Diagnostikk-knapp 52 px r26 #3d3d3d; faneinnhold fade .3s', A.gear.w === 52 && A.gear.h === 52 && A.gear.rad === '26px' && A.gear.bg === 'rgb(58, 58, 58)' && A.ah.h === 52 && A.ah.rad === '26px' && A.ah.bg === 'rgb(61, 61, 61)' && A.pane.join() === 'fade,0.3s', A);
ok('A · Info-prosa 19 px / 1,75 med lyse piller (#fafafa/#141414)', A.prosa === '19px 33.25px' && A.pill.join() === 'rgb(250, 250, 250),rgb(20, 20, 20)', A);
await shot(p, '1-info');
// faneinnhold – tekster og mål fra v3
const tab = async (k) => { await p.evaluate((k) => window.__c.shadowRoot.querySelector(`[data-act="tab"][data-v="${k}"]`).click(), k); await wait(p, 500); };
await tab('varme');
const V = await p.evaluate(() => { const sr = window.__c.shadowRoot, c = (s) => getComputedStyle(sr.querySelector(s)); return { caps: [...sr.querySelectorAll('.pane .cap, .pane .caprow span:first-child')].map((e) => e.textContent), seg: [c('.seg').backgroundColor, c('.seg').padding, c('.sg').height], ch: c('.ch').height, pm: [c('.pm').width, c('.pm').backgroundColor], sv: [c('.sv').fontSize, c('.sv').fontWeight], rows: [...sr.querySelectorAll('.stp .rl')].map((e) => e.textContent), lst: [c('.lst').backgroundColor, c('.lst').borderRadius, c('.lst').padding] }; });
ok('A · Varme: Driftsstilling (segment #3d3d3d p2, 38 px), Smart Home-modus (chips 36 px), Varmekurve-kort #3d3d3d r24 p4 16, −/+ 40 px #4b4b4b, verdi 20/300', V.caps.join() === 'Driftsstilling,Smart Home-modus,Varmekurve' && V.seg.join() === 'rgb(61, 61, 61),2px,38px' && V.ch === '36px' && V.pm.join() === '40px,rgb(75, 75, 75)' && V.sv.join() === '20px,300' && V.rows.join() === 'Varmekurve,Forskyvning,Ønsket,Stopp av varme' && V.lst.join() === 'rgb(61, 61, 61),24px,4px 16px', V);
await shot(p, '2-varme');
await tab('vv');
const W = await p.evaluate(() => { const sr = window.__c.shadowRoot, c = (s) => getComputedStyle(sr.querySelector(s)); const paths = [...sr.querySelectorAll('svg.gs[data-g="vv"] path')]; return { gc: [c('.gc').backgroundColor, c('.gc').borderRadius], gl: sr.querySelector('.gc .gl').textContent, gv: c('.gc .gv').fontSize, svg: [sr.querySelector('svg.gs').getAttribute('viewBox'), c('svg.gs').height], cols: paths.map((x) => x.getAttribute('stroke') || x.getAttribute('fill')), fb: [c('.fb').height, c('.fb').backgroundColor, c('.fb div').backgroundColor], cap: sr.querySelector('.pane .cap').textContent, boost: [c('.boost').height, c('.boost').borderRadius, c('.boost').backgroundColor, c('.boost').color, sr.querySelector('.boost').textContent.trim()] }; });
ok('A · Varmtvann: graf-kort #3d3d3d r26, «Varmtvann topp (BT7)» 40 px, svg 300×70 → 80 px, BT7 #f0a36b + BT6 #7ab8f0 + areal, fyllingsstripe 6 px', W.gc.join() === 'rgb(61, 61, 61),26px' && W.gl === 'Varmtvann topp (BT7)' && W.gv === '40px' && W.svg.join() === '0 0 300 70,80px' && W.cols.join() === 'rgba(240,163,107,.14),#7ab8f0,#f0a36b' && W.fb.join() === '6px,rgb(42, 42, 42),rgb(240, 163, 107)', W);
ok('A · Varmtvannsbehov + «Varmtvann boost» 56 px r28 #7ab8f0/#10233a', W.cap === 'Varmtvannsbehov' && W.boost.join() === '56px,28px,rgb(122, 184, 240),rgb(16, 35, 58),Varmtvann boost', W);
await shot(p, '3-varmtvann');
await tab('luft');
const L = await p.evaluate(() => { const sr = window.__c.shadowRoot, c = (s) => getComputedStyle(sr.querySelector(s)); return { labels: [...sr.querySelectorAll('.two .gl')].map((e) => e.textContent), gv: c('.two .gv').fontSize, area: sr.querySelector('svg.gs[data-g="luft"] path').getAttribute('fill'), fan: sr.querySelector('.fbh span').textContent, bar: [c('.fbb').height, c('.fbb span').backgroundColor], sw: [c('.sw').width, c('.sw').height, c('.sw').backgroundColor], sws: [...sr.querySelectorAll('.pane .sw')].map((e) => e.getAttribute('aria-label')) }; });
ok('A · Luft: Avtrekk inn (BT20) / Avkast ut (BT21) 34 px, areal rgba(122,184,240,.12), «Viftehastighet avtrekk» med 8 px stolpe #7ab8f0, brytere 50×28', L.labels.join() === 'Avtrekk inn (BT20),Avkast ut (BT21)' && L.gv === '34px' && L.area === 'rgba(122,184,240,.12)' && L.fan === 'Viftehastighet avtrekk' && L.bar.join() === '8px,rgb(122, 184, 240)' && L.sw.join() === '50px,28px,rgb(90, 90, 90)' && L.sws.join() === 'Økt ventilasjon,Nattkjøling', L);
await shot(p, '4-luft');
await p.close();

/* ================================================================ B · rydding */
let logs = [];
p = await page(null, { card: false, logs });
const LEGACY = [{ type: 'custom:gap-card', height: 10 }, { type: 'custom:button-card', entity: 'sensor.vaskerom_nibe_f730_cu_3x400v_varmtvann_topp_bt7_40013' }, { type: 'grid', cards: [{ type: 'custom:button-card', entity: 'switch.vaskerom_nibe_f730_cu_3x400v_midl_luksus_50004' }] },
  { type: 'custom:simple-tabs', tabs: [{ title: 'Varmepumpe', card: { type: 'custom:expander-card', cards: [{ type: 'custom:mini-graph-card', entities: ['sensor.vaskerom_nibe_f730_cu_3x400v_aktuell_kompressorfrekvens_41778'] }] } }] }, { type: 'custom:ki-varmepumpe-card', entity: 'sensor.nibe_utetemperatur' }];
const B = await p.evaluate(async (LEGACY) => {
  const M = window.MSH, h = window.__h, w = (ms) => new Promise((q) => setTimeout(q, ms));
  const S = customElements.get('ll-strategy-dashboard-ki-dashboard') || customElements.get('ll-strategy-ki-dashboard');
  const vp = (d) => d.views[0].cards[0].cards.filter((c) => c.card_type === 'pop-up' && (/varmepumpe|nibe|heat/.test(c.hash) || JSON.stringify(c.cards).includes('varmepumpe')));
  const sum = (L) => L.map((c) => `${c.hash}:${c.cards.map((x) => x.type.replace('custom:', '') + (x.card_id ? '#' + x.card_id : '')).join('+')}`).join(' | ');
  const out = {};
  // 1) ren strategi
  out.plain = sum(vp(await S.generate({}, h)));
  // 2) importert popup i strategi-YAML: gammel #varmepumpe + gammel #nibe → ÉN #varmepumpe med ÉTT kort
  const d2 = await S.generate({ custom_popups: [{ type: 'custom:bubble-card', card_type: 'pop-up', hash: '#varmepumpe', name: 'Varmepumpe', icon: 'mdi:heat-pump', cards: LEGACY }, { type: 'custom:bubble-card', card_type: 'pop-up', hash: '#nibe', name: 'NIBE', icon: 'mdi:heat-pump', cards: LEGACY }] }, h);
  out.imported = sum(vp(d2)); out.inactive = (M.popupReport.inactive || []).map((x) => x.hash + ':' + x.by).join();
  // 3) overstyrt (replace) popup med gamle kort → POPUP_MIGRATE gjør den om til ÉTT kort
  const d3 = await S.generate({ popup_overrides: { '#varmepumpe': { replace: true, config: { type: 'custom:bubble-card', card_type: 'pop-up', hash: '#varmepumpe', name: 'VP', cards: LEGACY } } } }, h);
  out.replaced = sum(vp(d3));
  // 4) engangsmigrering av ki-store
  await M.store.set('migrations', undefined, { immediate: true });
  await M.store.set('custom_popups', [
    { type: 'custom:bubble-card', card_type: 'pop-up', hash: '#nibe', name: 'Vaskerom NIBE', icon: 'mdi:heat-pump', cards: LEGACY },
    { type: 'custom:bubble-card', card_type: 'pop-up', hash: '#varmepumpe', name: 'Varmepumpe', cards: LEGACY },
    { type: 'custom:bubble-card', card_type: 'pop-up', hash: '#egen', name: 'Egen', cards: [{ type: 'markdown', content: 'x' }] },
  ], { immediate: true });
  await M.store.set('popup_overrides', { nibe: { name: 'Min varmepumpe' }, '#vanning': { name: 'Vanning X' } }, { immediate: true });
  await M.store.set('popups', { nibe: { color: 'var(--orange)', prefer: 'custom' }, stue: { name: 'Stua' } }, { immediate: true });
  const I = M.CARD_IDS;
  await M.store.set('cards', { [I.navbar]: { buttons: { x1: { custom: true, label: 'VP', tap: { action: 'navigate', navigation_path: '#nibe' } } } }, [I.prosa]: { pills: [{ text: 'Varmepumpa', tap_action: { action: 'navigate', navigation_path: '#nibe' } }] }, varmepumpe: { anim: false } }, { immediate: true });
  M._vpStoreMig = false;
  const d4 = await S.generate({}, h);
  await w(300);
  out.after = sum(vp(d4)); out.name = (vp(d4)[0] || {}).name;
  out.snap = JSON.parse(JSON.stringify({ cp: M.store.get('custom_popups'), po: M.store.get('popup_overrides'), pu: M.store.get('popups'), cards: M.store.get('cards'), mig: M.store.get('migrations.varmepumpe31') }));
  let writes = 0; const set0 = M.store.set; M.store.set = function (...a) { writes++; return set0.apply(this, a); };
  M._vpStoreMig = false;
  await S.generate({}, h);
  M.store.set = set0;
  out.writes = writes; out.del = window.__del.slice();
  out.canon = M.canonHash('#nibe'); out.all = M.allPopups(h).filter((x) => /varmepumpe|nibe/.test(x.hash)).map((x) => x.hash).join();
  return out;
}, LEGACY);
ok('B · strategien: nøyaktig ÉN popup #varmepumpe med ÉTT msh-varmepumpe-card (card_id varmepumpe), ingen #nibe', B.plain === '#varmepumpe:msh-varmepumpe-card#varmepumpe' && B.canon === '#varmepumpe' && B.all === '#varmepumpe', B);
ok('B · importerte popups (#varmepumpe med gap-card/button-card/grid/simple-tabs/expander/mini-graph/ki-varmepumpe-card og #nibe) → fortsatt ÉN popup med ÉTT kort', B.imported === '#varmepumpe:msh-varmepumpe-card#varmepumpe', B);
ok('B · overstyrt popup med gamle kort → ÉTT msh-varmepumpe-card (POPUP_MIGRATE), ingen entiteter i config', B.replaced === '#varmepumpe:msh-varmepumpe-card#varmepumpe', B);
const C0 = B.snap.cards || {};
ok('B · ki-store: gamle popups (#nibe, #varmepumpe med gamle kort) fjernet, egne beholdes', Array.isArray(B.snap.cp) && B.snap.cp.length === 1 && B.snap.cp[0].hash === '#egen', B.snap.cp);
ok('B · ki-store: popup_overrides nibe → varmepumpe, popups.nibe → popups.varmepumpe (prefer fjernet), andre beholdes', !B.snap.po.nibe && B.snap.po.varmepumpe && B.snap.po.varmepumpe.name === 'Min varmepumpe' && B.snap.po['#vanning'] && !B.snap.pu.nibe && B.snap.pu.varmepumpe.color === 'var(--orange)' && !B.snap.pu.varmepumpe.prefer && B.snap.pu.stue, B.snap);
const js = JSON.stringify(C0);
ok('B · lenker i navbar/prosa: #nibe → #varmepumpe; kortets egen config beholdes', !/"#nibe"/.test(js) && (js.match(/"#varmepumpe"/g) || []).length === 2 && C0.varmepumpe && C0.varmepumpe.anim === false, js);
ok('B · popupen er ÉN (#varmepumpe) og bruker overstyringen fra den gamle nøkkelen', B.after === '#varmepumpe:msh-varmepumpe-card#varmepumpe' && B.name === 'Min varmepumpe', B);
ok('B · migreringen er merket (migrations.varmepumpe31), logget og kjører ikke igjen', B.snap.mig && B.snap.mig.at && B.snap.mig.log.length >= 5 && B.writes === 0, { mig: B.snap.mig, writes: B.writes });
ok('B · admin: Lovelace-ressursen ki-varmepumpe-card.js fjernes (bare den)', [...new Set(B.del)].join() === 'r1', B.del);
const ml = logs.filter(([t, x]) => t === 'info' && /Varmepumpe-migrering/.test(x));
ok('B · migreringen logges i konsollen', ml.length >= 1 && ml.some(([, x]) => /custom_popups #nibe fjernet/.test(x)), ml);
// alias #nibe → #varmepumpe
const Cr = await p.evaluate(async () => {
  const M = window.MSH, h = window.__h, w = (ms) => new Promise((q) => setTimeout(q, ms));
  const S = customElements.get('ll-strategy-dashboard-ki-dashboard') || customElements.get('ll-strategy-ki-dashboard');
  await S.generate({}, h);
  const out = {};
  const n0 = history.length;
  location.hash = '#nibe'; await w(150);
  out.url = location.hash; out.hist = history.length - n0;
  history.replaceState(null, '', location.pathname); await w(50);
  history.pushState(null, '', location.pathname + '#nibe'); window.dispatchEvent(new CustomEvent('location-changed')); await w(50);
  out.nav = location.hash;
  history.replaceState(null, '', location.pathname); await w(50);
  // en helt annen popup på #nibe (ikke varmepumpe) → ingen omdirigering
  await S.generate({ custom_popups: [{ type: 'custom:bubble-card', card_type: 'pop-up', hash: '#nibe', name: 'Notater', icon: 'mdi:note', cards: [{ type: 'markdown', content: 'x' }] }] }, h);
  location.hash = '#nibe'; await w(150);
  out.own = location.hash;
  history.replaceState(null, '', location.pathname); await w(50);
  // alias-elementet ki-varmepumpe-card
  M.varmepumpeDefineAlias();
  const el = document.createElement('ki-varmepumpe-card'); el.setConfig({ type: 'custom:ki-varmepumpe-card', entity: 'sensor.x' }); el.hass = h; document.getElementById('dash').appendChild(el); await w(300);
  const inner = el.querySelector('msh-varmepumpe-card');
  out.alias = inner ? JSON.stringify(inner._rawConfig) : null;
  return out;
});
ok('B · #nibe → #varmepumpe med history.replaceState (URL og HA-navigering)', Cr.url === '#varmepumpe' && Cr.hist <= 1 && Cr.nav === '#varmepumpe', Cr);
ok('B · en helt annen popup på #nibe røres ikke', Cr.own === '#nibe', Cr);
ok('B · alias-elementet ki-varmepumpe-card rendrer msh-varmepumpe-card uten de gamle entitetene + advarsel', (() => { try { const a = JSON.parse(Cr.alias); return a.type === 'custom:msh-varmepumpe-card' && a.card_id === 'varmepumpe' && !a.entity; } catch (e) { return false; } })() && logs.some(([t, x]) => t === 'warning' && /ki-varmepumpe-card» er utgått/.test(x)), Cr);
await p.close();

/* ================================================================ C · Tilpass varmepumpe */
p = await page(null, { vp: { width: 390, height: 844 } });
await p.evaluate(() => window.__c.shadowRoot.querySelector('.gear').click()); await wait(p, 900);
const sheet = () => p.evaluate(() => {
  const port = window.MSH.portals().pop(); if (!port) return null;
  const R = port.shadowRoot, sh = R.querySelector('.sh'), b = sh.getBoundingClientRect(), fix = R.querySelector('.fix'), scr = R.querySelector('.scr');
  return { top: Math.round(b.top), bottom: Math.round(b.bottom), h: Math.round(b.height), vh: innerHeight, tp: port.dataset.tpSheet, title: R.querySelector('.tt').textContent, ok: R.querySelector('.ok').textContent,
    tabs: [...R.querySelectorAll('.et')].map((e) => e.textContent), on: (R.querySelector('.et.on') || {}).textContent, pv: R.querySelector('.pv .cap').textContent, pvq: [...R.querySelectorAll('.pq')].map((e) => e.textContent.trim()), pvt: [...R.querySelectorAll('.pt')].map((e) => e.textContent.trim()),
    fixTop: Math.round(fix.getBoundingClientRect().top), scrOv: getComputedStyle(scr).overflowY, scrDisp: getComputedStyle(scr).display, scrH: scr.scrollHeight, scrC: scr.clientHeight,
    rows: [...R.querySelectorAll('[data-row]')].map((e) => e.dataset.row + (e.classList.contains('off') ? ':av' : '')), names: [...R.querySelectorAll('.nm')].map((e) => e.value), handles: [...R.querySelectorAll('[data-drag]')].map((e) => getComputedStyle(e).touchAction), caps: [...R.querySelectorAll('.scr .cap')].map((e) => e.textContent), segs: [...R.querySelectorAll('.sgb')].map((e) => e.textContent + (e.classList.contains('on') ? '*' : '')),
    okBg: getComputedStyle(R.querySelector('.ok')).backgroundImage };
});
let SH = await sheet();
ok('C · arket: tilpass-geometri (52 px fra toppen, til bunnen – Fiks 40), «Tilpass varmepumpe» + Ferdig (rosa pille)', SH && SH.tp === '1' && SH.top === 52 && SH.bottom === SH.vh && SH.title === 'Tilpass varmepumpe' && SH.ok === 'Ferdig' && /linear-gradient\(145deg, rgb\(242, 133, 201\) -10%, rgb\(245, 205, 198\) 100%\)/.test(SH.okBg), SH);
ok('C · fast forhåndsvisning (knapper + faner + tannhjul) og fanene Knapper · Faner · Entiteter · Visning', SH.pv === 'Forhåndsvisning' && SH.pvq.join() === 'Boost,Vifte,Eco,Alarm,Wi-Fi' && SH.pvt.join() === 'Info,Varme,Varmtvann,Luft' && SH.tabs.join() === 'Knapper,Faner,Entiteter,Visning' && SH.on === 'Knapper', SH);
ok('C · Knapper: 6 rader med dra-håndtak (touch-action none), navnefelt og bryter (Pumpe av); «Knappene viser» Bare ikon / Ikon + tekst', SH.rows.join() === 'boost,vent,pump:av,eco,alarm,wifi' && SH.names.join() === 'Boost,Vifte,Pumpe,Eco,Alarm,Wi-Fi' && SH.handles.every((t) => t === 'none') && SH.caps.join() === 'Hurtigknapper · rekkefølge og navn,Knappene viser' && SH.segs.join() === 'Bare ikon,Ikon + tekst*', SH);
ok('C · scrollområdet er en blokk med overflow-y auto (30.2-mønsteret)', SH.scrOv === 'auto' && SH.scrDisp === 'block', SH);
const h0 = SH.h;
await shot(p, '5-tilpass-knapper', false);
// dra Wi-Fi øverst (touch-pekere)
const drag = await p.evaluate(async () => {
  const R = window.MSH.portals().pop().shadowRoot;
  const hd = R.querySelector('[data-row="wifi"] [data-drag]'), tgt = R.querySelector('[data-row="boost"]');
  const a = hd.getBoundingClientRect(), t = tgt.getBoundingClientRect();
  let reached = false; const l = () => { reached = true; }; document.addEventListener('pointerdown', l);
  const ev = (type, x, y, el) => el.dispatchEvent(new PointerEvent(type, { bubbles: true, composed: true, pointerId: 7, clientX: x, clientY: y, button: 0, pointerType: 'touch' }));
  ev('pointerdown', a.left + 5, a.top + 5, hd);
  document.removeEventListener('pointerdown', l);
  for (let i = 1; i <= 8; i++) ev('pointermove', a.left + 5, a.top + 5 + ((t.top + 4) - (a.top + 5)) * (i / 8), hd);
  ev('pointerup', a.left + 5, t.top + 4, hd);
  await new Promise((q) => setTimeout(q, 500));
  return { reached, rows: [...window.MSH.portals().pop().shadowRoot.querySelectorAll('[data-row]')].map((x) => x.dataset.row).join() };
});
let card = await p.evaluate(() => [...window.__c.shadowRoot.querySelectorAll('.qb')].map((q) => q.getAttribute('aria-label')).join());
ok('C · dra og slipp: Wi-Fi øverst, kortet følger live, pointerdown stoppes (fallgruve 2)', drag.rows === 'wifi,boost,vent,pump,eco,alarm' && card === 'Wi-Fi,Boost,Vifte,Eco,Alarm' && !drag.reached, { drag, card });
// nytt navn + vis Pumpe + Bare ikon
await p.evaluate(async () => {
  const R = window.MSH.portals().pop().shadowRoot, w = (ms) => new Promise((q) => setTimeout(q, ms));
  const i = R.querySelector('.nm[data-k="boost"]'); i.value = 'Turbo'; i.dispatchEvent(new Event('change', { bubbles: true })); await w(200);
  window.MSH.portals().pop().shadowRoot.querySelector('[data-a="bvis"][data-k="pump"]').click(); await w(200);
  window.MSH.portals().pop().shadowRoot.querySelector('[data-a="bmode"][data-k="icon"]').click(); await w(300);
});
card = await p.evaluate(() => ({ b: [...window.__c.shadowRoot.querySelectorAll('.qb')].map((q) => q.getAttribute('aria-label')).join(), lbl: window.__c.shadowRoot.querySelectorAll('.qb .ql').length, pv: [...window.MSH.portals().pop().shadowRoot.querySelectorAll('.pq')].map((e) => e.textContent.trim()).join() }));
ok('C · navnefelt (Boost → Turbo), bryter (Pumpe vises) og «Bare ikon» slår inn i kortet og forhåndsvisningen', card.b === 'Wi-Fi,Turbo,Vifte,Pumpe,Eco,Alarm' && card.lbl === 0 && card.pv === ',,,,,', card);
// Faner
await p.evaluate(() => window.MSH.portals().pop().shadowRoot.querySelector('[data-a="etab"][data-k="t"]').click()); await wait(p, 300);
SH = await sheet();
ok('C · Faner: 4 rader (dra/navn/bryter), «Fanene viser» Ikon / Tekst / Begge (Tekst standard)', SH.rows.join() === 'info,varme,vv,luft' && SH.names.join() === 'Info,Varme,Varmtvann,Luft' && SH.segs.join() === 'Ikon,Tekst*,Begge' && SH.h === h0, SH);
await p.evaluate(async () => {
  const w = (ms) => new Promise((q) => setTimeout(q, ms)), R = () => window.MSH.portals().pop().shadowRoot;
  R().querySelector('[data-a="tmode"][data-k="icon_name"]').click(); await w(200);
  R().querySelector('[data-a="tvis"][data-k="info"]').click(); await w(200);
  const i = R().querySelector('.nm[data-k="vv"]'); i.value = 'VV'; i.dispatchEvent(new Event('change', { bubbles: true })); await w(300);
});
card = await p.evaluate(() => ({ t: [...window.__c.shadowRoot.querySelectorAll('.tb')].map((e) => e.textContent.trim()).join(), ic: window.__c.shadowRoot.querySelectorAll('.tb ha-icon').length }));
ok('C · Faner: «Begge» = ikon + tekst, Info skjult, Varmtvann omdøpt til VV', card.t === 'Varme,VV,Luft' && card.ic === 3, card);
await p.evaluate(async () => { const w = (ms) => new Promise((q) => setTimeout(q, ms)), R = () => window.MSH.portals().pop().shadowRoot; ['varme', 'vv'].forEach((k) => R().querySelector(`[data-a="tvis"][data-k="${k}"]`).click()); await w(200); R().querySelector('[data-a="tvis"][data-k="luft"]').click(); await w(300); });
card = await p.evaluate(() => [...window.__c.shadowRoot.querySelectorAll('.tb')].map((e) => e.textContent.trim()).join());
ok('C · minst én fane må være synlig', card === 'Luft', card);
await p.evaluate(async () => { const R = () => window.MSH.portals().pop().shadowRoot; ['info', 'varme', 'vv'].forEach((k) => R().querySelector(`[data-a="tvis"][data-k="${k}"]`).click()); await new Promise((q) => setTimeout(q, 300)); });
await shot(p, '6-tilpass-faner', false);
// Entiteter
await p.evaluate(() => window.MSH.portals().pop().shadowRoot.querySelector('[data-a="etab"][data-k="e"]').click()); await wait(p, 400);
const E0 = await p.evaluate(() => { const R = window.MSH.portals().pop().shadowRoot, scr = R.querySelector('.scr'); return { caps: [...R.querySelectorAll('.scr .cap')].map((e) => e.textContent), first: [...R.querySelectorAll('.sec')][0].querySelectorAll('.er').length, chips: [...R.querySelectorAll('.ech')].map((e) => e.textContent), cost: R.querySelector('[data-key="er-cost_day"] .eid').textContent, h: Math.round(R.querySelector('.sh').getBoundingClientRect().height), sH: scr.scrollHeight, sC: scr.clientHeight }; });
ok('C · Entiteter: «Funnet på NIBE-enheten» (13 roller) + grupper, chip Auto/Mangler, ID i monospace; samme arkhøyde', E0.caps[0] === 'Funnet på NIBE-enheten' && E0.first === 13 && E0.chips.filter((c) => c === 'Auto').length >= 60 && E0.cost === 'sensor.vaskerom_nibe_daily_energy_cost' && E0.h === h0 && E0.sH > E0.sC, E0);
const scrollEnd = await p.evaluate(async () => { const R = window.MSH.portals().pop().shadowRoot, scr = R.querySelector('.scr'); scr.scrollTop = scr.scrollHeight; await new Promise((q) => setTimeout(q, 100)); const last = R.querySelector('.hint'), b = last.getBoundingClientRect(), s = scr.getBoundingClientRect(); return b.bottom <= s.bottom + 1 && scr.scrollTop > 0; });
ok('C · scrollområdet kommer helt ned til siste rad', scrollEnd);
await p.evaluate(async () => { const R = window.MSH.portals().pop().shadowRoot; R.querySelector('.scr').scrollTop = 0; R.querySelector('[data-a="ent"][data-k="vv"]').click(); await new Promise((q) => setTimeout(q, 300)); });
const E1 = await p.evaluate(async () => {
  const R = () => window.MSH.portals().pop().shadowRoot, w = (ms) => new Promise((q) => setTimeout(q, ms));
  const o = { kinds: [...R().querySelectorAll('.kinds .sgb')].map((e) => e.textContent + (e.classList.contains('on') ? '*' : '')).join(), act: R().querySelector('[data-key="er-vv"] .eact').textContent, heads0: [...R().querySelectorAll('.hits .hh')].map((e) => e.textContent).join() };
  const i = R().querySelector('[data-in="q"]'); i.value = 'bt6'; i.dispatchEvent(new Event('input', { bubbles: true })); await w(200);
  o.focus = R().activeElement === i;
  o.hits = [...R().querySelectorAll('.hits .hit')].map((e) => e.dataset.k);
  R().querySelector('[data-a="kind"][data-k="dev"]').click(); await w(150);
  o.devOnly = [...R().querySelectorAll('.hits .hh')].map((e) => e.textContent).join();
  R().querySelector('[data-a="kind"][data-k="alle"]').click(); await w(150);
  R().querySelector('.hits .hit[data-a="pick"]').click(); await w(400);
  o.chip = R().querySelector('[data-key="er-vv"] .ech').textContent; o.id = R().querySelector('[data-key="er-vv"] .eid').textContent;
  o.kpi = window.__c.shadowRoot.querySelectorAll('.kp .kv')[2].textContent;
  R().querySelector('[data-a="ent"][data-k="vv"]').click(); await w(300);
  R().querySelector('[data-a="auto"][data-k="vv"]').click(); await w(400);
  o.chip2 = R().querySelector('[data-key="er-vv"] .ech').textContent; o.kpi2 = window.__c.shadowRoot.querySelectorAll('.kp .kv')[2].textContent;
  return o;
});
ok('C · Entiteter: «Bytt» åpner søk (Alle/Enheter/Entiteter), søket filtrerer uten å miste fokus, valg = «Overstyrt» og kortet følger, «Auto» tilbake', E1.kinds === 'Alle*,Enheter,Entiteter' && E1.act === 'Lukk' && /Enheter · 1/.test(E1.heads0) && E1.focus && E1.hits.includes('sensor.vaskerom_nibe_hot_water_charging_bt6_40014') && E1.devOnly === '' && E1.chip === 'Overstyrt' && E1.id === 'sensor.vaskerom_nibe_hot_water_charging_bt6_40014' && E1.kpi === '44,1' && E1.chip2 === 'Auto' && E1.kpi2 === '48,6', E1);
await shot(p, '7-tilpass-entiteter', false);
// Visning
await p.evaluate(() => window.MSH.portals().pop().shadowRoot.querySelector('[data-a="etab"][data-k="v"]').click()); await wait(p, 300);
const V0 = await p.evaluate(() => { const R = window.MSH.portals().pop().shadowRoot; return { rows: [...R.querySelectorAll('.vr .vl1')].map((e) => e.textContent).join(), subs: [...R.querySelectorAll('.vr .vl2')].map((e) => e.textContent).join('|'), on: [...R.querySelectorAll('.vr .tsw')].map((e) => e.getAttribute('aria-checked')).join(), reset: R.querySelector('.reset').textContent.trim(), h: Math.round(R.querySelector('.sh').getBoundingClientRect().height) }; });
ok('C · Visning: Animasjoner · Nøkkeltall · Setning i Info · Diagnostikk (alle på) + «Tilbakestill alt»; samme arkhøyde', V0.rows === 'Animasjoner,Nøkkeltall,Setning i Info,Diagnostikk' && V0.subs === 'Vifte, rør og varme i toppkortet|Ute, kompressor og varmtvann|«Kompressoren går på …»|Knappen nederst i popupen' && V0.on === 'true,true,true,true' && V0.reset === 'Tilbakestill alt' && V0.h === h0, V0);
await p.evaluate(async () => { const R = () => window.MSH.portals().pop().shadowRoot; R().querySelector('[data-a="vis"][data-k="kpi"]').click(); await new Promise((q) => setTimeout(q, 200)); R().querySelector('[data-a="vis"][data-k="diag"]').click(); await new Promise((q) => setTimeout(q, 300)); });
card = await p.evaluate(() => ({ kp: window.__c.shadowRoot.querySelectorAll('.kp').length, diag: !!window.__c.shadowRoot.querySelector('[data-key="acc-diag"]') }));
ok('C · Visning: Nøkkeltall og Diagnostikk av → borte i kortet', card.kp === 0 && !card.diag, card);
await shot(p, '8-tilpass-visning', false);
// Ferdig → config
await p.evaluate(async () => { window.MSH.portals().pop().shadowRoot.querySelector('[data-a="done"]').click(); await new Promise((q) => setTimeout(q, 1400)); });
const saved = await p.evaluate(() => { const c = window.__c._rawConfig || {}; return { buttons: c.buttons, bh: c.buttons_hidden, bn: c.button_names, bs: c.button_style, ts: c.tab_style, tn: c.tab_names, th: c.tabs_hidden, kpi: c.kpi, diag: c.diag, ov: c.overrides, open: window.MSH.portals().filter((x) => x.isConnected && x.shadowRoot.querySelector('.vps')).length }; });
ok('C · Ferdig: lagret i kortets config (rekkefølge, navn, synlighet, stiler, Visning), ingen overstyring igjen, arket lukket', JSON.stringify(saved.buttons) === '["wifi","boost","vent","pump","eco","alarm"]' && JSON.stringify(saved.bh) === '[]' && saved.bn && saved.bn.boost === 'Turbo' && saved.bs === 'icon' && saved.ts === 'icon_name' && saved.tn && saved.tn.vv === 'VV' && !saved.th && saved.kpi === false && saved.diag === false && !saved.ov && saved.open === 0, saved);
const gui = await p.evaluate(async () => {
  const el = customElements.get('msh-varmepumpe-card').getConfigElement();
  el.hass = window.__h; el.setConfig(window.__c._rawConfig);
  document.body.appendChild(el);
  await new Promise((q) => setTimeout(q, 500));
  const r = el.shadowRoot;
  const rows = [...r.querySelectorAll('[data-vpk]')].map((x) => x.dataset.vpk + (x.style.opacity ? ':av' : '') + '=' + (x.querySelector('input') ? x.querySelector('input').value : ''));
  el.remove();
  return rows.join();
});
ok('C · GUI-editoren (getConfigElement) speiler rekkefølge, navn og synlighet', gui === 'wifi=,boost=Turbo,vent=,pump=,eco=,alarm=', gui);
// Tilbakestill alt
await p.evaluate(async () => { window.__c.customize('visning'); await new Promise((q) => setTimeout(q, 700)); const R = window.MSH.portals().pop().shadowRoot; R.querySelector('[data-a="reset"]').click(); await new Promise((q) => setTimeout(q, 300)); });
card = await p.evaluate(() => ({ b: [...window.__c.shadowRoot.querySelectorAll('.qb')].map((q) => q.getAttribute('aria-label')).join(), kp: window.__c.shadowRoot.querySelectorAll('.kp').length, t: [...window.__c.shadowRoot.querySelectorAll('.tb')].map((e) => e.textContent.trim()).join(), tab: (window.MSH.portals().pop().shadowRoot.querySelector('.et.on') || {}).textContent }));
ok('C · tannhjul/fokus «visning» åpner Visning; «Tilbakestill alt» → v3-standard i kortet', card.tab === 'Visning' && card.b === 'Boost,Vifte,Eco,Alarm,Wi-Fi' && card.kp === 3 && card.t === 'Info,Varme,Varmtvann,Luft', card);
await p.evaluate(() => { const R = window.MSH.portals().pop(); R.shadowRoot.querySelector('.bg').click(); });
await p.close();
} catch (e) { fail.push('krasj: ' + e.message); console.error(e); }
ok('ingen JS-feil', !errs.length, errs.slice(0, 5));
await b.close();
try { unlinkSync(bundle); } catch (e) { /* */ }
for (const [k, v] of Object.entries(res)) console.log(v === 'OK' ? '  OK  ' : '  FEIL', k, v === 'OK' ? '' : JSON.stringify(v[1]).slice(0, 900));
console.log(fail.length ? `\n${fail.length} feil` : '\nAlt OK');
process.exit(fail.length ? 1 : 0);
