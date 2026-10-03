// Fiks 38 · Rom → Enheter (Rom v4 devices) + klima-toppkortets standard graffarger (brukerens CLAUDE.md):
//  · én av-rad + tre på-rader (rosa / blå / lilla) + egendefinert farge fra «Utseende på kort» (på-regel og bakgrunn av)
//  · aktiv rad: navn øverst 15/500 i --ki-on-accent (#1f1f1f), status under 12/600 rgba(31,31,31,.8),
//    ikon-sirkel 56 px rgba(0,0,0,.12) uten kant, mørkt ikon – kontrast ≥ 4,5:1 (navn) på alle aksentfarger
//  · av-rad: pille --gray100, navn --ki-text, status --ki-text-mid 12/400, ikon-sirkel --gray200 + inset .06, ikon --gray1000
//  · navn = overstyrt navn → friendly_name uten romprefiks; status «Av», «På», «På · 1 W», «Hviler · 3 W», «Lader · 122 W»
//    (effekt fra koblet sensor.*_power, aldri gjettet)
//  · graf: temperatur var(--red) / fukt var(--blue) som standard (også kombinert rom med romfarge), egen farge overstyrer
//  · mørk + lys modus.   Kjør: node test/rom38-check.mjs   (SHOTS=<mappe> lagrer skjermbilder)
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { readdirSync, mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
mkdirSync('test/.build', { recursive: true });
const bundle = resolve(`test/.build/rom38-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const shots = process.env.SHOTS || '';
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const res = [];
const ok = (n, c, i) => res.push(`${c ? '✔' : '✘'} ${n}${!c && i != null ? ' · ' + JSON.stringify(i) : ''}`);

for (const dark of [true, false]) {
  const tag = dark ? 'mørk' : 'lys';
  const p = await b.newPage({ viewport: { width: 390, height: 1100 }, hasTouch: true });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + resolve('test/harness.html'));
  for (const m of readdirSync('test/mock').sort()) await p.addScriptTag({ path: resolve('test/mock/' + m) });
  await p.addScriptTag({ path: bundle });
  const r = await p.evaluate(async (dark) => {
    const M = window.MSH, wait = (ms) => new Promise((q) => setTimeout(q, ms));
    const hass = window.mockHass(); hass.themes = { ...(hass.themes || {}), darkMode: dark };
    if (M.theme && M.theme.update) M.theme.update(hass);
    if (!dark) document.documentElement.setAttribute('data-ki-theme', 'light');
    const t = new Date().toISOString();
    const add = (id, state, attributes, area) => { hass.states[id] = { entity_id: id, state, attributes: { friendly_name: id.split('.')[1], ...attributes }, last_changed: t, last_updated: t, context: {} }; hass.entities[id] = { entity_id: id, platform: 'demo', area_id: area || 'stue', device_id: null }; };
    add('switch.stue_takstikk', 'off', { friendly_name: 'Stue Takstikkontakt' });
    add('switch.stue_pc_hoyttalere', 'on', { friendly_name: 'Stue PC Høyttalere' });
    add('sensor.stue_pc_hoyttalere_power', '1', { device_class: 'power', unit_of_measurement: 'W', friendly_name: 'PC effekt' });
    add('switch.stue_lampe9', 'on', { friendly_name: 'Stue Leselampe' });
    add('switch.stue_billader', 'on', { friendly_name: 'Stue Billader' });
    add('sensor.stue_billader_power', '122', { device_class: 'power', unit_of_measurement: 'W', friendly_name: 'Billader effekt' });
    add('switch.stue_kaffe', 'on', { friendly_name: 'Stue Kaffetrakter' });
    add('sensor.stue_kaffe_power', '3', { device_class: 'power', unit_of_measurement: 'W', friendly_name: 'Kaffe effekt' });
    add('switch.stue_egen', 'on', { friendly_name: 'Stue Julelys' });
    add('switch.stue_egen_av', 'off', { friendly_name: 'Stue Varmekabel' });
    const ids = ['switch.stue_takstikk', 'switch.stue_pc_hoyttalere', 'switch.stue_lampe9', 'switch.stue_billader', 'switch.stue_kaffe', 'switch.stue_egen', 'switch.stue_egen_av'];
    const dash = document.getElementById('dash');
    const cfg = { type: 'custom:msh-rom-card', card_id: 'r38', area: 'stue', include: { enheter: ids }, exclude: Object.keys(hass.states).filter((k) => /^switch\./.test(k) && !ids.includes(k)),
      overrides: { switch: { stue_billader: { on_text: 'Lader · {w} W' } } },
      looks: { switch: { stue_lampe9: { name: 'Leselampe' }, stue_egen: { state_rule_1_background_color: '#c8ddfa' }, stue_egen_av: { background_color: 'var(--yellow, #f2d26f)' } } } };
    const rc = document.createElement('msh-rom-card'); rc.setConfig(cfg); rc.hass = hass; dash.appendChild(rc);
    await wait(400); rc.setUI({ acc: { dev: true } }); await wait(500);
    const R = rc.shadowRoot, cs = (e) => getComputedStyle(e);
    const parse = (s) => { const m = String(s).match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?/); return m ? [+m[1], +m[2], +m[3], m[4] == null ? 1 : +m[4]] : null; };
    const over = (f, bg) => [0, 1, 2].map((i) => f[i] * f[3] + bg[i] * (1 - f[3]));
    const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
    const cr = (a, x) => { const p = lum(a), q = lum(x); return (Math.max(p, q) + 0.05) / (Math.min(p, q) + 0.05); };
    const rowBg = (e) => { const c = cs(e); const img = c.backgroundImage !== 'none' ? parse(c.backgroundImage) : null; const base = parse(c.backgroundColor); return over(img || base, dark ? [58, 58, 58] : [255, 255, 255]); };
    const rows = {};
    ids.forEach((id) => {
      const e = R.querySelector(`[data-key="d-${id}"]`); if (!e) { rows[id] = null; return; }
      const n = e.querySelector('.u-n'), l = e.querySelector('.u-l'), i = e.querySelector('.u-i'), ic = i.querySelector('ha-icon') || i;
      const bg = rowBg(e), nc = parse(cs(n).color), lc = parse(cs(l).color), op = Number(cs(l).opacity);
      const nR = n.getBoundingClientRect(), lR = l.getBoundingClientRect(), iR = i.getBoundingClientRect();
      rows[id] = { cls: e.className, name: n.textContent, status: l.textContent, nameTop: nR.top < lR.top,
        nFs: cs(n).fontSize, nFw: cs(n).fontWeight, sFs: cs(l).fontSize, sFw: cs(l).fontWeight, nCol: cs(n).color, sCol: cs(l).color, sOp: op,
        bgC: cs(e).backgroundColor, bgI: cs(e).backgroundImage.slice(0, 60), circ: cs(i).backgroundColor, circBorder: cs(i).borderTopWidth + ' ' + cs(i).borderTopStyle, circSh: cs(i).boxShadow, icCol: cs(ic).color, iW: Math.round(iR.width),
        crName: cr(over(nc, bg), bg), crStatus: cr(over([lc[0], lc[1], lc[2], lc[3] * op], bg), bg), nameLum: lum(over(nc, bg)), icLum: lum(over(parse(cs(ic).color), bg)), bgLum: lum(bg) };
    });
    // graf
    const deepQ = (root, sel) => { let f = root.querySelector(sel); if (f) return f; for (const e of root.querySelectorAll('*')) if (e.shadowRoot) { f = deepQ(e.shadowRoot, sel); if (f) return f; } return null; };
    const stroke = (card) => { const l = deepQ(card.shadowRoot, '.graph polyline[fill="none"]'); const f = deepQ(card.shadowRoot, '.graph polyline'); return l ? { s: cs(l).stroke, w: l.style.strokeWidth, fill: f && cs(f).fill } : null; };
    const hTab = async (card) => { const k = deepQ(card.shadowRoot, 'msh-rom-klima-card'); const h = k && k.shadowRoot.querySelector('[data-t="h"]'); if (h) h.click(); await wait(300); };
    const g = {};
    g.t = stroke(rc); await hTab(rc); g.h = stroke(rc);
    const r2 = document.createElement('msh-rom-card'); r2.setConfig({ type: 'custom:msh-rom-card', card_id: 'r38b', area: 'stue', look: { col: 'var(--green)' }, graph_t: 'var(--purple, #ad99e6)', graph_h: '#ff00aa', graph_width: 3, graph_fill: 0.4 }); r2.hass = hass; dash.appendChild(r2); await wait(500);
    g.ownT = stroke(r2); await hTab(r2); g.ownH = stroke(r2);
    const r3 = document.createElement('msh-rom-card'); r3.setConfig({ type: 'custom:msh-rom-card', card_id: 'r38c', area: 'stue-kjokken', rooms: ['stue', 'kjokken'], primary: 'stue', name: 'Stue + Kjøkken', color: 'var(--orange)' }); r3.hass = hass; dash.appendChild(r3); await wait(500);
    g.cbT = stroke(r3); await hTab(r3); g.cbH = stroke(r3);
    r2.remove(); r3.remove();
    const rgb = (h) => { const d = document.createElement('div'); d.style.color = h; document.body.appendChild(d); const v = cs(d).color; d.remove(); return v; };
    return { rows, g, red: rgb('#f28073'), blue: rgb('#73b9f2'), purple: rgb('#ad99e6'), own: rgb('#ff00aa'), C: { c1f: rgb('#1f1f1f'), onAcc: rgb('#2a1720'), fa: rgb('#fafafa'), g97: rgb('#979797'), g2f: rgb('#2f2f2f'), g3a: rgb('#3a3a3a'), e1: rgb('#e1e1e1') } };
  }, dark);
  if (shots) { mkdirSync(shots, { recursive: true }); const el = await p.$('msh-rom-card'); const sec = el && await el.evaluateHandle((c) => c.shadowRoot.querySelector('[data-key="sec-dev"]')); if (sec) await sec.asElement().screenshot({ path: `${shots}/rom38-enheter-${tag}.png` }); }
  const R = r.rows, C = r.C;
  const off = R['switch.stue_takstikk'], pc = R['switch.stue_pc_hoyttalere'], lamp = R['switch.stue_lampe9'], bil = R['switch.stue_billader'], kaffe = R['switch.stue_kaffe'], egen = R['switch.stue_egen'], egenAv = R['switch.stue_egen_av'];
  ok(`${tag}: alle rader finnes`, Object.values(R).every(Boolean), Object.keys(R).filter((k) => !R[k]));
  if (!Object.values(R).every(Boolean)) { await p.close(); continue; }
  // tekst og rekkefølge
  ok(`${tag}: navn uten romprefiks / overstyrt navn`, pc.name === 'PC Høyttalere' && lamp.name === 'Leselampe' && off.name === 'Takstikkontakt' && bil.name === 'Billader', [pc.name, lamp.name, off.name, bil.name]);
  ok(`${tag}: status «Av», «På», «På · 1 W», «Hviler · 3 W», «Lader · 122 W»`, off.status === 'Av' && lamp.status === 'På' && pc.status === 'På · 1 W' && kaffe.status === 'Hviler · 3 W' && bil.status === 'Lader · 122 W', [off.status, lamp.status, pc.status, kaffe.status, bil.status]);
  ok(`${tag}: navn øverst, status under (alle rader)`, Object.values(R).every((x) => x.nameTop), Object.fromEntries(Object.entries(R).map(([k, v]) => [k, v.nameTop])));
  // på-rader: rosa / blå / lilla i rekkefølge
  const on3 = [pc, lamp, bil];
  ok(`${tag}: tre på-rader rosa → blå → lilla`, /gradient/.test(pc.bgI) && lamp.bgC === 'rgb(115, 185, 242)' && bil.bgC === 'rgb(174, 150, 230)', on3.map((x) => x.bgI + ' ' + x.bgC));
  const acc = [...on3, egen, egenAv];
  ok(`${tag}: aktiv rad – navn 15/500, status 12/600`, acc.every((x) => x.nFs === '15px' && x.nFw === '500' && x.sFs === '12px' && x.sFw === '600'), acc.map((x) => `${x.nFs}/${x.nFw} ${x.sFs}/${x.sFw}`));
  ok(`${tag}: aktiv rad – navn i --ki-on-accent (#1f1f1f mørk / #2a1720 lys)`, acc.every((x) => x.nCol === (dark ? C.c1f : C.onAcc)), acc.map((x) => x.nCol));
  ok(`${tag}: aktiv rad – status samme farge × .8`, acc.every((x) => x.sCol === x.nCol && Math.abs(x.sOp - 0.8) < 0.01), acc.map((x) => x.sCol + ' ' + x.sOp));
  ok(`${tag}: aktiv rad – ikon-sirkel 56 px rgba(0,0,0,.12) uten kant`, acc.every((x) => x.iW === 56 && x.circ === 'rgba(0, 0, 0, 0.12)' && /^0px/.test(x.circBorder) && x.circSh === 'none'), acc.map((x) => `${x.iW} ${x.circ} ${x.circBorder} ${x.circSh}`));
  ok(`${tag}: aktiv rad – tekst og ikon mørke (lum < .05) på lys aksent`, acc.every((x) => x.nameLum < 0.05 && x.icLum < 0.05 && x.bgLum > 0.3), acc.map((x) => [x.nameLum.toFixed(3), x.icLum.toFixed(3), x.bgLum.toFixed(2)]));
  ok(`${tag}: aktiv rad – kontrast navn ≥ 4,5:1, status ≥ 4,5:1`, acc.every((x) => x.crName >= 4.5 && x.crStatus >= 4.5), acc.map((x) => [x.crName.toFixed(1), x.crStatus.toFixed(1)]));
  ok(`${tag}: egendefinert farge (på-regel #c8ddfa / bakgrunn gul av) brukes`, egen.bgC === 'rgb(200, 221, 250)' && egenAv.bgC === 'rgb(242, 210, 111)', [egen.bgC, egenAv.bgC]);
  // av-rader
  const offs = [off, kaffe];
  ok(`${tag}: av-rad – navn 15/500, status 12/400`, offs.every((x) => x.nFs === '15px' && x.nFw === '500' && x.sFs === '12px' && x.sFw === '400'), offs.map((x) => `${x.nFs}/${x.nFw} ${x.sFs}/${x.sFw}`));
  if (dark) ok('mørk: av-rad – pille #2f2f2f, navn #fafafa, status #979797, sirkel #3a3a3a + inset .06, ikon #e1e1e1', offs.every((x) => x.bgC === C.g2f && x.nCol === C.fa && x.sCol === C.g97 && x.sOp === 1 && x.circ === C.g3a && /0\.06/.test(x.circSh) && x.icCol === C.e1), offs.map((x) => [x.bgC, x.nCol, x.sCol, x.circ, x.circSh, x.icCol]));
  else ok('lys: av-rad – --ki-*-tokens (lys pille, mørk tekst ≥ 4,5:1)', offs.every((x) => x.bgLum > 0.6 && x.crName >= 4.5 && x.crStatus >= 4.5 && x.nameLum < 0.05), offs.map((x) => [x.bgC, x.nCol, x.sCol, x.crName.toFixed(1), x.crStatus.toFixed(1)]));
  // graf
  const g = r.g;
  ok(`${tag}: graf – standard temperatur var(--red)`, g.t && g.t.s === r.red, g.t);
  ok(`${tag}: graf – standard fukt var(--blue)`, g.h && g.h.s === r.blue, g.h);
  ok(`${tag}: graf – kombinert rom med romfarge: rød/blå`, g.cbT && g.cbT.s === r.red && g.cbH && g.cbH.s === r.blue, [g.cbT, g.cbH]);
  ok(`${tag}: graf – egen farge/linje/fyll overstyrer`, g.ownT && g.ownT.s === r.purple && g.ownT.w === '3' && /0\.4\)/.test(g.ownT.fill) && g.ownH && g.ownH.s === r.own, [g.ownT, g.ownH]);
  ok(`${tag}: ingen sidefeil`, !errs.length, errs);
  await p.close();
}
await b.close();
res.forEach((x) => console.log(x));
const bad = res.filter((x) => x.startsWith('✘')).length;
console.log(bad ? `rom38-check: ${bad} FEIL` : `rom38-check: OK (${res.length})`);
process.exit(bad ? 1 : 0);
