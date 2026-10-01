// Fiks 29 · Innstillinger: brytere fra KI Varslinger + KI Energi (autofunn + velg integrasjoner). «Sjekk før levering»:
//  · ingen mockrader – alle rader kommer fra registeret (MSH.finnBrytere, src/06-varsling-kilde.js)
//  · ny regel i KI Varslinger / ny varselbryter i KI Energi dukker opp uten reload (tegner bare når [id, på] endres)
//  · slå av/på en integrasjon i Tilpass → fanen oppdateres straks; samme valg i GUI-editoren (ha-form + ekko-vakt)
//  · KI Energi: alle sidestilte varselbrytere (ikke styring), KI Varslinger: én hovedbryter per regel
//  · hold = more-info, trykk = toggle (optimistisk + tilbakerulling), én haptic, popupen lukkes ikke ved trykk/drag
//  · ki-varsling-card (ki-cards, uendret) gir nøyaktig samme brytere som modulen – samme logikk, ingen duplikat i ki-msh
// Klokka styres med MSH.innstNow (ingen avhengighet av tidspunktet testen kjøres).
//   node test/innstillinger29-check.mjs   (SHOTS=<mappe> for skjermbilder)
import { createRequire } from 'node:module';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const bundle = resolve(`test/.build/innst29-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const KI_VARSLING = process.env.KI_VARSLING || '/home/user/ki-cards/src/83-ki-varsling-card.js';
const shots = process.env.SHOTS || '';
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const res = {}, fail = [];
const ok = (name, cond, info) => { res[name] = cond ? 'OK' : ['FEIL', info]; if (!cond) fail.push(name); };
const mocks = readdirSync('test/mock').sort().map((m) => resolve('test/mock/' + m));
const errs = [];
// o: { vp, haForm (stub-ha-form før bundelen), kiVarsling (last ki-cards' ki-varsling-card) }
async function page(cfg, o = {}) {
  const p = await b.newPage({ viewport: o.vp || { width: 390, height: 900 }, hasTouch: true });
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + resolve('test/harness.html'));
  if (o.haForm) await p.evaluate(() => {
    // Minimal ha-form som HA sin: styres av data/schema, sender value-changed. Teller hvor ofte data settes (ekko-vakten).
    customElements.define('ha-form', class extends HTMLElement { set data(v) { this._d = v; this.sets = (this.sets || 0) + 1; } get data() { return this._d; } set schema(v) { this._s = v; this.schemaSets = (this.schemaSets || 0) + 1; } get schema() { return this._s; } });
  });
  for (const m of mocks) await p.addScriptTag({ path: m });
  await p.addScriptTag({ path: bundle });
  if (o.kiVarsling && existsSync(KI_VARSLING)) await p.addScriptTag({ path: KI_VARSLING });
  await p.evaluate(async (cfg) => {
    window.MSH.innstNow = () => new Date(2026, 0, 15, 14, 0);
    window.__h = window.mockHass();
    window.__hap = []; window.addEventListener('haptic', (e) => window.__hap.push(e.detail));
    window.__more = []; window.addEventListener('hass-more-info', (e) => window.__more.push(e.detail.entityId));
    const bc = document.createElement('bubble-card');
    bc.setConfig({ type: 'custom:bubble-card', card_type: 'pop-up', hash: '#settings' });
    bc.innerHTML = '<div class="pop"><div class="hdr">Innstillinger</div><div class="inner"></div></div>';
    document.getElementById('dash').appendChild(bc);
    window.__bubble = []; ['pointerdown', 'touchstart', 'touchmove'].forEach((t) => bc.addEventListener(t, () => window.__bubble.push(t)));
    location.hash = '#settings';
    const c = document.createElement('msh-innstillinger-card');
    c.setConfig({ type: 'custom:msh-innstillinger-card', card_id: 'pop-innstillinger', dashbord: false, ...(cfg || {}) });
    c.hass = window.__h;
    bc.querySelector('.inner').appendChild(c);
    window.__c = c;
    window.__bc = bc;
    await new Promise((q) => setTimeout(q, 500));
  }, cfg || {});
  return p;
}
const wait = (p, ms) => p.evaluate((ms) => new Promise((q) => setTimeout(q, ms)), ms);
const shot = async (p, n) => { if (shots) await p.screenshot({ path: `${shots}/innst29-${n}.png`, fullPage: true }); };
const rowsOf = (p) => p.evaluate(() => [...window.__c.shadowRoot.querySelectorAll('.lst .pr')].map((r) => ({ id: r.dataset.id, n: r.querySelector('.pt b').textContent.trim(), s: r.querySelector('.pt i').textContent.trim(), on: r.getAttribute('aria-checked') === 'true', borte: r.classList.contains('borte') })));
const tab = async (p, k) => { await p.evaluate((k) => window.__c.shadowRoot.querySelector(`.bar .tb[data-v="${k}"]`).click(), k); await wait(p, 250); };
const openEd = (p) => p.evaluate(async () => {
  window.__c.shadowRoot.querySelector('.bar .gear').click(); await new Promise((q) => setTimeout(q, 600));
  const find = (root) => { for (const x of root.querySelectorAll('*')) { if (x.localName === 'msh-editor') return x; if (x.shadowRoot) { const y = find(x.shadowRoot); if (y) return y; } } return null; };
  window.__ed = find(window.MSH.overlayRoot()); return !!window.__ed;
});
const edClick = async (p, sel) => { await p.evaluate((sel) => window.__ed.shadowRoot.querySelector(sel).click(), sel); await wait(p, 250); };

// ================================================================ 29.1 · én kilde, ingen duplikat, ki-varsling-card = samme resultat
{
  const src = readdirSync('src').filter((f) => f.endsWith('.js')).map((f) => [f, readFileSync('src/' + f, 'utf8')]);
  const tekst = src.filter(([, s]) => /KI_VARS_TEKST\s*=\s*\[/.test(s)).map(([f]) => f), master = src.filter(([, s]) => s.includes('alle[ _-]?varsler|_aktivert$')).map(([f]) => f);
  const mock = src.filter(([, s]) => /\b(ITEMS|KIV)\s*[=:[]/.test(s)).map(([f]) => f);
  ok('29.1 én delt modul: KI_VARS_TEKST/erMaster finnes bare i src/06-varsling-kilde.js (ingen kopi i 60-innstillinger), ingen ITEMS/KIV-mock', tekst.join() === '06-varsling-kilde.js' && master.join() === '06-varsling-kilde.js' && !mock.length, { tekst, master, mock });
  const p = await page({}, { kiVarsling: true });
  const V = await p.evaluate(() => {
    const M = window.MSH, h = window.__h;
    if (!customElements.get('ki-varsling-card')) return { missing: true };
    const cfgs = [{}, { plattform: ['ki_notifications'] }, { plattform: ['ki_energi'] }, { enheter: ['lås', 'ansikt', 'vekking', 'dørlys', 'utelys'], plattform: ['ki_notifications', 'ki_energi', 'ki_utelys'] },
      { ikke_enheter: ['lås', 'ansikt', 'vekking', 'dørlys', 'ki energi'] }, { enheter: ['ki energi'] }, { master: false }, { kjente: false }, { bare: ['alarm_alle_varsler', 'autolas_autolas', 'ki_varsel_effekt'] },
      { skjul: ['heimdall', 'switch.planter_varsling'] }, { ekstra: ['switch.stue_peis', 'input_boolean.varsel_dor_last'] }, { plattform: ['ki_utelys'], ikke_master: [] }, { navn: { autolas_autolas: 'Lås' }, undertekst: { heimdall: 'Synk' }, ikoner: { heimdall: 'mdi:sync-alert' }, skille: ' - ' }];
    const out = cfgs.map((cfg) => {
      const k = document.createElement('ki-varsling-card'); k.setConfig(cfg); k._h = h;
      const a = JSON.stringify(k._brytere()), m = JSON.stringify(M.finnBrytere(h, cfg));
      return { cfg: JSON.stringify(cfg), same: a === m, n: JSON.parse(m).length };
    });
    // tabellene er de samme (globale const i ki-cards-skriptet)
    const tab = (T) => T.map((x) => x.map(String).join('|')).join('\n');
    // eslint-disable-next-line no-undef
    const tabeller = tab(KI_VARS_TEKST) === tab(M.KI_VARS_TEKST) && tab(KI_VARS_IKON) === tab(M.KI_VARS_IKON);
    return { out, tabeller };
  });
  ok('29.1 ki-varsling-card (ki-cards, uendret) og MSH.finnBrytere gir identiske brytere for 13 configer (plattform, enheter, ikke_enheter, master, kjente, bare, skjul, ekstra, navn …) + samme tabeller', !V.missing && V.out.every((x) => x.same) && V.out[0].n > 10 && V.tabeller, V);
  // kilde = registeret: alle rader finnes i hass.entities med valgt plattform (eller er ekstra)
  const R = await p.evaluate(() => { const M = window.MSH, h = window.__h, F = M.innstFaner({}); return F.map((t) => ({ k: t.key, P: t.plattform, rows: M.innstRows(h, {}, t.key).map((r) => [r.id, (h.entities[r.id] || {}).platform, r.kilde]) })); });
  ok('29.2 ingen mockrader: hver rad er en switch/input_boolean i entitetsregisteret med fanens plattform', R.every((t) => t.rows.length && t.rows.every(([id, pl, k]) => k === 'integrasjon' && /^(switch|input_boolean)\./.test(id) && t.P.includes(pl))), R);
  await p.close();
}

// ================================================================ 29.2 · standardfanene, hovedbryter, KI Energi, live
{
  const p = await page();
  const T = await p.evaluate(() => { const M = window.MSH, h = window.__h, r = (k) => M.innstRows(h, {}, k); return { faner: M.innstFanerOut(M.innstFaner({})), sik: r('sikkerhet').map((x) => x.id), hjem: r('hjem').map((x) => x.id), strom: r('strom').map((x) => x.id) }; });
  ok('29.2 standardfaner som ki-varsling-card-configer: Sikkerhet (ki_notifications, enheter = kjente regler), Hjem (samme som ikke_enheter), Strøm (ki_energi)', T.faner.map((t) => `${t.key}:${t.name}:${t.plattform.join('+')}`).join() === 'sikkerhet:Sikkerhet:ki_notifications,hjem:Hjem:ki_notifications,strom:Strøm:ki_energi' && T.faner[0].enheter.join() === T.faner[1].ikke_enheter.join() && /Autolås.*Fastkjørt.*Dørlys.*Alarm.*Heimdall.*Ansikt/.test(T.faner[0].enheter.join()), T.faner);
  ok('29.1 KI Varslinger: én hovedbryter per regel (Alarm = alle_varsler, Vekking = _aktivert, Ansikt = _aktivert); uten hovedbryter vises alle (Støvsuger)', T.sik.includes('switch.alarm_alle_varsler') && !T.sik.some((x) => /alarm_(ved|sirene)/.test(x)) && T.hjem.includes('switch.vekking_aktivert') && !T.hjem.includes('switch.vekking_lyd') && T.sik.includes('switch.ansiktsgjenkjenning_aktivert') && !T.sik.includes('switch.ansiktsgjenkjenning_varsle') && T.hjem.filter((x) => /stovsuger/.test(x)).length === 2, T);
  ok('29.1 KI Energi: alle 9 sidestilte varselbrytere (varsel/varsler/spor_), ingen styringsbrytere (ki_styr_*, skyggemodus, hovedbryter …)', T.strom.length === 9 && T.strom.every((x) => /varsel|varsler|spor_/.test(x)) && !T.strom.some((x) => /ki_styr_|skyggemodus|ki_energi_hovedbryter|sommermodus$/.test(x)), T.strom);
  // live: ny regel i KI Varslinger + ny varselbryter i KI Energi (+ ny styringsbryter som IKKE skal med), uten reload
  await tab(p, 'hjem');
  const L = await p.evaluate(async () => {
    const w = (ms) => new Promise((q) => setTimeout(q, ms)), h = window.__h, sr = window.__c.shadowRoot;
    let renders = 0; const orig = window.__c.render.bind(window.__c); window.__c.render = () => { renders++; return orig(); };
    // registeret får ny identitet uten endring → ingen ny tegning
    window.__h = { ...h, entities: { ...h.entities }, devices: { ...h.devices } }; window.__c.hass = window.__h; await w(200);
    const r0 = renders;
    const S = { ...window.__h.states }, E = { ...window.__h.entities }, D = { ...window.__h.devices };
    D.n_vaer = { id: 'n_vaer', name: 'Værmelding', name_by_user: null, model: 'Regel', entry_type: 'service' };
    S['switch.vaermelding_ai_aktivert'] = { entity_id: 'switch.vaermelding_ai_aktivert', state: 'on', attributes: { friendly_name: 'Værmelding - Aktivert' } };
    E['switch.vaermelding_ai_aktivert'] = { entity_id: 'switch.vaermelding_ai_aktivert', platform: 'ki_notifications', device_id: 'n_vaer' };
    S['switch.vaermelding_ai_lyd'] = { entity_id: 'switch.vaermelding_ai_lyd', state: 'on', attributes: { friendly_name: 'Værmelding - Lyd' } };
    E['switch.vaermelding_ai_lyd'] = { entity_id: 'switch.vaermelding_ai_lyd', platform: 'ki_notifications', device_id: 'n_vaer' };
    S['switch.ki_varsel_frost'] = { entity_id: 'switch.ki_varsel_frost', state: 'on', attributes: { friendly_name: 'KI Varsel Frost' } };
    E['switch.ki_varsel_frost'] = { entity_id: 'switch.ki_varsel_frost', platform: 'ki_energi', device_id: 'dev_ki_energi' };
    S['switch.ki_styr_garasje'] = { entity_id: 'switch.ki_styr_garasje', state: 'on', attributes: { friendly_name: 'KI styrer garasje' } };
    E['switch.ki_styr_garasje'] = { entity_id: 'switch.ki_styr_garasje', platform: 'ki_energi', device_id: 'dev_ki_energi' };
    window.__h = { ...window.__h, states: S, entities: E, devices: D }; window.__c.hass = window.__h; await w(250);
    const hjem = [...sr.querySelectorAll('.lst .pr')].map((r) => r.dataset.id), r1 = renders;
    sr.querySelector('.bar .tb[data-v="strom"]').click(); await w(250);
    const strom = [...sr.querySelectorAll('.lst .pr')].map((r) => r.dataset.id);
    window.__c.render = orig;
    return { r0, r1, hjem, strom };
  });
  ok('29.1 live: ny regel i KI Varslinger (Værmelding, hovedbryter _aktivert) og ny varselbryter i KI Energi dukker opp uten reload – styringsbryteren ikke', L.hjem.includes('switch.vaermelding_ai_aktivert') && !L.hjem.includes('switch.vaermelding_ai_lyd') && L.strom.includes('switch.ki_varsel_frost') && !L.strom.includes('switch.ki_styr_garasje') && L.strom.length === 10, L);
  ok('29.1 live: registeret med ny identitet men samme brytere ([id, på]) → ingen ny tegning; endret brytersett → ny tegning', L.r0 === 0 && L.r1 >= 1, L);
  // borte → dempet + «Svarer ikke»
  await p.evaluate(async () => { const h = window.__h; window.__h = { ...h, states: { ...h.states, 'switch.ki_varsel_vvb': { ...h.states['switch.ki_varsel_vvb'], state: 'unavailable' } } }; window.__c.hass = window.__h; await new Promise((q) => setTimeout(q, 800)); }); // etter inn-fadingen
  const B = await p.evaluate(() => { const r = window.__c.shadowRoot.querySelector('.pr[data-id="switch.ki_varsel_vvb"]'); return { cls: r.className, op: getComputedStyle(r).opacity, s: r.querySelector('.pt i').textContent.trim() }; });
  ok('29.1 utilgjengelig (borte) → raden dempes (opasitet .45), undertekst «Svarer ikke»', /\bborte\b/.test(B.cls) && Math.abs(Number(B.op) - 0.45) < 0.01 && B.s === 'Svarer ikke', B);
  await shot(p, '1-strom');
  await p.close();
}

// ================================================================ 29.2 · trykk = toggle (optimistisk), hold = more-info, haptic, popupen står
{
  const p = await page();
  const id = 'switch.alarm_alle_varsler';
  await p.evaluate(() => { window.__calls.length = 0; window.__hap.length = 0; window.__bubble.length = 0; });
  const row = p.locator(`msh-innstillinger-card .pr[data-id="${id}"]`);
  await row.click();
  await wait(p, 150);
  const T1 = await p.evaluate((id) => ({ calls: window.__calls.filter((c) => c[2] && c[2].entity_id).map((c) => `${c[0]}.${c[1]}:${c[2].entity_id}`), hap: window.__hap.slice(), on: window.__c.shadowRoot.querySelector(`.pr[data-id="${id}"]`).getAttribute('aria-checked'), bubble: window.__bubble.slice(), more: window.__more.slice(), hash: location.hash }), id);
  ok('29.2 trykk = homeassistant.toggle, raden byttes straks (optimistisk), nøyaktig én haptic (selection), ingen more-info', T1.calls.join() === `homeassistant.toggle:${id}` && T1.on === 'false' && T1.hap.join() === 'selection' && !T1.more.length, T1);
  ok('29.2 trykk på raden når ikke popupen (pointerdown stoppes før Bubble Card – swipe-to-close/lukking trigges ikke)', !T1.bubble.includes('pointerdown') && T1.hash === '#settings', T1);
  // tilbakerulling når hass ikke bekrefter
  await p.evaluate(() => { window.MSH.innstSyncMs = 500; });
  await p.evaluate(() => { window.__c.shadowRoot.querySelector('.pr[data-id="switch.planter_varsling"]') || window.__c.shadowRoot.querySelector('.bar .tb[data-v="hjem"]').click(); });
  await wait(p, 200);
  await p.evaluate(() => { window.__hap.length = 0; window.__c.shadowRoot.querySelector('.pr[data-id="switch.planter_varsling"]').click(); });
  await wait(p, 100);
  const O1 = await p.evaluate(() => window.__c.shadowRoot.querySelector('.pr[data-id="switch.planter_varsling"]').getAttribute('aria-checked'));
  await wait(p, 700);
  const O2 = await p.evaluate(() => ({ on: window.__c.shadowRoot.querySelector('.pr[data-id="switch.planter_varsling"]').getAttribute('aria-checked'), hap: window.__hap.slice(), toast: (window.MSH.overlayRoot().querySelector('#msh-toast') || {}).textContent || '' }));
  ok('29.2 ingen bekreftelse innen fristen → raden rulles tilbake + melding + haptic warning (27.6)', O1 === 'false' && O2.on === 'true' && /rullet tilbake/.test(O2.toast) && O2.hap.includes('warning'), { O1, O2 });
  // hold 500 ms = more-info (mus), ingen toggle
  await p.evaluate(() => { window.__calls.length = 0; window.__hap.length = 0; window.__more.length = 0; window.__bubble.length = 0; });
  const r2 = p.locator('msh-innstillinger-card .pr[data-id="switch.planter_varsling"]'), bb = await r2.boundingBox();
  await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await p.mouse.down(); await wait(p, 420);
  const early = await p.evaluate(() => window.__more.length);
  await wait(p, 200); await p.mouse.up(); await wait(p, 200);
  const H = await p.evaluate(() => ({ more: window.__more.slice(), calls: window.__calls.filter((c) => c[2] && c[2].entity_id).length, hap: window.__hap.slice(), bubble: window.__bubble.slice() }));
  ok('29.2 hold 500 ms = more-info for bryteren (ikke før), ingen toggle, én haptic (medium), popupen får ikke pointerdown', early === 0 && H.more.join() === 'switch.planter_varsling' && H.calls === 0 && H.hap.join() === 'medium' && !H.bubble.includes('pointerdown'), { early, H });
  // touch: trykk + dra på raden når ikke Bubble Card (touchstart/touchmove stoppes), CSS touch-action pan-y
  const TD = await p.evaluate(() => {
    window.__bubble.length = 0;
    const r = window.__c.shadowRoot.querySelector('.pr[data-id="switch.planter_varsling"]'), rc = r.getBoundingClientRect();
    const t = (y) => new Touch({ identifier: 1, target: r, clientX: rc.left + 40, clientY: y });
    r.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, composed: true, touches: [t(rc.top + 20)], changedTouches: [t(rc.top + 20)] }));
    r.dispatchEvent(new TouchEvent('touchmove', { bubbles: true, composed: true, touches: [t(rc.top + 120)], changedTouches: [t(rc.top + 120)] }));
    return { bubble: window.__bubble.slice(), ta: getComputedStyle(r).touchAction };
  });
  ok('29.2 dra på raden (touch): touchstart/touchmove når ikke Bubble Card (swipe-to-close), touch-action pan-y (listen scroller)', !TD.bubble.length && TD.ta === 'pan-y', TD);
  await p.close();
}

// ================================================================ 29.3 · Tilpass → Faner: Integrasjoner, filter, ekstra, visning
{
  const p = await page();
  await openEd(p);
  await edClick(p, '[data-op="texp"][data-v="strom"]');
  const I = await p.evaluate(() => { const sr = window.__ed.shadowRoot, ifp = sr.querySelector('.ifp'); const plat = [...ifp.querySelectorAll('[data-key^="ifs-plat"] .iprow')].map((r) => ({ t: r.querySelector('.ipn b').textContent.trim(), on: r.querySelector('.sw').classList.contains('on'), bg: getComputedStyle(r.querySelector('.sw.on') || r.querySelector('.sw')).backgroundColor })); return { plat, secs: [...ifp.querySelectorAll('.ifs>.lb')].map((x) => x.textContent.trim()), cnt: ifp.querySelector('.icount').textContent.trim(), bg: getComputedStyle(ifp.querySelector('.ifs')).backgroundColor, r: getComputedStyle(ifp.querySelector('.ifs')).borderRadius }; });
  const n = I.plat.map((x) => Number((/\((\d+)/.exec(x.t) || [])[1]));
  ok('29.3 Integrasjoner: alle plattformer med switch/input_boolean, flest først, «KI Energi (52 · 9 varsler)», «KI Varslinger (21)», bryter per plattform (rosa = på)', I.plat.some((x) => x.t === 'KI Varslinger (21)') && I.plat.some((x) => /^KI Energi \(\d+ · 9 varsler\)$/.test(x.t)) && I.plat.some((x) => x.t === 'KI Utelys (3)') && n.every((v, i) => !i || v <= n[i - 1]) && I.plat.filter((x) => x.on).map((x) => x.t).join().startsWith('KI Energi') && I.plat.filter((x) => x.on).length === 1, I);
  ok('29.3 fanepanelet: Integrasjoner · Bare disse · Ikke disse · Ekstra brytere · Visning · Ikon, «Viser 9 brytere», arkets indre flate', I.secs.join('|').startsWith('Integrasjoner|Bare disse') && I.secs.includes('Ekstra brytere') && I.secs.includes('Visning') && I.cnt === 'Viser 9 brytere' && I.bg === 'rgb(40, 40, 40)', I);
  // slå på KI Utelys i Strøm → fanen oppdateres straks (hovedbryteren _auto)
  await tab(p, 'strom');
  await edClick(p, '.ifp [data-op="fplat"][data-p="ki_utelys"]');
  const U = await p.evaluate(() => ({ cfg: window.__ed._config.faner.find((t) => t.key === 'strom'), rows: [...window.__c.shadowRoot.querySelectorAll('.lst .pr')].map((r) => r.dataset.id), cnt: window.__ed.shadowRoot.querySelector('.icount').textContent.trim(), old: window.__ed._config.tabs }));
  ok('29.3 slå på KI Utelys → faner[strom].plattform, fanen i kortet oppdateres straks (Utelys automatikk = hovedbryteren), «Viser 10 brytere»', U.cfg.plattform.join() === 'ki_energi,ki_utelys' && U.rows.includes('switch.ki_utelys_auto') && !U.rows.includes('switch.ki_utelys_kveld') && U.rows.length === 10 && U.cnt === 'Viser 10 brytere' && !U.old, U);
  // Bare disse: live forhåndsvisning per tastetrykk (samme felt, ingen ny tegning), lagres ved change
  const F = await p.evaluate(async () => {
    const sr = window.__ed.shadowRoot, w = (ms) => new Promise((q) => setTimeout(q, ms));
    const i = sr.querySelector('input[data-inn="fikke"][data-v="strom"]'); i.focus(); i.value = 'KI Utelys'; i.dispatchEvent(new Event('input', { bubbles: true, composed: true })); await w(150);
    const live = sr.querySelector('.icount').textContent.trim(), same = sr.querySelector('input[data-inn="fikke"][data-v="strom"]') === i && sr.activeElement === i, cfg0 = window.__ed._config.faner.find((t) => t.key === 'strom').ikke_enheter;
    i.dispatchEvent(new Event('change', { bubbles: true, composed: true })); await w(250);
    return { live, same, cfg0, cfg1: window.__ed._config.faner.find((t) => t.key === 'strom').ikke_enheter, rows: window.__c.shadowRoot.querySelectorAll('.lst .pr').length };
  });
  ok('29.3 Ikke disse: «Viser N brytere» oppdateres per tastetrykk uten ny tegning (feltet beholder fokus), lagres ved change → faner[].ikke_enheter', F.live === 'Viser 9 brytere' && F.same && !F.cfg0 && F.cfg1.join() === 'KI Utelys' && F.rows === 9, F);
  // Ekstra brytere: søk → automation/input_boolean, fjern
  const X = await p.evaluate(async () => {
    const sr = window.__ed.shadowRoot, w = (ms) => new Promise((q) => setTimeout(q, ms));
    const q = sr.querySelector('.ifp [data-edq^="inn-x-"]'); q.value = 'varsel dor'; q.dispatchEvent(new Event('input', { bubbles: true, composed: true })); await w(250);
    const hits = [...sr.querySelectorAll('.ifp [data-op="xadd"]')].map((x) => x.dataset.x);
    sr.querySelector('.ifp [data-op="xadd"][data-x="input_boolean.varsel_dor_last"]').click(); await w(250);
    const cfg = window.__ed._config.faner.find((t) => t.key === 'strom').ekstra, rows = [...window.__c.shadowRoot.querySelectorAll('.lst .pr')].map((r) => r.dataset.id), chips = [...sr.querySelectorAll('.ifp .ixch button')].map((x) => x.dataset.x);
    sr.querySelector('.ifp .ixch [data-op="xrm"]').click(); await w(250);
    return { hits, cfg, rows, chips, after: window.__ed._config.faner.find((t) => t.key === 'strom').ekstra };
  });
  ok('29.3 Ekstra brytere: søk (switch/input_boolean/automation) → faner[].ekstra, raden dukker opp straks; × fjerner', X.hits.includes('input_boolean.varsel_dor_last') && X.cfg.join() === 'input_boolean.varsel_dor_last' && X.rows.includes('input_boolean.varsel_dor_last') && X.chips.join() === 'input_boolean.varsel_dor_last' && X.after === undefined, X);
  // Visning: hovedbryter av (Sikkerhet → Alarm med alle tre), kjente navn av, søkefelt av
  await tab(p, 'sikkerhet');
  await edClick(p, '[data-op="texp"][data-v="sikkerhet"]');
  await edClick(p, '.ifp [data-op="fvis"][data-p="master"]');
  const V1 = await p.evaluate(() => ({ cfg: window.__ed._config.faner.find((t) => t.key === 'sikkerhet').master, rows: [...window.__c.shadowRoot.querySelectorAll('.lst .pr')].map((r) => r.dataset.id).filter((x) => /alarm/.test(x)) }));
  await edClick(p, '.ifp [data-op="fvis"][data-p="kjente"]');
  await edClick(p, '.ifp [data-op="fvis"][data-p="sok"]');
  const V2 = await p.evaluate(() => ({ f: window.__ed._config.faner.find((t) => t.key === 'sikkerhet'), names: [...window.__c.shadowRoot.querySelectorAll('.lst .pr .pt b')].map((x) => x.textContent.trim()), srch: !!window.__c.shadowRoot.querySelector('.srch') }));
  ok('29.3 Visning: «Bare hovedbryter» av → alle brytere i regelen; «Kjente navn» av → integrasjonens navn; «Søkefelt» av → ingen søk (master/kjente/sok: false i fanen)', V1.cfg === false && V1.rows.length === 3 && V2.f.kjente === false && V2.f.sok === false && V2.names.includes('Alarm') && !V2.names.includes('Fastkjørt lås') && V2.names.includes('Dørlås fastkjørt') && !V2.srch, { V1, V2 });
  await shot(p, '2-fanepanel');
  await p.close();
}

// ================================================================ 29.3 · «Legg til fane» + tom kilde + «Velg integrasjoner»
{
  const p = await page();
  await openEd(p);
  await edClick(p, '[data-op="ntopen"]');
  const N = await p.evaluate(async () => {
    const sr = window.__ed.shadowRoot, w = (ms) => new Promise((q) => setTimeout(q, ms));
    const pl0 = [...sr.querySelectorAll('.ntp [data-op="fplat"].on')].map((x) => x.dataset.p);
    sr.querySelector('.ntp [data-op="fplat"][data-p="ki_notifications"]').click(); await w(200);
    sr.querySelector('.ntp [data-op="fplat"][data-p="ki_utelys"]').click(); await w(200);
    const enh = [...sr.querySelectorAll('.ntp [data-op="nenh"]')].map((x) => x.dataset.x + ':' + x.querySelector('.nm i').textContent.trim()), cnt = sr.querySelector('.ntp .icount').textContent.trim();
    const nm = sr.querySelector('input[data-inn="ntname"]'); nm.value = 'Ute'; nm.dispatchEvent(new Event('input', { bubbles: true, composed: true })); await w(100);
    sr.querySelector('.ntp [data-op="fvis"][data-p="master"]').click(); await w(200);
    const cnt2 = sr.querySelector('.ntp .icount').textContent.trim();
    sr.querySelector('[data-op="nticon"][data-ic="mdi:garage"]').click(); await w(150);
    sr.querySelector('[data-op="ntadd"]').click(); await w(300);
    const f = window.__ed._config.faner.find((t) => t.key === 'f_ute');
    window.__c.shadowRoot.querySelector('.bar .tb[data-v="f_ute"]').click(); await w(250);
    return { pl0, enh, cnt, cnt2, f, rows: [...window.__c.shadowRoot.querySelectorAll('.lst .pr')].map((r) => r.dataset.id), tabs: [...window.__c.shadowRoot.querySelectorAll('.bar .tb')].map((t) => t.getAttribute('aria-label')) };
  });
  ok('29.3 «Legg til fane»: integrasjoner (KI Utelys), enhetene med antall, «Viser N brytere», hovedbryter av → ny fane fylles umiddelbart', N.pl0.join() === 'ki_notifications' && N.enh.join() === 'KI Utelys:1 bryter' && N.cnt === 'Viser 1 bryter' && N.cnt2 === 'Viser 3 brytere' && N.f && N.f.name === 'Ute' && N.f.icon === 'mdi:garage' && N.f.plattform.join() === 'ki_utelys' && N.f.master === false && N.rows.length === 3 && N.tabs.join() === 'Sikkerhet,Hjem,Strøm,Ute', N);
  await p.close();
  // tom kilde
  const q = await page({ faner: [{ key: 'sikkerhet', name: 'Sikkerhet', icon: 'mdi:shield', plattform: ['ki_finnes_ikke'] }, { key: 'strom', name: 'Strøm', icon: 'mdi:lightning-bolt', plattform: ['ki_energi'] }] });
  const E = await q.evaluate(() => { const e = window.__c.shadowRoot.querySelector('.pane .empty'); return { t: e && e.textContent.replace(/\s+/g, ' ').trim(), rows: window.__c.shadowRoot.querySelectorAll('.lst .pr').length }; });
  ok('29.2 tom kilde: «Fant ingen brytere fra valgte integrasjoner» + «Velg integrasjoner», ingen rader (aldri mock)', /Fant ingen brytere fra valgte integrasjoner/.test(E.t) && /Velg integrasjoner/.test(E.t) && E.rows === 0, E);
  await q.evaluate(() => window.__c.shadowRoot.querySelector('.pane .empty [data-act="pickint"]').click()); await wait(q, 600);
  await q.evaluate(() => { const find = (root) => { for (const x of root.querySelectorAll('*')) { if (x.localName === 'msh-editor') return x; if (x.shadowRoot) { const y = find(x.shadowRoot); if (y) return y; } } return null; }; window.__ed = find(window.MSH.overlayRoot()); });
  const P = await q.evaluate(() => { const sr = window.__ed.shadowRoot; return { tab: (sr.querySelector('.chips.sg.tabs .chip.on') || {}).textContent, open: [...sr.querySelectorAll('[data-op="texp"][aria-expanded="true"]')].map((x) => x.dataset.v), plat: !!sr.querySelector('.ifp [data-op="fplat"][data-p="ki_notifications"]') }; });
  ok('29.2 «Velg integrasjoner» åpner Tilpass → Faner med fanens Integrasjoner-panel åpent', /Faner/.test(P.tab || '') && P.open.join() === 'sikkerhet' && P.plat, P);
  await q.close();
}

// ================================================================ 29.2 · migrering tabs/custom_tabs → faner (én gang), gamle nøkler leses
{
  const old = { tabs: [{ key: 'hjem', title: 'Push varsler' }, { key: 'sikkerhet' }, { key: 'strom', hidden: true }, { key: 'v_kamera' }], custom_tabs: [{ key: 'v_kamera', name: 'Kamera', icon: 'mdi:video', source: 'kamera' }], rows: { include: ['switch.stue_peis'], move: { 'switch.stue_peis': 'sikkerhet' }, exclude: ['n_alarm'] } };
  const p = await page(old);
  const M0 = await p.evaluate(() => ({ tabs: [...window.__c.shadowRoot.querySelectorAll('.bar .tb')].map((t) => t.getAttribute('aria-label')), kam: window.MSH.innstRows(window.__h, window.__c.config, 'v_kamera').map((r) => r.name), hjem: window.MSH.innstRows(window.__h, window.__c.config, 'hjem').map((r) => r.name), sik: window.MSH.innstRows(window.__h, window.__c.config, 'sikkerhet').map((r) => r.name) }));
  ok('29.2 eldre nøkler leses: tabs (tittel, rekkefølge, skjult) + custom_tabs (kategori → enheter) + rows.include (→ ekstra)', M0.tabs.join() === 'Push varsler,Sikkerhet,Kamera' && M0.kam.join() === 'Bevegelse ved inngang,Pakke levert' && !M0.hjem.includes('Pakke levert') && M0.sik.includes('Peis') && !M0.sik.includes('Alarm'), M0);
  await openEd(p);
  await edClick(p, '[data-op="teye"][data-v="strom"]');
  const M1 = await p.evaluate(() => { const c = window.__ed._config; return { keys: Object.keys(c).filter((k) => ['tabs', 'custom_tabs', 'faner', 'rows'].includes(k)), faner: c.faner, rows: c.rows }; });
  ok('29.2 første lagring migrerer én gang: faner[] skrives, tabs/custom_tabs/rows.include fjernes (exclude beholdes)', M1.keys.sort().join() === 'faner,rows' && M1.faner.map((t) => t.key).join() === 'hjem,sikkerhet,strom,v_kamera' && M1.faner[0].name === 'Push varsler' && M1.faner[1].ekstra.join() === 'switch.stue_peis' && M1.faner[3].enheter.join() === 'Kamera,Bevegelse,Pakke' && M1.faner[0].ikke_enheter.includes('Pakke') && !M1.rows.include && M1.rows.exclude.join() === 'n_alarm' && !M1.faner[2].hidden, M1);
  await p.close();
}

// ================================================================ 29.3 · GUI-editoren: ha-form per fane ↔ arket, ekko-vakt
{
  const p = await page({}, { haForm: true });
  const G = await p.evaluate(async () => {
    const w = (ms) => new Promise((q) => setTimeout(q, ms));
    const g = customElements.get('msh-innstillinger-card').getConfigElement(); g.hass = window.__h; g.setConfig({ ...window.__c._rawConfig }); document.body.appendChild(g); await w(300);
    window.__g = g;
    const f = g.shadowRoot.querySelector('.ihaf ha-form');
    if (!f) return { none: true };
    const S = f.schema;
    let changed = null; g.addEventListener('config-changed', (e) => { changed = e.detail.config; });
    const exp = S.map((x) => `${x.type}:${x.name}:${x.title}`), fields = S[0].schema.map((x) => x.name), opts = S[0].schema[0].selector.select.options.map((o) => o.label);
    const ekstraSel = S[0].schema.find((x) => x.name === 'ekstra').selector;
    const d0 = JSON.parse(JSON.stringify(f.data)), sets0 = f.sets;
    // bruker huker av KI Utelys i Strøm og skriver «Alarm, » i Sikkerhet (midt i et ord: komma + mellomrom skal stå)
    const v = JSON.parse(JSON.stringify(f.data)); v.f_strom.plattform = ['ki_energi', 'ki_utelys']; v.f_sikkerhet.enheter = 'Alarm, ';
    f.dispatchEvent(new CustomEvent('value-changed', { detail: { value: v } })); await w(100);
    const after = { data: JSON.parse(JSON.stringify(f.data)), sets: f.sets };
    // HA sender samme config tilbake (ekko) → ingen ombygging: data settes ikke på nytt, tekstfeltet beholder «Alarm, »
    g.setConfig(changed); await w(100);
    const echo = { sets: f.sets, enh: f.data.f_sikkerhet.enheter, same: g.shadowRoot.querySelector('.ihaf ha-form') === f };
    return { exp, fields, opts, ekstraSel, d0, sets0, changed, after, echo };
  });
  ok('29.3 GUI-editoren: ett ha-form med ett expandable per fane, samme felt som KiVarslingEditor (plattform/enheter/ikke_enheter/ekstra/master + kjente/sok)', !G.none && G.exp.join() === 'expandable:f_sikkerhet:Sikkerhet,expandable:f_hjem:Hjem,expandable:f_strom:Strøm' && G.fields.join() === 'plattform,enheter,ikke_enheter,ekstra,master,kjente,sok' && G.opts.includes('KI Varslinger (21)') && G.ekstraSel.entity.domain.join() === 'switch,input_boolean,automation' && G.ekstraSel.entity.multiple === true && G.d0.f_strom.plattform.join() === 'ki_energi', G);
  ok('29.3 GUI value-changed → faner[] i config (plattform + enheter), f.data settes tilbake med det brukeren skrev', G.changed && G.changed.faner.find((t) => t.key === 'strom').plattform.join() === 'ki_energi,ki_utelys' && G.changed.faner.find((t) => t.key === 'sikkerhet').enheter.join() === 'Alarm' && G.after.data.f_strom.plattform.join() === 'ki_energi,ki_utelys' && G.after.data.f_sikkerhet.enheter === 'Alarm, ' && G.after.sets === G.sets0 + 1, G);
  ok('29.3 ekko-vakt: HA sender samme config tilbake → ha-form bygges ikke om (data uendret, avkrysning/tekst står)', G.echo.sets === G.after.sets && G.echo.enh === 'Alarm, ' && G.echo.same, G.echo);
  // GUI → kortet → arket (samme valg synlig), og arket → GUI
  const X = await p.evaluate(async () => {
    const w = (ms) => new Promise((q) => setTimeout(q, ms)), g = window.__g, f = g.shadowRoot.querySelector('.ihaf ha-form');
    const cfg = { ...g._config };
    window.__c.setConfig(cfg); await w(250);
    window.__c.shadowRoot.querySelector('.bar .tb[data-v="strom"]').click(); await w(250);
    const rows = [...window.__c.shadowRoot.querySelectorAll('.lst .pr')].map((r) => r.dataset.id);
    window.__c.shadowRoot.querySelector('.bar .gear').click(); await w(600);
    const find = (root) => { for (const x of root.querySelectorAll('*')) { if (x.localName === 'msh-editor' && x._inline) return x; if (x.shadowRoot) { const y = find(x.shadowRoot); if (y) return y; } } return null; };
    const ed = find(window.MSH.overlayRoot());
    ed.shadowRoot.querySelector('[data-op="texp"][data-v="strom"]').click(); await w(250);
    const sheetOn = [...ed.shadowRoot.querySelectorAll('.ifp [data-op="fplat"].on')].map((x) => x.dataset.p);
    const sheetGui = !!ed.shadowRoot.querySelector('.ihaf');
    // arket: slå av KI Energi i Strøm → GUI-editoren får samme config (HA setConfig) → ha-form viser det
    ed.shadowRoot.querySelector('.ifp [data-op="fplat"][data-p="ki_energi"]').click(); await w(250);
    g.setConfig({ ...ed._config }); await w(150);
    return { rows, sheetOn, sheetGui, gui: f.data.f_strom.plattform, enh: f.data.f_sikkerhet.enheter };
  });
  ok('29.3 samme valg begge veier: GUI → kort (KI Utelys i Strøm) → arkets Integrasjoner viser det; arket → GUI-editorens ha-form', X.rows.includes('switch.ki_utelys_auto') && X.sheetOn.join() === 'ki_energi,ki_utelys' && !X.sheetGui && X.gui.join() === 'ki_utelys' && X.enh === 'Alarm', X);
  await p.close();
}

ok('ingen sidefeil', !errs.length, errs);
await b.close();
console.log(JSON.stringify(res, null, 1));
console.log(fail.length ? `\n${fail.length} FEIL: ${fail.join(' · ')}` : '\nAlle bestod');
process.exit(fail.length ? 1 : 0);
