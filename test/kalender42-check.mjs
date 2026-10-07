// Fiks 42 · Del A – alle PostNord-entitetene i Kalender → Posten (msh-kalender-card), konto-oppføringer med NORSKE
// entity_id-er. Konto 1 har translation_key + unique_id i registeret (som ha-postnord), konto 2 bare entity_id-er
// (reserve: norske suffikser). Entitetene injiseres bare her (ikke i test/mock/*).
//   42.1 blå prikk 7 px øverst til høyre (mørk ring på rød flis), leveringsrad for valgt dag,
//        calendar-henting bare for de 14 dagene som vises (Fiks 46: ingen forklaring)
//   42.2 → Fiks 46: tall-chips i «Når kommer Posten» (summert over kontoene), Oppdater (button.press på alle kontoene,
//        spinn, haptic), chips = filter (Leverte slår på «Vis leverte»). Eget PostNord-kort finnes ikke lenger.
//   42.3 én rad per …_pakke_<kode>, «Pakke <kode>» uten avsender, utgående med «PostNord · Utgående», filter-chip,
//        entity_registry_updated (nye/forsvunne pakke-sensorer live)
//   roller: translation_key / unique_id / norsk suffiks, overstyring sources.postnord.<rolle> (+ src.postnord.<rolle>),
//   begge editorene. Uten PostNord: som før. (Mer om 46: test/kalender46-check.mjs)        node test/kalender42-check.mjs
import { createRequire } from 'node:module';
import { readdirSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
mkdirSync('test/.build', { recursive: true });
const bundle = resolve(`test/.build/kalender42-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
let fails = 0;
const ok = (name, cond, info) => { if (!cond) fails++; console.log(`${cond ? '✔' : '✘'} ${name}${info != null && !cond ? ' · ' + JSON.stringify(info).slice(0, 1200) : ''}`); };
const mocks = readdirSync('test/mock').filter((f) => f.endsWith('.js')).sort().map((m) => resolve('test/mock/' + m));
const errs = [];

async function page(pn, cfg) {
  const p = await b.newPage({ viewport: { width: 400, height: 1000 }, hasTouch: true });
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await p.goto('file://' + resolve('test/harness.html'));
  for (const m of mocks) await p.addScriptTag({ path: m });
  await p.addScriptTag({ path: bundle });
  await p.evaluate(async ({ pn, cfg }) => {
    const H = window.__h = window.mockHass();
    window.HP = []; window.addEventListener('haptic', (e) => window.HP.push(e.detail));
    window.SUBS = []; window.CAL = [];
    const d0 = (n, h, m) => { const d = new Date(); d.setHours(h || 0, m || 0, 0, 0); d.setDate(d.getDate() + n); return d; };
    window.d0 = d0;
    window.key = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (pn) {
      const J = 'postnord_jemtlands_gmail_com', K = 'postnord_kari_example_no';
      H.devices = { ...(H.devices || {}), dev_pn_j: { id: 'dev_pn_j', name: 'PostNord (jemtlands@gmail.com)', manufacturer: 'PostNord', config_entries: ['ce_j'] }, dev_pn_k: { id: 'dev_pn_k', name: 'PostNord (kari@example.no)', manufacturer: 'PostNord', config_entries: ['ce_k'] } };
      const st = (id, state, attrs, ago) => ({ entity_id: id, state: String(state), attributes: { friendly_name: id, ...attrs }, last_updated: new Date(Date.now() - (ago || 60000)).toISOString(), last_changed: new Date(Date.now() - (ago || 60000)).toISOString(), context: {} });
      // konto 1: registeret som ha-postnord (translation_key + unique_id = <entry_id>_<rolle|strekkode>)
      window.addJ = (id, state, attrs, tk, uid) => { const H = window.__h; H.states[id] = st(id, state, attrs); H.entities[id] = { entity_id: id, platform: 'postnord', device_id: 'dev_pn_j', config_entry_id: 'ce_j', translation_key: tk, unique_id: 'ce_j_' + uid, has_entity_name: true }; };
      // konto 2: bare entity_id (ingen translation_key/unique_id) – norske suffikser
      const addK = (id, state, attrs) => { H.states[id] = st(id, state, attrs); H.entities[id] = { entity_id: id, platform: 'postnord', device_id: 'dev_pn_k' }; };
      const P = (code, status, extra) => ({ carrier: 'PostNord', barcode: code, sender: null, receiver: null, status, raw_status: null, delivered: status === 'delivered', delivered_at: null, planned_from: null, planned_to: null, pickup: status === 'at_pickup_point', pickup_point: null, url: `https://tracking.postnord.com/tracking?id=${code}`, weight: null, dimensions: null, history: null, ...extra });
      const PA = P('UA111111111SE', 'out_for_delivery', { sender: 'Zalando', receiver: 'Jemtland', planned_from: d0(0, 14).toISOString(), planned_to: d0(0, 18).toISOString(), raw_status: 'Ute for levering', weight: 0.8 });
      const PB = P('UB222222222SE', 'at_pickup_point', { sender: 'H&M', pickup_point: 'Coop Extra Lillestrøm', raw_status: 'Klar for henting' });
      const PC = P('UC333333333SE', 'in_transit', { raw_status: 'Under transport' });
      const PD = P('UD444444444SE', 'delivered', { sender: 'Elkjøp', delivered_at: d0(-1, 12, 4).toISOString(), raw_status: 'Levert' });
      const PE = P('UE555555555SE', 'in_transit', { receiver: 'Mormor', planned_from: d0(3, 10).toISOString(), raw_status: 'Under transport' });
      const PF = P('70712345678DK', 'in_transit', { sender: 'Lego', raw_status: 'In transit' });
      window.PN = { PA, PB, PC, PD, PE, PF, J, K };
      addJ(`button.${J}_oppdater`, 'unknown', {}, 'refresh', 'refresh');
      addJ(`calendar.${J}_leveringer`, 'off', {}, 'deliveries', 'deliveries');
      addJ(`sensor.${J}_innkommende_pakker`, 3, { parcels: [PA, PB, PC], unit_of_measurement: 'pakker' }, 'incoming_parcels', 'incoming_parcels');
      addJ(`sensor.${J}_klar_for_henting`, 1, { parcels: [PB] }, 'awaiting_pickup', 'awaiting_pickup');
      addJ(`sensor.${J}_leverte_pakker`, 1, { parcels: [PD] }, 'delivered_parcels', 'delivered_parcels');
      addJ(`sensor.${J}_neste_levering`, d0(0, 14).toISOString(), { barcode: PA.barcode, sender: 'Zalando', receiver: 'Jemtland', device_class: 'timestamp' }, 'next_delivery', 'next_delivery');
      addJ(`sensor.${J}_pakke_ua111111111se`, PA.status, { ...PA }, 'parcel', PA.barcode);
      addJ(`sensor.${J}_pakke_ub222222222se`, PB.status, { ...PB }, 'parcel', PB.barcode);
      addJ(`sensor.${J}_pakke_uc333333333se`, PC.status, { ...PC }, 'parcel', PC.barcode);
      addJ(`sensor.${J}_siste_vellykkede_oppdatering`, new Date(Date.now() - 5 * 60000).toISOString(), { device_class: 'timestamp' }, 'last_update', 'last_update');
      addJ(`sensor.${J}_utgaende_pakker`, 1, { parcels: [PE] }, 'outgoing_parcels', 'outgoing_parcels');
      addJ(`sensor.${J}_utgaende_leverte_pakker`, 0, { parcels: [] }, 'outgoing_delivered_parcels', 'outgoing_delivered_parcels');
      addK(`button.${K}_oppdater`, 'unknown', {});
      addK(`sensor.${K}_innkommende_pakker`, 1, { parcels: [PF] });
      addK(`sensor.${K}_klar_for_henting`, 0, { parcels: [] });
      addK(`sensor.${K}_leverte_pakker`, 0, { parcels: [] });
      addK(`sensor.${K}_pakke_70712345678dk`, PF.status, { ...PF });
      H.services = { ...H.services, postnord: { track_parcel: {}, untrack_parcel: {} } };
      // leveringskalenderen: dynamiske hendelser (window.PNEV) – kallene logges
      const api = H.callApi;
      H.callApi = (method, path) => {
        if (/^calendars\/calendar\.postnord_/.test(path)) {
          const q = new URLSearchParams(path.split('?')[1]); window.CAL.push([path.split('?')[0], q.get('start'), q.get('end')]);
          return Promise.resolve((window.PNEV || []).map((e) => ({ summary: e.s, uid: e.uid, start: { dateTime: e.a.toISOString() }, end: { dateTime: e.b.toISOString() } })));
        }
        return api(method, path);
      };
      H.connection = { ...H.connection, subscribeEvents: (cb, type) => { const s = { cb, type, on: true }; window.SUBS.push(s); return Promise.resolve(() => { s.on = false; }); } };
      window.fire = (type, data) => window.SUBS.filter((s) => s.on && s.type === type).forEach((s) => s.cb({ event_type: type, data, time_fired: new Date().toISOString() }));
      // hendelser: i dag (Zalando 14–18) + første røde (Posten-)dag i rutenettet som ikke er i dag
      const post = MSH.kalender.postData(H, MSH.kalenderSources(H, {}).post);
      const today = d0(0); const days = []; for (let d = today; days.length < 10; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) if (d.getDay() % 6) days.push(d);
      const red = days.find((d) => post && post.dates.has(window.key(d)) && window.key(d) !== window.key(today));
      window.REDDAY = red ? window.key(red) : null;
      window.PNEV = [{ s: 'Zalando', uid: PA.barcode, a: d0(0, 14), b: d0(0, 18) }, ...(red ? [{ s: 'Pakke UC333333333SE', uid: PC.barcode, a: new Date(red.getFullYear(), red.getMonth(), red.getDate(), 9), b: new Date(red.getFullYear(), red.getMonth(), red.getDate(), 12) }] : [])];
    }
    const bc = document.createElement('bubble-card');
    bc.setConfig({ type: 'custom:bubble-card', card_type: 'pop-up', hash: '#kalender' });
    bc.innerHTML = '<div class="pop"><div class="hdr">Kalender</div><div class="inner"></div></div>';
    document.getElementById('dash').appendChild(bc);
    location.hash = '#kalender';
    const c = document.createElement('msh-kalender-card');
    c.setConfig({ type: 'custom:msh-kalender-card', card_id: 'pop-kal42', post_parcels: false, ...(cfg || {}) }); // 56 A: pakkeprikker/-liste testes i kalender56
    c.hass = H;
    bc.querySelector('.inner').appendChild(c);
    window.__c = c;
    await new Promise((q) => setTimeout(q, 600));
    c.shadowRoot.querySelector('[data-act="tab"][data-v="posten"]').click();
    await new Promise((q) => setTimeout(q, 600));
    window.sr = () => window.__c.shadowRoot;
    window.sleep = (ms) => new Promise((q) => setTimeout(q, ms));
    window.rows = () => [...sr().querySelectorAll('.pkr')].map((r) => ({ key: r.dataset.key, pn: r.classList.contains('pn'), kind: r.dataset.kind || null, name: (r.querySelector('.pkh b') || {}).textContent || '', meta: ((m) => { if (!m) return ''; const c = m.querySelector('.pcar'); return c ? m.textContent.slice(c.textContent.length + 3) : m.textContent; })(r.querySelector('.pmeta')), chip: (r.querySelector('.ctag') || r.querySelector('.pmeta .pcar') || {}).textContent || null, icon: (r.querySelector('.pkic ha-icon') || { getAttribute: () => '' }).getAttribute('icon') }));
    // 46: tall-chipsene i «Når kommer Posten»
    window.chips = () => { const x = sr().querySelector('.card.post .pnchs'); return x ? { tiles: [...x.querySelectorAll('.pnch')].map((t) => [t.dataset.v, t.querySelector('b').textContent, t.classList.contains('on')]), refresh: !!x.querySelector('.pnr'), ids: (x.querySelector('.pnr') || { dataset: {} }).dataset.ids || '' } : null; };
    window.setCfg = async (patch) => { const c2 = { ...window.__c.config, ...patch }; Object.keys(patch).forEach((k) => { if (patch[k] === undefined) delete c2[k]; }); window.__c.setConfig(c2); await sleep(300); };
    window.newHass = () => { const H = window.__h; window.__h = { ...H, states: { ...H.states }, entities: { ...H.entities } }; window.__c.hass = window.__h; };
  }, { pn, cfg });
  return p;
}

// ================================================================ uten PostNord: som før
{
  const p = await page(false);
  const A = await p.evaluate(() => ({ pnc: sr().querySelectorAll('.pnc,.pnchs').length, leg: !!sr().querySelector('.pleg'), day: !!sr().querySelector('.pnday'), dots: sr().querySelectorAll('.pnd').length, hdr: [...sr().querySelectorAll('.sh .st')].map((e) => e.textContent), post: !!sr().querySelector('.card.post .pg'), rows: rows().length, accts: MSH.kalender.pnAccounts(window.__h, {}).length }));
  ok('Uten PostNord: ingen PostNord-chips/forklaring/prikk/rad, Posten + Pakker som før', A.pnc === 0 && !A.leg && !A.day && !A.dots && A.hdr.join('|') === 'Pakker' && A.post && A.rows === 3 && A.accts === 0, A);
  await p.close();
}

const p = await page(true);
const J = 'postnord_jemtlands_gmail_com', K = 'postnord_kari_example_no';
// ---------------------------------------------------------------- roller
const R = await p.evaluate(() => {
  const H = window.__h, A = MSH.kalender.pnAccounts(H, {});
  const roles = Object.keys(H.entities).filter((id) => H.entities[id].platform === 'postnord').sort().map((id) => [id, (MSH.kalender.pnRole(H, id) || {}).role, (MSH.kalender.pnRole(H, id) || {}).code]);
  return { accts: A.map((x) => ({ key: x.key, name: x.name, hub: x.hub, roles: x.roles, parcels: x.parcels.map((q) => q.code) })), roles, cands: MSH.kalender.cands(H, 'postnord'), src: MSH.kalenderSources(H, {}).postnord };
});
const ja = R.accts.find((a) => a.name === 'jemtlands@gmail.com'), ka = R.accts.find((a) => a.name === 'kari@example.no');
const want = { refresh: `button.${J}_oppdater`, deliveries: `calendar.${J}_leveringer`, incoming_parcels: `sensor.${J}_innkommende_pakker`, awaiting_pickup: `sensor.${J}_klar_for_henting`, delivered_parcels: `sensor.${J}_leverte_pakker`, next_delivery: `sensor.${J}_neste_levering`, last_update: `sensor.${J}_siste_vellykkede_oppdatering`, outgoing_parcels: `sensor.${J}_utgaende_pakker`, outgoing_delivered_parcels: `sensor.${J}_utgaende_leverte_pakker` };
ok('Roller: to kontoer gruppert per enhet, navn fra «PostNord (<konto>)»', R.accts.length === 2 && ja && ka && !ja.hub && !ka.hub, R.accts);
ok('Roller (translation_key): alle 9 roller + 3 pakke-sensorer i konto 1 (12 entiteter)', ja && Object.keys(want).every((r) => ja.roles[r] === want[r]) && Object.keys(ja.roles).length === 9 && ja.parcels.sort().join() === 'UA111111111SE,UB222222222SE,UC333333333SE', ja);
ok('Roller (norsk entity_id-reserve): innkommende/klar/leverte/oppdater + pakke i konto 2', ka && ka.roles.incoming_parcels === `sensor.${K}_innkommende_pakker` && ka.roles.awaiting_pickup === `sensor.${K}_klar_for_henting` && ka.roles.delivered_parcels === `sensor.${K}_leverte_pakker` && ka.roles.refresh === `button.${K}_oppdater` && ka.parcels.join() === '70712345678DK' && !ka.roles.outgoing_parcels, ka);
ok('Roller: «leverte_pakker» ≠ «utgaende_leverte_pakker», ingen entitet uten rolle', R.roles.every((r) => r[1]) && R.roles.find((r) => r[0] === `sensor.${J}_utgaende_leverte_pakker`)[1] === 'outgoing_delivered_parcels', R.roles);
const R2 = await p.evaluate(() => {
  const H = window.__h, id = 'sensor.postnord_test_konto_x';
  // unique_id-reserve: navnet sier ingenting, translation_key mangler
  H.states[id] = { entity_id: id, state: '2', attributes: {}, last_updated: new Date().toISOString() }; H.entities[id] = { entity_id: id, platform: 'postnord', config_entry_id: 'ce_x', unique_id: 'ce_x_awaiting_pickup' };
  const id2 = 'sensor.postnord_test_konto_y'; H.states[id2] = { entity_id: id2, state: 'in_transit', attributes: {}, last_updated: new Date().toISOString() }; H.entities[id2] = { entity_id: id2, platform: 'postnord', config_entry_id: 'ce_x', unique_id: 'ce_x_ug999999999se' };
  const id3 = 'sensor.postnord_incoming_parcels'; H.states[id3] = { entity_id: id3, state: '0', attributes: { parcels: [] } }; H.entities[id3] = { entity_id: id3, platform: 'postnord' };
  const r = [MSH.kalender.pnRole(H, id), MSH.kalender.pnRole(H, id2), MSH.kalender.pnRole(H, id3)];
  [id, id2, id3].forEach((x) => { delete H.states[x]; delete H.entities[x]; });
  return r;
});
ok('Roller (unique_id-reserve + engelsk suffiks)', R2[0].role === 'awaiting_pickup' && R2[1].role === 'parcel' && R2[1].code === 'UG999999999SE' && R2[2].role === 'incoming_parcels', R2);
ok('Kilde «PostNord» (auto) = innkommende-sensoren i første konto, kandidater for begge', R.src === `sensor.${J}_innkommende_pakker` && R.cands.join() === `sensor.${J}_innkommende_pakker,sensor.${K}_innkommende_pakker`, R);

// ---------------------------------------------------------------- 42.2 → 46 tall-chips i kortet
const S = await p.evaluate(() => {
  const pane = sr().querySelector('.pane'), kids = [...pane.children];
  return { pnc: sr().querySelectorAll('.pnc').length, inCard: !!sr().querySelector('.card.post .pnchs'), cards: kids.filter((x) => x.matches('.card.post')).length, ch: chips() };
});
ok('46 Ingen eget PostNord-kort; chipsene ligger i «Når kommer Posten»', S.pnc === 0 && S.inCard && S.cards === 1, S);
ok('46 Chips summert over kontoene: Inn 4 · Hentes 1 · Levert 1 · Ut 1', S.ch && S.ch.tiles.map((t) => t[1]).join() === '4,1,1,1' && S.ch.tiles.map((t) => t[0]).join() === 'in,klar,lev,out', S.ch);
// Oppdater
const U = await p.evaluate(async () => {
  window.__calls.length = 0; window.HP.length = 0;
  const b = sr().querySelector('.post .pnr'); b.click(); await sleep(60);
  const spin = sr().querySelector('.post .pnr').classList.contains('spin'), anim = getComputedStyle(sr().querySelector('.post .pnr>*')).animationName + ' ' + getComputedStyle(sr().querySelector('.post .pnr>*')).animationDuration;
  await sleep(700);
  const spinAfter = sr().querySelector('.post .pnr').classList.contains('spin');
  return { calls: window.__calls.filter((c) => c[0] === 'button'), hp: [...window.HP], spin, anim, spinAfter, pakkerBtn: !!sr().querySelector('.sh [data-act="prefresh"]') };
});
ok('46 Oppdater → button.press på begge kontoenes oppdater-knapper, haptic success', U.calls.length === 2 && U.calls.every((c) => c[1] === 'press') && U.calls.map((c) => c[2].entity_id).sort().join() === [`button.${J}_oppdater`, `button.${K}_oppdater`].sort().join() && U.hp.join() === 'success', U);
ok('46 Ikonet roterer 360° på 0,6 s', U.spin && /pnspin 0\.6s/.test(U.anim) && !U.spinAfter, U);
ok('46 Ingen dobbel Oppdater-knapp i Pakker-headeren når chipsene vises', !U.pakkerBtn, U);

// ---------------------------------------------------------------- 42.3 Pakker-lista
const L0 = await p.evaluate(() => rows());
const by = Object.fromEntries(L0.map((r) => [r.key, r]));
ok('42.3 Én rad per pakke (sensorer + lister slått sammen, ingen duplikater), levert/utgående skjult', ['UA111111111SE', 'UB222222222SE', 'UC333333333SE', '70712345678DK'].every((c) => by['pk-pn:' + c]) && !by['pk-pn:UD444444444SE'] && !by['pk-pn:UE555555555SE'] && new Set(L0.map((r) => r.key)).size === L0.length, L0);
ok('42.3/56 B2 Navn = avsender, ellers de siste 6 tegnene «…3333SE»', by['pk-pn:UA111111111SE'].name === 'Zalando' && by['pk-pn:UC333333333SE'].name === '…3333SE', [by['pk-pn:UA111111111SE'], by['pk-pn:UC333333333SE']]);
ok('42.3 Status/farge fra 40.2 (ute → klar → transport)', by['pk-pn:UA111111111SE'].kind === 'out' && by['pk-pn:UB222222222SE'].kind === 'klar' && by['pk-pn:UC333333333SE'].kind === 'transport', L0);
const FA = await p.evaluate(async () => { sr().querySelector('.pkr[data-key="pk-pn:UC333333333SE"] .pkh').click(); await sleep(200); const r = sr().querySelector('.pkr[data-key="pk-pn:UC333333333SE"]'); const f = [...r.querySelectorAll('.facts span')].map((s) => [s.querySelector('i').textContent, s.querySelector('b').textContent]); const det = (r.querySelector('[data-act="more"]') || { dataset: {} }).dataset.id; sr().querySelector('.pkr[data-key="pk-pn:UC333333333SE"] .pkh').click(); await sleep(150); return { f, det }; });
ok('42.3 Fakta har «Sporingsnummer»; «Detaljer» = pakke-sensoren', FA.f.some((x) => x[0] === 'Sporingsnummer' && x[1] === 'UC333333333SE') && FA.det === `sensor.${J}_pakke_uc333333333se`, FA);
// filtre
const tap = (g, v) => p.evaluate(async ({ g, v }) => { window.HP.length = 0; sr().querySelector(`.post .pnch[data-v="${v}"]`).click(); await sleep(200); const t = sr().querySelector(`.post .pnch[data-v="${v}"]`); const chip = sr().querySelector('.sh .pnfc'); return { rows: rows(), hp: [...window.HP], on: t.classList.contains('on'), bg: getComputedStyle(t).backgroundColor, fg: getComputedStyle(t).color, chip: chip ? [chip.textContent.trim(), getComputedStyle(chip).backgroundColor, getComputedStyle(chip).color] : null, pDel: !!window.__c.ui.pDel }; }, { g, v });
const F1 = await tap(0, 'klar');
ok('46 «Hentes» → bare den pakken, chipen blå med mørk tekst, haptic selection', F1.rows.length === 1 && F1.rows[0].key === 'pk-pn:UB222222222SE' && F1.on && F1.bg === 'rgb(115, 185, 242)' && F1.fg === 'rgb(40, 40, 40)' && F1.hp.join() === 'selection', F1);
ok('42.3 Aktivt filter = blå chip «Klar for henting ×» i Pakker-headeren', F1.chip && F1.chip[0] === 'Klar for henting' && F1.chip[1] === 'rgb(115, 185, 242)' && F1.chip[2] === 'rgb(40, 40, 40)', F1.chip);
const F2 = await tap(0, 'klar');
ok('42.2 Trykk igjen → filteret fjernes', !F2.on && !F2.chip && F2.rows.length === L0.length, F2);
const F3 = await tap(0, 'lev');
ok('42.2 «Leverte» → levert-pakken vises og «Vis leverte» slås på', F3.rows.length === 1 && F3.rows[0].key === 'pk-pn:UD444444444SE' && F3.pDel, F3);
const F4 = await p.evaluate(async () => { sr().querySelector('.sh .pnfc').click(); await sleep(200); return { chip: !!sr().querySelector('.sh .pnfc'), on: sr().querySelectorAll('.pnch.on').length }; });
ok('42.3 Trykk på chipen fjerner filteret', !F4.chip && !F4.on, F4);
const F5 = await tap(0, 'out');
ok('42.3/56 B2 «Utgående» → «PostNord ↑ · …» i undertittelen, outbox-ikon, «Til Mormor · estimert …»', F5.rows.length === 1 && F5.rows[0].key === 'pk-pn:UE555555555SE' && F5.rows[0].chip === 'PostNord ↑' && /inbox-arrow-up/.test(F5.rows[0].icon) && /^Til Mormor · estimert \S+ \d+\. [a-z]+$/.test(F5.rows[0].meta), F5.rows);
await tap(0, 'out');
const F6 = await tap(0, 'in');
ok('46 «Inn» gjelder alle kontoene → de fire innkommende pakkene', F6.rows.length === 4 && F6.rows.some((r) => r.key === 'pk-pn:70712345678DK') && F6.rows.some((r) => r.key === 'pk-pn:UA111111111SE'), F6.rows);
await tap(0, 'in');

// ---------------------------------------------------------------- 42.1 «Når kommer Posten»
const D = await p.evaluate(async () => {
  const dots = [...sr().querySelectorAll('.pd .pnd')].map((i) => i.closest('.pd').dataset.v);
  const i = sr().querySelector('.pd .pnd'), cs = getComputedStyle(i), pd = i.closest('.pd').getBoundingClientRect(), r = i.getBoundingClientRect();
  const red = window.REDDAY && sr().querySelector(`.pd[data-v="${window.REDDAY}"] .pnd`);
  const leg = sr().querySelector('.pleg');
  const row = sr().querySelector('.pnday'), rc = row && getComputedStyle(row), ci = row && row.querySelector('.pndi');
  return { dots, today: window.key(window.d0(0)), red: window.REDDAY, w: cs.width, bg: cs.backgroundColor, top: Math.round(r.top - pd.top), right: Math.round(pd.right - r.right), ring: red ? getComputedStyle(red).boxShadow : null, ringPlain: getComputedStyle(sr().querySelector(`.pd[data-v="${window.key(window.d0(0))}"] .pnd`) || i).boxShadow, todayOn: !!sr().querySelector(`.pd.on[data-v="${window.key(window.d0(0))}"]`),
    leg: leg && [[...leg.querySelectorAll('span')].map((x) => x.textContent.trim()).join(' '), getComputedStyle(leg).fontSize, getComputedStyle(leg).color, [...leg.querySelectorAll('i')].map((x) => getComputedStyle(x).backgroundColor)],
    row: row && [[...row.querySelectorAll('b,.evc>span')].map((x) => x.textContent.trim()).join(' | '), rc.backgroundColor, rc.borderRadius, getComputedStyle(ci).width, getComputedStyle(ci).backgroundColor, ci.querySelector('ha-icon').getAttribute('icon')], cal: window.CAL.slice() };
});
const wk = new Date().getDay() % 6 !== 0; // i dag er bare i rutenettet på hverdager
ok('42.1 Blå prikk på leveringsdagene i rutenettet (i dag på hverdager + den røde dagen)', (!wk || D.dots.includes(D.today)) && (!D.red || D.dots.includes(D.red)) && D.dots.length === (D.red ? 1 : 0) + (wk ? 1 : 0), D);
ok('42.1 Prikken: 7px, blå, øverst til høyre', D.w === '7px' && D.bg === 'rgb(115, 185, 242)' && D.top <= 6 && D.right <= 6, D);
ok('42.1 Mørk 1,5px ring når flisa er rød', D.red ? /rgb\(40, 40, 40\) 0px 0px 0px 1\.5px/.test(D.ring) : true, D.ring);
ok('46 Ingen forklaringslinje under rutenettet', !D.leg, D.leg);
ok('46 Ingen valgt dag («Ved valgt dag», standard) → ingen leveringsrad', !D.row, D.row);
const DA = await p.evaluate(async () => { await setCfg({ pn_row: 'alltid' }); const row = sr().querySelector('.pnday'), rc = row && getComputedStyle(row), ci = row && row.querySelector('.pndi'); const r = row && [[...row.querySelectorAll('b,.evc>span')].map((x) => x.textContent.trim()).join(' | '), rc.backgroundColor, rc.borderRadius, getComputedStyle(ci).width, getComputedStyle(ci).backgroundColor, ci.querySelector('ha-icon').getAttribute('icon')]; await setCfg({ pn_row: undefined }); return r; });
ok('46 «Alltid»: rad #404040 r20, blå 32px sirkel local_shipping, «PostNord · Zalando» / «I dag 14–18 · Ute for levering»', DA && DA[0] === 'PostNord · Zalando | I dag 14–18 · Ute for levering' && DA[1] === 'rgb(64, 64, 64)' && DA[2] === '20px' && DA[3] === '32px' && DA[4] === 'rgb(115, 185, 242)' && /truck/.test(DA[5]), DA);
// (Kalender-fanen henter alle calendar.* ±40 dager som før; Posten-kortet henter bare dagene i rutenettet)
const pc = D.cal.filter((c) => new Date(c[1]).getTime() === window0());
function window0() { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); }
const span = pc.length ? (Date.parse(pc[0][2]) - Date.parse(pc[0][1])) / 86400000 : null;
ok('42.1 Posten-kortet henter leveringskalenderen bare for de 14 dagene som vises (fra i dag)', pc.length === 1 && pc[0][0] === `calendars/calendar.${J}_leveringer` && span >= 12 && span <= 15, { cal: D.cal, span });
if (D.red) {
  const SD = await p.evaluate(async () => { sr().querySelector(`.pd[data-v="${window.REDDAY}"]`).click(); await sleep(200); const r = [...sr().querySelectorAll('.pnday')].map((x) => [...x.querySelectorAll('b,.evc>span')].map((y) => y.textContent.trim()).join(' | ')); sr().querySelector(`.pd[data-v="${window.REDDAY}"]`).click(); await sleep(150); return r; });
  ok('42.1 Valgt dag med levering → raden for den dagen (vindu · status)', SD.length === 1 && /^PostNord · …3333SE \| (?:I dag|I morgen|\S+ \d+\. [a-z]+) 9–12 · Under transport$/.test(SD[0]), SD);
}

// ---------------------------------------------------------------- 42.3 entity_registry_updated
const RG = await p.evaluate(async () => {
  const subs = window.SUBS.filter((s) => s.on).map((s) => s.type);
  const H = window.__h, J = window.PN.J, id = `sensor.${J}_pakke_uh777777777se`;
  const P = { barcode: 'UH777777777SE', status: 'registered', sender: 'Apotek 1', raw_status: 'Varslet' };
  // samme hass-objekt (ingen ny hass) – bare hendelsen sier fra
  window.addJ(id, 'registered', P, 'parcel', 'UH777777777SE');
  fire('entity_registry_updated', { action: 'create', entity_id: id });
  await sleep(450);
  const added = rows().find((r) => r.key === 'pk-pn:UH777777777SE');
  delete H.states[id]; delete H.entities[id];
  fire('entity_registry_updated', { action: 'remove', entity_id: id });
  await sleep(450);
  const gone = !rows().find((r) => r.key === 'pk-pn:UH777777777SE');
  const other = Object.keys(H.states)[0]; let renders = 0; const c = window.__c, orig = c._render.bind(c); c._render = () => { renders++; return orig(); };
  fire('entity_registry_updated', { action: 'update', entity_id: 'light.taklampe_x' }); await sleep(400); c._render = orig;
  return { subs, added, gone, renders };
});
ok('42.3 Lytter på entity_registry_updated mens popupen er åpen', RG.subs.includes('entity_registry_updated'), RG.subs);
ok('42.3 Ny pakke-sensor → ny rad live («Apotek 1»), fjernet → raden forsvinner', RG.added && RG.added.name === 'Apotek 1' && RG.gone, RG);
ok('42.3 Andre registerendringer tegner ikke på nytt', RG.renders === 0, RG.renders);

// ---------------------------------------------------------------- gammel postnord_view / overstyring / skjul
const MG = await p.evaluate(async () => { await setCfg({ postnord_view: 'merged' }); const r = { ch: chips(), pnc: sr().querySelectorAll('.pnc').length }; await setCfg({ postnord_view: undefined }); return r; });
ok('Gammel postnord_view tolereres (ignoreres): samme summerte chips, ingen eget kort', MG.pnc === 0 && MG.ch && MG.ch.tiles.map((t) => t[1]).join() === '4,1,1,1', MG);
const OV = await p.evaluate(async () => {
  await setCfg({ sources: { postnord: { refresh: 'none', awaiting_pickup: 'none' } } });
  const a = chips();
  await setCfg({ sources: undefined, src: { postnord: { last_successful_update: 'sensor.' + window.PN.K + '_leverte_pakker' } } });
  const b2 = MSH.kalender.pnAccounts(window.__h, window.__c.config).find((x) => x.name === 'kari@example.no').roles.last_update;
  await setCfg({ src: undefined });
  return { a, b2 };
});
ok('Overstyring sources.postnord.<rolle>: none → ingen Oppdater, «Hentes» = –', OV.a && !OV.a.refresh && OV.a.tiles[1][1] === '–', OV.a);
ok('Overstyring src.postnord.<rolle> leses (alias last_successful_update) → til kontoen entiteten hører til', OV.b2 === `sensor.${K}_leverte_pakker`, OV.b2);
const HID = await p.evaluate(async () => { await setCfg({ section_hidden: { posten: ['postnord'] } }); const r = { pn: sr().querySelectorAll('.pnchs,.pnd,.pnday,.pnc').length, btn: !!sr().querySelector('.sh [data-act="prefresh"]') }; await setCfg({ section_hidden: undefined, section_order: { posten: ['pakker', 'posten'] } }); const kids = [...sr().querySelector('.pane').children]; r.order = [kids.findIndex((x) => x.matches('.sh') && /Pakker/.test(x.textContent)), kids.findIndex((x) => x.matches('.card.post'))]; r.chips = !!sr().querySelector('.card.post .pnchs'); await setCfg({ section_order: undefined }); return r; });
ok('46 PostNord-tall skjult i Tilpass → ingen PostNord i kortet (Oppdater flytter til Pakker-headeren)', HID.pn === 0 && HID.btn, HID);
ok('46 Gammel lagret rekkefølge (posten = kort) virker, chipsene følger kortet', HID.order[0] >= 0 && HID.order[0] < HID.order[1] && HID.chips, HID);

// ---------------------------------------------------------------- editorene
const ED = await p.evaluate(async () => {
  window.__c.customize('kilder'); await sleep(500);
  const portal = MSH.portals().pop(), ed = portal.shadowRoot.querySelector('msh-editor'), R = ed.shadowRoot;
  const t = [...R.querySelectorAll('[data-a="tab"]')].find((x) => x.dataset.v === 'kilder'); if (t) { t.click(); await sleep(150); }
  const parts = (() => { const tb = [...R.querySelectorAll('[data-a="tab"]')].find((x) => x.dataset.v === 'faner'); return tb; })();
  const card = R.querySelector('.ksrc[data-key="ks-pnroles"]'); const head = card ? card.textContent.replace(/\s+/g, ' ').trim() : '';
  card.querySelector('[data-op="pnopen"]').click(); await sleep(150);
  const roleRows = [...R.querySelectorAll('.ksrc[data-key="ks-pnroles"] [data-op="pnr"]')].map((x) => x.textContent.replace(/\s+/g, ' ').trim());
  R.querySelector('.ksrc[data-key="ks-pnroles"] [data-op="pnr"][data-v="next_delivery"]').click(); await sleep(150);
  const picks = [...R.querySelectorAll('.ksrc[data-key="ks-pnroles"] [data-op="pnrpick"][data-v="next_delivery"]')].map((x) => x.dataset.id);
  R.querySelector('.ksrc[data-key="ks-pnroles"] [data-op="pnrpick"][data-v="next_delivery"][data-id="none"]').click(); await sleep(200);
  const v1 = JSON.parse(JSON.stringify((ed._config.sources || {}).postnord || null));
  R.querySelector('.ksrc[data-key="ks-pnroles"] [data-op="pnr"][data-v="next_delivery"]') || null;
  const auto = R.querySelector('.ksrc[data-key="ks-pnroles"] [data-op="pnrpick"][data-v="next_delivery"][data-id=""]'); if (auto) { auto.click(); await sleep(200); }
  const v2 = (ed._config.sources || {}).postnord || null;
  const view = !!R.querySelector('[data-name="postnord_view"]') || /PostNord-seksjonen/.test(R.textContent);
  MSH.portals().forEach((x) => x.shadowRoot.querySelector('.bg') && x.shadowRoot.querySelector('.bg').click()); await sleep(300);
  // Faner → Posten har tre deler
  return { head, roleRows, picks, v1, v2, view };
});
ok('Tilpass → Kilder: «PostNord – roller» (Auto, kontoene), 9 roller', /^PostNord – roller\s*jemtlands@gmail\.com · kari@example\.no\s*Auto/.test(ED.head) && ED.roleRows.length === 9 && /^Neste levering\s*sensor\.postnord_jemtlands_gmail_com_neste_levering\s*Auto/.test(ED.roleRows[3]), ED);
ok('Tilpass: velg «Av» → sources.postnord.next_delivery = none; «Automatisk» fjerner; «PostNord-seksjonen» er borte', ED.picks.includes(`sensor.${J}_neste_levering`) && ED.v1 && ED.v1.next_delivery === 'none' && ED.v2 === null && !ED.view, ED);
const GUI = await p.evaluate(async () => {
  const ed = customElements.get('msh-kalender-card').getConfigElement(); ed.hass = window.__h; ed.setConfig({ type: 'custom:msh-kalender-card', card_id: 'gui42', sources: { postnord: { refresh: 'button.x' } } }); document.body.appendChild(ed);
  await sleep(200);
  const R = ed.shadowRoot;
  const tb = [...R.querySelectorAll('[data-a="tab"]')].find((t) => t.dataset.v === 'kilder'); if (tb) { tb.click(); await sleep(150); }
  const sel = [...R.querySelectorAll('ha-selector')].map((s) => s.dataset.name);
  const view = !!R.querySelector('[data-name="postnord_view"]') || /PostNord-seksjonen/.test(R.textContent);
  ed.remove();
  return { sel, view };
});
ok('GUI-editor: entitetsvelger per rolle (sources.postnord.<rolle>), ingen «PostNord-seksjonen»', ['incoming_parcels', 'awaiting_pickup', 'delivered_parcels', 'next_delivery', 'last_update', 'outgoing_parcels', 'outgoing_delivered_parcels', 'refresh', 'deliveries'].every((r) => GUI.sel.includes('sources.postnord.' + r)) && GUI.sel.includes('src.postnord') && !GUI.view, GUI);
const FAN = await p.evaluate(() => MSH.kalender && window.__c && [...(customElements.get('msh-kalender-card').schema(window.__h, {})[0].tabs[0].fields[0].html(window.__h, {}, 'k', { _config: {}, shadowRoot: null, __kalInst: true }).matchAll(/data-op="exp"/g))].length);
ok('Faner: Posten har deler (PostNord-tall kan skjules)', FAN >= 1, FAN);

// ingen hardkodede entitets-IDer / farger
const src = (await import('node:fs')).readFileSync('src/55-kalender.js', 'utf8');
ok('Ingen hardkodede PostNord-entitets-IDer i koden', !/['"`](sensor|button|calendar)\.postnord_[a-z]/.test(src), null);
const hex = execFileSync('node', ['test/hex-count.mjs', 'src/55-kalender.js']).toString();
ok('Ingen hardkodede farger i 55-kalender.js', /55-kalender\.js\s*\|\s*0\s*\|/.test(hex), hex);
ok('Ingen sidefeil', errs.length === 0, errs);
await b.close();
try { rmSync(bundle); } catch (e) { /* */ }
console.log(fails ? `\n${fails} feilet` : '\nAlle bestod');
process.exit(fails ? 1 : 0);
