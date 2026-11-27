// Fiks 25.2: navbaren svever over innholdet på iPhone (PWA) – også når dashbordet ligger i en forelder med transform
// (panel-visning), etter at en popup er åpnet og lukket, og den skjules mens et tekstfelt har fokus (tastaturet).
// Kjør: node test/navbar25-check.mjs
import { createRequire } from 'node:module';
import { readdirSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
mkdirSync('test/.build', { recursive: true });
const bundle = resolve(`test/.build/nb25-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const BC = resolve('test/.vendor/bubble-card.js');
if (!existsSync(BC)) { mkdirSync('test/.vendor', { recursive: true }); execFileSync('curl', ['-sSL', '-o', BC, 'https://raw.githubusercontent.com/Clooos/Bubble-Card/main/dist/bubble-card.js']); }
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Home Assistant/2024.11';
const b = await pw.chromium.launch({ executablePath: process.env.KI_CHROME || undefined });
let fail = 0, n = 0;
const ok = (m, c, info) => { n++; console.log((c ? '✔ ' : '✘ ') + m + (info != null && !c ? ' · ' + JSON.stringify(info).slice(0, 700) : '')); if (!c) fail++; };

async function setup(nav = {}) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, userAgent: IPHONE });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + resolve('test/harness-bubble.html'));
  await p.evaluate(() => { window.__noNavSelftest = true; });
  for (const m of readdirSync('test/mock').sort()) await p.addScriptTag({ path: resolve('test/mock/' + m) });
  await p.addScriptTag({ path: bundle });
  await p.addScriptTag({ path: BC, type: 'module' });
  await p.waitForFunction(() => customElements.get('bubble-card'));
  await p.evaluate(async (nav) => {
    const H = window.mockHass(); window.H = H; window.MSH.lastHass = H;
    await window.MSH.store.load(H);
    // som panel-visning: en forelder med transform og contain rundt alle kortene
    const wrap = document.createElement('div'); wrap.id = 'panel'; wrap.style.cssText = 'transform:translateZ(0);contain:layout paint;min-height:3000px';
    document.getElementById('dash').appendChild(wrap);
    const hj = document.createElement('div'); hj.style.height = '2600px'; hj.textContent = 'Hjem'; wrap.appendChild(hj);
    const nb = document.createElement('msh-navbar-card'); nb.setConfig({ type: 'custom:msh-navbar-card', card_id: 'ki-navbar', ...nav }); nb.hass = H; wrap.appendChild(nb); window.__nb = nb;
    const bc = document.createElement('bubble-card'); bc.setConfig({ type: 'custom:bubble-card', card_type: 'pop-up', hash: '#stue', name: 'Stue', cards: [{ type: 'custom:msh-rom-card', card_id: 'r1', area: 'stue' }] }); bc.hass = H; wrap.appendChild(bc);
    const inp = document.createElement('input'); inp.id = 'txt'; inp.type = 'text'; inp.style.cssText = 'position:absolute;top:100px;left:20px'; document.body.appendChild(inp);
    await new Promise((q) => setTimeout(q, 1200));
  }, nav);
  return { p, ctx, errs };
}
const navRect = (p) => p.evaluate(() => { const pt = window.__nb._portal, nav = pt && pt.shadowRoot.querySelector('nav.nb'); if (!nav) return null; const r = nav.getBoundingClientRect(), cs = getComputedStyle(nav); return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width), op: cs.opacity, pos: cs.position, vh: innerHeight, parent: pt.parentNode === document.body ? 'body' : (pt.parentNode && pt.parentNode.localName), cssBottom: cs.bottom }; });

/* ---- standard (svevende) */
{
  const { p, ctx, errs } = await setup();
  const r0 = await navRect(p);
  const meta = await p.evaluate(() => (document.querySelector('meta[name="viewport"]') || {}).content || '');
  const dock = await p.evaluate(() => ({ dock: window.__nb.config.dock, safe: document.documentElement.style.getPropertyValue('--ki-nav-safe'), bottom: document.documentElement.style.getPropertyValue('--ki-nav-bottom') }));
  ok('navbaren ligger direkte i document.body (ikke i kortet / panel-forelderen med transform)', r0 && r0.parent === 'body', r0);
  ok('standard Svevende: 12 px over bunnen på iPhone (+ safe area), position fixed', r0 && r0.pos === 'fixed' && r0.vh - r0.bottom === 12 && dock.dock === 'float' && dock.bottom === '12px' && /safe-area-inset-bottom/.test(dock.safe), { r0, dock });
  ok('viewport-meta har viewport-fit=cover (safe area virker)', /viewport-fit\s*=\s*cover/.test(meta), meta);
  // står stille når man ruller
  await p.evaluate(() => window.scrollTo(0, 1500)); await p.waitForTimeout(500);
  const r1 = await navRect(p);
  // «Krymp ved scrolling» (standard på) skalerer navbaren mot bunnen (≤ 8 px) – den er fortsatt festet på samme sted
  ok('står stille når du ruller (samme plass i vinduet, bare krympet)', r1 && r1.pos === 'fixed' && r1.cssBottom === r0.cssBottom && Math.abs(r1.bottom - r0.bottom) <= 8, { r0, r1 });
  await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(400);
  // popup åpnes og lukkes
  await p.evaluate(() => { location.hash = '#stue'; }); await p.waitForTimeout(1300);
  const rOpen = await navRect(p);
  await p.evaluate(() => { history.replaceState(null, '', location.pathname); window.dispatchEvent(new Event('location-changed')); window.dispatchEvent(new HashChangeEvent('hashchange')); }); await p.waitForTimeout(900);
  const rAfter = await navRect(p);
  ok('svever også i popupen og etter at popupen er lukket (samme plass, fortsatt i body)', rOpen && rAfter && rOpen.bottom === r0.bottom && rAfter.bottom === r0.bottom && rAfter.parent === 'body', { rOpen, rAfter });
  // tekstfelt med fokus → skjult; uten fokus → tilbake
  await p.tap('#txt'); await p.waitForTimeout(400);
  const rK = await navRect(p), kbd = await p.evaluate(() => window.__nb._portal.hasAttribute('data-kbd'));
  await p.evaluate(() => document.getElementById('txt').blur()); await p.waitForTimeout(400);
  const rB = await navRect(p);
  ok('tekstfelt med fokus: navbaren skjules (ikke midt over tastaturet), og kommer tilbake etterpå', kbd && rK.op === '0' && rB.op === '1', { kbd, op: rK && rK.op, after: rB && rB.op });
  ok('Hjem-innholdet får plass over navbaren (bunnluft med safe area)', await p.evaluate(() => /safe-area-inset-bottom|--ki-nav-safe/.test(window.MSH.popupBottomPad(24))));
  ok('ingen sidefeil (svevende)', !errs.length, errs.slice(0, 4));
  await ctx.close();
}
/* ---- «Fast i bunnen» valgt av brukeren: gammel plassering (ingen safe area i avstanden) */
{
  const { p, ctx, errs } = await setup({ dock: 'fast' });
  const r = await navRect(p);
  const safe = await p.evaluate(() => document.documentElement.style.getPropertyValue('--ki-nav-safe'));
  ok('«Fast i bunnen»: ingen safe area i avstanden (gammel plassering)', r && safe === '0px', { r, safe });
  ok('ingen sidefeil (fast)', !errs.length, errs.slice(0, 4));
  await ctx.close();
}
await b.close();
console.log(fail ? `${n - fail}/${n} OK` : `Alle ${n} bestod`);
process.exit(fail ? 1 : 0);
