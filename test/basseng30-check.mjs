// Fiks 30.1 · Basseng: nøyaktig ÉN bassengpopup på #badebasseng; #basseng er alias (history.replaceState).
//   A · strategien: én popup #badebasseng (card_id pop-basseng), ingen popup/tvilling på #basseng, ingen rom-popup for området
//   B · engangsmigrering av ki-store (custom_popups, popup_overrides, popups, lenker i kortconfigene, Lovelace-ressursene),
//       logget én gang og merket migrations.basseng30 – kjører ikke igjen
//   C · alias: #basseng → #badebasseng (replaceState, ingen ny historikk) fra URL, location-changed og navbaren;
//       en helt annen popup på #basseng røres ikke
//   D · alias-elementene ki-basseng-card / ki-basseng-hero-card (msh-basseng-card + console.warn; hero ved siden av
//       et bassengkort i samme popup = ingenting)
//   E · skjermbilder #badebasseng og #basseng (SHOTS=<mappe>)
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
const OLD = /ki-basseng-card|ki-basseng-hero-card|msh-basseng-hero-card|gap-card/;

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

/* ---------------- A · strategien: ÉN popup */
let logs = [];
let p = await page(null, logs);
const A = await p.evaluate(async () => {
  const M = window.MSH, h = window.__h;
  const S = customElements.get('ll-strategy-dashboard-ki-dashboard') || customElements.get('ll-strategy-ki-dashboard');
  const d = await S.generate({}, h);
  const st = d.views[0].cards[0].cards, pops = st.filter((c) => c.card_type === 'pop-up');
  const pool = pops.filter((c) => /basseng|pool/.test(c.hash) || c.cards.some((x) => /basseng/.test(x.type)));
  return { hashes: pool.map((c) => c.hash), cards: pool.map((c) => c.cards.map((x) => x.type).join('+')), ids: pool.map((c) => c.cards[0].card_id), json: JSON.stringify(pool), entries: M.popupReport.entries.filter((e) => /basseng/.test(e.hash)).map((e) => e.hash), twins: M.popupReport.twins, all: M.allPopups(h).filter((x) => /basseng/.test(x.hash)).map((x) => x.hash), nav: st[1].bar, area: !!(h.areas && h.areas.basseng), FP: M.FUNCTION_POPUPS.find((f) => f[3] === 'msh-basseng-card')[0] };
});
ok('A · nøyaktig ÉN bassengpopup: #badebasseng med ÉTT msh-basseng-card (card_id pop-basseng), ingen gamle kort', A.hashes.join() === '#badebasseng' && A.cards.join() === 'custom:msh-basseng-card' && A.ids.join() === 'pop-basseng' && !OLD.test(A.json), A);
ok('A · ingen tvilling og ingen rom-popup #basseng for området «Basseng»; én rad i popup-listen', !(A.twins || []).length && A.entries.join() === '#badebasseng' && A.all.join() === '#badebasseng' && A.area, A);
ok('A · standard-hash i FUNCTION_POPUPS er #badebasseng; navbaren har fortsatt knappen «basseng»', A.FP === '#badebasseng' && A.nav.includes('basseng'), A);

/* ---------------- B · engangsmigrering av ki-store */
const B = await p.evaluate(async (LEGACY_CARDS) => {
  const M = window.MSH, h = window.__h, w = (ms) => new Promise((q) => setTimeout(q, ms));
  const S = customElements.get('ll-strategy-dashboard-ki-dashboard') || customElements.get('ll-strategy-ki-dashboard');
  // tilstand som en bruker etter 26.14/28.14 kan ha
  await M.store.set('migrations', undefined, { immediate: true });
  await M.store.set('custom_popups', [
    { type: 'custom:bubble-card', card_type: 'pop-up', hash: '#basseng', name: 'Badebasseng', icon: 'mdi:pool', cards: LEGACY_CARDS },
    { yaml: "type: custom:bubble-card\ncard_type: pop-up\nhash: '#pool'\nname: Pool\ncards:\n  - type: custom:decluttering-card\n    template: basseng_popup\n" },
    { type: 'custom:bubble-card', card_type: 'pop-up', hash: '#egen', name: 'Egen', cards: [{ type: 'markdown', content: 'x' }] },
  ], { immediate: true });
  await M.store.set('popup_overrides', { basseng: { name: 'Bassenget mitt' }, '#vanning': { name: 'Vanning X' } }, { immediate: true });
  await M.store.set('popups', { basseng: { color: 'var(--blue)', prefer: 'custom' }, stue: { name: 'Stua' } }, { immediate: true });
  const I = M.CARD_IDS;
  await M.store.set('cards', {
    [I.navbar]: { buttons: { basseng: { tap: { action: 'navigate', navigation_path: '#basseng' } }, x1: { custom: true, label: 'Pool', tap: { action: 'navigate', navigation_path: '#basseng' } } } },
    [I.prosa]: { pills: [{ text: 'Bassenget', tap_action: { action: 'navigate', navigation_path: '#basseng' } }] },
    [I.faner]: { cards: [{ type: 'link', popup_hash: '#basseng' }, { type: 'link', popup_hash: '#bassengene' }] },
    'pop-basseng': { anim: false },
  }, { immediate: true });
  M._poolStoreMig = false;
  const d = await S.generate({}, h);
  const pool = d.views[0].cards[0].cards.filter((c) => c.card_type === 'pop-up' && /basseng|pool/.test(c.hash));
  await w(300);
  const snap = JSON.parse(JSON.stringify({ cp: M.store.get('custom_popups'), po: M.store.get('popup_overrides'), pu: M.store.get('popups'), cards: M.store.get('cards'), mig: M.store.get('migrations.basseng30') }));
  // andre generering (ny økt): migreringen kjører ikke igjen
  let writes = 0; const set0 = M.store.set; M.store.set = function (...a) { writes++; return set0.apply(this, a); };
  M._poolStoreMig = false;
  await S.generate({}, h);
  M.store.set = set0;
  return { hashes: pool.map((c) => c.hash), name: pool[0] && pool[0].name, card: pool[0] && pool[0].cards[0], snap, writes, del: window.__del.slice(), I };
}, LEGACY_CARDS);
const C0 = B.snap.cards || {};
ok('B · gamle bassengpopups fjernet fra ki-store custom_popups (#basseng med gamle kort, #pool med decluttering-mal); egne popups beholdes', Array.isArray(B.snap.cp) && B.snap.cp.length === 1 && B.snap.cp[0].hash === '#egen', B.snap.cp);
ok('B · innstillingene fra de gamle kortene (navn, hurtig) flyttet til cards.pop-basseng; eksisterende verdier beholdes', C0['pop-basseng'] && C0['pop-basseng'].navn === 'Bassenget' && Array.isArray(C0['pop-basseng'].hurtig) && C0['pop-basseng'].anim === false, C0['pop-basseng']);
ok('B · popup_overrides basseng → badebasseng (andre beholdes); popups.basseng → popups.badebasseng (prefer: custom fjernet)', !B.snap.po.basseng && B.snap.po.badebasseng && B.snap.po.badebasseng.name === 'Bassenget mitt' && B.snap.po['#vanning'].name === 'Vanning X' && !B.snap.pu.basseng && B.snap.pu.badebasseng && B.snap.pu.badebasseng.color === 'var(--blue)' && !B.snap.pu.badebasseng.prefer && B.snap.pu.stue.name === 'Stua', { po: B.snap.po, pu: B.snap.pu });
const js = JSON.stringify(C0);
ok('B · lenker i navbar, prosa-piller og Hjem-kort: #basseng → #badebasseng (andre strenger røres ikke)', !/"#basseng"/.test(js) && (js.match(/"#badebasseng"/g) || []).length === 4 && js.includes('#bassengene'), js);
ok('B · popupen er fortsatt ÉN (#badebasseng) og bruker overstyringen fra den gamle nøkkelen', B.hashes.join() === '#badebasseng' && B.name === 'Bassenget mitt', B);
ok('B · migreringen er merket (migrations.basseng30) og kjører ikke igjen (ingen skriving ved neste generering)', B.snap.mig && B.snap.mig.at && Array.isArray(B.snap.mig.log) && B.snap.mig.log.length >= 5 && B.writes === 0, { mig: B.snap.mig, writes: B.writes });
ok('B · admin: Lovelace-ressursene ki-basseng-card.js og ki-basseng-hero-card.js fjernes (bare de)', [...new Set(B.del)].sort().join() === 'r1,r2', B.del);
const mlog = logs.filter(([t, x]) => t === 'info' && /Basseng-migrering/.test(x));
ok('B · migreringen logges i konsollen (én gang per kjøring)', mlog.length === 2 && /kjørt én gang/.test(mlog[1][1]) && /custom_popups #basseng fjernet/.test(mlog[1][1]), mlog);
await p.close();

/* ---------------- C · alias #basseng → #badebasseng */
p = await page();
const Cr = await p.evaluate(async () => {
  const M = window.MSH, h = window.__h, w = (ms) => new Promise((q) => setTimeout(q, ms));
  const S = customElements.get('ll-strategy-dashboard-ki-dashboard') || customElements.get('ll-strategy-ki-dashboard');
  const d = await S.generate({}, h);
  const out = {};
  // 1) URL / lenke: location.hash = '#basseng'
  const n0 = history.length;
  location.hash = '#basseng'; await w(150);
  out.url = location.hash; out.hist = history.length - n0; // én oppføring (hash-endringen), replaceState legger ikke til
  history.replaceState(null, '', location.pathname); await w(50);
  // 2) HA navigate(): pushState + location-changed
  history.pushState(null, '', location.pathname + '#basseng'); window.dispatchEvent(new CustomEvent('location-changed')); await w(50);
  out.nav = location.hash;
  history.replaceState(null, '', location.pathname); await w(50);
  // 3) navbaren (også med gammel config som peker på #basseng)
  const nb = document.createElement('msh-navbar-card');
  nb.setConfig({ ...d.views[0].cards[0].cards[1], buttons: { basseng: { tap: { action: 'navigate', navigation_path: '#basseng' } } } });
  nb.hass = h; document.getElementById('dash').appendChild(nb); await w(700);
  const find = (r, d0 = 0) => { if (!r || d0 > 8) return null; const x = r.querySelector && r.querySelector('[data-act="go"][data-id="basseng"]'); if (x) return x; for (const e of r.querySelectorAll ? r.querySelectorAll('*') : []) { if (e.shadowRoot) { const y = find(e.shadowRoot, d0 + 1); if (y) return y; } } return null; };
  const btn = find(document);
  if (btn) { btn.click(); await w(300); }
  out.navbar = location.hash; out.btn = !!btn;
  // knappen er markert som åpen på #badebasseng
  out.navOpen = !!(nb._isOpen && nb._isOpen('basseng'));
  history.replaceState(null, '', location.pathname); await w(50);
  // 4) en helt annen popup på #basseng (ikke basseng) → ingen omdirigering
  const own = { type: 'custom:bubble-card', card_type: 'pop-up', hash: '#basseng', name: 'Notater', icon: 'mdi:note', cards: [{ type: 'markdown', content: 'x' }] };
  await S.generate({ custom_popups: [own] }, h);
  location.hash = '#basseng'; await w(150);
  out.own = location.hash;
  out.ownPops = M.popupReport.entries.filter((e) => /basseng/.test(e.hash)).map((e) => e.hash).join();
  return out;
});
ok('C · URL/lenke #basseng → #badebasseng med history.replaceState (ingen ekstra historikk)', Cr.url === '#badebasseng' && Cr.hist <= 1, Cr);
ok('C · HA-navigering (pushState + location-changed) til #basseng → #badebasseng', Cr.nav === '#badebasseng', Cr);
ok('C · navbaren åpner #badebasseng (også med gammel config #basseng), knappen markeres som åpen', Cr.btn && Cr.navbar === '#badebasseng' && Cr.navOpen, Cr);
ok('C · en helt annen popup på #basseng røres ikke (ingen omdirigering, begge finnes)', Cr.own === '#basseng' && Cr.ownPops === '#badebasseng,#basseng', Cr);
await p.close();

/* ---------------- D · alias-elementer */
logs = [];
p = await page(null, logs);
const D = await p.evaluate(async () => {
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
ok('D · alias-elementene ki-basseng-card og ki-basseng-hero-card er definert (når ingen annen ressurs har dem)', D.def.every(Boolean), D);
ok('D · ki-basseng-card rendrer msh-basseng-card med samme config (toppkort med)', D.main === 'msh-basseng-card' && D.mainCfg === 'Bassenget' && D.heroTop, D);
ok('D · ki-basseng-hero-card ved siden av et bassengkort i samme popup rendrer ingenting (gammelt og nytt kort)', D.hero === '' && D.heroShown === 'none' && D.hero3 === '' && D.hero3Shown === 'none', D);
ok('D · ki-basseng-hero-card alene rendrer msh-basseng-card', D.solo === 'msh-basseng-card' && D.soloShown === 'block', D);
const warns = logs.filter(([t, x]) => t === 'warning' && /er utgått/.test(x));
ok('D · én advarsel i konsollen per gammel korttype', warns.length === 2 && warns.some(([, x]) => /ki-basseng-card/.test(x)) && warns.some(([, x]) => /ki-basseng-hero-card/.test(x)), warns);
await p.close();

/* ---------------- E · #badebasseng og #basseng viser samme v4a-popup (skjermbilder) */
for (const hh of ['#badebasseng', '#basseng']) {
  p = await page();
  const E = await p.evaluate(async (hh) => {
    const M = window.MSH, h = window.__h, w = (ms) => new Promise((q) => setTimeout(q, ms));
    const S = customElements.get('ll-strategy-dashboard-ki-dashboard') || customElements.get('ll-strategy-ki-dashboard');
    const d = await S.generate({}, h);
    const pops = d.views[0].cards[0].cards.filter((c) => c.card_type === 'pop-up');
    pops.filter((c) => /basseng/.test(c.hash)).forEach((pop) => {
      const bc = document.createElement('bubble-card');
      bc.setConfig({ type: 'custom:bubble-card', card_type: 'pop-up', hash: pop.hash });
      bc.innerHTML = `<div class="pop bubble-pop-up"><div class="hdr bubble-header-container">${pop.name}</div><div class="inner bubble-pop-up-container"></div></div>`;
      document.getElementById('dash').appendChild(bc);
      const el = document.createElement(pop.cards[0].type.replace('custom:', ''));
      el.setConfig(pop.cards[0]); el.hass = h;
      bc.querySelector('.inner').appendChild(el);
    });
    location.hash = hh;
    await w(1200);
    const open = [...document.querySelectorAll('bubble-card')].filter((x) => !x.hasAttribute('hidden-pop'));
    const el = open[0] && open[0].querySelector('msh-basseng-card'), sr = el && el.shadowRoot;
    return { hash: location.hash, open: open.map((x) => x.config.hash), tabs: sr ? [...sr.querySelectorAll('.gti')].map((x) => x.textContent) : [], hero: !!(sr && sr.querySelector('.msh-hero-slot msh-basseng-hero-card')) };
  }, hh);
  ok(`E · ${hh}: viser den ene popupen #badebasseng (toppkort + Oversikt · Varme · Klor · Spreder)`, E.hash === '#badebasseng' && E.open.join() === '#badebasseng' && E.hero && E.tabs.join() === 'Oversikt,Varme,Klor,Spreder', E);
  if (shots) await p.screenshot({ path: `${shots}/basseng30-${hh.slice(1)}.png` });
  await p.close();
}

ok('ingen sidefeil', !errs.length, errs);
await b.close();
console.log(JSON.stringify(res, null, 1));
console.log(fail.length ? `\n${fail.length} FEIL: ${fail.join(' · ')}` : '\nAlle bestod');
process.exit(fail.length ? 1 : 0);
