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
  bc.innerHTML = '<div class="pop bubble-pop-up is-popup-opened" style="overflow:hidden;display:flex;flex-direction:column"><div class="hdr bubble-header-container">Vær</div><div class="inner bubble-pop-up-container" style="overflow:auto;flex:1;min-height:0"></div></div>';
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
await mk({ view: 'sheet' }); // Fiks 56 I: «Ark» = oppsettet disse sjekkene gjelder (Fullskjerm testes i vaer56-check)
const A = await p.evaluate(() => {
  const c = window.__c, sr = c.shadowRoot, q = (s) => sr.querySelector(s), qa = (s) => [...sr.querySelectorAll(s)], pop = window.__pop;
  const layer = pop.querySelector(':scope > .msh-vaer-scene'), ctl = sr.querySelector('.ctl-slot > .msh-vaer-ctl'), cr = c.getBoundingClientRect();
  const lr = layer && layer.getBoundingClientRect(), pr = pop.getBoundingClientRect(), hr = pop.querySelector('.hdr').getBoundingClientRect();
  const hl = q('.shl'), hlr = hl && hl.getBoundingClientRect();
  const cb = ctl && ctl.shadowRoot.querySelector('.pl'), tb = ctl && ctl.shadowRoot.querySelector('.tn');
  return {
    wrap: q('.wrap') && q('.wrap').className, attr: pop.getAttribute('data-ki-vaer'),
    layer: !!layer, lr: lr && [lr.top, lr.height, lr.width], pr: [pr.top, pr.height, pr.width], hdrTop: hr.top,
    scene: layer && layer.shadowRoot.querySelector('.sc') && layer.shadowRoot.querySelector('.sc').dataset.scene,
    hl: hl && hl.textContent, hlH: hlr && Math.round(hlr.height), hlWs: hl && getComputedStyle(hl).whiteSpace, hlKids: hl && hl.childNodes.length,
    seg: qa('.mpill .mb').map((e) => e.getAttribute('aria-label') + (e.classList.contains('on') ? '*' : '')), segGd: q('.mpill') && q('.mpill').__gd === true, segTA: q('.mpill') && getComputedStyle(q('.mpill')).touchAction,
    days: qa('.dr').length, tiles: qa('.tw').map((e) => e.dataset.tile), glass: q('.g') && getComputedStyle(q('.g')).backdropFilter,
    ctl: !!ctl, cb: cb && cb.getBoundingClientRect().left - cr.left, cbB: cb && pr.bottom - cb.getBoundingClientRect().bottom, tb: tb && cr.right - tb.getBoundingClientRect().right, last: q('.wrap').lastElementChild.className, prev: q('.ctl-slot').previousElementSibling.className, sticky: getComputedStyle(q('.ctl-slot')).position,
    cbTxt: cb && cb.textContent.trim(), pad: c.style.paddingBottom, moon: !!sr.querySelector('.mnt svg.moon[style*="clip-path"] path.lit'),
    host: Math.round(c.getBoundingClientRect().width), inner: Math.round(pop.querySelector('.inner').clientWidth - 36),
  };
});
ok('26.24 standard stil = scene', /scene/.test(A.wrap) && A.attr === 'scene', A);
ok('26.25 scenelaget ligger i popupen og dekker hele flaten (også bak headeren)', A.layer && A.lr && Math.abs(A.lr[0] - A.pr[0]) < 1 && Math.abs(A.lr[1] - A.pr[1]) < 1 && A.lr[0] <= A.hdrTop, A);
ok('26.24 scene for weather-state (partlycloudy, dag)', A.scene === 'partlycloudy', A.scene);
ok('26.24 H/L på én linje som én streng', /^H \d+° · L \d+°$/.test(A.hl || '') && A.hlWs === 'nowrap' && A.hlKids === 1 && A.hlH < 30, A);
ok('26.24/27.1 Liquid Glass-pille Temperatur · Nedbør · Vind', A.seg.join('|') === 'Temperatur*|Nedbør|Vind' && A.segGd && A.segTA === 'pan-y', A.seg);
ok('26.24 døgnvarsel-rader', A.days >= 7, A.days);
ok('26.24/27.0 halvtransparente glasskort (blur 18px)', /blur\(18px\)/.test(A.glass || ''), A.glass);
ok('28.1 stedsvelger + «Tilpass Vær» nederst etter siste seksjon (sticky, 16 px over bunnen, kortets kanter)', A.ctl && A.last === 'ctl-slot' && A.prev === 'attr' && A.sticky === 'sticky' && Math.round(A.cb) === 0 && Math.round(A.cbB) === 16 && Math.round(A.tb) === 0 && /Hjem/.test(A.cbTxt), A);
ok('28.1 innholdet har 16 px bunnluft (navbaren er skjult)', /16px/.test(A.pad || ''), A.pad);
ok('26.24 månen tegnes inni sirkelen (clip-path) i Scene', A.moon, A.moon);
ok('fyller bredden', Math.abs(A.host - A.inner) <= 1, [A.host, A.inner]);
if (shots) await p.screenshot({ path: shots + '/vaer26-scene.png' });

// 27.1 · Vind i Neste timer: glatt kurve + kastflate; scrub → stiplet markør + boble «HH · x m/s · kast y»; slipp → tilbake
const Wd = await p.evaluate(async () => {
  const w = (ms) => new Promise((q) => setTimeout(q, ms));
  const sr = window.__c.shadowRoot;
  sr.querySelector('.mb[data-k="wind"]').click();
  await w(150);
  const sc = sr.querySelector('.wsc'), r = sc.getBoundingClientRect(), o = (x) => ({ bubbles: true, composed: true, clientX: x, clientY: r.top + 20, pointerId: 8, pointerType: 'touch', isPrimary: true });
  const smooth = [...sr.querySelectorAll('.wch path.sm')].map((e) => / C/.test(e.getAttribute('d')));
  sc.dispatchEvent(new PointerEvent('pointerdown', o(r.left + 56 * 1.5 - 12))); sc.dispatchEvent(new PointerEvent('pointermove', o(r.left + 56 * 1.5))); await w(100); // 56 G: berøring – scrub etter retningslås (horisontalt > 8 px)
  const t = sr.querySelector('.wtip') && sr.querySelector('.wtip').textContent, mark = !!sr.querySelector('.wmk'), ta = getComputedStyle(sc).touchAction;
  sc.dispatchEvent(new PointerEvent('pointerup', o(r.left + 56 * 1.5))); await w(100);
  const after = !!sr.querySelector('.wtip');
  await w(400); // klikket etter et scrub-dra svelges
  sr.querySelector('.mb[data-k="temp"]').click(); await w(120);
  return { t, mark, ta, after, smooth };
});
ok('26.24/27.1 vind: glatt linje + kast, scrub-boble «HH · x m/s · kast y», touch-action pan-y (56 G), slipp → tilbake', /^\d\d · [\d,]+ m\/s · kast [\d,]+$/.test(Wd.t || '') && Wd.mark && Wd.ta === 'pan-y' && !Wd.after && Wd.smooth.length === 2 && Wd.smooth.every(Boolean), Wd);

// Dag folder ut (én åpen), setning + timestripe hver 3. time (de som finnes i timeprognosen) + 3×2
const D = await p.evaluate(async () => {
  const w = (ms) => new Promise((q) => setTimeout(q, ms));
  const sr = window.__c.shadowRoot, t0 = new Date().toDateString();
  const exp = (window.__c._fc.hourly || []).filter((y) => { const d = new Date(y.datetime); return d.toDateString() === t0 && d.getHours() % 3 === 0; }).length;
  sr.querySelectorAll('.dr')[0].click(); await w(150);
  const one = sr.querySelectorAll('.dx').length, sen = sr.querySelector('.dsen') && sr.querySelector('.dsen').textContent, cells = sr.querySelectorAll('.dx .dc').length, strip = sr.querySelectorAll('.dx .d3 .hs').length;
  const rot = sr.querySelector('.dw.open .chev ha-icon') && sr.querySelector('.dw.open .chev ha-icon').style.transform;
  sr.querySelectorAll('.dr')[1].click(); await w(150);
  const two = sr.querySelectorAll('.dx').length, open1 = sr.querySelectorAll('.dw')[1].classList.contains('open');
  sr.querySelectorAll('.dr')[1].click(); await w(100);
  return { one, sen, cells, strip, exp, rot, two, open1 };
});
ok('26.24 detaljert dag: setning + timestripe hver 3. time + 3×2, én åpen, pil roteres', D.one === 1 && /^I dag: .+ om natta til .+ på ettermiddagen/.test(D.sen || '') && D.cells === 6 && D.strip === D.exp && /180/.test(D.rot || '') && D.two === 1 && D.open1, D);

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
  await w(460);
  const lifted = a.classList.contains('lift');
  a.dispatchEvent(new PointerEvent('pointermove', o(rb.left + 20, rb.top + 60)));
  await w(40);
  const over = [...sr.querySelectorAll('.tw')].map((e) => e.dataset.tile)[0] === before[1]; // live omorganisering
  a.dispatchEvent(new PointerEvent('pointerup', o(rb.left + 20, rb.top + 60)));
  await w(250);
  const after = [...sr.querySelectorAll('.tw')].map((e) => e.dataset.tile);
  return { before, after, lifted, over, cfg: c._rawConfig.tile_order, swallow: c._swallow };
});
ok('26.25/28.2 hold-og-dra: løft (400 ms), bytt live, slipp lagrer tile_order', T.lifted && T.over && T.after[0] === T.before[1] && T.after[1] === T.before[0] && Array.isArray(T.cfg) && T.cfg[0] === T.before[1] && T.swallow === true, T);

// Stedsvelger: meny åpner oppover, bytte sted endrer værentiteten
const P = await p.evaluate(async () => {
  const w = (ms) => new Promise((q) => setTimeout(q, ms));
  const c = window.__c;
  c.setConfig({ ...c._rawConfig, places: [{ name: 'Hjem', entity: 'weather.home' }, { name: 'Hytta', entity: 'weather.hytta' }] });
  await w(150);
  c._tileMode(false); await w(60);
  const ctl = c.shadowRoot.querySelector('.ctl-slot > .msh-vaer-ctl').shadowRoot;
  ctl.querySelector('.pl').click(); await w(60);
  const mn = ctl.querySelector('.mn'), mr = mn && mn.getBoundingClientRect(), br = ctl.querySelector('.pl').getBoundingClientRect();
  const items = [...ctl.querySelectorAll('.mi .mnm')].map((e) => e.textContent.trim());
  ctl.querySelectorAll('.mi')[1].click(); await w(150);
  return { up: mr && mr.bottom <= br.top, items, lab: ctl.querySelector('.pl .pn').textContent.trim(), ent: window.MSH.vaerAuto(c.hass, c.config).weather, ui: c.ui.place };
});
ok('26.25 stedsvelger: meny oppover, velg «Hytta» → weather.hytta', P.up && P.items.join('|') === 'Hjem|Hytta|Jobb Oslo' && /Hytta/.test(P.lab) && P.ent === 'weather.hytta' && P.ui === 'weather.hytta', P); // Fiks 42: alle weather.* + valgt sted som ID
await p.evaluate(async () => { const c = window.__c; c.setUI({ place: 0 }); c.setConfig({ ...c._rawConfig, places: undefined, order: undefined }); await new Promise((q) => setTimeout(q, 120)); });

// Tilpass Vær (tune-knappen): Ferdig rosa pille øverst, Stil/Steder/Seksjoner/Fliser, rosa brytere
const Sh = await p.evaluate(async () => {
  const w = (ms) => new Promise((q) => setTimeout(q, ms));
  window.__c.shadowRoot.querySelector('.ctl-slot > .msh-vaer-ctl').shadowRoot.querySelector('.tn').click();
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
  // Fiks 42: Hytta er med automatisk → fjern (exclude) og legg til igjen via «Legg til sted» (→ places, ut av exclude)
  const rmH = [...box.querySelectorAll('[data-prow]')].findIndex((r) => /weather\.hytta/.test(r.textContent)); box.querySelector(`[data-a="rm"][data-k="${rmH}"]`).click(); await w(60);
  const afterRm = [...R.querySelectorAll('.vaer-sheet .plist .pr .rl')].map((e) => e.textContent).join('|'), exRm = (window.__c._sheet.box._config.exclude || []).join();
  box.querySelector('[data-a="openadd"]').click(); await w(60);
  const q = box.querySelector('[data-in="q"]'); q.value = 'hyt'; q.dispatchEvent(new Event('input', { bubbles: true })); await w(30);
  box.querySelector('[data-a="cand"][data-k="weather.hytta"]').click(); await w(30);
  box.querySelector('[data-a="add"]').click(); await w(60);
  const places = [...R.querySelectorAll('.vaer-sheet .plist .pr .rl')].map((e) => e.textContent);
  R.querySelector('.vaer-sheet [data-a="done"]').click();
  await w(900);
  const c = window.__c;
  return { caps, tt: tt.textContent, okTop: Math.abs(okR.top - ttR.top) < 20 && okR.right > ttR.right && okR.top - hdR.top < 30, okBg, swBg, liveK, places, afterRm, exRm,
    cfg: { style: c._rawConfig.style, stil: c._rawConfig.stil, sections: c._rawConfig.sections, places: c._rawConfig.places, exclude: c._rawConfig.exclude }, attr: window.__pop.getAttribute('data-ki-vaer'), layer: !!window.__pop.querySelector(':scope > .msh-vaer-scene'), closed: !c._sheet };
});
ok('26.25 Tilpass Vær: Stil · Steder · Seksjoner · Fliser', Sh.tt === 'Tilpass Vær' && ['Stil', 'Steder', 'Seksjoner', 'Fliser'].every((x) => Sh.caps.some((c) => c.startsWith(x))) && Sh.places.join('|') === 'Hjem|Hytta|Jobb Oslo' && Sh.afterRm === 'Hjem|Jobb Oslo' && Sh.exRm === 'weather.hytta', Sh);
ok('Ferdig = rosa pille øverst til høyre, rosa brytere', Sh.okTop && /gradient/.test(Sh.okBg) && /gradient/.test(Sh.swBg || ''), Sh);
ok('26.24 stilbytte live (utkast) → Klassisk', /klassisk/.test(Sh.liveK), Sh.liveK);
ok('28.1 Ferdig lagrer style/sections/places i kortets config', Sh.closed && Sh.cfg.style === 'klassisk' && Sh.cfg.stil === undefined && Sh.cfg.sections && Sh.cfg.sections.days === false && Sh.cfg.places && Sh.cfg.places.some((x) => x.id === 'weather.hytta') && !Sh.cfg.exclude, Sh);
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
  const chip = [...R.querySelectorAll('[data-a="sel"][data-name="style"]')];
  const k = chip.find((x) => x.dataset.v === 'klassisk'); k && k.click(); await w(80);
  const st1 = last && last.style;
  const add = R.querySelector('[data-op="add"]'); const nm = R.querySelector('[data-vp="name"]'); if (nm) nm.value = 'Hytta'; const se = R.querySelector('[data-vp="ent"]'); if (se) se.value = 'weather.hytta';
  add && add.click(); await w(80);
  const pl = last && last.places;
  ed.remove();
  return { chips: chip.map((x) => x.textContent), st1, pl, has: ['Steder', 'Farevarsel', 'Neste timer', 'Døgnvarsel', 'Fliser', 'Tilbakestill rekkefølge'].filter((x) => !txt.includes(x)) };
});
ok('26.25 getConfigElement: Stil + Steder + Seksjoner + Fliser', G.chips.join('|') === 'Klassisk|Scene' && G.st1 === 'klassisk' && Array.isArray(G.pl) && G.pl[0].id === 'weather.hytta' && !G.has.length, G);

// Tilpass Hjem → Popups → Vær: segment + samme verdi
const H = await p.evaluate(async () => {
  const w = (ms) => new Promise((q) => setTimeout(q, ms));
  const html = window.MSH.vaerStilHTML('ppvaer');
  const cur = window.MSH.vaerStil();
  await window.MSH.setVaerStil('scene'); await w(200);
  return { html: /data-a="ppvaer"/.test(html) && /Klassisk/.test(html) && /Scene/.test(html), cur, after: window.MSH.vaerStil(), cfg: window.__c._rawConfig.style, attr: window.__pop.getAttribute('data-ki-vaer') };
});
ok('26.24 Tilpass Hjem → Popups → Vær: segment Klassisk · Scene, samme verdi, live', H.html && H.cur === 'klassisk' && H.after === 'scene' && H.cfg === 'scene' && H.attr === 'scene', H);

// Strategi/popup-malen: styles for #vaer (scene) via M.POPUP_FORCE
const F = await p.evaluate(() => {
  const M = window.MSH, base = M.popupTemplateA({ name: 'Vær', icon: 'mdi:weather-partly-cloudy', hash: '#vaer', card: { type: 'custom:msh-vaer-card', card_id: 'pop-vaer' } });
  const out = M.POPUP_FORCE['#vaer']({ ...base, cards: [{ ...base.cards[0], view: 'sheet' }] }), again = M.POPUP_FORCE['#vaer'](out); // Ark = mal A (Fullskjerm: vaer56)
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
  const portal = find(), on = portal && portal.hasAttribute('data-vaer'), nav = portal && portal.shadowRoot.querySelector('nav.nb'), op = nav && getComputedStyle(nav).opacity, pe = nav && getComputedStyle(nav).pointerEvents;
  location.hash = ''; window.dispatchEvent(new HashChangeEvent('hashchange')); await w(400);
  return { on, op, pe, off: portal && !portal.hasAttribute('data-vaer') };
});
ok('26.24 navbar/mini-spiller skjult mens #vaer er åpen, tilbake når lukket', N.on && N.op === '0' && N.pe === 'none' && N.off, N);

/* ---------------------------------------------------------------- klassisk via YAML */
await mk({ stil: 'klassisk', show_graph: true, card_id: 'vaer-klassisk' }); // gammel nøkkel (alias) → style
const K = await p.evaluate(() => {
  const sr = window.__c.shadowRoot;
  return { hero: !!sr.querySelector('.vh-slot msh-vaer-hero-card'), smooth: / C/.test((sr.querySelector('.gr path.sm') || { getAttribute: () => '' }).getAttribute('d')), rain: !!sr.querySelector('.rb svg path.sm'), own: !!sr.querySelector('.own'), ctl: !!sr.querySelector('.ctl-slot > .msh-vaer-ctl'), attr: window.__pop.getAttribute('data-ki-vaer'), moon: !!sr.querySelector('.mn svg.moon path.lit') };
});
ok('Klassisk: toppkort, glatte kurver (graf + nedbørsflis), måne i sirkel, faste kontroller', K.hero && K.smooth && K.rain && !K.own && K.ctl && K.attr === 'klassisk' && K.moon, K);

ok('ingen sidefeil', !errs.length, errs);
await b.close();
console.log(JSON.stringify(res, null, 1));
if (fail.length) { console.error('FEIL:', fail.join(' · ')); process.exit(1); }
console.log('Alle Vær 26-sjekker OK');
