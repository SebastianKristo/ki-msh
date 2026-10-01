// Fiks 27.0–27.4 + 27.8 · Vær-popup (#vaer, msh-vaer-card) 1:1 med design/Vær v5.dc.html (stil Scene).
//   node test/vaer27-check.mjs   (SHOTS=<mappe> gir skjermbilder)
// Uavhengig av klokkeslett: forventede verdier regnes ut fra den samme (mock-)prognosen i siden.
import { createRequire } from 'node:module';
import { readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const bundle = resolve(`test/.build/vaer27-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const shots = process.env.SHOTS || '';
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const res = {}, fail = [];
const ok = (name, cond, info) => { res[name] = cond ? 'OK' : ['FEIL', info]; if (!cond) fail.push(name); };
const mocks = readdirSync('test/mock').sort().map((m) => resolve('test/mock/' + m));
const errs = [];
async function page(vp, opt = {}) {
  const p = await b.newPage({ viewport: vp, hasTouch: true, ...opt });
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + resolve('test/harness.html'));
  for (const m of mocks) await p.addScriptTag({ path: m });
  await p.addScriptTag({ path: bundle });
  return p;
}
const mk = (p, cfg, state) => p.evaluate(async ([cfg, state]) => {
  const w = (ms) => new Promise((q) => setTimeout(q, ms));
  document.getElementById('dash').innerHTML = '';
  const h = window.mockHass();
  if (state) h.states['weather.home'] = { ...h.states['weather.home'], state };
  window.__h = h;
  const bc = document.createElement('bubble-card');
  bc.setConfig({ type: 'custom:bubble-card', card_type: 'pop-up', hash: '#vaer' });
  bc.innerHTML = '<div class="pop bubble-pop-up" style="overflow:hidden;display:flex;flex-direction:column"><div class="hdr bubble-header-container">Vær</div><div class="inner bubble-pop-up-container" style="overflow:auto;flex:1;min-height:0"></div></div>';
  document.getElementById('dash').appendChild(bc);
  location.hash = '#vaer';
  const c = document.createElement('msh-vaer-card');
  c.setConfig({ type: 'custom:msh-vaer-card', card_id: 'pop-vaer', ...cfg });
  c.hass = h;
  bc.querySelector('.inner').appendChild(c);
  window.__c = c; window.__pop = bc.querySelector('.bubble-pop-up');
  await w(700);
  return true;
}, [cfg, state || null]);

for (const vp of [{ width: 390, height: 900, tag: 'mobil' }, { width: 1280, height: 900, tag: 'PC' }]) {
  const p = await page({ width: vp.width, height: vp.height });
  await mk(p, { places: [{ name: 'Hjem', entity: 'weather.home' }, { name: 'Hytta', entity: 'weather.hytta' }] }, 'sunny');
  const T = vp.tag;

  /* ---------------------------------------------------------------- 27.1 Neste timer = designets kolonnekort */
  const N = await p.evaluate(async () => {
    const w = (ms) => new Promise((q) => setTimeout(q, ms));
    const sr = window.__c.shadowRoot, q = (s) => sr.querySelector(s), qa = (s) => [...sr.querySelectorAll(s)], cs = (e) => getComputedStyle(e);
    const card = q('.hcard'), btn = qa('.mpill .mb'), on = q('.mpill .mb.on'), off = q('.mpill .mb:not(.on)');
    const cols = qa('.hc'), first = q('.hc .ht'), ps = qa('.hc .hp').map((e) => e.textContent);
    const r0 = { pad: cs(card).padding, rad: cs(card).borderRadius, blur: cs(card).backdropFilter, title: q('.htt').textContent, tf: [cs(q('.htt')).fontSize, cs(q('.htt')).fontWeight], sub: q('.hsub').textContent, subF: [cs(q('.hsub')).fontSize, cs(q('.hsub')).color],
      btn: btn.map((e) => [Math.round(e.getBoundingClientRect().width), Math.round(e.getBoundingClientRect().height), cs(e).borderRadius]), onBg: cs(on).backgroundImage, onCol: cs(on).color, offBg: cs(off).backgroundImage, pill: cs(q('.mpill')).backgroundColor,
      ta: cs(q('.mpill')).touchAction, gd: q('.mpill').__gd === true, icons: btn.map((e) => e.querySelector('ha-icon').getAttribute('icon')),
      n: cols.length, colW: Math.round(cols[0].getBoundingClientRect().width), first: first.textContent, firstW: cs(first).fontWeight, t1: cols[1] && cols[1].querySelector('.ht').textContent, zero: ps.filter((x) => /^0\s*%$/.test(x)).length,
      graph: !!q('.gph') || !!q('.hcard svg:not(.wch)'), vals: qa('.hc .hv').slice(0, 3).map((e) => e.textContent), scroll: cs(q('.hsc')).overflowX };
    q('.mb[data-k="rain"]').click(); await w(120);
    const r1 = { sub: q('.hsub').textContent, n: qa('.hc').length, bars: qa('.hc .rbx').length, mm: qa('.hc .hmm').slice(0, 2).map((e) => e.textContent), on: q('.mb.on').dataset.k };
    q('.mb[data-k="wind"]').click(); await w(120);
    const r2 = { sub: q('.hsub').textContent, n: qa('.hc').length, w: qa('.hc .hwv').length, g: (q('.hc .hwg') || {}).textContent, chart: !!q('.hcard svg.wch'), days: q('.dcard').dataset.metric, dayRows: qa('.dcard .rrow').length };
    q('.mb[data-k="rain"]').click(); await w(120);
    const r3 = { days: q('.dcard').dataset.metric, segs: qa('.dcard .rrow')[0] && qa('.dcard .rrow')[0].querySelectorAll('.rs').length };
    q('.mb[data-k="temp"]').click(); await w(120);
    return { r0, r1, r2, r3 };
  });
  const r0 = N.r0;
  ok(`${T} 27.1 kort: var(--card)+blur, radius 24, padding 14px 0 12px`, r0.pad === '14px 0px 12px' && r0.rad === '24px' && /blur\(18px\)/.test(r0.blur || ''), r0);
  ok(`${T} 27.1 header «Neste timer» 15/500 + undertittel 12 px #a8a8a8`, r0.title === 'Neste timer' && r0.tf[0] === '15px' && r0.tf[1] === '500' && r0.sub === 'Temperatur (°C)' && r0.subF[0] === '12px' && r0.subF[1] === 'rgb(168, 168, 168)', r0);
  ok(`${T} 27.1 pillvelger: 3 runde ikonknapper 40×32, aktiv rosa gradient med mørkt ikon, Liquid Glass (pan-y)`, r0.btn.length === 3 && r0.btn.every((x) => x[0] === 40 && x[1] === 32 && parseFloat(x[2]) >= 16) && /gradient/.test(r0.onBg) && r0.onCol === 'rgba(70, 58, 64, 0.95)' && r0.offBg === 'none' && r0.pill === 'rgb(48, 48, 48)' && r0.ta === 'pan-y' && r0.gd && r0.icons.join('|') === 'mdi:thermometer|mdi:water|mdi:weather-windy', r0);
  ok(`${T} 27.1 kolonner 56 px: «Nå» fet, deretter timetall, horisontal scroll, ingen flate-graf`, r0.n >= 12 && r0.colW === 56 && r0.first === 'Nå' && r0.firstW === '600' && /^\d\d$/.test(r0.t1 || '') && r0.scroll === 'auto' && !r0.graph && r0.vals.every((v) => /^-?\d+°$/.test(v)), r0);
  ok(`${T} 27.1/27.2 ingen «0 %» under timeikoner`, r0.zero === 0, r0);
  ok(`${T} 27.1 Nedbør/Vind bytter verdiene i kolonnene og undertittelen (samme kolonner)`, N.r1.sub === 'Nedbør · mengde og sannsynlighet' && N.r1.n === r0.n && N.r1.bars === r0.n && /mm$/.test(N.r1.mm[0]) && N.r2.sub === 'Vind (m/s) · kast' && N.r2.n === r0.n && N.r2.w === r0.n && /^kast /.test(N.r2.g || '') && N.r2.chart, N);
  ok(`${T} 27.1 døgnvarselet følger velgeren (nedbør: 8 segmenter per døgn, vind: kurve per døgn)`, N.r2.days === 'wind' && N.r2.dayRows >= 7 && N.r3.days === 'rain' && N.r3.segs === 8, N);

  /* ---------------------------------------------------------------- 27.2 Døgnvarsel · I dag utvidet */
  const D = await p.evaluate(async () => {
    const w = (ms) => new Promise((q) => setTimeout(q, ms));
    const sr = window.__c.shadowRoot, q = (s) => sr.querySelector(s), qa = (s) => [...sr.querySelectorAll(s)], cs = (e) => getComputedStyle(e);
    const fc = window.__c._fc.daily.slice(0, 10), lows = fc.map((f) => (f.templow != null ? f.templow : f.temperature)), highs = fc.map((f) => f.temperature);
    const mn = Math.min(...lows, ...highs), mx = Math.max(...lows, ...highs);
    const trk = qa('.dtr'), bars = trk.map((t, i) => { const tb = t.getBoundingClientRect(), bb = t.querySelector('.dbar').getBoundingClientRect(); return { i, l: (bb.left - tb.left) / tb.width, r: (tb.right - bb.right) / tb.width, lo: lows[i], hi: highs[i] }; });
    const iMin = lows.indexOf(mn) >= 0 ? lows.indexOf(mn) : highs.indexOf(mn), iMax = highs.indexOf(mx);
    const dot = !!qa('.dw')[0].querySelector('.ddot'), dots = qa('.ddot').length;
    const rowP = qa('.dr .dp').map((e) => e.textContent);
    qa('.dr')[0].click(); await w(400);
    const dx = q('.dx'), strip = q('.dx .d3'), cells = qa('.dx .d3 .hs'), grid = q('.dx .dgr'), st = qa('.dx .dc');
    const dxW = dx.getBoundingClientRect().width, sW = strip ? strip.getBoundingClientRect().width : 0, used = cells.reduce((s, c) => s + c.getBoundingClientRect().width, 0) + Math.max(0, cells.length - 1) * 4;
    const rows = [...new Set(st.map((e) => Math.round(e.getBoundingClientRect().top)))].length, cols = cs(grid).gridTemplateColumns.split(' ').length, hs = [...new Set(st.map((e) => Math.round(e.getBoundingClientRect().height)))];
    const sen = q('.dsen'), senS = cs(sen), clamp = senS.getPropertyValue('-webkit-line-clamp'), wrap = senS.getPropertyValue('text-wrap-style') || senS.getPropertyValue('text-wrap');
    const labels = st.map((e) => e.querySelector('.dcl').textContent.trim()), vind = st[1].querySelector('.dcv').textContent;
    const exp = (window.__c._fc.hourly || []).filter((y) => { const d = new Date(y.datetime); return d.toDateString() === new Date().toDateString() && d.getHours() % 3 === 0; }).length;
    const hp = cells.map((c) => c.querySelector('.dhp').textContent);
    const anim = cs(dx).animationName;
    qa('.dr')[1].click(); await w(150);
    const one = qa('.dx').length;
    qa('.dr')[1].click(); await w(100);
    return { bars, iMin, iMax, dot, dots, rowP, dxW, sW, used, n: cells.length, exp, rows, cols, hs, clamp, wrap, labels, vind, hp, anim, one, mn, mx };
  });
  const bMin = D.bars[D.iMin], bMax = D.bars[D.iMax];
  ok(`${T} 27.2 staven skalert mot ukens min/maks (laveste dag starter i 0 %, høyeste slutter i 100 %)`, bMin && bMin.l < 0.01 && bMax && bMax.r < 0.01 && D.bars.every((x) => x.l >= -0.001 && x.r >= -0.001), D.bars);
  ok(`${T} 27.2 hvit «nå»-prikk kun på I dag`, D.dot && D.dots === 1, D);
  ok(`${T} 27.2 timer hver 3. time over hele bredden`, D.n === D.exp && (D.n === 0 || (Math.abs(D.sW - (D.dxW + 8)) < 1.5 && D.used >= D.dxW - 2)), D);
  ok(`${T} 27.2 stat-fliser 3×2 med lik høyde: Nedbør · Vind · UV · Fukt · Sol opp · Sol ned`, D.labels.join('|') === 'Nedbør|Vind|UV|Fukt|Sol opp|Sol ned' && D.cols === 3 && D.rows === 2 && D.hs.length === 1, D);
  ok(`${T} 27.2 vind i HA-enheten (m/s), oppsummering maks 2 linjer (pretty), animert`, /m\/s$/.test(D.vind) && D.clamp === '2' && /pretty/.test(D.wrap || '') && D.anim === 'vxh', D);
  ok(`${T} 27.2 ingen «0 %» (dagrad og timeceller), kun én dag åpen`, !D.rowP.some((x) => /^0\s*%$/.test(x)) && !D.hp.some((x) => /^0\s*%$/.test(x)) && D.one === 1, D);
  if (shots) await p.screenshot({ path: `${shots}/vaer27-${T}.png` });
  await p.close();
}

/* ---------------------------------------------------------------- 27.3 animasjoner = fx()/fxBase() fra Vær v5 */
{
  const p = await page({ width: 390, height: 900 });
  await mk(p, {}, 'rainy');
  // samme PRNG som designet (seed 11 i fxBase): første sky i «Regn» har bredde 260 + r()·220
  let seed = 11; const r = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  const w0 = 260 + r() * 220, d0 = 90 + r() * 90;
  const F = await p.evaluate(async () => {
    const w = (ms) => new Promise((q) => setTimeout(q, ms));
    const out = {};
    const layer = () => window.__pop.querySelector(':scope > .msh-vaer-scene');
    for (const s of ['sunny', 'partlycloudy', 'rainy', 'snowy', 'lightning-rainy', 'clear-night', 'fog', 'windy', 'hail', 'pouring', 'exceptional']) {
      window.__h = { ...window.__h, states: { ...window.__h.states, 'weather.home': { ...window.__h.states['weather.home'], state: s } } };
      window.__c.hass = window.__h;
      for (let i = 0; i < 20 && layer().shadowRoot.querySelector('.sc').dataset.scene !== s; i++) await w(50);
      const R = layer().shadowRoot, sc = R.querySelector('.sc'), all = [...sc.querySelectorAll('*')];
      const an = (n) => all.filter((e) => (e.getAttribute('style') || '').includes(`animation:${n} `)).length;
      out[s] = { bg: sc.style.background, img: all.some((e) => e.tagName === 'IMG') || /url\(/.test(sc.innerHTML), fall: an('fall'), drift: an('drift'), splash: an('splash'), beam: an('beam'), bloom: an('bloom'), mote: an('mote'), twinkle: an('twinkle'), fog: an('fogmove'), streak: an('streak'), bolt: sc.querySelectorAll('svg path[style*="animation:bolt"]').length, flash: an('flash'), glowx: an('glowx'), card: window.__c.style.getPropertyValue('--vaer-card'),
        first: (sc.querySelector('.cl') || { getAttribute: () => '' }).getAttribute('style'), kf: [...R.querySelectorAll('style')].map((x) => x.textContent).join('').match(/@keyframes (\w+)/g).length, pe: getComputedStyle(layer()).pointerEvents };
    }
    return out;
  });
  const V = (s) => F[s] || {};
  ok('27.3 ingen bilder (ingen fotorealistisk sol) – bare CSS-lag', Object.values(F).every((x) => !x.img), F);
  ok('27.3 bakgrunn = designets 3-stopps gradient + kortfarge per tilstand', /rgb\(47, 111, 176\) 0%, rgb\(77, 143, 204\) 40%, rgb\(121, 177, 222\) 100%/.test(V('sunny').bg) && /rgb\(50, 58, 70\) 0%/.test(V('rainy').bg) && V('rainy').card === 'rgba(30,36,46,.42)' && V('sunny').card === 'rgba(20,50,90,.32)', { s: V('sunny').bg, r: V('rainy').bg, c: [V('rainy').card, V('sunny').card] });
  ok('27.3 sunny (Sol): 6 stråler (beam), sol (bloom), 14 støv (mote), 2 skyer (drift)', V('sunny').beam === 6 && V('sunny').bloom === 1 && V('sunny').mote === 14 && V('sunny').drift === 2, V('sunny'));
  ok('27.3 partlycloudy: Sol + 4 ekstra skyer', V('partlycloudy').beam === 6 && V('partlycloudy').drift === 6, V('partlycloudy'));
  ok('27.3 rainy (Regn): 4 skyer, 72 regnstreker i 3 lag (fall), 8 plask', V('rainy').drift === 4 && V('rainy').fall === 72 && V('rainy').splash === 8, V('rainy'));
  ok('27.3 snowy (Snø): 3 skyer, 76 fnugg i 3 lag (fall)', V('snowy').drift === 3 && V('snowy').fall === 76, V('snowy'));
  ok('27.3 lightning-rainy (Torden): 6 mørke skyer, 108 tunge regnstreker, 2 lyn (SVG-bolt, 2 stier hver) + blink', V('lightning-rainy').drift === 6 && V('lightning-rainy').fall === 108 && V('lightning-rainy').bolt === 4 && V('lightning-rainy').flash === 2, V('lightning-rainy'));
  ok('27.3 clear-night (Natt): 70 stjerner (twinkle) + 1 sky', V('clear-night').twinkle === 70 && V('clear-night').drift === 1, V('clear-night'));
  ok('27.3 fog/windy/hail/pouring/exceptional: tåke, streker, hagl, styrtregn, rød glød', V('fog').fog === 5 && V('windy').streak === 26 && V('hail').fall === 40 && V('pouring').fall === 34 + 72 && V('exceptional').glowx === 1, { fog: V('fog').fog, wind: V('windy').streak, hail: V('hail').fall, pour: V('pouring').fall, ex: V('exceptional').glowx });
  ok('27.3 samme frø som designet (første sky: bredde og varighet)', V('rainy').first.includes(`width:${w0}px`) && V('rainy').first.includes(`drift ${d0}s linear`), [V('rainy').first, w0, d0]);
  ok('27.3 alle @keyframes fra designet i scenelaget, pointer-events none', V('rainy').kf >= 15 && V('rainy').pe === 'none', V('rainy'));
  await p.close();
  // prefers-reduced-motion → statisk (ingen bevegelige partikler, ingen animasjon)
  const p2 = await page({ width: 390, height: 900 }, { reducedMotion: 'reduce' });
  await mk(p2, {}, 'rainy');
  const RM = await p2.evaluate(() => { const sc = window.__pop.querySelector(':scope > .msh-vaer-scene').shadowRoot.querySelector('.sc'); const a = sc.querySelector('.a'), c = sc.querySelector('.cl'); return { rn: getComputedStyle(a).display, an: getComputedStyle(c).animationName }; });
  ok('27.3 prefers-reduced-motion → statisk scene', RM.rn === 'none' && RM.an === 'none', RM);
  await p2.close();
}

/* ---------------------------------------------------------------- 27.4 + 27.8 · Tilpass Vær: søk, steder, dra og slipp */
{
  const p = await page({ width: 390, height: 900 });
  await mk(p, { places: [{ name: 'Hjem', entity: 'weather.home' }, { name: 'Hytta', entity: 'weather.hytta' }] }, 'partlycloudy');
  const S = await p.evaluate(async () => {
    const w = (ms) => new Promise((q) => setTimeout(q, ms));
    const c = window.__c; c.setUI({ place: 1 }); await w(50); // Hytta valgt
    c.customize(); await w(400);
    const R = c._sheet.ov.root, box = R.querySelector('.vaer-sheet'), sh = R.querySelector('.sh');
    const pl = box.querySelector('.plist'), cap = [...box.querySelectorAll('.cap')].map((e) => e.textContent);
    const clip = { flex: getComputedStyle(pl).flexShrink, sh: pl.scrollHeight, ch: pl.clientHeight, addVis: !!box.querySelector('[data-a="openadd"]') && box.querySelector('[data-a="openadd"]').getBoundingClientRect().height > 40 };
    box.querySelector('[data-a="openadd"]').click(); await w(80);
    const addB = () => box.querySelector('[data-a="add"]');
    const dis0 = addB().disabled;
    const typ = async (v) => { const q = box.querySelector('[data-in="q"]'); q.value = v; q.dispatchEvent(new Event('input', { bubbles: true })); await w(30); return [...box.querySelectorAll('.cands .cd')].map((e) => e.dataset.k + (e.disabled ? '#' : '')); };
    const byName = await typ('JOBB'), byId = await typ('weather.oslo'), byPart = await typ('hyt'), none = await typ('finnesikke');
    const noneTxt = box.querySelector('.cands').textContent.trim();
    const all = await typ('');
    const cd = box.querySelector('.cd[data-k="weather.oslo_sentrum"]'), cdTxt = cd.textContent, mono = getComputedStyle(cd.querySelector('.cdi')).fontFamily, idSize = getComputedStyle(cd.querySelector('.cdi')).fontSize, hasIcon = !!cd.querySelector('ha-icon');
    const dimmed = getComputedStyle(box.querySelector('.cd[data-k="weather.home"]')).opacity;
    cd.click(); await w(40);
    const nm = box.querySelector('[data-in="name"]').value, dis1 = addB().disabled, addBg = getComputedStyle(addB()).backgroundImage;
    const inp = box.querySelector('[data-in="name"]'); inp.value = 'Jobb'; inp.dispatchEvent(new Event('input', { bubbles: true })); await w(20);
    addB().click(); await w(120);
    const after = [...box.querySelectorAll('.plist .pr .rl')].map((e) => e.textContent);
    return { cap, clip, dis0, byName, byId, byPart, none, noneTxt, all, cdTxt, mono, idSize, hasIcon, dimmed, nm, dis1, addBg, after, scroll: getComputedStyle(sh).overflowY };
  });
  ok('27.8 «Steder · hold og dra for rekkefølge», listen klippes aldri (flex: none), «Legg til sted» synlig', S.cap.includes('Steder · hold og dra for rekkefølge') && S.clip.flex === '0' && S.clip.sh <= S.clip.ch + 1 && S.clip.addVis && S.scroll === 'auto', S);
  ok('27.4 søk filtrerer weather.* på navn og ID (case-insensitive, live), «Ingen treff»', S.byName.join() === 'weather.oslo_sentrum' && S.byId.join() === 'weather.oslo_sentrum' && S.byPart.join() === 'weather.hytta#' && !S.none.length && S.noneTxt === 'Ingen treff' && S.all.length === 3, S);
  ok('27.4 treff: ikon, navn + ID (mono 11 px) og temp nå; allerede lagt til er dimmet og ikke valgbare', S.hasIcon && /Jobb Oslo/.test(S.cdTxt) && /weather\.oslo_sentrum/.test(S.cdTxt) && /9°/.test(S.cdTxt) && /monospace/.test(S.mono) && S.idSize === '11px' && Number(S.dimmed) < 0.6 && S.all.includes('weather.home#') && S.all.includes('weather.hytta#'), S);
  ok('27.4 navn fylles med friendly_name, «Legg til» aktiv først med entitet + navn', S.dis0 && S.nm === 'Jobb Oslo' && !S.dis1 && /gradient/.test(S.addBg) && S.after.join('|') === 'Hjem|Hytta|Jobb', S);

  // 27.8 · dra og slipp: Hytta (rad 2) dras øverst → rekkefølgen lagres i places, valgt sted (Hytta) beholdes
  const Dg = await p.evaluate(async () => {
    const w = (ms) => new Promise((q) => setTimeout(q, ms));
    const c = window.__c, R = c._sheet.ov.root, box = R.querySelector('.vaer-sheet');
    const rows = () => [...box.querySelectorAll('.plist [data-prow]')];
    const hd = rows()[1].querySelector('[data-drag]'), ta = getComputedStyle(hd).touchAction, r0 = rows()[0].getBoundingClientRect(), hr = hd.getBoundingClientRect();
    const o = (y) => ({ bubbles: true, composed: true, cancelable: true, clientX: hr.left + 10, clientY: y, pointerId: 21, pointerType: 'touch', isPrimary: true, button: 0 });
    let bubbled = false; const spy = () => { bubbled = true; }; window.__pop.addEventListener('pointerdown', spy);
    hd.dispatchEvent(new PointerEvent('pointerdown', o(hr.top + 10))); await w(30);
    const lifted = rows()[1].classList.contains('drag');
    window.dispatchEvent(new PointerEvent('pointermove', o(r0.top + 5))); await w(30);
    const live = rows().map((e) => e.querySelector('.rl').textContent);
    window.dispatchEvent(new PointerEvent('pointerup', o(r0.top + 5))); await w(120);
    window.__pop.removeEventListener('pointerdown', spy);
    const draft = c._sheet.box._config.places.map((x) => x.name), sel = c.ui.place;
    R.querySelector('[data-a="done"]').click(); await w(900);
    const ctl = window.__c.shadowRoot.querySelector('.ctl-slot > .msh-vaer-ctl').shadowRoot;
    ctl.querySelector('.pl').click(); await w(60);
    const menu = [...ctl.querySelectorAll('.mi .mnm')].map((e) => e.textContent), on = ctl.querySelector('.mi.on .mnm').textContent, lab = ctl.querySelector('.pl .pn').textContent;
    ctl.querySelector('[data-a="close"]').click();
    return { ta, lifted, live, draft, sel, saved: (c._rawConfig.places || []).map((x) => x.name), menu, on, lab, bubbled };
  });
  ok('27.8 håndtak: touch-action none, stopPropagation, løft + live omorganisering', Dg.ta === 'none' && !Dg.bubbled && Dg.lifted && Dg.live.join('|') === 'Hytta|Hjem|Jobb', Dg);
  ok('27.8 rekkefølgen lagres i places; stedsvelgeren følger rekkefølgen og valgt sted beholdes', Dg.draft.join('|') === 'Hytta|Hjem|Jobb' && Dg.saved.join('|') === 'Hytta|Hjem|Jobb' && Dg.sel === 0 && Dg.menu.join('|') === 'Hytta|Hjem|Jobb' && Dg.on === 'Hytta' && Dg.lab === 'Hytta', Dg);
  if (shots) await p.screenshot({ path: `${shots}/vaer27-tilpass.png` });

  // 27.4 · GUI-editoren: ha-selector {entity: {domain: 'weather'}} per sted + «Legg til sted» (stub av ha-selector)
  const G = await p.evaluate(async () => {
    const w = (ms) => new Promise((q) => setTimeout(q, ms));
    if (!customElements.get('ha-selector')) customElements.define('ha-selector', class extends HTMLElement {});
    const ed = customElements.get('msh-vaer-card').getConfigElement();
    document.body.appendChild(ed);
    ed.hass = window.__h; ed.setConfig({ type: 'custom:msh-vaer-card', card_id: 'gui-vaer27', places: [{ name: 'Hjem', entity: 'weather.home' }] });
    let last = null; ed.addEventListener('config-changed', (e) => { last = e.detail.config; });
    await w(200);
    const R = ed.shadowRoot, s0 = R.querySelector('ha-selector[data-name="places.0.entity"]'), add = R.querySelector('ha-selector[data-vpadd]');
    const sel0 = s0 && s0.selector, val0 = s0 && s0.value;
    add.dispatchEvent(new CustomEvent('value-changed', { detail: { value: 'weather.hytta' }, bubbles: true, composed: true })); await w(80);
    const p1 = last && last.places;
    const s1 = R.querySelector('ha-selector[data-name="places.1.entity"]');
    s1.dispatchEvent(new CustomEvent('value-changed', { detail: { value: 'weather.oslo_sentrum' }, bubbles: true, composed: true })); await w(80);
    const p2 = last && last.places;
    R.querySelector('[data-op="up"][data-i="1"]').click(); await w(80);
    const p3 = last && last.places;
    ed.remove();
    return { sel0, val0, p1, p2, p3 };
  });
  ok('27.4 GUI: ha-selector {entity:{domain:weather}} per sted, «Legg til sted», bytte entitet, ↑/↓ – lagres i places [{name, entity}]', G.sel0 && G.sel0.entity && G.sel0.entity.domain === 'weather' && G.val0 === 'weather.home' && G.p1 && G.p1.map((x) => x.entity).join() === 'weather.home,weather.hytta' && G.p1[1].name === 'Hytta' && G.p2[1].entity === 'weather.oslo_sentrum' && G.p3.map((x) => x.entity).join() === 'weather.oslo_sentrum,weather.home', G);
  await p.close();
}

ok('ingen sidefeil', !errs.length, errs);
await b.close();
console.log(JSON.stringify(res, null, 1));
if (fail.length) { console.error('FEIL:', fail.join(' · ')); process.exit(1); }
console.log('Alle Vær 27-sjekker OK');
