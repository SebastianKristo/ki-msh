// Fiks 36.1–36.4 · kombinerte rom («Stue + Kjøkken» og «Gang + Soverom + Bad») mot ekte Bubble Card:
//  · strategien: popup #<id> med ett msh-rom-card (rooms: [..]), enkeltrommenes popups beholdes
//  · Hjem: ett romkort med summert status, enkeltrommene skjult, kombinasjonen på primærrommets etasje
//  · popup via hash: klima-toppkort først (rom-velger-chip), alle seksjoner, romtagger, «Grupper per rom», «Alle lys»
//  · «Tilpass Hjem» → Kort → «Kombiner rom»: liste, nytt kombinert rom (rom i annen kombinasjon grået), hold-dra-rekkefølge,
//    «Del opp igjen» gjenoppretter enkeltrommenes plassering, oppløst kombinasjon (slettet område) → melding
//  · GUI-editoren (msh-rom-card) speiler valget til ki-store-listen
//  · lys + mørk modus, touch-dra i popupen lukker den ikke
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { readdirSync, existsSync, mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const BC = resolve('test/.vendor/bubble-card.js');
if (!existsSync(BC)) execFileSync('curl', ['-sSL', '-o', BC, 'https://raw.githubusercontent.com/Clooos/Bubble-Card/main/dist/bubble-card.js']);
mkdirSync('test/.build', { recursive: true });
const bundle = resolve(`test/.build/kombinert36-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
p.on('console', (m) => { if (m.type() === 'error' && !/ERR_|CORS|bubble-modules|Failed to/.test(m.text())) errs.push(m.text().slice(0, 200)); });
await p.goto('file://' + resolve('test/harness-bubble.html'));
for (const m of readdirSync('test/mock').sort()) await p.addScriptTag({ path: resolve('test/mock/' + m) });
await p.addScriptTag({ path: bundle });
await p.addScriptTag({ path: BC, type: 'module' });
await p.waitForFunction(() => customElements.get('bubble-card'));
const res = {}, fail = [];
const ok = (name, cond, info) => { res[name] = cond ? 'OK' : ['FEIL', info]; if (!cond) fail.push(name); };
const E = (fn, arg) => p.evaluate(fn, arg);

// ---------------------------------------------------------------- oppsett: ki-store + strategi + stacken
const gen = await E(async () => {
  const wait = (ms) => new Promise((q) => setTimeout(q, ms));
  window.__wait = wait;
  window.__all = () => { const o = []; const w = (r) => r.querySelectorAll('*').forEach((e) => { o.push(e); if (e.shadowRoot) w(e.shadowRoot); }); w(document); return o; };
  window.__userData.ki_dashboard = { cards: { 'ki-home-faner': {
    layout: { forste: { order: ['kjokken', 'gang', 'stue'] } },
    combined_rooms: [
      { id: 'stue-kjokken', name: 'Stue + Kjøkken', icon: 'mdi:sofa', color: 'var(--orange)', rooms: ['stue', 'kjokken'], primary: 'stue', hide_members: true, layout: 'merge' },
      { name: 'Gang + Soverom + Bad', rooms: ['gang', 'soverom', 'bad'], primary: 'soverom' },
    ] } } };
  const hass = window.mockHass();
  window.__h = hass;
  const M = window.MSH;
  await M.store.load(hass);
  const S = customElements.get('ll-strategy-dashboard-ki-dashboard');
  const dash = await S.generate({}, hass);
  const stack = dash.views[0].cards[0];
  const pops = stack.cards.filter((c) => c.card_type === 'pop-up');
  const P = (h) => pops.find((x) => x.hash === h);
  const out = { hashes: pops.map((x) => x.hash), sk: P('#stue-kjokken'), gsb: P('#gang-soverom-bad'), stue: !!P('#stue'), kjokken: !!P('#kjokken') };
  const root = document.getElementById('dash');
  for (const c of stack.cards) { const el = document.createElement(c.type.replace('custom:', '')); el.setConfig(c); el.hass = hass; root.appendChild(el); }
  await wait(900);
  return out;
});
const sk = gen.sk, gsb = gen.gsb;
ok('strategi · popup #stue-kjokken (mal B, ett msh-rom-card med rooms)', sk && sk.cards.length === 1 && sk.cards[0].type === 'custom:msh-rom-card' && JSON.stringify(sk.cards[0].rooms) === '["stue","kjokken"]' && sk.cards[0].area === 'stue-kjokken' && sk.name === 'Stue + Kjøkken' && sk.icon === 'mdi:sofa' && sk.bg_opacity === '88' && /var\(--orange\)/.test(sk.styles), sk && { cards: sk.cards, name: sk.name, icon: sk.icon });
ok('strategi · 3-roms popup #gang-soverom-bad (primær soverom)', gsb && gsb.cards[0].rooms.length === 3 && gsb.cards[0].primary === 'soverom' && gsb.cards[0].layout === 'merge', gsb && gsb.cards[0]);
ok('strategi · enkeltrommenes popups beholdes (#stue, #kjokken)', gen.stue && gen.kjokken, gen.hashes);

// ---------------------------------------------------------------- Hjem: romkortet
const hjem = await E(async () => {
  const M = window.MSH, f = window.__all().find((e) => e.localName === 'msh-hjem-faner-card');
  const T = f._TV || [];
  const out = { tabs: T.map((t) => t.id) };
  const hashesOn = (id) => { const i = T.findIndex((t) => t.id === id); if (i >= 0) f._pickTab(i); return new Promise((q) => setTimeout(() => q([...f.shadowRoot.querySelectorAll('[data-act="rk-open"]')].map((e) => e.dataset.hash).filter((v, i, a) => a.indexOf(v) === i)), 350)); };
  out.hjem = await hashesOn('hjem');
  out.forste = await hashesOn('forste');
  out.andre = await hashesOn('andre');
  const r = M.romData(f, 'stue-kjokken', {});
  out.data = r && { name: r.name, lightsOn: r.lightsOn, lights: r.lights.length, temp: r.temp, mediaOn: r.mediaOn, watt: r.watt, hash: r.hash, floor: r.floor };
  const r3 = M.romData(f, 'gang-soverom-bad', {});
  out.data3 = r3 && { name: r3.name, temp: r3.temp, floor: r3.floor, lights: r3.lights.length };
  return out;
});
ok('Hjem · 1. etg viser «Stue + Kjøkken», ikke enkeltrommene (eller Gang)', hjem.forste.includes('#stue-kjokken') && !hjem.forste.includes('#stue') && !hjem.forste.includes('#kjokken') && !hjem.forste.includes('#gang'), hjem.forste);
ok('Hjem · 3-roms-kombinasjonen på primærrommets etasje (2. etg)', hjem.andre.includes('#gang-soverom-bad') && !hjem.andre.includes('#soverom') && !hjem.andre.includes('#bad') && !hjem.forste.includes('#gang-soverom-bad'), { andre: hjem.andre });
ok('Hjem · summert status (lys på i begge rom, primær temp, media, effekt)', hjem.data && hjem.data.lightsOn === 3 && hjem.data.lights === 4 && hjem.data.temp === 21.4 && hjem.data.mediaOn >= 1 && hjem.data.watt != null && hjem.data.hash === '#stue-kjokken' && hjem.data.floor === 'forste', hjem.data);

// ---------------------------------------------------------------- popup via hash
const pop = await E(async () => {
  const wait = window.__wait;
  location.hash = '#stue-kjokken'; await wait(1400);
  const pe = window.__all().find((e) => e.classList && e.classList.contains('bubble-pop-up') && e.classList.contains('is-popup-opened'));
  const card = pe && [...pe.querySelectorAll('*')].find((e) => e.localName === 'msh-rom-card');
  window.__rc = card;
  const R = card.shadowRoot, k = R.querySelector('msh-rom-klima-card');
  const out = { open: !!pe, cards: pe ? [...pe.querySelectorAll('*')].filter((e) => /^msh-.*-card$/.test(e.localName) && e.parentElement && !e.parentElement.closest('msh-rom-card')).length : 0 };
  const hero = k && k.shadowRoot.querySelector('.hero');
  out.heroFirst = !!hero && R.querySelector('ha-card').firstElementChild.classList.contains('msh-hero-slot');
  out.heroH = hero ? Math.round(hero.getBoundingClientRect().height) : 0;
  const rpk = k.shadowRoot.querySelector('.rpk');
  out.rpk = rpk ? rpk.querySelector('span').textContent.trim() : null;
  out.rpkOpts = rpk ? [...rpk.querySelectorAll('option')].map((o) => o.value) : [];
  out.big0 = k.shadowRoot.querySelector('.big').textContent;
  const sel = rpk.querySelector('select'); sel.value = 'kjokken'; sel.dispatchEvent(new Event('change')); await wait(300);
  out.bigK = k.shadowRoot.querySelector('.big').textContent; out.rpkK = k.shadowRoot.querySelector('.rpk span').textContent.trim();
  const sel2 = k.shadowRoot.querySelector('.rpk select'); sel2.value = 'avg'; sel2.dispatchEvent(new Event('change')); await wait(300);
  out.bigAvg = k.shadowRoot.querySelector('.big').textContent;
  const sel3 = k.shadowRoot.querySelector('.rpk select'); sel3.value = 'stue'; sel3.dispatchEvent(new Event('change')); await wait(200);
  out.secs = [...R.querySelectorAll('section[data-key^="sec-"]')].map((s) => s.dataset.key.slice(4));
  // åpne alle akkordeoner + gardin-listen
  for (const b of [...R.querySelectorAll('.acc')]) { if (!b.closest('section').querySelector('.bd,.cw')) { b.click(); await wait(120); } }
  const cvx = R.querySelector('.cvx'); if (cvx) { cvx.click(); await wait(150); }
  out.tags = [...new Set([...R.querySelectorAll('.rtag')].map((t) => t.textContent.trim()))];
  out.lights = [...R.querySelectorAll('.lr[data-lr]')].map((e) => e.dataset.lr);
  const tagOf = (sel) => { const el = R.querySelector(sel); return el && el.querySelector('.rtag') ? el.querySelector('.rtag').textContent.trim() : null; };
  out.tagSpot = (() => { const w = R.querySelector('[data-key="lw-light.kjokken_spot"]'); return w && w.querySelector('.rtag') ? w.querySelector('.rtag').textContent.trim() : null; })();
  out.tagTak = (() => { const w = R.querySelector('[data-key="lw-light.stue_tak"]'); return w && w.querySelector('.rtag') ? w.querySelector('.rtag').textContent.trim() : null; })();
  out.tagOpp = tagOf('[data-key="d-switch.oppvaskmaskin"]');
  out.tagPeis = tagOf('[data-key="d-switch.stue_peis"]');
  out.tagTv = (() => { const m = R.querySelector('[data-key="m-media_player.stue_tv"] .mn .rtag'); return m ? m.textContent.trim() : null; })();
  out.scenes = [...R.querySelectorAll('.sc')].map((e) => ({ t: e.querySelector('.scl').textContent.trim(), tag: (e.querySelector('.stg') || {}).textContent || '', on: e.classList.contains('on') || e.getAttribute('aria-pressed') === 'true' }));
  // «Alle lys»
  window.__calls.length = 0;
  const alls = R.querySelector('.alls');
  out.allsOn = alls && alls.getAttribute('aria-checked');
  out.allsBg = alls && (getComputedStyle(alls.querySelector('.asw')).backgroundImage + ' ' + getComputedStyle(alls.querySelector('.asw')).backgroundColor);
  alls.click(); await wait(100);
  const c = window.__calls.find((x) => x[0] === 'light');
  out.allCall = c ? [c[1], (c[2].entity_id || []).slice().sort()] : null;
  return out;
});
ok('popup · åpnes via #stue-kjokken, ett kort', pop.open && pop.cards === 1, pop);
ok('popup · klima-toppkort først (184 px)', pop.heroFirst && pop.heroH === 184, pop.heroH);
ok('popup · rom-velger-chip «Stue ▾» med rommene + Snitt', /^Stue/.test(pop.rpk) && JSON.stringify(pop.rpkOpts) === '["stue","kjokken","avg"]', [pop.rpk, pop.rpkOpts]);
ok('popup · toppkortet viser valgt rom (21,4 → Kjøkken 22,1 → snitt 21,8)', pop.big0 === '21,4' && pop.bigK === '22,1' && /^Kjøkken/.test(pop.rpkK) && pop.bigAvg === '21,8', [pop.big0, pop.bigK, pop.bigAvg]);
ok('popup · alle seksjoner i Rom v4-rekkefølge', JSON.stringify(pop.secs) === '["curtain","scenes","lys","dev","klima","media","sens"]', pop.secs);
ok('popup · lys fra begge rom', ['light.stue_tak', 'light.stue_lampe', 'light.stue_led', 'light.kjokken_spot'].every((x) => pop.lights.includes(x)), pop.lights);
ok('popup · romtagger riktige (Kjøkken/Stue per entitet)', pop.tagSpot === 'Kjøkken' && pop.tagTak === 'Stue' && pop.tagOpp === 'Kjøkken' && pop.tagPeis === 'Stue' && pop.tagTv === 'Stue' && pop.tags.includes('Stue') && pop.tags.includes('Kjøkken'), pop);
ok('popup · scener fra alle rommene, uten aktiv-tilstand, med romtagg', pop.scenes.length >= 3 && pop.scenes.every((s) => !s.on && ['Stue', 'Kjøkken'].includes(s.tag)) && pop.scenes.some((s) => s.tag === 'Kjøkken') && pop.scenes.some((s) => s.tag === 'Stue'), pop.scenes);
ok('popup · «Alle lys» (rosa bryter) slår av lysene i alle rommene', pop.allsOn === 'true' && /242, 133, 201|rgb\(242/.test(pop.allsBg) && pop.allCall && pop.allCall[0] === 'turn_off' && JSON.stringify(pop.allCall[1]) === JSON.stringify(['light.kjokken_spot', 'light.stue_lampe', 'light.stue_led', 'light.stue_tak']), [pop.allsBg, pop.allCall]);

// ---------------------------------------------------------------- touch: dra i popupen lukker den ikke
const cdp = await p.context().newCDPSession(p);
const box = await E(() => { const el = window.__rc.shadowRoot.querySelector('.cvs'); const r = el.getBoundingClientRect(); return { x: r.left + 20, y: r.top + r.height / 2, w: r.width }; });
const touch = async (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
await touch('touchStart', box.x, box.y);
for (let i = 1; i <= 8; i++) { await touch('touchMove', box.x + i * 12, box.y + i * 14); await p.waitForTimeout(16); }
await touch('touchEnd', 0, 0);
await p.waitForTimeout(500);
const scr = await E(() => { const k = window.__rc.shadowRoot.querySelector('msh-rom-klima-card'); const r = k.shadowRoot.querySelector('.scrub').getBoundingClientRect(); return { x: r.left + r.width * 0.8, y: r.top + r.height / 2 }; });
await touch('touchStart', scr.x, scr.y);
for (let i = 1; i <= 8; i++) { await touch('touchMove', scr.x - i * 15, scr.y + i * 10); await p.waitForTimeout(16); }
await touch('touchEnd', 0, 0);
await p.waitForTimeout(500);
const still = await E(() => ({ hash: location.hash, open: !!window.__all().find((e) => e.classList && e.classList.contains('bubble-pop-up') && e.classList.contains('is-popup-opened')), cover: (window.__calls.filter((x) => x[0] === 'cover').pop() || [])[1] || null }));
ok('touch · dra gardin-slider og graf-scrub lukker ikke popupen', still.open && still.hash === '#stue-kjokken', still);

// ---------------------------------------------------------------- GUI-editoren (msh-rom-card) speiles til ki-store, layout group
const grp = await E(async () => {
  const wait = window.__wait, M = window.MSH, R = window.__rc.shadowRoot;
  const k = R.querySelector('msh-rom-klima-card');
  k.shadowRoot.querySelector('.gear').click(); await wait(400);
  const portal = M.portals().pop(), ed = portal.shadowRoot.querySelector('msh-editor');
  const out = { title: (portal.shadowRoot.textContent.match(/Stue \+ Kjøkken/) || [])[0] || null };
  const sec = ed.shadowRoot.querySelector('.msh-cbx');
  out.hasField = !!sec;
  out.chips = sec ? [...sec.querySelectorAll('.msh-cbc')].map((b) => b.textContent.trim() + (b.classList.contains('on') ? '*' : '')) : [];
  const g = sec && sec.querySelector('[data-op="lay"][data-v="group"]');
  if (g) { g.click(); await wait(400); }
  out.store = JSON.stringify((M.store.get('cards.ki-home-faner.combined_rooms') || [])[0] || null);
  const cancel = ed.shadowRoot.querySelector('[data-a="cancel"]'); if (cancel) cancel.click(); await wait(400);
  M.portals().forEach((x) => x.remove());
  await wait(300);
  for (const b of [...R.querySelectorAll('.acc')]) { if (!b.closest('section').querySelector('.bd,.cw')) { b.click(); await wait(120); } }
  out.rgh = [...R.querySelectorAll('[data-key="sec-lys"] .rgh')].map((x) => x.textContent.trim());
  out.rghDev = [...R.querySelectorAll('[data-key="sec-dev"] .rgh')].map((x) => x.textContent.trim());
  out.lysTags = R.querySelectorAll('[data-key="sec-lys"] .rtag').length;
  out.carTags = R.querySelectorAll('.mn .rtag').length;
  return out;
});
ok('GUI-editor · «Kombinert rom» i rom-kortets editor (rom, primær, layout)', grp.hasField && grp.chips.includes('Stue*') && grp.chips.includes('Kjøkken*') && grp.chips.includes('Slå sammen*'), grp.chips);
ok('GUI-editor · «Grupper per rom» speiles til ki-store combined_rooms', /"layout":"group"/.test(grp.store), grp.store);
ok('popup · «Grupper per rom»: underoverskrift per rom, ingen tagg i listene', JSON.stringify(grp.rgh) === '["Stue","Kjøkken"]' && grp.rghDev.includes('Kjøkken') && grp.lysTags === 0 && grp.carTags > 0, grp);

// ---------------------------------------------------------------- 3-roms-popupen
const three = await E(async () => {
  const wait = window.__wait;
  history.replaceState(null, '', location.pathname); window.dispatchEvent(new Event('hashchange')); await wait(400);
  location.hash = '#gang-soverom-bad'; await wait(1400);
  const pe = window.__all().find((e) => e.classList && e.classList.contains('bubble-pop-up') && e.classList.contains('is-popup-opened'));
  const card = pe && [...pe.querySelectorAll('*')].find((e) => e.localName === 'msh-rom-card');
  const R = card.shadowRoot, k = R.querySelector('msh-rom-klima-card');
  for (const b of [...R.querySelectorAll('.acc')]) { if (!b.closest('section').querySelector('.bd,.cw')) { b.click(); await wait(120); } }
  return {
    open: !!pe, hero: !!(k && k.shadowRoot.querySelector('.hero')), rpk: (k.shadowRoot.querySelector('.rpk span') || k.shadowRoot.querySelector('.nm') || {}).textContent,
    secs: [...R.querySelectorAll('section[data-key^="sec-"]')].map((s) => s.dataset.key.slice(4)),
    tags: [...new Set([...R.querySelectorAll('.rtag,.stg')].map((t) => t.textContent.trim()))].sort(),
    lock: !!R.querySelector('[data-key="s-binary_sensor.inngangsdor"]'),
  };
});
ok('3 rom · popup via hash, toppkort, primærrommet i chipen', three.open && three.hero && /Soverom/.test(three.rpk), three);
ok('3 rom · seksjoner og romtagger fra alle tre rom', three.secs.includes('lys') && three.secs.includes('sens') && three.lock && ['Bad', 'Gang', 'Soverom'].every((x) => three.tags.includes(x)), three);

// ---------------------------------------------------------------- lys + mørk modus
const theme = await E(async () => {
  const wait = window.__wait, M = window.MSH, h = window.__h;
  const card = window.__all().find((e) => e.localName === 'msh-rom-card' && e.getBoundingClientRect().height > 0);
  const k = card.shadowRoot.querySelector('msh-rom-klima-card');
  const read = () => ({ hero: getComputedStyle(k.shadowRoot.querySelector('.hero')).backgroundColor, rpk: k.shadowRoot.querySelector('.rpk') ? getComputedStyle(k.shadowRoot.querySelector('.rpk')).color : null, tag: (() => { const t = card.shadowRoot.querySelector('.rtag'); return t ? getComputedStyle(t).color : null; })() });
  const dark = read();
  h.themes = { darkMode: false }; M.theme.update(h); window.__all().filter((e) => /^msh-/.test(e.localName) && e.update).forEach((e) => { e.hass = { ...h }; }); await wait(500);
  const light = { ...read(), mode: document.documentElement.dataset.kiTheme };
  h.themes = { darkMode: true }; M.theme.update(h); await wait(300);
  return { dark, light };
});
ok('tema · mørk: toppkort #3a3a3a', theme.dark.hero === 'rgb(58, 58, 58)', theme.dark);
ok('tema · lys: toppkort --ki-surface (hvit), mørk tekst i chip/tagg', theme.light.mode === 'light' && theme.light.hero === 'rgb(255, 255, 255)' && theme.light.tag && !/250, 250, 250/.test(theme.light.tag), theme.light);

// ---------------------------------------------------------------- Tilpass Hjem → Kort → «Kombiner rom»
const til = await E(async () => {
  const wait = window.__wait, M = window.MSH;
  history.replaceState(null, '', location.pathname); window.dispatchEvent(new Event('hashchange')); await wait(400);
  M.openHomeEditor({ focus: 'tab-forste' }); await wait(700);
  const ed = M.openHomeEditor(), R = ed.root;
  const q = (s) => R.querySelector(s), qa = (s) => [...R.querySelectorAll(s)];
  const out = {};
  // flytt kombinasjonen i kolonnen (lagrer layout.forste.order) – medlemmene beholder plassen
  ed._moveRoom(ed._model(), 'stue-kjokken', 'R', null); await wait(200);
  out.orderAfterMove = JSON.stringify(M.store.get('cards.ki-home-faner.layout.forste.order'));
  const acc = qa('.ac').find((b) => /Kombiner rom/.test(b.textContent));
  out.accMeta = acc ? acc.querySelector('.am').textContent : null;
  acc.click(); await wait(250);
  out.rows = qa('.cbr').map((r) => r.querySelector('b').textContent + ' | ' + r.querySelector('i').textContent);
  out.headH = Math.round(acc.getBoundingClientRect().height);
  // nytt kombinert rom
  q('[data-a="cbnew"]').click(); await wait(250);
  out.title = (q('.cbtl') || {}).textContent;
  const opt = (id) => q(`.cbo[data-v="${id}"]`);
  out.busy = opt('stue') ? [opt('stue').classList.contains('busy'), opt('stue').textContent.replace(/\s+/g, ' ').trim()] : null;
  opt('stue').click(); await wait(150);
  out.stueStillOff = !opt('stue').classList.contains('on');
  opt('hage').click(); await wait(120); opt('basseng').click(); await wait(150);
  out.prim = qa('[data-a="cbprim"]').map((b) => b.textContent + (b.classList.contains('on-pk') ? '*' : ''));
  out.placeholder = q('[data-in="cbname"]').getAttribute('placeholder');
  q('[data-a="cbicon"][data-v="mdi:flower"]') ? q('[data-a="cbicon"][data-v="mdi:flower"]').click() : q('[data-a="cbicon"]').click(); await wait(100);
  q('.cl[data-v="var(--green)"]').click(); await wait(100);
  q('[data-a="cbsave"]').click(); await wait(300);
  out.saved = (M.store.get('cards.ki-home-faner.combined_rooms') || []).map((x) => x.id + ':' + x.rooms.join(',') + ':' + x.color);
  out.rowsAfter = qa('.cbr').map((r) => r.dataset.id);
  // hold 400 ms + dra (touch): siste rad øverst
  qa('.cbr')[1].scrollIntoView({ block: 'center' }); await wait(150);
  const rows = qa('.cbr'), src = rows[2], dst = rows[0], sr = src.getBoundingClientRect(), dr = dst.getBoundingClientRect();
  const pe = (t, el, x, y) => el.dispatchEvent(new PointerEvent(t, { bubbles: true, composed: true, cancelable: true, pointerId: 7, pointerType: 'touch', clientX: x, clientY: y, isPrimary: true }));
  pe('pointerdown', src, sr.left + 40, sr.top + 20); await wait(250);
  out.notYet = !R.querySelector('.ghost');
  await wait(250);
  out.ghost = !!R.querySelector('.ghost');
  pe('pointermove', src, sr.left + 40, dr.top + dr.height * 0.25); await wait(60);
  pe('pointermove', src, sr.left + 40, dr.top + dr.height * 0.3); await wait(60);
  pe('pointerup', src, sr.left + 40, dr.top + dr.height * 0.3); await wait(350);
  out.order = (M.store.get('cards.ki-home-faner.combined_rooms') || []).map((x) => x.id);
  // del opp «Stue + Kjøkken» → stue og kjøkken tilbake på gammel plass (kjøkken før stue på 1. etg)
  qa('.cbr').find((r) => r.dataset.id === 'stue-kjokken').click(); await wait(250);
  out.editTitle = (q('.cbtl') || {}).textContent;
  out.btns = qa('.cbact button').map((b) => b.textContent.trim());
  q('[data-a="cbsplit"]').click(); await wait(400);
  out.afterSplit = (M.store.get('cards.ki-home-faner.combined_rooms') || []).map((x) => x.id);
  out.orderAfterSplit = JSON.stringify(M.store.get('cards.ki-home-faner.layout.forste.order'));
  const f = window.__all().find((e) => e.localName === 'msh-hjem-faner-card');
  const T = f._TV || [], i = T.findIndex((t) => t.id === 'forste'); f._pickTab(i); await wait(400);
  out.forste = [...f.shadowRoot.querySelectorAll('[data-act="rk-open"]')].map((e) => e.dataset.hash).filter((v, i, a) => a.indexOf(v) === i);
  // haptic på trykk
  out.done = !!q('[data-a="done"]');
  q('[data-a="done"]').click(); await wait(500);
  out.committed = JSON.stringify(((window.__userData.ki_dashboard || {}).cards || {})['ki-home-faner'].combined_rooms.map((x) => x.id));
  return out;
});
ok('Tilpass · akkordeon «Kombiner rom» (56 px) med listen «Stue · Kjøkken»', til.headH === 56 && til.rows.length === 2 && til.rows[0] === 'Stue + Kjøkken | Stue · Kjøkken' && /Gang · Soverom · Bad/.test(til.rows[1]), til);
ok('Tilpass · flytting av kombinasjonen beholder enkeltrommenes plass i rekkefølgen', /"kjokken".*"stue-kjokken"|"kjokken".*"stue"/.test(til.orderAfterMove) && JSON.parse(til.orderAfterMove).includes('stue') && JSON.parse(til.orderAfterMove).includes('kjokken'), til.orderAfterMove);
ok('Tilpass · «Nytt kombinert rom»: rom i annen kombinasjon grået «I <navn>»', til.title === 'Nytt kombinert rom' && til.busy && til.busy[0] && /I Stue \+ Kjøkken/.test(til.busy[1]) && til.stueStillOff, til.busy);
ok('Tilpass · navn-forslag, primærrom (+ «Snitt av alle»), lagring med var(--navn)', til.placeholder === 'Hage + Basseng' && til.prim.includes('Hage*') && til.prim.includes('Snitt av alle') && til.saved.length === 3 && /hage-basseng:hage,basseng:var\(--green\)/.test(til.saved[2]), [til.placeholder, til.prim, til.saved]);
ok('Tilpass · hold 400 ms + dra endrer rekkefølgen (touch)', til.notYet && til.ghost && til.order[0] === 'hage-basseng', [til.notYet, til.ghost, til.order]);
ok('Tilpass · rediger: Lagre / Del opp igjen / Slett kombinasjon', til.editTitle === 'Rediger kombinasjon' && til.btns.join('|') === 'Lagre|Del opp igjen|Slett kombinasjon', til.btns);
ok('Tilpass · «Del opp igjen» gjenoppretter plasseringen (Kjøkken før Stue på 1. etg)', !til.afterSplit.includes('stue-kjokken') && til.forste.indexOf('#kjokken') >= 0 && til.forste.indexOf('#kjokken') < til.forste.indexOf('#stue') && !til.forste.includes('#stue-kjokken'), [til.forste, til.orderAfterSplit]);
ok('Tilpass · Ferdig lagrer ÉN gang til ki-store (frontend/set_user_data)', til.committed === JSON.stringify(['hage-basseng', 'gang-soverom-bad']), til.committed);

// ---------------------------------------------------------------- oppløst: område slettet i HA
const dis = await E(async () => {
  const wait = window.__wait, M = window.MSH, h = window.__h;
  const before = M.combinedNorm(h, [{ name: 'Hage + Borte', rooms: ['hage', 'borte'] }]);
  M.store.set('cards.ki-home-faner.combined_rooms', [...(M.store.get('cards.ki-home-faner.combined_rooms') || []), { id: 'stue-x', name: 'Stue + Loft', rooms: ['stue', 'loft_slettet'] }]);
  await wait(200);
  M.openHomeEditor({ focus: 'kort' }); await wait(800);
  const ed = M.openHomeEditor(), R = ed.root;
  const note = [...R.querySelectorAll('.cbn')].map((x) => x.textContent.trim());
  const list = (M.store.get('cards.ki-home-faner.combined_rooms') || []).map((x) => x.id);
  ed.close(); await wait(300);
  return { before: { list: before.list.length, dis: before.dissolved.map((d) => d.missing.join(',')) }, note, list };
});
ok('oppløsning · < 2 rom igjen → oppløst med melding i Tilpass', dis.before.list === 0 && dis.before.dis[0] === 'borte' && dis.note.some((t) => /«Stue \+ Loft» er oppløst/.test(t)) && !dis.list.includes('stue-x'), dis);

// ---------------------------------------------------------------- strategien oppdaterer popupene live
const live = await E(async () => {
  const wait = window.__wait, M = window.MSH;
  const S = customElements.get('ll-strategy-dashboard-ki-dashboard');
  await S.generate({}, window.__h);
  const has = () => M.liveBubbles().map((x) => x.cfg.hash);
  const a = has().includes('#hage-basseng');
  return { a, hashes: has().filter((h) => /-/.test(h)) };
});
ok('strategi · ny kombinasjon fra Tilpass gir popup uten omlasting', live.a, live.hashes);

ok('ingen sidefeil', errs.length === 0, errs.slice(0, 5));
console.log(JSON.stringify(res, null, 1));
await b.close();
if (fail.length) { console.log('FEIL:', fail.join(' · ')); process.exit(1); }
console.log('Alle kombinert-rom-sjekker OK');
