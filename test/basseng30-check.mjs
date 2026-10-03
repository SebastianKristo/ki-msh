// Basseng (Fiks 42 Del C oppdaterer «bassengpopupene er slettet»): strategien lager #basseng igjen.
//   A · strategien: ÉN popup #basseng (mal A, msh-basseng-card) for mock-området «Basseng», aldri #badebasseng, ingen
//       rom-popup for området, ingen alias/omdirigering
//   B · importerte/egne gamle bassengpopups i dashbord-config droppes (report.dropped); en helt annen popup på #basseng
//       (erstatter den genererte) og en manuell popup med msh-basseng-card beholdes
//   C · den gamle engangsmigreringen (migrations.basseng_fjernet) er fjernet: ki-store (popups.basseng, custom_popups,
//       navbar, lenker) røres ikke ved generering, og ingen Lovelace-ressurser slettes
//   D · ingen omdirigering #basseng → #badebasseng (URL, location-changed, navbaren uten basseng-knapp)
//   E · alias-elementene ki-basseng-card / ki-basseng-hero-card (msh-basseng-card + console.warn; hero ved siden av
//       et bassengkort i samme popup = ingenting)
//   F · manuell popup med msh-basseng-card (README → Manuelt) + GUI-editor; skjermbilde (SHOTS=<mappe>)
//   node test/basseng30-check.mjs   – uavhengig av dato/klokkeslett
import { createRequire } from 'node:module';
import { readdirSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
mkdirSync('test/.build', { recursive: true });
const bundle = resolve(`test/.build/basseng30-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const shots = process.env.SHOTS || '';
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const res = {}, fail = [];
const ok = (name, cond, info) => { res[name] = cond ? 'OK' : ['FEIL', info]; if (!cond) fail.push(name); };
const mocks = readdirSync('test/mock').filter((f) => f.endsWith('.js')).sort().map((m) => resolve('test/mock/' + m));
const errs = [];

async function page(vp, logs) {
  const p = await b.newPage({ viewport: vp || { width: 390, height: 900 }, hasTouch: true });
  p.on('pageerror', (e) => errs.push(e.message));
  if (logs) p.on('console', (m) => { if (/ki-msh/.test(m.text())) logs.push([m.type(), m.text()]); });
  await p.goto('file://' + resolve('test/harness.html'));
  for (const m of mocks) await p.addScriptTag({ path: m });
  await p.addScriptTag({ path: bundle });
  await p.evaluate(async () => {
    const h = window.mockHass();
    window.__h = h;
    // Lovelace-ressurser (admin): to gamle basseng-filer + andre
    window.__res = [{ id: 'r1', url: '/local/ki-cards/ki-basseng-card.js?v=3', res_type: 'module' }, { id: 'r2', url: '/hacsfiles/ki-cards/ki-basseng-hero-card.js', res_type: 'module' }, { id: 'r3', url: '/hacsfiles/ki-msh/ki-msh.js?v=1.3.0', res_type: 'module' }, { id: 'r4', url: '/local/annen-basseng-ting.js', res_type: 'module' }];
    window.__del = [];
    const ws = h.callWS;
    h.callWS = (m) => {
      if (m.type === 'lovelace/resources') return Promise.resolve(window.__res);
      if (m.type === 'lovelace/resources/delete') { window.__del.push(m.resource_id); return Promise.resolve(null); }
      return ws(m);
    };
    const M = window.MSH;
    if (M.store && !M.store.loaded) await M.store.load(h);
  });
  return p;
}
const LEGACY_CARDS = [{ type: 'custom:gap-card', height: 10 }, { type: 'custom:ki-basseng-hero-card', navn: 'Bassenget' }, { type: 'custom:gap-card' }, { type: 'custom:ki-basseng-card', hero: false, hurtig: [{ entity: 'switch.bassengpumpe' }] }];
const POOL = /basseng|pool/;

/* ---------------- A · strategien: ingen bassengpopup */
let logs = [];
let p = await page(null, logs);
const A = await p.evaluate(async () => {
  const M = window.MSH, h = window.__h;
  const S = customElements.get('ll-strategy-dashboard-ki-dashboard') || customElements.get('ll-strategy-ki-dashboard');
  const d = await S.generate({}, h);
  const st = d.views[0].cards[0].cards, pops = st.filter((c) => c.card_type === 'pop-up');
  const pool = pops.filter((c) => /basseng|pool/.test(c.hash) || c.cards.some((x) => /basseng/.test(x.type)));
  // navbar-config som fortsatt har «basseng» (bar + knapp) → ingen popup, ingen knapp
  const d2 = await S.generate({ navbar: { bar: ['vanning', 'basseng', 'media'], buttons: { basseng: { tap: { action: 'navigate', navigation_path: '#badebasseng' } } } } }, h);
  const pops2 = d2.views[0].cards[0].cards.filter((c) => c.card_type === 'pop-up' && /basseng/.test(c.hash)).map((c) => c.hash);
  return {
    hashes: pool.map((c) => c.hash), card: (pool[0] && pool[0].cards.map((x) => x.type).join()) || null, entries: M.popupReport.entries.filter((e) => /basseng|pool/.test(e.hash)).map((e) => e.hash),
    all: M.allPopups(h, { hidden: true }).filter((x) => /basseng|pool/.test(x.hash)).map((x) => x.hash), nav: st[1].bar.concat(st[1].more || []), area: !!(h.areas && h.areas.basseng),
    FP: M.FUNCTION_POPUPS.filter((f) => f[3] === 'msh-basseng-card' || /basseng/.test(f[0])).length, ref: Object.keys(M.REF_POPUPS).filter((k) => /basseng/.test(k)),
    alias: Object.keys(M.HASH_ALIAS).filter((k) => /basseng|pool/.test(k)), canon: M.canonHash('#basseng'), blocked: M.roomBlocked(h, 'basseng'), stue: M.roomBlocked(h, 'stue'), pops2,
    drop: typeof (M.POPUP_DROP && M.POPUP_DROP.basseng && M.POPUP_DROP.basseng.test), sup: !!(M.POPUP_SUPERSEDE || {})['#badebasseng'], al: Object.keys(M.POPUP_ALIAS || {}).filter((k) => /basseng|pool/.test(k)),
  };
});
ok('A · strategien lager ÉN bassengpopup #basseng (ingen #badebasseng) og ingen rom-popup for området «Basseng»', A.hashes.join() === '#basseng' && A.entries.join() === '#basseng' && A.all.join() === '#basseng' && A.area && A.blocked && !A.stue && A.card === 'custom:msh-basseng-card', A);
ok('A · funksjons-popup #basseng; ingen REF_POPUPS, alias, SUPERSEDE/POPUP_ALIAS for basseng; POPUP_DROP finnes', A.FP === 1 && !A.ref.length && !A.alias.length && A.canon === '#basseng' && !A.sup && !A.al.length && A.drop === 'function', A);
ok('A · navbar-config med gammel «basseng»-knapp mot #badebasseng lager ingen #badebasseng', A.pops2.join() === '#basseng', A);
await p.close();

/* ---------------- B · importerte bassengpopups droppes */
p = await page();
const B = await p.evaluate(async (LEGACY_CARDS) => {
  const M = window.MSH, h = window.__h;
  const S = customElements.get('ll-strategy-dashboard-ki-dashboard') || customElements.get('ll-strategy-ki-dashboard');
  const P = (hash, name, cards, x) => ({ type: 'custom:bubble-card', card_type: 'pop-up', hash, name, icon: 'mdi:pool', cards, ...(x || {}) });
  const d = await S.generate({ custom_popups: [
    P('#basseng', 'Badebasseng', LEGACY_CARDS),
    P('#badebasseng', 'Basseng', [{ type: 'custom:decluttering-card', template: 'basseng_popup' }]),
    P('#svommebasseng', 'Svømmebasseng', [{ type: 'custom:button-card', template: 'pool' }]),
    P('#basseng-x', 'Annen', [{ type: 'custom:ki-basseng-hero-card' }]),
    P('#basseng', 'Notater', [{ type: 'markdown', content: 'x' }], { icon: 'mdi:note' }),
    P('#mitt-basseng', 'Basseng', [{ type: 'custom:msh-basseng-card', card_id: 'pop-basseng' }]),
  ] }, h);
  const pops = d.views[0].cards[0].cards.filter((c) => c.card_type === 'pop-up' && /basseng|pool/.test(c.hash));
  return { pops: pops.map((c) => c.hash + ':' + c.name + ':' + c.cards.map((x) => x.type.replace('custom:', '')).join('+')), dropped: M.popupReport.dropped.map((x) => x.hash).sort(), by: M.popupReport.dropped.map((x) => x.by)[0] };
}, LEGACY_CARDS);
ok('B · gamle/importerte bassengpopups (gamle kort, basseng-maler på bassenghashene) droppes', B.dropped.join() === '#badebasseng,#basseng,#basseng-x,#svommebasseng' && /Basseng/.test(B.by || ''), B);
ok('B · en helt annen popup på #basseng og en manuell popup med msh-basseng-card beholdes', B.pops.join() === '#basseng:Notater:markdown,#mitt-basseng:Basseng:msh-basseng-card', B);
await p.close();

/* ---------------- C · ingen engangsmigrering lenger: ki-store røres ikke */
logs = [];
p = await page(null, logs);
const C = await p.evaluate(async (LEGACY_CARDS) => {
  const M = window.MSH, h = window.__h, w = (ms) => new Promise((q) => setTimeout(q, ms));
  const S = customElements.get('ll-strategy-dashboard-ki-dashboard') || customElements.get('ll-strategy-ki-dashboard');
  await M.store.set('custom_popups', [
    { type: 'custom:bubble-card', card_type: 'pop-up', hash: '#egen', name: 'Egen', cards: [{ type: 'markdown', content: 'x' }] },
    { type: 'custom:bubble-card', card_type: 'pop-up', hash: '#mitt-basseng', name: 'Basseng', cards: [{ type: 'custom:msh-basseng-card', card_id: 'pop-basseng-2' }] },
  ], { immediate: true });
  await M.store.set('popups', { basseng: { enabled: true, color: 'var(--blue)' }, stue: { name: 'Stua' } }, { immediate: true });
  const I = M.CARD_IDS;
  await M.store.set('cards', { [I.faner]: { cards: [{ type: 'link', name: 'Basseng', popup_hash: '#basseng' }] } }, { immediate: true });
  const before = JSON.stringify({ cp: M.store.get('custom_popups'), pu: M.store.get('popups'), cards: M.store.get('cards') });
  let writes = 0; const set0 = M.store.set; M.store.set = function (...a) { if (/^(custom_popups|popups|popup_overrides|cards)(\.|$)|basseng/.test(String(a[0]))) writes++; return set0.apply(this, a); }; // andre engangsmigreringer (f.eks. varmepumpe) teller ikke
  const d = await S.generate({}, h);
  await w(300);
  M.store.set = set0;
  const after = JSON.stringify({ cp: M.store.get('custom_popups'), pu: M.store.get('popups'), cards: M.store.get('cards') });
  const pool = d.views[0].cards[0].cards.filter((c) => c.card_type === 'pop-up' && /basseng|pool/.test(c.hash)).map((c) => c.hash + ':' + c.name);
  return { same: before === after, writes, mig: M.store.get('migrations.basseng_fjernet') || null, fn: typeof M.bassengMigrateStore, del: window.__del.slice(), pool };
}, LEGACY_CARDS);
ok('C · generering endrer ikke ki-store (popups.basseng, custom_popups med msh-basseng-card, lenker til #basseng beholdes)', C.same && C.writes === 0 && !C.mig && C.fn === 'undefined', C);
ok('C · ingen Lovelace-ressurser slettes; #basseng og den manuelle #mitt-basseng vises', !C.del.length && C.pool.includes('#basseng:Basseng') && C.pool.includes('#mitt-basseng:Basseng'), C);
ok('C · ingen «Basseng-popupene er slettet»-logg', !logs.some(([, x]) => /Basseng-popupene er slettet/.test(x)), logs.slice(0, 3));
await p.close();

/* ---------------- D · ingen omdirigering #basseng → #badebasseng */
p = await page();
const D = await p.evaluate(async () => {
  const M = window.MSH, h = window.__h, w = (ms) => new Promise((q) => setTimeout(q, ms));
  const S = customElements.get('ll-strategy-dashboard-ki-dashboard') || customElements.get('ll-strategy-ki-dashboard');
  const d = await S.generate({}, h);
  const out = {};
  location.hash = '#basseng'; await w(200);
  out.url = location.hash;
  history.replaceState(null, '', location.pathname); await w(50);
  history.pushState(null, '', location.pathname + '#basseng'); window.dispatchEvent(new CustomEvent('location-changed')); await w(100);
  out.nav = location.hash;
  history.replaceState(null, '', location.pathname); await w(50);
  // navbaren med gammel config (bar + knapp «basseng») → ingen basseng-knapp
  const nb = document.createElement('msh-navbar-card');
  nb.setConfig({ ...d.views[0].cards[0].cards[1], bar: ['vanning', 'basseng', 'media'], buttons: { basseng: { tap: { action: 'navigate', navigation_path: '#basseng' } } } });
  nb.hass = h; document.getElementById('dash').appendChild(nb); await w(700);
  const find = (r, d0 = 0) => { if (!r || d0 > 8) return null; const x = r.querySelector && r.querySelector('[data-act="go"][data-id="basseng"]'); if (x) return x; for (const e of r.querySelectorAll ? r.querySelectorAll('*') : []) { if (e.shadowRoot) { const y = find(e.shadowRoot, d0 + 1); if (y) return y; } } return null; };
  out.btn = !!find(document);
  out.fn = typeof M.bassengRedirect;
  return out;
});
ok('D · #basseng (URL og HA-navigering) omdirigeres ikke lenger til #badebasseng', D.url === '#basseng' && D.nav === '#basseng' && D.fn === 'undefined', D);
ok('D · navbaren viser ingen basseng-knapp, heller ikke med gammel config', !D.btn, D);
await p.close();

/* ---------------- E · alias-elementer (manuelle dashbord) */
logs = [];
p = await page(null, logs);
const E = await p.evaluate(async () => {
  const M = window.MSH, h = window.__h, w = (ms) => new Promise((q) => setTimeout(q, ms));
  M.bassengDefineAliases();
  const mkPop = (hash, cards) => {
    const bc = document.createElement('bubble-card');
    bc.setConfig({ type: 'custom:bubble-card', card_type: 'pop-up', hash });
    bc.innerHTML = '<div class="pop bubble-pop-up"><div class="inner bubble-pop-up-container"></div></div>';
    document.getElementById('dash').appendChild(bc);
    const els = cards.map((c) => { const el = document.createElement(c.type.replace('custom:', '')); el.setConfig(c); el.hass = h; bc.querySelector('.inner').appendChild(el); return el; });
    return els;
  };
  // 1) gammel popup: hero + hovedkort i samme popup
  const [hero, main] = mkPop('#p1', [{ type: 'custom:ki-basseng-hero-card', navn: 'Bassenget' }, { type: 'custom:ki-basseng-card', navn: 'Bassenget', hurtig: [{ entity: 'switch.bassengpumpe' }] }]);
  // 2) bare hero-kortet
  const [solo] = mkPop('#p2', [{ type: 'custom:ki-basseng-hero-card', navn: 'Alene' }]);
  // 3) hero ved siden av et nytt msh-basseng-card
  const [hero3] = mkPop('#p3', [{ type: 'custom:ki-basseng-hero-card' }, { type: 'custom:msh-basseng-card', card_id: 'pop-basseng' }]);
  location.hash = '#p1';
  await w(1800);
  const inner = (el) => [...el.children].map((x) => x.localName).join();
  return {
    def: [!!customElements.get('ki-basseng-card'), !!customElements.get('ki-basseng-hero-card')],
    main: inner(main), mainCfg: main.firstElementChild && main.firstElementChild._rawConfig ? main.firstElementChild._rawConfig.navn : (main.firstElementChild && (main.firstElementChild._config || {}).navn),
    hero: inner(hero), heroShown: getComputedStyle(hero).display, solo: inner(solo), soloShown: getComputedStyle(solo).display, hero3: inner(hero3), hero3Shown: getComputedStyle(hero3).display,
    heroTop: !!(main.firstElementChild && main.firstElementChild.shadowRoot && main.firstElementChild.shadowRoot.querySelector('msh-basseng-hero-card')),
  };
});
ok('E · alias-elementene ki-basseng-card og ki-basseng-hero-card er definert (når ingen annen ressurs har dem)', E.def.every(Boolean), E);
ok('E · ki-basseng-card rendrer msh-basseng-card med samme config (toppkort med)', E.main === 'msh-basseng-card' && E.mainCfg === 'Bassenget' && E.heroTop, E);
ok('E · ki-basseng-hero-card ved siden av et bassengkort i samme popup rendrer ingenting (gammelt og nytt kort)', E.hero === '' && E.heroShown === 'none' && E.hero3 === '' && E.hero3Shown === 'none', E);
ok('E · ki-basseng-hero-card alene rendrer msh-basseng-card', E.solo === 'msh-basseng-card' && E.soloShown === 'block', E);
const warns = logs.filter(([t, x]) => t === 'warning' && /er utgått/.test(x));
ok('E · én advarsel i konsollen per gammel korttype', warns.length === 2 && warns.some(([, x]) => /ki-basseng-card/.test(x)) && warns.some(([, x]) => /ki-basseng-hero-card/.test(x)), warns);
await p.close();

/* ---------------- F · manuell popup med msh-basseng-card (README → Manuelt) */
p = await page();
const F = await p.evaluate(async () => {
  const M = window.MSH, h = window.__h, w = (ms) => new Promise((q) => setTimeout(q, ms));
  const S = customElements.get('ll-strategy-dashboard-ki-dashboard') || customElements.get('ll-strategy-ki-dashboard');
  const man = { type: 'custom:bubble-card', card_type: 'pop-up', name: 'Basseng', icon: 'mdi:pool', hash: '#mitt-basseng', is_sidebar_hidden: true, bg_blur: '5', bg_opacity: '98', margin_top_mobile: '50px', margin_top_desktop: '50px', card_layout: 'large', cards: [{ type: 'custom:msh-basseng-card', card_id: 'pop-basseng' }] };
  const d = await S.generate({ custom_popups: [man] }, h);
  const pop = d.views[0].cards[0].cards.find((c) => c.card_type === 'pop-up' && c.hash === '#mitt-basseng');
  const bc = document.createElement('bubble-card');
  bc.setConfig({ type: 'custom:bubble-card', card_type: 'pop-up', hash: pop.hash });
  bc.innerHTML = `<div class="pop bubble-pop-up"><div class="hdr bubble-header-container">${pop.name}</div><div class="inner bubble-pop-up-container"></div></div>`;
  document.getElementById('dash').appendChild(bc);
  const el = document.createElement('msh-basseng-card');
  el.setConfig(pop.cards[0]); el.hass = h;
  bc.querySelector('.inner').appendChild(el);
  location.hash = '#mitt-basseng';
  await w(1200);
  const sr = el.shadowRoot, C = customElements.get('msh-basseng-card');
  return { hash: location.hash, n: pop.cards.length, tabs: sr ? [...sr.querySelectorAll('.gti')].map((x) => x.textContent) : [], hero: !!(sr && sr.querySelector('.msh-hero-slot msh-basseng-hero-card')), ed: C.getConfigElement().localName, stub: C.getStubConfig(h), card: (window.customCards || []).some((x) => x.type === 'msh-basseng-card') };
});
ok('F · manuell popup #mitt-basseng beholdes av strategien og viser msh-basseng-card (toppkort + Oversikt · Varme · Klor · Spreder)', F.hash === '#mitt-basseng' && F.n === 1 && F.hero && F.tabs.join() === 'Oversikt,Varme,Klor,Spreder', F);
ok('F · kortet er fortsatt registrert (customCards) med GUI-editor (getConfigElement) og stub-config', F.card && F.ed === 'msh-editor' && F.stub && typeof F.stub === 'object', F);
if (shots) await p.screenshot({ path: `${shots}/basseng-manuell.png` });
await p.close();

ok('ingen sidefeil', !errs.length, errs);
await b.close();
console.log(JSON.stringify(res, null, 1));
console.log(fail.length ? `\n${fail.length} FEIL: ${fail.join(' · ')}` : '\nAlle bestod');
process.exit(fail.length ? 1 : 0);
