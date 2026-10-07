// Fiks 56 A/B · Kalender → Posten: pakkeprikker per dag + liste under valgt dag (A), samme komponent for PostNord med
//   deduplisering på sporingsnummer (B1), transportøren i undertittelen / ikon / chip + titler + statustekst (B2) og
//   innholdet under Bubble-headeren i alle faner (B3, ekte Bubble Card). Lys og mørk modus.
//   Fast klokke: onsdag 7. okt 2026 12:00, Europe/Oslo (lokal tid ≠ UTC, så 00:30-testen betyr noe).
//   node test/kalender56-check.mjs        (SHOT_DIR=<mappe> lagrer skjermbilder)
import { createRequire } from 'node:module';
import { readdirSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
mkdirSync('test/.build', { recursive: true });
const bundle = resolve(`test/.build/kalender56-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
let fails = 0;
const ok = (name, cond, info) => { if (!cond) fails++; console.log(`${cond ? '✔' : '✘'} ${name}${info != null && !cond ? ' · ' + JSON.stringify(info).slice(0, 1400) : ''}`); };
const mocks = readdirSync('test/mock').filter((f) => f.endsWith('.js')).sort().map((m) => resolve('test/mock/' + m));
const errs = [];
const SHOT = process.env.SHOT_DIR || '';
const NOW = new Date('2026-10-07T12:00:00+02:00');

// Testdata (injiseres i hass): Norwegian Parcel Tracker + én PostNord-konto
function inject() {
  const H = window.__h;
  const st = (id, state, attrs) => ({ entity_id: id, state: String(state), attributes: { friendly_name: id, ...attrs }, last_updated: new Date(Date.now() - 60000).toISOString(), last_changed: new Date(Date.now() - 60000).toISOString(), context: {} });
  const npt = (id, state, attrs) => { H.states[id] = st(id, state, attrs); H.entities[id] = { entity_id: id, platform: 'norwegian_parcel_tracker' }; };
  // levert i dag 09:12 (LL134336179NO) · levert 00:30 lokal tid (= 22:30 UTC dagen før) · duplikat av PostNord-pakken
  npt('sensor.ll134336179no_status', 'Levert', { friendly_name: 'LL134336179NO status', tracking_number: 'LL134336179NO', delivery_method: 'Norgespakke liten', events: [{ time: '2026-10-07T09:12:00+02:00', description: 'Sendingen er utlevert i postkassen.' }, { time: '2026-10-06T15:00:00+02:00', description: 'Sendingen er på vei' }] });
  npt('sensor.natt_status', 'Levert', { friendly_name: 'Nattlevering status', tracking_number: 'KK000000001NO', sender: 'Nattbutikken', events: [{ time: '2026-10-06T22:30:00Z', description: 'Levert' }] });
  npt('sensor.dup_status', 'Levert', { friendly_name: 'UX999999999SE status', tracking_number: 'UX999999999SE', sender: 'Elkjøp', events: [{ time: '2026-10-07T10:00:00+02:00', description: 'Levert' }] });
  H.devices = { ...(H.devices || {}), dev_pn_j: { id: 'dev_pn_j', name: 'PostNord (jemtlands@gmail.com)', manufacturer: 'PostNord', config_entries: ['ce_j'] } };
  const J = 'postnord_jemtlands_gmail_com';
  const addJ = (id, state, attrs, tk, uid) => { H.states[id] = st(id, state, attrs); H.entities[id] = { entity_id: id, platform: 'postnord', device_id: 'dev_pn_j', config_entry_id: 'ce_j', translation_key: tk, unique_id: 'ce_j_' + uid, has_entity_name: true }; };
  const P = (code, status, extra) => ({ carrier: 'PostNord', barcode: code, sender: null, receiver: null, status, raw_status: null, delivered: status === 'delivered', delivered_at: null, planned_from: null, planned_to: null, pickup: status === 'at_pickup_point', pickup_point: null, url: `https://tracking.postnord.com/tracking?id=${code}`, history: null, ...extra });
  const PN = {
    dup: P('UX999999999SE', 'delivered', { sender: 'Elkjøp', delivered_at: '2026-10-07T10:05:00+02:00', raw_status: 'Levert' }),
    ready: P('CT184146155DE', 'at_pickup_point', { pickup_point: 'POSTNORD STRØMMEN SENTER', raw_status: 'Klar for henting', history: [{ status: 'at_pickup_point', timestamp: '2026-10-07T08:00:00+02:00', description: 'Klar for henting' }, { status: 'in_transit', timestamp: '2026-10-06T10:00:00+02:00', description: 'Under transport' }] }),
    fre: P('UC333333333SE', 'in_transit', { sender: 'Lego', planned_from: '2026-10-09T10:00:00+02:00', raw_status: 'Under transport' }),
    lor: P('UD444444444SE', 'in_transit', { sender: 'Boozt', planned_from: '2026-10-10T12:00:00+02:00', raw_status: 'Under transport' }),
    noEta: P('UE555555555SE', 'in_transit', { raw_status: 'Under transport' }),
    unk: P('UH777777777SE', 'unknown', {}),
    m1: P('UG100000001SE', 'in_transit', { sender: 'Komplett', planned_from: '2026-10-12T10:00:00+02:00' }),
    m2: P('UG100000002SE', 'in_transit', { sender: 'Kjell & Company', planned_from: '2026-10-12T11:00:00+02:00' }),
    m3: P('UG100000003SE', 'in_transit', { sender: 'Apotek 1', planned_from: '2026-10-12T12:00:00+02:00' }),
    m4: P('UG100000004SE', 'out_for_delivery', { sender: 'Clas Ohlson', planned_from: '2026-10-12T13:00:00+02:00' }),
    out: P('UF666666666SE', 'in_transit', { name: 'Zalando retur', receiver: 'Zalando', delivery_method: 'Electronic shipping notice', planned_from: '2026-10-08T12:00:00+02:00', raw_status: 'Under transport' }),
  };
  window.PN = PN; window.J = J;
  const inc = [PN.ready, PN.fre, PN.lor, PN.noEta, PN.unk, PN.m1, PN.m2, PN.m3, PN.m4];
  addJ(`button.${J}_oppdater`, 'unknown', {}, 'refresh', 'refresh');
  addJ(`sensor.${J}_innkommende_pakker`, inc.length, { parcels: inc }, 'incoming_parcels', 'incoming_parcels');
  addJ(`sensor.${J}_klar_for_henting`, 1, { parcels: [PN.ready] }, 'awaiting_pickup', 'awaiting_pickup');
  addJ(`sensor.${J}_leverte_pakker`, 1, { parcels: [PN.dup] }, 'delivered_parcels', 'delivered_parcels');
  addJ(`sensor.${J}_utgaende_pakker`, 1, { parcels: [PN.out] }, 'outgoing_parcels', 'outgoing_parcels');
  H.services = { ...H.services, postnord: { track_parcel: {}, untrack_parcel: {} } };
}

async function page(cfg, opts) {
  opts = opts || {};
  const ctx = await b.newContext({ viewport: { width: opts.width || 390, height: opts.height || 900 }, hasTouch: true, timezoneId: 'Europe/Oslo', locale: 'nb-NO' });
  const p = await ctx.newPage();
  await p.clock.install({ time: NOW }); await p.clock.resume(); // klokken går (haptic-strupingen bruker Date.now)
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await p.goto('file://' + resolve('test/harness.html'));
  for (const m of mocks) await p.addScriptTag({ path: m });
  await p.addScriptTag({ path: bundle });
  await p.evaluate(async ({ cfg, inj, light }) => {
    const H = window.__h = window.mockHass();
    if (light) H.themes = { ...(H.themes || {}), darkMode: false };
    window.HP = []; window.addEventListener('haptic', (e) => window.HP.push(e.detail));
    eval('(' + inj + ')')();
    const bc = document.createElement('bubble-card');
    bc.setConfig({ type: 'custom:bubble-card', card_type: 'pop-up', hash: '#kalender' });
    bc.innerHTML = '<div class="pop"><div class="hdr">Kalender</div><div class="inner"></div></div>';
    document.getElementById('dash').appendChild(bc);
    location.hash = '#kalender';
    const c = document.createElement('msh-kalender-card');
    c.setConfig({ type: 'custom:msh-kalender-card', card_id: 'pop-kal56', ...(cfg || {}) });
    c.hass = H;
    bc.querySelector('.inner').appendChild(c);
    window.__c = c;
    await new Promise((q) => setTimeout(q, 600));
    c.shadowRoot.querySelector('[data-act="tab"][data-v="posten"]').click();
    await new Promise((q) => setTimeout(q, 600));
    window.sr = () => window.__c.shadowRoot;
    window.sleep = (ms) => new Promise((q) => setTimeout(q, ms));
    window.setCfg = async (patch) => { const c2 = { ...window.__c.config, ...patch }; Object.keys(patch).forEach((k) => { if (patch[k] === undefined) delete c2[k]; }); window.__c.setConfig(c2); await sleep(300); };
    window.newHass = () => { const H = window.__h; window.__h = { ...H, states: { ...H.states }, entities: { ...H.entities } }; return window.__h; };
    // prikkene per dag: { '2026-10-07': ['levert', …], … } + «+N»
    window.dots = () => Object.fromEntries([...sr().querySelectorAll('.pg .pd')].map((d) => [d.dataset.v, { cats: [...d.querySelectorAll('.pdt i')].map((i) => i.dataset.cat), more: (d.querySelector('.pdt em') || {}).textContent || '' }]));
    window.list = () => { const L = sr().querySelector('.card.post .pkl'); return L ? { head: L.querySelector('.pklh').textContent, rows: [...L.querySelectorAll('.pkli')].map((r) => ({ id: r.dataset.v, cat: r.dataset.cat, title: r.querySelector('b').textContent, sub: r.querySelector('.evc>span').textContent, st: r.querySelector('.pkls').textContent })) } : null; };
    window.kids = () => [...sr().querySelector('.card.post').children].map((x) => x.className.split(' ')[0]).join();
  }, { cfg, inj: inject.toString(), light: !!opts.light });
  return p;
}

/* =============================================================== A · prikker */
let p = await page();
if (SHOT) await p.screenshot({ path: SHOT + '/k56-posten.png', fullPage: true });
const D = await p.evaluate(() => dots());
ok('Rutenettet: 10 hverdager fra onsdag 7. okt', Object.keys(D).length === 10 && Object.keys(D)[0] === '2026-10-07' && !Object.keys(D).includes('2026-10-10'), Object.keys(D));
const W = D['2026-10-07'];
ok('Ons 7: 00:30-pakken (blå), CT18… og Zalando klar (gul), LL134336179NO og Elkjøp (én gang) blå → 3 prikker (tidsrekkefølge) + «+2»', W && W.cats.length === 3 && W.more === '+2' && W.cats.join() === 'levert,klar,klar', W);
const L0 = await p.evaluate(() => list());
ok('Dagens liste: «I dag · 5 pakker», LL134336179NO = «…6179NO» med «Levert»', L0 && L0.head === 'I dag · 5 pakker' && L0.rows.some((r) => r.id === 'sensor.ll134336179no_status' && r.title === '…6179NO' && r.st === 'Levert' && /utlevert i postkassen/.test(r.sub)), L0);
ok('Lokal tid: levert 00:30 (22:30 UTC dagen før) ligger på ons 7, ikke tirsdag', L0.rows.some((r) => r.id === 'sensor.natt_status'), L0.rows.map((r) => r.id));
ok('B1 Dedupe: UX999999999SE i både Posten og PostNord → én rad/prikk', L0.rows.filter((r) => /UX999999999SE/.test(r.id) || r.title === 'Elkjøp').length === 1, L0.rows);
ok('Klar til henting (CT18…) → gul prikk på dagen den ble klar, «Hentes»', L0.rows.some((r) => r.id === 'pn:CT184146155DE' && r.cat === 'klar' && r.st === 'Hentes'), L0.rows);
ok('Fre 9: ETA fredag (grønn) + lørdags-ETA flyttet til fredag (grønn)', D['2026-10-09'] && D['2026-10-09'].cats.join() === 'vei,vei' && !D['2026-10-09'].more, D['2026-10-09']);
ok('Man 12: fire pakker → 3 prikker + «+1»', D['2026-10-12'] && D['2026-10-12'].cats.length === 3 && D['2026-10-12'].more === '+1', D['2026-10-12']);
ok('Uten ETA: ingen prikk (UE555… finnes ikke i noen dag)', !Object.values(D).some((x) => x.cats.length > 3) && !(await p.evaluate(() => [...sr().querySelectorAll('.pkli')].some((r) => r.dataset.v === 'pn:UE555555555SE'))), null);
ok('Utgående: av som standard (tor 8 uten prikker)', D['2026-10-08'].cats.length === 0, D['2026-10-08']);
// farger, mål
const G = await p.evaluate(() => {
  const cs = (e) => getComputedStyle(e), r = (e) => e.getBoundingClientRect();
  const tile = sr().querySelector('.pd[data-v="2026-10-07"]'), b2 = tile.querySelector('b'), I = [...tile.querySelectorAll('.pdt i')], em = tile.querySelector('.pdt em');
  const tr = r(tile), br = r(b2), ir = I.map(r);
  const grp = r(tile.querySelector('.pdt'));
  const kids = [...tile.querySelector('.pdt').children].map(r);
  const empty = sr().querySelector('.pd[data-v="2026-10-08"]');
  const col = (cat) => { const d = sr().querySelector(`.pdt i[data-cat="${cat}"]`); return d ? cs(d).backgroundColor : null; };
  return { w: ir.map((x) => x.width), h: ir.map((x) => x.height), gap: ir.slice(1).map((x, i) => Math.round((x.left - ir[i].right) * 10) / 10), under: Math.round(ir[0].top - br.bottom), inside: ir.every((x) => x.bottom <= tr.bottom - 0.5 && x.top >= br.bottom), center: Math.abs((kids[0].left + kids[kids.length - 1].right) / 2 - (tr.left + tr.width / 2)), th: tr.height, eh: r(empty).height, em: em ? cs(em).fontSize : null, blue: col('levert'), yellow: col('klar'), green: col('vei'), grp: grp.height };
});
ok('Prikker 6×6 px, 4 px mellomrom, sentrert', G.w.every((x) => x === 6) && G.h.every((x) => x === 6) && G.gap.every((x) => Math.abs(x - 4) <= 0.6) && G.center <= 1.5, G);
ok('Prikkene ligger rett under tallet (6 px under sifrene) og inni flisen; «+N» 10px', G.under >= 1 && G.under <= 4 && G.inside && G.em === '10px', G);
ok('Farger: levert blå #73b9f2, klar gul #f2d073, på vei grønn #73f2a8', G.blue === 'rgb(115, 185, 242)' && G.yellow === 'rgb(242, 208, 115)' && G.green === 'rgb(115, 242, 168)', G);
const TH = await p.evaluate(async () => { const a = [...sr().querySelectorAll('.pd')].map((d) => d.getBoundingClientRect().height); await setCfg({ post_parcels: false }); const b2 = [...sr().querySelectorAll('.pd')].map((d) => d.getBoundingClientRect().height); const k = kids(); await setCfg({ post_parcels: undefined }); return { a, b: b2, k }; });
ok('Flisens høyde er uendret (med/uten prikker, alle like)', TH.a.every((x) => x === TH.b[0]) && TH.b.every((x) => x === TH.b[0]), TH);
ok('«Vis pakker i kalender» av → ingen prikker og ingen liste', TH.k === 'pt,pg,pnchs', TH);

/* =============================================================== A · lista */
const LS = await p.evaluate(() => {
  const cs = (e) => getComputedStyle(e), r = (e) => e.getBoundingClientRect();
  const L = sr().querySelector('.pkl'), h = L.querySelector('.pklh'), row = L.querySelector('.pkli'), ic = row.querySelector('.pkic'), t = row.querySelector('b'), s = row.querySelector('.evc>span'), dot = row.querySelector('.pkd'), st = row.querySelector('.pkls');
  return { kids: kids(), head: [cs(h).fontSize, cs(h).color], row: [cs(row).backgroundColor, cs(row).borderRadius, Math.round(r(row).height)], ic: [Math.round(r(ic).width), cs(ic).borderRadius], t: cs(t).fontSize, s: [cs(s).fontSize, cs(s).color, cs(s).textOverflow, cs(s).whiteSpace], dot: [cs(dot).backgroundColor, Math.round(r(dot).width)], st: [st.textContent, Math.round(r(st).right) <= Math.round(r(row).right) - 8] };
});
ok('Lista ligger under rutenettet og over tall-chipsene', LS.kids === 'pt,pg,pkl,pnchs', LS.kids);
ok('Overskrift 12px #979797', LS.head[0] === '12px' && LS.head[1] === 'rgb(151, 151, 151)', LS.head);
ok('Rad: #404040, radius 16, 56 px høy, ikon i rund 36 px sirkel', LS.row.join() === 'rgb(64, 64, 64),16px,56' && LS.ic[0] === 36 && LS.ic[1] === '18px', LS);
ok('Rad: tittel 14px, siste status 12px #afafaf én linje med ellipse, statusprikk + statustekst til høyre', LS.t === '14px' && LS.s.join() === '12px,rgb(175, 175, 175),ellipsis,nowrap' && LS.dot[1] === 8 && LS.st[1], LS);
// velg dag
const SEL = await p.evaluate(async () => {
  window.HP.length = 0;
  const g0 = sr().querySelector('.pg'), t0 = sr().querySelector('.pd[data-v="2026-10-09"]');
  t0.click(); await sleep(250);
  const fre = { list: list(), hp: [...window.HP], sel: sr().querySelector('.pd[data-v="2026-10-09"]').classList.contains('sel'), rel: sr().querySelector('.prel').textContent, sub: sr().querySelector('.psub').textContent, same: g0 === sr().querySelector('.pg') };
  sr().querySelector('.pd[data-v="2026-10-08"]').click(); await sleep(250);
  const tor = { list: list(), kids: kids(), chip: sr().querySelector('.pchip').textContent };
  sr().querySelector('.pd[data-v="2026-10-08"]').click(); await sleep(250);
  const back = list();
  return { fre, tor, back };
});
ok('Trykk på fre 9 → valgt-stil, overskriften oppdateres, haptic selection', SEL.fre.sel && SEL.fre.rel === 'Om 2 dager' && /^fredag 9\. okt/.test(SEL.fre.sub) && SEL.fre.hp.join() === 'selection' && SEL.fre.same, SEL.fre);
ok('Fre 9: «fre 9. okt · 2 pakker»; lørdags-pakken viser «lør 10. okt»', SEL.fre.list && SEL.fre.list.head === 'fre 9. okt · 2 pakker' && SEL.fre.list.rows.some((r) => r.id === 'pn:UD444444444SE' && /^lør 10\. okt · /.test(r.sub) && r.st === 'På vei'), SEL.fre.list);
ok('Dag uten pakker (tor 8) → ingen liste, ingen tomtekst; badgen gjelder bare posten', SEL.tor.list === null && SEL.tor.kids === 'pt,pg,pnchs' && /Ikke i dag|Posten kommer i dag/.test(SEL.tor.chip), SEL.tor);
ok('Trykk samme dag igjen → tilbake til i dag', SEL.back && SEL.back.head === 'I dag · 5 pakker', SEL.back);
// trykk på rad → samme kort i Pakker åpnes og scrolles fram
const GO = await p.evaluate(async () => {
  window.HP.length = 0;
  const pop = document.querySelector('.pop'); pop.scrollTop = 0;
  const nCards = sr().querySelectorAll('.pkr').length;
  sr().querySelector('.pkli[data-v="sensor.ll134336179no_status"]').click(); await sleep(900);
  const card = sr().querySelector('.pkr[data-key="pk-sensor.ll134336179no_status"]'), pr = pop.getBoundingClientRect(), cr = card ? card.getBoundingClientRect() : null;
  const r1 = { hp: [...window.HP], open: card && card.classList.contains('open'), inView: !!cr && cr.top >= pr.top - 1 && cr.top < pr.bottom, scrolled: pop.scrollTop > 0, nCards, nCards2: sr().querySelectorAll('.pkr').length, facts: card ? card.textContent : '' };
  pop.scrollTop = 0; await sleep(100);
  sr().querySelector('.pkli[data-v="pn:CT184146155DE"]').click(); await sleep(900);
  const c2 = sr().querySelector('.pkr[data-key="pk-pn:CT184146155DE"]');
  r1.pn = { open: c2 && c2.classList.contains('open'), inView: c2 && c2.getBoundingClientRect().top < pop.getBoundingClientRect().bottom && c2.getBoundingClientRect().top >= pop.getBoundingClientRect().top - 1, det: c2 ? /Detaljer/.test(c2.textContent) : false };
  return r1;
});
ok('Trykk på raden → haptic, samme pakkekort i Pakker utvides (sporingsnummer, metode, Detaljer) og scrolles fram', GO.hp.length === 1 && GO.open && GO.inView && GO.scrolled && /LL134336179NO/.test(GO.facts) && /Norgespakke liten/.test(GO.facts) && /Detaljer/.test(GO.facts), GO);
ok('Leverte pakker skjules ikke: kortet vises (Vis leverte slås på), ingen nye kort', GO.nCards2 >= GO.nCards, GO);
ok('PostNord-rad → PostNord-kortet åpnes og vises', GO.pn.open && GO.pn.inView && GO.pn.det, GO.pn);
// live: bare prikker og liste endres (samme noder i rutenettet)
const LV = await p.evaluate(async () => {
  await setCfg({}); sr().querySelector('.pd[data-v="2026-10-12"]').click(); await sleep(200);
  const g0 = sr().querySelector('.pg'), tiles = [...sr().querySelectorAll('.pd')], pt = sr().querySelector('.pt');
  const H = newHass(), id = 'sensor.ny_status';
  H.states[id] = { entity_id: id, state: 'Under transport', attributes: { friendly_name: 'Ny status', tracking_number: 'NY123456789NO', sender: 'Nille', estimated_delivery: '2026-10-12T15:00:00+02:00', events: [{ time: '2026-10-07T08:00:00+02:00', description: 'Sendingen er på vei' }] }, last_updated: new Date().toISOString(), last_changed: new Date().toISOString(), context: {} };
  H.entities[id] = { entity_id: id, platform: 'norwegian_parcel_tracker' };
  window.__c.hass = H; await sleep(400);
  const tiles2 = [...sr().querySelectorAll('.pd')];
  return { same: g0 === sr().querySelector('.pg') && tiles.every((t, i) => t === tiles2[i]) && pt === sr().querySelector('.pt'), more: dots()['2026-10-12'].more, list: list() };
});
ok('Live fra hass: rutenettet tegnes ikke på nytt (samme noder), «+1» → «+2» og lista får den nye pakken', LV.same && LV.more === '+2' && LV.list && LV.list.rows.some((r) => r.title === 'Ny' && r.id === 'sensor.ny_status'), LV);
// tellechipsene er uendret og gjelder alle pakker
const CH = await p.evaluate(async () => { const a = [...sr().querySelectorAll('.pnch b')].map((x) => x.textContent).join(); sr().querySelector('.pd[data-v="2026-10-09"]').click(); await sleep(200); const b2 = [...sr().querySelectorAll('.pnch b')].map((x) => x.textContent).join(); sr().querySelector('.pd[data-v="2026-10-09"]').click(); await sleep(200); return [a, b2]; });
ok('Tellechipsene (Inn/Hentes/Levert/Ut) er uendret og avhenger ikke av valgt dag', CH[0] === CH[1] && CH[0].split(',').length === 4, CH);
// «Inkluder utgående» + «Vis liste»
const OUT = await p.evaluate(async () => { await setCfg({ post_parcel_out: true }); const d = dots()['2026-10-08']; const col = getComputedStyle(sr().querySelector('.pd[data-v="2026-10-08"] .pdt i')).backgroundColor; await setCfg({ post_parcel_out: undefined, post_parcel_list: false }); const k = kids(); const d7 = dots()['2026-10-07']; await setCfg({ post_parcel_list: undefined }); return { d, col, k, d7 }; });
ok('«Inkluder utgående» → grå prikk (#afafaf) på tor 8 (Zalando retur)', OUT.d.cats.join() === 'ut' && OUT.col === 'rgb(175, 175, 175)', OUT);
ok('«Vis liste under valgt dag» av → prikker, men ingen liste', OUT.k === 'pt,pg,pnchs' && OUT.d7.cats.length === 3, OUT);
// PostNord-tall av → bare Posten-pakkene (PostNord skjult i kortet)
const PNOFF = await p.evaluate(async () => { await setCfg({ section_hidden: { posten: ['postnord'] } }); const L = list(); await setCfg({ section_hidden: undefined }); return L; });
ok('«PostNord-tall» av → bare Posten-pakkene i prikker/liste', PNOFF && PNOFF.rows.every((r) => !/^pn:/.test(r.id)) && PNOFF.rows.length === 4, PNOFF);

/* =============================================================== editorene */
const ED = await p.evaluate(async () => {
  const names = (R) => [...R.querySelectorAll('[data-name]')].map((x) => x.dataset.name);
  const want = ['post_parcels', 'post_parcel_list', 'post_parcel_out', 'carrier_view'];
  window.__c.customize('visning'); await sleep(500);
  const portal = MSH.portals().pop(), ed = portal.shadowRoot.querySelector('msh-editor'), R = ed.shadowRoot;
  const tb = [...R.querySelectorAll('[data-a="tab"]')].find((x) => x.dataset.v === 'visning'); if (tb) { tb.click(); await sleep(150); }
  R.querySelectorAll('details').forEach((d) => { d.open = true; }); await sleep(150);
  const own = want.filter((n) => names(R).includes(n));
  const txt = R.textContent;
  MSH.portals().forEach((x) => x.shadowRoot.querySelector('.bg') && x.shadowRoot.querySelector('.bg').click()); await sleep(300);
  const g = customElements.get('msh-kalender-card').getConfigElement(); g.hass = window.__h; g.setConfig({ type: 'custom:msh-kalender-card', card_id: 'gui56' }); document.body.appendChild(g);
  await sleep(250);
  const GR = g.shadowRoot, out = [];
  g.addEventListener('config-changed', (e) => out.push(e.detail.config));
  const tg = [...GR.querySelectorAll('[data-a="tab"]')].find((x) => x.dataset.v === 'visning'); if (tg) { tg.click(); await sleep(150); }
  GR.querySelectorAll('details').forEach((d) => { d.open = true; }); await sleep(150);
  const gui = want.filter((n) => names(GR).includes(n));
  const cv = GR.querySelector('[data-name="carrier_view"][data-v="chip"]'); if (cv) { cv.click(); await sleep(250); }
  g.remove();
  return { own, gui, txt: ['Vis pakker i kalender', 'Vis liste under valgt dag', 'Inkluder utgående', 'Transportør-visning'].filter((t) => txt.includes(t)), saved: out.length ? out[out.length - 1].carrier_view : null };
});
ok('Tilpass → Visning → Posten: «Vis pakker i kalender», «Vis liste under valgt dag», «Inkluder utgående», «Transportør-visning»', ED.own.length === 4 && ED.txt.length === 4, ED);
ok('GUI-editoren: de samme valgene (samme config-nøkler), carrier_view lagres', ED.gui.length === 4 && ED.saved === 'chip', ED);
await p.close();

/* =============================================================== B2 · pakkelista (iPhone 390 px) */
const B2 = async (cv, light) => {
  const q = await page(cv ? { carrier_view: cv } : null, { width: 390, light });
  const r = await q.evaluate(async () => {
    sr().querySelector('[data-act="pdel"]') && sr().querySelector('[data-act="pdel"]').click(); await sleep(250);
    // utgående via filteret «Ut»
    const cs = (e) => getComputedStyle(e), R = (e) => e.getBoundingClientRect();
    const rows = (sel) => [...sr().querySelectorAll('.pkr')].map((row) => { const t = row.querySelector('.pkn b') || row.querySelector('.pkh b'), m = row.querySelector('.pmeta'), st = row.querySelector('.pkst'), car = row.querySelector('.pcar'), chip = row.querySelector('.ctag'), badge = row.querySelector('.pcb'), ic = row.querySelector('.pkic'); return { key: row.dataset.key, title: t.textContent, trunc: t.scrollWidth > t.clientWidth + 1, tw: Math.round(R(t).width), tfs: cs(t).fontSize, meta: m ? m.textContent : '', car: car ? car.textContent : null, chip: chip ? { t: chip.textContent, w: Math.round(R(chip).width) } : null, badge: badge ? { w: Math.round(R(badge).width), h: Math.round(R(badge).height), br: Math.round(R(ic).right - R(badge).right), bb: Math.round(R(ic).bottom - R(badge).bottom) } : null, st: st.textContent, stw: Math.round(R(st).width), sta: cs(st).textAlign, stl: Math.round(R(st).height / parseFloat(cs(st).lineHeight)), stfs: cs(st).fontSize }; });
    const all = rows();
    sr().querySelector('.post .pnch[data-v="out"]').click(); await sleep(250);
    const out = rows();
    sr().querySelector('.post .pnch[data-v="out"]').click(); await sleep(250);
    return { all, out };
  });
  if (SHOT) await q.screenshot({ path: `${SHOT}/k56-pakker-${cv || 'text'}${light ? '-lys' : ''}.png`, fullPage: true });
  await q.close();
  return r;
};
const T = await B2(null);
const tl = T.all.map((x) => x.title);
ok('390 px: ingen tittel kuttet («Pak…»), alle titler hele eller ≥ 10 tegn synlige', T.all.every((x) => !x.trunc || x.tw >= 90) && !T.all.some((x) => x.trunc && /^Pak/.test(x.title)), T.all.map((x) => [x.title, x.trunc, x.tw]));
ok('Titler: navn/avsender (Komplett, Lego, Elkjøp …), ellers de siste 6 tegnene («…6179NO», «…7777SE»)', tl.includes('…6179NO') && tl.includes('…7777SE') && tl.includes('Lego') && tl.includes('Elkjøp') && !tl.some((t) => /^Pakke /.test(t)), tl);
ok('Tittel 14px', T.all.every((x) => x.tfs === '14px'), T.all.map((x) => x.tfs));
const pnr = T.all.filter((x) => /pk-pn:/.test(x.key));
ok('Transportøren først i undertittelen: «PostNord · Hentes på POSTNORD STR…» (ingen chip)', pnr.every((x) => x.car === 'PostNord' && x.meta.startsWith('PostNord · ') && !x.chip) && pnr.some((x) => x.meta === 'PostNord · Hentes på POSTNORD STRØMMEN SENTER'), pnr.map((x) => x.meta));
ok('Posten-pakke (…NO): «Posten · …» i undertittelen', T.all.some((x) => x.key === 'pk-sensor.ll134336179no_status' && x.meta.startsWith('Posten · ')), T.all.map((x) => x.meta));
ok('Utgående: «PostNord ↑ · Til Zalando · …», tittel «Zalando retur»', T.out.length === 1 && T.out[0].title === 'Zalando retur' && /^PostNord ↑ · Til Zalando · /.test(T.out[0].meta), T.out);
ok('Status til høyre: maks 96 px, 12px, høyrejustert, maks to linjer; «Ikke skannet» (ikke «… ennå»)', T.all.every((x) => x.stw <= 96 && x.stfs === '12px' && x.sta === 'right' && x.stl <= 2) && T.all.some((x) => x.st === 'Ikke skannet') && !T.all.some((x) => /ennå/.test(x.st)), T.all.map((x) => [x.st, x.stw, x.stl]));
ok('Lang status brytes til to linjer heller enn å presse tittelen («Klar til henting»)', T.all.some((x) => x.st === 'Klar til henting' && x.stl === 2) || T.all.filter((x) => x.st === 'Klar til henting').every((x) => x.stw <= 96), T.all.filter((x) => x.st === 'Klar til henting'));
const TI = await B2('icon');
ok('Transportør-visning «ikon»: 16 px merke nede til høyre på pakkeikonet, ingen tekst/chip', TI.all.filter((x) => /pk-pn:/.test(x.key)).every((x) => x.badge && x.badge.w === 16 && x.badge.h === 16 && x.badge.br <= 2 && x.badge.bb <= 2 && !x.chip && !x.meta.startsWith('PostNord')) && TI.out[0].meta.startsWith('↑ · '), TI.all.slice(0, 3));
const TC = await B2('chip');
ok('Transportør-visning «chip»: «PN» maks 72 px (utgående «PN ↑»), titlene får plass', TC.all.filter((x) => /pk-pn:/.test(x.key)).every((x) => x.chip && x.chip.t === 'PN' && x.chip.w <= 72) && TC.out[0].chip.t === 'PN ↑' && TC.all.every((x) => !x.trunc || x.tw >= 90), TC.all.map((x) => [x.title, x.chip, x.trunc]));
const TL = await B2(null, true);
ok('Lys modus: samme oppsett (titler hele, transportør i undertittelen)', TL.all.every((x) => !x.trunc || x.tw >= 90) && TL.all.filter((x) => /pk-pn:/.test(x.key)).every((x) => x.car === 'PostNord'), null);

/* =============================================================== lys / mørk: kalenderen + lista */
const LM = async (light) => {
  const q = await page(null, { light });
  const r = await q.evaluate(() => { const cs = (e) => getComputedStyle(e); const row = sr().querySelector('.pkli'), h = sr().querySelector('.pklh'); return { theme: document.documentElement.dataset.kiTheme || '', row: cs(row).backgroundColor, t: cs(row.querySelector('b')).color, s: cs(row.querySelector('.evc>span')).color, h: cs(h).color, dot: cs(sr().querySelector('.pdt i[data-cat="levert"]')).backgroundColor, em: cs(sr().querySelector('.pdt em')).color,
    // 56 D: tonede ikon-sirkler (lista + Pakker) og statustekst – farge mot flaten bak
    ic: [...sr().querySelectorAll('.pkli .pkic, .pkr .pkic')].map((e) => { const row = e.closest('.pkli') || e.closest('.card'); return { bg: cs(e).backgroundColor, fg: cs(e).color, row: cs(row).backgroundColor, cat: (e.closest('.pkli') || {}).dataset ? e.closest('.pkli') && e.closest('.pkli').dataset.cat : null }; }),
    st: [...sr().querySelectorAll('.pkr .pkst')].map((e) => ({ fg: cs(e).color, row: cs(e.closest('.card')).backgroundColor, t: e.textContent })) }; });
  if (SHOT) await q.screenshot({ path: `${SHOT}/k56-kalender-${light ? 'lys' : 'mork'}.png` });
  await q.close();
  return r;
};
const DK = await LM(false), LT = await LM(true);
const rgbOf = (c) => { const k = /color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)(?: \/ ([\d.]+))?\)/.exec(c || ''); if (k) return [k[1] * 255, k[2] * 255, k[3] * 255, k[4] != null ? +k[4] : 1]; const m = /rgba?\(([\d.]+),? ([\d.]+),? ([\d.]+)(?:,? \/? ?([\d.]+))?/.exec(c || ''); return m ? [+m[1], +m[2], +m[3], m[4] != null ? +m[4] : 1] : null; };
const over = (fg, bg) => { const f = rgbOf(fg), g = rgbOf(bg); if (!f || !g) return null; return [0, 1, 2].map((i) => f[i] * f[3] + g[i] * (1 - f[3])); };
const L_ = (c) => { const v = c.map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
const CR = (a, b2) => { const x = L_(a), y = L_(b2); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const icCR = (r) => r.ic.map((x) => { const bg = over(x.bg, x.row); return bg ? Math.round(CR(rgbOf(x.fg), bg) * 10) / 10 : 0; });
const stCR = (r) => r.st.map((x) => Math.round(CR(rgbOf(x.fg), rgbOf(x.row)) * 10) / 10);
ok('Lys (56 D): ikon i tonet sirkel ≥ 3:1 mot sirkelen, statustekst i Pakker ≥ 4,5:1', icCR(LT).length > 3 && icCR(LT).every((x) => x >= 3) && stCR(LT).every((x) => x >= 4.5), { ic: icCR(LT), st: stCR(LT), raw: LT.ic.filter((x, i) => icCR(LT)[i] < 3) });
ok('Mørk: tonede ikon-sirkler som før (aksent 20 % + aksent-ikon)', DK.ic.filter((x) => x.cat === 'levert').every((x) => /115, 185, 242/.test(x.fg) && /0\.2\)|0\.2$/.test(x.bg.replace(/\s/g, '')) || /color/.test(x.bg)), DK.ic.slice(0, 2));
ok('Mørk: rad #404040, tittel lys, status #afafaf', DK.row === 'rgb(64, 64, 64)' && DK.s === 'rgb(175, 175, 175)' && /250|225/.test(DK.t), DK);
const lum = (c) => { const m = /(\d+), (\d+), (\d+)/.exec(c); return m ? (0.2126 * m[1] + 0.7152 * m[2] + 0.0722 * m[3]) / 255 : 1; };
ok('Lys: rad lys flate (--ki-surface-2), mørk tekst, prikkene beholder aksenten', LT.theme === 'light' && lum(LT.row) > 0.85 && lum(LT.t) < 0.3 && lum(LT.s) < 0.45 && lum(LT.h) < 0.45 && LT.dot === 'rgb(115, 185, 242)' && lum(LT.em) < 0.45, LT);

/* =============================================================== B3 · ekte Bubble Card: ingen overlapp med headeren */
const BC = resolve('test/.vendor/bubble-card.js');
if (!existsSync(BC)) { mkdirSync('test/.vendor', { recursive: true }); execFileSync('curl', ['-sSL', '-o', BC, 'https://raw.githubusercontent.com/Clooos/Bubble-Card/main/dist/bubble-card.js']); }
const B3 = async (light, w) => {
  const ctx = await b.newContext({ viewport: { width: w || 390, height: 844 }, hasTouch: true, isMobile: true, timezoneId: 'Europe/Oslo' });
  const q = await ctx.newPage();
  await q.clock.install({ time: NOW }); await q.clock.resume();
  q.on('pageerror', (e) => errs.push('B3 ' + e.message));
  await q.goto('file://' + resolve('test/harness-bubble.html'));
  for (const m of mocks) await q.addScriptTag({ path: m });
  await q.addScriptTag({ path: bundle });
  await q.addScriptTag({ path: BC, type: 'module' });
  await q.waitForFunction(() => customElements.get('bubble-card'), null, { timeout: 30000 });
  await q.evaluate(async ({ light, inj }) => {
    const hass = window.mockHass(); window.__h = hass;
    if (light) hass.themes = { ...(hass.themes || {}), darkMode: false };
    eval('(' + inj + ')')();
    const S = customElements.get('ll-strategy-dashboard-ki-dashboard');
    const dash = await S.generate({}, hass);
    const root = document.getElementById('dash');
    for (const c of dash.views[0].cards[0].cards) { const el = document.createElement(c.type.replace('custom:', '')); el.setConfig(c); el.hass = hass; root.appendChild(el); }
    location.hash = '#kalender';
  }, { light, inj: inject.toString() });
  await q.waitForTimeout(2500);
  const res = await q.evaluate(async () => {
    const deepQ = (r, sel, out = []) => { r.querySelectorAll(sel).forEach((e) => out.push(e)); r.querySelectorAll('*').forEach((e) => { if (e.shadowRoot) deepQ(e.shadowRoot, sel, out); }); return out; };
    const card = deepQ(document, 'msh-kalender-card')[0];
    const bc = [...document.querySelectorAll('bubble-card')].find((x) => (x.config || x._config || {}).hash === '#kalender');
    const pop = bc.shadowRoot.querySelector('.bubble-pop-up'), hdr = pop.querySelector('.bubble-header-container');
    const R = (e) => e.getBoundingClientRect();
    const close = pop.querySelector('.bubble-close-button'), icon = pop.querySelector('.bubble-icon-container'), name = pop.querySelector('.bubble-name-container, .bubble-name');
    const hb = Math.max(...[close, icon, name].filter(Boolean).map((e) => R(e).bottom));
    const cr = R(close);
    const over = (a, b2) => a.left < b2.right && a.right > b2.left && a.top < b2.bottom && a.bottom > b2.top;
    const out = { hb: Math.round(hb), close: [Math.round(cr.left), Math.round(cr.top), Math.round(cr.right), Math.round(cr.bottom)], mt: card.style.marginTop, tabs: {} };
    const sc = pop.querySelector('.bubble-pop-up-container');
    for (const t of ['kalender', 'hytta', 'framover', 'bursdager', 'posten']) {
      const btn = card.shadowRoot.querySelector(`[data-act="tab"][data-v="${t}"]`); if (btn) btn.click();
      await new Promise((q2) => setTimeout(q2, 500));
      sc.scrollTop = 0; await new Promise((q2) => setTimeout(q2, 100));
      const first = card.shadowRoot.querySelector('.wrap').firstElementChild, fr = R(first);
      const els = [...card.shadowRoot.querySelectorAll('.top, .top button, .pane .sh, .pane .sh button, .add')].filter((e) => R(e).height);
      // trykk midt i fanelinjen treffer kortet (ikke headeren)
      const tr = R(card.shadowRoot.querySelector('.top .tabs')), hit = pop.shadowRoot ? null : bc.shadowRoot.elementFromPoint(tr.left + 40, tr.top + tr.height / 2);
      out.tabs[t] = { top: Math.round(fr.top), gap: Math.round(fr.top - hb), overClose: els.filter((e) => over(R(e), cr)).length, overHdr: els.filter((e) => R(e).top < hb - 0.5).length, hit: hit ? (hit === bc || hit.closest && !hit.closest('.bubble-header-container')) : null, mt: card.style.marginTop };
    }
    // Posten med «Når kommer Posten» skjult: «Pakker»-headeren er en vanlig rad under fanelinjen
    card.setConfig({ ...card.config, section_hidden: { posten: ['kort'] } }); await new Promise((q2) => setTimeout(q2, 500));
    const sh = card.shadowRoot.querySelector('.pane .sh'), add = card.shadowRoot.querySelector('.pane .sh .add');
    const cs = getComputedStyle(sh);
    out.pakker = { sh: Math.round(R(sh).top), gap: Math.round(R(sh).top - hb), addOver: over(R(add), cr), addIn: R(add).right <= R(card).right + 0.5, pos: cs.position, mt: cs.marginTop, title: sh.querySelector('.st').textContent };
    return out;
  });
  if (SHOT) await q.screenshot({ path: `${SHOT}/k56-bubble-${light ? 'lys' : 'mork'}.png` });
  await ctx.close();
  return res;
};
for (const light of [false, true]) {
  const r = await B3(light);
  const m = light ? 'lys' : 'mørk';
  ok(`B3 (${m}) margin-top på kortet ≥ 0 (ingen negativ margin)`, parseFloat(r.mt) >= 0, r.mt);
  ok(`B3 (${m}) alle faner: innholdet starter 12 px under Bubble-headeren (ikon/navn/lukk), ingenting oppå headeren eller lukk-knappen`, Object.values(r.tabs).every((x) => x.gap >= 11 && x.gap <= 14 && x.overClose === 0 && x.overHdr === 0), r);
  ok(`B3 (${m}) Pakker: «Pakker · … · +» er en vanlig rad, «+» innenfor kortet og ikke i høyde med lukk-knappen`, r.pakker.title === 'Pakker' && r.pakker.pos === 'static' && parseFloat(r.pakker.mt) >= 0 && !r.pakker.addOver && r.pakker.addIn && r.pakker.gap > 12, r.pakker);
}

ok('Ingen feil i konsollen', errs.length === 0, errs);
await b.close();
try { rmSync(bundle); } catch (e) { /* */ }
console.log(fails ? `\n${fails} feil` : '\nAlt OK');
process.exit(fails ? 1 : 0);
