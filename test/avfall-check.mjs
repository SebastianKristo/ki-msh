// Fiks 25.4 · Søppel (#soppel, msh-avfall-card): autokonfig (days_to_pickup), toppkort (184 px, pille, «I morgen», bøtter,
// søppelbil på tømmedagen), faner Oversikt · Kalender · Varsler, Tilpass Søppel ↔ GUI-editor (samme config), dra i Tilpass
// lukker ikke popupen, og «Erstattet av Søppel» for den importerte #soppel.   node test/avfall-check.mjs   (SHOTS=<mappe>)
import { createRequire } from 'node:module';
import { readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const bundle = resolve(`test/.build/avfall-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const shots = process.env.SHOTS || '';
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const res = {}, fail = [];
const ok = (name, cond, info) => { res[name] = cond ? 'OK' : ['FEIL', info]; if (!cond) fail.push(name); };
const mocks = readdirSync('test/mock').sort().map((m) => resolve('test/mock/' + m));
const errs = [];
async function page(cfg, vp) {
  const p = await b.newPage({ viewport: vp || { width: 360, height: 900 }, hasTouch: true });
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + resolve('test/harness.html'));
  for (const m of mocks) await p.addScriptTag({ path: m });
  await p.addScriptTag({ path: bundle });
  await p.evaluate(async (cfg) => {
    window.__h = window.mockHass();
    window.__hap = 0; window.addEventListener('haptic', () => window.__hap++);
    const bc = document.createElement('bubble-card');
    bc.setConfig({ type: 'custom:bubble-card', card_type: 'pop-up', hash: '#soppel' });
    bc.innerHTML = '<div class="pop"><div class="hdr">Søppel</div><div class="inner"></div></div>';
    document.getElementById('dash').appendChild(bc);
    location.hash = '#soppel';
    const c = document.createElement('msh-avfall-card');
    c.setConfig({ type: 'custom:msh-avfall-card', card_id: 'pop-soppel', ...(cfg || {}) });
    c.hass = window.__h;
    bc.querySelector('.inner').appendChild(c);
    window.__c = c;
    await new Promise((q) => setTimeout(q, 600));
  }, cfg || {});
  return p;
}
const wait = (p, ms) => p.evaluate((ms) => new Promise((q) => setTimeout(q, ms)), ms);
const click = async (p, sel) => { await p.evaluate((sel) => window.__c.shadowRoot.querySelector(sel).click(), sel); await wait(p, 350); };
const shot = async (p, n) => { if (shots) await p.screenshot({ path: `${shots}/avfall-${n}.png`, fullPage: true }); };
const setState = (p, id, st, attrs) => p.evaluate(({ id, st, attrs }) => { const h = window.__h; const s = { ...h.states[id], state: st, attributes: { ...h.states[id].attributes, ...(attrs || {}) } }; window.__h = { ...h, states: { ...h.states, [id]: s } }; window.__c.hass = window.__h; }, { id, st, attrs });

const p = await page();
// ---------------------------------------------------------------- autokonfig + toppkort
const H = await p.evaluate(() => {
  const sr = window.__c.shadowRoot, hero = sr.querySelector('.hero'), r = hero.getBoundingClientRect();
  return { h: Math.round(r.height), bg: getComputedStyle(hero).backgroundColor, rad: getComputedStyle(hero).borderRadius, pill: sr.querySelector('.pill').textContent.trim(), big: sr.querySelector('.big').textContent.trim(), nm: sr.querySelector('.hero .nm').textContent.trim(), dt: sr.querySelector('.hero .dt').textContent.trim(), bins: sr.querySelectorAll('.bins .bin').length, hop: sr.querySelector('.bins').classList.contains('hop'), gear: !!sr.querySelector('.hero .gear[data-act="customize"]'), truck: !!sr.querySelector('.truck'), ids: window.MSH.avfallIds(window.__h, {}) };
});
ok('autokonfig: fire fraksjoner med days_to_pickup (ingen entities i config)', H.ids.join() === 'sensor.glass_og_metallemballasje,sensor.papir_og_papp,sensor.plastemballasje,sensor.restavfall', H.ids);
ok('toppkort 184 px, #2b3039, r28', H.h === 184 && H.bg === 'rgb(43, 48, 57)' && H.rad === '28px', H);
ok('toppkort: «Neste tømming», «I morgen», begge fraksjonene og dato', H.pill === 'Neste tømming' && H.big === 'I morgen' && H.nm === 'Plastemballasje og Restavfall' && /\d+\. /.test(H.dt), H);
ok('bøttene hopper dagen før (to bøtter), ingen søppelbil', H.bins === 2 && H.hop && !H.truck, H);
ok('tannhjul øverst til høyre', H.gear, H);
// faner
const T = await p.evaluate(() => { const sr = window.__c.shadowRoot; const tabs = [...sr.querySelectorAll('.tabs .tb')]; return { names: tabs.map((t) => t.textContent.trim()), cut: tabs.some((t) => t.scrollWidth > t.clientWidth + 1), glass: sr.querySelector('.tabs').dataset.glassDrag }; });
ok('faner Oversikt · Kalender · Varsler, ingen avkuttet tekst ved 360 px, glass-drag', T.names.join() === 'Oversikt,Kalender,Varsler' && !T.cut && T.glass === 'x', T);
// Oversikt
const O = await p.evaluate(() => { const sr = window.__c.shadowRoot; return { cards: [...sr.querySelectorAll('.fk')].map((e) => e.querySelector('.fn').textContent.trim() + '|' + e.querySelector('.fd').textContent.trim()), cols: getComputedStyle(sr.querySelector('.grid2')).gridTemplateColumns.split(' ').length, bars: sr.querySelectorAll('.fk .bar i').length, days: sr.querySelectorAll('.days .dc').length, today: sr.querySelector('.days .dc.td') && getComputedStyle(sr.querySelector('.days .dc.td')).backgroundImage, dots: sr.querySelectorAll('.days .dc')[1].querySelectorAll('.dots i').length }; });
ok('Oversikt: 2-kol fraksjonskort med fremdriftsstrek', O.cols === 2 && O.cards.length === 4 && O.bars === 4 && O.cards[0] === 'Plastemballasje|I morgen' && O.cards[3] === 'Glass- og metallemballasje|22 dager', O);
ok('Neste 14 dager: 14 dager, i dag rosa, prikker per fraksjon (i morgen = 2)', O.days === 14 && /gradient/.test(O.today || '') && O.dots === 2, O);
await shot(p, '1-oversikt');
// velg fraksjon → toppkortet
await click(p, '.fk[data-v="sensor.papir_og_papp"]');
const S1 = await p.evaluate(() => { const sr = window.__c.shadowRoot; return { big: sr.querySelector('.big').textContent.trim(), nm: sr.querySelector('.hero .nm').textContent.trim(), on: sr.querySelector('.fk.on') && sr.querySelector('.fk.on').dataset.v, hap: window.__hap }; });
ok('trykk på fraksjon velger den og oppdaterer toppkortet (+ haptic)', S1.big === 'Om 8 dager' && S1.nm === 'Papir og papp' && S1.on === 'sensor.papir_og_papp' && S1.hap >= 1, S1);
await click(p, '.days .dc:nth-child(2)');
const DP = await p.evaluate(() => window.__c.shadowRoot.querySelector('.dp') && window.__c.shadowRoot.querySelector('.dp').textContent.replace(/\s+/g, ' ').trim());
ok('trykk på dag viser dagens fraksjoner', /Restavfall/.test(DP || '') && /Plastemballasje/.test(DP || ''), DP);
// Kalender
await click(p, '.tb[data-v="kalender"]');
const K = await p.evaluate(() => { const sr = window.__c.shadowRoot; return { cells: sr.querySelectorAll('.mg .mc').length, dots: sr.querySelectorAll('.mg .dots i').length, est: sr.querySelectorAll('.mg .dots i.est').length, title: sr.querySelector('.mh .mt').textContent.trim() }; });
ok('Kalender: måned med prikker per fraksjon', K.cells >= 28 && K.dots >= 2 && /\d{4}/.test(K.title), K);
await shot(p, '2-kalender');
await click(p, '.nb[data-v="1"]');
const K2 = await p.evaluate(() => window.__c.shadowRoot.querySelector('.mh .mt').textContent.trim());
ok('Kalender: neste måned', K2 !== K.title, [K.title, K2]);
// Varsler
await click(p, '.tb[data-v="varsler"]');
const V0 = await p.evaluate(() => { const sr = window.__c.shadowRoot; return { rows: sr.querySelectorAll('.vr').length, sw: sr.querySelectorAll('.vr .sw').length, tid: [...sr.querySelectorAll('.seg .sg')].map((e) => e.textContent.trim()), on: sr.querySelector('.seg .sg.on').textContent.trim(), segbg: getComputedStyle(sr.querySelector('.seg')).backgroundColor }; });
ok('Varsler: bryter per fraksjon + Kveld 18:00 / Kveld 20:00 / Morgen 07:00 (standard 18:00)', V0.rows === 4 && V0.sw === 4 && V0.tid.join('|') === 'Kveld 18:00|Kveld 20:00|Morgen 07:00' && V0.on === 'Kveld 18:00' && V0.segbg === 'rgb(40, 40, 40)', V0);
await click(p, '.vr[data-v="sensor.restavfall"]');
await click(p, '.sg[data-v="07:00"]');
const V1 = await p.evaluate(() => ({ v: window.__c.config.varsler, t: window.__c.config.varseltid, calls: (window.__calls || []).filter((c) => c[0] === 'notify').length }));
ok('Varsler lagres i config (varsler, varseltid) – kortet sender ingenting', V1.v && V1.v['sensor.restavfall'] === true && V1.t === '07:00' && V1.calls === 0, V1);
await shot(p, '3-varsler');
// tømmedag: 0 dager → «Tømmes i dag», lokk rister, søppelbil
await setState(p, 'sensor.restavfall', 'Neste henting', { days_to_pickup: 0 });
await setState(p, 'sensor.plastemballasje', 'Neste henting', { days_to_pickup: 0 });
await p.evaluate(() => window.__c.setUI({ sel: null })); await wait(p, 300);
const D0 = await p.evaluate(() => { const sr = window.__c.shadowRoot; return { pill: sr.querySelector('.pill').textContent.trim(), big: sr.querySelector('.big').textContent.trim(), shake: sr.querySelector('.bins').classList.contains('shake'), truck: !!sr.querySelector('.road .truck'), blink: getComputedStyle(sr.querySelector('.pill i')).animationName }; });
ok('tømmedag: «Tømmes i dag» (blinkende prikk), lokket rister, søppelbilen kjører', D0.pill === 'Tømmes i dag' && D0.big === 'I dag' && D0.shake && D0.truck && D0.blink === 'blink', D0);
await shot(p, '4-idag');
await p.evaluate(() => { window.__c.setConfig({ ...window.__c._rawConfig, soppelbil: false }); }); await wait(p, 300);
ok('søppelbil av i config → ingen bil', await p.evaluate(() => !window.__c.shadowRoot.querySelector('.truck')));
// dager fra state / raw_date (ingen attributt)
const calc = await p.evaluate(() => {
  const h = window.__h, d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + 3);
  const st = (id, state, a) => ({ entity_id: id, state, attributes: a });
  const H2 = { ...h, states: { ...h.states, 'sensor.a_rest': st('sensor.a_rest', '5', { friendly_name: 'Rest', days_to_pickup: null }), 'sensor.b_papir': st('sensor.b_papir', 'x', { friendly_name: 'Papir', raw_date: d.toISOString() }) } };
  return window.MSH.avfallFraksjoner(H2, { entities: ['sensor.a_rest', 'sensor.b_papir'] }).map((f) => f.id + ':' + f.dager + ':' + f.farge);
});
ok('dager: state som tall → ellers regnet fra raw_date; farger etter navnet (temafarger)', calc.includes('sensor.a_rest:5:var(--gray700, #979797)') && calc.includes('sensor.b_papir:3:var(--blue, #73b9f2)'), calc);
const fut = await p.evaluate(() => { const L = window.MSH.avfallFraksjoner(window.__h, { intervall_dager: 14 }); return window.MSH.avfallDatoer(L, { intervall_dager: 14 }).filter((x) => x.id === 'sensor.papir_og_papp').map((x) => Math.round((x.dato - new Date(new Date().setHours(0, 0, 0, 0))) / 864e5)).slice(0, 3); });
ok('fremtidige datoer = raw_date + n × intervall_dager', fut.join() === '8,22,36', fut);
await p.close();

// ---------------------------------------------------------------- uten sensorer: «–» + Velg entitet, toppkortet vises
const p2 = await page({ entities: ['sensor.finnes_ikke'] });
const N = await p2.evaluate(() => { const sr = window.__c.shadowRoot; return { h: Math.round(sr.querySelector('.hero').getBoundingClientRect().height), big: sr.querySelector('.big').textContent.trim(), pick: !!sr.querySelector('.hero [data-act="customize"][data-section="entiteter"]') }; });
ok('uten sensorer: toppkortet vises med «–» + «Velg entitet»', N.h === 184 && N.big === '–' && N.pick, N);
await shot(p2, '5-tom');
await p2.close();

// ---------------------------------------------------------------- Tilpass Søppel ↔ GUI-editor
const p3 = await page();
await p3.evaluate(() => window.__c.shadowRoot.querySelector('.hero .gear').click()); await wait(p3, 700);
const E = await p3.evaluate(() => {
  const find = (root) => { for (const x of root.querySelectorAll('*')) { if (x.localName === 'msh-editor') return x; if (x.shadowRoot) { const y = find(x.shadowRoot); if (y) return y; } } return null; };
  const ed = find(window.MSH.overlayRoot());
  window.__ed = ed;
  const sr = ed.shadowRoot, tabs = [...sr.querySelectorAll('.chips.sg.tabs [data-a="tab"]')];
  const sw = sr.querySelector('.sw');
  return { title: sr.querySelector('.ttl .tt').textContent, tabs: tabs.map((t) => t.getAttribute('aria-label') || t.textContent.trim()), rows: sr.querySelectorAll('[data-elist="sop-tab"]').length, hd: getComputedStyle(sr.querySelector('[data-edrag]')).touchAction, segbg: getComputedStyle(sr.querySelector('.chips.sg.tabs')).backgroundColor, secbg: getComputedStyle(sr.querySelector('.fsec>.sec')).backgroundColor, secr: getComputedStyle(sr.querySelector('.fsec>.sec')).borderRadius };
});
ok('Tilpass Søppel: fire faner (Faner · Fraksjoner · Entiteter · Avansert)', /Søppel/.test(E.title) && E.tabs.join() === 'Faner,Fraksjoner,Entiteter,Avansert', E);
ok('Tilpass: segment på #282828, seksjonskort #3a3a3a r24, dra-håndtak touch-action:none', E.segbg === 'rgb(40, 40, 40)' && E.secbg === 'rgb(58, 58, 58)' && E.secr === '24px' && E.hd === 'none' && E.rows === 3, E);
// dra Varsler øverst (pekerhendelser) – popupen skal ikke få hendelsen
const drag = await p3.evaluate(async () => {
  const sr = window.__ed.shadowRoot, rows = [...sr.querySelectorAll('[data-elist="sop-tab"]')];
  let leaked = 0; const bc = document.querySelector('bubble-card'); const leak = () => leaked++;
  ['pointerdown', 'pointermove', 'touchstart', 'touchmove'].forEach((t) => document.addEventListener(t, leak));
  const hd = rows[2].querySelector('[data-edrag]'), r0 = rows[0].getBoundingClientRect(), r2 = hd.getBoundingClientRect();
  const ev = (t, el, y) => el.dispatchEvent(new PointerEvent(t, { bubbles: true, composed: true, pointerId: 7, clientX: r2.left + 5, clientY: y, button: 0 }));
  ev('pointerdown', hd, r2.top + 5); ev('pointermove', hd, r0.top + 10); ev('pointerup', hd, r0.top + 10);
  await new Promise((q) => setTimeout(q, 300));
  ['pointerdown', 'pointermove', 'touchstart', 'touchmove'].forEach((t) => document.removeEventListener(t, leak));
  return { order: window.__ed._config.tab_order, leaked, card: window.__c.config.tab_order, tabs: [...window.__c.shadowRoot.querySelectorAll('.tabs .tb')].map((t) => t.dataset.v) };
});
ok('dra i Tilpass: ny rekkefølge, forhåndsvises i kortet, ingen hendelser lekker til popupen', drag.order && drag.order[0] === 'varsler' && drag.leaked === 0 && drag.tabs[0] === 'varsler', drag);
// Fraksjoner: skjul Glass → forsvinner fra Oversikt; farge
await p3.evaluate(async () => { const sr = window.__ed.shadowRoot; sr.querySelector('[data-a="tab"][data-v="fraksjoner"]').click(); await new Promise((q) => setTimeout(q, 200)); sr.querySelector('[data-op="feye"][data-v="sensor.glass_og_metallemballasje"]').click(); await new Promise((q) => setTimeout(q, 200)); sr.querySelector('[data-op="fexp"][data-v="sensor.restavfall"]').click(); await new Promise((q) => setTimeout(q, 200)); sr.querySelector('[data-op="fcol"][data-v="sensor.restavfall"][data-c="var(--red)"]').click(); await new Promise((q) => setTimeout(q, 300)); });
const F = await p3.evaluate(() => ({ fr: window.__ed._config.fraksjoner, cards: [...window.__c.shadowRoot.querySelectorAll('.fk')].length, rows: window.__ed.shadowRoot.querySelectorAll('[data-elist="sop-frak"]').length }));
ok('Fraksjoner: skjul + farge fra temaet lagres i utkastet og vises straks', F.fr && F.fr['sensor.glass_og_metallemballasje'].hidden === true && F.fr['sensor.restavfall'].color === 'var(--red)' && F.rows === 4, F);
// Entiteter: fjern papir → entities materialiseres
await p3.evaluate(async () => { const sr = window.__ed.shadowRoot; sr.querySelector('[data-a="tab"][data-v="entiteter"]').click(); await new Promise((q) => setTimeout(q, 200)); sr.querySelector('[data-op="erm"][data-v="sensor.papir_og_papp"]').click(); await new Promise((q) => setTimeout(q, 300)); });
const EN = await p3.evaluate(() => window.__ed._config.entities);
ok('Entiteter: fjern fraksjon → entities (uten papir)', Array.isArray(EN) && EN.length === 3 && !EN.includes('sensor.papir_og_papp'), EN);
// Avansert
await p3.evaluate(async () => { const sr = window.__ed.shadowRoot; sr.querySelector('[data-a="tab"][data-v="avansert"]').click(); await new Promise((q) => setTimeout(q, 200)); });
const AV = await p3.evaluate(() => { const sr = window.__ed.shadowRoot, sw = sr.querySelector('.sw.on'); const cs = getComputedStyle(sw); return { n: sr.querySelectorAll('.sw').length, w: cs.width, h: cs.height, bg: cs.backgroundColor, sel: [...sr.querySelectorAll('[data-name="varseltid"]')].map((x) => x.textContent.trim()) }; });
ok('Avansert: søppelbil, haptikk (rosa brytere 44×26), standard varseltid', AV.n >= 2 && AV.w === '44px' && AV.h === '26px' && AV.bg === 'rgb(242, 133, 201)' && AV.sel.length === 3, AV);
await shot(p3, '6-tilpass');
// Ferdig → lagret config; GUI-editoren viser det samme
const saved = await p3.evaluate(async () => {
  const sr = window.__ed.shadowRoot; sr.querySelector('[data-a="save"]').click();
  await new Promise((q) => setTimeout(q, 1200));
  const cfg = window.__c._rawConfig;
  const g = window.MSH.Card && customElements.get('msh-avfall-card').getConfigElement(); g.hass = window.__h; g.setConfig(cfg); document.body.appendChild(g); await new Promise((q) => setTimeout(q, 200));
  const gs = g.shadowRoot; gs.querySelector('[data-a="tab"][data-v="fraksjoner"]').click(); await new Promise((q) => setTimeout(q, 200));
  const rows = [...gs.querySelectorAll('[data-elist="sop-frak"]')].map((r) => r.dataset.edk + (r.classList.contains('off') ? ':skjult' : ''));
  let changed = null; g.addEventListener('config-changed', (e) => { changed = e.detail.config; });
  gs.querySelector('[data-a="tab"][data-v="faner"]').click(); await new Promise((q) => setTimeout(q, 200));
  gs.querySelector('[data-op="teye"][data-v="kalender"]').click(); await new Promise((q) => setTimeout(q, 200));
  return { cfg: { tab_order: cfg.tab_order, fr: cfg.fraksjoner, entities: cfg.entities }, rows, gui: changed && changed.tab_hidden };
});
ok('Ferdig lagrer; GUI-editoren (getConfigElement) viser samme config og endrer samme nøkler', saved.cfg.tab_order && saved.cfg.tab_order[0] === 'varsler' && saved.cfg.fr && saved.rows.includes('sensor.glass_og_metallemballasje:skjult') && Array.isArray(saved.gui) && saved.gui.includes('kalender'), saved);
await p3.close();

// ---------------------------------------------------------------- strategien: #soppel genereres, importert ki-avfall-card erstattes
const p4 = await page();
const ST = await p4.evaluate(async () => {
  const M = window.MSH, h = window.__h;
  const imported = { type: 'custom:bubble-card', card_type: 'pop-up', hash: '#soppel', name: 'Søppel', cards: [{ type: 'custom:gap-card' }, { type: 'custom:ki-avfall-card', entities: ['sensor.restavfall', 'sensor.papir_og_papp'], dager_attributt: 'days_to_pickup', dato_attributt: 'raw_date', kalender: true, intervall_dager: 14, kolonner: 1 }] };
  const S = customElements.get('ll-strategy-dashboard-ki-dashboard') || customElements.get('ll-strategy-ki-dashboard');
  if (M.store && !M.store.loaded) await M.store.load(h);
  await M.store.set('custom_popups', [imported], { immediate: true });
  const d = await S.generate({}, h);
  const st = d.views[0].cards[0], pops = st.cards.filter((c) => c.card_type === 'pop-up'), sop = pops.filter((c) => c.hash === '#soppel');
  return { n: sop.length, card: sop[0] && sop[0].cards, inactive: (M.popupReport.inactive || []).filter((x) => x.hash === '#soppel').map((x) => x.by), inn: pops.some((c) => c.hash === '#innstillinger'), settings: pops.filter((c) => c.hash === '#settings').map((c) => c.cards[0].type) };
});
ok('strategien: #soppel genereres med msh-avfall-card og oppsettet fra ki-avfall-card; den importerte = «Erstattet av Søppel»', ST.n === 1 && ST.card.length === 1 && ST.card[0].type === 'custom:msh-avfall-card' && ST.card[0].intervall_dager === 14 && ST.card[0].entities.length === 2 && ST.inactive.join() === 'Søppel', ST);
ok('strategien: #innstillinger genereres ved siden av #settings (msh-settings-card uendret)', ST.inn && ST.settings.join() === 'custom:msh-settings-card', ST);
await p4.close();

ok('ingen sidefeil', !errs.length, errs);
await b.close();
console.log(JSON.stringify(res, null, 1));
console.log(fail.length ? `\n${fail.length} FEIL: ${fail.join(' · ')}` : '\nAlle bestod');
process.exit(fail.length ? 1 : 0);
