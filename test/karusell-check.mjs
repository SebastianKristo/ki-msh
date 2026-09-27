// Fiks 17.12/17.17/17.30: felles karusell-prikker (trykk → side, 32 px treffflate, aria, ingen re-render under
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
  const r0 = dots()[1].getBoundingClientRect();
  res.hit = `${Math.round(r0.width)}x${Math.round(r0.height)}`;
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
    const r1 = hd()[1].getBoundingClientRect();
    hd()[1].click(); await wait(100);
    res.hjemTap = { i: vp.dataset.i, tr: vp.firstElementChild.style.transform, on: hd().findIndex((d) => d.classList.contains('on')), renders: hc(), hit: `${Math.round(r1.width)}x${Math.round(r1.height)}` };
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
  return res;
});
const out = await run();
console.log(JSON.stringify(out, null, 1));
const fail = [];
const ok = (c, m) => { if (!c) fail.push(m); };
ok(out.hit === '32x32', 'Vær: treffflate 32×32');
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
  ok(out.hjemTap.i === '1' && out.hjemTap.on === 1 && out.hjemTap.renders === 0 && out.hjemTap.hit === '32x32', 'Hjem: trykk på prikk uten re-render');
  ok(out.hjemDuringSnap === 0 && out.hjemAfterSnap >= 1, 'Hjem: hass venter til snap er ferdig');
  ok(out.hjemKept.i === '1' && out.hjemKept.on === 1, 'Hjem: siden beholdes etter tegning');
  ok(out.hjemSwipe.i === '0' && out.hjemSwipe.on === 0 && out.hjemSwipe.rendersAtRelease === 0, 'Hjem: sveip uten re-render ved slipp');
}
ok(!errs.length, 'sidefeil: ' + errs.join(' | '));
await b.close();
if (fail.length) { console.log('FEIL:\n- ' + fail.join('\n- ')); process.exit(1); }
console.log('OK – karusell-sjekk grønn');
