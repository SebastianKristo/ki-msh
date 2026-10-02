// Fiks 34.2 · «Bytt sted» i hjem-headeren (fasit Hjem v3 servers/serverMenu):
//  · radene viser bare ikon + navn (+ chevron), ingen «server=…»-linje
//  · i HA Companion-appen (window.externalApp / webkit.messageHandlers.externalBus / UA «Home Assistant»):
//    window.location.href = homeassistant://navigate/<dashbord-path>?server=<navn URL-kodet> (path = location.pathname uten
//    ledende /, eller stedets egen path) · haptic · menyen lukkes · «Du er her» flyttes til stedet
//  · i nettleser: toast «Bytt server i appen», ingen navigering (også når eldre url er satt)
//  · Tilpass header → Steder: name, icon, color, path
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
  const out = {};
  const hap = []; window.addEventListener('haptic', (e) => hap.push(e.detail));
  const nav = [], toasts = [];
  M.hjemNavigate = (u) => nav.push(u);
  const oT = M.toast; M.toast = (t, o) => { toasts.push(t); return oT(t, o); };
  // dashbord-sti som i HA: /ki-dashboard/hjem
  out.curPath = M.hjemCurPath();
  document.getElementById('dash').innerHTML = '';
  const h = window.mockHass(); h.config = { ...(h.config || {}), location_name: 'Oslo' };
  const c = document.createElement('msh-hjem-header-card');
  c.setConfig({ type: 'custom:msh-hjem-header-card', card_id: 'hd34', servers: [{ name: 'Oslo', icon: 'mdi:office-building', color: 'var(--green)' }, { name: 'Toten', icon: 'mdi:tractor', color: 'var(--yellow)', path: '/lovelace/gard' }, { name: 'Strømstad', icon: 'mdi:sail-boat', color: 'var(--blue)', url: 'https://stromstad.example' }], servers_init: true });
  c.hass = h; document.getElementById('dash').appendChild(c);
  await w(300);
  const open = async () => { c._serverMenu(c.shadowRoot.querySelector('.ttl') || c); await w(300); };
  const rowsOf = () => deepAll('.sv').map((e) => ({ t: e.textContent.trim(), srv: !!e.querySelector('.srv'), icons: e.querySelectorAll('ha-icon').length, nm: e.querySelector('.nm b').textContent }));
  // nettleser
  const UA = navigator.userAgent;
  out.isAppBrowser = M.hjemIsApp();
  await open();
  out.rows = rowsOf();
  out.me = (deepAll('.me')[0] || {}).textContent;
  hap.length = 0;
  deepAll('.sv[data-i="2"]')[0].click(); await w(300);
  out.web = { nav: nav.slice(), toasts: toasts.slice(), hap: hap.slice(), open: !!c._srv };
  // app via externalApp
  window.externalApp = {}; out.isApp1 = M.hjemIsApp(); delete window.externalApp;
  // app via webkit externalBus
  window.webkit = { messageHandlers: { externalBus: { postMessage() {} } } }; out.isApp2 = M.hjemIsApp(); delete window.webkit;
  // app via UA
  Object.defineProperty(navigator, 'userAgent', { configurable: true, get: () => UA + ' Home Assistant/2025.1' }); out.isApp3 = M.hjemIsApp();
  // trykk Strømstad i appen → URL-koding + nåværende path
  await open();
  hap.length = 0; toasts.length = 0;
  deepAll('.sv[data-i="2"]')[0].click(); await w(300);
  out.app1 = { nav: nav.slice(), hap: hap.slice(), open: !!c._srv, toasts: toasts.slice(), here: c._server().name };
  // «Du er her» oppdateres: Strømstad øverst, Oslo i listen
  await open();
  out.me2 = (deepAll('.me')[0] || {}).textContent; out.rows2 = rowsOf().map((x) => x.nm);
  // Toten med egen path
  deepAll('.sv').find((e) => /Toten/.test(e.textContent)).click(); await w(300);
  out.app2 = nav[nav.length - 1];
  delete navigator.userAgent;
  // editor: felt name / icon / color / path
  const ed = c.constructor.getConfigElement(); ed.hass = c.hass; ed.setConfig({ type: 'custom:msh-hjem-header-card', servers: [{ name: 'Bergen' }], servers_init: true });
  document.body.appendChild(ed); await w(200);
  const R = ed.shadowRoot;
  const sec = R.querySelector('details[data-focus="servers"]'); if (sec) { sec.open = true; await w(100); }
  const ob = R.querySelector('[data-a="x-ropen"][data-n="servers"][data-i="0"]'); if (ob) { ob.click(); await w(100); }
  out.fields = ['name', 'icon', 'color', 'path', 'navigation_path', 'url'].map((f) => !!R.querySelector(`[data-name="servers.0.${f}"]`));
  ed.remove();
  return out;
});
console.log(JSON.stringify(r));
ok('nåværende path fra location.pathname uten ledende /', r.curPath === 'ki-dashboard/hjem', r.curPath);
ok('radene: bare ikon + navn + chevron (ingen server=-linje)', r.rows.length === 2 && r.rows.every((x) => !x.srv && !/server=/.test(x.t) && x.icons === 2) && r.rows.map((x) => x.nm).join() === 'Toten,Strømstad', r.rows);
ok('«Du er her» uten server=', /Oslo/.test(r.me) && /Du er her/.test(r.me) && !/server=/.test(r.me), r.me);
ok('nettleser: ikke app', r.isAppBrowser === false);
ok('nettleser: toast «Bytt server i appen», ingen navigering (url brukes ikke)', !r.web.nav.length && r.web.toasts.includes('Bytt server i appen') && !r.web.open, r.web);
ok('nettleser: haptic + menyen lukkes', r.web.hap.length >= 1 && !r.web.open, r.web);
ok('appdeteksjon: externalApp / webkit externalBus / UA «Home Assistant»', r.isApp1 && r.isApp2 && r.isApp3, [r.isApp1, r.isApp2, r.isApp3]);
ok('app: homeassistant://navigate/ki-dashboard/hjem?server=Str%C3%B8mstad', r.app1.nav[0] === 'homeassistant://navigate/ki-dashboard/hjem?server=Str%C3%B8mstad', r.app1);
ok('app: haptic, menyen lukkes, ingen toast', r.app1.hap.length >= 1 && !r.app1.open && !r.app1.toasts.length, r.app1);
ok('app: «Du er her» oppdateres', r.app1.here === 'Strømstad' && /Strømstad/.test(r.me2) && r.rows2.join() === 'Oslo,Toten', { here: r.app1.here, me2: r.me2, rows2: r.rows2 });
ok('app: stedets egen path brukes (ledende / fjernes)', r.app2 === 'homeassistant://navigate/lovelace/gard?server=Toten', r.app2);
ok('Tilpass header → Steder: name, icon, color, path (ikke navigation_path/url)', r.fields.slice(0, 4).every(Boolean) && !r.fields[4] && !r.fields[5], r.fields);
ok('ingen sidefeil', !errs.length, errs);
await b.close();
res.forEach((x) => console.log(x));
const bad = res.filter((x) => x.startsWith('✘')).length;
console.log(bad ? `header34-check: ${bad} FEIL` : `header34-check: OK (${res.length})`);
process.exit(bad ? 1 : 0);
