// Fiks 56 C + E · Media (#media) mot ekte Bubble Card, mobil 390 px med touch (CDP). Uavhengig av dato/klokkeslett.
//  C1 · spoling: media_seek (SEEK, posisjon + tid siden updated_at), Apple TV skip_forward, Android/Google TV DPAD_RIGHT × n,
//       LG webOS FASTFORWARD, ustøttet → toast «Spoling støttes ikke av …» + haptic failure; bakover klemt til ≥ 0;
//       feil fra callService → toast
//  C2 · script per valg → felles seek_script → automatisk, variablene { entity_id, direction, minutes, seconds };
//       «Spoling» i Tilpass (legg til / etikett / minutter / handling / fjern / Test) og GUI-editoren (samme config)
//  C3 · pillen: 56 px, radius 999, --ki-surface-2, skygge + ring, 17px/500, valg ≥ 44×44 jevnt fordelt, to aksentmerker
//       nederst (speilvendt bakover), scale(.9)→1 + opacity 140 ms, over midten av styrekorset, lukkes ved trykk utenfor /
//       valg / sveip ned, ingen × og ingen tittel, touch-action none
//  E  · lys modus: heroen av / uten art / lys art / mørk art – all tekst og alle ikoner ≥ 4,5:1, ingen hvit tekst på lys
//       flate; mini-spilleren og Rom-spillerraden i lys modus; mørk modus uendret (mot bundel bygd fra git HEAD, M56_BASE=…)
// Kjør: node test/media56-check.mjs
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { readdirSync, existsSync, mkdirSync, rmSync } from 'node:fs';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const BC = resolve('test/.vendor/bubble-card.js');
mkdirSync(resolve('test/.vendor'), { recursive: true });
if (!existsSync(BC)) execFileSync('curl', ['-sSL', '-o', BC, 'https://raw.githubusercontent.com/Clooos/Bubble-Card/main/dist/bubble-card.js']);
mkdirSync(resolve('test/.build'), { recursive: true });
const bundle = resolve(`test/.build/media56-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
// Før-koden for paritet i mørk modus: M56_BASE=<bundel>, ellers bygget fra git HEAD (hoppes over uten git)
let BASE = process.env.M56_BASE ? resolve(process.env.M56_BASE) : null, baseDir = null;
if (!BASE) {
  try {
    baseDir = resolve(`test/.build/media56-base-${process.pid}`);
    mkdirSync(baseDir, { recursive: true });
    execFileSync('sh', ['-c', `git archive HEAD src build.mjs package.json | tar -x -C "${baseDir}" && ln -s "${resolve('node_modules')}" "${baseDir}/node_modules" 2>/dev/null; true`]);
    BASE = resolve(`test/.build/media56-base-${process.pid}.js`);
    execFileSync('node', ['build.mjs', BASE], { cwd: baseDir, stdio: 'ignore' });
  } catch (e) { BASE = null; }
}
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const res = {};
const ok = (name, cond, info) => { res[name] = cond ? 'OK' : { FEIL: info }; };
const wait = (ms) => new Promise((q) => setTimeout(q, ms));

// Light-SVG og mørk SVG som omslag (data-URL → canvas-snittfarge virker uten nett)
const svg = (c1, c2) => 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" fill="${c1}"/><rect y="8" width="16" height="8" fill="${c2}"/></svg>`);
const LIGHT_ART = svg('#f6e7b8', '#f2dca0'), DARK_ART = svg('#1d2b4a', '#0f1626');

async function page(bundlePath) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const p = await ctx.newPage();
  const cdp = await ctx.newCDPSession(p);
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + resolve('test/harness-bubble.html'));
  for (const m of readdirSync('test/mock').sort()) await p.addScriptTag({ path: resolve('test/mock/' + m) });
  await p.addScriptTag({ path: bundlePath });
  await p.addScriptTag({ path: BC, type: 'module' });
  await p.waitForFunction(() => customElements.get('bubble-card'));
  await p.evaluate(async ({ LIGHT_ART, DARK_ART }) => {
    const wait2 = (ms) => new Promise((q) => setTimeout(q, ms));
    const H = window.mockHass();
    H.themes = { ...(H.themes || {}), darkMode: true };
    const S = H.states;
    // Spotify: SEEK + posisjon (84 s av 232 s, oppdatert for 10 s siden, spiller)
    S['media_player.spotify_jem'] = { ...S['media_player.spotify_jem'], state: 'playing', attributes: { ...S['media_player.spotify_jem'].attributes, media_position: 84, media_duration: 232, media_position_updated_at: new Date(Date.now() - 10000).toISOString(), supported_features: 152461 + 2 + 16 + 32 } };
    window.__calls = [];
    window.__fail = null; // 'sync' | 'async' → callService kaster
    H.callService = (d, s, data) => {
      window.__calls.push([d, s, JSON.parse(JSON.stringify(data || {}))]);
      if (window.__fail === 'sync') throw new Error('sync-feil');
      if (window.__fail === 'async') return Promise.reject(new Error('Tjenesten finnes ikke'));
      return Promise.resolve();
    };
    window.__hass = H;
    window.__hap = []; window.addEventListener('haptic', (e) => window.__hap.push(e.detail));
    window.__ts = []; const T = window.MSH.toast; window.MSH.toast = (t, o) => { window.__ts.push(t); return T(t, o); };
    window.__art = { LIGHT_ART, DARK_ART };
    const bc = document.createElement('bubble-card');
    bc.setConfig({ type: 'custom:bubble-card', card_type: 'pop-up', hash: '#media', name: 'Media', bg_color: '#282828', bg_opacity: 100, bg_blur: 0, cards: [{ type: 'custom:msh-media-card', card_id: 'm56', toasts: false }] });
    bc.hass = H; document.getElementById('dash').appendChild(bc);
    await wait2(400);
    location.hash = '#media'; await wait2(1500);
    const all = () => { const o = []; const w = (r) => r.querySelectorAll('*').forEach((e) => { o.push(e); if (e.shadowRoot) w(e.shadowRoot); }); w(document); return o; };
    window.__all = all;
    window.__M = () => all().find((e) => e.localName === 'msh-media-card' && e.getBoundingClientRect().height > 0);
    window.__push = async (patch, ms = 400) => {
      const st = { ...window.__hass.states };
      Object.entries(patch || {}).forEach(([id, v]) => { st[id] = { ...st[id], ...v, attributes: { ...(st[id] || {}).attributes, ...(v.attributes || {}) } }; if (v.attributes === null) st[id].attributes = {}; });
      window.__hass = { ...window.__hass, states: st };
      all().filter((e) => e.localName === 'bubble-card' || /^msh-/.test(e.localName)).forEach((e) => { try { e.hass = window.__hass; } catch (x) { /* */ } });
      await wait2(ms);
    };
    window.__theme = async (light) => {
      window.__hass = { ...window.__hass, themes: { ...(window.__hass.themes || {}), darkMode: !light } };
      all().filter((e) => e.localName === 'bubble-card' || /^msh-/.test(e.localName)).forEach((e) => { try { e.hass = window.__hass; } catch (x) { /* */ } });
      window.MSH.theme.set(light ? 'light' : 'dark');
      await wait2(500);
    };
    window.__menu = () => { const h = window.MSH.overlayRoot().querySelector('.msh-seek'); return h || null; };
    window.__pt = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; };
    // Farger: rgb/rgba → [r,g,b,a]; komposisjon og kontrast (WCAG)
    const P = (c) => { const m = String(c).match(/[\d.]+/g); if (!m) return [0, 0, 0, 0]; return [+m[0], +m[1], +m[2], m[3] == null ? 1 : +m[3]]; };
    const over = (f, bg) => { const a = f[3]; return [f[0] * a + bg[0] * (1 - a), f[1] * a + bg[1] * (1 - a), f[2] * a + bg[2] * (1 - a), 1]; };
    const L = (c) => { const g = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * g(c[0]) + 0.7152 * g(c[1]) + 0.0722 * g(c[2]); };
    window.__cr = (fg, bg) => { const x = L(fg), y = L(bg); return +((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)).toFixed(2); };
    window.__P = P; window.__over = over; window.__L = L;
  }, { LIGHT_ART, DARK_ART });
  return { p, cdp, errs, ctx };
}

async function touch(cdp, x, y, ms, move) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
  if (move) { for (let i = 1; i <= 4; i++) { await wait(20); await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + (move.dx || 0) * i / 4, y: y + (move.dy || 0) * i / 4, id: 1 }] }); } }
  await wait(ms);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await wait(300);
}

const { p, cdp, errs } = await page(bundle);
const pt = (sel) => p.evaluate((s) => { const el = window.__M().shadowRoot.querySelector(s); return el ? window.__pt(el) : null; }, sel);
const drain = () => p.evaluate(() => ({ calls: window.__calls.splice(0), hap: window.__hap.splice(0), ts: window.__ts.splice(0) }));

// ---------- C1 · tjenestevalg per enhetstype (M.mediaSeek.run med kortets config)
const C1 = await p.evaluate(async () => {
  const M = window.MSH, h = window.__hass, cfg = window.__M().config;
  const pl = (id) => M.mediaPlayers(h, cfg, true).all.find((x) => x.id === id);
  const o2 = { minutes: 2, action: 'auto' }, o1 = { minutes: 1, action: 'auto' };
  const out = {};
  const run = (id, o, dir, hh) => { window.__calls.length = 0; window.__hap.length = 0; window.__ts.length = 0; const r = M.mediaSeek.run(hh || h, cfg, pl(id), o, dir); return { kind: r.kind, calls: window.__calls.slice(), hap: window.__hap.slice(), ts: window.__ts.slice() }; };
  out.seek = run('media_player.spotify_jem', o2, 1);
  out.apple = run('media_player.stue_tv', o2, 1);
  out.android = run('media_player.soverom_tv', o2, 1);
  out.webos = run('media_player.prosjektor', o2, 1);
  out.none = run('media_player.rn602_stue', o2, 1);
  // bakover: −1 min fra 30 s → 0 (klemt), Apple TV bakover = skip_backward
  const h2 = { ...h, states: { ...h.states, 'media_player.spotify_jem': { ...h.states['media_player.spotify_jem'], state: 'paused', attributes: { ...h.states['media_player.spotify_jem'].attributes, media_position: 30, media_position_updated_at: new Date().toISOString() } } } };
  out.back = run('media_player.spotify_jem', o1, -1, h2);
  out.appleBack = run('media_player.stue_tv', o1, -1);
  // feil fra callService → toast (synkront og asynkront)
  await new Promise((q) => setTimeout(q, 80)); // MSH.haptic: maks én per 40 ms
  window.__fail = 'sync'; out.errSync = run('media_player.spotify_jem', o1, 1); window.__fail = 'async'; out.errAsync = run('media_player.spotify_jem', o1, 1);
  await new Promise((q) => setTimeout(q, 50)); out.errAsync.ts = window.__ts.slice(); window.__fail = null;
  return out;
});
const sk = C1.seek.calls[0];
ok('C1 · SEEK-spiller: media_player.media_seek = posisjon + tid siden updated_at + 120 s (84 + 10 + 120 ≈ 214)', C1.seek.kind === 'seek' && sk && sk[0] === 'media_player' && sk[1] === 'media_seek' && Math.abs(sk[2].seek_position - 214) <= 2, C1.seek);
ok('C1 · Apple TV: remote.send_command skip_forward × 12 på remote.stue_tv', C1.apple.kind === 'remote' && C1.apple.calls.length === 1 && C1.apple.calls[0][2].entity_id === 'remote.stue_tv' && C1.apple.calls[0][2].command === 'skip_forward' && C1.apple.calls[0][2].num_repeats === 12, C1.apple);
ok('C1 · Android/Google TV: remote.send_command DPAD_RIGHT × 12 (à 10 s) på remote.soverom_tv', C1.android.calls.length === 1 && C1.android.calls[0][2].entity_id === 'remote.soverom_tv' && C1.android.calls[0][2].command === 'DPAD_RIGHT' && C1.android.calls[0][2].num_repeats === 12, C1.android);
await wait(4000); // webOS-kallene sendes med 300 ms mellomrom
const wo = await p.evaluate(() => window.__calls.splice(0));
ok('C1 · LG webOS (uten remote.*): webostv.button FASTFORWARD × 12', C1.webos.kind === 'remote' && C1.webos.calls.length >= 1 && C1.webos.calls.every((c) => c[0] === 'webostv' && c[1] === 'button' && c[2].button === 'FASTFORWARD' && c[2].entity_id === 'media_player.prosjektor') && C1.webos.calls.length + wo.filter((c) => c[0] === 'webostv').length === 12, { first: C1.webos, later: wo.length });
ok('C1 · ustøttet enhet: ingen kall, toast «Spoling støttes ikke av RN602 stue – sett eget script i Tilpass» + haptic failure', C1.none.kind === 'none' && !C1.none.calls.length && C1.none.ts.some((t) => t === 'Spoling støttes ikke av RN602 stue – sett eget script i Tilpass') && C1.none.hap.includes('failure'), C1.none);
ok('C1 · bakover −1 min fra 30 s → media_seek 0 (klemt ≥ 0); Apple TV bakover = skip_backward × 6', C1.back.calls[0] && C1.back.calls[0][2].seek_position === 0 && C1.appleBack.calls[0][2].command === 'skip_backward' && C1.appleBack.calls[0][2].num_repeats === 6, { back: C1.back, ab: C1.appleBack });
ok('C1 · feil fra hass.callService (synkron og avvist) → toast «Spoling feilet: …» + haptic failure', C1.errSync.ts.some((t) => /^Spoling feilet: sync-feil/.test(t)) && C1.errSync.hap.includes('failure') && C1.errAsync.ts.some((t) => /Tjenesten finnes ikke/.test(t)), { s: C1.errSync, a: C1.errAsync });

// ---------- C2 · script-rekkefølge og variabler
const C2 = await p.evaluate(() => {
  const M = window.MSH, h = window.__hass;
  const base = window.__M().config;
  const cfg = { ...base, seek: { script: 'script.tv_spol' }, players: { ...(base.players || {}), stue_tv: { ...((base.players || {}).stue_tv || {}), seek: { options: [{ label: '+1', minutes: 1, action: 'auto' }, { minutes: 10, action: 'script', script: 'script.spol_ti' }, { minutes: 3, action: 'service', service: 'remote.send_command', data: 'entity_id: remote.stue_tv\ncommand: skip_forward\nnum_repeats: "{{ seconds }}"' }] } } } };
  const p0 = M.mediaPlayers(h, cfg, true).all.find((x) => x.id === 'media_player.stue_tv');
  const S = M.mediaSeek.cfg(cfg, p0);
  const run = (i, dir) => { window.__calls.length = 0; const r = M.mediaSeek.run(h, cfg, p0, S.options[i], dir); return { kind: r.kind, calls: window.__calls.slice() }; };
  const noShared = { ...cfg, seek: {} };
  const pS = M.mediaPlayers(h, noShared, true).all.find((x) => x.id === 'media_player.spotify_jem');
  window.__calls.length = 0; const auto = M.mediaSeek.run(h, noShared, pS, M.mediaSeek.cfg(noShared, pS).options[0], 1);
  return { labels: S.options.map((o) => [M.mediaSeek.label(o, 1), M.mediaSeek.label(o, -1)]), shared: S.script, own: run(1, 1), sharedRun: run(0, -1), svc: run(2, 1), auto: { kind: auto.kind, calls: window.__calls.slice() },
    def: M.mediaSeek.cfg({}, pS).options.map((o) => o.minutes), defScript: M.mediaSeek.cfg({ seek: { script: 'script.x' } }, pS).script };
});
const own = C2.own.calls[0], shr = C2.sharedRun.calls[0], svc = C2.svc.calls[0];
ok('C2 · eget script på +10 min: script.turn_on script.spol_ti med { entity_id, direction: forward, minutes: 10, seconds: 600 }', C2.own.kind === 'script' && own && own[0] === 'script' && own[1] === 'turn_on' && own[2].entity_id === 'script.spol_ti' && JSON.stringify(own[2].variables) === JSON.stringify({ entity_id: 'media_player.stue_tv', direction: 'forward', minutes: 10, seconds: 600 }), C2.own);
ok('C2 · felles seek_script for valg uten eget (bakover): script.tv_spol med direction back, minutes 1, seconds 60', C2.sharedRun.kind === 'shared' && shr && shr[2].entity_id === 'script.tv_spol' && shr[2].variables.direction === 'back' && shr[2].variables.minutes === 1 && shr[2].variables.seconds === 60, C2.sharedRun);
ok('C2 · Tjeneste-handling: remote.send_command med YAML-data og {{ seconds }} = 180', C2.svc.kind === 'service' && svc && svc[0] === 'remote' && svc[1] === 'send_command' && svc[2].num_repeats === 180 && svc[2].command === 'skip_forward' && svc[2].entity_id === 'remote.stue_tv', C2.svc);
ok('C2 · uten script → automatisk (media_seek); standard [1, 2, 5, 10]; felles script på kortnivå arves', C2.auto.kind === 'seek' && C2.def.join() === '1,2,5,10' && C2.defScript === 'script.x', C2);
ok('C2 · etiketter: egen «+1» → «−1» bakover, standard «+10 min» / «−10 min»', C2.labels[0][0] === '+1' && C2.labels[0][1] === '−1' && C2.labels[1][0] === '+10 min' && C2.labels[1][1] === '−10 min', C2.labels);

// ---------- C2 · editoren: Tilpass media → TV → Stue TV → Spoling (legg til, etikett, minutter, handling, script, Test, fjern)
const ED = await p.evaluate(async () => {
  const wait2 = (ms) => new Promise((q) => setTimeout(q, ms));
  const c = window.__M(), ui = c.customize('tv'); await wait2(700);
  const E = ui.editor, R = E.shadowRoot;
  const sec = R.querySelector('[data-focus="p_stue_tv"],[data-sec="id:p_stue_tv"]');
  if (sec && !sec.open) { sec.open = true; sec.dispatchEvent(new Event('toggle')); await wait2(500); }
  const box = () => R.querySelector('.skf[data-key="skf-players.stue_tv.seek"]');
  const o = { found: !!box() };
  if (!box()) return o;
  const rows = () => [...box().querySelectorAll('.skr')];
  o.rows0 = rows().length;
  o.defLabels = rows().map((r) => r.querySelector('input[data-skf="label"]').placeholder);
  box().querySelector('[data-ska="add"]').click(); await wait2(300);
  o.rows1 = rows().length; o.cfgAdd = JSON.parse(JSON.stringify(E._config.players.stue_tv.seek));
  const lab = rows()[3].querySelector('input[data-skf="label"]'); lab.value = '+10 min ⏩'; lab.dispatchEvent(new Event('change', { bubbles: true })); await wait2(300);
  const mn = rows()[4].querySelector('input[data-skf="minutes"]'); mn.value = '15'; mn.dispatchEvent(new Event('change', { bubbles: true })); await wait2(300);
  rows()[3].querySelector('[data-ska="act"][data-v="script"]').click(); await wait2(300);
  const pk = rows()[3].querySelector('[data-skf="script"]');
  o.picker = pk && pk.localName;
  pk.dispatchEvent(new CustomEvent('value-changed', { detail: { value: 'script.tv_spol_ti' }, bubbles: true, composed: true })); await wait2(300);
  const sh = box().querySelector('[data-skf="shared"]');
  sh.dispatchEvent(new CustomEvent('value-changed', { detail: { value: 'script.tv_spol' }, bubbles: true, composed: true })); await wait2(300);
  o.cfg = JSON.parse(JSON.stringify(E._config.players.stue_tv.seek));
  // Test-knappen på +10 min kjører scriptet
  window.__calls.length = 0;
  rows()[3].querySelector('[data-ska="test"]').click(); await wait2(200);
  o.test = window.__calls.slice();
  // Fjern (+15) og maks 6
  rows()[4].querySelector('[data-ska="rm"]').click(); await wait2(300);
  o.afterRm = E._config.players.stue_tv.seek.options.length;
  for (let i = 0; i < 4; i++) { const a = box().querySelector('[data-ska="add"]'); if (a) { a.click(); await wait2(200); } }
  o.max = E._config.players.stue_tv.seek.options.length; o.addGone = !box().querySelector('[data-ska="add"]');
  // Kortnivå (felles standard) finnes i samme fane
  o.cardLevel = !!R.querySelector('.skf[data-key="skf-seek"]');
  // Lagre (Ferdig) → kortets config
  const done = R.querySelector('[data-a="save"]'); if (done) done.click(); await wait2(1200);
  if (location.hash !== '#media') { location.hash = '#media'; await wait2(1500); } // (harness: lagringen kan lukke popupen)
  o.saved = JSON.parse(JSON.stringify((window.__M().config.players || {}).stue_tv || {})).seek || null;
  return o;
});
ok('C2 · Tilpass → TV → Stue TV: «Spoling» med standard +1/+2/+5/+10 min', ED.found && ED.rows0 === 4 && ED.defLabels.join() === '+1 min,+2 min,+5 min,+10 min', ED);
ok('C2 · legg til → 5 valg (eget oppsett opprettes fra standard)', ED.rows1 === 5 && ED.cfgAdd.options.length === 5 && ED.cfgAdd.options[4].minutes === 20, ED.cfgAdd);
ok('C2 · etikett, minutter, handling Script (velger domain script) og felles script lagres i players.stue_tv.seek', ED.cfg && ED.cfg.options[3].label === '+10 min ⏩' && ED.cfg.options[3].action === 'script' && ED.cfg.options[3].script === 'script.tv_spol_ti' && ED.cfg.options[4].minutes === 15 && ED.cfg.script === 'script.tv_spol' && /msh-entity-picker|ha-selector/.test(ED.picker || ''), ED.cfg);
ok('C2 · «Test» kjører valget: script.turn_on script.tv_spol_ti med minutes 10, direction forward', ED.test.length === 1 && ED.test[0][0] === 'script' && ED.test[0][2].entity_id === 'script.tv_spol_ti' && ED.test[0][2].variables.minutes === 10 && ED.test[0][2].variables.direction === 'forward', ED.test);
ok('C2 · fjern + maks 6 valg («Legg til» forsvinner); felles standard på kortnivå finnes', ED.afterRm === 4 && ED.max === 6 && ED.addGone && ED.cardLevel, ED);
ok('C2 · Ferdig → kortets config har seek (round-trip)', ED.saved && ED.saved.options && ED.saved.options.length === 6 && ED.saved.script === 'script.tv_spol', ED.saved);

// GUI-editoren (getConfigElement) – samme felt, config-changed med samme nøkler
const GUI = await p.evaluate(async () => {
  const wait2 = (ms) => new Promise((q) => setTimeout(q, ms));
  const cls = customElements.get('msh-media-card'), el = cls.getConfigElement();
  document.body.appendChild(el);
  let last = null; el.addEventListener('config-changed', (e) => { last = e.detail.config; });
  el.setConfig({ type: 'custom:msh-media-card', card_id: 'm56g', seek: { options: [{ minutes: 3, label: '+3', action: 'auto' }], script: 'script.felles' } });
  el.hass = window.__hass; await wait2(500);
  const E = el.localName === 'msh-editor' ? el : (el.shadowRoot && el.shadowRoot.querySelector('msh-editor')) || el;
  const R = E.shadowRoot;
  const tv = R.querySelector('[data-t="tv"]'); if (tv) { tv.click(); await wait2(400); }
  const box = R.querySelector('.skf[data-key="skf-seek"]');
  const o = { box: !!box, rows: box ? box.querySelectorAll('.skr').length : 0, lab: box && box.querySelector('input[data-skf="label"]').value };
  if (box) { const mn = box.querySelector('input[data-skf="minutes"]'); mn.value = '4'; mn.dispatchEvent(new Event('change', { bubbles: true })); await wait2(300); }
  o.out = last && last.seek;
  el.remove();
  return o;
});
ok('C2 · GUI-editoren: «Spoling» (felles standard) leser seek fra YAML og skriver seek.options via config-changed', GUI.box && GUI.rows === 1 && GUI.lab === '+3' && GUI.out && GUI.out.options[0].minutes === 4 && GUI.out.script === 'script.felles', GUI);

// ---------- C3 · pillen (mørk og lys)
async function pillCheck(light) {
  await p.evaluate(async (l) => { if (location.hash !== '#media') { location.hash = '#media'; await new Promise((q) => setTimeout(q, 1500)); } await window.__theme(l); const c = window.__M(); const sc = window.MSH.store && window.MSH.store.card('m56'); if (sc && sc.players) { await window.MSH.store.setCard('m56', { ...sc, players: {} }); } c.setConfig({ type: 'custom:msh-media-card', card_id: 'm56', toasts: false }); await new Promise((q) => setTimeout(q, 300)); c.select('tv', 'media_player.stue_tv'); await new Promise((q) => setTimeout(q, 600)); }, light);
  await drain();
  const P0 = await pt('[data-seek="1"][data-c="right"]');
  await touch(cdp, P0.x, P0.y, 700);
  const g = await p.evaluate(() => {
    const host = window.__menu(); if (!host) return null;
    const m = host.shadowRoot.querySelector('.m'), cs = getComputedStyle(m), r = m.getBoundingClientRect();
    const dp = window.__M().shadowRoot.querySelector('.dp,.sp'), d = dp.getBoundingClientRect();
    const bs = [...m.querySelectorAll('button')].map((x) => { const q = x.getBoundingClientRect(), c2 = getComputedStyle(x); return { t: x.textContent.trim(), w: Math.round(q.width), h: Math.round(q.height), cx: q.left + q.width / 2, fs: c2.fontSize, fw: c2.fontWeight, col: c2.color }; });
    const mk = [...m.querySelectorAll('.mk')].map((x) => { const q = x.getBoundingClientRect(), c2 = getComputedStyle(x); return { bg: c2.backgroundColor, tr: c2.transform, bottom: Math.round(q.bottom - r.bottom), side: q.left + q.width / 2 < r.left + r.width / 2 ? 'l' : 'r' }; });
    const gaps = bs.slice(1).map((x, i) => Math.round(x.cx - bs[i].cx));
    return { h: Math.round(r.height), w: Math.round(r.width), rad: cs.borderRadius, bg: cs.backgroundColor, sh: cs.boxShadow, anim: cs.animationName, dur: cs.animationDuration, ta: getComputedStyle(host).touchAction, mta: cs.touchAction,
      cy: Math.round(r.top + r.height / 2), dcy: Math.round(d.top + d.height / 2), dw: Math.round(d.width), bs, gaps, mk, title: !!host.shadowRoot.querySelector('.ttl,[title]') || /Spol frem/.test(m.textContent), x: [...m.querySelectorAll('ha-icon')].length,
      cr: window.__cr(window.__P(bs[0].col), window.__P(cs.backgroundColor)) };
  });
  return g;
}
for (const light of [false, true]) {
  const g = await pillCheck(light);
  const tag = light ? 'lys' : 'mørk';
  ok(`C3 · ${tag}: pille 56 px, radius 999, --ki-surface-2 (${light ? '#ebebeb' : '#404040'}), skygge + ring, over midten av styrekorset i full bredde`, g && g.h === 56 && /999px|9.99e\+02px/.test(g.rad) && g.bg === (light ? 'rgb(235, 235, 235)' : 'rgb(64, 64, 64)') && /0px 8px 24px/.test(g.sh) && /inset/.test(g.sh) && Math.abs(g.cy - g.dcy) <= 2 && g.w >= g.dw - 1, g);
  ok(`C3 · ${tag}: fire valg «+1 min … +10 min» 17px/500, ≥ 44×44, jevnt fordelt, tekst ≥ 4,5:1, ingen × og ingen tittel`, g && g.bs.map((x) => x.t).join() === '+1 min,+2 min,+5 min,+10 min' && g.bs.every((x) => x.w >= 44 && x.h >= 44 && x.fs === '17px' && x.fw === '500') && Math.max(...g.gaps) - Math.min(...g.gaps) <= 2 && g.cr >= 4.5 && !g.title && g.x === 0, g);
  ok(`C3 · ${tag}: to aksentmerker nederst ytterst (venstre + høyre), peker mot høyre (rotate 45°)`, g && g.mk.length === 2 && g.mk.map((x) => x.side).join() === 'l,r' && g.mk.every((x) => x.bottom >= 0 && x.bottom <= 6 && x.bg !== 'rgba(0, 0, 0, 0)' && /matrix\(0\.70/.test(x.tr)), g && g.mk);
  ok(`C3 · ${tag}: animasjon skIn 140 ms, touch-action none`, g && g.anim === 'skIn' && g.dur === '0.14s' && g.ta === 'none' && g.mta === 'none', g);
  // trykk på et valg → kall + haptic light, pillen lukkes
  const b2 = await p.evaluate(() => { const m = window.__menu(); const x = [...m.shadowRoot.querySelectorAll('button')].find((y) => y.textContent.trim() === '+2 min'); return window.__pt(x); });
  await drain();
  await touch(cdp, b2.x, b2.y, 60);
  const S1 = await p.evaluate(() => ({ menu: !!window.__menu(), calls: window.__calls.splice(0), hap: window.__hap.splice(0), hash: location.hash }));
  ok(`C3 · ${tag}: trykk «+2 min» → skip_forward × 12, haptic light, pillen lukkes, popupen åpen`, !S1.menu && S1.calls.some((c) => c[0] === 'remote' && c[2].command === 'skip_forward' && c[2].num_repeats === 12) && S1.hap.includes('light') && S1.hash === '#media', S1);
}
// Bakover: speilvendte merker; sveip ned lukker; trykk utenfor lukker
{
  const P0 = await pt('[data-seek="-1"][data-c="left"]');
  await touch(cdp, P0.x, P0.y, 700);
  const g = await p.evaluate(() => { const m = window.__menu().shadowRoot.querySelector('.m'); return { back: m.classList.contains('back'), t: [...m.querySelectorAll('button')].map((x) => x.textContent.trim()).join(), tr: [...m.querySelectorAll('.mk')].map((x) => getComputedStyle(x).transform), c: window.__pt(m) }; });
  ok('C3 · bakover: «−1 min … −10 min», merkene speilvendt (peker mot venstre)', g.back && g.t === '−1 min,−2 min,−5 min,−10 min' && g.tr.every((x) => /matrix\(-0\.70/.test(x)), g);
  await wait(300);
  await drain();
  await touch(cdp, g.c.x, g.c.y - 10, 120, { dy: 60 });
  const S2 = await p.evaluate(() => ({ menu: !!window.__menu(), calls: window.__calls.splice(0), hash: location.hash }));
  ok('C3 · sveip ned på pillen lukker den uten spoling, popupen er åpen', !S2.menu && !S2.calls.some((c) => c[0] === 'remote' && /skip/.test(c[2].command || '')) && S2.hash === '#media', S2);
  await touch(cdp, P0.x, P0.y, 700);
  await wait(300);
  await touch(cdp, 20, 140, 60);
  const S3 = await p.evaluate(() => ({ menu: !!window.__menu(), calls: window.__calls.splice(0), hash: location.hash }));
  ok('C3 · trykk utenfor lukker uten spoling', !S3.menu && !S3.calls.some((c) => /skip/.test((c[2] && c[2].command) || '')) && S3.hash === '#media', S3);
  // Musikk: hold ⏭ → pillen over transportraden; release-klikket spoler ikke
  await p.evaluate(async () => { window.__M().select('musikk', 'media_player.spotify_jem'); await new Promise((q) => setTimeout(q, 500)); });
  await drain();
  const P1 = await pt('.sk[data-seek="1"]');
  await touch(cdp, P1.x, P1.y, 700);
  const S4 = await p.evaluate(() => { const h = window.__menu(); const m = h && h.shadowRoot.querySelector('.m').getBoundingClientRect(), tr = window.__M().shadowRoot.querySelector('.tr').getBoundingClientRect(); return { menu: !!h, dy: m && Math.round(Math.abs((m.top + m.height / 2) - (tr.top + tr.height / 2))), calls: window.__calls.splice(0), hap: window.__hap.splice(0) }; });
  ok('C3 · Musikk: hold ⏭ → pillen midt over transportraden, slippet spoler ikke, haptic light', S4.menu && S4.dy <= 2 && !S4.calls.length && S4.hap.includes('light'), S4);
  await wait(300); await touch(cdp, 20, 140, 60);
  await p.evaluate(() => window.__theme(false));
}

// ---------- E · heroen i lys modus: av / uten art / lys art / mørk art
async function hero(id, light) {
  return p.evaluate(async ({ id, light }) => {
    const wait2 = (ms) => new Promise((q) => setTimeout(q, ms));
    await window.__theme(light);
    const c = window.__M(); c.select('musikk', id); await wait2(900);
    const sec = window.__all().find((e) => e.classList && e.classList.contains('pc') && e.dataset.key === id);
    if (!sec) return null;
    const P = window.__P, over = window.__over, cr = window.__cr;
    const cs = getComputedStyle(sec), cardBg = over(P(cs.backgroundColor), [240, 240, 240, 1]);
    const op = (el) => { let o = 1, n = el; while (n && n !== sec.parentElement) { o *= +getComputedStyle(n).opacity; n = n.parentElement; } return o; };
    const txt = (el, bg) => { if (!el) return null; const f = P(getComputedStyle(el).color); return cr(over([f[0], f[1], f[2], f[3] * op(el)], bg), bg); };
    const q = (s) => sec.querySelector(s);
    const chip = q('.al-chip'), chipBg = chip && over(P(getComputedStyle(chip).backgroundColor), cardBg);
    const bts = [...sec.querySelectorAll('.al-b')].map((x) => { const bg = over(P(getComputedStyle(x).backgroundColor), cardBg); return { cr: txt(x, bg), bg: getComputedStyle(x).backgroundColor }; });
    const art = q('.al-art'), img = art && art.querySelector('img');
    const artBg = art && over(P(getComputedStyle(art).backgroundColor), cardBg);
    const ti = q('.al-ti'), ar = q('.al-ar');
    return {
      cls: sec.className, island: sec.hasAttribute('data-ki-island'), bg: cs.backgroundColor, sh: cs.boxShadow,
      title: ti && ti.textContent.trim(), tiCol: ti && getComputedStyle(ti).color, crTi: txt(ti, cardBg), crAr: txt(ar, cardBg), crChip: chip && txt(chip, chipBg), chipBg: chip && getComputedStyle(chip).backgroundColor,
      bts, img: !!img, crArt: art && !img ? txt(art, artBg) : null, artBg: art && getComputedStyle(art).backgroundColor, artIcon: art && !img && (art.querySelector('ha-icon') || {}).getAttribute && art.querySelector('ha-icon').getAttribute('icon'),
      artIconSize: art && !img && art.querySelector('ha-icon') && getComputedStyle(art.querySelector('ha-icon')).width,
      lOp: q('.al-l') && getComputedStyle(q('.al-l')).opacity, cardOp: cs.opacity,
      whiteOnLight: window.__L(cardBg) > 0.4 && ti && /^rgb\(25[0-5], 25[0-5], 25[0-5]/.test(getComputedStyle(ti).color),
    };
  }, { id, light });
}
// Tilstander: kjokken_radio av (Squeezebox Radio, avslått) · rn602_stue på uten art · spotify med lys art · spotify med mørk art
await p.evaluate(async () => { await window.__push({ 'media_player.kjokken_radio': { state: 'off' } }); });
const Hoff = await hero('media_player.kjokken_radio', true);
const Hno = await hero('media_player.rn602_stue', true);
await p.evaluate(async () => { await window.__push({ 'media_player.spotify_jem': { attributes: { entity_picture: window.__art.LIGHT_ART } } }, 800); });
await hero('media_player.spotify_jem', true); await wait(600);
const Hla = await hero('media_player.spotify_jem', true);
await p.evaluate(async () => { await window.__push({ 'media_player.spotify_jem': { attributes: { entity_picture: window.__art.DARK_ART } } }, 800); });
await hero('media_player.spotify_jem', true); await wait(600);
const Hda = await hero('media_player.spotify_jem', true);
const allCr = (H) => H && [H.crTi, H.crAr, H.crChip, ...H.bts.map((x) => x.cr), H.crArt].filter((x) => x != null);
ok('E · lys, av (Squeezebox, avslått): hvit flate (--ki-surface) med ring + skygge, ikke øy, tittel «Av» mørk', Hoff && Hoff.bg === 'rgb(255, 255, 255)' && /inset/.test(Hoff.sh) && !Hoff.island && /\blt\b/.test(Hoff.cls) && Hoff.title === 'Av' && Hoff.tiCol === 'rgb(28, 28, 28)', Hoff);
ok('E · lys, av: art-plassholder --ki-surface-2 med radio-ikon 40 px i --ki-text-3, chip og knapper --ki-surface-2', Hoff && Hoff.artBg === 'rgb(235, 235, 235)' && Hoff.artIcon === 'mdi:radio' && Hoff.artIconSize === '40px' && Hoff.chipBg === 'rgb(235, 235, 235)' && Hoff.bts.every((x) => x.bg === 'rgb(235, 235, 235)'), Hoff);
ok('E · lys, av: innholdet dempes (.85) – aldri hele kortet', Hoff && Hoff.lOp === '0.85' && Hoff.cardOp === '1', Hoff && [Hoff.lOp, Hoff.cardOp]);
ok('E · lys, av: all tekst og alle ikoner ≥ 4,5:1', Hoff && allCr(Hoff).every((x) => x >= 4.5), Hoff && allCr(Hoff));
ok('E · lys, uten art: hvit flate, tekst/ikoner ≥ 4,5:1', Hno && Hno.bg === 'rgb(255, 255, 255)' && !Hno.island && allCr(Hno).every((x) => x >= 4.5), Hno);
ok('E · lys, lys art: farget lys flate, mørk tekst (--ki-text), chip/knapper hvit .7/.75, alt ≥ 4,5:1', Hla && /\blta\b/.test(Hla.cls) && !Hla.island && Hla.tiCol === 'rgb(28, 28, 28)' && /0\.7\)/.test(Hla.chipBg) && Hla.bts.every((x) => /0\.75\)/.test(x.bg)) && allCr(Hla).every((x) => x >= 4.5) && !Hla.whiteOnLight, Hla);
ok('E · lys, mørk art: mørk øy med hvit tekst, chip/knapper hvit .7/.75 med mørk tekst, alt ≥ 4,5:1', Hda && /\blti\b/.test(Hda.cls) && Hda.island && /^rgb\(25[0-5]/.test(Hda.tiCol) && allCr(Hda).every((x) => x >= 4.5), Hda);
ok('E · ingen hvit tekst på lys flate', [Hoff, Hno, Hla].every((H) => H && !H.whiteOnLight), [Hoff, Hno, Hla].map((H) => H && H.tiCol));
// Detaljert-kortet (now_playing.style detailed) i lys modus, av → hvit flate
const Hdet = await p.evaluate(async () => {
  const wait2 = (ms) => new Promise((q) => setTimeout(q, ms));
  const c = window.__M(); const old = c.config; c.setConfig({ ...old, now_playing: { style: 'detailed' } }); await wait2(600);
  c.select('musikk', 'media_player.kjokken_radio'); await wait2(700);
  const sec = window.__all().find((e) => e.classList && e.classList.contains('pc') && e.dataset.key === 'media_player.kjokken_radio');
  const P = window.__P, cr = window.__cr, bg = P(getComputedStyle(sec).backgroundColor), ti = sec.querySelector('.ti'), pwb = sec.querySelector('.pw');
  const o = { bg: getComputedStyle(sec).backgroundColor, island: sec.hasAttribute('data-ki-island'), cr: cr(P(getComputedStyle(ti).color), bg), pw: getComputedStyle(pwb).backgroundColor, pwCr: cr(P(getComputedStyle(pwb).color), P(getComputedStyle(pwb).backgroundColor)) };
  c.setConfig(old); await wait2(400);
  return o;
});
ok('E · lys, Detaljert-kortet av: hvit flate, tittel ≥ 4,5:1, av/på-knapp --ki-surface-2', Hdet.bg === 'rgb(255, 255, 255)' && !Hdet.island && Hdet.cr >= 4.5 && Hdet.pw === 'rgb(235, 235, 235)' && Hdet.pwCr >= 4.5, Hdet);

// ---------- E · mørk modus uendret: samme tilstander mot før-koden (git HEAD)
const darkSnap = (pg) => pg.evaluate(async () => {
  const wait2 = (ms) => new Promise((q) => setTimeout(q, ms));
  await window.__theme(false);
  await window.__push({ 'media_player.kjokken_radio': { state: 'off' }, 'media_player.spotify_jem': { state: 'paused', attributes: { entity_picture: window.__art.DARK_ART, media_position: 100, media_position_updated_at: '2026-01-01T00:00:00Z' } } }, 600); // pauset: fast fremdrift
  const out = {};
  for (const id of ['media_player.kjokken_radio', 'media_player.rn602_stue', 'media_player.spotify_jem', 'media_player.stue_sonos']) {
    window.__M().select('musikk', id); await wait2(900);
    const sec = window.__all().find((e) => e.classList && e.classList.contains('pc') && e.dataset.key === id);
    if (!sec) { out[id] = null; continue; }
    const els = [sec, ...sec.querySelectorAll('*')].filter((e) => e.localName !== 'ha-icon' && e.localName !== 'img');
    out[id] = els.map((e) => { const s = getComputedStyle(e); return [e.className && e.className.baseVal == null ? String(e.className).replace(/\b(pri)\b/g, '').trim() : e.localName, s.color, s.backgroundColor, s.backgroundImage.slice(0, 120), s.boxShadow, s.opacity, s.borderRadius].join(' | '); });
  }
  return out;
});
const D1 = await darkSnap(p);
if (BASE) {
  const B = await page(BASE);
  const D0 = await darkSnap(B.p);
  const diff = [];
  Object.keys(D0).forEach((id) => { const a = D0[id] || [], c = D1[id] || []; if (a.length !== c.length) diff.push([id, 'antall', a.length, c.length]); a.forEach((x, i) => { if (x !== c[i]) diff.push([id, i, x, c[i]]); }); });
  ok('E · mørk modus uendret (hero: av / uten art / mørk art / pause – element for element mot git HEAD)', !diff.length && Object.values(D1).every(Boolean), diff.slice(0, 6));
  await B.ctx.close();
} else ok('E · mørk modus: alle kort er mørke øyer (uten før-bundel)', Object.values(D1).every((x) => x && /^pc/.test(x[0])), D1);

// ---------- E · mini-spilleren og Rom-spillerraden i lys modus (egen side uten Bubble: harness.html)
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const q = await ctx.newPage();
  const e2 = []; q.on('pageerror', (e) => e2.push(e.message));
  await q.goto('file://' + resolve('test/harness.html'));
  for (const m of readdirSync('test/mock').sort()) await q.addScriptTag({ path: resolve('test/mock/' + m) });
  await q.addScriptTag({ path: bundle });
  const r = await q.evaluate(async () => {
    const wait2 = (ms) => new Promise((x) => setTimeout(x, ms));
    const deepAll = (sel) => { const out = []; const walk = (root) => root.querySelectorAll('*').forEach((e) => { if (e.matches(sel)) out.push(e); if (e.shadowRoot) walk(e.shadowRoot); }); walk(document); return out; };
    const P = (c) => { const m = String(c).match(/[\d.]+/g); return m ? [+m[0], +m[1], +m[2], m[3] == null ? 1 : +m[3]] : [0, 0, 0, 0]; };
    const over = (f, bg) => { const a = f[3]; return [f[0] * a + bg[0] * (1 - a), f[1] * a + bg[1] * (1 - a), f[2] * a + bg[2] * (1 - a), 1]; };
    const L = (c) => { const g = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * g(c[0]) + 0.7152 * g(c[1]) + 0.0722 * g(c[2]); };
    const cr = (f, bg) => { const x = L(f), y = L(bg); return +((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)).toFixed(2); };
    const H = window.mockHass(); H.themes = { ...(H.themes || {}), darkMode: false };
    const S = H.states;
    Object.keys(S).filter((k) => k.startsWith('media_player.')).forEach((k) => { S[k] = { ...S[k], state: 'off' }; });
    S['media_player.rn602_stue'] = { ...S['media_player.rn602_stue'], state: 'playing', attributes: { ...S['media_player.rn602_stue'].attributes, media_title: 'Radio', entity_picture: undefined }, last_changed: new Date().toISOString() };
    S['media_player.stue_sonos'] = { ...S['media_player.stue_sonos'], state: 'off' };
    window.MSH.theme.set('light');
    const dash = document.getElementById('dash');
    const nb = document.createElement('msh-navbar-card'); nb.setConfig({ type: 'custom:msh-navbar-card', card_id: 'ki-navbar' }); nb.hass = H; dash.appendChild(nb);
    const rom = document.createElement('msh-rom-card'); rom.setConfig({ type: 'custom:msh-rom-card', card_id: 'r56', area: 'stue' }); rom.hass = H; dash.appendChild(rom);
    await wait2(500); rom.setUI({ acc: { media: true } }); await wait2(900);
    const o = {};
    const mart = deepAll('[data-mini] .mart').find((x) => x.getBoundingClientRect().width > 0), mini = deepAll('[data-mini]')[0];
    if (mart && mini) {
      const mbg = over(P(getComputedStyle(mini).backgroundColor), [230, 230, 230, 1]), abg = over(P(getComputedStyle(mart).backgroundColor), mbg);
      const b0 = mini.querySelector('.mtx b');
      o.mini = { art: getComputedStyle(mart).backgroundColor, crIcon: cr(P(getComputedStyle(mart).color), abg), crName: b0 && cr(P(getComputedStyle(b0).color), mbg) };
    }
    const mt = rom.shadowRoot.querySelector('.mt');
    if (mt) {
      const bg = over(P(getComputedStyle(mt).backgroundColor), [255, 255, 255, 1]);
      const t = (s) => { const e = mt.querySelector(s); return e ? cr(P(getComputedStyle(e).color), bg) : null; };
      const mb = mt.querySelector('.mctl .mb:not(.mo)'), mbBg = mb && over(P(getComputedStyle(mb).backgroundColor), bg);
      const art = mt.querySelector('.art'), artBg = art && over(P(getComputedStyle(art).backgroundColor), bg);
      o.rom = { bg: getComputedStyle(mt).backgroundColor, mn: t('.mn'), ms: t('.ms'), mb: mb && cr(P(getComputedStyle(mb).color), mbBg), art: art && cr(P(getComputedStyle(art).color), artBg), white: /^rgb\(25[0-5], 25[0-5], 25[0-5]/.test(getComputedStyle(mt.querySelector('.ms')).color) };
    }
    return o;
  });
  ok('E · lys, mini-spilleren: art-plassholder --ki-surface-2, ikon og navn ≥ 4,5:1', r.mini && r.mini.art === 'rgb(235, 235, 235)' && r.mini.crIcon >= 4.5 && r.mini.crName >= 4.5, r.mini);
  ok('E · lys, Rom-spillerraden (av): tekst, knapper og plassholder ≥ 4,5:1, ingen hvit tekst', r.rom && [r.rom.mn, r.rom.ms, r.rom.mb, r.rom.art].every((x) => x != null && x >= 4.5) && !r.rom.white, r.rom);
  ok('E · ingen sidefeil (mini/Rom)', !e2.length, e2);
  await ctx.close();
}

ok('ingen sidefeil', !errs.length, errs);
await b.close();
try { rmSync(bundle, { force: true }); if (baseDir) { rmSync(baseDir, { recursive: true, force: true }); rmSync(BASE, { force: true }); } } catch (e) { /* */ }
console.log(JSON.stringify(res, null, 1));
const bad = Object.values(res).filter((v) => v !== 'OK').length;
console.log(bad ? `\n${bad} feilet` : `\nAlle bestod (${Object.keys(res).length})`);
process.exit(bad ? 1 : 0);
