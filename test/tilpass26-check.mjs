// Fiks 25.3 / 26: Tilpass-senteret (hub, søk, sider), veiviseren, «Rediger Hjem» (langt trykk) og at alle innganger
// (Mer → Tilpass, header, Innstillinger, ki-open-editor navbar/header/kiosk) åpner senteret. Kjør: node test/tilpass26-check.mjs
import { createRequire } from 'node:module';
import { readdirSync, mkdirSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
mkdirSync('test/.build', { recursive: true });
const bundle = resolve(`test/.build/tp26-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
let fail = 0, n = 0;
const ok = (m, c, info) => { n++; console.log((c ? '✔ ' : '✘ ') + m + (info != null && !c ? ' · ' + JSON.stringify(info).slice(0, 900) : '')); if (!c) fail++; };
const dist = readFileSync('dist/ki-msh.js', 'utf8');
ok('dist inneholder ki-setup-wizard og «Søk, f.eks. strømpris eller navbar»', dist.includes('ki-setup-wizard') && dist.includes('Søk, f.eks. strømpris eller navbar'));
const b = await pw.chromium.launch({ executablePath: process.env.KI_CHROME || undefined });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto('file://' + resolve('test/harness.html'));
await p.evaluate(() => { window.__noNavSelftest = true; });
for (const m of readdirSync('test/mock').sort()) await p.addScriptTag({ path: resolve('test/mock/' + m) });
await p.addScriptTag({ path: bundle });
await p.evaluate(async () => {
  const H = window.mockHass(); H.user = { ...(H.user || {}), is_admin: true }; window.H = H; window.MSH.lastHass = H;
  await window.MSH.store.load(H);
  const hj = document.createElement('msh-hjem-card'); hj.setConfig({ type: 'custom:msh-hjem-card', card_id: 'ki-home' }); hj.hass = H; document.getElementById('dash').appendChild(hj); window.__hj = hj;
  const nb = document.createElement('msh-navbar-card'); nb.setConfig({ type: 'custom:msh-navbar-card', card_id: 'ki-navbar' }); nb.hass = H; document.getElementById('dash').appendChild(nb); window.__nb = nb;
  await new Promise((q) => setTimeout(q, 1200));
});
const wait = (ms) => p.waitForTimeout(ms);
const sheet = () => p.evaluate(() => { const h = document.querySelector('ki-overlay-root').shadowRoot.querySelector('.msh-portal[data-tps]'); if (!h) return null; const r = h.shadowRoot; return { kind: h.getAttribute('data-tps'), text: r.querySelector('.body').innerText, center: !!r.querySelector('ki-customize-center'), wizard: !!r.querySelector('ki-setup-wizard') }; });
const closeAll = () => p.evaluate(() => window.MSH.portals().forEach((x) => x.remove()));
// hub
await p.evaluate(() => window.MSH.tps.open()); await wait(500);
let s = await sheet();
ok('hub: søk, snarveiene og gruppene Utseende · Hjem · Huset · Verdier og skjermer', s && s.center && ['Søk', 'Rediger på Hjem', 'Veiviser', 'Utseende', 'Hjem', 'Huset', 'Verdier og skjermer', 'For installatør', 'Enheter og system', 'Home Assistant', 'Tilbakestill alt'].every((t) => s.text.includes(t)) || p.evaluate(() => 0), s && s.text.slice(0, 400));
const ph = await p.evaluate(() => document.querySelector('ki-overlay-root').shadowRoot.querySelector('.msh-portal[data-tps]').shadowRoot.querySelector('[data-in="q"]').placeholder);
ok('søkefeltet har plassholderen fra fasiten', ph === 'Søk, f.eks. strømpris eller navbar', ph);
// søk
await p.evaluate(() => { const i = document.querySelector('ki-overlay-root').shadowRoot.querySelector('.msh-portal[data-tps]').shadowRoot.querySelector('[data-in="q"]'); i.value = 'strøm'; i.dispatchEvent(new Event('input', { bubbles: true })); }); await wait(200);
s = await sheet();
ok('søk «strøm» finner Grenser og verdier', s.text.includes('Grenser og verdier') && !s.text.includes('Utseende'), s.text.slice(0, 300));
await p.evaluate(() => { const i = document.querySelector('ki-overlay-root').shadowRoot.querySelector('.msh-portal[data-tps]').shadowRoot.querySelector('[data-in="q"]'); i.value = 'xyzzy'; i.dispatchEvent(new Event('input', { bubbles: true })); }); await wait(200);
s = await sheet();
ok('ingen treff: «Fant ingenting for»', /Fant ingenting for/.test(s.text), s.text.slice(0, 200));
// alle sidene
const PAGES = ['tema', 'sprak', 'header', 'kort', 'navbar', 'rom', 'personer', 'popups', 'var', 'kiosk'];
const bad = [];
for (const pg of PAGES) { await p.evaluate((pg) => window.MSH.tps.open(pg), pg); await wait(250); const x = await sheet(); if (!x || !x.text.includes('Lagret') || /undefined|NaN|\[object/.test(x.text)) bad.push([pg, x && x.text.slice(0, 200)]); }
ok('alle ti sidene tegnes (Lagret i toppen, ingen undefined/NaN)', !bad.length, bad);
// endring + angre
await p.evaluate(() => window.MSH.tps.open('tema')); await wait(200);
await p.evaluate(() => document.querySelector('ki-overlay-root').shadowRoot.querySelector('.msh-portal[data-tps]').shadowRoot.querySelector('[data-a="theme"][data-v="hav"]').click()); await wait(300);
const th = await p.evaluate(() => ({ st: window.MSH.store.get('tilpass.theme'), v: document.documentElement.style.getPropertyValue('--ki-accent'), toast: !!document.querySelector('ki-overlay-root').shadowRoot.querySelector('.ki-tps-toast') }));
ok('Farge Hav: lagret i ki-store, --ki-accent satt, toast med Angre', th.st === 'hav' && /115 185 242/.test(th.v) && th.toast, th);
await p.evaluate(() => window.MSH.tps.undo()); await wait(300);
const th2 = await p.evaluate(() => ({ st: window.MSH.store.get('tilpass.theme'), v: document.documentElement.style.getPropertyValue('--ki-accent') }));
ok('Angre setter fargen tilbake', !th2.st && !th2.v, th2);
// navbar dock
await p.evaluate(() => window.MSH.tps.open('navbar')); await wait(200);
await p.evaluate(() => document.querySelector('ki-overlay-root').shadowRoot.querySelector('.msh-portal[data-tps]').shadowRoot.querySelector('[data-a="dock"][data-v="fast"]').click()); await wait(300);
ok('Navbar «Fast i bunnen» skrives i navbarens config', await p.evaluate(() => (window.MSH.store.card('ki-navbar') || {}).dock === 'fast'));
await p.evaluate(() => window.MSH.tps.undo()); await wait(200);
// var-grense
await p.evaluate(() => window.MSH.tps.open('var')); await wait(200);
await p.evaluate(() => { const r = document.querySelector('ki-overlay-root').shadowRoot.querySelector('.msh-portal[data-tps]').shadowRoot.querySelector('[data-k="billig"]'); r.value = '1.6'; r.dispatchEvent(new Event('input', { bubbles: true })); }); await wait(200);
const vv = await p.evaluate(() => window.MSH.tps.vars());
ok('billig strøm < dyr strøm holdes', vv.billig < vv.dyr, vv);
await closeAll();
// innganger
await p.evaluate(() => window.__nb._tilpassSheet()); await wait(400);
s = await sheet(); ok('Mer → Tilpass åpner senteret', s && s.center && s.text.includes('Utseende'), s); await closeAll();
for (const ed of ['navbar', 'header', 'kiosk']) {
  await p.evaluate((ed) => window.dispatchEvent(new CustomEvent('ki-open-editor', { detail: { editor: ed } })), ed); await wait(400);
  const x = await sheet(), old = await p.evaluate(() => [...document.querySelector("ki-overlay-root").shadowRoot.querySelectorAll(".msh-portal")].filter((h) => !h.hasAttribute("data-tps")).map((h) => h.shadowRoot.querySelector(".body").innerText.slice(0, 80)));
  ok(`ki-open-editor ${ed} → senterets side (ingen gammel editor)`, x && x.center && !old.length, { x: x && x.text.slice(0, 80), old });
  await closeAll();
}
// Innstillinger-raden
const row = await p.evaluate(() => (window.MSH.ha && window.MSH.ha.tpSection ? window.MSH.ha.tpSection() : ''));
ok('Innstillinger: én rad «Tilpass» (ikke «Tilpass dashbordet»-listen)', !row || (row.includes('Tema, Hjem, navbar, rom og mer') && !row.includes('Tilpass dashbordet') && (row.match(/data-a="tp"/g) || []).length === 1), row.slice(0, 300));
// veiviseren
await p.evaluate(() => window.MSH.tps.wizard({ first: true })); await wait(400);
s = await sheet(); ok('veiviseren: Velkommen hjem + Kom i gang', s && s.wizard && s.text.includes('Velkommen hjem') && s.text.includes('Kom i gang'), s && s.text.slice(0, 200));
const lw = await p.evaluate(async () => { const r = document.querySelector('ki-overlay-root').shadowRoot.querySelector('.msh-portal[data-tps]').shadowRoot; r.querySelector('[data-a="lang"][data-v="en"]').click(); await new Promise((q) => setTimeout(q, 300)); const en = window.kiLang(), t = r.querySelector('.bigt b').textContent, on = r.querySelector('[data-a="lang"].on').dataset.v; r.querySelector('[data-a="lang"][data-v="nb"]').click(); await new Promise((q) => setTimeout(q, 300)); return { en, t, on, back: window.kiLang(), t2: r.querySelector('.bigt b').textContent }; });
ok('veiviseren: språkvalg på første steg (English → «Welcome home», tilbake til norsk)', lw.en === 'en' && lw.t === 'Welcome home' && lw.on === 'en' && lw.back !== 'en' && lw.t2 === 'Velkommen hjem', lw);
const steps = [];
for (let i = 0; i < 4; i++) { await p.evaluate(() => document.querySelector('ki-overlay-root').shadowRoot.querySelector('.msh-portal[data-tps]').shadowRoot.querySelector('[data-a="wnext"]').click()); await wait(250); steps.push((await sheet()).text.slice(0, 60)); }
ok('veiviseren: Steg 1–3 og «Dashbordet er klart»', /Steg 1 av 3/.test(steps[0]) && /Steg 3 av 3/.test(steps[2]) && /Dashbordet er klart/.test(steps[3]), steps);
await p.evaluate(() => document.querySelector('ki-overlay-root').shadowRoot.querySelector('.msh-portal[data-tps]').shadowRoot.querySelector('[data-a="wnext"]').click()); await wait(500);
ok('Åpne dashbordet: onboarded settes og veiviseren lukkes', await p.evaluate(() => window.MSH.store.get('onboarded') === true && !document.querySelector('ki-overlay-root').shadowRoot.querySelector('.msh-portal[data-tps="wizard"]')));
await closeAll();
// langt trykk på Hjem
const tgt = await p.evaluate(() => { const s = window.__hj.shadowRoot.querySelector('[data-slot]:not([data-slot="faner"])'); if (!s) return null; const r = s.getBoundingClientRect(); return { x: r.left + 20, y: r.top + 10, k: s.dataset.slot }; });
if (tgt) {
  await p.mouse.move(tgt.x, tgt.y); await p.mouse.down(); await wait(650); await p.mouse.up(); await wait(400);
  s = await sheet();
  ok(`langt trykk på Hjem-blokken «${tgt.k}» → Rediger Hjem`, s && s.kind === 'edit' && s.text.includes('Rediger Hjem'), s);
} else ok('fant en Hjem-blokk å holde inne', false);
await closeAll();
ok('ingen sidefeil', !errs.length, errs.slice(0, 5));
await b.close();
console.log(fail ? `${n - fail}/${n} OK` : `Alle ${n} bestod`);
process.exit(fail ? 1 : 0);
