// Fiks 36.7 · ALLE «Tilpass …»-ark i popupene er helt dekkende (mot ekte Bubble Card, popupene fra examples/dashboard.yaml).
// For hver popup, i mørk OG lys modus, med Liquid Glass-temaet PÅ (rotårsaken: glassOn() slår også inn via navbar-stilen
// «glass» → arket fikk rgba(34,34,37,.72) + blur og gruppene rgba(255,255,255,.06), så popupen bak skinte gjennom):
//   · kortets tannhjul/customize('spacing') åpner arket portalt (ki-overlay-root, ikke inni .bubble-pop-up)
//   · arket: beregnet bakgrunn helt dekkende (alfa 1, --ki-popup), ingen backdrop-filter, opasitet 1 i hele kjeden
//   · seksjonskort/rader/flater i arket (synlige, ≥ 120×40): ingen gjennomsiktig bakgrunn (0 < alfa < 1), ingen
//     backdrop-filter noe sted, ingen opasitet < 1 på flater
//   · «Mellomrom» (ki-spacing-editor), når den finnes: dekkende kort, ingen blur/opasitet
//   node test/ark36-check.mjs [navnefilter]
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
mkdirSync('test/.build', { recursive: true });
mkdirSync('test/.vendor', { recursive: true });
const BC = resolve('test/.vendor/bubble-card.js');
if (!existsSync(BC)) execFileSync('curl', ['-sSL', '-o', BC, 'https://raw.githubusercontent.com/Clooos/Bubble-Card/main/dist/bubble-card.js']);
const bundle = resolve(`test/.build/ark36-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const popups = JSON.parse(execFileSync('python3', ['-c', "import yaml,json;d=yaml.safe_load(open('examples/dashboard.yaml'));print(json.dumps([c for s in d['views'][0]['sections'] for c in s['cards'] if c.get('card_type')=='pop-up']))"]).toString());
const mocks = readdirSync('test/mock').filter((f) => f.endsWith('.js')).sort().map((f) => resolve('test/mock/' + f));
const only = process.argv[2];
const browser = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
let fails = 0, sheets = 0;
const ok = (name, cond, info) => { if (!cond) fails++; console.log(`${cond ? '✔' : '✘'} ${name}${info != null && !cond ? ' · ' + JSON.stringify(info).slice(0, 900) : ''}`); };
const errs = [];

for (const pop of popups) {
  if (only && !pop.name.includes(only) && !pop.hash.includes(only)) continue;
  for (const theme of ['dark', 'light']) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    page.on('pageerror', (e) => errs.push(`${pop.hash}: ${e.message}`));
    await page.goto('file://' + resolve('test/harness-bubble.html'));
    for (const m of mocks) await page.addScriptTag({ path: m });
    await page.addScriptTag({ path: bundle });
    await page.addScriptTag({ path: BC, type: 'module' });
    await page.waitForFunction(() => customElements.get('bubble-card'), null, { timeout: 15000 });
    const r = await page.evaluate(async ({ pop, theme }) => {
      const wait = (ms) => new Promise((q) => setTimeout(q, ms));
      const H = window.mockHass(); H.themes = { ...(H.themes || {}), darkMode: theme === 'dark' };
      await MSH.store.load(H);
      MSH.setGlassTheme(true); document.documentElement.dataset.kiGlass = '1'; // verste tilfelle: Liquid Glass på
      const bc = document.createElement('bubble-card'); bc.setConfig(pop); bc.hass = H; document.getElementById('dash').appendChild(bc);
      await wait(400);
      location.hash = pop.hash;
      await wait(1300);
      const deepAll = (root) => { const out = []; const walk = (r) => r.querySelectorAll('*').forEach((e) => { out.push(e); if (e.shadowRoot && e.localName !== 'ha-icon') walk(e.shadowRoot); }); walk(root || document); return out; };
      const card = deepAll().find((e) => /^msh-.*-card$/.test(e.localName) && e.localName !== 'msh-navbar-card' && !/^msh-/.test(((e.getRootNode() || {}).host || {}).localName || ''));
      if (!card) return { err: 'fant ikke kortet' };
      if (MSH.theme && MSH.theme.update) MSH.theme.update(H);
      const n0 = MSH.portals().length;
      try { card.customize('spacing'); } catch (e) { return { err: 'customize: ' + e.message }; }
      await wait(900);
      const P = MSH.portals().filter((p) => p.isConnected && p.classList.contains('on'));
      if (P.length <= n0 && !P.length) return { none: true, card: card.localName };
      const host = P[P.length - 1], sh = host.shadowRoot.querySelector('.sh');
      const tr = (c) => { if (!c || c === 'transparent') return 0; const m = /rgba?\(([^)]+)\)/.exec(c); if (!m) return 1; const p = m[1].split(/[ ,/]+/).filter(Boolean); return p.length > 3 ? Number(p[3]) : 1; };
      const cs = getComputedStyle(sh);
      let op = 1, inPop = false; for (let n = sh; n; n = n.parentNode || n.host) { if (n.nodeType === 1) { op *= Number(getComputedStyle(n).opacity); if (n.classList && n.classList.contains('bubble-pop-up')) inPop = true; } }
      const vis = (e) => { for (let n = e; n && n.nodeType === 1; n = n.parentElement) { const c = getComputedStyle(n); if (c.display === 'none' || c.visibility === 'hidden' || Number(c.opacity) === 0) return false; } const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
      const bad = [];
      const nm = (e) => (e.localName + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).slice(0, 3).join('.') : '')).slice(0, 48);
      deepAll(sh).forEach((e) => { // bare selve arket (bakteppet .bg er bevisst rgba + blur)
        if (!vis(e) || e.closest('[data-ki-island]')) return;
        const c = getComputedStyle(e), r = e.getBoundingClientRect(), a = tr(c.backgroundColor), surf = a > 0 || c.backgroundImage !== 'none';
        if (c.backdropFilter && c.backdropFilter !== 'none' && !/gd-lens/.test(e.className)) bad.push(['backdrop-filter', nm(e), c.backdropFilter]);
        if (r.width >= 120 && r.height >= 40 && a > 0 && a < 1 && c.backgroundImage === 'none') bad.push(['bg', nm(e), c.backgroundColor, Math.round(r.width) + '×' + Math.round(r.height)]);
        if (surf && r.width >= 120 && r.height >= 40 && Number(c.opacity) < 1) bad.push(['opacity', nm(e), c.opacity]);
      });
      const ks = deepAll(host.shadowRoot).find((e) => e.localName === 'ki-spacing-editor' && vis(e));
      const box = ks && ks.shadowRoot.querySelector('.box'), bcs = box && getComputedStyle(box);
      const title = (deepAll(host.shadowRoot).find((e) => e.classList && (e.classList.contains('tt') || e.matches('h1,h2,.title,.ttl b,.hd b')) && vis(e)) || {}).textContent;
      return { card: card.localName, title: (title || '').trim().slice(0, 40), bg: cs.backgroundColor, img: cs.backgroundImage, bf: cs.backdropFilter, op, inPop, glassHost: host.hasAttribute('data-glass'), bad: bad.slice(0, 8), nBad: bad.length,
        sp: box ? { bg: bcs.backgroundColor, bf: bcs.backdropFilter, op: bcs.opacity } : null };
    }, { pop, theme });
    const tag = `${pop.name} ${pop.hash} (${theme})`;
    if (r.err) ok(`${tag}: ${r.err}`, false, r);
    else if (r.none) console.log(`·  ${tag}: ${r.card} har ikke eget Tilpass-ark – hoppet over`);
    else {
      sheets++;
      ok(`${tag} «${r.title}»: arket helt dekkende (${r.bg}), ingen blur/opasitet, portalt`, tr1(r.bg) === 1 && (r.bf === 'none' || !r.bf) && r.op === 1 && !r.inPop && !r.glassHost, r);
      ok(`${tag}: ingen gjennomsiktige seksjonskort/rader, ingen backdrop-filter i arket`, !r.nBad, r.bad);
      if (r.sp) ok(`${tag}: «Mellomrom» dekkende (${r.sp.bg})`, tr1(r.sp.bg) === 1 && r.sp.bf === 'none' && r.sp.op === '1', r.sp);
    }
    await page.close();
  }
}
function tr1(c) { if (!c || c === 'transparent') return 0; const m = /rgba?\(([^)]+)\)/.exec(c); if (!m) return 1; const p = m[1].split(/[ ,/]+/).filter(Boolean); return p.length > 3 ? Number(p[3]) : 1; }
await browser.close();
try { unlinkSync(bundle); } catch (e) { /* */ }
if (errs.length) console.log('Sidefeil:', [...new Set(errs)].slice(0, 8));
console.log(`\n${sheets} ark kontrollert`);
console.log(fails || errs.length ? `${fails} feilet` : 'Alle bestod');
process.exit(fails || errs.length ? 1 : 0);
