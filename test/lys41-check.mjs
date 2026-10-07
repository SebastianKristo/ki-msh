// Fiks 41 · lys-radene fra Rom v4 (hasLights / lights l.*) – ÉN felles renderer (MSH.renderLightRow, 08-light-row.js) i
// Rom → Lys (msh-rom-card) og Lys-popupen (msh-lys-card, også gruppe-radene), mot EKTE Bubble Card, 390 px, touch (CDP),
// mørk + lys modus. Ingen rester av prompt 39 (msh-light-slider) i bundelen.
//   · rad: lightbulb 20 + navn 14/500 + prosent 12 px (#979797 / --ki-text-mid, tabular-nums), 8 px over kontrollen,
//     10 px mellom radene; header «Lys» 66 px med floor_lamp og «2 på · 1 av»
//   · dimbar: slider 40 px (fyll 34 r14/5/5/14 · håndtak 4 × 40 r2 · spor 34 r5/14/14/5, gap 6, flex-grow-overgang .3s);
//     fyll #ffc896 (dim / ≤ 4500 K) · hsl(hue 85% 72%) (farge)
//   · farge/temp: chevron 36 × 40 → panel (xLabel 11 px, xVal 12 px, xBar 28 px r14, xKnob 34 px r17); dra = hs_color /
//     color_temp_kelvin; av/på: swBar 48 r24, swFill 52 % 40 px r20, power-ikon, swDot 8 px, «På»/«Av»
//   · dra = brightness_pct throttlet 150 ms + ved slipp, 0 = light.turn_off, haptic selection ved start, popupen står,
//     hass-oppdatering under dra river ikke slideren; trykk = av/på; ekstern endring oppdaterer raden (morph, .3s)
//   · Rom og Lys: identisk markup og mål for dimbar, fargelys (utvidet panel) og av/på
// Kjør: node test/lys41-check.mjs   (SHOTS=dir → skjermbilder)
import { createRequire } from 'node:module';
import { readdirSync, readFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const R = resolve('.') + '/';
mkdirSync('test/.build', { recursive: true });
mkdirSync('test/.vendor', { recursive: true });
const BC = resolve('test/.vendor/bubble-card.js');
if (!existsSync(BC)) execFileSync('curl', ['-sSL', '-o', BC, 'https://raw.githubusercontent.com/Clooos/Bubble-Card/main/dist/bubble-card.js']);
const bundle = resolve(`test/.build/l41-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const mocks = readdirSync(R + 'test/mock').filter((f) => f.endsWith('.js')).sort().map((f) => R + 'test/mock/' + f);
const SHOTS = process.env.SHOTS || '';
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const res = [];
let fails = 0;
const ok = (name, cond, info) => { if (!cond) fails++; res.push(`${cond ? '✔' : '✘'} ${name}${info != null && !cond ? ' · ' + JSON.stringify(info).slice(0, 900) : ''}`); };
const near = (a, b, d = 1.5) => Math.abs(a - b) <= d;

// Ingen rester av prompt 39 i bundelen (og i dist når den er bygget på nytt)
const src = readFileSync(bundle, 'utf8');
ok('bundelen har ingen rester av msh-light-slider / light-slider / mysmart-light-control', !/light-slider|LightSlider|mysmart-light-control|lightRowHeight|lightRowCfg|mountLightRows|sliderColor/.test(src), (src.match(/.{40}(light-slider|LightSlider|mysmart-light-control|lightRowHeight|lightRowCfg|mountLightRows|sliderColor).{40}/) || [])[0]);
ok('src/vendor finnes ikke lenger (mysmart-light-control er ute av bygget)', !existsSync('src/vendor'));

const browser = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const POPS = [
  { hash: '#stue', name: 'Stue', cards: [{ type: 'custom:msh-rom-card', card_id: 'l41a' }] },
  { hash: '#soverom', name: 'Soverom', cards: [{ type: 'custom:msh-rom-card', card_id: 'l41b' }] },
  { hash: '#lys', name: 'Lys', cards: [{ type: 'custom:msh-lys-card', card_id: 'l41l', groups: { gang: { members: ['light.gang_tak', 'light.gang_speil'] } } }] },
];

async function boot(dark) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('file://' + R + 'test/harness-bubble.html');
  for (const m of mocks) await page.addScriptTag({ path: m });
  await page.addScriptTag({ path: bundle });
  await page.addScriptTag({ path: BC, type: 'module' });
  await page.waitForFunction(() => customElements.get('bubble-card'), null, { timeout: 15000 });
  await page.evaluate(async ({ dark, popups }) => {
    try { localStorage.clear(); } catch (e) { /* */ }
    const wait = (window.wait = (ms) => new Promise((q) => setTimeout(q, ms)));
    window.deepAll = (sel, root) => { const out = []; const walk = (r) => r.querySelectorAll('*').forEach((e) => { if (e.matches(sel)) out.push(e); if (e.shadowRoot) walk(e.shadowRoot); }); walk(root || document); return out; };
    const H = (window.H = window.mockHass()); H.themes = { ...(H.themes || {}), darkMode: dark };
    const set = (id, state, attrs) => { H.states[id] = { entity_id: id, state, attributes: { ...attrs }, last_changed: new Date().toISOString(), last_updated: new Date().toISOString() }; };
    // Testlys: 100 % dimbar, fargetemp av, fargelys (rgb, 50 %), av/på-lys (på), gruppe gang (dimbar + av/på)
    set('light.stue_tak', 'on', { friendly_name: 'Stue tak', brightness: 255, supported_color_modes: ['brightness'], color_mode: 'brightness' });
    set('light.stue_lampe', 'off', { friendly_name: 'Stue lampe', supported_color_modes: ['color_temp'], min_color_temp_kelvin: 2200, max_color_temp_kelvin: 6500 });
    set('light.stue_led', 'on', { friendly_name: 'Stue LED', brightness: 128, supported_color_modes: ['rgb', 'color_temp'], color_mode: 'rgb', rgb_color: [255, 160, 90], hs_color: [24, 65] });
    set('light.soverom_nattbord', 'on', { friendly_name: 'Soverom nattbord', supported_color_modes: ['onoff'], color_mode: 'onoff' });
    window.HAP = []; window.addEventListener('haptic', (e) => window.HAP.push([e.detail, performance.now()]));
    window.CALLS = []; const cs = H.callService;
    H.callService = (d, s, data) => { window.CALLS.push([d, s, JSON.parse(JSON.stringify(data || {})), performance.now()]); return cs ? cs.call(H, d, s, data) : Promise.resolve(); };
    if (window.MSH.theme && window.MSH.theme.update) window.MSH.theme.update(H);
    if (window.MSH.store && window.MSH.store.load) await window.MSH.store.load(H);
    window.BCS = popups.map((p) => { const bc = document.createElement('bubble-card'); bc.setConfig({ type: 'custom:bubble-card', card_type: 'pop-up', hash: p.hash, name: p.name, icon: 'mdi:lightbulb', margin_top_mobile: '50px', bg_color: dark ? '#282828' : '#f0f0f0', bg_opacity: 100, bg_blur: 0, cards: p.cards }); bc.hass = H; document.getElementById('dash').appendChild(bc); return bc; });
    window.setHass = (fn) => { const S = { ...window.H.states }; fn(S); window.H = { ...window.H, states: S }; window.BCS.forEach((b) => { b.hass = window.H; }); deepAll('msh-rom-card,msh-lys-card').forEach((c) => { c.hass = window.H; }); };
    window.popOpen = (h) => location.hash === h && deepAll('.bubble-pop-up').some((p) => p.classList.contains('is-popup-opened'));
    window.rect = (el) => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2, r: r.right, b: r.bottom }; };
    window.card = (tag) => deepAll(tag).find((e) => e.getClientRects().length);
    window.row = (tag, key) => { const c = card(tag); return c && [...c.shadowRoot.querySelectorAll('.lr[data-lr]')].find((e) => e.dataset.lr === key); };
    // Mål og stil for én rad, relativt til raden (så Rom og Lys kan sammenlignes direkte)
    window.sig = (el) => {
      if (!el) return null;
      const R0 = el.getBoundingClientRect(), cs = (e) => getComputedStyle(e);
      const rel = (e) => { const r = e.getBoundingClientRect(); return [Math.round(r.left - R0.left), Math.round(r.top - R0.top), Math.round(r.width), Math.round(r.height)]; };
      const out = { w: Math.round(R0.width), parts: {} };
      el.querySelectorAll('[class^="lr-"],ha-icon').forEach((e, i) => {
        const c = cs(e), k = (e.className || e.localName) + '#' + i;
        out.parts[k] = { g: c.display === 'none' ? null : rel(e), d: c.display, bg: c.backgroundColor, bgi: c.backgroundImage === 'none' ? '' : c.backgroundImage.slice(0, 60), col: c.color, fs: c.fontSize, fw: c.fontWeight, br: c.borderRadius, fv: c.fontVariantNumeric, ta: c.touchAction, tf: c.transform, fg: c.flexGrow, tr: c.transitionDuration };
      });
      return out;
    };
    window.html = (el) => el && el.innerHTML.replace(/<span class="lr-n">[^<]*<\/span>/, '<span class="lr-n">·</span>').replace(/ aria-label="[^"]*"/g, '');
    await wait(400);
  }, { dark, popups: POPS });
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
  const tap = async (p) => { await touch('touchStart', [{ x: p.cx, y: p.cy }]); await page.waitForTimeout(40); await touch('touchEnd', []); await page.waitForTimeout(300); };
  const open = async (h) => { await page.evaluate(async (h) => { location.hash = h; await wait(1300); }, h); };
  return { page, errs, touch, tap, open, wait: (ms) => page.waitForTimeout(ms) };
}
const openRomLys = async (page) => page.evaluate(async () => { const c = card('msh-rom-card'); c.setUI({ acc: { ...(c.ui.acc || {}), lys: true } }); await wait(500); });
const lysTab = async (page, key) => page.evaluate(async (key) => { const c = card('msh-lys-card'); for (const t of [...c.shadowRoot.querySelectorAll('.mtb-t')].map((b) => b.dataset.v).filter(Boolean)) { c.setUI({ tab: t }); await wait(400); if (row('msh-lys-card', key)) return t; } return null; }, key);
const center = async (page, tag, key, sel) => page.evaluate(async ({ tag, key, sel }) => { const r = row(tag, key); const e = sel ? r.querySelector(sel) : r; e.scrollIntoView({ block: 'center' }); await wait(250); return rect(e); }, { tag, key, sel });

for (const dark of [true, false]) {
  const MO = dark ? 'mørk' : 'lys';
  const { page, errs, touch, tap, open, wait } = await boot(dark);
  /* ================================================================ Rom → Lys */
  await open('#stue'); await openRomLys(page);
  const st = await page.evaluate(() => {
    const c = card('msh-rom-card'), R = c.shadowRoot, rows = [...R.querySelectorAll('.lts > .lr')];
    const hd = R.querySelector('[data-key="sec-lys"] .acc'), cs = (e) => getComputedStyle(e);
    return { n: rows.length, keys: rows.map((r) => r.dataset.lr), gaps: rows.slice(1).map((r, i) => Math.round(r.getBoundingClientRect().top - rows[i].getBoundingClientRect().bottom)),
      old: deepAll('msh-light-slider').length + R.querySelectorAll('[data-lc],.lsl').length, hdH: Math.round(rect(hd).h), hdIcon: hd.querySelector('ha-icon').getAttribute('icon'), sum: hd.querySelector('.accs').textContent,
      box: cs(R.querySelector('[data-key="sec-lys"]')).borderTopLeftRadius, tak: sig(row('msh-rom-card', 'light.stue_tak')), led: sig(row('msh-rom-card', 'light.stue_led')), lampe: sig(row('msh-rom-card', 'light.stue_lampe')), txt: rows.map((r) => r.querySelector('.lr-p').textContent) };
  });
  ok(`[Rom ${MO}] Lys-seksjonen: 3 felles .lr-rader (ingen msh-light-slider/plassholdere), 10 px mellom radene`, st.n === 3 && st.old === 0 && st.gaps.every((g) => near(g, 10, 1)), st);
  ok(`[Rom ${MO}] header 66 px, floor_lamp, «${st.sum}» (KI Rom-teksten), seksjon radius 32`, st.hdH === 66 && st.hdIcon === 'mdi:floor-lamp' && /^2 på/.test(st.sum) && st.box === '32px', { h: st.hdH, i: st.hdIcon, s: st.sum, b: st.box });
  const P = (s, cls) => Object.entries(s.parts).filter(([k]) => k.split('#')[0] === cls).map(([, v]) => v);
  const T = st.tak, ic = P(T, 'ha-icon')[0], nm = P(T, 'lr-n')[0], pc = P(T, 'lr-p')[0], sl = P(T, 'lr-sl')[0], fl = P(T, 'lr-f')[0], kn = P(T, 'lr-k')[0], tk = P(T, 'lr-t')[0];
  ok(`[Rom ${MO}] rad: lightbulb 20 px, navn 14/500, prosent 12 px tabular-nums ${dark ? '#979797' : '--ki-text-2 (Fiks 56 M)'}, «100%»`, ic.g[2] === 20 && ic.g[3] === 20 && nm.fs === '14px' && nm.fw === '500' && pc.fs === '12px' && /tabular-nums/.test(pc.fv) && pc.col === (dark ? 'rgb(151, 151, 151)' : 'rgb(86, 86, 86)') && st.txt[0] === '100%', { ic, nm, pc, t: st.txt });
  ok(`[Rom ${MO}] navn ${dark ? '#fafafa' : '--ki-text'}`, nm.col === (dark ? 'rgb(250, 250, 250)' : 'rgb(28, 28, 28)'), nm.col);
  const hdB = Math.max(ic.g[1] + ic.g[3], nm.g[1] + nm.g[3]);
  ok(`[Rom ${MO}] dimbar: slider 40 px 8 px under topplinjen, touch-action pan-y`, sl.g[3] === 40 && near(sl.g[1] - hdB, 8, 1) && sl.ta === 'pan-y', { sl, hdB });
  // Fiks 56 M: lys modus = varm gradient (#f6c48a → #f2a65a) og strek-tommel 3 px (--ki-text); mørk = Rom v4 uendret
  const KW = dark ? 4 : 3;
  ok(`[Rom ${MO}] 100 %: fyll 34 px r14/5/5/14 ${dark ? '#ffc896' : 'varm gradient'}, håndtak ${KW} × 40 r2 helt til høyre, spor skjult`, fl.g[3] === 34 && fl.br === '14px 5px 5px 14px' && (dark ? fl.bg === 'rgb(255, 200, 150)' : /^linear-gradient\(90deg, rgb\(246, 196, 138\), rgb\(242, 166, 90/.test(fl.bgi)) && kn.g[2] === KW && kn.g[3] === 40 && kn.br === '2px' && near(kn.g[0] + KW, sl.g[0] + sl.g[2], 1) && tk.d === 'none' && fl.tr.includes('0.3s'), { fl, kn, tk, sl });
  const Z = st.lampe, zf = P(Z, 'lr-f')[0], zk = P(Z, 'lr-k')[0], zt = P(Z, 'lr-t')[0], zs = P(Z, 'lr-sl')[0], zc = P(Z, 'lr-cv')[0];
  ok(`[Rom ${MO}] 0 % (fargetemp av): «0%», ingen fyll, håndtaket helt til venstre, spor 34 px r5/14/14/5 ${dark ? '#6b5b50' : '--ki-track #ececec'}`, Z && zf.d === 'none' && near(zk.g[0], zs.g[0], 1) && zt.g[3] === 34 && zt.br === '5px 14px 14px 5px' && zt.bg === (dark ? 'rgb(107, 91, 80)' : 'rgb(236, 236, 236)') && st.txt[1] === '0%', { zf, zk, zt, zs, t: st.txt[1] });
  ok(`[Rom ${MO}] chevron 36 × 40 (expand_more) bare på farge-/temp-lys, ikke på kun dimbar`, zc && zc.g[2] === 36 && zc.g[3] === 40 && P(st.led, 'lr-cv').length === 1 && !P(T, 'lr-cv').length, { zc });
  const L0 = st.led, lf = P(L0, 'lr-f')[0];
  ok(`[Rom ${MO}] fargelys: fyll ${dark ? 'hsl(24 85% 72%)' : 'gradient hsl(24 85% 68%) → 58 %'}, «50%»`, (dark ? lf.bg === 'rgb(244, 171, 123)' : /^linear-gradient\(90deg, rgb\(24\d, 1[5-7]\d, 1[0-1]\d\), rgb\(2[34]\d, 1[23]\d, [5-7]\d/.test(lf.bgi)) && st.txt[2] === '50%', { bg: lf.bg, bgi: lf.bgi, t: st.txt[2] });

  // chevron → panel (Farge: xLabel 11 px, xVal «24°», xBar 28 px r14, xKnob 34 px r17)
  const cvp = await page.evaluate(async () => {
    const r = row('msh-rom-card', 'light.stue_led'); r.querySelector('.lr-cv').click(); await wait(300);
    const r2 = row('msh-rom-card', 'light.stue_led'), x = r2.querySelector('.lr-x');
    const o = { x: !!x, hap: window.HAP.slice(-1)[0], exp: r2.querySelector('.lr-cv').getAttribute('aria-expanded'), rot: r2.querySelector('.lr-cv ha-icon').style.transform };
    if (x) { const cs = (e) => getComputedStyle(e); o.l = [x.querySelector('.lr-xl').textContent, cs(x.querySelector('.lr-xl')).fontSize]; o.v = [x.querySelector('.lr-xv').textContent, cs(x.querySelector('.lr-xv')).fontSize]; o.bar = [rect(x.querySelector('.lr-xb')).h, cs(x.querySelector('.lr-xb')).borderTopLeftRadius]; o.knob = [rect(x.querySelector('.lr-xk')).w, rect(x.querySelector('.lr-xk')).h, cs(x.querySelector('.lr-xk')).borderTopLeftRadius]; o.pad = cs(x).paddingLeft; }
    return o;
  });
  ok(`[Rom ${MO}] chevron åpner panelet: «Farge» 11 px, «24°» 12 px, xBar 28 r14, xKnob 34 r17, pil rotert`, cvp.x && cvp.exp === 'true' && /180deg/.test(cvp.rot) && cvp.l[0] === 'Farge' && cvp.l[1] === '11px' && cvp.v[0] === '24°' && cvp.v[1] === '12px' && near(cvp.bar[0], 28) && cvp.bar[1] === '14px' && near(cvp.knob[0], 34) && cvp.knob[2] === '17px' && cvp.pad === '11px' && cvp.hap && cvp.hap[0] === 'selection', cvp);
  if (SHOTS) { await center(page, 'msh-rom-card', 'light.stue_tak'); await page.screenshot({ path: `${SHOTS}/l41-rom-${MO}.png` }); }
  // dra på fargebaren → light.turn_on hs_color
  const xb = await center(page, 'msh-rom-card', 'light.stue_led', '.lr-xb');
  await page.evaluate(() => { window.CALLS = []; });
  await touch('touchStart', [{ x: xb.x + xb.w * 0.1, y: xb.cy }]);
  for (let i = 1; i <= 6; i++) { await touch('touchMove', [{ x: xb.x + xb.w * (0.1 + i * 0.12), y: xb.cy }]); await wait(30); }
  await touch('touchEnd', []); await wait(300);
  const hc = await page.evaluate(() => ({ calls: window.CALLS.filter((c) => c[0] === 'light'), pop: popOpen('#stue'), v: row('msh-rom-card', 'light.stue_led').querySelector('.lr-xv').textContent }));
  const lastH = hc.calls[hc.calls.length - 1];
  ok(`[Rom ${MO}] fargebar (touch) → light.turn_on hs_color, «${hc.v}», popupen står`, hc.calls.length >= 1 && hc.calls.every((c) => Array.isArray(c[2].hs_color) && c[2].entity_id === 'light.stue_led') && lastH && lastH[2].hs_color[0] > 250 && hc.v === `${lastH[2].hs_color[0]}°` && hc.pop, hc);
  // temperatur-lys: panel «Temperatur» + dra → color_temp_kelvin
  await page.evaluate(async () => { row('msh-rom-card', 'light.stue_lampe').querySelector('.lr-cv').click(); await wait(300); });
  const ctb = await center(page, 'msh-rom-card', 'light.stue_lampe', '.lr-xb');
  const ctl = await page.evaluate(() => { window.CALLS = []; return row('msh-rom-card', 'light.stue_lampe').querySelector('.lr-xl').textContent; });
  await touch('touchStart', [{ x: ctb.x + ctb.w * 0.1, y: ctb.cy }]);
  for (let i = 1; i <= 6; i++) { await touch('touchMove', [{ x: ctb.x + ctb.w * (0.1 + i * 0.13), y: ctb.cy }]); await wait(30); }
  await touch('touchEnd', []); await wait(300);
  const ctc = await page.evaluate(() => window.CALLS.filter((c) => c[0] === 'light'));
  ok(`[Rom ${MO}] temperatur-panel «${ctl}» (touch) → light.turn_on color_temp_kelvin (2200–6500)`, ctl === 'Temperatur' && ctc.length >= 1 && ctc.every((c) => c[2].color_temp_kelvin >= 2200 && c[2].color_temp_kelvin <= 6500) && ctc[ctc.length - 1][2].color_temp_kelvin > 5500, ctc.map((c) => c[2]));
  await page.evaluate(async () => { row('msh-rom-card', 'light.stue_lampe').querySelector('.lr-cv').click(); await wait(300); });

  // touch-dra på dimbar rad: throttlet 150 ms + ved slipp, live lokalt, popupen står, hass-oppdatering under dra river ikke
  const b0 = await center(page, 'msh-rom-card', 'light.stue_tak', '.lr-sl');
  await page.evaluate(() => { window.CALLS = []; window.HAP = []; });
  await touch('touchStart', [{ x: b0.x + b0.w * 0.5, y: b0.cy }]);
  const live = [];
  for (let i = 1; i <= 14; i++) {
    await touch('touchMove', [{ x: b0.x + b0.w * (0.5 - i * 0.05), y: b0.cy + (i % 3) }]); await wait(25);
    if (i === 5) {
      live.push(await page.evaluate(() => row('msh-rom-card', 'light.stue_tak').querySelector('.lr-p').textContent));
      // ekstern oppdatering midt i draget: raden skal vise dra-verdien, ikke HA-verdien
      live.push(await page.evaluate(async () => { const el = row('msh-rom-card', 'light.stue_tak').querySelector('.lr-sl'); setHass((S) => { S['light.stue_tak'] = { ...S['light.stue_tak'], attributes: { ...S['light.stue_tak'].attributes, brightness: 255 } }; }); await wait(80); const r = row('msh-rom-card', 'light.stue_tak'); return { v: r.querySelector('.lr-p').textContent, same: r.querySelector('.lr-sl') === el, drag: r.classList.contains('lr-drag'), tr: getComputedStyle(r.querySelector('.lr-t')).transitionDuration }; }));
    }
  }
  const mid = await page.evaluate(() => ({ pop: popOpen('#stue') }));
  for (let i = 1; i <= 6; i++) { await touch('touchMove', [{ x: b0.x + b0.w * (0.3 + i * 0.03), y: b0.cy }]); await wait(25); }
  await touch('touchEnd', []); await wait(400);
  const dr = await page.evaluate(() => ({ calls: window.CALLS.filter((c) => c[0] === 'light'), hap: window.HAP.map((h) => h[0]), pop: popOpen('#stue'), v: row('msh-rom-card', 'light.stue_tak').querySelector('.lr-p').textContent, drag: row('msh-rom-card', 'light.stue_tak').classList.contains('lr-drag') }));
  const on = dr.calls.filter((c) => c[1] === 'turn_on'), ts = dr.calls.map((c) => c[3]), gaps = ts.slice(1, -1).map((t, i) => t - ts[i]), last = dr.calls[dr.calls.length - 1];
  ok(`[Rom ${MO}] touch-dra: prosent live lokalt (${live[0]}), popupen står`, /^\d+%$/.test(live[0] || '') && live[0] !== '100%' && dr.pop && mid.pop, { live, pop: dr.pop });
  ok(`[Rom ${MO}] hass-oppdatering under dra: raden viser dra-verdien, samme slider-node, ingen overgang under dra`, live[1] && live[1].v === live[0] && live[1].same && live[1].drag && live[1].tr === '0s', live[1]);
  ok(`[Rom ${MO}] dra helt til venstre = light.turn_off, ellers brightness_pct 1–100`, dr.calls.some((c) => c[1] === 'turn_off') && on.every((c) => c[2].brightness_pct >= 1 && c[2].brightness_pct <= 100 && c[2].entity_id === 'light.stue_tak'), dr.calls.map((c) => [c[1], c[2].brightness_pct]));
  ok(`[Rom ${MO}] throttling: ${dr.calls.length} kall på ~500 ms, ≥ ~150 ms mellom kallene underveis, siste ved slipp = sluttverdien`, dr.calls.length >= 2 && dr.calls.length <= 8 && gaps.every((g) => g >= 140) && last && last[1] === 'turn_on' && `${last[2].brightness_pct}%` === dr.v && !dr.drag, { n: dr.calls.length, gaps, last, v: dr.v });
  ok(`[Rom ${MO}] haptic selection ved dra-start`, dr.hap[0] === 'selection', dr.hap);
  // trykk uten dra = av/på
  await page.evaluate(() => { window.CALLS = []; });
  await tap(await center(page, 'msh-rom-card', 'light.stue_lampe', '.lr-sl'));
  const t1 = await page.evaluate(() => window.CALLS.filter((c) => c[0] === 'light').map((c) => [c[1], c[2]]));
  ok(`[Rom ${MO}] trykk på av-lys = light.turn_on (forrige nivå, uten brightness_pct)`, t1.length === 1 && t1[0][0] === 'turn_on' && t1[0][1].entity_id === 'light.stue_lampe' && t1[0][1].brightness_pct == null, t1);
  // ekstern endring: raden oppdateres (morph, flex-grow-overgang)
  await page.evaluate(async () => { await wait(3200); setHass((S) => { S['light.stue_led'] = { ...S['light.stue_led'], attributes: { ...S['light.stue_led'].attributes, brightness: 26 } }; }); await wait(400); });
  const ex = await page.evaluate(() => { const r = row('msh-rom-card', 'light.stue_led'); return { v: r.querySelector('.lr-p').textContent, fg: getComputedStyle(r.querySelector('.lr-f')).flexGrow }; });
  ok(`[Rom ${MO}] ekstern endring (50 % → 10 %): «10%», fyll flex-grow 10`, ex.v === '10%' && ex.fg === '10', ex);
  // Rom-signaturer til sammenligning med Lys (fargelyset med åpent panel)
  await page.evaluate(async () => { setHass((S) => { S['light.stue_led'] = { ...S['light.stue_led'], attributes: { ...S['light.stue_led'].attributes, brightness: 128, hs_color: [24, 65] } }; }); await wait(3300); setHass((S) => { S['light.stue_tak'] = { ...S['light.stue_tak'], state: 'on', attributes: { ...S['light.stue_tak'].attributes, brightness: 255 } }; }); await wait(400); });
  const romSig = await page.evaluate(() => ({ tak: [sig(row('msh-rom-card', 'light.stue_tak')), html(row('msh-rom-card', 'light.stue_tak'))], led: [sig(row('msh-rom-card', 'light.stue_led')), html(row('msh-rom-card', 'light.stue_led'))] }));
  ok(`[Rom ${MO}] ingen sidefeil`, !errs.length, errs);

  /* ---------------- av/på (Soverom) */
  await open('#soverom'); await openRomLys(page);
  const sum2 = await page.evaluate(() => card('msh-rom-card').shadowRoot.querySelector('[data-key="sec-lys"] .accs').textContent);
  ok(`[Rom ${MO}] uten KI Rom-tekst: lightSum «${sum2}» (n på · n av)`, /^1 på · \d+ av$/.test(sum2), sum2);
  const oo = await page.evaluate(() => { const r = row('msh-rom-card', 'light.soverom_nattbord'); const cs = (e) => getComputedStyle(e); const sw = r.querySelector('.lr-sw'), f = r.querySelector('.lr-swf'), d = r.querySelector('.lr-swd'); return { s: sig(r), html: html(r), p: r.querySelector('.lr-p').textContent, sw: [rect(sw).h, cs(sw).borderTopLeftRadius, rect(sw).w], f: [rect(f).w, rect(f).h, cs(f).borderTopLeftRadius, cs(f).transform, cs(f).backgroundImage.slice(0, 30)], ic: f.querySelector('ha-icon').getAttribute('icon'), d: [rect(d).w, rect(d).x - rect(sw).x, cs(d).opacity] }; });
  ok(`[Rom ${MO}] av/på: swBar 48 r24 full bredde, swFill 52 % × 40 r20 med power-ikon, på = forskjøvet til høyre (gradient), swDot 8 px til venstre, «På»`, near(oo.sw[0], 48) && oo.sw[1] === '24px' && near(oo.f[0], (oo.sw[2] - 8) * 0.52, 1.5) && near(oo.f[1], 40) && oo.f[2] === '20px' && /matrix/.test(oo.f[3]) && /gradient/.test(oo.f[4]) && oo.ic === 'mdi:power' && near(oo.d[0], 8) && near(oo.d[1], 18) && oo.p === 'På', oo);
  await page.evaluate(() => { window.CALLS = []; window.HAP = []; });
  await tap(await center(page, 'msh-rom-card', 'light.soverom_nattbord', '.lr-sw'));
  const of = await page.evaluate(async () => { const o = { calls: window.CALLS.filter((c) => c[0] === 'light').map((c) => [c[1], c[2].entity_id]), hap: window.HAP.map((h) => h[0]) }; await wait(450); const r = row('msh-rom-card', 'light.soverom_nattbord'); o.p = r.querySelector('.lr-p').textContent; o.on = r.querySelector('.lr-sw').classList.contains('on'); o.tf = getComputedStyle(r.querySelector('.lr-swf')).transform; o.pop = popOpen('#soverom'); return o; });
  ok(`[Rom ${MO}] trykk på bryteren: light.turn_off, «Av», swFill tilbake til venstre, haptic light, popupen står`, JSON.stringify(of.calls) === '[["turn_off","light.soverom_nattbord"]]' && of.p === 'Av' && !of.on && (of.tf === 'none' || /matrix\(1, 0, 0, 1, 0, 0\)/.test(of.tf)) && of.hap.includes('light') && of.pop, of);
  // tilbake til «på» for sammenligning
  await page.evaluate(async () => { await wait(3100); setHass((S) => { S['light.soverom_nattbord'] = { ...S['light.soverom_nattbord'], state: 'on' }; }); await wait(500); });
  const romOO = await page.evaluate(() => [sig(row('msh-rom-card', 'light.soverom_nattbord')), html(row('msh-rom-card', 'light.soverom_nattbord'))]);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/l41-rom-soverom-${MO}.png` });

  /* ================================================================ Lys-popupen: samme rader */
  await open('#lys');
  await lysTab(page, 'light.stue_tak');
  await page.evaluate(async () => { const r = row('msh-lys-card', 'light.stue_led'); if (r && !r.querySelector('.lr-x')) r.querySelector('.lr-cv').click(); await wait(400); });
  const lys = await page.evaluate(() => ({ old: deepAll('msh-light-slider').length + card('msh-lys-card').shadowRoot.querySelectorAll('[data-lc],.lsl').length, tak: [sig(row('msh-lys-card', 'light.stue_tak')), html(row('msh-lys-card', 'light.stue_tak'))], led: [sig(row('msh-lys-card', 'light.stue_led')), html(row('msh-lys-card', 'light.stue_led'))] }));
  const same = (a, b) => { if (!a || !b) return { miss: true }; const d = {}; if (a.w !== b.w) d.w = [a.w, b.w]; Object.keys({ ...a.parts, ...b.parts }).forEach((k) => { if (JSON.stringify(a.parts[k]) !== JSON.stringify(b.parts[k])) d[k] = [a.parts[k], b.parts[k]]; }); return Object.keys(d).length ? d : null; };
  ok(`[Lys ${MO}] ingen msh-light-slider / plassholdere i Lys-popupen`, lys.old === 0, lys.old);
  ok(`[Lys ${MO}] dimbart lys: identisk rad som i Rom (markup, mål, farger)`, lys.tak[1] === romSig.tak[1] && !same(romSig.tak[0], lys.tak[0]), { html: lys.tak[1] === romSig.tak[1], d: same(romSig.tak[0], lys.tak[0]) });
  ok(`[Lys ${MO}] fargelys med utvidet panel: identisk rad som i Rom`, lys.led[1] === romSig.led[1] && !same(romSig.led[0], lys.led[0]), { html: lys.led[1] === romSig.led[1], a: romSig.led[1], b: lys.led[1], d: same(romSig.led[0], lys.led[0]) });
  if (SHOTS) { await center(page, 'msh-lys-card', 'light.stue_tak'); await page.screenshot({ path: `${SHOTS}/l41-lys-${MO}.png` }); }
  // dra på Lys-raden (touch): brightness_pct, popupen står
  const lb = await center(page, 'msh-lys-card', 'light.stue_tak', '.lr-sl');
  await page.evaluate(() => { window.CALLS = []; });
  await touch('touchStart', [{ x: lb.x + lb.w * 0.9, y: lb.cy }]);
  for (let i = 1; i <= 6; i++) { await touch('touchMove', [{ x: lb.x + lb.w * (0.9 - 0.08 * i), y: lb.cy + i * 2 }]); await wait(30); }
  await touch('touchEnd', []); await wait(400);
  const lc = await page.evaluate(() => ({ calls: window.CALLS.filter((c) => c[0] === 'light').map((c) => [c[1], c[2].brightness_pct]), pop: popOpen('#lys') }));
  ok(`[Lys ${MO}] touch-dra på lysrad: light.turn_on brightness_pct, popupen står`, lc.calls.length >= 1 && lc.calls[lc.calls.length - 1][0] === 'turn_on' && lc.calls[lc.calls.length - 1][1] < 60 && lc.pop, lc);
  // av/på-lyset i Lys (soverom-fanen)
  await lysTab(page, 'light.soverom_nattbord');
  const lysOO = await page.evaluate(() => [sig(row('msh-lys-card', 'light.soverom_nattbord')), html(row('msh-lys-card', 'light.soverom_nattbord'))]);
  ok(`[Lys ${MO}] av/på-lys: identisk rad som i Rom («På», bryter)`, lysOO[1] === romOO[1] && !same(romOO[0], lysOO[0]), { a: romOO[1], b: lysOO[1], d: same(romOO[0], lysOO[0]) });
  // gruppe-raden: samme renderer, «· 2 lys», dra styrer begge
  const gk = await lysTab(page, 'grp:gang');
  const gr = await page.evaluate(() => { const r = row('msh-lys-card', 'grp:gang'); return r && { p: r.querySelector('.lr-p').textContent, ic: r.querySelector('.lr-h ha-icon').getAttribute('icon'), sl: !!r.querySelector('.lr-sl'), cv: !!r.querySelector('.lr-cv'), inG: !!r.closest('.lgr') }; });
  ok(`[Lys ${MO}] gruppe-raden (Gang · alle) bruker samme renderer: lightbulb-group, «…% · 2 lys», slider, ingen chevron`, gk && gr && gr.sl && !gr.cv && gr.inG && /· 2 lys$/.test(gr.p) && gr.ic === 'mdi:lightbulb-group', gr);
  const gb = await center(page, 'msh-lys-card', 'grp:gang', '.lr-sl');
  await page.evaluate(() => { window.CALLS = []; });
  await touch('touchStart', [{ x: gb.x + gb.w * 0.2, y: gb.cy }]);
  for (let i = 1; i <= 8; i++) { await touch('touchMove', [{ x: gb.x + gb.w * (0.2 + 0.07 * i), y: gb.cy }]); await wait(30); }
  await touch('touchEnd', []); await wait(400);
  const gc = await page.evaluate(() => ({ calls: window.CALLS.filter((c) => c[0] === 'light').map((c) => [c[1], c[2]]), pop: popOpen('#lys') }));
  ok(`[Lys ${MO}] gruppe-dra (touch): brightness_pct til den dimbare + turn_on til av/på-lyset, popupen står`, gc.calls.some((c) => c[0] === 'turn_on' && JSON.stringify(c[1].entity_id) === '["light.gang_tak"]' && c[1].brightness_pct > 50) && gc.calls.some((c) => c[0] === 'turn_on' && JSON.stringify(c[1].entity_id) === '["light.gang_speil"]') && gc.pop, gc);
  ok(`[Lys ${MO}] ingen sidefeil`, !errs.length, errs);
  await page.close();
}

await browser.close();
console.log(res.join('\n'));
console.log(fails ? `\n${fails} feil` : '\nAlle sjekker OK');
process.exit(fails ? 1 : 0);
