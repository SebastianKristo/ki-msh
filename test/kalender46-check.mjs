// Fiks 46 · «Når kommer Posten» + PostNord som ÉTT kompakt kort (Kalender → Posten, msh-kalender-card).
//   topp (12px-tittel med rødt mail-ikon 16px, «I morgen» 26/300, dato 12px, chip øverst til høyre), rutenett med blå
//   prikker, leveringsrad (pn_row valgt|alltid), tall-chips Inn/Hentes/Levert/Ut + oppdater 36px; høyde ≈ gammelt kort +
//   chips-rad; chips = filter på Pakker; oppdater trykker alle kontoenes knapper; «PostNord-tall» av skjuler all PostNord;
//   pn_row i begge editorene; Faner-lista (kort · PostNord-tall · Pakker) med migrering; manglende data.
// PostNord-entitetene injiseres bare her (samme oppsett som kalender42).        node test/kalender46-check.mjs
import { createRequire } from 'node:module';
import { readdirSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
mkdirSync('test/.build', { recursive: true });
const bundle = resolve(`test/.build/kalender46-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
let fails = 0;
const ok = (name, cond, info) => { if (!cond) fails++; console.log(`${cond ? '✔' : '✘'} ${name}${info != null && !cond ? ' · ' + JSON.stringify(info).slice(0, 1200) : ''}`); };
const mocks = readdirSync('test/mock').filter((f) => f.endsWith('.js')).sort().map((m) => resolve('test/mock/' + m));
const errs = [];
const SHOT = process.env.SHOT_DIR || '';

async function page(pn, cfg, width) {
  const p = await b.newPage({ viewport: { width: width || 400, height: 1000 }, hasTouch: true });
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
    c.setConfig({ type: 'custom:msh-kalender-card', card_id: 'pop-kal46', post_parcels: false, ...(cfg || {}) }); // 56 A: pakkeprikker/-liste testes i kalender56
    c.hass = H;
    bc.querySelector('.inner').appendChild(c);
    window.__c = c;
    await new Promise((q) => setTimeout(q, 600));
    c.shadowRoot.querySelector('[data-act="tab"][data-v="posten"]').click();
    await new Promise((q) => setTimeout(q, 600));
    window.sr = () => window.__c.shadowRoot;
    window.sleep = (ms) => new Promise((q) => setTimeout(q, ms));
    window.rows = () => [...sr().querySelectorAll('.pkr')].map((r) => ({ key: r.dataset.key, pn: r.classList.contains('pn'), kind: r.dataset.kind || null, name: (r.querySelector('.pkh b') || {}).textContent || '', meta: (r.querySelector('.pmeta') || {}).textContent || '', chip: (r.querySelector('.ctag') || {}).textContent || null, icon: (r.querySelector('.pkic ha-icon') || { getAttribute: () => '' }).getAttribute('icon') }));
    // 46: tall-chipsene i «Når kommer Posten»
    window.chips = () => { const x = sr().querySelector('.card.post .pnchs'); return x ? { tiles: [...x.querySelectorAll('.pnch')].map((t) => [t.dataset.v, t.querySelector('b').textContent, t.classList.contains('on')]), refresh: !!x.querySelector('.pnr'), ids: (x.querySelector('.pnr') || { dataset: {} }).dataset.ids || '' } : null; };
    window.setCfg = async (patch) => { const c2 = { ...window.__c.config, ...patch }; Object.keys(patch).forEach((k) => { if (patch[k] === undefined) delete c2[k]; }); window.__c.setConfig(c2); await sleep(300); };
    window.newHass = () => { const H = window.__h; window.__h = { ...H, states: { ...H.states }, entities: { ...H.entities } }; window.__c.hass = window.__h; };
  }, { pn, cfg });
  return p;
}


// mål på kortet (inni nettleseren)
const MEAS = () => {
  const card = sr().querySelector('.card.post'); if (!card) return null;
  const cs = (e) => getComputedStyle(e), r = (e) => e.getBoundingClientRect();
  const kids = [...card.children].map((x) => x.className.split(' ')[0]);
  const ptl = card.querySelector('.ptl'), ic = ptl.querySelector('ha-icon'), rel = card.querySelector('.prel'), sub = card.querySelector('.psub'), chip = card.querySelector('.pchip');
  const cr = r(card);
  return { kids, h: Math.round(cr.height), pad: cs(card).padding, gap: cs(card).rowGap,
    ptl: [ptl.textContent.trim(), cs(ptl).fontSize, cs(ptl).color, ic.getAttribute('icon'), cs(ic).color, cs(ic).getPropertyValue('--mdc-icon-size').trim() || ic.getAttribute('style')],
    rel: [rel.textContent, cs(rel).fontSize, cs(rel).fontWeight], sub: sub ? [sub.textContent, cs(sub).fontSize, cs(sub).color] : null,
    chip: chip ? { right: Math.round(cr.right - r(chip).right), top: Math.round(r(chip).top - cr.top) } : null,
    hdr: !!card.querySelector('.sh'), pnc: sr().querySelectorAll('.pnc').length, name: /jemtlands|kari@/.test(card.textContent), next: /Neste levering|Siste vellykkede/.test(card.textContent), leg: !!sr().querySelector('.pleg') };
};

const p = await page(true);
const J = 'postnord_jemtlands_gmail_com', K = 'postnord_kari_example_no';
await p.evaluate((f) => { window.MEAS = eval('(' + f + ')'); }, MEAS.toString());
if (SHOT) await p.screenshot({ path: SHOT + '/k46-kort.png' });

// ---------------------------------------------------------------- kortet
const A = await p.evaluate(() => MEAS());
ok('Ett kort: topp → rutenett → tall-chips (ingen headerrad, ingen eget PostNord-kort)', A && A.kids.join() === 'pt,pg,pnchs' && !A.hdr && A.pnc === 0, A);
ok('Kortet: padding 16, gap 12', A.pad === '16px' && A.gap === '12px', A);
ok('Topp: «Når kommer Posten» 12px #afafaf, mail-ikon rødt', A.ptl[0] === 'Når kommer Posten' && A.ptl[1] === '12px' && A.ptl[2] === 'rgb(175, 175, 175)' && /email/.test(A.ptl[3]) && A.ptl[4] === 'rgb(242, 128, 115)' && /16px/.test(A.ptl[5]), A.ptl);
ok('Topp: dag 26px/300, dato 12px #979797', A.rel[1] === '26px' && A.rel[2] === '300' && A.sub && A.sub[1] === '12px' && A.sub[2] === 'rgb(151, 151, 151)', [A.rel, A.sub]);
ok('Chip øverst til høyre (16px fra kanten)', A.chip && Math.abs(A.chip.right - 16) <= 1 && Math.abs(A.chip.top - 16) <= 1, A.chip);
ok('Fjernet: kontonavn, forklaring, «Neste levering»/«Siste oppdatering»', !A.name && !A.leg && !A.next, A);
// høyde: av (som gammelt kort uten PostNord) vs på
const HT = await p.evaluate(async () => { const on = MEAS().h; await setCfg({ section_hidden: { posten: ['postnord'] } }); const off = MEAS().h; await setCfg({ section_hidden: undefined }); return { on, off }; });
ok(`Høyde: med PostNord ${HT.on}px ≈ uten (${HT.off}px) + chips-rad 36 + gap 12`, Math.abs(HT.on - HT.off - 48) <= 2 && HT.off <= 230, HT);

// ---------------------------------------------------------------- chips
const CH = await p.evaluate(() => {
  const L = [...sr().querySelectorAll('.post .pnch')], cs = (e) => getComputedStyle(e);
  return L.map((t) => { const bb = t.querySelector('b'), sp = t.querySelector('span'), br = bb.getBoundingClientRect(), sr2 = sp.getBoundingClientRect(); return { v: t.dataset.v, txt: bb.textContent + ' ' + sp.textContent, title: t.title, aria: t.getAttribute('aria-label'), h: cs(t).height, rad: cs(t).borderRadius, bg: cs(t).backgroundColor, sh: cs(t).boxShadow, b: [cs(bb).fontSize, cs(bb).fontWeight], s: cs(sp).fontSize, line: Math.abs((br.top + br.height / 2) - (sr2.top + sr2.height / 2)) < 3, clip: sp.scrollWidth > sp.clientWidth + 0.5 || sr2.right > t.getBoundingClientRect().right, ell: cs(sp).textOverflow }; });
});
ok('4 chips: «4 Inn» · «1 Hentes» · «1 Levert» · «1 Ut» (summert over to kontoer)', CH.map((c) => c.txt).join('|') === '4 Inn|1 Hentes|1 Levert|1 Ut', CH);
ok('Full tekst i title/aria-label', CH[0].title === 'Innkommende: 4' && CH[1].aria === 'Klar for henting: 1' && CH[2].title === 'Leverte: 1' && CH[3].title === 'Utgående: 1', CH);
ok('Chips: høyde 36, pille, transparent, kontur inset 1px rgba(255,255,255,.08)', CH.every((c) => c.h === '36px' && c.rad === '18px' && c.bg === 'rgba(0, 0, 0, 0)' && /rgba\(255, 255, 255, 0\.08\) 0px 0px 0px 1px inset/.test(c.sh)), CH[0]);
ok('Chips: tall 14/600 + etikett 11px på samme linje, ingen klipping/ellipsis', CH.every((c) => c.b.join() === '14px,600' && c.s === '11px' && c.line && !c.clip && c.ell !== 'ellipsis'), CH);
const N320 = await (async () => { const q = await page(true, null, 320); const r = await q.evaluate(() => [...sr().querySelectorAll('.post .pnch')].map((t) => { const sp = t.querySelector('span'); return { t: sp.textContent, w: Math.round(t.getBoundingClientRect().width), sw: sp.scrollWidth, bw: Math.round(t.querySelector('b').getBoundingClientRect().width), clip: sp.scrollWidth > sp.clientWidth + 0.5 || sp.getBoundingClientRect().right > t.getBoundingClientRect().right + 0.5 || sp.getBoundingClientRect().left < t.getBoundingClientRect().left - 0.5 }; })); if (SHOT) await q.screenshot({ path: SHOT + '/k46-320.png' }); await q.close(); return r; })();
ok('320 px bred skjerm: «Hentes»/«Levert» klippes ikke', N320.length === 4 && N320.every((x) => !x.clip), N320);
const RB = await p.evaluate(() => { const b2 = sr().querySelector('.post .pnchs .pnr'), cs = getComputedStyle(b2), ic = b2.querySelector('ha-icon'); return { last: b2 === sr().querySelector('.post .pnchs').lastElementChild, w: cs.width, h: cs.height, rad: cs.borderRadius, bg: cs.backgroundColor, ic: getComputedStyle(ic).getPropertyValue('--mdc-icon-size').trim() || ic.getAttribute('style'), ids: b2.dataset.ids.split(',').sort() }; });
ok('Oppdater sist i raden: 36px rund, rgba(255,255,255,.08), ikon 18', RB.last && RB.w === '36px' && RB.h === '36px' && RB.rad === '18px' && RB.bg === 'rgba(255, 255, 255, 0.08)' && /18px/.test(RB.ic), RB);
const U = await p.evaluate(async () => {
  window.__calls.length = 0; window.HP.length = 0;
  sr().querySelector('.post .pnr').click(); await sleep(60);
  const spin = sr().querySelector('.post .pnr').classList.contains('spin'), a0 = getComputedStyle(sr().querySelector('.post .pnr>*')), anim = a0.animationName + ' ' + a0.animationDuration;
  await sleep(700);
  return { calls: window.__calls.filter((c) => c[0] === 'button').map((c) => c[1] + ':' + c[2].entity_id).sort(), hp: [...window.HP], spin, anim, after: sr().querySelector('.post .pnr').classList.contains('spin') };
});
ok('Oppdater → button.press på ALLE kontoenes knapper, haptic success, spinn 0,6 s', U.calls.join() === [`press:button.${J}_oppdater`, `press:button.${K}_oppdater`].sort().join() && U.hp.join() === 'success' && U.spin && /pnspin 0\.6s/.test(U.anim) && !U.after, U);
// filter
const FL = await p.evaluate(async () => {
  window.HP.length = 0;
  sr().querySelector('.post .pnch[data-v="klar"]').click(); await sleep(200);
  const t = sr().querySelector('.post .pnch[data-v="klar"]'), cs = getComputedStyle(t), sp = getComputedStyle(t.querySelector('span'));
  const r = { rows: rows().map((x) => x.key), on: t.getAttribute('aria-pressed'), bg: cs.backgroundColor, fg: cs.color, sfg: sp.color, hp: [...window.HP], chip: (sr().querySelector('.sh .pnfc') || {}).textContent };
  sr().querySelector('.post .pnch[data-v="klar"]').click(); await sleep(200);
  r.off = rows().length; r.offOn = sr().querySelectorAll('.pnch.on').length;
  return r;
});
ok('Trykk «Hentes» → filter på Pakker, aktiv = blå fyll + mørk tekst, haptic selection', FL.rows.join() === 'pk-pn:UB222222222SE' && FL.on === 'true' && FL.bg === 'rgb(115, 185, 242)' && FL.fg === 'rgb(40, 40, 40)' && FL.sfg === 'rgb(40, 40, 40)' && FL.hp.join() === 'selection' && /Klar for henting/.test(FL.chip || ''), FL);
ok('Trykk igjen → filteret av', FL.offOn === 0 && FL.off > 1, FL);

// ---------------------------------------------------------------- leveringsrad (pn_row)
const grid = await p.evaluate(() => [...sr().querySelectorAll('.pg .pd')].map((d) => ({ k: d.dataset.v, pn: !!d.querySelector('.pnd'), today: d.classList.contains('today') })));
const dayPn = (grid.find((d) => d.pn && !d.today) || {}).k, dayNo = (grid.find((d) => !d.pn && !d.today) || {}).k;
const RW = async (cfg, day) => p.evaluate(async ({ cfg, day }) => {
  await setCfg({ pn_row: cfg });
  if (day) { sr().querySelector(`.pd[data-v="${day}"]`).click(); await sleep(200); }
  const r = { rows: [...sr().querySelectorAll('.post .pnday')].map((x) => [...x.querySelectorAll('b,.evc>span')].map((y) => y.textContent.trim()).join(' | ')), sub: sr().querySelector('.psub').textContent, kids: [...sr().querySelector('.card.post').children].map((x) => x.className.split(' ')[0]).join() };
  if (day) { sr().querySelector(`.pd[data-v="${day}"]`).click(); await sleep(200); }
  return r;
}, { cfg, day });
ok('Fant dager i rutenettet med og uten levering', !!dayPn && !!dayNo, grid);
const V0 = await RW(undefined, null), V1 = await RW('valgt', dayPn), V2 = await RW('valgt', dayNo);
ok('«Ved valgt dag» (standard): ingen rad uten valgt dag', V0.rows.length === 0 && !/PostNord-levering/.test(V0.sub), V0);
ok('«Ved valgt dag»: valgt dag med levering → raden (mellom rutenettet og chipsene) + « · PostNord-levering» i datolinjen', V1.rows.length === 1 && /^PostNord · …3333SE \| .+ 9–12 · Under transport$/.test(V1.rows[0]) && / · PostNord-levering$/.test(V1.sub) && V1.kids === 'pt,pg,pnday,pnchs', V1);
ok('«Ved valgt dag»: valgt dag uten levering → ingen rad, ingen « · PostNord-levering»', V2.rows.length === 0 && !/PostNord-levering/.test(V2.sub), V2);
const A0 = await RW('alltid', null), A1 = await RW('alltid', dayPn), A2 = await RW('alltid', dayNo);
ok('«Alltid» uten valgt dag → neste PostNord-levering (i dag: Zalando 14–18)', A0.rows.length === 1 && A0.rows[0] === 'PostNord · Zalando | I dag 14–18 · Ute for levering' && A0.kids === 'pt,pg,pnday,pnchs', A0);
ok('«Alltid» med valgt dag → den dagens levering / ingen', A1.rows.length === 1 && /…3333SE/.test(A1.rows[0]) && A2.rows.length === 0, { A1, A2 });
// leveringsmåte fra pakke-sensoren
const LM = await p.evaluate(async () => { const id = `sensor.${window.PN.J}_pakke_ua111111111se`; newHass(); window.__h.states[id] = { ...window.__h.states[id], attributes: { ...window.__h.states[id].attributes, delivery_method: 'Hjemlevering' } }; window.__c.hass = window.__h; await sleep(250); const r = [...sr().querySelectorAll('.post .pnday')].map((x) => x.querySelector('.evc>span').textContent); return r; });
ok('Linja: «<vindu> · <status> · <leveringsmåte>» fra pakke-sensorens attributter', LM.join() === 'I dag 14–18 · Ute for levering · Hjemlevering', LM);
// PostNord-tall av → alt PostNord borte (også med «Alltid» og valgt dag)
const OFF = await p.evaluate(async (day) => {
  await setCfg({ section_hidden: { posten: ['postnord'] } });
  sr().querySelector(`.pd[data-v="${day}"]`).click(); await sleep(200);
  const r = { pn: sr().querySelectorAll('.post .pnchs,.post .pnr,.post .pnd,.post .pnday').length, sub: sr().querySelector('.psub').textContent, card: !!sr().querySelector('.card.post .pg'), hdrBtn: !!sr().querySelector('.sh [data-act="prefresh"]') };
  sr().querySelector(`.pd[data-v="${day}"]`).click(); await sleep(150);
  await setCfg({ section_hidden: undefined, pn_row: undefined });
  return r;
}, dayPn);
ok('«PostNord-tall» av → chips, oppdater, blå prikker og leveringsrad skjult', OFF.pn === 0 && OFF.card && !/PostNord-levering/.test(OFF.sub), OFF);
ok('«PostNord-tall» av → «Oppdater» i Pakker-headeren (som før 42)', OFF.hdrBtn, OFF);

// ---------------------------------------------------------------- editorene
const ED = await p.evaluate(async () => {
  window.__c.customize('faner'); await sleep(500);
  const portal = MSH.portals().pop(), ed = portal.shadowRoot.querySelector('msh-editor'), R = ed.shadowRoot;
  const tb = (v) => [...R.querySelectorAll('[data-a="tab"]')].find((x) => x.dataset.v === v);
  if (tb('faner')) { tb('faner').click(); await sleep(150); }
  R.querySelector('[data-op="exp"][data-v="posten"]').click(); await sleep(150);
  const parts = [...R.querySelectorAll('.kpart')].map((x) => ({ k: x.dataset.edk, t: x.textContent.trim(), drag: !!x.querySelector('[data-edrag]') }));
  R.querySelector('.kpart[data-edk="postnord"] [data-op="peye"]').click(); await sleep(150);
  const hid1 = JSON.parse(JSON.stringify(ed._config.section_hidden || null));
  R.querySelector('.kpart[data-edk="postnord"] [data-op="peye"]').click(); await sleep(150);
  const hid2 = ed._config.section_hidden || null;
  // migrering: gammel id `posten` (kortet skjult) → øyet på «Når kommer Posten» viser det igjen
  ed._config = { ...ed._config, section_hidden: { posten: ['posten'] }, section_order: { posten: ['pakker', 'postnord', 'posten'] } }; ed._render(); await sleep(150);
  const mig = [...R.querySelectorAll('.kpart')].map((x) => x.dataset.edk + (x.style.opacity === '0.5' ? '-' : ''));
  R.querySelector('.kpart[data-edk="kort"] [data-op="peye"]').click(); await sleep(150);
  const hid3 = ed._config.section_hidden || null;
  ed._config = { ...ed._config, section_order: undefined }; delete ed._config.section_order;
  if (tb('visning')) { tb('visning').click(); await sleep(150); }
  const seg = [...R.querySelectorAll('[data-name="pn_row"]')].map((x) => [x.dataset.v, x.textContent.trim(), x.classList.contains('on')]);
  const lab = (R.querySelector('[data-name="pn_row"]') || { closest: () => null }).closest('.f');
  R.querySelector('[data-name="pn_row"][data-v="alltid"]').click(); await sleep(200);
  const v = ed._config.pn_row;
  R.querySelector('[data-name="pn_row"][data-v="valgt"]').click(); await sleep(200);
  const v2 = ed._config.pn_row;
  MSH.portals().forEach((x) => x.shadowRoot.querySelector('.bg') && x.shadowRoot.querySelector('.bg').click()); await sleep(300);
  return { parts, hid1, hid2, mig, hid3, seg, label: lab ? lab.textContent : '', v, v2 };
});
ok('Tilpass → Faner → Posten: «Når kommer Posten» · «PostNord-tall» (uten dra-håndtak) · «Pakker»', ED.parts.map((x) => x.k + ':' + x.t).join('|') === 'kort:Når kommer Posten|postnord:PostNord-tall|pakker:Pakker' && !ED.parts[1].drag && ED.parts[0].drag, ED.parts);
ok('Øyet på «PostNord-tall» → section_hidden.posten = [postnord] (av/på)', JSON.stringify(ED.hid1) === '{"posten":["postnord"]}' && ED.hid2 == null, ED);
ok('Migrering: gammel rekkefølge/skjult (`posten`) → «kort» skjult, PostNord-tall rett etter kortet; øyet viser kortet igjen', ED.mig.join() === 'pakker,kort-,postnord' && ED.hid3 == null, ED);
ok('Tilpass → Visning: «PostNord-levering i Posten» Ved valgt dag (standard) / Alltid → pn_row', ED.seg.map((x) => x.join(':')).join('|') === 'valgt:Ved valgt dag:true|alltid:Alltid:false' && /PostNord-levering i Posten/.test(ED.label) && ED.v === 'alltid' && ED.v2 === 'valgt', ED);
const GUI = await p.evaluate(async () => {
  const ed = customElements.get('msh-kalender-card').getConfigElement(); ed.hass = window.__h; ed.setConfig({ type: 'custom:msh-kalender-card', card_id: 'gui46', pn_row: 'alltid' }); document.body.appendChild(ed);
  await sleep(200);
  const R = ed.shadowRoot, out = [];
  ed.addEventListener('config-changed', (e) => out.push(e.detail.config.pn_row));
  const tb = [...R.querySelectorAll('[data-a="tab"]')].find((t) => t.dataset.v === 'visning'); if (tb) { tb.click(); await sleep(150); }
  const seg = [...R.querySelectorAll('[data-name="pn_row"]')].map((x) => [x.dataset.v, x.classList.contains('on')]);
  R.querySelector('[data-name="pn_row"][data-v="valgt"]').click(); await sleep(250);
  const tf = [...R.querySelectorAll('[data-a="tab"]')].find((t) => t.dataset.v === 'faner'); if (tf) { tf.click(); await sleep(150); }
  const ex = R.querySelector('[data-op="exp"][data-v="posten"]'); if (ex) { ex.click(); await sleep(150); }
  const parts = [...R.querySelectorAll('.kpart')].map((x) => x.dataset.edk);
  ed.remove();
  return { seg, out, parts };
});
ok('GUI-editor: pn_row vises (Alltid valgt fra YAML) og lagres (config-changed)', GUI.seg.map((x) => x.join(':')).join('|') === 'valgt:false|alltid:true' && GUI.out.includes('valgt'), GUI);
ok('GUI-editor: Faner → Posten har kort · postnord · pakker', GUI.parts.join() === 'kort,postnord,pakker', GUI);
// kortet følger config fra editoren
const SY = await p.evaluate(async () => { await setCfg({ pn_row: 'alltid' }); const a = sr().querySelectorAll('.post .pnday').length; await setCfg({ pn_row: 'valgt' }); const b2 = sr().querySelectorAll('.post .pnday').length; await setCfg({ pn_row: undefined }); return [a, b2]; });
ok('Kortet følger pn_row (alltid → rad, valgt → ingen uten valgt dag)', SY.join() === '1,0', SY);
await p.close();

// ---------------------------------------------------------------- mangler data
{
  const q = await page(false);
  const M0 = await q.evaluate(() => ({ kids: [...sr().querySelector('.card.post').children].map((x) => x.className.split(' ')[0]).join(), dots: sr().querySelectorAll('.pnd').length }));
  ok('Ingen PostNord → ingen chips/oppdater/prikker (kortet som før)', M0.kids === 'pt,pg' && M0.dots === 0, M0);
  await q.close();
}
{
  const q = await page(true, { src: { post: 'none' }, pn_row: 'alltid' });
  const M1 = await q.evaluate(() => { const c = sr().querySelector('.card.post'); return { rel: c.querySelector('.prel').textContent, miss: (c.querySelector('.miss') || {}).textContent || '', chips: c.querySelectorAll('.pnch').length, row: c.querySelectorAll('.pnday').length, chip: !!c.querySelector('.pchip'), title: c.querySelector('.ptl').textContent.trim() }; });
  if (SHOT) await q.screenshot({ path: SHOT + '/k46-utenpost.png' });
  ok('Ingen «Når kommer Posten»-sensor → toppen «–» + «Velg entitet», chips og leveringsrad vises', M1.rel === '–' && /^–\s*·\s*Velg entitet/.test(M1.miss.replace(/\s+/g, ' ').trim()) && M1.chips === 4 && M1.row === 1 && M1.title === 'Når kommer Posten' && !M1.chip, M1);
  await q.close();
}

const hex = execFileSync('node', ['test/hex-count.mjs', 'src/55-kalender.js']).toString();
ok('Ingen hardkodede farger i 55-kalender.js', /55-kalender\.js\s*\|\s*0\s*\|/.test(hex), hex);
ok('Ingen sidefeil', errs.length === 0, errs);
await b.close();
try { rmSync(bundle); } catch (e) { /* */ }
console.log(fails ? `\n${fails} feilet` : '\nAlle bestod');
process.exit(fails ? 1 : 0);
