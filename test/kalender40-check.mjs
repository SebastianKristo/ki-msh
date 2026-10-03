// Fiks 40 · PostNord i Kalender → Posten → Pakker (msh-kalender-card), side om side med Norwegian Parcel Tracker.
//   40.1 autodetektering via registeret (platform postnord), kontoer slås sammen, «Velg entitet» uten integrasjonen,
//        src.postnord + «Vis pakker jeg sender» (postnord_outgoing) i begge editorene
//   40.2 statusmapping (farge/ikon/tekst), raw_status som hendelse når history mangler
//   40.3 bærer-chip «PostNord», meta-linje, fakta (2 kolonner), «Åpne i PostNord», sortering
//   40.4 «+» → postnord.track_parcel / eksisterende tracker / «Sett opp PostNord …», untrack (ikke konto), haptic
//   40.5 subscribeEvents bare mens popupen er åpen, raden oppdateres alene, «Oppdater», blå prikk i «Når kommer Posten»
//   Uten PostNord: som før, ingen feil.
// PostNord-entitetene injiseres bare her (ikke i test/mock/*).        node test/kalender40-check.mjs
import { createRequire } from 'node:module';
import { readdirSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
mkdirSync('test/.build', { recursive: true });
const bundle = resolve(`test/.build/kalender40-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
let fails = 0;
const ok = (name, cond, info) => { if (!cond) fails++; console.log(`${cond ? '✔' : '✘'} ${name}${info != null && !cond ? ' · ' + JSON.stringify(info).slice(0, 900) : ''}`); };
const mocks = readdirSync('test/mock').filter((f) => f.endsWith('.js')).sort().map((m) => resolve('test/mock/' + m));
const errs = [];

async function page(pn, cfg) {
  const p = await b.newPage({ viewport: { width: 400, height: 900 }, hasTouch: true });
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await p.goto('file://' + resolve('test/harness.html'));
  for (const m of mocks) await p.addScriptTag({ path: m });
  await p.addScriptTag({ path: bundle });
  await p.evaluate(async ({ pn, cfg }) => {
    const H = window.__h = window.mockHass();
    window.HP = []; window.addEventListener('haptic', (e) => window.HP.push(e.detail));
    window.SUBS = []; window.UNSUBS = [];
    if (pn) {
      const d0 = (n, h, m) => { const d = new Date(); d.setHours(h || 0, m || 0, 0, 0); d.setDate(d.getDate() + n); return d; };
      const key = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const add = (id, state, attrs) => { H.states[id] = { entity_id: id, state: String(state), attributes: { friendly_name: id, ...attrs }, last_updated: new Date(Date.now() - 60000).toISOString(), last_changed: new Date(Date.now() - 60000).toISOString(), context: {} }; H.entities[id] = { entity_id: id, platform: 'postnord', config_entry_id: id.includes('konto') ? 'pn_konto' : 'pn_hub' }; };
      const P = (code, status, extra) => ({ carrier: 'PostNord', barcode: code, status, raw_status: null, sender: null, weight: null, url: `https://tracking.postnord.com/en/tracking?id=${code}`, history: null, ...extra });
      window.PN = {
        P1: P('UA123456789SE', 'out_for_delivery', { sender: 'Zalando', weight: 1.25, delivery_method: 'Hjemlevering', planned_from: d0(0, 14).toISOString(), planned_to: d0(0, 18).toISOString(), raw_status: 'Out for delivery' }),
        P2: P('UB223456789SE', 'at_pickup_point', { sender: 'H&M', pickup_point: 'Coop Prix Grünerløkka', raw_status: 'Ready for pickup', history: [{ timestamp: d0(0, 8).toISOString(), status: 'at_pickup_point', raw_status: 'The shipment is ready for pickup' }, { timestamp: d0(-1, 9).toISOString(), status: 'in_transit', raw_status: 'The shipment has arrived at the terminal' }] }),
        P3: P('UC323456789SE', 'problem', { sender: 'Boozt', raw_status: 'Address missing' }),
        P4: P('UD423456789SE', 'unknown', { raw_status: 'Not yet scanned' }),
        P5: P('UE523456789SE', 'delivered', { sender: 'Clas Ohlson', delivered: true, delivered_at: d0(-1, 12, 4).toISOString(), raw_status: 'Delivered' }),
        P6: P('70712345678DK', 'in_transit', { sender: 'Lego', raw_status: 'In transit', planned_from: d0(2).toISOString() }),
        P7: P('00370712345678', 'registered', { sender: 'Apotek 1', raw_status: 'Pre-advised' }),
        P8: P('UF823456789SE', 'in_transit', { receiver: 'Mormor', raw_status: 'In transit' }),
      };
      add('sensor.postnord_incoming_parcels', 4, { parcels: [PN.P1, PN.P2, PN.P3, PN.P4] });
      add('sensor.postnord_awaiting_pickup', 1, { parcels: [PN.P2] });
      add('sensor.postnord_delivered_parcels', 1, { parcels: [PN.P5] });
      add('sensor.postnord_next_delivery', d0(0, 14).toISOString(), {});
      add('sensor.postnord_konto_incoming_parcels', 2, { parcels: [PN.P6, PN.P7] });
      add('sensor.postnord_konto_outgoing_parcels', 1, { parcels: [PN.P8] });
      add('button.postnord_refresh', 'unknown', {});
      add('calendar.postnord_deliveries', 'off', {});
      H.services = { ...H.services, postnord: { track_parcel: {}, untrack_parcel: {} } };
      // en hverdag i rutenettet (tredje hverdag fra i dag)
      let d = d0(0), n = 0; while (true) { if (d.getDay() % 6 !== 0) { n++; if (n === 3) break; } d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1); }
      window.PNDAY = key(d);
      const api = H.callApi;
      H.callApi = (method, path) => {
        if (/^calendars\/calendar\.postnord_deliveries\?/.test(path)) { window.__calls.push(['api', method, path]); return Promise.resolve([{ summary: 'Lego', start: { dateTime: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 10).toISOString() }, end: { dateTime: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 14).toISOString() } }]); }
        return api(method, path);
      };
      H.connection = { ...H.connection, subscribeEvents: (cb, type) => { const s = { cb, type, on: true }; window.SUBS.push(s); return Promise.resolve(() => { s.on = false; window.UNSUBS.push(type); }); } };
      window.fire = (type, data) => window.SUBS.filter((s) => s.on && s.type === type).forEach((s) => s.cb({ event_type: type, data, time_fired: new Date().toISOString() }));
    }
    const bc = document.createElement('bubble-card');
    bc.setConfig({ type: 'custom:bubble-card', card_type: 'pop-up', hash: '#kalender' });
    bc.innerHTML = '<div class="pop"><div class="hdr">Kalender</div><div class="inner"></div></div>';
    document.getElementById('dash').appendChild(bc);
    location.hash = '#kalender';
    const c = document.createElement('msh-kalender-card');
    c.setConfig({ type: 'custom:msh-kalender-card', card_id: 'pop-kal40', ...(cfg || {}) });
    c.hass = H;
    bc.querySelector('.inner').appendChild(c);
    window.__c = c;
    await new Promise((q) => setTimeout(q, 600));
    c.shadowRoot.querySelector('[data-act="tab"][data-v="posten"]').click();
    await new Promise((q) => setTimeout(q, 500));
    window.sr = () => window.__c.shadowRoot;
    window.rows = () => [...sr().querySelectorAll('.pkr')].map((r) => ({ key: r.dataset.key, pn: r.classList.contains('pn'), kind: r.dataset.kind || null, text: r.querySelector('.pkh').textContent.replace(/\s+/g, ' ').trim(), st: r.querySelector('.pkst') && r.querySelector('.pkst').getAttribute('style'), meta: (r.querySelector('.pmeta') || {}).textContent || '', chip: r.querySelector('.ctag') ? [r.querySelector('.ctag').textContent, getComputedStyle(r.querySelector('.ctag')).color, getComputedStyle(r.querySelector('.ctag')).backgroundColor] : null }));
    window.sleep = (ms) => new Promise((q) => setTimeout(q, ms));
    window.setCfg = async (patch) => { const cfg2 = { ...window.__c.config, ...patch }; window.__c.setConfig(cfg2); await sleep(300); };
  }, { pn, cfg });
  return p;
}

// ================================================================ uten PostNord: som før
{
  const p = await page(false);
  const A = await p.evaluate(() => ({ rows: rows(), refresh: !!sr().querySelector('[data-act="prefresh"]'), dots: sr().querySelectorAll('.pnd').length, chip: sr().querySelectorAll('.ctag').length, src: MSH.kalenderSources(window.__h, {}).postnord, hdr: [...sr().querySelectorAll('.sh .st')].map((e) => e.textContent), post: !!sr().querySelector('.card.post .pg') }));
  ok('Uten PostNord: Pakker som før (3 aktive Norwegian-pakker, ingen chip/Oppdater/prikk)', A.rows.length === 3 && A.rows.every((r) => !r.pn) && !A.refresh && !A.dots && !A.chip && A.hdr.join('|') === 'Pakker' && A.post, A);
  ok('Uten PostNord: kilden postnord = null (ingen gjetting)', A.src === null, A.src);
  // «+» med PostNord-lignende kode uten PostNord → eksisterende tracker som før
  const B = await p.evaluate(async () => { window.__calls.length = 0; sr().querySelector('[data-act="padd"]').click(); await sleep(150); const i = sr().querySelector('input[data-input="pnum"]'); i.value = 'UA999999999SE'; i.dispatchEvent(new Event('input', { bubbles: true, composed: true })); sr().querySelector('[data-act="psave"]').click(); await sleep(200); return { calls: window.__calls.filter((c) => c[0] !== 'ws' && c[0] !== 'api'), msg: !!sr().querySelector('.pmsg') }; });
  ok('Uten PostNord: «+» går til Norwegian Parcel Tracker, ingen PostNord-melding', B.calls.some((c) => c[0] === 'norwegian_parcel_tracker' && c[2].tracking_number === 'UA999999999SE') && !B.calls.some((c) => c[0] === 'postnord') && !B.msg, B);
  // GUI-editor + Tilpass: PostNord-kilde med «Velg entitet»
  const G = await p.evaluate(async () => {
    const ed = customElements.get('msh-kalender-card').getConfigElement(); ed.hass = window.__h; ed.setConfig({ type: 'custom:msh-kalender-card', card_id: 'gui40' }); document.body.appendChild(ed);
    await sleep(150);
    const R = ed.shadowRoot;
    [...R.querySelectorAll('[data-a="tab"]')].find((t) => t.dataset.v === 'kilder').click(); await sleep(120);
    const sel = [...R.querySelectorAll('ha-selector')].map((s) => s.dataset.name), helper = (R.querySelector('ha-selector[data-name="src.postnord"]') || { dataset: {} }).dataset.helper;
    const out = !!R.querySelector('[data-name="postnord_outgoing"]') || [...R.querySelectorAll('ha-selector,ha-switch,input,button')].some((x) => (x.dataset && x.dataset.name) === 'postnord_outgoing');
    const txt = R.textContent;
    ed.remove();
    return { sel, helper, out, has: /Vis pakker jeg sender/.test(txt) };
  });
  ok('GUI-editor: Kilder har src.postnord (fant ingen) + «Vis pakker jeg sender»', G.sel.includes('src.postnord') && /fant ingen/.test(G.helper || '') && G.has, G);
  await p.close();
}

// ================================================================ med PostNord
const p = await page(true);
// 40.1 autodetektering
const S = await p.evaluate(() => ({ src: MSH.kalenderSources(window.__h, {}).postnord, cands: MSH.kalender.cands(window.__h, 'postnord'), parcel: MSH.kalenderSources(window.__h, {}).parcel }));
ok('40.1 Auto = sensor.postnord_incoming_parcels (registeret, hub før konto)', S.src === 'sensor.postnord_incoming_parcels' && S.cands.join() === 'sensor.postnord_incoming_parcels,sensor.postnord_konto_incoming_parcels', S);
ok('40.1 Pakkesporing (Norwegian) tar ikke PostNord-sensorene', S.parcel && !/postnord/.test(S.parcel), S);
const R1 = await p.evaluate(() => rows());
const pn = R1.filter((r) => r.pn);
ok('40.1 Kontoer slått sammen, duplikat (awaiting_pickup) én gang, utgående skjult, levert skjult', pn.length === 6 && new Set(pn.map((r) => r.key)).size === 6 && pn.some((r) => r.key === 'pk-pn:70712345678DK') && !pn.some((r) => r.key === 'pk-pn:UF823456789SE') && !pn.some((r) => r.key === 'pk-pn:UE523456789SE'), R1);
// 40.3 sortering: ute → klar → transport → avvik → levert (også Norwegian-pakkene)
const rank = { out: 0, klar: 1, transport: 2, stale: 3, levert: 4 };
const nk = await p.evaluate(() => Object.fromEntries(MSH.kalender.parcelsOf(window.__h, window.__c.config).map((x) => ['pk-' + x.id, x.kind])));
const kinds = R1.map((r) => r.kind || nk[r.key]);
ok('40.3 Sortering ute for levering → klar → under transport → avvik', R1[0].key === 'pk-pn:UA123456789SE' && kinds.every((k, i) => !i || rank[kinds[i - 1]] <= rank[k]), kinds);
// 40.2 statusmapping
const by = Object.fromEntries(pn.map((r) => [r.key.slice(6), r]));
const has = (r, lab, col) => r && r.text.includes(lab) && r.st.includes(col);
ok('40.2 out_for_delivery → gul «Ute for levering»', has(by.UA123456789SE, 'Ute for levering', '--yellow'), by.UA123456789SE);
ok('40.2 at_pickup_point → grønn «Klar til henting»', has(by.UB223456789SE, 'Klar til henting', '--green'), by.UB223456789SE);
ok('40.2 problem → rød «Avvik»', has(by.UC323456789SE, 'Avvik', '--red'), by.UC323456789SE);
ok('40.2 unknown → grå «Ikke skannet ennå»', has(by.UD423456789SE, 'Ikke skannet ennå', '--ki-text-3'), by.UD423456789SE);
ok('40.2 in_transit → blå «Under transport», registered → blå «Registrert»', has(by['70712345678DK'], 'Under transport', '--blue') && has(by['00370712345678'], 'Registrert', '--blue'), [by['70712345678DK'], by['00370712345678']]);
// 40.3 chip + meta
ok('40.3 Bærer-chip «PostNord» blå på surface-2 (#404040)', pn.every((r) => r.chip && r.chip[0] === 'PostNord' && r.chip[1] === 'rgb(115, 185, 242)' && r.chip[2] === 'rgb(64, 64, 64)'), pn.map((r) => r.chip));
ok('40.3 Meta: «Estimert: I dag 14–18» og «Hentes på Coop Prix Grünerløkka»', by.UA123456789SE.meta === 'Estimert: I dag 14–18' && by.UB223456789SE.meta === 'Hentes på Coop Prix Grünerløkka', [by.UA123456789SE.meta, by.UB223456789SE.meta]);
// detaljer
const D1 = await p.evaluate(async () => {
  sr().querySelector('.pkr[data-key="pk-pn:UA123456789SE"] .pkh').click(); await sleep(200);
  const r = sr().querySelector('.pkr[data-key="pk-pn:UA123456789SE"]');
  const facts = [...r.querySelectorAll('.facts span')].map((s) => [s.querySelector('i').textContent, s.querySelector('b').textContent]);
  const a = r.querySelector('a.lnk');
  return { facts, cols: getComputedStyle(r.querySelector('.facts')).gridTemplateColumns.split(' ').length, link: a && [a.textContent.trim(), a.getAttribute('href'), a.target], un: !!r.querySelector('[data-act="pnun"]'), log: [...r.querySelectorAll('.lg b')].map((x) => x.textContent) };
});
ok('40.3 Fakta (2 kolonner): Leveringsmåte, Avsender, Vekt «1,25 kg», Sporingsnummer', D1.cols === 2 && D1.facts.map((f) => f[0]).join('|') === 'Leveringsmåte|Avsender|Vekt|Sporingsnummer' && D1.facts[2][1] === '1,25 kg' && D1.facts[3][1] === 'UA123456789SE', D1);
ok('40.3 «Åpne i PostNord» = tracking-lenken fra attributtene', D1.link && D1.link[0] === 'Åpne i PostNord' && D1.link[1] === 'https://tracking.postnord.com/en/tracking?id=UA123456789SE' && D1.link[2] === '_blank', D1.link);
ok('40.2 Uten history: raw_status vises som siste hendelse; «Slutt å spore» for hub-pakke', D1.log.join() === 'Out for delivery' && D1.un, D1);
const D2 = await p.evaluate(async () => {
  sr().querySelector('.pkr[data-key="pk-pn:UB223456789SE"] .pkh').click(); await sleep(200);
  const r2 = sr().querySelector('.pkr[data-key="pk-pn:UB223456789SE"]'), log = [...r2.querySelectorAll('.lg b')].map((x) => x.textContent);
  sr().querySelector('.pkr[data-key="pk-pn:70712345678DK"] .pkh').click(); await sleep(200);
  const r6 = sr().querySelector('.pkr[data-key="pk-pn:70712345678DK"]');
  return { log, acctUn: !!r6.querySelector('[data-act="pnun"]'), acctLink: !!r6.querySelector('a.lnk') };
});
ok('40.2 history-lista brukes (nyeste først)', D2.log.join('|') === 'The shipment is ready for pickup|The shipment has arrived at the terminal', D2.log);
ok('40.4 Konto-pakke: ingen «Slutt å spore»', !D2.acctUn && D2.acctLink, D2);
// vis leverte
const L = await p.evaluate(async () => { sr().querySelector('[data-act="pdel"]').click(); await sleep(200); const r = rows().find((x) => x.key === 'pk-pn:UE523456789SE'); const last = rows().pop(); sr().querySelector('[data-act="pdel"]').click(); await sleep(150); return { r, lastKind: last.kind || 'nw' }; });
ok('40.2 delivered → grå «Levert», «Levert i går 12:04», sist i lista', L.r && L.r.text.includes('Levert') && L.r.st.includes('--ki-text-3') && L.r.meta === 'Levert i går 12:04', L);
// «Vis pakker jeg sender»
const O = await p.evaluate(async () => { await setCfg({ postnord_outgoing: true }); const r = rows().find((x) => x.key === 'pk-pn:UF823456789SE'); await setCfg({ postnord_outgoing: undefined }); return r; });
ok('40.1 postnord_outgoing: true → utgående pakke vises («Til Mormor …»)', O && /^Til Mormor · /.test(O.meta), O);
// 40.5 Oppdater
// Fiks 42: «Oppdater» i Pakker-headeren bare når PostNord-seksjonen (med egen oppdater-knapp) er skjult
const U = await p.evaluate(async () => { await setCfg({ section_hidden: { posten: ['postnord'] } }); window.__calls.length = 0; const b = sr().querySelector('.sh [data-act="prefresh"]'); const next = b && b.nextElementSibling && b.nextElementSibling.dataset.act; b.click(); await sleep(150); const r = { next, calls: window.__calls.filter((c) => c[0] === 'button') }; await setCfg({ section_hidden: undefined }); return r; });
ok('40.5 «Oppdater» ved siden av «+» trykker button.postnord_refresh', U.next === 'padd' && U.calls.length === 1 && U.calls[0][1] === 'press' && U.calls[0][2].entity_id === 'button.postnord_refresh', U);
// 40.4 «+»
const add = (code) => p.evaluate(async (code) => {
  window.__calls.length = 0; window.HP.length = 0;
  if (!sr().querySelector('input[data-input="pnum"]')) { sr().querySelector('[data-act="padd"]').click(); await sleep(150); }
  window.HP.length = 0; // haptic fra «+» (light) teller ikke
  const i = sr().querySelector('input[data-input="pnum"]'); i.value = code; i.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  await sleep(60);
  sr().querySelector('[data-act="psave"]').click(); await sleep(250);
  return { calls: window.__calls.filter((c) => c[0] !== 'ws' && c[0] !== 'api'), hp: [...window.HP], msg: (sr().querySelector('.pmsg') || {}).textContent || '', form: !!sr().querySelector('input[data-input="pnum"]') };
}, code);
const A1 = await add('ua777777777se');
ok('40.4 «…SE» → postnord.track_parcel { tracking_code }, haptic success, skjemaet lukkes', A1.calls.length === 1 && A1.calls[0][0] === 'postnord' && A1.calls[0][1] === 'track_parcel' && A1.calls[0][2].tracking_code === 'UA777777777SE' && A1.hp.join() === 'success' && !A1.form, A1);
const A2 = await add('70730259304981234');
ok('40.4 17 sifre → PostNord', A2.calls.length === 1 && A2.calls[0][0] === 'postnord' && A2.calls[0][2].tracking_code === '70730259304981234', A2);
const A3 = await add('CS111222333NO');
ok('40.4 Annen kode → eksisterende tracker', A3.calls.length === 1 && A3.calls[0][0] === 'norwegian_parcel_tracker', A3);
await p.evaluate(() => { delete window.__h.services.postnord.track_parcel; });
const A4 = await add('UA888888888SE');
ok('40.4 Mangler track_parcel → «Sett opp PostNord (sporingskoder) i Innstillinger», haptic warning, ingen kall', A4.calls.length === 0 && A4.msg.includes('Sett opp PostNord (sporingskoder) i Innstillinger') && A4.hp.join() === 'warning', A4);
await p.evaluate(async () => { window.__h.services.postnord.track_parcel = {}; sr().querySelector('[data-act="padd"]').click(); await sleep(150); });
// untrack
const UN = await p.evaluate(async () => {
  window.__calls.length = 0; window.HP.length = 0;
  const r = sr().querySelector('.pkr[data-key="pk-pn:UA123456789SE"]');
  if (!r.classList.contains('open')) { r.querySelector('.pkh').click(); await sleep(200); }
  window.HP.length = 0;
  sr().querySelector('.pkr[data-key="pk-pn:UA123456789SE"] [data-act="pnun"]').click(); await sleep(200);
  return { calls: window.__calls.filter((c) => c[0] === 'postnord'), hp: [...window.HP] };
});
ok('40.4 «Slutt å spore» → postnord.untrack_parcel { tracking_code }, haptic success', UN.calls.length === 1 && UN.calls[0][1] === 'untrack_parcel' && UN.calls[0][2].tracking_code === 'UA123456789SE' && UN.hp.join() === 'success', UN);
// 40.5 hendelser
const EV = await p.evaluate(async () => {
  const types = window.SUBS.filter((s) => s.on).map((s) => s.type).sort();
  let renders = 0; const c = window.__c, orig = c._render.bind(c); c._render = () => { renders++; return orig(); };
  const other = sr().querySelector('.pkr[data-key="pk-pn:UC323456789SE"]'); other.__mark = 1;
  const before = sr().querySelector('.pkr[data-key="pk-pn:UD423456789SE"]');
  fire('postnord_parcel_status_changed', { ...window.PN.P4, status: 'in_transit', raw_status: 'Arrived at terminal', old_status: 'unknown', new_status: 'in_transit', device_id: 'x' });
  await sleep(120);
  const after = sr().querySelector('.pkr[data-key="pk-pn:UD423456789SE"]');
  const r1 = { renders, replaced: before !== after, text: after.querySelector('.pkh').textContent.replace(/\s+/g, ' '), otherKept: sr().querySelector('.pkr[data-key="pk-pn:UC323456789SE"]').__mark === 1 };
  fire('postnord_parcel_delivery_time_changed', { ...window.PN.P6, planned_from: null, planned_to: null, raw_status: 'In transit' });
  await sleep(120);
  fire('postnord_parcel_delivered', { ...window.PN.P2, status: 'delivered', delivered: true, delivered_at: new Date().toISOString() });
  await sleep(200);
  c._render = orig;
  return { types, r1, renders2: renders, gone: !sr().querySelector('.pkr[data-key="pk-pn:UB223456789SE"]') };
});
ok('40.5 Abonnerer på nøyaktig de tre hendelsene (+ entity_registry_updated, Fiks 42) mens popupen er åpen', EV.types.join() === 'entity_registry_updated,postnord_parcel_delivered,postnord_parcel_delivery_time_changed,postnord_parcel_status_changed', EV.types);
ok('40.5 status_changed (samme plass) → bare raden byttes, ingen ny tegning', EV.r1.renders === 0 && EV.r1.replaced && /Under transport/.test(EV.r1.text) && EV.r1.otherKept, EV.r1);
ok('40.5 delivered → lista tegnes, pakken forsvinner fra aktive', EV.renders2 >= 1 && EV.gone, EV);
// 40.5 blå prikk
const DOT = await p.evaluate(() => ({ dots: [...sr().querySelectorAll('.pd .pnd')].map((i) => i.closest('.pd').dataset.v), day: window.PNDAY, api: window.__calls.length >= 0, fetched: (window.__allApi = (window.__allApi || 0)), color: (sr().querySelector('.pnd') && getComputedStyle(sr().querySelector('.pnd')).backgroundColor) }));
ok('40.5 «Når kommer Posten»: blå prikk under PostNord-leveringsdagen', DOT.dots.length === 1 && DOT.dots[0] === DOT.day && DOT.color === 'rgb(115, 185, 242)', DOT);
// lukk → avmeld; åpne igjen → abonner
const CL = await p.evaluate(async () => {
  location.hash = ''; await sleep(400);
  const off = window.SUBS.filter((s) => s.on).length, un = [...window.UNSUBS];
  location.hash = '#kalender'; await sleep(500);
  return { off, un: un.length, on: window.SUBS.filter((s) => s.on).length };
});
ok('40.5 Lukk → avmeldt (4), åpne igjen → abonnert på nytt (4)', CL.off === 0 && CL.un === 4 && CL.on === 4, CL);
const DC = await p.evaluate(async () => { window.__c.remove(); await sleep(100); return window.SUBS.filter((s) => s.on).length; });
ok('40.5 disconnectedCallback → avmeldt', DC === 0, DC);
// editorene
const ED = await p.evaluate(async () => {
  const bc = document.querySelector('bubble-card'); const c = document.createElement('msh-kalender-card'); c.setConfig({ type: 'custom:msh-kalender-card', card_id: 'pop-kal40b' }); c.hass = window.__h; bc.querySelector('.inner').appendChild(c); window.__c = c; await sleep(400);
  c.customize('kilder'); await sleep(500);
  const portal = MSH.portals().pop(), ed = portal.shadowRoot.querySelector('msh-editor'), R = ed.shadowRoot;
  const t = [...R.querySelectorAll('[data-a="tab"]')].find((x) => x.dataset.v === 'kilder'); if (t) { t.click(); await sleep(150); }
  const head = (R.querySelector('.ksrc[data-key="ks-postnord"]') || {}).textContent || '';
  R.querySelector('.ksrc[data-key="ks-postnord"] [data-op="open"]').click(); await sleep(150);
  const sug = [...R.querySelectorAll('.ksrc[data-key="ks-postnord"] [data-op="pick"]')].map((e) => e.dataset.id);
  R.querySelector('.ksrc[data-key="ks-postnord"] [data-op="pick"][data-id="sensor.postnord_konto_incoming_parcels"]').click(); await sleep(200);
  const src = (ed._config.src || {}).postnord;
  const outF = !!R.querySelector('[data-name="postnord_outgoing"]') || /Vis pakker jeg sender/.test(R.textContent);
  return { head: head.replace(/\s+/g, ' ').trim(), sug, src, outF };
});
ok('40.1 Tilpass → Kilder: «PostNord» Auto, forslag fra registeret, valg lagres i src.postnord', /^PostNord\s*sensor\.postnord_incoming_parcels\s*Auto/.test(ED.head) && ED.sug[0] === 'sensor.postnord_incoming_parcels' && ED.src === 'sensor.postnord_konto_incoming_parcels' && ED.outF, ED);
const OV = await p.evaluate(async () => { MSH.portals().forEach((x) => x.shadowRoot.querySelector('.bg') && x.shadowRoot.querySelector('.bg').click()); await sleep(300); const c = window.__c; c.setConfig({ ...c.config, src: { postnord: 'sensor.postnord_konto_incoming_parcels' } }); c.shadowRoot.querySelector('[data-act="tab"][data-v="posten"]').click(); await sleep(400); return rows().filter((r) => r.pn).map((r) => r.key); });
ok('40.1 Overstyrt kilde → bare den kontoen', OV.length === 2 && OV.includes('pk-pn:70712345678DK') && OV.includes('pk-pn:00370712345678'), OV);
const NONE = await p.evaluate(async () => { const c = window.__c; c.setConfig({ ...c.config, sources: { postnord: 'none' }, src: {} }); await sleep(300); return rows().filter((r) => r.pn).length; });
ok('40.1 sources.postnord: none → PostNord av', NONE === 0, NONE);
const hex = execFileSync('node', ['test/hex-count.mjs', 'src/55-kalender.js']).toString();
ok('Ingen hardkodede farger i 55-kalender.js', /55-kalender\.js\s*\|\s*0\s*\|/.test(hex), hex);
ok('Ingen sidefeil', errs.length === 0, errs);
await b.close();
console.log(fails ? `\n${fails} feilet` : '\nAlle bestod');
process.exit(fails ? 1 : 0);
