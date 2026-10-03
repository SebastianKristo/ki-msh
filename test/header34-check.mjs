// Fiks 34.2 → Fiks 37 · «Bytt sted» i hjem-headeren (meny-design Hjem v3, logikk fra family-status-card):
//  · radene: fargeflis + navn + «Du er her» / chevron (ingen «server=…»-linje), overskrift «Bytt sted», «Tilpass …»
//  · bytte (i appen OG i nettleser – appdeteksjon brukes ikke lenger): window.open(homeassistant://navigate/<sti>?server=<navn>)
//    der sti = stedets sti || server_sti || første segment av location.pathname || lovelace; navnet kodes bare for
//    & ? # % og mellomrom (Strømstad står ukodet). ALDRI location.href, ingen toast. Haptic selection, menyen lukkes.
//  · «Du er her» følger serveren (location_name / server_navn) – ikke trykket
//  · Tilpass header → Steder: navn, server, ikon, farge, sti (ikke path/navigation_path/url)
// Kjør: node test/header34-check.mjs
import { createRequire } from 'node:module';
import { readdirSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
mkdirSync(resolve('test/.build'), { recursive: true });
const bundle = resolve(`test/.build/hdr34-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const res = [];
const ok = (name, c, info) => res.push(`${c ? '✔' : '✘'} ${name}${info != null ? ' · ' + JSON.stringify(info) : ''}`);
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
// http-opphav så location.pathname kan være en dashbord-sti (/ki-dashboard/hjem)
await p.route('http://ki.test/**', (rt) => { const u = new URL(rt.request().url()); const f = u.pathname.endsWith('.js') ? resolve('test/' + u.pathname.split('/').pop()) : resolve('test/harness.html'); rt.fulfill({ path: f }); });
await p.goto('http://ki.test/ki-dashboard/hjem');
for (const m of readdirSync('test/mock').sort()) await p.addScriptTag({ path: resolve('test/mock/' + m) });
await p.addScriptTag({ path: bundle });
const r = await p.evaluate(async () => {
  const M = window.MSH, w = (ms) => new Promise((q) => setTimeout(q, ms || 0));
  const deepAll = (sel) => { const o = []; const x = (rt) => rt.querySelectorAll('*').forEach((e) => { if (e.matches(sel)) o.push(e); if (e.shadowRoot) x(e.shadowRoot); }); x(document); return o; };
  const menu = () => deepAll('.msh-servermeny')[0] || null;
  const out = {};
  const hap = []; window.addEventListener('haptic', (e) => hap.push(e.detail));
  const opened = [], toasts = [];
  window.open = (u) => { opened.push(u); return null; };
  const oT = M.toast; M.toast = (t, o) => { toasts.push(t); return oT(t, o); };
  const href0 = location.href;
  document.getElementById('dash').innerHTML = '';
  const h = window.mockHass(); h.config = { ...(h.config || {}), location_name: 'Oslo' };
  const c = document.createElement('msh-hjem-header-card');
  c.setConfig({ type: 'custom:msh-hjem-header-card', card_id: 'hd34', mode: 'hjem', servere: [{ navn: 'Oslo', ikon: 'mdi:office-building', farge: 'var(--green)' }, { navn: 'Toten', sti: '/lovelace/gard' }, { navn: 'Strømstad' }, { navn: 'Hytta', server: 'Min hytte & co' }] });
  c.hass = h; document.getElementById('dash').appendChild(c);
  await w(300);
  const open = async () => { c.shadowRoot.querySelector('.ttl').click(); await w(400); };
  const rowsOf = () => [...menu().shadowRoot.querySelectorAll('.rad:not(.tilpass)')].map((e) => ({ t: e.textContent.replace(/\s+/g, ' ').trim(), n: e.querySelector('.navn').textContent, icons: e.querySelectorAll('ha-icon').length, her: !!e.querySelector('.her'), ic: e.querySelector('.flis ha-icon').getAttribute('icon') }));
  await open();
  out.head = menu().shadowRoot.querySelector('.topp').textContent;
  out.rows = rowsOf();
  out.tilpass = !!menu().shadowRoot.querySelector('.rad.tilpass');
  hap.length = 0;
  [...menu().shadowRoot.querySelectorAll('.rad')].find((e) => /Strømstad/.test(e.textContent)).click(); await w(300);
  out.s1 = { opened: opened.slice(), hap: hap.slice(), open: !!menu(), toasts: toasts.slice(), href: location.href === href0 };
  // «Du er her» følger serveren (location_name), ikke trykket
  await open();
  out.here2 = rowsOf().filter((x) => x.her).map((x) => x.n);
  [...menu().shadowRoot.querySelectorAll('.rad')].find((e) => /Toten/.test(e.textContent)).click(); await w(300);
  await open();
  [...menu().shadowRoot.querySelectorAll('.rad')].find((e) => /Hytta/.test(e.textContent)).click(); await w(300);
  out.urls = opened.slice();
  // også i «appen»: samme window.open (ingen location.href)
  window.externalApp = {};
  await open();
  [...menu().shadowRoot.querySelectorAll('.rad')].find((e) => /Strømstad/.test(e.textContent)).click(); await w(300);
  delete window.externalApp;
  out.app = { last: opened[opened.length - 1], n: opened.length, href: location.href === href0, toasts: toasts.slice() };
  // editor: felt navn / server / ikon / farge / sti
  const ed = c.constructor.getConfigElement(); ed.hass = c.hass; ed.setConfig({ type: 'custom:msh-hjem-header-card', servere: [{ navn: 'Bergen' }] });
  document.body.appendChild(ed); await w(200);
  const R = ed.shadowRoot;
  const sec = R.querySelector('details[data-focus="servers"]'); if (sec) { sec.open = true; await w(100); }
  const ob = R.querySelector('[data-a="x-ropen"][data-n="servere"][data-i="0"]'); if (ob) { ob.click(); await w(100); }
  out.fields = ['navn', 'server', 'ikon', 'farge', 'sti', 'path', 'navigation_path', 'url'].map((f) => !!R.querySelector(`[data-name="servere.0.${f}"]`));
  ed.remove();
  return out;
});
console.log(JSON.stringify(r));
ok('overskrift «Bytt sted» + «Tilpass …»', r.head === 'Bytt sted' && r.tilpass, [r.head, r.tilpass]);
ok('radene: fargeflis + navn + «Du er her»/chevron, ingen server=-linje', r.rows.length === 4 && r.rows.every((x) => !/server=/.test(x.t) && x.icons === (x.her ? 1 : 2)) && r.rows.map((x) => x.n).join() === 'Oslo,Toten,Strømstad,Hytta' && r.rows[0].her && /Du er her/.test(r.rows[0].t), r.rows);
ok('eget ikon vinner, ellers standardikon', r.rows[0].ic === 'mdi:office-building' && r.rows[1].ic === 'mdi:tractor' && r.rows[2].ic === 'mdi:sail-boat', r.rows.map((x) => x.ic));
ok('bytt: window.open(homeassistant://navigate/ki-dashboard?server=Strømstad) – ø ukodet, samme dashbord', r.s1.opened[0] === 'homeassistant://navigate/ki-dashboard?server=Strømstad', r.s1.opened);
ok('bytt: haptic selection, menyen lukkes, ingen toast, location.href urørt', r.s1.hap.includes('selection') && !r.s1.open && !r.s1.toasts.length && r.s1.href, r.s1);
ok('«Du er her» følger serveren (location_name), ikke trykket', r.here2.join() === 'Oslo', r.here2);
ok('stedets egen sti (ledende / fjernes) · navnet i appen kodes bare for & og mellomrom', r.urls[1] === 'homeassistant://navigate/lovelace/gard?server=Toten' && r.urls[2] === 'homeassistant://navigate/ki-dashboard?server=Min%20hytte%20%26%20co', r.urls);
ok('i appen: samme window.open, aldri location.href', r.app.n === 4 && r.app.last === 'homeassistant://navigate/ki-dashboard?server=Strømstad' && r.app.href && !r.app.toasts.length, r.app);
ok('Tilpass header → Steder: navn, server, ikon, farge, sti (ikke path/navigation_path/url)', r.fields.slice(0, 5).every(Boolean) && !r.fields.slice(5).some(Boolean), r.fields);
ok('ingen sidefeil', !errs.length, errs);
await b.close();
res.forEach((x) => console.log(x));
const bad = res.filter((x) => x.startsWith('✘')).length;
console.log(bad ? `header34-check: ${bad} FEIL` : `header34-check: OK (${res.length})`);
process.exit(bad ? 1 : 0);
