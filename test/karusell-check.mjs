// Fiks 17.12/17.17/17.30/18.3: felles karusell-prikker (trykk → side, 10/12 px prikker med 8 px gap og treffflate via ::before, aria, ingen re-render under
// sveip), Vær-toppkortet åpner alltid på side 1 (også etter rotasjon og gjentatte åpninger), og «Bakgrunnsanimasjon».
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { readdirSync, mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
mkdirSync('test/.build', { recursive: true });
const bundle = resolve(`test/.build/karusell-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto('file://' + resolve('test/harness.html'));
for (const m of readdirSync('test/mock').sort()) await p.addScriptTag({ path: resolve('test/mock/' + m) });
await p.addScriptTag({ path: bundle });
const run = async () => p.evaluate(async () => {
  const wait = (ms) => new Promise((q) => setTimeout(q, ms));
  const hass = window.mockHass();
  const res = {};
  const pop = (hash, el) => {
    const bc = document.createElement('bubble-card');
    bc.setConfig({ type: 'custom:bubble-card', card_type: 'pop-up', hash });
    bc.innerHTML = '<div class="pop"><div class="hdr">x</div><div class="inner"></div></div>';
    document.getElementById('dash').appendChild(bc);
    bc.querySelector('.inner').appendChild(el);
    return bc;
  };
  // 18.3: layout = prikken (10 px, aktiv 12 px, gap 8 px); treffflaten (::before) nås 12 px over midten og 3 px utenfor kanten
  const geo = (root, ds) => {
    const R = ds.map((d) => d.getBoundingClientRect());
    const at = (x, y) => root.elementFromPoint(x, y);
    const k = ds.findIndex((d) => !d.classList.contains('on'));
    const r = R[k], cy = r.top + r.height / 2, cx = r.left + r.width / 2;
    return {
      sizes: R.map((q) => `${Math.round(q.width)}x${Math.round(q.height)}`).join(' '),
      gaps: R.slice(1).map((q, j) => Math.round(q.left - R[j].right)).join(' '),
      rowH: Math.round(ds[0].parentElement.getBoundingClientRect().height),
      hitUp: at(cx, cy - 12) === ds[k], hitDown: at(cx, cy + 12) === ds[k],
      hitRight: at(r.right + 3, cy) === ds[k], hitNext: ds[k + 1] ? at(r.right + 5, cy) === ds[k + 1] : at(r.left - 5, cy) === ds[k - 1], hitLeft: k > 0 ? at(r.left - 3, cy) === ds[k] : true,
    };
  };
  const renders = (el) => { let n = 0; const o = el.render.bind(el); el.render = () => { n++; return o(); }; return () => n; }; // teller faktiske tegninger
  // ---------- Vær (17.30)
  const v = document.createElement('msh-vaer-card');
  v.setConfig({ type: 'custom:msh-vaer-card', card_id: 'vaer1' }); v.hass = hass;
  pop('#vaer', v);
  location.hash = '#vaer'; await wait(700);
  const H = () => v._heroEl, car = () => H().shadowRoot.querySelector('.car'), dots = () => [...H().shadowRoot.querySelectorAll('.msh-dot')];
  const on = () => dots().findIndex((d) => d.classList.contains('on'));
  const page = () => Math.round(car().scrollLeft / car().clientWidth);
  res.vDots = dots().length;
  res.geo = geo(H().shadowRoot, dots());
  res.aria = dots().map((d) => d.getAttribute('aria-label') + (d.getAttribute('aria-current') ? '*' : '')).join(' | ');
  // trykk på prikk 3 → side 3, klikket bobler ikke til kortet
  let bubbled = 0; v.addEventListener('click', () => bubbled++);
  const cnt = renders(H());
  dots()[2].click(); await wait(900);
  res.tap = { page: page(), on: on(), bubbled, renders: cnt() };
  // sveip (scroll) til side 2 → prikken følger, ingen tegning under scroll
  const c0 = cnt();
  for (let x = page() * car().clientWidth; x >= car().clientWidth; x -= 20) { car().scrollLeft = x; await new Promise(requestAnimationFrame); }
  car().scrollLeft = car().clientWidth; await wait(300);
  res.swipe = { page: page(), on: on(), renders: cnt() - c0 };
  // trykk på aktiv prikk gjør ingenting; tastatur ←
  dots()[1].click(); await wait(200); res.activeNoop = page();
  const row = H().shadowRoot.querySelector('.msh-dots'); row.focus();
  row.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })); await wait(900);
  res.key = { page: page(), on: on() };
  // gjentatte åpninger: la den stå på side 2, lukk, åpne → side 1
  const opens = [];
  for (let k = 0; k < 5; k++) {
    car().scrollLeft = car().clientWidth * 2; await wait(200);
    location.hash = ''; await wait(150); location.hash = '#vaer'; await wait(600);
    opens.push(`${page()}/${on()}`);
  }
  res.opens = opens.join(' ');
  // rotasjon: stå på side 2 → endre bredde → fortsatt side 2
  car().scrollLeft = car().clientWidth; await wait(250);
  document.documentElement.style.setProperty('--popw', '300px');
  await wait(400);
  res.rotate = { page: page(), on: on(), exact: car().scrollLeft === car().clientWidth };
  document.documentElement.style.removeProperty('--popw');
  await wait(300);
  // 17.30 B: bakgrunnsanimasjon
  res.fxOn = H().shadowRoot.querySelectorAll('.fx span').length;
  v.setConfig({ ...v._rawConfig, hero_fx: false }); await wait(300);
  res.fxOff = H().shadowRoot.querySelectorAll('.fx span').length;
  v.setConfig({ ...v._rawConfig, hero_fx: true }); await wait(300);
  // «Tilpass været»: bryteren øverst
  v.customize(); await wait(300);
  const sheet = window.MSH.portals().pop();
  const sr = sheet.shadowRoot || sheet;
  const t = sr.querySelector('[data-a="fx"]');
  res.sheetRow = t ? t.closest('.r').textContent.trim().replace(/\s+/g, ' ') : null;
  res.sheetFirst = t ? [...sr.querySelector('.vaer-sheet').children].indexOf(t.closest('.r')) : -1;
  t.click(); await wait(300);
  res.sheetOff = { aria: sr.querySelector('[data-a="fx"]').getAttribute('aria-checked'), fx: H().shadowRoot.querySelectorAll('.fx span').length };
  sr.querySelector('[data-a="cancel"]').click(); await wait(300);
  // GUI-editor har feltet
  const ed = v.constructor.getConfigElement(); ed.hass = hass; ed.setConfig(v._rawConfig); document.body.appendChild(ed); await wait(100);
  res.guiField = /Bakgrunnsanimasjon/.test(ed.shadowRoot.innerHTML);
  ed.remove();
  // ---------- Hjem-karusell (17.12/17.17)
  const hj = document.createElement('msh-hjem-faner-card');
  hj.setConfig({ type: 'custom:msh-hjem-faner-card', card_id: 'hf' }); hj.hass = hass;
  document.getElementById('dash').appendChild(hj);
  location.hash = ''; await wait(600);
  const vp = hj.shadowRoot.querySelector('.car[data-sw]');
  if (vp) {
    const hc = renders(hj);
    const hd = () => [...vp.nextElementSibling.querySelectorAll('.msh-dot')];
    res.hjemGeo = geo(hj.shadowRoot, hd());
    hd()[1].click(); await wait(100);
    res.hjemTap = { i: vp.dataset.i, tr: vp.firstElementChild.style.transform, on: hd().findIndex((d) => d.classList.contains('on')), renders: hc() };
    // hass-oppdatering under snap-animasjonen tegnes først etterpå
    hj._schedule(); await wait(100); // som en hass-oppdatering
    res.hjemDuringSnap = hc();
    await wait(600);
    res.hjemAfterSnap = hc();
    res.hjemKept = { i: vp.dataset.i, on: hd().findIndex((d) => d.classList.contains('on')) };
    // sveip med peker (drag) tilbake til side 1: ingen tegning ved slipp
    const box = vp.getBoundingClientRect(), y = box.top + 40, c1 = hc();
    const ev = (t, x) => vp.dispatchEvent(new PointerEvent(t, { clientX: x, clientY: y, pointerId: 7, bubbles: true, isPrimary: true, pointerType: 'touch' }));
    ev('pointerdown', box.left + 40); for (let x = 40; x < 260; x += 20) ev('pointermove', box.left + x); ev('pointerup', box.left + 260);
    await wait(50);
    res.hjemSwipe = { i: vp.dataset.i, on: hd().findIndex((d) => d.classList.contains('on')), rendersAtRelease: hc() - c1 };
  } else res.hjemTap = 'ingen karusell';
  // ---------- Fiks 20.19: posisjonen lagres ikke – ny instans (reload) starter på første kort fra første tegning
  {
    const saved = localStorage.getItem('ki:hf:ui') || '';
    res.noSwStored = !/"sw"/.test(saved);
    localStorage.setItem('ki:hf:ui', JSON.stringify({ tab: 'hjem', sw: { 'hjem-car-L': 2, 'hjem-car-R': 1, 'hjem-L-top': 1 } })); // gammelt lagret oppsett
    hj.remove();
    const h2 = document.createElement('msh-hjem-faner-card');
    h2.setConfig({ type: 'custom:msh-hjem-faner-card', card_id: 'hf' }); h2.hass = hass;
    document.getElementById('dash').appendChild(h2);
    await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame);
    const first = [...h2.shadowRoot.querySelectorAll('[data-sw]')].map((v) => `${v.dataset.sw}:${v.dataset.i}:${v.firstElementChild.style.transform}:${(v.nextElementSibling && v.nextElementSibling.classList.contains('msh-dots')) ? [...v.nextElementSibling.children].findIndex((d) => d.classList.contains('on')) : '-'}`);
    res.reloadFirst = first;
    // bytte fane og tilbake → første kort
    const vp0 = h2.shadowRoot.querySelector('.car[data-sw]'), dts = vp0.nextElementSibling;
    dts.querySelectorAll('.msh-dot')[1].click(); await wait(600);
    const TV = h2._TV || [], other = TV.findIndex((t) => t.id !== 'hjem');
    if (other >= 0) { h2._pickTab(other); await wait(200); h2._pickTab(TV.findIndex((t) => t.id === 'hjem')); await wait(300); }
    res.tabBack = h2.shadowRoot.querySelector('.car[data-sw]').dataset.i;
    // retur fra bakgrunn (visibilitychange) → første kort, uten animasjon
    h2.shadowRoot.querySelector('.car[data-sw]').nextElementSibling.querySelectorAll('.msh-dot')[1].click(); await wait(600);
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.dispatchEvent(new Event('visibilitychange'));
    await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame);
    const tr = h2.shadowRoot.querySelector('.car[data-sw] .track');
    res.resume = { i: h2.shadowRoot.querySelector('.car[data-sw]').dataset.i, noAnim: getComputedStyle(tr).transitionDuration.split(',').every((x) => parseFloat(x) === 0) };
    delete document.visibilityState;
    h2.remove();
  }
  // ---------- Fiks 20.4: MSH.condEval (HA-conditions)
  {
    const M = window.MSH, subs = [];
    const H = { ...hass, states: { ...hass.states }, connection: { subscribeMessage: (cb, m) => { if (m.type === 'render_template') { subs.push({ cb, m }); setTimeout(() => cb({ result: /Fotball/.test(m.template) }), 5); return Promise.resolve(() => {}); } return hass.connection.subscribeMessage(cb, m); } } };
    const st = (id, state, a) => { H.states[id] = { entity_id: id, state, attributes: a || {}, last_changed: new Date().toISOString() }; };
    st('calendar.familie', 'on', { message: 'Fotball' }); st('sensor.pris', '1.8'); st('person.a', 'home', {}); st('zone.home', '0', { friendly_name: 'Hjem', latitude: 59.9, longitude: 10.7, radius: 100 });
    const E = (c) => M.condEval(H, M.condParse(c).value);
    const now = new Date(), hh = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    let changed = 0;
    M.condEval(H, { condition: 'template', value_template: "{{ state_attr('calendar.familie','message') == 'Fotball' }}" }, { onChange: () => changed++ });
    await wait(50);
    res.cond = {
      state: E('condition: state\nentity_id: calendar.familie\nstate: "on"'),
      stateList: E({ condition: 'state', entity_id: 'calendar.familie', state: ['off', 'on'] }),
      attr: E({ condition: 'state', entity_id: 'calendar.familie', attribute: 'message', state: 'Fotball' }),
      numAbove: E({ condition: 'numeric_state', entity_id: 'sensor.pris', above: 1.5 }),
      numBelow: E({ condition: 'numeric_state', entity_id: 'sensor.pris', above: 1.5, below: 1.7 }),
      time: E({ condition: 'time', after: hh(new Date(now - 3600000)), before: hh(new Date(+now + 3600000)) }),
      timeNo: E({ condition: 'time', after: hh(new Date(+now + 3600000)), before: hh(new Date(+now + 7200000)) }),
      zone: E({ condition: 'zone', entity_id: 'person.a', zone: 'zone.home' }),
      and: E({ condition: 'and', conditions: [{ condition: 'state', entity_id: 'calendar.familie', state: 'on' }, { condition: 'numeric_state', entity_id: 'sensor.pris', below: 1 }] }),
      or: E('condition: or\nconditions:\n  - condition: state\n    entity_id: calendar.familie\n    state: "off"\n  - condition: numeric_state\n    entity_id: sensor.pris\n    above: 1'),
      not: E({ condition: 'not', conditions: [{ condition: 'state', entity_id: 'calendar.familie', state: 'off' }] }),
      tpl: E({ condition: 'template', value_template: "{{ state_attr('calendar.familie','message') == 'Fotball' }}" }),
      tplSubs: subs.length, tplChanged: changed,
      bad: M.condParse('condition: [').error || null,
    };
  }
  // ---------- Fiks 20.4: «Vis først når …» på Hjem-karusellen + «Vis prikker» av
  {
    const H = { ...hass, states: { ...hass.states } };
    const setCal = (on) => { H.states = { ...H.states, 'calendar.familie': { ...hass.states['calendar.familie'], state: on ? 'on' : 'off', last_changed: new Date().toISOString() } }; h3.hass = { ...H }; };
    const h3 = document.createElement('msh-hjem-faner-card');
    const cfg = { type: 'custom:msh-hjem-faner-card', card_id: 'hf3', slides: { hjem: { L: { cal: true }, R: { vaer: true } } }, carousel: { hjem: { L: { first: [{ slide: 'cal', condition: [{ condition: 'state', entity_id: 'calendar.familie', state: 'on' }] }] }, R: { dots: false } } } };
    H.states['calendar.familie'] = { ...hass.states['calendar.familie'], state: 'on' };
    h3.setConfig(cfg); h3.hass = H;
    document.getElementById('dash').appendChild(h3);
    await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame);
    const L = () => h3.shadowRoot.querySelector('.car[data-sw="hjem-car-L"]'), R = () => h3.shadowRoot.querySelector('.car[data-sw="hjem-car-R"]');
    const calIdx = () => [...L().firstElementChild.children].findIndex((s) => s.querySelector('[data-s="cal"]'));
    const on = (vp) => [...vp.nextElementSibling.querySelectorAll('.msh-dot')].findIndex((d) => d.classList.contains('on'));
    res.rule = { calIdx: calIdx(), first: L().dataset.i, dotOn: on(L()) };
    setCal(false); await wait(300);
    res.rule.off = L().dataset.i;
    setCal(true); await wait(300);
    res.rule.onAgain = L().dataset.i;
    // manuell sveip (prikk 0) → regelen overstyrer ikke de neste 60 s
    L().nextElementSibling.querySelectorAll('.msh-dot')[0].click(); await wait(600);
    setCal(false); await wait(200); setCal(true); await wait(300);
    res.rule.manual = L().dataset.i;
    res.dotsR = R() ? { next: !!(R().nextElementSibling && R().nextElementSibling.classList.contains('msh-dots')), n: R().dataset.n } : null;
    res.dotsL = !!L().nextElementSibling;
    h3.remove();
    // ugyldig YAML (streng) → regelen hoppes over, ingen feil
    const h4 = document.createElement('msh-hjem-faner-card');
    h4.setConfig({ ...cfg, card_id: 'hf4', carousel: { hjem: { L: { first: [{ slide: 'cal', condition: 'condition: [' }, { slide: 'cal', condition: 'condition: state\nentity_id: calendar.familie\nstate: "on"' }] } } } }); h4.hass = H;
    document.getElementById('dash').appendChild(h4); await wait(200);
    res.rule.yamlStr = h4.shadowRoot.querySelector('.car[data-sw="hjem-car-L"]').dataset.i;
    // GUI-schema har feltene
    const sch = JSON.stringify(customElements.get('msh-hjem-faner-card').schema(hass, cfg), (k, v) => (typeof v === 'function' ? 'fn' : v));
    res.gui = { dots: /carousel\.hjem\.L\.dots/.test(sch), rule: /carousel\.hjem\.L\.first\.0\.slide/.test(sch), add: /legg til regel/.test(sch) };
    // «Tilpass Hjem» → Kort → Swipe-kort
    const M = window.MSH, ed = M.openHomeEditor(); await wait(500);
    ed.u.acc = { ...ed.u.acc, swipe: true }; ed.render(); await wait(200);
    const ER = ed.root, q = (s2) => ER.querySelector(s2);
    res.ed = { dotsTgl: !!q('[data-a="cardots"][data-s="L"]'), add: !!q('[data-a="cradd"][data-s="L"]') };
    q('[data-a="cradd"][data-s="R"]').click(); await wait(300);
    res.ed.rows = ER.querySelectorAll('[data-key="crl-R"] [data-key^="crr-"]').length;
    const preR = ER.querySelector('[data-a="crpre"][data-s="R"][data-v="cal"]'); res.ed.presets = [...ER.querySelectorAll('[data-a="crpre"][data-s="R"][data-i="0"]')].map((b) => b.textContent.trim()).join(' · ');
    preR.click(); await wait(300);
    const ta = () => ER.querySelector('textarea[data-in="crcond"][data-s="R"][data-i="0"]');
    res.ed.yaml = ta() && ta().value;
    res.ed.mono = ta() && /mono/i.test(getComputedStyle(ta()).fontFamily);
    res.ed.badge = (ER.querySelector('[data-key="crl-R"] .crb') || {}).textContent;
    const x = ta(); x.value = 'condition: ['; x.dispatchEvent(new Event('change', { bubbles: true })); await wait(300);
    res.ed.err = !!ER.querySelector('[data-key="crl-R"] .cre');
    const x2 = ta(); x2.value = 'condition: time\nafter: "00:00"'; x2.dispatchEvent(new Event('change', { bubbles: true })); await wait(300);
    res.ed.errGone = !ER.querySelector('[data-key="crl-R"] .cre');
    q('[data-a="cardots"][data-s="L"]').click(); await wait(300);
    const eff = (M.liveOf ? M.liveOf('msh-hjem-faner-card') : null);
    res.ed.cfg = JSON.stringify((eff && eff.config && eff.config.carousel) || ed.F().carousel || null);
    ed.root.querySelector('[data-a="cancel"]') && ed.root.querySelector('[data-a="cancel"]').click(); await wait(300);
    h4.remove();
  }
  return res;
});
const out = await run();
console.log(JSON.stringify(out, null, 1));
const fail = [];
const ok = (c, m) => { if (!c) fail.push(m); };
const geoOk = (g, m) => {
  ok(g && /^(10x10|12x12)( (10x10|12x12))+$/.test(g.sizes) && (g.sizes.match(/12x12/g) || []).length === 1, m + ': prikker 10 px, aktiv 12 px');
  ok(g && g.gaps.split(' ').every((x) => x === '8'), m + ': 8 px mellom prikkene');
  ok(g && g.rowH === 14, m + ': raden er 14 px høy');
  ok(g && g.hitUp && g.hitDown && g.hitRight && g.hitLeft && g.hitNext, m + ': treffflate via ::before (12 px over/under, 3 px ved siden)');
};
geoOk(out.geo, 'Vær');
ok(/Side 1 av 3\*/.test(out.aria), 'Vær: aria-label/aria-current');
ok(out.tap.page === 2 && out.tap.on === 2 && out.tap.bubbled === 0, 'Vær: trykk på prikk 3');
ok(out.swipe.page === 1 && out.swipe.on === 1 && out.swipe.renders === 0, 'Vær: sveip uten re-render');
ok(out.activeNoop === 1, 'Vær: aktiv prikk gjør ingenting');
ok(out.key.page === 0 && out.key.on === 0, 'Vær: tastatur ←');
ok(out.opens === '0/0 0/0 0/0 0/0 0/0', 'Vær: åpner på side 1 hver gang');
ok(out.rotate.page === 1 && out.rotate.on === 1 && out.rotate.exact, 'Vær: rotasjon holder siden');
ok(out.fxOn > 0 && out.fxOff === 0, 'Vær: hero_fx av fjerner animasjonen');
ok(out.sheetFirst === 1 && out.sheetOff.aria === 'false' && out.sheetOff.fx === 0, 'Tilpass været: bryter øverst virker');
ok(out.guiField, 'GUI-editor: Bakgrunnsanimasjon');
if (typeof out.hjemTap === 'object') {
  ok(out.hjemTap.i === '1' && out.hjemTap.on === 1 && out.hjemTap.renders === 0, 'Hjem: trykk på prikk uten re-render');
  geoOk(out.hjemGeo, 'Hjem');
  ok(out.hjemDuringSnap === 0 && out.hjemAfterSnap >= 1, 'Hjem: hass venter til snap er ferdig');
  ok(out.hjemKept.i === '1' && out.hjemKept.on === 1, 'Hjem: siden beholdes etter tegning');
  ok(out.hjemSwipe.i === '0' && out.hjemSwipe.on === 0 && out.hjemSwipe.rendersAtRelease === 0, 'Hjem: sveip uten re-render ved slipp');
}
// Fiks 20.19
ok(out.noSwStored, '20.19: karusell-posisjonen (sw) lagres ikke i localStorage');
ok(out.reloadFirst.length && out.reloadFirst.every((x) => /:0:translateX\(-?0%\):(0|-)$/.test(x)), '20.19: ny instans starter på første kort (også med gammelt lagret sw), prikkene stemmer: ' + out.reloadFirst.join(' '));
ok(out.tabBack === '0', '20.19: tilbake til Hjem-fanen → første kort');
ok(out.resume.i === '0' && out.resume.noAnim, '20.19: retur fra bakgrunn → første kort uten animasjon');
// Fiks 20.4
const cd = out.cond;
ok(cd.state === true && cd.stateList === true && cd.attr === true, '20.4 condEval: state (YAML, liste, attribute)');
ok(cd.numAbove === true && cd.numBelow === false, '20.4 condEval: numeric_state');
ok(cd.time === true && cd.timeNo === false, '20.4 condEval: time');
ok(cd.zone === true, '20.4 condEval: zone');
ok(cd.and === false && cd.or === true && cd.not === true, '20.4 condEval: and/or/not');
ok(cd.tpl === true && cd.tplSubs === 1 && cd.tplChanged >= 1, '20.4 condEval: template via render_template-abonnement (ett abonnement, onChange)');
ok(!!cd.bad, '20.4 condParse: ugyldig YAML gir feil');
ok(out.rule.calIdx > 0 && out.rule.first === String(out.rule.calIdx) && out.rule.dotOn === out.rule.calIdx, '20.4: regel slår til → starter på Kalender (prikk stemmer)');
ok(out.rule.off === '0' && out.rule.onAgain === String(out.rule.calIdx), '20.4: resultatet endres → karusellen følger');
ok(out.rule.manual === '0', '20.4: manuell sveip overstyres ikke');
ok(out.dotsR && !out.dotsR.next && Number(out.dotsR.n) > 1 && out.dotsL, '20.4: «Vis prikker» av fjerner prikkene (bare den karusellen)');
ok(out.rule.yamlStr === String(out.rule.calIdx), '20.4: ugyldig YAML-regel hoppes over, neste regel brukes');
ok(out.gui.dots && out.gui.rule && out.gui.add, '20.4: GUI-editoren har Vis prikker + regler');
ok(out.ed.dotsTgl && out.ed.add && out.ed.rows === 1, '20.4 Tilpass Hjem: bryter, + Legg til regel, regel-rad');
ok(/Kalender-event pågår · Søppel i dag · Strømpris > 1,5 kr · Morgen 06–09 · Mal/.test(out.ed.presets), '20.4 Tilpass Hjem: hurtigvalg');
ok(/condition: state/.test(out.ed.yaml) && /calendar\.\w+/.test(out.ed.yaml) && out.ed.mono, '20.4 Tilpass Hjem: hurtigvalg fyller YAML (monospace)');
ok(/Slår til nå|Nei nå/.test(out.ed.badge || ''), '20.4 Tilpass Hjem: live-merke');
ok(out.ed.err && out.ed.errGone, '20.4 Tilpass Hjem: ugyldig YAML → rød feilmelding');
ok(/"dots":false/.test(out.ed.cfg) && /"condition":"time"/.test(out.ed.cfg), '20.4 Tilpass Hjem: lagres som objekt i config: ' + out.ed.cfg);
ok(!errs.length, 'sidefeil: ' + errs.join(' | '));
await b.close();
if (fail.length) { console.log('FEIL:\n- ' + fail.join('\n- ')); process.exit(1); }
console.log('OK – karusell-sjekk grønn');
