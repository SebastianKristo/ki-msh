// Fiks 31.1 · «Tilpass media» → Musikk fryser ikke: 10 mediaspillere × 20 snarveier, media_position hvert sekund.
// Krav: Musikk-fanen åpnes < 300 ms, ingen ombygging av arket mens musikken spilles (ed.renders / MSH.renderStats),
// seksjon per spiller tegnes først når den åpnes (lat), favoritt-svar gir ikke tegnestorm, «Mediaspiller» per kilde
// (players.<obj>.entity) lagres og brukes av kortet, feil i én spiller → «Kunne ikke laste denne delen», GUI-editoren
// tegner ikke på nytt når HA sender tilbake configen den selv sendte (setConfig-vakt). TV-fanen kontrolleres likt.
import { createRequire } from 'node:module';
import { readdirSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
mkdirSync(resolve('test/.build'), { recursive: true });
const bundle = resolve(`test/.build/media31-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const fails = [];
const ok = (c, msg) => { if (!c) fails.push(msg); };
const p = await b.newPage({ viewport: { width: 820, height: 1180 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
p.on('console', (m) => { if (m.type() === 'error' && !/net::ERR|fonts|Failed to load|jsdelivr|\[msh-media\] editor|\[ki-msh\] editor/.test(m.text())) errs.push(m.text()); });
await p.goto('file://' + resolve('test/harness.html'));
for (const m of readdirSync('test/mock').sort()) await p.addScriptTag({ path: resolve('test/mock/' + m) });
await p.addScriptTag({ path: bundle });
p.setDefaultTimeout(60000);

const r = await p.evaluate(async () => {
  const w = (ms) => new Promise((q) => setTimeout(q, ms || 0));
  const raf = () => new Promise((q) => requestAnimationFrame(() => setTimeout(q, 0)));
  try { localStorage.clear(); } catch (e) { /* */ }
  const h = window.mockHass();
  const players = {};
  const NP = 10;
  for (let i = 0; i < NP; i++) {
    const id = `media_player.perf_${i}`;
    h.states[id] = { entity_id: id, state: 'playing', attributes: { friendly_name: 'Perf ' + i, device_class: 'speaker', source_list: Array.from({ length: 20 }, (_, j) => `Kilde ${i}-${j}`), media_title: 'Sang', media_position: 1, media_duration: 300, volume_level: 0.3, supported_features: 152461 }, last_changed: '2026-01-01T00:00:00Z', last_updated: '2026-01-01T00:00:00Z' };
    h.entities[id] = { entity_id: id, platform: 'squeezebox' };
    players['perf_' + i] = { presets: Array.from({ length: 20 }, (_, j) => ({ name: `Snarvei ${j}`, icon: 'mdi:radio', type: j % 2 ? 'script' : 'favorite', target: j % 2 ? `script.s_${j}` : `item_id:${j}` })) };
  }
  // Spiller med ødelagt state (source_list-getter kaster) → én seksjon feiler, resten tegnes
  const bad = 'media_player.perf_bad';
  const ba = { friendly_name: 'Perf bad', device_class: 'speaker' };
  Object.defineProperty(ba, 'source_list', { enumerable: true, get() { throw new Error('ødelagt source_list'); } });
  h.states[bad] = { entity_id: bad, state: 'idle', attributes: ba, last_changed: '2026-01-01T00:00:00Z', last_updated: '2026-01-01T00:00:00Z' };
  // Spiller uten source_list og uten forhåndsvalg (PRE) → tom liste med «–»/«Ingen», ingen feil
  h.states['media_player.perf_tom'] = { entity_id: 'media_player.perf_tom', state: 'idle', attributes: { friendly_name: 'Perf tom', device_class: 'speaker' }, last_changed: '2026-01-01T00:00:00Z', last_updated: '2026-01-01T00:00:00Z' };
  // Media-nettleseren svarer etter 50–300 ms (som ekte LMS / Music Assistant)
  const ws = h.callWS; let wsN = 0;
  h.callWS = (m) => {
    if (m && m.type === 'media_player/browse_media') {
      wsN++;
      const d = 50 + ((wsN * 37) % 250);
      return new Promise((res) => setTimeout(() => res(m.media_content_type ? { children: Array.from({ length: 30 }, (_, k) => ({ title: 'Fav ' + k, media_content_id: 'f' + k, media_content_type: 'favorite', can_play: true })) } : { children: [{ title: 'Favorites', media_content_id: '', media_content_type: 'Favorites' }] }), d));
    }
    return ws(m);
  };
  const bc = document.createElement('bubble-card');
  bc.setConfig({ type: 'custom:bubble-card', card_type: 'pop-up', hash: '#media' });
  bc.innerHTML = '<div class="pop"><div class="hdr">Media</div><div class="inner"></div></div>';
  document.getElementById('dash').appendChild(bc);
  location.hash = '#media';
  const el = document.createElement('msh-media-card');
  el.setConfig({ type: 'custom:msh-media-card', card_id: 'perf31', default_tab: 'musikk', players });
  el.hass = h;
  bc.querySelector('.inner').appendChild(el);
  await w(700);
  const out = {};
  // 1 · åpne arket og bytt til Musikk
  let t0 = performance.now();
  const ui = el.customize();
  const ed = ui.editor;
  await raf();
  out.tOpen = performance.now() - t0;
  const R = ed.shadowRoot;
  R.querySelector('[data-a="fn"][data-t="tv"]').click(); await raf();
  t0 = performance.now();
  R.querySelector('[data-a="fn"][data-t="musikk"]').click();
  await raf();
  out.tMus = performance.now() - t0;
  out.secs = [...R.querySelectorAll('details.sec[data-focus^="p_"]')].map((d) => d.dataset.focus);
  out.lazyAll = out.secs.every((s) => !!R.querySelector(`details[data-focus="${s}"] [data-lazy]`));
  out.wsAfterOpen = wsN;
  out.r0 = ed.renders;
  // 2 · musikken spilles: ny hass hvert sekund (media_position) – arket skal ikke tegnes på nytt
  for (let k = 0; k < 4; k++) {
    const st = { ...h.states };
    for (let i = 0; i < NP; i++) { const id = `media_player.perf_${i}`; st[id] = { ...st[id], attributes: { ...st[id].attributes, media_position: k + 2 } }; }
    h.states = st; el.hass = { ...h, states: st };
    await w(1000);
  }
  out.rPlay = ed.renders - out.r0;
  out.stats = window.MSH.renderStats && window.MSH.renderStats['msh-editor:Media'];
  // 3 · åpne én spiller: innholdet som Media v4 (Mediaspiller, Radiostasjoner og snarveier, chips, rader, Tilbakestill)
  const openSec = async (o) => { const d = R.querySelector(`details[data-focus="p_${o}"]`); d.open = true; await w(30); await raf(); return d; };
  const r1 = ed.renders; t0 = performance.now();
  const d0 = await openSec('perf_0');
  out.tSec = performance.now() - t0;
  out.sec0 = {
    mp: !!d0.querySelector('select[data-name="players.perf_0.entity"]'),
    mpOpts: d0.querySelectorAll('select[data-name="players.perf_0.entity"] option').length,
    title: (d0.querySelector('[data-key="b21-perf_0-presets"]') || { textContent: '' }).textContent.includes('Radiostasjoner og snarveier'),
    rows: d0.querySelectorAll('[data-key^="r21-perf_0-presets-"]').length,
    add: [...d0.querySelectorAll('[data-op="add"]')].map((x) => x.textContent.trim()),
    reset: !!d0.querySelector('[data-op="reset"]'),
    srcChips: d0.querySelectorAll('[data-op="chip"][data-ty="source"]').length,
  };
  await w(900); // favoritter svarer
  out.sec0.favChips = d0.querySelectorAll('[data-op="chip"][data-ty="favorite"]').length;
  out.rSec = ed.renders - r1;
  out.otherLazy = !!R.querySelector('details[data-focus="p_perf_5"] [data-lazy]');
  // 4 · åpne alle spillerne etter hverandre – ingen tegnestorm
  const r2 = ed.renders; t0 = performance.now();
  for (let i = 1; i < NP; i++) await openSec('perf_' + i);
  await w(1500);
  out.tAll = performance.now() - t0; out.rAll = ed.renders - r2; out.wsAll = wsN;
  // 5 · ødelagt spiller → «Kunne ikke laste denne delen», ikke halvt ark; tom spiller → «Ingen …»
  const db = await openSec('perf_bad');
  out.bad = db.textContent.includes('Kunne ikke laste denne delen');
  const dt = await openSec('perf_tom');
  out.tom = /Ingen snarveier|Fant ingen/.test(dt.textContent);
  out.afterBad = !!R.querySelector('[data-a="save"]') && R.querySelectorAll('details.sec').length > NP;
  // 6 · ikonforslag lastes først ved fokus, maks 40
  const dl = R.getElementById('mm-ic');
  out.dl0 = dl ? dl.children.length : -1;
  d0.querySelector('[data-op="open"][data-kind="presets"][data-i="0"]').click(); await raf();
  const ic = R.querySelector('details[data-focus="p_perf_0"] input[data-f="icon"]');
  if (ic) { ic.value = ''; ic.focus(); }
  for (let k = 0; k < 40 && dl && !dl.children.length; k++) await w(250);
  out.dl1 = dl ? dl.children.length : -1;
  if (ic) { ic.value = 'music'; ic.dispatchEvent(new Event('input', { bubbles: true, composed: true })); }
  await w(600);
  out.dl2 = dl ? [...dl.children].slice(0, 3).map((o) => o.value) : [];
  // 7 · Mediaspiller per kilde → players.perf_0.entity, kortet bruker den
  const sel = R.querySelector('select[data-name="players.perf_0.entity"]');
  sel.value = 'media_player.kjokken_radio'; sel.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  await w(100);
  out.draftEnt = ui.draft.draft.players.perf_0.entity;
  out.cardHas = window.MSH.mediaPlayers(el.hass, ui.draft.draft, true).all.filter((x) => x.id === 'media_player.kjokken_radio').map((x) => x.obj);
  // 8 · TV-fanen: samme mønster (lat, Apper/Innganger + Mediaspiller)
  R.querySelector('[data-a="fn"][data-t="tv"]').click(); await raf();
  const tvSecs = [...R.querySelectorAll('details.sec[data-focus^="p_"]')];
  out.tvLazy = tvSecs.length > 0 && tvSecs.every((d) => !d.open ? !!d.querySelector('[data-lazy]') : true);
  const dtv = await openSec('stue_tv');
  out.tv = { mp: !!dtv.querySelector('select[data-name="players.stue_tv.entity"]'), apps: !!dtv.querySelector('[data-key="b21-stue_tv-apps"]'), inputs: !!dtv.querySelector('[data-key="b21-stue_tv-inputs"]') };
  ui.draft.cancel();
  // 9 · GUI-editoren: config-changed → HA setConfig med samme config → ingen ny tegning
  const g = el.constructor.getConfigElement(); g.hass = h; g.setConfig({ type: 'custom:msh-media-card', players: { perf_0: players.perf_0 } });
  document.body.appendChild(g); await w(50);
  const gc = []; g.addEventListener('config-changed', (e) => { gc.push(e.detail.config); g.setConfig(e.detail.config); });
  g.shadowRoot.querySelector('[data-a="fn"][data-t="musikk"]').click(); await raf();
  const gd = g.shadowRoot.querySelector('details[data-focus="p_perf_0"]'); gd.open = true; await w(30); await raf(); await w(500);
  const gr0 = g.renders;
  gd.querySelector('[data-op="del"][data-i="0"]').click(); await w(50);
  out.gui = { renders: g.renders - gr0, changes: gc.length, n: ((gc[0] || {}).players || {}).perf_0 && gc[0].players.perf_0.presets.length, mp: !!gd.querySelector('select[data-name="players.perf_0.entity"]') };
  g.remove();
  out.wsN = wsN;
  return out;
});
console.log(JSON.stringify(r));
ok(r.tOpen < 300, `åpne arket ${r.tOpen.toFixed(0)} ms ≥ 300`);
ok(r.tMus < 300, `Musikk-fanen ${r.tMus.toFixed(0)} ms ≥ 300`);
ok(r.secs.length >= 12 && r.lazyAll, 'seksjoner per spiller skal være late (lukket = ikke tegnet) ' + JSON.stringify(r.secs));
ok(r.wsAfterOpen === 0, 'favoritter hentes for lukkede spillere: ' + r.wsAfterOpen);
ok(r.rPlay === 0, `arket ble tegnet ${r.rPlay} ganger mens musikken spilte`);
ok(r.stats >= 1, 'MSH.renderStats teller ikke tegninger');
ok(r.tSec < 300, `åpne én spiller ${r.tSec.toFixed(0)} ms ≥ 300`);
ok(r.sec0.mp && r.sec0.mpOpts > 10 && r.sec0.title && r.sec0.rows === 20 && r.sec0.reset && r.sec0.srcChips === 20 && r.sec0.add.join('|') === 'Radiostasjon|Snarvei', 'innhold spiller 0 ' + JSON.stringify(r.sec0));
ok(r.sec0.favChips === 30, 'favoritt-chips ' + r.sec0.favChips);
ok(r.rSec <= 4, `åpne én spiller ga ${r.rSec} tegninger (> 4)`);
ok(r.otherLazy, 'andre spillere ble tegnet da én ble åpnet');
ok(r.rAll <= 3 * 9 + 2, `åpne alle ga ${r.rAll} tegninger (storm)`);
ok(r.tAll < 9 * 300 + 1500 + 1500, `åpne alle tok ${r.tAll.toFixed(0)} ms`);
ok(r.bad && r.afterBad, 'feil i én spiller: «Kunne ikke laste denne delen» / arket ellers helt ' + JSON.stringify([r.bad, r.afterBad]));
ok(r.tom, 'spiller uten source_list/forhåndsvalg: tom liste');
ok(r.dl0 === 0 && r.dl1 > 0 && r.dl1 <= 40 && /music/.test(r.dl2[0] || ''), 'ikonforslag (lat, ≤ 40) ' + JSON.stringify([r.dl0, r.dl1, r.dl2]));
ok(r.draftEnt === 'media_player.kjokken_radio' && r.cardHas.join() === 'perf_0', 'Mediaspiller per kilde ' + JSON.stringify([r.draftEnt, r.cardHas]));
ok(r.tvLazy && r.tv.mp && r.tv.apps && r.tv.inputs, 'TV-fanen ' + JSON.stringify([r.tvLazy, r.tv]));
ok(r.gui.renders <= 1 && r.gui.changes === 1 && r.gui.n === 19 && r.gui.mp, 'GUI-editor: setConfig-vakt / lagring ' + JSON.stringify(r.gui));
ok(!errs.length, 'feil: ' + errs.join(' | '));
await b.close();
console.log(fails.length ? 'FEIL:\n- ' + fails.join('\n- ') : 'OK – media 31.1');
process.exit(fails.length ? 1 : 0);
