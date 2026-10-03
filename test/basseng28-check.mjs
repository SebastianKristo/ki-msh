// Fiks 28.14 · Basseng: HA skal aldri vise den gamle popupen. (Oppdatert Fiks 42 C: strategien lager #basseng igjen,
//   aldri #badebasseng. Se test/basseng42-check.mjs.)
//   Gamle kort (ki-basseng-card, ki-basseng-hero-card, msh-basseng-hero-card, gap-card) i importerte popups (strategi-YAML
//   custom_popups) droppes; i overstyringer av #basseng (YAML/ki-store popup_overrides) slås de sammen til ÉTT
//   msh-basseng-card (MSH.POPUP_MIGRATE) – ki-store røres ikke. msh-basseng-card i en manuell popup rendres som v4a. Bundelen refererer ikke Basseng v3, og
//   versjonen/ressurs-URL-sjekken er på plass.
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

/* ---------------- A · ki-store popup_overrides med gamle kort → ingen popup + fjernet én gang */
let p = await page();
const A = await p.evaluate(async (LEGACY_CARDS) => {
  const M = window.MSH, h = window.__h;
  const S = customElements.get('ll-strategy-dashboard-ki-dashboard') || customElements.get('ll-strategy-ki-dashboard');
  await M.store.set('popup_overrides', { '#basseng': { cards: LEGACY_CARDS }, '#badebasseng': { replace: true, config: { type: 'custom:bubble-card', card_type: 'pop-up', hash: '#badebasseng', cards: LEGACY_CARDS } }, '#vanning': { name: 'Vanning X' } }, { immediate: true });
  M._poolStoreMig = false;
  const d = await S.generate({}, h);
  const pops = d.views[0].cards[0].cards.filter((c) => c.card_type === 'pop-up');
  const pool = pops.filter((c) => /basseng|pool/.test(c.hash) || JSON.stringify(c.cards || []).includes('basseng'));
  const st1 = JSON.parse(JSON.stringify(M.store.get('popup_overrides')));
  let writes = 0; const set0 = M.store.set; M.store.set = function (...a) { if (a[0] === 'popup_overrides') writes++; return set0.apply(this, a); };
  await S.generate({}, h);
  M.store.set = set0;
  return { hashes: pool.map((c) => c.hash), cards: pool.map((c) => c.cards.map((x) => x.type.replace('custom:', '')).join('+')), st: st1, writes, entries: M.popupReport.entries.filter((e) => /basseng/.test(e.hash)).map((e) => e.hash), vanning: (pops.find((c) => c.hash === '#vanning') || {}).name };
}, LEGACY_CARDS);
ok('A · ki-store-overstyring med gamle kort på #basseng → ÉTT msh-basseng-card (ingen gamle kort), aldri #badebasseng', A.hashes.join() === '#basseng' && A.cards.join() === 'msh-basseng-card' && A.entries.join() === '#basseng', A);
ok('A · ki-store popup_overrides røres ikke (ingen sletting), andre overstyringer virker', !!A.st['#basseng'] && !!A.st['#badebasseng'] && A.st['#vanning'].name === 'Vanning X' && A.vanning === 'Vanning X' && A.writes === 0, A);
await p.close();

/* ---------------- B · strategi-YAML: custom_popups og popup_overrides med gamle kort → droppes */
p = await page();
const B = await p.evaluate(async (LEGACY_CARDS) => {
  const M = window.MSH, h = window.__h;
  const S = customElements.get('ll-strategy-dashboard-ki-dashboard') || customElements.get('ll-strategy-ki-dashboard');
  const legacy = { type: 'custom:bubble-card', card_type: 'pop-up', hash: '#badebasseng', name: 'Badebasseng', cards: LEGACY_CARDS };
  const poolOf = (d) => d.views[0].cards[0].cards.filter((c) => c.card_type === 'pop-up' && (/basseng|pool/.test(c.hash) || OLDRX.test(JSON.stringify(c.cards || []))));
  const OLDRX = /ki-basseng|gap-card|msh-basseng/;
  const out = {};
  let d = await S.generate({ strategy: { type: 'custom:ki-dashboard' }, custom_popups: [legacy, { ...legacy, hash: '#pool', name: 'Pool', cards: [{ type: 'custom:decluttering-card', template: 'basseng_popup' }] }, { ...legacy, hash: '#hage', name: 'Hage', cards: [{ type: 'custom:ki-basseng-card' }, { type: 'markdown', content: 'x' }] }] }, h);
  out.yaml = poolOf(d).map((c) => c.hash); out.dropped = M.popupReport.dropped.map((x) => x.source + ':' + x.hash);
  d = await S.generate({ popup_overrides: { '#basseng': { replace: true, config: { ...legacy, hash: '#basseng', cards: [{ type: 'custom:ki-basseng-card', navn: 'Pool' }, { type: 'custom:gap-card' }, { type: 'markdown', content: 'egen' }] } } } }, h);
  out.rep = poolOf(d).map((c) => c.hash + ':' + c.cards.map((x) => x.type.replace('custom:', '')).join('+'));
  return out;
}, LEGACY_CARDS);
ok('B · YAML custom_popups med gamle bassengpopups (gamle kort på alle hasher, basseng-mal på #pool) droppes; bare den genererte #basseng', B.yaml.join() === '#basseng' && B.dropped.sort().join() === 'yaml:#badebasseng,yaml:#hage,yaml:#pool', B);
ok('B · YAML popup_overrides (replace) på #basseng med gamle kort → gamle kort blir ÉTT msh-basseng-card, eget kort beholdes', B.rep.join() === '#basseng:msh-basseng-card+markdown', B);
await p.close();

/* ---------------- C · manuell popup med msh-basseng-card rendres som v4a (toppkort + 4 faner) på mobil og PC */
for (const vp of [{ width: 390, height: 900, tag: 'mobil' }, { width: 1280, height: 900, tag: 'PC' }]) {
  p = await page({ width: vp.width, height: vp.height });
  const C = await p.evaluate(async () => {
    const M = window.MSH, h = window.__h, w = (ms) => new Promise((q) => setTimeout(q, ms));
    const S = customElements.get('ll-strategy-dashboard-ki-dashboard') || customElements.get('ll-strategy-ki-dashboard');
    const man = M.popupTemplateA({ name: 'Basseng', icon: 'mdi:pool', hash: '#mitt-basseng', card: { type: 'custom:msh-basseng-card', card_id: 'pop-basseng' } });
    const d = await S.generate({ custom_popups: [man] }, h);
    const pop = d.views[0].cards[0].cards.find((c) => c.card_type === 'pop-up' && c.hash === '#mitt-basseng');
    const bc = document.createElement('bubble-card');
    bc.setConfig({ type: 'custom:bubble-card', card_type: 'pop-up', hash: '#mitt-basseng' });
    bc.innerHTML = '<div class="pop bubble-pop-up"><div class="hdr bubble-header-container">Basseng</div><div class="inner bubble-pop-up-container"></div></div>';
    document.getElementById('dash').appendChild(bc);
    location.hash = '#mitt-basseng';
    const cfg = pop.cards[0], el = document.createElement(cfg.type.replace('custom:', ''));
    el.setConfig(cfg); el.hass = h;
    bc.querySelector('.inner').appendChild(el);
    await w(900);
    const sr = el.shadowRoot, hero = sr.querySelector('.msh-hero-slot > *');
    return { hash: location.hash, n: pop.cards.length, hero: hero && hero.localName, heroH: hero ? Math.round(hero.getBoundingClientRect().height) : 0, tabs: [...sr.querySelectorAll('.gti')].map((x) => x.textContent), w: Math.round(el.getBoundingClientRect().width), pw: (() => { const i = bc.querySelector('.inner'), cs = getComputedStyle(i); return Math.round(i.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)); })(), old: !!document.querySelector('ki-basseng-card, ki-basseng-hero-card, gap-card') };
  });
  ok(`C · ${vp.tag}: manuell popup = ÉTT msh-basseng-card med toppkort (fast) og fanene Oversikt · Varme · Klor · Spreder, full bredde`, C.hash === '#mitt-basseng' && C.n === 1 && C.hero === 'msh-basseng-hero-card' && C.heroH > 100 && C.tabs.join() === 'Oversikt,Varme,Klor,Spreder' && Math.abs(C.w - C.pw) <= 2 && !C.old, C);
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
