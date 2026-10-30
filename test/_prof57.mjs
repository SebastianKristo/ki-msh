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


const { p } = await setup({ w: 390, h: 844, touch: true, ua: ANDROID_UA, throttle: 6 });
await p.evaluate(() => { if (MSH.perf && MSH.perf.android) MSH.vaerScene = () => true; });
const cdp = await p.context().newCDPSession(p);
await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
await p.waitForTimeout(500);
await cdp.send('Profiler.start');
const lt = await p.evaluate(async () => { const L = []; const po = new PerformanceObserver((l) => l.getEntries().forEach((e) => L.push([Math.round(e.startTime), Math.round(e.duration)]))); po.observe({ type: 'longtask', buffered: false }); const t0 = performance.now(); location.hash = '#vaer'; await new Promise((q) => setTimeout(q, 1200)); po.disconnect(); return L.map(([s, d]) => [Math.round(s - t0), d]); });
const { profile } = await cdp.send('Profiler.stop');
const self = new Map(); const byId = new Map(profile.nodes.map((n) => [n.id, n]));
const dt = profile.timeDeltas; const counts = new Map();
profile.samples.forEach((id, i) => counts.set(id, (counts.get(id) || 0) + (dt[i] || 0)));
for (const [id, us] of counts) { const n = byId.get(id); const k = (n.callFrame.functionName || '(anon)') + ' ' + (n.callFrame.url || '').split('/').pop() + ':' + n.callFrame.lineNumber + ':' + n.callFrame.columnNumber; self.set(k, (self.get(k) || 0) + us); }
const parent = new Map(); profile.nodes.forEach((n) => (n.children || []).forEach((c) => parent.set(c, n.id)));
const callers = (name) => { const m = new Map(); for (const [id, us] of counts) { const n = byId.get(id); if (n.callFrame.functionName !== name) continue; let chain = []; let pid = parent.get(id); for (let k = 0; k < 4 && pid; k++) { const pn = byId.get(pid); chain.push((pn.callFrame.functionName || 'anon') + ':' + pn.callFrame.lineNumber + ':' + pn.callFrame.columnNumber); pid = parent.get(pid); } const key = chain.join(' < '); m.set(key, (m.get(key) || 0) + us); } return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => (v / 1000).toFixed(1) + ' ' + k).join('\n'); };
console.log('GBCR\n' + callers('getBoundingClientRect')); console.log('DIM\n' + callers('dimColor'));
console.log('LONGTASKS', JSON.stringify(lt));
console.log([...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([k, v]) => (v / 1000).toFixed(1) + ' ms  ' + k).join('\n'));
process.exit(0);
