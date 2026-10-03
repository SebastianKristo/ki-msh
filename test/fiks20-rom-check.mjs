// Fiks 20 · Rom: 20.12 (klima-pillens høyde på romkort M/L, per bruker × enhet), 20.14 (rød standard temperatur-graf),
// 20.15 (Rom → Enheter: av-utseende), 20.17 (Rom → Media: kompakt spillerkort, albumbildet inni kortet).
// Kjør: node test/fiks20-rom-check.mjs  (SHOTS=<mappe> for skjermbilder)
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { readdirSync, mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
mkdirSync('test/.build', { recursive: true });
const bundle = resolve(`test/.build/rom20-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const shots = process.env.SHOTS || '';
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto('file://' + resolve('test/harness.html'));
for (const m of readdirSync('test/mock').sort()) await p.addScriptTag({ path: resolve('test/mock/' + m) });
await p.addScriptTag({ path: bundle });
const out = await p.evaluate(async () => {
  const M = window.MSH, wait = (ms) => new Promise((q) => setTimeout(q, ms));
  const hass = window.mockHass();
  const add = (id, state, attributes, area) => { hass.states[id] = { entity_id: id, state, attributes: { friendly_name: id.split('.')[1], ...attributes }, last_changed: new Date().toISOString(), last_updated: new Date().toISOString(), context: {} }; hass.entities[id] = { entity_id: id, platform: 'demo', area_id: area || null, device_id: null }; };
  add('switch.stue_kaffe', 'off', { friendly_name: 'Kaffetrakter' }, 'stue');
  add('switch.stue_lampe2', 'on', { friendly_name: 'Lampe' }, 'stue');
  add('media_player.stue_radio', 'off', { friendly_name: 'Radio', supported_features: 16 | 32 | 1 | 4 }, 'stue');
  hass.states['media_player.stue_sonos'].attributes.entity_picture = 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
  const R0 = [], ok = (n, c, i) => R0.push(`${c ? '✔' : '✘'} ${n}${i != null ? ' · ' + JSON.stringify(i) : ''}`);
  const dash = document.getElementById('dash');
  M.lastHass = M.lastHass || hass;
  if (M.store && !M.store.loaded) await M.store.load(hass);
  const cs = (el) => getComputedStyle(el);
  const rgb = (h) => { const d = document.createElement('div'); d.style.color = h; document.body.appendChild(d); const v = cs(d).color; d.remove(); return v; };

  /* ---------- 20.14 · rød graf */
  const r = document.createElement('msh-rom-card');
  const cfg = { type: 'custom:msh-rom-card', card_id: 'r20', area: 'stue', look: { col: 'var(--green, #95e17a)' }, include: { enheter: ['switch.stue_kaffe', 'switch.stue_lampe2'], media: ['media_player.stue_radio'] } };
  r.setConfig(cfg); r.hass = hass; dash.appendChild(r);
  await wait(400);
  r.setUI({ acc: { media: true, dev: true } });
  await wait(500);
  const deepQ = (root, sel) => { let f = root.querySelector(sel); if (f) return f; for (const e of root.querySelectorAll('*')) if (e.shadowRoot) { f = deepQ(e.shadowRoot, sel); if (f) return f; } return null; };
  const line = deepQ(r.shadowRoot, '.graph svg polyline:nth-of-type(2)') || deepQ(r.shadowRoot, '.graph polyline[fill="none"]');
  const stroke = line && (line.getAttribute('stroke') || line.style.stroke || cs(line).stroke);
  ok('20.14 graf rød uten egen farge (romfarge ignoreres)', line && cs(line).stroke === rgb('#f28073'), stroke);
  const stub = customElements.get('msh-rom-klima-card').getStubConfig();
  ok('20.14 getStubConfig graph_t rød', /f28073/.test(stub.graph_t), stub.graph_t);
  r.setConfig({ ...cfg, graph_t: 'var(--blue, #73b9f2)' }); await wait(400);
  const line2 = deepQ(r.shadowRoot, '.graph svg polyline:nth-of-type(2)') || deepQ(r.shadowRoot, '.graph polyline[fill="none"]');
  ok('20.14 egen farge gjelder fortsatt', line2 && cs(line2).stroke === rgb('#73b9f2'), line2 && cs(line2).stroke);
  r.setConfig(cfg); await wait(400);

  /* ---------- 20.15 · enhet av */
  const R = r.shadowRoot;
  const kaffe = R.querySelector('[data-key="d-switch.stue_kaffe"]'), lampe = R.querySelector('[data-key="d-switch.stue_lampe2"]');
  if (kaffe) {
    const ic = kaffe.querySelector('.u-i'), ha = ic && ic.querySelector('ha-icon');
    ok('20.15 av: pille #2f2f2f', cs(kaffe).backgroundColor === rgb('#2f2f2f'), cs(kaffe).backgroundColor);
    ok('20.15 av: ikon-sirkel #3a3a3a', cs(ic).backgroundColor === rgb('#3a3a3a'), cs(ic).backgroundColor);
    ok('20.15 av: ikon #e1e1e1', cs(ic).color === rgb('#e1e1e1'), cs(ic).color);
    // 38: navnet (.u-n) står øverst i --ki-text, statusen (.u-l) under i --ki-text-mid (Rom v4 devices)
    ok('20.15/38 av: undertekst (status) #979797', cs(kaffe.querySelector('.u-l')).color === rgb('#979797'), cs(kaffe.querySelector('.u-l')).color);
    ok('20.15/38 av: tittel (navn) #fafafa', cs(kaffe.querySelector('.u-n')).color === rgb('#fafafa'), cs(kaffe.querySelector('.u-n')).color);
    ok('20.15 av: inset-kant', /inset/.test(cs(ic).boxShadow), cs(ic).boxShadow);
  } else ok('20.15 fant Kaffetrakter', false);
  ok('20.15 på: uendret (ikke #2f2f2f, ikke d-off)', lampe && !lampe.classList.contains('d-off') && cs(lampe).backgroundColor !== rgb('#2f2f2f'), lampe && cs(lampe).backgroundColor);

  /* ---------- 20.17 · media */
  const mts = [...R.querySelectorAll('.mt')];
  const chk = (mt, tag) => {
    const a = mt.querySelector('.art'), rb = mt.getBoundingClientRect(), ab = a.getBoundingClientRect(), ctl = mt.querySelector('.mctl').getBoundingClientRect(), mh = mt.querySelector('.mh');
    const pp = mt.querySelector('.mp').getBoundingClientRect(), mb = mt.querySelector('.mctl .mb').getBoundingClientRect();
    if (!mh || !a) { ok(tag + ' struktur', false, mt.outerHTML.slice(0, 400)); return {}; }
    ok(`20.17 ${tag}: kort ~140 px`, rb.height >= 120 && rb.height <= 160, Math.round(rb.height));
    ok(`20.17 ${tag}: bilde 54 px inni kortet 8 px fra hjørnet`, Math.round(ab.width) === 54 && Math.round(rb.right - ab.right) === 8 && Math.round(ab.top - rb.top) === 8, [ab.width, rb.right - ab.right, ab.top - rb.top]);
    ok(`20.17 ${tag}: bildet over kontrollraden`, ab.bottom <= ctl.top, [Math.round(ab.bottom), Math.round(ctl.top)]);
    ok(`20.17 ${tag}: tekst padding-right 62`, cs(mh).paddingRight === '62px', cs(mh).paddingRight);
    ok(`20.17 ${tag}: overflow hidden, radius 26, padding`, cs(mt).overflow === 'hidden' && cs(mt).borderRadius === '26px' && cs(mt).padding === '18px 16px 14px 20px', [cs(mt).overflow, cs(mt).borderRadius, cs(mt).padding]);
    ok(`20.17 ${tag}: play 56 / knapper 42`, Math.round(pp.width) === 56 && Math.round(mb.width) === 42, [pp.width, mb.width]);
    ok(`20.17 ${tag}: tittel 16/500, enhet 13`, cs(mt.querySelector('.ms')).fontSize === '16px' && cs(mt.querySelector('.ms')).fontWeight === '500' && cs(mt.querySelector('.mn')).fontSize === '13px');
    return { h: Math.round(rb.height) };
  };
  const pk = mts.find((x) => x.classList.contains('pk') && x.querySelector('.art img')) || mts.find((x) => x.classList.contains('pk')), offm = mts.find((x) => !x.classList.contains('pk'));
  if (pk) { chk(pk, 'spiller'); ok('20.17 spiller: img cover', !!pk.querySelector('.art img') && cs(pk.querySelector('.art img')).objectFit === 'cover', mts.map((x) => x.className + ' ' + x.querySelector('.mn').textContent)); ok('20.17 spiller: enhet rgba(42,23,32,.7)', cs(pk.querySelector('.mn')).color === 'rgba(42, 23, 32, 0.7)', cs(pk.querySelector('.mn')).color); }
  else ok('20.17 fant spillende kort', false);
  ok('20.17 fant av-kort', !!offm, mts.length);
  if (offm) {
    // av-kortet ligger i karusellen – vis det for måling
    const car = offm.closest('.car'); if (car) car.scrollLeft = offm.closest('.mc').offsetLeft;
    await wait(100);
    chk(offm, 'av'); ok('20.17 av: #2a2a2a', cs(offm).backgroundColor === rgb('#2a2a2a'), cs(offm).backgroundColor);
    ok('20.17 av: album-ikon uten bilde', !!offm.querySelector('.art ha-icon'));
  }

  /* ---------- 20.12 · klima-pillen */
  const mk = (variant) => { const c = document.createElement('msh-romkort-card'); c.setConfig({ type: 'custom:msh-romkort-card', card_id: 'rk20' + variant, area: 'stue', variant }); c.hass = hass; dash.appendChild(c); return c; };
  const cM = mk('M'), cL = mk('L'), cK = mk('karusell');
  await wait(400);
  const pill = (c) => { const k = c.shadowRoot.querySelector('.rk-kv'), rk = c.shadowRoot.querySelector('.rk'); if (!k) return null; const a = k.getBoundingClientRect(), bb = rk.getBoundingClientRect(); return { top: Math.round(a.top - bb.top), h: Math.round(a.height), bot: Math.round(bb.bottom - a.bottom) }; };
  const p0 = { M: pill(cM), L: pill(cL), K: pill(cK) };
  ok('20.12 Fyll = som før (top 76, bunn 10)', p0.M && p0.M.top === 76 && p0.M.bot === 10 && p0.L.top === 76, p0);
  M.rkPillSet('M', 96); await wait(350);
  const p1 = { M: pill(cM), L: pill(cL), K: pill(cK) };
  ok('20.12 M Lav: kortere, samme bunn', p1.M.h === 96 && p1.M.bot === 10, p1.M);
  ok('20.12 L/karusell uendret av M', p1.L.top === 76 && p1.K.top === 76, [p1.L, p1.K]);
  M.rkPillSet('L', 120); await wait(350);
  const p2 = { M: pill(cM), L: pill(cL), K: pill(cK) };
  ok('20.12 L 120: stor og karusell', p2.L.h === 120 && p2.K.h === 120 && p2.L.bot === 10, [p2.L, p2.K]);
  const key = M.profileKey(M.userId(), M.deviceClass());
  ok('20.12 lagret per bruker × enhet', JSON.stringify((M.store.get('room_card_profiles') || {})[key]) === JSON.stringify({ klima_pill_height: { M: 96, L: 120 } }), M.store.get('room_card_profiles'));
  M.rkPillSet('M', null); M.rkPillSet('L', null); await wait(350);
  const p3 = { M: pill(cM), L: pill(cL) };
  ok('20.12 Fyll tilbake = som før', p3.M.top === 76 && p3.L.top === 76, p3);
  // YAML-fallback (kortets egen config)
  cM.setConfig({ type: 'custom:msh-romkort-card', card_id: 'rk20M', area: 'stue', variant: 'M', room_card: { klima_pill_height: { M: 100 } } }); await wait(350);
  ok('20.12 YAML room_card.klima_pill_height.M', pill(cM).h === 100, pill(cM));
  // Tilpass Hjem → Kort → «Klima-knapp på romkort»
  const F = document.createElement('msh-hjem-faner-card'); F.setConfig({ type: 'custom:msh-hjem-faner-card', card_id: 'f20' }); F.hass = hass; dash.appendChild(F);
  await wait(500);
  const h = M.openHomeEditor(); await wait(500);
  h.u.acc = { ...h.u.acc, rkpill: true }; h.render(); await wait(200);
  const HR = h.root;
  const acc = HR.querySelector('[data-key="ac-rkpill"]');
  ok('20.12 editor: akkordeon finnes', !!acc, acc && acc.textContent.replace(/\s+/g, ' ').trim());
  const rngM = HR.querySelector('input[data-in="rkpill"][data-k="M"]'), rngL = HR.querySelector('input[data-in="rkpill"][data-k="L"]');
  ok('20.12 editor: slidere M (96–124) og L (96–160), steg 2, pan-y', rngM && rngL && rngM.min === '96' && rngM.max === '124' && rngL.max === '160' && rngM.step === '2' && cs(rngM).touchAction === 'pan-y');
  ok('20.12 editor: hurtigvalg Lav · Middels · Fyll', [...HR.querySelectorAll('[data-a="rkpill"][data-k="M"]')].map((x) => x.textContent.trim()).join(' · ') === 'Lav · Middels · Fyll');
  HR.querySelector('[data-a="rkpill"][data-k="M"][data-v="lav"]').click(); await wait(350);
  ok('20.12 editor: Lav → M 96', M.rkPillProfile().M === 96 && pill(cM).h === 96, M.rkPillProfile());
  const r2 = HR.querySelector('input[data-in="rkpill"][data-k="L"]'); r2.value = '140'; r2.dispatchEvent(new Event('input', { bubbles: true })); r2.dispatchEvent(new Event('change', { bubbles: true })); await wait(350);
  ok('20.12 editor: slider L 140', M.rkPillProfile().L === 140 && pill(cL).h === 140, M.rkPillProfile());
  let stopped = true; const pd = new PointerEvent('pointerdown', { bubbles: true, composed: true }); HR.addEventListener('pointerdown', () => { stopped = false; }, { once: true }); HR.querySelector('input[data-in="rkpill"][data-k="L"]').dispatchEvent(pd);
  ok('20.12 editor: slider stopper pointerdown', stopped);
  if (window.__shot) await window.__shot();
  HR.querySelector('[data-a="rkpill"][data-k="M"][data-v="fyll"]').click(); HR.querySelector('[data-a="rkpill"][data-k="L"][data-v="fyll"]').click(); await wait(300);
  ok('20.12 editor: Fyll → null', M.rkPillProfile().M == null && M.rkPillProfile().L == null);
  // GUI-editor (romkort-card): number-felt
  const sch = customElements.get('msh-romkort-card').schema(hass, {});
  const names = JSON.stringify(sch);
  ok('20.12 GUI-editor: number-felt M/L', /room_card\.klima_pill_height\.M/.test(names) && /room_card\.klima_pill_height\.L/.test(names));
  h.close && h.close();
  return R0;
});
if (shots) await p.locator('msh-rom-card').screenshot({ path: shots + '/rom20-card.png' });
console.log(out.join('\n'));
console.log('pageerrors', errs);
await b.close();
if (out.some((x) => x.startsWith('✘')) || errs.length) process.exitCode = 1;
