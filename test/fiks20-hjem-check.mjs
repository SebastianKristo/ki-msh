// Fiks 20.2 / 20.7 / 20.13 · Hjem: søppel-kortets trykk/hold, tekst per tilstand på live-fliser, Aktuelt uten romkort.
import { createRequire } from 'node:module';
import { readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const bundle = resolve(`test/.build/f20hjem-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const SHOTS = process.env.SHOTS || '';
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: 430, height: 1100 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto('file://' + resolve('test/harness.html'));
for (const m of readdirSync('test/mock').sort()) await p.addScriptTag({ path: resolve('test/mock/' + m) });
await p.addScriptTag({ path: bundle });
const res = [];
const ok = (name, cond, info) => res.push((cond ? '✔ ' : '✘ ') + name + (cond ? '' : ' → ' + JSON.stringify(info)));
const W = (ms) => p.waitForTimeout(ms);

await p.evaluate(() => {
  window.__h = window.mockHass();
  window.__nav = []; window.__open = []; window.__more = [];
  history.pushState = (st, t, url) => { window.__pushed = url; };
  window.addEventListener('location-changed', () => window.__nav.push(window.__pushed));
  window.open = (u, t) => { window.__open.push([u, t]); return null; };
  window.addEventListener('hass-more-info', (e) => window.__more.push(e.detail.entityId));
});

/* ---------------- 20.2 · Søppel */
const mkTrash = (cfg) => p.evaluate(async (cfg) => {
  document.getElementById('dash').innerHTML = '';
  const c = document.createElement('msh-soppel-card');
  c.setConfig({ type: 'custom:msh-soppel-card', card_id: 'tr_' + Math.random().toString(36).slice(2), sensor: 'sensor.neste_tomming', ...cfg });
  c.hass = window.__h;
  document.getElementById('dash').appendChild(c);
  window.__t = c;
  location.hash = '';
  window.__nav.length = 0; window.__open.length = 0; window.__more.length = 0; window.__calls.length = 0;
  await new Promise((q) => setTimeout(q, 300));
}, cfg);
const box = () => p.evaluate(() => { const r = window.__t.shadowRoot.querySelector('.tr').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
const tap = async () => { const r = await box(); await p.mouse.click(r.x, r.y); await W(200); };
const hold = async () => { const r = await box(); await p.mouse.move(r.x, r.y); await p.mouse.down(); await W(750); await p.mouse.up(); await W(200); };
const st = () => p.evaluate(() => ({ hash: location.hash, nav: window.__nav.slice(), open: window.__open.slice(), more: window.__more.slice(), calls: window.__calls.filter((c) => c[0] !== 'ws').map((c) => [c[0], c[1], c[2]]) }));

await mkTrash({});
await tap();
let s = await st();
ok('20.2 standard: trykk åpner #soppel', s.hash === '#soppel', s);
await mkTrash({});
await hold();
s = await st();
ok('20.2 standard: hold = more-info for sensoren, klikket etter holdet spises', s.more.join() === 'sensor.neste_tomming' && s.hash !== '#soppel', s);
const pink = await p.evaluate(() => { const e = window.__t.shadowRoot.querySelector('.tr'); return { pink: e.classList.contains('pink'), callout: /\.tr\{[^}]*-webkit-touch-callout:none/.test(window.__t.shadowRoot.innerHTML) ? 'none' : '' }; });
ok('20.2 tømmedag-kortet (rosa) + -webkit-touch-callout: none', pink.pink && pink.callout === 'none', pink);
await mkTrash({ popup_hash: '#avfall' });
await tap();
s = await st();
ok('20.2 migrering: popup_hash → tap_action popup', s.hash === '#avfall', s);
const mig = await p.evaluate(() => window.MSH.hjemTrashAct({ popup_hash: '#avfall' }, 'tap_action'));
ok('20.2 migrering: hjemTrashAct gir { action: popup, hash }', mig.action === 'popup' && mig.hash === '#avfall', mig);
await mkTrash({ tap_action: { action: 'navigate', navigation_path: '/dashboard-hjem/avfall' } });
await tap(); s = await st();
ok('20.2 Naviger til visning (pushState + location-changed)', s.nav.includes('/dashboard-hjem/avfall'), s);
await mkTrash({ tap_action: { action: 'more-info', entity: 'sensor.soppel_type' } });
await tap(); s = await st();
ok('20.2 More-info med egen entitet', s.more.join() === 'sensor.soppel_type', s);
await mkTrash({ tap_action: { action: 'call-service', service: 'script.hent_soppel' } });
await tap(); s = await st();
ok('20.2 Kjør script → script.turn_on', s.calls.some((c) => c[0] === 'script' && c[1] === 'turn_on' && c[2].entity_id === 'script.hent_soppel'), s);
await mkTrash({ tap_action: { action: 'perform-action', perform_action: 'light.turn_on', target: { entity_id: 'light.stue' } } });
await tap(); s = await st();
ok('20.2 HA ui_action-format (perform-action) → light.turn_on', s.calls.some((c) => c[0] === 'light' && c[1] === 'turn_on' && c[2].entity_id === 'light.stue'), s);
await mkTrash({ tap_action: { action: 'url', url_path: 'https://renovasjon.no' } });
await tap(); s = await st();
ok('20.2 Åpne URL i ny fane', s.open.length === 1 && s.open[0][0] === 'https://renovasjon.no' && s.open[0][1] === '_blank', s);
await mkTrash({ tap_action: { action: 'none' }, hold_action: { action: 'popup', hash: '#hold' } });
await tap(); s = await st();
ok('20.2 Ingen: trykk gjør ingenting', !s.hash && !s.nav.length && !s.more.length && !s.open.length, s);
await hold(); s = await st();
ok('20.2 Hold har eget valg (popup #hold)', s.hash === '#hold' && !s.more.length, s);

// Editor: begge editorene bruker samme schema (msh-hjem-editor) → nedtrekksliste + felt
const ed = await p.evaluate(async () => {
  const C = customElements.get('msh-soppel-card'), e = C.getConfigElement();
  e.hass = window.__h; e.setConfig({ type: 'custom:msh-soppel-card', card_id: 'tr_ed', popup_hash: '#avfall' });
  document.getElementById('dash').appendChild(e);
  let last = null; e.addEventListener('config-changed', (x) => { last = x.detail.config; });
  await new Promise((q) => setTimeout(q, 300));
  // Fiks 30.3: felles handlingsvelger (msh-tap-picker, HA-format) for Trykk og Hold
  const R = e.shadowRoot, T = [...R.querySelectorAll('msh-tap-picker[data-name$="_action"]')];
  const out = { n: T.length, tap: T[0] && [T[0].mode, (T[0].value || {}).navigation_path], hold: T[1] && T[1].mode, opts: T[0] ? [...T[0].shadowRoot.querySelectorAll('[data-p="mode"]')].map((o) => o.dataset.v) : [], tileH: T[0] && Math.round(T[0].shadowRoot.querySelector('.tl').getBoundingClientRect().height) };
  [...T[0].shadowRoot.querySelectorAll('[data-p="mode"]')].find((x) => x.dataset.v === 'url').click();
  await new Promise((q) => setTimeout(q, 100));
  const ui = T[0].shadowRoot.querySelector('input[data-f="url"]'); out.urlField = !!ui;
  if (ui) { ui.value = 'https://example.com'; ui.dispatchEvent(new Event('change', { bubbles: true })); }
  await new Promise((q) => setTimeout(q, 200));
  out.after = last && last.tap_action; out.help = T[0].shadowRoot.querySelector('.tg') ? T[0].shadowRoot.querySelector('.tg').textContent : '';
  e.remove();
  return out;
});
ok('20.2/30.3 editor: to handlingsvelgere (Trykk, Hold) med valgene', ed.n === 2 && ed.opts.join() === 'std,popup,hash,path,url,more,service,none', ed);
ok('20.2/30.3 editor: popup_hash vises som Popup #avfall (eller egen hash); Hold = standard', ed.tap && ['popup', 'hash'].includes(ed.tap[0]) && ed.tap[1] === '#avfall' && ed.hold === 'std', ed);
ok('30.3 editor: ruter 76 px', ed.tileH === 76, ed);
ok('20.2 editor: valg lagres som tap_action { action: url } + URL-felt + «Åpne i ny fane»', ed.after && ed.after.action === 'url' && ed.urlField && /ny fane/.test(ed.help), ed);

/* ---------------- 20.7 · Tekst per tilstand */
await p.evaluate(async () => {
  document.getElementById('dash').innerHTML = '';
  const S = window.__h.states;
  S['alarm_control_panel.hjem'] = { ...S['alarm_control_panel.hjem'], state: 'armed_away', attributes: { ...(S['alarm_control_panel.hjem'] || { attributes: {} }).attributes, friendly_name: 'Alarm', changed_by: 'Rune' }, last_changed: new Date(Date.now() - 12 * 60e3).toISOString() };
  S['lock.inngangsdor'] = { ...S['lock.inngangsdor'], state: 'locked' };
  const c = document.createElement('msh-hjem-faner-card');
  window.__fcfg = { type: 'custom:msh-hjem-faner-card', card_id: 'ki-faner-f20',
    tabs: { hjem: { auto_fill: false, cards: ['lock', 'alarm', 'garage', 'rom:stue'] } },
    tiles: { hjem: { lock: { slot: 'L-top', stack: false }, alarm: { slot: 'L-bottom', stack: false }, garage: { slot: 'R-top', stack: false } } }, swipe: { hjem: { 'L-top': false } },
    layout: { aktuelt: { order: ['stue', 'kjokken'] } },
    tile_cfg: { lock: { entity: 'lock.inngangsdor', state_text: { locked: { title: '[[[ return state.toUpperCase() ]]]', sub: '' }, unlocked: { title: 'Åpen dør' } } },
      alarm: { entity: 'alarm_control_panel.hjem', state_text: { armed_away: { title: 'Huset er sikret', sub: 'Alarm · {since} · av {attr:changed_by}' } } },
      garage: { entity: 'cover.garasjeport', state_text: { closed: { sub: '{default} ({name})' }, open: { sub: '{default} ({name})' } } } } };
  c.setConfig(window.__fcfg); c.hass = window.__h;
  document.getElementById('dash').appendChild(c);
  window.__c = c;
  await new Promise((q) => setTimeout(q, 600));
});
const tile = (k) => p.evaluate((k) => { const el = window.__c.shadowRoot.querySelector(`.u.ht[data-k="${k}"]`); if (!el) return null; const n = el.querySelector('.u-n'), l = el.querySelector('.u-l'); return { title: l && l.textContent, sub: n && n.textContent, bg: getComputedStyle(el).backgroundColor }; }, k);
let al = await tile('alarm');
ok('20.7 Alarm armed_away: «Huset er sikret» / «Alarm · i 12 min · av Rune»', al && al.title === 'Huset er sikret' && al.sub === 'Alarm · i 12 min · av Rune', al);
let lk = await tile('lock');
// Fiks 47 A: med flere låser i #dorlas er standard-underteksten låsens navn (mocken har Inngangsdør + Boddør)
ok('20.7 Dørlås: [[[ ]]] virker, tomt felt = standard undertekst', lk && lk.title === 'LOCKED' && lk.sub === 'Inngangsdør', lk);
const ga = await tile('garage');
ok('20.7 Garasje: {default} og {name}', ga && /^Garasjeport \(.+\)$/.test(ga.sub || '') && !/\{/.test(ga.sub), ga);
await p.evaluate(async () => { const S = { ...window.__h.states }; S['alarm_control_panel.hjem'] = { ...S['alarm_control_panel.hjem'], state: 'disarmed' }; S['lock.inngangsdor'] = { ...S['lock.inngangsdor'], state: 'unlocked' }; window.__h = { ...window.__h, states: S }; window.__c.hass = window.__h; await new Promise((q) => setTimeout(q, 400)); });
al = await tile('alarm'); lk = await tile('lock');
ok('20.7 annen tilstand uten overstyring → standardtekst', al && al.title === 'Av' && al.sub === 'Alarm', al);
ok('20.7 Dørlås unlocked: «Åpen dør», farge følger fortsatt tilstanden (oransje)', lk && lk.title === 'Åpen dør' && lk.bg !== 'rgba(0, 0, 0, 0)', lk);
const cam = await p.evaluate(() => { const c = window.__c, keep = c._config; c._config = { ...keep, tile_cfg: { ...keep.tile_cfg, cam: { state_text: { off: { title: 'Rolig', sub: 'Ingen bevegelse · {state}' } } } } }; try { const m = c._tileModel('cam', c._E); return m && [m.title, m.sub, m.stState]; } finally { c._config = keep; } });
ok('20.7 Kamera: off → egen tekst', cam && cam[0] === 'Rolig' && cam[1] === 'Ingen bevegelse · off', cam);
const lists = await p.evaluate(() => { const H = window.MSH.hjemTiles; return { alarm: H.stStates(window.__h, 'alarm', 'alarm_control_panel.hjem', {}), lock: H.stStates(window.__h, 'lock', 'lock.inngangsdor', {}), garage: H.stStates(window.__h, 'garage', null, {}), cam: H.stStates(window.__h, 'cam', null, {}) }; });
ok('20.7 tilstandslister (domene + unavailable/unknown)', lists.alarm.includes('armed_vacation') && lists.alarm.includes('triggered') && lists.lock.includes('jammed') && lists.garage.join() === 'closed,open,opening,closing,unavailable,unknown' && lists.cam.join() === 'on,off,unavailable,unknown', lists);

// GUI-editoren: én rad (tittel + undertekst) per tilstand
const gui = await p.evaluate(async () => {
  const C = customElements.get('msh-hjem-faner-card'), e = C.getConfigElement();
  e.hass = window.__h; e.setConfig(JSON.parse(JSON.stringify(window.__fcfg)));
  document.getElementById('dash').appendChild(e);
  let last = null; e.addEventListener('config-changed', (x) => { last = x.detail.config; });
  await new Promise((q) => setTimeout(q, 400));
  const R = e.shadowRoot, t = R.querySelector('input[data-name="tile_cfg.alarm.state_text.armed_away.title"]'), s2 = R.querySelector('input[data-name="tile_cfg.alarm.state_text.triggered.sub"]');
  const out = { t: t && t.value, ph: s2 && s2.placeholder, n: R.querySelectorAll('input[data-name^="tile_cfg.alarm.state_text."]').length };
  if (t) { t.value = 'Sikret'; t.dispatchEvent(new Event('change', { bubbles: true })); }
  await new Promise((q) => setTimeout(q, 200));
  out.saved = last && last.tile_cfg.alarm.state_text.armed_away.title;
  e.remove();
  return out;
});
ok('20.7 GUI-editor: tittel/undertekst per tilstand (plassholder = standard) og lagring', gui.t === 'Huset er sikret' && gui.ph === 'Alarm' && gui.n >= 22 && gui.saved === 'Sikret', gui);

/* ---------------- 20.13 · Aktuelt */
await p.evaluate(async () => {
  const c = window.__c, TV = c._TV, i = TV.findIndex((t) => t.id === 'aktuelt');
  c._pickTab(i); await new Promise((q) => setTimeout(q, 500));
});
const ak = await p.evaluate(() => { const R = window.__c.shadowRoot; return { cur: window.__c._cur && window.__c._cur.id, rooms: R.querySelectorAll('[data-key^="rk-"]').length, empty: !!R.querySelector('.akt0'), txt: (R.querySelector('.akt0') || {}).textContent, fs: R.querySelector('.akt0') && getComputedStyle(R.querySelector('.akt0')).fontSize, col: R.querySelector('.akt0') && getComputedStyle(R.querySelector('.akt0')).color, cols: R.querySelectorAll('.cols .col').length, tiles: R.querySelectorAll('.u.ht').length, appl: R.querySelectorAll('[data-act="appl"]').length }; });
ok('20.13 Aktuelt: ingen romkort (også med gammel layout.aktuelt.order)', ak.cur === 'aktuelt' && ak.rooms === 0, ak);
ok('20.13 Aktuelt: tom-tilstand «Ingenting som trenger deg nå» 14 px #979797, eller aktive kort', ak.empty ? ak.txt === 'Ingenting som trenger deg nå' && ak.fs === '14px' && ak.col === 'rgb(151, 151, 151)' && ak.cols === 0 : ak.tiles + ak.appl > 0, ak);
// med en åpen dør: flisen vises, fortsatt ingen rom
await p.evaluate(async () => { const S = { ...window.__h.states }; S['binary_sensor.f20_dor'] = { entity_id: 'binary_sensor.f20_dor', state: 'on', attributes: { device_class: 'door', friendly_name: 'Bakdør' }, last_changed: new Date().toISOString(), last_updated: new Date().toISOString() }; window.__h = { ...window.__h, states: S }; window.__c.hass = window.__h; await new Promise((q) => setTimeout(q, 400)); });
const ak2 = await p.evaluate(() => { const R = window.__c.shadowRoot; return { rooms: R.querySelectorAll('[data-key^="rk-"]').length, empty: !!R.querySelector('.akt0'), door: [...R.querySelectorAll('.u.ht')].some((e) => /Bakdør/.test(e.textContent)) }; });
ok('20.13 Aktuelt: aktiv dør vises som flis, ingen rom, ingen tom-tilstand', ak2.door && !ak2.rooms && !ak2.empty, ak2);
if (SHOTS) await p.screenshot({ path: SHOTS + '/f20-aktuelt.png' });

// Tilpass Hjem → Kort → Aktuelt
await p.evaluate(async () => { window.MSH.openHomeEditor(); await new Promise((q) => setTimeout(q, 600)); });
const all = `(() => { const o = []; const w = (r) => r.querySelectorAll('*').forEach((e) => { o.push(e); if (e.shadowRoot) w(e.shadowRoot); }); w(document); return o; })()`;
const edR = `(${all}.find((e) => e.dataset && e.dataset.key === 'ed') || {}).getRootNode()`;
await p.evaluate(`(() => { const R = ${edR}; const b = R.querySelector('[data-a="ctx"][data-v="aktuelt"]'); b && b.click(); })()`);
await W(500);
const ke = await p.evaluate(`(() => { const R = ${edR}; return { txt: (R.querySelector('[data-key="aktnorom"]') || {}).textContent, grid: !!R.querySelector('.gr'), add: !!R.querySelector('[data-a="pick"]'), lights: !!R.querySelector('[data-key="akt-lights"]'), types: R.querySelectorAll('[data-a="akttype"]').length }; })()`);
ok('20.13 Tilpass Hjem → Kort → Aktuelt: ingen rom-kolonner/«+ rom», forklaringstekst', ke.txt && /Aktuelt viser ikke rom, bare kort som er aktive nå/.test(ke.txt) && !ke.grid && !ke.add, ke);
// Hjem-fanen: flis-editoren for Alarm har «Tekst per tilstand»
await p.evaluate(`(() => { const R = ${edR}; const b = R.querySelector('[data-a="ctx"][data-v="hjem"]'); b && b.click(); })()`);
await p.evaluate(async () => { const c = window.__c; c._pickTab(c._TV.findIndex((t) => t.id === 'hjem')); await new Promise((q) => setTimeout(q, 300)); });
await W(400);
await p.evaluate(`(() => { const R = ${edR}; const b = R.querySelector('[data-a="acc"][data-v="snar"]'); b && b.click(); })()`);
await W(400);
await p.evaluate(`(() => { const R = ${edR}; const b = R.querySelector('.zr[data-key="zr-alarm"] .zch'); b && b.click(); })()`);
await W(500);
const sx = await p.evaluate(`(() => { const R = ${edR}; const s = R.querySelector('[data-key$="-stxs-alarm"]'); if (!s) return null; const rows = [...s.querySelectorAll('.stx')]; const cur = rows.find((r) => /nå/.test(r.querySelector('span span').textContent)); const inp = s.querySelector('input[data-f="state_text.armed_away.title"]'); return { head: s.textContent.slice(0, 80), n: rows.length, cur: cur && cur.querySelector('span span').textContent, curBg: cur && getComputedStyle(cur.querySelector('span span')).backgroundColor, val: inp && inp.value, std: !!s.querySelector('[data-a="testd"][data-v="armed_away"]'), ph: (s.querySelector('input[data-f="state_text.pending.title"]') || {}).placeholder }; })()`);
ok('20.7 Tilpass Hjem → Kort: «Tekst per tilstand» med entitet og nå-tilstand', sx && /Tekst per tilstand/.test(sx.head) && /alarm_control_panel\.hjem · nå: disarmed/.test(sx.head), sx);
ok('20.7 rad per tilstand, grønn chip for nå, «Standard» når overstyrt, plassholder = standard', sx && sx.n >= 11 && /^disarmed/.test(sx.cur) && sx.curBg !== 'rgba(255, 255, 255, 0.08)' && sx.val === 'Sikret' /* GUI-editorens lagring over (samme config) */ && sx.std && sx.ph === 'Venter' /* Fiks 25: standard = MSH.alarmState-teksten, som flisen */, sx);
await p.evaluate(`(() => { const R = ${edR}; const i = R.querySelector('[data-key$="-stxs-alarm"] input[data-f="state_text.disarmed.sub"]'); i.value = 'Alarmen er av'; i.dispatchEvent(new Event('change', { bubbles: true })); })()`);
await W(600);
al = await tile('alarm');
ok('20.7 endring i Tilpass Hjem vises live på flisen', al && al.sub === 'Alarmen er av', al);
await p.evaluate(`(() => { const R = ${edR}; R.querySelector('[data-a="testd"][data-v="disarmed"]').click(); })()`);
await W(600);
al = await tile('alarm');
ok('20.7 «Standard» fjerner overstyringen', al && al.sub === 'Alarm', al);
if (SHOTS) await p.screenshot({ path: SHOTS + '/f20-stx.png' });

ok('ingen JS-feil', !errs.length, errs.slice(0, 3));
await b.close();
console.log(res.join('\n'));
const bad = res.filter((r) => r.startsWith('✘')).length;
console.log(bad ? `\n${bad} feil` : '\nAlt OK');
process.exit(bad ? 1 : 0);
