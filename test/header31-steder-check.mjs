// Fiks 31.7 → Fiks 37 · «Bytt sted» i hjem-headeren med config fra 31.7 (servers [{ name, icon, color, navigation_path,
// url, url_path, fallback_url }]). Fiks 37 erstatter oppførselen: stedene leses som `servere` (les begge), ingen
// standardliste uten oppsett, «Du er her» fra hass.config.location_name (lowercase, ö→ø, ä→æ), radene viser bare ikon +
// navn + chevron, bytte = window.open(homeassistant://navigate/<sti>?server=<navn>) (sti fra eldre navigation_path),
// ingen toast/location.href. Tilpass header → Steder redigerer `servere` (navn, server, ikon, farge, sti) også i
// getConfigElement(). Full dekning: test/server37-check.mjs.
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
  const menu = () => deepAll('.msh-servermeny')[0] || null;
  const opened = []; window.open = (u) => { opened.push(u); return null; };
  const out = {};
  const mk = async (cfg, loc) => {
    if (menu()) menu().remove();
    document.getElementById('dash').innerHTML = '';
    const h = window.mockHass(); h.config = { ...(h.config || {}), location_name: loc };
    const c = document.createElement('msh-hjem-header-card');
    c.setConfig({ type: 'custom:msh-hjem-header-card', card_id: 'hd31_' + Math.random().toString(36).slice(2), ...cfg });
    c.hass = h; document.getElementById('dash').appendChild(c);
    await w(300);
    return c;
  };
  const OLD = [
    { name: 'Oslo', icon: 'mdi:office-building', color: 'var(--green)', navigation_path: 'homeassistant://navigate/lovelace?server=Oslo', url: 'https://oslo.example' },
    { name: 'Toten', icon: 'mdi:tractor', color: 'var(--yellow)', url_path: 'homeassistant://navigate/gard?server=Toten', fallback_url: '' },
    { name: 'Strömstad', icon: 'mdi:sail-boat', color: 'var(--blue)' },
  ];
  // uten oppsett: ingen standardliste → ingen meny og ingen pil
  let c = await mk({}, 'Oslo');
  out.defList = c._server().list.length; out.defPil = !!c.shadowRoot.querySelector('.ttl .pil');
  c.shadowRoot.querySelector('.ttl').click(); await w(350); out.defMenu = !!menu();
  // 31.7-config leses (les begge): Du er her fra location_name (ö/ø og store bokstaver)
  c = await mk({ servers: OLD, servers_init: true }, 'STRØMSTAD');
  out.here1 = c._server().name;
  c = await mk({ servers: OLD, servers_init: true }, 'toten');
  out.here2 = c._server().name;
  c.shadowRoot.querySelector('.ttl').click(); await w(350);
  const rows = menu() ? [...menu().shadowRoot.querySelectorAll('.rad:not(.tilpass)')] : [];
  out.rows = rows.map((e) => ({ n: e.querySelector('.navn').textContent, her: !!e.querySelector('.her'), chev: !!e.querySelector('.gaa'), srv: /server=/.test(e.textContent), ic: e.querySelector('.flis ha-icon').getAttribute('icon') }));
  // bytte: eldre url_path gir sti, url ignoreres, ingen toast, window.open
  const toasts = []; const oT = M.toast; M.toast = (t) => toasts.push(t);
  try {
    rows.find((e) => /Oslo/.test(e.textContent)).click(); await w(200);
    c.shadowRoot.querySelector('.ttl').click(); await w(350);
    [...menu().shadowRoot.querySelectorAll('.rad')].find((e) => /Strömstad/.test(e.textContent)).click(); await w(200);
    c = await mk({ servers: OLD, servers_init: true }, 'Oslo');
    c.shadowRoot.querySelector('.ttl').click(); await w(350);
    [...menu().shadowRoot.querySelectorAll('.rad')].find((e) => /Toten/.test(e.textContent)).click(); await w(200);
  } finally { M.toast = oT; }
  out.opened = opened; out.toasts = toasts;
  // editor: Tilpass header → Steder (servere) – samme skjema i getConfigElement()
  const ed = c.constructor.getConfigElement(); ed.hass = c.hass; ed.setConfig({ type: 'custom:msh-hjem-header-card', servere: 'Bergen, Strömstad=Strømstad' });
  document.body.appendChild(ed); await w(200);
  const chg = []; ed.addEventListener('config-changed', (e) => { chg.push(e.detail.config); });
  const R = ed.shadowRoot;
  const sec = R.querySelector('details[data-focus="servers"]'); if (sec) { sec.open = true; await w(100); }
  out.edRows = [...R.querySelectorAll('[data-key^="servere-"] .xrh b')].map((x) => x.textContent);
  out.hasReset = [...R.querySelectorAll('.xbtn')].some((x) => /Tilbakestill steder/.test(x.textContent));
  const ob = R.querySelector('[data-a="x-ropen"][data-n="servere"][data-i="1"]'); if (ob) { ob.click(); await w(100); }
  out.fields = ['navn', 'server', 'ikon', 'farge', 'sti'].map((f) => !!R.querySelector(`[data-name="servere.1.${f}"]`));
  out.srvVal = (R.querySelector('[data-name="servere.1.server"]') || {}).value;
  const add = R.querySelector('[data-a="x-radd"][data-n="servere"]'); if (add) { add.click(); await w(100); }
  out.added = ((chg[chg.length - 1] || {}).servere || []).length;
  ed.remove();
  return out;
});
console.log(JSON.stringify(r));
ok(r.defList === 0 && !r.defPil && !r.defMenu, '37: uten oppsett ingen standardliste, ingen pil og ingen meny ' + JSON.stringify([r.defList, r.defPil, r.defMenu]));
ok(r.here1 === 'Strömstad' && r.here2 === 'Toten', 'Du er her fra location_name (ö/ø, case) ' + JSON.stringify([r.here1, r.here2]));
ok(JSON.stringify(r.rows.map((x) => x.n)) === JSON.stringify(['Oslo', 'Toten', 'Strömstad']) && r.rows[1].her && !r.rows[1].chev && r.rows[0].chev && r.rows.every((x) => !x.srv), 'rader (ikon + navn + Du er her/chevron, ingen server=) ' + JSON.stringify(r.rows));
ok(r.rows[0].ic === 'mdi:home-city-outline' && r.rows[1].ic === 'mdi:tractor-variant' && r.rows[2].ic === 'mdi:lighthouse', 'gamle standardikoner → nye standardikoner ' + JSON.stringify(r.rows.map((x) => x.ic)));
ok(r.opened[0] === 'homeassistant://navigate/home?server=Oslo' && r.opened[1] === 'homeassistant://navigate/home?server=Strömstad', 'bytte: samme dashbord (første segment av pathname), ö ukodet, eldre navigation_path …/lovelace gir ingen sti ' + JSON.stringify(r.opened));
ok(r.opened.length === 3 && r.opened[2] === 'homeassistant://navigate/gard?server=Toten', 'eldre url_path → sti, window.open ' + JSON.stringify(r.opened));
ok(!r.toasts.length, 'ingen toast i nettleser (window.open) ' + JSON.stringify(r.toasts));
ok(r.edRows.join() === 'Bergen,Strömstad' && !r.hasReset, 'editor: rader fra servere-streng, ingen Tilbakestill ' + JSON.stringify([r.edRows, r.hasReset]));
ok(r.fields.every(Boolean) && r.srvVal === 'Strømstad', 'editor-felt navn/server/ikon/farge/sti ' + JSON.stringify([r.fields, r.srvVal]));
ok(r.added === 3, 'legg til sted ' + r.added);
ok(!errs.length, 'feil: ' + errs.join(' | '));
await b.close();
console.log(fails.length ? 'FEIL:\n- ' + fails.join('\n- ') : 'OK – header 31.7 steder (Fiks 37)');
process.exit(fails.length ? 1 : 0);
