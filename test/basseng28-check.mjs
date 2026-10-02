// Fiks 28.14 · Basseng: HA skal aldri vise den gamle popupen. (Oppdatert i fiks 30.1: nøyaktig ÉN popup, #badebasseng;
//   #basseng er bare alias – 28.14-tvillingen er fjernet. Se test/basseng30-check.mjs.)
//   Strategien lager #badebasseng med ÉTT msh-basseng-card (card_id pop-basseng); gamle kort (ki-basseng-card,
//   ki-basseng-hero-card, msh-basseng-hero-card, gap-card) i importerte/overstyrte popups (strategi-YAML custom_popups og
//   popup_overrides, ki-store custom_popups/popup_overrides) migreres; ki-store popup_overrides skrives om én gang.
//   Bundelen refererer ikke Basseng v3, og versjonen/ressurs-URL-sjekken er på plass.
//   node test/basseng28-check.mjs   (SHOTS=<mappe> gir skjermbilder) – uavhengig av klokkeslett.
import { createRequire } from 'node:module';
import { readdirSync, readFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
mkdirSync('test/.build', { recursive: true });
const bundle = resolve(`test/.build/basseng28-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const shots = process.env.SHOTS || '';
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const res = {}, fail = [];
const ok = (name, cond, info) => { res[name] = cond ? 'OK' : ['FEIL', info]; if (!cond) fail.push(name); };
const mocks = readdirSync('test/mock').filter((f) => f.endsWith('.js')).sort().map((m) => resolve('test/mock/' + m));
const errs = [];
const OLD = /ki-basseng-card|ki-basseng-hero-card|msh-basseng-hero-card|gap-card/;

async function page(vp) {
  const p = await b.newPage({ viewport: vp || { width: 390, height: 900 }, hasTouch: true });
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + resolve('test/harness.html'));
  for (const m of mocks) await p.addScriptTag({ path: m });
  await p.addScriptTag({ path: bundle });
  await p.evaluate(async () => { window.__h = window.mockHass(); const M = window.MSH; if (M.store && !M.store.loaded) await M.store.load(window.__h); });
  return p;
}
const LEGACY_CARDS = [{ type: 'custom:gap-card', height: 10 }, { type: 'custom:ki-basseng-hero-card', navn: 'Bassenget' }, { type: 'custom:gap-card' }, { type: 'custom:ki-basseng-card', hero: false, hurtig: [{ entity: 'switch.bassengpumpe' }] }];

/* ---------------- A · ki-store popup_overrides med gamle kort → migrert i popupen + skrevet om én gang */
let p = await page();
const A = await p.evaluate(async (LEGACY_CARDS) => {
  const M = window.MSH, h = window.__h;
  const S = customElements.get('ll-strategy-dashboard-ki-dashboard') || customElements.get('ll-strategy-ki-dashboard');
  await M.store.set('popup_overrides', { '#basseng': { cards: LEGACY_CARDS }, '#vanning': { name: 'Vanning X' } }, { immediate: true });
  M._poolStoreMig = false;
  const d = await S.generate({}, h);
  const pops = d.views[0].cards[0].cards.filter((c) => c.card_type === 'pop-up');
  const pool = pops.filter((c) => /basseng/.test(c.hash));
  const st1 = JSON.parse(JSON.stringify(M.store.get('popup_overrides')));
  // andre generering: ingen ny omskriving
  let writes = 0; const set0 = M.store.set; M.store.set = function (...a) { if (a[0] === 'popup_overrides') writes++; return set0.apply(this, a); };
  await S.generate({}, h);
  M.store.set = set0;
  return { hashes: pool.map((c) => c.hash), cards: pool.map((c) => c.cards.map((x) => x.type)), ids: pool.map((c) => c.cards[0].card_id), navn: pool.map((c) => c.cards[0].navn), json: JSON.stringify(pool), st: st1, writes, twins: M.popupReport.twins, entries: M.popupReport.entries.filter((e) => /basseng/.test(e.hash)).map((e) => e.hash) };
}, LEGACY_CARDS);
ok('A · strategien lager bare #badebasseng med ÉTT msh-basseng-card (card_id pop-basseng) – også med en overstyring på #basseng', A.hashes.join() === '#badebasseng' && A.cards.every((c) => c.join() === 'custom:msh-basseng-card') && A.ids.every((x) => x === 'pop-basseng'), A);
ok('A · gamle kort i ki-store popup_overrides migreres (navn fra hero-kortet med), ingen gap-card/ki-basseng-*/hero-kort', !OLD.test(A.json) && A.navn.every((x) => x === 'Bassenget'), A.json);
ok('A · ki-store popup_overrides skrives om én gang (#basseng → #badebasseng med ÉTT kort, andre overstyringer beholdes)', !A.st['#basseng'] && A.st['#badebasseng'].cards.length === 1 && A.st['#badebasseng'].cards[0].type === 'custom:msh-basseng-card' && A.st['#vanning'].name === 'Vanning X' && A.writes === 0, A.st);
ok('A · ingen tvilling (30.1): én rad #badebasseng i Tilpass Hjem → Popups', !(A.twins || []).length && A.entries.join() === '#badebasseng', A);
await p.close();

/* ---------------- B · strategi-YAML: custom_popups #badebasseng og popup_overrides replace med gamle kort */
p = await page();
const B = await p.evaluate(async (LEGACY_CARDS) => {
  const M = window.MSH, h = window.__h;
  const S = customElements.get('ll-strategy-dashboard-ki-dashboard') || customElements.get('ll-strategy-ki-dashboard');
  const legacy = { type: 'custom:bubble-card', card_type: 'pop-up', hash: '#badebasseng', name: 'Badebasseng', cards: LEGACY_CARDS };
  const out = {};
  // 1) YAML custom_popups (vinner over autogenerert) → kortene migreres
  let d = await S.generate({ strategy: { type: 'custom:ki-dashboard' }, custom_popups: [legacy] }, h);
  let pool = d.views[0].cards[0].cards.filter((c) => c.card_type === 'pop-up' && /basseng/.test(c.hash));
  out.yaml = { hashes: pool.map((c) => c.hash), cards: pool.map((c) => c.cards.map((x) => x.type).join('+')), json: JSON.stringify(pool), navn: pool[0] && pool[0].cards[0].navn };
  // 2) YAML popup_overrides replace med gammel config
  d = await S.generate({ popup_overrides: { '#basseng': { replace: true, config: { ...legacy, hash: '#basseng', cards: [{ type: 'custom:ki-basseng-card', navn: 'Pool' }, { type: 'custom:gap-card' }, { type: 'markdown', content: 'egen' }] } } } }, h);
  pool = d.views[0].cards[0].cards.filter((c) => c.card_type === 'pop-up' && /basseng/.test(c.hash));
  out.rep = { hashes: pool.map((c) => c.hash), cards: pool.map((c) => c.cards.map((x) => x.type).join('+')), json: JSON.stringify(pool), navn: pool[0] && pool[0].cards[0].navn };
  // 3) «popups: { basseng: false }» (gammel nøkkel = alias) skjuler den ene popupen
  d = await S.generate({ popups: { basseng: false } }, h);
  out.hide = d.views[0].cards[0].cards.filter((c) => c.card_type === 'pop-up' && /basseng/.test(c.hash)).map((c) => c.hash);
  // 4) uten gamle kort: ingen migrering (null)
  out.none = M.bassengMigratePopup({ hash: '#badebasseng', cards: [{ type: 'custom:msh-basseng-card', card_id: 'pop-basseng' }] });
  return out;
}, LEGACY_CARDS);
ok('B · YAML custom_popups #badebasseng med gamle kort → bare #badebasseng med ÉTT msh-basseng-card (navn med)', B.yaml.hashes.join() === '#badebasseng' && B.yaml.cards.every((c) => c === 'custom:msh-basseng-card') && !OLD.test(B.yaml.json) && B.yaml.navn === 'Bassenget', B.yaml);
ok('B · YAML popup_overrides (replace) med gamle kort → msh-basseng-card; egne kort (markdown) beholdes', B.rep.cards[0] === 'custom:msh-basseng-card+markdown' && !OLD.test(B.rep.json) && B.rep.navn === 'Pool', B.rep);
ok('B · popups.basseng: false (alias) skjuler bassengpopupen; popup uten gamle kort røres ikke', B.hide.join() === '' && B.none === null, B);
await p.close();

/* ---------------- C · #badebasseng rendres som v4a (toppkort + 4 faner) på mobil og PC */
for (const vp of [{ width: 390, height: 900, tag: 'mobil' }, { width: 1280, height: 900, tag: 'PC' }]) {
  p = await page({ width: vp.width, height: vp.height });
  const C = await p.evaluate(async () => {
    const M = window.MSH, h = window.__h, w = (ms) => new Promise((q) => setTimeout(q, ms));
    const S = customElements.get('ll-strategy-dashboard-ki-dashboard') || customElements.get('ll-strategy-ki-dashboard');
    const d = await S.generate({}, h);
    const pop = d.views[0].cards[0].cards.find((c) => c.card_type === 'pop-up' && c.hash === '#badebasseng');
    const bc = document.createElement('bubble-card');
    bc.setConfig({ type: 'custom:bubble-card', card_type: 'pop-up', hash: '#badebasseng' });
    bc.innerHTML = '<div class="pop bubble-pop-up"><div class="hdr bubble-header-container">Basseng</div><div class="inner bubble-pop-up-container"></div></div>';
    document.getElementById('dash').appendChild(bc);
    location.hash = '#badebasseng';
    const cfg = pop.cards[0], el = document.createElement(cfg.type.replace('custom:', ''));
    el.setConfig(cfg); el.hass = h;
    bc.querySelector('.inner').appendChild(el);
    await w(900);
    const sr = el.shadowRoot, hero = sr.querySelector('.msh-hero-slot > *');
    return { n: pop.cards.length, hero: hero && hero.localName, heroH: hero ? Math.round(hero.getBoundingClientRect().height) : 0, tabs: [...sr.querySelectorAll('.gti')].map((x) => x.textContent), w: Math.round(el.getBoundingClientRect().width), pw: (() => { const i = bc.querySelector('.inner'), cs = getComputedStyle(i); return Math.round(i.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)); })(), old: !!document.querySelector('ki-basseng-card, ki-basseng-hero-card, gap-card') };
  });
  ok(`C · ${vp.tag}: #badebasseng = ÉTT msh-basseng-card med toppkort (fast) og fanene Oversikt · Varme · Klor · Spreder, full bredde`, C.n === 1 && C.hero === 'msh-basseng-hero-card' && C.heroH > 100 && C.tabs.join() === 'Oversikt,Varme,Klor,Spreder' && Math.abs(C.w - C.pw) <= 2 && !C.old, C);
  if (shots) await p.screenshot({ path: `${shots}/basseng28-${vp.tag}.png` });
  await p.close();
}

/* ---------------- D · Basseng v3 er utgått: ikke i bundelen (bortsett fra migreringsnøkkelen), versjon og cache-sjekk */
const src = readFileSync(bundle, 'utf8'), pkg = JSON.parse(readFileSync('package.json', 'utf8'));
ok('D · bundelen refererer ikke «Basseng v3» (bare localStorage-nøkkelen basseng-v3-cfg for migrering)', !/Basseng v3(?!\s*er utgått)/.test(src.replace(/Basseng v3 er utgått/g, '')), (src.match(/.{40}Basseng v3.{40}/g) || []).slice(0, 3));
ok('D · versjonen er bumpet (≥ 1.3.0) og står i bundelen; advarsel når ressurs-URL-ens ?v= ikke stemmer', /^1\.(3|[4-9])|^[2-9]\./.test(pkg.version) && src.includes(`window.KI_MSH_VERSION = ${JSON.stringify(pkg.version)}`) && /ressurs-URL/i.test(src), pkg.version);
const readme = readFileSync('README.md', 'utf8'), log = readFileSync('CHANGELOG.md', 'utf8');
ok('D · README og CHANGELOG forklarer ?v= og tømming av cache', /\?v=/.test(readme) && /tøm|Tøm/.test(readme) && /cache/i.test(log), '');
{
  // versjonssjekken: ?v= som ikke stemmer → console.warn (én gang)
  const p2 = await b.newPage();
  const warns = [];
  p2.on('console', (m) => { if (m.type() === 'warning' && /ki-msh/.test(m.text())) warns.push(m.text()); });
  await p2.goto('file://' + resolve('test/harness.html'));
  for (const m of mocks) await p2.addScriptTag({ path: m });
  await p2.addScriptTag({ url: 'file://' + bundle + '?v=0.9.0' });
  await new Promise((q) => setTimeout(q, 300));
  ok('D · gammel versjon i ressurs-URL-en (?v=0.9.0) gir én advarsel i konsollen', warns.length === 1 && /0\.9\.0/.test(warns[0]), warns);
  await p2.close();
}

ok('ingen sidefeil', !errs.length, errs);
await b.close();
console.log(JSON.stringify(res, null, 1));
console.log(fail.length ? `\n${fail.length} FEIL: ${fail.join(' · ')}` : '\nAlle bestod');
process.exit(fail.length ? 1 : 0);
