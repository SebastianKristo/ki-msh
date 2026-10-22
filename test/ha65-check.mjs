// Fiks 65 · Home Assistant-innstillinger i appen (src/69-ha-*.js): hub, lister med mapper/etiketter, automasjons-/skript-
// /scene-editor, oppdateringer, backup, reparasjoner, logger, system, generelt, om. Kjører mot test/fixtures/ha-config-mock.js.
//   node test/ha65-check.mjs [skjermbildemappe]
import { createRequire } from 'node:module';
import { readdirSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
mkdirSync('test/.build', { recursive: true });
const bundle = resolve(`test/.build/ha65-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const SHOTS = process.argv[2] || '';
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const fail = [], errs = [];
const ok = (name, cond, info) => { console.log(`${cond ? 'OK  ' : 'FEIL'} ${name}${cond ? '' : ' · ' + JSON.stringify(info)}`); if (!cond) fail.push(name); };
const mocks = readdirSync('test/mock').filter((f) => f.endsWith('.js')).sort().map((m) => resolve('test/mock/' + m));

const p = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, deviceScaleFactor: 2 });
p.on('pageerror', (e) => errs.push(e.message));
p.on('console', (m) => { if (m.type() === 'error' && !/favicon|ERR_FILE/.test(m.text())) errs.push(m.text()); });
await p.goto('file://' + resolve('test/harness.html'));
for (const m of mocks) await p.addScriptTag({ path: m });
await p.addScriptTag({ path: resolve('test/fixtures/ha-config-mock.js') });
await p.addScriptTag({ path: bundle });
await p.evaluate(async () => { const h = window.mockHass(); window.MSH.lastHass = h; window.__h = h; if (window.MSH.store && !window.MSH.store.loaded) await window.MSH.store.load(h); });
const wait = (ms) => p.waitForTimeout(ms);
const shot = async (n) => { if (SHOTS) await p.screenshot({ path: `${SHOTS}/${n}.png` }); };
// klikk i arket: selektor inni overleggets shadow root
const R = `(() => { const h = document.querySelector('ki-overlay-root').shadowRoot.querySelector('[data-ha-cfg]'); return h && h.shadowRoot; })()`;
const click = async (sel, i = 0) => { const okk = await p.evaluate(({ sel, i }) => { const r = document.querySelector('ki-overlay-root').shadowRoot.querySelector('[data-ha-cfg]').shadowRoot; const e = r.querySelectorAll(sel)[i]; if (!e) return false; e.scrollIntoView({ block: 'center' }); e.click(); return true; }, { sel, i }); await wait(380); return okk; };
const txt = () => p.evaluate((R) => { const r = eval(R); return r ? r.querySelector('.pgw').innerText.replace(/\s+/g, ' ') : ''; }, R);
const title = () => p.evaluate((R) => { const r = eval(R); return r ? r.querySelector('.hh .tt b').textContent : ''; }, R);
const inputSet = async (sel, v, commit = true) => { await p.evaluate(({ sel, v, commit }) => { const r = document.querySelector('ki-overlay-root').shadowRoot.querySelector('[data-ha-cfg]').shadowRoot; const e = r.querySelector(sel); e.focus(); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); if (commit) { e.dispatchEvent(new Event('change', { bubbles: true })); e.blur(); } }, { sel, v, commit }); await wait(250); };

/* ---------- hub */
await p.evaluate(() => window.MSH.ha.open());
await wait(700);
ok('Hub: åpnes med tittel Innstillinger', (await title()) === 'Innstillinger');
let t = await txt();
ok('Hub: fliser for automasjoner, scener og skript med antall', /Automasjoner\s*\d+/.test(t) && /Scener\s*\d+/.test(t) && /Skript\s*\d+/.test(t), t.slice(0, 200));
ok('Hub: varsel om oppdateringer', /\d+ oppdateringer tilgjengelig/.test(t), t.slice(0, 300));
ok('Hub: reparasjoner teller 1 (ignorerte telles ikke)', /1 trenger oppmerksomhet/.test(t));
ok('Hub: siste backup vises', /Siste: 1 d siden/.test(t), t);
ok('Hub: lenker videre til HA for resten (Enheter og tjenester, Tillegg …)', /Enheter og tjenester/.test(t) && /Tillegg/.test(t));
await shot('01-hub');

/* ---------- automasjonslisten */
await click('[data-v="list|automation"]');
t = await txt();
ok('Liste: gruppert i mapper (Lys, Sikkerhet, Uten mappe)', /Lys\s*1/.test(t) && /Sikkerhet\s*1/.test(t) && /Uten mappe\s*\d+/.test(t), t.slice(0, 400));
ok('Liste: etiketter vises på radene', /Viktig/.test(t) && /Ferie/.test(t));
ok('Liste: YAML-automasjon merket', /YAML/.test(t));
await shot('02-automasjoner');
await click('[data-a="flab"][data-v="ferie"]');
t = await txt();
ok('Liste: etikettfilter «Ferie» viser bare Alarm ved dør', /Alarm ved dør/.test(t) && !/Lys på ved solnedgang/.test(t), t.slice(0, 300));
await click('[data-a="flab"][data-v="ferie"]');
await click('[data-a="tog"][data-v="automation.alarm_ved_dor"]');
let calls = await p.evaluate(() => window.__calls.filter((c) => c[0] === 'automation'));
ok('Liste: bryteren slår automasjonen på', calls.some((c) => c[1] === 'turn_on' && c[2].entity_id === 'automation.alarm_ved_dor'), calls);
await click('[data-a="fold"][data-v="c_lys"]');
t = await txt();
ok('Liste: mappen Lys kan lukkes', !/Lys på ved solnedgang/.test(t));
await click('[data-a="fold"][data-v="c_lys"]');
// ⋯ → organiser
await click('[data-a="more"][data-v="automation.yaml_automasjon"]');
await p.evaluate(() => { const r = document.querySelector('ki-overlay-root').shadowRoot.querySelector('[data-ha-cfg]').shadowRoot; r.querySelector('.ps [data-a="org"]').click(); });
await wait(400);
await shot('03-organiser');
await p.evaluate(() => { const r = document.querySelector('ki-overlay-root').shadowRoot.querySelector('[data-ha-cfg]').shadowRoot; r.querySelector('.ps [data-a="cat"][data-v="c_sik"]').click(); });
await wait(300);
await p.evaluate(() => { const r = document.querySelector('ki-overlay-root').shadowRoot.querySelector('[data-ha-cfg]').shadowRoot; r.querySelector('.ps [data-a="lab"][data-v="ferie"]').click(); });
await wait(300);
let E = await p.evaluate(() => window.__haMock.E['automation.yaml_automasjon']);
ok('Organiser: mappe og etikett lagres i entitetsregisteret', E.categories && E.categories.automation === 'c_sik' && (E.labels || []).includes('ferie'), E);
await p.evaluate(() => { const r = document.querySelector('ki-overlay-root').shadowRoot.querySelector('[data-ha-cfg]').shadowRoot; r.querySelector('.ps [data-a="done"]').click(); });
await wait(400);

/* ---------- editor: eksisterende automasjon (nytt format) */
await click('[data-a="edit"][data-v="automation.lys_pa_ved_solnedgang"]');
await wait(400);
t = await txt();
ok('Editor: oppsummeringer for utløser/betingelse/handlinger', /Solnedgang -00:15:00/.test(t) && /Sebastian er hjemme/.test(t) && /Stue tak/.test(t) && /5 min/.test(t) && /Hvis etter 22:00/.test(t), t.slice(0, 900));
await shot('04-editor');
await click('[data-a="bk-tog"][data-v="actions.0"]');
t = await txt();
ok('Editor: handling utvides med tjenestefelt (Lysstyrke-slider) og «Legg til felt»', /Lysstyrke/.test(t) && /Legg til felt/.test(t), t.slice(0, 1200));
await shot('05-handling');
await click('[data-a="bk-tog"][data-v="actions.2"]');
t = await txt();
ok('Editor: Hvis/så viser nøstede lister', /Legg til «ellers»/.test(t));
await shot('06-hvis-sa');
// legg til handling via typevelger
await click('[data-a="bk-add"][data-v="actions"]');
await shot('07-typevelger');
await p.evaluate(() => { const r = document.querySelector('ki-overlay-root').shadowRoot.querySelector('[data-ha-cfg]').shadowRoot; r.querySelector('.ps [data-a="pick"][data-v="delay"]').click(); });
await wait(400);
t = await txt();
ok('Editor: ny Vent-handling lagt til og Lagre aktiv', /Vent/.test(t) && await p.evaluate(() => !document.querySelector('ki-overlay-root').shadowRoot.querySelector('[data-ha-cfg]').shadowRoot.querySelector('.hh .hd').disabled));
await inputSet('[data-f="actions.3::delay"]', '00:00:30');
// test betingelse
await click('[data-a="bk-tog"][data-v="conditions.0"]');
await click('[data-a="bk-test"][data-v="conditions.0"]');
await wait(300);
let ws = await p.evaluate(() => window.__haMock.ws.filter((m) => m.type === 'test_condition'));
ok('Editor: «Test» sender test_condition', ws.length === 1 && ws[0].condition.condition === 'state', ws);
await click('[data-a="save"]');
await wait(500);
let posted = await p.evaluate(() => window.__haMock.posted.filter((x) => x[0] === 'POST'));
const sv = posted[posted.length - 1];
ok('Editor: lagrer til config/automation/config/1001 i nytt format med ny handling', sv && sv[1] === 'config/automation/config/1001' && sv[2].id === '1001' && sv[2].actions.length === 4 && sv[2].actions[3].delay === '00:00:30' && sv[2].triggers[0].trigger === 'sun', sv && sv[2]);
// YAML-modus
await click('[data-a="seg"][data-f="__mode"][data-v="yaml"]');
t = await p.evaluate(() => document.querySelector('ki-overlay-root').shadowRoot.querySelector('[data-ha-cfg]').shadowRoot.querySelector('textarea[data-f="__yaml"]').value);
ok('Editor: YAML-modus viser hele automasjonen', /alias: Lys på ved solnedgang/.test(t) && /triggers:/.test(t), t.slice(0, 200));
await shot('08-yaml');
await click('[data-a="seg"][data-f="__mode"][data-v="visual"]');
// siste kjøringer
await click('[data-a="traces"]');
t = await txt();
ok('Spor: liste med resultat', /Fullført/.test(t) && /Betingelser ikke oppfylt/.test(t), t);
await click('[data-a="open"]');
t = await txt();
ok('Spor: steg med oppsummering', /Solnedgang/.test(t) && /Oppfylt/.test(t) && /action\/1/.test(t), t.slice(0, 500));
await shot('09-spor');
await click('[data-a="back"]'); await click('[data-a="back"]');

/* ---------- eldre format (platform/service) leses og beholdes som nytt */
await click('[data-a="back"]');
await wait(300);
await click('[data-a="edit"][data-v="automation.alarm_ved_dor"]');
await wait(400);
t = await txt();
ok('Editor: gammelt format (platform:/service:) vises riktig', /Gang dør blir på/.test(t) && /dor/.test(t) && /1 valg/.test(t), t.slice(0, 700));
await click('[data-a="back"]');

/* ---------- ny automasjon */
await click('[data-a="new"]');
await wait(400);
ok('Ny: editor åpner med utløser-seksjonen', /Legg til utløser/.test(await txt()));
await inputSet('[data-f="::alias"]', 'Test ny');
await click('[data-a="bk-add"][data-v="triggers"]');
await p.evaluate(() => document.querySelector('ki-overlay-root').shadowRoot.querySelector('[data-ha-cfg]').shadowRoot.querySelector('.ps [data-a="pick"][data-v="time"]').click());
await wait(300);
await click('[data-a="org"]');
await p.evaluate(() => document.querySelector('ki-overlay-root').shadowRoot.querySelector('[data-ha-cfg]').shadowRoot.querySelector('.ps [data-a="cat"][data-v="c_lys"]').click());
await wait(200);
await p.evaluate(() => document.querySelector('ki-overlay-root').shadowRoot.querySelector('[data-ha-cfg]').shadowRoot.querySelector('.ps [data-a="done"]').click());
await wait(300);
// når HA lagrer, dukker entiteten opp – simuler det
await p.evaluate(() => { const _p = window.__h.callApi; window.__h.callApi = (m, path, body) => _p(m, path, body).then((r) => { if (m === 'POST' && /automation\/config/.test(path) && !window.__h.states['automation.test_ny']) { window.__h.states['automation.test_ny'] = { entity_id: 'automation.test_ny', state: 'on', attributes: { id: body.id, friendly_name: body.alias } }; window.__haMock.E['automation.test_ny'] = { entity_id: 'automation.test_ny', categories: {}, labels: [] }; } return r; }); });
await click('[data-a="save"]');
await wait(900);
E = await p.evaluate(() => window.__haMock.E['automation.test_ny']);
posted = await p.evaluate(() => window.__haMock.posted.filter((x) => x[0] === 'POST'));
ok('Ny: lagret med tidsutløser og mappe satt etter lagring', posted[posted.length - 1][2].triggers[0].trigger === 'time' && E && E.categories.automation === 'c_lys', { E, last: posted[posted.length - 1] });
await click('[data-a="back"]');
await click('[data-a="back"]');

/* ---------- skript */
await click('[data-v="list|script"]');
await click('[data-a="edit"][data-v="script.god_natt"]');
await wait(300);
t = await txt();
ok('Skript: editor med sekvens og gjenta', /Sekvens/.test(t) && /2 ganger/.test(t), t.slice(0, 500));
await shot('10-skript');
await click('[data-a="back"]'); await click('[data-a="back"]');

/* ---------- scene */
await click('[data-v="list|scene"]');
await shot('11-scener');
await click('[data-a="edit"][data-v="scene.filmkveld"]');
await wait(300);
t = await txt();
ok('Scene: entiteter med lagret tilstand og «nå»-avvik', /Stue tak/.test(t) && /på · 24 %/.test(t) && /nå:/.test(t), t.slice(0, 500));
await shot('12-scene');
await click('[data-a="capall"]');
await click('[data-a="save"]');
await wait(400);
posted = await p.evaluate(() => window.__haMock.posted.filter((x) => x[0] === 'POST' && /scene/.test(x[1])));
ok('Scene: «Hent alle» + lagre sender nåværende tilstand', posted.length && posted[posted.length - 1][2].entities['light.stue_tak'].brightness === 180, posted[posted.length - 1]);
await click('[data-a="back"]'); await click('[data-a="back"]');

/* ---------- mapper og etiketter */
await click('[data-v="cats"]');
t = await txt();
ok('Mapper: liste per type', /Lys/.test(t) && /Sikkerhet/.test(t));
await shot('13-mapper');
await click('[data-a="back"]');
await click('[data-v="labels"]');
await shot('14-etiketter');
await click('[data-a="add"]');
await p.evaluate(() => { const i = document.querySelector('ki-overlay-root').shadowRoot.querySelector('[data-ha-cfg]').shadowRoot.querySelector('.ps input[data-f="n"]'); i.value = 'Hytta'; i.dispatchEvent(new Event('input', { bubbles: true })); document.querySelector('ki-overlay-root').shadowRoot.querySelector('[data-ha-cfg]').shadowRoot.querySelector('.ps [data-a="save"]').click(); });
await wait(400);
ok('Etiketter: ny etikett opprettes', await p.evaluate(() => window.__haMock.labels.some((l) => l.name === 'Hytta')));
await click('[data-a="back"]');

/* ---------- oppdateringer */
await click('[data-v="updates"]');
t = await txt();
ok('Oppdateringer: Core og Mosquitto med versjoner, Core sist i «oppdater alt»', /Home Assistant Core/.test(t) && /2025\.9\.4 → 2025\.10\.1/.test(t) && /Ta backup og oppdater alt/.test(t), t.slice(0, 500));
await click('[data-a="uo"][data-v="update.home_assistant_core_update"]');
await wait(300);
t = await txt();
ok('Oppdateringer: utgivelsesnotater og backup-bryter', /Raskere oppstart/.test(t) && /Ta sikkerhetskopi først/.test(t), t.slice(0, 600));
await shot('15-oppdateringer');
await click('[data-a="inst"]'); await click('[data-a="inst"]');
calls = await p.evaluate(() => window.__calls.filter((c) => c[0] === 'update'));
ok('Oppdateringer: installer med backup: true', calls.some((c) => c[1] === 'install' && c[2].backup === true), calls);
await click('[data-a="back"]');

/* ---------- backup */
await click('[data-v="backups"]');
await wait(300);
t = await txt();
ok('Backup: status, plan og liste', /Daglig kl\. 04:45/.test(t) && /Automatisk backup 2025\.10/.test(t) && /700,0 MB/.test(t), t.slice(0, 600));
await shot('16-backup');
await click('[data-a="new"]');
await shot('17-ny-backup');
await p.evaluate(() => document.querySelector('ki-overlay-root').shadowRoot.querySelector('[data-ha-cfg]').shadowRoot.querySelector('.ps [data-a="go"]').click());
await wait(300);
ws = await p.evaluate(() => window.__haMock.ws.filter((m) => /backup\/generate/.test(m.type)));
ok('Backup: «Lag nå» sender generate_with_automatic_settings', ws.length === 1, ws);
await click('[data-a="open"][data-v="b1"]');
t = await txt();
ok('Backup: detaljer med tillegg og steder', /Mosquitto broker/.test(t) && /Denne enheten/.test(t), t.slice(0, 400));
await shot('18-backup-detalj');
await click('[data-a="back"]');
await click('[data-a="cfg"]');
await click('[data-a="seg"][data-f="ret"][data-v="days"]');
await wait(300);
ws = await p.evaluate(() => window.__haMock.ws.filter((m) => m.type === 'backup/config/update'));
ok('Backup-innstillinger: oppbevaring lagres', ws.length && ws[ws.length - 1].retention.days === 7, ws);
await shot('19-backup-innstillinger');
await click('[data-a="back"]'); await click('[data-a="back"]');

/* ---------- reparasjoner, logger, system, generelt, om */
await click('[data-v="repairs"]');
await click('[data-a="o"]');
t = await txt();
ok('Reparasjoner: oversatt tittel og beskrivelse', /Systemet er usunt \(docker\)/.test(t) && /Sjekk loggen/.test(t), t.slice(0, 400));
await shot('20-reparasjoner');
await click('[data-a="back"]');
await click('[data-v="logs"]');
t = await txt();
ok('Logger: feil og advarsler', /Kunne ikke koble til broker/.test(t) && /4×/.test(t), t.slice(0, 300));
await shot('21-logger');
await click('[data-a="back"]');
await click('[data-v="system"]');
await click('[data-a="check"]');
await wait(300);
ok('System: sjekk konfigurasjon', /Konfigurasjonen er gyldig/.test(await txt()));
await click('[data-a="restart"]');
t = await txt();
ok('System: omstart krever to trykk', /Trykk igjen for å bekrefte/.test(t));
await shot('22-system');
await click('[data-a="back"]');
await click('[data-v="general"]');
await inputSet('[data-f="location_name"]', 'Hytta', false);
await click('[data-a="save"]');
await wait(300);
ws = await p.evaluate(() => window.__haMock.ws.filter((m) => m.type === 'config/core/update'));
ok('Generelt: lagrer bare endrede felt', ws.length === 1 && ws[0].location_name === 'Hytta' && !('currency' in ws[0]), ws);
await shot('23-generelt');
await click('[data-a="back"]');
await click('[data-v="about"]');
await wait(300);
t = await txt();
ok('Om: versjoner fra supervisor', /2025\.10\.1/.test(t) && /Home Assistant OS 16\.2/.test(t), t.slice(0, 300));
await shot('24-om');

/* ---------- lukk + #settings-snarveiene */
await p.evaluate(() => document.querySelector('ki-overlay-root').shadowRoot.querySelector('[data-ha-cfg]').shadowRoot.querySelector('[data-a="back"]').click());
await wait(300);
await p.evaluate(() => document.querySelector('ki-overlay-root').shadowRoot.querySelector('[data-ha-cfg]').shadowRoot.querySelector('[data-a="close"]').click());
await wait(400);
ok('Lukk: arket fjernes', await p.evaluate(() => !document.querySelector('ki-overlay-root').shadowRoot.querySelector('[data-ha-cfg]')));
const inn = await p.evaluate(async () => {
  const c = document.createElement('msh-innstillinger-card'); c.setConfig({ type: 'custom:msh-innstillinger-card', card_id: 'pop-innstillinger' }); c.hass = window.__h; document.getElementById('dash').appendChild(c);
  await new Promise((r) => setTimeout(r, 600));
  const sr = c.shadowRoot; const t2 = sr.querySelector('.hag') ? sr.querySelector('.hag').innerText.replace(/\s+/g, ' ') : '';
  sr.querySelector('[data-act="ha"][data-v="updates"]').click();
  await new Promise((r) => setTimeout(r, 600));
  const h = document.querySelector('ki-overlay-root').shadowRoot.querySelector('[data-ha-cfg]'); return { t2, page: h && h.shadowRoot.querySelector('.hh .tt b').textContent };
});
ok('#settings: snarveier nederst med oppdateringsmerke, og de åpner riktig side', /Automasjoner/.test(inn.t2) && /\d+ nye/.test(inn.t2) && inn.page === 'Oppdateringer', inn);

/* ---------- engelsk + lys modus */
const en = await p.evaluate(async () => {
  window.kiSetLang('en');
  const r0 = window.MSH.i18n.missing; r0.clear && r0.clear();
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  window.MSH.ha.open('edit', { kind: 'automation', entity: 'automation.lys_pa_ved_solnedgang', id: '1001' }); await wait(800);
  const R = document.querySelector('ki-overlay-root').shadowRoot.querySelector('[data-ha-cfg]').shadowRoot;
  R.querySelector('[data-a="bk-tog"][data-v="actions.2"]').click(); await wait(400);
  const t = R.querySelector('.pgw').innerText.replace(/\s+/g, ' ');
  return { t, miss: [...window.MSH.i18n.missing].filter((x) => /[æøå]|\b(og|på|av|til|med|ikke)\b/i.test(x)).slice(0, 40) };
});
ok('Engelsk: editoren er oversatt (When / And if / Then do, summaries)', /When/.test(en.t) && /And if/.test(en.t) && /Then do/.test(en.t) && /Sunset/.test(en.t) && /is home/.test(en.t), en.t.slice(0, 500));
ok('Engelsk: ingen norske tekster uten oversettelse i editoren', !en.miss.length, en.miss);
await shot('25-engelsk');
await p.evaluate(() => { window.kiSetLang('no'); const r = document.documentElement; r.setAttribute('data-ki-theme', 'light'); Object.entries({ '--ki-bg': '#e6e6e6', '--ki-popup': '#f0f0f0', '--ki-surface': '#ffffff', '--ki-surface-2': '#ebebeb', '--ki-surface-3': '#dedede', '--ki-text': '#1c1c1c', '--ki-text-2': '#5c5c5c', '--ki-text-3': '#858585', '--ki-text-mid': '#5b5b5b', '--ki-ctrl': '#cfcfcf', '--ki-pill-bg': '#1c1c1c', '--ki-pill-fg': '#fafafa', '--ki-wa-c': '0 0 0', '--ki-sheet-bg': '#f0f0f0' }).forEach(([k, v]) => r.style.setProperty(k, v)); });
await wait(400);
await shot('26-lys-modus');

ok('Ingen JS-feil', !errs.length, errs.slice(0, 5));
await b.close();
console.log(fail.length ? `\n${fail.length} FEIL` : '\nAlt OK');
process.exit(fail.length ? 1 : 0);
