// Fiks 57 C · navbar + Now Playing (mini-spilleren) glir ut mens en popup i hide_in_popups er åpen (standard ['#vaer']).
//   node test/navbar57-check.mjs   (SHOTS=<mappe> gir skjermbilder)
//  · bunnlinje (telefon 390) og rail (Fold åpen 1080 × 1200 touch, PC 1280 × 900), standard-UA og Android-UA (CPU × 6)
//  · åpne #vaer (ekte Bubble Card): data-hidden + aria-hidden på portalen i SAMME bilde som popupen begynner å åpne,
//    navbar translate 0 100% (bunn) / −20 px 0 (rail: bare M.RAIL.gap, aldri over HA-sidebaren; PC 1400 med 256 px sidebar
//    samples hvert bilde) + opasitet 0, mini-spilleren ned + 0, overgang 180 ms bare på
//    translate/opacity (ingen blur-overgang), samme noder (aldri display:none/ny node), pointer-events none, trykk treffer ikke
//  · Vær-innholdets bunnluft = 16 px + safe-area (ikke navbar/mini) når skjult; med listen [] som før (navbar + mini)
//  · lukk (Bubbles lukkeknapp): begge glir inn igjen fra samme bilde som popupen begynner å lukke, uten blink (opasiteten
//    stiger monotont, ingen bilder uten navbar)
//  · andre popups uendret (#klima: synlig; #ringeklokke: data-ring som før); egen liste ['#vaer', '#kart'] virker
//  · editor: «Skjul navbar og Now Playing i popups» i GUI-editoren (config-changed) og i Tilpass navbar (arket, Ferdig → config)
//  · Vær-snarveien (Tilpass Hjem → Popups → Vær) redigerer samme liste; migrering av Vær-kortets gamle hide_navbar: false
import { createRequire } from 'node:module';
import { readdirSync, existsSync, rmSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
mkdirSync('test/.build', { recursive: true });
const bundle = resolve(`test/.build/navbar57-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const BC = resolve('test/.vendor/bubble-card.js');
if (!existsSync(BC)) { mkdirSync('test/.vendor', { recursive: true }); execFileSync('curl', ['-sSL', '-o', BC, 'https://raw.githubusercontent.com/Clooos/Bubble-Card/main/dist/bubble-card.js']); }
const shots = process.env.SHOTS || '';
const mocks = readdirSync('test/mock').filter((f) => f.endsWith('.js')).sort().map((m) => resolve('test/mock/' + m));
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const fail = [], errs = [];
const ok = (name, cond, info) => { console.log(`${cond ? '✔' : '✘'} ${name}${!cond && info != null ? ' · ' + JSON.stringify(info).slice(0, 900) : ''}`); if (!cond) fail.push(name); };
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36 Home Assistant/2024.10';

// Ekte Bubble Card: Vær-popupen (mal A + M.POPUP_FORCE['#vaer'] som strategien) + navbar med mini-spiller (alltid synlig)
async function setup({ w, h, touch, ua, throttle, sb = 0, nav = {}, card = {} }) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: !!touch, isMobile: !!touch && w < 900, ...(ua ? { userAgent: ua } : {}) });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + resolve('test/harness-bubble.html'));
  for (const m of mocks) await p.addScriptTag({ path: m });
  await p.addScriptTag({ path: bundle });
  await p.addScriptTag({ path: BC, type: 'module' });
  await p.waitForFunction(() => customElements.get('bubble-card'), null, { timeout: 15000 });
  if (sb) await p.evaluate((x) => { document.documentElement.style.setProperty('--sb', x + 'px'); window.__edge = true; }, sb); // HA-sidebar (harness #sidebar)
  await p.evaluate(async ({ nav, card }) => {
    const wait = (ms) => new Promise((q) => setTimeout(q, ms));
    const H = window.mockHass(); H.themes = { ...(H.themes || {}), darkMode: true };
    window.__h = H;
    await MSH.store.load(H);
    const nb = document.createElement('msh-navbar-card'); const wr = document.createElement('div'); document.getElementById('dash').appendChild(wr);
    nb.setConfig({ type: 'custom:msh-navbar-card', card_id: 'nb', mini: { on: true, cond: 'always' }, ...nav }); nb.hass = H; wr.appendChild(nb); window.__nb = nb;
    const base = MSH.popupTemplateA({ name: 'Vær', icon: 'mdi:weather-partly-cloudy', hash: '#vaer', card: { type: 'custom:msh-vaer-card', card_id: 'pop-vaer', ...card } });
    const pop = MSH.POPUP_FORCE['#vaer'](base) || base;
    const bc = document.createElement('bubble-card'); bc.setConfig(pop); bc.hass = H; document.getElementById('dash').appendChild(bc);
    await wait(900);
    const deepAll = (sel) => { const out = []; const walk = (r) => r.querySelectorAll('*').forEach((e) => { if (e.matches(sel)) out.push(e); if (e.shadowRoot && e.localName !== 'ha-icon') walk(e.shadowRoot); }); walk(document); return out; };
    window.deepAll = deepAll; window.deep = (sel) => deepAll(sel)[0] || null;
    window.__pt = () => window.__nb._portal;
    window.__nav = () => window.__pt() && window.__pt().shadowRoot.querySelector('nav.nb');
    window.__mini = () => window.__pt() && window.__pt().shadowRoot.querySelector('.mini');
    window.__popEl = () => deepAll('.bubble-pop-up').find((e) => !e.classList.contains('editor') && e.closest && true) || null;
    // rAF-sampling: popupens transform/klasser + navbar/mini (opasitet, translate, samme node, tilkoblet, display)
    window.__rec = (ms) => new Promise((done) => {
      const out = [], nav0 = window.__nav(), mini0 = window.__mini(), t0 = performance.now();
      // railens synlige venstrekant uten layout per bilde (ville forskjøvet tidsmålingene under CPU × 6): kanten uten
      // translate målt én gang + beregnet translate-x (railen flyttes bare med translate, inline transform er bare Y)
      // Bare i sidebar-varianten (window.__edge) – de andre variantene måles nøyaktig som før (tidskravene under CPU × 6)
      const edge = !!window.__edge, tx0 = edge && nav0 ? parseFloat(getComputedStyle(nav0).translate) || 0 : 0;
      const L0 = edge && nav0 ? nav0.getBoundingClientRect().left - tx0 : 0, D0 = edge ? Math.round(MSH.rectOf(MSH.dashEl(window.__nb)).left * 10) / 10 : null;
      const f = () => {
        const n = window.__nav(), m = window.__mini(), pop = window.__popEl(), pt = window.__pt();
        const cs = n && getComputedStyle(n), ms_ = m && getComputedStyle(m), ps = pop && getComputedStyle(pop);
        out.push({ t: Math.round(performance.now() - t0), hash: location.hash, pop: pop ? (pop.classList.contains('is-closing') ? 'closing' : pop.classList.contains('is-opening') ? 'opening' : pop.classList.contains('is-popup-opened') ? 'o' : pop.classList.contains('is-popup-closed') ? 'c' : '-') : null, ptf: ps ? ps.transform : null, pop_op: ps ? ps.opacity : null,
          hid: pt.hasAttribute('data-hidden'), aria: pt.getAttribute('aria-hidden'), nop: cs ? Number(cs.opacity) : null, nl: edge && cs ? Math.round((L0 + (parseFloat(cs.translate) || 0)) * 10) / 10 : null, dl: D0, ntr: cs ? cs.translate : null, ndisp: cs ? cs.display : null, nvis: cs ? cs.visibility : null,
          mop: ms_ ? Number(ms_.opacity) : null, mtr: ms_ ? ms_.translate : null, same: n === nav0 && m === mini0, conn: !!(n && n.isConnected && (!mini0 || (m && m.isConnected))) });
        if (performance.now() - t0 < ms) requestAnimationFrame(f); else done(out);
      };
      requestAnimationFrame(f);
    });
    window.__wait = wait;
  }, { nav, card });
  if (throttle) { const cdp = await ctx.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle }); }
  return { p, ctx };
}

const firstIdx = (S, f) => S.findIndex(f);
const VARIANTS = [
  { tag: 'telefon (bunn)', w: 390, h: 844, touch: true, rail: false },
  { tag: 'Fold åpen (rail)', w: 1080, h: 1200, touch: true, rail: true },
  { tag: 'PC (rail)', w: 1280, h: 900, touch: false, rail: true },
  { tag: 'PC (rail, 256 px HA-sidebar)', w: 1400, h: 900, touch: false, rail: true, sb: 256 },
];
for (const V of VARIANTS) {
  for (const and of [false, true]) {
    const T = `${V.tag} · ${and ? 'Android (CPU × 6)' : 'standard-UA'}`;
    const { p, ctx } = await setup({ w: V.w, h: V.h, touch: V.touch, sb: V.sb || 0, ua: and ? ANDROID_UA : undefined, throttle: and ? 6 : 0 });
    const pre = await p.evaluate(() => { const n = window.__nav(), m = window.__mini(), r = n.getBoundingClientRect(); return { android: !!(MSH.perf && MSH.perf.android), rail: r.height > r.width, mini: !!m && getComputedStyle(m).opacity === '1', list: MSH.navHideList(), occ: MSH.navOcc() }; });
    ok(`${T}: oppsett (rail=${V.rail}, mini-spiller synlig, standardliste ['#vaer'], Android=${and})`, pre.rail === V.rail && pre.mini && JSON.stringify(pre.list) === '["#vaer"]' && pre.android === and, pre);
    // ---- åpne #vaer
    const O = await p.evaluate(async () => {
      const rec = window.__rec(900);
      await window.__wait(50);
      const t = performance.now(); location.hash = '#vaer';
      const sync = { hid: window.__pt().hasAttribute('data-hidden'), aria: window.__pt().getAttribute('aria-hidden') }; // samme oppgave som hashchange
      const S = await rec;
      const n = window.__nav(), m = window.__mini(), pt = window.__pt();
      const anims = (el) => (el ? el.getAnimations() : []).map((a) => [a.transitionProperty || a.animationName, a.effect && a.effect.getTiming().duration]);
      const cx = n.getBoundingClientRect(); const hit = document.elementFromPoint(cx.left + cx.width / 2 - (n.style.translate ? 0 : 0), cx.top + cx.height / 2);
      const nr = n.getBoundingClientRect();
      return { S, sync, t,
        end: { hid: pt.hasAttribute('data-hidden'), aria: pt.getAttribute('aria-hidden'), nop: getComputedStyle(n).opacity, ntr: getComputedStyle(n).translate, npe: getComputedStyle(n).pointerEvents, ndisp: getComputedStyle(n).display, mop: m && getComputedStyle(m).opacity, mtr: m && getComputedStyle(m).translate, mpe: m && getComputedStyle(m).pointerEvents, mdisp: m && getComputedStyle(m).display, bdf: getComputedStyle(n).backdropFilter, conn: n.isConnected && (!m || m.isConnected) },
        hitNav: hit === window.__nb || hit === pt, nrect: { t: Math.round(nr.top), l: Math.round(nr.left), b: Math.round(nr.bottom), r: Math.round(nr.right) },
        pad: (window.deep('msh-vaer-card') || {}).style ? window.deep('msh-vaer-card').style.paddingBottom : null,
        occ: MSH.navOcc(), navOcc: (() => { const D = MSH.rectOf(MSH.dashEl(window.__nb)); return Math.round(D.top + D.height - (nr.top - nr.height) + 8); })(), anims: null };
    });
    // overgangene (målt rett etter byttet i en egen runde: lukk/åpne igjen og les getAnimations i samme oppgave)
    const A = await p.evaluate(async () => {
      history.replaceState(null, '', location.href.split('#')[0]); window.dispatchEvent(new Event('location-changed'));
      await window.__wait(700);
      location.hash = '#vaer';
      const n = window.__nav(), m = window.__mini();
      const an = (el) => (el ? el.getAnimations() : []).map((a) => [a.transitionProperty, Math.round(a.effect.getTiming().duration)]);
      const r = { nav: an(n), mini: an(m), tr: getComputedStyle(n).transitionProperty + ' ' + getComputedStyle(n).transitionDuration };
      await window.__wait(700);
      return r;
    });
    const S = O.S;
    // synlig start: første bilde der popupens transform/opasitet er endret, og der navbarens opasitet er under 1
    const popStart = firstIdx(S, (x, i) => i > 0 && (x.ptf !== S[0].ptf || x.pop_op !== S[0].pop_op)), navStart = firstIdx(S, (x) => x.nop < 0.999);
    const zero = firstIdx(S, (x) => x.nop <= 0.1 && (x.mop == null || x.mop <= 0.1));
    const dt = zero >= 0 && navStart >= 0 ? S[zero].t - S[Math.max(0, navStart - 1)].t : null;
    ok(`${T}: #vaer åpnes → data-hidden + aria-hidden satt straks (samme oppgave som hashchange, ingen venting)`, O.sync.hid && O.sync.aria === 'true', O.sync);
    ok(`${T}: navbaren begynner å gli ut i samme bilde som popupen begynner å åpne`, popStart >= 0 && navStart >= 0 && Math.abs(navStart - popStart) <= 1, { popStart, navStart, s: S.slice(0, 6) });
    ok(`${T}: overgang 180 ms bare på translate + opacity (navbar og mini-spiller), ingen blur-overgang`, ['translate', 'opacity'].every((k) => A.nav.some((a) => a[0] === k && a[1] === 180)) && ['translate', 'opacity'].every((k) => A.mini.some((a) => a[0] === k && a[1] === 180)) && !A.nav.concat(A.mini).some((a) => /filter|blur/.test(a[0])), A);
    ok(`${T}: skjult innen ~180 ms (navbar + mini opasitet ≤ 0,1 fra første synlige bilde, 0 til slutt)`, dt != null && dt <= (and ? 180 + 60 : 180 + 40) && S[S.length - 1].nop === 0, { dt, zero, navStart, t: S.map((x) => [x.t, x.nop, x.mop]).slice(0, 16) });
    ok(`${T}: utgliding uten blink (opasiteten synker monotont, samme noder og tilkoblet i hvert bilde, aldri display:none)`, S.every((x, i) => i === 0 || x.nop <= S[i - 1].nop + 1e-3) && S.every((x) => x.same && x.conn && x.ndisp !== 'none' && x.nvis === 'visible'), S.filter((x, i) => !(x.same && x.conn) || (i && x.nop > S[i - 1].nop + 1e-3)).slice(0, 4));
    // rail: glir bare M.RAIL.gap (20 px) til venstre – til dashbordkanten, aldri over HA-sidebaren (CLAUDE.md)
    const trOk = V.rail ? O.end.ntr === '-20px' : O.end.ntr === '0px 100%';
    ok(`${T}: skjult = ${V.rail ? 'translate(−20 px, 0)' : 'translate(0, 100%)'} + opasitet 0, mini-spilleren ned + 0, pointer-events none, aria-hidden, aldri display:none`, O.end.hid && O.end.aria === 'true' && O.end.nop === '0' && trOk && O.end.npe === 'none' && O.end.ndisp !== 'none' && O.end.mop === '0' && O.end.mtr === '0px 100%' && O.end.mpe === 'none' && O.end.mdisp !== 'none' && O.end.conn, O.end);
    ok(`${T}: trykk der navbaren sto treffer ikke navbaren`, !O.hitNav, O.nrect);
    if (V.sb) {
      const out = S.filter((x) => x.nop > 0 && x.nl < x.dl - 0.5);
      ok(`${T}: utgliding – railens synlige boks går aldri til venstre for dashbordkanten (x ≥ ${S[0].dl}, ingen HA-sidebar dekket)`, S.length > 5 && !out.length && O.nrect.l >= S[0].dl - 1, { out: out.slice(0, 4), nl: S.map((x) => x.nl).slice(0, 14), end: O.nrect });
    }
    ok(`${T}: Vær-innholdets bunnluft = 16 px + safe-area (ikke navbar / Now Playing)`, /^calc\(16px/.test(O.pad || '') && !/ki-nav-h|ki-mini-h/.test(O.pad), O.pad);
    // navbarens del av plassmålingen står fast (translate regnes bort); mini-spilleren telles ikke mens den er skjult (som før, 28.4)
    ok(`${T}: plassmålingen (--ki-nav-occ) flytter seg ikke med navbaren når den glir ut`, V.rail ? JSON.stringify(O.occ) === JSON.stringify(pre.occ) : O.occ.bottom > 0 && O.occ.bottom <= pre.occ.bottom && O.occ.bottom === O.navOcc, { før: pre.occ, nå: O.occ, nav: O.navOcc });
    if (shots) { mkdirSync(shots, { recursive: true }); await p.screenshot({ path: `${shots}/navbar57-${V.rail ? 'rail' : 'bunn'}-${V.w}-${and ? 'android' : 'std'}-vaer.png` }); }
    // ---- lukk med Bubbles lukkeknapp
    const C = await p.evaluate(async () => {
      const pop = window.__popEl(), btn = pop && (pop.querySelector('.bubble-close-button') || [...pop.querySelectorAll('[class*="close-button"]')].find((e) => e.offsetWidth));
      const rec = window.__rec(900);
      await window.__wait(50);
      if (btn) btn.click(); else { history.replaceState(null, '', location.href.split('#')[0]); window.dispatchEvent(new Event('location-changed')); }
      const sync = { hid: window.__pt().hasAttribute('data-hidden'), aria: window.__pt().getAttribute('aria-hidden'), hash: location.hash };
      const S = await rec;
      const n = window.__nav(), m = window.__mini();
      return { btn: !!btn, sync, S, end: { nop: getComputedStyle(n).opacity, ntr: getComputedStyle(n).translate, npe: getComputedStyle(n).pointerEvents, mop: m && getComputedStyle(m).opacity, mtr: m && getComputedStyle(m).translate, aria: window.__pt().getAttribute('aria-hidden') }, occ: MSH.navOcc() };
    });
    const SC = C.S;
    const cStart = firstIdx(SC, (x, i) => i > 0 && (x.ptf !== SC[0].ptf || x.pop_op !== SC[0].pop_op)), nBack = firstIdx(SC, (x) => x.nop > 0);
    ok(`${T}: lukk (Bubbles lukkeknapp) → data-hidden/aria-hidden fjernet straks`, C.btn && !C.sync.hid && C.sync.aria == null && !C.sync.hash, { btn: C.btn, sync: C.sync });
    ok(`${T}: navbaren begynner å gli inn i samme bilde som popupen begynner å lukke`, cStart >= 0 && nBack >= 0 && Math.abs(nBack - cStart) <= 1, { cStart, nBack, s: SC.slice(0, 5) });
    if (V.sb) {
      const out = SC.filter((x) => x.nop > 0 && x.nl < x.dl - 0.5);
      ok(`${T}: inngliding – railens synlige boks går aldri til venstre for dashbordkanten`, SC.length > 5 && !out.length, { out: out.slice(0, 4), nl: SC.map((x) => x.nl).slice(0, 14) });
    }
    ok(`${T}: inngliding uten blink (opasiteten stiger monotont, samme noder, tilkoblet i hvert bilde)`, SC.every((x, i) => i === 0 || x.nop >= SC[i - 1].nop - 1e-3) && SC.every((x) => x.same && x.conn && x.ndisp !== 'none'), SC.map((x) => [x.t, x.nop, x.mop]).slice(0, 14));
    ok(`${T}: tilbake: opasitet 1, translate none, trykkbar, mini-spilleren tilbake`, C.end.nop === '1' && C.end.ntr === 'none' && C.end.npe !== 'none' && C.end.mop === '1' && C.end.mtr === 'none' && C.end.aria == null, C.end);
    ok(`${T}: plassmålingen uendret etter lukking`, JSON.stringify(C.occ) === JSON.stringify(pre.occ), { før: pre.occ, nå: C.occ });
    // ---- andre popups uendret, egen liste
    const R = await p.evaluate(async () => {
      const st = () => ({ hid: window.__pt().hasAttribute('data-hidden'), ring: window.__pt().hasAttribute('data-ring'), nop: getComputedStyle(window.__nav()).opacity, ntr: getComputedStyle(window.__nav()).translate });
      const r = {};
      location.hash = '#klima'; await window.__wait(400); r.klima = st();
      location.hash = '#ringeklokke'; await window.__wait(500); r.ring = st();
      history.replaceState(null, '', location.href.split('#')[0]); window.dispatchEvent(new Event('location-changed')); await window.__wait(500);
      const nav0 = window.__nav();
      const cfg = { ...window.__nb._rawConfig, hide_in_popups: ['#vaer', '#kart'] };
      window.__nb.setConfig(cfg); await window.__wait(400);
      location.hash = '#kart'; await window.__wait(400); r.kart = st();
      location.hash = '#klima'; await window.__wait(400); r.klima2 = st();
      location.hash = '#vaer'; await window.__wait(400); r.vaer = st();
      history.replaceState(null, '', location.href.split('#')[0]); window.dispatchEvent(new Event('location-changed')); await window.__wait(400);
      r.same = window.__nav() === nav0;
      // [] = aldri skjul: Vær viser navbaren, bunnluften som før (navbar + Now Playing)
      window.__nb.setConfig({ ...window.__nb._rawConfig, hide_in_popups: [] }); await window.__wait(400);
      location.hash = '#vaer'; await window.__wait(1200); r.none = st(); r.nonePad = window.deep('msh-vaer-card').style.paddingBottom;
      window.__nb.setConfig({ ...window.__nb._rawConfig, hide_in_popups: ['#vaer'] }); await window.__wait(400); r.back = st(); r.backPad = window.deep('msh-vaer-card').style.paddingBottom;
      history.replaceState(null, '', location.href.split('#')[0]); window.dispatchEvent(new Event('location-changed')); await window.__wait(600);
      return r;
    });
    ok(`${T}: andre popups uendret (#klima synlig, #ringeklokke data-ring som før, ikke data-hidden)`, !R.klima.hid && R.klima.nop === '1' && R.klima.ntr === 'none' && R.ring.ring && !R.ring.hid, R);
    ok(`${T}: egen liste ['#vaer', '#kart'] → skjult i #kart og #vaer, ikke i #klima, samme node`, R.kart.hid && R.kart.nop === '0' && R.vaer.hid && !R.klima2.hid && R.klima2.nop === '1' && R.same, R);
    ok(`${T}: liste [] → Vær viser navbaren, bunnluft navbar + Now Playing; tilbake til ['#vaer'] → skjult og 16 px live`, !R.none.hid && R.none.nop === '1' && /ki-nav-h/.test(R.nonePad) && /ki-mini-h/.test(R.nonePad) && R.back.hid && /^calc\(16px/.test(R.backPad), R);
    await ctx.close();
  }
}

/* ================================================================== editorene */
{
  const { p, ctx } = await setup({ w: 390, h: 844, touch: true });
  const E = await p.evaluate(async () => {
    const wait = window.__wait, out = {};
    const chips = (root) => [...root.querySelectorAll('[data-a="nbhpop"]')].map((b) => [b.dataset.v, b.getAttribute('aria-checked')]);
    // GUI-editoren (getConfigElement)
    const ed = customElements.get('msh-navbar-card').getConfigElement();
    ed.hass = window.__h; ed.setConfig({ type: 'custom:msh-navbar-card', card_id: 'nbx' }); document.body.appendChild(ed);
    await wait(300);
    const sr = ed.shadowRoot;
    out.label = /Skjul navbar og Now Playing i popups/.test(sr.innerHTML);
    out.c0 = chips(sr).filter((c) => c[1] === 'true').map((c) => c[0]);
    out.hasKart = chips(sr).some((c) => c[0] === '#kart');
    let last = null; ed.addEventListener('config-changed', (e) => { last = e.detail.config; });
    sr.querySelector('[data-a="nbhpop"][data-v="#kart"]').click(); await wait(150);
    out.c1 = last && last.hide_in_popups;
    ed.setConfig(last); await wait(150);
    out.c1ui = chips(ed.shadowRoot).filter((c) => c[1] === 'true').map((c) => c[0]);
    ed.shadowRoot.querySelector('[data-a="nbhpop"][data-v="#vaer"]').click(); await wait(150);
    out.c2 = last && last.hide_in_popups;
    ed.setConfig({ type: 'custom:msh-navbar-card', card_id: 'nbx', hide_in_popups: ['#media'] }); await wait(150);
    out.c3ui = chips(ed.shadowRoot).filter((c) => c[1] === 'true').map((c) => c[0]);
    ed.remove();
    // Tilpass navbar (arket, samme element) → Ferdig → kortets config (ki-store)
    window.__nb.customize('nbhide'); await wait(700);
    const sed = window.deepAll('msh-navbar-editor').find((e) => e.isConnected);
    out.sheet = !!sed;
    if (sed) {
      out.s0 = chips(sed.shadowRoot).filter((c) => c[1] === 'true').map((c) => c[0]);
      sed.shadowRoot.querySelector('[data-a="nbhpop"][data-v="#kart"]').click(); await wait(300);
      out.sLive = window.__nb._rawConfig.hide_in_popups;
      const save = window.deepAll('[data-a="save"]').find((e) => e.offsetWidth || e.getClientRects().length);
      out.saveBtn = !!save; if (save) save.click();
      await wait(1500);
      out.s1 = window.__nb._rawConfig.hide_in_popups;
      out.store = (MSH.store.get('cards.nb') || {}).hide_in_popups;
      // åpnes på nytt: viser lagret liste
      window.__nb.customize('nbhide'); await wait(700);
      const sed2 = window.deepAll('msh-navbar-editor').find((e) => e.isConnected);
      out.s2 = sed2 && chips(sed2.shadowRoot).filter((c) => c[1] === 'true').map((c) => c[0]);
      const cancel = window.deepAll('[data-a="cancel"]').find((e) => e.getClientRects().length); if (cancel) cancel.click();
      await wait(500);
    }
    // Vær-snarveien (Tilpass Hjem → Popups → Vær og GUI-editoren for Vær) redigerer samme liste
    await MSH.setVaerStil('nav:off'); await wait(300); out.vOff = MSH.navHideList(); out.vOffCfg = window.__nb._rawConfig.hide_in_popups;
    out.vHtml = /Skjul navbar og Now Playing/.test(MSH.vaerStilHTML('x')) && /aria-checked="false"[^>]*>|data-vaer-nav role="switch" aria-checked="false"/.test(MSH.vaerStilHTML('x'));
    await MSH.setVaerStil('nav:on'); await wait(300); out.vOn = MSH.navHideList();
    const vd = customElements.get('msh-vaer-card').schema;
    const sch = (typeof vd === 'function' ? vd() : vd).find((f) => f.id === 'display');
    const bf = sch && sch.fields.find((f) => f.type === 'boolean' && /Skjul navbar og Now Playing/.test(f.label));
    out.vGui = !!bf && bf.get() === true;
    if (bf) { bf.set(false, null, {}, null); await wait(300); out.vGuiOff = MSH.navHideList(); bf.set(true, null, {}, null); await wait(300); out.vGuiOn = MSH.navHideList(); }
    // migrering: Vær-kortets gamle hide_navbar: false (Fiks 56 I) uten egen liste i navbaren → [] ; true/mangler → ['#vaer']
    // Vær-kortets config: levende kort (om det finnes) ellers ki-store cards.pop-vaer (som MSH.vaerNavLegacy leser)
    let vc = null; MSH.liveCards.forEach((set) => set.forEach((el) => { if (el.localName === 'msh-vaer-card' && el._rawConfig && (!vc || el.isConnected)) vc = el; }));
    const raw = vc ? vc._rawConfig : null, st0 = MSH.store.get('cards.pop-vaer') || {};
    const setV = async (c) => { if (vc) vc._rawConfig = { ...raw, ...c }; else await MSH.store.set('cards.pop-vaer', { ...st0, ...c }, { immediate: true }); };
    out.mig = MSH.navHideListOf({});
    await setV({ hide_navbar: false }); out.migFalse = MSH.navHideListOf({}); out.migList = MSH.navHideListOf({ hide_in_popups: ['#vaer'] });
    await setV({ hide_navbar: false, view: 'sheet' }); out.migSheet = MSH.navHideListOf({});
    await setV({ hide_navbar: true }); out.migTrue = MSH.navHideListOf({});
    if (vc) vc._rawConfig = raw; else await MSH.store.set('cards.pop-vaer', st0, { immediate: true });
    return out;
  });
  ok('GUI-editoren: «Skjul navbar og Now Playing i popups», standard Vær valgt', E.label && JSON.stringify(E.c0) === '["#vaer"]' && E.hasKart, E);
  ok('GUI-editoren: velg Kart → config-changed hide_in_popups [#vaer, #kart], vises etter setConfig; fjern Vær → [#kart]; ny config speiles', JSON.stringify(E.c1) === '["#vaer","#kart"]' && JSON.stringify(E.c1ui) === '["#vaer","#kart"]' && JSON.stringify(E.c2) === '["#kart"]' && JSON.stringify(E.c3ui) === '["#media"]', E);
  ok('Tilpass navbar (arket): samme liste, live forhåndsvisning, Ferdig lagrer i kortets config (ki-store), vises igjen', E.sheet && JSON.stringify(E.s0) === '["#vaer"]' && JSON.stringify(E.sLive) === '["#vaer","#kart"]' && E.saveBtn && JSON.stringify(E.s1) === '["#vaer","#kart"]' && JSON.stringify(E.store) === '["#vaer","#kart"]' && JSON.stringify(E.s2) === '["#vaer","#kart"]', E);
  ok('Vær-snarveien (Tilpass Hjem → Popups → Vær) redigerer navbarens liste', JSON.stringify(E.vOff) === '["#kart"]' && JSON.stringify(E.vOffCfg) === '["#kart"]' && E.vHtml && JSON.stringify(E.vOn) === '["#kart","#vaer"]', E);
  ok('Vær GUI-editor: «Skjul navbar og Now Playing» = snarvei til samme liste', E.vGui && JSON.stringify(E.vGuiOff) === '["#kart"]' && JSON.stringify(E.vGuiOn) === '["#kart","#vaer"]', E);
  ok('migrering: Vær hide_navbar: false (Fullskjerm) uten navbar-liste → []; ellers standard [#vaer]; lagret liste vinner', JSON.stringify(E.mig) === '["#vaer"]' && JSON.stringify(E.migFalse) === '[]' && JSON.stringify(E.migList) === '["#vaer"]' && JSON.stringify(E.migSheet) === '["#vaer"]' && JSON.stringify(E.migTrue) === '["#vaer"]', E);
  await ctx.close();
}

ok('ingen sidefeil', !errs.length, errs.slice(0, 5));
await b.close();
rmSync(bundle, { force: true });
console.log(fail.length ? `\n${fail.length} feil` : '\nAlle navbar 57-sjekker OK');
process.exit(fail.length ? 1 : 0);
