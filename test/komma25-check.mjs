// Fiks 25.1: ingen løse komma («,») fra en array som ble gjort om til tekst (Array.toString) i noen popup, Tilpass-ark
// eller HA-side. Leter etter tekstnoder som bare er «,» (med mellomrom) mellom elementer, i alle shadow roots.
// Kjør: node test/komma25-check.mjs
import { createRequire } from 'node:module';
import { readdirSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
mkdirSync('test/.build', { recursive: true });
const bundle = resolve(`test/.build/k25-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const BC = resolve('test/.vendor/bubble-card.js');
if (!existsSync(BC)) { mkdirSync('test/.vendor', { recursive: true }); execFileSync('curl', ['-sSL', '-o', BC, 'https://raw.githubusercontent.com/Clooos/Bubble-Card/main/dist/bubble-card.js']); }
const b = await pw.chromium.launch({ executablePath: process.env.KI_CHROME || undefined });
let fail = 0, n = 0;
const ok = (m, c, info) => { n++; console.log((c ? '✔ ' : '✘ ') + m + (info != null && !c ? ' · ' + JSON.stringify(info).slice(0, 900) : '')); if (!c) fail++; };
const p = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto('file://' + resolve('test/harness-bubble.html'));
await p.evaluate(() => { window.__noNavSelftest = true; });
for (const m of readdirSync('test/mock').sort()) await p.addScriptTag({ path: resolve('test/mock/' + m) });
await p.addScriptTag({ path: bundle });
await p.addScriptTag({ path: BC, type: 'module' });
await p.waitForFunction(() => customElements.get('bubble-card'));
// Komma-tekstnoder: tekst som bare er komma, mellom to elementer (ikke inne i vanlig tekst som «Oslo, Norge»)
await p.evaluate(() => {
  window.__commas = (label) => {
    const out = [];
    const walk = (root) => {
      const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let t = tw.nextNode(); t; t = tw.nextNode()) {
        if (!/^\s*,\s*$/.test(t.nodeValue)) continue;
        const el = t.parentNode; if (!el || el.closest && el.closest('style,script')) continue;
        const prev = t.previousSibling, next = t.nextSibling;
        if (!(prev && prev.nodeType === 1) && !(next && next.nodeType === 1)) continue;
        const host = t.getRootNode && t.getRootNode().host;
        out.push(`${label}: ${host ? host.localName + ' › ' : ''}${el.localName}.${String(el.className || '').split(' ')[0]} (etter ${prev && prev.nodeType === 1 ? prev.localName + '.' + String(prev.className || '').split(' ')[0] : '–'})`);
      }
      root.querySelectorAll('*').forEach((e) => { if (e.shadowRoot) walk(e.shadowRoot); });
    };
    walk(document);
    return out;
  };
});
const wait = (ms) => p.waitForTimeout(ms);
// Dashbordet fra strategien (alle popups)
const hashes = await p.evaluate(async () => {
  const H = window.mockHass(); H.user = { ...(H.user || {}), is_admin: true }; window.H = H; window.MSH.lastHass = H;
  await window.MSH.store.load(H);
  const S = customElements.get('ll-strategy-dashboard-ki-dashboard');
  const d = await S.generate({}, H);
  const stack = d.views[0].cards[0];
  for (const c of stack.cards) { const el = document.createElement(c.type.replace('custom:', '')); el.setConfig(c); el.hass = H; document.getElementById('dash').appendChild(el); }
  await new Promise((q) => setTimeout(q, 1500));
  return stack.cards.filter((c) => c.card_type === 'pop-up').map((c) => c.hash);
});
const found = [];
found.push(...(await p.evaluate(() => window.__commas('Hjem'))));
for (const h of hashes) {
  await p.evaluate((h) => { location.hash = h; }, h); await wait(900);
  found.push(...(await p.evaluate((h) => window.__commas(h), h)));
  await p.evaluate(() => { history.replaceState(null, '', location.pathname); window.dispatchEvent(new Event('location-changed')); window.dispatchEvent(new HashChangeEvent('hashchange')); }); await wait(250);
}
// Tilpass-arkene og HA-innstillingene
const sheets = [['navbar-tilpass', () => window.deep && 0], ['home', 'home'], ['navbar', 'navbar'], ['header', 'header']];
for (const [label, ed] of sheets.slice(1)) {
  await p.evaluate((ed) => window.dispatchEvent(new CustomEvent('ki-open-editor', { detail: { editor: ed } })), ed); await wait(900);
  found.push(...(await p.evaluate((l) => window.__commas('Tilpass ' + l), label)));
  await p.evaluate(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); window.MSH.portals().forEach((x) => x.remove()); }); await wait(300);
}
await p.evaluate(async () => { const nb = [...document.querySelectorAll('msh-navbar-card')][0]; if (nb && nb._tilpassSheet) nb._tilpassSheet(); await new Promise((q) => setTimeout(q, 600)); });
found.push(...(await p.evaluate(() => window.__commas('Tilpass-arket'))));
await p.evaluate(() => window.MSH.portals().forEach((x) => x.remove()));
const pages = await p.evaluate(() => (window.MSH.ha ? ['hub', 'updates', 'backups', 'repairs', 'system', 'general', 'logs', 'profile', 'servers', 'appdevice', 'notifs', 'automation', 'scene', 'script', 'devices', 'areas', 'labels', 'cats', 'helpers'] : []));
for (const pg of pages) {
  await p.evaluate((pg) => { try { window.MSH.ha.open(pg); } catch (e) { /* */ } }, pg); await wait(900);
  found.push(...(await p.evaluate((pg) => window.__commas('HA ' + pg), pg)));
  await p.evaluate(() => window.MSH.portals().forEach((x) => x.remove())); await wait(150);
}
ok(`ingen løse komma i ${hashes.length} popups, Hjem, Tilpass-arkene og ${pages.length} HA-sider`, !found.length, [...new Set(found)].slice(0, 30));
ok('ingen sidefeil', !errs.length, errs.slice(0, 5));
await b.close();
console.log(fail ? `${n - fail}/${n} OK` : `Alle ${n} bestod`);
process.exit(fail ? 1 : 0);
