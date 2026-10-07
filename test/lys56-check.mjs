// Fiks 56 · D (tonede piller – Hjem Aktuelt) og M (lys-radene i lys modus), mot EKTE Bubble Card, 390 px.
//  D · lys modus, Aktuelt: tonede piller (dør/vindu oransje, «N batterier lavt» rød, TV blå, støvsuger) har opak
//      nesten-hvit flate (ikke gjennomsiktig), tittel ≥ 4,5:1, undertekst ≥ 4,5:1, ikon ≥ 4,5:1 mot ikonsirkelen (krav 3:1),
//      ring + svak skygge; «Avvik» (fylt rød) har mørk tekst (--ki-on-accent) og sirkel rgba(0,0,0,.12). Tokens finnes
//      for alle aksentene (--ki-tint-<aksent>-bg/-fg/-ring) og fg ≥ 4,5:1 mot bg og sirkel.
//  M · lys modus, Lys-popupen + Rom → Lys: av, på varmhvit (av/på-bryter og dimmer), på farget (grønn), dimmer 0/40/100 %:
//      skinne --ki-track (#ececec) + inset-ring, fyll = lampefarge (gradient) med skygge, ikon på fyll ≥ 4,5:1, av-tommel
//      hvit med skygge og ikon ≥ 4,5:1, prikk rgba(0,0,0,.25), strek-tommel = --ki-text 3 px, pære-ikon på ≥ 4,5:1 mot
//      raden (lampefarge mørknet) / av = --ki-text-3, statustekst --ki-text-2 ≥ 4,5:1; av og på tydelig forskjellige.
//  Mørk modus: med TEMA_BASE=<bundel fra før koden> (standard test/.build/m56-base.js hvis den finnes) sammenlignes alle
//      beregnede farger/skygger i Aktuelt-pillene og lys-radene element for element (skal være like).
// Kjør: node test/lys56-check.mjs   (SHOTS=dir → skjermbilder)
import { createRequire } from 'node:module';
import { readdirSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const R = resolve('.') + '/';
mkdirSync('test/.build', { recursive: true });
mkdirSync('test/.vendor', { recursive: true });
const BC = resolve('test/.vendor/bubble-card.js');
if (!existsSync(BC)) execFileSync('curl', ['-sSL', '-o', BC, 'https://raw.githubusercontent.com/Clooos/Bubble-Card/main/dist/bubble-card.js']);
const bundle = resolve(`test/.build/l56-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const BASE = process.env.TEMA_BASE ? resolve(process.env.TEMA_BASE) : existsSync('test/.build/m56-base.js') ? resolve('test/.build/m56-base.js') : null;
const mocks = readdirSync(R + 'test/mock').filter((f) => f.endsWith('.js')).sort().map((f) => R + 'test/mock/' + f);
const SHOTS = process.env.SHOTS || '';
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const res = [];
let fails = 0;
const ok = (name, cond, info) => { if (!cond) fails++; res.push(`${cond ? '✔' : '✘'} ${name}${info != null && !cond ? ' · ' + JSON.stringify(info).slice(0, 1200) : ''}`); };
const browser = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

const POPS = [
  { hash: '#stue', name: 'Stue', cards: [{ type: 'custom:msh-rom-card', card_id: 'l56a' }] },
  { hash: '#lys', name: 'Lys', cards: [{ type: 'custom:msh-lys-card', card_id: 'l56l' }] },
];

async function boot(bundlePath, dark) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('file://' + R + 'test/harness-bubble.html');
  for (const m of mocks) await page.addScriptTag({ path: m });
  await page.addScriptTag({ path: bundlePath });
  await page.addScriptTag({ path: BC, type: 'module' });
  await page.waitForFunction(() => customElements.get('bubble-card'), null, { timeout: 15000 });
  await page.evaluate(async ({ dark, popups }) => {
    try { localStorage.clear(); } catch (e) { /* */ }
    const wait = (window.wait = (ms) => new Promise((q) => setTimeout(q, ms)));
    window.deepAll = (sel, root) => { const out = []; const walk = (r) => r.querySelectorAll('*').forEach((e) => { if (e.matches(sel)) out.push(e); if (e.shadowRoot) walk(e.shadowRoot); }); walk(root || document); return out; };
    const H = (window.H = window.mockHass()); H.themes = { ...(H.themes || {}), darkMode: dark };
    const now = new Date().toISOString();
    const set = (id, state, attrs) => { H.states[id] = { entity_id: id, state, attributes: { ...attrs }, last_changed: now, last_updated: now }; };
    // D: aktuelle ting (dør/vindu åpen, avvik, lave batterier)
    set('binary_sensor.l56_soverom_vindu', 'on', { friendly_name: 'Soverom vindu', device_class: 'window' });
    set('binary_sensor.l56_gang_dor', 'on', { friendly_name: 'Gang dør', device_class: 'door' });
    set('binary_sensor.l56_nettleie', 'on', { friendly_name: 'Nettleie (Elvia)', device_class: 'problem' });
    for (let i = 1; i <= 5; i++) set(`sensor.l56_bat${i}`, String(3 + i), { friendly_name: `Sensor ${i} batteri`, device_class: 'battery', unit_of_measurement: '%' });
    // M: testlys – dimbar 100 %, dimbar 40 % (ct varm), dimbar 0 % (av), farget grønn, av/på på og av
    set('light.stue_tak', 'on', { friendly_name: 'Stue tak', brightness: 255, supported_color_modes: ['brightness'], color_mode: 'brightness' });
    set('light.stue_peis', 'on', { friendly_name: 'Peislampe', brightness: 102, supported_color_modes: ['color_temp'], color_mode: 'color_temp', color_temp_kelvin: 2700, min_color_temp_kelvin: 2200, max_color_temp_kelvin: 6500 });
    set('light.stue_bord', 'off', { friendly_name: 'Sofabord', supported_color_modes: ['brightness'] });
    set('light.stue_led', 'on', { friendly_name: 'Grønn sofalampe', brightness: 255, supported_color_modes: ['rgb'], color_mode: 'rgb', rgb_color: [0, 255, 0], hs_color: [120, 100] });
    set('light.stue_skjenk', 'on', { friendly_name: 'Skjenklampe', supported_color_modes: ['onoff'], color_mode: 'onoff' });
    set('light.stue_staa', 'off', { friendly_name: 'Stålampe', supported_color_modes: ['onoff'] });
    const NEW = ['light.stue_peis', 'light.stue_bord', 'light.stue_skjenk', 'light.stue_staa'];
    if (H.entities) NEW.forEach((id) => { if (!H.entities[id]) H.entities[id] = { ...(H.entities['light.stue_tak'] || { area_id: 'stue' }), entity_id: id, unique_id: id }; });
    const ov = H.states['sensor.stue_oversikt']; if (ov) ov.attributes = { ...ov.attributes, lys: ['light.stue_tak', 'light.stue_led', ...NEW] };
    if (window.MSH.theme && window.MSH.theme.update) window.MSH.theme.update(H);
    if (window.MSH.store && window.MSH.store.load) await window.MSH.store.load(H);
    document.documentElement.style.background = document.body.style.background = 'var(--ki-bg, #232323)';
    window.BCS = popups.map((p) => { const bc = document.createElement('bubble-card'); bc.setConfig({ type: 'custom:bubble-card', card_type: 'pop-up', hash: p.hash, name: p.name, icon: 'mdi:lightbulb', margin_top_mobile: '50px', bg_color: dark ? '#282828' : '#f0f0f0', bg_opacity: 100, bg_blur: 0, cards: p.cards }); bc.hass = H; document.getElementById('dash').appendChild(bc); return bc; });
    const hf = (window.HF = document.createElement('msh-hjem-faner-card'));
    hf.setConfig({ type: 'custom:msh-hjem-faner-card', card_id: 'ki-faner-l56' });
    hf.hass = H; document.getElementById('dash').prepend(hf);
    await wait(800);
    window.card = (tag) => deepAll(tag).find((e) => e.getClientRects().length);
    window.row = (tag, key) => { const c = card(tag); return c && [...c.shadowRoot.querySelectorAll('.lr[data-lr]')].find((e) => e.dataset.lr === key); };
    // Effektiv bakgrunn: nærmeste forelder (også over shadow-grenser) med ugjennomsiktig farge
    window.effBg = (el) => {
      let e = el;
      while (e) {
        if (e.nodeType === 1) { const b = getComputedStyle(e).backgroundColor, p = window.MSH.theme.parse(b); if (p && p[3] > 0.95) return b; }
        e = e.parentNode || e.host; if (e && e.nodeType === 11) e = e.host;
      }
      return getComputedStyle(document.body).backgroundColor;
    };
    window.CR = (a, b) => +window.MSH.theme.contrast(a, b).toFixed(2);
    window.grad = (s) => (String(s).match(/rgba?\([^)]+\)|color\([^)]+\)/g) || []);
    // Signatur (mørk paritet): beregnede farger/skygger for alle elementer under el
    window.sigAll = (el) => [el, ...el.querySelectorAll('*')].map((e) => { const c = getComputedStyle(e); return [e.tagName, e.className && e.className.baseVal == null ? e.className : '', c.color, c.backgroundColor, c.backgroundImage, c.boxShadow, c.opacity, c.width].join('|'); });
  }, { dark, popups: POPS });
  const open = async (h, tag) => { await page.evaluate(async ([h, tag]) => { if (location.hash === h) { location.hash = '#x'; await wait(600); } location.hash = h; await wait(1300); for (let i = 0; tag && i < 40 && !card(tag); i++) await wait(150); }, [h, tag || null]); };
  return { page, errs, open };
}

const aktuelt = async (page) => page.evaluate(async () => {
  const c = window.HF, i = (c._TV || []).findIndex((t) => t.id === 'aktuelt');
  if (i < 0) return null;
  c._pickTab(i); await wait(700);
  return [...c.shadowRoot.querySelectorAll('.u.ht')].filter((t) => t.getClientRects().length).map((t) => {
    const cs = getComputedStyle(t), ic = t.querySelector('.u-i'), ics = getComputedStyle(ic), l = t.querySelector('.u-l'), n = t.querySelector('.u-n');
    const bg = cs.backgroundColor, bgP = window.MSH.theme.parse(bg);
    const circle = window.MSH.theme.parse(ics.backgroundColor);
    const circOver = circle ? `rgb(${[0, 1, 2].map((k) => Math.round(circle[k] * circle[3] + (bgP ? bgP[k] : 255) * (1 - circle[3]))).join(',')})` : bg;
    return { title: l && l.textContent.trim(), sub: n && n.textContent.trim(), bg, bgA: bgP ? bgP[3] : null, sh: cs.boxShadow, fg: getComputedStyle(l).color, subC: n ? getComputedStyle(n).color : null, icon: ics.color, circle: ics.backgroundColor,
      cTitle: CR(getComputedStyle(l).color, bg), cSub: n ? CR(getComputedStyle(n).color, bg) : null, cIcon: CR(ics.color, circOver), dashBg: effBg(t.parentElement) };
  });
});
const lyRows = async (page, tag) => page.evaluate(async (tag) => {
  const c = card(tag); if (!c) return { __dbg: [deepAll(tag).length, location.hash, deepAll('.bubble-pop-up').map((p) => p.className).join(' / ')] };
  const out = {};
  const tabs = tag === 'msh-lys-card' ? [...c.shadowRoot.querySelectorAll('.mtb-t')].map((x) => x.dataset.v).filter(Boolean) : [null];
  for (const tb of tabs) {
  if (tb) { c.setUI({ tab: tb }); await wait(400); }
  c.shadowRoot.querySelectorAll('.lr[data-lr]').forEach((r) => {
    if (out[r.dataset.lr]) return;
    const g = (s) => r.querySelector(s), cs = (s) => (g(s) ? getComputedStyle(g(s)) : null), bg = effBg(r);
    const bulb = r.querySelector('.lr-h > ha-icon'), p = g('.lr-p');
    const o = { bg, bulb: getComputedStyle(bulb).color, cBulb: CR(getComputedStyle(bulb).color, bg), pC: getComputedStyle(p).color, cP: CR(getComputedStyle(p).color, bg), val: p.textContent };
    if (g('.lr-sw')) {
      const sw = cs('.lr-sw'), f = cs('.lr-swf'), d = cs('.lr-swd'), ic = g('.lr-swf ha-icon');
      const stops = grad(f.backgroundImage);
      const fills = stops.length ? stops : [f.backgroundColor];
      Object.assign(o, { kind: 'sw', on: g('.lr-sw').classList.contains('on'), track: sw.backgroundColor, trackSh: sw.boxShadow, thumb: f.backgroundColor, thumbImg: f.backgroundImage, thumbSh: f.boxShadow, ic: getComputedStyle(ic).color, cIc: Math.min(...fills.map((x) => CR(getComputedStyle(ic).color, x))), dot: d.backgroundColor, dotOp: d.opacity, x: g('.lr-swf').getBoundingClientRect().left - g('.lr-sw').getBoundingClientRect().left });
    } else {
      const f = cs('.lr-f'), k = cs('.lr-k'), t = cs('.lr-t');
      const stops = f ? grad(f.backgroundImage) : [];
      Object.assign(o, { kind: 'sl', fillShown: f && f.display !== 'none', fillImg: f && f.backgroundImage, fillSh: f && f.boxShadow, fillVsTrack: stops.length ? Math.max(...stops.map((x) => CR(x, t.backgroundColor))) : null, knob: k.backgroundColor, knobW: k.width, knobSh: k.boxShadow, cKnob: CR(k.backgroundColor, t.backgroundColor), track: t.backgroundColor, trackSh: t.boxShadow, trackShown: t.display !== 'none' });
    }
    out[r.dataset.lr] = o;
  });
  }
  return out;
}, tag);
const openLys = async (page) => page.evaluate(async () => { const c = card('msh-rom-card'); if (c) { c.setUI({ acc: { ...(c.ui.acc || {}), lys: true } }); await wait(500); } });
const darkSig = async (page) => page.evaluate(async () => {
  const out = {};
  const c = window.HF; c.shadowRoot.querySelectorAll('.u.ht').forEach((t, i) => { out['akt' + i + ':' + (t.querySelector('.u-l') || {}).textContent] = sigAll(t); });
  ['msh-rom-card', 'msh-lys-card'].forEach((tag) => deepAll(tag).forEach((cd) => cd.shadowRoot && cd.shadowRoot.querySelectorAll('.lr[data-lr]').forEach((r) => { out[tag + ':' + r.dataset.lr] = sigAll(r); })));
  return out;
});

/* ------------------------------------------------------------ token-tabellen */
{
  const { page, errs } = await boot(bundle, false);
  const T = await page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement), o = {};
    ['red', 'orange', 'amber', 'yellow', 'green', 'blue', 'pink', 'purple'].forEach((n) => { o[n] = ['bg', 'fg', 'ring', 'circle'].map((k) => cs.getPropertyValue(`--ki-tint-${n}-${k}`).trim()); });
    const C = {}; Object.entries(o).forEach(([n, [bg, fg, ring, circ]]) => { C[n] = { fgBg: CR(fg, bg), fgCirc: CR(fg, circ), subBg: CR(cs.getPropertyValue('--ki-text-2').trim(), bg), titleBg: CR(cs.getPropertyValue('--ki-text').trim(), bg), opaque: window.MSH.theme.parse(bg)[3] === 1 }; });
    return { o, C, track: cs.getPropertyValue('--ki-track').trim(), lt: JSON.stringify(cs.getPropertyValue('--ki-lt')) };
  });
  ok('lys: --ki-tint-<aksent>-bg/-fg/-ring/-circle finnes for red/orange/amber/yellow/green/blue/pink/purple', Object.values(T.o).every((v) => v.every(Boolean)), T.o);
  ok('lys: tint-flaten er opak og fg ≥ 4,5:1 mot flate og sirkel, tittel/undertekst ≥ 4,5:1', Object.values(T.C).every((c) => c.opaque && c.fgBg >= 4.5 && c.fgCirc >= 4.5 && c.subBg >= 4.5 && c.titleBg >= 4.5), T.C);
  ok('lys: --ki-track = #ececec', /^#ececec$/i.test(T.track), T.track);
  ok('ingen sidefeil (token-tabell)', !errs.length, errs);
  await page.close();
}
{
  const { page } = await boot(bundle, true);
  const d = await page.evaluate(() => { const cs = getComputedStyle(document.documentElement); return ['--ki-tint-red-bg', '--ki-track', '--ki-lt', '--ki-lr-k'].map((n) => cs.getPropertyValue(n)); });
  ok('mørk: tint-/lys-rad-tokens er udefinert (fallback = dagens farger)', d.every((v) => v === ''), d);
  await page.close();
}

/* ------------------------------------------------------------ D · Aktuelt i lys modus */
{
  const { page, errs, open } = await boot(bundle, false);
  const A = await aktuelt(page);
  ok('lys: Aktuelt-fanen har piller', Array.isArray(A) && A.length >= 3, A);
  const find = (re) => (A || []).find((t) => re.test(t.title || ''));
  const vin = find(/Soverom vindu/), bat = find(/batterier lavt/), avv = find(/Nettleie/);
  ok('lys: tonede piller (vindu/dør, batterier) finnes', !!vin && !!bat, (A || []).map((t) => t.title));
  for (const t of [vin, find(/Gang dør/), bat].filter(Boolean)) {
    ok(`lys · «${t.title}»: opak flate (ikke gjennomsiktig)`, t.bgA === 1, t);
    ok(`lys · «${t.title}»: tittel ≥ 4,5:1, undertekst ≥ 4,5:1, ikon ≥ 4,5:1 (krav 3:1) mot sirkelen`, t.cTitle >= 4.5 && t.cSub >= 4.5 && t.cIcon >= 4.5, t);
    ok(`lys · «${t.title}»: ring (inset 1px) + svak skygge`, /inset/.test(t.sh) && /0px 1px 2px/.test(t.sh), t.sh);
    ok(`lys · «${t.title}»: skiller seg fra bakgrunnen (flate ≠ dashbord)`, t.bg !== t.dashBg, [t.bg, t.dashBg]);
  }
  ok('lys · «5 batterier lavt» bruker tonet stil (rød tint, ikke fylt)', !!bat && bat.bgA === 1 && CRok(bat), bat);
  function CRok(t) { return t && /255, 24\d, 24\d|rgb\(25[0-5], 2[34]\d, 2[34]\d\)/.test(t.bg); }
  ok('lys · «Avvik» (Nettleie): fylt rød med mørk tekst (--ki-on-accent) og sirkel rgba(0,0,0,.12)', !!avv && avv.fg === 'rgb(42, 23, 32)' && avv.subC === 'rgb(42, 23, 32)' && avv.icon === 'rgb(42, 23, 32)' && /0\.12\)$/.test(avv.circle) && avv.cTitle >= 4.5, avv);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/aktuelt-lys.png` });

  /* ------------------------------------------------------------ M · lys-rader i lys modus (Lys-popupen + Rom → Lys) */
  for (const [hash, tag] of [['#lys', 'msh-lys-card'], ['#stue', 'msh-rom-card']]) {
    await open(hash, tag);
    if (tag === 'msh-rom-card') await openLys(page);
    const L = await lyRows(page, tag);
    const nm = tag === 'msh-lys-card' ? 'Lys' : 'Rom';
    ok(`${nm}: lys-radene finnes (felles .lr)`, L && ['light.stue_tak', 'light.stue_peis', 'light.stue_bord', 'light.stue_led', 'light.stue_skjenk', 'light.stue_staa'].every((k) => L[k]), L && (L.__dbg || Object.keys(L)));
    if (!L || !L['light.stue_staa']) continue;
    const on = L['light.stue_skjenk'], off = L['light.stue_staa'], d100 = L['light.stue_tak'], d40 = L['light.stue_peis'], d0 = L['light.stue_bord'], grn = L['light.stue_led'];
    ok(`${nm} · av/på PÅ: skinne #ececec + inset-ring, fyll = varm gradient med skygge, ikon ≥ 4,5:1 på fyllet`, on.track === 'rgb(236, 236, 236)' && /inset/.test(on.trackSh) && /gradient\(90deg, rgb\(246, 196, 138\), rgb\(242, 166, 90\)\)/.test(on.thumbImg) && /0px 1px 3px/.test(on.thumbSh) && on.cIc >= 4.5, on);
    ok(`${nm} · av/på AV: hvit tommel med skygge, ikon --ki-text-2 ≥ 4,5:1, prikk rgba(0,0,0,.25)`, off.thumb === 'rgb(255, 255, 255)' && off.thumbImg === 'none' && /0px 1px 4px/.test(off.thumbSh) && off.cIc >= 4.5 && off.dot === 'rgba(0, 0, 0, 0.25)', off);
    ok(`${nm} · av og på kan skilles (tommel-farge og posisjon)`, on.thumbImg !== off.thumbImg && Math.abs(on.x - off.x) > 40, [on.x, off.x]);
    for (const [k, r] of [['100 %', d100], ['40 % (varm)', d40], ['farget (grønn)', grn]]) {
      ok(`${nm} · dimmer ${k}: fyll = lampefarge-gradient med skygge, synlig mot skinnen`, r.fillShown && /linear-gradient/.test(r.fillImg) && /0px 1px 3px/.test(r.fillSh) && r.fillVsTrack >= 1.3, r);
      ok(`${nm} · dimmer ${k}: pære-ikon = lampefarge mørknet ≥ 4,5:1, statustekst ≥ 4,5:1`, r.cBulb >= 4.5 && r.cP >= 4.5 && r.bulb !== 'rgb(28, 28, 28)', r);
    }
    ok(`${nm} · grønn lampe: pære-ikonet er grønt (hue følger lysfargen)`, (() => { const m = /rgb\((\d+), (\d+), (\d+)\)/.exec(grn.bulb); return m && +m[2] > +m[1] && +m[2] > +m[3]; })(), grn.bulb);
    ok(`${nm} · dimmer 0 %: skinne #ececec, ikke fyll; strek-tommel --ki-text 3 px m/ hvit kant`, !d0.fillShown && d0.track === 'rgb(236, 236, 236)' && d0.knob === 'rgb(28, 28, 28)' && d0.knobW === '3px' && /255, 255, 255/.test(d0.knobSh) && d0.cKnob >= 4.5, d0);
    ok(`${nm} · av: pære-ikon --ki-text-3 (#606060), statustekst --ki-text-2 (#565656)`, off.bulb === 'rgb(96, 96, 96)' && d0.bulb === 'rgb(96, 96, 96)' && off.pC === 'rgb(86, 86, 86)' && off.cP >= 4.5, [off.bulb, d0.bulb, off.pC]);
    ok(`${nm} · strek-tommel 100 %: --ki-text 3 px`, d100.knob === 'rgb(28, 28, 28)' && d100.knobW === '3px', d100);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/${nm.toLowerCase()}-lys.png` });
    await page.evaluate(async () => { history.back(); await wait(700); });
  }
  ok('ingen sidefeil (lys modus)', !errs.length, errs);
  await page.close();
}

/* ------------------------------------------------------------ mørk modus: paritet mot før-bundelen */
async function darkRun(bp) {
  const { page, errs, open } = await boot(bp, true);
  const lysSig = {};
  await aktuelt(page);
  await open('#lys', 'msh-lys-card');
  for (const t of await page.evaluate(() => [...card('msh-lys-card').shadowRoot.querySelectorAll('.mtb-t')].map((x) => x.dataset.v).filter(Boolean))) {
    await page.evaluate(async (t) => { card('msh-lys-card').setUI({ tab: t }); await wait(400); }, t);
    Object.assign(lysSig, await darkSig(page));
  }
  await open('#stue', 'msh-rom-card'); await openLys(page);
  const s = { ...lysSig, ...(await darkSig(page)) };
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${bp === bundle ? 'ny' : 'base'}-mork.png` });
  await page.close();
  return { s, errs };
}
{
  const N = await darkRun(bundle);
  ok('mørk: Aktuelt-piller og lys-rader tegnet', Object.keys(N.s).some((k) => k.startsWith('akt')) && Object.keys(N.s).some((k) => k.startsWith('msh-lys-card')) && Object.keys(N.s).some((k) => k.startsWith('msh-rom-card')), Object.keys(N.s));
  ok('ingen sidefeil (mørk modus)', !N.errs.length, N.errs);
  if (BASE) {
    const B = await darkRun(BASE);
    const diff = [];
    Object.keys(B.s).forEach((k) => {
      const a = B.s[k], b = N.s[k];
      if (!b) { diff.push(['mangler', k]); return; }
      a.forEach((x, i) => { if (x !== b[i]) diff.push([k, i, x, b[i]]); });
    });
    ok(`mørk paritet mot før-bundelen (${Object.keys(B.s).length} elementgrupper): beregnede farger/skygger like`, !diff.length, diff.slice(0, 8));
  } else res.push('– (ingen TEMA_BASE: mørk paritet ikke sammenlignet)');
}

await browser.close();
console.log(res.join('\n'));
console.log(`\n${res.filter((r) => r.startsWith('✔')).length} ok, ${fails} feil`);
process.exit(fails ? 1 : 0);
