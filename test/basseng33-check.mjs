// Fiks 33.1 + 33.2 (+ Del A tokens) · Basseng-setningen og transparent rot – mot EKTE Bubble Card (manuell popup).
//   A · setningen (fasit Basseng v4 popup linje 135, showSent): ÉN <p class="sent"> med to inline-piller, flyter som
//       tekst ved 360 / 390 / PC (1400 px + 256 px sidebar): ingen pille i full bredde, ≤ 3 linjer på mobil, 1 linje på PC,
//       ingen løse tegn («.» o.l.) som egne tekstnoder/linjer, ingen tomme tekstnoder i <p>, punktum rett etter eta-pillen
//   B · tekstlogikk: diff > 0 «Vannet når [mål°] om ca [X t Y min]. Pumpa går nå.» (210 min/°, boost ×0,7, eco ×1,4),
//       ETA-sensor fra integrasjonen vinner, diff ≤ 0 «Vannet holder [mål°] · [ingen oppvarming].», pumpe av «Pumpa står.»,
//       komma i tall (25,5°), mangler data → «–»
//   C · show_sentence (Tilpass → Visning + getConfigElement); showSent/sent (designets navn) leses også
//   D · 33.2 ingen dobbel flate: ingen bakgrunn/radius/padding mellom popupens innhold og kortenes innhold
//       (Basseng, Dørlås, Garasje, Varmepumpe; Klima og Media rapporteres – eies av G4)
//   E · lyst tema (tokens som i Del A-tabellen på containeren): setningen og pillene ≥ 4,5:1, «I dag»-kortet = --ki-surface
//       (hvit), toppkortet er en mørk øy med lys tekst; mørk modus uendret (fallback-verdiene)
//   node test/basseng33-check.mjs   – uavhengig av dato/klokkeslett
import { createRequire } from 'node:module';
import { readdirSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
mkdirSync('test/.build', { recursive: true });
const bundle = resolve(`test/.build/basseng33-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const BC = resolve('test/.vendor/bubble-card.js');
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const res = {}, fail = [], errs = [];
const ok = (name, cond, info) => { res[name] = cond ? 'OK' : ['FEIL', info]; if (!cond) fail.push(name); };
const mocks = readdirSync('test/mock').filter((f) => f.endsWith('.js')).sort().map((m) => resolve('test/mock/' + m));
const LIGHT = { '--ki-bg': '#e6e6e6', '--ki-popup': '#f0f0f0', '--ki-surface': '#ffffff', '--ki-surface-2': '#ebebeb', '--ki-surface-3': '#dedede', '--ki-text': '#1c1c1c', '--ki-text-2': '#5c5c5c', '--ki-text-3': '#858585', '--ki-line': 'rgba(0,0,0,.08)', '--ki-pill-bg': '#1c1c1c', '--ki-pill-fg': '#fafafa', '--ki-on-accent': '#2a1720', '--ki-red-text': 'rgb(186 58 44)', '--ki-green-text': 'rgb(18 128 78)', '--ki-amber-text': 'rgb(168 98 24)', '--ki-blue-text': 'rgb(30 108 178)', '--ki-pink-text': 'rgb(176 48 128)', '--ki-yellow-text': 'rgb(140 108 0)' }; // Del A pkt. 6 (aksent som tekst)

async function open(vp, tag, cfg, light) {
  const p = await b.newPage({ viewport: { width: vp.w, height: vp.h }, hasTouch: true });
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + resolve('test/harness-bubble.html'));
  for (const m of mocks) await p.addScriptTag({ path: m });
  await p.addScriptTag({ path: bundle });
  await p.addScriptTag({ path: BC, type: 'module' });
  await p.waitForFunction(() => customElements.get('bubble-card'), null, { timeout: 15000 });
  await p.evaluate(async ({ vp, tag, cfg, light, LIGHT }) => {
    const wait = (ms) => new Promise((q) => setTimeout(q, ms));
    document.documentElement.style.setProperty('--sb', (vp.sb || 0) + 'px');
    const h = window.mockHass();
    if (light) { h.themes = { ...(h.themes || {}), darkMode: false }; const r = document.documentElement; if (!(window.MSH.theme && window.MSH.theme.update)) { r.setAttribute('data-ki-theme', 'light'); Object.entries(LIGHT).forEach(([k, v]) => r.style.setProperty(k, v)); } /* ellers: ekte MSH.theme (hass.themes.darkMode=false) */ document.body.style.background = '#e6e6e6'; }
    window.__h = h;
    const pop = { type: 'custom:bubble-card', card_type: 'pop-up', name: 'X', icon: 'mdi:pool', hash: '#g3pop', is_sidebar_hidden: true, bg_blur: '5', bg_opacity: '98', margin_top_mobile: '50px', margin_top_desktop: '50px', card_layout: 'large', ...(vp.w > 900 ? { width_desktop: '600px' } : {}), cards: [{ type: 'custom:' + tag, card_id: 'pop-g3', ...(cfg || {}) }] };
    const bc = document.createElement('bubble-card'); bc.setConfig(pop); bc.hass = h; document.getElementById('dash').appendChild(bc); window.__bc = bc;
    await wait(400); location.hash = '#g3pop'; await wait(1600);
    const deepAll = () => { const out = []; const walk = (root) => root.querySelectorAll('*').forEach((e) => { out.push(e); if (e.shadowRoot) walk(e.shadowRoot); }); walk(document); return out; };
    window.__c = deepAll().find((e) => e.localName === tag);
    if (light && window.__c) { const pe = deepAll().find((e) => e.classList && e.classList.contains('bubble-pop-up')); if (pe) pe.style.background = '#f0f0f0'; }
  }, { vp, tag, cfg, light, LIGHT });
  return p;
}
const setStates = (p, patch) => p.evaluate(async (patch) => {
  const h = { ...window.__h, states: { ...window.__h.states } };
  Object.entries(patch).forEach(([id, v]) => { if (v === null) delete h.states[id]; else h.states[id] = { entity_id: id, last_changed: new Date().toISOString(), last_updated: new Date().toISOString(), ...(h.states[id] || {}), ...v, attributes: { ...((h.states[id] || {}).attributes || {}), ...(v.attributes || {}) } }; });
  window.__h = h; window.__bc.hass = h; window.__c.hass = h;
  await new Promise((q) => setTimeout(q, 300));
}, patch);

// ---- målinger av setningen
const measure = (p) => p.evaluate(() => {
  const sr = window.__c.shadowRoot, P = sr.querySelectorAll('p.sent');
  const s = P[0];
  if (!s) return { n: 0 };
  const cs = getComputedStyle(s), lh = parseFloat(cs.lineHeight), r = s.getBoundingClientRect();
  const pills = [...s.querySelectorAll('.pill')].map((x) => { const q = x.getBoundingClientRect(), c = getComputedStyle(x); return { t: x.textContent, w: q.width, h: q.height, disp: c.display, rects: x.getClientRects().length, top: q.top }; });
  const nodes = [...s.childNodes].map((n) => (n.nodeType === 3 ? ['#t', n.nodeValue] : [n.localName, n.className]));
  const emptyText = [...s.childNodes].filter((n) => n.nodeType === 3 && !n.nodeValue.trim()).length;
  // løse tegn: tekstnoder i hele kortet som bare er tegnsetting (f.eks. «.»), eller som ligger rett i en flex/grid-beholder
  const loose = [];
  const walk = (root) => { const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n; while ((n = tw.nextNode())) { const t = n.nodeValue.trim(); if (!t) continue; const par = n.parentNode, d = par && par.nodeType === 1 ? getComputedStyle(par).display : ''; if (/flex|grid/.test(d) && par.children.length && !/^(SPAN|BUTTON|LABEL|A|B|I|svg)$/i.test(par.tagName) && !(par.closest && par.closest('p'))) loose.push([t, par && par.className, d]); } };
  walk(sr);
  // linjer: samle unike topp-verdier for teksten (Range over hele <p>)
  const rg = document.createRange(); rg.selectNodeContents(s);
  const tops = [...new Set([...rg.getClientRects()].map((x) => Math.round(x.top / 4)))];
  const firstOv = sr.querySelector('.wrap > .tabrow + .body > *'); // 42 C.4: fanens innhold ligger i .body
  return { n: P.length, text: s.textContent, disp: cs.display, fs: cs.fontSize, lh, pw: r.width, ph: r.height, lines: Math.round(r.height / lh), tops: tops.length, pills, nodes, emptyText, loose, color: cs.color, first: firstOv && firstOv.localName, pillBg: pills.length ? getComputedStyle(s.querySelector('.pill')).backgroundColor : null, pillFg: pills.length ? getComputedStyle(s.querySelector('.pill')).color : null };
});

/* ---------------- A · flyt ved 360 / 390 / PC */
for (const vp of [{ n: '360', w: 360, h: 800 }, { n: '390', w: 390, h: 844 }, { n: 'PC', w: 1400, h: 900, sb: 256 }]) {
  const p = await open(vp, 'msh-basseng-card');
  const ids = await p.evaluate(() => { const e = window.MSH.poolEnts(window.__h, window.__c.config); return { water: e.water, target: e.target, pump: e.pump }; });
  await setStates(p, { [ids.water]: { state: '24.0' }, [ids.target]: { attributes: { temperature: 25.5 } }, ...(ids.pump ? { [ids.pump]: { state: 'on' } } : {}) });
  const m = await measure(p);
  const pillOk = m.pills && m.pills.length === 2 && m.pills.every((x) => x.disp === 'inline' && x.w < m.pw * 0.75 && x.h < m.lh * 1.3 && x.rects === 1);
  ok(`A · ${vp.n}: én <p class="sent"> først i Oversikt, display:block, 19 px / 1,75`, m.n === 1 && m.first === 'p' && m.disp === 'block' && m.fs === '19px' && Math.abs(m.lh - 33.25) < 0.6, m);
  ok(`A · ${vp.n}: pillene er inline (ikke blokk/flex, ikke full bredde, én boks hver – nowrap)`, pillOk, m.pills);
  ok(`A · ${vp.n}: setningen flyter (${vp.w > 900 ? '1 linje' : '≤ 3 linjer'}), ingen løse tegn, ingen tomme tekstnoder, «.» rett etter eta-pillen`, (vp.w > 900 ? m.lines === 1 : m.lines <= 3) && !m.loose.length && !m.emptyText && m.nodes[4] && m.nodes[4][0] === '#t' && /^\. /.test(m.nodes[4][1] + ' ') && m.nodes.length <= 5, { lines: m.lines, loose: m.loose, nodes: m.nodes });
  ok(`A · ${vp.n}: tekst «Vannet når 25,5° om ca 5 t 15 min. Pumpa går nå.»`, m.text === 'Vannet når 25,5° om ca 5 t 15 min.' + (ids.pump ? ' Pumpa går nå.' : ''), m.text);
  await p.close();
}

/* ---------------- B · tekstlogikk */
{
  const p = await open({ w: 390, h: 844 }, 'msh-basseng-card');
  const ids = await p.evaluate(() => { const e = window.MSH.poolEnts(window.__h, window.__c.config); return { water: e.water, target: e.target, pump: e.pump, mode: e.mode, eta: e.eta }; });
  const txt = async () => (await measure(p)).text;
  await setStates(p, { [ids.water]: { state: '24.0' }, [ids.target]: { attributes: { temperature: 25.5 } }, ...(ids.pump ? { [ids.pump]: { state: 'on' } } : {}), ...(ids.mode ? { [ids.mode]: { state: 'Balansert' } } : {}) });
  let t = await txt();
  ok('B · diff 1,5° → «Vannet når 25,5° om ca 5 t 15 min. Pumpa går nå.» (210 min/°)', t === 'Vannet når 25,5° om ca 5 t 15 min.' + (ids.pump ? ' Pumpa går nå.' : ''), { t, ids });
  if (ids.mode) {
    await setStates(p, { [ids.mode]: { state: 'Boost' } }); const tb = await txt();
    await setStates(p, { [ids.mode]: { state: 'Eco' } }); const te = await txt();
    ok('B · Boost ×0,7 (3 t 41 min) og Eco ×1,4 (7 t 21 min)', /om ca 3 t 41 min\./.test(tb) && /om ca 7 t 21 min\./.test(te), { tb, te });
    await setStates(p, { [ids.mode]: { state: 'Balansert' } });
  } else ok('B · driftsmodus finnes i mocken', false, ids);
  await setStates(p, { 'sensor.basseng_eta': { state: '90', attributes: { unit_of_measurement: 'min', friendly_name: 'Basseng ETA' } } });
  t = await txt();
  ok('B · ETA-sensor fra integrasjonen (90 min) → «1 t 30 min» (rollen eta)', /om ca 1 t 30 min\./.test(t), t);
  await setStates(p, { 'sensor.basseng_eta': null, [ids.water]: { state: '26.0' }, [ids.target]: { attributes: { temperature: 25 } }, ...(ids.pump ? { [ids.pump]: { state: 'off' } } : {}) });
  t = await txt();
  ok('B · diff ≤ 0 → «Vannet holder 25° · ingen oppvarming. Pumpa står.»', t === 'Vannet holder 25° · ingen oppvarming.' + (ids.pump ? ' Pumpa står.' : ''), t);
  await setStates(p, { [ids.water]: { state: 'unavailable' } });
  t = await txt();
  ok('B · vanntemp mangler → pille «–», setningen vises fortsatt', /^Vannet når 25° om ca –\./.test(t), t);
  await p.close();
}

/* ---------------- C · show_sentence */
{
  let p = await open({ w: 390, h: 844 }, 'msh-basseng-card', { show_sentence: false });
  let m = await measure(p);
  const ed = await p.evaluate(() => { const C = customElements.get('msh-basseng-card'); const flat = (L) => L.flatMap((f) => [f, ...(f.fields ? flat(f.fields) : [])]); const vis = C.schema.find((f) => f.label === 'Visning'); return { el: C.getConfigElement && C.getConfigElement().localName, f: flat(C.schema).find((f) => f.name === 'show_sentence'), inVis: !!(vis && vis.fields.some((f) => f.name === 'show_sentence')) }; });
  ok('C · show_sentence: false skjuler setningen', m.n === 0, m);
  ok('C · «Setning i Oversikt» (show_sentence, std på) ligger i Tilpass → Visning og i GUI-editoren (samme skjema)', ed.el === 'msh-editor' && ed.f && ed.f.default === true && ed.f.label === 'Setning i Oversikt' && ed.inVis, ed);
  await p.close();
  p = await open({ w: 390, h: 844 }, 'msh-basseng-card', { sent: false });
  m = await measure(p);
  ok('C · designets nøkkel sent:false leses også', m.n === 0, m);
  await p.close();
}

/* ---------------- D · 33.2 ingen dobbel flate */
const surfaces = (p, tag) => p.evaluate((tag) => {
  const c = window.__c; if (!c) return { missing: tag };
  const bad = [], chain = [];
  let n = c;
  for (let i = 0; i < 40 && n; i++) {
    if (n.nodeType === 1) {
      if (n.classList && n.classList.contains('bubble-pop-up-container')) break;
      const cs = getComputedStyle(n);
      chain.push(n.localName);
      if (cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || cs.backgroundImage !== 'none' || parseFloat(cs.borderTopLeftRadius) > 0 || parseFloat(cs.paddingLeft) > 0 || parseFloat(cs.paddingRight) > 0 || cs.boxShadow !== 'none') bad.push([n.localName, cs.backgroundColor, cs.borderTopLeftRadius, cs.paddingLeft, cs.boxShadow.slice(0, 30)]);
    }
    n = n.parentNode || n.host;
  }
  // inni kortet: ha-card og første wrapper-nivå (ikke seksjonene selv)
  const hc = c.shadowRoot.querySelector('ha-card');
  const lvl = [hc, ...[...hc.children].filter((x) => !/msh-hero-slot/.test(x.className) && x.children.length > 2)];
  lvl.forEach((x) => { const cs = getComputedStyle(x); if (cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || cs.backgroundImage !== 'none' || parseFloat(cs.borderTopLeftRadius) > 0 || parseFloat(cs.paddingLeft) > 0 || cs.boxShadow !== 'none') bad.push(['inni:' + (x.className || x.localName), cs.backgroundColor, cs.borderTopLeftRadius, cs.paddingLeft]); });
  const inner = c.closest ? null : null;
  const W = Math.round(c.getBoundingClientRect().width);
  let q = c; for (let i = 0; i < 40 && q && !(q.classList && q.classList.contains('bubble-pop-up-container')); i++) q = q.parentNode || q.host;
  const iw = q ? Math.round(q.getBoundingClientRect().width - parseFloat(getComputedStyle(q).paddingLeft) - parseFloat(getComputedStyle(q).paddingRight)) : null;
  return { bad, chain, W, iw };
}, tag);
for (const [tag, name, owner] of [['msh-basseng-card', 'Basseng', 'G3'], ['msh-las-card', 'Dørlås', 'G3'], ['msh-garasje-card', 'Garasje', 'G3'], ['msh-varmepumpe-card', 'Varmepumpe', 'G3'], ['msh-klima-card', 'Klima', 'G4'], ['msh-media-card', 'Media', 'G4']]) {
  for (const light of [false, true]) {
    const p = await open({ w: 390, h: 844 }, tag, {}, light);
    const s = await surfaces(p, tag);
    const label = `D · ${name}${owner === 'G4' ? ' (G4 – bare rapport)' : ''} ${light ? 'lys' : 'mørk'}: transparent rot, ingen flate/radius/innrykk mellom popupen og innholdet, fyller bredden`;
    const cond = !s.missing && !s.bad.length && Math.abs(s.W - s.iw) <= 2;
    if (owner === 'G4') res[label] = cond ? 'OK' : ['RAPPORT', s]; else ok(label, cond, s);
    await p.close();
  }
}

/* ---------------- E · lyst tema */
{
  const lum = (c) => { const m = /rgba?\(([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/.exec(c) || /color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)/.exec(c); if (!m) return null; let v = [m[1], m[2], m[3]].map(Number); if (/color\(srgb/.test(c)) v = v.map((x) => x * 255); const f = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(v[0]) + 0.7152 * f(v[1]) + 0.0722 * f(v[2]); };
  const ratio = (a, b) => { const A = lum(a), B = lum(b); if (A == null || B == null) return 0; return (Math.max(A, B) + 0.05) / (Math.min(A, B) + 0.05); };
  for (const light of [true, false]) {
    const p = await open({ w: 390, h: 844 }, 'msh-basseng-card', {}, light);
    const m = await measure(p);
    const x = await p.evaluate(() => {
      const sr = window.__c.shadowRoot, td = sr.querySelector('.today'), hero = sr.querySelector('msh-basseng-hero-card'), hs = hero && hero.shadowRoot.querySelector('.hero'), t = hero && hero.shadowRoot.querySelector('.t');
      const trl = sr.querySelector('.trl'), dhd = sr.querySelector('.dhd'), gti = [...sr.querySelectorAll('.gti')];
      return { today: getComputedStyle(td).backgroundColor, trl: getComputedStyle(trl).color, dhd: getComputedStyle(dhd).color, heroIsland: hs && hs.getAttribute('data-theme'), heroText: t && getComputedStyle(t).color, tabs: gti.map((g) => getComputedStyle(g).color) };
    });
    const bg = light ? 'rgb(240, 240, 240)' : 'rgb(40, 40, 40)';
    if (light) {
      ok('E · lys: setningen ≥ 4,5:1 mot popupen, pillene ≥ 4,5:1 (invers)', ratio(m.color, bg) >= 4.5 && ratio(m.pillFg, m.pillBg) >= 4.5, { c: m.color, pb: m.pillBg, pf: m.pillFg });
      ok('E · lys: «I dag»-kortet = --ki-surface (hvit), tekst ≥ 4,5:1', x.today === 'rgb(255, 255, 255)' && ratio(x.trl, x.today) >= 4.5 && ratio(x.dhd, bg) >= 4.5, x);
      ok('E · lys: toppkortet er en mørk øy (data-theme=dark) med lys tekst', x.heroIsland === 'dark' && x.heroText === 'rgb(250, 250, 250)', x);
    } else {
      // 42 C.4 (Basseng v4 popup): «I dag»-radene 15 px #fafafa, dato 13 px #a8a8a8
      ok('E · mørk (uten tokens): uendret – setning #fafafa, piller #fafafa/#141414, «I dag» #3a3a3a, rader #fafafa, dato #a8a8a8', m.color === 'rgb(250, 250, 250)' && m.pillBg === 'rgb(250, 250, 250)' && m.pillFg === 'rgb(20, 20, 20)' && x.today === 'rgb(58, 58, 58)' && x.trl === 'rgb(250, 250, 250)' && /168, 168, 168/.test(x.dhd), { m: [m.color, m.pillBg, m.pillFg], x });
    }
    await p.close();
  }
}

ok('ingen sidefeil', !errs.length, errs.slice(0, 5));
console.log(JSON.stringify(res, null, 1));
await b.close();
console.log(fail.length ? `\nFEIL (${fail.length}): ${fail.join(' | ')}` : '\nBasseng 33: alt OK');
process.exit(fail.length ? 1 : 0);
