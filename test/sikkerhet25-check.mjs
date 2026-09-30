// Fiks 24.6 (status-entitet + state_map, MSH.alarmState) og 24.7 («Siste hendelser»: hvem låste opp døra).
//   node test/sikkerhet25-check.mjs
import { createRequire } from 'node:module';
import { readdirSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
mkdirSync('test/.build', { recursive: true });
const bundle = resolve(`test/.build/sikkerhet25-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const shots = process.env.SHOTS || '';
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const res = {}, fail = [];
const ok = (name, cond, info) => { res[name] = cond ? 'OK' : ['FEIL', info]; if (!cond) fail.push(name); };
const mocks = readdirSync('test/mock').sort().map((m) => resolve('test/mock/' + m));
const errs = [];
async function page(vp) {
  const p = await b.newPage({ viewport: vp || { width: 430, height: 1000 }, hasTouch: true });
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + resolve('test/harness.html'));
  for (const m of mocks) await p.addScriptTag({ path: m });
  await p.addScriptTag({ path: bundle });
  return p;
}
// Felles oppsett i siden: select-status + ansiktsgjenkjenning med historikk
const SETUP = (noAlarm) => {
  const h = window.mockHass(), S = h.states, now = Date.now();
  S['select.alarm_homealarm_state'] = { entity_id: 'select.alarm_homealarm_state', state: 'armed', attributes: { friendly_name: 'Alarm status', options: ['armed', 'disarmed', 'partially_armed'] }, last_changed: new Date(now - 600000).toISOString(), last_updated: new Date(now - 600000).toISOString() };
  S['sensor.ansiktsgjenkjenning_dorlas_sist_last_opp_av'] = { entity_id: 'sensor.ansiktsgjenkjenning_dorlas_sist_last_opp_av', state: 'Rune', attributes: { friendly_name: 'Sist låst opp av' }, last_changed: new Date(now - 3600000).toISOString(), last_updated: new Date(now - 3600000).toISOString() };
  if (noAlarm) delete S['alarm_control_panel.hjem'];
  const ws = h.callWS;
  window.__hist = 0;
  h.callWS = (m) => {
    if (m.type === 'history/history_during_period' && (m.entity_ids || []).includes('sensor.ansiktsgjenkjenning_dorlas_sist_last_opp_av')) {
      window.__hist++;
      const t = now / 1000;
      return Promise.resolve({ 'sensor.ansiktsgjenkjenning_dorlas_sist_last_opp_av': [
        { s: 'unknown', lu: t - 86400 }, { s: 'Cybele', lu: t - 3 * 3600 }, { s: 'unavailable', lu: t - 2 * 3600 }, { s: 'Rune', lu: t - 3600 },
      ] });
    }
    return ws(m);
  };
  window.__h = h;
  return h;
};
const W = (p, ms) => p.evaluate((ms) => new Promise((q) => setTimeout(q, ms)), ms);

/* ---------------------------------------------------------------- 24.6 · popupen + Hjem */
const p = await page();
await p.evaluate(`(${SETUP.toString()})(false)`);
const A = await p.evaluate(async () => {
  const w = (ms) => new Promise((q) => setTimeout(q, ms));
  const h = window.__h;
  const bc = document.createElement('bubble-card');
  bc.setConfig({ type: 'custom:bubble-card', card_type: 'pop-up', hash: '#sikkerhet' });
  bc.innerHTML = '<div class="pop"><div class="hdr">Sikkerhet</div><div class="inner"></div></div>';
  document.getElementById('dash').appendChild(bc);
  const f = document.createElement('msh-hjem-faner-card');
  f.setConfig({ type: 'custom:msh-hjem-faner-card', card_id: 'f246', tabs: { hjem: { auto_fill: false, cards: ['alarm'] } }, tiles: { hjem: { alarm: { slot: 'L-top', stack: false } } } });
  f.hass = h;
  document.getElementById('dash').appendChild(f);
  location.hash = '#sikkerhet';
  const c = document.createElement('msh-sikkerhet-card');
  c.setConfig({ type: 'custom:msh-sikkerhet-card', card_id: 'pop-sikkerhet', state_entity: 'select.alarm_homealarm_state', code_for: 'aldri' });
  c.hass = h;
  bc.querySelector('.inner').appendChild(c);
  window.__c = c; window.__f = f;
  await w(900);
  const sr = c.shadowRoot, hero = sr.querySelector('msh-sikkerhet-hero-card');
  const tl = f.shadowRoot.querySelector('.u.ht[data-k="alarm"]');
  return {
    st: window.MSH.alarmState(h, c.config),
    act: [...sr.querySelectorAll('.mode.act')].map((e) => e.dataset.mode),
    hero: hero && hero.shadowRoot.querySelector('.ml') && hero.shadowRoot.querySelector('.ml').textContent,
    tile: tl && tl.querySelector('.u-l').textContent, tileBg: tl && getComputedStyle(tl).backgroundImage,
  };
});
ok('24.6 alarmState: armed → Borte «Armert borte»', A.st.mode === 'borte' && A.st.text === 'Armert borte' && A.st.entity === 'select.alarm_homealarm_state', A.st);
ok('24.6 popup: Borte-knappen aktiv', A.act.join() === 'borte', A.act);
ok('24.6 popup: toppkortet viser «Armert borte»', A.hero === 'Armert borte', A.hero);
ok('24.6 Hjem: alarm-flisen viser «Armert borte» (rosa)', A.tile === 'Armert borte' && /gradient/.test(A.tileBg || ''), A);
const D = await p.evaluate(() => {
  const M = window.MSH, h = window.__h;
  const S = { ...h.states };
  const set = (v) => { S['select.alarm_homealarm_state'] = { ...S['select.alarm_homealarm_state'], state: v }; return M.alarmState({ ...h, states: S }, { state_entity: 'select.alarm_homealarm_state' }); };
  return { p: set('partially_armed'), d: set('disarmed'), u: set('noe_rart'), n: M.alarmState(h, {}) };
});
ok('24.6 standard: partially_armed → Hjemme «Delvis armert», disarmed → Av «Av»', D.p.mode === 'hjemme' && D.p.text === 'Delvis armert' && D.d.mode === 'av' && D.d.text === 'Av', D);
ok('24.6 ukjent tilstand → rå verdi, modus Av', D.u.mode === 'av' && D.u.text === 'noe_rart', D.u);
ok('24.6 uten state_entity → alarm_control_panel', D.n.entity === 'alarm_control_panel.hjem' && D.n.text === 'Av', D.n);

// Editor (getConfigElement = samme skjema som kortets eget ark): «Status og tekst» før «Kode», rad per tilstand
const E = await p.evaluate(async () => {
  const w = (ms) => new Promise((q) => setTimeout(q, ms));
  const ed = customElements.get('msh-sikkerhet-card').getConfigElement();
  ed.setConfig({ ...window.__c._yamlConfig });
  ed.hass = window.__h;
  document.body.appendChild(ed);
  window.__ed = ed;
  let last = null;
  ed.addEventListener('config-changed', (e) => { last = e.detail.config; });
  await w(200);
  const R = ed.shadowRoot, secs = [...R.querySelectorAll('details.sec > summary')].map((s) => s.textContent.trim());
  const st = R.querySelector('details[data-focus="status"]');
  if (st) st.open = true;
  const rows = st ? [...st.querySelectorAll('[data-key^="st-"]')].map((r) => ({ raw: r.querySelector('code').textContent, now: /nå/.test(r.querySelector('.line').textContent), on: (r.querySelector('.chip.on') || {}).textContent, ph: r.querySelector('input').placeholder })) : [];
  // Bytt armed → Hjemme
  const btn = R.querySelector('[data-name="state_map.armed.mode"][data-v="hjemme"]');
  btn && btn.click();
  await w(100);
  const cfg1 = last;
  // Tekst for disarmed
  const inp = R.querySelector('input[data-name="state_map.armed.text"]');
  if (inp) { inp.value = 'Skallsikring'; inp.dispatchEvent(new Event('change', { bubbles: true })); }
  await w(100);
  return { secs, rows, cfg1, cfg2: last, unlock: !!R.querySelector('[data-focus="unlock"]'), stEnt: !!R.querySelector('[data-name="state_entity"]') };
});
const iS = E.secs.findIndex((s) => /Status og tekst/.test(s)), iK = E.secs.findIndex((s) => /^Kode/.test(s));
ok('24.6 editor: «Status og tekst» før «Kode», med entitetsvelger', iS >= 0 && iK > iS && E.stEnt, E.secs);
ok('24.6 editor: rad per option, «nå»-merke, segment + tekst (plassholder = standard)', E.rows.map((r) => r.raw).join() === 'armed,disarmed,partially_armed' && E.rows[0].now && E.rows[0].on === 'Borte' && E.rows[0].ph === 'Armert borte' && E.rows[2].on === 'Hjemme', E.rows);
ok('24.6 editor: segment lagrer state_map.armed.mode', E.cfg1 && E.cfg1.state_map && E.cfg1.state_map.armed.mode === 'hjemme', E.cfg1);
ok('24.6 editor: tekstfelt lagrer state_map.armed.text', E.cfg2 && E.cfg2.state_map.armed.text === 'Skallsikring', E.cfg2);
// Kortet får ny config (samme vei som begge editorene) → popup og Hjem oppdateres umiddelbart
const U = await p.evaluate(async () => {
  const w = (ms) => new Promise((q) => setTimeout(q, ms));
  const c = window.__c, f = window.__f;
  c.setConfig({ ...window.__ed._config, __eff: 1 });
  await w(400);
  const tl = f.shadowRoot.querySelector('.u.ht[data-k="alarm"]');
  return { act: [...c.shadowRoot.querySelectorAll('.mode.act')].map((e) => e.dataset.mode), hero: c.shadowRoot.querySelector('msh-sikkerhet-hero-card').shadowRoot.querySelector('.ml').textContent, tile: tl && tl.querySelector('.u-l').textContent };
});
ok('24.6 endret mapping/tekst → popup (Hjemme aktiv, «Skallsikring») og Hjem-flisen oppdateres straks', U.act.join() === 'hjemme' && U.hero === 'Skallsikring' && U.tile === 'Skallsikring', U);
if (shots) await p.screenshot({ path: shots + '/sik25-popup.png', fullPage: true });

/* ---------------------------------------------------------------- 24.7 · Siste hendelser */
const L = await p.evaluate(async () => {
  const w = (ms) => new Promise((q) => setTimeout(q, ms));
  const c = window.__c;
  c._loadLog();
  await w(500);
  const rows = [...c.shadowRoot.querySelectorAll('.log .ev')].map((e) => {
    const av = e.querySelector('.eva');
    return { text: e.querySelector('.evb .col > div').textContent, who: e.querySelector('.evb .evw').textContent, av: av ? { img: av.querySelector('img') && av.querySelector('img').getAttribute('src'), txt: av.textContent, bg: av.style.background, w: av.getBoundingClientRect().width } : null };
  });
  return { rows, hist: window.__hist };
});
const pr = L.rows.filter((r) => r.av);
ok('24.7 historikk hentet (history_during_period) og personrader i loggen', L.hist === 1 && pr.length === 2, L);
ok('24.7 nyeste øverst: «Rune låste opp …» før Cybele, undertekst «Ansiktsgjenkjenning»', pr[0] && /^Rune låste opp /.test(pr[0].text) && /^Cybele låste opp /.test(pr[1].text) && pr[0].who === 'Ansiktsgjenkjenning', pr);
ok('24.7 uten bilde: forbokstav i personfarge (Rune blå, Cybele grønn), 28 px', pr[0] && pr[0].av.txt === 'R' && /blue/.test(pr[0].av.bg) && pr[1].av.txt === 'C' && /green/.test(pr[1].av.bg) && pr[0].av.w === 28, pr);
ok('24.7 unknown/unavailable gir ingen rader', !L.rows.some((r) => /unknown|unavailable/.test(r.text)), L.rows);
// Ny opplåsing: Sebastian (har bilde) → ny rad øverst med bildet
const N = await p.evaluate(async () => {
  const w = (ms) => new Promise((q) => setTimeout(q, ms));
  const h = window.__h, S = { ...h.states }, t = new Date().toISOString();
  S['sensor.ansiktsgjenkjenning_dorlas_sist_last_opp_av'] = { ...S['sensor.ansiktsgjenkjenning_dorlas_sist_last_opp_av'], state: 'Sebastian', last_changed: t, last_updated: t };
  window.__h = { ...h, states: S };
  window.__c.hass = window.__h;
  await w(400);
  const e = window.__c.shadowRoot.querySelector('.log .ev'), av = e && e.querySelector('.eva');
  return { text: e && e.querySelector('.evb .col > div').textContent, img: av && av.querySelector('img') && av.querySelector('img').getAttribute('src'), fit: av && av.querySelector('img') && getComputedStyle(av.querySelector('img')).objectFit, ring: av && getComputedStyle(av).boxShadow, hist: window.__hist };
});
ok('24.7 ny opplåsing → øverst med personens bilde (object-fit cover, ring #282828)', /^Sebastian låste opp /.test(N.text || '') && /seb\.jpg/.test(N.img || '') && N.fit === 'cover' && /rgb\(40, 40, 40\)/.test(N.ring || ''), N);
ok('24.7 historikken mellomlagres (ingen ny henting)', N.hist === 1, N.hist);
const O = await p.evaluate(async () => {
  const w = (ms) => new Promise((q) => setTimeout(q, ms));
  const M = window.MSH, h = window.__h;
  const auto = M.sikUnlockAuto(h), ov = M.sikPerson(h, { unlock_people: { Rune: 'person.cybele' } }, 'rune'), unk = M.sikPerson(h, {}, 'Ola');
  const ed = window.__ed, sec = ed.shadowRoot.querySelector('details[data-focus="unlock"]');
  return { auto, ov: ov.id, unk, fld: !!(sec && sec.querySelector('[data-name="unlock_sensor"]')), ppl: sec ? [...sec.querySelectorAll('[data-name^="unlock_people."]')].map((x) => x.dataset.name).filter((v, i, a) => a.indexOf(v) === i) : [] };
});
ok('24.7 autoforslag for «Hvem låste opp» (ansikt|face|last_opp|unlocked_by)', O.auto === 'sensor.ansiktsgjenkjenning_dorlas_sist_last_opp_av', O.auto);
ok('24.7 unlock_people overstyrer (uten store/små bokstaver)', O.ov === 'person.cybele', O.ov);
ok('24.7 ukjent navn → navnet + grå forbokstav', O.unk.id === null && O.unk.name === 'Ola' && O.unk.initial === 'O' && /gray/.test(O.unk.color), O.unk);
ok('24.7 editor: sensorvelger + personkobling per navn', O.fld && O.ppl.includes('unlock_people.Rune'), O);
// Uten sensor: ingen personrader
const Z = await p.evaluate(async () => {
  const w = (ms) => new Promise((q) => setTimeout(q, ms));
  const h = window.__h, S = { ...h.states };
  delete S['sensor.ansiktsgjenkjenning_dorlas_sist_last_opp_av'];
  window.__h = { ...h, states: S };
  window.__c.hass = window.__h;
  window.__c.update();
  await w(300);
  return { av: window.__c.shadowRoot.querySelectorAll('.log .eva').length, ev: window.__c.shadowRoot.querySelectorAll('.log .ev').length };
});
ok('24.7 uten sensor: ingen personrader, resten av loggen som før', Z.av === 0 && Z.ev > 0, Z);
await p.close();

/* ---------------------------------------------------------------- 24.6 · handlinger */
const q = await page();
await q.evaluate(`(${SETUP.toString()})(true)`);
const H = await q.evaluate(async () => {
  const w = (ms) => new Promise((q) => setTimeout(q, ms));
  const c = document.createElement('msh-sikkerhet-card');
  c.setConfig({ type: 'custom:msh-sikkerhet-card', card_id: 'pop-sikkerhet', state_entity: 'select.alarm_homealarm_state' });
  c.hass = window.__h;
  document.getElementById('dash').appendChild(c);
  await w(400);
  window.__calls.length = 0;
  const hold = async (k) => {
    const bt = c.shadowRoot.querySelector(`.mode[data-mode="${k}"]`), r = bt.getBoundingClientRect(), o = { bubbles: true, composed: true, clientX: r.left + 10, clientY: r.top + 10, pointerId: 5, button: 0 };
    bt.dispatchEvent(new PointerEvent('pointerdown', o));
    await w(1150);
    bt.dispatchEvent(new PointerEvent('pointerup', o));
    await w(150);
  };
  await hold('av');
  const a = window.__calls.filter((x) => x[0] !== 'ws').slice();
  window.__calls.length = 0;
  await hold('hjemme');
  const b = window.__calls.filter((x) => x[0] !== 'ws').slice();
  return { a, b, empty: !!c.shadowRoot.querySelector('.empty, [data-act="customize"].empty') };
});
ok('24.6 select uten alarmpanel: Av → select.select_option «disarmed»', H.a.length === 1 && H.a[0][0] === 'select' && H.a[0][1] === 'select_option' && H.a[0][2].option === 'disarmed' && H.a[0][2].entity_id === 'select.alarm_homealarm_state', H.a);
ok('24.6 select: Hjemme → første tilstand mappet til Hjemme («partially_armed»)', H.b.length === 1 && H.b[0][2].option === 'partially_armed', H.b);
await q.close();
// Med alarmpanel: modusknappene kaller fortsatt alarm_control_panel.* på alarm-entiteten
const r = await page();
await r.evaluate(`(${SETUP.toString()})(false)`);
const K = await r.evaluate(async () => {
  const w = (ms) => new Promise((q) => setTimeout(q, ms));
  const c = document.createElement('msh-sikkerhet-card');
  c.setConfig({ type: 'custom:msh-sikkerhet-card', card_id: 'pop-sikkerhet', state_entity: 'select.alarm_homealarm_state', code_for: 'aldri' });
  c.hass = window.__h;
  document.getElementById('dash').appendChild(c);
  await w(400);
  window.__calls.length = 0;
  const bt = c.shadowRoot.querySelector('.mode[data-mode="hjemme"]'), rr = bt.getBoundingClientRect(), o = { bubbles: true, composed: true, clientX: rr.left + 10, clientY: rr.top + 10, pointerId: 6, button: 0 };
  bt.dispatchEvent(new PointerEvent('pointerdown', o));
  await w(1150);
  bt.dispatchEvent(new PointerEvent('pointerup', o));
  await w(150);
  return window.__calls.filter((x) => x[0] !== 'ws');
});
ok('24.6 med alarmpanel: Hjemme → alarm_control_panel.alarm_arm_home på alarm-entiteten', K.length === 1 && K[0][0] === 'alarm_control_panel' && K[0][1] === 'alarm_arm_home' && K[0][2].entity_id === 'alarm_control_panel.hjem', K);
await r.close();

ok('ingen sidefeil', !errs.length, errs);
await b.close();
for (const [k, v] of Object.entries(res)) console.log(v === 'OK' ? 'OK  ' : 'FEIL', k, v === 'OK' ? '' : JSON.stringify(v[1]).slice(0, 600));
console.log(fail.length ? `\n${fail.length} feil` : '\nAlt OK');
process.exit(fail.length ? 1 : 0);
