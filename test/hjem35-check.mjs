// Fiks 35.8 · Støvsuger-kortet på Hjem (Hjem v3 · flis kind 'vacr').
//  · tittel = robotnavn, undertekst «Rengjør stue · 62 %» (grønn tone) / «Pauset i stue» (amber) / øvrige tilstander;
//    rommet fra attributtene (current_room, segment-id → rooms) eller registeret – aldri gjettet; I laderen = skjult
//  · trykk på kortet → popupen med msh-stovsuger-card (strategien: #rolf; popupReport vinner), ikon-trykk → vacuum.start/pause
//  · flere kort med egen entity (tile_cfg.vacr_2), «Tilpass Hjem» → Kort → + → Støvsuger (neste ledige robot),
//    GUI-editoren (getConfigElement) «+ Legg til støvsuger» (samme regel)
//  · lys + mørk: tekstkontrast ≥ 4,5:1 i lys, mørk = samme farger som før (TV_N / tone-fargene)
// Kjør: node test/hjem35-check.mjs
import { createRequire } from 'node:module';
import { readdirSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
mkdirSync('test/.build', { recursive: true });
const bundle = resolve(`test/.build/hjem35-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: 430, height: 1100 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto('file://' + resolve('test/harness.html'));
for (const m of readdirSync('test/mock').sort()) await p.addScriptTag({ path: resolve('test/mock/' + m) });
await p.addScriptTag({ path: bundle });
const fail = [], out = [];
const ok = (name, cond, info) => { out.push(`${cond ? '✔' : '✘'} ${name}${cond || info === undefined ? '' : ' · ' + JSON.stringify(info)}`); if (!cond) fail.push(name); };

await p.evaluate(async () => {
  document.documentElement.style.background = document.body.style.background = 'var(--ki-bg, #232323)';
  const H = window.mockHass(), S = H.states;
  S['vacuum.sir_sweeps'] = { ...S['vacuum.sir_sweeps'], state: 'cleaning', attributes: { friendly_name: 'Sir Sweeps', battery_level: 62 } };
  S['vacuum.sir_sweeps_a_lot'] = { ...S['vacuum.sir_sweeps_a_lot'], state: 'paused', attributes: { ...S['vacuum.sir_sweeps_a_lot'].attributes, friendly_name: 'Rolf', current_segment: 17, rooms: { kart: [{ id: 16, name: 'Bad' }, { id: 17, name: 'Kjøkken' }] } } };
  window.H = H;
  window.__cfg = { type: 'custom:msh-hjem-faner-card', card_id: 'ki-faner-h35',
    tabs: { hjem: { auto_fill: false, cards: ['vacr', 'vacr_2', 'rom:stue'] } },
    tile_cfg: { vacr: { side: 'L', pos: 'top' }, vacr_2: { kind: 'vacr', entity: 'vacuum.sir_sweeps_a_lot', side: 'L', pos: 'top' } },
    tiles: { hjem: { vacr: { slot: 'L-top' }, vacr_2: { slot: 'L-top' } } }, swipe: { hjem: { 'L-top': false } } };
  const c = document.createElement('msh-hjem-faner-card');
  c.setConfig(window.__cfg); c.hass = H;
  document.getElementById('dash').appendChild(c);
  window.__c = c;
  window.setSt = async (id, state, attrs) => { const h = { ...window.H, states: { ...window.H.states, [id]: { ...window.H.states[id], state, attributes: { ...window.H.states[id].attributes, ...(attrs || {}) } } } }; window.H = h; window.__c.hass = h; await new Promise((q) => setTimeout(q, 250)); };
  window.setMode = async (dark) => { const h = { ...window.H, themes: { ...(window.H.themes || {}), darkMode: dark } }; window.H = h; window.__c.hass = h; await new Promise((q) => setTimeout(q, 400)); };
  await new Promise((q) => setTimeout(q, 800));
});
// flis: tekst + farger (effektiv bakgrunn = flisens farge lagt over dashbordet)
const tile = (k) => p.evaluate((k) => {
  const el = window.__c.shadowRoot.querySelector(`.u.ht[data-k="${k}"]`); if (!el) return null;
  const r = el.getBoundingClientRect(), n = el.querySelector('.u-n'), l = el.querySelector('.u-l'), ic = el.querySelector('[data-w="ic"]');
  const P = (s) => { const c = /color\(srgb ([^)]+)\)/.exec(s || ''); if (c) { const q = c[1].split(/[ /]+/).filter(Boolean).map(Number); return [q[0] * 255, q[1] * 255, q[2] * 255, q[3] == null ? 1 : q[3]]; } const m = /rgba?\(([^)]+)\)/.exec(s || ''); return m ? m[1].split(/[ ,/]+/).filter(Boolean).map(Number) : null; };
  const dash = P(getComputedStyle(document.body).backgroundColor) || [35, 35, 35];
  const bg = P(getComputedStyle(el).backgroundColor) || [0, 0, 0, 0], a = bg[3] == null ? 1 : bg[3];
  const eff = [0, 1, 2].map((i) => Math.round(bg[i] * a + dash[i] * (1 - a)));
  return { x: r.left + r.width * 0.75, y: r.top + r.height / 2, ix: r.left + 30, title: l && l.textContent, sub: n && n.textContent, fg: l && getComputedStyle(l).color, subFg: n && getComputedStyle(n).color, bg: getComputedStyle(el).backgroundColor, eff: `rgb(${eff.join(', ')})`, icFg: ic && getComputedStyle(ic).color, sh: getComputedStyle(el).boxShadow, icon: !!el.querySelector('svg, ha-icon') };
}, k);
const lum = (s) => { const m = /rgba?\(([^)]+)\)/.exec(s || ''); if (!m) return null; const q = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); const f = (u) => { u /= 255; return u <= 0.03928 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4); }; return 0.2126 * f(q[0]) + 0.7152 * f(q[1]) + 0.0722 * f(q[2]); };
const cr = (a, c) => { const x = lum(a), y = lum(c); if (x == null || y == null) return 0; return +((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)).toFixed(2); };

/* --- tilstander --- */
const GREEN = /102, 209, 158|srgb 0\.4 0\.8196/, AMBER = /242, 181, 115|srgb 0\.949\d* 0\.7098/;
let v = await tile('vacr');
ok('kortet finnes med robot-ikon', !!v && v.icon, v);
ok('tittel = robotnavn', v && v.title === 'Sir Sweeps', v && v.title);
ok('rengjør: «Rengjør stue · 62 %» (rom fra registeret)', v && v.sub === 'Rengjør stue · 62 %', v && v.sub);
const darkRun = v;
ok('rengjør: grønn tone (flis tonet grønt)', v && GREEN.test(v.bg) && GREEN.test(v.sh), { bg: v && v.bg, sh: v && v.sh });
const v2 = await tile('vacr_2');
ok('flere kort: andre robot med egen entity («Rolf»)', v2 && v2.title === 'Rolf', v2 && v2.title);
ok('pauset: «Pauset i kjøkken» (segment-id → rooms-attributtet) + amber tone', v2 && v2.sub === 'Pauset i kjøkken' && AMBER.test(v2.bg), v2 && [v2.sub, v2.bg]);
await p.evaluate(() => setSt('vacuum.sir_sweeps', 'cleaning', { current_room: 'Bad' }));
v = await tile('vacr');
ok('attributtet current_room vinner over registeret', v && v.sub === 'Rengjør bad · 62 %', v && v.sub);
await p.evaluate(() => setSt('vacuum.sir_sweeps', 'paused', { current_room: null }));
v = await tile('vacr');
ok('pauset uten attributt: «Pauset i stue»', v && v.sub === 'Pauset i stue', v && v.sub);
const darkPause = v;
const noRoom = await p.evaluate(() => { const h = { ...window.H, entities: { ...window.H.entities } }; delete h.entities['vacuum.sir_sweeps']; const m = window.__c._kindModel.call({ ...window.__c, hass: h, config: window.__c.config, s: (id) => h.states[id], _aIcon: () => '', _toast: () => {} }, 'vacr', { vacr: 'vacuum.sir_sweeps' }); return m && m.sub; });
ok('uten rom (ingen attributt/område): «Pauset» – ikke gjettet', noRoom === 'Pauset', noRoom);
for (const [st, want, hide] of [['returning', /^Kjører hjem · 62 %$/], ['idle', /^Klar · 62 %$/], ['error', /^Feil/], ['unavailable', /^Utilgjengelig$/], ['docked', null, true]]) {
  await p.evaluate((s) => setSt('vacuum.sir_sweeps', s), st);
  v = await tile('vacr');
  if (hide) ok(`${st}: kortet skjules (som designet)`, !v, v && v.sub);
  else ok(`${st}: ${want}`, v && want.test(v.sub), v && v.sub);
}
await p.evaluate(() => setSt('vacuum.sir_sweeps', 'cleaning', { current_room: null }));

/* --- trykk --- */
const hashAfter = async (fn) => p.evaluate(async (fn) => { history.replaceState(null, '', location.pathname); window.__calls.length = 0; await new Promise((q) => setTimeout(q, 50)); await window[fn](); await new Promise((q) => setTimeout(q, 400)); return { hash: location.hash, calls: window.__calls.filter((c) => c[0] === 'vacuum').map((c) => [c[1], c[2] && c[2].entity_id]) }; }, fn);
await p.evaluate(() => {
  const click = (k, w) => { const el = window.__c.shadowRoot.querySelector(`.u.ht[data-k="${k}"]` + (w === 'ic' ? ' [data-w="ic"]' : '')); const r = el.getBoundingClientRect(); const x = w === 'ic' ? r.left + r.width / 2 : r.left + r.width * 0.8, y = r.top + r.height / 2; ['pointerdown', 'pointerup'].forEach((t) => el.dispatchEvent(new PointerEvent(t, { bubbles: true, composed: true, clientX: x, clientY: y }))); el.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, clientX: x, clientY: y })); };
  window.tapCard = () => click('vacr', 'card'); window.tapIc = () => click('vacr', 'ic'); window.tapIc2 = () => click('vacr_2', 'ic');
});
let r = await hashAfter('tapCard');
ok('trykk på kortet → Sir Sweeps-popupen (#rolf)', r.hash === '#rolf', r);
await p.evaluate(() => { window.MSH.popupReport = { entries: [{ hash: '#robot', hidden: false, config: { type: 'custom:bubble-card', cards: [{ type: 'vertical-stack', cards: [{ type: 'custom:msh-stovsuger-card', entities: { vacuum: 'vacuum.sir_sweeps' } }] }] } }, { hash: '#rolf', hidden: true, config: null }] }; window.__c.update && window.__c.update(); });
r = await hashAfter('tapCard');
ok('popupen som har msh-stovsuger-card vinner (popupReport → #robot)', r.hash === '#robot', r);
await p.evaluate(() => { window.MSH.popupReport = null; });
r = await hashAfter('tapIc');
ok('ikon-trykk (rengjør) → vacuum.pause', r.calls.length === 1 && r.calls[0][0] === 'pause' && r.calls[0][1] === 'vacuum.sir_sweeps' && r.hash === '', r);
r = await hashAfter('tapIc2');
ok('ikon-trykk (pauset, kort 2) → vacuum.start på egen entity', r.calls.length === 1 && r.calls[0][0] === 'start' && r.calls[0][1] === 'vacuum.sir_sweeps_a_lot', r);

/* --- lys / mørk --- */
await p.evaluate(() => setSt('vacuum.sir_sweeps', 'cleaning', { current_room: null }));
const dk = { run: await tile('vacr'), pause: await tile('vacr_2') };
ok('mørk: tittel #fafafa, undertekst dagens grå', dk.run.fg === 'rgb(250, 250, 250)' && dk.pause.fg === 'rgb(250, 250, 250)', [dk.run.fg, dk.run.subFg, dk.pause.subFg]);
ok('mørk: samme farger som før (tone 14 % + kant 40 %)', dk.run.bg === darkRun.bg && dk.run.sh === darkRun.sh && dk.pause.bg === v2.bg, [dk.run.bg, darkRun.bg]);
await p.evaluate(() => setMode(false));
const lt = { run: await tile('vacr'), pause: await tile('vacr_2') };
for (const [k, t] of Object.entries(lt)) {
  ok(`lys (${k}): tittel ≥ 4,5:1`, cr(t.fg, t.eff) >= 4.5, { fg: t.fg, bg: t.eff, k: cr(t.fg, t.eff) });
  ok(`lys (${k}): undertekst ≥ 4,5:1`, cr(t.subFg, t.eff) >= 4.5, { fg: t.subFg, bg: t.eff, k: cr(t.subFg, t.eff) });
  ok(`lys (${k}): ingen hvit tekst på lys flate`, lum(t.fg) < 0.2 && lum(t.subFg) < 0.4, [t.fg, t.subFg]);
}
await p.evaluate(() => setMode(true));
const dk2 = await tile('vacr');
ok('tilbake til mørk uten reload: samme farger', dk2.bg === dk.run.bg && dk2.fg === dk.run.fg && dk2.subFg === dk.run.subFg, [dk2.bg, dk2.subFg]);

/* --- Tilpass Hjem → Kort: + → Støvsuger --- */
await p.evaluate(async () => {
  window.H = { ...window.H, states: { ...window.H.states, 'vacuum.tredje': { entity_id: 'vacuum.tredje', state: 'cleaning', attributes: { friendly_name: 'Tredje', battery_level: 40 }, last_changed: new Date().toISOString(), last_updated: new Date().toISOString() } } };
  window.__c.hass = window.H;
  window.MSH.openHomeEditor({ focus: 'tab-hjem' }); await new Promise((q) => setTimeout(q, 500));
});
const all = `(() => { const o = []; const w = (r) => r.querySelectorAll('*').forEach((e) => { o.push(e); if (e.shadowRoot) w(e.shadowRoot); }); w(document); return o; })()`;
const edRoot = `(${all}.find((e) => e.dataset && e.dataset.key === 'ed') || {}).getRootNode()`;
const clickA = async (sel) => { const q = await p.evaluate(`(() => { const R = ${edRoot}; const el = R.querySelector(${JSON.stringify(sel)}); if (!el) return null; el.scrollIntoView({ block: 'center' }); const b = el.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; })()`); if (q) { await p.mouse.click(q.x, q.y); await p.waitForTimeout(350); } return !!q; };
await clickA('[data-a="acc"][data-v="snar"]');
const opened = await clickA('[data-a="zaddopen"][data-v="R-bottom"]');
const lbl = await p.evaluate(`(() => { const R = ${edRoot}; const b = R.querySelector('[data-a="zadd"][data-v="vacr"]'); return b ? b.textContent.trim() : null; })()`);
ok('Tilpass Hjem → Kort: «Støvsuger» i + -valgene', opened && /Støvsuger/.test(lbl || ''), lbl);
await clickA('[data-a="zadd"][data-v="vacr"]');
const cfgEd = await p.evaluate(`(() => { const R = ${edRoot}; const ed = window.MSH.openHomeEditor(); const F = ed.F ? ed.F() : ed._F; const tc = (F && F.tile_cfg) || {}; return { ids: Object.keys(tc).filter((k) => /^vacr/.test(k)).map((k) => [k, tc[k].entity || null, tc[k].kind || null]), cards: ((F.tabs || {}).hjem || {}).cards }; })()`);
const nyId = cfgEd.ids.find((x) => x[0] === 'vacr_3');
ok('nytt Støvsuger-kort (vacr_3) med neste ledige robot (vacuum.tredje)', nyId && nyId[1] === 'vacuum.tredje' && nyId[2] === 'vacr', cfgEd);
ok('nytt kort ligger på Hjem (tabs.hjem.cards)', cfgEd.cards && cfgEd.cards.includes('vacr_3'), cfgEd.cards);
await p.evaluate(`(() => { const ed = window.MSH.openHomeEditor(); ed.close(); })()`);
await p.waitForTimeout(300);
// alle roboter har kort → + Støvsuger åpner entitetsvelgeren
const pick = await p.evaluate(async () => {
  const c = window.__c; c.setConfig({ ...window.__cfg, tile_cfg: { ...window.__cfg.tile_cfg, vacr_3: { kind: 'vacr', entity: 'vacuum.tredje' } }, tabs: { hjem: { auto_fill: false, cards: ['vacr', 'vacr_2', 'vacr_3', 'rom:stue'] } } });
  await new Promise((q) => setTimeout(q, 300));
  const ed = window.MSH.openHomeEditor({ focus: 'tab-hjem' }); await new Promise((q) => setTimeout(q, 400));
  const free = ed._vacFree(ed._model());
  ed.close();
  return free;
});
ok('alle roboter har kort → ingen ledig (entitetsvelgeren vises i stedet)', pick === null, pick);

/* --- getConfigElement: «+ Legg til støvsuger» --- */
const gce = await p.evaluate(() => {
  const C = customElements.get('msh-hjem-faner-card'); const set = {};
  const cc = { ...window.__cfg };
  const ed = { _set: (k, v) => { set[k] = v; } };
  const F = C.schema(window.H, cc);
  const walk = (L, o) => (L || []).forEach((f) => { if (f.fields) walk(f.fields, o); if (f.type === 'button' && /Legg til støvsuger/i.test(f.label || '')) o.push(f); });
  const btns = []; walk(F, btns);
  if (!btns.length) return { err: 'fant ikke knappen', n: F ? F.length : null };
  btns[0].run(window.H, cc, ed);
  return { label: btns[0].label, set };
});
ok('getConfigElement: «+ Legg til støvsuger» → vacr_3 med ledig robot', gce && gce.set && gce.set['tile_cfg.vacr_3'] && gce.set['tile_cfg.vacr_3'].entity === 'vacuum.tredje' && gce.set['tile_cfg.vacr_3'].kind === 'vacr', gce);

ok('ingen sidefeil', !errs.length, errs);
console.log(out.join('\n'));
console.log(fail.length ? `\n${fail.length} FEIL` : '\nAlle OK');
await b.close();
process.exit(fail.length ? 1 : 0);
