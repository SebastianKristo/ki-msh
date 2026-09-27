// Fiks 18.1 (prosa: vær/pris bare én gang, også med config fra før 17.9) og 18.2 (søppelkortet uten søppelkasse-ikon).
// Kjør: node test/fiks18-prosa-check.mjs  (skjermbilder: SHOTS=<mappe>)
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { readdirSync, mkdirSync, unlinkSync } from 'node:fs';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const R = resolve('.') + '/';
mkdirSync('test/.build', { recursive: true });
const bundle = resolve(`test/.build/f18p-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle], { cwd: R, stdio: 'inherit' });
const mocks = readdirSync(R + 'test/mock').filter((f) => f.endsWith('.js')).sort().map((f) => R + 'test/mock/' + f);
const SHOTS = process.env.SHOTS || '';
const browser = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const res = [];
const ok = (name, cond, info) => { res.push(`${cond ? '✔' : '✘'} ${name}${info != null ? ' · ' + JSON.stringify(info) : ''}`); };
const page = await browser.newPage({ viewport: { width: 430, height: 900 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });

// Config fra før 17.9: prose[] lagret av «Tilpass Hjem» → Tekst (vær + pris + effekt + lys + hendelser), i ki-store
const OLD = { prose: [
  { id: 'p1', pre: 'Ute er det', src: 'weather', fmt: '{v}', post: '.', icon: '', color: 'hvit', cop: 'alltid', tap: { action: 'navigate', navigation_path: '#vaer' } },
  { id: 'p2', pre: 'Strømmen koster', src: 'price', fmt: '{v}', post: '', icon: 'dot', color: 'hvit', cop: 'alltid' },
  { id: 'p3', pre: 'og vi bruker', src: 'watt', fmt: '{v}', post: '', icon: '', color: 'hvit', cop: 'alltid' },
  { id: 'p4', pre: 'med', src: 'lights', fmt: '{v}', post: 'på.', icon: '✨', color: 'hvit', cop: 'alltid' },
  { id: 'p5', pre: 'Vi har', src: 'events', fmt: '{v}', post: 'i dag.', icon: '⏰', color: 'hvit', cop: 'alltid' },
] };
const boot = async (ud) => {
  await page.goto('file://' + R + 'test/harness.html');
  await page.evaluate((ud) => { localStorage.clear(); localStorage.setItem('ki-device-id', 'testenhet'); window.__userData = ud; }, ud);
  for (const m of mocks) await page.addScriptTag({ path: m });
  await page.evaluate((ud) => { window.__userData = ud; }, ud);
  await page.addScriptTag({ path: bundle });
};
const mk = (tag, cfg) => page.evaluate(async ([tag, cfg]) => {
  window.H = window.H || window.mockHass();
  if (window.MSH.store) await window.MSH.store.load(window.H);
  const el = document.createElement(tag); el.setConfig(cfg); el.hass = window.H;
  const d = document.createElement('div'); d.style.cssText = 'width:398px;padding:16px'; d.appendChild(el);
  document.getElementById('dash').appendChild(d);
  await new Promise((r) => setTimeout(r, 400));
  el.hass = { ...window.H }; await new Promise((r) => setTimeout(r, 1200)); // ny render → migreringen lagres (debounce)
  window.__last = el; return true;
}, [tag, cfg]);
const txt = () => page.evaluate(() => __last.shadowRoot.querySelector('.pz').textContent.replace(/\s+/g, ' ').trim());
const count = (p, re) => (p.match(re) || []).length;

/* ---------------- 18.1 · config fra før 17.9 */
await boot({ ki_dashboard: { cards: { prosa_old: JSON.parse(JSON.stringify(OLD)) } } });
await mk('msh-prosa-card', { type: 'custom:msh-prosa-card', card_id: 'prosa_old' });
let p = await txt();
ok('18.1 gammel config: vær én gang', count(p, /Ute er det/g) === 1, p);
ok('18.1 gammel config: pris én gang', count(p, /Strømmen koster/g) === 1, p);
ok('18.1 config vinner: vær fra sensor.dashboard_index, pris fra norgespris', /Ute er det delvis skyet og 12\./.test(p) && /Strømmen koster 1,16 kr/.test(p) && !/12[.,]4°/.test(p), p);
ok('18.1 én setning: «Strømmen koster 1,16 kr og vi bruker 2470W med 3 lys på.»', /Strømmen koster 1,16 kr og vi bruker 2470W med ✨?3 lys på\./.test(p), p);
if (SHOTS) await page.locator('msh-prosa-card').first().screenshot({ path: SHOTS + '/f18-prosa-gammel.png' });
const saved = await page.evaluate(() => ((window.__userData.ki_dashboard || {}).cards || {}).prosa_old);
const srcs = saved && saved.prose ? saved.prose.map((r) => r.src) : null;
ok('18.1 migrering lagret: vær/pris-setningene fjernet fra prose[]', srcs && !srcs.includes('weather') && !srcs.includes('price') && srcs.includes('watt'), srcs);
const sets = await page.evaluate(() => window.__calls.filter((c) => c[1] === 'frontend/set_user_data').length);
// omlasting: samme ki-store (migrert) → fortsatt ingen dobbel, og ingen ny lagring
const ud = await page.evaluate(() => window.__userData);
await boot(ud);
await mk('msh-prosa-card', { type: 'custom:msh-prosa-card', card_id: 'prosa_old' });
p = await txt();
ok('18.1 etter omlasting: ingen dobbel', count(p, /Ute er det/g) === 1 && count(p, /Strømmen koster/g) === 1 && /1,16 kr og vi bruker/.test(p), p);
const sets2 = await page.evaluate(() => window.__calls.filter((c) => c[1] === 'frontend/set_user_data' && c[2] && c[2].cards && c[2].cards.prosa_old).length);
ok('18.1 migreringen lagres bare én gang', sets >= 1 && sets2 === 0, { sets, sets2 });

/* ---------------- 18.1 · eldre nøkler (weather/strom) → vaer/pris */
await mk('msh-prosa-card', { type: 'custom:msh-prosa-card', card_id: 'prosa_leg', weather: 'weather.home', strom: 'sensor.nordpool_kwh', prose: JSON.parse(JSON.stringify(OLD.prose)) });
p = await txt();
ok('18.1 weather/strom-nøkler → vaer/pris (én gang hver)', count(p, /Ute er det/g) === 1 && count(p, /Strømmen koster/g) === 1 && /Ute er det delvis skyet og 12[.,]4°/.test(p) && /Strømmen koster 1,\d\d kr og vi bruker/.test(p), p);
const leg = await page.evaluate(() => ((window.__userData.ki_dashboard || {}).cards || {}).prosa_leg);
ok('18.1 eldre nøkler slettet og mappet i lagret config', leg && leg.weather === null && leg.strom === null && leg.vaer && leg.vaer.entity === 'weather.home' && leg.pris && leg.pris.entity === 'sensor.nordpool_kwh', leg);

/* ---------------- 18.1 · ny standard-config (getStubConfig) */
const stub = await page.evaluate(() => { const s = customElements.get('msh-prosa-card').getStubConfig(); s.card_id = 'prosa_ny'; return s; });
await mk('msh-prosa-card', { type: 'custom:msh-prosa-card', ...stub });
p = await txt();
ok('18.1 ny standard-config: vær og pris én gang, sammenslått', count(p, /Ute er det/g) === 1 && count(p, /Strømmen koster/g) === 1 && /Strømmen koster 1,16 kr og vi bruker 2470W med ✨?3 lys på\./.test(p), p);
if (SHOTS) await page.locator('msh-prosa-card').last().screenshot({ path: SHOTS + '/f18-prosa-ny.png' });

/* ---------------- 18.1 · pris-seksjonen av → autokonfig-pris som før (ingen «og vi bruker» alene) */
await mk('msh-prosa-card', { type: 'custom:msh-prosa-card', card_id: 'prosa_ex', exclude: ['pris'], prose: JSON.parse(JSON.stringify(OLD.prose)) });
p = await txt();
ok('18.1 exclude: [pris] → prissetningen fra prose[] brukes (én gang)', count(p, /Strømmen koster/g) === 1 && /Strømmen koster 1,\d\d kr og vi bruker/.test(p) && count(p, /Ute er det/g) === 1, p);

/* ---------------- 18.1 · editorene viser hver seksjon én gang */
const ed = await page.evaluate(async (old) => {
  const C = customElements.get('msh-prosa-card'); const e = C.getConfigElement(); e.hass = H; e.setConfig({ type: 'custom:msh-prosa-card', card_id: 'prosa_ed', ...JSON.parse(JSON.stringify(old)) });
  document.body.appendChild(e); await new Promise((r) => setTimeout(r, 400));
  const f = e._findRows('prose'), rows = e._rowsOf(f).map((r) => r.src);
  const secs = C.schema(H).map((x) => x.id || x.name).filter(Boolean);
  const dup = secs.filter((k, i) => secs.indexOf(k) !== i);
  e.remove();
  return { rows, dup, secs };
}, OLD);
ok('18.1 GUI-editor: setningslisten har ikke vær/pris når seksjonene er aktive', !ed.rows.includes('weather') && !ed.rows.includes('price') && ed.rows.includes('watt'), ed.rows);
ok('18.1 editor: hver seksjon én gang', ed.dup.length === 0 && ed.secs.includes('sek-vaer') && ed.secs.includes('sek-pris'), ed.dup);
const te = await page.evaluate(async () => {
  const E = customElements.get('msh-hjem-tilpass') || null;
  const p = document.createElement('msh-prosa-card'); p._evOnce = true; const c = { type: 'custom:msh-prosa-card', card_id: 'x', prose: [{ src: 'weather', pre: 'Ute er det', post: '.' }, { src: 'price', pre: 'Strømmen koster', post: '.' }, { src: 'watt', pre: 'Vi bruker', post: '.' }] };
  p._rawConfig = c; p._config = c; p._hass = H; p.render();
  return p._R.rows.map((r) => r.src);
});
ok('18.1 «Tilpass Hjem» → Tekst (frakoblet instans) får rensede rader', te.join() === 'watt', te);

/* ---------------- 18.2 · søppelkortet uten ikon */
const sop = async (state) => {
  await page.evaluate(async (state) => { window.H = { ...H, states: { ...H.states, 'sensor.neste_tomming': { entity_id: 'sensor.neste_tomming', state, attributes: {} } } }; }, state);
  await mk('msh-soppel-card', { type: 'custom:msh-soppel-card', card_id: 'sop_' + state.replace(/\W/g, ''), ikon: 'mdi:delete' });
  return page.evaluate(() => {
    const r = __last.shadowRoot, s = r.querySelector('.tr'), n = r.querySelector('.n'), nw = r.querySelector('.nw');
    const a = n.getBoundingClientRect(), b = nw.getBoundingClientRect();
    return { bin: !!r.querySelector('.bin, ha-icon, .nw svg, .nw ha-icon'), icons: r.querySelectorAll('.nw *').length, pink: s.classList.contains('pink'), due: s.classList.contains('due'), n: n.textContent,
      center: Math.abs((a.left + a.width / 2) - (b.left + b.width / 2)) < 2, l1: r.querySelector('.l1').textContent, ent: s.dataset.ent, act: s.dataset.act };
  });
};
let t = await sop('1,Papir');
ok('18.2 dagen før (due): ingen ikon, tallet alene og sentrert', !t.bin && t.icons === 1 && t.due && t.n === '1' && t.center, t);
if (SHOTS) await page.locator('msh-soppel-card').last().screenshot({ path: SHOTS + '/f18-soppel-1.png' });
t = await sop('3,Papir');
ok('18.2 vanlig dag: ingen ikon', !t.bin && t.icons === 1 && t.n === '3' && t.center, t);
t = await sop('0,Restavfall,Plastavfall');
ok('18.2 tømmedag: rosa beholdt, ingen ikon', !t.bin && t.pink && t.n === '0' && t.l1 === 'Søppeltømming i dag' && t.act === 'open', t);
if (SHOTS) await page.locator('msh-soppel-card').last().screenshot({ path: SHOTS + '/f18-soppel-0.png' });
const hash = await page.evaluate(async () => { __last.shadowRoot.querySelector('.tr').click(); await new Promise((r) => setTimeout(r, 100)); return location.hash; });
ok('18.2 popup_hash uendret (#soppel)', hash === '#soppel', hash);
const sch = await page.evaluate(() => customElements.get('msh-soppel-card').schema.map((f) => f.name).filter(Boolean));
ok('18.2 ingen ikon-valg i editoren', !sch.some((k) => /ikon|icon/.test(k)), sch);

await page.waitForTimeout(100);
const bad = errs.filter((e) => !/favicon|ERR_FILE_NOT_FOUND|net::|seb\.jpg|Failed to load resource/.test(e));
ok('ingen JS-feil', bad.length === 0, bad.slice(0, 5));
await browser.close();
try { unlinkSync(bundle); } catch (e) { /* */ }
console.log(res.join('\n'));
const fail = res.filter((r) => r.startsWith('✘')).length;
console.log(fail ? `\n${fail} feil` : '\nAlt OK');
process.exit(fail ? 1 : 0);
