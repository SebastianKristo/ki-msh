// Fiks 47 · Strøm-popup (#strom) mot EKTE Bubble Card – delene M, N, O, P, Q, R, T (61-strom.js, 62-strom-kurser.js,
// felles segment 05-segment.js). Kjører den virkelige popupen (strategien → Bubble pop-up → msh-strom-card).
//   M: huset skaleres etter høyden (calc(100% − 96px), maks 58 %, nederst til høyre) og slutter over flisene;
//      spotpris-merket 22 px / 11 px / prikk 6 px; spot_chip av/på i Tilpass → Visning → Toppkort + GUI-editoren
//   N: «Inkludert i prisen»: hel rosa pille når på, 72 px, 2 kolonner, håndtak; trykk = veksle, hold 500 ms = more-info,
//      bevegelse > 8 px avbryter, klikket etter hold ignoreres; entiteter fra Tilpass → Entiteter (tg_*)
//   O: Tilpass → Visning: «Hva koster det nå» som akkordeon (lukket som standard, ikke i config) + Fanelinje/Forbruk-kort
//   P: Kurser: «Kroner | kWh» og «I dag | Måneden» via M.segment – sentrert tekst, like brede valg, aktiv pille 4 px inne
//   Q: trykk på fordelingsbaren → forklaring; segment/rad velger og demper de andre; teksten byttes; < 2 % → «Annet»; 44 px
//   R: pris-pillen bytter Norgespris ⇄ Spotpris for alle kr-tall (kWh uendret); stil; pointerdown stopper; remember_view
//   T: watt, spot-merket, tre fliser (Trinn: hold → margin), huset og bilen → more-info (haptic light, scale .97)
//   node test/strom47-check.mjs
import { createRequire } from 'node:module';
import { readdirSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
mkdirSync('test/.build', { recursive: true });
mkdirSync('test/.vendor', { recursive: true });
const BC = resolve('test/.vendor/bubble-card.js');
if (!existsSync(BC)) execFileSync('curl', ['-sSL', '-o', BC, 'https://raw.githubusercontent.com/Clooos/Bubble-Card/main/dist/bubble-card.js']);
const bundle = resolve(`test/.build/strom47-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const mocks = readdirSync('test/mock').filter((f) => f.endsWith('.js')).sort().map((m) => resolve('test/mock/' + m));
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const fail = [];
const ok = (name, cond, info) => { console.log(`${cond ? '✔' : '✘'} ${name}${cond ? '' : ' · ' + JSON.stringify(info).slice(0, 900)}`); if (!cond) fail.push(name); };

const p = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
p.on('console', (m) => { if (m.type() === 'error' && !/ERR_|CORS|bubble-modules|Failed to/.test(m.text())) errs.push(m.text().slice(0, 160)); });
await p.goto('file://' + resolve('test/harness-bubble.html'));
for (const m of mocks) await p.addScriptTag({ path: m });
await p.addScriptTag({ path: bundle });
await p.addScriptTag({ path: BC, type: 'module' });
await p.waitForFunction(() => customElements.get('bubble-card'));
const wait = (ms) => p.waitForTimeout(ms);
const ev = (fn, a) => p.evaluate(fn, a);

// ---- dashbordet + #strom
const G = await ev(async () => {
  const wait = (ms) => new Promise((q) => setTimeout(q, ms));
  const M = window.MSH, S = customElements.get('ll-strategy-dashboard-ki-dashboard');
  const h = window.mockHass();
  window.__h = h;
  await M.store.load(h);
  const d = await S.generate({}, h), stack = d.views[0].cards[0];
  const root = document.getElementById('dash');
  for (const c of stack.cards) { const el = document.createElement(c.type.replace('custom:', '')); el.setConfig(c); el.hass = h; root.appendChild(el); }
  await wait(700);
  location.hash = '#strom'; await wait(1300);
  const all = () => { const o = []; const w = (x) => x.querySelectorAll('*').forEach((e) => { o.push(e); if (e.shadowRoot) w(e.shadowRoot); }); w(document); return o; };
  const pe = all().find((e) => e.classList && e.classList.contains('bubble-pop-up') && e.classList.contains('is-popup-opened'));
  window.__card = pe && [...pe.querySelectorAll('*')].find((e) => e.localName === 'msh-strom-card');
  // more-info og haptic registreres
  window.__mi = []; window.__hp = [];
  window.addEventListener('hass-more-info', (e) => window.__mi.push(e.detail.entityId), true);
  window.addEventListener('haptic', (e) => window.__hp.push(e.detail), true);
  return { open: !!window.__card, seg: !!M.segment && typeof M.segment.html === 'function' && typeof M.segment.css === 'string' && typeof M.segment.bind === 'function' };
});
ok('#strom åpnes via hash (msh-strom-card) og M.segment finnes (css/html/bind)', G.open && G.seg, G);
await wait(600);
const R = (sel) => `window.__card.shadowRoot.querySelector(${JSON.stringify(sel)})`;

/* ================================================================ M */
const MM = await ev(() => {
  const S = window.__card.shadowRoot, hero = S.querySelector('.hero'), img = S.querySelector('img.hus'), tiles = S.querySelector('.htiles .ht'), chip = S.querySelector('.hchip:not(.ph)');
  const hr = hero.getBoundingClientRect(), ir = img.getBoundingClientRect(), tr = tiles.getBoundingClientRect(), cs = getComputedStyle(img), ccs = chip && getComputedStyle(chip), dot = chip && chip.querySelector('.pdot').getBoundingClientRect();
  return { heroH: hr.height, heroW: hr.width, imgH: ir.height, imgW: ir.width, imgBottom: ir.bottom - hr.top, tilesTop: tr.top - hr.top, rightGap: hr.right - ir.right, fit: cs.objectFit, pos: cs.objectPosition, mask: cs.webkitMaskImage || cs.maskImage,
    chip: chip && { h: chip.getBoundingClientRect().height, fs: ccs.fontSize, fw: ccs.fontWeight, pl: ccs.paddingLeft, gap: ccs.columnGap, bg: ccs.backgroundColor, col: ccs.color, dot: Math.round(dot.width), ping: getComputedStyle(chip.querySelector('.pg')).animationName } };
});
ok('M: huset har høyde = toppkort − 96 px, maks 58 % bredde, contain nederst til høyre, maske fra venstre', Math.abs(MM.imgH - (MM.heroH - 96)) <= 1 && MM.imgW <= MM.heroW * 0.58 + 1 && MM.fit === 'contain' && /100%\s+100%|right bottom/.test(MM.pos) && /gradient/.test(MM.mask) && Math.abs(MM.rightGap + 6) <= 1, MM);
ok('M: huset slutter over flise-raden (ikke bak flisene)', MM.imgBottom <= MM.tilesTop + 1, MM);
ok('M: spotpris-merket 22 px, 11 px/500, padding 9, gap 5, prikk 6 px med ping, rgba(242,176,79,.18)', MM.chip && Math.round(MM.chip.h) === 22 && MM.chip.fs === '11px' && MM.chip.fw === '500' && MM.chip.pl === '9px' && MM.chip.gap === '5px' && MM.chip.dot === 6 && MM.chip.ping === 'ping' && /rgba\(242, 176, 79, 0\.18\)/.test(MM.chip.bg) && MM.chip.col === 'rgb(246, 200, 130)', MM.chip);
// bredere kort (PC): fortsatt over flisene
await p.setViewportSize({ width: 1100, height: 900 }); await wait(300);
const MW = await ev(() => { const S = window.__card.shadowRoot, hr = S.querySelector('.hero').getBoundingClientRect(), ir = S.querySelector('img.hus').getBoundingClientRect(), tr = S.querySelector('.htiles .ht').getBoundingClientRect(); return { w: hr.width, imgBottom: ir.bottom - hr.top, tilesTop: tr.top - hr.top, imgW: ir.width }; });
ok('M: på bred skjerm slutter huset også over flisene', MW.imgBottom <= MW.tilesTop + 1 && MW.imgW <= MW.w * 0.58 + 1, MW);
await p.setViewportSize({ width: 390, height: 844 }); await wait(300);
const tilesTop0 = await ev(() => Math.round(window.__card.shadowRoot.querySelector('.htiles').getBoundingClientRect().top));
await ev(() => window.__card.setCfg({ spot_chip: false })); await wait(300);
const M2 = await ev(() => ({ chip: !!window.__card.shadowRoot.querySelector('.hchip:not(.ph)'), top: Math.round(window.__card.shadowRoot.querySelector('.htiles').getBoundingClientRect().top), cfg: window.__card.config.spot_chip }));
ok('M: spot_chip: false fjerner merket, flisene står på samme plass', !M2.chip && M2.cfg === false && M2.top === tilesTop0, { M2, tilesTop0 });
await ev(() => window.__card.setCfg({ spot_chip: null })); await wait(300);
ok('M: standard (spot_chip mangler) → merket vises', await ev(() => !!window.__card.shadowRoot.querySelector('.hchip:not(.ph)')));

/* ================================================================ T */
const TT = await ev(() => {
  const S = window.__card.shadowRoot, q = (k) => S.querySelector(`[data-hk="${k}"]`);
  const info = (el) => el && { mi: el.classList.contains('hmi'), act: el.dataset.act, id: el.dataset.id, ent: el.dataset.ent || null, hap: el.dataset.haptic };
  return { watt: info(q('watt')), spot: info(q('spot')), dag: info(q('dag')), norge: info(q('norge')), trinn: info(q('trinn')), trinnTxt: q('trinn').textContent, hus: info(S.querySelector('[data-hz="hus"]')), bil: (() => { const z = S.querySelector('[data-hz="bil"]'); return z && { id: z.dataset.id, hash: z.dataset.hash }; })(), ents: { effekt: window.__card.ent('effekt'), dag: window.__card.ent('dag'), trinn: window.__card.ent('trinn'), margin: window.__card.ent('margin'), bil: window.__card.ent('bil') } };
});
ok('T: autokonfig via søkemønstre (effekt, *dagens_kostnad, *kapasitetstrinn_intervall, *margin_til_neste_trinn)', !!TT.ents.effekt && TT.ents.dag === 'sensor.manedlig_forbruk_dagens_kostnad' && TT.ents.trinn === 'sensor.nettleie_elvia_kapasitetstrinn_intervall' && TT.ents.margin === 'sensor.nettleie_elvia_margin_til_neste_trinn', TT.ents);
ok('T: watt, spotpris-merke, I dag, Norgespris og Trinn er trykkflater (data-act=mi, haptic light)', ['watt', 'spot', 'dag', 'norge', 'trinn'].every((k) => TT[k] && TT[k].mi && TT[k].act === 'mi' && TT[k].id && TT[k].hap === 'light'), TT);
ok('T: Trinn → intervall-sensoren ved trykk, margin-sensoren ved hold (data-ent)', TT.trinn.id === TT.ents.trinn && TT.trinn.ent === TT.ents.margin, TT.trinn);
ok('T: huset → effekt-sensoren; bilen → Tesla-popupen (#tesla) eller lader-entitet', TT.hus && TT.hus.id === TT.ents.effekt && TT.bil && (TT.bil.hash === '#tesla' || /charger_power|lader/.test(TT.bil.id || '')), { hus: TT.hus, bil: TT.bil });
// trykk → more-info
for (const k of ['watt', 'spot', 'dag', 'norge', 'trinn']) { await ev((k) => window.__card.shadowRoot.querySelector(`[data-hk="${k}"]`).click(), k); await wait(60); }
const HZ = await ev(() => { const b = window.__card.shadowRoot.querySelector('[data-hz="hus"]'), r = b.getBoundingClientRect(), img = window.__card.shadowRoot.querySelector('img.hus').getBoundingClientRect(); const hit = window.__card.shadowRoot.elementFromPoint(r.left + r.width * 0.6, r.top + r.height * 0.5); return { tag: b.localName, w: r.width, h: r.height, inImg: r.right <= img.right + 1 && r.bottom <= img.bottom + 1, hit: hit && hit.dataset && hit.dataset.hz }; });
ok('T: huset/bilen er HTML-knapper (foreignObject) innenfor illustrasjonen og treffes av pekeren', HZ.tag === 'button' && HZ.w > 50 && HZ.inImg && HZ.hit === 'hus', HZ);
await ev(() => window.__card.shadowRoot.querySelector('[data-hz="hus"]').click()); await wait(60);
const MI1 = await ev(() => window.__mi.slice());
ok('T: trykk åpner more-info for hver del (watt, spot, I dag, Norgespris, Trinn, huset)', MI1.length === 6 && MI1[0] === TT.watt.id && MI1[1] === TT.spot.id && MI1[2] === TT.dag.id && MI1[3] === TT.norge.id && MI1[4] === TT.trinn.id && MI1[5] === TT.hus.id, MI1);
const pressS = await ev(() => { const S = window.__card.shadowRoot; const st = [...S.styleSheets || []].length; const css = S.innerHTML.includes('.hero .hmi:active{transform:scale(.97)}') || [...S.querySelectorAll('style')].some((x) => x.textContent.includes('.hero .hmi:active{transform:scale(.97)}')); return css; });
ok('T: trykk-animasjon scale(.97) på trykkflatene', pressS);
// hold på Trinn → margin
await ev(() => { window.__mi.length = 0; const el = window.__card.shadowRoot.querySelector('[data-hk="trinn"]'), r = el.getBoundingClientRect(); el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true, clientX: r.left + 10, clientY: r.top + 10, pointerId: 5, button: 0 })); });
await wait(600);
await ev(() => { const el = window.__card.shadowRoot.querySelector('[data-hk="trinn"]'); el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, composed: true, pointerId: 5 })); el.click(); });
await wait(100);
const MI2 = await ev(() => window.__mi.slice());
ok('T: hold 500 ms på Trinn → more-info for margin-sensoren, klikket etter hold ignoreres', MI2.length === 1 && MI2[0] === TT.ents.margin, MI2);
// mangler entitet → ingen trykkflate
await ev(() => window.__card.setCfg({ ent: { dag: 'sensor.finnes_ikke_47' } })); await wait(250);
const T3 = await ev(() => { const el = window.__card.shadowRoot.querySelector('[data-hk="dag"]'); return { mi: el.classList.contains('hmi'), act: el.dataset.act || null, txt: el.textContent }; });
ok('T: mangler entitet → ingen more-info / trykk-animasjon (verdi «–»)', !T3.mi && !T3.act && /–/.test(T3.txt), T3);
await ev(() => window.__card.setCfg({ ent: null })); await wait(250);

/* ================================================================ N */
const N1 = await ev(() => {
  const S = window.__card.shadowRoot, tg = [...S.querySelectorAll('.tg')];
  const on = tg.find((x) => x.classList.contains('on')), off = tg.find((x) => !x.classList.contains('on'));
  const st = (el) => { const cs = getComputedStyle(el), ti = getComputedStyle(el.querySelector('.ti')), th = el.querySelector('.th'), ths = th && getComputedStyle(th), tn = getComputedStyle(el.querySelector('.tn span')); return { h: el.getBoundingClientRect().height, rad: cs.borderTopLeftRadius, bg: cs.backgroundImage, bgc: cs.backgroundColor, col: cs.color, ti: ti.backgroundColor, tiW: el.querySelector('.ti').getBoundingClientRect().width, th: th && { w: th.getBoundingClientRect().width, h: th.getBoundingClientRect().height, bg: ths.backgroundColor }, state: tn.color, ta: cs.touchAction, ent: el.dataset.ent }; };
  const g = getComputedStyle(S.querySelector('.tg2'));
  return { n: tg.length, on: on && st(on), off: off && st(off), cols: g.gridTemplateColumns.split(' ').length, gap: g.columnGap, ents: tg.map((x) => x.dataset.ent) };
});
ok('N: fire brytere fra input_boolean (autokonfig), 2 kolonner, gap 10', N1.n === 4 && N1.cols === 2 && N1.gap === '10px' && N1.ents.every((x) => /^input_boolean\./.test(x)), N1);
ok('N: På = hele pillen rosa gradient, mørk tekst, ikon-sirkel 52 rgba(42,23,32,.08), «På» rgba(42,23,32,.6), håndtak 32×3 hvit 40 %', N1.on && /linear-gradient/.test(N1.on.bg) && N1.on.col === 'rgb(42, 23, 32)' && Math.round(N1.on.tiW) === 52 && /rgba\(42, 23, 32, 0\.08\)/.test(N1.on.ti) && /rgba\(42, 23, 32, 0\.6\)/.test(N1.on.state) && N1.on.th && Math.round(N1.on.th.w) === 32 && Math.round(N1.on.th.h) === 3 && /0\.4\)/.test(N1.on.th.bg), N1.on);
ok('N: Av = #3a3a3a, hvit tekst, ikon-sirkel #4a4a4a, «Av» #979797, håndtak hvit 12 %', N1.off && N1.off.bg === 'none' && N1.off.bgc === 'rgb(58, 58, 58)' && N1.off.col === 'rgb(250, 250, 250)' && N1.off.ti === 'rgb(74, 74, 74)' && N1.off.state === 'rgb(151, 151, 151)' && /0\.12\)/.test(N1.off.th.bg), N1.off);
ok('N: pille 72 px, radius 999, touch-action pan-y', Math.round(N1.on.h) === 72 && parseFloat(N1.on.rad) >= 36 && N1.on.ta === 'pan-y', N1.on);
// trykk = veksle
await ev(() => { window.__calls.length = 0; window.__mi.length = 0; window.__card.shadowRoot.querySelector('.tg').click(); });
await wait(100);
const N2 = await ev(() => ({ calls: window.__calls.filter((c) => c[0] !== 'ws').map((c) => c[0] + '.' + c[1] + ':' + c[2].entity_id), mi: window.__mi.slice() }));
ok('N: trykk veksler bryteren (homeassistant.toggle), ingen more-info', N2.calls.length === 1 && /toggle:input_boolean\./.test(N2.calls[0]) && !N2.mi.length, N2);
// hold 500 ms = more-info, klikket etter ignoreres
const holdTg = async (move) => {
  await ev((move) => { window.__calls.length = 0; window.__mi.length = 0; const el = window.__card.shadowRoot.querySelectorAll('.tg')[1], r = el.getBoundingClientRect(); window.__tgx = [r.left + 30, r.top + 30]; el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true, clientX: r.left + 30, clientY: r.top + 30, pointerId: 7, button: 0 })); if (move) el.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, composed: true, clientX: r.left + 45, clientY: r.top + 30, pointerId: 7 })); }, move);
  await wait(320);
  const mid = await ev(() => window.__mi.length);
  await wait(300);
  await ev(() => { const el = window.__card.shadowRoot.querySelectorAll('.tg')[1]; el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, composed: true, pointerId: 7 })); el.click(); });
  await wait(100);
  return { mid, ...(await ev(() => ({ calls: window.__calls.filter((c) => c[0] !== 'ws').length, mi: window.__mi.slice(), drag: !!window.__card._drag }))) };
};
const N3 = await holdTg(false);
ok('N: hold 500 ms → more-info for bryterens entitet (ikke før 500), klikket etter hold veksler ikke, ingen seksjons-dra', N3.mid === 0 && N3.mi.length === 1 && N3.mi[0] === N1.ents[1] && N3.calls === 0 && !N3.drag, N3);
const N4 = await holdTg(true);
ok('N: bevegelse > 8 px avbryter hold (ingen more-info)', N4.mi.length === 0, N4);
const ctx = await ev(() => { const e = new MouseEvent('contextmenu', { bubbles: true, composed: true, cancelable: true }); window.__card.shadowRoot.querySelector('.tg').dispatchEvent(e); return e.defaultPrevented; });
ok('N: ingen kontekstmeny på pillene', ctx);

/* ================================================================ O + M/N i Tilpass */
await ev(() => window.__card.shadowRoot.querySelector('[data-act="tilpass"]').click()); await wait(700);
const tpR = 'window.MSH.portals().find((x) => x.shadowRoot && x.shadowRoot.querySelector(".tp")).shadowRoot';
const tp = (fn) => p.evaluate(`(${fn})(${tpR})`);
const tpc = async (sel) => { await p.evaluate(`${tpR}.querySelector(${JSON.stringify(sel)}).click()`); await wait(200); };
await tpc('[data-a="tptab"][data-v="vis"]');
const O1 = await tp((r) => { const a = r.querySelector('[data-acc="ex"]'), b = a.querySelector('.accb'), cs = getComputedStyle(a); return { open: a.classList.contains('op'), inner: !!a.querySelector('.accx'), h: Math.round(b.getBoundingClientRect().height), rad: cs.borderTopLeftRadius, bg: cs.backgroundColor, title: b.querySelector('.ern b').textContent, sub: b.querySelector('.ern span').textContent, icon: b.querySelector('ha-icon').getAttribute('icon'), others: [...r.querySelectorAll('[data-acc]')].map((x) => x.dataset.acc), exs: !!r.querySelector('[data-a="exs"]') }; });
ok('O: «Pris og eksempler» lukket som standard: rad 64 px, #3a3a3a, radius 24, ikon calculator, «Spotpris · 5 eksempler»', !O1.open && !O1.inner && !O1.exs && O1.h === 64 && O1.rad === '24px' && O1.bg === 'rgb(58, 58, 58)' && O1.title === 'Pris og eksempler' && /^Spotpris · \d+ eksempler$/.test(O1.sub) && O1.icon === 'mdi:calculator', O1);
ok('O: samme akkordeon for andre lange seksjoner (Fanelinje, Forbruk-kort)', O1.others.join() === 'ex,ts,uc', O1.others);
const cfg0 = await ev(() => JSON.stringify(window.__card.config));
await tpc('[data-a="acc"][data-v="ex"]'); await wait(300);
const O2 = await tp((r) => { const a = r.querySelector('[data-acc="ex"]'); return { open: a.classList.contains('op'), exp: !!a.querySelector('[data-a="exp"]'), exs: a.querySelectorAll('[data-a="exs"]').length, chev: getComputedStyle(a.querySelector('.accc')).transform, pad: getComputedStyle(a.querySelector('.accx')).padding }; });
const cfg1 = await ev(() => JSON.stringify(window.__card.config));
ok('O: åpnes med samme innhold (Pris som brukes, kilde, eksempler med brytere), chevron 180°, padding 4 14 14, lagres ikke', O2.open && O2.exp && O2.exs === 13 && /matrix\(-1, .*0, -1/.test(O2.chev) && O2.pad === '4px 14px 14px' && cfg0 === cfg1, { O2, same: cfg0 === cfg1 });
// M: Toppkort → Spotpris-merke
const S1 = await tp((r) => { const b = r.querySelector('[data-a="spotchip"]'); return b && { txt: b.textContent, on: b.querySelector('.trk').classList.contains('on'), lab: [...r.querySelectorAll('.lab')].map((x) => x.textContent).includes('Toppkort') }; });
ok('M: Tilpass → Visning → Toppkort → «Spotpris-merke» (på som standard)', S1 && S1.lab && /Spotpris-merke/.test(S1.txt) && S1.on, S1);
await tpc('[data-a="spotchip"]'); await wait(200);
const S2 = await ev(() => ({ cfg: window.__card.config.spot_chip, chip: !!window.__card.shadowRoot.querySelector('.hchip:not(.ph)') }));
ok('M: bryteren lagrer spot_chip: false og popupen følger live', S2.cfg === false && !S2.chip, S2);
await tpc('[data-a="spotchip"]'); await wait(200);
ok('M: bryteren på igjen fjerner nøkkelen (standard på)', await ev(() => window.__card.config.spot_chip === undefined && !!window.__card.shadowRoot.querySelector('.hchip:not(.ph)')));
// N/T: Entiteter-fanen grupperer kildene (Toppkort / Inkludert i prisen), bytte bryter-entitet
await tpc('[data-a="tptab"][data-v="ent"]');
const E1 = await tp((r) => ({ labs: [...r.querySelectorAll('.lab')].map((x) => x.textContent), roles: [...r.querySelectorAll('[data-role]')].map((x) => x.dataset.role) }));
ok('T/N: Tilpass → Entiteter: Toppkort (effekt, spot, dag, norge, trinn, margin, bil) + Inkludert i prisen (4 brytere)', E1.labs.includes('Toppkort') && E1.labs.includes('Inkludert i prisen') && ['effekt', 'spot', 'dag', 'norge', 'trinn', 'margin', 'bil', 'tg_nettleie', 'tg_selskap', 'tg_stotte', 'tg_moms'].every((k) => E1.roles.includes(k)), E1);
await tpc('[data-a="ent"][data-v="tg_moms"]');
const E2 = await tp((r) => [...r.querySelectorAll('[data-a="pick"]')].map((x) => x.dataset.v));
ok('N: søket for bryterne viser input_boolean/switch', E2.length > 0 && E2.every((x) => /^(input_boolean|switch)\./.test(x)), E2);
const pickT = E2.find((x) => !/include_moms/.test(x));
await tpc(`[data-a="pick"][data-v="${pickT}"]`); await wait(250);
const E3 = await ev(() => ({ cfg: window.__card.config.ent, ents: [...window.__card.shadowRoot.querySelectorAll('.tg')].map((x) => x.dataset.ent) }));
ok('N: overstyrt bryter (ent.tg_moms) brukes i «Inkludert i prisen»', E3.cfg && E3.cfg.tg_moms === pickT && E3.ents.includes(pickT), E3);
// S.2-kilder: «Kilder (strømregning)» → config sensorer.<nøkkel> (M.stromRegning.FIELDS + moms_bryter)
await tpc('[data-a="acc"][data-v="sr"]');
const K1 = await tp((r) => ({ lab: [...r.querySelectorAll('.lab')].map((x) => x.textContent).includes('Kilder (strømregning)'), rows: [...r.querySelectorAll('[data-role^="S:"]')].map((x) => x.dataset.role), n: (window.MSH.stromRegning && window.MSH.stromRegning.FIELDS || []).length }));
ok('Kilder (strømregning): én rad per M.stromRegning.FIELDS + sensorer.moms_bryter', K1.lab && K1.n > 0 && K1.rows.length === K1.n + 1 && K1.rows.includes('S:moms_bryter') && K1.rows.includes('S:estimat'), K1);
await tpc('[data-a="ent"][data-v="S:moms_bryter"]');
const K2 = await tp((r) => [...r.querySelectorAll('[data-a="pick"]')].map((x) => x.dataset.v));
await tpc(`[data-a="pick"][data-v="${K2[0]}"]`); await wait(200);
const K3 = await ev(() => window.__card.config.sensorer);
ok('Kilder (strømregning): valg lagres som sensorer.moms_bryter (input_boolean/switch)', K2.every((x) => /^(input_boolean|switch)\./.test(x)) && K3 && K3.moms_bryter === K2[0], { K2, K3 });
await tpc('[data-a="auto"][data-v="S:moms_bryter"]');
ok('Kilder (strømregning): «Bruk automatisk» fjerner overstyringen', await ev(() => !window.__card.config.sensorer));
await tpc('[data-a="reset"]'); await tpc('[data-a="done"]'); await wait(300);

// GUI-editoren: samme nøkler (spot_chip, ent.trinn …) + akkordeon
const GE = await ev(async () => {
  const wait = (ms) => new Promise((q) => setTimeout(q, ms));
  const ed = customElements.get('msh-strom-card').getConfigElement();
  document.body.appendChild(ed); ed.hass = window.__h; ed.setConfig({ type: 'custom:msh-strom-card', card_id: 'gui-strom-47' });
  const out = []; ed.addEventListener('config-changed', (e) => out.push(e.detail.config));
  const R = ed.shadowRoot, click = async (s) => { R.querySelector(s).click(); await wait(80); };
  await click('[data-a="tptab"][data-v="vis"]');
  const acc = [...R.querySelectorAll('[data-acc]')].map((x) => x.dataset.acc + (x.classList.contains('op') ? '+' : ''));
  await click('[data-a="spotchip"]');
  await click('[data-a="tptab"][data-v="ent"]');
  await click('[data-a="ent"][data-v="trinn"]');
  const pk = R.querySelector('[data-a="pick"]'), v = pk && pk.dataset.v; if (pk) pk.click(); await wait(80);
  const last = out[out.length - 1] || {};
  ed.remove();
  return { acc, spot: last.spot_chip, trinn: last.ent && last.ent.trinn, v };
});
ok('GUI-editoren: akkordeonene (lukket), spot_chip og ent.trinn lagres med samme nøkler', GE.acc.join() === 'ex,ts,uc' && GE.spot === false && GE.trinn && GE.trinn === GE.v, GE);

/* ================================================================ P / Q / R (Kurser-fanen i kortet) */
// GUI-editoren ligger i document.body: klikk der regnes som «utenfor» av Bubble Card, som lukker popupen → åpne igjen
await ev(() => { if (location.hash !== '#strom') location.hash = '#strom'; }); await wait(1200);
const RC = await ev(() => { const was = true; { const all = []; const w = (x) => x.querySelectorAll('*').forEach((e) => { all.push(e); if (e.shadowRoot) w(e.shadowRoot); }); w(document); const pe = all.find((e) => e.classList && e.classList.contains('bubble-pop-up') && e.classList.contains('is-popup-opened')); window.__card = pe && [...pe.querySelectorAll('*')].find((e) => e.localName === 'msh-strom-card'); } return { was, now: !!(window.__card && window.__card.isConnected), hash: location.hash }; });
ok('#strom åpen igjen (kortet i DOM)', RC.now, RC);
await ev(() => {
  const h = window.__h, S = h.states;
  const add = (id, v, u) => { S[id] = { entity_id: id, state: String(v), attributes: { unit_of_measurement: u, friendly_name: id } }; };
  add('sensor.um_daily_cost_strommaler', 52.1, 'kr'); add('sensor.um_daily_cost_strommaler_norgespris', 40.5, 'kr');
  add('sensor.norgespris_pris_na', 0.8, 'kr/kWh'); add('sensor.totalpris_strompris_kroner', 1.49, 'kr/kWh');
  add('sensor.um_daily_cost_oppvarming_kurs', 31.9, 'kr'); add('sensor.um_daily_cost_oppvarming_kurs_norgespris', 30, 'kr');
  add('sensor.oppvarming_energy_daily', 25, 'kWh'); add('sensor.lys_energy_daily', 1.5, 'kWh');
  add('sensor.um_daily_cost_lights', 2.01, 'kr'); add('sensor.um_daily_cost_kjoleskap', 3.9, 'kr'); add('sensor.um_daily_cost_oppvaskmaskin_enhet', 2.64, 'kr');
  add('sensor.um_daily_cost_data', 0.3, 'kr'); // < 2 % → «Annet»
  window.__card.hass = { ...h, states: { ...S } };
});
await ev(() => window.__card.shadowRoot.querySelector('[data-tabbar] button[data-v="Kurser"]').click()); await wait(500);
const P1 = await ev(() => {
  const S = window.__card.shadowRoot, segs = [...S.querySelectorAll('.sk-kgrid > .ki-seg')];
  return { n: segs.length, gap: getComputedStyle(segs[0].parentElement).columnGap, segs: segs.map((t) => { const tr = t.getBoundingClientRect(), cs = getComputedStyle(t), bs = [...t.querySelectorAll('.ki-seg-b')];
    return { pad: cs.padding, gap: cs.columnGap, rad: cs.borderTopLeftRadius, bg: cs.backgroundColor, glass: t.hasAttribute('data-glass-drag'), btns: bs.map((b) => { const r = b.getBoundingClientRect(), bc = getComputedStyle(b), sp = b.querySelector('span').getBoundingClientRect();
      return { t: b.textContent, on: b.classList.contains('on'), w: r.width, h: r.height, jc: bc.justifyContent, ta: bc.textAlign, bg: bc.backgroundImage, col: bc.color, fs: bc.fontSize, fw: bc.fontWeight, ws: bc.whiteSpace, dl: r.left - tr.left, dr: tr.right - r.right, dt: r.top - tr.top, db: tr.bottom - r.bottom, txtC: Math.abs((sp.left + sp.width / 2) - (r.left + r.width / 2)) }; }) }; }) };
});
const segOk = P1.n === 2 && P1.segs.every((s) => s.pad === '4px' && s.gap === '2px' && parseFloat(s.rad) >= 27 && s.glass && s.btns.length === 2 && Math.abs(s.btns[0].w - s.btns[1].w) < 0.6);
ok('P: Kurser bruker M.segment: 2 spor (gap 10), grid 2 like kolonner, gap 2, padding 4, radius 999, glass-drag', segOk && P1.gap === '10px', P1);
ok('P: tekst sentrert i knappene (flex center, tekstmidten = knappemidten)', P1.segs.every((s) => s.btns.every((b) => b.jc === 'center' && b.txtC < 1 && b.ws === 'nowrap' && b.fs === '15px' && b.fw === '500' && Math.round(b.h) === 46)), P1.segs.map((s) => s.btns.map((b) => [b.t, b.jc, b.ta, b.txtC])));
ok('P: aktiv pille har 4 px luft til sporets kant (venstre/topp/bunn), rosa gradient + mørk tekst', P1.segs.every((s) => { const a = s.btns.find((b) => b.on); return a && Math.abs(a.dt - 4) < 0.6 && Math.abs(a.db - 4) < 0.6 && (Math.abs(a.dl - 4) < 0.6 || Math.abs(a.dr - 4) < 0.6) && /linear-gradient/.test(a.bg) && a.col !== 'rgb(214, 214, 214)'; }), P1.segs.map((s) => s.btns.map((b) => [b.t, b.on, b.dl, b.dt, b.db, b.dr])));
// bytt til kWh og Måneden → pillen flytter, fortsatt 4 px
await ev(() => window.__card.shadowRoot.querySelector('.ki-seg-b[data-sk-v="kwh"]').click()); await wait(200);
const P2 = await ev(() => { const S = window.__card.shadowRoot, t = S.querySelector('.ki-seg'), a = t.querySelector('.ki-seg-b.on'), tr = t.getBoundingClientRect(), r = a.getBoundingClientRect(); return { t: a.textContent, dr: tr.right - r.right, unit: S.querySelector('.sk-kunit').textContent }; });
ok('P: kWh valgt → aktiv pille 4 px fra høyre kant, enheten byttes', P2.t === 'kWh' && Math.abs(P2.dr - 4) < 0.6 && P2.unit === 'kWh', P2);
// R: kWh – pillen vises, tallene endres ikke
const R0 = await ev(() => { const S = window.__card.shadowRoot; return { chip: S.querySelector('.sk-kchip').textContent, sum: S.querySelector('.sk-ksum').textContent }; });
await ev(() => window.__card.shadowRoot.querySelector('.sk-kchip').click()); await wait(200);
const R1 = await ev(() => { const S = window.__card.shadowRoot; return { chip: S.querySelector('.sk-kchip').textContent, sum: S.querySelector('.sk-ksum').textContent }; });
ok('R: kWh – pillen bytter modell, men kWh-tallene endres ikke', R0.chip !== R1.chip && R0.sum === R1.sum, { R0, R1 });
await ev(() => window.__card.shadowRoot.querySelector('.sk-kchip').click()); await wait(150);
await ev(() => window.__card.shadowRoot.querySelector('.ki-seg-b[data-sk-v="kr"]').click()); await wait(200);
// R: stil + bytte i kroner
const R2 = await ev(() => { const S = window.__card.shadowRoot, c = S.querySelector('.sk-kchip'), cs = getComputedStyle(c); const tiles = [...S.querySelectorAll('.sk-ktile .sk-ktv')].map((x) => x.textContent); return { tag: c.localName, chip: c.textContent, sum: S.querySelector('.sk-ksum').textContent, tiles, fs: cs.fontSize, fw: cs.fontWeight, pad: cs.padding, rad: cs.borderTopLeftRadius, bg: cs.backgroundColor, bd: cs.borderTopWidth, cur: cs.cursor, pe: cs.pointerEvents, info: S.querySelector('[data-sk-info]').textContent }; });
ok('R: pillen er en knapp: 12px/600, padding 5px 11px, radius 11, rgba(0,0,0,.16), border 0, pointer', R2.tag === 'button' && R2.fs === '12px' && R2.fw === '600' && R2.pad === '5px 11px' && R2.rad === '11px' && /rgba\(0, 0, 0, 0\.16\)/.test(R2.bg) && R2.bd === '0px' && R2.cur === 'pointer' && R2.pe !== 'none', R2);
const pdStop = await ev(() => { let got = false; const S = window.__card.shadowRoot, f = () => { got = true; }; S.addEventListener('pointerdown', f); S.querySelector('.sk-kchip').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true, pointerId: 9 })); S.removeEventListener('pointerdown', f); return !got; });
ok('R: pointerdown på pillen stoppes (stopPropagation – Bubble-sveip/hold spiser ikke klikket)', pdStop);
await ev(() => { window.__hp.length = 0; window.__card.shadowRoot.querySelector('.sk-kchip').click(); }); await wait(200);
const R3 = await ev(() => { const S = window.__card.shadowRoot; return { chip: S.querySelector('.sk-kchip').textContent, sum: S.querySelector('.sk-ksum').textContent, tiles: [...S.querySelectorAll('.sk-ktile .sk-ktv')].map((x) => x.textContent), hp: window.__hp.slice(), ui: window.__card.ui.kursAlt, stored: (() => { try { return JSON.parse(localStorage.getItem('ki:' + window.__card.config.card_id + ':ui') || '{}').kursAlt; } catch (e) { return 'x'; } })() }; });
ok('R: trykk → «Spotpris · 1,49 kr/kWh», toppsum og fliser bytter til spot-kostnad', /^Norgespris · 0,80/.test(R2.chip) && /^Spotpris · 1,49/.test(R3.chip) && R2.sum === '40,50' && R3.sum === '52,10' && R2.tiles[0] !== R3.tiles[0], { R2: [R2.chip, R2.sum, R2.tiles], R3 });
ok('R: haptic selection (én per trykk) og remember_view husker valget (localStorage per kort)', R3.hp.length === 1 && R3.hp[0] === 'selection' && R3.ui === false && R3.stored === false, R3);
const pressR = await ev(() => [...window.__card.shadowRoot.querySelectorAll('style')].some((s) => s.textContent.includes('button.sk-kchip:active{transform:scale(.96)}')));
ok('R: trykk-animasjon scale(.96)', pressR);
await ev(() => window.__card.shadowRoot.querySelector('.sk-kchip').click()); await wait(150);

// Q
const Q0 = await ev(() => { const S = window.__card.shadowRoot, b = S.querySelector('.sk-kbarb'), st = S.querySelector('.sk-kbarb .sk-kstripe'); return { tag: b.localName, h: b.getBoundingClientRect().height, vis: st.getBoundingClientRect().height, segs: [...S.querySelectorAll('.sk-kbs')].map((x) => x.dataset.skV), leg: !!S.querySelector('.sk-kleg'), info: S.querySelector('[data-sk-info]').textContent }; });
ok('Q: baren er en knapp med ≥ 44 px trykkflate (visuelt 12 px), størst først, < 2 % slått sammen til «Annet»', Q0.tag === 'button' && Q0.h >= 44 && Math.round(Q0.vis) === 12 && Q0.segs[0] === 'Oppvarming' && Q0.segs.includes('Annet') && !Q0.segs.includes('Data og nettverk') && !Q0.leg && /^Størst: Oppvarming står for \d+ % av forbruket$/.test(Q0.info), Q0);
await ev(() => { window.__hp.length = 0; const b = window.__card.shadowRoot.querySelector('.sk-kbarb'), r = b.getBoundingClientRect(); const el = window.__card.shadowRoot.elementFromPoint ? null : null; b.click(); });
await wait(200);
const Q1 = await ev(() => { const S = window.__card.shadowRoot, L = S.querySelector('.sk-kleg'); if (!L) return null; const g = getComputedStyle(L), rows = [...L.querySelectorAll('.sk-klr')]; return { cols: g.gridTemplateColumns.split(' ').length, gap: g.rowGap + '/' + g.columnGap, rows: rows.map((r) => ({ t: r.querySelector('.sk-kln').textContent, p: r.querySelector('.sk-klp').textContent, h: r.getBoundingClientRect().height, rad: getComputedStyle(r).borderTopLeftRadius, bg: getComputedStyle(r).backgroundColor, dot: Math.round(r.querySelector('.sk-kld').getBoundingClientRect().width), pw: getComputedStyle(r.querySelector('.sk-klp')).fontWeight })), hp: window.__hp.slice() }; });
ok('Q: trykk på baren → 2-kolonners liste (gap 6/12), rader 32 px radius 16, prikk 10 px, «57 %» 600', Q1 && Q1.cols === 2 && Q1.gap === '6px/12px' && Q1.rows.length >= 3 && Q1.rows.every((r) => Math.round(r.h) === 32 && r.rad === '16px' && r.dot === 10 && /^\d+ %$/.test(r.p) && r.pw === '600' && /rgba\(60, 40, 50, 0\.08\)/.test(r.bg)) && Q1.hp.length === 1, Q1);
await ev(() => { window.__hp.length = 0; window.__card.shadowRoot.querySelector('.sk-kbs[data-sk-v="Oppvarming"]').click(); }); await wait(200);
const Q2 = await ev(() => { const S = window.__card.shadowRoot; return { info: S.querySelector('[data-sk-info]').textContent, segs: [...S.querySelectorAll('.sk-kbs')].map((x) => [x.dataset.skV, getComputedStyle(x).opacity]), rows: [...S.querySelectorAll('.sk-klr')].map((x) => [x.querySelector('.sk-kln').textContent, x.classList.contains('on'), getComputedStyle(x).opacity, getComputedStyle(x).backgroundColor]), hp: window.__hp.slice() }; });
await wait(250);
const Q2b = await ev(() => [...window.__card.shadowRoot.querySelectorAll('.sk-kbs')].map((x) => [x.dataset.skV, getComputedStyle(x).opacity]));
Q2.rows = await ev(() => [...window.__card.shadowRoot.querySelectorAll('.sk-klr')].map((x) => [x.querySelector('.sk-kln').textContent, x.classList.contains('on'), getComputedStyle(x).opacity, getComputedStyle(x).backgroundColor]));
ok('Q: segment valgt → teksten «Oppvarming står for … % av forbruket · 30,00 kr», de andre dempes (.35 / .6), raden markeres', /^Oppvarming står for \d+ % av forbruket · 30,00 kr$/.test(Q2.info) && Q2b.every(([l, o]) => (l === 'Oppvarming' ? o === '1' : o === '0.35')) && Q2.rows.every(([l, on, o, bg]) => (l === 'Oppvarming' ? on && /0\.18\)/.test(bg) : !on && o === '0.6')) && Q2.hp.length === 1 && Q2.hp[0] === 'selection', { Q2, Q2b });
await ev(() => [...window.__card.shadowRoot.querySelectorAll('.sk-klr')].find((x) => x.querySelector('.sk-kln').textContent === 'Annet').click()); await wait(200);
const Q3 = await ev(() => window.__card.shadowRoot.querySelector('[data-sk-info]').textContent);
ok('Q: rad i listen velger også («Annet»)', /^Annet står for \d+ % av forbruket · /.test(Q3), Q3);
await ev(() => [...window.__card.shadowRoot.querySelectorAll('.sk-klr')].find((x) => x.querySelector('.sk-kln').textContent === 'Annet').click()); await wait(200);
const Q4 = await ev(() => window.__card.shadowRoot.querySelector('[data-sk-info]').textContent);
ok('Q: samme igjen → valget fjernes («Størst: …»)', /^Størst: /.test(Q4), Q4);
await ev(() => window.__card.shadowRoot.querySelector('.sk-ksum').click()); await wait(50);
await ev(() => window.__card.shadowRoot.querySelector('.sk-kbarb').click()); await wait(200);
ok('Q: trykk på baren igjen lukker forklaringen', await ev(() => !window.__card.shadowRoot.querySelector('.sk-kleg')));
await ev(() => window.__card.shadowRoot.querySelector('.ki-seg-b[data-sk-v="kwh"]').click()); await wait(150);
await ev(() => window.__card.shadowRoot.querySelector('.sk-kbs').click()); await wait(150);
const Q5 = await ev(() => window.__card.shadowRoot.querySelector('[data-sk-info]').textContent);
ok('Q: i kWh følger teksten enheten', / kWh$/.test(Q5), Q5);
await ev(() => window.__card.shadowRoot.querySelector('.ki-seg-b[data-sk-v="kr"]').click()); await wait(150);

// P: andre segmentkontroller i strøm-popupen (I dag/I morgen i Priser) – sentrert
await ev(() => window.__card.shadowRoot.querySelector('[data-tabbar] button[data-v="Priser"]').click()); await wait(400);
const P3 = await ev(() => [...window.__card.shadowRoot.querySelectorAll('.seg button')].map((b) => { const r = b.getBoundingClientRect(), cs = getComputedStyle(b); return { jc: cs.justifyContent, ta: cs.textAlign, h: r.height }; }));
ok('P: «I dag | I morgen» i Priser er også sentrert', P3.length === 2 && P3.every((b) => b.jc === 'center' && b.ta === 'center'), P3);

ok('ingen JS-feil', errs.length === 0, errs.slice(0, 5));
await b.close();
try { rmSync(bundle); } catch (e) { /* */ }
console.log(fail.length ? `\n${fail.length} feil` : '\nAlle bestod');
process.exit(fail.length ? 1 : 0);
