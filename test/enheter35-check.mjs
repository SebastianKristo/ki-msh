// Fiks 35 (oppfølging 33.3) · «Enheter» i Tilpass-arket (Mer → Tilpass): raden åpner enhetsoversikten som før lå nederst
// i Innstillinger (msh-settings-card, view: 'devices') – gi nytt navn, nullstill, slett (ki-store devices.<id>), lys + mørk.
// Kjør: node test/enheter35-check.mjs
import { createRequire } from 'node:module';
import { readdirSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
mkdirSync(resolve('test/.build'), { recursive: true });
const bundle = resolve(`test/.build/enh35-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const res = [];
const ok = (name, c, info) => res.push(`${c ? '✔' : '✘'} ${name}${info != null ? ' · ' + JSON.stringify(info) : ''}`);
const lum = (c) => { const m = c.match(/[\d.]+/g).map(Number); const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]); };
const cr = (a, x) => { const p = lum(a), q = lum(x); return (Math.max(p, q) + 0.05) / (Math.min(p, q) + 0.05); };
for (const dark of [true, false]) {
  const tag = dark ? 'mørk' : 'lys';
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + resolve('test/harness.html'));
  await p.evaluate(() => { localStorage.setItem('ki-device-id', 'dtest'); window.__userData = { ki_dashboard: { devices: { dtest: { name: 'Denne', seen: Date.now() }, dipad: { name: 'iPad kjøkken', seen: Date.now() - 3600e3, cards: { 'pop-kamera': { cols: 2 } } }, dmac: { name: 'Mac kontor', seen: Date.now() - 7200e3, cards: { 'pop-person-x': { a: 1 } } } } } }; });
  for (const m of readdirSync('test/mock').sort()) await p.addScriptTag({ path: resolve('test/mock/' + m) });
  await p.addScriptTag({ path: bundle });
  const r = await p.evaluate(async (dark) => {
    const M = window.MSH, w = (ms) => new Promise((q) => setTimeout(q, ms));
    const H = window.mockHass(); H.themes = { ...(H.themes || {}), darkMode: dark };
    const c = document.createElement('msh-navbar-card'); c.setConfig({ type: 'custom:msh-navbar-card', card_id: 'ki-navbar' }); c.hass = H;
    document.getElementById('dash').appendChild(c);
    if (M.store && M.store.load) await M.store.load(H);
    await w(600);
    const out = { store: !!(M.store && M.store.loaded) };
    c._tilpassSheet(); await w(450);
    const tp = M.portals().find((x) => x.hasAttribute('data-tilpass'));
    const row = tp && tp.shadowRoot.querySelector('.tpr[data-v="devices"]');
    out.rows = tp ? [...tp.shadowRoot.querySelectorAll('.tpr')].map((e) => e.dataset.v) : [];
    out.row = row && { t: row.querySelector('b').textContent, sub: row.querySelector('i').textContent, h: Math.round(row.getBoundingClientRect().height) };
    const hap = []; window.addEventListener('haptic', (e) => hap.push(e.detail));
    if (row) row.click();
    await w(600);
    out.tpOpen = M.portals().some((x) => x.hasAttribute('data-tilpass'));
    const dv = M.portals().find((x) => x.hasAttribute('data-enheter'));
    out.dv = !!dv; out.hap = hap.slice();
    if (!dv) return out;
    const R = dv.shadowRoot, card = R.querySelector('msh-settings-card'), CR = card && card.shadowRoot;
    out.title = (R.querySelector('.tpt') || {}).textContent; out.done = (R.querySelector('.tpd') || {}).textContent;
    const rows = CR ? [...CR.querySelectorAll('.dv')] : [];
    out.names = rows.map((e) => e.querySelector('.tx b').textContent);
    out.noOther = CR ? !CR.querySelector('[data-act="ed"], [data-act="glass"], .who') : null;
    const ipad = rows.find((e) => /iPad/.test(e.textContent));
    out.btns = ipad ? [...ipad.querySelectorAll('button')].map((x) => x.dataset.act) : [];
    const grp = CR && CR.querySelector('.grp'), b0 = ipad && ipad.querySelector('.tx b'), i0 = ipad && ipad.querySelector('.tx i');
    out.col = grp && { bg: getComputedStyle(grp).backgroundColor, t: getComputedStyle(b0).color, s: getComputedStyle(i0).color, pop: getComputedStyle(R.querySelector('.sh')).backgroundColor };
    if (!ipad) { out.html = CR ? CR.innerHTML.slice(0, 600) : 'no card'; return out; }
    // gi nytt navn
    ipad.querySelector('[data-act="devren"]').click(); await w(200);
    const inp = CR.querySelector('[data-input="devname"]'); inp.value = 'iPad stue'; inp.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    CR.querySelector('button[data-act="devname"]').click(); await w(400);
    out.renamed = M.store.get('devices.dipad.name');
    // nullstill (to trykk)
    const q = () => [...CR.querySelectorAll('.dv')].find((e) => /iPad/.test(e.textContent)) || (() => { throw new Error('ingen iPad-rad: ' + CR.innerHTML.replace(/<style>[\s\S]*?<\/style>/, '').slice(0, 600)); })();
    q().querySelector('[data-act="devreset"]').click(); await w(200);
    out.resetAsk = (q().querySelector('[data-act="devreset"]') || {}).textContent;
    q().querySelector('[data-act="devreset"]').click(); await w(400);
    out.reset = JSON.stringify(M.store.get('devices.dipad.cards') || null);
    out.resetGone = ![...CR.querySelectorAll('.dv')].some((e) => /iPad/.test(e.textContent)); // listen viser bare enheter med eget oppsett
    // slett (to trykk) – Mac-en
    const qm = () => [...CR.querySelectorAll('.dv')].find((e) => /Mac/.test(e.textContent));
    qm().querySelector('[data-act="devdel"]').click(); await w(200);
    qm().querySelector('[data-act="devdel"]').click(); await w(400);
    out.deleted = M.store.get('devices.dmac') == null;
    out.saved = !!(window.__userData.ki_dashboard && window.__userData.ki_dashboard.devices && !window.__userData.ki_dashboard.devices.dmac);
    // Ferdig lukker
    R.querySelector('.tpd').click(); await w(500);
    out.closed = !M.portals().some((x) => x.hasAttribute('data-enheter'));
    return out;
  }, dark);
  ok(`${tag}: ki-store lastet`, r.store, r);
  ok(`${tag}: «Enheter»-rad i Tilpass-arket (sist, 64 px)`, r.rows[r.rows.length - 1] === 'devices' && r.row && r.row.t === 'Enheter' && r.row.h === 64 && /2 enheter med eget oppsett/.test(r.row.sub), { rows: r.rows, row: r.row });
  ok(`${tag}: trykk lukker Tilpass og åpner «Enheter»-arket`, !r.tpOpen && r.dv && r.title === 'Enheter' && /Ferdig/.test(r.done || '') && r.hap.includes('light'), r);
  ok(`${tag}: enhetsoversikten (samme som før i Innstillinger), uten resten av Innstillinger`, r.names && r.names.some((x) => /iPad kjøkken/.test(x)) && r.noOther, { names: r.names, noOther: r.noOther });
  ok(`${tag}: knapper gi nytt navn / nullstill / slett`, ['devren', 'devreset', 'devdel'].every((x) => (r.btns || []).includes(x)), r.btns);
  ok(`${tag}: gi nytt navn lagres`, r.renamed === 'iPad stue', r.renamed);
  ok(`${tag}: nullstill (bekreft) fjerner eget oppsett`, /Nullstill\?/.test(r.resetAsk || '') && r.reset === 'null' && r.resetGone, { ask: r.resetAsk, reset: r.reset, gone: r.resetGone });
  ok(`${tag}: slett (bekreft) fjerner enheten`, r.deleted && r.saved, { d: r.deleted, s: r.saved });
  ok(`${tag}: Ferdig lukker arket`, r.closed);
  if (r.col) {
    if (dark) ok('mørk: som før (#3a3a3a kort, #fafafa/#979797 tekst)', r.col.bg === 'rgb(58, 58, 58)' && r.col.t === 'rgb(250, 250, 250)' && r.col.s === 'rgb(151, 151, 151)', r.col);
    else ok('lys: hvitt kort, mørk tekst ≥ 4,5:1', r.col.bg === 'rgb(255, 255, 255)' && cr(r.col.bg, r.col.t) >= 4.5 && cr(r.col.bg, r.col.s) >= 4.5, r.col);
  }
  ok(`${tag}: ingen sidefeil`, !errs.length, errs);
  await p.close();
}
await b.close();
res.forEach((x) => console.log(x));
const bad = res.filter((x) => x.startsWith('✘')).length;
console.log(bad ? `enheter35-check: ${bad} FEIL` : `enheter35-check: OK (${res.length})`);
process.exit(bad ? 1 : 0);
