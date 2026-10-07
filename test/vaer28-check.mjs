// Fiks 28.1–28.4 · Vær-popup (#vaer): Tilpass nederst + config-nøkler, hold-flytt av fliser, Scene uten topplinje,
// navbar/«Spilles nå» fades ut mens #vaer er åpen.   node test/vaer28-check.mjs   (SHOTS=<mappe> gir skjermbilder)
// Uavhengig av klokkeslett.
import { createRequire } from 'node:module';
import { readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const bundle = resolve(`test/.build/vaer28-${process.pid}.js`);
execFileSync('node', ['build.mjs', bundle]);
const shots = process.env.SHOTS || '';
const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const res = {}, fail = [];
const ok = (name, cond, info) => { res[name] = cond ? 'OK' : ['FEIL', info]; if (!cond) fail.push(name); };
const mocks = readdirSync('test/mock').sort().map((m) => resolve('test/mock/' + m));
const errs = [];
async function page(vp, url = 'test/harness.html') {
  const p = await b.newPage({ viewport: vp, hasTouch: true });
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + resolve(url));
  for (const m of mocks) await p.addScriptTag({ path: m });
  await p.addScriptTag({ path: bundle });
  return p;
}
const mk = (p, cfg) => p.evaluate(async (cfg) => {
  const w = (ms) => new Promise((q) => setTimeout(q, ms));
  document.getElementById('dash').innerHTML = '';
  const h = window.__h || (window.__h = window.mockHass());
  h.states['weather.home'] = { ...h.states['weather.home'], state: 'sunny' };
  const bc = document.createElement('bubble-card');
  bc.setConfig({ type: 'custom:bubble-card', card_type: 'pop-up', hash: '#vaer' });
  bc.innerHTML = '<div class="pop bubble-pop-up is-popup-opened" style="overflow:hidden;display:flex;flex-direction:column"><div class="hdr bubble-header-container">Vær</div><div class="inner bubble-pop-up-container" style="overflow:auto;flex:1;min-height:0"></div></div>';
  document.getElementById('dash').appendChild(bc);
  location.hash = '#vaer';
  const c = document.createElement('msh-vaer-card');
  c.setConfig({ type: 'custom:msh-vaer-card', card_id: 'pop-vaer', ...cfg });
  c.hass = h;
  bc.querySelector('.inner').appendChild(c);
  window.__c = c; window.__pop = bc.querySelector('.bubble-pop-up');
  window.__hap = []; if (!window.__hapL) { window.__hapL = true; window.addEventListener('haptic', (e) => window.__hap.push(e.detail)); }
  // «Bubble» lytter på popupen: ingen pointerdown/touchstart/touchmove fra flisene skal nå hit (swipe-to-close)
  window.__bub = []; ['pointerdown', 'touchstart', 'touchmove'].forEach((t) => window.__pop.addEventListener(t, () => window.__bub.push(t)));
  await w(700);
  return true;
}, cfg);

for (const vp of [{ width: 390, height: 900, tag: 'mobil' }, { width: 1280, height: 900, tag: 'PC' }]) {
  const T = vp.tag;
  const p = await page({ width: vp.width, height: vp.height });

  /* ------------------------------------------------ 28.1 config-nøkler: gamle (alias) migreres til style/sections/section_order/tile_order */
  await mk(p, { stil: 'klassisk', hide: ['days'], hidden_sections: ['moon', 'alerts'], sections: ['hero', 'tiles', 'hours'], tiles: ['uv', 'wind'] });
  const Mg = await p.evaluate(() => { const r = window.__c._rawConfig; return { style: r.style, stil: r.stil, sections: r.sections, so: r.section_order, hs: r.hidden_sections, hide: r.hide, to: r.tile_order, tiles: r.tiles, wrap: window.__c.shadowRoot.querySelector('.wrap').className, first: window.__c.shadowRoot.querySelector('.blk').dataset.sec }; });
  ok(`${T} 28.1 migrering: stil → style, hide/hidden_sections → sections {…: false}, sections-liste → section_order, tiles → tile_order`,
    Mg.style === 'klassisk' && Mg.stil === undefined && Mg.sections && Mg.sections.days === false && Mg.sections.alerts === false && Mg.sections.hours === undefined && Mg.so.join() === 'hero,tiles,hours' && Mg.hs.join() === 'moon' && Mg.hide === undefined && Mg.to.join() === 'uv,wind' && Mg.tiles === undefined && /klassisk/.test(Mg.wrap) && Mg.first === 'hero', Mg);
  await mk(p, { style: 'scene', stil: 'klassisk', sections: { hours: false }, hide: ['hours'] });
  const Mg2 = await p.evaluate(() => { const sr = window.__c.shadowRoot; return { wrap: sr.querySelector('.wrap').className, hours: !!sr.querySelector('[data-sec="hours"]'), days: !!sr.querySelector('[data-sec="days"]') }; });
  ok(`${T} 28.1 ny nøkkel vinner over gammel (style over stil), sections.hours = false skjuler`, /scene/.test(Mg2.wrap) && !Mg2.hours && Mg2.days, Mg2);

  /* ------------------------------------------------ 28.1 Tilpass-knappen nederst etter siste seksjon */
  await mk(p, { view: 'sheet', places: [{ name: 'Hjem', entity: 'weather.home' }, { name: 'Hytta', entity: 'weather.hytta' }] }); // 56 I: «Ark» (Fullskjerm: vaer56)
  const Pos = await p.evaluate(async () => {
    const w = (ms) => new Promise((q) => setTimeout(q, ms));
    const c = window.__c, sr = c.shadowRoot, slot = sr.querySelector('.ctl-slot'), inner = window.__pop.querySelector('.inner'), hdr = window.__pop.querySelector('.hdr').getBoundingClientRect();
    const tn = () => slot.querySelector('.msh-vaer-ctl').shadowRoot.querySelector('.tn').getBoundingClientRect();
    const top = tn(); inner.scrollTop = 1e6; await w(200); const end = tn(), attr = sr.querySelector('.attr').getBoundingClientRect();
    inner.scrollTop = 0; await w(100);
    return { last: sr.querySelector('.wrap').lastElementChild === slot, inHeader: top.top < hdr.bottom, bottomGap: Math.round(window.__pop.getBoundingClientRect().bottom - top.bottom), afterAttr: Math.round(end.top - attr.bottom), title: slot.querySelector('.msh-vaer-ctl').shadowRoot.querySelector('.tn').title };
  });
  ok(`${T} 28.1 «Tilpass Vær» nederst i popupen etter siste seksjon (ikke i headeren), sticky 16 px over bunnen`, Pos.last && !Pos.inHeader && Pos.bottomGap === 16 && Pos.afterAttr >= 0 && Pos.afterAttr < 30 && Pos.title === 'Tilpass Vær', Pos);

  /* ------------------------------------------------ 28.1 Tilpass-arket: Stil · Steder · Seksjoner · Fliser + Tilbakestill */
  const Sh = await p.evaluate(async () => {
    const w = (ms) => new Promise((q) => setTimeout(q, ms));
    const c = window.__c;
    c.setConfig({ ...c._rawConfig, tile_order: ['press', 'hum', 'wind'] }); await w(150);
    c.shadowRoot.querySelector('.ctl-slot > .msh-vaer-ctl').shadowRoot.querySelector('.tn').click(); await w(400);
    const R = c._sheet.ov.root, box = R.querySelector('.vaer-sheet');
    const caps = [...box.querySelectorAll('.cap')].map((e) => e.textContent.trim());
    const stil = [...box.querySelectorAll('[data-a="stil"]')].map((e) => e.textContent.trim() + (e.classList.contains('on') ? '*' : ''));
    const secs = [...box.querySelectorAll('.r .rl')].map((e) => e.textContent.trim());
    const reset = box.querySelector('[data-a="treset"]'), resetTxt = reset.textContent.trim(), resetOn = !reset.disabled;
    // søk finner weather.* på navn og ID
    box.querySelector('[data-a="openadd"]').click(); await w(80);
    const q = box.querySelector('[data-in="q"]'), find = (v) => { q.value = v; q.dispatchEvent(new Event('input', { bubbles: true })); return [...box.querySelectorAll('.cands .cd')].map((e) => e.dataset.k); };
    const byName = find(window.__h.states['weather.hytta'].attributes.friendly_name.slice(0, 4)), byId = find('weather.hyt'), none = find('zzzz') ;
    box.querySelector('[data-a="openadd"]').click(); await w(60);
    box.querySelector('[data-a="sec"][data-k="hours"]').click(); await w(60);
    box.querySelector('[data-a="stil"][data-k="klassisk"]').click(); await w(60);
    box.querySelector('[data-a="treset"]').click(); await w(80);
    const live = [...c.shadowRoot.querySelectorAll('.tw')].map((e) => e.dataset.tile);
    box.querySelector('[data-a="stil"][data-k="scene"]').click(); await w(150);
    for (let i = 0; i < 20 && !c.shadowRoot.querySelector('.wrap.scene .tw'); i++) await w(100);
    const liveScene = [...c.shadowRoot.querySelectorAll('.tw')].map((e) => e.dataset.tile);
    R.querySelector('[data-a="done"]').click(); await w(900);
    const r = c._rawConfig;
    return { caps, stil, secs, resetTxt, resetOn, byName, byId, none: none.length, live, liveScene, cfg: { style: r.style, sections: r.sections, tile_order: r.tile_order, places: (r.places || []).length } };
  });
  ok(`${T} 28.1 arket: Stil (Klassisk · Scene) · Steder · Seksjoner (4 brytere) · Fliser + «Tilbakestill rekkefølge»`, ['Stil', 'Steder', 'Seksjoner', 'Fliser'].every((x) => Sh.caps.some((c) => c.startsWith(x))) && Sh.stil.join('|') === 'Klassisk|Scene*' && Sh.secs.slice(0, 4).join('|') === 'Farevarsel|Neste timer|Døgnvarsel|Fliser' && Sh.resetTxt === 'Tilbakestill rekkefølge' && Sh.resetOn, Sh);
  ok(`${T} 28.1 søk i «Legg til sted» finner weather.* på navn og ID`, Sh.byName.includes('weather.hytta') && Sh.byId.join() === 'weather.hytta' && Sh.none === 0, Sh);
  ok(`${T} 28.2 Tilbakestill → designets standardrekkefølge (Vind · Soloppgang · Måne · UV · Føles som · Nedbør · Sikt · Luftfuktighet · Lufttrykk)`, Sh.liveScene.join() === 'wind,sun,moon,uv,feels,rain,vis,hum,press', Sh.liveScene);
  ok(`${T} 28.1 Ferdig lagrer style · sections · tile_order (fjernet) · places i kortets config`, Sh.cfg.style === 'scene' && Sh.cfg.sections && Sh.cfg.sections.hours === false && Sh.cfg.tile_order === undefined && Sh.cfg.places === 2, Sh.cfg);

  /* ------------------------------------------------ 28.1 GUI-editoren speiler de samme nøklene */
  const G = await p.evaluate(async () => {
    const w = (ms) => new Promise((q) => setTimeout(q, ms));
    const ed = customElements.get('msh-vaer-card').getConfigElement();
    document.body.appendChild(ed);
    ed.hass = window.__h; ed.setConfig({ type: 'custom:msh-vaer-card', card_id: 'gui-vaer', stil: 'klassisk', hide: ['days'] });
    let last = null; ed.addEventListener('config-changed', (e) => { last = e.detail.config; });
    await w(200);
    const R = ed.shadowRoot, cur = [...R.querySelectorAll('[data-a="sel"][data-name="style"]')].map((x) => x.dataset.v + (x.classList.contains('on') || x.getAttribute('aria-pressed') === 'true' || x.getAttribute('aria-checked') === 'true' ? '*' : ''));
    const sc = [...R.querySelectorAll('[data-a="sel"][data-name="style"]')].find((x) => x.dataset.v === 'scene'); sc && sc.click(); await w(80);
    const a1 = last && { style: last.style, stil: last.stil, sections: last.sections, hide: last.hide };
    const sw = [...R.querySelectorAll('[data-a="boolfn"]')].find((x) => /Neste timer/.test((x.closest('.f, label, .row, div') || x).textContent));
    sw && sw.click(); await w(80);
    const a2 = last && { sections: last.sections };
    const txt = R.textContent;
    ed.remove();
    return { cur, a1, a2, has: ['Steder', 'Farevarsel', 'Neste timer', 'Døgnvarsel', 'Fliser', 'Tilbakestill rekkefølge', 'Rekkefølge seksjoner'].filter((x) => !txt.includes(x)) };
  });
  ok(`${T} 28.1 getConfigElement: style (gammel stil vises riktig), sections-brytere, samme felt som arket`, G.cur.includes('klassisk*') && G.a1 && G.a1.style === 'scene' && G.a1.stil === undefined && G.a1.hide === undefined && G.a1.sections && G.a1.sections.days === false && G.a2 && G.a2.sections && G.a2.sections.hours === false && !G.has.length, G);

  /* ------------------------------------------------ 28.2 hold-flytt av fliser */
  await mk(p, {});
  const H = await p.evaluate(async () => {
    const w = (ms) => new Promise((q) => setTimeout(q, ms));
    const c = window.__c, sr = c.shadowRoot, tiles = () => [...sr.querySelectorAll('.tw')], box = sr.querySelector('[data-tiles]');
    const a = tiles()[0], bb = tiles()[1], d = tiles()[3];
    a.scrollIntoView({ block: 'center' }); await w(150);
    const o = (x, y, id = 21) => ({ bubbles: true, composed: true, cancelable: true, clientX: x, clientY: y, pointerId: id, pointerType: 'touch', isPrimary: true });
    const ra = a.getBoundingClientRect(), rb = bb.getBoundingClientRect(), rd = d.getBoundingClientRect();
    const before = tiles().map((e) => e.dataset.tile);
    window.__bub.length = 0;
    // kort trykk (< 400 ms) → ingen løft
    a.dispatchEvent(new PointerEvent('pointerdown', o(ra.left + 30, ra.top + 40))); await w(250);
    a.dispatchEvent(new PointerEvent('pointerup', o(ra.left + 30, ra.top + 40))); await w(300);
    const short = { lift: a.classList.contains('lift'), mode: !!c._tmode };
    // hold 400 ms → løft
    window.__hap.length = 0;
    a.dispatchEvent(new PointerEvent('pointerdown', o(ra.left + 30, ra.top + 40)));
    a.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, composed: true, cancelable: true }));
    await w(330);
    const early = a.classList.contains('lift');
    await w(120);
    const liftOn = a.classList.contains('lift'), tf = a.style.transform, sh = getComputedStyle(a.firstElementChild).boxShadow;
    const wig = getComputedStyle(bb.firstElementChild).animationName, wigLift = getComputedStyle(a.firstElementChild).animationName, ta = getComputedStyle(bb).touchAction;
    const hap1 = [...window.__hap];
    // dra over flis 4 → live bytte med FLIP 200 ms
    const tm = new TouchEvent('touchmove', { bubbles: true, composed: true, cancelable: true });
    a.dispatchEvent(tm);
    a.dispatchEvent(new PointerEvent('pointermove', o(rd.left + 30, rd.top + 40)));
    const mid = tiles().map((e) => e.dataset.tile), flip = tiles().filter((e) => e !== a).map((e) => e.style.transition).filter((t) => /transform 0?\.2s/.test(t)).length;
    const shot = window.__shotMid ? await window.__shotMid() : null;
    await w(60);
    const live = { mid, flip, prevented: tm.defaultPrevented };
    await w(100);
    a.dispatchEvent(new PointerEvent('pointerup', o(rd.left + 30, rd.top + 40))); await w(300);
    const after = tiles().map((e) => e.dataset.tile), hap2 = [...window.__hap], saved = c._rawConfig.tile_order;
    const stillMode = !!c._tmode && box.classList.contains('tmode');
    // i flyttemodus løftes en flis straks
    const b2 = tiles()[2], r2 = b2.getBoundingClientRect();
    b2.dispatchEvent(new PointerEvent('pointerdown', o(r2.left + 30, r2.top + 40, 22))); await w(30);
    const instant = b2.classList.contains('lift');
    b2.dispatchEvent(new PointerEvent('pointerup', o(r2.left + 30, r2.top + 40, 22))); await w(300);
    // Esc avslutter
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await w(120);
    const escOff = !c._tmode && !sr.querySelector('[data-tiles]').classList.contains('tmode');
    // trykk utenfor avslutter
    const t0 = tiles()[0], r0 = t0.getBoundingClientRect();
    t0.dispatchEvent(new PointerEvent('pointerdown', o(r0.left + 30, r0.top + 40, 23))); await w(460);
    const on2 = !!c._tmode;
    t0.dispatchEvent(new PointerEvent('pointerup', o(r0.left + 30, r0.top + 40, 23))); await w(300);
    const bubTiles = [...new Set(window.__bub)];
    const now = sr.querySelector('.snw');
    now.dispatchEvent(new PointerEvent('pointerdown', o(10, 10, 24))); await w(120);
    const outOff = !c._tmode;
    return { before, short, early, liftOn, tf, sh, wig, wigLift, ta, hap1, live, after, hap2, saved, stillMode, instant, escOff, on2, outOff, bub: bubTiles };
  });
  ok(`${T} 28.2 kort trykk (< 400 ms) = ingen løft / ingen flyttemodus`, !H.short.lift && !H.short.mode, H.short);
  ok(`${T} 28.2 hold 400 ms → løft: scale 1.04 + skygge, haptic medium`, !H.early && H.liftOn && /scale\(1\.04\)/.test(H.tf) && /rgba\(0, 0, 0, 0\.45\)/.test(H.sh) && H.hap1.includes('medium'), H);
  ok(`${T} 28.2 de andre flisene vugger (ikke den løftede), touch-action none i flyttemodus`, H.wig === 'vwig' && H.wigLift === 'none' && H.ta === 'none', H);
  ok(`${T} 28.2 dra → live omorganisering med FLIP 200 ms, touchmove preventDefault`, H.live.mid.indexOf(H.before[0]) === 3 && H.live.flip >= 2 && H.live.prevented, H.live);
  ok(`${T} 28.2 slipp → haptic light + tile_order lagret, flyttemodus består`, H.hap2.includes('light') && Array.isArray(H.saved) && H.saved.indexOf(H.before[0]) === 3 && H.after.join() === H.live.mid.join() && H.stillMode, H);
  ok(`${T} 28.2 i flyttemodus løftes en flis straks; Esc og trykk utenfor avslutter`, H.instant && H.escOff && H.on2 && H.outOff, H);
  ok(`${T} 28.2 fallgruve 2: pointerdown og touchmove under dra fra flisene når aldri Bubble-popupen (56 G: touchstart slippes, så vertikal scroll/lukking virker)`, !H.bub.includes('pointerdown') && !H.bub.includes('touchmove'), H.bub);

  /* ------------------------------------------------ 28.2 mus: hold og dra med ekte musehendelser */
  await mk(p, {});
  const box = await p.evaluate(async () => { const t = [...window.__c.shadowRoot.querySelectorAll('.tw')]; t[0].scrollIntoView({ block: 'center' }); await new Promise((q) => setTimeout(q, 150)); const r = t[0].getBoundingClientRect(), r2 = t[1].getBoundingClientRect(); return { a: [r.left + 30, r.top + 40], b: [r2.left + 30, r2.top + 40], o: t.map((e) => e.dataset.tile) }; });
  await p.mouse.move(box.a[0], box.a[1]); await p.mouse.down(); await p.waitForTimeout(480);
  await p.mouse.move((box.a[0] + box.b[0]) / 2, box.b[1], { steps: 4 }); await p.mouse.move(box.b[0], box.b[1], { steps: 6 });
  if (shots) await p.screenshot({ path: `${shots}/vaer28-${T}-flytt.png` });
  await p.mouse.up(); await p.waitForTimeout(400);
  const Mo = await p.evaluate(() => ({ o: [...window.__c.shadowRoot.querySelectorAll('.tw')].map((e) => e.dataset.tile), cfg: window.__c._rawConfig.tile_order, open: location.hash, bub: [...new Set(window.__bub)] }));
  ok(`${T} 28.2 mus: hold + dra bytter flis 1 og 2, lagres, popupen er fortsatt åpen`, Mo.o[1] === box.o[0] && Mo.o[0] === box.o[1] && Array.isArray(Mo.cfg) && Mo.open === '#vaer' && !Mo.bub.includes('pointerdown'), Mo);
  await p.close();
}

/* ------------------------------------------------ 28.3 ekte Bubble Card: ingen mørk topplinje, headeren transparent over scenen */
const BC = resolve('test/.vendor/bubble-card.js');
if (existsSync(BC)) {
  for (const vp of [{ w: 390, h: 844, sb: 0, tag: 'mobil' }, { w: 1400, h: 900, sb: 256, tag: 'PC' }]) {
    const p = await page({ width: vp.w, height: vp.h }, 'test/harness-bubble.html');
    await p.addScriptTag({ path: BC, type: 'module' });
    await p.waitForFunction(() => customElements.get('bubble-card'), null, { timeout: 15000 });
    const S = await p.evaluate(async (sb) => {
      const w = (ms) => new Promise((q) => setTimeout(q, ms));
      document.documentElement.style.setProperty('--sb', sb + 'px');
      const h = window.mockHass();
      // popupen slik HA-brukeren har den: mal A-styles med mørk header-bakgrunn, UTEN strategiens ki-vaer-blokk
      const pop = window.MSH.popupTemplateA({ name: 'Vær', icon: 'mdi:weather-partly-cloudy', hash: '#vaer', card: { type: 'custom:msh-vaer-card', card_id: 'pop-vaer', view: 'sheet' } }); // 56 I: Ark
      pop.styles = (pop.styles || '') + '\n#header-container > div > div { background: var(--gray000)!important; }\n.bubble-header-container{background:#111!important}';
      const bc = document.createElement('bubble-card'); bc.setConfig(pop); bc.hass = h; document.getElementById('dash').appendChild(bc);
      await w(400); location.hash = '#vaer'; await w(1500);
      const all = []; const walk = (r) => r.querySelectorAll('*').forEach((e) => { all.push(e); if (e.shadowRoot) walk(e.shadowRoot); }); walk(document);
      const P = all.find((e) => e.classList && e.classList.contains('bubble-pop-up')), hd = P.querySelector('.bubble-header-container'), lay = P.querySelector(':scope > .msh-vaer-scene');
      const inner = hd.querySelector('#header-container > div > div') || hd.querySelector('div > div');
      const C = P.querySelector('.bubble-pop-up-container');
      C.scrollTop = 500; C.dispatchEvent(new Event('scroll')); await w(300);
      const pr = P.getBoundingClientRect(), lr = lay && lay.getBoundingClientRect(), hr = hd.getBoundingClientRect();
      const bg = (e) => (e ? getComputedStyle(e).backgroundColor : null);
      const card = all.find((e) => e.localName === 'msh-vaer-card'), cs = card.shadowRoot.querySelector('.ctl-slot').getBoundingClientRect();
      return { attr: P.getAttribute('data-ki-vaer'), skin: P.getRootNode().querySelectorAll('style[data-ki-vaer-skin]').length, lay: lr && [Math.round(lr.top - pr.top), Math.round(lr.height - pr.height), Math.round(lr.width - pr.width)],
        hdBg: bg(hd), innerBg: bg(inner), popBg: bg(P), after: getComputedStyle(hd, '::after').display, mask: getComputedStyle(C).maskImage || getComputedStyle(C).webkitMaskImage, hdTop: Math.round(hr.top - pr.top),
        ctlGap: Math.round(pr.bottom - cs.bottom), ctlInHeader: cs.top < hr.bottom };
    }, vp.sb);
    if (shots) await p.screenshot({ path: `${shots}/vaer28-${vp.tag}-bubble.png` });
    const tr = (v) => !v || v === 'rgba(0, 0, 0, 0)' || v === 'transparent';
    ok(`${vp.tag} 28.3 ekte Bubble: kortet legger inn værstilen selv, scenelaget dekker hele popupen helt opp`, S.attr === 'scene' && S.skin === 1 && S.lay && S.lay.every((x) => x === 0) && S.hdTop >= 0, S);
    ok(`${vp.tag} 28.3 ingen mørk topplinje: header, headerens indre og popupen transparente, ingen scroll-skygge`, tr(S.hdBg) && tr(S.innerBg) && tr(S.popBg) && S.after === 'none', S);
    ok(`${vp.tag} 28.1 ekte Bubble: kontrollene 16 px over bunnen, ikke i headeren, ingen bunn-maske`, S.ctlGap === 16 && !S.ctlInHeader && !/calc\(100% - /.test(S.mask || ''), S);
    await p.close();
  }
} else ok('28.3 ekte Bubble Card (test/.vendor/bubble-card.js – kjør npm run checklist først)', false, 'mangler');

/* ------------------------------------------------ 28.4 Hjem: navbar + «Spilles nå» skjules når #vaer er åpen
   (Fiks 57 C: navbarens hide_in_popups, standard ['#vaer'] – data-hidden, glir ut/inn 180 ms, i Ark og Fullskjerm; test/navbar57-check.mjs) */
{
  const p = await page({ width: 390, height: 844 });
  const N = await p.evaluate(async () => {
    const w = (ms) => new Promise((q) => setTimeout(q, ms));
    const h = window.mockHass();
    const nb = document.createElement('msh-navbar-card');
    const wrap = document.createElement('div'); document.getElementById('dash').appendChild(wrap); // ikke «#dash > msh-navbar-card» (mock-selvtesten)
    nb.setConfig({ type: 'custom:msh-navbar-card', card_id: 'nb' }); nb.hass = h; wrap.appendChild(nb);
    window.MSH.store.set('cards.pop-vaer', { view: 'sheet' }); // Ark – 57 C: listen gjelder begge visningene
    await w(600);
    const pt = document.querySelector('.msh-navbar-portal') || [...document.querySelectorAll('*')].find((e) => e.shadowRoot && e.shadowRoot.querySelector('[data-nav]'));
    const nav = pt.shadowRoot.querySelector('nav.nb'), mini = pt.shadowRoot.querySelector('.mini');
    const st = () => ({ hash: location.hash, v: pt.hasAttribute('data-hidden'), op: getComputedStyle(nav).opacity, tr: getComputedStyle(nav).transitionDuration, pe: getComputedStyle(nav).pointerEvents, mini: mini ? [getComputedStyle(mini).opacity, getComputedStyle(mini).transitionDuration] : null });
    const s0 = st();
    location.hash = '#vaer'; window.dispatchEvent(new HashChangeEvent('hashchange'));
    const s1 = st(); // straks etter hashchange (ingen polling)
    await w(100); const sMid = st();
    await w(400); const s2 = st();
    location.hash = ''; window.dispatchEvent(new HashChangeEvent('hashchange'));
    const s3 = st(); await w(100); const s3m = st(); await w(400); const s4 = st();
    return { s0, s1, sMid, s2, s3, s3m, s4 };
  });
  const dur = (t) => /^0\.18s/.test(t);
  ok('28.4/57 C (Ark) #vaer åpnes → navbar + Spilles nå skjules straks på hashchange, 180 ms', !N.s0.v && N.s1.v && dur(N.s1.tr) && Number(N.sMid.op) > 0 && Number(N.sMid.op) < 1 && N.s2.op === '0' && N.s2.pe === 'none' && (!N.s1.mini || dur(N.s1.mini[1])), N);
  ok('28.4/57 C #vaer lukkes → vises igjen, 180 ms', !N.s3.v && dur(N.s3.tr) && Number(N.s3m.op) > 0 && Number(N.s3m.op) < 1 && N.s4.op === '1' && N.s4.pe !== 'none', N);
  await p.close();
}

ok('ingen sidefeil', !errs.length, errs);
await b.close();
console.log(JSON.stringify(res, null, 1));
if (fail.length) { console.error('FEIL:', fail.join(' · ')); process.exit(1); }
console.log('Alle Vær 28-sjekker OK');
