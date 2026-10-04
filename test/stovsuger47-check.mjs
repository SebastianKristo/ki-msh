// Fiks 47 · Sir Sweeps (#rolf, msh-stovsuger-card): H/L1 «Støvsug alt»-pillen (målt med getComputedStyle), I Kontroll som
// ÉTT kort, L2 vifte-/moppfliser (trykk = neste valg, hold = more-info, aldri True/False), J Info-prosa, L3 «Soner».
//   node test/stovsuger47-check.mjs   (SHOTS=<mappe> for skjermbilder)
import { createRequire } from 'node:module';
import { readdirSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
mkdirSync('test/.build', { recursive: true });
const bundle = resolve(`test/.build/stovsuger47-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
// Andre filer under arbeid med syntaksfeil skal ikke stoppe denne testen: bygg da uten dem (og si fra)
try { execFileSync('node', ['--check', bundle], { stdio: 'ignore' }); } catch (e) {
  let out = '', skip = [];
  for (const f of readdirSync('src').filter((x) => x.endsWith('.js')).sort()) {
    try { execFileSync('node', ['--check', 'src/' + f], { stdio: 'ignore' }); } catch (x) { skip.push(f); continue; }
    out += `\ntry {\n${readFileSync('src/' + f, 'utf8')}\n} catch (e) { console.error('[ki-msh] ${f}', e); }\n`;
  }
  writeFileSync(bundle, out);
  console.warn('Advarsel: hoppet over filer med syntaksfeil:', skip.join(', '));
}
const shots = process.env.SHOTS || '';
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const res = {}, fail = [];
const ok = (name, cond, info) => { res[name] = cond ? 'OK' : ['FEIL', info]; if (!cond) fail.push(name); };
const mocks = readdirSync('test/mock').sort().map((m) => resolve('test/mock/' + m));
const errs = [];
async function page(cfg, opt = {}) {
  const p = await b.newPage({ viewport: opt.vp || { width: 390, height: 900 }, hasTouch: true });
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + resolve('test/harness.html'));
  for (const m of mocks) await p.addScriptTag({ path: m });
  await p.addScriptTag({ path: bundle });
  await p.evaluate(async ({ cfg, opt }) => {
    const h = window.mockHass();
    if (opt.light) h.themes = { darkMode: false };
    if (opt.extra) opt.extra.forEach(([id, state, attrs, dev]) => { h.states[id] = { entity_id: id, state, attributes: attrs || {}, last_changed: new Date().toISOString(), last_updated: new Date().toISOString() }; h.entities[id] = { entity_id: id, platform: 'x', device_id: dev || null }; });
    if (opt.drop) opt.drop.forEach((id) => { delete h.states[id]; delete h.entities[id]; });
    window.__h = h;
    const bc = document.createElement('bubble-card');
    bc.setConfig({ type: 'custom:bubble-card', card_type: 'pop-up', hash: '#rolf' });
    bc.innerHTML = '<div class="pop"><div class="hdr">Sir Sweeps</div><div class="inner"></div></div>';
    document.getElementById('dash').appendChild(bc);
    // Simulerer HA/Bubble-variabler som ellers farger ikoner/tekst mørkt (L1 årsak 2) – skal ikke påvirke pillen
    if (opt.haVars) bc.style.cssText += ';--icon-primary-color:#282828;--primary-text-color:#212121;--state-icon-color:#44739e;--bubble-icon-color:#282828;--bubble-icon-background-color:rgba(0,0,0,.1);--paper-item-icon-color:#282828';
    window.__popEv = 0;
    ['touchstart', 'touchmove', 'pointerdown'].forEach((t) => bc.querySelector('.pop').addEventListener(t, () => { window.__popEv++; }));
    location.hash = '#rolf';
    const c = document.createElement('msh-stovsuger-card');
    c.setConfig({ type: 'custom:msh-stovsuger-card', card_id: 'pop-rolf-47', ...(cfg || {}) });
    c.hass = window.__h;
    bc.querySelector('.inner').appendChild(c);
    window.__c = c;
    window.__hap = []; window.addEventListener('haptic', (e) => window.__hap.push(e.detail));
    window.__mi = []; window.addEventListener('hass-more-info', (e) => window.__mi.push(e.detail.entityId));
    window.__set = (id, state, attrs) => { const h = window.__h, o = h.states[id]; const s = { ...o, state, attributes: { ...o.attributes, ...(attrs || {}) }, last_changed: new Date().toISOString() }; window.__h = { ...h, states: { ...h.states, [id]: s } }; c.hass = window.__h; };
    await new Promise((q) => setTimeout(q, 700));
  }, { cfg, opt });
  return p;
}
const wait = (p, ms) => p.evaluate((ms) => new Promise((q) => setTimeout(q, ms)), ms);
const calls = (p) => p.evaluate(() => window.__calls.filter((c) => c[0] !== 'ws').map((c) => [c[0], c[1], c[2] && c[2].entity_id, c[2] && (c[2].fan_speed || c[2].option)].filter(Boolean).join(' ')));
const clear = (p) => p.evaluate(() => { window.__calls.length = 0; window.__hap.length = 0; window.__mi.length = 0; });
const click = (p, sel) => p.evaluate((sel) => { const e = window.__c.shadowRoot.querySelector(sel); if (!e) return false; e.click(); return true; }, sel);
const tab = async (p, t) => { await click(p, `[data-act="tab"][data-v="${t}"]`); await wait(p, 250); };
const GREEN = 'rgb(102, 209, 158)', ORANGE = 'rgb(242, 181, 115)', CELL = 'rgba(16, 36, 26, 0.86)';
// Pillen målt med getComputedStyle (L1 akseptkriterier)
const pill = (p) => p.evaluate(() => {
  const sr = window.__c.shadowRoot, q = (s) => sr.querySelector(s), cs = (e) => getComputedStyle(e);
  const w = q('.sw'), cell = q('.sw-cell'), ring = q('.sw-ring'), dot = q('.sw-dot'), t = q('.sw-t'), sub = q('.sw-s');
  const chain = []; for (let e = dot; e && e !== w.parentElement; e = e.parentElement) chain.push(e);
  const r = (e) => e.getBoundingClientRect();
  return {
    pillBg: cs(w).backgroundColor, pillColor: cs(w).color, pillH: Math.round(r(w).height), pad: cs(w).paddingLeft, rad: cs(w).borderTopLeftRadius, gap: cs(q('.swb')).columnGap,
    cellBg: cs(cell).backgroundColor, cellW: Math.round(r(cell).width), cellH: Math.round(r(cell).height), cellRad: cs(cell).borderTopLeftRadius,
    ringBorder: cs(ring).borderColor, ringW: cs(ring).borderTopWidth, ringSize: Math.round(r(ring).width), ringAnim: cs(ring).animationName, ringDur: cs(ring).animationDuration,
    dotBg: cs(dot).backgroundColor, dotSize: Math.round(r(dot).width),
    haIcon: !!w.querySelector('.swb ha-icon'),
    minOpacity: Math.min(...chain.map((e) => Number(cs(e).opacity))), filters: chain.map((e) => cs(e).filter).filter((f) => f !== 'none'), blends: chain.map((e) => cs(e).mixBlendMode).filter((f) => f !== 'normal'),
    title: t.textContent, tFs: cs(t).fontSize, tFw: cs(t).fontWeight, tColor: cs(t).color,
    sub: sub ? sub.textContent : null, sFs: sub ? cs(sub).fontSize : null, sOp: sub ? cs(sub).opacity : null,
    next: w.nextElementSibling ? w.nextElementSibling.className : null,
  };
});

// ================================================================ H/L1 · «Støvsug alt»
const roomsCfg = { rooms: { sebsatian_soverom: { m2: 14 }, pappa_soverom: { m2: 12 }, mamma_soverom: { m2: 16 }, pappa_kontor: { m2: 11 }, trappegang: { m2: 6 } } };
const p = await page(roomsCfg, { haVars: true });
// Velg alle rom av (ingen valgt) → «Støvsug alt» med sum fra alle rom
await p.evaluate(() => ['sebsatian_soverom', 'pappa_soverom'].forEach((k) => window.__set('input_boolean.sir_sweeps_a_lot_' + k, 'off')));
await p.evaluate(() => window.__set('sensor.rolf_all', 'False'));
// Rom-attributter med minutter (sum «ca N min» fra rom-attributtene)
await p.evaluate(() => ['sebsatian_soverom', 'pappa_soverom', 'mamma_soverom', 'pappa_kontor', 'trappegang'].forEach((k, i) => window.__set('input_boolean.sir_sweeps_a_lot_' + k, 'off', { minutes: [15, 13, 17, 12, 8][i] })));
await wait(p, 300);
const L1 = await pill(p);
ok('L1 diagnose: ingen ha-icon i sirkelen (egen ring + prikk – ingen arv fra --icon-primary-color/Bubble)', !L1.haIcon, L1);
ok('L1 pille: 64 høy, padding 6, radius 32, gap 14, grønn #66d19e, tekst #282828', L1.pillH === 64 && L1.pad === '6px' && L1.rad === '32px' && L1.gap === '14px' && L1.pillBg === GREEN && L1.pillColor === 'rgb(40, 40, 40)', L1);
ok('L1 sirkel: backgroundColor = rgba(16, 36, 26, 0.86), 52×52, radius 26', L1.cellBg === CELL && L1.cellW === 52 && L1.cellH === 52 && L1.cellRad === '26px', L1);
ok('L1 ring 30×30 med 3 px kant i grønt + prikk 9×9 grønn (ikke #282828/svart)', L1.ringBorder === GREEN && L1.ringW === '3px' && L1.ringSize === 30 && L1.dotBg === GREEN && L1.dotSize === 9, L1);
ok('L1 ingen opacity < 1, filter eller mix-blend på sirkel/ring/prikk', L1.minOpacity === 1 && !L1.filters.length && !L1.blends.length, L1);
ok('L1 tittel «Støvsug alt» 16px / 600, undertekst «59 m² · ca 65 min» 12px opacity .75', L1.title === 'Støvsug alt' && L1.tFs === '16px' && L1.tFw === '600' && L1.sub === '59 m² · ca 65 min' && L1.sFs === '12px' && L1.sOp === '0.75', L1);
ok('L3 plassering: «Soner» rett under «Støvsug alt»', L1.next === 'zsec', L1.next);
if (shots) { const el = await p.evaluateHandle(() => window.__c.shadowRoot.querySelector('.sw')); await el.screenshot({ path: `${shots}/rolf47-pille.png` }); }
// valgte rom → «Støvsug valgte rom» med sum for de valgte
await p.evaluate(() => window.__set('input_boolean.sir_sweeps_a_lot_mamma_soverom', 'on', { minutes: 17 }));
await p.evaluate(() => window.__set('sensor.rolf_all', 'True'));
await wait(p, 250);
const L1b = await pill(p);
ok('L1 «Støvsug valgte rom» + sum for valgte (16 m² · ca 17 min)', L1b.title === 'Støvsug valgte rom' && L1b.sub === '16 m² · ca 17 min', L1b);
// kjører → ringen roterer; pause → oransje pille, ring og prikk
await p.evaluate(() => window.__set('vacuum.sir_sweeps_a_lot', 'cleaning'));
await wait(p, 250);
const L1c = await pill(p);
ok('L1 ved kjøring roterer ringen (spin 1.2s linear infinite), tittel «Støvsuger», pause + hjem i pillen', L1c.ringAnim === 'vspin' && L1c.ringDur === '1.2s' && L1c.title === 'Støvsuger' && L1c.cellBg === CELL && (await p.evaluate(() => window.__c.shadowRoot.querySelectorAll('.sw-ctl .sw-cb').length)) === 2, L1c);
await p.evaluate(() => window.__set('vacuum.sir_sweeps_a_lot', 'paused'));
await wait(p, 250);
const L1d = await pill(p);
ok('L1 pause → oransje pille, ring og prikk (#f2b573); sirkelen fortsatt mørk', L1d.pillBg === ORANGE && L1d.ringBorder === ORANGE && L1d.dotBg === ORANGE && L1d.cellBg === CELL && L1d.ringAnim === 'none' && L1d.title === 'Pauset', L1d);
await p.evaluate(() => window.__set('vacuum.sir_sweeps_a_lot', 'docked'));
await p.close();
// ukjent areal/tid → undertekst skjules
const p0 = await page();
await p0.evaluate(() => window.__set('sensor.rolf_all', 'False'));
await p0.evaluate(() => ['sebsatian_soverom', 'pappa_soverom'].forEach((k) => window.__set('input_boolean.sir_sweeps_a_lot_' + k, 'off')));
await wait(p0, 250);
const L1e = await pill(p0);
ok('L1 ukjent m²/min → ingen undertekst (aldri «– m²»)', L1e.title === 'Støvsug alt' && L1e.sub === null, L1e);
await p0.close();
// lys modus: pillen er lik (faste farger på aksent)
const pl = await page(roomsCfg, { light: true });
const L1f = await pill(pl);
ok('L1 lys modus: samme sirkel/ring/tittel', L1f.cellBg === CELL && L1f.ringBorder === GREEN && L1f.tFw === '600' && (await pl.evaluate(() => document.documentElement.getAttribute('data-ki-theme'))) === 'light', L1f);
await pl.close();

// ================================================================ I · Kontroll (ÉTT kort) + L2 fliser
const k = await page();
await tab(k, 'kontroll');
const I1 = await k.evaluate(() => {
  const sr = window.__c.shadowRoot, q = (s) => sr.querySelector(s), cs = (e) => getComputedStyle(e), r = (e) => e.getBoundingClientRect();
  const ctl = q('.ctl'), pp = q('.ctl-pp'), bar = q('.ctl-bar'), btns = [...sr.querySelectorAll('.ctl-b')];
  return {
    cards: sr.querySelectorAll('.pane > .ctl').length, inside: !!(ctl.querySelector('.ctl-top') && ctl.querySelector('.ctl-bar') && ctl.querySelector('.ctl-btns')),
    bg: cs(ctl).backgroundColor, rad: cs(ctl).borderTopLeftRadius, pad: cs(ctl).paddingTop, gap: cs(ctl).rowGap,
    title: q('.ctl-t').textContent, tFs: cs(q('.ctl-t')).fontSize, n: q('.ctl-n').textContent, nFs: cs(q('.ctl-n')).fontSize, nFw: cs(q('.ctl-n')).fontWeight, unit: q('.ctl-u').textContent,
    pp: [Math.round(r(pp).width), Math.round(r(pp).height)], ppBg: cs(pp).backgroundColor, ppIcon: pp.querySelector('ha-icon').getAttribute('icon'),
    barH: Math.round(r(bar).height), barRad: cs(bar).borderTopLeftRadius, barBg: cs(bar).backgroundColor, fill: q('.ctl-bar i').style.width, fillBg: cs(q('.ctl-bar i')).backgroundColor,
    btns: btns.map((x) => [x.textContent.trim(), Math.round(r(x).height), cs(x).borderTopLeftRadius, cs(x).backgroundColor, cs(x).fontSize, cs(x).fontWeight, x.querySelector('ha-icon').getAttribute('icon')]),
    oldTiles: sr.querySelectorAll('.cb, .prog, .pv').length, pick: /Velg entitet/.test(q('.ctl-btns').textContent),
  };
});
ok('I: ÉTT kort (#3a3a3a, radius 28, padding 18, gap 14) med topp, stripe og knapper – ingen gamle fliser', I1.cards === 1 && I1.inside && I1.bg === 'rgb(58, 58, 58)' && I1.rad === '28px' && I1.pad === '18px' && I1.gap === '14px' && !I1.oldTiles, I1);
ok('I: «I dokken» 13px, stort tall 87 (40px / 300) + «% batteri»', I1.title === 'I dokken' && I1.tFs === '13px' && I1.n === '87' && I1.nFs === '40px' && I1.nFw === '300' && I1.unit === '% batteri', I1);
ok('I: play 64×64 grønn (mdi:play), stripe 10 px radius 5 på #282828, fyll = batteri 87 % grønn', I1.pp.join() === '64,64' && I1.ppBg === GREEN && I1.ppIcon === 'mdi:play' && I1.barH === 10 && I1.barRad === '5px' && I1.barBg === 'rgb(40, 40, 40)' && I1.fill === '87%' && I1.fillBg === GREEN, I1);
ok('I: to piller 52 px – «Returner hjem» oransje + home, «Tøm støvsuger» #e1e1e1 + delete, 14px 600, uten «Velg entitet»', JSON.stringify(I1.btns) === JSON.stringify([['Returner hjem', 52, '26px', ORANGE, '14px', '600', 'mdi:home'], ['Tøm støvsuger', 52, '26px', 'rgb(225, 225, 225)', '14px', '600', 'mdi:delete']]) && !I1.pick, I1.btns);
if (shots) await k.screenshot({ path: `${shots}/rolf47-kontroll.png`, fullPage: true });
// kjøring: rød pause, stripete animert fyll, «% ferdig · N min igjen»
await k.evaluate(() => { const c = window.__c; c.setConfig({ ...c._rawConfig, rooms: { sebsatian_soverom: { m2: 14 }, pappa_soverom: { m2: 16 } } }); });
await k.evaluate(() => { const h = window.__h, o = h.states['vacuum.sir_sweeps_a_lot']; window.__h = { ...h, states: { ...h.states, 'vacuum.sir_sweeps_a_lot': { ...o, state: 'cleaning', last_changed: new Date(Date.now() - 10 * 60000).toISOString() } } }; window.__c.hass = window.__h; });
await wait(k, 300);
const I2 = await k.evaluate(() => { const sr = window.__c.shadowRoot, q = (s) => sr.querySelector(s), cs = (e) => getComputedStyle(e); return { title: q('.ctl-t').textContent, n: q('.ctl-n').textContent, unit: q('.ctl-u').textContent, ppBg: cs(q('.ctl-pp')).backgroundColor, icon: q('.ctl-pp ha-icon').getAttribute('icon'), anim: cs(q('.ctl-bar i')).animationName, img: cs(q('.ctl-bar i')).backgroundImage, fanSpin: cs(q('.kfan .kic ha-icon')).animationName }; });
ok('I kjøring: tittel = valgte rom, «% ferdig · N min igjen», rød pause, stripete animert fremdrift', I2.title === 'Soverom, Pappa' && /^\d+$/.test(I2.n) && /^% ferdig · \d+ min igjen$/.test(I2.unit) && I2.ppBg === 'rgb(242, 128, 115)' && I2.icon === 'mdi:pause' && I2.anim === 'vsweep' && /repeating-linear-gradient/.test(I2.img), I2);
ok('L2 vifte-ikonet roterer ved kjøring', I2.fanSpin === 'vspin', I2.fanSpin);
await k.evaluate(() => window.__set('vacuum.sir_sweeps_a_lot', 'paused'));
await wait(k, 250);
const I3 = await k.evaluate(() => getComputedStyle(window.__c.shadowRoot.querySelector('.ctl-bar i')).backgroundColor);
ok('I pause: oransje fremdrift', I3 === ORANGE, I3);
await k.evaluate(() => window.__set('vacuum.sir_sweeps_a_lot', 'docked'));
await wait(k, 250);
// L2 fliser
const L2 = await k.evaluate(() => {
  const sr = window.__c.shadowRoot, q = (s) => sr.querySelector(s), cs = (e) => getComputedStyle(e), r = (e) => e.getBoundingClientRect();
  const fan = q('.kfan'), pills = [...sr.querySelectorAll('.kpill')], set = q('.kset');
  const fr = r(fan), p0 = r(pills[0]), p1 = r(pills[1]);
  return {
    cols: cs(set).gridTemplateColumns.split(' ').length, gap: cs(set).columnGap, segs: sr.querySelectorAll('.seg, .segc').length,
    fan: { h: Math.round(fr.height), rad: cs(fan).borderTopLeftRadius, bg: cs(fan).backgroundColor, label: q('.kfan .kl').textContent, lFs: cs(q('.kfan .kl')).fontSize, ic: [Math.round(r(q('.kfan .kic')).width), cs(q('.kfan .kic')).backgroundColor, q('.kfan .kic ha-icon').getAttribute('icon')], icTop: Math.round(r(q('.kfan .kic')).top - fr.top), icRight: Math.round(fr.right - r(q('.kfan .kic')).right), v: q('.kfan .kv').textContent, vFs: cs(q('.kfan .kv')).fontSize, vFw: cs(q('.kfan .kv')).fontWeight },
    span2: Math.abs(fr.top - p0.top) < 1 && Math.abs(fr.bottom - p1.bottom) < 1, left: fr.left < p0.left,
    pills: pills.map((x) => ({ h: Math.round(r(x).height), rad: cs(x).borderTopLeftRadius, v: x.querySelector('.kv2').textContent, vFs: cs(x.querySelector('.kv2')).fontSize, vFw: cs(x.querySelector('.kv2')).fontWeight, l: x.querySelector('.kl2').textContent, lFs: cs(x.querySelector('.kl2')).fontSize, ic: [Math.round(r(x.querySelector('.kic')).width), x.querySelector('ha-icon').getAttribute('icon')], ent: x.dataset.ent })),
    txt: set.textContent,
  };
});
ok('L2 grid 2 kolonner gap 8, ingen segmenter', L2.cols === 2 && L2.gap === '8px' && !L2.segs, L2);
ok('L2 stor flis: 2 rader (≥124), radius 24, «Viftehastighet» 12px, ikon-sirkel 50 #404040 (mdi:fan) 4 px inn, «Standard» 28px/300', L2.span2 && L2.left && L2.fan.h >= 124 && L2.fan.rad === '24px' && L2.fan.bg === 'rgb(58, 58, 58)' && L2.fan.label === 'Viftehastighet' && L2.fan.lFs === '12px' && L2.fan.ic.join() === '50,rgb(64, 64, 64),mdi:fan' && L2.fan.icTop === 4 && L2.fan.icRight === 4 && L2.fan.v === 'Standard' && L2.fan.vFs === '28px' && L2.fan.vFw === '300', L2.fan);
ok('L2 piller ≥58 (radius 29): «Standard · Mopp modus» (mdi:broom), «Middels · Mopp intensitet» (mdi:tune-variant), 14/600 + 13px', L2.pills.length === 2 && L2.pills.every((x) => x.h >= 58 && x.rad === '29px' && x.vFs === '14px' && x.vFw === '600' && x.lFs === '13px' && x.ic[0] === 50) && L2.pills[0].v === 'Standard' && L2.pills[0].l === 'Mopp modus' && L2.pills[0].ic[1] === 'mdi:broom' && L2.pills[1].v === 'Middels' && L2.pills[1].l === 'Mopp intensitet' && L2.pills[1].ic[1] === 'mdi:tune-variant', L2.pills);
ok('L2 autofunn: moppvalg = select.* på robotens enhet', L2.pills[0].ent === 'select.sir_sweeps_a_lot_mop_mode' && L2.pills[1].ent === 'select.sir_sweeps_a_lot_mop_intensity', L2.pills.map((x) => x.ent));
ok('L2 aldri True/False', !/true|false/i.test(L2.txt), L2.txt);
// trykk = neste valg (+ scale-animasjon + én haptic «selection»)
await clear(k);
const tapRes = await k.evaluate(() => { const sr = window.__c.shadowRoot, el = sr.querySelector('.kpill[data-k="mop"]'); el.click(); const an = el.getAnimations ? el.getAnimations().length : 0; return { an, hap: window.__hap.slice() }; });
await wait(k, 80); await click(k, '.kfan');
await wait(k, 80); await click(k, '.kpill[data-k="mop_intensity"]');
let cl = await calls(k);
const hap = await k.evaluate(() => window.__hap.slice());
ok('L2 trykk = neste: vifte balanced→turbo, mopp standard→deep, intensitet moderate→intense', cl.includes('vacuum set_fan_speed vacuum.sir_sweeps_a_lot turbo') && cl.includes('select select_option select.sir_sweeps_a_lot_mop_mode deep') && cl.includes('select select_option select.sir_sweeps_a_lot_mop_intensity intense'), cl);
ok('L2 trykk-animasjon (scale .97) + haptic «selection», én per trykk', tapRes.an >= 1 && tapRes.hap.join() === 'selection' && hap.length === 3 && hap.every((x) => x === 'selection'), { tapRes, hap });
const tpCss = await k.evaluate(() => [...window.__c.shadowRoot.querySelectorAll('style')].map((s) => s.textContent).join('').includes('.tp:active{transform:scale(.97)}'));
ok('L2 :active scale(.97) i CSS', tpCss, tpCss);
// sykler rundt: siste → første
await k.evaluate(() => { window.__set('select.sir_sweeps_a_lot_mop_intensity', 'intense'); window.__set('vacuum.sir_sweeps_a_lot', 'docked', { fan_speed: 'max' }); });
await wait(k, 200); await clear(k);
await click(k, '.kpill[data-k="mop_intensity"]'); await click(k, '.kfan');
cl = await calls(k);
ok('L2 sykler rundt (intense→off, max→quiet) og viser norsk («Intens», «Maks»)', cl.includes('select select_option select.sir_sweeps_a_lot_mop_intensity off') && cl.includes('vacuum set_fan_speed vacuum.sir_sweeps_a_lot quiet') && (await k.evaluate(() => window.__c.shadowRoot.querySelector('.kfan .kv').textContent + '|' + window.__c.shadowRoot.querySelector('.kpill[data-k="mop_intensity"] .kv2').textContent)) === 'Maks|Intens', cl);
// hold 500 ms → more-info (valgliste)
await clear(k);
const held = await k.evaluate(async () => {
  const el = window.__c.shadowRoot.querySelector('.kpill[data-k="mop"]'), r = el.getBoundingClientRect();
  el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true, pointerId: 5, clientX: r.left + 10, clientY: r.top + 10, button: 0 }));
  await new Promise((q) => setTimeout(q, 420)); const early = window.__mi.length;
  await new Promise((q) => setTimeout(q, 150));
  el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, composed: true, pointerId: 5 })); el.click();
  return { early, mi: window.__mi.slice() };
});
cl = await calls(k);
ok('L2 hold 500 ms → more-info for select-entiteten (ikke før, og ikke i tillegg et bytte)', held.early === 0 && held.mi.join() === 'select.sir_sweeps_a_lot_mop_mode' && !cl.some((x) => /select_option/.test(x)), { held, cl });
await k.close();
// feil kobling: binær/boolsk entitet → «–» + «Velg entitet», aldri True/False
const kb = await page({ entities: { mop: 'binary_sensor.sir_sweeps_a_lot_charging', mop_intensity: 'sensor.rolf_all' } });
await tab(kb, 'kontroll');
const L2b = await kb.evaluate(() => { const sr = window.__c.shadowRoot; return { pills: [...sr.querySelectorAll('.kpill')].map((x) => [x.querySelector('.kv2').textContent, x.querySelector('.kl2').textContent, x.classList.contains('miss'), getComputedStyle(x.querySelector('.kv2')).color]), txt: sr.querySelector('.kset').textContent }; });
ok('L2 binær/«True»-entitet = feil kobling → «–» + «Velg entitet» (dempet), aldri True/False', L2b.pills.every((x) => x[0] === '–' && /Velg entitet/.test(x[1]) && x[2] && x[3] === 'rgb(127, 127, 127)') && !/true|false/i.test(L2b.txt), L2b);
await clear(kb);
await click(kb, '.kpill[data-k="mop"]');
await wait(kb, 400);
const ed1 = await kb.evaluate(() => { const portal = window.MSH.portals().pop(), ed = portal && portal.shadowRoot.querySelector('msh-editor'); return { ed: !!ed, calls: window.__calls.filter((c) => c[0] !== 'ws').length }; });
ok('L2 «Velg entitet»-flis åpner Tilpass (ingen tjenestekall)', ed1.ed && ed1.calls === 0, ed1);
await kb.close();
// ingen select på enheten (og en mopp-select på en ANNEN enhet) → «–», ikke feil kobling til den andre
const kn = await page(null, { drop: ['select.sir_sweeps_a_lot_mop_mode', 'select.sir_sweeps_a_lot_mop_intensity'], extra: [['select.annen_robot_mop_mode', 'deep', { friendly_name: 'Annen mop mode', options: ['standard', 'deep'] }, 'dev_annen']] });
await tab(kn, 'kontroll');
const L2c = await kn.evaluate(() => [...window.__c.shadowRoot.querySelectorAll('.kpill .kv2')].map((e) => e.textContent).join('|'));
ok('L2 autofunn kun på samme enhet: annen robots select brukes ikke', L2c === '–|–', L2c);
ok('L2 oversettelser', (await kn.evaluate(() => ['off', 'standard', 'deep', 'low', 'medium', 'high', 'quiet', 'balanced', 'strong', 'turbo', 'moderate', 'max_plus', 'some_mode'].map(window.MSH.stovsuger.nbOpt).join('|'))) === 'Av|Standard|Dyp|Lav|Middels|Høy|Stille|Standard|Sterk|Turbo|Middels|Maks+|Some mode');
await kn.close();
// I · mangler «Tøm»-entitet → dempet knapp som åpner entitetsvalget
const ke = await page({ entities: { empty: 'none' } });
await tab(ke, 'kontroll');
const Ie = await ke.evaluate(() => { const b = window.__c.shadowRoot.querySelector('.ctl-b.em'); return { off: b.classList.contains('off'), op: getComputedStyle(b).opacity, txt: b.textContent.trim() }; });
await clear(ke);
await click(ke, '.ctl-b.em');
await wait(ke, 400);
const Ie2 = await ke.evaluate(() => { const portal = window.MSH.portals().pop(), ed = portal && portal.shadowRoot.querySelector('msh-editor'); return { ed: !!ed, txt: ed ? ed.shadowRoot.textContent : '', calls: window.__calls.filter((c) => c[0] !== 'ws').length, hap: window.__hap.length }; });
ok('I mangler «Tøm»: knappen dempet (opacity .5), samme tekst; trykk åpner Tilpass → Entiteter (én haptic)', Ie.off && Ie.op === '0.5' && Ie.txt === 'Tøm støvsuger' && Ie2.ed && /Tøm støvsuger/.test(Ie2.txt) && Ie2.calls === 0 && Ie2.hap === 1, { Ie, Ie2: { ...Ie2, txt: Ie2.txt.slice(0, 80) } });
await ke.close();
// I · tømming animerer («Tømmer…»)
const kt = await page();
await tab(kt, 'kontroll');
await click(kt, '.ctl-b.em');
await wait(kt, 100);
const It = await kt.evaluate(() => { const b = window.__c.shadowRoot.querySelector('.ctl-b.em'); return { txt: b.textContent.trim(), anim: getComputedStyle(b.querySelector('ha-icon')).animationName }; });
ok('I «Tøm støvsuger» → «Tømmer…» med animert ikon', It.txt === 'Tømmer…' && It.anim === 'vempty', It);
await kt.close();

// ================================================================ J · Info-prosa
const j = await page({ name: 'Rolf' }, { extra: [] });
await j.evaluate(() => { window.__set('sensor.sir_sweeps_a_lot_total_cleaning_area', '7574'); window.__set('sensor.sir_sweeps_a_lot_total_cleaning_time', '207:00'); });
await tab(j, 'info');
const J1 = await j.evaluate(() => {
  const sr = window.__c.shadowRoot, pr = sr.querySelector('.prose'), cs = (e) => getComputedStyle(e), ch = [...pr.querySelectorAll('.pchip')];
  return { txt: pr.textContent.replace(/\s+/g, ' ').trim(), first: sr.querySelector('.pane').firstElementChild === pr, fs: cs(pr).fontSize, fw: cs(pr).fontWeight, lh: cs(pr).lineHeight, pad: cs(pr).padding, bg: cs(pr).backgroundColor, color: cs(pr).color,
    chips: ch.map((c) => [Math.round(c.getBoundingClientRect().height), cs(c).borderTopLeftRadius, cs(c).paddingLeft, cs(c).backgroundColor, cs(c).color, cs(c).fontWeight, cs(c).fontVariantNumeric]), stat: sr.querySelectorAll('.stat, .stats').length, vedl: !!sr.querySelector('.vlist .vrow') };
});
ok('J prosa: «Rolf har vasket 7574 m² som tilsvarer ca 1,1 fotballbaner, det har han brukt mer enn 8 dager og 15 timer på til sammen.»', J1.txt === 'Rolf har vasket 7574 m² som tilsvarer ca 1,1 fotballbaner, det har han brukt mer enn 8 dager og 15 timer på til sammen.' && J1.first, J1.txt);
ok('J stil: 21px / 500, linjehøyde 1.95, padding 6px, ingen kortbakgrunn; chips 36 høye, radius 18, padding 14, lys med mørk tekst 600, tabulære tall', J1.fs === '21px' && J1.fw === '500' && J1.lh === '40.95px' && /^6px 6px 10px/.test(J1.pad) && J1.bg === 'rgba(0, 0, 0, 0)' && J1.chips.length === 3 && J1.chips.every((c) => c[0] === 36 && c[1] === '18px' && c[2] === '14px' && c[3] === 'rgb(250, 250, 250)' && c[4] === 'rgb(35, 35, 35)' && c[5] === '600' && c[6] === 'tabular-nums'), J1);
ok('J statistikkortene er fjernet, vedlikehold beholdt', J1.stat === 0 && J1.vedl, J1);
await j.evaluate(() => { window.__set('sensor.sir_sweeps_a_lot_total_cleaning_time', '15:00'); });
await wait(j, 200);
const J2 = await j.evaluate(() => [...window.__c.shadowRoot.querySelectorAll('.pchip')].map((c) => c.textContent).join('|'));
ok('J under ett døgn: «15 timer»', J2 === '7574 m²|1,1 fotballbaner|15 timer', J2);
if (shots) await j.screenshot({ path: `${shots}/rolf47-info.png`, fullPage: true });
await j.close();
const jm = await page({ entities: { area: 'none', time: 'none' } });
await tab(jm, 'info');
const J3 = await jm.evaluate(() => { const sr = window.__c.shadowRoot; return { chips: [...sr.querySelectorAll('.pchip')].map((c) => c.textContent).join('|'), pick: !!sr.querySelector('.ppick .pick') }; });
ok('J mangler sensor → chip «–» + «Velg entitet»', J3.chips === '–|–|–' && J3.pick, J3);
await jm.close();

// ================================================================ L3 · Soner
const extra = [
  ['script.robot_sone_gang', 'off', { friendly_name: 'Sone gang' }],
  ['script.sir_sweeps_a_lot_hjorne', 'off', { friendly_name: 'Sir Sweeps a lot sone hjørne' }],
  ['script.set_timezone', 'off', { friendly_name: 'Sett tidssone' }],
  ['script.stovsuger_ekstra', 'off', { friendly_name: 'Støvsuger ekstra' }],
];
const z = await page(null, { extra });
const Z1 = await z.evaluate(() => {
  const sr = window.__c.shadowRoot, cs = (e) => getComputedStyle(e), zs = [...sr.querySelectorAll('.zc')], h = sr.querySelector('.zh'), row = sr.querySelector('.zones');
  return { names: zs.map((e) => e.textContent.trim()), ids: zs.map((e) => e.dataset.id), head: h.textContent, hFs: cs(h).fontSize, hColor: cs(h).color, hPad: cs(h).paddingLeft,
    pill: [Math.round(zs[0].getBoundingClientRect().height), cs(zs[0]).borderTopLeftRadius, cs(zs[0]).paddingLeft, cs(zs[0]).paddingRight, cs(zs[0]).backgroundColor, cs(zs[0]).fontSize, cs(zs[0]).fontWeight, zs[0].querySelector('ha-icon').getAttribute('icon'), zs[0].querySelector('ha-icon').style.width],
    gap: cs(row).columnGap, ta: cs(row).touchAction, sb: cs(row).scrollbarWidth, ox: cs(row).overflowX, icons: zs.map((e) => e.querySelector('ha-icon').getAttribute('icon')) };
});
ok('L3 autofunn: script.*_zone_* + *_sone_* + robotens prefiks med «sone» i navnet; ikke timezone/andre skript', Z1.ids.join('|') === 'script.rolf_zone_stuebord|script.rolf_zone_stuebord_mye|script.rolf_zone_stue_uten_spisebord|script.rolf_zone_teppe|script.rolf_zone_kjokkenbord|script.sir_sweeps_a_lot_hjorne|script.robot_sone_gang'.split('|').sort((a, b) => (a.startsWith('script.sir_') ? -1 : 0) - (b.startsWith('script.sir_') ? -1 : 0)).join('|'), Z1.ids);
ok('L3 navn fra friendly_name (uten robot-prefiks)', Z1.names.join('|') === 'Hjørne|Spisebord lite|Spisebord mye|Stue uten spisebord|Teppe stue|Kjøkkenbord|Gang', Z1.names);
ok('L3 stil: «Soner» 13px #979797 padding 6; piller 60 høye, radius 30, padding 18/22, #3a3a3a, 16px/500, ikon 22 (table-furniture), gap 8', Z1.head === 'Soner' && Z1.hFs === '13px' && Z1.hColor === 'rgb(151, 151, 151)' && Z1.hPad === '6px' && JSON.stringify(Z1.pill) === JSON.stringify([60, '30px', '18px', '22px', 'rgb(58, 58, 58)', '16px', '500', 'mdi:table-furniture', '22px']) && Z1.gap === '8px', Z1);
ok('L3 rad: vannrett scroll uten scrollbar, touch-action pan-x', Z1.ta === 'pan-x' && Z1.sb === 'none' && Z1.ox === 'auto', Z1);
ok('L3 ikoner etter navn (teppe → texture, kjøkken → countertop)', Z1.icons[4] === 'mdi:texture' && Z1.icons[5] === 'mdi:countertop-outline', Z1.icons);
await clear(z);
const zt = await z.evaluate(() => { const el = window.__c.shadowRoot.querySelector('.zc[data-id="script.rolf_zone_teppe"]'); el.click(); return { on: el.classList.contains('on') || el.getAttribute('aria-pressed') === 'true', hap: window.__hap.slice() }; });
await wait(z, 200);
cl = await calls(z);
const zAfter = await z.evaluate(() => { const el = window.__c.shadowRoot.querySelector('.zc[data-id="script.rolf_zone_teppe"]'); return { cls: el.className, bg: getComputedStyle(el).backgroundColor }; });
ok('L3 trykk → script.turn_on + én haptic, aldri aktiv-tilstand', cl.join() === 'script turn_on script.rolf_zone_teppe' && zt.hap.length === 1 && !zt.on && !/\bon\b/.test(zAfter.cls) && zAfter.bg === 'rgb(58, 58, 58)', { cl, zt, zAfter });
// skriptet «kjører» (state on) → fortsatt hvile-utseende
await z.evaluate(() => window.__set('script.rolf_zone_teppe', 'on'));
await wait(z, 200);
const zOn = await z.evaluate(() => getComputedStyle(window.__c.shadowRoot.querySelector('.zc[data-id="script.rolf_zone_teppe"]')).backgroundColor);
ok('L3 skript på (state on) → samme hvile-utseende', zOn === 'rgb(58, 58, 58)', zOn);
const zCss = await z.evaluate(() => [...window.__c.shadowRoot.querySelectorAll('style')].map((s) => s.textContent).join('').includes('.press:active{transform:scale(.96)}'));
ok('L3 trykk-animasjon scale(.96)', zCss, zCss);
const zp = await z.evaluate(async () => {
  window.__popEv = 0;
  const chip = window.__c.shadowRoot.querySelector('.zc');
  const tp = (t) => { const T = new Touch({ identifier: 1, target: chip, clientX: 100, clientY: 600 }); chip.dispatchEvent(new TouchEvent(t, { bubbles: true, composed: true, touches: [T], changedTouches: [T] })); };
  tp('touchstart'); tp('touchmove');
  chip.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true, pointerId: 3 }));
  chip.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, composed: true, pointerId: 3 }));
  const n = window.__popEv; chip.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, composed: true, pointerId: 3 })); return n;
});
ok('L3 sveip i sonerraden bobler ikke til popupen (stopPropagation)', zp === 0, zp);
if (shots) await z.screenshot({ path: `${shots}/rolf47-renhold.png`, fullPage: true });
// Tilpass → Entiteter → «Soner (skript)»: legg til, skjul (zoneHid) → kortet oppdateres
await click(z, '.gear'); await wait(z, 500);
const ZE = await z.evaluate(async () => {
  const portal = window.MSH.portals().pop(), ed = portal.shadowRoot.querySelector('msh-editor'), R = ed.shadowRoot, sl = (ms) => new Promise((q) => setTimeout(q, ms));
  [...R.querySelectorAll('[data-a="tab"]')].find((t) => t.dataset.v === 'entiteter').click(); await sl(250);
  const has = /Soner \(skript\)/.test(R.textContent);
  const opener = [...R.querySelectorAll('[data-op="zaddopen"]')].pop(); opener.click(); await sl(200);
  const inp = R.querySelector('[data-zadd="id"]'); inp.value = 'script.stovsuger_ekstra';
  R.querySelector('[data-zadd="name"]').value = 'Ekstra';
  R.querySelector('[data-op="zadd"]').click(); await sl(300);
  const cfg1 = JSON.parse(JSON.stringify(ed._config.zones || {}));
  const card1 = [...window.__c.shadowRoot.querySelectorAll('.zc')].map((e) => e.textContent.trim());
  R.querySelector('.vzone[data-edk="robot_sone_gang"] [data-op="zeye"]').click(); await sl(300);
  const card2 = [...window.__c.shadowRoot.querySelectorAll('.zc')].map((e) => e.textContent.trim());
  const del = !!R.querySelector('.vzone[data-edk="stovsuger_ekstra"] [data-op="zdel"]');
  return { has, cfg1, card1, card2, del, hid: ed._config.zones.robot_sone_gang };
});
ok('L3 Tilpass → Entiteter har «Soner (skript)»; «Legg til sone» → zones.<id> (manual) og vises i kortet', ZE.has && ZE.cfg1.stovsuger_ekstra && ZE.cfg1.stovsuger_ekstra.entity === 'script.stovsuger_ekstra' && ZE.card1.includes('Ekstra') && ZE.del, ZE);
ok('L3 skjult sone (zones.<k>.hidden) filtreres bort', ZE.hid && ZE.hid.hidden === true && !ZE.card2.includes('Gang') && ZE.card2.includes('Ekstra'), ZE);
await z.close();
// GUI-editoren har samme seksjon
const g = await page();
const G = await g.evaluate(async () => {
  const cls = customElements.get('msh-stovsuger-card'), ed = cls.getConfigElement(); document.body.appendChild(ed); ed.hass = window.__h; ed.setConfig({ type: 'custom:msh-stovsuger-card', ...cls.getStubConfig() });
  await new Promise((q) => setTimeout(q, 300));
  const R = ed.shadowRoot; [...R.querySelectorAll('[data-a="tab"]')].find((t) => t.dataset.v === 'entiteter').click(); await new Promise((q) => setTimeout(q, 250));
  return { soner: /Soner \(skript\)/.test(R.textContent), zones: R.querySelectorAll('.vzone').length, stubMop: cls.getStubConfig().entities.mop };
});
ok('GUI-editor: Entiteter → «Soner (skript)» med samme liste; stub har ingen hardkodet mopp-entitet', G.soner && G.zones === 5 && G.stubMop === undefined, G);
await g.close();
// ingen sone-skript → raden skjules
const zn = await page(null, { drop: ['script.rolf_zone_stuebord', 'script.rolf_zone_stuebord_mye', 'script.rolf_zone_stue_uten_spisebord', 'script.rolf_zone_teppe', 'script.rolf_zone_kjokkenbord'] });
const Zn = await zn.evaluate(() => ({ sec: !!window.__c.shadowRoot.querySelector('.zsec'), sw: !!window.__c.shadowRoot.querySelector('.sw') }));
ok('L3 ingen sone-skript og ingen egne → raden skjules (pillen vises)', !Zn.sec && Zn.sw, Zn);
await zn.close();

ok('ingen sidefeil', !errs.length, errs);
await b.close();
for (const [k2, v] of Object.entries(res)) console.log(v === 'OK' ? 'OK  ' : 'FEIL', k2, v === 'OK' ? '' : JSON.stringify(v[1]).slice(0, 700));
console.log(fail.length ? `\n${fail.length} feil` : '\nAlt OK');
try { unlinkSync(bundle); } catch (e) { /* */ }
process.exit(fail.length ? 1 : 0);
