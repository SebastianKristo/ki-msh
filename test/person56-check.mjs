// Fiks 56 F · Flimmer når person-popupene (person-hurtigarket fra avatarene øverst på Hjem) åpnes og lukkes.
// Hele det strategi-genererte dashbordet mot ekte Bubble Card (harness-bubble), 390×844 touch, CPU-struping ×6 (P56_THROTTLE),
// Android-UA (ki-android) og standard-UA, mørk og lys modus. Avatarene får ekte bilder (blob-URL, samme src på Hjem og i
// kortet). Hver person-popup åpnes og lukkes 5 ganger (P56_N); rAF-sampler i hver ramme:
//  F1 · Android: kortet har opasitet 1 i hver tegnet ramme (bare transform). Standard-UA: ingen ramme med kortet
//       halvgjennomsiktig (0,02–0,98) senere enn 60 ms etter start (opasitet bare de første / siste 60 ms)
//  F2 · kortflaten er helt dekkende (alfa 1; mørk #3a3a3a, lys #fff), ingen backdrop-filter på kortet på Android
//  F3 · avataren er en del av kortet (img inni .sh, ingen andre bilder i overlegget), bildet er dekodet i første tegnede
//       ramme (eller kortet ventet ≥ 80 ms), <img decoding="async"> med samme src som på Hjem
//  F4 · bakteppet og kortet starter i samme ramme (åpning og lukking), bakteppet bare opasitet (ingen blur), 180 ms
//  F5 · lukking: verten fjernes først etter transitionend (kortets transform), ikke midt i animasjonen
//  F6 · navbar og «Spilles nå»: samme noder, synlige i hver ramme, ikke dimmet (hull i bakteppet; piksel-sjekk)
//  F7 · 0 tegninger av msh-hjem-card / faner / prosa / header ved åpning og lukking
//  F8 · samme oppskrift for bekreftelsesdialogen (MSH.serverConfirm)
// Kjør: node test/person56-check.mjs   (P56_BUNDLE=<fil> måler en ferdig bundel · P56_OUT=<json> · P56_N=5)
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { readdirSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from 'node:fs';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const R = resolve('.') + '/';
mkdirSync('test/.build', { recursive: true });
mkdirSync('test/.vendor', { recursive: true });
const BC = resolve('test/.vendor/bubble-card.js');
if (!existsSync(BC)) execFileSync('curl', ['-sSL', '-o', BC, 'https://raw.githubusercontent.com/Clooos/Bubble-Card/main/dist/bubble-card.js']);
const own = !process.env.P56_BUNDLE;
const bundle = own ? resolve(`test/.build/p56f-${process.pid}.js`) : resolve(process.env.P56_BUNDLE);
if (own) execFileSync('node', ['build.mjs', bundle], { cwd: R, stdio: 'inherit' });
const THROTTLE = Number(process.env.P56_THROTTLE || 6);
const N = Number(process.env.P56_N || 5);
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 13; Pixel 6a) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';
const HJEM = ['msh-hjem-card', 'msh-hjem-faner-card', 'msh-prosa-card', 'msh-hjem-header-card'];
const mocks = readdirSync(R + 'test/mock').filter((f) => f.endsWith('.js')).sort().map((f) => R + 'test/mock/' + f);
const browser = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => pw.chromium.launch());

async function setup(ua, dark) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, ...(ua ? { userAgent: ua } : {}) });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('file://' + R + 'test/harness-bubble.html');
  for (const m of mocks) await page.addScriptTag({ path: m });
  await page.addScriptTag({ path: bundle });
  await page.addScriptTag({ path: BC, type: 'module' });
  await page.waitForFunction(() => customElements.get('bubble-card'), null, { timeout: 30000 });
  await page.evaluate(async ([HJEM, dark]) => {
    // ekte profilbilder (600×600 jpeg som blob-URL – lastes og dekodes som et vanlig bilde)
    const pic = (c1, c2) => new Promise((res) => { const cv = document.createElement('canvas'); cv.width = cv.height = 600; const g = cv.getContext('2d'); const gr = g.createLinearGradient(0, 0, 600, 600); gr.addColorStop(0, c1); gr.addColorStop(1, c2); g.fillStyle = gr; g.fillRect(0, 0, 600, 600); for (let i = 0; i < 400; i++) { g.fillStyle = `hsl(${(i * 37) % 360} 60% 60% / .5)`; g.beginPath(); g.arc((i * 97) % 600, (i * 53) % 600, 8 + (i % 30), 0, 7); g.fill(); } cv.toBlob((b) => res(URL.createObjectURL(b)), 'image/jpeg', 0.9); });
    const P1 = await pic('#c86', '#468'), P2 = await pic('#6a8', '#a46');
    const hass = window.mockHass();
    hass.themes = { ...(hass.themes || {}), darkMode: dark };
    for (const [id, u] of [['person.sebastian', P1], ['person.rune', P2]]) if (hass.states[id]) hass.states[id] = { ...hass.states[id], attributes: { ...hass.states[id].attributes, entity_picture: u } };
    window.__H = hass;
    const S = customElements.get('ll-strategy-dashboard-ki-dashboard');
    const dash = await S.generate({}, hass);
    const stack = dash.views[0].cards[0];
    const root = document.getElementById('dash');
    for (const c of stack.cards) { const el = document.createElement(c.type.replace('custom:', '')); el.setConfig(c); el.hass = hass; root.appendChild(el); }
    if (!dark) document.body.style.background = '#e6e6e6';
    const deepQ = (r, sel, out = []) => { r.querySelectorAll(sel).forEach((e) => out.push(e)); r.querySelectorAll('*').forEach((e) => { if (e.shadowRoot) deepQ(e.shadowRoot, sel, out); }); return out; };
    window.__deepQ = deepQ;
    window.__rc = {};
    for (const tag of HJEM) {
      const C = customElements.get(tag); if (!C) continue;
      const o = C.prototype.render;
      C.prototype.render = function () { const A = window.__P56; if (A && A.live) A.renders[tag] = (A.renders[tag] || 0) + 1; return o.apply(this, arguments); };
    }
    window.__portal = () => { const nb = document.querySelector('msh-navbar-card'); return nb && nb._portal; };
    window.__hdr = () => deepQ(document, 'msh-hjem-header-card')[0];
    window.__faces = () => { const h = window.__hdr(); return h ? [...h.shadowRoot.querySelectorAll('.face[data-act="person"]:not(.more)')] : []; };
    window.__ovs = () => [...window.MSH.overlayRoot().querySelectorAll(':scope > .msh-portal')].filter((h) => h.shadowRoot && h.shadowRoot.querySelector('.sh'));
    await new Promise((r) => setTimeout(r, 2500));
  }, [HJEM, dark]);
  // vent til bildene på Hjem er lastet
  await page.waitForFunction(() => { const f = window.__faces(); const im = f.flatMap((x) => [...x.querySelectorAll('img')]); return im.length >= 1 && im.every((i) => i.complete && i.naturalWidth > 0); }, null, { timeout: 15000 }).catch(() => {});
  const cdp = await ctx.newCDPSession(page);
  return { ctx, page, cdp, errs };
}

// Én måling: act = 'open' (trykk på avatar i) | 'close' (Ferdig) | 'copen' / 'cclose' (bekreftelsesdialogen)
async function measure(page, act, i, dur) {
  return page.evaluate(async ([act, i, dur]) => {
    const M = window.MSH, P = window.__portal(), psr = P && P.shadowRoot;
    const REF = { nav: psr && psr.querySelector('nav.nb'), mini: psr && psr.querySelector('[data-mini]') };
    const A = (window.__P56 = { t0: performance.now(), live: true, renders: {}, frames: [], ev: [] });
    const slot = M.overlayRoot();
    let host = act === 'close' || act === 'cclose' ? window.__ovs().pop() : null;
    let removedAt = null, tEnd = null;
    const mo = new MutationObserver((ml) => { for (const m of ml) for (const n of m.removedNodes) if (n === host) removedAt = performance.now() - A.t0; });
    mo.observe(slot, { childList: true });
    const bindEnd = (h) => { const sh = h.shadowRoot.querySelector('.sh'); sh.addEventListener('transitionend', (e) => { if (e.target === sh) A.ev.push([e.propertyName, Math.round(performance.now() - A.t0)]); if (e.target === sh && e.propertyName === 'transform' && tEnd == null) tEnd = performance.now() - A.t0; }); };
    if (host) bindEnd(host);
    const vis = (el) => { if (!el || !el.isConnected) return 'frakoblet'; const cs = getComputedStyle(el); if (cs.display === 'none') return 'display:none'; if (cs.visibility !== 'visible') return 'visibility'; if (Number(cs.opacity) < 0.99) return 'opacity ' + cs.opacity; const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return 'størrelse 0'; return ''; };
    const scaleOf = (tf) => { const m = /matrix\(([^)]+)\)/.exec(tf || ''); return m ? Math.hypot(...m[1].split(',').slice(0, 2).map(Number)) : 1; };
    const done = new Promise((res) => {
      const tick = () => {
        const t = performance.now() - A.t0;
        const f = { t: Math.round(t) };
        const nav = psr && psr.querySelector('nav.nb'), mini = psr && psr.querySelector('[data-mini]');
        f.same = !P || (nav === REF.nav && mini === REF.mini && P.isConnected);
        f.nav = REF.nav ? vis(nav) : ''; f.mini = REF.mini ? vis(mini) : '';
        if (!host && (act === 'open' || act === 'copen')) { host = window.__ovs().pop() || null; if (host) bindEnd(host); }
        if (host && host.isConnected) {
          const sr = host.shadowRoot, sh = sr.querySelector('.sh'), bg = sr.querySelector('.bg');
          const hc = getComputedStyle(host), sc = getComputedStyle(sh), bc = getComputedStyle(bg);
          f.conn = true; f.painted = hc.visibility === 'visible';
          f.op = Number(sc.opacity); f.sc = +scaleOf(sc.transform).toFixed(4); f.tf = sc.transform;
          f.bg = Number(bc.opacity); f.bgBlur = bc.backdropFilter;
          const bb = getComputedStyle(bg, '::before');
          f.clip = bb.clipPath && bb.clipPath !== 'none' ? 1 : 0;
          f.bgBefore = bb.backgroundColor;
          f.shBg = sc.backgroundColor; f.shBdf = sc.backdropFilter;
          const oa = sh.getAnimations().find((a) => a.transitionProperty === 'opacity');
          f.opT = oa ? Math.round(oa.currentTime) : null;
          const ta = sh.getAnimations().find((a) => a.transitionProperty === 'transform'), ba = bg.getAnimations().find((a) => a.transitionProperty === 'opacity');
          f.tT = ta ? Math.round(ta.currentTime) : null; f.bT = ba ? Math.round(ba.currentTime) : null;
          const imgs = [...sr.querySelectorAll('img')];
          f.imgs = imgs.length; f.imgOut = imgs.filter((im) => !sh.contains(im)).length;
          const im = sh.querySelector('.orb img');
          f.img = im ? (im.complete && im.naturalWidth > 0 ? 'ok' : 'venter') : '';
          f.imgDec = im ? im.getAttribute('decoding') : '';
          f.imgSrc = im ? im.getAttribute('src') : '';
          f.cls = host.className;
        } else f.conn = false;
        A.frames.push(f);
        if (t < dur) requestAnimationFrame(tick); else res();
      };
      requestAnimationFrame(tick);
    });
    if (act === 'open') window.__faces()[i].click();
    else if (act === 'close') { const b = host && host.shadowRoot.querySelector('[data-a="close"]'); if (b) b.click(); }
    else if (act === 'copen') { window.__cf = M.serverConfirm('Vil du starte serveren på nytt?', { ok: 'Start på nytt' }); }
    else if (act === 'cclose') { const b = host && host.shadowRoot.querySelector('[data-c="0"]'); if (b) b.click(); }
    await done;
    A.live = false; mo.disconnect();
    const hjemSrc = window.__faces().map((x) => { const im = x.querySelector('img'); return im ? im.getAttribute('src') : ''; });
    return { act, i, renders: A.renders, frames: A.frames, removedAt: removedAt == null ? null : Math.round(removedAt), tEnd: tEnd == null ? null : Math.round(tEnd), ev: A.ev, hjemSrc };
  }, [act, i, dur]);
}

const FX = { ms: 180, op: 60 };
function analyse(r, and, dark) {
  const F = r.frames, bad = [];
  const P = F.filter((f) => f.conn && f.painted);
  // F6: navbar/mini
  F.forEach((f) => { if (!f.same) bad.push(['F6 navbar/mini-node byttet', f.t]); if (f.nav) bad.push(['F6 navbar ' + f.nav, f.t]); if (f.mini) bad.push(['F6 mini ' + f.mini, f.t]); });
  // F7
  const hj = HJEM.reduce((a, k) => a + (r.renders[k] || 0), 0);
  if (hj) bad.push(['F7 Hjem tegnet ' + JSON.stringify(r.renders), 0]);
  if (!P.length) { bad.push(['ingen tegnet ramme med kortet', 0]); return bad; }
  // F1
  P.forEach((f) => {
    if (and && f.op < 0.999) bad.push([`F1 Android: kortet opasitet ${f.op.toFixed(2)}`, f.t]);
  });
  const open = r.act === 'open' || r.act === 'copen';
  // opasitet bare de første 60 ms (åpning) / de siste 60 ms (lukking: 120 ms forsinkelse + 60 ms)
  if (!and) P.forEach((f) => { if (f.op > 0.02 && f.op < 0.98 && f.opT != null && (open ? f.opT > FX.op + 1 : f.opT < FX.ms - FX.op - 1)) bad.push([`F1 halvgjennomsiktig ved ${f.opT} ms i overgangen (opasitet ${f.op.toFixed(2)})`, f.t]); });
  // tidsvindu: halvgjennomsiktige rammer (standard-UA) må ligge innenfor 60 ms (+ én ramme ved struping) fra start/slutt
  if (!and) {
    const part = P.filter((f) => f.op > 0.02 && f.op < 0.98);
    if (part.length) {
      const t0 = open ? P[0].t : part[0].t, t1 = part[part.length - 1].t;
      if (open && t1 - t0 > FX.op + 40) bad.push([`F1 halvgjennomsiktig i ${t1 - t0} ms etter første ramme`, t1]);
      if (!open && r.removedAt != null && r.removedAt - part[0].t > FX.op + 40 + 40) bad.push([`F1 halvgjennomsiktig ${r.removedAt - part[0].t} ms før fjerning`, part[0].t]);
    }
  }
  // F2: flaten
  P.forEach((f) => {
    const m = /rgba?\(([^)]+)\)/.exec(f.shBg || ''); const a = m ? m[1].split(',').map((x) => x.trim()) : [];
    const al = a.length === 4 ? Number(a[3]) : 1;
    if (al < 0.999) bad.push([`F2 kortflaten ikke dekkende ${f.shBg}`, f.t]);
    if (and && f.shBdf && f.shBdf !== 'none') bad.push([`F2 backdrop-filter på kortet (Android) ${f.shBdf}`, f.t]);
    if (f.bgBlur && f.bgBlur !== 'none') bad.push([`F4 blur på bakteppet ${f.bgBlur}`, f.t]);
  });
  if (r.act === 'open' || r.act === 'close') {
    const want = dark ? 'rgb(58, 58, 58)' : 'rgb(255, 255, 255)';
    if (P[0].shBg !== want) bad.push([`F2 kortflate ${P[0].shBg} ≠ ${want}`, 0]);
  }
  // F3: avatar
  if (r.act === 'open') {
    P.forEach((f) => { if (f.imgOut) bad.push(['F3 bilde utenfor kortet', f.t]); });
    const f0 = P[0];
    if (f0.imgs && f0.img !== 'ok' && f0.t < 80) bad.push(['F3 kortet vist før bildet er dekodet (< 80 ms)', f0.t]);
    if (f0.imgs && f0.imgDec !== 'async') bad.push(['F3 <img> uten decoding="async"', 0]);
    if (f0.imgSrc && !r.hjemSrc.includes(f0.imgSrc)) bad.push(['F3 annen src enn på Hjem', 0]);
  }
  // F4: bakteppets opasitet og kortets transform starter i samme ramme (første ramme med overgangen) og går i takt
  // (samme currentTime i hver ramme) – åpning og lukking
  {
    const C = F.filter((f) => f.conn);
    const iT = C.findIndex((f) => f.tT != null), iB = C.findIndex((f) => f.bT != null);
    const w = open ? 'åpning' : 'lukking';
    if (iT < 0 || iB < 0) bad.push([`F4 ${w}: overgang mangler (kort ${iT}, bakteppe ${iB})`, 0]);
    else if (iT !== iB) bad.push([`F4 ${w}: bakteppet (${C[iB].t} ms) og kortet (${C[iT].t} ms) starter ikke i samme ramme`, 0]);
    C.forEach((f) => { if (f.tT != null && f.bT != null && Math.abs(f.tT - f.bT) > 1) bad.push([`F4 ${w}: ute av takt (kort ${f.tT} / bakteppe ${f.bT} ms)`, f.t]); });
    // kortet har beveget seg mens bakteppet ennå ikke er dimmet (åpning)
    if (open) { const lone = P.filter((f) => f.op > 0.02 && f.bg < 0.001 && f.sc > FX0.sc + 0.002); if (lone.length) bad.push([`F4 kortet i bevegelse uten dimming i ${lone.length} ramme(r)`, lone[0].t]); }
  }
  if (open) {
    // dimming uten hull over navbaren
    if (F.some((f) => f.conn && f.bg > 0.01 && !f.clip) && r.hasNav) bad.push(['F6 bakteppet uten hull over navbaren', 0]);
  } else {
    const C = F.filter((f) => f.conn);
    // F5
    if (r.removedAt == null) bad.push(['F5 verten ble aldri fjernet', 0]);
    else if (r.tEnd == null) bad.push([`F5 fjernet uten transitionend (${r.removedAt} ms)`, r.removedAt]);
    else if (r.removedAt + 1 < r.tEnd) bad.push([`F5 fjernet (${r.removedAt}) før transitionend (${r.tEnd})`, r.removedAt]);
    else if (r.ev && !r.ev.some((e) => e[0] === 'transform')) bad.push(['F5 ingen transitionend for transform', 0]);
    if (C.length && C.length === F.length) bad.push(['F5 ikke fjernet innen målevinduet', 0]);
  }
  return bad;
}
const FX0 = { sc: 0.94 };

// Piksel-sjekk: navbaren og mini-spilleren er like før og med arket åpent (ikke dimmet)
async function navPix(page) {
  const rects = await page.evaluate(() => { const P = window.__portal(), sr = P && P.shadowRoot; return ['nav.nb', '[data-mini]'].map((s) => { const e = sr && sr.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.left + 12), y: Math.round(r.top + 8), width: Math.max(4, Math.round(r.width - 24)), height: Math.max(4, Math.round(r.height - 16)) }; }).filter(Boolean); });
  const shots = [];
  for (const c of rects) shots.push(await page.screenshot({ clip: c }));
  return { rects, shots };
}
async function pixDiff(page, a, b) {
  return page.evaluate(async ([a, b]) => {
    const load = (b64) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.src = 'data:image/png;base64,' + b64; });
    const px = async (b64) => { const im = await load(b64); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0); return g.getImageData(0, 0, c.width, c.height).data; };
    const A = await px(a), B = await px(b);
    let s = 0, n = 0;
    for (let k = 0; k < Math.min(A.length, B.length); k += 4) { s += Math.abs(A[k] - B[k]) + Math.abs(A[k + 1] - B[k + 1]) + Math.abs(A[k + 2] - B[k + 2]); n += 3; }
    return n ? s / n : 0;
  }, [a.toString('base64'), b.toString('base64')]);
}

const out = { runs: [], summary: [] };
let fails = 0;
for (const [uaName, ua] of [['android', ANDROID_UA], ['standard', null]]) {
  for (const dark of [true, false]) {
    const tag = `${uaName}/${dark ? 'mørk' : 'lys'}`;
    const S = await setup(ua, dark);
    const info = await S.page.evaluate(() => ({ faces: window.__faces().length, and: document.documentElement.classList.contains('ki-android'), nav: !!(window.__portal() && window.__portal().shadowRoot.querySelector('nav.nb')), mini: !!(window.__portal() && window.__portal().shadowRoot.querySelector('[data-mini]')) }));
    const bad = [];
    if (!info.faces) bad.push(['ingen personbilder på Hjem', 0]);
    if (info.and !== (uaName === 'android')) bad.push([`ki-android ${info.and}`, 0]);
    // piksel-sjekk før åpning
    const pix0 = await navPix(S.page);
    await S.cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
    for (let i = 0; i < info.faces; i++) {
      for (let k = 0; k < N; k++) {
        const op = await measure(S.page, 'open', i, 650);
        op.hasNav = info.nav;
        const b1 = analyse(op, uaName === 'android', dark);
        if (k === 0) {
          await S.cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
          const pix1 = await navPix(S.page);
          for (let q = 0; q < Math.min(pix0.shots.length, pix1.shots.length); q++) { const d = await pixDiff(S.page, pix0.shots[q], pix1.shots[q]); if (d > 3) b1.push([`F6 ${q ? 'mini-spilleren' : 'navbaren'} dimmet (snitt-avvik ${d.toFixed(1)})`, 0]); }
          await S.cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
        }
        await S.page.waitForTimeout(150);
        const cl = await measure(S.page, 'close', i, 650);
        const b2 = analyse(cl, uaName === 'android', dark);
        out.runs.push({ tag, i, k, open: { bad: b1, frames: op.frames.length, removedAt: op.removedAt }, close: { bad: b2, removedAt: cl.removedAt, tEnd: cl.tEnd, ev: cl.ev } });
        for (const [m, t] of b1) bad.push([`person ${i} #${k + 1} åpne: ${m}`, t]);
        for (const [m, t] of b2) bad.push([`person ${i} #${k + 1} lukke: ${m}`, t]);
        await S.page.waitForTimeout(150);
      }
    }
    // F8: bekreftelsesdialogen (2×)
    for (let k = 0; k < 2; k++) {
      const op = await measure(S.page, 'copen', 0, 600);
      op.hasNav = info.nav;
      const cl = await measure(S.page, 'cclose', 0, 600);
      for (const [m, t] of analyse(op, uaName === 'android', dark)) bad.push([`bekreftelse #${k + 1} åpne: ${m}`, t]);
      for (const [m, t] of analyse(cl, uaName === 'android', dark)) bad.push([`bekreftelse #${k + 1} lukke: ${m}`, t]);
      await S.page.waitForTimeout(150);
    }
    await S.cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    const left = await S.page.evaluate(() => window.__ovs().length);
    if (left) bad.push([`${left} overlegg igjen i DOM-en`, 0]);
    if (S.errs.length) bad.push(['sidefeil: ' + S.errs.slice(0, 3).join(' | '), 0]);
    const uniq = [...new Map(bad.map((b) => [b[0].replace(/#\d+/, '#n').replace(/\d+(\.\d+)? ?ms/g, 'x ms'), b])).values()];
    out.summary.push({ tag, info, fails: bad.length, bad: uniq.slice(0, 30) });
    console.log(`${bad.length ? '✘' : '✔'} ${tag}: ${info.faces} personer × ${N} åpne/lukke + bekreftelse · ${bad.length} avvik`);
    uniq.slice(0, 12).forEach(([m, t]) => console.log(`   ✘ ${m}${t ? ' @' + t + ' ms' : ''}`));
    fails += bad.length;
    await S.ctx.close();
  }
}
await browser.close();
if (process.env.P56_OUT) writeFileSync(process.env.P56_OUT, JSON.stringify(out, null, 1));
if (own) try { unlinkSync(bundle); } catch (e) { /* */ }
console.log(fails ? `person56-check: ${fails} avvik` : 'person56-check: OK');
process.exit(fails ? 1 : 0);
