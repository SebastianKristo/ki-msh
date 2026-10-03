// Fiks 39 · ny felles lysslider msh-light-slider («ki-light-slider») i Rom → Lys og Lys-popupen, mot EKTE Bubble Card,
// 390 px, touch (CDP), mørk + lys modus.
//   · rad: navn 15/500 + verdi 12 («0%», «100%»), 8 px til baren; bar 52 px r14; spor = lysfargen 35 % over #3a3a3a;
//     fyll = lysfargen (rgb → farge, kun dimbar = #ffc896) i full opasitet; håndtak 4 × 74 r2 ≈ fyll × 0,6, 11 px over/under,
//     6 px luft; 0 % = håndtaket helt til venstre, 100 % = helt til høyre; 14 px mellom radene
//   · chevron (44 × 44) bare på lys med farge/fargetemperatur → farge-/temperaturvelgeren under raden
//   · av/på-lys: pille med bryterknapp (44 px r10, ~55 %), mdi:power, prikk når av, knappen glir til høyre når på, «På»/«Av» (Fiks 40)
//   · touch-dra: lysstyrke live lokalt, light.turn_on {brightness_pct} throttlet 150 ms + ved slipp, popupen står (ikke lukket)
//   · trykk = av/på; haptic selection ved start, light ved 0/100 %; ekstern endring animeres 250 ms
//   · Lys-popupen: samme komponent i lyslistene og gruppe-raden (36.8); lys modus: tekst med --ki-*, spor fra lysfargen
// Kjør: node test/slider39-check.mjs   (SHOTS=dir → skjermbilder)
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
const bundle = resolve(`test/.build/s39-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const mocks = readdirSync(R + 'test/mock').filter((f) => f.endsWith('.js')).sort().map((f) => R + 'test/mock/' + f);
const SHOTS = process.env.SHOTS || '';
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const browser = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const res = [];
let fails = 0;
const ok = (name, cond, info) => { if (!cond) fails++; res.push(`${cond ? '✔' : '✘'} ${name}${info != null && !cond ? ' · ' + JSON.stringify(info) : ''}`); };
const near = (a, b, d = 1.5) => Math.abs(a - b) <= d;

async function boot(dark, popups) {
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
    // Testlys: 100 % dimbar, 0 % fargetemp, fargelys (rgb), 0 % dimbar, av/på-lys (på)
    set('light.stue_tak', 'on', { friendly_name: 'Stue tak', brightness: 255, supported_color_modes: ['brightness'], color_mode: 'brightness' });
    set('light.stue_lampe', 'off', { friendly_name: 'Stue lampe', supported_color_modes: ['color_temp'], min_color_temp_kelvin: 2200, max_color_temp_kelvin: 6500 });
    set('light.stue_led', 'on', { friendly_name: 'Stue LED', brightness: 128, supported_color_modes: ['rgb', 'color_temp'], color_mode: 'rgb', rgb_color: [255, 160, 90], hs_color: [24, 65] });
    set('light.soverom_tak', 'off', { friendly_name: 'Soverom tak', supported_color_modes: ['brightness'] });
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
    window.slider = (id) => deepAll('msh-light-slider').find((e) => e.config && (e.config.entity === id || (e.config.entities && 'grp:' + id === e.parentElement.dataset.lc)) && e.getClientRects().length);
    window.geo = (id) => {
      const el = slider(id); if (!el) return null;
      const S = el.shadowRoot, q = (s) => S.querySelector(s), bar = q('.bar'), cs = (e) => (e ? getComputedStyle(e) : null);
      const o = { bar: rect(bar), br: cs(bar).borderTopLeftRadius, hd: rect(q('.hd')), n: [cs(q('.n')).fontSize, cs(q('.n')).fontWeight, cs(q('.n')).color], v: [q('.v').textContent, cs(q('.v')).fontSize, cs(q('.v')).color, cs(q('.v')).fontVariantNumeric], cv: q('.cv') ? rect(q('.cv')) : null, oo: bar.classList.contains('oo'), on: bar.classList.contains('on'), trackBg: cs(bar).getPropertyValue('--tr') };
      if (q('.fl')) { o.fl = rect(q('.fl')); o.flBg = cs(q('.fl')).backgroundColor; o.flOp = cs(q('.fl')).opacity; o.tk = rect(q('.tk')); o.tkBg = cs(q('.tk')).backgroundColor; o.hh = rect(q('.hh')); o.hhBg = cs(q('.hh')).backgroundColor; o.hhR = cs(q('.hh')).borderTopLeftRadius; o.tr = [cs(q('.fl')).transitionDuration, cs(q('.hh')).transitionDuration]; }
      if (q('.kn')) { o.kn = rect(q('.kn')); o.knR = cs(q('.kn')).borderTopLeftRadius; o.knBg = cs(q('.kn')).backgroundColor; o.icon = q('.kn ha-icon') && q('.kn ha-icon').getAttribute('icon'); o.dot = rect(q('.dot')); o.dotOp = cs(q('.dot')).opacity; o.barBg = cs(bar).backgroundColor; o.ofl = cs(q('.ofl')).opacity; }
      return o;
    };
    window.rgb = (c) => { const m = /rgba?\(([^)]+)\)/.exec(c || ''); if (m) return m[1].split(/[ ,/]+/).filter(Boolean).slice(0, 3).map(Number); const n = /color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)/.exec(c || ''); return n ? [n[1], n[2], n[3]].map((x) => Math.round(Number(x) * 255)) : null; };
    await wait(400);
  }, { dark, popups });
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
  const tap = async (p) => { await touch('touchStart', [{ x: p.cx, y: p.cy }]); await page.waitForTimeout(40); await touch('touchEnd', []); await page.waitForTimeout(300); };
  const open = async (h) => { await page.evaluate(async (h) => { location.hash = h; await wait(1300); }, h); };
  return { page, errs, touch, tap, open, wait: (ms) => page.waitForTimeout(ms) };
}
const ROM = [{ hash: '#stue', name: 'Stue', cards: [{ type: 'custom:msh-rom-card', card_id: 's39a' }] }, { hash: '#soverom', name: 'Soverom', cards: [{ type: 'custom:msh-rom-card', card_id: 's39b' }] }];
const openLys = async (page) => page.evaluate(async () => { const c = deepAll('msh-rom-card').find((e) => e.getClientRects().length); c.setUI({ acc: { ...(c.ui.acc || {}), lys: true } }); await wait(500); });

for (const dark of [true, false]) {
  const M = dark ? 'mørk' : 'lys';
  /* ================================================================ Rom → Lys */
  const { page, errs, touch, tap, open, wait } = await boot(dark, ROM);
  await open('#stue'); await openLys(page);
  const st = await page.evaluate(() => {
    const c = deepAll('msh-rom-card').find((e) => e.getClientRects().length);
    const rows = [...c.shadowRoot.querySelectorAll('.lsl')];
    return { tags: rows.map((w) => w.firstElementChild && w.firstElementChild.localName), ids: rows.map((w) => w.dataset.lc), gap: rows.length > 1 ? Math.round(rows[1].getBoundingClientRect().top - rows[0].getBoundingClientRect().bottom) : null, vendor: deepAll('mysmart-light-control').length,
      full: geo('light.stue_tak'), zero: geo('light.stue_lampe'), col: geo('light.stue_led') };
  });
  ok(`[Rom ${M}] lys-radene er felles msh-light-slider (ingen mysmart-light-control), 14 px mellom radene`, st.tags.length === 3 && st.tags.every((t) => t === 'msh-light-slider') && st.vendor === 0 && near(st.gap, 14), st);
  const f = st.full, z = st.zero, co = st.col;
  ok(`[Rom ${M}] topplinje: navn 15/500, verdi 12 px tabular-nums, 8 px ned til baren`, f.n[0] === '15px' && f.n[1] === '500' && f.v[1] === '12px' && /tabular-nums/.test(f.v[3]) && near(f.bar.y - f.hd.b, 8), { n: f.n, v: f.v, d: f.bar.y - f.hd.b });
  ok(`[Rom ${M}] bar 52 px radius 14, full bredde uten chevron (kun dimbar)`, near(f.bar.h, 52) && f.br === '14px' && !f.cv, { h: f.bar.h, r: f.br, cv: f.cv });
  ok(`[Rom ${M}] 100 %: «100%», fyll helt ut (−10 px), håndtaket helt til høyre`, f.v[0] === '100%' && near(f.hh.r, f.bar.r) && near(f.fl.w, f.bar.w - 10) && f.tk.w < 1, { v: f.v[0], hh: f.hh, bar: f.bar, fl: f.fl.w, tk: f.tk.w });
  ok(`[Rom ${M}] håndtak 4 × 74 r2, 11 px over/under baren, 6 px luft mot fyllet`, near(f.hh.w, 4, 0.5) && near(f.hh.h, 74) && f.hhR === '2px' && near(f.bar.y - f.hh.y, 11) && near(f.hh.b - f.bar.b, 11) && near(f.hh.x - f.fl.r, 6), { hh: f.hh, r: f.hhR, fl: f.fl });
  const fc = rgbFrom(f.flBg), hc = rgbFrom(f.hhBg);
  ok(`[Rom ${M}] kun dimbar: fyll varmhvit #ffc896 i full opasitet, håndtak ≈ fyll × 0,6`, JSON.stringify(fc) === '[255,200,150]' && f.flOp === '1' && hc && near(hc[0], 153, 2) && near(hc[1], 120, 2) && near(hc[2], 90, 2), { fl: f.flBg, hh: f.hhBg });
  ok(`[Rom ${M}] 0 % (fargetemp av): «0%», håndtaket helt til venstre, ingen fyll, sporet fra 10 px`, z.v[0] === '0%' && near(z.hh.x, z.bar.x) && z.fl.w < 1 && near(z.tk.x - z.bar.x, 10), { v: z.v[0], hh: z.hh, bar: z.bar, fl: z.fl.w, tk: z.tk });
  const tk = rgbFrom(z.tkBg), base = dark ? [58, 58, 58] : [222, 222, 222];
  const exp = [255, 200, 150].map((v, i) => Math.round(v * 0.35 + base[i] * 0.65));
  ok(`[Rom ${M}] spor = lysfargen 35 % over ${dark ? '#3a3a3a' : '--ki-surface-3'} (varmhvit → brun-grå)`, tk && tk.every((v, i) => near(v, exp[i], 3)), { tk: z.tkBg, exp });
  ok(`[Rom ${M}] chevron (44 × 44, mdi:chevron-down) på fargetemp- og fargelys, ikke på kun dimbar`, z.cv && co.cv && !f.cv && near(z.cv.w, 44) && near(z.cv.h, 44) && z.bar.r <= z.cv.x + 1, { z: z.cv, c: co.cv, f: f.cv });
  ok(`[Rom ${M}] fargelys: fyll = rgb_color (255,160,90), «50%»`, JSON.stringify(rgbFrom(co.flBg)) === '[255,160,90]' && co.v[0] === '50%', { bg: co.flBg, v: co.v[0] });
  ok(`[Rom ${M}] tekst med tokens: navn ${dark ? '#e1e1e1' : '--ki-text'}, verdi ${dark ? '#afafaf' : '--ki-text-2'}`, dark ? f.n[2] === 'rgb(225, 225, 225)' && f.v[2] === 'rgb(175, 175, 175)' : f.n[2] === 'rgb(28, 28, 28)' && f.v[2] === 'rgb(86, 86, 86)', { n: f.n[2], v: f.v[2] });
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/s39-rom-${M}.png` });

  // chevron → farge-/temperaturvelgeren under raden; forhåndsvalg → light.turn_on rgb_color
  const cv = await page.evaluate(async () => {
    const S = slider('light.stue_led').shadowRoot; S.querySelector('.cv').click(); await wait(300);
    const o = { x: !!S.querySelector('.x'), groups: [...S.querySelectorAll('.xl span:first-child')].map((e) => e.textContent), open: S.querySelector('.cv').classList.contains('open') };
    window.CALLS = []; S.querySelector('.pc[data-pc]').click(); await wait(200);
    o.call = window.CALLS.find((c) => c[0] === 'light');
    const Z = slider('light.stue_lampe').shadowRoot; Z.querySelector('.cv').click(); await wait(300);
    o.zg = [...Z.querySelectorAll('.xl span:first-child')].map((e) => e.textContent);
    Z.querySelector('[data-s="ct"]').scrollIntoView({ block: 'center' }); await wait(300);
    o.ct = rect(Z.querySelector('[data-s="ct"]'));
    return o;
  });
  ok(`[Rom ${M}] chevron åpner fargevalg under raden (Temperatur · Farge · Forhåndsvalg), forhåndsvalg → light.turn_on rgb_color`, cv.x && cv.open && JSON.stringify(cv.groups) === '["Temperatur","Farge","Forhåndsvalg"]' && cv.call && cv.call[1] === 'turn_on' && Array.isArray(cv.call[2].rgb_color) && JSON.stringify(cv.zg) === '["Temperatur"]', cv);
  await page.evaluate(() => { window.CALLS = []; });
  await touch('touchStart', [{ x: cv.ct.x + cv.ct.w * 0.1, y: cv.ct.cy }]);
  for (let i = 1; i <= 6; i++) { await touch('touchMove', [{ x: cv.ct.x + cv.ct.w * (0.1 + i * 0.12), y: cv.ct.cy }]); await wait(30); }
  await touch('touchEnd', []); await wait(300);
  const ctc = await page.evaluate(() => ({ calls: window.CALLS.filter((c) => c[0] === 'light'), pop: popOpen('#stue') }));
  ok(`[Rom ${M}] temperatur-slider (touch) → light.turn_on color_temp_kelvin, popupen står`, ctc.calls.length >= 1 && ctc.calls.every((c) => c[2].color_temp_kelvin > 2200) && ctc.calls[ctc.calls.length - 1][2].color_temp_kelvin > 5000 && ctc.pop, ctc);
  await page.evaluate(async () => { slider('light.stue_lampe').shadowRoot.querySelector('.cv').click(); slider('light.stue_led').shadowRoot.querySelector('.cv').click(); await wait(300); });

  // touch-dra på dimbar rad: live lokalt, throttlet 150 ms + ved slipp, haptic selection ved start / light ved 0 og 100 %
  const b0 = await page.evaluate(() => { const S = slider('light.stue_tak'); S.scrollIntoView({ block: 'center' }); return rect(S.shadowRoot.querySelector('.bar')); });
  await page.evaluate(() => { window.CALLS = []; window.HAP = []; });
  await touch('touchStart', [{ x: b0.x + b0.w * 0.5, y: b0.cy }]);
  const live = [];
  for (let i = 1; i <= 14; i++) {
    await touch('touchMove', [{ x: b0.x + b0.w * (0.5 - i * 0.05), y: b0.cy + (i % 3) }]); await wait(25);
    if (i === 5) live.push(await page.evaluate(() => slider('light.stue_tak').shadowRoot.querySelector('.v').textContent));
  }
  const mid = await page.evaluate(() => ({ calls: window.CALLS.length, pop: popOpen('#stue') }));
  for (let i = 1; i <= 6; i++) { await touch('touchMove', [{ x: b0.x + b0.w * (0.3 + i * 0.03), y: b0.cy }]); await wait(25); }
  await touch('touchEnd', []); await wait(400);
  const dr = await page.evaluate(() => ({ calls: window.CALLS.filter((c) => c[0] === 'light'), hap: window.HAP.map((h) => h[0]), pop: popOpen('#stue'), v: slider('light.stue_tak').shadowRoot.querySelector('.v').textContent }));
  const on = dr.calls.filter((c) => c[1] === 'turn_on'), ts = dr.calls.map((c) => c[3]);
  const gaps = ts.slice(1, -1).map((t, i) => t - ts[i]);
  const last = dr.calls[dr.calls.length - 1];
  ok(`[Rom ${M}] touch-dra: verdien oppdateres live lokalt (${live[0]}) og popupen lukkes ikke`, /^\d+%$/.test(live[0] || '') && live[0] !== '100%' && dr.pop && mid.pop, { live, pop: dr.pop });
  ok(`[Rom ${M}] dra helt til venstre = av (light.turn_off) underveis, brightness_pct 1–100 ellers`, dr.calls.some((c) => c[1] === 'turn_off') && on.every((c) => c[2].brightness_pct >= 1 && c[2].brightness_pct <= 100 && c[2].entity_id === 'light.stue_tak'), dr.calls.map((c) => [c[1], c[2].brightness_pct]));
  ok(`[Rom ${M}] throttling: ${dr.calls.length} kall på ~500 ms drag, minst ~150 ms mellom kallene underveis, siste ved slipp = sluttverdien`, dr.calls.length >= 2 && dr.calls.length <= 8 && gaps.every((g) => g >= 140) && last && last[1] === 'turn_on' && `${last[2].brightness_pct}%` === dr.v, { n: dr.calls.length, gaps, last, v: dr.v });
  ok(`[Rom ${M}] haptic: selection ved start, light ved 0 %`, dr.hap[0] === 'selection' && dr.hap.includes('light'), dr.hap);
  // trykk uten drag = av/på
  await page.evaluate(() => { window.CALLS = []; });
  await tap(await page.evaluate(() => rect(slider('light.stue_lampe').shadowRoot.querySelector('.bar'))));
  const t1 = await page.evaluate(() => window.CALLS.filter((c) => c[0] === 'light').map((c) => [c[1], c[2]]));
  ok(`[Rom ${M}] trykk på av-lys = light.turn_on (forrige nivå, uten brightness_pct)`, t1.length === 1 && t1[0][0] === 'turn_on' && t1[0][1].entity_id === 'light.stue_lampe' && t1[0][1].brightness_pct == null, t1);
  // ekstern endring: animeres 250 ms
  await page.evaluate(async () => { await wait(3200); setHass((S) => { S['light.stue_led'] = { ...S['light.stue_led'], attributes: { ...S['light.stue_led'].attributes, brightness: 26 } }; }); });
  const an = await page.evaluate(async () => { const g0 = geo('light.stue_led'); await wait(60); const g1 = geo('light.stue_led'); await wait(400); const g2 = geo('light.stue_led'); return { tr: g0.tr, w0: g0.fl.w, w1: g1.fl.w, w2: g2.fl.w, v: g2.v[0] }; });
  ok(`[Rom ${M}] ekstern endring (50 % → 10 %): fyll og håndtak animeres 250 ms`, an.tr[0].includes('0.25s') && an.tr[1].includes('0.25s') && an.w1 > an.w2 + 2 && an.v === '10%', an);
  ok(`[Rom ${M}] ingen sidefeil`, !errs.length, errs);

  // av/på-lys og 0 % dimbart lys (Soverom)
  await open('#soverom'); await openLys(page);
  const oo = await page.evaluate(() => ({ g: geo('light.soverom_nattbord'), d: geo('light.soverom_tak') }));
  const g = oo.g;
  ok(`[Rom ${M}] av/på-lys: pille 52 r14, bryterknapp 44 px r10 ~55 % bredde, mdi:power, «På», knappen til høyre, fyll i lysfargen`, g && g.oo && g.on && near(g.bar.h, 52) && g.br === '14px' && near(g.kn.h, 44) && g.knR === '10px' && near(g.kn.w / g.bar.w, 0.55, 0.03) && g.icon === 'mdi:power' && g.v[0] === 'På' && near(g.kn.r, g.bar.r - 4) && g.ofl === '1' && !g.cv, g);
  ok(`[Rom ${M}] 0 % dimbart lys (av): «0%», ingen chevron`, oo.d && oo.d.v[0] === '0%' && !oo.d.cv && near(oo.d.hh.x, oo.d.bar.x), oo.d);
  await page.evaluate(() => { window.CALLS = []; window.HAP = []; });
  await tap(g.bar);
  const of = await page.evaluate(async () => { const o = { calls: window.CALLS.filter((c) => c[0] === 'light').map((c) => [c[1], c[2].entity_id]), hap: window.HAP.map((h) => h[0]) }; await wait(300); o.g = geo('light.soverom_nattbord'); o.pop = popOpen('#soverom'); return o; });
  ok(`[Rom ${M}] trykk på av/på-lys: light.turn_off, knappen glir til venstre, prikk vises, «Av», haptic light`, JSON.stringify(of.calls) === '[["turn_off","light.soverom_nattbord"]]' && !of.g.on && near(of.g.kn.x, of.g.bar.x + 4) && of.g.dotOp === '1' && of.g.dot.x > of.g.kn.r && of.g.v[0] === 'Av' && of.hap.includes('light') && of.pop, of);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/s39-rom-soverom-${M}.png` });
  await page.close();

  /* ================================================================ Lys-popupen */
  const L = await boot(dark, [{ hash: '#lys', name: 'Lys', cards: [{ type: 'custom:msh-lys-card', card_id: 's39l', groups: { gang: { members: ['light.gang_tak', 'light.gang_speil'] } } }] }]);
  await L.open('#lys');
  const lys = await L.page.evaluate(async () => {
    const c = deepAll('msh-lys-card').find((e) => e.getClientRects().length), out = { tabs: {}, vendor: deepAll('mysmart-light-control').length };
    const keys = [...c.shadowRoot.querySelectorAll('.mtb-t')].map((b) => b.dataset.v).filter((k) => k && k.startsWith('f:'));
    for (const k of keys) {
      c.setUI({ tab: k }); await wait(500);
      [...c.shadowRoot.querySelectorAll('.lsl')].forEach((w) => { const el = w.firstElementChild; out.tabs[w.dataset.lc] = { tag: el && el.localName, cv: !!(el && el.shadowRoot.querySelector('.cv')), oo: !!(el && el.shadowRoot.querySelector('.oo')), type: el && el.config.type, v: el && el.shadowRoot.querySelector('.v').textContent }; });
    }
    return { ...out, keys };
  });
  const T = lys.tabs, ents = Object.keys(T);
  ok(`[Lys ${M}] lyslistene bruker samme msh-light-slider (ingen vendor-kontroll)`, ents.length >= 6 && ents.every((k) => T[k].tag === 'msh-light-slider') && lys.vendor === 0, T);
  ok(`[Lys ${M}] chevron kun på farge-/fargetemp-lys`, ents.filter((k) => !k.startsWith('grp:')).every((k) => T[k].cv === (T[k].type === 'ct' || T[k].type === 'color')) && T['light.stue_led'].cv && T['light.stue_lampe'].cv && !T['light.stue_tak'].cv, T);
  ok(`[Lys ${M}] gruppe-raden (Gang · alle) er samme slider med «· 2 lys»`, T['grp:gang'] && T['grp:gang'].tag === 'msh-light-slider' && /· 2 lys$/.test(T['grp:gang'].v), T['grp:gang']);
  // gruppe-slideren: touch-dra styrer begge, popupen står
  await L.page.evaluate(async () => { const c = deepAll('msh-lys-card').find((e) => e.getClientRects().length); for (const t of [...c.shadowRoot.querySelectorAll('.mtb-t')].map((b) => b.dataset.v)) { c.setUI({ tab: t }); await wait(400); if (c.shadowRoot.querySelector('[data-lc="grp:gang"]')) break; } });
  const gb = await L.page.evaluate(() => { const el = slider('gang'); el.scrollIntoView({ block: 'center' }); window.CALLS = []; return rect(el.shadowRoot.querySelector('.bar')); });
  await L.touch('touchStart', [{ x: gb.x + gb.w * 0.2, y: gb.cy }]);
  for (let i = 1; i <= 8; i++) { await L.touch('touchMove', [{ x: gb.x + gb.w * (0.2 + 0.07 * i), y: gb.cy }]); await L.wait(30); }
  await L.touch('touchEnd', []); await L.wait(400);
  const gc = await L.page.evaluate(() => ({ calls: window.CALLS.filter((c) => c[0] === 'light').map((c) => [c[1], c[2]]), pop: popOpen('#lys') }));
  const lastG = gc.calls[gc.calls.length - 1];
  ok(`[Lys ${M}] gruppe-slider (touch): light.turn_on for de dimbare (brightness_pct) + av/på-lyset, popupen står`, lastG && gc.calls.some((c) => c[0] === 'turn_on' && JSON.stringify(c[1].entity_id) === '["light.gang_tak"]' && c[1].brightness_pct > 50) && gc.calls.some((c) => c[0] === 'turn_on' && JSON.stringify(c[1].entity_id) === '["light.gang_speil"]') && gc.pop, gc);
  // dra på en vanlig rad i Lys (touch) – popupen står
  const lb = await L.page.evaluate(async () => { const c = deepAll('msh-lys-card').find((e) => e.getClientRects().length); for (const t of [...c.shadowRoot.querySelectorAll('.mtb-t')].map((b) => b.dataset.v)) { c.setUI({ tab: t }); await wait(400); if (slider('light.stue_tak')) break; } const el = slider('light.stue_tak'); el.scrollIntoView({ block: 'center' }); window.CALLS = []; return rect(el.shadowRoot.querySelector('.bar')); });
  await L.touch('touchStart', [{ x: lb.x + lb.w * 0.9, y: lb.cy }]);
  for (let i = 1; i <= 6; i++) { await L.touch('touchMove', [{ x: lb.x + lb.w * (0.9 - 0.08 * i), y: lb.cy + i * 2 }]); await L.wait(30); }
  await L.touch('touchEnd', []); await L.wait(400);
  const lc = await L.page.evaluate(() => ({ calls: window.CALLS.filter((c) => c[0] === 'light').map((c) => [c[1], c[2].brightness_pct]), pop: popOpen('#lys'), g: geo('light.stue_tak') }));
  ok(`[Lys ${M}] touch-dra på lysrad: brightness_pct, popupen står`, lc.calls.length >= 1 && lc.calls[lc.calls.length - 1][0] === 'turn_on' && lc.calls[lc.calls.length - 1][1] < 60 && lc.pop, lc.calls);
  ok(`[Lys ${M}] samme mål som i Rom: bar 52 r14, håndtak 4 × 74`, near(lc.g.bar.h, 52) && lc.g.br === '14px' && near(lc.g.hh.h, 74) && near(lc.g.hh.w, 4, 0.5), lc.g);
  if (SHOTS) await L.page.screenshot({ path: `${SHOTS}/s39-lys-${M}.png` });
  ok(`[Lys ${M}] ingen sidefeil`, !L.errs.length, L.errs);
  await L.page.close();
}
function rgbFrom(c) { const m = /rgba?\(([^)]+)\)/.exec(c || ''); if (m) return m[1].split(/[ ,/]+/).filter(Boolean).slice(0, 3).map((x) => Math.round(Number(x))); const n = /color\(srgb ([\d.e-]+) ([\d.e-]+) ([\d.e-]+)/.exec(c || ''); return n ? [n[1], n[2], n[3]].map((x) => Math.round(Number(x) * 255)) : null; }

await browser.close();
console.log(res.join('\n'));
console.log(fails ? `\n${fails} feil` : '\nAlle sjekker OK');
process.exit(fails ? 1 : 0);
