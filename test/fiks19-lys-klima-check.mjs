// Fiks 19.2 / 19.8 · #lys: lampe-radene bruker lampens egen farge (rgb/kelvin/override, av = ingen fyll, live;
// Fiks 41: lys-radene er den felles Rom v4-raden (MSH.renderLightRow) – fyll hsl(hue 85% 72%) for farge, #ffc896 for
// dimbar / temp ≤ 4500 K, egen farge (override) går foran, flex-grow .3s)
// og #klima: fast fanelinje (#3a3a3a, ingen backdrop-filter), «Åpne med» + «Husk siste fane» (overlever reload).
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { readdirSync, existsSync, mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const BC = resolve('test/.vendor/bubble-card.js');
if (!existsSync(BC)) execFileSync('curl', ['-sSL', '-o', BC, 'https://raw.githubusercontent.com/Clooos/Bubble-Card/main/dist/bubble-card.js']);
mkdirSync(resolve('test/.build'), { recursive: true });
const bundle = resolve(`test/.build/fiks19-lk-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const SHOTS = process.env.SHOTS || '';
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
const errs = [];
const boot = async (hash, card) => {
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + resolve('test/harness-bubble.html'));
  for (const m of readdirSync('test/mock').sort()) await p.addScriptTag({ path: resolve('test/mock/' + m) });
  await p.addScriptTag({ path: bundle });
  await p.addScriptTag({ path: BC, type: 'module' });
  await p.waitForFunction(() => customElements.get('bubble-card'));
  await p.evaluate(async ([hash, card]) => {
    const wait = (ms) => new Promise((q) => setTimeout(q, ms));
    window.__hass = window.mockHass();
    const bc = document.createElement('bubble-card');
    bc.setConfig({ type: 'custom:bubble-card', card_type: 'pop-up', hash, name: 'X', bg_color: '#282828', bg_opacity: 100, bg_blur: 0, cards: [card] });
    bc.hass = window.__hass; document.getElementById('dash').appendChild(bc); window.__bc = bc;
    await wait(400);
    location.hash = hash; await wait(1500);
  }, [hash, card]);
  return p;
};
const out = {};
let fail = 0;
const ok = (name, cond, info) => { if (!cond) fail++; console.log(`${cond ? 'OK  ' : 'FEIL'} ${name}${info !== undefined ? ' · ' + JSON.stringify(info) : ''}`); };

/* ------------------------------------------------ 19.2 Lys */
{
  const p = await boot('#lys', { type: 'custom:msh-lys-card', card_id: 'l1', overrides: { 'light.bad_tak': { color: 'var(--pink)' } } });
  const r = await p.evaluate(async () => {
    const wait = (ms) => new Promise((q) => setTimeout(q, ms));
    const M = window.MSH;
    const lc = (a, st = 'on') => M.lampColor({ state: st, attributes: a });
    const unit = {
      green: lc({ color_mode: 'rgb', rgb_color: [0, 255, 0] }).css,
      xy: lc({ color_mode: 'xy', rgb_color: [255, 80, 200] }).css,
      k2200: lc({ color_mode: 'color_temp', color_temp_kelvin: 2200 }).css,
      k2700: lc({ color_mode: 'color_temp', color_temp_kelvin: 2700 }).css,
      k4000: lc({ color_mode: 'color_temp', color_temp_kelvin: 4000 }).css,
      k6500: lc({ color_mode: 'color_temp', color_temp_kelvin: 6500 }).css,
      dim: lc({ color_mode: 'brightness' }).css,
      over: M.lampColor({ state: 'on', attributes: { color_mode: 'rgb', rgb_color: [0, 255, 0] } }, 'var(--pink)').css,
      maskDark: M.lampMask(lc({ color_mode: 'rgb', rgb_color: [0, 0, 255] }).lum),
      maskLight: M.lampMask(lc({ color_mode: 'color_temp', color_temp_kelvin: 6500 }).lum),
    };
    // Sett lampene: grønn RGB, rosa LED (xy), 4000 K, dimbar uten farge, av
    const h0 = window.__hass, S = { ...h0.states };
    const set = (id, state, attrs) => { S[id] = { ...(S[id] || { entity_id: id }), entity_id: id, state, attributes: { ...((S[id] || {}).attributes || {}), ...attrs } }; };
    set('light.verandalampe', 'on', { brightness: 128, supported_color_modes: ['hs'], color_mode: 'hs', rgb_color: [0, 255, 0], hs_color: [120, 100] });
    set('light.utelys_inngang', 'on', { brightness: 200, supported_color_modes: ['xy'], color_mode: 'xy', rgb_color: [255, 80, 200] });
    set('light.gang_tak', 'on', { brightness: 90, supported_color_modes: ['color_temp'], color_mode: 'color_temp', color_temp_kelvin: 4000 });
    set('light.soverom_nattbord', 'on', { brightness: 60, supported_color_modes: ['brightness'], color_mode: 'brightness' });
    set('light.bad_tak', 'on', { brightness: 255, supported_color_modes: ['brightness'], color_mode: 'brightness' });
    window.__hass = { ...h0, states: S }; window.__bc.hass = window.__hass;
    await wait(500);
    const all = () => { const o = []; const w = (r) => r.querySelectorAll('*').forEach((e) => { o.push(e); if (e.shadowRoot) w(e.shadowRoot); }); w(document); return o; };
    const card = all().find((e) => e.localName === 'msh-lys-card');
    // Fane «Lys på»
    const rows = () => { const o = {}; card.shadowRoot.querySelectorAll('.lr[data-lr]').forEach((el) => { const f = el.querySelector('.lr-f'); if (f && el.dataset.lr.startsWith('light.')) { const cs = getComputedStyle(f); o[el.dataset.lr] = { bg: cs.backgroundColor, mask: cs.maskImage || cs.webkitMaskImage, w: cs.width, d: cs.display, op: cs.opacity, tr: cs.transition }; } }); card.shadowRoot.querySelectorAll('.lp').forEach((el) => { const f = el.querySelector('.lpf'); if (f) { const cs = getComputedStyle(f); o[el.dataset.lp] = { bg: cs.backgroundColor, mask: cs.maskImage || cs.webkitMaskImage, w: f.style.width, tr: cs.transition }; } }); return o; };
    const oni = () => { const o = {}; card.shadowRoot.querySelectorAll('.onr').forEach((b) => { o[b.dataset.id] = getComputedStyle(b.querySelector('.oni')).backgroundColor; }); return o; };
    const tabs = [...card.shadowRoot.querySelectorAll('.tab')].map((t) => t.dataset.key).filter((k) => k !== 'on');
    const scan = async () => { const o = {}; for (const t of tabs) { card.setUI({ tab: t }); await wait(700); Object.assign(o, rows()); } card.setUI({ tab: 'on' }); await wait(600); return { rows: o, oni: oni() }; };
    const on = await scan();
    // Live: rosa → blå, og slå av verandalampen
    const S2 = { ...window.__hass.states };
    S2['light.utelys_inngang'] = { ...S2['light.utelys_inngang'], attributes: { ...S2['light.utelys_inngang'].attributes, rgb_color: [0, 0, 255], hs_color: [240, 100] } };
    S2['light.verandalampe'] = { ...S2['light.verandalampe'], state: 'off', attributes: { ...S2['light.verandalampe'].attributes, brightness: null } };
    window.__hass = { ...window.__hass, states: S2 }; window.__bc.hass = window.__hass;
    await wait(700);
    const live = await scan();
    return { unit, on, live };
  });
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/f19-lys.png` });
  out.lys = r;
  const u = r.unit;
  ok('lampColor grønn rgb', u.green === 'rgb(0 255 0)', u.green);
  ok('lampColor xy → rgb_color', u.xy === 'rgb(255 80 200)', u.xy);
  ok('Kelvin-tonene', u.k2200 === 'rgb(242 181 115)' && u.k2700 === 'rgb(242 210 111)' && u.k4000 === 'rgb(242 228 185)' && u.k6500 === 'rgb(222 232 245)', [u.k2200, u.k2700, u.k4000, u.k6500]);
  ok('uten farge = temagul', /var\(--yellow/.test(u.dim), u.dim);
  ok('override går foran', /var\(--pink/.test(u.over), u.over);
  ok('mørk farge løftes 30→60 %', /\.3\)/.test(u.maskDark) && /\.22\)/.test(u.maskLight), [u.maskDark, u.maskLight]);
  const on = r.on.rows, oi = r.on.oni;
  ok('Lys på-sirkler', oi['light.verandalampe'] === 'rgb(0, 255, 0)' && oi['light.gang_tak'] === 'rgb(242, 228, 185)' && oi['light.soverom_nattbord'] === 'rgb(242, 210, 111)' && oi['light.bad_tak'] === 'rgb(242, 133, 201)', oi);
  // Fiks 41 (Rom v4 «lights»): farge → hsl(hue 85% 72%), fargetemp ≤ 4500 K og kun dimbar → #ffc896, override foran
  // utelampene (Utelys-fanen, .lp-pillene) bruker fortsatt lampens egen farge (19.2)
  ok('utelampe: grønn', on['light.verandalampe'] && on['light.verandalampe'].bg === 'rgb(0, 255, 0)', on['light.verandalampe']);
  ok('utelampe: rosa', on['light.utelys_inngang'] && on['light.utelys_inngang'].bg === 'rgb(255, 80, 200)', on['light.utelys_inngang']);
  ok('rad: 4000 K → varmhvit #ffc896 (≤ 4500 K)', on['light.gang_tak'] && on['light.gang_tak'].bg === 'rgb(255, 200, 150)', on['light.gang_tak']);
  ok('rad: kun dimbar = varmhvit #ffc896', on['light.soverom_nattbord'] && on['light.soverom_nattbord'].bg === 'rgb(255, 200, 150)', on['light.soverom_nattbord']);
  ok('rad: override rosa', on['light.bad_tak'] && on['light.bad_tak'].bg === 'rgb(242, 133, 201)', on['light.bad_tak']);
  ok('rad: full opasitet uten maske + flex-grow .3s (Fiks 41)', on['light.gang_tak'] && !/gradient/.test(on['light.gang_tak'].mask || '') && on['light.gang_tak'].op === '1' && /0\.3s/.test(on['light.gang_tak'].tr), on['light.gang_tak']);
  const lv = r.live.rows;
  ok('live: fargebytte (utelampe)', lv['light.utelys_inngang'] && lv['light.utelys_inngang'].bg === 'rgb(0, 0, 255)', lv['light.utelys_inngang']);
  const vo = lv['light.verandalampe'];
  ok('live: av = ingen fyll', !vo || vo.w === '0px' || vo.w === '0%' || vo.d === 'none' || vo.bg === 'rgba(0, 0, 0, 0)', vo);
  await p.close();
}

/* ------------------------------------------------ 19.8 Klima */
{
  const p = await boot('#klima', { type: 'custom:msh-klima-card', card_id: 'k19' });
  const r = await p.evaluate(async () => {
    const wait = (ms) => new Promise((q) => setTimeout(q, ms));
    const all = () => { const o = []; const w = (r) => r.querySelectorAll('*').forEach((e) => { o.push(e); if (e.shadowRoot) w(e.shadowRoot); }); w(document); return o; };
    const k = all().find((e) => e.localName === 'msh-klima-card' && e.getBoundingClientRect().height > 0);
    const R = k.shadowRoot, tb = getComputedStyle(R.querySelector('.tbox')), g = getComputedStyle(R.querySelector('.gear'));
    const tabsCs = getComputedStyle(R.querySelector('.tabs'));
    const res = { tbox: { bg: tb.backgroundColor, bf: tb.backdropFilter, r: tb.borderRadius, pad: tb.padding, sh: tb.boxShadow }, gap: tabsCs.columnGap, gear: { w: g.width, bg: g.backgroundColor, bf: g.backdropFilter } };
    res.tabs = [...R.querySelectorAll('.tab')].map((t) => t.dataset.key);
    res.cur0 = k._curTab();
    // Tilpass klima → Faner: Startfane (36.5, felles MSH.startTab – erstatter «Åpne med»/stjerne/«Husk siste fane»)
    k.customize(); await wait(300);
    const ov = window.MSH.portals().pop(), sh = ov.shadowRoot || ov, box = sh.querySelector('.klima-sheet');
    const chips = () => [...box.querySelectorAll('[data-mst-field] [data-mst]')];
    res.selOpts = chips().map((o) => o.dataset.mst).filter((v) => v !== 'last');
    res.hasRemember = chips().some((o) => o.dataset.mst === 'last');
    const target = res.tabs[2] || res.tabs[1];
    chips().find((o) => o.dataset.mst === target).click(); await wait(300);
    res.afterSel = { cur: k._curTab(), star: (box.querySelector('[data-mst-pill]') || {}).dataset?.mstPill, draft: k.config.start_tab };
    const target2 = res.tabs[1];
    chips().find((o) => o.dataset.mst === target2).click(); await wait(300);
    res.afterStar = { cur: k._curTab(), sel: (box.querySelector('[data-mst-field] .mst-c.on') || {}).dataset?.mst };
    // Ferdig (lagre) med Husk siste fane av
    box.querySelector('[data-a="done"]').click(); await wait(1200);
    const vis = () => all().find((e) => e.localName === 'msh-klima-card' && e.getBoundingClientRect().height > 0) || k;
    let kk = vis();
    res.saved = { default_tab: kk.config.start_tab }; // 36.5: lagres som start_tab
    // Velg en annen fane, lukk og åpne popupen → tilbake til «Åpne med»
    const other = res.tabs.find((x) => x !== target2);
    kk._selectTab(other); await wait(200);
    res.picked = kk._curTab();
    history.replaceState(null, '', location.pathname); window.dispatchEvent(new Event('hashchange')); await wait(600);
    location.hash = '#klima'; await wait(900);
    kk = vis(); res.reopenOff = kk._curTab(); res.dbg = { L: kk.layout.default_tab, rem: kk.layout.remember_tab, t: kk._tab, ui: kk.ui.tab, open: kk._open };
    return { res, other, target2 };
  });
  out.klima = r;
  const x = r.res;
  ok('fanelinje #3a3a3a uten backdrop', x.tbox.bg === 'rgb(58, 58, 58)' && (x.tbox.bf === 'none' || !x.tbox.bf) && x.tbox.r === '30px' && x.tbox.pad === '6px', x.tbox);
  ok('fanelinje gap 4', x.gap === '4px', x.gap);
  ok('tannhjul = sporets høyde (66 px, 35.8) #3a3a3a', x.gear.w === '66px' && x.gear.bg === 'rgb(58, 58, 58)' && (x.gear.bf === 'none' || !x.gear.bf), x.gear);
  ok('Startfane-chips = synlige faner', JSON.stringify(x.selOpts) === JSON.stringify(x.tabs), [x.selOpts, x.tabs]);
  ok('«Sist brukte» finnes', x.hasRemember);
  ok('Startfane bytter straks + «Start»-pill synk', x.afterSel.cur === x.afterSel.draft && x.afterSel.star === x.afterSel.draft, x.afterSel);
  ok('nytt valg → aktiv chip synk', x.afterStar.cur === r.target2 && x.afterStar.sel === r.target2, x.afterStar);
  ok('lagret start_tab', x.saved.default_tab === r.target2, x.saved);
  ok('Husk av: gjenåpning → Åpne med', x.reopenOff === r.target2, [x.reopenOff, x.dbg]);
  await p.close();
}
/* ------------------------------------------------ 19.8 reload: Husk siste fane på/av */
{
  const cur = (p) => p.evaluate(() => { const all = () => { const o = []; const w = (r) => r.querySelectorAll('*').forEach((e) => { o.push(e); if (e.shadowRoot) w(e.shadowRoot); }); w(document); return o; }; const k = all().find((e) => e.localName === 'msh-klima-card' && e.getBoundingClientRect().height > 0); return k && k._curTab(); });
  const pick = (p, t) => p.evaluate(async (t) => { const all = () => { const o = []; const w = (r) => r.querySelectorAll('*').forEach((e) => { o.push(e); if (e.shadowRoot) w(e.shadowRoot); }); w(document); return o; }; all().find((e) => e.localName === 'msh-klima-card' && e.getBoundingClientRect().height > 0)._selectTab(t); await new Promise((q) => setTimeout(q, 300)); }, t);
  const on = { type: 'custom:msh-klima-card', card_id: 'k19r', layout: { default_tab: 'soner', remember_tab: true } };
  let p = await boot('#klima', on); const first = await cur(p); await pick(p, 'energi'); await p.close();
  p = await boot('#klima', on); const again = await cur(p); await p.close();
  const off = { type: 'custom:msh-klima-card', card_id: 'k19r', layout: { default_tab: 'soner' } };
  p = await boot('#klima', off); const offT = await cur(p); await p.close();
  ok('reload: Åpne med ved første åpning', first === 'soner', first);
  ok('reload: Husk på → sist valgte', again === 'energi', again);
  ok('reload: Husk av → Åpne med', offT === 'soner', offT);
}
console.log(errs.length ? 'Sidefeil: ' + errs.join(' | ') : 'Ingen sidefeil');
await b.close();
process.exit(fail || errs.length ? 1 : 0);
