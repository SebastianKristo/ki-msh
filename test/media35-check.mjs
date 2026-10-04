// Fiks 35.8 · Media (#media) mot ekte Bubble Card, mobil 390 px med TOUCH (CDP), mørk og lys modus. Uavhengig av dato/klokkeslett.
//  · spole-presets: hold venstre/høyre pil 500 ms (Musikk: ⏮/⏭, TV: styrekorsets ◀/▶) → meny «−1/−2/−5/−10 min» /
//    «+1/+2/+5/+10 min» (portalt til ki-overlay-root), haptic light; trykk = media_player.media_seek relativt (klemt til
//    0…varighet); Apple TV = remote.send_command skip_backward/skip_forward. Kort trykk = forrige/neste/pil som før,
//    bevegelse > 10 px avbryter holdet, klikket ved slipp svelges, contextmenu blokkert, popupen lukkes ikke
//  · «Tilpass media» → Faner: live forhåndsvisning av fanelinja øverst (rekkefølge, skjul, «Fane ved åpning»)
//  · lys modus: spole-menyen og forhåndsvisningen har tokens og tekst ≥ 4,5:1; «spiller nå» er mørk øy
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { readdirSync, existsSync, mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const BC = resolve('test/.vendor/bubble-card.js');
mkdirSync(resolve('test/.vendor'), { recursive: true });
if (!existsSync(BC)) execFileSync('curl', ['-sSL', '-o', BC, 'https://raw.githubusercontent.com/Clooos/Bubble-Card/main/dist/bubble-card.js']);
mkdirSync(resolve('test/.build'), { recursive: true });
const bundle = resolve(`test/.build/media35-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
const p = await ctx.newPage();
const cdp = await ctx.newCDPSession(p);
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto('file://' + resolve('test/harness-bubble.html'));
for (const m of readdirSync('test/mock').sort()) await p.addScriptTag({ path: resolve('test/mock/' + m) });
await p.addScriptTag({ path: bundle });
await p.addScriptTag({ path: BC, type: 'module' });
await p.waitForFunction(() => customElements.get('bubble-card'));
await p.evaluate(async () => {
  const wait = (ms) => new Promise((q) => setTimeout(q, ms));
  const H = window.mockHass();
  H.themes = { ...(H.themes || {}), darkMode: true };
  // Fast posisjon (uavhengig av klokka): spotify_jem står på 84 s av 232 s, pauset
  Object.assign(H.states['media_player.spotify_jem'], { state: 'paused' });
  H.states['media_player.spotify_jem'].attributes = { ...H.states['media_player.spotify_jem'].attributes, media_position: 84, media_duration: 232, media_position_updated_at: new Date().toISOString(), supported_features: 152461 + 2 + 16 + 32 };
  window.__calls = [];
  const cs = H.callService;
  H.callService = (d, s, data) => { window.__calls.push([d, s, JSON.parse(JSON.stringify(data || {}))]); return cs ? cs.call(H, d, s, data) : Promise.resolve(); };
  window.__hass = H;
  window.__hap = [];
  window.addEventListener('haptic', (e) => window.__hap.push(e.detail));
  const bc = document.createElement('bubble-card');
  bc.setConfig({ type: 'custom:bubble-card', card_type: 'pop-up', hash: '#media', name: 'Media', bg_color: '#282828', bg_opacity: 100, bg_blur: 0, cards: [{ type: 'custom:msh-media-card', card_id: 'm35', toasts: false }] });
  bc.hass = H; document.getElementById('dash').appendChild(bc);
  await wait(400);
  location.hash = '#media'; await wait(1500);
  const all = () => { const o = []; const w = (r) => r.querySelectorAll('*').forEach((e) => { o.push(e); if (e.shadowRoot) w(e.shadowRoot); }); w(document); return o; };
  window.__all = all;
  window.__M = () => all().find((e) => e.localName === 'msh-media-card' && e.getBoundingClientRect().height > 0);
  window.__menu = () => { const h = window.MSH.overlayRoot().querySelector('.msh-seek'); return h ? { dir: h.getAttribute('data-ki-seek'), items: [...h.shadowRoot.querySelectorAll('button')].map((x) => x.textContent.trim()), host: h } : null; };
  window.__pt = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; };
  window.__theme = async (light) => {
    window.__hass = { ...window.__hass, themes: { ...(window.__hass.themes || {}), darkMode: !light } };
    all().filter((e) => e.localName === 'bubble-card' || /^msh-/.test(e.localName)).forEach((e) => { try { e.hass = window.__hass; } catch (x) { /* */ } });
    window.MSH.theme.set(light ? 'light' : 'dark');
    await wait(500);
  };
});

const res = {};
const ok = (name, cond, info) => { res[name] = cond ? 'OK' : { FEIL: info }; };
const wait = (ms) => new Promise((q) => setTimeout(q, ms));
// Touch via CDP: hold (ms) og valgfri bevegelse
async function touch(x, y, ms, move) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
  if (move) { await wait(80); await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + move, y, id: 1 }] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + move * 2, y, id: 1 }] }); }
  await wait(ms);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await wait(250);
}
const pt = (sel) => p.evaluate((s) => { const el = window.__M().shadowRoot.querySelector(s); return el ? window.__pt(el) : null; }, sel);
const menuPt = (txt) => p.evaluate((t) => { const m = window.__menu(); const bt = m && [...m.host.shadowRoot.querySelectorAll('button')].find((x) => x.textContent.trim() === t); return bt ? window.__pt(bt) : null; }, txt);
const state = () => p.evaluate(() => ({ menu: window.__menu() && { dir: window.__menu().dir, items: window.__menu().items }, calls: window.__calls.splice(0), hap: window.__hap.splice(0), hash: location.hash }));

// ---------- 1 · Musikk: hold ⏮ → −-meny, trykk −1 min → media_seek 24
await p.evaluate(async () => { const c = window.__M(); c.select('musikk', 'media_player.spotify_jem'); await new Promise((q) => setTimeout(q, 500)); window.__calls.length = 0; window.__hap.length = 0; });
let P0 = await pt('.sk[data-seek="-1"]');
await touch(P0.x, P0.y, 700);
let S = await state();
ok('Musikk · hold ⏮ 500 ms → meny −1/−2/−5/−10 min, haptic light, ingen «forrige spor», popupen åpen', S.menu && S.menu.dir === 'back' && S.menu.items.join() === '−1 min,−2 min,−5 min,−10 min' && S.hap.includes('light') && !S.calls.some((c) => c[1] === 'media_previous_track') && S.hash === '#media', S);
let M1 = await menuPt("−1 min");
await touch(M1.x, M1.y, 60);
S = await state();
const seek1 = S.calls.find((c) => c[1] === 'media_seek');
ok('Musikk · trykk «−1 min» → media_player.media_seek 84 − 60 = 24 s, menyen lukkes', seek1 && seek1[0] === 'media_player' && seek1[2].entity_id === 'media_player.spotify_jem' && Math.abs(seek1[2].seek_position - 24) <= 2 && !S.menu, S);

// ---------- 2 · kort trykk = neste spor (ingen meny); hold ⏭ → +-meny, +5 min klemmes til varigheten
P0 = await pt('.sk[data-seek="1"]');
await touch(P0.x, P0.y, 60);
S = await state();
ok('Musikk · kort trykk ⏭ = media_next_track, ingen meny', S.calls.some((c) => c[1] === 'media_next_track') && !S.menu, S);
await touch(P0.x, P0.y, 700);
S = await state();
ok('Musikk · hold ⏭ → meny +1/+2/+5/+10 min', S.menu && S.menu.dir === 'fwd' && S.menu.items.join() === '+1 min,+2 min,+5 min,+10 min' && !S.calls.some((c) => c[1] === 'media_next_track'), S);
M1 = await menuPt('+5 min');
if (M1) await touch(M1.x, M1.y, 60);
S = await state();
const seek2 = S.calls.find((c) => c[1] === 'media_seek');
ok('Musikk · «+5 min» → media_seek klemt til varigheten (232 s)', seek2 && seek2[2].seek_position === 232, S.calls);

// ---------- 3 · bevegelse > 10 px under holdet avbryter; trykk utenfor menyen lukker uten spoling; contextmenu blokkert
await touch(P0.x, P0.y, 700, 12);
S = await state();
ok('hold + bevegelse > 10 px → ingen meny', !S.menu, S.menu);
await touch(P0.x, P0.y, 700);
await wait(300);
await touch(20, 140, 60);
S = await state();
ok('trykk utenfor menyen lukker den uten spoling, popupen er fortsatt åpen', !S.menu && !S.calls.some((c) => c[1] === 'media_seek') && S.hash === '#media', S);
const ctxm = await p.evaluate(() => { const b0 = window.__M().shadowRoot.querySelector('.sk[data-seek="1"]'); const e = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, composed: true }); b0.dispatchEvent(e); return { prevented: e.defaultPrevented, callout: getComputedStyle(b0).webkitTouchCallout || getComputedStyle(b0).getPropertyValue('-webkit-touch-callout') }; });
ok('contextmenu blokkert og -webkit-touch-callout: none på pilene', ctxm.prevented && (ctxm.callout === 'none' || ctxm.callout === ''), ctxm);

// ---------- 4 · TV (Apple TV): hold ▶ på styrekorset → +-meny; «+2 min» → remote.send_command skip_forward × 12
await p.evaluate(async () => { const c = window.__M(); c.select('tv', 'media_player.stue_tv'); await new Promise((q) => setTimeout(q, 500)); window.__calls.length = 0; });
P0 = await pt('[data-seek="1"][data-c="right"]');
await touch(P0.x, P0.y, 700);
S = await state();
ok('TV · hold ▶ (styrekors) → meny +1/+2/+5/+10 min, ingen «right»-kommando', S.menu && S.menu.dir === 'fwd' && !S.calls.some((c) => c[0] === 'remote' && c[2].command === 'right'), S);
M1 = await menuPt('+2 min');
if (M1) await touch(M1.x, M1.y, 60);
S = await state();
const sk = S.calls.find((c) => c[0] === 'remote' && c[1] === 'send_command');
ok('TV · Apple TV «+2 min» → remote.send_command skip_forward (num_repeats 12) på remote.stue_tv', sk && sk[2].entity_id === 'remote.stue_tv' && sk[2].command === 'skip_forward' && sk[2].num_repeats === 12, S.calls);
P0 = await pt('[data-seek="-1"][data-c="left"]');
await touch(P0.x, P0.y, 60);
S = await state();
ok('TV · kort trykk ◀ = vanlig «left»-kommando', S.calls.some((c) => c[0] === 'remote' && c[2].command === 'left') && !S.menu, S.calls);

// ---------- 5 · Tilpass media → Faner: live forhåndsvisning øverst
const pv = await p.evaluate(async () => {
  const wait2 = (ms) => new Promise((q) => setTimeout(q, ms));
  const c = window.__M(), ui = c.customize(); await wait2(600);
  const E = ui.editor, R = E.shadowRoot;
  // 47 G: «Tilpass media» har ikonfaner (Faner · TV · Musikk); forhåndsvisningen står øverst i Faner (etter teksten)
  const ft = R.querySelector('.mmt [data-t="faner"]'); if (ft && ft.getAttribute('aria-selected') !== 'true') { ft.click(); await wait2(300); }
  const sec = R.querySelector('.wrap');
  const row = () => R.querySelector('[data-key="mtp-row"]');
  const read = () => { const r = row(); return r ? { tabs: [...r.querySelectorAll('.mtp-t')].map((x) => x.textContent.trim()), on: (r.querySelector('.mtp-t.on') || {}).textContent } : null; };
  const firstInSec = sec && [...sec.children].filter((x) => x.getBoundingClientRect().height > 0 && x.localName !== 'style' && !x.classList.contains('ttl') && x.getAttribute('data-key') !== 'mmt' && x.getAttribute('data-key') !== 'mtp-i')[0];
  const o = { sec: !!sec, top: firstInSec && firstInSec.getAttribute('data-key'), a: read() };
  // 36.5 → 47 G: «Startfane»-segmentet (TV · Musikk) skriver start_tab (felles MSH.startTab) + tabs.start
  const dt = R.querySelector('.mso[data-g="start"][data-v="musikk"]');
  if (dt) { dt.click(); await wait2(400); }
  o.b = read();
  // Flytt «Musikk» først (rekkefølge-feltet)
  const mv = [...R.querySelectorAll('[data-a="mv"],[data-a="omv"],[data-a="ord"],button')].find((x) => /tab_order/.test(x.getAttribute('data-name') || '') && (x.getAttribute('data-d') === '-1' || /opp/i.test(x.getAttribute('aria-label') || x.title || '')) && !x.disabled);
  if (mv) { mv.click(); await wait2(400); }
  o.c = read();
  o.draft = { dt: E._config.start_tab, order: E._config.tab_order };
  // lys modus: forhåndsvisningen
  await window.__theme(true);
  const r = R.querySelector('.mtpv'), on = r.querySelector('.mtp-t.on'), off = r.querySelector('.mtp-t:not(.on)');
  o.light = { bg: getComputedStyle(r).backgroundColor, onC: getComputedStyle(on).color, crOff: +window.MSH.theme.contrast(getComputedStyle(off).color, getComputedStyle(r).backgroundColor).toFixed(2), crOn: +window.MSH.theme.contrast(getComputedStyle(on).color, 'rgb(244 169 199)').toFixed(2) };
  await window.__theme(false);
  const pp = window.MSH.portals().pop(); pp.shadowRoot.querySelector('.bg').click(); await wait2(500);
  return o;
});
ok('Tilpass media → Faner: forhåndsvisningen ligger øverst i fanen og viser TV · Musikk', pv.sec && pv.top === 'mtp' && pv.a && pv.a.tabs.join() === 'TV,Musikk' && pv.a.on === 'TV', pv);
ok('forhåndsvisningen følger «Startfane» live (Musikk aktiv)', pv.b && pv.b.on === 'Musikk' && pv.draft.dt === 'musikk', pv);
ok('forhåndsvisningen følger rekkefølgen live (Musikk først)', pv.c && pv.c.tabs.join() === 'Musikk,TV', pv.c);
ok('lys · forhåndsvisning: lys flate (--ki-bg, 47 G), inaktiv ≥ 4,5:1, aktiv mørk tekst på rosa', pv.light.bg === 'rgb(230, 230, 230)' && pv.light.crOff >= 4.5 && pv.light.crOn >= 4.5, pv.light);

// ---------- 6 · lys modus: spole-menyen + «spiller nå» som mørk øy
await p.evaluate(async () => { await window.__theme(true); const c = window.__M(); c.select('musikk', 'media_player.spotify_jem'); await new Promise((q) => setTimeout(q, 400)); });
P0 = await pt('.sk[data-seek="-1"]');
await touch(P0.x, P0.y, 700);
const lm = await p.evaluate(() => {
  const m = window.__menu(), box = m.host.shadowRoot.querySelector('.m'), bt = m.host.shadowRoot.querySelector('button');
  const hero = window.__all().find((e) => e.classList && e.classList.contains('pc') && e.getBoundingClientRect().height > 0);
  const ti = hero && (hero.querySelector('.al-ti') || hero.querySelector('.ti') || hero);
  return { bg: getComputedStyle(box).backgroundColor, fg: getComputedStyle(bt).color, cr: +window.MSH.theme.contrast(getComputedStyle(bt).color, getComputedStyle(box).backgroundColor).toFixed(2),
    island: !!hero && hero.hasAttribute('data-ki-island'), heroText: ti && getComputedStyle(ti).color };
});
await wait(300);
await touch(20, 140, 60);
await p.evaluate(() => window.__theme(false));
ok('lys · spole-menyen: --ki-surface-2 + mørk tekst ≥ 4,5:1', lm.bg === 'rgb(235, 235, 235)' && lm.cr >= 4.5, lm);
ok('lys · «spiller nå» er mørk øy (data-ki-island) med lys tekst', lm.island && /^rgb\((2[0-5]\d|1[89]\d)/.test(lm.heroText || ''), lm);

ok('ingen sidefeil', !errs.length, errs);
await b.close();
console.log(JSON.stringify(res, null, 1));
const bad = Object.values(res).filter((v) => v !== 'OK').length;
console.log(bad ? `\n${bad} feilet` : '\nAlle bestod');
process.exit(bad ? 1 : 0);
