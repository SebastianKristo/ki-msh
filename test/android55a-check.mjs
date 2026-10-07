// Fiks 55 A · Android-flimmer når popups åpnes og lukkes (opptak 12,3 s fra HA-appen: Strøm → Strømregning → tilbake → lukk,
// Sir Sweeps, Vær, Tesla og Server). Hele det strategi-genererte dashbordet mot ekte Bubble Card, Android-UA (Pixel 6a),
// 390×844 touch, CPU-struping ×6 (A55_THROTTLE), Ytelsesmodus Auto (A55_PERF=full|lite|auto). Hver popup åpnes og lukkes
// to ganger (første = kald bygging, andre = gjenåpning); rAF-sampler i hver ramme:
//  A1 · navbar og mini-spiller: samme noder hele tiden (aldri flyttet/byttet), tilkoblet, display/visibility/opasitet 1 og
//       øverst i sitt punkt (over Bubbles bakteppe) i HVER ramme – unntak: #vaer (Fiks 28.4) får tone ut først når
//       popupen har satt seg, og er synlig igjen fra første ramme ved lukking
//  A2 · 0 tegninger av msh-hjem-card / hjem-faner / prosa / header ved åpning og lukking; prosa-pillene har samme tekst,
//       bakgrunn og farge i hver ramme etter lukking; ingen (ikke-uendelige) opasitet-animasjoner i Hjem-kortene
//  A3 · Strøm → Strømregning → tilbake: hovedvisningen er samme node (ingen ny bygging), flisene har opasitet 1 i hver
//       ramme, ingen opasitet-animasjon på fliser (Android)
//  A4 · glidingen er bare transform (translateY); ingen hopp > 1/4 popup-høyde mellom to rammer; bakteppet er ikke dimmet
//       før popupen har is-opening (dim og gliding starter i samme ramme); popupens kort tegnes ikke under glidingen ved
//       gjenåpning (MSH.whenPopupSettled) – lange oppgaver i glidevinduet rapporteres; «Blur i popups på Android»
//       (ki-store popup_android_blur): av (standard) → ingen blur, på → blur når popupen står stille, 0 mens den glir
//  Standard-UA: ingen Android-regler (ingen ki-hold, ingen Strøm-Android-CSS), Vær-navbaren som før.
// Kjør: node test/android55a-check.mjs   (A55_BUNDLE=<fil> måler en ferdig bundel uten krav · A55_OUT=<json> · A55_DEBUG=1)
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
const own = !process.env.A55_BUNDLE;
const bundle = own ? resolve(`test/.build/and55-${process.pid}.js`) : resolve(process.env.A55_BUNDLE);
if (own) execFileSync('node', ['build.mjs', bundle], { cwd: R, stdio: 'inherit' });
const THROTTLE = Number(process.env.A55_THROTTLE || 6);
const PERF = process.env.A55_PERF || 'auto';
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 13; Pixel 6a) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';
const TARGETS = [['#strom', 'msh-strom-card'], ['#rolf', 'msh-stovsuger-card'], ['#vaer', 'msh-vaer-card'], ['#tesla', 'msh-tesla-card'], ['#server', 'msh-server-card']];
const HJEM = ['msh-hjem-card', 'msh-hjem-faner-card', 'msh-prosa-card', 'msh-hjem-header-card'];
const mocks = readdirSync(R + 'test/mock').filter((f) => f.endsWith('.js')).sort().map((f) => R + 'test/mock/' + f);
const browser = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => pw.chromium.launch());

const INIT = () => {
  window.__lt = [];
  try { new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__lt.push([e.startTime, e.duration]))).observe({ type: 'longtask', buffered: true }); } catch (e) { /* */ }
};

async function setup(ua) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, ...(ua ? { userAgent: ua } : {}) });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.addInitScript(INIT);
  await page.addInitScript((v) => { try { if (v === 'auto') localStorage.removeItem('ki-perf'); else localStorage.setItem('ki-perf', v); } catch (e) { /* */ } }, PERF);
  await page.goto('file://' + R + 'test/harness-bubble.html');
  for (const m of mocks) await page.addScriptTag({ path: m });
  await page.addScriptTag({ path: bundle });
  await page.addScriptTag({ path: BC, type: 'module' });
  await page.waitForFunction(() => customElements.get('bubble-card'), null, { timeout: 30000 });
  await page.evaluate(async ([HJEM, TARGETS]) => {
    const M = window.MSH;
    const hass = window.mockHass();
    window.__H = hass;
    const S = customElements.get('ll-strategy-dashboard-ki-dashboard');
    const dash = await S.generate({}, hass);
    const stack = dash.views[0].cards[0];
    const root = document.getElementById('dash');
    for (const c of stack.cards) { const el = document.createElement(c.type.replace('custom:', '')); el.setConfig(c); el.hass = hass; root.appendChild(el); }
    // render()-telling (faktiske tegninger) for Hjem-kortene og popup-kortene
    window.__rc = {};
    const watch = [...HJEM, ...TARGETS.map((t) => t[1])];
    for (const tag of watch) {
      const C = customElements.get(tag); if (!C) continue;
      const o = C.prototype.render;
      C.prototype.render = function () { const A = window.__A55; if (A && A.live) { A.renders[tag] = (A.renders[tag] || 0) + 1; A.rlog.push([tag, Math.round(performance.now() - A.t0), A.dbg ? (new Error().stack || '').split('\n').slice(2, 8).join(' | ') : '']); } window.__rc[tag] = (window.__rc[tag] || 0) + 1; return o.apply(this, arguments); };
    }
    window.__portal = () => { const nb = document.querySelector('msh-navbar-card'); return nb && nb._portal; };
    window.__bc = (hash) => [...root.querySelectorAll('bubble-card')].find((b) => (b.config || b._config || {}).hash === hash);
    window.__pop = (hash) => { const b = window.__bc(hash); return b && b.shadowRoot && b.shadowRoot.querySelector('.bubble-pop-up'); };
    window.__bd = () => { const h = document.querySelector('body > .bubble-backdrop-host'); return h && h.shadowRoot && h.shadowRoot.querySelector('.bubble-backdrop'); };
    const deepQ = (r, sel, out = []) => { r.querySelectorAll(sel).forEach((e) => out.push(e)); r.querySelectorAll('*').forEach((e) => { if (e.shadowRoot) deepQ(e.shadowRoot, sel, out); }); return out; };
    window.__deepQ = deepQ;
    window.__hjemCards = () => HJEM.flatMap((t) => deepQ(document, t));
    window.__chips = () => { const p = deepQ(document, 'msh-prosa-card')[0]; return p ? [...p.shadowRoot.querySelectorAll('.pz .chip')] : []; };
    window.__chipSnap = () => window.__chips().map((c) => { const cs = getComputedStyle(c); return `${c.textContent.trim()}|${cs.backgroundColor}|${cs.color}|${cs.opacity}|${cs.visibility}`; }).join(' ¦ ');
    // Løpende, ikke-uendelige animasjoner med opasitet i en shadow root (inn-toning)
    window.__opAnims = (roots) => {
      const out = [];
      for (const r of roots) {
        let L = []; try { L = r.getAnimations(); } catch (e) { /* */ }
        for (const a of L) {
          if (a.playState !== 'running' || !a.effect) continue;
          const t = a.effect.getComputedTiming ? a.effect.getComputedTiming() : {};
          if (t.iterations === Infinity) continue;
          let kf = []; try { kf = a.effect.getKeyframes(); } catch (e) { /* */ }
          if (kf.some((k) => 'opacity' in k) || a.transitionProperty === 'opacity') out.push(`${a.effect.target && a.effect.target.className}:${a.animationName || a.transitionProperty}`);
        }
      }
      return out;
    };
    await new Promise((r) => setTimeout(r, 2500));
  }, [HJEM, TARGETS]);
  const cdp = await ctx.newCDPSession(page);
  return { ctx, page, cdp, errs };
}

// Én måling: act = 'open' | 'close' | 'back' (Strøm: underside → tilbake)
async function measure(page, act, hash, card, dur) {
  return page.evaluate(async ([act, hash, card, dur, dbg]) => {
    const M = window.MSH, P = window.__portal(), sr = P && P.shadowRoot;
    const REF = { nav: sr && sr.querySelector('nav.nb'), mini: sr && sr.querySelector('[data-mini]') };
    const A = (window.__A55 = { t0: performance.now(), live: true, renders: {}, rlog: [], dbg, frames: [] });
    const chip0 = window.__chipSnap();
    const hjemRoots = () => window.__hjemCards().map((c) => c.shadowRoot).filter(Boolean);
    const strom = window.__deepQ(document, 'msh-strom-card')[0];
    const mainv0 = strom && strom.shadowRoot.querySelector('.mainv');
    const vis = (el) => { if (!el || !el.isConnected) return 'frakoblet'; const cs = getComputedStyle(el); if (cs.display === 'none') return 'display:none'; if (cs.visibility !== 'visible') return 'visibility'; if (Number(cs.opacity) < 0.99) return 'opacity ' + cs.opacity; const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return 'størrelse 0'; return ''; };
    const top = (el) => { const r = el.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2; const h = document.elementFromPoint(x, y); return h === P || h === P.parentNode || (h && P.contains(h)) ? '' : 'dekket av ' + (h ? h.localName + '.' + String(h.className).slice(0, 30) : 'null'); };
    const done = new Promise((res) => {
      const tick = () => {
        const t = performance.now() - A.t0;
        const f = { t: Math.round(t) };
        const nav = sr.querySelector('nav.nb'), mini = sr.querySelector('[data-mini]');
        f.same = nav === REF.nav && mini === REF.mini && P.isConnected;
        f.nav = vis(nav); f.mini = REF.mini ? vis(mini) : ''; f.host = vis(P) === 'størrelse 0' ? '' : vis(P);
        f.navTop = nav && !f.nav ? top(nav) : '';
        const pop = window.__pop(hash);
        if (pop && pop.isConnected) {
          const r = pop.getBoundingClientRect();
          f.pt = Math.round(r.top); f.ph = Math.round(r.height);
          f.opening = pop.classList.contains('is-opening'); f.closing = pop.classList.contains('is-closing');
          f.opened = pop.classList.contains('is-popup-opened');
          f.settled = M.popupSettled ? M.popupSettled(pop) : f.opened && !f.opening;
          if (f.opening || f.closing) {
            const cs = getComputedStyle(pop);
            f.tp = cs.transitionProperty;
            f.anims = pop.getAnimations().map((a) => a.transitionProperty || a.animationName).join(',');
            f.bdf = cs.backdropFilter; f.bdfB = getComputedStyle(pop, '::before').backdropFilter; f.bopB = getComputedStyle(pop, '::before').opacity;
          }
        }
        const bd = window.__bd();
        f.bd = bd ? Number(getComputedStyle(bd).opacity) : 0;
        if (act === 'close') { const c = window.__chipSnap(); f.chips = c === chip0 ? '' : c; f.hop = window.__opAnims(hjemRoots()).join(';'); }
        if (act === 'back' && strom) {
          const R0 = strom.shadowRoot, mv = R0.querySelector('.mainv');
          f.mainv = mv === mainv0 ? '' : 'ny node';
          const tiles = [...R0.querySelectorAll('.mainv .bill, .mainv .kc, .mainv .tgear, .mainv .k2, .mainv .gc, .mainv .exr')];
          f.tileOp = tiles.map((e) => Number(getComputedStyle(e).opacity)).filter((o) => o < 0.99).length;
          f.sop = window.__opAnims([R0]).filter((x) => !/^(hglow|pg):/.test(x)).join(';'); // toppkortets glød/ping (designets uendelige pulser) er ikke fliser
          f.mvHidden = mv ? mv.hidden : null;
        }
        A.frames.push(f);
        if (t < dur) requestAnimationFrame(tick); else res();
      };
      requestAnimationFrame(tick);
    });
    if (act === 'open') M.openPopup(hash);
    else if (act === 'close') M.closePopup();
    else if (act === 'back') { const R0 = strom.shadowRoot; const b = R0.querySelector('[data-ss-act="back"]') || R0.querySelector('[data-act="back"]'); if (b) b.click(); else strom.go(null); }
    await done;
    A.live = false;
    const lt = window.__lt.filter(([s, d]) => s + d >= A.t0 && s <= A.t0 + dur).map(([s, d]) => [Math.round(s - A.t0), Math.round(d)]);
    return { act, hash, renders: A.renders, rlog: A.rlog, frames: A.frames, lt, hasMini: !!REF.mini, hashNow: location.hash };
  }, [act, hash, card, dur, !!process.env.A55_DEBUG]);
}

// Analyse av én åpning/lukking
function analyse(r, card, reopen) {
  const F = r.frames, bad = [];
  const isV = r.hash === '#vaer';
  // A1: navbar/mini
  F.forEach((f, i) => {
    if (!f.same) bad.push(['A1 node byttet/frakoblet', f.t]);
    const okHide = isV && r.act === 'open' && f.settled && f.opened; // Vær: tone ut når popupen dekker
    for (const [k, v] of [['navbar', f.nav], ['mini', f.mini], ['portal', f.host]]) if (v && !(okHide && /^opacity/.test(v))) bad.push([`A1 ${k} ${v}`, f.t]);
    if (f.navTop && !(okHide)) bad.push([`A1 navbar ${f.navTop}`, f.t]);
  });
  // A2: Hjem-tegninger
  const hj = HJEM.reduce((a, k) => a + (r.renders[k] || 0), 0);
  if (hj) bad.push(['A2 Hjem tegnet ' + JSON.stringify(Object.fromEntries(HJEM.map((k) => [k, r.renders[k] || 0]))), 0]);
  if (r.act === 'close') F.forEach((f) => { if (f.chips) bad.push(['A2 pille endret: ' + f.chips.slice(0, 120), f.t]); if (f.hop) bad.push(['A2 inn-toning i Hjem: ' + f.hop.slice(0, 100), f.t]); });
  // A3
  if (r.act === 'back') F.forEach((f) => { if (f.mainv) bad.push(['A3 hovedvisningen bygget på nytt', f.t]); if (f.tileOp) bad.push([`A3 ${f.tileOp} fliser opasitet < 1`, f.t]); if (f.sop) bad.push(['A3 opasitet-animasjon: ' + f.sop.slice(0, 100), f.t]); });
  // A4: gliding
  const op = F.filter((f) => f.opening);
  const slide = {};
  if (r.act === 'open') {
    if (!op.length) bad.push(['A4 ingen is-opening-ramme', 0]);
    const first = F.findIndex((f) => f.opening);
    // dim før gliding: bakteppet synlig i en ramme før popupen har is-opening
    const pre = F.slice(0, first < 0 ? F.length : first).filter((f) => f.bd > 0.02);
    if (pre.length) bad.push([`A4 bakteppet dimmet ${pre.length} ramme(r) før glidingen (opasitet ${pre[0].bd.toFixed(2)})`, pre[0].t]);
    let maxJ = 0;
    for (let i = Math.max(1, first); i < F.length && F[i].opening; i++) { const a = F[i - 1], b = F[i]; if (a.pt != null && b.pt != null && a.opening) maxJ = Math.max(maxJ, Math.abs(b.pt - a.pt) / (b.ph || 1)); }
    slide.maxJump = +maxJ.toFixed(3); slide.frames = op.length;
    if (maxJ > 0.25) bad.push([`A4 hopp ${Math.round(maxJ * 100)} % av høyden mellom to rammer`, 0]);
    op.forEach((f) => { if (f.tp !== 'transform' || (f.anims && f.anims.split(',').some((x) => x && x !== 'transform' && x !== 'ki-and-pop-in'))) bad.push([`A4 ikke bare transform: ${f.tp} [${f.anims}]`, f.t]); if (f.bdf !== 'none' || (f.bdfB !== 'none' && Number(f.bopB) > 0)) bad.push([`A4 blur under glidingen ${f.bdf}/${f.bdfB}`, f.t]); });
    if (op.length) {
      const s = op[0].t, e = (F.find((f, i) => i > first && f.settled) || F[F.length - 1]).t;
      slide.win = [s, e];
      slide.lt = r.lt.filter(([a, d]) => a + d >= s && a <= e);
      if (reopen && card) {
        const inWin = (r.rlog || []).filter(([tag, t]) => tag === card && t >= s && t <= e);
        slide.cardRenders = r.rlog ? inWin.length : null;
      }
    }
  }
  if (r.act === 'close') {
    const cl = F.filter((f) => f.closing);
    let maxJ = 0;
    for (let i = 1; i < F.length; i++) if (F[i].closing && F[i - 1].closing && F[i].pt != null && F[i - 1].pt != null) maxJ = Math.max(maxJ, Math.abs(F[i].pt - F[i - 1].pt) / (F[i].ph || 1));
    slide.maxJump = +maxJ.toFixed(3); slide.frames = cl.length;
  }
  return { bad, slide };
}

// --- Android
const S = await setup(ANDROID_UA);
await S.cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
const runs = [];
const card = Object.fromEntries(TARGETS);
for (let round = 0; round < 2; round++) {
  for (const [hash, tag] of TARGETS) {
    await S.page.evaluate(() => { const A = window.__A55; if (A) A.live = false; });
    const op = await measure(S.page, 'open', hash, tag, 1500);
    runs.push({ round, ...op, ...analyse(op, tag, round > 0) });
    if (hash === '#strom') {
      await S.page.waitForTimeout(300);
      await S.page.evaluate(() => { const s = window.__deepQ(document, 'msh-strom-card')[0]; const b = s.shadowRoot.querySelector('.mainv .bill'); if (b) b.click(); else s.go('stromregning'); });
      await S.page.waitForTimeout(900);
      const bk = await measure(S.page, 'back', hash, tag, 700);
      runs.push({ round, ...bk, ...analyse(bk, tag, false) });
      await S.page.waitForTimeout(300);
    } else await S.page.waitForTimeout(500);
    const cl = await measure(S.page, 'close', hash, tag, 900);
    runs.push({ round, ...cl, ...analyse(cl, tag, false) });
    await S.page.waitForTimeout(500);
  }
}
await S.cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
// Blur-valget (ki-store popup_android_blur) begge veier
const blurOf = async () => S.page.evaluate(async () => {
  window.MSH.openPopup('#strom');
  const pop = await new Promise((res) => { const t0 = performance.now(); const f = () => { const p = window.__pop('#strom'); if (p && p.classList.contains('is-popup-opened') && !p.classList.contains('is-opening')) return res(p); if (performance.now() - t0 > 3000) return res(p); requestAnimationFrame(f); }; f(); });
  await new Promise((r) => setTimeout(r, 400));
  const r = { before: getComputedStyle(pop, '::before').backdropFilter, pop: getComputedStyle(pop).backdropFilter, cfg: (window.__bc('#strom').config || {}).bg_blur };
  window.MSH.closePopup();
  await new Promise((r2) => setTimeout(r2, 900));
  return r;
});
const blurOff = await blurOf();
await S.page.evaluate(() => window.MSH.store.set('popup_android_blur', true));
const blurOn = await blurOf();
await S.page.evaluate(() => window.MSH.store.set('popup_android_blur', undefined));
const blurOff2 = await blurOf();
// Tilpass Hjem → Popups har valget
const edRow = await S.page.evaluate(() => { const M = window.MSH; if (!M.popupsPanel) return null; const ed = { u: {}, hass: window.__H, render() {}, root: document }; try { const h = M.popupsPanel.render(ed); return /Blur i popups på Android/.test(h) && /data-a="ppablur"/.test(h); } catch (e) { return 'feil: ' + e.message; } });
const andInfo = await S.page.evaluate(() => ({ holds: (window.MSH.perf && window.MSH.perf.backdropHolds) || 0, holdCss: !!(window.__bd() && window.__bd().getRootNode().getElementById('ki-and-bd')) }));
await S.ctx.close();

// --- standard-UA (iOS/PC uendret)
const D = await setup(null);
const def = await D.page.evaluate(async () => {
  const M = window.MSH;
  M.openPopup('#strom'); await new Promise((r) => setTimeout(r, 1400));
  const s = window.__deepQ(document, 'msh-strom-card')[0];
  const css = s.shadowRoot.querySelector('style').textContent;
  const pop = window.__pop('#strom');
  const r = { android: !!(M.perf && M.perf.android), holdCss: !!(window.__bd() && window.__bd().getRootNode().getElementById('ki-and-bd')), stromAndCss: /@keyframes ss-fade\{from\{transform/.test(css), before: getComputedStyle(pop, '::before').backdropFilter, holds: (M.perf && M.perf.backdropHolds) || 0 };
  M.closePopup(); await new Promise((r2) => setTimeout(r2, 900));
  // Vær: navbaren tones ut straks (som før) på iOS/PC
  M.openPopup('#vaer'); await new Promise((r2) => requestAnimationFrame(() => requestAnimationFrame(r2)));
  r.vaerNow = window.__portal().hasAttribute('data-vaer');
  M.closePopup(); await new Promise((r2) => setTimeout(r2, 900));
  return r;
});
await D.ctx.close();
await browser.close();
if (own) try { unlinkSync(bundle); } catch (e) { /* */ }

// --- rapport
const pad = (s, n) => String(s).padEnd(n);
console.log(`\nFiks 55 A · Android-UA · CPU ×${THROTTLE} · Ytelsesmodus ${PERF}`);
console.log(pad('runde/handling', 26) + pad('rammer', 8) + pad('glide-rammer', 13) + pad('maks hopp', 11) + pad('Hjem-tegn.', 11) + pad('kort i glid.', 13) + pad('lange oppg. i glid.', 22) + 'feil');
for (const r of runs) {
  const hj = HJEM.reduce((a, k) => a + (r.renders[k] || 0), 0);
  console.log(pad(`${r.round ? 'gjenåpn' : 'kald'} ${r.act} ${r.hash}`, 26) + pad(r.frames.length, 8) + pad(r.slide.frames != null ? r.slide.frames : '', 13) + pad(r.slide.maxJump != null ? Math.round(r.slide.maxJump * 100) + ' %' : '', 11) + pad(hj, 11) + pad(r.slide.cardRenders != null ? r.slide.cardRenders : '', 13) + pad(r.slide.lt ? `${r.slide.lt.length} (${Math.max(0, ...r.slide.lt.map((x) => x[1]))} ms)` : '', 22) + (r.bad.length ? r.bad.slice(0, 3).map((b) => `${b[0]} @${b[1]}`).join(' | ') : '–'));
}
console.log('Blur-valget:', JSON.stringify({ av: blurOff, paa: blurOn, av2: blurOff2 }), '· Tilpass Hjem-rad:', edRow, '· bakteppe-hold:', JSON.stringify(andInfo));
console.log('Standard-UA:', JSON.stringify(def));
if (S.errs.length || D.errs.length) console.log('Sidefeil:', [...new Set([...S.errs, ...D.errs])].slice(0, 5));
const outFile = process.env.A55_OUT || resolve(`test/.build/and55-${process.pid}.json`);
writeFileSync(outFile, JSON.stringify({ runs, blurOff, blurOn, blurOff2, def }, null, 1));
console.log('JSON →', outFile);

if (own) {
  const out = [];
  const ok = (n, c, i) => out.push(`${c ? '✔' : '✘'} ${n}${i != null && !c ? ' · ' + JSON.stringify(i).slice(0, 500) : ''}`);
  const by = (re) => runs.filter((r) => r.bad.some((b) => re.test(b[0]))).map((r) => [`${r.round}:${r.act}${r.hash}`, r.bad.filter((b) => re.test(b[0])).slice(0, 2)]);
  ok('A1 navbar og mini-spiller: samme noder, synlige og øverst i hver ramme (Vær: tones ut først når popupen har satt seg)', !by(/^A1/).length, by(/^A1/).slice(0, 3));
  ok('A2 ingen tegning av Hjem/faner/prosa/header ved åpning og lukking', !by(/^A2 Hjem/).length, by(/^A2 Hjem/).slice(0, 3));
  ok('A2 pillene beholder tekst/farge i hver ramme etter lukking, ingen inn-toning i Hjem', !by(/^A2 (pille|inn)/).length, by(/^A2 (pille|inn)/).slice(0, 3));
  ok('A3 Strøm tilbake: samme hovedvisning, fliser med opasitet 1, ingen opasitet-animasjon', runs.some((r) => r.act === 'back') && !by(/^A3/).length, by(/^A3/).slice(0, 3));
  ok('A4 glidingen er bare transform, uten blur mens den glir', !by(/^A4 (ikke bare|blur)/).length, by(/^A4 (ikke bare|blur)/).slice(0, 3));
  ok('A4 dim og gliding starter i samme ramme (bakteppet aldri dimmet før is-opening)', !by(/^A4 bakteppet/).length, by(/^A4 bakteppet/).slice(0, 3));
  ok('A4 ingen hopp over 1/4 av høyden mellom to rammer', !by(/^A4 hopp/).length, by(/^A4 hopp/).slice(0, 3));
  ok('A4 popupen åpnet hver gang', !by(/^A4 ingen is-opening/).length, by(/^A4 ingen is-opening/));
  const reo = runs.filter((r) => r.round > 0 && r.act === 'open');
  ok('A4 popupens kort tegnes ikke under glidingen ved gjenåpning', reo.every((r) => !r.slide.cardRenders), reo.map((r) => [r.hash, r.slide.cardRenders]));
  const LMAX = Number(process.env.A55_LT_MAX || 0);
  if (LMAX) ok(`A4 ingen lang oppgave over ${LMAX} ms i glidevinduet ved gjenåpning`, reo.every((r) => (r.slide.lt || []).every((x) => x[1] <= LMAX)), reo.map((r) => [r.hash, r.slide.lt]));
  ok('A4 blur i popups på Android: av (standard) → ingen blur', blurOff.before === 'none' && blurOff.pop === 'none' && blurOff2.before === 'none', { blurOff, blurOff2 });
  ok('A4 blur i popups på Android: på → konfigurert blur når popupen står stille', /blur\(/.test(blurOn.before), blurOn);
  ok('A4 valget finnes i Tilpass Hjem → Popups', edRow === true, edRow);
  ok('A4 bakteppet holdes til glidingen (Android)', andInfo.holds > 0 && andInfo.holdCss, andInfo);
  ok('standard-UA: ingen Android-regler, Vær-navbaren som før (iOS/PC uendret)', !def.android && !def.holdCss && !def.stromAndCss && !def.holds && def.vaerNow === true && /blur\(/.test(def.before), def);
  ok('ingen sidefeil', !S.errs.length && !D.errs.length, [...S.errs, ...D.errs].slice(0, 3));
  console.log('\n' + out.join('\n'));
  if (out.some((x) => x.startsWith('✘'))) process.exit(1);
}
