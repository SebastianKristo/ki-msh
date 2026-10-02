// Fiks 31.7 · «Bytt sted» i hjem-headeren: standard Oslo / Toten / Strømstad uten oppsett (ikon, farge, navigation_path
// URL-kodet), «Du er her» fra hass.config.location_name (case/æøå-normalisert, ellers ?server= i URL-en), rader med
// «server=<navn>» (monospace 11 px #7f7f7f), bytte via navigation_path (app) / url (nettleser) / toast, eldre nøkler
// (url_path/fallback_url) leses, redigerbart i Tilpass header → Steder (navn, ikon, farge, navigation_path, url,
// rekkefølge, legg til/fjern, Tilbakestill) og i getConfigElement().
import { createRequire } from 'node:module';
import { readdirSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
mkdirSync(resolve('test/.build'), { recursive: true });
const bundle = resolve(`test/.build/hdr31-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const fails = [];
const ok = (c, msg) => { if (!c) fails.push(msg); };
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto('file://' + resolve('test/harness.html'));
for (const m of readdirSync('test/mock').sort()) await p.addScriptTag({ path: resolve('test/mock/' + m) });
await p.addScriptTag({ path: bundle });
p.setDefaultTimeout(60000);
const r = await p.evaluate(async () => {
  const M = window.MSH, w = (ms) => new Promise((q) => setTimeout(q, ms || 0));
  const deepAll = (sel) => { const o = []; const x = (rt) => rt.querySelectorAll('*').forEach((e) => { if (e.matches(sel)) o.push(e); if (e.shadowRoot) x(e.shadowRoot); }); x(document); return o; };
  const out = {};
  out.defs = M.hjemDefaultServers();
  const mk = async (cfg, loc) => {
    document.getElementById('dash').innerHTML = '';
    const h = window.mockHass(); h.config = { ...(h.config || {}), location_name: loc };
    const c = document.createElement('msh-hjem-header-card');
    c.setConfig({ type: 'custom:msh-hjem-header-card', card_id: 'hd31_' + Math.random().toString(36).slice(2), ...cfg });
    c.hass = h; document.getElementById('dash').appendChild(c);
    await w(300);
    return c;
  };
  let c = await mk({}, 'strømstad');
  out.here1 = c._server().cur;
  c = await mk({}, 'TOTEN');
  out.here2 = c._server().cur;
  // meny: Toten = Du er her, Oslo og Strømstad i listen med server=<navn>
  c._serverMenu(c.shadowRoot.querySelector('.ttl') || c); await w(300);
  const sv = deepAll('.sv');
  out.rows = sv.map((e) => e.querySelector('.nm b').textContent);
  out.srvLine = sv.some((e) => /server=/.test(e.textContent) || e.querySelector('.srv'));
  out.me = (deepAll('.me')[0] || {}).textContent;
  if (c._srv) c._srv.close(); await w(200);
  // bytte: app → navigation_path; nettleser → url / toast
  const nav = []; const toasts = []; const oN = M.hjemNavigate, oT = M.toast, oA = M.hjemIsApp;
  M.hjemNavigate = (u) => nav.push(u); M.toast = (t) => toasts.push(t);
  try {
    M.hjemIsApp = () => true;
    out.goApp = c._goServer(c._server().list[2]);
    M.hjemIsApp = () => false;
    out.goWeb = c._goServer(c._server().list[0]);
    out.goUrl = c._goServer({ name: 'Toten', url: 'https://toten.example/lovelace' }); // 34.2: url brukes ikke lenger
    out.goOld = (M.hjemIsApp = () => true, c._goServer({ name: 'X', url_path: 'homeassistant://navigate/lovelace?server=X%20Y' }));
  } finally { M.hjemNavigate = oN; M.toast = oT; M.hjemIsApp = oA; }
  out.nav = nav; out.toasts = toasts;
  // gamle seedede standardsteder (21.4: tomme url_path, gamle ikoner) virker og får nye ikoner
  out.old = M.hjemServerNorm({ name: 'Oslo', icon: 'mdi:city', url_path: '', fallback_url: '' });
  out.oldUrl = M.hjemServerUrl(out.old);
  // editor: Tilpass header → Steder (rader, felt, Tilbakestill) – samme skjema i getConfigElement()
  const ed = c.constructor.getConfigElement(); ed.hass = c.hass; ed.setConfig({ type: 'custom:msh-hjem-header-card', servers: [{ name: 'Bergen' }], servers_init: true });
  document.body.appendChild(ed); await w(200);
  const chg = []; ed.addEventListener('config-changed', (e) => { chg.push(e.detail.config); });
  const R = ed.shadowRoot;
  const sec = R.querySelector('details[data-focus="servers"]'); if (sec) { sec.open = true; await w(100); }
  out.edRows = [...R.querySelectorAll('[data-key^="servers-"] .xrh b')].map((x) => x.textContent);
  const rb = [...R.querySelectorAll('.xbtn')].find((x) => /Tilbakestill steder/.test(x.textContent));
  out.hasReset = !!rb;
  if (rb) { rb.click(); await w(100); }
  const last = chg[chg.length - 1] || {};
  out.reset = (last.servers || []).map((x) => x.name + '|' + x.icon + '|' + x.color + '|' + (x.path || ''));
  // åpne første rad → felt navn / ikon / farge / navigation_path / url
  const ob = R.querySelector('[data-a="x-ropen"][data-n="servers"][data-i="0"]'); if (ob) { ob.click(); await w(100); }
  out.fields = ['name', 'icon', 'color', 'path'].map((f) => !!R.querySelector(`[data-name="servers.0.${f}"]`));
  const add = R.querySelector('[data-a="x-radd"][data-n="servers"]'); if (add) { add.click(); await w(100); }
  out.added = ((chg[chg.length - 1] || {}).servers || []).length;
  ed.remove();
  return out;
});
console.log(JSON.stringify(r));
const D = r.defs;
ok(D.map((x) => [x.name, x.icon, x.color, x.path || ''].join('|')).join(',') === 'Oslo|mdi:office-building|var(--green)|,Toten|mdi:tractor|var(--yellow)|,Strømstad|mdi:sail-boat|var(--blue)|', 'standard servere ' + JSON.stringify(D));
ok(r.here1 === 2 && r.here2 === 1, 'Du er her fra location_name ' + JSON.stringify([r.here1, r.here2]));
ok(JSON.stringify(r.rows) === JSON.stringify(['Oslo', 'Strømstad']), 'rader ' + JSON.stringify(r.rows));
ok(!r.srvLine, '34.2: ingen server=-linje i radene');
ok(/Toten/.test(r.me || '') && /Du er her/.test(r.me || '') && !/server=/.test(r.me || ''), 'Du er her-raden ' + r.me);
ok(r.goApp === 'app' && /^homeassistant:\/\/navigate\/[^?]+\?server=Str%C3%B8mstad$/.test(r.nav[0]), 'app: lenke ' + JSON.stringify([r.goApp, r.nav]));
ok(r.goWeb === 'toast' && r.toasts.includes('Bytt server i appen'), 'nettleser → toast ' + JSON.stringify([r.goWeb, r.toasts]));
ok(r.goUrl === 'toast' && r.nav.length === 2, '34.2: nettleser med url → toast, ingen navigering ' + JSON.stringify([r.goUrl, r.nav]));
ok(r.goOld === 'app' && /\?server=X$/.test(r.nav[1]), 'eldre url_path (navnet er sannheten) ' + JSON.stringify(r.nav));
ok(r.old.icon === 'mdi:office-building' && /\?server=Oslo$/.test(r.oldUrl), 'gamle seedede steder ' + JSON.stringify([r.old, r.oldUrl]));
ok(r.edRows.join() === 'Bergen' && r.hasReset, 'editor: rader / Tilbakestill ' + JSON.stringify([r.edRows, r.hasReset]));
ok(r.reset.length === 3 && r.reset[2] === 'Strømstad|mdi:sail-boat|var(--blue)|', 'Tilbakestill ' + JSON.stringify(r.reset));
ok(r.fields.every(Boolean), 'editor-felt ' + JSON.stringify(r.fields));
ok(r.added === 4, 'legg til sted ' + r.added);
ok(!errs.length, 'feil: ' + errs.join(' | '));
await b.close();
console.log(fails.length ? 'FEIL:\n- ' + fails.join('\n- ') : 'OK – header 31.7 steder');
process.exit(fails.length ? 1 : 0);
