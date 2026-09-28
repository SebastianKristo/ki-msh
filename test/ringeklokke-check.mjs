// Fiks 19.17–19.19 · Ringeklokke (#ringeklokke, msh-ringeklokke-card) + ringe-kortet på Hjem + kaldstart fra varsel.
//   node test/ringeklokke-check.mjs
import { createRequire } from 'node:module';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const bundle = resolve(`test/.build/ringeklokke-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const shots = process.env.SHOTS || '';
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const res = {}, fail = [];
const ok = (name, cond, info) => { res[name] = cond ? 'OK' : ['FEIL', info]; if (!cond) fail.push(name); };
const mocks = readdirSync('test/mock').sort().map((m) => resolve('test/mock/' + m));
const errs = [];
async function page(url, vp) {
  const p = await b.newPage({ viewport: vp || { width: 430, height: 1000 }, hasTouch: true });
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(url);
  for (const m of mocks) await p.addScriptTag({ path: m });
  await p.addScriptTag({ path: bundle });
  return p;
}
const wait = (p, ms) => p.evaluate((ms) => new Promise((q) => setTimeout(q, ms)), ms);

/* ---------------------------------------------------------------- 19.17 · popupen */
const p = await page('file://' + resolve('test/harness.html'));
const A = await p.evaluate(async () => {
  const w = (ms) => new Promise((q) => setTimeout(q, ms));
  window.__h = window.mockHass();
  const bc = document.createElement('bubble-card');
  bc.setConfig({ type: 'custom:bubble-card', card_type: 'pop-up', hash: '#ringeklokke' });
  bc.innerHTML = '<div class="pop"><div class="hdr">Ringeklokke</div><div class="inner"></div></div>';
  document.getElementById('dash').appendChild(bc);
  location.hash = '#ringeklokke';
  const c = document.createElement('msh-ringeklokke-card');
  c.setConfig({ type: 'custom:msh-ringeklokke-card', card_id: 'pop-ringeklokke' });
  c.hass = window.__h;
  bc.querySelector('.inner').appendChild(c);
  window.__c = c;
  await w(600);
  const sr = c.shadowRoot, q = (s) => sr.querySelector(s), qa = (s) => [...sr.querySelectorAll(s)];
  const A = window.MSH.ringAuto(window.__h, c.config);
  return {
    auto: A, vidH: q('.vid') && Math.round(q('.vid').getBoundingClientRect().height),
    chips: qa('.dc').map((e) => e.textContent.trim()), seg: qa('.sg').map((e) => e.textContent + (e.classList.contains('on') ? '*' : '')),
    live: q('.live') && q('.live').textContent.trim(), acts: qa('.ac').map((e) => e.querySelector('span:not(.fill)').textContent),
    grid: q('.acts') && q('.acts').style.gridTemplateColumns, reps: qa('.rp').map((e) => e.textContent.trim()), hist: qa('.hr').length,
    title: q('.bot .tt') && q('.bot .tt').textContent, sub: q('[data-ago]') && q('[data-ago]').textContent, gear: !!q('.rb[data-act="customize"]'),
    width: Math.round(c.getBoundingClientRect().width), host: Math.round(bc.querySelector('.inner').clientWidth - 36),
  };
});
ok('19.17 autokonfig: ringe-utløser binary_sensor.*_doorbell (unifiprotect)', A.auto.ring === 'binary_sensor.inngang_doorbell', A.auto);
ok('19.17 autokonfig: kamera/pakke/lås/høyttaler/volum', A.auto.camera === 'camera.inngang' && A.auto.pkg === 'camera.inngang_package_camera' && A.auto.lock === 'lock.inngangsdor' && A.auto.speaker === 'media_player.inngang_speaker' && A.auto.volume === 'number.inngang_doorbell_ring_volume', A.auto);
ok('19.17 video 300 px med LIVE og tannhjul', A.vidH === 300 && A.live === 'LIVE' && A.gear, A);
ok('19.17 Kamera · Pakkekamera (pakke oppdaget → pakkekamera først)', A.seg.join('|') === 'Kamera|Pakkekamera*', A.seg);
ok('19.17 deteksjons-chips bare for aktive sensorer', A.chips.join('|') === 'Pakke|Snakker', A.chips);
ok('19.17 tre handlinger', A.acts.join('|') === 'Ta bilde|Lås opp|Avvis' && /repeat\(3/.test(A.grid), A);
ok('19.17 svar-piller + «Egen tekst» sist', A.reps[0] === 'Kommer!' && A.reps[A.reps.length - 1] === 'Egen tekst' && A.reps.length === 5, A.reps);
ok('19.17 Tidligere i dag: tre hendelser', A.hist === 3, A.hist);
ok('19.17 undertekst «Gang · ringte …»', /^Gang · ringte /.test(A.sub || ''), A.sub);
ok('19.17 fyller bredden', Math.abs(A.width - A.host) <= 1, [A.width, A.host]);
if (shots) await p.screenshot({ path: shots + '/rk-popup.png', fullPage: true });

// Svar → tts.speak på høyttaleren
const sp = await p.evaluate(async () => {
  window.__calls.length = 0;
  window.__c.shadowRoot.querySelector('.rp[data-i="0"]').click();
  await new Promise((q) => setTimeout(q, 100));
  return window.__calls.find((x) => x[0] === 'tts');
});
ok('19.17 svar spilles med tts.speak på høyttaleren', sp && sp[1] === 'speak' && sp[2].media_player_entity_id === 'media_player.inngang_speaker' && sp[2].message === 'Kommer!', sp);
// Ta bilde
const sn = await p.evaluate(async () => { window.__calls.length = 0; window.__c.shadowRoot.querySelector('[data-act="snap"]').click(); await new Promise((q) => setTimeout(q, 80)); return window.__calls.find((x) => x[0] === 'camera'); });
ok('19.17 Ta bilde → camera.snapshot /media/ringeklokke/…', sn && sn[1] === 'snapshot' && /^\/media\/ringeklokke\/\d{8}_\d{6}\.jpg$/.test(sn[2].filename), sn);
// Hold 1 s på Lås opp
const hl = await p.evaluate(async () => {
  window.__calls.length = 0;
  const b = window.__c.shadowRoot.querySelector('.ac.un'), r = b.getBoundingClientRect(), o = { bubbles: true, composed: true, clientX: r.left + 20, clientY: r.top + 20, pointerId: 3 };
  b.dispatchEvent(new PointerEvent('pointerdown', o));
  await new Promise((q) => setTimeout(q, 400));
  const early = window.__calls.some((x) => x[0] === 'lock');
  await new Promise((q) => setTimeout(q, 800));
  b.dispatchEvent(new PointerEvent('pointerup', o));
  return { early, call: window.__calls.find((x) => x[0] === 'lock'), ta: getComputedStyle(b).touchAction };
});
ok('19.17 Lås opp: hold 1 s → lock.unlock (ikke før), touch-action none', !hl.early && hl.call && hl.call[1] === 'unlock' && hl.call[2].entity_id === 'lock.inngangsdor' && hl.ta === 'none', hl);

// «Tilpass ringeklokke»: fire faner, (ingen) skjuler Lås opp live, Ferdig
const ed = await p.evaluate(async () => {
  const w = (ms) => new Promise((q) => setTimeout(q, ms));
  window.__c.customize();
  await w(300);
  const sheet = window.__c._sheet, root = sheet.ov.root, q = (s) => root.querySelector(s);
  const tabs = [...root.querySelectorAll('.tab')].map((t) => t.textContent.trim());
  const sel = q('select[data-k="lock"]');
  const link = q('.lk') && q('.lk').textContent;
  sel.value = 'none'; sel.dispatchEvent(new Event('change', { bubbles: true }));
  await w(200);
  const acts = [...window.__c.shadowRoot.querySelectorAll('.ac')].map((e) => e.querySelector('span:not(.fill)').textContent);
  q('.tab[data-k="visning"]').click(); await w(80);
  const vis = !!q('.msh-dbm') && root.querySelectorAll('.chip[data-a="det"]').length;
  q('.tab[data-k="svar"]').click(); await w(80);
  const nRep = root.querySelectorAll('input[data-in="rp"]').length;
  q('[data-a="rpadd"]').click(); await w(80);
  const nRep2 = root.querySelectorAll('input[data-in="rp"]').length;
  const pills = window.__c.shadowRoot.querySelectorAll('.rp').length;
  q('.tab[data-k="handlinger"]').click(); await w(80);
  const segs = root.querySelectorAll('.seg').length;
  q('[data-a="done"]').click(); await w(900);
  return { tabs, link, acts, vis, nRep, nRep2, pills, segs, closed: sheet.ov.closed, cfg: window.__c.config.lock, stored: window.MSH.store.get('cards.pop-ringeklokke') };
});
ok('19.17 Tilpass ringeklokke: fire faner', ed.tabs.join('|') === 'Enhet|Handlinger|Svar|Visning', ed.tabs);
ok('19.19 Lenke for varsler i Enhet', /#ringeklokke$/.test(ed.link || ''), ed.link);
ok('19.17 «(ingen)» lås skjuler Lås opp (live), to handlinger', ed.acts.join('|') === 'Ta bilde|Avvis', ed.acts);
ok('19.17/19.18 Visning: «Når det ringer» + 8 deteksjoner', ed.vis === 8, ed.vis);
ok('19.17 Svar: legg til svar vises straks', ed.nRep === 4 && ed.nRep2 === 5 && ed.pills === 6, ed);
ok('19.17 Handlinger: hold-tid + demp-segment', ed.segs === 2, ed.segs);
ok('19.17 Ferdig lagrer (ki-store cards.pop-ringeklokke)', ed.closed && ed.stored && ed.stored.lock === 'none' && Array.isArray(ed.stored.replies) && ed.stored.replies.length === 5, ed.stored);

// GUI-editor: samme skjema (Enhet · Handlinger · Svar · Visning)
const gui = await p.evaluate(async () => {
  const e = window.__c.constructor.getConfigElement();
  e.hass = window.__h; e.setConfig({ type: 'custom:msh-ringeklokke-card', card_id: 'pop-ringeklokke', lock: 'none' });
  document.body.appendChild(e);
  await new Promise((q) => setTimeout(q, 100));
  const secs = [...e.shadowRoot.querySelectorAll('details.sec > summary')].map((s) => s.textContent.trim());
  let got = null; e.addEventListener('config-changed', (ev) => { got = ev.detail.config; });
  const add = e.shadowRoot.querySelector('[data-op="add"]'); if (add) add.click();
  await new Promise((q) => setTimeout(q, 50));
  const dbm = !!e.shadowRoot.querySelector('.msh-dbm');
  e.remove();
  return { secs, got: got && got.replies && got.replies.length, dbm };
});
ok('19.17 GUI-editor: fire grupper (+ Mellomrom)', gui.secs.slice(0, 4).join('|') === 'Enhet|Handlinger|Svar|Visning', gui.secs);
ok('19.17 GUI-editor: svar-listen redigerbar + «Når det ringer»', gui.got >= 5 && gui.dbm, gui);

// Avvis: demper ringelyden (number = 0) og lukker popupen
const av = await p.evaluate(async () => {
  window.__calls.length = 0;
  window.__c.shadowRoot.querySelector('[data-act="dismiss"]').click();
  await new Promise((q) => setTimeout(q, 100));
  return { call: window.__calls.find((x) => x[0] === 'number'), hash: location.hash, mute: JSON.parse(localStorage.getItem('ki:ring-mute') || 'null') };
});
ok('19.17 Avvis: ringevolum 0 i 5 min + popupen lukkes', av.call && av.call[1] === 'set_value' && av.call[2].value === 0 && av.hash === '' && av.mute && av.mute.v === 80, av);
await p.close();

/* ---------------------------------------------------------------- 19.18 · kort på Hjem / popup / av */
const p2 = await page('file://' + resolve('test/harness.html'));
const flip = (on) => p2.evaluate(async (on) => {
  const h = window.__hh, S = { ...h.states };
  S['binary_sensor.inngang_doorbell'] = { ...S['binary_sensor.inngang_doorbell'], state: on ? 'on' : 'off', last_changed: new Date().toISOString() };
  window.__hh = { ...h, states: S };
  window.__hj.hass = window.__hh;
  await new Promise((q) => setTimeout(q, 500));
}, on);
const hjem = () => p2.evaluate(() => {
  const f = window.__hj._kids.faner, fs = f && f.shadowRoot;
  const slot = fs && fs.querySelector('[data-ring-slot]'), bn = slot && slot.querySelector('msh-ring-banner');
  const tabs = fs ? [...fs.querySelectorAll('.tab')] : [];
  const bsr = bn && bn.shadowRoot;
  const tabsEl = fs && fs.querySelector('.tabs'), rc = bsr && bsr.querySelector('.rc');
  return {
    banner: !!bn, text: bsr ? bsr.textContent.replace(/\s+/g, ' ').trim() : '', hash: location.hash, dot: tabs.some((t) => t.querySelector('.rdot')), tab: (tabs.find((t) => t.classList.contains('on')) || {}).textContent,
    below: !!(tabsEl && rc && rc.getBoundingClientRect().top >= tabsEl.getBoundingClientRect().bottom), thumb: bsr && !!bsr.querySelector('.th .live'), hold: bsr && !!bsr.querySelector('.hold'), svar: bsr && !!bsr.querySelector('.sv'), tl: bsr && !!bsr.querySelector('.tl span'),
    shadow: rc && getComputedStyle(rc).boxShadow, radius: rc && getComputedStyle(rc).borderRadius,
  };
});
await p2.evaluate(async () => {
  window.__hh = window.mockHass();
  history.pushState = () => {};
  const hj = document.createElement('msh-hjem-card');
  hj.setConfig({ type: 'custom:msh-hjem-card', card_id: 'ki-home', cards: { faner: { type: 'custom:msh-hjem-faner-card', card_id: 'ki-home-faner' } }, hidden: ['header', 'prosa', 'soppel', 'strom', 'gjoremal'] });
  hj.hass = window.__hh;
  document.getElementById('dash').appendChild(hj);
  window.__hj = hj;
  window.__hap = []; window.addEventListener('haptic', (e) => window.__hap.push(e.detail));
  await new Promise((q) => setTimeout(q, 900));
  window.MSH.setDoorbellMode('card');
  await new Promise((q) => setTimeout(q, 120));
  window.__hap.length = 0;
});
let H = await hjem();
ok('19.18 ingen kort før det ringer', !H.banner, H);
await flip(true);
H = await hjem();
ok('19.18 ring → kort øverst i Hjem-fanen (under fanelinjen)', H.banner && H.below && /Det ringer på · Gang/.test(H.text) && H.hash === '', H);
ok('19.18 kortet: miniatyr med LIVE, hold-pille, Svar ▾, tidslinje', H.thumb && H.hold && H.svar && H.tl && /Hold for å låse opp/.test(H.text), H);
ok('19.18 kortet: radius 30 + rosa kant', H.radius === '30px' && /242, 133, 201/.test(H.shadow || ''), [H.radius, H.shadow]);
const hap = await p2.evaluate(() => window.__hap.slice());
ok('19.18 haptic heavy én gang', hap.filter((x) => x === 'heavy').length === 1, hap);
if (shots) await p2.screenshot({ path: shots + '/rk-hjem.png' });
// Svar ▾ åpner svar-pillene
const sv = await p2.evaluate(async () => { const bn = window.__hj._kids.faner.shadowRoot.querySelector('msh-ring-banner'); bn.shadowRoot.querySelector('.sv').click(); await new Promise((q) => setTimeout(q, 80)); return [...bn.shadowRoot.querySelectorAll('.rp')].map((e) => e.textContent.trim()); });
ok('19.18 Svar ▾ viser svar-pillene', sv[0] === 'Kommer!' && sv.length === 5, sv);
// Annen fane → kortet vises ikke, rosa prikk på Hjem-fanen
await p2.evaluate(async () => { const f = window.__hj._kids.faner; f.shadowRoot.querySelectorAll('.tab')[1].click(); await new Promise((q) => setTimeout(q, 400)); });
H = await hjem();
ok('19.18 annen fane: ikke kort, rosa prikk på Hjem', !H.banner && H.dot, H);
await p2.evaluate(async () => { const f = window.__hj._kids.faner; f.shadowRoot.querySelectorAll('.tab')[0].click(); await new Promise((q) => setTimeout(q, 400)); });
H = await hjem();
ok('19.18 tilbake på Hjem: kortet igjen', H.banner && !H.dot, H);
// ✕ avviser
await p2.evaluate(async () => { window.__hj._kids.faner.shadowRoot.querySelector('msh-ring-banner').shadowRoot.querySelector('.x').click(); await new Promise((q) => setTimeout(q, 300)); });
H = await hjem();
ok('19.18 ✕ fjerner kortet', !H.banner && !H.dot, H);
// Popup-modus: åpner #ringeklokke, navbar/mini-spiller skjules
await flip(false);
await p2.evaluate(async () => {
  window.MSH.setDoorbellMode('popup');
  const nav = document.createElement('msh-navbar-card');
  nav.setConfig({ type: 'custom:msh-navbar-card', card_id: 'ki-navbar' }); nav.hass = window.__hh;
  document.getElementById('dash').appendChild(nav); window.__nav = nav;
  // mock/10-navbar.js kjører sin egen #klima-sjekk (setter og tømmer hashen) når navbaren kommer – vent den ut
  await new Promise((q) => setTimeout(q, 2500));
});
await flip(true);
const pop = await p2.evaluate(async () => {
  await new Promise((q) => setTimeout(q, 300));
  const pt = document.querySelector('.msh-navbar-portal'), nb = pt && pt.shadowRoot.querySelector('nav.nb');
  return { hash: location.hash, ring: pt && pt.hasAttribute('data-ring'), op: nb && getComputedStyle(nb).opacity, pe: nb && getComputedStyle(nb).pointerEvents, banner: !!window.__hj._kids.faner.shadowRoot.querySelector('msh-ring-banner') };
});
ok('19.18 Popup: åpner #ringeklokke, ikke kort', pop.hash === '#ringeklokke' && !pop.banner, pop);
ok('19.17 navbar skjult mens #ringeklokke er åpen', pop.ring && pop.op === '0' && pop.pe === 'none', pop);
const back = await p2.evaluate(async () => { window.MSH.closePopup(); await new Promise((q) => setTimeout(q, 400)); const pt = document.querySelector('.msh-navbar-portal'); return { ring: pt.hasAttribute('data-ring'), op: getComputedStyle(pt.shadowRoot.querySelector('nav.nb')).opacity }; });
ok('19.17 navbar tilbake når popupen lukkes', !back.ring && back.op === '1', back);
// Av: ingen kort og ingen popup
await flip(false);
await p2.evaluate(() => window.MSH.setDoorbellMode('off'));
await flip(true);
H = await hjem();
ok('19.18 Av: ingen kort, ingen popup', !H.banner && H.hash === '', H);
const persisted = await p2.evaluate(() => ({ prof: window.MSH.store.get('doorbell_profiles'), mode: window.MSH.doorbellMode() }));
ok('19.18 valget lagres per bruker × enhet (doorbell_profiles)', persisted.mode === 'off' && JSON.stringify(persisted.prof || {}).includes('"mode":"off"'), persisted);
await p2.close();

/* ---------------------------------------------------------------- 19.19 · kaldstart med #ringeklokke (ekte Bubble Card) */
const BC = resolve('test/.vendor/bubble-card.js');
if (existsSync(BC)) {
  const popups = JSON.parse(execFileSync('python3', ['-c', "import yaml,json;d=yaml.safe_load(open('examples/dashboard.yaml'));print(json.dumps([c for s in d['views'][0]['sections'] for c in s['cards'] if c.get('hash')=='#ringeklokke']))"]).toString());
  const p3 = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
  p3.on('pageerror', (e) => errs.push(e.message));
  await p3.goto('file://' + resolve('test/harness-bubble.html') + '#ringeklokke');
  for (const m of mocks) await p3.addScriptTag({ path: m });
  await p3.addScriptTag({ path: bundle });
  await p3.addScriptTag({ path: BC, type: 'module' });
  await p3.waitForFunction(() => customElements.get('bubble-card'), null, { timeout: 15000 });
  const cs = await p3.evaluate(async (pop) => {
    const w = (ms) => new Promise((q) => setTimeout(q, ms));
    window.MSH.setDoorbellMode('off'); // varselet er et eksplisitt valg – åpnes også når «Når det ringer» = Av
    const hass = window.mockHass(), dash = document.getElementById('dash');
    let lc = 0; window.addEventListener('location-changed', () => lc++);
    const hj = document.createElement('msh-hjem-card');
    hj.setConfig({ type: 'custom:msh-hjem-card', card_id: 'ki-home', hidden: ['header', 'prosa', 'soppel', 'strom', 'gjoremal'] }); hj.hass = hass; dash.appendChild(hj);
    await w(300);
    const bc = document.createElement('bubble-card'); bc.setConfig(pop); bc.hass = hass; dash.appendChild(bc);
    await w(3000);
    const all = []; const walk = (r) => r.querySelectorAll('*').forEach((e) => { all.push(e); if (e.shadowRoot) walk(e.shadowRoot); }); walk(document);
    const P = all.find((e) => e.classList && e.classList.contains('bubble-pop-up'));
    const card = all.find((e) => e.localName === 'msh-ringeklokke-card');
    return { hash: location.hash, open: !!P && P.classList.contains('is-popup-opened'), card: !!card && card.getBoundingClientRect().height > 100, lc };
  }, popups[0]);
  ok('19.19 kaldstart med #ringeklokke åpner popupen (også når modus = Av)', cs.hash === '#ringeklokke' && cs.open && cs.card, cs);
  if (shots) await p3.screenshot({ path: shots + '/rk-kald.png' });
  await p3.close();
} else res['19.19 kaldstart'] = 'hoppet over (test/.vendor/bubble-card.js mangler – kjør npm run checklist først)';

ok('ingen sidefeil', !errs.length, errs.slice(0, 5));
await b.close();
console.log(JSON.stringify(res, null, 1));
console.log(fail.length ? `\n${fail.length} FEIL` : '\nAlle bestod');
process.exit(fail.length ? 1 : 0);
