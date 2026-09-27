// Fiks 15.4: hold på header-tittelen eller andre steder i Hjem skal aldri åpne HA more-info for interne
// plassholdere (data-ent="__tilpass"). Hold på tittelen = kiosk-modus (toast), hold ellers i headeren = «Tilpass header».
import { createRequire } from 'node:module';
import { readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const bundle = resolve(`test/.build/hold-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const res = {};
for (const touch of [false, true]) {
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: touch });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + resolve('test/harness.html'));
  for (const m of readdirSync('test/mock').sort()) await p.addScriptTag({ path: resolve('test/mock/' + m) });
  await p.addScriptTag({ path: bundle });
  await p.evaluate(async () => {
    window.__mi = []; window.__ed = [];
    window.addEventListener('hass-more-info', (e) => window.__mi.push(e.detail.entityId), true);
    document.addEventListener('hass-more-info', (e) => window.__mi.push(e.detail.entityId), true);
    window.addEventListener('ki-open-editor', (e) => window.__ed.push(e.detail.editor));
    const h = window.mockHass(); window.__h = h;
    const c = document.createElement('msh-hjem-card'); c.setConfig({ type: 'custom:msh-hjem-card', card_id: 'ki-home' }); c.hass = h;
    document.getElementById('dash').appendChild(c);
    await new Promise((q) => setTimeout(q, 800));
  });
  const all = `(() => { const o = []; const w = (r) => r.querySelectorAll('*').forEach((e) => { o.push(e); if (e.shadowRoot) w(e.shadowRoot); }); w(document); return o; })()`;
  const box = async (pred) => p.evaluate(`(() => { const e = ${all}.find(${pred}); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + Math.min(20, r.width / 2), y: r.top + r.height / 2 }; })()`);
  const hold = async (pt) => {
    if (touch) { const c = await p.context().newCDPSession(p); await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pt.x, y: pt.y }] }); await p.waitForTimeout(900); await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); }
    else { await p.mouse.move(pt.x, pt.y); await p.mouse.down(); await p.waitForTimeout(900); await p.mouse.up(); }
    await p.waitForTimeout(400);
  };
  const T = touch ? 'touch' : 'mus';
  // tittelen (stedsnavn/hilsen)
  const title = await box(`(e) => e.localName && /^(h1|h2)$|title|ttl|greet/.test((e.className && e.className.baseVal === undefined ? e.className : '') + ' ' + e.localName) && e.getRootNode().host && e.getRootNode().host.localName === 'msh-hjem-header-card' && e.getBoundingClientRect().height > 10`);
  if (title) await hold(title);
  res[T + '_tittel'] = await p.evaluate(() => ({ mi: window.__mi.slice(), ed: window.__ed.slice(), calls: (window.__h.__calls || []).length }));
  await p.evaluate(() => { window.__mi = []; window.__ed = []; });
  // prosa-kortet (data-ent="__tilpass")
  const pz = await box(`(e) => e.classList && e.classList.contains('pz') && e.getBoundingClientRect().height > 10`);
  if (pz) await hold(pz);
  res[T + '_prosa'] = await p.evaluate(() => ({ mi: window.__mi.slice() }));
  res[T + '_errors'] = errs;
  res[T + '_found'] = { title: !!title, prosa: !!pz };
  await p.close();
}
await b.close();
console.log(JSON.stringify(res, null, 1));
const bad = Object.keys(res).filter((k) => /_(tittel|prosa)$/.test(k) && res[k].mi.some((id) => String(id).startsWith('__')));
const ok = !bad.length && !res.mus_errors.length && !res.touch_errors.length && res.mus_found.title && res.mus_found.prosa;
console.log(ok ? 'OK – ingen more-info for interne plassholdere' : 'FEIL – ' + bad.join(', '));
process.exit(ok ? 0 : 1);
