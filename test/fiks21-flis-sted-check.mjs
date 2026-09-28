// Fiks 21.2 (lås/garasje/alarm: én variant per tilstand) og 21.4 (standard steder Oslo/Toten/Strømstad i «Bytt sted»).
import { createRequire } from 'node:module';
import { readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const bundle = resolve(`test/.build/f21fs-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: 430, height: 1100 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto('file://' + resolve('test/harness.html'));
for (const m of readdirSync('test/mock').sort()) await p.addScriptTag({ path: resolve('test/mock/' + m) });
await p.addScriptTag({ path: bundle });
const res = [];
const ok = (name, cond, info) => res.push((cond ? '✔ ' : '✘ ') + name + (cond ? '' : ' → ' + JSON.stringify(info)));

/* ---------------- 21.2 */
await p.evaluate(async () => {
  window.__h = window.mockHass();
  document.getElementById('dash').innerHTML = '';
  const S = window.__h.states;
  S['lock.inngangsdor'] = { ...S['lock.inngangsdor'], state: 'locked' };
  const c = document.createElement('msh-hjem-faner-card');
  c.setConfig({ type: 'custom:msh-hjem-faner-card', card_id: 'ki-faner-f21',
    tabs: { hjem: { auto_fill: false, cards: ['lock', 'alarm', 'garage'] } },
    tiles: { hjem: { lock: { slot: 'L-top', stack: false }, alarm: { slot: 'L-bottom', stack: false }, garage: { slot: 'R-top', stack: false } } }, swipe: { hjem: { 'L-top': false } },
    tile_cfg: { lock: { entity: 'lock.inngangsdor' }, alarm: { entity: 'alarm_control_panel.hjem' }, garage: { entity: 'cover.garasjeport' } } });
  c.hass = window.__h;
  document.getElementById('dash').appendChild(c);
  window.__c = c;
  await new Promise((q) => setTimeout(q, 600));
});
const setSt = (ent, state) => p.evaluate(async ([ent, state]) => { const S = { ...window.__h.states }; S[ent] = { ...S[ent], state }; window.__h = { ...window.__h, states: S }; window.__c.hass = window.__h; await new Promise((q) => setTimeout(q, 400)); }, [ent, state]);
const tile = (k) => p.evaluate((k) => {
  const el = window.__c.shadowRoot.querySelector(`.u.ht[data-k="${k}"]`); if (!el) return null;
  const n = el.querySelector('.u-n'), l = el.querySelector('.u-l'), i = el.querySelector('.u-i'), ic = i.querySelector('ha-icon');
  return { title: l && l.textContent, sub: n && n.textContent, bg: getComputedStyle(el).backgroundColor, fg: getComputedStyle(l).color, subC: n && getComputedStyle(n).color, subTr: n && getComputedStyle(n).transitionProperty + ' ' + getComputedStyle(n).transitionDuration, icC: getComputedStyle(i).color, blink: el.classList.contains('hblink'), anim: ic && getComputedStyle(ic).animationName };
}, k);
const lum = (c) => { const m = String(c).match(/[\d.]+/g).map(Number); return (0.299 * m[0] + 0.587 * m[1] + 0.114 * m[2]) / 255; };
const readable = (t) => t && Math.abs(lum(t.bg) - lum(t.subC)) > 0.25;
let t = await tile('lock');
ok('21.2 låst: nøytral #2f2f2f, tittel #fafafa, undertekst #7f7f7f', t && t.bg === 'rgb(47, 47, 47)' && t.fg === 'rgb(250, 250, 250)' && t.subC === 'rgb(127, 127, 127)' && !t.blink, t);
// Trykk → «Låser opp …» (venter på ny state, HA sier fortsatt locked)
await p.evaluate(async () => { const c = window.__c; c._lkPend = { id: 'lock.inngangsdor', from: 'locked', to: 'unlocking', t: Date.now() + 20000 }; c.update(); await new Promise((q) => setTimeout(q, 300)); });
t = await tile('lock');
ok('21.2 låser opp (ventende): nøytral, undertekst #7f7f7f (lesbar), ikon pulserer', t && t.title === 'Låser opp …' && t.bg === 'rgb(47, 47, 47)' && t.subC === 'rgb(127, 127, 127)' && t.blink && t.anim === 'htblink' && readable(t), t);
ok('21.2 undertekst uten color-transition', t && !/color/.test(t.subTr.split(' ')[0]) || /0s/.test(t.subTr), t && t.subTr);
await p.evaluate(() => { window.__c._lkPend = null; });
await setSt('lock.inngangsdor', 'unlocking');
t = await tile('lock');
ok('21.2 unlocking (HA): nøytral + puls', t && t.bg === 'rgb(47, 47, 47)' && t.subC === 'rgb(127, 127, 127)' && t.blink, t);
await setSt('lock.inngangsdor', 'unlocked');
t = await tile('lock');
ok('21.2 ulåst: solid grønn, tittel #2f2f2f, undertekst rgba(31,42,36,.75)', t && t.bg === 'rgb(102, 209, 158)' && t.fg === 'rgb(47, 47, 47)' && t.subC === 'rgba(31, 42, 36, 0.75)' && !t.blink && t.icC === 'rgb(47, 47, 47)', t);
await setSt('lock.inngangsdor', 'locking');
t = await tile('lock');
ok('21.2 låser: nøytral + puls, lesbar', t && t.bg === 'rgb(47, 47, 47)' && t.blink && readable(t), t);
await setSt('lock.inngangsdor', 'locked');
t = await tile('lock');
ok('21.2 tilbake til låst: ingen puls', t && t.bg === 'rgb(47, 47, 47)' && !t.blink && readable(t), t);
await setSt('lock.inngangsdor', 'jammed');
t = await tile('lock');
ok('21.2 jammed: nøytral, rødt ikon, undertekst #7f7f7f', t && t.bg === 'rgb(47, 47, 47)' && t.icC === 'rgb(242, 128, 115)' && t.subC === 'rgb(127, 127, 127)', t);
await setSt('cover.garasjeport', 'opening');
t = await tile('garage');
ok('21.2 garasje åpner: nøytral + puls', t && t.bg === 'rgb(47, 47, 47)' && t.blink && readable(t), t);
await setSt('cover.garasjeport', 'open');
t = await tile('garage');
ok('21.2 garasje åpen: solid grønn, lesbar undertekst', t && t.bg === 'rgb(102, 209, 158)' && t.subC === 'rgba(31, 42, 36, 0.75)', t);
await setSt('alarm_control_panel.hjem', 'arming');
t = await tile('alarm');
ok('21.2 alarm armerer: nøytral + puls', t && t.bg === 'rgb(47, 47, 47)' && t.blink && readable(t), t);
await setSt('alarm_control_panel.hjem', 'triggered');
t = await tile('alarm');
ok('21.2 alarm utløst: rød, mørk tekst', t && t.bg === 'rgb(242, 128, 115)' && t.fg === 'rgb(47, 47, 47)', t);

/* ---------------- 21.4 */
const hdr = (cfg, loc) => p.evaluate(async ([cfg, loc]) => {
  document.getElementById('dash').innerHTML = '';
  const h = window.mockHass(); h.config = { ...(h.config || {}), location_name: loc };
  const c = document.createElement('msh-hjem-header-card');
  c.setConfig({ type: 'custom:msh-hjem-header-card', card_id: 'hd_' + Math.random().toString(36).slice(2), ...cfg });
  c.hass = h; document.getElementById('dash').appendChild(c); window.__hd = c;
  await new Promise((q) => setTimeout(q, 400));
  const S = c._server();
  return { names: S.list.map((x) => x.name), cur: S.cur, name: S.name };
}, [cfg, loc]);
let s = await hdr({}, 'Strømstad');
ok('21.4 standardliste Oslo, Toten, Strømstad', s.names.join() === 'Oslo,Toten,Strømstad', s);
ok('21.4 location_name «Strømstad» markerer Strømstad', s.cur === 2, s);
s = await hdr({}, 'STROMSTAD');
ok('21.4 uten case/aksenter', s.cur === 2, s);
s = await hdr({}, 'Bergen');
ok('21.4 ingen treff → ingen markering', s.cur === -1, s);
s = await hdr({ this_server: { name: 'toten' } }, 'Oslo');
ok('21.4 this_server vinner', s.cur === 1, s);
s = await hdr({ servers: [{ name: 'Oslo' }], servers_init: true }, 'x');
ok('21.4 config er sannheten (slettede kommer ikke tilbake)', s.names.join() === 'Oslo', s);
s = await hdr({ servers: [], servers_init: true }, 'x');
ok('21.4 tom liste etter init forblir tom', s.names.length === 0, s);
// Meny og melding
const menu = await p.evaluate(async () => {
  const c = window.__hd; c.setConfig({ type: 'custom:msh-hjem-header-card', card_id: 'hd_m' }); c.hass = { ...c.hass, config: { ...c.hass.config, location_name: 'Oslo' } };
  await new Promise((q) => setTimeout(q, 300));
  c._serverMenu(c.shadowRoot.querySelector('.ttl') || c);
  await new Promise((q) => setTimeout(q, 300));
  const all = []; const w = (r) => r.querySelectorAll('*').forEach((e) => { all.push(e); if (e.shadowRoot) w(e.shadowRoot); }); w(document);
  const rows = all.filter((e) => e.classList && e.classList.contains('sv')).map((e) => e.textContent.trim());
  const me = all.find((e) => e.classList && e.classList.contains('me'));
  const toasts = [];
  const orig = window.MSH.toast; window.MSH.toast = (t) => { toasts.push(t); };
  const r = c._goServer(c._server().list[1]);
  window.MSH.toast = orig;
  if (c._srv) c._srv.close();
  return { rows, me: me && me.textContent, r, toasts };
});
ok('21.4 menyen: Oslo markert (Du er her), Toten og Strømstad i listen', /Oslo/.test(menu.me || '') && menu.rows.join() === 'Toten,Strømstad', menu);
ok('21.4 sted uten adresse → melding', menu.r === 'missing' && /Legg inn adresse i Tilpass header → Steder/.test(menu.toasts.join()), menu);

// Skrives én gang til ki-store (servers + servers_init)
const seed = await p.evaluate(async () => {
  const M = window.MSH, keep = M.store, sets = [];
  M.store = { loaded: true, set: (k, v) => { sets.push([k, v]); }, get: () => undefined, subscribe: () => () => {}, data: {} };
  try {
    document.getElementById('dash').innerHTML = '';
    const c = document.createElement('msh-hjem-header-card');
    c.setConfig({ type: 'custom:msh-hjem-header-card', card_id: 'hd_seed' }); c.hass = window.mockHass();
    document.getElementById('dash').appendChild(c);
    await new Promise((q) => setTimeout(q, 300)); c.update(); await new Promise((q) => setTimeout(q, 200));
  } finally { M.store = keep; }
  return sets.map(([k, v]) => [k, Array.isArray(v) ? v.map((x) => x.name).join() : v]);
});
ok('21.4 standardlisten skrives én gang (servers + servers_init)', seed.length === 2 && /\.servers$/.test(seed[0][0]) && seed[0][1] === 'Oslo,Toten,Strømstad' && /servers_init$/.test(seed[1][0]) && seed[1][1] === true, seed);

ok('ingen sidefeil', !errs.length, errs);
console.log(res.join('\n'));
await b.close();
process.exit(res.some((r) => r.startsWith('✘')) ? 1 : 0);
