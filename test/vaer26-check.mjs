// Fiks 26.24/26.25 · Vær (#vaer, msh-vaer-card): stil klassisk | scene i samme kort.
//   node test/vaer26-check.mjs   (SHOTS=<mappe> gir skjermbilder)
import { createRequire } from 'node:module';
import { readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const bundle = resolve(`test/.build/vaer26-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const shots = process.env.SHOTS || '';
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const res = {}, fail = [];
const ok = (name, cond, info) => { res[name] = cond ? 'OK' : ['FEIL', info]; if (!cond) fail.push(name); };
const mocks = readdirSync('test/mock').sort().map((m) => resolve('test/mock/' + m));
const errs = [];
async function page(url, vp) {
  const p = await b.newPage({ viewport: vp || { width: 430, height: 900 }, hasTouch: true });
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(url);
  for (const m of mocks) await p.addScriptTag({ path: m });
  await p.addScriptTag({ path: bundle });
  return p;
}

/* ---------------------------------------------------------------- scene i en popup (harness med .bubble-pop-up) */
const p = await page('file://' + resolve('test/harness.html'));
const mk = async (cfg) => p.evaluate(async (cfg) => {
  const w = (ms) => new Promise((q) => setTimeout(q, ms));
  document.getElementById('dash').innerHTML = '';
  window.__h = window.__h || window.mockHass();
  const bc = document.createElement('bubble-card');
  bc.setConfig({ type: 'custom:bubble-card', card_type: 'pop-up', hash: '#vaer' });
  bc.innerHTML = '<div class="pop bubble-pop-up" style="overflow:hidden;display:flex;flex-direction:column"><div class="hdr bubble-header-container">Vær</div><div class="inner bubble-pop-up-container" style="overflow:auto;flex:1;min-height:0"></div></div>';
  document.getElementById('dash').appendChild(bc);
  location.hash = '#vaer';
  const c = document.createElement('msh-vaer-card');
  c.setConfig({ type: 'custom:msh-vaer-card', card_id: 'pop-vaer', ...cfg }); // cfg.card_id overstyrer
  c.hass = window.__h;
  bc.querySelector('.inner').appendChild(c);
  window.__c = c; window.__pop = bc.querySelector('.bubble-pop-up');
  await w(700);
  return true;
}, cfg);
await mk({});
const A = await p.evaluate(() => {
  const c = window.__c, sr = c.shadowRoot, q = (s) => sr.querySelector(s), qa = (s) => [...sr.querySelectorAll(s)], pop = window.__pop;
  const layer = pop.querySelector(':scope > .msh-vaer-scene'), ctl = pop.querySelector(':scope > .msh-vaer-ctl');
  const lr = layer && layer.getBoundingClientRect(), pr = pop.getBoundingClientRect(), hr = pop.querySelector('.hdr').getBoundingClientRect();
  const hl = q('.shl'), hlr = hl && hl.getBoundingClientRect();
  const cb = ctl && ctl.shadowRoot.querySelector('.pl'), tb = ctl && ctl.shadowRoot.querySelector('.tn');
  return {
    wrap: q('.wrap') && q('.wrap').className, attr: pop.getAttribute('data-ki-vaer'),
    layer: !!layer, lr: lr && [lr.top, lr.height, lr.width], pr: [pr.top, pr.height, pr.width], hdrTop: hr.top,
    scene: layer && layer.shadowRoot.querySelector('.sc') && layer.shadowRoot.querySelector('.sc').dataset.scene,
    hl: hl && hl.textContent, hlH: hlr && Math.round(hlr.height), hlWs: hl && getComputedStyle(hl).whiteSpace, hlKids: hl && hl.childNodes.length,
    seg: qa('.seg .sg').map((e) => e.textContent + (e.classList.contains('on') ? '*' : '')), segGd: q('.seg') && q('.seg').__gd === true, segTA: q('.seg') && getComputedStyle(q('.seg')).touchAction,
    graph: !!q('.gph svg path.sm'), smoothD: q('.gph svg path.sm') && / C/.test(q('.gph svg path.sm').getAttribute('d')),
    days: qa('.dr').length, tiles: qa('.tw').map((e) => e.dataset.tile), glass: q('.g') && getComputedStyle(q('.g')).backdropFilter,
    ctl: !!ctl, cb: cb && cb.getBoundingClientRect().left - pr.left, cbB: cb && pr.bottom - cb.getBoundingClientRect().bottom, tb: tb && pr.right - tb.getBoundingClientRect().right,
    cbTxt: cb && cb.textContent.trim(), pad: c.style.paddingBottom, moon: !!sr.querySelector('.mnt svg.moon[style*="clip-path"] path.lit'),
    host: Math.round(c.getBoundingClientRect().width), inner: Math.round(pop.querySelector('.inner').clientWidth - 36),
  };
});
ok('26.24 standard stil = scene', /scene/.test(A.wrap) && A.attr === 'scene', A);
ok('26.25 scenelaget ligger i popupen og dekker hele flaten (også bak headeren)', A.layer && A.lr && Math.abs(A.lr[0] - A.pr[0]) < 1 && Math.abs(A.lr[1] - A.pr[1]) < 1 && A.lr[0] <= A.hdrTop, A);
ok('26.24 scene for weather-state (partlycloudy, dag)', A.scene === 'partlycloudy', A.scene);
ok('26.24 H/L på én linje som én streng', /^H \d+° · L \d+°$/.test(A.hl || '') && A.hlWs === 'nowrap' && A.hlKids === 1 && A.hlH < 30, A);
ok('26.24 Liquid Glass-segment Temperatur · Nedbør · Vind', A.seg.join('|') === 'Temperatur*|Nedbør|Vind' && A.segGd && A.segTA === 'pan-y', A.seg);
ok('26.24 glatt kurve i Neste timer', A.graph && A.smoothD, A);
ok('26.24 døgnvarsel-rader', A.days >= 7, A.days);
ok('26.24 halvtransparente glasskort (blur 12px)', /blur\(12px\)/.test(A.glass || ''), A.glass);
ok('26.25 stedsvelger nede til venstre + tune nede til høyre (fast i popupen)', A.ctl && Math.round(A.cb) === 16 && Math.round(A.cbB) === 16 && Math.round(A.tb) === 16 && /Hjem/.test(A.cbTxt), A);
ok('26.24 innholdet har 80 px bunnluft', /80px/.test(A.pad || ''), A.pad);
ok('26.24 månen tegnes inni sirkelen (clip-path) i Scene', A.moon, A.moon);
ok('fyller bredden', Math.abs(A.host - A.inner) <= 1, [A.host, A.inner]);
if (shots) await p.screenshot({ path: shots + '/vaer26-scene.png' });

// Scrub i Neste timer → boble «HH · verdi»; slipp → tilbake
const S = await p.evaluate(async () => {
  const w = (ms) => new Promise((q) => setTimeout(q, ms));
  const sr = window.__c.shadowRoot, sc = sr.querySelector('.gph .scrub'), r = sc.getBoundingClientRect();
  const o = (x) => ({ bubbles: true, composed: true, clientX: x, clientY: r.top + 30, pointerId: 7, pointerType: 'touch', isPrimary: true });
  sc.dispatchEvent(new PointerEvent('pointerdown', o(r.left + r.width * 0.5)));
  sc.dispatchEvent(new PointerEvent('pointermove', o(r.left + r.width * 0.6)));
  await w(120);
  const bub = sr.querySelector('.gb') && sr.querySelector('.gb').textContent, mark = !!sr.querySelector('.gph .gc'), ta = getComputedStyle(sc).touchAction;
  sc.dispatchEvent(new PointerEvent('pointerup', o(r.left + r.width * 0.6)));
  await w(120);
  return { bub, mark, ta, after: !!sr.querySelector('.gb') };
});
ok('26.24 scrub: stiplet markør + boble, touch-action none, slipp → tilbake', /^\d\d · /.test(S.bub || '') && S.mark && S.ta === 'none' && !S.after, S);
// Vind-segmentet: «21 · 3,4 m/s · kast 7,5»
const Wd = await p.evaluate(async () => {
  const w = (ms) => new Promise((q) => setTimeout(q, ms));
  const sr = window.__c.shadowRoot;
  await w(400); // klikket etter et scrub-dra svelges (350 ms)
  sr.querySelector('.sg[data-k="wind"]').click();
  await w(120);
  const sc = sr.querySelector('.gph .scrub'), r = sc.getBoundingClientRect(), o = { bubbles: true, composed: true, clientX: r.left + 40, clientY: r.top + 20, pointerId: 8, pointerType: 'touch' };
  sc.dispatchEvent(new PointerEvent('pointerdown', o)); await w(100);
  const t = sr.querySelector('.gb') && sr.querySelector('.gb').textContent;
  sc.dispatchEvent(new PointerEvent('pointerup', o)); await w(60);
  return { t, gust: sr.querySelectorAll('.gph path.sm').length };
});
ok('26.24 vind-boble «HH · x m/s · kast y» + kastlinje', /^\d\d · [\d,]+ m\/s · kast [\d,]+$/.test(Wd.t || '') && Wd.gust === 2, Wd);

// Dag folder ut (én åpen), setning + timestripe + 3×2
const D = await p.evaluate(async () => {
  const w = (ms) => new Promise((q) => setTimeout(q, ms));
  const sr = window.__c.shadowRoot;
  sr.querySelectorAll('.dr')[0].click(); await w(150);
  const one = sr.querySelectorAll('.dx').length, sen = sr.querySelector('.dsen') && sr.querySelector('.dsen').textContent, cells = sr.querySelectorAll('.dx .dc').length, strip = sr.querySelectorAll('.dx .d3 .hs').length;
  const rot = sr.querySelector('.dw.open .chev ha-icon') && sr.querySelector('.dw.open .chev ha-icon').style.transform;
  sr.querySelectorAll('.dr')[1].click(); await w(150);
  const two = sr.querySelectorAll('.dx').length, open1 = sr.querySelectorAll('.dw')[1].classList.contains('open');
  sr.querySelectorAll('.dr')[1].click(); await w(100);
  return { one, sen, cells, strip, rot, two, open1 };
});
ok('26.24 detaljert dag: setning + timestripe hver 3. time + 3×2, én åpen, pil roteres', D.one === 1 && /^I dag: .+ om natta til .+ på ettermiddagen/.test(D.sen || '') && D.cells === 6 && D.strip >= 1 && /180/.test(D.rot || '') && D.two === 1 && D.open1, D);

// Alle 15 HA-tilstander har egen scene
const SC = await p.evaluate(async () => {
  const w = (ms) => new Promise((q) => setTimeout(q, ms));
  const out = {};
  for (const s of window.MSH.VAER_SCENES) {
    window.__h = { ...window.__h, states: { ...window.__h.states, 'weather.home': { ...window.__h.states['weather.home'], state: s } } };
    window.__c.hass = window.__h;
    const get = () => window.__pop.querySelector(':scope > .msh-vaer-scene').shadowRoot.querySelector('.sc');
    for (let i = 0; i < 20 && get().dataset.scene !== s; i++) await w(60);
    const sc = get();
    out[s] = [sc.dataset.scene, sc.children.length, sc.style.background.slice(0, 30)];
  }
  return out;
});
const scs = Object.keys(SC);
ok('26.24 alle 15 HA-værtilstander → egen scene', scs.length === 15 && scs.every((k) => SC[k][0] === k || (k === 'sunny' && SC[k][0] === 'sunny')) && new Set(scs.map((k) => SC[k][2])).size === 15, SC);
ok('26.24 regn/snø/lyn/tåke/stjerner har partikler', SC.rainy[1] > 20 && SC.snowy[1] > 40 && SC.lightning[1] >= 2 && SC.fog[1] >= 5 && SC['clear-night'][1] > 30 && SC.exceptional[1] > 5, SC);
await p.evaluate(async () => { window.__h = { ...window.__h, states: { ...window.__h.states, 'weather.home': { ...window.__h.states['weather.home'], state: 'rainy' } } }; window.__c.hass = window.__h; await new Promise((q) => setTimeout(q, 150)); });
if (shots) await p.screenshot({ path: shots + '/vaer26-rain.png' });

// Månefase: voksende vs avtakende speilet
const Mo = await p.evaluate(async () => {
  const w = (ms) => new Promise((q) => setTimeout(q, ms));
  const get = () => { const s = window.__c.shadowRoot.querySelector('.mnt svg.moon'); return s && [s.dataset.wax, s.querySelector('path.lit').getAttribute('d')]; };
  const set = async (st) => { window.__h = { ...window.__h, states: { ...window.__h.states, 'sensor.moon_phase': { ...window.__h.states['sensor.moon_phase'], state: st } } }; window.__c.hass = window.__h; await w(90); return get(); };
  return { wax: await set('waxing_crescent'), wan: await set('waning_crescent'), full: await set('full_moon') };
});
ok('26.24 månefase speilet for voksende/avtakende', Mo.wax[0] === '1' && Mo.wan[0] === '0' && /A50,50 0 0 1 /.test(Mo.wax[1]) && /A50,50 0 0 0 /.test(Mo.wan[1]), Mo);

// Fliser: hold 420 ms → løft, dra → bytt, slipp lagrer tile_order
const T = await p.evaluate(async () => {
  const w = (ms) => new Promise((q) => setTimeout(q, ms));
  const c = window.__c, sr = c.shadowRoot, tw = [...sr.querySelectorAll('.tw')], a = tw[0], bb = tw[1];
  a.scrollIntoView({ block: 'center' }); await w(100);
  const ra = a.getBoundingClientRect(), rb = bb.getBoundingClientRect();
  const o = (x, y) => ({ bubbles: true, composed: true, clientX: x, clientY: y, pointerId: 11, pointerType: 'touch', isPrimary: true });
  const before = tw.map((e) => e.dataset.tile);
  a.dispatchEvent(new PointerEvent('pointerdown', o(ra.left + 20, ra.top + 60)));
  await w(480);
  const lifted = a.classList.contains('lift');
  a.dispatchEvent(new PointerEvent('pointermove', o(rb.left + 20, rb.top + 60)));
  await w(40);
  const over = bb.classList.contains('over');
  a.dispatchEvent(new PointerEvent('pointerup', o(rb.left + 20, rb.top + 60)));
  await w(250);
  const after = [...sr.querySelectorAll('.tw')].map((e) => e.dataset.tile);
  return { before, after, lifted, over, cfg: c._rawConfig.tile_order, swallow: c._swallow };
});
ok('26.25 hold-og-dra: løft (420 ms), bytt, slipp lagrer tile_order', T.lifted && T.over && T.after[0] === T.before[1] && T.after[1] === T.before[0] && Array.isArray(T.cfg) && T.cfg[0] === T.before[1] && T.swallow === true, T);

// Stedsvelger: meny åpner oppover, bytte sted endrer værentiteten
const P = await p.evaluate(async () => {
  const w = (ms) => new Promise((q) => setTimeout(q, ms));
  const c = window.__c;
  c.setConfig({ ...c._rawConfig, places: [{ name: 'Hjem', entity: 'weather.home' }, { name: 'Hytta', entity: 'weather.hytta' }] });
  await w(150);
  const ctl = window.__pop.querySelector(':scope > .msh-vaer-ctl').shadowRoot;
  ctl.querySelector('.pl').click(); await w(60);
  const mn = ctl.querySelector('.mn'), mr = mn && mn.getBoundingClientRect(), br = ctl.querySelector('.pl').getBoundingClientRect();
  const items = [...ctl.querySelectorAll('.mi')].map((e) => e.textContent.trim());
  ctl.querySelectorAll('.mi')[1].click(); await w(150);
  return { up: mr && mr.bottom <= br.top, items, lab: ctl.querySelector('.pl').textContent.trim(), ent: window.MSH.vaerAuto(c.hass, c.config).weather, ui: c.ui.place };
});
ok('26.25 stedsvelger: meny oppover, velg «Hytta» → weather.hytta', P.up && P.items.join('|') === 'Hjem|Hytta' && /Hytta/.test(P.lab) && P.ent === 'weather.hytta' && P.ui === 1, P);
await p.evaluate(async () => { const c = window.__c; c.setUI({ place: 0 }); c.setConfig({ ...c._rawConfig, places: undefined }); await new Promise((q) => setTimeout(q, 120)); });

// Tilpass Vær (tune-knappen): Ferdig rosa pille øverst, Stil/Steder/Seksjoner/Fliser, rosa brytere
const Sh = await p.evaluate(async () => {
  const w = (ms) => new Promise((q) => setTimeout(q, ms));
  window.__pop.querySelector(':scope > .msh-vaer-ctl').shadowRoot.querySelector('.tn').click();
  await w(400);
  const R = window.__c._sheet.ov.root, box = R.querySelector('.vaer-sheet');
  const hd = box.querySelector('.hd'), okb = hd.querySelector('.ok'), tt = hd.querySelector('.tt');
  const okR = okb.getBoundingClientRect(), ttR = tt.getBoundingClientRect(), hdR = hd.getBoundingClientRect();
  const caps = [...box.querySelectorAll('.cap')].map((e) => e.textContent), okBg = getComputedStyle(okb).backgroundImage;
  const sw = box.querySelector('.tsw.on'), swBg = sw && getComputedStyle(sw).backgroundImage;
  // Stil → Klassisk (live i kortet) + skjul Døgnvarsel
  box.querySelector('[data-a="stil"][data-k="klassisk"]').click(); await w(150);
  const liveK = window.__c.shadowRoot.querySelector('.wrap').className;
  box.querySelector('[data-a="sec"][data-k="days"]').click(); await w(60);
  box.querySelector('[data-a="ent"][data-k="weather.hytta"]') && box.querySelector('[data-a="ent"][data-k="weather.hytta"]').click();
  const inp = box.querySelector('[data-in="name"]'); inp.value = 'Hytta'; inp.dispatchEvent(new Event('input'));
  box.querySelector('[data-a="add"]').click(); await w(60);
  const places = [...R.querySelectorAll('.vaer-sheet .rows .r .rl')].map((e) => e.textContent);
  R.querySelector('.vaer-sheet [data-a="done"]').click();
  await w(900);
  const c = window.__c;
  return { caps, tt: tt.textContent, okTop: Math.abs(okR.top - ttR.top) < 20 && okR.right > ttR.right && okR.top - hdR.top < 30, okBg, swBg, liveK, places,
    cfg: { stil: c._rawConfig.stil, hide: c._rawConfig.hide, places: c._rawConfig.places }, attr: window.__pop.getAttribute('data-ki-vaer'), layer: !!window.__pop.querySelector(':scope > .msh-vaer-scene'), closed: !c._sheet };
});
ok('26.25 Tilpass Vær: Stil · Steder · Seksjoner · Fliser', Sh.tt === 'Tilpass Vær' && ['Stil', 'Steder', 'Seksjoner', 'Fliser'].every((x) => Sh.caps.includes(x)), Sh);
ok('Ferdig = rosa pille øverst til høyre, rosa brytere', Sh.okTop && /gradient/.test(Sh.okBg) && /gradient/.test(Sh.swBg || ''), Sh);
ok('26.24 stilbytte live (utkast) → Klassisk', /klassisk/.test(Sh.liveK), Sh.liveK);
ok('26.25 Ferdig lagrer stil/hide/places i kortets config', Sh.closed && Sh.cfg.stil === 'klassisk' && (Sh.cfg.hide || []).includes('days') && Sh.cfg.places && Sh.cfg.places.some((x) => x.entity === 'weather.hytta'), Sh);
ok('26.24 Klassisk: popupen uten scene (data-ki-vaer=klassisk, ingen scenelag)', Sh.attr === 'klassisk' && !Sh.layer, Sh);
if (shots) await p.screenshot({ path: shots + '/vaer26-klassisk.png' });

// GUI-editoren (getConfigElement): stil-valg + steder + seksjoner + fliser
const G = await p.evaluate(async () => {
  const w = (ms) => new Promise((q) => setTimeout(q, ms));
  const ed = customElements.get('msh-vaer-card').getConfigElement();
  document.body.appendChild(ed);
  ed.hass = window.__h; ed.setConfig({ type: 'custom:msh-vaer-card', card_id: 'gui-vaer' });
  let last = null; ed.addEventListener('config-changed', (e) => { last = e.detail.config; });
  await w(200);
  const R = ed.shadowRoot, txt = R.textContent;
  const chip = [...R.querySelectorAll('[data-a="sel"][data-name="stil"]')];
  const k = chip.find((x) => x.dataset.v === 'klassisk'); k && k.click(); await w(80);
  const st1 = last && last.stil;
  const add = R.querySelector('[data-op="add"]'); const nm = R.querySelector('[data-vp="name"]'); if (nm) nm.value = 'Hytta'; const se = R.querySelector('[data-vp="ent"]'); if (se) se.value = 'weather.hytta';
  add && add.click(); await w(80);
  const pl = last && last.places;
  ed.remove();
  return { chips: chip.map((x) => x.textContent), st1, pl, has: ['Steder', 'Farevarsel', 'Neste timer', 'Døgnvarsel', 'Fliser', 'Tilbakestill rekkefølge'].filter((x) => !txt.includes(x)) };
});
ok('26.25 getConfigElement: Stil + Steder + Seksjoner + Fliser', G.chips.join('|') === 'Klassisk|Scene' && G.st1 === 'klassisk' && Array.isArray(G.pl) && G.pl[0].entity === 'weather.hytta' && !G.has.length, G);

// Tilpass Hjem → Popups → Vær: segment + samme verdi
const H = await p.evaluate(async () => {
  const w = (ms) => new Promise((q) => setTimeout(q, ms));
  const html = window.MSH.vaerStilHTML('ppvaer');
  const cur = window.MSH.vaerStil();
  await window.MSH.setVaerStil('scene'); await w(200);
  return { html: /data-a="ppvaer"/.test(html) && /Klassisk/.test(html) && /Scene/.test(html), cur, after: window.MSH.vaerStil(), cfg: window.__c._rawConfig.stil, attr: window.__pop.getAttribute('data-ki-vaer') };
});
ok('26.24 Tilpass Hjem → Popups → Vær: segment Klassisk · Scene, samme verdi, live', H.html && H.cur === 'klassisk' && H.after === 'scene' && H.cfg === 'scene' && H.attr === 'scene', H);

// Strategi/popup-malen: styles for #vaer (scene) via M.POPUP_FORCE
const F = await p.evaluate(() => {
  const M = window.MSH, base = M.popupTemplateA({ name: 'Vær', icon: 'mdi:weather-partly-cloudy', hash: '#vaer', card: { type: 'custom:msh-vaer-card', card_id: 'pop-vaer' } });
  const out = M.POPUP_FORCE['#vaer'](base), again = M.POPUP_FORCE['#vaer'](out);
  return { has: /data-ki-vaer="scene"/.test(out.styles) && /bubble-pop-up-background\{background:none!important;display:none!important\}/.test(out.styles), once: (again.styles.match(/ki-vaer:start/g) || []).length === 1, keep: /--vertical-stack-card-gap/.test(out.styles), bg: out.bg_opacity, cards: out.cards.length };
});
ok('26.25 popup-styles for #vaer (transparent bakgrunn/header, glass-lukk) settes av strategien, idempotent, ett kort', F.has && F.once && F.keep && F.bg === '98' && F.cards === 1, F);

// Navbar + mini-spiller skjules mens #vaer er åpen (samme mekanisme som ringeklokke)
const N = await p.evaluate(async () => {
  const w = (ms) => new Promise((q) => setTimeout(q, ms));
  const nb = document.createElement('msh-navbar-card');
  nb.setConfig({ type: 'custom:msh-navbar-card', card_id: 'nb' }); nb.hass = window.__h; document.getElementById('dash').appendChild(nb);
  location.hash = '#vaer'; window.dispatchEvent(new HashChangeEvent('hashchange')); await w(400);
  const find = () => { const all = [nb, document.body]; for (const r of all) { const x = (r.shadowRoot || r).querySelector ? [...(r.querySelectorAll ? r.querySelectorAll('*') : [])].find((e) => e.shadowRoot && e.shadowRoot.querySelector('[data-nav]')) : null; if (x) return x; } return null; };
  const portal = find(), on = portal && portal.hasAttribute('data-ring'), nav = portal && portal.shadowRoot.querySelector('nav.nb'), op = nav && getComputedStyle(nav).opacity, pe = nav && getComputedStyle(nav).pointerEvents;
  location.hash = ''; window.dispatchEvent(new HashChangeEvent('hashchange')); await w(400);
  return { on, op, pe, off: portal && !portal.hasAttribute('data-ring') };
});
ok('26.24 navbar/mini-spiller skjult mens #vaer er åpen, tilbake når lukket', N.on && N.op === '0' && N.pe === 'none' && N.off, N);

/* ---------------------------------------------------------------- klassisk via YAML */
await mk({ stil: 'klassisk', show_graph: true, card_id: 'vaer-klassisk' });
const K = await p.evaluate(() => {
  const sr = window.__c.shadowRoot;
  return { hero: !!sr.querySelector('.vh-slot msh-vaer-hero-card'), smooth: / C/.test((sr.querySelector('.gr path.sm') || { getAttribute: () => '' }).getAttribute('d')), rain: !!sr.querySelector('.rb svg path.sm'), own: !!sr.querySelector('.own'), ctl: !!window.__pop.querySelector(':scope > .msh-vaer-ctl'), attr: window.__pop.getAttribute('data-ki-vaer'), moon: !!sr.querySelector('.mn svg.moon path.lit') };
});
ok('Klassisk: toppkort, glatte kurver (graf + nedbørsflis), måne i sirkel, faste kontroller', K.hero && K.smooth && K.rain && !K.own && K.ctl && K.attr === 'klassisk' && K.moon, K);

ok('ingen sidefeil', !errs.length, errs);
await b.close();
console.log(JSON.stringify(res, null, 1));
if (fail.length) { console.error('FEIL:', fail.join(' · ')); process.exit(1); }
console.log('Alle Vær 26-sjekker OK');
